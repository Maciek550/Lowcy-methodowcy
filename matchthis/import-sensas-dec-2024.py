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
            pid='mt2024-sensas-dec-'+key(n).lower()
            assert pid not in by_id
            p=dict(id=pid,lastName=last,firstName=first,aliases=[n],archived=False,nameNeedsReview=False)
            by_id[pid]=p;new.append(p);ids={pid}
        assert len(ids)==1
        pid=next(iter(ids));p=by_id[pid]
        rows.append(dict(competitorId=pid,competitorName=p['lastName']+' '+p['firstName'],peg=int(peg),sector=sector,weightG=int(weight),officialPlace=float(place)))
    assert len({r['competitorId'] for r in rows})==69 and sorted(r['peg'] for r in rows)==list(range(1,70))
    for sector in 'ABCDEF':
        members=[r for r in rows if r['sector']==sector]
        assert len(members)==(12 if sector in 'ABC' else 11) and all(r['officialPlace']==1+sum(o['weightG']>r['weightG'] for o in members)+sum(o is not r and o['weightG']==r['weightG'] for o in members)/2 for r in members)
    r=next(r for r in rows if r['peg']==58)
    assert (r['competitorName'],r['sector'],r['weightG'],r['officialPlace'])==('WYSOCKI WŁODZIMIERZ','E',3775,5)
    day='2024-12-08';eid='mt2024-sensas-dec'
    tour=dict(id=eid+'-round-1',name='I tura',date=day,status='FINAL',sourceOfficial=True,sectorCount=6,results=rows)
    event=dict(id=eid,name='SENSAS CHALLENGE 2025 — eliminacje 8.12.2024',date=day,year=2024,kind='EVENT',archived=True,source='Losowanie i oficjalna tabela wyników organizatora, 8 grudnia 2024',rounds=[tour])
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
        assert not any(e['id']==event['id'] or (e.get('date')==event['date'] and 'SENSAS' in e['name'].upper()) for e in d['events'])
        updated=deepcopy(state);updated['data']['players'].extend(new);updated['data']['events'].append(event)
        updated['revision']+=1;updated['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
        history=directory/'mt73-history';history.mkdir(mode=0o700,exist_ok=True)
        backup=history/('before-sensas-dec-2024-r%d.json'%state['revision'])
        if backup.exists(): assert json.loads(backup.read_bytes())==state
        else:write(backup,state)
        write(path,updated)
        assert json.loads(path.read_bytes())==updated
        print('Verified 69 results, 6 sectors, new players',len(new))
NEW_NAMES={'KOSENDEK DARIUSZ','URBAŃSKI TOMASZ','PIELKA HENRYK','KALINOWSKI ZBIGNIEW','FIKUS MARCIN','BRZEŹNICKI MAREK'}
SOURCE='Miejsce ogólne;Zawodnik;Stanowisko;Sektor;Waga (g);Miejsce sektorowe;\n1;STANIAK MARIUSZ;15;B;21210;1;\n2;KOWALCZYK WOJCIECH;4;A;19530;1;\n3;PAMIĘTA JAKUB;31;C;17200;1;\n4;STRZELCZYK PAWEŁ;37;D;8820;1;\n5;KORYTOWSKI ZBIGNIEW;52;E;5710;1;\n6;KOSENDEK DARIUSZ;60;F;4910;1;\n7;KUPISZ MAREK;20;B;19030;2;\n8;KOWALSKI MARCIN;6;A;17130;2;\n9;DERLĄGA JAKUB;34;C;11650;2;\n10;ŚWINARSKI KRZYSZTOF;40;D;7870;2;\n11;FOŁTYN ARTUR;48;E;4720;2;\n12;KOŁAKOWSKI KONRAD;69;F;4400;2;\n13;FIC PAWEŁ;18;B;15210;3;\n14;PEIL ANNA;11;A;14500;3;\n15;KULKA ARTUR;32;C;10190;3;\n16;DOBROWOLSKI PIOTR;38;D;7160;3;\n17;WASILEWSKI WOJCIECH;57;E;4500;3;\n18;KURCZYŃSKI MARIUSZ;62;F;4045;3;\n19;MIELCZAREK JAKUB;22;B;14230;4;\n20;LEWANDOWSKI WOJCIECH;10;A;13800;4;\n21;SZEREMETA MATEUSZ;27;C;8850;4;\n22;WĄSIK BOGDAN;41;D;6935;4;\n23;FABISIAK MACIEJ;55;E;3795;4;\n24;ĆWIKŁA DANIEL;64;F;3775;4;\n25;BIEŃ PAWEŁ;14;B;13210;5;\n26;KOWALSKI JAROSŁAW;1;A;12670;5;\n27;LEWKOWICZ MACIEJ;30;C;8500;5;\n28;DUDA ZBIGNIEW;39;D;6690;5;\n29;WYSOCKI WŁODZIMIERZ;58;E;3775;5;\n30;JURKIEWICZ SŁAWOMIR;61;F;3740;5;\n31;BOLEK KAMIL;9;A;12390;6;\n32;DĄBKOWSKI PAWEŁ;21;B;11160;6;\n33;CHYB ANDRZEJ;26;C;7810;6;\n34;TYCZKA ŁUKASZ;46;D;6375;6;\n35;CZUPRYNA PIOTR;50;E;3745;6;\n36;PIETRUSZKA JACEK;63;F;3705;6;\n37;KOWALSKI PAWEŁ;7;A;11330;7;\n38;SZYSZKOWSKI KONRAD;24;B;11000;7;\n39;BEDNAREK ANDRZEJ;29;C;7500;7;\n40;URBAŃSKI TOMASZ;43;D;5970;7;\n41;WAWRZYŃCZAK DARIUSZ;53;E;3730;7;\n42;KMIEĆ WŁODZIMIERZ;59;F;3655;7;\n43;ŁOSZEWSKI GRZEGORZ;16;B;10790;8;\n44;SZCZĘSNY MARIUSZ;12;A;10230;8;\n45;KOLASZA ROBERT;28;C;7335;8;\n46;BOROWICZ ZBIGNIEW;47;D;5500;8;\n47;CELEJ ADRIAN;49;E;3500;8;\n48;WLAZŁO PAWEŁ;68;F;3140;8;\n49;ZIEMNIEWICZ DARIUSZ;13;B;10360;9;\n50;WITOS ARKADIUSZ;3;A;10000;9;\n51;BŁAŻEJEWSKI PAWEŁ;25;C;7245;9;\n52;SZCZĘSNY JACEK;44;D;5095;9;\n53;SALWA WOJCIECH;65;F;2910;9;\n54;JAROS ARTUR;56;E;2850;9;\n55;PIELKA HENRYK;5;A;8965;10;\n56;KALINOWSKI ZBIGNIEW;17;B;8200;10;\n57;WOŁOSIUK SŁAWOMIR;35;C;6645;10;\n58;TYCZKA ALEKSANDER;45;D;4820;10;\n59;KOZICKI JAKUB;51;E;2845;10;\n60;BAKUN NORBERT;67;F;2735;10;\n61;FABIJAŃCZUK DARIUSZ;2;A;8805;11;\n62;FLISEK ADAM;19;B;7935;11;\n63;STEFANIUK RAFAŁ;33;C;5465;11;\n64;KRAWIEC WŁODZIMIERZ;42;D;3190;11;\n65;WRÓBLEWSKI ARTUR;54;E;2660;11;\n66;KWAŚNIEWSKI MACIEJ;66;F;1755;11;\n67;WOŁAMIN ANDRZEJ;8;A;8685;12;\n68;FIKUS MARCIN;23;B;7500;12;\n69;BRZEŹNICKI MAREK;36;C;4960;12;'
if __name__=="__main__": run(pathlib.Path(sys.argv[1]))
