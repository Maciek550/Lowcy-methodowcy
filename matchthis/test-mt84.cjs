'use strict';
const fs=require('fs'),assert=require('assert/strict'),vm=require('vm');
const {chromium,firefox}=require('playwright');
const mode=process.argv[2]||'fixed';
const base=process.env.MT84_URL||'http://127.0.0.1:8785/';
const expected=JSON.parse(fs.readFileSync('matchthis/mt84-fixture.json')).data.events[0];
const assignments=t=>(t.mt55Entries||[]).map(r=>[r.competitorId,r.peg,r.sector]);
const state=async p=>(await (await p.request.get(base+'mt73-state.php?public=1')).json()).data;
async function open(p){await p.locator('[data-open="test-event"]').first().click();await p.locator('[data-round="1"]').click();}
(async()=>{
 for(const engine of [chromium,firefox]){
  const b=await engine.launch();
  try{
   const p=await b.newPage({viewport:{width:1366,height:900}}),errors=[];
   p.on('pageerror',e=>errors.push(e.message));
   p.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text())});
   await p.request.post(base+'mt83-reset');
   await p.goto(base+'panel.php');
   await p.waitForFunction(()=>document.querySelector('#mt73-sync').textContent.includes('Dane z serwera'));
   await open(p);await p.locator('[data-result-mode="edit"]').first().click();
   const weights=p.locator('[data-mt55-field="weight"]');
   if(mode==='baseline'){
    assert.equal(await weights.count(),0);
    assert((await p.locator('#main').innerText()).includes('Najpierw podaj stanowiska'));
    await p.locator('[data-result-mode="draw"]').first().click();
    assert.equal(await p.locator('#sectors').inputValue(),'2');
    console.log('MT83_BUG_REPRODUCED_71_ASSIGNMENTS_NO_WEIGHTS_WRONG_2_SECTORS',engine.name());
    continue;
   }
   assert.equal(await p.title(),'MatchThis MT-84');
   assert.equal(await p.locator('body').getAttribute('data-version'),'MT-84');
   assert.equal(await p.locator('.mt-build-badge').innerText(),'MT-84');
   assert.equal(await weights.count(),71);
   assert.equal(await p.locator('.mt55-sector-card').count(),6);
   assert((await weights.evaluateAll(xs=>xs.map(x=>x.value))).every(v=>v==='0'));
   const before=await state(p);
   assert.deepEqual(before.events[0],expected,'Opening a view must not write a plan or results');
   for(const [index,value] of [[0,'1234'],[70,'5678']]){
    await weights.nth(index).fill(value);await weights.nth(index).press('Tab');
    await p.waitForFunction(()=>document.querySelector('#mt73-sync').textContent.includes('Zapisano na serwerze'));
   }
   const after=await state(p);
   assert.deepEqual(after.events[0].rounds[0],before.events[0].rounds[0],'T1 untouched');
   assert.deepEqual(assignments(after.events[0].rounds[1]),assignments(expected.rounds[1]),'Every original T2 peg/sector unchanged');
   assert.equal(after.events[0].rounds[1].drawPublished,true);
   assert.equal(after.events[0].rounds[1].mt55SectorPlan,undefined,'No plan fabricated');
   assert.deepEqual(after.events[0].rounds[1].results.filter(r=>r.weightG>0).map(r=>r.weightG).sort((a,b)=>a-b),[1234,5678]);
   assert(after.events[0].rounds[1].results.every(r=>[0,1234,5678].includes(r.weightG)),'Tab may persist an untouched displayed zero, never another catch');
   await p.reload();await p.waitForFunction(()=>document.querySelector('#mt73-sync').textContent.includes('Dane z serwera'));
   assert.equal(await weights.count(),71);
   assert.equal(await weights.first().inputValue(),'1234');assert.equal(await weights.last().inputValue(),'5678');
   for(const width of [1366,1024,390]){
    await p.setViewportSize({width,height:900});
    await weights.last().scrollIntoViewIfNeeded();await weights.last().click();
    assert.equal(await weights.last().evaluate(el=>el===document.activeElement),true);
   }
   await p.setViewportSize({width:1366,height:900});
   await p.locator('[data-result-mode="draw"]').first().click();
   assert.equal(await p.locator('#sectors').inputValue(),'6');
   assert.equal(await p.locator('#drawInfo .mt56-sector-box').count(),6);
   assert((await p.locator('#drawInfo').innerText()).includes('Zapisane przydziały'));
   assert(!(await p.locator('#drawInfo').innerText()).includes('Proponowany podział'));
   await p.locator('[data-result-mode="edit"]').first().click();
   assert.equal(await weights.count(),71);
   assert.deepEqual(await state(p),after,'Navigation must not change data');
   fs.mkdirSync('/tmp/mt84-screens',{recursive:true});
   await p.screenshot({path:'/tmp/mt84-screens/'+engine.name()+'_T2_weights.png',fullPage:true});
   assert.deepEqual(errors,[]);
   console.log('MT84_PASS_71_WEIGHTS_6_SECTORS_SAVE_RELOAD_T1_AND_DRAWS_UNCHANGED',engine.name());
  }finally{await b.close()}
 }
})().catch(e=>{console.error(e);process.exit(1)});
