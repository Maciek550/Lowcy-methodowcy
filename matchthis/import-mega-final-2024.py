#!/usr/bin/env python3
"""Guarded official MEGA Match This CUP 2024 two-day final import, without changing 6-tour cycle."""
import collections,csv,datetime,fcntl,hashlib,json,os,pathlib,sys,tempfile,unicodedata
from copy import deepcopy

EVENT_ID='mt2024-mega-match-this-cup-final'
R1='matchthis/mega-2024-final-round1.csv'
R2='matchthis/mega-2024-final-round2.csv'
OFFICIAL_STANDINGS_SHA256='53dbc8e9a022e016696022956ae38901855c0a8348b8878db33f703196293370'
def key(s):
    return ''.join(c for c in unicodedata.normalize('NFD',str(s).upper().replace('Ł','L')) if c.isalnum())
def read_csv(path,required):
    rows=list(csv.DictReader(open(path,encoding='utf-8-sig',newline=''),delimiter=';'))
    assert rows and required<=set(rows[0]),(path,rows[0] if rows else None)
    return rows
def load_sources(root):
    a=read_csv(root/R1,{'rank','name','peg','sector','weight','place'})
    b=read_csv(root/R2,{'name','peg','sector','weight','place','source'})
    assert len(a)==60 and len(b)==59
    assert set(int(r['rank']) for r in a)==set(range(1,61))
    assert set(int(r['peg']) for r in a)==set(range(1,61))
    assert set(int(r['peg']) for r in b)==set(range(1,60))
    assert len({key(r['name']) for r in a})==60
    assert len({key(r['name']) for r in b})==59
    assert set(key(r['name']) for r in a)-set(key(r['name']) for r in b)=={key('LISIAK MARCIN')}
    assert not(set(key(r['name']) for r in b)-set(key(r['name']) for r in a))
    assert sum(int(r['weight']) for r in a)==480935
    assert sum(int(r['weight']) for r in b)==485055
    for t,rows in enumerate((a,b),start=1):
        for sector in 'ABCDEF':
            grp=[r for r in rows if r['sector']==sector]
            assert len(grp)==(9 if t==2 and sector=='F' else 10),(t,sector,len(grp))
            for r in grp:
                w=int(r['weight'])
                place=1+sum(int(o['weight'])>w for o in grp)+sum(o is not r and int(o['weight'])==w for o in grp)/2
                assert place==float(r['place']),(t,sector,r,place)
    bmap={key(r['name']):r for r in b}
    ranked=sorted(a,key=lambda r:(int(r['place'])+int(bmap[key(r['name'])]['place']) if key(r['name']) in bmap else 108,-int(r['weight'])-int(bmap[key(r['name'])]['weight']) if key(r['name']) in bmap else -int(r['weight'])))
    actual_hash=hashlib.sha256('\n'.join(key(r['name']) for r in ranked).encode()).hexdigest()
    assert actual_hash==OFFICIAL_STANDINGS_SHA256,'Final overall classification ranks do not match official pages 628-630'
    assert [key(r['name']) for r in ranked[:3]]==[key(x) for x in ('KUCHCIAK KONRAD','SOBOLEWSKI BARTŁOMIEJ','RZEPCZYŃSKI MARCIN')]
    assert key(ranked[-1]['name'])==key('LISIAK MARCIN')
    return a,b
