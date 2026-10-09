const http=require('http');
const fs=require('fs');
const path=require('path');
const os=require('os');
const crypto=require('crypto');
const {spawn}=require('child_process');
const {buildSnapshot}=require('./backup-lib.cjs');

const PORT=Number(process.env.PORT||3000);
const TOKEN=String(process.env.BACKUP_TOKEN||'');
let busy=false;
function auth(req){const h=String(req.headers.authorization||'');return TOKEN&&h===`Bearer ${TOKEN}`;}
function run(cmd,args,cwd){return new Promise((resolve,reject)=>{const p=spawn(cmd,args,{cwd,stdio:['ignore','ignore','pipe']});let err='';p.stderr.on('data',d=>err+=d);p.on('error',reject);p.on('close',code=>code===0?resolve():reject(new Error(`${cmd} exit ${code}: ${err}`)));});}

http.createServer(async(req,res)=>{
  if(req.url==='/health'){res.writeHead(200,{'content-type':'application/json'});return res.end(JSON.stringify({ok:true}));}
  if(req.url!=='/backup'){res.writeHead(404);return res.end('not found');}
  if(!auth(req)){res.writeHead(401);return res.end('unauthorized');}
  if(busy){res.writeHead(409);return res.end('busy');}
  busy=true;
  const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'lowcy-backup-'));
  try{
    const snapshot=await buildSnapshot(process.env.DATABASE_URL,{gitCommit:process.env.RAILWAY_GIT_COMMIT_SHA||null,note:'Pełna paczka przenośna'});
    const dbDir=path.join(tmp,'database');fs.mkdirSync(dbDir,{recursive:true});
    fs.writeFileSync(path.join(dbDir,'lowcy-db-backup.json'),JSON.stringify(snapshot,null,2));
    fs.copyFileSync(path.join(__dirname,'restore-db.cjs'),path.join(dbDir,'restore-db.cjs'));
    fs.copyFileSync(path.join(__dirname,'backup-db.cjs'),path.join(dbDir,'backup-db.cjs'));
    fs.copyFileSync(path.join(__dirname,'backup-lib.cjs'),path.join(dbDir,'backup-lib.cjs'));
    fs.writeFileSync(path.join(tmp,'BACKUP_INFO.txt'),[
      'ŁOWCY METHODOWCY - PEŁNA PACZKA BACKUP',
      'Data: '+snapshot.created_at,
      'Commit: '+(snapshot.git_commit||'brak'),
      'Format bazy: '+snapshot.format,
      'Sekrety środowiskowe (DATABASE_URL, JWT_SECRET, klucze API) NIE są dołączane.',
      'Przy odtwarzaniu: uruchom kod aplikacji raz, aby utworzyć schemat, a następnie node database/restore-db.cjs database/lowcy-db-backup.json',
      ''
    ].join('\n'));
    const appTar=path.join(tmp,'application.tar.gz');
    await run('tar',['-czf',appTar,'--exclude=node_modules','--exclude=.git','--exclude=*.tar.gz','--exclude=*.zip','.'],__dirname);
    const packageTar=path.join(tmp,'lowcy-full-backup.tar.gz');
    await run('tar',['-czf',packageTar,'application.tar.gz','database','BACKUP_INFO.txt'],tmp);
    const st=fs.statSync(packageTar);
    res.writeHead(200,{'content-type':'application/gzip','content-length':st.size,'content-disposition':'attachment; filename="lowcy-full-backup.tar.gz"','cache-control':'no-store'});
    fs.createReadStream(packageTar).pipe(res).on('close',()=>{try{fs.rmSync(tmp,{recursive:true,force:true})}catch(_){}busy=false;});
  }catch(e){try{fs.rmSync(tmp,{recursive:true,force:true})}catch(_){}busy=false;res.writeHead(500,{'content-type':'text/plain; charset=utf-8'});res.end(String(e&&e.stack?e.stack:e));}
}).listen(PORT,()=>console.log('LOWCY_BACKUP_PACKAGE_SERVER_READY port='+PORT));
