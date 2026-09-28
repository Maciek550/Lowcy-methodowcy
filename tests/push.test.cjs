'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
const start=app.indexOf('function urlBase64ToUint8Array('),end=app.indexOf('function scrollAppTop(',start);

function pushClient({getSubscription,subscribe,permission='granted',testSent=1}){
  assert.ok(start>0&&end>start);
  const calls=[],feedback={textContent:'',className:'hidden'},button={disabled:false},state={textContent:''};
  const notification={permission,requestPermission:()=>{calls.push('permission');notification.permission='granted';return Promise.resolve('granted')}};
  const registration={pushManager:{getSubscription,subscribe}};
  const context={
    PUSH_CONFIG:null,PUSH_SUBSCRIBED:false,TOKEN:'test-token',
    q:id=>({'notifPushFeedback':feedback,'notifPushBtn':button,'notifPushState':state})[id]||null,
    window:{Notification:notification,PushManager:function(){}},Notification:notification,
    navigator:{userAgent:'Android',serviceWorker:{register:async()=>registration,ready:Promise.resolve(registration)}},
    api:async route=>{calls.push(route);if(route==='/api/config')return {pushReady:true,vapidPublicKey:'BA'};if(route==='/api/push-test')return {sent:testSent};return {ok:true}},
    Uint8Array,atob,setTimeout,clearTimeout,
  };
  vm.runInNewContext(app.slice(start,end),context);
  return {context,calls,feedback,button,state};
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
});

test('startup checks existing push without creating a competing subscription',async()=>{
  let subscribed=false;
  const p=pushClient({getSubscription:async()=>null,subscribe:async()=>{subscribed=true}});
  await p.context.restorePushSubscription();
  assert.equal(subscribed,false);
  assert.deepEqual(p.calls,[]);
});
