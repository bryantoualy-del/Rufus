/* V4: network presence and local resolution are independent. */
(()=>{'use strict';
 const b=window.__CompanionBridge,api=window.CompanionAPI;if(!b||!api)return;
 const copy=v=>v===undefined?null:JSON.parse(JSON.stringify(v)),key='rpg-resolution:v4:'+b.id;
 let saved={mode:'encounter',generation:0,detached:{},sessions:[],shadow:null,proposal:null};
 try{saved={...saved,...JSON.parse(localStorage.getItem(key)||'{}')}}catch{}
 const adapters=new Map();let committing=false,transport=null;
 const free=()=>saved.mode==='free',controlled=()=>!free()||committing;
 const persist=()=>localStorage.setItem(key,JSON.stringify(saved));
 function identifiers(value){const ids=new Set();function visit(v){if(!v||typeof v!=='object')return;for(const [k,x]of Object.entries(v)){if(/^(attackId|actionId|parentActionId|requestId|reactionId|saveId|damageEventId)$/.test(k)&&typeof x==='string')ids.add(x);if(x&&typeof x==='object')visit(x)}}visit(value);return [...ids]}
 function archive(name,value){if(!value)return;const ids=identifiers(value);for(const id of ids)saved.detached[id]={name,status:'detached',generation:saved.generation};const session=saved.sessions.at(-1);if(session)session.operations.push({name,ids,value:copy(value),status:'detached',at:Date.now()});persist();}
 function isDetached(value){return identifiers(value).some(id=>saved.detached[id]);}
 function rememberResult(event){const session=saved.sessions.at(-1);if(session&&!session.results.some(x=>x.id===event.id))session.results.push(copy(event));persist();}
 function shadow(value){saved.shadow={...(saved.shadow||{}),...copy(value)};persist();}
 function notify(){transport?.notify({mode:saved.mode,generation:saved.generation,detachedIds:Object.keys(saved.detached)});render();}
 function enterFree(){if(free())return;saved.generation++;saved.mode='free';saved.proposal=null;saved.sessions.push({id:crypto.randomUUID(),generation:saved.generation,baseline:copy(b.read()),publicBaseline:api.getState(),operations:[],results:[],startedAt:Date.now()});persist();
  archive('native-attack',b.pending?.());for(const [name,a]of adapters)archive(name,a.detach?.());
  b.cancelPending?.();b.healthRefresh?.();api.sync();notify();window.dispatchEvent(new CustomEvent('rpg-resolution:change',{detail:{mode:'free',generation:saved.generation}}));
 }
 function register(name,adapter){adapters.set(name,adapter);if(free())archive(name,adapter.detach?.());}
 const root=document.createElement('div');root.className='rpg-resolution-controls';root.dataset.resolutionControls='';
 const style=document.createElement('style');style.textContent='#rpgResolutionReview{background:var(--panel,#181b24);color:var(--text,#f0e5d4);border:1px solid var(--accent,var(--gold,#ad9168));border-radius:14px;padding:20px;width:min(520px,calc(100vw - 28px));box-sizing:border-box;overflow:auto}#rpgResolutionReview button{min-height:42px;margin:5px;padding:8px}.rpg-resolution-controls button{min-height:36px;padding:5px 8px;font:700 10px system-ui;border:1px solid transparent;border-radius:6px;background:transparent;color:inherit;white-space:nowrap;pointer-events:auto!important}.rpg-resolution-controls button[aria-pressed=true]{border-color:var(--accent,var(--gold,#ad9168));background:#92734444}.rpg-resolution-controls small{font-size:10px}';document.head.append(style);
 const review=document.createElement('dialog');review.id='rpgResolutionReview';document.body.append(review);
 function controls(node){node.innerHTML='<h2>Mode de jeu</h2><p>Reste dans la partie tout en choisissant comment résoudre tes actions.</p><button type="button" data-resolution="encounter">Piloté par Encounter</button><button type="button" data-resolution="free">Mode Libre</button><p data-resolution-status role="status"></p><p>Pour restaurer une action, une action bonus, une réaction ou le mouvement, clique directement sur la case dépensée dans le compagnon. Le tour reste inchangé.</p>';for(const button of node.querySelectorAll('[data-resolution]'))button.addEventListener('click',e=>{e.stopPropagation();button.dataset.resolution==='free'?enterFree():returnEncounter()});}
 controls(root);
 const ribbonStyle=document.createElement('style');ribbonStyle.textContent=`
 body{padding-top:calc(var(--rpg-ribbon-space,8px) + env(safe-area-inset-top))!important}
 .rpg-connect{z-index:2147483647!important}
 .rpg-native-dialog{top:0;margin-top:calc(var(--rpg-ribbon-space,110px) + 14px);max-height:calc(100dvh - var(--rpg-ribbon-space,110px) - 28px)}
 .rpg-session-banner[data-resolution-ribbon]{top:calc(8px + env(safe-area-inset-top));width:min(430px,calc(100vw - 112px));max-width:none;z-index:2147483647;pointer-events:auto;opacity:1;padding:7px 10px}
 .rpg-connect-panel .rpg-resolution-controls{position:static!important;transform:none;display:block;width:100%;max-width:none;height:auto;padding:0;border:0;border-radius:0;background:none;box-shadow:none;font:14px system-ui;line-height:1.45}
 .rpg-connect-panel .rpg-resolution-controls button{font-size:13px;min-height:44px;border:1px solid #6687a1;background:#244b61;color:#fff;margin:4px 4px 4px 0;padding:8px}
 .rpg-resolution-controls [hidden]{display:none!important}
 dialog .rpg-session-banner[data-resolution-ribbon]{position:fixed;left:50%;transform:translateX(-50%)}
 #rpgResolutionReview{max-height:calc(100dvh - var(--rpg-ribbon-space,110px) - 28px);margin-top:calc(var(--rpg-ribbon-space,110px) + 14px);line-height:1.45}
 body.rpg-free-local #newTurn,body.rpg-free-local #nextTurn,body.rpg-free-local #mobileNextTurn,body.rpg-free-local .turnbar .next,body.rpg-free-local .cc-turn-next{display:none!important}
 @media(max-width:767px){.rpg-session-banner[data-resolution-ribbon]{top:calc(50px + env(safe-area-inset-top));width:calc(100vw - 16px);padding:6px 8px}.rpg-session-banner [data-session-detail]{max-height:2.5em;overflow:hidden}}
 `;document.head.append(ribbonStyle);
 function mountRibbon(banner){banner.dataset.resolutionRibbon='';const pane=document.querySelector('[data-rpg-pane="mode"]');if(pane)pane.append(root);banner.hidden=false;render();reserveStickySpace();}
 function prepareEconomyRestore(resource){if(!free())return;saved.generation++;archive('return-proposal',saved.proposal);saved.proposal=null;const session=saved.sessions.at(-1);if(session)session.operations.push({name:'restore-economy',resource,status:'local-only',at:Date.now()});persist();notify();}
 function resetActions(){if(!free())return false;
  saved.generation++;archive('return-proposal',saved.proposal);saved.proposal=null;archive('local-reset',b.pending?.());for(const [name,a]of adapters)archive(name,a.detach?.());b.cancelPending?.();window.RPGDialogs?.cancelAll?.();
  const s=b.read();s.rpgMovementAvailable=true;s.rpgMovementRemaining=b.id==='nans'?12:b.id==='brackmard'?7.5:9;const eco=s.economy||s.eco||s.used;if(eco)for(const k of Object.keys(eco))if(typeof eco[k]==='boolean')eco[k]=b.used===false;
  if(b.id==='kentaro')Object.assign(s,{actionUsed:false,actionKind:'',actionLabel:'',attackCount:0,bonusUsed:false,bonusLabel:'',bonusSpell:false,reactionUsed:false,reactionLabel:'',spectreActionUsed:false,spectreMoveUsed:false,eldritchCount:0,eldritchRun:null});
  if(b.id==='brackmard')Object.assign(s,{actionUsed:'',bonusUsed:'',reactionUsed:'',attacksMax:2,attacksLeft:2,gwmBonus:false,extraAction:false,auraUsed:false});
  if(b.id==='nans')Object.assign(s,{attacksLeft:2,gwmBonus:false,energyUsedTurn:false});
  if(b.id==='rufus')Object.assign(s,{sneakOwn:false,sneakReaction:false,psychicFollowup:false});
  if(b.id==='samoth'){s.dragonEco={action:false,move:false,rends:0,breath:false};s.bonusSpell=false;s.leveledAction=false;}
  if(b.id==='zephyr')Object.assign(s,{attackCount:0,bonusSpell:false,leveledAction:false});
  if(!window.RPGCorrections)document.querySelector('#v3-movement.used')?.click();window.CompanionV3?.syncEconomy?.();
  const session=saved.sessions.at(-1);if(session){session.localState=copy(s);session.operations.push({name:'reset-actions',status:'local-only',at:Date.now()});}persist();b.healthRefresh?.();api.sync();notify();window.dispatchEvent(new CustomEvent('rpg-resolution:change',{detail:{mode:'free',generation:saved.generation}}));return true;
 }
 for(const name of ['nextTurn','resetCombat','startTurn','endTurn']){const native=b.commands?.[name];if(native)b.commands[name]=(...args)=>free()?false:native(...args);}
 document.addEventListener('click',e=>{if(free()&&e.target.closest('#newTurn,#nextTurn,#mobileNextTurn,.turnbar .next,.cc-turn-next,.turnbar button[onclick="nextTurn()"]')){e.preventDefault();e.stopImmediatePropagation();}},true);
 function restoreConnectedEconomy(remote){const session=saved.sessions.at(-1);if(!session?.operations.some(x=>['reset-actions','restore-economy'].includes(x.name)))return;
  const s=b.read(),base=session.baseline||{},turn=remote?.turn||saved.shadow?.turn||session.publicBaseline?.turn;
  for(const key of ['actionKind','actionLabel','attackCount','bonusLabel','bonusSpell','leveledAction','reactionLabel','attacksMax','attacksLeft','gwmBonus','extraAction','auraUsed','energyUsedTurn','sneakOwn','sneakReaction','psychicFollowup','eldritchCount','eldritchRun','spectreActionUsed','spectreMoveUsed','dragonEco'])if(Object.hasOwn(base,key))s[key]=copy(base[key]);
  const eco=s.economy||s.eco||s.used;if(eco&&turn)for(const [name,native]of [['action','action'],['bonus','bonus'],['reaction','reaction'],['movement','move']]){const key=b.ecoKeys?.[name]||native;if(typeof turn[name]==='boolean'&&Object.hasOwn(eco,key))eco[key]=b.used===false?turn[name]:!turn[name];}
  if(b.id==='kentaro'&&turn)for(const name of ['action','bonus','reaction'])if(typeof turn[name]==='boolean')s[name+'Used']=!turn[name];
 }
 function render(){document.body.classList.toggle('rpg-free-local',free());for(const node of document.querySelectorAll('[data-resolution-controls]')){for(const button of node.querySelectorAll('[data-resolution]'))button.setAttribute('aria-pressed',String(button.dataset.resolution===saved.mode));const small=node.querySelector('[data-resolution-status]');const label=saved.proposal?'Accord MJ attendu':(free()?'Mode Libre · ':'Piloté par Encounter · ')+(window.RPGConnect?.getStatus?.().connected?'connexion maintenue':'sans serveur');if(small&&small.textContent!==label)small.textContent=label;}}
 const stickyTops=new WeakMap();
 function reserveStickySpace(){const banner=document.querySelector('.rpg-connect [data-resolution-ribbon]');const space=banner?Math.ceil(banner.getBoundingClientRect().bottom)+8:8;if(document.body.style.getPropertyValue('--rpg-ribbon-space')!==space+'px')document.body.style.setProperty('--rpg-ribbon-space',space+'px');for(const node of document.querySelectorAll('header,nav,.turnbar,.tabs,.nav,#cc-turnbar-standard')){if(node.closest('dialog,[data-resolution-controls],.rpg-connect'))continue;if(!stickyTops.has(node))stickyTops.set(node,node.style.top);node.style.top=stickyTops.get(node);const css=getComputedStyle(node),top=parseFloat(css.top);if(['sticky','fixed'].includes(css.position)&&Number.isFinite(top)&&top>=0)node.style.top='calc('+top+'px + '+space+'px + env(safe-area-inset-top))';}}
 window.addEventListener('resize',()=>requestAnimationFrame(reserveStickySpace));
 new MutationObserver(()=>{render();reserveStickySpace();}).observe(document.body,{attributes:true,attributeFilter:['open','data-tone'],childList:true,subtree:true});
 function returnEncounter(){if(!free())return;if(!window.RPGConnect?.getStatus?.().connected){review.innerHTML='<h2>Retour connecté</h2><p>Le mode Libre reste actif. Reconnecte le serveur pour comparer les états.</p><button data-cancel>Continuer en Libre</button>';review.querySelector('[data-cancel]').onclick=()=>review.close();if(!review.open)review.showModal();return;}
  const current=api.getState(),base=saved.sessions.at(-1)?.publicBaseline,remote=saved.shadow?.health;
  review.replaceChildren();const title=document.createElement('h2');title.textContent='Réconcilier avant le retour';review.append(title);const desc=document.createElement('p');desc.textContent='Choisis les PV à reprendre. Les ressources dépensées restent dépensées. Une ressource corrigée manuellement en Libre reprendra sa valeur Encounter. Les états, la concentration, les effets et les invocations reprendront ceux d’Encounter. Les dégâts libres restent à résoudre à la table.';review.append(desc);
  const health=h=>h?`${h.current} / ${h.max} PV${h.temp?' · '+h.temp+' PV temporaires':''}`:'En attente de réception';
  const name=v=>typeof v==='string'?v:v?.name||v?.label||'';
  const labels={slots:'Emplacements de sorts',curseReady:'Malédiction',biteReady:'Morsure',stoneReady:'Pierre',rayStepReady:'Pas de rayon',superiorityDice:'Dés de supériorité',fougue:'Fougue',secondWind:'Second souffle',indomitable:'Indomptable',breath:'Souffle',hitDice:'Dés de vie',sorceryPoints:'Points de sorcellerie',featPoints:'Points de métamagie',wings:'Ailes',staffCharges:'Charges du bâton',cureFree:'Soins gratuits',flame:'Flamme',vial:'Fiole',rages:'Rages',horn:'Corne',voltoEnergy:'Énergie Volto',voltoStored:'Charges Volto stockées',barkReady:'Peau d’écorce',capeReady:'Cape',ancReady:'Pouvoir ancestral',psiDie:'Dé psionique',lucky:'Chance',hexCharges:'Charges Hexen',psiReconstitutionReady:'Reconstitution psionique',ravenShadow:'Ombre du corbeau',pilgrim:'Pèlerin',judgment:'Jugement différé',fireBladeReady:'Lame de feu',visionUses:'Visions',layOnHands:'Réserve de soins',channel:'Conduit divin',arrows:'Flèches',binahChromatic:'Charges chromatiques',binahWall:'Mur prismatique',sense:'Sens divin',decree:'Décrets',anchor:'Ancre sacrée',binahMue:'Mue prismatique'};
  const list=document.createElement('ul');function item(label,text){const li=document.createElement('li');li.textContent=label+' : '+text;list.append(li);}
  item('Vos PV',health(current.hp));item('PV dans Encounter',health(remote));item('Actions au retour','L’économie du tour Encounter sera reprise ; les remises à zéro d’essai restent locales');
  item('États locaux',(current.statuses||[]).map(name).filter(Boolean).join(', ')||'Aucun');
  item('Concentration locale',name(current.concentration)||'Aucune');
  item('États Encounter',(saved.shadow?.conditions||[]).map(name).filter(Boolean).join(', ')||'Aucun');
  item('Concentration Encounter',name(saved.shadow?.concentration)||(saved.shadow?.concentration===undefined?'Voir la fiche Encounter':'Aucune'));
  item('Invocations locales',current.custom?.dragon?'Dragon invoqué':current.custom?.spectre?.active?'Spectre actif':(current.custom?.summons||[]).map(name).filter(Boolean).join(', ')||'Aucune');
  item('Invocations Encounter',(saved.shadow?.summons||[]).map(v=>name(v)||(v.kind==='dragon'?'Dragon':v.kind==='spectre'?'Spectre':'Invocation')).join(', ')||'Aucune');
  const changes=[];for(const [key,label]of Object.entries(labels)){const before=base?.resources?.[key],after=current.resources?.[key];if(after===undefined||JSON.stringify(before)===JSON.stringify(after))continue;const value=v=>typeof v==='boolean'?(v?'Disponible':'Dépensé'):v&&typeof v==='object'?Object.entries(v).filter(([,n])=>typeof n==='number').map(([level,n])=>'Niveau '+level+' : '+n).join(', '):String(v??'—');changes.push(label+' : '+value(before)+' → '+value(after));}
  if(JSON.stringify(base?.resources?.ring)!==JSON.stringify(current.resources?.ring))changes.push('Anneau : usages locaux modifiés, conservés au retour');
  item('Ressources locales',changes.length?changes.join(' ; '):'Aucune dépense depuis le passage en Libre');review.append(list);
  for(const [choice,label]of [['encounter','Reprendre les PV Encounter'],['local','Proposer mes PV au MJ']]){const button=document.createElement('button');button.textContent=label;button.dataset.reconcileChoice=choice;button.onclick=()=>{if(saved.proposal)return;saved.proposal={id:crypto.randomUUID(),generation:saved.generation,choice,health:current.hp,resources:current.resources,concentration:current.concentration,summons:current.custom?.summons||[],expectedHealth:copy(saved.shadow?.health),baseHealth:base?.hp,createdAt:Date.now()};persist();transport?.propose(copy(saved.proposal));review.close();render()};review.append(button)}const cancel=document.createElement('button');cancel.textContent='Continuer en Libre';cancel.onclick=()=>review.close();review.append(cancel);if(!review.open)review.showModal();
 }
 function receive(event){if(event.type==='resolution:accepted'){const q=event.payload||{};if(!saved.proposal||q.proposalId!==saved.proposal.id||q.generation!==saved.generation)return true;if(!q.ok){saved.proposal=null;persist();render();return true;}saved.sessions.at(-1).localState=copy(b.read());persist();committing=true;try{transport?.apply(q.state);restoreConnectedEconomy(q.state);saved.mode='encounter';saved.generation++;saved.sessions.at(-1).completedAt=Date.now();saved.proposal=null;persist();notify();b.healthRefresh?.();api.sync();window.dispatchEvent(new CustomEvent('rpg-resolution:change',{detail:{mode:'encounter',generation:saved.generation}}));}finally{committing=false;}return true;}
  if(isDetached(event.payload)){rememberResult(event);return true;}return false;
 }
 function outbound(event){if(event.type.startsWith('resolution:'))return true;if(free())return false;return !isDetached(event.payload);}
 api.subscribe(event=>{if(free()&&!committing&&!event.type.startsWith('resolution:')){for(const id of identifiers(event.payload))saved.detached[id]={name:event.type,status:'free-local',generation:saved.generation};const session=saved.sessions.at(-1);if(session){session.localState=copy(b.read());session.lastEvent={type:event.type,at:Date.now()};persist()}}});
 window.RPGResolution={free,controlled,enterFree,returnEncounter,resetActions,prepareEconomyRestore,mountRibbon,register,archive,shadow,receive,rememberResult,isDetached,outbound,bind:t=>{transport=t;notify();if(saved.proposal)t.propose(copy(saved.proposal));},getState:()=>copy(saved),resume:()=>{notify();if(saved.proposal)transport?.propose(copy(saved.proposal));},filterPending:list=>(list||[]).filter(x=>!isDetached(x))};render();
})();
