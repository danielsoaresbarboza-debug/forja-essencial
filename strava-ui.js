(function(root){
 'use strict';
 const storage=root.ForjaStorage;
 let service='',session=null,ready=false,busy=null,lastAttempt=0,pendingAuth=false,initialized=false;
 const element=id=>document.getElementById(id);
 function message(text){for(const id of ['strava-status','corrida-strava-status','natacao-strava-status']){const el=element(id);if(el)el.textContent=text;}}
 function buttons(){
  for(const [id,disabled]of [['strava-save',!!busy],['strava-connect',!!busy||!service||!ready||!!session&&!pendingAuth],['strava-sync',!!busy||!session],['strava-disconnect',!!busy||!session]]){const el=element(id);if(el)el.disabled=disabled;}
  const connectButton=element('strava-connect');if(connectButton)connectButton.textContent=pendingAuth?'Repetir autorização no Strava':'Conectar ao Strava';
  const privacy=element('strava-privacy');if(privacy)privacy.textContent=service?'Ao conectar, você autoriza o Strava a disponibilizar seus treinos ao serviço '+service+'. Os registros locais do Forja.Treino não são enviados.':'A conexão precisa de um serviço publicado em uma conta sua. Nenhuma credencial do Strava deve ser inserida no aplicativo.';
 }
 async function request(path,{method='GET',body,authenticated=true,url=service}={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),20000);
  const headers={Accept:'application/json'};
  if(body!==undefined)headers['Content-Type']='application/json';
  if(authenticated&&session)headers.Authorization='Bearer '+session.token;
  try{
   const response=await root.fetch(url+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal,credentials:'omit',redirect:'error',cache:'no-store'});
   let result;try{result=await response.json();}catch{throw Error('O serviço não retornou uma resposta válida.');}
   if(!response.ok){const error=Error(response.status===401?'Conexão expirada ou revogada. Conecte sua conta novamente.':response.status===429?'Limite do Strava atingido. Tente mais tarde.':response.status===503?'Serviço indisponível ou configuração pendente. Confira a configuração e tente novamente.':'Não foi possível concluir a solicitação ao serviço. Confira a configuração.');error.status=response.status;throw error;}
   return result;
  }catch(error){if(error.name==='AbortError')throw Error('O serviço demorou para responder. Tente novamente.');if(error instanceof TypeError)throw Error('Não foi possível acessar o serviço. Verifique a internet e a configuração.');throw error;}finally{clearTimeout(timer);}
 }
 async function health(url=service){const result=await request('/health',{authenticated:false,url});if(result.service!=='forja-strava'||result.version!==1)throw Error('Este endereço não é um serviço de conexão do Forja.Treino.');return result.ready===true;}
 async function saveService(){
  if(busy)return;
  try{
   const next=root.ForjaStrava.validateServiceUrl(element('strava-service-url').value);
   if(session&&next!==service)throw Error('Desconecte a conta antes de trocar o endereço do serviço.');
   const configured=await health(next);await storage.set('strava-service-url',next);service=next;ready=configured;await root.ForjaDietFlow?.refreshAIStatus?.();
   message(ready?'Serviço configurado. Toque em Conectar ao Strava.':'Endereço salvo. O serviço ainda precisa das credenciais e do cadastro Strava.');
  }catch(error){message(error.message);}finally{buttons();}
 }
 async function clearSession(){session=null;pendingAuth=false;await storage.delete('strava-session');}
 async function connect(){
  if(busy||session&&!pendingAuth||!service||!ready)return;
  busy=(async()=>{
   if(session){try{await request('/disconnect',{method:'POST',body:{}});}catch(error){if(error.status!==401)throw error;}await clearSession();}
   const result=await request('/connect',{method:'POST',body:{},authenticated:false});
   if(!/^[a-f0-9]{64}$/.test(result.session||''))throw Error('O serviço não retornou uma sessão válida.');
   const auth=new URL(result.authorizationUrl);
   if(auth.protocol!=='https:'||auth.hostname!=='www.strava.com'||auth.pathname!=='/oauth/authorize'||auth.username||auth.password||auth.port)throw Error('O serviço retornou uma URL de autorização inválida.');
   const redirect=new URL(auth.searchParams.get('redirect_uri'));
   if(redirect.origin!==service||redirect.pathname!=='/oauth/callback'||redirect.search||redirect.hash)throw Error('O retorno da autorização não corresponde ao serviço configurado.');
   session={token:result.session,pending:true};pendingAuth=true;await storage.set('strava-session',JSON.stringify(session));
   message('Autorize no Strava e volte ao aplicativo usando o botão Voltar.');
   if(root.Capacitor?.isNativePlatform?.()){
    const browser=root.Capacitor.Plugins?.Browser;
    if(!browser?.open)throw Error('A abertura do navegador não está disponível. Atualize o aplicativo.');
    await browser.open({url:auth.href});
   }else{
    const opened=root.open(auth.href,'_blank','noopener,noreferrer');
    // Some browsers return null for noopener even when the page opened.
   }
  })();buttons();
  try{await busy;}catch(error){message(error.message);}finally{busy=null;buttons();}
 }
 async function sync(force=false){
  if(busy)return busy;
  if(!session){message(service?'Toque em Conectar ao Strava para autorizar sua conta.':'Conexão pendente: configure o serviço na aba Mais.');buttons();return;}
  if(!force&&Date.now()-lastAttempt<5*60*1000)return;
  lastAttempt=Date.now();
  busy=(async()=>{
   message('Buscando treinos no Strava…');
   const result=await root.ForjaStrava.synchronize({api:path=>request(path),db:root.ForjaDB,storage});
   if(!result.connected){pendingAuth=true;message('Autorização pendente. Conclua no Strava e volte ao app.');return;}
   pendingAuth=false;session.pending=false;await storage.set('strava-session',JSON.stringify(session));
   const date=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});
   message(result.created?result.created+' treino(s) importado(s) do Strava.':'Strava sincronizado às '+date+'. Nenhum treino novo.');
   if(typeof root.renderDashboard==='function')await root.renderDashboard();
  })();buttons();
  try{return await busy;}catch(error){if(error.status===401)await clearSession();message(error.message);}finally{busy=null;buttons();}
 }
 async function disconnect(){
  if(busy||!session)return;
  busy=request('/disconnect',{method:'POST',body:{}});buttons();
  try{await busy;await clearSession();message('Conexão removida deste aparelho. Os treinos locais foram mantidos.');}
  catch(error){if(error.status===401){await clearSession();message('A conexão já estava expirada. Os treinos locais foram mantidos.');}else message(error.message);}
  finally{busy=null;buttons();}
 }
 async function init(){
  if(initialized)return;initialized=true;
  const configured=await storage.get('strava-service-url');
  if(configured){try{service=root.ForjaStrava.validateServiceUrl(configured.value);}catch{service='';}}
  const saved=await storage.get('strava-session');
  if(saved&&service){try{const value=JSON.parse(saved.value);if(/^[a-f0-9]{64}$/.test(value.token)){session=value;pendingAuth=!!value.pending;}}catch{}}
  element('strava-service-url').value=service;
  for(const [id,handler]of [['strava-save',saveService],['strava-connect',connect],['strava-sync',()=>sync(true)],['strava-disconnect',disconnect]])element(id).addEventListener('click',handler);
  buttons();message(!service?'Conexão pendente: configure o serviço na aba Mais.':session?'Conexão salva. Verificando Strava…':'Verificando configuração do serviço…');
  if(service){try{ready=await health();if(!ready)message('O serviço ainda precisa ser configurado.');else if(!session)message('Serviço configurado. Toque em Conectar ao Strava.');}catch(error){message(error.message);}buttons();}
 }
 root.ForjaStravaUI={init,saveService,connect,sync,disconnect};
 root.syncStrava=()=>sync(false);root.syncStravaNatacao=()=>sync(false);
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')sync(pendingAuth);});
 root.addEventListener('online',()=>sync(pendingAuth));
 if(root.Capacitor?.isNativePlatform?.()){
  const app=root.Capacitor.Plugins?.App;
  if(app?.addListener)Promise.resolve(app.addListener('appStateChange',state=>{if(state.isActive)sync(pendingAuth);})).catch(()=>{});
 }
 // Invoked by the page after all scripts and the existing local initialization.
})(globalThis);
