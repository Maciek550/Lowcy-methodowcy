#!/usr/bin/env python3
"""Single incremental MEGA Match This CUP 2024 cycle import: source photographs 606,607, handwritten 76."""
import collections, csv, datetime, fcntl, json, os, pathlib, sys, tempfile, unicodedata
from copy import deepcopy

CYCLE_ID='mt2024-mega-match-this-cup-cycle'
TOUR_ID='mt2024-mega-cycle-tour-1'
SOURCE=pathlib.Path(__file__).with_name('mega-2024-tour1.csv')

def key(text):
    return ''.join(c for c in unicodedata.normalize('NFD',str(text).upper().replace('Ł','L')) if c.isalnum())

def load_source():
    with SOURCE.open(encoding='utf-8-sig',newline='') as f:
        r=list(csv.DictReader(f,delimiter=';'))
    assert len(r)==79,('79 records required',len(r))
    assert [int(row['rank']) for row in r]==list(range(1,80))
    assert set(row['sector'] for row in r)==set('ABCDEFG')
    assert set(int(row['peg']) for row in r)==set(range(1,80))
    assert len({key(row['name']) for row in r})==79
    assert sum(int(row['weight']) for row in r)==624345
    assert sum(float(row['place']) for row in r)==486
    sector_peg_limits={'A':(1,12),'B':(13,24),'C':(25,35),'D':(36,46),'E':(47,57),'F':(58,68),'G':(69,79)}
    for sector,(low,high) in sector_peg_limits.items():
        sr=[x for x in r if x['sector']==sector]
        assert {int(x['peg']) for x in sr}==set(range(low,high+1))
        for x in sr:
            w=int(x['weight'])
            expected=1+sum(int(o['weight'])>w for o in sr)+sum(o is not x and int(o['weight'])==w for o in sr)/2
            assert expected==float(x['place']),('official place does not match weight',x)
    kalmus=next(x for x in r if x['name']=='KALMUS ŁUKASZ')
    assert (kalmus['sector'],int(kalmus['peg']),int(kalmus['weight']),float(kalmus['place']))==('A',12,12710,1)
    tied=[x for x in r if x['sector']=='F' and int(x['weight'])==4885]
    assert {x['name'] for x in tied}=={'BEDNAREK ANDRZEJ','SMAL MARIUSZ'}
    assert all(float(x['place'])==5.5 for x in tied)
    return r

def build(data):
    source=load_source()
    assert all(c.get('id')!=CYCLE_ID for c in data['cycles']), 'CYCLE_ID already used: inspect instead of overwriting'
    assert all(not (c.get('year')==2024 and 'MEGA' in c.get('name','').upper() and 'MATCH' in c.get('name','').upper()) for c in data['cycles']), 'Existing 2024 MEGA cycle needs reconciliation'
    by_id={p['id']:p for p in data['players']}
    by_name=collections.defaultdict(set)
    for pid,p in by_id.items():
        for name in [p['lastName']+' '+p['firstName']]+p.get('aliases',[]):
            by_name[key(name)].add(pid)
    additions=[];rows=[]
    for src in source:
        name=src['name']
        ids=set(by_name[key(name)])
        if ids:
            exact={i for i in ids if (by_id[i]['lastName']+' '+by_id[i]['firstName']).upper()==name.upper()}
            if exact:
                assert len(exact)==1,('Non-unique exact canonical profile',name,exact)
                ids=exact
            else:
                assert len(ids)==1,('Alias matches more than one profile',name,ids)
        if not ids:
            parts=name.split()
            assert len(parts)>=2
            lastname,firstname=parts[0],' '.join(parts[1:])
            pid='mt2024-mega-'+key(name).lower()
            assert pid not in by_id
            new={'id':pid,'lastName':lastname,'firstName':firstname,'aliases':[name],'archived':False,'nameNeedsReview':False}
            by_id[pid]=new;additions.append(new);by_name[key(name)].add(pid);ids={pid}
        assert len(ids)==1
        pid=next(iter(ids));p=by_id[pid]
        rows.append({'competitorId':pid,'competitorName':p['lastName']+' '+p['firstName'],'sector':src['sector'],
                     'peg':int(src['peg']),'weightG':int(src['weight']),'officialPlace':float(src['place'])})
    assert len({r['competitorId'] for r in rows})==79
    assert len(rows)==79
    tour={'id':TOUR_ID,'name':'I tura — Puchar MK FISHING (24.02.2024)','date':'2024-02-24','status':'FINAL',
          'sourceOfficial':True,'sectorCount':7,'results':rows}
    cycle={'id':CYCLE_ID,'name':'MEGA Match This CUP 2024','year':2024,'date':'2024-10-13','archived':True,
        'kind':'CYCLE','expectedTours':6,'countedTours':4,'tours':[tour],
        'source':'I tura: oficjalne tabele wyników 606–607 oraz karty sektorowe 71–81 z 24.02.2024. Korekta literówki: Kalmus Łukasz, stanowisko 12 to sektor A według karty 76 (wydruk 607 mylnie B).'}
    return cycle,additions

def atomic(path,data):
    fd,p=tempfile.mkstemp(prefix='.mega24-',dir=path.parent)
    try:
        with os.fdopen(fd,'w',encoding='utf8') as f:
            json.dump(data,f,ensure_ascii=False,separators=(',',':'));f.flush();os.fsync(f.fileno())
        os.chmod(p,0o600)
        os.replace(p,path)
    finally:
        if os.path.exists(p):os.unlink(p)

def run(private):
    path=private/'state-mt73.json'
    assert private.name=='.mt41-private' and path.is_file() and not path.is_symlink()
    with (private/'mt73.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        before=json.loads(path.read_bytes())
        d=before['data']
        old=[x for x in d['cycles'] if x.get('id')==CYCLE_ID]
        if old:
            assert len(old)==1
            assert len(old[0]['tours'])>=1 and old[0]['tours'][0]['id']==TOUR_ID
            print('ALREADY PRESENT. No mutation. Must independently verify rows.')
            return
        cycle,new=build(d)
        after=deepcopy(before)
        after['data']['players'].extend(new)
        after['data']['cycles'].append(cycle)
        after['revision']+=1
        after['seeded']=False
        after['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
        backup_dir=private/'mt73-history'
        backup_dir.mkdir(mode=0o700,exist_ok=True)
        backup=backup_dir/('before-mega-2024-tour1-r%d.json'%before['revision'])
        if backup.exists():assert json.loads(backup.read_bytes())==before
        else:atomic(backup,before)
        assert json.loads(backup.read_bytes())==before
        atomic(path,after)
        assert json.loads(path.read_bytes())==after
        print('SAVED: one MEGA 2024 cycle, 79 first-round rows, 7 sectors, new player profiles',len(new))

if __name__=='__main__':run(pathlib.Path(sys.argv[1]))
