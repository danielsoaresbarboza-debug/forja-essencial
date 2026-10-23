(function(root){
 'use strict';
 const keys=['kcal','protein_g','carbs_g','fat_g'];
 const round=v=>Math.round((v+Number.EPSILON)*10)/10;
 function positive(value,label){if(value===null||value===undefined||String(value).trim()===''||!Number.isFinite(Number(value))||Number(value)<=0)throw Error('Informe '+label+' maior que zero.');return Number(value);}
 function food(reference,grams){
  grams=positive(grams,'a quantidade em gramas');
  if(!reference||keys.some(k=>typeof reference[k]!=='number'||!Number.isFinite(reference[k])||reference[k]<0))throw Error('Este alimento tem dados incompletos. Use os valores do rótulo ou cadastre os valores manualmente.');
  const result={foodId:reference.id,name:reference.name,quantity_g:grams,source:reference.source||'TACO 4ª edição (NEPA/UNICAMP, 2011)',source_page:reference.source_page};
  for(const key of keys)result[key]=round(reference[key]*grams/100);
  return result;
 }
 function meal(rows){
  if(!Array.isArray(rows)||!rows.length)throw Error('Adicione pelo menos um alimento.');
  const items=rows.map(row=>food(row.food,row.grams)),result={items,description:items.map(i=>i.name+' — '+i.quantity_g+' g').join('; '),note:'Estimativa por alimento e quantidade, com revisão antes de salvar.'};
  for(const key of keys)result[key]=round(items.reduce((sum,item)=>sum+item[key],0));
  return result;
 }
 function activity(reference,weightKg,minutes){
  weightKg=positive(weightKg,'o peso em kg');minutes=positive(minutes,'a duração em minutos');
  if(!reference||typeof reference.met!=='number'||!Number.isFinite(reference.met)||reference.met<1)throw Error('Escolha uma referência de atividade válida.');
  return {totalKcal:Math.round(reference.met*weightKg*minutes/60),activeKcal:Math.round((reference.met-1)*weightKg*minutes/60),met:reference.met,weightKg,minutes,reference:reference.name,code:reference.code,source:root.ForjaActivityData.source};
 }
 root.ForjaEstimates={food,meal,activity};
})(globalThis);