def build(data,root=pathlib.Path('.')):
    a,b=load_sources(root)
    people={p['id']:p for p in data['players']}
    by_name=collections.defaultdict(set)
    for pid,p in people.items():
        for n in [p['lastName']+' '+p['firstName']]+p.get('aliases',[]):
            by_name[key(n)].add(pid)
    new=[];all_id={}
    for r in a:
        name=r['name'];nk=key(name);ids=set(by_name[nk])
        if len(ids)>1:
            canonical={i for i in ids if (people[i]['lastName']+' '+people[i]['firstName']).upper()==name.upper()}
            if len(canonical)==1:ids=canonical
            elif name=='WOLAMIN ANDRZEJ':
                canonical={i for i in ids if (people[i]['lastName']+' '+people[i]['firstName']).upper()=='WOLAMIN ANDRZEJ'}
                assert len(canonical)==1,('Ambiguous Wolamin identity',ids)
                ids=canonical
            else:raise AssertionError('Ambiguous athlete identity '+name+' '+str(ids))
        if not ids:
            last,first=name.split(' ',1)
            pid='mt2024-mega-final-'+nk.lower()
            assert pid not in people
            p=dict(id=pid,lastName=last,firstName=first,aliases=[name],archived=False,nameNeedsReview=False)
            people[pid]=p;new.append(p);by_name[nk].add(pid);ids={pid}
        assert len(ids)==1
        all_id[nk]=next(iter(ids))
    assert len(set(all_id.values()))==60,'Two different athletes resolve to one profile'
    rounds=[]
    for i,src in enumerate((a,b),start=1):
        results=[]
        for row in src:
            pid=all_id[key(row['name'])];p=people[pid]
            results.append(dict(competitorId=pid,competitorName=p['lastName']+' '+p['firstName'],
                sector=row['sector'],peg=int(row['peg']),weightG=int(row['weight']),officialPlace=float(row['place'])))
        if i==2:
            pid=all_id[key('LISIAK MARCIN')];p=people[pid]
            results.append(dict(competitorId=pid,competitorName=p['lastName']+' '+p['firstName'],
                sector='',peg=None,weightG=0,officialPlace=100.0,absent=True))
        assert len(results)==60 and len({r['competitorId'] for r in results})==60
        rounds.append(dict(id=EVENT_ID+'-round-'+str(i),name=('I tura' if i==1 else 'II tura'),
            date=('2024-10-25' if i==1 else '2024-10-26'),status='FINAL',sourceOfficial=True,
            sectorCount=6,results=results))
    event=dict(id=EVENT_ID,name='Finał MEGA Match This CUP 2024 — 25–26.10.2024',date='2024-10-25',year=2024,
        kind='EVENT',archived=True,
        source=('Oficjalne wyniki finału 626–630, karty i losowania 222–241. I tura: 60 startów, 480935 g, '
          'II tura: 59 startów, 485055 g oraz LISIAK MARCIN DNS, 0 g i kara 100 punktów. '
          'Oficjalna klasyfikacja po dwóch turach: 60 zawodników, zgodne wszystkie pozycje 1–60. '
          'Rozbieżność dat: tabela wyników 25–26.10.2024, terminarz 26–27.10.2024; '
          'zachowano daty z protokołu wyników.'),
        rounds=rounds)
    return event,new
def atomic(path,obj):
    fd,temp=tempfile.mkstemp(dir=path.parent,prefix='.mega-final-2024-')
    try:
        with os.fdopen(fd,'w',encoding='utf8') as f:
            json.dump(obj,f,ensure_ascii=False,separators=(',',':'));f.flush();os.fsync(f.fileno())
        os.chmod(temp,0o600);os.replace(temp,path)
    finally:
        if os.path.exists(temp):os.unlink(temp)
def run(private,root):
    assert private.name=='.mt41-private'
    path=private/'state-mt73.json'
    assert path.is_file() and not path.is_symlink()
    with (private/'mt73.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        before=json.loads(path.read_bytes())
        event,new=build(before['data'],root)
        existing=[e for e in before['data']['events'] if e['id']==EVENT_ID]
        if existing:
            assert len(existing)==1 and existing[0]==event and not new,'Existing record differs; no overwrite'
            print('ALREADY PUBLISHED AND IDENTICAL');return
        assert not any('FINAŁ MEGA' in e.get('name','').upper() and e.get('year')==2024 for e in before['data']['events'])
        after=deepcopy(before)
        after['data']['players'].extend(new)
        after['data']['events'].append(event)
        after['revision']+=1;after['seeded']=False
        after['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
        hist=private/'mt73-history';hist.mkdir(mode=0o700,exist_ok=True)
        backup=hist/('before-mega-final-2024-r%d.json'%before['revision'])
        if backup.exists():assert json.loads(backup.read_bytes())==before
        else:atomic(backup,before)
        assert json.loads(backup.read_bytes())==before
        atomic(path,after);assert json.loads(path.read_bytes())==after
        print('SAVED: MEGA 2024 FINAL 60+59 starters + DNS, 6 sectors each, 60 histories; new profiles',len(new))
if __name__=='__main__':run(pathlib.Path(sys.argv[1]),pathlib.Path(sys.argv[2]) if len(sys.argv)>2 else pathlib.Path('.'))
