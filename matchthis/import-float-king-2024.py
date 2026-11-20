import collections, csv, datetime, fcntl, json, os, pathlib, sys, tempfile, unicodedata
from copy import deepcopy
from io import StringIO

def key(s):
    return ''.join(c for c in unicodedata.normalize('NFD',s.upper().replace('Ł','L')) if c.isalnum())

def build(data):
    by_name=collections.defaultdict(set)
    by_id={p['id']:p for p in data['players']}
    for pid,p in by_id.items():
        for n in [p['lastName']+' '+p['firstName']]+p.get('aliases',[]): by_name[key(n)].add(pid)
    new=[]; rows=[]
    for rank,n,peg,sector,weight,place,candidates in list(csv.reader(StringIO(SOURCE),delimiter=';'))[1:]:
        ids=by_name[key(n)]
        if n in ('WOŁAMIN ANDRZEJ','FABIJAŃCZUK DARIUSZ'):
            exact=n.replace('WOŁAMIN','WOLAMIN')
            ids={i for i in ids if by_id[i]['lastName']+' '+by_id[i]['firstName']==exact}
            assert len(ids)==1
        elif not ids:
            assert n in NEW_NAMES
            last,first=n.split()
            pid='mt2024-fk-'+key(n).lower()
            assert pid not in by_id
            p=dict(id=pid,lastName=last,firstName=first,aliases=[n],archived=False,nameNeedsReview=False)
            by_id[pid]=p;new.append(p);ids={pid}
        assert len(ids)==1
        pid=next(iter(ids));p=by_id[pid]
        rows.append(dict(competitorId=pid,competitorName=p['lastName']+' '+p['firstName'],peg=int(peg),sector=sector,weightG=int(weight),officialPlace=float(place)))
    assert len({r['competitorId'] for r in rows})==65 and sorted(r['peg'] for r in rows)==list(range(1,66))
    for sector in 'ABCDEF':
        members=[r for r in rows if r['sector']==sector]
        assert len(members) in (10,11) and all(r['officialPlace']==1+sum(o['weightG']>r['weightG'] for o in members)+sum(o is not r and o['weightG']==r['weightG'] for o in members)/2 for r in members)
    day='2024-11-09';eid='mt2024-float-king'
    tour=dict(id=eid+'-round-1',name='I tura',date=day,status='FINAL',sourceOfficial=True,sectorCount=6,results=rows)
    event=dict(id=eid,name='FLOAT KING — 9.11.2024',date=day,year=2024,kind='EVENT',archived=True,source='Losowanie i oficjalna tabela wyników organizatora, 9 listopada 2024',rounds=[tour])
    return event,new

def write(path,data):
    fd,temp=tempfile.mkstemp(dir=path.parent)
    try:
        with os.fdopen(fd,'w',encoding='utf8') as out:
            json.dump(data,out,ensure_ascii=False,separators=(',',':'));out.flush();os.fsync(out.fileno())
        os.replace(temp,path)
    finally:
        if os.path.exists(temp): os.unlink(temp)

