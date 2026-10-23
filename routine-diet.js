(function(root){
 'use strict';
 const el=id=>document.getElementById(id),F=()=>root.ForjaDietFlow;
 const fields=['description','kcal','protein_g','carbs_g','fat_g'];
 let drafts={},favorites=[],paused=false,write=Promise.resolve(),ready=false,selectionGeneration=0;
 const key=s=>s.date+'|'+s.meal;
 const clone=x=>JSON.parse(JSON.stringify(x));
 async function read(k,fallback){try{const r=await root.ForjaStorage.get(k);return r?JSON.parse(r.value):fallback;}catch{return fallback;}}
 function status(text){el('diet-simple-status').textContent=text;}
 function persist(){const value=JSON.stringify(drafts);write=write.catch(()=>{}).then(()=>root.ForjaStorage.set('diet-drafts-v1',value)).catch(()=>status('Não foi possível guardar o rascunho. Mantenha esta tela aberta e exporte um backup.'));return write;}
 function changed(){
  if(!ready||paused)return;
  const s=F().getState();if(!s.meal)return;
  s.quick=Object.fromEntries(fields.map(k=>[k,el('quick-'+k)?.value||'']));s.paste=el('quick-paste')?.value||'';s.updated=Date.now();
  drafts[key(s)]=s;persist();el('draft-state').textContent='Rascunho neste aparelho · '+s.date.split('-').reverse().join('/');
 }
 function fillQuick(value={}){fields.forEach(k=>el('quick-'+k).value=value[k]??'');}
 async function loadMeal(meal,index){
  const request=++selectionGeneration;paused=true;
  try{if(await originalLoad(meal,index)===false||request!==selectionGeneration)return;const saved=drafts[key(F().getState())];fillQuick(saved?.quick);el('quick-paste').value=saved?.paste||'';if(saved&&index==null){F().restoreState(saved);status('Rascunho recuperado. Confira e continue de onde parou.');}else if(index==null){F().startEmpty();status('Refeição vazia. Cole um texto, preencha manualmente, leia um código ou use o cardápio opcional.');}}
  finally{if(request===selectionGeneration)paused=false;}if(request!==selectionGeneration)return;changed();await renderSavedMeals();
 }
 let originalLoad;
 async function usePlan(){const s=F().getState();if(!s.meal){status('Escolha Café, Almoço, Lanche ou outra refeição primeiro.');return;}paused=true;try{await originalLoad(s.meal);fillQuick();el('quick-paste').value='';}finally{paused=false;}changed();}
 function onSaved(context){delete drafts[key(context)];persist();fillQuick();el('quick-paste').value='';el('draft-state').textContent='Refeição salva. Você pode preparar a próxima.';renderSavedMeals();}
 function parseQuick(){const v=root.ForjaNutrition.parse(el('quick-paste').value);fillQuick(v);el('quick-review').hidden=false;status(v.kcal==null?'Confira os totais: não encontrei um único valor de calorias. Preencha abaixo.':'Valores lidos. Confira se correspondem à quantidade que você comeu.');changed();}
 function quickRow(v){return {name:v.description,quantity:1,unit:'porção',food:{id:'quick-'+root.crypto.randomUUID(),name:v.description,unit:'porção',portion_quantity:1,source:v.source||'Valores informados pelo usuário',...Object.fromEntries(fields.slice(1).map(k=>[k,v[k]==null?null:Number(v[k])*100]))}};}
 function addQuick(replace=false){try{if(!F().getState().meal)throw Error('Escolha a refeição primeiro.');const v={};fields.forEach(k=>{const raw=el('quick-'+k).value.trim();v[k]=k==='description'?raw:raw===''?null:Number(raw.replace(',','.'));});root.ForjaNutrition.validate(v);if(replace)F().resetRows([quickRow(v)]);else F().appendRows([quickRow(v)]);fillQuick();el('quick-paste').value='';el('quick-entry').open=false;changed();}catch(e){status(e.message);}}
 async function saveQuick(){try{if(!F().getState().meal)throw Error('Escolha a refeição primeiro.');const v={};fields.forEach(k=>{const raw=el('quick-'+k).value.trim();v[k]=k==='description'?raw:raw===''?null:Number(raw.replace(',','.'));});root.ForjaNutrition.validate(v);const warnings=root.ForjaNutritionMemory?.plausibilityWarnings?.({kcal:v.kcal,carbs:v.carbs_g,protein:v.protein_g,fat:v.fat_g},100)||[];if(warnings.length&&!root.confirm(`Confira antes de salvar:\n\n${warnings.join('\n')}\n\nSalvar mesmo assim?`))return;await root.ForjaNutritionMemory?.saveCorrection?.({name:v.description,unit:'porção',...v,source:'user'});F().resetRows([quickRow(v)]);changed();await F().save();}catch(e){status(e.message);}}
 function entryRows(entry){
  if(!entry.totalsEdited&&entry.items?.length&&entry.items.every(i=>Number(i.quantity)>0&&i.kcal!=null))return entry.items.map(i=>({name:i.name,quantity:Number(i.quantity),unit:i.unit||'g',food:{id:i.foodId||'saved-'+root.crypto.randomUUID(),name:i.reference_name||i.name,unit:i.unit||'g',source:i.source||'Refeição salva',...Object.fromEntries(fields.slice(1).map(k=>[k,i[k]==null?null:Number(i[k])*100/Number(i.quantity)]))}}));
  return [quickRow(entry)];
 }
 async function repeatEntry(entry){if(!F().getState().meal){status('Escolha a refeição antes de repetir.');return;}F().resetRows(entryRows(entry));changed();}
 async function renderSavedMeals(){
  const area=el('saved-meals');if(!ready||!area)return;area.replaceChildren();
  const s=F().getState(),all=await root.loadDietCache();
  const yesterday=new Date(s.date+'T12:00:00');yesterday.setDate(yesterday.getDate()-1);const y=root.todayKey(yesterday);
  const old=all.filter(e=>e.date===y&&e.mealType===s.meal);
  if(old.length){const b=document.createElement('button');b.type='button';b.className='dica-add-btn';b.textContent='Repetir esta refeição de ontem';b.onclick=()=>{F().resetRows(old.flatMap(entryRows));changed();};area.append(b);}
  favorites.filter(f=>!s.meal||f.mealType===s.meal).slice(0,12).forEach(f=>{const row=document.createElement('div');row.className='favorite-row';const b=document.createElement('button');b.type='button';b.className='dica-add-btn';b.textContent='★ '+f.name;b.onclick=()=>repeatEntry(f.entry);row.append(b);const del=document.createElement('button');del.type='button';del.className='dica-add-btn';del.textContent='Remover favorito';del.onclick=async()=>{favorites=favorites.filter(v=>v.id!==f.id);await root.ForjaStorage.set('meal-favorites-v1',JSON.stringify(favorites));renderSavedMeals();};row.append(del);area.append(row);});
  if(!area.children.length)area.textContent='Guarde uma combinação abaixo para reutilizar, ou repita uma refeição já registrada.';
  document.querySelectorAll('[data-diet-entry]').forEach(row=>{if(row.querySelector('[data-repeat-meal]'))return;const entry=all.find(e=>e.id===row.dataset.dietEntry);if(!entry)return;const b=document.createElement('button');b.type='button';b.dataset.repeatMeal='';b.className='dica-add-btn';b.textContent='Repetir';b.onclick=async()=>{await root.selectDietMealType(entry.mealType||'livre');repeatEntry(entry);el('diet-simple').scrollIntoView?.({behavior:'smooth'});};row.querySelector('.info').append(b);});
 }
 async function favorite(){try{const s=F().getState(),entry=root.ForjaDietCore.totals(s.rows),name=el('favorite-name').value.trim();if(!name)throw Error('Dê um nome, por exemplo: meu café habitual.');if(!s.meal)throw Error('Selecione a refeição.');favorites.push({id:root.crypto.randomUUID(),name,mealType:s.meal,entry});await root.ForjaStorage.set('meal-favorites-v1',JSON.stringify(favorites));el('favorite-name').value='';status('Combinação guardada. Guardar não registra uma refeição consumida.');renderSavedMeals();}catch(e){status(e.message);}}
 async function retryPhoto(){const s=F().getState();if(!s.photo){status('Escolha uma foto primeiro.');return;}const bytes=Uint8Array.from(atob(s.photo.split(',')[1]),c=>c.charCodeAt(0));await F().analyze(new File([bytes],'refeicao.jpg',{type:'image/jpeg'}));}
 async function resumeDraft(){const latest=Object.values(drafts).sort((a,b)=>b.updated-a.updated)[0];if(!latest){status('Nenhum rascunho pendente.');return;}root.setDietDate(latest.date);await root.selectDietMealType(latest.meal);el('draft-resume').hidden=true;}
 async function init(){
  drafts=await read('diet-drafts-v1',{});favorites=await read('meal-favorites-v1',[]);originalLoad=F().loadMeal;F().loadMeal=loadMeal;ready=true;
  document.getElementById('diet-simple').addEventListener('input',()=>queueMicrotask(changed));
  document.getElementById('diet-simple').addEventListener('change',()=>queueMicrotask(changed));
  for(const name of ['setDietDate','shiftDietDate','jumpToDietDate']){const old=root[name];root[name]=function(...args){changed();paused=true;try{return old(...args);}finally{paused=false;fillQuick();el('quick-paste').value='';}};}
  if(Object.keys(drafts).length)el('draft-resume').hidden=false;
  await renderSavedMeals();
 }
 root.ForjaRoutineDiet={init,changed,onSaved,parseQuick,addQuick,saveQuick,favorite,renderSavedMeals,retryPhoto,usePlan,resumeDraft,entryRows,flush:()=>write};
})(globalThis);
