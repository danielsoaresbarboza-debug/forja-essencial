/* Planilha Google SEM Apps Script: o app fala direto com a API do Google Sheets/Drive
   depois de um toque em "Entrar com Google" (Google Identity Services, escopo drive.file).
   - Usa o mesmo formato da aba "dados" do planilha-forja.gs (chave · atualizado_em · aparelho · partes · conteúdo "J…"),
     então a mesma lógica de sincronização (sheet-sync.js) serve para os dois modos.
   - Num aparelho novo, depois de entrar com a mesma conta, procura a planilha que o próprio app criou e puxa tudo.
   - Backup semanal: cópia da planilha numa pasta "<App> — Backups" no Drive, guardando as 8 mais recentes.
   O Client ID (público, não é segredo) vem de window.FORJA_GOOGLE_CLIENT_ID (google-config.js)
   ou, se vazio, do que foi colado em Mais (chave 'gdrive-client-id'). */
(function(root){
'use strict';
const SHEETS='https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE='https://www.googleapis.com/drive/v3/files';
const SCOPE='https://www.googleapis.com/auth/drive.file';
const ABA='dados',CHUNK=45000,KEEP_BACKUPS=8;
const ESPELHOS={'workouts':'Treinos','diet-log':'Dieta','body-log':'Peso','scale-log':'Balança','f3-activities':'Atividades'};
let token=null,tokenExp=0,tokenClient=null,pending=null;
const store=()=>root.ForjaStorage||root.storage;

function appName(){return root.document?.body?.dataset?.forjaVariant==='essencial'?'Forja Essencial':'Forja';}
function sheetTitle(){return `${appName()} — dados`;}
async function clientId(){
  if(root.FORJA_GOOGLE_CLIENT_ID)return root.FORJA_GOOGLE_CLIENT_ID;
  const PADRAO='593347618330-cq521tq56qr5d74mb12oj0l9s4lt1bkf.apps.googleusercontent.com'; // DZ Apps
  try{const r=await store().get('gdrive-client-id');return r&&r.value?String(r.value).trim():PADRAO;}catch{return PADRAO;}
}
function gisReady(){return !!(root.google&&root.google.accounts&&root.google.accounts.oauth2);}
async function waitGis(ms=6000){const t0=Date.now();while(!gisReady()&&Date.now()-t0<ms)await new Promise(r=>setTimeout(r,150));return gisReady();}
const hasToken=()=>!!token&&Date.now()<tokenExp-60000;

// Pede o token. interactive=true só a partir de um toque (senão o navegador bloqueia a janelinha).
async function getToken(interactive){
  if(hasToken())return token;
  if(!interactive){const e=new Error('Toque em "Sincronizar" para entrar no Google de novo.');e.code='needs-tap';throw e;}
  const cid=await clientId();
  if(!cid){const e=new Error('Falta o Client ID do Google (configuração do Daniel, uma vez só).');e.code='no-client';throw e;}
  if(!await waitGis()){throw new Error('Não consegui carregar o login do Google. Confira a internet.');}
  if(!tokenClient||tokenClient._cid!==cid){
    tokenClient=root.google.accounts.oauth2.initTokenClient({client_id:cid,scope:SCOPE,callback:(resp)=>{
      const p=pending;pending=null;if(!p)return;
      if(resp&&resp.access_token){token=resp.access_token;tokenExp=Date.now()+(Number(resp.expires_in)||3600)*1000;p.resolve(token);}
      else p.reject(new Error(resp&&resp.error==='access_denied'?'Acesso ao Google não autorizado.':'Não consegui entrar no Google.'));
    },error_callback:(err)=>{const p=pending;pending=null;if(p)p.reject(new Error(err&&err.type==='popup_closed'?'Janela do Google fechada antes de terminar.':'Não consegui abrir o login do Google.'));}});
    tokenClient._cid=cid;
  }
  return new Promise((resolve,reject)=>{pending={resolve,reject};try{tokenClient.requestAccessToken({prompt:''});}catch(e){pending=null;reject(e);}});
}
function signOut(){try{if(token&&root.google?.accounts?.oauth2?.revoke)root.google.accounts.oauth2.revoke(token,()=>{});}catch{}token=null;tokenExp=0;}

async function api(url,opts={},tok){
  const res=await root.fetch(url,{...opts,headers:{'Authorization':'Bearer '+tok,'Content-Type':'application/json',...(opts.headers||{})}});
  if(res.status===401){token=null;tokenExp=0;const e=new Error('O acesso ao Google expirou. Toque em "Sincronizar".');e.code='needs-tap';throw e;}
  if(!res.ok){let m='';try{m=(await res.json()).error?.message||'';}catch{}throw new Error('Google recusou o pedido'+(m?': '+m:'.'));}
  if(res.status===204)return {};
  return res.json();
}
const q=s=>encodeURIComponent(s);
const colLetter=n=>{let s='';n++;while(n>0){const m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26);}return s;}; // 0 -> A

// ---------- planilha ----------
async function findSheet(tok){
  const query=`name='${sheetTitle().replace(/'/g,"\\'")}' and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`;
  const r=await api(`${DRIVE}?q=${q(query)}&orderBy=modifiedTime desc&fields=files(id,name,modifiedTime)&pageSize=5`,{},tok);
  return r.files&&r.files[0]?r.files[0].id:null;
}
async function createSheet(tok){
  const r=await api(SHEETS,{method:'POST',body:JSON.stringify({properties:{title:sheetTitle(),locale:'pt_BR'},sheets:[{properties:{title:ABA,gridProperties:{frozenRowCount:1,columnCount:8}}}]})},tok);
  await api(`${SHEETS}/${r.spreadsheetId}/values/${q(ABA+'!A1:E1')}?valueInputOption=RAW`,{method:'PUT',body:JSON.stringify({values:[['chave','atualizado_em','aparelho','partes','conteudo (não edite esta aba)']]})},tok);
  return r.spreadsheetId;
}
async function sheetInfo(id,tok){
  const r=await api(`${SHEETS}/${id}?fields=sheets(properties(sheetId,title,gridProperties))`,{},tok);
  return r.sheets.map(s=>s.properties);
}
async function readIndex(id,tok){
  const r=await api(`${SHEETS}/${id}/values/${q(ABA+'!A2:D')}?valueRenderOption=UNFORMATTED_VALUE`,{},tok);
  const idx={};(r.values||[]).forEach((v,i)=>{if(v[0]!==''&&v[0]!=null)idx[String(v[0])]={row:i+2,ts:Number(v[1])||0,partes:Number(v[3])||0};});
  return idx;
}

// ---------- ações (mesmo contrato do Apps Script) ----------
async function call(action,payload,cfg,opts={}){
  const tok=await getToken(!!opts.interactive);
  if(action==='ping')return {ok:true};
  let id=cfg.sheetId;
  if(!id){id=await findSheet(tok)||await createSheet(tok);cfg.sheetId=id;cfg.sheetNew=true;}
  if(action==='meta'){const idx=await readIndex(id,tok);const keys={};Object.keys(idx).forEach(k=>keys[k]={ts:idx[k].ts,partes:idx[k].partes});return {ok:true,keys};}
  if(action==='get'){
    const idx=await readIndex(id,tok);const want=(payload.keys||[]).filter(k=>idx[k]);const data={};
    if(!want.length)return {ok:true,data};
    const ranges=want.map(k=>`${ABA}!E${idx[k].row}:${colLetter(3+Math.max(1,idx[k].partes))}${idx[k].row}`);
    const r=await api(`${SHEETS}/${id}/values:batchGet?${ranges.map(x=>'ranges='+q(x)).join('&')}&valueRenderOption=UNFORMATTED_VALUE`,{},tok);
    (r.valueRanges||[]).forEach((vr,i)=>{const k=want[i];const parts=(vr.values&&vr.values[0])||[];data[k]={ts:idx[k].ts,value:parts.slice(0,idx[k].partes).map(p=>String(p).slice(1)).join('')};});
    return {ok:true,data};
  }
  if(action==='put'){
    const idx=await readIndex(id,tok);const saved={},conflicts=[];const now=Date.now();
    let nextRow=Math.max(1,...Object.values(idx).map(x=>x.row))+1;
    const data=[];let maxCols=5;
    (payload.items||[]).forEach((it,n)=>{
      const key=String(it.key||'');if(!key)return;const cur=idx[key];
      if(cur&&it.baseTs!==undefined&&cur.ts>Number(it.baseTs)){conflicts.push(key);return;}
      const val=String(it.value==null?'':it.value);const parts=[];
      for(let i=0;i<val.length;i+=CHUNK)parts.push('J'+val.slice(i,i+CHUNK));if(!parts.length)parts.push('J');
      const width=4+Math.max(parts.length,cur?cur.partes:0);maxCols=Math.max(maxCols,width);
      const ts=Math.max(now+n,cur?cur.ts+1:0);
      const line=[key,ts,cfg.device||'',parts.length,...parts];while(line.length<width)line.push('');
      const row=cur?cur.row:nextRow++;
      data.push({range:`${ABA}!A${row}:${colLetter(width-1)}${row}`,values:[line]});
      idx[key]={row,ts,partes:parts.length};saved[key]=ts;
    });
    if(data.length){
      const props=(await sheetInfo(id,tok)).find(s=>s.title===ABA);
      const grid=props.gridProperties||{};const needCols=maxCols-(grid.columnCount||0),needRows=(nextRow-1)-(grid.rowCount||0);
      const reqs=[];
      if(needCols>0)reqs.push({appendDimension:{sheetId:props.sheetId,dimension:'COLUMNS',length:needCols}});
      if(needRows>0)reqs.push({appendDimension:{sheetId:props.sheetId,dimension:'ROWS',length:needRows+20}});
      if(reqs.length)await api(`${SHEETS}/${id}:batchUpdate`,{method:'POST',body:JSON.stringify({requests:reqs})},tok);
      await api(`${SHEETS}/${id}/values:batchUpdate`,{method:'POST',body:JSON.stringify({valueInputOption:'RAW',data})},tok);
      for(const it of payload.items||[]){if(ESPELHOS[it.key]&&saved[it.key]!=null){try{await mirror(id,tok,it.key,String(it.value));}catch(e){console.warn('espelho',e);}}}
    }
    return {ok:true,saved,conflicts};
  }
  throw new Error('Ação desconhecida.');
}

// cópia legível (só leitura) das listas principais
async function mirror(id,tok,key,json){
  let arr;try{arr=JSON.parse(json);}catch{return;}if(!Array.isArray(arr))return;
  const name=ESPELHOS[key];const rows=arr.slice(-5000).filter(o=>o&&typeof o==='object');
  const cols=[];rows.forEach(o=>Object.keys(o).forEach(k=>{if(!cols.includes(k)&&!/photo|foto|image|dataUrl/i.test(k))cols.push(k);}));
  const sheets=await sheetInfo(id,tok);
  if(!sheets.find(s=>s.title===name))await api(`${SHEETS}/${id}:batchUpdate`,{method:'POST',body:JSON.stringify({requests:[{addSheet:{properties:{title:name,gridProperties:{frozenRowCount:1}}}}]})},tok);
  await api(`${SHEETS}/${id}/values/${q(name)}:clear`,{method:'POST',body:'{}'},tok);
  if(!cols.length)return;
  const values=[cols,...rows.map(o=>cols.map(k=>{const v=o[k];return v==null?'':(typeof v==='object'?JSON.stringify(v):v);}))];
  const info=(await sheetInfo(id,tok)).find(s=>s.title===name);const g=info.gridProperties||{};
  const reqs=[];if((g.rowCount||0)<values.length)reqs.push({appendDimension:{sheetId:info.sheetId,dimension:'ROWS',length:values.length-(g.rowCount||0)+10}});
  if((g.columnCount||0)<cols.length)reqs.push({appendDimension:{sheetId:info.sheetId,dimension:'COLUMNS',length:cols.length-(g.columnCount||0)}});
  if(reqs.length)await api(`${SHEETS}/${id}:batchUpdate`,{method:'POST',body:JSON.stringify({requests:reqs})},tok);
  await api(`${SHEETS}/${id}/values/${q(name+'!A1')}?valueInputOption=RAW`,{method:'PUT',body:JSON.stringify({values})},tok);
}

// ---------- backup semanal no Drive ----------
async function weeklyBackup(cfg,force){
  if(!cfg.sheetId||!hasToken())return null;
  const last=cfg.lastBackup||0;if(!force&&Date.now()-last<7*864e5)return null;
  const tok=token;const folderName=`${appName()} — Backups`;
  let folder=cfg.backupFolder;
  if(!folder){
    const r=await api(`${DRIVE}?q=${q(`name='${folderName}' and mimeType='application/vnd.google-apps.folder' and trashed=false`)}&fields=files(id)`,{},tok);
    folder=r.files&&r.files[0]?r.files[0].id:(await api(`${DRIVE}?fields=id`,{method:'POST',body:JSON.stringify({name:folderName,mimeType:'application/vnd.google-apps.folder'})},tok)).id;
    cfg.backupFolder=folder;
  }
  const newest=await api(`${DRIVE}?q=${q(`'${folder}' in parents and trashed=false`)}&orderBy=createdTime desc&fields=files(id,createdTime)&pageSize=1`,{},tok);
  const nt=newest.files&&newest.files[0]?Date.parse(newest.files[0].createdTime):0;
  if(!force&&nt&&Date.now()-nt<7*864e5){cfg.lastBackup=nt;return null;} // outro aparelho já fez o desta semana
  const d=new Date();const stamp=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  await api(`${DRIVE}/${cfg.sheetId}/copy?fields=id`,{method:'POST',body:JSON.stringify({name:`${appName()} — backup ${stamp}`,parents:[folder]})},tok);
  const list=await api(`${DRIVE}?q=${q(`'${folder}' in parents and trashed=false`)}&orderBy=createdTime desc&fields=files(id,name,createdTime)&pageSize=50`,{},tok);
  for(const f of (list.files||[]).slice(KEEP_BACKUPS)){try{await api(`${DRIVE}/${f.id}`,{method:'DELETE'},tok);}catch{}}
  cfg.lastBackup=Date.now();return stamp;
}
function sheetUrl(cfg){return cfg&&cfg.sheetId?`https://docs.google.com/spreadsheets/d/${cfg.sheetId}/edit`:'';}

root.ForjaGoogleDirect={call,getToken,hasToken,signOut,weeklyBackup,sheetUrl,clientId,sheetTitle,appName};
})(typeof globalThis!=='undefined'?globalThis:this);
