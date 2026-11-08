from pathlib import Path
import re
root=Path(__file__).resolve().parent

QUOTA_FIX=r"""
// MT-50: quota recovery does not destroy historical data.
// The prior version snapshots are backed up transactionally to IndexedDB before
// any redundant localStorage copy is released; current data is staged in
// sessionStorage until the normal persistent write succeeds.
let mt50QuotaRecoveryActive=false;
let mt50StorageWritePending=false;
let mt50WarningTimeout=null;
const MT50_SAFETY_ARCHIVE='MatchThis-zabezpieczone-kopie-wersji';
function mt50FallbackSessionRead(){
 try{return sessionStorage.getItem(STORAGE_KEY)}catch(_){return null}
}
function mt50Warning(message){
 let el=document.getElementById('mt50-storage-warning');
 if(!message){if(el)el.remove();return;}
 if(!el){
  el=document.createElement('div');el.id='mt50-storage-warning';
  el.setAttribute('role','alert');
  el.style.cssText='position:sticky;top:0;z-index:9999;padding:10px 16px;background:#fff0df;border-bottom:2px solid #c75b00;color:#683506;font:600 13px/1.4 system-ui,sans-serif;';
  document.body.prepend(el);
 }
 el.textContent=message;
}
function mt50ScheduleWarning(){
 if(mt50WarningTimeout!==null)return;
 mt50WarningTimeout=setTimeout(()=>{
  mt50WarningTimeout=null;
  if(mt50StorageWritePending)mt50Warning('Trwa bezpieczne przenoszenie starszych kopii do archiwum przeglądarki. Nie zamykaj tej karty przed zakończeniem zapisu.');
 },1500);
}
function mt50TryPersistentWrite(){
 try{
  localStorage.setItem(STORAGE_KEY,JSON.stringify(db));
  mt50StorageWritePending=false;
  try{sessionStorage.removeItem(STORAGE_KEY)}catch(_){}
  mt50Warning(null);
  return true;
 }catch(_){return false}
}
function mt50ArchiveOldVersionsAndRecover(){
 return new Promise((resolve,reject)=>{
  if(!('indexedDB' in window)){reject(new Error('IndexedDB jest niedostępna'));return;}
  // Do not remove unknown, non-MatchThis or current-release keys.
  const previous=Object.keys(localStorage).filter(k=>/^matchthis-preview-MT-\d+$/.test(k)&&k!==STORAGE_KEY)
   .sort((a,b)=>Number(a.match(/\d+$/)[0])-Number(b.match(/\d+$/)[0]));
  if(!previous.length){resolve(false);return;}
  // Copy source bytes before touching old keys. In particular MT-49 is the
  // last candidate and is never removed unless earlier copies are insufficient.
  const copies=previous.map(key=>({key,data:localStorage.getItem(key)})).filter(x=>x.data!==null);
  const request=indexedDB.open(MT50_SAFETY_ARCHIVE,1);
  request.onupgradeneeded=()=>{
   const storage=request.result;
   if(!storage.objectStoreNames.contains('snapshots'))storage.createObjectStore('snapshots',{keyPath:'key'});
  };
  request.onerror=()=>reject(request.error||new Error('Archiwizacja niedostępna'));
  request.onsuccess=()=>{
   const archive=request.result;
   let transaction;
   try{
    transaction=archive.transaction('snapshots','readwrite');
    const store=transaction.objectStore('snapshots');
    for(const copy of copies)store.put({...copy,archivedAt:new Date().toISOString(),format:'localStorage-json-raw'});
    // Back up the newest in-memory version too, before modifying any old copy.
    store.put({key:STORAGE_KEY,data:JSON.stringify(db),archivedAt:new Date().toISOString(),format:'localStorage-json-raw'});
   }catch(e){archive.close();reject(e);return;}
   transaction.onerror=()=>{archive.close();reject(transaction.error||new Error('Kopia nie została zapisana'))};
   transaction.onabort=()=>{archive.close();reject(transaction.error||new Error('Kopia została przerwana'))};
   transaction.oncomplete=()=>{
    archive.close();
    // Only after a complete IDB transaction can old redundant keys be removed.
    if(mt50TryPersistentWrite()){resolve(true);return;}
    for(const entry of copies){
     // Another tab may have modified the key during the asynchronous backup:
     // in that case do not delete an unarchived newer value.
     if(localStorage.getItem(entry.key)!==entry.data)continue;
     localStorage.removeItem(entry.key);
     if(mt50TryPersistentWrite()){resolve(true);return;}
    }
    resolve(mt50TryPersistentWrite());
   };
  };
 });
}
function mt50StartQuotaRecovery(){
 if(mt50QuotaRecoveryActive)return;
 mt50QuotaRecoveryActive=true;
 mt50ScheduleWarning();
 mt50ArchiveOldVersionsAndRecover()
  .then(ok=>{
   mt50QuotaRecoveryActive=false;
   if(ok||mt50TryPersistentWrite())return;
   mt50Warning('Nie udało się zapisać wszystkich zmian na dysku przeglądarki. Użyj Eksport w panelu administratora przed zamknięciem tej karty.');
  })
  .catch(error=>{
   mt50QuotaRecoveryActive=false;
   console.error('MatchThis MT-50: nie udało się zabezpieczyć pamięci',error);
   mt50Warning('Pamięć przeglądarki jest pełna. Dane pozostają na tej karcie; użyj Eksport w panelu administratora przed jej zamknięciem.');
  });
}
function save(){
 const data=JSON.stringify(db);
 try{
  localStorage.setItem(STORAGE_KEY,data);
  mt50StorageWritePending=false;
  try{sessionStorage.removeItem(STORAGE_KEY)}catch(_){}
  mt50Warning(null);
  return true;
 }catch(error){
  // Never crash application startup. Do not erase any legacy copies on failure.
  mt50StorageWritePending=true;
  try{sessionStorage.setItem(STORAGE_KEY,data)}catch(_){}
  console.warn('MatchThis MT-50: pamięć localStorage nie pozwoliła na zapis',error);
  if(error?.name==='QuotaExceededError'||error?.name==='NS_ERROR_DOM_QUOTA_REACHED')mt50StartQuotaRecovery();
  else mt50Warning('Przeglądarka zablokowała zapis. Dane są w pamięci tej karty; wykonaj Eksport przed jej zamknięciem.');
  return false;
 }
}
"""
for suffix in ('','_OGLADACZ','_SEDZIA'):
 previous=(root/f'MatchThis_MT-49{suffix}.html').read_text('utf8')
 s=previous.replace('MT-49','MT-50')
 if suffix!='_OGLADACZ':
  old="const MT48_STORAGE_KEY='matchthis-preview-MT-48';"
  assert s.count(old)==1,(suffix,'storage anchor')
  s=s.replace(old,"const MT49_STORAGE_KEY='matchthis-preview-MT-49';\n"+old)
  old="function save(){localStorage.setItem(STORAGE_KEY,JSON.stringify(db));}"
  assert s.count(old)==1,(suffix,'save anchor')
  s=s.replace(old,QUOTA_FIX)
  old="const loaded=JSON.parse(fresh||localStorage.getItem(MT48_STORAGE_KEY)||"
  assert s.count(old)==1,(suffix,'load anchor')
  s=s.replace(old,"const loaded=JSON.parse(fresh||mt50FallbackSessionRead()||localStorage.getItem(MT49_STORAGE_KEY)||localStorage.getItem(MT48_STORAGE_KEY)||")
 else:
  assert 'function save(){/* publiczny widok oglądacza: nie wykonuje żadnego zapisu */}' in s
 for check in ('<title>MatchThis MT-50</title>','aria-label="Wersja MT-50">MT-50','data-version="MT-50"', "const APP_VERSION='MT-50'","const STORAGE_KEY='matchthis-preview-MT-50'"):
  assert check in s,(suffix,check)
 if suffix!='_OGLADACZ':assert s.count('function mt50ArchiveOldVersionsAndRecover()')==1
 assert s.count('function save(){')==1
 output=root/f'MatchThis_MT-50{suffix}.html'
 output.write_text(s,encoding='utf8')
 print('MT50_BUILT',output.name,output.stat().st_size,'previous',len(previous))
print('MT50: only safe persistence / quota guard; application screens, results and server auth unchanged.')
