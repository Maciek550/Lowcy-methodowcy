#!/usr/bin/env python3
"""MT85 deployment: derive SHA-locked SMALL2 installer from the tested MT84 installer.
Only view pages and panel routes are changed; database is backed up, never altered.
"""
from pathlib import Path
import hashlib
root=Path('matchthis')
old_pages=[
 '2daaeef1f9c3a404b55d01588682c93f615daf3a824d1f393967c4b19292bdbc',
 '665ba63846b5481ceeb2d7812b29cc3738fa1bb66029aaf2cb3836358511f263',
 '5ddbdc2796786518967d5026f002c41d7d2c47c125f15cc09d6b4a3d7c64770b']
prior_pages=[
 'defbdb62a66f70c016b83ec6cfdb2f281f1e4b07709ea0a26fc0ed362f71361c',
 '24c6e6757e5dbc85769597dda6c5df3afcb6e1e537cc9ece7664855db6ad38aa',
 'af5727e4f26b7019de7502963322725d6d5528f8b0ece0a91969fca1867c56ef']
new_pages=[]
for suffix,sha in zip(['','_OGLADACZ','_SEDZIA'],old_pages):
 p=root/f'MatchThis_MT-85{suffix}.html'
 assert p.is_file()
 new_pages.append(hashlib.sha256(p.read_bytes()).hexdigest())
assert new_pages==[
 '77e7269710ba8b9dc577c89320facd6c5bd97df90af4784718ce507c4570f200',
 '86825329582035c184d5b82d6c767d50aeb43c4be0f8dd5c74a83f82cf7517be',
 '11c91d3d6e280eae5ce89a1fcc204b1b4246764350ff0795ab01c126295a743a'],new_pages
src=root/'deploy-mt84-small2.sh'
s=src.read_text('utf-8')
old_digests=[*old_pages,*prior_pages]
new_digests=[*new_pages,*old_pages]
for i,(old,new) in enumerate(zip(old_digests,new_digests)):
 assert old in s,old
 s=s.replace(old,'__MT85_SHA_'+str(i)+'__')
for i,new in enumerate(new_digests):
 s=s.replace('__MT85_SHA_'+str(i)+'__',new)
versions=[('MT-84','MT-85'),('MT-83','MT-84'),('MT84','MT85'),('MT83','MT84'),('mt-84','mt-85'),('mt-83','mt-84'),('mt84','mt85'),('mt83','mt84')]
for i,(old,new) in enumerate(versions):
 s=s.replace(old,'__MT85_VERSION_'+str(i)+'__')
for i,(old,new) in enumerate(versions):
 s=s.replace('__MT85_VERSION_'+str(i)+'__',new)
assert 'matchthis-independent/mt-85-t2-r1' in s
assert 'MatchThis_MT-85_OGLADACZ.html' in s
assert 'mt85-admin.php' in s and 'mt84-admin.php' in s
assert 'MT85_ROLLBACK_TO_MT84' in s
assert 'MT84_EXACT_MT83' not in s
assert 'state-mt73.json' in s and 'mt60-published-draws.json' in s
# Live state is mutable; never assume old fixed 71 rows. Reject corrupted assignments,
# but do not edit them or silently overwrite any peg, sector, name, or stored weight.
old_guard="""assert len(entries)==71
assert len({r['peg'] for r in entries})==71
assert len({r['sector'] for r in entries})==6
assert all(r['competitorId'] for r in entries)"""
new_guard="""assert len(entries)>=71
assert len({r['sector'] for r in entries})==6
assert all(r.get('competitorId') and r.get('sector') and isinstance(r.get('peg'),int) and r.get('peg')>0 for r in entries)
assert len({str(r['competitorId']) for r in entries})>=71
assert len({int(r['peg']) for r in entries})>=71"""
assert old_guard in s, 'MT84 deployment safety preflight changed'
s=s.replace(old_guard,new_guard,1)
dest=root/'deploy-mt85-small2.sh'
dest.write_text(s,'utf-8')
print('MT85_SHA_GUARDED_DEPLOYER_GENERATED',len(s),'pages',new_pages)
