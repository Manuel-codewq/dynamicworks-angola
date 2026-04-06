/* ═══════════════════════════════════════════════════════════
   DynamicWorks Angola — contracts.js
   onContract (barreiras REAIS guardadas em S.barriers),
   portfolio, profit table, histórico, stats, live ops.
═══════════════════════════════════════════════════════════ */
'use strict';

/* ── onContract — FONTE DE VERDADE DAS BARREIRAS ── */
function onContract(d){
  if(!d.proposal_open_contract) return;
  var c=d.proposal_open_contract;

  /* ── Guardar barreiras REAIS vindas da Deriv ── */
  if(c.contract_id){
    var lo=null, hi=null;
    if(c.barrier&&c.low_barrier){
      hi=parseFloat(c.barrier);
      lo=parseFloat(c.low_barrier);
    } else if(c.high_barrier&&c.low_barrier){
      hi=parseFloat(c.high_barrier);
      lo=parseFloat(c.low_barrier);
    }
    if(lo&&hi&&lo>0&&hi>0){
      S.barriers[String(c.contract_id)]={lo:lo,hi:hi};
      /* atualizar o objeto contrato com os campos barrier normalizados */
      c._barrier_lo=lo;
      c._barrier_hi=hi;
      /* se este é o ativo selecionado, atualizar display imediatamente */
      if(c.underlying===S.asset.sym){
        var pip=S.asset.pip||4;
        txt('barrierLow', lo.toFixed(pip));
        txt('barrierHigh',hi.toFixed(pip));
        var pr=S.prices[c.underlying];
        if(pr){
          updateMeter(pr.p,lo,hi);
          _chartUpdateBarriers(lo,hi);
        }
      }
    }
  }

  /* contrato fechado (sold/expired/KO) */
  if(c.is_sold||c.status==='sold'||c.is_expired){
    if(_soldContracts[c.contract_id]) return;
    _soldContracts[c.contract_id]=true;
    setTimeout(function(){ delete _soldContracts[c.contract_id]; },300000);

    S.contracts=S.contracts.filter(function(x){ return x.contract_id!==c.contract_id; });
    delete S.tpMap[c.contract_id];
    delete S.barriers[String(c.contract_id)];

    var wasLoss=parseFloat(c.profit||0)<0;
    T.proposal=null; T.stake=0;

    var stakeInp=$('stakeAmt'); if(stakeInp) stakeInp.value='';
    document.querySelectorAll('.lot-btn').forEach(function(b){ b.classList.remove('active'); });

    var execB=$('execBtn');
    if(execB){ execB.disabled=true; execB.innerHTML='<svg data-lucide="zap" width="16" height="16"></svg> ABRIR ACUMULADOR'; if(window.lucide) lucide.createIcons(); }

    var pBox=$('proposalBox');
    if(pBox){ pBox.className='proposal-box'; pBox.innerHTML='<span style="font-size:.7rem;color:var(--text2)">Insere o stake para ver os detalhes do contrato</span>'; }

    /* limpar barreiras do gráfico se era o ativo ativo */
    if(c.underlying===S.asset.sym){
      txt('barrierLow','—'); txt('barrierHigh','—');
      updateMeter(S.prices[c.underlying]?S.prices[c.underlying].p:0,0,0);
    }

    /* cooldown após perda */
    if(wasLoss&&execB){
      var seconds=4; T._inCooldown=true;
      execB.disabled=true; execB.style.opacity='0.6';
      execB.innerHTML='⏳ Aguarda '+seconds+'s...';
      var cd=setInterval(function(){
        seconds--;
        if(seconds<=0){
          clearInterval(cd); T._inCooldown=false;
          execB.style.opacity='';
          execB.innerHTML='<svg data-lucide="zap" width="16" height="16"></svg> ABRIR ACUMULADOR';
          if(T.stake>=1) execB.disabled=false;
          if(window.lucide) lucide.createIcons();
        }else{ execB.innerHTML='⏳ Aguarda '+seconds+'s...'; }
      },1000);
    }

    if(!window._shownResults) window._shownResults={};
    if(window._shownResults[c.contract_id]) return;
    window._shownResults[c.contract_id]=true;
    setTimeout(function(){ delete window._shownResults[c.contract_id]; },600000);

    addHistory(c); renderContracts(); renderLiveOps(); renderHistory(); updateStats(); showResult(c);
    return;
  }

  /* contrato aberto / em curso */
  var idx=-1;
  S.contracts.forEach(function(x,i){ if(x.contract_id===c.contract_id) idx=i; });
  if(idx>=0) S.contracts[idx]=c; else S.contracts.push(c);
  renderContracts(); renderLiveOps(); updateStatsBar();
}

