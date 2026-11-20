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
        if n=='TOSNOWIEC MARCIN':
            exact=n
            ids={i for i in ids if by_id[i]['lastName']+' '+by_id[i]['firstName']==exact}
            assert len(ids)==1
        elif not ids:
            assert n in NEW_NAMES
            last,first=n.split()
            pid='mt2024-traper-'+key(n).lower()
            assert pid not in by_id
            p=dict(id=pid,lastName=last,firstName=first,aliases=[n],archived=False,nameNeedsReview=False)
            by_id[pid]=p;new.append(p);ids={pid}
        assert len(ids)==1
        pid=next(iter(ids));p=by_id[pid]
        rows.append(dict(competitorId=pid,competitorName=p['lastName']+' '+p['firstName'],peg=int(peg),sector=sector,weightG=int(weight),officialPlace=float(place)))
    assert len({r['competitorId'] for r in rows})==53 and sorted(r['peg'] for r in rows)==list(range(1,54))
    for sector in 'ABCD':
        members=[r for r in rows if r['sector']==sector]
        assert len(members)==(14 if sector=='A' else 13) and all(r['officialPlace']==1+sum(o['weightG']>r['weightG'] for o in members)+sum(o is not r and o['weightG']==r['weightG'] for o in members)/2 for r in members)
    day='2024-04-13';eid='mt2024-traper-cup'
    tour=dict(id=eid+'-round-1',name='I tura',date=day,status='FINAL',sourceOfficial=True,sectorCount=4,results=rows)
    event=dict(id=eid,name='TRAPER CUP — 13.04.2024',date=day,year=2024,kind='EVENT',archived=True,source='Karty sektorów A–D organizatora i potwierdzone korekty nazwisk',rounds=[tour])
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
        assert not any(e['id']==event['id'] or (e.get('date')==event['date'] and 'TRAPER' in e['name'].upper()) for e in d['events'])
        updated=deepcopy(state);updated['data']['players'].extend(new);updated['data']['events'].append(event)
        updated['revision']+=1;updated['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
        history=directory/'mt73-history';history.mkdir(mode=0o700,exist_ok=True)
        backup=history/('before-traper-cup-2024-r%d.json'%state['revision'])
        if backup.exists(): assert json.loads(backup.read_bytes())==state
        else:write(backup,state)
        write(path,updated)
        assert json.loads(path.read_bytes())==updated
        print('Verified 53 results, 4 sectors, new players',len(new))
NEW_NAMES=['KLUZIŃSKI SEBASTIAN', 'JAKUBOWSKA JULIA', 'KOŃPA CEZARY', 'BAUM DAWID', 'KOT BOGUMIŁ', 'PLASKOTA TYMOTEUSZ', 'GOSTOMSKI TOMASZ', 'SZAFASZ BARTŁOMIEJ', 'GOLON MICHAEL', 'SOBCZYŃSKI BARTŁOMIEJ', 'CIENIAWSKI ADAM']
SOURCE='rank;name;peg;sector;weight;place;id\n;TOSNOWIEC MARCIN;1;A;8270;1;\n;KRZYŻAK BARTOSZ;2;A;1645;13;\n;DUDA ZBIGNIEW;3;A;2690;7;\n;STEFANIUK RAFAŁ;4;A;1350;14;\n;FOŁTYN ARTUR;5;A;3175;5;\n;PEIL ANNA;6;A;1810;12;\n;ŚWINARSKI KRZYSZTOF;7;A;1820;11;\n;GÓRECKI KACPER;8;A;2285;8;\n;MAZURCZAK GRZEGORZ;9;A;2870;6;\n;KALMUS ŁUKASZ;10;A;2175;9;\n;ADAMOWSKI ŁUKASZ;11;A;3205;4;\n;KURCZYŃSKI MARIUSZ;12;A;4145;3;\n;KORBAN BARTOSZ;13;A;5045;2;\n;RADZISZEWSKI PAWEŁ;14;A;2035;10;\n;KUCHARSKI SZYMON;15;B;1100;9;\n;KRÓLIKOWSKI ARTUR;16;B;1525;3;\n;NIEŚCIOR TOMASZ;17;B;1115;8;\n;KMIEĆ WŁODZIMIERZ;18;B;1330;5;\n;KLUZIŃSKI SEBASTIAN;19;B;1245;6;\n;KUPISZ MAREK;20;B;890;12;\n;WĄSIK BOGDAN;21;B;1125;7;\n;JAKUBOWSKA JULIA;22;B;1080;10;\n;ZALEWSKI GRZEGORZ;23;B;2090;1;\n;STRZELCZYK PAWEŁ;24;B;1000;11;\n;KOWALSKI MARCIN;25;B;1575;2;\n;KWIATEK KRZYSZTOF;26;B;1460;4;\n;WITOS ARKADIUSZ;27;B;790;13;\n;KOWALCZYK WOJCIECH;28;C;2415;5;\n;SALACH MATEUSZ;29;C;710;12;\n;WALCZAK WIKTOR;30;C;2690;4;\n;KOŃPA CEZARY;31;C;790;11;\n;BAUM DAWID;32;C;2775;3;\n;MIROWSKI MIROSŁAW;33;C;3110;2;\n;BALIK NORBERT;34;C;1050;10;\n;CELEJ ADRIAN;35;C;4755;1;\n;PIETRZAK JACEK;36;C;1310;8;\n;FURMAŃCZYK DAMIAN;37;C;1755;7;\n;RADOMSKI KAZIMIERZ;38;C;675;13;\n;KOT BOGUMIŁ;39;C;1055;9;\n;PLASKOTA TYMOTEUSZ;40;C;2410;6;\n;GOSTOMSKI TOMASZ;41;D;615;13;\n;FIC PAWEŁ;42;D;1890;6;\n;RUSEK JAKUB;43;D;1305;8;\n;SZAFASZ BARTŁOMIEJ;44;D;1160;10;\n;ŚMIETANKA KAROL;45;D;2140;5;\n;KRZYCKI ARKADIUSZ;46;D;755;12;\n;GOLON MICHAEL;47;D;805;11;\n;STASIAK ŁUKASZ;48;D;2475;3;\n;SOBCZYŃSKI BARTŁOMIEJ;49;D;1195;9;\n;BOLEK KAMIL;50;D;1680;7;\n;DERLAGA JAKUB;51;D;2405;4;\n;CIENIAWSKI ADAM;52;D;3120;2;\n;DOBOSZ HENRYK;53;D;3645;1;'
if __name__=="__main__": run(pathlib.Path(sys.argv[1]))
