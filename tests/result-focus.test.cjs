const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'companion-result-card.js'),'utf8');
const ctx={module:{exports:{}}};vm.runInNewContext(source,ctx);
const {read}=ctx.module.exports;
test('damage magnitude and type remain announced, not applied',()=>{assert.equal(read('22 dégâts contondants').damage,22);assert.equal(read('Dégâts : 31 · 18 tranchants').damage,31);assert.equal(read('32 feu bruts').damage,32)});
test('healing never confused with damage',()=>{const v=read('Soins reçus : +12 PV');assert.equal(v.heal,12);assert.equal(v.damage,null);assert.equal(read('Khar-Vek : 18 PV').heal,18)});
test('d20 total extracted instead of natural d20',()=>{assert.equal(read('Jet : 18 + 9 = 27 · Touché').roll,27);assert.equal(read('attaque 18+9 = 27').roll,27)});
test('potential semantics and irrelevant messages',()=>{assert.equal(read('Dégâts potentiels : 25').potential,true);assert.equal(read('Pas de ressource disponible').hasValue,false)});
test('presentation links are isolated from journal code',()=>{const h=fs.readFileSync(path.join(root,'index.html'),'utf8');assert.match(h,/companion-result-card\.js\?v=20261110/);assert.match(h,/companion-result-card\.css\?v=20261110/);assert.match(h,/CompanionResultFocusConfig/);});
