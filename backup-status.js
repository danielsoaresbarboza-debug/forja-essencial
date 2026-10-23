/* Aviso de backup não confirmado — lembra quando foi a última vez que o
   usuário efetivamente copiou/compartilhou/exportou um backup, pra evitar a
   falsa sensação de segurança de "já fiz backup" quando na real só abriu a
   tela. Fica salvo neste aparelho (window.storage/ForjaStorage), nunca entra
   no próprio backup. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.ForjaBackupStatus=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const KEY='backup-last-confirmed-v1';
  const METHOD_LABEL={copiado:'copiado',compartilhado:'compartilhado',exportado:'baixado',nuvem:'enviado ao Google Drive'};
  const STALE_DAYS=14;

  async function read(){
    try{
      const row = await (root.ForjaStorage||root.storage)?.get?.(KEY);
      return row?.value ? JSON.parse(row.value) : null;
    }catch{ return null; }
  }

  async function render(){
    const el = root.document?.getElementById('backup-last-confirmed');
    if(!el) return;
    try{
      const saved = await read();
      const time = Date.parse(saved?.at||'');
      if(!Number.isFinite(time)){
        el.textContent = 'Nenhuma cópia confirmada neste aparelho. Toque em copiar, exportar ou compartilhar abaixo e guarde o backup fora do app.';
        el.classList.add('backup-status-warn');
        return;
      }
      const days = Math.floor((Date.now()-time)/86400000);
      const label = METHOD_LABEL[saved.method]||saved.method;
      const when = new Date(time).toLocaleString('pt-BR');
      if(days >= STALE_DAYS){
        el.textContent = `Último backup ${label} há ${days} dias (${when}). Considere fazer um novo e guardar fora do aplicativo.`;
        el.classList.add('backup-status-warn');
      } else {
        el.textContent = `Último backup ${label}: ${when}. Confirme que guardou uma cópia fora do aplicativo.`;
        el.classList.remove('backup-status-warn');
      }
    }catch{
      el.textContent = 'Não foi possível conferir a última cópia do backup.';
    }
  }

  async function confirm(method, at=new Date().toISOString()){
    if(!['copiado','compartilhado','exportado','nuvem'].includes(method)) return false;
    try{
      await (root.ForjaStorage||root.storage).set(KEY, JSON.stringify({method,at}));
      await render();
      return true;
    }catch{ return false; }
  }

  return {KEY, render, confirm};
});
