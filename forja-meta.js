/* Forja — Meta de peso: quanto quero pesar, em quanto tempo, quanto comer e gastar por dia.
   Conta usada: 1 kg de peso corporal ≈ 7.700 kcal. Gasto do corpo = basal × 1,2 (dia a dia) + atividades.
   Guarda em 'f3-objetivo'. Ao salvar, liga a meta de comida automática ('f3-metas', modo dinâmico). */
(function(root){
'use strict';
const doc=root.document,$=id=>doc.getElementById(id);
const S=()=>root.storage;
const KCAL_KG=7700;
async function getJ(k,d){try{const r=await S().get(k);return r&&r.value?JSON.parse(r.value):d;}catch{return d;}}
async function setJ(k,v){await S().set(k,JSON.stringify(v));}
const tk=(d=new Date())=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const pd=k=>{const [y,m,d]=k.split('-').map(Number);return new Date(y,m-1,d,12);};
const nf=n=>Math.round(n||0).toLocaleString('pt-BR');
const kg=n=>(Math.round(n*10)/10).toLocaleString('pt-BR',{minimumFractionDigits:1,maximumFractionDigits:1});
const MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const dataCurta=d=>`${d.getDate()} ${MES[d.getMonth()]}${d.getFullYear()!==new Date().getFullYear()?' '+d.getFullYear():''}`;
const mesAno=d=>`${MES[d.getMonth()]} ${d.getFullYear()}`;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tap=()=>{try{navigator.vibrate?.(8);}catch{}};
const toast=(m,a)=>root.showToast?.(m,a);
const isEss=()=>doc.body.dataset.forjaVariant==='essencial';

const RITMOS=[{v:.25,l:'Leve'},{v:.5,l:'Recomendado'},{v:.75,l:'Firme'},{v:1,l:'Intenso'}];
const PRAZOS=[[1,'1 mês'],[3,'3 meses'],[6,'6 meses'],[12,'1 ano']];
const ATIV=[0,150,250,400,600];

let draft=null,editando=false,salvoCache=null; // edição em andamento (salva só no botão)

async function pesos(){
  const arr=await root.loadBody();
  return arr.filter(e=>e.type==='weight').map(e=>({d:e.date,t:e.time||'00:00',v:parseFloat(String(e.value).replace(',','.'))}))
    .filter(x=>x.v>25&&x.v<400).sort((a,b)=>(a.d+a.t).localeCompare(b.d+b.t));
}
// Ritmo real: reta pelos pesos dos últimos 28 dias (precisa de 3 pesagens em 7+ dias)
function ritmoReal(ws){
  const lim=tk(new Date(Date.now()-28*864e5));const p=ws.filter(x=>x.d>=lim);
  if(p.length<3)return null;const t0=pd(p[0].d);const xs=p.map(x=>(pd(x.d)-t0)/864e5),ys=p.map(x=>x.v);
  if(xs[xs.length-1]-xs[0]<7)return null;
  const n=xs.length,mx=xs.reduce((a,b)=>a+b)/n,my=ys.reduce((a,b)=>a+b)/n;
  let num=0,den=0;xs.forEach((x,i)=>{num+=(x-mx)*(ys[i]-my);den+=(x-mx)**2;});
  return den?num/den*7:null; // kg por semana
}
// Média de atividade dos últimos 14 dias (kcal/dia) — treinos, Garmin, atividades lançadas
async function ativMedia(){
  let s=0;const d=new Date();
  for(let i=1;i<=14;i++){const x=new Date(d);x.setDate(d.getDate()-i);try{s+=(await root.computeDietDaySummary(tk(x))).exercicio||0;}catch{}}
  return Math.round(s/14);
}
function mifflin(p,alt,id,sexo){if(!(p&&alt&&id&&sexo))return null;return Math.round(10*p+6.25*alt-5*id+(sexo==='M'?5:-161));}

async function base(){
  const o=await getJ('f3-objetivo',null);const dados=await getJ('f3-dados',{});const metas=await getJ('f3-metas',{});
  const ws=await pesos();const atual=ws.length?ws[ws.length-1].v:(dados.pesoKg||null);
  const sexo=dados.sexo||(isEss()?'F':'M');
  const tmbMedida=dados.tmbKcal||(metas.tmb&&!metas.tmbEstimada?metas.tmb:null);
  return {o,dados,metas,ws,atual,sexo,tmbMedida};
}
function novoDraft(b){
  const o=b.o||{};
  return {pesoMeta:o.pesoMeta??(b.atual?Math.round((b.atual-(isEss()?5:3))*2)/2:null),modo:o.modo||'ritmo',ritmo:o.ritmo||.5,
    dataAlvo:o.dataAlvo||tk(new Date(Date.now()+180*864e5)),ativ:o.ativ??(isEss()?150:250),
    alturaCm:b.dados.alturaCm||null,idade:b.dados.idade||null,sexo:b.sexo};
}

// ---------- o cálculo ----------
function plano(b,dr,media){
  const atual=b.atual;if(!atual||!dr.pesoMeta)return null;
  const tmb=b.tmbMedida||mifflin(atual,dr.alturaCm,dr.idade,dr.sexo);if(!tmb)return {semTmb:true};
  const corpo=Math.round(tmb*(b.metas.fator||1.2)); // basal + dia a dia, sem atividade
  const delta=dr.pesoMeta-atual,dir=Math.abs(delta)<.3?0:Math.sign(delta);
  let semanas,porDia,ritmo,dataFim;
  if(dir===0){semanas=0;porDia=0;ritmo=0;dataFim=new Date();}
  else if(dr.modo==='data'){
    const dias=Math.max(7,Math.round((pd(dr.dataAlvo)-pd(tk()))/864e5));semanas=dias/7;
    porDia=Math.abs(delta)*KCAL_KG/dias;ritmo=Math.abs(delta)/semanas;dataFim=pd(dr.dataAlvo);
  }else{
    ritmo=dr.ritmo;semanas=Math.abs(delta)/ritmo;porDia=ritmo*KCAL_KG/7;dataFim=new Date(Date.now()+semanas*7*864e5);
  }
  porDia=Math.round(porDia);
  const A=dr.ativ||0;
  const comerSem=dir<0?corpo-porDia:corpo+porDia;      // num dia sem atividade
  const comerCom=comerSem+A;                           // num dia com a atividade planejada
  const piso=Math.max(tmb,dr.sexo==='M'?1500:1200);
  const avisos=[];
  const pct=ritmo/atual*100;
  if(dir<0&&pct>1)avisos.push(['forte',`Ritmo de ${kg(ritmo)} kg/semana passa de 1% do seu peso por semana. Dá para fazer, mas perde músculo e cansa. Mais tempo deixa o plano mais leve.`]);
  if(dir>0&&ritmo>.5)avisos.push(['forte','Para ganhar peso com pouca gordura, o ideal é até 0,5 kg por semana, com treino de força.']);
  if(dir<0&&comerSem<piso)avisos.push(['forte',`Comer ${nf(comerSem)} kcal fica abaixo do seu basal (${nf(piso)}). Aumente o prazo, escolha um ritmo mais leve ou faça mais atividade.`]);
  if(dir<0&&comerSem<piso&&comerCom>=piso)avisos.pop()&&avisos.push(['ok',`Nos dias sem atividade a comida fica apertada (${nf(comerSem)} kcal). Com a atividade planejada você come ${nf(comerCom)} kcal.`]);
  // etapas: a cada 4 semanas (até 12 etapas) + a data final
  const etapas=[];
  if(dir!==0){const passo=semanas>52?8:4;for(let w=passo;w<semanas&&etapas.length<12;w+=passo){etapas.push({d:new Date(Date.now()+w*7*864e5),p:atual+Math.sign(delta)*ritmo*w,w});}
    etapas.push({d:dataFim,p:dr.pesoMeta,w:semanas,fim:true});}
  return {tmb,tmbEstimada:!b.tmbMedida,corpo,delta,dir,semanas,porDia,ritmo,dataFim,A,comerSem,comerCom,piso,avisos,etapas,media,
    deficit:dir<0?porDia:dir>0?-porDia:0};
}

// ---------- tela ----------
async function render(){
  const host=$('tab-meta');if(!host)return;
  const b=await base();const media=await ativMedia();
  if(!draft){draft=novoDraft(b);
    // sem meta salva: começa no ritmo mais rápido que não deixa a comida abaixo do basal
    if(!b.o)for(const r of [.5,.25]){draft.ritmo=r;const t=plano(b,draft,media);if(!t||t.semTmb||t.comerCom>=t.piso)break;}}
  const p=plano(b,draft,media);
  const dr=draft;const salvo=b.o;salvoCache=salvo;
  const rr=ritmoReal(b.ws);
  let h='';
  if(!b.atual){host.innerHTML=`<div class="f3-card"><div class="f3-t">Minha meta</div><p class="f3-nota">Registre seu peso primeiro. A meta parte dele.</p><button type="button" class="f3-cta" onclick="Forja3.go('corpo')">Registrar peso</button></div>`;return;}
  // progresso da meta salva
  if(salvo&&salvo.pesoMeta){
    const ini=salvo.pesoInicial,falta=b.atual-salvo.pesoMeta,tot=ini-salvo.pesoMeta;
    const pct=tot?Math.max(0,Math.min(100,(ini-b.atual)/tot*100)):100;
    const prev=rr&&Math.sign(rr)===Math.sign(-falta)&&Math.abs(falta)>.2?new Date(Date.now()+Math.abs(falta/rr)*7*864e5):null;
    h+=`<div class="f3-card mt-prog"><div class="f3-t">Minha meta <span>desde ${dataCurta(pd(salvo.dataInicio))}</span></div>
      <div class="mt-trio"><div><small>Comecei</small><b>${kg(ini)}</b></div><div class="agora"><small>Agora</small><b>${kg(b.atual)}</b></div><div><small>Meta</small><b>${kg(salvo.pesoMeta)}</b></div></div>
      <div class="mt-bar"><i style="width:${pct}%"></i></div>
      <p class="mt-frase">${Math.abs(falta)<=.2?'Meta alcançada 🎉':`${Math.round(pct)}% do caminho · faltam <b>${kg(Math.abs(falta))} kg</b>`}</p>
      ${rr!=null?`<p class="f3-nota">Ritmo real (últimas 4 semanas): <b>${rr>0?'+':''}${kg(rr)} kg/semana</b>${prev?` · nesse ritmo você chega em <b>${dataCurta(prev)}</b>`:Math.abs(falta)>.2?' · ainda no sentido contrário da meta':''}.</p>`:`<p class="f3-nota">Pese-se ao menos 1 vez por semana para o app medir seu ritmo real.</p>`}
      ${await grafico(b.ws,salvo)}</div>`;
  }
  // editor
  const ed=`<div class="f3-card"><div class="f3-t">${salvo?'Ajustar meta':'Quanto quero pesar'}</div>
    <div class="meta3"><span>Peso hoje</span><b>${kg(b.atual)} kg</b></div>
    <div class="meta3"><span>Peso que quero</span><div class="mini-step"><button type="button" onclick="ForjaMeta.set('pesoMeta',-0.5)" aria-label="Menos meio quilo">−</button><b><input id="mt-peso" inputmode="decimal" value="${kg(dr.pesoMeta)}" onchange="ForjaMeta.set('pesoMetaTxt',this.value)" aria-label="Peso que quero"> kg</b><button type="button" onclick="ForjaMeta.set('pesoMeta',0.5)" aria-label="Mais meio quilo">+</button></div></div>
    ${p&&!p.semTmb&&p.dir!==0?`<p class="f3-nota c">${p.dir<0?'Perder':'Ganhar'} <b>${kg(Math.abs(p.delta))} kg</b></p>`:''}
    <div class="f3-lbl">Como quero chegar</div>
    <div class="tipo-seg mt-seg"><button type="button" class="${dr.modo==='ritmo'?'on':''}" onclick="ForjaMeta.set('modo','ritmo')">No meu ritmo</button><button type="button" class="${dr.modo==='data'?'on':''}" onclick="ForjaMeta.set('modo','data')">Até uma data</button></div>
    ${dr.modo==='ritmo'
      ?`<div class="mt-ritmos">${RITMOS.map(r=>`<button type="button" class="${dr.ritmo===r.v?'on':''}" onclick="ForjaMeta.set('ritmo',${r.v})"><b>${String(r.v).replace('.',',')} kg</b><small>${r.l}</small></button>`).join('')}</div><p class="f3-nota">por semana</p>`
      :`<div class="chips-min">${PRAZOS.map(([m,l])=>`<button type="button" class="${prazoOn(dr.dataAlvo,m)?'on':''}" onclick="ForjaMeta.set('prazo',${m})">${l}</button>`).join('')}</div>
        <label class="mt-data"><span>Data</span><input type="date" id="mt-data" value="${dr.dataAlvo}" min="${tk(new Date(Date.now()+7*864e5))}" onchange="ForjaMeta.set('dataAlvo',this.value)"></label>`}
    <div class="f3-lbl">Atividade que pretendo fazer por dia</div>
    <div class="chips-min">${ATIV.map(v=>`<button type="button" class="${dr.ativ===v?'on':''}" onclick="ForjaMeta.set('ativ',${v})">${v?nf(v)+' kcal':'Nenhuma'}</button>`).join('')}</div>
    <p class="f3-nota">${media?`Nos últimos 14 dias você gastou em média <b>${nf(media)} kcal/dia</b> em atividades.`:'Ex.: 30 min de caminhada ≈ 150 kcal · 45 min de academia ≈ 250 kcal · 45 min de spinning ≈ 400 kcal.'}</p>
  </div>`;
  h+=salvo&&!editando?`<button type="button" class="f3-cta sec mt-ajustar" onclick="ForjaMeta.editar()">Ajustar meta, prazo ou atividade</button>`:ed;
  if(p&&p.semTmb){
    h+=`<div class="f3-card"><div class="f3-t">Falta um dado</div><p class="f3-nota">Para calcular o gasto do seu corpo o app precisa de altura, idade e sexo (ou da taxa basal do exame).</p>
      <div class="campos3"><label class="c3"><span>Altura</span><span class="c3v"><input inputmode="decimal" value="${dr.alturaCm||''}" placeholder="—" onchange="ForjaMeta.set('alturaCm',this.value)"><em>cm</em></span></label>
      <label class="c3"><span>Idade</span><span class="c3v"><input inputmode="numeric" value="${dr.idade||''}" placeholder="—" onchange="ForjaMeta.set('idade',this.value)"><em>anos</em></span></label></div>
      <div class="tipo-seg mt-seg"><button type="button" class="${dr.sexo==='F'?'on':''}" onclick="ForjaMeta.set('sexo','F')">Mulher</button><button type="button" class="${dr.sexo==='M'?'on':''}" onclick="ForjaMeta.set('sexo','M')">Homem</button></div></div>`;
  }else if(p){
    h+=resultado(p,dr);
  }
  host.innerHTML=h;
}
function prazoOn(alvo,m){const d=new Date();d.setMonth(d.getMonth()+m);return tk(d)===alvo;}
function resultado(p,dr){
  if(p.dir===0)return `<div class="f3-card mt-res"><div class="f3-t">Manter o peso</div><div class="mt-big">${nf(p.corpo+p.A)} kcal<small>por dia, com a atividade planejada</small></div>
    <p class="f3-nota">Comer o mesmo que o corpo gasta: ${nf(p.corpo)} kcal + as atividades do dia.</p>${botao(p)}</div>`;
  const perder=p.dir<0;
  const sem=Math.round(p.semanas);
  return `<div class="f3-card mt-res"><div class="f3-t">O plano</div>
    <div class="mt-quando"><small>Você chega em ${kg(dr.pesoMeta)} kg</small><b>${dataCurta(p.dataFim)}</b><span>${sem<=1?'1 semana':sem+' semanas'}${sem>=8?` · ~${Math.round(p.semanas/4.345)} meses`:''} · ${kg(p.ritmo)} kg/semana</span></div>
    <div class="mt-conta">
      <div><small>Seu corpo gasta</small><b>${nf(p.corpo)}</b><em>kcal/dia${p.tmbEstimada?' · estimado':''}</em></div>
      <div><small>Gastar em atividade</small><b>${nf(p.A)}</b><em>kcal/dia</em></div>
      <div class="${perder?'neg':'pos'}"><small>${perder?'Déficit necessário':'Sobra necessária'}</small><b>${perder?'−':'+'}${nf(p.porDia)}</b><em>kcal/dia</em></div>
      <div class="dest"><small>Comer por dia</small><b>${nf(p.comerCom)}</b><em>kcal</em></div>
    </div>
    <p class="f3-nota">${p.A?`Sem atividade no dia, comer <b>${nf(p.comerSem)} kcal</b>. A meta de comida do app se ajusta sozinha: cada caloria de atividade que você lança libera a mesma quantidade para comer.`:`A meta de comida do app se ajusta sozinha: atividade lançada libera a mesma quantidade de calorias para comer.`}
      ${perder?` Na semana: ${nf(p.porDia*7)} kcal a menos ≈ ${kg(p.porDia*7/KCAL_KG)} kg.`:''}</p>
    ${p.avisos.map(([t,m])=>`<p class="mt-aviso ${t}">${t==='ok'?'💡':'⚠️'} ${m}</p>`).join('')}
    ${p.etapas.length>1?`<div class="f3-lbl">Etapas</div><div class="mt-etapas">${p.etapas.map(e=>`<div class="${e.fim?'fim':''}"><span>${e.fim?'🎯 ':''}${mesAno(e.d)}</span><small>sem. ${Math.round(e.w)}</small><b>${kg(e.p)} kg</b></div>`).join('')}</div>`:''}
    ${botao(p)}
    <p class="f3-nota">Estimativa: 1 kg ≈ 7.700 kcal${p.tmbEstimada?', gasto basal pela fórmula de Mifflin-St Jeor (o exame de bioimpedância deixa mais preciso)':', gasto basal do seu exame'}. O peso oscila com água e intestino, então olhe a tendência das semanas, não o dia. Para metas de saúde, vale combinar com nutricionista.</p></div>`;
}
function botao(){return editando||!salvoCache?`<button type="button" class="f3-cta" onclick="ForjaMeta.salvar()">${salvoCache?'Salvar ajustes':'Salvar meta e usar este plano'}</button>`:'';}

async function grafico(ws,o){
  const ini=pd(o.dataInicio),fim=pd(o.dataFim||tk());const span=Math.max(14,(fim-ini)/864e5);
  const pts=ws.filter(x=>x.d>=o.dataInicio);if(!pts.length)return '';
  const W=320,H=110,pad=8;
  const vals=[o.pesoInicial,o.pesoMeta,...pts.map(x=>x.v)];const mn=Math.min(...vals)-.5,mx=Math.max(...vals)+.5;
  const X=d=>pad+Math.min(1,Math.max(0,(pd(d)-ini)/864e5/span))*(W-2*pad),Y=v=>pad+(mx-v)/(mx-mn)*(H-2*pad);
  const real=pts.map(x=>`${X(x.d).toFixed(1)},${Y(x.v).toFixed(1)}`).join(' ');
  const hojeX=X(tk());
  return `<svg class="mt-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Peso real comparado ao plano">
    <line x1="${X(o.dataInicio)}" y1="${Y(o.pesoInicial)}" x2="${X(o.dataFim||tk())}" y2="${Y(o.pesoMeta)}" class="plano"/>
    <line x1="${hojeX}" y1="${pad}" x2="${hojeX}" y2="${H-pad}" class="hoje"/>
    <polyline points="${real}" class="real"/>${pts.slice(-1).map(x=>`<circle cx="${X(x.d)}" cy="${Y(x.v)}" r="3.5" class="real"/>`).join('')}
    </svg><div class="mt-leg"><span class="pl">Plano</span><span class="re">Seu peso</span><span>${dataCurta(fim)}</span></div>`;
}

async function set(k,v){
  tap();const d=draft;
  if(k==='pesoMeta')d.pesoMeta=Math.round(((d.pesoMeta||0)+v)*10)/10;
  else if(k==='pesoMetaTxt'){const n=parseFloat(String(v).replace(',','.'));if(n>25&&n<400)d.pesoMeta=n;}
  else if(k==='prazo'){const x=new Date();x.setMonth(x.getMonth()+v);d.dataAlvo=tk(x);d.modo='data';}
  else if(k==='alturaCm'||k==='idade'){const n=parseFloat(String(v).replace(',','.'));d[k]=isNaN(n)?null:n;const dados=await getJ('f3-dados',{});dados[k]=d[k];await setJ('f3-dados',dados);}
  else if(k==='sexo'){d.sexo=v;const dados=await getJ('f3-dados',{});dados.sexo=v;await setJ('f3-dados',dados);}
  else d[k]=v;
  await render();
}
async function salvar(){
  tap();const b=await base();const p=plano(b,draft,await ativMedia());if(!p||p.semTmb){toast('Preencha os dados que faltam.');return;}
  const antigo=b.o;
  const o={pesoMeta:draft.pesoMeta,modo:draft.modo,ritmo:draft.ritmo,dataAlvo:draft.dataAlvo,ativ:draft.ativ,
    pesoInicial:antigo&&antigo.pesoMeta===draft.pesoMeta?antigo.pesoInicial:b.atual,
    dataInicio:antigo&&antigo.pesoMeta===draft.pesoMeta?antigo.dataInicio:tk(),
    dataFim:tk(p.dataFim),porDia:p.porDia,atualizado:new Date().toISOString()};
  await setJ('f3-objetivo',o);
  const m=await getJ('f3-metas',{});m.modo='dinamico';m.tmb=p.tmb;m.tmbEstimada=p.tmbEstimada;m.deficit=p.deficit;m.ativMeta=draft.ativ;
  if(!m.protein_g)m.protein_g=Math.round(b.atual*(p.dir<0?1.6:1.8)/5)*5;
  await setJ('f3-metas',m);
  try{await root.Forja3?.applyMetas?.();}catch{}
  toast(`Meta salva ✓ Comer ~${nf(p.comerCom)} kcal/dia`);
  draft=null;editando=false;await render();root.renderDashboard?.();
}
async function apagar(){
  const o=await getJ('f3-objetivo',null);if(!o)return;
  await S().set('f3-objetivo','');const m=await getJ('f3-metas',{});const old={...m};m.deficit=300;await setJ('f3-metas',m);
  toast('Meta apagada.',{label:'Desfazer',onClick:async()=>{await setJ('f3-objetivo',o);await setJ('f3-metas',old);render();}});draft=null;render();
}

// cartão do Início
async function homeCard(){
  const o=await getJ('f3-objetivo',null);
  if(!o||!o.pesoMeta)return `<button type="button" class="f3-card mt-home vazio" onclick="Forja3.go('meta')"><span class="ic">🎯</span><span><b>Definir minha meta de peso</b><small>O app calcula quanto comer, quanto gastar e quando você chega.</small></span><i>›</i></button>`;
  const ws=await pesos();const atual=ws.length?ws[ws.length-1].v:o.pesoInicial;
  const tot=o.pesoInicial-o.pesoMeta,pct=tot?Math.max(0,Math.min(100,(o.pesoInicial-atual)/tot*100)):100;const falta=Math.abs(atual-o.pesoMeta);
  return `<button type="button" class="f3-card mt-home" onclick="Forja3.go('meta')"><span class="ic">🎯</span><span class="tx"><b>${kg(atual)} → ${kg(o.pesoMeta)} kg</b><small>${falta<=.2?'Meta alcançada 🎉':`faltam ${kg(falta)} kg · previsão ${dataCurta(pd(o.dataFim))}`}</small><span class="mt-bar"><i style="width:${pct}%"></i></span></span><i>›</i></button>`;
}
async function ativMeta(){const m=await getJ('f3-metas',{});return m.ativMeta||0;}

root.ForjaMeta={editar:()=>{tap();editando=true;render();},render,set,salvar,apagar,homeCard,ativMeta,plano,mifflin,_reset:()=>{draft=null;}};
})(window);
