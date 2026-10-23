(function(root){
 'use strict';
 let foods=[],activities=[],draft=[],currentActivity=null,initialized=false;
 const el=id=>document.getElementById(id),keys=['kcal','protein_g','carbs_g','fat_g'];
 const folded=value=>String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 const fmt=value=>Number(value).toLocaleString('pt-BR',{maximumFractionDigits:1});
 function text(tag,value){const node=document.createElement(tag);node.textContent=value;return node;}
 function itemTable(items){
  const wrapper=document.createElement('div');wrapper.style.overflowX='auto';const table=document.createElement('table');table.style.cssText='width:100%;font-size:12px;text-align:left;border-collapse:collapse';
  const head=document.createElement('thead'),tr=document.createElement('tr');for(const label of ['Alimento','Quantidade','kcal','Carbo (g)','Proteína (g)','Gordura (g)'])tr.append(text('th',label));head.append(tr);table.append(head);
  const body=document.createElement('tbody');for(const item of items){const row=document.createElement('tr');row.append(text('td',item.name||'Alimento'));const quantity=item.quantity??item.quantity_g;row.append(text('td',typeof quantity==='number'&&Number.isFinite(quantity)?fmt(quantity)+' '+(item.unit||'g'):'Não informado'));for(const key of ['kcal','carbs_g','protein_g','fat_g'])row.append(text('td',typeof item[key]==='number'&&Number.isFinite(item[key])?fmt(item[key]):'Não informado'));body.append(row);}table.append(body);wrapper.append(table);return wrapper;
 }
 function filterFoods(){
  const terms=folded(el('food-search').value).split(/\s+/).filter(Boolean),matches=foods.filter(food=>terms.every(term=>folded(food.name).includes(term)));
  const select=el('food-select');select.replaceChildren();for(const food of matches.slice(0,80)){const option=text('option',food.name);option.value=food.id;select.append(option);}
  el('food-message').textContent=matches.length>80?'Mostrando 80 resultados. Digite mais palavras para refinar a busca.':matches.length?'Confira se o alimento está cru, cozido ou preparado da mesma forma.':'Nenhum alimento encontrado. Você pode cadastrar os valores do rótulo abaixo.';
 }
 function renderDraft(){
  const area=el('food-draft');area.replaceChildren();
  if(!draft.length){area.append(text('p','Nenhum alimento adicionado.'));return;}
  const value=root.ForjaEstimates.meal(draft);area.append(itemTable(value.items));
  for(const [index,item]of value.items.entries()){const remove=text('button','Remover '+item.name);remove.type='button';remove.className='dica-add-btn';remove.addEventListener('click',()=>{draft.splice(index,1);renderDraft();el('diet-estimate-result').replaceChildren();});area.append(remove);}
  area.append(text('p','Total: '+fmt(value.kcal)+' kcal · Carbo '+fmt(value.carbs_g)+' g · Proteína '+fmt(value.protein_g)+' g · Gordura '+fmt(value.fat_g)+' g'));
 }
 async function addFood(){
  try{const select=el('food-select'),id=select.value||select.querySelector('option')?.value;const food=foods.find(row=>row.id===id),grams=el('food-grams').value;root.ForjaEstimates.food(food,grams);draft.push({food,grams:Number(grams)});renderDraft();el('diet-estimate-result').replaceChildren();el('food-message').textContent='Alimento adicionado. Confira os itens e revise a refeição.';}
  catch(error){el('food-message').textContent=error.message;}
 }
 function reviewMeal(){try{root.reviewNutrition(root.ForjaEstimates.meal(draft));}catch(error){el('food-message').textContent=error.message;}}
 async function addCustomFood(){
  try{
   const name=el('custom-food-name').value.trim();if(!name)throw Error('Informe o nome do alimento.');
   const reference={id:'custom-'+root.crypto.randomUUID(),name,source:'Valores de rótulo informados pelo usuário (por 100 g)'};
   for(const key of keys){const raw=el('custom-food-'+key).value;if(raw.trim()===''||!Number.isFinite(Number(raw))||Number(raw)<0)throw Error('Preencha todos os nutrientes por 100 g, incluindo zero quando constar no rótulo.');reference[key]=Number(raw);}
   const stored=await root.ForjaStorage.get('food-custom'),list=stored?JSON.parse(stored.value):[];if(!Array.isArray(list))throw Error('Cadastro local de alimentos inválido.');list.push(reference);await root.ForjaStorage.set('food-custom',JSON.stringify(list));foods.push(reference);el('food-search').value=name;filterFoods();el('food-message').textContent='Alimento cadastrado. Informe a quantidade consumida e adicione à refeição.';
  }catch(error){el('food-message').textContent=error.message;}
 }
 async function showActivityEstimator(category){
  const prefix={crossfit:'crossfit',corridas:'corrida',natacao:'natacao'}[category],target=el(prefix+'-print-kcal');
  if(!target){root.showToast('Abra o registro manual ou a edição do treino primeiro.');return;}
  if(!activities.length)activities=await root.ForjaReferences.activities();
  el('activity-estimator')?.remove();const panel=document.createElement('div');panel.id='activity-estimator';panel.className='card';
  panel.append(text('p',category==='crossfit'?'Escolha o tipo de esforço predominante. Circuitos são uma aproximação para CrossFit. Não aplique intensidade vigorosa aos minutos de explicação ou descanso prolongado.':'Escolha a referência que melhor representa sua atividade.'));
  const label=text('label','Tipo de atividade / intensidade'),select=document.createElement('select');select.id='activity-reference';
  for(const activity of activities.filter(a=>a.category===category)){const option=text('option',activity.name);option.value=activity.id;select.append(option);}label.append(select);panel.append(label);
  const known=typeof root.getLastWeightValue==='function'?await root.getLastWeightValue():null;
  for(const [id,title,value]of [['activity-weight','Peso (kg)',known>0?known:''],['activity-minutes','Minutos de exercício',el(prefix+'-print-min')?.value||'']]){const row=text('label',title),input=document.createElement('input');input.id=id;input.type='number';input.min='0.1';input.step='any';input.value=value;input.addEventListener('input',()=>{currentActivity=null;el('activity-apply').disabled=true;el('activity-total-apply').disabled=true;});row.append(input);panel.append(row);}
  select.addEventListener('change',()=>{currentActivity=null;el('activity-apply').disabled=true;el('activity-total-apply').disabled=true;});
  const calculate=text('button','Calcular estimativa');calculate.type='button';calculate.className='dica-add-btn';calculate.addEventListener('click',calculateActivity);panel.append(calculate);
  const status=text('p','Estimativa média por peso, tempo e intensidade; não é uma medição do relógio.');status.id='activity-result';status.setAttribute('role','status');panel.append(status);
  for(const [id,title,kind]of [['activity-apply','Usar calorias ativas','active'],['activity-total-apply','Usar calorias totais','total']]){const button=text('button',title);button.id=id;button.type='button';button.className='dica-add-btn';button.disabled=true;button.addEventListener('click',()=>applyActivity(kind));panel.append(button);}
  panel.append(text('p','Ativas: gasto acima do repouso. Totais: incluem o repouso durante esse tempo. Confira o valor e salve o treino para registrá-lo. Fonte: Compêndio de Atividades Físicas 2024.'));
  target.parentElement.append(panel);currentActivity={category,prefix,target,result:null};
 }
 function calculateActivity(){
  try{const select=el('activity-reference'),id=select.value||select.querySelector('option')?.value,reference=activities.find(a=>a.id===id);const result=root.ForjaEstimates.activity(reference,el('activity-weight').value,el('activity-minutes').value);const prefix=el('activity-estimator').parentElement.querySelector('[id$="-print-kcal"]')?.id.split('-print-kcal')[0]||currentActivity?.prefix;
   currentActivity={prefix,target:el(prefix+'-print-kcal'),result};el('activity-result').textContent='Estimativa: '+result.activeKcal+' kcal ativas · '+result.totalKcal+' kcal totais. Confira antes de usar.';el('activity-apply').disabled=false;el('activity-total-apply').disabled=false;
  }catch(error){el('activity-result').textContent=error.message;}
 }
 function applyActivity(kind='active'){
  if(!currentActivity?.result)return;const {target,prefix,result}=currentActivity,usedKcal=kind==='total'?result.totalKcal:result.activeKcal;target.value=usedKcal;
  const duration=el(prefix+'-print-min');if(duration)duration.value=result.minutes;
  const review=el(prefix+'-print-review');if(review)review.dataset.calorieEstimate=JSON.stringify({...result,kind,usedKcal});
  el('activity-result').textContent='Valor preenchido como estimativa. Confira e salve o treino. Nenhum treino foi salvo automaticamente.';
 }
 async function init(){
  if(initialized)return;initialized=true;
  try{foods=await root.ForjaReferences.foods();activities=await root.ForjaReferences.activities();const custom=await root.ForjaStorage?.get('food-custom');if(custom){const rows=JSON.parse(custom.value);if(Array.isArray(rows))foods.push(...rows.filter(f=>f&&typeof f.name==='string'));}filterFoods();renderDraft();
   el('food-search').addEventListener('input',filterFoods);el('food-add').addEventListener('click',addFood);el('food-review').addEventListener('click',reviewMeal);el('food-custom-save').addEventListener('click',addCustomFood);
  }catch(error){el('food-message').textContent='Não foi possível carregar as referências locais: '+error.message;}
 }
 root.ForjaEstimateUI={init,filterFoods,addFood,reviewMeal,itemTable,showActivityEstimator,calculateActivity,applyActivity,addCustomFood};
 root.estimateCrossfitCalorias=()=>showActivityEstimator('crossfit');
 for(const [name,category]of [['renderCrossfitPrintReview','crossfit'],['renderCorridaPrintReview','corridas'],['renderNatacaoPrintReview','natacao']]){
  const original=root[name];if(typeof original!=='function')continue;
  root[name]=function(...args){original(...args);const prefix={crossfit:'crossfit',corridas:'corrida',natacao:'natacao'}[category],target=el(prefix+'-print-kcal');if(!target)return;if(category==='crossfit'){const button=target.parentElement.querySelector('button');if(button)button.textContent='Estimar com peso e intensidade';}else{const button=text('button','Estimar com peso e intensidade');button.type='button';button.className='dica-add-btn';button.addEventListener('click',()=>showActivityEstimator(category));target.parentElement.append(button);}};
 }
 const render=root.renderDietTab;if(typeof render==='function')root.renderDietTab=async function(...args){await render(...args);const entries=await root.loadDietCache();for(const row of document.querySelectorAll('[data-diet-entry]')){const entry=entries.find(e=>String(e.id)===row.dataset.dietEntry);if(entry?.items?.some(i=>i&&typeof i.name==='string')){const details=document.createElement('details');details.append(text('summary','Nutrientes por alimento'));details.append(itemTable(entry.items));details.append(text('p','Valores de referência por alimento. O total da refeição pode ter sido ajustado manualmente.'));(row.querySelector('.info')||row).append(details);}}};
 const save=root.saveDietEntry;if(typeof save==='function')root.saveDietEntry=async function(...args){const before=(await root.loadDietCache()).length;await save(...args);if((await root.loadDietCache()).length>before){draft=[];renderDraft();}};
})(globalThis);
