/* ═══════════════════════════════════════════════════════════
   DynamicWorks Angola — firebase.js
   Firestore: histórico, leaderboard, referrals, perfil, posições.
═══════════════════════════════════════════════════════════ */
'use strict';

var _fb={commission:0,refCount:0,refPending:0,nickname:'',country:'AO'};
var _fbHistoryMap={};
var _fbFlushTimer=null;
var _fbListeners=[];

/* ── LISTENERS ── */
function _fbCancelListeners(){
  _fbListeners.forEach(function(unsub){ try{unsub();}catch(e){} });
  _fbListeners=[];
}

function loadFirebaseData(){
  if(!window._db||!S.acct) return;
  var unsubSession=window._fsOnSnapshot(
    window._fsDoc(window._db,'sessions',S.acct),
    function(snap){
      if(!snap.exists()) return;
      var d=snap.data();
      if(d.nickname&&d.nickname!==_fb.nickname){ _fb.nickname=d.nickname; var ni=$('nicknameInput'); if(ni) ni.value=d.nickname; _renderProfileAvatar(d.nickname); txt('profileName',d.nickname); }
      if(d.country){ _fb.country=d.country; }
      var ci=$('countryInput'); if(ci&&d.country) ci.value=d.country;
      var cf=$('countryFlag'); if(cf&&d.country) cf.textContent=_countryFlag(d.country);
    },
    function(e){ console.warn('[DW] sessions listener:',e.message); }
  );
  _fbListeners.push(unsubSession);

  var unsubRef=window._fsOnSnapshot(
    window._fsDoc(window._db,'referrals',S.acct),
    function(snap){
      if(!snap.exists()) return;
      var d=snap.data();
      _fb.commission=d.earned||0; _fb.refCount=d.count||0; _fb.refPending=d.pending||0;
      txt('refCount',_fb.refCount);
      txt('refEarned','$'+parseFloat(_fb.commission).toFixed(2));
      txt('refPending','$'+parseFloat(_fb.refPending).toFixed(2));
      var cwA=$('cwAvailable'); if(cwA) cwA.textContent='$'+parseFloat(_fb.commission).toFixed(2);
    },
    function(e){ console.warn('[DW] referrals listener:',e.message); }
  );
  _fbListeners.push(unsubRef);
  _fbListenHistory();
  _fbListenLeaderboard('daily');
  fbLoadOpenPositions();
  renderReferral();
}

/* ── HISTÓRICO ── */
function fbSaveTrade(entry){
  if(!window._db||!window._appReady) return;
  if(!entry.contract_id||!entry.underlying) return;
  _fbHistoryMap[entry.contract_id]=entry;
  _fbFlushHistory();
}

function _fbFlushHistory(){
  clearTimeout(_fbFlushTimer);
  _fbFlushTimer=setTimeout(function(){
    if(!window._db||!S.acct) return;
    var entries=Object.values(_fbHistoryMap)
      .filter(function(h){ return h.underlying&&h.contract_id; })
      .sort(function(a,b){ return (b.sell_time||0)-(a.sell_time||0); })
      .slice(0,50)
      .map(function(h){
        return {
          contract_id:String(h.contract_id), underlying:String(h.underlying),
          profit:Number(parseFloat(h.profit).toFixed(4)), buy_price:Number(parseFloat(h.buy_price).toFixed(4)),
          growth_rate:Number(parseFloat(h.growth_rate).toFixed(4)), tick_count:parseInt(h.tick_count)||0,
          sell_time:parseInt(h.sell_time)||Math.floor(Date.now()/1000)
        };
      });
    if(!entries.length) return;
    window._fsSetDoc(window._fsDoc(window._db,'history',S.acct),{entries:entries,updatedAt:Date.now()})
      .then(function(){ console.log('[DW] Histórico guardado:',entries.length,'trades'); })
      .catch(function(e){ console.warn('[DW] Erro ao guardar histórico:',e.message); });
  },2000);
}

