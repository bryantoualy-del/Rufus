import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.186.1/build/three.module.js';

const theme=window.CompanionDiceTheme||{id:'companion',primary:'#6f588e',rim:'#b8a0de',secondary:'#a67b50',floor:'#15111b',surface:['#8267ab','#5b447e','#36284e','#20182e'],edge:'#ded0ec'};
const SETTINGS_KEY='ccDiceSettingsV1:'+theme.id;
const defaults={speed:'cinematic',sound:true,haptics:true};
let settings=loadSettings();
let overlay=null,renderer=null,scene=null,camera=null,clockId=0,webglUnavailable=false,fallbackTicker=0;
let queue=[],busy=false,currentResolve=null,currentDice=[];

function loadSettings(){
  try{return {...defaults,...JSON.parse(localStorage.getItem(SETTINGS_KEY)||'{}')}}catch(e){return {...defaults}}
}
function saveSettings(){localStorage.setItem(SETTINGS_KEY,JSON.stringify(settings));window.dispatchEvent(new CustomEvent('companiondice:settings',{detail:{...settings}}))}
function setSettings(patch){settings={...settings,...patch};saveSettings();return {...settings}}
function getSettings(){return {...settings}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const easeOut=t=>1-Math.pow(1-t,3);
const clamp01=t=>Math.max(0,Math.min(1,t));

function ensureOverlay(){
  if(overlay) return overlay;
  overlay=document.createElement('div');
  overlay.id='ccDiceOverlay';
  overlay.innerHTML='<div class="cc-dice-scene" role="dialog" aria-modal="true" aria-label="Lancer de dé"><div class="cc-dice-title"></div><div class="cc-dice-status">Lancer du d20</div><canvas class="cc-dice-canvas"></canvas><div class="cc-dice-fallback" aria-hidden="true"><span>20</span></div><div class="cc-dice-vignette"></div><div class="cc-dice-queue"></div><div class="cc-dice-result"><div class="cc-dice-verdict"></div><div class="cc-dice-total"></div><div class="cc-dice-detail"></div><div class="cc-dice-hint">Touchez pour continuer</div></div></div>';
  document.body.appendChild(overlay);
  overlay.addEventListener('click',()=>{if(overlay.dataset.dismissable==='1') finishCurrent()});
  window.addEventListener('keydown',e=>{if(e.key==='Escape'&&overlay?.dataset.dismissable==='1')finishCurrent()});
  window.addEventListener('resize',resizeRenderer,{passive:true});
  return overlay;
}

function ensureThree(){
  ensureOverlay();
  if(webglUnavailable)return false;
  if(renderer) return true;
  try{
    const canvas=overlay.querySelector('.cc-dice-canvas');
    renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true,powerPreference:'high-performance'});
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
    renderer.shadowMap.enabled=true;
    renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    scene=new THREE.Scene();
    camera=new THREE.PerspectiveCamera(34,1,.1,100);
    camera.position.set(0,2.35,7.8);
    camera.lookAt(0,.15,0);

    scene.add(new THREE.HemisphereLight(new THREE.Color(theme.rim),new THREE.Color(theme.floor),1.35));
    const key=new THREE.DirectionalLight(0xffffff,3.1);key.position.set(-3,5,5);key.castShadow=true;scene.add(key);
    const rim=new THREE.PointLight(new THREE.Color(theme.rim),10,12,2);rim.position.set(3,1.2,3);scene.add(rim);
    const red=new THREE.PointLight(new THREE.Color(theme.secondary),4,10,2);red.position.set(-3,-.5,1);scene.add(red);

    const floor=new THREE.Mesh(new THREE.CircleGeometry(4.6,72),new THREE.MeshStandardMaterial({color:new THREE.Color(theme.floor),roughness:.92,metalness:.05,transparent:true,opacity:.9}));
    floor.rotation.x=-Math.PI/2;floor.position.y=-1.18;floor.receiveShadow=true;scene.add(floor);
    const ring=new THREE.Mesh(new THREE.RingGeometry(2.55,2.58,96),new THREE.MeshBasicMaterial({color:new THREE.Color(theme.rim),transparent:true,opacity:.18,side:THREE.DoubleSide}));
    ring.rotation.x=-Math.PI/2;ring.position.y=-1.15;scene.add(ring);
    resizeRenderer();
    return true;
  }catch(e){
    console.warn('Companion Dice WebGL indisponible',e);
    webglUnavailable=true;
    return false;
  }
}

