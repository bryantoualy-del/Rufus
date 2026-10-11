/* Non-blocking native-dialog replacements. Never change browser globals. */
(()=>{'use strict';
 const queue=[];let active=null;
 const cancelValue=kind=>kind==='prompt'?null:kind==='confirm'?false:undefined;
 function finish(value){if(!active)return;const job=active;active=null;job.node.remove();job.resolve(value);if(job.focus?.isConnected)job.focus.focus({preventScroll:true});next();}
 function next(){if(active||!queue.length)return;const job=active=queue.shift(),d=document.createElement('dialog');job.node=d;d.className='rpg-native-dialog';d.dataset.rpgDialog=job.kind;d.setAttribute('aria-labelledby','rpgNativeDialogTitle');
  const form=document.createElement('form');form.method='dialog';const title=document.createElement('h2');title.id='rpgNativeDialogTitle';title.textContent=job.kind==='prompt'?'Saisir une valeur':job.kind==='confirm'?'Confirmation':'Information';const text=document.createElement('p');text.textContent=job.message;form.append(title,text);
  let input;if(job.kind==='prompt'){input=document.createElement('input');input.name='answer';input.type='text';input.value=job.value;input.setAttribute('aria-label',job.message);form.append(input);}
  const buttons=document.createElement('div');buttons.className='rpg-native-dialog-actions';if(job.kind!=='alert'){const cancel=document.createElement('button');cancel.type='button';cancel.dataset.dialogCancel='';cancel.textContent='Annuler';cancel.onclick=()=>finish(cancelValue(job.kind));buttons.append(cancel);}
  const ok=document.createElement('button');ok.type='submit';ok.dataset.dialogAccept='';ok.textContent=job.kind==='prompt'?'Valider':'OK';buttons.append(ok);form.append(buttons);d.append(form);
  form.onsubmit=e=>{e.preventDefault();finish(job.kind==='prompt'?input.value:job.kind==='confirm'?true:undefined)};
  d.addEventListener('cancel',e=>{e.preventDefault();finish(cancelValue(job.kind))});document.body.append(d);d.showModal();(input||ok).focus();input?.select();
 }
 function ask(kind,message,value=''){return new Promise(resolve=>{const label=String(message??'');if([active,...queue].some(j=>j?.kind===kind&&j.message===label)){resolve(cancelValue(kind));return;}queue.push({kind,message:label,value:String(value??''),resolve,focus:document.activeElement});next();});}
 function cancelAll(){const waiting=queue.splice(0);for(const job of waiting)job.resolve(cancelValue(job.kind));if(active)finish(cancelValue(active.kind));}
 window.addEventListener('rpg-resolution:change',cancelAll);
 const style=document.createElement('style');style.textContent='.rpg-native-dialog{background:var(--panel,#181b24);color:var(--text,#f0e5d4);border:1px solid var(--accent,var(--gold,#ad9168));border-radius:14px;padding:20px;width:min(480px,calc(100vw - 28px));box-sizing:border-box;max-height:calc(100dvh - 110px);overflow:auto;white-space:pre-wrap;top:44px}.rpg-native-dialog::backdrop{background:#0009}.rpg-native-dialog h2{margin:0 0 12px;font-size:18px}.rpg-native-dialog input{width:100%;box-sizing:border-box;min-height:44px;font-size:16px;background:var(--bg,#10131b);color:inherit;border:1px solid var(--accent,var(--gold,#ad9168));border-radius:6px;padding:8px}.rpg-native-dialog-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:18px}.rpg-native-dialog-actions button{min-height:44px;padding:8px 18px;background:var(--panel,#181b24);color:inherit;border:1px solid var(--accent,var(--gold,#ad9168));border-radius:8px;font:inherit}';document.head.append(style);
 window.RPGDialogs={prompt:(message,value)=>ask('prompt',message,value),confirm:message=>ask('confirm',message),alert:message=>ask('alert',message),cancelAll};
})();
