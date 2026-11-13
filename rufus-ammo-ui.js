(() => {
  'use strict';
  const ammo=window.RufusAmmo;
  const $=id=>document.getElementById(id);
  const names={explosive:'Explosive',fire:'Feu',lightning:'Électrique',poison:'Poison'};
  const weaponNames={crossbow:'Arbalète légère duergar',bow:'Arc standard'};

  function element(tag,content,className){
    const node=document.createElement(tag);
    if(content)node.textContent=content;
    if(className)node.className=className;
    return node;
  }

  function icon(row){
    if(!row.icon)return element('span','➶','rufus-ammo-ordinary');
    const img=element('img');
    img.src='assets/ammo/'+row.icon+'.png';
    img.alt='';
    img.width=24;
    img.height=24;
    return img;
  }

  function bind({state,weapons,controlled,change,commit,download,toast}){
    const panel=$('ammoManager'), form=$('ammoEditor'), fields=form.elements;
    let editing=null;
    let lastOptions='',lastStocks='';

    function pickWeapon(key){
      change(s=>{s.ammo.weapon=key;});
    }

    function render(){
      const s=state();
      const equipped=weapons();
      const key=equipped.includes(s.ammo.weapon)?s.ammo.weapon:equipped[0];
      const rows=key?ammo.options(s,key):[];
      const guided=controlled();
      const selected=rows.find(row=>row.id===(guided?ammo.ordinary[key].id:s.ammo.selected[key]))||rows[0];
      const quantity=selected?ammo.stock(s.inventory,selected.id):0;
      $('ammoWeapon').parentElement.hidden=!key;
      $('ammoEmptyWeapons').hidden=!!key;
      for(const option of $('ammoWeapon').options)option.hidden=!equipped.includes(option.value);
      if(key)$('ammoWeapon').value=key;
      for(const [weapon,label] of Object.entries(weaponNames)){
        const button=document.querySelector('[data-select-ranged="'+weapon+'"]');
        button.closest('article').hidden=!equipped.includes(weapon);
        button.setAttribute('aria-pressed',String(weapon===key));
        button.textContent=weapon===key?'Choisie':'Choisir';
        button.setAttribute('aria-label','Sélectionner '+label);
      }
      const optionsSignature=JSON.stringify([key,guided,selected?.id,rows.map(row=>[row.id,row.name,row.icon,ammo.stock(s.inventory,row.id)])]);
      if(lastOptions!==optionsSignature){
        lastOptions=optionsSignature;
        $('ammoOptions').replaceChildren(...rows.map(row=>{
          const button=element('button',null,'rufus-projectile');
          button.type='button';
          button.dataset.projectile=row.id;
          button.disabled=guided;
          button.setAttribute('aria-pressed',String(row===selected));
          button.append(icon(row),element('span',row.name),element('strong',String(ammo.stock(s.inventory,row.id))));
          button.onclick=()=>change(value=>{value.ammo.selected[key]=row.id;});
          return button;
        }));
      }
      $('ammoSummary').textContent=guided?'Tir natif en mode guidé.':selected?.icon?ammo.summary(selected)||'Effet à configurer avec le MJ.':'';
      $('ammoSummary').hidden=!$('ammoSummary').textContent;
      $('ammoShoot').hidden=!key;
      $('ammoShoot').dataset.attack=key||'crossbow';
      $('ammoShoot').disabled=!key||!s.economy.action||!!s.pending||(!guided&&quantity===0);
      $('ammoUnavailable').hidden=!key||guided||quantity>0;

      if(panel.hidden)return;
      const all=[...Object.values(ammo.ordinary),...s.ammo.types];
      const stockSignature=JSON.stringify(all.map(row=>[row,ammo.stock(s.inventory,row.id)]));
      if(stockSignature===lastStocks)return;
      lastStocks=stockSignature;
      $('ammoAdd').disabled=s.ammo.types.length>=ammo.maxTypes;
      $('ammoStocks').replaceChildren(...all.map(row=>{
        const quantity=ammo.stock(s.inventory,row.id);
        const item=element('div',null,'rufus-stock');
        const label=element('span',null,'rufus-stock-name');
        label.append(icon(row),element('b',row.name));
        item.append(label);
        for(const step of [-1,0,1]){
          if(step===0){item.append(element('strong',String(quantity)));continue;}
          const button=element('button',step<0?'−':'+','ability');
          button.type='button';
          button.disabled=step<0?quantity===0:quantity>=999;
          button.setAttribute('aria-label',(step<0?'Retirer':'Ajouter')+' · '+row.name);
          button.onclick=()=>{if(!updateStock(row,quantity+step))toast('Inventaire plein.');};
          item.append(button);
        }
        if(row.icon){
          const edit=element('button','Modifier','ability');
          edit.type='button';
          edit.setAttribute('aria-label','Modifier · '+row.name);
          edit.onclick=()=>openEditor(row);
          item.append(edit);
        }
        return item;
      }));
    }

    function updateStock(row,quantity,nextAmmo){
      const inventory=structuredClone(state().inventory);
      if(!ammo.setStock(inventory,row.id,row.name,quantity))return false;
      const old=ammo.stock(state().inventory,row.id);
      commit('Munitions · '+row.name,old+' → '+quantity,s=>{
        s.inventory=inventory;
        if(nextAmmo)s.ammo=nextAmmo;
      });
      return true;
    }

    function setPanel(open){
      panel.hidden=!open;
      $('ammoManageBtn').setAttribute('aria-expanded',String(open));
      form.hidden=true;
      render();
      if(open)$('ammoManagerClose').focus();
      else $('ammoManageBtn').focus();
    }

    function openEditor(row){
      editing=row?.id||null;
      form.reset();
      $('ammoError').hidden=true;
      form.querySelector('details').open=false;
      const value=ammo.profile(row);
      for(const field of ['name','icon','type','formula','ability','dc','effect','duration','radius','description']){
        fields[field].value=value[field]||'';
      }
      fields.qty.value=row?ammo.stock(state().inventory,row.id):0;
      fields.qty.max=Math.max(999,Number(fields.qty.value));
      for(const key of Object.keys(weaponNames))fields[key].checked=value.weapons.includes(key);
      form.hidden=false;
      fields.name.focus();
    }

    function error(message){
      $('ammoError').textContent=message;
      $('ammoError').hidden=false;
    }

    for(const key of ammo.icons)fields.icon.add(new Option(names[key],key));
    for(const type of ammo.damageTypes)fields.type.add(new Option(type,type));
    fields.ability.add(new Option('Aucune',''));
    for(const ability of ammo.abilities)fields.ability.add(new Option(ability,ability));
    form.onsubmit=e=>{
      e.preventDefault();
      const values=Object.fromEntries(new FormData(form));
      const row=ammo.profile({...values,id:editing||'custom-'+crypto.randomUUID(),
        weapons:Object.keys(weaponNames).filter(key=>fields[key].checked)});
      if(!row.name||!row.weapons.length)return error('Indique un nom et une arme compatible.');
      if(values.formula.trim()&&!row.formula)return error('Formule invalide. Utilise un nombre ou une formule comme 2d6+1.');
      if(Boolean(row.dc)!==Boolean(row.ability))return error('Le JdS demande une caractéristique et un DD.');
      const current=state().ammo;
      const types=editing?current.types.map(type=>type.id===editing?row:type):[...current.types,row];
      if(types.length>ammo.maxTypes)return error('Nombre maximal de types atteint.');
      if(!updateStock(row,Number(values.qty),ammo.normalize({...current,types})))return error('Inventaire plein.');
      form.hidden=true;
      $('ammoManagerClose').focus();
    };

    $('ammoWeapon').onchange=e=>pickWeapon(e.target.value);
    document.querySelectorAll('[data-select-ranged]').forEach(button=>button.onclick=()=>pickWeapon(button.dataset.selectRanged));
    $('ammoManageBtn').onclick=()=>setPanel(panel.hidden);
    $('ammoManagerClose').onclick=()=>setPanel(false);
    $('ammoAdd').onclick=()=>openEditor();
    $('ammoEditCancel').onclick=()=>{form.hidden=true;$('ammoAdd').focus();};
    $('ammoExport').onclick=()=>{
      const s=state();
      const rows=[...Object.values(ammo.ordinary),...s.ammo.types];
      download('Rufus-Munitions.json',JSON.stringify({format:'rufus-ammo-v1',ammo:s.ammo,
        stocks:Object.fromEntries(rows.map(row=>[row.id,ammo.stock(s.inventory,row.id)]))},null,2));
    };
    $('ammoImport').onclick=()=>$('ammoFile').click();
    $('ammoFile').onchange=async e=>{
      const file=e.target.files?.[0];
      e.target.value='';
      if(!file)return;
      try{
        if(file.size>60000)throw Error();
        const data=JSON.parse(await file.text());
        if(data?.format!=='rufus-ammo-v1'||!Array.isArray(data.ammo?.types)||!data.stocks)throw Error();
        const nextAmmo=ammo.normalize(data.ammo), s=state();
        const inventory=structuredClone(s.inventory);
        const rows=[...Object.values(ammo.ordinary),...nextAmmo.types];
        const nextIds=new Set(rows.map(row=>row.id));
        for(const row of rows){
          const quantity=data.stocks[row.id];
          if(!Number.isInteger(quantity)||quantity<0||quantity>Math.max(999,ammo.stock(inventory,row.id)))throw Error();
          if(!ammo.setStock(inventory,row.id,row.name,quantity))throw Error();
        }
        commit('Munitions importées',nextAmmo.types.length+' types spéciaux',value=>{
          value.ammo=nextAmmo;
          value.inventory=inventory.filter(item=>!item.ammoId?.startsWith('custom-')||nextIds.has(item.ammoId));
        });
        form.hidden=true;
      }catch{toast('Import des munitions refusé. Vérifie le fichier JSON et la place dans l’inventaire.');}
    };
    return render;
  }

  window.RufusAmmoUI={bind};
})();
