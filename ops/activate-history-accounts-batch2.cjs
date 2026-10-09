'use strict';
const {Pool}=require('pg');

const APP='https://lowcy-methodowcy-app-production.up.railway.app';
const password=String(process.env.ACCOUNT_BATCH_PASSWORD||'');
if(!password) throw new Error('Brak ACCOUNT_BATCH_PASSWORD');

const wanted=[
  ['Rafał Siporski','735140939'],
  ['Paweł Kępa','606952571'],
  ['Damian Abram','519824212'],
  ['Rafał Klimkiewicz','607532779'],
  ['Wojtek Wojno','798309235'],
  ['Kacper Nalepa','660789489'],
  ['Przemysław Kuligowski','669002263'],
  ['Przemek Warmijak','502396890']
];

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
    (select coalesce(sum(weight),0)::bigint from results) grams`)).rows[0];
}
async function startsFor(id){
  return (await pool.query(`select c.id,c.competition_date,c.title,e.status,
    (select count(*)::int from draws d where d.competition_id=c.id and d.user_id=$1) draws,
    (select count(*)::int from results r where r.competition_id=c.id and r.user_id=$1) results,
    (select coalesce(sum(r.weight),0)::bigint from results r where r.competition_id=c.id and r.user_id=$1) grams
    from entries e join competitions c on c.id=e.competition_id
    where e.user_id=$1 order by c.competition_date,c.id`,[id])).rows;
}
const sig=rows=>rows.map(r=>[String(r.id),String(r.status),Number(r.draws),Number(r.results),String(r.grams)]);
function findByName(all,name){
  const n=norm(name);
  return all.filter(u=>!u.archived_at&&(norm(u.first_name+' '+u.last_name)===n||norm(u.last_name+' '+u.first_name)===n));
}

(async()=>{
  const before=await snapshot();
  let all=(await pool.query(`select id,first_name,last_name,phone,contact_phone,pzw_club,role,account_source,archived_at,last_login_at,last_active_at from users where role='PLAYER'`)).rows;

  // BARTOSZ: tylko zmiana telefonu/loginu, bez zmiany hasła, wyników, roli i historii.
  const bm=findByName(all,'Bartosz Zduńczyk');
  if(bm.length!==1)throw new Error('Bartosz Zduńczyk: znaleziono '+bm.length+' rekordów');
  const b=bm[0], newB='794639019';
  const bOwner=all.find(x=>!x.archived_at&&String(x.phone)===newB&&Number(x.id)!==Number(b.id));
  if(bOwner)throw new Error('Telefon 794639019 jest już zajęty');
  const oldLogin=b.last_login_at, oldActive=b.last_active_at;
  if(String(b.phone)!==newB){
    const q=await pool.query(`update users set phone=$1,contact_phone=$1 where id=$2 and role='PLAYER' returning id`,[newB,b.id]);
    if(q.rowCount!==1)throw new Error('Nie udało się zmienić telefonu Bartosza');
  }
  const bLogin=await post('/api/login',{phone:newB,password});
  if(Number(bLogin?.user?.id)!==Number(b.id))throw new Error('Test logowania Bartosza zwrócił inne ID');
  await pool.query(`update users set last_login_at=$1,last_active_at=$2 where id=$3`,[oldLogin,oldActive,b.id]);
  console.log('BARTOSZ_PHONE_ONLY_OK '+JSON.stringify({id:Number(b.id),phone:'***019'}));

  all=(await pool.query(`select id,first_name,last_name,phone,contact_phone,pzw_club,role,account_source,archived_at,last_login_at,last_active_at from users where role='PLAYER'`)).rows;
  const resolved=[];
  for(const [fullName,phoneRaw] of wanted){
    const phone=String(phoneRaw||'').replace(/\s+/g,'');
    if(!/^\d{9}$/.test(phone))throw new Error('Niepoprawny telefon dla '+fullName);
    const matches=findByName(all,fullName);
    if(matches.length!==1)throw new Error('Nazwisko '+fullName+': znaleziono '+matches.length+' rekordów');
    const u=matches[0];
    const owner=all.find(x=>!x.archived_at&&String(x.phone)===phone&&Number(x.id)!==Number(u.id));
    if(owner)throw new Error('Telefon zajęty dla '+fullName+' przez ID '+owner.id);
    resolved.push({
      id:Number(u.id),fullName,phone,firstName:u.first_name,lastName:u.last_name,club:u.pzw_club||'',
      oldPhone:u.phone,oldContact:u.contact_phone,oldArchived:u.archived_at,oldLogin:u.last_login_at,oldActive:u.last_active_at,
      source:u.account_source,startsSig:sig(await startsFor(u.id))
    });
  }
  console.log('ACCOUNT_BATCH_2_PRECHECK_OK '+JSON.stringify(resolved.map(x=>({id:x.id,name:x.fullName,phone:'***'+x.phone.slice(-3),source:x.source,starts:x.startsSig}))));

  const completed=[];
  for(const x of resolved){
    if(String(x.oldPhone)===x.phone&&String(x.source)==='SELF'&&!x.oldArchived){
      const login=await post('/api/login',{phone:x.phone,password});
      if(Number(login?.user?.id)!==x.id)throw new Error('Istniejące konto ma inne ID dla '+x.fullName);
      await pool.query(`update users set last_login_at=$1,last_active_at=$2 where id=$3`,[x.oldLogin,x.oldActive,x.id]);
      completed.push({id:x.id,name:x.fullName,status:'already',starts:await startsFor(x.id)});
      console.log('ACCOUNT_2_ALREADY '+JSON.stringify({id:x.id,name:x.fullName,phone:'***'+x.phone.slice(-3)}));
      continue;
    }

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
      completed.push({id:x.id,name:x.fullName,status:'activated',starts});
      console.log('ACCOUNT_2_OK '+JSON.stringify({id:x.id,name:x.fullName,phone:'***'+x.phone.slice(-3),starts:starts.map(r=>({id:Number(r.id),draws:Number(r.draws),results:Number(r.results),grams:Number(r.grams)}))}));
    }catch(e){
      await pool.query(`update users set phone=$1,contact_phone=$2,archived_at=$3,last_login_at=$4,last_active_at=$5 where id=$6`,[x.oldPhone,x.oldContact,x.oldArchived,x.oldLogin,x.oldActive,x.id]).catch(()=>{});
      throw e;
    }
  }

  const after=await snapshot();
  for(const k of ['users','entries','draws','results','result_items','grams']){
    if(String(before[k])!==String(after[k]))throw new Error('Zmienił się licznik '+k+': '+before[k]+' -> '+after[k]);
  }
  const bv=(await pool.query(`select id,phone,contact_phone,role,account_source,archived_at from users where id=$1`,[b.id])).rows[0];
  if(!bv||bv.phone!==newB||bv.contact_phone!==newB||bv.archived_at)throw new Error('Końcowa kontrola Bartosza nie przeszła');
  console.log('ACCOUNT_BATCH_2_COMMIT_OK '+JSON.stringify({count:completed.length,bartosz:{id:Number(b.id),phone:'***019'},before,after,accounts:completed.map(x=>({id:x.id,name:x.name,status:x.status,starts:x.starts.map(r=>({id:Number(r.id),draws:Number(r.draws),results:Number(r.results),grams:Number(r.grams)}))}))}));
})().catch(e=>{
  console.error('ACCOUNT_BATCH_2_FAILED '+String(e&&e.stack?e.stack:e));
  process.exitCode=1;
}).finally(async()=>{await pool.end().catch(()=>{})});
