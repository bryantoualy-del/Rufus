/* RPG Connect multi-target extension.
   Additive by design: legacy single-target behavior remains owned by rpg-connect-client.js. */
(()=>{'use strict';
 const api=window.CompanionAPI,base=window.RPGConnect;if(!api||!base)return;
 const id=api.getCharacter?.().id||'companion',key='rpg-connect:multi:v1:'+id;
 const baseGetStatus=base.getStatus?.bind(base),baseGetTargets=base.getTargets?.bind(base),baseSelectTarget=base.selectTarget?.bind(base),baseRequestSave=base.requestSave?.bind(base);
 let state={mode:'single',maxTargets:1,selectedIds:[]},networkActions=[];
 try{const saved=JSON.parse(localStorage.getItem(key)||'{}');if(saved&&typeof saved==='object'){state.mode=normalizeMode(saved.mode);state.maxTargets=normalizeMax(saved.maxTargets,state.mode);state.selectedIds=Array.isArray(saved.selectedIds)?saved.selectedIds.map(String):[];networkActions=Array.isArray(saved.networkActions)?saved.networkActions.filter(Boolean).map(String).slice(-40):[]}}catch{}
 function normalizeMode(value){const v=String(value||'single').toLowerCase();return['multi','all-selected'].includes(v)?v:'single'}
 function normalizeMax(value,mode){if(mode==='single')return 1;const n=Number(value);return Number.isInteger(n)&&n>0?n:null}
 function available(){try{return (baseGetTargets?.()||[]).filter(t=>t&&t.id)}catch{return[]}}
 function prune(){const ids=new Set(available().map(t=>String(t.id)));state.selectedIds=[...new Set(state.selectedIds.map(String))].filter(x=>ids.has(x));if(state.maxTargets&&state.selectedIds.length>state.maxTargets)state.selectedIds=state.selectedIds.slice(0,state.maxTargets)}
 function selected(){prune();const map=new Map(available().map(t=>[String(t.id),t]));return state.selectedIds.map(x=>map.get(x)).filter(Boolean)}
 function refs(list=selected()){return list.map(t=>({targetId:String(t.id),id:String(t.id),name:String(t.name||'Cible'),creatureType:String(t.creatureType||''),boss:!!t.boss,elite:!!t.elite,ac:t.ac??null}))}
 function save(){try{localStorage.setItem(key,JSON.stringify({...state,networkActions:networkActions.slice(-40)}))}catch{}}
 function say(text){const n=document.querySelector('.rpg-connect-message');if(n){n.textContent=text;n.hidden=!text}}
 function emitSelection(){const list=selected(),primary=list[0]||null;api.emitLocal('target:selected',{targetId:primary?.id||null,target:primary,targets:refs(list),targetMode:state.mode,maxTargets:state.maxTargets})}
 function ensureTools(){
  const dock=document.getElementById('rpg-target-dock');if(!dock)return null;
  let tools=dock.querySelector('[data-rpg-multi-tools]');
  if(!tools){tools=document.createElement('div');tools.dataset.rpgMultiTools='1';tools.className='rpg-multi-tools';tools.innerHTML='<strong data-rpg-multi-count>0 cible</strong><button type="button" data-rpg-multi-clear>Tout désélectionner</button>';const head=dock.querySelector('.rpg-target-dock-head');head?.insertAdjacentElement('afterend',tools);tools.querySelector('[data-rpg-multi-clear]').addEventListener('click',e=>{e.preventDefault();e.stopPropagation();state.selectedIds=[];save();decorate();emitSelection()})}
  return dock
 }
 function decorate(){
  prune();const dock=ensureTools();if(!dock)return;
  const isMulti=state.mode!=='single',list=selected(),set=new Set(list.map(t=>String(t.id)));
  dock.classList.toggle('rpg-multi-mode',isMulti);
  const head=dock.querySelector('.rpg-target-dock-head span');if(head)head.textContent=isMulti?'CIBLES ENCOUNTER':'CIBLE ENCOUNTER';
  const tools=dock.querySelector('[data-rpg-multi-tools]');if(tools){tools.hidden=!isMulti;const count=tools.querySelector('[data-rpg-multi-count]');if(count)count.textContent=list.length+' cible'+(list.length>1?'s':'')+(state.maxTargets?' / '+state.maxTargets:'')}
  if(isMulti){
   for(const card of dock.querySelectorAll('[data-target-id]')){const on=set.has(String(card.dataset.targetId));card.classList.toggle('selected',on);card.classList.toggle('multi-selected',on);card.setAttribute('aria-selected',on?'true':'false')}
   const active=dock.querySelector('.rpg-target-active');if(active){if(list.length){active.hidden=false;active.innerHTML='<span><small>'+list.length+' cible'+(list.length>1?'s':'')+' sélectionnée'+(list.length>1?'s':'')+'</small><strong>'+list.map(t=>escapeHtml(t.name)).join(' · ')+'</strong></span>'}else active.hidden=true}
   const empty=dock.querySelector('[data-rpg-target-empty]');if(empty){empty.hidden=!!list.length;empty.textContent=available().length?'Sélectionne une ou plusieurs cibles':'Aucune cible disponible depuis Encounter'}
   const toggle=dock.querySelector('[data-rpg-target-toggle]');if(toggle)toggle.textContent=list.length?'Modifier · '+list.length:'Choisir'
  }
 }
 function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
 function configure(options={}){
  const mode=normalizeMode(options.targetMode||options.mode||'single'),maxTargets=normalizeMax(options.maxTargets,mode),previousMode=state.mode,changed=mode!==state.mode||maxTargets!==state.maxTargets;
  state.mode=mode;state.maxTargets=maxTargets;
  if(mode!=='single'&&previousMode==='single'&&changed)state.selectedIds=[];
  if(mode==='single'){const current=baseGetStatus?.()?.target;if(current?.id){state.selectedIds=[String(current.id)]}else if(state.selectedIds.length){const keep=state.selectedIds[0];state.selectedIds=[keep];baseSelectTarget?.(keep)}else state.selectedIds=[]}
  else if(changed&&previousMode!=='single'&&!state.selectedIds.length){const current=baseGetStatus?.()?.target;if(current?.id)state.selectedIds=[String(current.id)]}
  prune();save();decorate();if(options.open)openPicker();return status()
 }
 function openPicker(){const dock=ensureTools();if(!dock)return false;dock.removeAttribute('hidden');dock.classList.add('open');decorate();return true}
 function toggle(id){
  id=String(id||'');if(!available().some(t=>String(t.id)===id))return false;
  if(state.mode==='single'){state.selectedIds=[id];save();const ok=baseSelectTarget?.(id)!==false;decorate();return ok}
  const i=state.selectedIds.indexOf(id);
  if(i>=0)state.selectedIds.splice(i,1);
  else{if(state.maxTargets&&state.selectedIds.length>=state.maxTargets){say('Nombre maximum de cibles atteint ('+state.maxTargets+').');return false}state.selectedIds.push(id)}
  save();decorate();emitSelection();return true
 }
 function status(){
  const original=baseGetStatus?.()||{},list=state.mode==='single'?(original.target?[original.target]:[]):selected();
  return{...original,target:list[0]||null,targets:list,targetMode:state.mode,maxTargets:state.maxTargets,targetCount:list.length}
 }
 function pushAction(actionId){actionId=String(actionId||'');if(!actionId)return;if(networkActions.at(-1)!==actionId)networkActions.push(actionId);if(networkActions.length>40)networkActions.shift();save()}
 function requestSave(effect,source){
  if(typeof effect==='string'||!effect||typeof effect!=='object')return baseRequestSave?.(effect,source)??false;
  const mode=normalizeMode(effect.targetMode||'single');
  if(mode==='single'){configure({targetMode:'single',open:false});return baseRequestSave?.(effect,source)??false}
  configure({targetMode:mode,maxTargets:effect.maxTargets,open:false});
  const list=selected();if(!list.length){say('JdS non envoyé · sélectionne au moins une cible Encounter.');openPicker();return false}
  const actionId=String(effect.actionId||window.RPGReactions?.metadata().parentActionId||window.RPGWeaponGate?.metadata().actionId||window.RPGResources?.origin()?.actionId||crypto.randomUUID()),saveId=String(effect.saveId||crypto.randomUUID()),targetRefs=refs(list),primary=targetRefs[0];
  api.emitLocal('save:request',{...effect,saveId,actionId,parentActionId:actionId,targetMode:mode,maxTargets:state.maxTargets,damageRollMode:effect.damageRollMode||'shared',targetId:primary.targetId,target:{id:primary.id,name:primary.name},targets:targetRefs},saveId);
  pushAction(actionId);return true
 }
 function installStyle(){if(document.getElementById('rpg-multi-target-style'))return;const st=document.createElement('style');st.id='rpg-multi-target-style';st.textContent='.rpg-multi-tools{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:5px 0 7px;padding:5px 7px;border:1px solid rgba(105,143,165,.35);border-radius:9px;background:rgba(7,15,22,.52)}.rpg-multi-tools[hidden]{display:none!important}.rpg-multi-tools strong{font-size:10px;letter-spacing:.06em;color:#d8ebf5}.rpg-multi-tools button{min-height:28px;padding:3px 8px;border:1px solid rgba(125,159,181,.55);border-radius:8px;background:rgba(21,42,55,.9);color:#e9f5fb;font-size:10px;font-weight:800}.rpg-target-dock.rpg-multi-mode .rpg-target-card.multi-selected{outline:2px solid currentColor;outline-offset:-2px;box-shadow:0 0 0 1px rgba(255,255,255,.18),0 0 18px rgba(117,180,219,.3)}.rpg-target-dock.rpg-multi-mode .rpg-target-active{grid-template-columns:1fr!important}.rpg-target-dock.rpg-multi-mode .rpg-target-active strong{white-space:normal;line-height:1.25}';document.head.appendChild(st)}
 document.addEventListener('click',e=>{if(state.mode==='single')return;const card=e.target.closest?.('#rpg-target-dock [data-target-id]');if(!card)return;e.preventDefault();e.stopImmediatePropagation();toggle(card.dataset.targetId)},true);
 api.subscribe(event=>{
  if(event.type==='targets:changed'){prune();save();setTimeout(decorate,0)}
  if(event.type==='attack:damage')pushAction(event.payload?.actionId||event.payload?.parentActionId||event.payload?.attackId);
  if(event.type==='save:request')pushAction(event.payload?.actionId||event.payload?.parentActionId||event.payload?.saveId);
  if(event.type==='undo:performed'){const actionId=networkActions.pop();save();if(actionId)queueMicrotask(()=>api.emitLocal('action:undo-request',{actionId,parentActionId:actionId},actionId+':undo'))}
 });
 const originalSetTargets=base.setTargets?.bind(base);if(originalSetTargets)base.setTargets=(list,selectedId)=>{const out=originalSetTargets(list,selectedId);prune();save();setTimeout(decorate,0);return out};
 base.getStatus=status;base.prepareTargets=configure;base.openTargetPicker=openPicker;base.selectTargets=(ids=[])=>{state.mode='multi';state.selectedIds=Array.isArray(ids)?ids.map(String):[];prune();save();decorate();emitSelection();return selected()};base.clearSelectedTargets=()=>{state.selectedIds=[];save();decorate();emitSelection();return true};base.requestSave=requestSave;
 base.getSelectedTargets=()=>selected().map(t=>({...t}));
 installStyle();setTimeout(()=>{configure({targetMode:'single',open:false});decorate()},0);
})();