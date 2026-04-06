/* ═══════════════════════════════════════════════════════════
   DynamicWorks Angola — ticks.js
   Ticks em tempo real + barreiras REAIS vindas da Deriv
   (proposal_open_contract), análise, alertas, sons, háptico.

   CORREÇÃO PRINCIPAL:
   - Barreiras mostradas no gráfico e meter são SEMPRE as do
     servidor Deriv (c.barrier / c.low_barrier / c.high_barrier)
   - Estimativas locais (BARRIERS[rate]) usadas APENAS para
     pré-visualização no formulário ANTES de abrir contrato
   - S.barriers[contract_id] = { lo, hi } → atualizado em onContract
═══════════════════════════════════════════════════════════ */
'use strict';

/* ── TICKER STRIP ── */
function buildTickerStrip() {
  var el=$('tickerEl'); if(!el) return;
  var h='';
  ASSETS.forEach(function(a){
    h+='<span class="t-item"><span class="t-sym">'+a.short+'</span>'
      +'<span class="t-price" id="tkp_'+a.sym+'">...</span>'
      +'<span class="t-up" id="tkc_'+a.sym+'">...</span></span>';
  });
  el.innerHTML=h+h;
}

/* ── ASSET LIST ── */
function renderAssetList() {
  var el=$('assetList'); if(!el) return;
  var h='<div style="padding:.5rem .75rem .25rem;font-size:.62rem;font-family:var(--mono);color:var(--text3);text-transform:uppercase;letter-spacing:.08em">Ativos — Accumulators (24/7)</div>';
  ASSETS.forEach(function(a){
    var pr=S.prices[a.sym];
    var pStr=pr?pr.p.toFixed(a.pip):'...';
    var cStr=pr?(pr.chg>=0?'+':'')+pr.chg.toFixed(2)+'%':'...';
    var cCls=pr&&pr.chg<0?'dn':'up';
    var sel=a.sym===S.asset.sym?' selected':'';
    h+='<div class="asset-row'+sel+'" onclick="selectAsset(\''+a.sym+'\')">'
      +'<div class="a-info"><span class="a-sym">'+esc(a.name)+'</span><span class="synt-badge">ACCU</span></div>'
      +'<div class="a-price-col"><span class="a-price" id="ap_'+a.sym+'">'+pStr+'</span>'
      +'<span class="a-chg '+cCls+'" id="ac_'+a.sym+'">'+cStr+'</span></div>'
      +'</div>';
  });
  el.innerHTML=h;
}

window.selectAsset=function(sym){
  var a=ASSETS.find(function(x){ return x.sym===sym; }); if(!a) return;
  S.asset=a; renderAssetList();
  txt('chAsset',a.name); txt('tradeAssetName',a.name);

  /* barreiras reais do contrato aberto neste ativo, se existir */
  var realBarriers=_getRealBarriers(sym);
  var pr=S.prices[sym];
  if(pr){
    txt('chPrice',pr.p.toFixed(a.pip));
    txt('tradeAssetPrice',pr.p.toFixed(a.pip));
    txt('spotNow',pr.p.toFixed(a.pip));
    if(realBarriers){
      updateMeter(pr.p,realBarriers.lo,realBarriers.hi);
      updateAccuAnalysis(pr.p,realBarriers.lo,realBarriers.hi,sym);
    } else {
      /* sem contrato: mostrar estimativa apenas no formulário */
      var bpct=(BARRIERS_EST[T.rate]||0.003);
      updateMeter(pr.p,pr.p*(1-bpct),pr.p*(1+bpct));
      updateAccuAnalysis(pr.p,0,0,sym);
    }
  }

  /* reset chart */
  _chart.prices=[]; _chart.tickCount=0; _chart.lastTs=0;
  _chart.lastLo=null; _chart.lastHi=null;
  if(_chart.areaSeries){
    if(_chart.plHi)   { try{_chart.areaSeries.removePriceLine(_chart.plHi);}catch(e){} _chart.plHi=null; }
    if(_chart.plLo)   { try{_chart.areaSeries.removePriceLine(_chart.plLo);}catch(e){} _chart.plLo=null; }
    if(_chart.plSpot) { try{_chart.areaSeries.removePriceLine(_chart.plSpot);}catch(e){} _chart.plSpot=null; }
    _chart.areaSeries.setData([]);
    _loadTickHistory(sym,function(arr){ _chartInjectHistory(arr); });
  }
  goToView('v-chart',$('bnChart'));
  if(T.stake>0) requestProposal();
};

