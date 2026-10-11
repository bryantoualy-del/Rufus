/* Mandatory concentration requests. Character rules come exclusively from the native bridge. */
(()=>{'use strict';
 const api=window.CompanionAPI,bridge=window.__CompanionBridge;if(!api||!bridge)return;
 const key='rpg-concentration:v1:'+bridge.id,copy=x=>JSON.parse(JSON.stringify(x));
 let ledger;try{ledger=JSON.parse(localStorage.getItem(key)||'{}')}catch{ledger={}}
 let current=null;const dialog=document.createElement('dialog');dialog.id='rpgConcentrationPopup';dialog.setAttribute('aria-label','Concentration obligatoire');dialog.innerHTML='<section style="padding:20px;max-width:440px"><h2>CONCENTRATION</h2><p data-concentration-detail></p><button data-concentration-roll>LANCER LE D20</button><p data-concentration-result></p></section>';document.body.append(dialog);
 const style=document.createElement('style');style.textContent='#rpgConcentrationPopup{color:#f8eddb;background:#18212b;border:1px solid #d5a95f;border-radius:16px;max-width:calc(100vw - 32px)}#rpgConcentrationPopup::backdrop{background:#0009}#rpgConcentrationPopup button{padding:14px;color:#111;background:#d5a95f;border-radius:9px;font-weight:bold}';document.head.append(style);
 dialog.addEventListener('cancel',e=>e.preventDefault());
 const persist=()=>localStorage.setItem(key,JSON.stringify(ledger));
 const spell=()=>api.getState().concentration;
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 function incapacitated(list){return(list||[]).some(c=>['incapacite','inconscient','paralyse','etourdi','petrifie','mort','dead'].includes(norm(c.name)))}
 function send(item){if(!item.cancelled&&item.result&&Object.hasOwn(item.result,'concentrationAfter')&&!item.ack&&window.RPGConnect?.getStatus().controlled)api.emitLocal('concentration:result',item.result);}
 function clean(item){if(!item.cancelled&&item.result&&!item.result.success&&spell()===item.result.spell&&(!item.request.concentrationInstance||api.getState().concentrationInstance===item.request.concentrationInstance))api.clearConcentration();}
 function next(){if(current)return;const item=Object.values(ledger).find(x=>!x.cancelled&&!x.result);if(!item)return;current=item;
  if(incapacitated(item.request.conditions)||api.getState().hp.current===0)return finish(item,{success:false,automatic:true,reason:'incapacitation'});
  if(!spell()||(spell()!==item.request.concentration||(item.request.concentrationInstance&&api.getState().concentrationInstance!==item.request.concentrationInstance)))return finish(item,{success:false,automatic:true,reason:'concentration remplacée ou terminée'});
  const p=bridge.concentrationProfile?.();if(!p||!Number.isFinite(p.modifier)){current=null;throw Error('Profil CON absent : contrôle conservé en attente')}
  const dc=Math.max(10,Math.floor(item.request.damage/2));dialog.querySelector('[data-concentration-detail]').textContent=bridge.name+' maintient '+spell()+' · '+item.request.damage+' dégâts · DD '+dc+' · CON '+(p.modifier>=0?'+':'')+p.modifier+(p.advantage?' · avantage':'');dialog.querySelector('[data-concentration-result]').textContent='Contrôle obligatoire après cette instance de dégâts.';if(!dialog.open)dialog.showModal();
 }
 function finishNative(item,result){if(item.finalized)return;const q=item.request;item.result={requestId:q.requestId,combatId:q.combatId,damageEventId:q.damageEventId,spell:q.concentration,dc:Math.max(10,Math.floor(q.damage/2)),...result};persist();clean(item);item.result.concentrationAfter=spell();item.finalized=true;persist();api.sync();send(item);current=null;if(dialog.open)dialog.close();queueMicrotask(next)}
 function finish(item,result){return window.RPGUndo?RPGUndo.track(item.request.requestId,()=>finishNative(item,result)):finishNative(item,result)}
 dialog.querySelector('[data-concentration-roll]').onclick=async()=>{const item=current;if(!item||item.rolling)return;item.rolling=true;const q=item.request,p=bridge.concentrationProfile(),dis=!!p.disadvantage,adv=!!p.advantage,mode=adv===dis?'normal':adv?'adv':'dis',rollDie=n=>{const a=new Uint32Array(1),limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(a)}while(a[0]>=limit);return a[0]%n+1},rolls=Array.from({length:mode==='normal'?1:2},()=>rollDie(20)),natural=mode==='adv'?Math.max(...rolls):mode==='dis'?Math.min(...rolls):rolls[0],penalty=(q.conditions||[]).some(c=>norm(c.name)==='perturbationssynaptiques')?rollDie(6):0,effectBonus=(q.conditions||[]).reduce((n,c)=>n+(Number(c.saveBonus)||0),0)+((q.conditions||[]).some(c=>c.effectKind==='bless')?rollDie(4):0),total=natural+p.modifier+effectBonus-penalty,dc=Math.max(10,Math.floor(q.damage/2)),success=total>=dc;
  // Persist before showing the animation, so refresh cannot roll a second result.
  item.result={requestId:q.requestId,combatId:q.combatId,damageEventId:q.damageEventId,spell:q.concentration,dc,rolls,natural,modifier:p.modifier,effectBonus,penalties:penalty?[{source:'Perturbations synaptiques',die:penalty,sides:6}]:[],total,success,mode};persist();if(dialog.open)dialog.close();const detail='d20 '+rolls.join(' / ')+' → '+natural+' + '+p.modifier+(effectBonus?' + '+effectBonus+' effets Encounter':'')+(penalty?' − 1d6 ('+penalty+')':'')+' = '+total+' / DD '+dc+' · '+(success?'MAINTENUE':'PERDUE');
  if(!window.CompanionDiceEngine)await new Promise(resolve=>window.addEventListener('companiondice:ready',resolve,{once:true}));
  await window.CompanionDiceEngine.roll({label:'Concentration · '+q.concentration,verdict:success?'CONCENTRATION MAINTENUE':'CONCENTRATION PERDUE',rolls,chosen:natural,total,detail,mode});finish(item,item.result);
 };
 function receive(type,q){if(type==='concentration:ack'){if(ledger[q.requestId]){ledger[q.requestId].ack=true;persist()}return true}if(type==='concentration:break'){if(spell())api.clearConcentration();for(const item of Object.values(ledger))if(!item.finalized)finish(item,{success:false,automatic:true,reason:q.reason||'incapacitation'});return true}
  if(type!=='concentration:request'||!q.requestId||!q.combatId||!Number.isFinite(q.damage)||q.damage<=0)return false;
  const old=ledger[q.requestId];if(old){if(old.result&&!old.finalized&&current!==old)finish(old,old.result);else{clean(old);send(old);next();}return true}
  ledger[q.requestId]={request:copy(q)};persist();next();return true;
 }
 function conditions(list){if(incapacitated(list)&&spell()){api.clearConcentration();for(const item of Object.values(ledger))if(!item.finalized)finish(item,{success:false,automatic:true,reason:'incapacitation'})}}
 function restore(payload){conditions(payload.conditions);for(const q of payload.concentrationPending||[])receive('concentration:request',q);for(const item of Object.values(ledger))if(item.request.combatId===payload.combatId){if(item.result&&!item.finalized&&current!==item)finish(item,item.result);else{clean(item);send(item)}}next()}
 setInterval(()=>{for(const item of Object.values(ledger))send(item)},3000);
 window.RPGConcentration={cancelRequests:ids=>{for(const item of Object.values(ledger))if(ids.includes(item.request.requestId)){item.cancelled=true;item.ack=true;item.finalized=true;if(current===item){current=null;if(dialog.open)dialog.close()}}persist()},receive,conditions,restore,pending:()=>Object.values(ledger).filter(x=>!x.result).map(x=>copy(x.request))};
window.RPGResolution.register('RPGConcentration',{detach:()=>{const old=JSON.parse(JSON.stringify(Object.values(ledger)));window.RPGConcentration.cancelRequests(Object.values(ledger).map(x=>x.request.requestId));return old;}});
})();
