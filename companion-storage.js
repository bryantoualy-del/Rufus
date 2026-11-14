/* V2.3: explicit, recoverable storage failures; never replace unreadable saves. */
(()=>{'use strict';
 const blocked=new Set(),pending=new Map();let banner;
 function paint(){
  if(!document.body){document.addEventListener('DOMContentLoaded',paint,{once:true});return;}
  if(!blocked.size&&!pending.size){banner?.remove();banner=null;return;}
  if(!banner){banner=document.createElement('aside');banner.id='companionStorageStatus';banner.setAttribute('role','alert');banner.style.cssText='position:sticky;top:0;z-index:10000;padding:10px;background:#382615;color:#fff1d5;border:2px solid #e5b963;font:14px/1.4 system-ui';document.body.prepend(banner);}
  banner.replaceChildren();const text=document.createElement('span');
  text.textContent=blocked.size?'Sauvegarde illisible : original conservé. Exportez les données de secours avant de restaurer une sauvegarde valide.':'Sauvegarde non effectuée : modifications conservées uniquement dans cette page. Exportez vos données avant de fermer. ';
  banner.append(text);
  const exportButton=document.createElement('button');exportButton.type='button';exportButton.textContent='Exporter les données de secours';
  exportButton.onclick=()=>{const entries={};for(const key of new Set([...blocked,...pending.keys()])){let original=null;try{original=localStorage.getItem(key)}catch{}entries[key]={original,current:pending.get(key)||null};}const url=URL.createObjectURL(new Blob([JSON.stringify({format:'companion-storage-recovery',version:1,entries},null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='companion-donnees-secours.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};banner.append(exportButton);
 }
 window.CompanionStorage={
  get blocked(){return blocked.size>0;},
  block(key){blocked.add(key);paint();},
  write(key,value){if(blocked.has(key)){paint();return false;}try{localStorage.setItem(key,value);pending.delete(key);paint();return true;}catch{pending.set(key,value);paint();return false;}},
  // Used only by an explicit import/reset, after its backup has succeeded.
  recover(key){blocked.delete(key);pending.delete(key);paint();}
 };
 addEventListener('beforeunload',event=>{if(pending.size){event.preventDefault();event.returnValue='';}});
})();
