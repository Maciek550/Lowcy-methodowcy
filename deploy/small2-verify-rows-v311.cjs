'use strict';
const fs=require('node:fs'),path=require('node:path');
const root=path.join(process.env.HOME,'lowcy-small2-20261023');
const stage=path.join(process.env.HOME,'lowcy-small2-stage-v311');
const cfg=JSON.parse(fs.readFileSync(path.join(process.env.HOME,'.config/lowcy-small2/runtime.json'),'utf8'));
const u=new URL(cfg.DATABASE_URL);
if(u.hostname!=='pgsql3.small.pl'||u.pathname!=='/p1828_lowcy_kop'||u.username!=='p1828_lowcy_kop')throw Error('NOT_SMALL2_DB');
const source=JSON.parse(fs.readFileSync(path.join(stage,'railway-source-20261105-v311.json'),'utf8'));
const before=JSON.parse(fs.readFileSync(path.join(stage,'small2-before-railway-import-20261105.json'),'utf8'));
const {buildSnapshot}=require(path.join(root,'backup-lib.cjs'));
function canonical(v){
 if(v===null||typeof v!=='object')return v;
 if(Array.isArray(v))return v.map(canonical);
 if(v instanceof Date)return v.toISOString();
 const out={};for(const k of Object.keys(v).sort())out[k]=canonical(v[k]);return out;
}
function sortedRows(rows){return rows.map(r=>JSON.stringify(canonical(r))).sort();}
(async()=>{
 const actual=JSON.parse(JSON.stringify(await buildSnapshot(cfg.DATABASE_URL,{appVersion:'V311-SMALL2-CONTENT-CHECK'})));
 const missing=[],contentMismatch=[];
 for(const [table,rows] of Object.entries(source.data)){
   if(table==='app_settings')continue;
   if(!Array.isArray(actual.data?.[table])){missing.push(table);continue}
   const cleanDate=(r)=>{const copy={...r};delete copy.competition_date;return copy};
   const a=sortedRows(table==='competitions'?rows.map(cleanDate):rows);
   const b=sortedRows(table==='competitions'?actual.data[table].map(cleanDate):actual.data[table]);
   if(a.length!==b.length||a.some((x,i)=>x!==b[i]))contentMismatch.push(table);
 }
 const pg=require(path.join(root,'node_modules','pg'));
 const db=new pg.Client({connectionString:cfg.DATABASE_URL});
 await db.connect();
 try{
   await db.query('BEGIN READ ONLY');
   const dbDates=(await db.query('SELECT id,competition_date::text AS calendar_date FROM competitions')).rows;
   const sourceDates=new Map(source.data.competitions.map(r=>[String(r.id),r.competition_date===null?null:String(r.competition_date).slice(0,10)]));
   const wrongDates=dbDates.filter(r=>sourceDates.get(String(r.id))!==r.calendar_date);
   if(dbDates.length!==sourceDates.size||wrongDates.length)throw Error('COMPETITION_CALENDAR_DATES_MISMATCH count='+wrongDates.length);
   await db.query('ROLLBACK');
   console.log('SMALL2_ALL_COMPETITION_DATES_MATCH_AS_POSTGRESQL_DATE');
 }finally{await db.end()}
 const localSettings=sortedRows(actual.data.app_settings||[]);
 const savedSettings=sortedRows(before.data.app_settings||[]);
 if(localSettings.length!==2||JSON.stringify(localSettings)!==JSON.stringify(savedSettings))throw Error('LOCAL_VAPID_SETTINGS_NOT_PRESERVED');
 if(contentMismatch.includes('competitions')){
   const destById=new Map((actual.data.competitions||[]).map(r=>[String(r.id),r]));
   const diffs=[];
   for(const row of source.data.competitions){
     const d=destById.get(String(row.id));
     if(!d){diffs.push({id:row.id,missing:true});continue}
     const changed=Object.keys(row).filter(k=>JSON.stringify(canonical(row[k]))!==JSON.stringify(canonical(d[k]))).map(k=>({field:k,kind:source.columns.competitions.find(c=>c.name===k)?.udt_name||'unknown'}));
     if(changed.length)diffs.push({id:row.id,changed});
   }
   console.log('SMALL2_COMPETITION_DIFFERING_COLUMNS '+JSON.stringify(diffs));
 }
 console.log('SMALL2_FULL_CONTENT_COMPARISON '+JSON.stringify({sourceTables:Object.keys(source.data).length,checkedTables:Object.keys(source.data).length-1,missing,contentMismatch,localVapidPreserved:true}));
 if(missing.length||contentMismatch.length)process.exitCode=1;
 else console.log('SMALL2_ALL_18_IMPORTED_TABLES_BYTE_LOGICALLY_EQUAL_TO_RAILWAY_SNAPSHOT');
})().catch(e=>{console.error('SMALL2_CONTENT_CHECK_FAILED '+e.message);process.exitCode=1});
