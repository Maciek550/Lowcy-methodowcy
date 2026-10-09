'use strict';
const {Pool}=require('pg');
const APP='https://lowcy-methodowcy-app-production.up.railway.app';
const password=String(process.env.ACCOUNT_BATCH_PASSWORD||'');
const specs=JSON.parse(process.env.ACCOUNT_CREATE_SPEC||'[]');
const corrections=JSON.parse(process.env.ACCOUNT_PHONE_CORRECTIONS||'[]');
if(!password||!Array.isArray(specs)||!Array.isArray(corrections))throw new Error('Brak konfiguracji');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:false,max:2,connectionTimeoutMillis:8000});
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').replace(/[^a-z0-9а-яёіїєґ]+/gi,' ').trim().replace(/\s+/g,' ');
const clean=s=>String(s||'').replace(/\s+/g,'').replace(/[-()]/g,'');
async function post(path,body){const r=await fetch(APP+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(path+' '+r.status+' '+String(j.error||''));return j}
async function hist(id){return (await pool.query(`select c.id,e.status,(select count(*)::int from draws d where d.competition_id=c.id and d.user_id=$1) draws,(select count(*)::int from results r where r.competition_id=c.id and r.user_id=$1) results,(select coalesce(sum(r.weight),0)::bigint from results r where r.competition_id=c.id and r.user_id=$1) grams from entries e join competitions c on c.id=e.competition_id where e.user_id=$1 order by c.id`,[id])).rows.map(r=>[String(r.id),String(r.status),Number(r.draws),Number(r.results),String(r.grams)])}
(async()=>{try{
 const all=(await pool.query(`select id,first_name,last_name,phone,contact_phone,pzw_club,role,account_source,archived_at,last_login_at,last_active_at from users where role='PLAYER'`)).rows;
 const find=name=>{const n=norm(name);return all.filter(u=>!u.archived_at&&(norm(u.first_name+' '+u.last_name)===n||norm(u.last_name+' '+u.first_name)===n))};
 const prepCorr=[]; for(const [name,p0] of corrections){const phone=clean(p0),m=find(name);if(m.length!==1)throw new Error(name+': rekordów '+m.length);const u=m[0];const clash=all.find(x=>!x.archived_at&&String(x.phone)===phone&&Number(x.id)!==Number(u.id));if(clash)throw new Error(name+': telefon zajęty');prepCorr.push({u,name,phone,h:await hist(u.id)})}
 const prep=[]; for(const [name,p0] of specs){const phone=clean(p0),m=find(name);if(m.length!==1)throw new Error(name+': rekordów '+m.length);const u=m[0];const h=await hist(u.id);if(!h.length)throw new Error(name+': brak historii');prep.push({u,name,phone,h})}
 console.log('REGISTER_BATCH_PRECHECK_OK '+JSON.stringify({corrections:prepCorr.map(x=>({id:Number(x.u.id),name:x.name,phone:'***'+x.phone.slice(-3)})),accounts:prep.map(x=>({id:Number(x.u.id),name:x.name,phone:'***'+x.phone.slice(-3),starts:x.h.length}))}));
 for(const x of prepCorr){await pool.query(`update users set phone=$1,contact_phone=$1 where id=$2`,[x.phone,x.u.id]);if(JSON.stringify(await hist(x.u.id))!==JSON.stringify(x.h))throw new Error(x.name+': historia zmieniona przy korekcie')}
 for(const x of prep){
  const owner=(await pool.query(`select id from users where phone=$1 and archived_at is null and id<>$2`,[x.phone,x.u.id])).rows[0];if(owner)throw new Error(x.name+': telefon zajęty');
  if(String(x.u.phone)!==x.phone||x.u.account_source!=='SELF'){
   await pool.query(`update users set phone=$1,contact_phone=$1,archived_at=now() where id=$2`,[x.phone,x.u.id]);
   const reg=await post('/api/register',{phone:x.phone,password,firstName:x.u.first_name,lastName:x.u.last_name,pzwClub:x.u.pzw_club||'-'});if(Number(reg?.user?.id)!==Number(x.u.id))throw new Error(x.name+': inne ID po rejestracji');
  }
  const login=await post('/api/login',{phone:x.phone,password});if(Number(login?.user?.id)!==Number(x.u.id))throw new Error(x.name+': logowanie zwróciło inne ID');
  await pool.query(`update users set last_login_at=$1,last_active_at=$2,contact_phone=$3 where id=$4`,[x.u.last_login_at,x.u.last_active_at,x.phone,x.u.id]);
  if(JSON.stringify(await hist(x.u.id))!==JSON.stringify(x.h))throw new Error(x.name+': historia zmieniona po aktywacji');
  console.log('REGISTER_ACCOUNT_OK '+JSON.stringify({id:Number(x.u.id),name:x.name,phone:'***'+x.phone.slice(-3),starts:x.h.length}));
 }
 console.log('REGISTER_BATCH_COMMIT_OK');
}catch(e){console.error('REGISTER_BATCH_FAILED '+String(e&&e.stack?e.stack:e));process.exitCode=1}finally{await pool.end().catch(()=>{})}})();
