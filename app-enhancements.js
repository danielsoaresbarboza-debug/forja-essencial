(function(root,factory){
  const api=factory(root||{});
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.ForjaEnhancements=api;
})(typeof window!=='undefined'?window:globalThis,function(root){
  'use strict';
  const OPTIONAL_TABS=['corrida','natacao','crossfit','academia','biblioteca','recompensas','relatorios','progresso','corpo','agua','dieta','cardapio','importar'];
  const ALL_TABS=['inicio',...OPTIONAL_TABS,'mais'];
  const STORAGE_KEY='visible-tabs-v1';
  function normalizeVisibleTabs(value){
    const out={inicio:true,mais:true};
    OPTIONAL_TABS.forEach(tab=>{out[tab]=!value||value[tab]!==false;});
    return out;
  }
  function localDateKey(date){
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function weekDates(dateKey){
    const [y,m,d]=String(dateKey).split('-').map(Number);
    const cursor=new Date(y,m-1,d,12);
    const mondayOffset=(cursor.getDay()+6)%7;
    cursor.setDate(cursor.getDate()-mondayOffset);
    return Array.from({length:7},(_,i)=>{const day=new Date(cursor);day.setDate(cursor.getDate()+i);return localDateKey(day);});
  }
  function balanceTone(value){return value<0?'red':value<100||value>=1000?'orange':'green';}
  function dailyEnergyBalance(day){
    const eaten=Number(day.eaten)||0,totalBurn=Number(day.totalBurn)||0;
    if(totalBurn>0)return {balance:Math.round(totalBurn-eaten),source:'garmin'};
    return {balance:null,source:'unavailable'};
  }
  function energyIsComplete(date,syncedAt){const end=new Date(date+'T00:00:00');end.setDate(end.getDate()+1);return date<localDateKey(new Date())&&Number.isFinite(Date.parse(syncedAt))&&Date.parse(syncedAt)>=end.getTime();}
  function summarizeWeek(days){
    const logged=days.filter(day=>day&&day.hasEntries);
    const closed=logged.filter(day=>day.complete);
    const measured=closed.filter(day=>Number(day.totalBurn)>0&&day.energyComplete!==false);
    const eaten=Math.round(logged.reduce((sum,day)=>sum+(Number(day.eaten)||0),0));
    const exercise=Math.round(logged.reduce((sum,day)=>sum+(Number(day.exercise)||0),0));
    const balance=measured.length?Math.round(measured.reduce((sum,day)=>sum+dailyEnergyBalance(day).balance,0)):null;
    const goalBalance=Math.round(closed.reduce((sum,day)=>sum+(Number(day.goal)||0)-(Number(day.eaten)||0),0));
    return {balance,eaten,exercise,loggedDays:logged.length,closedDays:closed.length,measuredDays:measured.length,partialDays:logged.length-closed.length,goalBalance,tone:balance==null?'empty':balanceTone(balance/measured.length)};
  }
  let visible=normalizeVisibleTabs();
  function applyVisibleTabs(){
    if(!root.document)return;
    root.document.querySelectorAll('.tab[data-tab]').forEach(button=>{
      const tab=button.dataset.tab;
      button.hidden=visible[tab]===false;
      button.setAttribute('aria-hidden',visible[tab]===false?'true':'false');
    });
  }
  function renderVisibleTabs(){
    const list=root.document&&root.document.getElementById('visible-tabs-list');
    if(!list)return;
    list.innerHTML=OPTIONAL_TABS.map(tab=>{
      const button=root.document.querySelector(`.tab[data-tab="${tab}"]`);
      const label=(button?button.textContent:tab).trim();
      return `<label class="visibility-switch"><span>${label}</span><input type="checkbox" data-visible-tab="${tab}" ${visible[tab]?'checked':''}><span class="switch-track" aria-hidden="true"></span></label>`;
    }).join('');
    list.querySelectorAll('[data-visible-tab]').forEach(input=>input.addEventListener('change',()=>setTabVisible(input.dataset.visibleTab,input.checked)));
  }
  async function setTabVisible(tab,isVisible){
    if(!OPTIONAL_TABS.includes(tab))return;
    visible[tab]=Boolean(isVisible);
    applyVisibleTabs();
    if(root.document.querySelector(`.tab[data-tab="${tab}"]`)?.classList.contains('active')&&!visible[tab]&&typeof root.switchTab==='function')root.switchTab('inicio');
    await root.ForjaStorage?.set(STORAGE_KEY,JSON.stringify(visible));
  }
  async function renderWeeklyBalance(dateKey){
    // Saldo da semana = meta do dia (gasto do corpo + atividades − déficit) − o que foi comido, só em dias com refeições.
    const card=root.document&&root.document.getElementById('weekly-calorie-card');
    if(!card||typeof root.computeDietDaySummary!=='function')return;
    const days=[],range=weekDates(dateKey||localDateKey(new Date())),hoje=localDateKey(new Date());
    for(const date of range){
      const s=await root.computeDietDaySummary(date);
      days.push({date,eaten:Math.round(s.comido||0),exercise:Math.round(s.exercicio||0),goal:s.goal?Math.round(s.goal):null,hasEntries:s.entryCount>0,today:date===hoje,future:date>hoje});
    }
    const contam=days.filter(d=>d.hasEntries&&d.goal&&!d.today);
    const saldo=contam.reduce((t,d)=>t+d.goal-d.eaten,0);
    const value=root.document.getElementById('weekly-calorie-value'),detail=root.document.getElementById('weekly-calorie-detail');
    card.dataset.tone=!contam.length?'empty':saldo<0?'red':'green';
    value.textContent=contam.length?`${saldo>=0?saldo.toLocaleString('pt-BR')+' kcal abaixo':Math.abs(saldo).toLocaleString('pt-BR')+' kcal acima'} da meta`:'Sem dias completos ainda';
    detail.textContent=contam.length?`${contam.length} dia${contam.length>1?'s':''} completo${contam.length>1?'s':''} na semana (hoje entra amanhã). ≈ ${(Math.abs(saldo)/7700).toLocaleString('pt-BR',{maximumFractionDigits:2})} kg ${saldo>=0?'a menos':'a mais'} no ritmo da meta.`:'Lance as refeições do dia; ele entra no saldo no dia seguinte.';
    const $=id=>root.document.getElementById(id);
    if($('weekly-range'))$('weekly-range').textContent=`${range[0].split('-').reverse().join('/')} a ${range[6].split('-').reverse().join('/')} · segunda a domingo`;
    if($('weekly-goal'))$('weekly-goal').textContent='';
    if($('weekly-days')){$('weekly-days').replaceChildren();days.filter(d=>!d.future).forEach(d=>{
      const line=root.document.createElement('p');line.className='wk-dia';
      const dif=d.goal?d.goal-d.eaten:null;
      line.innerHTML=`<b>${d.date.split('-').reverse().slice(0,2).join('/')}</b><span>${!d.hasEntries?'sem refeições':`comeu ${d.eaten.toLocaleString('pt-BR')}${d.goal?' de '+d.goal.toLocaleString('pt-BR'):''} kcal`}${d.exercise?` · atividade ${d.exercise.toLocaleString('pt-BR')}`:''}</span><em class="${dif==null||!d.hasEntries?'':dif<0?'acima':'ok'}">${!d.hasEntries||dif==null?'—':(dif>=0?'−':'+')+Math.abs(dif).toLocaleString('pt-BR')}${d.today?' (hoje)':''}</em>`;
      $('weekly-days').append(line);
    });}
  }
  async function closedDays(){try{const r=await root.ForjaStorage?.get('diet-closed-days');return r?JSON.parse(r.value):{};}catch{return {};}}
  async function reopenDay(date){const closed=await closedDays();if(closed[date]){delete closed[date];await root.ForjaStorage.set('diet-closed-days',JSON.stringify(closed));}}
  async function renderDayClose(date){const area=root.document?.getElementById('diet-day-close');if(!area)return;const closed=await closedDays(),summary=await root.computeDietDaySummary(date);area.replaceChildren();const p=root.document.createElement('p');p.textContent=closed[date]?'Lançamentos deste dia concluídos. Uma nova refeição ou edição reabre o dia.':'Já registrou tudo o que comeu neste dia? Conclua para incluir na semana.';area.append(p);const b=root.document.createElement('button');b.className='dica-add-btn';b.type='button';b.disabled=!summary.entryCount||date>localDateKey(new Date());b.textContent=closed[date]?'Reabrir dia':'Concluir lançamentos do dia';b.onclick=async()=>{const fresh=await closedDays();if(fresh[date])delete fresh[date];else fresh[date]=new Date().toISOString();await root.ForjaStorage.set('diet-closed-days',JSON.stringify(fresh));await renderDayClose(date);await renderWeeklyBalance(date);};area.append(b);}
  async function addWater(){try{await root.quickAddWater(200,root.todayKey());}catch{root.showToast('Não foi possível registrar a água. Tente novamente.');}}
  async function openTab(tab){if(visible[tab]===false){await setTabVisible(tab,true);renderVisibleTabs();}root.switchTab(tab);}
  async function refreshAll(){
    const button=root.document?.getElementById('home-refresh'),status=root.document?.getElementById('home-refresh-status');
    if(button){button.disabled=true;button.setAttribute('aria-busy','true');}
    if(status)status.textContent='Atualizando Strava e resumos…';
    const integrations=await Promise.allSettled([
      root.ForjaStravaUI?.sync?.(true)??Promise.resolve(false)
    ]);
    await root.renderDashboard?.();await root.renderDietTab?.();await renderWeeklyBalance();
    const partial=integrations.some(r=>r.status==='rejected');
    if(status)status.textContent=partial?'Atualização concluída parcialmente. Os dados anteriores foram preservados.':'Informações atualizadas.';
    if(button){button.disabled=false;button.removeAttribute('aria-busy');}
    return {updated:true,partial};
  }
  async function init(){
    try{const stored=await root.ForjaStorage?.get(STORAGE_KEY);if(stored?.value)visible=normalizeVisibleTabs(JSON.parse(stored.value));}catch(e){visible=normalizeVisibleTabs();}
    applyVisibleTabs();renderVisibleTabs();await renderWeeklyBalance();await root.ForjaDashboardLayout?.renderSettings?.();await root.ForjaDashboardLayout?.apply?.();await root.ForjaSyncCenter?.render?.();
  }
  return {normalizeVisibleTabs,weekDates,balanceTone,dailyEnergyBalance,summarizeWeek,renderWeeklyBalance,setTabVisible,init,ALL_TABS,reopenDay,renderDayClose,openTab,addWater,energyIsComplete,refreshAll};
});
