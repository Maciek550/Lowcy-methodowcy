'use strict';
// MatchThis Champions League FLOAT RS 2025: real sector tables in both rounds.
// Can run against isolated fixture and real SMALL2 with MT_CL_TEST_URL environment.
const {chromium,firefox}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.MT_CL_TEST_URL||'http://127.0.0.1:8882/';
(async()=>{
 for(const engine of [chromium,firefox]){
  const browser=await engine.launch();
  try{
   const page=await browser.newPage({viewport:{width:1350,height:900}});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   page.setDefaultTimeout(25000);
   await page.goto(base);
   await page.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera'));
   assert.equal(await page.title(),'MatchThis MT-77');
   assert.equal(await page.locator('#appversion').innerText(),'MT-77');
   await page.locator('[data-view="archive"]').first().click();
   const fold=page.locator('details[data-year="2025"]');
   if(await fold.getAttribute('open')===null)await fold.locator('summary').click();
   await page.locator('[data-open="mt2025-champions_2025"]').first().click();
   for(const i of [0,1]){
    await page.locator('[data-round="'+i+'"]').first().click();
    await page.locator('[data-result-mode="sectors"]').first().click();
    assert.equal(await page.locator('.mt77-unassigned-results').count(),0);
    assert.equal(await page.locator('.sector-title').count(),6);
    const sectors=await page.evaluate(()=>[...document.querySelectorAll('.sector-title')].map(e=>({
      name:e.textContent.trim(),rows:e.nextElementSibling?.querySelectorAll('tbody tr').length||0
    })));
    assert.deepEqual(sectors.map(x=>x.rows),[10,10,10,10,10,10]);
    for(const [index,letter] of ['A','B','C','D','E','F'].entries())
      assert(sectors[index].name.includes('SEKTOR '+letter),sectors[index].name);
    const response=await page.request.get(base+'mt73-state.php?public=1',{headers:{'Cache-Control':'no-cache'}});
    assert.equal(response.status(),200);
    const event=(await response.json()).data.events.find(x=>x.id==='mt2025-champions_2025');
    assert(event);
    const results=event.rounds[i].results;
    assert.equal(results.length,60);
    assert.equal(results.filter(x=>x.sector&&x.peg).length,60);
    assert.equal(new Set(results.filter(x=>x.peg).map(x=>x.peg)).size,60);
    assert.deepEqual([...new Set(results.filter(x=>x.sector).map(x=>x.sector))].sort(),['A','B','C','D','E','F']);
    if(i===1){
      const stasiak=results.find(x=>x.competitorName==='STASIAK ŁUKASZ');
      assert(stasiak&&stasiak.peg===60&&stasiak.sector==='F'&&stasiak.weightG===0&&stasiak.officialPlace===11);
    }
    await page.locator('[data-sector-filter="C"]').first().click();
    assert.equal(await page.locator('.sector-title').count(),1);
    assert((await page.locator('.sector-title').innerText()).includes('SEKTOR C'));
    assert.equal(await page.locator('.sector-title').evaluate(e=>e.nextElementSibling.querySelectorAll('tbody tr').length),10);
    await page.locator('[data-sector-filter="ALL"]').first().click();
    assert.equal(await page.locator('.sector-title').count(),6);
    if(i===1){
      await page.locator('[data-sector-filter="F"]').first().click();
      assert.equal(await page.locator('.sector-title').count(),1);
      assert((await page.locator('body').innerText()).includes('STASIAK ŁUKASZ'));
      await page.locator('[data-sector-filter="ALL"]').first().click();
    }
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.locator('.sector-title').count(),6);
    await page.setViewportSize({width:1350,height:900});
    console.log('CHAMPIONS_2025_LIVE_REAL_SECTORS_PASS',engine.name(),i===0?'T1_60':'T2_60','6_SECTORS');
   }
   // Regression: previously approved 54 final 2025 stands must stay present.
   await page.locator('[data-view="archive"]').first().click();
   const again=page.locator('details[data-year="2025"]');
   if(await again.getAttribute('open')===null)await again.locator('summary').click();
   await page.locator('[data-open="mt2025-mega_final_2025"]').first().click();
   await page.locator('[data-round="1"]').first().click();
   await page.locator('[data-result-mode="sectors"]').first().click();
   assert.equal(await page.locator('.sector-title').count(),6);
   await page.reload();
   await page.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera'));
   assert.equal(await page.title(),'MatchThis MT-77');
   assert.deepEqual(errors,[]);
   console.log('CHAMPIONS_2025_BROWSER_RELOAD_AND_FINAL_REGRESSION_PASS',engine.name());
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exit(1)});