/* Estimativas LOCAIS — usadas APENAS para pré-visualização no form */
var BARRIERS_EST = { 1:0.0041, 2:0.0029, 3:0.0021, 4:0.0017, 5:0.0013 };

/* ── Obter barreiras REAIS do contrato aberto para um símbolo ── */
function _getRealBarriers(sym) {
  for(var i=0;i<S.contracts.length;i++){
    var c=S.contracts[i];
    if(c.underlying!==sym) continue;
    var lo=null, hi=null;
    /* proposal_open_contract devolve barrier (high) e low_barrier */
    if(c.barrier && c.low_barrier){
      hi=parseFloat(c.barrier);
      lo=parseFloat(c.low_barrier);
    } else if(c.high_barrier && c.low_barrier){
      hi=parseFloat(c.high_barrier);
      lo=parseFloat(c.low_barrier);
    }
    if(lo && hi && lo>0 && hi>0) return {lo:lo, hi:hi};
  }
  return null;
}

/* ── onTick — motor principal ── */
function onTick(d) {
  if(!d.tick) return;
  var t=d.tick, sym=t.symbol, p=parseFloat(t.quote);
  var prev=S.prices[sym]?S.prices[sym].p:p;
  var chg=prev?((p-prev)/prev)*100:0;
  S.prices[sym]={p:p,chg:chg,epoch:t.epoch};

  /* histórico de preços para análise de volatilidade */
  if(!S.priceHistory[sym]) S.priceHistory[sym]=[];
  S.priceHistory[sym].push(p);
  if(S.priceHistory[sym].length>100) S.priceHistory[sym].shift();

  /* ticker strip */
  var pEl=$('tkp_'+sym), cEl=$('tkc_'+sym);
  if(pEl) pEl.textContent=p.toFixed(4);
  if(cEl){ cEl.textContent=(chg>=0?'+':'')+chg.toFixed(2)+'%'; cEl.className=chg>=0?'t-up':'t-dn'; }

  /* asset list row */
  var apEl=$('ap_'+sym), acEl=$('ac_'+sym);
  if(apEl) apEl.textContent=p.toFixed(4);
  if(acEl){ acEl.textContent=(chg>=0?'+':'')+chg.toFixed(2)+'%'; acEl.className='a-chg '+(chg>=0?'up':'dn'); }

  if(sym!==S.asset.sym) return;

  /* main price display */
  var pip=S.asset.pip||4;
  txt('chPrice',p.toFixed(pip));
  txt('tradeAssetPrice',p.toFixed(pip));
  txt('spotNow',p.toFixed(pip));

  var badge=$('chBadge');
  if(badge){ badge.textContent=(chg>=0?'+':'')+chg.toFixed(3)+'%'; badge.className='cv-badge '+(chg>=0?'up':'dn'); }

  /* ── BARREIRAS REAIS — vindas da Deriv via proposal_open_contract ── */
  var rb=_getRealBarriers(sym);
  var lo=rb?rb.lo:null, hi=rb?rb.hi:null;

  if(lo && hi){
    txt('barrierLow',  lo.toFixed(pip));
    txt('barrierHigh', hi.toFixed(pip));
    updateMeter(p,lo,hi);

    /* som de tick proporcional à distância REAL */
    var range=hi-lo;
    if(range>0){
      var distLoPct=((p-lo)/range)*100;
      var distHiPct=((hi-p)/range)*100;
      var nearestPct=Math.min(distLoPct,distHiPct);
      _playTick(nearestPct);
      if(nearestPct<5)       _vibrate('tick_danger');
      else if(nearestPct<12) _vibrate('tick_warn');
    }
  } else {
    txt('barrierLow','—');
    txt('barrierHigh','—');
    updateMeter(p,0,0);
  }

  /* push ao gráfico com barreiras reais */
  chartPush(p,lo,hi);
  updateAccuAnalysis(p,lo,hi,sym);
  _checkSmartAlerts(p,lo,hi,sym);

  /* take profit automático */
  S.contracts.forEach(function(c){
    if(c.underlying!==sym) return;
    var tp=S.tpMap[c.contract_id];
    if(tp && parseFloat(c.profit||0)>=tp){
      delete S.tpMap[c.contract_id];
      toast('Take Profit!','A fechar contrato...','success');
      wsSend({sell:c.contract_id,price:0});
    }
  });
}

