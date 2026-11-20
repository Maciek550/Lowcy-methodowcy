#!/usr/bin/env python3
"""Import documented VI MEGA 2024 round, no synthetic pegs and no changed earlier tours."""
import collections,csv,datetime,fcntl,json,os,pathlib,sys,tempfile,unicodedata,base64,zlib,hashlib
from copy import deepcopy
from io import StringIO
CYCLE_ID='mt2024-mega-match-this-cup-cycle'
TOUR_ID='mt2024-mega-cycle-tour-6'
SOURCE_BYTES=zlib.decompress(base64.b64decode('eNpVVcuO3DYQvOsr9AmiSEoUeKIeO8uRRhxQEgbSzVgMnABJbNgOcl4skB/IJciv+BjPf6Wa1Aw2p310sbu6urr124dfr/rz9aP+en359umL/uP688efvunPv3x4ueqvn37/8nJNejentTssJ3t71bk2WshSaqVzVia17W5v6dlcOsQ4YkUupZYhdrGzm1Lje9PaZdq0QFhVmdQshEfjN3d/KumpEhlyUGyz3Wm03cU2W9oaH54XVLlimS4DpHeDmTaTeld3fsY/jc4rJGB5LG4mO3SXqbfpxR0b2zXPoIwipZJgEjNstkH8aPql1hWCnHGwi/T6pXk2nt5P23pyo0Zl8Ff4ESuc/bbW60CI2Z3AhV4iR5VLJIsFGmtub4Q4+K07OL8RPWAkzyhfAJ1s9+PP9HJ7de1m8QeBSElJZIqAaZfWpFttD6SJZkLXWuRMBiUUiJjJ9NDpZA1oSkR5pnYlVDKZwTTP6cnMHcnICoqLbG9UJWbonlDVBbFPxne9ZiVVoEZ4rGCmGW978+i0ChRUJIgcI0Ztewx7XrzOM4ry3QgqaV2N9C5IdbZuBoIRQpZZGIVK6q4dqXJqxhZKHXWeE0u1SwnA7dXcvnfHONHdNDkHSJEZYydHzJzkNmjj0KKvEZ4QoV226w05ZhQYmm3tH2lIMZllcbAqabbl7NfR3LmSYCKrouUR7obumJrWk9p5qRuMU2ZRzQocfDB90EFRkBcyjqJKnkxtj3AEKvQPX+cVoQoZW60S0DuDXvQN5tHYEfMEplBVHEiVDN20PTA1qjkk4gwgUaIPGUAH1y7j3gTPqYgqo2cquNu/rxGIcE7viyIOtUpm5DXjMoEpfDdAxUBUyChllUyu/h8JWBj+PUKPUAwoFYs5TK93YXS9G71pNSfdVCai5lUCwNkE/0WXcpJOCdrn2LCdLDx+l4MkK7Iq2gcF/L9/DXavsGPwtIVFgYGseYa5d0/oA8LvHhYMgLJQIQkAm9nvxWNXRU4IxcNVAoIM5YNzbq9LH3JwKkI0VUCAghnekxCIqyIPbSB+7uwAj490QxHhYr834ent7WzSptuMXzEGSrxfO0QvJOHJjo8FEWV4L6KvgTjQObor0NAYhALkfkWAqA00Skfnw8EUFaJgFtyC6Mn6/TV+mVDtgp0g9jIuBkkY5t2nPZgMyKw7LUUezmnOcIZW6Hq/xzKnKO5MSM+Syzo5OrZP3oyNnTZcGckBETzuOCA9Orh9N/27T4YUBKmyqC8jS2O77t8MiWDByyguS27/XOwYTzalmrbZPWlZUAZa7qATS5rntU5BEUioU4b8MqwFgrRVP/6exvWxFFIBwe4LTiydX+eo1OMiy4qY0EXOY7N22M24fzsKFurE1QIAK7CRCO+vWREUK4roNpb8Bw1F9nI='))
assert hashlib.sha256(SOURCE_BYTES).hexdigest()=='93f5e8f8fde44ca7121483e3b67e312423b237da5638532e9d64fd3a4ffcd234'
SOURCE_TEXT=SOURCE_BYTES.decode('utf-8')
def key(s):return ''.join(c for c in unicodedata.normalize('NFD',str(s).upper().replace('Ł','L')) if c.isalnum())
def load_source():
  rows=list(csv.DictReader(StringIO(SOURCE_TEXT),delimiter=';'))
  assert len(rows)==58 and len({key(r['name']) for r in rows})==58
  assert {int(r['peg']) for r in rows}==set(range(2,63))-{18,36,60}
  sector_pegs={'A':set(range(2,14)),'B':set(range(14,27))-{18},'C':set(range(27,40))-{36},'D':set(range(40,51)),'E':set(range(51,63))-{60}}
  for sector,pegs in sector_pegs.items():
    members=[r for r in rows if r['sector']==sector]
    assert {int(r['peg']) for r in members}==pegs,(sector,len(members))
    for r in members:
      w=int(r['weight'])
      place=1+sum(int(other['weight'])>w for other in members)+sum(other is not r and int(other['weight'])==w for other in members)/2
      assert float(r['place'])==place,(sector,r,place)
  assert sum(int(r['weight']) for r in rows)==298400
  assert len({r['source'] for r in rows})==5
  return rows
