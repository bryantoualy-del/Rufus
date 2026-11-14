/* Dernier souffle — visual-only companion state and Encounter-sourced ally notices. */
(()=>{'use strict';
 const bridge=()=>window.__CompanionBridge;
 const selfId=()=>String(bridge()?.id||'').toLowerCase();
 const local=()=>{try{const s=bridge()?.read?.();return Number.isFinite(Number(s?.hp))?Number(s.hp):null}catch{return null}};
 const root=document.documentElement;
 const panel=document.createElement('aside');panel.id='lastStandBanner';panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');panel.hidden=true;
 const notices=document.createElement('div');notices.id='lastStandNotices';notices.setAttribute('aria-live','polite');
 const style=document.createElement('style');style.textContent=`
 #lastStandBanner{position:fixed;z-index:1100;left:50%;top:calc(env(safe-area-inset-top,0px) + 76px);transform:translateX(-50%);width:min(580px,calc(100vw - 24px));padding:12px 16px;border-radius:13px;border:1px solid #a94b50;background:linear-gradient(110deg,#23151bea,#401c25f2);color:#f7e5d7;text-align:center;box-shadow:0 12px 38px #0009;font-weight:800;letter-spacing:.055em;pointer-events:none}
 #lastStandBanner[hidden]{display:none}
 #lastStandBanner small{display:block;font-size:.75rem;font-weight:500;letter-spacing:0;margin-top:4px}
 #lastStandNotices{position:fixed;z-index:1101;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 84px);width:min(360px,calc(100vw - 24px));display:grid;gap:8px;pointer-events:none}
 .last-stand-notice{padding:11px 14px;border:1px solid #ac5054;border-radius:12px;background:#211a21f2;color:#f6e5da;box-shadow:0 6px 24px #0008;font-weight:700;animation:lastStandIn .24s ease-out}
 .last-stand-notice.recovered{border-color:#b87945;background:#2c2119f2}
 .last-stand-notice small{display:block;font-weight:400;opacity:.85;margin-top:3px}
 html.last-stand-down body:after{content:'';position:fixed;inset:0;pointer-events:none;z-index:1000;box-shadow:inset 0 0 95px 28px #8e293b75;animation:lastStandPulse 3s ease-in-out infinite}
 html.last-stand-down #lastStandBanner{border-color:#d16d73}
 html.last-stand-survivor body:after{content:'';position:fixed;inset:0;pointer-events:none;z-index:1000;box-shadow:inset 0 0 95px 20px #cb4c2475}
 html.last-stand-survivor #lastStandBanner{border-color:#e49b56;background:linear-gradient(110deg,#271719,#63301e);box-shadow:0 0 30px #bb492d65}
 @keyframes lastStandPulse{50%{box-shadow:inset 0 0 70px 12px #8e293b45}}
 @keyframes lastStandIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
 @media(prefers-reduced-motion:reduce){html.last-stand-down body:after,.last-stand-notice{animation:none}}
 @media(max-width:700px){#lastStandBanner{top:calc(env(safe-area-inset-top,0px) + 56px);font-size:.85rem}#lastStandNotices{bottom:calc(env(safe-area-inset-bottom,0px) + 66px)}}
 `;
 document.head.append(style);document.body.append(panel,notices);
 let previousHp=null,wasReady=false,survivor=false,allyReady=false,previousActors=new Map(),lastEpoch='';
 const normalize=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 function notify(title,description,recovered=false){const item=document.createElement('div');item.className='last-stand-notice'+(recovered?' recovered':'');item.textContent=title;const sub=document.createElement('small');sub.textContent=description;item.append(sub);notices.prepend(item);while(notices.children.length>3)notices.lastChild.remove();setTimeout(()=>item.remove(),6500)}
 function setBanner(title,sub){panel.replaceChildren(document.createTextNode(title));const small=document.createElement('small');small.textContent=sub;panel.append(small);panel.hidden=false}
 function refreshSelf(){const hp=local(),id=selfId();if(hp===null)return;const raging=!!bridge()?.read?.()?.raging;
 if(!wasReady){wasReady=true;previousHp=hp}
 if(id==='nans'&&survivor&&(!raging||hp<=0))survivor=false;
 const down=hp<=0;
 root.classList.toggle('last-stand-down',down);
 root.classList.toggle('last-stand-survivor',survivor&&!down);
 if(down)setBanner('À TERRE · 0 PV',id==='nans'&&raging?'Rage implacable disponible dans Combat · jet déclenché par le joueur':'Jets de sauvegarde contre la mort · secours possible');
 else if(survivor)setBanner('NANS SE RELÈVE · SURVIVANT','Rage implacable réussie · '+hp+' PV');
 else panel.hidden=true;
 previousHp=hp;
 }
 window.addEventListener('nans:relentless-success',()=>{survivor=true;notify('NANS SE RELÈVE !','Rage implacable réussie · 1 PV',true);refreshSelf()});
 function status(a){const hp=Number(a?.health?.current);const valid=Number.isFinite(hp)&&a?.health?.current!==undefined;const life=normalize(a?.lifeStatus);if(life==='dead'||life==='mort')return'dead';if(life==='stable')return'stable';if(life==='unconscious'||life==='inconscient'||(valid&&hp<=0))return'down';if(valid&&hp>0||life==='alive'||life==='vivant')return'up';return null}
 function refreshAllies(){const actors=window.RPGGroup?.getActors?.();if(!Array.isArray(actors))return;const epoch=String(window.RPGHealth?.getContext?.()?.encounterEpoch||'');if(epoch&&lastEpoch&&epoch!==lastEpoch){allyReady=false;previousActors.clear()}lastEpoch=epoch||lastEpoch;
 const next=new Map();for(const a of actors){if(a.kind!=='player'||!a.id||String(a.companionId||'').toLowerCase()===selfId())continue;const id=String(a.id),s=status(a);if(s)next.set(id,{status:s,name:a.name||'Un allié'})}
 if(allyReady){for(const [id,current]of next){const prev=previousActors.get(id);if(!prev||prev.status===current.status)continue;
 if(current.status==='down')notify(current.name.toUpperCase()+' EST À TERRE','0 PV · Un allié a besoin d’aide');
 else if(prev.status==='down'&&current.status==='up')notify(current.name.toUpperCase()+' SE RELÈVE','Un allié est de retour au combat',true);
 }}previousActors=next;allyReady=true}
 window.addEventListener('rpg-group:updated',refreshAllies);
 document.addEventListener('rpg-health:resolved',()=>setTimeout(refreshSelf,0));
 setInterval(refreshSelf,850);
 refreshSelf();refreshAllies();
})();
