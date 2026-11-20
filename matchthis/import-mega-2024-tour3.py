#!/usr/bin/env python3
"""Append photographed 2024 MEGA CUP round II only. Preserve the published first round and all historic data."""
import collections,csv,datetime,fcntl,json,os,pathlib,sys,tempfile,unicodedata
from copy import deepcopy
from io import StringIO

CYCLE_ID='mt2024-mega-match-this-cup-cycle'
TOUR_ID='mt2024-mega-cycle-tour-3'
SOURCE_TEXT='''rank;name;sector;peg;weight;place
1;KUCHCIAK KONRAD;A;3;13150;1
2;KOCHAŃSKI GRZEGORZ;F;74;11890;1
3;BALIK NORBERT;B;16;9050;1
4;ALEFIEROWICZ MAREK;C;28;8070;1
5;ZALEWSKI GRZEGORZ;E;52;8000;1
6;CZUPRYNA PIOTR;D;47;7460;1
7;GÓRECKI KACPER;A;10;12270;2
8;ŁAPACZ MATEUSZ;B;14;8540;2
9;KMIEĆ WŁODZIMIERZ;F;67;8315;2
10;KUCHARSKI SZYMON;C;35;8000;2
11;TOSNOWIEC MARCIN;D;40;7450;2
12;MISZCZUK ROBERT;E;56;6820;2
13;CIESIELSKI MIECZYSŁAW;A;12;10640;3
14;WYSOCKI FRANCISZEK;B;17;8380;3
15;SOBOLEWSKI BARTŁOMIEJ;F;65;8210;3
16;ĆWIKŁA DANIEL;C;27;7095;3
17;BOROWICZ ZBIGNIEW;E;51;6565;3
18;STANIAK MARIUSZ;D;49;6375;3
19;SZCZĘSNY JACEK;A;13;8540;4
20;SMAL MARIUSZ;B;24;8110;4
21;KUPISZ MAREK;F;69;7550;4
22;PIETRZAK JACEK;E;61;6340;4
23;DOBROWOLSKI PIOTR;D;48;6330;4
24;GODOS PAWEŁ;C;30;5935;4
25;RZEPCZYŃSKI MARCIN;A;8;8150;5
26;DOBOSZ HENRYK;B;25;7025;5
27;ŁUSZCZEWSKA EMILIA;F;63;7000;5
28;ŚMIETANKA KAROL;E;55;5730;5
29;PRYMAS ROBERT;D;39;5545;5
30;CELEJ ADRIAN;C;33;5500;5
31;SALACH MATEUSZ;A;5;7425;6
32;STASIAK ŁUKASZ;F;68;6860;6
33;PRZYBYLSKI TOMASZ;B;19;6715;6
34;PEIL ANNA;E;60;5560;6
35;BŁAŻEJEWSKI PAWEŁ;C;32;5400;6
36;NIEWIADOMSKI ARTUR;D;50;5065;6
37;PASTUSZKA TOMASZ;A;4;7000;7
38;KOWALSKI MARCIN;F;71;6000;7
39;KOLASZA ROBERT;E;53;5265;7
40;SZCZĘSNY MARIUSZ;C;29;5245;7
41;RADZISZEWSKI PAWEŁ;D;43;4690;7
42;BARTCZAK JAN;B;21;6500;7.5
43;KOT BOGUMIŁ;B;22;6500;7.5
44;BERNARD CHĘĆ;A;7;6840;8
45;LEBENSZTEJN BARTOSZ;F;70;5665;8
46;SOBCZYŃSKI BARTŁOMIEJ;C;26;5095;8
47;LISIAK MARCIN;E;54;5080;8
48;GRZYBOWSKI MACIEJ;D;38;3500;8.5
49;BIEŃ PAWEŁ;D;46;3500;8.5
50;BEDNAREK ANDRZEJ;A;9;6595;9
51;ŁOSZEWSKI GRZEGORZ;B;15;5445;9
52;KALMUS ŁUKASZ;F;64;5220;9
53;WOLAMIN ANDRZEJ;C;31;4835;9
54;KOWALSKI JAROSŁAW;E;57;4685;9
55;KRZYŻANOWSKI SŁAWOMIR;A;1;6465;10
56;TARTANUS DANIEL;B;18;5285;10
57;LEBENSZTEJN ŁUKASZ;F;66;4820;10
58;DERUŚ STANISŁAW;D;42;3325;10
59;RUSEK JAKUB;C;34;3285;10
60;KRESOWSKI ŁUKASZ;E;58;4445;10.5
61;STRZELCZYK PAWEŁ;E;59;4445;10.5
62;KORYTOWSKI ZBIGNIEW;A;2;6340;11
63;KŁOKOWSKI MARCIN;B;23;5100;11
64;GODUN PIOTR;F;72;4610;11
65;JAROS ARTUR;D;45;3255;11
66;CZUBAK MAREK;C;37;3000;11
67;JASIŃSKA MAGDALENA;A;6;6310;12
68;ZIEMNIEWICZ DARIUSZ;E;62;4160;12
69;WĄSIK BOGDAN;B;20;4000;12
70;FABIJAŃCZUK DARIUSZ;F;73;3355;12
71;ŚWINARSKI KRZYSZTOF;D;41;2665;12
72;DĄBKOWSKI PAWEŁ;C;36;2040;12
73;WASILEWSKI WOJCIECH;A;11;5265;13
'''

