'use strict';
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.join(process.env.HOME,'lowcy-small2-20261023');
const stage=path.join(process.env.HOME,'lowcy-small2-stage-v311');
const config=JSON.parse(fs.readFileSync(path.join(process.env.HOME,'.config/lowcy-small2/runtime.json'),'utf8'));
const u=new URL(config.DATABASE_URL);
if(u.hostname!=='pgsql3.small.pl'||u.pathname!=='/p1828_lowcy_kop'||u.username!=='p1828_lowcy_kop')throw Error('INVALID_TARGET_DB');
const source=JSON.parse(fs.readFileSync(path.join(stage,'railway-source-20261105-v311.json'),'utf8'));
const filtered=path.join(stage,'railway-source-20261105-local-settings-preserved.json');
const archive=path.join(stage,'small2-before-railway-import-20261105.json');
if(!fs.existsSync(filtered)||!fs.existsSync(archive))throw Error('PREIMPORT_BACKUP_MISSING');
const prior=JSON.parse(fs.readFileSync(archive,'utf8'));
if(prior.database.counts.app_settings!==2||prior.database.counts.users!==0)throw Error('PRIOR_BACKUP_INVALID');
const pg=require(path.join(root,'node_modules','pg'));
(async()=>{
 const c=new pg.Client({connectionString:config.DATABASE_URL});await c.connect();
 try{
  await c.query('BEGIN READ ONLY');
  for(const table of Object.keys(source.data)){
    const n=(await c.query('SELECT count(*)::int n FROM public."'+table.replaceAll('"','""')+'"')).rows[0].n;
    if(n!==(table==='app_settings'?2:0))throw Error('RESTORE_RETRY_BLOCKED_TARGET_NOT_EMPTY_'+table);
  }
  await c.query('ROLLBACK');
 }finally{await c.end()}
 const out=cp.spawnSync(process.execPath,['restore-db.cjs',filtered],{
   cwd:root,env:{...process.env,DATABASE_URL:config.DATABASE_URL},encoding:'utf8',timeout:120000,maxBuffer:5000000
 });
 if(out.status!==0){
   const s=(out.stderr||'').split('\n');
   const headline=s.find(x=>x.startsWith('LOWCY_RESTORE_FAILED'))||'UNKNOWN_RESTORE_FAILURE';
   const code=s.find(x=>/^\s*code: /.test(x))||'code: unreported';
   // The database error is summarized without printing row values, credentials or source records.
   console.error('SMALL2_RESTORE_DIAG '+headline.slice(0,200).replace(/postgres(ql)?:\/\/[^\s]+/g,'[DB_URL]'));
   console.error('SMALL2_RESTORE_SQLSTATE '+code.trim().slice(0,60));
   process.exitCode=1;return;
 }
 console.log('SMALL2_RESTORE_SUCCEEDED_ON_SAFE_RETRY');
})().catch(e=>{console.error('SMALL2_RESTORE_RETRY_STOPPED '+e.message);process.exitCode=1});