/* ── METER ── */
function updateMeter(spot,lo,hi) {
  var bar=$('accuMeterBar'); if(!bar) return;
  if(!lo||!hi||hi<=lo){ bar.style.width='50%'; bar.style.background='var(--text3)'; return; }
  var pct=Math.max(0,Math.min(100,((spot-lo)/(hi-lo))*100));
  bar.style.width=pct+'%';
  bar.style.background=(pct<15||pct>85)?'var(--red)':'var(--green)';
}

/* ── ANÁLISE DO PAINEL ── */
function updateAccuAnalysis(spot, lo, hi, sym) {
  var cursor  =$('aapMeterCursor');
  var spotLbl =$('aapSpotLabel');
  var meterSub=$('aapMeterSub');
  var volPct  =$('aapVolPct');
  var recEl   =$('aapRec');
  var recTxt  =$('aapRecText');
  if(!cursor) return;

  var pip=S.asset?S.asset.pip||4:4;
  if(spotLbl) spotLbl.textContent=spot.toFixed(pip);

  var range=lo&&hi?hi-lo:0;

  if(range>0){
    var posPct=Math.max(2,Math.min(98,((spot-lo)/range)*100));
    cursor.style.left=posPct.toFixed(1)+'%';

    var distLo=((spot-lo)/spot)*100;
    var distHi=((hi-spot)/spot)*100;
    var distMin=Math.min(distLo,distHi);
    var side=distLo<distHi?'↓ barreira baixa':'↑ barreira alta';
    if(meterSub) meterSub.textContent='Distância à '+side+': '+distMin.toFixed(3)+'%';

    var distLoEl=$('aapDistLo'), distHiEl=$('aapDistHi');
    if(distLoEl && distHiEl){
      var dvLo=spot-lo, dvHi=hi-spot;
      distLoEl.textContent='$'+dvLo.toFixed(pip);
      distLoEl.style.color=dvLo<range*0.15?'var(--red)':dvLo<range*0.3?'var(--yellow)':'var(--green)';
      distHiEl.textContent='$'+dvHi.toFixed(pip);
      distHiEl.style.color=dvHi<range*0.15?'var(--red)':dvHi<range*0.3?'var(--yellow)':'var(--green)';
    }
  } else {
    cursor.style.left='50%';
    if(meterSub) meterSub.textContent='Sem contrato aberto — barreiras reais disponíveis após abertura';
    var de=$('aapDistLo'), dh=$('aapDistHi');
    if(de){ de.textContent='—'; de.style.color=''; }
    if(dh){ dh.textContent='—'; dh.style.color=''; }
  }

  /* volatilidade */
  var hist=S.priceHistory[sym]||[];
  var recent=hist.slice(-20);
  var vol=0, volLabel='—', riskLevel='normal';
  if(recent.length>=5){
    var mean=recent.reduce(function(s,v){ return s+v; },0)/recent.length;
    var variance=recent.reduce(function(s,v){ return s+Math.pow(v-mean,2); },0)/recent.length;
    var stddev=Math.sqrt(variance);
    vol=(stddev/mean)*100;
    volLabel=vol.toFixed(4)+'%';
    if(vol<0.005) riskLevel='low';
    else if(vol<0.015) riskLevel='normal';
    else if(vol<0.03) riskLevel='high';
    else riskLevel='very_high';
  }
  if(volPct){
    volPct.textContent=recent.length>=5?volLabel:'...';
    volPct.style.color={low:'var(--green)',normal:'var(--text)',high:'var(--yellow)',very_high:'var(--red)'}[riskLevel]||'var(--text)';
  }

  /* recomendação */
  if(recEl && recTxt){
    var rate=T.rate||1;
    var rec, cls;
    var bwPct=(BARRIERS_EST[rate]||0.003)*100;
    var warnThr=bwPct*1.8, dangerThr=bwPct*0.8;

    var last5=hist.slice(-5);
    var maxTickMove=0;
    for(var i=1;i<last5.length;i++){
      var mv=Math.abs(last5[i]-last5[i-1]);
      if(mv>maxTickMove) maxTickMove=mv;
    }
    var distAbsPips=range>0?Math.min(spot-lo,hi-spot):Infinity;
    var spikeRisk=distAbsPips>0&&maxTickMove>0&&(maxTickMove/distAbsPips)>0.4;

    if(!lo||!hi){
      rec='Sem contrato aberto. As barreiras reais da Deriv serão exibidas após abertura.';
      cls='safe';
    } else if(riskLevel==='very_high'){
      rec='Volatilidade muito alta agora. O preço está a mover-se muito — risco de knock-out elevado. Considera esperar ou usar taxa 1%.';
      cls='danger';
    } else if(spikeRisk){
      rec='Spike detectado! Um tick recente moveu >'+Math.round((maxTickMove/distAbsPips)*100)+'% da distância à barreira. Risco real de KO num único tick.';
      cls='danger';
    } else if(riskLevel==='high'&&rate>=3){
      rec='Volatilidade elevada com taxa '+rate+'%. Recomenda-se taxa 1% ou 2%.';
      cls='warn';
    } else if(range>0&&Math.min(distLo,distHi)<warnThr&&rate>=3){
      var sideW=distLo<distHi?'baixa':'alta';
      rec='O preço está perto da barreira '+sideW+' ('+Math.min(distLo,distHi).toFixed(3)+'%). Com taxa '+rate+'%, o risco é alto.';
      cls='warn';
    } else if(range>0&&Math.min(distLo,distHi)<dangerThr){
      var sideD=distLo<distHi?'inferior':'superior';
      rec='Atenção: preço muito próximo da barreira '+sideD+' ('+Math.min(distLo,distHi).toFixed(3)+'%). Risco de knock-out imediato.';
      cls='danger';
    } else if(riskLevel==='low'&&range>0){
      var posPctR=((spot-lo)/range)*100;
      if(posPctR>25&&posPctR<75){
        rec='Condições favoráveis — preço centrado e volatilidade baixa. Boa altura para entrar.';
        cls='safe';
      } else {
        rec='Preço dentro da zona segura. Volatilidade baixa.';
        cls='safe';
      }
    } else {
      rec='Preço dentro da zona segura. Volatilidade '+(riskLevel==='normal'?'normal':'moderada')+'. Podes entrar com cautela.';
      cls='safe';
    }

    recEl.className='aap-rec '+cls;
    recEl.querySelector('.aap-rec-ico').textContent={safe:'✅',warn:'⚠️',danger:'🚨'}[cls]||'💡';
    recTxt.textContent=rec;
  }
}

