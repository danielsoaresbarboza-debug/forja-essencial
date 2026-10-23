(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.ForjaGymTraining=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
'use strict';
const storage=()=>root.ForjaStorage||root.storage;
const cid=()=>root.crypto?.randomUUID?.()||`id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
function todayKey(d=new Date()){const y=d.getFullYear(),m=String(d.getMonth()+1).padStart(2,'0'),day=String(d.getDate()).padStart(2,'0');return `${y}-${m}-${day}`;}
function nowTime(){return new Date().toTimeString().slice(0,5);}
function fmtDate(key){const [y,m,d]=key.split('-');return `${d}/${m}/${y}`;}
function fmtWeight(w){const r=Math.round(w*10)/10;return String(r).replace('.',',');}
function slug(name){return String(name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/(^-|-$)/g,'');}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function stripAccents(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'');}
function epley1RM(w,r){return r<=0?0:w*(1+r/30);}

// ---- persisted caches (same keys as the original Claude artifact) ----
const K_WORKOUTS='workouts',K_PHOTOS='photos',K_NOTES='exercise-notes',K_MUSCLE='exercise-muscle',
      K_ROUTINES='routines',K_GOAL='training-goal',K_SESSIONS='workout-sessions',K_ACTIVE='active-session',
      K_WATCH='watch-sessions',K_SCALE='scale-log',K_WEIGHT_MODE='exercise-weight-mode',K_GROUPS='workout-groups-v1';
let workoutsCache=null,photosCache=null,notesCache=null,muscleCache=null,routinesCache=null,
    goalCache=null,sessionsCache=null,watchCache=null,scaleCache=null,weightModeCache=null,groupsCache=null;

async function loadWorkouts(){if(workoutsCache)return workoutsCache;try{const r=await storage().get(K_WORKOUTS);workoutsCache=r?.value?JSON.parse(r.value):[];}catch{workoutsCache=[];}return workoutsCache;}
async function saveWorkouts(arr){workoutsCache=arr;await storage().set(K_WORKOUTS,JSON.stringify(arr));}
async function loadPhotosCache(){if(photosCache)return photosCache;try{const r=await storage().get(K_PHOTOS);photosCache=r?.value?JSON.parse(r.value):{};}catch{photosCache={};}return photosCache;}
async function persistPhotosCache(){await storage().set(K_PHOTOS,JSON.stringify(photosCache));}
async function loadNotesCache(){if(notesCache)return notesCache;try{const r=await storage().get(K_NOTES);notesCache=r?.value?JSON.parse(r.value):{};}catch{notesCache={};}return notesCache;}
async function persistNotesCache(){await storage().set(K_NOTES,JSON.stringify(notesCache));}
async function loadMuscleCache(){if(muscleCache)return muscleCache;try{const r=await storage().get(K_MUSCLE);muscleCache=r?.value?JSON.parse(r.value):{};}catch{muscleCache={};}
  let migrated=false;for(const key of Object.keys(muscleCache)){if(muscleCache[key]==='Braço'){muscleCache[key]=/tr[ií]ceps/i.test(key)?'Tríceps':'Bíceps';migrated=true;}}
  if(migrated)await persistMuscleCache();return muscleCache;}
async function persistMuscleCache(){await storage().set(K_MUSCLE,JSON.stringify(muscleCache));}
async function loadRoutinesCache(){if(routinesCache)return routinesCache;try{const r=await storage().get(K_ROUTINES);routinesCache=r?.value?JSON.parse(r.value):[];}catch{routinesCache=[];}return routinesCache;}
async function persistRoutinesCache(){await storage().set(K_ROUTINES,JSON.stringify(routinesCache));}
async function loadGoalCache(){if(goalCache)return goalCache;try{const r=await storage().get(K_GOAL);goalCache=r?.value?JSON.parse(r.value):{weeklyTarget:3};}catch{goalCache={weeklyTarget:3};}return goalCache;}
async function persistGoalCache(){await storage().set(K_GOAL,JSON.stringify(goalCache));}
async function loadSessionsCache(){if(sessionsCache)return sessionsCache;try{const r=await storage().get(K_SESSIONS);sessionsCache=r?.value?JSON.parse(r.value):[];}catch{sessionsCache=[];}return sessionsCache;}
async function persistSessionsCache(){await storage().set(K_SESSIONS,JSON.stringify(sessionsCache));}
async function loadWatchCache(){if(watchCache)return watchCache;try{const r=await storage().get(K_WATCH);watchCache=r?.value?JSON.parse(r.value):[];}catch{watchCache=[];}return watchCache;}
async function persistWatchCache(){await storage().set(K_WATCH,JSON.stringify(watchCache));}
async function loadScaleCache(){if(scaleCache)return scaleCache;try{const r=await storage().get(K_SCALE);scaleCache=r?.value?JSON.parse(r.value):[];}catch{scaleCache=[];}return scaleCache;}
async function persistScaleCache(){await storage().set(K_SCALE,JSON.stringify(scaleCache));}
async function loadWeightModeCache(){if(weightModeCache)return weightModeCache;try{const r=await storage().get(K_WEIGHT_MODE);weightModeCache=r?.value?JSON.parse(r.value):{};}catch{weightModeCache={};}return weightModeCache;}
async function persistWeightModeCache(){await storage().set(K_WEIGHT_MODE,JSON.stringify(weightModeCache));}
const TIME_EXERCISES=/\b(plank|prancha|wall sit|cadeirinha|hollow( body)? hold|dead hang|barra suspensa|l-?sit|isometri|bridge hold|superman hold|farmer'?s? (walk|carry)|side bridge)\b/i;
const REPS_EXERCISES=/\b(push[ -]?ups?|flex[aã]o|pull[ -]?ups?|chin[ -]?ups?|barra fixa|burpee|crunch|abdominal|sit[ -]?ups?|mountain climber|escalador|jumping jack|polichinelo|air squat|bodyweight|peso corporal|dips?|paralelas|box jump|russian twist|leg raise|eleva[cç][aã]o de pernas|lunges? walk|avan[cç]o)\b/i;
function guessWeightMode(name){
  const n=String(name||'');
  let pt='';try{pt=root.ForjaExerciseNames?.display?.(n)||'';}catch{}
  const hay=n+' '+pt;
  if(TIME_EXERCISES.test(hay))return'time';
  let equip='';try{equip=root.ForjaExerciseNames?.equipFor?.(n)||'';}catch{}
  if(REPS_EXERCISES.test(hay)||/peso corporal/i.test(equip))return'none';
  return'normal';
}
function getWeightModeSync(name){const k=slug(name);if(weightModeCache&&weightModeCache[k])return weightModeCache[k];return guessWeightMode(name);}
async function loadWorkoutGroups(){if(groupsCache)return groupsCache;try{const r=await storage().get(K_GROUPS);groupsCache=r?.value?JSON.parse(r.value):[];}catch{groupsCache=[];}return groupsCache;}
async function persistWorkoutGroups(){await storage().set(K_GROUPS,JSON.stringify(groupsCache));}
async function getLastBodyWeight(){
  try{
    const r=await storage().get('body-log');const arr=r?.value?JSON.parse(r.value):[];
    const weights=arr.filter(e=>e.type==='weight').sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')));
    if(!weights.length)return null;
    return parseFloat(String(weights[0].value).replace(',','.'))||null;
  }catch{return null;}
}
function invalidateAll(){workoutsCache=photosCache=notesCache=muscleCache=routinesCache=goalCache=sessionsCache=watchCache=scaleCache=weightModeCache=null;}

// ---- weight/reps/warmup/rir parsing (pipe-delimited weight to avoid the
// classic "12,12 reads as 12.12" decimal-vs-list ambiguity) ----
function parseNums(str){if(!str)return[];return String(str).match(/\d+(?:[.,]\d+)?/g)?.map(s=>parseFloat(s.replace(',','.')))||[];}
function parseRepsList(str){if(!str)return[];return String(str).split(',').map(s=>s.trim()).filter(Boolean).map(s=>parseInt(s.replace(/[^\d]/g,''),10)).filter(n=>!isNaN(n));}
function parseWeightList(str){if(!str)return[];const s=String(str);if(s.includes('|'))return s.split('|').map(t=>t.trim()).filter(Boolean).map(t=>parseFloat(t.replace(',','.'))).filter(n=>!isNaN(n));return parseNums(s);}
function parseWarmupList(str){if(!str)return[];return String(str).split('|').map(s=>s.trim()==='1');}
function parseRirList(str){if(!str)return[];return String(str).split('|').map(s=>s.trim());}
function parseCardioList(str){if(!str)return[];return String(str).split('|').map(s=>{const t=s.trim();if(t==='')return null;const n=parseFloat(t.replace(',','.'));return isNaN(n)?null:n;});}

function bestPairForEntry(e){
  const ws=parseWeightList(e.weight),rs=parseRepsList(e.reps),warm=parseWarmupList(e.warmup);
  let best={w:0,r:0};
  if(ws.length&&rs.length)for(let i=0;i<Math.max(ws.length,rs.length);i++){
    if(warm[i])continue;
    const w=ws[Math.min(i,ws.length-1)]||0,r=rs[Math.min(i,rs.length-1)]||0;
    if(epley1RM(w,r)>epley1RM(best.w,best.r))best={w,r};
  }
  return best;
}
function volumeLoadForEntry(e){
  const ws=parseWeightList(e.weight),rs=parseRepsList(e.reps),warm=parseWarmupList(e.warmup);
  const n=Math.max(ws.length,rs.length);let vol=0;
  for(let i=0;i<n;i++){if(warm[i])continue;vol+=(ws[Math.min(i,ws.length-1)]||0)*(rs[Math.min(i,rs.length-1)]||0);}
  return vol;
}
async function bestHistoricalRM(name){
  const arr=await loadWorkouts();let best=0;
  arr.filter(e=>e.name.trim()===name).forEach(e=>{
    const ws=parseWeightList(e.weight),rs=parseRepsList(e.reps),warm=parseWarmupList(e.warmup),n=Math.max(ws.length,rs.length);
    for(let i=0;i<n;i++){if(warm[i])continue;const rm=epley1RM(ws[Math.min(i,ws.length-1)]||0,rs[Math.min(i,rs.length-1)]||0);if(rm>best)best=rm;}
  });
  return best;
}

// ---- muscle zones (SVG body diagram groups) ----
const MUSCLE_ZONES={'Peito':['chest'],'Costas':['back'],'Ombro':['shoulder'],'Bíceps':['arm_front'],'Tríceps':['arm_back'],'Abdômen':['abs'],'Perna':['legs'],'Glúteo':['glute'],'Panturrilha':['calf']};
const SECONDARY_ZONES={'Peito':['shoulder','arm_back'],'Costas':['arm_front','shoulder'],'Ombro':['arm_back'],'Bíceps':[],'Tríceps':['shoulder'],'Abdômen':[],'Perna':['glute'],'Glúteo':['legs'],'Panturrilha':[]};
function getMuscleSync(name){
  // 1) categoria salva; 2) descoberta pelas bibliotecas (PT ou EN); 3) só então o antigo chute 'Peito'.
  const saved=muscleCache&&muscleCache[slug(name)];if(saved)return saved;
  const N=root.ForjaExerciseNames;const guess=N&&N.muscleFor?N.muscleFor(name):null;
  return guess||'Peito';
}
function hasKnownMuscle(name){const saved=muscleCache&&muscleCache[slug(name)];if(saved)return true;const N=root.ForjaExerciseNames;return !!(N&&N.muscleFor&&N.muscleFor(name));}
function getNoteSync(name){if(!notesCache)return'';return notesCache[slug(name)]||'';}
function getPhotoSync(name){if(!photosCache)return null;return photosCache[slug(name)]||null;}
const SUPERIOR_GROUPS=['Peito','Costas','Ombro','Bíceps','Tríceps','Abdômen'],INFERIOR_GROUPS=['Perna','Glúteo','Panturrilha'],
      PUSH_GROUPS=['Peito','Ombro','Tríceps'],PULL_GROUPS=['Costas','Bíceps'],LEGS_GROUPS=['Perna','Glúteo','Panturrilha'];

// Equipamentos de cardio da academia (esteira, bike, escada...). Os bancos de
// exercícios do app (Kinetic/free-exercise-db) são só de musculação — não têm
// esses equipamentos — então essa listinha fixa cobre o que normalmente tem
// numa academia. São adicionados já em "modo cardio" (tempo/distância/kcal
// em vez de peso/reps — ver weightMode='cardio' em gym-ui.js).
const CARDIO_EQUIPMENT=[
  {name:'Esteira',icon:'🏃',en:'Treadmill'},
  {name:'Bicicleta Ergométrica',icon:'🚴',en:'Exercise Bike / Stationary Bike'},
  {name:'Bicicleta Spinning',icon:'🚴‍♂️',en:'Spin Bike'},
  {name:'Bicicleta Reclinada',icon:'🛋️',en:'Recumbent Bike'},
  {name:'Elíptico',icon:'⛷️',en:'Elliptical'},
  {name:'Escada (StepMill)',icon:'🪜',en:'StepMill / Stair Climber'},
  {name:'Remo Ergométrico',icon:'🚣',en:'Rowing Machine'},
];

async function getRecentExerciseNames(){
  const arr=await loadWorkouts();const order=[],seen=new Set(),seenSlugs=new Set();
  [...arr].sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||''))).forEach(e=>{const n=e.name.trim();if(!seen.has(n)){seen.add(n);seenSlugs.add(slug(n));order.push(n);}});
  // Exercícios que têm foto guardada mas nunca foram registrados num treino também
  // são "seus" — antes sumiam da lista porque ela só olhava o histórico.
  await loadPhotosCache();
  const N=root.ForjaExerciseNames;
  Object.keys(photosCache||{}).forEach(k=>{
    if(seenSlugs.has(k)||!photosCache[k])return;
    seenSlugs.add(k);
    order.push(N&&N.prettyFromSlug?N.prettyFromSlug(k):k);
  });
  return order;
}
// Guarda a foto (já reduzida) de um exercício; passar null apaga.
async function setExercisePhoto(name,dataUrl){
  await loadPhotosCache();
  const key=slug(name);
  if(dataUrl)photosCache[key]=dataUrl;else delete photosCache[key];
  await persistPhotosCache();
}
// Lê um arquivo de imagem e devolve um JPEG reduzido (lado maior 720px) em data URL.
function fileToSmallDataUrl(file,maxSide=720,quality=0.82){
  return new Promise((resolve,reject)=>{
    const url=URL.createObjectURL(file);const img=new Image();
    img.onload=()=>{
      const r=Math.min(1,maxSide/Math.max(img.width,img.height));
      const c=root.document.createElement('canvas');c.width=Math.max(1,Math.round(img.width*r));c.height=Math.max(1,Math.round(img.height*r));
      c.getContext('2d').drawImage(img,0,0,c.width,c.height);
      URL.revokeObjectURL(url);resolve(c.toDataURL('image/jpeg',quality));
    };
    img.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Não consegui abrir essa imagem.'));};
    img.src=url;
  });
}
function youtubeSearchUrl(name){return `https://www.youtube.com/results?search_query=${encodeURIComponent(name+' execução técnica')}`;}

// ---- linear regression / progression science (plateau + deload) ----
function linearRegressionSlope(points){
  const n=points.length;if(n<2)return 0;
  const sumX=points.reduce((s,p)=>s+p.x,0),sumY=points.reduce((s,p)=>s+p.y,0),sumXY=points.reduce((s,p)=>s+p.x*p.y,0),sumXX=points.reduce((s,p)=>s+p.x*p.x,0);
  const denom=n*sumXX-sumX*sumX;return denom===0?0:(n*sumXY-sumX*sumY)/denom;
}
async function analyzeProgression(name){
  const arr=await loadWorkouts();
  const past=arr.filter(e=>e.name.trim()===name).sort((a,b)=>a.date.localeCompare(b.date));
  const points=past.map(e=>{const best=bestPairForEntry(e);return{date:e.date,rm:epley1RM(best.w,best.r),volume:volumeLoadForEntry(e)};}).filter(p=>p.rm>0);
  if(points.length<4)return{status:'insufficient',points};
  const recent=points.slice(-6);
  const slope=linearRegressionSlope(recent.map((p,i)=>({x:i,y:p.rm})));
  const relSlope=slope/(recent[0].rm||1);
  const weeksSpan=(new Date(recent[recent.length-1].date+'T00:00:00')-new Date(recent[0].date+'T00:00:00'))/(1000*60*60*24*7);
  const plateau=weeksSpan>=3&&relSlope<=0.005;
  const sessions=await loadSessionsCache();
  const cutoff=todayKey(new Date(Date.now()-14*24*60*60*1000));
  const recentRpes=sessions.filter(s=>s.date>=cutoff&&s.rpe).map(s=>s.rpe);
  const avgRpe=recentRpes.length?recentRpes.reduce((a,b)=>a+b,0)/recentRpes.length:null;
  const deloadSuggested=plateau&&weeksSpan>=4&&(avgRpe===null||avgRpe>=7);
  return{status:plateau?'plateau':'progressing',points:recent,weeksSpan,avgRpe,deloadSuggested};
}

// ---- plate calculator ----
const PLATE_SIZES=[{kg:25,color:'#e53935'},{kg:20,color:'#1e88e5'},{kg:15,color:'#fdd835'},{kg:10,color:'#43a047'},{kg:5,color:'#e0e0e0'},{kg:2.5,color:'#333'},{kg:1.25,color:'#9e9e9e'}];
function computePlatesPerSide(totalKg,barKg){
  let perSide=(totalKg-barKg)/2;if(perSide<=0)return[];
  const result=[];for(const p of PLATE_SIZES){let count=0;while(perSide+1e-6>=p.kg){perSide-=p.kg;count++;}if(count>0)result.push({kg:p.kg,color:p.color,count});}
  return result;
}

// ---- weekly training goal (with compensation for a missed week) ----
function getMonday(d){const date=new Date(d);const day=date.getDay();const diff=(day===0?-6:1)-day;date.setDate(date.getDate()+diff);date.setHours(0,0,0,0);return date;}
function addDays(d,n){const date=new Date(d);date.setDate(date.getDate()+n);return date;}
async function daysTrainedInRange(start,end){
  const arr=await loadWorkouts();await loadWatchCache();
  const s=todayKey(start),e=todayKey(end);
  const{academia:watchAcademiaDays}=watchDaysByCategory();
  const days=new Set([...arr.filter(x=>x.date>=s&&x.date<=e).map(x=>x.date),...[...watchAcademiaDays].filter(d=>d>=s&&d<=e)]);
  return days.size;
}
async function computeWeeklyGoal(){
  await loadGoalCache();const baseGoal=goalCache.weeklyTarget;
  const thisMonday=getMonday(new Date()),lastMonday=addDays(thisMonday,-7),lastSunday=addDays(thisMonday,-1);
  const lastWeekDone=await daysTrainedInRange(lastMonday,lastSunday);
  const shortfall=Math.max(0,baseGoal-lastWeekDone);const target=baseGoal+shortfall;
  const thisSunday=addDays(thisMonday,6);const done=await daysTrainedInRange(thisMonday,thisSunday);
  return{target,done,baseGoal,shortfall,compensating:shortfall>0};
}

// ---- streak (gym workouts + any watch/cardio day both count) ----
async function computeStreak(){
  const arr=await loadWorkouts();await loadWatchCache();
  const days=new Set([...arr.map(e=>e.date),...watchCache.map(w=>w.date)]);
  if(days.size===0)return 0;
  let streak=0;let cursor=new Date();cursor.setHours(0,0,0,0);
  if(!days.has(todayKey(cursor))){cursor.setDate(cursor.getDate()-1);if(!days.has(todayKey(cursor)))return 0;}
  while(days.has(todayKey(cursor))){streak++;cursor.setDate(cursor.getDate()-1);}
  return streak;
}

// ---- Zepp OCR parsers (three known screen layouts) ----
const CARDIO_TYPE_RE=/(CICLISMO\s+INDOOR|CICLISMO\s+AO\s+AR\s+LIVRE|CORRIDA\s+AO\s+AR\s+LIVRE|CORRIDA\s+INDOOR|CORRIDA)/gi;
function parseDurationToMinutes(str){if(!str)return null;const parts=str.split(':').map(Number);return parts.length===3?parts[0]*60+parts[1]+parts[2]/60:parts[0]+parts[1]/60;}
function zeppMonthToNum(m){const map={jan:1,fev:2,mar:3,abr:4,mai:5,jun:6,jul:7,ago:8,set:9,out:10,nov:11,dez:12};return map[stripAccents(m).toLowerCase().slice(0,3)]||null;}
function parseZeppDate(dateRaw){if(!dateRaw)return null;const m=dateRaw.match(/(\d{1,2})\s+de\s+(\w+)\.?\s+de\s+(\d{4})/i);if(!m)return null;const month=zeppMonthToNum(m[2]);if(!month)return null;return `${m[3]}-${String(month).padStart(2,'0')}-${String(parseInt(m[1],10)).padStart(2,'0')}`;}

function parseZeppScreen(rawText){
  const text=stripAccents(rawText);const out={zones:[]};
  let m=text.match(/Dura[c]?[a]?o[\s\S]{0,40}?(\d{1,2}:\d{2})/i);if(m)out.durationStr=m[1];
  m=text.match(/M[e]?dia\s+de\s+frequ[e]?ncia[\s\S]{0,20}?(\d{2,3})/i);if(m)out.hrAvg=parseInt(m[1],10);
  if(!out.hrAvg){m=text.match(/\(bpm\)[\s\S]{0,60}?(\d{2,3})/i);if(m)out.hrAvg=parseInt(m[1],10);}
  m=text.match(/(\d{2,3})\s*[\s\S]{0,12}?M[a]?ximo/i);if(m)out.hrMax=parseInt(m[1],10);
  m=text.match(/(\d{2,4})\s*kcal/i);if(m)out.kcal=parseInt(m[1],10);
  m=text.match(/Efeito\s+do\s+Treino[\s\S]{0,90}?(\d[.,]\d)/i);if(m)out.effectValue=m[1].replace(',','.');
  m=text.match(/(Anaerobico|Aerobico|Extenuante|Leve|Recuperacao|Excessivo)\s*\n?\s*Efeito/i)||text.match(/Efeito\s+do\s+Treino\s*\n?\s*([A-Za-z]+)/i);if(m)out.effectCategory=m[1];
  m=text.match(/RPE[\s\S]{0,10}?(\d{1,2})\b/i);if(m)out.rpe=parseInt(m[1],10);
  [{key:'vo2',pattern:/M[aá]x\.?\s*VO\s*2?/i,label:'Máx. VO₂'},{key:'anaerobico',pattern:/Anaer[oó]bico/i,label:'Anaeróbico'},{key:'aerobico',pattern:/(?<!n)Aer[oó]bico/i,label:'Aeróbico'},{key:'intensivo',pattern:/Intensivo/i,label:'Intensivo'},{key:'aquecimento',pattern:/Aquecimento/i,label:'Aquecimento'}].forEach(z=>{
    const idx=text.search(z.pattern);if(idx<0)return;const win=text.slice(idx,idx+90);
    const pm=win.match(/(\d{1,3})\s*%/),tm=win.match(/(\d{1,2}:\d{2})/);
    if(pm||tm)out.zones.push({label:z.label,pct:pm?parseInt(pm[1],10):null,time:tm?tm[1]:null});
  });
  m=rawText.match(/(\d{1,2}\s+de\s+\w+\.?\s+de\s+\d{4})/i);if(m)out.dateRaw=m[1];
  return out;
}
function parseZeppTrainingBalance(rawText){
  const text=stripAccents(rawText);const dateRe=/(\d{2})\/(\d{2})\/(\d{4})/g;const dateMatches=[];let dm;
  while((dm=dateRe.exec(text)))dateMatches.push({index:dm.index,date:`${dm[3]}-${dm[2]}-${dm[1]}`});
  if(dateMatches.length===0)return null;
  const days=[];
  for(let i=0;i<dateMatches.length;i++){
    const start=dateMatches[i].index,end=i+1<dateMatches.length?dateMatches[i+1].index:text.length;
    const block=text.slice(start,end),date=dateMatches[i].date;
    let m=block.match(/(\d{1,4})\s*\n?\s*Carga\s*Total/i);const cargaTotal=m?parseInt(m[1],10):null;
    m=block.match(/Resist[e]?ncia:?\s*(\d{1,4})/i);const resistencia=m?parseInt(m[1],10):null;
    m=block.match(/For[c]?a:?\s*(\d{1,4})/i);const forca=m?parseInt(m[1],10):null;
    const activities=[];const typeMatches=[];let tm;CARDIO_TYPE_RE.lastIndex=0;
    while((tm=CARDIO_TYPE_RE.exec(block)))typeMatches.push({index:tm.index,label:tm[1].replace(/\s+/g,' ').trim()});
    for(let j=0;j<typeMatches.length;j++){
      const aStart=typeMatches[j].index,aEnd=j+1<typeMatches.length?typeMatches[j+1].index:block.length,aBlock=block.slice(aStart,aEnd);
      const isIndoor=/INDOOR/i.test(typeMatches[j].label);
      const durM=aBlock.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);const duration=durM?durM[1]:null;
      const rpeM=aBlock.match(/RPE\s*(\d{1,2})/i);const rpe=rpeM?parseInt(rpeM[1],10):null;
      const kmM=aBlock.match(/(\d{1,3}[.,]\d{1,2})\s*km/i);const distanceKm=kmM?parseFloat(kmM[1].replace(',','.')):null;
      let kcal=null,hr=null;
      if(isIndoor){const nums=[...aBlock.matchAll(/\b(\d{2,4})\b/g)].map(x=>parseInt(x[1],10)).filter(n=>n>0);kcal=nums.find(n=>n>=50&&n<=1500)||null;hr=nums.find(n=>n>=40&&n<=220&&n!==kcal)||null;}
      activities.push({type:typeMatches[j].label,kind:isIndoor?'indoor':'outdoor',duration,rpe,distanceKm,kcal,hr});
    }
    days.push({date,cargaTotal,resistencia,forca,activities});
  }
  return days.filter(d=>d.activities.length>0);
}
function parseZeppActivityList(rawText){
  const text=stripAccents(rawText);const dateRe=/\b(\d{2})\/(\d{2})\b(?!\/\d)/g;const dateMatches=[];let dm;
  while((dm=dateRe.exec(text)))dateMatches.push({index:dm.index,day:dm[1],month:dm[2]});
  if(dateMatches.length===0)return null;
  const year=new Date().getFullYear();const days=[];
  for(let i=0;i<dateMatches.length;i++){
    const start=dateMatches[i].index,end=i+1<dateMatches.length?dateMatches[i+1].index:text.length,block=text.slice(start,end);
    const date=`${year}-${dateMatches[i].month}-${dateMatches[i].day}`;
    const activities=[];const typeMatches=[];let tm;CARDIO_TYPE_RE.lastIndex=0;
    while((tm=CARDIO_TYPE_RE.exec(block)))typeMatches.push({index:tm.index,label:tm[1].replace(/\s+/g,' ').trim()});
    for(let j=0;j<typeMatches.length;j++){
      const aStart=typeMatches[j].index,aEnd=j+1<typeMatches.length?typeMatches[j+1].index:block.length,aBlock=block.slice(aStart,aEnd);
      const isIndoor=/INDOOR/i.test(typeMatches[j].label);
      const durM=aBlock.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);const duration=durM?durM[1]:null;
      const kmM=aBlock.match(/(\d{1,3}[.,]\d{1,2})\s*km/i);const distanceKm=kmM?parseFloat(kmM[1].replace(',','.')):null;
      let kcal=null,hr=null;
      if(isIndoor){const nums=[...aBlock.matchAll(/\b(\d{2,4})\b/g)].map(x=>parseInt(x[1],10)).filter(n=>n>0);kcal=nums.find(n=>n>=50&&n<=1500)||null;hr=nums.find(n=>n>=40&&n<=220&&n!==kcal)||null;}
      activities.push({type:typeMatches[j].label,kind:isIndoor?'indoor':'outdoor',duration,distanceKm,kcal,hr});
    }
    if(activities.length)days.push({date,cargaTotal:null,resistencia:null,forca:null,activities});
  }
  return days.filter(d=>d.activities.length>0);
}

