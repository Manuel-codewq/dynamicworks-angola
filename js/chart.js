/* ═══════════════════════════════════════════════════════════
   DynamicWorks Angola — chart.js
   LightweightCharts v4 — ticks reais, barreiras REAIS da Deriv,
   persistência Firebase/localStorage.
═══════════════════════════════════════════════════════════ */
'use strict';

var FB_DB = 'https://dynamicworks-angola-default-rtdb.firebaseio.com';
var _TMAX = 300;

/* ── Firebase tick queue ── */
var _fbQueue={}, _fbSending=false;
function _fbSaveTick(sym,price,epochSec){
  if(!_fbQueue[sym]) _fbQueue[sym]=[];
  _fbQueue[sym].push({v:price,t:epochSec});
}
function _fbFlush(){
  var syms=Object.keys(_fbQueue);
  if(!syms.length) return;
  syms.forEach(function(sym){
    var newTicks=_fbQueue[sym]; _fbQueue[sym]=[];
    if(!newTicks.length) return;
    var url=FB_DB+'/ticks/'+sym+'.json';
    var xhr=new XMLHttpRequest();
    xhr.open('GET',url,true); xhr.timeout=4000;
    xhr.onload=function(){
      var existing=[];
      try{ var parsed=JSON.parse(xhr.responseText); if(Array.isArray(parsed)) existing=parsed; }catch(e){}
      var merged=existing.concat(newTicks);
      if(merged.length>_TMAX) merged=merged.slice(-_TMAX);
      var put=new XMLHttpRequest();
      put.open('PUT',url,true); put.setRequestHeader('Content-Type','application/json');
      put.send(JSON.stringify(merged));
    };
    xhr.onerror=function(){}; xhr.ontimeout=function(){};
    xhr.send();
  });
}
setInterval(_fbFlush,3000);

function _fbLoadTicks(sym,callback){
  var url=FB_DB+'/ticks/'+sym+'.json';
  var xhr=new XMLHttpRequest();
  xhr.open('GET',url,true); xhr.timeout=5000;
  xhr.onload=function(){
    try{ var arr=JSON.parse(xhr.responseText); if(Array.isArray(arr)&&arr.length>=2){callback(arr);return;} }catch(e){}
    callback([]);
  };
  xhr.onerror=function(){callback([]);}; xhr.ontimeout=function(){callback([]);};
  xhr.send();
}

/* ── localStorage ticks ── */
function _lsTickSave(sym,price,t){
  try{ var key='dw_ticks_'+sym; var arr=_lsTickLoad(sym); arr.push({v:price,t:t}); if(arr.length>_TMAX) arr=arr.slice(-_TMAX); localStorage.setItem(key,JSON.stringify(arr)); }catch(e){}
}
function _lsTickLoad(sym){
  try{ var raw=localStorage.getItem('dw_ticks_'+sym); if(!raw) return []; var arr=JSON.parse(raw); var cut=Math.floor(Date.now()/1000)-4*60*60; return arr.filter(function(p){ return p.t>cut; }); }catch(e){ return []; }
}
function _loadTickHistory(sym,callback){
  _fbLoadTicks(sym,function(arr){ if(arr.length>=2){callback(arr);return;} callback(_lsTickLoad(sym)); });
}

/* ── Chart state ── */
var _chart={
  instance:null, areaSeries:null, prices:[], maxPts:150,
  lastTs:0, tickCount:0, lastLo:null, lastHi:null,
  plHi:null, plLo:null, plSpot:null,
};

