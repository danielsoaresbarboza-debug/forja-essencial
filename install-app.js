/* Instalar o app direto pelo Chrome (sem precisar de loja nem de arquivo).
   O Chrome só oferece "Instalar" quando a página é aberta por um endereço https
   (o mesmo link onde o app já está publicado) — aqui o botão aparece quando o
   navegador libera a instalação, e há um passo-a-passo de reserva caso ele não
   mostre (ou no iPhone, onde a instalação é manual pelo Safari). */
(function(root){
  'use strict';
  let deferred=null;
  const $=(id)=>root.document&&root.document.getElementById(id);
  function isStandalone(){
    try{return !!(root.matchMedia&&root.matchMedia('(display-mode: standalone)').matches)||root.navigator.standalone===true;}catch{return false;}
  }
  function isIos(){return /iphone|ipad|ipod/i.test(root.navigator.userAgent||'');}
  function render(){
    const card=$('install-app-card');if(!card)return;
    const status=$('install-app-status'),btn=$('install-app-btn'),help=$('install-app-help');
    if(isStandalone()){
      status.textContent='✅ O app já está instalado e aberto como aplicativo. As atualizações chegam sozinhas quando você abre com internet.';
      btn.style.display='none';help.style.display='none';return;
    }
    if(deferred){
      status.textContent='Instale na tela inicial do celular: abre em tela cheia, funciona sem sinal e se atualiza sozinho.';
      btn.style.display='block';help.style.display='none';return;
    }
    btn.style.display='none';help.style.display='block';
    status.textContent=isIos()
      ?'No iPhone a instalação é manual, pelo Safari:'
      :'O botão de instalar aparece aqui quando o Chrome liberar. Se não aparecer, faça manualmente:';
    help.innerHTML=isIos()
      ?'<ol class="lib-steps"><li>Abra este endereço no <b>Safari</b>.</li><li>Toque em <b>Compartilhar</b> (quadrado com seta).</li><li>Escolha <b>Adicionar à Tela de Início</b>.</li></ol>'
      :'<ol class="lib-steps"><li>Abra este endereço no <b>Google Chrome</b>.</li><li>Toque nos <b>três pontinhos ⋮</b> (canto superior).</li><li>Toque em <b>Instalar app</b> (ou <b>Adicionar à tela inicial</b>).</li></ol>';
  }
  async function install(){
    if(!deferred){render();return;}
    deferred.prompt();
    try{await deferred.userChoice;}catch{}
    deferred=null;render();
  }
  root.addEventListener('beforeinstallprompt',(e)=>{e.preventDefault();deferred=e;render();});
  root.addEventListener('appinstalled',()=>{deferred=null;render();root.showToast&&root.showToast('App instalado! Procure o ícone na tela inicial.');});
  if(root.document){
    if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',render);else render();
  }
  root.ForjaInstallApp={install,render,isStandalone};
})(typeof globalThis!=='undefined'?globalThis:this);