// ---- OKOK scale OCR ----
function parseOkokScale(rawText){
  const text=stripAccents(rawText);
  function grab(labelPattern){const re=new RegExp(labelPattern+'[\\s\\S]{0,45}?(\\d{1,4}[.,]\\d{1,2}|\\d{1,4})','i');const m=text.match(re);return m?parseFloat(m[1].replace(',','.')):null;}
  const data={weightKg:grab('Peso\\(Kg\\)'),bmi:grab('IMC'),bodyFatPct:grab('Gordura\\(%\\)'),fatMassKg:grab('Peso da gordura'),
    skeletalMusclePct:grab('massa muscular esquel[e]?tica\\(%\\)'),skeletalMuscleKg:grab('Peso da massa muscular esquel[e]?tica'),
    muscleMassKg:grab('Peso da massa muscular\\(Kg\\)'),waterPct:grab('[Aa]gua\\(%\\)'),waterKg:grab('peso da [aá]gua'),
    visceralFat:grab('Gordura visceral'),boneKg:grab('Ossos'),bmr:grab('Metabolismo'),proteinPct:grab('Prote[i]?na'),
    obesityPct:grab('Obesidade'),metabolicAge:grab('Idade metab[o]?lica'),lbmKg:grab('LBM'),realAge:grab('Idade real'),heightCm:grab('Altura')};
  const dm=rawText.match(/(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}:\d{2})/);
  data.date=dm?`${dm[1]}-${dm[2]}-${dm[3]}`:todayKey();data.time=dm?dm[4]:nowTime();
  if(data.weightKg===null&&data.bodyFatPct===null)return null;
  return data;
}

