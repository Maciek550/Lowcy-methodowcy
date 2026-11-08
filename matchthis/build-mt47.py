from pathlib import Path
import json,unicodedata,collections
root=Path(__file__).resolve().parent
def norm(x):
 return ''.join(c for c in unicodedata.normalize('NFKD',x.upper().replace('Ł','L')) if not unicodedata.combining(c) and c.isalnum())
draw={}
for line in (root/'mt47_puchar_2025_round2_draw.tsv').read_text('utf8').splitlines():
 if not line or line.startswith('#'):continue
 p,s,name=line.split('|');p=int(p);key=norm(name)
 assert key not in draw,(name,p)
 assert s in 'ABCDEF'
 draw[key]=(p,s)
assert len(draw)==66
assert sorted(v[0] for v in draw.values())==list(range(1,67))
assert collections.Counter(v[1] for v in draw.values())=={x:11 for x in 'ABCDEF'}
patch="""
// MT-47: 23.11.2025 XIII Puchar round II — sourced 66 stations A–F only.
// 11 absent contestants remain without peg/sector and retain 100 points.
function mt47ApplyPucharRoundTwoDraw(){
 const event=db.events.find(x=>x.id==='mt2025-matchthis_puchar_2025');
 const round=event?.rounds?.find(t=>t.date==='2025-11-23');
 if(!round||round.results?.length!==77)return 0;
 const map=new Map(MT47_PUCHAR_ROUND2_DRAW.map(([name,peg,sector,weight,place])=>[norm(name),{peg,sector,weight,place}]));
 if(map.size!==66)return 0;
 const found=new Set(),nonparticipants=[];
 for(const row of round.results){
  const key=norm(row.competitorName||'');
  const d=map.get(key);
  if(!d){
   if(row.absent!==true||Number(row.weightG)!==0||Number(row.officialPlace)!==100||row.peg!=null||row.sector!=null)return 0;
   nonparticipants.push(key);
   continue;
  }
  if(found.has(key)||Number(row.weightG)!==d.weight||Number(row.officialPlace)!==d.place)return 0;
  if(row.peg!=null&&Number(row.peg)!==d.peg)return 0;
  if(row.sector!=null&&row.sector!=='—'&&row.sector!==d.sector)return 0;
  found.add(key);
 }
 if(found.size!==66||nonparticipants.length!==11||new Set(nonparticipants).size!==11)return 0;
 let changed=0;
 for(const row of round.results){
  const d=map.get(norm(row.competitorName||''));
  if(!d)continue;
  if(row.peg==null||row.sector==null||row.sector==='—'){
   row.peg=d.peg;row.sector=d.sector;
   row.sectorSource='23.11.2025, II tura XIII Puchar: dwie karty losowania, 66 stanowisk A–F.';
   changed++;
  }
 }
 if(changed)save();
 return changed;
}
mt47ApplyPucharRoundTwoDraw();
"""
for suffix in ('','_OGLADACZ','_SEDZIA'):
 original=(root/f'MatchThis_MT-46{suffix}.html').read_text('utf8')
 s=original.replace('MT-46','MT-47')
 marker='const MT44_MISSING_2025='
 assert s.count(marker)==1
 a,tail=s.split(marker,1)
 raw,b=tail.split(';\n',1)
 dataset=json.loads(raw)
 assert len(dataset['data']['events'])==4
 event=next(e for e in dataset['data']['events'] if e['id']=='mt2025-matchthis_puchar_2025')
 r1,r2=event['rounds']
 assert r2['date']=='2025-11-23' and len(r2['results'])==77
 assert all(r['peg'] is None and r['sector'] is None for r in r2['results'])
 assert len(r1['results'])==77 and all(r['peg'] is not None and r['sector'] in 'ABCDEFG' for r in r1['results'])
 existing={norm(r['competitorName']):r for r in r2['results']}
 assert len(existing)==77
 assert set(draw).issubset(set(existing)),('unknown source',set(draw)-set(existing))
 assert len(set(existing)-set(draw))==11
 for key,r in existing.items():
  if key in draw:
   assert not r.get('absent'),('draw shows absent competitor',r['competitorName'])
   r['peg'],r['sector']=draw[key]
   r['sectorSource']='23.11.2025 II tura: arkusze losowania 1–66, A–F, użytkownik 08.11.2026.'
  else:
   assert r.get('absent') and r['weightG']==0 and r['officialPlace']==100,(key,'not absent')
   assert r['peg'] is None and r['sector'] is None
 s=a+marker+json.dumps(dataset,ensure_ascii=False,separators=(',',':'))+';\n'+b
 if suffix!='_OGLADACZ':
  key="const MT45_STORAGE_KEY='matchthis-preview-MT-45';"
  assert s.count(key)==1,(suffix,'storage key')
  s=s.replace(key,"const MT46_STORAGE_KEY='matchthis-preview-MT-46';\n"+key)
  key='localStorage.getItem(MT45_STORAGE_KEY)||'
  assert s.count(key)==1,(suffix,'migration')
  s=s.replace(key,'localStorage.getItem(MT46_STORAGE_KEY)||'+key)
 declaration='const MT47_PUCHAR_ROUND2_DRAW='+json.dumps([[r['competitorName'],r['peg'],r['sector'],r['weightG'],r['officialPlace']] for r in r2['results'] if r['peg'] is not None],ensure_ascii=False,separators=(',',':'))+';\n'
 key='mt46ApplyPucharRoundOneDraw();'
 assert s.count(key)==1,(suffix,'runtime anchor')
 s=s.replace(key,declaration+key+'\n'+patch)
 for version_check in ('<title>MatchThis MT-47</title>','aria-label="Wersja MT-47">MT-47','data-version="MT-47"', "const APP_VERSION='MT-47'"):
  assert version_check in s,(suffix,version_check)
 out=root/f'MatchThis_MT-47{suffix}.html'
 out.write_text(s,encoding='utf8')
 print('MT47_BUILT',out.name,out.stat().st_size,'R2_ASSIGNED',len(draw),'R2_ABSENT',len(existing)-len(draw))
print('MT47_FINISHED_R2_A-F_11_EACH_AND_11_ABSENT_NONSOURCE_DATA_UNCHANGED')
