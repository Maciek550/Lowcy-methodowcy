#!/usr/bin/env python3
"""Append photographed 2024 MEGA CUP round V only. Preserve the published first round and all historic data."""
import collections,csv,datetime,fcntl,json,os,pathlib,sys,tempfile,unicodedata,base64,zlib,hashlib
from copy import deepcopy
from io import StringIO

CYCLE_ID='mt2024-mega-match-this-cup-cycle'
TOUR_ID='mt2024-mega-cycle-tour-5'
SOURCE_BYTES=zlib.decompress(base64.b64decode('eNpVVcuO20YQvM9X8BM4Lz7Qp+FD2hEpjkBSEMTbwlg4QRLHcAzkvFjA32D4V3xd/leqh1p5c5Oma3q6q6qbXx4//UGfHv96on+ePnz9+wt9fvpI/z79/vG3r/T5z8cPT0LSNLvJuy5Zn8+dmxZyJMnmqSUrFNVt3x4S14zeDYgo0qW0VAhNXbi4fup8cnRj7TmoSaqsSEkKQxc/hylxY+caf45JDSlVWECEpfXHxQ9u5NvduFynZQ47QCwZnaeUiYy6o29fvyWX9Tk0i8efkXNkeF5ZykWO5+ekCvvz0a/PiOSklUb2VBQ0haperusLp6/cOCMHEhyAKkgXMqVSlPT67eK79dkljRt82yNYUs7VKwHEtNTL6/dpuHJ3twZwLHM0L7WQkk7j9eimZAxVO84clZRZiw6EVOT6doeSw8XXC2doO0YoynKdEq5rqpczMgwuOfkwjxzVpNMUT0ghDbqrH9zWwX5c2n1A+xUhYPNIMMrozic/vWVHzIJfud3P6OjxeBQHPya0eWEI6JMp0yfB33m8k/TWIyDg0aIKK2RBoCd0tzSbxgAUpBhQClnS4tsjyItdNr9ylKTygk2iUkL11+otR80qVIRjrTILnZWk3kfz3R/AkbYF86gUndw0I2nnkjkcXcyOU8s8KaE0W3e43b49jkPDImmhYEIYu2/j45dwwOv1A0PgRLYZvAIvsf9qAH5ZFQiIbHVUWmXUhCqA6Id2GK/MNI6U5PsogXmEUtHJ03I9hoFqdA+MYo5UQTtX+QOkhODdnSRgCrxvtyfKWMT60w0bUVEvWHZkXLnxjWJhnct1ClzsbnRDDfWhfA3boB6eLCm0xGjB66AFnHVuDD0DJBmVMycalLa+T9wwOA4o6JnGTrSmyvW+S4YwRkcjCkcaFYfdUJTZNeE4Ra7mMxeHc5lG0wqwBZ5guhB3wuZqIPBqkfMq0Rn1bdUOmPX2MMS5DJEJBHRh2Q0659E9Rz907uhj7TkVWcZy64IO0JMd6yD4vsGQbV3wVIOEXOgSkDHunVuBJZnUpjCTSQmsnlycx7llERrENi9pYSTtQ4ObJ3dpsVAQA2mlYR8abMGH1+/YRiAGW6vhqCJjcp4TowkDeno/S2xkQDTGHfQpYQy2BcbgGqm5ORkAs8mSCTzThfE6b/Ivld8z3QwBfbnl1gx82I7n9UcSPb+NNAAZFNRRQQP2jq6/zwKCGGapo3cMtuKMOnvU2b1rEtRlhiU2JVW+XV/exUrKihK2EihgdNjC8Fss8A5BIM5qKWzk7zzchEdIYsiyuI6s2r4V8en7HLZk+WMCCQphNW5P82auGz+Iw3+62FLwRuxh6gDrNujjwHED3bfXLe3C+jxfh5vyCGYgLwqEX11YPI/NwXXnioO3LQdi8HNyvasf7rZAGK5RBX+HLJZgWF9OLqnbxY1XBNFTJuOCAayCDOvP9vA/XoDBBzSLtgN6cbcVdF/kACgsgO1jmPEHuN3FDQF+7t1nWGQqY+kBdgOGBcP51l1mKOf7uK5pxqkbztPblwxhKBo3gvgP3YkW2Q=='))
assert hashlib.sha256(SOURCE_BYTES).hexdigest()=='61d36c04d744a2e9d91340c911f8b153e6a4498514d9476020db2e4831476e84'
SOURCE_TEXT=SOURCE_BYTES.decode('utf-8')

def key(t):
    return ''.join(c for c in unicodedata.normalize('NFD',str(t).upper().replace('Ł','L')) if c.isalnum())

def load_source():
    src=list(csv.DictReader(StringIO(SOURCE_TEXT),delimiter=';'))
    assert len(src)==63
    assert [int(x['rank']) for x in src]==list(range(1,64))
    assert len({key(x['name']) for x in src})==63
    assert {int(x['peg']) for x in src}==(set(range(1,66))-{55,58})
    assert sum(int(x['weight']) for x in src)==269400
    assert sum(float(x['place']) for x in src)==429
    limits={'A':(1,13),'B':(14,26),'C':(27,39),'D':(40,51),'E':(52,65)}
    for sec,(low,high) in limits.items():
        members=[x for x in src if x['sector']==sec]
        expected=set(range(low,high+1))-{55,58}
        assert {int(x['peg']) for x in members}==expected,(sec,len(members))
        for r in members:
            w=int(r['weight'])
            place=1+sum(int(o['weight'])>w for o in members)+sum(o is not r and int(o['weight'])==w for o in members)/2
            assert place==float(r['place']),('sector placement mismatch',r,place)
    assert any(x['name']=='KOWALSKI MARCIN' and x['sector']=='A' and x['peg']=='3' and x['weight']=='12680' and x['place']=='1' for x in src)
    assert any(x['name']=='KOT BOGUMIŁ' and x['sector']=='A' and x['peg']=='7' and x['weight']=='3235' and x['place']=='10' for x in src)
    return src

