from pathlib import Path
import json,re,hashlib,subprocess,collections
D=Path(__file__).resolve().parent
SRC=D
BASE={'':'00a8723e9ef9efaf47c6a19d27b30c4315d4c6012a5bc90bc1e9ed9247146f7c','_OGLADACZ':'5d85a7215413e010078f83faea3650f16c99bb4178f11ea49dec7b2b17a823d3','_SEDZIA':'c513e98b696837e847b22584bbb4d5c237196f2bc85ebb4fdcb60320e3940a08'}
# Old displayed name and verified alternative, for the exact indicated TRAPER CUP row.
PATCHES=[
 ('A',6,3530,'GRABOWSKI MACIEJ','GRZYBOWSKI MACIEJ','mt2026-standalone-grabowski-maciej'),
 ('B',20,4435,'KULCZAK WIKTOR','WALCZAK WIKTOR','mt2026-standalone-kulczak-wiktor'),
 ('B',24,1040,'HRANIEC WŁODZIMIERZ','KRAWIEC WŁODZIMIERZ','mt2026-standalone-hraniec-wodzimierz'),
 ('C',33,2600,'KOWALCZUK WOJCIECH','KOWALCZYK WOJCIECH','mt2026-standalone-kowalczuk-wojciech'),
 ('D',45,2185,'MIRCZYŃSKI MARIUSZ','KURCZYŃSKI MARIUSZ','mt2026-standalone-mirczynski-mariusz')
]
EVENT='mt2026-traper-cup-kobialka'

def only(s,a,b):
 c=s.count(a);assert c==1,(a[:100],c)
 return s.replace(a,b,1)

def package_patch(s):
 start=s.index('const MATCHTHIS_STANDALONE_2026=')+len('const MATCHTHIS_STANDALONE_2026=')
 root,n=json.JSONDecoder().raw_decode(s[start:]);stop=start+n
 original=json.loads(s[start:stop]); assert original==root
 event=next(e for e in root['data']['events'] if e['id']==EVENT)
 assert event['date']=='2026-04-11' and len(event['rounds'])==1
 rows=event['rounds'][0]['results'];players={p['id']:p for p in root['data']['players']};replacements=[]
 for sec,peg,weight,old,new,person_id in PATCHES:
  row=next((r for r in rows if r.get('sector')==sec and r.get('peg')==peg),None)
  assert row and row['weightG']==weight and row['competitorName']==old and row['competitorId']==person_id and row.get('nameNeedsReview')==True
  person=players[person_id]; assert person['lastName']+' '+person['firstName']==old and person.get('nameNeedsReview')==True
  assert len([r for r in rows if r.get('competitorId')==person_id])==1
  # Change only reviewed records, leave identifiers and all scoring intact.
  oldrow=json.dumps(row,ensure_ascii=False,separators=(',',':'))
  row['competitorName']=new;row['nameNeedsReview']=False
  newrow=json.dumps(row,ensure_ascii=False,separators=(',',':'))
  oldp=json.dumps(person,ensure_ascii=False,separators=(',',':'))
  person['lastName']=new.split(' ')[0]
  person['aliases']=[new] # verified display; original spelling retained in sourceReview for audit
  person['nameNeedsReview']=False
  newp=json.dumps(person,ensure_ascii=False,separators=(',',':'))
  replacements.extend([(oldrow,newrow),(oldp,newp)])
  info=[v for v in root['sourceReview'] if v['event']=='TRAPER' and v['sector']==sec and v['peg']==peg]
  assert len(info)==1 and info[0]['originalTranscription']==old
  oldinfo=json.dumps(info[0],ensure_ascii=False,separators=(',',':'))
  info[0]['reviewStatus']='CONFIRMED'
  info[0]['verifiedName']=new
  info[0]['verifiedSource']='Decyzja organizatora 10.11.2026'
  info[0]['issue']='Potwierdzono prawidłowe nazwisko'
  newinfo=json.dumps(info[0],ensure_ascii=False,separators=(',',':'))
  replacements.append((oldinfo,newinfo))
 for old,new in replacements:
  assert s[start:stop].count(old)==1,(old[:80],s[start:stop].count(old))
  s=s[:start]+s[start:stop].replace(old,new,1)+s[stop:]
  stop+=len(new)-len(old)
 # Re-read and validate the *entire* embedded package after edits.
 updated,_=json.JSONDecoder().raw_decode(s[start:]); nr=updated['data']['events'][0]['rounds'][0]['results']
 assert len(nr)==len(rows)==55
 for sec,peg,weight,old,new,person_id in PATCHES:
  rw=next(r for r in nr if r.get('sector')==sec and r.get('peg')==peg)
  assert rw['competitorName']==new and rw['weightG']==weight and rw['nameNeedsReview'] is False
 for other in rows:
  if (other['sector'],other['peg']) not in [(a,b) for a,b,*_ in PATCHES]:
   before=next(r for r in original['data']['events'][0]['rounds'][0]['results'] if r.get('sector')==other['sector'] and r.get('peg')==other['peg'])
   assert other==before,other
 return s

