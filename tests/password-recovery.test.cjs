'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {makeRoute,phoneVariants,smsBody}=require('../password-recovery.cjs');
const root=path.join(__dirname,'..');
test('V234: Polish phone variants are accepted without creating number-enumeration leaks',()=>{
  assert.deepEqual(phoneVariants('500 600 700'),['500600700','+48500600700','48500600700']);
  assert.deepEqual(phoneVariants('+48 500-600-700'),['500600700','+48500600700','48500600700']);
  assert.deepEqual(phoneVariants('not a phone'),[]);
  assert.match(smsBody('Anna','12345678'),/12345678/);
  assert.match(smsBody('Anna','12345678'),/zmień hasło/);
});
test('V234: unknown number returns the same neutral acknowledgement without notifying anyone',async()=>{
  let output=null,notified=0;
  const route=makeRoute({
    pool:{query:async(sql)=>({rows:sql.includes('select id,phone,first_name,last_name')?[]:[],rowCount:0})},
    bcrypt:{},readBody:async()=>({phone:'500600700'}),
    sendJson:(_res,status,data)=>{output={status,...data}},
    notifyAdmins:async()=>{notified++},requireAdmin:()=>true
  });
  assert.equal(await route({headers:{},socket:{remoteAddress:'192.0.2.12'}},{},'/api/password-reset/request','POST',null),true);
  assert.equal(output.status,200);
  assert.match(output.message,/Jeśli numer/);
  assert.equal(notified,0);
});
test('V234: known phone creates exactly one pending admin request',async()=>{
  let output,notified=0,inserted=0;
  const route=makeRoute({
    pool:{query:async(sql)=>{
      if(sql.includes('select id,phone,first_name,last_name'))return {rows:[{id:55,phone:'500600700',first_name:'Anna',last_name:'Nowak'}]};
      if(sql.includes('select count(*)::int n from password_reset_requests'))return {rows:[{n:0}]};
      if(sql.includes('insert into password_reset_requests')){inserted++;return {rows:[{id:11}]}};
      throw Error('Unexpected SQL '+sql);
    }},
    bcrypt:{},readBody:async()=>({phone:'500600700'}),
    sendJson:(_res,status,data)=>{output={status,...data}},
    notifyAdmins:async(type,title,body,payload)=>{assert.equal(type,'PASSWORD_RESET_REQUEST');assert.equal(payload.resetRequestId,11);notified++},
    requireAdmin:()=>true
  });
  await route({headers:{},socket:{remoteAddress:'192.0.2.13'}},{},'/api/password-reset/request','POST',null);
  assert.equal(output.status,200);assert.equal(inserted,1);assert.equal(notified,1);
});
test('V234: admin prepares SMS and revokes existing user sessions before dispatch',async()=>{
  let output,committed=0;const queries=[];
  const pool={connect:async()=>({
    query:async(sql,params)=>{
      queries.push({sql,params});
      if(sql.startsWith('select r.id,r.status'))return {rows:[{id:20,status:'PENDING',user_id:2,phone:'500600700',first_name:'Anna',last_name:'Nowak'}]};
      return {rows:[],rowCount:1};
    },
    release:()=>{}
  })};
  const route=makeRoute({pool,bcrypt:{hash:async()=>'$hash'},readBody:async()=>({}),
    sendJson:(_res,status,data)=>{output={status,...data}},
    requireAdmin:(user)=>user.role==='ADMIN',notifyAdmins:async()=>{}});
  const handled=await route({}, {},'/api/admin/password-resets/20/prepare','POST',{id:1,role:'ADMIN'});
  assert.equal(handled,true);assert.equal(output.status,200);
  assert.match(output.body,/12345678/);assert.equal(output.phone,'500600700');
  assert.ok(queries.some(q=>q.sql.includes('password_must_change=true')&&q.sql.includes('auth_version=auth_version+1')));
  assert.ok(queries.some(q=>q.sql.includes("status='PREPARED'")));
});
test('V234: login form accessibility, separate recovery tile, and version badge are wired',()=>{
  const server=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
  const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const ui=fs.readFileSync(path.join(root,'password-recovery-ui.js'),'utf8');
  const style=fs.readFileSync(path.join(root,'accessibility-v234.css'),'utf8');
  for(const id of ['loginPhone','loginPassword','regPhone','regPassword','regFirst','regLast','regClub','setupPhone','setupPassword'])assert.ok(server.includes('for="'+id+'"'),id);
  assert.match(server,/id="loginForm"/);
  assert.match(server,/autocomplete="current-password"/);
  assert.match(server,/id="forgotPasswordBtn"/);
  assert.match(server,/role="tab" aria-controls="tab-competitions"/);
  assert.match(app,/setAttribute\('aria-selected',String\(x===n\)\)/);
  assert.match(style,/:focus-visible/);
  assert.match(style,/min-height:44px/);
  assert.match(ui,/adminPasswordResetTile/);
  assert.match(server,/<span class="appVersionBadge">V\$\{APP_VERSION\}<\/span>/);
  assert.match(server,/const APP_VERSION = '252'/);
  assert.match(app,/const CLIENT_VERSION='252'/);
  assert.match(server,/token:signToken\(user\)/);
});
test('prepared SMS can be closed from the request card after returning from the SMS app',async()=>{
  const ui=fs.readFileSync(path.join(root,'password-recovery-ui.js'),'utf8');
  const nodes={};
  const parent={insertBefore(node){nodes[node.id]=node}};
  nodes['tab-notifications']=parent;
  nodes['btn-notifications']={querySelector:()=>null,appendChild(){}};
  const document={
    readyState:'loading',addEventListener(){},
    getElementById:id=>nodes[id]||null,
    createElement:()=>({setAttribute(){},addEventListener(type,fn){this[type]=fn}})
  };
  let closed=false;
  const request={id:20,status:'PREPARED',first_name:'Anna',last_name:'Nowak',phone:'500600700',created_at:'2026-09-30T07:00:00Z'};
  const fetch=async(url,options)=>{
    if(url.endsWith('/sent')&&options?.method==='POST'){closed=true;return {ok:true,json:async()=>({ok:true})}}
    if(url==='/api/admin/password-resets')return {ok:true,json:async()=>({requests:closed?[]:[request]})};
    throw Error('Unexpected request '+url);
  };
  const counts=[];
  const window={loadNotifications(){},lowcyAdminNotificationsUpdate(count){counts.push(count)}};
  vm.runInNewContext(ui,{document,window,fetch,confirm:()=>true,ME:{role:'ADMIN'},TOKEN:'test'});
  await window.lowcyPasswordResetRefresh();
  const tile=nodes.adminPasswordResetTile;
  assert.match(tile.innerHTML,/data-reset-action="sent" data-id="20"/);
  const button={dataset:{resetAction:'sent',id:'20'},disabled:false};
  tile.click({target:{closest:()=>button}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(closed,true);
  assert.deepEqual(counts,[1,0]);
  assert.match(tile.innerHTML,/Brak oczekujących próśb/);
  assert.doesNotMatch(tile.innerHTML,/data-reset-action="sent"/);
});
