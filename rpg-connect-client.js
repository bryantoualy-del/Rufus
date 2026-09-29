/* RPG Connect v1. Transport only; the companion remains the rules engine. */
(()=>{'use strict';
 const api=window.CompanionAPI;if(!api)return;
 const identity=api.getCharacter(),storeKey='rpg-connect:v1:'+identity.id;
 const node=document.createElement('div');node.className='rpg-connect';node.innerHTML=`<button type="button" class="rpg-connect-launch" aria-label="RPG Connect">RPG <span class="rpg-connect-dot"></span></button><aside class="rpg-target-active" hidden aria-live="polite"></aside><section class="rpg-connect-panel" hidden aria-label="RPG Connect"><header><strong>RPG Connect · ${identity.name}</strong><button type="button" data-close aria-label="Fermer">×</button></header><p class="rpg-connect-status">Hors ligne · compagnon autonome</p><section class="rpg-targets-block" hidden><div class="rpg-targets-head"><strong>Cibles</strong><button type="button" data-clear-target>Effacer</button></div><div class="rpg-target-list" role="listbox" aria-label="Cibles disponibles"></div></section><label>Adresse du serveur <input name="endpoint" type="url" inputmode="url" placeholder="wss://…"></label><label>Salle <input name="room" autocomplete="off" placeholder="Code transmis par le MJ"></label><label>Invitation personnelle <input name="token" type="password" autocomplete="off" placeholder="Jeton du personnage"></label><div class="rpg-connect-actions"><button type="button" data-connect>Se connecter</button><button type="button" data-disconnect>Déconnecter</button></div><p class="rpg-connect-message" role="status"></p></section>`;
 document.body.append(node);const panel=node.querySelector('.rpg-connect-panel'),status=node.querySelector('.rpg-connect-status'),note=node.querySelector('.rpg-connect-message'),dot=node.querySelector('.rpg-connect-dot'),targetBlock=node.querySelector('.rpg-targets-block'),targetList=node.querySelector('.rpg-target-list'),activeTargetNode=node.querySelector('.rpg-target-active');
 const fields={endpoint:node.querySelector('[name=endpoint]'),room:node.querySelector('[name=room]'),token:node.querySelector('[name=token]')};
 try{const prior=JSON.parse(sessionStorage.getItem(storeKey)||'{}');for(const k of Object.keys(fields))fields[k].value=prior[k]||''}catch{}
 let ws=null,active=false,connected=false,retry=0,timer=null,queue=[];
 let targets=[],selectedTargetId=null;
 try{const t=JSON.parse(localStorage.getItem(storeKey+':targets')||'{}');targets=Array.isArray(t.targets)?t.targets:[];selectedTargetId=t.selectedTargetId||null}catch{}
 const cleanTarget=t=>({id:String(t?.id??''),name:String(t?.name||'Cible'),creatureType:String(t?.creatureType||t?.type||'unknown').toLowerCase(),boss:!!t?.boss,elite:!!t?.elite,hp:t?.hp??null,status:String(t?.status||'')});
 const selectedTarget=()=>targets.find(t=>t.id===selectedTargetId)||null;
 const saveTargets=()=>{try{localStorage.setItem(storeKey+':targets',JSON.stringify({targets,selectedTargetId}))}catch{}};
 const iconFor=t=>window.RPGConnectIcons?.creature(t.creatureType,t.boss)||'';
 function renderTargets(){
   if(!targets.length){targetBlock.hidden=true;activeTargetNode.hidden=true;targetList.innerHTML='';return}
   targetBlock.hidden=false;
   targetList.innerHTML=targets.map(t=>{const sel=t.id===selectedTargetId?' selected':'';const boss=t.boss?' boss':'';const elite=t.elite?' elite':'';const icon=iconFor(t);const meta=[window.RPGConnectIcons?.label(t.creatureType)||t.creatureType,t.boss?'Boss':t.elite?'Élite':''].filter(Boolean).join(' · ');return `<button type="button" class="rpg-target-card${sel}${boss}${elite}" data-target-id="${t.id.replace(/"/g,'&quot;')}" role="option" aria-selected="${t.id===selectedTargetId}"><img src="${icon}" alt=""><span><strong>${t.name.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</strong><small>${meta}</small></span>${t.boss?'<b class="rpg-boss-mark">BOSS</b>':''}</button>`}).join('');
   for(const b of targetList.querySelectorAll('[data-target-id]'))b.onclick=()=>{selectedTargetId=b.dataset.targetId;saveTargets();renderTargets();api.emitLocal('target:selected',{targetId:selectedTargetId,target:selectedTarget()})};
   const t=selectedTarget();
   if(t){activeTargetNode.hidden=false;activeTargetNode.innerHTML=`<img src="${iconFor(t)}" alt=""><span><small>Cible active</small><strong>${t.name.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}</strong></span>${t.boss?'<b>BOSS</b>':''}`;}
   else activeTargetNode.hidden=true;
 }
 function setTargets(list,requestedSelected){
   targets=(Array.isArray(list)?list:[]).map(cleanTarget).filter(t=>t.id);
   selectedTargetId=targets.some(t=>t.id===requestedSelected)?requestedSelected:(targets.some(t=>t.id===selectedTargetId)?selectedTargetId:null);
   if(!selectedTargetId&&targets.length===1)selectedTargetId=targets[0].id;
   saveTargets();renderTargets();
 }
 let seen=new Set();try{seen=new Set(JSON.parse(localStorage.getItem(storeKey+':seen')||'[]'))}catch{}
 const say=(message)=>{note.textContent=message;note.hidden=!message};
 const label=(message,on=false)=>{status.textContent=message;dot.classList.toggle('online',on)};
 const send=m=>{if(ws?.readyState===WebSocket.OPEN){ws.send(JSON.stringify({v:1,...m}));return true}return false};
 const endpoint=()=>{const url=new URL(fields.endpoint.value.trim());if(url.protocol!=='wss:'&&!(url.protocol==='ws:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw Error('Utilisez une adresse wss:// (ws:// seulement en local).');return url.href};
 function connect(){let url;try{url=endpoint();if(!fields.room.value.trim()||!fields.token.value.trim())throw Error('Salle et invitation requises.')}catch(e){say(e.message);return}
  active=true;clearTimeout(timer);if(ws&&ws.readyState<2)ws.close();label('Connexion…');say('');const current=new WebSocket(url);ws=current;
  current.onopen=()=>{if(ws===current)send({type:'hello',role:'player',room:fields.room.value.trim(),characterId:identity.id,token:fields.token.value.trim()})};
  current.onmessage=async e=>{if(ws!==current)return;let m;try{m=JSON.parse(e.data)}catch{return}
   if(m.type==='welcome'){connected=true;retry=0;label('Connecté à '+m.room,true);sessionStorage.setItem(storeKey,JSON.stringify(Object.fromEntries(Object.entries(fields).map(([k,v])=>[k,v.value.trim()]))));send({type:'state',state:api.getState()});for(const event of queue.splice(0))send({type:'event',event});return}
   if(m.type==='ack')return;
   if(m.type==='command'&&m.characterId===identity.id){const event=m.event;if(!event?.id||seen.has(event.id)){send({type:'command-ack',id:event?.id,result:'duplicate'});return}
    try{if(event.type==='targets:set'){setTargets(event.payload?.targets||[],event.payload?.selectedTargetId||null);api.emitLocal('targets:changed',{targets,selectedTargetId});}else if(event.type==='target:clear'){selectedTargetId=null;saveTargets();renderTargets();api.emitLocal('target:selected',{targetId:null,target:null});}else if(event.type==='message:gm'||event.type==='reaction:requested'||event.type==='turn:grant'){say(event.payload?.text||event.payload?.message||'Message du MJ');api.emitLocal(event.type,event.payload||{});}else await api.applyRemoteEvent(event);seen.add(event.id);if(seen.size>250)seen.delete(seen.values().next().value);try{localStorage.setItem(storeKey+':seen',JSON.stringify([...seen]))}catch{}send({type:'command-ack',id:event.id,result:'applied'});}
    catch(error){say('Commande MJ : '+error.message);send({type:'command-ack',id:event.id,result:'error: '+error.message})}return}
   if(m.type==='error'){say(m.message);if(!connected){active=false;ws.close()}}
  };
  current.onerror=()=>{if(ws===current)say('Serveur indisponible ; jeu autonome maintenu.')};
  current.onclose=()=>{if(ws!==current)return;connected=false;label(active?'Connexion interrompue · jeu autonome':'Hors ligne · compagnon autonome');if(active){const delay=Math.min(30000,900*2**Math.min(retry++,5));timer=setTimeout(connect,delay)}};
 }
 api.subscribe(event=>{if(!active||event.type==='companion:ready')return;
   const target=selectedTarget();
   const outbound=(event.type.startsWith('attack:')&&target)?{...event,payload:{...(event.payload||{}),targetId:target.id,target:{id:target.id,name:target.name,creatureType:target.creatureType,boss:target.boss,elite:target.elite}}}:event;
   if(!connected){queue.push(outbound);if(queue.length>100)queue.shift();return}
   if(event.type==='state:changed')send({type:'state',state:{...api.getState(),target:target?{id:target.id,name:target.name,creatureType:target.creatureType,boss:target.boss,elite:target.elite}:null}});
   if(!send({type:'event',event:outbound})){queue.push(outbound);if(queue.length>100)queue.shift()}
 });
 node.querySelector('[data-connect]').onclick=connect;
 node.querySelector('[data-disconnect]').onclick=()=>{active=false;connected=false;clearTimeout(timer);ws?.close();label('Hors ligne · compagnon autonome');say('');};
 node.querySelector('.rpg-connect-launch').onclick=()=>panel.hidden=!panel.hidden;
 node.querySelector('[data-close]').onclick=()=>panel.hidden=true;
 node.querySelector('[data-clear-target]').onclick=()=>{selectedTargetId=null;saveTargets();renderTargets();api.emitLocal('target:selected',{targetId:null,target:null})};
 renderTargets();
 window.RPGConnect={connect,disconnect:()=>node.querySelector('[data-disconnect]').click(),getStatus:()=>({connected,room:fields.room.value.trim(),characterId:identity.id,target:selectedTarget()}),setTargets:(list,selected)=>setTargets(list,selected),getTargets:()=>targets.map(t=>({...t})),selectTarget:id=>{if(!targets.some(t=>t.id===id))return false;selectedTargetId=id;saveTargets();renderTargets();return true}};
})();
