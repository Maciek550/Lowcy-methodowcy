#!/usr/bin/env python3
"""Append photographed 2024 MEGA CUP round II only. Preserve the published first round and all historic data."""
import collections,csv,datetime,fcntl,json,os,pathlib,sys,tempfile,unicodedata
from copy import deepcopy
from io import StringIO

CYCLE_ID='mt2024-mega-match-this-cup-cycle'
TOUR_ID='mt2024-mega-cycle-tour-2'
SOURCE_TEXT='''rank;name;sector;peg;weight;place
1;KRZYCKI ARKADIUSZ;A;8;12880;1
2;BIEŃ PAWEŁ;G;75;11830;1
3;SOBUSIAK KAMIL;C;27;11740;1
4;SMAL MARIUSZ;B;15;10620;1
5;KOWALSKI MARCIN;E;47;10500;1
6;WĄSIK BOGDAN;D;44;9640;1
7;SOBCZYŃSKI BARTŁOMIEJ;F;62;6625;1
8;KOWALCZYK WOJCIECH;A;2;12340;2
9;PIETRZAK JACEK;C;30;10460;2
10;KUCHCIAK KONRAD;B;22;9880;2
11;STANIAK MARIUSZ;E;50;9545;2
12;SOBOLEWSKI BARTŁOMIEJ;D;41;9320;2
13;WLAZŁO PAWEŁ;G;74;9290;2
14;GODUN PIOTR;F;57;6570;2
15;KUCHARSKI SZYMON;A;11;11570;3
16;DERUŚ STANISŁAW;C;26;9700;3
17;KUPISZ MAREK;E;55;9380;3
18;DUDA ZBIGNIEW;B;17;8560;3
19;ŁUSZCZEWSKA EMILIA;D;36;8290;3
20;MIROWSKI MIROSŁAW;F;58;6345;3
21;RZEPCZYŃSKI MARCIN;G;76;5305;3
22;ŚMIETANKA KAROL;A;6;11070;4
23;MISZCZUK ROBERT;E;49;9200;4
24;KALMUS ŁUKASZ;C;25;8665;4
25;BALIK NORBERT;B;16;8390;4
26;TARTANUS DANIEL;D;45;8265;4
27;BOROWICZ ZBIGNIEW;F;66;5965;4
28;GRZYBOWSKI MACIEJ;G;72;4470;4
29;KOWALSKI JAROSŁAW;A;10;8815;5
30;STRZELCZYK PAWEŁ;D;38;8000;5
31;SZCZĘSNY MARIUSZ;C;24;7955;5
32;KMIEĆ WŁODZIMIERZ;E;54;7780;5
33;ZIEMNIEWICZ DARIUSZ;B;19;7690;5
34;KURCZYŃSKI MARIUSZ;F;59;5830;5
35;JAROS ARTUR;G;68;3980;5
36;KOT BOGUMIŁ;A;4;8435;6
37;ĆWIKŁA DANIEL;C;31;7905;6
38;DOBOSZ HENRYK;E;56;7500;6
39;LEBENSZTEJN BARTOSZ;B;13;7420;6
40;WYSOCKI FRANCISZEK;D;35;6655;6
41;ALEFIEROWICZ MAREK;F;67;5100;6
42;SUWAŁA PIOTR;G;70;3690;6
43;NIEWIADOMSKI ARTUR;A;1;8400;7
44;CHODZIŃSKI TOMASZ;C;29;7105;7
45;CIESIELSKI MIECZYSŁAW;B;21;7080;7
46;KROGULEC KACPER;E;46;6340;7
47;ANTOSIK ARTUR;D;42;6330;7
48;WOLAMIN ANDRZEJ;F;64;3930;7
49;SZCZĘSNY JACEK;G;73;3200;7
50;KOŃPA CEZARY;A;9;8045;8
51;STEFAŃCZYK TOMASZ;B;14;6690;8
52;ZALEWSKI GRZEGORZ;C;34;6350;8
53;KALINOWSKI ZBIGNIEW;E;53;6120;8
54;SADŁOWSKI TOMASZ;D;40;4330;8
55;BARTCZAK JAN;F;60;3895;8
56;LISIAK MARCIN;G;77;3115;8
57;ŁOSZEWSKI GRZEGORZ;A;7;7465;9
58;CZUPRYNA PIOTR;B;20;6065;9
59;GÓRECKI KACPER;E;52;5855;9
60;PRZYBYLSKI TOMASZ;C;28;4660;9
61;STASIAK ŁUKASZ;D;43;4110;9
62;BŁAŻEJEWSKI PAWEŁ;F;61;3720;9
63;WITOS ARKADIUSZ;G;78;3070;9
64;BEDNAREK ANDRZEJ;A;3;6855;10
65;PASTUSZKA TOMASZ;B;18;4790;10
66;MAKOWIECKI MIECZYSŁAW;E;51;4325;10
67;KRZYŻANOWSKI SŁAWOMIR;C;33;3885;10
68;WOSZCZAK ŁUKASZ;D;39;3845;10
69;PEIL ANNA;F;65;3645;10
70;KOLASZA ROBERT;G;69;2690;10
71;DĄBKOWSKI PAWEŁ;A;12;6155;11
72;KRESOWSKI ŁUKASZ;B;23;4500;11
73;FABIJAŃCZUK DARIUSZ;D;37;3725;11
74;ŚWINARSKI KRZYSZTOF;C;32;2860;11
75;WASILEWSKI WOJCIECH;F;63;2820;11
76;RADZISZEWSKI PAWEŁ;E;48;2730;11
77;CZUBAK MAREK;A;5;4790;12
'''