/* ── PORTFOLIO ── */
function loadPortfolio(){ wsSend({portfolio:1,contract_type:['ACCU']}); }
function onPortfolio(d){
  if(!d.portfolio||!d.portfolio.contracts) return;
  d.portfolio.contracts.forEach(function(c){
    wsSend({proposal_open_contract:1,contract_id:c.contract_id,subscribe:1});
  });
}

/* ── PROFIT TABLE ── */
function loadProfitTable(){
  var today=Math.floor(new Date().setHours(0,0,0,0)/1000);
  wsSend({profit_table:1,contract_type:['ACCU'],date_from:today,limit:50});
}
function onProfitTable(d){
  if(!d.profit_table||!d.profit_table.transactions) return;
  var derivEntries=d.profit_table.transactions
    .filter(function(t){ return t.underlying_symbol&&t.contract_id; })
    .map(function(t){
      return {
        contract_id:String(t.contract_id),
        underlying: t.underlying_symbol,
        profit:     parseFloat(t.profit||0),
        buy_price:  parseFloat(t.buy_price||0),
        growth_rate:parseFloat(t.growth_rate||0),
        tick_count: parseInt(t.tick_count||0),
        sell_time:  parseInt(t.sell_time||0)
      };
    });
  derivEntries.forEach(function(h){ _fbHistoryMap[h.contract_id]=h; });
  var existingIds={};
  S.history.forEach(function(h){ existingIds[String(h.contract_id)]=true; });
  derivEntries.forEach(function(h){
    if(!existingIds[String(h.contract_id)]){
      S.history.push(h); existingIds[String(h.contract_id)]=true;
    } else {
      for(var i=0;i<S.history.length;i++){
        if(String(S.history[i].contract_id)===String(h.contract_id)){
          S.history[i]=Object.assign({},S.history[i],h); break;
        }
      }
    }
  });
  S.history.sort(function(a,b){ return (b.sell_time||0)-(a.sell_time||0); });
  if(S.history.length>100) S.history=S.history.slice(0,100);
  renderHistory(); updateStats();
  _fbFlushHistory(); fbCleanupHistory();
}

function addHistory(c){
  var entry={
    contract_id:String(c.contract_id||''),
    underlying: c.underlying||c.underlying_symbol||'',
    profit:     parseFloat(c.profit||0),
    buy_price:  parseFloat(c.buy_price||0),
    growth_rate:parseFloat(c.growth_rate||0),
    tick_count: parseInt(c.tick_count||0),
    sell_time:  Math.floor(Date.now()/1000)
  };
  if(!entry.underlying||!entry.contract_id){ console.warn('addHistory: entrada inválida',entry); return; }
  S.history.unshift(entry);
  if(S.history.length>100) S.history.pop();
  fbSaveTrade(entry);
  fbRemoveOpenPosition(c.contract_id);
  _commissionOnTrade(entry.buy_price);
}

/* ── RENDER POSITIONS ── */
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
    /* mostrar barreiras reais se disponíveis */
    var rb=S.barriers[String(c.contract_id)];
    var barrierInfo=rb
      ?'<div style="font-size:.58rem;font-family:var(--mono);color:var(--text3);margin-top:.15rem">KO ▼ '+rb.lo.toFixed(4)+' | KO ▲ '+rb.hi.toFixed(4)+'</div>'
      :'';
    return '<div class="pos-card">'
      +'<div class="pos-card-top">'
      +'<div class="pos-info">'
      +'<span class="pos-sym">'+name+'</span>'
      +'<div style="display:flex;align-items:center;gap:.4rem;flex-wrap:wrap;margin-top:.25rem">'
      +'<span class="pos-meta">'+rate+'%/tick - '+(c.tick_count||0)+' ticks</span>'
      +(tp?'<span class="pos-tp-badge">TP $'+tp.toFixed(2)+'</span>':'')
      +'</div>'
      +barrierInfo
      +'</div>'
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

/* ── LIVE OPS OVERLAY ── */
function renderLiveOps(){
  var count=S.contracts.length;
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
      if(aoaEl&&TAXA_AOA) aoaEl.textContent='≈'+(totalP*TAXA_AOA).toFixed(0)+'Kz';
    }else{ badge.style.display='none'; }
  }
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
  txt('liveOpsCount',count);
}

