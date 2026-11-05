'use strict';
const fs=require('node:fs'),path=require('node:path');
const source=path.join(process.env.HOME,'lowcy-small2-20261023');
const cfg=JSON.parse(fs.readFileSync(path.join(process.env.HOME,'.config/lowcy-small2/runtime.json'),'utf8'));
const b=JSON.parse(fs.readFileSync(path.join(process.env.HOME,'lowcy-small2-stage-v311/railway-source-20261105-v311.json'),'utf8'));
const u=new URL(cfg.DATABASE_URL);
if(u.hostname!=='pgsql3.small.pl'||u.pathname!=='/p1828_lowcy_kop'||u.username!=='p1828_lowcy_kop')throw Error('TARGET_INVALID');
if(b.format!=='LOWCY_METHODOWCY_DB_BACKUP_V1'||b.database.tables!==19||b.data.app_migrations.length!==6)throw Error('SOURCE_INVALID');
const appCols=b.columns.app_migrations.map(c=>c.name+':'+c.udt_name);
if(appCols.length!==2||!appCols.includes('id:text')||!appCols.includes('applied_at:timestamptz'))throw Error('MIGRATION_SCHEMA_UNEXPECTED');
const {Client}=require(path.join(source,'node_modules','pg'));
(async()=>{
 const c=new Client({connectionString:cfg.DATABASE_URL,ssl:false});
 await c.connect();
 try{
  await c.query('BEGIN');
  if((await c.query('SELECT current_database() db')).rows[0].db!=='p1828_lowcy_kop')throw Error('WRONG_DATABASE');
  const tables=(await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows.map(r=>r.table_name);
  const missing=Object.keys(b.data).filter(t=>!tables.includes(t));
  if(missing.length!==1||missing[0]!=='app_migrations')throw Error('SCHEMA_DIFF_UNEXPECTED '+missing.join(','));
  const settings=await c.query('SELECT key FROM public.app_settings ORDER BY key');
  console.log('SMALL2_INITIAL_SETTINGS_KEYS '+JSON.stringify(settings.rows.map(r=>r.key)));
  if(settings.rows.length!==2)throw Error('APP_SETTINGS_NOT_EXPECTED');
  for(const table of tables){
   if(table==='app_settings')continue;
   const r=await c.query('SELECT COUNT(*)::integer n FROM public."'+table.replaceAll('"','""')+'"');
   if(r.rows[0].n)throw Error('TARGET_ALREADY_CONTAINS_USER_DATA_'+table);
  }
  await c.query('CREATE TABLE public.app_migrations (id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())');
  await c.query('COMMIT');
  console.log('SMALL2_APP_MIGRATIONS_TABLE_CREATED_FROM_V311_MIGRATOR_SCHEMA');
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e}
 finally{await c.end()}
})().catch(e=>{console.error('SMALL2_SCHEMA_RECONCILIATION_STOPPED '+e.message);process.exitCode=1});
