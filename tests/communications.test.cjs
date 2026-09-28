'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalizeMessage}=require('../communications.cjs');
const reminders=require('../presence-reminders.cjs');
test('V228: messaging validates content and delivery mode',()=>{
  assert.deepEqual(normalizeMessage({body:'  Kontakt proszę  ',mode:'POPUP'}),{body:'Kontakt proszę',mode:'POPUP'});
  assert.deepEqual(normalizeMessage({body:'ok'}),{body:'ok',mode:'NOTIFICATION'});
  for(const x of [{body:''},{body:'a'.repeat(701)},{body:'ok',mode:'UNKNOWN'}])assert.throws(()=>normalizeMessage(x));
});
test('V229: reminder includes Polish weekday and full date',()=>{
  assert.match(reminders.formatCompetitionDate('2026-10-03'),/sobota, 3 października 2026/i);
  assert.equal(reminders.dateKey(new Date('2026-10-03T00:00:00Z')),'2026-10-03');
});
test('V229: repeated scheduler runs do not resend existing reminders',async()=>{
  let added=false,sent=0;
  const pool={query:async(sql)=>{
    if(sql.startsWith('select e.user_id'))return {rows:[{user_id:7,competition_id:18,title:'Grand Prix',fishery:'Lasomin',competition_date:'2026-10-03'}]};
    if(sql.startsWith('insert into notifications')){if(added)return {rows:[]};added=true;return {rows:[{id:83}]}}
    if(sql.startsWith('select 1 from entries'))return {rows:[{exists:1}]};
    if(sql.startsWith('select count(*)'))return {rows:[{n:0}]};
    throw Error('Unexpected query: '+sql);
  }};
  const arg={pool,getPlayerAttention:async()=>({count:1}),pushToUser:async()=>{sent++;return {sent:1,failed:0}}};
  assert.deepEqual(await reminders.ensureTwoDayReminders(arg),{created:1,pushSent:1,pushFailed:0});
  assert.deepEqual(await reminders.ensureTwoDayReminders(arg),{created:0,pushSent:0,pushFailed:0});
  assert.equal(sent,1);
});
test('V229: uniqueness is enforced in PostgreSQL',async()=>{
  let sql='';await reminders.init({query:async q=>{sql=q}});
  assert.match(sql,/unique index/i);assert.match(sql,/PRESENCE_REMINDER_2D/);assert.match(sql,/competitionId/);
});
