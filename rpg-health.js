/* A durable health intention uses the existing event outbox and MJ command ACKs. */
(()=>{'use strict';
 const api=window.CompanionAPI,bridge=window.__CompanionBridge,net=window.RPGConnect;if(!api||!bridge||!net)return;
 const key='rpg-connect:health:v1:'+bridge.id;let context={},pending=null,choosing=false,attempt=0;
 try{pending=JSON.parse(localStorage.getItem(key)||'null')}catch{}
 const copy=x=>JSON.parse(JSON.stringify(x));
 const persist=()=>{if(pending)localStorage.setItem(key,JSON.stringify(pending));else localStorage.removeItem(key)};
 const notice=text=>{const el=document.querySelector('.rpg-connect-message');if(el){el.textContent=text;el.hidden=false}document.dispatchEvent(new CustomEvent('rpg-health:notice',{detail:text}))};
 const formatResult=r=>r.armed?r.targetName+' : Ancre préparée, soin à la prochaine attaque':r.maxHpReduction?r.targetName+' : −'+r.maxHpReduction+' PV max (Marque)':r.damageTaken?r.targetName+' : '+r.damageTaken+' dégâts ('+r.tempAbsorbed+' absorbés)':r.kept?r.targetName+' : PV temporaires conservés':r.targetName+' : '+r.appliedAmount+(pending?.family==='tempHp:request'?' PV temporaires':pending?.family==='maxHp:request'?' PV max':' PV rendus');
 const authoritative=()=>!!bridge.read().rpgHealthAuthorityActive||!!context.healthCapabilities?.includes('HEAL');
 const online=()=>net.getStatus().connected&&context.healthCapabilities?.includes('HEAL');
 const room=()=>net.getStatus().room;
 const busy=()=>!!pending||choosing;
 function redraw(){const s=bridge.read();if(bridge.healthRefresh)bridge.healthRefresh();else bridge.commands.setHP(s.hp);api.sync()}
 const get=(s,path)=>path.reduce((v,k)=>v?.[k],s);
 const set=(s,path,value)=>{let v=s;for(const k of path.slice(0,-1))v=v[k];v[path.at(-1)]=copy(value)};
 function changes(before,after,path=[]){let result=[];for(const k of new Set([...Object.keys(before||{}),...Object.keys(after||{})])){if(!path.length&&['hp','maxHp','tempHp','temp','tempSource','tempMetadata','history','log','undo','rpgHealthRevision','rpgHealthEpoch','rpgHealthRetiredEpochs','rpgHealthAuthorityActive'].includes(k))continue;const a=before?.[k],b=after?.[k];if(JSON.stringify(a)===JSON.stringify(b))continue;if(a&&b&&typeof a==='object'&&typeof b==='object'&&!Array.isArray(a)&&!Array.isArray(b))result.push(...changes(a,b,[...path,k]));else if(a!==undefined&&b!==undefined)result.push({path:[...path,k],before:a,after:b})}return result;}
 function transmit(){if(!pending||!online()||pending.room!==room())return;api.emitLocal(pending.family||'heal:request',pending.effect,pending.effect.actionId+':attempt:'+(++attempt)+':'+crypto.randomUUID());notice('Effet transmis · résolution Encounter en attente')}
 function applyHealth(h,force=false){
  if(!h||![h.current,h.max,h.temp,h.revision].every(Number.isFinite))return;
  const s=bridge.read(),epoch=String(h.epoch||'');if(!force&&epoch&&epoch!==s.rpgHealthEpoch){if((s.rpgHealthRetiredEpochs||[]).includes(epoch))return;s.rpgHealthRetiredEpochs=[...(s.rpgHealthRetiredEpochs||[]),...(s.rpgHealthEpoch?[s.rpgHealthEpoch]:[])];s.rpgHealthEpoch=epoch;s.rpgHealthRevision=0}if(!force&&h.revision<(s.rpgHealthRevision||0))return;if(epoch)s.rpgHealthEpoch=epoch;
  window.__RPGHealthApplying=true;s.maxHp=h.max;s.hp=h.current;if('temp'in s)s.temp=h.temp;else s.tempHp=h.temp;s.tempSource=h.tempSource||'';s.tempMetadata=h.tempMetadata||{};if(h.judgmentSpent&&s.linceul&&(s.linceul.judgmentCycle||0)===h.judgmentSpent.cycle)s.linceul.judgment=false;if('agathys'in s){s.agathys=h.temp>0&&s.tempSource==='Armure d’Agathys';if(s.agathys)s.agathysDamage=s.tempMetadata.originalAmount||h.temp}if('barkActive'in s){s.barkActive=h.temp>0&&s.tempSource==='Écorce';document.body.classList.toggle('bark',s.barkActive)}s.rpgHealthRevision=h.revision;
  redraw();queueMicrotask(()=>{window.__RPGHealthApplying=false});
 }
 function applyDamageConsequences(run,before,after){const s=bridge.read(),latest={epoch:s.rpgHealthEpoch||'',current:s.hp,max:s.maxHp,temp:s.temp??s.tempHp??0,tempSource:s.tempSource||'',tempMetadata:copy(s.tempMetadata||{}),revision:s.rpgHealthRevision||0};applyHealth(before,true);try{window.__RPGHealthApplying=true;run()}finally{applyHealth(latest.revision>after.revision?latest:after,true);queueMicrotask(()=>{window.__RPGHealthApplying=false})}}
 function setContext(value){if(value.healthCapabilities?.includes('HEAL'))bridge.read().rpgHealthAuthorityActive=true;context={...context,...value};if(value.health)applyHealth(value.health);}
 async function choose({min=1,max=1,title='Choisir les alliés',self=false,lifeStatus='living',filter=()=>true}={}){
  if(!online()||busy()){notice('Termine le soin en attente avant une autre capacité');return []}
  if(self)return context.healthActorId?[context.healthActorId]:[];
  choosing=true;try{return await window.RPGMultiTargetUI.chooseTargets({list:(context.allyCatalog||[]).filter(t=>(lifeStatus==='dead'?t.lifeStatus==='dead':t.lifeStatus!=='dead')&&filter(t)),min,max,title})}finally{choosing=false}
 }
 function perform({family='heal:request',source,amount,targetIds,...details},consume){
  if(!online()||pending||!['heal:request','tempHp:request','maxHp:request','revive:request'].includes(family)||!Number.isSafeInteger(amount)||(amount<=0&&!(family==='maxHp:request'&&details.operation==='expire'))||!targetIds?.length)return false;
  const s=bridge.read();if(family==='tempHp:request'&&targetIds.length===1&&targetIds[0]===context.healthActorId&&source!=='Cri de ralliement'&&['kentaro','nans'].includes(bridge.id)&&details.replace===undefined){const temp=Number(s.temp??s.tempHp)||0,old=s.tempSource||'';if(temp>0&&old!==source&&(bridge.id==='nans'||old)){if(!confirm('Remplacer '+temp+' PV temporaires ('+(old||'source inconnue')+') par '+amount+' ('+source+') ?'))return false;details.replace=true}}const before=copy(s);consume?.();
  pending={family,room:room(),turnStamp:JSON.stringify([s.turn,s.round,s.phase,s.turnPhase]),effect:{...details,actionId:crypto.randomUUID(),source,amount,targetIds,combatId:context.combatId??null},changes:changes(before,s)};
  try{persist()}catch(error){for(const c of pending.changes)set(s,c.path,c.before);pending=null;notice('Soin annulé · sauvegarde réseau indisponible');return false}
  redraw();transmit();return true;
 }
 function receive(result){
  if(!pending||result.actionId!==pending.effect.actionId)return;
  if(!result.ok){const s=bridge.read();for(const c of pending.changes){const economy=['eco','economy','used','actionUsed','bonusUsed','reactionUsed','bonusSpell','leveledAction','attacksLeft'].includes(c.path[0]);if(economy&&pending.turnStamp!==JSON.stringify([s.turn,s.round,s.phase,s.turnPhase]))continue;if(JSON.stringify(get(s,c.path))===JSON.stringify(c.after))set(s,c.path,c.before);}redraw()}
  notice(result.ok?result.source+' · '+result.results.map(formatResult).join(' · ')+(pending.effect.metadata?.note?' · '+pending.effect.metadata.note:''):'Soin refusé · '+result.error);
  try{bridge.healthFeedback?.(result)}finally{pending=null;persist()}document.dispatchEvent(new CustomEvent('rpg-health:resolved',{detail:result}));
 }
 // A pending reservation is recovered after reload without rolling or spending again.
 if(pending){const s=bridge.read();for(const c of pending.changes||[])if(JSON.stringify(get(s,c.path))===JSON.stringify(c.before))set(s,c.path,c.after);redraw()}
 document.addEventListener('click',e=>{const button=e.target.closest('button');if(button&&authoritative()&&!online()){const rules={brackmard:'#second,[onclick*=dwarvenFortitude]',zephyr:'#healBtn,#arrowStrike,#arrowSacrifice,#anchorBtn,#vitalityHeal,.cast[data-name="Revivifier"],.cast[data-name="Aura de vitalité"],.upcast[data-name="Aide"],.upcast[data-name="Armure d’Agathys"]',kentaro:'#bite,#lazarus,[data-agathys]',nans:'[onclick*=useBark],[onclick*=rally]',samoth:'[data-ability="hitDice"],[data-use="hitDice"]'};const spell=bridge.id==='samoth'&&button.id==='combatCast'&&document.querySelector('#combatSpell')?.value==='cure';if(spell||button.matches(rules[bridge.id]||'[data-never-health]')||/repos|rest/i.test(button.id+' '+button.textContent)){e.preventDefault();e.stopImmediatePropagation();notice('Connexion Encounter requise · aucune ressource dépensée');return}}if(!busy())return;const b=e.target.closest('button');if(b&&/repos|rest|undo|reset|annuler|fin de tour/i.test(b.id+' '+b.textContent+' '+b.getAttribute('onclick'))&&!b.closest('#rpgMultiTargetPicker')){e.preventDefault();e.stopImmediatePropagation();notice('Résolution du soin en attente · ressources réservées')}},true);
 function weaponRollMode(base='normal'){if(!context.mechanics?.nextWeaponAttackAdvantage)return base;return base==='dis'||context.mechanics.attackDisadvantage?'normal':'adv'}
 window.RPGHealth={applyDamageConsequences,authoritative,formatResult,weaponRollMode,online,busy,choose,perform,setContext,receive,getContext:()=>copy(context),getPending:()=>copy(pending)};
 setInterval(transmit,4000);
})();
