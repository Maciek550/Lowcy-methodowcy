"""Import XII MatchThis.pl Cup 2024 to SMALL2 after sector-card verification.
Kot Marcin (I tura) and Kot Bogumił (II tura) are different people.
"""
import base64, collections, csv, datetime, fcntl, hashlib, json, os, pathlib, sys, tempfile, unicodedata, zlib
from copy import deepcopy
from io import StringIO

EVENT_ID = 'mt2024-xii-puchar-matchthis'
INPUTS = [
    ('I tura', '2024-11-23', 'eNpdVcuO20YQvPMr+AmcFx+Y05CitKOhOMSQAiHeDGPhBEhsIzGQs7BGfiCXYH/Fxyz/K9Wj18JXFbunqqu69fnD78/66/Mn/efzx29f/tB/Pf/66Zdv+utvHz4+Jwc/utmkJkzHoCttdFWITLOk9l3rUmcOttOS6VZXKqPfR183y2l9GZ1Na1StZ3+w7V7zSm90Xub0zdav5+nUX5sypmud81xRV9uuL+lg5nY9a5nrrVZCUklY2uHe92BCY3vU6J1WLD47mHE6josz6eQPZlw0z3WjZRa7uuNgx4XKWqclNBQ5V5ong22ncKnamwaYKCAkZ0UGcNOGzuwIccdaywpcZFUSAokQP/+sUFWgIwtJn7z9PVu3nk26Mb1tOy0E1Mtc0KvOh9PkY/lS2x3wWbMMM5B5RrW1D362zfJAuYQWUTJCm6dTnZp+g4HstRTgqyTKRDIuzfL279ifSKeFKp1DqVSYwHvwKlQRH1FS4e6/f0LbgI0zzdAGrQroEKUgzA9mPWM8g/VT0FwQj5xRx9l38L6/U2E5FAhZUNViruPZAdr5sIAjxidERWjnYcPdYwUFUqlMy6Rpu3afmk2wptd4nhgCl8k4tVuzvsB/d7NXkLYsolvb3LopRdR5Qd2cn01HJPYm+BFeYMqCOPKMqjbHjXlMGO+DH5ORxnIcwqk36cE2T5CvkZUGeeIETn7s4U7b3ELIS+LJYYFCzsL7jEYTpCSBDC6opDaddWnvQ92GSXNIEEVFhbVFyu4lrCSaLCI7vzn21/HLkkhmJf3eLGaAL7dNYNDNS0XIOL19H2ApsIZiySpiz7mKBJunxuIp5/tgwDsDOVFhXjml+jhGLO60yKFLFJyg9Xys3SWxAxw9nC7jLEkAWZcnOBHrK03yIj0+rESkm8XmB9M99HHo4xXMyxPfYzOdv9mK8wAhrCLoALLmESEwgQ4WuUZvYxxmv8djzRMsICkFgl0Anm6TUZEjOBRJDdLrj3Z/IXlNjJAk8/JBDMr1KCkO8pFjcYlfb48uDWZLgWCSBBQVgbOZA3kOQxy2/aJQlSSDnKJq1L5zl3PoYHnENm/f74O98mHgwyvIKBNHjX+Y/vJBnDkuTcBuQiov0aF8hPUakYJoFxGq201PF++xoopo54zA+TR62vltMH0DC3ATGEbFVXwZXesLZfyucohhpSRgfcWpgyBEz2FaHQwhNZnIIl8zR1Peh0RwEoQbpSvcjMXetmNqYxQKooT1AQqnT7V/nyBeoHmJ1amS0XT4F7q7LaroNiHr62yhk8poYOMy+a0uoIV6/g9BD9PO', '59775b0f39c3bf838a97b056eb51e4edd107eddbcd290eaefb397fdc8d76ba21'),
    ('II tura', '2024-11-24', 'eNpNVcuOpEYQvPMVfAJV1ANUpwKqe2gehQoQam6r1Whtyd5d2Sv5PNqVf8AXa35ljx7+y5H0Y/pKVGZGRkYmnz/8/my+Pn8yfz5//PblD/PX86+ffvlmvv724eNz1PjFtmNTxycb/Li92MUwY02utDRZ1Prgmniwi9teDMd3JjOemDSa/Nj7pXZl3NlQ1r1JCRRJkhgRvf291A1SxZXta9caQViq88SoaC8T2zDNwUj6zhKRGB2NE97ahtLV87gatcdkMjEyOvpq7uOh9lMweieXSJNHoy/mkWIa29WtySgiT7LEsKiZy6dyh3wfbGVywrQEOx4tvsX7PrZ9FVZ3MiwxhcnTjFjsapTruYkXfyrR3hMIAkZsTnkXu4T1vH0vV+SurlQZpxdJLkmY6u1HgSyk6FU2lgJWCmWyaHvtaodOGwvSwbeQjGIFacCjcS3Xt3/H/nxXgUnipgSpUNRu+35PqgighhTpUBIpqllA2e3Fowoa0/QGYmEk4+QOEHhu4mAPlhJkAFPBSMjCB8yyXOO1qI+YGCyQmxJ1lQSrwlW9JRvcBIMBSpORQUR08NvLdO6vA+UMiJAZWWc5j74Eo0OwfVmPq2sM5wRnikgvfq0vlDs7OeqVp0AZ45KE3l6XGlUJb6D4uE7+YLjAC5WDlYzKp3PxzkhSYg1X6Mj3KNb4ePKdpawKEKdO8uj43z/BEafGloMDXU2NZKnE3Jp5QBwJT0QzUxEVTVTep3KyJYE5QK0ZtQ8fDJjlbQcSIFKlRKOA/7ef7uQerZAyPFAZpwYK29ZN3PtQuDCZlBOSIqmKqrmy76NIUyBCabLPoS7vqQQ+Z1peuIe7AW7OAQm0kDBOxmoWu71StsuLktyRKspLDoIB6tPD6qXaOCNlTlwaP8WFP85dTTUzALlWpErlQmuPFpo0M4yUA9n3S0RHzKvwj6VgX2eI/2DHCRWg2HU6gu1xnLqAjX17ofjoYsGpKBdkxXF6+zFgiPfEKTHVjNZje5nviwdTdOfLMROCnrB9uzs/QomrV5HwABcr0qdc5yGce3u9MUIBIl0aH87TJed9HkIDVCqXt62ia4CDcesoAyyFJPFAY3gcDHlE5MDRzn6lgl322EfCsD8lyKgn8Coug4HvJAMg0pyWa7QtGrnfKMkBaSFIxtVeRcQc3NGH1ciUMiZ6tyUkvh1MKczRZCyjqAFnKVxGc3E5GjgipaaJ+gEXo7mpIxWF8f02dLiz9qGSBiQZo0p3Tbsab+AemQHEUu2tl651p9hWoba9kTnV4pLWYuxs+/4TSAhgye5EOrw/bX8Zx64VDBKMYniD1slf/wP7qthD', '2a168c813821839e99b45264ad567d7786f3443a63cb8eedf56d604200c29759'),
]

