#!/usr/bin/env python3
"""MT91: exact MT90 source + five reversible display-only mobile patches."""
from pathlib import Path
import base64,zlib,json,hashlib,re,subprocess,tempfile
root=Path('matchthis');src=root/'mt91-source';out=root/'mt91-release'
out.mkdir(parents=True,exist_ok=True)
hashes={
'':('694c7f36f02fb529372b99aa6de682634bccb9f42d3812c902030c199bf851a4','d40ede0022d7c44fb98289dc631810de2cef6a8955437fbf473ec56b1ce9a69b'),
'_OGLADACZ':('f8cb9863a81091ec556b497244db9d3300dc4023c5626c8bc32130929356f184','ba7521d6877d9d0552a315c655ea4fd3175827df02c8f4e65f43c5df6222e2d4'),
'_SEDZIA':('980206818cdc5bc8b50db8f0e4b3d22965c689a1c26c0da1a7b5fa27a50c82b3','8f2c4fbf23f7b2c4198529bbce266ffc6e6d9ff8fdf022273bc3594a0064cfda')
}
patches=json.loads(zlib.decompress(base64.b64decode((root/'mt91-mobile-patch.b64').read_text().strip())).decode())
assert len(patches)==5
for suffix,(old_sha,new_sha) in hashes.items():
 p=src/f'MatchThis_MT-90{suffix}.html'
 orig=p.read_text('utf8')
 assert hashlib.sha256(p.read_bytes()).hexdigest()==old_sha,p
 s=orig
 for old,new in patches:
  assert s.count(old)==1,(suffix,old[:100],s.count(old))
  s=s.replace(old,new,1)
 s=s.replace('MT-90','MT-91')
 assert '<title>MatchThis MT-91</title>' in s
 assert 'body data-version="MT-91"' in s
 assert "const APP_VERSION='MT-91'" in s
 assert 'id="appversion" aria-label="Wersja MT-91">MT-91</span>' in s
 assert 'MT-90' not in s
 inverse=s.replace('MT-91','MT-90')
 for old,new in patches:
  inv_new=new.replace('MT-91','MT-90')
  assert inverse.count(inv_new)==1,(suffix,'patch reverse',inv_new[:70])
  inverse=inverse.replace(inv_new,old,1)
 assert inverse==orig,'Unrequested code modification'
 for i,js in enumerate(re.findall(r'<script\b[^>]*>(.*?)</script>',s,re.S|re.I)):
  if not js.strip():continue
  temp=Path(tempfile.gettempdir())/f'mt91-{suffix or "admin"}-{i}.js'
  temp.write_text(js,'utf8')
  subprocess.run(['node','--check',str(temp)],check=True,capture_output=True)
 dest=out/f'MatchThis_MT-91{suffix}.html'
 dest.write_text(s,'utf8')
 assert hashlib.sha256(dest.read_bytes()).hexdigest()==new_sha,(dest,new_sha)
 print('MT91_SHA_SCOPED_PATCH_JS_VERSION_PASS',dest.name,new_sha,flush=True)
