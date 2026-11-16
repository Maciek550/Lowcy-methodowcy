#!/usr/bin/env python3
"""MT81 fixes exactly wrong MatchThis logo destination, SKLEP title, and header scrollbar.

Use exact MT80 released artifact, never rewrite its JS, persisted results or roles.
"""
from pathlib import Path
import re,subprocess,hashlib
ROOT=Path('matchthis')
SOURCE={
'':'59efe4f1ffd6000ea7ae634f0002cb21819e0885bf8a5c74da50320dac02d0bf',
'_OGLADACZ':'f0541e9b09a7dc4d8e14d1d9d8d30b2120d06a10ee552b8e06f385c63dd0498c',
'_SEDZIA':'ac2da3f8a0cf1f1f880aa90de96823a14118c4be3d4783933e899bdb537d7664',
}
OLD_BRAND='<a class="mt80-brand-link" href="https://matchthis.pl/" target="_blank" rel="noopener noreferrer" aria-label="MatchThis — strona główna matchthis.pl" title="Otwórz stronę MatchThis">'
NEW_BRAND='<a class="mt80-brand-link" href="/" aria-label="MatchThis — strona główna wyników zawodów" title="Wróć do wyników MatchThis">'
OLD_SHOP='<span>SKLEPMT</span>'
NEW_SHOP='<span>SKLEP</span>'
# Strictly replace the two nav-overflow declarations that introduced the scrollbar.
CSS_OLD='.header-inner #nav{overflow-x:auto;overflow-y:hidden;justify-content:flex-start;scrollbar-width:thin}'
CSS_NEW='.header-inner #nav{overflow:visible;scrollbar-width:none;justify-content:center;flex-wrap:wrap;white-space:normal}'
# Header layout: deliberately two clear rows instead of one horizontally-scrollable nav.
# All nav buttons wrap to visible rows at 320px and 400% zoom; no clipped items.
CSS_APPEND='''
/* MT81: no header scrollbars; all navigation labels and tools remain visible. */
.top .header-inner{display:flex;flex-wrap:wrap;column-gap:12px;row-gap:3px;padding-top:6px;padding-bottom:7px;align-items:center}
.top .header-inner .brand-group{order:1;flex:0 0 auto;min-width:0}
.top .header-inner .header-tools{order:2;flex:1 1 auto;min-width:0;max-width:100%;display:flex;flex-wrap:wrap;justify-content:flex-end;gap:5px}
.top .header-inner #nav{order:3;flex:1 1 100%;width:100%;min-width:0;max-width:100%;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;overflow:visible!important;white-space:normal!important;scrollbar-width:none;padding:0;margin:0}
.top .header-inner #nav button,.top .header-inner #nav a{flex:0 1 auto;min-width:0;max-width:100%;white-space:normal;overflow-wrap:break-word;padding:7px 10px;min-height:32px;line-height:1.25}
.top .header-inner .mt80-brand-link{max-width:100%}
@media(max-width:820px){
 .top .header-inner{align-items:center;justify-content:space-between;row-gap:4px;padding-top:7px;padding-bottom:7px}
 .top .header-inner .brand-group{flex:0 1 auto;min-width:0}
 .top .header-inner .header-tools{flex:1 1 100%;min-width:0;justify-content:center}
 .top .header-inner #nav{width:100%;max-width:100%;flex:1 1 100%;padding:0;justify-content:center;overflow:visible!important}
 .top .header-inner #nav button,.top .header-inner #nav a{font-size:11px;padding:7px 8px;min-height:32px}
}
@media(max-width:390px){
 .top .header-inner .brand-group{flex:0 1 auto;min-width:0}
 .top .header-inner .header-tools{max-width:100%;justify-content:center}
 .top .header-inner #nav button,.top .header-inner #nav a{font-size:10px;padding:6px 6px;letter-spacing:0}
}
'''
for role,sha in SOURCE.items():
 p=ROOT/f'MatchThis_MT-80{role}.html'
 data=p.read_bytes()
 assert hashlib.sha256(data).hexdigest()==sha,('MT80_ACTUAL_BASELINE_CHANGED',role)
 s=data.decode('utf8')
 for old in [OLD_BRAND,OLD_SHOP,CSS_OLD]:
  assert s.count(old)==1,(role,'Missing/duplicate anchor',old[:65],s.count(old))
 assert s.count('MT-80')==(9 if role=='_OGLADACZ' else 12)
 t=s.replace(OLD_BRAND,NEW_BRAND,1).replace(OLD_SHOP,NEW_SHOP,1).replace(CSS_OLD,CSS_NEW,1)
 # Insert into only first CSS block, leaving scripts and other inline styles byte-identical.
 t=t.replace('</style>',CSS_APPEND+'</style>',1).replace('MT-80','MT-81')
 assert t.count('MT-81')==(9 if role=='_OGLADACZ' else 12)
 for needle in ['<title>MatchThis MT-81</title>','data-version="MT-81"',
                "const APP_VERSION='MT-81';",'id="appversion">MT-81']:
  assert needle in t,(role,needle)
 assert t.replace('MT-81','MT-80').replace(CSS_APPEND,'',1).replace(CSS_NEW,CSS_OLD,1).replace(NEW_SHOP,OLD_SHOP,1).replace(NEW_BRAND,OLD_BRAND,1)==s,('UNREQUESTED_DIFF',role)
 for js in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',t,re.S):
  if js.strip():
   check=Path('/tmp/mt81-check.js');check.write_text(js,encoding='utf8')
   subprocess.run(['node','--check',str(check)],check=True,stdout=subprocess.DEVNULL)
 out=ROOT/f'MatchThis_MT-81{role}.html'
 out.write_text(t,encoding='utf8')
 print('MT81_BUILT',role or 'ADMIN',hashlib.sha256(out.read_bytes()).hexdigest(),out.stat().st_size)
