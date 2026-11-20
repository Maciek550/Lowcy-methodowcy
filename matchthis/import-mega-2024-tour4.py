#!/usr/bin/env python3
"""Append photographed 2024 MEGA CUP round IV only. Preserve the published first round and all historic data."""
import collections,csv,datetime,fcntl,json,os,pathlib,sys,tempfile,unicodedata
from copy import deepcopy
from io import StringIO

CYCLE_ID='mt2024-mega-match-this-cup-cycle'
TOUR_ID='mt2024-mega-cycle-tour-4'
SOURCE_TEXT='''rank;name;sector;peg;weight;place
1;GÓRECKI KACPER;B;24;16000;1
2;SOBOLEWSKI BARTŁOMIEJ;C;33;15270;1
3;KUCHARSKI SZYMON;D;46;14740;1
4;PRZYBYLSKI TOMASZ;F;65;11880;1
5;WĄSIK BOGDAN;A;2;11790;1
6;KUCHCIAK KONRAD;E;60;11640;1
7;KOWALSKI MARCIN;B;17;14070;2
8;STANIAK MARIUSZ;C;28;13570;2
9;DERUŚ STANISŁAW;A;10;11560;2
10;TOSNOWIEC MARCIN;D;42;11050;2
11;KUPISZ MAREK;E;54;10910;2
12;ŁAPACZ MATEUSZ;F;62;10440;2
13;WLAZŁO PAWEŁ;B;25;11450;3
14;KORYTOWSKI ZBIGNIEW;A;3;10710;3
15;CIESIELSKI MIECZYSŁAW;C;29;10160;3
16;CZUPRYNA PIOTR;D;39;10080;3
17;SZCZĘSNY MARIUSZ;E;57;9870;3
18;PIETRZAK JACEK;F;64;9405;3
19;NIEWIADOMSKI ARTUR;B;18;10960;4
20;ZIEMNIEWICZ DARIUSZ;A;8;10650;4
21;RADZISZEWSKI PAWEŁ;D;47;9965;4
22;KALMUS ŁUKASZ;C;35;9525;4
23;JASIŃSKA MAGDALENA;F;63;9200;4
24;GODOS PAWEŁ;E;52;8465;4
25;RZEPCZYŃSKI MARCIN;B;15;10730;5
26;ŁOSZEWSKI GRZEGORZ;A;1;10080;5
27;BALIK NORBERT;F;72;9185;5
28;RUSEK JAKUB;D;49;8935;5
29;WASILEWSKI WOJCIECH;C;34;8925;5
30;DĄBKOWSKI PAWEŁ;E;61;8090;5
31;WYSOCKI FRANCISZEK;B;19;10290;6
32;BOROWICZ ZBIGNIEW;F;71;8400;6
33;PRYMAS ROBERT;A;12;8175;6
34;STASIAK ŁUKASZ;D;40;8140;6
35;KOT BOGUMIŁ;E;56;8000;6
36;SALACH MATEUSZ;C;26;7810;6
37;ZALEWSKI GRZEGORZ;B;23;9730;7
38;MISZCZUK ROBERT;F;69;8000;7
39;KMIEĆ WŁODZIMIERZ;A;11;7935;7
40;KURCZYŃSKI MARIUSZ;E;59;7890;7
41;CELEJ ADRIAN;C;36;7690;7
42;ĆWIKŁA DANIEL;D;45;7170;7
43;DOBROWOLSKI PIOTR;B;16;9355;8
44;SZCZĘSNY JACEK;A;6;7835;8
45;ŁUSZCZEWSKA EMILIA;E;55;7810;8
46;STRZELCZYK PAWEŁ;C;37;7405;8
47;KŁOKOWSKI MARCIN;F;67;6940;8
48;ŚWINARSKI KRZYSZTOF;D;38;6430;8
49;BERNARD CHĘĆ;B;14;9265;9
50;BŁAŻEJEWSKI PAWEŁ;A;4;7550;9
51;LEBENSZTEJN ŁUKASZ;C;30;7160;9
52;JAROS ARTUR;E;51;6840;9
53;PEIL ANNA;F;66;6785;9
54;BIEŃ PAWEŁ;D;41;6340;9
55;KOWALSKI JAROSŁAW;B;22;9215;10
56;KOCHAŃSKI GRZEGORZ;C;31;6775;10
57;BEDNAREK ANDRZEJ;A;9;6430;10
58;GODUN PIOTR;D;44;6300;10
59;PASTUSZKA TOMASZ;F;70;6105;10
60;WOLAMIN ANDRZEJ;E;58;5960;10
61;KRZYŻANOWSKI SŁAWOMIR;B;20;7940;11
62;KRESOWSKI ŁUKASZ;C;27;6630;11
63;KALINOWSKI ZBIGNIEW;A;13;5780;11
64;ALEFIEROWICZ MAREK;F;73;5755;11
65;SOBCZYŃSKI BARTŁOMIEJ;D;48;5645;11
66;FABIJAŃCZUK DARIUSZ;E;50;4970;11
67;KOLASZA ROBERT;A;5;5755;12
68;LEBENSZTEJN BARTOSZ;B;21;5650;12
69;DOBOSZ HENRYK;D;43;5580;12
70;BARTCZAK JAN;F;68;5340;12
71;GRZYBOWSKI MACIEJ;C;32;4650;12
72;BRZEŹNICKI MAREK;E;53;4625;12
73;CZUBAK MAREK;A;7;5175;13
'''