function entryHasCardioData(e){
  const cmin=parseCardioList(e.cardioMin||''),ckm=parseCardioList(e.cardioKm||''),ckcal=parseCardioList(e.cardioKcal||'');
  return [...cmin,...ckm,...ckcal].some(v=>v!=null&&v>0);
}
function entryHasStrengthData(e){
  const reps=parseRepsList(e.reps||'');
  return reps.some(r=>(parseFloat(r)||0)>0);
}

// Registros do relógio importados via OCR às vezes vêm com o tipo errado
// (ex.: o relógio não tem perfil de "musculação", então um treino de força
// é gravado como "Ciclismo Indoor"). Quando o usuário reclassifica isso como
// Academia na revisão da importação, watchCategory fica 'academia' — esses
// dias contam como força, não como cardio.
function watchDaysByCategory(){
  const academia=new Set(),cardio=new Set();
  (watchCache||[]).forEach(w=>{ (w.watchCategory==='academia'?academia:cardio).add(w.date); });
  return{academia,cardio};
}
async function computeCalendarData(year,month){
  const arr=await loadWorkouts();await loadWatchCache();
  const trainedDays=new Set(arr.map(e=>e.date));
  const{academia:watchAcademiaDays,cardio:watchCardioDays}=watchDaysByCategory();
  const strengthDays=new Set([...arr.filter(e=>entryHasStrengthData(e)).map(e=>e.date),...watchAcademiaDays]);
  const gymCardioDays=new Set(arr.filter(e=>entryHasCardioData(e)).map(e=>e.date));
  const watchDays=new Set(watchCardioDays);
  const cardioDays=new Set([...watchDays,...gymCardioDays]);
  const cardioOnlyDays=new Set([...cardioDays].filter(d=>!strengthDays.has(d)));
  let photosArr=[];try{const r=await storage().get('progress-photos');photosArr=r?.value?JSON.parse(r.value):[];}catch{}
  const photoDays=new Set(photosArr.map(p=>p.date));
  let bodyArr=[];try{const r=await storage().get('body-log');bodyArr=r?.value?JSON.parse(r.value):[];}catch{}
  const waterByDate={};
  bodyArr.filter(e=>e.type==='water').forEach(e=>{
    const ml=parseFloat(String(e.ml??e.value??0).replace(',','.'))||0;
    waterByDate[e.date]=(waterByDate[e.date]||0)+ml;
  });
  const waterGoalDays=new Set(Object.keys(waterByDate).filter(d=>waterByDate[d]>=2100));
  let dietArr=[];try{const r=await storage().get('diet-log');dietArr=r?.value?JSON.parse(r.value):[];}catch{}
  const dietByDate={};dietArr.forEach(e=>{dietByDate[e.date]=(dietByDate[e.date]||0)+(e.kcal||0);});
  let deficitGoal=1800;try{const r=await storage().get('calorie-calc-lock');if(r?.value){const c=JSON.parse(r.value);if(c.deficitGoal)deficitGoal=c.deficitGoal;}}catch{}
  const deficitDays=new Set(Object.keys(dietByDate).filter(d=>dietByDate[d]>0&&dietByDate[d]<=deficitGoal));
  return{trainedDays,strengthDays,gymCardioDays,cardioOnlyDays,watchDays,cardioDays,photoDays,waterGoalDays,deficitDays};
}

