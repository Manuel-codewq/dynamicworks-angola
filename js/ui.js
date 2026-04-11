/* ═══════════════════════════════════════════════════════════
   DynamicWorks Angola — ui.js
   Educação, lessons, calculadora TP, tabs edu, apply pair.
═══════════════════════════════════════════════════════════ */
'use strict';

/* ── LESSONS ── */
var LESSONS=[
  {level:'beginner',    title:'O que são Accumulators?',           desc:'O preço precisa ficar dentro de um intervalo por cada tick. A cada tick que fica dentro, o teu lucro cresce pela taxa escolhida.',icon:'A'},
  {level:'beginner',    title:'Taxa de crescimento: 1% a 5%',      desc:'1% = barreira mais larga (mais seguro, menos lucro). 5% = barreira muito apertada (mais lucro, mais risco). Começa com 1% ou 2%.',icon:'%'},
  {level:'beginner',    title:'Como usar o Take Profit',           desc:'Define o objetivo de lucro (ex: $2 com stake de $10) e fecha automaticamente. Isso protege os teus ganhos.',icon:'T'},
  {level:'beginner',    title:'Pares recomendados para iniciantes', desc:'Usa sempre V10 ou V10(1s) para começar. São os mais estáveis e têm barreiras mais largas. Evita V75 e V100.',icon:'P'},
  {level:'intermediate',title:'Estratégia DW: Crescimento Seguro',  desc:'REGRA DE OURO: Usa V10, taxa 1%, stake fixo de 5% do saldo. Define TP de 20-30% do stake. Faz 5-10 trades/dia. Com $100, usa $5/trade e TP $1–1.50.',icon:'S'},
  {level:'intermediate',title:'Estratégia DW: Acumulação Composta', desc:'Começa com $1. Cada win, reinveste 50% do lucro. Mantém TP em 30%. Com disciplina, $10 pode virar $50 em dias bons sem grande risco.',icon:'C'},
  {level:'intermediate',title:'Gestão de risco — A regra dos 3%',   desc:'Nunca arrisques mais de 3% do saldo num único trade. Com $100 → máximo $3 por entrada. Isto protege-te de perdas grandes.',icon:'G'},
  {level:'intermediate',title:'Quando NÃO entrar no mercado',       desc:'Evita abrir trades logo após grandes spikes. Espera que o preço estabilize no centro do intervalo antes de entrar.',icon:'⚠'},
  {level:'advanced',    title:'Estratégia de Recuperação',          desc:'Após 2 perdas seguidas: para 5 minutos, muda para V10 taxa 1%, reduz o stake 50%. Nunca dupliques o stake para recuperar.',icon:'R'},
  {level:'advanced',    title:'Multi-contrato inteligente',         desc:'Abre 2 contratos pequenos em vez de 1 grande. Ex: 2x $5 em vez de 1x $10. Se um perde, o outro pode compensar. Usa pares diferentes.',icon:'M'},
  {level:'advanced',    title:'Leitura do Accumulator Meter',       desc:'Quando a barra está no centro (40-60%), é seguro entrar. Perto das extremidades (abaixo de 15% ou acima de 85%), há risco de knock-out.',icon:'📊'},
];
var LVLABEL={beginner:'Iniciante',intermediate:'Intermédio',advanced:'Avançado'};

window.filterLessons=function(level,btn){
  document.querySelectorAll('.edu-cat').forEach(function(b){b.classList.remove('active');});
  if(btn) btn.classList.add('active');
  renderLessons(level);
};

function renderLessons(filter){
  var el=$('lessonsList'); if(!el) return;
  var list=(!filter||filter==='all')?LESSONS:LESSONS.filter(function(l){return l.level===filter;});
  el.innerHTML=list.map(function(l){
    return '<div class="lesson-card"><div class="lesson-ico">'+l.icon+'</div><div class="lesson-body">'
      +'<div class="lesson-badge lesson-'+l.level+'">'+LVLABEL[l.level]+'</div>'
      +'<div class="lesson-title">'+l.title+'</div>'
      +'<div class="lesson-desc">'+l.desc+'</div>'
      +'</div></div>';
  }).join('')||'<div style="padding:1rem;color:var(--text3)">Sem lições.</div>';
}

/* ── EDUCAÇÃO TABS ── */
window.switchEduTab=function(tab,btnEl){
  document.querySelectorAll('.edu-main-tab').forEach(function(b){b.classList.remove('active');});
  document.querySelectorAll('.edu-tab-content').forEach(function(p){p.classList.remove('active');});
  if(btnEl) btnEl.classList.add('active');
  var panels={strategy:'eduPanelStrategy',pairs:'eduPanelPairs',lessons:'eduPanelLessons',videos:'eduPanelVideos'};
  var p=$(panels[tab]); if(p) p.classList.add('active');
  if(tab==='lessons') renderLessons('all');
  if(tab==='videos'&&window.lucide) lucide.createIcons();
};

/* ── CALCULADORA TAKE PROFIT ── */
window.calcTP=function(){
  var stake=parseFloat($('calcStake')&&$('calcStake').value)||10;
  var pct=parseFloat($('calcPct')&&$('calcPct').value)||40;
  var tp=(stake*pct/100).toFixed(2);
  var res=$('calcResult');
  if(res) res.innerHTML='Take Profit sugerido: <strong style="color:var(--green)">$'+tp+'</strong> — fecha quando lucro chegar a $'+tp+' ('+pct+'% do stake)';
};

/* ── APLICAR PAR DO GUIA ── */
window.applyPairFromGuide=function(sym){
  var a=ASSETS.find(function(x){return x.sym===sym;}); if(!a){toast('Par não encontrado','','error');return;}
  S.asset=a;
  txt('chAsset',a.name); txt('tradeAssetName',a.name);
  var pr=S.prices[sym];
  if(pr){txt('chPrice',pr.p.toFixed(a.pip));txt('tradeAssetPrice',pr.p.toFixed(a.pip));txt('spotNow',pr.p.toFixed(a.pip));}
  if(typeof renderAssetList==='function') renderAssetList();
  goToView('v-trade',$('bnTrade'));
  toast('Par selecionado!',a.name+' — pronto para operar','success');
};
