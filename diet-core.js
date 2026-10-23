(function(root){
 'use strict';
 const keys=['kcal','protein_g','carbs_g','fat_g'];
 const fold=v=>String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const aliases={'arroz branco cozido':'taco-3','pao frances':'taco-53','queijo mussarela':'taco-463','queijo mucarela':'taco-463','peito de frango grelhado':'taco-410','frango desfiado':'taco-408','patinho cru':'taco-376','leite integral em po':'taco-459','mel':'taco-507','fermento quimico em po':'taco-513'};
 function complete(f){return !!f&&typeof f.kcal==='number'&&Number.isFinite(f.kcal)&&f.kcal>=0&&keys.slice(1).every(k=>f[k]==null||(typeof f[k]==='number'&&Number.isFinite(f[k])&&f[k]>=0));}
 function resolve(name,mine,catalog){
  const query=fold(name),exact=mine.filter(r=>fold(r.name)===query);
  if(exact.length===1)return exact[0];
  const candidates=mine.filter(r=>fold(r.name).includes(query));
  if(query&&candidates.length===1)return candidates[0];
  const id=aliases[query],food=catalog.find(f=>id?f.id===id:fold(f.name)===query);
  return food?{name,food,unit:food.unit||'g',quantity:null}:null;
 }
 function amount(qty){const raw=String(qty||'');const parent=raw.match(/\(([\d.,]+)\s*(g|ml)\)/i),simple=raw.match(/([\d.,]+)\s*(g|ml)\b/i),m=parent||simple;return {quantity:m?Number(m[1].replace(',','.')):null,unit:m?m[2].toLowerCase():'g',planQuantity:raw};}
 function prefill(plan,key,index,catalog,bindings){
  const def=plan[key];if(!def)return [];
  const items=def.options?def.options[index]?.items:def.items;if(!items)return [];
  return items.map(item=>{const row={name:item.name,...amount(item.qty)},binding=bindings[fold(item.name)],food=catalog.find(f=>f.id===(binding||aliases[fold(item.name)]));return {...row,food:food&&(food.unit||'g')===row.unit?food:null};});
 }
 function totals(rows){
  if(!rows.length)throw Error('Adicione pelo menos um alimento.');
  const items=rows.map(row=>{
   if(!complete(row.food))throw Error('Complete os dados de '+row.name+' no botão abaixo do alimento.');
   if((row.food.unit||'g')!==row.unit)throw Error('Confira a unidade de '+row.name+'. Não convertemos ml em gramas automaticamente.');
   if(typeof row.quantity!=='number'||!Number.isFinite(row.quantity)||row.quantity<=0)throw Error('Informe a quantidade de '+row.name+'.');
   const item={name:row.name,reference_name:row.food.name,foodId:row.food.id,quantity:row.quantity,unit:row.unit,source:row.food.source||'TACO 4ª edição (NEPA/UNICAMP, 2011)',source_page:row.food.source_page};
   if(row.unit==='g')item.quantity_g=row.quantity;
   for(const k of keys)item[k]=row.food[k]==null?null:Math.round(row.food[k]*row.quantity/100*10)/10;
   if(row.food.trace_nutrients)item.trace_nutrients=row.food.trace_nutrients;
   return item;
  });
  const result={items,description:items.map(i=>i.name+' — '+i.quantity+' '+i.unit).join('; '),note:'Estimativa pela composição de referência e quantidade consumida.'};
  for(const k of keys)result[k]=items.some(i=>i[k]==null)?null:Math.round(items.reduce((s,i)=>s+i[k],0)*10)/10;
  return result;
 }
 function parse(value,mine,catalog){
  const parts=String(value).replace(/(\d),(\d)/g,'$1.$2').split(/[;\n,]+/).map(s=>s.trim()).filter(Boolean);
  if(!parts.length)throw Error('Escreva os alimentos da refeição.');
  if(parts.length>30)throw Error('Use até 30 alimentos por refeição.');
  return parts.map(part=>{const m=part.match(/(\d+(?:\.\d+)?)\s*(g|gramas?|ml)\b/i),name=part.replace(/\d+(?:\.\d+)?\s*(?:g|gramas?|ml)\b/i,'').replace(/^de\s+/i,'').trim();const known=resolve(name,mine,catalog);return {name,food:known?.food||null,quantity:m?Number(m[1]):known?.quantity??null,unit:m?(m[2].toLowerCase()==='ml'?'ml':'g'):known?.unit||'g',suggested:!m};});
 }
 function fromAI(value,mine,catalog){
  if(!value||!Array.isArray(value.items)||!value.items.length||value.items.length>30)throw Error('A IA não retornou uma lista válida de alimentos.');
  return value.items.map(item=>{
   if(typeof item.name!=='string'||!item.name.trim()||item.name.length>160)throw Error('Nome de alimento inválido.');
   if(typeof item.quantity!=='number'||!Number.isFinite(item.quantity)||item.quantity<=0||item.quantity>10000||!['g','ml'].includes(item.unit))throw Error('A IA não retornou uma quantidade válida.');
   const known=resolve(item.name,mine,catalog),reference=known?.food&&(known.food.unit||'g')===item.unit?known.food:null;
   const nutrients=item.nutrients,valid=nutrients&&['kcal','carbs_g','protein_g','fat_g'].every(key=>typeof nutrients[key]==='number'&&Number.isFinite(nutrients[key])&&nutrients[key]>=0&&nutrients[key]<=(key==='kcal'?900:100));
   const estimate=valid?{id:'ai-'+Math.random().toString(36).slice(2),name:item.name,unit:item.unit,source:'Estimativa visual por IA — confira antes de salvar',kcal:nutrients.kcal,carbs_g:nutrients.carbs_g,protein_g:nutrients.protein_g,fat_g:nutrients.fat_g}:null;
   return {name:item.name,quantity:item.quantity,unit:item.unit,food:estimate||reference,suggested:true};
  });
 }
 root.ForjaDietCore={fold,complete,resolve,amount,prefill,totals,parse,fromAI};
})(globalThis);
