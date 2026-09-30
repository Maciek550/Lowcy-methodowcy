'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'../app.js'),'utf8');
const start=app.indexOf('async function openInvitationCompetition('),end=app.indexOf('async function leaveComp(',start);
function context(opened){
  const calls=[];
  const ctx={showTab:tab=>calls.push(['tab',tab]),openCompetition:async id=>{calls.push(['open',id]);return opened},api:async url=>calls.push(['read',url]),loadNotifications:async()=>calls.push(['refresh']),msg:()=>{}};
  vm.runInNewContext(app.slice(start,end),ctx);
  return {ctx,calls};
}
test('invitation opens the competitions tab before the detail and then reads the notification',async()=>{
  const {ctx,calls}=context(true);await ctx.openInvitationCompetition('77',12);
  assert.deepEqual(calls,[['tab','competitions'],['open',77],['read','/api/notifications/12/read'],['refresh']]);
});
test('an inaccessible competition does not consume its invitation notification',async()=>{
  const {ctx,calls}=context(false);await ctx.openInvitationCompetition(77,12);
  assert.deepEqual(calls,[['tab','competitions'],['open',77]]);
});
