'use strict';
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(process.env.HOME,'lowcy-small2-20261023');
const cfg=JSON.parse(fs.readFileSync(path.join(process.env.HOME,'.config/lowcy-small2/runtime.json'),'utf8'));
const url=new URL(cfg.DATABASE_URL);
if(url.hostname!=='pgsql3.small.pl'||url.pathname!=='/p1828_lowcy_kop')throw Error('WRONG_DATABASE');
const {Client}=require(path.join(root,'node_modules/pg'));
(async()=>{
 const db=new Client({connectionString:cfg.DATABASE_URL,ssl:false});
 await db.connect();
 try{
  await db.query('BEGIN READ ONLY');
  if((await db.query('SELECT current_database() db')).rows[0].db!=='p1828_lowcy_kop')throw Error('WRONG_CONNECTED_DATABASE');
  const expected={users:73,competitions:7,entries:157,draws:285,results:285,result_items:278,app_migrations:6};
  for(const [table,count] of Object.entries(expected)){
   const actual=(await db.query('SELECT count(*)::int n FROM public."'+table+'"')).rows[0].n;
   if(actual!==count)throw Error('UNEXPECTED_DATABASE_COUNT_'+table+'_'+actual);
  }
  await db.query('ROLLBACK');
  console.log('SMALL2_S1_DATABASE_UNCHANGED '+JSON.stringify(expected));
 }finally{await db.end()}
})().catch(e=>{console.error('SMALL2_S1_DB_GUARD_FAIL '+e.message);process.exitCode=1});
