/* Alternantes (abre/fecha) em TODAS as abas, no mesmo estilo das faixas coloridas da aba Mais.
   Não mexe na estrutura da página: só coloca uma faixa-título clicável no topo de cada bloco
   (ou transforma as faixas estáticas que já existiam em botões). O estado aberto/fechado é o
   mesmo mecanismo do ForjaUiSections (lembra no aparelho). Por padrão fica aberto só o bloco
   principal de cada aba. */
(function(root){
  'use strict';
  const doc=()=>root.document;
  // find: seletor de algum elemento DENTRO do bloco (o bloco é o .card mais próximo) — ou o próprio
  // elemento quando self:true. title/cls: texto e cor da faixa. open: aberto por padrão?
  const RULES=[
    // Início
    {id:'ini-creatina',find:'#creatine-week-card',self:true,title:'⚡ CREATINA DA SEMANA',cls:'recursos',open:false},
    {id:'ini-atalhos',find:'#home-health-status',title:'⚡ ATALHOS DO DIA',cls:'treino',open:true},
    {id:'ini-meta',find:'#weekly-goal-card',self:true,title:'🎯 META SEMANAL',cls:'treino',open:true},
    {id:'ini-balanco',find:'#weekly-calorie-card',self:true,title:'🥗 BALANÇO CALÓRICO DA SEMANA',cls:'comida',open:false},
    {id:'ini-comparacao',find:'#weekly-report-card',self:true,title:'📊 COMPARAÇÃO SEMANAL',cls:'corpo',open:false},
    // Corrida / Natação / CrossFit
    {id:'cor-registrar',find:'#corrida-print-file',title:'📷 REGISTRAR CORRIDA',cls:'treino',open:true},
    {id:'cor-graficos',find:'#corrida-charts',self:true,title:'📈 GRÁFICOS',cls:'corpo',open:false},
    {id:'nat-registrar',find:'#natacao-print-file',title:'📷 REGISTRAR NATAÇÃO',cls:'treino',open:true},
    {id:'nat-graficos',find:'#natacao-charts',self:true,title:'📈 GRÁFICOS',cls:'corpo',open:false},
    {id:'cf-wods',find:'#wod-library-card',self:true,title:'📚 MEUS WODS',cls:'treino',open:true},
    {id:'cf-registrar',find:'#crossfit-print-card',self:true,title:'📷 REGISTRAR CROSSFIT',cls:'treino',open:true},
    {id:'cf-graficos',find:'#crossfit-charts',self:true,title:'📈 GRÁFICOS',cls:'corpo',open:false},
    {id:'cf-ciencia',find:'#crossfit-science-card',self:true,title:'📚 CIÊNCIA DO CROSSFIT',cls:'sobre',open:false},
    // Academia (os cartões dos exercícios do treino NÃO entram: ficam sempre abertos)
    {id:'ac-hoje',find:'#today-list',title:'📝 TREINO DE HOJE',cls:'treino',open:true},
    {id:'ac-evolucao',find:'#gym-sessions-chart-card',self:true,title:'📈 EVOLUÇÃO DOS TREINOS',cls:'corpo',open:false},
    {id:'ac-meta',find:'#gym-weekly-goal-card',self:true,title:'🎯 META SEMANAL',cls:'corpo',open:false},
    {id:'ac-prontos',find:'#ready-workouts-card',self:true,title:'✨ TREINOS PRONTOS',cls:'recursos',open:false},
    {id:'ac-grupos',find:'#workout-groups-card',self:true,title:'📋 MEUS TREINOS',cls:'recursos',open:false},
    // Biblioteca
    {id:'bib-meus',find:'#lib-mine-list',title:'📸 MEUS EXERCÍCIOS',cls:'treino',open:true},
    {id:'bib-completa',find:'#lib-catalog-list',title:'🏋️ BIBLIOTECA COMPLETA',cls:'corpo',open:true},
    // Recompensas / Relatórios / Progresso
    {id:'rec-fichas',find:'#gym-rewards-card',self:true,title:'🪙 RECOMPENSAS',cls:'recursos',open:true},
    {id:'rel-calendario',find:'#gym-calendar-card',self:true,title:'📅 CALENDÁRIO',cls:'treino',open:true},
    {id:'rel-recordes',find:'#gym-records-card',self:true,title:'🏆 RECORDES (1RM ESTIMADO)',cls:'recursos',open:false},
    {id:'rel-volume',find:'#gym-volume-card',self:true,title:'📊 VOLUME TOTAL LEVANTADO',cls:'corpo',open:false},
    {id:'rel-duracao',find:'#gym-duration-card',self:true,title:'⏱ DURAÇÃO DOS TREINOS',cls:'corpo',open:false},
    {id:'pro-calendario',find:'#progress-month',title:'📅 PROGRESSO',cls:'treino',open:true},
    {id:'pro-musculos',find:'#progress-muscle-card',self:true,title:'💪 MÚSCULOS DO DIA',cls:'corpo',open:false},
    // Importar
    {id:'imp-comparar',find:'#photo-compare-card',self:true,title:'🔄 COMPARAR EVOLUÇÃO',cls:'corpo',open:false},
    // Dieta (as faixas "DIETA DE HOJE" e "LANÇAMENTO RÁPIDO" já existem no HTML e viram botões abaixo)
    {id:'die-refeicoes',find:'#diet-today-list',title:'📋 REFEIÇÕES DE HOJE',cls:'comida',open:true},
    {id:'die-historico',find:'#diet-history-list',title:'🗓 HISTÓRICO',cls:'sobre',open:false},
    // Cardápio
    {id:'car-semana',find:'#tab-cardapio > .card:first-child',self:true,title:'📋 CARDÁPIO DA SEMANA',cls:'comida',open:true},
    {id:'car-compras',find:'#shopping-list-card',self:true,title:'🛒 LISTA DE COMPRAS',cls:'recursos',open:false},
    // Corpo
    {id:'cor-peso',find:'#weight-current',title:'⚖️ PESO CORPORAL',cls:'corpo',open:true},
    {id:'cor-calc',find:'#calorie-calc-card',self:true,title:'🔥 CALCULADORA DE CALORIAS',cls:'recursos',open:false},
    {id:'cor-registros',find:'#body-list',title:'📋 ÚLTIMOS REGISTROS',cls:'sobre',open:false},
  ];
  // Faixas que já existiam no HTML (sem clique): viram botões. Padrão: fechadas, exceto as listadas.
  const HEADER_OPEN=['DIETA DE HOJE','LANÇAMENTO RÁPIDO'];
  const slug=(s)=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');

  function enhanceStaticHeaders(){
    doc().querySelectorAll('#tab-importar > .import-section-header:not([onclick]),#tab-dieta > .import-section-header:not([onclick])').forEach(h=>{
      if(h.dataset.sectionId)return;
      const text=h.textContent.trim();
      const id='hdr-'+slug(text);
      h.dataset.sectionId=id;
      h.dataset.defaultCollapsed=HEADER_OPEN.some(k=>text.includes(k))?'false':'true';
      h.classList.add('cc-static-head');
      h.setAttribute('role','button');h.tabIndex=0;
      h.onclick=()=>root.toggleSection(id);
      h.onkeydown=(e)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();root.toggleSection(id);}};
      const chev=doc().createElement('span');chev.className='section-chevron';chev.textContent='▾';h.append(chev);
    });
  }

  function attach(card,rule){
    if(card.dataset.sectionId||card.closest('.section-block'))return;
    card.classList.add('cc-card');
    card.dataset.sectionId='cc-'+rule.id;
    card.dataset.defaultCollapsed=rule.open?'false':'true';
    // esconde o título antigo do bloco (a faixa nova já tem o título)
    const head=card.querySelector(':scope > .card-head');
    if(head){
      if(head.querySelector('button,input,select'))head.classList.add('cc-old-head-keep');
      else head.classList.add('cc-old-head');
    }
    const btn=doc().createElement('button');
    btn.type='button';btn.className='cc-head import-section-header '+rule.cls;
    btn.innerHTML=rule.title+' <span class="section-chevron">▾</span>';
    btn.onclick=()=>root.toggleSection('cc-'+rule.id);
    card.prepend(btn);
    const nx=null; // 3.0: sem "Próximo bloco"
    // alguns blocos se redesenham por inteiro (innerHTML): recoloca a faixa se ela sumir
    try{
      const mo=new MutationObserver(()=>{if(!card.querySelector(':scope > .cc-head'))card.prepend(btn);});
      mo.observe(card,{childList:true});
    }catch{}
  }

  function enhanceTabs(){
    if(!doc())return;
    enhanceStaticHeaders();
    RULES.forEach(rule=>{
      let el=null;
      try{el=doc().querySelector(rule.find);}catch{}
      if(!el)return;
      const card=rule.self?el:(el.closest('.card')||el);
      attach(card,rule);
    });
  }
  root.ForjaCollapsible={enhanceTabs,RULES};
})(typeof globalThis!=='undefined'?globalThis:this);