def key(t):
    return ''.join(c for c in unicodedata.normalize('NFD',str(t).upper().replace('Ł','L')) if c.isalnum())

def load_source():
    src=list(csv.DictReader(StringIO(SOURCE_TEXT),delimiter=';'))
    assert len(src)==77
    assert [int(x['rank']) for x in src]==list(range(1,78))
    assert len({key(x['name']) for x in src})==77
    assert {int(x['peg']) for x in src}==set(range(1,80))-{71,79}
    assert sum(int(x['weight']) for x in src)==526660
    assert sum(float(x['place']) for x in src)==463
    limits={'A':(1,12),'B':(13,23),'C':(24,34),'D':(35,45),'E':(46,56),'F':(57,67),'G':(68,78)}
    for sec,(low,high) in limits.items():
        members=[x for x in src if x['sector']==sec]
        expected=set(range(low,high+1))-{71,79}
        assert {int(x['peg']) for x in members}==expected,(sec,len(members))
        for r in members:
            w=int(r['weight'])
            place=1+sum(int(o['weight'])>w for o in members)+sum(o is not r and int(o['weight'])==w for o in members)/2
            assert place==float(r['place']),('sector placement mismatch',r,place)
    assert any(x['name']=='BARTCZAK JAN' and x['sector']=='F' and x['peg']=='60' for x in src)
    assert any(x['name']=='KOT BOGUMIŁ' and x['sector']=='A' and x['peg']=='4' and x['weight']=='8435' for x in src)
    return src

def build(data):
    candidates=[c for c in data['cycles'] if c['id']==CYCLE_ID]
    assert len(candidates)==1,'Cannot append: existing source cycle not unique'
    cycle=candidates[0]
    assert cycle['year']==2024 and cycle['countedTours']==4 and cycle['expectedTours']==6
    assert len(cycle['tours'])==1 and cycle['tours'][0]['id']=='mt2024-mega-cycle-tour-1'
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
    assert len(results)==77 and len({r['competitorId'] for r in results})==77
    # Identity cross-check: the confirmed Kot Bogumił is the same athlete in both 2024 MEGA rounds.
    kot1=next(r for r in prior['results'] if key(r['competitorName'])==key('KOT BOGUMIŁ'))
    kot2=next(r for r in results if key(r['competitorName'])==key('KOT BOGUMIŁ'))
    assert kot1['competitorId']==kot2['competitorId']
    tour={'id':TOUR_ID,'name':'II tura — Puchar LODY MARSJANO (25.02.2024)','date':'2024-02-25',
          'status':'FINAL','sourceOfficial':True,'sectorCount':7,'results':results}
    new_cycle=deepcopy(cycle)
    new_cycle['tours'].append(tour)
    new_cycle['source']=(cycle.get('source','')+' II tura: karty 82–96 i tabela 608–609, data 25.02.2024; stanowiska 71 i 79 nie figurują w wynikach.').strip()
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
        backup=hist/('before-mega2024-tour2-r%d.json'%before['revision'])
        if backup.exists(): assert json.loads(backup.read_bytes())==before
        else:atomic(backup,before)
        assert json.loads(backup.read_bytes())==before
        atomic(path,after)
        assert json.loads(path.read_bytes())==after
        print('SAVED: MEGA CUP 2024 II tura, 77 starters, 7 sectors, 6/4, new players',len(new))

if __name__=='__main__':run(pathlib.Path(sys.argv[1]))
