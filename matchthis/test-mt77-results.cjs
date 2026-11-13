'use strict';
// MT77 regression: real competitors/points/weights visible, never invented sector codes.
const {chromium,firefox}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.MT77_TEST_URL||'http://127.0.0.1:8877/';
const prod=base.startsWith('https://matchthis.');
(async()=>{
 for(const browserType of [chromium,firefox]){
  const browser=await browserType.launch();
  try{
   const page=await browser.newPage({viewport:{width:1347,height:768}});
   page.setDefaultTimeout(25000);
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base);
   await page.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera'));
   assert.equal(await page.title(),'MatchThis MT-77');
   assert.equal(await page.locator('#appversion').innerText(),'MT-77');
   assert.equal(await page.locator('body').getAttribute('data-version'),'MT-77');
   await page.locator('[data-view="archive"]').first().click();
   let fold=page.locator('details[data-year="2025"]');
   if(await fold.getAttribute('open')===null)await fold.locator('summary').click();
   for(const [id,expectation] of [['mt2025-champions_2025',60],['mt2025-mega_final_2025',54]]){
    await page.locator('[data-open="'+id+'"]').first().click();
    for(const round of [0,1]){
     await page.locator('[data-round="'+round+'"]').first().click();
     await page.locator('[data-result-mode="sectors"]').first().click();
     if(id==='mt2025-mega_final_2025'&&round===1){
      assert.equal(await page.locator('.mt77-unassigned-results').count(),0);
      assert((await page.locator('body').innerText()).includes('SEKTOR A'));
      console.log('MT77_REAL_SECTORS_PRESERVED',browserType.name(),id,round);
     }else{
      const panel=page.locator('[data-approved-sectors="6"][data-assignment-status="pending"]');
      assert.equal(await panel.count(),1);
      assert.equal(await panel.locator('.mt77-unassigned-results tbody tr').count(),expectation);
      assert.equal(await page.locator('.mt76-sector-pending').count(),0);
      assert.equal(await page.locator('[data-sector-filter="C"]').count(),0);
      assert.equal(await panel.locator('.mt77-unassigned-results tbody tr [data-label="Punkty sektorowe"]').count(),expectation);
      const txt=await panel.innerText();
      assert(txt.includes('rzeczywistych wyników'));
      if(id==='mt2025-champions_2025'&&round===0){
       assert(txt.includes('KULKA ARTUR'));
       assert(txt.includes('4 545'));
       assert(txt.includes('GÓRECKI KACPER'));
       fs.mkdirSync('/tmp/mt77-proof',{recursive:true});
       await page.screenshot({path:'/tmp/mt77-proof/Champions_2025_MT77_'+browserType.name()+(prod?'_SMALL2':'_PRETEST')+'.png',fullPage:true});
      }
      if(id==='mt2025-champions_2025'&&round===1) assert(txt.includes('11: 1'));
      await page.setViewportSize({width:390,height:844});
      assert.equal(await panel.locator('.mt77-unassigned-results tbody tr').count(),expectation);
      await page.setViewportSize({width:1347,height:768});
      console.log('MT77_REAL_UNASSIGNED_ROWS_VISIBLE',browserType.name(),id,round,expectation);
     }
    }
    await page.locator('[data-view="archive"]').first().click();
    fold=page.locator('details[data-year="2025"]');
    if(await fold.getAttribute('open')===null)await fold.locator('summary').click();
   }
   await page.locator('[data-open="mt2025-champions_2025"]').first().click();
   await page.locator('[data-round="0"]').first().click();
   await page.locator('[data-result-mode="sectors"]').first().click();
   await page.reload();
   await page.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera'));
   await page.locator('[data-view="archive"]').first().click();
   fold=page.locator('details[data-year="2025"]');
   if(await fold.getAttribute('open')===null)await fold.locator('summary').click();
   await page.locator('[data-open="mt2025-champions_2025"]').first().click();
   await page.locator('[data-result-mode="sectors"]').first().click();
   assert.equal(await page.locator('.mt77-unassigned-results tbody tr').count(),60);
   assert.deepEqual(errors,[]);
   console.log('MT77_BROWSER_REGRESSION_PASS',browserType.name(),prod?'SMALL2':'FIXTURE');
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exit(1)});
