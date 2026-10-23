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
    const card=root.document&&root.document.getElementById('weekly-calorie-card');
    if(!card||typeof root.computeDietDaySummary!=='function')return;
    const days=[],closed=await closedDays(),range=weekDates(dateKey||localDateKey(new Date()));
    for(const date of range){
      const summary=await root.computeDietDaySummary(date);
      days.push({date,eaten:summary.comido,exercise:summary.exercicio,goal:summary.goal,totalBurn:summary.garminTotal,hasEntries:summary.entryCount>0,complete:!!closed[date],energyComplete:energyIsComplete(date,summary.garminSyncedAt)});
    }
    const result=summarizeWeek(days);
    const value=root.document.getElementById('weekly-calorie-value');
    const detail=root.document.getElementById('weekly-calorie-detail');
    card.dataset.tone=result.tone;
    value.textContent=result.balance!=null?`${result.balance>=0?'+':''}${result.balance} kcal`:'Saldo ainda incompleto';
    detail.textContent=`${result.closedDays}/7 dias alimentares concluídos · ${result.measuredDays} com gasto Garmin disponível · ${result.partialDays} em preenchimento. Gastos parciais ou consultados antes de terminar o dia ficam de fora.`;
    const $=id=>root.document.getElementById(id);
    if($('weekly-range'))$('weekly-range').textContent=`${range[0].split('-').reverse().join('/')} a ${range[6].split('-').reverse().join('/')} · segunda a domingo`;
    if($('weekly-goal'))$('weekly-goal').textContent=result.closedDays?`Meta alimentar dos ${result.closedDays} dias concluídos: ${result.goalBalance>=0?result.goalBalance+' kcal abaixo':Math.abs(result.goalBalance)+' kcal acima'} da meta. Esse valor é separado do saldo energético.`:'Conclua os lançamentos na aba Dieta para acompanhar a semana.';
    if($('weekly-days')){$('weekly-days').replaceChildren();days.forEach(d=>{
      const line=root.document.createElement('details'),heading=root.document.createElement('summary'),info=root.document.createElement('p');
      heading.textContent=d.date.split('-').reverse().join('/')+' · '+(!d.hasEntries?'sem refeições':!d.complete?'em preenchimento':!d.energyComplete?'aguardando gasto final':!d.totalBurn?'sem gasto Garmin':`${Math.round(d.totalBurn-d.eaten)} kcal de saldo`);
      const eaten=d.hasEntries?`${Math.round(d.eaten)} kcal`:'sem registro';
      const spent=d.totalBurn?`${Math.round(d.totalBurn)} kcal`:'indisponível';
      info.textContent=`Consumido: ${eaten} · Gasto total: ${spent} · Exercício: ${Math.round(d.exercise||0)} kcal. O exercício já faz parte do gasto total quando vem do Garmin.`;
      line.append(heading,info);$('weekly-days').append(line);
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
    if(status)status.textContent='Atualizando Garmin, Strava e resumos…';
    const integrations=await Promise.allSettled([
      root.ForjaHealthConnect?.sync?.()??Promise.resolve(false),
      root.ForjaStravaUI?.sync?.(true)??Promise.resolve(false)
    ]);
    await root.renderDashboard?.();await root.renderDietTab?.();await renderWeeklyBalance();await root.ForjaHealthConnect?.showHome?.();
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
