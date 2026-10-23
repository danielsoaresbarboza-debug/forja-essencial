(function(root){
 'use strict';
 const SECONDS_PER_DAY=86400;
 const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
 const nonnegative=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 const identifier=v=>/^\d{1,20}$/.test(String(v??''));
 function normalizeActivity(activity,athleteId){
  if(!activity||!identifier(activity.id)||!identifier(athleteId))return null;
  const day=String(activity.start_date_local||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return null;
  const parsed=new Date(day+'T00:00:00Z');
  if(!Number.isFinite(parsed.getTime())||parsed.toISOString().slice(0,10)!==day)return null;
  const type=activity.sport_type||activity.type;
  let collection;
  if(['Run','TrailRun','VirtualRun'].includes(type))collection='corridas';
  else if(type==='Swim')collection='natacao';
  else if(type==='Crossfit')collection='crossfit';
  else return null;
  const duration=collection==='crossfit'?(activity.elapsed_time||activity.moving_time):(activity.moving_time||activity.elapsed_time);
  if(!positive(duration))return null;
  const data={data:day,duracao_s:duration,origem:'strava',strava_id:String(activity.id),strava_athlete_id:String(athleteId)};
  if(collection!=='crossfit'){
   if(!positive(activity.distance))return null;
   if(collection==='corridas'){data.distancia_km=activity.distance/1000;data.ritmo=duration/data.distancia_km;}
   else{data.distancia_m=activity.distance;data.ritmo_100m=duration/activity.distance*100;}
  }else data.observacoes='Importado do Strava.';
  for(const [from,to]of [['calories','calorias'],['average_heartrate','fc_media'],['max_heartrate','fc_max'],['total_elevation_gain','elevacao_m'],['average_cadence','cadencia']])if(nonnegative(activity[from]))data[to]=activity[from];
  return {collection,id:'strava-'+athleteId+'-'+activity.id,data};
 }
 async function readJSON(storage,key,fallback){const r=await storage.get(key);if(!r)return fallback;try{return JSON.parse(r.value);}catch{return fallback;}}
 async function importActivities(db,storage,activities,athleteId){
  if(!Array.isArray(activities)||!identifier(athleteId))throw Error('Resposta inválida do serviço Strava.');
  let ledger=await readJSON(storage,'strava-imported',{});
  if(!ledger||Array.isArray(ledger)||typeof ledger!=='object')ledger={};
  let created=0,ignored=0;
  for(const activity of activities){
   const normalized=normalizeActivity(activity,athleteId);
   if(!normalized){ignored++;continue;}
   const {id,collection,data}=normalized;
   if(ledger[id])continue;
   const ref=db.collection(collection).doc(id),existing=await ref.get();
   if(!existing.exists){await ref.set(data);created++;}
   ledger[id]=true;
   await storage.set('strava-imported',JSON.stringify(ledger));
  }
  return {created,ignored};
 }
 async function synchronize({api,db,storage,now=Math.floor(Date.now()/1000)}){
  const status=await api('/status');
  if(!status.connected)return {connected:false,created:0,ignored:0};
  const athleteId=String(status.athleteId);
  if(!identifier(athleteId))throw Error('Conta inválida na resposta do Strava.');
  const previous=await readJSON(storage,'strava-state',{});
  const baseline=previous.athleteId===athleteId&&positive(previous.lastSync)?previous.lastSync-2*SECONDS_PER_DAY:now-90*SECONDS_PER_DAY;
  const after=Math.max(0,Math.floor(baseline));let created=0,ignored=0;
  for(let page=1;page<=30;page++){
   const result=await api('/activities?after='+after+'&page='+page);
   if(!result||!Array.isArray(result.activities)||typeof result.hasMore!=='boolean')throw Error('Resposta inválida do serviço Strava.');
   const imported=await importActivities(db,storage,result.activities,athleteId);created+=imported.created;ignored+=imported.ignored;
   if(!result.hasMore){await storage.set('strava-state',JSON.stringify({athleteId,lastSync:now}));return {connected:true,created,ignored,athleteId};}
  }
  throw Error('Há mais atividades do que o limite desta sincronização. O histórico importado foi preservado.');
 }
 function validateServiceUrl(value){
  let url;try{url=new URL(String(value).trim());}catch{throw Error('Informe a URL HTTPS do serviço de conexão.');}
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||!['','/'].includes(url.pathname)||url.port||url.hostname==='localhost'||url.hostname.endsWith('.localhost')||/^\d+\.\d+\.\d+\.\d+$/.test(url.hostname)||url.hostname.includes(':')||!url.hostname.includes('.'))throw Error('Use o endereço HTTPS público do serviço, sem caminho, credenciais ou parâmetros.');
  return url.origin;
 }
 root.ForjaStrava={normalizeActivity,importActivities,synchronize,validateServiceUrl};
})(globalThis);
