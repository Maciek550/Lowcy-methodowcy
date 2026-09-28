'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const {spawn}=require('node:child_process'),{Pool}=require('pg'),path=require('node:path');
test('staging PostgreSQL: preview, 29=>28 absence, draw, reset/restore, results recovery', {skip:!process.env.DATABASE_URL,timeout:180000}, async()=>{
 const db=new Pool({connectionString:process.env.DATABASE_URL,ssl:false}),port=Number(process.env.TEST_PORT||32917),
  base='http://127.0.0.1:'+port,secret='ci_only_215to216',output=[];
 const child=spawn(process.execPath,['server.cjs'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),ADMIN_SETUP_CODE:secret,JWT_SECRET:'staging-only-signing-key'},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',x=>output.push(x.toString()));child.stderr.on('data',x=>output.push(x.toString()));
 async function request(route,method='GET',body,token){
  const res=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const payload=await res.json().catch(()=>({error:'Invalid JSON response'}));return {status:res.status,...payload};
 }
 try{
  let ready=false;for(let t=0;t<100;t++){if(child.exitCode!==null)throw Error('Server exited: '+output.join('\n').slice(-2500));try{if((await request('/health')).ok){ready=true;break}}catch(_){}await new Promise(resolve=>setTimeout(resolve,250))}
  assert.equal(ready,true,'Server did not pass /health: '+output.join('\n').slice(-2500));
  const auth=await request('/api/setup-admin','POST',{setupCode:secret,phone:'501000000',password:'staging-only-test',firstName:'Test',lastName:'Administrator'});
  assert.equal(auth.status,200,JSON.stringify(auth));const token=auth.token;
  const created=await request('/api/competitions','POST',{title:'TEST BEZPIECZEŃSTWA V216',fishery:'Łowisko testowe',status:'TEST',competitionDate:'2026-12-01',limitPlaces:29,mapMode:'TWO_OPPOSITE',bank1Count:15,bank2Count:14,sectorsCount:4},token);
  assert.equal(created.status,200,JSON.stringify(created));const id=Number(created.competition.id);
  let entryId;
  for(let i=1;i<=29;i++){
   const u=await db.query("insert into users(phone,password_hash,first_name,last_name,pzw_club,role,account_source) values($1,'test-hash','Test',$2,'0','PLAYER','ADMIN') returning id",['TEST-'+i,'Zawodnik'+i]);
   const e=await db.query("insert into entries(competition_id,user_id,status) values($1,$2,'ACTIVE') returning id",[id,u.rows[0].id]);
   if(i===29)entryId=Number(e.rows[0].id);
  }
  const preview=await request('/api/admin/competitions/'+id+'/absence','POST',{entryId,stand:15,previewOnly:true},token);
  assert.equal(preview.status,200,JSON.stringify(preview));assert.equal(preview.ready,true);assert.equal(preview.afterPlayers,28);assert.equal(preview.afterAvailable,28);
  let d=await request('/api/competitions/'+id,'GET',null,token);assert.equal(d.activeEntries.length,29);assert.equal(d.competition.disabled_stands.length,0,'Preview mutated database!');
  const applied=await request('/api/admin/competitions/'+id+'/absence','POST',{entryId,stand:15},token);
  assert.equal(applied.status,200,JSON.stringify(applied));assert.deepEqual([applied.bank1,applied.bank2,applied.available,applied.participants],[15,14,28,28]);
  d=await request('/api/competitions/'+id,'GET',null,token);assert.equal(d.activeEntries.length,28);assert.deepEqual(d.competition.disabled_stands,[15]);
  const draw=await request('/api/admin/competitions/'+id+'/draw/1','POST',{},token);
  assert.equal(draw.status,200,JSON.stringify(draw));assert.equal(draw.assignment.length,28);assert.equal(draw.assignment.some(x=>Number(x.stand)===15),false);
  const blocked=await request('/api/admin/competitions/'+id+'/absence','POST',{entryId:Number(d.activeEntries[0].id),stand:14},token);
  assert.equal(blocked.status,409,'Cannot change physical map after draw');
  const reset=await request('/api/admin/competitions/'+id+'/draw','DELETE',{confirm:'RESET_LOSOWANIA'},token);
  assert.equal(reset.status,200,JSON.stringify(reset));assert.equal(reset.deletedDraws,28);assert.ok(Number(reset.recoveryId)>0);
  d=await request('/api/competitions/'+id,'GET',null,token);assert.equal(d.draws.length,0);assert.ok(d.latestRecovery);
  const restored=await request('/api/admin/competitions/'+id+'/recovery/latest','POST',{confirm:'PRZYWROC_OSTATNIA_KOPIE'},token);
  assert.equal(restored.status,200,JSON.stringify(restored));assert.equal(restored.restored.draws,28);
  d=await request('/api/competitions/'+id,'GET',null,token);assert.equal(d.draws.length,28);
  const uid=Number(d.activeEntries[0].user_id);
  await db.query("insert into result_items(competition_id,user_id,round,kind,weight) values($1,$2,1,'NET',1500)",[id,uid]);
  await db.query("insert into results(competition_id,user_id,round,weight,big_fish) values($1,$2,1,1500,0)",[id,uid]);
  const cleared=await request('/api/admin/competitions/'+id+'/results','DELETE',{confirm:'WYCZYSC_WYNIKI'},token);
  assert.equal(cleared.status,200,JSON.stringify(cleared));assert.ok(Number(cleared.recoveryId)>0);
  const rerun=await request('/api/admin/competitions/'+id+'/recovery/latest','POST',{confirm:'PRZYWROC_OSTATNIA_KOPIE'},token);
  assert.equal(rerun.status,200,JSON.stringify(rerun));assert.equal(rerun.restored.items,1);assert.equal(rerun.restored.results,1);
  d=await request('/api/competitions/'+id,'GET',null,token);assert.equal(d.resultItems.length,1);assert.equal(Number(d.results[0].weight),1500);
  assert.equal(d.competition.bank1_count,15);assert.equal(d.competition.bank2_count,14);
 }finally{child.kill('SIGTERM');await db.end()}
});
