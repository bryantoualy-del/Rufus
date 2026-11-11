/* Companion Result Focus V1 — presentation only. Never writes combat state, journal or history. */
(function(root){
  'use strict';
  const config=root.CompanionResultFocusConfig||{};
  const semanticColors=Object.freeze({"fire":"#FF6538","cold":"#65D9F5","lightning":"#F6D44B","thunder":"#568BEB","acid":"#A4D64F","poison":"#39B87B","necrotic":"#9461BC","radiant":"#FFE19A","psychic":"#E577D6","force":"#B18BFF","bludgeoning":"#B49B7B","piercing":"#A9BAC8","slashing":"#E17A80","healing":"#34D399","temporary":"#38BDF8","regeneration":"#86EFAC","blocked":"#94A3B8","attack":"#E5B963"});
  const damageLabels=Object.freeze({fire:'FEU',cold:'FROID',lightning:'FOUDRE',thunder:'TONNERRE',acid:'ACIDE',poison:'POISON',necrotic:'NÉCROTIQUE',radiant:'RADIANT',psychic:'PSYCHIQUE',force:'FORCE',bludgeoning:'CONTONDANT',piercing:'PERFORANT',slashing:'TRANCHANT'});
  const damageIcons=Object.freeze({});
  const aliases=Object.fromEntries("feu:fire,froid:cold,foudre:lightning,tonnerre:thunder,acide:acid,nécrotique:necrotic,necrotique:necrotic,psychique:psychic,contondant:bludgeoning,perforant:piercing,tranchant:slashing".split(',').map(x=>x.split(':')));
  function normalizeType(v){const s=String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/s$/,'');return aliases[s]|| (semanticColors[s]?s:null);}
  const socialName=/^(?:jet\s+)?(?:social|athl[eé]tisme|acrobaties|discr[eé]tion|escamotage|arcanes|histoire|investigation|nature|religion|dressage|intuition|m[eé]decine|perception|survie|persuasion|tromperie|repr[eé]sentation|intimidation|charisme|performance|deception)\b/i;
  function isSocial(title,source){return socialName.test(String(title||'').trim())||!!source?.closest?.('[data-roll-domain="social"],[data-roll-kind="social"],#socialDice,#social-dice,.social-dice');}

  const number=(value)=>{const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=9999?Math.trunc(n):null};
  function read(source){
    const s=String(source||'').replace(/\s+/g,' ').trim();
    const find=(expressions)=>{for(const re of expressions){const m=re.exec(s);if(m){const n=number(m[1]);if(n!==null)return n;}}return null;};
    const statedDamage=find([/\b(\d{1,4})\s*(?:dégâts?|dommages?)\b/i,/\bdégâts?\s*(?:obtenus?|infligés?|potentiels?|bruts?)?\s*[:=+]\s*(\d{1,4})\b/i]);
    const typedAmounts=[...s.matchAll(/\b(\d{1,4})\s+(?:feu|froid|foudre|acide|poison|radiants?|nécrotiques?|psychiques?|contondants?|tranchants?|perforants?)\b/gi)].map(m=>number(m[1]));
    const damage=statedDamage??(typedAmounts.length?typedAmounts.reduce((total,value)=>total+value,0):null);
    const heal=/PV\s*temp(?:oraires?)?\b/i.test(s)?null:find([/\+?(\d{1,4})\s*(?:PV\s*(?:soignés?|récupérés?|rendus?)|soins?)\b/i,/\b(?:soins?|guérison|PV\s*récupérés?)\s*(?:reçus?|obtenus?|effectués?)?\s*[:=+]\s*\+?(\d{1,4})(?:\s*PV)?\b/i,/\b\+?(\d{1,4})\s*PV\b/i]);
    const roll=find([/\battaque\s+\d{1,2}\s*[+−-]\s*\d{1,2}\s*=\s*(\d{1,3})\b/i,/\b(?:jet(?:\s+d.attaque)?|attaque|toucher)\s*[:=]\s*[^\n]{0,55}?\s=\s*(\d{1,3})\b/i,/\bd20\s*\d{1,2}(?:\s*[+−-]\s*\d{1,2})?\s*=\s*(\d{1,3})\b/i,/\b(?:jet(?:\s+d.attaque)?|attaque|toucher)\s*[:=]\s*(\d{1,3})\b/i]);
    const parts=[...s.matchAll(/\b(\d{1,4})\s+(feu|froid|foudre|tonnerre|acide|poison|n[eé]crotiques?|radiants?|psychiques?|force|contondants?|tranchants?|perforants?|fire|cold|lightning|thunder|acid|necrotic|bludgeoning|piercing|slashing)\b/gi)].map(m=>({amount:number(m[1]),type:normalizeType(m[2])})).filter(x=>x.type&&x.amount!==null);
    const temp=find([/\b(\d{1,4})\s*PV\s*temp(?:oraires?)?\b/i,/\bPV\s*temp(?:oraires?)?\s*[:=+]\s*(\d{1,4})/i]);
    const resolvedDamage=statedDamage??(parts.length?parts.reduce((total,p)=>total+p.amount,0):damage);
    return {roll,damage:resolvedDamage,heal,temp,parts,potential:/potentiel(?:le)?s?/i.test(s),hasValue:roll!==null||damage!==null||heal!==null||temp!==null};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={read,semanticColors,normalizeType,isSocial};
  if(!root.document)return;
  const doc=root.document;
  const sources=config.sources||['#ribbon .rb','#resultText','#resultRibbonText','#lastResult','#ribbonText','#rb'];
  const labels=config.labels||['#rtitle','#resultTitle','#resultRibbonTitle','#kentaro-ribbon .title','#rt'];
  const safe=(s)=>String(s||'').trim().slice(0,200);
  let card=null,body=null,heading=null,close=null,clock=0,lastSignature='',source=null;
  function create(){
    if(card)return;
    card=doc.createElement('aside');card.id='companion-result-focus';card.setAttribute('role','status');card.setAttribute('aria-label','Résultat de l’action');
    const head=doc.createElement('div');head.className='crf-head';
    const eyebrow=doc.createElement('span');eyebrow.textContent=config.name||'RÉSULTAT';head.appendChild(eyebrow);
    close=doc.createElement('button');close.type='button';close.textContent='×';close.setAttribute('aria-label','Fermer ce résultat');close.onclick=hide;head.appendChild(close);
    heading=doc.createElement('strong');heading.className='crf-title';
    body=doc.createElement('div');body.className='crf-figures';
    const notice=doc.createElement('small');notice.className='crf-note';notice.textContent='Valeur annoncée · résolution et application inchangées';
    card.append(head,heading,body,notice);doc.body.appendChild(card);
  }
  function hide(){if(card)card.hidden=true;root.clearTimeout(clock);}

  // Inline SVG, never emoji: icons are decorative and do not alter result semantics.
  const damagePaths=Object.freeze({fire:'M12 2c3 4-1 6 2 9 1 3-1 7-5 7s-7-3-7-7c0-4 3-6 5-9 0 4 3 4 5 0Z',cold:'M12 2v20M2 12h20M5 5l14 14M19 5 5 19',lightning:'m13 2-9 12h7l-1 8 10-13h-7l1-7',thunder:'M3 12h3l3-7 5 14 3-7h4',acid:'M12 2c-3 5-7 9-7 13a7 7 0 0 0 14 0c0-4-4-8-7-13Z',poison:'M8 9a4 4 0 1 1 8 0M5 16h14M8 19h8',necrotic:'M4 5c4-3 12-3 16 0M5 19c4 3 10 3 14 0M12 4v16',radiant:'M12 2v20M2 12h20M5 5l14 14M19 5 5 19',psychic:'M4 14c-2-8 6-13 10-8 7-2 9 8 4 11-3 4-8 3-10 0',force:'M12 2 3 7v10l9 5 9-5V7z',bludgeoning:'M5 6h14v6H5zM12 12v10',piercing:'m12 2 5 9-5 11-5-11z',slashing:'M3 21 21 3M8 21 21 8'});
  function iconFor(type){
    if(!damagePaths[type]||typeof doc.createElementNS!=='function')return null;
    const ns='http://www.w3.org/2000/svg';
    const svg=doc.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('width','17');svg.setAttribute('height','17');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');svg.style.verticalAlign='middle';svg.style.marginRight='5px';
    const path=doc.createElementNS(ns,'path');path.setAttribute('d',damagePaths[type]);path.setAttribute('fill','none');path.setAttribute('stroke','currentColor');path.setAttribute('stroke-width','1.8');path.setAttribute('stroke-linecap','round');path.setAttribute('stroke-linejoin','round');svg.appendChild(path);return svg;
  }
  function figure(label,value,kind,type){
    const box=doc.createElement('div');box.className='crf-figure crf-'+kind;
    const caption=doc.createElement('span');caption.textContent=label;
    const icon=iconFor(type);if(icon)caption.prepend(icon);
    const amount=doc.createElement('strong');amount.textContent=String(value);
    if(type&&semanticColors[type]){box.style?.setProperty('--crf-semantic',semanticColors[type]);box.classList?.add('crf-typed');}
    box.append(caption,amount);return box;
  }
  function show(title,parsed,raw){
    if(!parsed.hasValue)return;
    create();body.replaceChildren();
    heading.textContent=safe(title)||'Résultat de combat';
    if(parsed.roll!==null)body.appendChild(figure('JET D’ATTAQUE',parsed.roll,'roll','attack'));
    if(parsed.damage!==null)body.appendChild(figure(parsed.potential?'DÉGÂTS POTENTIELS':'TOTAL DÉGÂTS',parsed.damage,'damage'));
    for(const part of parsed.parts||[])body.appendChild(figure((damageLabels[part.type]||part.type.toUpperCase()),part.amount,'damage',part.type));
    if(parsed.heal!==null)body.appendChild(figure(parsed.potential?'SOINS POTENTIELS':'SOINS OBTENUS',parsed.heal,'heal','healing'));
    if(parsed.temp!==null)body.appendChild(figure('PV TEMPORAIRES',parsed.temp,'temp','temporary'));
    // Never claim an effect or HP delta was applied: only the underlying Companion can do that.
    card.hidden=false;root.clearTimeout(clock);clock=0;
  }
  function activeSource(){
    for(const selector of sources){const el=doc.querySelector(selector);if(el)return el;}return null;
  }
  function sourceTitle(){
    for(const selector of labels){const el=doc.querySelector(selector);if(el&&el.textContent.trim())return el.textContent.trim();}
    return config.name||'Résultat';
  }
  function onChange(){
    if(!source)return;
    const raw=source.textContent||'',sig=raw.trim();
    if(!sig||sig===lastSignature)return;
    lastSignature=sig;
    const parent=source.closest('[hidden]');
    if(parent)return;
    if(isSocial(sourceTitle(),source)){hide();return;}
    // Configuration toggles (notably Great Weapon Master / Cogneur lourd)
    // must never be interpreted as a resolved attack merely because their
    // description contains numeric damage modifiers.
    const title=sourceTitle();
    const configuration=/(?:cogneur lourd|great weapon master|attaque t[eé]m[eé]raire|rage\s*(?:activ[eé]e|fr[eé]n[eé]tique)|cible\s+[àa]\s+0\s*PV|posture|mode d.attaque)/i.test(title+' '+raw);
    const resolved=/(?:\bd20\b|\bjet\s*[:=]|touch[eé](?!r)|rat[eé](?!e)|critique|d[eé]g[aâ]ts?\s*(?:inflig[eé]s?|obtenus?)\s*[:=])/i.test(raw);
    if(configuration&&!resolved)return;
    const value=read(raw);
    if(value.hasValue)show(sourceTitle(),value,raw);
  }
  function attach(){
    source=activeSource();
    if(!source)return false;
    lastSignature=source.textContent.trim();
    const parent=source.parentElement||source;
    new MutationObserver(onChange).observe(parent,{childList:true,characterData:true,subtree:true});
    return true;
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',attach,{once:true});else attach();

  const renderedActionIds=new Set();
  function detailLine(host,description) {
    if(!description)return;
    const line=doc.createElement('small');
    line.className='crf-dice-detail';
    line.textContent=String(description);
    host.appendChild(line);
  }
  // Consumes numbers and individual dice from the already executed action.
  // Never rolls a die, infers missing dice, logs an action, or mutates combat.
  function showStructured(action) {
    if(!action||typeof action!=='object')return false;
    if(action.domain==='social'||isSocial(action.title)){hide();return false;}
    const id=action.eventId==null?'':String(action.eventId);
    if(id&&renderedActionIds.has(id))return false;
    if(!Array.isArray(action.damages)&&!Array.isArray(action.heals)&&!action.attack&&!Array.isArray(action.protections))return false;
    create();
    body.replaceChildren();
    heading.textContent=safe(action.title)||'Résultat de combat';
    const roll=action.attack;
    if(roll&&Number.isFinite(roll.total)) {
      const entry=figure('JET D’ATTAQUE',roll.total,'roll','attack');
      const natural=Array.isArray(roll.dice)?roll.dice.filter(Number.isFinite):[];
      detailLine(entry,[
        natural.length?'d20 : ['+natural.join(', ')+']':'',
        Number.isFinite(roll.bonus)?'Bonus : '+(roll.bonus>=0?'+':'')+roll.bonus:'',
        Number.isFinite(roll.extra)&&roll.extra!==0?'Autres bonus : '+(roll.extra>=0?'+':'')+roll.extra:'',
        roll.mode==='adv'?'Avantage':roll.mode==='dis'?'Désavantage':'',
        roll.critical?'Critique':''
      ].filter(Boolean).join(' · '));
      body.appendChild(entry);
    }
    let totalDamage=0;
    for(const part of action.damages||[]) {
      if(!Number.isFinite(part.amount)||part.amount<0)continue;
      totalDamage+=part.amount;
      const type=normalizeType(part.type);
      const entry=figure(type?(damageLabels[type]):'DÉGÂTS',part.amount,'damage',type);
      const rolls=Array.isArray(part.dice)?part.dice.filter(Number.isFinite):[];
      detailLine(entry,[
        part.formula?String(part.formula):'',
        rolls.length?'['+rolls.join(', ')+']':'',
        Number.isFinite(part.bonus)?'Bonus '+(part.bonus>=0?'+':'')+part.bonus:''
      ].filter(Boolean).join(' · '));
      body.appendChild(entry);
    }
    if((action.damages||[]).length)body.appendChild(figure(action.potential?'TOTAL POTENTIEL':'TOTAL DÉGÂTS',totalDamage,'damage'));
    for(const heal of action.heals||[]){
      if(!Number.isFinite(heal.amount)||heal.amount<0)continue;
      const temp=heal.kind==='temporary',type=temp?'temporary':heal.kind==='regeneration'?'regeneration':heal.kind==='blocked'?'blocked':'healing';
      const entry=figure(temp?'PV TEMPORAIRES':type==='regeneration'?'RÉGÉNÉRATION':type==='blocked'?'SOINS BLOQUÉS':'SOINS',heal.amount,temp?'temp':'heal',type);
      detailLine(entry,[heal.formula||'',Array.isArray(heal.dice)&&heal.dice.length?'['+heal.dice.join(', ')+']':'',Number.isFinite(heal.bonus)?'Bonus '+(heal.bonus>=0?'+':'')+heal.bonus:''].filter(Boolean).join(' · '));
      body.appendChild(entry);
    }
    for(const effect of action.protections||[]){
      if(!Number.isFinite(effect.amount))continue;
      body.appendChild(figure(safe(effect.label)||'PROTECTION',effect.amount,'temp','temporary'));
    }
    if(!body.children.length)return false;
    if(id) { renderedActionIds.add(id);if(renderedActionIds.size>300)renderedActionIds.delete(renderedActionIds.values().next().value); }
    // The ribbon observer runs in a later microtask. Mark this action's ribbon text
    // as already presented so it cannot replace the structured result.
    if(source)lastSignature=String(source.textContent||'').trim();
    card.hidden=false;root.clearTimeout(clock);clock=0;
    return true;
  }
  root.CompanionResultFocus={show:(title,description)=>{if(!isSocial(title))show(title,read(description),description);},read,hide,semanticColors,normalizeType,showStructured};
})(typeof window!=='undefined'?window:globalThis);
