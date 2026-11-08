from pathlib import Path
import json,zlib,base64,hashlib,collections,re
root=Path(__file__).resolve().parent
raw=zlib.decompress(base64.b64decode((root/'mt44-source-data.b64').read_text().strip()))
assert hashlib.sha256(raw).hexdigest()=='ff938e72207d42438942b463819763e89669cdb527ae38b6ae2b0d12834902ac'
source=json.loads(raw.decode('utf8'))
def rows(file,columns):
    r=[s.split('|') for s in source[file].splitlines() if s and not s.startswith('#')]
    assert all(len(x)==columns for x in r)
    return r
def new_event(key,title,d1,d2,files,pegfile=None,kind='EVENT'):
    records=rows(key+'.tsv',5)
    assert len(set(x[0] for x in records))==len(records)
    assert records==sorted(records,key=lambda r:(float(r[1])+float(r[3]),-int(r[2])-int(r[4])))
    pegs={x[0]:(int(x[1]),x[2]) for x in rows(pegfile,3)} if pegfile else {}
    if pegfile:
        assert len(pegs)==len(records) and set(pegs)==set(x[0] for x in records)
    players=[];tours=[[],[]]
    for i,(name,p1,w1,p2,w2) in enumerate(records,1):
        pid='mt2025-'+key+'-person-'+str(i)
        last,first=name.rsplit(' ',1)
        players.append(dict(id=pid,lastName=last,firstName=first,aliases=[name],club='',archived=False,source=files))
        for j,(points,weight) in enumerate(((p1,w1),(p2,w2))):
            peg,sec=pegs[name] if j==0 and pegfile else (None,None)
            r=dict(competitorId=pid,competitorName=name,sourceName=name,sector=sec,peg=peg,weightG=int(weight),officialPlace=float(points),sourceOfficial=True)
            if float(points)==100:r['absent']=True
            tours[j].append(r)
    eid='mt2025-'+key
    e=dict(id=eid,name=title,kind=kind,year=2025,date=d2,archived=True,source=files,entrantIds=[x['id'] for x in players],rounds=[
      dict(id=eid+'-round1',name='I tura '+d1,date=d1,status='FINAL',sourceOfficial=True,drawPublished=False,results=tours[0]),
      dict(id=eid+'-round2',name='II tura '+d2,date=d2,status='FINAL',sourceOfficial=True,drawPublished=False,results=tours[1])])
    return players,e
inputs=[
('float_king_2025','FLOAT KING 2025 — 10–11.11.2025','2025-11-10','2025-11-11','580530160, 580551068; I tura stanowiska: 579990314, 580507114','float_king_round1_pegs.tsv','EVENT'),
('matchthis_puchar_2025','XIII PUCHAR SKLEPU INTERNETOWEGO MATCHTHIS.PL 2025 — 22–23.11.2025','2025-11-22','2025-11-23','586534426, 588498775, 585357300 (brak potwierdzonego losowania)',None,'EVENT'),
('champions_2025','CHAMPIONS LEAGUE FLOAT RS 2025 — 13–14.12.2025','2025-12-13','2025-12-14','596578939, 598885571 (brak potwierdzonego losowania)',None,'EVENT'),
('mega_final_2025','MEGA MATCH THIS CUP 2025 — FINAŁ 25–26.10.2025','2025-10-25','2025-10-26','571785847, 571323873 (brak kompletnego losowania)',None,'FINAL')]
players=[];events=[]
for a in inputs:
    ps,e=new_event(*a);players.extend(ps);events.append(e)
assert [len(e['entrantIds']) for e in events]==[71,77,60,54]
v=[];vi=[]
for file,out in [('mega_2025_v_extra.tsv',v),('mega_2025_vi.tsv',vi)]:
    for n,peg,sector,rank,weight in rows(file,5):
        out.append([n,int(peg),sector,float(rank),int(weight)])
