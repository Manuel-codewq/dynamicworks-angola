/* ═══════════════════════════════════════════════════════════
   DynamicWorks Angola — app.js v4.0 CLEAN
   Accumulators Deriv | App ID: 127916
   100% Acumuladores.
   ═══════════════════════════════════════════════════════════ */
'use strict';

var APP_ID    = 127916;
var WS_URL    = 'wss://ws.binaryws.com/websockets/v3?app_id=' + APP_ID + '&l=PT';
var TAXA_AOA  = 950;
var MARKUP    = 2; /* Markup configurado no dashboard api.deriv.com — não se passa na API */

var ASSETS = [
  { sym:'R_10',    name:'Volatility 10',     short:'V10',    pip:4 },
  { sym:'R_25',    name:'Volatility 25',     short:'V25',    pip:4 },
  { sym:'R_50',    name:'Volatility 50',     short:'V50',    pip:4 },
  { sym:'R_75',    name:'Volatility 75',     short:'V75',    pip:4 },
  { sym:'R_100',   name:'Volatility 100',    short:'V100',   pip:4 },
  { sym:'1HZ10V',  name:'Volatility 10(1s)', short:'V10s',   pip:4 },
  { sym:'1HZ25V',  name:'Volatility 25(1s)', short:'V25s',   pip:4 },
  { sym:'1HZ50V',  name:'Volatility 50(1s)', short:'V50s',   pip:4 },
  { sym:'1HZ75V',  name:'Volatility 75(1s)', short:'V75s',   pip:4 },
  { sym:'1HZ100V', name:'Volatility 100(1s)',short:'V100s',  pip:4 },
];

/* Barreira aproximada por taxa de crescimento */
var BARRIERS = { 1:0.0041, 2:0.0029, 3:0.0021, 4:0.0017, 5:0.0013 };

/* STATE */
var S = {
  ws: null, token: null, acct: null,
  loggedIn: false, isDemo: false,
  balance: 0, currency: 'USD',
  asset: null,
  prices: {}, priceHistory: {}, contracts: [], history: [], tpMap: {},
  pingTimer: null, reconnTimer: null, reconnN: 0,
};

/* TRADE FORM STATE */
var T = { rate:1, stake:0, tpEnabled:false, tpValue:0, proposal:null, _pt:null };

/* DOM HELPERS */
function $(id)       { return document.getElementById(id); }
function txt(id,v)   { var e=$(id); if(e) e.textContent=v; }
function html(id,v)  { var e=$(id); if(e) e.innerHTML=v; }
function show(id)    { var e=$(id); if(e) e.style.display=''; }
function hide(id)    { var e=$(id); if(e) e.style.display='none'; }

/* Sanitizar strings de utilizador antes de injectar em HTML */
function esc(str) {
  if (!str && str !== 0) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
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

/* WEBSOCKET */
function wsConnect() {
  if(S.ws && S.ws.readyState<2) return;
  setLoading('A ligar ao servidor...');
  try {
    S.ws = new WebSocket(WS_URL);
    S.ws.onopen    = wsOpen;
    S.ws.onmessage = wsMsg;
    S.ws.onclose   = wsClose;
    S.ws.onerror   = function(){};
  } catch(e) { wsReconnect(); }
}

function wsSend(obj) {
  if(S.ws && S.ws.readyState===1) S.ws.send(JSON.stringify(obj));
}

function wsOpen() {
  S.reconnN=0; clearTimeout(S.reconnTimer);
  clearInterval(S.pingTimer);
  S.pingTimer=setInterval(function(){ wsSend({ping:1}); },25000);
  if(S.token) { setLoading('A autenticar...'); wsSend({authorize:S.token}); }
  else        { hideLoading(); showScreen('s-landing'); }
}

function wsClose() {
  clearInterval(S.pingTimer);
  /* Se havia um buy pendente e a ligacao caiu, liberar o guard */
  _tradePending=false;
  wsReconnect();
}

function wsReconnect() {
  S.reconnN++;
  clearTimeout(S.reconnTimer);
  var delay = Math.min(3000 * S.reconnN, 20000);
  S.reconnTimer = setTimeout(wsConnect, delay);
  if (S.loggedIn) {
    if (S.reconnN === 1) {
      toast('Ligação perdida', 'A reconectar...', 'warn');
    } else if (S.reconnN === 3) {
      toast('Sem ligação', 'Verifica a tua internet', 'error');
    } else if (S.reconnN >= 6) {
      toast('Servidor indisponível', 'A tentar de ' + Math.round(delay/1000) + 's em ' + Math.round(delay/1000) + 's', 'error');
    }
  }
}

/* MESSAGE ROUTER */
function wsMsg(evt) {
  var d; try{ d=JSON.parse(evt.data); }catch(e){ return; }
  if(!d) return;
  switch(d.msg_type){
    case 'authorize':              onAuth(d);       break;
    case 'balance':                onBalance(d);    break;
    case 'tick':                   onTick(d);       break;
    case 'proposal':               onProposal(d);   break;
    case 'buy':                    onBuy(d);        break;
    case 'sell':                   onSell(d);       break;
    case 'portfolio':              onPortfolio(d);  break;
    case 'proposal_open_contract': onContract(d);   break;
    case 'profit_table':           onProfitTable(d);break;
    case 'error':                  onWsErr(d);      break;
  }
}

/* AUTH */
function onAuth(d) {
  if (d.error) {
    var msg = d.error.message || '';
    var code = d.error.code || '';
    var userMsg = 'Sessão inválida';
    var detail = 'Faz login novamente';
    if (code === 'InvalidToken' || msg.toLowerCase().includes('token')) {
      userMsg = 'Sessão expirada';
      detail = 'O teu token expirou — faz login novamente';
    } else if (msg.toLowerCase().includes('account')) {
      userMsg = 'Conta não encontrada';
      detail = 'Verifica se a conta Deriv está activa';
    } else if (msg.toLowerCase().includes('permission') || msg.toLowerCase().includes('scope')) {
      userMsg = 'Permissão insuficiente';
      detail = 'Autoriza o acesso à conta no Deriv';
    }
    toast(userMsg, detail, 'error');
    clearSession();
    hideLoading();
    showScreen('s-landing');
    return;
  }
  var a=d.authorize;
  var isReconnect = S.loggedIn;
  S.loggedIn=true; S.balance=parseFloat(a.balance)||0;
  S.currency=a.currency||'USD'; S.isDemo=(a.is_virtual===1); S.acct=a.loginid;

  if(isReconnect){
    /* RECONEXAO: re-subscrever apenas o essencial — SEM loadProfitTable, SEM loadFirebaseData */
    _tradePending=false;
    /* Guardar contratos abertos actuais antes de limpar */
    var openIds = S.contracts.map(function(x){ return x.contract_id; });
    S.contracts=[];
    /* Limpar apenas os guards que já expiraram — manter os recentes */
    /* Nao limpar _soldContracts para nao re-processar contratos ja fechados */
    subscribeAllTicks();
    wsSend({balance:1,subscribe:1});
    loadPortfolio(); /* só recarrega contratos ABERTOS, nao afecta historico */
    renderBalance(); renderContracts(); renderLiveOps();
    /* Nao chamar loadProfitTable — causava re-processamento de perdas */
  } else {
    setLoading('A carregar...');
    afterLogin();
  }
}

function afterLogin() {
  S.asset = S.asset || ASSETS[0];
  renderNav(); renderBalance(); renderAssetList();
  subscribeAllTicks(); buildTickerStrip();
  loadFirebaseData(); renderLessons('all');

  /* 1. Carregar histórico do Firebase imediatamente */
  var fbReady=function(){
    fbLoadHistory();
    /* 2. Só depois pedir à Deriv — assim ela mescla em vez de substituir */
    loadPortfolio();
    loadProfitTable();
    wsSend({balance:1,subscribe:1});
  };
  if(window._appReady) fbReady();
  else window.addEventListener('app-ready', fbReady, {once:true});

  setTimeout(function(){
    hideLoading(); showScreen('s-dash');
    chartInit();
    if(window.lucide) lucide.createIcons();
    setTimeout(chartResize, 100);
    setTimeout(chartResize, 400);
    /* Iniciar tour para novos utilizadores */
    setTimeout(function(){
      if(!localStorage.getItem('dw_tour_done')) tourStart();
    }, 1200);

    /* Registar push notifications se já tinha permissão (renovar token) */
    setTimeout(function(){
      /* Notificações nativas já activadas — nada a fazer */
    }, 3000);
  },300);
}

/* SESSION */
function loadSession() {
  var tk=localStorage.getItem('dw_token')||sessionStorage.getItem('dw_oauth_token');
  var ac=localStorage.getItem('dw_acct')||sessionStorage.getItem('dw_oauth_acct');
  /* Verificar expiração — token expira após 24h */
  var ts=parseInt(localStorage.getItem('dw_token_ts')||0);
  var AGE_LIMIT=24*60*60*1000; /* 24 horas */
  if(ts && (Date.now()-ts)>AGE_LIMIT){
    clearSession();
    return false;
  }
  if(tk&&ac){ S.token=tk; S.acct=ac; return true; }
  return false;
}
function clearSession() {
  S.token=null; S.acct=null; S.loggedIn=false;
  ['dw_token','dw_acct','dw_accounts'].forEach(function(k){ localStorage.removeItem(k); });
  sessionStorage.clear();
}

window.loginWithDeriv=function(){
  var r=encodeURIComponent(location.origin+location.pathname);
  /* Verificar se existe um ?ref= de parceiro activo para passar como utm_content */
  var partnerRef=(function(){ try{ return localStorage.getItem('dw_pending_ref')||new URLSearchParams(location.search).get('ref')||''; }catch(e){ return ''; } })();
  var url='https://oauth.deriv.com/oauth2/authorize'
    +'?app_id='+APP_ID
    +'&affiliate_token=B479A9FF-7DC5-4C81-9632-335E7571345B'
    +'&utm_campaign=dynamicworks'
    +'&utm_medium=affiliate'
    +'&utm_source=CU301183'
    +(partnerRef ? '&utm_content='+encodeURIComponent(partnerRef) : '')
    +'&redirect_uri='+r
    +'&l=PT';
  location.href=url;
};
window.openRegister=function(){
  var m=document.getElementById('registerModal');
  if(m) m.classList.add('open');
  regShowStep(1);
  if(window.lucide) lucide.createIcons();
};

/* ══════════════════════════════════════════
   MODAL DE REGISTO — DynamicWorks Angola
══════════════════════════════════════════ */
var _regWs=null;
var _regEmail='';
var _regPassword='';

function regShowStep(n){
  [1,2,3,4].forEach(function(i){
    var el=document.getElementById('regStep'+i);
    if(el) el.style.display=(i===n)?'block':'none';
  });
  if(window.lucide) lucide.createIcons();
}

window.closeRegisterModal=function(){
  var m=document.getElementById('registerModal');
  if(m) m.classList.remove('open');
  if(_regWs){ try{_regWs.close();}catch(e){} _regWs=null; }
};

/* ── Verificar força da password ── */
window.checkRegPassword=function(val){
  var s=document.getElementById('regPwdStrength');
  var lbl=document.getElementById('regPwdLabel');
  if(!s||!val){if(s)s.style.display='none';return;}
  s.style.display='block';
  var has={
    len:val.length>=8,
    upper:/[A-Z]/.test(val),
    lower:/[a-z]/.test(val),
    num:/[0-9]/.test(val),
    sym:/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val)
  };
  var score=Object.values(has).filter(Boolean).length;
  var bars=['pwdBar1','pwdBar2','pwdBar3','pwdBar4'];
  var colors=['#ff3d5a','#ff6b35','#ffc107','#00e676'];
  var labels=['Muito fraca','Fraca','Boa','Forte'];
  bars.forEach(function(id,i){
    var el=document.getElementById(id);
    if(el) el.style.background=i<(score-1)?colors[Math.min(score-2,3)]:('rgba(255,255,255,.08)');
  });
  if(lbl){
    lbl.textContent=labels[Math.min(score-1,3)]||'';
    lbl.style.color=colors[Math.min(score-2,3)]||'var(--text3)';
  }
};

/* ── Toggle ver/esconder password ── */
window.toggleRegPwd=function(){
  var inp=document.getElementById('regPassword');
  var ico=document.getElementById('regPwdEye');
  if(!inp) return;
  var show=inp.type==='password';
  inp.type=show?'text':'password';
  if(ico){ ico.setAttribute('data-lucide',show?'eye-off':'eye'); if(window.lucide) lucide.createIcons(); }
};

/* ── Validar password ── */
function validatePassword(pwd){
  if(pwd.length<8) return 'A password deve ter pelo menos 8 caracteres';
  if(!/[A-Z]/.test(pwd)) return 'A password deve ter pelo menos uma letra maiúscula';
  if(!/[a-z]/.test(pwd)) return 'A password deve ter pelo menos uma letra minúscula';
  if(!/[0-9]/.test(pwd)) return 'A password deve ter pelo menos um número';
  if(!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) return 'A password deve ter pelo menos um símbolo (!@#$...)';
  return null;
}

/* ── Mostrar erro no step ── */
function regShowError(step, msg){
  var el=document.getElementById('regStep'+step+'Error');
  if(!el) return;
  el.textContent=msg;
  el.style.display='block';
}
function regHideError(step){
  var el=document.getElementById('regStep'+step+'Error');
  if(el) el.style.display='none';
}

/* ── Botão loading ── */
function regSetBtnLoading(id, loading, text){
  var btn=document.getElementById(id);
  if(!btn) return;
  btn.disabled=loading;
  if(loading){
    btn.dataset.orig=btn.innerHTML;
    btn.innerHTML='<svg style="animation:spin .8s linear infinite;width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> '+text;
  } else {
    btn.innerHTML=btn.dataset.orig||btn.innerHTML;
  }
}

/* ── Mapear erros da API Deriv ── */
function regMapError(code, msg){
  var map={
    'InvalidEmailAddress':'Endereço de email inválido. Verifica e tenta novamente.',
    'EmailNotFound':'Email não encontrado. Verifica o endereço.',
    'DuplicateEmail':'Este email já está registado. Usa outro email ou faz login.',
    'DuplicateAccount':'Já existe uma conta com este email. Faz login.',
    'AlreadyExistsAccount':'Já existe uma conta com este email. Faz login.',
    'InvalidPassword':'Password inválida. Verifica os requisitos.',
    'PasswordTooShort':'A password é demasiado curta. Mínimo 8 caracteres.',
    'InvalidVerificationToken':'Token inválido ou expirado. Clica no link do email novamente.',
    'TokenExpired':'O link de verificação expirou. Volta atrás e pede um novo.',
    'WrongResponse':'Token incorrecto. Copia o token directamente do link do email.',
    'ResidenceNotFound':'País de residência não disponível.',
    'InputValidationFailed':'Dados inválidos. Verifica os campos preenchidos.',
  };
  /* Deriv às vezes usa InvalidRequest com mensagem a dizer duplicado */
  if(!map[code] && msg){
    var msgLow=(msg||'').toLowerCase();
    if(msgLow.includes('already')||msgLow.includes('duplicate')||msgLow.includes('exist')){
      return '__DUPLICATE__';
    }
  }
  return map[code]||(msg||'Ocorreu um erro. Tenta novamente.');
}

/* ── PASSO 1: Enviar link de verificação ── */
window.regSendCode=function(){
  regHideError(1);
  var email=(document.getElementById('regEmail')||{}).value||'';
  var pwd=(document.getElementById('regPassword')||{}).value||'';

  email=email.trim().toLowerCase();
  if(!email||!email.includes('@')){
    regShowError(1,'Introduz um email válido.');
    return;
  }
  var pwdErr=validatePassword(pwd);
  if(pwdErr){ regShowError(1,pwdErr); return; }

  _regEmail=email;
  _regPassword=pwd;

  regSetBtnLoading('regStep1Btn',true,'A enviar link...');

  /* Abrir WebSocket Deriv */
  if(_regWs){ try{_regWs.close();}catch(e){} }
  _regWs=new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=127916');

  _regWs.onopen=function(){
    _regWs.send(JSON.stringify({
      verify_email: _regEmail,
      type: 'account_opening'
    }));
  };

  _regWs.onmessage=function(e){
    var d=JSON.parse(e.data);
    regSetBtnLoading('regStep1Btn',false,'');
    if(d.error){
      var errCode=d.error.code||'';
      var mapped=regMapError(errCode, d.error.message);
      /* Email duplicado — directo para step 4 */
      if(errCode==='DuplicateEmail'||errCode==='DuplicateAccount'||errCode==='AlreadyExistsAccount'||mapped==='__DUPLICATE__'){
        var dupEl=document.getElementById('regDupEmail');
        if(dupEl) dupEl.textContent=_regEmail;
        regShowStep(4);
      } else {
        regShowError(1, mapped==='__DUPLICATE__'?'Este email já está registado. Faz login.':mapped);
      }
      return;
    }
    if(d.msg_type==='verify_email' && d.verify_email===1){
      /* Sucesso — ir para step 2 com instruções claras sobre o LINK */
      var sub=document.getElementById('regStep2Sub');
      if(sub) sub.textContent='Enviámos um email para '+_regEmail+'.';
      regShowStep(2);
      if(window.lucide) lucide.createIcons();
    }
  };

  _regWs.onerror=function(){
    regSetBtnLoading('regStep1Btn',false,'');
    regShowError(1,'Erro de ligação. Verifica a internet e tenta novamente.');
  };
};

