#!/usr/bin/env python3
"""Import ONLY 119 photograph-confirmed Champions League FLOAT RS 2025 assignments.

Round I 60/60, round II 59/60. Position 60 is cropped: do NOT infer it.
No changes to player identity, weight, official places, flags, other events or draws.
"""
import collections
import copy
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import sys
import unicodedata

def check(ok, reason):
    if not ok:
        raise ValueError(reason)

def normalized(name):
    text = unicodedata.normalize('NFKD', name.upper().replace('Ł', 'L'))
    return re.sub('[^A-Z0-9]', '', ''.join(c for c in text if not unicodedata.combining(c)))

def read(path):
    return json.loads(path.read_text(encoding='utf8'))

def target(data):
    events = [event for event in data['events'] if event.get('id') == 'mt2025-champions_2025']
    check(len(events) == 1, 'Champions event count not one')
    e = events[0]
    check(len(e['rounds']) == 2 and e.get('year') == 2025, 'Champions event structure changed')
    for i, tour in enumerate(e['rounds'], 1):
        check(tour.get('id') == 'mt2025-champions_2025-round' + str(i), 'Wrong tour ID')
        check(tour.get('date') == ('2025-12-13' if i == 1 else '2025-12-14'), 'Wrong round date')
        check(tour.get('status') == 'FINAL' and tour.get('sectorCount') == 6, 'Wrong target tour status/count')
        check(len(tour.get('results', [])) == 60, 'Wrong number of original results')
    return e