assert len(v)==20 and len(vi)==52
assert collections.Counter(x[2] for x in v)=={'D':10,'E':10}
assert collections.Counter(x[2] for x in vi)=={'A':11,'B':11,'C':10,'D':10,'E':10}
assert len({x[1] for x in v})==20 and len({x[1] for x in vi})==52
data={'format':'matchthis-integration-preview-1','data':{'players':players,'events':events,'cycles':[]}}
patch="""
// MT-44: import only absent events, preserving archived competitions and existing edits.
for(const event of MT44_MISSING_2025.data.events){
 if(!db.events.some(e=>e.id===event.id))
  mergeDatabase({players:MT44_MISSING_2025.data.players,events:[event],cycles:[]});
}
// MEGA 2025: add 20 sourced V-tour results in D/E and 52 VI-tour results;
// keep empty I-IV until their original full results are confirmed.
function mt44CompleteMega2025(){
 const c=db.cycles.find(x=>x.id==='mt2025-mega-match-this-cup-cycle');
 if(!c||!Array.isArray(c.tours)||c.tours.length!==6)return 0;
 const fifth=c.tours[4],sixth=c.tours[5];
 if(fifth.date!=='2025-09-27'||!Array.isArray(fifth.results)||!Array.isArray(sixth.results))return 0;
 if(sixth.results.length&&sixth.date!=='2025-09-28')return 0;
 const byName=new Map(db.players.map(p=>[norm(fullName(p)),p]));
 let added=0;
 function addRow(tour,entry){
  const [name,peg,sector,officialPlace,weightG]=entry;
  const key=norm(name);
  if(tour.results.some(r=>norm(r.competitorName||'')===key||Number(r.peg)===peg))return;
  let p=byName.get(key);
  if(!p){
   const idx=name.lastIndexOf(' ');
   const id='mt2025-mega-extra-'+String(peg)+'-'+String(c.tours.indexOf(tour)+1);
   p={id,lastName:name.slice(0,idx),firstName:name.slice(idx+1),club:'',aliases:[name],archived:false,source:'Arkusze 555759292/556845297/556918791'};
   db.players.push(p);byName.set(key,p);
  }
  if(!c.entrantIds.includes(p.id))c.entrantIds.push(p.id);
  tour.results.push({competitorId:p.id,competitorName:name,sourceName:name,peg,sector,officialPlace,weightG,sourceOfficial:true});
  added++;
 }
 for(const r of MT44_MEGA_2025.vExtra)addRow(fifth,r);
 if(!sixth.results.length){
  sixth.date='2025-09-28';sixth.name='VI tura 28.09.2025';sixth.status='FINAL';sixth.sourceOfficial=true;sixth.drawPublished=false;
  for(const r of MT44_MEGA_2025.vi)addRow(sixth,r);
 }
 if(added)save();
 return added;
}
mt44CompleteMega2025();
"""
for suffix in ('','_OGLADACZ','_SEDZIA'):
    base=(root/f'MatchThis_MT-43{suffix}.html').read_text('utf8')
    s=base.replace('MT-43','MT-44')
    if suffix!='_OGLADACZ':
        m="const MT42_STORAGE_KEY='matchthis-preview-MT-42';"
        assert s.count(m)==1
        s=s.replace(m,"const MT43_STORAGE_KEY='matchthis-preview-MT-43';\n"+m)
        m="localStorage.getItem(MT42_STORAGE_KEY)||"
        assert s.count(m)==1
        s=s.replace(m,"localStorage.getItem(MT43_STORAGE_KEY)||"+m)
    m='const MATCHTHIS_ARCHIVE_2025_MAVER_OCT='
    assert s.count(m)==1
    s=s.replace(m,'const MT44_MISSING_2025='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\nconst MT44_MEGA_2025='+json.dumps({'vExtra':v,'vi':vi},ensure_ascii=False,separators=(',',':'))+';\n'+m)
    m='mt43ApplyMaverSecondRoundDraw();'
    assert s.count(m)==1
    s=s.replace(m,m+'\n'+patch)
    for check in ('<title>MatchThis MT-44</title>','aria-label="Wersja MT-44">MT-44','data-version="MT-44"', "const APP_VERSION='MT-44'"):
        assert check in s,(suffix,check)
    (root/f'MatchThis_MT-44{suffix}.html').write_text(s,encoding='utf8')
    print('BUILT',suffix,len(s))
print('MT44',*[f'{e["id"]}:{len(e["entrantIds"])}' for e in events], 'MEGA_V_EXTRA',len(v),'MEGA_VI',len(vi))
