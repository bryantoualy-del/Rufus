/* Cache only Rufus's static shell. Character data stays in localStorage. */
const CACHE='rufus-shell-v23-lot1';
const scope=new URL(self.registration.scope);
const home=new URL('index.html',scope).href;
const icons=['explosive','fire','lightning','poison'].map(name=>'assets/ammo/'+name+'.png');

self.addEventListener('install',event=>event.waitUntil((async()=>{
  const index=await fetch(home,{cache:'reload'});
  if(!index.ok)throw new Error('Rufus shell unavailable');
  const html=await index.clone().text();
  const local=[...html.matchAll(/\b(?:src|href)="([^"<>]+)"/g)]
    .map(match=>new URL(match[1],scope))
    .filter(url=>url.href.startsWith(scope.href)&&/\.(js|css|png|svg|webmanifest)$/.test(url.pathname));
  const cache=await caches.open(CACHE);
  await cache.addAll([...new Set([...local.map(url=>url.href),...icons.map(path=>new URL(path,scope).href)])]);
  await cache.put(home,index);
})()));

self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key.startsWith('rufus-shell-')&&key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));

self.addEventListener('fetch',event=>{
  const {request}=event;
  const url=new URL(request.url);
  if(request.method!=='GET'||!url.href.startsWith(scope.href))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    if(request.mode==='navigate'&&(url.pathname===scope.pathname||url.pathname===new URL(home).pathname)){
      try{
        const response=await fetch(request);
        if(response.ok)return response;
      }catch{}
      return await cache.match(home)||Response.error();
    }
    // Keep serving versioned assets after an offline reload.
    const cached=await cache.match(request);
    return cached||fetch(request);
  })());
});
