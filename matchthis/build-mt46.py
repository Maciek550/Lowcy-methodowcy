from pathlib import Path
from collections import Counter
import json,unicodedata,re
root=Path(__file__).resolve().parent
def norm(s):
 return ''.join(c for c in unicodedata.normalize('NFKD',s.upper()) if not unicodedata.combining(c) and c.isalnum())
source=[]
for line in (root/'mt46_puchar_2025_round1_draw.tsv').read_text('utf8').splitlines():
 if not line or line.startswith('#'): continue
 peg,sector,name=line.split('|')
 source.append((int(peg),sector,name))
assert len(source)==77 and sorted(x[0] for x in source)==list(range(1,78))
assert Counter(x[1] for x in source)==Counter({s:11 for s in 'ABCDEFG'})
assert len({norm(x[2]) for x in source})==77
# Two spelling/order differences in the handwritten draw versus existing results.
# Keep all existing results' names unchanged; map the aliases only.
alias={'ANNAPEIL':'PEL ANNA','LOSNOWIECMARCIN':'TOSNOWIEC MARCIN'}
js_patch="""
// MT-46: 22.11.2025 XIII Puchar: sector and peg of round I only.
// Do not change scores, weights, other tours, or user-edited positions.
function mt46ApplyPucharRoundOneDraw(){
 const event=db.events.find(x=>x.id==='mt2025-matchthis_puchar_2025');
 const round=event?.rounds?.find(t=>t.date==='2025-11-22');
 if(!round||round.results?.length!==77)return 0;
 const draw=new Map(MT46_PUCHAR_ROUND1_DRAW.map(([name,peg,sector,weight,place])=>[norm(name),{peg,sector,weight,place}]));
 if(draw.size!==77)return 0;
 const seen=new Set();
 for(const row of round.results){
  const key=norm(row.competitorName||'');
  const d=draw.get(key);
  if(!d||seen.has(key)||Number(row.weightG)!==d.weight||Number(row.officialPlace)!==d.place)return 0;
  if(row.peg!=null&&Number(row.peg)!==d.peg)return 0;
  if(row.sector!=null&&row.sector!=='—'&&row.sector!==d.sector)return 0;
  seen.add(key);
 }
 if(seen.size!==77)return 0;
 let changed=0;
 for(const row of round.results){
  const d=draw.get(norm(row.competitorName));
  if(row.peg==null||row.sector==null||row.sector==='—'){
   row.peg=d.peg;row.sector=d.sector;
   row.sectorSource='22.11.2025 — I tura: źródłowa tabela losowania XIII Pucharu (77 stanowisk, sektory A–G).';
   changed++;
  }
 }
 if(changed)save();
 return changed;
}
mt46ApplyPucharRoundOneDraw();
"""
for suffix in ('','_OGLADACZ','_SEDZIA'):
 old=(root/f'MatchThis_MT-45{suffix}.html').read_text('utf8')
 s=old.replace('MT-45','MT-46')
 marker='const MT44_MISSING_2025='
 assert s.count(marker)==1
 pre,rem=s.split(marker,1);raw,post=rem.split(';\n',1)
 dataset=json.loads(raw)
 assert len(dataset['data']['events'])==4
 event=next(e for e in dataset['data']['events'] if e['id']=='mt2025-matchthis_puchar_2025')
 round=event['rounds'][0]
 assert round['date']=='2025-11-22' and len(round['results'])==77
 assert all(r['peg'] is None and r['sector'] is None for r in round['results'])
 name_to_record={norm(r['competitorName']):r for r in round['results']}
 assert len(name_to_record)==77
 mapped={}
 for peg,sector,name in source:
  expected=alias.get(norm(name),name)
  key=norm(expected)
  assert key in name_to_record,('unmatched',peg,name,key)
  assert key not in mapped,('duplicate',peg,name,key)
  mapped[key]=(peg,sector)
 assert set(mapped)==set(name_to_record),('missing names',set(name_to_record)-set(mapped))
 weights={k:r['weightG'] for k,r in name_to_record.items()}
 places={k:r['officialPlace'] for k,r in name_to_record.items()}
 for key,r in name_to_record.items():
  r['peg'],r['sector']=mapped[key]
  r['sectorSource']='22.11.2025 — I tura: źródłowa tabela losowania XIII Pucharu (A–G).'
 assert {k:r['weightG'] for k,r in name_to_record.items()}==weights
 assert {k:r['officialPlace'] for k,r in name_to_record.items()}==places
 s=pre+marker+json.dumps(dataset,ensure_ascii=False,separators=(',',':'))+';\n'+post
 if suffix!='_OGLADACZ':
  key="const MT44_STORAGE_KEY='matchthis-preview-MT-44';"
  assert s.count(key)==1
  s=s.replace(key,"const MT45_STORAGE_KEY='matchthis-preview-MT-45';\n"+key)
  key="localStorage.getItem(MT44_STORAGE_KEY)||"
  assert s.count(key)==1
  s=s.replace(key,"localStorage.getItem(MT45_STORAGE_KEY)||"+key)
 payload=[[r['competitorName'],r['peg'],r['sector'],r['weightG'],r['officialPlace']] for r in round['results']]
 declaration='const MT46_PUCHAR_ROUND1_DRAW='+json.dumps(payload,ensure_ascii=False,separators=(',',':'))+';\n'
 key='mt45PopulateMega2025();'
 assert s.count(key)==1
 s=s.replace(key,declaration+key+'\n'+js_patch)
 for check in ('<title>MatchThis MT-46</title>','aria-label="Wersja MT-46">MT-46','data-version="MT-46"', "const APP_VERSION='MT-46'"):
  assert check in s,(suffix,check)
 out=root/f'MatchThis_MT-46{suffix}.html'
 out.write_text(s,'utf8')
 print('MT46_BUILT',out.name,len(s),'sectors',dict(Counter(r['sector'] for r in round['results'])))
print('MT46 77/77 ROUND1 PEG/SECTOR VERIFIED; ROUND2 WEIGHTS PLACES UNTOUCHED')
