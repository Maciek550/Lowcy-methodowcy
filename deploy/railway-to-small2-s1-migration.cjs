'use strict';
// RAILWAY migration bridge to SMALL2 S1. Does not touch Railway PostgreSQL.
// The bridge is reversible by restoring Railway's previous start command.
const http = require('node:http');
const TARGET = 'https://lowcymethodowcy.smallhost.pl/';
const WORKER = [
  "'use strict';",
  "const DEST=" + JSON.stringify(TARGET) + ";",
  "self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));",
  "self.addEventListener('activate',event=>event.waitUntil((async()=>{",
  "try{await self.clients.claim()}catch(e){}",
  "const tabs=await self.clients.matchAll({type:'window',includeUncontrolled:true});",
  "for(const tab of tabs){try{await tab.navigate(DEST)}catch(e){}}",
  "})()));",
  "self.addEventListener('fetch',event=>{",
  "if(event.request.mode==='navigate' && new URL(event.request.url).origin===self.location.origin)",
  "event.respondWith(Response.redirect(DEST,302));",
  "});",
  "self.addEventListener('notificationclick',event=>{",
  "event.notification.close();",
  "event.waitUntil(self.clients.openWindow(DEST));",
  "});"
].join('\n');
const HTML = '<!doctype html><html lang="pl"><head><meta charset="utf-8">'+
  '<meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<meta name="referrer" content="no-referrer">'+
  '<meta http-equiv="refresh" content="3;url='+TARGET+'">'+
  '<title>Łowcy Methodowcy — przejście na SMALL2</title></head>'+
  '<body style="font-family:system-ui;padding:2rem;background:#f0f5f3;color:#102a25">'+
  '<h1>Łowcy Methodowcy działają na SMALL2</h1>'+
  '<p>Trwa automatyczne przejście do wersji S1.</p>'+
  '<p><a href="'+TARGET+'">Otwórz Łowców S1</a></p>'+
  '<script>(function(){const target='+JSON.stringify(TARGET)+';'+
  'let finished=false;function go(){if(!finished){finished=true;location.replace(target)}}'+
  'const timer=setTimeout(go,2100);'+
  'if("serviceWorker" in navigator){navigator.serviceWorker.register("/sw.js?migrate=S1",{scope:"/",updateViaCache:"none"})'+
  '.then(r=>r.update()).then(()=>{clearTimeout(timer);setTimeout(go,30)}).catch(()=>{});}'+
  '})();</script></body></html>';
const headers={
  'Cache-Control':'no-store, no-cache, must-revalidate, max-age=0',
  'Referrer-Policy':'no-referrer',
  'X-Lowcy-Migration':'Railway-to-SMALL2-S1'
};
const server=http.createServer((req,res)=>{
  let pathname;
  try{pathname=new URL(req.url,'http://migration.local').pathname}catch(e){pathname='/'}
  if(pathname==='/health'){
    res.writeHead(200,{...headers,'Content-Type':'application/json; charset=utf-8'});
    return res.end(JSON.stringify({ok:true,migration:'SMALL2-S1',target:TARGET}));
  }
  if(pathname==='/sw.js' && (req.method==='GET'||req.method==='HEAD')){
    res.writeHead(200,{...headers,'Content-Type':'application/javascript; charset=utf-8','Service-Worker-Allowed':'/'});
    return res.end(req.method==='HEAD'?'':WORKER);
  }
  if((pathname==='/'||pathname==='/index.html') && (req.method==='GET'||req.method==='HEAD')){
    res.writeHead(200,{...headers,'Content-Type':'text/html; charset=utf-8'});
    return res.end(req.method==='HEAD'?'':HTML);
  }
  if(req.method==='GET'||req.method==='HEAD'){
    res.writeHead(302,{...headers,Location:TARGET,'Content-Type':'text/plain; charset=utf-8'});
    return res.end(req.method==='HEAD'?'':'Aplikacja przeniesiona na SMALL2.');
  }
  res.writeHead(410,{...headers,'Content-Type':'application/json; charset=utf-8'});
  return res.end(JSON.stringify({ok:false,error:'Aplikacja jest na SMALL2. Otwórz nowy adres.',target:TARGET}));
});
server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('RAILWAY_TO_SMALL2_S1_MIGRATION_BRIDGE_READY'));
