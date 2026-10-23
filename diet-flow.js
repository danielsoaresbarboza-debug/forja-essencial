(function(root){
 'use strict';
 const C=root.ForjaDietCore,el=id=>document.getElementById(id);
 const AI_ACTIVATION_KEY='nutrition-ai-activation-v1';
 let catalog=[],mine=[],bindings={},rows=[],currentKey=null,optionIndex=0,initialized=false,busy=false,saving=false,revision=0,customTarget=null,loadGeneration=0;
 const node=(tag,value)=>Object.assign(document.createElement(tag),{textContent:value});
 const fmt=v=>v==null?'não informado':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:1});
 function notify(value){el('diet-simple-status').textContent=value;root.ForjaRoutineDiet?.changed();}
 async function aiActivation(service){try{const row=await root.ForjaStorage.get(AI_ACTIVATION_KEY),saved=row?.value?JSON.parse(row.value):null;return saved?.service===service&&saved?.activated===true;}catch{return false;}}
 async function refreshAIStatus(){const field=el('diet-ai-status'),setup=el('diet-ai-setup');if(!field||!setup)return false;let service='';try{const row=await root.ForjaStorage.get('strava-service-url');if(row)service=root.ForjaStrava.validateServiceUrl(row.value);}catch{}const active=service&&await aiActivation(service);setup.hidden=!!active;field.textContent=active?'IA ativada para este serviço. Escolha ou tire uma foto para analisar. Não é preciso autorizar novamente.':'Se a análise já funcionou, escolha a foto diretamente. A ativação só é necessária na primeira utilização deste serviço.';return !!active;}
 async function rememberAI(service){await root.ForjaStorage.set(AI_ACTIVATION_KEY,JSON.stringify({service,activated:true,at:new Date().toISOString()}));await refreshAIStatus();}
 function invalidate(){revision++;dietPendingEstimate=null;el('diet-estimate-result').replaceChildren();el('diet-simple-save').disabled=true;}
 function syncPhotoControls(){el('diet-simple-photo-remove').hidden=el('diet-simple-photo-preview').hidden;}
 function clearPhoto(){invalidate();const preview=el('diet-simple-photo-preview');preview.hidden=true;preview.removeAttribute('src');el('diet-simple-photo').value='';syncPhotoControls();total();notify('Foto removida. Os alimentos da refeição foram mantidos.');}
 function plan(){return DIET_PLAN;}
 async function persist(){await root.ForjaStorage.set('diet-food-bindings',JSON.stringify(bindings));await root.ForjaStorage.set('diet-recurring',JSON.stringify(mine.filter(r=>r.recurring).map(r=>({name:r.name,foodId:r.food?.id,food:r.food,quantity:r.quantity,unit:r.unit}))));}
 function search(){
  const query=C.fold(el('diet-simple-search').value),all=el('diet-simple-all').checked||!!el('diet-simple-search').value.trim();
  const favorites=mine.filter(r=>r.recurring||r.recent);const choices=(all?[...favorites,...catalog.filter(food=>!favorites.some(r=>r.food?.id===food.id)).map(food=>({name:food.name,food,unit:food.unit||'g',quantity:null}))]:[...mine]).sort((a,b)=>(b.lastUsed||0)-(a.lastUsed||0)||Number(!!b.recurring)-Number(!!a.recurring));
  const select=el('diet-simple-food');select.replaceChildren();
  for(const item of choices.filter(r=>query.split(' ').every(t=>C.fold(r.name).includes(t))).slice(0,80)){const opt=node('option',item.name+(item.food?'':' — escolher referência'));opt.value=all?item.food.id:C.fold(item.name);select.append(opt);}
  el('diet-search-message').textContent=select.children.length?'Escolha o alimento e clique em Adicionar à refeição.':'Não encontramos esse nome. Tente uma palavra mais curta ou cadastre os dados do produto.';
 }
 function total(){
  for(const [index,row]of rows.entries()){const label=document.querySelector('[data-row-nutrients="'+index+'"]');if(label){try{const value=C.totals([row]);label.textContent=fmt(value.kcal)+' kcal · C '+fmt(value.carbs_g)+' g · P '+fmt(value.protein_g)+' g · G '+fmt(value.fat_g)+' g';}catch{label.textContent='Complete o alimento e a quantidade para calcular.';}}}
  try{const value=C.totals(rows);el('diet-simple-total').textContent=fmt(value.kcal)+' kcal · Carbo '+fmt(value.carbs_g)+' g · Proteína '+fmt(value.protein_g)+' g · Gordura '+fmt(value.fat_g)+' g';el('diet-simple-save').disabled=busy||!dietSelectedMealType;return value;}catch(error){el('diet-simple-total').textContent=error.message;el('diet-simple-save').disabled=true;return null;}
 }
 function render(){
  const area=el('diet-simple-items');area.replaceChildren();
  for(const id of ['diet-detailed-review-title','diet-simple-items','diet-simple-total','diet-simple-save'])el(id).hidden=!rows.length;
  if(!rows.length)area.append(node('p','Adicione os alimentos que você comeu.'));
  for(const [index,row]of rows.entries()){
   const card=node('div','');card.className='simple-food-row';card.append(node('strong',row.name));
   const portion=row.food?.portion_quantity||1,byPortion=!!row.food?.portion_quantity;
   const quantity=node('label',byPortion?'Porções consumidas (1 porção = '+portion+' '+row.unit+')':'Quantidade consumida ('+row.unit+')'),input=document.createElement('input');input.type='number';input.min='0.1';input.step='any';input.value=row.quantity==null?'':row.quantity/portion;input.dataset.rowQuantity=index;
   input.addEventListener('input',()=>{invalidate();row.quantity=input.value.trim()===''?null:Number(input.value)*portion;total();});quantity.append(input);card.append(quantity);
   const reference=node('details',''),summary=node('summary',row.food?'Trocar alimento: '+row.food.name:'Complete os dados deste alimento');reference.append(summary);
   if(!row.food)reference.open=true;
   const query=document.createElement('input');query.type='search';query.placeholder='Digite em português: morango, kiwi, uva…';query.setAttribute('aria-label','Buscar referência para '+row.name);query.value=row.food?row.food.name:'';reference.append(query);
   if(!row.food)reference.append(node('p','Busque o alimento em português e selecione abaixo. Para misturas sem referência, adicione os ingredientes separadamente no lançamento manual.'));
   const select=document.createElement('select');select.setAttribute('aria-label','Referência de '+row.name);
   function options(){const terms=C.fold(query.value).split(' ').filter(Boolean),matches=catalog.filter(f=>(f.unit||'g')===row.unit&&C.complete(f)&&terms.every(t=>C.fold(f.name).includes(t))&&(terms.length||!C.fold(row.name).includes('fruta')||/^(abacate|abacaxi|banana|morango|uva|manga|melao|melancia|kiwi|maca|laranja|pera|mamao|goiaba|ameixa|pessego|tangerina)\b/.test(C.fold(f.name))));select.replaceChildren();const blank=node('option','Selecione uma referência');blank.value='';select.append(blank);for(const food of matches.slice(0,80)){const opt=node('option',food.name);opt.value=food.id;select.append(opt);}if(row.food&&!matches.some(f=>f.id===row.food.id)){const opt=node('option',row.food.name);opt.value=row.food.id;select.append(opt);}if(row.food)for(const opt of select.querySelectorAll('option'))opt.selected=opt.value===row.food.id;}
   query.addEventListener('input',options);options();select.addEventListener('change',()=>chooseReference(index,select.value).catch(e=>notify(e.message)));reference.append(select);const labelButton=node('button','Informar nutrientes / rótulo');labelButton.type='button';labelButton.className='dica-add-btn';labelButton.addEventListener('click',()=>openCustom(index));reference.append(labelButton);card.append(reference);
   if(row.food?.trace_nutrients)card.append(node('p','Tabela registra traços de '+row.food.trace_nutrients.join(', ')+': aproximação de 0 g no total.'));
   if(row.suggested)card.append(node('p',row.food?.source?.startsWith('Estimativa visual por IA')?'Porção e nutrientes estimados pela IA: confira e corrija se necessário antes de salvar.':'Porção sugerida: confira antes de salvar.'));
   if(row.planQuantity)card.append(node('p','Cardápio: '+row.planQuantity));
   const nutrients=node('p','');nutrients.dataset.rowNutrients=index;card.append(nutrients);
   const remove=node('button','Retirar');remove.type='button';remove.className='dica-add-btn';remove.addEventListener('click',()=>{invalidate();rows.splice(index,1);render();});card.append(remove);
   const remember=node('button','Guardar em Meus alimentos');remember.type='button';remember.className='dica-add-btn';remember.addEventListener('click',async()=>{try{C.totals([row]);const old=mine.find(r=>C.fold(r.name)===C.fold(row.name));if(old)Object.assign(old,row,{recurring:true});else mine.push({...row,recurring:true});await persist();search();notify('Alimento e porção salvos para reutilizar.');}catch(e){notify(e.message);}});card.append(remember);area.append(card);
  }
  total();root.ForjaRoutineDiet?.changed();
 }
 async function chooseReference(index,id){const row=rows[index];if(!row)return;invalidate();row.food=catalog.find(f=>f.id===id&&(f.unit||'g')===row.unit&&C.complete(f))||null;if(row.food){bindings[C.fold(row.name)]=row.food.id;const known=mine.find(r=>C.fold(r.name)===C.fold(row.name));if(known)known.food=row.food;await persist();}render();search();}
 async function loadMeal(key,index){
  const request=++loadGeneration;invalidate();customTarget=null;currentKey=key;await loadMenuSelectedCache();if(request!==loadGeneration||dietSelectedMealType!==key)return false;const def=plan()[key];optionIndex=index??getMenuOptionIndex(key);if(!def?.options?.[optionIndex])optionIndex=0;
  rows=C.prefill(plan(),key,optionIndex,catalog,bindings);el('diet-simple-photo-preview').hidden=true;el('diet-simple-photo-preview').removeAttribute('src');syncPhotoControls();
  const option=el('diet-simple-option');option.replaceChildren();option.hidden=!def?.options;
  el('diet-simple-option-label').hidden=!def?.options;
  for(const [i,opt]of (def?.options||[]).entries()){const n=node('option',opt.name);n.value=i;option.append(n);}for(const opt of option.querySelectorAll('option'))opt.selected=opt.value===String(optionIndex);
  render();notify(rows.length?'Porções do cardápio carregadas. Ajuste ao que consumiu e salve.':'Adicione os alimentos que consumiu.');return true;
 }
 function add(){const select=el('diet-simple-food'),id=select.value||select.querySelector('option')?.value,all=el('diet-simple-all').checked||!!el('diet-simple-search').value.trim();const found=all?catalog.find(f=>f.id===id):mine.find(r=>C.fold(r.name)===id);if(!found){notify('Selecione um alimento.');return;}invalidate();const remembered=all?mine.find(r=>r.food?.id===id):null;rows.push(all?(remembered?{...remembered}:{name:found.name,food:found,quantity:null,unit:found.unit||'g'}):{...found});render();}
 function startEmpty(){if(busy)return;invalidate();rows=[];customTarget=null;el('diet-simple-option').hidden=true;el('diet-simple-option-label').hidden=true;el('diet-simple-photo-preview').hidden=true;el('diet-simple-photo-preview').removeAttribute('src');syncPhotoControls();el('diet-simple-manual').hidden=false;render();notify('Refeição vazia. Adicione qualquer alimento ou produto abaixo.');}
 function showMethod(method){
  const ids={text:'quick-entry',food:'diet-table-panel',barcode:'barcode-panel',photo:'diet-photo-method'};
  if(!ids[method])return;
  for(const [name,id] of Object.entries(ids))el(id).open=name===method;
  el('diet-simple-manual').hidden=false;
  for(const button of document.querySelectorAll('[data-diet-method]')){button.classList.toggle('active',button.dataset.dietMethod===method);button.setAttribute('aria-pressed',String(button.dataset.dietMethod===method));}
  el(ids[method]).scrollIntoView?.({behavior:'smooth',block:'nearest'});
 }
 function openCustom(index=null){customTarget=Number.isInteger(index)?index:null;el('diet-add-panel').open=true;el('diet-custom-panel').open=true;el('diet-simple-manual').hidden=false;el('diet-simple-photo-panel').hidden=true;for(const opt of el('diet-custom-unit').querySelectorAll('option'))opt.selected=opt.value===(customTarget!==null?rows[customTarget].unit:'g');el('diet-custom-name').value=customTarget!==null?rows[customTarget].name:el('diet-simple-search').value;el('diet-custom-quantity').value=customTarget!==null?(rows[customTarget].quantity??''):'';el('diet-custom-basis').value='100';for(const key of ['kcal','carbs_g','protein_g','fat_g'])el('diet-custom-'+key).value=customTarget!==null&&Number.isFinite(rows[customTarget].food?.[key])?rows[customTarget].food[key]:'';notify('Confira os nutrientes estimados ou informe os valores do rótulo.');}
 function parseText(){try{invalidate();rows=C.parse(el('diet-simple-text').value,mine,catalog);render();notify('Confira alimentos, preparações e porções. Quantidades ausentes usam sua porção cadastrada quando disponível.');}catch(error){notify(error.message);}}