function fbLoadHistory(){
  if(!window._db||!S.acct) return;
  if(_fbListeners.length>0) return;
  window._fsGetDoc(window._fsDoc(window._db,'history',S.acct)).then(function(snap){
    if(!snap.exists()) return;
    var d=snap.data();
    var fbEntries=(d.entries||[]).filter(function(h){ return h&&h.contract_id&&h.underlying&&h.underlying!==''&&h.sell_time>0; });
    if(!fbEntries.length) return;
    fbEntries.forEach(function(h){ _fbHistoryMap[String(h.contract_id)]=h; });
    var existingIds={}; S.history.forEach(function(h){ existingIds[String(h.contract_id)]=true; });
    var added=0;
    fbEntries.forEach(function(h){
      if(!existingIds[String(h.contract_id)]){
        S.history.push({contract_id:String(h.contract_id),underlying:h.underlying,profit:parseFloat(h.profit)||0,buy_price:parseFloat(h.buy_price)||0,growth_rate:parseFloat(h.growth_rate)||0,tick_count:parseInt(h.tick_count)||0,sell_time:parseInt(h.sell_time)||0});
        existingIds[String(h.contract_id)]=true; added++;
      }
    });
    if(added>0){ S.history.sort(function(a,b){ return (b.sell_time||0)-(a.sell_time||0); }); if(S.history.length>100) S.history=S.history.slice(0,100); renderHistory(); updateStats(); }
  }).catch(function(e){ console.warn('[DW] fbLoadHistory erro:',e.message); });
}

function _fbListenHistory(){
  if(!window._db||!S.acct) return;
  var unsubHist=window._fsOnSnapshot(
    window._fsDoc(window._db,'history',S.acct),
    function(snap){
      if(!snap.exists()) return;
      var d=snap.data();
      var fbEntries=(d.entries||[]).filter(function(h){ return h&&h.contract_id&&h.underlying&&h.sell_time>0; });
      if(!fbEntries.length) return;
      fbEntries.forEach(function(h){ _fbHistoryMap[String(h.contract_id)]=h; });
      var existingIds={}; S.history.forEach(function(h){ existingIds[String(h.contract_id)]=true; });
      var added=0;
      fbEntries.forEach(function(h){
        if(!existingIds[String(h.contract_id)]){
          S.history.push({contract_id:String(h.contract_id),underlying:h.underlying,profit:parseFloat(h.profit)||0,buy_price:parseFloat(h.buy_price)||0,growth_rate:parseFloat(h.growth_rate)||0,tick_count:parseInt(h.tick_count)||0,sell_time:parseInt(h.sell_time)||0});
          existingIds[String(h.contract_id)]=true; added++;
        }else{
          for(var i=0;i<S.history.length;i++){ if(String(S.history[i].contract_id)===String(h.contract_id)){ S.history[i]=Object.assign({},S.history[i],h); break; } }
        }
      });
      if(added>0||fbEntries.length>0){ S.history.sort(function(a,b){ return (b.sell_time||0)-(a.sell_time||0); }); if(S.history.length>100) S.history=S.history.slice(0,100); renderHistory(); updateStats(); }
    },
    function(e){ console.warn('[DW] history listener:',e.message); }
  );
  _fbListeners.push(unsubHist);
}

function fbCleanupHistory(){
  if(!window._db||!S.acct) return;
  window._fsGetDoc(window._fsDoc(window._db,'history',S.acct)).then(function(snap){
    if(!snap.exists()) return;
    var d=snap.data(); var all=d.entries||[];
    var valid=all.filter(function(h){ return h&&h.contract_id&&h.underlying&&h.underlying!==''&&parseFloat(h.growth_rate)>0&&parseInt(h.sell_time)>0; });
    if(valid.length<all.length){ console.log('[DW] Limpeza: removidas',all.length-valid.length,'entradas'); window._fsSetDoc(window._fsDoc(window._db,'history',S.acct),{entries:valid,updatedAt:Date.now()}).catch(function(){}); }
  }).catch(function(){});
}
function fbSaveHistory(){ _fbFlushHistory(); }

