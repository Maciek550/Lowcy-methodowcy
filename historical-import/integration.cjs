'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),{spawn}=require('node:child_process'),{Pool}=require('pg');
const source=require('./fixtures/synthetic-28.json');
if(!process.env.DATABASE_URL)throw Error('Requires an isolated test PostgreSQL database');
test('PostgreSQL: full import, unchanged credentials, history merge, duplicate and rollback safety',{timeout:120000},async()=>{
 const db=new Pool({connectionString:process.env.DATABASE_URL,ssl:false});
 const port=32918,output=[],child=spawn(process.execPath,['server.cjs'],{env:{...process.env,PORT:String(port),ADMIN_SETUP_CODE:'local-test-only',JWT_SECRET:'local-import-test'},stdio:['ignore','pipe','pipe']});
 child.stdout.on('data',x=>output.push(String(x)));child.stderr.on('data',x=>output.push(String(x)));
 async function req(route,body,token){const res=await fetch('http://127.0.0.1:'+port+route,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});return {status:res.status,...await res.json()}}
 try{
  let ready=false;for(let i=0;i<100;i++){try{if((await req('/health')).ok){ready=true;break}}catch{}if(child.exitCode!==null)throw Error(output.join(''));await new Promise(r=>setTimeout(r,150))}assert.ok(ready,output.join(''));
  const auth=await req('/api/setup-admin',{setupCode:'local-test-only',phone:'501000099',password:'isolated-test',firstName:'Test',lastName:'Admin'});assert.equal(auth.status,200,JSON.stringify(auth));
  const token=auth.token;
  const reg=await req('/api/register',{phone:'501000098',password:'isolated-test',firstName:'Testowy',lastName:'Zawodnik1'});assert.equal(reg.status,200);
  const original=(await db.query('SELECT * FROM users WHERE id=$1',[reg.user.id])).rows[0];
  const tech=(await db.query("INSERT INTO users(phone,password_hash,first_name,last_name,role,account_source) VALUES('IMPORT-test','unchanged','Testowy','Zawodnik1','PLAYER','EXTERNAL') RETURNING id")).rows[0].id;
  const old=(await db.query("INSERT INTO competitions(title,competition_date,status) VALUES('Old history','2026-01-01','CLOSED') RETURNING id")).rows[0].id;
  await db.query("INSERT INTO entries(competition_id,user_id) VALUES($1,$2)",[old,tech]);
  await db.query("INSERT INTO results(competition_id,user_id,round,weight) VALUES($1,$2,1,500)",[old,tech]);
  const counts=async()=>(await db.query('SELECT (SELECT count(*) FROM users)::int users,(SELECT count(*) FROM competitions)::int competitions,(SELECT count(*) FROM results)::int results')).rows[0];
  const before=await counts();
  assert.equal((await req('/api/admin/historical-import/preview',source,reg.token)).status,403);
  const preview=await req('/api/admin/historical-import/preview',source,token);assert.equal(preview.status,200,JSON.stringify(preview));assert.deepEqual(await counts(),before,'Preview must not write');assert.equal(preview.matches.length,28);
  assert.equal(preview.matches.find(p=>p.name==='Testowy Zawodnik1').userId,Number(reg.user.id));
  const payload={...preview.draft,previewToken:preview.previewToken,accountDigest:preview.accountDigest,confirm:true};
  assert.equal((await req('/api/admin/historical-import/confirm',{...payload,title:'tampered'},token)).status,409);
  const saved=await req('/api/admin/historical-import/confirm',payload,token);assert.equal(saved.status,200,JSON.stringify(saved));assert.equal(saved.result.results,56);const id=saved.result.competitionId;
  const current=(await db.query('SELECT * FROM users WHERE id=$1',[reg.user.id])).rows[0];for(const k of ['phone','password_hash','first_name','last_name','auth_version'])assert.equal(current[k],original[k],k);
  assert.ok((await db.query('SELECT archived_at FROM users WHERE id=$1',[tech])).rows[0].archived_at);
  assert.equal(Number((await db.query('SELECT user_id FROM results WHERE competition_id=$1',[old])).rows[0].user_id),Number(reg.user.id));
  const detail=await req('/api/competitions/'+id,null,token);assert.equal(detail.activeEntries.length,28);assert.equal(detail.results.length,56);
  for(const g of source.general){const actual=detail.classification.general.find(x=>x.name===g.name);assert.ok(actual,g.name);assert.equal(actual.rank,g.rank,g.name);assert.equal(actual.total_weight,g.weight,g.name);assert.equal(actual.sum_points,g.points,g.name)}
  const totals=await db.query('SELECT r.user_id,r.round,r.weight,r.big_fish,sum(i.weight)::int total,max(case when i.kind=\'BF\' then i.weight else 0 end)::int bf FROM results r LEFT JOIN result_items i ON i.competition_id=r.competition_id AND i.user_id=r.user_id AND i.round=r.round WHERE r.competition_id=$1 GROUP BY r.id',[id]);for(const r of totals.rows){assert.equal(r.total||0,r.weight);assert.equal(r.bf||0,r.big_fish)}
  const after=await counts();assert.equal((await req('/api/admin/historical-import/confirm',payload,token)).status,409);assert.deepEqual(await counts(),after);
  // A fresh preview from the PDF-equivalent data cannot duplicate the same event under another title.
  const duplicate=await req('/api/admin/historical-import/preview',{...source,title:'Alternative title',sourceId:''},token);
  assert.equal((await req('/api/admin/historical-import/confirm',{...duplicate.draft,previewToken:duplicate.previewToken,accountDigest:duplicate.accountDigest,confirm:true},token)).status,409);assert.deepEqual(await counts(),after);
  // Inject a failure after account/event creation and assert everything rolls back.
  await db.query("CREATE FUNCTION fail_import() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced result failure'; END $$; CREATE TRIGGER fail_import BEFORE INSERT ON results FOR EACH ROW EXECUTE FUNCTION fail_import()");
  const broken={title:'Rollback test',date:'2026-03-01',rows:[{name:'New Rollback',round:1,sector:'A',stand:1,weight:100}]};
  const bp=await req('/api/admin/historical-import/preview',broken,token);
  const fail=await req('/api/admin/historical-import/confirm',{...bp.draft,previewToken:bp.previewToken,accountDigest:bp.accountDigest,confirm:true},token);assert.equal(fail.status,409,JSON.stringify(fail));assert.deepEqual(await counts(),after);
  console.log('VERIFIED: 28 players, 56 results, 28 exact final ranks; credentials preserved; technical history merged; repeated import rejected; transaction rollback complete.');
 }finally{child.kill('SIGTERM');await db.end()}
});
