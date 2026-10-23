/* Forja 3.0 — navegação recolhida, Início/Água/Comida/Corpo novos, metas, atividades e a variante Essencial.
   Variante: <body data-forja-variant="essencial"> mostra só Início, Comida, Água, Atividade, Peso, Meus dados e Mais. */
(function(root){
'use strict';
const doc=root.document;
const S=()=>root.ForjaStorage||root.storage;
async function getJ(k,def){try{const r=await S().get(k);return r&&r.value!=null&&r.value!==''?JSON.parse(r.value):def;}catch{return def;}}
async function setJ(k,v){await S().set(k,JSON.stringify(v));}
const isEss=()=>doc.body.dataset.forjaVariant==='essencial';
const $=id=>doc.getElementById(id);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const nf=n=>Math.round(n||0).toLocaleString('pt-BR');
const tk=(d)=>root.todayKey(d);
const tap=()=>{try{root.navigator?.vibrate?.(8);}catch{}};
const DIAS=['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'];
const MESES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function dataLonga(key){const [y,m,d]=key.split('-').map(Number);const dt=new Date(y,m-1,d,12);return `${DIAS[dt.getDay()]} · ${d} ${MESES[m-1]}`;}
function diaRel(key){const h=tk();if(key===h)return 'Hoje';const o=tk(new Date(Date.now()-864e5));if(key===o)return 'Ontem';const [y,m,d]=key.split('-').map(Number);const dt=new Date(y,m-1,d,12);return `${DIAS[dt.getDay()].slice(0,3).toLowerCase()} ${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`;}
function toast(msg,action){root.showToast?.(msg,action);}

// ===================== navegação =====================
const NOMES={meta:'Minha meta',inicio:'Início',corrida:'Corrida',natacao:'Natação',crossfit:'CrossFit',academia:'Academia',biblioteca:'Exercícios',recompensas:'Recompensas',relatorios:'Relatórios',progresso:'Progresso',corpo:'Peso e corpo',agua:'Água',dieta:'Comida',cardapio:'Cardápio',importar:'Importar',mais:'Mais',dados:'Meus dados',atividade:'Atividade'};
const EXTRA_TABS=['dados','atividade','meta'];
const ESS_TABS=['inicio','dieta','agua','atividade','corpo','meta','dados','mais'];
function onSwitch(tab){
  if(isEss()&&!ESS_TABS.includes(tab))tab='inicio';
  doc.body.classList.toggle('in-section',tab!=='inicio');
  doc.body.classList.remove('tabs-open');
  const b=$('sb-trocar');if(b)b.setAttribute('aria-expanded','false');
  const n=$('sb-nome');if(n)n.textContent=NOMES[tab]||tab;
  EXTRA_TABS.forEach(t=>{const el=$('tab-'+t);if(el)el.style.display=t===tab?'':'none';});
  doc.querySelectorAll('.tab[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab===tab));
  if(tab==='dados')renderDados();
  if(tab==='atividade')renderAtividade();
  if(tab==='meta')root.ForjaMeta?.render?.();
  if(tab==='mais')renderMetasCard();
  try{root.scrollTo({top:0});}catch{}
}
function toggleTabs(){const on=doc.body.classList.toggle('tabs-open');const b=$('sb-trocar');if(b)b.setAttribute('aria-expanded',String(on));}
doc.addEventListener('click',e=>{const t=e.target.closest&&e.target.closest('.tabs .tab');if(t&&doc.body.classList.contains('tabs-open'))doc.body.classList.remove('tabs-open');});
function go(tab){tap();root.switchTab(tab);}

// ===================== metas =====================
const META_PADRAO={modo:'fixo',kcal:null,protein_g:null,carbs_g:null,fat_g:null,water:null,tmb:null,fator:1.2,deficit:300};
async function loadMetas(){return {...META_PADRAO,...await getJ('f3-metas',{})};}
async function applyMetas(){
  const m=await loadMetas();
  try{
    if(m.kcal)root.NUTRITION_GOAL_F3={...m};
    if(typeof NUTRITION_GOAL!=='undefined'){/* eslint-disable-line */
      if(m.kcal)NUTRITION_GOAL.kcal=m.kcal; // eslint-disable-line no-undef
      if(m.protein_g)NUTRITION_GOAL.protein_g=m.protein_g; // eslint-disable-line no-undef
      if(m.carbs_g)NUTRITION_GOAL.carbs_g=m.carbs_g; // eslint-disable-line no-undef
      if(m.fat_g)NUTRITION_GOAL.fat_g=m.fat_g; // eslint-disable-line no-undef
    }
    if(m.water&&typeof waterDailyGoal!=='undefined'){waterDailyGoal=m.water;await S().set('water-daily-goal',String(m.water));} // eslint-disable-line no-undef
  }catch(e){console.warn('metas',e);}
  return m;
}
async function dynamicGoal(date,activity){
  const m=await loadMetas();if(m.modo!=='dinamico'||!m.tmb)return null;
  return Math.max(1000,Math.round(m.tmb*(m.fator||1.2)+(activity||0)-(m.deficit||0)));
}
async function goalParts(date){
  const m=await loadMetas();const act=await activityKcal(date);
  if(m.modo!=='dinamico'||!m.tmb)return null;
  const base=Math.round(m.tmb),dia=Math.round(m.tmb*((m.fator||1.2)-1));
  return {base,dia,act:Math.round(act),def:Math.round(m.deficit||0),total:Math.max(1000,base+dia+Math.round(act)-Math.round(m.deficit||0))};
}

// ===================== atividades (kcal) =====================
const ATIVIDADES=[
  // MET moderado (Compêndio de Atividades Físicas): estimativa conservadora
  {k:'academia',l:'Academia',met:4.5,ic:'🏋️'},{k:'musculacao',l:'Musculação',met:4,ic:'💪'},{k:'natacao',l:'Natação',met:6,ic:'🏊'},
  {k:'spinning',l:'Spinning',met:7,ic:'🚴'},{k:'caminhada',l:'Caminhada',met:3.5,ic:'🚶'},{k:'corrida',l:'Corrida',met:8.5,ic:'🏃'},
  {k:'funcional',l:'Funcional',met:6,ic:'🔥'},{k:'outro',l:'Outro',met:4.5,ic:'✳️'}];
async function loadAct(){return await getJ('f3-activities',[]);}
async function activityKcal(date){const a=await loadAct();return a.filter(x=>x.date===date).reduce((s,x)=>s+(x.kcal||0),0);}
let actDraft={tipo:'academia',min:45,kcal:null};
async function pesoAtual(){let w=null;try{w=await root.getLastWeightValue?.();}catch{}return Number(w)>25?Number(w):70;}
async function estimaKcal(tipo,min){const a=ATIVIDADES.find(x=>x.k===tipo)||ATIVIDADES[0];return Math.round(a.met*(await pesoAtual())*min/60);}
async function renderAtividade(){
  const host=$('tab-atividade');if(!host)return;
  const est=await estimaKcal(actDraft.tipo,actDraft.min);const kcal=actDraft.kcal??est;
  const all=await loadAct();const hoje=tk();
  const today=all.filter(x=>x.date===hoje);const tot=today.reduce((s,x)=>s+x.kcal,0);
  const hist=[...all].sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)).filter(x=>x.date!==hoje).slice(0,20);
  const row=x=>{const a=ATIVIDADES.find(y=>y.k===x.tipo)||{l:x.tipo,ic:'✳️'};return `<div class="act-row"><span class="act-ic">${a.ic}</span><span class="act-tx"><b>${esc(a.l)}</b><small>${x.min} min${x.date!==hoje?' · '+esc(diaRel(x.date)):''}</small></span><span class="act-k">${nf(x.kcal)} kcal</span><button type="button" class="act-x" aria-label="Apagar" onclick="Forja3.delAct('${x.id}')">✕</button></div>`;};
  host.innerHTML=`<div class="f3-card">
    <div class="f3-t">Registrar atividade</div>
    <div class="chips-tipo">${ATIVIDADES.map(a=>`<button type="button" class="${actDraft.tipo===a.k?'on':''}" onclick="Forja3.actSet('tipo','${a.k}')"><span>${a.ic}</span>${a.l}</button>`).join('')}</div>
    <div class="f3-lbl">Quanto tempo?</div>
    <div class="num-big"><button type="button" onclick="Forja3.actSet('min',-5)" aria-label="Menos 5 minutos">−</button><b>${actDraft.min}<small>min</small></b><button type="button" onclick="Forja3.actSet('min',5)" aria-label="Mais 5 minutos">+</button></div>
    <div class="chips-min">${[20,30,45,60,90].map(v=>`<button type="button" class="${actDraft.min===v?'on':''}" onclick="Forja3.actSet('minAbs',${v})">${v}</button>`).join('')}</div>
    <div class="f3-lbl">Calorias gastas</div>
    <div class="num-big k"><button type="button" onclick="Forja3.actSet('kcal',-10)" aria-label="Menos 10 kcal">−</button><b>${nf(kcal)}<small>kcal</small></b><button type="button" onclick="Forja3.actSet('kcal',10)" aria-label="Mais 10 kcal">+</button></div>
    <p class="f3-nota">${actDraft.kcal==null?'Estimativa pelo tipo, tempo e seu peso. Se o relógio ou a máquina mostrou outro número, ajuste com − e +.':`Ajustado por você · estimativa era ${nf(est)} kcal · <button type="button" class="lnk" onclick="Forja3.actSet('reset')">usar estimativa</button>`}</p>
    <button type="button" class="f3-cta" onclick="Forja3.saveAct()">✓ Registrar ${nf(kcal)} kcal</button></div>
    <div class="f3-card"><div class="f3-t">Hoje <span>${nf(tot)} kcal</span></div>${today.length?today.map(row).join(''):'<p class="f3-vazio">Nenhuma atividade hoje. O que você registrar aqui aumenta a meta de comida do dia.</p>'}</div>
    ${hist.length?`<div class="f3-card"><div class="f3-t">Anteriores</div>${hist.map(row).join('')}</div>`:''}`;
}
async function actSet(campo,v){
  tap();
  if(campo==='tipo'){actDraft.tipo=v;actDraft.kcal=null;}
  else if(campo==='min'){actDraft.min=Math.max(5,actDraft.min+v);actDraft.kcal=null;}
  else if(campo==='minAbs'){actDraft.min=v;actDraft.kcal=null;}
  else if(campo==='kcal'){const base=actDraft.kcal??await estimaKcal(actDraft.tipo,actDraft.min);actDraft.kcal=Math.max(0,base+v);}
  else if(campo==='reset')actDraft.kcal=null;
  renderAtividade();
}
async function saveAct(){
  tap();const kcal=actDraft.kcal??await estimaKcal(actDraft.tipo,actDraft.min);
  const a=await loadAct();const id=root.cid?root.cid():String(Date.now());
  a.push({id,date:tk(),time:root.nowTime?root.nowTime():'',tipo:actDraft.tipo,min:actDraft.min,kcal});
  await setJ('f3-activities',a);actDraft.kcal=null;
  const nm=(ATIVIDADES.find(x=>x.k===actDraft.tipo)||{}).l;
  toast(`${nm} registrada: ${nf(kcal)} kcal`,{label:'Desfazer',onClick:()=>delAct(id,true)});
  await renderAtividade();await root.renderDashboard?.();
}
async function delAct(id,silent){
  const a=await loadAct();const x=a.find(y=>y.id===id);await setJ('f3-activities',a.filter(y=>y.id!==id));
  if(!silent&&x)toast('Atividade apagada.',{label:'Desfazer',onClick:async()=>{const b=await loadAct();b.push(x);await setJ('f3-activities',b);renderAtividade();root.renderDashboard?.();}});
  await renderAtividade();await root.renderDashboard?.();
}

// ===================== suplementos =====================
const SUPL_PADRAO=[{id:'creatina',nome:'Creatina',dose:'5 g',tipo:'creatina'},{id:'whey',nome:'Whey',dose:'1 scoop',kcal:120,protein_g:24,carbs_g:3,fat_g:1}];
async function loadSupl(){return await getJ('f3-supl',SUPL_PADRAO);}
async function suplHoje(){const log=await getJ('f3-supl-log',{});const cre=await getJ('creatine-days-v1',[]);const h=tk();const s=new Set(log[h]||[]);if(cre.includes(h))s.add('creatina');return s;}
async function toggleSupl(id){
  tap();const h=tk();const list=await loadSupl();const it=list.find(x=>x.id===id);if(!it)return;
  const log=await getJ('f3-supl-log',{});const day=new Set(log[h]||[]);
  let cre=await getJ('creatine-days-v1',[]);
  const ja=it.tipo==='creatina'?cre.includes(h):day.has(id);
  if(ja){
    if(it.tipo==='creatina')cre=cre.filter(d=>d!==h);else day.delete(id);
    log[h]=[...day];await setJ('f3-supl-log',log);await setJ('creatine-days-v1',cre);
    if(it.dietId){/* remove o lançamento do whey */try{await root.deleteDietEntry?.(it.dietId);}catch{}}
    toast(`${it.nome} desmarcado.`);
  }else{
    if(it.tipo==='creatina'){cre.push(h);cre=[...new Set(cre)].sort();}else day.add(id);
    log[h]=[...day];await setJ('f3-supl-log',log);await setJ('creatine-days-v1',cre);
    if(it.kcal){
      const meal=mealDaHora();
      try{await lancarComida({description:`${it.nome} (${it.dose})`,kcal:it.kcal,protein_g:it.protein_g??null,carbs_g:it.carbs_g??null,fat_g:it.fat_g??null},meal,true);}catch{}
      toast(`${it.nome} marcado e lançado: ${it.kcal} kcal${it.protein_g?` · P ${it.protein_g} g`:''}`);
    }else toast(`${it.nome} de hoje marcado ✓`);
  }
  await renderHome();root.ForjaCreatine?.render?.();
}
async function suplStreak(){const cre=new Set(await getJ('creatine-days-v1',[]));let n=0;const d=new Date();if(!cre.has(tk(d)))d.setDate(d.getDate()-1);while(cre.has(tk(d))&&n<999){n++;d.setDate(d.getDate()-1);}return n;}

// ===================== comida: lançar =====================
function mealDaHora(){const h=new Date().getHours();if(h<10)return 'cafe';if(h<15)return 'almoco';if(h<18)return 'lanche';if(h<22)return 'janta';return 'ceia';}
async function lancarComida(value,mealKey,silent){
  const date=(typeof selectedDietDate!=='undefined'&&!silent)?selectedDietDate:tk(); // eslint-disable-line no-undef
  await root.loadDietCache?.();
  const count=(typeof dietCache!=='undefined'?dietCache:[]).filter(e=>e.date===date&&e.mealType===mealKey).length; // eslint-disable-line no-undef
  const prevSel=typeof selectedDietDate!=='undefined'?selectedDietDate:null; // eslint-disable-line no-undef
  if(silent&&prevSel!==null&&prevSel!==date){selectedDietDate=date;} // eslint-disable-line no-undef
  await root.ForjaDietBridge.saveQuick({...value,mealType:mealKey,mealNumber:count+1});
  if(silent&&prevSel!==null&&prevSel!==date){selectedDietDate=prevSel;} // eslint-disable-line no-undef
}

// ===================== INÍCIO =====================
async function trainedToday(){
  const h=tk();try{const ws=await root.ForjaGymTraining?.loadWorkouts?.();if((ws||[]).some(e=>e.date===h))return true;}catch{}
  try{const sd=await root.loadCombinedSportDates?.();if(sd&&sd.has&&sd.has(h))return true;}catch{}
  return (await loadAct()).some(x=>x.date===h);
}
async function waterHoje(){const arr=await root.loadBody();return Math.max(0,Math.round(arr.filter(e=>e.type==='water'&&e.date===tk()).reduce((s,e)=>s+root.waterMl(e),0)));}
function ring(pct,cls,val,lbl){return `<div class="an3"><span class="ar3 ${cls}" style="--p:${Math.max(0,Math.min(100,Math.round(pct)))}"><b>${val}</b></span><small>${lbl}</small></div>`;}
async function renderHome(){
  const host=$('hoje3');if(!host)return;
  const ess=isEss();const h=tk();
  const dados=await getJ('f3-dados',{});const nome=dados.apelido||(ess?'':'Daniel');
  const hr=new Date().getHours();const saud=hr<12?'Bom dia':hr<18?'Boa tarde':'Boa noite';
  const goalW=(typeof waterDailyGoal!=='undefined'?waterDailyGoal:2000); // eslint-disable-line no-undef
  const w=await waterHoje();
  const sum=await root.computeDietDaySummary(h);const goal=sum.goal||0;const comido=Math.round(sum.comido||0);
  const act=await activityKcal(h);
  const falta=Math.max(0,goal-comido);
  const treinou=await trainedToday();
  const atvMeta=await (root.ForjaMeta?.ativMeta?.()??0);
  const rings=ess
    ?ring(w/goalW*100,'agua',(w/1000).toFixed(1).replace('.',',')+' L','Água')+ring(goal?comido/goal*100:0,'comida',nf(comido),'kcal comidas')+ring(Math.min(100,act/(atvMeta||300)*100),'ativ',nf(act),'kcal gastas')
    :ring(treinou?100:0,'treino',treinou?'✓':'0/1','Treino')+ring(w/goalW*100,'agua',(w/1000).toFixed(1).replace('.',',')+' L','Água')+ring(goal?comido/goal*100:0,'comida',nf(comido),'kcal');
  const frases=[];
  if(!ess&&!treinou){try{const ng=await root.ForjaGymUI?.nextGroup?.();frases.push(ng?`${esc(ng.g.name)} te espera`:'Dia de treinar?');}catch{frases.push('Dia de treinar?');}}
  if(w<goalW)frases.push(`faltam ${((goalW-w)/1000).toFixed(1).replace('.',',')} L de água`);
  if(goal)frases.push(comido>goal?`${nf(comido-goal)} kcal acima da meta`:`faltam ${nf(falta)} kcal`);
  const fechado=(ess||treinou)&&w>=goalW&&goal&&comido>0&&comido<=goal;
  const frase=fechado?'Dia fechado 🔥':(frases.join(' · ')||'Bom dia para começar');
  const bento=ess
    ?[['🍽','Refeição',"Forja3.go('dieta')",''],['💧','+250 ml','Forja3.addWater(250)','az'],['🔥','Atividade',"Forja3.go('atividade')",'am'],['⚖️','Peso',"Forja3.go('corpo')",'ro']]
    :[['🍽','Refeição',"Forja3.go('dieta')",''],['💧','+250 ml','Forja3.addWater(250)','az'],['🏋️','Treinar',"Forja3.go('academia')",'vm'],['💊','Suplem.',"document.getElementById('supl3')?.scrollIntoView({behavior:'smooth',block:'center'})",'am']];
  let html=`<div class="hoje3-p"><div class="hd3">${dataLonga(h)}</div><div class="ht3">${saud}${nome?', '+esc(nome):''}</div><div class="aneis3">${rings}</div><div class="frase3">${frase}</div></div>
    <div class="bento4">${bento.map(([ic,l,fn,c])=>`<button type="button" class="${c}" onclick="${fn}"><span class="ic">${ic}</span><b>${l}</b></button>`).join('')}</div>`;
  try{html+=await root.ForjaMeta.homeCard();}catch{}
  // calorias do dia (essencial: em destaque)
  const parts=await goalParts(h);
  if(ess||parts){
    html+=`<div class="kcal3 f3-card"><div class="f3-t">Calorias de hoje <span>${goal?`meta ${nf(goal)}`:''}</span></div>
      ${ess&&!parts?`<div class="k3-big">Falta sua meta</div><p class="f3-nota">Importe o exame em Meus dados e o app calcula quanto comer por dia.</p><button type="button" class="f3-cta sec" onclick="Forja3.go('dados')">Abrir Meus dados</button>`:`<div class="k3-big ${comido>goal&&goal?'acima':''}">${goal?(comido>goal?`${nf(comido-goal)} kcal acima`:`Faltam ${nf(falta)} kcal`):'Defina sua meta'}</div>`}
      ${parts?`<div class="k3-conta"><span>Basal ${nf(parts.base)}</span><span>+ dia a dia ${nf(parts.dia)}</span><span>+ atividades ${nf(parts.act)}</span><span>− ${nf(parts.def)} para emagrecer</span></div>`:''}
      <div class="k3-bar"><i style="width:${goal?Math.min(100,comido/goal*100):0}%"></i></div>
      <div class="k3-leg"><span>Comidas ${nf(comido)}</span><span>Atividades ${nf(act)}</span></div></div>`;
  }
  if(!ess){
    const list=await loadSupl();const feitos=await suplHoje();const st=await suplStreak();
    html+=`<div class="supl3 f3-card" id="supl3"><div class="f3-t">Suplementos <span>hoje</span></div>
      <div class="supl-c3">${list.map(it=>`<button type="button" class="${feitos.has(it.id)?'ok':''}" aria-pressed="${feitos.has(it.id)}" onclick="Forja3.toggleSupl('${it.id}')">${feitos.has(it.id)?'✓ ':''}${esc(it.nome)} ${esc(it.dose||'')}</button>`).join('')}<button type="button" class="mais" onclick="Forja3.editSupl()">+ Outro</button></div>
      <div class="sem7-3">${(await semanaCreatina()).map(x=>`<i class="${x.f?'f':''}${x.h?' h':''}"></i>`).join('')}<small>creatina: ${st} dia${st===1?'':'s'} seguido${st===1?'':'s'}</small></div></div>`;
    try{
      const t=root.ForjaGymTraining;const status=await t.computeWeeklyGoal();
      const sub=status.compensating?`${status.baseGoal} da meta + ${status.shortfall} da semana passada`:'treinos na semana';
      html+=`<div class="semana"><div class="dias">${await diasSemanaTreino()}</div><div><b>${status.done} de ${status.target}</b><small>${sub}</small></div></div>`;
    }catch{}
  }
  host.innerHTML=html;
}
async function semanaCreatina(){const cre=new Set(await getJ('creatine-days-v1',[]));const d=new Date();const dow=(d.getDay()+6)%7;const mon=new Date(d.getFullYear(),d.getMonth(),d.getDate()-dow,12);return Array.from({length:7},(_,i)=>{const x=new Date(mon);x.setDate(mon.getDate()+i);const k=tk(x);return{f:cre.has(k),h:k===tk()};});}
async function diasSemanaTreino(){
  const t=root.ForjaGymTraining;const ws=await t.loadWorkouts();const ss=await t.loadSessionsCache();let sd=new Set();try{sd=await root.loadCombinedSportDates();}catch{}
  const set=new Set([...ws.map(e=>e.date),...ss.map(s=>s.date),...sd]);
  const d=new Date();const dow=(d.getDay()+6)%7;const mon=new Date(d.getFullYear(),d.getMonth(),d.getDate()-dow,12);
  return ['S','T','Q','Q','S','S','D'].map((l,i)=>{const x=new Date(mon);x.setDate(mon.getDate()+i);const k=tk(x);return `<i class="${set.has(k)?'f':''}${k===tk()?' h':''}">${l}</i>`;}).join('');
}
async function editSupl(){
  tap();const list=await loadSupl();
  abrirFolha(`<div class="f3-t">Suplementos</div><p class="f3-nota">Toque no Início marca o dia. Se o suplemento tem calorias (como o whey), ele também é lançado na comida.</p>
    ${list.map(it=>`<div class="supl-ed"><b>${esc(it.nome)}</b><small>${esc(it.dose||'')}${it.kcal?` · ${it.kcal} kcal · P ${it.protein_g||0} g`:''}</small>${it.id==='creatina'?'':`<button type="button" onclick="Forja3.removeSupl('${it.id}')">Remover</button>`}</div>`).join('')}
    <div class="f3-lbl">Novo suplemento</div>
    <input id="s3-nome" placeholder="Nome (ex.: Ômega 3)"><input id="s3-dose" placeholder="Dose (ex.: 2 cápsulas)">
    <div class="duas3"><input id="s3-kcal" type="number" inputmode="numeric" placeholder="kcal (se tiver)"><input id="s3-p" type="number" inputmode="decimal" placeholder="Proteína g"></div>
    <button type="button" class="f3-cta" onclick="Forja3.addSupl()">Adicionar</button>`);
}
async function addSupl(){const nome=($('s3-nome')?.value||'').trim();if(!nome){toast('Escreva o nome do suplemento.');return;}const list=await loadSupl();list.push({id:'s'+Date.now(),nome,dose:($('s3-dose')?.value||'').trim(),kcal:parseFloat($('s3-kcal')?.value)||0,protein_g:parseFloat(String($('s3-p')?.value||'').replace(',','.'))||0});await setJ('f3-supl',list);fecharFolha();toast(`${nome} adicionado.`);renderHome();}
async function removeSupl(id){const list=await loadSupl();await setJ('f3-supl',list.filter(x=>x.id!==id));fecharFolha();renderHome();}

// ===================== folha genérica =====================
function abrirFolha(html){
  let f=$('folha3');if(!f){f=doc.createElement('div');f.id='folha3';f.innerHTML='<div class="f3-dim" onclick="Forja3.fecharFolha()"></div><div class="f3-caixa" role="dialog" aria-modal="true"><div class="f3-alca"></div><button type="button" class="f3-x" aria-label="Fechar" onclick="Forja3.fecharFolha()">✕</button><div class="f3-corpo"></div></div>';doc.body.appendChild(f);}
  f.querySelector('.f3-corpo').innerHTML=html;f.hidden=false;doc.body.classList.add('folha3-open');
  try{root.history.pushState({folha3:1},'');}catch{}
}
function fecharFolha(fromPop){const f=$('folha3');if(!f||f.hidden)return;f.hidden=true;doc.body.classList.remove('folha3-open');if(!fromPop){try{if(root.history.state&&root.history.state.folha3)root.history.back();}catch{}}}
root.addEventListener('popstate',()=>{const f=$('folha3');if(f&&!f.hidden)fecharFolha(true);});

// ===================== ÁGUA =====================
let ultimoCopo=null;
async function addWater(ml){
  tap();const h=(typeof selectedWaterDate!=='undefined'&&doc.body.classList.contains('in-section'))?selectedWaterDate:tk(); // eslint-disable-line no-undef
  const arr=await root.loadBody();const id=root.cid();
  const next=[...arr,{id,date:h,time:root.nowTime(),type:'water',ml}];
  await root.saveBody(next);ultimoCopo={id,ml,time:root.nowTime()};
  toast(`+${ml} ml de água`,{label:'Desfazer',onClick:()=>undoWater(id)});
  await root.renderBody?.();await root.renderDashboard?.();
}
async function undoWater(id){const arr=await root.loadBody();await root.saveBody(arr.filter(e=>e.id!==id));toast('Água desfeita.');await root.renderBody?.();await root.renderDashboard?.();}
async function renderWater(){
  const host=$('agua3');if(!host)return;
  const goal=(typeof waterDailyGoal!=='undefined'?waterDailyGoal:2000); // eslint-disable-line no-undef
  const date=typeof selectedWaterDate!=='undefined'?selectedWaterDate:tk(); // eslint-disable-line no-undef
  const arr=await root.loadBody();const dayE=arr.filter(e=>e.type==='water'&&e.date===date);
  const tot=Math.max(0,Math.round(dayE.reduce((s,e)=>s+root.waterMl(e),0)));
  const last=[...dayE].filter(e=>!e.adjustment).sort((a,b)=>String(a.time).localeCompare(String(b.time))).pop();
  const pct=Math.min(100,Math.round(tot/goal*100));
  const dias=[];for(let i=13;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const k=tk(d);const v=arr.filter(e=>e.type==='water'&&e.date===k).reduce((s,e)=>s+root.waterMl(e),0);dias.push({k,v});}
  host.innerHTML=`<div class="dia3"><button type="button" aria-label="Dia anterior" onclick="shiftWaterDate(-1)">‹</button><b>${diaRel(date)}</b><button type="button" aria-label="Próximo dia" onclick="shiftWaterDate(1)" ${date>=tk()?'disabled':''}>›</button></div>
    <div class="garrafa3"><div class="g3-garrafa"><div class="g3-tampa"></div><div class="g3-corpo"><i style="height:${pct}%"></i></div></div>
      <div class="g3-num"><b>${(tot/1000).toFixed(2).replace('.',',').replace(/0$/,'')} L</b><small>de ${(goal/1000).toFixed(1).replace('.',',')} L · ${tot>=goal?'meta batida 🎉':`faltam ${nf(goal-tot)} ml`}</small>${last?`<span>último: ${nf(root.waterMl(last))} ml às ${esc(last.time)}</span>`:''}</div></div>
    <div class="copos3"><button type="button" onclick="Forja3.addWater(250)"><b>250</b>copo</button><button type="button" onclick="Forja3.addWater(500)"><b>500</b>garrafa</button><button type="button" class="o" onclick="Forja3.outroAgua()"><b>Outro</b>ml ou goles</button></div>
    <div class="b14-3"><div class="b14-h"><b>14 dias</b><span>meta ${(goal/1000).toFixed(1).replace('.',',')} L</span></div><div class="b14-b">${dias.map(d=>`<i class="${d.v>=goal?'m':''}${d.v<=0?' z':''}${d.k===tk()?' h':''}" style="height:${d.v>0?Math.max(6,Math.min(100,d.v/goal*100)):4}%" title="${d.k}: ${nf(d.v)} ml"></i>`).join('')}</div></div>
    <button type="button" class="ajustar3" onclick="Forja3.toggleAjustarAgua()">Ajustar meta, goles, lembretes e zerar ›</button>`;
}
function outroAgua(){
  tap();abrirFolha(`<div class="f3-t">Quanto você bebeu?</div><div class="chips-min ml">${[100,150,200,300,350,400,600,750,1000].map(v=>`<button type="button" onclick="Forja3.fecharFolha();Forja3.addWater(${v})">${v} ml</button>`).join('')}</div>
    <p class="f3-nota">Bebeu no bebedouro e não sabe quanto? Use os goles em "Ajustar".</p>`);
}
function toggleAjustarAgua(){tap();doc.body.classList.toggle('agua-ajustar');if(doc.body.classList.contains('agua-ajustar'))$('agua-old')?.scrollIntoView({behavior:'smooth',block:'start'});}

// ===================== COMIDA =====================
const MEAL_ORDER=['cafe','almoco','lanche','janta','ceia','livre'];
async function renderDiet(){
  const host=$('diet3');if(!host)return;
  const date=typeof selectedDietDate!=='undefined'?selectedDietDate:tk(); // eslint-disable-line no-undef
  await root.loadDietCache();const all=(typeof dietCache!=='undefined'?dietCache:[]); // eslint-disable-line no-undef
  const day=all.filter(e=>e.date===date);
  const sum=await root.computeDietDaySummary(date);const goal=Math.round(sum.goal||0);const com=Math.round(sum.comido||0);
  const G=(typeof NUTRITION_GOAL!=='undefined'?NUTRITION_GOAL:{protein_g:0,carbs_g:0,fat_g:0}); // eslint-disable-line no-undef
  const P=day.reduce((s,e)=>s+(e.protein_g||0),0),C=day.reduce((s,e)=>s+(e.carbs_g||0),0),F=day.reduce((s,e)=>s+(e.fat_g||0),0);
  const bar=(l,v,g,c)=>`<div class="mac3"><span>${l}</span><b>${nf(v)}${g?`/${nf(g)}`:''} g</b><i><em style="width:${g?Math.min(100,v/g*100):0}%;background:${c}"></em></i></div>`;
  const types=(typeof MEAL_TYPES!=='undefined'?MEAL_TYPES:[]); // eslint-disable-line no-undef
  const parts=await goalParts(date);
  const meals=MEAL_ORDER.map(k=>types.find(t=>t.key===k)).filter(Boolean).map(t=>{
    const es=day.filter(e=>(e.mealType||'livre')===t.key);const tot=es.reduce((s,e)=>s+(e.kcal||0),0);
    if(t.key==='livre'&&!es.length)return '';
    return `<div class="ref3${es.length?'':' vz'}"><div class="rh3"><b>${t.emoji} ${t.label}</b>${es.length?`<span>${nf(tot)} kcal</span>`:''}<button type="button" class="add3" onclick="Forja3.abrirAdicionar('${t.key}')">+ Adicionar</button></div>
      ${es.map(e=>`<div class="it3"><span>${esc(e.description)}</span><small>${nf(e.kcal)} kcal${e.protein_g!=null?` · P ${nf(e.protein_g)} g`:''}</small><button type="button" aria-label="Apagar ${esc(e.description)}" onclick="deleteDietEntry('${e.id}')">✕</button></div>`).join('')}</div>`;}).join('');
  host.innerHTML=`<div class="dia3"><button type="button" aria-label="Dia anterior" onclick="shiftDietDate(-1)">‹</button><b>${diaRel(date)}</b><button type="button" aria-label="Próximo dia" onclick="shiftDietDate(1)" ${date>=tk()?'disabled':''}>›</button></div>
    <div class="kc3"><div class="ar3 big comida" style="--p:${goal?Math.min(100,com/goal*100):0}"><b>${nf(com)}</b><small>${goal?(com>goal?`${nf(com-goal)} acima`:`faltam ${nf(goal-com)}`):'kcal'}</small></div>
      <div class="macs3">${bar('Proteína',P,Math.round(G.protein_g||0),'var(--f3-comida)')}${bar('Carbo',C,Math.round(G.carbs_g||0),'var(--f3-supl)')}${bar('Gordura',F,Math.round(G.fat_g||0),'var(--f3-agua)')}</div></div>
    ${parts?`<p class="f3-nota c">Meta de hoje ${nf(parts.total)} kcal = basal ${nf(parts.base)} + dia a dia ${nf(parts.dia)} + atividades ${nf(parts.act)} − ${nf(parts.def)}.</p>`:goal?`<p class="f3-nota c">Meta do dia: ${nf(goal)} kcal.</p>`:''}
    ${meals}`;
}
async function recentes(){
  await root.loadDietCache();const all=(typeof dietCache!=='undefined'?dietCache:[]); // eslint-disable-line no-undef
  const sc=await getJ('quick-diet-shortcuts-v1',[]);
  const out=[];const seen=new Set();
  [...sc].sort((a,b)=>(b.last||0)-(a.last||0)||(b.uses||0)-(a.uses||0)).forEach(x=>{const d=x.name+(x.qty?` (${x.qty})`:'');const k=d.toLowerCase();if(seen.has(k))return;seen.add(k);out.push({description:d,kcal:x.kcal,protein_g:x.protein_g,carbs_g:x.carbs_g,fat_g:x.fat_g});});
  [...all].sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||''))).forEach(e=>{const k=String(e.description||'').toLowerCase();if(!k||seen.has(k))return;seen.add(k);out.push({description:e.description,kcal:e.kcal,protein_g:e.protein_g,carbs_g:e.carbs_g,fat_g:e.fat_g});});
  return out.slice(0,12);
}
let addMeal='almoco',recCache=[];
async function abrirAdicionar(meal){
  tap();addMeal=meal;recCache=await recentes();
  const t=(typeof MEAL_TYPES!=='undefined'?MEAL_TYPES:[]).find(x=>x.key===meal)||{label:'refeição'}; // eslint-disable-line no-undef
  abrirFolha(`<div class="f3-t">Adicionar ao ${esc(t.label)}</div>
    <div class="metodos3"><button type="button" onclick="Forja3.metodo('food')">⌕ Buscar</button><button type="button" onclick="Forja3.metodo('barcode')">▥ Código</button><button type="button" onclick="Forja3.metodo('photo')">📷 Foto</button><button type="button" onclick="Forja3.metodo('text')">✎ Colar texto</button></div>
    <div class="f3-lbl">Recentes · um toque lança</div>
    <div class="rec3">${recCache.length?recCache.map((r,i)=>`<button type="button" onclick="Forja3.lancarRecente(${i})"><b>${esc(r.description)}</b><small>${nf(r.kcal)} kcal${r.protein_g!=null?` · P ${nf(r.protein_g)} g`:''}</small><span>+</span></button>`).join(''):'<p class="f3-vazio">O que você lançar fica aqui para repetir com um toque.</p>'}</div>`);
}
async function lancarRecente(i){const r=recCache[i];if(!r)return;fecharFolha();await lancarComida(r,addMeal);}
function metodo(m){
  fecharFolha();try{root.selectDietMealType?.(addMeal);}catch{}
  doc.body.classList.add('diet-mais');
  try{root.ForjaDietFlow?.showMethod?.(m);}catch{}
  setTimeout(()=>{$('diet-add3-anchor')?.scrollIntoView({behavior:'smooth',block:'start'});},60);
}

