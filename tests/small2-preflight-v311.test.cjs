'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const {validateDbUrl,auditConnection} = require('../tools/small2-preflight-v311.cjs');
const target = 'postgresql://u:secret@pgsql3.small.pl:5432/p1828_lowcy_kop';
process.env.JWT_SECRET = 'test_only_dummy_secret_longer_than_twenty_four';

test('akceptuje jedynie poprawny host i bazę SMALL2', () => {
  assert.deepEqual(validateDbUrl(target), {host:'pgsql3.small.pl',database:'p1828_lowcy_kop'});
  for (const bad of [
    '',
    'postgresql://u:pass@railway.internal:5432/p1828_lowcy_kop',
    'postgresql://u:pass@pgsql3.small.pl:5432/production',
    'postgresql://u:pass@pgsql3.small.pl:5400/p1828_lowcy_kop',
    'postgresql://u:pass@pgsql3.small.pl:5432/p1828_lowcy_kop?host=railway.internal',
    'postgresql://u@pgsql3.small.pl:5432/p1828_lowcy_kop',
    'https://u:pass@pgsql3.small.pl/p1828_lowcy_kop',
  ]) assert.throws(() => validateDbUrl(bad));
});

test('odmowa gdy JWT_SECRET ma domyślną wartość',()=>{
  const before=process.env.JWT_SECRET;
  process.env.JWT_SECRET='dev-secret-change-me';
  assert.throws(()=>validateDbUrl(target),/JWT_SECRET/);
  process.env.JWT_SECRET=before;
});

test('audit: tylko zapytania odczytowe w transakcji READ ONLY oraz ROLLBACK',async()=>{
  const queries=[];
  class MockClient {
    constructor(opts) { assert.equal(opts.ssl,false); assert.equal(opts.connectionString,target); }
    async connect() { queries.push('CONNECT'); }
    async query(sql, params) {
      queries.push(sql);
      if (sql === 'BEGIN READ ONLY' || sql === 'ROLLBACK') return {rows:[]};
      if (sql.startsWith('SELECT current_database()')) return {rows:[{db:'p1828_lowcy_kop',db_user:'u'}]};
      if (sql.startsWith('SELECT to_regclass')) return {rows:[{tbl:null}]};
      throw new Error('Nieoczekiwane zapytanie: '+sql);
    }
    async end() {queries.push('END');}
  }
  const got=await auditConnection(target,MockClient);
  assert.equal(got.ok,true);
  assert.deepEqual(queries.slice(0,3),['CONNECT','BEGIN READ ONLY','SELECT current_database() AS db, current_user AS db_user']);
  assert.equal(queries.at(-2),'ROLLBACK');
  assert.equal(queries.at(-1),'END');
  assert.equal(queries.filter(q=>q.startsWith('SELECT to_regclass')).length,6);
});

test('zatrzymuje się, gdy serwer zwróci inną nazwę bazy',async()=>{
  const q=[];
  class WrongDb {
    async connect(){q.push('connect')}
    async query(sql){q.push(sql); if(sql.startsWith('SELECT current_database()'))return {rows:[{db:'railway',db_user:'u'}]};return {rows:[]}}
    async end(){q.push('end')}
  }
  await assert.rejects(()=>auditConnection(target,WrongDb),/BLOKADA/);
  assert.equal(q.at(-2),'ROLLBACK');
});
