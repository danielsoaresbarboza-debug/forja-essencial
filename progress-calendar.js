(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.ForjaProgressCalendar=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';
 const dateKey=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 const today=()=>dateKey(new Date());
 const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(String(value||''));
 const monthDates=(year,month)=>{const first=new Date(year,month,1,12),offset=(first.getDay()+6)%7,last=new Date(year,month+1,0,12).getDate();return [...Array(offset).fill(null),...Array.from({length:last},(_,i)=>dateKey(new Date(year,month,i+1,12)))];};
 const blank=()=>({water:0,weight:null,meals:0,kcal:0,closed:false,creatine:false,steps:null,activeKcal:null,totalKcal:null,training:{corrida:0,natacao:0,crossfit:0,academia:0},sources:new Set()});
 function buildIndex({body=[],diet=[],closed={},creatine=[],gym=[],health=[],sports={}}={}){
  const index=new Map(),day=date=>{if(!validDate(date))return null;if(!index.has(date))index.set(date,blank());return index.get(date);};
  for(const row of body){const d=day(row?.date);if(!d)continue;if(row.type==='water'){const ml=row.ml!=null?Number(row.ml):Number(String(row.value||'').replace(',','.'))*1000;d.water+=Number.isFinite(ml)?ml:0;}else if(row.type==='weight'){const value=Number(String(row.value||'').replace(',','.'));if(Number.isFinite(value))d.weight=value;}}
  for(const row of diet){const d=day(row?.date);if(d){d.meals++;d.kcal+=Number(row.kcal)||0;}}
  for(const date of Object.keys(closed||{})){const d=day(date);if(d)d.closed=true;}
  for(const date of creatine){const d=day(date);if(d)d.creatine=true;}
  for(const row of gym){const d=day(row?.date);if(d){d.training.academia++;d.sources.add('Academia · lançamento no Forja');}}
  for(const row of health){const d=day(row?.date);if(!d||row.sourcePackage!=='com.garmin.android.apps.connectmobile')continue;for(const key of ['steps','activeKcal','totalKcal'])if(row[key]!=null&&Number.isFinite(Number(row[key])))d[key]=Number(row[key]);if([d.steps,d.activeKcal,d.totalKcal].some(value=>value!=null))d.sources.add('Garmin Connect');}
  for(const [sport,rows] of Object.entries(sports)){if(!['corrida','natacao','crossfit'].includes(sport))continue;for(const row of rows){const d=day(row?.data);if(!d)continue;d.training[sport]++;const source=String(row.origem||'manual');d.sources.add(/strava/i.test(source)?'Strava':/garmin/i.test(source)?'Garmin':/print/i.test(source)?'Foto do treino':'Lançamento manual');}}
  return index;
 }
 async function loadIndex(){const storage=root.ForjaStorage||root.storage,keys=['body-log','diet-log','diet-closed-days','creatine-days-v1','gym-sessions-v1','health-connect-daily'],defaults=[[],[],{},[],[],[]];const values=await Promise.all(keys.map(async(key,i)=>{try{const row=await storage.get(key);return row?.value?JSON.parse(row.value):defaults[i];}catch{return defaults[i];}}));const sports={};for(const [name,key] of [['corrida','corridas'],['natacao','natacao'],['crossfit','crossfit']]){try{const result=await root.ForjaDB?.collection(key)?.get();sports[name]=result?.docs?.map(doc=>doc.data())||[];}catch{sports[name]=[];}}return buildIndex({body:values[0],diet:values[1],closed:values[2],creatine:values[3],gym:values[4],health:values[5],sports});}
 let selected=today(),month=new Date().getMonth(),year=new Date().getFullYear();
 function dayStatus(d=blank(),waterGoal=2100){return {water:d.water<=0?'sem registro':d.water>=waterGoal?'meta cumprida':'em andamento',diet:d.closed?'concluída':d.meals?'em andamento':'sem registro'};}
 function describe(date,index,{waterGoal=2100}={}){const d=index.get(date)||blank(),status=dayStatus(d,waterGoal),training=Object.entries(d.training).filter(([,count])=>count).map(([name,count])=>`${name==='natacao'?'natação':name} ${count}`),parts=[];if(training.length)parts.push('Treinos: '+training.join(' · '));parts.push(`Dieta: ${status.diet}${d.meals?` · ${d.meals} refeição(ões) · ${Math.round(d.kcal)} kcal consumidas`:''}`);parts.push(`Água: ${status.water} · ${Math.max(0,Math.round(d.water)).toLocaleString('pt-BR')} de ${waterGoal.toLocaleString('pt-BR')} ml`);if(d.weight!=null)parts.push(`Peso: ${d.weight.toLocaleString('pt-BR')} kg`);if(d.creatine)parts.push('Creatina marcada');if(d.steps!=null)parts.push(`Passos: ${Math.round(d.steps).toLocaleString('pt-BR')} · Garmin`);if(d.activeKcal!=null)parts.push(`Gasto ativo: ${Math.round(d.activeKcal)} kcal · Garmin`);if(d.totalKcal!=null)parts.push(`Gasto total: ${Math.round(d.totalKcal)} kcal · Garmin`);if(d.sources.size)parts.push('Fontes: '+[...d.sources].join(' · '));return parts;}
 async function render(){
  const doc=root.document,area=doc?.getElementById('progress-calendar-grid');if(!area)return;
  const storage=root.ForjaStorage||root.storage;
  const [index,goalRow]=await Promise.all([loadIndex(),storage.get('water-daily-goal').catch(()=>null)]);
  const waterGoal=Number(goalRow?.value)>0?Number(goalRow.value):2100;
  const dates=monthDates(year,month),current=today(),header=doc.getElementById('progress-month'),summary=doc.getElementById('progress-month-summary'),detail=doc.getElementById('progress-day-summary');
  const monthLabel=new Date(year,month,1).toLocaleDateString('pt-BR',{month:'long',year:'numeric'});header.textContent=monthLabel[0].toUpperCase()+monthLabel.slice(1);area.replaceChildren();
  for(const label of ['Seg','Ter','Qua','Qui','Sex','Sáb','Dom']){const span=doc.createElement('span');span.className='progress-weekday';span.textContent=label;area.append(span);}
  for(const date of dates){
   if(!date){const empty=doc.createElement('span');empty.setAttribute('aria-hidden','true');area.append(empty);continue;}
   const d=index.get(date)||blank(),workouts=Object.values(d.training).reduce((a,b)=>a+b,0),state=dayStatus(d,waterGoal),button=doc.createElement('button');
   button.type='button';button.className='progress-day';button.dataset.date=date;button.disabled=date>current;button.setAttribute('aria-pressed',String(date===selected));
   button.setAttribute('aria-label',`${date.slice(8)}/${date.slice(5,7)}${workouts?', '+workouts+' treino(s)':''}; dieta ${state.diet}; água ${state.water}${d.creatine?'; creatina marcada':''}`);
   button.innerHTML=`<strong>${Number(date.slice(8))}</strong><span class="progress-dots">${workouts?'<i class="training" title="Treino registrado"></i>':''}${d.meals||d.closed?`<i class="diet${d.closed?' complete':''}" title="Dieta ${state.diet}"></i>`:''}${d.water?`<i class="water${state.water==='meta cumprida'?' complete':''}" title="Água ${state.water}"></i>`:''}${d.creatine?'<i class="creatine complete" title="Creatina marcada"></i>':''}</span>`;
   button.onclick=()=>{selected=date;render();};area.append(button);
  }
  const thisMonth=[...index.entries()].filter(([date])=>date.startsWith(`${year}-${String(month+1).padStart(2,'0')}`)&&date<=current);
  summary.textContent=`${thisMonth.filter(([,d])=>Object.values(d.training).some(Boolean)).length} dia(s) com treino · ${thisMonth.filter(([,d])=>d.closed).length} com dieta concluída · ${thisMonth.filter(([,d])=>d.creatine).length} com creatina`;
  if(!selected.startsWith(`${year}-${String(month+1).padStart(2,'0')}`))selected=dateKey(new Date(year,month,1,12));
  detail.replaceChildren();const title=doc.createElement('h3');title.textContent=selected.split('-').reverse().join('/');detail.append(title);
  for(const value of describe(selected,index,{waterGoal})){const p=doc.createElement('p');p.textContent=value;detail.append(p);}
  const actions=doc.createElement('div');actions.className='progress-day-actions';
  const day=index.get(selected)||blank();const trainingTab=Object.entries(day.training).find(([,count])=>count)?.[0]||'crossfit';
  for(const [label,target] of [['Ver dieta','dieta'],['Ver água','agua'],[`Ver ${trainingTab==='crossfit'?'CrossFit':trainingTab==='natacao'?'natação':trainingTab}` ,trainingTab]]){const button=doc.createElement('button');button.type='button';button.textContent=label;button.className='dica-add-btn';button.onclick=()=>{root.switchTab?.(target);if(target==='dieta')root.setDietDate?.(selected);if(target==='agua')root.setWaterDate?.(selected);};actions.append(button);}detail.append(actions);
  doc.getElementById('progress-next-month').disabled=year>new Date().getFullYear()||year===new Date().getFullYear()&&month>=new Date().getMonth();
  root.ForjaMuscleDayMap?.render(selected);
 }
 function shift(delta){const next=new Date(year,month+delta,1,12);if(next>new Date(new Date().getFullYear(),new Date().getMonth(),1,12))return;year=next.getFullYear();month=next.getMonth();render();}
 function init(){const area=root.document?.getElementById('tab-progresso');if(!area||area.dataset.progressBound)return;area.dataset.progressBound='1';root.document.getElementById('progress-prev-month').onclick=()=>shift(-1);root.document.getElementById('progress-next-month').onclick=()=>shift(1);}
 return {dateKey,monthDates,buildIndex,dayStatus,describe,loadIndex,render,init};
});
