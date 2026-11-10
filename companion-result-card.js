/* Companion Result Focus V1 — presentation only. Never writes combat state, journal or history. */
(function(root){
  'use strict';
  const config=root.CompanionResultFocusConfig||{};
  const number=(value)=>{const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=9999?Math.trunc(n):null};
  function read(source){
    const s=String(source||'').replace(/\s+/g,' ').trim();
    const find=(expressions)=>{for(const re of expressions){const m=re.exec(s);if(m){const n=number(m[1]);if(n!==null)return n;}}return null;};
    const damage=find([/\b(\d{1,4})\s*(?:dégâts?|dommages?)\b/i,/\bdégâts?\s*(?:obtenus?|infligés?|potentiels?|bruts?)?\s*[:=+]\s*(\d{1,4})\b/i]);
    const heal=find([/\+?(\d{1,4})\s*(?:PV\s*(?:soignés?|récupérés?|rendus?)|soins?)\b/i,/\b(?:soins?|guérison|PV\s*récupérés?)\s*(?:reçus?|obtenus?|effectués?)?\s*[:=+]\s*\+?(\d{1,4})(?:\s*PV)?\b/i,/\b\+?(\d{1,4})\s*PV\b/i]);
    const roll=find([/\b(?:jet(?:\s+d.attaque)?|attaque|toucher)\s*[:=]\s*[^\n]{0,55}?\s=\s*(\d{1,3})\b/i,/\bd20\s*\d{1,2}(?:\s*[+−-]\s*\d{1,2})?\s*=\s*(\d{1,3})\b/i,/\b(?:jet(?:\s+d.attaque)?|attaque|toucher)\s*[:=]\s*(\d{1,3})\b/i]);
    return {roll,damage,heal,potential:/potentiel(?:le)?s?/i.test(s),hasValue:roll!==null||damage!==null||heal!==null};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports={read};
  if(!root.document)return;
  const doc=root.document;
  const sources=config.sources||['#ribbon .rb','#resultText','#resultRibbonText','#lastResult','#ribbonText','#rb'];
  const labels=config.labels||['#rtitle','#resultTitle','#resultRibbonTitle','#kentaro-ribbon .title','#rt'];
  const safe=(s)=>String(s||'').trim().slice(0,200);
  let card=null,body=null,heading=null,close=null,clock=0,lastSignature='',previousRoll=null,source=null;
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
  function figure(label,value,kind){
    const box=doc.createElement('div');box.className='crf-figure crf-'+kind;
    const caption=doc.createElement('span');caption.textContent=label;
    const amount=doc.createElement('strong');amount.textContent=String(value);
    box.append(caption,amount);return box;
  }
  function show(title,parsed,raw){
    if(!parsed.hasValue)return;
    create();body.replaceChildren();
    heading.textContent=safe(title)||'Résultat de combat';
    let roll=parsed.roll;
    // The hit confirmation only provides an attack total; it does not determine a hit.
    if(roll===null&&parsed.damage!==null&&previousRoll&&Date.now()-previousRoll.at<16000)roll=previousRoll.total;
    if(roll!==null)body.appendChild(figure('JET D’ATTAQUE',roll,'roll'));
    if(parsed.damage!==null)body.appendChild(figure(parsed.potential?'DÉGÂTS POTENTIELS':'DÉGÂTS OBTENUS',parsed.damage,'damage'));
    if(parsed.heal!==null)body.appendChild(figure(parsed.potential?'SOINS POTENTIELS':'SOINS OBTENUS',parsed.heal,'heal'));
    // Never claim an effect or HP delta was applied: only the underlying Companion can do that.
    card.hidden=false;root.clearTimeout(clock);clock=root.setTimeout(hide,8500);
    previousRoll=null;
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
    const value=read(raw);
    if(value.hasValue)show(sourceTitle(),value,raw);
  }
  function captureRoll(event){
    const button=event.target?.closest?.('#hitYes,#hitNo,#confirmHit,#confirmMiss,#kentaroHitYes,#kentaroHitNo,[data-hit-choice]');
    if(!button)return;
    const holder=button.closest('#hitModal,#kentaro-hit-modal,.hit-modal,[role="dialog"]')||doc;
    const el=holder.querySelector('#hitRoll,#kentaroHitRoll,.hit-roll');
    if(!el)return;
    const direct=el.textContent.match(/^\s*(\d{1,3})\s*$/)||el.textContent.match(/\bjet\s+(\d{1,3})\b/i);
    const total=direct?number(direct[1]):null;
    if(total!==null)previousRoll={total,at:Date.now()};
  }
  function attach(){
    source=activeSource();
    if(!source)return false;
    lastSignature=source.textContent.trim();
    const parent=source.parentElement||source;
    new MutationObserver(onChange).observe(parent,{childList:true,characterData:true,subtree:true});
    doc.addEventListener('click',captureRoll,true);
    return true;
  }
  if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',attach,{once:true});else attach();
  root.CompanionResultFocus={show:(title,description)=>show(title,read(description),description),read,hide};
})(typeof window!=='undefined'?window:globalThis);
