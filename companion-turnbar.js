/* Compagnie Créole — Turnbar Standard V1 */
(()=>{'use strict';
if(window.__ccTurnbarStandard)return;window.__ccTurnbarStandard=true;
const $=(s,r=document)=>r.querySelector(s), txt=n=>(n?.textContent||'').replace(/\s+/g,' ').trim(), setText=(el,v)=>{const s=String(v??'');if(el&&el.textContent!==s)el.textContent=s};
const id=()=>window.__CompanionBridge?.id||({Kentaro:'kentaro',Samoth:'samoth',Brackmard:'brackmard',Rufus:'rufus',Nans:'nans',Zephyr:'zephyr'}[document.title.split(' - ')[0]]||'');
const configs={
 kentaro:{anchor:'#ecoAction',turn:'#turnEconomyView',round:'#turnEconomyView',action:'#ecoAction',bonus:'#ecoBonus',reaction:'#ecoReaction',move:'#ecoMove',damage:'#turnDamageView',conc:'#ecoConc',next:'#newTurn',short:'#shortRest',long:'#longRest'},
 samoth:{anchor:'#turnbar',turn:'#turn',round:'#round',action:'[data-econ="action"]',bonus:'[data-econ="bonus"]',reaction:'[data-econ="reaction"]',move:'[data-econ="move"]',damage:'#damageTurn',conc:'#concButton',concText:'#concText',next:'#nextTurn',short:'#shortRest',long:'#longRest'},
 brackmard:{anchor:'#turnbar',turn:'#turnNo',round:'#roundNo',action:'#ecoAction',bonus:'#ecoBonus',reaction:'#ecoReaction',move:'#v3-movement',damage:'#turnDmg',next:'.turnbar .next',short:'.turnbar .restquick:not(.long)',long:'.turnbar .restquick.long'},
 rufus:{anchor:'#turnbar',turn:'#turnNo',round:'#roundNo',action:'[data-econ="action"]',bonus:'[data-econ="bonus"]',reaction:'[data-econ="reaction"]',move:'[data-econ="move"]',damage:'#turnDamageValue',conc:'#turnConcentration',concText:'#turnConcText',next:'#nextTurn',short:'#quickShortRestBtn',long:'#quickLongRestBtn'},
 nans:{anchor:'#turnbar',turn:'#turnNo',round:'#roundNo',action:'#ecoAction',bonus:'#ecoBonus',reaction:'#ecoReaction',move:'#v3-movement',damage:'#turnDmg',next:'.turnbar .next',short:'.turnbar .restquick:not(.long)',long:'.turnbar .restquick.long'},
 zephyr:{anchor:'.hud',turn:'#turnTop',round:'#turnTop',action:'#ecoA',bonus:'#ecoB',reaction:'#ecoR',move:'#ecoM',damage:'#dmgTop',conc:'#concChip',concText:'#concText',next:'#nextTurn',short:'#shortRest',long:'#longRest'}
};
const get=(s)=>s?$(s):null;
function statusFrom(el,fallback='Disponible'){
 if(!el)return fallback;
 if(el.classList.contains('used'))return 'Utilisée';
 if(el.classList.contains('free'))return 'Disponible';
 const small=el.querySelector('small,span');let s=txt(small);
 if(!s){const clone=el.cloneNode(true);clone.querySelectorAll('b,strong').forEach(n=>n.remove());s=txt(clone)}
 return s||fallback;
}
function cell(cls,icon,label,state=''){
 const b=document.createElement('button');b.type='button';b.className='cc-turn-cell '+cls;
 b.innerHTML='<span class="cc-turn-icon">'+icon+'</span><span class="cc-turn-label">'+label+'</span><span class="cc-turn-state">'+state+'</span>';return b;
}
function boot(){
 const cfg=configs[id()];if(!cfg)return;
 const anchor=get(cfg.anchor);if(!anchor)return setTimeout(boot,250);
 const nativeBar=anchor.closest('#turnbar,.turnbar,.turn-economy,.hud')||anchor.parentElement;
 const bar=document.createElement('section');bar.id='cc-turnbar-standard';bar.setAttribute('aria-label','Économie du tour standardisée');
 const round=cell('cc-turn-round','◫','Tour 1','Round 1');
 const action=cell('cc-turn-action','⚔','Action','Disponible');
 const bonus=cell('cc-turn-bonus','✦','Bonus','Disponible');
 const reaction=cell('cc-turn-reaction','↯','Réaction','Disponible');
 const move=cell('cc-turn-move','↗','Mouvement','Disponible');
 const damage=cell('cc-turn-damage','💥','0 dégâts','ce tour');
 const conc=cell('cc-turn-conc','◐','Concentration','—');
 const next=cell('cc-turn-next','›','Suivant','');
 const short=cell('cc-turn-rest','☕','Court','');
 const long=cell('cc-turn-rest','☾','Long','');
 [round,action,bonus,reaction,move,damage,conc,next,short,long].forEach(x=>bar.appendChild(x));
 nativeBar.parentNode.insertBefore(bar,nativeBar);
 document.body.classList.add('cc-turnbar-ready');
 try{
  const cs=getComputedStyle(nativeBar), sample=get(cfg.action)||nativeBar, ss=getComputedStyle(sample), ns=getComputedStyle(get(cfg.next)||sample);
  bar.style.setProperty('--cc-turn-bg',cs.backgroundColor&&cs.backgroundColor!=='rgba(0, 0, 0, 0)'?cs.backgroundColor:'rgba(12,16,22,.94)');
  bar.style.setProperty('--cc-turn-border',cs.borderTopColor||ss.borderTopColor);
  bar.style.setProperty('--cc-turn-fg',cs.color||ss.color);
  bar.style.setProperty('--cc-cell-bg',ss.backgroundColor&&ss.backgroundColor!=='rgba(0, 0, 0, 0)'?ss.backgroundColor:'rgba(255,255,255,.035)');
  bar.style.setProperty('--cc-cell-border',ss.borderTopColor||cs.borderTopColor);
  bar.style.setProperty('--cc-next-bg',ns.backgroundColor&&ns.backgroundColor!=='rgba(0, 0, 0, 0)'?ns.backgroundColor:ss.backgroundColor);
 }catch{}
 const proxy=(btn,sel)=>{const target=get(sel);if(!target){btn.classList.add('passive');return}const clickable=target.matches('button,[role="button"],a')||typeof target.onclick==='function';if(clickable)btn.addEventListener('click',()=>target.click());else btn.classList.add('passive')};
 proxy(action,cfg.action);proxy(bonus,cfg.bonus);proxy(reaction,cfg.reaction);proxy(move,cfg.move);proxy(next,cfg.next);proxy(short,cfg.short);proxy(long,cfg.long);
 conc.addEventListener('click',()=>{const target=get(cfg.conc);if(target?.matches('button,[role="button"]'))return target.click();const clear=window.__CompanionBridge?.commands?.clearConcentration;if(typeof clear==='function'&&!/aucune|—/i.test(conc.querySelector('.cc-turn-state').textContent))clear()});
 function sync(){
   const turn=txt(get(cfg.turn))||'1',roundValue=txt(get(cfg.round))||turn;
   setText(round.querySelector('.cc-turn-label'),'Tour '+turn);setText(round.querySelector('.cc-turn-state'),'Round '+roundValue);
   for(const [btn,key] of [[action,'action'],[bonus,'bonus'],[reaction,'reaction'],[move,'move']]){
     const el=get(cfg[key]),st=statusFrom(el);setText(btn.querySelector('.cc-turn-state'),st);
     btn.classList.toggle('is-used',!!el&&(el.classList.contains('used')||/utilis|épuis|indispo/i.test(st)));
     btn.classList.toggle('is-active',!!el&&(el.classList.contains('extra')||el.classList.contains('active')||el.classList.contains('on')));
   }
   let d=txt(get(cfg.damage)).replace(/\s*dégâts?.*$/i,'');setText(damage.querySelector('.cc-turn-label'),(d||'0')+' dégâts');
   const cEl=get(cfg.conc),ct=txt(get(cfg.concText))||(cEl?txt(cEl.querySelector('b')):'')||'—';setText(conc.querySelector('.cc-turn-state'),ct);conc.classList.toggle('is-active',!/aucune|—|none/i.test(ct));
   const n=get(cfg.next);if(n){const label=txt(n);setText(next.querySelector('.cc-turn-state'),/spectre/i.test(label)?label.replace(/^↻\s*/,''):'')}
 }
 const mo=new MutationObserver(mutations=>{if(mutations.every(m=>bar.contains(m.target)))return;sync()});mo.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['class','disabled']});sync();
 function rpgVisibility(){
   const strip=$('#rpg-state-strip');if(!strip)return;
   const banner=$('.rpg-session-banner'), networkStatus=$('.rpg-connect-status');
   const tone=banner?.dataset?.tone||'';
   const state=txt(banner?.querySelector('[data-session-title]'))||txt(networkStatus)||txt(strip.querySelector('.rpgstate'))||txt(strip);
   const connected=(tone&&tone!=='offline')||/connecté|connecte|prépa fight|prepa fight|initiative|à toi|a toi|tour de|réaction|reaction|fight/i.test(state);
   strip.hidden=!connected;
 }
 const rmo=new MutationObserver(rpgVisibility);rmo.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['data-tone','class']});rpgVisibility();
}
document.readyState==='loading'?document.addEventListener('DOMContentLoaded',boot):boot();
})();
