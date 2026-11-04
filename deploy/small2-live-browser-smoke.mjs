import assert from 'node:assert/strict';
import { chromium, firefox } from 'playwright';

const origin='https://lowcymethodowcy.smallhost.pl';
const configs=[
 {name:'desktop',viewport:{width:1365,height:900}},
 {name:'mobile',viewport:{width:390,height:844},isMobile:true,hasTouch:true}
];

for(const [engineName,engine] of [['chromium',chromium],['firefox',firefox]]){
  const browser=await engine.launch({headless:true});
  try {
    for(const config of configs){
      const ctx=await browser.newContext({
        viewport:config.viewport,
        isMobile:config.isMobile||false,
        hasTouch:config.hasTouch||false,
        serviceWorkers:'block',
        locale:'pl-PL',
      });
      try {
        const page=await ctx.newPage();
        const errors=[];
        page.on('pageerror',error=>errors.push('PAGEERROR '+String(error.message).slice(0,300)));
        page.on('console',message=>{
          if(message.type()==='error')errors.push('CONSOLE '+String(message.text()).slice(0,300));
        });
        const response=await page.goto(origin+'/',{waitUntil:'domcontentloaded',timeout:60000});
        assert.equal(response?.status(),200,'root status '+engineName);
        await page.locator('#loginForm').waitFor({state:'visible',timeout:35000});
        assert.match(await page.title(),/V311/);
        assert.equal(await page.locator('#loginPhone').count(),1);
        assert.equal(await page.locator('#loginPassword').count(),1);
        const toggle=page.locator('#loginPasswordToggle');
        assert.equal(await toggle.count(),1);
        await toggle.click();
        assert.equal(await page.locator('#loginPassword').getAttribute('type'),'text');
        await toggle.click();
        assert.equal(await page.locator('#loginPassword').getAttribute('type'),'password');

        const dimension=await page.evaluate(()=>({
          scrollWidth:document.documentElement.scrollWidth,
          clientWidth:document.documentElement.clientWidth,
          bodyScrollWidth:document.body.scrollWidth
        }));
        assert.ok(dimension.scrollWidth <= dimension.clientWidth+2,
          'Unexpected horizontal overflow '+JSON.stringify(dimension));
        await page.waitForTimeout(1500);
        assert.deepEqual(errors,[],'Unexpected JS console errors on '+engineName+' '+config.name);
        console.log('SMALL2_LIVE_UI_OK '+engineName+' '+config.name+
          ' title='+JSON.stringify(await page.title())+
          ' width='+dimension.clientWidth+
          ' scroll='+dimension.scrollWidth);
        await page.screenshot({path:'small2-'+engineName+'-'+config.name+'.png',fullPage:true});
      } finally {await ctx.close();}
    }
  } finally {await browser.close();}
}
