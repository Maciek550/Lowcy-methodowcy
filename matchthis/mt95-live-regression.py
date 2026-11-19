#!/usr/bin/env python3
"""Read-only live MT95 test: actual MEGA MATCH THIS CUP 2025 six-tour tab dates."""
from playwright.sync_api import sync_playwright
import hashlib,json
URL='https://matchthis.lowcymethodowcy.smallhost.pl/'
with sync_playwright() as p:
 for engine in ('chromium','firefox'):
  browser=getattr(p,engine).launch(headless=True)
  try:
   for width in (320,360,390,430,560,768,1366):
    page=browser.new_page(viewport={'width':width,'height':900})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    r=page.goto(URL,wait_until='domcontentloaded',timeout=60000)
    assert r and r.ok,(engine,width,r.status if r else None)
    page.wait_for_function("document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera')",timeout=45000)
    assert page.title()=='MatchThis MT-95'
    assert page.locator('body').get_attribute('data-version')=='MT-95'
    assert page.locator('#appversion').inner_text()=='MT-95'
    assert page.locator('link[rel="manifest"]').get_attribute('href')=='/matchthis-mt95.webmanifest'
    manifest=page.request.get(URL+'matchthis-mt95.webmanifest',headers={'Cache-Control':'no-cache'},timeout=25000).json()
    assert manifest['version']=='MT-95' and manifest['icons'][-1]['purpose']=='maskable'
    assert manifest['icons'][0]['src']=='/matchthis-mt94-192.png'
    assert page.request.get(URL+'matchthis-mt94-192.png').ok,'bream app icon changed or missing'
    api=page.request.get(URL+'mt73-state.php?public=1',timeout=30000).json()
    cycles=[c for c in api['data']['cycles'] if c.get('year')==2025 and c.get('name','').strip().upper()=='MEGA MATCH THIS CUP 2025']
    assert len(cycles)==1,(engine,width,'MEGA 2025 cycle not found',len(cycles))
    cycle=cycles[0]
    assert len(cycle.get('tours',[]))==6,(engine,width,'six tours missing')
    page.locator('#nav button[data-view="archive"]').click()
    yr=page.locator('details.year-fold[data-year="2025"]')
    assert yr.count()==1
    if yr.get_attribute('open') is None:yr.locator('summary').click()
    page.locator('#main button[data-open="'+cycle['id']+'"]').first.click()
    tabs=page.locator('.results-navigation .rounds button.mt68-round-button')
    assert tabs.count()==6,(engine,width,tabs.count())
    result=page.evaluate("""()=>{
      const r=document.querySelector('.results-navigation .rounds');
      const tabs=[...r.querySelectorAll('button.mt68-round-button')];
      return {width:r.clientWidth,scroll:r.scrollWidth,display:getComputedStyle(r).display,
        cols:getComputedStyle(r).gridTemplateColumns,
        docScroll:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth,
        overall:r.querySelector('button.overall-tab').getBoundingClientRect().width,
        cells:tabs.map(b=>{let s=b.querySelector('small'),br=b.getBoundingClientRect(),sr=s.getBoundingClientRect();
          return {name:b.querySelector('strong').innerText,date:s.innerText,
          sw:s.scrollWidth,cw:s.clientWidth,white:getComputedStyle(s).whiteSpace,
          left:sr.left,right:sr.right,btnLeft:br.left,btnRight:br.right,
          btnScroll:b.scrollWidth,btnClient:b.clientWidth};})};
    }""")
    if width<=780:
     assert result['display']=='grid' and len(result['cols'].split())==(2 if width<=560 else 3),(engine,width,result)
     assert result['scroll']<=result['width']+1,(engine,width,'round nav overflow',result)
     assert result['docScroll']<=result['viewport']+1,(engine,width,'page overflow',result)
     assert result['overall']>=result['width']*.95,(engine,width,'cycle button must span full row')
     for cell in result['cells']:
      assert cell['white']=='normal' and cell['sw']<=cell['cw']+1,(engine,width,'date clipped',cell)
      assert cell['btnScroll']<=cell['btnClient']+1,(engine,width,'text overflowing button',cell)
      assert cell['left']>=cell['btnLeft']-1 and cell['right']<=cell['btnRight']+1,(engine,width,'date crossing button',cell)
      assert '2025' in cell['date'],(engine,width,'wrong historic date',cell)
    else:
     assert result['display']!='grid','desktop changed'
    tabs.nth(1).click()
    assert page.locator('.results-navigation .rounds button[data-round="1"].active').count()==1
    page.locator('.results-navigation .rounds button.overall-tab').click()
    assert page.locator('.results-navigation .rounds button.overall-tab.active').count()==1
    page.locator('.results-navigation .rounds button[data-round="0"]').click()
    assert page.locator('.results-navigation .rounds button[data-round="0"].active').count()==1
    assert not errors,(engine,width,errors)
    print('MT95_LIVE_2025_SIX_TOURS_FULL_DATES_NO_OVERFLOW_CHROMIUM_FIREFOX_PASS',engine,width,flush=True)
    page.close()
  finally:browser.close()
