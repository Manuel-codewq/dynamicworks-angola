/* ═══════════════════════════════════════════════════════════
   DynamicWorks Angola — ws.js
   WebSocket: ligação, autenticação, reconexão, router.
   Depende de: app.js (S, T, toast, setLoading, hideLoading,
               showScreen, clearSession, loadSession)
═══════════════════════════════════════════════════════════ */
'use strict';

/* ── CONNECT ── */
function wsConnect() {
  if(S.ws && S.ws.readyState<2) return;
  setLoading('A ligar ao servidor...');
  try {
    S.ws = new WebSocket(WS_URL);
    S.ws.onopen    = wsOpen;
    S.ws.onmessage = wsMsg;
    S.ws.onclose   = wsClose;
    S.ws.onerror   = function(){};
  } catch(e){ wsReconnect(); }
}

function wsSend(obj) {
  if(S.ws && S.ws.readyState===1) S.ws.send(JSON.stringify(obj));
}

function wsOpen() {
  S.reconnN=0; clearTimeout(S.reconnTimer);
  clearInterval(S.pingTimer);
  S.pingTimer=setInterval(function(){ wsSend({ping:1}); },25000);
  if(S.token){ setLoading('A autenticar...'); wsSend({authorize:S.token}); }
  else       { hideLoading(); showScreen('s-landing'); }
}

function wsClose() {
  clearInterval(S.pingTimer);
  _tradePending=false;
  wsReconnect();
}

function wsReconnect() {
  S.reconnN++;
  clearTimeout(S.reconnTimer);
  var delay=Math.min(3000*S.reconnN,20000);
  S.reconnTimer=setTimeout(wsConnect,delay);
  if(S.loggedIn){
    if(S.reconnN===1)      toast('Ligação perdida','A reconectar...','warn');
    else if(S.reconnN===3) toast('Sem ligação','Verifica a tua internet','error');
    else if(S.reconnN>=6)  toast('Servidor indisponível','A tentar de '+Math.round(delay/1000)+'s em '+Math.round(delay/1000)+'s','error');
  }
}

/* ── MESSAGE ROUTER ── */
function wsMsg(evt) {
  var d; try{ d=JSON.parse(evt.data); }catch(e){ return; }
  if(!d) return;
  switch(d.msg_type){
    case 'authorize':              onAuth(d);        break;
    case 'balance':                onBalance(d);     break;
    case 'tick':                   onTick(d);        break;
    case 'proposal':               onProposal(d);    break;
    case 'buy':                    onBuy(d);         break;
    case 'sell':                   onSell(d);        break;
    case 'portfolio':              onPortfolio(d);   break;
    case 'proposal_open_contract': onContract(d);    break;
    case 'profit_table':           onProfitTable(d); break;
    case 'error':                  onWsErr(d);       break;
  }
}

/* ── AUTH ── */
function onAuth(d) {
  if(d.error){
    var msg=d.error.message||'', code=d.error.code||'';
    var userMsg='Sessão inválida', detail='Faz login novamente';
    if(code==='InvalidToken'||msg.toLowerCase().includes('token'))        { userMsg='Sessão expirada';     detail='O teu token expirou — faz login novamente'; }
    else if(msg.toLowerCase().includes('account'))                        { userMsg='Conta não encontrada'; detail='Verifica se a conta Deriv está activa'; }
    else if(msg.toLowerCase().includes('permission')||msg.toLowerCase().includes('scope')){ userMsg='Permissão insuficiente'; detail='Autoriza o acesso à conta no Deriv'; }
    toast(userMsg,detail,'error');
    clearSession(); hideLoading(); showScreen('s-landing');
    return;
  }
  var a=d.authorize;
  var isReconnect=S.loggedIn;
  S.loggedIn=true; S.balance=parseFloat(a.balance)||0;
  S.currency=a.currency||'USD'; S.isDemo=(a.is_virtual===1); S.acct=a.loginid;

  if(isReconnect){
    _tradePending=false;
    S.contracts=[];
    subscribeAllTicks();
    wsSend({balance:1,subscribe:1});
    loadPortfolio();
    renderBalance(); renderContracts(); renderLiveOps();
  } else {
    setLoading('A carregar...');
    afterLogin();
  }
}

