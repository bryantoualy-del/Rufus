(()=>{'use strict';

const KEY='rufus-companion-v3:3';
const BACKUP=KEY+':backup';
const OLD_COMBAT='rufus-combat-v3';
const MAX_JOURNAL=250;
const MAX_HISTORY=24;
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
const die=n=>Math.floor(Math.random()*n)+1;
const dice=(count,sides)=>Array.from({length:count},()=>die(sides));
const sum=a=>a.reduce((x,y)=>x+y,0);
const fmt=n=>n>=0?'+'+n:String(n);
const now=()=>new Date().toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'});
const clone=x=>JSON.parse(JSON.stringify(x));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const defaultItems=[
  {name:'Dague spectrale',category:'equipment',qty:1,note:'+8 · 1d4+4 · JdS CON DD13.',image:'',icon:'blade',equipped:true},
  {name:'Hexen Blade',category:'equipment',qty:1,note:'+8 · 1d6+4 · 5 charges · illusions DD15.',image:'',icon:'blade',equipped:true},
  {name:'Arbalète légère duergar',category:'equipment',qty:1,note:'24/96 m · munitions · chargement · deux mains.',image:'',icon:'bow',equipped:true},
  {name:'Arc standard',category:'equipment',qty:1,note:'Carquois de 30 flèches.',image:'',icon:'bow',equipped:false},
  {name:'Armure de cuir',category:'equipment',qty:1,note:'CA 14 avec DEX 16.',image:'',icon:'armor',equipped:true},
  {name:'Linceul du Jugement Noir',category:'equipment',qty:1,note:'Vestige · cuir clouté · Dormant CA16 / Éveillé CA17.',image:'',icon:'raven',equipped:false},
  {name:'Chaussons araignée',category:'equipment',qty:1,note:'Mobilité · propriété exacte à valider.',image:'',icon:'boots',equipped:true},
  {name:'Amulette de résistance occulte',category:'equipment',qty:1,note:'Protection · effet exact selon fiche de table.',image:'',icon:'amulet',equipped:true},
  {name:'Bague d’échange d’apparence',category:'misc',qty:1,note:'Paire liée à Kentaro · paramètres exacts à valider.',image:'',icon:'ring',equipped:false},
  {name:'Globe flottant',category:'misc',qty:1,note:'Objet utilitaire.',image:'',icon:'globe',equipped:false},
  {name:'Sac sans fond',category:'misc',qty:1,note:'Contenant extradimensionnel.',image:'',icon:'bag',equipped:false},
  {name:'Statuette d’éléphant',category:'misc',qty:1,note:'Objet narratif · effet non documenté ici.',image:'',icon:'elephant',equipped:false},
  {name:'Accessoires de déguisement',category:'misc',qty:1,note:'Maîtrise.',image:'',icon:'disguise',equipped:false},
  {name:'Matériel de contrefaçon',category:'misc',qty:1,note:'Maîtrise.',image:'',icon:'disguise',equipped:false},
  {name:'Kit d’empoisonneur',category:'misc',qty:1,note:'Poison & infiltration.',image:'',icon:'poison',equipped:false},
  {name:'Sérum de vérité',category:'consumable',qty:1,note:'Consommable.',image:'',icon:'poison',equipped:false},
  {name:'Venin de vipère à tête noire',category:'consumable',qty:1,note:'Poison.',image:'',icon:'poison',equipped:false},
  {name:'Carreaux d’arbalète',category:'consumable',qty:20,note:'Munitions.',image:'',icon:'ammo',equipped:false}
];
const inventoryIcons={auto:'✦',blade:'🗡',raven:'◆',armor:'◈',bow:'➶',poison:'☠',ring:'◉',boots:'⌁',amulet:'◇',bag:'▣',globe:'◌',elephant:'♜',disguise:'◐',ammo:'⋙',misc:'✦'};
const inventoryCategoryLabels={equipment:'Équipement',misc:'Objet',consumable:'Consommable'};

function defaults(){
  return {
    schema:3,hp:53,maxHp:53,tempHp:0,turn:1,round:1,turnDamage:0,
    economy:{action:true,bonus:true,reaction:true,move:true},
    concentration:null,rollMode:'normal',socialMode:'normal',
    conditions:{allyAdjacent:false,agony:false},
    sneakOwn:false,sneakReaction:false,psychicFollowup:false,sharpshooter:false,
    lucky:3,hexCharges:5,psiDie:8,psiReconstitutionReady:true,psiKnackLast:'',psiWhispersLast:'',
    fireBlade:{ready:true,armed:false},
    woundReady:true,invisibilityReady:true,
    vision:{active:false,target:'',uses:0,wisPenalty:0},
    linceul:{state:'unequipped',judgment:true,lastBreath:true,ravenShadow:2,pilgrim:true},
    ravenMemoryBonus:false,
    pending:null,
    inventory:clone(defaultItems),inventoryTab:'equipment',
    notes:'',notesPreview:false,journal:[],history:[],
    ui:{view:'combat',socialTab:'skills',subtabs:{combat:'attacks',arsenal:'psi',journal:'mechanics'}}
  };
}
let S=defaults();
let storageBlocked=false;
let migrated=false;

function sanitizeItem(i){
  return {
    name:String(i?.name||'Objet').slice(0,120),
    category:['equipment','misc','consumable'].includes(i?.category)?i.category:'misc',
    qty:clamp(parseInt(i?.qty??1,10),0,999),
    note:String(i?.note||'').slice(0,3000),
    image:/^(https:\/\/|data:image\/)/.test(String(i?.image||''))?String(i.image).slice(0,350000):'',
    icon:Object.prototype.hasOwnProperty.call(inventoryIcons,String(i?.icon||'auto'))?String(i?.icon||'auto'):'auto',
    equipped:!!(i?.equipped??i?.active)
  };
}
function normalize(x){
  const d=defaults();
  if(!x||typeof x!=='object')return d;
  const o={...d,...x};
  o.schema=3;o.maxHp=53;o.hp=clamp(o.hp,0,53);o.tempHp=clamp(o.tempHp,0,999);
  o.turn=Math.max(1,parseInt(o.turn,10)||1);o.round=Math.max(1,parseInt(o.round,10)||1);o.turnDamage=Math.max(0,Number(o.turnDamage)||0);
  o.economy={...d.economy,...(o.economy||{})};
  o.conditions={...d.conditions,...(o.conditions||{})};delete o.conditions.targetNotActed;delete o.conditions.surprised;
  o.fireBlade={...d.fireBlade,...(o.fireBlade||{})};
  o.vision={...d.vision,...(o.vision||{})};
  o.linceul={...d.linceul,...(o.linceul||{})};
  if(!['unequipped','dormant','awakened'].includes(o.linceul.state))o.linceul.state='unequipped';
  if(!['normal','adv','dis'].includes(o.rollMode))o.rollMode='normal';
  if(!['normal','adv','dis'].includes(o.socialMode))o.socialMode='normal';
  if(!['equipment','misc','consumable'].includes(o.inventoryTab))o.inventoryTab='equipment';
  o.lucky=clamp(o.lucky,0,3);o.hexCharges=clamp(o.hexCharges,0,5);
  o.psiDie=[0,4,6,8].includes(Number(o.psiDie))?Number(o.psiDie):8;
  o.psiReconstitutionReady=o.psiReconstitutionReady!==false;o.psiKnackLast=String(o.psiKnackLast||'').slice(0,180);o.psiWhispersLast=String(o.psiWhispersLast||'').slice(0,180);
  o.ui={...d.ui,...(o.ui||{}),subtabs:{...d.ui.subtabs,...(o.ui?.subtabs||{})}};
  if(!['combat','arsenal','social','journal'].includes(o.ui.view))o.ui.view='combat';
  if(!['skills','abilities','inventory','rp'].includes(o.ui.socialTab))o.ui.socialTab='skills';
  if(!['attacks','defense','resources'].includes(o.ui.subtabs.combat))o.ui.subtabs.combat='attacks';
  if(!['psi','hexen','linceul','powers'].includes(o.ui.subtabs.arsenal))o.ui.subtabs.arsenal='psi';
  if(!['mechanics','notes','backup'].includes(o.ui.subtabs.journal))o.ui.subtabs.journal='mechanics';
  o.inventory=Array.isArray(o.inventory)?o.inventory.slice(0,200).map(sanitizeItem):clone(defaultItems);
  o.notes=String(o.notes||'').slice(0,150000);
  o.journal=Array.isArray(o.journal)?o.journal.slice(0,MAX_JOURNAL):[];
  o.history=Array.isArray(o.history)?o.history.slice(-MAX_HISTORY):[];
  return o;
}
function migrateLegacy(){
  const n=defaults();
  try{
    const raw=localStorage.getItem(OLD_COMBAT);
    if(raw){
      const old=JSON.parse(raw);const s=old?.state||old;
      if(s&&typeof s==='object'){
        n.hp=clamp(s.hp??53,0,53);n.tempHp=clamp(s.tempHp??0,0,999);
        n.lucky=clamp(s.luck??3,0,3);n.hexCharges=clamp(s.hex??5,0,5);
        n.woundReady=s.wound!==false;n.invisibilityReady=s.invis!==false;
        n.psiDie=[0,4,6,8].includes(Number(s.psi))?Number(s.psi):8;
        if(['awakened','dormant'].includes(s.linceul))n.linceul.state=s.linceul;
        if(Array.isArray(old.log))n.journal=old.log.slice(0,80).map((t,i)=>({id:'legacy-'+i,time:'—',title:'Ancien journal',detail:String(t).slice(0,1200)}));
      }
    }
  }catch{}
  try{
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k&&k.startsWith('companion-v3:rufus:')){
        const x=JSON.parse(localStorage.getItem(k)||'{}');
        if(Array.isArray(x.items)&&x.items.length)n.inventory=x.items.map(sanitizeItem);
        if(typeof x.notes==='string'&&x.notes)n.notes=x.notes.slice(0,150000);
        break;
      }
    }
  }catch{}
  migrated=true;return n;
}
function load(){
  try{
    const raw=localStorage.getItem(KEY);
    S=raw?normalize(JSON.parse(raw)):migrateLegacy();
    if(!raw&&migrated)save();
  }catch(e){storageBlocked=true;S=defaults();console.warn('Rufus save unreadable; preserving existing storage.',e);}
}
function save(){
  if(storageBlocked)return false;
  try{localStorage.setItem(KEY,JSON.stringify(S));$('#saveStatus')&&($('#saveStatus').textContent='Sauvegardé · '+now());return true;}
  catch(e){storageBlocked=true;$('#saveStatus')&&($('#saveStatus').textContent='Stockage indisponible');toast('Stockage local indisponible — exportez les données.');return false;}
}
function combatSnapshot(){
  return {
    hp:S.hp,tempHp:S.tempHp,turn:S.turn,round:S.round,turnDamage:S.turnDamage,economy:clone(S.economy),
    concentration:S.concentration?clone(S.concentration):null,rollMode:S.rollMode,conditions:clone(S.conditions),
    sneakOwn:S.sneakOwn,sneakReaction:S.sneakReaction,psychicFollowup:S.psychicFollowup,sharpshooter:S.sharpshooter,
    lucky:S.lucky,hexCharges:S.hexCharges,psiDie:S.psiDie,psiReconstitutionReady:S.psiReconstitutionReady,psiKnackLast:S.psiKnackLast,psiWhispersLast:S.psiWhispersLast,fireBlade:clone(S.fireBlade),woundReady:S.woundReady,
    invisibilityReady:S.invisibilityReady,vision:clone(S.vision),linceul:clone(S.linceul),ravenMemoryBonus:S.ravenMemoryBonus,
    pending:S.pending?clone(S.pending):null,journalLength:S.journal.length,journalHeadId:S.journal[0]?.id||null,journalTail:clone(S.journal.slice(-5))
  };
}
function pushHistory(){
  S.history.push(combatSnapshot());
  if(S.history.length>MAX_HISTORY)S.history.shift();
}
let lastRibbonEventId='';
function logEvent(title,detail=''){
  S.journal.unshift({id:Date.now()+'-'+Math.random().toString(36).slice(2,7),time:now(),title:String(title).slice(0,120),detail:String(detail).slice(0,1200)});
  if(S.journal.length>MAX_JOURNAL)S.journal.length=MAX_JOURNAL;
}
function renderResultRibbon(){
  const ribbon=$('#resultRibbon');if(!ribbon)return;
  const e=S.journal[0];
  $('#resultRibbonTitle').textContent=e?e.title:'Dernier résultat';
  $('#resultRibbonText').textContent=e?(e.detail||e.time):'Prêt · les détails complets sont dans Journal / Notes.';
  $('#ribbonUndo').disabled=!S.history.length;
  if(e&&e.id!==lastRibbonEventId){
    lastRibbonEventId=e.id;ribbon.classList.remove('pop');void ribbon.offsetWidth;ribbon.classList.add('pop');
    setTimeout(()=>ribbon.classList.remove('pop'),420);
  }
}
function commit(title,detail,mutate,fx){
  pushHistory();mutate();logEvent(title,detail);save();render();if(fx)playFx(fx,title);
}
function undo(){
  const snap=S.history.pop();
  if(!snap)return toast('Aucune action mécanique à annuler.');
  const remaining=S.history;
  Object.assign(S,{
    hp:snap.hp,tempHp:snap.tempHp,turn:snap.turn,round:snap.round,turnDamage:snap.turnDamage,economy:snap.economy,
    concentration:snap.concentration,rollMode:snap.rollMode,conditions:snap.conditions,sneakOwn:snap.sneakOwn,
    sneakReaction:snap.sneakReaction,psychicFollowup:snap.psychicFollowup,sharpshooter:snap.sharpshooter,lucky:snap.lucky,
    hexCharges:snap.hexCharges,psiDie:snap.psiDie,psiReconstitutionReady:snap.psiReconstitutionReady,psiKnackLast:snap.psiKnackLast,psiWhispersLast:snap.psiWhispersLast,fireBlade:snap.fireBlade,woundReady:snap.woundReady,
    invisibilityReady:snap.invisibilityReady,vision:snap.vision,linceul:snap.linceul,ravenMemoryBonus:snap.ravenMemoryBonus,
    pending:snap.pending
  });
  if(snap.journalLength===0)S.journal=[];
  else if(snap.journalHeadId){
    const idx=S.journal.findIndex(e=>e.id===snap.journalHeadId);
    if(idx>=0){
      S.journal=S.journal.slice(idx);
      if(S.journal.length<snap.journalLength){
        const existing=new Set(S.journal.map(e=>e.id));
        for(const old of snap.journalTail||[])if(!existing.has(old.id))S.journal.push(old);
      }
      if(S.journal.length>snap.journalLength)S.journal.length=snap.journalLength;
    }else S.journal=S.journal.slice(-snap.journalLength);
  }else S.journal=S.journal.slice(-snap.journalLength);
  S.history=remaining;save();render();toast('Dernière action restaurée.');
}

