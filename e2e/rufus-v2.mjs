import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=process.cwd();
let serving=true;
const server=createServer(async(req,res)=>{try{
 if(!serving){res.writeHead(503);res.end();return;}
 const u=new URL(req.url,'http://localhost'),file=resolve(root,'.'+u.pathname.replace(/\/$/,'/index.html'));
 if(!file.startsWith(root+'/'))throw Error('Path outside repo');
 const data=await readFile(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png'})[extname(file)]||'application/octet-stream');res.end(data);
}catch{res.writeHead(404).end()}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base='http://127.0.0.1:'+server.address().port;
const engine=process.env.E2E_BROWSER==='webkit'?webkit:chromium;
let browser;
try{
  browser=await engine.launch(engine===webkit?{executablePath:process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE}:{
    executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
    args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']
  });
  const errors=[];
  const page=await browser.newPage({viewport:{width:1180,height:820},hasTouch:true});
  page.setDefaultTimeout(8000);
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://**',route=>route.abort());
  const wire=[];
  await page.routeWebSocket('ws://127.0.0.1:9999/',socket=>{
    socket.onMessage(raw=>{
      const msg=JSON.parse(raw);
      wire.push(msg);
      if(msg.type==='hello')socket.send(JSON.stringify({type:'welcome',protocolVersion:1,
        capabilities:msg.clientCapabilities,room:'qa-rufus',payload:{sessionMode:'table-free'}}));
    });
  });
  await page.goto(base,{waitUntil:'domcontentloaded'});
  const $=selector=>page.locator(selector);
  const stock=id=>page.evaluate(id=>window.RufusAmmo.stock(window.__CompanionBridge.read().inventory,id),id);
  const state=()=>page.evaluate(()=>window.__CompanionBridge.read());
  const tap=selector=>$(selector).click();
  const manual=async(n,selector='#ammoShoot')=>{
    await $('#manualRoll').fill(String(n));
    await tap(selector);
  };
  const result=async()=>$('#companion-result-focus').waitFor({state:'visible'});
  const closeResult=async()=>{
    const dialog=$('#companion-result-focus');
    if(await dialog.isVisible())await dialog.locator('button').first().click();
  };
  const undo=()=>page.evaluate(()=>window.__CompanionBridge.commands.undo());

  const loadedIcons=()=>page.evaluate(()=>{
    const icons=[...document.querySelectorAll('.rufus-weapon-icon, #ammoOptions img')];
    return icons.length===9&&icons.every(icon=>icon.complete&&icon.naturalWidth>0&&icon.src.endsWith('.png'));
  });
  await page.waitForFunction(()=>[...document.querySelectorAll('.rufus-weapon-icon, #ammoOptions img')]
    .every(icon=>icon.complete&&icon.naturalWidth>0));
  assert.equal(await loadedIcons(),true);
  assert.equal(await stock('bolt'),20);
  assert.equal(await stock('fire'),0);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),1180);
  assert.equal(await page.evaluate(()=>document.querySelector('.rufus-quick').getBoundingClientRect().bottom<=innerHeight),true);
  await page.evaluate(()=>scrollTo(0,320));
  assert.equal(await page.evaluate(()=>document.querySelector('.top').getBoundingClientRect().top),0);
  assert.ok(await page.evaluate(()=>document.querySelector('#cc-turnbar-standard').getBoundingClientRect().top>=document.querySelector('.top').getBoundingClientRect().bottom));
  await page.evaluate(()=>scrollTo(0,0));

  await manual(12);
  assert.equal(await stock('bolt'),19);
  assert.equal((await state()).pending.total,19);
  assert.equal(await $('#ammoShoot').isDisabled(),true);
  await tap('[data-miss]');
  await result();
  assert.equal(await stock('bolt'),19);
  await closeResult();
  await undo();
  assert.equal(await stock('bolt'),20);
  assert.equal((await state()).economy.action,true);

  await tap('#ammoManageBtn');
  await tap('[aria-label="Modifier · Feu"]');
  await $('#ammoEditor [name=qty]').fill('2');
  await $('#ammoEditor [name=formula]').fill('4');
  await tap('#ammoEditor details summary');
  await $('#ammoEditor [name=ability]').selectOption('CON');
  await $('#ammoEditor [name=dc]').fill('14');
  await $('#ammoEditor [name=effect]').fill('Brûlure');
  await $('#ammoEditor [name=duration]').fill('1 tour');
  await tap('#ammoEditor [type=submit]');
  assert.equal(await stock('fire'),2);
  await tap('[aria-label="Ajouter · Feu"]');
  assert.equal(await stock('fire'),3);
  await tap('[aria-label="Retirer · Feu"]');
  assert.equal(await stock('fire'),2);
  await tap('#ammoAdd');
  await $('#ammoEditor [name=name]').fill('Carreau sifflant');
  await $('#ammoEditor [name=bow]').uncheck();
  await $('#ammoEditor [name=qty]').fill('1');
  await tap('#ammoEditor [type=submit]');
  const custom=(await state()).ammo.types.find(row=>row.name==='Carreau sifflant');
  assert.ok(custom);
  assert.equal(await stock(custom.id),1);
  await undo();
  assert.equal((await state()).ammo.types.some(row=>row.id===custom.id),false);
  assert.equal(await stock(custom.id),0);
  const json={format:'rufus-ammo-v1',ammo:(await state()).ammo,stocks:{bolt:20,arrow:30,explosive:0,fire:2,lightning:0,poison:0}};
  await $('#ammoFile').setInputFiles({name:'ammo.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(json))});
  await page.waitForFunction(()=>window.__CompanionBridge.read().journal[0]?.title==='Munitions importées');
  const download=page.waitForEvent('download');
  await tap('#ammoExport');
  assert.equal((await download).suggestedFilename(),'Rufus-Munitions.json');
  await tap('#ammoManagerClose');

  await tap('[data-projectile=fire]');
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await $('[data-projectile=fire]').getAttribute('aria-pressed'),'true');
  await manual(20);
  assert.equal(await stock('fire'),1);
  await page.reload({waitUntil:'domcontentloaded'});
  assert.equal(await stock('fire'),1);
  await tap('[data-hit]');
  assert.equal(await $('#fxStage').evaluate(el=>el.classList.contains('play'))||await $('#companion-result-focus').isHidden(),true);
  await result();
  assert.equal(await $('#fxStage').evaluate(el=>el.classList.contains('play')),false);
  assert.match(await $('#companion-result-focus').innerText(),/FEU\s*4/i);
  assert.match(await $('#companion-result-focus').innerText(),/JdS CON DD 14.*Brûlure.*1 tour/);
  assert.equal((await state()).turnDamage,(await page.evaluate(()=>window.__lastDamageComponents)).reduce((n,x)=>n+x.amount,0));
  await closeResult();
  await undo();
  assert.equal(await stock('fire'),2);

  await tap('[data-cond=allyAdjacent]');
  await manual(12,'[data-attack=psychic]');
  assert.equal((await state()).pending.projectile,null);
  assert.match(await $('[data-hit-sneak]').innerText(),/6d6/);
  await tap('[data-hit-sneak]');
  await result();
  assert.match(await $('#companion-result-focus').innerText(),/6d6/);
  await closeResult();
  await manual(12,'[data-attack=psychic2]');
  assert.equal((await state()).economy.bonus,false);
  await tap('[data-miss]');
  await closeResult();
  await undo();
  await tap('.rufus-quick details:first-child summary');
  await tap('[data-cunning=Foncer]');
  assert.equal((await state()).economy.bonus,false);
  await tap('.reaction-action');
  assert.equal((await state()).economy.reaction,false);

  await page.evaluate(()=>{
    const value=window.__CompanionBridge.read();
    value.inventory.find(row=>row.name==='Arc standard').equipped=true;
    value.economy.action=true;
    window.__CompanionBridge.healthRefresh();
  });
  await tap('[data-select-ranged=bow]');
  await tap('#sharpshooterToggle');
  await manual(12);
  assert.equal((await state()).pending.key,'bow');
  assert.equal((await state()).pending.total,14);
  assert.equal(await stock('arrow'),29);
  await tap('[data-miss]');
  await closeResult();
  await undo();
  await tap('#sharpshooterToggle');
  await tap('[data-select-ranged=crossbow]');
  await tap('.desktop-main-nav [data-view=arsenal]');
  await tap('[data-subtabs=arsenal] [data-subtab=powers]');
  await page.evaluate(()=>{window.RPGDialogs.prompt=async()=>'+7';});
  await tap('#woundBtn');
  await page.waitForFunction(()=>window.__CompanionBridge.read().pending?.kind==='wound');
  assert.equal((await state()).pending.kind,'wound');
  await tap('.desktop-main-nav [data-view=combat]');
  await tap('[data-special-miss]');
  await result();
  await closeResult();
  await undo();
  assert.equal(await stock('fire'),2);

  // Real client handshake over an intercepted WebSocket using the existing v5 messages.
  await page.evaluate(()=>{
    const node=document.querySelector('.rpg-connect');
    node.querySelector('[name=endpoint]').value='ws://127.0.0.1:9999/';
    node.querySelector('[name=room]').value='qa-rufus';
    node.querySelector('[name=token]').value='local-qa';
    node.querySelector('[data-connect]').click();
  });
  await page.waitForFunction(()=>window.RPGConnect.getStatus().connected&&window.RPGTable.active());
  assert.equal(await page.evaluate(()=>window.RPGConnect.getStatus().controlled),false);
  await manual(12);
  assert.equal(await stock('fire'),1);
  await tap('[data-hit]');
  await result();
  assert.match(await $('#companion-result-focus').innerText(),/Brûlure/);
  assert.ok(wire.some(msg=>msg.type==='state'));
  assert.ok(wire.every(msg=>msg.type==='hello'||msg.type==='state'),JSON.stringify(wire.map(x=>x.type)));
  await closeResult();
  await page.waitForFunction(()=>navigator.serviceWorker.controller);
  serving=false;
  await page.reload();
  assert.equal(await loadedIcons(),true);
  await undo();
  await manual(12);
  assert.equal(await stock('fire'),1);
  await tap('[data-miss]');
  await closeResult();
  await page.close();
  serving=true;

  const mobile=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
  mobile.on('pageerror',error=>errors.push(error.message));
  await mobile.route('https://**',route=>route.abort());
  await mobile.goto(base,{waitUntil:'domcontentloaded'});
  assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth),390);
  await mobile.locator('.mobile-main-nav [data-view=arsenal]').click();
  await mobile.locator('.mobile-main-nav [data-view=combat]').click();
  assert.equal(await mobile.locator('.identity').isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log('Rufus V2 browser smoke passed:',process.env.E2E_BROWSER||'chromium');
}finally{await browser?.close();await new Promise(ok=>server.close(ok));}