// ===================== CORPO =====================
async function renderBody(){
  try{
    if(typeof weightPending!=='undefined'&&weightPending===null){const w=await root.getLastWeightValue();if(w){weightPending=w;root.syncWeightPendingUI?.();}} // eslint-disable-line no-undef
  }catch{}
  const sel=$('body-period');const segHost=$('turno3');
  if(sel&&segHost){segHost.innerHTML=[...sel.options].map(o=>`<button type="button" class="${sel.value===o.value?'on':''}" onclick="(function(){var s=document.getElementById('body-period');s.value='${o.value}';s.dispatchEvent(new Event('change'));Forja3.renderBody();})()">${esc(o.textContent)}</button>`).join('');}
  const tr=$('peso-tend3');
  if(tr){
    const arr=(await root.loadBody()).filter(e=>e.type==='weight').map(e=>({d:e.date,v:parseFloat(String(e.value).replace(',','.'))})).filter(x=>!isNaN(x.v)).sort((a,b)=>a.d.localeCompare(b.d));
    if(arr.length>=2){const last=arr[arr.length-1];const lim=tk(new Date(Date.now()-7*864e5));const ref=[...arr].reverse().find(x=>x.d<=lim)||arr[0];const diff=Math.round((last.v-ref.v)*10)/10;
      tr.textContent=`${diff>0?'+':''}${String(diff).replace('.',',')} kg desde ${diaRel(ref.d).toLowerCase()} · último ${String(last.v).replace('.',',')} kg`;}
    else if(arr.length===1)tr.textContent=`Último registro: ${String(arr[0].v).replace('.',',')} kg (${diaRel(arr[0].d).toLowerCase()})`;
    else tr.textContent='Registre seu primeiro peso.';
  }
}

