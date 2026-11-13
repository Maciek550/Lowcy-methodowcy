const {chromium,firefox}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
  for(const engine of [chromium,firefox]){
    const b=await engine.launch();
    try{
      const p=await b.newPage({viewport:{width:1347,height:768}});
      const errors=[];p.on('pageerror',e=>errors.push(e.message));
      p.setDefaultTimeout(20000);
      await p.goto('https://matchthis.lowcymethodowcy.smallhost.pl/');
      await p.waitForFunction(()=>document.getElementById('mt73-sync')?.textContent.includes('Dane z serwera'));
      assert.equal(await p.title(),'MatchThis MT-76');
      assert.equal(await p.locator('#appversion').innerText(),'MT-76');
      assert.equal(await p.locator('body').getAttribute('data-version'),'MT-76');
      await p.locator('[data-view="archive"]').first().click();
      const fold=p.locator('details[data-year="2025"]');
      if(await fold.getAttribute('open')===null)await fold.locator('summary').click();
      for(const id of ['mt2025-champions_2025','mt2025-mega_final_2025']){
        await p.locator('[data-open="'+id+'"]').first().click();
        for(const round of [0,1]){
          await p.locator('[data-round="'+round+'"]').first().click();
          await p.locator('[data-result-mode="sectors"]').first().click();
          const panels=p.locator('[data-approved-sectors="6"][data-assignment-status="pending"]');
          if(id==='mt2025-mega_final_2025'&&round===1){
            assert.equal(await panels.count(),0);
            assert((await p.locator('body').innerText()).includes('SEKTOR A'));
          }else{
            assert.equal(await panels.count(),1,id+' '+round);
            assert.equal(await p.locator('.mt76-sector-pending').count(),6);
            assert((await panels.innerText()).includes('6 sektorów · zatwierdzone'));
            for(const s of ['A','B','C','D','E','F'])assert.equal(await panels.locator('[data-sector-filter="'+s+'"]').count(),1);
            await panels.locator('[data-sector-filter="C"]').click();
            assert.equal(await p.locator('.mt76-sector-pending').count(),1);
            assert((await p.locator('.mt76-sector-pending').innerText()).includes('SEKTOR C'));
            await p.locator('[data-sector-filter="ALL"]').click();
            assert.equal(await p.locator('.mt76-sector-pending').count(),6);
            await p.setViewportSize({width:390,height:844});
            assert.equal(await p.locator('[data-approved-sectors="6"]').count(),1);
            await p.setViewportSize({width:1347,height:768});
          }
        }
        await p.locator('[data-view="archive"]').first().click();
        const again=p.locator('details[data-year="2025"]');
        if(await again.getAttribute('open')===null)await again.locator('summary').click();
      }
      await p.locator('[data-open="mt2025-champions_2025"]').first().click();
      await p.locator('[data-round="0"]').first().click();
      await p.locator('[data-result-mode="round"]').first().click();
      assert((await p.locator('body').innerText()).includes('KULKA ARTUR'));
      await p.reload();
      await p.waitForFunction(()=>document.getElementById('mt73-sync')?.textContent.includes('Dane z serwera'));
      await p.locator('[data-view="archive"]').first().click();
      const again=p.locator('details[data-year="2025"]');
      if(await again.getAttribute('open')===null)await again.locator('summary').click();
      await p.locator('[data-open="mt2025-champions_2025"]').first().click();
      await p.locator('[data-result-mode="sectors"]').first().click();
      assert.equal(await p.locator('.mt76-sector-pending').count(),6);
      assert.deepEqual(errors,[]);
      console.log('MT76_REAL_UI_SECTOR_A_F_CLICKS_RELOAD_PASS',engine.name());
    }finally{await b.close();}
  }
})().catch(e=>{console.error(e);process.exit(1)});
