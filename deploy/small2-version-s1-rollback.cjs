'use strict';
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const home=process.env.HOME,root=path.join(home,'lowcy-small2-20261023'),stage=path.join(home,'lowcy-small2-stage-v311');
const pairs=[['server.cjs','S1_before_server_20261105.cjs'],['app.js','S1_before_app_20261105.js']];
const backups=pairs.map(([name,old])=>({name,current:path.join(root,name),backup:path.join(stage,old)}));
if(!backups.every(x=>fs.existsSync(x.backup))){
 console.log('SMALL2_S1_ROLLBACK_NOT_NEEDED_NO_COMPLETE_BACKUPS');
 process.exit(0);
}
const states=[];
for(const p of backups){
 const bytes=fs.readFileSync(p.backup);
 const base=cp.execFileSync('git',['-C',root,'show','HEAD:'+p.name],{maxBuffer:5000000});
 if(!bytes.equals(base))throw Error('ROLLBACK_BACKUP_NOT_MATCHING_ORIGINAL_'+p.name);
 const content=fs.readFileSync(p.current,'utf8');
 const isS1=p.name==='server.cjs'?content.includes("const APP_VERSION = 'S1';"):content.includes("const CLIENT_VERSION='S1';");
 const isOriginal=p.name==='server.cjs'?content.includes("const APP_VERSION = '311';"):content.includes("const CLIENT_VERSION='311';");
 if(!isS1&&!isOriginal)throw Error('ROLLBACK_UNEXPECTED_THIRD_PARTY_EDIT_'+p.name);
 states.push(isS1);
}
if(!states.some(Boolean)){console.log('SMALL2_S1_ALREADY_ORIGINAL_NO_ROLLBACK');process.exit(0)}
for(const p of backups){
 const tmp=p.current+'.S1-rollback';
 if(fs.existsSync(tmp))throw Error('ROLLBACK_TEMP_ALREADY_EXISTS');
 fs.copyFileSync(p.backup,tmp,fs.constants.COPYFILE_EXCL);
 fs.renameSync(tmp,p.current);
}
console.log('SMALL2_S1_ROLLBACK_RESTORED_ORIGINAL_V311_CODE');
