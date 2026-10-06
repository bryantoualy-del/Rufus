/* A durable health intention uses the existing event outbox and MJ command ACKs. */
(()=>{'use strict';
 const api=window.CompanionAPI,bridge=window.__CompanionBridge,net=window.RPGConnect;if(!api||!bridge||!net)return;
 const key='rpg-connect:health:v1:'+bridge.id;let context={},pending=null,choosing=false,attempt=0;
 try{pending=JSON.parse(localStorage.getItem(key)||'null')}catch{}
 const copy=x=>JSON.parse(JSON.stringify(x));
 const persist=()=>{if(pending)localStorage.setItem(key,JSON.stringify(pending));else localStorage.removeItem(key)};
 const notice=text=>{const el=document.querySelector('.rpg-connect-message');if(el){el.textContent=text;el.hidden=false}document.dispatchEvent(new CustomEvent('rpg-health:notice',{detail:text}))};
 const online=()=>net.getStatus().connected&&context.healthCapabilities?.includes('HEAL');
 const room=()=>net.getStatus().room;
 const busy=()=>!!pending||choosing;
 function redraw(){const s=bridge.read();bridge.commands.setHP(s.hp);api.sync()}
 const get=(s,path)=>path.reduce((v,k)=>v?.[k],s);
 const set=(s,path,value)=>{let v=s;for(const k of path.slice(0,-1))v=v[k];v[path.at(-1)]=copy(value)};
 function changes(before,after,path=[]){let result=[];for(const k of new Set([...Object.keys(before||{}),...Object.keys(after||{})])){if(!path.length&&['hp','maxHp','tempHp','temp','tempSource','history','log','undo','rpgHealthRevision'].includes(k))continue;const a=before?.[k],b=after?.[k];if(JSON.stringify(a)===JSON.stringify(b))continue;if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b))result.push(...changes(a,b,[...path,k]));else if(a!==undefined&&b!==undefined)result.push({path:[...path,k],before:a,after:b})}return result;}
 function transmit(){if(!pending||!online()||pending.room!==room())return;api.emitLocal('heal:request',pending.effect,pending.effect.actionId+':attempt:'+(++attempt)+':'+crypto.randomUUID());notice('Soin transmis · résolution Encounter en attente')}
 function applyHealth(h){
  if(!h||![h.current,h.max,h.temp,h.revision].every(Number.isFinite))return;
  const s=bridge.read();if(h.revision<(s.rpgHealthRevision||0))return;
  window.__RPGHealthApplying=true;s.maxHp=h.max;s.hp=h.current;if('temp'in s)s.temp=h.temp;else s.tempHp=h.temp;s.tempSource=h.tempSource||'';s.rpgHealthRevision=h.revision;
  redraw();queueMicrotask(()=>{window.__RPGHealthApplying=false});
 }
 function setContext(value){context={...context,...value};if(value.health)applyHealth(value.health);}
 async function choose({min=1,max=1,title='Choisir les alliés',self=false}={}){
  if(!online()||busy()){notice('Termine le soin en attente avant une autre capacité');return []}
  if(self)return context.healthActorId?[context.healthActorId]:[];
  choosing=true;try{return await window.RPGMultiTargetUI.chooseTargets({list:(context.allyCatalog||[]).filter(t=>t.lifeStatus!=='dead'),min,max,title})}finally{choosing=false}
 }
 function perform({source,amount,targetIds},consume){
  if(!online()||pending||!Number.isSafeInteger(amount)||amount<=0||!targetIds?.length)return false;
  const s=bridge.read(),before=copy(s);consume?.();
  pending={room:room(),turnStamp:JSON.stringify([s.turn,s.round,s.phase,s.turnPhase]),effect:{actionId:crypto.randomUUID(),source,amount,targetIds,combatId:context.combatId??null},changes:changes(before,s)};
  try{persist()}catch(error){for(const c of pending.changes)set(s,c.path,c.before);pending=null;notice('Soin annulé · sauvegarde réseau indisponible');return false}
  redraw();transmit();return true;
 }
 function receive(result){
  if(!pending||result.actionId!==pending.effect.actionId)return;
  if(!result.ok){const s=bridge.read();for(const c of pending.changes){const economy=['eco','economy','used','actionUsed','bonusUsed','reactionUsed','bonusSpell','leveledAction','attacksLeft'].includes(c.path[0]);if(economy&&pending.turnStamp!==JSON.stringify([s.turn,s.round,s.phase,s.turnPhase]))continue;if(JSON.stringify(get(s,c.path))===JSON.stringify(c.after))set(s,c.path,c.before);}redraw()}
  notice(result.ok?result.source+' · '+result.results.map(r=>r.targetName+' : '+r.appliedAmount+' PV rendus').join(' · '):'Soin refusé · '+result.error);
  bridge.healthFeedback?.(result);pending=null;persist();document.dispatchEvent(new CustomEvent('rpg-health:resolved',{detail:result}));
 }
 // A pending reservation is recovered after reload without rolling or spending again.
 if(pending){const s=bridge.read();for(const c of pending.changes||[])if(JSON.stringify(get(s,c.path))===JSON.stringify(c.before))set(s,c.path,c.after);redraw()}
 document.addEventListener('click',e=>{if(!busy())return;const b=e.target.closest('button');if(b&&/repos|rest|undo|reset|annuler|fin de tour/i.test(b.id+' '+b.textContent+' '+b.getAttribute('onclick'))&&!b.closest('#rpgMultiTargetPicker')){e.preventDefault();e.stopImmediatePropagation();notice('Résolution du soin en attente · ressources réservées')}},true);
 window.RPGHealth={online,busy,choose,perform,setContext,receive,getContext:()=>copy(context),getPending:()=>copy(pending)};
 setInterval(transmit,4000);
})();
