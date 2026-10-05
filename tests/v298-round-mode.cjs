'use strict';
const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const {Pool}=require('pg');
const path=require('node:path');
(async()=>{
  const db=new Pool({connectionString:process.env.DATABASE_URL,ssl:false});
  const port=Number(process.env.V298_TEST_PORT||32928),base='http://127.0.0.1:'+port,secret='v298-ci-admin',logs=[];
  await db.query('drop schema public cascade; create schema public');
  const child=spawn(process.execPath,['server.cjs'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),ADMIN_SETUP_CODE:secret,JWT_SECRET:'v298-test-key'},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',x=>logs.push(x.toString()));child.stderr.on('data',x=>logs.push(x.toString()));
  async function req(route,method='GET',body,token){const r=await fetch(base+route,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});const p=await r.json().catch(()=>({}));return {status:r.status,...p}}
  async function players(compId,n,prefix){for(let i=1;i<=n;i++){const u=await db.query("insert into users(phone,password_hash,first_name,last_name,pzw_club,role,account_source) values($1,'x','Test',$2,'7','PLAYER','ADMIN') returning id",[prefix+'-'+i,'Zawodnik '+i]);await db.query("insert into entries(competition_id,user_id,status) values($1,$2,'ACTIVE')",[compId,u.rows[0].id])}}
  try{
    let ok=false;for(let i=0;i<100;i++){if(child.exitCode!==null)throw Error(logs.join('\n').slice(-2500));try{if((await req('/health')).ok){ok=true;break}}catch(_){}await new Promise(r=>setTimeout(r,200))}assert.equal(ok,true,'server health');
    const auth=await req('/api/setup-admin','POST',{setupCode:secret,phone:'509298000',password:'test-pass-298',firstName:'V298',lastName:'Admin'});assert.equal(auth.status,200,JSON.stringify(auth));const token=auth.token;

    const two=await req('/api/competitions','POST',{title:'V298 TEST 2 TURY',fishery:'CI',status:'TEST',competitionDate:'2026-12-20',limitPlaces:8,mapMode:'TWO_OPPOSITE',bank1Count:4,bank2Count:4,sectorsCount:4},token);assert.equal(two.status,200,JSON.stringify(two));assert.equal(Number(two.competition.round_count),2,'default must stay two-round');const twoId=Number(two.competition.id);await players(twoId,8,'V298-2R');
    const d21=await req('/api/admin/competitions/'+twoId+'/draw/1','POST',{},token);assert.equal(d21.status,200,JSON.stringify(d21));assert.equal(d21.assignment.length,8);
    const d22=await req('/api/admin/competitions/'+twoId+'/draw/2','POST',{},token);assert.equal(d22.status,200,JSON.stringify(d22));assert.equal(d22.assignment.length,8,'T2 must still work');
    const by1=new Map(d21.assignment.map(x=>[Number(x.user_id),Number(x.stand)]));for(const x of d22.assignment)assert.notEqual(Number(x.stand),by1.get(Number(x.user_id)),'T2 repeated T1 stand');
    const r21=await req('/api/admin/competitions/'+twoId+'/results/1/generate','POST',{},token);const r22=await req('/api/admin/competitions/'+twoId+'/results/2/generate','POST',{},token);assert.equal(r21.status,200,JSON.stringify(r21));assert.equal(r22.status,200,JSON.stringify(r22));
    const detail2=await req('/api/competitions/'+twoId,'GET',undefined,token);assert.equal(Number(detail2.competition.round_count),2);assert.equal(detail2.classification.round1.length,8);assert.equal(detail2.classification.round2.length,8);assert.equal(detail2.classification.general.length,8);for(const g of detail2.classification.general){assert.equal(Number(g.sum_points),Number(g.t1_points||0)+Number(g.t2_points||0));assert.equal(Number(g.total_weight),Number(g.t1_weight||0)+Number(g.t2_weight||0))}

    const one=await req('/api/competitions','POST',{title:'V298 TEST 1 TURA',fishery:'CI',status:'TEST',competitionDate:'2026-12-21',limitPlaces:8,mapMode:'TWO_OPPOSITE',bank1Count:4,bank2Count:4,sectorsCount:4,roundCount:1},token);assert.equal(one.status,200,JSON.stringify(one));assert.equal(Number(one.competition.round_count),1);const oneId=Number(one.competition.id);await players(oneId,8,'V298-1R');
    const d11=await req('/api/admin/competitions/'+oneId+'/draw/1','POST',{},token);assert.equal(d11.status,200,JSON.stringify(d11));assert.equal(d11.assignment.length,8);
    const d12=await req('/api/admin/competitions/'+oneId+'/draw/2','POST',{},token);assert.notEqual(d12.status,200,'one-round event must reject T2 draw');assert.match(String(d12.error||''),/1-turowe/);
    const r11=await req('/api/admin/competitions/'+oneId+'/results/1/generate','POST',{},token);assert.equal(r11.status,200,JSON.stringify(r11));const r12=await req('/api/admin/competitions/'+oneId+'/results/2/generate','POST',{},token);assert.notEqual(r12.status,200,'one-round event must reject T2 results');
    const detail1=await req('/api/competitions/'+oneId,'GET',undefined,token);assert.equal(detail1.classification.round1.length,8);assert.equal(detail1.classification.round2.length,0);assert.equal(detail1.classification.general.length,8);for(const g of detail1.classification.general){assert.equal(g.t2_points,null);assert.equal(Number(g.t2_weight),0);assert.equal(Number(g.sum_points),Number(g.t1_points||0));assert.equal(Number(g.total_weight),Number(g.t1_weight||0))}
    const general=await req('/api/admin/competitions/'+oneId+'/results/general/notify','POST',{},token);assert.equal(general.status,200,JSON.stringify(general));
    const locked=await req('/api/competitions/'+oneId,'PATCH',{roundCount:2,limitPlaces:8,title:'V298 TEST 1 TURA',fishery:'CI',competitionDate:'2026-12-21',status:'TEST'},token);assert.equal(locked.status,409,'format must lock after draw/results');
    console.log('V298 REGRESSION OK: two-round full draw/results/general + one-round draw/results/general');
  }finally{child.kill('SIGTERM');await db.end()}
})().catch(e=>{console.error(e);process.exit(1)});