/* ── PASSO 2: Criar conta com token do link ── */
window.regCreateAccount=function(){
  regHideError(2);
  var code=(document.getElementById('regCode')||{}).value||'';
  code=code.trim();
  if(!code||code.length<4){
    regShowError(2,'Cola aqui o token copiado do link no email. Ex: AbCdEfGh123...');
    return;
  }

  regSetBtnLoading('regStep2Btn',true,'A criar conta...');

  /* Garantir que o WS ainda está aberto */
  if(!_regWs||_regWs.readyState!==1){
    _regWs=new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id=127916');
    _regWs.onopen=function(){ sendNewAccount(); };
    _regWs.onmessage=handleNewAccount;
    _regWs.onerror=function(){
      regSetBtnLoading('regStep2Btn',false,'');
      regShowError(2,'Erro de ligação. Verifica a internet e tenta novamente.');
    };
  } else {
    _regWs.onmessage=handleNewAccount;
    sendNewAccount();
  }

  function sendNewAccount(){
    _regWs.send(JSON.stringify({
      new_account_virtual: 1,
      client_password: _regPassword,
      verification_code: code,
      residence: 'ao',
      type: 'trading'
    }));
  }

  function handleNewAccount(e){
    var d=JSON.parse(e.data);
    if(d.msg_type!=='new_account_virtual') return;
    regSetBtnLoading('regStep2Btn',false,'');
    if(d.error){
      var errCode=d.error.code||'';
      /* Token inválido — dar instruções específicas sobre onde copiar */
      if(errCode==='InvalidVerificationToken'||errCode==='TokenExpired'||errCode==='WrongResponse'){
        regShowError(2,
          '⚠️ Token inválido ou expirado.\n\n'
          +'Abre o email da Deriv → clica no link → copia o valor do parâmetro "token=" no URL e cola aqui.\n\n'
          +'Se o link já expirou, volta atrás e pede um novo.'
        );
      } else {
        regShowError(2, regMapError(errCode, d.error.message));
      }
      return;
    }
    if(d.new_account_virtual){
      /* Sucesso! */
      regShowStep(3);
      if(window.lucide) lucide.createIcons();
      if(typeof toast==='function') toast('🎉 Conta criada!','Bem-vindo à DynamicWorks Angola!','success');
      try{_regWs.close();}catch(err){} _regWs=null;
    }
  }
};

/* ── Voltar ao step 1 ── */
window.regBackToStep1=function(){
  regHideError(1);
  regHideError(2);
  regShowStep(1);
};

window.regUseDifferentEmail=function(){
  /* Limpar email e voltar ao step 1 */
  var emailEl=document.getElementById('regEmail');
  if(emailEl){ emailEl.value=''; }
  regHideError(1);
  regShowStep(1);
  if(emailEl) setTimeout(function(){ emailEl.focus(); }, 100);
};
window.openModal=function(){ var m=$('modal'); if(m) m.classList.add('open'); };
window.closeModal=function(){ var m=$('modal'); if(m) m.classList.remove('open'); };
window.doLogout=function(){ if(S.ws) S.ws.close(); _fbCancelListeners(); clearSession(); S.contracts=[]; S.history=[]; S.prices={}; _fbHistoryMap={}; showScreen('s-landing'); if(window.lucide) lucide.createIcons(); };

/* BALANCE */
function onBalance(d) {
  if(!d.balance) return;
  S.balance=parseFloat(d.balance.balance)||0; S.currency=d.balance.currency||S.currency;
  renderBalance();
}
function renderBalance() {
  var b=S.balance.toFixed(2);
  var aoa=Math.round(S.balance*TAXA_AOA).toLocaleString('pt-AO')+' AOA';
  var mode=S.isDemo?'DEMO':'REAL';
  /* Partilhar saldo com profile.html */
  try { localStorage.setItem('dw_balance', S.balance); localStorage.setItem('dw_mode', S.isDemo?'Demo':'Real'); } catch(e){}
  ['balNum','balNum2'].forEach(function(id){ txt(id,b); });
  ['balMode','balMode2'].forEach(function(id){ txt(id,mode); });
  ['balAoa','balAoa2'].forEach(function(id){ var e=$(id); if(e){e.textContent=aoa;e.style.display='';} });
  txt('profileBalance','$'+b); txt('profileMode',S.isDemo?'Demo':'Real'); txt('profileBalanceAoa',aoa);
  var al=$('acctLabel'); if(al) al.textContent=(S.isDemo?'Demo ':'Real ')+S.acct;
}
window.syncBalance=renderBalance;

/* TICKS */
function subscribeAllTicks() {
  ASSETS.forEach(function(a){ wsSend({ticks:a.sym,subscribe:1}); });
}

function onTick(d) {
  if(!d.tick) return;
  var t=d.tick, sym=t.symbol, p=parseFloat(t.quote);
  var prev=S.prices[sym]?S.prices[sym].p:p;
  var chg=prev?((p-prev)/prev)*100:0;
  S.prices[sym]={p:p,chg:chg,epoch:t.epoch};

  /* Guardar histórico de preços para análise de volatilidade */
  if(!S.priceHistory[sym]) S.priceHistory[sym]=[];
  S.priceHistory[sym].push(p);
  if(S.priceHistory[sym].length>100) S.priceHistory[sym].shift();

  /* Ticker strip */
  var pEl=$('tkp_'+sym),cEl=$('tkc_'+sym);
  if(pEl) pEl.textContent=p.toFixed(4);
  if(cEl){ cEl.textContent=(chg>=0?'+':'')+chg.toFixed(2)+'%'; cEl.className=chg>=0?'t-up':'t-dn'; }

  /* Asset list row */
  var apEl=$('ap_'+sym),acEl=$('ac_'+sym);
  if(apEl) apEl.textContent=p.toFixed(4);
  if(acEl){ acEl.textContent=(chg>=0?'+':'')+chg.toFixed(2)+'%'; acEl.className='a-chg '+(chg>=0?'up':'dn'); }

  if(sym!==S.asset.sym) return;

  /* Main display */
  var pip=S.asset.pip||4;
  txt('chPrice',p.toFixed(pip));
  txt('tradeAssetPrice',p.toFixed(pip));
  txt('spotNow',p.toFixed(pip));

  var badge=$('chBadge');
  if(badge){ badge.textContent=(chg>=0?'+':'')+chg.toFixed(3)+'%'; badge.className='cv-badge '+(chg>=0?'up':'dn'); }

  /* ── Barreiras REAIS — só da Deriv, nunca estimadas ── */
  var lo = null, hi = null;
  var activeContract = S.contracts.find(function(c){ return c.underlying === sym; });
  if (activeContract) {
    if (activeContract.barrier && activeContract.low_barrier) {
      hi = parseFloat(activeContract.barrier);
      lo = parseFloat(activeContract.low_barrier);
    } else if (activeContract.high_barrier && activeContract.low_barrier) {
      hi = parseFloat(activeContract.high_barrier);
      lo = parseFloat(activeContract.low_barrier);
    }
  }
  if (lo && hi) {
    txt('barrierLow',  lo.toFixed(pip));
    txt('barrierHigh', hi.toFixed(pip));
    updateMeter(p, lo, hi);
    /* Som de tick proporcional à distância REAL à barreira */
    var range = hi - lo;
    if (range > 0) {
      var distLoPct = ((p - lo) / range) * 100;
      var distHiPct = ((hi - p) / range) * 100;
      var nearestPct = Math.min(distLoPct, distHiPct);
      _playTick(nearestPct);
      /* Vibração háptica só em zonas realmente perigosas */
      if (nearestPct < 5)       { _vibrate('tick_danger'); }
      else if (nearestPct < 12) { _vibrate('tick_warn'); }
    }
  } else {
    txt('barrierLow',  '—');
    txt('barrierHigh', '—');
    updateMeter(p, 0, 0);
  }

  /* Push to chart */
  chartPush(p, lo, hi);

  /* Atualizar painel de análise */
  updateAccuAnalysis(p, lo, hi, sym);

  /* Alertas inteligentes */
  _checkSmartAlerts(p, lo, hi, sym);

  /* Check TPs */
  S.contracts.forEach(function(c){
    if(c.underlying!==sym) return;
    var tp=S.tpMap[c.contract_id];
    if(tp&&parseFloat(c.profit||0)>=tp){
      delete S.tpMap[c.contract_id];
      toast('Take Profit!','A fechar contrato...','success');
      wsSend({sell:c.contract_id,price:0});
    }
  });
}

/* ══════════════════════════════════════════════
   SONS DE TRADE — Web Audio API (sem ficheiros)
══════════════════════════════════════════════ */
var _audioCtx = null;

function _getAudio() {
  if (_audioCtx) return _audioCtx;
  try {
    _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch(e) {}
  return _audioCtx;
}

function _playWin() {
  var ctx = _getAudio(); if (!ctx) return;
  /* Acordes ascendentes — som de vitória */
  var notes = [523, 659, 784, 1047]; /* C5 E5 G5 C6 */
  notes.forEach(function(freq, i) {
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.value = freq;
    var t = ctx.currentTime + i * 0.08;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.start(t);
    osc.stop(t + 0.35);
  });
  /* Shimmer final */
  var osc2 = ctx.createOscillator();
  var g2   = ctx.createGain();
  osc2.connect(g2); g2.connect(ctx.destination);
  osc2.type = 'sine';
  osc2.frequency.value = 1568; /* G6 */
  var t2 = ctx.currentTime + 0.32;
  g2.gain.setValueAtTime(0, t2);
  g2.gain.linearRampToValueAtTime(0.10, t2 + 0.02);
  g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.4);
  osc2.start(t2); osc2.stop(t2 + 0.4);
}

function _playLoss() {
  var ctx = _getAudio(); if (!ctx) return;
  /* Notas descendentes — som de perda */
  var notes = [392, 330, 262]; /* G4 E4 C4 */
  notes.forEach(function(freq, i) {
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'triangle';
    osc.frequency.value = freq;
    var t = ctx.currentTime + i * 0.12;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.15, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    osc.start(t);
    osc.stop(t + 0.45);
  });
}

/* Activar contexto de audio no primeiro toque do utilizador */
document.addEventListener('touchstart', function() {
  var ctx = _getAudio();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}, { once: true, passive: true });
document.addEventListener('click', function() {
  var ctx = _getAudio();
  if (ctx && ctx.state === 'suspended') ctx.resume();
}, { once: true });

/* ── Som de tick — volume proporcional à distância REAL à barreira ── */
function _playTick(distPct) {
  /* distPct = distância à barreira mais próxima em % do intervalo (0-100) */
  /* Só toca se há contrato aberto e distância real disponível */
  if (distPct === null || distPct === undefined) return;
  var ctx = _getAudio(); if (!ctx) return;
  /* Quanto mais perto da barreira, mais alto e agudo */
  var danger = Math.max(0, Math.min(1, 1 - (distPct / 30))); /* 1 = a 0%, 0 = a 30%+ */
  if (danger < 0.05) return; /* longe da barreira — sem som */
  var freq = 400 + danger * 600; /* 400Hz longe → 1000Hz perto */
  var vol  = 0.04 + danger * 0.12;
  var osc  = ctx.createOscillator();
  var gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(vol, ctx.currentTime + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.08);
}

/* ── Som de spike — urgente, distinto do alerta de barreira ── */
function _playSpike() {
  var ctx = _getAudio(); if (!ctx) return;
  /* Dois pulsos rápidos ascendentes — soa diferente do beep normal */
  [880, 1100].forEach(function(freq, i) {
    var osc  = ctx.createOscillator();
    var gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.value = freq;
    var t = ctx.currentTime + i * 0.09;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.14, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    osc.start(t); osc.stop(t + 0.12);
  });
}

/* ── Vibração háptica diferenciada por evento ── */
function _vibrate(type) {
  if (!navigator.vibrate) return;
  var patterns = {
    tick_warn:   [80],
    tick_danger: [150, 50, 150],
    spike:       [300, 80, 300, 80, 300],
    barrier_warn:[100, 60, 100],
    barrier_ko:  [400, 100, 400],
    win:         [80, 40, 120],
    loss:        [500]
  };
  var p = patterns[type];
  if (p) navigator.vibrate(p);
}

/* ═══════════════════════════════════════════════════════════
   DYNAMICWORKS — ACCUMULATOR CHART v6.0
   • Ticks guardados no Firebase Realtime DB (partilhados)
   • localStorage como fallback offline
   • Barreiras KO fixas no eixo Y
═══════════════════════════════════════════════════════════ */

var FB_DB  = 'https://dynamicworks-angola-default-rtdb.firebaseio.com';
var _TMAX  = 300;   /* máximo de ticks guardados por ativo */

/* ── Guardar tick no Firebase Realtime DB ──
   Usa uma fila local para não fazer um pedido por tick.
   Envia em lote de 3 em 3 segundos.                    */
var _fbQueue   = {};   /* {sym: [{v,t}, ...]} — ticks pendentes */
var _fbSending = false;

function _fbSaveTick(sym, price, epochSec) {
  if (!_fbQueue[sym]) _fbQueue[sym] = [];
  _fbQueue[sym].push({ v: price, t: epochSec });
}

/* Flush — envia os ticks acumulados para o Firebase */
function _fbFlush() {
  var syms = Object.keys(_fbQueue);
  if (syms.length === 0) return;

  syms.forEach(function(sym) {
    var newTicks = _fbQueue[sym];
    _fbQueue[sym] = [];
    if (!newTicks.length) return;

    /* Ler o array actual, juntar os novos, truncar a 300, gravar */
    var url = FB_DB + '/ticks/' + sym + '.json';
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.timeout = 4000;
    xhr.onload = function() {
      var existing = [];
      try {
        var parsed = JSON.parse(xhr.responseText);
        if (Array.isArray(parsed)) existing = parsed;
      } catch(e) {}

      var merged = existing.concat(newTicks);
      if (merged.length > _TMAX) merged = merged.slice(-_TMAX);

      var put = new XMLHttpRequest();
      put.open('PUT', url, true);
      put.setRequestHeader('Content-Type', 'application/json');
      put.send(JSON.stringify(merged));
    };
    xhr.onerror   = function() {};
    xhr.ontimeout = function() {};
    xhr.send();
  });
}

/* Enviar a cada 3 segundos */
setInterval(_fbFlush, 3000);

/* ── Carregar histórico do Firebase ── */
function _fbLoadTicks(sym, callback) {
  var url = FB_DB + '/ticks/' + sym + '.json';
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url, true);
  xhr.timeout = 5000;
  xhr.onload = function() {
    try {
      var arr = JSON.parse(xhr.responseText);
      if (Array.isArray(arr) && arr.length >= 2) {
        callback(arr); return;
      }
    } catch(e) {}
    callback([]);
  };
  xhr.onerror   = function() { callback([]); };
  xhr.ontimeout = function() { callback([]); };
  xhr.send();
}

/* ── localStorage fallback ── */
function _lsTickSave(sym, price, t) {
  try {
    var key = 'dw_ticks_' + sym;
    var arr = _lsTickLoad(sym);
    arr.push({ v: price, t: t });
    if (arr.length > _TMAX) arr = arr.slice(-_TMAX);
    localStorage.setItem(key, JSON.stringify(arr));
  } catch(e) {}
}
function _lsTickLoad(sym) {
  try {
    var raw = localStorage.getItem('dw_ticks_' + sym);
    if (!raw) return [];
    var arr = JSON.parse(raw);
    var cut = Math.floor(Date.now() / 1000) - 4 * 60 * 60;
    return arr.filter(function(p) { return p.t > cut; });
  } catch(e) { return []; }
}

/* ── Carregar histórico: Firebase → localStorage fallback ── */
function _loadTickHistory(sym, callback) {
  _fbLoadTicks(sym, function(arr) {
    if (arr.length >= 2) { callback(arr); return; }
    callback(_lsTickLoad(sym));
  });
}

var _chart = {
  instance:   null,
  areaSeries: null,
  prices:     [],
  maxPts:     150,
  lastTs:     0,
  tickCount:  0,
  lastLo:     null,
  lastHi:     null,
  plHi:       null,
  plLo:       null,
  plSpot:     null,
};

function chartInit() {
  var container = document.getElementById('lwChart');
  if (!container) return;
  if (!window.LightweightCharts) { setTimeout(chartInit, 500); return; }

  if (_chart.instance) {
    try { _chart.instance.remove(); } catch(e) {}
    _chart.instance = null;
    _chart.areaSeries = null;
    _chart.plHi = _chart.plLo = _chart.plSpot = null;
  }

  _chart.instance = LightweightCharts.createChart(container, {
    width:  container.offsetWidth  || 360,
    height: container.offsetHeight || 260,
    layout: {
      background: { type: 'solid', color: '#070c18' },
      textColor:  'rgba(140,170,200,0.65)',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize:   10,
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.03)' },
      horzLines: { color: 'rgba(255,255,255,0.03)' },
    },
    crosshair: {
      mode: LightweightCharts.CrosshairMode.Normal,
      vertLine: { color: 'rgba(0,212,255,0.25)', width: 1, style: 2, labelBackgroundColor: '#0f1e36' },
      horzLine: { color: 'rgba(0,212,255,0.25)', width: 1, style: 2, labelBackgroundColor: '#0f1e36' },
    },
    rightPriceScale: {
      borderColor:  'rgba(255,255,255,0.05)',
      textColor:    'rgba(140,170,200,0.6)',
      scaleMargins: { top: 0.15, bottom: 0.15 },
    },
    timeScale: {
      borderColor:    'rgba(255,255,255,0.05)',
      timeVisible:    true,
      secondsVisible: true,
      rightOffset:    10,
      fixLeftEdge:    false,
      lockVisibleTimeRangeOnResize: true,
    },
    handleScroll: { mouseWheel:false, pressedMouseMove:false, horzTouchDrag:false, vertTouchDrag:false },
    handleScale:  { axisPressedMouseMove:false, mouseWheel:false, pinch:false },
  });

  _chart.areaSeries = _chart.instance.addAreaSeries({
    lineColor:   '#41a8f5',
    lineWidth:   2,
    topColor:    'rgba(41,130,255,0.35)',
    bottomColor: 'rgba(41,130,255,0.00)',
    priceLineVisible:  false,
    lastValueVisible:  false,
    crosshairMarkerVisible:         true,
    crosshairMarkerRadius:          4,
    crosshairMarkerBorderColor:     '#ffffff',
    crosshairMarkerBackgroundColor: '#2962ff',
    crosshairMarkerBorderWidth:     2,
  });

  /* Carregar histórico ao iniciar */
  var sym = S.asset ? S.asset.sym : null;
  if (sym) {
    _loadTickHistory(sym, function(arr) { _chartInjectHistory(arr); });
  }

  if (window.ResizeObserver) {
    new ResizeObserver(function() { chartResize(); }).observe(container);
  } else {
    window.addEventListener('resize', chartResize);
  }
  setTimeout(chartResize, 80);
  setTimeout(chartResize, 350);
}

