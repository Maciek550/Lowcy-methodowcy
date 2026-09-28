'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {normalizeMessage,normalizeChannels,route}=require('../communications.cjs');
const reminders=require('../presence-reminders.cjs');
test('V228: messaging validates content and delivery mode',()=>{
  assert.deepEqual(normalizeMessage({body:'  Kontakt proszę  ',mode:'POPUP'}),{body:'Kontakt proszę',mode:'POPUP'});
  assert.deepEqual(normalizeMessage({body:'ok'}),{body:'ok',mode:'NOTIFICATION'});
  for(const x of [{body:''},{body:'a'.repeat(701)},{body:'ok',mode:'UNKNOWN'}])assert.throws(()=>normalizeMessage(x));
});
test('V230: optional D-2 organizer note is limited to 160 characters',()=>{
  assert.equal(reminders.normalizeOrganizerNote('  Zbiórka o 6:30  '),'Zbiórka o 6:30');
  assert.equal(reminders.normalizeOrganizerNote(undefined),'');
  assert.equal(reminders.normalizeOrganizerNote('x'.repeat(160)).length,160);
  assert.throws(()=>reminders.normalizeOrganizerNote('x'.repeat(161)),/160/);
});
test('V229: reminder includes Polish weekday and full date',()=>{
  assert.match(reminders.formatCompetitionDate('2026-10-03'),/sobota, 3 października 2026/i);
  assert.equal(reminders.dateKey(new Date('2026-10-03T00:00:00Z')),'2026-10-03');
});
test('V229: repeated scheduler runs do not resend existing reminders',async()=>{
  let added=false,sent=0,receivedNote='',receivedBody='',pushedBody='';
  const pool={query:async(sql,params)=>{
    if(sql.startsWith('select e.user_id'))return {rows:[{user_id:7,competition_id:18,title:'Grand Prix',fishery:'Lasomin',competition_date:'2026-10-03',presence_reminder_note:'Zbiórka 6:30'}]};
    if(sql.startsWith('insert into notifications')){if(added)return {rows:[]};added=true;receivedBody=params?.[2]||'';receivedNote=params?.[3]?.organizerNote||'';return {rows:[{id:83}]}}
    if(sql.startsWith('select 1 from entries'))return {rows:[{exists:1}]};
    if(sql.startsWith('select count(*)'))return {rows:[{n:0}]};
    throw Error('Unexpected query: '+sql);
  }};
  const arg={pool,getPlayerAttention:async()=>({count:1}),pushToUser:async(_uid,_title,body)=>{sent++;pushedBody=body;return {sent:1,failed:0}}};
  assert.deepEqual(await reminders.ensureTwoDayReminders(arg),{created:1,pushSent:1,pushFailed:0});
  assert.deepEqual(await reminders.ensureTwoDayReminders(arg),{created:0,pushSent:0,pushFailed:0});
  assert.equal(sent,1);
  assert.equal(receivedNote,'Zbiórka 6:30');
  assert.match(receivedBody,/Zbiórka 6:30/);
  assert.match(pushedBody,/Zbiórka 6:30/);
});
test('V229: uniqueness is enforced in PostgreSQL',async()=>{
  let sql='';await reminders.init({query:async q=>{sql=q}});
  assert.match(sql,/unique index/i);assert.match(sql,/PRESENCE_REMINDER_2D/);assert.match(sql,/competitionId/);
});