// ---- reward system (mix: tokens that never reset + perfect-day bonus +
// weekly card view + a reward shop the user defines) ----
const K_REWARDS='gym-rewards-v1';
let rewardsCache=null;
async function loadRewardsCache(){
  if(rewardsCache)return rewardsCache;
  try{const r=await storage().get(K_REWARDS);rewardsCache=r?.value?JSON.parse(r.value):null;}catch{rewardsCache=null;}
  if(!rewardsCache)rewardsCache={tokens:0,totalEarned:0,perfectDays:0,processedDates:[],
    rewards:[
      {id:cid(),name:'Sorvete',cost:5},
      {id:cid(),name:'Lanche fora (hambúrguer, etc.)',cost:8},
      {id:cid(),name:'Delivery (japonês, etc.)',cost:10},
      {id:cid(),name:'Pizza',cost:10},
      {id:cid(),name:'Barzinho com amigos',cost:15},
      {id:cid(),name:'Cinema (ingresso + pipoca)',cost:15},
      {id:cid(),name:'Sobremesa num restaurante',cost:12},
      {id:cid(),name:'Dia livre (coma o que quiser)',cost:20},
    ],
    redemptions:[]};
  return rewardsCache;
}
async function persistRewardsCache(){await storage().set(K_REWARDS,JSON.stringify(rewardsCache));}

