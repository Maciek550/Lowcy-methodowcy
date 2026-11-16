'use strict';
/* MT82 regression: no invented extra navigation scrollbars, logo own results URL,
   only the shop opens external URL. Click/geometry in real Chromium and Firefox. */
const {chromium,firefox}=require('playwright');
const assert=require('node:assert/strict');
const base=process.env.MT82_URL||'http://127.0.0.1:8892/';
const live=base.startsWith('https://');
const own=live?'https://matchthis.lowcymethodowcy.smallhost.pl/':'http://127.0.0.1:8892/';
(async()=>{
 for(const type of [chromium,firefox]){
  const browser=await type.launch();
  try{
   for(const [role,pageName] of live?[['viewer','']]:[['viewer',''],['admin','admin.html'],['judge','judge.html']]){
    const ctx=await browser.newContext({viewport:{width:1366,height:900}});
    await ctx.route('https://matchthis.pl/**',r=>r.fulfill({status:200,contentType:'text/html',body:'<title>Official shop link</title><p>Sklep</p>'}));
    const p=await ctx.newPage();
    p.setDefaultTimeout(22000);
    const errs=[];p.on('pageerror',e=>errs.push(e.message));
    await p.goto(base+pageName);
    await p.waitForFunction(()=>document.querySelector('#appversion')?.textContent==='MT-82');
    // MT82 production server hydration is asynchronous: do not inspect an empty
    // navigation before the real central state and role menu have loaded.
    if(role!=='judge'){
      await p.waitForFunction(()=>document.querySelectorAll('#nav button,#nav a').length>=4,{timeout:25000});
    }
    assert.equal(await p.title(),'MatchThis MT-82');
    assert.equal(await p.locator('body').getAttribute('data-version'),'MT-82');
    const logo=p.locator('.mt80-brand-link'),shop=p.locator('.mt80-shop-link');
    assert.equal(await logo.count(),1);assert.equal(await shop.count(),1);
    assert.equal(await logo.getAttribute('href'),'/','Logo points only to app homepage');
    assert.equal(await logo.getAttribute('target'),null,'Logo must stay in same tab');
    assert.equal(await logo.locator('img').count(),1,'Logo icon must be clickable');
    assert.equal(await shop.getAttribute('href'),'https://matchthis.pl/sklep/');
    assert.equal((await shop.locator('span').innerText()).trim(),'SKLEP');
    assert.equal(await shop.locator('svg').count(),1);
    assert.equal(await shop.locator('svg circle').count(),2,'Use shop cart icon, not old bag');
    assert.equal(await shop.getAttribute('target'),'_blank');
    assert((await shop.getAttribute('rel')).includes('noopener'));
    const links=await p.locator('.top a[href^="https://matchthis.pl"]').evaluateAll(x=>x.map(el=>el.href));
    assert.deepEqual(links,['https://matchthis.pl/sklep/'],'Only SKLEP may point to external domain');
    // Genuine shop action; no accidental link on brand to external shop.
    if(role==='viewer'){
      const popwait=p.waitForEvent('popup');
      await shop.click();
      const pop=await popwait;await pop.waitForLoadState('domcontentloaded');
      assert.equal(pop.url(),'https://matchthis.pl/sklep/');
      await pop.close();
      await logo.locator('.brand').click();
      await p.waitForLoadState('domcontentloaded');
      assert.equal(p.url(),own);
      await p.waitForFunction(()=>document.querySelectorAll('#nav button,#nav a').length>=4,{timeout:25000});
      assert.equal(await p.title(),'MatchThis MT-82');
      await logo.locator('img').click();
      await p.waitForLoadState('domcontentloaded');
      assert.equal(p.url(),own);
      await p.waitForFunction(()=>document.querySelectorAll('#nav button,#nav a').length>=4,{timeout:25000});
    }else{
      await logo.locator('img').click({trial:true});
      await logo.locator('.brand').click({trial:true});
      await shop.click({trial:true});
    }
    for(const width of [1440,1366,1280,1180,1160,1024,820,600,390,320]){
      await p.setViewportSize({width,height:900});
      await p.waitForTimeout(65);
      const result=await p.evaluate(()=>{
        const nav=document.querySelector('#nav'),root=document.querySelector('.top .header-inner'),brand=document.querySelector('.mt80-brand-link'),shop=document.querySelector('.mt80-shop-link');
        const navStyle=getComputedStyle(nav);
        const box=el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height}};
        const navLinks=[...nav.querySelectorAll('button,a')];
        const hit=el=>{const b=el.getBoundingClientRect();const target=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);return el===target||el.contains(target)};
        return {style:navStyle.overflowX,sw:nav.scrollWidth,cw:nav.clientWidth,
          n:navLinks.length,nav:box(nav),root:box(root),brand:box(brand),shop:box(shop),
          navLinks:navLinks.map(el=>({text:el.textContent.trim(),b:box(el),hit:hit(el)})),
          brandHit:hit(brand.querySelector('.brand')),iconHit:hit(brand.querySelector('img')),shopHit:hit(shop),
          hScroll:document.documentElement.scrollWidth>innerWidth+1};
      });
      assert.equal(result.style,'visible',role+' '+width+' illegal scrollbar');
      // Judge role intentionally has no navigation tabs; admin/viewer must retain all.
      if(role==='judge')assert.equal(result.n,0,'Judge acquired unexpected navigation');
      else assert(result.n>=4,'Navigation lost main items: '+JSON.stringify(result));
      assert(result.sw<=result.cw+2,'Navigation content clipped at '+width+': '+JSON.stringify(result));
      assert(result.brandHit&&result.iconHit&&result.shopHit,'Header link blocked '+role+' '+width);
      assert(!result.hScroll,'Page width overflow '+role+' '+width);
      if(width>=1161){
        // On desktop, brand, menu and store/admin tools must share one row.
        const mid=b=>b.y+b.height/2;
        assert(Math.abs(mid(result.brand)-mid(result.nav))<25||role==='judge',
          'Desktop navigation unexpectedly on second line '+role+' '+width);
        assert(Math.abs(mid(result.brand)-mid(result.shop))<25,
          'Desktop brand and shop must share same compact row '+role+' '+width);
        assert(result.root.height<70,'Desktop header too tall '+role+' '+width+' '+result.root.height);
      }

      for(const item of result.navLinks){
       assert(item.b.width>20&&item.b.height>15,'Zero size nav '+role+' '+width);
       assert(item.b.x>=-1&&item.b.right<=width+2,
         'Nav item clipped beyond viewport '+role+' '+width+' '+item.text);
       assert(item.hit,'Nav button covered '+role+' '+width+' '+item.text);
      }
      for(const b of [result.brand,result.shop]){
       assert(b.x>=-1&&b.right<=width+2,'Header link outside screen '+role+' '+width);
      }
      console.log('MT82_HEADER_NO_SCROLL_NO_CROPPED_BUTTONS_PASS',type.name(),role,width,'nav',result.n);
    }
    if(role==='viewer'){
      await p.setViewportSize({width:1366,height:900});
      assert.equal(await p.locator('[data-view="photoHub"]').count(),0);
      await p.locator('[data-view="archive"]').first().click();
      const yr=p.locator('details[data-year="2025"]');
      if(await yr.getAttribute('open')===null)await yr.locator('summary').click();
      await p.locator('[data-open="mt2025-mega_final_2025"]').first().click();
      await p.locator('[data-result-mode="sectors"]').first().click();
      assert.equal(await p.locator('.sector-title').count(),6);
      await p.reload();
      await p.waitForFunction(()=>document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera'));
      assert.equal(await p.title(),'MatchThis MT-82');
    }
    assert.deepEqual(errs,[],'Javascript page errors '+role+' '+type.name());
    console.log('MT82_LINK_AND_NAV_FINAL_PASS',type.name(),role,live?'SMALL2':'PREFLIGHT');
    await ctx.close();
   }
  }finally{await browser.close();}
 }
})().catch(e=>{console.error(e);process.exit(1)});
