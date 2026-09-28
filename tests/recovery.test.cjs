'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {canRestore}=require('../recovery.cjs');
const comp={bank1_count:15,bank2_count:14,map_mode:'TWO_OPPOSITE',disabled_stands:[15]};
const draw={user_id:1,round:1,stand:1,sector:'A'};
const snap={bank1:15,bank2:14,mapMode:'TWO_OPPOSITE',disabled:[15],activeIds:[1,2],draws:[draw],results:[{user_id:1,round:1,weight:5000}],items:[{user_id:1,round:1,kind:'NET',weight:5000}]};
test('draw reset recovery checks identical roster/structure and no new work',()=>{
 assert.equal(canRestore(comp,[1,2],snap,[],[],[],'DRAW_RESET').ready,true);
});
test('restore rejects any new draw or result rather than overwriting it',()=>{
 assert.equal(canRestore(comp,[1,2],snap,[draw],[],[],'DRAW_RESET').ready,false);
 assert.equal(canRestore(comp,[1,2],snap,[],[{weight:1}],[],'DRAW_RESET').ready,false);
 assert.equal(canRestore(comp,[1,2],snap,[],[],[{weight:1}],'DRAW_RESET').ready,false);
});
test('result-only restore preserves original draw and rejects changed draws',()=>{
 assert.equal(canRestore(comp,[1,2],snap,[draw],[],[],'RESULTS_CLEAR').ready,true);
 assert.equal(canRestore(comp,[1,2],snap,[{...draw,stand:2}],[],[],'RESULTS_CLEAR').ready,false);
});
test('restore rejects roster or bank changes even when tables are empty',()=>{
 assert.equal(canRestore(comp,[1,3],snap,[],[],[],'DRAW_RESET').ready,false);
 assert.equal(canRestore({...comp,bank1_count:14},[1,2],snap,[],[],[],'DRAW_RESET').ready,false);
 assert.equal(canRestore({...comp,disabled_stands:[]},[1,2],snap,[],[],[],'DRAW_RESET').ready,false);
});
test('both destructive routes snapshot within transaction before deleting anything',()=>{
 const s=fs.readFileSync(path.join(__dirname,'..','server.cjs'),'utf8');
 const d=s.slice(s.indexOf("m = path.match(/^\\/api\\/admin\\/competitions\\/(\\d+)\\/draw$/);"));
 const r=s.slice(s.indexOf("m = path.match(/^\\/api\\/admin\\/competitions\\/(\\d+)\\/results$/);"));
 assert.ok(d.indexOf("recovery.capture(client,compId,user.id,'DRAW_RESET'")<d.indexOf("delete from result_items"));
 assert.ok(r.indexOf("recovery.capture(client,compId,user.id,'RESULTS_CLEAR'")<r.indexOf("delete from result_items"));
 assert.match(s,/recovery\.restore\(client,compId,disabledStandsForCompetition\)/);
});
