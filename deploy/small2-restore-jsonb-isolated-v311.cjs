'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.join(process.env.HOME,'lowcy-small2-20261023');
const stage=path.join(process.env.HOME,'lowcy-small2-stage-v311');
const config=JSON.parse(fs.readFileSync(path.join(process.env.HOME,'.config/lowcy-small2/runtime.json'),'utf8'));
const url=new URL(config.DATABASE_URL);
if(url.hostname!=='pgsql3.small.pl'||url.pathname!=='/p1828_lowcy_kop'||url.username!=='p1828_lowcy_kop')throw Error('TARGET_DATABASE_INVALID');
const original=JSON.parse(fs.readFileSync(path.join(stage,'railway-source-20261105-v311.json'),'utf8'));
const before=JSON.parse(fs.readFileSync(path.join(stage,'small2-before-railway-import-20261105.json'),'utf8'));
const input=path.join(stage,'railway-source-20261105-local-settings-preserved.json');
if(original.database.tables!==19||original.data.users.length!==73||before.database.counts.app_settings!==2||before.database.counts.users!==0)throw Error('SNAPSHOT_VERIFICATION_FAILED');
const targetSnapshot=JSON.parse(fs.readFileSync(input,'utf8'));
if(targetSnapshot.database.tables!==18||Object.keys(targetSnapshot.data).includes('app_settings')||targetSnapshot.data.users.length!==73)throw Error('INPUT_NOT_ISOLATED');
const originalRestore=fs.readFileSync(path.join(root,'restore-db.cjs'),'utf8');
const needle="for(const col of useCols){vals.push(decode(row[col]));marks.push('$'+vals.length);}";
if(originalRestore.split(needle).length!==2)throw Error('UPSTREAM_RESTORE_SOURCE_MISMATCH');
const fix="for(const col of useCols){const kind=(snapshot.columns?.[table]||[]).find(x=>x.name===col)?.udt_name;const decoded=decode(row[col]);vals.push((kind==='json'||kind==='jsonb')&&decoded!==null?JSON.stringify(decoded):decoded);marks.push('$'+vals.length);}";
const patched=originalRestore.replace(needle,fix);
const isolated=path.join(stage,'restore-db-jsonb-fixed-20261105.cjs');
if(!fs.existsSync(isolated))fs.writeFileSync(isolated,patched,{mode:0o600,flag:'wx'});
else if(fs.readFileSync(isolated,'utf8')!==patched)throw Error('ISOLATED_RESTORE_SCRIPT_CHANGED');
const {Client}=require(path.join(root,'node_modules','pg'));
(async()=>{
 const c=new Client({connectionString:config.DATABASE_URL});await c.connect();
 let settings;
 try{
  await c.query('BEGIN READ ONLY');
  if((await c.query('select current_database() db')).rows[0].db!=='p1828_lowcy_kop')throw Error('WRONG_DB');
  for(const [table,rows] of Object.entries(original.data)){
   const count=(await c.query('select count(*)::int n from public."'+table.replaceAll('"','""')+'"')).rows[0].n;
   if(count!==(table==='app_settings'?2:0))throw Error('TARGET_NOT_BLANK_'+table);
  }
  settings=(await c.query('select key,value from app_settings order by key')).rows;
  if(settings.map(x=>x.key).join(',')!=='vapid_private_key,vapid_public_key')throw Error('LOCAL_SETTINGS_UNEXPECTED');
  await c.query('ROLLBACK');
 }finally{await c.end()}
 console.log('SMALL2_JSONB_IMPORT_EMPTY_TARGET_VALIDATED');
 const r=cp.spawnSync(process.execPath,[isolated,input],{
   cwd:root,env:{...process.env,DATABASE_URL:config.DATABASE_URL,NODE_PATH:path.join(root,'node_modules')},encoding:'utf8',timeout:120000,maxBuffer:5000000
 });
 if(r.status!==0){
   const errs=(r.stderr||'').split('\n');
   const headline=errs.find(x=>x.startsWith('LOWCY_RESTORE_FAILED'))||'UNKNOWN';
   const code=errs.find(x=>/^\s*code: /.test(x))||'code: unreported';
   console.error('SMALL2_JSONB_RESTORE_STOPPED '+headline.slice(0,220));
   console.error('SMALL2_SQLSTATE '+code.trim().slice(0,60));
   const category=(r.stderr||'').split('\n').slice(0,5).map(x=>x.replaceAll(config.DATABASE_URL,'[DATABASE_URL_REDACTED]').slice(0,160));
   console.error('SMALL2_RESTORE_RUNTIME_ERROR_HEAD '+JSON.stringify(category));
   process.exitCode=1;return;
 }
 if(!r.stdout.includes('LOWCY_RESTORE_OK'))throw Error('MISSING_TRANSACTION_COMMIT_CONFIRMATION');
 console.log('SMALL2_JSONB_RESTORE_TRANSACTION_COMMITTED');
 const verify=new Client({connectionString:config.DATABASE_URL});await verify.connect();
 try{
   await verify.query('BEGIN READ ONLY');
   const counts={};
   for(const [table,rows] of Object.entries(original.data)){
     const n=(await verify.query('select count(*)::int n from public."'+table.replaceAll('"','""')+'"')).rows[0].n;
     counts[table]=n;
     if(table!=='app_settings'&&n!==rows.length)throw Error('POST_RESTORE_MISMATCH_'+table);
   }
   const afterSettings=(await verify.query('select key,value from app_settings order by key')).rows;
   if(JSON.stringify(afterSettings)!==JSON.stringify(settings))throw Error('SMALL2_ORIGIN_VAPID_SETTINGS_CHANGED');
   await verify.query('ROLLBACK');
   console.log('SMALL2_V311_ALL_TABLES_VERIFIED '+JSON.stringify({sourceCreatedAt:original.created_at,counts}));
 }finally{await verify.end()}
})().catch(e=>{console.error('SMALL2_JSONB_IMPORT_FAILED '+e.message);process.exitCode=1});