/* ── ALERTAS INTELIGENTES ── */
var _lastAlertTime=0, _alertCooldown=8000, _alertShown={};

function _checkSmartAlerts(spot,lo,hi,sym){
  var now=Date.now();
  var el=$('smartAlert'); if(!el) return;

  if(lo&&hi&&S.contracts.some(function(c){ return c.underlying===sym; })){
    var distLoPct=((spot-lo)/spot)*100;
    var distHiPct=((hi-spot)/spot)*100;
    var distMin=Math.min(distLoPct,distHiPct);
    var side=distLoPct<distHiPct?'baixa ↓':'alta ↑';
    var openCt=S.contracts.find(function(c){ return c.underlying===sym; });
    var actRate=openCt?(Math.round(parseFloat(openCt.growth_rate||0)*100)||T.rate):T.rate;
    var bwPct=(BARRIERS_EST[actRate]||0.003)*100;
    var warnThr=bwPct*1.8, dangerThr=bwPct*0.8;

    var histSA=S.priceHistory[sym]||[], last5SA=histSA.slice(-5), maxMvSA=0;
    for(var sia=1;sia<last5SA.length;sia++){
      var mvsa=Math.abs(last5SA[sia]-last5SA[sia-1]);
      if(mvsa>maxMvSA) maxMvSA=mvsa;
    }
    var range=hi-lo;
    var distAbsSA=range>0?Math.min(spot-lo,hi-spot):Infinity;
    var spikeRiskSA=distAbsSA>0&&maxMvSA>0&&(maxMvSA/distAbsSA)>0.4;

    if(spikeRiskSA&&(!_alertShown['spike']||now-_alertShown['spike']>_alertCooldown)){
      _alertShown['spike']=now;
      _showSmartAlert('🚨','Spike detectado! Movimento de '+Math.round((maxMvSA/distAbsSA)*100)+'% da distância à barreira num único tick.','danger');
      _playSpike(); _vibrate('spike'); return;
    }
    if(distMin<warnThr&&(!_alertShown['barrier']||now-_alertShown['barrier']>_alertCooldown)){
      _alertShown['barrier']=now;
      var isKO=distMin<dangerThr;
      _showSmartAlert(isKO?'🚨':'⚠️',
        isKO?'PERIGO! Preço a '+distMin.toFixed(3)+'% da barreira '+side+' — knock-out iminente!'
           :'Atenção: preço a '+distMin.toFixed(3)+'% da barreira '+side,
        isKO?'danger':'warn');
      _vibrate(isKO?'barrier_ko':'barrier_warn'); return;
    }
  }

  var histV=S.priceHistory[sym]||[];
  if(histV.length>=10){
    var recentV=histV.slice(-10);
    var meanV=recentV.reduce(function(s,v){ return s+v; },0)/recentV.length;
    var sdV=Math.sqrt(recentV.reduce(function(s,v){ return s+Math.pow(v-meanV,2); },0)/recentV.length);
    var volV=(sdV/meanV)*100;
    if(volV>0.04&&(!_alertShown['vol']||now-_alertShown['vol']>_alertCooldown*3)){
      _alertShown['vol']=now;
      if(!S.contracts.some(function(c){ return c.underlying===sym; })){
        _showSmartAlert('📊','Volatilidade muito alta agora ('+volV.toFixed(3)+'%) — risco elevado de knock-out. Aguarda ou usa taxa 1%.','warn');
      }
      return;
    }
  }

  if(!S.contracts.some(function(c){ return c.underlying===sym; })){
    var histG=S.priceHistory[sym]||[];
    if(histG.length>=20){
      var r20=histG.slice(-20);
      var m20=r20.reduce(function(s,v){ return s+v; },0)/r20.length;
      var v20=Math.sqrt(r20.reduce(function(s,v){ return s+Math.pow(v-m20,2); },0)/r20.length);
      var vol20=(v20/m20)*100;
      if(vol20<0.005&&(!_alertShown['good']||now-_alertShown['good']>30000)){
        _alertShown['good']=now;
        _showSmartAlert('✅','Mercado estável — boa altura para entrar!','good');
        return;
      }
    }
  }

  if(el.style.display!=='none'){
    var alertType=el.dataset.alertType;
    if(alertType==='good'||alertType==='warn'){
      if(!el._hideTimer){
        el._hideTimer=setTimeout(function(){ el.style.display='none'; el._hideTimer=null; },6000);
      }
    }
  }
}

