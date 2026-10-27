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
let vista='peso'; // gráfico do acompanhamento: 'peso' ou 'kcal'
const dec2=n=>(Math.round(n*100)/100).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2});
const semanasAte=alvo=>Math.max(1,Math.round((pd(alvo)-pd(tk()))/864e5/7));
// controle − valor +, com o valor digitável (ela define o número, os atalhos são só sugestão)
const passo=(campo,valor,unid,rotulo)=>`<div class="mini-step"><button type="button" onclick="ForjaMeta.set('${campo}',-1)" aria-label="Diminuir ${rotulo}">−</button><b><input class="mt-peso" inputmode="decimal" value="${valor}" onchange="ForjaMeta.set('${campo}Txt',this.value)" aria-label="${rotulo}"> ${unid}</b><button type="button" onclick="ForjaMeta.set('${campo}',1)" aria-label="Aumentar ${rotulo}">+</button></div>`;
const num=v=>{const n=parseFloat(String(v).replace(/\./g,'').replace(',','.'));return isNaN(n)?null:n;};
const numDec=v=>{const n=parseFloat(String(v).replace(',','.'));return isNaN(n)?null:n;};

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
// Média de atividade dos últimos 14 dias (kcal/dia) — treinos, Strava, atividades lançadas
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
      ${rr!=null?`<p class="f3-nota">Ritmo real (últimas 4 semanas): <b>${rr>0?'+':''}${kg(rr)} kg/semana</b>${prev?` · nesse ritmo você chega em <b>${dataCurta(prev)}</b>`:Math.abs(falta)>.2?' · ainda no sentido contrário da meta':''}.</p>`:`<p class="f3-nota">Pese-se ao menos 1 vez por semana para o app medir seu ritmo real.</p>`}</div>`;
    h+=await hojeCard(b,salvo);
    h+=await acompanhamento(b,salvo);
  }
  // editor
  const ed=`<div class="f3-card"><div class="f3-t">${salvo?'Ajustar meta':'Quanto quero pesar'}</div>
    <div class="meta3"><span>Peso hoje</span><b>${kg(b.atual)} kg</b></div>
    <div class="meta3"><span>Peso que quero</span><div class="mini-step"><button type="button" onclick="ForjaMeta.set('pesoMeta',-0.5)" aria-label="Menos meio quilo">−</button><b><input id="mt-peso" inputmode="decimal" value="${kg(dr.pesoMeta)}" onchange="ForjaMeta.set('pesoMetaTxt',this.value)" aria-label="Peso que quero"> kg</b><button type="button" onclick="ForjaMeta.set('pesoMeta',0.5)" aria-label="Mais meio quilo">+</button></div></div>
    ${p&&!p.semTmb&&p.dir!==0?`<p class="f3-nota c">${p.dir<0?'Perder':'Ganhar'} <b>${kg(Math.abs(p.delta))} kg</b></p>`:''}
    <div class="f3-lbl">Como quero chegar</div>
    <div class="tipo-seg mt-seg"><button type="button" class="${dr.modo==='ritmo'?'on':''}" onclick="ForjaMeta.set('modo','ritmo')">No meu ritmo</button><button type="button" class="${dr.modo==='data'?'on':''}" onclick="ForjaMeta.set('modo','data')">Até uma data</button></div>
    ${dr.modo==='ritmo'
      ?`<div class="meta3"><span>Perder/ganhar por semana</span>${passo('ritmo',dec2(dr.ritmo),'kg','quilos por semana')}</div>
        <div class="f3-lbl">Sugestões</div>
        <div class="mt-ritmos">${RITMOS.map(r=>`<button type="button" class="${dr.ritmo===r.v?'on':''}" onclick="ForjaMeta.set('ritmoAbs',${r.v})"><b>${String(r.v).replace('.',',')} kg</b><small>${r.l}</small></button>`).join('')}</div>`
      :`<div class="meta3"><span>Chegar em</span>${passo('semanas',semanasAte(dr.dataAlvo),'sem.','semanas')}</div>
        <label class="mt-data"><span>Ou escolha a data</span><input type="date" id="mt-data" value="${dr.dataAlvo}" min="${tk(new Date(Date.now()+7*864e5))}" onchange="ForjaMeta.set('dataAlvo',this.value)"></label>
        <div class="f3-lbl">Sugestões</div>
        <div class="chips-min">${PRAZOS.map(([m,l])=>`<button type="button" class="${prazoOn(dr.dataAlvo,m)?'on':''}" onclick="ForjaMeta.set('prazo',${m})">${l}</button>`).join('')}</div>`}
    <div class="f3-lbl">Atividade que pretendo fazer por dia</div>
    <div class="meta3"><span>Gastar em atividade</span>${passo('ativ',nf(dr.ativ),'kcal','calorias de atividade por dia')}</div>
    <div class="chips-min">${ATIV.map(v=>`<button type="button" class="${dr.ativ===v?'on':''}" onclick="ForjaMeta.set('ativAbs',${v})">${v?nf(v):'Nenhuma'}</button>`).join('')}</div>
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
  h+=`<div id="metas3" class="f3-card metas3"></div>`;
  host.innerHTML=h;
  try{await root.Forja3?.renderMetasCard?.();}catch(e){console.warn('metas do dia',e);}
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