script=r'''// MT-69: five names confirmed by the organizer (10.11.2026), TRAPER CUP 11.04.2026.
// Apply only when identity, original spelling, sector, station and weight all match.
// Never alter player IDs, sectors, assigned stations, weights, points, places or other tournaments.
const MT69_TRAPER_APPROVED=[
 ['A',6,3530,'GRABOWSKI MACIEJ','GRZYBOWSKI MACIEJ','mt2026-standalone-grabowski-maciej'],
 ['B',20,4435,'KULCZAK WIKTOR','WALCZAK WIKTOR','mt2026-standalone-kulczak-wiktor'],
 ['B',24,1040,'HRANIEC WŁODZIMIERZ','KRAWIEC WŁODZIMIERZ','mt2026-standalone-hraniec-wodzimierz'],
 ['C',33,2600,'KOWALCZUK WOJCIECH','KOWALCZYK WOJCIECH','mt2026-standalone-kowalczuk-wojciech'],
 ['D',45,2185,'MIRCZYŃSKI MARIUSZ','KURCZYŃSKI MARIUSZ','mt2026-standalone-mirczynski-mariusz']
];
function mt69ApplyApprovedTraperNames(){
 const event=db.events.find(e=>e.id==='mt2026-traper-cup-kobialka'&&e.date==='2026-04-11');
 const round=event?.rounds?.find(t=>t.date==='2026-04-11');
 if(!round||!Array.isArray(round.results))return 0;
 let changed=0;
 for(const [sector,peg,weight,oldName,newName,sourceId] of MT69_TRAPER_APPROVED){
  const matches=round.results.filter(r=>r.sector===sector&&Number(r.peg)===peg&&Number(r.weightG)===weight&&
    (r.competitorName===oldName||r.competitorName===newName));
  if(matches.length!==1)continue;
  const row=matches[0];
  // Result IDs can have been legitimately remapped by earlier archive imports.
  // Do not change an unrelated person just because a surname looks similar.
  const player=db.players.find(p=>p.id===row.competitorId);
  if(!player)continue;
  const playerName=fullName(player);
  const allowed=(row.competitorId===sourceId||playerName===oldName||playerName===newName);
  if(!allowed)continue;
  const others=db.events.flatMap(e=>e.rounds||[]).flatMap(t=>t.results||[])
    .filter(r=>r!==row&&r.competitorId===row.competitorId);
  if(row.competitorName===oldName){row.competitorName=newName;changed++;}
  if(row.nameNeedsReview===true){row.nameNeedsReview=false;changed++;}
  // Rename player record only if its old name still matches and it is not shared
  // with results whose spelling differs from the new verified name.
  const safeRename=!others.some(r=>r.competitorName!==newName);
  if(playerName===oldName&&safeRename){
    player.lastName=newName.split(' ')[0];
    player.firstName=newName.slice(player.lastName.length+1);
    player.aliases=[newName];changed++;
  }
  if(player.nameNeedsReview===true&&safeRename&&fullName(player)===newName&&
      !others.some(r=>r.nameNeedsReview===true)){
    player.nameNeedsReview=false;changed++;
  }
 }
 if(changed)save();
 return changed;
}
const mt69ApprovedTraperNameChanges=mt69ApplyApprovedTraperNames();
'''

for suffix,sha in BASE.items():
 s=(SRC/f'MatchThis_MT-68{suffix}.html').read_text('utf8');assert hashlib.sha256(s.encode()).hexdigest()==sha
 s=package_patch(s)
 for a,b in [
 ('<title>MatchThis MT-68</title>','<title>MatchThis MT-69</title>'),
 ('data-version="MT-68"','data-version="MT-69"'),
 ('aria-label="Wersja MT-68">MT-68','aria-label="Wersja MT-69">MT-69'),
 ('<div class="version" id="appversion">MT-68</div>','<div class="version" id="appversion">MT-69</div>'),
 ("const APP_VERSION='MT-68';","const APP_VERSION='MT-69';"),
 ("const STORAGE_KEY='matchthis-preview-MT-68';","const STORAGE_KEY='matchthis-preview-MT-69';\nconst MT68_STORAGE_KEY='matchthis-preview-MT-68';"),
 ('localStorage.getItem(MT67_STORAGE_KEY)||','localStorage.getItem(MT68_STORAGE_KEY)||localStorage.getItem(MT67_STORAGE_KEY)||'),
 ('const mt27AutoCorrections=applyMt27SourceDecisions();','const mt27AutoCorrections=applyMt27SourceDecisions();\n'+script)
 ]:
  if a=='localStorage.getItem(MT67_STORAGE_KEY)||' and suffix=='_OGLADACZ':
   assert a not in s
   continue
  s=only(s,a,b)
 old=(SRC/f'MatchThis_MT-68{suffix}.html').read_text('utf8')
 # No changes to any other archive datasets
 for key in ('MATCHTHIS_ARCHIVE_2026','MATCHTHIS_ARCHIVE_2025_SENSAS','MATCHTHIS_ARCHIVE_2025_ADDITIONAL',
             'MATCHTHIS_ARCHIVE_2025_SENSAS_II','MT44_MISSING_2025','MT44_MEGA_2025',
             'MATCHTHIS_ARCHIVE_2025_MAVER_OCT','MT45_MEGA_2025_ROUNDS'):
  grab=lambda x:x.split('const '+key+'=',1)[1].split(';\n',1)[0]
  assert grab(old)==grab(s),(suffix,key)
 for js in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S):
  if js.strip():
   f=D/'_syntax.js';f.write_text(js,encoding='utf8');subprocess.run(['node','--check',str(f)],check=True);f.unlink()
 output=D/f'MatchThis_MT-69{suffix}.html';output.write_text(s,encoding='utf8')
 print('BUILT',output.name,len(s),hashlib.sha256(s.encode()).hexdigest())