/* Injectar histórico no gráfico */
function _chartInjectHistory(arr) {
  if (!_chart.areaSeries || arr.length < 2) return;
  var lastT = 0;
  var data  = arr.map(function(p) {
    var t = p.t; if (t <= lastT) t = lastT + 1; lastT = t;
    return { time: t, value: p.v };
  });
  _chart.areaSeries.setData(data);
  _chart.prices   = data;
  _chart.lastTs   = lastT;
  _chart.tickCount= data.length;
  _chart.instance.timeScale().scrollToRealTime();
}

function chartResize() {
  if (!_chart.instance) return;
  var c = document.getElementById('lwChart');
  if (!c || !c.offsetWidth) return;
  _chart.instance.resize(c.offsetWidth, c.offsetHeight);
}

function chartPush(price, lo, hi) {
  if (!_chart.areaSeries) return;

  var nowSec = Math.floor(Date.now() / 1000);
  if (nowSec <= _chart.lastTs) nowSec = _chart.lastTs + 1;
  _chart.lastTs = nowSec;
  _chart.tickCount++;

  var pt = { time: nowSec, value: price };
  _chart.prices.push(pt);
  if (_chart.prices.length > _chart.maxPts) _chart.prices.shift();

  /* Guardar no Firebase e localStorage */
  var sym = S.asset ? S.asset.sym : null;
  if (sym) {
    _fbSaveTick(sym, price, nowSec);
    _lsTickSave(sym, price, nowSec);
  }

  if (_chart.tickCount <= 4) {
    _chart.areaSeries.setData(_chart.prices);
  } else {
    _chart.areaSeries.update(pt);
  }

  if (lo && hi && (_chart.lastLo !== lo || _chart.lastHi !== hi)) {
    _chart.lastLo = lo;
    _chart.lastHi = hi;
    _chartUpdateBarriers(lo, hi);
  }

  _chartUpdateSpotLine(price);
  _chart.instance.timeScale().scrollToRealTime();
}

function _chartUpdateBarriers(lo, hi) {
  if (!_chart.areaSeries) return;
  if (_chart.plHi) { try { _chart.areaSeries.removePriceLine(_chart.plHi); } catch(e){} _chart.plHi = null; }
  if (_chart.plLo) { try { _chart.areaSeries.removePriceLine(_chart.plLo); } catch(e){} _chart.plLo = null; }
  _chart.plHi = _chart.areaSeries.createPriceLine({
    price: hi, color: '#ff3d5a', lineWidth: 1,
    lineStyle: LightweightCharts.LineStyle.Dashed,
    axisLabelVisible: true, title: 'KO ▲',
  });
  _chart.plLo = _chart.areaSeries.createPriceLine({
    price: lo, color: '#ff3d5a', lineWidth: 1,
    lineStyle: LightweightCharts.LineStyle.Dashed,
    axisLabelVisible: true, title: 'KO ▼',
  });
}

function _chartUpdateSpotLine(price) {
  if (!_chart.areaSeries) return;
  if (_chart.plSpot) { try { _chart.areaSeries.removePriceLine(_chart.plSpot); } catch(e){} _chart.plSpot = null; }
  _chart.plSpot = _chart.areaSeries.createPriceLine({
    price: price, color: '#41a8f5', lineWidth: 1,
    lineStyle: LightweightCharts.LineStyle.Solid,
    axisLabelVisible: true, title: '',
  });
}

function chartDraw() {}
function updateMeter(spot,lo,hi) {
  var bar=$('accuMeterBar'); if(!bar) return;
  var range=hi-lo; if(range<=0) return;
  var pct=Math.max(0,Math.min(100,((spot-lo)/range)*100));
  bar.style.width=pct+'%';
  bar.style.background=(pct<15||pct>85)?'var(--red)':'var(--green)';
}

/* ═══════════════════════════════════════
   ACCUMULATOR ANALYSIS PANEL
   Mostra volatilidade real, posição nas
   barreiras e recomendações práticas.
═══════════════════════════════════════ */
function updateAccuAnalysis(spot, lo, hi, sym) {
  var cursor  = $('aapMeterCursor');
  var spotLbl = $('aapSpotLabel');
  var meterSub= $('aapMeterSub');
  var volPct  = $('aapVolPct');
  var recEl   = $('aapRec');
  var recTxt  = $('aapRecText');

  if(!cursor) return;

  var range = hi - lo;
  if(range <= 0) return;

  /* Posição do spot dentro do intervalo (0-100%) */
  var posPct = Math.max(2, Math.min(98, ((spot - lo) / range) * 100));
  cursor.style.left = posPct.toFixed(1) + '%';

  /* Distância percentual à barreira mais próxima */
  var distLo = ((spot - lo) / spot) * 100;
  var distHi = ((hi - spot) / spot) * 100;
  var distMin = Math.min(distLo, distHi);
  var pip = S.asset ? S.asset.pip || 4 : 4;

  if(spotLbl) spotLbl.textContent = spot.toFixed(pip);

  if(meterSub) {
    var side = distLo < distHi ? '↓ barreira baixa' : '↑ barreira alta';
    meterSub.textContent = 'Distância à ' + side + ': ' + distMin.toFixed(3) + '%';
  }

  /* Volatilidade — desvio padrão dos últimos 20 ticks */
  var hist = S.priceHistory[sym] || [];
  var recent = hist.slice(-20);
  var vol = 0, volLabel = '—', riskLevel = 'normal';

  if(recent.length >= 5) {
    var mean = recent.reduce(function(s,v){ return s+v; },0) / recent.length;
    var variance = recent.reduce(function(s,v){ return s+Math.pow(v-mean,2); },0) / recent.length;
    var stddev = Math.sqrt(variance);
    vol = (stddev / mean) * 100;
    volLabel = vol.toFixed(4) + '%';

    if(vol < 0.005)      riskLevel = 'low';
    else if(vol < 0.015) riskLevel = 'normal';
    else if(vol < 0.03)  riskLevel = 'high';
    else                 riskLevel = 'very_high';
  }

  if(volPct) {
    volPct.textContent = recent.length >= 5 ? volLabel : '...';
    volPct.style.color = {low:'var(--green)',normal:'var(--text)',high:'var(--yellow)',very_high:'var(--red)'}[riskLevel]||'var(--text)';
  }

  var distLoEl = $('aapDistLo');
  var distHiEl = $('aapDistHi');

  /* Distâncias REAIS às barreiras — só mostrar se há contrato aberto com barreiras reais */
  if (lo && hi && distLoEl && distHiEl) {
    var distLoVal = spot - lo;
    var distHiVal = hi - spot;
    var pip2 = S.asset ? S.asset.pip || 4 : 4;
    distLoEl.textContent = '$' + distLoVal.toFixed(pip2);
    distLoEl.style.color = distLoVal < (hi - lo) * 0.15 ? 'var(--red)' : distLoVal < (hi - lo) * 0.3 ? 'var(--yellow)' : 'var(--green)';
    distHiEl.textContent = '$' + distHiVal.toFixed(pip2);
    distHiEl.style.color = distHiVal < (hi - lo) * 0.15 ? 'var(--red)' : distHiVal < (hi - lo) * 0.3 ? 'var(--yellow)' : 'var(--green)';
  } else if (distLoEl && distHiEl) {
    distLoEl.textContent = '—'; distLoEl.style.color = '';
    distHiEl.textContent = '—'; distHiEl.style.color = '';
  }

  /* Remover referências a estimativas — aapVolRisk e aapTicksToKO já não existem no HTML */

  /* Recomendação baseada em volatilidade + taxa escolhida */
  if(recEl && recTxt) {
    var rate = T.rate || 1;
    var rec, cls;

    /* Limiares dinâmicos: alerta quando o preço está a menos de 1.8x a largura
       da barreira para a taxa activa — quanto mais apertada a barreira, mais cedo alerta */
    var barrierWidth = (BARRIERS[rate] || 0.003) * 100; /* em % */
    var warnThreshold   = barrierWidth * 1.8;  /* ex: taxa 5% → 0.13% * 1.8 = ~0.23% */
    var dangerThreshold = barrierWidth * 0.8;  /* ex: taxa 5% → 0.13% * 0.8 = ~0.10% */

    /* Detectar spike: se o maior movimento individual nos últimos 5 ticks
       é > 40% da distância à barreira, avisar mesmo que vol média seja baixa */
    var hist2 = S.priceHistory[sym] || [];
    var last5 = hist2.slice(-5);
    var maxTickMove = 0;
    for(var i=1; i<last5.length; i++){
      var mv = Math.abs(last5[i]-last5[i-1]);
      if(mv > maxTickMove) maxTickMove = mv;
    }
    var distAbsPips = Math.min(spot - lo, hi - spot);
    var spikeRisk = (distAbsPips > 0 && maxTickMove > 0) && (maxTickMove / distAbsPips) > 0.4;

    if(riskLevel === 'very_high') {
      rec = 'Volatilidade muito alta agora. O preço está a mover-se muito — risco de knock-out elevado. Considera esperar ou usar taxa 1%.';
      cls = 'danger';
    } else if(spikeRisk && lo && hi) {
      rec = 'Spike detectado! Um tick recente moveu >' + Math.round((maxTickMove/distAbsPips)*100) + '% da distância à barreira. Risco real de KO num único tick.';
      cls = 'danger';
    } else if(riskLevel === 'high' && rate >= 3) {
      rec = 'Volatilidade elevada com taxa ' + rate + '%. As barreiras são apertadas — combina mal com este movimento. Recomenda-se taxa 1% ou 2%.';
      cls = 'warn';
    } else if(distMin < warnThreshold && rate >= 3) {
      rec = 'O preço está perto da barreira ' + (distLo < distHi ? 'baixa' : 'alta') + ' (' + distMin.toFixed(3) + '%). Com taxa ' + rate + '%, o risco é alto. Aguarda o preço centrar-se.';
      cls = 'warn';
    } else if(distMin < dangerThreshold) {
      rec = 'Atenção: preço muito próximo da barreira ' + (distLo < distHi ? 'inferior' : 'superior') + ' (' + distMin.toFixed(3) + '%). Risco de knock-out imediato.';
      cls = 'danger';
    } else if(riskLevel === 'low' && posPct > 25 && posPct < 75) {
      rec = 'Condições favoráveis — preço centrado e volatilidade baixa. Boa altura para entrar com a taxa escolhida.';
      cls = 'safe';
    } else {
      rec = 'Preço dentro da zona segura. Volatilidade ' + (riskLevel === 'normal' ? 'normal' : 'moderada') + '. Podes entrar com cautela.';
      cls = 'safe';
    }

    recEl.className = 'aap-rec ' + cls;
    recEl.querySelector('.aap-rec-ico').textContent = {safe:'✅', warn:'⚠️', danger:'🚨'}[cls] || '💡';
    recTxt.textContent = rec;
  }
}

/* TICKER STRIP */
function buildTickerStrip() {
  var el=$('tickerEl'); if(!el) return;
  var h='';
  ASSETS.forEach(function(a){
    h+='<span class="t-item"><span class="t-sym">'+a.short+'</span><span class="t-price" id="tkp_'+a.sym+'">...</span><span class="t-up" id="tkc_'+a.sym+'">...</span></span>';
  });
  el.innerHTML=h+h;
}

/* ASSET LIST */
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
      +'<div class="a-price-col"><span class="a-price" id="ap_'+a.sym+'">'+pStr+'</span><span class="a-chg '+cCls+'" id="ac_'+a.sym+'">'+cStr+'</span></div>'
      +'</div>';
  });
  el.innerHTML=h;
}

window.selectAsset=function(sym){
  var a=ASSETS.find(function(x){ return x.sym===sym; }); if(!a) return;
  S.asset=a; renderAssetList();
  txt('chAsset',a.name); txt('tradeAssetName',a.name);
  var pr=S.prices[sym];
  if(pr){
    txt('chPrice',pr.p.toFixed(a.pip)); txt('tradeAssetPrice',pr.p.toFixed(a.pip)); txt('spotNow',pr.p.toFixed(a.pip));
    var bpct=BARRIERS[T.rate]||0.003;
    var lo=pr.p*(1-bpct), hi=pr.p*(1+bpct);
    updateMeter(pr.p,lo,hi);
    updateAccuAnalysis(pr.p,lo,hi,sym);
  }
  /* ── Reset chart e carregar histórico do novo ativo ── */
  _chart.prices   = [];
  _chart.tickCount= 0;
  _chart.lastTs   = 0;
  _chart.lastLo   = null;
  _chart.lastHi   = null;
  if (_chart.areaSeries) {
    if (_chart.plHi)   { try { _chart.areaSeries.removePriceLine(_chart.plHi);   } catch(e){} _chart.plHi   = null; }
    if (_chart.plLo)   { try { _chart.areaSeries.removePriceLine(_chart.plLo);   } catch(e){} _chart.plLo   = null; }
    if (_chart.plSpot) { try { _chart.areaSeries.removePriceLine(_chart.plSpot); } catch(e){} _chart.plSpot = null; }
    _chart.areaSeries.setData([]);
    _loadTickHistory(sym, function(arr) { _chartInjectHistory(arr); });
  }
  goToView('v-chart',$('bnChart'));
  if(T.stake>0) requestProposal();
};

/* NAVIGATION */
window.goToView=function(viewId,btnEl){
  document.querySelectorAll('.view').forEach(function(v){ v.classList.remove('active'); });
  document.querySelectorAll('.bnav-btn').forEach(function(b){ b.classList.remove('active'); });
  var v=$(viewId); if(v){ v.classList.add('active'); v.scrollTop=0; }
  if(typeof btnEl==='string') btnEl=$(btnEl);
  if(btnEl) btnEl.classList.add('active');
  if(viewId==='v-chart') setTimeout(chartResize, 30);
  /* Mostrar banner se entrar no ranking sem nickname */
  if(viewId==='v-ranking'){
    var banner=$('wrNickBanner');
    if(banner) banner.style.display=(!_fb.nickname)?'flex':'none';
  }
  if(window.lucide) lucide.createIcons();
};

function renderNav() {
  txt('chAsset', S.asset ? S.asset.name : '...');
  /* Nav topo — mostrar modo (Demo/Real), nunca o ID */
  var navMode = $('navModeLabel');
  if(navMode) navMode.textContent = S.isDemo ? 'Demo' : 'Real';
  /* Badge de modo no perfil */
  var badge = $('profileBadge');
  if(badge){
    badge.textContent = S.isDemo ? 'Demo' : 'Real';
    badge.style.background = S.isDemo ? 'rgba(245,158,11,.15)' : 'rgba(0,230,118,.12)';
    badge.style.color = S.isDemo ? '#f59e0b' : '#00e676';
  }
  /* Nome no perfil — nickname se existir, senão placeholder amigável */
  var displayName = _fb.nickname || 'O meu perfil';
  txt('profileName', displayName);
  /* Renderizar avatar com inicial */
  _renderProfileAvatar(_fb.nickname || '');
  /* Esconder labels com ID */
  var pA = $('profileAcctLabel'); if(pA) pA.style.display = 'none';
  var al = $('acctLabel');       if(al) al.style.display = 'none';

  /* Mostrar banner de notificações se ainda não foi pedido */
  var nb = $('notifBanner');
  if(nb) {
    var showNotif = ('Notification' in window) && Notification.permission === 'default';
    nb.style.display = showNotif ? 'flex' : 'none';
  }

  /* Notificações nativas — permissão já concedida, nada a fazer */
}

/* TRADE FORM */
window.selectGrowthRate=function(rate,el){
  T.rate=rate;
  document.querySelectorAll('.growth-btn').forEach(function(b){ b.classList.remove('active'); });
  if(el) el.classList.add('active');
  txt('activeRate',rate+'%');
  var pr=S.prices[S.asset.sym];
  if(pr){
    var bpct=BARRIERS[rate]||0.003,pip=S.asset.pip||4;
    var lo=(pr.p*(1-bpct)).toFixed(pip),hi=(pr.p*(1+bpct)).toFixed(pip);
    txt('barrierLow',lo); txt('barrierHigh',hi);
    updateMeter(pr.p,parseFloat(lo),parseFloat(hi));
    updateAccuAnalysis(pr.p,parseFloat(lo),parseFloat(hi),S.asset.sym);
  }
  if(T.stake>0) requestProposal();
};

window.setStake=function(val){
  var e=$('stakeAmt'); if(!e) return;
  e.value=val; T.stake=val;
  /* Só reativar o botao se nao estiver em cooldown */
  var btn=$('execBtn');
  if(btn && btn.innerHTML.indexOf('Aguarda')===-1){
    btn.disabled=false;
  }
  requestProposal();
};

window.onStakeInput=function(){
  var e=$('stakeAmt'); if(!e) return;
  T.stake=parseFloat(e.value)||0;
  /* Só reativar o botao se nao estiver em cooldown (texto do cooldown contem Aguarda) */
  var btn=$('execBtn');
  if(btn && btn.innerHTML.indexOf('Aguarda')===-1){
    btn.disabled=T.stake<1;
  }
  clearTimeout(T._pt);
  T._pt=setTimeout(requestProposal,700);
};

window.toggleTP=function(){
  T.tpEnabled=!T.tpEnabled;
  var sw=$('tpSwitch'),body=$('tpBody'),lbl=$('tpToggleLabel');
  if(sw)  sw.classList.toggle('on',T.tpEnabled);
  if(body)body.style.display=T.tpEnabled?'block':'none';
  if(lbl){ lbl.textContent=T.tpEnabled?'ON':'OFF'; lbl.style.color=T.tpEnabled?'var(--green)':'var(--text3)'; }
  if(!T.tpEnabled) T.tpValue=0;
};

window.setTP=function(val,el){
  T.tpValue=val;
  var e=$('tpAmt'); if(e) e.value=val;
  document.querySelectorAll('.tp-preset').forEach(function(b){ b.classList.remove('active'); });
  if(el) el.classList.add('active');
  txt('tpDisplayVal','$'+val.toFixed(2));
};

window.onTpInput=function(){
  var e=$('tpAmt'); if(!e) return;
  T.tpValue=parseFloat(e.value)||0;
  document.querySelectorAll('.tp-preset').forEach(function(b){ b.classList.remove('active'); });
  txt('tpDisplayVal',T.tpValue>0?'$'+T.tpValue.toFixed(2):'...');
};

/* PROPOSAL */
function requestProposal(){
  if(T.stake<1||!S.loggedIn) return;
  if(T._inCooldown) return; /* bloqueio real após KO — não pede proposta durante cooldown */
  wsSend({proposal:1,amount:T.stake,basis:'stake',contract_type:'ACCU',currency:S.currency,growth_rate:T.rate/100,symbol:S.asset.sym});
}

