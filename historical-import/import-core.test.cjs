'use strict';const {test}=require('node:test');const assert=require('node:assert/strict');const {validateDraft,mapAccounts,saveApprovedDraft}=require('./import-core.cjs');
const base={title:'Test',date:'2026-07-18',rows:[{name:'Jan Kowalski',sector:'A',stand:1,weight:1200}]};
test('valid draft',()=>assert.equal(validateDraft(base).rows[0].weight,1200));
test('reject duplicate',()=>assert.throws(()=>validateDraft({...base,rows:[base.rows[0],base.rows[0]]}),/Powtórzony/));
test('reject negative',()=>assert.throws(()=>validateDraft({...base,rows:[{...base.rows[0],weight:-1}]}),/Niepoprawny/));
test('ambiguous identity requires admin confirmation',()=>assert.throws(()=>mapAccounts(base.rows,[{id:1,first_name:'Jan',last_name:'Kowalski',phone:'ZPRO-1'},{id:2,first_name:'Jan',last_name:'Kowalski',phone:'501123456'}]),/ręczne wskazanie ID/));
test('confirmed ID selects existing account',()=>assert.equal(mapAccounts([{...base.rows[0],userId:2}],[{id:1,first_name:'Jan',last_name:'Kowalski',phone:'ZPRO-1'},{id:2,first_name:'Jan',last_name:'Kowalski',phone:'501123456'}])[0].userId,2));
test('do not create unknown account',()=>assert.throws(()=>mapAccounts(base.rows,[]),/Brak konta/));
test('rollback on missing user',async()=>{let log=[];const pool={connect:async()=>({query:async(sql)=>{log.push(sql);if(sql.startsWith('SELECT id,first_name'))return {rows:[]};return {rows:[]}},release(){}})};await assert.rejects(saveApprovedDraft(pool,base,1),/Brak konta/);assert.equal(log.at(-1),'ROLLBACK')});
