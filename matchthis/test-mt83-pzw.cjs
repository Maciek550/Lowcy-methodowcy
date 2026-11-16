'use strict';
/* MT83 regression; pure competition engine. Nothing is written to real data. */
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const s=fs.readFileSync('matchthis/MatchThis_MT-83.html','utf8');
const script=[...s.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].map(x=>x[1]).find(x=>x.includes('root.MatchThisCore = api'));
assert(script,'Core script absent');
const env={};env.globalThis=env;vm.runInNewContext(script,env);
const core=env.MatchThisCore;assert(core);
const ten=Array.from({length:10},(_,i)=>({
 competitorId:'id'+(i+1),competitorName:'TEST '+(i+1),sector:'A',peg:i+1,
 weightG:i<3?[3000,2000,1000][i]:0
}));
const t={id:'test-r1',date:'2026-12-10',status:'DRAFT',sourceOfficial:false,results:ten};
const ranked=core.tourClassification(t);
assert.equal(ranked.length,10);
assert.deepEqual(Array.from(ranked.filter(x=>x.weightG>0).map(x=>x.place).sort((a,b)=>a-b)),[1,2,3]);
for(const x of ranked.filter(x=>x.weightG===0))assert.equal(x.place,7,'3 positives, 7 zeros => (4+10)/2=7');
for(const x of core.rankSector(ten.map(r=>({...r,weightG:0}))))assert.equal(x.place,5.5,'10 zeros => average 1..10');
for(const x of core.rankSector(ten.map((r,i)=>({...r,weightG:i===0?100:0}))).filter(r=>r.weightG===0))assert.equal(x.place,6);
const rowsDns=ten.map((r,i)=>i===9?{...r,absent:true}:r);
const scoredDns=core.rankSector(rowsDns);
assert.equal(scoredDns.find(x=>x.absent).place,11,'Explicit DNS => biggest sector +1');
for(const x of scoredDns.filter(x=>x.weightG===0&&!x.absent))assert.equal(x.place,6.5,'DNS not included in zero average');
const final={...t,status:'FINAL'};
const res=core.eventClassification({id:'ev',rounds:[final]});
assert.equal(res.rows.length,10);
assert.equal(res.rows.filter(x=>x.points===7).length,7);
const official={...t,status:'FINAL',sourceOfficial:true,
 results:ten.map((r,i)=>({...r,officialPlace:i===9?100:i<3?i+1:7,absent:i===9}))};
const original=core.tourClassification(official);
assert.equal(original.length,10);
assert.equal(original.find(x=>x.peg===10).place,100,'Archive official unchanged');
const hist=core.eventClassification({id:'historic',rounds:[official]});
assert.equal(hist.rows.length,10,'Show absent competitor in overall classification');
assert.equal(hist.rows.find(x=>x.competitorId==='id10').rank,null,'Explicit absent not ranked');
console.log('MT83_PZW_10_STAND_3_FISH_7_ZEROS_7POINTS_PASS');
console.log('MT83_PZW_TIES_ALL_ZERO_AND_ABSENCE_SEPARATE_PASS');
console.log('MT83_HISTORICAL_OFFICIAL_DATA_PRESERVED_AND_DNS_DISPLAYED_PASS');
