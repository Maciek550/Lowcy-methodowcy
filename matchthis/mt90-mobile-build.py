#!/usr/bin/env python3
"""MT90: versioned, SHA-locked mobile summary card overflow fix only."""
from pathlib import Path
import re, hashlib, subprocess, tempfile
BASE=Path('matchthis/mt90-source')
OUT=Path('matchthis/mt90-release');OUT.mkdir(parents=True,exist_ok=True)
HASH={
 '':'a66509aaac44ae63a496644ac045c20f7a12e69a59a6145c4ce7f7e93d96be5e',
 '_OGLADACZ':'acef7ad0a0d7eb75b02cb06d92a139be7a49c5042e6b9311ea6230e14c1d8a83',
 '_SEDZIA':'4dd762b306658585bb290136ca1828e1c9c40bb7967a62daeecbe202b6498a70'
}
NEEDLE='@media print {.summary-mobile-list {display:none!important}'
CSS='''/* MT90: mobile two-tour card labels must never collide with their points;
   screen-only, <=780px, no desktop, classification, data or print change. */
@media screen and (max-width:780px){
  .summary-mobile-list .mobile-tour-top{
    display:grid;
    grid-template-columns:minmax(0,1fr) max-content;
    align-items:start;
    column-gap:4px;
    white-space:normal;
  }
  .summary-mobile-list .mobile-tour-top span{
    min-width:0;
    white-space:normal;
    overflow-wrap:break-word;
    line-height:1.22;
  }
  .summary-mobile-list .mobile-tour-top b{
    white-space:nowrap;
    justify-self:end;
  }
}
'''
for suffix,digest in HASH.items():
    src=BASE/f'MatchThis_MT-89{suffix}.html'
    s=src.read_text('utf-8')
    assert hashlib.sha256(src.read_bytes()).hexdigest()==digest,src.name
    assert s.count(NEEDLE)==1,(src.name,'missing mobile CSS insertion anchor')
    assert s.count('<title>MatchThis MT-89</title>')==1
    assert s.count('body data-version="MT-89"')==1
    assert s.count("const APP_VERSION='MT-89'")==1
    assert s.count('id="appversion" aria-label="Wersja MT-89">MT-89</span>')==1
    s=s.replace(NEEDLE,CSS+'\n'+NEEDLE,1).replace('MT-89','MT-90')
    assert '<title>MatchThis MT-90</title>' in s
    assert 'body data-version="MT-90"' in s
    assert "const APP_VERSION='MT-90'" in s
    assert 'id="appversion" aria-label="Wersja MT-90">MT-90</span>' in s
    assert 'MT-89' not in s
    assert s.replace('MT-90','MT-89').replace(CSS+'\n','')==src.read_text('utf-8')
    for i,js in enumerate(re.findall(r'<script\b[^>]*>(.*?)</script>',s,re.S|re.I)):
        if not js.strip():continue
        f=Path(tempfile.gettempdir())/('mt90-'+(suffix or 'admin')+'-'+str(i)+'.js')
        f.write_text(js,'utf-8')
        subprocess.run(['node','--check',str(f)],check=True,capture_output=True)
    dest=OUT/f'MatchThis_MT-90{suffix}.html'
    dest.write_text(s,'utf-8')
    print('MT90_SHA_JS_VERSION_SCOPED_CSS_PASS',dest.name,hashlib.sha256(dest.read_bytes()).hexdigest(),flush=True)
