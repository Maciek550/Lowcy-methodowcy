'use strict';
const fs=require('node:fs'), path=require('node:path');
const root=path.join(process.env.HOME,'lowcy-small2-20261023');
const file=path.join(process.env.HOME,'lowcy-small2-stage-v311','railway-source-20261105-v311.json');
const cfg=JSON.parse(fs.readFileSync(path.join(process.env.HOME,'.config/lowcy-small2/runtime.json'),'utf8'));
const url=new URL(cfg.DATABASE_URL);
if(url.hostname!=='pgsql3.small.pl'||url.pathname!=='/p1828_lowcy_kop'||url.username!=='p1828_lowcy_kop')throw Error('INVALID_TARGET');
const backup=JSON.parse(fs.readFileSync(file,'utf8'));
if(backup.format!=='LOWCY_METHODOWCY_DB_BACKUP_V1'||backup.database?.tables!==19)throw Error('INVALID_BACKUP');
const {Client}=require(path.join(root,'node_modules','pg'));
(async()=>{
 const client=new Client({connectionString:cfg.DATABASE_URL,ssl:false});
 await client.connect();
 try {
   await client.query('BEGIN READ ONLY');
   const identity=await client.query('SELECT current_database() db');
   if(identity.rows[0].db!=='p1828_lowcy_kop')throw Error('WRONG_DATABASE');
   const tables=(await client.query("SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE'")).rows.map(r=>r.table_name);
   const sourceTables=Object.keys(backup.data);
   const missingTables=sourceTables.filter(t=>!tables.includes(t));
   const extraTables=tables.filter(t=>!sourceTables.includes(t));
   const targetCols=(await client.query("SELECT table_name,column_name,udt_name FROM information_schema.columns WHERE table_schema='public'")).rows;
   const missingColumns=[];
   const differentColumnTypes=[];
   for(const [table,cols] of Object.entries(backup.columns)){
     if(!tables.includes(table))continue;
     for(const c of cols){
       const target=targetCols.find(x=>x.table_name===table&&x.column_name===c.name);
       if(!target)missingColumns.push(table+'.'+c.name);
       else if(target.udt_name!==c.udt_name)differentColumnTypes.push(table+'.'+c.name+' '+c.udt_name+'!='+target.udt_name);
     }
   }
   const nonempty=[];
   for(const table of tables){
     const name='"'+table.replaceAll('"','""')+'"';
     const count=(await client.query('SELECT count(*)::integer as n FROM public.'+name)).rows[0].n;
     if(count!==0)nonempty.push(table+'='+count);
   }
   console.log('SMALL2_SCHEMA_DIFF '+JSON.stringify({sourceTables:sourceTables.length,targetTables:tables.length,missingTables,extraTables,missingColumns,differentColumnTypes,nonempty}));
   await client.query('ROLLBACK');
   if(nonempty.length)throw Error('STOP_NONEMPTY_TARGET');
 } finally {await client.end()}
})().catch(e=>{console.error('SCHEMA_CHECK_FAILED '+e.message);process.exitCode=1});
