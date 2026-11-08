from pathlib import Path
import json
root=Path(__file__).resolve().parent
CORRECTION=r"""
// MT-53 — organizer confirmation 08.11.2026: position 44 is STEFANIUK RAFAŁ,
// identical to the existing MEGA 2026 competitor, not a newly created person.
// Correct only unedited XIV Puchar MT52 typo and preserve all historical results.
function mt53CorrectXivStefaniuk(){
 const events=db.events.filter(mt52IsXiv);
 if(events.length!==1)return false;
 const e=events[0];
 const entrants=e.entrantIds||[];
 if(entrants.length<44)return false;
 const old=findPlayer(entrants[43]);
 if(!old||norm(fullName(old))!==norm('STEFANIU RAFAŁ'))return false;
 const target=db.players.find(p=>p.id==='mt2026-person-stefaniuk-rafa');
 if(!target||norm(fullName(target))!==norm('STEFANIUK RAFAŁ')){
  console.warn('MT53: kanoniczna osoba STEFANIUK RAFAŁ nie została rozpoznana; wpis pozostawiony');
  return false;
 }
 if(entrants.some((id,i)=>i!==43&&id===target.id)){
  console.warn('MT53: STEFANIUK RAFAŁ już występuje na innej pozycji; nie tworzę duplikatu');
  return false;
 }
 // Do not silently rewrite a recorded score/peg or manually replaced registration.
 if((e.rounds||[]).some(t=>(t.results||[]).some(r=>r.competitorId===old.id||r.playerId===old.id))){
  console.warn('MT53: pozycja ma wyniki wymagające ręcznej weryfikacji; bez automatycznej zmiany');
  return false;
 }
 entrants[43]=target.id;
 e.mt53Correction='Pozycja 44: STEFANIUK RAFAŁ — organizator potwierdził, że to osoba z dotychczasowej bazy.';
 // Delete only the orphaned MT52 spelling-typo player, never an elsewhere used person.
 if(old.id!==target.id && old.source?.startsWith('XIV Puchar MatchThis 28-29.11.2026')){
  const referenced=JSON.stringify(db.events).includes(old.id)||JSON.stringify(db.cycles).includes(old.id);
  if(!referenced)db.players=db.players.filter(p=>p.id!==old.id);
 }
 save();
 return true;
}
mt53CorrectXivStefaniuk();
"""
for suffix in ('','_SEDZIA','_OGLADACZ'):
 old=(root/f'MatchThis_MT-52{suffix}.html').read_text('utf8')
 s=old.replace('MT-52','MT-53')
 prefix='const MT52_XIV_NAMES='
 assert s.count(prefix)==1
 pre,tail=s.split(prefix,1)
 raw,post=tail.split(';\n',1)
 names=json.loads(raw)
 assert len(names)==72 and names[43]=='STEFANIU RAFAŁ' and names[70]=='REZERWACJA'
 names[43]='STEFANIUK RAFAŁ'
 assert len(set(names))==72
 s=pre+prefix+json.dumps(names,ensure_ascii=False,separators=(',',':'))+';\n'+post
 if suffix!='_OGLADACZ':
  key="const MT51_STORAGE_KEY='matchthis-preview-MT-51';"
  assert s.count(key)==1,(suffix,'versioned storage')
  s=s.replace(key,"const MT52_STORAGE_KEY='matchthis-preview-MT-52';\n"+key)
  key="localStorage.getItem(MT51_STORAGE_KEY)||"
  assert s.count(key)==1,(suffix,'storage migration')
  s=s.replace(key,"localStorage.getItem(MT52_STORAGE_KEY)||"+key)
 anchor='mt52ImportXivRoster();'
 assert s.count(anchor)==1
 s=s.replace(anchor,anchor+'\n'+CORRECTION)
 for marker in ('<title>MatchThis MT-53</title>','aria-label="Wersja MT-53">MT-53','data-version="MT-53"', "const APP_VERSION='MT-53'"):
  assert marker in s,(suffix,marker)
 assert s.count('function mt53CorrectXivStefaniuk(){')==1
 out=root/f'MatchThis_MT-53{suffix}.html'
 out.write_text(s,encoding='utf8')
 print('MT53_BUILT',out.name,len(s),'position44',names[43])
print('MT53_CORRECTED_ONLY_XIV_SLOT_44; OLD_RESULTS_PRESERVED')