def build(data):
  found=[c for c in data['cycles'] if c['id']==CYCLE_ID]
  assert len(found)==1
  cycle=found[0]
  assert cycle['year']==2024 and cycle['expectedTours']==6 and cycle['countedTours']==4
  assert len(cycle['tours'])==5 and [t['id'] for t in cycle['tours']]==['mt2024-mega-cycle-tour-'+str(i) for i in range(1,6)]
  assert [len(t['results']) for t in cycle['tours']]==[79,77,73,73,63]
  by_id={p['id']:p for p in data['players']}
  by_name=collections.defaultdict(set)
  for pid,p in by_id.items():
    for n in [p['lastName']+' '+p['firstName']]+p.get('aliases',[]):by_name[key(n)].add(pid)
  new=[];results=[]
  for r in load_source():
    name=r['name'];ids=set(by_name[key(name)])
    if ids:
      exact={i for i in ids if (by_id[i]['lastName']+' '+by_id[i]['firstName']).upper()==name.upper()}
      if exact: assert len(exact)==1,('ambiguous canonical',name,exact);ids=exact
      else: assert len(ids)==1,('ambiguous alias',name,ids)
    else:
      # No silent new identity on an unverified handwritten spelling.
      raise AssertionError('UNRESOLVED_PERSON: '+name)
    assert len(ids)==1
    pid=next(iter(ids));p=by_id[pid]
    results.append({'competitorId':pid,'competitorName':p['lastName']+' '+p['firstName'],'sector':r['sector'],'peg':int(r['peg']),'weightG':int(r['weight']),'officialPlace':float(r['place'])})
  assert len(results)==58 and len({r['competitorId'] for r in results})==58
  assert next(r for r in results if r['peg']==2)['competitorId']==next(r for r in cycle['tours'][4]['results'] if key(r['competitorName'])==key('KOT BOGUMIŁ'))['competitorId']
  tour={'id':TOUR_ID,'name':'VI tura — Puchar MATCHPRO (13.10.2024)','date':'2024-10-13','status':'FINAL','sourceOfficial':True,'sectorCount':5,'results':results}
  revised=deepcopy(cycle);revised['tours'].append(tour)
  revised['source']=(cycle.get('source','')+' VI tura: karty sektorowe nr 217–221, 13.10.2024; 58 startów, bez pustych stanowisk 18, 36, 60.').strip()
  return revised,new
def atomic(path,obj):
  fd,tmp=tempfile.mkstemp(prefix='.mega2024-t6-',dir=path.parent)
  try:
    with os.fdopen(fd,'w',encoding='utf8') as f:json.dump(obj,f,ensure_ascii=False,separators=(',',':'));f.flush();os.fsync(f.fileno())
    os.chmod(tmp,0o600);os.replace(tmp,path)
  finally:
    if os.path.exists(tmp):os.unlink(tmp)
def run(private):
  assert private.name=='.mt41-private'
  path=private/'state-mt73.json'
  assert path.is_file() and not path.is_symlink()
  with (private/'mt73.lock').open('a') as lock:
    fcntl.flock(lock,fcntl.LOCK_EX)
    before=json.loads(path.read_bytes());cycle,new=build(before['data'])
    assert not new
    after=deepcopy(before)
    ix=next(i for i,c in enumerate(after['data']['cycles']) if c['id']==CYCLE_ID)
    after['data']['cycles'][ix]=cycle
    after['revision']+=1;after['seeded']=False;after['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat()
    history=private/'mt73-history';history.mkdir(mode=0o700,exist_ok=True)
    backup=history/('before-mega2024-tour6-r%d.json'%before['revision'])
    if backup.exists():assert json.loads(backup.read_bytes())==before
    else:atomic(backup,before)
    assert json.loads(backup.read_bytes())==before
    atomic(path,after);assert json.loads(path.read_bytes())==after
    print('IMPORTED: VI tura, 58 verified results, 5 sectors; old data untouched')
if __name__=='__main__':run(pathlib.Path(sys.argv[1]))
