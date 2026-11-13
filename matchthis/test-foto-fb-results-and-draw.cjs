'use strict';
// Real-browser regression for MatchThis admin Foto FB (results JPG and drawing ZIP).
const {chromium,firefox}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const base=process.env.FB_TEST_URL||'http://127.0.0.1:8896/';
const expectedVersion=process.env.FB_EXPECT_VERSION||'MT-77';
const expectDraw=process.env.FB_EXPECT_DRAW==='1';
const imageDir=process.env.FB_ARTIFACT_DIR||'/tmp/fb-proofs';
fs.mkdirSync(imageDir,{recursive:true});
async function photoPixels(page){
 return await page.locator('#fbCanvas').evaluate(canvas=>{
  let context=canvas.getContext('2d');
  let img=context.getImageData(50,50,1,1).data;
  return {width:canvas.width,height:canvas.height,pixel:[...img]};
 });
}
(async()=>{
 for(const engine of [chromium,firefox]){
  const browser=await engine.launch();
  try{
   const page=await browser.newPage({viewport:{width:1400,height:900},acceptDownloads:true});
   const errors=[];page.on('pageerror',err=>errors.push(String(err)));
   page.setDefaultTimeout(25000);
   await page.addInitScript(()=>{
    const original=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(text,...rest){
     (window.__fbDrawnText||(window.__fbDrawnText=[])).push(String(text));
     return original.call(this,text,...rest);
    };
   });
   await page.goto(base);
   await page.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera'),{timeout:30000});
   assert.equal(await page.title(),'MatchThis '+expectedVersion);
   await page.locator('[data-view="photoHub"]').first().click();
   const events=await page.locator('#fbEntity option').evaluateAll(options=>options.map(x=>({value:x.value,label:x.textContent})));
   assert(events.some(x=>x.value==='mt2025-mega_final_2025'),'Missing final in FB picker');
   await page.locator('#fbEntity').selectOption('mt2025-mega_final_2025');
   for(const idx of [0,1]){
    await page.locator('#fbRound').selectOption(String(idx));
    assert.deepEqual(await page.locator('#fbSector option').evaluateAll(x=>x.map(t=>t.value)),['A','B','C','D','E','F']);
    await page.locator('#fbSector').selectOption(idx===0?'C':'F');
    const pixel=await photoPixels(page);
    assert.equal(pixel.width,1080);assert.equal(pixel.height,1350);
    assert(!pixel.pixel.every(c=>c===0),'Blank photo canvas');
    const previewText=await page.locator('#fbPreviewStatus').innerText();
    assert(!/Błąd|Brak wyników|Nie można/i.test(previewText),previewText);
    const drawText=await page.evaluate(()=>window.__fbDrawnText||[]);
    console.log('FB_DIAG',engine.name(),'round',idx,'selected sector',await page.locator('#fbSector').inputValue(),'preview',previewText,'drawn',drawText.filter(v=>/ANNA|SEKTOR|BRAK|ZWYCIĘ|WYNIKI/i.test(v)).slice(-30),'count',drawText.length);
    await page.screenshot({path:path.join(imageDir,'PREVIEW_DIAG_T'+(idx+1)+'_'+engine.name()+'.png'),fullPage:true});
    assert(drawText.some(x=>x.includes('PEIL ANNA')),'Official corrected name not on FB photo');
    assert(drawText.some(x=>x.includes('PEIL ANNA')),'PEIL ANNA missing from current image');
    const downloadPromise=page.waitForEvent('download');
    await page.locator('[data-action="downloadFbPhoto"]').click();
    const dl=await downloadPromise;
    assert(dl.suggestedFilename().endsWith('.jpg'),'Not a JPG '+dl.suggestedFilename());
    const filename=path.join(imageDir,'MEGA_FINAL_2025_T'+(idx+1)+'_'+(idx===0?'C':'F')+'_'+engine.name()+'.jpg');
    await dl.saveAs(filename);
    const buffer=fs.readFileSync(filename);
    assert(buffer.length>25000,'JPG too small '+buffer.length);
    assert(buffer.readUInt16BE(0)===0xffd8,'Invalid JPEG header');
    console.log('FB_RESULTS_JPG_REAL_DOWNLOAD_PASS',engine.name(),'T'+(idx+1),'bytes',buffer.length);
   }
   if(expectDraw){
    const select=page.locator('#mt67DrawEvent');
    assert(await select.count(),'Missing draw exporter picker');
    const candidates=await select.locator('option').evaluateAll(o=>o.map(x=>x.value));
    assert(candidates.includes('mt2025-mega_final_2025'),'Imported real stands missing from draw exporter');
    await select.selectOption('mt2025-mega_final_2025');
    await page.locator('#mt67DrawRound').selectOption('0');
    const zipPromise=page.waitForEvent('download');
    await page.locator('[data-action="mt67DownloadAllDrawSectors"]').click();
    const zip=await zipPromise;
    assert(zip.suggestedFilename().endsWith('.zip'));
    const filename=path.join(imageDir,'MEGA_FINAL_2025_T1_DRAW_'+engine.name()+'.zip');
    await zip.saveAs(filename);
    const buf=fs.readFileSync(filename);
    assert(buf.length>100000,'ZIP too small');
    assert(buf.readUInt32LE(0)===0x04034b50,'Wrong ZIP file signature');
    console.log('FB_DRAW_ZIP_6_SECTORS_DOWNLOAD_PASS',engine.name(),buf.length);
   }
   assert.deepEqual(errors,[],'Unexpected javascript errors');
   console.log('FB_ADMIN_ALL_PREVIEWS_AND_DOWNLOADS_PASS',engine.name());
  }finally{await browser.close();}
 }
})().catch(error=>{console.error(error);process.exit(1)});
