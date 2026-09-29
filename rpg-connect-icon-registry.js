/* RPG Connect shared icon registry v2 — D&D pack hosted from Zephyr assets. */
(()=>{'use strict';
const labels={aberration:'Aberration',beast:'Bête',celestial:'Céleste',construct:'Artificiel',dragon:'Dragon',elemental:'Élémentaire',fey:'Fée',fiend:'Fiélon',giant:'Géant',humanoid:'Humanoïde',monstrosity:'Monstruosité',ooze:'Vase',plant:'Plante',undead:'Mort-vivant',unknown:'Inconnu'};
const types=['aberration','beast','celestial','construct','dragon','elemental','fey','fiend','giant','humanoid','monstrosity','ooze','plant','undead'];
const base='https://raw.githubusercontent.com/bryantoualy-del/RPG-Connect/main/assets/icons/creatures/';
const standard=Object.fromEntries(types.map(k=>[k,base+'standard/'+k+'.webp']));
const boss=Object.fromEntries(types.map(k=>[k,base+'boss/'+k+'.webp']));
const aliases={humanoide:'humanoid',fee:'fey',celeste:'celestial',mort_vivant:'undead',geant:'giant',fielon:'fiend',plante:'plant',vase:'ooze',artificiel:'construct',monstruosite:'monstrosity',elementaire:'elemental',bete:'beast'};
const norm=t=>{const k=String(t||'unknown').toLowerCase().trim().replace(/[ -]+/g,'_');return aliases[k]||k};
window.RPGConnectIcons=Object.freeze({creatureTypes:[...types],label:t=>labels[norm(t)]||labels.unknown,creature:(t,isBoss=false)=>{const k=norm(t);return (isBoss?boss[k]:standard[k])||standard[k]||'';},bossReady:true,ui:()=>null,classIcon:()=>null});
})();