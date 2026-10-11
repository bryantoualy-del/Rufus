/* V4 Lot 2: explicit allowlist. Attack modifiers and damage formulae never enter it. */
((root)=>{'use strict';
 const clone=x=>JSON.parse(JSON.stringify(x)),get=(o,p)=>p.reduce((v,k)=>v?.[k],o);
 const labels={slots:'Emplacements de pacte',curseReady:'Malédiction',biteReady:'Morsure',stoneReady:'Pierre',rayStepReady:'Pas de rayon',superiorityDice:'Dés de supériorité',fougue:'Fougue',secondWind:'Second souffle',indomitable:'Indomptable',breath:'Souffle',hitDice:'Dés de vie',sorceryPoints:'Points de sorcellerie',featPoints:'Points de métamagie',wings:'Ailes',staffCharges:'Charges du bâton',cureFree:'Soins gratuits',flame:'Flamme',vial:'Fiole',rages:'Rages',horn:'Charges du cor',voltoEnergy:'Touches chargées Volto',voltoStored:'Charges stockées dans la fiole',barkReady:'Écorce',capeReady:'Parade de vent',ancReady:'Appel des ancêtres',psiDie:'Taille du dé psionique',lucky:'Chance',hexCharges:'Charges Hexen',psiReconstitutionReady:'Reconstitution psionique',ravenShadow:'Ombre du corbeau',pilgrim:'Pèlerin',judgment:'Jugement différé',lastBreath:'Dernier souffle',fireBladeReady:'Lame de feu',visionUses:'Visions utilisées',woundReady:'Blessure',invisibilityReady:'Invisibilité',layOnHands:'Réserve de soins',channel:'Conduit divin',arrows:'Flèches',binahChromatic:'Charges chromatiques',binahWall:'Mur prismatique',sense:'Sens divin',decree:'Décrets',anchor:'Ancre sacrée',exhaust:'Épuisement'};
 const maps={
 kentaro:{slots:['slots',2],curseReady:['curseReady',1,'bool'],biteReady:['biteReady',1,'bool'],stoneReady:['stoneReady',1,'bool'],rayStepReady:['rayStepReady',1,'bool']},
 brackmard:{superiorityDice:['sup',5],fougue:['surge',1],secondWind:['second',1],indomitable:['indom',1],breath:['breath',1],hitDice:['hitDice',10]},
 samoth:{sorceryPoints:['sp',10],featPoints:['featSp',2],wings:['wings',4],staffCharges:['staff',8],cureFree:['cureFree',1],flame:['flame',1],vial:['vial',1],hitDice:['hitDice',10]},
 nans:{rages:['rages',4],horn:['horn',5],voltoEnergy:['hits',6],voltoStored:['storedCount',5],barkReady:['barkReady',1,'bool'],capeReady:['capeReady',1,'bool'],ancReady:['ancReady',1,'bool'],exhaust:['exhaust',6]},
 rufus:{psiDie:['psiDie',8],lucky:['lucky',3],hexCharges:['hexCharges',5],psiReconstitutionReady:['psiReconstitutionReady',1,'bool'],ravenShadow:['linceul.ravenShadow',2],pilgrim:['linceul.pilgrim',1,'bool'],judgment:['linceul.judgment',1,'bool'],lastBreath:['linceul.lastBreath',1,'bool'],fireBladeReady:['fireBlade.ready',1,'bool'],visionUses:['vision.uses',100],woundReady:['woundReady',1,'bool'],invisibilityReady:['invisibilityReady',1,'bool']},
 zephyr:{layOnHands:['lay',50],channel:['channel',1],arrows:['arrows',3],binahChromatic:['binahChromatic',3],binahWall:['binahWall',1],sense:['sense',5],decree:['decree',1],anchor:['anchor',1]}};
 const slotMax={samoth:{1:4,2:3,3:3,4:3,5:2},zephyr:{1:4,2:3,3:2}};
 function descriptors(id){const out=[{key:'hp',label:'Points de vie',min:0,max:100000},{key:'tempHp',label:'PV temporaires',min:0,max:100000},{key:'baseAc',label:'CA de base',min:0,max:100},{key:'acAdjustment',label:'Ajustement temporaire de CA',min:-50,max:50},{key:'action',label:'Action',kind:'bool'},{key:'bonus',label:'Action bonus',kind:'bool'},{key:'reaction',label:'Réaction',kind:'bool'},{key:'movement',label:'Mouvement disponible',kind:'bool'},{key:'movementRemaining',label:'Mouvement restant (m)',min:0,max:1000,decimal:true}];
 for(const [key,[path,max,kind]]of Object.entries(maps[id]||{}))out.push({key,label:labels[key]||key,path:path.split('.'),min:0,max,kind,...(key==='psiDie'?{choices:[0,4,6,8]}:key==='voltoStored'?{choices:[0,3,4,5]}:{})});
 for(const [level,max]of Object.entries(slotMax[id]||{}))out.push({key:'slot'+level,label:'Emplacements de niveau '+level,path:['slots',level],min:0,max});
 return out;}
 function valid(id,key,value){const d=descriptors(id).find(x=>x.key===key);return !!d&&(!d.choices||d.choices.includes(value))&&(d.kind==='bool'?typeof value==='boolean':Number.isFinite(value)&&(d.decimal||Number.isSafeInteger(value))&&value>=d.min&&value<=d.max);}
 function snapshot(b,publicState){const s=b.read(),a=publicState,values={hp:a.hp.current,tempHp:a.hp.temp,baseAc:s.rpgBaseAc??a.baseAc,acAdjustment:s.rpgAcAdjustment||0,action:a.turn.action??true,bonus:a.turn.bonus??true,reaction:a.turn.reaction??true,movement:a.turn.movement??s.rpgMovementAvailable??true,movementRemaining:s.rpgMovementRemaining??(b.id==='nans'?12:b.id==='brackmard'?7.5:9)};
 for(const d of descriptors(b.id))if(d.path){const value=get(s,d.path);if(value!==undefined&&valid(b.id,d.key,value))values[d.key]=value;}
 return values;}
 function apply(b,key,value){if(!valid(b.id,key,value))throw Error('Correction hors limites');const s=b.read(),d=descriptors(b.id).find(x=>x.key===key);
 if(d.path){let o=s;for(const k of d.path.slice(0,-1))o=o[k];o[d.path.at(-1)]=value;if(b.id==='nans'&&key==='voltoStored')s.stored=value>=5?'red':value>=3?'yellow':'none';}
 else if(key==='hp')s.hp=value;else if(key==='tempHp'){s[Object.hasOwn(s,'temp')?'temp':'tempHp']=value;s.tempSource=value?'Correction manuelle':'';s.tempMetadata={};}
 else if(key==='baseAc')s.rpgBaseAc=value;else if(key==='acAdjustment')s.rpgAcAdjustment=value;
 else if(key==='movementRemaining'){s.rpgMovementRemaining=value;apply(b,'movement',value>0);}
 else{const eco=s.economy||s.eco||s.used,native=b.ecoKeys?.[key]||(key==='movement'?'move':key);if(eco)eco[native]=b.used===false?value:!value;
  if(key==='movement')s.rpgMovementAvailable=value;
  if(b.id==='kentaro'&&key!=='movement')s[key+'Used']=!value;
  if(b.id==='brackmard'&&key!=='movement')s[key+'Used']=value?'':'Correction MJ';
  if(key==='action'&&value){if(b.id==='kentaro')Object.assign(s,{attackCount:0,actionKind:'',actionLabel:'',eldritchCount:0,eldritchRun:null});if(['nans','brackmard'].includes(b.id))s.attacksLeft=2;if(b.id==='zephyr')s.attackCount=0;}
  if(key==='bonus'&&value){if(Object.hasOwn(s,'bonusSpell'))s.bonusSpell=false;if(Object.hasOwn(s,'bonusLabel'))s.bonusLabel='';}
 }
 }
 const format=(id,key,value)=>typeof value==='boolean'?(value?'Disponible':'Dépensé'):String(value);
 root.RPGCorrectionSchema={descriptors,valid,snapshot,apply,format,clone};
})(globalThis);
