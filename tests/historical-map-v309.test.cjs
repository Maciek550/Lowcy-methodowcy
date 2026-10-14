'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {validateDraft,saveApprovedDraft}=require('../historical-import/import-core.cjs');
const app=fs.readFileSync('app.js','utf8');
function fn(name){const start=app.indexOf('function '+name+'(');let end=app.indexOf('\nfunction ',start+1);return app.slice(start,end<0?undefined:end)}
const ctx={SECTOR_MANUAL_DRAFT:undefined};vm.createContext(ctx);
for(const name of ['roundMapCompetitionClient','customSectorLayoutClient'])vm.runInContext(fn(name),ctx);
function rows(n=27){return Array.from({length:n},(_,i)=>({name:'Zawodnik Numer'+i,round:1,stand:i+1,sector:'ABCD'[Math.floor(i/7)],weight:1000}))}
const draft={title:'Lasomin',date:'2026-07-04',rows:rows(),mapMode:'TWO_ALONG'};
test('27 entrants produce 14+13 banks and stable signed preview',()=>{const d=validateDraft(draft);assert.equal(d.bank1Count,14);assert.deepEqual(validateDraft(d),d);assert.equal(validateDraft({...draft,mapMode:'ONE_BANK'}).bank1Count,27);assert.equal(validateDraft({...draft,bank1Count:15}).bank1Count,15);assert.throws(()=>validateDraft({...draft,bank1Count:30}),/stanowisko/)});
test('save refuses unspecified layout before database access',async()=>{await assert.rejects(saveApprovedDraft({}, {...draft,mapMode:''},1),/Wybierz układ/)});
test('both historical rounds drop phantom stands and retain their own sector assignments',()=>{const draws=[...rows(),...rows().map(r=>({...r,round:2,sector:r.sector==='A'?'B':r.sector==='B'?'A':r.sector}))];for(const round of [1,2]){const c=ctx.roundMapCompetitionClient({historical_source:'zpro',bank1_count:15,bank2_count:15,map_mode:'TWO_OPPOSITE'},{draws},round);const layout=ctx.customSectorLayoutClient(c);assert.equal(layout.reduce((n,s)=>n+s.size,0),27);assert.equal(c.bank2_count,12);assert.equal(layout.find(s=>s.letter===(round===1?'A':'B')).size,7);assert.equal(layout.some(s=>[...s.bottom,...s.top].some(n=>n>27)),false)}});
test('non-contiguous stand numbers are preserved, not filled or renumbered',()=>{const c=ctx.roundMapCompetitionClient({historical_source:'csv',bank1_count:3,bank2_count:4,map_mode:'TWO_ALONG'},{draws:[{round:1,stand:2,sector:'A'},{round:1,stand:7,sector:'B'}]},1);const layout=ctx.customSectorLayoutClient(c);assert.deepEqual(JSON.parse(JSON.stringify(layout.flatMap(s=>[...s.bottom,...s.top]))),[2,7]);});
test('approved import persists exact banks and T1 sectors, with limit 27',async()=>{
 let insert;const accounts=rows().map((r,i)=>({id:i+1,first_name:'Zawodnik',last_name:'Numer'+i,phone:'501'+String(i).padStart(6,'0'),role:'PLAYER'}));
 const client={release(){},async query(sql,args){
  if(sql.startsWith('SELECT id,first_name'))return {rows:accounts};
  if(sql.startsWith('INSERT INTO competitions')){insert={sql,args};return {rows:[{id:99}]};}
  return {rows:[],rowCount:0};
 }};
 const result=await saveApprovedDraft({connect:async()=>client},draft,1);
 assert.equal(result.players,27);assert.equal(result.results,27);
 assert.equal(insert.args[7],27);assert.equal(insert.args[10],'TWO_ALONG');assert.equal(insert.args[11],14);assert.equal(insert.args[12],13);assert.equal(insert.args[13],4);
 assert.deepEqual(JSON.parse(insert.args[14]).map(s=>s.stands.length),[7,7,7,6]);
});
test('Lasomin corrected 14+13 split keeps complete A/B below and C/D above in both rounds',()=>{
 for(const round of [1,2]){
  const c=ctx.roundMapCompetitionClient({historical_source:'zpro',bank1_count:14,bank2_count:13,map_mode:'TWO_ALONG'},{draws:rows().map(r=>({...r,round}))},round);
  const layout=ctx.customSectorLayoutClient(c);
  assert.equal(layout.filter(s=>s.bottom.length).map(s=>s.letter).join(','),'A,B');
  assert.equal(layout.filter(s=>s.top.length).map(s=>s.letter).join(','),'C,D');
  assert.equal(layout.find(s=>s.letter==='C').top.join(','),'15,16,17,18,19,20,21');
 }
});
