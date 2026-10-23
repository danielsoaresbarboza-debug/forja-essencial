/* Aba "Biblioteca de exercícios" — um lugar só pra ver TODOS os exercícios:
   os seus (com a foto que você mesmo tirou na academia e o último peso/reps
   que você fez, pra não perder esse histórico) e os da biblioteca externa
   (762+ exercícios, Kinetic + free-exercise-db). Navegável por categoria,
   sem precisar digitar nada — e também buscável. Tocar num exercício abre
   um detalhe com a opção de já usá-lo no treino de hoje. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.ForjaExerciseLibraryTab=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const $=(id)=>root.document&&root.document.getElementById(id);
  const T=()=>root.ForjaGymTraining;
  const G=()=>root.ForjaGymUI;
  const dn=(n)=>root.ForjaExerciseNames&&root.ForjaExerciseNames.display?root.ForjaExerciseNames.display(n):n;
  const hay=(n)=>root.ForjaExerciseNames&&root.ForjaExerciseNames.haystack?root.ForjaExerciseNames.haystack(n):normText(n);

  let filter='Todos';
  let query='';
  let catalogLimit=48;
  const CATALOG_PAGE=48;

  // ---- Favoritos: marcação rápida (estrela) pra achar de novo sem navegar
  // por categoria/busca toda vez — útil pros exercícios fixos da sua academia. ----
  const K_LIB_FAV='exercise-library-favorites';
  let favCache=null;
  async function loadFavCache(){
    if(favCache)return favCache;
    const t=T();
    try{ const r=await t.storage().get(K_LIB_FAV); favCache=r?.value?JSON.parse(r.value):{}; }
    catch{ favCache={}; }
    return favCache;
  }
  async function persistFavCache(){
    const t=T();
    await t.storage().set(K_LIB_FAV,JSON.stringify(favCache||{}));
  }
  function isFavoriteSync(name){
    if(!favCache)return false;
    const t=T();
    return !!favCache[t.slug(name)];
  }
  async function toggleFavorite(name,source,muscleHint){
    const t=T();
    await loadFavCache();
    const key=t.slug(name);
    if(favCache[key]){
      delete favCache[key];
      root.showToast?.(`${dn(name)} removido dos favoritos.`);
    } else {
      favCache[key]={name,source:source||'mine',muscleHint:muscleHint||''};
      root.showToast?.(`${dn(name)} adicionado aos favoritos! ⭐`);
    }
    await persistFavCache();
    if(filter==='Favoritos') render(); else { renderMine(); renderCatalog(); }
    const card=$('lib-detail-card');
    if(card&&card.style.display!=='none') await showDetail(name,source,muscleHint);
  }
  async function renderFavorites(){
    const t=T();const wrap=$('lib-mine-list'),catWrap=$('lib-catalog-list'),hint=$('lib-catalog-hint'),moreBtn=$('lib-load-more-btn');
    if(moreBtn)moreBtn.style.display='none';
    if(hint)hint.textContent='';
    await loadFavCache();
    const entries=Object.values(favCache||{});
    const q=normText(query);
    const filtered=entries.filter(e=>!q||hay(e.name).includes(q));
    if(catWrap)catWrap.innerHTML='';
    if(!wrap)return;
    if(!filtered.length){
      wrap.innerHTML='<div class="empty">Nenhum favorito ainda. Abra um exercício e toque na estrela pra guardar aqui.</div>';
      return;
    }
    const lib=root.ForjaExerciseLibrary;
    const freeLib=root.ForjaFreeExerciseLibrary||[];
    const rows=await Promise.all(filtered.map(async entry=>{
      const {name,source,muscleHint}=entry;
      let photo=null,sub='';
      if(source==='mine'){
        photo=t.getPhotoSync(name)||(lib&&lib.getWgerImageSync?lib.getWgerImageSync(name):null);
        sub=await lastSetSummary(name);
      } else if(source==='equipment'){
        const eq=(t.CARDIO_EQUIPMENT||[]).find(e=>e.name===name);
        photo=null;
      } else {
        const freeRow=freeLib.find(r=>normText(r[1])===normText(name));
        photo=freeRow&&freeRow[5];
      }
      const eq=source==='equipment'?(t.CARDIO_EQUIPMENT||[]).find(e=>e.name===name):null;
      const img=photo?`<img src="${photo}">`:`<div class="ex-chip-ph">${eq?eq.icon:'🏋️'}</div>`;
      const nameEsc=name.replace(/'/g,"\\'"),hintEsc=(muscleHint||'').replace(/'/g,"\\'");
      const args=`'${nameEsc}','${source}'${muscleHint?`,'${hintEsc}'`:''}`;
      const favArgs=`'${nameEsc}','${source}','${hintEsc}'`;
      return `<div class="ex-chip ex-chip-fav" onclick="ForjaExerciseLibraryTab.showDetail(${args})"><button type="button" class="ex-fav-star on" onclick="event.stopPropagation();ForjaExerciseLibraryTab.toggleFavorite(${favArgs})">★</button>${img}<div class="lbl">${t.escapeHtml(dn(name))}</div>${sub?`<div class="sub">${t.escapeHtml(sub)}</div>`:''}</div>`;
    }));
    wrap.innerHTML=rows.join('');
  }

  function normText(s){
    const g=G();
    return g&&g.normCatalogText ? g.normCatalogText(s) : String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
  }

  function matchesFilter(muscleCat){
    const t=T();if(!t)return true;
    if(filter==='Todos')return true;
    if(filter==='Favoritos')return true;
    if(filter==='Superior')return t.SUPERIOR_GROUPS.includes(muscleCat);
    if(filter==='Inferior')return t.INFERIOR_GROUPS.includes(muscleCat);
    if(filter==='Push')return t.PUSH_GROUPS.includes(muscleCat);
    if(filter==='Pull')return t.PULL_GROUPS.includes(muscleCat);
    if(filter==='Pernas')return t.LEGS_GROUPS.includes(muscleCat);
    if(filter==='Cardio')return muscleCat==='Cardio';
    return muscleCat===filter;
  }

  function selectFilter(btn){
    root.document.querySelectorAll('#tab-biblioteca .filter-chip').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    filter=btn.dataset.libFilter;
    catalogLimit=CATALOG_PAGE;
    if(filter==='Favoritos'){
      // Uma busca deixada de uma categoria anterior não deveria esconder
      // favoritos que não batem com aquele texto — começa limpo.
      query='';
      const searchInput=$('lib-search-input');
      if(searchInput)searchInput.value='';
    }
    render();
  }

  let searchTimer=null;
  function onSearch(value){
    query=(value||'').trim();
    clearTimeout(searchTimer);
    searchTimer=setTimeout(()=>{catalogLimit=CATALOG_PAGE;render();},150);
  }

  async function lastSetSummary(name){
    const t=T();
    const arr=await t.loadWorkouts();
    const past=arr.filter(e=>e.name.trim()===name).sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')));
    if(!past.length)return '';
    const e=past[0];
    const ws=t.parseWeightList(e.weight),rs=t.parseRepsList(e.reps);
    if(!ws.length&&!rs.length)return t.fmtDate(e.date);
    const w=ws.length?ws[ws.length-1]:null,r=rs.length?rs[rs.length-1]:null;
    const parts=[];
    if(w!=null)parts.push(`${t.fmtWeight(w)}kg`);
    if(r!=null)parts.push(`${r}x`);
    return `${parts.join(' · ')} · ${t.fmtDate(e.date)}`;
  }

  async function renderMine(){
    const t=T();const wrap=$('lib-mine-list');if(!wrap)return;
    await t.loadMuscleCache();await t.loadPhotosCache();await loadFavCache();
    const names=await t.getRecentExerciseNames();
    const q=normText(query);
    const filtered=names.filter(name=>{
      if(q&&!hay(name).includes(q))return false;
      return matchesFilter(t.getMuscleSync(name));
    });
    if(!filtered.length){
      wrap.innerHTML='<div class="empty">Nenhum exercício seu nessa categoria ainda. Os que você usar nos treinos (ou fotografar) aparecem aqui — a biblioteca completa está logo abaixo.</div>';
      return;
    }
    const lib=root.ForjaExerciseLibrary;
    const rows=await Promise.all(filtered.slice(0,100).map(async name=>{
      const photo=t.getPhotoSync(name)||(lib&&lib.getWgerImageSync?lib.getWgerImageSync(name):null);
      const img=photo?`<img src="${photo}">`:`<div class="ex-chip-ph">🏋️</div>`;
      const sub=await lastSetSummary(name);
      const fav=isFavoriteSync(name);
      const nameEsc=name.replace(/'/g,"\\'");
      return `<div class="ex-chip ex-chip-mine" onclick="ForjaExerciseLibraryTab.showDetail('${nameEsc}','mine')"><button type="button" class="ex-fav-star${fav?' on':''}" onclick="event.stopPropagation();ForjaExerciseLibraryTab.toggleFavorite('${nameEsc}','mine')">${fav?'★':'☆'}</button>${img}<div class="lbl">${t.escapeHtml(dn(name))}</div>${sub?`<div class="sub">${t.escapeHtml(sub)}</div>`:''}</div>`;
    }));
    wrap.innerHTML=rows.join('');
  }

  function renderCatalog(){
    const t=T();const wrap=$('lib-catalog-list'),hint=$('lib-catalog-hint'),moreBtn=$('lib-load-more-btn');
    if(!wrap)return;
    const g=G();
    if(!g){wrap.innerHTML='';return;}
    if(filter==='Cardio'){
      // Esteira, bike, escada etc. não existem nos bancos de exercícios (só musculação)
      // — essa listinha fixa cobre o que normalmente tem na academia.
      if(moreBtn)moreBtn.style.display='none';
      const q=normText(query);
      const equipment=(t.CARDIO_EQUIPMENT||[]).filter(eq=>!q||normText(eq.name).includes(q));
      if(hint)hint.textContent=equipment.length?'':'Nenhum equipamento de cardio encontrado com esse nome.';
      wrap.innerHTML=equipment.map(eq=>{
        const nameEsc=eq.name.replace(/'/g,"\\'");
        const fav=isFavoriteSync(eq.name);
        return `<div class="ex-chip" onclick="ForjaExerciseLibraryTab.showDetail('${nameEsc}','equipment')"><button type="button" class="ex-fav-star${fav?' on':''}" onclick="event.stopPropagation();ForjaExerciseLibraryTab.toggleFavorite('${nameEsc}','equipment')">${fav?'★':'☆'}</button><div class="ex-chip-ph">${eq.icon}</div><div class="lbl">${t.escapeHtml(eq.name)}</div></div>`;
      }).join('');
      return;
    }
    const CATALOG_MUSCLE_MAP=g.CATALOG_MUSCLE_MAP||{},FREE_EX_MUSCLE_MAP=g.FREE_EX_MUSCLE_MAP||{};
    const catalog=root.ForjaGymCatalog||[];
    const freeLib=root.ForjaFreeExerciseLibrary||[];
    const q=normText(query);
    const terms=(root.ForjaPtSynonyms&&q)?root.ForjaPtSynonyms.expandTerms(query).map(normText):(q?[q]:null);
    const textMatches=(...fields)=>!terms||terms.some(term=>fields.some(f=>normText(f).includes(term)));

    const catalogAll=catalog.filter(row=>matchesFilter(CATALOG_MUSCLE_MAP[row[2]])&&textMatches(row[0],row[1],row[2],dn(row[0])));
    const seen=new Set();
    const catalogDeduped=[];
    for(const row of catalogAll){const key=normText(row[0]);if(seen.has(key))continue;seen.add(key);catalogDeduped.push(row);}
    const freeAll=freeLib.filter(row=>{
      const key=normText(row[1]);if(seen.has(key))return false;
      return matchesFilter(FREE_EX_MUSCLE_MAP[row[3]])&&textMatches(row[1],row[2],row[3],dn(row[1]));
    });
    freeAll.forEach(row=>seen.add(normText(row[1])));

    const totalAvailable=catalogDeduped.length+freeAll.length;
    if(filter==='Todos'&&!q){
      wrap.innerHTML='';
      if(hint)hint.textContent='Toque numa categoria acima ou busque pelo nome pra ver os exercícios da biblioteca completa.';
      if(moreBtn)moreBtn.style.display='none';
      return;
    }
    if(hint)hint.textContent=totalAvailable?`${totalAvailable} exercício(s) encontrado(s).`:'';

    const catalogSlice=catalogDeduped.slice(0,catalogLimit);
    const freeBudget=Math.max(0,catalogLimit-catalogSlice.length);
    const freeSlice=freeAll.slice(0,freeBudget);

    const catalogChips=catalogSlice.map(row=>{
      const[en,,muscle]=row;
      const freeRow=freeLib.find(r=>normText(r[1])===normText(en));
      const ptData=freeRow&&(root.ForjaFreeExercisePt||{})[freeRow[0]];
      const displayName=dn(en);
      const thumb=freeRow&&freeRow[5]?`<img src="${freeRow[5]}">`:`<div class="ex-chip-ph">🏋️</div>`;
      const enEsc=en.replace(/'/g,"\\'"),muscleEsc=muscle.replace(/'/g,"\\'");
      const fav=isFavoriteSync(en);
      return `<div class="ex-chip" onclick="ForjaExerciseLibraryTab.showDetail('${enEsc}','catalog','${muscleEsc}')"><button type="button" class="ex-fav-star${fav?' on':''}" onclick="event.stopPropagation();ForjaExerciseLibraryTab.toggleFavorite('${enEsc}','catalog','${muscleEsc}')">${fav?'★':'☆'}</button>${thumb}<div class="lbl">${t.escapeHtml(displayName)}</div></div>`;
    });
    const freeChips=freeSlice.map(row=>{
      const[id,en,,musclePt,,img]=row;
      const ptData=(root.ForjaFreeExercisePt||{})[id];
      const displayName=dn(en);
      const thumb=img?`<img src="${img}">`:`<div class="ex-chip-ph">🏋️</div>`;
      const enEsc=en.replace(/'/g,"\\'"),muscleEsc=(musclePt||'').replace(/'/g,"\\'");
      const fav=isFavoriteSync(en);
      return `<div class="ex-chip" onclick="ForjaExerciseLibraryTab.showDetail('${enEsc}','free','${muscleEsc}')"><button type="button" class="ex-fav-star${fav?' on':''}" onclick="event.stopPropagation();ForjaExerciseLibraryTab.toggleFavorite('${enEsc}','free','${muscleEsc}')">${fav?'★':'☆'}</button>${thumb}<div class="lbl">${t.escapeHtml(displayName)}</div></div>`;
    });
    wrap.innerHTML=(catalogChips.join('')+freeChips.join(''))||'<div class="empty">Nenhum exercício encontrado.</div>';
    const shown=catalogSlice.length+freeSlice.length;
    if(moreBtn)moreBtn.style.display=(shown<totalAvailable)?'block':'none';
  }

  function loadMore(){
    catalogLimit+=CATALOG_PAGE;
    renderCatalog();
  }

  // Monta nome PT/EN + descrição curta a partir da fonte do exercício — usado
  // tanto no popup de toque longo quanto no card de detalhe da Biblioteca.
  // Muitos aparelhos de academia só mostram o nome em inglês, então vale
  // sempre mostrar os dois quando soubermos o par.
  function buildNamesAndDesc(name,source,muscleHint){
    const freeLib=root.ForjaFreeExerciseLibrary||[];
    const ptMap=root.ForjaFreeExercisePt||{};
    let namePt=name,nameEn='',desc='';
    if(source==='equipment'){
      const eq=(T().CARDIO_EQUIPMENT||[]).find(e=>e.name===name);
      nameEn=eq?eq.en:'';
    } else if(source==='catalog'){
      nameEn=name; // onclick já passa o nome em inglês do catálogo
      const freeRow=freeLib.find(r=>normText(r[1])===normText(name));
      const ptData=freeRow&&ptMap[freeRow[0]];
      namePt=(ptData&&ptData.name_pt)?ptData.name_pt:name;
      desc=(ptData&&ptData.instr_pt&&ptData.instr_pt[0])||'';
      if(!desc){
        const catRow=(root.ForjaGymCatalog||[]).find(r=>normText(r[0])===normText(name));
        if(catRow)desc=`Equipamento: ${catRow[3]||'—'} · Músculo: ${catRow[2]||muscleHint||'—'}`;
      }
    } else if(source==='free'){
      nameEn=name;
      const freeRow=freeLib.find(r=>normText(r[1])===normText(name));
      const ptData=freeRow&&ptMap[freeRow[0]];
      namePt=(ptData&&ptData.name_pt)?ptData.name_pt:name;
      desc=(ptData&&ptData.instr_pt&&ptData.instr_pt[0])||(freeRow&&freeRow[6]?String(freeRow[6]).split('|')[0]:'');
    } else { // 'mine' — tenta achar o nome em inglês correspondente, se existir
      const freeRow=freeLib.find(r=>normText(r[1])===normText(name));
      if(freeRow){
        nameEn=freeRow[1];
        const ptData=ptMap[freeRow[0]];
        desc=(ptData&&ptData.instr_pt&&ptData.instr_pt[0])||String(freeRow[6]||'').split('|')[0];
      } else {
        const eq=(T().CARDIO_EQUIPMENT||[]).find(e=>e.name===name);
        if(eq)nameEn=eq.en;
      }
    }
    const shown=dn(name);
    if(shown&&shown!==name){namePt=shown;if(!nameEn)nameEn=name;}
    return {namePt,nameEn:(nameEn&&normText(nameEn)!==normText(namePt))?nameEn:'',desc};
  }

  async function showDetail(name,source,muscleHint){
    const t=T();const g=G();const card=$('lib-detail-card');if(!card)return;
    let muscle,isCardio=false;
    if(source==='mine'){
      await t.loadMuscleCache();
      muscle=t.getMuscleSync(name);
      isCardio=muscle==='Cardio';
    } else if(source==='catalog'){
      muscle=(g.CATALOG_MUSCLE_MAP||{})[muscleHint]||'Peito';
    } else if(source==='equipment'){
      muscle='Cardio';isCardio=true;
    } else {
      muscle=(g.FREE_EX_MUSCLE_MAP||{})[muscleHint]||'Peito';
    }
    const lib=root.ForjaExerciseLibrary;
    const myPhoto=t.getPhotoSync(name);
    const freeLib=root.ForjaFreeExerciseLibrary||[];
    const freeRow=freeLib.find(r=>normText(r[1])===normText(name));
    const catalogPhoto=freeRow&&freeRow[5];
    const equipIcon=isCardio?((t.CARDIO_EQUIPMENT||[]).find(e=>e.name===name)?.icon||'🚴'):null;
    const photo=myPhoto||catalogPhoto||(lib&&lib.getWgerImageSync?lib.getWgerImageSync(name):null);
    const sub=source==='mine'?await lastSetSummary(name):'';
    const {namePt,nameEn,desc}=buildNamesAndDesc(name,source,muscleHint);
    await loadFavCache();
    const fav=isFavoriteSync(name);
    const nameEsc=name.replace(/'/g,"\\'"),muscleEsc=muscle.replace(/'/g,"\\'"),hintEsc=(muscleHint||'').replace(/'/g,"\\'");
    card.style.display='block';
    card.innerHTML=`
      <div class="card-head"><h2>${t.escapeHtml(namePt)}</h2><button class="switch-btn" onclick="ForjaExerciseLibraryTab.closeDetail()">Fechar</button></div>
      ${photo?`<img class="library-media" src="${photo}" alt="" draggable="false">`:(equipIcon?`<div class="ex-chip-ph" style="height:120px;font-size:48px;">${equipIcon}</div>`:'')}
      ${nameEn?`<p class="calc-formula-note">🇬🇧 Nome no aparelho/inglês: <b>${t.escapeHtml(nameEn)}</b></p>`:''}
      <p class="calc-formula-note">Grupo muscular: ${t.escapeHtml(muscle)}${isCardio?' (registro por tempo/distância/kcal)':''}${sub?` · Última vez: ${t.escapeHtml(sub)}`:''}${myPhoto?' · 📸 Foto sua':''}</p>
      ${desc?`<p class="calc-formula-note">${t.escapeHtml(desc)}</p>`:''}
      <div class="water-action-row">
        <button type="button" class="primary" onclick="ForjaExerciseLibraryTab.useNow('${nameEsc}','${muscleEsc}',${isCardio})">Usar no treino de hoje</button>
        <button type="button" class="primary secondary-btn" onclick="ForjaExerciseLibraryTab.toggleFavorite('${nameEsc}','${source}','${hintEsc}')">${fav?'★ Favorito':'☆ Favoritar'}</button>
      </div>
      <button type="button" class="more-toggle" onclick="ForjaExerciseLibraryTab.pickPhoto('${nameEsc}','${source}','${hintEsc}')">📷 ${myPhoto?'Trocar minha foto deste exercício':'Adicionar minha foto deste exercício'}</button>
    `;
    card.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function closeDetail(){const card=$('lib-detail-card');if(card){card.style.display='none';card.innerHTML='';}}

  async function useNow(name,muscle,isCardio){
    const t=T();const g=G();
    const cache=await t.loadMuscleCache();
    const key=t.slug(name);
    if(!cache[key]&&muscle){cache[key]=muscle;await t.persistMuscleCache();}
    if(isCardio){
      const modeCache=await t.loadWeightModeCache();
      if(!modeCache[key]){modeCache[key]='cardio';await t.persistWeightModeCache();}
    }
    if(!g)return;
    if(!document.getElementById('session-running')||document.getElementById('session-running').style.display==='none'){
      await g.startWorkoutSession();
    }
    await g.addExerciseToSession(name);
    closeDetail();
    root.switchTab?.('academia');
    root.showToast?.(`${dn(name)} adicionado ao treino de hoje!`);
  }

  function pickPhoto(name,source,hint){
    const t=T();const input=root.document.createElement('input');input.type='file';input.accept='image/*';
    input.onchange=async()=>{
      const f=input.files&&input.files[0];if(!f)return;
      try{
        const url=await t.fileToSmallDataUrl(f);
        await t.setExercisePhoto(name,url);
        root.showToast?.('Foto salva — agora ela aparece no treino também.');
        await showDetail(name,source,hint);
        render();
      }catch(e){root.showToast?.(e.message||'Não consegui salvar a foto.');}
    };
    input.click();
  }

  async function render(){
    if(!$('lib-mine-list'))return;
    if(filter==='Favoritos'){ await renderFavorites(); return; }
    await renderMine();
    renderCatalog();
  }

  return{pickPhoto,selectFilter,onSearch,showDetail,closeDetail,useNow,loadMore,render,buildNamesAndDesc,toggleFavorite,isFavoriteSync,loadFavCache};
});
