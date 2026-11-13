const {chromium,firefox}=require('playwright');const assert=require('node:assert/strict');const names=require('./mt74-final-pegs.json');
const live=process.argv.includes('--live');const root=live?'https://matchthis.lowcymethodowcy.smallhost.pl/':'http://127.0.0.1:8765/';
(async()=>{for(const engine of [chromium,firefox]){const b=await engine.launch();try{for(const role of live?['_OGLADACZ']:['','_OGLADACZ','_SEDZIA']){
 const c=await b.newContext({viewport:{width:1366,height:900}});const p=await c.newPage();p.setDefaultTimeout(15000);let errors=[];p.on('pageerror',e=>errors.push(String(e)));
 let baseline;
 if(!live){await p.goto(root+'MatchThis_MT-72'+role+'.html');baseline=await p.evaluate(()=>JSON.parse(JSON.stringify(db)));if(role!=='_OGLADACZ')await p.evaluate(()=>localStorage.setItem('matchthis-preview-MT-72',JSON.stringify(db)));}
 await p.goto(live?root:root+'MatchThis_MT-74'+role+'.html');assert.equal(await p.title(),'MatchThis MT-74');assert.equal(await p.locator('#appversion').innerText(),'MT-74');assert.equal(await p.locator('body').getAttribute('data-version'),'MT-74');
 const actual=await p.evaluate(()=>JSON.parse(JSON.stringify(db)));const target=actual.events.find(e=>e.id==='mt2025-mega_final_2025');let rows=target.rounds[1].results;assert.equal(rows.length,54);
 for(const r of rows){let peg=names.indexOf(r.competitorName)+1;assert(peg);assert.equal(r.peg,peg);assert.equal(r.sector,String.fromCharCode(65+Math.floor((peg-1)/9)));}
 if(baseline){const original=baseline.events.find(e=>e.id===target.id).rounds[1];for(const r of original.results){let peg=names.indexOf(r.competitorName)+1;r.peg=peg;r.sector=String.fromCharCode(65+Math.floor((peg-1)/9));}assert.deepEqual(actual,baseline,'Only 54 pairs may change');}
 // Click actual UI event and second round, then sector view.
 await p.locator('[data-view="archive"]').first().click();const fold=p.locator('details[data-year="2025"]');if(await fold.getAttribute('open')===null)await fold.locator('summary').click();await p.locator('[data-open="mt2025-mega_final_2025"]').first().click();await p.locator('[data-round="1"]').first().click();await p.locator('[data-result-mode="sectors"]').first().click();
 for(const name of ['SOBUSIAK KAMIL','PASTUSZKA TOMASZ','KURCZYŃSKI MARIUSZ'])assert((await p.locator('body').innerText()).includes(name));
 for(const width of [1366,768,390]){await p.setViewportSize({width,height:900});assert(await p.locator('#appversion').isVisible());}
 await p.reload();const reread=await p.evaluate(()=>db.events.find(e=>e.id==='mt2025-mega_final_2025').rounds[1].results.map(r=>[r.competitorName,r.peg,r.sector]));assert.equal(reread.filter(r=>r[1]&&r[2]).length,54);
 if(role!=='_OGLADACZ'){assert(await p.evaluate(()=>!!localStorage.getItem('matchthis-preview-MT-72')));assert(await p.evaluate(()=>!!localStorage.getItem('matchthis-preview-MT-74')));}
 if(role==='_OGLADACZ')assert.equal(await p.locator('[data-action="downloadOverallPdf"]:visible').count(),0);
 assert.deepEqual(errors,[]);console.log('MT74_PASS',engine.name(),role,'54 assignments, reload, UI, version, regression');await c.close();
}}finally{await b.close()}}})().catch(e=>{console.error(e);process.exit(1)});
