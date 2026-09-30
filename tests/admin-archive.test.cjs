'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
const server=fs.readFileSync(require('node:path').join(__dirname,'../server.cjs'),'utf8');
test('admin list separates past competitions into a collapsed archive while keeping today active',async()=>{
 const node={innerHTML:''};const ctx={ME:{role:'ADMIN'},api:async()=>({competitions:[{id:1,competition_date:'2026-09-29'},{id:2,competition_date:'2026-09-30'}]}),q:id=>id==='competitionsList'?node:null,playerCompetitionPast:c=>c.competition_date<'2026-09-30',renderAdminCompetitionList:arr=>arr.map(c=>'EVENT-'+c.id).join(',')};
 const start=app.indexOf('async function loadCompetitions(){'),end=app.indexOf('async function createCompetition(',start);
 vm.runInNewContext('let ADMIN_COMPETITIONS_CACHE=[];'+app.slice(start,end),ctx);await ctx.loadCompetitions();
 assert.ok(node.innerHTML.indexOf('EVENT-2')<node.innerHTML.indexOf('adminCompetitionArchive'));
 assert.ok(node.innerHTML.indexOf('EVENT-1')>node.innerHTML.indexOf('adminCompetitionArchive'));
 assert.doesNotMatch(node.innerHTML,/class="adminCompetitionArchive" open/);
});
test('archived deletion cancels before calling API unless the exact title is entered',async()=>{
 let calls=0;const c={id:1,title:'Gandalf CUP'};
 const start=app.indexOf('async function deleteCompetition(id){'),end=app.indexOf('async function joinComp(',start);
 const ctx={playerCompetitionPast:()=>true,prompt:()=> 'Gandalf',api:async()=>{calls++},msg:()=>{}};
 vm.runInNewContext('const ADMIN_COMPETITIONS_CACHE='+JSON.stringify([c])+';'+app.slice(start,end),ctx);await ctx.deleteCompetition(1);assert.equal(calls,0);
 assert.match(server,/if\(old.rows\[0\]\.archived\).*b\.confirmTitle!==old.rows\[0\]\.title/);
});
test('invitation chooser starts collapsed',()=>{
 const start=app.indexOf('function renderCompetitionInvitationsPanel(c){'),end=app.indexOf('function scheduleAdminInvitationSearch',start);const ctx={};vm.runInNewContext(app.slice(start,end),ctx);
 assert.doesNotMatch(ctx.renderCompetitionInvitationsPanel({id:1,status:'PRIVATE'}),/<details[^>]*\bopen\s/);
});