// ---------- hoje: o que precisa ser feito no dia ----------
async function hojeCard(b,o){
  let s={};try{s=await root.computeDietDaySummary(tk());}catch{}
  const goal=Math.round(s.goal||0),com=Math.round(s.comido||0),ex=Math.round(s.exercicio||0),A=o.ativ||0;
  const ult=b.ws.length?b.ws[b.ws.length-1].d:null;const dias=ult?Math.round((pd(tk())-pd(ult))/864e5):null;
  const linha=(ic,tit,det,ok)=>`<div class="mt-hj${ok?' ok':''}"><span class="ic">${ic}</span><span class="tx"><b>${tit}</b><small>${det}</small></span><span class="st">${ok?'✓':''}</span></div>`;
  const comer=goal?linha('🍽',`Comer até ${nf(goal)} kcal`,com?(com>goal?`comeu ${nf(com)} · ${nf(com-goal)} kcal acima`:`comeu ${nf(com)} · faltam ${nf(goal-com)} kcal`):'nada lançado ainda',false):'';
  const gastar=A?linha('🔥',`Gastar ${nf(A)} kcal em atividade`,ex>=A?`feito: ${nf(ex)} kcal`:ex?`feito ${nf(ex)} · faltam ${nf(A-ex)} kcal`:'nenhuma atividade lançada ainda',ex>=A):'';
  const pesar=linha('⚖️',dias===0?'Pesou hoje':dias!=null&&dias<7?'Pesar 1 vez por semana':'Pesar hoje',dias===0?'o gráfico já usa esse peso':dias!=null?`última pesagem ${dias===1?'ontem':'há '+dias+' dias'}`:'nenhuma pesagem ainda',dias!=null&&dias<7);
  const def=o.porDia?`<p class="f3-nota">O plano pede ${b.metas.deficit>=0?'déficit':'sobra'} de <b>${nf(o.porDia)} kcal por dia</b> (≈ ${kg(o.porDia*7/KCAL_KG)} kg por semana). A meta de comida já desconta isso.</p>`:'';
  return `<div class="f3-card"><div class="f3-t">Hoje para a meta</div>${comer}${gastar}${pesar}${def}</div>`;
}

