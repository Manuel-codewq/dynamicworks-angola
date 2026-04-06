/* ═══════════════════════════════════════════════════════════
   DynamicWorks Angola — trade.js
   Proposal, buy, sell, take profit, cooldown, modal resultado.
═══════════════════════════════════════════════════════════ */
'use strict';

var _tradePending=false;
var _soldContracts={};
var _winStreak=0, _lossStreak=0;

/* ── FORMULÁRIO ── */
window.selectGrowthRate=function(rate,el){
  T.rate=rate;
  document.querySelectorAll('.growth-btn').forEach(function(b){ b.classList.remove('active'); });
  if(el) el.classList.add('active');
  txt('activeRate',rate+'%');
  /* mostrar estimativa local apenas se sem contrato aberto */
  var sym=S.asset.sym;
  var rb=_getRealBarriers(sym);
  var pr=S.prices[sym];
  if(pr){
    if(rb){
      txt('barrierLow',rb.lo.toFixed(S.asset.pip||4));
      txt('barrierHigh',rb.hi.toFixed(S.asset.pip||4));
      updateMeter(pr.p,rb.lo,rb.hi);
      updateAccuAnalysis(pr.p,rb.lo,rb.hi,sym);
    } else {
      var bpct=BARRIERS_EST[rate]||0.003, pip=S.asset.pip||4;
      var lo=(pr.p*(1-bpct)).toFixed(pip), hi=(pr.p*(1+bpct)).toFixed(pip);
      txt('barrierLow',lo); txt('barrierHigh',hi);
      updateMeter(pr.p,parseFloat(lo),parseFloat(hi));
      updateAccuAnalysis(pr.p,0,0,sym);
    }
  }
  if(T.stake>0) requestProposal();
};

window.setStake=function(val){
  var e=$('stakeAmt'); if(!e) return;
  e.value=val; T.stake=val;
  var btn=$('execBtn');
  if(btn&&btn.innerHTML.indexOf('Aguarda')===-1) btn.disabled=false;
  requestProposal();
};

window.onStakeInput=function(){
  var e=$('stakeAmt'); if(!e) return;
  T.stake=parseFloat(e.value)||0;
  var btn=$('execBtn');
  if(btn&&btn.innerHTML.indexOf('Aguarda')===-1) btn.disabled=T.stake<1;
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

/* ── PROPOSAL ── */
function requestProposal(){
  if(T.stake<1||!S.loggedIn) return;
  if(T._inCooldown) return;
  wsSend({
    proposal:1, amount:T.stake, basis:'stake',
    contract_type:'ACCU', currency:S.currency,
    growth_rate:T.rate/100, symbol:S.asset.sym
  });
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
    /* Mostrar barreiras reais da proposta — vindas da Deriv */
    var barrierInfo='';
    if(p.barrier&&p.low_barrier){
      var pip=S.asset?S.asset.pip||4:4;
      barrierInfo='<span>KO ▼ <b style="color:var(--red)">'+parseFloat(p.low_barrier).toFixed(pip)+'</b></span>'
                 +'<span>KO ▲ <b style="color:var(--red)">'+parseFloat(p.barrier).toFixed(pip)+'</b></span>';
      /* atualizar display imediatamente com valores reais da proposta */
      txt('barrierLow', parseFloat(p.low_barrier).toFixed(pip));
      txt('barrierHigh',parseFloat(p.barrier).toFixed(pip));
      var pr=S.prices[S.asset.sym];
      if(pr){
        updateMeter(pr.p,parseFloat(p.low_barrier),parseFloat(p.barrier));
        updateAccuAnalysis(pr.p,parseFloat(p.low_barrier),parseFloat(p.barrier),S.asset.sym);
      }
    }
    pBox.innerHTML='<div style="display:flex;flex-wrap:wrap;gap:.75rem;font-size:.72rem">'
      +'<span>Payout max: <b style="color:var(--green)">$'+parseFloat(p.payout||0).toFixed(2)+'</b></span>'
      +barrierInfo
      +'</div>';
  }
  var btn=$('execBtn'); if(btn) btn.disabled=false;
}

