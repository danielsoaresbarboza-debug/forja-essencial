(function(root){
  'use strict';
  let pending = null;
  function esc(s){ return String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  function parseAndPreview(){
    const ta = document.getElementById('quick-diet-text');
    const resultEl = document.getElementById('quick-diet-result');
    const text = (ta?.value || '').trim();
    if(!resultEl) return;
    if(!text){ root.showToast?.('Cole o texto do Gemini primeiro.'); return; }
    let parsed;
    try{
      parsed = root.ForjaNutrition.parse(text);
      if(!parsed.description) parsed.description = 'Refeição via texto colado (Gemini)';
      root.ForjaNutrition.validate(parsed);
    }catch(err){
      resultEl.innerHTML = `<p class="calc-formula-note" style="color:var(--red,#ff4d4d);">${esc(err.message)} — confira se o texto tem uma linha tipo "Total: 850 kcal".</p>`;
      pending = null;
      return;
    }
    pending = parsed;
    resultEl.innerHTML = `
      <div class="calorie-result-card" style="margin-top:10px;"><div class="lbl">Total encontrado</div><div class="val">${parsed.kcal} kcal</div></div>
      <div class="goal-grid" style="margin-bottom:10px;">
        <div class="goal-cell"><div class="glbl">Proteína</div><div class="gval">${parsed.protein_g ?? '–'}${parsed.protein_g!=null?'g':''}</div></div>
        <div class="goal-cell"><div class="glbl">Carbo</div><div class="gval">${parsed.carbs_g ?? '–'}${parsed.carbs_g!=null?'g':''}</div></div>
        <div class="goal-cell"><div class="glbl">Gordura</div><div class="gval">${parsed.fat_g ?? '–'}${parsed.fat_g!=null?'g':''}</div></div>
      </div>
      <label>Descrição identificada</label>
      <p class="calc-formula-note">${esc(parsed.description || 'Refeição lançada via texto colado.')}</p>
      <button class="primary" onclick="ForjaQuickDiet.confirmSave()">✓ Lançar no dia de hoje</button>
    `;
  }

  async function confirmSave(){
    if(!pending) return;
    try{
      const itemsForShortcuts = pending.items;
      await root.ForjaDietBridge.saveQuick(pending);
      await autoSaveShortcuts(itemsForShortcuts);
      pending = null;
      const ta = document.getElementById('quick-diet-text'); if(ta) ta.value = '';
      const resultEl = document.getElementById('quick-diet-result'); if(resultEl) resultEl.innerHTML = '';
      const zeppStatus = document.getElementById('quick-diet-zepp-status'); if(zeppStatus) zeppStatus.textContent = '';
    }catch(err){
      root.showToast?.(err.message || 'Não consegui lançar. Tente de novo.');
    }
  }

  // ===== Lançar texto do Gemini em UM toque (sem etapa de conferência) =====
  async function launchText(){
    const ta=document.getElementById('quick-diet-text');
    const resultEl=document.getElementById('quick-diet-result');
    const text=(ta?.value||'').trim();
    if(!text){root.showToast?.('Cole o texto do Gemini primeiro.');return;}
    let parsed;
    try{
      parsed=root.ForjaNutrition.parse(text);
      if(!parsed.description)parsed.description='Refeição (Gemini)';
      root.ForjaNutrition.validate(parsed);
    }catch(err){
      if(resultEl)resultEl.innerHTML=`<p class="calc-formula-note" style="color:var(--red,#ff4d4d);">${esc(err.message)} — confira se o texto tem uma linha tipo "Total: 850 kcal".</p>`;
      return;
    }
    try{
      await root.ForjaDietBridge.saveQuick(parsed);
      const n=await autoSaveShortcuts(parsed.items);
      if(ta)ta.value='';
      if(resultEl)resultEl.innerHTML=n?`<p class="calc-formula-note">⚡ ${n} atalho${n===1?'':'s'} novo${n===1?'':'s'} criado${n===1?'':'s'} — é só tocar nele da próxima vez.</p>`:'';
    }catch(err){
      root.showToast?.(err.message||'Não consegui lançar. Tente de novo.');
    }
  }

  // ===== Atalhos: cada alimento que você lança (por texto ou foto) vira um botão =====
  const K_SHORTCUTS='quick-diet-shortcuts-v1';
  let shortcuts=null,editMode=false;
  const store=()=>root.ForjaStorage||root.storage;
  const norm=(s)=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]+/g,' ').trim();
  async function loadShortcuts(){
    if(shortcuts)return shortcuts;
    try{const r=await store().get(K_SHORTCUTS);shortcuts=r?.value?JSON.parse(r.value):[];}catch{shortcuts=[];}
    if(!Array.isArray(shortcuts))shortcuts=[];
    return shortcuts;
  }
  async function persistShortcuts(){try{await store().set(K_SHORTCUTS,JSON.stringify(shortcuts||[]));}catch{}}
  async function autoSaveShortcuts(items){
    if(!Array.isArray(items)||!items.length)return 0;
    await loadShortcuts();
    let created=0;
    items.forEach(it=>{
      if(!it||!it.name||!Number.isFinite(Number(it.kcal)))return;
      const key=norm(it.name)+'|'+norm(it.qty);
      const existing=shortcuts.find(x=>x.key===key);
      const data={name:it.name,qty:it.qty||'',kcal:Number(it.kcal),protein_g:it.protein_g??null,carbs_g:it.carbs_g??null,fat_g:it.fat_g??null};
      if(existing){Object.assign(existing,data);}
      else{shortcuts.push({id:'sc-'+Date.now().toString(36)+Math.random().toString(16).slice(2,6),key,uses:0,created:Date.now(),...data});created++;}
    });
    if(shortcuts.length>60)shortcuts=shortcuts.sort((a,b)=>(b.uses-a.uses)||(b.created-a.created)).slice(0,60);
    await persistShortcuts();
    await renderShortcuts();
    return created;
  }
  async function tapShortcut(id){
    await loadShortcuts();
    const sc=shortcuts.find(x=>x.id===id);if(!sc)return;
    if(editMode){return;}
    try{
      await root.ForjaDietBridge.saveQuick({description:sc.name+(sc.qty?` (${sc.qty})`:''),kcal:sc.kcal,protein_g:sc.protein_g,carbs_g:sc.carbs_g,fat_g:sc.fat_g,items:[],note:'Atalho rápido.'});
      sc.uses=(sc.uses||0)+1;sc.last=Date.now();
      await persistShortcuts();await renderShortcuts();
    }catch(err){root.showToast?.(err.message||'Não consegui lançar.');}
  }
  async function removeShortcut(id){
    await loadShortcuts();
    shortcuts=shortcuts.filter(x=>x.id!==id);
    await persistShortcuts();await renderShortcuts();
  }
  function toggleEdit(){editMode=!editMode;renderShortcuts();}
  async function renderShortcuts(){
    const wrap=document.getElementById('quick-shortcuts');if(!wrap)return;
    await loadShortcuts();
    const list=[...shortcuts].sort((a,b)=>((b.uses||0)-(a.uses||0))||((b.last||b.created||0)-(a.last||a.created||0)));
    if(!list.length){
      wrap.innerHTML='<p class="calc-formula-note">⚡ <b>Atalhos:</b> cada alimento que você lançar (colando o texto do Gemini ou por foto) vira um botão aqui — da próxima vez é só tocar.</p>';
      return;
    }
    wrap.innerHTML=`<div class="shortcut-head"><span>⚡ Atalhos — toque pra lançar</span><button type="button" class="shortcut-edit" onclick="ForjaQuickDiet.toggleEdit()">${editMode?'Pronto':'Editar'}</button></div>
      <div class="shortcut-grid">${list.map(sc=>`<div class="shortcut-chip${editMode?' editing':''}" onclick="ForjaQuickDiet.tapShortcut('${sc.id}')"><div class="sc-name">${esc(sc.name)}</div>${sc.qty?`<div class="sc-qty">${esc(sc.qty)}</div>`:''}<div class="sc-kcal">${Math.round(sc.kcal)} kcal${sc.protein_g!=null?` · P ${sc.protein_g}g`:''}</div>${editMode?`<button type="button" class="sc-del" onclick="event.stopPropagation();ForjaQuickDiet.removeShortcut('${sc.id}')" aria-label="Remover atalho">✕</button>`:''}</div>`).join('')}</div>`;
  }

  function fileToBase64(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  let zeppBusy = false;
  async function handleZeppPhoto(event){
    const file = event.target.files[0];
    event.target.value = '';
    if(!file || zeppBusy) return;
    const status = document.getElementById('quick-diet-zepp-status');
    const resultEl = document.getElementById('quick-diet-result');
    zeppBusy = true;
    if(status) status.textContent = '🔍 Lendo o print do Zepp...';
    try{
      const base64 = await fileToBase64(file);
      const parsed = await root.ForjaGeminiVision.analyzeDietScreenshot(base64, file.type);
      if(parsed.kcal===undefined || parsed.kcal===null) throw new Error('Não consegui achar as calorias nesse print.');
      const value = {
        description: `Importado do print do Zepp — ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}`,
        kcal: parsed.kcal,
        protein_g: parsed.protein_g ?? null,
        carbs_g: parsed.carbs_g ?? null,
        fat_g: parsed.fat_g ?? null,
      };
      pending = value;
      if(resultEl) resultEl.innerHTML = `
        <div class="calorie-result-card" style="margin-top:10px;"><div class="lbl">Lido do Zepp</div><div class="val">${value.kcal} kcal</div></div>
        <div class="goal-grid" style="margin-bottom:10px;">
          <div class="goal-cell"><div class="glbl">Proteína</div><div class="gval">${value.protein_g ?? '–'}${value.protein_g!=null?'g':''}</div></div>
          <div class="goal-cell"><div class="glbl">Carbo</div><div class="gval">${value.carbs_g ?? '–'}${value.carbs_g!=null?'g':''}</div></div>
          <div class="goal-cell"><div class="glbl">Gordura</div><div class="gval">${value.fat_g ?? '–'}${value.fat_g!=null?'g':''}</div></div>
        </div>
        ${parsed.kcal_queimado!=null?`<p class="calc-formula-note">🔥 Queimado (segundo o Zepp): ${parsed.kcal_queimado} kcal — não é somado automaticamente, é só referência.</p>`:''}
        <button class="primary" onclick="ForjaQuickDiet.confirmSave()">✓ Lançar no dia de hoje</button>
      `;
      if(status) status.textContent = '✅ Confira antes de lançar:';
    }catch(err){
      if(status) status.textContent = err.message || 'Não consegui ler esse print.';
    }finally{
      zeppBusy = false;
    }
  }

  root.ForjaQuickDiet = { parseAndPreview, confirmSave, handleZeppPhoto, launchText, autoSaveShortcuts, tapShortcut, removeShortcut, toggleEdit, renderShortcuts };
})(globalThis);
