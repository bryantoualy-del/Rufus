window.CompanionDiceTheme={"id":"rufus","primary":"#684092","rim":"#b992eb","secondary":"#543070","floor":"#120c20","surface":["#9466c2","#65418c","#3b245e","#231535"],"edge":"#e1c8ff","aura":"rgba(120,65,178,.26)","border":"#7852a5","panel":"#342144","glow":"#ad74e588","text":"#f4eaff"};
/* Companion social rolls use the character's own rules; this only presents Pik's d20 engine. */
(function(){
  const theme=window.CompanionDiceTheme;
  const key='ccDiceSettingsV1:'+theme.id;
  const defaults={speed:'cinematic',sound:true,haptics:true};
  const read=()=>{try{return {...defaults,...JSON.parse(localStorage.getItem(key)||'{}')}}catch{return {...defaults}}};
  const write=patch=>{const value={...read(),...patch};try{localStorage.setItem(key,JSON.stringify(value))}catch{}window.CompanionDiceEngine?.setSettings(value);paint()};
  const pending=[];
  let last='',scheduled=false;
  const root=document.documentElement;
  for(const [name,value] of Object.entries({aura:theme.aura,highlight:theme.rim,border:theme.border,panel:theme.panel,glow:theme.glow,text:theme.text}))root.style.setProperty('--cc-dice-'+name,value);
  function dispatch(opts){if(window.CompanionDiceEngine)window.CompanionDiceEngine.roll(opts);else pending.push(opts)}
  window.CompanionSocialDice={
    show({label,dice,bonus,total,mode}){
      const rolls=(Array.isArray(dice)?dice:[dice]).map(Number).filter(n=>Number.isInteger(n)&&n>=1&&n<=20).slice(0,2);
      if(!rolls.length)return;
      const m=mode==='advantage'?'adv':mode==='disadvantage'?'dis':mode||'normal';
      const chosen=rolls.length===1?rolls[0]:m==='adv'?Math.max(...rolls):m==='dis'?Math.min(...rolls):rolls[0];
      const sign=bonus<0?'− ':'+ ';
      const detail='d20 '+rolls.join(' / ')+(rolls.length===2?' → '+chosen:'')+' '+sign+Math.abs(bonus)+' = '+total;
      last=label+' : '+detail;
      dispatch({label,rolls,chosen,total,detail,mode:m});
    },
    last:()=>last
  };
  window.addEventListener('companiondice:ready',()=>{pending.splice(0).forEach(dispatch);paint()});
  window.addEventListener('companiondice:settings',paint);
  function paint(){
    const s=read();
    document.querySelectorAll('.cc-dice-settings button').forEach(b=>{
      const active=b.dataset.diceSpeed?s.speed===b.dataset.diceSpeed:!!s[b.dataset.diceToggle];
      b.classList.toggle('active',active);b.classList.toggle('muted',!active&&!!b.dataset.diceToggle);
      b.setAttribute('aria-pressed',String(active));
    });
  }
  function ensureSettings(){
    const mode=document.querySelector('.kentaro-roll-modes,.social-roll-modes,.v3-social-mode,.social-modebar');
    if(!mode)return;
    const after=mode.closest('.social-head')||mode;
    if(after.nextElementSibling?.classList.contains('cc-dice-settings'))return;
    const bar=document.createElement('div');bar.className='cc-dice-settings';bar.setAttribute('role','group');bar.setAttribute('aria-label','Animation des dés sociaux');
    bar.innerHTML='<button type="button" data-dice-speed="cinematic">Dés · Ciné</button><button type="button" data-dice-speed="fast">Rapide</button><button type="button" data-dice-speed="off">Off</button><button type="button" data-dice-toggle="sound">Son</button><button type="button" data-dice-toggle="haptics">Vibration</button>';
    bar.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;e.stopPropagation();if(b.dataset.diceSpeed)write({speed:b.dataset.diceSpeed});else if(b.dataset.diceToggle){const k=b.dataset.diceToggle;write({[k]:!read()[k]})}});
    after.after(bar);paint();
  }
  function scheduleSettings(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;ensureSettings()})}
  ensureSettings();new MutationObserver(scheduleSettings).observe(document.body,{childList:true,subtree:true});
})();