async function save(){if(busy)return;if(!dietSelectedMealType){notify('Selecione o tipo de refeição.');return;}const value=total();if(!value)return;busy=true;saving=true;el('diet-simple').inert=true;const savedContext={date:selectedDietDate,meal:dietSelectedMealType};el('diet-simple-save').disabled=true;try{const before=(await loadDietCache()).length;ForjaNutrition.validate(value);dietPendingEstimate=value;await root.saveDietEntry();if((await loadDietCache()).length>before){const recent=rows.filter(r=>r.food).map(r=>({...r,recent:true,lastUsed:Date.now()}));for(const r of recent){const known=mine.find(m=>m.food?.id===r.food.id);if(known)Object.assign(known,r);else mine.unshift(r);if(!catalog.some(f=>f.id===r.food.id))catalog.push(r.food);await root.ForjaNutritionMemory?.saveCorrection?.({name:r.name,unit:r.unit,barcode:r.food?.barcode,kcal:r.food?.kcal,carbs:r.food?.carbs_g,protein:r.food?.protein_g,fat:r.food?.fat_g,source:'user'});}await root.ForjaStorage.set('diet-recent-foods',JSON.stringify(mine.filter(r=>r.recent).slice(0,15))).catch(()=>{});search();root.ForjaRoutineDiet?.onSaved(savedContext);rows=[];currentKey=null;el('diet-simple-text').value='';el('diet-simple-photo-preview').hidden=true;el('diet-simple-photo-preview').removeAttribute('src');syncPhotoControls();render();notify('Refeição salva. Escolha outra refeição para um novo lançamento.');}}catch(error){notify(error.message);}finally{busy=false;saving=false;el('diet-simple').inert=false;total();}}
 async function custom(){try{
  const name=el('diet-custom-name').value.trim(),unit=el('diet-custom-unit').value||'g',quantity=el('diet-custom-quantity').value.trim();
  if(!name)throw Error('Informe o nome do produto.');
  if(quantity&&(!Number.isFinite(Number(quantity))||Number(quantity)<=0))throw Error('Informe uma porção habitual maior que zero.');
  const basis=Number(el('diet-custom-basis').value);if(!Number.isFinite(basis)||basis<=0)throw Error('Informe o tamanho da porção do rótulo.');
  const food={id:'custom-'+root.crypto.randomUUID(),name,unit,portion_quantity:basis,source:'Dados informados pelo usuário — por 100 '+unit};
  for(const key of ['kcal','carbs_g','protein_g','fat_g']){const raw=el('diet-custom-'+key).value;if(!raw.trim()&&key!=='kcal'){food[key]=null;continue;}if(!raw.trim()||!Number.isFinite(Number(raw))||Number(raw)<0)throw Error('Informe calorias válidas; os demais nutrientes podem ficar em branco.');food[key]=Number(raw)*100/basis;}
  const stored=await root.ForjaStorage.get('food-custom'),list=stored?JSON.parse(stored.value):[];list.push(food);await root.ForjaStorage.set('food-custom',JSON.stringify(list));catalog.push(food);
  const row={name,food,quantity:quantity?Number(quantity):basis,unit,recurring:true};mine.push(row);invalidate();if(customTarget!==null&&rows[customTarget])rows[customTarget]=row;else rows.push({...row});customTarget=null;await persist();search();render();el('diet-custom-panel').open=false;notify('Produto adicionado à refeição e guardado para a próxima vez. Confira o total e salve a refeição.');
 }catch(error){notify(error.message);}}
 async function analyze(file){
  el('diet-simple-photo').value='';
  if(busy||!file)return;
  if(!dietSelectedMealType){const message='Selecione a refeição (Almoço, Lanche ou Livre) e escolha a foto novamente.';notify(message);if(root.showToast)root.showToast(message);return;}
  let session,service;try{const s=await root.ForjaStorage.get('strava-session'),u=await root.ForjaStorage.get('strava-service-url');session=s?JSON.parse(s.value):null;service=u?root.ForjaStrava.validateServiceUrl(u.value):null;}catch{}
  if(!session?.token||session.pending||!service){notify('Conecte sua conta na área Strava para identificar este aparelho no serviço privado de análise.');return;}
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)){notify('Use uma foto JPG, PNG ou WebP.');return;}
  if(file.size>20*1024*1024){notify('Escolha uma foto menor que 20 MB.');return;}
  busy=true;total();notify('Preparando foto para análise…');const originalRevision=revision,controller=new AbortController(),timer=setTimeout(()=>controller.abort(),60000);
  try{
   const bitmap=await root.createImageBitmap(file),canvas=document.createElement('canvas');const factor=Math.min(1,1024/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*factor));canvas.height=Math.max(1,Math.round(bitmap.height*factor));canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();const image=canvas.toDataURL('image/jpeg',0.8).split(',')[1];
   if(image.length>1400000)throw Error('Foto muito grande após preparação. Escolha uma imagem menor.');
   if(revision!==originalRevision)throw Error('A refeição mudou durante a preparação da foto. Tente novamente.');
   el('diet-simple-photo-preview').src='data:image/jpeg;base64,'+image;el('diet-simple-photo-preview').hidden=false;syncPhotoControls();
   notify('Analisando foto na Cloudflare…');
   const response=await root.fetch(service+'/nutrition/analyze',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.token},body:JSON.stringify({image}),credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal});
   const value=await response.json();if(response.status===422&&/^AI (?:response|food|found)/.test(String(value?.error||'')))try{await rememberAI(service);}catch{}if(!response.ok)throw Error(response.status===429?'Cota gratuita ou limite diário atingido. Use o lançamento manual.':response.status===401?'Conexão expirada. Reconecte na aba Mais.':[404,503].includes(response.status)?'A IA está indisponível neste serviço. Confira a configuração na Cloudflare.':response.status===422?({'AI response format invalid':'A IA respondeu, mas o formato da resposta não pôde ser lido.','AI food list invalid':'A IA respondeu sem uma lista válida de alimentos.','AI found no foods':'A IA não identificou alimentos nesta foto.','AI food quantities invalid':'A IA identificou itens, mas devolveu quantidades ou unidades inválidas.'}[value.error]||'A resposta da IA não pôde ser usada. Precisamos verificar o formato ou as quantidades.'):'Não foi possível analisar a foto. Use o lançamento manual.');
   if(revision!==originalRevision)throw Error('A refeição mudou durante a análise. A resposta foi descartada para preservar sua edição.');
   const proposed=C.fromAI(value,mine,catalog);invalidate();rows=proposed;render();try{await rememberAI(service);}catch{}notify(proposed.every(row=>row.food)?'Foto lida. Confira porções e nutrientes e salve a refeição.':'Foto lida. Confira os alimentos; complete os dados dos itens ainda sem nutrientes antes de salvar.');
  }catch(error){notify(error.name==='AbortError'?'A análise demorou demais. Use o lançamento manual.':error.message);}finally{clearTimeout(timer);busy=false;total();el('diet-simple-photo').value='';}
 }
 async function init(){
  if(initialized)return;initialized=true;catalog=(await root.ForjaReferences.foods()).map(food=>{const copy={...food},trace=[];for(const key of ['kcal','protein_g','carbs_g','fat_g'])if(copy[key]===null&&copy[key+'_source']==='Tr'){copy[key]=0;trace.push({protein_g:'proteína',carbs_g:'carboidratos',fat_g:'gordura',kcal:'calorias'}[key]);}if(trace.length)copy.trace_nutrients=trace;return copy;});const stored=await root.ForjaStorage.get('food-custom');if(stored){const extra=JSON.parse(stored.value);if(Array.isArray(extra))catalog.push(...extra);}
  const b=await root.ForjaStorage.get('diet-food-bindings');bindings=b?JSON.parse(b.value):{};
  const seen=new Set();for(const [key,def] of Object.entries(plan()).filter(([key])=>key!=='posTreino'))for(const items of def.items?[def.items]:(def.options||[]).map(o=>o.items))for(const item of items){const name=C.fold(item.name);if(!seen.has(name)){seen.add(name);const row=C.prefill({one:{items:[item]}},'one',0,catalog,bindings)[0];mine.push(row);}}
  const saved=await root.ForjaStorage.get('diet-recurring');if(saved){for(const r of JSON.parse(saved.value)){const food=catalog.find(f=>f.id===r.foodId)||r.food;if(food&&!catalog.some(f=>f.id===food.id))catalog.push(food);const old=mine.find(m=>C.fold(m.name)===C.fold(r.name));if(old)Object.assign(old,r,{food,recurring:true});else mine.push({...r,food,recurring:true});}}
  const recent=await root.ForjaStorage.get('diet-recent-foods');if(recent)try{for(const r of JSON.parse(recent.value)){if(!r.food)continue;const known=mine.find(m=>m.food?.id===r.food.id);if(known)Object.assign(known,r);else mine.unshift(r);if(!catalog.some(f=>f.id===r.food.id))catalog.push(r.food);}}catch{}
  const old=root.selectDietMealType;root.selectDietMealType=function(key){
   if(saving)return;
   const pending=rows.length>0||!!el('diet-simple-text').value.trim()||!!el('quick-paste')?.value.trim()||!!el('quick-description')?.value.trim()||!el('diet-simple-photo-preview').hidden;
   root.ForjaRoutineDiet?.changed();old(key);
   if(pending){invalidate();currentKey=key;render();notify('Tipo de refeição alterado. Os alimentos e valores preenchidos foram mantidos.');return Promise.resolve();}
   return root.ForjaDietFlow.loadMeal(key);
  };
  for(const [id,fn,event]of [['diet-simple-search',search,'input'],['diet-simple-all',search,'change'],['diet-simple-add',add,'click'],['diet-simple-parse',parseText,'click'],['diet-simple-save',save,'click'],['diet-custom-save',custom,'click'],['diet-simple-option',()=>loadMeal(currentKey,Number(el('diet-simple-option').value)),'change'],['diet-simple-photo',e=>analyze(e.target.files?.[0]),'change'],['diet-simple-photo-remove',clearPhoto,'click']])el(id).addEventListener(event,fn);
  for(const name of ['setDietDate','shiftDietDate','jumpToDietDate']){const old=root[name];root[name]=function(...args){if(saving)return;loadGeneration++;invalidate();rows=[];currentKey=null;old(...args);render();};}
  el('food-search').closest('details').hidden=true;
  for(const id of ['diet-photo-label','diet-label-label','diet-photo-note','diet-input']){const n=el(id);if(n)n.hidden=true;}
  el('diet-input').previousElementSibling.hidden=true;document.querySelector('[onclick="estimateDietCalories()"]') .hidden=true;
  el('diet-meal-type-grid').parentElement.querySelector('.calc-formula-note').textContent='Escolha a refeição e registre qualquer alimento. O cardápio é apenas um atalho opcional.';
  renderMealTypeButtons();search();render();syncPhotoControls();await refreshAIStatus();
 }
 async function activateAI(){
  const configured=await root.ForjaStorage.get('strava-service-url');let currentService='';try{if(configured)currentService=root.ForjaStrava.validateServiceUrl(configured.value);}catch{}
  if(currentService&&await aiActivation(currentService)){await refreshAIStatus();notify('IA já ativada. Escolha uma foto para analisar.');return;}
  if(!el('diet-ai-license').checked){notify('Confirme a leitura e o aceite dos termos do modelo para ativar.');return;}
  const u=await root.ForjaStorage.get('strava-service-url'),s=await root.ForjaStorage.get('strava-session');let session;try{session=s?JSON.parse(s.value):null;}catch{}
  if(!u||!session?.token||session.pending){notify('Conecte este aparelho na área Strava antes de ativar a IA.');return;}
  const button=el('diet-ai-activate');button.disabled=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),50000);
  try{const service=root.ForjaStrava.validateServiceUrl(u.value),r=await root.fetch(service+'/nutrition/activate',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+session.token},body:JSON.stringify({acceptLicense:true}),credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal});if(!r.ok)throw Error(r.status===429?'Limite de ativação atingido. Se a análise já funcionou, escolha a foto diretamente.':'Não foi possível ativar o modelo. Confira a conexão e tente novamente.');const data=await r.json();if(data.activated!==true)throw Error('Ativação não confirmada.');await rememberAI(service);notify('Modelo ativado. Escolha uma foto para testar e revise as porções.');}catch(error){notify(error.name==='AbortError'?'A ativação demorou demais. Tente novamente.':error.message);}finally{clearTimeout(timer);button.disabled=false;}
 }
 root.ForjaDietFlow={init,showMethod,loadMeal,add,parseText,save,custom,analyze,clearPhoto,activateAI,refreshAIStatus,search,chooseReference,startEmpty,openCustom,getRows:()=>rows,getState:()=>({date:selectedDietDate,meal:dietSelectedMealType,rows:JSON.parse(JSON.stringify(rows)),text:el('diet-simple-text').value,photo:el('diet-simple-photo-preview').hidden?'':el('diet-simple-photo-preview').getAttribute('src')}),restoreState(state){invalidate();rows=state.rows||[];el('diet-simple-text').value=state.text||'';const pic=el('diet-simple-photo-preview');pic.hidden=!state.photo;if(state.photo)pic.src=state.photo;else pic.removeAttribute('src');syncPhotoControls();render();},appendRows(items){invalidate();rows.push(...items);render();notify('Adicionado. Confira a quantidade e o total antes de salvar.');},resetRows(items){invalidate();rows=items;render();notify('Refeição preparada para revisão. Ainda não foi salva.');}};
})(globalThis);