// ---------- acompanhamento: previsto × realizado ----------
function planosDe(o){
  const ps=o.planos&&o.planos.length?o.planos:[{de:o.dataInicio,p0:o.pesoInicial,meta:o.pesoMeta,ate:o.dataFim||tk()}];
  return ps.filter(x=>x&&x.de&&x.ate);
}
function pesoPrev(s,k){const tot=pd(s.ate)-pd(s.de);const f=tot>0?Math.min(1,Math.max(0,(pd(k)-pd(s.de))/tot)):1;return s.p0+(s.meta-s.p0)*f;}
async function acompanhamento(b,o){
  const seg=`<div class="tipo-seg mt-seg"><button type="button" class="${vista==='peso'?'on':''}" onclick="ForjaMeta.vista('peso')">Peso</button><button type="button" class="${vista==='kcal'?'on':''}" onclick="ForjaMeta.vista('kcal')">Calorias por dia</button></div>`;
  return `<div class="f3-card"><div class="f3-t">Acompanhamento <span>previsto × realizado</span></div>${seg}${vista==='peso'?graficoPeso(b.ws,o):await graficoKcal(b,o)}</div>`;
}
function graficoPeso(ws,o){
  const ps=planosDe(o);if(!ps.length)return '';
  const hoje=tk(),ini=ps[0].de,atual=ps[ps.length-1];
  const fimK=[atual.ate,hoje].sort().pop();const span=Math.max(14,(pd(fimK)-pd(ini))/864e5);
  const pts=ws.filter(x=>x.d>=ini);
  const W=320,H=150,pl=34,pr=8,pt=10,pb=18;
  const vals=[...ps.flatMap(s=>[s.p0,s.meta]),...pts.map(x=>x.v)];const mn=Math.floor(Math.min(...vals)-.5),mx=Math.ceil(Math.max(...vals)+.5);
  const X=k=>pl+Math.min(1,Math.max(0,(pd(k)-pd(ini))/864e5/span))*(W-pl-pr),Y=v=>pt+(mx-v)/((mx-mn)||1)*(H-pt-pb);
  const f=n=>n.toFixed(1);
  // cada meta vale do dia em que foi salva até a próxima mudança; as antigas ficam apagadas
  const linhas=ps.map((s,i)=>{const fimS=i<ps.length-1?ps[i+1].de:s.ate;return `<line x1="${f(X(s.de))}" y1="${f(Y(s.p0))}" x2="${f(X(fimS))}" y2="${f(Y(pesoPrev(s,fimS)))}" class="plano${i<ps.length-1?' velho':''}"/>`;}).join('');
  const real=pts.length>1?`<polyline points="${pts.map(x=>`${f(X(x.d))},${f(Y(x.v))}`).join(' ')}" class="real"/>`:'';
  const pontos=pts.map(x=>`<circle cx="${f(X(x.d))}" cy="${f(Y(x.v))}" r="${x===pts[pts.length-1]?4:2.5}" class="real"/>`).join('');
  const muda=ps.slice(1).map(s=>`<line x1="${f(X(s.de))}" y1="${pt}" x2="${f(X(s.de))}" y2="${H-pb}" class="muda"/>`).join('');
  const prevHoje=pesoPrev(atual,hoje<atual.de?atual.de:hoje);const ult=pts.length?pts[pts.length-1].v:null;
  const dif=ult!=null?ult-prevHoje:null;const perder=atual.meta<atual.p0;
  const adiant=dif!=null&&(perder?dif<=0:dif>=0);
  const svg=`<svg class="mt-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Peso previsto pela meta e peso real">
    <text x="${pl-6}" y="${pt+4}" class="eixo" text-anchor="end">${mx}</text><text x="${pl-6}" y="${H-pb}" class="eixo" text-anchor="end">${mn}</text>
    <line x1="${pl}" y1="${H-pb}" x2="${W-pr}" y2="${H-pb}" class="base"/>
    ${muda}<line x1="${f(X(hoje))}" y1="${pt}" x2="${f(X(hoje))}" y2="${H-pb}" class="hoje"/>
    ${linhas}<circle cx="${f(X(atual.ate))}" cy="${f(Y(atual.meta))}" r="4.5" class="alvo"/>${real}${pontos}
    <text x="${pl}" y="${H-4}" class="eixo">${dataCurta(pd(ini))}</text><text x="${W-pr}" y="${H-4}" class="eixo" text-anchor="end">${dataCurta(pd(fimK))}</text></svg>`;
  const frase=dif==null?'Pese-se para o app comparar com o previsto.':Math.abs(dif)<.2?`Hoje o previsto era <b>${kg(prevHoje)} kg</b> e você está com <b>${kg(ult)} kg</b>: no ritmo certo.`
    :`Hoje o previsto era <b>${kg(prevHoje)} kg</b> e você está com <b>${kg(ult)} kg</b>: <b>${kg(Math.abs(dif))} kg ${adiant?'adiantada':'atrasada'}</b> no plano.`;
  return `${svg}<div class="mt-leg"><span class="pl">Previsto</span><span class="re">Seu peso</span><span class="al">Meta</span></div>
    <p class="f3-nota">${frase}${ps.length>1?' A linha apagada é a meta anterior; a linha vertical marca quando ela mudou.':''}</p>`;
}
async function graficoKcal(b,o){
  const ini=planosDe(o)[0]?.de||o.dataInicio;const dias=[];
  for(let i=13;i>=0;i--){const k=tk(new Date(Date.now()-i*864e5));if(k>=ini)dias.push(k);}
  if(dias.length<1)return '';
  const def=b.metas.deficit||0,hoje=tk();
  const rows=[];for(const k of dias){let s={};try{s=await root.computeDietDaySummary(k);}catch{}rows.push({k,goal:Math.round(s.goal||0),com:Math.round(s.comido||0),reg:(s.entryCount||0)>0});}
  const W=320,H=150,pl=8,pr=8,pt=10,pb=20;const n=Math.max(7,rows.length),bw=(W-pl-pr)/n;
  const top=Math.max(1,...rows.map(r=>Math.max(r.goal,r.com)))*1.12;const Y=v=>pt+(1-v/top)*(H-pt-pb);
  let dentro=0,acima=0,sem=0,real=0,prev=0;
  const barras=rows.map((r,i)=>{const x=pl+i*bw+bw*.18,w=bw*.64,lb=pd(r.k).getDate();
    const fechado=r.k!==hoje;let el;
    if(!r.reg){if(fechado)sem++;el=`<rect x="${x.toFixed(1)}" y="${(H-pb-22).toFixed(1)}" width="${w.toFixed(1)}" height="22" rx="3" class="sem"/><text x="${(x+w/2).toFixed(1)}" y="${(H-pb-7).toFixed(1)}" class="eixo" text-anchor="middle">?</text>`;}
    else{const ok=!r.goal||r.com<=r.goal*1.02;if(fechado){ok?dentro++:acima++;if(r.goal){real+=r.goal+def-r.com;prev+=def;}}
      el=`<rect x="${x.toFixed(1)}" y="${Y(r.com).toFixed(1)}" width="${w.toFixed(1)}" height="${(H-pb-Y(r.com)).toFixed(1)}" rx="3" class="${ok?'ok':'acima'}${fechado?'':' parcial'}"/>`;}
    const alvo=r.goal?`<line x1="${(x-2).toFixed(1)}" y1="${Y(r.goal).toFixed(1)}" x2="${(x+w+2).toFixed(1)}" y2="${Y(r.goal).toFixed(1)}" class="alvo-l"/>`:'';
    return el+alvo+`<text x="${(x+w/2).toFixed(1)}" y="${H-6}" class="eixo${r.k===hoje?' hj':''}" text-anchor="middle">${r.k===hoje?'hoje':lb}</text>`;}).join('');
  const svg=`<svg class="mt-graf" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calorias comidas por dia comparadas à meta do dia"><line x1="${pl}" y1="${H-pb}" x2="${W-pr}" y2="${H-pb}" class="base"/>${barras}</svg>`;
  const perder=def>0;
  const resumo=`${dentro} ${dentro===1?'dia':'dias'} dentro da meta · ${acima} acima · ${sem} sem registro`;
  const saldo=prev?`<p class="f3-nota">Nos dias registrados o plano previa ${perder?'déficit':'sobra'} de <b>${nf(Math.abs(prev))} kcal</b> (≈ ${kg(Math.abs(prev)/KCAL_KG)} kg). Você fez <b>${nf(Math.abs(real))} kcal</b> (≈ ${kg(Math.abs(real)/KCAL_KG)} kg)${Math.sign(real)!==Math.sign(prev)&&real?' no sentido contrário':''}.</p>`:'';
  return `${svg}<div class="mt-leg"><span class="ok">Dentro</span><span class="ac">Acima</span><span class="sm">Sem registro</span><span class="ml">Meta do dia</span></div>
    <p class="f3-nota">${resumo}. Dia sem comida lançada aparece com “?”.</p>${saldo}`;
}

