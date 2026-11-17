#!/usr/bin/env python3
import json,re
from pathlib import Path
from playwright.sync_api import sync_playwright
root=Path('matchthis/mt89-release')
base=(root/'MatchThis_MT-89.html').read_text()
pos=base.index('const MATCHTHIS_ARCHIVE_2026=')+len('const MATCHTHIS_ARCHIVE_2026=')
db=json.JSONDecoder().raw_decode(base[pos:])[0]['data']
# Four planne[d] events are still present on the live server even if absent in old archive seeds.
names=['mt2026-xiv-puchar-matchthis-28-29-nov','mt-mwj0n0dm-hrwptq','mt-mwj1bp7k-8vaq2i','mt-mwj1exa0-v70o58']
for i,eid in enumerate(names):
 if not any(e['id']==eid for e in db['events']):
  db['events'].append({'id':eid,'name':f'Kontrolne zawody {i}','year':2026,'date':'2026-12-01','archived':False,'entrantIds':[],'rounds':[{'id':eid+'-t1','name':'Tura 1','date':'2026-12-01','status':'DRAFT','results':[]}]})
fake=r"""({fixture,role})=>{
 const state={data:JSON.parse(JSON.stringify(fixture)),revision:52,role,csrf:'s'.repeat(40),posts:0};
 window.__mt89test=state;
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
 };
}"""
with sync_playwright() as p:
 for engine in ('chromium','firefox'):
  browser=getattr(p,engine).launch(headless=True)
  try:
   for suffix,role in [('_OGLADACZ','viewer'),('','admin'),('_SEDZIA','judge')]:
    for width in (390,1366):
     page=browser.new_page(viewport={'width':width,'height':880})
     errs=[];page.on('pageerror',lambda e:errs.append(str(e)))
     page.evaluate(fake,{'fixture':db,'role':role})
     page.set_content((root/f'MatchThis_MT-89{suffix}.html').read_text(),wait_until='domcontentloaded')
     page.wait_for_function("document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera')",timeout=20000)
     assert page.title()=='MatchThis MT-89'
     assert page.locator('#appversion').inner_text()=='MT-89'
     page.locator('#nav button[data-view="events"]').click()
     for eid in names:
      assert page.locator(f'#main button[data-open="{eid}"]').count()==1,(engine,role,eid)
      assert page.locator(f'.mt49-two-columns button[data-open="{eid}"]').count()==0
     assert page.evaluate('document.documentElement.scrollWidth<=document.documentElement.clientWidth+1')
     if role=='admin':
      saved=page.evaluate('''() => JSON.stringify(__mt89test.data.cycles)''')
      page.locator('#main button[data-view="newCycle"]').first.click()
      form=page.locator('#createCycle')
      assert form.locator('input[name=expectedTours]').input_value()=='6'
      assert form.locator('input[name=countedTours]').input_value()=='4'
      form.locator('input[name=expectedTours]').fill('8')
      form.locator('input[name=countedTours]').fill('5')
      assert form.locator('input[name=countedTours]').get_attribute('max')=='8'
      form.locator('input[name=name]').fill('Nowy cykl MT89 - test lokalny')
      form.locator('input[name=year]').fill('2027')
      form.locator('button[type=submit]').click()
      page.wait_for_function('__mt89test.posts>=1',timeout=10000)
      st=page.evaluate('''() => ({last:__mt89test.data.cycles.at(-1),old:JSON.stringify(__mt89test.data.cycles.slice(0,-1))})''')
      assert st['old']==saved,'previous cycle changed'
      assert st['last']['expectedTours']==8 and st['last']['countedTours']==5 and len(st['last']['tours'])==8
      page.set_content((root/f'MatchThis_MT-89{suffix}.html').read_text(),wait_until='domcontentloaded')
      page.wait_for_function("document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera')",timeout=20000)
      persisted=page.evaluate('''() => __mt89test.data.cycles.at(-1)''')
      assert persisted['expectedTours']==8 and persisted['countedTours']==5 and len(persisted['tours'])==8
     assert not errs,errs
     print('MT89_LOCAL_CHROMIUM_FIREFOX_SINGLE_PLANNED_CARDS_NEW_CYCLE_SAVE_RELOAD_PASS',engine,role,width,flush=True)
     page.close()
  finally:browser.close()
