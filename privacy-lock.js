(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.ForjaPrivacyLock=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
 'use strict';const KEY='privacy-lock-v1',enc=new TextEncoder();
 const hex=bytes=>[...new Uint8Array(bytes)].map(x=>x.toString(16).padStart(2,'0')).join('');const unhex=value=>new Uint8Array((value.match(/../g)||[]).map(x=>parseInt(x,16)));
 async function derive(pin,salt){const key=await crypto.subtle.importKey('raw',enc.encode(pin),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unhex(salt),iterations:120000,hash:'SHA-256'},key,256));}
 async function createPinRecord(pin,salt){if(!/^\d{4,8}$/.test(pin))throw new Error('Use um PIN de 4 a 8 números.');const actual=salt||hex(crypto.getRandomValues(new Uint8Array(16)));return{salt:actual,hash:await derive(pin,actual),failures:0,blockedUntil:0,enabled:true};}
 async function verifyPin(pin,record){return !!record?.hash&&(await derive(pin,record.salt))===record.hash;}
 function registerFailure(state={},now=Date.now()){const failures=(state.failures||0)+1,delay=failures<3?0:Math.min(300000,5000*2**(failures-3));return{...state,failures,blockedUntil:now+delay};}
 async function load(){try{const r=await (root.ForjaStorage||root.storage).get(KEY);return r?.value?JSON.parse(r.value):null;}catch{return null;}}
 async function save(value){await (root.ForjaStorage||root.storage).set(KEY,JSON.stringify(value));}
 async function configure(pin){const record=await createPinRecord(pin);await save(record);return record;}
 async function disable(){await (root.ForjaStorage||root.storage).delete(KEY);root.document?.getElementById('privacy-lock-overlay')?.setAttribute('hidden','');}
 async function unlock(pin){const record=await load();if(!record)return true;if(Date.now()<record.blockedUntil)throw new Error('Aguarde antes de tentar novamente.');if(await verifyPin(pin,record)){await save({...record,failures:0,blockedUntil:0});root.document?.getElementById('privacy-lock-overlay')?.setAttribute('hidden','');return true;}const failed=registerFailure(record);await save(failed);throw new Error('PIN incorreto.');}
 async function lock(){const record=await load();if(!record?.enabled)return false;root.document?.getElementById('privacy-lock-overlay')?.removeAttribute('hidden');return true;}
 async function init(){const record=await load();const status=root.document?.getElementById('privacy-lock-status');if(status)status.textContent=record?.enabled?'PIN ativado neste aparelho.':'Bloqueio ainda não configurado.';if(record?.enabled)await lock();}
 async function configureFromUI(){const input=root.document?.getElementById('privacy-new-pin'),status=root.document?.getElementById('privacy-lock-status');try{await configure(input.value);input.value='';if(status)status.textContent='PIN ativado neste aparelho.';}catch(e){if(status)status.textContent=e.message;}}
 async function disableFromUI(){await disable();const status=root.document?.getElementById('privacy-lock-status');if(status)status.textContent='Bloqueio desativado.';}
 async function unlockFromUI(){const input=root.document?.getElementById('privacy-unlock-pin'),status=root.document?.getElementById('privacy-unlock-status');try{await unlock(input.value);input.value='';if(status)status.textContent='';}catch(e){if(status)status.textContent=e.message;}}
 return{KEY,createPinRecord,verifyPin,registerFailure,configure,disable,unlock,lock,init,configureFromUI,disableFromUI,unlockFromUI};
});
