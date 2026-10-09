'use strict';
const {Pool}=require('pg');
const bcrypt=require('bcryptjs');
const password=String(process.env.ACCOUNT_BATCH_PASSWORD||'');
const specs=JSON.parse(process.env.ACCOUNT_CREATE_SPEC||'[]');
const corrections=JSON.parse(process.env.ACCOUNT_PHONE_CORRECTIONS||'[]');
if(!password||!Array.isArray(specs)||!Array.isArray(corrections))throw new Error('Brak konfiguracji weryfikacji');
const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:false,max:2,connectionTimeoutMillis:8000});
const norm=s=>String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').replace(/[^a-z0-9а-яёіїєґ]+/gi,' ').trim().replace(/\s+/g,' ');
const clean=s=>String(s||'').replace(/\s+/g,'').replace(/[-()]/g,'');
(async()=>{try{
 const all=(await pool.query(`select id,first_name,last_name,phone,contact_phone,role,account_source,archived_at,password_hash from users where role='PLAYER'`)).rows;
 const find=name=>{const n=norm(name);return all.filter(u=>!u.archived_at&&(norm(u.first_name+' '+u.last_name)===n||norm(u.last_name+' '+u.first_name)===n))};
 const verified=[];
 for(const [name,p0] of corrections){const phone=clean(p0),m=find(name);if(m.length!==1)throw new Error(name+': rekordów '+m.length);const u=m[0];if(u.phone!==phone||u.contact_phone!==phone)throw new Error(name+': telefon niezgodny');verified.push({id:Number(u.id),name,phone:'***'+phone.slice(-3),mode:'phone-only'})}
 for(const [name,p0] of specs){const phone=clean(p0),m=find(name);if(m.length!==1)throw new Error(name+': rekordów '+m.length);const u=m[0];if(u.phone!==phone||u.contact_phone!==phone||u.account_source!=='SELF'||u.archived_at)throw new Error(name+': konto nieaktywne lub telefon niezgodny');if(!(await bcrypt.compare(password,u.password_hash||'')))throw new Error(name+': hasło kontrolne nie pasuje');const starts=(await pool.query(`select c.id,c.competition_date,e.status,(select count(*)::int from draws d where d.competition_id=c.id and d.user_id=$1) draws,(select count(*)::int from results r where r.competition_id=c.id and r.user_id=$1) results,(select coalesce(sum(r.weight),0)::bigint from results r where r.competition_id=c.id and r.user_id=$1) grams from entries e join competitions c on c.id=e.competition_id where e.user_id=$1 order by c.competition_date,c.id`,[u.id])).rows;if(!starts.length)throw new Error(name+': brak historii');for(const s of starts)if(Number(s.draws)!==2||Number(s.results)!==2)throw new Error(name+': niepełna historia zawodów '+s.id);verified.push({id:Number(u.id),name,phone:'***'+phone.slice(-3),mode:'account',starts:starts.map(s=>({id:Number(s.id),date:String(s.competition_date).slice(0,10),draws:Number(s.draws),results:Number(s.results),grams:Number(s.grams)}))})}
 const g=(await pool.query(`select (select count(*)::int from users) users,(select count(*)::int from entries) entries,(select count(*)::int from draws) draws,(select count(*)::int from results) results,(select count(*)::int from result_items) items,(select coalesce(sum(weight),0)::bigint from results) grams`)).rows[0];
 if(Number(g.users)!==42||Number(g.entries)!==56||Number(g.draws)!==112||Number(g.results)!==112||Number(g.items)!==111||String(g.grams)!=='1957378')throw new Error('Globalna kontrola danych niezgodna '+JSON.stringify(g));
 console.log('ACCOUNT_VERIFY_OK '+JSON.stringify({verified,global:{users:Number(g.users),entries:Number(g.entries),draws:Number(g.draws),results:Number(g.results),items:Number(g.items),grams:String(g.grams)}}));
}catch(e){console.error('ACCOUNT_VERIFY_FAILED '+String(e&&e.stack?e.stack:e));process.exitCode=1}finally{await pool.end().catch(()=>{})}})();