/* ── BUY ── */
window.placeTrade=function(){
  if(_tradePending){ toast('Aguarda...','Operação já em curso','warn'); return; }
  if(T.stake<1){ toast('Stake inválido','O mínimo é $1 para Accumulators','error'); return; }
  if(T.stake>S.balance&&!S.isDemo){
    toast('Saldo insuficiente','Tens $'+S.balance.toFixed(2)+' — reduz o stake ou deposita','error'); return;
  }
  if(!S.loggedIn){ toast('Sessão expirada','Faz login novamente','error'); return; }
  if(!S.ws||S.ws.readyState!==1){ toast('Sem ligação','A reconectar ao servidor...','warn'); wsConnect(); return; }
  if(!T.proposal){ toast('Sem proposta','Insere o stake e aguarda a proposta','warn'); if(T.stake>=1) requestProposal(); return; }
  _tradePending=true;
  var btn=$('execBtn'); if(btn){ btn.disabled=true; btn.textContent='A abrir...'; }
  window._pendingTP=(T.tpEnabled&&T.tpValue>0)?T.tpValue:0;
  wsSend({buy:T.proposal.id,price:T.stake,parameters:{
    amount:T.stake,basis:'stake',contract_type:'ACCU',
    currency:S.currency,growth_rate:T.rate/100,symbol:S.asset.sym
  }});
};

function onBuy(d){
  _tradePending=false;
  var btn=$('execBtn');
  if(d.error){
    var msg=d.error.message||'', code=d.error.code||'';
    var errTitle='Erro ao abrir', errDetail=msg;
    if(msg.toLowerCase().includes('insufficient')||msg.toLowerCase().includes('balance'))  { errTitle='Saldo insuficiente'; errDetail='Deposita fundos ou reduz o stake'; }
    else if(msg.toLowerCase().includes('too many')||msg.toLowerCase().includes('limit'))   { errTitle='Limite de contratos'; errDetail='Fecha um contrato aberto antes de abrir outro'; }
    else if(msg.toLowerCase().includes('market')||msg.toLowerCase().includes('closed'))   { errTitle='Mercado indisponível'; errDetail='Este ativo está temporariamente fechado'; }
    else if(msg.toLowerCase().includes('stake')||msg.toLowerCase().includes('amount'))    { errTitle='Stake inválido'; errDetail='Valor fora dos limites permitidos pela Deriv'; }
    else if(msg.toLowerCase().includes('proposal')||code==='ProposalExpired')             { errTitle='Proposta expirada'; errDetail='A cotação mudou — tenta novamente'; }
    else if(msg.toLowerCase().includes('connection')||msg.toLowerCase().includes('network')){ errTitle='Erro de ligação'; errDetail='Verifica a tua internet e tenta novamente'; }
    if(T.proposal&&btn){
      btn.disabled=false;
      btn.innerHTML='<svg data-lucide="zap" width="16" height="16"></svg> ABRIR ACUMULADOR';
      if(window.lucide) lucide.createIcons();
    }
    toast(errTitle,errDetail,'error');
    if(code==='ProposalExpired'||msg.toLowerCase().includes('proposal')){
      T.proposal=null;
      if(T.stake>=1) setTimeout(requestProposal,1000);
    }
    return;
  }
  if(btn){ btn.disabled=true; btn.innerHTML='<svg data-lucide="zap" width="16" height="16"></svg> ABRIR ACUMULADOR'; if(window.lucide) lucide.createIcons(); }
  var c=d.buy;
  delete _soldContracts[c.contract_id];
  toast('Acumulador aberto!','$'+parseFloat(c.buy_price||0).toFixed(2)+' '+T.rate+'%/tick','success');
  if(window._pendingTP>0) S.tpMap[c.contract_id]=window._pendingTP;
  window._pendingTP=0;
  wsSend({proposal_open_contract:1,contract_id:c.contract_id,subscribe:1});
  fbSaveOpenPosition(c);
  T.proposal=null;
}

