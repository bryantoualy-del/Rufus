/* Companion API v1 — local boundary for a future RPG Connect client. No transport. */
(()=>{'use strict';
  const bridge=window.__CompanionBridge;
  if(!bridge)throw Error('Companion bridge missing');
  const listeners=new Set(), seen=new Set();
  let serial=0, previous=null, pendingId=null, pendingKey=null, queued=false,lastUpdated=new Date().toISOString();const apiUndo=[];
  const copy=x=>JSON.parse(JSON.stringify(x));
  const id=()=>`${bridge.id}-${Date.now().toString(36)}-${(++serial).toString(36)}`;
  const number=x=>Number.isFinite(Number(x))?Number(x):null;
  const initiativeProfile=()=>{const raw=typeof bridge.initiative==='function'?bridge.initiative(bridge.read()):(bridge.initiative||{}),bonus=number(raw.bonus)??0,mode=['normal','adv','dis'].includes(raw.mode)?raw.mode:'normal';return{bonus,mode}};
  const rollD20=()=>Math.floor(Math.random()*20)+1;
  const emit=(type,payload={},eventId)=>{
    const event={id:eventId||id(),type,characterId:bridge.id,timestamp:new Date().toISOString(),payload:copy(payload)};
    if(seen.has(event.id))return event;
    seen.add(event.id);if(seen.size>500)seen.delete(seen.values().next().value);
    for(const fn of [...listeners])try{fn(copy(event))}catch(error){console.error('Companion event listener',error)}
    window.dispatchEvent(new CustomEvent('companion:event',{detail:copy(event)}));
    return event;
  };
  function state(){
    const s=bridge.read(),eco=s.economy||s.eco||s.used||{},used=bridge.used!==false;
    const available=k=>eco[k]===undefined?null:used?!eco[k]:!!eco[k];
    const hp=number(s.hp)??0,max=number(s.maxHp)??bridge.maxHp,temp=number(s.tempHp??s.temp)??0;
    const inventory=bridge.inventory?.()||s.inventory||s.items||[];
    const resources=bridge.resources?.(s)||{};
    return copy({characterId:bridge.id,characterName:bridge.name,hp:{current:hp,max,temp},ac:bridge.ac?.(s)??null,
      turn:{number:s.turn??s.round??1,round:s.round??s.turn??1,active:s.phase||s.turnPhase||true,
        action:available(bridge.ecoKeys?.action||'action'),bonus:available(bridge.ecoKeys?.bonus||'bonus'),
        reaction:available(bridge.ecoKeys?.reaction||'reaction'),movement:available(bridge.ecoKeys?.movement||'move'),damage:s.turnDamage??s.dmg??0},
      concentration:s.concentration??s.concSpell??s.conc??null,resources,
      inventorySummary:inventory.map(i=>({id:i.id??i.name,name:i.name,quantity:i.qty??i.quantity??1})),
      statuses:bridge.statuses?.(s)||[],custom:bridge.custom?.(s)||{},updatedAt:lastUpdated});
  }
  function sync(){
    if(queued)return;queued=true;
    queueMicrotask(()=>{
      queued=false;const current=state(),pending=bridge.pending?.()||null;
      if(previous){
        if(JSON.stringify(previous.hp)!==JSON.stringify(current.hp)){
          if(previous.hp.current!==current.hp.current)emit('hp:changed',{before:previous.hp.current,after:current.hp.current});
          if(previous.hp.temp!==current.hp.temp)emit('tempHp:changed',{before:previous.hp.temp,after:current.hp.temp});
        }
        for(const key of new Set([...Object.keys(previous.resources),...Object.keys(current.resources)]))
          if(JSON.stringify(previous.resources[key])!==JSON.stringify(current.resources[key]))emit('resource:changed',{key,before:previous.resources[key]??null,after:current.resources[key]??null});
        if(JSON.stringify(previous.inventorySummary)!==JSON.stringify(current.inventorySummary))emit('inventory:changed',{inventorySummary:current.inventorySummary});
        if(previous.turn.number!==current.turn.number||previous.turn.active!==current.turn.active)emit('turn:started',{turn:current.turn});
        if(JSON.stringify({...previous,updatedAt:''})!==JSON.stringify({...current,updatedAt:''})){lastUpdated=new Date().toISOString();current.updatedAt=lastUpdated;emit('state:changed',{state:current})}
      }
      const key=pending?JSON.stringify(pending):null;
      if(key&&!pendingKey){pendingId=pending.attackId||id();emit('attack:rolled',{attackId:pendingId,actor:pending.actor||bridge.id,roll:pending.roll??null},pendingId);emit('attack:pending-hit',{attackId:pendingId,actor:pending.actor||bridge.id});}
      else if(!key&&pendingKey&&pendingId){const result=bridge.lastHit?.();if(result!==null&&result!==undefined)emit(result?'attack:hit':'attack:miss',{attackId:pendingId,actor:bridge.id});pendingId=null;}
      pendingKey=key;previous=current;
    });
  }
  const commands=bridge.commands||{};
  function call(name,...args){if(typeof commands[name]!=='function')throw Error(`${name} indisponible pour ${bridge.name}`);const before=name!=='undo'&&bridge.snapshot?.();const result=commands[name](...args);if(before!==undefined&&name!=='undo'){apiUndo.push(before);if(apiUndo.length>30)apiUndo.shift()}sync();return result;}
  function positive(value){const n=number(value);if(n===null||n<0||!Number.isFinite(n))throw RangeError('Montant positif requis');return Math.floor(n)}
  function rollInitiative(options={}){const profile=initiativeProfile(),hasManual=options.manual!==undefined&&options.manual!==null&&options.manual!=='',manual=number(options.manual);let dice,mode=profile.mode;if(hasManual){if(manual===null||!Number.isInteger(manual)||manual<1||manual>20)throw RangeError('Jet manuel compris entre 1 et 20 requis');dice=[manual];mode='manual'}else dice=profile.mode==='normal'?[rollD20()]:[rollD20(),rollD20()];const chosen=mode==='adv'?Math.max(...dice):mode==='dis'?Math.min(...dice):dice[0],result={requestId:String(options.requestId||''),dice,chosen,bonus:profile.bonus,total:chosen+profile.bonus,mode};emit('initiative:rolled',result);return copy(result)}
  const api=Object.freeze({version:1,getCharacter:()=>({id:bridge.id,name:bridge.name,actors:bridge.actors?.()||[{id:bridge.id,name:bridge.name}]}),getState:state,getInitiativeProfile:()=>copy(initiativeProfile()),rollInitiative,
    damage:(amount,options={})=>call('damage',positive(amount),options),heal:(amount,options={})=>call('heal',positive(amount),options),
    setHP:value=>call('setHP',positive(value)),setTemporaryHP:value=>call('setTemporaryHP',positive(value)),
    setResource:(key,value)=>call('setResource',String(key),positive(value)),changeResource:(key,delta)=>{const n=number(delta);if(n===null)throw RangeError('Variation invalide');return call('changeResource',String(key),n)},
    setRollMode:mode=>{if(!['normal','adv','dis','manual'].includes(mode))throw RangeError('Mode de jet invalide');return call('setRollMode',mode)},
    nextTurn:()=>call('nextTurn'),resetCombat:()=>call('resetCombat'),startTurn:actor=>call('startTurn',actor),endTurn:actor=>call('endTurn',actor),
    setConcentration:value=>call('setConcentration',value),clearConcentration:()=>call('clearConcentration'),
    updateInventory:item=>call('updateInventory',item),addInventoryItem:item=>call('addInventoryItem',item),removeInventoryItem:id=>call('removeInventoryItem',id),
    applyHitDecision:(hit,attackId)=>{if(!pendingId||attackId&&attackId!==pendingId)throw Error('Aucune attaque correspondante en attente');return call('applyHitDecision',!!hit)},
    applyRemoteEvent:event=>{if(!event||typeof event!=='object'||!event.id||!event.type)throw TypeError('Événement invalide');if(seen.has(event.id))return false;
      const actions={'hp:damage':()=>api.damage(event.payload?.amount,event.payload?.options),'hp:heal':()=>api.heal(event.payload?.amount,event.payload?.options),
        'hp:set':()=>api.setHP(event.payload?.value),'tempHp:set':()=>api.setTemporaryHP(event.payload?.value),
        'resource:set':()=>api.setResource(event.payload?.key,event.payload?.value),'turn:next':()=>api.nextTurn(),
        'inventory:add':()=>api.addInventoryItem(event.payload?.item),'inventory:update':()=>api.updateInventory(event.payload?.item),'inventory:remove':()=>api.removeInventoryItem(event.payload?.id),
        'attack:decision':()=>api.applyHitDecision(event.payload?.hit,event.payload?.attackId)};
      if(!actions[event.type])throw Error('Commande non prise en charge');actions[event.type]();seen.add(event.id);return true;},
    undo:()=>{if(apiUndo.length&&bridge.restore){bridge.restore(apiUndo.pop());sync();emit('undo:performed',{});return true}const result=call('undo');emit('undo:performed',{});return result},subscribe:fn=>{if(typeof fn!=='function')throw TypeError('Fonction attendue');listeners.add(fn);return()=>listeners.delete(fn)},
    unsubscribe:fn=>listeners.delete(fn),sync,emitLocal:emit});
  window.CompanionAPI=api;previous=state();emit('companion:ready',{version:1});
  // Existing character interfaces own their rules and rendering. Observe their
  // completed UI changes so local actions also enter the same event stream.
  const observer=new MutationObserver(sync);
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','value']});
  for(const type of ['click','change','input'])document.addEventListener(type,()=>setTimeout(sync,0));
})();
