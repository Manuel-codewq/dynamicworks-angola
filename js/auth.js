/* ═══════════════════════════════════════════════════════════
   DynamicWorks Angola — auth.js
   OAuth Deriv, registo (new_account_virtual), verificação
   de código, sessão, tour onboarding.
═══════════════════════════════════════════════════════════ */
'use strict';

/* ── Guardar código ANTES do redirect (Customer.io) ── */
(function(){
  try{
    var urlParams=new URLSearchParams(window.location.search);
    var code=urlParams.get('code');
    if(code&&code.length>=4){
      sessionStorage.setItem('dw_pending_verification_code',code);
      var cleanUrl=window.location.pathname+(window.location.hash||'');
      history.replaceState(null,'',cleanUrl);
    }
  }catch(e){}
})();

function extractVerificationCode(){
  try{
    var urlParams=new URLSearchParams(window.location.search);
    var code=urlParams.get('code');
    if(code&&code.length>=4) return code;
    code=sessionStorage.getItem('dw_pending_verification_code');
    if(code&&code.length>=4){ sessionStorage.removeItem('dw_pending_verification_code'); return code; }
    if(window.location.hash){ var hp=new URLSearchParams(window.location.hash.replace('#','')); code=hp.get('code'); if(code&&code.length>=4) return code; }
    var m=window.location.href.match(/[?&#]code=([A-Za-z0-9_\-]{4,32})/i); if(m&&m[1]) return m[1];
    return null;
  }catch(e){ return null; }
}

window.addEventListener('DOMContentLoaded',function(){
  try{
    var code=extractVerificationCode();
    var params=new URLSearchParams(location.search);
    if(code){
      window._pendingRegCode=code;
      var emailParam=params.get('email'); if(emailParam) window._pendingRegEmail=decodeURIComponent(emailParam);
      history.replaceState(null,'',location.pathname);
      var modal=document.getElementById('registerModal');
      if(modal&&modal.classList.contains('open')){
        var inp=document.getElementById('regCode');
        if(inp){ inp.value=code; var hint=document.getElementById('regCodeHint'); if(hint) hint.style.display='flex'; }
      }else{
        setTimeout(function(){ var isLogged=(sessionStorage.getItem('dw_oauth_token')||'').length>0; if(!isLogged) window.openRegister(); },800);
      }
    }
  }catch(e){}
});

/* ── MODAL DE REGISTO ── */
var _regWs=null, _regEmail='', _regPassword='';

function regShowStep(n){ [1,2,3,4].forEach(function(i){ var el=document.getElementById('regStep'+i); if(el) el.style.display=(i===n)?'block':'none'; }); if(window.lucide) lucide.createIcons(); }
window.closeRegisterModal=function(){ var m=document.getElementById('registerModal'); if(m) m.classList.remove('open'); if(_regWs){try{_regWs.close();}catch(e){}_regWs=null;} };
window.openRegister=function(){
  var m=document.getElementById('registerModal'); if(m) m.classList.add('open');
  if(window._pendingRegCode){
    regShowStep(2);
    setTimeout(function(){
      var inp=document.getElementById('regCode'); if(inp) inp.value=window._pendingRegCode;
      var hint=document.getElementById('regCodeHint'); if(hint) hint.style.display='flex';
      if(window._pendingRegEmail){ var emailInp=document.getElementById('regEmail'); if(emailInp) emailInp.value=window._pendingRegEmail; window._pendingRegEmail=null; }
      window._pendingRegCode=null;
    },100);
  }else{ regShowStep(1); }
  if(window.lucide) lucide.createIcons();
};

window.checkRegPassword=function(val){
  var s=document.getElementById('regPwdStrength'),lbl=document.getElementById('regPwdLabel');
  if(!s||!val){if(s)s.style.display='none';return;}
  s.style.display='block';
  var has={len:val.length>=8,upper:/[A-Z]/.test(val),lower:/[a-z]/.test(val),num:/[0-9]/.test(val),sym:/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(val)};
  var score=Object.values(has).filter(Boolean).length;
  var bars=['pwdBar1','pwdBar2','pwdBar3','pwdBar4'],colors=['#ff3d5a','#ff6b35','#ffc107','#00e676'],labels=['Muito fraca','Fraca','Boa','Forte'];
  bars.forEach(function(id,i){ var el=document.getElementById(id); if(el) el.style.background=i<(score-1)?colors[Math.min(score-2,3)]:'rgba(255,255,255,.08)'; });
  if(lbl){lbl.textContent=labels[Math.min(score-1,3)]||'';lbl.style.color=colors[Math.min(score-2,3)]||'var(--text3)';}
};

window.toggleRegPwd=function(){ var inp=document.getElementById('regPassword'),ico=document.getElementById('regPwdEye'); if(!inp) return; var show=inp.type==='password'; inp.type=show?'text':'password'; if(ico){ico.setAttribute('data-lucide',show?'eye-off':'eye');if(window.lucide) lucide.createIcons();} };

function validatePassword(pwd){
  if(pwd.length<8) return 'A password deve ter pelo menos 8 caracteres';
  if(!/[A-Z]/.test(pwd)) return 'A password deve ter pelo menos uma letra maiúscula';
  if(!/[a-z]/.test(pwd)) return 'A password deve ter pelo menos uma letra minúscula';
  if(!/[0-9]/.test(pwd)) return 'A password deve ter pelo menos um número';
  if(!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) return 'A password deve ter pelo menos um símbolo (!@#$...)';
  return null;
}

function regShowError(step,msg){ var el=document.getElementById('regStep'+step+'Error'); if(!el) return; el.textContent=msg; el.style.display='block'; }
function regHideError(step){ var el=document.getElementById('regStep'+step+'Error'); if(el) el.style.display='none'; }
function regSetBtnLoading(id,loading,text){ var btn=document.getElementById(id); if(!btn) return; btn.disabled=loading; if(loading){btn.dataset.orig=btn.innerHTML;btn.innerHTML='<svg style="animation:spin .8s linear infinite;width:16px;height:16px" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> '+text;}else{btn.innerHTML=btn.dataset.orig||btn.innerHTML;} }

function regMapError(code,msg){
  var map={InvalidEmailAddress:'Endereço de email inválido.',DuplicateEmail:'Este email já está registado. Faz login.',DuplicateAccount:'Já existe uma conta com este email.',InvalidPassword:'Password inválida.',PasswordError:'Password inválida — precisa de maiúscula, minúscula, número e símbolo.',PasswordTooShort:'A password é demasiado curta. Mínimo 8 caracteres.',InvalidVerificationToken:'⚠️ Código inválido ou expirado. Os códigos expiram em 1 hora — volta ao passo 1.',TokenExpired:'⏱️ O código expirou. Volta atrás e solicita novo email.',WrongResponse:'Código incorrecto. Copia o código exacto do URL do link recebido por email.',InputValidationFailed:'Dados inválidos — verifica se copiaste o código correctamente, sem espaços.',RateLimit:'Muitas tentativas. Aguarda alguns minutos.'};
  return map[code]||(msg||'Ocorreu um erro. Tenta novamente.');
}

function regTryAutoFillCode(){
  try{
    var code=extractVerificationCode();
    if(code){
      var inp=document.getElementById('regCode');
      if(inp){ inp.value=code; var hint=document.getElementById('regCodeHint'); if(hint) hint.style.display='flex'; }
      var step2=document.getElementById('regStep2');
      if(step2&&step2.style.display!=='none'){ setTimeout(function(){ var btn=document.getElementById('regStep2Btn'); if(btn&&!btn.disabled) btn.click(); },800); }
    }
  }catch(e){ console.warn('[REG] Erro no auto-fill:',e); }
}

/* ── PASSO 1: enviar email ── */
window.regSendCode=function(){
  regHideError(1);
  var email=((document.getElementById('regEmail')||{}).value||'').trim().toLowerCase();
  var pwd=(document.getElementById('regPassword')||{}).value||'';
  if(!email||!email.includes('@')){ regShowError(1,'Introduz um email válido.'); return; }
  var pwdErr=validatePassword(pwd); if(pwdErr){ regShowError(1,pwdErr); return; }
  _regEmail=email; _regPassword=pwd;
  regSetBtnLoading('regStep1Btn',true,'A enviar código...');
  if(_regWs){try{_regWs.close();}catch(e){}}
  _regWs=new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id='+APP_ID);
  _regWs.onopen=function(){ _regWs.send(JSON.stringify({verify_email:_regEmail,type:'account_opening'})); };
  _regWs.onmessage=function(e){
    var d=JSON.parse(e.data); regSetBtnLoading('regStep1Btn',false,'');
    if(d.error){
      var errCode=d.error.code||'';
      if(errCode==='DuplicateEmail'||errCode==='DuplicateAccount'){ var dupEl=document.getElementById('regDupEmail'); if(dupEl) dupEl.textContent=_regEmail; regShowStep(4); }
      else{ regShowError(1,regMapError(d.error.code,d.error.message)); }
      return;
    }
    if(d.msg_type==='verify_email'&&d.verify_email===1){
      var sub=document.getElementById('regStep2Sub'); if(sub) sub.textContent='Enviámos um email para '+_regEmail+'.';
      regShowStep(2); regTryAutoFillCode(); if(window.lucide) lucide.createIcons();
    }
  };
  _regWs.onerror=function(){ regSetBtnLoading('regStep1Btn',false,''); regShowError(1,'Erro de ligação. Verifica a internet.'); };
};

/* ── PASSO 2: criar conta ── */
window.regCreateAccount=function(){
  regHideError(2);
  var codeInput=document.getElementById('regCode');
  var code=(codeInput?codeInput.value:'').trim();
  if(!code||code.length<4){ regShowError(2,'Introduz o código de verificação recebido no email.'); return; }
  regSetBtnLoading('regStep2Btn',true,'A criar conta...');
  if(_regWs){try{_regWs.close();}catch(e){}_regWs=null;}
  _regWs=new WebSocket('wss://ws.binaryws.com/websockets/v3?app_id='+APP_ID);
  _regWs.onopen=function(){ _regWs.send(JSON.stringify({new_account_virtual:1,client_password:_regPassword,verification_code:code,residence:'ao',type:'trading'})); };
  _regWs.onmessage=function(e){
    var d=JSON.parse(e.data); if(d.msg_type!=='new_account_virtual') return;
    regSetBtnLoading('regStep2Btn',false,'');
    if(d.error){
      var errMsg=''; switch(d.error.code){ case 'InvalidVerificationToken': errMsg='❌ Código inválido. Verifica se copiaste corretamente do email.'; break; case 'TokenExpired': errMsg='⏰ Código expirado. Clica em "Voltar" e pede um novo código.'; break; case 'DuplicateEmail': errMsg='📧 Este email já tem conta. Faz login.'; break; default: errMsg=d.error.message||'Erro ao criar conta. Tenta novamente.'; }
      regShowError(2,errMsg); return;
    }
    if(d.new_account_virtual){ regShowStep(3); if(window.lucide) lucide.createIcons(); toast('🎉 Conta criada!','Bem-vindo à DynamicWorks Angola!','success'); try{_regWs.close();}catch(err){} _regWs=null; }
  };
  _regWs.onerror=function(){ regSetBtnLoading('regStep2Btn',false,''); regShowError(2,'Erro de ligação. Verifica a tua internet.'); };
};

window.regBackToStep1=function(){ regHideError(1); regHideError(2); regShowStep(1); };
window.regUseDifferentEmail=function(){ var emailEl=document.getElementById('regEmail'); if(emailEl) emailEl.value=''; regHideError(1); regShowStep(1); if(emailEl) setTimeout(function(){emailEl.focus();},100); };

/* ── TOUR ONBOARDING ── */
var _tourStep=0, _tourActive=false, _tourScrollLock=null;
var _tourSteps=[
  {target:null,icon:'👋',title:'Bem-vindo ao DynamicWorks!',body:'A plataforma de <strong>Accumulators Deriv #1 em Angola</strong>.<br>Vamos mostrar-te tudo em 30 segundos.',cardPos:'center'},
  {target:'bnChart',icon:'📊',title:'Gráfico em Tempo Real',body:'Vês o preço e as <strong>barreiras reais do Accumulator</strong> vindas da Deriv.<br>O preço tem de ficar dentro para cresceres.',cardPos:'top'},
  {target:'bnTrade',icon:'⚡',title:'Abre um Trade',body:'Escolhe o activo, a <strong>taxa 1%–5%</strong> e o stake.<br>Activa o Take Profit para fechar com lucro automaticamente.',cardPos:'top'},
  {target:'bnPos',icon:'💼',title:'As Tuas Operações',body:'Contratos abertos e <strong>histórico completo</strong>.<br>Acompanha lucros e fecha contratos manualmente.',cardPos:'top'},
  {target:'bnEdu',icon:'🎓',title:'Centro de Aprendizagem',body:'Estratégias, lições e <strong>tutoriais</strong> gratuitos.<br>Do iniciante ao avançado.',cardPos:'top'},
  {target:'bnProfile',icon:'🏆',title:'Perfil e Ranking',body:'Escolhe um <strong>nickname</strong> e entra no Top 10!<br>Compete com os melhores traders angolanos.',cardPos:'top'},
  {target:null,icon:'🚀',title:'Tudo pronto!',body:'Começa com a <strong>conta Demo — $10.000 virtuais</strong>.<br>Sem risco. Pratica até teres confiança.',cardPos:'center',isLast:true}
];
window.tourStart=function(){
  if(localStorage.getItem('dw_tour_done')) return;
  var ov=$('dwTourOverlay'); if(!ov) return;
  _tourActive=true; _tourStep=0;
  ov.style.display='block';
  _tourScrollLock=document.body.style.overflow;
  document.body.style.overflow='hidden';
  requestAnimationFrame(function(){_tourRender(true);});
};
window.tourEnd=function(){
  _tourActive=false;
  var ov=$('dwTourOverlay');
  if(ov){ov.style.opacity='0';ov.style.transition='opacity .25s';setTimeout(function(){ov.style.display='none';ov.style.opacity='';ov.style.transition='';ov.innerHTML='';},250);}
  if(_tourScrollLock!==null) document.body.style.overflow=_tourScrollLock;
  localStorage.setItem('dw_tour_done','1');
  setTimeout(function(){ if(window._initPushNotifications) window._initPushNotifications(); },1500);
};
window.tourNext=function(){ _tourStep++; if(_tourStep>=_tourSteps.length){tourEnd();return;} _tourRender(false); };
window.tourPrev=function(){ if(_tourStep<=0) return; _tourStep--; _tourRender(false); };
function _tourGetRect(id){ var el=id?$(id):null; if(!el) return null; var r=el.getBoundingClientRect(); if(r.width===0&&r.height===0) return null; return r; }
function _tourRender(isFirst){
  var ov=$('dwTourOverlay'); if(!ov) return;
  var step=_tourSteps[_tourStep],total=_tourSteps.length,isLast=!!step.isLast||_tourStep===total-1;
  var rect=_tourGetRect(step.target),PAD=10,vH=window.innerHeight,vW=window.innerWidth,cardW=Math.min(vW-32,360);
  var dots='';for(var i=0;i<total;i++){dots+='<div style="width:'+(i===_tourStep?'20px':'7px')+';height:7px;border-radius:4px;background:'+(i===_tourStep?'#00d4ff':'rgba(255,255,255,.2)')+';transition:all .25s;flex-shrink:0"></div>';}
  var cardTop,cardLeft;
  if(!rect||step.cardPos==='center'){cardTop=Math.round(vH/2-120);cardLeft=Math.round(vW/2-cardW/2);}
  else{cardTop=Math.round(vH*0.28);cardLeft=Math.round(vW/2-cardW/2);}
  var svgHole='';
  if(rect){var hx=Math.round(rect.left-PAD),hy=Math.round(rect.top-PAD),hw=Math.round(rect.width+PAD*2),hh=Math.round(rect.height+PAD*2);svgHole='<svg style="position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:1"><defs><mask id="twMask"><rect width="100%" height="100%" fill="white"/><rect x="'+hx+'" y="'+hy+'" width="'+hw+'" height="'+hh+'" rx="12" fill="black"/></mask></defs><rect width="100%" height="100%" fill="rgba(2,5,15,.82)" mask="url(#twMask)"/><rect x="'+hx+'" y="'+hy+'" width="'+hw+'" height="'+hh+'" rx="12" fill="none" stroke="#00d4ff" stroke-width="2" stroke-opacity=".8" style="animation:dwTourPulse 1.6s ease-in-out infinite"/></svg>';}
  else{svgHole='<div style="position:fixed;inset:0;background:rgba(2,5,15,.75);pointer-events:none;z-index:1"></div>';}
  var arrow='';if(rect){var arrowX=Math.round(rect.left+rect.width/2),arrowY=Math.round(rect.top-PAD-18);arrow='<div style="position:fixed;left:'+arrowX+'px;top:'+arrowY+'px;transform:translateX(-50%);z-index:10002;animation:dwArrowBounce .7s ease-in-out infinite alternate;font-size:1.3rem;line-height:1">▼</div>';}
  var prevBtn=_tourStep>0?'<button onclick="tourPrev()" style="background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.12);border-radius:10px;padding:.5rem .8rem;font-size:.72rem;font-weight:600;color:rgba(255,255,255,.5);cursor:pointer;white-space:nowrap">← Anterior</button>':'<button onclick="tourEnd()" style="background:transparent;border:1px solid rgba(255,255,255,.1);border-radius:10px;padding:.5rem .85rem;font-size:.72rem;font-weight:600;color:rgba(255,255,255,.35);cursor:pointer;white-space:nowrap">Saltar</button>';
  var card='<div class="dw-tour-card" style="position:fixed;left:'+cardLeft+'px;top:'+cardTop+'px;width:'+cardW+'px;z-index:10003;animation:'+(isFirst?'dwTourPop':'dwTourSlide')+' .22s cubic-bezier(.34,1.4,.64,1) both"><div style="display:flex;gap:5px;justify-content:center;margin-bottom:.85rem">'+dots+'</div><div style="font-size:2rem;text-align:center;margin-bottom:.5rem;line-height:1">'+step.icon+'</div><div style="font-size:1rem;font-weight:900;color:#fff;text-align:center;margin-bottom:.45rem;letter-spacing:-.01em">'+step.title+'</div><div style="font-size:.82rem;color:rgba(255,255,255,.72);line-height:1.65;text-align:center;margin-bottom:1rem">'+step.body+'</div><div style="display:flex;gap:.6rem;align-items:center">'+prevBtn+'<button onclick="tourNext()" style="flex:1;background:linear-gradient(135deg,#00d4ff,#0099bb);border:none;border-radius:10px;padding:.6rem 1rem;font-size:.82rem;font-weight:900;color:#000;cursor:pointer;box-shadow:0 4px 14px rgba(0,212,255,.3)">'+(isLast?'✓ Vamos lá!':'Próximo →')+'</button></div></div>';
  ov.innerHTML=svgHole+arrow+card;
}
