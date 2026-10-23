/* Prescrição do WOD: nunca preenche duração realizada ou calorias do atleta. */
(function(root){
 const fold=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
 const groups=[['Air Bike','assault bike','airbike','echo bike'],['BikeErg','bike erg'],['Bike'],['Row','remo','row erg','rowerg','rowing'],['SkiErg','ski','ski erg'],['Double KB Farmer Carry','double kb farmer carry','double kettlebell farmer carry'],['Farmer Carry','farmers carry','farmer walk'],['Burpee Broad Jump','burpee broad jumps'],['Burpee Bar Muscle Up / Pull Up','burpee bar muscle ups pull ups','burpee bar muscle up pull up'],['Burpee Bar Muscle Up','burpee bar muscle ups'],['Burpee','burpees'],['Deadlift','levantamento terra'],['Thruster','thrusters'],['Wall Ball','wall balls'],['Box Jump','box jumps'],['Box Jump Over'],['Box Step Over'],['Double Under','double unders','du'],['Single Under','single unders'],['Pull Up','pull ups','pullup'],['Chest to Bar','c2b'],['Toes to Bar','t2b'],['Muscle Up','muscle ups'],['Ring Muscle Up'],['Bar Muscle Up'],['Handstand Push Up','hspu'],['Handstand Walk','hsw'],['Push Up','push ups','flexao'],['Sit Up','sit ups'],['Air Squat'],['Back Squat'],['Front Squat'],['Overhead Squat','ohs'],['Snatch'],['Power Snatch'],['Dumbbell Hang Snatch','db hang snatch','db hang snatches','dumbbell hang snatches'],['Clean'],['Power Clean'],['Squat Clean','squat cleans'],['Clean and Jerk'],['Push Press'],['Push Jerk'],['Split Jerk'],['Shoulder Press','strict press'],['Kettlebell Swing','kb swing','kbs'],['Russian Swing'],['American Swing'],['Run','corrida'],['Shuttle Run'],['Lunge','lunges','walking lunge'],['Rope Climb'],['GHD Sit Up'],['Devil Press'],['Dumbbell Snatch','db snatch'],['Dumbbell Clean','db clean']];
 const aliases=new Map();groups.forEach(g=>g.forEach(n=>aliases.set(fold(n),g[0])));
 const formatLine=/^(?:HEAVY\s*DAY|AMRAP|EMOM|E\d+MOM|EVERY\b|FOR\s*TIME|TABATA|CHIPPER|RFT|STRENGTH|TIME\s*CAP|BUY[- ]?IN|CASH[- ]?OUT|THEN\b|REST\b|\d+\s+Rounds?\b|\d+(?:\s*-\s*\d+){1,8}\b)/i;
 root.parseCrossfitWod=function(raw){
  raw=String(raw||'');const lines=raw.replace(/[’′]/g,"'").replace(/[“”″]/g,'"').replace(/([0-9])\s*['"]{2,}/g,'$1"').split(/\r?\n/).map(s=>s.trim());
  const result={data:null,wod_formato:null,exercicios:[],observacoes:'',texto_original:raw};
  const date=raw.match(/(?:WOD\s*[-–]?\s*)?(\d{1,2})\/(\d{1,2})\/(\d{4})/i);if(date)result.data=`${date[3]}-${date[2].padStart(2,'0')}-${date[1].padStart(2,'0')}`;
  let start=lines.findIndex(s=>/^WOD\s*:?$/i.test(s));if(start<0){const format=lines.findIndex(s=>formatLine.test(s));if(format<0){result.observacoes=raw;return result;}start=format-1;}
  if(start< -1||!lines.slice(start+1).some(s=>formatLine.test(s)||/^\d+[\s'"m]/i.test(s))){result.observacoes=raw;return result;}
  const notes=lines.slice(0,start).filter(s=>!/^WOD\s*[-–]?\s*\d/i.test(s));if(!result.data)notes.push('Revisar a data: não foi reconhecida na imagem.');const formats=[];let currentRounds=null;
  for(const line of lines.slice(start+1)){
   if(/^(COOL\s*DOWN|Fazer\s*check|Ações|TECNOFIT)/i.test(line))break;if(!line)continue;
   const scheme=line.match(/^(\d+(?:\s*-\s*\d+){1,8})\.\s+([A-Za-z].+)$/);
   if(scheme){const name=scheme[2].trim(),canonical=aliases.get(fold(name));formats.push(scheme[1]);result.exercicios.push({nome:canonical||name,reps_esquema:scheme[1].replace(/\s/g,''),texto_original:line,revisar:!canonical});continue;}
   if(formatLine.test(line)){formats.push(line);const block=line.match(/^(\d+)\s+Rounds?\b/i)||line.match(/\bFOR\s+(?:TIME\s+)?(\d+)\s+Rounds?\b/i);if(block)currentRounds=Number(block[1]);else if(/^(?:BUY[- ]?IN|CASH[- ]?OUT|THEN\b|REST\b)/i.test(line))currentRounds=null;continue;}
   const match=line.match(/^(\d+(?:[.,]\d+)?)\s*(km|m|minutes?|min|seconds?|seg|sec|s|cal(?:ories|orias)?|''|"|')?\s+(.+)$/i);
   if(!match){let name=line,load=name.match(/\(([\d.,]+)\s*\/\s*([\d.,]+)\s*(kg|lb)\)/i);if(load)name=name.replace(load[0],'').trim();const canonical=aliases.get(fold(name));if(canonical){const ex={nome:canonical,texto_original:line};if(currentRounds!=null)ex.series_ou_rounds=currentRounds;if(canonical.includes(' / '))ex.revisar=true;if(load){ex.carga_prescrita=Number(load[1].replace(',','.'));ex.carga_scaled=Number(load[2].replace(',','.'));ex.unidade=load[3].toLowerCase();}result.exercicios.push(ex);continue;}notes.push('Revisar: '+line);continue;}
   const n=Number(match[1].replace(',','.')),unit=(match[2]||'reps').toLowerCase();let name=match[3],load=name.match(/\(([\d.,]+)\s*\/\s*([\d.,]+)\s*(kg|lb)\)/i);if(load)name=name.replace(load[0],'').trim();
   const canonical=aliases.get(fold(name)),ex={nome:canonical||name,texto_original:line};
   if(currentRounds!=null)ex.series_ou_rounds=currentRounds;
   if(!canonical||canonical==='Bike'||canonical.includes(' / '))ex.revisar=true;
   if(unit==='m'||unit==='km')ex.distancia_m=n*(unit==='km'?1000:1);else if(["'",'min','minute','minutes'].includes(unit))ex.tempo_s=n*60;else if(["''",'"','s','sec','seg','second','seconds'].includes(unit))ex.tempo_s=n;else if(unit.startsWith('cal'))ex.calorias_maquina=n;else ex.reps=n;
   if(load){ex.carga_prescrita=Number(load[1].replace(',','.'));ex.carga_scaled=Number(load[2].replace(',','.'));ex.unidade=load[3].toLowerCase();}
   result.exercicios.push(ex);
  }
  result.wod_formato=formats.join(' · ')||null;result.observacoes=notes.join('\n');return result;
 };
 if(typeof root.crossfitExercicioRowHtml==='function'){
  const original=root.crossfitExercicioRowHtml;
  root.crossfitExercicioRowHtml=function(ex={}){
   const copy={...ex,nome:root.escapeHtml(ex.nome||'')};let html=original(copy);
   const kind=ex.tempo_s!=null?'tempo_s':ex.distancia_m!=null?'distancia_m':ex.calorias_maquina!=null?'calorias_maquina':'reps';
   html=html.replace(/<label>Reps<\/label>/,'<label>Quantidade</label>').replace(/class="cf-ex-reps" value="[^"]*"/,`class="cf-ex-reps" value="${ex[kind]??''}"`);
   html=html.replace('data-ex-row ',`data-ex-row data-unidade-prescrita="${ex.unidade === 'lb' ? 'lb' : ex.unidade === 'kg' ? 'kg' : ''}" data-texto-original="${root.escapeHtml(ex.texto_original||'')}" data-carga-scaled="${ex.carga_scaled??''}" `);
   const select=`<div><label>Medida prescrita</label><select class="cf-ex-medida">${[['reps','Reps'],['distancia_m','Metros'],['tempo_s','Segundos'],['calorias_maquina','Cal da máquina']].map(([v,t])=>`<option value="${v}" ${v===kind?'selected':''}>${t}</option>`).join('')}</select></div>`;
   html=html.replace(/class="cf-ex-carga" value="[^"]*"/,`class="cf-ex-carga" value="${ex.carga_usada??''}"`);
   html=html.replace(/<div[^>]*><label>Séries<\/label><input[^>]*class="cf-ex-series"[^>]*><\/div>/,`<input type="hidden" class="cf-ex-series" value="${ex.series_ou_rounds??''}">`);
   html=html.replace(/<div[^>]*><label>Carga/,select+'<div style="width:76px;flex:none;"><label>Carga');
   const loadUnit=ex.carga_usada!=null?ex.unidade||'':'';
   html=html.replace(/<label>Unidade<\/label><select class="cf-ex-unidade">[\s\S]*?<\/select>/,`<label>Unidade da carga</label><select class="cf-ex-unidade"><option value="" ${!loadUnit?'selected':''}>Sem carga</option><option value="kg" ${loadUnit==='kg'?'selected':''}>kg</option><option value="lb" ${loadUnit==='lb'?'selected':''}>lb</option></select>`);
   html=html.replace('align-items:flex-end;gap:6px;','align-items:flex-end;gap:6px;flex-wrap:wrap;');
   return html+(ex.revisar?'<div class="muted">Confira o nome do exercício. Para Bike, confirme se foi Air Bike ou BikeErg.</div>':'');
  };
  const review=root.renderCrossfitPrintReview;
  root.renderCrossfitPrintReview=function(data,opts){
   review(data,opts);
   const panel=root.document.getElementById('crossfit-print-review');panel.dataset.textoOriginal=data.texto_original||'';
   const uncertain=(data.exercicios||[]).map((ex,index)=>({ex,index})).filter(({ex})=>ex.revisar);
   for(const {index} of uncertain){const row=panel.querySelectorAll('[data-ex-row]')[index];if(row){row.classList.add('cf-needs-review');row.insertAdjacentHTML('afterbegin','<strong class="cf-review-label">Confira este movimento</strong>');}}
   const unread=String(data.observacoes||'').split('\n').filter(line=>/^Revisar:\s*/i.test(line));
   if(!uncertain.length&&!unread.length)return;
   const box=root.document.createElement('div');box.id='crossfit-reading-review';box.className='cf-reading-review';
   const title=root.document.createElement('strong');title.textContent=`Confira ${uncertain.length+unread.length} item(ns) da leitura`;box.append(title);
   const intro=root.document.createElement('p');intro.textContent='O restante do WOD foi mantido. Corrija só os itens destacados antes de salvar.';box.append(intro);
   for(const line of unread){const row=root.document.createElement('div');row.className='cf-unread-line';const label=root.document.createElement('span');label.textContent=line.replace(/^Revisar:\s*/i,'');row.append(label);const button=root.document.createElement('button');button.type='button';button.textContent='Adicionar como exercício';button.addEventListener('click',()=>{root.addCrossfitExercicioRow();const last=panel.querySelector('[data-ex-row]:last-child .cf-ex-nome');if(last)last.value=label.textContent;row.remove();});row.append(button);box.append(row);}
   panel.querySelector('#crossfit-print-exercicios')?.before(box);
  };
 }
})(globalThis);
