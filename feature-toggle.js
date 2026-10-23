(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.ForjaFeatureToggle=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const KEY='hidden-modules-v1';
 // {id, label, group}
 const MODULES=[
  {id:'weekly-goal-card',label:'🎯 Meta semanal (Início)',group:'Início'},
  {id:'weekly-report-card',label:'📊 Comparação semanal (Início)',group:'Início'},
  {id:'plate-calc-card',label:'🧮 Calculadora de anilhas',group:'Academia'},
  {id:'gym-weekly-goal-card',label:'🎯 Meta semanal (Academia)',group:'Academia'},
  {id:'gym-rewards-card',label:'🪙 Recompensas',group:'Academia'},
  {id:'gym-calendar-card',label:'📅 Calendário',group:'Academia'},
  {id:'gym-records-card',label:'🏆 Recordes (1RM estimado)',group:'Academia'},
  {id:'gym-volume-card',label:'📊 Volume total levantado',group:'Academia'},
  {id:'gym-duration-card',label:'⏱ Duração dos treinos',group:'Academia'},
  {id:'sync-center-card',label:'🔄 Central de sincronização',group:'Mais'},
  {id:'strava-card',label:'🔗 Conectar ao Strava',group:'Mais'},
  {id:'health-connect-card',label:'⌚ Garmin pelo Health Connect',group:'Mais'},
  {id:'dash-gym-card',label:'💳 Pagamento do CrossFit',group:'Mais'},
  {id:'gdrive-card',label:'☁️ Backup automático no Google Drive',group:'Mais'},
  {id:'gemini-key-card',label:'✨ Chave do Gemini (foto da comida)',group:'Mais'},
  {id:'watch-ocr-card',label:'⌚ Importar do relógio (Zepp)',group:'Importar'},
  {id:'scale-import-card',label:'⚖️ Importar da balança (OKOK)',group:'Importar'},
  {id:'photo-compare-card',label:'🔄 Comparar evolução (fotos)',group:'Importar'},
  {id:'shopping-list-card',label:'🛒 Lista de compras da semana',group:'Cardápio'},
  {id:'calorie-calc-card',label:'🔥 Calculadora de calorias (TMB/TDEE)',group:'Corpo'},
 ];
 const IDS=MODULES.map(m=>m.id);
 function normalize(value){const arr=Array.isArray(value)?value:[];return[...new Set(arr.filter(id=>IDS.includes(id)))];}
 async function load(){try{const r=await(root.ForjaStorage||root.storage).get(KEY);return normalize(r?.value?JSON.parse(r.value):[]);}catch{return[];}}
 async function save(value){const next=normalize(value);await(root.ForjaStorage||root.storage).set(KEY,JSON.stringify(next));return next;}
 async function apply(){
  const hidden=await load();
  if(!root.document)return hidden;
  root.document.querySelectorAll('[data-module-card]').forEach(node=>{
   node.classList.toggle('module-card-hidden',hidden.includes(node.dataset.moduleCard));
  });
  return hidden;
 }
 async function renderSettings(){
  const area=root.document?.getElementById('module-toggle-list');
  if(!area)return;
  const hidden=await load();
  const groups={};
  for(const m of MODULES){(groups[m.group]=groups[m.group]||[]).push(m);}
  area.replaceChildren();
  for(const groupName of Object.keys(groups)){
   const groupTitle=root.document.createElement('div');
   groupTitle.className='module-toggle-group-title';
   groupTitle.textContent=groupName;
   area.append(groupTitle);
   for(const m of groups[groupName]){
    const row=root.document.createElement('label');
    row.className='visibility-switch';
    row.innerHTML=`<span>${m.label}</span><input type="checkbox" ${hidden.includes(m.id)?'':'checked'}><span class="switch-track" aria-hidden="true"></span>`;
    const input=row.querySelector('input');
    input.onchange=async()=>{
     const fresh=await load();
     const next=input.checked?fresh.filter(x=>x!==m.id):[...fresh,m.id];
     await save(next);
     await apply();
    };
    area.append(row);
   }
  }
 }
 return{KEY,MODULES,load,save,apply,renderSettings};
});
