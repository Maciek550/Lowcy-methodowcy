'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');

test('player activity records visible use, throttles gestures, and ignores hidden or offline sessions',()=>{
  const listeners=new Map(),calls=[];
  let clock=100_000;
  const document={hidden:false,addEventListener:(type,fn)=>listeners.set(type,fn)};
  const window={addEventListener:(type,fn)=>listeners.set('window:'+type,fn)};
  const context={document,window,navigator:{onLine:true},ME:{id:7,role:'PLAYER'},TOKEN:'session',Date:{now:()=>clock},api:(route,opts)=>{calls.push({route,opts});return Promise.resolve({ok:true})}};
  const start=app.indexOf('let PLAYER_ACTIVITY_LAST_SENT=');
  const end=app.indexOf('function fmtDate(',start);
  assert.ok(start>0&&end>start,'activity tracker exists');
  vm.runInNewContext(app.slice(start,end),context);
  context.recordPlayerActivity();
  listeners.get('pointerdown')();
  clock+=59_000;listeners.get('window:scroll')();
  assert.equal(calls.length,1);
  clock+=1_000;listeners.get('keydown')();
  assert.equal(calls.length,2);
  assert.equal(calls[0].route,'/api/me/activity');
  assert.equal(calls[0].opts.method,'POST');
  document.hidden=true;clock+=60_000;listeners.get('pointerdown')();
  assert.equal(calls.length,2);
  document.hidden=false;listeners.get('visibilitychange')();
  assert.equal(calls.length,3);
  context.navigator.onLine=false;clock+=60_000;listeners.get('window:focus')();
  assert.equal(calls.length,3);
  context.navigator.onLine=true;context.ME={id:7,role:'ADMIN'};listeners.get('pointerdown')();
  assert.equal(calls.length,3);
  context.ME={id:8,role:'PLAYER'};listeners.get('pointerdown')();
  assert.equal(calls.length,4,'new account reports its own activity');
});

test('admin activity label uses Polish local time and does not invent older visits',()=>{
  const start=app.indexOf('const PLAYER_ACTIVITY_DATE_FORMAT=');
  const end=app.indexOf('async function deletePlayer(',start);
  assert.ok(start>0&&end>start,'activity label exists');
  const context={esc:value=>String(value)};
  vm.runInNewContext(app.slice(start,end),context);
  assert.match(context.playerLastActivityHtml('2026-09-28T15:30:00.000Z'),/28\.09\.2026, 17:30/);
  assert.match(context.playerLastActivityHtml(null),/brak danych/);
});
