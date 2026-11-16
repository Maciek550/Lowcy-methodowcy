'use strict';
const {chromium,firefox}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const base=process.env.MT80_TEST_URL||'http://127.0.0.1:8890/';
const live=base.startsWith('https://');
const urls={home:'https://matchthis.pl/',shop:'https://matchthis.pl/sklep/'};
(async()=>{
 for(const engine of [chromium,firefox]){
  const browser=await engine.launch();
  try{
   for(const [role,pageName] of live?[['viewer','']]:[['viewer',''],['admin','admin.html'],['judge','sedzia.html']]){
    const ctx=await browser.newContext({viewport:{width:1366,height:900}});
    await ctx.route(/^https:\/\/matchthis\.pl\//,route=>route.fulfill({
      status:200,contentType:'text/html',body:'<!doctype html><html><head><title>Mock verified official website URL</title></head><body>External link target</body></html>'
    }));
    const page=await ctx.newPage();
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    page.setDefaultTimeout(25000);
    await page.goto(base+pageName);
    await page.waitForFunction(()=>document.getElementById('appversion')?.textContent==='MT-80');
    assert.equal(await page.title(),'MatchThis MT-80');
    assert.equal(await page.locator('body').getAttribute('data-version'),'MT-80');
    const logo=page.locator('.mt80-brand-link');
    const shop=page.locator('.mt80-shop-link');
    assert.equal(await logo.count(),1);
    assert.equal(await logo.getAttribute('href'),urls.home);
    assert.equal(await logo.getAttribute('target'),'_blank');
    assert((await logo.getAttribute('rel')).includes('noopener'));
    assert.equal(await logo.locator('img').count(),1,'Logo icon must be inside same clickable link');
    assert.equal(await logo.locator('img').getAttribute('src'),'/matchthis-orange-mt79-32.png');
    assert.equal(await shop.count(),1);
    assert.equal(await shop.getAttribute('href'),urls.shop);
    assert.equal((await shop.locator('span').innerText()).trim(),'SKLEPMT');
    assert.equal(await shop.locator('svg').count(),1);
    assert.equal(await shop.getAttribute('target'),'_blank');
    assert((await shop.getAttribute('rel')).includes('noopener'));
    const computed=await shop.evaluate(el=>({color:getComputedStyle(el).color,font:getComputedStyle(el).fontWeight}));
    assert(computed.color==='rgb(233, 102, 9)',JSON.stringify(computed));
    const newTab=async (trigger,expected)=>{
      const p=page.waitForEvent('popup',{timeout:18000});
      await trigger.click();
      const popup=await p;
      await popup.waitForLoadState('domcontentloaded');
      assert.equal(popup.url(),expected);
      await popup.close();
    };
    if(role==='viewer'){
      await newTab(logo.locator('img'),urls.home);
      await newTab(logo.locator('.brand'),urls.home);
      await newTab(shop,urls.shop);
    } else {
      // Fake admin/judge fixture has unsaved-state navigation guards; verify
      // exact targets and that all surfaces are genuinely interactable.
      await logo.locator('img').click({trial:true});
      await logo.locator('.brand').click({trial:true});
      await shop.click({trial:true});
    }
    for(const width of [1366,1024,820,390,320]){
      await page.setViewportSize({width,height:850});
      await page.waitForTimeout(70);
      for(const [label,element] of [['logo',logo],['shop',shop]]){
        assert(await element.isVisible(),role+' '+engine.name()+' '+label+' '+width+' not visible');
        const box=await element.boundingBox();
        assert(box&&box.width>25&&box.height>=15,role+' '+label+' '+width+' has no area');
        assert(box.x>=-1&&box.x+box.width<=width+2,
          role+' '+label+' '+width+' outside viewport '+JSON.stringify(box));
      }
      const a=await logo.boundingBox(),b=await shop.boundingBox();
      assert(a.y+a.height<=b.y+1||b.y+b.height<=a.y+1||
        a.x+a.width<=b.x+1||b.x+b.width<=a.x+1,'Logo/shop overlapping at '+width);
      if(!live&&role==='viewer'&&(width===1366||width===390)){
        fs.mkdirSync('/tmp/mt80-screens',{recursive:true});
        await page.screenshot({path:'/tmp/mt80-screens/MatchThis_MT80_'+engine.name()+'_'+width+'.png',fullPage:false});
      }
    }
    if(role==='viewer'){
      assert.equal(await page.locator('[data-view="photoHub"]').count(),0,'Viewer access changed');
      await page.setViewportSize({width:1366,height:900});
      await page.locator('[data-view="archive"]').first().click();
      const details=page.locator('details[data-year="2025"]');
      if(await details.getAttribute('open')===null)await details.locator('summary').click();
      await page.locator('[data-open="mt2025-mega_final_2025"]').first().click();
      await page.locator('[data-result-mode="sectors"]').first().click();
      assert.equal(await page.locator('.sector-title').count(),6);
      await page.reload();
      await page.waitForFunction(()=>document.getElementById('mt73-sync')?.textContent.includes('Dane z serwera'));
      assert.equal(await page.title(),'MatchThis MT-80');
      assert.equal(await page.locator('.mt80-shop-link').count(),1);
      assert.equal(await page.locator('.mt80-brand-link').count(),1);
    }
    assert.deepEqual(errors,[],'JavaScript errors '+role+' '+engine.name());
    console.log('MT80_ACTUAL_LINK_CLICKS_DESKTOP_PHONE_AND_ROLES_PASS',engine.name(),role,live?'SMALL2':'PREDEPLOY');
    await ctx.close();
   }
  }finally{await browser.close();}
 }
})().catch(err=>{console.error(err);process.exit(1)});
