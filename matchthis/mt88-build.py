#!/usr/bin/env python3
from pathlib import Path
import re, hashlib, subprocess, tempfile, json
root=Path('matchthis')
base=root/'mt88-base'
expected={
'':('2083bdf2e972655cd2be0e5fccf56eddd64f7577931814419335715de159750e','b0a603fde6ae0fa9feb7f3a410394d56a3a881ce3d60cdd3dafa7bcf8328e9c7'),
'_OGLADACZ':('9760f55cb81ae0d0880163b98d8b29d2d5ea24ab271eb6cea0187e09faa1fba8','1e990e680c7138c06df5e197d4d8dcadb40289af351c703ace893acb9e372b92'),
'_SEDZIA':('141723803fb20133d94ad416232e987b791a260af86a057dcee23168dc314433','2b2ba6f2d6381ad0704bc006d62fb66fa5adac8689a54faf74f30383d35be090')}
for suffix,(old_sha,new_sha) in expected.items():
 src=base/f'MatchThis_MT-87{suffix}.html'
 before=src.read_text('utf8')
 assert hashlib.sha256(src.read_bytes()).hexdigest()==old_sha
 s=before
 assert s.count('BARCZAK')==18
 s=s.replace('BARCZAK','BARTCZAK').replace('MT-87','MT-88')
 assert 'mt2026-person-barczak-jan' in s
 pattern=r'<div class="site-sticky"><div class="utility-strip noprint"><div class="utility-inner">.*?</div></div>\s*<header class="top noprint">'
 assert len(re.findall(pattern,s,re.S))==1
 s=re.sub(pattern,'<div class="site-sticky"><header class="top noprint">',s,count=1,flags=re.S)
 start='<div class="brand-group"><a class="mt80-brand-link"'
 assert s.count(start)==1
 s=s.replace(start,'<div class="brand-group mt88-brand-group"><div class="mt88-brand-copy"><a class="mt80-brand-link"',1)
 target='</a><div class="version" id="appversion">MT-88</div></div><nav id="nav"'
 new='</a><div class="mt88-brand-subline">ZAWODY WĘDKARSKIE <span class="mt88-version" id="appversion" aria-label="Wersja MT-88">MT-88</span></div></div></div><nav id="nav"'
 assert s.count(target)==1
 s=s.replace(target,new,1)
 css='''
<style id="mt88-single-header-style">
/* MT-88: One compact branded header; no duplicated charcoal utility row. */
.top .header-inner .mt88-brand-group{display:block;min-width:0;align-self:center;justify-self:start;line-height:1.05}
.mt88-brand-copy{display:flex;flex-direction:column;gap:3px;align-items:flex-start}
.top .header-inner .mt88-brand-copy .mt80-brand-link{display:inline-flex;align-items:center;gap:5px}
.mt88-brand-subline{padding-left:27px;display:flex;align-items:center;gap:7px;white-space:nowrap;font-size:9px;font-weight:700;letter-spacing:.025em;color:#5d6470;line-height:1.3}
.mt88-brand-subline .mt88-version{display:inline-block!important;padding:1px 5px;background:#f1f2f4;border:1px solid #d7dce2;border-radius:2px;color:#424a56;font-size:9px;font-weight:800;letter-spacing:0}
@media(max-width:650px){.top .header-inner .mt88-brand-group{justify-self:center}.mt88-brand-subline{font-size:9px}}
@media(max-width:350px){.mt88-brand-subline{font-size:8px;gap:5px}}
</style>
'''
 marker='</head>\n<body'
 assert s.count(marker)==1
 s=s.replace(marker,css+'</head>\n<body',1)
 assert s.count('id="appversion"')==1
 assert s.count('<div class="utility-strip')==0
 assert '<title>MatchThis MT-88</title>' in s
 assert 'body data-version="MT-88"' in s and "const APP_VERSION='MT-88'" in s
 assert s.count('mt2026-person-barczak-jan')==before.count('mt2026-person-barczak-jan')
 assert s.count('id="mtLoginOpen"')==before.count('id="mtLoginOpen"')
 assert s.count('id="mtLoginForm"')==before.count('id="mtLoginForm"')
 for n,js in enumerate(re.findall(r'<script\b[^>]*>(.*?)</script>',s,re.S|re.I)):
  if not js.strip():continue
  with tempfile.NamedTemporaryFile(mode='w',suffix='.js') as f:
   f.write(js);f.flush()
   subprocess.run(['node','--check',f.name],check=True)
 dest=root/f'MatchThis_MT-88{suffix}.html'
 dest.write_text(s,'utf8')
 assert hashlib.sha256(dest.read_bytes()).hexdigest()==new_sha,(dest,hashlib.sha256(dest.read_bytes()).hexdigest())
 print('MT88_SHA_JS_VERSION_PASS',dest.name,new_sha)
