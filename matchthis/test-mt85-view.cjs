'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,firefox}=require('playwright');
const url=process.env.MT85_URL||'http://127.0.0.1:8785/';
const eventId='mt2026-xiv-puchar-matchthis-28-29-nov';
async function openTarget(page){
 const target=page.locator('[data-open="'+eventId+'"]');
 if(!(await target.count()))await page.locator('[data-view="events"]').first().click();
 if(!(await target.count())){
  const ids=await page.locator('[data-open]').evaluateAll(xs=>xs.map(x=>x.getAttribute('data-open')).slice(0,25));
  throw Error('Target is not in the 2026 events list; displayed IDs: '+JSON.stringify(ids));
 }
 await target.first().click();
}
(async()=>{
 for(const engine of [chromium,firefox]){
  const browser=await engine.launch();
  try{
   const page=await browser.newPage({viewport:{width:1280,height:900}});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text())});
   await page.request.post(url+'mt83-reset');
   const initial=(await (await page.request.get(url+'mt73-state.php?public=1')).json()).data;
   await page.goto(url+'panel.php');
   await page.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera'));
   assert.equal(await page.title(),'MatchThis MT-85');
   assert.equal(await page.locator('body').getAttribute('data-version'),'MT-85');
   assert.equal(await page.locator('.mt-build-badge').innerText(),'MT-85');
   await openTarget(page);
   await page.locator('[data-round="1"]').click();
   await page.locator('[data-result-mode="sectors"]').first().click();
   assert.equal(await page.locator('.mt85-empty-results').count(),1,'Unentered scores must NOT silently show only the draw or a 0g classification');
   assert((await page.locator('.mt85-empty-results').innerText()).includes('Wagi II tury nie zostały jeszcze wprowadzone'));
   assert.equal(await page.locator('.mt85-published-draw').count(),1);
   assert.equal(await page.locator('.mt85-published-draw').getAttribute('open'),null,'draw starts collapsed');
   assert.equal(await page.locator('.mt85-published-draw .mt60-draw-card').count(),6);
   await page.locator('.mt85-empty-results button[data-result-mode="edit"]').click();
   const weights=page.locator('[data-mt55-field="weight"]');
   assert.equal(await weights.count(),71);
   await weights.first().fill('1234');await weights.first().press('Tab');
   await page.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Zapisano na serwerze'));
   const saved=(await (await page.request.get(url+'mt73-state.php?public=1')).json()).data;
   assert.deepEqual(saved.events[0].rounds[0],initial.events[0].rounds[0],'Tour 1 unchanged');
   assert.deepEqual(saved.events[0].rounds[1].mt55Entries.map(r=>[r.competitorId,r.peg,r.sector]),initial.events[0].rounds[1].mt55Entries.map(r=>[r.competitorId,r.peg,r.sector]),'T2 assignments intact');
   assert.equal(saved.events[0].rounds[1].results.filter(r=>r.weightG>0).length,1);
   await page.locator('[data-result-mode="sectors"]').first().click();
   assert.equal(await page.locator('.mt85-empty-results').count(),0,'Saved weight opens results');
   assert.equal(await page.locator('.compact-sector-panel .sector-title').count(),6,'All six classified sectors visible');
   const pos=await page.evaluate(()=>({
    sector:document.querySelector('.compact-sector-panel').getBoundingClientRect().top,
    draw:document.querySelector('.mt85-published-draw').getBoundingClientRect().top,
    open:document.querySelector('.mt85-published-draw').open
   }));
   assert(pos.sector<pos.draw,'Results must appear BEFORE 71-line public draw');
   assert.equal(pos.open,false);
   await page.locator('.mt85-published-draw summary').click();
   assert.equal(await page.locator('.mt85-published-draw').getAttribute('open'),'','Draw remains accessible on demand');
   await page.locator('[data-result-mode="round"]').first().click();
   assert(await page.locator('.mt85-published-draw').count());
   assert((await page.locator('.panel .result-title').first().innerText()).includes('Cała tura'));
   // Regression: 1 weighed angler must not hide 11 zero-gram peers in FOTO FB or vector PDF.
   await page.evaluate(()=>{
    const photo=MatchThisFbPhoto.draw,pdf=MatchThisVectorPdf.create;
    MatchThisFbPhoto.draw=(canvas,args)=>{
      window.__mt85Photo={sector:args.sector,rows:args.ranked.filter(r=>r.sector===args.sector).map(r=>({weightG:r.weightG,place:r.place})),all:args.ranked.length};
      return photo(canvas,args);
    };
    MatchThisVectorPdf.create=(args)=>{
      window.__mt85Pdf={sector:args.sector,rows:args.ranked.filter(r=>!args.sector||r.sector===args.sector).map(r=>({weightG:r.weightG,place:r.place})),all:args.ranked.length};
      return pdf(args);
    };
   });
   await page.locator('[data-result-mode="photo"]').first().click();
   await page.waitForFunction(()=>window.__mt85Photo?.rows?.length>0);
   const photo=await page.evaluate(()=>window.__mt85Photo);
   assert.equal(photo.all,71,'Photo must include all assigned T2 starters, not only catches');
   assert.equal(photo.sector,'A');
   assert.equal(photo.rows.length,12,'Photo sector A includes 12 entries');
   assert.equal(photo.rows.filter(r=>r.weightG===0).length,11,'Zero catches must appear in photo');
   assert(photo.rows.filter(r=>r.weightG===0).every(r=>r.place===7),'PZW: 11 zeros each score mean positions 2–12');
   const beforeExports=(await (await page.request.get(url+'mt73-state.php?public=1')).json()).data;
   const jpgPending=page.waitForEvent('download');
   await page.locator('[data-action="downloadFbPhoto"]').first().click();
   const jpg=await jpgPending, jpgBytes=fs.readFileSync(await jpg.path());
   assert.equal(jpgBytes[0],255);assert.equal(jpgBytes[1],216,'Valid JPEG photo');
   const pdfPending=page.waitForEvent('download',{timeout:7000}).catch(()=>null);
   await page.locator('[data-pdf-sector="A"]').first().click();
   const pdfDownload=await pdfPending;
   if(!pdfDownload){
    const diag=await page.evaluate(()=>({
      rows:window.__mt85Pdf,
      visibleMessages:[...document.querySelectorAll('.toast,.notice,[role="alert"],.alert')].map(e=>e.textContent.slice(0,300)).slice(-10),
      tail:document.body.innerText.slice(-600)
    }));
    console.log('MT85_PDF_DIAGNOSTIC',JSON.stringify(diag));
    throw Error('PDF export did not initiate download');
   }
   const pdfBytes=fs.readFileSync(await pdfDownload.path());
   assert(pdfBytes.subarray(0,8).toString().startsWith('%PDF-'),'Valid vector PDF');
   const pdf=await page.evaluate(()=>window.__mt85Pdf);
   assert.equal(pdf.all,71,'PDF must include all assigned T2 starters');
   assert.equal(pdf.rows.length,12,'PDF sector A includes 12 entries');
   assert.equal(pdf.rows.filter(r=>r.weightG===0).length,11,'Zero catches must appear in PDF');
   assert(!pdfBytes.includes(Buffer.from('/Subtype /Image')),'PDF must not be rasterized');
   const unchangedAfterExports=(await (await page.request.get(url+'mt73-state.php?public=1')).json()).data;
   assert.deepEqual(unchangedAfterExports,beforeExports,'Generating PDF and Foto FB must never modify server data');
   console.log('MT85_FOTO_FB_AND_PDF_VECTOR_12_SECTOR_A_11_ZEROS_71_TOTAL_'+engine.name().toUpperCase()+'_PASS');
   await page.reload();
   await page.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera'));
   await openTarget(page);
   await page.locator('[data-round="1"]').click();
   await page.locator('[data-result-mode="edit"]').first().click();
   assert.equal(await weights.first().inputValue(),'1234','Server roundtrip');
   for(const width of [1280,1024,390]){
    await page.setViewportSize({width,height:900});
    await weights.last().scrollIntoViewIfNeeded();
    await weights.last().click();
    assert.equal(await weights.last().evaluate(el=>el===document.activeElement),true);
   }
   assert.deepEqual(errors,[]);
   console.log('MT85_T2_RESULTS_FIRST_DRAW_COLLAPSED_71_WEIGHTS_SAVE_RELOAD_'+engine.name().toUpperCase()+'_PASS');
  }finally{await browser.close()}
 }
})().catch(e=>{console.error(e);process.exit(1)});
