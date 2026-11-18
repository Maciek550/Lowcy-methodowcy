#!/usr/bin/env python3
"""MT92: remove only repeated T1/T2 labels from mobile 2-round row; SHA-locked MT91."""
from pathlib import Path
import hashlib,re,subprocess,tempfile
root=Path('matchthis')
source=root/'mt92-source';output=root/'mt92-release'
output.mkdir(parents=True,exist_ok=True)
digests={
    '':('d40ede0022d7c44fb98289dc631810de2cef6a8955437fbf473ec56b1ce9a69b','6f00c1717e3a500e052a4f667630ecf17e454c1327365ed081b33ded73184fd7'),
    '_OGLADACZ':('ba7521d6877d9d0552a315c655ea4fd3175827df02c8f4e65f43c5df6222e2d4','49960517aeabfaa132c8072466f300ca719b5db652e9e4c4c69a5058c0739316'),
    '_SEDZIA':('8f2c4fbf23f7b2c4198529bbce266ffc6e6d9ff8fdf022273bc3594a0064cfda','6b4866d0719be45fccb2e94f4fcf8bf94bdb775a327e7ed70277957086e920ec'),
}
labels=(
 ('<small>T1</small><b>${mt91Scores[0]}</b>','<b>${mt91Scores[0]}</b>'),
 ('<small>T2</small><b>${mt91Scores[1]}</b>','<b>${mt91Scores[1]}</b>'),
)
for suffix,(prior,expected) in digests.items():
 src=source/f'MatchThis_MT-91{suffix}.html'
 original=src.read_text('utf-8')
 assert hashlib.sha256(src.read_bytes()).hexdigest()==prior,(src,'wrong base')
 modified=original
 for old,new in labels:
  assert modified.count(old)==1,(src,'label not unique',old)
  modified=modified.replace(old,new,1)
 modified=modified.replace('MT-91','MT-92')
 assert '<title>MatchThis MT-92</title>' in modified
 assert 'body data-version="MT-92"' in modified
 assert "const APP_VERSION='MT-92'" in modified
 assert 'id="appversion" aria-label="Wersja MT-92">MT-92</span>' in modified
 assert 'MT-91' not in modified
 reverse=modified.replace('MT-92','MT-91')
 for old,new in labels:
  assert reverse.count(new)==1
  reverse=reverse.replace(new,old,1)
 assert reverse==original,'nonrequested content change'
 for i,js in enumerate(re.findall(r'<script\b[^>]*>(.*?)</script>',modified,re.S|re.I)):
  if not js.strip(): continue
  js_path=Path(tempfile.gettempdir())/f'mt92-{suffix or "admin"}-{i}.js'
  js_path.write_text(js,'utf-8')
  subprocess.run(['node','--check',str(js_path)],check=True,capture_output=True)
 dest=output/f'MatchThis_MT-92{suffix}.html'
 dest.write_text(modified,'utf-8')
 actual=hashlib.sha256(dest.read_bytes()).hexdigest()
 assert actual==expected,(dest,actual,expected)
 print('MT92_SHA_SCOPED_CHANGE_JS_VERSION_PASS',dest.name,actual,flush=True)