function _showSmartAlert(icon,text,type){
  var el=$('smartAlert'), ico=$('smartAlertIcon'), txt2=$('smartAlertText');
  if(!el||!ico||!txt2) return;
  ico.textContent=icon; txt2.textContent=text; el.dataset.alertType=type;
  var colors={
    danger:{bg:'rgba(255,61,90,.18)',border:'rgba(255,61,90,.45)',text:'#ff6b7a'},
    warn:  {bg:'rgba(255,193,7,.12)',border:'rgba(255,193,7,.35)', text:'#ffc107'},
    good:  {bg:'rgba(0,230,118,.1)', border:'rgba(0,230,118,.3)',  text:'#00e676'},
  };
  var c=colors[type]||colors.warn;
  el.style.background=c.bg;
  el.style.borderTopColor=c.border;
  el.style.borderBottomColor=c.border;
  txt2.style.color=c.text;
  if(el._hideTimer){ clearTimeout(el._hideTimer); el._hideTimer=null; }
  el.style.display='flex';
  try{
    var ctx=_getAudio();
    if(ctx){
      var osc=ctx.createOscillator(), g=ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type='sine'; osc.frequency.value=type==='danger'?880:type==='good'?523:660;
      g.gain.setValueAtTime(0,ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.12,ctx.currentTime+0.02);
      g.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime+0.3);
    }
  }catch(e){}
}

