import assert from 'node:assert/strict';
import {chromium,webkit} from 'playwright';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
const root=process.cwd();
const server=createServer(async(req,res)=>{try{
 const u=new URL(req.url,'http://localhost'),file=resolve(root,'.'+u.pathname.replace(/\/$/,'/index.html'));
 if(!file.startsWith(root+'/'))throw Error('Path outside repo');
 const data=await readFile(file);res.setHeader('Content-Type',({'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json'})[extname(file)]||'application/octet-stream');res.end(data);
}catch{res.writeHead(404).end()}});
await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
const base='http://127.0.0.1:'+server.address().port;
const engine=process.env.E2E_BROWSER==='webkit'?webkit:chromium;
let browser;
try{
 browser=await engine.launch(engine===webkit?{executablePath:process.env.PLAYWRIGHT_WEBKIT_EXECUTABLE}:{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
 for(const width of [390,1180]){
  const page=await browser.newPage({viewport:{width,height:820}});
  await page.route('https://**',route=>route.abort());
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__CompanionBridge?.read);
  const start=await page.evaluate(()=>{const s=window.__CompanionBridge.read();return{hp:s.hp,max:s.maxHp,veille:s.inventory.find(i=>i.name==='Veille-songe')?.equipped,con:window.__CompanionBridge.saveProfile('CON').modifier}});
  assert.equal(start.hp,80);assert.equal(start.max,80);assert.equal(start.veille,true);assert.equal(start.con,2);
  await page.evaluate(()=>{const s=structuredClone(window.__CompanionBridge.read());s.hp=40;s.maxHp=80;s.inventory.find(i=>i.name==='Veille-songe').equipped=false;localStorage.setItem('rufus-companion-v3:3',JSON.stringify(s))});
  await page.reload();await page.waitForFunction(()=>window.__CompanionBridge?.read);
  const without=await page.evaluate(()=>{const s=window.__CompanionBridge.read();return{hp:s.hp,max:s.maxHp,con:window.__CompanionBridge.saveProfile('CON').modifier}});
  assert.equal(without.max,58);assert.equal(without.hp,18);assert.equal(without.con,0);
  await page.evaluate(()=>{const s=structuredClone(window.__CompanionBridge.read());s.inventory.find(i=>i.name==='Veille-songe').equipped=true;localStorage.setItem('rufus-companion-v3:3',JSON.stringify(s))});
  await page.reload();await page.waitForFunction(()=>window.__CompanionBridge?.read);
  const restored=await page.evaluate(()=>{const s=window.__CompanionBridge.read();return{hp:s.hp,max:s.maxHp,con:window.__CompanionBridge.saveProfile('CON').modifier}});
  assert.equal(restored.max,80);assert.equal(restored.hp,40);assert.equal(restored.con,2);
  assert.deepEqual(errors,[],'no runtime errors');
  await page.close();
 }
 console.log('Level 11 browser smoke passed:',process.env.E2E_BROWSER||'chromium');
}finally{await browser?.close();await new Promise(ok=>server.close(ok))}