/* ── POSIÇÕES ABERTAS ── */
function fbSaveOpenPosition(c){
  if(!window._db||!S.acct||!c||!c.contract_id) return;
  var posId=S.acct+'_'+c.contract_id;
  window._fsSetDoc(window._fsDoc(window._db,'positions',posId),{
    acct:S.acct, contract_id:String(c.contract_id), underlying:c.underlying||'',
    buy_price:parseFloat(c.buy_price||0), growth_rate:parseFloat(c.growth_rate||0),
    stake:parseFloat(c.buy_price||T.stake||0), openedAt:Date.now()
  }).catch(function(e){ console.warn('fbSaveOpenPosition:',e.message); });
}
function fbRemoveOpenPosition(contract_id){
  if(!window._db||!S.acct||!contract_id) return;
  window._fsDeleteDoc(window._fsDoc(window._db,'positions',S.acct+'_'+contract_id)).catch(function(){});
}
function fbLoadOpenPositions(){
  if(!window._db||!S.acct) return;
  var q=window._fsQuery(window._fsCollection(window._db,'positions'),window._fsWhere('acct','==',S.acct));
  window._fsGetDocs(q).then(function(snap){
    setTimeout(function(){
      if(S.contracts.length===0&&!snap.empty){ snap.forEach(function(d){ window._fsDeleteDoc(d.ref).catch(function(){}); }); }
    },5000);
  }).catch(function(){});
}

/* ── LEADERBOARD ── */
var _lbActiveMode='daily', _lbUnsubscribers=[];
function _fbListenLeaderboard(mode){
  _lbUnsubscribers.forEach(function(u){ try{u();}catch(e){} }); _lbUnsubscribers=[];
  _lbActiveMode=mode;
  if(!window._db) return;
  var q;
  if(mode==='weekly'){
    var wk=_getWeekKey();
    q=window._fsQuery(window._fsCollection(window._db,'leaderboard_weekly'),window._fsWhere('week','==',wk),window._fsOrderBy('pnl','desc'),window._fsLimit(10));
  }else{
    var today=new Date().toISOString().slice(0,10);
    q=window._fsQuery(window._fsCollection(window._db,'leaderboard'),window._fsWhere('date','==',today),window._fsOrderBy('pnl','desc'),window._fsLimit(10));
  }
  var unsub=window._fsOnSnapshot(q,function(snap){ _renderLeaderboardSnap(snap,mode); },function(e){ console.warn('[DW] leaderboard listener:',e.message); });
  _lbUnsubscribers.push(unsub); _fbListeners.push(unsub);
}
function _getWeekKey(){ var d=new Date(),day=d.getDay(),diff=d.getDate()-day+(day===0?-6:1); var mon=new Date(new Date(d).setDate(diff)); return mon.toISOString().slice(0,10); }
function loadLeaderboard(mode){ _fbListenLeaderboard(mode||'daily'); }
function _renderLeaderboardSnap(snap,mode){
  var el=$('leaderboardList'); if(!el) return;
  if(snap.empty){ el.innerHTML='<div class="lb-loading">Sê o primeiro '+(mode==='weekly'?'esta semana':'hoje')+'! 🏆</div>'; return; }
  var medals=['🥇','🥈','🥉','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'],rank=0,h='';
  snap.forEach(function(doc){
    var d=doc.data(), val=parseFloat(d.pnl||d.profit||0), mine=(d.acct===S.acct), nick=d.nickname||'';
    if(!nick||nick.match(/^[0-9]+$/)){rank++;return;}
    var flag=_countryFlag(d.country||'AO'), initial=nick.charAt(0).toUpperCase();
    var avatarBg=mine?'background:#00d4ff;color:#000':'background:rgba(255,255,255,.1);color:var(--text)';
    h+='<div class="lb-row'+(mine?' lb-mine':'')+'">'
      +'<span class="lb-medal">'+medals[rank]+'</span>'
      +'<span style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;font-size:.72rem;font-weight:900;flex-shrink:0;'+avatarBg+'">'+initial+'</span>'
      +'<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.8rem;font-weight:700">'+(mine?'👤 Tu':nick)+' <span style="font-size:.85rem">'+flag+'</span></span>'
      +'<span style="font-family:var(--mono);font-weight:800;font-size:.82rem;color:'+(val>=0?'var(--green)':'var(--red)')+';">'+(val>=0?'+':'')+val.toFixed(2)+'$</span>'
      +'</div>';
    if(mine){show('myRankRow');txt('myRankVal','#'+(rank+1));}
    rank++;
  });
  el.innerHTML=h||'<div class="lb-loading">Sem traders com nickname neste período.</div>';
}
window.switchLeaderboard=function(mode,btnEl){ document.querySelectorAll('.lb-tab').forEach(function(b){b.classList.remove('active');}); if(btnEl) btnEl.classList.add('active'); _fbListenLeaderboard((mode==='day'||mode==='daily')?'daily':'weekly'); };
window.switchLbTab=window.switchLeaderboard;

