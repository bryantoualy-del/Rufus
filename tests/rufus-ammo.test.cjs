const test=require('node:test');
const assert=require('node:assert/strict');
const ammo=require('../rufus-ammo.js');

test('legacy ordinary stock is read from the existing inventory and never duplicated',()=>{
  const inventory=[{name:"Carreaux d'arbalète",qty:3},{name:'Flèches ordinaires',qty:9}];
  assert.equal(ammo.stock(inventory,'bolt'),3);
  assert.equal(ammo.stock(inventory,'arrow'),9);
  assert.equal(ammo.setStock(inventory,'bolt','Carreaux d’arbalète',2),true);
  assert.equal(inventory.length,2);
  assert.equal(inventory[0].qty,2);
  ammo.setStock(inventory,'bolt','Carreaux',-1);
  assert.equal(inventory[0].qty,0);
  assert.equal(inventory[1].qty,9);
});

test('special profiles start empty, normalize compatibility, and keep ordinary fallback',()=>{
  const profile=ammo.normalize({selected:{bow:'poison',crossbow:'poison'},types:[
    {id:'poison',name:'Venin',weapons:['crossbow'],formula:'2d6'},
    {id:'custom-test',name:'Test',icon:'../../other.svg',formula:'alert(1)'},
    {id:'custom-test',name:'Doublon'}
  ]});
  assert.equal(profile.types.length,5);
  assert.equal(profile.selected.bow,'arrow');
  assert.equal(profile.selected.crossbow,'poison');
  assert.equal(ammo.options({ammo:profile},'bow').some(row=>row.id==='poison'),false);
  assert.equal(profile.types.at(-1).icon,'explosive');
  assert.equal(profile.types.at(-1).formula,'');
  assert.equal(ammo.stock([],'poison'),0);
});

test('extra damage only uses bounded dice expressions and native roll results',()=>{
  for(const formula of ['0d6','99d6','1d100000','1d6*2','eval(1)','1d6;alert(1)','-1']){
    assert.equal(ammo.parseFormula(formula),null);
  }
  const native=(count,sides)=>{
    assert.equal(count,2);
    assert.equal(sides,6);
    return {arr:[3,6],total:9};
  };
  assert.deepEqual(ammo.damage({formula:'2d6+2',type:'feu'},native),{
    amount:11,type:'feu',formula:'2d6',dice:[3,6],bonus:2
  });
  assert.equal(ammo.damage({formula:'1',type:'feu'},()=>assert.fail('flat damage')).amount,1);
  assert.equal(ammo.damage({formula:'2d6-12',type:'feu'},native).amount,0);
});