/* ── SELL ── */
window.confirmClose=function(cid){
  var cidNum=parseInt(cid,10);
  if(isNaN(cidNum)){ toast('Erro','ID de contrato inválido','error'); return; }
  wsSend({sell:cidNum,price:0});
};
window.doCloseTrade=window.confirmClose;
window.cancelCloseTrade=function(){};
window.closeConfirm=function(){ var m=$('confirmModal'); if(m) m.classList.remove('open'); };

function onSell(d){
  if(d.error){
    var msg=d.error.message||'';
    var errTitle='Erro ao fechar', errDetail=msg;
    if(msg.toLowerCase().includes('already')||msg.toLowerCase().includes('sold')){ errTitle='Contrato já fechado'; errDetail='O contrato já foi encerrado'; renderContracts(); renderLiveOps(); }
    else if(msg.toLowerCase().includes('connection')){ errTitle='Erro de ligação'; errDetail='Tenta fechar novamente'; }
    else if(msg.toLowerCase().includes('permission')){ errTitle='Sem permissão'; errDetail='Não tens permissão para fechar este contrato'; }
    toast(errTitle,errDetail,'error'); return;
  }
  var sell=d.sell||{};
  var soldFor=parseFloat(sell.sold_for||0);
  var buyPrice=parseFloat(sell.buy_price||0);
  var pr=soldFor>0?(soldFor-buyPrice):0;
  var cid=sell.contract_id;
  if(cid){
    S.contracts=S.contracts.filter(function(x){
      return String(x.contract_id)!==String(cid)&&parseInt(x.contract_id)!==parseInt(cid);
    });
    delete S.tpMap[cid]; delete S.tpMap[String(cid)];
    delete S.barriers[cid]; delete S.barriers[String(cid)];
  }
  if(soldFor>0){ S.balance=Math.max(0,S.balance-buyPrice+soldFor); renderBalance(); }
  renderContracts(); renderLiveOps(); renderHistory(); updateStats();
  toast(pr>=0?'✓ Posição Fechada':'Posição Fechada','Resultado: '+(pr>=0?'+':'')+pr.toFixed(2)+' USD',pr>=0?'success':'warn');
}