/* ── HISTORY RENDER ── */
function renderHistory(){
  var el=$('tradeHistory'); if(!el) return;
  var valid=S.history.filter(function(h){ return h&&h.underlying&&h.underlying!==''&&h.sell_time>0; });
  if(!valid.length){ el.innerHTML='<div class="no-history">Sem operações registadas.</div>'; return; }
  el.innerHTML=valid.slice(0,30).map(function(h){
    var pr=parseFloat(h.profit)||0;
    var cls=pr>=0?'hist-win':'hist-loss';
    var a=ASSETS.find(function(x){ return x.sym===h.underlying; });
    var name=a?a.name:h.underlying;
    var rate=parseFloat(h.growth_rate)>=1?parseFloat(h.growth_rate).toFixed(0):(parseFloat(h.growth_rate)*100).toFixed(0);
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

/* ── STATS ── */
function updateStatsBar(){ txt('activeRate',T.rate+'%'); renderLiveOps(); }

function updateStats(){
  var h=S.history, total=h.length;
  var wins=h.filter(function(x){ return x.profit>0; }).length;
  var profit=h.reduce(function(s,x){ return s+x.profit; },0);
  var best=h.reduce(function(b,x){ return x.profit>b?x.profit:b; },0);
  var winTrades=h.filter(function(x){ return x.profit>0; });
  var avgProfit=winTrades.length>0?winTrades.reduce(function(s,x){ return s+x.profit; },0)/winTrades.length:0;
  var maxStreak=0,cur=0;
  h.slice().reverse().forEach(function(x){ if(x.profit>0){cur++;if(cur>maxStreak)maxStreak=cur;}else cur=0; });
  var byAsset={};
  h.forEach(function(x){ var a=x.underlying||'?'; byAsset[a]=(byAsset[a]||0)+x.profit; });
  var bestAsset='—',bestAssetVal=-Infinity;
  Object.keys(byAsset).forEach(function(a){ if(byAsset[a]>bestAssetVal){bestAssetVal=byAsset[a];bestAsset=a;} });
  var aMap={'R_10':'V10','R_25':'V25','R_50':'V50','R_75':'V75','R_100':'V100','1HZ10V':'V10s','1HZ25V':'V25s','1HZ50V':'V50s','1HZ75V':'V75s','1HZ100V':'V100s'};
  if(bestAsset!=='—') bestAsset=aMap[bestAsset]||bestAsset;
  txt('statTrades',total);
  txt('statWinRate',total>0?Math.round(wins/total*100)+'%':'—');
  txt('statProfit',(profit>=0?'+':'')+profit.toFixed(2)+'$');
  txt('statBestTrade','$'+best.toFixed(2));
  txt('statWinStreak',maxStreak||_winStreak);
  txt('statAvgProfit','$'+avgProfit.toFixed(2));
  txt('statBestAsset',bestAsset);
  var profEl=$('statProfit'); if(profEl) profEl.style.color=profit>=0?'var(--green)':'var(--red)';
  if(h.length>0) fbUpdateRanking(h[0].profit);
}

/* ── BALANCE RENDER ── */
function renderBalance(){
  var b=S.balance.toFixed(2);
  var aoa=Math.round(S.balance*TAXA_AOA).toLocaleString('pt-AO')+' AOA';
  var mode=S.isDemo?'DEMO':'REAL';
  try{ localStorage.setItem('dw_balance',S.balance); localStorage.setItem('dw_mode',S.isDemo?'Demo':'Real'); }catch(e){}
  ['balNum','balNum2'].forEach(function(id){ txt(id,b); });
  ['balMode','balMode2'].forEach(function(id){ txt(id,mode); });
  ['balAoa','balAoa2'].forEach(function(id){ var e=$(id); if(e){e.textContent=aoa;e.style.display='';} });
  txt('profileBalance','$'+b); txt('profileMode',S.isDemo?'Demo':'Real'); txt('profileBalanceAoa',aoa);
  var al=$('acctLabel'); if(al) al.textContent=(S.isDemo?'Demo ':'Real ')+S.acct;
}
window.syncBalance=renderBalance;

function renderNav(){
  txt('chAsset',S.asset?S.asset.name:'...');
  var navMode=$('navModeLabel'); if(navMode) navMode.textContent=S.isDemo?'Demo':'Real';
  var badge=$('profileBadge');
  if(badge){ badge.textContent=S.isDemo?'Demo':'Real'; badge.style.background=S.isDemo?'rgba(245,158,11,.15)':'rgba(0,230,118,.12)'; badge.style.color=S.isDemo?'#f59e0b':'#00e676'; }
  var displayName=_fb.nickname||'O meu perfil';
  txt('profileName',displayName);
  _renderProfileAvatar(_fb.nickname||'');
  var pA=$('profileAcctLabel'); if(pA) pA.style.display='none';
  var al=$('acctLabel');       if(al) al.style.display='none';
  var nb=$('notifBanner');
  if(nb){ var showNotif=('Notification' in window)&&Notification.permission==='default'; nb.style.display=showNotif?'flex':'none'; }
}