function resizeRenderer(){
  if(!renderer||!overlay) return;
  const rect=overlay.getBoundingClientRect();
  renderer.setSize(Math.max(1,rect.width),Math.max(1,rect.height),false);
  camera.aspect=Math.max(1,rect.width)/Math.max(1,rect.height);
  camera.updateProjectionMatrix();
  renderScene();
}

function makeNumberTexture(n){
  const c=document.createElement('canvas');c.width=c.height=256;
  const x=c.getContext('2d');
  x.clearRect(0,0,256,256);
  const glow=x.createRadialGradient(128,108,12,128,128,124);
  glow.addColorStop(0,'rgba(255,255,255,.10)');
  glow.addColorStop(.48,'rgba(255,255,255,.025)');
  glow.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=glow;x.fillRect(0,0,256,256);
  x.textAlign='center';x.textBaseline='middle';x.font='900 108px Georgia';
  x.lineJoin='round';x.lineWidth=12;x.strokeStyle='rgba(2,9,6,.9)';x.strokeText(String(n),128,134);
  x.lineWidth=4;x.strokeStyle='rgba(255,255,255,.12)';x.strokeText(String(n),128,134);
  x.fillStyle=n===20?'#f8efc8':n===1?'#ffd0d5':'#eef4ef';x.fillText(String(n),128,134);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer?.capabilities?.getMaxAnisotropy?.()||1);return t;
}

function makeDieSurfaceTexture(){
  const c=document.createElement('canvas');c.width=c.height=512;
  const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,512,512);
  g.addColorStop(0,theme.surface[0]);g.addColorStop(.34,theme.surface[1]);g.addColorStop(.72,theme.surface[2]);g.addColorStop(1,theme.surface[3]);
  x.fillStyle=g;x.fillRect(0,0,512,512);
  for(let i=0;i<5200;i++){
    const a=Math.random()*.045;
    x.fillStyle='rgba(255,255,255,'+a+')';
    x.fillRect(Math.random()*512,Math.random()*512,1,1);
  }
  x.strokeStyle='rgba(255,255,255,.028)';x.lineWidth=1;
  for(let i=0;i<75;i++){
    const x1=Math.random()*512,y1=Math.random()*512;
    x.beginPath();x.moveTo(x1,y1);x.lineTo(x1+(Math.random()*90-45),y1+(Math.random()*90-45));x.stroke();
  }
  const vignette=x.createRadialGradient(256,256,80,256,256,285);
  vignette.addColorStop(0,'rgba(255,255,255,0)');vignette.addColorStop(1,'rgba(0,0,0,.20)');
  x.fillStyle=vignette;x.fillRect(0,0,512,512);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=Math.min(8,renderer?.capabilities?.getMaxAnisotropy?.()||1);return t;
}

function createD20(value,index,count){
  const group=new THREE.Group();
  const geometry=new THREE.IcosahedronGeometry(1,0).toNonIndexed();
  const surfaceTex=makeDieSurfaceTexture();
  const mat=new THREE.MeshPhysicalMaterial({
    color:new THREE.Color(theme.primary),map:surfaceTex,metalness:.34,roughness:.42,
    clearcoat:.48,clearcoatRoughness:.24,flatShading:true,
    emissive:new THREE.Color(theme.floor),emissiveIntensity:.13,transparent:true,opacity:1
  });
  const mesh=new THREE.Mesh(geometry,mat);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  const edgeGeo=new THREE.EdgesGeometry(geometry,1);
  const edgeMat=new THREE.LineBasicMaterial({color:new THREE.Color(theme.edge),transparent:true,opacity:.16});
  const edges=new THREE.LineSegments(edgeGeo,edgeMat);edges.scale.setScalar(1.003);group.add(edges);

  const pos=geometry.attributes.position;
  const faces=[],labels=[];
  for(let i=0,face=1;i<pos.count;i+=3,face++){
    const a=new THREE.Vector3().fromBufferAttribute(pos,i),b=new THREE.Vector3().fromBufferAttribute(pos,i+1),c=new THREE.Vector3().fromBufferAttribute(pos,i+2);
    const center=a.clone().add(b).add(c).multiplyScalar(1/3);
    const normal=b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if(center.dot(normal)<0) normal.negate();
    faces.push({normal:center.clone().normalize(),n:face});
    const labelMat=new THREE.MeshBasicMaterial({map:makeNumberTexture(face),transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide});
    const label=new THREE.Mesh(new THREE.PlaneGeometry(.40,.40),labelMat);
    label.position.copy(center.clone().normalize().multiplyScalar(1.01));
    label.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
    label.renderOrder=3;
    label.userData.faceNormal=normal.clone();
    labels.push(label);
    group.add(label);
  }
  const targetFace=faces.find(f=>f.n===value)||faces[0];
  const targetQ=new THREE.Quaternion().setFromUnitVectors(targetFace.normal.clone(),new THREE.Vector3(0,.18,1).normalize());
  const endX=count===2?(index===0?-1.35:1.35):0;
  group.position.set(endX+(Math.random()-.5)*.35,4.4+index*.35,(Math.random()-.5)*.4);
  group.rotation.set(Math.random()*4,Math.random()*4,Math.random()*4);
  group.userData={value,index,targetQ,endX,materials:[mat,edgeMat],labels,dimFactor:1,surfaceTex};
  scene.add(group);
  return group;
}

