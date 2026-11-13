#!/usr/bin/env python3
"""One-round source-exact import: MEGA MATCH THIS CUP 2025 final, 25 Oct 2025.

Only 54 approved 'peg'/'sector' fields may be changed. Locks central MT73
state, archives original bytes, checks full data regression and reads back.
"""
import copy,datetime,fcntl,json,os,re,secrets,sys,unicodedata
from pathlib import Path

def ensure(ok,why):
    if not ok: raise RuntimeError(why)

def norm(s):
    s=unicodedata.normalize('NFKD',s.upper().replace('Ł','L'))
    return re.sub('[^A-Z0-9]','', ''.join(c for c in s if not unicodedata.combining(c)))

# Two unique, one-to-one photo transcription variants; NEVER rename stored athletes.
PHOTO_TO_DB={
    norm('PELL ANNA'):norm('PEL ANNA'),
    norm('ŚWINIARSKI KRZYSZTOF'):norm('ŚWINARSKI KRZYSZTOF'),
}
def identity(name):
    k=norm(name)
    return PHOTO_TO_DB.get(k,k)

def read(p):return json.loads(p.read_text(encoding='utf8'))

def patch(old,source):
    data=copy.deepcopy(old)
    m=source['assignments']
    ensure(source['eventId']=='mt2025-mega_final_2025' and source['roundId']=='mt2025-mega_final_2025-round1','Wrong source event')
    ensure(len(m)==54 and len(set(x['peg'] for x in m))==54,'Source not 54 unique stations')
    ensure(sorted(x['peg'] for x in m)==list(range(1,55)),'Source not all stations 1..54')
    ensure(len({identity(x['sourceName']) for x in m})==54,'Duplicate source names')
    for x in m:
        ensure(x['sector']==chr(65+(x['peg']-1)//9),'Photo sector does not match station')
    events=[e for e in data['data']['events'] if e.get('id')==source['eventId']]
    ensure(len(events)==1,'Target event missing or duplicated')
    event=events[0]
    ensure(event.get('year')==2025 and len(event['rounds'])==2,'Unexpected final')
    tour=event['rounds'][0]
    ensure(tour.get('id')==source['roundId'] and tour.get('date')=='2025-10-25' and tour.get('status')=='FINAL','Unexpected first round')
    ensure(tour.get('sectorCount')==6 and len(tour['results'])==54,'Wrong sector count or results')
    byname={}
    for row in tour['results']:
        key=norm(row['competitorName'])
        ensure(key not in byname,'Duplicate result name '+row['competitorName'])
        byname[key]=row
    missing=[x['sourceName'] for x in m if identity(x['sourceName']) not in byname]
    ensure(not missing,'Source names NOT FOUND in central results: '+', '.join(missing))
    ensure(set(byname)=={identity(x['sourceName']) for x in m},'Unmatched central result names: '+', '.join(r['competitorName'] for k,r in byname.items() if k not in {identity(x['sourceName']) for x in m}))
    changed=0
    for x in m:
        row=byname[identity(x['sourceName'])]
        peg,sector=row.get('peg'),row.get('sector')
        ensure(peg is None or peg==x['peg'],'CONFLICT existing peg: '+x['sourceName'])
        ensure(sector is None or sector==x['sector'],'CONFLICT existing sector: '+x['sourceName'])
        if peg!=x['peg'] or sector!=x['sector']:
            row['peg'],row['sector']=x['peg'],x['sector']
            changed+=1
    rows=tour['results']
    ensure(len({r['peg'] for r in rows})==54,'Duplicate peg')
    ensure([sum(r.get('sector')==chr(65+i) for r in rows) for i in range(6)]==[9]*6,'Incorrect sector sizes')
    # Preserve EVERY other data value exactly; compare normalized before/after.
    original=copy.deepcopy(data['data'])
    source_event=next(e for e in original['events'] if e['id']==source['eventId'])
    oldrows=next(e for e in old['data']['events'] if e['id']==source['eventId'])['rounds'][0]['results']
    for row,oldrow in zip(source_event['rounds'][0]['results'],oldrows):
        for field in ('peg','sector'):
            if field in oldrow:row[field]=oldrow[field]
            else:row.pop(field,None)
    ensure(original==old['data'],'Unapproved field changed')
    return data,changed

def atomic(p,b):
    tmp=p.with_name(p.name+'.tmp-'+secrets.token_hex(8))
    fd=os.open(tmp,os.O_CREAT|os.O_EXCL|os.O_WRONLY,0o600)
    try:
        with os.fdopen(fd,'wb') as f:f.write(b);f.flush();os.fsync(f.fileno())
        os.replace(tmp,p)
    finally:
        if tmp.exists():tmp.unlink()

def main():
    ensure(len(sys.argv)==4 and sys.argv[1] in ('preview','apply','verify'),'Usage: import-mega-final-2025-t1.py preview|apply|verify WEBROOT SOURCE')
    mode=sys.argv[1]
    web=Path(sys.argv[2]).resolve(strict=True)
    ensure(web.name in ('public_html','test-webroot'),'Unexpected webroot')
    private=web/'.mt41-private'; state=private/'state-mt73.json'
    ensure(private.is_dir() and not private.is_symlink(),'Invalid private root')
    ensure(state.is_file() and not state.is_symlink(),'Invalid state')
    ensure((web/'mt73-store.php').is_file(),'Missing backend')
    source=read(Path(sys.argv[3]).resolve(strict=True))
    lock=private/'mt73.lock'
    ensure(not lock.is_symlink(),'Unsafe lock')
    with lock.open('a+') as f:
        os.chmod(lock,0o600);fcntl.flock(f,fcntl.LOCK_EX)
        previous=state.read_bytes()
        original=json.loads(previous)
        ensure(original['revision']>=7,'Unexpected central state revision')
        output,changed=patch(original,source)
        if mode=='verify':ensure(changed==0,'54 assignments not persisted')
        if mode!='apply' or changed==0:
            print(json.dumps({'status':{'preview':'PREVIEW','verify':'VERIFIED','apply':'ALREADY_APPLIED'}[mode],
              'revision':original['revision'],'wouldChange':changed,'confirmed':54},ensure_ascii=False));return
        hist=private/'mt73-history';ensure(not hist.is_symlink(),'Unsafe history')
        hist.mkdir(mode=0o700,exist_ok=True)
        stamp=datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')
        backup=hist/('before-mega-final-2025-t1-'+stamp+'-'+secrets.token_hex(6)+'.json')
        fd=os.open(backup,os.O_WRONLY|os.O_EXCL|os.O_CREAT,0o600)
        with os.fdopen(fd,'wb') as f:f.write(previous);f.flush();os.fsync(f.fileno())
        ensure(backup.read_bytes()==previous,'Backup verification failed')
        output['revision']=original['revision']+1
        output['seeded']=False
        output['updatedAt']=datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
        atomic(state,json.dumps(output,ensure_ascii=False,separators=(',',':')).encode('utf8'))
        actual=read(state)
        ensure(actual==output,'Server readback unequal')
        _,again=patch(actual,source)
        ensure(again==0,'Regression: 54 source assignments changed after saving')
        print(json.dumps({'status':'SAVED_AND_READ_BACK','revision':actual['revision'],'changed':changed,'confirmed':54,
          'backup':backup.name},ensure_ascii=False))
if __name__=='__main__':main()
