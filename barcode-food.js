(function(root){
 'use strict';
 const el=id=>document.getElementById(id),keys=['kcal','protein_g','carbs_g','fat_g'];
 const number=v=>v==null||v===''||!Number.isFinite(Number(v))||Number(v)<0?null:Number(v);
 let chosen=null,busy=false,lastRequest=0;
 function product(p,barcode){
  const n=p?.nutriments||{},kj=number(n['energy-kj_100g']);
  const kcal=number(n['energy-kcal_100g'])??(kj==null?null:Math.round(kj/4.184*10)/10);
  if(!p?.product_name||kcal==null)throw Error('Produto sem nome ou calorias na base. Informe os dados do rótulo manualmente.');
  return {id:'off-'+barcode,name:p.product_name+(p.brands?' · '+p.brands:''),barcode,kcal,protein_g:number(n.proteins_100g),carbs_g:number(n.carbohydrates_100g),fat_g:number(n.fat_100g),source:'Open Food Facts (ODbL)',url:'https://world.openfoodfacts.org/product/'+barcode};
 }
 function code(value){const c=String(value).replace(/\s/g,'');if(!/^\d{8}$|^\d{12,14}$/.test(c))throw Error('Digite os 8, 12, 13 ou 14 números do código de barras.');return c.length===12?'0'+c:c;}
 function message(text){el('barcode-status').textContent=text;}
 function showProduct(){el('barcode-name').value=chosen.name;keys.forEach(k=>el('barcode-'+k).value=chosen[k]??'');el('barcode-quantity').value='100';el('barcode-review').hidden=false;el('barcode-refresh').hidden=false;}
 async function lookup(refresh=false){
  if(busy)return;busy=true;el('barcode-lookup').disabled=true;chosen=null;el('barcode-review').hidden=true;
  let cached=null;
  try{
   const c=code(el('barcode-number').value);cached=await root.ForjaStorage.get('off-product-'+c);
   if(cached&&!refresh){chosen=JSON.parse(cached.value);message('Produto guardado neste aparelho. Confira com a embalagem atual.');}
   else{
    if(Date.now()-lastRequest<5000)throw Error('Aguarde alguns segundos antes de outra consulta.');lastRequest=Date.now();
    message('Consultando Open Food Facts…');const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
    try{const url='https://world.openfoodfacts.org/api/v2/product/'+c+'.json?fields=product_name,brands,nutriments&app_name=ForjaTreino&app_version=1.7&app_platform=Web';let response;const http=root.Capacitor?.Plugins?.CapacitorHttp;if(http){const result=await http.get({url,headers:{'Accept':'application/json','User-Agent':'ForjaTreino/1.7'},connectTimeout:15000,readTimeout:15000,responseType:'json'});response={ok:result.status>=200&&result.status<300,json:async()=>typeof result.data==='string'?JSON.parse(result.data):result.data};}else response=await root.fetch(url,{signal:controller.signal,credentials:'omit',headers:{'Accept':'application/json'}});if(!response.ok)throw Error('Consulta indisponível. Você pode informar o rótulo manualmente.');const data=await response.json();if(data.status!==1)throw Error('Produto não encontrado. Cadastre pelo rótulo; ele ficará salvo para a próxima vez.');chosen=product(data.product,c);const previous=cached?JSON.parse(cached.value):null;if(previous?.correctedAt)chosen={...chosen,...Object.fromEntries(['name','kcal','protein_g','carbs_g','fat_g','unit','correctedAt'].map(k=>[k,previous[k]])),source:'Open Food Facts · correção local preservada'};await root.ForjaStorage.set('off-product-'+c,JSON.stringify({...chosen,cachedAt:new Date().toISOString()}));message(previous?.correctedAt?'Consulta atualizada; sua correção foi preservada. Confira a embalagem.':'Produto encontrado. Confira os valores por 100 g ou 100 ml e a porção consumida.');}finally{clearTimeout(timer);}
   }
   showProduct();
  }catch(e){if(cached){chosen=JSON.parse(cached.value);showProduct();message('Sem atualização online. Mantivemos o produto guardado neste aparelho; confira a embalagem.');}else message(e.name==='AbortError'?'A consulta demorou. Digite os nutrientes do rótulo ou tente novamente.':e.message);}finally{busy=false;el('barcode-lookup').disabled=false;}
 }
 async function add(){try{if(!chosen)throw Error('Busque um produto primeiro.');if(!root.ForjaDietFlow.getState().meal)throw Error('Escolha a refeição primeiro.');const quantity=Number(el('barcode-quantity').value),unit=el('barcode-unit').value;if(!Number.isFinite(quantity)||quantity<=0)throw Error('Informe a quantidade consumida.');const food={...chosen,name:el('barcode-name').value.trim(),unit};keys.forEach(k=>{const raw=el('barcode-'+k).value.trim();food[k]=raw===''?null:Number(raw);});root.ForjaNutrition.validate({...food,description:food.name});chosen={...food,source:food.source+' · conferido pelo usuário',correctedAt:new Date().toISOString()};if(chosen.barcode)await root.ForjaStorage.set('off-product-'+chosen.barcode,JSON.stringify(chosen));root.ForjaDietFlow.appendRows([{name:food.name,food,quantity,unit}]);el('barcode-panel').open=false;message('Produto adicionado. A correção ficou guardada para a próxima leitura.');}catch(e){message(e.message);}}
 async function scan(){const p=root.Capacitor?.Plugins?.FoodBarcode;if(!p){message('O leitor de câmera fica no aplicativo Android. Nesta prévia, digite o código da embalagem.');return;}try{message('Abrindo câmera para ler o código…');const r=await p.scan();if(r.cancelled){message('Leitura cancelada.');return;}el('barcode-number').value=r.code;await lookup();}catch(e){message('Não foi possível abrir o leitor. Verifique o Google Play Services ou digite o código.');}}
 root.ForjaBarcode={product,code,lookup,refresh:()=>lookup(true),scan,add};
})(globalThis);
