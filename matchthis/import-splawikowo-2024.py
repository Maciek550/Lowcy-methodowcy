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
            pid='mt2024-sp-'+key(n).lower()
            assert pid not in by_id
            p=dict(id=pid,lastName=last,firstName=first,aliases=[n],archived=False,nameNeedsReview=False)
            by_id[pid]=p;new.append(p);ids={pid}
        assert len(ids)==1
        pid=next(iter(ids));p=by_id[pid]
        rows.append(dict(competitorId=pid,competitorName=p['lastName']+' '+p['firstName'],peg=int(peg),sector=sector,weightG=int(weight),officialPlace=int(place)))
    assert len({r['competitorId'] for r in rows})==55 and sorted(r['peg'] for r in rows)==list(range(1,56))
    for sector in 'ABCDE':
        members=[r for r in rows if r['sector']==sector]
        assert [r['officialPlace'] for r in sorted(members,key=lambda r:-r['weightG'])]==list(range(1,12))
    day='2024-12-07';eid='mt2024-splawikowo'
    tour=dict(id=eid+'-round-1',name='I tura',date=day,status='FINAL',sourceOfficial=True,sectorCount=5,results=rows)
    event=dict(id=eid,name='Puchar Sklepu Spławikowo — 7.12.2024',date=day,year=2024,kind='EVENT',archived=True,source='Losowanie i oficjalna tabela wyników organizatora, 7 grudnia 2024',rounds=[tour])
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
        assert not any(e['id']==event['id'] or (e.get('date')==event['date'] and 'SPŁAWIKOWO' in e['name'].upper()) for e in d['events'])
        updated=deepcopy(state);updated['data']['players'].extend(new);updated['data']['events'].append(event)
        updated['revision']+=1;updated['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
        history=directory/'mt73-history';history.mkdir(mode=0o700,exist_ok=True)
        backup=history/('before-splawikowo-2024-r%d.json'%state['revision'])
        if backup.exists(): assert json.loads(backup.read_bytes())==state
        else:write(backup,state)
        write(path,updated)
        assert json.loads(path.read_bytes())==updated
        print('Verified 55 results, 5 sectors, new players',len(new))
NEW_NAMES={'WYSOCKI WŁODZIMIERZ','OCHELSKI JAKUB','SZYSZKOWSKI KONRAD','MURUK PIOTR','WALASIK PAWEŁ','WALEWSKI MICHAŁ'}
SOURCE='Miejsce ogólne;Zawodnik;Stanowisko;Sektor;Waga (g);Miejsce sektorowe;ID w publicznej bazie SMALL2\n1;KUPISZ MAREK;3;A;18400;1;mt2026-person-kupisz-marek\n2;KULKA ARTUR;45;E;12000;1;mt2026-person-kulka-artur\n3;WOŁAMIN ANDRZEJ;12;B;11900;1;mt2025-sensas-dec06-person-48,mt2026-person-wolamin-andrzej\n4;KOŁAKOWSKI KONRAD;43;D;9570;1;mt2025-traper-cup-person-17\n5;PEIL ANNA;23;C;6760;1;mt2025-float_king_2025-person-60\n6;JAROS ARTUR;7;A;11720;2;mt2026-standalone-jarosz-artur\n7;FIC PAWEŁ;51;E;10280;2;mt2026-standalone-fic-pawe\n8;PAMIĘTA JAKUB;22;B;9910;2;mt2026-person-pamieta-jakub\n9;STRZELCZYK PAWEŁ;40;D;7970;2;mt2026-person-strzelczyk-pawe\n10;KOWALSKI JAROSŁAW;31;C;6625;2;mt2026-person-kowalski-jaros-aw\n11;KORYTOWSKI ZBIGNIEW;6;A;11080;3;mt2026-person-korytowski-zbigniew\n12;KOWALCZYK WOJCIECH;17;B;9810;3;mt2026-person-kowalczyk-wojciech\n13;BOLEK KAMIL;46;E;9385;3;mt2025-maver-super-cup-oct-person-9\n14;WASILEWSKI WOJCIECH;44;D;7470;3;mt2026-person-wasilewski-wojciech\n15;JURKIEWICZ SŁAWOMIR;30;C;6600;3;mt2025-traper-cup-person-13\n16;WYSOCKI WŁODZIMIERZ;4;A;10440;4;\n17;BOROWICZ ZBIGNIEW;50;E;8105;4;mt2026-person-borowicz-zbigniew\n18;KURCZYŃSKI MARIUSZ;18;B;8060;4;mt2026-person-kurczynski-mariusz\n19;DĄBKOWSKI PAWEŁ;35;D;6755;4;mt2025-sensas-ii-eliminacje-person-10\n20;MIELCZAREK JAKUB;32;C;6500;4;mt2026-person-mielczarek-jakub\n21;OPAŁKA PIOTR;10;A;9880;5;mt2025-sensas-dec06-person-60\n22;OCHELSKI JAKUB;49;E;7865;5;\n23;BEDNAREK ANDRZEJ;19;B;7710;5;mt2026-person-bednarek-andrzej\n24;SZCZĘSNY JACEK;34;D;6445;5;mt2025-sensas-dec06-person-55\n25;CZUPRYNA PIOTR;29;C;6225;5;mt2025-sensas-dec06-person-47\n26;SZCZĘSNY MARIUSZ;8;A;9665;6;mt2026-person-szczesny-mariusz\n27;SZYSZKOWSKI KONRAD;53;E;7350;6;\n28;KIEBASZ JAN;13;B;6825;6;mt2026-standalone-kiebasz-jan\n29;CELEJ ADRIAN;24;C;5745;6;mt2026-person-celej-adrian\n30;MURUK PIOTR;39;D;5290;6;\n31;WALASIK PAWEŁ;9;A;9000;7;\n32;CHYB ANDRZEJ;52;E;7150;7;mt2026-person-chyb-andrzej\n33;ŚWINARSKI KRZYSZTOF;21;B;5590;7;mt2025-traper-cup-person-38\n34;POPIS PIOTR;36;D;5265;7;mt2025-sensas-dec06-person-24\n35;ĆWIKŁA DANIEL;33;C;5075;7;mt2026-person-cwik-a-daniel\n36;KMIEĆ WŁODZIMIERZ;5;A;8395;8;mt2026-person-kmiec-w-odzimierz\n37;PIECZYWEK PRZEMYSŁAW;47;E;7025;8;mt2026-person-pieczywek-przemys-aw\n38;ZIEMNIEWICZ DARIUSZ;16;B;5420;8;mt2026-person-ziemniewicz-dariusz\n39;FABISIAK MACIEJ;37;D;5155;8;mt2026-person-fabisiak-maciej\n40;DUDA ZBIGNIEW;28;C;4560;8;mt2026-person-duda-zbigniew\n41;BAKUN NORBERT;11;A;7865;9;mt2025-maver-super-cup-oct-person-28\n42;URBANOWSKI TOMASZ;48;E;6295;9;mt2025-sensas-dec06-person-56\n43;WALEWSKI MICHAŁ;41;D;4965;9;\n44;KOT KAMIL;14;B;4540;9;mt2025-splawikowo-dec07-person-10\n45;KOZICKI JAKUB;25;C;4360;9;mt2026-person-kozicki-jakub\n46;PIETRUSZKA JACEK;1;A;7195;10;mt2025-sensas-dec06-person-65\n47;KWAŚNIEWSKI MACIEJ;55;E;5555;10;mt2025-sensas-dec06-person-5\n48;KRAWIEC WŁODZIMIERZ;38;D;4750;10;mt2026-person-krawiec-w-odzimierz\n49;KLEIN KRZYSZTOF;20;B;4405;10;mt2026-person-klein-krzysztof\n50;KUCHARCZYK MARCIN;27;C;3935;10;mt2025-sensas-dec06-person-6\n51;KOLASZA ROBERT;2;A;6740;11;mt2026-person-kolasza-robert\n52;WAWRZYŃCZAK DARIUSZ;54;E;5500;11;mt2025-matchthis_puchar_2025-person-65\n53;FLISEK ADAM;15;B;4220;11;mt2026-person-flisek-adam\n54;STEFANIUK RAFAŁ;42;D;4150;11;mt2026-person-stefaniuk-rafa\n55;FABIJAŃCZUK DARIUSZ;26;C;3730;11;mt2025-mega-round-1-69-89,mt2025-sensas-ii-eliminacje-person-11\n'
if __name__=="__main__": run(pathlib.Path(sys.argv[1]))
