'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const server=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const popup=fs.readFileSync(path.join(root,'communication-ui.js'),'utf8');
const start=server.indexOf('async function getCompetition('),end=server.indexOf('async function getActiveEntries(',start);
assert.ok(start>=0&&end>start);
function context(query,notifyUser=async()=>{}){
  const ctx={pool:{query},notifyUser};
  vm.runInNewContext(server.slice(start,end)+';this.access=canViewCompetition;this.invite=inviteCompetitionPlayer;',ctx);
  return ctx;
}
test('private competition access persists after an invitation is declined',async()=>{
  const calls=[];
  const ctx=context(async(sql,args)=>{calls.push(args);return {rows:args[1]===2?[{status:'DECLINED'}]:[]}});
  const privateEvent={id:77,status:'PRIVATE'};
  assert.equal(await ctx.access(privateEvent,{id:1,role:'PLAYER'}),false);
  assert.equal(await ctx.access(privateEvent,{id:2,role:'PLAYER'}),true);
  assert.equal(await ctx.access(privateEvent,{id:1,role:'ADMIN'}),true);
  assert.equal(await ctx.access({id:77,status:'TEST'},{id:2,role:'PLAYER'}),false);
  assert.equal(await ctx.access({id:77,status:'OPEN'},{id:1,role:'PLAYER'}),true);
  assert.equal(calls.length,2);
});
test('one invitation grants access and sends inbox, 15-second popup and push only once',async()=>{
  let attempts=0;const sent=[];
  const ctx=context(async()=>({rows:++attempts===1?[{user_id:2}]:[]}),async(...args)=>sent.push(args));
  const comp={id:77,title:'Lasomin',fishery:'Lasomin',competition_date:'2026-10-10'};
  assert.equal(await ctx.invite(comp,2,9),true);
  assert.equal(await ctx.invite(comp,2,9),false);
  assert.equal(sent.length,1);
  assert.equal(sent[0][1],'COMPETITION_INVITATION');
  assert.equal(sent[0][2],'Zaproszenie na zawody');
  assert.equal(sent[0][4].popupEnabled,true);
  assert.match(server,/function playerPushType\(type\).*'COMPETITION_INVITATION'/);
  assert.match(popup,/n\.type==='COMPETITION_INVITATION'/);
  assert.match(popup,/setTimeout\(closePopup,15000\)/);
});
test('private list and direct URLs require an invitation; joining verifies it again',()=>{
  assert.match(server,/from competitions c where \(\$2::boolean or \(c\.status<>'TEST' and \(c\.status<>'PRIVATE' or exists\(select 1 from competition_invitations/);
  assert.match(server,/privateCompetition\).*canViewCompetition\(c,user\)/);
  assert.match(server,/if \(!await canViewCompetition\(comp,user\)\) return null/);
  assert.match(server,/if\(c\.status==='PRIVATE'\)\{\s*const access=await client\.query/);
  assert.match(app,/Zawody prywatne — na zaproszenie/);
  assert.match(app,/Zaproś wszystkich zawodników/);
});
