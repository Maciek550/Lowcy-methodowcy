const {chromium,firefox}=require('playwright');
const fs=require('fs'),http=require('http'),assert=require('assert/strict'),path=require('path');
const dir=__dirname;
const server=http.createServer((req,res)=>{const f=path.join(dir,req.url.split('?')[0]);if(f.startsWith(dir)&&fs.existsSync(f)&&fs.statSync(f).isFile()){res.setHeader('Content-Type','text/html');res.end(fs.readFileSync(f));}else{res.statusCode=404;res.end('');}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
for(const [name,engine] of [['Chromium',chromium],['Firefox',firefox]]){
 const browser=await engine.launch({headless:true});try{
 const page=await browser.newPage({viewport:{width:1366,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/MatchThis_MT-63.html');
 const id=await page.evaluate(()=>{const e=db.events.find(mt52IsXiv);const p=e.entrantIds.map(findPlayer).find(p=>fullName(p)==='DERLAGA JAKUB');if(!p)throw Error('Missing DERLAGA');p.nameNeedsReview=true;page='event';selectedId=e.id;roundIndex=0;resultMode='roster';render();return p.id;});
 const row=page.locator('tr').filter({has:page.locator('[data-confirm-entrant="'+id+'"]')});assert.equal(await row.locator('.review-name').count(),1);
 await page.locator('[data-confirm-entrant="'+id+'"]').click();
 const before=await page.evaluate(()=>({event:JSON.stringify(current()),players:JSON.stringify(db.players),cycles:JSON.stringify(db.cycles)}));
 console.log(name,'MT63_STALE_ROSTER_WARNING_REPRODUCED');
 await page.goto(origin+'/MatchThis_MT-64.html');await page.evaluate(()=>{page='event';selectedId=db.events.find(mt52IsXiv).id;roundIndex=0;resultMode='roster';render()});
 assert.equal(await page.title(),'MatchThis MT-64');assert.equal(await page.locator('#appversion').innerText(),'MT-64');
 assert.equal(await page.locator('.review-name').count(),0);assert.equal(await page.locator('[data-confirm-entrant="'+id+'"]').getAttribute('aria-pressed'),'true');
 assert.deepEqual(await page.evaluate(()=>({event:JSON.stringify(current()),players:JSON.stringify(db.players),cycles:JSON.stringify(db.cycles)})),before);
 const scoped=await page.evaluate(id=>{const p=findPlayer(id);return {other:mt64RosterNameNeedsReview({name:'Inne zawody',year:2026},p),changed:mt64RosterNameNeedsReview(current(),{...p,lastName:'INNE NAZWISKO'}),originalFlag:p.nameNeedsReview}},id);assert.deepEqual(scoped,{other:true,changed:true,originalFlag:true});
 await page.locator('[data-confirm-entrant="'+id+'"]').click();await page.locator('[data-confirm-entrant="'+id+'"]').click();await page.reload();await page.evaluate(()=>{page='event';selectedId=db.events.find(mt52IsXiv).id;roundIndex=0;resultMode='roster';render()});
 assert.equal(await page.locator('.review-name').count(),0);assert.equal(await page.locator('[data-confirm-entrant="'+id+'"]').getAttribute('aria-pressed'),'true');assert.deepEqual(errors,[]);
 console.log(name,'MT64_PASS: no stale warning after reload, roster IDs/order/reserve/confirmations/results/players/archives unchanged, other reviews preserved, no JS errors');
 }finally{await browser.close()}
}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
