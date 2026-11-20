#!/usr/bin/env python3
"""Single incremental MEGA Match This CUP 2024 cycle import: source photographs 606,607, handwritten 76."""
import collections, csv, datetime, fcntl, json, os, pathlib, sys, tempfile, unicodedata
from copy import deepcopy
from io import StringIO

CYCLE_ID='mt2024-mega-match-this-cup-cycle'
TOUR_ID='mt2024-mega-cycle-tour-1'
SOURCE_TEXT='''rank;name;sector;peg;weight;place
1;PIETRZAK JACEK;E;47;14120;1
2;KOWALSKI MARCIN;B;22;13500;1
3;BALIK NORBERT;D;41;12800;1
4;KALMUS ŁUKASZ;A;12;12710;1
5;ŚMIETANKA KAROL;G;72;11660;1
6;KUCHCIAK KONRAD;F;63;10660;1
7;KUPISZ MAREK;C;27;10100;1
8;KOWALSKI JAROSŁAW;B;18;13360;2
9;ALEFIEROWICZ MAREK;E;51;12960;2
10;MISZCZUK ROBERT;D;38;11320;2
11;WLAZŁO PAWEŁ;A;5;10500;2
12;SOBUSIAK KAMIL;F;67;10500;2
13;KUCHARSKI SZYMON;G;79;9905;2
14;ĆWIKŁA DANIEL;C;34;9210;2
15;BOROWICZ ZBIGNIEW;B;24;11450;3
16;WITOS ARKADIUSZ;D;44;10500;3
17;DUDA ZBIGNIEW;E;55;10410;3
18;ANTOSIK ARTUR;A;3;9955;3
19;CIESIELSKI MIECZYSŁAW;G;70;9100;3
20;KURCZYŃSKI MARIUSZ;C;32;9000;3
21;STEFAŃCZYK TOMASZ;F;62;7060;3
22;DOBOSZ HENRYK;B;15;10300;4
23;STANIAK MARIUSZ;A;10;9860;4
24;SZCZĘSNY JACEK;D;46;9560;4
25;BIEŃ PAWEŁ;E;53;8825;4
26;KOŃPA CEZARY;C;35;8790;4
27;GÓRECKI KACPER;G;71;7760;4
28;WĄSIK BOGDAN;F;66;5275;4
29;RZEPCZYŃSKI MARCIN;A;11;9560;5
30;ŁUSZCZEWSKA EMILIA;D;37;9420;5
31;SOBOLEWSKI BARTŁOMIEJ;B;23;9210;5
32;STASIAK ŁUKASZ;C;30;8600;5
33;PEIL ANNA;E;49;7755;5
34;KOWALCZYK WOJCIECH;G;69;7325;5
35;BEDNAREK ANDRZEJ;F;59;4885;5.5
36;SMAL MARIUSZ;F;60;4885;5.5
37;ŁOSZEWSKI GRZEGORZ;A;8;9325;6
38;JAROS ARTUR;B;20;8665;6
39;KMIEĆ WŁODZIMIERZ;D;39;8650;6
40;GODOS PAWEŁ;C;28;8105;6
41;KRZYCKI ARKADIUSZ;E;52;7540;6
42;SOBCZYŃSKI BARTŁOMIEJ;G;78;6805;6
43;CHODZIŃSKI TOMASZ;A;7;9030;7
44;WOSZCZAK ŁUKASZ;D;36;8100;7
45;ŚWINARSKI KRZYSZTOF;C;33;7900;7
46;KOLASZA ROBERT;E;54;7110;7
47;SZCZĘSNY MARIUSZ;B;19;6940;7
48;WASILEWSKI WOJCIECH;G;73;6300;7
49;FABIJAŃCZUK DARIUSZ;F;65;4375;7
50;LEBENSZTEJN BARTOSZ;D;43;7910;8
51;WYSOCKI FRANCISZEK;C;25;7500;8
52;JURKIEWICZ SŁAWOMIR;E;50;7075;8
53;KALINOWSKI ZBIGNIEW;A;2;6930;8
54;BŁAŻEJEWSKI PAWEŁ;B;14;6775;8
55;RADZISZEWSKI PAWEŁ;F;64;4175;8
56;MAKOWIECKI MIECZYSŁAW;G;75;6245;8.5
57;DĄBKOWSKI PAWEŁ;G;76;6245;8.5
58;KOT BOGUMIŁ;D;45;7785;9
59;LISIAK MARCIN;C;26;7225;9
60;SADŁOWSKI TOMASZ;A;1;6905;9
61;WOLAMIN ANDRZEJ;B;13;6500;9
62;CZUBAK MAREK;E;48;6045;9
63;CZUPRYNA PIOTR;F;61;3595;9
64;DERUŚ STANISŁAW;C;29;7130;10
65;KRESOWSKI ŁUKASZ;A;4;6885;10
66;MIROWSKI MIROSŁAW;G;77;6195;10
67;TARTANUS DANIEL;D;42;6055;10
68;ZIEMNIEWICZ DARIUSZ;B;16;5670;10
69;SUWAŁA PIOTR;E;57;4860;10
70;PASTUSZKA TOMASZ;F;68;3450;10
71;PRZYBYLSKI TOMASZ;A;9;6675;11
72;PRASAŁ DOMINIK;C;31;6500;11
73;KRZYŻANOWSKI SŁAWOMIR;D;40;5405;11
74;GRZYBOWSKI MACIEJ;E;56;4470;11
75;STRZELCZYK PAWEŁ;G;74;4335;11
76;LEBENSZTEJN ŁUKASZ;B;17;4160;11
77;ZALEWSKI GRZEGORZ;F;58;1360;11
78;BARTCZAK JAN;A;6;5415;12
79;GODUN PIOTR;B;21;3235;12
'''

def key(text):
    return ''.join(c for c in unicodedata.normalize('NFD',str(text).upper().replace('Ł','L')) if c.isalnum())

def load_source():
    r=list(csv.DictReader(StringIO(SOURCE_TEXT),delimiter=';'))
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
