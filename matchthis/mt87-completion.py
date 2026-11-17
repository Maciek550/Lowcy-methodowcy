from pathlib import Path
import hashlib,json
base=Path('matchthis')
def once(s,a,b):
 assert s.count(a)==1,(a[:100],s.count(a));return s.replace(a,b,1)
expected={'':'810ebd485c21c30da23ba13d439c4aa48afcc92d3947838fc510d26c81d1c7fa','_OGLADACZ':'c79479c2af9af94f795474d8ce0407730d6a0b7f3d6cc36c546737cd0315a596','_SEDZIA':'f74db6bfd00bdfa410cf525582eeb87e4aa4ac9cede28cc617879da0b391c687'}
new={}
for suffix,sha in expected.items():
 p=base/f'MatchThis_MT-87{suffix}.html';s=p.read_text();assert hashlib.sha256(p.read_bytes()).hexdigest()==sha
 pairs=[('.utility-strip{height:42px;background:','.utility-strip{height:28px;background:'),('.utility-inner{max-width:1200px;padding:0 16px}','.utility-inner{max-width:1232px;padding:0 16px;min-height:28px;align-items:center}'),('.utility-inner .utility-mark{border:1px solid #909197;padding:7px 13px}','.utility-inner .utility-mark{border:1px solid #909197;padding:2px 8px;display:inline-flex;align-items:center;line-height:16px}'),('.utility-strip{height:32px;font-size:9px}.utility-mark{padding:4px 8px!important}','.utility-strip{height:28px;font-size:9px}.utility-mark{padding:2px 8px!important}'),('.main{padding-top:13px}','.main{padding-top:8px}'),('.top{padding-left:12px;padding-right:12px;border-bottom-width:2px}','.top{padding-left:0;padding-right:0;border-bottom-width:2px}'),('.top .header-inner{max-width:1280px;display:grid;grid-template-columns:max-content minmax(0,1fr) max-content;align-items:center;gap:7px;min-height:51px;padding:5px 0;justify-content:initial}','.top .header-inner{max-width:1232px;display:grid;grid-template-columns:max-content minmax(0,1fr) max-content;align-items:center;gap:7px;min-height:40px;padding:4px 16px;justify-content:initial}'),('.top .header-inner .brand-group{display:flex;flex-direction:row;align-items:center;justify-content:center;gap:6px;min-height:38px}','.top .header-inner .brand-group{display:flex;flex-direction:row;align-items:center;justify-content:center;gap:6px;min-height:30px;line-height:1}'),('.top .header-inner .mt80-brand-link{display:inline-flex;align-items:center}','.top .header-inner .mt80-brand-link{display:inline-flex;align-items:center;vertical-align:middle}')]
 for a,b in pairs:s=once(s,a,b)
 if suffix=='_OGLADACZ':
  s=once(s,'<button class="btn small" type="submit">Załóż konto</button>','<button class="btn small" type="submit" disabled>Załóż konto</button>')
  a=" const reg=document.getElementById('mt87-register-csrf');if(reg&&j.registrationCsrf)reg.value=j.registrationCsrf;"
  b=a+"\n const registerSubmit=document.querySelector('#mt87-register-form button[type=submit]');\n if(registerSubmit)registerSubmit.disabled=!reg?.value;\n if(!reg?.value){const err=document.getElementById('mt87-register-error');if(err){err.textContent='Nie udało się wczytać sesji. Odśwież stronę, aby założyć konto.';err.hidden=false;}}"
  s=once(s,a,b)
 p.write_text(s);new[suffix]=hashlib.sha256(p.read_bytes()).hexdigest()
