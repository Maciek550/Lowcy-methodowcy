'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('admin notification overview counts each pending task once and explains an empty other inbox',()=>{
  const app=fs.readFileSync(path.join(__dirname,'..','app.js'),'utf8');
  const start=app.indexOf('function notifData(n){');
  const end=app.indexOf('async function confirmAllNotifications(){',start);
  assert.ok(start>=0&&end>start);
  const nodes={};
  nodes['tab-notifications']={firstChild:{},insertBefore(node){nodes[node.id]=node}};
  nodes.notificationsList={innerHTML:''};
  nodes.notifCounter={textContent:''};
  nodes['btn-notifications']={badge:null,querySelector(){return this.badge},appendChild(badge){this.badge=badge;badge.remove=()=>{this.badge=null}}};
  const ctx={
    ME:{role:'ADMIN'},window:{},document:{createElement:()=>({innerHTML:'',textContent:'',setAttribute(key,value){this[key]=value}})},
    q:id=>nodes[id]||null,esc:x=>String(x),fmtDate:x=>x
  };
  vm.runInNewContext(app.slice(start,end)+';this.setItems=(notices,leaves)=>{NOTIFICATION_CACHE=notices;ADMIN_PENDING_REQUESTS=leaves};this.render=renderNotificationContent;',ctx);
  ctx.window.lowcyAdminNotificationsUpdate(1);
  ctx.render();
  assert.match(nodes.adminNotificationOverview.innerHTML,/Do obsłużenia: 1/);
  assert.match(nodes.adminNotificationOverview.innerHTML,/Hasła: 1/);
  assert.match(nodes.notificationsList.innerHTML,/Prośby o wypisanie/);
  ctx.window.setAdminNotificationTab('all');
  assert.match(nodes.notificationsList.innerHTML,/Brak innych powiadomień/);
  assert.doesNotMatch(nodes.notificationsList.innerHTML,/Potwierdź wszystkie/);

  ctx.setItems([
    {type:'PASSWORD_RESET_REQUEST',read_at:null,data:{resetRequestId:20}},
    {type:'LEAVE_REQUEST',read_at:null,data:{status:'PENDING'}},
    {type:'ADMIN_MESSAGE',read_at:null,data:{inboxEnabled:false}},
    {type:'INFO',read_at:null,title:'Zdarzenie',body:'Treść',created_at:'2026-09-30T07:00:00Z'}
  ],[{id:7}]);
  ctx.render();
  assert.match(nodes.adminNotificationOverview.innerHTML,/Do obsłużenia: 3/);
  assert.match(nodes.adminNotificationOverview.innerHTML,/Wypisania: 1/);
  assert.match(nodes.adminNotificationOverview.innerHTML,/Nowe inne: 1/);
  assert.match(nodes.notificationsList.innerHTML,/Inne powiadomienia · nowe <b class="notificationTabCount hasItems">1/);
  assert.doesNotMatch(nodes.notificationsList.innerHTML,/PASSWORD_RESET_REQUEST/);
  assert.equal(nodes['btn-notifications'].badge.textContent,'3');
  assert.equal(nodes['btn-notifications'].badge['aria-label'],'Do obsłużenia: 3');

  ctx.window.lowcyAdminNotificationsUpdate(0);
  assert.match(nodes.adminNotificationOverview.innerHTML,/Do obsłużenia: 2/);
  assert.equal(nodes['btn-notifications'].badge.textContent,'2');
});