// ===================== MEUS DADOS (exame) =====================
const CAMPOS=[
  ['Corpo',[['pesoKg','Peso','kg'],['alturaCm','Altura','cm'],['idade','Idade','anos'],['imc','IMC','kg/m²'],['cinturaCm','Cintura','cm']]],
  ['Composição',[['gorduraPct','Gordura','%'],['massaGordaKg','Massa gorda','kg'],['massaMagraKg','Massa magra','kg'],['massaMuscularKg','Massa muscular','kg'],['razaoMusculoGordura','Músculo / gordura','']]],
  ['Energia',[['tmbKcal','Taxa metabólica basal','kcal/dia']]],
  ['Hidratação',[['aguaCorporalL','Água corporal','L'],['aguaCorporalPct','Água corporal','%'],['aguaIntraL','Intracelular','L'],['aguaExtraL','Extracelular','L'],['aguaMassaMagraPct','Água na massa magra','%'],['indiceHidratacao','Índice de hidratação','']]],
  ['Análise celular',[['anguloFase','Ângulo de fase','°'],['idadeCelular','Idade celular','anos']]]];
function fmtN(v){if(v==null||v==='')return '—';const n=Number(v);return isNaN(n)?esc(v):n.toLocaleString('pt-BR',{maximumFractionDigits:1});}
async function renderDados(){
  const host=$('tab-dados');if(!host)return;
  const d=await getJ('f3-dados',{});const m=await loadMetas();
  const tem=Object.keys(d).length>0;
  const parts=await goalParts(tk());
  host.innerHTML=`${tem?`<div class="f3-card dados-topo"><div class="f3-t">${esc(d.apelido||d.nome||'Meus dados')}<span>${d.data?'exame de '+esc(d.data.split('-').reverse().join('/')):''}</span></div>
      <div class="dados-hero"><div><b>${fmtN(d.pesoKg)}</b><small>kg</small></div><div><b>${fmtN(d.gorduraPct)}</b><small>% gordura</small></div><div><b>${fmtN(d.tmbKcal)}</b><small>kcal basal</small></div></div>
      ${d.fonte?`<p class="f3-nota">${esc(d.fonte)}</p>`:''}</div>`:`<div class="f3-card"><div class="f3-t">Meus dados</div><p class="f3-nota">Importe o arquivo do exame (bioimpedância) que o Daniel mandou ou preencha os campos abaixo.</p></div>`}
    <div class="f3-card"><div class="f3-t">Minhas metas</div>
      <div class="meta3"><span>Comida por dia</span><b>${parts?`${nf(parts.total)} kcal hoje`:m.kcal?`${nf(m.kcal)} kcal`:'—'}</b></div>
      ${parts?`<p class="f3-nota">Muda conforme você lança: basal ${nf(parts.base)} + dia a dia ${nf(parts.dia)} + atividades do dia − ${nf(parts.def)} para emagrecer.</p>`:''}
      <div class="meta3"><span>Para emagrecer, tirar por dia</span><div class="mini-step"><button type="button" onclick="Forja3.metaStep('deficit',-50)">−</button><b>${nf(m.deficit)} kcal</b><button type="button" onclick="Forja3.metaStep('deficit',50)">+</button></div></div>
      <div class="meta3"><span>Água por dia</span><div class="mini-step"><button type="button" onclick="Forja3.metaStep('water',-100)">−</button><b>${((m.water||2000)/1000).toFixed(1).replace('.',',')} L</b><button type="button" onclick="Forja3.metaStep('water',100)">+</button></div></div>
      <div class="meta3"><span>Proteína por dia</span><div class="mini-step"><button type="button" onclick="Forja3.metaStep('protein_g',-5)">−</button><b>${nf(m.protein_g||0)} g</b><button type="button" onclick="Forja3.metaStep('protein_g',5)">+</button></div></div>
      <p class="f3-nota">Ponto de partida calculado pelo app a partir do exame. Se uma nutricionista passar outra meta, troque aqui.</p>
      <button type="button" class="f3-cta sec" onclick="Forja3.go('meta')">🎯 Meta de peso e prazo</button></div>
    ${CAMPOS.map(([g,fs])=>`<div class="f3-card"><div class="f3-t">${g}</div><div class="campos3">${fs.map(([k,l,u])=>`<label class="c3"><span>${l}</span><span class="c3v"><input id="d3-${k}" inputmode="decimal" value="${d[k]!=null?String(d[k]).replace('.',','):''}" placeholder="—" onchange="Forja3.salvarCampo('${k}',this.value)"><em>${u}</em></span></label>`).join('')}</div></div>`).join('')}
    <div class="f3-card"><div class="f3-t">Importar exame</div><p class="f3-nota">Escolha o arquivo <b>.json</b> do exame. No iPhone ele fica em Arquivos (salve do WhatsApp ou do e-mail).</p>
      <input type="file" id="d3-file" accept=".json,application/json" hidden onchange="Forja3.importarExame(event)"><button type="button" class="f3-cta sec" onclick="document.getElementById('d3-file').click()">Escolher arquivo do exame</button></div>`;
}
async function salvarCampo(k,v){const d=await getJ('f3-dados',{});const n=parseFloat(String(v).replace(',','.'));d[k]=isNaN(n)?(String(v).trim()||null):n;await setJ('f3-dados',d);if(k==='tmbKcal'){const m=await loadMetas();m.tmb=d.tmbKcal;m.tmbEstimada=false;m.modo='dinamico';await setJ('f3-metas',m);}toast('Salvo ✓');renderDados();}
async function metaStep(k,delta){tap();const m=await loadMetas();const base={deficit:300,water:2000,protein_g:100}[k];m[k]=Math.max(0,Math.round((m[k]??base)+delta));await setJ('f3-metas',m);await applyMetas();renderDados();root.renderDashboard?.();}
async function aplicarExame(ex){
  if(!ex||typeof ex!=='object'||!(ex.pesoKg||ex.tmbKcal))throw Error('Esse arquivo não parece ser um exame do Forja.');
  await setJ('f3-dados',ex);
  const m=await loadMetas();
  if(ex.tmbKcal){m.tmb=ex.tmbKcal;m.tmbEstimada=false;m.modo='dinamico';}
  if(!m.water&&ex.pesoKg)m.water=Math.round(ex.pesoKg*35/100)*100;
  if(!m.protein_g&&ex.pesoKg)m.protein_g=Math.round(ex.pesoKg*1.4/5)*5;
  if(!m.fat_g&&ex.pesoKg)m.fat_g=Math.round(ex.pesoKg*0.8/5)*5;
  if(!m.carbs_g)m.carbs_g=150;
  await setJ('f3-metas',m);await applyMetas();
  if(ex.pesoKg&&ex.data){const arr=await root.loadBody();if(!arr.some(e=>e.type==='weight'&&e.date===ex.data)){arr.push({id:root.cid(),date:ex.data,time:'08:00',type:'weight',period:'manha',value:String(ex.pesoKg).replace('.',','),fonte:'exame'});await root.saveBody(arr);}}
}
async function importarExame(ev){
  const f=ev.target.files&&ev.target.files[0];if(!f)return;
  try{const txt=await f.text();await aplicarExame(JSON.parse(txt));toast('Exame importado. Metas calculadas ✓');await renderDados();await root.renderDashboard?.();}
  catch(e){toast(e.message&&e.message.startsWith('Esse')?e.message:'Não consegui ler esse arquivo. Confira se é o .json do exame.');}
  ev.target.value='';
}

