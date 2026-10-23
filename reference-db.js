(function(root){
 'use strict';
 let started;
 function init(){
  if(started)return started;
  started=new Promise((resolve,reject)=>{
   const open=indexedDB.open('forja-references',1);
   open.onupgradeneeded=()=>open.result.createObjectStore('catalogs');
   open.onerror=()=>reject(open.error);
   open.onsuccess=()=>{
    const db=open.result;db.onversionchange=()=>db.close();
    const tx=db.transaction('catalogs','readwrite'),store=tx.objectStore('catalogs');
    for(const [key,data]of [['foods',root.ForjaFoodData],['activities',root.ForjaActivityData]]){
     if(!data){tx.abort();return;}
     const request=store.get(key);request.onsuccess=()=>{if(!request.result||request.result.version!==data.version)store.put(data,key);};
    }
    tx.oncomplete=()=>resolve(db);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||Error('Falha ao carregar as tabelas locais.'));
   };
  });return started;
 }
 async function catalog(key){const db=await init();return new Promise((resolve,reject)=>{const request=db.transaction('catalogs').objectStore('catalogs').get(key);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});}
 root.ForjaReferences={init,foods:async()=> (await catalog('foods')).foods,activities:async()=> (await catalog('activities')).activities,catalog};
})(globalThis);
