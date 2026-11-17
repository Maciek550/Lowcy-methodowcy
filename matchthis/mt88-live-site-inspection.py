#!/usr/bin/env python3
"""Read-only production inspection. Never authenticate or POST; no server changes."""
import json, re, collections, unicodedata, traceback, pathlib, os
import requests
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout
SITE="https://matchthis.lowcymethodowcy.smallhost.pl"
OUT=pathlib.Path("/tmp/mt-site-audit")
OUT.mkdir(exist_ok=True)
def result(label, data):
    print("INSPECT",label,json.dumps(data,ensure_ascii=False,default=str),flush=True)
def get(path, timeout=30):
    try:
        r=requests.get(SITE+path,timeout=timeout,allow_redirects=False,headers={"User-Agent":"MatchThis-readonly-inspection-20261117"})
        return r
    except Exception as e:
        result("HTTP_EXCEPTION",{"path":path,"error":str(e)[:250]})
        return None
def backend():
    routes=["/","/panel.php","/mt73-state.php?public=1","/mt73-state.php","/player-session.php","/player-accounts.php","/role-pages/mt88-admin.php","/role-pages/mt88-sedzia.php","/.mt41-private/state-mt73.json","/.mt41-private/users.php","/matchthis-orange-mt79-32.png","/player-recovery.php"]
    statuses={}
    for path in routes:
        r=get(path)
        if r is None:continue
        statuses[path]={"status":r.status_code,"type":r.headers.get("content-type","")[:65],"bytes":len(r.content),"redirect":r.headers.get("location","")[:90]}
    result("HTTP_ENDPOINTS",statuses)
    r=get("/mt73-state.php?public=1",timeout=60)
    if not r or r.status_code!=200:
        result("FAIL_PUBLIC_API",{"status":r.status_code if r else None})
        return
    try:s=r.json();d=s["data"]
    except Exception as e:
        result("FAIL_PUBLIC_PARSE",{"error":str(e)})
        return
    (OUT/"public-metrics.json").write_text(json.dumps({"revision":s.get("revision")},ensure_ascii=False))
    ids={p.get("id") for p in d.get("players",[])}
    name_groups=collections.defaultdict(list)
    def norm(v):
        return re.sub(r"\s+"," ",unicodedata.normalize("NFKC",str(v or "")).strip().casefold())
    for p in d.get("players",[]):
        if p.get("lastName") and p.get("firstName"):
            name_groups[(norm(p["lastName"]),norm(p["firstName"]))].append(p.get("id"))
    duplicates=[{"name":" ".join(key).upper(),"count":len(value),"ids":value} for key,value in name_groups.items() if len(value)>1]
    problems=collections.defaultdict(list)
    group_counts={}
    for group,key in [("events","rounds"),("cycles","tours")]:
        tours=0;results=0;completed=0
        for event in d.get(group,[]):
            for t in event.get(key,[]):
                tours+=1
                rows=t.get("results") or []
                results+=len(rows)
                if t.get("status")=="FINAL":completed+=1
                tids=collections.defaultdict(list)
                pegs=collections.defaultdict(list)
                for i,row in enumerate(rows):
                    cid=row.get("competitorId")
                    ctx={"event":str(event.get("name",""))[:80],"tour":str(t.get("name",""))[:60],"row":i,"player":str(row.get("competitorName",""))[:55]}
                    if not cid or cid not in ids: problems["orphan_player_id"].append({**ctx,"competitorId":cid})
                    if cid:tids[str(cid)].append(i)
                    peg=row.get("peg")
                    sect=row.get("sector")
                    if isinstance(peg,int) and not isinstance(peg,bool):pegs[peg].append(i)
                    if isinstance(row.get("weightG"),(float,str)) or row.get("weightG") is None or isinstance(row.get("weightG"),bool):
                        problems["weight_type"].append({**ctx,"weightG":row.get("weightG")})
                    if isinstance(row.get("weightG"),int) and row["weightG"]>0 and (peg is None or sect in (None,"","—")):
                        problems["positive_weight_missing_peg_or_sector"].append({**ctx,"peg":peg,"sector":sect,"weight":row["weightG"]})
                    if cid in ids and row.get("competitorName") and isinstance(row["competitorName"],str):
                        pass
                for cid,occ in tids.items():
                    if len(occ)>1:problems["duplicate_player_in_tour"].append({"event":event.get("name"),"tour":t.get("name"),"id":cid,"indices":occ})
                for peg,occ in pegs.items():
                    if len(occ)>1:problems["duplicate_peg_in_tour"].append({"event":event.get("name"),"tour":t.get("name"),"peg":peg,"indices":occ})
        group_counts[group]={"count":len(d.get(group,[])),"tours":tours,"published_final_tours":completed,"public_result_rows":results}
    result("LIVE_DATA_COUNTS",{"revision":s.get("revision"),"players":len(d.get("players",[])),"groups":group_counts,"duplicates":len(duplicates)})
    result("PLAYER_DUPLICATES",duplicates[:30])
    result("DATA_ISSUES",{"counts":{k:len(v) for k,v in problems.items()},"examples":{k:v[:15] for k,v in problems.items()}})
    player=[p for p in d.get("players",[]) if norm(p.get("lastName"))=="bartczak" and norm(p.get("firstName"))=="jan"]
    starts=0
    for group,key in [("events","rounds"),("cycles","tours")]:
        for entity in d.get(group,[]):
            for t in entity.get(key,[]):
                starts+=sum(row.get("competitorId")==(player[0]["id"] if player else None) for row in t.get("results",[]))
    result("BARTCZAK_REGRESSION",{"profiles":len(player),"ids":[x.get("id") for x in player],"starts":starts})
    scan_key_hits=[]
    def scan_keys(obj,path="data"):
        if isinstance(obj,dict):
            for k,v in obj.items():
                if re.search(r"(?:password|hash|secret|session|token|^phone$|^email$|csrf|apiKey)",str(k),re.I):
                    scan_key_hits.append(path+"/"+str(k))
                if len(scan_key_hits)<30:scan_keys(v,path+"/"+str(k))
        elif isinstance(obj,list):
            for v in obj[:30]:
                if len(scan_key_hits)<30:scan_keys(v,path+"[]")
    scan_keys(d)
    result("PUBLIC_API_SENSITIVE_KEYS",scan_key_hits[:30])
