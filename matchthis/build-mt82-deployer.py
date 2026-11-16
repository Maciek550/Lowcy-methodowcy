#!/usr/bin/env python3
"""Retarget previously verified MT81 SMALL2 release script to MT82; SHA guarded."""
from pathlib import Path
src=Path('matchthis/deploy-mt81-small2.sh')
text=src.read_text('utf-8')
old=[
'59efe4f1ffd6000ea7ae634f0002cb21819e0885bf8a5c74da50320dac02d0bf',
'f0541e9b09a7dc4d8e14d1d9d8d30b2120d06a10ee552b8e06f385c63dd0498c',
'ac2da3f8a0cf1f1f880aa90de96823a14118c4be3d4783933e899bdb537d7664',
'c88159202b6ab074778278458ed0b2054cdff5d4554391ed696c5524db375943',
'a4724e2e9d3e95d970b5524268b8497a4c3deca4c5f9a397418a95af0029da69',
'8e96674bd98f032d6e8fd7487cb9eecfa711eb2a4df49c5ccfad80ef7650d53c']
new=[old[3],old[4],old[5],
'c28aeae8c75bbcfcbdc77f4b6fbb925df3551cc7ab304e244178eb15b694231b',
'1e3fe8cbba31da1477b3642f514d4908bfd5d944fc3b2c7bdc1635dfebd96d26',
'843c7023fb76c56ff1529e520508fb87d7ac096038c1cb34ca2991fcc821fdd3']
for i,value in enumerate(old):
 assert value in text,('MT81 script SHA guard missing',i)
 text=text.replace(value,'__DIGEST'+str(i)+'__')
for i,value in enumerate(new):text=text.replace('__DIGEST'+str(i)+'__',value)
pairs=[('MT-81','MT-82'),('MT-80','MT-81'),('mt-81','mt-82'),('mt-80','mt-81'),
       ('MT81','MT82'),('MT80','MT81'),('mt81','mt82'),('mt80','mt81')]
for i,(a,b) in enumerate(pairs):text=text.replace(a,'__VERSION'+str(i)+'__')
for i,(a,b) in enumerate(pairs):text=text.replace('__VERSION'+str(i)+'__',b)
text=text.replace('matchthis-independent/mt-82-r2','matchthis-independent/mt-82-release-1')
assert 'MatchThis_MT-82_OGLADACZ.html' in text and 'mt82-admin.php' in text
assert 'mt81-admin.php' in text and 'MT82_ROLLBACK_TO_MT81' in text
assert 'matchthis-independent/mt-82-release-1' in text
assert 'mt80-admin.php' not in text
dst=Path('matchthis/deploy-mt82-small2.sh')
dst.write_text(text,'utf-8')
print('MT82_RELEASE_SCRIPT_GUARDS_VERIFIED',dst.stat().st_size)