def key(text):
    return ''.join(c for c in unicodedata.normalize('NFD', str(text).upper().replace('Ł','L')) if c.isalnum())

def read_rows(encoding, digest):
    content = zlib.decompress(base64.b64decode(encoding))
    assert hashlib.sha256(content).hexdigest() == digest, 'Source transcript SHA-256 mismatch'
    rows = list(csv.DictReader(StringIO(content.decode('utf-8')), delimiter=';'))
    assert len(rows)==61 and all(set(r)=={'name','peg','sector','weight','place'} for r in rows)
    return rows

def build(data):
    by_id = {p['id']:p for p in data['players']}
    by_name = collections.defaultdict(set)
    for pid,p in by_id.items():
        for n in [p['lastName']+' '+p['firstName']] + p.get('aliases',[]):
            by_name[key(n)].add(pid)
    new=[]; rounds=[]; all_names=[]
    for tnum,(label,date,encoding,digest) in enumerate(INPUTS, start=1):
        source=read_rows(encoding,digest)
        results=[]; seen_names=set(); seen_pegs=set()
        for r in source:
            name=r['name'].strip(); norm=key(name)
            assert norm not in seen_names, f'Duplicate player in {label}: {name}'
            seen_names.add(norm)
            ids=by_name[norm].copy()
            if len(ids)>1:
                exact={i for i in ids if (by_id[i]['lastName']+' '+by_id[i]['firstName']).upper()==name.upper()}
                assert len(exact)==1, f'Ambiguous identity {name}: {len(ids)}'
                ids=exact
            if not ids:
                parts=name.split()
                assert len(parts)>=2 and all(parts), f'Invalid person: {name}'
                last,first=parts[0],' '.join(parts[1:])
                pid='mt2024-xii-'+norm.lower()
                assert pid not in by_id
                person=dict(id=pid,lastName=last,firstName=first,aliases=[name],archived=False,nameNeedsReview=False)
                by_id[pid]=person;new.append(person);by_name[norm].add(pid);ids={pid}
            assert len(ids)==1
            pid=next(iter(ids));p=by_id[pid]
            peg=int(r['peg']);weight=int(r['weight']);place=float(r['place'])
            assert peg not in seen_pegs and weight>=0 and place>=1
            seen_pegs.add(peg)
            results.append(dict(competitorId=pid,competitorName=p['lastName']+' '+p['firstName'],peg=peg,sector=r['sector'],weightG=weight,officialPlace=place))
        assert len({r['competitorId'] for r in results})==61
        assert set(r['sector'] for r in results)==set('ABCDEFG')
        assert seen_pegs==({*range(1,64)}-{51,63} if tnum==1 else set(range(1,62)))
        expected=({'A':9,'B':9,'C':9,'D':9,'E':9,'F':8,'G':8} if tnum==1 else {'A':9,'B':9,'C':9,'D':9,'E':8,'F':9,'G':8})
        for sector,count in expected.items():
            members=[r for r in results if r['sector']==sector]
            assert len(members)==count,(label,sector,len(members))
            for r in members:
                computed=1+sum(o['weightG']>r['weightG'] for o in members)+sum(o is not r and o['weightG']==r['weightG'] for o in members)/2
                assert computed==r['officialPlace'],(label,sector,r,computed)
        all_names.append(seen_names)
        rounds.append(dict(id=EVENT_ID+'-round-'+str(tnum),name=label,date=date,status='FINAL',sourceOfficial=True,sectorCount=7,results=results))
    assert len(all_names[0]^all_names[1])==2
    assert all_names[0]-all_names[1]=={key('KOT MARCIN')}
    assert all_names[1]-all_names[0]=={key('KOT BOGUMIŁ')}
    a=next(r for r in rounds[0]['results'] if key(r['competitorName'])==key('KOT MARCIN'))
    b=next(r for r in rounds[1]['results'] if key(r['competitorName'])==key('KOT BOGUMIŁ'))
    assert (a['peg'],a['sector'],a['weightG'],a['officialPlace'])==(5,'A',3500,7)
    assert (b['peg'],b['sector'],b['weightG'],b['officialPlace'])==(38,'E',9760,1)
    assert a['competitorId']!=b['competitorId']
    c=next(r for r in rounds[1]['results'] if key(r['competitorName'])==key('CZUPRYNA PIOTR'))
    assert (c['peg'],c['sector'],c['weightG'],c['officialPlace'])==(46,'F',0,9)
    event=dict(id=EVENT_ID,name='XII PUCHAR MATCHTHIS.PL — 23–24.11.2024',date='2024-11-23',year=2024,kind='EVENT',archived=True,
        source=('Karty sektorów I i II tury, oficjalne zestawienia 637–640 oraz karta losowania 257. '
          'Rozbieżność: oficjalna tabela końcowa scala starty Kot Marcin (I tura) i Kot Bogumił '
          '(II tura); zgodnie z potwierdzeniem organizatora są to dwie różne osoby. '
          'Przypisano starty odrębnie, bez kopiowania błędnego sumowania z klasyfikacji końcowej.'),
        rounds=rounds)
    return event,new

