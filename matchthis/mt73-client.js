// MT73: one authoritative server snapshot; browser storage is only an unsent recovery queue.
let mt73Ready=false,mt73Busy=false,mt73Queued=false,mt73Base=null,mt73Csrf='',mt73Revision=0,mt73Failed=false;
const mt73Outbox='matchthis-server-pending-v1';
const mt73Clone=x=>JSON.parse(JSON.stringify(x));
function mt73Status(text,bad=false){const el=document.getElementById('mt73-sync');el.textContent=text;el.dataset.error=String(bad);el.style.color=bad?'#b32020':'#17643e';}
function mt73Freeze(text){mt73Status(text,true);document.getElementById('contentShell').inert=true;document.getElementById('mt73-retry').hidden=false;}
async function mt73Api(body){
 const r=await fetch('/mt73-state.php',{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json','X-MT-CSRF':mt73Csrf}:{'Accept':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(30000)});
 const j=await r.json();if(!r.ok){const e=new Error(j.error||'Brak odpowiedzi serwera');e.status=r.status;throw e;}return j;
}
function mt73QueueLocal(){try{localStorage.setItem(mt73Outbox,JSON.stringify({base:mt73Base,data:db,revision:mt73Revision}));}catch(_){/* server attempt proceeds even when browser storage is unavailable */}}
function save(){
 if(!mt73Ready||roleMode==='viewer')return true;
 mt73Queued=true;mt73QueueLocal();mt73Status('Zapisywanie na serwerze…');
 if(!mt73Busy)queueMicrotask(mt73Flush);return true;
}
async function mt73Flush(){
 if(mt73Busy||!mt73Queued)return;mt73Busy=true;
 try{
  while(mt73Queued){
   mt73Queued=false;const sent=mt73Clone(db),base=mt73Clone(mt73Base);
   const j=await mt73Api({op:'save',base,data:sent,revision:mt73Revision});
   // Apply concurrent remote fields when no newer local edit occurred during the request.
   mt73Base=j.state.data;mt73Revision=j.state.revision;
   if(JSON.stringify(db)===JSON.stringify(sent)){db=mt73Clone(mt73Base);mt73Queued=false;}
   else{
    // Keep the original submitted snapshot as base for the following local delta.
    mt73Base=sent;mt73Queued=true;
   }
   if(mt73Queued)mt73QueueLocal();else{try{localStorage.removeItem(mt73Outbox)}catch(_){}mt73Status('Zapisano na serwerze · '+new Date().toLocaleTimeString('pl-PL'));}
  }
  mt73Failed=false;document.getElementById('contentShell').inert=false;document.getElementById('mt73-retry').hidden=true;
 }catch(e){mt73Queued=true;mt73Failed=true;mt73QueueLocal();mt73Freeze(e.status===409?e.message:'Nie zapisano na serwerze. '+e.message);}
 finally{mt73Busy=false;}
}
function mt73Legacy(){
 try{
  const keys=Object.keys(localStorage).filter(k=>/^matchthis-preview-MT-\d+$/.test(k)&&Number(k.split('-').pop())<=72).sort((a,b)=>Number(b.split('-').pop())-Number(a.split('-').pop()));
  for(const key of keys){const raw=sessionStorage.getItem(key)||localStorage.getItem(key);if(!raw)continue;const value=JSON.parse(raw);if(Array.isArray(value?.events)&&Array.isArray(value?.cycles))return {key,raw};}
 }catch(_){}return null;
}
async function mt73Start(){
 if(location.protocol==='file:'){throw new Error('Otwórz MatchThis na SMALL2, aby zapisywać dane na serwerze: https://matchthis.lowcymethodowcy.smallhost.pl/');}
 if(roleMode==='viewer'){
  const response=await fetch('/mt73-state.php?public=1',{cache:'no-store',credentials:'omit',signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw new Error('Nie można odczytać wyników z serwera. Odśwież stronę.');const j=await response.json();db=j.data;mt73Revision=j.revision;mt73Status('Dane z serwera');mt73Ready=true;return;
 }
 let j=await mt73Api();mt73Csrf=j.csrf;
 if(j.role!==roleMode)throw new Error('Nieprawidłowa rola panelu. Zaloguj się ponownie.');
 const legacy=mt73Legacy();
 if(legacy&&roleMode==='admin'){
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(legacy.raw)))).map(b=>b.toString(16).padStart(2,'0')).join('');
  const marker='matchthis-migrated-'+digest;
  if(localStorage.getItem(marker)!=='1'){
   // db is the existing migration pipeline's normalized version of the legacy browser data.
   const migrated=await mt73Api({op:'legacy',data:db,original:JSON.parse(legacy.raw)});j.state=migrated.state;
   try{localStorage.setItem(marker,'1')}catch(_){}
   if(!migrated.imported)document.getElementById('mt73-migration').textContent='Poprzednia kopia tej przeglądarki została zachowana na serwerze. Wyświetlane są aktualne dane wspólne.';
  }
 }
 db=mt73Clone(j.state.data);mt73Base=mt73Clone(db);mt73Revision=j.state.revision;mt73Ready=true;
 let pending=null;try{pending=JSON.parse(localStorage.getItem(mt73Outbox)||'null')}catch(_){}
 if(pending?.base&&pending?.data){mt73Base=pending.base;db=pending.data;mt73Queued=true;await mt73Flush();}
 else mt73Status('Dane z serwera · zapis automatyczny');
 document.getElementById('mt73-retry').onclick=()=>{mt73Queued=true;mt73Flush();};
 window.addEventListener('online',()=>{if(mt73Queued)mt73Flush();});
 window.addEventListener('beforeunload',e=>{if(mt73Queued||mt73Busy){e.preventDefault();e.returnValue='';}});
}
