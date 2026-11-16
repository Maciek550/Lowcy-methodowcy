#!/usr/bin/env python3
"""Retarget previously verified MT82 SMALL2 release script to MT83; SHA guarded."""
from pathlib import Path
src=Path('matchthis/deploy-mt82-small2.sh')
text=src.read_text('utf-8')
old=[
'c88159202b6ab074778278458ed0b2054cdff5d4554391ed696c5524db375943',
'a4724e2e9d3e95d970b5524268b8497a4c3deca4c5f9a397418a95af0029da69',
'8e96674bd98f032d6e8fd7487cb9eecfa711eb2a4df49c5ccfad80ef7650d53c',
'c28aeae8c75bbcfcbdc77f4b6fbb925df3551cc7ab304e244178eb15b694231b',
'1e3fe8cbba31da1477b3642f514d4908bfd5d944fc3b2c7bdc1635dfebd96d26',
'843c7023fb76c56ff1529e520508fb87d7ac096038c1cb34ca2991fcc821fdd3']
new=[old[3],old[4],old[5],
'defbdb62a66f70c016b83ec6cfdb2f281f1e4b07709ea0a26fc0ed362f71361c',
'24c6e6757e5dbc85769597dda6c5df3afcb6e1e537cc9ece7664855db6ad38aa',
'af5727e4f26b7019de7502963322725d6d5528f8b0ece0a91969fca1867c56ef']
for i,value in enumerate(old):
 assert value in text,('MT82 script SHA guard missing',i)
 text=text.replace(value,'__DIGEST'+str(i)+'__')
for i,value in enumerate(new):text=text.replace('__DIGEST'+str(i)+'__',value)
pairs=[('MT-82','MT-83'),('MT-81','MT-82'),('mt-82','mt-83'),('mt-81','mt-82'),
       ('MT82','MT83'),('MT81','MT82'),('mt82','mt83'),('mt81','mt82')]
for i,(a,b) in enumerate(pairs):text=text.replace(a,'__VERSION'+str(i)+'__')
for i,(a,b) in enumerate(pairs):text=text.replace('__VERSION'+str(i)+'__',b)
text=text.replace('matchthis-independent/mt-83-release-1','matchthis-independent/mt-83-r1')
assert 'MatchThis_MT-83_OGLADACZ.html' in text and 'mt83-admin.php' in text
assert 'mt82-admin.php' in text and 'MT83_ROLLBACK_TO_MT82' in text
assert 'matchthis-independent/mt-83-r1' in text
assert 'mt81-admin.php' not in text
dst=Path('matchthis/deploy-mt83-small2.sh')
dst.write_text(text,'utf-8')
print('MT83_RELEASE_SCRIPT_GUARDS_VERIFIED',dst.stat().st_size)
