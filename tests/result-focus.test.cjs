const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'companion-result-card.js'),'utf8');
const ctx={module:{exports:{}}};vm.runInNewContext(source,ctx);
const {read}=ctx.module.exports;
test('damage magnitude and type remain announced, not applied',()=>{assert.equal(read('22 dégâts contondants').damage,22);assert.equal(read('Dégâts : 31 · 18 tranchants').damage,31);assert.equal(read('32 feu bruts').damage,32)});
test('mixed typed damage sums separately stated components',()=>{assert.equal(read('22 contondants + 8 radiants').damage,30);assert.equal(read('11 PV temporaires').heal,null)});
test('healing never confused with damage',()=>{const v=read('Soins reçus : +12 PV');assert.equal(v.heal,12);assert.equal(v.damage,null);assert.equal(read('Khar-Vek : 18 PV').heal,18)});
test('d20 total extracted instead of natural d20',()=>{assert.equal(read('Jet : 18 + 9 = 27 · Touché').roll,27);assert.equal(read('attaque 18+9 = 27').roll,27)});
test('potential semantics and irrelevant messages',()=>{assert.equal(read('Dégâts potentiels : 25').potential,true);assert.equal(read('Pas de ressource disponible').hasValue,false)});
test('presentation links are isolated from journal code',()=>{const h=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(h,/companion-result-card\.js\?v=20261110/);assert.match(h,/companion-result-card\.css\?v=20261110/);assert.match(h,/CompanionResultFocusConfig/);});

test('universal typed damage palette and bilingual normalization',()=>{
 const {semanticColors,normalizeType}=ctx.module.exports;
 assert.equal(semanticColors.fire,'#FF6538');
 assert.equal(semanticColors.healing,'#34D399');
 assert.equal(semanticColors.temporary,'#38BDF8');
 assert.equal(semanticColors.attack,'#E5B963');
 assert.equal(normalizeType('nécrotiques'),'necrotic');
 assert.equal(normalizeType('contondants'),'bludgeoning');
 assert.equal(normalizeType('lightning'),'lightning');
 const mixed=read('22 contondants + 8 radiants');
 assert.equal(mixed.parts.length,2);
 assert.equal(mixed.parts[0].amount,22);
 assert.equal(mixed.parts[0].type,'bludgeoning');
});
test('temporary HP remains distinct from healing and social roll is excluded',()=>{
 const {isSocial}=ctx.module.exports;
 const temporary=read('11 PV temporaires');
 assert.equal(temporary.temp,11);
 assert.equal(temporary.heal,null);
 assert.equal(isSocial('Persuasion'),true);
 assert.equal(isSocial('Jet social'),true);
 assert.equal(isSocial('Sauvegarde Constitution'),false);
});
test('results never infer a past d20 roll from click history',()=>{
 assert.doesNotMatch(source,/previousRoll|captureRoll/);
});

test('structured actual dice, typed mixed damage, one display per event, social exemption',()=>{
 class Node {
  constructor(){this.children=[];this.textContent='';this.hidden=false;this.parentElement=null;this.className='';this.style={setProperty(){}};this.classList={add(){}};}
  append(...n){this.children.push(...n)}
  appendChild(n){this.children.push(n);return n}
  replaceChildren(...n){this.children=[...n]}
  setAttribute(){}
  closest(){return null}
 }
 const root=new Node(),doc={readyState:'complete',body:root,querySelector:()=>null,createElement:()=>new Node(),addEventListener(){}};
 const w={document:doc,CompanionResultFocusConfig:{name:'Test',sources:['#missing']},setTimeout:()=>1,clearTimeout:()=>{}};
 vm.runInNewContext(source,{window:w,document:doc,Date,MutationObserver:class{}});
 const api=w.CompanionResultFocus;
 const action={eventId:'attack-001',title:'PyroMerlin',attack:{dice:[9],bonus:4,total:13},
  damages:[{type:'contondants',formula:'1d10',dice:[8],bonus:7,amount:15},{type:'feu',formula:'2d8',dice:[8,9],amount:17}]};
 assert.equal(api.showStructured(action),true);
 const card=root.children[0],items=card.children[2].children;
 assert.equal(items.length,4);
 assert.equal(items[0].children[1].textContent,'13');
 assert.match(items[0].children[2].textContent,/\[9\]/);
 assert.equal(items[1].children[1].textContent,'15');
 assert.match(items[2].children[2].textContent,/\[8, 9\]/);
 assert.equal(items[3].children[1].textContent,'32');
 assert.equal(api.showStructured(action),false);
 assert.equal(api.showStructured({...action,eventId:'social-002',domain:'social'}),false);
 assert.equal(card.children[2].children.length,4);
 assert.equal(api.showStructured({eventId:'heal-003',title:'Khar-Vek',heals:[{kind:'healing',formula:'3d8',dice:[5,6,8],bonus:5,amount:24},{kind:'temporary',amount:11}]}),true);
 assert.equal(card.children[2].children[0].children[1].textContent,'24');
 assert.equal(card.children[2].children[1].children[1].textContent,'11');
});

test('later ribbon observer cannot overwrite structured result for the same action',()=>{
 let mutation;
 class Node {
  constructor(){this.children=[];this.textContent='';this.parentElement=null;this.hidden=false;this.className='';this.style={setProperty(){}};this.classList={add(){}};}
  append(...nodes){this.children.push(...nodes)}
  appendChild(node){this.children.push(node);return node}
  replaceChildren(...nodes){this.children=[...nodes]}
  setAttribute(){}
  closest(){return null}
 }
 const root=new Node(),sourceNode=new Node(),titleNode=new Node();
 sourceNode.textContent='Initial';sourceNode.parentElement=new Node();titleNode.textContent='Action';
 const doc={readyState:'complete',body:root,createElement:()=>new Node(),addEventListener(){},querySelector:selector=>selector==='#raw'?sourceNode:selector==='#title'?titleNode:null};
 const w={document:doc,CompanionResultFocusConfig:{sources:['#raw'],labels:['#title']},setTimeout:()=>1,clearTimeout(){}};
 vm.runInNewContext(source,{window:w,Date,MutationObserver:class{constructor(cb){mutation=cb}observe(){}}});
 sourceNode.textContent='24 PV récupérés';
 assert.equal(w.CompanionResultFocus.showStructured({eventId:'heal-123',title:'Khar-Vek',heals:[{kind:'healing',amount:24,formula:'3d8',dice:[5,6,8],bonus:5}]}),true);
 mutation(); // MutationObserver callback arrives after the structured render.
 const card=root.children[0];
 assert.equal(card.children[2].children[0].children[1].textContent,'24');
 assert.equal(card.children[2].children[0].children[2].textContent,'3d8 · [5, 6, 8] · Bonus +5');
 sourceNode.textContent='Jet : 9 + 4 = 13';
 mutation(); // Different action without structured payload still has legacy fallback.
 assert.equal(card.children[2].children[0].children[1].textContent,'13');
});

test('Rufus attack retains natural and sneak/fire dice without changing resolution',()=>{const s=fs.readFileSync(path.join(root,'companion-v3.js'),'utf8');new vm.Script(s);assert.match(s,/resultId:crypto\.randomUUID\(\)/);assert.match(s,/sneakDice=sneak\.arr/);assert.match(s,/fireDice=fire\.arr/);assert.match(s,/dice:base\.arr/);assert.match(s,/if\(!shown\)toast\(detail\)/);});
