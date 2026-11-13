'use strict';
const {chromium,firefox}=require('playwright'), assert=require('node:assert/strict');
const root=process.env.MT_FINAL_TEST_URL||'http://127.0.0.1:8891/';
(async()=>{
 for(const engine of [chromium,firefox]){
  const b=await engine.launch();
  try{
   const p=await b.newPage({viewport:{width:1350,height:900}});
   p.setDefaultTimeout(20000);
   const errors=[];p.on('pageerror',e=>errors.push(e.message));
   await p.goto(root);
   await p.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera'));
   assert.equal(await p.title(),'MatchThis MT-77');
   await p.locator('[data-view="archive"]').first().click();
   const fold=p.locator('details[data-year="2025"]');if(await fold.getAttribute('open')===null)await fold.locator('summary').click();
   await p.locator('[data-open="mt2025-mega_final_2025"]').first().click();
   for(const index of [0,1]){
    await p.locator('[data-round="'+index+'"]').first().click();
    await p.locator('[data-result-mode="sectors"]').first().click();
    assert.equal(await p.locator('.mt77-unassigned-results').count(),0);
    assert.equal(await p.locator('.sector-title').count(),6);
    const rows=await p.evaluate(()=>[...document.querySelectorAll('.sector-title')].map(e=>e.nextElementSibling?.querySelectorAll('tbody tr').length||0));
    assert.deepEqual(rows,[9,9,9,9,9,9]);
    const response=await p.request.get(root+'mt73-state.php?public=1',{headers:{'Cache-Control':'no-cache'}});
    assert.equal(response.status(),200);
    const data=await response.json();
    const tour=data.data.events.find(x=>x.id==='mt2025-mega_final_2025').rounds[index];
    assert.equal(tour.sectorCount,6);
    assert.equal(tour.results.length,54);
    assert.equal(tour.results.filter(r=>r.sector&&r.peg).length,54);
    assert.equal(new Set(tour.results.map(r=>r.peg)).size,54);
    if(index===0){
      assert.equal(tour.results.find(r=>r.competitorName==='KURCZYŃSKI MARIUSZ').peg,1);
      assert.equal(tour.results.find(r=>r.competitorName==='KOCHAŃSKI GRZEGORZ').peg,54);
    }
    await p.locator('[data-sector-filter="C"]').first().click();
    assert.equal(await p.locator('.sector-title').count(),1);
    assert.equal(await p.locator('.sector-title').evaluate(e=>e.nextElementSibling.querySelectorAll('tbody tr').length),9);
    await p.locator('[data-sector-filter="ALL"]').first().click();
    assert.equal(await p.locator('.sector-title').count(),6);
    await p.setViewportSize({width:390,height:844});assert.equal(await p.locator('.sector-title').count(),6);await p.setViewportSize({width:1350,height:900});
    console.log('MT2025_FINAL_T'+(index+1)+'_6_SECTORS_54_PEGS_PASS',engine.name());
   }
   await p.reload();await p.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera'));
   assert.deepEqual(errors,[]);
   console.log('MT2025_FINAL_BOTH_ROUNDS_BROWSER_RELOAD_PASS',engine.name());
  }finally{await b.close();}
 }
})().catch(e=>{console.error(e);process.exit(1)});