def build(data):
    candidates=[c for c in data['cycles'] if c['id']==CYCLE_ID]
    assert len(candidates)==1,'Cannot append: existing source cycle not unique'
    cycle=candidates[0]
    assert cycle['year']==2024 and cycle['countedTours']==4 and cycle['expectedTours']==6
    assert len(cycle['tours'])==4 and [t['id'] for t in cycle['tours']]==['mt2024-mega-cycle-tour-1','mt2024-mega-cycle-tour-2','mt2024-mega-cycle-tour-3','mt2024-mega-cycle-tour-4']
    prior=cycle['tours'][0]
    assert prior['status']=='FINAL' and len(prior['results'])==79
    assert sum(r['weightG'] for r in prior['results'])==624345
    assert len({r['competitorId'] for r in prior['results']})==79
    assert not any(t['id']==TOUR_ID for t in cycle['tours'])
    by_id={p['id']:p for p in data['players']}
    by_name=collections.defaultdict(set)
    for pid,p in by_id.items():
        for n in [p['lastName']+' '+p['firstName']]+p.get('aliases',[]):by_name[key(n)].add(pid)
    new=[];results=[]
    for r in load_source():
        name=r['name'];ids=set(by_name[key(name)])
        if name=='CHĘĆ BERNARD' and not ids:
            ids=set(by_name[key('BERNARD CHĘĆ')])
            assert len(ids)==1,'Unresolved reversed first/last name for Bernard Chęć'
        if ids:
            exact={i for i in ids if (by_id[i]['lastName']+' '+by_id[i]['firstName']).upper()==name.upper()}
            if exact:
                assert len(exact)==1,('Ambiguous canonical',name,exact)
                ids=exact
            else:
                assert len(ids)==1,('Ambiguous alias',name,ids)
        if not ids:
            parts=name.split()
            assert len(parts)>=2
            last,first=parts[0],' '.join(parts[1:])
            pid='mt2024-mega-'+key(name).lower()
            assert pid not in by_id
            p={'id':pid,'lastName':last,'firstName':first,'aliases':[name],'archived':False,'nameNeedsReview':False}
            by_id[pid]=p;new.append(p);by_name[key(name)].add(pid);ids={pid}
        assert len(ids)==1
        pid=next(iter(ids));p=by_id[pid]
        results.append({'competitorId':pid,'competitorName':p['lastName']+' '+p['firstName'],
            'sector':r['sector'],'peg':int(r['peg']),'weightG':int(r['weight']),'officialPlace':float(r['place'])})
    assert len(results)==63 and len({r['competitorId'] for r in results})==63
    # Identity cross-check: the confirmed Kot Bogumił is the same athlete in both 2024 MEGA rounds.
    kot1=next(r for r in prior['results'] if key(r['competitorName'])==key('KOT BOGUMIŁ'))
    kot2=next(r for r in results if key(r['competitorName'])==key('KOT BOGUMIŁ'))
    assert kot1['competitorId']==kot2['competitorId']
    tour={'id':TOUR_ID,'name':'V tura — Urodzinowy Puchar M. Grzybowskiego (12.10.2024)','date':'2024-10-12',
          'status':'FINAL','sourceOfficial':True,'sectorCount':5,'results':results}
    new_cycle=deepcopy(cycle)
    new_cycle['tours'].append(tour)
    new_cycle['source']=(cycle.get('source','')+' V tura: karty sektorowe 214, 215, 527, 216, 528, data 12.10.2024; 63 zawodników, bez wierszy dla stanowisk 55 i 58.').strip()
    return new_cycle,new

def atomic(path,obj):
    fd,tmp=tempfile.mkstemp(prefix='.mega2024t2-',dir=path.parent)
    try:
        with os.fdopen(fd,'w',encoding='utf8') as f:
            json.dump(obj,f,ensure_ascii=False,separators=(',',':'));f.flush();os.fsync(f.fileno())
        os.chmod(tmp,0o600);os.replace(tmp,path)
    finally:
        if os.path.exists(tmp):os.unlink(tmp)

def run(private):
    assert private.name=='.mt41-private'
    path=private/'state-mt73.json'
    assert path.is_file() and not path.is_symlink()
    with (private/'mt73.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        before=json.loads(path.read_bytes());data=before['data']
        cycle,new=build(data)
        after=deepcopy(before)
        idx=next(i for i,c in enumerate(after['data']['cycles']) if c['id']==CYCLE_ID)
        after['data']['cycles'][idx]=cycle
        after['data']['players'].extend(new)
        after['revision']+=1
        after['seeded']=False
        after['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
        hist=private/'mt73-history';hist.mkdir(mode=0o700,exist_ok=True)
        backup=hist/('before-mega2024-tour5-r%d.json'%before['revision'])
        if backup.exists(): assert json.loads(backup.read_bytes())==before
        else:atomic(backup,before)
        assert json.loads(backup.read_bytes())==before
        atomic(path,after)
        assert json.loads(path.read_bytes())==after
        print('SAVED: MEGA CUP 2024 V tura, 63 starters, 5 sectors, 6/4, new players',len(new))

if __name__=='__main__':run(pathlib.Path(sys.argv[1]))