function chartInit(){
  var container=document.getElementById('lwChart');
  if(!container) return;
  if(!window.LightweightCharts){ setTimeout(chartInit,500); return; }
  if(_chart.instance){ try{_chart.instance.remove();}catch(e){} _chart.instance=null; _chart.areaSeries=null; _chart.plHi=_chart.plLo=_chart.plSpot=null; }

  _chart.instance=LightweightCharts.createChart(container,{
    width:container.offsetWidth||360,
    height:container.offsetHeight||260,
    layout:{ background:{type:'solid',color:'#070c18'}, textColor:'rgba(140,170,200,0.65)', fontFamily:"'JetBrains Mono', monospace", fontSize:10 },
    grid:{ vertLines:{color:'rgba(255,255,255,0.03)'}, horzLines:{color:'rgba(255,255,255,0.03)'} },
    crosshair:{ mode:LightweightCharts.CrosshairMode.Normal, vertLine:{color:'rgba(0,212,255,0.25)',width:1,style:2,labelBackgroundColor:'#0f1e36'}, horzLine:{color:'rgba(0,212,255,0.25)',width:1,style:2,labelBackgroundColor:'#0f1e36'} },
    rightPriceScale:{ borderColor:'rgba(255,255,255,0.05)', textColor:'rgba(140,170,200,0.6)', scaleMargins:{top:0.15,bottom:0.15} },
    timeScale:{ borderColor:'rgba(255,255,255,0.05)', timeVisible:true, secondsVisible:true, rightOffset:10, fixLeftEdge:false, lockVisibleTimeRangeOnResize:true },
    handleScroll:{mouseWheel:false,pressedMouseMove:false,horzTouchDrag:false,vertTouchDrag:false},
    handleScale:{axisPressedMouseMove:false,mouseWheel:false,pinch:false},
  });

  _chart.areaSeries=_chart.instance.addAreaSeries({
    lineColor:'#41a8f5', lineWidth:2,
    topColor:'rgba(41,130,255,0.35)', bottomColor:'rgba(41,130,255,0.00)',
    priceLineVisible:false, lastValueVisible:false,
    crosshairMarkerVisible:true, crosshairMarkerRadius:4,
    crosshairMarkerBorderColor:'#ffffff', crosshairMarkerBackgroundColor:'#2962ff', crosshairMarkerBorderWidth:2,
  });

  var sym=S.asset?S.asset.sym:null;
  if(sym) _loadTickHistory(sym,function(arr){ _chartInjectHistory(arr); });

  if(window.ResizeObserver){ new ResizeObserver(function(){ chartResize(); }).observe(container); }
  else{ window.addEventListener('resize',chartResize); }
  setTimeout(chartResize,80);
  setTimeout(chartResize,350);
}

function _chartInjectHistory(arr){
  if(!_chart.areaSeries||arr.length<2) return;
  var lastT=0;
  var data=arr.map(function(p){ var t=p.t; if(t<=lastT) t=lastT+1; lastT=t; return {time:t,value:p.v}; });
  _chart.areaSeries.setData(data);
  _chart.prices=data; _chart.lastTs=lastT; _chart.tickCount=data.length;
  _chart.instance.timeScale().scrollToRealTime();
}

function chartResize(){
  if(!_chart.instance) return;
  var c=document.getElementById('lwChart');
  if(!c||!c.offsetWidth) return;
  _chart.instance.resize(c.offsetWidth,c.offsetHeight);
}

/* ── chartPush — chamado pelo onTick com barreiras REAIS ── */
function chartPush(price,lo,hi){
  if(!_chart.areaSeries) return;
  var nowSec=Math.floor(Date.now()/1000);
  if(nowSec<=_chart.lastTs) nowSec=_chart.lastTs+1;
  _chart.lastTs=nowSec; _chart.tickCount++;
  var pt={time:nowSec,value:price};
  _chart.prices.push(pt);
  if(_chart.prices.length>_chart.maxPts) _chart.prices.shift();
  var sym=S.asset?S.asset.sym:null;
  if(sym){ _fbSaveTick(sym,price,nowSec); _lsTickSave(sym,price,nowSec); }
  if(_chart.tickCount<=4) _chart.areaSeries.setData(_chart.prices);
  else _chart.areaSeries.update(pt);
  /* só atualizar linhas de barreira se os valores mudaram */
  if(lo&&hi&&(_chart.lastLo!==lo||_chart.lastHi!==hi)){
    _chart.lastLo=lo; _chart.lastHi=hi;
    _chartUpdateBarriers(lo,hi);
  }
  _chartUpdateSpotLine(price);
  _chart.instance.timeScale().scrollToRealTime();
}

function _chartUpdateBarriers(lo,hi){
  if(!_chart.areaSeries) return;
  if(_chart.plHi){ try{_chart.areaSeries.removePriceLine(_chart.plHi);}catch(e){} _chart.plHi=null; }
  if(_chart.plLo){ try{_chart.areaSeries.removePriceLine(_chart.plLo);}catch(e){} _chart.plLo=null; }
  _chart.plHi=_chart.areaSeries.createPriceLine({ price:hi, color:'#ff3d5a', lineWidth:1, lineStyle:LightweightCharts.LineStyle.Dashed, axisLabelVisible:true, title:'KO ▲' });
  _chart.plLo=_chart.areaSeries.createPriceLine({ price:lo, color:'#ff3d5a', lineWidth:1, lineStyle:LightweightCharts.LineStyle.Dashed, axisLabelVisible:true, title:'KO ▼' });
}

function _chartUpdateSpotLine(price){
  if(!_chart.areaSeries) return;
  if(_chart.plSpot){ try{_chart.areaSeries.removePriceLine(_chart.plSpot);}catch(e){} _chart.plSpot=null; }
  _chart.plSpot=_chart.areaSeries.createPriceLine({ price:price, color:'#41a8f5', lineWidth:1, lineStyle:LightweightCharts.LineStyle.Solid, axisLabelVisible:true, title:'' });
}

function chartDraw(){}