/* ── RESULTADO MODAL ── */
function showResult(c){
  var modal=$('tradeResultModal'); if(!modal) return;
  var pr=parseFloat(c.profit||0), win=pr>0;
  var ring=$('rIconRing'),chip=$('rChip'),pnlEl=$('rPnl'),msgEl=$('rMsg'),details=$('rDetails');
  var rIcon=$('rIcon'),rBtn=$('rBtn');
  if(win){ _winStreak++; _lossStreak=0; }else{ _lossStreak++; _winStreak=0; }
  try{ if(win){_playWin();_vibrate('win');}else{_playLoss();_vibrate('loss');} }catch(e){}
  try{ localStorage.setItem('dw_win_streak',_winStreak); }catch(e){}
  if(ring) ring.className='r-icon-ring '+(win?'win':'loss');
  if(rIcon) rIcon.textContent=win?(_winStreak>=3?'🔥':'🏆'):'💥';
  if(chip){ chip.textContent=win?'✦ ACUMULAÇÃO LUCRATIVA':'✦ KNOCK-OUT — BARREIRA TOCADA'; chip.className='r-chip '+(win?'win':'loss'); }
  if(pnlEl){ pnlEl.textContent=(pr>=0?'+':'')+pr.toFixed(2)+' USD'; pnlEl.className='r-pnl '+(win?'win':'loss'); }
  var a=ASSETS.find(function(x){ return x.sym===c.underlying; });
  var rate=((c.growth_rate||0)*100).toFixed(0);
  var ticks=c.tick_count||0, stake=parseFloat(c.buy_price||0);
  if(!win){ if(msgEl) msgEl.textContent=_lossStreak>=2?'⚠️ '+_lossStreak+'ª perda — tenta baixar a taxa.':'Barreira tocada ao tick '+ticks+'.'; }
  else{ var wMsgs=['Capital a crescer! 💰','Excelente — '+ticks+' ticks acumulados!','Continua assim! 🇦🇴','Perfeito — a zona segura aguentou '+ticks+' ticks.']; if(msgEl) msgEl.textContent=wMsgs[Math.floor(Math.random()*wMsgs.length)]; }
  if(details) details.innerHTML='<span class="r-pill">'+(a?a.name:c.underlying||'...')+'</span><span class="r-pill">'+rate+'%/tick</span><span class="r-pill">'+ticks+' ticks</span><span class="r-pill">Stake $'+stake.toFixed(2)+'</span>';
  var explainBox=$('rKnockoutExplain'); if(explainBox) explainBox.style.display='none';
  var sessionBar=$('rSessionBar'); if(sessionBar) sessionBar.style.display='none';
  var streakEl=$('rStreak'),streakTxt=$('rStreakText'),streakIco=$('rStreakIcon');
  if(streakEl){ if(win&&_winStreak>=2){ streakEl.style.display='flex'; if(streakIco) streakIco.textContent=_winStreak>=4?'⚡':'🔥'; if(streakTxt) streakTxt.textContent=_winStreak+' wins seguidos!'; }else{ streakEl.style.display='none'; } }
  if(rBtn){
    if(win){ rBtn.textContent='Continuar a Operar →'; rBtn.className='r-btn win'; rBtn.onclick=function(){ closeResult(); }; }
    else  { rBtn.textContent='OK, Entendido'; rBtn.className='r-btn loss'; rBtn.onclick=function(){ closeResult(); goToView('v-chart',$('bnChart')); }; }
  }
  var cdEl=$('rCountdown'),secs=win?10:12;
  if(cdEl) cdEl.textContent=secs;
  clearInterval(modal._cd);
  modal._cd=setInterval(function(){ secs--; if(cdEl) cdEl.textContent=secs; if(secs<=0){ clearInterval(modal._cd); closeResult(); } },1000);
  _sendTradeNotification(c,pr,win,ticks,rate,a);
  modal.style.display='flex';
  requestAnimationFrame(function(){ modal.style.opacity='1'; });
  clearTimeout(modal._t);
}
window.closeTradeResult=closeResult;

function closeResult(){
  var m=$('tradeResultModal'); if(!m) return;
  clearInterval(m._cd);
  m.style.opacity='0';
  setTimeout(function(){ m.style.display='none'; },300);
  T.proposal=null;
  var execB=$('execBtn'); if(execB) execB.disabled=true;
}

function _sendTradeNotification(c,pr,win,ticks,rate,asset){
  if(!('Notification' in window)||Notification.permission!=='granted') return;
  var name=asset?asset.short:(c.underlying||'V10');
  var prAbs=Math.abs(pr).toFixed(2);
  var prAoa=Math.round(Math.abs(pr)*(window._taxaUsdAoa||950)).toLocaleString('pt-AO');
  var title=win?'💹 Ganhaste +$'+prAbs+' USD!':'⚡ Knock-out  -$'+prAbs+' USD';
  var body=win?'aprox. '+prAoa+' AOA  |  '+name+' '+rate+'%  |  '+ticks+' ticks':name+' | Barreira tocada ao tick '+ticks+' | aprox. '+prAoa+' AOA';
  try{ new Notification(title,{body:body,icon:'/icon-192.png',tag:'dw-trade-'+c.contract_id}); }catch(e){}
}