function fbUpdateRanking(profit){
  if(!window._db||!S.acct||S.isDemo) return;
  var nick=_fb.nickname||null; if(!nick) return;
  var today=new Date().toISOString().slice(0,10), wk=_getWeekKey(), uid=S.acct;
  var refDay=window._fsDoc(window._db,'leaderboard',today+'_'+uid);
  window._fsGetDoc(refDay).then(function(snap){ var ex=snap.exists()?snap.data():{pnl:0,trades:0}; var newPnl=(parseFloat(ex.pnl||ex.profit)||0)+(profit||0); return window._fsSetDoc(refDay,{acct:uid,date:today,pnl:newPnl,nickname:nick,country:_fb.country||'AO',trades:(ex.trades||0)+1}); }).catch(function(){});
  var refWeek=window._fsDoc(window._db,'leaderboard_weekly',wk+'_'+uid);
  window._fsGetDoc(refWeek).then(function(snap){ var ex=snap.exists()?snap.data():{pnl:0,trades:0}; var newPnl=(parseFloat(ex.pnl)||0)+(profit||0); return window._fsSetDoc(refWeek,{acct:uid,week:wk,pnl:newPnl,nickname:nick,country:_fb.country||'AO',trades:(ex.trades||0)+1}); }).catch(function(){});
}

window.loadWeeklyRanking=function(){
  var el=$('weeklyRankList'),podEl=$('weeklyPodium'); if(!el) return;
  el.innerHTML='<div class="lb-loading">A carregar...</div>';
  if(podEl) podEl.innerHTML='<div class="wr-pod-loading">A carregar pódio...</div>';
  if(!window._db){el.innerHTML='<div class="lb-loading">Firebase não disponível.</div>';return;}
  var wk=_getWeekKey(); var dl=$('weeklyRankDate'); if(dl) dl.textContent='Semana de '+wk;
  var q=window._fsQuery(window._fsCollection(window._db,'leaderboard_weekly'),window._fsWhere('week','==',wk),window._fsOrderBy('pnl','desc'),window._fsLimit(20));
  if(window._wrUnsub){try{window._wrUnsub();}catch(e){}}
  window._wrUnsub=window._fsOnSnapshot(q,function(snap){
    var traders=[]; snap.forEach(function(doc){ var d=doc.data(); var nick=d.nickname||''; if(nick&&!nick.match(/^[0-9]+$/)) traders.push(d); });
    var top=traders.slice(0,10);
    if(!top.length){
      if(podEl) podEl.innerHTML='<div class="wr-pod-loading">Nenhum trader com nome esta semana.</div>';
      el.innerHTML='<div class="lb-loading">Sê o primeiro esta semana! 🏆</div>'; return;
    }
    if(podEl&&top.length>0){
      var podOrder=[1,0,2],podClasses=['p2','p1','p3'],podMedals=['🥈','🥇','🥉'],podLabels=['2º','1º','3º'],podH='';
      podOrder.forEach(function(idx,vi){ var t=top[idx]; if(!t) return; var val=parseFloat(t.pnl||0),nick=t.nickname||'?',flag=_countryFlag(t.country||'AO'),initial=nick.charAt(0).toUpperCase(),mine=(t.acct===S.acct); podH+='<div class="wr-pod-item '+podClasses[vi]+'"><div class="wr-pod-medal">'+podMedals[vi]+'</div><div class="wr-pod-avatar" style="'+(mine?'background:var(--accent);color:#000':'')+'">'+initial+'</div><div class="wr-pod-nick">'+(mine?'Tu':nick)+'</div><div style="font-size:.85rem;line-height:1;margin-bottom:.1rem">'+flag+'</div><div class="wr-pod-pnl '+(val>=0?'green':'red')+'">'+(val>=0?'+':'')+val.toFixed(2)+'$</div><div class="wr-pod-base">'+podLabels[vi]+'</div></div>'; });
      podEl.innerHTML=podH||'<div class="wr-pod-loading">Pódio indisponível.</div>';
    }
    var listH='',myRankNum=-1;
    top.forEach(function(t,idx){ var val=parseFloat(t.pnl||0),mine=t.acct===S.acct; if(mine) myRankNum=idx+1; if(idx<3) return; var nick=t.nickname||'?',flag=_countryFlag(t.country||'AO'),initial=nick.charAt(0).toUpperCase(),trades=t.trades||0; listH+='<div class="wr-row'+(mine?' wr-mine':'')+'">'+'<div class="wr-rank">'+(idx+1)+'º</div><div class="wr-avatar" style="width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.78rem;font-weight:900;flex-shrink:0;'+(mine?'background:var(--accent);color:#000':'background:rgba(255,255,255,.1);color:var(--text)')+'">'+initial+'</div><div class="wr-info"><div class="wr-nick">'+(mine?'👤 Tu':nick)+' '+flag+'</div><div class="wr-trades">'+trades+' operações</div></div><div class="wr-pnl '+(val>=0?'green':'red')+'">'+(val>=0?'+':'')+val.toFixed(2)+'<span>$</span></div></div>'; });
    el.innerHTML=listH||'<div style="font-size:.72rem;color:var(--text3);text-align:center;padding:.75rem">Top 3 exibido acima ↑</div>';
    var myRankEl=$('weeklyMyRank'); if(myRankEl){myRankEl.style.display=myRankNum>0?'flex':'none'; if(myRankNum>0){var mv=$('weeklyMyRankVal');if(mv)mv.textContent='#'+myRankNum;}}
  },function(e){if(el)el.innerHTML='<div class="lb-loading">Erro ao carregar.</div>';console.warn('weeklyRanking err:',e);});
};

