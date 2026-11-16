#!/usr/bin/env python3
"""MT82: compact, consistent header; user's storefront/cart icon; MT81 exact source.

No changes to results, JavaScript, backend, passwords or role logic.
"""
from pathlib import Path
import hashlib,re,subprocess
D=Path('matchthis')
BASE={
 '':'c88159202b6ab074778278458ed0b2054cdff5d4554391ed696c5524db375943',
 '_OGLADACZ':'a4724e2e9d3e95d970b5524268b8497a4c3deca4c5f9a397418a95af0029da69',
 '_SEDZIA':'8e96674bd98f032d6e8fd7487cb9eecfa711eb2a4df49c5ccfad80ef7650d53c',
}
# Replace only the symbol INSIDE the current SKLEP link.
BAG='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M5 8h14l1 13H4L5 8Z"/><path d="M9 10V6a3 3 0 0 1 6 0v4"/></svg>'
CART='<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M2 3h2l3 13h13l2-10H6"/></svg>'
CSS=r'''
/* MT82: compact single-row header on desktop; no sliders or hidden tabs. */
.top{padding-left:12px;padding-right:12px;border-bottom-width:2px}
.top .header-inner{max-width:1280px;display:grid;grid-template-columns:max-content minmax(0,1fr) max-content;align-items:center;gap:7px;min-height:51px;padding:5px 0;justify-content:initial}
.top .header-inner .brand-group{grid-column:1;grid-row:1;min-width:0;flex:none}
.top .header-inner .brand{font-size:25px;letter-spacing:.045em}
.top .header-inner .version{font-size:9px;margin-top:1px}
.top .header-inner .mt80-brand-link{gap:5px}
.top .header-inner .mt80-brand-link img{width:22px;height:22px;flex:0 0 22px}
.top .header-inner #nav{grid-column:2;grid-row:1;display:flex;align-items:center;justify-content:center;flex-wrap:nowrap!important;width:100%;min-width:0;max-width:100%;padding:0;gap:0;margin:0;overflow:visible!important;white-space:nowrap!important;scrollbar-width:none}
.top .header-inner #nav button{font-size:10px;font-weight:750;letter-spacing:.025em;white-space:nowrap;padding:6px 6px;min-height:32px;max-width:none;flex:0 1 auto;line-height:1.3;overflow-wrap:normal}
.top .header-inner .header-tools{grid-column:3;grid-row:1;display:flex;align-items:center;justify-content:flex-end;flex-wrap:nowrap;min-width:0;max-width:none;flex:none;gap:4px;padding:0}
.top .header-inner .header-tools .btn.small{font-size:10px;min-height:30px;white-space:nowrap;padding:4px 6px}
.top .header-inner .header-tools .header-role{font-size:10px;white-space:nowrap}
.top .header-inner .mt80-shop-link{font-size:10px;min-height:30px;padding:4px 7px;gap:5px}
.top .header-inner .mt80-shop-link svg{height:16px;width:16px;flex:0 0 16px}
@media(max-width:1160px){
 .top .header-inner{grid-template-columns:max-content minmax(0,1fr);row-gap:1px;min-height:0}
 .top .header-inner .brand-group{grid-column:1;grid-row:1}
 .top .header-inner .header-tools{grid-column:2;grid-row:1;flex-wrap:wrap;justify-content:flex-end;max-width:100%}
 .top .header-inner #nav{grid-column:1/-1;grid-row:2;flex-wrap:wrap!important;white-space:normal!important;justify-content:center}
 .top .header-inner #nav button{white-space:nowrap;flex:0 0 auto;padding:6px 8px;min-height:30px}
}
@media(max-width:650px){
 .top{padding-left:8px;padding-right:8px}
 .top .header-inner{grid-template-columns:1fr;row-gap:3px;justify-items:stretch}
 .top .header-inner .brand-group{grid-row:1;grid-column:1;justify-self:center}
 .top .header-inner .header-tools{grid-row:2;grid-column:1;justify-content:center;gap:4px}
 .top .header-inner #nav{grid-row:3;grid-column:1;justify-content:center;row-gap:0}
 .top .header-inner #nav button{font-size:10px;padding:5px 7px;min-height:28px;white-space:normal;overflow-wrap:normal}
 .top .header-inner .brand{font-size:24px}
}
@media(max-width:340px){
 .top .header-inner .header-tools{gap:3px}
 .top .header-inner .header-tools .btn.small{font-size:9px;padding:4px 5px}
 .top .header-inner #nav button{font-size:9px;padding:5px 6px}
}
'''
for role,sha in BASE.items():
 p=D/f'MatchThis_MT-81{role}.html'
 raw=p.read_bytes()
 assert hashlib.sha256(raw).hexdigest()==sha,('MT81 baseline mismatch',role)
 s=raw.decode('utf-8')
 assert s.count(BAG)==1,(role,'Expected current shop bag exactly once')
 assert s.count('<span>SKLEP</span>')==1
 assert s.count('MT-81')==(9 if role=='_OGLADACZ' else 12),(role,'Version count')
 out=s.replace(BAG,CART,1).replace('</style>',CSS+'</style>',1).replace('MT-81','MT-82')
 for token in ('<title>MatchThis MT-82</title>','data-version="MT-82"',
               "const APP_VERSION='MT-82';",'id="appversion">MT-82'):
  assert token in out,(role,token)
 assert out.count('MT-82')==(9 if role=='_OGLADACZ' else 12)
 assert out.replace('MT-82','MT-81').replace(CSS,'',1).replace(CART,BAG,1)==s,('UNREQUESTED_DIFF',role)
 for js in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',out,re.S):
  if js.strip():
   test=Path('/tmp/mt82-syntax-check.js')
   test.write_text(js,encoding='utf-8')
   subprocess.run(['node','--check',str(test)],check=True,stdout=subprocess.DEVNULL)
 target=D/f'MatchThis_MT-82{role}.html'
 target.write_text(out,encoding='utf-8')
 print('MT82_BUILT',role or 'ADMIN','sha256',hashlib.sha256(target.read_bytes()).hexdigest(),'bytes',target.stat().st_size)
