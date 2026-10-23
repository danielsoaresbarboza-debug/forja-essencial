/* Sugestão de próximo treino — olha o histórico de musculação (aba
   Academia) e aponta qual grupo muscular está há mais tempo parado, pra
   ajudar a decidir o treino do dia sem ter que lembrar de cabeça. Também
   avisa se o grupo mais recente foi treinado hoje/ontem, caso o grupo
   sugerido seja outro (reforça "dê uma folga pra esse"). É só uma dica —
   não trava nem decide nada sozinho. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.ForjaGymSuggest=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  function T(){ return root.ForjaGymTraining; }

  async function computeDaysSince(){
    const t = T();
    if(!t) return null;
    await t.loadMuscleCache();
    const workouts = await t.loadWorkouts();
    const today = t.todayKey();
    const todayDate = new Date(today+'T00:00:00');
    const groups = Object.keys(t.MUSCLE_ZONES);
    const lastDateByGroup = {};
    workouts.forEach(w=>{
      if(!w || !w.name || !w.date) return;
      const muscle = t.getMuscleSync(w.name);
      if(!groups.includes(muscle)) return;
      if(!lastDateByGroup[muscle] || w.date > lastDateByGroup[muscle]) lastDateByGroup[muscle] = w.date;
    });
    const daysSince = {};
    groups.forEach(g=>{
      const d = lastDateByGroup[g];
      if(!d){ daysSince[g] = null; return; }
      const dDate = new Date(d+'T00:00:00');
      daysSince[g] = Math.round((todayDate - dDate) / 86400000);
    });
    return {daysSince, groups, today};
  }

  async function buildSuggestion(){
    const info = await computeDaysSince();
    if(!info) return null;
    const {daysSince, groups} = info;
    const neverTrained = groups.filter(g=>daysSince[g]===null);
    let topGroup, topDays, neverFlag=false;
    if(neverTrained.length){
      topGroup = neverTrained[0];
      topDays = null;
      neverFlag = true;
    } else {
      const sorted = groups.slice().sort((a,b)=> daysSince[b]-daysSince[a]);
      topGroup = sorted[0];
      topDays = daysSince[topGroup];
    }
    const mostRecentSorted = groups.slice().sort((a,b)=>{
      const da = daysSince[a]===null ? Infinity : daysSince[a];
      const db = daysSince[b]===null ? Infinity : daysSince[b];
      return da-db;
    });
    const trainedMostRecentGroup = mostRecentSorted[0];
    const recentDays = daysSince[trainedMostRecentGroup];
    const repeatWarning = recentDays!==null && recentDays<=1 && trainedMostRecentGroup!==topGroup;
    return {topGroup, topDays, neverFlag, trainedMostRecentGroup, recentDays, repeatWarning};
  }

  function messageFor(sug){
    if(!sug) return '';
    if(sug.neverFlag){
      return `você ainda não registrou nenhum treino de ${sug.topGroup} — pode ser um bom grupo pra incluir hoje.`;
    }
    if(sug.topDays===0){
      return ''; // trained every group recently enough, nothing useful to flag
    }
    if(sug.topDays>=2){
      let msg = `já fazem ${sug.topDays} dias que você não treina ${sug.topGroup}.`;
      if(sug.repeatWarning){
        msg += ` Você treinou ${sug.trainedMostRecentGroup} ${sug.recentDays===0?'hoje':'ontem'} — talvez dar uma folga pra esse grupo e focar em ${sug.topGroup}.`;
      }
      return msg;
    }
    return '';
  }

  async function render(targetId='gym-suggestion-note'){
    const el = root.document && root.document.getElementById(targetId);
    if(!el) return;
    try{
      const sug = await buildSuggestion();
      const msg = messageFor(sug);
      if(msg){
        el.textContent = '💡 Sugestão: ' + msg;
        el.style.display = '';
      } else {
        el.textContent = '';
        el.style.display = 'none';
      }
    }catch(e){
      el.style.display = 'none';
    }
  }

  return {computeDaysSince, buildSuggestion, messageFor, render};
});
