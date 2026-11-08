from pathlib import Path
import json,zlib,base64,hashlib
root=Path(__file__).resolve().parent
raw=zlib.decompress(base64.b64decode((root/'mt45-source-data.b64').read_text().strip()))
assert hashlib.sha256(raw).hexdigest()=='779f9e0e8043cc22e65707f881984cce84ae41ef9f6977074f8d4ec757699953'
sources=json.loads(raw.decode('utf8'))
def get(filename,cols):
    rows=[line.split('|') for line in sources[filename].splitlines() if line and not line.startswith('#')]
    assert all(len(r)==cols for r in rows)
    return rows
early=get('mega_2025_08_09.tsv',9)
third=get('mega_2025_22_03.tsv',5)
fourth=get('mega_2025_23_03.tsv',5)
assert [len(early),len(third),len(fourth)]==[79,84,82]
tables=[[],[],[],[]]
for name,p1,s1,n1,w1,p2,s2,n2,w2 in early:
    tables[0].append([name,int(p1) if p1 else None,s1 or None,float(n1),int(w1)])
    tables[1].append([name,int(p2) if p2 else None,s2 or None,float(n2),int(w2)])
for name,peg,sec,place,weight in third:
    tables[2].append([name,int(peg),sec,float(place),int(weight)])
for name,peg,sec,place,weight in fourth:
    tables[3].append([name,int(peg),sec,float(place),int(weight)])
assert [len(t) for t in tables]==[79,79,84,82]
for t in tables:
    assert len(set(x[0] for x in t))==len(t)
    pegs=sorted(x[1] for x in t if x[1] is not None)
    assert pegs==list(range(1,len(pegs)+1))
    for name,peg,sector,place,weight in t:
        assert place>=1 and weight>=0
        if place==100:assert peg is None and sector is None and weight==0
        else: assert peg is not None and sector in 'ABCDEFG'
patch="""
// MT-45: add the four fully sourced missing MEGA 2025 rounds after MT44 loading.
function mt45PopulateMega2025(){
 const c=db.cycles.find(x=>x.id==='mt2025-mega-match-this-cup-cycle');
 if(!c||!Array.isArray(c.tours)||c.tours.length!==6)return 0;
 const dates=['2025-03-08','2025-03-09','2025-03-22','2025-03-23'];
 const labels=['I tura 08.03.2025','II tura 09.03.2025','III tura 22.03.2025','IV tura 23.03.2025'];
 const byName=new Map(db.players.map(p=>[norm(fullName(p)),p]));
 let added=0;
 for(let i=0;i<4;i++){
  const tour=c.tours[i];
  if(!tour||!Array.isArray(tour.results)||tour.results.length)continue;
  const rows=MT45_MEGA_2025_ROUNDS[i];
  if(!Array.isArray(rows)||!rows.length)continue;
  for(const [name,peg,sector,officialPlace,weightG] of rows){
   const key=norm(name);
   let person=byName.get(key);
   if(!person){
    const cut=name.lastIndexOf(' ');
    const id='mt2025-mega-round-'+String(i+1)+'-'+String(peg||'absent')+'-'+String(c.entrantIds.length+1);
    person={id,lastName:name.slice(0,cut),firstName:name.slice(cut+1),club:'',aliases:[name],archived:false,source:'Protokoły MEGA 2025: 483480864, 482327295, 485954278, 485695924, 485829502, 485730865'};
    db.players.push(person);byName.set(key,person);
   }
   if(!c.entrantIds.includes(person.id))c.entrantIds.push(person.id);
   tour.results.push({competitorId:person.id,competitorName:name,sourceName:name,peg,sector,officialPlace,weightG,sourceOfficial:true,...(officialPlace===100?{absent:true}:{})});
   added++;
  }
  tour.name=labels[i];tour.date=dates[i];tour.status='FINAL';tour.sourceOfficial=true;tour.drawPublished=false;
 }
 if(added)save();return added;
}
mt45PopulateMega2025();
"""
for suffix in ('','_OGLADACZ','_SEDZIA'):
    s=(root/f'MatchThis_MT-44{suffix}.html').read_text('utf8').replace('MT-44','MT-45')
    if suffix!='_OGLADACZ':
        key="const MT43_STORAGE_KEY='matchthis-preview-MT-43';"
        assert s.count(key)==1
        s=s.replace(key,"const MT44_STORAGE_KEY='matchthis-preview-MT-44';\n"+key)
        key="localStorage.getItem(MT43_STORAGE_KEY)||"
        assert s.count(key)==1
        s=s.replace(key,"localStorage.getItem(MT44_STORAGE_KEY)||"+key)
    key='const MT44_MISSING_2025='
    assert s.count(key)==1
    s=s.replace(key,'const MT45_MEGA_2025_ROUNDS='+json.dumps(tables,ensure_ascii=False,separators=(',',':'))+';\n'+key)
    key='mt44CompleteMega2025();'
    assert s.count(key)==1
    s=s.replace(key,key+'\n'+patch)
    for check in ('<title>MatchThis MT-45</title>','aria-label="Wersja MT-45">MT-45','data-version="MT-45"', "const APP_VERSION='MT-45'"):
        assert check in s,(suffix,check)
    out=root/f'MatchThis_MT-45{suffix}.html'
    out.write_text(s,encoding='utf8')
    print('MT45_BUILT',out.name,len(s))
print('MEGA_2025_ROUND_COUNTS',[len(x) for x in tables])
