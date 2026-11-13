/* Local ammunition rules. No connection or DOM dependencies. */
(function(root){
  'use strict';
  const icons=['explosive','fire','lightning','poison'];
  const abilities=['FOR','DEX','CON','INT','SAG','CHA'];
  const damageTypes=['contondants','perforants','tranchants','acide','feu','foudre','force','froid','nécrotiques','poison','psychiques','radiants','tonnerre'];
  const weapons=['crossbow','bow'];
  const ordinary={
    crossbow:{id:'bolt',name:'Carreaux d’arbalète'},
    bow:{id:'arrow',name:'Flèches'}
  };
  const predefined=[
    {id:'explosive',name:'Explosive',icon:'explosive',type:'contondants'},
    {id:'fire',name:'Feu',icon:'fire',type:'feu'},
    {id:'lightning',name:'Électrique',icon:'lightning',type:'foudre'},
    {id:'poison',name:'Poison',icon:'poison',type:'poison'}
  ];
  const maxTypes=24;
  const string=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
  const number=(value,max)=>Math.min(max,Math.max(0,Math.trunc(Number(value)||0)));
  const itemKey=name=>String(name||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/’/g,"'").trim();
  const arrowNames=['fleche','fleches','fleches ordinaires','carquois de 30 fleches'];
  const boltNames=["carreaux d'arbalete","carreau d'arbalete",'carreaux','carreaux ordinaires'];

  function parseFormula(value){
    const input=string(value,32).replace(/\s/g,'').toLowerCase();
    if(!input)return null;
    if(/^\d{1,3}$/.test(input))return {count:0,sides:0,bonus:Number(input)};
    const m=/^(\d{1,2})d(4|6|8|10|12|20|100)([+-]\d{1,3})?$/.exec(input);
    if(!m||Number(m[1])<1||Number(m[1])>20)return null;
    return {count:Number(m[1]),sides:Number(m[2]),bonus:Number(m[3]||0)};
  }

  function profile(value={}){
    const formula=string(value.formula,32);
    return {
      id:string(value.id,60),name:string(value.name,64),
      icon:icons.includes(value.icon)?value.icon:'explosive',
      weapons:weapons.filter(key=>(Array.isArray(value.weapons)?value.weapons:weapons).includes(key)),
      type:damageTypes.includes(value.type)?value.type:'force',
      formula:parseFormula(formula)?formula:'',
      ability:abilities.includes(value.ability)?value.ability:'',dc:number(value.dc,30),
      effect:string(value.effect,140),duration:string(value.duration,60),
      radius:string(value.radius,40),description:string(value.description,300)
    };
  }

  function normalize(value){
    const stored=Array.isArray(value?.types)?value.types.filter(row=>row&&typeof row==='object'):[];
    const types=predefined.map(row=>{
      const saved=profile({...row,...stored.find(item=>item.id===row.id)});
      return {...saved,name:saved.name||row.name,weapons:saved.weapons.length?saved.weapons:weapons.slice()};
    });
    const ids=new Set([...types.map(row=>row.id),'bolt','arrow']);
    for(const raw of stored){
      if(types.length>=maxTypes)break;
      const row=profile(raw);
      if(!row.name||!row.weapons.length||!/^custom-[a-z0-9-]+$/.test(row.id)||ids.has(row.id))continue;
      ids.add(row.id);
      types.push(row);
    }
    const selected=Object.fromEntries(weapons.map(key=>[
      key,types.some(row=>row.id===value?.selected?.[key]&&row.weapons.includes(key))?value.selected[key]:ordinary[key].id
    ]));
    return {weapon:weapons.includes(value?.weapon)?value.weapon:'crossbow',selected,types};
  }

  function options(state,weapon){
    return [ordinary[weapon],...state.ammo.types.filter(row=>row.weapons.includes(weapon))];
  }

  function stockItems(inventory,id){
    const names=id==='arrow'?arrowNames:id==='bolt'?boltNames:null;
    return inventory.filter(item=>item.ammoId===id||(!item.ammoId&&names?.includes(itemKey(item.name))));
  }

  function stock(inventory,id){
    return stockItems(inventory,id).reduce((total,item)=>total+number(item.qty,999),0);
  }

  function setStock(inventory,id,name,quantity){
    const items=stockItems(inventory,id);
    const current=stock(inventory,id);
    const next=number(quantity,Math.max(999,current));
    if(current===next)return true;
    if(!items.length){
      if(inventory.length>=200)return false;
      inventory.push({name,category:'consumable',qty:next,note:'Munitions.',image:'',icon:'ammo',equipped:false,ammoId:id});
      return true;
    }
    if(next>current){
      const available=items.reduce((total,item)=>total+999-number(item.qty,999),0);
      if(next-current>available){
        if(inventory.length>=200)return false;
        inventory.push({name,category:'consumable',qty:0,note:'Munitions.',image:'',icon:'ammo',equipped:false,ammoId:id});
        items.push(inventory[inventory.length-1]);
      }
    }
    let remaining=Math.abs(next-current);
    for(const item of items){
      const qty=number(item.qty,999);
      const change=Math.min(remaining,next>current?999-qty:qty);
      item.qty=qty+(next>current?change:-change);
      remaining-=change;
      if(!remaining)break;
    }
    return true;
  }

  function summary(row){
    if(!row?.icon)return '';
    return [
      row.formula&&'+'+row.formula+' '+row.type,
      row.radius&&'Rayon '+row.radius,
      row.dc&&row.ability&&'JdS '+row.ability+' DD '+row.dc,
      row.effect,row.duration&&'Durée '+row.duration,row.description
    ].filter(Boolean).join(' · ');
  }

  function damage(row,rollDamage){
    const parsed=parseFormula(row?.formula);
    if(!parsed)return null;
    const roll=parsed.count?rollDamage(parsed.count,parsed.sides):{arr:[],total:0};
    return {amount:Math.max(0,roll.total+parsed.bonus),type:row.type,
      formula:parsed.count?parsed.count+'d'+parsed.sides:'',dice:roll.arr,bonus:parsed.bonus};
  }

  const api={icons,abilities,damageTypes,ordinary,maxTypes,parseFormula,profile,normalize,options,stock,stockItems,setStock,summary,damage};
  if(typeof module==='object')module.exports=api;
  else root.RufusAmmo=api;
})(globalThis);
