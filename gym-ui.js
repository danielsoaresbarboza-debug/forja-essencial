(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.ForjaGymUI=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const T=()=>root.ForjaGymTraining;
const $=(id)=>root.document.getElementById(id);
function tapFeedback(){if(root.navigator?.vibrate)root.navigator.vibrate(8);}
function showToast(msg,action){
  let t=$('gym-toast');
  if(!t){t=root.document.createElement('div');t.id='gym-toast';t.className='toast';root.document.body.appendChild(t);}
  t.textContent='';const sp=root.document.createElement('span');sp.textContent=msg;t.appendChild(sp);
  if(action){const b=root.document.createElement('button');b.type='button';b.className='toast-action';b.textContent=action.label;b.onclick=()=>{t.classList.remove('show');action.onClick();};t.appendChild(b);}
  t.classList.add('show');
  clearTimeout(showToast._h);showToast._h=setTimeout(()=>t.classList.remove('show'),action?6000:2600);
}

// ================= SESSION STATE =================
let sessionExercises=[];
let activeSessionStartTs=null;
let sessionTickInterval=null;

async function initSessionExercisesFromToday(){
  const t=T();const arr=await t.loadWorkouts();
  await t.loadPhotosCache();await t.loadNotesCache();await t.loadMuscleCache();await t.loadWeightModeCache();
  const todays=arr.filter(e=>e.date===t.todayKey());
  sessionExercises=todays.map(e=>{
    const ws=t.parseWeightList(e.weight),rs=t.parseRepsList(e.reps),warm=t.parseWarmupList(e.warmup),rirs=t.parseRirList(e.rir);
    const cmin=t.parseCardioList(e.cardioMin),ckm=t.parseCardioList(e.cardioKm),ckcal=t.parseCardioList(e.cardioKcal);
    const sets=rs.map((r,i)=>({weight:ws[i]!==undefined?ws[i]:(ws[ws.length-1]||0),reps:r,warmup:!!warm[i],rir:rirs[i]||'',cardioMin:cmin[i]??null,cardioKm:ckm[i]??null,cardioKcal:ckcal[i]??null}));
    const weight=sets.length?sets[sets.length-1].weight:20;
    return{name:e.name.trim(),workoutId:e.id,sets,weight,weightMode:t.getWeightModeSync(e.name.trim()),pendingReps:sets.length?sets[sets.length-1].reps:10,finished:true,planCount:sets.filter(x=>!x.warmup).length||3,last:null};
  });
  for(const ex of sessionExercises){ex.last=await lastSessionFor(ex.name);}
  await renderSessionStack();
  refreshTreinoTabVisibility();
}



function scrollToCard(idx){setTimeout(()=>{const el=$(`ex-card-${idx}`);if(el)el.scrollIntoView({behavior:'smooth',block:'start'});},60);}

// ================= TREINOS PRONTOS (modelos por objetivo) =================
function renderReadyWorkouts(){
  const wrap=$('ready-workouts-list');if(!wrap)return;
  const templates=root.ForjaReadyWorkouts||[];
  wrap.innerHTML=templates.map(tpl=>`
    <div class="ready-workout-card">
      <div class="ready-workout-head"><span class="ready-workout-icon">${tpl.icon}</span><div><div class="ready-workout-name">${tpl.name}</div><div class="ready-workout-subtitle">${tpl.subtitle}</div></div></div>
      <div class="ready-workout-desc">${tpl.description}</div>
      <div class="ready-workout-days">${tpl.days.map(d=>`${d.label} (${d.exercises.length} exercícios)`).join(' · ')}</div>
      <button class="primary secondary-btn" onclick="ForjaGymUI.useReadyWorkout('${tpl.id}')">Usar esse treino</button>
    </div>
  `).join('');
}
async function useReadyWorkout(id){
  tapFeedback();const t=T();
  const tpl=(root.ForjaReadyWorkouts||[]).find(x=>x.id===id);if(!tpl)return;
  const groups=await t.loadWorkoutGroups();
  const muscleCache=await t.loadMuscleCache();
  let created=0,updated=0;
  for(const day of tpl.days){
    // pré-classifica a musculatura de cada exercício do modelo (se ainda não tiver).
    for(const name of day.exercises){
      const key=t.slug(name);
      if(!muscleCache[key]){
        const guess=root.ForjaExerciseLibrary?root.ForjaExerciseLibrary.guessAppMuscle(name):null;
        if(guess)muscleCache[key]=guess;
      }
    }
    const existing=groups.find(g=>g.name===day.label);
    if(existing){existing.exercises=[...day.exercises];updated++;}
    else{groups.push({id:t.cid(),name:day.label,exercises:[...day.exercises]});created++;}
  }
  await t.persistMuscleCache();
  await t.persistWorkoutGroups();
  await renderWorkoutGroups();await renderHoje();
  showToast(`${tpl.name}: ${created} grupo(s) criado(s)${updated?`, ${updated} atualizado(s)`:''}. Já aparece no topo da Academia.`);
  $('workout-groups-card')?.scrollIntoView({behavior:'smooth',block:'start'});
}

// ================= WORKOUT GROUPS (Treino A/B/C etc.) =================
let groupFormSelected=new Set();
let groupEditingId=null;
async function renderWorkoutGroups(){
  const t=T();const wrap=$('workout-groups-list');if(!wrap)return;
  const groups=await t.loadWorkoutGroups();
  wrap.innerHTML=groups.map(g=>`
    <div class="group-row">
      <div class="group-row-main" onclick="ForjaGymUI.loadWorkoutGroupToSession('${g.id}')">
        <div class="group-row-name">${t.escapeHtml(g.name)}</div>
        <div class="group-row-count">${g.exercises.length} exercício${g.exercises.length===1?'':'s'}</div>
      </div>
      <button class="group-edit-btn" onclick="ForjaGymUI.editWorkoutGroup('${g.id}')">✏️</button>
      <button class="group-del-btn" onclick="ForjaGymUI.deleteWorkoutGroup('${g.id}')">🗑</button>
    </div>
  `).join('')||'<div class="empty">Nenhum grupo criado ainda.</div>';
}
async function showNewGroupForm(){
  tapFeedback();groupEditingId=null;groupFormSelected=new Set();
  const nameEl=$('group-name-input');if(nameEl)nameEl.value='';
  await renderGroupExerciseChecklist();
  const f=$('group-form');if(f)f.style.display='block';
  f?.scrollIntoView({behavior:'smooth',block:'start'});
}
function closeGroupForm(){tapFeedback();const f=$('group-form');if(f)f.style.display='none';}
async function renderGroupExerciseChecklist(){
  const t=T();const wrap=$('group-exercise-checklist');if(!wrap)return;
  const names=await t.getRecentExerciseNames();
  wrap.innerHTML=names.map(name=>{
    const checked=groupFormSelected.has(name)?' active':'';
    return `<div class="ex-chip${checked}" onclick="ForjaGymUI.toggleGroupExercise('${name.replace(/'/g,"\\'")}')"><div class="ex-chip-ph">${checked?'✅':'🏋️'}</div><div class="lbl">${t.escapeHtml(dn(name))}</div></div>`;
  }).join('')||'<div class="empty">Registre exercícios primeiro para poder agrupá-los.</div>';
}
function toggleGroupExercise(name){
  tapFeedback();
  if(groupFormSelected.has(name))groupFormSelected.delete(name);else groupFormSelected.add(name);
  renderGroupExerciseChecklist();
}
async function editWorkoutGroup(id){
  tapFeedback();const t=T();const groups=await t.loadWorkoutGroups();
  const g=groups.find(x=>x.id===id);if(!g)return;
  groupEditingId=id;groupFormSelected=new Set(g.exercises);
  const nameEl=$('group-name-input');if(nameEl)nameEl.value=g.name;
  await renderGroupExerciseChecklist();
  const f=$('group-form');if(f)f.style.display='block';
  f?.scrollIntoView({behavior:'smooth',block:'start'});
}
async function saveWorkoutGroup(){
  const t=T();const name=($('group-name-input')?.value||'').trim();
  if(!name){showToast('Dê um nome ao grupo (ex.: Treino A).');return;}
  if(groupFormSelected.size===0){showToast('Selecione ao menos um exercício.');return;}
  const groups=await t.loadWorkoutGroups();
  if(groupEditingId){
    const g=groups.find(x=>x.id===groupEditingId);
    if(g){g.name=name;g.exercises=[...groupFormSelected];}
  }else{
    groups.push({id:t.cid(),name,exercises:[...groupFormSelected]});
  }
  await t.persistWorkoutGroups();
  closeGroupForm();
  await renderWorkoutGroups();await renderHoje();
  showToast('Treino salvo!');
}
async function deleteWorkoutGroup(id){
  tapFeedback();const t=T();const groups=await t.loadWorkoutGroups();
  const idx=groups.findIndex(x=>x.id===id);if(idx<0)return;
  groups.splice(idx,1);await t.persistWorkoutGroups();await renderWorkoutGroups();await renderHoje();
  showToast('Grupo removido.');
}

function dn(name){const N=root.ForjaExerciseNames;return N&&N.display?N.display(name):name;}
function exHaystack(name){const N=root.ForjaExerciseNames;return N&&N.haystack?N.haystack(name):normCatalogText(name);}
function queryMatchesName(name,rawQuery){
  const terms=(root.ForjaPtSynonyms?root.ForjaPtSynonyms.expandTerms(rawQuery):[rawQuery]).map(normCatalogText).filter(Boolean);
  if(!terms.length)return true;
  const hay=exHaystack(name);
  return terms.some(term=>hay.includes(term));
}

// ================= EXERCISE PICKER =================
let pickerFilter='Todos';
async function openPickerForAdd(){
  tapFeedback();
  if(!activeSessionStartTs){showToast('Aperte "▶ Iniciar Treino" no topo primeiro.');return;}
  $('picker-card').style.display='block';
  $('picker-close-btn').style.display=sessionExercises.length?'inline-block':'none';
  await renderExercisePicker();
  renderCatalogByCategory();
  $('picker-card').scrollIntoView({behavior:'smooth',block:'start'});
}
function closePicker(){tapFeedback();const f=$('new-ex-form');if(f)f.style.display='none';refreshTreinoTabVisibility();}
function selectPickerFilter(btn){
  tapFeedback();
  root.document.querySelectorAll('#picker-card .filter-chip').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');pickerFilter=btn.dataset.filter;renderExercisePicker();
  const search=$('gym-catalog-search');if(search)search.value='';
  renderCatalogByCategory();
}
// Quando um filtro de categoria está ativo (Superior/Inferior/Push/Pull/Pernas), mostra
// também exercícios da biblioteca completa (762+ catálogo) naquela categoria — não só
// o que já está no histórico — pra resolver "aperto Pernas e não aparece nada".
function renderCatalogByCategory(){
  const t=T();const wrap=$('picker-catalog-list');if(!wrap)return;
  const searchVal=($('gym-catalog-search')?.value||'').trim();
  if(searchVal)return; // busca por texto tem prioridade e já preenche esse mesmo wrap
  if(pickerFilter==='Todos'){wrap.innerHTML='';return;}
  if(pickerFilter==='Cardio'){
    wrap.innerHTML=(t.CARDIO_EQUIPMENT||[]).map(eq=>`<div class="ex-chip" data-ex-name="${t.escapeHtml(eq.name)}" data-ex-src="equipment" onclick="ForjaGymUI.addCardioEquipment('${eq.name.replace(/'/g,"\\'")}')"><div class="ex-chip-ph">${eq.icon}</div><div class="lbl">${t.escapeHtml(eq.name)}</div></div>`).join('');
    return;
  }
  const matches=(muscleCat)=>{
    if(pickerFilter==='Superior')return t.SUPERIOR_GROUPS.includes(muscleCat);
    if(pickerFilter==='Inferior')return t.INFERIOR_GROUPS.includes(muscleCat);
    if(pickerFilter==='Push')return t.PUSH_GROUPS.includes(muscleCat);
    if(pickerFilter==='Pull')return t.PULL_GROUPS.includes(muscleCat);
    if(pickerFilter==='Pernas')return t.LEGS_GROUPS.includes(muscleCat);
    return muscleCat===pickerFilter;
  };
  const catalog=root.ForjaGymCatalog||[];
  const freeLib=root.ForjaFreeExerciseLibrary||[];
  const catalogMatches=catalog.filter(row=>matches(CATALOG_MUSCLE_MAP[row[2]])).slice(0,120);
  const seen=new Set(catalogMatches.map(row=>normCatalogText(row[0])));
  const freeMatches=freeLib.filter(row=>{
    const key=normCatalogText(row[1]);
    if(seen.has(key))return false;
    return matches(FREE_EX_MUSCLE_MAP[row[3]]);
  }).slice(0,80);
  freeMatches.forEach(row=>seen.add(normCatalogText(row[1])));
  const catalogChips=catalogMatches.map(row=>{
    const[en,,muscle]=row;
    const freeRow=freeLib.find(r=>normCatalogText(r[1])===normCatalogText(en));
    const ptData=freeRow&&(root.ForjaFreeExercisePt||{})[freeRow[0]];
    const displayName=dn(en);
    const thumb=freeRow&&freeRow[5]?`<img src="${freeRow[5]}">`:`<div class="ex-chip-ph">🏋️</div>`;
    return `<div class="ex-chip" data-ex-name="${t.escapeHtml(en)}" data-ex-src="catalog" data-ex-muscle="${t.escapeHtml(muscle)}" onclick="ForjaGymUI.addCatalogExercise('${en.replace(/'/g,"\\'")}','${muscle.replace(/'/g,"\\'")}')">${thumb}<div class="lbl">${t.escapeHtml(displayName)}</div></div>`;
  });
  const freeChips=freeMatches.map(row=>{
    const[id,en,,musclePt,,img]=row;
    const ptData=(root.ForjaFreeExercisePt||{})[id];
    const displayName=dn(en);
    const thumb=img?`<img src="${img}">`:`<div class="ex-chip-ph">🏋️</div>`;
    return `<div class="ex-chip" data-ex-name="${t.escapeHtml(en)}" data-ex-src="free" data-ex-muscle="${t.escapeHtml(musclePt||'')}" onclick="ForjaGymUI.addFreeExercise('${en.replace(/'/g,"\\'")}','${(musclePt||'').replace(/'/g,"\\'")}')">${thumb}<div class="lbl">${t.escapeHtml(displayName)}</div></div>`;
  });
  wrap.innerHTML=(catalogChips.join('')+freeChips.join(''))||'<div class="empty">Nenhum exercício encontrado nessa categoria.</div>';
}
async function renderExercisePicker(){
  const t=T();const wrap=$('picker-list');if(!wrap)return;
  const names=await t.getRecentExerciseNames();
  await t.loadMuscleCache();
  const todayNames=new Set(sessionExercises.map(e=>e.name));
  let filtered=names;
  if(pickerFilter==='Superior')filtered=names.filter(n=>t.SUPERIOR_GROUPS.includes(t.getMuscleSync(n)));
  else if(pickerFilter==='Inferior')filtered=names.filter(n=>t.INFERIOR_GROUPS.includes(t.getMuscleSync(n)));
  else if(pickerFilter==='Push')filtered=names.filter(n=>t.PUSH_GROUPS.includes(t.getMuscleSync(n)));
  else if(pickerFilter==='Pull')filtered=names.filter(n=>t.PULL_GROUPS.includes(t.getMuscleSync(n)));
  else if(pickerFilter==='Pernas')filtered=names.filter(n=>t.LEGS_GROUPS.includes(t.getMuscleSync(n)));
  else if(pickerFilter!=='Todos')filtered=names.filter(n=>t.getMuscleSync(n)===pickerFilter);
  const searchQ=($('gym-catalog-search')?.value||'').trim();
  if(searchQ)filtered=filtered.filter(n=>queryMatchesName(n,searchQ));
  wrap.innerHTML=filtered.map(name=>{
    const photo=t.getPhotoSync(name)||(root.ForjaExerciseLibrary&&root.ForjaExerciseLibrary.getWgerImageSync(name));
    const img=photo?`<img src="${photo}">`:`<div class="ex-chip-ph">🏋️</div>`;
    const doneClass=todayNames.has(name)?' done-today':'';
    return `<div class="ex-chip${doneClass}" data-ex-name="${t.escapeHtml(name)}" data-ex-src="mine" onclick="ForjaGymUI.addExerciseToSession('${name.replace(/'/g,"\\'")}')">${img}<div class="lbl">${t.escapeHtml(dn(name))}</div></div>`;
  }).join('')||'<div class="empty">Nenhum exercício encontrado — crie um novo abaixo.</div>';
}
// ================= CATALOG SEARCH (biblioteca externa de exercícios) =================
const CATALOG_MUSCLE_MAP={'Quadríceps':'Perna','Ombros':'Ombro','Abdômen':'Abdômen','Peito':'Peito','Tríceps':'Tríceps','Costas':'Costas','Posterior':'Perna','Bíceps':'Bíceps','Antebraços':'Bíceps','Glúteos':'Glúteo','Lombar':'Costas','Panturrilhas':'Panturrilha','Trapézio':'Costas','Adutores':'Perna','Pescoço':'Costas','Abdutores':'Perna'};
function normCatalogText(s){return String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
let catalogSearchTimer=null;
function searchCatalog(){
  clearTimeout(catalogSearchTimer);
  catalogSearchTimer=setTimeout(()=>{renderExercisePicker();renderCatalogSearch();},120);
}
// Grupo muscular (PT) do free-exercise-db -> categoria interna do app (mesma lista usada em CATALOG_MUSCLE_MAP).
const FREE_EX_MUSCLE_MAP={'Quadríceps':'Perna','Ombro':'Ombro','Abdômen':'Abdômen','Peito':'Peito','Tríceps':'Tríceps','Costas (dorsal)':'Costas','Costas (meio)':'Costas','Posterior de coxa':'Perna','Bíceps':'Bíceps','Antebraço':'Bíceps','Glúteo':'Glúteo','Lombar':'Costas','Panturrilha':'Panturrilha','Trapézio':'Costas','Quadril (adutor)':'Perna','Pescoço':'Costas','Quadril (abdutor)':'Perna'};
function renderCatalogSearch(){
  const t=T();const wrap=$('picker-catalog-list');if(!wrap)return;
  const rawQ=$('gym-catalog-search')?.value||'';
  const q=normCatalogText(rawQ);
  if(!q){renderCatalogByCategory();return;}
  const terms=(root.ForjaPtSynonyms?root.ForjaPtSynonyms.expandTerms(rawQ):[q]).map(normCatalogText);
  const matchesAny=(...fields)=>terms.some(term=>fields.some(f=>normCatalogText(f).includes(term)));
  const catalog=root.ForjaGymCatalog||[];
  const catalogMatches=catalog.filter(row=>matchesAny(row[0],row[1],row[2],dn(row[0]))).slice(0,60);
  const seen=new Set(catalogMatches.map(row=>normCatalogText(row[0])));
  const freeLib=root.ForjaFreeExerciseLibrary||[];
  const freeMatches=freeLib.filter(row=>{
    const key=normCatalogText(row[1]);
    if(seen.has(key))return false;
    return matchesAny(row[1],row[2],row[3],dn(row[1]));
  }).slice(0,40);
  freeMatches.forEach(row=>seen.add(normCatalogText(row[1])));
  const catalogChips=catalogMatches.map(row=>{
    const[en,es,muscle]=row;
    const freeRow=freeLib.find(r=>normCatalogText(r[1])===normCatalogText(en));
    const ptData=freeRow&&(root.ForjaFreeExercisePt||{})[freeRow[0]];
    const displayName=dn(en);
    const thumb=freeRow&&freeRow[5]?`<img src="${freeRow[5]}">`:`<div class="ex-chip-ph">🏋️</div>`;
    return `<div class="ex-chip" data-ex-name="${t.escapeHtml(en)}" data-ex-src="catalog" data-ex-muscle="${t.escapeHtml(muscle)}" onclick="ForjaGymUI.addCatalogExercise('${en.replace(/'/g,"\\'")}','${muscle.replace(/'/g,"\\'")}')">${thumb}<div class="lbl">${t.escapeHtml(displayName)}</div></div>`;
  });
  const freeChips=freeMatches.map(row=>{
    const[id,en,,musclePt,,img]=row;
    const ptData=(root.ForjaFreeExercisePt||{})[id];
    const displayName=dn(en);
    const thumb=img?`<img src="${img}">`:`<div class="ex-chip-ph">🏋️</div>`;
    return `<div class="ex-chip" data-ex-name="${t.escapeHtml(en)}" data-ex-src="free" data-ex-muscle="${t.escapeHtml(musclePt||'')}" onclick="ForjaGymUI.addFreeExercise('${en.replace(/'/g,"\\'")}','${(musclePt||'').replace(/'/g,"\\'")}')">${thumb}<div class="lbl">${t.escapeHtml(displayName)}</div></div>`;
  });
  wrap.innerHTML=(catalogChips.join('')+freeChips.join(''))||'<div class="empty">Nenhum exercício encontrado na biblioteca.</div>';
}
async function addFreeExercise(name,musclePt){
  tapFeedback();const t=T();
  const cache=await t.loadMuscleCache();
  const key=t.slug(name);
  if(!cache[key])cache[key]=FREE_EX_MUSCLE_MAP[musclePt]||'Peito';
  await t.persistMuscleCache();
  const inp=$('gym-catalog-search');if(inp)inp.value='';
  const wrap=$('picker-catalog-list');if(wrap)wrap.innerHTML='';
  await addExerciseToSession(name);
}
async function addCatalogExercise(name,muscleGroup){
  tapFeedback();const t=T();
  const cache=await t.loadMuscleCache();
  const key=t.slug(name);
  if(!cache[key])cache[key]=CATALOG_MUSCLE_MAP[muscleGroup]||'Peito';
  await t.persistMuscleCache();
  const inp=$('gym-catalog-search');if(inp)inp.value='';
  const wrap=$('picker-catalog-list');if(wrap)wrap.innerHTML='';
  await addExerciseToSession(name);
}
// Equipamento de cardio (esteira, bike, escada...) — já entra classificado como
// 'Cardio' e em modo cardio (tempo/distância/kcal), sem precisar trocar o modo
// manualmente depois de adicionar.
async function addCardioEquipment(name){
  tapFeedback();const t=T();
  const key=t.slug(name);
  const muscleCache=await t.loadMuscleCache();
  if(!muscleCache[key]){muscleCache[key]='Cardio';await t.persistMuscleCache();}
  const modeCache=await t.loadWeightModeCache();
  if(!modeCache[key]){modeCache[key]='cardio';await t.persistWeightModeCache();}
  await addExerciseToSession(name);
}
function showNewExerciseForm(){tapFeedback();const f=$('new-ex-form');if(f)f.style.display=f.style.display==='none'?'block':'none';}
let selectedMuscleForNew='Peito';
function selectMuscle(btn){tapFeedback();root.document.querySelectorAll('.muscle-chip').forEach(b=>b.classList.remove('active'));btn.classList.add('active');selectedMuscleForNew=btn.dataset.muscle;const tag=$('muscle-suggested-tag');if(tag)tag.style.display='none';}
function setMuscleForNew(muscleGroup,suggested){
  if(!muscleGroup)return;
  const btn=root.document.querySelector(`.muscle-chip[data-muscle="${muscleGroup}"]`);
  if(!btn)return;
  root.document.querySelectorAll('.muscle-chip').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');selectedMuscleForNew=muscleGroup;
  const tag=$('muscle-suggested-tag');if(tag)tag.style.display=suggested?'inline':'none';
}
let muscleSuggestTimer=null;
function suggestMuscleFromName(rawName){
  clearTimeout(muscleSuggestTimer);
  muscleSuggestTimer=setTimeout(()=>{
    const q=normCatalogText(rawName);
    if(q.length<3)return;
    const catalog=root.ForjaGymCatalog||[];
    let best=null;
    for(const row of catalog){
      const en=normCatalogText(row[0]),es=normCatalogText(row[1]);
      if(en===q||es===q){best=row;break;}
      if(!best&&(en.includes(q)||q.includes(en)||es.includes(q)))best=row;
    }
    if(best){const mapped=CATALOG_MUSCLE_MAP[best[2]]||null;if(mapped)setMuscleForNew(mapped,true);}
  },250);
}
function toTitleCasePt(str){
  const small=new Set(['de','da','do','das','dos','e','com','em','na','no']);
  return String(str||'').trim().toLowerCase().split(/\s+/).map((w,i)=>i>0&&small.has(w)?w:w.charAt(0).toUpperCase()+w.slice(1)).join(' ');
}
async function createNewExercise(){
  const t=T();
  const rawName=$('new-ex-name').value.trim();if(!rawName){showToast('Digite o nome do exercício.');return;}
  const name=toTitleCasePt(rawName);
  await t.loadMuscleCache();
  t.getMuscleSync;// noop to ensure cache loaded before write below
  const cache=await t.loadMuscleCache();cache[t.slug(name)]=selectedMuscleForNew;await t.persistMuscleCache();
  $('new-ex-name').value='';
  $('new-ex-form').style.display='none';
  await addExerciseToSession(name);
}


function removeExerciseCard(idx){
  const ex=sessionExercises[idx];if(!ex||ex.sets.length>0)return;
  tapFeedback();if(sheetIdx!==null)closeExSheet();sessionExercises.splice(idx,1);renderSessionStack();refreshTreinoTabVisibility();
}

// ================= PROGRESSION BANNER / ANALYSIS =================
async function buildProgressionBannerHtml(idx){
  const t=T();const ex=sessionExercises[idx];const arr=await t.loadWorkouts();
  const past=arr.filter(e=>e.name.trim()===ex.name&&e.date!==t.todayKey()).sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')));
  if(past.length<2)return'';
  const last2=past.slice(0,2).map(e=>t.bestPairForEntry(e));
  const sameWeight=last2[0].w>0&&Math.abs(last2[0].w-last2[1].w)<0.01,bothHighReps=last2[0].r>=12&&last2[1].r>=12;
  if(sameWeight&&bothHighReps){
    const bump=last2[0].w>=20?5:2.5;
    return `<div class="progression-banner"><div class="icon">💡</div><div style="flex:1">Mesma carga, 12+ reps nas últimas 2 vezes. Suba o peso, <b>ou</b> mantenha e tente mais reps — as duas formas geram ganho equivalente.</div><button onclick="ForjaGymUI.adjustCardWeight(${idx},${bump})">+${String(bump).replace('.',',')}kg</button></div>`;
  }
  return'';
}
let progressionOpenSet=new Set();
let progressionChartData={};
function toggleProgressionAnalysis(idx){tapFeedback();if(progressionOpenSet.has(idx))progressionOpenSet.delete(idx);else progressionOpenSet.add(idx);renderCard(idx);}
async function buildProgressionAnalysisHtml(idx,name){
  const t=T();const a=await t.analyzeProgression(name);
  if(a.status==='insufficient')return `<div class="empty" style="padding:6px 0;">Precisa de pelo menos 4 sessões registradas pra analisar tendência.</div>`;
  progressionChartData[idx]={chartData:a.points.map(p=>({label:t.fmtDate(p.date).slice(0,5),value:Math.round(p.rm)})),volData:a.points.map(p=>({label:t.fmtDate(p.date).slice(0,5),value:Math.round(p.volume)}))};
  let statusHtml='';
  if(a.status==='plateau'){
    statusHtml=`<div class="plateau-banner">⚠️ <b>Platô detectado</b> — sem progressão real de carga nas últimas ${Math.round(a.weeksSpan)} semanas nesse exercício.</div>`;
    if(a.deloadSuggested)statusHtml+=`<div class="deload-banner">💤 <b>Considere um deload</b> — reduza ~40-50% do volume por uma semana e volte depois.${a.avgRpe?` (esforço médio recente alto: RPE ${a.avgRpe.toFixed(1)})`:''}</div>`;
  }else statusHtml=`<div class="progressing-banner">✅ Progredindo — a tendência das últimas sessões está subindo.</div>`;
  return `<div class="progression-analysis">${statusHtml}
    <div class="chart-wrap" id="prog-chart-${idx}"></div>
    <div class="chart-wrap" id="prog-vol-chart-${idx}" style="margin-top:10px;"></div>
    <div class="progression-tip">💡 Duas formas igualmente válidas de progredir (Plotkin et al., 2022): <b>subir peso</b> mantendo as reps, OU <b>manter o peso e subir 1-2 reps</b>.</div>
  </div>`;
}
// Resumo de platô/deload sempre visível no card (sem precisar abrir a análise
// completa) — reaproveita a mesma análise de analyzeProgression, só que em
// formato compacto, com um botão pra ver o gráfico completo se quiser.
async function buildPlateauFlagHtml(name,idx){
  const t=T();
  const a=await t.analyzeProgression(name);
  if(a.status!=='plateau')return'';
  let html=`<div class="plateau-banner compact">⚠️ <b>Platô</b> — sem progressão de carga há ${Math.round(a.weeksSpan)} semana${Math.round(a.weeksSpan)===1?'':'s'} nesse exercício.`;
  if(a.deloadSuggested)html+=` 💤 <b>Considere um deload</b> (reduza ~40-50% do volume por uma semana).`;
  html+=` <button class="plateau-link-btn" onclick="ForjaGymUI.toggleProgressionAnalysis(${idx})">Ver gráfico</button></div>`;
  return html;
}
function renderProgressionChartsIfOpen(idx){
  if(!progressionOpenSet.has(idx))return;const data=progressionChartData[idx];if(!data)return;
  if($(`prog-chart-${idx}`)&&root.svgLineChart)root.svgLineChart(`prog-chart-${idx}`,data.chartData,{title:'1RM estimado (kg)'});
  if($(`prog-vol-chart-${idx}`)&&root.svgLineChart)root.svgLineChart(`prog-vol-chart-${idx}`,data.volData,{title:'Volume Load (kg)'});
}

// ================= BIBLIOTECA DE EXERCÍCIOS (grupo muscular, equipamento, execução, GIF) =================
let libraryOpenSet=new Set();
let libraryDataCache={};
function toggleLibraryOpen(idx){
  tapFeedback();
  if(libraryOpenSet.has(idx)){libraryOpenSet.delete(idx);renderCard(idx);return;}
  libraryOpenSet.add(idx);
  renderCard(idx);
  loadLibraryDataForCard(idx);
}
async function loadLibraryDataForCard(idx){
  const ex=sessionExercises[idx];if(!ex||!root.ForjaExerciseLibrary)return;
  if(!libraryOpenSet.has(idx))return;
  try{
    const media=await root.ForjaExerciseLibrary.getExerciseMedia(ex.name);
    libraryDataCache[idx]={name:ex.name,media};
  }catch{libraryDataCache[idx]={name:ex.name,media:null};}
  if(libraryOpenSet.has(idx))renderCard(idx);
}
function buildLibraryHtml(idx,name){
  if(!libraryOpenSet.has(idx))return'';
  const cached=libraryDataCache[idx];
  if(!cached||cached.name!==name)return `<div class="library-panel"><div class="empty" style="padding:8px 0;">🔍 Buscando na biblioteca de exercícios...</div></div>`;
  const media=cached.media;
  if(!media)return `<div class="library-panel"><div class="empty" style="padding:8px 0;">Nenhuma informação encontrada pra "${esc_(name)}" na biblioteca ainda.</div></div>`;
  const t=T();
  const mediaImg=media.gif||media.img;
  const imgHtml=mediaImg?`<img class="library-media" src="${mediaImg}" loading="lazy">`:'';
  const infoRow=[media.equip_pt?`<span class="lib-tag">🏋️ ${t.escapeHtml(media.equip_pt)}</span>`:''].filter(Boolean).join('');
  const stepsHtml=media.instr&&media.instr.length?`<ol class="lib-steps">${media.instr.map(s=>`<li>${t.escapeHtml(s)}</li>`).join('')}</ol>`:'<div class="empty" style="padding:4px 0;">Sem passo-a-passo detalhado disponível.</div>';
  const sourceNote=media.source==='exercisedb'||media.source==='wger+exercisedb'?'':'<div class="calc-formula-note" style="margin-top:4px;">💡 Configure sua chave da ExerciseDB em Mais → Integrações pra ver GIFs animados aqui.</div>';
  return `<div class="library-panel">${imgHtml}<div class="lib-tags-row">${infoRow}</div>${stepsHtml}${sourceNote}</div>`;
}
// Tag leve e sempre visível com o grupo muscular (sem precisar abrir o acordeão da biblioteca).
// Usa a categoria já salva localmente pro exercício (síncrono, sem rede).
function buildMuscleTagHtml(name){
  const t=T();const muscle=t.getMuscleSync(name);
  if(!muscle)return'';
  return `<div class="muscle-quick-tag">💪 ${t.escapeHtml(muscle)}</div>`;
}
function esc_(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

// ================= REMAPEAR HISTÓRICO PRA NOVA BIBLIOTECA =================
// Passa por todo exercício já registrado no histórico e tenta achar musculatura/equipamento/
// fotos/instruções na biblioteca nova (wger + free-exercise-db), atualizando a categoria
// muscular salva e pré-aquecendo o cache de mídia pra abrir mais rápido depois.
async function remapHistoryToLibrary(onProgress){
  const t=T();
  if(!root.ForjaExerciseLibrary)return{total:0,updated:0,unmatched:0};
  const names=await t.getRecentExerciseNames();
  const cache=await t.loadMuscleCache();
  let updated=0,unmatched=0;
  for(let i=0;i<names.length;i++){
    const name=names[i];
    const key=t.slug(name);
    const guess=root.ForjaExerciseLibrary.guessAppMuscle(name);
    if(guess){
      if(cache[key]!==guess){cache[key]=guess;updated++;}
    }else if(!cache[key]){
      unmatched++;
    }
    try{await root.ForjaExerciseLibrary.getExerciseMedia(name);}catch{}
    if(onProgress)onProgress(i+1,names.length);
  }
  await t.persistMuscleCache();
  return{total:names.length,updated,unmatched};
}
async function runRemapHistory(){
  tapFeedback();
  const status=$('remap-history-status');
  if(status)status.textContent='Processando... isso pode levar um tempinho se seu histórico tiver muitos exercícios diferentes.';
  const result=await remapHistoryToLibrary((done,total)=>{
    if(status)status.textContent=`Processando ${done}/${total}...`;
  });
  if(status){
    if(result.total===0){
      status.textContent='Nenhum exercício encontrado no seu histórico ainda.';
    }else{
      status.textContent=`✅ ${result.total} exercícios do histórico processados — ${result.updated} tiveram a musculatura atualizada/corrigida, ${result.unmatched} não foram encontrados na biblioteca (ficam como estavam).`;
    }
  }
  showToast('Histórico remapeado!');
  await renderMuscleOverview();
}

// ================= DICA (execution tip) editing =================
let cardTipEditingIdx=null;
function toggleCardTipEdit(idx){tapFeedback();cardTipEditingIdx=(cardTipEditingIdx===idx)?null:idx;renderCard(idx);}
async function saveCardTip(idx){
  const t=T();const ex=sessionExercises[idx];if(!ex)return;
  const el=$(`dica-textarea-${idx}`);const text=el?el.value.trim():'';
  const cache=await t.loadNotesCache();cache[t.slug(ex.name)]=text;await t.persistNotesCache();
  cardTipEditingIdx=null;showToast('Dica salva!');await renderCard(idx);
}
function buildDicaHtml(idx,name){
  const t=T();const noteText=t.getNoteSync(name);
  if(cardTipEditingIdx===idx)return `<div class="dica-edit-panel"><textarea id="dica-textarea-${idx}" rows="2" placeholder="Escreva o que o treinador falou...">${t.escapeHtml(noteText)}</textarea><button class="primary secondary-btn" onclick="ForjaGymUI.saveCardTip(${idx})" style="margin-top:6px;">Salvar dica</button></div>`;
  if(noteText)return `<div class="dica-box"><div class="lbl">💡 Dica de execução</div><div class="txt">${t.escapeHtml(noteText)}</div><button class="dica-edit-btn" onclick="ForjaGymUI.toggleCardTipEdit(${idx})">✏️ editar</button></div>`;
  return `<div class="dica-empty"><div class="txt">Nenhuma dica de execução salva.</div><button class="dica-add-btn" onclick="ForjaGymUI.toggleCardTipEdit(${idx})">+ Adicionar</button></div>`;
}

// ================= WEIGHT HISTORY MINI-CHART =================
async function buildLastBadgeHtml(name){
  const t=T();const arr=await t.loadWorkouts();
  const past=arr.filter(e=>e.name.trim()===name&&e.date!==t.todayKey()).sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')));
  if(past.length===0)return `<div class="ex-last-badge empty"><div><div class="lbl">Última vez</div><div class="val">Primeira vez registrando esse exercício</div></div></div>`;
  const e=past[0],best=t.bestPairForEntry(e);
  const isNoneMode=t.getWeightModeSync(name)==='none';
  const valText=best.w||best.r?(isNoneMode?`${best.r} reps`:`${t.fmtWeight(best.w)}kg × ${best.r} reps`):(e.weight||e.reps||'registrado');
  return `<div class="ex-last-badge"><div><div class="lbl">Última vez — melhor série</div><div class="val">${t.escapeHtml(valText)}</div></div><div class="date">${t.fmtDate(e.date)}</div></div>`;
}
async function buildWeightHistoryHtml(name){
  const t=T();const arr=await t.loadWorkouts();
  const past=arr.filter(e=>e.name.trim()===name).sort((a,b)=>(a.date+(a.time||'')).localeCompare(b.date+(b.time||'')));
  if(past.length===0)return'';
  const recent=past.slice(-6);let maxW=0;
  const items=recent.map(e=>{const best=t.bestPairForEntry(e);if(best.w>maxW)maxW=best.w;return{date:e.date,isToday:e.date===t.todayKey(),...best};});
  const detailed=[...recent].reverse().map(e=>{
    const ws=t.parseWeightList(e.weight),rs=t.parseRepsList(e.reps),n=Math.max(ws.length,rs.length);
    let setsStr='—';
    if(n>0){const parts=[];for(let i=0;i<n;i++){const w=ws[Math.min(i,ws.length-1)],r=rs[Math.min(i,rs.length-1)];if(w!==undefined&&r!==undefined)parts.push(`${t.fmtWeight(w)}kg×${r}`);}setsStr=parts.join(', ');}
    return `<div class="session-row"><span class="sdate">${t.fmtDate(e.date)}</span><span class="ssets">${t.escapeHtml(setsStr)}</span></div>`;
  }).join('');
  const chartHtml=items.length>=2?`<div class="hist-strip">${items.map(it=>{
    const pct=maxW>0?Math.max(14,Math.round((it.w/maxW)*100)):14;
    return `<div class="hist-bar-col ${it.isToday?'today':''}"><div class="hist-bar-fill" style="height:${pct}%"></div><div class="hist-bar-val">${it.w?t.fmtWeight(it.w):'-'}</div><div class="hist-bar-date">${t.fmtDate(it.date).slice(0,5)}</div></div>`;
  }).join('')}</div>`:'';
  return `<div class="hist-wrap"><div class="hist-label">Histórico de cargas neste exercício</div>${chartHtml}<div class="session-table">${detailed}</div></div>`;
}

// ================= CARD BUILD / RENDER =================
// Layout do card (treino em andamento): foto inteira no topo -> nome em português +
// grupo muscular -> "última vez" -> carga -> reps -> séries de hoje -> finalizar.
// Tudo que é secundário (dica, vídeo, histórico, análise, modo de peso) fica
// dentro de "Mais opções", fechado por padrão, pra tela ficar limpa.
let moreOpenSet=new Set();
function toggleMoreOpen(idx){tapFeedback();if(moreOpenSet.has(idx))moreOpenSet.delete(idx);else moreOpenSet.add(idx);renderCard(idx);}
function openExercisePhotoPopup(idx){const ex=sessionExercises[idx];if(!ex)return;const lp=root.ForjaExerciseLongPress;if(lp&&lp.openFor)lp.openFor(ex.name,'mine',T().getMuscleSync(ex.name));}
function pickExercisePhoto(idx){
  const ex=sessionExercises[idx];if(!ex)return;
  const input=root.document.createElement('input');input.type='file';input.accept='image/*';
  input.onchange=async()=>{
    const f=input.files&&input.files[0];if(!f)return;
    try{
      const t=T();const url=await t.fileToSmallDataUrl(f);
      await t.setExercisePhoto(ex.name,url);
      showToast('Foto do exercício salva.');
      await renderCard(idx);
    }catch(e){showToast(e.message||'Não consegui salvar a foto.');}
  };
  input.click();
}
let sheetIdx=null,sessionRecords=0,pendingSummary=null,sessionsMetric='kcal';
async function buildSparkHtml(name){
  try{
    const t=T();const arr=await t.loadWorkouts();
    const byDate={};
    arr.filter(e=>e.name.trim()===name&&e.date!==t.todayKey()).forEach(e=>{const m=Math.max(0,...t.parseWeightList(e.weight));if(m>0)byDate[e.date]=Math.max(byDate[e.date]||0,m);});
    const pts=Object.keys(byDate).sort().slice(-8).map(d=>byDate[d]);
    if(pts.length<2)return '';
    const W=300,H=44,mn=Math.min(...pts),mx=Math.max(...pts),rg=(mx-mn)||1;
    const xy=pts.map((v,i)=>[6+i*(W-12)/(pts.length-1),H-8-((v-mn)/rg)*(H-16)]);
    const line=xy.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ');
    const diff=pts[pts.length-1]-pts[0];
    return `<div class="spark"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polyline points="${line}" fill="none" stroke="#ff4d63" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>${xy.map((p,i)=>`<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="${i===xy.length-1?4:2.5}" fill="${i===xy.length-1?'#fff':'#ff4d63'}"/>`).join('')}</svg><span class="spark-lbl">Carga nas últimas ${pts.length} sessões: ${diff>0?'▲ +':diff<0?'▼ ':'= '}${t.fmtWeight(Math.abs(diff))}kg</span></div>`;
  }catch{return '';}
}
async function openExSheet(idx){
  const ex=sessionExercises[idx];if(!ex)return;tapFeedback();
  if(ex.finished)ex.finished=false;
  const wasOpen=sheetIdx!==null;sheetIdx=idx;
  root.document.body.classList.add('ex-sheet-open');
  if(!wasOpen){try{root.history.pushState({exSheet:idx},'');}catch{}}
  await renderSessionStack();
  const el=$('ex-card-'+idx);if(el)el.scrollTop=0;
}
async function closeExSheet(fromPop){
  if(sheetIdx===null)return;
  sheetIdx=null;root.document.body.classList.remove('ex-sheet-open');
  if(!fromPop){try{if(root.history.state&&root.history.state.exSheet!==undefined)root.history.back();}catch{}}
  await renderSessionStack();renderHeroStats();
}
if(root.addEventListener)root.addEventListener('popstate',()=>{if(sheetIdx!==null)closeExSheet(true);});

async function buildCardHtml(idx){
  if(sheetIdx!==idx)return buildRowHtml(idx);
  return buildSheetHtml(idx);
}


async function renderCard(idx){const el=$(`ex-card-${idx}`);if(!el)return;const st=el.scrollTop;const html=await buildCardHtml(idx);const cur=$(`ex-card-${idx}`)||el;cur.outerHTML=html;const nw=$(`ex-card-${idx}`);if(nw&&st)nw.scrollTop=st;renderProgressionChartsIfOpen(idx);}
async function renderSessionStack(){
  const container=$('session-stack');if(!container)return;
  const htmls=await Promise.all(sessionExercises.map((_,idx)=>buildCardHtml(idx)));
  container.innerHTML=htmls.join('');
  sessionExercises.forEach((_,idx)=>renderProgressionChartsIfOpen(idx));
  await renderMuscleOverview();
}
async function renderMuscleOverview(){
  const t=T();if(sessionExercises.length===0)return;await t.loadMuscleCache();
  root.document.querySelectorAll('.muscle-zone-img').forEach(z=>z.classList.remove('highlight','secondary'));
  const primaries=new Set(),secondaries=new Set();
  sessionExercises.forEach(ex=>{
    const group=t.getMuscleSync(ex.name);
    (t.MUSCLE_ZONES[group]||[]).forEach(z=>primaries.add(z));
    (t.SECONDARY_ZONES[group]||[]).forEach(z=>secondaries.add(z));
  });
  primaries.forEach(zone=>root.document.querySelectorAll(`.muscle-zone-img[data-zone="${zone}"]`).forEach(el=>el.classList.add('highlight')));
  secondaries.forEach(zone=>{if(!primaries.has(zone))root.document.querySelectorAll(`.muscle-zone-img[data-zone="${zone}"]`).forEach(el=>el.classList.add('secondary'));});
}
function adjustCardWeight(idx,delta){tapFeedback();const ex=sessionExercises[idx];if(!ex)return;ex.weight=Math.max(0,Math.round((ex.weight+delta)*10)/10);renderCard(idx);}
const WEIGHT_MODE_CYCLE=['normal','bodyweight','none','cardio'];
const WEIGHT_MODE_LABEL={normal:'⚖️ Peso normal',bodyweight:'🏃 Peso corporal',none:'🚫 Sem peso (só repetição)',cardio:'🚴 Cardio (tempo/distância/kcal)'};
async function cycleWeightMode(idx){
  tapFeedback();const t=T();const ex=sessionExercises[idx];if(!ex)return;
  const next=WEIGHT_MODE_CYCLE[(WEIGHT_MODE_CYCLE.indexOf(ex.weightMode||'normal')+1)%WEIGHT_MODE_CYCLE.length];
  ex.weightMode=next;
  const cache=await t.loadWeightModeCache();cache[t.slug(ex.name)]=next;await t.persistWeightModeCache();
  if(next==='bodyweight')ex.weight=await t.getLastBodyWeight()||ex.weight;
  else if(next==='none'||next==='cardio')ex.weight=0;
  renderCard(idx);
}
async function logCardioSetForCard(idx){
  const t=T();const ex=sessionExercises[idx];if(!ex)return;tapFeedback();
  const minEl=$(`cardio-min-${idx}`),kmEl=$(`cardio-km-${idx}`),kcalEl=$(`cardio-kcal-${idx}`);
  const cardioMin=parseFloat((minEl?.value||'').replace(',','.'))||0;
  const cardioKm=parseFloat((kmEl?.value||'').replace(',','.'))||0;
  const cardioKcal=parseFloat((kcalEl?.value||'').replace(',','.'))||0;
  if(cardioMin<=0&&cardioKm<=0&&cardioKcal<=0){showToast('Preencha ao menos um valor (duração, distância ou calorias).');return;}
  ex.sets.push({weight:0,reps:0,warmup:false,rir:'',cardioMin,cardioKm,cardioKcal});
  await persistCardSets(idx);await renderCard(idx);await renderTodayList();
  const parts=[];if(cardioMin>0)parts.push(`${cardioMin} min`);if(cardioKm>0)parts.push(`${cardioKm} km`);if(cardioKcal>0)parts.push(`${cardioKcal} kcal`);
  showToast(`✓ Cardio registrado: ${parts.join(' · ')}`);
}

async function persistCardSets(idx){
  const t=T();const ex=sessionExercises[idx];const arr=await t.loadWorkouts();
  const weightStr=ex.sets.map(s=>t.fmtWeight(s.weight)).join('|'),repsStr=ex.sets.map(s=>s.reps).join(',');
  const warmupStr=ex.sets.map(s=>s.warmup?'1':'0').join('|'),rirStr=ex.sets.map(s=>s.rir||'').join('|');
  const cardioMinStr=ex.sets.map(s=>s.cardioMin??'').join('|'),cardioKmStr=ex.sets.map(s=>s.cardioKm??'').join('|'),cardioKcalStr=ex.sets.map(s=>s.cardioKcal??'').join('|');
  const notes=t.getNoteSync(ex.name);
  if(ex.sets.length===0){if(ex.workoutId){await t.saveWorkouts(arr.filter(e=>e.id!==ex.workoutId));ex.workoutId=null;}return;}
  if(ex.workoutId){
    const i2=arr.findIndex(e=>e.id===ex.workoutId);
    if(i2>=0){arr[i2].weight=weightStr;arr[i2].reps=repsStr;arr[i2].warmup=warmupStr;arr[i2].rir=rirStr;arr[i2].cardioMin=cardioMinStr;arr[i2].cardioKm=cardioKmStr;arr[i2].cardioKcal=cardioKcalStr;arr[i2].time=t.nowTime();}
    await t.saveWorkouts(arr);
  }else{
    const id=t.cid();ex.workoutId=id;
    arr.push({id,date:t.todayKey(),time:t.nowTime(),name:ex.name,detail:notes,weight:weightStr,reps:repsStr,warmup:warmupStr,rir:rirStr,cardioMin:cardioMinStr,cardioKm:cardioKmStr,cardioKcal:cardioKcalStr,rest:''});
    await t.saveWorkouts(arr);
  }
}


if(root.document)root.document.addEventListener('click',e=>{const p=$('rest-pop');if(p&&!p.hidden&&!e.target.closest('#rest-trigger-row'))p.hidden=true;});
function toggleWarmupMode(idx){tapFeedback();const ex=sessionExercises[idx];if(!ex)return;ex.warmupMode=!ex.warmupMode;renderCard(idx);}
function setCardRir(idx,val){tapFeedback();const ex=sessionExercises[idx];if(!ex)return;ex.pendingRir=(ex.pendingRir===val)?null:val;renderCard(idx);}


function reopenExercise(idx){openExSheet(idx);}

// ================= REST TIMER (popup) =================
let restDurationSeconds=60,restRemaining=0,restInterval=null,restWarned=false;


function toggleCustomRest(){tapFeedback();const p=$('custom-rest-panel');if(p)p.style.display=p.style.display==='none'?'block':'none';}
let customRestMin=1,customRestSec=0;
function adjustCustomRestMin(d){tapFeedback();customRestMin=Math.max(0,customRestMin+d);const el=$('custom-rest-min');if(el)el.textContent=customRestMin;}
function adjustCustomRestSec(d){tapFeedback();customRestSec=Math.max(0,Math.min(55,customRestSec+d));const el=$('custom-rest-sec');if(el)el.textContent=customRestSec;}
function applyCustomRest(){tapFeedback();restDurationSeconds=Math.max(15,customRestMin*60+customRestSec);syncRestLabel();const p=$('custom-rest-panel');if(p)p.style.display='none';}






// ================= FORJA 3.0 — ACADEMIA =================
// Tipos de exercício: normal = kg × reps · none = só repetições (peso = extra opcional) · bodyweight (legado: peso corporal)
// time = tempo (reps guarda os segundos) · cardio = min/km/kcal
const MODE_SEG=[['normal','kg'],['none','Repetições'],['time','Tempo'],['cardio','Cardio']];
const K_LAST_GROUP='gym-last-group';
let activeGroupName='',activeGroupId=null,timeTickInterval=null,wakeLockRef=null;
function segMode(m){return m==='bodyweight'?'none':(m||'normal');}
function fw(w){return T().fmtWeight(w);}
function fmtSecs(n){n=Math.max(0,Math.round(n||0));return n>=60?`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`:`${n} s`;}
function fmtSetValue(st,mode){
  const m=segMode(mode);
  if(m==='time')return fmtSecs(st.reps)+(st.weight>0&&mode!=='bodyweight'?` · +${fw(st.weight)} kg`:'');
  if(m==='none')return `${st.reps}`+(st.weight>0&&mode!=='bodyweight'?` · +${fw(st.weight)} kg`:'');
  return `${fw(st.weight)} × ${st.reps}`;
}
function fmtSetsShort(sets,mode){
  const m=segMode(mode);const work=(sets||[]).filter(x=>!x.warmup);if(!work.length)return '';
  const sameR=work.every(x=>x.reps===work[0].reps),sameW=work.every(x=>Math.abs((x.weight||0)-(work[0].weight||0))<0.01);
  if(m==='time')return sameR?`${work.length} × ${fmtSecs(work[0].reps)}`:work.map(x=>fmtSecs(x.reps)).join(' · ');
  if(m==='none'){const ex=work[0].weight>0&&mode!=='bodyweight'&&sameW?` · +${fw(work[0].weight)} kg`:'';return sameR?`${work.length} × ${work[0].reps}${ex}`:work.map(x=>x.reps).join(' · ')+ex;}
  if(sameR&&sameW)return `${work.length} × ${work[0].reps} · ${fw(work[0].weight)} kg`;
  if(sameR)return `${work.map(x=>fw(x.weight)).join(' · ')} kg × ${work[0].reps}`;
  return work.map(x=>`${fw(x.weight)}×${x.reps}`).join(' · ');
}
const DIAS_CURTOS=['dom','seg','ter','qua','qui','sex','sáb'];
const MESES_CURTOS=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function diaCurto(key){const [y,m,d]=key.split('-').map(Number);const dt=new Date(y,m-1,d,12);const hoje=new Date();const diff=Math.round((new Date(hoje.getFullYear(),hoje.getMonth(),hoje.getDate(),12)-dt)/864e5);if(diff===1)return 'ontem';if(diff>1&&diff<7)return DIAS_CURTOS[dt.getDay()];return `${String(d).padStart(2,'0')}/${String(m).padStart(2,'0')}`;}
function thumbHtml(photo,cls){
  return photo?`<span class="ex-thumb ${cls||''}"><img src="${photo}" alt="" draggable="false" onerror="this.parentNode.classList.add('ph');this.remove()"></span>`:`<span class="ex-thumb ${cls||''} ph"></span>`;
}
function entrySets(e){
  const t=T();const ws=t.parseWeightList(e.weight),rs=t.parseRepsList(e.reps),warm=t.parseWarmupList(e.warmup);
  return rs.map((r,i)=>({weight:ws[i]!==undefined?ws[i]:(ws[ws.length-1]||0),reps:r,warmup:!!warm[i]}));
}
async function lastSessionFor(name){
  const t=T();const arr=await t.loadWorkouts();
  const past=arr.filter(e=>e.name.trim()===name&&e.date!==t.todayKey()).sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')));
  if(!past.length)return null;
  return{date:past[0].date,sets:entrySets(past[0])};
}
function lastWork(ex){return ex.last?ex.last.sets.filter(x=>!x.warmup):[];}
function workDone(ex){return ex.sets.filter(x=>!x.warmup).length;}
function planCount(ex){return Math.max(ex.planCount||3,workDone(ex));}
function defaultRepsFor(ex,k){const lw=lastWork(ex);if(ex.targetReps)return ex.targetReps;if(lw[k])return lw[k].reps;if(lw.length)return lw[lw.length-1].reps;return segMode(ex.weightMode)==='time'?30:10;}
function suggestionFor(ex){
  const lw=lastWork(ex);if(lw.length<2)return null;const m=segMode(ex.weightMode);
  const r0=lw[0].reps;const allHit=lw.every(x=>x.reps>=r0);if(!allHit)return null;
  if(m==='normal'){
    const w=lw[0].weight;if(!(w>0))return null;if(!lw.every(x=>Math.abs(x.weight-w)<0.01))return null;
    const inc=w>=20?2.5:1;const nw=Math.round((w+inc)*10)/10;
    return{kind:'kg',value:nw,text:`Você fez ${lw.length} × ${r0} com ${fw(w)} kg.`,action:`Hoje: ${fw(nw)} kg`};
  }
  if(m==='none')return{kind:'reps',value:r0+1,text:`Bateu ${r0} nas ${lw.length} séries.`,action:`Hoje: ${r0+1}`};
  if(m==='time')return{kind:'reps',value:r0+5,text:`Segurou ${fmtSecs(r0)} nas ${lw.length} séries.`,action:`Hoje: ${fmtSecs(r0+5)}`};
  return null;
}
async function applySuggestion(idx){
  tapFeedback();const ex=sessionExercises[idx];if(!ex)return;const sg=suggestionFor(ex);if(!sg)return;
  if(sg.kind==='kg')ex.weight=sg.value;else{ex.targetReps=sg.value;ex.pendingReps=sg.value;}
  ex.sgApplied=true;renderCard(idx);
}

// ---------- sessão ----------
async function startWorkoutSession(opts){
  tapFeedback();const t=T();opts=opts||{};
  activeSessionStartTs=Date.now();activeGroupName=opts.groupName||'';activeGroupId=opts.groupId||null;
  await t.storage().set(t.K_ACTIVE,JSON.stringify({date:t.todayKey(),start:activeSessionStartTs,groupName:activeGroupName,groupId:activeGroupId}));
  showSessionRunningUI();refreshTreinoTabVisibility();keepAwake(true);
  if(!opts.silent)showToast('Treino iniciado. Bora!');
}
function showSessionRunningUI(){
  $('session-idle').style.display='none';$('session-running').style.display='block';const sbx=$('session-box');if(sbx)sbx.classList.add('running');
  const nm=$('tr-nome');if(nm)nm.textContent=activeGroupName||'Treino livre';
  renderHeroStats();clearInterval(sessionTickInterval);tickSessionTimer();sessionTickInterval=setInterval(tickSessionTimer,1000);
}
function tickSessionTimer(){
  if(!activeSessionStartTs)return;
  const el=Math.floor((Date.now()-activeSessionStartTs)/1000);
  const h=Math.floor(el/3600),mm=String(Math.floor(el/60)%60).padStart(2,'0'),ss=String(el%60).padStart(2,'0');
  const e=$('session-timer');if(e)e.textContent=h?`${h}:${mm}:${ss}`:`${mm}:${ss}`;
}
async function initSessionState(){
  const t=T();
  try{
    const r=await t.storage().get(t.K_ACTIVE);
    if(r&&r.value){const data=JSON.parse(r.value);if(data&&data.date===t.todayKey()&&data.start){activeSessionStartTs=data.start;activeGroupName=data.groupName||'';activeGroupId=data.groupId||null;showSessionRunningUI();}}
  }catch{}
  refreshTreinoTabVisibility();
}
function refreshTreinoTabVisibility(){
  const hasCards=sessionExercises.length>0,sessionActive=!!activeSessionStartTs;
  const show=(id,v,disp)=>{const e=$(id);if(e)e.style.display=v?(disp||'block'):'none';};
  show('session-stack',hasCards);show('add-exercise-btn',hasCards&&sessionActive);
  show('muscle-overview-card',hasCards);
  show('picker-card',!hasCards&&sessionActive);
  const pc=$('picker-close-btn');if(pc)pc.style.display=hasCards?'inline-block':'none';
  show('start-session-prompt',false);
  show('ac-hoje',!sessionActive);
  const ac=$('tab-academia');if(ac)ac.classList.toggle('em-treino',sessionActive);
}
async function endWorkoutSession(){
  tapFeedback();const t=T();
  if(!activeSessionStartTs)return;
  const durationMin=Math.max(1,Math.round((Date.now()-activeSessionStartTs)/60000));
  const stats=computeSessionStats();const kcal=await estimateKcal(stats.sets,durationMin,stats.cardioKcal);
  if(sheetIdx!==null)await closeExSheet();
  pularRest(true);
  const sessions=await t.loadSessionsCache();
  const sessionId=t.cid();
  sessions.push({id:sessionId,date:t.todayKey(),start:activeSessionStartTs,end:Date.now(),durationMin,sets:stats.sets,volume:Math.round(stats.vol),kcal,group:activeGroupName||'',groupId:activeGroupId||null});
  await t.persistSessionsCache();
  if(activeGroupId){try{await t.storage().set(K_LAST_GROUP,JSON.stringify({id:activeGroupId,date:t.todayKey()}));}catch{}}
  pendingSummary={sessionId,durationMin,sets:stats.sets,volume:Math.round(stats.vol),kcal,exs:stats.exs,names:stats.names.slice(),records:sessionRecordList.slice(),group:activeGroupName};
  sessionRecords=0;sessionRecordList=[];
  await t.storage().set(t.K_ACTIVE,'');
  clearInterval(sessionTickInterval);activeSessionStartTs=null;activeGroupName='';activeGroupId=null;keepAwake(false);
  $('session-running').style.display='none';$('session-idle').style.display='block';const sbx=$('session-box');if(sbx)sbx.classList.remove('running');
  sessionExercises=[];
  await renderSessionStack();refreshTreinoTabVisibility();
  await renderTodayList();await renderWeeklyGoal();await renderHoje();
  root.ForjaGymSuggest?.render?.();
  await showSummary();
}
async function loadWorkoutGroupToSession(id){
  tapFeedback();const t=T();const groups=await t.loadWorkoutGroups();
  const g=groups.find(x=>x.id===id);if(!g)return;
  if(!activeSessionStartTs)await startWorkoutSession({groupName:g.name,groupId:g.id,silent:true});
  else if(!activeGroupName){activeGroupName=g.name;activeGroupId=g.id;const nm=$('tr-nome');if(nm)nm.textContent=g.name;}
  for(const name of g.exercises){await addExerciseToSession(name,{silent:true});}
  await renderSessionStack();refreshTreinoTabVisibility();renderHeroStats();
  showToast(`${g.name}: ${g.exercises.length} exercícios. Toque no primeiro para começar.`);
  $('tab-academia')?.scrollIntoView({behavior:'smooth',block:'start'});
}
async function startFreeWorkout(){
  if(!activeSessionStartTs)await startWorkoutSession({groupName:'',silent:true});
  await openPickerForAdd();
}
async function addExerciseToSession(name,opts){
  opts=opts||{};if(!opts.silent)tapFeedback();const t=T();
  if(!activeSessionStartTs){showToast('Comece um treino primeiro.');return;}
  const existingIdx=sessionExercises.findIndex(e=>e.name===name);
  if(existingIdx>=0){if(opts.silent)return;sessionExercises[existingIdx].finished=false;refreshTreinoTabVisibility();await openExSheet(existingIdx);return;}
  await t.loadNotesCache();await t.loadPhotosCache();await t.loadMuscleCache();await t.loadWeightModeCache();
  const arr=await t.loadWorkouts();
  const todayEntry=arr.find(e=>e.name.trim()===name&&e.date===t.todayKey());
  let sets=[],workoutId=null;
  if(todayEntry){
    workoutId=todayEntry.id;
    const rirs=t.parseRirList(todayEntry.rir);
    sets=entrySets(todayEntry).map((x,i)=>({...x,rir:rirs[i]||''}));
  }
  const weightMode=t.getWeightModeSync(name);
  const last=await lastSessionFor(name);
  const ex={name,workoutId,sets,weight:0,weightMode,pendingReps:10,finished:false,last,planCount:3};
  const lw=lastWork(ex);if(lw.length)ex.planCount=lw.length;
  if(sets.length)ex.weight=sets[sets.length-1].weight;
  else if(weightMode==='bodyweight')ex.weight=await t.getLastBodyWeight()||0;
  else if(weightMode==='normal')ex.weight=lw.length?lw[0].weight:(last&&last.sets.length?last.sets[last.sets.length-1].weight:20);
  else ex.weight=lw.length&&weightMode!=='cardio'?(lw[0].weight||0):0;
  ex.pendingReps=defaultRepsFor(ex,workDone(ex));
  const idx=sessionExercises.length;
  sessionExercises.push(ex);
  const f=$('new-ex-form');if(f)f.style.display='none';
  if(opts.silent)return;
  refreshTreinoTabVisibility();await openExSheet(idx);
}
async function setExerciseMode(idx,mode){
  tapFeedback();const t=T();const ex=sessionExercises[idx];if(!ex)return;
  if(segMode(ex.weightMode)===mode)return;
  ex.weightMode=mode;const cache=await t.loadWeightModeCache();cache[t.slug(ex.name)]=mode;await t.persistWeightModeCache();
  if(mode==='normal'){if(!(ex.weight>0))ex.weight=20;}else ex.weight=0;
  ex.targetReps=null;ex.pendingReps=mode==='time'?(ex.timeTarget||30):defaultRepsFor(ex,workDone(ex));
  stopTimeTick(ex);renderCard(idx);
}
function adjustPendingReps(idx,delta){tapFeedback();const ex=sessionExercises[idx];if(!ex)return;ex.pendingReps=Math.max(segMode(ex.weightMode)==='time'?5:1,(ex.pendingReps||0)+delta);renderCard(idx);}
function addPlannedSet(idx){tapFeedback();const ex=sessionExercises[idx];if(!ex)return;ex.planCount=planCount(ex)+1;renderCard(idx);}
function toggleExtraWeight(idx){tapFeedback();const ex=sessionExercises[idx];if(!ex)return;ex.showExtra=!ex.showExtra;if(!ex.showExtra)ex.weight=0;renderCard(idx);}

// ---------- linha da lista ----------
function buildRowHtml(idx){
  const t=T();const ex=sessionExercises[idx];
  const photo=t.getPhotoSync(ex.name)||(root.ForjaExerciseLibrary&&root.ForjaExerciseLibrary.getWgerImageSync(ex.name));
  const done=workDone(ex),plan=planCount(ex),m=segMode(ex.weightMode);
  let sub,st;
  if(m==='cardio'){sub=ex.sets.length?`${ex.sets.length} registro${ex.sets.length>1?'s':''} de cardio`:'cardio · toque para registrar';st=ex.sets.length?'✓':'';}
  else if(ex.finished){sub=fmtSetsShort(ex.sets,ex.weightMode);st='✓';}
  else if(done){sub=`agora · série ${Math.min(done+1,plan)} de ${plan}`;st=m==='normal'?`${fw(ex.weight)} kg`:'';}
  else{const lw=lastWork(ex);sub=lw.length?`última: ${fmtSetsShort(ex.last.sets,ex.weightMode)}`:'primeira vez';st=String(plan);}
  const dots=m==='cardio'?'':`<span class="dots">${Array.from({length:plan},(_,i)=>`<i class="${i<done?'f':(i===done&&!ex.finished&&done?'c':'')}"></i>`).join('')}</span>`;
  const canRemove=ex.sets.length===0&&!ex.finished;
  const rm=canRemove?`<button type="button" class="row-rm" aria-label="Remover exercício" onclick="event.stopPropagation();ForjaGymUI.removeExerciseCard(${idx})">✕</button>`:'';
  const firstPending=sessionExercises.findIndex(e=>!e.finished);
  const cls=ex.finished?' done':((done&&!ex.finished)||(!done&&idx===firstPending&&!sessionExercises.some(e=>!e.finished&&workDone(e)))?' started':'');
  return `<div class="ex-row${cls}" id="ex-card-${idx}" role="button" tabindex="0" onclick="ForjaGymUI.openExSheet(${idx})">${thumbHtml(photo,'sm')}<div class="row-info"><div class="row-name">${t.escapeHtml(dn(ex.name))}</div><small>${t.escapeHtml(sub)}</small>${dots}</div>${rm}<span class="row-st">${t.escapeHtml(st)}</span></div>`;
}

// ---------- janela do exercício ----------
async function buildSheetHtml(idx){
  const t=T();const ex=sessionExercises[idx];const m=segMode(ex.weightMode);
  const photo=t.getPhotoSync(ex.name)||(root.ForjaExerciseLibrary&&root.ForjaExerciseLibrary.getWgerImageSync(ex.name));
  const N=root.ForjaExerciseNames;const equip=N&&N.equipFor?N.equipFor(ex.name):'';
  const muscle=t.getMuscleSync(ex.name);
  const lastTxt=ex.last&&lastWork(ex).length?`${diaCurto(ex.last.date)}: ${fmtSetsShort(ex.last.sets,ex.weightMode)}`:'primeira vez';
  const seg=`<div class="tipo-seg" role="tablist" aria-label="Tipo de exercício">${MODE_SEG.map(([k,l])=>`<button type="button" class="${m===k?'on':''}" aria-pressed="${m===k}" onclick="ForjaGymUI.setExerciseMode(${idx},'${k}')">${l}</button>`).join('')}</div>`;
  const head=`<div class="sheet-bar"><span class="sheet-grab"></span></div>
    <div class="fh">${photo?`<button type="button" class="ex-thumb lg" onclick="ForjaGymUI.openExercisePhotoPopup(${idx})" aria-label="Ampliar foto"><img src="${photo}" alt="" draggable="false" onerror="this.parentNode.classList.add('ph');this.remove()"></button>`:`<button type="button" class="ex-thumb lg ph" onclick="ForjaGymUI.pickExercisePhoto(${idx})" aria-label="Adicionar foto"></button>`}
    <div class="fh-tx"><b>${t.escapeHtml(dn(ex.name))}</b><small>${t.escapeHtml([muscle,equip].filter(Boolean).join(' · '))} · ${t.escapeHtml(lastTxt)}</small></div>
    <button type="button" class="sheet-x" aria-label="Fechar" onclick="ForjaGymUI.closeExSheet()">✕</button></div>${seg}`;
  if(m==='cardio')return `<div class="ex-card open sheet v3" id="ex-card-${idx}">${head}${buildCardioBody(idx)}${await buildMorePanel(idx)}</div>`;
  const done=workDone(ex),plan=planCount(ex);
  const sg=!done&&!ex.sgApplied?suggestionFor(ex):null;
  const sgHtml=sg?`<button type="button" class="sug" onclick="ForjaGymUI.applySuggestion(${idx})"><span>${t.escapeHtml(sg.text)} <b>${t.escapeHtml(sg.action)}</b></span><em>Usar</em></button>`:'';
  const lw=lastWork(ex);
  const colV=m==='time'?'Tempo':'Reps';
  const showKg=m==='normal'||(m!=='normal'&&(ex.showExtra||ex.weight>0)&&ex.weightMode!=='bodyweight');
  const cols=showKg?'stab-k':'stab-r';
  let rows=`<div class="hd"><span>#</span><span>Anterior</span>${showKg?`<span>${m==='normal'?'kg':'extra'}</span>`:''}<span>${colV}</span><span></span></div>`;
  let wi=0;
  ex.sets.forEach((st,i)=>{
    const isLast=i===ex.sets.length-1;
    const prev=st.warmup?'':(lw[wi]?fmtSetValue(lw[wi],ex.weightMode):'—');
    const label=st.warmup?'A':String(++wi);
    rows+=`<div class="rw f"><span class="sn${st.warmup?' a':''}">${label}</span><span class="ant">${t.escapeHtml(prev)}</span>${showKg?`<span class="cx">${fw(st.weight)}</span>`:''}<span class="cx">${m==='time'?fmtSecs(st.reps):st.reps}</span><button type="button" class="ck" ${isLast?`aria-label="Desfazer esta série" onclick="ForjaGymUI.undoLastSetForCard(${idx})"`:'tabindex="-1" aria-hidden="true"'}>✓</button></div>`;
  });
  for(let k=done;k<plan;k++){
    const cur=k===done;
    const prev=lw[k]?fmtSetValue(lw[k],ex.weightMode):'—';
    const reps=cur?ex.pendingReps:(ex.targetReps||lw[k]?.reps||ex.pendingReps);
    const label=cur&&ex.warmupMode?'A':String(k+1);
    rows+=`<div class="rw ${cur?'c':'p'}"><span class="sn${cur&&ex.warmupMode?' a':''}">${label}</span><span class="ant">${t.escapeHtml(prev)}</span>${showKg?`<span class="cx">${fw(ex.weight)}</span>`:''}<span class="cx">${m==='time'?fmtSecs(reps):reps}</span>${cur?`<button type="button" class="ck" aria-label="Concluir série" onclick="ForjaGymUI.logSetForCard(${idx})">✓</button>`:'<span class="ck" aria-hidden="true"></span>'}</div>`;
  }
  const allDone=done>=plan;
  let timer='';
  if(m==='time'&&!allDone){
    const running=!!ex.timerStart;const el=running?Math.floor((Date.now()-ex.timerStart)/1000):0;const target=ex.pendingReps||30;
    const pct=Math.min(100,Math.round(el/target*100));
    timer=`<div class="crono"><div class="anel" id="time-ring-${idx}" style="--p:${pct}"><div><b id="time-val-${idx}">${running?fmtSecs(el):fmtSecs(target)}</b><small>${running?`meta ${fmtSecs(target)}`:'meta'}</small></div></div></div>
      <div class="metas">${[20,30,45,60,90].map(v=>`<button type="button" class="${target===v?'on':''}" onclick="ForjaGymUI.setTimeTarget(${idx},${v})">${v} s</button>`).join('')}</div>`;
  }
  let ajuste='';
  if(!allDone){
    if(m==='normal')ajuste=`<div class="ajuste"><button type="button" onclick="ForjaGymUI.adjustCardWeight(${idx},-2.5)">−2,5 kg</button><button type="button" onclick="ForjaGymUI.adjustCardWeight(${idx},2.5)">+2,5 kg</button><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},-1)">−1 rep</button><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},1)">+1 rep</button></div>`;
    else if(m==='time')ajuste=`<div class="ajuste"><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},-10)">−10 s</button><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},-5)">−5 s</button><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},5)">+5 s</button><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},10)">+10 s</button></div>`;
    else ajuste=`<div class="ajuste"><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},-2)">−2</button><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},-1)">−1</button><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},1)">+1</button><button type="button" onclick="ForjaGymUI.adjustPendingReps(${idx},2)">+2</button></div>`;
    if(showKg&&m!=='normal')ajuste+=`<div class="ajuste a2"><button type="button" onclick="ForjaGymUI.adjustCardWeight(${idx},-2.5)">−2,5 kg extra</button><button type="button" onclick="ForjaGymUI.adjustCardWeight(${idx},2.5)">+2,5 kg extra</button></div>`;
  }
  const chips=[`<button type="button" onclick="ForjaGymUI.addPlannedSet(${idx})">+ Série</button>`];
  if(!allDone)chips.push(`<button type="button" class="${ex.warmupMode?'on':''}" onclick="ForjaGymUI.toggleWarmupMode(${idx})">${ex.warmupMode?'✓ ':''}Aquecimento</button>`);
  if(m!=='normal'&&ex.weightMode!=='bodyweight')chips.push(`<button type="button" class="${ex.showExtra||ex.weight>0?'on':''}" onclick="ForjaGymUI.toggleExtraWeight(${idx})">+ Peso extra</button>`);
  chips.push(`<button type="button" onclick="ForjaGymUI.cycleRestPreset()">Descanso ${fmtSecs(restDurationSeconds)}</button>`);
  let cta;
  if(allDone)cta=`<button type="button" class="cta" onclick="ForjaGymUI.finishExercise(${idx})">✓ Finalizar exercício</button>`;
  else if(m==='time')cta=ex.timerStart?`<button type="button" class="cta stop" onclick="ForjaGymUI.stopTimeSet(${idx})">■ Parar e registrar</button>`:`<button type="button" class="cta" onclick="ForjaGymUI.startTimeSet(${idx})">▶ Começar série ${done+1}</button>`;
  else cta=`<button type="button" class="cta" onclick="ForjaGymUI.logSetForCard(${idx})">✓ Concluir série ${done+1}${ex.warmupMode?' (aquecimento)':''}</button>`;
  const fin=!allDone&&done?`<button type="button" class="link-fin" onclick="ForjaGymUI.finishExercise(${idx})">Terminar com ${done} série${done>1?'s':''}</button>`:'';
  return `<div class="ex-card open sheet v3" id="ex-card-${idx}">${head}${sgHtml}${timer}<div class="stab ${cols}">${rows}</div>${ajuste}<div class="mais-chips">${chips.join('')}</div>${await buildMorePanel(idx)}<div class="sheet-cta">${fin}${cta}</div></div>`;
}
function buildCardioBody(idx){
  const ex=sessionExercises[idx];
  const label=s=>{const p=[];if(s.cardioMin)p.push(`${s.cardioMin} min`);if(s.cardioKm)p.push(`${s.cardioKm} km`);if(s.cardioKcal)p.push(`${s.cardioKcal} kcal`);return p.join(' · ')||'registro';};
  const list=ex.sets.length?`<div class="stab stab-r">${ex.sets.map((s,i)=>`<div class="rw f"><span class="sn">${i+1}</span><span class="ant" style="grid-column:span 2">${label(s)}</span><span class="ck">✓</span></div>`).join('')}</div>`:'';
  return `<div class="cardio-input-row">
      <div><label for="cardio-min-${idx}">Minutos</label><input type="number" inputmode="decimal" id="cardio-min-${idx}" placeholder="20"></div>
      <div><label for="cardio-km-${idx}">km</label><input type="number" inputmode="decimal" step="0.1" id="cardio-km-${idx}" placeholder="3"></div>
      <div><label for="cardio-kcal-${idx}">kcal</label><input type="number" inputmode="decimal" id="cardio-kcal-${idx}" placeholder="150"></div>
    </div>${list}
    <div class="sheet-cta">${ex.sets.length?`<button type="button" class="link-fin" onclick="ForjaGymUI.finishExercise(${idx})">Finalizar exercício</button>`:''}<button type="button" class="cta" onclick="ForjaGymUI.logCardioSetForCard(${idx})">✓ Registrar cardio</button></div>`;
}
async function buildMorePanel(idx){
  const t=T();const ex=sessionExercises[idx];
  const open=moreOpenSet.has(idx)||progressionOpenSet.has(idx)||libraryOpenSet.has(idx)||cardTipEditingIdx===idx;
  const btn=`<button type="button" class="more-toggle" aria-expanded="${open}" onclick="ForjaGymUI.toggleMoreOpen(${idx})">${open?'Menos detalhes ▴':'Mais detalhes ▾'}</button>`;
  if(!open)return btn;
  const analysisOpen=progressionOpenSet.has(idx),libraryOpen=libraryOpenSet.has(idx);
  const m=segMode(ex.weightMode);
  const rir=m==='normal'?`<div class="more-row"><span>Quantas ainda dava para fazer?</span><div class="rir3">${['0','1','2','3+'].map(v=>`<button type="button" class="${ex.pendingRir===v?'on':''}" onclick="ForjaGymUI.setCardRir(${idx},'${v}')">${v}</button>`).join('')}</div></div>`:'';
  const fine=m==='normal'?`<div class="more-row"><span>Ajuste fino da carga</span><div class="rir3"><button type="button" onclick="ForjaGymUI.adjustCardWeight(${idx},-5)">−5</button><button type="button" onclick="ForjaGymUI.adjustCardWeight(${idx},-0.1)">−0,1</button><button type="button" onclick="ForjaGymUI.adjustCardWeight(${idx},0.1)">+0,1</button><button type="button" onclick="ForjaGymUI.adjustCardWeight(${idx},5)">+5</button></div></div>`:'';
  return `${btn}<div class="more-panel v3">${rir}${fine}${buildDicaHtml(idx,ex.name)}
    <div class="more-links"><button type="button" onclick="ForjaGymUI.pickExercisePhoto(${idx})">📷 Foto</button><a href="${t.youtubeSearchUrl(dn(ex.name))}" target="_blank" rel="noopener">▶ Vídeo</a><button type="button" onclick="ForjaGymUI.toggleLibraryOpen(${idx})">📚 Execução</button><button type="button" onclick="ForjaGymUI.toggleProgressionAnalysis(${idx})">📊 Progressão</button></div>
    ${libraryOpen?buildLibraryHtml(idx,ex.name):''}
    ${await buildWeightHistoryHtml(ex.name)}
    ${analysisOpen?await buildProgressionAnalysisHtml(idx,ex.name):''}
    ${await buildSparkHtml(ex.name)}</div>`;
}

// ---------- registrar ----------
let sessionRecordList=[];
async function logSetForCard(idx,repsArg){
  const t=T();const ex=sessionExercises[idx];if(!ex)return;tapFeedback();
  const m=segMode(ex.weightMode);
  const reps=Math.round(repsArg!=null?repsArg:(ex.pendingReps||0));if(!(reps>0)){showToast(m==='time'?'Ajuste o tempo antes de registrar.':'Ajuste as repetições antes de registrar.');return;}
  const isWarmup=!!ex.warmupMode,rir=ex.pendingRir||'';
  let prevBest=0;
  if(!isWarmup){
    if(m==='normal')prevBest=await t.bestHistoricalRM(ex.name);
    else{const arr=await t.loadWorkouts();arr.filter(e=>e.name.trim()===ex.name&&e.id!==ex.workoutId).forEach(e=>t.parseRepsList(e.reps).forEach(r=>{if(r>prevBest)prevBest=r;}));ex.sets.filter(x=>!x.warmup).forEach(x=>{if(x.reps>prevBest)prevBest=x.reps;});}
  }
  ex.sets.push({weight:ex.weight,reps,warmup:isWarmup,rir});ex.pendingRir=null;ex.warmupMode=false;ex.timerStart=null;stopTimeTick(ex);
  const k=workDone(ex);
  ex.pendingReps=m==='time'?(ex.targetReps||ex.pendingReps):(ex.targetReps||lastWork(ex)[k]?.reps||reps);
  await persistCardSets(idx);await renderCard(idx);await renderMuscleOverview();await renderTodayList();renderHeroStats();
  const val=fmtSetValue({weight:ex.weight,reps},ex.weightMode);
  const score=m==='normal'?t.epley1RM(ex.weight,reps):reps;
  if(isWarmup)showToast(`Aquecimento registrado: ${val}`,{label:'Desfazer',onClick:()=>undoLastSetForCard(idx)});
  else if(prevBest>0&&score>prevBest){sessionRecords++;sessionRecordList.push(`${dn(ex.name)} · ${val}`);if(root.navigator?.vibrate)root.navigator.vibrate([40,50,40,50,120]);showToast(`🏆 Recorde em ${dn(ex.name)}: ${val}`,{label:'Desfazer',onClick:()=>undoLastSetForCard(idx)});}
  else showToast(`✓ Série ${k} registrada: ${val}`,{label:'Desfazer',onClick:()=>undoLastSetForCard(idx)});
  if(!isWarmup)startRestTimer();
}
async function undoLastSetForCard(idx){
  const ex=sessionExercises[idx];if(!ex||!ex.sets.length)return;tapFeedback();
  const st=ex.sets.pop();ex.pendingReps=st.reps;if(st.warmup)ex.warmupMode=true;
  if(sessionRecordList.length&&sessionRecordList[sessionRecordList.length-1].startsWith(dn(ex.name)+' ·'))sessionRecordList.pop();
  await persistCardSets(idx);await renderCard(idx);await renderTodayList();renderHeroStats();
  showToast('Série desfeita.');
}
async function finishExercise(idx){
  tapFeedback();const ex=sessionExercises[idx];if(!ex||!ex.sets.length)return;ex.finished=true;stopTimeTick(ex);
  await closeExSheet();renderHeroStats();
  const next=sessionExercises.findIndex(e=>!e.finished);
  showToast(next>=0?`✓ ${dn(ex.name)} feito. Próximo: ${dn(sessionExercises[next].name)}`:`✓ ${dn(ex.name)} feito. Era o último: toque em Finalizar.`);
}

// ---------- tempo ----------
function setTimeTarget(idx,v){tapFeedback();const ex=sessionExercises[idx];if(!ex)return;ex.pendingReps=v;ex.targetReps=v;ex.timeTarget=v;renderCard(idx);}
function startTimeSet(idx){
  tapFeedback();const ex=sessionExercises[idx];if(!ex)return;pularRest(true);
  ex.timerStart=Date.now();ex.timerBeeped=false;renderCard(idx);keepAwake(true);
  clearInterval(timeTickInterval);
  timeTickInterval=setInterval(()=>{
    if(!ex.timerStart){clearInterval(timeTickInterval);return;}
    const el=Math.floor((Date.now()-ex.timerStart)/1000);const target=ex.pendingReps||30;
    const v=$(`time-val-${idx}`);if(v)v.textContent=fmtSecs(el);
    const r=$(`time-ring-${idx}`);if(r)r.style.setProperty('--p',Math.min(100,Math.round(el/target*100)));
    if(el>=target&&!ex.timerBeeped){ex.timerBeeped=true;beep(880,.25);if(root.navigator?.vibrate)root.navigator.vibrate([120,60,120]);if(r)r.classList.add('meta');}
  },250);
}
function stopTimeTick(ex){if(ex)ex.timerStart=ex.timerStart&&false;clearInterval(timeTickInterval);timeTickInterval=null;}
async function stopTimeSet(idx){
  const ex=sessionExercises[idx];if(!ex||!ex.timerStart)return;
  const el=Math.max(1,Math.round((Date.now()-ex.timerStart)/1000));ex.timerStart=null;clearInterval(timeTickInterval);
  const keepTarget=ex.pendingReps;await logSetForCard(idx,el);ex.pendingReps=keepTarget;renderCard(idx);
}

// ---------- descanso em tela cheia ----------
const REST_PRESETS=[45,60,90,120,180];
function syncRestLabel(){root.document.querySelectorAll('[data-rest-label]').forEach(e=>e.textContent=fmtSecs(restDurationSeconds));}
function cycleRestPreset(){tapFeedback();const i=REST_PRESETS.indexOf(restDurationSeconds);restDurationSeconds=REST_PRESETS[(i+1)%REST_PRESETS.length]||60;saveRestPref();syncRestLabel();if(sheetIdx!==null)renderCard(sheetIdx);showToast(`Descanso: ${fmtSecs(restDurationSeconds)}`);}
function saveRestPref(){try{T().storage().set('gym-rest-seconds',String(restDurationSeconds));}catch{}}
async function loadRestPref(){try{const r=await T().storage().get('gym-rest-seconds');const v=parseInt(r?.value,10);if(v>=15)restDurationSeconds=v;}catch{}}
function adjustRestDuration(delta){tapFeedback();if(restInterval){restRemaining=Math.max(5,restRemaining+delta);restTotal=Math.max(restTotal,restRemaining);updateRestDisplay();}restDurationSeconds=Math.max(15,restDurationSeconds+delta);saveRestPref();syncRestLabel();}
let restTotal=60;
function nextUpInfo(){
  const t=T();
  const cur=sheetIdx!==null?sessionExercises[sheetIdx]:null;
  const pick=ex=>{const d=workDone(ex),p=planCount(ex);if(d<p&&!ex.finished)return{nm:`${dn(ex.name)} · série ${d+1} de ${p}`,val:fmtSetValue({weight:ex.weight,reps:ex.pendingReps},ex.weightMode)};return null;};
  let info=cur?pick(cur):null;
  if(!info){const nx=sessionExercises.find(e=>!e.finished&&e!==cur);if(nx)info=pick(nx)||{nm:dn(nx.name),val:''};}
  return info?`<small>Próxima</small><b>${t.escapeHtml(info.nm)}</b><span>${t.escapeHtml(info.val)}</span>`:'<small>Próxima</small><b>Último exercício feito</b><span>Toque em Finalizar treino</span>';
}
function openRestModal(){const ov=$('rest-modal-overlay');if(ov){ov.style.display='flex';ov.classList.add('rest-full');}const mini=$('rest-mini');if(mini)mini.hidden=true;}
function closeRestModal(){tapFeedback();const ov=$('rest-modal-overlay');if(ov)ov.style.display='none';const mini=$('rest-mini');if(mini)mini.hidden=!restInterval;}
function toggleRestPop(){openRestModal();}
function startRestTimer(){
  restRemaining=restDurationSeconds;restTotal=restDurationSeconds;restWarned=false;
  const ov=$('rest-modal-overlay');if(!ov)return;
  ov.innerHTML=`<div class="rest-screen" role="timer" aria-live="off">
    <span class="rest-lb">Descanso</span>
    <div class="anel rest-anel" id="rest-ring" style="--p:100"><div><b id="rest-countdown">${fmtSecs(restRemaining)}</b><small>de ${fmtSecs(restTotal)}</small></div></div>
    <div class="prox" id="rest-next">${nextUpInfo()}</div>
    <div class="rest-bts"><button type="button" onclick="ForjaGymUI.adjustRestDuration(-15)">−15s</button><button type="button" onclick="ForjaGymUI.adjustRestDuration(15)">+15s</button><button type="button" class="pl" onclick="ForjaGymUI.pularRest()">Pular</button></div>
    <button type="button" class="rest-min" onclick="ForjaGymUI.closeRestModal()">Minimizar</button>
    <span class="rest-hint">A tela fica acesa · vibra 3 s antes do fim</span></div>`;
  openRestModal();keepAwake(true);
  let mini=$('rest-mini');
  if(!mini){mini=root.document.createElement('div');mini.id='rest-mini';mini.innerHTML=`<button type="button" class="rm-open" onclick="ForjaGymUI.openRestModal()"><span class="rm-rg" id="rest-mini-ring"></span><span><b id="rest-mini-val"></b><small>descanso</small></span></button><button type="button" class="rm-skip" onclick="ForjaGymUI.pularRest()">Pular</button>`;root.document.body.appendChild(mini);}
  mini.hidden=true;
  updateRestDisplay();clearInterval(restInterval);
  restInterval=setInterval(()=>{
    restRemaining--;
    if(restRemaining<=3&&!restWarned){restWarned=true;if(root.navigator?.vibrate)root.navigator.vibrate(300);}
    if(restRemaining<=0){pularRest(true);beep(990,.3);if(root.navigator?.vibrate)root.navigator.vibrate([100,80,100]);showToast('Descanso acabou. Próxima série!');return;}
    updateRestDisplay();
  },1000);
}
function updateRestDisplay(){
  const v=fmtSecs(restRemaining);const el=$('rest-countdown');if(el)el.textContent=v;const mv=$('rest-mini-val');if(mv)mv.textContent=v;
  const pct=restTotal?Math.round(restRemaining/restTotal*100):0;const r=$('rest-ring');if(r)r.style.setProperty('--p',pct);const mr=$('rest-mini-ring');if(mr)mr.style.setProperty('--p',pct);
}
function adiarRest(){adjustRestDuration(15);}
function pularRest(silent){if(!silent)tapFeedback();clearInterval(restInterval);restInterval=null;const ov=$('rest-modal-overlay');if(ov)ov.style.display='none';const mini=$('rest-mini');if(mini)mini.hidden=true;if(!activeSessionStartTs)keepAwake(false);}
let audioCtx=null;
function beep(f,d){try{audioCtx=audioCtx||new (root.AudioContext||root.webkitAudioContext)();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.frequency.value=f||880;o.connect(g);g.connect(audioCtx.destination);g.gain.setValueAtTime(.15,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+(d||.2));o.start();o.stop(audioCtx.currentTime+(d||.2));}catch{}}
async function keepAwake(on){
  try{
    if(on&&!wakeLockRef&&root.navigator?.wakeLock){wakeLockRef=await root.navigator.wakeLock.request('screen');wakeLockRef.addEventListener?.('release',()=>{wakeLockRef=null;});}
    else if(!on&&wakeLockRef){await wakeLockRef.release();wakeLockRef=null;}
  }catch{wakeLockRef=null;}
}
if(root.document)root.document.addEventListener('visibilitychange',()=>{if(root.document.visibilityState==='visible'&&(activeSessionStartTs||restInterval))keepAwake(true);});

// ---------- tela final ----------
async function showSummary(){
  const d=pendingSummary;pendingSummary=null;if(!d)return;
  const t=T();const doc=root.document;
  let ov=doc.getElementById('summary-overlay');if(ov)ov.remove();
  ov=doc.createElement('div');ov.id='summary-overlay';ov.className='rpe-modal-overlay sum-v3';
  const status=await t.computeWeeklyGoal();
  const ng=await nextGroup();
  const dt=new Date();const sub=`${DIAS_CURTOS[dt.getDay()]} · ${status.done}º treino da semana${status.done>=status.target?' · meta batida':''}`;
  const phrase=COMPLETION_PHRASES[Math.floor(Math.random()*COMPLETION_PHRASES.length)];
  ov.innerHTML=`<div class="rpe-sheet sum-sheet v3" role="dialog" aria-label="Treino concluído">
    <div class="sum-check"><svg viewBox="0 0 24 24"><path d="M5 12l5 5 9-10"/></svg></div>
    <h2>${t.escapeHtml(d.group||'Treino')} concluído</h2><div class="sub">${t.escapeHtml(sub)}</div>
    <div class="sum-grid"><div><b data-n="${d.durationMin}">0</b><span>${d.durationMin===1?'minuto':'minutos'}</span></div><div><b data-n="${d.sets}">0</b><span>${d.sets===1?'série':'séries'}</span></div><div><b data-n="${d.volume}">0</b><span>kg levantados</span></div><div><b data-n="${d.kcal}" data-pre="~">0</b><span>kcal estimadas</span></div></div>
    ${d.records.length?`<div class="sum-rec"><span class="md"></span><span><b>${d.records.length} recorde${d.records.length>1?'s':''}</b><small>${d.records.map(r=>t.escapeHtml(r)).join(' · ')}</small></span></div>`:''}
    <div class="esf"><small>Esforço (opcional)</small><div class="seg10">${RPE_LEVELS.map(l=>`<button type="button" data-v="${l.v}" onclick="ForjaGymUI.selectSummaryRpe('${d.sessionId}',${l.v})">${l.v}</button>`).join('')}</div><span class="esf-l" id="sum-rpe-label"></span></div>
    ${ng?`<div class="nx">Próximo: <b>${t.escapeHtml(ng.g.name)}</b></div>`:''}
    <p class="sum-phrase">${t.escapeHtml(phrase)}</p>
    <button class="primary" type="button" onclick="document.getElementById('summary-overlay').remove()">Fechar</button>
    <div class="sum-note">Calorias são uma estimativa (MET × seu peso × tempo).</div></div>`;
  doc.body.appendChild(ov);ov.style.display='flex';
  const reduce=root.matchMedia&&root.matchMedia('(prefers-reduced-motion: reduce)').matches;
  ov.querySelectorAll('[data-n]').forEach(el=>{const fim=+el.dataset.n,pre=el.dataset.pre||'';const fmt=v=>pre+(v>=1000?v.toLocaleString('pt-BR'):v);if(reduce){el.textContent=fmt(fim);return;}const t0=performance.now();(function f(n){const p=Math.min(1,(n-t0)/900);el.textContent=fmt(Math.round(fim*(1-Math.pow(1-p,3))));if(p<1)requestAnimationFrame(f);})(t0);});
}
async function selectSummaryRpe(sessionId,v){
  tapFeedback();const t=T();const sessions=await t.loadSessionsCache();const s=sessions.find(x=>x.id===sessionId);if(s){s.rpe=v;await t.persistSessionsCache();}
  root.document.querySelectorAll('#summary-overlay .seg10 button').forEach(b=>b.classList.toggle('on',+b.dataset.v===v));
  const l=RPE_LEVELS.find(x=>x.v===v);const lb=$('sum-rpe-label');if(lb)lb.textContent=l?l.label:'';
}

// ---------- painel "Hoje" ----------
async function groupLastInfo(g){
  const t=T();const arr=await t.loadWorkouts();const today=t.todayKey();
  const names=new Set(g.exercises);const byDate={};
  arr.forEach(e=>{if(e.date===today||!names.has(e.name.trim()))return;(byDate[e.date]=byDate[e.date]||[]).push(e);});
  const dates=Object.keys(byDate).filter(d=>new Set(byDate[d].map(e=>e.name.trim())).size>=Math.max(1,Math.ceil(g.exercises.length/2))).sort();
  if(!dates.length)return null;
  const d=dates[dates.length-1];let sets=0,vol=0;
  byDate[d].forEach(e=>{const mode=segMode(t.getWeightModeSync(e.name.trim()));entrySets(e).forEach(x=>{if(x.warmup)return;sets++;if(mode==='normal')vol+=(x.weight||0)*(x.reps||0);});});
  return{date:d,sets,vol:Math.round(vol)};
}
async function nextGroup(){
  const t=T();const groups=await t.loadWorkoutGroups();if(!groups.length)return null;
  let explicit=null;try{const r=await t.storage().get(K_LAST_GROUP);explicit=r?.value?JSON.parse(r.value):null;}catch{}
  const infos=await Promise.all(groups.map(groupLastInfo));
  let bestI=-1,bestD='';
  infos.forEach((inf,i)=>{if(inf&&inf.date>bestD){bestD=inf.date;bestI=i;}});
  if(explicit){const ei=groups.findIndex(g=>g.id===explicit.id);if(ei>=0&&explicit.date>=bestD){bestI=ei;bestD=explicit.date;}}
  const i=bestI<0?0:(bestI+1)%groups.length;
  return{g:groups[i],info:infos[i],groups,infos};
}
async function renderHoje(){
  const host=$('ac-hoje');if(!host)return;const t=T();
  await t.loadMuscleCache();await t.loadWeightModeCache();
  const dt=new Date();const dstr=`${['Domingo','Segunda','Terça','Quarta','Quinta','Sexta','Sábado'][dt.getDay()]} · ${dt.getDate()} ${MESES_CURTOS[dt.getMonth()]}`;
  const ng=await nextGroup();
  let html;
  if(!ng){
    html=`<div class="hj"><div class="hj-d">${dstr}</div><div class="hj-t">Monte seu treino</div><div class="hj-s">Crie seus treinos A, B, C ou use um pronto. Depois o app sugere qual é o da vez.</div>
      <button type="button" class="hj-go" onclick="ForjaGymUI.openGroupsCard('ready-workouts-card')">Ver treinos prontos<i>▶</i></button>
      <div class="hj-trocar"><button type="button" onclick="ForjaGymUI.startFreeWorkout()">Treino livre</button><button type="button" onclick="ForjaGymUI.openGroupsCard('workout-groups-card',true)">+ Criar treino</button></div></div>`;
  }else{
    const g=ng.g;const muscles=[...new Set(g.exercises.map(n=>t.getMuscleSync(n)).filter(Boolean))].slice(0,3);
    const sessions=await t.loadSessionsCache();const gs=sessions.filter(s=>s.groupId===g.id&&s.durationMin);
    const dur=gs.length?Math.round(gs.reduce((a,s)=>a+s.durationMin,0)/gs.length):Math.max(20,g.exercises.length*8);
    const inf=ng.info;
    const ult=inf?`<div class="hj-ult"><div><b>${diaCurto(inf.date)}</b><span>última vez</span></div><div><b>${inf.sets}</b><span>séries</span></div><div><b>${inf.vol?inf.vol.toLocaleString('pt-BR'):'—'}</b><span>kg no total</span></div></div>`:`<div class="hj-ult one"><div><b>Primeira vez</b><span>com este treino</span></div></div>`;
    const others=ng.groups.filter(x=>x.id!==g.id);
    html=`<div class="hj"><div class="hj-d">${dstr}</div><div class="hj-t">Hoje: ${t.escapeHtml(g.name)}</div>
      <div class="hj-s">${t.escapeHtml(muscles.join(', ')||'Treino')} · ${g.exercises.length} exercício${g.exercises.length===1?'':'s'} · ~${dur} min</div>${ult}
      <button type="button" class="hj-go" onclick="ForjaGymUI.loadWorkoutGroupToSession('${g.id}')">Começar ${t.escapeHtml(g.name)}<i>▶</i></button>
      <div class="hj-trocar"><span>Trocar:</span>${others.slice(0,4).map(x=>`<button type="button" onclick="ForjaGymUI.loadWorkoutGroupToSession('${x.id}')">${t.escapeHtml(x.name)}</button>`).join('')}<button type="button" onclick="ForjaGymUI.startFreeWorkout()">Livre</button></div></div>`;
  }
  // semana
  const status=await t.computeWeeklyGoal();
  const mon=t.getMonday(new Date());const arr=await t.loadWorkouts();const sessions=await t.loadSessionsCache();
  const trained=new Set([...arr.map(e=>e.date),...sessions.map(s=>s.date)]);
  const today=t.todayKey();
  const days=['S','T','Q','Q','S','S','D'].map((l,i)=>{const d=t.addDays(mon,i);const k=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;return `<i class="${trained.has(k)?'f':''}${k===today?' h':''}" title="${k}">${l}</i>`;}).join('');
  const sub=status.compensating?`${status.baseGoal} da meta + ${status.shortfall} da semana passada`:'treinos na semana';
  html+=`<div class="semana"><div class="dias">${days}</div><div><b>${status.done} de ${status.target}</b><small>${sub}</small></div></div>
    <div class="bento b3"><button type="button" onclick="ForjaGymUI.openGroupsCard('workout-groups-card')"><span class="ic">☰</span><b>Meus treinos</b><small>${ng?ng.groups.map(x=>t.escapeHtml(x.name.replace(/^Treino\s+/i,''))).slice(0,4).join(' · '):'criar'}</small></button>
    <button type="button" onclick="switchTab('biblioteca')"><span class="ic">⌕</span><b>Exercícios</b><small>900+</small></button>
    <button type="button" onclick="ForjaGymUI.openGroupsCard('gym-sessions-chart-card')"><span class="ic">↗</span><b>Evolução</b><small>carga e tempo</small></button></div>`;
  host.innerHTML=html;
}
function openGroupsCard(id,newForm){
  tapFeedback();const el=$(id);if(!el)return;
  if(el.classList.contains('collapsed')&&el.dataset.sectionId&&root.toggleSection)root.toggleSection(el.dataset.sectionId);
  if(newForm)showNewGroupForm();
  el.scrollIntoView({behavior:'smooth',block:'start'});
}

// ---------- números do treino em andamento ----------
async function renderHeroStats(){
  const set=(id,v)=>{const e=$(id);if(e)e.textContent=v;};
  const st=computeSessionStats();
  let done=0,plan=0;sessionExercises.forEach(ex=>{if(segMode(ex.weightMode)==='cardio'){plan+=1;done+=ex.sets.length?1:0;return;}const d=workDone(ex);done+=d;plan+=ex.finished?d:planCount(ex);});
  set('session-live',plan?`${done} de ${plan} séries`:'escolha os exercícios');
  set('tr-vol',st.vol?`${Math.round(st.vol).toLocaleString('pt-BR')} kg`:'');
  const f=$('tr-prog-fill');if(f)f.style.width=(plan?Math.round(done/plan*100):0)+'%';
}
function computeSessionStats(){
  let sets=0,vol=0,cardioKcal=0,exs=0;const names=[];
  (sessionExercises||[]).forEach(ex=>{let any=false;const m=segMode(ex.weightMode);(ex.sets||[]).forEach(x=>{if(m==='cardio'){cardioKcal+=x.cardioKcal||0;any=true;return;}if(x.warmup)return;sets++;any=true;if(m==='normal'||ex.weightMode==='bodyweight')vol+=(x.weight||0)*(x.reps||0);else if(m==='none')vol+=(x.weight||0)*(x.reps||0);});if(any){exs++;names.push(ex.name);}});
  return{sets,vol,cardioKcal,exs,names};
}

// ---------- treino de hoje (histórico do dia) ----------
async function renderTodayList(){
  try{renderHeroStats();}catch{}
  const t=T();const el=$('today-list');if(!el)return;
  await t.loadWeightModeCache();
  const arr=await t.loadWorkouts();const todays=arr.filter(e=>e.date===t.todayKey());
  if(todays.length===0){el.innerHTML='<div class="empty">Nada registrado hoje ainda.</div>';return;}
  el.innerHTML=todays.map(e=>{
    const cmin=t.parseCardioList(e.cardioMin),ckm=t.parseCardioList(e.cardioKm),ckcal=t.parseCardioList(e.cardioKcal);
    const isCardio=cmin.some(v=>v)||ckm.some(v=>v)||ckcal.some(v=>v);
    let txt;
    if(isCardio){const tm=cmin.reduce((s,v)=>s+(v||0),0),tk=ckm.reduce((s,v)=>s+(v||0),0),tc=ckcal.reduce((s,v)=>s+(v||0),0);const p=[];if(tm)p.push(`${tm} min`);if(tk)p.push(`${String(tk).replace('.',',')} km`);if(tc)p.push(`${tc} kcal`);txt=p.join(' · ');}
    else txt=fmtSetsShort(entrySets(e),t.getWeightModeSync(e.name.trim()));
    return `<div class="today-row"><b>${t.escapeHtml(dn(e.name.trim()))}</b><span>${t.escapeHtml(txt)}</span></div>`;
  }).join('');
}

// ================= RPE MODAL =================
const RPE_LEVELS=[{v:1,color:'#2e7d32',label:'Muito leve'},{v:2,color:'#43a047',label:'Muito leve'},{v:3,color:'#7cb342',label:'Leve'},{v:4,color:'#c0ca33',label:'Moderado'},{v:5,color:'#fdd835',label:'Moderado'},{v:6,color:'#fb8c00',label:'Difícil'},{v:7,color:'#f4511e',label:'Difícil'},{v:8,color:'#e53935',label:'Muito difícil'},{v:9,color:'#c62828',label:'Extremo'},{v:10,color:'#8e0000',label:'Máximo esforço'}];
const COMPLETION_PHRASES=['🔥 Treino concluído. Mais um tijolo na parede.','💪 Feito. Seu eu de amanhã agradece.','🏆 Você apareceu e entregou.','⚡ Disciplina bateu a preguiça hoje. De novo.','🎯 Missão cumprida. Descansa que amanhã tem mais.','🔨 Forjado hoje, mais forte amanhã.','✅ Treino no histórico. Consistência é o segredo.','🚀 Mais um passo.','🦾 Você fez o trabalho.','🔥 Suou, treinou, evoluiu.'];
let rpeModalSessionId=null,rpePendingValue=null;
function openRpeModal(sessionId){
  rpeModalSessionId=sessionId;rpePendingValue=null;
  const phraseEl=$('completion-phrase');if(phraseEl)phraseEl.textContent=COMPLETION_PHRASES[Math.floor(Math.random()*COMPLETION_PHRASES.length)];
  const row=$('rpe-scale-row');if(row)row.innerHTML=RPE_LEVELS.map(l=>`<div class="rpe-bar" id="rpe-bar-${l.v}" style="height:${24+l.v*3.4}px" onclick="ForjaGymUI.selectRpe(${l.v})">${l.v}</div>`).join('');
  const lbl=$('rpe-label-row');if(lbl)lbl.textContent='';
  const overlay=$('rpe-modal-overlay');if(overlay)overlay.style.display='flex';
}
function selectRpe(v){
  tapFeedback();rpePendingValue=v;const level=RPE_LEVELS.find(l=>l.v===v);
  RPE_LEVELS.forEach(l=>{const el=$(`rpe-bar-${l.v}`);if(!el)return;el.style.background=l.v===v?level.color:'';el.classList.toggle('selected',l.v===v);});
  const lbl=$('rpe-label-row');if(lbl){lbl.textContent=`${v} — ${level.label}`;lbl.style.color=level.color;}
}
async function saveSessionRpe(){
  if(rpePendingValue===null){showToast('Toca numa barra pra escolher o esforço.');return;}
  tapFeedback();const t=T();const sessions=await t.loadSessionsCache();
  const s=sessions.find(x=>x.id===rpeModalSessionId);if(s)s.rpe=rpePendingValue;
  await t.persistSessionsCache();$('rpe-modal-overlay').style.display='none';showToast('Esforço registrado!');
}
function skipSessionRpe(){tapFeedback();$('rpe-modal-overlay').style.display='none';showSummary();}


function setSessionsMetric(m){sessionsMetric=m;tapFeedback();renderSessionsChart();}
async function renderSessionsChart(){
  const host=$('sessions-chart');if(!host)return;const t=T();
  document.querySelectorAll('#gym-sessions-chart-card .chart-tabs button').forEach(b=>b.classList.toggle('on',b.dataset.m===sessionsMetric));
  const all=(await t.loadSessionsCache()).slice().sort((a,b)=>(a.start||0)-(b.start||0)).slice(-14);
  if(!all.length){host.innerHTML='<div class="empty">Finalize um treino para ver a evolução aqui.</div>';return;}
  let w=null;try{w=await root.getLastWeightValue?.();}catch{}w=Number(w)>20?Number(w):75;
  const val=x=>sessionsMetric==='kcal'?(x.kcal!=null?x.kcal:Math.round(5*w*(x.durationMin||0)/60)):sessionsMetric==='volume'?(x.volume||0):(x.durationMin||0);
  const vals=all.map(val),mx=Math.max(1,...vals);
  const unit=sessionsMetric==='kcal'?'kcal':sessionsMetric==='volume'?'kg':'min';
  host.innerHTML=all.map((x,i)=>{const h=Math.max(6,Math.round(vals[i]/mx*110));const d=(x.date||'').slice(8,10)+'/'+(x.date||'').slice(5,7);return `<div class="hbar"><span class="hv">${vals[i]>=10000?(vals[i]/1000).toFixed(1)+'k':vals[i]}</span><i style="height:${h}px"></i><span class="hd">${d}</span></div>`;}).join('');
  host.insertAdjacentHTML('beforeend',`<div class="hunit">${unit}</div>`);
  host.scrollLeft=host.scrollWidth;
}
// ================= PLATE CALCULATOR =================
let plateTarget=60,plateBarWeight=20;
function adjustPlateTarget(delta){tapFeedback();plateTarget=Math.max(plateBarWeight,Math.round((plateTarget+delta)*10)/10);renderPlateCalc();}
function selectBarWeight(w){tapFeedback();plateBarWeight=w;renderPlateCalc();}
function renderPlateCalc(){
  const t=T();const disp=$('plate-target-display');if(!disp)return;
  disp.textContent=t.fmtWeight(plateTarget)+'kg';
  const barRow=$('bar-weight-row');
  if(barRow)barRow.innerHTML=[10,15,20].map(w=>`<button class="${plateBarWeight===w?'active':''}" onclick="ForjaGymUI.selectBarWeight(${w})">Barra ${w}kg</button>`).join('');
  const plates=t.computePlatesPerSide(plateTarget,plateBarWeight);
  const resultEl=$('plate-calc-result');if(!resultEl)return;
  if(plateTarget<plateBarWeight){resultEl.innerHTML=`<div class="empty">O peso desejado é menor que a barra vazia.</div>`;return;}
  if(plates.length===0){resultEl.innerHTML=`<div class="plate-list">Só a barra (${t.fmtWeight(plateBarWeight)}kg), sem anilhas.</div>`;return;}
  const blockArr=plates.flatMap(p=>Array(p.count).fill(p)).sort((a,b)=>b.kg-a.kg)
    .map(p=>`<div class="plate-block" style="background:${p.color}; height:${20+p.kg*1.6}px; color:${p.kg<=5?'#111':'#fff'}">${t.fmtWeight(p.kg)}</div>`);
  resultEl.innerHTML=`<div class="plate-visual"><div class="plate-side">${blockArr.join('')}</div><div class="plate-bar-center"></div><div class="plate-side">${[...blockArr].reverse().join('')}</div></div><div class="plate-list">Por lado: ${plates.map(p=>`<b>${p.count}×</b> ${t.fmtWeight(p.kg)}kg`).join(' + ')}</div>`;
}

// ================= WEEKLY GOAL =================
async function renderWeeklyGoal(){
  const t=T();const cache=await t.loadGoalCache();
  const disp=$('weekly-goal-display');if(disp)disp.textContent=cache.weeklyTarget;
  const status=await t.computeWeeklyGoal();
  const lineTxt=`${status.done} / ${status.target} treinos esta semana`;
  const line=$('goal-progress-line');if(line)line.textContent=lineTxt;
  const line2=$('gym-goal-progress-line');if(line2)line2.textContent=lineTxt;
  const noteTxt=status.compensating?`+${status.shortfall} pra compensar a semana passada (meta base: ${status.baseGoal})`:'';
  const note=$('goal-compensation-note');if(note)note.textContent=noteTxt;
  const note2=$('gym-goal-compensation-note');if(note2)note2.textContent=noteTxt;
  const ringNum=$('goal-ring-num');if(ringNum)ringNum.textContent=status.done;
  const ring=$('goal-ring');
  if(ring){
    const pct=status.target>0?Math.min(1,status.done/status.target):0;
    const deg=Math.round(pct*360);
    const color=pct>=1?'#0a8f6f':'#ff6a3d';
    ring.style.background=deg>=360?`conic-gradient(${color} 360deg)`:`conic-gradient(${color} ${deg}deg, var(--panel-2,#222) ${deg}deg)`;
  }
}
async function adjustWeeklyGoal(delta){tapFeedback();const t=T();const cache=await t.loadGoalCache();cache.weeklyTarget=Math.max(1,Math.min(7,cache.weeklyTarget+delta));await t.persistGoalCache();await renderWeeklyGoal();}

// ================= TODAY LIST (history strip for today) =================

async function estimateKcal(sets,durMin,cardioKcal){
  let w=null;try{w=await root.getLastWeightValue?.();}catch{}
  w=Number(w)>20?Number(w):75;
  const spm=durMin>0?sets/durMin:0;
  const met=spm>=0.45?6:spm>=0.28?5:3.5; // musculação: leve 3,5 · moderada 5 · intensa 6
  return sets?Math.round(met*w*durMin/60+(cardioKcal||0)):Math.round(cardioKcal||0);
}


// ================= WATCH OCR (Zepp) — restored into the Importar tab =================
let watchOcrResult=null,watchBalanceResult=null;
async function populateWatchSessionSelect(){
  const t=T();const sel=$('watch-ocr-session-select');if(!sel)return;
  const arr=await t.loadWorkouts();const byDate={};
  arr.forEach(e=>{(byDate[e.date]=byDate[e.date]||[]).push(e.name);});
  const dates=Object.keys(byDate).sort((a,b)=>b.localeCompare(a)).slice(0,14);
  if(dates.length===0){sel.innerHTML=`<option value="${t.todayKey()}">${t.fmtDate(t.todayKey())} (hoje, sem exercícios ainda)</option>`;return;}
  sel.innerHTML=dates.map(d=>{const names=[...new Set(byDate[d])].slice(0,3).join(', ');const isToday=d===t.todayKey();return `<option value="${d}">${t.fmtDate(d)}${isToday?' (hoje)':''} — ${t.escapeHtml(names)}</option>`;}).join('');
}
async function preprocessImageForOcr(dataUrl){
  return new Promise((resolve)=>{
    const img=new Image();
    img.onload=()=>{
      try{
        const scale=img.width<900?900/img.width:1;
        const canvas=root.document.createElement('canvas');canvas.width=Math.round(img.width*scale);canvas.height=Math.round(img.height*scale);
        const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0,canvas.width,canvas.height);
        const imgData=ctx.getImageData(0,0,canvas.width,canvas.height),d=imgData.data;
        for(let i=0;i<d.length;i+=4){const gray=0.299*d[i]+0.587*d[i+1]+0.114*d[i+2];const c=Math.min(255,Math.max(0,(gray-128)*1.5+128));d[i]=d[i+1]=d[i+2]=c;}
        ctx.putImageData(imgData,0,0);resolve(canvas.toDataURL('image/png'));
      }catch{resolve(dataUrl);}
    };
    img.onerror=()=>resolve(dataUrl);img.src=dataUrl;
  });
}
async function handleWatchOcrFile(e){
  const t=T();const file=e.target.files[0];if(!file)return;
  const statusEl=$('watch-ocr-status');$('watch-ocr-review').innerHTML='';statusEl.innerHTML='🔍 Lendo a imagem...';
  try{
    if(typeof Tesseract==='undefined')throw new Error('Tesseract não carregou');
    const rawDataUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});
    const dataUrl=await preprocessImageForOcr(rawDataUrl);
    const result=await Tesseract.recognize(dataUrl,'por');
    const rawText=result.data.text||'';
    const balanceDays=t.parseZeppTrainingBalance(rawText);
    const activityDays=balanceDays?null:t.parseZeppActivityList(rawText);
    const multiDayResult=balanceDays||activityDays;
    if(multiDayResult&&multiDayResult.length){
      watchBalanceResult=multiDayResult;watchOcrResult=null;
      const totalActivities=multiDayResult.reduce((s,d)=>s+d.activities.length,0);
      statusEl.innerHTML=`Achei ${totalActivities} atividade(s) em ${multiDayResult.length} dia(s). Confira/ajuste e desmarque o que não quiser importar:`;
      await renderWatchBalanceReview(multiDayResult);
    }else{
      const parsed=t.parseZeppScreen(rawText);watchOcrResult=parsed;watchBalanceResult=null;
      const detected=t.parseZeppDate(parsed.dateRaw);const sel=$('watch-ocr-session-select');
      if(detected&&sel){const match=[...sel.options].find(o=>o.value===detected);if(match)sel.value=detected;}
      statusEl.innerHTML='Confira os valores abaixo e ajuste o que precisar antes de salvar:';
      renderWatchOcrReview(parsed);
    }
  }catch(err){statusEl.innerHTML='Não consegui processar essa imagem automaticamente.';}
  e.target.value='';
}
function renderWatchOcrReview(p){
  const t=T();const el=$('watch-ocr-review');
  const zonesHtml=p.zones.length?p.zones.map(z=>`<div class="watch-hist-row"><span>${z.label}</span><span>${z.pct!==null?z.pct+'%':'–'} ${z.time?'· '+z.time:''}</span></div>`).join(''):'<div class="empty">Zonas não identificadas.</div>';
  el.innerHTML=`<label>Tipo de atividade <span style="font-weight:400;color:var(--muted);">(seu relógio não tem perfil de musculação — se esse treino foi na verdade academia, troque aqui)</span></label>
  <select id="ocr-category" style="margin-bottom:12px;">
    <option value="cardio">Cardio (corrida, bike, natação...)</option>
    <option value="academia">Academia (musculação/força)</option>
  </select>
  <div class="goal-grid" style="grid-template-columns:repeat(2,1fr); margin-bottom:12px;">
    <div class="goal-cell"><div class="glbl">Duração</div><div class="gval" contenteditable="true" id="ocr-duration">${p.durationStr||'–'}</div></div>
    <div class="goal-cell"><div class="glbl">FC média</div><div class="gval" contenteditable="true" id="ocr-hravg">${p.hrAvg||'–'}</div></div>
    <div class="goal-cell"><div class="glbl">FC máxima</div><div class="gval" contenteditable="true" id="ocr-hrmax">${p.hrMax||'–'}</div></div>
    <div class="goal-cell"><div class="glbl">Calorias</div><div class="gval" contenteditable="true" id="ocr-kcal">${p.kcal||'–'}</div></div>
    <div class="goal-cell"><div class="glbl">Efeito</div><div class="gval" contenteditable="true" id="ocr-effect">${p.effectCategory||p.effectValue||'–'}</div></div>
    <div class="goal-cell"><div class="glbl">RPE (relógio)</div><div class="gval" contenteditable="true" id="ocr-rpe">${p.rpe||'–'}</div></div>
  </div><label>Zonas de frequência cardíaca</label><div style="margin-bottom:12px;">${zonesHtml}</div>
  <button class="primary" onclick="ForjaGymUI.saveWatchOcrEntry()">✓ Salvar registro do relógio</button>`;
}
async function saveWatchOcrEntry(){
  if(!watchOcrResult)return;tapFeedback();const t=T();
  const date=$('watch-ocr-session-select')?.value||t.todayKey();
  const durationStr=$('ocr-duration').textContent.trim();
  const hrAvg=parseInt($('ocr-hravg').textContent,10),hrMax=parseInt($('ocr-hrmax').textContent,10);
  const kcal=parseInt($('ocr-kcal').textContent,10),effect=$('ocr-effect').textContent.trim(),rpe=parseInt($('ocr-rpe').textContent,10);
  const watchCategory=$('ocr-category')?.value==='academia'?'academia':'cardio';
  const entry={id:t.cid(),date,time:t.nowTime(),durationMin:durationStr&&durationStr!=='–'?Math.round(t.parseDurationToMinutes(durationStr)):null,
    hrAvg:isNaN(hrAvg)?null:hrAvg,hrMax:isNaN(hrMax)?null:hrMax,kcal:isNaN(kcal)?null:kcal,effect:effect==='–'?null:effect,rpe:isNaN(rpe)?null:rpe,zones:watchOcrResult.zones||[],watchCategory};
  const watch=await t.loadWatchCache();watch.push(entry);await t.persistWatchCache();
  if(entry.rpe){const sessions=await t.loadSessionsCache();const s=sessions.find(x=>x.date===date&&!x.rpe);if(s){s.rpe=entry.rpe;await t.persistSessionsCache();}}
  watchOcrResult=null;$('watch-ocr-review').innerHTML='';$('watch-ocr-status').innerHTML='✅ Registro salvo!';
  showToast('Dados do relógio salvos.');await renderWatchOcrHistory();
}
async function renderWatchBalanceReview(days){
  const t=T();const el=$('watch-ocr-review');if(!days||days.length===0){el.innerHTML='';return;}
  const watch=await t.loadWatchCache();const today=t.todayKey();
  el.innerHTML=days.map((day,di)=>{
    const isToday=day.date===today;
    return `<div class="balance-day-card"><label>${t.fmtDate(day.date)}${isToday?' <span style="color:var(--blue);">(hoje)</span>':''}${day.cargaTotal!==null?` · Carga total ${day.cargaTotal}`:''}${day.resistencia!==null?` · Resistência ${day.resistencia}`:''}${day.forca!==null?` · Força ${day.forca}`:''}</label>
      ${day.activities.map((a,ai)=>{
        const dup=watch.some(w=>w.date===day.date&&w.activityType===a.type&&w.durationMin===Math.round(t.parseDurationToMinutes(a.duration)||0));
        const defChecked=isToday&&!dup;
        const looksLikeCycling=/CICLISMO/i.test(a.type||'');
        return `<div class="balance-activity"><div class="balance-activity-head"><label class="balance-check"><input type="checkbox" id="bal-inc-${di}-${ai}" ${defChecked?'checked':''}> ${t.escapeHtml(a.type)}</label>
          ${!isToday?`<div class="ex-card-last" style="margin-top:2px;">Dia anterior — desmarcado por padrão pra não duplicar.</div>`:''}
          ${dup?`<div class="ex-card-last" style="margin-top:2px; color:var(--gold);">⚠️ Já existe um registro parecido nesse dia.</div>`:''}</div>
          <label style="margin-top:4px;">Tipo${looksLikeCycling?' <span style="font-weight:400;color:var(--muted);">(foi musculação e o relógio marcou como ciclismo? troque aqui)</span>':''}</label>
          <select id="bal-cat-${di}-${ai}" style="margin-bottom:6px;">
            <option value="cardio">Cardio (${t.escapeHtml(a.type)})</option>
            <option value="academia">Academia (musculação/força)</option>
          </select>
          <div class="goal-grid" style="grid-template-columns:repeat(3,1fr);">
            <div class="goal-cell"><div class="glbl">Duração</div><div class="gval" contenteditable="true" id="bal-dur-${di}-${ai}">${a.duration||'–'}</div></div>
            <div class="goal-cell"><div class="glbl">RPE</div><div class="gval" contenteditable="true" id="bal-rpe-${di}-${ai}">${a.rpe||'–'}</div></div>
            ${a.kind==='indoor'?`<div class="goal-cell"><div class="glbl">FC média</div><div class="gval" contenteditable="true" id="bal-hr-${di}-${ai}">${a.hr||'–'}</div></div>`:`<div class="goal-cell"><div class="glbl">Distância</div><div class="gval" contenteditable="true" id="bal-dist-${di}-${ai}">${a.distanceKm||'–'}</div></div>`}
          </div></div>`;
      }).join('')}</div>`;
  }).join('')+`<button class="primary" onclick="ForjaGymUI.saveWatchBalanceEntries()" style="margin-top:6px;">Salvar selecionados</button>`;
}
async function saveWatchBalanceEntries(){
  if(!watchBalanceResult)return;tapFeedback();const t=T();
  const watch=await t.loadWatchCache();let count=0;
  watchBalanceResult.forEach((day,di)=>{
    day.activities.forEach((a,ai)=>{
      const inc=$(`bal-inc-${di}-${ai}`);if(!inc||!inc.checked)return;
      const duration=$(`bal-dur-${di}-${ai}`).textContent.trim();
      const rpe=parseInt($(`bal-rpe-${di}-${ai}`).textContent,10);
      const hrEl=$(`bal-hr-${di}-${ai}`),distEl=$(`bal-dist-${di}-${ai}`);
      const watchCategory=$(`bal-cat-${di}-${ai}`)?.value==='academia'?'academia':'cardio';
      watch.push({id:t.cid(),date:day.date,time:t.nowTime(),activityType:a.type,watchCategory,
        durationMin:duration&&duration!=='–'?Math.round(t.parseDurationToMinutes(duration)):null,
        hrAvg:hrEl?(isNaN(parseInt(hrEl.textContent,10))?null:parseInt(hrEl.textContent,10)):null,
        distanceKm:distEl?(isNaN(parseFloat(distEl.textContent))?null:parseFloat(distEl.textContent)):null,
        kcal:a.kcal||null,rpe:isNaN(rpe)?null:rpe});
      count++;
    });
  });
  await t.persistWatchCache();watchBalanceResult=null;$('watch-ocr-review').innerHTML='';
  $('watch-ocr-status').innerHTML=`✅ ${count} registro(s) salvos!`;
  showToast(`${count} treino(s) importados do relógio.`);await renderWatchOcrHistory();
}
let watchEditingId=null;
function toggleWatchEdit(id){tapFeedback();watchEditingId=(watchEditingId===id)?null:id;renderWatchOcrHistory();}
async function saveWatchEdit(id){
  tapFeedback();const t=T();const watch=await t.loadWatchCache();const e=watch.find(x=>x.id===id);if(!e)return;
  const dur=parseInt($(`watch-edit-dur-${id}`).textContent,10),kcal=parseInt($(`watch-edit-kcal-${id}`).textContent,10);
  const hr=parseInt($(`watch-edit-hr-${id}`).textContent,10),rpe=parseInt($(`watch-edit-rpe-${id}`).textContent,10);
  if(!isNaN(dur))e.durationMin=dur;if(!isNaN(kcal))e.kcal=kcal;if(!isNaN(hr))e.hrAvg=hr;if(!isNaN(rpe))e.rpe=rpe;
  const catEl=$(`watch-edit-cat-${id}`);if(catEl)e.watchCategory=catEl.value==='academia'?'academia':'cardio';
  await t.persistWatchCache();watchEditingId=null;showToast('Registro atualizado!');await renderWatchOcrHistory();
}
async function deleteWatchEntry(id){const t=T();const watch=await t.loadWatchCache();const next=watch.filter(e=>e.id!==id);await t.persistWatchCache.call(null);await t.storage().set(t.K_WATCH,JSON.stringify(next));t.invalidateAll();await renderWatchOcrHistory();}
async function renderWatchOcrHistory(){
  const t=T();const el=$('watch-ocr-history');if(!el)return;
  const watch=await t.loadWatchCache();if(watch.length===0){el.innerHTML='';return;}
  const recent=[...watch].sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)).slice(0,10);
  el.innerHTML='<label>Últimos registros do relógio</label>'+recent.map(e=>{
    if(watchEditingId===e.id)return `<div class="balance-activity"><div class="ex-card-last" style="margin-bottom:8px;">${t.fmtDate(e.date)} · ${t.escapeHtml(e.activityType||'')}</div>
      <label>Tipo</label>
      <select id="watch-edit-cat-${e.id}" style="margin-bottom:8px;">
        <option value="cardio" ${e.watchCategory!=='academia'?'selected':''}>Cardio</option>
        <option value="academia" ${e.watchCategory==='academia'?'selected':''}>Academia (musculação/força)</option>
      </select>
      <div class="goal-grid" style="grid-template-columns:repeat(2,1fr);">
        <div class="goal-cell"><div class="glbl">Duração (min)</div><div class="gval" contenteditable="true" id="watch-edit-dur-${e.id}">${e.durationMin??'–'}</div></div>
        <div class="goal-cell"><div class="glbl">Calorias</div><div class="gval" contenteditable="true" id="watch-edit-kcal-${e.id}">${e.kcal??'–'}</div></div>
        <div class="goal-cell"><div class="glbl">FC média</div><div class="gval" contenteditable="true" id="watch-edit-hr-${e.id}">${e.hrAvg??'–'}</div></div>
        <div class="goal-cell"><div class="glbl">RPE</div><div class="gval" contenteditable="true" id="watch-edit-rpe-${e.id}">${e.rpe??'–'}</div></div>
      </div><button class="primary secondary-btn" onclick="ForjaGymUI.saveWatchEdit('${e.id}')" style="margin-top:8px;">✓ Salvar</button>
      <button class="rpe-skip-btn" onclick="ForjaGymUI.toggleWatchEdit('${e.id}')">Cancelar</button></div>`;
    const parts=[];if(e.activityType)parts.push(e.activityType);if(e.durationMin)parts.push(`${e.durationMin}min`);if(e.hrAvg)parts.push(`${e.hrAvg}bpm`);if(e.kcal)parts.push(`${e.kcal}kcal`);if(e.distanceKm)parts.push(`${e.distanceKm}km`);if(e.rpe)parts.push(`RPE ${e.rpe}`);
    const catTag=e.watchCategory==='academia'?' · 🏋️ Academia':'';
    return `<div class="watch-hist-row"><span>${t.fmtDate(e.date)} · ${parts.join(' · ')}${catTag}</span><button class="del" onclick="ForjaGymUI.toggleWatchEdit('${e.id}')" style="margin-right:6px;">✏️</button><button class="del" onclick="ForjaGymUI.deleteWatchEntry('${e.id}')">✕</button></div>`;
  }).join('');
}

