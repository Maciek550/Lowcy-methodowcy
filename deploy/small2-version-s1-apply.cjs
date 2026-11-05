'use strict';
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const crypto=require('node:crypto');
const home=process.env.HOME,root=path.join(home,'lowcy-small2-20261023');
const stage=path.join(home,'lowcy-small2-stage-v311');
const files={server:path.join(root,'server.cjs'),client:path.join(root,'app.js')};
const backups={server:path.join(stage,'S1_before_server_20261105.cjs'),client:path.join(stage,'S1_before_app_20261105.js')};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const tag=String.fromCharCode(36)+'{APP_VERSION}';
function exactReplace(text,from,to,count,label){
 const matches=text.split(from).length-1;
 if(matches!==count)throw Error('S1_PATCH_PATTERN_COUNT_'+label+'_EXPECTED_'+count+'_GOT_'+matches);
 return text.split(from).join(to);
}
function runCheck(file){
 const r=cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8',timeout:25000});
 if(r.status!==0)throw Error('S1_JS_SYNTAX_CHECK_FAILED_'+path.basename(file));
}
const git=cp.execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
if(git!=='e5b35f311d8c0d98cd8498044e5d538bf9c2b2f2')throw Error('UNEXPECTED_BASE_COMMIT');
const diff=cp.execFileSync('git',['-C',root,'status','--porcelain','--','server.cjs','app.js'],{encoding:'utf8'}).trim();
if(diff)throw Error('UNEXPECTED_EXISTING_MODIFICATIONS_IN_VERSION_FILES');
const cfg=JSON.parse(fs.readFileSync(path.join(home,'.config/lowcy-small2/runtime.json'),'utf8'));
const url=new URL(cfg.DATABASE_URL);
if(url.hostname!=='pgsql3.small.pl'||url.pathname!=='/p1828_lowcy_kop')throw Error('NOT_TARGET_SMALL2_DATABASE');
if(!fs.existsSync(path.join(root,'.small2-start-approved')))throw Error('SMALL2_START_GUARD_MISSING');
const oldServer=fs.readFileSync(files.server,'utf8'),oldClient=fs.readFileSync(files.client,'utf8');
let server=exactReplace(oldServer,"const APP_VERSION = '311';","const APP_VERSION = 'S1';",1,'server_version');
server=exactReplace(server,"const APP_VERSION_NAME = 'V311_GOLEBIOWKA_JULY_BANKS';","const APP_VERSION_NAME = 'S1';",1,'server_version_name');
server=exactReplace(server,'V'+tag,tag,3,'html_title_header_badge');
let client=exactReplace(oldClient,"const CLIENT_VERSION='311';","const CLIENT_VERSION='S1';",1,'client_version');
client=exactReplace(client,"const CLIENT_VERSION_NAME='V311_GOLEBIOWKA_JULY_BANKS';","const CLIENT_VERSION_NAME='S1';",1,'client_version_name');
client=exactReplace(client,"document.title='Łowcy Methodowcy — V'+CLIENT_VERSION","document.title='Łowcy Methodowcy — '+CLIENT_VERSION",1,'client_document_title');
if(!server.includes('<title>Łowcy Methodowcy — '+tag+'</title>')||!server.includes('class="headerVersion">'+tag+'</span>')||!server.includes('class="appVersionBadge">'+tag+'</span>'))throw Error('VISIBLE_VERSION_MARKERS_MISSING');
if(server.includes('V'+tag)||client.includes("V'+CLIENT_VERSION"))throw Error('PREFIX_LEFT_IN_VISIBLE_VERSION');
const modified=[{file:files.server,backup:backups.server,original:oldServer,next:server,temp:path.join(root,'.S1-server-verification.cjs')},{file:files.client,backup:backups.client,original:oldClient,next:client,temp:path.join(root,'.S1-client-verification.js')}];
for(const m of modified){
 if(fs.existsSync(m.backup)||fs.existsSync(m.temp))throw Error('S1_BACKUP_OR_TEMP_ALREADY_EXISTS');
 fs.writeFileSync(m.temp,m.next,{flag:'wx',mode:0o644});
 runCheck(m.temp);
}
for(const m of modified){
 fs.copyFileSync(m.file,m.backup,fs.constants.COPYFILE_EXCL);
 fs.chmodSync(m.backup,0o600);
 if(hash(fs.readFileSync(m.backup))!==hash(Buffer.from(m.original)))throw Error('S1_BACKUP_BYTES_CHANGED');
}
for(const m of modified)fs.renameSync(m.temp,m.file);
for(const m of modified){
 if(hash(fs.readFileSync(m.file))!==hash(Buffer.from(m.next)))throw Error('S1_WRITTEN_CODE_MISMATCH');
}
console.log('SMALL2_S1_VERSION_CODE_INSTALLED exactChanges=6 title=S1 header=S1 badge=S1 server=S1 client=S1');
console.log('SMALL2_S1_BACKUPS_SAVED_WITH_SHA256_CHECK');
