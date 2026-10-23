(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.ForjaNutritionMemory=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';const KEY='nutrition-corrections-v1',fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 function identity(item={}){if(item.barcode)return`barcode:${String(item.barcode).replace(/\D/g,'')}`;return`food:${fold(item.name)}:${fold(item.preparation)}:${fold(item.unit||'g')}`;}
 function remember(records,item){const id=identity(item),next=(Array.isArray(records)?records:[]).filter(row=>row.id!==id);next.unshift({id,...item,source:'user',updatedAt:new Date().toISOString()});return next.slice(0,500);}
 function suggest(records,item){const id=identity(item);return(Array.isArray(records)?records:[]).find(row=>row.id===id)||null;}
 function plausibilityWarnings(totals={},portion){const warnings=[],k=Number(totals.kcal),c=Number(totals.carbs),p=Number(totals.protein),f=Number(totals.fat),q=Number(portion);if(!Number.isFinite(q)||q<=0)warnings.push('Confira a porção.');if([k,c,p,f].some(v=>Number.isFinite(v)&&v<0))warnings.push('Valores negativos não são válidos.');if([k,c,p,f].every(Number.isFinite)){const expected=c*4+p*4+f*9;if(Math.abs(k-expected)>Math.max(80,expected*.35))warnings.push('As calorias estão distantes do valor calculado pelos macronutrientes.');}if(Number.isFinite(k)&&Number.isFinite(q)&&q>0&&k/q*100>1000)warnings.push('Calorias muito altas para a porção informada.');return warnings;}
 async function load(){try{const r=await(root.ForjaStorage||root.storage).get(KEY);return r?.value?JSON.parse(r.value):[];}catch{return[];}}
 async function saveCorrection(item){const next=remember(await load(),item);await(root.ForjaStorage||root.storage).set(KEY,JSON.stringify(next));return next;}
 return{KEY,identity,remember,suggest,plausibilityWarnings,load,saveCorrection};
});
