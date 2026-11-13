from pathlib import Path
import json,re,hashlib,subprocess
D=Path('matchthis'); names=json.loads((D/'mt74-final-pegs.json').read_text());assert len(names)==len(set(names))==54
hashes=['8bc8f99c4e6559cb123178aa4c0e017b6c3cc8772147d66b9ce9c37985bee660','eea8eec389f8f4a586444765740965180a244a3b3a6833f5742e59681400a845','0896badb55553196778b48a294439a32445aeb7a7b6140afff2ffdfc8d145fac']
for role,sha in zip(['','_OGLADACZ','_SEDZIA'],hashes):
 s=(D/f'MatchThis_MT-72{role}.html').read_text();assert hashlib.sha256(s.encode()).hexdigest()==sha
 start=s.index('const MT44_MISSING_2025=')+len('const MT44_MISSING_2025=');data,n=json.JSONDecoder().raw_decode(s[start:]);e=next(e for e in data['data']['events'] if e['id']=='mt2025-mega_final_2025');t=e['rounds'][1];assert t['date']=='2025-10-26';assert set(r['competitorName'] for r in t['results'])==set(names)
 mappings=[]
 for r in t['results']:
  assert r.get('sector') is None and r.get('peg') is None
  p=names.index(r['competitorName'])+1;r['peg']=p;r['sector']=chr(65+(p-1)//9);mappings.append([r['competitorId'],r['competitorName'],r['weightG'],p,r['sector']])
 s=s[:start]+json.dumps(data,ensure_ascii=False,separators=(',',':'))+s[start+n:]
 patch='''\n// MT74: confirmed final 26.10.2025, sources 570110965,571030048 and six handwritten A-F cards.
const MT74_FINAL_ASSIGNMENTS=MAP;
function mt74RestoreFinalSectors(){
 const e=db.events.find(x=>x.id==='mt2025-mega_final_2025');
 const t=e?.rounds?.find(x=>x.id==='mt2025-mega_final_2025-round2'&&x.date==='2025-10-26');
 if(!t)return;
 let changed=false;
 for(const [id,name,weight,peg,sector] of MT74_FINAL_ASSIGNMENTS){
  const rows=t.results.filter(x=>x.competitorName===name&&Number(x.weightG)===weight);
  if(rows.length!==1)continue;
  const r=rows[0];if(!r.sector&&!r.peg){r.sector=sector;r.peg=peg;changed=true;}
 }
 if(changed)save();
}
mt74RestoreFinalSectors();
'''.replace('MAP',json.dumps(mappings,ensure_ascii=False))
 anchor='// MT-26: persist a non-destructive snapshot';assert s.count(anchor)==1;s=s.replace(anchor,patch+'\n'+anchor)
 s=s.replace('MT-72','MT-74');s=s.replace("const STORAGE_KEY='matchthis-preview-MT-74';","const STORAGE_KEY='matchthis-preview-MT-74';\nconst MT72_STORAGE_KEY='matchthis-preview-MT-72';")
 if role!='_OGLADACZ':
  a='localStorage.getItem(MT71_STORAGE_KEY)||';assert s.count(a)==1;s=s.replace(a,'localStorage.getItem(MT72_STORAGE_KEY)||'+a)
 for marker in ['<title>MatchThis MT-74</title>','data-version="MT-74"','aria-label="Wersja MT-74">MT-74',"const APP_VERSION='MT-74';",'<div class="version" id="appversion">MT-74</div>']:assert marker in s
 for i,js in enumerate(re.findall(r'<script[^>]*>(.*?)</script>',s,re.S)):
  tmp=Path('/tmp/mt74-script.js');tmp.write_text(js);subprocess.run(['node','--check',str(tmp)],check=True)
 out=D/f'MatchThis_MT-74{role}.html';out.write_text(s);print(out,hashlib.sha256(out.read_bytes()).hexdigest())