function toast(msg){
  const el=$('#toast');if(!el)return;el.textContent=msg;el.classList.add('show');clearTimeout(toast.t);toast.t=setTimeout(()=>el.classList.remove('show'),2600);
}
function playFx(kind,label){
  const stage=$('#fxStage');if(!stage||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  stage.className='fx-stage '+kind;$('#fxLabel').textContent=label||'Rufus';
  const p=$('#fxParticles');p.innerHTML='';
  for(let i=0;i<12;i++){const n=document.createElement('i');n.className='fx-particle';const a=Math.random()*Math.PI*2,r=80+Math.random()*220;n.style.setProperty('--x',Math.cos(a)*r+'px');n.style.setProperty('--y',Math.sin(a)*r+'px');n.style.setProperty('--delay',(Math.random()*.12)+'s');p.appendChild(n);}
  void stage.offsetWidth;stage.classList.add('play');setTimeout(()=>stage.classList.remove('play'),900);
}

function acInfo(){
  if(S.linceul.state==='awakened')return {ac:17,label:'Linceul éveillé'};
  if(S.linceul.state==='dormant')return {ac:16,label:'Linceul dormant'};
  return {ac:14,label:'Cuir'};
}
function setConcentration(name,source=''){
  if(S.concentration&&S.concentration.name!==name){
    const ok=confirm('Mettre fin à « '+S.concentration.name+' » pour maintenir « '+name+' » ?');
    if(!ok)return false;
  }
  S.concentration={name,source};
  S.vision.active=name==='Vision de la Vérité';
  return true;
}
function endConcentration(reason=''){
  if(!S.concentration)return;
  const old=S.concentration.name;
  commit('Concentration terminée',old+(reason?' · '+reason:''),()=>{S.concentration=null;S.vision.active=false;});
}
function concentrationCheck(damage){
  if(!S.concentration)return;
  const dc=Math.max(10,Math.floor(Number(damage)/2));const r=die(20),total=r;
  commit('Concentration · '+S.concentration.name,'JdS CON : '+r+' +0 = '+total+' contre DD '+dc+(total>=dc?' · réussite':' · échec'),()=>{
    if(total<dc){S.concentration=null;S.vision.active=false;}
  },total<dc?'raven':null);
}

function changeHp(kind){
  const n=Number(prompt(kind==='damage'?'Dégâts reçus :':'Soins reçus :',''));
  if(!Number.isFinite(n)||n<=0)return;
  if(kind==='damage'){
    const before=S.concentration?.name||null;
    commit('Dégâts reçus',n+' dégâts',()=>{
      let remaining=n;const absorbed=Math.min(S.tempHp,remaining);S.tempHp-=absorbed;remaining-=absorbed;S.hp=clamp(S.hp-remaining,0,S.maxHp);
    },'raven');
    if(before) setTimeout(()=>{if(confirm('Concentration sur « '+before+' ». Lancer le JdS de CON maintenant ?'))concentrationCheck(n);},50);
    if(S.hp===0&&S.linceul.state!=='unequipped'&&S.linceul.judgment)toast('Jugement différé est prêt : Rufus reviendra à 1 PV au début de son prochain tour.');
  }else commit('Soins',n+' PV',()=>{S.hp=clamp(S.hp+n,0,S.maxHp);},'raven');
}
function bindHpInputs(){
  $('#hpInput').addEventListener('change',e=>{const v=clamp(e.target.value,0,53);commit('PV ajustés',S.hp+' → '+v,()=>{S.hp=v;});});
  $('#tempHpInput').addEventListener('change',e=>{const v=clamp(e.target.value,0,999);commit('PV temporaires',S.tempHp+' → '+v,()=>{S.tempHp=v;});});
}
function adjustTempHp(delta){
  const next=clamp(S.tempHp+delta,0,999);if(next===S.tempHp)return;
  commit('PV temporaires',S.tempHp+' → '+next,()=>{S.tempHp=next;});
}

const attacks={
  psychic:{name:'Lame psychique',bonus:7,count:1,sides:6,mod:3,type:'psychiques',cost:'action',finesse:true,psychic:true},
  psychic2:{name:'Seconde lame psychique',bonus:7,count:1,sides:6,mod:3,type:'psychiques',cost:'bonus',finesse:true,psychic:true},
  spectral:{name:'Dague spectrale',bonus:8,count:1,sides:4,mod:4,type:'perforants',cost:'action',finesse:true},
  hexen:{name:'Hexen Blade',bonus:8,count:1,sides:6,mod:4,type:'perforants',cost:'action',finesse:true},
  crossbow:{name:'Arbalète légère duergar',bonus:7,count:1,sides:8,mod:3,type:'perforants',cost:'action',ranged:true}
};
function effectiveRollMode(){
  const situAdv=S.vision.active||(S.conditions.agony&&S.linceul.state==='awakened');
  const adv=S.rollMode==='adv'||situAdv,dis=S.rollMode==='dis';
  return adv&&dis?'normal':adv?'adv':dis?'dis':'normal';
}
function rollAttackD20(mode){
  const manual=clamp($('#manualRoll').value,0,20);
  if(manual>=1&&manual<=20)return {rolls:[manual],nat:manual,manual:true};
  const a=die(20);if(mode==='normal')return {rolls:[a],nat:a};
  const b=die(20);return {rolls:[a,b],nat:mode==='adv'?Math.max(a,b):Math.min(a,b)};
}
function sneakEligible(spec,context){
  if(!(spec.finesse||spec.ranged||spec.psychic))return false;
  if(effectiveRollMode()==='dis')return false;
  const used=context==='reaction'?S.sneakReaction:S.sneakOwn;
  if(used)return false;
  const advantage=effectiveRollMode()==='adv';
  return advantage||S.conditions.allyAdjacent;
}
function breakInvisibilityForAttack(){
  if(S.concentration?.name==='Invisibilité'){
    S.concentration=null;S.vision.active=false;logEvent('Invisibilité terminée','Rufus attaque.');
  }
}
function startAttack(key,context='own'){
  const spec=attacks[key];if(!spec)return;
  const cost=context==='reaction'?'reaction':spec.cost;
  if(cost==='action'&&!S.economy.action)return toast('Action déjà utilisée.');
  if(cost==='bonus'&&!S.economy.bonus)return toast('Action bonus déjà utilisée.');
  if(cost==='reaction'&&!S.economy.reaction)return toast('Réaction déjà utilisée.');
  if(key==='psychic2'&&!S.psychicFollowup)return toast('La seconde dague devient disponible après la première Dague psychique.');
  const mode=effectiveRollMode();const rr=rollAttackD20(mode);$('#manualRoll').value='';
  const bonus=spec.bonus+(key==='crossbow'&&S.sharpshooter?-5:0);
  const total=rr.nat+bonus;
  commit('Jet d’attaque · '+spec.name,(rr.rolls.length>1?rr.rolls.join(' / ')+' → '+rr.nat:rr.nat)+' '+fmt(bonus)+' = '+total+' · '+mode,()=>{
    breakInvisibilityForAttack();
    S.economy[cost]=false;
    if(key==='psychic')S.psychicFollowup=true;
    if(key==='psychic2')S.psychicFollowup=false;
    S.pending={kind:'attack',key,context:context==='reaction'?'reaction':'own',rolls:rr.rolls,nat:rr.nat,total,bonus,mode,luckyRoll:null,ravenRoll:null,guidedPsiRoll:null};
  });
}
function spendLuckyPending(){
  if(!S.pending||S.pending.kind!=='attack')return;
  if(S.lucky<=0)return toast('Plus de points de Chance.');
  const r=die(20),old=S.pending.nat;
  pushHistory();S.lucky--;S.pending.luckyRoll=r;logEvent('Chanceux','Nouveau d20 : '+r+' · jet initial '+old);save();render();
  if(confirm('Chanceux a donné '+r+'. Utiliser ce d20 à la place de '+old+' ?')){
    S.pending.nat=r;S.pending.total=r+S.pending.bonus;save();render();
  }
}
function useRavenPending(){
  if(!S.pending||S.pending.kind!=='attack'||!S.ravenMemoryBonus)return;
  const r=die(8);commit('Ombre du Corbeau','+'+r+' au jet d’attaque',()=>{S.pending.ravenRoll=r;S.pending.total+=r;S.ravenMemoryBonus=false;},'raven');
}
function psiStepDown(size){return size>=8?6:size>=6?4:size>=4?0:0;}
function psiStepUp(size){return size<=0?4:size<=4?6:size<=6?8:8;}
function psiRollWithFlux(){
  if(!S.psiDie)return null;
  const before=S.psiDie,r=die(before);let after=before;
  if(r===before)after=psiStepDown(before);else if(r===1)after=psiStepUp(before);
  return {before,r,after};
}
function usePsiKnack(){
  const rr=psiRollWithFlux();if(!rr)return toast('Dé psionique épuisé.');
  commit('Truc de psi','d'+rr.before+' = '+rr.r+(rr.after!==rr.before?' · dé → '+(rr.after?'d'+rr.after:'épuisé'):''),()=>{S.psiDie=rr.after;S.psiKnackLast='+'+rr.r+' au test maîtrisé · dé '+(rr.after?'d'+rr.after:'épuisé');},'raven');
}
function usePsiWhispers(){
  if(!S.economy.action)return toast('Action déjà utilisée.');
  const rr=psiRollWithFlux();if(!rr)return toast('Dé psionique épuisé.');
  commit('Murmures psychiques',rr.r+' créature'+(rr.r>1?'s':'')+' · télépathie 1 h à 1,5 km'+(rr.after!==rr.before?' · dé → '+(rr.after?'d'+rr.after:'épuisé'):''),()=>{S.economy.action=false;S.psiDie=rr.after;S.psiWhispersLast=rr.r+' créature'+(rr.r>1?'s':'')+' reliée'+(rr.r>1?'s':'');},'raven');
}
function restorePsi(){
  if(!S.psiReconstitutionReady)return toast('Reconstitution du psi déjà utilisée.');
  if(!S.economy.bonus)return toast('Action bonus déjà utilisée.');
  commit('Reconstitution du psi','Dé psionique restauré à d8.',()=>{S.economy.bonus=false;S.psiDie=8;S.psiReconstitutionReady=false;},'raven');
}
function psychicTeleport(){
  if(!S.economy.bonus)return toast('Action bonus déjà utilisée.');
  if(!S.psiDie)return toast('Dé psionique épuisé.');
  const before=S.psiDie,after=psiStepDown(before);
  commit('Téléportation psychique','Jusqu’à 12 m · dé d'+before+' → '+(after?'d'+after:'épuisé'),()=>{S.economy.bonus=false;S.psiDie=after;},'raven');
}
function useGuidedStrikePending(){
  const p=S.pending;if(!p||p.kind!=='attack'||!attacks[p.key]?.psychic||p.nat===1||!S.psiDie)return;
  if(p.guidedPsiRoll)return toast('Frappes autoguidées déjà lancée sur cette attaque.');
  const r=die(S.psiDie);pushHistory();p.guidedPsiRoll=r;p.total+=r;logEvent('Frappes autoguidées','+'+r+' au jet d’attaque · si cela transforme le raté en touche, le dé diminuera.');save();render();
}
function rollDamage(count,sides){const arr=dice(count,sides);return {arr,total:sum(arr)};}
function resolveAttack(hit,useSneak=false){
  const p=S.pending;if(!p||p.kind!=='attack')return;const spec=attacks[p.key];
  if(!hit){
    commit('Attaque ratée · '+spec.name,'Jet '+p.total,()=>{S.pending=null;});
    return;
  }
  const visionCrit=S.vision.active&&p.nat>=17;
  const crit=p.nat===20||visionCrit;
  const multiplier=crit?2:1;
  const base=rollDamage(spec.count*multiplier,spec.sides);
  const sharp=p.key==='crossbow'&&S.sharpshooter?10:0;
  const parts=[base.total+spec.mod+sharp+' '+spec.type];
  let total=base.total+spec.mod+sharp;
  let sneakText='',fireText='';
  const eligible=sneakEligible(spec,p.context);
  if(useSneak&&eligible){
    const sneak=rollDamage(5*multiplier,6);total+=sneak.total;sneakText=sneak.total+' Sournoise';
    if(p.context==='reaction')S.sneakReaction=true;else S.sneakOwn=true;
    if(S.fireBlade.armed&&S.fireBlade.ready){
      const fire=rollDamage(2*multiplier,6);total+=fire.total;fireText=fire.total+' feu';
      S.fireBlade.ready=false;S.fireBlade.armed=false;
    }
  }
  if(sneakText)parts.push(sneakText);if(fireText)parts.push(fireText);
  const detail=total+' dégâts ('+parts.join(' + ')+')'+(crit?' · CRITIQUE':'')+(fireText?' · CON DD16 ou aveuglé':'');
  pushHistory();S.turnDamage+=total;if(p.guidedPsiRoll)S.psiDie=psiStepDown(S.psiDie);S.pending=null;logEvent('Touché · '+spec.name,detail+(p.guidedPsiRoll?' · Frappes autoguidées : dé → '+(S.psiDie?'d'+S.psiDie:'épuisé'):''));save();render();playFx(fireText?'fire':crit?'crit':'raven',crit?'Critique':spec.name);
  toast(detail);
}
function renderPending(){
  const el=$('#pendingAttack');const p=S.pending;
  if(!p){el.hidden=true;el.innerHTML='';return;}
  el.hidden=false;
  if(p.kind==='wound'){
    el.innerHTML='<div class="pending-head"><div><div class="eyebrow">Blessure · attaque de sort à résoudre</div><b>Bonus d’attaque selon validation MJ</b></div></div><div class="pending-details">Une fois le résultat d’attaque connu, confirmez l’issue.</div><h3 class="pending-question">Est-ce que cette attaque touche ?</h3><div class="pending-actions"><button class="primary" data-special-hit="wound">Oui · lancer 3d10</button><button class="ability" data-special-miss="wound">Non · raté</button></div>';
    return;
  }
  const spec=attacks[p.key],eligible=sneakEligible(spec,p.context),critRange=S.vision.active?'17–20':'20';
  const rolls=p.rolls.length>1?p.rolls.join(' / ')+' → '+p.nat:String(p.nat);
  if(p.nat===1){
    el.innerHTML='<div class="pending-head"><div><div class="eyebrow">'+esc(spec.name)+' · '+esc(p.mode)+'</div><div class="pending-roll">'+esc(rolls)+' '+fmt(p.bonus)+' = '+p.total+'</div></div><div class="sneak-badge used">1 naturel</div></div>'+
      '<div class="pending-details">Échec automatique. Chanceux peut encore fournir un autre d20 avant la résolution.</div>'+
      '<h3 class="pending-question">1 naturel · attaque ratée</h3>'+
      '<div class="pending-actions"><button class="ability dangerish" data-miss>Confirmer le raté</button>'+(S.lucky>0?'<button class="ability" data-lucky-pending>Chanceux · '+S.lucky+'/3</button>':'')+'</div>';
    return;
  }
  el.innerHTML='<div class="pending-head"><div><div class="eyebrow">'+esc(spec.name)+' · '+esc(p.mode)+'</div><div class="pending-roll">'+esc(rolls)+' '+fmt(p.bonus)+' = '+p.total+'</div></div><div class="sneak-badge '+(eligible?'':'used')+'">'+(eligible?'Sournoise possible':'Sournoise indisponible')+'</div></div>'+
    '<div class="pending-details">Critique : '+critRange+(p.ravenRoll?' · Ombre +'+p.ravenRoll:'')+(p.luckyRoll?' · Chanceux '+p.luckyRoll:'')+'</div>'+
    '<h3 class="pending-question">Est-ce que cette attaque touche ?</h3>'+
    '<div class="pending-actions">'+
      (eligible?'<button class="primary" data-hit-sneak>Oui · Sournoise 5d6</button>':'')+
      '<button class="ability" data-hit>Oui'+(p.nat===20||S.vision.active&&p.nat>=17?' · critique':'')+'</button>'+
      '<button class="ability dangerish" data-miss>Non · raté</button>'+
      (S.lucky>0?'<button class="ability" data-lucky-pending>Chanceux · '+S.lucky+'/3</button>':'')+
      (spec.psychic&&S.psiDie&&!p.guidedPsiRoll?'<button class="ability" data-guided-psi>Frappes autoguidées · d'+S.psiDie+'</button>':'')+
      (S.ravenMemoryBonus?'<button class="ability" data-raven-pending>Ombre · +1d8</button>':'')+
    '</div>';
}

function useWound(){
  if(!S.woundReady)return toast('Blessure déjà utilisée aujourd’hui.');
  if(!S.economy.action)return toast('Action déjà utilisée.');
  commit('Blessure','1/jour · attaque de sort au contact',()=>{S.economy.action=false;S.woundReady=false;S.pending={kind:'wound'};});
}
function resolveWound(hit){
  if(!S.pending||S.pending.kind!=='wound')return;
  if(!hit)return commit('Blessure ratée','Aucun dégât.',()=>{S.pending=null;});
  const r=rollDamage(3,10);commit('Blessure · touché',r.total+' dégâts nécrotiques ('+r.arr.join('+')+')',()=>{S.turnDamage+=r.total;S.pending=null;},'raven');
}
function useInvisibility(){
  if(!S.invisibilityReady)return toast('Invisibilité déjà utilisée aujourd’hui.');
  if(!S.economy.action)return toast('Action déjà utilisée.');
  if(S.concentration&&S.concentration.name!=='Invisibilité'&&!confirm('Mettre fin à « '+S.concentration.name+' » ?'))return;
  commit('Invisibilité','Concentration jusqu’à 1 h.',()=>{S.economy.action=false;S.invisibilityReady=false;S.concentration={name:'Invisibilité',source:'quotidien'};S.vision.active=false;},'raven');
}
function useVision(){
  if(!S.economy.action)return toast('Action déjà utilisée.');
  const target=$('#visionTarget').value.trim()||'cible';
  if(S.concentration&&S.concentration.name!=='Vision de la Vérité'&&!confirm('Mettre fin à « '+S.concentration.name+' » ?'))return;
  const previous=S.vision.uses,dc=10+previous,r1=die(20),r2=S.vision.wisPenalty>0?die(20):null,r=r2===null?r1:Math.min(r1,r2),total=r+2,failed=total<dc;
  const rollText=r2===null?String(r1):(r1+' / '+r2+' → '+r+' · désavantage Vision');
  commit('Vision de la Vérité','Cible : '+target+' · JdS SAG '+rollText+' +2 = '+total+' / DD '+dc+(failed?' · échec':' · réussite'),()=>{
    S.economy.action=false;S.vision.active=true;S.vision.target=target;S.vision.uses++;if(failed)S.vision.wisPenalty++;
    S.concentration={name:'Vision de la Vérité',source:'pouvoir maison'};
  },'raven');
}
function castHex(name,cost,concentration){
  if(S.hexCharges<cost)return toast('Pas assez de charges Hexen Blade.');
  if(!S.economy.action)return toast('Action déjà utilisée.');
  if(concentration&&S.concentration&&S.concentration.name!==name&&!confirm('Mettre fin à « '+S.concentration.name+' » ?'))return;
  commit('Hexen Blade · '+name,cost+' charge'+(cost>1?'s':''),()=>{
    S.hexCharges-=cost;S.economy.action=false;
    if(concentration){S.concentration={name,source:'Hexen Blade'};S.vision.active=false;}
  },'raven');
}
function hexDawn(logTitle='Aube · Hexen Blade'){
  const gain=die(4)+1,before=S.hexCharges;
  S.hexCharges=clamp(S.hexCharges+gain,0,5);logEvent(logTitle,'1d4+1 = '+gain+' · '+before+' → '+S.hexCharges);
  return gain;
}
function useCunning(name){
  if(!S.economy.bonus)return toast('Action bonus déjà utilisée.');
  commit('Ruse · '+name,'Action bonus',()=>{S.economy.bonus=false;});
}
function useReaction(name='Esquive instinctive'){
  if(!S.economy.reaction)return toast('Réaction déjà utilisée.');
  commit(name,'Réaction consommée.',()=>{S.economy.reaction=false;});
}
function toggleFireBlade(){
  if(!S.fireBlade.ready)return toast('Lame du Feu Caché déjà dépensée aujourd’hui.');
  commit(S.fireBlade.armed?'Lame du Feu Caché désarmée':'Lame du Feu Caché armée','La prochaine Sournoise réussie '+(S.fireBlade.armed?'ne consommera pas':'consommera')+' le pouvoir.',()=>{S.fireBlade.armed=!S.fireBlade.armed;},S.fireBlade.armed?null:'fire');
}
function spendLucky(){
  if(S.lucky<=0)return toast('Plus de points de Chance.');
  const r=die(20);commit('Chanceux','d20 supplémentaire : '+r,()=>{S.lucky--;});
  toast('Chanceux : '+r+' — choisissez le d20 à utiliser selon la situation.');
}
function useLinceul(kind){
  if(S.linceul.state==='unequipped')return toast('Le Linceul n’est pas équipé.');
  if(['ravenShadow','pilgrim'].includes(kind)&&S.linceul.state!=='awakened')return toast('Pouvoir disponible uniquement à l’état Éveillé.');
  const labels={judgment:'Jugement différé',lastBreath:'Langue du Dernier Souffle',ravenShadow:'Ombre du Corbeau',pilgrim:'Corbeau Pèlerin'};
  if(kind==='judgment'&&!S.linceul.judgment)return toast('Jugement différé déjà dépensé.');
  if(kind==='lastBreath'&&!S.linceul.lastBreath)return toast('Langue du Dernier Souffle déjà utilisée aujourd’hui.');
  if(kind==='ravenShadow'&&S.linceul.ravenShadow<=0)return toast('Ombre du Corbeau déjà dépensée.');
  if(kind==='pilgrim'&&!S.linceul.pilgrim)return toast('Corbeau Pèlerin déjà utilisé.');
  commit(labels[kind],kind==='ravenShadow'?'+1d8 au prochain jet d’attaque ou sauvegarde.':'Pouvoir du Linceul consommé.',()=>{
    if(kind==='judgment')S.linceul.judgment=false;
    if(kind==='lastBreath')S.linceul.lastBreath=false;
    if(kind==='ravenShadow'){S.linceul.ravenShadow=Math.max(0,S.linceul.ravenShadow-1);S.ravenMemoryBonus=true;}
    if(kind==='pilgrim')S.linceul.pilgrim=false;
  },'raven');
}
function shortRest(){
  commit('Repos court','Économie du tour restaurée. Le dé psionique et Reconstitution du psi ne se restaurent pas au repos court.',()=>{
    S.economy={action:true,bonus:true,reaction:true,move:true};S.turnDamage=0;S.pending=null;S.psychicFollowup=false;
    if(S.concentration){S.concentration=null;S.vision.active=false;}
  });
}
function longRest(){
  if(!confirm('Effectuer un repos long ? Les ressources / repos long seront restaurées.'))return;
  commit('Repos long','PV, Chanceux, dé psionique d8, Reconstitution du psi, Vision, Lame du Feu Caché et ressources / repos long restaurés.',()=>{
    S.hp=53;S.tempHp=0;S.lucky=3;S.psiDie=8;S.psiReconstitutionReady=true;S.fireBlade={ready:true,armed:false};S.vision={active:false,target:'',uses:0,wisPenalty:0};
    S.linceul.judgment=true;S.linceul.ravenShadow=2;S.linceul.pilgrim=true;S.ravenMemoryBonus=false;
    S.economy={action:true,bonus:true,reaction:true,move:true};S.sneakOwn=false;S.sneakReaction=false;S.psychicFollowup=false;S.turnDamage=0;S.concentration=null;S.pending=null;
  },'raven');
}
function newDay(){
  commit('Nouveau jour','Blessure, Invisibilité, Langue du Dernier Souffle et recharge Hexen.',()=>{
    S.woundReady=true;S.invisibilityReady=true;S.linceul.lastBreath=true;hexDawn('Recharge Hexen Blade');
  });
}
function nextTurn(){
  commit('Tour suivant','Économie du tour restaurée.',()=>{
    S.turn++;S.round++;
    S.turnDamage=0;S.economy={action:true,bonus:true,reaction:true,move:true};S.sneakOwn=false;S.sneakReaction=false;S.psychicFollowup=false;S.conditions.allyAdjacent=false;S.conditions.agony=false;S.pending=null;
  });
  if(S.hp===0&&S.linceul.state!=='unequipped'&&S.linceul.judgment){
    commit('Jugement différé','Rufus revient automatiquement à 1 PV au début de son tour.',()=>{S.hp=1;S.linceul.judgment=false;},'raven');
  }
}

const abilities=[
  {name:'Force',abbr:'FOR',score:8,mod:-1,save:-1,prof:false},
  {name:'Dextérité',abbr:'DEX',score:16,mod:3,save:7,prof:true},
  {name:'Constitution',abbr:'CON',score:10,mod:0,save:0,prof:false},
  {name:'Intelligence',abbr:'INT',score:13,mod:1,save:5,prof:true},
  {name:'Sagesse',abbr:'SAG',score:14,mod:2,save:2,prof:false},
  {name:'Charisme',abbr:'CHA',score:16,mod:3,save:3,prof:false}
];
const skills=[
  ['Athlétisme','FOR',-1,''],['Acrobaties','DEX',7,'Maîtrise'],['Discrétion','DEX',11,'Expertise'],['Escamotage','DEX',7,'Maîtrise'],
  ['Arcanes','INT',1,''],['Histoire','INT',1,''],['Investigation','INT',5,'Maîtrise'],['Nature','INT',1,''],['Religion','INT',1,''],
  ['Dressage','SAG',2,''],['Intuition','SAG',2,''],['Médecine','SAG',2,''],['Perception','SAG',6,'Maîtrise'],['Survie','SAG',2,''],
  ['Intimidation','CHA',7,'Maîtrise'],['Persuasion','CHA',11,'Expertise'],['Représentation','CHA',3,''],['Tromperie','CHA',7,'Maîtrise']
];
function socialRoll(label,bonus,isSave=false,ability=''){
  const visionDis=ability==='SAG'&&S.vision.wisPenalty>0;
  const mode=visionDis?(S.socialMode==='adv'?'normal':'dis'):S.socialMode;
  const a=die(20),b=mode==='normal'?null:die(20),chosen=mode==='adv'?Math.max(a,b):mode==='dis'?Math.min(a,b):a;
  let raven=0;if(isSave&&S.ravenMemoryBonus&&confirm('Utiliser le +1d8 d’Ombre du Corbeau sur ce JdS ?')){raven=die(8);pushHistory();S.ravenMemoryBonus=false;}
  const total=chosen+bonus+raven,details=(b===null?'d20 '+a:'d20 '+a+' / '+b+' → '+chosen)+' '+fmt(bonus)+(raven?' + Ombre '+raven:'')+' = '+total+(visionDis?' · Vision : désavantage SAG ('+S.vision.wisPenalty+')':'');
  logEvent('Social · '+label,details);save();renderSocial();const out=$('#socialResult');out.hidden=false;out.textContent=label+' : '+details;
}
function renderSocial(){
  const c=$('#socialContent');if(!c)return;const tab=S.ui.socialTab;
  $('[data-social-tab]').forEach(b=>b.classList.toggle('active',b.dataset.socialTab===tab));
  $$('[data-social-mode]').forEach(b=>b.classList.toggle('on',b.dataset.socialMode===S.socialMode));
  const inventoryMode=tab==='inventory';$('#socialSheetPane').hidden=inventoryMode;$('#socialInventoryPane').hidden=!inventoryMode;if(inventoryMode){renderInventory();return;}
  if(tab==='skills'){
    c.innerHTML='<div class="social-passives"><span>Perception passive <b>16</b></span><span>Intuition passive <b>12</b></span><span>Investigation passive <b>15</b></span><span>Maîtrise <b>+4</b></span></div><div class="skills-grid">'+skills.map((s,i)=>'<button class="skill-btn '+(s[3]==='Expertise'?'expert':'')+'" data-skill="'+i+'"><span><b>'+esc(s[0])+'</b><small>'+s[1]+(s[3]?' · '+s[3]:'')+'</small></span><strong>'+fmt(s[2])+'</strong></button>').join('')+'</div>';
    $$('[data-skill]',c).forEach(b=>b.onclick=()=>{const s=skills[Number(b.dataset.skill)];socialRoll(s[0],s[2],false,s[1]);});
  }else if(tab==='abilities'){
    c.innerHTML='<div class="social-passives"><span>JdS maîtrisés <b>DEX, INT</b></span><span>DEX <b>16</b></span><span>CHA <b>16</b></span></div><div class="abilities-grid">'+abilities.map((a,i)=>'<div class="ability-card"><div class="ability-card-head"><div><span>'+a.abbr+'</span><h3>'+a.name+'</h3></div><strong>'+a.score+'</strong></div><div class="ability-values"><span>Mod.<b>'+fmt(a.mod)+'</b></span><span>Test<b>'+fmt(a.mod)+'</b></span><span class="'+(a.prof?'proficient':'')+'">JdS<b>'+fmt(a.save)+'</b></span></div><div class="ability-actions"><button class="ability" data-check="'+i+'">Tester</button><button class="ability" data-save="'+i+'">JdS</button></div></div>').join('')+'</div>';
    $$('[data-check]',c).forEach(b=>b.onclick=()=>{const a=abilities[Number(b.dataset.check)];socialRoll('Test de '+a.name,a.mod,false,a.abbr);});
    $$('[data-save]',c).forEach(b=>b.onclick=()=>{const a=abilities[Number(b.dataset.save)];socialRoll('JdS de '+a.name,a.save,true,a.abbr);});
  }else{
    c.innerHTML='<div class="rp-grid"><div class="rp-box"><b>Langues</b><span>Commun · Elfique · jargon des voleurs</span></div><div class="rp-box"><b>Outils</b><span>Outils de voleur · déguisement · contrefaçon</span></div><div class="rp-box"><b>Rôle</b><span>Éclaireur · infiltration · burst mono-cible · visage social</span></div><div class="rp-box"><b>Identité</b><span>Rufus « Le Renard » · Ruvius D. Medani</span></div><div class="rp-box"><b>Âme Acérée</b><span>Talent psionique, télépathie et mobilité psychique.</span></div><div class="rp-box"><b>Résistance</b><span>Collier : résistance aux dégâts nécrotiques.</span></div></div>';
  }
}

function inferItemIcon(i){
  if(i.icon&&i.icon!=='auto'&&inventoryIcons[i.icon])return i.icon;
  const n=(i.name||'').toLowerCase();
  if(/linceul|corbeau/.test(n))return 'raven';
  if(/dague|hexen|lame/.test(n))return 'blade';
  if(/arbal|arc/.test(n))return 'bow';
  if(/armure|cuir/.test(n))return 'armor';
  if(/venin|poison|sérum/.test(n))return 'poison';
  if(/bague/.test(n))return 'ring';
  if(/chausson|botte/.test(n))return 'boots';
  if(/amulette/.test(n))return 'amulet';
  if(/sac/.test(n))return 'bag';
  if(/globe/.test(n))return 'globe';
  if(/éléphant|elephant/.test(n))return 'elephant';
  if(/déguis|contrefa/.test(n))return 'disguise';
  if(/carreau|flèche|munition/.test(n))return 'ammo';
  return i.category==='equipment'?'blade':i.category==='consumable'?'poison':'misc';
}
function itemVisual(i){
  if(i.image)return '<img alt="" src="'+esc(i.image)+'" loading="lazy">';
  return '<span aria-hidden="true">'+esc(inventoryIcons[inferItemIcon(i)]||'✦')+'</span>';
}
function renderInventory(){
  const grid=$('#inventoryGrid');if(!grid)return;
  $$('.inventory-tabs button').forEach(b=>b.classList.toggle('on',b.dataset.inventoryTab===S.inventoryTab));
  const term=($('#inventorySearch')?.value||'').trim().toLowerCase();
  const rows=S.inventory.map((i,index)=>({i,index})).filter(x=>x.i.category===S.inventoryTab&&(!term||(x.i.name+' '+x.i.note).toLowerCase().includes(term)));
  const count=$('#inventoryCount');if(count)count.textContent=rows.length+' objet'+(rows.length>1?'s':'');
  grid.innerHTML=rows.length?rows.map(({i,index})=>
    '<details class="inventory-object '+(i.equipped?'active':'')+'">'+
      '<summary><span class="inventory-object-icon">'+itemVisual(i)+'</span>'+
      '<span class="inventory-object-name"><b>'+esc(i.name)+'</b><small>'+esc(inventoryCategoryLabels[i.category]||'Objet')+'</small>'+(i.equipped?'<span class="equipped-mark">ACTIF</span>':'')+'</span>'+
      '<span class="inventory-qty">× '+i.qty+'</span><span class="inventory-chevron">⌄</span></summary>'+
      '<div class="inventory-object-body"><p>'+esc(i.note||'Aucune note.')+'</p><div class="inventory-object-actions"><span class="qty-label">Quantité : <b>'+i.qty+'</b></span><button class="ability" data-item-dec="'+index+'">−</button><button class="ability" data-item-inc="'+index+'">＋</button><button class="ability" data-edit-item="'+index+'">Modifier</button></div></div>'+
    '</details>'
  ).join(''):'<p class="meta">Aucun objet dans cette catégorie.</p>';
  $$('[data-edit-item]',grid).forEach(b=>b.onclick=e=>{e.preventDefault();openItemEditor(Number(b.dataset.editItem));});
  $$('[data-item-dec]',grid).forEach(b=>b.onclick=e=>{e.preventDefault();const index=Number(b.dataset.itemDec),i=S.inventory[index];if(!i)return;i.qty=Math.max(0,i.qty-1);logEvent('Inventaire · '+i.name,'Quantité '+i.qty);save();renderInventory();renderResultRibbon();});
  $$('[data-item-inc]',grid).forEach(b=>b.onclick=e=>{e.preventDefault();const index=Number(b.dataset.itemInc),i=S.inventory[index];if(!i)return;i.qty=Math.min(999,i.qty+1);logEvent('Inventaire · '+i.name,'Quantité '+i.qty);save();renderInventory();renderResultRibbon();});
  const loadout=$('#inventoryLoadout');if(loadout){
    const priority=['Dague spectrale','Hexen Blade','Linceul du Jugement Noir','Amulette de résistance occulte','Arbalète légère duergar','Chaussons araignée'];
    const chosen=[];
    priority.forEach(name=>{const index=S.inventory.findIndex(i=>i.name===name);if(index>=0&&!chosen.some(x=>x.index===index))chosen.push({i:S.inventory[index],index});});
    S.inventory.forEach((i,index)=>{if(i.equipped&&!chosen.some(x=>x.index===index))chosen.push({i,index});});
    loadout.innerHTML=chosen.slice(0,4).map(({i,index})=>
      '<button class="loadout-item" type="button" data-loadout-item="'+index+'"><span class="loadout-icon">'+itemVisual(i)+'</span><small>'+(i.equipped?'Équipé / actif':'Signature')+'</small><b>'+esc(i.name)+'</b><p>'+esc(i.note||'')+'</p>'+(i.equipped?'<span class="active-dot">ACTIF</span>':'')+'</button>'
    ).join('');
    $$('[data-loadout-item]',loadout).forEach(b=>b.onclick=()=>openItemEditor(Number(b.dataset.loadoutItem)));
  }
}
function openItemEditor(index=-1){
  const f=$('#itemEditor');f.hidden=false;f.reset();f.elements.index.value=index;
  const i=index>=0?S.inventory[index]:{name:'',category:S.inventoryTab,qty:1,note:'',image:'',icon:'auto',equipped:false};
  f.elements.name.value=i.name;f.elements.category.value=i.category;f.elements.qty.value=i.qty;f.elements.note.value=i.note;f.elements.image.value=i.image;f.elements.icon.value=i.icon||'auto';f.elements.equipped.checked=i.equipped;
  $('#itemEditorTitle').textContent=index>=0?'Modifier · '+i.name:'Ajouter un objet';
  $('#deleteItemBtn').hidden=index<0;
  setTimeout(()=>f.elements.name.focus(),30);
}
function closeItemEditor(){$('#itemEditor').hidden=true;}
function saveItem(e){
  e.preventDefault();const f=e.currentTarget,index=Number(f.elements.index.value);
  const item=sanitizeItem({name:f.elements.name.value,category:f.elements.category.value,qty:parseInt(f.elements.qty.value,10),note:f.elements.note.value,image:f.elements.image.value,icon:f.elements.icon.value,equipped:f.elements.equipped.checked});
  if(!item.name.trim())return;
  if(index>=0)S.inventory[index]=item;else S.inventory.push(item);
  logEvent(index>=0?'Objet modifié':'Objet ajouté',item.name);save();closeItemEditor();renderInventory();renderJournal();renderResultRibbon();
}
function deleteItem(){
  const index=Number($('#itemEditor').elements.index.value);if(index<0)return;if(!confirm('Supprimer cet objet ?'))return;
  const name=S.inventory[index]?.name||'Objet';S.inventory.splice(index,1);logEvent('Objet supprimé',name);save();closeItemEditor();renderInventory();renderJournal();renderResultRibbon();
}
function pickImage(){$('#imageFile').click();}
function handleImage(file){
  if(!file||!file.type.startsWith('image/'))return;if(file.size>260000)return toast('Image trop lourde : 260 ko max pour protéger localStorage.');
  const r=new FileReader();r.onload=()=>{$('#itemEditor').elements.image.value=String(r.result||'').slice(0,350000);toast('Image ajoutée à l’objet.');};r.readAsDataURL(file);
}

function renderJournal(){
  const list=$('#journalList');if(!list)return;
  list.innerHTML=S.journal.length?S.journal.map(e=>'<div class="journal-entry"><small>'+esc(e.time)+'</small><b>'+esc(e.title)+'</b><p>'+esc(e.detail||'')+'</p></div>').join(''):'<p class="meta">Le journal mécanique est vide.</p>';
  $('#notesInput').value=S.notes;
  $('#notesInput').hidden=!!S.notesPreview;$('#notesPreview').hidden=!S.notesPreview;$('#togglePreviewBtn').textContent=S.notesPreview?'Éditer':'Aperçu';
  if(S.notesPreview)$('#notesPreview').innerHTML=renderNotePreview(S.notes);
}
function renderNotePreview(text){
  return esc(text).split('\n').map(line=>{
    if(/^###\s/.test(line))return '<b>'+line.replace(/^###\s/,'')+'</b>';
    if(/^##\s/.test(line))return '<h3>'+line.replace(/^##\s/,'')+'</h3>';
    if(/^#\s/.test(line))return '<h2>'+line.replace(/^#\s/,'')+'</h2>';
    if(/^[-*]\s/.test(line))return '• '+line.replace(/^[-*]\s/,'');
    return line||'&nbsp;';
  }).join('<br>');
}
function download(name,body,type='application/json'){
  const url=URL.createObjectURL(new Blob([body],{type})),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function exportData(){download('Rufus-Companion-V3.json',JSON.stringify({format:'rufus-companion-v3',schema:4,exportedAt:new Date().toISOString(),state:S},null,2));logEvent('Export JSON','Sauvegarde complète exportée.');save();renderJournal();}
function exportNotes(){
  const mechanics=S.journal.slice().reverse().map(e=>'- '+e.time+' · '+e.title+(e.detail?' — '+e.detail:'')).join('\n');
  const body='# Rufus — Notes de session\n\n'+(S.notes||'_Aucune note libre._')+'\n\n## Journal mécanique\n\n'+(mechanics||'_Journal vide._')+'\n';
  download('Rufus-Notes-Session.md',body,'text/markdown');
  logEvent('Export Markdown','Notes de session et journal mécanique exportés.');save();renderJournal();
}
function exportInventory(){
  download('Rufus-Inventaire-V3.json',JSON.stringify({format:'rufus-inventory-v3',schema:2,items:S.inventory},null,2));
}
function importInventory(file){
  if(!file)return;const r=new FileReader();r.onload=()=>{
    try{
      const x=JSON.parse(r.result),items=x?.format==='rufus-inventory-v3'?x.items:x?.items;
      if(!Array.isArray(items))throw Error('items');
      localStorage.setItem(BACKUP,JSON.stringify(S));S.inventory=items.slice(0,200).map(sanitizeItem);logEvent('Inventaire importé',S.inventory.length+' objets.');save();render();
      toast('Inventaire importé.');
    }catch{toast('Import inventaire refusé : fichier incompatible.');}
  };r.readAsText(file);
}
function importData(file){
  if(!file)return;const r=new FileReader();r.onload=()=>{
    try{
      const x=JSON.parse(r.result);const incoming=x?.format==='rufus-companion-v3'?x.state:x;
      localStorage.setItem(BACKUP,JSON.stringify(S));S=normalize(incoming);S.pending=null;save();render();toast('Import terminé. Une copie précédente est disponible.');
    }catch(e){toast('Import refusé : fichier incompatible.');}
  };r.readAsText(file);
}
function restoreBackup(){
  try{const raw=localStorage.getItem(BACKUP);if(!raw)return toast('Aucune copie disponible.');const current=JSON.stringify(S);S=normalize(JSON.parse(raw));localStorage.setItem(BACKUP,current);save();render();toast('Copie restaurée.');}catch{toast('Copie illisible.');}
}
function resetAll(){
  if(!confirm('Remettre Rufus à zéro ? Un backup de l’état actuel sera conservé.'))return;
  try{localStorage.setItem(BACKUP,JSON.stringify(S));}catch{}S=defaults();save();render();toast('État initial restauré.');
}

function renderSubtabs(group){
  const root=$('[data-subtabs="'+group+'"]');if(!root)return;const selected=S.ui.subtabs?.[group]||root.querySelector('.subtab')?.dataset.subtab;
  root.querySelectorAll('.subtab').forEach(b=>b.classList.toggle('active',b.dataset.subtab===selected));
  const view=$('#'+group);if(view)view.querySelectorAll(':scope > .subpane').forEach(p=>p.classList.toggle('active',p.dataset.subpane===selected));
}
function setSubtab(group,id){
  S.ui.subtabs=S.ui.subtabs||{};S.ui.subtabs[group]=id;save();renderSubtabs(group);window.scrollTo({top:0,behavior:'instant'});
}
function switchView(id){
  S.ui.view=id;$('.nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===id));$('.view').forEach(v=>v.classList.toggle('active',v.id===id));save();
  if(id==='social')renderSocial();if(id==='journal')renderJournal();if(['combat','arsenal','journal'].includes(id))renderSubtabs(id);window.scrollTo({top:0,behavior:'instant'});
}
function render(){
  const ac=acInfo();$('#hpInput').value=S.hp;$('#tempHpInput').value=S.tempHp;$('#maxHpValue').textContent=S.maxHp;$('#acValue').textContent=ac.ac;$('#acLabel').textContent=ac.label;
  $('#turnNo').textContent=S.turn;$('#roundNo').textContent=S.round;$('#turnDamageValue').textContent=S.turnDamage;
  $('#mobileHp').textContent=S.hp+'/'+S.maxHp;$('#mobileTempHp').textContent=S.tempHp;$('#mobileAc').textContent=ac.ac;$('#mobileTurn').textContent=S.turn;$('#mobileTurnDamage').textContent=S.turnDamage;
  $('#mobileConcentration').classList.toggle('none',!S.concentration);$('#mobileConcText').textContent=S.concentration?S.concentration.name:'Aucune';
  $('[data-mobile-econ]').forEach(b=>{const k=b.dataset.mobileEcon,on=!!S.economy[k];b.classList.toggle('free',on);b.classList.toggle('used',!on);});
  $$('.economy').forEach(b=>{const k=b.dataset.econ,on=!!S.economy[k];b.classList.toggle('used',!on);const sm=$('small',b);if(sm)sm.textContent=k==='move'?(on?'9 m':'utilisé'):(on?'disponible':'utilisée');});
  const conc=S.concentration;$('#turnConcentration').classList.toggle('none',!conc);$('#turnConcText').textContent=conc?conc.name:'Aucune';
  $$('.nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===S.ui.view));$$('.view').forEach(v=>v.classList.toggle('active',v.id===S.ui.view));
  $$('[data-roll-mode]').forEach(b=>b.classList.toggle('on',b.dataset.rollMode===S.rollMode));
  $$('[data-cond]').forEach(b=>{const k=b.dataset.cond;b.classList.toggle('on',!!S.conditions[k]);if(k==='agony')b.disabled=S.linceul.state!=='awakened';});
  $('#sharpshooterToggle').classList.toggle('on',S.sharpshooter);$('#crossbowDice').textContent=(S.sharpshooter?'+2 · 1d8+13 perforants':'+7 · 1d8+3 perforants');
  const sneakAvailable=!S.sneakOwn;$('#sneakBadge').classList.toggle('used',!sneakAvailable);$('#sneakBadge').textContent=sneakAvailable?'5d6 prêts':'Dépensée';$('#sneakStatus').textContent=sneakAvailable?'Disponible · avantage ou allié adjacent.':'Utilisée sur le tour de Rufus · réaction suivie séparément.';
  $$('[data-attack]').forEach(b=>{const a=attacks[b.dataset.attack];const actionUsed=a.cost==='action'&&!S.economy.action,bonusUsed=a.cost==='bonus'&&!S.economy.bonus,followup=a.cost==='bonus'&&b.dataset.attack==='psychic2'&&!S.psychicFollowup;b.disabled=actionUsed||bonusUsed||followup;b.title=actionUsed?'Action déjà utilisée':bonusUsed?'Action bonus déjà utilisée':followup?'Disponible après la première Dague psychique':'';});
  $$('.reaction-attack,.reaction-action').forEach(b=>{b.disabled=!S.economy.reaction;b.title=b.disabled?'Réaction déjà utilisée':'';});$$('.bonus-action').forEach(b=>{b.disabled=!S.economy.bonus;b.title=b.disabled?'Action bonus déjà utilisée':'';});
  $('#fireBladeBtn').disabled=!S.fireBlade.ready;$('#fireBladeBtn').textContent=S.fireBlade.armed?'Désarmer':'Armer Lame du Feu Caché';$('#fireBladeStatus').className='status-line '+(S.fireBlade.armed?'hot':'');$('#fireBladeStatus').textContent=!S.fireBlade.ready?'Dépensée aujourd’hui.':S.fireBlade.armed?'ARMÉE · la prochaine Sournoise réussie déclenchera +2d6 feu.':'Disponible · non armée.';
  $('#visionTarget').value=S.vision.target||'';$('#visionBtn').disabled=!S.economy.action;$('#visionStatus').className='status-line '+(S.vision.active?'active':'');$('#visionStatus').textContent=(S.vision.active?'ACTIVE sur '+(S.vision.target||'cible')+' · avantage · critique 17–20. ':'Inactive. ')+'Utilisations depuis repos long : '+S.vision.uses+' · pénalités SAG : '+S.vision.wisPenalty;
  $('#woundBtn').disabled=!S.woundReady||!S.economy.action;$('#woundBtn').textContent=S.woundReady?'Utiliser':'Dépensé aujourd’hui';$('#invisibilityBtn').disabled=!S.invisibilityReady||!S.economy.action;$('#invisibilityBtn').textContent=S.invisibilityReady?'Lancer':'Dépensée aujourd’hui';
  $('#hexCharges').textContent=S.hexCharges;$$('.hex-spell').forEach(b=>b.disabled=!S.economy.action||S.hexCharges<Number(b.dataset.cost));
  $('#linceulState').value=S.linceul.state;const li=acInfo();$('#linceulSummary').innerHTML='<div><small>CA actuelle</small><b>'+li.ac+' · '+esc(li.label)+'</b></div><div><small>Jugement différé</small><b>'+(S.linceul.judgment?'prêt':'dépensé')+'</b></div><div><small>Ombre du Corbeau</small><b>'+(S.linceul.state==='awakened'?(S.linceul.ravenShadow+' / 2'):'verrouillée')+'</b></div>';
  $$('.awakened-only').forEach(x=>x.classList.toggle('locked',S.linceul.state!=='awakened'));
  $$('.linceul-use').forEach(b=>{const k=b.dataset.linceulUse;let disabled=S.linceul.state==='unequipped';if(k==='judgment')disabled||=!S.linceul.judgment;if(k==='lastBreath')disabled||=!S.linceul.lastBreath;if(k==='ravenShadow')disabled||=S.linceul.state!=='awakened'||S.linceul.ravenShadow<=0;if(k==='pilgrim')disabled||=S.linceul.state!=='awakened'||!S.linceul.pilgrim;b.disabled=disabled;});
  $('#luckValue').textContent=S.lucky+' / 3';$('#luckPips').innerHTML=[0,1,2].map(i=>'<button class="pip '+(i<S.lucky?'':'off')+'" aria-label="Point de Chance '+(i+1)+'"></button>').join('');$('#luckSpendBtn').disabled=S.lucky<=0;
  $('#psiDieValue').textContent=S.psiDie?'d'+S.psiDie:'épuisé';if($('#psiDieHeroValue'))$('#psiDieHeroValue').textContent=S.psiDie?'d'+S.psiDie:'épuisé';$('[data-psi]').forEach(b=>b.classList.toggle('on',Number(b.dataset.psi)===S.psiDie));
  if($('#psiKnackResult'))$('#psiKnackResult').textContent=S.psiKnackLast||'Prêt.';if($('#psiWhispersResult'))$('#psiWhispersResult').textContent=S.psiWhispersLast||'Prêt.';
  if($('#psiRestoreBtn'))$('#psiRestoreBtn').disabled=!S.psiReconstitutionReady||!S.economy.bonus;if($('#psiRestoreStatus'))$('#psiRestoreStatus').textContent=S.psiReconstitutionReady?'Prête · 1/repos long':'Dépensée jusqu’au repos long';
  if($('#psiTeleportBtn'))$('#psiTeleportBtn').disabled=!S.economy.bonus||!S.psiDie;if($('#psiWhispersBtn'))$('#psiWhispersBtn').disabled=!S.economy.action||!S.psiDie;if($('#psiKnackBtn'))$('#psiKnackBtn').disabled=!S.psiDie;
  renderPending();renderSocial();renderInventory();renderJournal();renderResultRibbon();renderSubtabs('combat');renderSubtabs('arsenal');renderSubtabs('journal');
}

function bind(){
  $('.nav [data-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.view)));
  $('[data-subtabs]').forEach(root=>root.querySelectorAll('.subtab').forEach(b=>b.onclick=()=>setSubtab(root.dataset.subtabs,b.dataset.subtab)));
  $('.economy').forEach(b=>b.addEventListener('click',()=>{const k=b.dataset.econ;commit('Économie · '+k,S.economy[k]?'marquée utilisée':'rendue disponible',()=>{S.economy[k]=!S.economy[k];});}));
  $('[data-mobile-econ]').forEach(b=>b.onclick=()=>{const k=b.dataset.mobileEcon;commit('Économie · '+k,S.economy[k]?'marquée utilisée':'rendue disponible',()=>{S.economy[k]=!S.economy[k];});});
  $('#damageBtn').onclick=$('#mobileDamage').onclick=()=>changeHp('damage');$('#healBtn').onclick=$('#mobileHeal').onclick=()=>changeHp('heal');bindHpInputs();
  $('#tempHpMinus').onclick=$('#mobileTempMinus').onclick=()=>adjustTempHp(-1);$('#tempHpPlus').onclick=$('#mobileTempPlus').onclick=()=>adjustTempHp(1);
  $('#nextTurn').onclick=$('#mobileNextTurn').onclick=nextTurn;const stopConc=()=>{if(S.concentration&&confirm('Mettre fin à « '+S.concentration.name+' » ?'))endConcentration('arrêt manuel');};$('#turnConcentration').onclick=stopConc;$('#mobileConcentration').onclick=stopConc;
  $$('[data-roll-mode]').forEach(b=>b.onclick=()=>{S.rollMode=b.dataset.rollMode;save();render();});
  $$('[data-cond]').forEach(b=>b.onclick=()=>{const k=b.dataset.cond;if(k==='agony'&&S.linceul.state!=='awakened')return;S.conditions[k]=!S.conditions[k];save();render();});
  $('#sharpshooterToggle').onclick=()=>{S.sharpshooter=!S.sharpshooter;save();render();};
  $$('[data-attack]').forEach(b=>b.onclick=()=>startAttack(b.dataset.attack,'own'));$$('[data-reaction-attack]').forEach(b=>b.onclick=()=>startAttack(b.dataset.reactionAttack,'reaction'));
  $('#pendingAttack').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.hasAttribute('data-hit-sneak'))resolveAttack(true,true);else if(b.hasAttribute('data-hit'))resolveAttack(true,false);else if(b.hasAttribute('data-miss'))resolveAttack(false,false);else if(b.hasAttribute('data-lucky-pending'))spendLuckyPending();else if(b.hasAttribute('data-guided-psi'))useGuidedStrikePending();else if(b.hasAttribute('data-raven-pending'))useRavenPending();else if(b.hasAttribute('data-special-hit'))resolveWound(true);else if(b.hasAttribute('data-special-miss'))resolveWound(false);});
  $$('[data-cunning]').forEach(b=>b.onclick=()=>useCunning(b.dataset.cunning));$$('.reaction-action').forEach(b=>b.onclick=()=>useReaction(b.textContent.trim().split('·')[0].trim()));
  $('#fireBladeBtn').onclick=toggleFireBlade;$('#visionBtn').onclick=useVision;$('#woundBtn').onclick=useWound;$('#invisibilityBtn').onclick=useInvisibility;
  $$('.hex-spell').forEach(b=>b.onclick=()=>castHex(b.dataset.hexSpell,Number(b.dataset.cost),b.dataset.concentration==='true'));
  $('#hexDawnBtn').onclick=()=>commit('Aube · Hexen Blade','Recharge 1d4+1.',()=>{hexDawn();});
  $('#linceulState').onchange=e=>commit('Linceul · état','État : '+e.target.value,()=>{S.linceul.state=e.target.value;if(e.target.value!=='awakened')S.conditions.agony=false;});
  $$('.linceul-use').forEach(b=>b.onclick=()=>useLinceul(b.dataset.linceulUse));$('#luckSpendBtn').onclick=spendLucky;
  $$('[data-psi]').forEach(b=>b.onclick=()=>commit('Dé psychique','Suivi manuel : '+(b.dataset.psi==='0'?'épuisé':'d'+b.dataset.psi),()=>{S.psiDie=Number(b.dataset.psi);}));
  $('#shortRestBtn').onclick=shortRest;$('#longRestBtn').onclick=longRest;$('#quickShortRestBtn').onclick=shortRest;$('#quickLongRestBtn').onclick=longRest;$('#mobileShortRest').onclick=shortRest;$('#mobileLongRest').onclick=longRest;$('#newDayBtn').onclick=newDay;$('#undoBtn').onclick=undo;
  $('#psiKnackBtn').onclick=usePsiKnack;$('#psiWhispersBtn').onclick=usePsiWhispers;$('#psiRestoreBtn').onclick=restorePsi;$('#psiTeleportBtn').onclick=psychicTeleport;
  $('[data-social-mode]').forEach(b=>b.onclick=()=>{S.socialMode=b.dataset.socialMode;save();renderSocial();});$('[data-social-tab]').forEach(b=>b.onclick=()=>{S.ui.socialTab=b.dataset.socialTab;save();renderSocial();});
  $('.inventory-tabs button').forEach(b=>b.onclick=()=>{S.inventoryTab=b.dataset.inventoryTab;save();renderInventory();});$('#inventorySearch').oninput=renderInventory;$('#addItemBtn').onclick=()=>openItemEditor(-1);$('#itemEditor').onsubmit=saveItem;$('#deleteItemBtn').onclick=deleteItem;$('#closeItemBtn').onclick=closeItemEditor;$('#pickImageBtn').onclick=pickImage;$('#imageFile').onchange=e=>handleImage(e.target.files?.[0]);
  $('#ribbonUndo').onclick=undo;$('#ribbonToggle').onclick=()=>$('#resultRibbon').classList.toggle('collapsed');$('#resultRibbon').addEventListener('click',e=>{if(e.target.closest('button'))return;if($('#resultRibbon').classList.contains('collapsed'))$('#resultRibbon').classList.remove('collapsed');});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!$('#itemEditor').hidden)closeItemEditor();});
  $('#notesInput').addEventListener('input',e=>{S.notes=e.target.value.slice(0,150000);save();});$('#togglePreviewBtn').onclick=()=>{S.notesPreview=!S.notesPreview;save();renderJournal();};
  $('#clearJournalBtn').onclick=()=>{if(confirm('Vider le journal mécanique ?')){S.journal=[];save();renderJournal();}};
  $('#inventoryExportBtn').onclick=exportInventory;$('#inventoryImportBtn').onclick=()=>$('#inventoryImportFile').click();$('#inventoryImportFile').onchange=e=>importInventory(e.target.files?.[0]);$('#exportBtn').onclick=exportData;$('#exportNotesBtn').onclick=exportNotes;$('#importBtn').onclick=()=>$('#importFile').click();$('#importFile').onchange=e=>importData(e.target.files?.[0]);$('#restoreBackupBtn').onclick=restoreBackup;$('#resetBtn').onclick=resetAll;
}

load();bind();render();switchView(S.ui.view||'combat');
if(migrated)toast('Anciennes données Rufus récupérées dans Companion V3.');
})();