function onProposal(d){
  var pBox=$('proposalBox');
  if(d.error){
    if(pBox){ pBox.className='proposal-box'; pBox.innerHTML='<span style="color:var(--red);font-size:.7rem">'+d.error.message+'</span>'; }
    T.proposal=null; return;
  }
  T.proposal=d.proposal;
  var p=d.proposal;
  if(pBox){
    pBox.className='proposal-box has-data';
    pBox.innerHTML='<div style="display:flex;flex-wrap:wrap;gap:.75rem;font-size:.72rem">'
      +'<span>Payout max: <b style="color:var(--green)">$'+parseFloat(p.payout||0).toFixed(2)+'</b></span>'
      +(p.barrier?'<span>Barreira: <b>'+p.barrier+'</b></span>':'')
      +'</div>';
  }
  var btn=$('execBtn'); if(btn) btn.disabled=false;
}

/* BUY */
/* Guard para evitar múltiplas entradas seguidas */
var _tradePending = false;

window.placeTrade=function(){
  if(_tradePending){ toast('Aguarda...','Operação já em curso','warn'); return; }
  if(T.stake<1){ toast('Stake inválido','O mínimo é $1 para Accumulators','error'); return; }
  if(T.stake>S.balance&&!S.isDemo){
    toast('Saldo insuficiente','Tens $'+S.balance.toFixed(2)+' — reduz o stake ou deposita','error');
    return;
  }
  if(!S.loggedIn){ toast('Sessão expirada','Faz login novamente','error'); return; }
  if(!S.ws||S.ws.readyState!==1){ toast('Sem ligação','A reconectar ao servidor...','warn'); wsConnect(); return; }
  if(!T.proposal){ toast('Sem proposta','Insere o stake e aguarda a proposta','warn'); if(T.stake>=1) requestProposal(); return; }
  _tradePending=true;
  var btn=$('execBtn'); if(btn){ btn.disabled=true; btn.textContent='A abrir...'; }
  window._pendingTP=(T.tpEnabled&&T.tpValue>0)?T.tpValue:0;
  wsSend({buy:T.proposal.id,price:T.stake,parameters:{amount:T.stake,basis:'stake',contract_type:'ACCU',currency:S.currency,growth_rate:T.rate/100,symbol:S.asset.sym}});
};

function onBuy(d){
  _tradePending=false;
  var btn=$('execBtn');
  if(d.error){
    var msg = d.error.message || '';
    var code = d.error.code || '';
    var errTitle = 'Erro ao abrir';
    var errDetail = msg;

    if (msg.toLowerCase().includes('insufficient') || msg.toLowerCase().includes('balance')) {
      errTitle = 'Saldo insuficiente';
      errDetail = 'Deposita fundos ou reduz o stake';
    } else if (msg.toLowerCase().includes('too many') || msg.toLowerCase().includes('limit')) {
      errTitle = 'Limite de contratos';
      errDetail = 'Fecha um contrato aberto antes de abrir outro';
    } else if (msg.toLowerCase().includes('market') || msg.toLowerCase().includes('closed')) {
      errTitle = 'Mercado indisponível';
      errDetail = 'Este ativo está temporariamente fechado';
    } else if (msg.toLowerCase().includes('stake') || msg.toLowerCase().includes('amount')) {
      errTitle = 'Stake inválido';
      errDetail = 'Valor fora dos limites permitidos pela Deriv';
    } else if (msg.toLowerCase().includes('proposal') || code === 'ProposalExpired') {
      errTitle = 'Proposta expirada';
      errDetail = 'A cotação mudou — tenta novamente';
    } else if (msg.toLowerCase().includes('connection') || msg.toLowerCase().includes('network')) {
      errTitle = 'Erro de ligação';
      errDetail = 'Verifica a tua internet e tenta novamente';
    }

    /* Reativar botão só se ainda tiver proposal válido */
    if(T.proposal && btn){
      btn.disabled=false;
      btn.innerHTML='<svg data-lucide="zap" width="16" height="16"></svg> ABRIR ACUMULADOR';
      if(window.lucide) lucide.createIcons();
    }
    toast(errTitle, errDetail, 'error');
    /* Se proposta expirou, pedir nova automaticamente */
    if (code === 'ProposalExpired' || msg.toLowerCase().includes('proposal')) {
      T.proposal = null;
      if (T.stake >= 1) setTimeout(requestProposal, 1000);
    }
    return;
  }
  /* Sucesso: manter botão desativado — utilizador tem de confirmar novo trade */
  if(btn){ btn.disabled=true; btn.innerHTML='<svg data-lucide="zap" width="16" height="16"></svg> ABRIR ACUMULADOR'; if(window.lucide) lucide.createIcons(); }
  var c=d.buy;
  /* Limpar guard deste contrato caso existisse de uma sessão anterior */
  delete _soldContracts[c.contract_id];
  toast('Acumulador aberto!','$'+parseFloat(c.buy_price||0).toFixed(2)+' '+T.rate+'%/tick','success');
  if(window._pendingTP>0) S.tpMap[c.contract_id]=window._pendingTP;
  window._pendingTP=0;
  wsSend({proposal_open_contract:1,contract_id:c.contract_id,subscribe:1});
  /* Guardar posição aberta no Firebase */
  fbSaveOpenPosition(c);
  T.proposal=null;
}

/* CONTRACT UPDATES */
/* Guard para evitar processar o mesmo contrato fechado mais de uma vez */
var _soldContracts = {};
function onContract(d){
  if(!d.proposal_open_contract) return;
  var c=d.proposal_open_contract;
  if(c.is_sold||c.status==='sold'||c.is_expired){
    /* Evitar loop: só processar o fecho uma vez por contrato */
    if(_soldContracts[c.contract_id]) return;
    _soldContracts[c.contract_id]=true;
    /* Limpar guard após 30 segundos para não acumular memória */
    setTimeout(function(){ delete _soldContracts[c.contract_id]; },300000); /* 5 min */
    S.contracts=S.contracts.filter(function(x){ return x.contract_id!==c.contract_id; });
    delete S.tpMap[c.contract_id];

    /* ── RESET COMPLETO APÓS CONTRATO FECHADO ── */
    var wasLoss = parseFloat(c.profit||0) < 0;
    T.proposal=null;
    T.stake=0;

    /* Limpar campo de stake no formulário */
    var stakeInp=$('stakeAmt');
    if(stakeInp){ stakeInp.value=''; }

    /* Limpar botões de preset de stake */
    document.querySelectorAll('.lot-btn').forEach(function(b){ b.classList.remove('active'); });

    /* Desativar botão de execução */
    var execB=$('execBtn');
    if(execB){ execB.disabled=true; execB.innerHTML='<svg data-lucide="zap" width="16" height="16"></svg> ABRIR ACUMULADOR'; if(window.lucide) lucide.createIcons(); }

    /* Limpar proposal box */
    var pBox=$('proposalBox');
    if(pBox){ pBox.className='proposal-box'; pBox.innerHTML='<span style="font-size:.7rem;color:var(--text2)">Insere o stake para ver os detalhes do contrato</span>'; }

    /* Se foi perda (KO): cooldown de 4 segundos com contador visual */
    if(wasLoss && execB){
      var seconds=4;
      T._inCooldown=true; /* bloqueia requestProposal durante o cooldown */
      execB.disabled=true;
      execB.style.opacity='0.6';
      execB.innerHTML='⏳ Aguarda '+seconds+'s...';
      var cd=setInterval(function(){
        seconds--;
        if(seconds<=0){
          clearInterval(cd);
          T._inCooldown=false; /* liberar após cooldown real */
          execB.style.opacity='';
          execB.innerHTML='<svg data-lucide="zap" width="16" height="16"></svg> ABRIR ACUMULADOR';
          /* Só reativar se tiver stake preenchido */
          if(T.stake>=1){ execB.disabled=false; }
          if(window.lucide) lucide.createIcons();
        } else {
          execB.innerHTML='⏳ Aguarda '+seconds+'s...';
        }
      },1000);
    }

    /* Guard extra: nunca mostrar resultado do mesmo contrato mais de 1 vez */
    if(!window._shownResults) window._shownResults={};
    if(window._shownResults[c.contract_id]) return;
    window._shownResults[c.contract_id]=true;
    setTimeout(function(){ delete window._shownResults[c.contract_id]; },600000); /* 10 min */
    addHistory(c); renderContracts(); renderLiveOps(); renderHistory(); updateStats(); showResult(c);
    return;
  }
  var idx=-1;
  S.contracts.forEach(function(x,i){ if(x.contract_id===c.contract_id) idx=i; });
  if(idx>=0) S.contracts[idx]=c; else S.contracts.push(c);
  renderContracts(); renderLiveOps(); updateStatsBar();
}

/* SELL */
/* SELL — fechar imediatamente, sem modal de confirmação */
window.confirmClose=function(cid){
  var cidNum=parseInt(cid,10);
  if(isNaN(cidNum)){ toast('Erro','ID de contrato inválido','error'); return; }
  wsSend({sell:cidNum, price:0});
};
window.doCloseTrade=function(cid){
  var cidNum=parseInt(cid,10);
  if(isNaN(cidNum)){ toast('Erro','ID de contrato inválido','error'); return; }
  wsSend({sell:cidNum, price:0});
};
window.cancelCloseTrade=function(){};
window.closeConfirm=function(){ var m=$('confirmModal'); if(m) m.classList.remove('open'); };

function onSell(d){
  if(d.error){
    var msg = d.error.message || '';
    var errTitle = 'Erro ao fechar';
    var errDetail = msg;
    if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('sold')) {
      errTitle = 'Contrato já fechado';
      errDetail = 'O contrato já foi encerrado anteriormente';
      /* Limpar da lista local se ainda estiver lá */
      renderContracts(); renderLiveOps();
    } else if (msg.toLowerCase().includes('connection') || msg.toLowerCase().includes('network')) {
      errTitle = 'Erro de ligação';
      errDetail = 'Tenta fechar novamente';
    } else if (msg.toLowerCase().includes('permission')) {
      errTitle = 'Sem permissão';
      errDetail = 'Não tens permissão para fechar este contrato';
    }
    toast(errTitle, errDetail, 'error');
    return;
  }
  var sell=d.sell||{};
  var soldFor=parseFloat(sell.sold_for||0);
  var buyPrice=parseFloat(sell.buy_price||0);
  var pr=soldFor>0?(soldFor-buyPrice):0;
  /* Remover o contrato da lista local imediatamente */
  var cid=sell.contract_id;
  if(cid){
    /* Comparar como string E número para cobrir ambos os casos */
    S.contracts=S.contracts.filter(function(x){
      return String(x.contract_id)!==String(cid) && parseInt(x.contract_id)!==parseInt(cid);
    });
    delete S.tpMap[cid];
    delete S.tpMap[String(cid)];
  }
  /* Atualizar saldo localmente antes de receber o evento balance */
  if(soldFor>0){
    S.balance=Math.max(0,S.balance-buyPrice+soldFor);
    renderBalance();
  }
  renderContracts(); renderLiveOps(); renderHistory(); updateStats();
  toast(pr>=0?'✓ Posição Fechada':'Posição Fechada','Resultado: '+(pr>=0?'+':'')+pr.toFixed(2)+' USD',pr>=0?'success':'warn');
}

/* LIVE OPS — overlay no canvas + badge no footer */
function renderLiveOps(){
  var count=S.contracts.length;

  /* badge no footer */
  var badge=$('cvOpenBadge');
  if(badge){
    if(count>0){
      badge.style.display='';
      var totalP=S.contracts.reduce(function(s,c){ return s+parseFloat(c.profit||0); },0);
      var cls=totalP>=0?'green':'red';
      txt('openContractCount',count);
      var pnlEl=$('totalPnl');
      if(pnlEl){ pnlEl.textContent=(totalP>=0?'+':'')+totalP.toFixed(2); pnlEl.className=cls; }
      var aoaEl=$('livePnlAoa');
      if(aoaEl && TAXA_AOA){ aoaEl.textContent='≈'+(totalP*TAXA_AOA).toFixed(0)+'Kz'; }
    } else {
      badge.style.display='none';
    }
  }

  /* overlay no topo direito do canvas — lucro ao vivo + payout actual */
  var overlay=$('chartContractsOverlay'); if(!overlay) return;
  if(!count){ overlay.innerHTML=''; return; }
  overlay.innerHTML=S.contracts.map(function(c){
    var pr=parseFloat(c.profit||0);
    var a=ASSETS.find(function(x){ return x.sym===c.underlying; });
    var rate=((c.growth_rate||0)*100).toFixed(0);
    var cls=pr>=0?'pos':'neg';
    var bid=parseFloat(c.bid_price||0);
    return '<div class="cco-item">'
      +'<span class="cco-sym">'+(a?a.short:c.underlying.slice(-3))+'·'+rate+'%</span>'
      +'<span class="cco-pnl '+cls+'">'+(pr>=0?'+':'')+pr.toFixed(2)+'$</span>'
      +(bid>0?'<span style="font-size:.52rem;color:var(--text3);margin-left:.15rem">'+bid.toFixed(2)+'</span>':'')
      +'</div>';
  }).join('');

  /* liveOpsCount ainda existe noutras views */
  txt('liveOpsCount',count);
}

/* POSITIONS VIEW */
function renderContracts(){
  var el=$('posList'); if(!el) return;
  txt('posCount',S.contracts.length);
  if(!S.contracts.length){
    el.innerHTML='<div class="no-pos"><div class="no-pos-ico"><svg data-lucide="clipboard" width="32" height="32"></svg></div>Nenhum contrato aberto</div>';
    if(window.lucide) lucide.createIcons(); return;
  }
  el.innerHTML=S.contracts.map(function(c){
    var pr=parseFloat(c.profit||0);
    var rate=((c.growth_rate||0)*100).toFixed(0);
    var tp=S.tpMap[c.contract_id];
    var a=ASSETS.find(function(x){ return x.sym===c.underlying; });
    var name=a?a.name:(c.underlying||'...');
    var cls=pr>=0?'pos-profit-pos':'pos-profit-neg';
    return '<div class="pos-card">'
      +'<div class="pos-card-top">'
      +'<div class="pos-info">'
      +'<span class="pos-sym">'+name+'</span>'
      +'<div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;margin-top:.25rem">'
      +'<span class="pos-meta">'+rate+'%/tick - '+(c.tick_count||0)+' ticks</span>'
      +(tp?'<span class="pos-tp-badge">TP $'+tp.toFixed(2)+'</span>':'')
      +'</div></div>'
      +'<div class="'+cls+'" style="text-align:right">'
      +'<div style="font-size:1.15rem;font-weight:900;font-family:var(--mono)">'+(pr>=0?'+':'')+pr.toFixed(2)+'</div>'
      +'<div style="font-size:.6rem;color:var(--text3)">USD</div>'
      +'</div></div>'
      +'<div class="pos-card-bot">'
      +'<span class="pos-payout">Payout: $'+parseFloat(c.bid_price||c.payout||0).toFixed(2)+'</span>'
      +'<button class="pos-close-btn" onclick="confirmClose(\''+c.contract_id+'\')"><svg data-lucide="x-circle" width="13" height="13"></svg> Fechar</button>'
      +'</div></div>';
  }).join('');
  if(window.lucide) lucide.createIcons();
}

/* STATS BAR */
function updateStatsBar(){
  /* activeRate ainda existe no v-trade */
  txt('activeRate',T.rate+'%');
  /* renderLiveOps trata do badge e overlay */
  renderLiveOps();
}

/* PORTFOLIO */
function loadPortfolio(){ wsSend({portfolio:1,contract_type:['ACCU']}); }
function onPortfolio(d){
  if(!d.portfolio||!d.portfolio.contracts) return;
  d.portfolio.contracts.forEach(function(c){ wsSend({proposal_open_contract:1,contract_id:c.contract_id,subscribe:1}); });
}

/* PROFIT TABLE */
function loadProfitTable(){
  var today=Math.floor(new Date().setHours(0,0,0,0)/1000);
  wsSend({profit_table:1,contract_type:['ACCU'],date_from:today,limit:50});
}
function onProfitTable(d){
  if(!d.profit_table||!d.profit_table.transactions) return;
  var derivEntries=d.profit_table.transactions
    .filter(function(t){ return t.underlying_symbol && t.contract_id; })
    .map(function(t){
      return {
        contract_id: String(t.contract_id),
        underlying:  t.underlying_symbol,
        profit:      parseFloat(t.profit||0),
        buy_price:   parseFloat(t.buy_price||0),
        growth_rate: parseFloat(t.growth_rate||0),
        tick_count:  parseInt(t.tick_count||0),
        sell_time:   parseInt(t.sell_time||0)
      };
    });
  /* Popular _fbHistoryMap com dados da Deriv (mais fiáveis) */
  derivEntries.forEach(function(h){ _fbHistoryMap[h.contract_id]=h; });
  /* Mesclar com S.history */
  var existingIds={};
  S.history.forEach(function(h){ existingIds[String(h.contract_id)]=true; });
  derivEntries.forEach(function(h){
    if(!existingIds[String(h.contract_id)]){
      S.history.push(h); existingIds[String(h.contract_id)]=true;
    } else {
      for(var i=0;i<S.history.length;i++){
        if(String(S.history[i].contract_id)===String(h.contract_id)){
          /* Atualizar com dados da Deriv mas manter sell_time do Firebase se existir */
          S.history[i]=Object.assign({},S.history[i],h);
          break;
        }
      }
    }
  });
  S.history.sort(function(a,b){ return (b.sell_time||0)-(a.sell_time||0); });
  if(S.history.length>100) S.history=S.history.slice(0,100);
  renderHistory(); updateStats();
  /* Guardar versão limpa no Firebase e limpar entradas inválidas antigas */
  _fbFlushHistory();
  fbCleanupHistory();
}
function addHistory(c){
  /* Extrair dados do contrato com fallbacks seguros */
  var entry={
    contract_id: String(c.contract_id||''),
    underlying:  c.underlying||c.underlying_symbol||'',
    profit:      parseFloat(c.profit||0),
    buy_price:   parseFloat(c.buy_price||0),
    growth_rate: parseFloat(c.growth_rate||0),
    tick_count:  parseInt(c.tick_count||0),
    sell_time:   Math.floor(Date.now()/1000)
  };
  /* Validar — não guardar entradas sem símbolo */
  if(!entry.underlying || !entry.contract_id){ console.warn('addHistory: entrada inválida',entry); return; }
  S.history.unshift(entry);
  if(S.history.length>100) S.history.pop();
  fbSaveTrade(entry);
  fbRemoveOpenPosition(c.contract_id);
  /* ── Comissão automática para o parceiro que referiu este utilizador ── */
  _commissionOnTrade(entry.buy_price);
}

