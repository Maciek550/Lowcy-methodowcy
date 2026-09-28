'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {standState,absencePreview,resultsPreflight,planStandRestoration}=require('../safety-core.cjs');
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

test('V219: 26 physical, two exclusions, 24 players: clearing restores 12+12 automatically',()=>{
 const p=planStandRestoration({bank1:13,bank2:13,mapMode:'TWO_OPPOSITE',previousDisabled:[2,25],nextDisabled:[],activeCount:24,limitPlaces:26});
 assert.deepEqual(p,{bank1:12,bank2:12,resetLayout:true,resynced:true});
 assert.equal(standState({bank1:p.bank1,bank2:p.bank2,disabledStands:[],participants:24}).ready,true);
});
test('V219: partial exclusions and repeated empty saves do not resize the physical map',()=>{
 const base={bank1:13,bank2:13,mapMode:'TWO_OPPOSITE',activeCount:24,limitPlaces:26};
 const partial=planStandRestoration({...base,previousDisabled:[2,25],nextDisabled:[2]});
 const unchanged=planStandRestoration({...base,previousDisabled:[],nextDisabled:[]});
 for(const p of [partial,unchanged])assert.deepEqual(p,{bank1:13,bank2:13,resetLayout:false,resynced:false});
});
test('V219: one bank, odd banks and unchanged layouts remain correctly handled',()=>{
 const one=planStandRestoration({bank1:26,bank2:0,mapMode:'ONE_BANK',previousDisabled:[3,17],nextDisabled:[],activeCount:24});
 assert.deepEqual(one,{bank1:24,bank2:0,resetLayout:true,resynced:true});
 const odd=planStandRestoration({bank1:15,bank2:14,previousDisabled:[15],nextDisabled:[],activeCount:28});
 assert.deepEqual(odd,{bank1:14,bank2:14,resetLayout:true,resynced:true});
 const same=planStandRestoration({bank1:13,bank2:13,previousDisabled:[2,25],nextDisabled:[],activeCount:26});
 assert.deepEqual(same,{bank1:13,bank2:13,resetLayout:false,resynced:true});
});
test('V219: route synchronizes physical bank counts in the same PATCH as exclusion clearing',()=>{
 const server=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
 assert.match(server,/planStandRestoration\(\{[\s\S]*?previousDisabled:disabledStandsForCompetition\(comp\)/);
 assert.match(server,/set disabled_stands=\$1::jsonb, bank1_count=\$3, bank2_count=\$4/);
 assert.match(server,/sector_layout=case when \$5::boolean then null else sector_layout end/);
});

test('V220: admin roster includes presence filters on both desktop/mobile rows',()=>{
 const a=fs.readFileSync(path.join(root,'app.js'),'utf8');
 assert.match(a,/\['PRESENT','Obecni'\]/);
 assert.match(a,/\['UNCONFIRMED','Niepotwierdzeni'\]/);
 assert.ok((a.match(/data-confirmed=/g)||[]).length>=2);
 assert.match(a,/presenceMode=ADMIN_ROSTER_STATUS==='PRESENT'\|\|ADMIN_ROSTER_STATUS==='UNCONFIRMED'/);
});
test('V220: player history has season filter and does not remove cards from data',()=>{
 const a=fs.readFileSync(path.join(root,'app.js'),'utf8');
 assert.match(a,/let PLAYER_HISTORY_YEAR='all'/);
 assert.match(a,/historySeasonBtn/);
 assert.match(a,/data-year=/);
 assert.match(a,/setPlayerHistoryYear/);
});
test('client/server version and visible header stay synchronized',()=>{
 const a=fs.readFileSync(path.join(root,'app.js'),'utf8');
 const s=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
 const client=a.match(/const CLIENT_VERSION='(\d+)'/);
 const server=s.match(/const APP_VERSION = '(\d+)'/);
 assert.ok(client&&server);
 assert.equal(client[1],server[1]);
 assert.ok(s.includes('<title>Łowcy Methodowcy — V'+server[1]+'</title>'));
 assert.ok(s.includes('class="headerVersion">V'+server[1]+'</span>'));
});
