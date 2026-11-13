'use strict';
const {chromium,firefox}=require('playwright');
const assert=require('node:assert/strict');
const base='https://matchthis.lowcymethodowcy.smallhost.pl/';
(async()=>{
 for(const type of [chromium,firefox]){
  const browser=await type.launch();
  try{
   const page=await browser.newPage({viewport:{width:1350,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   page.setDefaultTimeout(25000);
   await page.goto(base);
   await page.waitForFunction(()=>document.getElementById('mt73-sync')?.textContent.includes('Dane z serwera'));
   assert.equal(await page.title(),'MatchThis MT-78');
   assert.equal(await page.locator('#appversion').innerText(),'MT-78');
   assert.equal(await page.locator('body').getAttribute('data-version'),'MT-78');
   assert.equal(await page.locator('[data-view="photoHub"]').count(),0,'Viewer must not have photo download access');
   await page.locator('[data-view="archive"]').first().click();
   const fold=page.locator('details[data-year="2025"]');
   if(await fold.getAttribute('open')===null)await fold.locator('summary').click();
   await page.locator('[data-open="mt2025-mega_final_2025"]').first().click();
   for(const index of [0,1]){
    await page.locator('[data-round="'+index+'"]').first().click();
    await page.locator('[data-result-mode="sectors"]').first().click();
    assert.equal(await page.locator('.sector-title').count(),6);
    const rows=await page.evaluate(()=>[...document.querySelectorAll('.sector-title')].map(e=>e.nextElementSibling?.querySelectorAll('tbody tr').length||0));
    assert.deepEqual(rows,[9,9,9,9,9,9]);
    assert((await page.locator('body').innerText()).includes('ŚWINARSKI KRZYSZTOF'));
    assert((await page.locator('body').innerText()).includes('PEIL ANNA'));
    await page.locator('[data-sector-filter="C"]').first().click();
    assert.equal(await page.locator('.sector-title').count(),1);
    await page.locator('[data-sector-filter="ALL"]').first().click();
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('.sector-title').count(),6);
    await page.setViewportSize({width:1350,height:900});
   }
   await page.reload();
   await page.waitForFunction(()=>document.getElementById('mt73-sync')?.textContent.includes('Dane z serwera'));
   assert.equal(await page.title(),'MatchThis MT-78');
   assert.deepEqual(errors,[]);
   console.log('MT78_LIVE_SMALL2_FINAL_BOTH_ROUNDS_NAMES_AND_PERMISSION_PASS',type.name());
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exit(1)});