/* ── REFERRALS ── */
var PARTNER_LEVELS=[{id:'bronze',min:0,rate:0.50},{id:'silver',min:15,rate:0.80},{id:'gold',min:40,rate:1.10},{id:'diamond',min:100,rate:1.40}];
function _getPartnerRate(refCount){ var rate=PARTNER_LEVELS[0].rate; for(var i=PARTNER_LEVELS.length-1;i>=0;i--){if(refCount>=PARTNER_LEVELS[i].min){rate=PARTNER_LEVELS[i].rate;break;}} return rate; }

(function(){ var urlRef=new URLSearchParams(location.search).get('ref'); if(urlRef){try{localStorage.setItem('dw_pending_ref',urlRef);}catch(e){}} })();

function renderReferral(){
  var link=location.origin+'/index.html?ref='+S.acct;
  var el=$('referralLink'); if(el) el.textContent=link;
  if(S.isDemo||!window._db||!S.acct) return;
  var urlRef=new URLSearchParams(location.search).get('ref')||(function(){try{return localStorage.getItem('dw_pending_ref');}catch(e){return null;}})();
  if(!urlRef||urlRef===S.acct) return;
  var ruRef=window._fsDoc(window._db,'referral_users',S.acct);
  window._fsGetDoc(ruRef).then(function(snap){
    if(snap.exists()){try{localStorage.removeItem('dw_pending_ref');}catch(e){}return;}
    return window._fsSetDoc(ruRef,{referredBy:urlRef,acct:S.acct,joinedAt:Date.now(),totalVolume:0,totalTrades:0,isReal:true},{merge:true}).then(function(){
      var refRef=window._fsDoc(window._db,'referrals',urlRef);
      return window._fsGetDoc(refRef).then(function(snap2){ var ex=snap2.exists()?snap2.data():{count:0,earned:0,pending:0,paid:0}; return window._fsSetDoc(refRef,{count:(parseInt(ex.count)||0)+1,earned:parseFloat(ex.earned)||0,pending:parseFloat(ex.pending)||0,paid:parseFloat(ex.paid)||0},{merge:true}); });
    }).then(function(){try{localStorage.removeItem('dw_pending_ref');}catch(e){}});
  }).catch(function(e){console.warn('[DW] renderReferral err:',e.message);});
}

