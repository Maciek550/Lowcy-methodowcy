#!/usr/bin/env python3
"""Organizer-approved name correction PEIL ANNA only in MEGA FINAL 2025.

PEL ANNA -> PEIL ANNA in two result display names and the single
corresponding competitor record. Preserve original sourceName and legacy alias,
all weights/places/pegs, all other athletes/events, and full rollback copy.
ŚWINARSKI KRZYSZTOF is already correct and is guard-checked, not rewritten.
"""
from pathlib import Path
import copy,datetime,fcntl,json,os,secrets,sys

EID='mt2025-mega_final_2025'
PID='mt2025-mega_final_2025-person-51'
OTHER='mt2025-mega_final_2025-person-36'
def require(ok,reason):
    if not ok: raise RuntimeError(reason)
def read(p):return json.loads(p.read_text(encoding='utf8'))
def change(original):
    updated=copy.deepcopy(original)
    data=updated['data']
    ev=[e for e in data['events'] if e.get('id')==EID]
    require(len(ev)==1 and len(ev[0].get('rounds',[]))==2,'Missing/duplicate final')
    event=ev[0]
    assert event['year']==2025
    ids=event.get('entrantIds',[])
    require(PID in ids and OTHER in ids,'Unexpected entrant identities')
    players=[p for p in data['players'] if p['id']==PID]
    require(len(players)==1,'Expected one Anna player record')
    person=players[0]
    require(person['firstName']=='ANNA' and person['lastName'] in ('PEL','PEIL'),'Unexpected Anna player name')
    alias=person.get('aliases')
    require(isinstance(alias,list) and 'PEL ANNA' in alias,'Original alias missing')
    require('PEIL ANNA' not in alias or person['lastName']=='PEIL','Conflicting preexisting alias')
    other=[p for p in data['players'] if p['id']==OTHER]
    require(len(other)==1 and other[0]['lastName']=='ŚWINARSKI' and other[0]['firstName']=='KRZYSZTOF','ŚWINARSKI competitor unexpectedly changed')
    changes=0
    for t in event['rounds']:
        require(t['status']=='FINAL' and len(t['results'])==54,'Round structure changed')
        rows=[r for r in t['results'] if r['competitorId']==PID]
        require(len(rows)==1 and rows[0]['competitorName'] in ('PEL ANNA','PEIL ANNA'),'Wrong Anna result')
        require(rows[0]['sourceName']=='PEL ANNA','Original provenance changed')
        require(rows[0]['sector'] in ('C','F') and type(rows[0]['peg']) is int,'Anna stand missing')
        actual=(rows[0]['sector'],rows[0]['peg'])
        require(actual==(('C',23) if t['id'].endswith('round1') else ('F',53)),
                'Anna stands/sector conflict '+str(actual))
        swin=[r for r in t['results'] if r['competitorId']==OTHER]
        require(len(swin)==1 and swin[0]['competitorName']=='ŚWINARSKI KRZYSZTOF','ŚWINARSKI result differs')
        if rows[0]['competitorName']=='PEL ANNA':
            rows[0]['competitorName']='PEIL ANNA';changes+=1
    if person['lastName']=='PEL':person['lastName']='PEIL';changes+=1
    if 'PEIL ANNA' not in alias:alias.append('PEIL ANNA');changes+=1
    require(changes in (0,4),'Partial name correction detected')
    return updated,changes

def atomic(file,contents):
    tmp=file.with_name(file.name+'.next-'+secrets.token_hex(8))
    fd=os.open(tmp,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    try:
        with os.fdopen(fd,'wb') as f:
            f.write(contents);f.flush();os.fsync(f.fileno())
        os.replace(tmp,file)
    finally:
        if tmp.exists():tmp.unlink()

def main():
    require(len(sys.argv)==3 and sys.argv[1] in ('preview','apply','verify'),'Usage: correct-peil-anna-final-2025.py preview|apply|verify WEBROOT')
    mode=sys.argv[1]
    web=Path(sys.argv[2]).resolve(strict=True)
    require(web.name in ('test-webroot','public_html'),'Unsupported webroot')
    private=web/'.mt41-private'
    statefile=private/'state-mt73.json'
    require(private.is_dir() and not private.is_symlink() and statefile.is_file() and not statefile.is_symlink(),'Invalid state')
    require((web/'mt73-store.php').is_file(),'No backend installed')
    lockfile=private/'mt73.lock'
    require(not lockfile.is_symlink(),'Unsafe lock')
    with lockfile.open('a+') as lock:
        os.chmod(lockfile,0o600);fcntl.flock(lock,fcntl.LOCK_EX)
        old_bytes=statefile.read_bytes()
        old=json.loads(old_bytes)
        require(type(old['revision']) is int and old['revision']>=8,'Unexpected revision before name correction')
        updated,changes=change(old)
        if mode=='verify':require(changes==0,'Name correction not applied yet')
        if mode!='apply' or changes==0:
            print(json.dumps({'status':{'preview':'PREVIEW','verify':'VERIFIED','apply':'ALREADY_APPLIED'}[mode],
              'revision':old['revision'],'changes':changes,'expectedName':'PEIL ANNA','verifiedOther':'ŚWINARSKI KRZYSZTOF'},ensure_ascii=False))
            return
        hist=private/'mt73-history';require(not hist.is_symlink(),'History is symlink')
        hist.mkdir(mode=0o700,exist_ok=True)
        stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')
        copyfile=hist/('before-peil-anna-final-2025-'+stamp+'-'+secrets.token_hex(6)+'.json')
        fd=os.open(copyfile,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
        with os.fdopen(fd,'wb') as f:
            f.write(old_bytes);f.flush();os.fsync(f.fileno())
        require(copyfile.read_bytes()==old_bytes,'Backup read-back mismatch')
        updated['revision']=old['revision']+1
        updated['seeded']=False
        updated['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
        atomic(statefile,json.dumps(updated,ensure_ascii=False,separators=(',',':')).encode('utf8'))
        actual=read(statefile)
        require(actual==updated,'Saved data differs from read-back')
        _,repeated=change(actual)
        require(repeated==0,'Name correction did not persist')
        print(json.dumps({'status':'SAVED_AND_READ_BACK','changed':changes,'revision':actual['revision'],
          'name':'PEIL ANNA','correctOther':'ŚWINARSKI KRZYSZTOF','backup':copyfile.name},ensure_ascii=False))
if __name__=='__main__':main()
