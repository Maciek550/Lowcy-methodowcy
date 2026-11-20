#!/usr/bin/env python3
"""Import documented Garbolino Float Cup 2024 with original sector cards taking precedence over incorrect printed aggregates."""
import base64,collections,csv,datetime,fcntl,hashlib,json,os,pathlib,sys,tempfile,unicodedata,zlib
from copy import deepcopy
from io import StringIO

EVENT_ID='mt2024-garbolino-float-cup'
SOURCES={'T1':('eNpVVcuO20YQvPMr+AUB58UH+jQkR9oRKVIgRRPkbWEITpDEMRwDOS8c+AdyCfIrPmb1X64eSrv2cdXN6arqqt6Pj+9/pfePv1/ow+Ud/Xl5++mPj/TX5Zd3P3+iD789vr1Egpp+tm21Lk0894fKu+qBhKCSRKZVQiKSW8fY+Phoh8p3pFKqSaSJ4bKisS/71s3cUNrhfH3qj94dKCNLQhvNTZrqqbbxWvp9591MUlGFKWnORUOYOnq3jQCAdRmvT3YmI2mHLim5K6UzHrfdNMa1xSMtaU2OCpFxNaPRtrZ6AMSzm8aVlGaMWgKjjHKaW7sCWHyys7s+kWRsSmguFoRhJ1utL9+KlOlLlXFZJNQA1POXeMYD9erxx7CSTJlBosP70Gvu8crRd7Ht6mEFfZMCfC4yw3VJJ+db1DpLWgF2lm+PKzrY0V8/j43F+H1tW4cW9DMAxqcioWlexr6COLvBdpUfV9eQypmfyNPQYoiVr1bbxAfbkSwALlep4VpK+77uxzt1XfB4k4TvMjr3Y9fPEP2+XJMDdya3d3M6DetSLmE15/5oWR3WTrLs6icTiYIGW/dHbmjsXR3zQw/2N54hyuay+woS5igMBulIwobTCcwYBbPLmF3CKFGUdP1v9p0dwhAAGtdzvyO4EyylNNyjoEDrm7jrh9INZ9KGaeokFDVUHiABNJoGMhoMU6lDCcphcdev7rA5+IaOFQWAAiiBP32NQHgouDNljkmuQ0dGlWvdIbb14LEAJQJ+DhCKORwGX1Urj7CxO/rWW+Jv2CChpQD/FrUNoc4ZvMD+TIQnmv76+WTjyq12WMgYwDeyCEVBq71lbw+F9z3EzwGsKPBdGimEF64F+u/iC9OVlKdwJhoU2Q4egHLbaIgNVEkSvtYEtatQa2ztORugW0NXHeqG6qVdxnhc2jeokk4D7iS8nNLJO6w9eLLCUo0IwFWoZjTD+DfoL4enAPRcQvwsgsHn578ZWNkjF9BUhclJKBZ0bhDZqXlxpQap1IB1FgHcYRoaHBqPVIdt4SSBmwa3VKehR9DUuje+Au54Xeph6uxISLMjw8FBB66Pr+6GMIrBc5xRUazLcv1qu03Y1xEaBDIDV+URzlPrej53212rHizeYc2AE/qiw9Dq3bG7Aa3tECTG14ApTXgE6eUExkMfbI3EljgtWahlSOcC9vciOAE9y4diTuy453/HbrnrXzCFJA/lgp6/zB7msPdzqhg6Ty0iyICT0GIjGz9IfXID4RxguIZj0SII3Ma16e8bgNdqXm+oSjraW6KwvmlLDFJeAUASOvB/4+x2GI0dDnbH2pgMAPUNAkLa+tHBe7U94ldQ0yIPnxqah///KW/m2XwLR9QwJ1Ihkgi3F0dp5Uv5Q6gL4FcFLjr3ZISF3YLh76FGViukN91avtfweNsOvkZ2C70NwotTyQcU+3s9DdiMw4ErwivfACbe9ig=','937b28e87ecb39cd276c6ffb70d667b82facb895a3fcd7356d14595c891efab5'),
         'T2':('eNpVVcuO20YQvBvwP/ALAs6LD/RpRI52R6RIYSiaEG+GsXAC5GEkBnJeOPAP5BLkV3zM6r9SPRpqk9NiVcV+VFf3/Pz+pyf69PSRfnv68PmXX+n3px8+fv+ZPv34/sPT2zfduNh+6nx2tKHxAwmyJKRROZnv8rdvHsJ62WVh3LlwJsmYqPOcCsauz/ZkmxVfnt08raTip2WVk2Z4GUE4+iGzQxtWdyDNeG50TiXju3k3jItHgIMN4wTyQgYUXdYGPKZMZ7e3g5+7LNi9vT5TAbySwlDN8L321wAl51AGJcrImE9+4gqD66hirNQiJ8HYy9fFd/goa5HC9VRz7FobquKX1+cR8f+rTB5jS/xVsb/wz5+73kWKDec5QBvaUaW3EGf8aod52hIICbgWKsm3s73vsmEMUVuhAIqiylN1c+/e+cbj6/XShnmwEwnN4VnfqF8X1gYBbOhs61l/yMIhyiI1b4fzOEVGLK4AWiq5adt4N6Gq2KB3zXq5CSjKGETp1GUH8OVrtkCOdvX4JyBRxZxcFptJxnacspNdHEYkagZlbTYb2MknlZbxgKzNI8mcO5GgxDmu3h2hUPRCa0NsRgpqSBcqjfpoD7cYu/FhvlUqJRhV8SpnODer7WCGgaRiTBZpEtO4G1MNTEMvaORAUoMlTKWT5gv0QHm3qXe2OblA0KshVdxlC7Ydjzd8k0MWnEzLNJfDHLrUTCwUuRCmBKc2ZVKsnVubrTv/wG2TrLgOpcs0uJPzPbZmsCRrRnKuUKfsKwx9ayUJDgHAASlNbDpj23oMtLszBLXoU2/ZUVBytt/2RkmmaFWmJqa1WV/+moYLuz8ORClmqBL2j5ouL3+wuTAP2JuUBlpWdZ5kWm3SGwfEPYxQCZPE9wWvZiwT3uT1d822X6qIBC5B37b7+uVks8atNlxIlbEHYdK4xwE6dGN2Ho+Wq6sYLk2dJGwv/WXKpkv/DsWTqhnN74aLhyMqdLckFG5hG715YQdZrt/c4X9Sa0EO3labt0/eQezouQYHRssIy03nA6x//TJ1Fi1Cpd5holoxRxXbfsXTlVZUa2BVjT2OMzjDgituX2oRZ8WRUSZtxOuEUvKCA5tapgZ6N7K5bmNuHvl66hKUuiqThPveTw7nobVH0hWnFiYtTINFOAAJHrPVdYyst7tyChcUtD0K0GKPq1Qn4yyXaWyQcx/s0LBVOzICDCEKsQ0Wb8r1mx1uHnzdESPB05VMQ1p6u2JTN+2N4ih4PVJ/J36ZLvF+JYGMBiPe99jD9e/FDzbEXQV3Ws/jntDgnh+hTYNu7jGem/ymYEzfH4/J9rZ5vD9vpmRY5dvkrs8zz4Altpk7+t5bMlVslUNEB+x9s9VPxLuB3/4F0dvqhA==','d76cfe39d40623d479443ed3fd16a0f02eca8f4d247318f072d9cfb71fc993e2')}
