/* The native reaction ledger owns the cost; Encounter owns final damage. */
(()=>{'use strict';const engine=window.RPGReactions;if(!engine)return;
 const result=()=>({success:true,consumed:true,damageMultiplier:.5});
 engine.register({id:'uncanny-dodge',kind:'uncanny-dodge',label:'ACCEPTER · dégâts divisés par deux',matches:q=>q.kind==='uncanny-dodge',available:()=>engine.available(),execute:()=>{engine.setAvailable(false);return result()},recover:()=>result()});
})();
