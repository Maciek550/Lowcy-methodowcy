#!/usr/bin/env python3
"""Read-only actual SMALL2 browser verification after MT90 UI deployment."""
from playwright.sync_api import sync_playwright
URL='https://matchthis.lowcymethodowcy.smallhost.pl/'
with sync_playwright() as p:
 for engine in ('chromium','firefox'):
  b=getattr(p,engine).launch(headless=True)
  try:
   for width in (320,390,768,1366):
    page=b.new_page(viewport={'width':width,'height':900})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    response=page.goto(URL,wait_until='domcontentloaded',timeout=60000)
    assert response and response.ok,(engine,width,response.status if response else None)
    page.wait_for_function("document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera')",timeout=45000)
    assert page.title()=='MatchThis MT-90'
    assert page.locator('body').get_attribute('data-version')=='MT-90'
    assert page.locator('#appversion').inner_text()=='MT-90'
    page.locator('#nav button[data-view="events"]').click()
    page.locator('#main button[data-open="mt2026-mega-match-this-cup-final"]').first.click()
    page.locator('.results-navigation button[data-result-mode="overall"]').first.click()
    assert page.locator('.mobile-rank-entry').count()>=30,'final results missing'
    assert 'FABISIAK MACIEJ' in page.locator('.mobile-rank-entry').first.inner_text()
    assert 'B / 17' in page.locator('.mobile-rank-entry').first.inner_text()
    assert 'B / 14' in page.locator('.mobile-rank-entry').first.inner_text()
    assert page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'),(engine,width,'viewport overflow')
    if width<=780:
     assert page.locator('.summary-mobile-list').first.is_visible()
     bad=page.evaluate('''()=>[...document.querySelectorAll('.summary-mobile-list .mobile-rank-entry,.summary-mobile-list .mobile-rounds,.summary-mobile-list .mobile-tour-cell,.summary-mobile-list .mobile-tour-top')].map((el,i)=>({i,tag:el.className,scroll:el.scrollWidth,client:el.clientWidth})).filter(x=>x.scroll>x.client+1)''')
     assert not bad,(engine,width,bad[:3])
    else:
     assert page.locator('table.summary-table').first.is_visible()
    page.locator('.results-navigation button[data-round="1"]').click()
    page.locator('.results-navigation button[data-result-mode="overall"]').click()
    page.locator('#mtLoginOpen').click()
    assert page.locator('#mt86-player-form').is_visible()
    page.locator('#mt86-tab-admin').click()
    assert page.locator('#mtLoginForm').is_visible()
    assert not errors,(engine,width,errors)
    print('MT90_SMALL2_LIVE_BROWSERS_FINAL_TWO_TOURS_VERSION_LOGIN_NO_OVERFLOW_PASS',engine,width,flush=True)
    page.close()
  finally:b.close()
