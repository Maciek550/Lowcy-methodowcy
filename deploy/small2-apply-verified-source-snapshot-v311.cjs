'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const home=process.env.HOME;
const root=path.join(home,'lowcy-small2-20261023');
const stage=path.join(home,'lowcy-small2-stage-v311');
const runtimePath=path.join(home,'.config/lowcy-small2/runtime.json');
const originalPath=path.join(stage,'railway-source-20261105-v311.json');
const targetBefore=path.join(stage,'small2-before-railway-import-20261105.json');
const restoreFile=path.join(stage,'railway-source-20261105-local-settings-preserved.json');
const config=JSON.parse(fs.readFileSync(runtimePath,'utf8'));
const uri=new URL(config.DATABASE_URL);
if(uri.hostname!=='pgsql3.small.pl'||uri.pathname!=='/p1828_lowcy_kop'||uri.username!=='p1828_lowcy_kop'||!uri.password)throw Error('TARGET_DATABASE_MISMATCH');
if(!fs.existsSync(path.join(root,'.small2-start-approved')))throw Error('START_GUARD_MISSING');
if(fs.existsSync(targetBefore)||fs.existsSync(restoreFile))throw Error('ALREADY_PREPARED_STOP');
const gitsha=cp.execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(gitsha!=='e5b35f311d8c0d98cd8498044e5d538bf9c2b2f2')throw Error('SOURCE_COMMIT_MISMATCH');
const source=JSON.parse(fs.readFileSync(originalPath,'utf8'));
if(source.format!=='LOWCY_METHODOWCY_DB_BACKUP_V1'||source.database?.tables!==19||!source.created_at.startsWith('2026-11-05T07:21:30.'))throw Error('SOURCE_SNAPSHOT_INVALID');
const expected={users:73,competitions:7,entries:157,draws:285,results:285,result_items:278,historical_import_audit:9,app_migrations:6,app_settings:0,push_subscriptions:1};
for(const [name,n] of Object.entries(expected)){
 if(source.data?.[name]?.length!==n||source.database.counts[name]!==n)throw Error('SOURCE_COUNT_MISMATCH_'+name);
}
const {Client}=require(path.join(root,'node_modules','pg'));
const env={...process.env,DATABASE_URL:config.DATABASE_URL,APP_VERSION:'V311',BACKUP_NOTE:'SMALL2 before importing Railway read-only snapshot'};
const qi=n=>'"'+String(n).replaceAll('"','""')+'"';
async function inspect(){
 const db=new Client({connectionString:config.DATABASE_URL,ssl:false});
 await db.connect();
 try{
  await db.query('BEGIN READ ONLY');
  if((await db.query('select current_database() as db')).rows[0]?.db!=='p1828_lowcy_kop')throw Error('WRONG_CONNECTED_DB');
  const tables=(await db.query("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")).rows.map(x=>x.table_name).sort();
  const names=Object.keys(source.data).sort();
  if(JSON.stringify(tables)!==JSON.stringify(names))throw Error('TABLE_SET_MISMATCH');
  const cols=(await db.query("select table_name,column_name,udt_name from information_schema.columns where table_schema='public'")).rows;
  for(const [table,sourceCols] of Object.entries(source.columns)){
    for(const x of sourceCols){
      if(!cols.some(c=>c.table_name===table&&c.column_name===x.name&&c.udt_name===x.udt_name))throw Error('SCHEMA_MISMATCH_'+table+'.'+x.name);
    }
  }
  for(const table of tables){
    const count=(await db.query('select count(*)::integer as n from public.'+qi(table))).rows[0].n;
    if(table==='app_settings'){if(count!==2)throw Error('SETTINGS_COUNT_UNEXPECTED')}
    else if(count!==0)throw Error('NONEMPTY_TARGET_'+table);
  }
  const settings=(await db.query('select key,value from app_settings order by key')).rows;
  if(settings.length!==2||settings.map(x=>x.key).join(',')!=='vapid_private_key,vapid_public_key')throw Error('UNEXPECTED_TARGET_SETTINGS');
  await db.query('ROLLBACK');
  return settings;
 }finally{await db.end()}
}
(async()=>{
 const originalSettings=await inspect();
 console.log('SMALL2_PREIMPORT_SCHEMAS_MATCH_19_TABLES');
 const backup=cp.spawnSync(process.execPath,['backup-db.cjs',targetBefore],{cwd:root,env,encoding:'utf8',timeout:60000,maxBuffer:5*1024*1024});
 if(backup.status!==0||!fs.existsSync(targetBefore))throw Error('BEFORE_RESTORE_SNAPSHOT_FAILED');
 fs.chmodSync(targetBefore,0o600);
 const safety=JSON.parse(fs.readFileSync(targetBefore,'utf8'));
 if(safety.database.tables!==19||safety.database.counts.app_settings!==2||safety.database.counts.users!==0)throw Error('TARGET_BACKUP_VERIFICATION_FAILED');
 console.log('SMALL2_PREIMPORT_BACKUP_READY tables=19');
 // The Railway origin contains no app settings. Retain the new domain's unique
 // VAPID key pair instead of replacing or deleting it.
 const adjusted=JSON.parse(JSON.stringify(source));
 delete adjusted.data.app_settings;
 delete adjusted.columns.app_settings;
 delete adjusted.database.counts.app_settings;
 adjusted.database.tables=18;
 adjusted.restore_order=(adjusted.restore_order||[]).filter(x=>x!=='app_settings');
 adjusted.sequences=(adjusted.sequences||[]).filter(x=>x.table_name!=='app_settings');
 fs.writeFileSync(restoreFile,JSON.stringify(adjusted),{flag:'wx',mode:0o600});
 console.log('SMALL2_IMPORT_READY_SOURCE_18_TABLES_LOCAL_VAPID_PRESERVED');
 const restore=cp.spawnSync(process.execPath,['restore-db.cjs',restoreFile],{cwd:root,env,encoding:'utf8',timeout:120000,maxBuffer:5*1024*1024});
 if(restore.status!==0||!restore.stdout.includes('LOWCY_RESTORE_OK'))throw Error('RESTORE_TRANSACTION_FAILED_'+String(restore.status));
 console.log('SMALL2_IMPORT_TRANSACTION_COMMITTED');
 const db=new Client({connectionString:config.DATABASE_URL,ssl:false});await db.connect();
 try{
  await db.query('BEGIN READ ONLY');
  const verified={};
  for(const [table,rows] of Object.entries(source.data)){
    const count=(await db.query('select count(*)::integer as n from public.'+qi(table))).rows[0].n;
    verified[table]=count;
    if(table!=='app_settings'&&count!==rows.length)throw Error('POST_RESTORE_COUNT_MISMATCH_'+table);
  }
  const settings=(await db.query('select key,value from app_settings order by key')).rows;
  if(JSON.stringify(settings)!==JSON.stringify(originalSettings))throw Error('LOCAL_VAPID_KEYS_CHANGED');
  await db.query('ROLLBACK');
  console.log('SMALL2_V311_DATA_IMPORTED_AND_VERIFIED '+JSON.stringify({created_at:source.created_at,tables:source.database.tables,counts:verified}));
 }finally{await db.end()}
})().catch(e=>{console.error('SMALL2_IMPORT_FAILED '+e.message);process.exitCode=1});
