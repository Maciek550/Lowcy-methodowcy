'use strict';
const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const home=process.env.HOME;
const root=path.join(home,'lowcy-small2-20261023');
const dir=path.join(home,'.config/lowcy-small2');
const archive=path.join(home,'.private-lowcy-archives/Lowcy_V311_SMALL2_PELNA_KOPIA_20261105.zip');
const files={
  'runtime_config':path.join(dir,'runtime.json'),
  'x25519_private':path.join(dir,'backup_x25519_private.pem'),
  'private_recovery_zip':archive,
};
const checks={};
for(const [name,file] of Object.entries(files)){
 try{const st=fs.statSync(file);checks[name]={present:true,private:(st.mode&0o077)===0,bytes:st.size};}
 catch(e){checks[name]={present:false};}
}
const v=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
const js=fs.readFileSync(path.join(root,'app.js'),'utf8');
checks.versionConsistent=v.includes("const APP_VERSION = 'S1';")&&js.includes("const CLIENT_VERSION='S1';");
const local=path.join(home,'backups/local');
const localBackup={available:false,count:0,latest:null};
try{
 const st=fs.statSync(local);
 if(st.isDirectory()){
   const dates=fs.readdirSync(local).filter(s=>/^[0-9]{8}$/.test(s)).sort();
   localBackup.available=true;localBackup.count=dates.length;localBackup.latest=dates.at(-1)||null;
 }
}catch(_){}
let cron={accessible:false,totalLines:0,containsLocalBackupTask:false};
try{
 const out=cp.execFileSync('crontab',['-l'],{encoding:'utf8',timeout:6000,stdio:['ignore','pipe','pipe']});
 const lines=out.split('\n').filter(s=>s.trim()&&!s.trim().startsWith('#'));
 cron={accessible:true,totalLines:lines.length,containsLocalBackupTask:lines.some(s=>/lowcy.*(backup|pg_dump)|backup-db\.cjs|lowcy-db-backup/i.test(s))};
}catch(e){if(e.status===1)cron={accessible:true,totalLines:0,containsLocalBackupTask:false};}
console.log('SMALL2_SECURITY_BACKUP_READONLY_AUDIT '+JSON.stringify({files:checks,localBackup,cron}));
if(!checks.runtime_config.private||!checks.private_recovery_zip.private||!checks.versionConsistent)process.exitCode=2;
