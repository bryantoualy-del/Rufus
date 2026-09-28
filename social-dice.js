/* Feedback partagé des jets de fiche, sans effet sur les règles. */
(function(){
  const root=document.createElement('aside');root.className='cc-social-dice';root.setAttribute('role','status');root.setAttribute('aria-live','polite');root.hidden=true;
  root.innerHTML='<div class="cc-die" aria-hidden="true"><span>20</span></div><div class="cc-roll-copy"><small>JET DE FICHE</small><strong></strong><span></span></div><button type="button" aria-label="Réduire le résultat">×</button>';
  document.body.appendChild(root);
  const title=root.querySelector('strong'),detail=root.querySelector('.cc-roll-copy span'),die=root.querySelector('.cc-die span');
  let timer=0;
  root.querySelector('button').onclick=()=>{root.classList.add('compact');root.classList.remove('rolling')};
  window.CompanionSocialDice={show({label,dice,bonus,total,mode}){
    clearTimeout(timer);root.hidden=false;root.classList.remove('compact','rolling');void root.offsetWidth;
    title.textContent=label+' · '+total;
    const shown=Array.isArray(dice)?dice.join(' / '):String(dice);
    detail.textContent=(mode==='adv'||mode==='advantage'?'Avantage · ':mode==='dis'||mode==='disadvantage'?'Désavantage · ':'')+'d20 '+shown+' '+(bonus<0?'− ':'+ ')+Math.abs(bonus)+' = '+total;
    die.textContent=Array.isArray(dice)?(mode==='adv'||mode==='advantage'?Math.max(...dice):Math.min(...dice)):dice;
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){root.classList.add('rolling');timer=setTimeout(()=>root.classList.remove('rolling'),680)}
    root.dataset.last=label+' : '+detail.textContent;
  },last:()=>root.dataset.last||''};
})();
