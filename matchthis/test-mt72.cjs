'use strict';
const { chromium,firefox } = require('playwright');
const assert = require('node:assert/strict');
const BASE='http://127.0.0.1:8765/';
const roles=['','_OGLADACZ','_SEDZIA'];
(async()=>{
 for(const [engineName,engine] of [['chromium',chromium],['firefox',firefox]]){
  const browser=await engine.launch({headless:true});
  try{
   for(const role of roles){
    const context=await browser.newContext({viewport:{width:1366,height:768}});
    const page=await context.newPage(),errors=[];
    page.on('pageerror',e=>errors.push(String(e)));
    await page.goto(BASE+'MatchThis_MT-72'+role+'.html',{waitUntil:'domcontentloaded'});
    await page.locator('#appversion').waitFor();
    assert.equal(await page.title(),'MatchThis MT-72');
    assert.equal(await page.locator('#appversion').innerText(),'MT-72');
    assert.equal(await page.locator('body').getAttribute('data-version'),'MT-72');
    const stats=await page.evaluate(()=>{
      const c=db.cycles.find(x=>x.id==='mt2026-mega-match-this-cup-cycle');
      return {events:db.events.length,cycles:db.cycles.length,
       chyb:c.officialRows['mt2026-person-chyb-andrzej'].weightG,
       krackowski:c.officialRows['mt2026-person-krackowski-kazimierz'].weightG,
       flagged:db.events.flatMap(x=>x.rounds||[]).flatMap(x=>x.results||[]).filter(x=>x.nameNeedsReview).length};
    });
    assert.equal(stats.events,14);
    assert.equal(stats.cycles,2);
    assert.equal(stats.chyb,6040);
    assert.equal(stats.krackowski,4745);
    assert(stats.flagged>0,'Source flags must remain intact');
    await page.evaluate(()=>{
      const e=db.events.find(e=>e.id==='mt2026-traper-cup-kobialka');
      assert(e);
      selectedId=e.id;roundIndex=0;page='event';resultMode='sectors';render();
    });
    for(const mode of ['round','sectors']){
      const button=page.locator('[data-result-mode="'+mode+'"]').first();
      await button.waitFor({timeout:10000});
      await button.click();
      const visible=await page.locator('body').innerText();
      for(const label of ['Do sprawdzenia','Sprawdź nazwisko','Potwierdź zapis nazwiska','nazwisk w archiwalnej transkrypcji'])
        assert(!visible.includes(label),engineName+role+' '+mode+' leaked review badge '+label);
      assert.equal(await page.locator('.review-name').count(),0);
    }
    if(role===''){
      await page.evaluate(()=>{resultMode='edit';render()});
      assert.equal(await page.locator('.review-name').count(),0);
    }
    // Reimport/migration from MT71 must preserve data; MT72 must not erase the previous key.
    if(role!=='_OGLADACZ'){
      const previous=await page.evaluate(()=>{
       db._mt72Regression='from-MT71';
       localStorage.setItem('matchthis-preview-MT-71',JSON.stringify(db));
       localStorage.removeItem('matchthis-preview-MT-72');
       return localStorage.getItem('matchthis-preview-MT-71');
      });
      assert(previous);
      await page.reload({waitUntil:'domcontentloaded'});
      const after=await page.evaluate(()=>({marker:db._mt72Regression,old:!!localStorage.getItem('matchthis-preview-MT-71'),current:STORAGE_KEY}));
      assert.equal(after.marker,'from-MT71');
      assert(after.old);
      assert.equal(after.current,'matchthis-preview-MT-72');
    }
    assert.deepEqual(errors,[],engineName+role+' browser exceptions');
    console.log('MT72_BROWSER_PASS',engineName,role||'ADMIN',JSON.stringify(stats));
    await context.close();
   }
  }finally{await browser.close()}
 }
})().catch(e=>{console.error(e.stack||e);process.exit(1)});
