#!/usr/bin/env python3
"""Read-only actual SMALL2 browser verification after MT93 UI deployment."""
from playwright.sync_api import sync_playwright
URL='https://matchthis.lowcymethodowcy.smallhost.pl/'
def check_selection(page):
 orange='rgb(233, 102, 9)'
 white='rgb(255, 255, 255)'
 neutral='rgb(52, 56, 65)'
 for selector in ('.results-navigation .rounds button',
                  '.results-navigation .view-modes button[data-result-mode]',
                  '.compact-sector-panel .sector-choice button'):
  for btn in page.locator(selector).all():
   v=btn.evaluate('e=>({active:e.classList.contains("active"),bg:getComputedStyle(e).backgroundColor,fg:getComputedStyle(e).color})')
   assert v['bg']==(orange if v['active'] else white),(selector,v)
   assert v['fg']==(white if v['active'] else neutral),(selector,v)
 assert page.locator('.results-navigation .rounds button.active').count()<=1
 assert page.locator('.results-navigation .view-modes button[data-result-mode].active').count()<=1
 assert page.locator('.compact-sector-panel .sector-choice button.active').count()<=1

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
    assert page.title()=='MatchThis MT-93'
    assert page.locator('body').get_attribute('data-version')=='MT-93'
    assert page.locator('#appversion').inner_text()=='MT-93'
    page.locator('#nav button[data-view="events"]').click()
    page.locator('#main button[data-open="mt2026-mega-match-this-cup-final"]').first.click()
    assert page.locator('.results-navigation button[data-round="0"].active').count()==1
    assert page.locator('.results-navigation button[data-result-mode="sectors"].active').count()==1
    check_selection(page)
    page.locator('.compact-sector-panel button[data-sector-filter="A"]').click()
    assert page.locator('.compact-sector-panel button[data-sector-filter="A"].active').count()==1
    check_selection(page)
    page.locator('.results-navigation button[data-result-mode="round"]').click()
    assert page.locator('.results-navigation button[data-result-mode="round"].active').count()==1
    check_selection(page)
    page.locator('.results-navigation button[data-result-mode="overall"]').first.click()
    assert page.locator('.results-navigation .overall-tab.active').count()==1
    assert page.locator('.results-navigation .view-modes button[data-result-mode="overall"].active').count()==1
    check_selection(page)
    assert page.locator('.mobile-rank-entry').count()>=30,'final results missing'
    assert 'FABISIAK MACIEJ' in page.locator('.mobile-rank-entry').first.inner_text()
    first=page.locator('.summary-mobile-list .mt91-two-round').first
    assert page.locator('.summary-mobile-list .mt91-two-round').count()>=30
    assert first.locator('.mt91-points-part b').all_text_contents()==['1','1']
    assert first.locator('.mt91-points-part small').count()==0,'T1/T2 labels must not be repeated in cells'
    assert page.locator('.results-navigation .mt68-round-button strong').all_text_contents()==['TURA 1','TURA 2']
    assert first.locator('.mt91-math-sign').all_text_contents()==['+','=']
    assert first.locator('.mt91-points-total').text_content()=='2 pkt'
    assert '25 260 g' in first.text_content()
    assert first.locator('.mobile-tour-cell').count()==0
    assert 'B / 17' not in first.text_content() and 'SOBOTA' not in first.text_content()
    assert page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'),(engine,width,'viewport overflow')
    if width<=780:
     assert page.locator('.summary-mobile-list').first.is_visible()
     bad=page.evaluate('''()=>[...document.querySelectorAll('.summary-mobile-list .mt91-two-round,.summary-mobile-list .mt91-points-equation')].map((el,i)=>({i,tag:el.className,scroll:el.scrollWidth,client:el.clientWidth})).filter(x=>x.scroll>x.client+1)''')
     assert not bad,(engine,width,bad[:3])
    else:
     assert page.locator('table.summary-table').first.is_visible()
     assert 'B / 17' in page.locator('table.summary-table').first.inner_text()
     assert 'SOBOTA' in page.locator('table.summary-table').first.inner_text()
    page.locator('.results-navigation button[data-round="1"]').click()
    assert page.locator('.results-navigation button[data-round="1"].active').count()==1
    check_selection(page)
    page.locator('.results-navigation button[data-result-mode="overall"]').click()
    check_selection(page)
    if page.locator('.results-navigation button[data-result-mode="publishedDraw"]').count():
     page.locator('.results-navigation button[data-result-mode="publishedDraw"]').click()
     assert page.locator('.results-navigation .mt61-draw-tab.active').count()==1
     check_selection(page)
    page.locator('#mtLoginOpen').click()
    assert page.locator('#mt86-player-form').is_visible()
    page.locator('#mt86-tab-admin').click()
    assert page.locator('#mtLoginForm').is_visible()
    assert not errors,(engine,width,errors)
    print('MT93_SMALL2_LIVE_BROWSERS_FINAL_TWO_TOURS_VERSION_LOGIN_NO_OVERFLOW_PASS',engine,width,flush=True)
    page.close()
  finally:b.close()