def key(t):
    return ''.join(c for c in unicodedata.normalize('NFD',str(t).upper().replace('Ł','L')) if c.isalnum())

def load_source():
    src=list(csv.DictReader(StringIO(SOURCE_TEXT),delimiter=';'))
    assert len(src)==73
    assert [int(x['rank']) for x in src]==list(range(1,74))
    assert len({key(x['name']) for x in src})==73
    assert {int(x['peg']) for x in src}==set(range(1,74))
    assert sum(int(x['weight']) for x in src)==632530
    assert sum(float(x['place']) for x in src)==481
    limits={'A':(1,13),'B':(14,25),'C':(26,37),'D':(38,49),'E':(50,61),'F':(62,73)}
    for sec,(low,high) in limits.items():
        members=[x for x in src if x['sector']==sec]
        expected=set(range(low,high+1))
        assert {int(x['peg']) for x in members}==expected,(sec,len(members))
        for r in members:
            w=int(r['weight'])
            place=1+sum(int(o['weight'])>w for o in members)+sum(o is not r and int(o['weight'])==w for o in members)/2
            assert place==float(r['place']),('sector placement mismatch',r,place)
    assert any(x['name']=='GÓRECKI KACPER' and x['sector']=='B' and x['peg']=='24' and x['weight']=='16000' and x['place']=='1' for x in src)
    assert any(x['name']=='KOT BOGUMIŁ' and x['sector']=='E' and x['peg']=='56' and x['weight']=='8000' and x['place']=='6' for x in src)
    return src

def build(data):
    candidates=[c for c in data['cycles'] if c['id']==CYCLE_ID]
    assert len(candidates)==1,'Cannot append: existing source cycle not unique'
    cycle=candidates[0]
    assert cycle['year']==2024 and cycle['countedTours']==4 and cycle['expectedTours']==6
    assert len(cycle['tours'])==3 and [t['id'] for t in cycle['tours']]==['mt2024-mega-cycle-tour-1','mt2024-mega-cycle-tour-2','mt2024-mega-cycle-tour-3']
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
    assert len(results)==73 and len({r['competitorId'] for r in results})==73
    # Identity cross-check: the confirmed Kot Bogumił is the same athlete in both 2024 MEGA rounds.
    kot1=next(r for r in prior['results'] if key(r['competitorName'])==key('KOT BOGUMIŁ'))
    kot2=next(r for r in results if key(r['competitorName'])==key('KOT BOGUMIŁ'))
    assert kot1['competitorId']==kot2['competitorId']
    tour={'id':TOUR_ID,'name':'IV tura — Puchar GARBOLINO (24.03.2024)','date':'2024-03-24',
          'status':'FINAL','sourceOfficial':True,'sectorCount':6,'results':results}
    new_cycle=deepcopy(cycle)
    new_cycle['tours'].append(tour)
    new_cycle['source']=(cycle.get('source','')+' IV tura: karty 145–156 i tabele 618–619, data 24.03.2024.').strip()
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
        backup=hist/('before-mega2024-tour4-r%d.json'%before['revision'])
        if backup.exists(): assert json.loads(backup.read_bytes())==before
        else:atomic(backup,before)
        assert json.loads(backup.read_bytes())==before
        atomic(path,after)
        assert json.loads(path.read_bytes())==after
        print('SAVED: MEGA CUP 2024 IV tura, 73 starters, 6 sectors, 6/4, new players',len(new))

if __name__=='__main__':run(pathlib.Path(sys.argv[1]))
