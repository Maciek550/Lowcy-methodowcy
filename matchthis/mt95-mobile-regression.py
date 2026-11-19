#!/usr/bin/env python3
"""MT95 regression: actual browser clicks, six-tour date bounds, three roles, save+reload."""
import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path('matchthis/mt95-release')
html=(root/'MatchThis_MT-95.html').read_text('utf8')
needle='const MATCHTHIS_ARCHIVE_2026='
data=json.JSONDecoder().raw_decode(html[html.index(needle)+len(needle):])[0]['data']
assert any(len(c.get('tours',[]))==6 for c in data['cycles'])
fake=r'''({fixture,role})=>{
 const state={data:JSON.parse(JSON.stringify(fixture)),revision:52,role,csrf:'s'.repeat(40),posts:0};window.__mt95test=state;
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
def capture(page):
 return page.evaluate("""()=>{
  const box=document.querySelector('.results-navigation .rounds');
  const a=[...box.querySelectorAll('button')];
  return {display:getComputedStyle(box).display,cols:getComputedStyle(box).gridTemplateColumns,
   client:box.clientWidth,scroll:box.scrollWidth,viewport:document.documentElement.clientWidth,
   documentScroll:document.documentElement.scrollWidth,
   buttons:a.map(b=>{let r=b.getBoundingClientRect(),d=b.querySelector('small'),dr=d?.getBoundingClientRect();
    return {text:b.innerText,x:r.left,right:r.right,w:r.width,sw:b.scrollWidth,cw:b.clientWidth,
     dsw:d?.scrollWidth,dcw:d?.clientWidth,dleft:dr?.left,dright:dr?.right,white:d?getComputedStyle(d).whiteSpace:null};})};
 }""")
with sync_playwright() as p:
 for engine in ('chromium','firefox'):
  browser=getattr(p,engine).launch(headless=True)
  try:
   for suffix,role in [('_OGLADACZ','viewer'),('','admin'),('_SEDZIA','judge')]:
    page_source=(root/('MatchThis_MT-95'+suffix+'.html')).read_text()
    for width in (320,360,390,430,560,768,1366):
     page=browser.new_page(viewport={'width':width,'height':900})
     errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
     page.evaluate(fake,{'fixture':data,'role':role})
     page.set_content(page_source,wait_until='domcontentloaded')
     page.wait_for_function("document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera')",timeout=25000)
     assert page.title()=='MatchThis MT-95'
     assert page.locator('body').get_attribute('data-version')=='MT-95'
     assert page.locator('#appversion').inner_text()=='MT-95'
     page.locator('#nav button[data-view="events"]').click()
     page.locator('#main button[data-open="mt2026-mega-match-this-cup-cycle"]').first.click()
     assert page.locator('.results-navigation .rounds button.mt68-round-button').count()==6
     x=capture(page)
     if width<=780:
      assert x['display']=='grid',(engine,role,width,x)
      assert len(x['cols'].split())==(2 if width<=560 else 3),(engine,role,width,x['cols'])
      assert x['scroll']<=x['client']+1,(engine,role,width,'grid overflow',x)
      assert x['documentScroll']<=x['viewport']+1,(engine,role,width,'viewport overflow',x)
      for btn in x['buttons'][:6]:
       assert btn['white']=='normal',(engine,role,width,btn)
       assert btn['sw']<=btn['cw']+1,(engine,role,width,'button overflow',btn)
       assert btn['dsw']<=btn['dcw']+1,(engine,role,width,'date overflow',btn)
       assert btn['dleft']>=btn['x']-1 and btn['dright']<=btn['right']+1,(engine,role,width,'date clipped',btn)
       assert re.search(r'\d{2}\.\d{2}\.\d{4}',btn['text']),(engine,role,width,'missing date',btn)
      assert x['buttons'][-1]['w']>=.95*x['client'],(engine,role,width,'cycle button not full width',x)
     else:assert x['display']!='grid',(engine,role,width,'desktop rounds changed')
     page.locator('.results-navigation .rounds button[data-round="1"]').click()
     assert page.locator('.results-navigation .rounds button[data-round="1"].active').count()==1
     page.locator('.results-navigation .rounds button.overall-tab').click()
     assert page.locator('.results-navigation .rounds button.overall-tab.active').count()==1
     page.locator('.results-navigation .rounds button[data-round="0"]').click()
     assert page.locator('.results-navigation .rounds button[data-round="0"].active').count()==1
     if role=='admin' and width==390:
      before=page.evaluate('''()=>JSON.stringify(__mt95test.data.cycles)''')
      page.locator('#nav button[data-view="events"]').click()
      page.locator('#main button[data-view="newCycle"]').first.click()
      form=page.locator('#createCycle')
      assert form.locator('input[name=expectedTours]').input_value()=='6'
      assert form.locator('input[name=countedTours]').input_value()=='4'
      form.locator('input[name=expectedTours]').fill('8')
      form.locator('input[name=countedTours]').fill('5')
      form.locator('input[name=name]').fill('MT95 lokalny test')
      form.locator('input[name=year]').fill('2027')
      form.locator('button[type=submit]').click()
      page.wait_for_function('__mt95test.posts>=1',timeout=10000)
      state=page.evaluate('''()=>({data:__mt95test.data,prior:JSON.stringify(__mt95test.data.cycles.slice(0,-1)),last:__mt95test.data.cycles.at(-1)})''')
      assert state['prior']==before
      assert state['last']['expectedTours']==8 and state['last']['countedTours']==5
      reopened=browser.new_page(viewport={'width':390,'height':900})
      e2=[];reopened.on('pageerror',lambda e:e2.append(str(e)))
      reopened.evaluate(fake,{'fixture':state['data'],'role':'admin'})
      reopened.set_content(page_source,wait_until='domcontentloaded')
      reopened.wait_for_function("document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera')",timeout=25000)
      persisted=reopened.evaluate('''()=>__mt95test.data.cycles.at(-1)''')
      assert persisted['expectedTours']==8 and persisted['countedTours']==5
      assert not e2,e2
      reopened.close()
      print('MT95_ADMIN_SAVE_RELOAD_NO_EXISTING_DATA_CHANGED',engine,flush=True)
     assert not errors,(engine,role,width,errors)
     print('MT95_CHROMIUM_FIREFOX_THREE_ROLES_TOUR_DATES_NO_CLIPPING_PASS',engine,role,width,flush=True)
     page.close()
  finally:browser.close()