// ================= SCALE (OKOK) OCR — restored into the Importar tab =================
let scaleOcrResult=null;
const SCALE_FIELD_DEFS=[{key:'weightKg',label:'Peso',unit:'kg'},{key:'bmi',label:'IMC',unit:''},{key:'bodyFatPct',label:'Gordura',unit:'%'},{key:'fatMassKg',label:'Peso da gordura',unit:'kg'},{key:'skeletalMusclePct',label:'Massa musc. esquelética',unit:'%'},{key:'skeletalMuscleKg',label:'Massa musc. esquelética',unit:'kg'},{key:'muscleMassKg',label:'Peso da massa muscular',unit:'kg'},{key:'waterPct',label:'Água',unit:'%'},{key:'waterKg',label:'Peso da água',unit:'kg'},{key:'visceralFat',label:'Gordura visceral',unit:''},{key:'boneKg',label:'Ossos',unit:'kg'},{key:'bmr',label:'Metabolismo (TMB da balança)',unit:'kcal'},{key:'proteinPct',label:'Proteína',unit:'%'},{key:'obesityPct',label:'Obesidade',unit:'%'},{key:'metabolicAge',label:'Idade metabólica',unit:'anos'},{key:'lbmKg',label:'LBM',unit:'kg'}];
async function handleScaleOcrFile(e){
  const t=T();const file=e.target.files[0];if(!file)return;
  const statusEl=$('scale-import-status');$('scale-import-review').innerHTML='';statusEl.innerHTML='🔍 Lendo a imagem...';
  try{
    if(typeof Tesseract==='undefined')throw new Error('Tesseract não carregou');
    const rawDataUrl=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(file);});
    const dataUrl=await preprocessImageForOcr(rawDataUrl);
    const result=await Tesseract.recognize(dataUrl,'por');
    const parsed=t.parseOkokScale(result.data.text||'');
    if(!parsed){statusEl.innerHTML='Não consegui reconhecer essa tela.';return;}
    scaleOcrResult=parsed;statusEl.innerHTML='Confira os valores antes de salvar:';renderScaleOcrReview(parsed);
  }catch{statusEl.innerHTML='Não consegui processar essa imagem.';}
  e.target.value='';
}
function renderScaleOcrReview(data){
  const el=$('scale-import-review');
  el.innerHTML=`<label>Data da medição</label><input type="date" id="scale-ocr-date" value="${data.date}" style="width:100%; background:var(--panel-2); border:1px solid var(--line); color:var(--text); border-radius:10px; padding:10px 12px; margin-bottom:12px;">
    <div class="goal-grid" style="grid-template-columns:repeat(2,1fr);">${SCALE_FIELD_DEFS.map(f=>`<div class="goal-cell"><div class="glbl">${f.label}</div><div class="gval" contenteditable="true" id="scale-ocr-${f.key}">${data[f.key]??'–'}</div></div>`).join('')}</div>
    <button class="primary" onclick="ForjaGymUI.saveScaleOcrEntry()" style="margin-top:12px;">✓ Salvar leitura</button>`;
}
async function saveScaleOcrEntry(){
  tapFeedback();const t=T();const date=$('scale-ocr-date').value||t.todayKey();
  const entry={id:t.cid(),date,time:t.nowTime()};
  SCALE_FIELD_DEFS.forEach(f=>{const el=$(`scale-ocr-${f.key}`);const v=el?parseFloat(el.textContent.replace(',','.')):NaN;entry[f.key]=isNaN(v)?null:v;});
  const scale=await t.loadScaleCache();scale.push(entry);await t.persistScaleCache();
  scaleOcrResult=null;$('scale-import-review').innerHTML='';$('scale-import-status').innerHTML='✅ Leitura salva!';
  showToast('Dados da balança salvos.');await renderScaleOcrHistory();
}
async function deleteScaleEntry(id){const t=T();const scale=await t.loadScaleCache();const next=scale.filter(e=>e.id!==id);await t.storage().set(t.K_SCALE,JSON.stringify(next));t.invalidateAll();await renderScaleOcrHistory();}
async function renderScaleOcrHistory(){
  const t=T();const el=$('scale-import-history');if(!el)return;
  const scale=await t.loadScaleCache();if(scale.length===0){el.innerHTML='';return;}
  const recent=[...scale].sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)).slice(0,10);
  el.innerHTML='<label>Últimas leituras da balança</label>'+recent.map(e=>`<div class="watch-hist-row"><span>${t.fmtDate(e.date)} · ${e.weightKg?e.weightKg+'kg':''} ${e.bodyFatPct?'· '+e.bodyFatPct+'% gordura':''} ${e.visceralFat?'· visceral '+e.visceralFat:''}</span><button class="del" onclick="ForjaGymUI.deleteScaleEntry('${e.id}')">✕</button></div>`).join('');
}