function clearDice(){
  currentDice.forEach(g=>{
    scene?.remove(g);
    g.traverse(o=>{
      if(o.geometry)o.geometry.dispose();
      if(o.material){
        const arr=Array.isArray(o.material)?o.material:[o.material];
        arr.forEach(m=>{if(m.map)m.map.dispose();m.dispose()});
      }
    });
  });
  currentDice=[];
}

const preferredReadNormal=new THREE.Vector3(0,.18,1).normalize();

function updateFaceLabelVisibility(group){
  if(!group?.userData?.labels) return;
  const dim=group.userData.dimFactor??1;
  group.userData.labels.forEach(label=>{
    const worldNormal=label.userData.faceNormal.clone().applyQuaternion(group.quaternion).normalize();
    const dot=worldNormal.dot(preferredReadNormal);
    let opacity=.10+clamp01((dot-.05)/.95)*.72;
    if(dot<-.15) opacity=.035;
    opacity*=dim;
    label.material.opacity=opacity;
    const s=.88+clamp01(opacity)*.14;
    label.scale.setScalar(s);
  });
}

function renderScene(){
  if(!renderer||!scene||!camera) return;
  currentDice.forEach(updateFaceLabelVisibility);
  renderer.render(scene,camera);
}

function setGroupOpacity(g,opacity){
  g.userData.dimFactor=opacity;
  g.traverse(o=>{
    if(o.material && !g.userData.labels?.includes(o)){
      const arr=Array.isArray(o.material)?o.material:[o.material];
      arr.forEach(m=>{m.transparent=true;m.opacity=Math.min(m.opacity,opacity)});
    }
  });
}

function vibrate(pattern){if(settings.haptics&&navigator.vibrate)navigator.vibrate(pattern)}
function tone(kind){
  if(!settings.sound) return;
  try{
    const AC=window.AudioContext||window.webkitAudioContext;const ac=new AC();
    const g=ac.createGain();g.connect(ac.destination);
    const o=ac.createOscillator();o.connect(g);
    const now=ac.currentTime;
    if(kind==='impact'){o.type='sine';o.frequency.setValueAtTime(95,now);o.frequency.exponentialRampToValueAtTime(42,now+.16);g.gain.setValueAtTime(.055,now);g.gain.exponentialRampToValueAtTime(.001,now+.18)}
    else if(kind==='crit'){o.type='triangle';o.frequency.setValueAtTime(420,now);o.frequency.exponentialRampToValueAtTime(980,now+.28);g.gain.setValueAtTime(.045,now);g.gain.exponentialRampToValueAtTime(.001,now+.34)}
    else{o.type='sine';o.frequency.setValueAtTime(160,now);o.frequency.exponentialRampToValueAtTime(85,now+.12);g.gain.setValueAtTime(.025,now);g.gain.exponentialRampToValueAtTime(.001,now+.14)}
    o.start(now);o.stop(now+(kind==='crit'?.35:.2));setTimeout(()=>ac.close(),500);
  }catch(e){}
}

