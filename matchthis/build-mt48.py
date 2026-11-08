from pathlib import Path
from collections import Counter
import json,unicodedata
root=Path(__file__).resolve().parent
def norm(s):
 return ''.join(c for c in unicodedata.normalize('NFKD',s.upper().replace('Ł','L')) if not unicodedata.combining(c) and c.isalnum())
draw={}
for line in (root/'mt48_float_king_2025_round2_draw.tsv').read_text('utf8').splitlines():
 if not line or line.startswith('#'):continue
 peg,sector,name,weight=line.split('|')
 key=norm(name)
 assert key not in draw
 draw[key]=(int(peg),sector,int(weight))
assert len(draw)==70
assert sorted(t[0] for t in draw.values())==list(range(1,71))
assert Counter(t[1] for t in draw.values())=={'A':12,'B':12,'C':12,'D':12,'E':11,'F':11}
patch="""
// MT-48 — FLOAT KING 11.11.2025 II tura: assign only confirmed sectors/pegs of 70 starters.
// Preserve zero-weight JAROS ARTUR (13 p.) without invented position.
function mt48ApplyFloatKingRoundTwoDraw(){
 const event=db.events.find(e=>e.id==='mt2025-float_king_2025');
 const round=event?.rounds?.find(t=>t.date==='2025-11-11');
 if(!round||round.results?.length!==71)return 0;
 const map=new Map(MT48_FLOAT_ROUND2_DRAW.map(([name,peg,sector,weight,place])=>[norm(name),{peg,sector,weight,place}]));
 if(map.size!==70)return 0;
 const found=new Set();let extra=0;
 for(const row of round.results){
  const key=norm(row.competitorName||'');
  const d=map.get(key);
  if(!d){
   if(key!=='JAROSARTUR'||Number(row.weightG)!==0||Number(row.officialPlace)!==13||row.peg!=null||row.sector!=null)return 0;
   extra++;continue;
  }
  if(found.has(key)||Number(row.weightG)!==d.weight||Number(row.officialPlace)!==d.place)return 0;
  if(row.peg!=null&&Number(row.peg)!==d.peg)return 0;
  if(row.sector!=null&&row.sector!=='—'&&row.sector!==d.sector)return 0;
  found.add(key);
 }
 if(found.size!==70||extra!==1)return 0;
 let changed=0;
 for(const row of round.results){
  const d=map.get(norm(row.competitorName||''));
  if(d&&(row.peg==null||row.sector==null||row.sector==='—')){
   row.peg=d.peg;row.sector=d.sector;
   row.sectorSource='FLOAT KING 11.11.2025 II tura: sześć arkuszy A–F z paczki 2025.';
   changed++;
  }
 }
 if(changed)save();
 return changed;
}
mt48ApplyFloatKingRoundTwoDraw();
"""
for suffix in ('','_OGLADACZ','_SEDZIA'):
 s=(root/f'MatchThis_MT-47{suffix}.html').read_text('utf8').replace('MT-47','MT-48')
 marker='const MT44_MISSING_2025='
 assert s.count(marker)==1
 before,tail=s.split(marker,1)
 raw,after=tail.split(';\n',1)
 dataset=json.loads(raw)
 assert len(dataset['data']['events'])==4
 event=next(e for e in dataset['data']['events'] if e['id']=='mt2025-float_king_2025')
 r1,r2=event['rounds']
 assert r2['date']=='2025-11-11' and len(r2['results'])==71
 assert all(r['peg'] is None and r['sector'] is None for r in r2['results'])
 assert len(r1['results'])==71
 saved={norm(r['competitorName']):r for r in r2['results']}
 assert len(saved)==71
 assert set(draw).issubset(saved),('unknown person',set(draw)-set(saved))
 assert set(saved)-set(draw)=={'JAROSARTUR'},('unmatched',set(saved)-set(draw))
 for key,r in saved.items():
  if key in draw:
   peg,sector,weight=draw[key]
   assert weight==r['weightG'],(r['competitorName'],'weight mismatch')
   r['peg']=peg
   r['sector']=sector
   r['sectorSource']='FLOAT KING 11.11.2025 II tura, arkusze A:580502511, B:580040202, C:579353284, D:581465555, E:582842496, F:582250396.'
  else:
   assert r['weightG']==0 and r['officialPlace']==13,(r['competitorName'],'unknown zero')
   assert r['peg'] is None and r['sector'] is None
 s=before+marker+json.dumps(dataset,ensure_ascii=False,separators=(',',':'))+';\n'+after
 if suffix!='_OGLADACZ':
  key="const MT46_STORAGE_KEY='matchthis-preview-MT-46';"
  assert s.count(key)==1,(suffix,'key')
  s=s.replace(key,"const MT47_STORAGE_KEY='matchthis-preview-MT-47';\n"+key)
  key="localStorage.getItem(MT46_STORAGE_KEY)||"
  assert s.count(key)==1,(suffix,'migration')
  s=s.replace(key,"localStorage.getItem(MT47_STORAGE_KEY)||"+key)
 declaration='const MT48_FLOAT_ROUND2_DRAW='+json.dumps([[r['competitorName'],r['peg'],r['sector'],r['weightG'],r['officialPlace']] for r in r2['results'] if r['peg'] is not None],ensure_ascii=False,separators=(',',':'))+';\n'
 key='mt47ApplyPucharRoundTwoDraw();'
 assert s.count(key)==1
 s=s.replace(key,declaration+key+'\n'+patch)
 for v in ('<title>MatchThis MT-48</title>','aria-label="Wersja MT-48">MT-48','data-version="MT-48"', "const APP_VERSION='MT-48'"):
  assert v in s,(suffix,v)
 path=root/f'MatchThis_MT-48{suffix}.html'
 path.write_text(s,encoding='utf8')
 print('MT48_BUILT',path.name,'bytes',path.stat().st_size)
print('MT48_SOURCE_CHECK_PASS 70/70 FOUND, 1 UNASSIGNED ZERO RESULT')