def key(v):
    return ''.join(c for c in unicodedata.normalize('NFD',str(v).upper().replace('Ł','L')) if c.isalnum())
def read_round(which):
    enc,digest=SOURCES[which]
    plain=zlib.decompress(base64.b64decode(enc))
    assert hashlib.sha256(plain).hexdigest()==digest,'Source checksum mismatch'
    return list(csv.DictReader(StringIO(plain.decode('utf8')),delimiter=';'))
def load():
    a=read_round('T1');b=read_round('T2')
    for t,source,total,counts in [(1,a,483945,dict(A=10,B=10,C=10,D=10,E=10,F=9)),
                                  (2,b,673555,dict(A=10,B=10,C=10,D=10,E=9,F=9))]:
        assert len(source)==59 and len({key(r['name']) for r in source})==59
        rows=[r for r in source if r['peg']]
        assert len(rows)==(59 if t==1 else 58)
        assert {int(r['peg']) for r in rows}==set(range(1,60 if t==1 else 59))
        assert sum(int(r['weight']) for r in rows)==total
        assert {s:sum(r['sector']==s for r in rows) for s in 'ABCDEF'}==counts
        for s in 'ABCDEF':
            members=[r for r in rows if r['sector']==s]
            for r in members:
                w=int(r['weight'])
                rank=1+sum(int(o['weight'])>w for o in members)+sum(o is not r and int(o['weight'])==w for o in members)/2
                assert rank==float(r['place']),(t,s,r,rank)
        if t==2:
            no=[r for r in source if not r['peg']]
            assert len(no)==1 and no[0]['name']=='FIC PAWEŁ' and no[0]['sector']=='' and int(no[0]['weight'])==0 and float(no[0]['place'])==100
    assert {key(r['name']) for r in a}=={key(r['name']) for r in b}
    assert next(x for x in b if x['peg']=='45')['weight']=='5355'
    assert next(x for x in b if x['peg']=='52')['weight']=='4820'
    return a,b