async function goalsMetOnDate(date,calData){
  const trained=calData.trainedDays.has(date)||calData.watchDays.has(date); // gym OR cardio counts
  const water=calData.waterGoalDays.has(date);
  const deficit=calData.deficitDays.has(date);
  return{trained,water,deficit,count:[trained,water,deficit].filter(Boolean).length};
}

// Award tokens for any past day not yet processed (never re-processes a date,
// so this is safe to call every time the tab renders). "Today" is skipped —
// the day isn't finished yet, so its goals could still change.
async function processRewardsForPastDays(){
  await loadRewardsCache();
  const calData=await computeCalendarData();
  const today=todayKey();
  const allDates=new Set([...calData.trainedDays,...calData.watchDays,...calData.waterGoalDays,...calData.deficitDays]);
  const processed=new Set(rewardsCache.processedDates);
  const pending=[...allDates].filter(d=>d<today&&!processed.has(d)).sort();
  let newlyAwarded=0,newPerfectDays=0;
  for(const date of pending){
    const g=await goalsMetOnDate(date,calData);
    let earned=g.count; // 1 token per goal hit that day
    if(g.count===3){earned+=2;newPerfectDays++;rewardsCache.perfectDays++;} // dia perfeito bonus
    rewardsCache.tokens+=earned;rewardsCache.totalEarned+=earned;newlyAwarded+=earned;
    rewardsCache.processedDates.push(date);
  }
  if(pending.length)await persistRewardsCache();
  return{newlyAwarded,newPerfectDays,processedCount:pending.length};
}

