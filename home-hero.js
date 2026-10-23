/* Início: cartão-resumo de hoje (saudação, anel dos treinos da semana e atalho para treinar).
   Só leitura: usa números que o app já calcula; não altera dados. */
(function(root){
  'use strict';
  const $=id=>root.document.getElementById(id);
  const num=(id,def)=>{const v=parseInt((($(id)||{}).textContent||'').replace(/\D/g,''),10);return Number.isFinite(v)?v:def;};
  function render(){
    const host=$('home-hero');if(!host)return;
    const done=num('goal-ring-num',0),goal=num('weekly-goal-display',3)||3,frac=Math.min(1,done/goal);
    const h=new Date().getHours(),hi=h<5?'Boa madrugada':h<12?'Bom dia':h<18?'Boa tarde':'Boa noite';
    const dt=new Date().toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
    const streak=num('dash-streak',0),R=36,C=2*Math.PI*R;
    host.innerHTML=`<div class="hh-ring"><svg viewBox="0 0 90 90" aria-hidden="true"><circle cx="45" cy="45" r="${R}" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="8"/><circle cx="45" cy="45" r="${R}" fill="none" stroke="url(#hhg)" stroke-width="8" stroke-linecap="round" stroke-dasharray="${(C*frac).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 45 45)"/><defs><linearGradient id="hhg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff5a6e"/><stop offset="1" stop-color="#d1082a"/></linearGradient></defs></svg><b>${done}<small>/${goal}</small></b></div>
      <div class="hh-txt"><span class="hh-hi">${hi}, Daniel</span><span class="hh-date">${dt}</span><span class="hh-meta">🔥 Sequência: ${streak} dia${streak===1?'':'s'} · ${done} de ${goal} treinos na semana</span></div>
      <button type="button" class="hh-go" onclick="switchTab('academia')" aria-label="Ir para a Academia">▶<span>Treinar</span></button>`;
  }
  function init(){
    const wrap=(name)=>{const f=root[name];if(typeof f!=='function'||f.__hh)return;const w=function(){const r=f.apply(this,arguments);try{Promise.resolve(r).then(render);}catch{}render();return r;};w.__hh=true;root[name]=w;};
    wrap('renderDashboard');wrap('switchTab');
    render();
  }
  root.ForjaHomeHero={init,render};
})(typeof globalThis!=='undefined'?globalThis:this);