function frameLoop(){if(!renderer||!scene||!camera)return;renderScene();clockId=requestAnimationFrame(frameLoop)}
function startLoop(){cancelAnimationFrame(clockId);frameLoop()}
function stopLoop(){cancelAnimationFrame(clockId);clockId=0;renderScene()}

async function animateRoll(dice,duration){
  const start=performance.now();
  const endY=-.05;
  let settled=false,settleStart=0;
  const startQ=dice.map(()=>null);
  return new Promise(resolve=>{
    function step(now){
      const t=clamp01((now-start)/duration);
      const fall=easeOut(clamp01(t/0.78));
      dice.forEach((g,i)=>{
        if(t<.78){
          g.position.y=4.4+i*.35+(endY-(4.4+i*.35))*fall;
          g.position.x=g.userData.endX+Math.sin(t*14+i*.7)*(.30*(1-t));
          g.rotation.x+=.145+i*.012;g.rotation.y+=.185-i*.014;g.rotation.z+=.095;
        }else{
          if(!settled){settled=true;settleStart=t;dice.forEach((x,j)=>startQ[j]=x.quaternion.clone());tone('impact');vibrate(20);overlay.classList.add('impact');setTimeout(()=>overlay?.classList.remove('impact'),190)}
          const s=clamp01((t-.78)/.22),k=1-Math.pow(1-s,3);
          g.position.y=endY+Math.sin((1-s)*Math.PI*1.6)*.06*(1-s);
          g.position.x+=(g.userData.endX-g.position.x)*.11;
          g.quaternion.copy(startQ[i]).slerp(g.userData.targetQ,k);
        }
      });
      renderScene();
      if(t<1)requestAnimationFrame(step);else resolve();
    }
    requestAnimationFrame(step);
  });
}

async function emphasize(dice,chosen){
  const selectedIndex=dice.findIndex(g=>g.userData.value===chosen);
  dice.forEach((g,i)=>{
    if(i===selectedIndex){
      g.userData.dimFactor=1;
      g.scale.setScalar(1.10);g.position.x+=(0-g.position.x)*.35;
      const main=g.userData.materials?.[0];if(main?.emissive)main.emissiveIntensity=.22;
    }else{
      setGroupOpacity(g,.42);g.scale.setScalar(.82);g.position.x*=1.22
    }
  });
  renderScene();await sleep(260);
}

function updateQueueBadge(){
  if(!overlay)return;const q=overlay.querySelector('.cc-dice-queue');
  if(queue.length){q.textContent=queue.length+' jet'+(queue.length>1?'s':'')+' en attente';q.classList.add('show')}else q.classList.remove('show');
}

function finishCurrent(){
  if(!overlay)return;
  clearInterval(fallbackTicker);fallbackTicker=0;
  overlay.dataset.dismissable='0';overlay.classList.remove('open','nat20','nat1','reveal','impact','fallback');
  stopLoop();clearDice();
  const r=currentResolve;currentResolve=null;
  setTimeout(()=>{r?.();busy=false;pump()},120);
}

async function performFallback(opts){
  const o=ensureOverlay(),mode=opts.mode||'normal';
  const rolls=Array.isArray(opts.rolls)&&opts.rolls.length?opts.rolls.slice(0,2):[opts.chosen||1];
  const chosen=opts.chosen??rolls[0];
  o.className='open fallback';o.dataset.dismissable='0';
  o.querySelector('.cc-dice-result').classList.remove('show');
  const heading=o.querySelector('.cc-dice-title'),subtitle=document.createElement('small');
  subtitle.textContent=mode==='adv'?'Avantage · meilleur résultat':mode==='dis'?'Désavantage · résultat le plus faible':'Jet normal';
  heading.replaceChildren(document.createTextNode(opts.label||'Jet de d20'),subtitle);
  o.querySelector('.cc-dice-status').textContent='Lancer du d20';
  const face=o.querySelector('.cc-dice-fallback span');
  fallbackTicker=setInterval(()=>{face.textContent=String(1+Math.floor(Math.random()*20))},70);
  await sleep(settings.speed==='fast'?680:1620);
  if(currentResolve===null)return;
  clearInterval(fallbackTicker);fallbackTicker=0;face.textContent=String(chosen);
  o.querySelector('.cc-dice-status').textContent=rolls.length===2?'Dé retenu : '+chosen:'Face obtenue : '+chosen;
  await sleep(settings.speed==='fast'?210:470);
  if(currentResolve===null)return;
  if(chosen===20)o.classList.add('nat20');if(chosen===1)o.classList.add('nat1');
  o.querySelector('.cc-dice-verdict').textContent=chosen===20?'20 naturel · critique':chosen===1?'1 naturel · échec critique':'Résultat du jet';
  o.querySelector('.cc-dice-total').textContent=opts.total!=null?String(opts.total):String(chosen);
  o.querySelector('.cc-dice-detail').textContent=opts.detail||('d20 '+chosen);
  o.querySelector('.cc-dice-result').classList.add('show');o.classList.add('reveal');
  if(chosen===20){tone('crit');vibrate([22,30,44])}
  o.dataset.dismissable='1';updateQueueBadge();
  if(queue.length){await sleep(settings.speed==='fast'?520:980);if(o.dataset.dismissable==='1')finishCurrent()}
}