function _commissionOnTrade(buyPrice){
  if(S.isDemo||!window._db||!S.acct||!buyPrice||buyPrice<=0) return;
  var volume=parseFloat(buyPrice)||0;
  window._fsGetDoc(window._fsDoc(window._db,'referral_users',S.acct)).then(function(snap){
    if(!snap.exists()) return;
    var ruData=snap.data(), partnerId=ruData.referredBy; if(!partnerId) return;
    window._fsSetDoc(window._fsDoc(window._db,'referral_users',S.acct),{totalVolume:(parseFloat(ruData.totalVolume)||0)+volume,totalTrades:(parseInt(ruData.totalTrades)||0)+1,lastTradeAt:Date.now()},{merge:true}).catch(function(){});
    var refDoc=window._fsDoc(window._db,'referrals',partnerId);
    window._fsGetDoc(refDoc).then(function(snap2){
      var ex=snap2.exists()?snap2.data():{count:0,earned:0,pending:0,paid:0};
      var rate=_getPartnerRate(parseInt(ex.count)||0);
      var comm=parseFloat((volume*rate/100).toFixed(6));
      return window._fsSetDoc(refDoc,{earned:parseFloat((parseFloat(ex.earned||0)+comm).toFixed(6)),pending:parseFloat((parseFloat(ex.pending||0)+comm).toFixed(6)),updatedAt:Date.now()},{merge:true});
    }).catch(function(){});
  }).catch(function(){});
}

window.copyReferralLink=function(){ var link=location.origin+'/index.html?ref='+S.acct; navigator.clipboard.writeText(link).then(function(){toast('Link copiado!','','success');}).catch(function(){}); };
window.shareReferral=function(){ var link=location.origin+'/index.html?ref='+S.acct; var text='Opera na DynamicWorks Angola!\n\n'+link; if(navigator.share) navigator.share({title:'DynamicWorks Angola',text:text,url:link}).catch(function(){}); else window.open('https://wa.me/?text='+encodeURIComponent(text),'_blank'); };

