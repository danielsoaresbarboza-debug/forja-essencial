(function(root){
  'use strict';
  const K_GEMINI_KEY = 'gemini-api-key';
  const MODEL = 'gemini-2.0-flash';

  async function getApiKey(){
    try{ const r = await root.ForjaStorage.get(K_GEMINI_KEY); return r?.value || null; }catch{ return null; }
  }
  async function setApiKey(key){ await root.ForjaStorage.set(K_GEMINI_KEY, key.trim()); }

  async function saveKeyFromUI(){
    const input = document.getElementById('gemini-api-key-input');
    const status = document.getElementById('gemini-key-status');
    const key = (input?.value || '').trim();
    if(!key){ if(status) status.textContent = 'Cole uma chave válida.'; return; }
    await setApiKey(key);
    if(status) status.textContent = '✅ Chave salva neste aparelho.';
    if(root.showToast) root.showToast('Chave do Gemini salva.');
  }
  async function renderKeyStatus(){
    const status = document.getElementById('gemini-key-status');
    if(!status) return;
    const key = await getApiKey();
    status.textContent = key ? `✅ Chave configurada (termina em ...${key.slice(-4)})` : 'Nenhuma chave configurada ainda.';
  }

  function fileToBase64(file){
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function analyzeFoodPhoto(base64Image, mimeType, userNote){
    const key = await getApiKey();
    if(!key) throw new Error('Configure sua chave do Gemini na aba Mais primeiro.');
    const noteBlock = userNote && userNote.trim()
      ? `\n\nA pessoa que enviou a foto também descreveu o prato com suas próprias palavras (use isso para completar o que a foto não mostra claramente — ingredientes escondidos, molhos, substituições, versão "light" de algo, etc. — e para identificar melhor os itens): "${userNote.trim()}"`
      : '';
    const prompt = 'Você é um nutricionista analisando uma foto de comida. Identifique cada item visível e estime a quantidade em gramas e as calorias.'+noteBlock+' Responda ESTRITAMENTE em JSON, sem texto adicional, neste formato exato: {"items":[{"name":"<item>","grams":<número>,"kcal":<número>,"protein_g":<número>,"carbs_g":<número>,"fat_g":<número>}],"kcal":<total inteiro>,"protein_g":<total>,"carbs_g":<total>,"fat_g":<total>,"note":"<observação curta em português sobre a estimativa, ex: aproximado, pode variar conforme preparo>"}';

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
    const body = {
      contents: [{ parts: [ {text: prompt}, {inline_data: {mime_type: mimeType, data: base64Image}} ] }],
      generationConfig: { responseMimeType: 'application/json' }
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
    if(!response.ok){
      const errText = await response.text().catch(() => '');
      let friendly = `Gemini retornou erro ${response.status}.`;
      if(response.status === 400) friendly = 'Chave inválida ou pedido malformado. Confira a chave na aba Mais.';
      if(response.status === 403) friendly = 'Chave sem permissão, ou cota gratuita esgotada.';
      if(response.status === 429) friendly = 'Limite de uso atingido por agora. Tenta de novo em alguns minutos.';
      throw new Error(friendly + (errText ? ' ' + errText.slice(0,150) : ''));
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if(!text) throw new Error('O Gemini não identificou nada legível nessa foto.');
    const cleaned = text.replace(/```json|```/g,'').trim();
    return JSON.parse(cleaned);
  }

  const MUSCLE_GROUPS = ['Peito','Costas','Ombro','Bíceps','Tríceps','Abdômen','Perna','Glúteo','Panturrilha'];
  async function analyzeExercisePhoto(base64Image, mimeType){
    const key = await getApiKey();
    if(!key) throw new Error('Configure sua chave do Gemini na aba Mais primeiro.');
    const prompt = `Você é um personal trainer analisando uma foto de um exercício de academia (pode ser o equipamento, a máquina, ou a pessoa executando o movimento). Identifique o nome do exercício em português e qual o principal grupo muscular trabalhado, escolhendo APENAS um destes valores exatos: ${MUSCLE_GROUPS.join(', ')}. Responda ESTRITAMENTE em JSON, sem texto adicional, neste formato exato: {"name":"<nome do exercício em português>","muscleGroup":"<um dos valores da lista>"}`;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
    const body = {
      contents: [{ parts: [ {text: prompt}, {inline_data: {mime_type: mimeType, data: base64Image}} ] }],
      generationConfig: { responseMimeType: 'application/json' }
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
    if(!response.ok){
      const errText = await response.text().catch(() => '');
      let friendly = `Gemini retornou erro ${response.status}.`;
      if(response.status === 400) friendly = 'Chave inválida ou pedido malformado. Confira a chave na aba Mais.';
      if(response.status === 403) friendly = 'Chave sem permissão, ou cota gratuita esgotada.';
      if(response.status === 429) friendly = 'Limite de uso atingido por agora. Tenta de novo em alguns minutos.';
      throw new Error(friendly + (errText ? ' ' + errText.slice(0,150) : ''));
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if(!text) throw new Error('O Gemini não identificou nada legível nessa foto.');
    const cleaned = text.replace(/```json|```/g,'').trim();
    const parsed = JSON.parse(cleaned);
    if(!MUSCLE_GROUPS.includes(parsed.muscleGroup)) parsed.muscleGroup = null;
    return parsed;
  }

  let exPhotoBusy = false;
  async function handleExercisePhoto(event){
    const file = event.target.files[0];
    event.target.value = '';
    if(!file || exPhotoBusy) return;
    const status = document.getElementById('new-ex-photo-status');
    exPhotoBusy = true;
    if(status) status.textContent = '🔍 Enviando foto pro Gemini...';
    try{
      const base64 = await fileToBase64(file);
      const parsed = await analyzeExercisePhoto(base64, file.type);
      const nameInput = document.getElementById('new-ex-name');
      if(nameInput && parsed.name) nameInput.value = parsed.name;
      if(parsed.muscleGroup && root.ForjaGymUI?.setMuscleForNew) root.ForjaGymUI.setMuscleForNew(parsed.muscleGroup, true);
      if(status) status.textContent = parsed.muscleGroup ? '✅ Identificado! Confira o nome e o grupo muscular antes de criar.' : '✅ Nome identificado — confira o grupo muscular.';
      if(root.showToast) root.showToast('Exercício identificado pelo Gemini.');
    }catch(err){
      if(status) status.textContent = err.message || 'Não consegui identificar essa foto.';
    }finally{
      exPhotoBusy = false;
    }
  }

  async function analyzeDietScreenshot(base64Image, mimeType){
    const key = await getApiKey();
    if(!key) throw new Error('Configure sua chave do Gemini na aba Mais primeiro.');
    const prompt = 'Você está olhando um print de tela de um app de dieta/nutrição (como o Zepp), mostrando os totais do dia: calorias comidas, calorias restantes ou queimadas, e os macros (carboidrato, proteína, gordura) em gramas. Leia os números exatamente como aparecem na tela. Responda ESTRITAMENTE em JSON, sem texto adicional, neste formato exato: {"kcal":<calorias comidas, número inteiro>,"kcal_queimado":<calorias de exercício/queimadas, número inteiro ou null se não aparecer>,"protein_g":<número ou null>,"carbs_g":<número ou null>,"fat_g":<número ou null>}';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${encodeURIComponent(key)}`;
    const body = {
      contents: [{ parts: [ {text: prompt}, {inline_data: {mime_type: mimeType, data: base64Image}} ] }],
      generationConfig: { responseMimeType: 'application/json' }
    };
    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body)
    });
    if(!response.ok){
      const errText = await response.text().catch(() => '');
      let friendly = `Gemini retornou erro ${response.status}.`;
      if(response.status === 400) friendly = 'Chave inválida ou pedido malformado. Confira a chave na aba Mais.';
      if(response.status === 403) friendly = 'Chave sem permissão, ou cota gratuita esgotada.';
      if(response.status === 429) friendly = 'Limite de uso atingido por agora. Tenta de novo em alguns minutos.';
      throw new Error(friendly + (errText ? ' ' + errText.slice(0,150) : ''));
    }
    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if(!text) throw new Error('O Gemini não conseguiu ler os números dessa tela.');
    const cleaned = text.replace(/```json|```/g,'').trim();
    return JSON.parse(cleaned);
  }

  let busy = false;
  async function handlePhoto(event){
    const file = event.target.files[0];
    event.target.value = '';
    if(!file || busy) return;
    const status = document.getElementById('gemini-photo-status');
    const preview = document.getElementById('gemini-photo-preview');
    const resultEl = document.getElementById('gemini-photo-result');
    if(!root.ForjaDietBridge?.hasMealTypeSelected?.()){
      if(status) status.textContent = 'Selecione o tipo de refeição (Almoço, Lanche, etc.) primeiro.';
      if(root.showToast) root.showToast('Selecione a refeição primeiro.');
      return;
    }
    busy = true;
    if(resultEl) resultEl.innerHTML = '';
    if(status) status.textContent = '🔍 Enviando foto pro Gemini...';
    try{
      const base64 = await fileToBase64(file);
      if(preview){ preview.src = 'data:'+file.type+';base64,'+base64; preview.hidden = false; }
      const parsed = await analyzeFoodPhoto(base64, file.type);
      if(status) status.textContent = 'Confira antes de salvar:';
      renderResult(parsed);
    }catch(err){
      if(status) status.textContent = err.message || 'Não consegui analisar essa foto.';
    }finally{
      busy = false;
    }
  }

  let pendingResult = null;
  function renderResult(parsed){
    pendingResult = parsed;
    const el = document.getElementById('gemini-photo-result');
    if(!el) return;
    const itemsHtml = (parsed.items||[]).map(i => `<div class="watch-hist-row"><span>${escapeHtml(i.name)} (${i.grams}g)</span><span>${i.kcal} kcal</span></div>`).join('');
    el.innerHTML = `
      <div class="calorie-result-card" style="margin:10px 0;"><div class="lbl">Estimativa total</div><div class="val">${parsed.kcal} kcal</div></div>
      <div class="goal-grid" style="margin-bottom:10px;">
        <div class="goal-cell"><div class="glbl">Proteína</div><div class="gval">${parsed.protein_g}g</div></div>
        <div class="goal-cell"><div class="glbl">Carbo</div><div class="gval">${parsed.carbs_g}g</div></div>
        <div class="goal-cell"><div class="glbl">Gordura</div><div class="gval">${parsed.fat_g}g</div></div>
      </div>
      <label>Itens identificados</label>
      <div style="margin-bottom:10px;">${itemsHtml || '<div class="empty">Nenhum item detalhado.</div>'}</div>
      ${parsed.note ? `<div class="science-tip"><div class="st-body">${escapeHtml(parsed.note)}</div></div>` : ''}
      <button class="primary" onclick="ForjaGeminiVision.confirmSave()" style="margin-top:10px;">✓ Adicionar à refeição</button>
    `;
  }
  function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  async function confirmSave(){
    if(!pendingResult) return;
    const description = (pendingResult.items||[]).map(i => `${i.name} (${i.grams}g)`).join(', ') || 'Refeição analisada por foto (Gemini)';
    const value = {
      description: description.slice(0,500),
      kcal: pendingResult.kcal,
      protein_g: pendingResult.protein_g ?? null,
      carbs_g: pendingResult.carbs_g ?? null,
      fat_g: pendingResult.fat_g ?? null,
    };
    try{
      root.ForjaNutrition.validate(value);
      await root.ForjaDietBridge.saveEstimate(value);
      pendingResult = null;
      const status = document.getElementById('gemini-photo-status');
      const resultEl = document.getElementById('gemini-photo-result');
      const preview = document.getElementById('gemini-photo-preview');
      if(status) status.textContent = '✅ Refeição salva!';
      if(resultEl) resultEl.innerHTML = '';
      if(preview){ preview.hidden = true; preview.removeAttribute('src'); }
      if(root.showToast) root.showToast('Refeição adicionada via Gemini.');
    }catch(err){
      if(root.showToast) root.showToast(err.message);
    }
  }

  // ================= QUICK PHOTO (Lançamento Rápido) =================
  // Mirrors how people actually use the Gemini app: pick/take the photo,
  // it sits there waiting, you type or dictate anything the photo alone
  // doesn't show ("é um salgado de frango", "é a versão light"), THEN it
  // gets analyzed — so selecting a photo here does NOT call Gemini yet.
  let quickBusy = false;
  let quickPendingResult = null;
  let quickPendingPhoto = null; // {base64, mimeType}

  function itemsListHtml(items){
    if(!items || !items.length) return '';
    const rows = items.map(i => `<div class="watch-hist-row"><span>${escapeHtml(i.name)}${i.grams?` (${i.grams}g)`:''}</span><span>${i.kcal} kcal</span></div>`).join('');
    return `<label style="margin-top:4px;">Itens identificados</label><div style="margin-bottom:10px;">${rows}</div>`;
  }

  function handleQuickPhotoSelect(event){
    const file = event.target.files[0];
    event.target.value = '';
    if(!file) return;
    const status = document.getElementById('quick-diet-photo-status');
    const preview = document.getElementById('quick-diet-photo-preview');
    const resultEl = document.getElementById('quick-diet-photo-result');
    const noteWrap = document.getElementById('quick-diet-photo-note-wrap');
    const noteInput = document.getElementById('quick-diet-photo-note');
    quickPendingResult = null;
    if(resultEl) resultEl.innerHTML = '';
    if(noteInput) noteInput.value = '';
    fileToBase64(file).then(base64 => {
      quickPendingPhoto = { base64, mimeType: file.type };
      if(preview){ preview.src = 'data:'+file.type+';base64,'+base64; preview.hidden = false; }
      if(noteWrap) noteWrap.hidden = false;
      if(status) status.textContent = 'Quer contar algo que a foto não mostra? (opcional) Depois toque em Analisar.';
      noteInput?.focus();
    }).catch(() => {
      if(status) status.textContent = 'Não consegui ler essa foto. Tenta de novo.';
    });
  }

  async function analyzeQuickPhoto(){
    if(!quickPendingPhoto || quickBusy) return;
    const status = document.getElementById('quick-diet-photo-status');
    const resultEl = document.getElementById('quick-diet-photo-result');
    const noteInput = document.getElementById('quick-diet-photo-note');
    quickBusy = true;
    if(resultEl) resultEl.innerHTML = '';
    if(status) status.textContent = '🔍 Analisando a foto com o Gemini...';
    try{
      const parsed = await analyzeFoodPhoto(quickPendingPhoto.base64, quickPendingPhoto.mimeType, noteInput?.value);
      quickPendingResult = parsed;
      if(status) status.textContent = 'Confira antes de lançar:';
      if(resultEl) resultEl.innerHTML = `
        <div class="calorie-result-card" style="margin:10px 0;"><div class="lbl">Total estimado</div><div class="val">${parsed.kcal} kcal</div></div>
        <div class="goal-grid" style="margin-bottom:10px;">
          <div class="goal-cell"><div class="glbl">Proteína</div><div class="gval">${parsed.protein_g ?? '–'}${parsed.protein_g!=null?'g':''}</div></div>
          <div class="goal-cell"><div class="glbl">Carbo</div><div class="gval">${parsed.carbs_g ?? '–'}${parsed.carbs_g!=null?'g':''}</div></div>
          <div class="goal-cell"><div class="glbl">Gordura</div><div class="gval">${parsed.fat_g ?? '–'}${parsed.fat_g!=null?'g':''}</div></div>
        </div>
        ${itemsListHtml(parsed.items)}
        ${parsed.note ? `<div class="science-tip"><div class="st-body">${escapeHtml(parsed.note)}</div></div>` : ''}
        <button class="primary" onclick="ForjaGeminiVision.confirmQuickPhoto()" style="margin-top:10px;">✓ Lançar no dia de hoje</button>
      `;
    }catch(err){
      if(status) status.textContent = err.message || 'Não consegui analisar essa foto.';
    }finally{
      quickBusy = false;
    }
  }

  // Optional dictation into the note field (Web Speech API — Chrome/Android
  // only; the field works fine by typing everywhere else, so this is a
  // progressive enhancement, not a requirement).
  let quickRecognition = null;
  function quickNoteSpeechSupported(){
    return !!(root.SpeechRecognition || root.webkitSpeechRecognition);
  }
  function toggleQuickNoteDictation(){
    const btn = document.getElementById('quick-diet-note-mic');
    const noteInput = document.getElementById('quick-diet-photo-note');
    const Recognition = root.SpeechRecognition || root.webkitSpeechRecognition;
    if(!Recognition){ if(root.showToast) root.showToast('Ditado por voz não disponível neste navegador — digite normalmente.'); return; }
    if(quickRecognition){ quickRecognition.stop(); return; }
    const rec = new Recognition();
    rec.lang = 'pt-BR';
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.onstart = () => { if(btn){ btn.textContent = '🔴 Ouvindo...'; btn.classList.add('on'); } };
    rec.onresult = (event) => {
      const said = Array.from(event.results).map(r => r[0].transcript).join(' ').trim();
      if(noteInput && said){ noteInput.value = (noteInput.value ? noteInput.value.trim()+' ' : '') + said; }
    };
    rec.onerror = () => { if(root.showToast) root.showToast('Não consegui ouvir. Tenta de novo ou digite.'); };
    rec.onend = () => { if(btn){ btn.textContent = '🎤 Ditar'; btn.classList.remove('on'); } quickRecognition = null; };
    quickRecognition = rec;
    try{ rec.start(); }catch(e){ quickRecognition = null; }
  }

  async function confirmQuickPhoto(){
    if(!quickPendingResult) return;
    const description = (quickPendingResult.items||[]).map(i => i.name).join(', ') || 'Refeição por foto (Gemini)';
    const value = {
      description: description.slice(0,500),
      kcal: quickPendingResult.kcal,
      protein_g: quickPendingResult.protein_g ?? null,
      carbs_g: quickPendingResult.carbs_g ?? null,
      fat_g: quickPendingResult.fat_g ?? null,
    };
    try{
      root.ForjaNutrition.validate(value);
      const photoItems = quickPendingResult.items || [];
      await root.ForjaDietBridge.saveQuick(value);
      if(root.ForjaQuickDiet?.autoSaveShortcuts) await root.ForjaQuickDiet.autoSaveShortcuts(photoItems);
      quickPendingResult = null;
      quickPendingPhoto = null;
      const status = document.getElementById('quick-diet-photo-status');
      const resultEl = document.getElementById('quick-diet-photo-result');
      const preview = document.getElementById('quick-diet-photo-preview');
      const noteWrap = document.getElementById('quick-diet-photo-note-wrap');
      const noteInput = document.getElementById('quick-diet-photo-note');
      if(status) status.textContent = '';
      if(resultEl) resultEl.innerHTML = '';
      if(preview){ preview.hidden = true; preview.removeAttribute('src'); }
      if(noteWrap) noteWrap.hidden = true;
      if(noteInput) noteInput.value = '';
    }catch(err){
      if(root.showToast) root.showToast(err.message);
    }
  }

  root.ForjaGeminiVision = { getApiKey, setApiKey, saveKeyFromUI, renderKeyStatus, handlePhoto, confirmSave, analyzeFoodPhoto, analyzeExercisePhoto, handleExercisePhoto, analyzeDietScreenshot, handleQuickPhotoSelect, analyzeQuickPhoto, confirmQuickPhoto, toggleQuickNoteDictation, quickNoteSpeechSupported };
})(globalThis);
