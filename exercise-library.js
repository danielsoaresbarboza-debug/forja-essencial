(function(root){
  'use strict';
  const K_EXDB_KEY = 'exercisedb-api-key';
  const K_MEDIA_CACHE = 'exercise-media-cache-v1';
  const CACHE_TTL_MS = 1000*60*60*24*30; // 30 dias
  let mediaCache = null;

  function storage(){ return root.ForjaStorage || root.storage; }

  function norm(s){
    return String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
  }
  function slug(s){ return norm(s).replace(/\s+/g,'-'); }

  async function getApiKey(){
    try{ const r = await storage().get(K_EXDB_KEY); return r?.value || null; }catch{ return null; }
  }
  async function setApiKey(key){ await storage().set(K_EXDB_KEY, (key||'').trim()); }

  async function saveKeyFromUI(){
    const input = document.getElementById('exdb-api-key-input');
    const status = document.getElementById('exdb-key-status');
    const key = (input?.value || '').trim();
    if(!key){ if(status) status.textContent = 'Cole uma chave válida.'; return; }
    await setApiKey(key);
    if(status) status.textContent = '✅ Chave salva neste aparelho.';
    if(root.showToast) root.showToast('Chave da ExerciseDB salva.');
  }
  async function renderKeyStatus(){
    const status = document.getElementById('exdb-key-status');
    if(!status) return;
    const key = await getApiKey();
    status.textContent = key ? `✅ Chave configurada (termina em ...${key.slice(-4)})` : 'Nenhuma chave configurada ainda — sem ela, a biblioteca usa só as fotos estáticas da wger.';
  }

  async function loadMediaCache(){
    if(mediaCache) return mediaCache;
    try{ const r = await storage().get(K_MEDIA_CACHE); mediaCache = r?.value ? JSON.parse(r.value) : {}; }catch{ mediaCache = {}; }
    return mediaCache;
  }
  async function persistMediaCache(){ await storage().set(K_MEDIA_CACHE, JSON.stringify(mediaCache||{})); }

  // category (wger, inglês) -> grupo muscular PT já usado pelo app
  const CATEGORY_PT_MAP = {
    Legs:'Perna', Arms:'Bíceps', Abs:'Abdômen', Chest:'Peito',
    Shoulders:'Ombro', Back:'Costas', Calves:'Panturrilha', Cardio:'Abdômen'
  };
  const EQUIP_PT_MAP = {
    'Barbell':'Barra','Dumbbell':'Halteres','Cable machine':'Polia','Bench':'Banco',
    'Incline bench':'Banco inclinado','SZ-Bar':'Barra W','Pull-up bar':'Barra fixa',
    'Kettlebell':'Kettlebell','Gym mat':'Colchonete','Resistance band':'Elástico',
    'none (bodyweight exercise)':'Peso corporal','Swiss Ball':'Bola suíça'
  };
  function translateEquip(list){
    return (list||[]).filter(Boolean).map(e=>EQUIP_PT_MAP[e]||e).join(', ');
  }

  // Procura o melhor par na biblioteca wger (bundled, sem rede) pelo nome (PT ou EN)
  function findWgerMatch(name){
    const lib = root.ForjaWgerLibrary || [];
    const q = norm(name);
    if(!q || !lib.length) return null;
    let best=null, bestScore=-1;
    for(const row of lib){
      const en = norm(row[1]), pt = norm(row[2]);
      let score=-1;
      if(en===q || (pt && pt===q)) score=100;
      else if(pt && (pt.includes(q)||q.includes(pt)) && Math.min(pt.length,q.length)>=4) score=80;
      else if((en.includes(q)||q.includes(en)) && Math.min(en.length,q.length)>=4) score=60;
      if(score>bestScore){ bestScore=score; best=row; }
    }
    return bestScore>=60 ? best : null;
  }

  // Procura o melhor par na biblioteca free-exercise-db (bundled, sem rede) pelo nome.
  // Linhas: [id,name_en,name_pt_hint,muscle_pt,equip_pt,img,instr]. name_pt_hint é uma dica
  // de palavra-chave (não é tradução completa), então o match usa sobreposição de palavras.
  function findFreeExerciseMatch(name){
    const lib = root.ForjaFreeExerciseLibrary || [];
    const q = norm(name);
    if(!q || !lib.length) return null;
    const qWords = q.split(' ').filter(Boolean);
    let best=null, bestScore=-1;
    for(const row of lib){
      const en = norm(row[1]), hint = norm(row[2]);
      let score=-1;
      if(en===q) score=100;
      else if((en.includes(q)||q.includes(en)) && Math.min(en.length,q.length)>=4) score=55;
      else if(hint){
        const hintWords = hint.split(' ').filter(Boolean);
        if(hintWords.some(w=>qWords.includes(w))) score=50;
      }
      if(score>bestScore){ bestScore=score; best=row; }
    }
    return bestScore>=50 ? best : null;
  }

  // Lookup síncrono (sem rede) — usado em listas grandes (picker) para já mostrar uma foto estática.
  // Tenta primeiro a wger, depois cai pro free-exercise-db.
  function getWgerImageSync(name){
    const m = findWgerMatch(name);
    if(m && m[5]) return m[5];
    const f = findFreeExerciseMatch(name);
    return f && f[5] ? f[5] : null;
  }

  async function tryExerciseDbGif(name){
    const key = await getApiKey();
    if(!key) return null;
    try{
      const res = await fetch(`https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(norm(name))}`, {
        headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': 'exercisedb.p.rapidapi.com' }
      });
      if(!res.ok) return null;
      const arr = await res.json();
      if(Array.isArray(arr) && arr.length) return arr.find(e=>e.gifUrl) || arr[0];
    }catch{ /* rede indisponível / chave inválida / limite excedido */ }
    return null;
  }

  // Busca completa (wger + ExerciseDB quando houver chave), com cache local persistido.
  async function getExerciseMedia(name, opts){
    const forceRefresh = opts && opts.forceRefresh;
    const cache = await loadMediaCache();
    const key = slug(name);
    const cached = cache[key];
    if(!forceRefresh && cached && (Date.now()-(cached.ts||0) < CACHE_TTL_MS)) return cached;

    const result = { img:null, gif:null, muscle_pt:null, equip_pt:null, instr:[], source:null, name_pt:null };

    const match = findWgerMatch(name);
    if(match){
      const [,en,pt,cat,equip,img,instr] = match;
      result.img = img || null;
      result.name_pt = pt || null;
      result.muscle_pt = CATEGORY_PT_MAP[cat] || null;
      result.equip_pt = translateEquip((equip||'').split(';').filter(Boolean)) || null;
      result.instr = (instr||'').split('|').filter(Boolean);
      result.source = 'wger';
    }

    // free-exercise-db como segunda fonte: preenche o que a wger não tinha (foto própria
    // do movimento, músculo/equipamento ou passo a passo). Quando existe tradução PT-BR
    // manual pro exercício (free-exercise-pt.js), ela tem prioridade sobre o inglês.
    const freeMatch = findFreeExerciseMatch(name);
    if(freeMatch){
      const [id,en,,musclePt,equipPt,img,instr] = freeMatch;
      const ptData = (root.ForjaFreeExercisePt||{})[id];
      const freeInstr = ptData && ptData.instr_pt && ptData.instr_pt.length ? ptData.instr_pt : (instr||'').split('|').filter(Boolean);
      if(!result.img && img) result.img = img;
      if(!result.name_pt && ptData && ptData.name_pt) result.name_pt = ptData.name_pt;
      if(!result.muscle_pt && musclePt) result.muscle_pt = musclePt;
      if(!result.equip_pt && equipPt) result.equip_pt = equipPt;
      if(!result.instr.length && freeInstr.length) result.instr = freeInstr;
      result.source = result.source ? result.source+'+free-exercise-db' : 'free-exercise-db';
    }

    const gifData = await tryExerciseDbGif(name);
    if(gifData && gifData.gifUrl){
      result.gif = gifData.gifUrl;
      result.source = result.img ? 'wger+exercisedb' : 'exercisedb';
      if(!result.muscle_pt && gifData.target) result.muscle_pt = gifData.target;
      if(!result.instr.length && Array.isArray(gifData.instructions)) result.instr = gifData.instructions;
    }

    if(!result.img && !result.gif && !result.instr.length) return null;

    cache[key] = {...result, ts:Date.now()};
    await persistMediaCache();
    return cache[key];
  }

  // Grupo muscular (PT) do free-exercise-db -> categoria interna do app (as 9 usadas em MUSCLE_ZONES).
  const FREE_EX_TO_APP_MUSCLE = {
    'Abdômen':'Abdômen', 'Quadril (abdutor)':'Perna', 'Quadril (adutor)':'Perna',
    'Bíceps':'Bíceps', 'Panturrilha':'Panturrilha', 'Peito':'Peito', 'Antebraço':'Bíceps',
    'Glúteo':'Glúteo', 'Posterior de coxa':'Perna', 'Costas (dorsal)':'Costas', 'Costas (meio)':'Costas',
    'Lombar':'Costas', 'Pescoço':'Costas', 'Quadríceps':'Perna', 'Ombro':'Ombro', 'Trapézio':'Costas', 'Tríceps':'Tríceps'
  };
  // Tenta adivinhar a categoria muscular interna do app (Peito/Costas/Ombro/Bíceps/Tríceps/
  // Abdômen/Perna/Glúteo/Panturrilha) pra um exercício, usando wger primeiro e depois
  // free-exercise-db. Usado pra remapear o histórico de exercícios do usuário.
  function guessAppMuscle(name){
    const w = findWgerMatch(name);
    if(w && CATEGORY_PT_MAP[w[3]]) return CATEGORY_PT_MAP[w[3]];
    const f = findFreeExerciseMatch(name);
    if(f && FREE_EX_TO_APP_MUSCLE[f[3]]) return FREE_EX_TO_APP_MUSCLE[f[3]];
    return null;
  }

  root.ForjaExerciseLibrary = {
    getApiKey, setApiKey, saveKeyFromUI, renderKeyStatus,
    getExerciseMedia, findWgerMatch, findFreeExerciseMatch, getWgerImageSync, guessAppMuscle, norm, slug
  };
})(typeof globalThis!=='undefined'?globalThis:this);
