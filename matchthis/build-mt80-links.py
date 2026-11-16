#!/usr/bin/env python3
"""MT80: external official MatchThis + shop links, no change to app data or UI behavior."""
from pathlib import Path
import hashlib,re,subprocess
D=Path('matchthis')
BASE={
'':'51baa122e97f39b733408e51076adaf98c052b025471b10559f9a234d627e0d1',
'_OGLADACZ':'ece29feb50dd671461f984eccb17e9367514d37e802a291b924f4d199947eaa1',
'_SEDZIA':'a71e5455a86565c726006bb6c31a89564ad42b28312adbd69d65300bf7d9c25b'}
BRAND_BEFORE='<div class="brand-group"><div class="brand">Match<b>This</b></div>'
BRAND_AFTER='''<div class="brand-group"><a class="mt80-brand-link" href="https://matchthis.pl/" target="_blank" rel="noopener noreferrer" aria-label="MatchThis — strona główna matchthis.pl" title="Otwórz stronę MatchThis"><img src="/matchthis-orange-mt79-32.png" alt="" width="24" height="24" decoding="async"><span class="brand">Match<b>This</b></span></a>'''
SHOP_ANCHOR='<div class="row header-tools">'
SHOP_AFTER='''<div class="row header-tools"><a class="mt80-shop-link" href="https://matchthis.pl/sklep/" target="_blank" rel="noopener noreferrer" aria-label="SKLEPMT — otwórz sklep MatchThis" title="Sklep MatchThis"><svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></svg><span>SKLEPMT</span></a>'''
CSS='''
/* MT80: official website and shop links only, without modifying app navigation. */
.mt80-brand-link{display:inline-flex;align-items:center;gap:8px;text-decoration:none;color:inherit;white-space:nowrap;max-width:100%}
.mt80-brand-link .brand{display:inline-block}
.mt80-brand-link img{width:24px;height:24px;flex:0 0 24px;object-fit:contain}
.mt80-brand-link:hover .brand b{color:var(--accent-dark)}
.mt80-brand-link:focus-visible,.mt80-shop-link:focus-visible{outline:3px solid var(--accent);outline-offset:3px}
.mt80-shop-link{display:inline-flex;align-items:center;justify-content:center;gap:6px;color:var(--accent);background:#fff6ee;border:1px solid var(--accent);border-radius:3px;text-decoration:none;white-space:nowrap;font-size:11px;font-weight:800;letter-spacing:.035em;min-height:32px;padding:5px 10px;line-height:1.2;flex:0 0 auto}
.mt80-shop-link svg{flex:0 0 17px}
.mt80-shop-link:hover{color:#fff;background:var(--accent)}
@media(max-width:1100px){.mt80-brand-link{gap:6px}.mt80-brand-link img{width:21px;height:21px;flex-basis:21px}.mt80-shop-link{font-size:10px;padding:5px 7px}}
@media(max-width:390px){.mt80-brand-link img{width:18px;height:18px;flex-basis:18px}.mt80-brand-link{gap:4px}.mt80-shop-link{font-size:10px;padding:4px 6px;min-height:30px;gap:4px}.mt80-shop-link svg{width:14px;height:14px;flex-basis:14px}}
'''
for role,sha in BASE.items():
 src=D/f'MatchThis_MT-79{role}.html'
 data=src.read_bytes()
 assert hashlib.sha256(data).hexdigest()==sha,('WRONG_MT79_BASELINE',role)
 s=data.decode('utf8')
 assert s.count(BRAND_BEFORE)==1 and s.count(SHOP_ANCHOR)==1
 assert s.count('MT-79')==(9 if role=='_OGLADACZ' else 12)
 new=s.replace(BRAND_BEFORE,BRAND_AFTER,1).replace(SHOP_ANCHOR,SHOP_AFTER,1)
 new=new.replace('</style>',CSS+'</style>',1).replace('MT-79','MT-80')
 assert new.count('MT-80')==(9 if role=='_OGLADACZ' else 12)
 for marker in ['<title>MatchThis MT-80</title>','data-version="MT-80"',
               "const APP_VERSION='MT-80';",'id="appversion">MT-80']:
  assert marker in new,(role,marker)
 assert new.replace('MT-80','MT-79').replace(CSS,'',1).replace(BRAND_AFTER,BRAND_BEFORE,1).replace(SHOP_AFTER,SHOP_ANCHOR,1)==s,('UNAPPROVED_HTML_CHANGE',role)
 for script in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',new,re.S):
  if script.strip():
   file=Path('/tmp/mt80-script-check.js');file.write_text(script,encoding='utf8')
   subprocess.run(['node','--check',str(file)],check=True,stdout=subprocess.DEVNULL)
 out=D/f'MatchThis_MT-80{role}.html'
 out.write_text(new,encoding='utf8')
 print('MT80_LINKS_BUILT',role or 'ADMIN',hashlib.sha256(out.read_bytes()).hexdigest(),out.stat().st_size)
