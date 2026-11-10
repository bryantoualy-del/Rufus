/* Companion Result Focus V1 — presentation only. Never writes combat state, journal or history. */
(function(root){
  'use strict';
  const config=root.CompanionResultFocusConfig||{};
  const semanticColors=Object.freeze({"fire":"#FF6538","cold":"#65D9F5","lightning":"#F6D44B","thunder":"#568BEB","acid":"#A4D64F","poison":"#39B87B","necrotic":"#9461BC","radiant":"#FFE19A","psychic":"#E577D6","force":"#B18BFF","bludgeoning":"#B49B7B","piercing":"#A9BAC8","slashing":"#E17A80","healing":"#34D399","temporary":"#38BDF8","regeneration":"#86EFAC","blocked":"#94A3B8","attack":"#E5B963"});
  const aliases=Object.fromEntries("feu:fire,froid:cold,foudre:lightning,tonnerre:thunder,acide:acid,nécrotique:necrotic,necrotique:necrotic,psychique:psychic,contondant:bludgeoning,perforant:piercing,tranchant:slashing".split(',').map(x=>x.split(':')));
  function normalizeType(v){const s=String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/s$/,'');return aliases[s]|| (semanticColors[s]?s:null);}
  const socialName=/^(?:jet\s+)?(?:social|persuasion|tromperie|representation|représentation|intimidation|charisme|performance|deception)\b/i;
  function isSocial(title,source){return socialName.test(String(title||'').trim())||!!source?.closest?.('[data-roll-domain="social"],[data-roll-kind="social"],#socialDice,#social-dice,.social-dice');}

  const number=(value)=>{const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=9999?Math.trunc(n):null};
  function read(source){
    const s=String(source||'').replace(/\s+/g,' ').trim();
    const find=(expressions)=>{for(const re of expressions){const m=re.exec(s);if(m){const n=number(m[1]);if(n!==null)return n;}}return null;};
    const statedDamage=find([/\b(\d{1,4})\s*(?:dégâts?|dommages?)\b/i,/\bdégâts?\s*(?:obtenus?|infligés?|potentiels?|bruts?)?\s*[:=+]\s*(\d{1,4})\b/i]);
    const typedAmounts=[...s.matchAll(/\b(\d{1,4})\s+(?:feu|froid|foudre|acide|poison|radiants?|nécrotiques?|psychiques?|contondants?|tranchants?|perforants?)\b/gi)].map(m=>number(m[1]));
    const damage=statedDamage??(typedAmounts.length?typedAmounts.reduce((total,value)=>total+value,0):null);
    const heal=/PV\s+temporaires?\b/i.test(s)?null:find([/\+?(\d{1,4})\s*(?:PV\s*(?:soignés?|récupérés?|rendus?)|soins?)\b/i,/\b(?:soins?|guérison|PV\s*récupérés?)\s*(?:reçus?|obtenus?|effectués?)?\s*[:=+]\s*\+?(\d{1,4})(?:\s*PV)?\b/i,/\b\+?(\d{1,4})\s*PV\b/i]);
    const roll=find([/\battaque\s+\d{1,2}\s*[+−-]\s*\d{1,2}\s*=\s*(\d{1,3})\b/i,/\b(?:jet(?:\s+d.attaque)?|attaque|toucher)\s*[:=]\s*[^\n]{0,55}?\s=\s*(\d{1,3})\b/i,/\bd20\s*\d{1,2}(?:\s*[+−-]\s*\d{1,2})?\s*=\s*(\d{1,3})\b/i,/\b(?:jet(?:\s+d.attaque)?|attaque|toucher)\s*[:=]\s*(\d{1,3})\b/i]);
    const parts=[...s.matchAll(/\b(\d{1,4})\s+(feu|froid|foudre|tonnerre|acide|poison|n[eé]crotiques?|radiants?|psychiques?|force|contondants?|tranchants?|perforants?|fire|cold|lightning|thunder|acid|necrotic|bludgeoning|piercing|slashing)\b/gi)].map(m=>({amount:number(m[1]),type:normalizeType(m[2])})).filter(x=>x.type&&x.amount!==null);
    const temp=find([/\b(\d{1,4})\s*PV\s*temporaires?\b/i,/\bPV\s*temporaires?\s*[:=+]\s*(\d{1,4})/i]);
    return {roll,damage,heal,temp,parts,potential:/potentiel(?:le)?s?/i.test(s),hasValue:roll!==null||damage!==null||heal!==null||temp!==null};
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
  function figure(label,value,kind,type){
    const box=doc.createElement('div');box.className='crf-figure crf-'+kind;
    const caption=doc.createElement('span');caption.textContent=label;
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
    for(const part of parsed.parts||[])body.appendChild(figure(part.type.toUpperCase(),part.amount,'damage',part.type));
    if(parsed.heal!==null)body.appendChild(figure(parsed.potential?'SOINS POTENTIELS':'SOINS OBTENUS',parsed.heal,'heal','healing'));
    if(parsed.temp!==null)body.appendChild(figure('PV TEMPORAIRES',parsed.temp,'temp','temporary'));
    // Never claim an effect or HP delta was applied: only the underlying Companion can do that.
    card.hidden=false;root.clearTimeout(clock);clock=root.setTimeout(hide,8500);
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
    if(isSocial(sourceTitle(),source))return;
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
  root.CompanionResultFocus={show:(title,description)=>{if(!isSocial(title))show(title,read(description),description);},read,hide,semanticColors,normalizeType};
})(typeof window!=='undefined'?window:globalThis);
