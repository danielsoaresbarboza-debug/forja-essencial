(function(root,factory){
  const api=factory(root);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.ForjaCreatine=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const STORAGE_KEY='creatine-days-v1';
  const LABELS=['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'];

  function parseLocalDate(value){
    if(value instanceof Date)return new Date(value.getFullYear(),value.getMonth(),value.getDate(),12);
    const match=String(value||'').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!match)return new Date(NaN);
    return new Date(Number(match[1]),Number(match[2])-1,Number(match[3]),12);
  }
  function dateKey(value){
    const date=value instanceof Date?value:parseLocalDate(value);
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function addDays(value,amount){
    const date=parseLocalDate(value);
    date.setDate(date.getDate()+amount);
    return date;
  }
  function weekDates(reference){
    const date=parseLocalDate(reference);
    const weekday=date.getDay();
    const monday=addDays(date,weekday===0?-6:1-weekday);
    return Array.from({length:7},(_,index)=>dateKey(addDays(monday,index)));
  }
  function normalizeRecords(records){
    return [...new Set((Array.isArray(records)?records:[]).filter(value=>/^\d{4}-\d{2}-\d{2}$/.test(value)))].sort();
  }
  function weekState(records,today=dateKey(new Date())){
    const normalized=normalizeRecords(records);
    const selected=new Set(normalized);
    const days=weekDates(today).map((date,index)=>({
      date,
      label:LABELS[index],
      day:Number(date.slice(-2)),
      checked:selected.has(date),
      isToday:date===today,
      isFuture:date>today
    }));
    return {days,completed:days.filter(day=>day.checked).length,total:7,records:normalized};
  }
  function toggleDate(records,date,today=dateKey(new Date())){
    const normalized=normalizeRecords(records);
    if(!weekDates(today).includes(date)||date>today)return normalized;
    const selected=new Set(normalized);
    if(selected.has(date))selected.delete(date);else selected.add(date);
    return [...selected].sort();
  }
  async function load(){
    try{
      const stored=await root.storage?.get(STORAGE_KEY);
      return normalizeRecords(stored?.value?JSON.parse(stored.value):[]);
    }catch(error){return [];}
  }
  async function save(records){
    if(!root.storage?.set)return false;
    await root.storage.set(STORAGE_KEY,JSON.stringify(normalizeRecords(records)));
    return true;
  }
  async function render(reference){
    const list=root.document?.getElementById('creatine-week-days');
    if(!list)return;
    const today=reference||dateKey(new Date());
    const records=await load();
    const state=weekState(records,today);
    list.replaceChildren();
    state.days.forEach(day=>{
      const button=root.document.createElement('button');
      button.type='button';
      button.className=`creatine-day${day.checked?' checked':''}${day.isToday?' today':''}`;
      button.disabled=day.isFuture;
      button.setAttribute('aria-pressed',String(day.checked));
      button.setAttribute('aria-label',`${day.label}, dia ${day.day}: ${day.checked?'creatina tomada':'não marcada'}`);
      button.innerHTML=`<span>${day.label}</span><strong>${day.checked?'✓':day.day}</strong>`;
      button.addEventListener('click',async()=>{
        const next=toggleDate(await load(),day.date,today);
        await save(next);
        await render(today);
        if(typeof root.showToast==='function')root.showToast(next.includes(day.date)?'Creatina marcada para este dia.':'Marcação de creatina removida.');
      });
      list.append(button);
    });
    const progress=root.document.getElementById('creatine-week-progress');
    if(progress)progress.textContent=`${state.completed} de 7 dias`;
    const message=root.document.getElementById('creatine-week-message');
    if(message)message.textContent=state.completed===7?'Semana completa!':state.days.find(day=>day.isToday)?.checked?'Creatina de hoje registrada.':'Toque no dia para registrar sua creatina.';
    const card=root.document.getElementById('creatine-week-card');
    if(card)card.dataset.complete=state.completed===7?'true':'false';
  }

  return {STORAGE_KEY,dateKey,weekDates,weekState,toggleDate,render};
});