def build(data):
    t1,t2=load()
    people={p['id']:p for p in data['players']}
    by_name=collections.defaultdict(set)
    for pid,p in people.items():
        for n in [p['lastName']+' '+p['firstName']]+p.get('aliases',[]):
            by_name[key(n)].add(pid)
    new=[];rounds=[]
    for turn,source in [(1,t1),(2,t2)]:
        results=[]
        for row in source:
            name=row['name'];nk=key(name); ids=set(by_name[nk])
            if len(ids)>1:
                exact={i for i in ids if (people[i]['lastName']+' '+people[i]['firstName']).upper()==name.upper()}
                if len(exact)==1:ids=exact
                elif name=='WOŁAMIN ANDRZEJ':
                    canonical={i for i in ids if (people[i]['lastName']+' '+people[i]['firstName']).upper()=='WOLAMIN ANDRZEJ'}
                    assert len(canonical)==1,('Ambiguous Wolamin profile',ids)
                    ids=canonical
                else:raise AssertionError('Ambiguous athlete '+name)
            if not ids:
                last,first=name.split(' ',1)
                pid='mt2024-garbolino-'+nk.lower()
                assert pid not in people
                p=dict(id=pid,lastName=last,firstName=first,aliases=[name],archived=False,
                       nameNeedsReview=name in ('KRZCIK ARKADIUSZ','ULEVICIUS ZYDRUNAS'))
                people[pid]=p;new.append(p);by_name[nk].add(pid);ids={pid}
            assert len(ids)==1
            p=people[next(iter(ids))]
            absent=not bool(row['peg'])
            out=dict(competitorId=p['id'],competitorName=p['lastName']+' '+p['firstName'],
                     sector=row['sector'] if not absent else '',peg=int(row['peg']) if not absent else None,
                     weightG=int(row['weight']),officialPlace=float(row['place']))
            if absent:out['absent']=True
            results.append(out)
        assert len(results)==59 and len({r['competitorId'] for r in results})==59
        rounds.append(dict(id=EVENT_ID+'-round-'+str(turn),name=('I tura' if turn==1 else 'II tura'),
                           date=('2024-03-09' if turn==1 else '2024-03-10'),status='FINAL',
                           sourceOfficial=True,sectorCount=6,results=results))
    event=dict(id=EVENT_ID,name='GARBOLINO FLOAT CUP — 9–10.03.2024',date='2024-03-09',
        year=2024,kind='EVENT',archived=True,
        source=('Oryginalne karty sektorów: I tura 103–108, II tura 115–120, losowania 97–102 i 109–114. '
          'Priorytet kart przed błędnymi sumami: I tura 483945 g (wydruk 484215 g), '
          'II tura 673555 g (wydruk 676440 g), łącznie 1157500 g (wydruk 1160655 g). '
          'TKACZUK TOMASZ II: 5355 g zamiast 8250 g w zestawieniu; '
          'KRZYŻANOWSKI SŁAWOMIR II: 4820 g zamiast 4810 g; STEFANIUK RAFAŁ II miejsce 9. '
          'FIC PAWEŁ bez startu w II turze: 0 g, oficjalne 100 punktów, bez stanowiska.'),rounds=rounds)
    return event,new
def atomic(path,obj):
    fd,temp=tempfile.mkstemp(dir=path.parent,prefix='.garbolino-')
    try:
        with os.fdopen(fd,'w',encoding='utf8') as f:
            json.dump(obj,f,ensure_ascii=False,separators=(',',':'))
            f.flush();os.fsync(f.fileno())
        os.chmod(temp,0o600);os.replace(temp,path)
    finally:
        if os.path.exists(temp):os.unlink(temp)
def run(directory):
    assert directory.name=='.mt41-private'
    path=directory/'state-mt73.json'
    assert path.is_file() and not path.is_symlink()
    with (directory/'mt73.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        before=json.loads(path.read_bytes());data=before['data']
        event,new=build(data)
        existing=[e for e in data['events'] if e['id']==EVENT_ID]
        if existing:
            assert len(existing)==1 and existing[0]==event and not new,'Existing Garbolino record differs'
            print('Already present and identical');return
        assert not any(e.get('date')=='2024-03-09' and 'GARBOLINO' in e.get('name','').upper() for e in data['events'])
        after=deepcopy(before)
        after['data']['events'].append(event)
        after['data']['players'].extend(new)
        after['revision']+=1;after['seeded']=False
        after['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
        history=directory/'mt73-history';history.mkdir(mode=0o700,exist_ok=True)
        backup=history/('before-garbolino-2024-r%d.json'%before['revision'])
        if backup.exists():assert json.loads(backup.read_bytes())==before
        else:atomic(backup,before)
        assert json.loads(backup.read_bytes())==before
        atomic(path,after)
        assert json.loads(path.read_bytes())==after
        print('GARBOLINO 2024 saved: 59 first, 58 second and one DNS, new athlete profiles',len(new))
if __name__=='__main__':run(pathlib.Path(sys.argv[1]))
