/* Table Libre adapts the existing character, never resolves another actor's action. */
(()=>{'use strict';const api=window.CompanionAPI,b=window.__CompanionBridge;if(!api||!b)return;
 const key='rpg-table:v5:'+b.id,logKey=key+':journal',copy=x=>JSON.parse(JSON.stringify(x));let saved={mode:'guided',room:'',context:null};let entries=[];
 try{saved={...saved,...JSON.parse(localStorage.getItem(key)||'{}')};entries=JSON.parse(localStorage.getItem(logKey)||'[]')}catch{}
 let starting=false,last=api.getState();const active=()=>saved.mode==='table-free';
 const persist=()=>localStorage.setItem(key,JSON.stringify(saved));
 function accept(mode,room){if(!['guided','table-free'].includes(mode))return false;const changed=saved.mode!==mode||saved.room!==room;saved.mode=mode;saved.room=room;if(changed)saved.context=null;persist();if(active()){b.read().rpgHealthAuthorityActive=false;b.healthRefresh?.();}document.body.classList.toggle('rpg-table-free',active());window.dispatchEvent(new CustomEvent('rpg-table:mode',{detail:{mode,room}}));return true;}
 function context(q={}){if(!active())return false;const session=q.session||{};const previous=saved.context;
  if(previous?.syncEpoch===q.syncEpoch&&q.groupRevision&&previous.groupRevision>q.groupRevision)return false;
  const before=previous?.session;
  if(q.session&&session.syncEpoch===before?.syncEpoch&&session.sessionRevision<before?.sessionRevision)return false;
  saved.context={...previous,...q,session:q.session?session:before,stale:q.session?false:previous?.stale??true};persist();
  window.RPGResolution?.shadow(q);window.RPGGroup?.update(q);
  const groupWasVisible=document.body.classList.contains('rpg-group-visible');const canonical=saved.context.session;if(q.session&&canonical?.phase==='fight'&&canonical.activeParticipantId&&canonical.combatId){starting=true;try{window.RPGTurnStart?.apply(canonical);if(!canonical.markerOnly)b.combatTurn?.({...canonical,session:canonical})}finally{starting=false;}if(groupWasVisible)window.RPGGroupView?.open();}
  window.dispatchEvent(new CustomEvent('rpg-table:context'));return true;
 }
 function disconnected(){if(saved.context){saved.context.stale=true;persist();}window.dispatchEvent(new CustomEvent('rpg-table:context'));}
 function append(id,action,text,kind='turn',extra={}){if(entries.some(x=>x.id===id))return;const c=saved.context,s=c?.session||{};entries.push({id,actor:b.name,action,text,kind,local:true,combatId:s.combatId||'local',round:s.round||api.getState().turn.round,turn:c?.stale?null:s.turnIndex||null,turnName:c?.stale?null:s.activeName||null,stage:extra.manual?'Correction manuelle':'Calcul local',...extra});entries=entries.slice(-1000);localStorage.setItem(logKey,JSON.stringify(entries));}
 api.subscribe(e=>{const state=api.getState();if(!active()){last=state;return;}const p=e.payload||{};
  if(e.type==='attack:rolled')append(e.id,p.name||'Attaque','Jet calculé : '+(p.total??p.roll??'—')+(p.detail?' · '+p.detail:''),'attack',{roll:p.total??p.roll});
  else if(e.type==='attack:damage')append(e.id,'Dégâts calculés',(p.amount??p.damage??0)+' dégâts calculés · application à confirmer à la table','damage',{damage:p.amount??p.damage});
  else if(e.type==='attack:miss')append(e.id,'Attaque','Raté annoncé localement','miss');
  else if(e.type==='hp:changed')append(e.id,p.after<p.before?'Dégâts reçus':'Soins','PV '+p.before+' → '+p.after,p.after<p.before?'damage':'heal');
  else if(e.type==='tempHp:changed')append(e.id,'PV temporaires','PV temporaires '+p.before+' → '+p.after,'temp');
  else if(e.type==='resource:changed')append(e.id,'Ressource personnelle',({slots:'Emplacements de sorts',sorceryPoints:'Points de sorcellerie',wings:'Ailes protectrices',staffCharges:'Charges du bâton',hitDice:'Dés de vie'}[p.key]||'Ressource')+' : '+JSON.stringify(p.before)+' → '+JSON.stringify(p.after),'turn');
  else if(e.type==='correction:local')append(e.id,'Correction manuelle',(window.RPGCorrectionSchema?.descriptors(b.id).find(d=>d.key===p.key)?.label||'Valeur personnelle')+' : '+String(p.before)+' → '+String(p.after),'turn',{manual:true});
  else if(e.type==='state:changed'){
   if(last.turn.reaction!==state.turn.reaction)append(e.id+':reaction','Réaction',state.turn.reaction?'Réaction restaurée':'Réaction consommée','reaction');
   if(last.concentration!==state.concentration)append(e.id+':concentration','Concentration',state.concentration?'Concentration : '+state.concentration:'Fin de concentration','effect');
   if(JSON.stringify(last.statuses)!==JSON.stringify(state.statuses))append(e.id+':conditions','États personnels',(state.statuses||[]).join(', ')||'États personnels retirés','effect');last=state;
  }
 });
 function toggleReaction(){const value=api.getState().turn.reaction!==true;window.RPGReactions?.setAvailable(value);return value;}
 document.body.classList.toggle('rpg-table-free',active());
 window.RPGTable={active,accept,context,disconnected,toggleReaction,localEnded:()=>!!b.read().rpgLocalTurnEnded,starting:()=>starting,getContext:()=>active()?copy(saved.context):null,entries:()=>copy(entries),append};
 // Manual control remains available even for an exceptional reaction authorised orally.
 window.addEventListener('click',e=>{
  if(!active())return;
  const local=e.target.closest('#cc-turnbar-standard .cc-turn-local');
  const end=e.target.closest('#cc-turnbar-standard .cc-turn-next');
  const reaction=e.target.closest('#cc-turnbar-standard .cc-turn-reaction');
  if(!local&&!end&&!reaction)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(reaction){toggleReaction();return;}
  const state=b.read();
  if(local){
   state.rpgLocalTurnEnded=false;
   starting=true;try{api.nextTurn()}finally{starting=false;}
  }else if(!state.rpgLocalTurnEnded){
   state.rpgLocalTurnEnded=true;b.healthRefresh?.();
   const session=saved.context?.session;
   if(!saved.context?.stale&&!session?.markerOnly&&session?.activeCharacterId===b.id&&
      (session.summonActor||'owner')==='owner'&&window.RPGConnect?.getStatus().connected){
    const stamp=JSON.stringify([session.combatId,session.activeParticipantId,session.turnStartRevision]);
    if(state.rpgLastTurnEnd!==stamp){
     state.rpgLastTurnEnd=stamp;b.healthRefresh?.();
     api.emitLocal('turn:end-request',{round:session.round,participantId:session.activeParticipantId,turnStartRevision:session.turnStartRevision});
    }
   }
  }
  window.dispatchEvent(new CustomEvent('rpg-table:context'));
 },true);
})();