test('V231: ALL sends PUSH with the complete unread badge count',async()=>{
  const calls=[],pushes=[];
  const pool={query:async(sql,params)=>{
    if(sql.includes('from users u where u.id=$1'))return {rows:[{id:7,first_name:'Ala',last_name:'Nowak'}]};
    if(sql.startsWith('insert into admin_message_batches'))return {rows:[{id:31}]};
    if(sql.startsWith('insert into notifications')){calls.push(params);return {rows:[]}};
    if(sql.startsWith('select count(*)::int as n from notifications'))return {rows:[{n:2}]};
    throw Error('Unexpected query: '+sql);
  }};
  let result;
  const handled=await route({
    req:{},res:{},user:{id:1,role:'ADMIN'},path:'/api/admin/messages',method:'POST',
    url:new URL('https://example.com/api/admin/messages'),pool,
    sendJson:(_res,status,data)=>{result={status,...data}},
    readBody:async()=>({body:'Test alertu',mode:'ALL',userId:7}),
    requireAdmin:()=>true,requireUser:()=>true,
    getPlayerAttention:async()=>({count:3}),
    pushToUser:async(_id,title,body,_url,meta)=>{pushes.push({title,body,meta});return {ready:true,sent:1,failed:0}}
  });
  assert.equal(handled,true);
  assert.equal(calls.length,1);
  assert.equal(pushes.length,1);
  assert.equal(pushes[0].meta.badgeCount,5);
  assert.equal(pushes[0].meta.type,'ADMIN_MESSAGE');
  assert.match(pushes[0].body,/Test alertu/);
  assert.equal(result.pushSent,1);
  assert.equal(result.pushUnavailable,0);
});
test('V231: ALL accurately reports missing push subscriptions',async()=>{
  const pool={query:async(sql)=>{
    if(sql.includes('from users u where u.id=$1'))return {rows:[{id:7,first_name:'Ala',last_name:'Nowak'}]};
    if(sql.startsWith('insert into admin_message_batches'))return {rows:[{id:32}]};
    if(sql.startsWith('insert into notifications'))return {rows:[]};
    if(sql.startsWith('select count(*)::int as n from notifications'))return {rows:[{n:1}]};
    throw Error('Unexpected query: '+sql);
  }};
  let result;
  await route({
    req:{},res:{},user:{id:1,role:'ADMIN'},path:'/api/admin/messages',method:'POST',
    url:new URL('https://example.com/api/admin/messages'),pool,
    sendJson:(_res,status,data)=>{result={status,...data}},
    readBody:async()=>({body:'Test',mode:'ALL',userId:7}),
    requireAdmin:()=>true,requireUser:()=>true,getPlayerAttention:async()=>({count:0}),
    pushToUser:async()=>({ready:true,sent:0,failed:0})
  });
  assert.equal(result.delivered,1);
  assert.equal(result.pushSent,0);
  assert.equal(result.pushUnavailable,1);
});

test('V232: independent delivery channels and default inbox',()=>{
  assert.deepEqual(normalizeChannels({},'NOTIFICATION'),['INBOX']);
  assert.deepEqual(normalizeChannels({},'POPUP'),['INBOX','POPUP']);
  assert.deepEqual(normalizeChannels({},'ALL'),['INBOX','POPUP','PUSH']);
  for(const channel of ['INBOX','POPUP','PUSH']) assert.deepEqual(normalizeChannels({channels:[channel]}),[channel]);
  assert.deepEqual(normalizeChannels({channels:['POPUP','INBOX']}),['INBOX','POPUP']);
  assert.deepEqual(normalizeChannels({channels:['PUSH','POPUP','INBOX']}),['INBOX','POPUP','PUSH']);
  for(const channels of [[],['UNKNOWN'],['INBOX','INBOX'],['INBOX','POPUP','PUSH','UNKNOWN']])
    assert.throws(()=>normalizeChannels({channels}));
});
test('V232: one, two or three channels deliver only to selected destinations',async()=>{
  for(const channels of [['INBOX'],['POPUP'],['PUSH'],['INBOX','POPUP'],['POPUP','PUSH'],['INBOX','PUSH'],['INBOX','POPUP','PUSH']]){
    const stored=[],pushed=[];
    const pool={query:async(sql,params)=>{
      if(sql.includes('from users u where u.id=$1'))return {rows:[{id:7,first_name:'Ala',last_name:'Nowak'}]};
      if(sql.startsWith('insert into admin_message_batches'))return {rows:[{id:42}]};
      if(sql.startsWith('insert into notifications')){stored.push(params);return {rows:[]}};
      if(sql.startsWith('select count(*)::int as n from notifications'))return {rows:[{n:channels.includes('INBOX')?1:0}]};
      throw Error('Unexpected query: '+sql);
    }};
    let response;
    await route({
      req:{},res:{},user:{id:1,role:'ADMIN'},path:'/api/admin/messages',method:'POST',
      url:new URL('https://example.com/api/admin/messages'),pool,
      sendJson:(_res,status,data)=>{response={status,...data}},
      readBody:async()=>({body:'Sprawdzenie',channels,userId:7}),requireAdmin:()=>true,requireUser:()=>true,
      getPlayerAttention:async()=>({count:0}),
      pushToUser:async(_id,_title,_body,_url,meta)=>{pushed.push(meta);return {sent:1,failed:0}}
    });
    assert.equal(response.status,200);
    assert.equal(stored.length,1);
    assert.equal(stored[0][3].inboxEnabled,channels.includes('INBOX'));
    assert.equal(stored[0][3].popupEnabled,channels.includes('POPUP'));
    assert.equal(stored[0][3].pushEnabled,channels.includes('PUSH'));
    assert.equal(pushed.length,Number(channels.includes('PUSH')));
    if(channels.includes('PUSH'))assert.equal(pushed[0].badgeCount,channels.includes('INBOX')?1:0);
  }
});
