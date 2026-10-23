function reviewNutrition(value,target='diet-estimate-result'){
  dietPendingEstimate=null;
  const area=document.getElementById(target);area.replaceChildren();
  const title=document.createElement('p');title.textContent='Confira as porções e os valores antes de salvar. Informe as calorias. Nutrientes que você não sabe podem ficar em branco.';area.append(title);
  if(value.items?.length&&globalThis.ForjaEstimateUI){area.append(ForjaEstimateUI.itemTable(value.items));area.append(Object.assign(document.createElement('p'),{textContent:'Nutrientes de referência por alimento. Você pode ajustar o total abaixo; os valores individuais permanecem como referência.'}));}
  const fields=[['description','Alimentos e quantidade'],['kcal','Calorias (kcal)'],['protein_g','Proteínas (g)'],['carbs_g','Carboidratos (g)'],['fat_g','Gorduras (g)']];
  for(const [key,label]of fields){const row=document.createElement('label');row.textContent=label;const input=document.createElement('input');input.id='review-'+key;input.type=key==='description'?'text':'number';if(input.type==='number'){input.min='0';input.step='any';}input.value=value[key]??'';input.style.cssText='width:100%;padding:10px;margin-bottom:10px;background:var(--panel-2);color:var(--text);border:1px solid var(--line);border-radius:8px';row.append(input);area.append(row);}
  const button=document.createElement('button');button.className='primary';button.textContent='Confirmar e salvar refeição';button.onclick=async()=>{try{if(!dietSelectedMealType)throw new Error('Selecione o tipo de refeição primeiro.');const confirmed={...value};for(const [key]of fields){const raw=document.getElementById('review-'+key).value;confirmed[key]=key==='description'?raw:(raw.trim()===''?null:Number(raw));}ForjaNutrition.validate(confirmed);dietPendingEstimate=confirmed;await saveDietEntry();}catch(e){showToast(e.message);}};area.append(button);
}
estimateDietCalories=async function(){
 if(!dietSelectedMealType){showToast('Selecione o tipo de refeição primeiro.');return;}
 const text=document.getElementById('diet-input').value.trim();
 if(!text){showToast('Cole a estimativa do chat ou preencha os valores manualmente.');return;}
 document.getElementById('diet-label-result').replaceChildren();
 document.getElementById('diet-estimate-status').textContent='Nenhuma chamada de IA será feita. Confira os valores.';
 reviewNutrition(ForjaNutrition.parse(text));
};
updateDietLabelTotals=function(){
 const p=dietLabelPerServing;if(!p)return;
 const totals={description:(p.product_name||'Produto do rótulo')+' · '+dietLabelServings+' porção(ões)',items:[],note:'Valores do rótulo, conferidos pelo usuário.'};
 for(const key of ['kcal','protein_g','carbs_g','fat_g'])totals[key]=p[key]===null?null:Math.round(p[key]*dietLabelServings*10)/10;
 reviewNutrition(totals,'diet-label-totals');
};
checkImageSupport=async function(id){const el=document.getElementById(id);if(el)el.textContent=id==='diet-photo-note'?'Analise a foto no seu chat e cole a estimativa abaixo. Rótulos podem ser lidos aqui por OCR.':'Leitura automática de print não está disponível nesta versão — use o registro manual abaixo, ou conecte o Strava em Mais pra importar automaticamente.';};
reconcileDuplicates=async function(){};
buildBackupJson=async function(){
 if(globalThis.ForjaDataFoundation)return JSON.stringify(await ForjaDataFoundation.buildBackup(window.storage,ForjaDB),null,2);
 const data={};await Promise.all(Object.keys(pendingWrites).map(flushWrite));
 const {keys}=await window.storage.list();
 for(const key of keys){if(key==='full-checkpoint'||key.startsWith('gdrive-')||key==='strava-session'||key==='strava-service-url')continue;const r=await window.storage.get(key);if(r){try{data[key]=JSON.parse(r.value);}catch{data[key]=r.value;}}}
 return JSON.stringify({version:2,exportedAt:new Date().toISOString(),data,database:await ForjaDB.export()},null,2);
};
restoreBackupData=async function(parsed){
 if(globalThis.ForjaDataFoundation)return (await ForjaDataFoundation.restoreBackup(parsed,window.storage,ForjaDB)).restored;
 if(!parsed||typeof parsed!=='object')throw new Error('Backup inválido.');
 const data=parsed.data||parsed;let count=0;
 for(const [key,value]of Object.entries(data)){if(!/^[a-z][a-z0-9-]*$/.test(key)||key==='full-checkpoint'||key.startsWith('gdrive-')||key==='strava-session'||key==='strava-service-url')continue;if(value!==null){await window.storage.set(key,typeof value==='string'?value:JSON.stringify(value));count++;}}
 if(parsed.database)await ForjaDB.restore(parsed.database);return count;
};
const photoButton=document.getElementById('diet-photo-label');if(photoButton)photoButton.style.display='none';
document.getElementById('diet-input').placeholder='Alimentos/produto: arroz e frango\nCalorias: 450 kcal\nProteínas: 32 g\nCarboidratos: 48 g\nGorduras: 12 g';
const estimateButton=document.querySelector('[onclick="estimateDietCalories()"]');estimateButton.textContent='📋 Colar estimativa do chat / revisar valores';
const intro=document.getElementById('diet-meal-type-grid').parentElement.querySelector('.calc-formula-note');intro.textContent='Estime pelos alimentos e quantidades, leia um rótulo por OCR ou cole os dados do seu chat. Confira e salve na refeição selecionada.';
for(const id of ['corrida-print-file','natacao-print-file']){const label=document.querySelector('label[for="'+id+'"]');if(label)label.style.display='none';}
syncStrava=async function(){document.getElementById('corrida-strava-status').textContent='Registro local. Sincronização automática ainda não disponível.';};
syncStravaNatacao=async function(){document.getElementById('natacao-strava-status').textContent='Registro local. Sincronização automática ainda não disponível.';};
const forjaInitialization=runInit().catch(e=>{console.error(e);showToast('Não foi possível iniciar: '+e.message);});
