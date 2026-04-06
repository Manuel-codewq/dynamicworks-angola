/* ═══════════════════════════════════════════════════════════
   DynamicWorks Angola — app.js (core state + init)
   Apenas: constantes, STATE, helpers DOM, toast, init.
   Todos os módulos importam daqui via window.S / window.T
═══════════════════════════════════════════════════════════ */
'use strict';

var APP_ID   = 127916;
var WS_URL   = 'wss://ws.binaryws.com/websockets/v3?app_id=' + APP_ID + '&l=PT';
var TAXA_AOA = 950;
var MARKUP   = 2;

var ASSETS = [
  { sym:'R_10',    name:'Volatility 10',      short:'V10',   pip:4 },
  { sym:'R_25',    name:'Volatility 25',      short:'V25',   pip:4 },
  { sym:'R_50',    name:'Volatility 50',      short:'V50',   pip:4 },
  { sym:'R_75',    name:'Volatility 75',      short:'V75',   pip:4 },
  { sym:'R_100',   name:'Volatility 100',     short:'V100',  pip:4 },
  { sym:'1HZ10V',  name:'Volatility 10(1s)',  short:'V10s',  pip:4 },
  { sym:'1HZ25V',  name:'Volatility 25(1s)',  short:'V25s',  pip:4 },
  { sym:'1HZ50V',  name:'Volatility 50(1s)',  short:'V50s',  pip:4 },
  { sym:'1HZ75V',  name:'Volatility 75(1s)',  short:'V75s',  pip:4 },
  { sym:'1HZ100V', name:'Volatility 100(1s)', short:'V100s', pip:4 },
];

/* ── STATE GLOBAL ── */
var S = {
  ws: null, token: null, acct: null,
  loggedIn: false, isDemo: false,
  balance: 0, currency: 'USD',
  asset: null,
  prices: {}, priceHistory: {}, contracts: [], history: [], tpMap: {},
  pingTimer: null, reconnTimer: null, reconnN: 0,
  /* barreiras reais por contrato — vindas da Deriv, nunca estimadas */
  barriers: {},  /* { contract_id: { lo, hi } } */
};

/* ── TRADE FORM STATE ── */
var T = { rate:1, stake:0, tpEnabled:false, tpValue:0, proposal:null, _pt:null, _inCooldown:false };

/* ── DOM HELPERS ── */
function $(id)      { return document.getElementById(id); }
function txt(id,v)  { var e=$(id); if(e) e.textContent=v; }
function html(id,v) { var e=$(id); if(e) e.innerHTML=v; }
function show(id)   { var e=$(id); if(e) e.style.display=''; }
function hide(id)   { var e=$(id); if(e) e.style.display='none'; }

function esc(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function toast(title, body, type) {
  var t=$('toast'); if(!t) return;
  txt('toastT',title); txt('toastB',body||'');
  t.className='toast show'+(type?' toast-'+type:'');
  clearTimeout(t._t);
  t._t=setTimeout(function(){ t.classList.remove('show'); },3000);
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function(s){ s.classList.remove('active'); });
  var e=$(id); if(e) e.classList.add('active');
}

function hideLoading() {
  var e=$('s-loading'); if(!e) return;
  e.classList.remove('active');
  e.classList.add('fade-out');
  setTimeout(function(){ e.style.display='none'; },400);
}
function setLoading(t) { txt('loadingText',t); }

/* ── NAVIGATION ── */
window.goToView=function(viewId,btnEl){
  document.querySelectorAll('.view').forEach(function(v){ v.classList.remove('active'); });
  document.querySelectorAll('.bnav-btn').forEach(function(b){ b.classList.remove('active'); });
  var v=$(viewId); if(v){ v.classList.add('active'); v.scrollTop=0; }
  if(typeof btnEl==='string') btnEl=$(btnEl);
  if(btnEl) btnEl.classList.add('active');
  if(viewId==='v-chart') setTimeout(chartResize,30);
  if(viewId==='v-ranking'){
    var banner=$('wrNickBanner');
    if(banner) banner.style.display=(!_fb.nickname)?'flex':'none';
  }
  if(window.lucide) lucide.createIcons();
};

window.openModal  = function(){ var m=$('modal'); if(m) m.classList.add('open'); };
window.closeModal = function(){ var m=$('modal'); if(m) m.classList.remove('open'); };

window.openAssetPicker=function(){
  var list=$('assetPickerList'); if(!list) return;
  list.innerHTML=ASSETS.map(function(a){
    var pr=S.prices[a.sym];
    var pStr=pr?pr.p.toFixed(a.pip):'...';
    var chg=pr?(pr.chg>=0?'+':'')+pr.chg.toFixed(2)+'%':'...';
    var chgCls=pr&&pr.chg<0?'red':'green';
    var sel=a.sym===S.asset.sym;
    return '<div onclick="selectAsset(\''+a.sym+'\');closeAssetPicker()" style="display:flex;align-items:center;justify-content:space-between;padding:.65rem .75rem;border-radius:10px;background:'+(sel?'rgba(0,212,255,.08)':'rgba(255,255,255,.03)')+';border:1px solid '+(sel?'rgba(0,212,255,.25)':'rgba(255,255,255,.07)')+';cursor:pointer;transition:all .15s">'
      +'<div><div style="font-size:.82rem;font-weight:800;color:'+(sel?'var(--accent)':'var(--text)')+'">'+esc(a.name)+'</div>'
      +'<div style="font-size:.6rem;font-family:var(--mono);color:var(--text3);margin-top:.1rem">'+a.sym+(sel?' · SELECIONADO':'')+'</div></div>'
      +'<div style="text-align:right"><div style="font-size:.78rem;font-family:var(--mono);color:var(--text)">'+pStr+'</div>'
      +'<div style="font-size:.65rem;font-family:var(--mono);color:var(--'+chgCls+')">'+chg+'</div></div>'
      +'</div>';
  }).join('');
  var m=$('assetPickerModal'); if(m) m.classList.add('open');
  if(window.lucide) lucide.createIcons();
};
window.closeAssetPicker=function(){ var m=$('assetPickerModal'); if(m) m.classList.remove('open'); };

/* ── INIT ── */
document.addEventListener('DOMContentLoaded',function(){
  if(window._taxaUsdAoa && window._taxaUsdAoa !== TAXA_AOA) TAXA_AOA=window._taxaUsdAoa;
  window.addEventListener('app-ready', function(){
    if(window._taxaUsdAoa && window._taxaUsdAoa !== TAXA_AOA){
      TAXA_AOA=window._taxaUsdAoa;
      if(S.loggedIn) renderBalance();
    }
  },{ once:true });

  /* verificar código de verificação pendente */
  try {
    var pendingCode=extractVerificationCode();
    if(pendingCode){
      window._pendingRegCode=pendingCode;
      var modal=document.getElementById('registerModal');
      if(modal && modal.classList.contains('open')){
        var ci=document.getElementById('regCode');
        if(ci){ ci.value=pendingCode; var hint=document.getElementById('regCodeHint'); if(hint) hint.style.display='flex'; }
      }
    }
  } catch(e){}

  if(loadSession()){ setLoading('A conectar...'); wsConnect(); }
  else{
    hideLoading(); showScreen('s-landing');
    if(window._appReady) window._loadLandingTestimonials();
    else window.addEventListener('app-ready',function(){ window._loadLandingTestimonials(); },{once:true});
  }
  if(window.lucide) lucide.createIcons();
});

window.prices=S.prices;
window.sel=S.asset;