d=base/'deploy-mt87-small2.sh';s=d.read_text()
for suffix,sha in expected.items():s=s.replace(sha,new[suffix])
s=s.replace('mt-87-reg-r1','mt-87-reg-r2')
d.write_text(s)
(base/'mt87-final-sha.json').write_text(json.dumps(new))
# Persist rejecting a registration in the actual store, not a temporary null-coalescing array.
p=base/'server/mt87-player-accounts.php';s=p.read_text();s=once(s,"foreach($s['registrations']??[] as &$r)","$s['registrations']??=[];foreach($s['registrations'] as &$r)");p.write_text(s)
# Browser fixture intentionally delays session: render-ready is not authentication-ready.
p=Path('/tmp/mt87-sources/tests/browser-fixture.py');s=p.read_text();s=once(s,"if p=='/player-session.php':","if p=='/player-session.php':\n   import time;time.sleep(0.7)");p.write_text(s)
p=Path('/tmp/mt87-sources/tests/browser-test.py');s=p.read_text();s=once(s,"assert await page.locator('#mt87-register-csrf').input_value()=='registercsrf'", "await page.wait_for_function(\"document.querySelector('#mt87-register-csrf')?.value==='registercsrf'\")\n    assert await page.locator('#mt87-register-form button[type=submit]').is_enabled()")
s=s.replace("assert await page.locator('#nav [data-view=\"profile\"]').count()==1", "await page.locator('#nav [data-view=\"profile\"]').wait_for(state='visible')\n    assert await page.locator('#nav [data-view=\"profile\"]').count()==1")
p.write_text(s)
print('MT87_READY_GATE_COMPACT_HEADER_PATCH',new)
p=Path('/tmp/mt87-sources/tests/browser-fixture.py');s=p.read_text()
fixture="""DATA['events']=[{'id':'history-fixture','name':'HISTORY LINK TEST 2025','year':2025,'type':'event','kind':'EVENT','date':'2025-05-10','archived':True,'entrantIds':['test-player-1','test-player-2'],'rounds':[{'id':'history-round','name':'Tura 1','date':'2025-05-10','status':'FINAL','results':[{'competitorId':'test-player-1','competitorName':'KOWALSKI JAN','sector':'A','peg':7,'weightG':4321},{'competitorId':'test-player-2','competitorName':'NOWAK ADAM','sector':'A','peg':8,'weightG':1234}]}]}]
"""
s=once(s,'class H(BaseHTTPRequestHandler):',fixture+'class H(BaseHTTPRequestHandler):');p.write_text(s)
p=Path('/tmp/mt87-sources/tests/browser-test.py');s=p.read_text()
a="    assert await page.locator('#mt86-player-tools').is_visible()"
b="""    assert await page.locator('.history-event').filter(has_text='HISTORY LINK TEST 2025').count()==1
    assert '4 321' in await page.locator('.history-event').inner_text()
    assert '1/2' in await page.locator('.history-event').inner_text()
    await page.reload()
    await page.locator('#nav [data-view="profile"]').wait_for(state='visible')
    assert '4 321' in await page.locator('.history-event').inner_text()
"""+a
s=once(s,a,b)
a="    assert await page.title()=='MatchThis MT-87'"
b=a+"""
    for zoom in ('1','1.5'):
     await page.evaluate('(zoom)=>document.body.style.zoom=zoom',zoom)
     layout=await page.evaluate('''() => {
      const r=s=>document.querySelector(s).getBoundingClientRect();
      const brand=r('.brand-group'),nav=r('#nav'),tools=r('.header-tools');
      return {overflow:document.documentElement.scrollWidth>innerWidth+1,brand:brand.y+brand.height/2,nav:nav.y+nav.height/2,tools:tools.y+tools.height/2,width:innerWidth,height:r('.header-inner').height};
     }''')
     assert not layout['overflow'],layout
     if w==1366 and zoom=='1':
      assert max(layout['brand'],layout['nav'],layout['tools'])-min(layout['brand'],layout['nav'],layout['tools'])<2,layout
      assert layout['height']<=44,layout
    await page.evaluate("document.body.style.zoom='1'")
"""
s=once(s,a,b);p.write_text(s)
# Verify that rejecting a pending signup persists after rereading the file.
p=Path('/tmp/mt87-sources/tests/php-integration.py');s=p.read_text()
a="  print('MT87_REAL_PHP_REGISTER_CSRF_PENDING_NO_IMMEDIATE_HISTORY_ADMIN_APPROVE_VERIFIED_PLAYER_UNIQUE_ACCOUNT_PASS')"
b="""  status,_,_=request(anon,'/player-register.php',{**payload,'phone':'502123456'})
  state=json.loads((priv/'mt86-player-accounts.json').read_text())
  rejected=next(r for r in state['registrations'] if r['phone']=='502123456')
  status,body,_=request(admin,'/player-accounts.php',{'csrf':csrfAdmin,'op':'rejectRegistration','registrationId':rejected['id']})
  state=json.loads((priv/'mt86-player-accounts.json').read_text())
  rejected=next(r for r in state['registrations'] if r['phone']=='502123456')
  assert rejected['status']=='REJECTED' and 'hash' not in rejected
"""+a
s=once(s,a,b);p.write_text(s)
