import assert from 'node:assert/strict';
import {chromium,firefox} from 'playwright';
const railway='https://lowcy-methodowcy-app-production.up.railway.app';
const small='https://lowcymethodowcy.smallhost.pl/';
const api=await fetch(small+'api/version',{signal:AbortSignal.timeout(15000)});
assert.equal(api.status,200);
const vers=await api.json();
assert.equal(vers.appVersion,'S1');
assert.equal(vers.version,'S1');
console.log('CUTOVER_SMALL2_S1_IS_LIVE');
let ready=false;
for(let i=0;i<85;i++){
  try{
    const r=await fetch(railway+'/health',{signal:AbortSignal.timeout(5000)});
    if(r.ok){const h=await r.json();if(h.ok&&h.migration==='SMALL2-S1'&&h.target===small){ready=true;break}}
  }catch(e){}
  await new Promise(r=>setTimeout(r,2000));
}
assert.ok(ready,'Railway migration bridge did not become healthy');
console.log('CUTOVER_RAILWAY_BRIDGE_HEALTH_OK');
const oldHome=await fetch(railway+'/',{redirect:'manual',signal:AbortSignal.timeout(15000)});
assert.equal(oldHome.status,200);
const html=await oldHome.text();
assert.match(html,/serviceWorker.register/);
assert.match(html,/location.replace\(target\)/);
assert.match(html,/SMALL2/);
console.log('CUTOVER_PWA_ONE_TIME_MIGRATION_HTML_OK');
const sw=await fetch(railway+'/sw.js?migrate=S1',{signal:AbortSignal.timeout(15000)});
assert.equal(sw.status,200);
const source=await sw.text();
assert.match(source,/self.skipWaiting/);
assert.match(source,/clients.claim/);
assert.match(source,/Response.redirect\(DEST,302\)/);
console.log('CUTOVER_MIGRATION_SERVICE_WORKER_OK');
const oldPath=await fetch(railway+'/app.js?v=311',{redirect:'manual',signal:AbortSignal.timeout(15000)});
assert.equal(oldPath.status,302);
assert.equal(oldPath.headers.get('location'),small);
const post=await fetch(railway+'/api/login',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(15000)});
assert.equal(post.status,410);
console.log('CUTOVER_OLD_ASSETS_REDIRECT_AND_MUTATIONS_BLOCKED');
for(const [engineName,engine] of [['chromium',chromium],['firefox',firefox]]){
 const browser=await engine.launch({headless:true});
 try{
  for(const [device,viewport] of [['desktop',{width:1365,height:900}],['mobile',{width:390,height:844}]]){
   const ctx=await browser.newContext({viewport,serviceWorkers:'allow',locale:'pl-PL',isMobile:device==='mobile',hasTouch:device==='mobile'});
   try{
    const page=await ctx.newPage();
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e.message)));
    await page.goto(railway+'/',{waitUntil:'domcontentloaded',timeout:40000});
    await page.waitForURL(url=>url.toString().startsWith(small),{timeout:35000});
    await page.locator('#loginForm').waitFor({state:'visible',timeout:35000});
    assert.equal(await page.title(),'Łowcy Methodowcy — S1');
    assert.deepEqual(errors,[],'page errors on '+engineName+' '+device);
    console.log('CUTOVER_OLD_ICON_TO_SMALL2_S1_OK '+engineName+' '+device);
   }finally{await ctx.close()}
  }
 }finally{await browser.close()}
}