def browser_checks():
    with sync_playwright() as p:
        for engine in ("chromium","firefox"):
            browser=getattr(p,engine).launch(headless=True)
            try:
                for width in (390,768,1366):
                    page=browser.new_page(viewport={"width":width,"height":900},device_scale_factor=1)
                    js_errors=[];failed=[];console_errors=[]
                    page.on("pageerror",lambda err:js_errors.append(str(err)[:350]))
                    page.on("console",lambda msg:console_errors.append(msg.text[:350]) if msg.type=="error" else None)
                    page.on("response",lambda resp:failed.append({"status":resp.status,"url":resp.url[:150]}) if resp.status>=400 and resp.request.resource_type in ("script","stylesheet","image","document") else None)
                    try:
                        page.goto(SITE+"/",wait_until="domcontentloaded",timeout=60000)
                        page.wait_for_function("document.querySelector('#mt73-sync')?.textContent.includes('Dane z serwera')",timeout=45000)
                        page.wait_for_timeout(600)
                        meta=page.evaluate("""() => {
                          const b=document.body;const header=document.querySelector('.site-sticky');const main=document.querySelector('#main');
                          const safe=el=>{if(!el)return null;const r=el.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)}};
                          return {title:document.title,version:b.dataset.version,role:b.dataset.role,
                            sync:document.querySelector('#mt73-sync')?.textContent.trim().slice(0,150),
                            documentWidth:document.documentElement.scrollWidth,viewportWidth:document.documentElement.clientWidth,
                            header:safe(header),brand:safe(document.querySelector('.brand-group')),nav:safe(document.querySelector('#nav')),tools:safe(document.querySelector('.header-tools')),main:safe(main),
                            navLabels:[...document.querySelectorAll('#nav button')].filter(x=>getComputedStyle(x).display!=='none').map(x=>x.textContent.trim()),
                            visiblePDF:[...document.querySelectorAll('button,a')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden'&&/pdf|foto fb|eksport|drukuj/i.test(e.innerText||e.title||'')).map(e=>(e.innerText||e.title||'').trim().slice(0,60)).slice(0,15),
                            playerNav:!!document.querySelector('#nav [data-view=players]'),
                            homeText:(main?.innerText||'').slice(0,220)};
                        }""")
                        result("BROWSER_HOME_"+engine+"_"+str(width),meta)
                        if width in (390,1366):
                            page.screenshot(path=str(OUT/("home-"+engine+"-"+str(width)+".png")),full_page=True)
                        for view in ("events","archive","home"):
                            loc=page.locator('#nav button[data-view="'+view+'"]')
                            if loc.count()>0 and loc.first.is_visible():
                                try:
                                    loc.first.click(timeout=8000)
                                    page.wait_for_timeout(400)
                                    main_text=page.locator("#main").inner_text(timeout=10000)
                                    detail=page.evaluate("""() => ({
                                      pageMainWidth:document.querySelector('#main')?.scrollWidth,
                                      viewportWidth:document.documentElement.clientWidth,
                                      h1:[...document.querySelectorAll('#main h1,#main h2')].map(e=>e.innerText.trim()).slice(0,8),
                                      buttons:[...document.querySelectorAll('#main button')].filter(e=>e.getClientRects().length).slice(0,16).map(e=>({txt:e.innerText.trim().slice(0,35),action:[...e.attributes].filter(a=>a.name.startsWith('data-')).map(a=>a.name+'='+a.value).join(';')}))
                                    })""")
                                    result("BROWSER_NAV_"+engine+"_"+str(width)+"_"+view,{"mainChars":len(main_text),"sample":main_text[:150].replace("\n"," | "),"detail":detail})
                                    if engine=="chromium" and width==1366 and view in ("events","archive"):
                                        page.screenshot(path=str(OUT/("nav-"+view+".png")),full_page=True)
                                except Exception as e:result("BROWSER_NAV_FAILURE",{"engine":engine,"width":width,"view":view,"error":str(e)[:280]})
                        login=page.locator('#mtLoginOpen')
                        if login.count() and login.is_visible():
                            login.click()
                            player_visible=page.locator('#mt86-player-form').is_visible()
                            admin_tab=page.locator('#mt86-tab-admin')
                            admin_tab.click()
                            admin_visible=page.locator('#mtLoginForm').is_visible()
                            admin_pw=page.locator('#mtLoginForm input[type=password]')
                            admin_max=admin_pw.get_attribute("maxlength") if admin_pw.count() else None
                            register_tab=page.locator('#mt87-tab-register')
                            register_tab.click()
                            registration_visible=page.locator('#mt87-register-form').is_visible()
                            csrf_len=len(page.locator('#mt87-register-csrf').input_value()) if page.locator('#mt87-register-csrf').count() else 0
                            result("BROWSER_AUTH_"+engine+"_"+str(width),{"player":player_visible,"admin":admin_visible,"adminPasswordMaxLength":admin_max,"register":registration_visible,"registerCSRFReady":csrf_len>=20})
                            page.locator('#mtLoginClose').click()
                        result("BROWSER_ERRORS_"+engine+"_"+str(width),{"js":js_errors[:15],"console":console_errors[:15],"failedResources":failed[:12]})
                    except Exception as e:
                        result("BROWSER_FATAL_"+engine+"_"+str(width),{"error":str(e)[:800],"traceback":traceback.format_exc()[-1300:]})
                    finally:
                        page.close()
            finally:browser.close()
if __name__=="__main__":
    backend()
    browser_checks()
    result("INSPECTION_COMPLETE",{"mode":"read_only"})
