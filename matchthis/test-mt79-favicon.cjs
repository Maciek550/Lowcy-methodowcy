'use strict';
const {chromium,firefox}=require('playwright');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const base=process.env.MT79_FAVICON_URL||'http://127.0.0.1:8899/';
const expected={
 'matchthis-orange-mt79-32.png':'c1dc3ff23667d074224eb6eb6265c7c9b5cbc40f0329a63fe3b0199f7b2e3f02',
 'matchthis-orange-mt79-64.png':'1e83413b4db09f971a2f5f5e13cb268ba548a63259eb50f313ca1ece1652c6ce',
 'favicon.ico':'162ac423fdd594d3db0213b05cde40203d2053b44c135b18ea29880c36b60d5c'
};
(async()=>{
 for(const engine of [chromium,firefox]){
  const browser=await engine.launch();
  try{
   const page=await browser.newPage({viewport:{width:1360,height:900}});
   page.setDefaultTimeout(24000);
   const errors=[];page.on('pageerror',e=>errors.push(String(e)));
   await page.goto(base);
   await page.waitForFunction(()=>document.getElementById('mt73-sync')?.textContent.includes('Dane z serwera'));
   assert.equal(await page.title(),'MatchThis MT-79');
   assert.equal(await page.locator('#appversion').innerText(),'MT-79');
   assert.equal(await page.locator('body').getAttribute('data-version'),'MT-79');
   const links=await page.locator('head link[rel~="icon"]').evaluateAll(nodes=>nodes.map(e=>({
      rel:e.rel,type:e.type,sizes:e.sizes.value,href:new URL(e.href).pathname
   })));
   assert.equal(links.length,3,JSON.stringify(links));
   assert.deepEqual(links.map(x=>x.href),[
     '/matchthis-orange-mt79-32.png','/matchthis-orange-mt79-64.png','/favicon.ico'
   ]);
   assert.equal(links[0].sizes,'32x32');
   assert.equal(links[1].sizes,'64x64');
   const suffix=await page.locator('head link[rel="shortcut icon"]').getAttribute('href');
   assert.equal(suffix,'/favicon.ico?matchthis=mt79');
   for(const [filename,sha] of Object.entries(expected)){
      const r=await page.request.get(base+filename+(filename.endsWith('.ico')?'?matchthis=mt79':''),{headers:{'Cache-Control':'no-cache'}});
      assert.equal(r.status(),200,filename+' '+r.status());
      const b=await r.body();
      assert.equal(crypto.createHash('sha256').update(b).digest('hex'),sha,filename);
      if(filename.endsWith('.png')){
       assert.equal(r.headers()['content-type']?.split(';')[0],'image/png');
       const width=filename.includes('-32')?32:64;
       const data=await page.evaluate(async url=>{
        const img=new Image();img.src=url;await img.decode();return [img.naturalWidth,img.naturalHeight];
       },base+filename);
       assert.deepEqual(data,[width,width],filename);
      }else{
       assert.equal(b.readUInt16LE(2),1);
       assert.equal(b.readUInt16LE(4),4);
      }
   }
   assert.equal(await page.locator('[data-view="photoHub"]').count(),0,'Viewer export permission regression');
   await page.locator('[data-view="archive"]').first().click();
   const yr=page.locator('details[data-year="2025"]');
   if(await yr.getAttribute('open')===null)await yr.locator('summary').click();
   await page.locator('[data-open="mt2025-mega_final_2025"]').first().click();
   await page.locator('[data-result-mode="sectors"]').first().click();
   assert.equal(await page.locator('.sector-title').count(),6);
   await page.reload();
   await page.waitForFunction(()=>document.getElementById('mt73-sync')?.textContent.includes('Dane z serwera'));
   assert.equal(await page.title(),'MatchThis MT-79');
   assert.equal(await page.locator('head link[rel~="icon"]').count(),3);
   assert.deepEqual(errors,[]);
   console.log('MT79_SMALL2_BOOKMARK_FAVICON_EXPLICIT_LINK_PNG_ICO_REAL_BROWSER_AND_SECTOR_REGRESSION_PASS',engine.name());
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exit(1)});