function afterLogin() {
  S.asset=S.asset||ASSETS[0];
  renderNav(); renderBalance(); renderAssetList();
  subscribeAllTicks(); buildTickerStrip();
  loadFirebaseData(); renderLessons('all');

  var fbReady=function(){
    fbLoadHistory();
    loadPortfolio();
    loadProfitTable();
    wsSend({balance:1,subscribe:1});
  };
  if(window._appReady) fbReady();
  else window.addEventListener('app-ready',fbReady,{once:true});

  setTimeout(function(){
    hideLoading(); showScreen('s-dash');
    chartInit();
    if(window.lucide) lucide.createIcons();
    setTimeout(chartResize,100);
    setTimeout(chartResize,400);
    /* proposal silenciosa logo no arranque para ter barreiras reais imediatas */
    setTimeout(function(){ if(window._refreshSilentProposal) _refreshSilentProposal(); }, 800);
    setTimeout(function(){ if(!localStorage.getItem('dw_tour_done')) tourStart(); },1200);
  },300);
}

/* ── SESSION ── */
function loadSession() {
  var tk=localStorage.getItem('dw_token')||sessionStorage.getItem('dw_oauth_token');
  var ac=localStorage.getItem('dw_acct')||sessionStorage.getItem('dw_oauth_acct');
  var ts=parseInt(localStorage.getItem('dw_token_ts')||0);
  var AGE=24*60*60*1000;
  if(ts&&(Date.now()-ts)>AGE){ clearSession(); return false; }
  if(tk&&ac){ S.token=tk; S.acct=ac; return true; }
  return false;
}

function clearSession() {
  S.token=null; S.acct=null; S.loggedIn=false;
  ['dw_token','dw_acct','dw_accounts'].forEach(function(k){ localStorage.removeItem(k); });
  sessionStorage.clear();
}

/* ── WS ERROR ── */
function onWsErr(d) {
  if(!d.error) return;
  var code=d.error.code||'', msg=d.error.message||'';
  if(code==='InvalidToken'||code==='AuthorizationRequired'||code==='DisabledClient'){
    clearSession(); hideLoading(); showScreen('s-landing');
    toast('Sessão expirada','Faz login novamente','warn'); return;
  }
  if(code==='RateLimit'||msg.toLowerCase().includes('rate limit')){
    toast('Demasiados pedidos','Aguarda alguns segundos','warn'); return;
  }
  if(code==='AccountDisabled'||msg.toLowerCase().includes('disabled')||msg.toLowerCase().includes('blocked')){
    toast('Conta bloqueada','Contacta o suporte Deriv','error');
    clearSession(); hideLoading(); showScreen('s-landing'); return;
  }
  if(msg) toast('Erro',msg,'error');
}

/* ── BALANCE ── */
function onBalance(d) {
  if(!d.balance) return;
  S.balance=parseFloat(d.balance.balance)||0;
  S.currency=d.balance.currency||S.currency;
  renderBalance();
}

/* ── TICKS ── */
function subscribeAllTicks() {
  ASSETS.forEach(function(a){ wsSend({ticks:a.sym,subscribe:1}); });
}

/* ── LOGIN / LOGOUT ── */
window.loginWithDeriv=function(){
  var r=encodeURIComponent(location.origin+location.pathname);
  var partnerRef=(function(){ try{ return localStorage.getItem('dw_pending_ref')||new URLSearchParams(location.search).get('ref')||''; }catch(e){ return ''; }})();
  var url='https://oauth.deriv.com/oauth2/authorize'
    +'?app_id='+APP_ID
    +'&affiliate_token=B479A9FF-7DC5-4C81-9632-335E7571345B'
    +'&utm_campaign=dynamicworks&utm_medium=affiliate&utm_source=CU301183'
    +(partnerRef?'&utm_content='+encodeURIComponent(partnerRef):'')
    +'&redirect_uri='+r+'&l=PT';
  location.href=url;
};

window.doLogout=function(){
  if(S.ws) S.ws.close();
  _fbCancelListeners(); clearSession();
  S.contracts=[]; S.history=[]; S.prices={}; _fbHistoryMap={};
  showScreen('s-landing');
  if(window.lucide) lucide.createIcons();
};

/* ── DEPOSIT / WITHDRAW ── */
window.openDepositModal  =function(){ window.open('https://app.deriv.com/cashier/deposit','_blank'); };
window.openWithdrawModal =function(){ window.open('https://app.deriv.com/cashier/withdrawal','_blank'); };