async function perform(opts,resolve){
  settings=loadSettings();
  if(settings.speed==='off'||matchMedia('(prefers-reduced-motion: reduce)').matches){resolve();busy=false;pump();return}
  currentResolve=resolve;
  const o=ensureOverlay();
  const ok=ensureThree();
  if(!ok){await performFallback(opts);return}
  clearDice();
  o.className='';
  o.dataset.dismissable='0';
  o.querySelector('.cc-dice-result').classList.remove('show');
  const mode=opts.mode||'normal';
  const rolls=Array.isArray(opts.rolls)&&opts.rolls.length?opts.rolls.slice(0,2):[opts.chosen||1];
  const chosen=opts.chosen??rolls[0];
  const heading=o.querySelector('.cc-dice-title'),subtitle=document.createElement('small');
  subtitle.textContent=mode==='adv'?'Avantage · meilleur résultat':mode==='dis'?'Désavantage · résultat le plus faible':'Jet normal';
  heading.replaceChildren(document.createTextNode(opts.label||'Jet de d20'),subtitle);
  o.querySelector('.cc-dice-status').textContent=settings.speed==='fast'?'Jet rapide':'Lancer du d20';
  if(chosen===20)o.classList.add('nat20');if(chosen===1)o.classList.add('nat1');
  o.classList.add('open');resizeRenderer();startLoop();vibrate(14);tone('start');
  currentDice=rolls.map((v,i)=>createD20(v,i,rolls.length));
  const duration=settings.speed==='fast'?680:1620;
  await animateRoll(currentDice,duration);
  o.querySelector('.cc-dice-status').textContent='Le dé se stabilise…';
  await sleep(settings.speed==='fast'?120:280);
  await emphasize(currentDice,chosen);
  o.querySelector('.cc-dice-status').textContent=rolls.length===2?'Dé retenu : '+chosen:'Face obtenue : '+chosen;
  await sleep(settings.speed==='fast'?90:190);
  o.querySelector('.cc-dice-verdict').textContent=chosen===20?'20 naturel · critique':chosen===1?'1 naturel · échec critique':'Résultat du jet';
  o.querySelector('.cc-dice-total').textContent=opts.total!=null?String(opts.total):String(chosen);
  o.querySelector('.cc-dice-detail').textContent=opts.detail||('d20 '+chosen);
  o.querySelector('.cc-dice-result').classList.add('show');
  o.classList.add('reveal');
  if(chosen===20){tone('crit');vibrate([22,30,44])}
  else if(chosen===1){vibrate([36,24,36])}
  o.dataset.dismissable='1';
  updateQueueBadge();
  if(queue.length){await sleep(settings.speed==='fast'?520:980);if(o.dataset.dismissable==='1')finishCurrent()}
}

function pump(){
  if(busy||!queue.length){updateQueueBadge();return}
  busy=true;const job=queue.shift();updateQueueBadge();perform(job.opts,job.resolve);
}
function roll(opts={}){return new Promise(resolve=>{queue.push({opts:{...opts},resolve});pump()})}
function close(){if(overlay?.dataset.dismissable==='1')finishCurrent()}
function cancelAll(){queue.splice(0).forEach(j=>j.resolve());updateQueueBadge();if(busy)finishCurrent()}

window.CompanionDiceEngine={roll,close,cancelAll,getSettings,setSettings,version:'2.2.0-cc',source:'social-only'};
window.dispatchEvent(new CustomEvent('companiondice:ready',{detail:{version:'2.2.0-cc'}}));
