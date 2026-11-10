'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert/strict');
const {chromium,firefox}=require('playwright');
const D=path.resolve('matchthis'), fixture=path.resolve('/tmp/mt73-fixture'),base='http://127.0.0.1:8873';
fs.mkdirSync(fixture+'/.mt41-private',{recursive:true});fs.mkdirSync(fixture+'/role-pages',{recursive:true});
for(const name of ['mt73-store.php','mt73-state.php'])fs.copyFileSync(D+'/'+name,fixture+'/'+name);
fs.writeFileSync(fixture+'/mt73-state.php',fs.readFileSync(D+'/mt73-state.php','utf8').replace("'https://'","'http://'"));
fs.writeFileSync(fixture+'/.mt41-private/mt41-auth.php',fs.readFileSync(D+'/mt41-auth.php','utf8').replace("'secure'=>true","'secure'=>false"));
fs.copyFileSync(D+'/mt41-login.php',fixture+'/login.php');
fs.copyFileSync(D+'/mt60-draws.php',fixture+'/mt60-draws.php');
fs.writeFileSync(fixture+'/.mt41-private/mt60-published-draws.json','[]');
for(const [suffix,name] of [['','admin'],['_SEDZIA','sedzia']])fs.writeFileSync(fixture+'/role-pages/mt73-'+name+'.php','<?php if(!defined("MATCHTHIS_AUTHED")){http_response_code(404);exit;} ?>'+fs.readFileSync(D+'/MatchThis_MT-73'+suffix+'.html','utf8'));
fs.copyFileSync(D+'/MatchThis_MT-73_OGLADACZ.html',fixture+'/index.html');
fs.copyFileSync(D+'/MT73_SEED.html',fixture+'/seed.html');
fs.writeFileSync(fixture+'/panel.php',fs.readFileSync(D+'/mt41-panel.php','utf8').replaceAll('mt41-admin.php','mt73-admin.php').replaceAll('mt41-sedzia.php','mt73-sedzia.php'));
cp.execFileSync('php',['-r',`$u=['admin'=>['role'=>'admin','hash'=>password_hash('fixture-only-password',PASSWORD_DEFAULT)],'judge'=>['role'=>'judge','hash'=>password_hash('fixture-only-password',PASSWORD_DEFAULT)]];file_put_contents($argv[1],'<?php if(!defined("MATCHTHIS_AUTH_INTERNAL")){http_response_code(404);exit;}return '.var_export($u,true).';');`,fixture+'/.mt41-private/users.php']);
const server=cp.spawn('php',['-S','127.0.0.1:8873','-t',fixture],{stdio:'ignore'});
const browsers=[];
const clone=x=>JSON.parse(JSON.stringify(x));
(async()=>{
 try{
  const b=await chromium.launch({headless:true});browsers.push(b);const p=await b.newPage();p.setDefaultTimeout(15000);
  await p.goto(base+'/seed.html');await p.waitForFunction(()=>window.__MT73_SEED?.events?.length>0);
  const seed=await p.evaluate(()=>window.__MT73_SEED);assert.equal(seed.events.length,14);assert.equal(seed.cycles.length,2);
  const traper=seed.events.find(e=>e.id==='mt2026-traper-cup-kobialka');
  const verified=JSON.parse(fs.readFileSync(D+'/mt73-traper-verified.json'));
  for(const [sector,peg,name,weight] of verified){const r=traper.rounds[0].results.find(r=>r.sector===sector&&r.peg===peg);assert.equal(r.competitorName,name);assert.equal(r.weightG,weight);assert.equal(r.nameNeedsReview,false);}
  assert.equal(traper.rounds[0].results.reduce((n,r)=>n+r.weightG,0),170210);
  const cy=seed.cycles.find(c=>c.id==='mt2026-mega-match-this-cup-cycle');assert.equal(cy.officialRows['mt2026-person-chyb-andrzej'].weightG,6040);assert.equal(cy.officialRows['mt2026-person-krackowski-kazimierz'].weightG,4745);
  fs.writeFileSync(D+'/mt73-seed.json',JSON.stringify(seed));await b.close();
  for(const [label,engine] of [['Chromium',chromium],['Firefox',firefox]]){
   fs.writeFileSync(fixture+'/.mt41-private/state-mt73.json',JSON.stringify({revision:1,seeded:true,data:seed}));
   const browser=await engine.launch({headless:true}),admin=await browser.newContext(),judge=await browser.newContext(),viewer=await browser.newContext();
   browsers.push(browser);const errors=[];
   async function open(context,user){context.setDefaultTimeout(15000);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
    if(user)await context.request.post(base+'/login.php',{form:{username:user,password:'fixture-only-password'}});
    await page.goto(base+(user?'/panel.php':'/'));await page.waitForFunction(()=>document.getElementById('mt73-sync').textContent.includes('Dane z serwera'));
    assert.equal(await page.title(),'MatchThis MT-73');assert.equal(await page.locator('#appversion').innerText(),'MT-73');return page;}
   const a=await open(admin,'admin'),v=await open(viewer);
   async function state(context){const r=await context.request.get(base+'/mt73-state.php');assert.equal(r.status(),200);return await r.json();}
   async function post(context,body,token){const r=await context.request.post(base+'/mt73-state.php',{data:body,headers:{'X-MT-CSRF':token}});return {status:r.status(),body:await r.json()};}
   // Actual UI create -> server -> separate browser context -> reload.
   await a.locator('[data-view="events"]').first().click();await a.locator('[data-view="newEvent"]').first().click();await a.locator('#createEvent [name="name"]').fill('TEST ZAPISU '+label);
   await a.locator('#createEvent [type="submit"]').click();await a.waitForFunction(()=>document.getElementById('mt73-sync').textContent.startsWith('Zapisano'));
   let s=await state(admin);assert(s.state.data.events.some(e=>e.name==='TEST ZAPISU '+label));await a.reload();await a.waitForFunction(()=>document.getElementById('mt73-sync').textContent.includes('Dane z serwera'));
   const fresh=await browser.newContext();const f=await open(fresh,'admin');await f.locator('[data-view="events"]').first().click();assert((await f.locator('body').innerText()).includes('TEST ZAPISU '+label));
   // Prepare an isolated editable fixture round through the API, preserving the rest of the database.
   let editable=clone(s.state.data);editable.events[0].rounds[0].status='DRAFT';let r=await post(admin,{op:'save',base:s.state.data,data:editable},s.csrf);assert.equal(r.status,200);
   const j=await open(judge,'judge');await j.locator('[data-view="events"]').first().click();
   await j.locator('[data-open="'+editable.events[0].id+'"]').first().click();await j.locator('[data-result-mode="edit"]').first().click();
   await j.locator('[data-weight-index="0"]').fill('12345');await j.locator('[data-action="saveJudgeWeights"]').click();await j.waitForFunction(()=>document.getElementById('mt73-sync').textContent.startsWith('Zapisano'));
   s=await state(admin);assert.equal(s.state.data.events[0].rounds[0].results[0].weightG,12345);
   // Permissions, CSRF, anonymous write and simultaneous edits.
   let js=await state(judge),bad=clone(js.state.data);bad.players[0].lastName='FORBIDDEN';assert.equal((await post(judge,{op:'save',base:js.state.data,data:bad},js.csrf)).status,422);
   assert.equal((await post(admin,{op:'save',base:s.state.data,data:s.state.data},'bad')).status,403);
   assert.equal((await viewer.request.post(base+'/mt73-state.php',{data:{op:'save'}})).status(),401);
   const original=clone(s.state.data),one=clone(original),two=clone(original);one.players[0].club='ONE';two.players[1].club='TWO';
   assert.equal((await post(admin,{op:'save',base:original,data:one},s.csrf)).status,200);assert.equal((await post(admin,{op:'save',base:original,data:two},s.csrf)).status,200);
   const conflict=clone(original);conflict.players[0].club='CONFLICT';assert.equal((await post(admin,{op:'save',base:original,data:conflict},s.csrf)).status,409);
   s=await state(admin);assert.equal(s.state.data.players[0].club,'ONE');assert.equal(s.state.data.players[1].club,'TWO');
   // Public API must not reveal draft weights or personal notes.
   const pub=await (await viewer.request.get(base+'/mt73-state.php?public=1')).json();assert.equal(pub.data.events[0].rounds[0].results.length,0);assert(!JSON.stringify(pub).includes('CONFLICT'));
   // Network failure preserves queue and recovery performs a real server write.
   await a.reload();await a.waitForFunction(()=>document.getElementById('mt73-sync').textContent.includes('Dane z serwera'));
   await a.route('**/mt73-state.php',route=>route.request().method()==='POST'?route.abort():route.continue());
   await a.locator('[data-view="events"]').first().click();await a.locator('[data-view="newEvent"]').first().click();await a.locator('#createEvent [name="name"]').fill('OFFLINE '+label);await a.locator('#createEvent [type="submit"]').click();
   await a.waitForFunction(()=>document.getElementById('mt73-sync').textContent.includes('Nie zapisano'));assert(await a.evaluate(()=>!!localStorage.getItem('matchthis-server-pending-v1')));
   await a.unroute('**/mt73-state.php');await a.locator('#mt73-retry').click();await a.waitForFunction(()=>document.getElementById('mt73-sync').textContent.startsWith('Zapisano'));
   assert((await state(admin)).state.data.events.some(e=>e.name==='OFFLINE '+label));
   // Responsive read-only viewer, actual sector navigation and no export controls.
   await v.reload();await v.waitForFunction(()=>document.getElementById('mt73-sync').textContent.includes('Dane z serwera'));
   await v.locator('[data-view="events"]').first().click();await v.locator('[data-open="mt2026-traper-cup-kobialka"]').click();await v.locator('[data-result-mode="sectors"]').first().click();
   assert((await v.locator('body').innerText()).includes('KRÓLIKOWSKI ARTUR'));
   assert.equal(await v.locator('[data-action="export"]:visible,[data-action="downloadFbPhoto"]:visible').count(),0);
   for(const width of [1366,768,390]){await v.setViewportSize({width,height:900});await v.locator('[data-sector-filter="B"]').click();assert((await v.locator('body').innerText()).includes('MAZURCZAK GRZEGORZ'));}
   assert.deepEqual(errors,[]);
   await browser.close();console.log('MT73_REAL_UI_SAVE_RELOAD_SECOND_DEVICE_JUDGE_AUTH_CONFLICT_OFFLINE_VIEWER_PASS',label);
  }
  // First administrator imports the existing browser, later stale copies are archived only.
  fs.writeFileSync(fixture+'/.mt41-private/state-mt73.json',JSON.stringify({revision:1,seeded:true,data:seed}));
  const mb=await chromium.launch({headless:true});browsers.push(mb);
  for(const number of [1,2]){
   const mc=await mb.newContext(),legacy=clone(seed);legacy.events.push({...clone(seed.events[0]),id:'legacy-'+number,name:'LEGACY '+number});
   await mc.addInitScript(value=>localStorage.setItem('matchthis-preview-MT-72',JSON.stringify(value)),legacy);
   await mc.request.post(base+'/login.php',{form:{username:'admin',password:'fixture-only-password'}});
   const mp=await mc.newPage();mp.setDefaultTimeout(15000);await mp.goto(base+'/panel.php');await mp.waitForFunction(()=>document.getElementById('mt73-sync').textContent.includes('Dane z serwera'));
   const ms=await (await mc.request.get(base+'/mt73-state.php')).json();
   assert(ms.state.data.events.some(e=>e.id==='legacy-1'));assert(!ms.state.data.events.some(e=>e.id==='legacy-2'));
   assert(await mp.evaluate(()=>!!localStorage.getItem('matchthis-preview-MT-72')));
   await mc.close();
  }
  const archives=fs.readdirSync(fixture+'/.mt41-private/mt73-history').map(n=>JSON.parse(fs.readFileSync(fixture+'/.mt41-private/mt73-history/'+n)));
  assert(archives.some(a=>a.kind==='legacy-original'&&a.data.events.some(e=>e.id==='legacy-2')));
  await mb.close();console.log('MT73_LEGACY_IMPORT_AND_SECOND_BROWSER_ARCHIVE_PASS');
  // Actual restoration into the isolated fixture store: read bytes from archive, validate roundtrip.
  const original=fs.readFileSync(fixture+'/.mt41-private/state-mt73.json');cp.execFileSync('tar',['-czf','/tmp/mt73-test-backup.tar.gz','-C',fixture,'.mt41-private']);
  const restored='/tmp/mt73-restore';fs.mkdirSync(restored,{recursive:true});cp.execFileSync('tar',['-xzf','/tmp/mt73-test-backup.tar.gz','-C',restored]);assert(fs.readFileSync(restored+'/.mt41-private/state-mt73.json').equals(original));
  console.log('MT73_BACKUP_RESTORE_STATE_BYTE_IDENTICAL_PASS');
 }catch(error){for(const browser of browsers){for(const context of browser.contexts()){for(const page of context.pages()){console.error('PAGE_DIAGNOSTIC',page.url(),(await page.locator('body').innerText({timeout:1000}).catch(()=>'')).slice(0,1800));}}}throw error;}finally{for(const browser of browsers)await browser.close().catch(()=>{});server.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
