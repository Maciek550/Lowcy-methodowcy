'use strict';
const {Pool}=require('pg');

const APP='https://lowcy-methodowcy-app-production.up.railway.app';
const password=String(process.env.ACCOUNT_BATCH_PASSWORD||'');
const specs=JSON.parse(process.env.ACCOUNT_BATCH_SPEC||'[]');
if(!password) throw new Error('Brak ACCOUNT_BATCH_PASSWORD');
if(!Array.isArray(specs)||!specs.length) throw new Error('Brak ACCOUNT_BATCH_SPEC');

const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:false,max:2,connectionTimeoutMillis:8000});
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').replace(/[^a-z0-9а-яёіїєґ]+/gi,' ').trim().replace(/\s+/g,' ');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

async function post(path,body){
  let last;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const r=await fetch(APP+path,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
      const j=await r.json().catch(()=>({}));
      if(r.ok)return j;
      if(r.status<500)throw new Error(path+' HTTP '+r.status+' '+String(j.error||''));
      last=new Error(path+' HTTP '+r.status+' '+String(j.error||''));
    }catch(e){last=e}
    if(attempt<3)await sleep(800*attempt);
  }
  throw last||new Error('Błąd '+path);
}

async function snapshot(){
  return (await pool.query(`select
    (select count(*)::int from users) users,
    (select count(*)::int from entries) entries,
    (select count(*)::int from draws) draws,
    (select count(*)::int from results) results,
    (select count(*)::int from result_items) result_items,
    (select coalesce(sum(total_grams),0)::bigint from results) grams`)).rows[0];
}
async function startsFor(id){
  return (await pool.query(`select c.id,c.competition_date,c.title,e.status,
    (select count(*)::int from draws d where d.competition_id=c.id and d.user_id=$1) draws,
    (select count(*)::int from results r where r.competition_id=c.id and r.user_id=$1) results,
    (select coalesce(sum(r.total_grams),0)::bigint from results r where r.competition_id=c.id and r.user_id=$1) grams
    from entries e join competitions c on c.id=e.competition_id
    where e.user_id=$1 order by c.competition_date,c.id`,[id])).rows;
}
const sig=rows=>rows.map(r=>[String(r.id),String(r.status),Number(r.draws),Number(r.results),String(r.grams)]);

(async()=>{
  const before=await snapshot();
  const all=(await pool.query(`select id,first_name,last_name,phone,contact_phone,pzw_club,role,account_source,archived_at,last_login_at,last_active_at from users where role='PLAYER'`)).rows;
  const resolved=[];

  for(const [fullName,phoneRaw] of specs){
    const phone=String(phoneRaw||'').replace(/\s+/g,'');
    if(!/^\d{9}$/.test(phone))throw new Error('Niepoprawny telefon dla '+fullName);
    const matches=all.filter(u=>!u.archived_at&&norm(u.first_name+' '+u.last_name)===norm(fullName));
    if(matches.length!==1)throw new Error('Nazwisko '+fullName+': znaleziono '+matches.length+' rekordów');
    const u=matches[0];
    const owner=all.find(x=>!x.archived_at&&String(x.phone)===phone&&Number(x.id)!==Number(u.id));
    if(owner)throw new Error('Telefon zajęty dla '+fullName);
    const starts=await startsFor(u.id);
    if(!starts.length)throw new Error('Brak historii dla '+fullName);
    resolved.push({
      id:Number(u.id),fullName,phone,firstName:u.first_name,lastName:u.last_name,
      club:u.pzw_club||'',oldPhone:u.phone,oldContact:u.contact_phone,
      oldArchived:u.archived_at,oldLogin:u.last_login_at,oldActive:u.last_active_at,
      startsSig:sig(starts)
    });
  }
  console.log('ACCOUNT_BATCH_PRECHECK_OK '+JSON.stringify(resolved.map(x=>({id:x.id,name:x.fullName,phone:'***'+x.phone.slice(-3),starts:x.startsSig}))));

  const completed=[];
  for(const x of resolved){
    const prep=await pool.query(`update users set phone=$1,contact_phone=$1,archived_at=now()
      where id=$2 and role='PLAYER' and archived_at is null returning id`,[x.phone,x.id]);
    if(prep.rowCount!==1)throw new Error('Nie udało się przygotować '+x.fullName);
    try{
      const reg=await post('/api/register',{phone:x.phone,password,firstName:x.firstName,lastName:x.lastName,pzwClub:x.club||'-'});
      if(Number(reg?.user?.id)!==x.id)throw new Error('Rejestracja zwróciła inne ID dla '+x.fullName);
      const login=await post('/api/login',{phone:x.phone,password});
      if(Number(login?.user?.id)!==x.id)throw new Error('Logowanie zwróciło inne ID dla '+x.fullName);
      await pool.query(`update users set pzw_club=$1,contact_phone=$2,last_login_at=$3,last_active_at=$4 where id=$5`,[x.club,x.phone,x.oldLogin,x.oldActive,x.id]);
      const starts=await startsFor(x.id);
      if(JSON.stringify(sig(starts))!==JSON.stringify(x.startsSig))throw new Error('Historia zmieniła się dla '+x.fullName);
      const u=(await pool.query(`select id,phone,contact_phone,role,account_source,archived_at from users where id=$1`,[x.id])).rows[0];
      if(!u||u.phone!==x.phone||u.contact_phone!==x.phone||u.role!=='PLAYER'||u.account_source!=='SELF'||u.archived_at)throw new Error('Weryfikacja konta nie przeszła dla '+x.fullName);
      completed.push({id:x.id,name:x.fullName,phone:'***'+x.phone.slice(-3),starts:starts.map(r=>({date:String(r.competition_date).slice(0,10),draws:Number(r.draws),results:Number(r.results),grams:Number(r.grams)}))});
      console.log('ACCOUNT_OK '+JSON.stringify(completed[completed.length-1]));
    }catch(e){
      await pool.query(`update users set phone=$1,contact_phone=$2,archived_at=$3,last_login_at=$4,last_active_at=$5 where id=$6`,[x.oldPhone,x.oldContact,x.oldArchived,x.oldLogin,x.oldActive,x.id]).catch(()=>{});
      throw e;
    }
  }

  const after=await snapshot();
  for(const k of ['users','entries','draws','results','result_items','grams']){
    if(String(before[k])!==String(after[k]))throw new Error('Zmienił się licznik '+k+': '+before[k]+' -> '+after[k]);
  }
  console.log('ACCOUNT_BATCH_COMMIT_OK '+JSON.stringify({count:completed.length,before,after,accounts:completed}));
})().catch(e=>{
  console.error('ACCOUNT_BATCH_FAILED '+String(e&&e.stack?e.stack:e));
  process.exitCode=1;
}).finally(async()=>{await pool.end().catch(()=>{})});
