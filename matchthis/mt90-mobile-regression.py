#!/usr/bin/env python3
"""MT90: real browser regression of final ranking overlap, navigation, save and reload."""
from pathlib import Path
import json,os
from playwright.sync_api import sync_playwright
root=Path('matchthis/mt90-release')
assert root.is_dir()
base=(root/'MatchThis_MT-90.html').read_text()
pos=base.index('const MATCHTHIS_ARCHIVE_2026=')+len('const MATCHTHIS_ARCHIVE_2026=')
db=json.JSONDecoder().raw_decode(base[pos:])[0]['data']
assert any(e['id']=='mt2026-mega-match-this-cup-final' for e in db['events'])
FAKE=r'''({fixture,role})=>{
 const state={data:JSON.parse(JSON.stringify(fixture)),revision:52,role,csrf:'s'.repeat(40),posts:0};
 window.__mt90test=state;
 const m=new Map(),store={getItem:k=>m.get(k)||null,setItem:(k,v)=>m.set(k,String(v)),removeItem:k=>m.delete(k),clear:()=>m.clear(),key:i=>[...m.keys()][i]||null,get length(){return m.size}};
 Object.defineProperty(window,'localStorage',{configurable:true,value:store});
 Object.defineProperty(window,'sessionStorage',{configurable:true,value:store});
 window.fetch=async(u,o={})=>{
  const url=String(u);
  if(url.includes('mt73-state.php')&&o.method==='POST'){
   const v=JSON.parse(o.body);state.data=v.data;state.revision++;state.posts++;
   return {ok:true,status:200,json:async()=>({state:{data:state.data,revision:state.revision},csrf:state.csrf,role:state.role})};
  }
  if(url.includes('mt73-state.php'))return {ok:true,status:200,json:async()=>url.includes('public=1')?{data:state.data,revision:state.revision}:{state:{data:state.data,revision:state.revision},role:state.role,csrf:state.csrf}};
  if(url.includes('player-session.php'))return {ok:true,status:200,json:async()=>({authenticated:false,registrationCsrf:'s'.repeat(40)})};
  return {ok:true,status:200,json:async()=>({})};
 };}'''
with sync_playwright() as p:
 for engine in ('chromium','firefox'):
  launch={'headless':True}
  if engine=='chromium' and os.getenv('MT90_CHROMIUM_EXECUTABLE'):
   launch['executable_path']=os.getenv('MT90_CHROMIUM_EXECUTABLE')
   launch['args']=['--no-sandbox']
  try: b=getattr(p,engine).launch(**launch)
  except Exception as err:
   if os.getenv('MT90_ALLOW_NO_FIREFOX')=='1' and engine=='firefox':
    print('LOCAL_FIREFOX_UNAVAILABLE_NOT_TESTED',str(err)[:100]);continue
   raise
  try:
   for suffix,role in [('_OGLADACZ','viewer'),('','admin'),('_SEDZIA','judge')]:
    html=(root/f'MatchThis_MT-90{suffix}.html').read_text()
    for width in (320,360,390,430,768,1366):
     page=b.new_page(viewport={'width':width,'height':900})
     errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
     page.evaluate(FAKE,{'fixture':db,'role':role})
     page.set_content(html,wait_until='domcontentloaded')
     page.wait_for_function("document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera')",timeout=25000)
     assert page.title()=='MatchThis MT-90'
     assert page.locator('body').get_attribute('data-version')=='MT-90'
     assert page.locator('#appversion').inner_text()=='MT-90'
     page.locator('#nav button[data-view="events"]').click()
     page.locator('#main button[data-open="mt2026-mega-match-this-cup-final"]').first.click()
     page.locator('.results-navigation button[data-result-mode="overall"]').first.click()
     assert page.locator('.summary-mobile-list .mobile-rank-entry').count()==46
     assert 'FABISIAK MACIEJ' in page.locator('.mobile-rank-entry').first.inner_text()
     assert 'B / 17' in page.locator('.mobile-rank-entry').first.inner_text()
     assert 'B / 14' in page.locator('.mobile-rank-entry').first.inner_text()
     assert page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1'),(engine,role,width,'root width')
     if width<=780:
      assert page.locator('.summary-mobile-list').first.is_visible()
      bad=page.evaluate('''()=>[...document.querySelectorAll('.summary-mobile-list .mobile-rank-entry,.summary-mobile-list .mobile-rounds,.summary-mobile-list .mobile-tour-cell,.summary-mobile-list .mobile-tour-top')].map((el,i)=>({i,tag:el.className,scroll:el.scrollWidth,client:el.clientWidth})).filter(x=>x.scroll>x.client+1)''')
      assert not bad,(engine,role,width,'overflow',bad[:4])
      labels=page.locator('.summary-mobile-list .mobile-tour-top span')
      assert labels.first.is_visible() and 'SOBOTA 24.10.2026' in labels.first.inner_text()
     else:
      assert page.locator('.summary-mobile-list').first.is_hidden()
      assert page.locator('table.summary-table').first.is_visible()
     page.locator('.results-navigation button[data-round="1"]').click()
     assert 'Wyniki' in page.locator('#main').inner_text() or 'SEKTOR' in page.locator('#main').inner_text()
     page.locator('.results-navigation button[data-result-mode="overall"]').click()
     assert page.locator('.mobile-rank-entry').count()==46
     if role=='admin' and width==390:
      saved=page.evaluate('''()=>JSON.stringify(__mt90test.data.cycles)''')
      page.locator('#nav button[data-view="events"]').click()
      page.locator('#main button[data-view="newCycle"]').first.click()
      form=page.locator('#createCycle')
      assert form.locator('input[name=expectedTours]').input_value()=='6'
      assert form.locator('input[name=countedTours]').input_value()=='4'
      form.locator('input[name=expectedTours]').fill('8')
      form.locator('input[name=countedTours]').fill('5')
      assert form.locator('input[name=countedTours]').get_attribute('max')=='8'
      form.locator('input[name=name]').fill('MT90 Lokalny test zapisu')
      form.locator('input[name=year]').fill('2027')
      form.locator('button[type=submit]').click()
      page.wait_for_function('__mt90test.posts>=1',timeout=10000)
      state=page.evaluate('''()=>({data:__mt90test.data,last:__mt90test.data.cycles.at(-1),prior:JSON.stringify(__mt90test.data.cycles.slice(0,-1))})''')
      assert state['prior']==saved
      assert state['last']['expectedTours']==8 and state['last']['countedTours']==5 and len(state['last']['tours'])==8
      reopened=b.new_page(viewport={'width':width,'height':900})
      reopened_errors=[];reopened.on('pageerror',lambda e:reopened_errors.append(str(e)))
      reopened.evaluate(FAKE,{'fixture':state['data'],'role':'admin'})
      reopened.set_content(html,wait_until='domcontentloaded')
      reopened.wait_for_function("document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera')",timeout=25000)
      persisted=reopened.evaluate('''()=>__mt90test.data.cycles.at(-1)''')
      assert persisted['expectedTours']==8 and persisted['countedTours']==5 and len(persisted['tours'])==8
      assert not reopened_errors,reopened_errors
      reopened.close()
      print('MT90_LOCAL_ADMIN_SAVE_RELOAD_EXISTING_CYCLES_UNCHANGED_PASS',engine,flush=True)
     assert not errs,(engine,role,width,errs)
     print('MT90_MOBILE_CARDS_NAV_VERSIONS_NO_OVERFLOW_PASS',engine,role,width,flush=True)
     page.close()
  finally:b.close()