def key(t):
    return ''.join(c for c in unicodedata.normalize('NFD',str(t).upper().replace('Ł','L')) if c.isalnum())

def load_source():
    src=list(csv.DictReader(StringIO(SOURCE_TEXT),delimiter=';'))
    assert len(src)==73
    assert [int(x['rank']) for x in src]==list(range(1,74))
    assert len({key(x['name']) for x in src})==73
    assert {int(x['peg']) for x in src}==set(range(1,75))-{44}
    assert sum(int(x['weight']) for x in src)==454890
    assert sum(float(x['place']) for x in src)==481
    limits={'A':(1,13),'B':(14,25),'C':(26,37),'D':(38,50),'E':(51,62),'F':(63,74)}
    for sec,(low,high) in limits.items():
        members=[x for x in src if x['sector']==sec]
        expected=set(range(low,high+1))-{44}
        assert {int(x['peg']) for x in members}==expected,(sec,len(members))
        for r in members:
            w=int(r['weight'])
            place=1+sum(int(o['weight'])>w for o in members)+sum(o is not r and int(o['weight'])==w for o in members)/2
            assert place==float(r['place']),('sector placement mismatch',r,place)
    assert any(x['name']=='BARTCZAK JAN' and x['sector']=='B' and x['peg']=='21' and x['place']=='7.5' for x in src)
    assert any(x['name']=='KOT BOGUMIŁ' and x['sector']=='B' and x['peg']=='22' and x['weight']=='6500' and x['place']=='7.5' for x in src)
    return src

def build(data):
    candidates=[c for c in data['cycles'] if c['id']==CYCLE_ID]
    assert len(candidates)==1,'Cannot append: existing source cycle not unique'
    cycle=candidates[0]
    assert cycle['year']==2024 and cycle['countedTours']==4 and cycle['expectedTours']==6
    assert len(cycle['tours'])==2 and [t['id'] for t in cycle['tours']]==['mt2024-mega-cycle-tour-1','mt2024-mega-cycle-tour-2']
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
    tour={'id':TOUR_ID,'name':'III tura — Puchar GM FISHING – MAVER (23.03.2024)','date':'2024-03-23',
          'status':'FINAL','sourceOfficial':True,'sectorCount':6,'results':results}
    new_cycle=deepcopy(cycle)
    new_cycle['tours'].append(tour)
    new_cycle['source']=(cycle.get('source','')+' III tura: karty 133–144 i tabele 616–617, data 23.03.2024; stanowisko 44 nie figuruje w wynikach.').strip()
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
        backup=hist/('before-mega2024-tour3-r%d.json'%before['revision'])
        if backup.exists(): assert json.loads(backup.read_bytes())==before
        else:atomic(backup,before)
        assert json.loads(backup.read_bytes())==before
        atomic(path,after)
        assert json.loads(path.read_bytes())==after
        print('SAVED: MEGA CUP 2024 III tura, 73 starters, 6 sectors, 6/4, new players',len(new))

if __name__=='__main__':run(pathlib.Path(sys.argv[1]))
