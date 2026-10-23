/* Segurar o dedo num exercício (nos quadradinhos de "Escolher exercício" durante
   o treino, ou na Biblioteca) abre um popup com foto maior, nome em português,
   nome em inglês (muitos aparelhos de academia só mostram em inglês) e uma
   descrição curta. Um toque rápido continua fazendo a ação normal do cartão
   (adicionar ao treino / abrir detalhe) — isso aqui só intercepta o toque longo. */
(function(root){
  'use strict';
  const HOLD_MS=420;
  const MOVE_TOLERANCE=10;
  let timer=null,startX=0,startY=0,activeChip=null,suppressNextClick=false;

  function T(){return root.ForjaGymTraining;}
  function findPhoto(name,src){
    const t=T();if(!t)return null;
    const mine=t.getPhotoSync(name);
    if(mine)return mine;
    const freeLib=root.ForjaFreeExerciseLibrary||[];
    const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
    const freeRow=freeLib.find(r=>norm(r[1])===norm(name));
    if(freeRow&&freeRow[5])return freeRow[5];
    const lib=root.ForjaExerciseLibrary;
    return (lib&&lib.getWgerImageSync)?lib.getWgerImageSync(name):null;
  }
  function escapeHtml(s){const t=T();return t?t.escapeHtml(s):String(s??'');}

  function openPopup(chip){
    openFor(chip.dataset.exName,chip.dataset.exSrc||'mine',chip.dataset.exMuscle||'');
  }
  function openFor(name,src,muscleHint){
    const t=T();if(!t)return;
    src=src||'mine';muscleHint=muscleHint||'';
    if(!name)return;
    const libTab=root.ForjaExerciseLibraryTab;
    const info=(libTab&&libTab.buildNamesAndDesc)?libTab.buildNamesAndDesc(name,src,muscleHint):{namePt:name,nameEn:'',desc:''};
    const N=root.ForjaExerciseNames;
    if(N&&N.display){const ptShown=N.display(name);if(ptShown&&ptShown!==name){info.namePt=ptShown;if(!info.nameEn)info.nameEn=name;}}
    const isCardio=src==='equipment';
    const equip=isCardio?(t.CARDIO_EQUIPMENT||[]).find(e=>e.name===name):null;
    const photo=isCardio?null:findPhoto(name,src);
    let overlay=root.document.getElementById('ex-longpress-overlay');
    if(!overlay){
      overlay=root.document.createElement('div');
      overlay.id='ex-longpress-overlay';
      overlay.className='ex-longpress-overlay';
      overlay.onclick=(e)=>{if(e.target===overlay)closePopup();};
      root.document.body.appendChild(overlay);
    }
    overlay.innerHTML=`
      <div class="ex-longpress-card">
        <button type="button" class="ex-longpress-close" onclick="ForjaExerciseLongPress.close()">✕</button>
        ${photo?`<img src="${photo}" alt="" draggable="false">`:(equip?`<div class="ex-longpress-icon">${equip.icon}</div>`:'<div class="ex-longpress-icon">🏋️</div>')}
        <h3>${escapeHtml(info.namePt)}</h3>
        ${info.nameEn?`<div class="ex-longpress-en">🇬🇧 ${escapeHtml(info.nameEn)}</div>`:''}
        ${info.desc?`<p>${escapeHtml(info.desc)}</p>`:''}
      </div>`;
    overlay.classList.add('show');
  }
  function closePopup(){
    const overlay=root.document.getElementById('ex-longpress-overlay');
    if(overlay)overlay.classList.remove('show');
  }

  function clearTimer(){if(timer){clearTimeout(timer);timer=null;}activeChip=null;}

  function onPointerDown(e){
    const chip=e.target.closest('.ex-chip[data-ex-name]');
    if(!chip)return;
    activeChip=chip;startX=e.clientX;startY=e.clientY;
    clearTimeout(timer);
    timer=setTimeout(()=>{
      if(activeChip===chip){
        if(root.navigator?.vibrate)root.navigator.vibrate(12);
        suppressNextClick=true;
        openPopup(chip);
      }
      timer=null;
    },HOLD_MS);
  }
  function onPointerMove(e){
    if(!activeChip)return;
    if(Math.abs(e.clientX-startX)>MOVE_TOLERANCE||Math.abs(e.clientY-startY)>MOVE_TOLERANCE)clearTimer();
  }
  function onPointerUp(){clearTimer();}
  function onClickCapture(e){
    if(suppressNextClick){
      suppressNextClick=false;
      e.preventDefault();e.stopPropagation();
    }
  }

  // Segurar o dedo numa foto/cartão no celular abria o menu do navegador ("salvar imagem",
  // "abrir link"...). Aqui esse menu é bloqueado só nos cartões de exercício e nas fotos do app.
  function onContextMenu(e){
    const t=e.target;
    if(t&&t.closest&&t.closest('.ex-chip,.ex-photo-wrap,.ex-card-photo,.ex-longpress-card,.library-media,.ex-card-thumb')){e.preventDefault();}
  }
  function init(){
    if(!root.document)return;
    root.document.addEventListener('contextmenu',onContextMenu);
    root.document.addEventListener('pointerdown',onPointerDown,{passive:true});
    root.document.addEventListener('pointermove',onPointerMove,{passive:true});
    root.document.addEventListener('pointerup',onPointerUp,{passive:true});
    root.document.addEventListener('pointercancel',onPointerUp,{passive:true});
    root.document.addEventListener('click',onClickCapture,true);
  }
  if(root.document){
    if(root.document.readyState==='loading')root.document.addEventListener('DOMContentLoaded',init);
    else init();
  }

  root.ForjaExerciseLongPress={close:closePopup,openFor};
})(typeof globalThis!=='undefined'?globalThis:this);
