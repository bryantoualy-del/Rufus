/* Hostile saving throws. Native character profile and existing 3D dice stay authoritative. */
(()=>{'use strict';
 const api=window.CompanionAPI,bridge=window.__CompanionBridge;if(!api||!bridge)return;
 const key='rpg-player-saves:v1:'+bridge.id;
 let ledger;try{ledger=JSON.parse(localStorage.getItem(key)||'{}')}catch{ledger={}}
 let current=null,currentCombatId=null;
 const dialog=document.createElement('dialog');dialog.id='rpgPlayerSavePopup';dialog.innerHTML='<section style="padding:20px;max-width:440px"><h2>JET DE SAUVEGARDE</h2><p data-save-detail></p><label>Mode du jet <select data-save-mode><option value="normal">Normal</option><option value="adv">Avantage</option><option value="dis">Désavantage</option></select></label><label>Bonus circonstanciel confirmé à la table <input data-save-extra type="number" value="0" style="width:72px"></label><button type="button" data-save-roll>LANCER LE D20</button><p data-save-status></p></section>';document.body.append(dialog);
 const style=document.createElement('style');style.textContent='#rpgPlayerSavePopup{color:#f8eddb;background:#18212b;border:1px solid #d5a95f;border-radius:16px;max-width:calc(100vw - 32px)}#rpgPlayerSavePopup::backdrop{background:#0009}#rpgPlayerSavePopup section{display:grid;gap:12px}#rpgPlayerSavePopup label{display:grid;gap:5px}#rpgPlayerSavePopup select,#rpgPlayerSavePopup input{color:#f8eddb;background:#101923;border:1px solid #75858f;border-radius:7px;padding:8px}#rpgPlayerSavePopup button{padding:14px;color:#111;background:#d5a95f;border-radius:9px;font-weight:bold}';document.head.append(style);
 dialog.addEventListener('cancel',e=>e.preventDefault());
 const persist=()=>localStorage.setItem(key,JSON.stringify(ledger));
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const die=n=>{const x=new Uint32Array(1),limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(x)}while(x[0]>=limit);return x[0]%n+1};
 const online=()=>window.RPGConnect?.getStatus().connected;
 function send(item){if(!item.cancelled&&item.result&&!item.ack&&online())api.emitLocal('player-save:result',item.result,item.request.requestId+':result')}
 function finish(item,result){if(item.finalized)return;item.result={requestId:item.request.requestId,combatId:item.request.combatId,targetId:item.request.targetId,ability:item.request.ability,dc:item.request.dc,...result};item.finalized=true;persist();send(item);if(dialog.open)dialog.close();current=null;queueMicrotask(next)}
 function next(){if(current)return;const item=Object.values(ledger).find(x=>!x.cancelled&&!x.result&&x.request.combatId===currentCombatId);if(!item)return;current=item;const q=item.request,keys=new Set((q.conditions||[]).map(c=>norm(c.name)));
  if(['FOR','DEX'].includes(q.ability)&&['etourdi','paralyse','inconscient','petrifie'].some(k=>keys.has(k)))return finish(item,{automatic:true,rolls:[],modifier:0,penalties:[],total:0,success:false,mode:'auto-fail'});
  const p=bridge.saveProfile?.(q.ability,q);if(!p||!Number.isFinite(p.modifier)){current=null;throw Error('Profil de JdS absent : demande conservée en attente')}
  dialog.querySelector('[data-save-detail]').textContent=bridge.name+' · '+q.source+' · '+q.ability+' DD '+q.dc+' · bonus '+(p.modifier>=0?'+':'')+p.modifier+(p.advantage?' · avantage':'')+(p.disadvantage?' · désavantage':'');
  const restrainedDex=q.ability==='DEX'&&keys.has('entrave'),adv=!!p.advantage,dis=!!p.disadvantage||restrainedDex;
  dialog.querySelector('[data-save-mode]').value=adv===dis?'normal':adv?'adv':'dis';dialog.querySelector('[data-save-extra]').value='0';
  dialog.querySelector('[data-save-status]').textContent='Jet obligatoire demandé par Encounter.';if(!dialog.open)dialog.showModal();
 }
 dialog.querySelector('[data-save-roll]').onclick=async()=>{const item=current;if(!item||item.rolling)return;const extra=Number(dialog.querySelector('[data-save-extra]').value);if(!Number.isFinite(extra)||Math.abs(extra)>100){dialog.querySelector('[data-save-status]').textContent='Indique un bonus circonstanciel valide.';return}item.rolling=true;const q=item.request,p=bridge.saveProfile(q.ability,q),keys=new Set((q.conditions||[]).map(c=>norm(c.name))),selected=dialog.querySelector('[data-save-mode]').value,adv=selected==='adv',dis=selected==='dis'||(q.ability==='DEX'&&keys.has('entrave')),mode=adv===dis?'normal':adv?'adv':'dis',rolls=Array.from({length:mode==='normal'?1:2},()=>die(20)),natural=mode==='adv'?Math.max(...rolls):mode==='dis'?Math.min(...rolls):rolls[0],modifier=p.modifier+extra,total=natural+modifier,success=total>=q.dc;
  // Store the result before 3D animation: a refresh or lost ACK cannot roll again.
  item.result={requestId:q.requestId,combatId:q.combatId,targetId:q.targetId,ability:q.ability,dc:q.dc,rolls,natural,modifier,baseModifier:p.modifier,circumstantialModifier:extra,penalties:[],total,success,mode};persist();if(dialog.open)dialog.close();
  if(!window.CompanionDiceEngine)await new Promise(resolve=>window.addEventListener('companiondice:ready',resolve,{once:true}));
  await window.CompanionDiceEngine.roll({label:'JdS '+q.ability+' · '+q.source,verdict:success?'JET RÉUSSI':'JET RATÉ',rolls,chosen:natural,total,detail:'d20 '+rolls.join(' / ')+' → '+natural+' + '+p.modifier+(extra?' + '+extra+' circonstanciel':'')+' = '+total+' / DD '+q.dc,mode});finish(item,item.result);
 };
 function receive(type,q){if(type==='player-save:ack'){if(ledger[q.requestId]){ledger[q.requestId].ack=true;persist()}return true}if(type!=='player-save:request'||!q.requestId||!q.combatId||!q.targetId||!['FOR','DEX','CON','INT','SAG','CHA'].includes(q.ability)||!Number.isFinite(q.dc))return false;
  const old=ledger[q.requestId];if(old){if(old.result&&!old.finalized&&current!==old)finish(old,old.result);else{send(old);next()}return true}
  if(current&&current.request.combatId!==q.combatId){current=null;if(dialog.open)dialog.close()}currentCombatId=q.combatId;ledger[q.requestId]={request:q};persist();next();return true;
 }
 function restore(payload){if(current&&current.request.combatId!==payload.combatId){current=null;if(dialog.open)dialog.close()}currentCombatId=payload.combatId;for(const q of payload.playerSavePending||[])receive('player-save:request',q);for(const item of Object.values(ledger))if(item.request.combatId===payload.combatId){if(item.result&&!item.finalized&&current!==item)finish(item,item.result);else send(item)}next()}
 setInterval(()=>{for(const item of Object.values(ledger))send(item)},3000);
 window.RPGPlayerSaves={cancelRequests:ids=>{for(const item of Object.values(ledger))if(ids.includes(item.request.requestId)){item.cancelled=true;item.ack=true;item.finalized=true;if(current===item){current=null;if(dialog.open)dialog.close()}}persist()},receive,restore,pending:()=>Object.values(ledger).filter(x=>!x.result).map(x=>x.request)};
})();