/* ═══════════════════════════════════════════════════════════
   NOVA LÓGICA DE HISTÓRICO — cada trade é um documento
   individual em trades/{acct}_{contract_id}
   Sem arrays, sem limite de tamanho, sem corrupção
═══════════════════════════════════════════════════════════ */

/* Guardar 1 trade como documento individual */
function fbSaveTrade(entry){
  if(!window._db||!window._appReady) return;
  if(!entry.contract_id||!entry.underlying) return;
  var docId=S.acct+'_'+entry.contract_id;
  /* Usar sessions collection que já tem allow write: true */
  /* Usar history/{acct} com sub-objeto indexado por contract_id */
  /* Estratégia: guardar em sessions/{acct}/trades/{docId} mas as rules não permitem subcoleções */
  /* Usar a coleção history com um documento por trade — chave = acct_contractId */
  /* As rules: allow write if entries is list — não serve para documentos individuais */
  /* Solução: guardar tudo num único doc history/{acct} mas como objeto (map) não array */
  _fbHistoryMap[entry.contract_id]=entry;
  _fbFlushHistory();
}

/* Mapa em memória de todos os trades */
var _fbHistoryMap={};
var _fbFlushTimer=null;

/* Flush com debounce — escreve no Firestore no máximo 1x por 2 segundos */
function _fbFlushHistory(){
  clearTimeout(_fbFlushTimer);
  _fbFlushTimer=setTimeout(function(){
    if(!window._db||!S.acct) return;
    /* Converter mapa para array ordenado por sell_time */
    var entries=Object.values(_fbHistoryMap)
      .filter(function(h){ return h.underlying && h.contract_id; })
      .sort(function(a,b){ return (b.sell_time||0)-(a.sell_time||0); })
      .slice(0,50)
      .map(function(h){
        return {
          contract_id: String(h.contract_id),
          underlying:  String(h.underlying),
          profit:      Number(parseFloat(h.profit).toFixed(4)),
          buy_price:   Number(parseFloat(h.buy_price).toFixed(4)),
          growth_rate: Number(parseFloat(h.growth_rate).toFixed(4)),
          tick_count:  parseInt(h.tick_count)||0,
          sell_time:   parseInt(h.sell_time)||Math.floor(Date.now()/1000)
        };
      });
    if(!entries.length) return;
    window._fsSetDoc(
      window._fsDoc(window._db,'history',S.acct),
      {entries:entries, updatedAt:Date.now()}
    ).then(function(){
      console.log('[DW] Histórico guardado:',entries.length,'trades');
    }).catch(function(e){
      console.warn('[DW] Erro ao guardar histórico:',e.message);
    });
  },2000);
}

/* Carregar histórico do Firestore — mantido como fallback, o listener principal é _fbListenHistory */
function fbLoadHistory(){
  if(!window._db||!S.acct) return;
  /* Se já temos listener ativo, não precisamos de getDoc */
  if(_fbListeners.length > 0) return;
  window._fsGetDoc(window._fsDoc(window._db,'history',S.acct)).then(function(snap){
    if(!snap.exists()){
      console.log('[DW] Sem histórico no Firebase para',S.acct);
      return;
    }
    var d=snap.data();
    var fbEntries=d.entries||[];
    console.log('[DW] Firebase: carregados',fbEntries.length,'trades');

    /* Filtrar entradas inválidas */
    fbEntries=fbEntries.filter(function(h){
      return h && h.contract_id && h.underlying && h.underlying!=='' && h.sell_time>0;
    });

    if(!fbEntries.length){ console.log('[DW] Sem entradas válidas no Firebase'); return; }

    /* Popular _fbHistoryMap */
    fbEntries.forEach(function(h){ _fbHistoryMap[String(h.contract_id)]=h; });

    /* Mesclar com S.history sem duplicados */
    var existingIds={};
    S.history.forEach(function(h){ existingIds[String(h.contract_id)]=true; });
    var added=0;
    fbEntries.forEach(function(h){
      if(!existingIds[String(h.contract_id)]){
        S.history.push({
          contract_id: String(h.contract_id),
          underlying:  h.underlying,
          profit:      parseFloat(h.profit)||0,
          buy_price:   parseFloat(h.buy_price)||0,
          growth_rate: parseFloat(h.growth_rate)||0,
          tick_count:  parseInt(h.tick_count)||0,
          sell_time:   parseInt(h.sell_time)||0
        });
        existingIds[String(h.contract_id)]=true;
        added++;
      }
    });

    if(added>0){
      S.history.sort(function(a,b){ return (b.sell_time||0)-(a.sell_time||0); });
      if(S.history.length>100) S.history=S.history.slice(0,100);
      renderHistory();
      updateStats();
      console.log('[DW] Histórico renderizado com',S.history.length,'entradas');
    }
  }).catch(function(e){ console.warn('[DW] fbLoadHistory erro:',e.message); });
}

/* Limpar entradas inválidas antigas do Firebase (chamado 1x após profit_table carregar) */
function fbCleanupHistory(){
  if(!window._db||!S.acct) return;
  window._fsGetDoc(window._fsDoc(window._db,'history',S.acct)).then(function(snap){
    if(!snap.exists()) return;
    var d=snap.data();
    var all=d.entries||[];
    var valid=all.filter(function(h){
      return h && h.contract_id && h.underlying && h.underlying!=='' && parseFloat(h.growth_rate)>0 && parseInt(h.sell_time)>0;
    });
    if(valid.length < all.length){
      console.log('[DW] Limpeza: removidas',all.length-valid.length,'entradas inválidas do Firebase');
      window._fsSetDoc(
        window._fsDoc(window._db,'history',S.acct),
        {entries:valid, updatedAt:Date.now()}
      ).catch(function(){});
    }
  }).catch(function(){});
}

/* Compatibilidade: manter fbSaveHistory para não quebrar chamadas existentes */
function fbSaveHistory(){ _fbFlushHistory(); }

/* ═══════════════════════════════════════
   FIREBASE — POSIÇÕES ABERTAS
   Coleção: positions/{posId}
   Rules: allow create if acct is string; allow delete if true
═══════════════════════════════════════ */
function fbSaveOpenPosition(c){
  if(!window._db||!S.acct||!c||!c.contract_id) return;
  var posId=S.acct+'_'+c.contract_id;
  window._fsSetDoc(
    window._fsDoc(window._db,'positions',posId),
    {
      acct:       S.acct,
      contract_id:String(c.contract_id),
      underlying: c.underlying||'',
      buy_price:  parseFloat(c.buy_price||0),
      growth_rate:parseFloat(c.growth_rate||0),
      stake:      parseFloat(c.buy_price||T.stake||0),
      openedAt:   Date.now()
    }
  ).catch(function(e){ console.warn('fbSaveOpenPosition:',e.message); });
}

function fbRemoveOpenPosition(contract_id){
  if(!window._db||!S.acct||!contract_id) return;
  var posId=S.acct+'_'+contract_id;
  window._fsDeleteDoc(window._fsDoc(window._db,'positions',posId))
    .catch(function(e){ console.warn('fbRemoveOpenPosition:',e.message); });
}

function fbLoadOpenPositions(){
  /* Não reabrir posições automaticamente — apenas limpar entradas órfãs desta conta */
  /* A Deriv já devolve o portfolio ativo via loadPortfolio() */
  if(!window._db||!S.acct) return;
  var q=window._fsQuery(
    window._fsCollection(window._db,'positions'),
    window._fsWhere('acct','==',S.acct)
  );
  window._fsGetDocs(q).then(function(snap){
    /* Se a Deriv já confirmou que não há contratos abertos, limpar o Firebase */
    setTimeout(function(){
      if(S.contracts.length===0 && !snap.empty){
        snap.forEach(function(docSnap){
          window._fsDeleteDoc(docSnap.ref).catch(function(){});
        });
      }
    }, 5000); /* aguardar 5s para o portfolio da Deriv carregar */
  }).catch(function(){});
}

/* HISTORY */
function renderHistory(){
  var el=$('tradeHistory'); if(!el) return;
  /* Filtrar entradas inválidas — sem underlying ou sem sell_time */
  var valid=S.history.filter(function(h){
    return h && h.underlying && h.underlying!=='' && h.sell_time>0;
  });
  if(!valid.length){
    el.innerHTML='<div class="no-history">Sem operações registadas.</div>';
    return;
  }
  el.innerHTML=valid.slice(0,30).map(function(h){
    var pr=parseFloat(h.profit)||0;
    var cls=pr>=0?'hist-win':'hist-loss';
    var a=ASSETS.find(function(x){ return x.sym===h.underlying; });
    var name=a?a.name:h.underlying;
    var rate=h.growth_rate>0?((h.growth_rate)*100).toFixed(0):(h.growth_rate===0?'?':((h.growth_rate)*100).toFixed(0));
    /* growth_rate pode vir como 0.01 (decimal) ou 1 (inteiro) da Deriv */
    if(parseFloat(h.growth_rate)>=1) rate=parseFloat(h.growth_rate).toFixed(0);
    else rate=(parseFloat(h.growth_rate)*100).toFixed(0);
    var time=h.sell_time?new Date(h.sell_time*1000).toLocaleTimeString('pt-PT',{hour:'2-digit',minute:'2-digit'}):'--';
    var ticks=parseInt(h.tick_count)||0;
    return '<div class="hist-row '+cls+'">'
      +'<div class="hist-left">'
      +'<div class="hist-icon">'+(pr>=0?'&#8593;':'&#8595;')+'</div>'
      +'<div>'
      +'<div class="hist-sym">'+name+' '+rate+'%/tick</div>'
      +'<div class="hist-time">'+time+(ticks>0?' · '+ticks+' ticks':'')+'</div>'
      +'</div></div>'
      +'<div class="hist-pnl">'+(pr>=0?'+':'')+pr.toFixed(2)+'<span> USD</span></div>'
      +'</div>';
  }).join('');
}

/* PROFILE STATS */
function updateStats(){
  var h=S.history, total=h.length;
  var wins=h.filter(function(x){ return x.profit>0; }).length;
  var losses=total-wins;
  var profit=h.reduce(function(s,x){ return s+x.profit; },0);
  var best=h.reduce(function(b,x){ return x.profit>b?x.profit:b; },0);

  /* Lucro médio por trade (só wins) */
  var winTrades=h.filter(function(x){ return x.profit>0; });
  var avgProfit=winTrades.length>0
    ? winTrades.reduce(function(s,x){ return s+x.profit; },0)/winTrades.length : 0;

  /* Maior série de wins */
  var maxStreak=0, cur=0;
  h.slice().reverse().forEach(function(x){
    if(x.profit>0){ cur++; if(cur>maxStreak) maxStreak=cur; }
    else cur=0;
  });

  /* Melhor ativo (mais lucro acumulado) */
  var byAsset={};
  h.forEach(function(x){
    var a=x.underlying||x.symbol||'?';
    byAsset[a]=(byAsset[a]||0)+x.profit;
  });
  var bestAsset='—';
  var bestAssetVal=-Infinity;
  Object.keys(byAsset).forEach(function(a){
    if(byAsset[a]>bestAssetVal){ bestAssetVal=byAsset[a]; bestAsset=a; }
  });
  /* Simplificar nome do ativo */
  var assetMap={'R_10':'V10','R_25':'V25','R_50':'V50','R_75':'V75','R_100':'V100',
    '1HZ10V':'V10s','1HZ25V':'V25s','1HZ50V':'V50s','1HZ75V':'V75s','1HZ100V':'V100s'};
  if(bestAsset!=='—') bestAsset=assetMap[bestAsset]||bestAsset;

  /* Melhor hora do dia (hora UTC+1 Angola) */
  var byHour={};
  h.forEach(function(x){
    if(!x.date) return;
    var d=new Date(x.date);
    var hour=(d.getUTCHours()+1)%24; /* UTC+1 Angola */
    byHour[hour]=(byHour[hour]||0)+x.profit;
  });
  var bestHour='—';
  var bestHourVal=-Infinity;
  Object.keys(byHour).forEach(function(hr){
    if(byHour[hr]>bestHourVal){ bestHourVal=byHour[hr]; bestHour=hr+'h'; }
  });

  txt('statTrades',   total);
  txt('statWinRate',  total>0?Math.round(wins/total*100)+'%':'—');
  txt('statProfit',   (profit>=0?'+':'')+profit.toFixed(2)+'$');
  txt('statBestTrade','$'+best.toFixed(2));
  txt('statWinStreak',maxStreak||_winStreak);
  txt('statAvgProfit','$'+avgProfit.toFixed(2));
  txt('statBestAsset', bestAsset);
  txt('statBestHour',  bestHour);

  /* Cor do lucro total */
  var profEl=$('statProfit');
  if(profEl) profEl.style.color=profit>=0?'var(--green)':'var(--red)';

  /* Passar apenas o lucro do último trade ao ranking */
  if(h.length>0) fbUpdateRanking(h[0].profit);
}

/* ═══════════════════════════════════════════════════
   ALERTAS INTELIGENTES
   Verifica condições de risco a cada tick e avisa
   o utilizador com banner + vibração + som.
═══════════════════════════════════════════════════ */
var _lastAlertTime = 0;
var _alertCooldown = 8000; /* ms entre alertas do mesmo tipo */
var _alertShown    = {};   /* throttle por tipo */

function _checkSmartAlerts(spot, lo, hi, sym) {
  var now = Date.now();
  var el  = $('smartAlert');
  if (!el) return;

  /* ── 1. Perto da barreira (com contrato aberto) ── */
  if (lo && hi && S.contracts.some(function(c){ return c.underlying===sym; })) {
    var distLoPct = ((spot - lo) / spot) * 100;
    var distHiPct = ((hi - spot) / spot) * 100;
    var distMin   = Math.min(distLoPct, distHiPct);
    var side      = distLoPct < distHiPct ? 'baixa ↓' : 'alta ↑';

    /* Limiares dinâmicos pela taxa activa do contrato */
    var openCt    = S.contracts.find(function(c){ return c.underlying===sym; });
    var actRate   = openCt ? (Math.round(parseFloat(openCt.growth_rate||0)*100)||T.rate) : T.rate;
    var bwPct     = (BARRIERS[actRate] || 0.003) * 100;
    var warnThr   = bwPct * 1.8;
    var dangerThr = bwPct * 0.8;

    /* Spike: tick único > 40% da distância à barreira */
    var histSA  = S.priceHistory[sym] || [];
    var last5SA = histSA.slice(-5);
    var maxMvSA = 0;
    for(var sia=1; sia<last5SA.length; sia++){
      var mvsa = Math.abs(last5SA[sia]-last5SA[sia-1]);
      if(mvsa > maxMvSA) maxMvSA = mvsa;
    }
    var distAbsSA  = Math.min(spot - lo, hi - spot);
    var spikeRiskSA = distAbsSA > 0 && maxMvSA > 0 && (maxMvSA / distAbsSA) > 0.4;

    if(spikeRiskSA && (!_alertShown['spike'] || now - _alertShown['spike'] > _alertCooldown)) {
      _alertShown['spike'] = now;
      _showSmartAlert('🚨',
        'Spike detectado! Movimento de ' + (maxMvSA/distAbsSA*100).toFixed(0) + '% da distância à barreira num único tick.',
        'danger'
      );
      _playSpike();
      _vibrate('spike');
      return;
    }

    if (distMin < warnThr && (!_alertShown['barrier'] || now - _alertShown['barrier'] > _alertCooldown)) {
      _alertShown['barrier'] = now;
      var isKO = distMin < dangerThr;
      _showSmartAlert(
        isKO ? '🚨' : '⚠️',
        isKO
          ? 'PERIGO! Preço a ' + distMin.toFixed(3) + '% da barreira ' + side + ' — knock-out iminente!'
          : 'Atenção: preço a ' + distMin.toFixed(3) + '% da barreira ' + side,
        isKO ? 'danger' : 'warn'
      );
      _vibrate(isKO ? 'barrier_ko' : 'barrier_warn');
      return;
    }
  }

  /* ── 2. Volatilidade muito alta ── */
  var hist = S.priceHistory[sym] || [];
  if (hist.length >= 10) {
    var recent = hist.slice(-10);
    var mean   = recent.reduce(function(s,v){ return s+v; },0) / recent.length;
    var stddev = Math.sqrt(recent.reduce(function(s,v){ return s+Math.pow(v-mean,2); },0) / recent.length);
    var vol    = (stddev / mean) * 100;

    if (vol > 0.04 && (!_alertShown['vol'] || now - _alertShown['vol'] > _alertCooldown * 3)) {
      _alertShown['vol'] = now;
      /* Só alertar se não há contrato aberto */
      if (!S.contracts.some(function(c){ return c.underlying===sym; })) {
        _showSmartAlert(
          '📊',
          'Volatilidade muito alta agora (' + vol.toFixed(3) + '%) — risco elevado de knock-out. Aguarda ou usa taxa 1%.',
          'warn'
        );
      }
      return;
    }
  }

  /* ── 3. Condições ideais para entrar (sem contrato aberto) ── */
  if (!S.contracts.some(function(c){ return c.underlying===sym; })) {
    if (hist.length >= 20) {
      var r20   = hist.slice(-20);
      var m20   = r20.reduce(function(s,v){ return s+v; },0) / r20.length;
      var v20   = Math.sqrt(r20.reduce(function(s,v){ return s+Math.pow(v-m20,2); },0)/r20.length);
      var vol20 = (v20/m20)*100;
      if (vol20 < 0.005 && (!_alertShown['good'] || now - _alertShown['good'] > 30000)) {
        _alertShown['good'] = now;
        _showSmartAlert('✅', 'Mercado estável — boa altura para entrar!', 'good');
        return;
      }
    }
  }

  /* Esconder alerta se condições voltaram ao normal */
  if (el.style.display !== 'none') {
    var alertType = el.dataset.alertType;
    if (alertType === 'good' || alertType === 'warn') {
      /* Esconder automaticamente após 6s */
      if (!el._hideTimer) {
        el._hideTimer = setTimeout(function() {
          el.style.display = 'none';
          el._hideTimer = null;
        }, 6000);
      }
    }
  }
}

