'use strict';
const {chromium,firefox}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base='http://127.0.0.1:8898/';
const out='/tmp/fb-exhaustive';
fs.mkdirSync(out,{recursive:true});
async function dl(page,file){
 const pending=page.waitForEvent('download',{timeout:25000});
 await page.locator('[data-action="'+file.action+'"]').first().click();
 const d=await pending;
 assert(/\.jpg$/i.test(d.suggestedFilename()),d.suggestedFilename());
 const dest=path.join(out,file.prefix+'-'+d.suggestedFilename());
 await d.saveAs(dest);
 const bytes=fs.readFileSync(dest);
 assert(bytes.length>25000,'JPEG too small '+bytes.length);
 assert(bytes[0]===255&&bytes[1]===216);
 return dest;
}
(async()=>{
 for(const engine of [chromium,firefox]){
  const browser=await engine.launch();
  try{
   const page=await browser.newPage({viewport:{width:1360,height:900},acceptDownloads:true});
   page.setDefaultTimeout(20000);
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(base);
   await page.waitForFunction(()=>document.getElementById('mt73-sync')?.textContent.includes('Dane z serwera'));
   assert.equal(await page.title(),'MatchThis MT-78');
   await page.locator('[data-view="archive"]').first().click();
   let year=page.locator('details[data-year="2025"]');
   if(await year.getAttribute('open')===null) await year.locator('summary').click();
   await page.locator('[data-open="mt2025-mega_final_2025"]').first().click();
   // Actual per-tournament "FOTO FB" button, not photoHub tested previously.
   await page.locator('[data-round="0"]').first().click();
   await page.locator('[data-result-mode="photo"]').first().click();
   let state=await page.locator('#fbPreviewStatus').innerText();
   assert(!/nie jest zdefiniowana|is not defined|Błąd/i.test(state),'Photo preview error '+state);
   await dl(page,{action:'downloadFbPhoto',prefix:'local-tour-0-'+engine.name()});
   await page.locator('[data-round="1"]').first().click();
   await page.locator('[data-result-mode="photo"]').first().click();
   state=await page.locator('#fbPreviewStatus').innerText();
   assert(!/nie jest zdefiniowana|is not defined|Błąd/i.test(state),'Photo preview error T2 '+state);
   await dl(page,{action:'downloadFbPhoto',prefix:'local-tour-1-'+engine.name()});
   // Overall (different exporter) and page navigation across all 54 athletes.
   await page.locator('[data-result-mode="overall"]').first().click();
   await page.locator('[data-result-mode="photoOverall"]').first().click();
   let pages=await page.locator('.overall-photo-nav').innerText();
   assert(pages.includes('Strona 1 / 4'),pages);
   for(let p=1;p<=4;p++){
     assert.equal(await page.locator('#fbOverallCanvas').evaluate(x=>x.width),1080);
     assert.equal(await page.locator('#fbOverallCanvas').evaluate(x=>x.height),1350);
     await dl(page,{action:'downloadOverallFbPhoto',prefix:'local-summary-page'+p+'-'+engine.name()});
     if(p<4)await page.locator('[data-overall-photo-page="'+p+'"]').first().click();
   }
   await page.locator('[data-overall-photo-page="2"]').first().click();
   await page.locator('[data-overall-photo-page="1"]').first().click();
   assert((await page.locator('.overall-photo-nav').innerText()).includes('Strona 2 / 4'));
   assert.deepEqual(errors,[]);
   console.log('MT78_RESULTS_AND_OVERALL_FOTOFB_ALL_SIX_JPG_DOWNLOADS_PASS',engine.name());
  }finally{await browser.close()}
 }
})().catch(e=>{console.error(e);process.exit(1)});
