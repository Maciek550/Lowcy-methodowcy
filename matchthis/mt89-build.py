#!/usr/bin/env python3
"""MT89 three-role build from exact verified MT88 with SHA-locked minimal deltas."""
import base64, zlib, json, hashlib, re, subprocess, tempfile
from pathlib import Path
root=Path('matchthis')
base=root/'mt89-source'
out=root/'mt89-release';out.mkdir(parents=True,exist_ok=True)
digests={
 '':('b0a603fde6ae0fa9feb7f3a410394d56a3a881ce3d60cdd3dafa7bcf8328e9c7','a66509aaac44ae63a496644ac045c20f7a12e69a59a6145c4ce7f7e93d96be5e'),
 '_OGLADACZ':('1e990e680c7138c06df5e197d4d8dcadb40289af351c703ace893acb9e372b92','acef7ad0a0d7eb75b02cb06d92a139be7a49c5042e6b9311ea6230e14c1d8a83'),
 '_SEDZIA':('2b2ba6f2d6381ad0704bc006d62fb66fa5adac8689a54faf74f30383d35be090','4dd762b306658585bb290136ca1828e1c9c40bb7967a62daeecbe202b6498a70')}
data=(root/'mt89-deltas.b64').read_text().strip()
patches=json.loads(zlib.decompress(base64.b64decode(data)).decode('utf8'))
assert len(patches)==17,len(patches)
for suffix,(oldhash,newhash) in digests.items():
 p=base/('MatchThis_MT-88'+suffix+'.html')
 assert hashlib.sha256(p.read_bytes()).hexdigest()==oldhash
 s=p.read_text('utf8')
 for name,a,b in patches:
  assert s.count(a)==1,(suffix,name,s.count(a))
  s=s.replace(a,b,1)
 s=s.replace('MT-88','MT-89')
 assert '<title>MatchThis MT-89</title>' in s
 assert 'body data-version="MT-89"' in s
 assert "const APP_VERSION='MT-89'" in s
 assert 'id="appversion" aria-label="Wersja MT-89">MT-89</span>' in s
 for n,js in enumerate(re.findall(r'<script\b[^>]*>(.*?)</script>',s,re.S|re.I)):
  if not js.strip():continue
  tmp=Path(tempfile.gettempdir())/('mt89-'+(suffix or 'admin')+'-'+str(n)+'.js')
  tmp.write_text(js,'utf8')
  subprocess.run(['node','--check',str(tmp)],check=True)
 dest=out/('MatchThis_MT-89'+suffix+'.html')
 dest.write_text(s,'utf8')
 assert hashlib.sha256(dest.read_bytes()).hexdigest()==newhash,(dest.name,hashlib.sha256(dest.read_bytes()).hexdigest())
 print('MT89_BUILT_SHA_JS_VERSION_PASS',dest.name,newhash)
