const {chromium,firefox}=require('playwright');
const fs=require('fs'),http=require('http'),assert=require('assert/strict'),path=require('path');
const dir=__dirname;
const server=http.createServer((req,res)=>{const f=path.join(dir,req.url.split('?')[0]);if(f.startsWith(dir)&&fs.existsSync(f)&&fs.statSync(f).isFile()){res.setHeader('Content-Type','text/html');res.end(fs.readFileSync(f));}else{res.statusCode=404;res.end('');}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
for(const [name,engine] of [['Chromium',chromium],['Firefox',firefox]]){
 if(process.env.MT63_CHROMIUM_ONLY&&name==='Firefox')continue;
 const browser=await engine.launch({headless:true,...(process.env.MT63_CHROMIUM_ONLY?{executablePath:'/usr/bin/chromium'}:{})});
 try{
 const ctx=await browser.newContext({viewport:{width:1366,height:900}});const p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.goto(origin+'/MatchThis_MT-62.html');
 await p.evaluate(()=>{const ids=[];for(let i=1;i<=50;i++){const id='mt63-test-'+i;db.players.push({id,firstName:'JAN',lastName:'TEST '+String(i).padStart(2,'0'),archived:false});ids.push(id)}db.players.push({id:'mt63-reserve',firstName:'',lastName:'REZERWACJA',isReservation:true});
 db.events.push({id:'mt63-test',name:'Test potwierdzeń',kind:'EVENT',year:2099,date:'2099-06-01',archived:false,entrantIds:[...ids,'mt63-reserve'],rounds:[{id:'mt63-t1',name:'Tura 1',date:'2099-06-01',status:'DRAFT',results:[]},{id:'mt63-t2',name:'Tura 2',date:'2099-06-02',status:'DRAFT',results:[]}]});page='event';selectedId='mt63-test';roundIndex=0;resultMode='draw';save();render();});
 assert.equal(await p.locator('#pegs').inputValue(),'1-50');assert.equal(await p.locator('[data-confirm-entrant]').count(),0);console.log(name,'BASELINE_REPRODUCED: all 50 enter draw without confirmation');
 const archives=await p.evaluate(()=>JSON.stringify(db.cycles));
 await p.goto(origin+'/MatchThis_MT-63.html');
 await p.evaluate(()=>{page='event';selectedId='mt63-test';roundIndex=0;resultMode='roster';render()});
 assert.equal(await p.title(),'MatchThis MT-63');assert.equal(await p.locator('#appversion').innerText(),'MT-63');
 assert.equal(await p.locator('[data-confirm-entrant]').count(),50);
 assert.match(await p.locator('.mt63-summary').innerText(),/Zawodników na liście 50/);
 await p.locator('[data-result-mode="draw"]').click();assert.equal(await p.locator('#pegs').inputValue(),'');
 await p.locator('[data-action="draw"]').click();assert.equal(await p.evaluate(()=>current().rounds[0].mt55Entries?.filter(x=>x.peg!=null).length||0),0);
 await p.locator('[data-result-mode="roster"]').click();
 for(let i=1;i<=45;i++)await p.locator('[data-confirm-entrant="mt63-test-'+i+'"]').click();
 assert.equal(await p.locator('.mt63-confirm.confirmed').count(),45);
 const summary=await p.locator('.mt63-summary').innerText();assert.match(summary,/Potwierdzonych do losowania 45/);assert.match(summary,/Niepotwierdzonych 5/);
 assert.equal(await p.locator('[data-confirm-entrant="mt63-test-1"]').evaluate(x=>getComputedStyle(x).backgroundColor),'rgb(22, 115, 58)');
 await p.locator('[data-confirm-entrant="mt63-test-45"]').click();assert.equal(await p.locator('.mt63-confirm.confirmed').count(),44);
 await p.locator('[data-confirm-entrant="mt63-test-45"]').click();
 await p.reload();await p.evaluate(()=>{page='event';selectedId='mt63-test';roundIndex=0;resultMode='roster';render()});
 assert.equal(await p.locator('.mt63-confirm.confirmed').count(),45);assert.equal(await p.evaluate(()=>JSON.stringify(db.cycles)),archives);
 for(const width of [1366,768,390]){await p.setViewportSize({width,height:900});await p.evaluate(()=>{window.scrollTo(0,document.body.scrollHeight)});const bad=await p.locator('.mt63-summary').evaluate(x=>x.scrollWidth>x.clientWidth+2);assert.equal(bad,false);}
 await p.setViewportSize({width:1366,height:900});await p.evaluate(()=>{document.body.style.zoom='1.25'});assert.equal(await p.locator('.mt63-summary').evaluate(x=>x.scrollWidth>x.clientWidth+2),false);await p.evaluate(()=>{document.body.style.zoom='1'});
 await p.locator('[data-result-mode="draw"]').click();assert.equal(await p.locator('#pegs').inputValue(),'1-45');assert.equal((await p.locator('#rosterText').inputValue()).split('\n').length,45);
 await p.locator('#sectors').fill('6');
 await p.locator('#pegs').fill('1-50');await p.locator('[data-action="divide"]').click();await p.locator('[data-action="draw"]').click();assert.equal(await p.evaluate(()=>current().rounds[0].mt55SectorPlan||null),null);
 await p.locator('#pegs').fill('1-45');await p.locator('[data-action="divide"]').click();assert.equal(await p.locator('#mt55Assignments tbody tr').count(),45);
 const sizes=await p.evaluate(()=>mt56BalancedGroups(current().rounds[0].mt55SectorPlan.pegs,6).map(g=>g.pegs.length));assert.deepEqual(sizes,[7,7,8,8,8,7]);
 await p.locator('[data-action="draw"]').click();const draw=await p.evaluate(()=>current().rounds[0].mt55Entries);assert.equal(draw.length,45);assert.equal(new Set(draw.map(r=>r.peg)).size,45);assert.ok(draw.every(r=>Number(r.competitorId.split('-').pop())<=45&&r.sector&&r.peg>=1&&r.peg<=45));
 const assigned=JSON.stringify(draw);await p.locator('[data-result-mode="roster"]').click();await p.locator('[data-confirm-entrant="mt63-test-45"]').click();assert.equal(await p.evaluate(()=>JSON.stringify(current().rounds[0].mt55Entries)),assigned);
 await p.locator('[data-confirm-entrant="mt63-test-45"]').click();await p.locator('[data-result-mode="edit"]').click();
 const weight=p.locator('[data-mt55-id="mt63-test-1"][data-mt55-field="weight"]').first();await weight.fill('3715');await weight.press('Tab');
 await p.reload();assert.equal(await p.evaluate(()=>db.events.find(e=>e.id==='mt63-test').rounds[0].mt55Entries.find(r=>r.competitorId==='mt63-test-1').weightG),3715);
 assert.equal(await p.evaluate(()=>JSON.stringify(db.cycles)),archives);assert.deepEqual(errors,[]);
 await p.goto(origin+'/MatchThis_MT-63_OGLADACZ.html');assert.equal(await p.locator('[data-confirm-entrant]').count(),0);assert.equal(await p.title(),'MatchThis MT-63');
 if(process.env.MT63_LIVE_URL){await p.goto(process.env.MT63_LIVE_URL,{waitUntil:'networkidle'});assert.equal(await p.title(),'MatchThis MT-63');assert.equal(await p.locator('#appversion').innerText(),'MT-63');assert.equal(await p.locator('[data-confirm-entrant]').count(),0);}
 console.log(name,'MT63_PASS: migration, 50/45/5, green toggles, persistence, 45 stations, sectors A/last, draw membership, existing assignments, weights, archives, responsive widths, zoom, roles; page errors 0');await ctx.close();
 }finally{await browser.close()}
}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>server.close());
