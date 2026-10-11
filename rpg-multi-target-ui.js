/* Presentation only: selection uses RPGConnect; all save results come from Encounter. */
(()=>{'use strict';
 const api=window.CompanionAPI,net=window.RPGConnect;if(!api||!net)return;
 const config=window.RPGMultiTargetUIConfig||{bindings:[]},key='rpg-connect:multi-ui:v1:'+api.getCharacter().id;
 let actions=[],offlineValues={},syncPhase='',dialogSource='',choice=null;
 try{const saved=JSON.parse(localStorage.getItem(key)||'{}');actions=Array.isArray(saved.actions)?saved.actions.slice(-12):[];offlineValues=saved.offlineValues||{}}catch{}
 const persist=()=>{try{localStorage.setItem(key,JSON.stringify({actions:actions.slice(-12),offlineValues}))}catch{}};
 const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const sourceFor=(binding,button)=>binding.sources?binding.sources[button.dataset[binding.sourceAttribute]]:binding.source;
 const matches=(a,source)=>a.source===source||a.source.endsWith(' · '+source);
 const latest=source=>actions.findLast(a=>!a.dismissed&&matches(a,source));
 const pending=a=>a&&!a.cancelled&&a.targets.some(t=>!t.result);
 const selected=()=>net.getStatus().targetMode==='single'?[]:net.getSelectedTargets();
 function setText(el,text){if(el.textContent!==text)el.textContent=text}
 function bindings(){return(config.bindings||[]).flatMap(binding=>[...document.querySelectorAll(binding.selector)].map(button=>({binding,button,source:sourceFor(binding,button)}))).filter(x=>x.source)}
 const dialog=document.createElement('dialog');dialog.id='rpgMultiTargetPicker';dialog.className='rpg-multi-picker';dialog.setAttribute('aria-label','Choisir les cibles Encounter');document.body.append(dialog);
 dialog.innerHTML='<div class="rpg-multi-picker-head"><strong>Choisir les cibles</strong><button type="button" data-multi-close aria-label="Fermer">Fermer</button></div><p data-multi-picker-count></p><div data-multi-picker-list></div><p data-multi-picker-empty></p><div class="rpg-multi-picker-foot"><button type="button" data-multi-clear>Tout désélectionner</button><button type="button" data-multi-done>Valider la sélection</button></div>';
 function renderPicker(){
  if(!dialog.open)return;
  const connected=net.getStatus().controlled,list=choice?choice.list:net.getTargets(),ids=new Set(choice?choice.ids:selected().map(t=>String(t.id)));
  const html=list.map(t=>{const original=[...document.querySelectorAll('#rpg-target-dock [data-target-id]')].find(el=>el.dataset.targetId===String(t.id)),img=original?.querySelector('img');return '<button type="button" data-multi-target="'+esc(t.id)+'" aria-pressed="'+ids.has(String(t.id))+'" '+(!connected?'disabled':'')+'>'+(img?'<img alt="" src="'+esc(img.src)+'">':'')+'<span>'+esc(t.name)+(choice?' <small>'+esc(t.kind==='player'?'PJ':t.companionId?'Companion allié':'PNJ / créature alliée')+'</small>':'')+'</span><b aria-hidden="true">'+(ids.has(String(t.id))?'✓':'+')+'</b></button>'}).join('');
  const box=dialog.querySelector('[data-multi-picker-list]');if(box.innerHTML!==html)box.innerHTML=html;
  setText(dialog.querySelector('[data-multi-picker-count]'),(choice?choice.ids.length:selected().length)+' cible(s) sélectionnée(s)' + (choice?' / '+choice.max:''));
  setText(dialog.querySelector('[data-multi-picker-empty]'),!connected?'Connexion interrompue — reconnecte-toi pour modifier les cibles.':!list.length?'Aucune cible disponible depuis Encounter.':'');
  dialog.querySelector('[data-multi-clear]').disabled=!connected;dialog.querySelector('[data-multi-done]').disabled=!connected||!!(choice&&choice.ids.length<choice.min);
 }
 function openPicker(source=''){if(!net.getStatus().controlled)return false;dialogSource=source;net.prepareTargets({targetMode:'multi',open:false});if(!dialog.open)dialog.showModal();renderPicker();return true}
 dialog.addEventListener('click',e=>{if(choice){const b=e.target.closest('button');if(!b)return;if(b.dataset.multiTarget){const id=b.dataset.multiTarget;if(choice.ids.includes(id))choice.ids=choice.ids.filter(x=>x!==id);else if(choice.ids.length<choice.max)choice.ids.push(id);renderPicker()}else if(b.hasAttribute('data-multi-clear')){choice.ids=[];renderPicker()}else if(b.hasAttribute('data-multi-done')){if(choice.ids.length<choice.min)return;finishChoice(choice.ids)}else if(b.hasAttribute('data-multi-close'))finishChoice([]);return;}const card=e.target.closest('[data-multi-target]');if(card){const previous=latest(dialogSource);if(previous&&!pending(previous)){previous.dismissed=true;persist()}const ids=selected().map(t=>String(t.id)),id=card.dataset.multiTarget;net.selectTargets(ids.includes(id)?ids.filter(x=>x!==id):[...ids,id]);render();return}if(e.target.closest('[data-multi-clear]')){const previous=latest(dialogSource);if(previous&&!pending(previous)){previous.dismissed=true;persist()}net.clearSelectedTargets();render()}if(e.target.closest('[data-multi-close],[data-multi-done]')){dialog.close();render()}});
 const originalPicker=net.openTargetPicker.bind(net);net.openTargetPicker=()=>net.getStatus().targetMode==='single'?originalPicker():openPicker();
 function renderFields(source,connected,a){
  const count=a&&!a.cancelled?a.targets.length:selected().length,failed=a&&!a.cancelled?a.targets.filter(t=>t.result?.success===false&&!t.result?.cancelled&&!t.result?.error).length:0;
  for(const [selector,value]of Object.entries(config.fields||{})){
   const el=document.querySelector(selector);if(!el)continue;const managed=connected||pending(a);
   if(managed){if(!el.dataset.multiManaged){if(!(selector in offlineValues))offlineValues[selector]=el.value;el.dataset.multiManaged='1';persist()}el.readOnly=true;el.setAttribute('aria-readonly','true');el.value=String(value==='targets'?count:failed)}
   else if(el.dataset.multiManaged){el.value=offlineValues[selector]??el.value;el.readOnly=false;el.removeAttribute('aria-readonly');delete el.dataset.multiManaged}
  }
  for(const el of document.querySelectorAll(config.manualHelp||'[data-unused-multi-help]'))el.hidden=connected||pending(a);
 }
 function render(){
  const connected=!!net.getStatus().controlled;
  for(const {binding,button,source}of bindings()){
   const host=(binding.container&&button.closest(binding.container))||button.parentElement;
   let group=host.querySelector(':scope > [data-multi-ui="'+button.dataset.multiUiId+'"]');
   if(!group){button.dataset.multiUiId=button.dataset.multiUiId||String(Math.random()).slice(2);group=document.createElement('div');group.className='rpg-multi-action-ui';group.dataset.multiUi=button.dataset.multiUiId;group.innerHTML='<button type="button" data-multi-choose>Choisir les cibles</button><div data-multi-selection></div><div data-multi-progress role="status" aria-live="polite"></div>';if(host===button.parentElement)button.insertAdjacentElement('afterend',group);else host.append(group);group.querySelector('[data-multi-choose]').setAttribute('aria-haspopup','dialog');group.querySelector('[data-multi-choose]').onclick=()=>openPicker(sourceFor(binding,button))}
   const a=latest(source),waiting=pending(a),active=connected||waiting;
   group.hidden=!active;group.querySelector('[data-multi-choose]').disabled=!connected||waiting;
   setText(group.querySelector('[data-multi-choose]'),selected().length?'Modifier les cibles · '+selected().length:'Choisir les cibles');
   setText(group.querySelector('[data-multi-selection]'),connected?'Sélection : '+(selected().map(t=>t.name).join(' · ')||'aucune cible'):'');
   const resultBox=group.querySelector('[data-multi-progress]');
   const summary=a?(()=>{const fail=a.targets.filter(t=>t.result?.success===false).length,success=a.targets.filter(t=>t.result?.success===true).length,left=a.targets.filter(t=>!t.result).length;return(a.cancelled?'Action annulée':!connected&&waiting?'Reconnexion — résolution en attente':left?'Résolution MJ en cours':'Résolution terminée')+' · '+fail+' échec(s) · '+success+' réussite(s)'+(left?' · '+left+' en attente':'')})():'';
   const html=a?'<strong>'+esc(a.source)+'</strong><p>'+esc(summary)+'</p>'+(Number.isFinite(a.rolledDamage)&&a.rolledDamage>0?'<p>Jet commun : '+esc(a.rolledDamage)+' '+esc(a.damageType||'dégâts')+'</p>':'')+'<ul>'+a.targets.map(t=>{const r=t.result;let status=a.cancelled?'Annulée':!r?'En attente':r.cancelled?'Annulée':r.error?'Non résolue : '+r.error:r.skipped?'Non affectée : '+(r.reason||''):r.success?'Réussite':'Échec';if(!a.cancelled&&r&&!r.cancelled&&!r.error&&!r.skipped){if(r.effectiveDamage!=null)status+=' · '+r.effectiveDamage+' dégâts';if(r.dead)status+=' · Éliminée';if(r.conditionsApplied?.length)status+=' · '+r.conditionsApplied.join(', ');if(r.conditionImmune)status+=' · Immunité à l’état';if(r.failureEffect)status+=' · '+r.failureEffect}return '<li>'+esc(r?.targetName||t.name)+' — '+esc(status)+'</li>'}).join('')+'</ul>':'';
   if(resultBox.innerHTML!==html)resultBox.innerHTML=html;
   if(button.textContent!==button.dataset.multiRenderedLabel)button.dataset.multiOriginalLabel=button.textContent;const old=button.dataset.multiOriginalLabel;
   const label=active?(waiting?'Résolution en attente':selected().length?'Lancer sur '+selected().length+' cible'+(selected().length>1?'s':''):'Choisir les cibles'):(old||button.textContent);
   setText(button,label);button.dataset.multiRenderedLabel=label;
   if(binding.fields)renderFields(source,connected,a);
  }
  // A dynamic caster can switch back to a single-target spell: hide its previous panel.
  const buttons=new Set(bindings().map(x=>x.button.dataset.multiUiId));for(const el of document.querySelectorAll('[data-multi-ui]'))if(!buttons.has(el.dataset.multiUi))el.hidden=true;
  renderPicker();
 }
 document.addEventListener('click',e=>{if(e.target.closest?.('[data-resolution-controls]'))return;
  const match=bindings().find(x=>x.button===e.target.closest('button'));if(!match)return;
  const a=latest(match.source),connected=net.getStatus().controlled;
  if(pending(a)||(!connected&&actions.some(pending))){e.preventDefault();e.stopImmediatePropagation();render();return}
  if(connected){net.prepareTargets({targetMode:'multi',open:false});if(!selected().length){e.preventDefault();e.stopImmediatePropagation();openPicker(match.source)}}
 },true);
 document.addEventListener('change',()=>setTimeout(render,0));
 document.addEventListener('input',e=>{if(net.getStatus().controlled||actions.some(pending))return;for(const selector of Object.keys(config.fields||{}))if(e.target.matches(selector)){offlineValues[selector]=e.target.value;persist()}});
 api.subscribe(event=>{
  const p=event.payload||{};
  if(event.type==='save:request'&&p.targetMode!=='single'&&Array.isArray(p.targets)){
   const actionId=String(p.actionId||p.saveId||event.id);if(!actions.some(a=>a.id===actionId)){actions.push({id:actionId,source:String(p.source||'Capacité'),rolledDamage:p.damage,damageType:p.damageType,targets:p.targets.map(t=>({id:String(t.targetId||t.id||t),name:String(t.name||t.targetId||t.id||t)}))});actions=actions.slice(-12);persist()}
  }
  if(event.type==='save:result'){
   const a=actions.find(a=>a.id===String(p.actionId||p.parentActionId||p.saveId));if(a){const t=a.targets.find(t=>t.id===String(p.targetId));if(t&&!t.result)t.result=p;if(p.cancelled)a.cancelled=true;persist()}
  }
  if(event.type==='action:undo-request'){const a=actions.find(a=>a.id===String(p.actionId||p.parentActionId));if(a){a.cancelled=true;persist()}}
  if(event.type==='state:synced'){const phase=p.machine?.state;if(['LOBBY','PREP','END'].includes(phase)&&phase!==syncPhase){actions=[];persist()}syncPhase=phase||syncPhase}
  setTimeout(render,0);
 });
 const style=document.createElement('style');style.textContent='.rpg-multi-action-ui{width:100%;margin:8px 0;min-width:0;overflow-wrap:anywhere;font-size:12px;line-height:1.5}.rpg-multi-action-ui[hidden]{display:none!important}.rpg-multi-action-ui ul{padding-left:18px;margin:5px 0}.rpg-multi-action-ui p{margin:4px 0}.rpg-multi-action-ui button{min-height:40px}.rpg-multi-picker{color:#eef3fa;background:#111d2b;border:1px solid #768ba0;border-radius:14px;width:min(600px,calc(100vw - 32px));max-height:80dvh;padding:16px;box-sizing:border-box}.rpg-multi-picker::backdrop{background:#000a}.rpg-multi-picker-head,.rpg-multi-picker-foot{display:flex;justify-content:space-between;gap:10px;align-items:center}.rpg-multi-picker button{color:inherit;border:1px solid #6e8197;background:#223348;border-radius:9px;padding:10px;min-height:44px}.rpg-multi-picker [data-multi-picker-list]{display:grid;gap:8px;margin:12px 0;max-height:48dvh;overflow:auto}.rpg-multi-picker [data-multi-target]{display:flex;gap:10px;align-items:center;text-align:left}.rpg-multi-picker [data-multi-target] span{flex:1}.rpg-multi-picker [aria-pressed=true]{border-color:#97d6ff;background:#264860}.rpg-multi-picker img{width:44px;height:44px;object-fit:contain}.rpg-multi-picker button:disabled{opacity:.5}';document.head.append(style);
 function finishChoice(ids){const c=choice;choice=null;dialog.close();dialog.querySelector('strong').textContent='Choisir les cibles';c?.resolve(ids);render()}
 dialog.addEventListener('cancel',()=>{if(choice)finishChoice([])});
 window.RPGMultiTargetUI={refresh:render,getActions:()=>JSON.parse(JSON.stringify(actions)),openPicker,chooseTargets:({list,min=1,max=1,title='Choisir les alliés'})=>{if(choice||dialog.open)return Promise.resolve([]);return new Promise(resolve=>{choice={list,ids:[],min,max,resolve};dialog.querySelector('strong').textContent=title;dialog.showModal();renderPicker()})}};
 setInterval(render,750);setTimeout(render,0);
})();
