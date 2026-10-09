const fs=require('fs');
const path=require('path');
const {buildSnapshot}=require('./backup-lib.cjs');

(async()=>{
  const outArg=process.argv[2]||process.env.BACKUP_FILE||`lowcy-db-${new Date().toISOString().replace(/[:.]/g,'-')}.json`;
  const out=path.resolve(outArg);
  const snapshot=await buildSnapshot(process.env.DATABASE_URL,{
    appVersion:process.env.APP_VERSION||process.env.RAILWAY_GIT_COMMIT_SHA||null,
    gitCommit:process.env.RAILWAY_GIT_COMMIT_SHA||null,
    note:process.env.BACKUP_NOTE||''
  });
  fs.mkdirSync(path.dirname(out),{recursive:true});
  fs.writeFileSync(out,JSON.stringify(snapshot,null,2));
  console.log('LOWCY_BACKUP_OK '+JSON.stringify({file:out,created_at:snapshot.created_at,tables:snapshot.database.tables,counts:snapshot.database.counts}));
})().catch(e=>{console.error('LOWCY_BACKUP_FAILED',e&&e.stack?e.stack:e);process.exitCode=1});
