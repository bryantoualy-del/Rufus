import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,basename} from 'node:path';
import {chromium,webkit} from 'playwright';
const root=resolve(process.env.E2E_ROOT||'..'),engine=process.env.E2E_BROWSER==='webkit'?webkit:chromium;
const targets=['Brackmard','Nans','Zephyr','Samoth','Rufus'];
const names=process.env.E2E_APPS?.split(',')||(targets.includes(basename(process.cwd()))?[basename(process.cwd())]:targets);
const keys={Brackmard:'brackmard-v2',Nans:'nans-combat-state-v1',Zephyr:'zephyr-mobile-v20',Samoth:'samoth-companion-v3',Rufus:'rufus-companion-v3:3'};
const server=createServer(async(req,res)=>{try{let p=new URL(req.url,'http://local').pathname;if(p.endsWith('/'))p+='index.html';const file=resolve(root,'.'+p);if(!file.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.svg':'image/svg+xml'})[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
try{
 browser=await engine.launch(engine===chromium?{executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--disable-gpu']}:{});
 for(const name of names){
  console.log('START',name);
  const ctx=await browser.newContext({serviceWorkers:'block',acceptDownloads:true});
  const page=await ctx.newPage(),errors=[];page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.dismiss());
  await page.route(/https?:\/\//,route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
  await page.goto(`http://127.0.0.1:${server.address().port}/${name}/index.html`,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__CompanionBridge?.read);
  await page.evaluate(()=>{const b=__CompanionBridge;b.read().hp=37;b.healthRefresh();});
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__CompanionBridge?.read);assert.equal(await page.evaluate(()=>__CompanionBridge.read().hp),37,name+' persists HP');
  const before=await page.evaluate(key=>localStorage.getItem(key),keys[name]);assert.ok(before);
  await page.evaluate(key=>{window.originalSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('injected quota','QuotaExceededError');return originalSet.call(this,k,v)};__CompanionBridge.read().hp=29;__CompanionBridge.healthRefresh();},keys[name]);
  assert.equal(await page.evaluate(()=>__CompanionBridge.read().hp),29,name+' action survives quota');assert.equal(await page.evaluate(key=>localStorage.getItem(key),keys[name]),before,name+' previous save intact');
  await page.getByRole('alert').filter({hasText:'Sauvegarde non effectuée'}).waitFor();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exporter les données de secours'}).click();
  const payload=JSON.parse(await readFile(await (await download).path(),'utf8'));assert.equal(payload.entries[keys[name]].original,before);assert.ok(payload.entries[keys[name]].current);
  await page.evaluate(()=>{Storage.prototype.setItem=originalSet;__CompanionBridge.healthRefresh()});assert.equal(await page.locator('#companionStorageStatus').count(),0,name+' recovers after quota');
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__CompanionBridge?.read);assert.equal(await page.evaluate(()=>__CompanionBridge.read().hp),29);
  await page.addInitScript(key=>localStorage.setItem(key,'{broken-save'),keys[name]);await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__CompanionBridge?.read);await page.evaluate(()=>__CompanionBridge.healthRefresh());
  assert.equal(await page.evaluate(key=>localStorage.getItem(key),keys[name]),'{broken-save',name+' corrupt original preserved');await page.getByRole('alert').filter({hasText:'Sauvegarde illisible'}).waitFor();assert.deepEqual(errors,[],name+' no uncaught exceptions');
  console.log('PASS',engine.name(),name,'reload, quota, recovery export, retry, corrupt save preservation');await ctx.close();
 }
}finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