def run(directory):
    path=directory/'state-mt73.json'
    with (directory/'mt73.lock').open('a') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX)
        state=json.loads(path.read_bytes());d=state['data']; event,new=build(d)
        if event in d['events']:print('already verified');return
        assert not any(e['id']==event['id'] or (e.get('date')==event['date'] and 'FLOAT KING' in e['name'].upper()) for e in d['events'])
        updated=deepcopy(state);updated['data']['players'].extend(new);updated['data']['events'].append(event)
        updated['revision']+=1;updated['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
        history=directory/'mt73-history';history.mkdir(mode=0o700,exist_ok=True)
        backup=history/('before-float-king-2024-r%d.json'%state['revision'])
        if backup.exists(): assert json.loads(backup.read_bytes())==state
        else:write(backup,state)
        write(path,updated)
        assert json.loads(path.read_bytes())==updated
        print('Verified 65 results, 6 sectors, new players',len(new))
NEW_NAMES=['CHŁOPECKI PIOTR', 'GRABOWSKI ARTUR', 'KASPRZAK MARCIN', 'KRZYKOWSKI ANDRZEJ', 'KŁOKOWSKI MARCIN', 'LOREK PAWEŁ', 'ONISZKO TOMASZ', 'STĄPÓR MACIEJ', 'SZAŁAJ MARCIN', 'TOMCZYK SŁAWOMIR', 'WOZIŃSKI MATEUSZ', 'WOŁOSIUK SŁAWOMIR', 'WĄSIK BOGDAN']
SOURCE='rank;name;peg;sector;weight;points;id\n1;DUDA ZBIGNIEW;48;E;14800;1.0;\n2;ĆWIKŁA DANIEL;43;D;12760;1.0;\n3;JAROS ARTUR;1;A;12710;1.0;\n4;BOLEK KAMIL;29;C;10630;1.0;\n5;KUCHARSKI SZYMON;65;F;9780;1.0;\n6;GÓRECKI KACPER;16;B;9070;1.0;\n7;SOBOLEWSKI BARTŁOMIEJ;47;E;11780;2.0;\n8;DOBOSZ HENRYK;2;A;10090;2.0;\n9;FABISIAK MACIEJ;33;C;9540;2.0;\n10;BOROWICZ ZBIGNIEW;41;D;9155;2.0;\n11;KURCZYŃSKI MARIUSZ;60;F;8765;2.0;\n12;SZCZĘSNY JACEK;14;B;7295;2.0;\n13;STRZELCZYK PAWEŁ;53;E;11130;3.0;\n14;BIJAK MARIUSZ;57;F;8630;3.0;\n15;SZLĘK PRZEMYSŁAW;44;D;7890;3.0;\n16;FIC PAWEŁ;26;C;7670;3.0;\n17;KRZYKOWSKI ANDRZEJ;20;B;7250;3.0;\n18;PIETRZAK JACEK;4;A;6575;3.0;\n19;KOWALSKI MARCIN;49;E;10450;4.0;\n20;LOREK PAWEŁ;59;F;8500;4.0;\n21;KUPISZ MAREK;39;D;7705;4.0;\n22;PEIL ANNA;30;C;7235;4.0;\n23;ŚWINARSKI KRZYSZTOF;15;B;6415;4.0;\n24;ŚMIETANKA KAROL;11;A;5500;4.0;\n25;WĄSIK BOGDAN;54;E;9640;5.0;\n26;KMIEĆ WŁODZIMIERZ;42;D;7640;5.0;\n27;KLEIN KRZYSZTOF;58;F;7590;5.0;\n28;FOŁTYN ARTUR;31;C;5975;5.0;\n29;SZAŁAJ MARCIN;8;A;4975;5.0;\n30;GRABOWSKI ARTUR;21;B;4185;5.0;\n31;STĄPÓR MACIEJ;55;E;8980;6.0;\n32;KOŁAKOWSKI KONRAD;62;F;7120;6.0;\n33;ŁOSZEWSKI GRZEGORZ;34;D;6240;6.0;\n34;TOMCZYK SŁAWOMIR;28;C;5595;6.0;\n35;PRYMAS ROBERT;3;A;4840;6.0;\n36;JADWISZCZAK ANDRZEJ;12;B;4130;6.0;\n37;KOWALCZYK WOJCIECH;61;F;6385;7.0;\n38;STEFANIUK RAFAŁ;37;D;5085;7.0;\n39;WITOS ARKADIUSZ;5;A;4500;7.0;\n40;DOBROWOLSKI PIOTR;24;C;4290;7.0;\n41;WOZIŃSKI MATEUSZ;17;B;4105;7.0;\n42;ANTOSIK ARTUR;46;E;8635;7.5;\n43;CZUPRYNA PIOTR;50;E;8635;7.5;\n44;STASIAK ŁUKASZ;35;D;4925;8.0;\n45;KWAŚNIEWSKI MACIEJ;56;F;4530;8.0;\n46;BEDNAREK ANDRZEJ;7;A;4085;8.0;\n47;WOŁOSIUK SŁAWOMIR;25;C;3750;8.0;\n48;ONISZKO TOMASZ;13;B;3570;8.0;\n49;KŁOKOWSKI MARCIN;45;E;8420;9.0;\n50;KASPRZAK MARCIN;38;D;4475;9.0;\n51;OPAŁKA PIOTR;6;A;4055;9.0;\n52;FABIJAŃCZUK DARIUSZ;64;F;3635;9.0;\n53;PIETRUSZKA JACEK;19;B;3500;9.0;\n54;KOZICKI JAKUB;32;C;3385;9.0;\n55;CHŁOPECKI PIOTR;52;E;7905;10.0;\n56;WOŁAMIN ANDRZEJ;36;D;4110;10.0;\n57;MIROWSKI MIROSŁAW;9;A;3585;10.0;\n58;KLEIN TADEUSZ;63;F;3390;10.0;\n59;ZIEMNIEWICZ DARIUSZ;23;C;3295;10.0;\n60;KORYTOWSKI ZBIGNIEW;18;B;3210;10.0;\n61;GODOS PAWEŁ;51;E;7555;11.0;\n62;GRZYBOWSKI MACIEJ;22;B;3200;11.0;\n63;KOWALSKI JAROSŁAW;10;A;3025;11.0;\n64;STANIAK MARIUSZ;27;C;2965;11.0;\n65;SZCZĘSNY MARIUSZ;40;D;2890;11.0;'
if __name__=="__main__": run(pathlib.Path(sys.argv[1]))