/* ── WEB AUDIO ── */
var _audioCtx=null;
function _getAudio(){
  if(_audioCtx) return _audioCtx;
  try{ _audioCtx=new(window.AudioContext||window.webkitAudioContext)(); }catch(e){}
  return _audioCtx;
}
document.addEventListener('touchstart',function(){ var c=_getAudio(); if(c&&c.state==='suspended') c.resume(); },{once:true,passive:true});
document.addEventListener('click',function(){ var c=_getAudio(); if(c&&c.state==='suspended') c.resume(); },{once:true});

function _playWin(){
  var ctx=_getAudio(); if(!ctx) return;
  [523,659,784,1047].forEach(function(freq,i){
    var osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type='sine'; osc.frequency.value=freq;
    var t=ctx.currentTime+i*0.08;
    gain.gain.setValueAtTime(0,t); gain.gain.linearRampToValueAtTime(0.18,t+0.01); gain.gain.exponentialRampToValueAtTime(0.001,t+0.35);
    osc.start(t); osc.stop(t+0.35);
  });
}
function _playLoss(){
  var ctx=_getAudio(); if(!ctx) return;
  [392,330,262].forEach(function(freq,i){
    var osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type='triangle'; osc.frequency.value=freq;
    var t=ctx.currentTime+i*0.12;
    gain.gain.setValueAtTime(0,t); gain.gain.linearRampToValueAtTime(0.15,t+0.02); gain.gain.exponentialRampToValueAtTime(0.001,t+0.45);
    osc.start(t); osc.stop(t+0.45);
  });
}
function _playTick(distPct){
  if(distPct===null||distPct===undefined) return;
  var ctx=_getAudio(); if(!ctx) return;
  var danger=Math.max(0,Math.min(1,1-(distPct/30)));
  if(danger<0.05) return;
  var osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type='sine'; osc.frequency.value=400+danger*600;
  gain.gain.setValueAtTime(0,ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.04+danger*0.12,ctx.currentTime+0.005);
  gain.gain.exponentialRampToValueAtTime(0.001,ctx.currentTime+0.08);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime+0.08);
}
function _playSpike(){
  var ctx=_getAudio(); if(!ctx) return;
  [880,1100].forEach(function(freq,i){
    var osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type='square'; osc.frequency.value=freq;
    var t=ctx.currentTime+i*0.09;
    gain.gain.setValueAtTime(0,t); gain.gain.linearRampToValueAtTime(0.14,t+0.01); gain.gain.exponentialRampToValueAtTime(0.001,t+0.12);
    osc.start(t); osc.stop(t+0.12);
  });
}
function _vibrate(type){
  if(!navigator.vibrate) return;
  var p={tick_warn:[80],tick_danger:[150,50,150],spike:[300,80,300,80,300],barrier_warn:[100,60,100],barrier_ko:[400,100,400],win:[80,40,120],loss:[500]};
  if(p[type]) navigator.vibrate(p[type]);
}
