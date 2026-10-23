(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.ForjaDashboardLayout=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const KEY='dashboard-layout-v1',INDICATORS='indicadores';
 const STATS=['sequencia','agua-sequencia','agua','peso','treinos','saldo','gasto-ativo','ingestao','repouso','passos','gasto-total','dieta-dias'];
 const SECTIONS=['creatina','custom-week-cards','meta-semanal','atalhos','resumo-semanal','comparacao-semanal','atualizar'];
 const BLOCKS=[INDICATORS,...SECTIONS],CARDS=[...STATS,...SECTIONS],ESSENTIAL=['atualizar'];
 const LABELS={indicadores:'Indicadores pequenos',sequencia:'Sequência de hábitos','agua-sequencia':'Sequência de água',agua:'Água hoje',peso:'Peso',treinos:'Treinos no mês',saldo:'Saldo calórico','gasto-ativo':'Gasto em exercício',ingestao:'Ingestão hoje',repouso:'Calorias de repouso',passos:'Passos','gasto-total':'Gasto total','dieta-dias':'Dias com dieta concluída',creatina:'Creatina','custom-week-cards':'Meus cartões semanais','meta-semanal':'Meta semanal',atalhos:'Atalhos do dia','resumo-semanal':'Balanço calórico semanal','comparacao-semanal':'Comparação semanal',atualizar:'Botão Atualizar'};
 function normalize(value={}){
  const previous=[...new Set((Array.isArray(value.order)?value.order:[]).filter(id=>CARDS.includes(id)||id===INDICATORS))];
  const stats=[...previous.filter(id=>STATS.includes(id)),...STATS.filter(id=>!previous.includes(id))];
  const blocks=previous.filter(id=>BLOCKS.includes(id));
  if(!blocks.includes(INDICATORS))blocks.splice(Math.min(2,blocks.length),0,INDICATORS);
  blocks.push(...BLOCKS.filter(id=>!blocks.includes(id)));
  const hidden=[...new Set((Array.isArray(value.hidden)?value.hidden:[]).filter(id=>CARDS.includes(id)&&!ESSENTIAL.includes(id)))];
  if(hidden.includes('resumo-semanal')&&!hidden.includes('comparacao-semanal')&&!previous.includes('comparacao-semanal'))hidden.push('comparacao-semanal');
  return {order:[...stats,...blocks],hidden};
 }
 function move(value,id,direction){
  const next=normalize(value),group=STATS.includes(id)?STATS:BLOCKS;
  if(!group.includes(id))return next;
  const ordered=next.order.filter(card=>group.includes(card)),index=ordered.indexOf(id),other=ordered[index+direction];
  if(index<0||!other)return next;
  const a=next.order.indexOf(id),b=next.order.indexOf(other);[next.order[a],next.order[b]]=[next.order[b],next.order[a]];return next;
 }
 async function load(){try{const r=await(root.ForjaStorage||root.storage).get(KEY);return normalize(r?.value?JSON.parse(r.value):{});}catch{return normalize({});}}
 async function save(value){const next=normalize(value);await(root.ForjaStorage||root.storage).set(KEY,JSON.stringify(next));return next;}
 async function apply(){
  const value=await load(),doc=root.document;if(!doc)return value;
  doc.querySelectorAll('[data-home-card]').forEach(node=>{node.hidden=value.hidden.includes(node.dataset.homeCard);});
  const grid=doc.querySelector('.dash-stat-grid');if(grid)for(const id of value.order.filter(card=>STATS.includes(card))){const node=grid.querySelector(`[data-home-card="${id}"]`);if(node)grid.append(node);}
  const home=doc.getElementById('tab-inicio'),anchor=doc.getElementById('quote-card');
  if(home&&anchor){let previous=anchor;for(const id of value.order.filter(card=>BLOCKS.includes(card))){const node=id===INDICATORS?doc.getElementById('home-small-indicators'):home.querySelector(`[data-home-card="${id}"]`);if(node){previous.after(node);previous=node;}}}
  return value;
 }
 async function renderSettings(){
  const area=root.document?.getElementById('dashboard-layout-list');if(!area)return;
  const value=await load();area.replaceChildren();
  for(const [title,group] of [['Ordem dos blocos',BLOCKS],['Dentro de indicadores pequenos',STATS]]){
   const heading=root.document.createElement('h3');heading.className='layout-group-title';heading.textContent=title;area.append(heading);
   const ids=value.order.filter(id=>group.includes(id));
   for(const [index,id] of ids.entries()){
    const row=root.document.createElement('div');row.className='layout-setting-row';
    const label=root.document.createElement('label');label.className='visibility-switch';
    const caption=root.document.createElement('span');caption.textContent=LABELS[id];label.append(caption);
    if(id!==INDICATORS){
     const input=root.document.createElement('input');input.type='checkbox';input.checked=!value.hidden.includes(id);input.disabled=ESSENTIAL.includes(id);input.setAttribute('aria-label',`Mostrar ${LABELS[id]}`);
     const track=root.document.createElement('span');track.className='switch-track';track.setAttribute('aria-hidden','true');label.append(input,track);
     input.onchange=async()=>{const fresh=await load();fresh.hidden=input.checked?fresh.hidden.filter(card=>card!==id):[...fresh.hidden,id];await save(fresh);await apply();};
    }else{label.classList.add('layout-group-marker');}
    const buttons=root.document.createElement('div');buttons.className='layout-order-buttons';
    for(const [direction,symbol,word] of [[-1,'↑','cima'],[1,'↓','baixo']]){const button=root.document.createElement('button');button.type='button';button.textContent=symbol;button.setAttribute('aria-label',`Mover ${LABELS[id]} para ${word}`);button.disabled=direction<0?index===0:index===ids.length-1;button.onclick=async()=>{await save(move(await load(),id,direction));await renderSettings();await apply();};buttons.append(button);}
    row.append(label,buttons);area.append(row);
   }
  }
 }
 return{KEY,CARDS,STATS,SECTIONS,BLOCKS,INDICATORS,normalize,move,load,save,apply,renderSettings};
});
