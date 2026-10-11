/* Reset native turn mechanics once for the canonical participant start revision. */
(()=>{'use strict';const b=window.__CompanionBridge,api=window.CompanionAPI;if(!b||!api)return;
 function apply(q={}){if(q.phase!=='fight'||q.activeCharacterId!==b.id||!q.activeParticipantId||!q.combatId)return false;const s=b.read(),actor=q.summonActor||'owner',key=q.activeParticipantId,stamp=JSON.stringify([q.combatId,q.round,key,q.turnStartRevision||0]);s.rpgTurnStarts??={};if(s.rpgTurnStarts[key]===stamp)return false;const previous=s.rpgTurnStarts[key],sameCombat=previous&&JSON.parse(previous)[0]===q.combatId;s.rpgTurnStarts[key]=stamp;
  if(actor==='dragon'){s.dragonEco={action:false,move:false,rends:0,breath:false};s.dragonDamage=0;b.setSummonPhase?.('dragon')}
  else if(actor==='spectre'){s.spectreActionUsed=false;b.setSummonPhase?.('spectre')}
  else if(actor==='owner'){s.rpgMovementAvailable=true;s.rpgMovementRemaining=b.id==='nans'?12:b.id==='brackmard'?7.5:9;
   if(sameCombat){if(b.id==='samoth'&&s.dragon)s.phase='dragon';if(b.id==='kentaro'&&s.spectreActive)s.turnPhase='spectre';api.nextTurn()}
   const eco=s.economy||s.eco||s.used;if(eco)for(const [name,short]of [['action','a'],['bonus','b'],['reaction','r'],['move','m']]){const k=b.ecoKeys?.[name]||(Object.hasOwn(eco,short)?short:name);if(Object.hasOwn(eco,k))eco[k]=b.used===false}
   else for(const k of ['actionUsed','bonusUsed','reactionUsed','moveUsed'])if(Object.hasOwn(s,k))s[k]=false;
   if(Object.hasOwn(s,'round'))s.round=q.round;b.setSummonPhase?.('owner');
  }b.healthRefresh?.();window.RPGResources?.begin();api.sync();return true;
 }
 window.RPGTurnStart={apply};
})();