def validate_manifest(m):
    check(m.get('eventId') == 'mt2025-champions_2025', 'Unexpected event in source')
    items = m.get('assignments')
    check(isinstance(items, list) and len(items) == 119, '119 exact photograph-confirmed entries required')
    seen = set()
    nums = collections.Counter()
    for a in items:
        r, peg, sector = a['round'], a['peg'], a['sector']
        check(type(r) is int and r in (1, 2), 'Invalid tour number')
        check(type(peg) is int and 1 <= peg <= 60, 'Invalid peg number')
        check(sector == chr(65 + (peg-1)//10), 'Sector does not correspond to photo peg range')
        check(isinstance(a['sourceName'], str) and a['sourceName'].strip(), 'Missing name in photo')
        check((r, peg) not in seen, 'Duplicate peg in manifest')
        seen.add((r, peg))
        nums[r] += 1
    check(nums == {1: 60, 2: 59}, 'Manifest count per round is wrong')
    check(set(range(1, 61)) == {a['peg'] for a in items if a['round'] == 1}, 'First round not complete')
    check(set(range(1, 60)) == {a['peg'] for a in items if a['round'] == 2}, 'Second round must only contain visible 1-59')
    check(m['unconfirmed'][0]['competitorName'] == 'STASIAK ŁUKASZ', 'Unexpected pending confirmation')

def compute(original, manifest):
    result = copy.deepcopy(original)
    event = target(result['data'])
    changes, unchanged = 0, 0
    for round_number in (1, 2):
        tour = event['rounds'][round_number-1]
        rows = tour['results']
        by_name = {}
        for row in rows:
            key = normalized(row['competitorName'])
            check(key not in by_name, 'Duplicated result name in round: ' + row['competitorName'])
            by_name[key] = row
        seen_names = set()
        for item in manifest['assignments']:
            if item['round'] != round_number: continue
            name = normalized(item['sourceName'])
            check(name in by_name, 'Source name not in live results: ' + item['sourceName'])
            check(name not in seen_names, 'Repeated name in source: ' + item['sourceName'])
            seen_names.add(name)
            row = by_name[name]
            previous_peg, previous_sector = row.get('peg'), row.get('sector')
            target_peg, target_sector = item['peg'], item['sector']
            check(previous_peg is None or previous_peg == target_peg, 'CONFLICT peg for ' + item['sourceName'])
            check(previous_sector is None or previous_sector == target_sector, 'CONFLICT sector for ' + item['sourceName'])
            if previous_peg != target_peg or previous_sector != target_sector:
                row['peg'], row['sector'] = target_peg, target_sector
                changes += 1
            else:
                unchanged += 1
        check(len(seen_names) == (60 if round_number == 1 else 59), 'Wrong number of mapped people')
        assigned = [(r['peg'], r['sector']) for r in rows if r.get('peg') is not None]
        check(len(assigned) == len(set(assigned)), 'Duplicate stand in live results')
        check(len({p for p,s in assigned}) == len(assigned), 'Duplicate stand even across sectors')
        if round_number == 2:
            stasiak = by_name[normalized('STASIAK ŁUKASZ')]
            check(stasiak['weightG'] == 0 and stasiak['officialPlace'] == 11, 'Unconfirmed last competitor differs from source')
            check(stasiak.get('peg') is None and stasiak.get('sector') is None, 'Unconfirmed position already assigned: requires separate inspection')
    # Guard: reconstruct exactly the source database after stripping ONLY approved modifications.
    reverted = copy.deepcopy(result['data'])
    old_event = target(original['data'])
    new_event = target(reverted)
    for idx in (0,1):
        old_by_name = {normalized(x['competitorName']): x for x in old_event['rounds'][idx]['results']}
        for row in new_event['rounds'][idx]['results']:
            old = old_by_name[normalized(row['competitorName'])]
            if 'peg' in old: row['peg'] = old['peg']
            else: row.pop('peg', None)
            if 'sector' in old: row['sector'] = old['sector']
            else: row.pop('sector', None)
    check(reverted == original['data'], 'An unrelated result / weight / place / event changed')
    return result, changes, unchanged

def safe_atomic(path, data):
    name = path.with_name(path.name+'.tmp-'+secrets.token_hex(8))
    fd = os.open(name, os.O_CREAT|os.O_EXCL|os.O_WRONLY, 0o600)
    try:
        with os.fdopen(fd, 'wb') as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.replace(name, path)
        dfd = os.open(str(path.parent), os.O_RDONLY)
        try: os.fsync(dfd)
        finally: os.close(dfd)
    finally:
        if name.exists(): name.unlink()

def main():
    if len(sys.argv) != 4 or sys.argv[1] not in ('preview','apply','verify'):
        raise SystemExit('Usage: import-champions-2025.py preview|apply|verify WEBROOT MANIFEST')
    mode = sys.argv[1]
    web = Path(sys.argv[2]).resolve(strict=True)
    private = web/'.mt41-private'
    statepath = private/'state-mt73.json'
    manifestpath = Path(sys.argv[3]).resolve(strict=True)
    check(web.name in ('public_html','test-webroot'), 'Not an approved test or SMALL2 web root')
    check(statepath.is_file() and not statepath.is_symlink(), 'Missing state or unsafe symlink')
    check((web/'mt73-store.php').is_file(), 'Wrong backend')
    check(private.is_dir() and not private.is_symlink(), 'Private root invalid')
    manifest = read(manifestpath)
    validate_manifest(manifest)
    lockpath = private/'mt73.lock'
    check(not lockpath.is_symlink(), 'Lock cannot be a symlink')
    with open(lockpath,'a+') as lock:
        os.chmod(lockpath,0o600)
        fcntl.flock(lock,fcntl.LOCK_EX)
        original_bytes = statepath.read_bytes()
        original = json.loads(original_bytes)
        check(type(original.get('revision')) is int and original['revision'] >= 2, 'Unexpected state revision')
        updated, changed, already = compute(original,manifest)
        if mode == 'verify':
            check(changed == 0 and already == 119, 'Not all confirmed source assignments persisted')
        if mode == 'preview' or mode == 'verify' or changed == 0:
            print(json.dumps({'status': 'DRY_RUN' if mode=='preview' else 'VERIFIED' if mode=='verify' else 'ALREADY_APPLIED',
                'revision':original['revision'],'confirmed':119,'wouldChange':changed,'alreadySaved':already,
                'round1':60,'round2':59,'pending':'STASIAK ŁUKASZ — II tura, brak na zdjęciu stanowiska 60'},
                ensure_ascii=False))
            return
        check(mode == 'apply', 'Unknown mode')
        # Backup before change, on the same SMALL2 server in the private history.
        hist = private/'mt73-history'
        hist.mkdir(mode=0o700, exist_ok=True)
        check(not hist.is_symlink(), 'Unsafe backup directory')
        stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d-%H%M%S')
        backup = hist/('before-champions-2025-119-'+stamp+'-'+secrets.token_hex(6)+'.json')
        flags = os.O_CREAT|os.O_EXCL|os.O_WRONLY
        fd = os.open(backup,flags,0o600)
        with os.fdopen(fd,'wb') as out:
            out.write(original_bytes)
            out.flush()
            os.fsync(out.fileno())
        check(backup.read_bytes() == original_bytes, 'Backup read-back failed')
        updated['revision'] = original['revision']+1
        updated['seeded'] = False
        updated['updatedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')
        data = json.dumps(updated,ensure_ascii=False,separators=(',',':')).encode('utf8')
        safe_atomic(statepath,data)
        actual = read(statepath)
        check(actual == updated, 'Saved state read-back failed')
        verification, count, ok = compute(actual, manifest)
        check(count == 0 and ok == 119, 'Post-save validation of all assignments failed')
        print(json.dumps({'status':'SAVED_AND_READ_BACK','revision':actual['revision'],'confirmed':119,
            'changed':changed,'alreadySaved':already,'round1':60,'round2':59,
            'backup':backup.name,'pending':'STASIAK ŁUKASZ — II tura stanowisko 60 nie pokazane'},ensure_ascii=False))
if __name__ == '__main__':
    main()
