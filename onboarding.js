(function(root){
 'use strict';
 const KEY='onboarding-dismissed-v1';
 async function init(){const card=root.document?.getElementById('first-run-guide');if(!card||root.document.body.dataset.forjaVariant!=='shared')return;const storage=root.ForjaStorage||root.storage;let hidden=false;try{hidden=!!(await storage.get(KEY));}catch{}if(hidden)return;card.hidden=false;root.document.getElementById('first-run-open-settings').onclick=()=>root.switchTab?.('mais');root.document.getElementById('first-run-dismiss').onclick=async()=>{card.hidden=true;await storage.set(KEY,'true');};}
 root.ForjaOnboarding={init};
})(globalThis);