// ================= CALENDAR =================
// Mapa muscular: começa recolhido (só uma linha) e lembra a escolha.
function applyBodyCardState(){
  const card=$('muscle-overview-card');if(!card)return;
  let collapsed=true;
  try{const v=root.localStorage.getItem('ui-body-card-open');if(v==='1')collapsed=false;}catch{}
  card.classList.toggle('body-collapsed',collapsed);
  const arrow=$('body-toggle-arrow');if(arrow)arrow.textContent=collapsed?'▸ Ver':'▾ Ocultar';
}
function toggleBodyCard(){
  tapFeedback();const card=$('muscle-overview-card');if(!card)return;
  const nowCollapsed=!card.classList.contains('body-collapsed');
  try{root.localStorage.setItem('ui-body-card-open',nowCollapsed?'0':'1');}catch{}
  applyBodyCardState();
}
root.toggleBodyView=function(view){
  tapFeedback();
  const front=$('body-fig-front'),back=$('body-fig-back'),fb=$('view-front-btn'),bb=$('view-back-btn');
  if(!front||!back)return;
  front.style.display=view==='front'?'block':'none';
  back.style.display=view==='back'?'block':'none';
  if(fb)fb.classList.toggle('active',view==='front');
  if(bb)bb.classList.toggle('active',view==='back');
};
let calDate=new Date();
function calShiftMonth(delta){tapFeedback();calDate.setMonth(calDate.getMonth()+delta);renderCalendar();}
async function renderCalendar(){
  const t=T();const grid=$('cal-grid');if(!grid)return;
  const {strengthDays,cardioDays,photoDays,waterGoalDays,deficitDays}=await t.computeCalendarData();
  const year=calDate.getFullYear(),month=calDate.getMonth();
  const monthNames=['JAN','FEV','MAR','ABR','MAI','JUN','JUL','AGO','SET','OUT','NOV','DEZ'];
  const label=$('cal-label');if(label)label.textContent=monthNames[month]+' '+year;
  const firstDay=new Date(year,month,1).getDay(),daysInMonth=new Date(year,month+1,0).getDate();
  const dows=['D','S','T','Q','Q','S','S'];
  const todayKey=t.todayKey();
  let html=dows.map(d=>`<div class="cal-dow">${d}</div>`).join('');
  for(let i=0;i<firstDay;i++)html+=`<div class="cal-day empty-cell"></div>`;
  for(let d=1;d<=daysInMonth;d++){
    const key=`${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const strength=strengthDays.has(key),hasCardio=cardioDays.has(key);
    const anyGoalMet=photoDays.has(key)||waterGoalDays.has(key)||deficitDays.has(key);
    const icons=[];
    if(photoDays.has(key))icons.push('📷');
    if(waterGoalDays.has(key))icons.push('💧');
    if(deficitDays.has(key))icons.push('📉');
    const dots=[];
    if(strength)dots.push('<span class="cal-dot cal-dot-academia"></span>');
    if(hasCardio)dots.push('<span class="cal-dot cal-dot-cardio"></span>');
    const isToday=key===todayKey;
    html+=`<div class="cal-day${isToday?' is-today':''}">`+
      `<span class="cal-day-num">${d}</span>`+
      `${dots.length?`<span class="cal-day-dots">${dots.join('')}</span>`:''}`+
      `${icons.length?`<span class="cal-photo-dot${anyGoalMet?' cal-dot-big':''}">${icons.join('')}</span>`:''}`+
      `</div>`;
  }
  grid.innerHTML=html;
  const streakEl=$('academia-streak');if(streakEl)streakEl.textContent=await t.computeStreak();
}

// ================= PR LIST + VOLUME/DURATION STATS =================
async function renderPrList(){
  const t=T();const el=$('pr-list');if(!el)return;
  const arr=await t.loadWorkouts();const byName={};
  arr.forEach(e=>{const best=t.bestPairForEntry(e);const rm=t.epley1RM(best.w,best.r);if(!byName[e.name]||rm>byName[e.name].rm)byName[e.name]={...best,rm,date:e.date};});
  const names=Object.keys(byName).filter(n=>byName[n].rm>0).sort((a,b)=>byName[b].rm-byName[a].rm);
  el.innerHTML=names.length?names.map(n=>`<div class="watch-hist-row"><span>${t.escapeHtml(n)}</span><span><b>${Math.round(byName[n].rm)}kg</b> 1RM (${t.fmtWeight(byName[n].w)}kg×${byName[n].r})</span></div>`).join(''):'<div class="empty">Sem recordes ainda.</div>';
}
async function renderVolumeChart(){
  const t=T();if(!$('volume-chart'))return;
  const arr=await t.loadWorkouts();const weekMap={};
  arr.forEach(e=>{
    const vol=t.volumeLoadForEntry(e);if(vol<=0)return;
    const monday=t.getMonday(new Date(e.date+'T00:00:00'));const key=t.todayKey(monday);
    weekMap[key]=(weekMap[key]||0)+vol;
  });
  const weeks=Object.keys(weekMap).sort().slice(-8);
  const data=weeks.map(k=>({label:t.fmtDate(k).slice(0,5),value:Math.round(weekMap[k])}));
  if(root.svgLineChart)root.svgLineChart('volume-chart',data,{title:'Volume semanal (kg)'});
}
async function renderDurationStats(){
  const t=T();const statsEl=$('duration-stats');if(!statsEl)return;
  const sessions=await t.loadSessionsCache();
  if(sessions.length===0){statsEl.innerHTML='<div class="empty">Nenhum treino com início/fim registrado ainda.</div>';return;}
  const avg=Math.round(sessions.reduce((s,x)=>s+x.durationMin,0)/sessions.length);
  const thisMonday=t.getMonday(new Date()),thisMondayKey=t.todayKey(thisMonday),thisSundayKey=t.todayKey(t.addDays(thisMonday,6));
  const weekSessions=sessions.filter(s=>s.date>=thisMondayKey&&s.date<=thisSundayKey);
  const weekTotal=weekSessions.reduce((s,x)=>s+x.durationMin,0);
  const withRpe=sessions.filter(s=>s.rpe);const avgRpe=withRpe.length?(withRpe.reduce((s,x)=>s+x.rpe,0)/withRpe.length).toFixed(1):'–';
  statsEl.innerHTML=`<div class="dash-stat"><div class="dash-stat-num">${avg}min</div><div class="dash-stat-lbl">⏱ duração média</div></div>
    <div class="dash-stat"><div class="dash-stat-num">${weekSessions.length}</div><div class="dash-stat-lbl">🏋️ treinos esta semana</div></div>
    <div class="dash-stat"><div class="dash-stat-num">${weekTotal}min</div><div class="dash-stat-lbl">⏳ tempo esta semana</div></div>
    <div class="dash-stat"><div class="dash-stat-num">${avgRpe}</div><div class="dash-stat-lbl">🔥 esforço médio (RPE)</div></div>`;
  if(root.svgLineChart){
    const last8=sessions.slice(-8);
    root.svgLineChart('duration-chart',last8.map(s=>({label:t.fmtDate(s.date).slice(0,5),value:s.durationMin})),{title:'Duração dos últimos treinos (min)'});
  }
}

// ================= REWARDS (tokens + weekly card + perfect days + shop) =================
async function renderRewards(){
  const t=T();
  const {newlyAwarded,newPerfectDays}=await t.processRewardsForPastDays();
  if(newlyAwarded>0)showToast(`🪙 +${newlyAwarded} ficha(s) pelos dias anteriores!${newPerfectDays?` (${newPerfectDays} dia perfeito!)`:''}`);
  const cache=await t.loadRewardsCache();
  const balEl=$('reward-balance');if(balEl)balEl.textContent=cache.tokens;
  const perfectEl=$('reward-perfect-days');if(perfectEl)perfectEl.textContent=cache.perfectDays;
  const totalEl=$('reward-total-earned');if(totalEl)totalEl.textContent=cache.totalEarned;

  const weekEl=$('weekly-card-row');
  if(weekEl){
    const days=await t.computeWeeklyCard();
    weekEl.innerHTML=days.map(d=>{
      const cls=d.isFuture?'wc-future':(d.count===3?'wc-perfect':d.count>0?'wc-partial':'wc-none');
      return `<div class="wc-day ${cls}"><div class="wc-label">${d.dayLabel}</div><div class="wc-icons">${d.trained?'🏋️':''}${d.water?'💧':''}${d.deficit?'📉':''}</div></div>`;
    }).join('');
  }

  const shopEl=$('reward-shop-list');
  if(shopEl){
    shopEl.innerHTML=cache.rewards.map(r=>{
      const can=cache.tokens>=r.cost;
      return `<div class="reward-item"><div class="reward-info"><b>${t.escapeHtml(r.name)}</b><span>${r.cost} 🪙</span></div>
        <button class="primary secondary-btn" ${can?'':'disabled'} onclick="ForjaGymUI.redeemReward('${r.id}')">Resgatar</button>
        <button class="ex-remove-btn" onclick="ForjaGymUI.removeReward('${r.id}')">✕</button></div>`;
    }).join('')||'<div class="empty">Nenhuma recompensa cadastrada ainda.</div>';
  }
  const histEl=$('reward-history-list');
  if(histEl)histEl.innerHTML=cache.redemptions.length?cache.redemptions.slice(0,10).map(r=>`<div class="watch-hist-row"><span>${t.fmtDate(r.date)} · ${t.escapeHtml(r.rewardName)}</span><span>-${r.cost} 🪙</span></div>`).join(''):'<div class="empty">Nenhum resgate ainda.</div>';
}
async function addRewardFromUI(){
  const t=T();const nameEl=$('new-reward-name'),costEl=$('new-reward-cost');
  const name=nameEl.value.trim(),cost=parseInt(costEl.value,10);
  if(!name||!cost||cost<1){showToast('Preenche nome e custo em fichas.');return;}
  tapFeedback();await t.addReward(name,cost);nameEl.value='';costEl.value='';await renderRewards();
}
async function removeReward(id){tapFeedback();await T().removeReward(id);await renderRewards();}
async function redeemReward(id){
  tapFeedback();const res=await T().redeemReward(id);
  if(!res.ok){showToast(res.error);return;}
  showToast(`🎉 Resgatado: ${res.reward.name}!`);await renderRewards();
}

// ================= TAB ENTRY POINTS (called by app.js on tab switch) =================
async function render(){
  await loadRestPref();
  await renderTodayList();
  await renderHoje();
  await renderPlateCalc();
  await renderWeeklyGoal();
  await renderExercisePicker();
  renderReadyWorkouts();
  await renderWorkoutGroups();
  await populateWatchSessionSelect();
  await renderWatchOcrHistory();
  await renderScaleOcrHistory();
  await renderCalendar();
  await renderSessionsChart();
  await renderPrList();
  await renderVolumeChart();
  await renderDurationStats();
  await renderRewards();
  const streakEl=$('academia-streak');if(streakEl)streakEl.textContent=await T().computeStreak();
}
async function init(){
  applyBodyCardState();
  await initSessionExercisesFromToday();
  await initSessionState();
  await render();
  renderHeroStats();
  setInterval(()=>{if(activeSessionStartTs)renderHeroStats();},30000);
}

return{
  startWorkoutSession,endWorkoutSession,openPickerForAdd,closePicker,selectPickerFilter,showNewExerciseForm,selectMuscle,createNewExercise,
  searchCatalog,addCatalogExercise,addFreeExercise,addCardioEquipment,runRemapHistory,renderReadyWorkouts,useReadyWorkout,suggestMuscleFromName,setMuscleForNew,
  renderWorkoutGroups,showNewGroupForm,closeGroupForm,toggleGroupExercise,editWorkoutGroup,saveWorkoutGroup,deleteWorkoutGroup,loadWorkoutGroupToSession,
  addExerciseToSession,removeExerciseCard,toggleBodyCard,applyBodyCardState,toggleRestPop,openExSheet,closeExSheet,setSessionsMetric,showSummary,toggleMoreOpen,openExercisePhotoPopup,pickExercisePhoto,adjustCardWeight,cycleWeightMode,adjustPendingReps,logSetForCard,logCardioSetForCard,toggleWarmupMode,setCardRir,undoLastSetForCard,finishExercise,reopenExercise,
  toggleProgressionAnalysis,toggleCardTipEdit,saveCardTip,toggleLibraryOpen,
  adjustRestDuration,toggleCustomRest,adjustCustomRestMin,adjustCustomRestSec,applyCustomRest,startRestTimer,adiarRest,pularRest,openRestModal,closeRestModal,
  selectRpe,saveSessionRpe,skipSessionRpe,
  adjustPlateTarget,selectBarWeight,adjustWeeklyGoal,calShiftMonth,
  handleWatchOcrFile,saveWatchOcrEntry,saveWatchBalanceEntries,toggleWatchEdit,saveWatchEdit,deleteWatchEntry,
  handleScaleOcrFile,saveScaleOcrEntry,deleteScaleEntry,
  addRewardFromUI,removeReward,redeemReward,
  CATALOG_MUSCLE_MAP,FREE_EX_MUSCLE_MAP,normCatalogText,
  render,init,
  renderHoje,startFreeWorkout,setExerciseMode,applySuggestion,addPlannedSet,toggleExtraWeight,setTimeTarget,startTimeSet,stopTimeSet,cycleRestPreset,selectSummaryRpe,openGroupsCard,nextGroup,fmtSetsShort,fmtSecs,
};
});
