'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {standState,absencePreview,resultsPreflight}=require('../safety-core.cjs');
const root=path.resolve(__dirname,'..');
test('29 physical: 15 lower +14 upper, excluded 15 => 28 available',()=>{
 const x=standState({bank1:15,bank2:14,disabledStands:[15],participants:28});
 assert.deepEqual([x.physical,x.available,x.ready,x.bank1,x.bank2],[29,28,true,15,14]);
});
test('28 physical with excluded 15 and 28 entrants is NOT ready',()=>{
 const x=standState({bank1:14,bank2:14,disabledStands:[15],participants:28});
 assert.equal(x.available,27);assert.equal(x.ready,false);
});
test('26 physical: excluding 1 and 15 gives 24 available',()=>{
 const x=standState({bank1:26,bank2:0,disabledStands:[1,15],participants:24});
 assert.equal(x.ready,true);assert.equal(x.physical,26);
});
test('reject invalid, duplicate and out-of-bank excluded stands',()=>{
 for(const arr of [[15,15],[0],[30]])assert.equal(standState({bank1:15,bank2:14,disabledStands:arr,participants:28}).ready,false);
});
test('one-step absence keeps physical banks and balances list and stands',()=>{
 const p=absencePreview({bank1:15,bank2:14,disabledStands:[],participants:29,stand:15});
 assert.equal(p.ready,true);assert.equal(p.afterPlayers,28);assert.equal(p.afterAvailable,28);assert.equal(p.bank1,15);assert.equal(p.bank2,14);
});
test('one-step absence rejects duplicated exclusions and existing mismatch',()=>{
 assert.equal(absencePreview({bank1:15,bank2:14,disabledStands:[15],participants:28,stand:15}).ready,false);
 assert.equal(absencePreview({bank1:14,bank2:14,disabledStands:[15],participants:28,stand:16}).ready,false);
});
test('results preflight distinguishes missing entries from zero-weight records',()=>{
 const x=resultsPreflight({activeUserIds:[1,2,3],round:1,draws:[{round:1,user_id:1},{round:1,user_id:2}],results:[{round:1,user_id:1,weight:0}],items:[{round:1,user_id:2,weight:2000}]});
 assert.deepEqual(x.withoutDraw,[3]);assert.deepEqual(x.withoutResult,[3]);assert.deepEqual(x.zeroResults,[1]);assert.equal(x.offlineJudgeEntriesVerified,false);
});
test('front-end blocks mismatched draw counts even without exclusions',()=>{
 const a=fs.readFileSync(path.join(root,'app.js'),'utf8');
 assert.match(a,/const ready=available>0&&available===x.draw/);
 assert.doesNotMatch(a,/const ready=!addon\|\|available===x.draw/);
});
test('server verifies exact physical stand count before drawing',()=>{
 const s=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
 assert.match(s,/standState\(\{bank1:/);
 assert.match(s,/if\(!preflight\.ready\)/);
});
