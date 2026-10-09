const fs=require('fs');
const path=require('path');
const zlib=require('zlib');
const {buildSnapshot}=require('./backup-lib.cjs');

(async()=>{
  const dir=path.resolve(process.env.BACKUP_DIR||'/backups');
  const keep=Math.max(3,Math.min(90,Number(process.env.BACKUP_KEEP_DAYS||30)));
  fs.mkdirSync(dir,{recursive:true});
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');
  const file=path.join(dir,`lowcy-db-${stamp}.json.gz`);
  const snapshot=await buildSnapshot(process.env.DATABASE_URL,{
    appVersion:process.env.RAILWAY_GIT_COMMIT_SHA||null,
    gitCommit:process.env.RAILWAY_GIT_COMMIT_SHA||null,
    note:'Automatyczna kopia serwerowa'
  });
  fs.writeFileSync(file,zlib.gzipSync(Buffer.from(JSON.stringify(snapshot))));
  fs.writeFileSync(path.join(dir,'LATEST.txt'),path.basename(file)+'\n'+snapshot.created_at+'\n');
  const files=fs.readdirSync(dir).filter(x=>/^lowcy-db-.*\.json\.gz$/.test(x)).sort().reverse();
  for(const old of files.slice(keep))fs.rmSync(path.join(dir,old),{force:true});
  console.log('LOWCY_DAILY_BACKUP_OK '+JSON.stringify({file:path.basename(file),keep,created_at:snapshot.created_at,counts:snapshot.database.counts}));
})().catch(e=>{console.error('LOWCY_DAILY_BACKUP_FAILED',e&&e.stack?e.stack:e);process.exitCode=1});
