/* Forja 3.0 — tutorial guiado (moldura no botão + balão "Passo X de N").
   - Tour completo das novidades: abre sozinho uma vez depois da atualização e fica em Mais.
   - Botão "?" na barra de cada seção: só os passos daquela tela.
   - Passos com "ilus" mostram um desenho da tela que ainda não está aberta (janela do exercício, descanso). */
(function(root){
'use strict';
const doc=root.document;
const S=()=>root.ForjaStorage||root.storage;
const isEss=()=>doc.body.dataset.forjaVariant==='essencial';
const VISTO='f3-tour-visto-3.0';

const ILUS={
  serie:`<div class="ti-sheet"><div class="ti-seg"><i class="on">kg</i><i>Reps</i><i>Tempo</i><i>Cardio</i></div>
    <div class="ti-sug">Você fez 3 × 10 com 40 kg. <b>Hoje: 42,5</b><em>Usar</em></div>
    <div class="ti-row f"><span>1</span><span>40 × 10</span><b>42,5</b><b>10</b><i>✓</i></div>
    <div class="ti-row c"><span>2</span><span>40 × 10</span><b>42,5</b><b>10</b><i>✓</i></div>
    <div class="ti-row p"><span>3</span><span>40 × 10</span><b>42,5</b><b>10</b><i></i></div>
    <div class="ti-cta">✓ Concluir série 2</div></div>`,
  tipos:`<div class="ti-tipos"><div><b>kg</b><small>Supino, remada</small></div><div><b>Repetições</b><small>Flexão, barra</small></div><div><b>Tempo</b><small>Prancha</small></div><div><b>Cardio</b><small>Esteira, bike</small></div></div>`,
  descanso:`<div class="ti-rest"><div class="ti-ring"><b>0:47</b><small>de 1:30</small></div><div class="ti-next"><small>PRÓXIMA</small>Supino · série 3 de 3</div><div class="ti-bts"><i>−15s</i><i>+15s</i><i class="pl">Pular</i></div></div>`,
  fim:`<div class="ti-fim"><div class="ti-chk">✓</div><div class="ti-grid"><div><b>52</b>min</div><div><b>18</b>séries</div><div><b>3.860</b>kg</div><div><b>2</b>recordes</div></div></div>`,
};

// [aba, seletor, título, texto, ilustração?]
const FULL=[
  ['inicio','#hoje3 .hoje3-p','Seu dia em três anéis','Treino, água e calorias de hoje. Os anéis fecham ao longo do dia e a frase embaixo diz o que falta.'],
  ['inicio','#hoje3 .bento4','Atalhos sempre no mesmo lugar','Lançar refeição, +250 ml de água, ir treinar e ver os suplementos. Um toque cada.'],
  ['inicio','#supl3','Suplementos num toque','Creatina marca o dia (as bolinhas mostram a semana). O whey marca e já lança as calorias e a proteína na refeição da hora. Toque de novo para desmarcar.'],
  ['inicio','.tabs','A grade de seções','No Início ela continua igual. Dentro de cada seção ela vira uma linha só, para sobrar tela.'],
  ['academia','#section-bar','Dentro de uma seção','⌂ volta ao Início. "Trocar" abre a grade para ir a outra seção. O "?" mostra este tutorial só da tela em que você está.'],
  ['academia','#ac-hoje .hj','Hoje: o treino da vez','O app sugere o próximo da sua sequência (depois do A vem o B) e mostra como foi da última vez. Um botão para começar. Em "Trocar" você escolhe outro ou faz um treino livre.'],
  ['academia','#ac-hoje .semana','A semana','Dias treinados em vermelho e a meta real da semana, já contando o que ficou faltando na semana passada.'],
  ['academia','#ac-hoje .hj-go','A janela do exercício','Cada série já vem com a carga e as repetições da última vez. Ajuste com os botões e toque em ✓ para concluir. Quando você bate a meta em todas as séries, aparece a sugestão para subir.','serie'],
  ['academia','#ac-hoje .hj-go','Quatro tipos de exercício','No topo da janela: kg, Repetições, Tempo (cronômetro para prancha) e Cardio. O app escolhe sozinho; se errar, toque no certo e ele lembra.','tipos'],
  ['academia','#ac-hoje .hj-go','Descanso em tela cheia','Começa sozinho depois de cada série. Número grande, a próxima série embaixo, −15 / +15 / Pular. A tela fica acesa e vibra antes de acabar. "Minimizar" vira uma barrinha.','descanso'],
  ['academia','#ac-hoje .hj-go','Ao finalizar','Primeiro o resultado: minutos, séries, kg e recordes. O esforço de 1 a 10 é opcional, numa linha, e já aparece qual é o próximo treino.','fim'],
  ['academia','#workout-groups-card','Meus treinos','Aqui você cria e edita os treinos A, B, C. Em "Treinos prontos" há modelos para começar.'],
  ['agua','#agua3 .copos3','Água em três botões','Copo, garrafa ou outro valor. Cada toque mostra "Desfazer" por alguns segundos, caso tenha sido sem querer.'],
  ['agua','#agua3 .ajustar3','O resto fica em Ajustar','Meta, goles, lembretes e zerar o dia. Zerar saiu da frente para não apagar sem querer.'],
  ['dieta','#diet3 .kc3','Quanto falta','O anel mostra o que você comeu e quanto falta para a meta. As barras são proteína, carboidrato e gordura.'],
  ['dieta','#diet3 .ref3','Por refeição','Toque em "+ Adicionar" na refeição. Os recentes aparecem primeiro: um toque lança. Também dá para buscar, ler o código de barras, tirar foto ou colar o texto do Gemini.'],
  ['dieta','.diet-mais-btn','O dia fecha sozinho','Não precisa mais "concluir os lançamentos". À meia-noite o dia entra no balanço da semana. As formas antigas e o histórico ficam aqui.'],
  ['corpo','.peso3','Peso','Já vem com o último peso: ajuste com os botões e registre. Em cima aparece quanto mudou na semana.'],
  ['meta','#tab-meta .f3-card','Minha meta','Peso que quer chegar, ritmo ou data e atividade por dia: tudo com − e + ou digitando o número. O app calcula quanto comer.'],
  ['meta','#metas3','Metas do dia','Treinos por semana, calorias, proteína, carboidrato, gordura e água, num lugar só. As outras telas só mostram o progresso.'],
  ['mais','#tour-mais','Pronto!','Este tutorial fica aqui em Mais. Em qualquer seção, o "?" no topo explica só aquela tela.'],
];
const ESS=[
  ['inicio','#hoje3 .hoje3-p','Seu dia em três anéis','Água, calorias comidas e calorias gastas em atividades. Eles fecham ao longo do dia.'],
  ['inicio','#hoje3 .kcal3','Quanto falta comer','A meta muda conforme você lança: o seu gasto basal + o dia a dia + as atividades, menos um pouco para emagrecer. A conta aparece aqui embaixo.'],
  ['inicio','#hoje3 .bento4','Atalhos','Lançar refeição, +250 ml de água, registrar atividade e anotar o peso. Um toque cada.'],
  ['dados','#tab-dados .f3-card','Meus dados','Os números do seu exame. Na primeira vez, toque em "Escolher arquivo do exame" e escolha o arquivo que o Daniel mandou.'],
  ['meta','#tab-meta .f3-card','Minha meta','Você escolhe o peso, o ritmo ou a data e a atividade por dia, com − e + ou digitando. Embaixo aparece o que fazer hoje e o gráfico do previsto × realizado.'],
  ['meta','#metas3','Metas do dia','Proteína e água também se ajustam aqui. Todas as metas ficam nesta aba.'],
  ['atividade','#tab-atividade .chips-tipo','Registrar atividade','Musculação, natação ou spinning. À noite, toque em ⌚ Dia no relógio e lance o total de calorias perdidas que o relógio mostrou.'],
  ['atividade','#tab-atividade .num-big','Tempo e calorias','Ajuste os minutos. O app estima as calorias pelo seu peso; se o relógio ou a bike mostrou outro número, corrija com − e +.'],
  ['atividade','#tab-atividade .f3-cta','Registrar','Um toque e a meta de comida do dia já aumenta. O total do relógio fica só como registro. Errou? Toque em "Desfazer" no aviso.'],
  ['dieta','#diet3 .ref3','Comida por refeição','Toque em "+ Adicionar" na refeição. O que você já lançou aparece primeiro: um toque e pronto. Também dá para buscar o alimento, ler o código de barras ou tirar foto.'],
  ['agua','#agua3 .copos3','Água','Copo, garrafa ou outro valor. Cada toque tem "Desfazer".'],
  ['corpo','.peso3','Peso','Já vem com o último peso: ajuste e registre. Em cima aparece quanto mudou na semana.'],
  ['mais','#tour-mais','Pronto!','Este tutorial fica aqui em Mais. Em qualquer tela, o "?" no topo explica só aquela tela.'],
];
const passosTodos=()=>isEss()?ESS:FULL;

let est=null;
function vis(sel){return [...doc.querySelectorAll(sel)].find(e=>e.offsetParent!==null||getComputedStyle(e).position==='fixed');}
function abaAtual(){const a=doc.querySelector('.tabs .tab.active');return a?a.dataset.tab:'inicio';}
function iniciar(soAba){
  fecharBoasVindas();
  const lista=soAba?passosTodos().filter(p=>p[0]===soAba):passosTodos().slice();
  if(!lista.length){root.showToast?.('Esta tela ainda não tem tutorial.');return;}
  est={lista,i:0,soAba:!!soAba};
  try{root.history.pushState({tour3:1},'');}catch{}
  mostrar();
}
function limpar(){doc.getElementById('tour3-moldura')?.remove();doc.getElementById('tour3-balao')?.remove();doc.getElementById('tour3-fundo')?.remove();}
async function mostrar(){
  limpar();if(!est)return;
  const [aba,sel,tit,txt,ilus]=est.lista[est.i];
  if(abaAtual()!==aba){root.switchTab?.(aba);await new Promise(r=>setTimeout(r,450));}
  let el=vis(sel);
  if(!el){if(est.i<est.lista.length-1){est.i++;return mostrar();}el=null;}
  const f=doc.createElement('div');f.id='tour3-fundo';f.addEventListener('click',e=>e.stopPropagation());
  const m=doc.createElement('div');m.id='tour3-moldura';
  const b=doc.createElement('div');b.id='tour3-balao';b.setAttribute('role','dialog');b.setAttribute('aria-live','polite');b.setAttribute('aria-label',tit);
  const n=est.lista.length,i=est.i;
  b.innerHTML=`<div class="t3-pp">PASSO ${i+1} DE ${n}</div><h3>${tit}</h3><p>${txt}</p>${ilus?`<div class="t3-ilus">${ILUS[ilus]}</div>`:''}
    <div class="t3-bar"><i style="width:${Math.round((i+1)/n*100)}%"></i></div>
    <div class="t3-bts"><button type="button" class="t3-sair">Sair</button><span></span>${i?'<button type="button" class="t3-ant">← Anterior</button>':''}<button type="button" class="t3-prox">${i<n-1?'Próximo →':'Terminar'}</button></div>`;
  b.style.visibility='hidden';doc.body.append(f,m,b);
  const bh=b.offsetHeight,bw=b.offsetWidth,M=12;
  if(el){
    // coloca o elemento perto do topo e corta a moldura para o balão caber embaixo
    let r0=el.getBoundingClientRect();const alvo=64;
    if(getComputedStyle(el).position!=='fixed'){root.scrollBy(0,r0.top-alvo);await new Promise(rs=>setTimeout(rs,40));}
    const r=el.getBoundingClientRect();
    let fh=Math.min(r.height,Math.max(48,innerHeight-bh-r.top-M*3));
    let top=r.top+fh+16;
    if(top+bh>innerHeight-M){ // não coube embaixo: tenta em cima
      if(r.top-bh-16>=M)top=r.top-bh-16;else top=Math.max(M,innerHeight-bh-M);
    }
    Object.assign(m.style,{left:(r.left-6)+'px',top:(r.top-6)+'px',width:(r.width+12)+'px',height:(fh+12)+'px'});
    b.style.top=top+'px';b.style.left=Math.max(M,Math.min(r.left,innerWidth-bw-M))+'px';
  }else{m.classList.add('sem');b.style.top=Math.max(M,(innerHeight-bh)/2)+'px';b.style.left=Math.max(M,(innerWidth-bw)/2)+'px';}
  b.style.visibility='';
  b.querySelector('.t3-sair').onclick=()=>fechar();
  b.querySelector('.t3-prox').onclick=()=>{if(est.i<est.lista.length-1){est.i++;mostrar();}else fechar(false,true);};
  const a=b.querySelector('.t3-ant');if(a)a.onclick=()=>{est.i--;mostrar();};
  b.querySelector('.t3-prox').focus({preventScroll:true});
}
async function fechar(fromPop,terminou){
  const eraCompleto=est&&!est.soAba;limpar();est=null;
  if(!fromPop){try{if(root.history.state&&root.history.state.tour3)root.history.back();}catch{}}
  try{await S().set(VISTO,'1');}catch{}
  if(terminou&&eraCompleto){root.switchTab?.('inicio');root.showToast?.('Tutorial concluído. Ele fica em Mais quando quiser rever.');}
}
root.addEventListener('popstate',()=>{if(est)fechar(true);});
root.addEventListener('resize',()=>{if(est)mostrar();});
doc.addEventListener('keydown',e=>{if(!est)return;if(e.key==='Escape')fechar();else if(e.key==='ArrowRight')doc.querySelector('#tour3-balao .t3-prox')?.click();else if(e.key==='ArrowLeft')doc.querySelector('#tour3-balao .t3-ant')?.click();});

function boasVindas(){
  if(doc.getElementById('tour3-bv'))return;
  const d=doc.createElement('div');d.id='tour3-bv';
  const itens=isEss()
    ?['Seu dia em três anéis: água, comida e atividade','Meta de calorias que muda conforme você lança','Meus dados com o seu exame']
    :['Academia: o treino da vez, séries pré-preenchidas e descanso em tela cheia','Início com anéis do dia e suplementos num toque','Água, comida e peso mais rápidos de lançar'];
  d.innerHTML=`<div class="bv-caixa" role="dialog" aria-label="Novidades"><div class="bv-selo">3.0</div><h2>${isEss()?'Bem-vinda ao Forja':'O Forja mudou'}</h2>
    <ul>${itens.map(x=>`<li>${x}</li>`).join('')}</ul>
    <button type="button" class="bv-sim">Fazer o tour (1 minuto)</button><button type="button" class="bv-nao">Agora não</button>
    <p>O tour também fica em Mais.</p></div>`;
  doc.body.appendChild(d);
  d.querySelector('.bv-sim').onclick=()=>iniciar();
  d.querySelector('.bv-nao').onclick=async()=>{fecharBoasVindas();try{await S().set(VISTO,'1');}catch{}root.showToast?.('Quando quiser, o tour está em Mais.');};
}
function fecharBoasVindas(){doc.getElementById('tour3-bv')?.remove();}

function montar(){
  const bar=doc.getElementById('section-bar');
  if(bar&&!doc.getElementById('sb-ajuda')){const b=doc.createElement('button');b.type='button';b.id='sb-ajuda';b.className='sb-ajuda';b.setAttribute('aria-label','Como usar esta tela');b.textContent='?';b.onclick=()=>iniciar(abaAtual());bar.insertBefore(b,doc.getElementById('sb-trocar'));}
  const mais=doc.getElementById('tab-mais');
  if(mais&&!doc.getElementById('tour-mais')){
    const c=doc.createElement('div');c.id='tour-mais';c.className='f3-card tour-mais';
    c.innerHTML=`<div class="f3-t">Tutorial</div><p class="f3-nota">Uma volta rápida pelas telas novas, mostrando cada botão.</p><button type="button" class="f3-cta sec" id="tour-mais-btn">▶ Ver o tutorial</button>`;
    mais.prepend(c);
    c.querySelector('#tour-mais-btn').onclick=()=>iniciar();
  }
}
async function init(){
  montar();
  let visto=null;try{visto=(await S().get(VISTO))?.value;}catch{}
  if(!visto&&!root.__semTour)setTimeout(boasVindas,900);
}
root.ForjaTour={iniciar,fechar,init,boasVindas,FULL,ESS};
// eslint-disable-next-line no-undef
if(typeof forjaInitialization!=='undefined'&&forjaInitialization.then)forjaInitialization.then(()=>setTimeout(init,300)).catch(()=>{}); else root.addEventListener('load',init);
})(typeof globalThis!=='undefined'?globalThis:this);