function _showSmartAlert(icon, text, type) {
  var el   = $('smartAlert');
  var ico  = $('smartAlertIcon');
  var txt2 = $('smartAlertText');
  if (!el || !ico || !txt2) return;

  ico.textContent  = icon;
  txt2.textContent = text;
  el.dataset.alertType = type;

  /* Cores por tipo */
  var colors = {
    danger: { bg:'rgba(255,61,90,.18)',  border:'rgba(255,61,90,.45)',  text:'#ff6b7a' },
    warn:   { bg:'rgba(255,193,7,.12)',  border:'rgba(255,193,7,.35)',  text:'#ffc107' },
    good:   { bg:'rgba(0,230,118,.1)',   border:'rgba(0,230,118,.3)',   text:'#00e676' },
  };
  var c = colors[type] || colors.warn;
  el.style.background   = c.bg;
  el.style.borderTopColor    = c.border;
  el.style.borderBottomColor = c.border;
  txt2.style.color = c.text;

  /* Cancelar timer de esconder anterior */
  if (el._hideTimer) { clearTimeout(el._hideTimer); el._hideTimer = null; }
  el.style.display = 'flex';

  /* Som suave de alerta */
  try {
    var ctx = _getAudio();
    if (ctx) {
      var osc = ctx.createOscillator();
      var g   = ctx.createGain();
      osc.connect(g); g.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.value = type === 'danger' ? 880 : type === 'good' ? 523 : 660;
      g.gain.setValueAtTime(0, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch(e){}
}


var _winStreak=0, _lossStreak=0;
function showResult(c){
  var modal=$('tradeResultModal'); if(!modal) return;
  var pr=parseFloat(c.profit||0), win=pr>0;
  var ring=$('rIconRing'), chip=$('rChip'), pnlEl=$('rPnl'), msgEl=$('rMsg'), details=$('rDetails');
  var rIcon=$('rIcon'), rBtn=$('rBtn');

  /* Streak tracking */
  if(win){ _winStreak++; _lossStreak=0; } else { _lossStreak++; _winStreak=0; }

  /* Som de ganho / perda */
  try { if(win) { _playWin(); _vibrate('win'); } else { _playLoss(); _vibrate('loss'); } } catch(e) {}
  try { localStorage.setItem('dw_win_streak', _winStreak); } catch(e){}

  if(ring) ring.className='r-icon-ring '+(win?'win':'loss');
  if(rIcon) rIcon.textContent=win?(_winStreak>=3?'🔥':'🏆'):'💥';
  if(chip){
    chip.textContent=win?'✦ ACUMULAÇÃO LUCRATIVA':'✦ KNOCK-OUT — BARREIRA TOCADA';
    chip.className='r-chip '+(win?'win':'loss');
  }
  if(pnlEl){ pnlEl.textContent=(pr>=0?'+':'')+pr.toFixed(2)+' USD'; pnlEl.className='r-pnl '+(win?'win':'loss'); }

  /* Explicação clara do resultado */
  var a=ASSETS.find(function(x){ return x.sym===c.underlying; });
  var rate=((c.growth_rate||0)*100).toFixed(0);
  var ticks=c.tick_count||0;
  var stake=parseFloat(c.buy_price||0);

  if(!win){
    var lossMsg=_lossStreak>=2?'⚠️ '+_lossStreak+'ª perda — tenta baixar a taxa.':'Barreira tocada ao tick '+ticks+'.';
    if(msgEl) msgEl.textContent=lossMsg;
  } else {
    var winMsgs=['Capital a crescer! 💰','Excelente — '+ticks+' ticks acumulados!','Continua assim! 🇦🇴','Perfeito — a zona segura aguentou '+ticks+' ticks.'];
    if(msgEl) msgEl.textContent=winMsgs[Math.floor(Math.random()*winMsgs.length)];
  }

  if(details){
    details.innerHTML='<span class="r-pill">'+(a?a.name:c.underlying||'...')+'</span>'
      +'<span class="r-pill">'+rate+'%/tick</span>'
      +'<span class="r-pill">'+ticks+' ticks</span>'
      +'<span class="r-pill">Stake $'+stake.toFixed(2)+'</span>';
  }

  /* Explicação knock-out — apenas 1 linha curta */
  var explainBox=$('rKnockoutExplain');
  if(explainBox) explainBox.style.display='none';

  /* Session bar — apenas no win */
  var sessionBar=$('rSessionBar');
  if(sessionBar) sessionBar.style.display='none';

  /* Streak badge */
  var streakEl=$('rStreak'),streakTxt=$('rStreakText'),streakIco=$('rStreakIcon');
  if(streakEl){
    if(win&&_winStreak>=2){
      streakEl.style.display='flex';
      if(streakIco) streakIco.textContent=_winStreak>=4?'⚡':'🔥';
      if(streakTxt) streakTxt.textContent=_winStreak+' wins seguidos!';
    } else {
      streakEl.style.display='none';
    }
  }

  if(rBtn){
    if(win){
      rBtn.textContent='Continuar a Operar →';
      rBtn.className='r-btn win';
      rBtn.onclick=function(){ closeResult(); };
    } else {
      rBtn.textContent='OK, Entendido';
      rBtn.className='r-btn loss';
      /* Na perda: fechar modal e ir para o gráfico — NÃO abre trade */
      rBtn.onclick=function(){
        closeResult();
        goToView('v-chart',$('bnChart'));
      };
    }
  }

  /* Countdown */
  var cdEl=$('rCountdown'),secs=win?10:12;
  if(cdEl) cdEl.textContent=secs;
  clearInterval(modal._cd);
  modal._cd=setInterval(function(){
    secs--; if(cdEl) cdEl.textContent=secs;
    if(secs<=0){ clearInterval(modal._cd); closeResult(); }
  },1000);

  /* ══ PUSH NOTIFICATION DE GANHO / PERDA ══ */
  _sendTradeNotification(c, pr, win, ticks, rate, a);

  modal.style.display='flex';
  requestAnimationFrame(function(){ modal.style.opacity='1'; });
  clearTimeout(modal._t);
}
window.closeTradeResult=closeResult;
/* ══════════════════════════════════════════════
   NOTIFICAÇÕES DE TRADE — só ganho e perda
══════════════════════════════════════════════ */
function _sendTradeNotification(c, pr, win, ticks, rate, asset) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  var name  = asset ? asset.short : (c.underlying || 'V10');
  var prAbs = Math.abs(pr).toFixed(2);
  var prAoa = Math.round(Math.abs(pr) * (window._taxaUsdAoa || 950)).toLocaleString('pt-AO');

  var title, body;

  if (win) {
    title = '💹 Ganhaste +$' + prAbs + ' USD!';
    body  = 'aprox. ' + prAoa + ' AOA  |  ' + name + ' ' + rate + '%  |  ' + ticks + ' ticks';
  } else {
    title = '⚡ Knock-out  -$' + prAbs + ' USD';
    body  = name + ' | Barreira tocada ao tick ' + ticks + ' | aprox. ' + prAoa + ' AOA';
  }

  try {
    new Notification(title, {
      body : body,
      icon : '/icon-192.png',
      tag  : 'dw-trade-' + c.contract_id,
    });
  } catch(e) {}
}

function closeResult(){
  var m=$('tradeResultModal'); if(!m) return;
  clearInterval(m._cd);
  m.style.opacity='0';
  setTimeout(function(){ m.style.display='none'; },300);
  /* Garantir que o botão fica desativado após qualquer resultado */
  /* O utilizador tem de inserir o stake manualmente de novo */
  T.proposal=null;
  var execB=$('execBtn');
  if(execB) execB.disabled=true;
}

/* WS ERROR */
function onWsErr(d){
  if(!d.error) return;
  var code = d.error.code || '';
  var msg  = d.error.message || '';

  /* Erros de autenticação — forçar re-login */
  if(code==='InvalidToken' || code==='AuthorizationRequired' || code==='DisabledClient'){
    clearSession(); hideLoading(); showScreen('s-landing');
    toast('Sessão expirada', 'Faz login novamente', 'warn');
    return;
  }

  /* Rate limit — demasiados pedidos */
  if(code==='RateLimit' || msg.toLowerCase().includes('rate limit')){
    toast('Demasiados pedidos', 'Aguarda alguns segundos', 'warn');
    return;
  }

  /* Conta desactivada ou bloqueada */
  if(code==='AccountDisabled' || msg.toLowerCase().includes('disabled') || msg.toLowerCase().includes('blocked')){
    toast('Conta bloqueada', 'Contacta o suporte Deriv', 'error');
    clearSession(); hideLoading(); showScreen('s-landing');
    return;
  }

  /* Erros gerais — mostrar mensagem sem quebrar a app */
  if(msg) toast('Erro', msg, 'error');
}

/* DEPOSIT/WITHDRAW */
window.openDepositModal  = function(){ window.open('https://app.deriv.com/cashier/deposit','_blank'); };
window.openWithdrawModal = function(){ window.open('https://app.deriv.com/cashier/withdrawal','_blank'); };

/* COMMISSION WITHDRAW */
window.openCommissionWithdraw=function(){
  var e=$('cwAvailable'); if(e) e.textContent='$'+parseFloat(_fb.commission||0).toFixed(2);
  var m=$('commissionWithdrawModal'); if(m) m.classList.add('open');
};
window.closeCommissionWithdraw=function(){ var m=$('commissionWithdrawModal'); if(m) m.classList.remove('open'); };
window.submitCommissionWithdraw=function(){
  var amt=parseFloat($('cwAmt')&&$('cwAmt').value)||0;
  var mc=$('cwMulticaixa')&&$('cwMulticaixa').value||'';
  var wa=$('cwWhatsapp')&&$('cwWhatsapp').value||'';
  if(amt<5){ toast('Minimo $5.00','','error'); return; }
  if(!mc){ toast('Insere numero Multicaixa','','error'); return; }
  if(!wa){ toast('Insere numero WhatsApp','','error'); return; }
  if(window._db&&window._fsDoc&&window._fsSetDoc){
    /* Firestore Rules exigem: acct, amount, method, paymentAddress, status, createdAt */
    var reqId=Date.now()+'_'+S.acct;
    window._fsSetDoc(window._fsDoc(window._db,'withdrawal_requests',reqId),{
      acct: S.acct,
      amount: amt,
      method: 'multicaixa_express',
      paymentAddress: mc+' | WA:'+wa,
      status: 'pending',
      createdAt: Date.now()
    }).catch(function(e){ console.warn('withdraw err:',e); });
  }
  closeCommissionWithdraw();
  toast('Pedido enviado!','Contacto via WhatsApp no dia 1','success');
};

/* ═══════════════════════════════════════════════════════════
   SISTEMA DE REFERIDOS & COMISSÕES — AUTOMÁTICO
   ─────────────────────────────────────────────
   Firestore collections:
     referral_users/{acct}  → quem referiu este utilizador
     referrals/{partnerId}  → contadores e comissões do parceiro

   Fluxo:
     1. Utilizador abre link ?ref=PARCEIRO → guardado em localStorage
     2. Faz login com conta REAL → registo automático em referral_users
     3. A cada trade fechado → volume e comissão actualizados no parceiro
     4. Taxa varia por nível: Bronze 0.5%, Prata 0.8%, Ouro 1.1%, Diamante 1.4%
═══════════════════════════════════════════════════════════ */

var _fb = { commission:0, refCount:0, refPending:0, nickname:'', country:'AO' };

/* Tabela de níveis — igual ao parceiros.html */
var PARTNER_LEVELS = [
  { id:'bronze',  min:0,   rate:0.50 },
  { id:'silver',  min:15,  rate:0.80 },
  { id:'gold',    min:40,  rate:1.10 },
  { id:'diamond', min:100, rate:1.40 }
];

function _getPartnerRate(refCount) {
  var rate = PARTNER_LEVELS[0].rate;
  for (var i = PARTNER_LEVELS.length - 1; i >= 0; i--) {
    if (refCount >= PARTNER_LEVELS[i].min) { rate = PARTNER_LEVELS[i].rate; break; }
  }
  return rate;
}

/* ── 1. Capturar ?ref= ANTES do redirect OAuth ── */
(function(){
  var urlRef = new URLSearchParams(location.search).get('ref');
  if (urlRef) {
    try { localStorage.setItem('dw_pending_ref', urlRef); } catch(e){}
  }
})();

/* ── 2. Registar referido quando faz login com conta REAL ── */
function renderReferral(){
  /* Link de afiliado do utilizador para a secção "Referidos" no perfil */
  var link = location.origin + '/index.html?ref=' + S.acct;
  var el = $('referralLink'); if (el) el.textContent = link;

  /* Demo nunca conta */
  if (S.isDemo) return;
  if (!window._db || !S.acct) return;

  /* Obter ref: primeiro da URL, depois do localStorage */
  var urlRef = new URLSearchParams(location.search).get('ref')
    || (function(){ try { return localStorage.getItem('dw_pending_ref'); } catch(e){ return null; } })();

  if (!urlRef || urlRef === S.acct) return; /* sem ref ou auto-referência */

  var ruRef = window._fsDoc(window._db, 'referral_users', S.acct);
  window._fsGetDoc(ruRef).then(function(snap){
    if (snap.exists()) {
      /* Já registado — limpar localStorage e sair */
      try { localStorage.removeItem('dw_pending_ref'); } catch(e){}
      return;
    }

    /* Novo referido — guardar */
    return window._fsSetDoc(ruRef, {
      referredBy  : urlRef,
      acct        : S.acct,
      joinedAt    : Date.now(),
      totalVolume : 0,
      totalTrades : 0,
      isReal      : true
    }, { merge: true }).then(function(){

      /* Incrementar contador do parceiro */
      var refRef = window._fsDoc(window._db, 'referrals', urlRef);
      return window._fsGetDoc(refRef).then(function(snap2){
        var ex = snap2.exists() ? snap2.data() : { count:0, earned:0, pending:0, paid:0 };
        var newCount = (parseInt(ex.count) || 0) + 1;
        return window._fsSetDoc(refRef, {
          count   : newCount,
          earned  : parseFloat(ex.earned)  || 0,
          pending : parseFloat(ex.pending) || 0,
          paid    : parseFloat(ex.paid)    || 0
        }, { merge: true });
      });

    }).then(function(){
      try { localStorage.removeItem('dw_pending_ref'); } catch(e){}
      console.log('[DW] Referido registado:', S.acct, '→ parceiro:', urlRef);
    });

  }).catch(function(e){ console.warn('[DW] renderReferral err:', e.message); });
}

/* ── 3. A cada trade fechado — actualizar volume e comissão do parceiro ── */
function _commissionOnTrade(buyPrice) {
  /* Só conta em conta REAL */
  if (S.isDemo || !window._db || !S.acct) return;
  if (!buyPrice || buyPrice <= 0) return;

  var volume = parseFloat(buyPrice) || 0;

  /* Ler a quem este utilizador pertence */
  window._fsGetDoc(window._fsDoc(window._db, 'referral_users', S.acct))
    .then(function(snap){
      if (!snap.exists()) return; /* utilizador não é referido de ninguém */

      var ruData    = snap.data();
      var partnerId = ruData.referredBy;
      if (!partnerId) return;

      /* Actualizar volume acumulado deste utilizador */
      var newVolume = (parseFloat(ruData.totalVolume) || 0) + volume;
      var newTrades = (parseInt(ruData.totalTrades)   || 0) + 1;
      window._fsSetDoc(
        window._fsDoc(window._db, 'referral_users', S.acct),
        { totalVolume: newVolume, totalTrades: newTrades, lastTradeAt: Date.now() },
        { merge: true }
      ).catch(function(){});

      /* Calcular comissão a acrescentar ao parceiro */
      var refDoc = window._fsDoc(window._db, 'referrals', partnerId);
      window._fsGetDoc(refDoc).then(function(snap2){
        var ex       = snap2.exists() ? snap2.data() : { count:0, earned:0, pending:0, paid:0 };
        var refCount = parseInt(ex.count) || 0;
        var rate     = _getPartnerRate(refCount); /* taxa baseada no nível actual */
        var comm     = parseFloat((volume * rate / 100).toFixed(6));

        var newEarned  = parseFloat((parseFloat(ex.earned  || 0) + comm).toFixed(6));
        var newPending = parseFloat((parseFloat(ex.pending || 0) + comm).toFixed(6));

        return window._fsSetDoc(refDoc, {
          earned    : newEarned,
          pending   : newPending,
          updatedAt : Date.now()
        }, { merge: true });

      }).catch(function(e){ console.warn('[DW] commission update err:', e.message); });

    }).catch(function(){});
}

window.copyReferralLink = function(){
  var link = location.origin + '/index.html?ref=' + S.acct;
  navigator.clipboard.writeText(link)
    .then(function(){ toast('Link copiado!', '', 'success'); })
    .catch(function(){});
};

window.shareReferral = function(){
  var link = location.origin + '/index.html?ref=' + S.acct;
  var text = 'Opera na DynamicWorks Angola!\n\n' + link;
  if (navigator.share) navigator.share({ title:'DynamicWorks Angola', text:text, url:link }).catch(function(){});
  else window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
};

/* ═══════════════════════════════════════════════════════════
   FIREBASE REALTIME SYNC — onSnapshot em tudo
   Cada listener atualiza a UI automaticamente quando os dados
   mudam no Firestore, sem precisar de refresh ou polling.
═══════════════════════════════════════════════════════════ */

/* Guardar referências dos listeners para poder cancelar no logout */
var _fbListeners = [];

function _fbCancelListeners() {
  _fbListeners.forEach(function(unsub){ try{ unsub(); }catch(e){} });
  _fbListeners = [];
}

function loadFirebaseData(){
  if(!window._db||!S.acct) return;

  /* ── 1. SESSIONS (nickname, preferências) — tempo real ── */
  var unsubSession = window._fsOnSnapshot(
    window._fsDoc(window._db,'sessions',S.acct),
    function(snap){
      if(!snap.exists()) return;
      var d=snap.data();
      if(d.nickname && d.nickname !== _fb.nickname){
        _fb.nickname=d.nickname;
        var ni=$('nicknameInput'); if(ni) ni.value=d.nickname;
        _renderProfileAvatar(d.nickname);
        txt('profileName', d.nickname);
      }
      if(d.country){ _fb.country=d.country; }
      /* Mostrar país no perfil se existir */
      var ci=$('countryInput'); if(ci && d.country) ci.value=d.country;
      var cf=$('countryFlag'); if(cf && d.country) cf.textContent=_countryFlag(d.country);
    },
    function(e){ console.warn('[DW] sessions listener:', e.message); }
  );
  _fbListeners.push(unsubSession);

  /* ── 2. REFERRALS (comissões, contagem) — tempo real ── */
  var unsubRef = window._fsOnSnapshot(
    window._fsDoc(window._db,'referrals',S.acct),
    function(snap){
      if(!snap.exists()) return;
      var d=snap.data();
      _fb.commission=d.earned||0;
      _fb.refCount=d.count||0;
      _fb.refPending=d.pending||0;
      txt('refCount',_fb.refCount);
      txt('refEarned','$'+parseFloat(_fb.commission).toFixed(2));
      txt('refPending','$'+parseFloat(_fb.refPending).toFixed(2));
      /* Atualizar disponível no modal de saque */
      var cwA=$('cwAvailable'); if(cwA) cwA.textContent='$'+parseFloat(_fb.commission).toFixed(2);
    },
    function(e){ console.warn('[DW] referrals listener:', e.message); }
  );
  _fbListeners.push(unsubRef);

  /* ── 3. HISTORY (trades fechados) — tempo real ── */
  _fbListenHistory();

  /* ── 4. LEADERBOARD DIÁRIO — tempo real ── */
  _fbListenLeaderboard('daily');

  /* Carregar posições abertas guardadas (recuperação após reload) */
  fbLoadOpenPositions();
  renderReferral();
}

/* ── Listener do histórico de trades ── */
function _fbListenHistory(){
  if(!window._db||!S.acct) return;
  var unsubHist = window._fsOnSnapshot(
    window._fsDoc(window._db,'history',S.acct),
    function(snap){
      if(!snap.exists()) return;
      var d=snap.data();
      var fbEntries=(d.entries||[]).filter(function(h){
        return h && h.contract_id && h.underlying && h.sell_time>0;
      });
      if(!fbEntries.length) return;
      /* Atualizar _fbHistoryMap */
      fbEntries.forEach(function(h){ _fbHistoryMap[String(h.contract_id)]=h; });
      /* Mesclar com S.history sem duplicados */
      var existingIds={};
      S.history.forEach(function(h){ existingIds[String(h.contract_id)]=true; });
      var added=0;
      fbEntries.forEach(function(h){
        if(!existingIds[String(h.contract_id)]){
          S.history.push({
            contract_id:String(h.contract_id),
            underlying:h.underlying,
            profit:parseFloat(h.profit)||0,
            buy_price:parseFloat(h.buy_price)||0,
            growth_rate:parseFloat(h.growth_rate)||0,
            tick_count:parseInt(h.tick_count)||0,
            sell_time:parseInt(h.sell_time)||0
          });
          existingIds[String(h.contract_id)]=true;
          added++;
        } else {
          /* Atualizar entradas existentes */
          for(var i=0;i<S.history.length;i++){
            if(String(S.history[i].contract_id)===String(h.contract_id)){
              S.history[i]=Object.assign({},S.history[i],h); break;
            }
          }
        }
      });
      if(added>0 || fbEntries.length>0){
        S.history.sort(function(a,b){ return (b.sell_time||0)-(a.sell_time||0); });
        if(S.history.length>100) S.history=S.history.slice(0,100);
        renderHistory(); updateStats();
      }
    },
    function(e){ console.warn('[DW] history listener:', e.message); }
  );
  _fbListeners.push(unsubHist);
}

/* ── Listener do leaderboard em tempo real ── */
var _lbActiveMode = 'daily';
var _lbUnsubscribers = []; /* listeners de leaderboard separados para trocar entre daily/weekly */

function _fbListenLeaderboard(mode){
  /* Cancelar listeners de leaderboard anteriores */
  _lbUnsubscribers.forEach(function(u){ try{u();}catch(e){} });
  _lbUnsubscribers=[];
  _lbActiveMode=mode;
  if(!window._db) return;

  var col, q;
  if(mode==='weekly'){
    var wk=_getWeekKey();
    q=window._fsQuery(window._fsCollection(window._db,'leaderboard_weekly'),
      window._fsWhere('week','==',wk),
      window._fsOrderBy('pnl','desc'),
      window._fsLimit(10));
  } else {
    var today=new Date().toISOString().slice(0,10);
    q=window._fsQuery(window._fsCollection(window._db,'leaderboard'),
      window._fsWhere('date','==',today),
      window._fsOrderBy('pnl','desc'),
      window._fsLimit(10));
  }

  var unsub = window._fsOnSnapshot(q,
    function(snap){ _renderLeaderboardSnap(snap, mode); },
    function(e){ console.warn('[DW] leaderboard listener:', e.message); }
  );
  _lbUnsubscribers.push(unsub);
  _fbListeners.push(unsub);
}

function _getWeekKey(){
  var d=new Date(),day=d.getDay(),diff=d.getDate()-day+(day===0?-6:1);
  var mon=new Date(new Date(d).setDate(diff));
  return mon.toISOString().slice(0,10);
}

function loadLeaderboard(mode){
  /* Delegar para o listener em tempo real */
  _fbListenLeaderboard(mode||'daily');
}

function _renderLeaderboardSnap(snap, mode){
  var el=$('leaderboardList'); if(!el) return;
  if(snap.empty){
    el.innerHTML='<div class="lb-loading">Sê o primeiro '+(mode==='weekly'?'esta semana':'hoje')+'! 🏆</div>';
    return;
  }
  var medals=['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'], rank=0, h='';
  snap.forEach(function(doc){
    var d=doc.data();
    var val=parseFloat(d.pnl||d.profit||0);
    var mine=(d.acct===S.acct);
    var nick=d.nickname||'';
    if(!nick||nick.match(/^[0-9]+$/)){ rank++; return; }
    var flag=_countryFlag(d.country||'AO');
    var initial=nick.charAt(0).toUpperCase();
    var avatarBg=mine?'background:#00d4ff;color:#000':'background:rgba(255,255,255,.1);color:var(--text)';
    h+='<div class="lb-row'+(mine?' lb-mine':'')+'">'
      +'<span class="lb-medal">'+medals[rank]+'</span>'
      +'<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;font-size:.72rem;font-weight:900;flex-shrink:0;'+avatarBg+'">'+initial+'</span>'
      +'<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem;font-weight:700">'
      +(mine?'👤 Tu':nick)+' <span style="font-size:.85rem">'+flag+'</span>'
      +'</span>'
      +'<span style="font-family:var(--mono);font-weight:800;font-size:.82rem;color:'+(val>=0?'var(--green)':'var(--red)')+';">'+(val>=0?'+':'')+val.toFixed(2)+'$</span>'
      +'</div>';
    if(mine){ show('myRankRow'); txt('myRankVal','#'+(rank+1)); }
    rank++;
  });
  el.innerHTML=h||'<div class="lb-loading">Sem traders com nickname neste período.</div>';
}
/* Compatibilidade — fallback com getDocs */
function _renderLeaderboard(q,field,mode){
  window._fsGetDocs(q).then(function(snap){ _renderLeaderboardSnap(snap,mode||'daily'); }).catch(function(){});
}

window.switchLeaderboard=function(mode,btnEl){
  document.querySelectorAll('.lb-tab').forEach(function(b){ b.classList.remove('active'); });
  if(btnEl) btnEl.classList.add('active');
  var mapped = (mode==='day'||mode==='daily') ? 'daily' : 'weekly';
  /* Trocar para novo listener em tempo real */
  _fbListenLeaderboard(mapped);
};
window.switchLbTab=window.switchLeaderboard;

function fbUpdateRanking(profit){
  if(!window._db||!S.acct) return;
  if(S.isDemo) return; /* Contas demo nunca entram no ranking */
  var uid=S.acct;
  /* NUNCA usar o ID da conta como nome — só guardar se tiver nickname real */
  var nick=_fb.nickname||null;
  if(!nick) return; /* Sem nickname → não aparece no ranking até definir um */
  var today=new Date().toISOString().slice(0,10);
  var weekKey=_getWeekKey();

  /* ── Ranking diário ── */
  var refDay=window._fsDoc(window._db,'leaderboard',today+'_'+uid);
  window._fsGetDoc(refDay).then(function(snap){
    var ex=snap.exists()?snap.data():{pnl:0,trades:0};
    var newPnl=(parseFloat(ex.pnl||ex.profit)||0)+(profit||0);
    return window._fsSetDoc(refDay,{acct:uid,date:today,pnl:newPnl,nickname:nick,country:_fb.country||'AO',trades:(ex.trades||0)+1});
  }).catch(function(e){ console.warn('lb daily:',e.message); });

  /* ── Ranking semanal ── */
  var refWeek=window._fsDoc(window._db,'leaderboard_weekly',weekKey+'_'+uid);
  window._fsGetDoc(refWeek).then(function(snap){
    var ex=snap.exists()?snap.data():{pnl:0,trades:0};
    var newPnl=(parseFloat(ex.pnl)||0)+(profit||0);
    return window._fsSetDoc(refWeek,{acct:uid,week:weekKey,pnl:newPnl,nickname:nick,country:_fb.country||'AO',trades:(ex.trades||0)+1});
  }).catch(function(e){ console.warn('lb weekly:',e.message); });
}

/* RANKING SEMANAL TOP 10 — view dedicada */
window.loadWeeklyRanking=function(){
  var el=$('weeklyRankList'); if(!el) return;
  el.innerHTML='<div class="lb-loading">A carregar...</div>';
  var podEl=$('weeklyPodium'); if(podEl) podEl.innerHTML='<div class="wr-pod-loading">A carregar pódio...</div>';
  if(!window._db){ el.innerHTML='<div class="lb-loading">Firebase não disponível.</div>'; return; }
  var wk=_getWeekKey();
  var dl=$('weeklyRankDate'); if(dl) dl.textContent='Semana de '+wk;
  var q=window._fsQuery(
    window._fsCollection(window._db,'leaderboard_weekly'),
    window._fsWhere('week','==',wk),
    window._fsOrderBy('pnl','desc'),
    window._fsLimit(20)
  );
  /* Cancelar listener anterior do ranking semanal se existir */
  if(window._wrUnsub){ try{window._wrUnsub();}catch(e){} }
  window._wrUnsub = window._fsOnSnapshot(q,
    function(snap){
      var traders=[];
      snap.forEach(function(doc){
        var d=doc.data();
        var nick=d.nickname||'';
        if(nick && !nick.match(/^[0-9]+$/)) traders.push(d);
      });
      var top=traders.slice(0,10);

      if(top.length===0){
        if(podEl) podEl.innerHTML='<div class="wr-pod-loading">Nenhum trader com nome esta semana.<br><small style="font-size:.65rem;opacity:.6">Define o teu nickname no Perfil para aparecer aqui.</small></div>';
        el.innerHTML='<div class="lb-loading">Sê o primeiro esta semana! 🏆<br><small style="font-size:.65rem;color:var(--text3)">Vai ao Perfil → define o teu nome → opera.</small></div>';
        return;
      }

      /* Pódio Top 3 */
      if(podEl && top.length>0){
        var podOrder=[1,0,2];
        var podClasses=['p2','p1','p3'];
        var podMedals=['🥈','🥇','🥉'];
        var podLabels=['2º','1º','3º'];
        var podH='';
        podOrder.forEach(function(idx,vi){
          var t=top[idx]; if(!t) return;
          var val=parseFloat(t.pnl||0);
          var nick=t.nickname||'?';
          var flag=_countryFlag(t.country||'AO');
          var initial=nick.charAt(0).toUpperCase();
          var mine=(t.acct===S.acct);
          podH+='<div class="wr-pod-item '+podClasses[vi]+'">'
            +'<div class="wr-pod-medal">'+podMedals[vi]+'</div>'
            +'<div class="wr-pod-avatar" style="'+(mine?'background:var(--accent);color:#000':'')+'">'+initial+'</div>'
            +'<div class="wr-pod-nick">'+(mine?'Tu':nick)+'</div>'
            +'<div style="font-size:.85rem;line-height:1;margin-bottom:.1rem">'+flag+'</div>'
            +'<div class="wr-pod-pnl '+(val>=0?'green':'red')+'">'+(val>=0?'+':'')+val.toFixed(2)+'$</div>'
            +'<div class="wr-pod-base">'+podLabels[vi]+'</div>'
            +'</div>';
        });
        podEl.innerHTML=podH||'<div class="wr-pod-loading">Pódio indisponível.</div>';
      }

      var listH='', myRankNum=-1;
      top.forEach(function(t,idx){
        var val=parseFloat(t.pnl||0);
        var mine=t.acct===S.acct;
        if(mine) myRankNum=idx+1;
        var nick=t.nickname||'?';
        var flag=_countryFlag(t.country||'AO');
        var initial=nick.charAt(0).toUpperCase();
        var trades=t.trades||0;
        if(idx<3) return;
        listH+='<div class="wr-row'+(mine?' wr-mine':'')+'">'
          +'<div class="wr-rank">'+(idx+1)+'º</div>'
          +'<div class="wr-avatar" style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:900;flex-shrink:0;'+(mine?'background:var(--accent);color:#000':'background:rgba(255,255,255,.1);color:var(--text)')+'">'+initial+'</div>'
          +'<div class="wr-info">'
          +'<div class="wr-nick">'+(mine?'👤 Tu':nick)+' '+flag+'</div>'
          +'<div class="wr-trades">'+trades+' operações</div>'
          +'</div>'
          +'<div class="wr-pnl '+(val>=0?'green':'red')+'">'+(val>=0?'+':'')+val.toFixed(2)+'<span>$</span></div>'
          +'</div>';
      });
      el.innerHTML=listH||'<div style="font-size:.72rem;color:var(--text3);text-align:center;padding:.75rem">Top 3 exibido acima ↑</div>';

      var myRankEl=$('weeklyMyRank');
      if(myRankEl){
        myRankEl.style.display=myRankNum>0?'flex':'none';
        if(myRankNum>0){ var mv=$('weeklyMyRankVal'); if(mv) mv.textContent='#'+myRankNum; }
      }
    },
    function(e){
      if(el) el.innerHTML='<div class="lb-loading">Erro ao carregar.</div>';
      if(podEl) podEl.innerHTML='<div class="wr-pod-loading">Erro.</div>';
      console.warn('weeklyRanking err:',e);
    }
  );
}
window.onNicknameInput=function(el){
  var btn=$('nicknameSaveBtn'); if(btn) btn.disabled=el.value.trim().length<2;
  var prev=$('nicknameAvatarPreview');
  if(prev) prev.textContent=(el.value.trim().charAt(0)||'?').toUpperCase();
};

window.onCountryInput=function(el){
  var flag=$('countryFlag');
  if(flag) flag.textContent=_countryFlag(el.value);
  /* Activar botão guardar se já tem nickname */
  var ni=$('nicknameInput');
  var btn=$('nicknameSaveBtn');
  if(btn && ni && ni.value.trim().length>=2) btn.disabled=false;
};

window.saveNickname=function(){
  var ni=$('nicknameInput'); if(!ni) return;
  var nick=ni.value.trim().replace(/[<>"'&]/g,''); if(nick.length<2||!S.acct) return;
  var ci=$('countryInput');
  var country=(ci&&ci.value)?ci.value:'AO';
  _fb.nickname=nick;
  _fb.country=country;
  _renderProfileAvatar(nick);
  if(window._db){
    window._fsSetDoc(window._fsDoc(window._db,'sessions',S.acct),
      {nickname:nick,country:country,acct:S.acct,updatedAt:Date.now()},{merge:true}).catch(function(){});
    _fbPropagateNickname(nick,country);
  }
  var cf=$('countryFlag'); if(cf) cf.textContent=_countryFlag(country);
  var ok=$('nicknameOk'); if(ok){ ok.style.display='flex'; setTimeout(function(){ ok.style.display='none'; },2500); }
  var btn=$('nicknameSaveBtn'); if(btn) btn.disabled=true;
  toast('Perfil guardado!','Apareceràs como "'+nick+'" '+_countryFlag(country)+' no ranking','success');
};

/* Converter código de país em emoji de bandeira */
function _countryFlag(code){
  if(!code||code.length!==2) return '🌍';
  try {
    return String.fromCodePoint(
      code.toUpperCase().charCodeAt(0)-65+127462,
      code.toUpperCase().charCodeAt(1)-65+127462
    );
  } catch(e){ return '🌍'; }
}

/* Atualizar inicial/nome nos elementos de avatar do perfil */
function _renderProfileAvatar(nick){
  /* Usar textContent (nunca innerHTML) para nomes de utilizador — previne XSS */
  var safeNick = (nick||'').replace(/[<>"'&]/g,'');
  var initial=(safeNick||S.acct||'?').charAt(0).toUpperCase();
  document.querySelectorAll('.profile-avatar-letter').forEach(function(el){ el.textContent=initial; });
  document.querySelectorAll('.profile-nickname-display').forEach(function(el){ el.textContent=safeNick||S.acct; });
  var ni=$('nicknameAvatarPreview'); if(ni) ni.textContent=initial;
}

/* Propagar nickname e país para documentos de ranking já criados hoje/esta semana */
function _fbPropagateNickname(nick, country){
  if(!window._db||!S.acct) return;
  var uid=S.acct, today=new Date().toISOString().slice(0,10), wk=_getWeekKey();
  var payload={nickname:nick};
  if(country) payload.country=country;
  [
    window._fsDoc(window._db,'leaderboard',today+'_'+uid),
    window._fsDoc(window._db,'leaderboard_weekly',wk+'_'+uid)
  ].forEach(function(ref){
    window._fsGetDoc(ref).then(function(snap){
      if(snap.exists()) return window._fsSetDoc(ref,payload,{merge:true});
    }).catch(function(){});
  });
};

/* LESSONS */
var LESSONS=[
  {level:'beginner',    title:'O que são Accumulators?',          desc:'O preço precisa ficar dentro de um intervalo por cada tick. A cada tick que fica dentro, o teu lucro cresce pela taxa escolhida.',icon:'A'},
  {level:'beginner',    title:'Taxa de crescimento: 1% a 5%',     desc:'1% = barreira mais larga (mais seguro, menos lucro). 5% = barreira muito apertada (mais lucro, mais risco). Começa com 1% ou 2%.',icon:'%'},
  {level:'beginner',    title:'Como usar o Take Profit',          desc:'Define o objetivo de lucro (ex: $2 com stake de $10) e fecha automaticamente. Isso protege os teus ganhos.',icon:'T'},
  {level:'beginner',    title:'Pares recomendados para iniciantes',desc:'Usa sempre V10 ou V10(1s) para começar. São os mais estáveis e têm barreiras mais largas. Evita V75 e V100.',icon:'P'},
  {level:'intermediate',title:'Estratégia DW: Crescimento Seguro', desc:'REGRA DE OURO: Usa V10, taxa 1%, stake fixo de 5% do saldo. Define TP de 20-30% do stake. Faz 5-10 trades/dia. Com $100, usa $5/trade e TP $1–1.50.',icon:'S'},
  {level:'intermediate',title:'Estratégia DW: Acumulação Composta',desc:'Começa com $1. Cada win, reinveste 50% do lucro. Mantém TP em 30%. Com disciplina, $10 pode virar $50 em dias bons sem grande risco.',icon:'C'},
  {level:'intermediate',title:'Gestão de risco — A regra dos 3%',  desc:'Nunca arrisques mais de 3% do saldo num único trade. Com $100 → máximo $3 por entrada. Isto protege-te de perdas grandes.',icon:'G'},
  {level:'intermediate',title:'Quando NÃO entrar no mercado',      desc:'Evita abrir trades logo após grandes spikes (picos). Espera que o preço estabilize no centro do intervalo antes de entrar.',icon:'⚠'},
  {level:'advanced',    title:'Estratégia de Recuperação',         desc:'Após 2 perdas seguidas: para 5 minutos, muda para V10 taxa 1%, reduz o stake 50%. Nunca dupliques o stake para recuperar — é o maior erro.',icon:'R'},
  {level:'advanced',    title:'Multi-contrato inteligente',        desc:'Abre 2 contratos pequenos em vez de 1 grande. Ex: 2x $5 em vez de 1x $10. Se um perde, o outro pode compensar. Usa pares diferentes.',icon:'M'},
  {level:'advanced',    title:'Leitura do Accumulator Meter',      desc:'Quando a barra está no centro (40-60%), é seguro entrar. Perto das extremidades (abaixo de 15% ou acima de 85%), há risco de knock-out.',icon:'📊'},
];
var LVLABEL={beginner:'Iniciante',intermediate:'Intermédio',advanced:'Avançado'};
window.filterLessons=function(level,btn){
  document.querySelectorAll('.edu-cat').forEach(function(b){ b.classList.remove('active'); });
  if(btn) btn.classList.add('active');
  renderLessons(level);
};
function renderLessons(filter){
  var el=$('lessonsList'); if(!el) return;
  var list=(!filter||filter==='all')?LESSONS:LESSONS.filter(function(l){ return l.level===filter; });
  el.innerHTML=list.map(function(l){
    return '<div class="lesson-card"><div class="lesson-ico">'+l.icon+'</div><div class="lesson-body"><div class="lesson-badge lesson-'+l.level+'">'+LVLABEL[l.level]+'</div><div class="lesson-title">'+l.title+'</div><div class="lesson-desc">'+l.desc+'</div></div></div>';
  }).join('')||'<div style="padding:1rem;color:var(--text3)">Sem licoes.</div>';
}

/* ══════════════════════════════════════════════════
   ONBOARDING TOUR — v2.0 — Spotlight real + animações
══════════════════════════════════════════════════ */
var _tourStep = 0;
var _tourActive = false;
var _tourScrollLock = null;

var _tourSteps = [
  {
    target  : null,
    icon    : '👋',
    title   : 'Bem-vindo ao DynamicWorks!',
    body    : 'A plataforma de <strong>Accumulators Deriv #1 em Angola</strong>.<br>Vamos mostrar-te tudo em 30 segundos.',
    cardPos : 'center'
  },
  {
    target  : 'bnChart',
    icon    : '📊',
    title   : 'Gráfico em Tempo Real',
    body    : 'Vês o preço e as <strong>barreiras do Accumulator</strong>.<br>O preço tem de ficar na zona verde para cresceres.',
    cardPos : 'top'
  },
  {
    target  : 'bnTrade',
    icon    : '⚡',
    title   : 'Abre um Trade',
    body    : 'Escolhe o activo, a <strong>taxa 1%–5%</strong> e o stake.<br>Activa o Take Profit para fechar com lucro automaticamente.',
    cardPos : 'top'
  },
  {
    target  : 'bnPos',
    icon    : '💼',
    title   : 'As Tuas Operações',
    body    : 'Contratos abertos e <strong>histórico completo</strong>.<br>Acompanha lucros e fecha contratos manualmente.',
    cardPos : 'top'
  },
  {
    target  : 'bnEdu',
    icon    : '🎓',
    title   : 'Centro de Aprendizagem',
    body    : 'Estratégias, lições e <strong>tutoriais em vídeo</strong> gratuitos.<br>Do iniciante ao avançado — tudo aqui.',
    cardPos : 'top'
  },
  {
    target  : 'bnProfile',
    icon    : '🏆',
    title   : 'Perfil e Ranking',
    body    : 'Escolhe um <strong>nickname</strong> e entra no Top 10!<br>Compete com os melhores traders angolanos.',
    cardPos : 'top'
  },
  {
    target  : null,
    icon    : '🚀',
    title   : 'Tudo pronto!',
    body    : 'Começa com a <strong>conta Demo — $10.000 virtuais</strong>.<br>Sem risco. Pratica até teres confiança.',
    cardPos : 'center',
    isLast  : true
  }
];

window.tourStart = function() {
  if (localStorage.getItem('dw_tour_done')) return;
  var ov = $('dwTourOverlay'); if(!ov) return;
  _tourActive = true;
  _tourStep = 0;
  ov.style.display = 'block';
  /* Bloquear scroll da página durante o tour */
  _tourScrollLock = document.body.style.overflow;
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(function(){ _tourRender(true); });
};

window.tourEnd = function() {
  _tourActive = false;
  var ov = $('dwTourOverlay');
  if(ov) {
    ov.style.opacity = '0';
    ov.style.transition = 'opacity .25s';
    setTimeout(function(){
      ov.style.display = 'none';
      ov.style.opacity = '';
      ov.style.transition = '';
      ov.innerHTML = '';
    }, 250);
  }
  /* Restaurar scroll */
  if(_tourScrollLock !== null) document.body.style.overflow = _tourScrollLock;
  localStorage.setItem('dw_tour_done', '1');

  /* FCM após tour — utilizador engajado */
  setTimeout(function() {
    if (window._initPushNotifications) {
      window._initPushNotifications();
    }
  }, 1500);
};

window.tourNext = function() {
  _tourStep++;
  if(_tourStep >= _tourSteps.length){ tourEnd(); return; }
  _tourRender(false);
};

window.tourPrev = function() {
  if(_tourStep <= 0) return;
  _tourStep--;
  _tourRender(false);
};

function _tourGetRect(id) {
  var el = id ? $(id) : null;
  if(!el) return null;
  var r = el.getBoundingClientRect();
  if(r.width === 0 && r.height === 0) return null;
  return r;
}

function _tourRender(isFirst) {
  var ov = $('dwTourOverlay'); if(!ov) return;
  var step  = _tourSteps[_tourStep];
  var total = _tourSteps.length;
  var isLast = !!step.isLast || _tourStep === total - 1;
  var rect  = _tourGetRect(step.target);
  var PAD   = 10;

  /* ── Dots de progresso ── */
  var dots = '';
  for(var i = 0; i < total; i++) {
    dots += '<div style="width:'+(i===_tourStep?'20px':'7px')+';height:7px;border-radius:4px;background:'+(i===_tourStep?'#00d4ff':'rgba(255,255,255,.2)')+';transition:all .25s;flex-shrink:0"></div>';
  }

  /* ── Posição do card ── */
  var vH = window.innerHeight;
  var vW = window.innerWidth;
  var cardW = Math.min(vW - 32, 360);

  /* Card centrado verticalmente se não há target */
  var cardTop, cardLeft;
  if(!rect || step.cardPos === 'center') {
    cardTop  = Math.round(vH / 2 - 120);
    cardLeft = Math.round(vW / 2 - cardW / 2);
  } else {
    /* Card sempre acima da barra de navegação */
    cardTop  = Math.round(vH * 0.28);
    cardLeft = Math.round(vW / 2 - cardW / 2);
  }

  /* ── SVG para o buraco do spotlight ── */
  var svgHole = '';
  if(rect) {
    var hx = Math.round(rect.left - PAD);
    var hy = Math.round(rect.top  - PAD);
    var hw = Math.round(rect.width  + PAD*2);
    var hh = Math.round(rect.height + PAD*2);
    svgHole = '<svg style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1">'
      + '<defs><mask id="twMask"><rect width="100%" height="100%" fill="white"/>'
      + '<rect x="'+hx+'" y="'+hy+'" width="'+hw+'" height="'+hh+'" rx="12" fill="black"/>'
      + '</mask></defs>'
      + '<rect width="100%" height="100%" fill="rgba(2,5,15,.82)" mask="url(#twMask)"/>'
      /* Borda animada do spotlight */
      + '<rect x="'+hx+'" y="'+hy+'" width="'+hw+'" height="'+hh+'" rx="12"'
      + ' fill="none" stroke="#00d4ff" stroke-width="2" stroke-opacity=".8"'
      + ' style="animation:dwTourPulse 1.6s ease-in-out infinite"/>'
      + '</svg>';
  } else {
    svgHole = '<div style="position:fixed;inset:0;background:rgba(2,5,15,.75);pointer-events:none;z-index:1"></div>';
  }

  /* ── Seta indicando o elemento ── */
  var arrow = '';
  if(rect) {
    /* Seta aponta para baixo (em direcção à nav bar) */
    var arrowX = Math.round(rect.left + rect.width/2);
    var arrowY = Math.round(rect.top - PAD - 18);
    arrow = '<div style="position:fixed;left:'+arrowX+'px;top:'+arrowY+'px;transform:translateX(-50%);z-index:10002;'
      + 'animation:dwArrowBounce .7s ease-in-out infinite alternate;font-size:1.3rem;line-height:1">▼</div>';
  }

  /* ── Card HTML ── */
  var prevBtn = _tourStep > 0
    ? '<button onclick="tourPrev()" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:.5rem .8rem;font-size:.72rem;font-weight:600;color:rgba(255,255,255,.5);cursor:pointer;white-space:nowrap">← Anterior</button>'
    : '<button onclick="tourEnd()" style="background:transparent;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:.5rem .85rem;font-size:.72rem;font-weight:600;color:rgba(255,255,255,.35);cursor:pointer;white-space:nowrap">Saltar</button>';

  var card = '<div class="dw-tour-card" style="position:fixed;left:'+cardLeft+'px;top:'+cardTop+'px;width:'+cardW+'px;z-index:10003;animation:'+(isFirst?'dwTourPop':'dwTourSlide')+' .22s cubic-bezier(.34,1.4,.64,1) both">'
    /* Dots */
    + '<div style="display:flex;gap:5px;justify-content:center;margin-bottom:.85rem">' + dots + '</div>'
    /* Ícone */
    + '<div style="font-size:2rem;text-align:center;margin-bottom:.5rem;line-height:1">' + step.icon + '</div>'
    /* Título */
    + '<div style="font-size:1rem;font-weight:900;color:#fff;text-align:center;margin-bottom:.45rem;letter-spacing:-.01em">' + step.title + '</div>'
    /* Corpo */
    + '<div style="font-size:.82rem;color:rgba(255,255,255,.72);line-height:1.65;text-align:center;margin-bottom:1rem">' + step.body + '</div>'
    /* Acções */
    + '<div style="display:flex;gap:.6rem;align-items:center">'
    + prevBtn
    + '<button onclick="tourNext()" style="flex:1;background:linear-gradient(135deg,#00d4ff,#0099bb);border:none;border-radius:10px;padding:.6rem 1rem;font-size:.82rem;font-weight:900;color:#000;cursor:pointer;box-shadow:0 4px 14px rgba(0,212,255,.3)">'
    + (isLast ? '✓ Vamos lá!' : 'Próximo →')
    + '</button>'
    + '</div>'
    + '</div>';

  ov.innerHTML = svgHole + arrow + card;
}

/* ── EDUCATION TAB SWITCHING ── */
window.switchEduTab=function(tab,btnEl){
  document.querySelectorAll('.edu-main-tab').forEach(function(b){ b.classList.remove('active'); });
  document.querySelectorAll('.edu-tab-content').forEach(function(p){ p.classList.remove('active'); });
  if(btnEl) btnEl.classList.add('active');
  var panels={strategy:'eduPanelStrategy',pairs:'eduPanelPairs',lessons:'eduPanelLessons',videos:'eduPanelVideos'};
  var p=$(panels[tab]); if(p) p.classList.add('active');
  if(tab==='lessons') renderLessons('all');
  if(tab==='videos' && window.lucide) lucide.createIcons();
};

/* ── TAKE PROFIT CALCULATOR ── */
window.calcTP=function(){
  var stake=parseFloat($('calcStake')&&$('calcStake').value)||10;
  var pct=parseFloat($('calcPct')&&$('calcPct').value)||40;
  var tp=(stake*pct/100).toFixed(2);
  var res=$('calcResult');
  if(res) res.innerHTML='Take Profit sugerido: <strong style="color:var(--green)">$'+tp+'</strong> — fecha quando lucro chegar a $'+tp+' ('+pct+'% do stake)';
};

/* ── APPLY PAIR FROM GUIDE ── */
window.applyPairFromGuide=function(sym){
  var a=ASSETS.find(function(x){ return x.sym===sym; });
  if(!a){ toast('Par não encontrado','','error'); return; }
  S.asset=a;
  txt('chAsset',a.name); txt('tradeAssetName',a.name);
  var pr=S.prices[sym];
  if(pr){ txt('chPrice',pr.p.toFixed(a.pip)); txt('tradeAssetPrice',pr.p.toFixed(a.pip)); txt('spotNow',pr.p.toFixed(a.pip)); }
  if(typeof renderAssetList==='function') renderAssetList();
  goToView('v-trade',$('bnTrade'));
  toast('Par selecionado!',a.name+' — pronto para operar','success');
};

/* ══════════════════════════════════
   TESTEMUNHOS NA LANDING (Firebase)
══════════════════════════════════ */
window._loadLandingTestimonials = function() {
  if (!window._db || !window._fsGetDocs) return;
  var scroll   = document.getElementById('landTestiScroll');
  var section  = document.getElementById('landTestiSection');
  if (!scroll || !section) return;

  try {
    var q = window._fsQuery(
      window._fsCollection(window._db, 'testimonials'),
      window._fsWhere('approved', '==', true),
      window._fsOrderBy('createdAt', 'desc'),
      window._fsLimit(10)
    );
    window._fsGetDocs(q).then(function(snap) {
      if (!snap || snap.empty) return;
      section.style.display = 'block';
      var colors = [
        'linear-gradient(135deg,#00d4ff,#6c3fff)',
        'linear-gradient(135deg,#00e676,#0099bb)',
        'linear-gradient(135deg,#ffc107,#ff6b35)',
        'linear-gradient(135deg,#a78bfa,#6c3fff)',
        'linear-gradient(135deg,#ff3d5a,#ff6b35)'
      ];
      var html = snap.docs.map(function(d, i) {
        var data = d.data();
        var stars = parseInt(data.stars || 5);
        var starsHtml = '★'.repeat(stars) + '<span style="opacity:.3">★</span>'.repeat(5 - stars);
        var initial = (data.nickname || '?').charAt(0).toUpperCase();
        var color   = colors[i % colors.length];
        return '<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:1rem;min-width:265px;flex-shrink:0;display:flex;flex-direction:column;gap:.6rem;scroll-snap-align:start">'
          + '<div style="color:#ffc107;font-size:.9rem">' + starsHtml + '</div>'
          + '<div style="font-size:.74rem;color:var(--text2);line-height:1.68;flex:1;font-style:italic">&ldquo;' + esc(data.text || '') + '&rdquo;</div>'
          + '<div style="display:flex;align-items:center;gap:.6rem">'
          + '<div style="width:34px;height:34px;border-radius:50%;background:' + color + ';display:flex;align-items:center;justify-content:center;font-size:.88rem;font-weight:900;color:#fff;flex-shrink:0">' + initial + '</div>'
          + '<div><div style="font-size:.78rem;font-weight:700;color:var(--text)">' + esc(data.nickname || 'Trader') + '</div>'
          + '<div style="font-size:.6rem;color:var(--text3);margin-top:.06rem">📍 ' + esc(data.location || 'Angola') + '</div></div>'
          + '</div></div>';
      }).join('');
      scroll.innerHTML = html;
    }).catch(function() {});
  } catch(e) {}
};

/* INIT */
document.addEventListener('DOMContentLoaded',function(){
  /* Sincronizar taxa de câmbio do Firebase */
  if(window._taxaUsdAoa && window._taxaUsdAoa !== TAXA_AOA) TAXA_AOA=window._taxaUsdAoa;
  /* Escutar atualizações futuras da taxa (Firebase pode demorar a responder) */
  window.addEventListener('app-ready', function(){
    if(window._taxaUsdAoa && window._taxaUsdAoa !== TAXA_AOA){
      TAXA_AOA=window._taxaUsdAoa;
      if(S.loggedIn) renderBalance();
    }
  }, { once: true });
  if(loadSession()){ setLoading('A conectar...'); wsConnect(); }
  else{
    hideLoading(); showScreen('s-landing');
    /* Carregar testemunhos reais na landing */
    if(window._appReady) window._loadLandingTestimonials();
    else window.addEventListener('app-ready', function(){ window._loadLandingTestimonials(); }, {once:true});
  }
  if(window.lucide) lucide.createIcons();
});

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
window.prices=S.prices;
window.sel=S.asset;