async function set(k,v){
  tap();const d=draft;
  if(k==='pesoMeta')d.pesoMeta=Math.round(((d.pesoMeta||0)+v)*10)/10;
  else if(k==='pesoMetaTxt'){const n=parseFloat(String(v).replace(',','.'));if(n>25&&n<400)d.pesoMeta=n;}
  else if(k==='prazo'){const x=new Date();x.setMonth(x.getMonth()+v);d.dataAlvo=tk(x);d.modo='data';}
  else if(k==='ritmo'){d.ritmo=Math.min(1.5,Math.max(.05,Math.round(((d.ritmo||.5)+v*.05)*100)/100));d.modo='ritmo';}
  else if(k==='ritmoTxt'){const n=numDec(v);if(n>0&&n<=2)d.ritmo=Math.round(n*100)/100;}
  else if(k==='ritmoAbs'){d.ritmo=v;d.modo='ritmo';}
  else if(k==='semanas'||k==='semanasTxt'){const w=k==='semanas'?semanasAte(d.dataAlvo)+v:Math.round(num(v)||0);if(w>=1&&w<=260){d.dataAlvo=tk(new Date(Date.now()+w*7*864e5));d.modo='data';}}
  else if(k==='ativ'){d.ativ=Math.min(3000,Math.max(0,(d.ativ||0)+v*10));}
  else if(k==='ativTxt'){const n=num(v);if(n!=null&&n>=0&&n<=5000)d.ativ=Math.round(n);}
  else if(k==='ativAbs')d.ativ=v;
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
  // histórico das metas para o gráfico: cada ajuste começa uma linha nova a partir de hoje
  const planos=(antigo?planosDe(antigo):[]).filter(x=>x.de<tk());
  planos.push({de:tk(),p0:b.atual,meta:draft.pesoMeta,ate:tk(p.dataFim)});
  o.planos=planos.slice(-20);
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

root.ForjaMeta={editar:()=>{tap();editando=true;render();},vista:v=>{tap();vista=v;render();},render,set,salvar,apagar,homeCard,ativMeta,plano,mifflin,_reset:()=>{draft=null;}};
})(window);
