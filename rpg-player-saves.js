/* Hostile saving throws. Native character profile and existing 3D dice stay authoritative. */
(()=>{'use strict';
 const api=window.CompanionAPI,bridge=window.__CompanionBridge;if(!api||!bridge)return;
 const key='rpg-player-saves:v1:'+bridge.id;
 let ledger;try{ledger=JSON.parse(localStorage.getItem(key)||'{}')}catch{ledger={}}
 let current=null,currentCombatId=null,localItem=null;
 const dialog=document.createElement('dialog');dialog.id='rpgPlayerSavePopup';dialog.innerHTML='<section style="padding:20px;max-width:440px"><h2>JET DE SAUVEGARDE</h2><p data-save-detail></p><label>Mode du jet <select data-save-mode><option value="normal">Normal</option><option value="adv">Avantage</option><option value="dis">Désavantage</option></select></label><label>Bonus circonstanciel confirmé à la table <input data-save-extra type="number" value="0" style="width:72px"></label><label data-save-aura-wrap hidden>Bénéficies-tu de l’Aura de protection de Zéphyr (à 3 m ou moins) ? <select data-save-aura><option value="">À confirmer pour ce jet</option><option value="no">Non</option><option value="yes">Oui · +4</option></select><small data-save-aura-hint></small></label><label>Dé physique (facultatif)<input data-save-manual placeholder="d20 ou deux d20 séparés par /" inputmode="numeric"></label><button type="button" data-local-aura hidden aria-pressed="false">+4 Aura</button><label data-local-bless hidden><span><input type="checkbox" data-save-bless> Bénédiction (+1d4)</span></label><button type="button" data-save-cancel hidden>Annuler</button><button type="button" data-save-roll>LANCER LE D20</button><p data-save-status></p></section>';document.body.append(dialog);
 const style=document.createElement('style');style.textContent='#rpgPlayerSavePopup{color:#f8eddb;background:#18212b;border:1px solid #d5a95f;border-radius:16px;max-width:calc(100vw - 32px)}#rpgPlayerSavePopup [hidden]{display:none!important}#rpgPlayerSavePopup{max-height:calc(100dvh - 32px);overflow:auto}#rpgPlayerSavePopup [data-local-aura]{justify-self:start;background:transparent;color:#d5a95f;border:1px solid #d5a95f}#rpgPlayerSavePopup [data-local-aura][aria-pressed=true]{background:#d5a95f;color:#111}#rpgPlayerSavePopup::backdrop{background:#0009}#rpgPlayerSavePopup section{display:grid;gap:12px}#rpgPlayerSavePopup label{display:grid;gap:5px}#rpgPlayerSavePopup select,#rpgPlayerSavePopup input{color:#f8eddb;background:#101923;border:1px solid #75858f;border-radius:7px;padding:8px}#rpgPlayerSavePopup button{padding:14px;color:#111;background:#d5a95f;border-radius:9px;font-weight:bold}';document.head.append(style);
 dialog.addEventListener('cancel',e=>{if(current?.request.local){current=null;localItem=null;}else e.preventDefault();});dialog.querySelector('[data-local-aura]').onclick=()=>{const button=dialog.querySelector('[data-local-aura]'),active=button.getAttribute('aria-pressed')!=='true';button.setAttribute('aria-pressed',String(active));dialog.querySelector('[data-save-aura]').value=active?'yes':'no';};dialog.querySelector('[data-save-cancel]').onclick=()=>{if(current?.request.local){current=null;localItem=null;dialog.close();}};
 const persist=()=>localStorage.setItem(key,JSON.stringify(ledger));
 const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
 const die=n=>{const x=new Uint32Array(1),limit=Math.floor(4294967296/n)*n;do{crypto.getRandomValues(x)}while(x[0]>=limit);return x[0]%n+1};
 const online=()=>window.RPGConnect?.getStatus().controlled;
 const effectsKey = key + ':manual-effects';
 let manualEffects = {};
 try { manualEffects = JSON.parse(localStorage.getItem(effectsKey) || '{}') || {}; } catch {}
 const combatSaves = document.querySelector('[data-combat-saves]');
 const summary = combatSaves?.querySelector('summary');
 function receivedBlessing() {
  const status = window.RPGConnect?.getStatus();
  if (!status?.connected || status.sessionMode !== 'table-free') return null;
  const context = window.RPGTable?.getContext();
  if (context?.stale) return null;
  const actor = context?.conditionActors?.find(row=>row.companionId===bridge.id);
  return actor?.conditions?.find(effect=>effect.origin==='rpg-table-blessing') || null;
 }
 function blessingActive() {
  const shared = receivedBlessing();
  return manualEffects.bless===true || Boolean(shared && shared.effectId!==manualEffects.disabledBlessing);
 }
 function updateEffectLabel() {
  if (!summary) return;
  const effects = [blessingActive() && 'Bénédiction', manualEffects.aura && 'Aura'].filter(Boolean);
  summary.textContent = ['JDS', ...effects].join(' · ');
 }
 let blessingToggle;
 function updateBlessing() {
  if (blessingToggle) blessingToggle.checked = blessingActive();
  updateEffectLabel();
 }
 window.addEventListener('rpg-table:context', () => queueMicrotask(updateBlessing));
 window.addEventListener('rpg-table:mode', () => queueMicrotask(updateBlessing));
 if (combatSaves) {
  const controls = document.createElement('div');
  for (const [id, label] of [['bless','Bénédiction (+1d4)'], ['aura','Aura de Zéphyr (+4 à 3 m)']]) {
   if (id === 'aura' && bridge.id === 'zephyr') continue;
   const row = document.createElement('label');
   const input = document.createElement('input');
   input.type = 'checkbox';
   if(id==='bless') blessingToggle=input;
   input.checked = id==='bless' ? blessingActive() : manualEffects[id] === true;
   input.addEventListener('change', () => {
    const shared = id==='bless' && receivedBlessing();
    if(shared) {
     manualEffects.bless=false;
     manualEffects.disabledBlessing=input.checked ? null : shared.effectId;
    } else manualEffects[id] = input.checked;
    try { localStorage.setItem(effectsKey, JSON.stringify(manualEffects)); } catch {}
    updateEffectLabel();
   });
   row.append(input, ' ' + label);
   controls.append(row);
  }
  combatSaves.append(controls);
  const inspiration = document.createElement('details');
  const title = document.createElement('summary');
  title.textContent = '♫ Inspiration bardique · d10';
  const form = document.createElement('form');
  form.innerHTML = '<label>Jet déjà lancé <select name="kind"><option>Attaque</option><option>Caractéristique</option><option>Sauvegarde</option></select></label><label>Total avant inspiration <input name="total" type="number" required></label><label>d10 physique (facultatif) <input name="die" type="number" min="1" max="10"></label><button type="submit">Confirmer l’utilisation</button><button type="button" data-restore>Restaurer le d10</button><output aria-live="polite"></output>';
  inspiration.append(title, form);
  combatSaves.after(inspiration);
  function receivedInspiration() {
   const status=window.RPGConnect?.getStatus();
   const context=window.RPGTable?.getContext();
   if(!status?.connected||status.sessionMode!=='table-free'||context?.stale)return;
   return context?.conditionActors?.find(row=>row.companionId===bridge.id)?.conditions?.find(effect=>
    effect.origin==='rpg-table-inspiration'&&effect.expiresAt>Date.now()&&effect.effectId!==bridge.read().rpgUsedInspiration);
  }
  let expiryTimer;
  function showInspiration() {
   clearTimeout(expiryTimer);
   const grant=receivedInspiration();
   inspiration.hidden=!grant&&!bridge.read().rpgUsedInspiration;
   form.querySelector('[type=submit]').disabled=!grant;
   form.querySelector('[data-restore]').hidden=!bridge.read().rpgUsedInspiration;
   title.textContent=grant?'♫ Inspiration bardique · d10':'Inspiration bardique · utilisée';
   if(grant)expiryTimer=setTimeout(showInspiration,Math.max(0,grant.expiresAt-Date.now()));
  }
  function recordUse(id) {
   bridge.read().rpgUsedInspiration=id;
   bridge.healthRefresh?.();
   api.sync();
   showInspiration();
  }
  form.addEventListener('submit', event=>{
   event.preventDefault();
   const grant=receivedInspiration();
   if(!grant||!form.reportValidity())return;
   const total=form.elements.total.valueAsNumber;
   if(!Number.isSafeInteger(total))return;
   const bonus=form.elements.die.value ? form.elements.die.valueAsNumber : die(10);
   recordUse(grant.effectId);
   form.querySelector('output').textContent=form.elements.kind.value+' · '+total+' + '+bonus+' = '+(total+bonus);
  });
  form.querySelector('[data-restore]').onclick=()=>{
   recordUse(null);
   form.querySelector('output').textContent='';
  };
  window.addEventListener('rpg-table:context',()=>queueMicrotask(showInspiration));
  window.addEventListener('rpg-table:mode',()=>queueMicrotask(showInspiration));
  showInspiration();
  updateEffectLabel();
 }

 function send(item){if(!item.request.local&&!item.cancelled&&item.result&&!item.refinementPending&&!item.ack&&online())api.emitLocal('player-save:result',item.result,item.request.requestId+':result')}
 async function refine(item){if(item.refining)return;item.refining=true;try{item.result=await bridge.refineSave(item.result,item.request);item.refinementPending=false;persist();finish(item,item.result);}finally{item.refining=false;}}
 function finish(item,result){if(item.request.local){if(item.finalized)return;item.finalized=true;if(current!==item)return;window.RPGPlayerSaves.lastLocal=result;item.onResult?.(result);localItem=null;current=null;if(dialog.open)dialog.close();queueMicrotask(next);return;}if(item.refinementPending){refine(item);return;}if(item.finalized)return;item.result={requestId:item.request.requestId,combatId:item.request.combatId,targetId:item.request.targetId,ability:item.request.ability,dc:item.request.dc,...result};item.finalized=true;persist();send(item);if(dialog.open)dialog.close();current=null;queueMicrotask(next)}
 function profile(request) {
  const base = bridge.saveProfile?.(request.ability, request);
  return request.local && request.dc && request.ability === 'CON'
    ? {...base, ...bridge.concentrationProfile?.()}
    : base;
 }
 function next(){if(current)return;const item=localItem||Object.values(ledger).find(x=>!x.cancelled&&!x.result&&x.request.combatId===currentCombatId);if(!item)return;current=item;const q=item.request,keys=new Set((q.conditions||[]).map(c=>norm(c.name)));
  if(['FOR','DEX'].includes(q.ability)&&['etourdi','paralyse','inconscient','petrifie'].some(k=>keys.has(k)))return finish(item,{automatic:true,rolls:[],modifier:0,penalties:[],total:0,success:false,mode:'auto-fail'});
  const native=profile(q),p=native&&bridge.id==='zephyr'?{...native,modifier:native.modifier-4}:native;if(!p||!Number.isFinite(p.modifier)){current=null;throw Error('Profil de JdS absent : demande conservée en attente')}
  dialog.querySelector('[data-save-detail]').textContent=bridge.name+' · '+q.source+' · '+q.ability+(q.dc?' DD '+q.dc:'')+' · bonus '+(p.modifier>=0?'+':'')+p.modifier+(p.advantage?' · avantage':'')+(p.disadvantage?' · désavantage':'');
  const restrainedDex=q.ability==='DEX'&&keys.has('entrave'),adv=!!p.advantage,dis=!!p.disadvantage||restrainedDex;
  dialog.querySelector('[data-save-mode]').value=adv===dis?'normal':adv?'adv':'dis';dialog.querySelector('[data-save-extra]').value='0';const auraControl=dialog.querySelector('[data-save-aura-wrap]');auraControl.hidden=!q.local&&bridge.id==='zephyr';dialog.querySelector('[data-save-cancel]').hidden=!q.local;dialog.querySelector('[data-save-manual]').value='';dialog.querySelector('[data-save-aura]').value=q.local?(bridge.id==='zephyr'||manualEffects.aura?'yes':'no'):'';dialog.querySelector('[data-save-aura-hint]').textContent=bridge.id==='zephyr'?'Ton propre +4 est séparé du modificateur de base : il sera appliqué une seule fois si tu confirmes.':(q.conditions||[]).some(c=>c.effectKind==='auraProtection'&&Number(c.saveBonus)===4)?'Couverture indiquée par le MJ : oui, à confirmer pour ce jet.':'Couverture non indiquée par le MJ : confirme ta distance réelle.';
  dialog.querySelector('[data-save-status]').textContent=q.local?'Jet local · aucun effet sur Encounter.':'Jet obligatoire demandé par Encounter.';dialog.querySelector('[data-local-aura]').hidden=!q.local;dialog.querySelector('[data-local-bless]').hidden=!q.local;dialog.querySelector('[data-save-bless]').checked=q.local&&blessingActive();dialog.querySelector('[data-local-aura]').setAttribute('aria-pressed',String(q.local&&(bridge.id==='zephyr'||manualEffects.aura===true)));dialog.querySelector('h2').textContent='JET DE SAUVEGARDE';dialog.querySelector('[data-save-roll]').textContent='LANCER LE D20';dialog.querySelector('[data-save-aura-wrap]').hidden=!!q.local;if(!dialog.open)dialog.showModal();
 }
 dialog.querySelector('[data-save-roll]').onclick=async()=>{const item=current;if(!item||item.rolling)return;const extra=Number(dialog.querySelector('[data-save-extra]').value);if(!Number.isFinite(extra)||Math.abs(extra)>100){dialog.querySelector('[data-save-status]').textContent='Indique un bonus circonstanciel valide.';return}if(!current.request.local&&bridge.id!=='zephyr'&&!dialog.querySelector('[data-save-aura]').value){dialog.querySelector('[data-save-status]').textContent='Confirme Oui ou Non pour l’Aura sur ce jet.';return;}const physical=dialog.querySelector('[data-save-manual]').value.trim();const manual=physical?physical.split(/[/,;\s]+/).map(Number):null;if(manual&&(![1,2].includes(manual.length)||manual.some(n=>!Number.isInteger(n)||n<1||n>20))){dialog.querySelector('[data-save-status]').textContent='Saisis un ou deux d20 de 1 à 20.';return;}item.rolling=true;const q=item.request,native=profile(q),p=bridge.id==='zephyr'?{...native,modifier:native.modifier-4}:native,keys=new Set((q.conditions||[]).map(c=>norm(c.name))),selected=dialog.querySelector('[data-save-mode]').value,adv=selected==='adv'||!!p.advantage,dis=selected==='dis'||!!p.disadvantage||(q.ability==='DEX'&&keys.has('entrave')),mode=adv===dis?'normal':adv?'adv':'dis',rolls=manual||Array.from({length:mode==='normal'?1:2},()=>die(20)),natural=mode==='adv'?Math.max(...rolls):mode==='dis'?Math.min(...rolls):rolls[0],auraConfirmed=(!q.local&&bridge.id==='zephyr')||dialog.querySelector('[data-save-aura]').value==='yes',auraBonus=auraConfirmed?4:0,blessRoll=(q.local?dialog.querySelector('[data-save-bless]').checked:(q.conditions||[]).some(c=>c.effectKind==='bless'))?die(4):0,otherBonuses=(q.conditions||[]).reduce((n,c)=>n+(c.effectKind==='auraProtection'||bridge.id==='zephyr'&&c.origin==='rpg-zephyr-aura'?0:Number(c.saveBonus)||0),0),effectBonus=otherBonuses+auraBonus+blessRoll,modifier=p.modifier+extra+effectBonus,total=natural+modifier,success=total>=q.dc;
  // Store the result before 3D animation: a refresh or lost ACK cannot roll again.
  item.refinementPending=!!bridge.refineSave;item.result={requestId:q.requestId,combatId:q.combatId,targetId:q.targetId,ability:q.ability,dc:q.dc,rolls,natural,modifier,baseModifier:p.modifier,circumstantialModifier:extra,effectBonus,blessRoll,auraBonus,auraConfirmed,penalties:[],total,success,mode};if(!q.local)persist();if(dialog.open)dialog.close();
  if(!window.CompanionDiceEngine)await new Promise(resolve=>window.addEventListener('companiondice:ready',resolve,{once:true}));
  await window.CompanionDiceEngine.roll({label:'JdS '+q.ability+' · '+q.source,verdict:q.local?'JET DE SAUVEGARDE':success?'JET RÉUSSI':'JET RATÉ',rolls,chosen:natural,total,detail:'d20 '+rolls.join(' / ')+' → '+natural+' + '+p.modifier+(extra?' + '+extra+' circonstanciel':'')+(blessRoll?' + Bénédiction (1d4 = '+blessRoll+')':'')+(auraBonus?' + Aura de protection (+4)':'')+(otherBonuses?' + '+otherBonuses+' autres effets':'')+' = '+total+(q.dc?' / DD '+q.dc:''),mode});if(item.refinementPending){await refine(item);return;}finish(item,item.result);
 };
 function receive(type,q){if(type==='player-save:ack'){if(ledger[q.requestId]){ledger[q.requestId].ack=true;persist()}return true}if(type!=='player-save:request'||!q.requestId||!q.combatId||!q.targetId||!['FOR','DEX','CON','INT','SAG','CHA'].includes(q.ability)||!Number.isFinite(q.dc))return false;
  const old=ledger[q.requestId];if(old){if(old.result&&!old.finalized&&current!==old)finish(old,old.result);else{send(old);next()}return true}
  if(current&&!current.request.local&&current.request.combatId!==q.combatId){current=null;if(dialog.open)dialog.close()}currentCombatId=q.combatId;ledger[q.requestId]={request:q};persist();next();return true;
 }
 function restore(payload){if(current&&!current.request.local&&current.request.combatId!==payload.combatId){current=null;if(dialog.open)dialog.close()}currentCombatId=payload.combatId;for(const q of payload.playerSavePending||[])receive('player-save:request',q);for(const item of Object.values(ledger))if(item.request.combatId===payload.combatId){if(item.result&&!item.finalized&&current!==item)finish(item,item.result);else send(item)}next()}
 setInterval(()=>{for(const item of Object.values(ledger))send(item)},3000);
 window.RPGPlayerSaves={prepareLocal,takeAttackBless,cancelRequests:ids=>{for(const item of Object.values(ledger))if(ids.includes(item.request.requestId)){item.cancelled=true;item.ack=true;item.finalized=true;if(current===item){current=null;if(dialog.open)dialog.close()}}persist()},receive,restore,pending:()=>Object.values(ledger).filter(x=>!x.result).map(x=>x.request)};

 function prepareLocal(ability, {dc = 0, onResult} = {}){if(current||!['FOR','DEX','CON','INT','SAG','CHA'].includes(ability))return false;localItem={onResult,request:{local:true,requestId:crypto.randomUUID(),combatId:'local',targetId:bridge.id,source:dc?'Concentration':'Table Libre',ability,dc,conditions:api.getState().statuses.map(name=>({name}))}};next();return true;}
 document.querySelector('[data-combat-saves]')?.addEventListener('click', event => {
  const button = event.target.closest('[data-combat-save]');
  if (button && prepareLocal(button.dataset.combatSave)) button.closest('details').open = false;
 });
 document.addEventListener('click',e=>{if(online())return;const el=e.target.closest?.('[data-v3-roll],[data-roll],[data-save],.save-test');if(!el)return;let label=el.dataset.v3Roll||el.dataset.roll||'',ability=null;if(/^JdS /i.test(label))ability=label.slice(4).toUpperCase();if(el.classList.contains('save-test'))ability=({str:'FOR',dex:'DEX',con:'CON',int:'INT',wis:'SAG',cha:'CHA'})[el.dataset.ability];if(el.hasAttribute('data-save'))ability=['FOR','DEX','CON','INT','SAG','CHA'][Number(el.dataset.save)];ability=({FORCE:'FOR',DEXTERITÉ:'DEX',CONSTITUTION:'CON',INTELLIGENCE:'INT',SAGESSE:'SAG',CHARISME:'CHA'})[ability]||ability;if(ability&&prepareLocal(ability)){e.preventDefault();e.stopImmediatePropagation();}},true);


 // Guided attacks use Encounter's own effects. Other attacks use the player's declaration.
 function takeAttackBless(){return !online()&&blessingActive()?die(4):0;}

window.RPGResolution.register('RPGPlayerSaves',{detach:()=>{const old=JSON.parse(JSON.stringify(Object.values(ledger)));window.RPGPlayerSaves.cancelRequests(Object.values(ledger).map(x=>x.request.requestId));return old;}});
})();

