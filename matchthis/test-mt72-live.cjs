'use strict';
const {chromium,firefox}=require('playwright');
const assert=require('node:assert/strict');
const BASE='https://matchthis.lowcymethodowcy.smallhost.pl/';
(async()=>{
 for(const [name,engine] of [['chromium',chromium],['firefox',firefox]]){
  const browser=await engine.launch({headless:true});
  try{
   const ctx=await browser.newContext({viewport:{width:1366,height:768}});
   const page=await ctx.newPage();
   const errors=[];
   page.on('pageerror',e=>errors.push(String(e)));
   const response=await page.goto(BASE,{waitUntil:'domcontentloaded'});
   assert.equal(response.status(),200);
   assert.equal(await page.title(),'MatchThis MT-72');
   assert.equal(await page.locator('#appversion').innerText(),'MT-72');
   assert.equal(await page.locator('body').getAttribute('data-version'),'MT-72');
   const status=await page.evaluate(()=>{
     const c=db.cycles.find(x=>x.id==='mt2026-mega-match-this-cup-cycle');
     return {events:db.events.length,cycles:db.cycles.length,
       chyb:c.officialRows['mt2026-person-chyb-andrzej'].weightG,
       krackowski:c.officialRows['mt2026-person-krackowski-kazimierz'].weightG,
       role:roleMode,flagged:db.events.flatMap(x=>x.rounds||[]).flatMap(x=>x.results||[]).filter(x=>x.nameNeedsReview).length};
   });
   assert.equal(status.role,'viewer');
   assert.equal(status.events,14);
   assert.equal(status.cycles,2);
   assert.equal(status.chyb,6040);
   assert.equal(status.krackowski,4745);
   assert(status.flagged>0);
   await page.evaluate(()=>{
      selectedId='mt2026-traper-cup-kobialka';
      page='event';roundIndex=0;resultMode='sectors';render();
   });
   for(const mode of ['round','sectors']){
     const b=page.locator('[data-result-mode="'+mode+'"]').first();
     await b.waitFor();
     await b.click();
     const visible=await page.locator('body').innerText();
     for(const tag of ['Do sprawdzenia','Sprawdź nazwisko','Potwierdź zapis nazwiska','nazwisk w archiwalnej transkrypcji'])
       assert(!visible.includes(tag),name+' '+tag);
     assert.equal(await page.locator('.review-name').count(),0);
   }
   assert.equal(await page.locator('[data-action="downloadOverallPdf"]').count(),0);
   assert.deepEqual(errors,[],name+' unexpected JS errors');
   const panel=await ctx.request.get(BASE+'panel.php',{maxRedirects:0});
   assert.equal(panel.status(),303);
   for(const f of ['mt72-admin.php','mt72-sedzia.php']){
     const p=await ctx.request.get(BASE+'role-pages/'+f,{maxRedirects:0});
     assert([403,404].includes(p.status()),f+':'+p.status());
   }
   const d=await (await ctx.request.get(BASE+'mt60-draws.php')).json();
   assert(Array.isArray(d.draws));
   console.log('MT72_LIVE_VIEWER_SHA_UI_AUTH_DRAWS_PASS',name,JSON.stringify(status));
   await ctx.close();
  }finally{await browser.close()}
 }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
