/* Reconcile the Companion's turn total with damage actually applied by Encounter. */
(()=>{'use strict';
 const api=window.CompanionAPI,bridge=window.__CompanionBridge;
 if(!api||typeof bridge?.adjustTurnDamage!=='function')return;
 const key='rpg-connect:effective-damage:v1:'+bridge.id;
 let journal={attacks:{},saves:{},done:{},cancelled:{}};
 try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&typeof saved==='object')journal={...journal,...saved}}catch{}
 const turn=()=>String(api.getState().turn.number);
 const persist=()=>{for(const field of ['attacks','saves','done','cancelled']){
   const entries=Object.entries(journal[field]||{});if(entries.length>300)journal[field]=Object.fromEntries(entries.slice(-300));
  }try{localStorage.setItem(key,JSON.stringify(journal))}catch{}};
 const action=p=>String(p?.actionId||p?.parentActionId||p?.attackId||p?.saveId||'');
 const damage=n=>Number.isFinite(Number(n))?Math.max(0,Math.trunc(Number(n))):0;
 const credit=(id,record,amount)=>{if(!id||journal.done[id]||journal.cancelled[record.actionId])return;
  journal.done[id]=true;
  if(record.turn===turn()&&amount)(window.RPGUndo?.track?RPGUndo.track(record.actionId,()=>bridge.adjustTurnDamage(amount)):bridge.adjustTurnDamage(amount));
  persist();
 };
 api.subscribe(event=>{
  const p=event.payload||{},id=String(p.attackId||'');
  if(event.type==='attack:rolled'&&id){journal.attacks[id]={actionId:action(p)||id,turn:turn(),baseline:damage(api.getState().turn.damage),raw:0};persist()}
  if(event.type==='attack:damage'&&id){const old=journal.attacks[id]||{actionId:action(p)||id,turn:turn(),baseline:null};old.actionId=action(p)||old.actionId;old.raw=damage(p.amount);old.targetId=String(p.targetId||'');journal.attacks[id]=old;persist();
   // Some Companions emit before updating their own counter; observe after the action returns.
   queueMicrotask(()=>{if(journal.attacks[id]!==old)return;old.localRaw=old.baseline===null?old.raw:Math.min(old.raw,Math.max(0,damage(api.getState().turn.damage)-old.baseline));persist()});
  }
  if(event.type==='save:request'){const saveId=String(p.saveId||event.id);journal.saves[saveId]={actionId:action(p)||saveId,turn:turn()};persist()}
  if(event.type==='damage:resolved'&&id){const record=journal.attacks[id];if(!record)return;
   // Native attacks have already added their rolled amount to the local total.
   // The GM result carries the actual HP and temporary HP loss after defenses.
   const raw=damage(p.raw),localRaw=Math.min(raw,record.localRaw??record.raw??0);
   credit('attack:'+id,record,damage(p.effective)-localRaw);
  }
  if(event.type==='save:result'&&!p.cancelled&&!p.error){const saveId=String(p.saveId||''),targetId=String(p.targetId||'');const record=journal.saves[saveId];if(!record||!targetId)return;
   credit('save:'+String(p.resolutionId||saveId+':'+targetId),record,damage(p.effectiveDamage));
  }
  if(event.type==='action:undo-request'){const actionId=action(p);if(actionId){journal.cancelled[actionId]=true;persist()}}
  if(event.type==='state:synced'&&p.machine?.state==='LOBBY'){
   journal.attacks={};journal.saves={};journal.done={};journal.cancelled={};persist();
  }
 });
 window.RPGEffectiveDamage={cancel:actionId=>{journal.cancelled[actionId]=true;persist()},getJournal:()=>JSON.parse(JSON.stringify(journal))};
})();