async function computeWeeklyCard(){
  const calData=await computeCalendarData();
  const monday=getMonday(new Date());
  const days=[];
  for(let i=0;i<7;i++){
    const d=addDays(monday,i);const key=todayKey(d);
    const isFuture=key>todayKey();
    days.push({date:key,dayLabel:['Seg','Ter','Qua','Qui','Sex','Sáb','Dom'][i],isFuture,
      ...(isFuture?{trained:false,water:false,deficit:false,count:0}:await goalsMetOnDate(key,calData))});
  }
  return days;
}

async function addReward(name,cost){
  await loadRewardsCache();rewardsCache.rewards.push({id:cid(),name,cost:Math.max(1,cost)});await persistRewardsCache();
}
async function removeReward(id){
  await loadRewardsCache();rewardsCache.rewards=rewardsCache.rewards.filter(r=>r.id!==id);await persistRewardsCache();
}
async function redeemReward(id){
  await loadRewardsCache();const reward=rewardsCache.rewards.find(r=>r.id===id);if(!reward)return{ok:false,error:'Recompensa não encontrada.'};
  if(rewardsCache.tokens<reward.cost)return{ok:false,error:'Fichas insuficientes.'};
  rewardsCache.tokens-=reward.cost;
  rewardsCache.redemptions.unshift({id:cid(),rewardName:reward.name,cost:reward.cost,date:todayKey()});
  await persistRewardsCache();return{ok:true,reward};
}

