'use strict';
const fs=require('node:fs');
const assert=require('node:assert/strict');
const {chromium,firefox}=require('playwright');
const base=process.env.MT83_URL||'http://127.0.0.1:8783/';
const live=base.startsWith('https://');
const out=process.env.MT83_SCREEN_DIR||'/tmp/mt83-screens';
fs.mkdirSync(out,{recursive:true});
async function clickEvent(p){
 const card=p.locator('[data-open="test-event"]').first();
 if(await card.count()===0)await p.locator('[data-view="events"]').first().click();
 await p.locator('[data-open="test-event"]').first().click();
 await p.waitForFunction(()=>document.querySelector('#main')?.textContent.includes('TEST ZERO PZW'));
}
async function goMode(p,value){
 const b=p.locator('[data-result-mode="'+value+'"]').first();
 await b.click();
}
async function checkLayout(p,engine,who){
 for(const width of [1440,1366,1280,1160,1024,820,600,390,320]){
  await p.setViewportSize({width,height:900});
  await p.waitForTimeout(60);
  const x=await p.evaluate(()=>{
   const brand=document.querySelector('.mt80-brand-link');
   const nav=document.querySelector('#nav');
   const shop=document.querySelector('.mt80-shop-link');
   const b=e=>{const z=e.getBoundingClientRect();return{x:z.x,right:z.right,y:z.y,h:z.height,w:z.width}};
   const hit=e=>{const z=e.getBoundingClientRect(),target=document.elementFromPoint(z.x+z.width/2,z.y+z.height/2);return e===target||e.contains(target)};
   return {brand:b(brand),shop:b(shop),nav:b(nav),items:[...nav.querySelectorAll('button,a')].map(e=>({name:e.textContent.trim(),...b(e),hit:hit(e)})),
    scrollWidth:nav.scrollWidth,clientWidth:nav.clientWidth,overflow:getComputedStyle(nav).overflowX,
    logoHit:hit(brand),shopHit:hit(shop),horizontalDocument:document.documentElement.scrollWidth>innerWidth+2};
  });
  assert(x.logoHit&&x.shopHit,engine+' '+who+' '+width+' clickable brand/shop');
  assert(x.overflow==='visible',engine+' '+who+' '+width+' header scrollbar');
  assert(x.scrollWidth<=x.clientWidth+2,engine+' '+who+' '+width+' nav content hidden');
  for(const item of x.items)assert(item.hit&&item.x>=-1&&item.right<=width+2,engine+' '+who+' '+width+' hidden nav: '+item.name);
  assert(x.brand.x>=-1&&x.brand.right<=width+2&&x.shop.x>=-1&&x.shop.right<=width+2);
  assert(!x.horizontalDocument,engine+' '+who+' '+width+' page horizontal overflow');
 }
 await p.setViewportSize({width:1366,height:900});
}
async function testFixtureAdmin(engine){
 const browser=await engine.launch();
 try{
  const p=await browser.newPage({viewport:{width:1366,height:900}});
  p.setDefaultTimeout(25000);
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  const reset=await p.request.post(base+'mt83-reset');
  assert.equal(reset.status(),200,'Reset dedicated mock before each browser');
  await p.goto(base+'panel.php');
  await p.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera'));
  assert.equal(await p.title(),'MatchThis MT-83');
  assert.equal(await p.locator('body').getAttribute('data-version'),'MT-83');
  assert.equal(await p.locator('.mt80-brand-link').getAttribute('href'),'/panel.php');
  await checkLayout(p,engine.name(),'admin');
  await clickEvent(p);
  await p.locator('.mt80-brand-link img').click();
  assert.equal(new URL(p.url()).pathname,'/panel.php','Admin logo must not log out / go to public');
  assert((await p.locator('#main').innerText()).includes('Planowane zawody'),'Admin homepage in same session');
  await clickEvent(p);
  await goMode(p,'sectors');
  assert.equal(await p.locator('.sector-title').count(),1);
  let rows=p.locator('.sector-result tbody tr');
  assert.equal(await rows.count(),10,'All 10 assigned starters initially in sector A');
  assert((await rows.all_text_contents()).every(s=>s.includes('5,5')),'All-zero round must give 5.5 pts');
  await goMode(p,'edit');
  let weights=p.locator('input[data-mt55-field="weight"]');
  assert.equal(await weights.count(),10,'Ten editable weights for ten entrants');
  for(const value of await weights.evaluateAll(xs=>xs.map(x=>x.value)))assert.equal(value,'0','Default weight is 0');
  for(const [i,g] of [[0,3000],[1,2000],[2,1000]]){
   weights=p.locator('input[data-mt55-field="weight"]');
   await weights.nth(i).fill(String(g));
   await weights.nth(i).press('Tab');
   await p.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Zapisano na serwerze'),{timeout:25000});
  }
  await goMode(p,'sectors');
  rows=p.locator('.sector-result tbody tr');
  assert.equal(await rows.count(),10);
  const data=await rows.all_text_contents();
  assert.equal(data.filter(x=>x.includes('7')&&x.includes('TEST')).length>=7,true,'Zero group 7 points');
  const r=await p.request.get(base+'mt73-state.php?public=1',{headers:{'Cache-Control':'no-cache'}});
  assert.equal(r.status(),200);
  const state=await r.json();
  let t=state.data.events.find(e=>e.id==='test-event').rounds[0];
  assert.equal(t.results.length,3,'After three recorded catches, unweighed starter zeros remain a projection');
  assert.deepEqual(t.results.map(x=>x.weightG).sort((a,b)=>b-a),[3000,2000,1000]);
  await p.reload();
  await p.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera'));
  await clickEvent(p);
  await goMode(p,'sectors');
  rows=p.locator('.sector-result tbody tr');
  assert.equal(await rows.count(),10,'All starters stay visible after real server reload');
  await goMode(p,'edit');
  assert.equal(await p.locator('input[data-mt55-field="weight"]').count(),10);
  // Turn test race into a past-date editor; save creates ten real durable 0+weighing rows.
  await p.locator('#tourDate').fill('2026-10-10');
  await p.locator('[data-action="saveTourDate"]').click();
  await p.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Zapisano na serwerze'));
  assert.equal(await p.locator('#resultRows tr').count(),10,'Editor includes unweighed registered participants');
  const editorWeights=await p.locator('#resultRows input[name="weightG"]').evaluateAll(xs=>xs.map(x=>Number(x.value)));
  assert.deepEqual(editorWeights.sort((a,b)=>b-a),[3000,2000,1000,0,0,0,0,0,0,0]);
  await p.locator('[data-action="saveRound"]').click();
  await p.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Zapisano na serwerze'));
  const saved=await (await p.request.get(base+'mt73-state.php?public=1')).json();
  t=saved.data.events.find(e=>e.id==='test-event').rounds[0];
  assert.equal(t.results.length,10,'SaveRound must persist all 10 assigned contestants');
  assert.equal(t.results.filter(x=>x.weightG===0).length,7);
  await p.locator('[data-action="finalize"]').click();
  await p.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Zapisano na serwerze'));
  const finalized=await (await p.request.get(base+'mt73-state.php?public=1')).json();
  t=finalized.data.events.find(e=>e.id==='test-event').rounds[0];
  assert.equal(t.status,'FINAL');
  assert.equal(t.results.length,10);
  await goMode(p,'overall');
  const table=p.locator('.summary-table tbody tr');
  assert.equal(await table.count(),10,'All ten competitors in final general classification');
  await p.screenshot({path:out+'/'+engine.name()+'_admin_MT83.png',fullPage:false});
  assert.deepEqual(errors,[],'Admin browser JS runtime errors');
  console.log('MT83_ADMIN_REAL_CLICK_LOGO_STAYS_AUTHORIZED_PZW_AND_SERVER_SAVE_RELOAD_PASS',engine.name());
 }finally{await browser.close();}
}
async function testViewer(engine){
 const b=await engine.launch();
 try{
  const p=await b.newPage({viewport:{width:1366,height:900}});
  const errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base);
  await p.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera'));
  assert.equal(await p.title(),'MatchThis MT-83');
  assert.equal(await p.locator('.mt80-brand-link').getAttribute('href'),'/');
  assert.equal(await p.locator('[data-view="photoHub"]').count(),0,'No photo downloads for viewer');
  if(live){
    await p.locator('[data-view="archive"]').first().click();
    const year=p.locator('details[data-year="2025"]');
    if(await year.getAttribute('open')===null)await year.locator('summary').click();
    await p.locator('[data-open="mt2025-mega_final_2025"]').first().click();
    await goMode(p,'sectors');
    assert.equal(await p.locator('.sector-title').count(),6,'Real 2025 final six sectors');
    assert.equal(await p.locator('.sector-result tbody tr').count(),54,'Real final all 54 competitors');
  }else{
    await clickEvent(p);
    await goMode(p,'sectors');
    assert.equal(await p.locator('.sector-result tbody tr').count(),10);
  }
  await p.locator('.mt80-brand-link .brand').click();
  assert.equal(new URL(p.url()).pathname,'/','Viewer logo stays on own site');
  assert((await p.locator('#main').innerText()).includes('Planowane zawody')||(await p.locator('#main').innerText()).includes('Ostatnio rozegrane zawody'));
  await checkLayout(p,engine.name(),'viewer');
  assert.deepEqual(errors,[],'Viewer browser JS errors');
  console.log('MT83_VIEWER_ALL_TEN_FINAL_RESULTS_LOGO_HOME_NO_ADMIN_CONTROLS_PASS',engine.name());
 }finally{await b.close();}
}
(async()=>{
 for(const engine of [chromium,firefox]){if(!live)await testFixtureAdmin(engine);await testViewer(engine);}
})().catch(e=>{console.error(e);process.exit(1)});
