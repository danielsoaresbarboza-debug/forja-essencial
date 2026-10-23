/* "Músculos do dia" — aba Progresso. Estima quais grupos musculares foram mais
   trabalhados num dia específico, somando corrida, natação, crossfit e academia,
   e desenha no mesmo boneco anatômico de "Grupos trabalhados hoje" (ver
   muscle-anatomy-render.js), mas com uma escala de intensidade (cinza → amarelo
   → laranja → vermelho) em vez de só ligado/desligado. É uma estimativa — soma
   pontos por modalidade/exercício, não mede ativação muscular de verdade. */
(function(root){
  'use strict';
  const ZONE_NAMES={chest:'Peito',back:'Costas',shoulder:'Ombro',arm_front:'Bíceps',arm_back:'Tríceps',abs:'Abdômen',legs:'Perna',glute:'Glúteo',calf:'Panturrilha'};
  const blank=()=>Object.fromEntries(Object.keys(ZONE_NAMES).map(k=>[k,0]));
  const add=(scores,w)=>{for(const [k,v] of Object.entries(w||{}))scores[k]=(scores[k]||0)+v;};
  const RUN_W={legs:3.4,calf:2,glute:1.6,abs:.5};
  const SWIM_W={back:2,shoulder:2,chest:1,arm_front:.7,arm_back:1.1,abs:1.2,glute:.6,legs:.6,calf:.5};
  const CF_RULES=[
    [/\b(?:row(?:erg)?|rowing|remo)\b/i,{legs:2.3,glute:1.2,back:1.5,arm_front:1,abs:.7}],
    [/\bski(?:\s*erg)?\b/i,{back:2,shoulder:1,arm_back:1.2,abs:1.1}],
    [/\b(?:air|echo|assault|fan)?\s*bike(?:erg)?\b/i,{legs:2,glute:1.2,calf:.7}],
    [/\b(?:run|corrida|sprint|shuttle)\b/i,RUN_W],
    [/\b(?:squat|agachamento|lunge|afundo|step.?over|step.?up|pistol)\b/i,{legs:2.7,glute:1.7,abs:.8}],
    [/\b(?:deadlift|terra|good morning|hip thrust)\b/i,{legs:.5,glute:2,back:1}],
    [/\b(?:clean|snatch|thruster|jerk)\b/i,{legs:1.5,glute:1.5,shoulder:1.5,back:.7,abs:.8}],
    [/\b(?:pull.?up|chin.?up|muscle.?up|ring row|rope climb|chest.?to.?bar|barra)\b/i,{back:2,arm_front:1.4,shoulder:.8,abs:.7}],
    [/\b(?:push.?up|press|handstand|dip|flex[aã]o)\b/i,{chest:1.3,shoulder:1.8,arm_back:1.6,abs:.5}],
    [/\b(?:burpee|box jump|broad jump|double under)\b/i,{legs:1.4,calf:1.5,chest:.7,shoulder:.6}],
    [/\b(?:sit.?up|plank|hollow|v.?up|l.?sit|ab wheel|prancha|abdominal)\b/i,{abs:2}],
    [/\b(?:carry|farmer|sandbag|turkish get.?up)\b/i,{shoulder:1,glute:1,legs:1,abs:1.3}]
  ];
  function movementWeights(name){
    const text=String(name||'');
    for(const [re,w] of CF_RULES) if(re.test(text)) return w;
    return null;
  }
  async function scoreDay(date){
    const scores=blank();
    const db=root.ForjaDB;
    const t=root.ForjaGymTraining;
    if(db){
      try{
        const snap=await db.collection('corridas').get();
        if(snap.docs.some(d=>d.data().data===date)) add(scores,RUN_W);
      }catch{}
      try{
        const snap=await db.collection('natacao').get();
        if(snap.docs.some(d=>d.data().data===date)) add(scores,SWIM_W);
      }catch{}
      try{
        const snap=await db.collection('crossfit').get();
        const sessions=snap.docs.map(d=>d.data()).filter(r=>r.data===date);
        for(const session of sessions){
          const seen=new Set();
          for(const ex of session.exercicios||[]){
            const name=String(ex?.nome||'').trim();
            if(!name||seen.has(name.toLowerCase()))continue;
            seen.add(name.toLowerCase());
            const w=movementWeights(name);
            if(w)add(scores,w);
          }
        }
      }catch{}
    }
    if(t){
      try{
        const workouts=await t.loadWorkouts();
        const todayEntries=workouts.filter(w=>w.date===date);
        for(const w of todayEntries){
          const muscle=t.getMuscleSync(w.name);
          const zoneArr=t.MUSCLE_ZONES[muscle];
          if(!zoneArr||!zoneArr.length)continue;
          const setCount=String(w.reps||'').split(',').filter(Boolean).length;
          if(setCount) add(scores,{[zoneArr[0]]:Math.min(3,setCount)*.7});
        }
      }catch{}
    }
    return scores;
  }
  function colorForScore(score,max=3){
    if(!score)return '#45454d';
    const ratio=Math.min(1,score/Math.max(max,.01));
    return ratio<.4?'#f2c94c':ratio<.75?'#f17842':'#ef334e';
  }
  function buildSvg(view,scores,max){
    const anatomy=root.ForjaMuscleAnatomy;
    const zoneMap=(root.ForjaMuscleAnatomyRender&&root.ForjaMuscleAnatomyRender.GROUP_ZONE)||{};
    if(!anatomy||!anatomy[view])return '';
    const data=anatomy[view];
    const clipId='anatomy-day-clip-'+view;
    const outline=data.outline.map(p=>'<path d="'+p.d+'"/>').join('');
    const zones=zoneMap[view]||{};
    const shapes=data.muscles.map(part=>{
      const zone=zones[part.group]||'forearm';
      const score=scores[zone]||0;
      const color=colorForScore(score,max);
      const op=score?.78:.4;
      const title=ZONE_NAMES[zone]||'Outro';
      return '<path d="'+part.d+'" fill="'+color+'" fill-opacity="'+op+'" stroke="#0a0a0a" stroke-opacity=".5" stroke-width="2" data-muscle="'+zone+'"><title>'+title+'</title></path>';
    }).join('');
    return '<svg viewBox="0 0 1024 1536" role="img" aria-label="Corpo de '+(view==='front'?'frente':'costas')+' com os grupos musculares do dia">'
      +'<defs><clipPath id="'+clipId+'">'+outline+'</clipPath></defs>'
      +'<g clip-path="url(#'+clipId+')"><image href="assets/muscle-'+view+'.webp" x="0" y="0" width="1024" height="1536" preserveAspectRatio="xMidYMid slice" style="filter:grayscale(1) brightness(.72) contrast(1.05)"/></g>'
      +shapes+'</svg>';
  }
  function legendHtml(){
    return '<div class="muscle-map-legend"><span><i class="idle"></i> Sem indicação</span><span><i class="medium"></i> Participação</span><span><i class="high"></i> Maior destaque</span></div>';
  }
  function htmlFromScores(scores){
    const max=Math.max(...Object.values(scores),0);
    const top=Object.entries(scores).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k])=>ZONE_NAMES[k]);
    return '<div class="muscle-map-views"><figure><figcaption>Frente</figcaption>'+buildSvg('front',scores,max)+'</figure><figure><figcaption>Costas</figcaption>'+buildSvg('back',scores,max)+'</figure></div>'
      +legendHtml()
      +'<p class="calc-formula-note">'+(top.length?('Destaques: '+top.join(' · ')):'Sem treino detalhado neste dia.')+'</p>';
  }
  let requestId=0;
  async function render(date){
    const target=root.document&&root.document.getElementById('progress-muscle-map');
    if(!target)return;
    const id=++requestId;
    target.textContent='Carregando mapa muscular...';
    try{
      const scores=await scoreDay(date);
      if(id!==requestId)return;
      target.innerHTML=htmlFromScores(scores);
    }catch(e){
      if(id===requestId)target.textContent='Não foi possível carregar o mapa muscular agora.';
      console.error('muscle-day-map',e);
    }
  }
  function showExample(){
    const target=root.document&&root.document.getElementById('progress-muscle-map');
    if(!target)return;
    requestId++;
    const scores={chest:2.1,back:1.8,shoulder:1.5,arm_front:.9,arm_back:.6,abs:1.6,legs:2.8,glute:2,calf:1.2};
    target.innerHTML='<p class="calc-formula-note"><strong>Exemplo visual — dados fictícios.</strong> Toque em um dia do calendário para voltar aos seus dados.</p>'+htmlFromScores(scores);
  }
  root.ForjaMuscleDayMap={scoreDay,movementWeights,colorForScore,render,showExample};
})(typeof globalThis!=='undefined'?globalThis:this);
