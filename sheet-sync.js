/* Planilha Google como servidor: sincroniza os dados do app entre aparelhos.
   O "servidor" é um script do Google Apps Script colado numa planilha sua (arquivo
   planilha-forja.gs / botão "Copiar script" em Mais > Planilha Google). O app guarda
   cada chave de dados como uma linha da aba "dados" e mantém tudo igual em todos os
   aparelhos que usarem a mesma planilha + senha.
   Regras de sincronização (por chave de dados):
   - só mudou aqui  -> envia;  só mudou na planilha -> baixa;
   - mudou nos dois (ex.: dois aparelhos offline) -> junta listas por "id" (nada se perde) e envia o resultado.
   Chaves com segredos (chaves de API) e o treino em andamento nunca saem do aparelho. */
(function(root){
  'use strict';
  const $=(id)=>root.document&&root.document.getElementById(id);
  const store=()=>root.ForjaStorage||root.storage;
  const K_CFG='sheet-sync-config-v1',K_META='sheet-sync-meta-v1';
  const NEVER=new Set(['gemini-api-key','exercisedb-api-key','gym-active-workout-v1','active-session','sync-state-v1','exercise-media-cache-v1',K_CFG,K_META]);
  const EXTRA_KEYS=['quick-diet-shortcuts-v1'];
  let cfg=null,meta=null,busy=false,origSet=null,pushTimer=null,metaTimer=null,lastTry=0,pendingReload=false;

  // ---------- chaves sincronizadas ----------
  function allowed(){
    const df=root.ForjaDataFoundation;
    return (df&&df.ALLOWED_KEYS?df.ALLOWED_KEYS:[]).concat(EXTRA_KEYS);
  }
  function isSynced(key){
    if(!key||NEVER.has(key)||String(key).startsWith('db:'))return false;
    if(key==='progress-photos'&&!(cfg&&cfg.includePhotos))return false;
    const list=allowed();
    return list.length?list.includes(key):true;
  }
  function syncKeys(){return [...new Set(allowed())].filter(isSynced);}

  // ---------- configuração / metadados (ficam só neste aparelho) ----------
  async function rawGet(key){try{const r=await store().get(key);return r&&r.value!=null?r.value:null;}catch{return null;}}
  async function rawSet(key,value){return (origSet||store().set).call(store(),key,value);}
  async function loadCfg(){
    if(cfg)return cfg;
    const v=await rawGet(K_CFG);
    try{cfg=v?JSON.parse(v):{};}catch{cfg={};}
    if(!cfg.device)cfg.device='Aparelho-'+Math.random().toString(16).slice(2,6);
    return cfg;
  }
  async function saveCfg(){await rawSet(K_CFG,JSON.stringify(cfg));}
  async function loadMeta(){
    if(meta)return meta;
    const v=await rawGet(K_META);
    try{meta=v?JSON.parse(v):{};}catch{meta={};}
    meta.dirty=meta.dirty||{};meta.synced=meta.synced||{};
    return meta;
  }
  function persistMetaSoon(){clearTimeout(metaTimer);metaTimer=setTimeout(()=>{if(meta)rawSet(K_META,JSON.stringify(meta));},400);}
  const isGoogle=()=>!!(cfg&&cfg.mode==='google');
  const configured=()=>!!(cfg&&(isGoogle()?cfg.sheetId:(cfg.url&&cfg.token)));
  let interactiveNow=false;

  // ---------- marcar mudanças locais ----------
  function wrapStorage(){
    const s=store();if(!s||origSet)return;
    origSet=s.set;
    s.set=async function(key,value){
      const r=await origSet.call(s,key,value);
      try{if(isSynced(key))markDirty(key);}catch{}
      return r;
    };
  }
  async function markDirty(key){
    await loadMeta();
    meta.dirty[key]=1;persistMetaSoon();
    schedulePush();
  }
  function schedulePush(){
    if(!configured()||!cfg.auto)return;
    clearTimeout(pushTimer);
    pushTimer=setTimeout(()=>syncNow({auto:true}),6000);
  }

  // ---------- conversa com o script da planilha ----------
  async function call(action,payload){
    if(isGoogle()){
      const G=root.ForjaGoogleDirect;if(!G)throw new Error('Módulo do Google não carregou.');
      const had=cfg.sheetId;const r=await G.call(action,payload||{},cfg,{interactive:interactiveNow});
      if(cfg.sheetId&&cfg.sheetId!==had)await saveCfg();
      return r;
    }
    const ctrl=new AbortController();const to=setTimeout(()=>ctrl.abort(),90000);
    let res;
    try{
      res=await root.fetch(cfg.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(Object.assign({token:cfg.token,action,device:cfg.device},payload||{})),signal:ctrl.signal,redirect:'follow'});
    }catch(e){clearTimeout(to);throw new Error(e&&e.name==='AbortError'?'A planilha demorou demais pra responder.':'Sem conexão com a planilha (confira a internet e o endereço).');}
    clearTimeout(to);
    let data;
    try{data=await res.json();}catch{throw new Error('A resposta não veio do script. Confira se o endereço termina em /exec e se a implantação está como "Qualquer pessoa".');}
    if(!data||!data.ok)throw new Error((data&&data.message)||'A planilha recusou o pedido.');
    return data;
  }

  // ---------- juntar quando os dois lados mudaram ----------
  function mergeValues(localStr,remoteStr){
    let l,r;
    try{l=JSON.parse(localStr);r=JSON.parse(remoteStr);}catch{return localStr;}
    if(Array.isArray(l)&&Array.isArray(r)){
      const seen=new Map();
      const idOf=(x)=>x&&typeof x==='object'&&x.id!=null?'id:'+x.id:'js:'+JSON.stringify(x);
      r.forEach(x=>seen.set(idOf(x),x));
      l.forEach(x=>seen.set(idOf(x),x)); // neste aparelho, a versão local do mesmo item vence
      return JSON.stringify([...seen.values()]);
    }
    if(l&&r&&typeof l==='object'&&typeof r==='object'&&!Array.isArray(l)&&!Array.isArray(r))return JSON.stringify(Object.assign({},r,l));
    return localStr;
  }

  // ---------- sincronizar ----------
  function setStatus(text,kind){
    const el=$('sheet-sync-status');if(el){el.textContent=text;el.dataset.kind=kind||'';}
  }
  async function syncNow(opts){
    opts=opts||{};
    await loadCfg();await loadMeta();
    if(!configured()){if(!opts.auto)setStatus('Ainda não conectado. Toque em "Entrar com Google".','warn');return {skipped:true};}
    if(isGoogle()&&!opts.interactive&&!(root.ForjaGoogleDirect&&root.ForjaGoogleDirect.hasToken())){
      const pend=Object.keys(meta.dirty||{}).length;setStatus(pend?`${pend} mudança(s) esperando. Toque em "Sincronizar agora".`:'Conectado. Toque em "Sincronizar agora" para buscar novidades.','warn');showTapChip(true);return {skipped:true,needsTap:true};}
    interactiveNow=!!opts.interactive;
    if(busy)return {skipped:true};
    if(root.navigator&&root.navigator.onLine===false){setStatus('Sem internet agora — sincroniza quando voltar.','warn');return {skipped:true};}
    busy=true;lastTry=Date.now();
    setStatus('Sincronizando com a planilha…','busy');
    const result={pulled:0,pushed:0,merged:0};
    try{
      const remote=(await call('meta')).keys||{};
      const keys=new Set([...syncKeys(),...Object.keys(remote).filter(isSynced)]);
      const toPull=[],toPush=[],toMerge=[];
      for(const key of keys){
        const r=remote[key];const R=r?r.ts:0;const S=meta.synced[key];
        let dirty=!!meta.dirty[key];
        let localVal=null;
        if(dirty||S===undefined){
          localVal=await rawGet(key);
          if(S===undefined&&localVal!=null&&localVal!==''&&localVal!=='null')dirty=true; // 1º envio: o que já existe aqui conta como mudança
          if(localVal==null||localVal==='')dirty=false;
        }
        const remoteNew=!!r&&R>(S||0);
        if(dirty&&remoteNew)toMerge.push(key);
        else if(dirty)toPush.push(key);
        else if(remoteNew)toPull.push(key);
      }
      // baixar (e juntar)
      const need=[...toPull,...toMerge];
      const fetched={};
      for(let i=0;i<need.length;i+=4){
        const d=(await call('get',{keys:need.slice(i,i+4)})).data||{};
        Object.assign(fetched,d);
      }
      for(const key of toPull){
        const f=fetched[key];if(!f)continue;
        await rawSet(key,f.value);meta.synced[key]=f.ts;delete meta.dirty[key];result.pulled++;
      }
      for(const key of toMerge){
        const f=fetched[key];if(!f)continue;
        const merged=mergeValues(await rawGet(key),f.value);
        await rawSet(key,merged);meta.synced[key]=f.ts;meta.dirty[key]=1;toPush.push(key);result.merged++;
      }
      // enviar
      let batch=[],size=0;
      const flush=async()=>{
        if(!batch.length)return;
        const sent=batch;batch=[];size=0;
        const resp=await call('put',{items:sent});
        sent.forEach(it=>{
          if(resp.saved&&resp.saved[it.key]!=null){meta.synced[it.key]=resp.saved[it.key];delete meta.dirty[it.key];result.pushed++;}
        });
      };
      for(const key of toPush){
        const value=await rawGet(key);
        if(value==null)continue;
        const str=typeof value==='string'?value:JSON.stringify(value);
        if(size+str.length>600000)await flush();
        batch.push({key,value:str,baseTs:meta.synced[key]||0});size+=str.length;
      }
      await flush();
      meta.lastSync=Date.now();
      await rawSet(K_META,JSON.stringify(meta));
      const bits=[];
      if(result.pushed)bits.push(`${result.pushed} enviado(s)`);
      if(result.pulled)bits.push(`${result.pulled} recebido(s)`);
      if(result.merged)bits.push(`${result.merged} unido(s)`);
      if(isGoogle()){try{const st=await root.ForjaGoogleDirect.weeklyBackup(cfg);if(st)bits.push('backup semanal feito');await saveCfg();}catch(e){console.warn('backup',e);}showTapChip(false);}
      setStatus(`✅ Sincronizado às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}${bits.length?' — '+bits.join(', '):' — tudo em dia'}.`,'ok');
      if(result.pulled||result.merged){
        try{root.ForjaGymTraining&&root.ForjaGymTraining.invalidateAll&&root.ForjaGymTraining.invalidateAll();}catch{}
        showReloadBanner();
      }
    }catch(err){
      if(err&&err.code==='needs-tap')showTapChip(true);
      setStatus('⚠️ '+(err.message||'Não consegui sincronizar.'),'error');
      result.error=err.message;
    }finally{busy=false;interactiveNow=false;render();}
    return result;
  }
  function showReloadBanner(){
    pendingReload=true;
    const d=root.document;if(!d||d.getElementById('sheet-sync-banner'))return;
    const b=d.createElement('div');b.id='sheet-sync-banner';b.className='sheet-sync-banner';
    b.innerHTML='☁️ Chegaram dados novos da planilha. <button type="button" onclick="ForjaSheetSync.reloadApp()">Atualizar agora</button>';
    d.body.appendChild(b);
  }
  function reloadApp(){root.location.reload();}
  async function saveClientId(){
    const v=(($('gs-cid')||{}).value||'').trim();
    if(!/\.apps\.googleusercontent\.com$/.test(v)){setStatus('O Client ID termina em .apps.googleusercontent.com.','error');return;}
    await store().set('gdrive-client-id',v);setStatus('Client ID salvo. Agora toque em "Entrar com Google".','ok');render();
  }
  function showTapChip(on){
    const d=root.document;if(!d)return;let c=d.getElementById('sync-tap-chip');
    if(!on){if(c)c.remove();return;}
    if(c)return;
    c=d.createElement('button');c.type='button';c.id='sync-tap-chip';c.className='sync-tap-chip';c.textContent='☁️ Sincronizar';
    c.onclick=()=>syncNow({interactive:true});
    const row=d.querySelector('header .brand-row');if(row)row.appendChild(c);else d.body.appendChild(c);
  }
  async function connectGoogle(){
    await loadCfg();
    cfg.mode='google';if(cfg.auto===undefined)cfg.auto=true;
    setStatus('Abrindo o Google…','busy');
    interactiveNow=true;
    try{await root.ForjaGoogleDirect.call('meta',{},cfg,{interactive:true});}
    catch(err){interactiveNow=false;if(!cfg.sheetId)cfg.mode='';setStatus('⚠️ '+err.message,'error');render();return;}
    const nova=!!cfg.sheetNew;delete cfg.sheetNew;await saveCfg();
    setStatus(nova?'Planilha criada no seu Google Drive. Enviando seus dados…':'Achei sua planilha. Trazendo seus dados…','busy');
    await syncNow({interactive:true});
    render();
  }

  // ---------- tela (Mais > Planilha Google) ----------
  async function render(){
    await loadCfg();await loadMeta();
    const url=$('sheet-sync-url'),tok=$('sheet-sync-token'),auto=$('sheet-sync-auto'),ph=$('sheet-sync-photos'),dev=$('sheet-sync-device');
    if(url&&document.activeElement!==url)url.value=cfg.url||'';
    if(tok&&document.activeElement!==tok)tok.value=cfg.token||'';
    if(auto)auto.checked=cfg.auto!==false;
    if(ph)ph.checked=!!cfg.includePhotos;
    if(dev)dev.textContent=cfg.device;
    if(!$('sheet-sync-status'))return;
    const st=$('sheet-sync-status');
    if(!st.dataset.kind||st.dataset.kind==='init'){
      setStatus(configured()?(meta.lastSync?`Conectado. Última sincronização: ${new Date(meta.lastSync).toLocaleString('pt-BR')}.`:'Conectado. Ainda não sincronizou.'):'Ainda não conectado.',configured()?'ok':'init');
    }
    const dis=$('sheet-sync-disconnect');if(dis)dis.style.display=configured()?'block':'none';
    const gb=$('gsync-box');
    if(gb){
      const G=root.ForjaGoogleDirect;const cid=G?await G.clientId():'';
      const on=isGoogle()&&cfg.sheetId;
      gb.innerHTML=on
        ?`<div class="gs-on"><b>✅ Ligado ao seu Google Drive</b><small>${meta.lastSync?'Última sincronização: '+new Date(meta.lastSync).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'Ainda não sincronizou'}${cfg.lastBackup?' · backup semanal: '+new Date(cfg.lastBackup).toLocaleDateString('pt-BR'):''}</small></div>
           <button type="button" class="f3-cta" onclick="ForjaSheetSync.syncNow({interactive:true})">☁️ Sincronizar agora</button>
           <a class="gs-link" href="${G.sheetUrl(cfg)}" target="_blank" rel="noopener">Abrir a planilha no Google</a>`
        :`<p class="f3-nota">Seus dados ficam numa planilha no <b>seu</b> Google Drive, com cópia de segurança toda semana. Num celular novo, é só entrar com a mesma conta que tudo volta.</p>
           <button type="button" class="f3-cta" ${cid?'':'disabled'} onclick="ForjaSheetSync.connectGoogle()">Entrar com Google</button>
           ${cid?'':'<p class="f3-nota">Falta o Client ID do Google (configuração única). Cole aqui:</p><input id="gs-cid" placeholder="....apps.googleusercontent.com" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="button" class="f3-cta sec" onclick="ForjaSheetSync.saveClientId()">Salvar Client ID</button>'}`;
    }
  }
  async function connect(){
    await loadCfg();
    const url=($('sheet-sync-url')?.value||'').trim(),token=($('sheet-sync-token')?.value||'').trim();
    if(!/^https:\/\/script\.google(?:usercontent)?\.com\/.+/.test(url)){setStatus('O endereço deve começar com https://script.google.com/… e terminar em /exec.','error');return;}
    if(!token){setStatus('Digite a senha que você colocou no script.','error');return;}
    cfg.url=url;cfg.token=token;if(cfg.auto===undefined)cfg.auto=true;
    setStatus('Testando a conexão…','busy');
    try{await call('ping');}catch(err){cfg.url=cfg.url;setStatus('⚠️ '+err.message,'error');return;}
    await saveCfg();
    setStatus('Conectado! Fazendo a primeira sincronização…','busy');
    await syncNow({});
    render();
  }
  async function disconnect(){
    await loadCfg();cfg.url='';cfg.token='';if(isGoogle()){try{root.ForjaGoogleDirect.signOut();}catch{}}cfg.mode='';cfg.sheetId='';cfg.backupFolder='';await saveCfg();showTapChip(false);
    meta={dirty:{},synced:{}};await rawSet(K_META,JSON.stringify(meta));
    setStatus('Desconectado. Os dados continuam neste aparelho e na planilha.','warn');render();
  }
  async function setAuto(on){await loadCfg();cfg.auto=!!on;await saveCfg();if(on)schedulePush();}
  async function setPhotos(on){
    await loadCfg();cfg.includePhotos=!!on;await saveCfg();
    if(on){await loadMeta();delete meta.synced['progress-photos'];persistMetaSoon();}
  }
  async function copyScript(){
    const code=root.ForjaSheetScript||'';
    try{await root.navigator.clipboard.writeText(code);root.showToast&&root.showToast('Script copiado! Cole no Apps Script da planilha.');}
    catch{
      const ta=$('sheet-sync-script-box');if(ta){ta.hidden=false;ta.value=code;ta.select();root.showToast&&root.showToast('Selecione tudo e copie o script.');}
    }
  }

  // ---------- gatilhos automáticos ----------
  async function init(){
    wrapStorage();
    await loadCfg();await loadMeta();
    render();
    if(configured()&&cfg.auto!==false)setTimeout(()=>syncNow({auto:true}),2500);
    const d=root.document;
    if(d)d.addEventListener('visibilitychange',()=>{if(d.visibilityState==='visible'&&configured()&&cfg.auto!==false&&Date.now()-lastTry>60000)syncNow({auto:true});});
    root.addEventListener('online',()=>{if(configured()&&cfg.auto!==false)syncNow({auto:true});});
  }
  // o gancho de gravação precisa existir antes dos outros módulos gravarem algo
  wrapStorage();
  root.ForjaSheetSync={init,render,connect,connectGoogle,saveClientId,disconnect,showTapChip,syncNow,copyScript,setAuto,setPhotos,reloadApp,mergeValues,syncKeys,isSynced};
})(typeof globalThis!=='undefined'?globalThis:this);
