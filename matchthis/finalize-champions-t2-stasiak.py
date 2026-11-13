#!/usr/bin/env python3
"""Approve and persist only STASIAK ŁUKASZ T2 F/60 in MatchThis central SMALL2 state.

Explicit organizer approval 2026-11-13. The T1 60 and T2 first 59 assignments
must already be present. Does not alter any weight, place, other result or code.
"""
import copy
import datetime
import fcntl
import json
import os
from pathlib import Path
import secrets
import sys

EVENT='mt2025-champions_2025'
ROUND='mt2025-champions_2025-round2'
NAME='STASIAK ŁUKASZ'

def require(ok, message):
    if not ok: raise RuntimeError(message)

def json_read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def inspect_and_change(state):
    require(isinstance(state.get('revision'),int) and state['revision']>=6,'Unexpected central state version')
    db=state['data']
    events=[e for e in db['events'] if e.get('id')==EVENT]
    require(len(events)==1,'Expected exact Champions event')
    event=events[0]
    require(event.get('year')==2025 and len(event.get('rounds',[]))==2,'Event year or round count mismatch')
    rounds=event['rounds']
    for n,t in enumerate(rounds):
        require(t.get('id')==f'{EVENT}-round{n+1}','Wrong round ID')
        require(t.get('date')==('2025-12-13' if n==0 else '2025-12-14'),'Wrong round date')
        require(t.get('status')=='FINAL' and t.get('sectorCount')==6,'Wrong status or approved sector count')
        require(len(t.get('results',[]))==60,'Expected sixty athletes')
        filled=[r for r in t['results'] if r.get('peg') is not None or r.get('sector') is not None]
        require(len(filled)==(60 if n==0 else 59) or (n==1 and len(filled)==60),
                'Unexpected pre-existing assignments count')
        for r in filled:
            peg=r.get('peg')
            require(type(peg)==int and 1<=peg<=60 and r.get('sector')==chr(65+(peg-1)//10),
                    'Conflicting existing sector/peg in '+t['id'])
        pegs=[r['peg'] for r in filled]
        require(len(pegs)==len(set(pegs)),'Duplicate existing peg')
        if n==0:
            require(set(pegs)==set(range(1,61)),'T1 not yet complete')
        else:
            require(set(range(1,60)).issubset(set(pegs)),'Round II source pegs 1-59 changed')
    r2=rounds[1]['results']
    selected=[r for r in r2 if r.get('competitorName')==NAME]
    require(len(selected)==1,'STASIAK missing/duplicate')
    row=selected[0]
    require(row.get('weightG')==0 and row.get('officialPlace')==11,'Official weight/place changed')
    peg,sector=row.get('peg'),row.get('sector')
    require((peg is None and sector is None) or (peg==60 and sector=='F'),
            'Conflicting prior Stasiak assignment')
    before=copy.deepcopy(db)
    changed=(peg is None and sector is None)
    if changed:
        row['peg']=60
        row['sector']='F'
    require(len({r.get('peg') for r in r2})==60,'Second round stand count not sixty')
    require([sum(r.get('sector')==chr(65+i) for r in r2) for i in range(6)]==[10]*6,
            'Six sectors of 10 not achieved')
    for t in rounds:
        require(len([r for r in t['results'] if r.get('peg') and r.get('sector')])==60,
                'Round has missing assignments')
    # Revert precisely two organizer-approved fields to prove the entire DB is identical.
    newrow=[r for r in next(e for e in before['events'] if e.get('id')==EVENT)['rounds'][1]['results']
            if r.get('competitorName')==NAME][0]
    if 'peg' in newrow: row['peg']=newrow['peg']
    else: row.pop('peg',None)
    if 'sector' in newrow: row['sector']=newrow['sector']
    else: row.pop('sector',None)
    require(before==db,'Unexpected database mutation')
    if changed: row['peg'],row['sector']=60,'F'
    return changed

def safe_atomic(path, contents):
    tmp=path.with_name(path.name+'.tmp-'+secrets.token_hex(8))
    fd=os.open(tmp,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    try:
        with os.fdopen(fd,'wb') as f:
            f.write(contents);f.flush();os.fsync(f.fileno())
        os.replace(tmp,path)
        directory=os.open(str(path.parent),os.O_RDONLY)
        try:os.fsync(directory)
        finally:os.close(directory)
    finally:
        if tmp.exists():tmp.unlink()

def main():
    require(len(sys.argv)==3 and sys.argv[1] in ('preview','apply','verify'),
            'Usage: finalize-champions-t2-stasiak.py preview|apply|verify WEBROOT')
    mode=sys.argv[1]
    web=Path(sys.argv[2]).resolve(strict=True)
    require(web.name in ('public_html','test-webroot'),'Unexpected web root')
    private=web/'.mt41-private'
    statepath=private/'state-mt73.json'
    require(private.is_dir() and not private.is_symlink(),'Invalid private directory')
    require(statepath.is_file() and not statepath.is_symlink(),'Invalid server state')
    require((web/'mt73-store.php').is_file(),'No MatchThis state engine')
    lockpath=private/'mt73.lock'
    require(not lockpath.is_symlink(),'Unsafe lock path')
    with lockpath.open('a+') as lock:
        os.chmod(lockpath,0o600)
        fcntl.flock(lock,fcntl.LOCK_EX)
        old_bytes=statepath.read_bytes()
        state=json.loads(old_bytes)
        changed=inspect_and_change(state)
        if mode=='preview':
            print(json.dumps({'status':'PREVIEW','revision':state['revision'],'wouldChange':int(changed),
              'event':EVENT,'round':ROUND,'competitor':NAME,'sector':'F','peg':60},ensure_ascii=False))
            return
        if mode=='verify':
            require(not changed,'Approved F/60 not stored')
            print(json.dumps({'status':'VERIFIED','revision':state['revision'],'assigned':120,
              'round1':60,'round2':60,'sectorsRound2':[10]*6,'competitor':NAME,'peg':60,'sector':'F'},ensure_ascii=False))
            return
        if not changed:
            print(json.dumps({'status':'ALREADY_APPLIED','revision':state['revision'],'changed':0},ensure_ascii=False))
            return
        hist=private/'mt73-history'
        require(not hist.is_symlink(),'Invalid backup path')
        hist.mkdir(mode=0o700,exist_ok=True)
        timestamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')
        backup=hist/('before-champions-stasiak-f60-'+timestamp+'-'+secrets.token_hex(6)+'.json')
        fd=os.open(backup,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
        with os.fdopen(fd,'wb') as f:
            f.write(old_bytes);f.flush();os.fsync(f.fileno())
        require(backup.read_bytes()==old_bytes,'Backup did not read back correctly')
        old_revision=state['revision']
        state['revision']=old_revision+1
        state['seeded']=False
        state['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
        safe_atomic(statepath,json.dumps(state,ensure_ascii=False,separators=(',',':')).encode('utf-8'))
        after=json_read(statepath)
        require(after==state,'Real server read-back differs')
        require(inspect_and_change(after)==False,'Post-save 120-assignment audit failed')
        print(json.dumps({'status':'SAVED_AND_READ_BACK','revision':after['revision'],'changed':1,
            'round1':60,'round2':60,'sectorCountsRound2':[10]*6,'backup':backup.name,'competitor':NAME,'peg':60,'sector':'F'},
            ensure_ascii=False))
if __name__=='__main__':main()
