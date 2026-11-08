from pathlib import Path
from collections import Counter
import json
root=Path(__file__).resolve().parent
draw={}
for line in (root/'mt43_maver_oct2025_round2_draw.tsv').read_text(encoding='utf8').splitlines():
 if not line or line.startswith('#'):continue
 peg,sector,name=line.split('|')
 peg=int(peg)
 assert name not in draw and sector in ('A','B','C')
 draw[name]=(peg,sector)
assert len(draw)==32
assert sorted(v[0] for v in draw.values())==list(range(1,33))
assert Counter(v[1] for v in draw.values())==Counter({'A':11,'B':10,'C':11})
marker='const MATCHTHIS_ARCHIVE_2025_MAVER_OCT='
oldnote='Nie podano stanowisk i sektorów tury 2.'
newnote='Stanowiska i sektory II tury ustalone z kart losowania A/B/C dostarczonych 08.11.2026.'
jstemplate="""
// MT-43 — wyłącznie uzupełnienie losowania II tury MAVER 12.10.2025.
function mt43ApplyMaverSecondRoundDraw(){
 const event=db.events.find(e=>e.id==='mt2025-maver-super-cup-oct');
 const round=event?.rounds?.find(t=>t.date==='2025-10-12');
 if(!round||!Array.isArray(round.results)||round.results.length!==32)return 0;
 const map=new Map(MT43_MAVER_ROUND2_DRAW.map(([name,peg,sector,weight])=>[name,{peg,sector,weight}]));
 if(map.size!==32)return 0;
 const seen=new Set();
 for(const r of round.results){
  const name=String(r.competitorName||'').toUpperCase();
  const entry=map.get(name);
  if(!entry||seen.has(name)||Number(r.weightG)!==entry.weight)return 0;
  seen.add(name);
  if(r.peg!=null&&Number(r.peg)!==entry.peg)return 0;
  if(r.sector!=null&&r.sector!=='—'&&r.sector!==entry.sector)return 0;
 }
 if(seen.size!==32)return 0;
 let changed=0;
 for(const r of round.results){
  const entry=map.get(String(r.competitorName).toUpperCase());
  if(r.peg==null||r.sector==null||r.sector==='—'){
    r.peg=entry.peg;r.sector=entry.sector;
    r.sectorSource='Losowanie II tury 12.10.2025 — karty A, B, C od użytkownika.';
    changed++;
  }
 }
 if(changed)save();
 return changed;
}
mt43ApplyMaverSecondRoundDraw();
"""
for suffix in ('','_OGLADACZ','_SEDZIA'):
 path=root/f'MatchThis_MT-42{suffix}.html'
 s=path.read_text(encoding='utf8')
 assert s.count(marker)==1
 a,tail=s.split(marker,1);raw,b=tail.split(';\n',1)
 dataset=json.loads(raw)
 events=dataset['data']['events']
 assert len(events)==1 and events[0]['id']=='mt2025-maver-super-cup-oct'
 evt=events[0]
 rounds=evt['rounds']
 assert len(rounds)==2 and rounds[1]['date']=='2025-10-12'
 orig=rounds[1]['results']
 assert len(orig)==32 and {r['competitorName'] for r in orig}==set(draw)
 assert all(r['peg'] is None and r['sector'] is None for r in orig)
 w0={r['competitorName']:r['weightG'] for r in orig}
 p0={r['competitorName']:r['officialPlace'] for r in orig}
 for r in orig:
  r['peg'],r['sector']=draw[r['competitorName']]
  r['sectorSource']='Losowanie II tury 12.10.2025 — karty sektorów A, B, C przekazane przez użytkownika.'
 assert {r['competitorName']:r['weightG'] for r in orig}==w0
 assert {r['competitorName']:r['officialPlace'] for r in orig}==p0
 if oldnote in evt['source']:evt['source']=evt['source'].replace(oldnote,newnote)
 for pl in dataset['data']['players']:
  if oldnote in pl.get('source',''):pl['source']=pl['source'].replace(oldnote,newnote)
 s=a+marker+json.dumps(dataset,ensure_ascii=False,separators=(',',':'))+';\n'+b
 s=s.replace('MT-42','MT-43')
 if suffix!='_OGLADACZ':
  old="const MT41_STORAGE_KEY='matchthis-preview-MT-41';"
  assert s.count(old)==1
  s=s.replace(old,"const MT42_STORAGE_KEY='matchthis-preview-MT-42';\n"+old)
  old="localStorage.getItem(MT41_STORAGE_KEY)||"
  assert s.count(old)==1
  s=s.replace(old,"localStorage.getItem(MT42_STORAGE_KEY)||"+old)
 rows=[[r['competitorName'],r['peg'],r['sector'],r['weightG']] for r in orig]
 declaration='const MT43_MAVER_ROUND2_DRAW='+json.dumps(rows,ensure_ascii=False,separators=(',',':'))+';\n'
 anchor='mt42ApprovedAprilRankFix();'
 assert s.count(anchor)==1
 s=s.replace(anchor,declaration+anchor+'\n'+jstemplate)
 for check in ('<title>MatchThis MT-43</title>','aria-label="Wersja MT-43">MT-43','data-version="MT-43"', "const APP_VERSION='MT-43'"):
  assert check in s,(suffix,check)
 out=root/f'MatchThis_MT-43{suffix}.html'
 out.write_text(s,encoding='utf8')
 print('MT43_BUILT',out.name,'bytes',out.stat().st_size,'sector_sizes',dict(Counter(x['sector'] for x in orig)))