// ===================== metas (Mais, versão completa) =====================
async function renderMetasCard(){
  const host=$('metas3');if(!host||isEss())return;
  const m=await loadMetas();const G=(typeof NUTRITION_GOAL!=='undefined'?NUTRITION_GOAL:{}); // eslint-disable-line no-undef
  let wk=3;try{wk=(await root.ForjaGymTraining.loadGoalCache()).weeklyTarget;}catch{}
  const W=(typeof waterDailyGoal!=='undefined'?waterDailyGoal:2000); // eslint-disable-line no-undef
  const linha=(l,k,v,u,d)=>`<div class="meta3"><span>${l}</span><div class="mini-step"><button type="button" onclick="Forja3.metaFix('${k}',-${d})">−</button><b>${v} ${u}</b><button type="button" onclick="Forja3.metaFix('${k}',${d})">+</button></div></div>`;
  host.innerHTML=`<div class="f3-t">Minhas metas</div>
    ${linha('Treinos por semana','treinos',wk,'',1)}
    ${m.modo==='dinamico'&&m.tmb?`<div class="meta3"><span>Comida por dia</span><b>automática</b></div><p class="f3-nota">Segue o plano da meta de peso: ${m.deficit>=0?'−':'+'}${nf(Math.abs(m.deficit))} kcal/dia, mais o que você gastar em atividade.</p>`:linha('Comida por dia','kcal',nf(m.kcal||G.kcal),'kcal',50)}
    <button type="button" class="f3-cta sec" onclick="Forja3.go('meta')">🎯 Meta de peso e prazo</button>
    ${linha('Proteína','protein_g',nf(m.protein_g||G.protein_g),'g',5)}
    ${linha('Carboidrato','carbs_g',nf(m.carbs_g||G.carbs_g),'g',5)}
    ${linha('Gordura','fat_g',nf(m.fat_g||G.fat_g),'g',5)}
    ${linha('Água','water',(W/1000).toFixed(1).replace('.',','),'L',100)}
    <p class="f3-nota">As abas mostram só o progresso. Mude as metas aqui.</p>`;
}
async function metaFix(k,delta){
  tap();
  if(k==='treinos'){try{await root.ForjaGymUI.adjustWeeklyGoal(Math.sign(delta));}catch{}renderMetasCard();return;}
  const m=await loadMetas();const G=(typeof NUTRITION_GOAL!=='undefined'?NUTRITION_GOAL:{}); // eslint-disable-line no-undef
  const W=(typeof waterDailyGoal!=='undefined'?waterDailyGoal:2000); // eslint-disable-line no-undef
  const cur=m[k]??(k==='water'?W:G[k]);m[k]=Math.max(0,Math.round((cur||0)+delta));
  await setJ('f3-metas',m);await applyMetas();renderMetasCard();root.renderDashboard?.();
}