async function init(){await Promise.all([loadWorkouts(),loadPhotosCache(),loadNotesCache(),loadMuscleCache(),loadRoutinesCache(),loadGoalCache(),loadSessionsCache(),loadWatchCache(),loadScaleCache(),loadRewardsCache()]);}
async function render(){/* no-op: rendering lives in ForjaGymUI.render(); this only exists so app.js's
  optional-chained "ForjaGymTraining.render?.().then(...)" call has a promise to chain onto */}

return{
  storage,cid,todayKey,nowTime,fmtDate,fmtWeight,slug,escapeHtml,stripAccents,epley1RM,
  K_WORKOUTS,K_PHOTOS,K_NOTES,K_MUSCLE,K_ROUTINES,K_GOAL,K_SESSIONS,K_ACTIVE,K_WATCH,K_SCALE,
  loadWorkouts,saveWorkouts,loadPhotosCache,persistPhotosCache,loadNotesCache,persistNotesCache,
  loadMuscleCache,persistMuscleCache,loadRoutinesCache,persistRoutinesCache,loadGoalCache,persistGoalCache,
  loadSessionsCache,persistSessionsCache,loadWatchCache,persistWatchCache,loadScaleCache,persistScaleCache,invalidateAll,
  loadWeightModeCache,persistWeightModeCache,getWeightModeSync,guessWeightMode,getLastBodyWeight,
  loadWorkoutGroups,persistWorkoutGroups,
  parseNums,parseRepsList,parseWeightList,parseWarmupList,parseRirList,parseCardioList,bestPairForEntry,volumeLoadForEntry,bestHistoricalRM,
  MUSCLE_ZONES,SECONDARY_ZONES,getMuscleSync,getNoteSync,getPhotoSync,SUPERIOR_GROUPS,INFERIOR_GROUPS,PUSH_GROUPS,PULL_GROUPS,LEGS_GROUPS,CARDIO_EQUIPMENT,
  getRecentExerciseNames,setExercisePhoto,fileToSmallDataUrl,hasKnownMuscle,youtubeSearchUrl,linearRegressionSlope,analyzeProgression,
  PLATE_SIZES,computePlatesPerSide,getMonday,addDays,daysTrainedInRange,computeWeeklyGoal,computeStreak,computeCalendarData,watchDaysByCategory,
  K_REWARDS,loadRewardsCache,persistRewardsCache,goalsMetOnDate,processRewardsForPastDays,computeWeeklyCard,addReward,removeReward,redeemReward,
  parseDurationToMinutes,parseZeppDate,parseZeppScreen,parseZeppTrainingBalance,parseZeppActivityList,parseOkokScale,
  init,render,
};
});
