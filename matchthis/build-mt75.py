#!/usr/bin/env python3
"""MT75: SHA-pinned MT72 -> verified MT73 persistence + confirmed MT74 final pegs.
Does not create artificial sectors or change weights or official places.
"""
from pathlib import Path
import json,hashlib,re,subprocess
d=Path('matchthis')
names=json.loads((d/'mt74-final-pegs.json').read_text(encoding='utf8'))
assert len(names)==54 and len(set(names))==54
source_hash={'':'c92b517bc45e281ea44c8890d0089ad1daf183be67d7689deb33151f16de8581',
'_OGLADACZ':'2595a4fad3fa4a2b5457a345e65f896171b4ca95578d246ec0e599ad537aa4a6',
'_SEDZIA':'8d10378ebb8152bb16da39199f398dcf57d61801b286c356bf6fa5459d21bdd2'}
repair=r"""
// MT75: restore ONLY 54 confirmed finalist stand/sector pairs; never alter results.
const MT75_FINAL_ASSIGNMENTS=RECORDS;
function mt75RestoreFinalSectors(){
 const e=db.events.find(x=>x.id==='mt2025-mega_final_2025');
 const t=e?.rounds?.find(x=>x.id==='mt2025-mega_final_2025-round2'&&x.date==='2025-10-26');
 if(!t)return 0;
 let changed=0;
 for(const [id,name,weight,peg,sector] of MT75_FINAL_ASSIGNMENTS){
  const rows=t.results.filter(x=>x.competitorName===name&&Number(x.weightG)===weight);
  if(rows.length!==1)continue;
  const r=rows[0];
  if(!r.sector&&!r.peg){r.sector=sector;r.peg=peg;changed++;}
 }
 if(changed)save();
 return changed;
}
mt75RestoreFinalSectors();
"""
for suffix in ('','_OGLADACZ','_SEDZIA'):
 current=(d/f'MatchThis_MT-74{suffix}.html').read_bytes()
 assert hashlib.sha256(current).hexdigest()==source_hash[suffix],('MT74_PRODUCTION_BASE_CHANGED',suffix)
 source=(d/f'MatchThis_MT-73{suffix}.html').read_text(encoding='utf8')
 assert '<title>MatchThis MT-73</title>' in source
 # Copy only the previously verified MT74 assignments, with the identical names
 # and preserved per-competitor weight from the currently deployed final.
 old=current.decode('utf8')
 start=old.index('const MT44_MISSING_2025=')+len('const MT44_MISSING_2025=')
 old_data,n=json.JSONDecoder().raw_decode(old[start:])
 old_round=next(e for e in old_data['data']['events'] if e['id']=='mt2025-mega_final_2025')['rounds'][1]
 start=source.index('const MT44_MISSING_2025=')+len('const MT44_MISSING_2025=')
 data,n=json.JSONDecoder().raw_decode(source[start:])
 target=next(e for e in data['data']['events'] if e['id']=='mt2025-mega_final_2025')['rounds'][1]
 assert len(target['results'])==len(old_round['results'])==54
 mapping=[]
 for row in target['results']:
  original=next(x for x in old_round['results'] if x['competitorName']==row['competitorName'])
  assert row['weightG']==original['weightG'] and row.get('peg') is None and row.get('sector') is None
  assert original.get('peg') and original.get('sector')
  row['peg']=original['peg'];row['sector']=original['sector']
  mapping.append([row['competitorId'],row['competitorName'],row['weightG'],row['peg'],row['sector']])
 assert {x[1] for x in mapping}==set(names)
 source=source[:start]+json.dumps(data,ensure_ascii=False,separators=(',',':'))+source[start+n:]
 source=source.replace('MT-73','MT-75')
 assert source.count("const STORAGE_KEY='matchthis-preview-MT-75';")==1
 source=source.replace("const STORAGE_KEY='matchthis-preview-MT-75';",
                       "const STORAGE_KEY='matchthis-preview-MT-75';\nconst MT74_STORAGE_KEY='matchthis-preview-MT-74';")
 if suffix!='_OGLADACZ':
  key='localStorage.getItem(MT72_STORAGE_KEY)||'
  assert source.count(key)==1
  source=source.replace(key,'localStorage.getItem(MT74_STORAGE_KEY)||'+key)
 assert source.count("Number(k.split('-').pop())<=72")==1
 source=source.replace("Number(k.split('-').pop())<=72","Number(k.split('-').pop())<=74")
 needle='await mt73Start();'
 assert source.count(needle)==1
 patch=repair.replace('RECORDS',json.dumps(mapping,ensure_ascii=False))
 source=source.replace(needle,patch+needle+"\nif(roleMode==='admin')mt75RestoreFinalSectors();",1)
 for marker in ['<title>MatchThis MT-75</title>','data-version="MT-75"',
                "const APP_VERSION='MT-75';",'id="appversion">MT-75']:
  assert marker in source,(suffix,marker)
 for js in re.findall(r'<script(?:\\s[^>]*)?>(.*?)</script>',source,re.S):
  if js.strip():
   f=Path('/tmp/check-mt75.js');f.write_text(js)
   subprocess.run(['node','--check',str(f)],check=True)
 out=d/f'MatchThis_MT-75{suffix}.html'
 out.write_text(source,encoding='utf8')
 if not suffix:
  seed=source.replace(needle,"window.__MT75_SEED=mt73Clone(db);",1)
  assert seed!=source
  (d/'MT75_SEED.html').write_text(seed,encoding='utf8')
 print('MT75_BUILD',suffix or 'ADMIN',hashlib.sha256(out.read_bytes()).hexdigest(),out.stat().st_size)