def write_atomic(path,data):
    fd,tmp=tempfile.mkstemp(dir=path.parent,prefix='.xii-')
    try:
        with os.fdopen(fd,'w',encoding='utf-8') as out:
            json.dump(data,out,ensure_ascii=False,separators=(',',':'))
            out.flush();os.fsync(out.fileno())
        os.replace(tmp,path)
    finally:
        if os.path.exists(tmp): os.unlink(tmp)

def run(directory):
    path=directory/'state-mt73.json'
    with (directory/'mt73.lock').open('a') as locked:
        fcntl.flock(locked,fcntl.LOCK_EX)
        before=json.loads(path.read_bytes());data=before['data']
        event,new=build(data)
        old=[e for e in data['events'] if e.get('id')==EVENT_ID]
        if old:
            assert len(old)==1 and old[0]==event and not new, 'Already exists with different content or identity!'
            print('XII PUCHAR 2024 already imported and identical; no write')
            return
        assert not any(e.get('date')=='2024-11-23' and 'XII' in e.get('name','').upper() for e in data['events'])
        after=deepcopy(before)
        after['data']['players'].extend(new)
        after['data']['events'].append(event)
        after['revision']+=1
        after['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
        history=directory/'mt73-history';history.mkdir(mode=0o700,exist_ok=True)
        backup=history/('before-xii-puchar-2024-r%d.json'%before['revision'])
        if backup.exists():
            assert json.loads(backup.read_bytes())==before, 'A conflicting backup already exists'
        else:
            write_atomic(backup,before)
        write_atomic(path,after)
        assert json.loads(path.read_bytes())==after
        print('IMPORTED 2 rounds / 122 rows / 7 sectors each; distinct Kot Marcin and Kot Bogumił; new profiles',len(new))

if __name__=='__main__':
    run(pathlib.Path(sys.argv[1]))