// ===================== montagem =====================
function montar(){
  const ini=$('tab-inicio');
  if(ini&&!$('hoje3')){const d=doc.createElement('div');d.id='hoje3';d.className='hoje3';ini.prepend(d);}
  const ag=$('tab-agua');
  if(ag&&!$('agua3')){const old=ag.querySelector(':scope > .card');if(old)old.id='agua-old';const d=doc.createElement('div');d.id='agua3';d.className='agua3';ag.prepend(d);}
  const di=$('tab-dieta');
  if(di&&!$('diet3')){const d=doc.createElement('div');d.id='diet3';d.className='diet3';di.prepend(d);
    const addCard=$('diet-meal-type-grid')?.closest('.card');if(addCard){const a=doc.createElement('div');a.id='diet-add3-anchor';addCard.before(a);addCard.classList.add('diet-add-old');}
    const more=doc.createElement('button');more.type='button';more.className='diet-mais-btn';more.textContent='Mais formas de lançar e histórico ›';more.onclick=()=>{doc.body.classList.toggle('diet-mais');};d.after(more);}
  const peso=$('weight-pending-display');
  if(peso&&!$('turno3')){const card=peso.closest('.card');card?.classList.add('peso3');const sel=$('body-period');if(sel){const s=doc.createElement('div');s.id='turno3';s.className='turno3';sel.after(s);}
    const t=doc.createElement('p');t.id='peso-tend3';t.className='peso-tend3';card?.querySelector('.card-head')?.after(t);}
  const mais=$('tab-mais');
  if(mais&&!$('metas3')&&!isEss()){const d=doc.createElement('div');d.id='metas3';d.className='f3-card metas3';mais.prepend(d);}
  // abas extras
  const tabs=doc.querySelector('.tabs');const main=doc.querySelector('main');
  const foot=doc.querySelector('main .fab-note');EXTRA_TABS.forEach(t=>{if(!$('tab-'+t)&&main){const d=doc.createElement('div');d.id='tab-'+t;d.style.display='none';d.className='tab3';if(foot)foot.before(d);else main.appendChild(d);}});
  if(isEss()&&tabs&&!tabs.querySelector('[data-tab="atividade"]')){
    const mk=(t,l)=>{const b=doc.createElement('button');b.className='tab';b.dataset.tab=t;b.textContent=l;b.onclick=()=>root.switchTab(t);return b;};
    const mais=tabs.querySelector('[data-tab="mais"]');tabs.insertBefore(mk('atividade','🔥 Atividade'),mais);tabs.insertBefore(mk('meta','🎯 Meta'),mais);tabs.insertBefore(mk('dados','📋 Meus dados'),mais);
    const ren={dieta:'🍽 Comida',corpo:'⚖️ Peso',agua:'💧 Água'};Object.entries(ren).forEach(([k,v])=>{const b=tabs.querySelector(`[data-tab="${k}"]`);if(b)b.textContent=v;});
    const order=['inicio','dieta','agua','atividade','corpo','meta','dados','mais'];order.forEach(k=>{const b=tabs.querySelector(`[data-tab="${k}"]`);if(b)tabs.appendChild(b);});
  }
  if(!isEss()&&tabs&&!tabs.querySelector('[data-tab="meta"]')){const b=doc.createElement('button');b.className='tab';b.dataset.tab='meta';b.textContent='🎯 Meta de peso';b.onclick=()=>root.switchTab('meta');const ref=tabs.querySelector('[data-tab="corpo"]');if(ref)ref.after(b);else tabs.appendChild(b);}
  doc.body.classList.add('f3');
}
async function autoFecharDias(){
  try{await root.loadDietCache();const all=(typeof dietCache!=='undefined'?dietCache:[]);const closed=await getJ('diet-closed-days',{});const h=tk();let mud=false; // eslint-disable-line no-undef
    new Set(all.map(e=>e.date)).forEach(d=>{if(d<h&&!closed[d]){closed[d]=true;mud=true;}});if(mud)await setJ('diet-closed-days',closed);}catch{}
}
async function init(){
  montar();await applyMetas();await autoFecharDias();
  if(isEss()){doc.title='Forja.Essencial';const h1=doc.querySelector('header h1');if(h1)h1.innerHTML='FORJA<span class="dot">.</span>ESSENCIAL';}
  try{await renderHome();await renderWater();await renderDiet();await renderBody();}catch(e){console.warn('Forja3',e);}
}
root.Forja3={onSwitch,toggleTabs,go,NOMES,init,renderHome,renderWater,renderDiet,renderBody,renderDados,renderAtividade,activityKcal,dynamicGoal,goalParts,
  addWater,undoWater,outroAgua,toggleAjustarAgua,toggleSupl,editSupl,addSupl,removeSupl,abrirFolha,fecharFolha,abrirAdicionar,lancarRecente,metodo,
  actSet,saveAct,delAct,salvarCampo,metaStep,metaFix,applyMetas,importarExame,aplicarExame,renderMetasCard,isEss};
// eslint-disable-next-line no-undef
if(typeof forjaInitialization!=='undefined'&&forjaInitialization.then)forjaInitialization.then(init).catch(e=>console.error('Forja3:',e)); else root.addEventListener('load',init);
})(typeof globalThis!=='undefined'?globalThis:this);
