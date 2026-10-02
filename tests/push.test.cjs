'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const start=app.indexOf('function urlBase64ToUint8Array('),end=app.indexOf('function scrollAppTop(',start);

function pushClient({getSubscription,subscribe,permission='granted',testSent=1,existingWorker=true,workerUpdate,notificationCleanup}){
  assert.ok(start>0&&end>start);
  const calls=[],feedback={textContent:'',className:'hidden'},button={disabled:false},state={textContent:''};
  const notification={permission,requestPermission:()=>{calls.push('permission');notification.permission='granted';return Promise.resolve('granted')}};
  const registration={active:existingWorker?{postMessage:()=>{}}:null,update:workerUpdate,pushManager:{getSubscription,subscribe},getNotifications:notificationCleanup};
  let registrations=0;
  const context={
    PUSH_CONFIG:null,PUSH_SUBSCRIBED:false,TOKEN:'test-token',CLIENT_VERSION:'294',MessageChannel:require('node:worker_threads').MessageChannel,
    q:id=>({'notifPushFeedback':feedback,'notifPushBtn':button,'notifPushState':state})[id]||null,
    window:{Notification:notification,PushManager:function(){}},Notification:notification,
    navigator:{userAgent:'Android',serviceWorker:{getRegistration:async()=>existingWorker?registration:null,register:async()=>{registrations++;registration.active={};return registration},ready:Promise.resolve(registration)}},
    api:async route=>{calls.push(route);if(route==='/api/config')return {pushReady:true,vapidPublicKey:'BA'};if(route==='/api/push-test')return {sent:testSent};return {ok:true}},
    Uint8Array,atob,setTimeout,clearTimeout,
  };
  vm.runInNewContext(app.slice(start,end),context);
  return {context,calls,feedback,button,state,registrations:()=>registrations};
}

test('push failure is shown beside its button and never claims server registration',async()=>{
  const p=pushClient({getSubscription:async()=>null,subscribe:async()=>{const e=new Error('Registration failed - push service error');e.name='AbortError';throw e}});
  await p.context.enablePush();
  assert.deepEqual(p.calls,['/api/config']);
  assert.match(p.feedback.textContent,/Registration failed - push service error/);
  assert.match(p.feedback.className,/pushFeedback-error/);
  assert.equal(p.button.disabled,false);
  assert.match(p.state.textContent,/sprawdź komunikat/);
});

test('existing subscription is kept when sending a test; permission starts before network calls',async()=>{
  let unsubscribed=false;
  const subscription={toJSON:()=>({endpoint:'https://push.example/subscription'}),unsubscribe:async()=>{unsubscribed=true}};
  const p=pushClient({permission:'default',getSubscription:async()=>subscription,subscribe:async()=>{throw Error('Should not subscribe twice')}});
  await p.context.enablePush();
  assert.deepEqual(p.calls,['permission','/api/config','/api/push-subscription','/api/push-test']);
  assert.equal(unsubscribed,false);
  assert.match(p.feedback.textContent,/Wysłano próbny alert/);
  assert.match(p.feedback.className,/pushFeedback-ok/);
  assert.equal(p.button.disabled,false);
  assert.equal(p.registrations(),0,'active service worker is reused');
});

test('startup checks existing push without creating a competing subscription',async()=>{
  let subscribed=false;
  const p=pushClient({getSubscription:async()=>null,subscribe:async()=>{subscribed=true}});
  await p.context.restorePushSubscription();
  assert.equal(subscribed,false);
  assert.deepEqual(p.calls,[]);
});

test('new push registration works when there is no active worker',async()=>{
  const subscription={toJSON:()=>({endpoint:'https://push.example/new'})};
  const p=pushClient({existingWorker:false,getSubscription:async()=>null,subscribe:async()=>subscription});
  await p.context.enablePush();
  assert.equal(p.registrations(),1);
  assert.deepEqual(p.calls,['/api/config','/api/push-subscription','/api/push-test']);
});

test('service worker installs when decorative images cannot be fetched',async()=>{
  const server=fs.readFileSync(path.join(__dirname,'..','server.cjs'),'utf8');
  const start=server.indexOf("if (path === '/sw.js') return send(res, 200, `");
  const from=server.indexOf('`',start)+1,end=server.indexOf('`, {\'Content-Type\':\'application/javascript',from);
  assert.ok(start>0&&from>start&&end>from);
  const code=server.slice(from,end).replaceAll('${APP_VERSION}','225');
  const handlers={},requested=[];let installed;
  const self={addEventListener:(name,fn)=>{handlers[name]=fn},skipWaiting:async()=>{installed=true}};
  const cache={put:async()=>{}};
  const context={self,caches:{open:async()=>cache},fetch:async url=>{requested.push(url);if(url.includes('/brand/'))throw Error('Icon offline');return {ok:true}},AbortController,setTimeout,clearTimeout};
  vm.runInNewContext(code,context);
  let install;
  handlers.install({waitUntil:promise=>{install=promise}});
  await install;
  assert.equal(installed,true);
  assert.deepEqual(requested,['/','/app.js?v=225','/pdf-vector.js?v=225','/communication-ui.js?v=225','/password-recovery-ui.js?v=225','/accessibility-v234.css?v=225','/roster-preview-v235.css?v=225','/player-dock-v236.css?v=225','/compact-player-v237.css?v=225','/desktop-nav-v238.css?v=225','/history-lux-v239.css?v=225','/history-compact-v241.css?v=225','/draw-ui-v240.css?v=225','/result-contrast-v242.css?v=225','/desktop-draw-v243.css?v=225','/players-dark-v283.css?v=225','/draw-notice-ui-v240.js?v=225']);
});


test('a stalled worker update and failed old-notification cleanup do not block a real push test',async()=>{
  let updated=false;
  const subscription={toJSON:()=>({endpoint:'https://push.example/existing'})};
  const p=pushClient({getSubscription:async()=>subscription,subscribe:async()=>{throw Error('Existing subscription must stay')},workerUpdate:()=>{updated=true;return new Promise(()=>{})},notificationCleanup:async()=>{throw Error('Notification cleanup unavailable')}});
  await p.context.enablePush();
  assert.equal(updated,false);
  assert.deepEqual(p.calls,['/api/config','/api/push-subscription','/api/push-test']);
  assert.equal(p.registrations(),0);
  assert.match(p.feedback.textContent,/Wysłano próbny alert/);
  assert.equal(p.button.disabled,false);
});

test('worker still activates after a shell download fails and retains previous offline cache',async()=>{
  const server=fs.readFileSync(path.join(__dirname,'..','server.cjs'),'utf8');
  const start=server.indexOf("if (path === '/sw.js') return send(res, 200, `");
  const from=server.indexOf('`',start)+1,end=server.indexOf('`, {\'Content-Type\':\'application/javascript',from);
  const code=server.slice(from,end).replaceAll('${APP_VERSION}','294');
  const handlers={},entries=new Map();let installed=false,claimed=false,deleted=false;
  const self={addEventListener:(name,fn)=>{handlers[name]=fn},skipWaiting:async()=>{installed=true},clients:{claim:async()=>{claimed=true}}};
  const cache={put:async(key,value)=>entries.set(key,value),match:async key=>entries.get(key),delete:async key=>entries.delete(key)};
  const context={self,caches:{open:async()=>cache,keys:async()=>['lowcy-shell-v293','lowcy-shell-v294'],delete:async()=>{deleted=true}},fetch:async url=>{if(url.startsWith('/app.js'))throw Error('Interrupted shell download');return {ok:true}},AbortController,setTimeout,clearTimeout};
  vm.runInNewContext(code,context);
  let pending;
  handlers.install({waitUntil:p=>{pending=p}});await pending;
  assert.equal(installed,true);
  handlers.activate({waitUntil:p=>{pending=p}});await pending;
  assert.equal(claimed,true);
  assert.equal(deleted,false);
  assert.equal(entries.has('/'),false,'partial shell must not replace the previous offline page');
  assert.ok(entries.has('/pdf-vector.js?v=294'),'available shell files are still saved');
});
