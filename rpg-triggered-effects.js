/* Durable automatic triggers: rules live in the native character bridge. */
(()=>{const b=window.__CompanionBridge,api=window.CompanionAPI,key='rpg-triggers:v1:'+b.id;let ledger={};try{ledger=JSON.parse(localStorage.getItem(key)||'{}')}catch{}const save=()=>localStorage.setItem(key,JSON.stringify(ledger));
function transmit(x){if(x.result&&!x.acked)api.emitLocal('trigger:result',x.result)}
function receive(type,q){if(type==='trigger:ack'){if(ledger[q.requestId]){ledger[q.requestId].acked=true;save()}return}if(type!=='trigger:request'||!q.requestId)return;let x=ledger[q.requestId];if(!x){const effects=b.triggeredEffects?.(q)||[];x=ledger[q.requestId]={request:q,result:{requestId:q.requestId,combatId:q.combatId,damageEventId:q.damageEventId,effects}};save()}transmit(x)}
window.RPGTriggeredEffects={receive,restore:q=>(q.triggerPending||[]).forEach(x=>receive('trigger:request',x))};setInterval(()=>{if(window.RPGConnect?.getStatus().connected)Object.values(ledger).forEach(transmit)},2500);
})();
