'use strict';
const path=require('node:path'),fs=require('node:fs');
const root=path.join(process.env.HOME,'lowcy-small2-20261023');
const cfg=JSON.parse(fs.readFileSync(path.join(process.env.HOME,'.config/lowcy-small2/runtime.json'),'utf8'));
const url=new URL(cfg.DATABASE_URL);
if(url.hostname!=='pgsql3.small.pl'||url.pathname!=='/p1828_lowcy_kop')throw Error('WRONG_DB');
const {Client}=require(path.join(root,'node_modules','pg'));
const jwt=require(path.join(root,'node_modules','jsonwebtoken'));
(async()=>{
 const db=new Client({connectionString:cfg.DATABASE_URL});await db.connect();
 let admin,expected;
 try{
  await db.query('BEGIN READ ONLY');
  admin=(await db.query("select id,auth_version from users where role='ADMIN' and archived_at is null order by id limit 1")).rows[0];
  if(!admin)throw Error('ADMIN_MISSING');
  expected=(await db.query(`
   select c.id,
     (select count(*)::int from entries e where e.competition_id=c.id) entries,
     (select count(*)::int from draws d where d.competition_id=c.id) draws,
     (select count(*)::int from results r where r.competition_id=c.id) results,
     (select count(*)::int from result_items ri where ri.competition_id=c.id) result_items
   from competitions c order by c.id
  `)).rows;
  await db.query('ROLLBACK');
 }finally{await db.end()}
 const bearer=jwt.sign({uid:admin.id,role:'ADMIN',v:Number(admin.auth_version||0)},cfg.JWT_SECRET,{expiresIn:'5m'});
 const totals={entries:0,draws:0,results:0,result_items:0};
 for(const row of expected){
  const resp=await fetch('https://lowcymethodowcy.smallhost.pl/api/competitions/'+row.id,{headers:{Authorization:'Bearer '+bearer},signal:AbortSignal.timeout(15000)});
  if(resp.status!==200)throw Error('COMPETITION_DETAIL_HTTP_'+row.id+'_'+resp.status);
  const d=await resp.json();
  if(!d.ok||String(d.competition?.id)!==String(row.id))throw Error('COMPETITION_ID_MISMATCH_'+row.id);
  for(const [dbField,apiField] of Object.entries({entries:'entries',draws:'draws',results:'results',result_items:'resultItems'})){
    if(!Array.isArray(d[apiField])||d[apiField].length!==row[dbField])throw Error('DETAIL_COUNT_MISMATCH_'+row.id+'_'+dbField);
    totals[dbField]+=d[apiField].length;
  }
  if(!d.classification||!Array.isArray(d.classification.round1)||!Array.isArray(d.classification.general))throw Error('CLASSIFICATION_MISSING_'+row.id);
  console.log('SMALL2_EVENT_DETAIL_OK '+JSON.stringify({eventId:row.id,entries:row.entries,draws:row.draws,results:row.results,resultItems:row.result_items,generalRanks:d.classification.general.length}));
 }
 if(totals.entries!==157||totals.draws!==285||totals.results!==285||totals.result_items!==278)throw Error('EVENT_AGGREGATE_MISMATCH');
 console.log('SMALL2_ALL_7_COMPETITIONS_DETAILS_CLASSIFICATION_AND_ROUND_DATA_OK '+JSON.stringify(totals));
})().catch(e=>{console.error('SMALL2_EVENT_DETAILS_CHECK_FAILED '+e.message);process.exitCode=1});
