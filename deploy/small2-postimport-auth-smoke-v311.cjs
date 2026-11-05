'use strict';
const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const root=path.join(process.env.HOME,'lowcy-small2-20261023');
const cfg=JSON.parse(fs.readFileSync(path.join(process.env.HOME,'.config/lowcy-small2/runtime.json'),'utf8'));
const u=new URL(cfg.DATABASE_URL);
if(u.hostname!=='pgsql3.small.pl'||u.pathname!=='/p1828_lowcy_kop')throw Error('NOT_SMALL2_DATABASE');
const {Client}=require(path.join(root,'node_modules','pg'));
const bcrypt=require(path.join(root,'node_modules','bcryptjs'));
const jwt=require(path.join(root,'node_modules','jsonwebtoken'));
const base='https://lowcymethodowcy.smallhost.pl';
const phone='SM2TEST'+crypto.randomBytes(8).toString('hex');
const password=crypto.randomBytes(32).toString('base64url');
const json=async(response)=>{const body=await response.json();return {status:response.status,body}};
(async()=>{
 const client=new Client({connectionString:cfg.DATABASE_URL});
 await client.connect();
 let createdId=null;
 try{
  const baseline=await client.query('SELECT count(*)::int n FROM users');
  if(baseline.rows[0].n!==73)throw Error('UNEXPECTED_BASELINE_USER_COUNT');
  const admin=(await client.query("SELECT id,role,auth_version FROM users WHERE role='ADMIN' AND archived_at IS NULL ORDER BY id LIMIT 1")).rows[0];
  if(!admin)throw Error('NO_EXISTING_ADMIN');
  const hash=await bcrypt.hash(password,10);
  const created=await client.query("INSERT INTO users(phone,password_hash,first_name,last_name,pzw_club,role,account_source) VALUES($1,$2,'Test','SMALL2','TEST TECHNICZNY','PLAYER','ADMIN') RETURNING id",[phone,hash]);
  createdId=created.rows[0].id;
  const unauth=await json(await fetch(base+'/api/competitions'));
  if(unauth.status!==401)throw Error('UNAUTHORIZED_COMPETITIONS_NOT_BLOCKED');
  const wrong=await json(await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,password:'incorrect-test-password'})}));
  if(wrong.status!==401)throw Error('WRONG_PASSWORD_NOT_REJECTED');
  const login=await json(await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,password})}));
  if(login.status!==200||!login.body?.ok||String(login.body.user?.id)!==String(createdId)||!login.body.token)throw Error('PLAYER_LOGIN_FAILED');
  const headers={Authorization:'Bearer '+login.body.token};
  const me=await json(await fetch(base+'/api/me',{headers}));
  if(me.status!==200||String(me.body.user?.id)!==String(createdId))throw Error('TOKEN_ME_FAILED');
  const playerComps=await json(await fetch(base+'/api/competitions',{headers}));
  if(playerComps.status!==200||!Array.isArray(playerComps.body?.competitions))throw Error('PLAYER_COMPETITIONS_FAILED');
  const adminToken=jwt.sign({uid:admin.id,role:'ADMIN',v:Number(admin.auth_version||0)},cfg.JWT_SECRET,{expiresIn:'5m'});
  const allComps=await json(await fetch(base+'/api/competitions',{headers:{Authorization:'Bearer '+adminToken}}));
  if(allComps.status!==200||allComps.body?.competitions?.length!==7)throw Error('ADMIN_COMPETITIONS_NOT_SEVEN');
  const playerIds=new Set(playerComps.body.competitions.map(x=>String(x.id)));
  const allowed=allComps.body.competitions.filter(x=>x.status!=='PRIVATE'&&x.status!=='TEST').map(x=>String(x.id));
  if(allowed.some(id=>!playerIds.has(id)))throw Error('PUBLIC_COMPETITION_VISIBILITY_MISMATCH');
  if(allComps.body.competitions.some(x=>x.status==='PRIVATE'&&playerIds.has(String(x.id))))throw Error('PRIVATE_COMPETITION_LEAK');
  await json(await fetch(base+'/api/me/activity',{method:'POST',headers}));
  const recorded=(await client.query('SELECT last_login_at,last_active_at FROM users WHERE id=$1',[createdId])).rows[0];
  if(!recorded?.last_login_at||!recorded.last_active_at)throw Error('LOGIN_ACTIVITY_NOT_PERSISTED');
  const second=await json(await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone,password})}));
  if(second.status!==200||!second.body.ok)throw Error('LOGIN_AFTER_PERSISTENCE_FAILED');
  console.log('SMALL2_REAL_AUTH_TEST_OK '+JSON.stringify({wrongPasswordRejected:true,anonymousAccessBlocked:true,playerLogin:true,tokenRead:true,adminAuthorization:true,allCompetitions:7,playerVisible:playerComps.body.competitions.length,privateEventsProtected:true,activitySaved:true,secondLogin:true}));
 }finally{
  try{
   if(createdId!==null){
    const removed=await client.query('DELETE FROM users WHERE id=$1 AND phone=$2 RETURNING id',[createdId,phone]);
    if(removed.rowCount!==1)throw Error('TEST_USER_CLEANUP_NOT_EXACT');
    console.log('SMALL2_TEMP_TEST_ACCOUNT_DELETED');
   }
   const after=await client.query('SELECT count(*)::int n FROM users');
   if(after.rows[0].n!==73)throw Error('USER_COUNT_CHANGED_AFTER_TEST');
   console.log('SMALL2_ORIGINAL_USER_COUNT_RESTORED_73');
  }finally{await client.end()}
 }
})().catch(e=>{console.error('SMALL2_REAL_AUTH_TEST_FAILED '+e.message);process.exitCode=1});