/* ── PERFIL ── */
window.onNicknameInput=function(el){ var btn=$('nicknameSaveBtn'); if(btn) btn.disabled=el.value.trim().length<2; var prev=$('nicknameAvatarPreview'); if(prev) prev.textContent=(el.value.trim().charAt(0)||'?').toUpperCase(); };
window.onCountryInput=function(el){ var flag=$('countryFlag'); if(flag) flag.textContent=_countryFlag(el.value); var ni=$('nicknameInput'); var btn=$('nicknameSaveBtn'); if(btn&&ni&&ni.value.trim().length>=2) btn.disabled=false; };
window.saveNickname=function(){
  var ni=$('nicknameInput'); if(!ni) return;
  var nick=ni.value.trim().replace(/[<>"'&]/g,''); if(nick.length<2||!S.acct) return;
  var ci=$('countryInput'), country=(ci&&ci.value)?ci.value:'AO';
  _fb.nickname=nick; _fb.country=country;
  _renderProfileAvatar(nick);
  if(window._db){ window._fsSetDoc(window._fsDoc(window._db,'sessions',S.acct),{nickname:nick,country:country,acct:S.acct,updatedAt:Date.now()},{merge:true}).catch(function(){}); _fbPropagateNickname(nick,country); }
  var cf=$('countryFlag'); if(cf) cf.textContent=_countryFlag(country);
  var ok=$('nicknameOk'); if(ok){ok.style.display='flex';setTimeout(function(){ok.style.display='none';},2500);}
  var btn=$('nicknameSaveBtn'); if(btn) btn.disabled=true;
  toast('Perfil guardado!','Apareceràs como "'+nick+'" '+_countryFlag(country)+' no ranking','success');
};
function _countryFlag(code){ if(!code||code.length!==2) return '🌍'; try{return String.fromCodePoint(code.toUpperCase().charCodeAt(0)-65+127462,code.toUpperCase().charCodeAt(1)-65+127462);}catch(e){return '🌍';} }
function _renderProfileAvatar(nick){ var safeNick=(nick||'').replace(/[<>"'&]/g,''); var initial=(safeNick||S.acct||'?').charAt(0).toUpperCase(); document.querySelectorAll('.profile-avatar-letter').forEach(function(el){el.textContent=initial;}); document.querySelectorAll('.profile-nickname-display').forEach(function(el){el.textContent=safeNick||S.acct;}); var ni=$('nicknameAvatarPreview'); if(ni) ni.textContent=initial; }
function _fbPropagateNickname(nick,country){ if(!window._db||!S.acct) return; var uid=S.acct,today=new Date().toISOString().slice(0,10),wk=_getWeekKey(),payload={nickname:nick}; if(country) payload.country=country; [window._fsDoc(window._db,'leaderboard',today+'_'+uid),window._fsDoc(window._db,'leaderboard_weekly',wk+'_'+uid)].forEach(function(ref){window._fsGetDoc(ref).then(function(snap){if(snap.exists())return window._fsSetDoc(ref,payload,{merge:true});}).catch(function(){});}); }

/* ── COMMISSION WITHDRAW ── */
window.openCommissionWithdraw=function(){ var e=$('cwAvailable'); if(e) e.textContent='$'+parseFloat(_fb.commission||0).toFixed(2); var m=$('commissionWithdrawModal'); if(m) m.classList.add('open'); };
window.closeCommissionWithdraw=function(){ var m=$('commissionWithdrawModal'); if(m) m.classList.remove('open'); };
window.submitCommissionWithdraw=function(){
  var amt=parseFloat($('cwAmt')&&$('cwAmt').value)||0;
  var mc=$('cwMulticaixa')&&$('cwMulticaixa').value||'';
  var wa=$('cwWhatsapp')&&$('cwWhatsapp').value||'';
  if(amt<5){toast('Minimo $5.00','','error');return;}
  if(!mc){toast('Insere numero Multicaixa','','error');return;}
  if(!wa){toast('Insere numero WhatsApp','','error');return;}
  if(window._db){
    window._fsSetDoc(window._fsDoc(window._db,'withdrawal_requests',Date.now()+'_'+S.acct),{acct:S.acct,amount:amt,method:'multicaixa_express',paymentAddress:mc+' | WA:'+wa,status:'pending',createdAt:Date.now()}).catch(function(){});
  }
  closeCommissionWithdraw();
  toast('Pedido enviado!','Contacto via WhatsApp no dia 1','success');
};

/* ── TESTEMUNHOS ── */
window._loadLandingTestimonials=function(){
  if(!window._db||!window._fsGetDocs) return;
  var scroll=document.getElementById('landTestiScroll'),section=document.getElementById('landTestiSection');
  if(!scroll||!section) return;
  try{
    var q=window._fsQuery(window._fsCollection(window._db,'testimonials'),window._fsWhere('approved','==',true),window._fsOrderBy('createdAt','desc'),window._fsLimit(10));
    window._fsGetDocs(q).then(function(snap){
      if(!snap||snap.empty) return;
      section.style.display='block';
      var colors=['linear-gradient(135deg,#00d4ff,#6c3fff)','linear-gradient(135deg,#00e676,#0099bb)','linear-gradient(135deg,#ffc107,#ff6b35)','linear-gradient(135deg,#a78bfa,#6c3fff)','linear-gradient(135deg,#ff3d5a,#ff6b35)'];
      var h=snap.docs.map(function(d,i){ var data=d.data(),stars=parseInt(data.stars||5),starsHtml='★'.repeat(stars)+'<span style="opacity:.3">★</span>'.repeat(5-stars),initial=(data.nickname||'?').charAt(0).toUpperCase(),color=colors[i%colors.length]; return '<div style="background:var(--card);border:1px solid var(--border);border-radius:16px;padding:1rem;min-width:265px;flex-shrink:0;display:flex;flex-direction:column;gap:.6rem;scroll-snap-align:start"><div style="color:#ffc107;font-size:.9rem">'+starsHtml+'</div><div style="font-size:.74rem;color:var(--text2);line-height:1.68;flex:1;font-style:italic">&ldquo;'+esc(data.text||'')+'&rdquo;</div><div style="display:flex;align-items:center;gap:.6rem"><div style="width:34px;height:34px;border-radius:50%;background:'+color+';display:flex;align-items:center;justify-content:center;font-size:.88rem;font-weight:900;color:#fff;flex-shrink:0">'+initial+'</div><div><div style="font-size:.78rem;font-weight:700;color:var(--text)">'+esc(data.nickname||'Trader')+'</div><div style="font-size:.6rem;color:var(--text3);margin-top:.06rem">📍 '+esc(data.location||'Angola')+'</div></div></div></div>'; }).join('');
      scroll.innerHTML=h;
    }).catch(function(){});
  }catch(e){}
};
