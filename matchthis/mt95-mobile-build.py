#!/usr/bin/env python3
"""MT95: minimally fix mobile six-tour button date clipping, exact verified MT94 base."""
from pathlib import Path
import hashlib,re,subprocess,tempfile
root=Path('matchthis')
base=root/'mt95-source'
out=root/'mt95-release';out.mkdir(parents=True,exist_ok=True)
SOURCE={
 '':'85f053e24c4181714c574aa42494042eacfa64d12de7689b2b1b38042d0731b0',
 '_OGLADACZ':'377cde541531feb53843d424b3e5b638aa146f561a6fb0af08430797a957f946',
 '_SEDZIA':'4c021912c08d01c3f6d7cd546388b09bbe5be1f5e0c783cb9ebdbbdf58de77e8'
}
OUTPUT={
 '':'538837a9c998be52656296529eb2a9cade7272827bc946c81ad5f36bd444172a',
 '_OGLADACZ':'20ee3d390425bd9f941089d79925d5a4433142b59e6e3e2421474320a189766c',
 '_SEDZIA':'4f28f500f177ca03268c5b95cbda3b79ee1d060431c5da8612de0bd05d080780'
}
CSS='''<style id="mt95-mobile-tour-choices">
/* MatchThis MT95 — only the results-navigation tour buttons at phone/tablet
   screen widths. No markup, data, formulas, desktop styles or print edits. */
@media screen and (max-width:780px){
  .results-navigation .rounds{
    display:grid;
    grid-template-columns:repeat(3,minmax(0,1fr));
    gap:6px;
    align-items:stretch;
    overflow:visible;
    min-width:0;
  }
  .results-navigation .rounds button.mt68-round-button{
    box-sizing:border-box;
    width:100%;
    min-width:0;
    min-height:52px;
    padding:7px 5px;
    display:flex;
    flex-direction:column;
    align-items:center;
    justify-content:center;
    gap:3px;
    text-align:center;
    white-space:normal;
  }
  .results-navigation .rounds button.mt68-round-button strong{
    display:block;
    max-width:100%;
    line-height:1.15;
    font-size:13px;
    white-space:normal;
  }
  .results-navigation .rounds button.mt68-round-button small{
    display:block;
    min-width:0;
    max-width:100%;
    font-size:10px;
    line-height:1.25;
    font-weight:700;
    white-space:normal;
    overflow-wrap:normal;
    word-break:normal;
    text-align:center;
  }
  .results-navigation .rounds button.overall-tab{
    box-sizing:border-box;
    grid-column:1 / -1;
    width:100%;
    min-width:0;
    min-height:42px;
    margin-left:0;
    padding:8px;
    font-size:12px;
    white-space:normal;
  }
}
@media screen and (max-width:560px){
  .results-navigation .rounds{
    grid-template-columns:repeat(2,minmax(0,1fr));
  }
}
</style>
'''
sha=lambda b:hashlib.sha256(b).hexdigest()
for suffix,digest in SOURCE.items():
 path=base/('MatchThis_MT-94'+suffix+'.html')
 raw=path.read_bytes()
 assert sha(raw)==digest,(path,'wrong production baseline')
 old=raw.decode('utf8')
 for needle in ('<title>MatchThis MT-94</title>','<body data-version="MT-94"', "const APP_VERSION='MT-94'",'id="appversion" aria-label="Wersja MT-94">MT-94</span>'):
  assert old.count(needle)==1,(suffix,needle)
 assert old.count('<style id="mt95-mobile-tour-choices">')==0
 assert old.index('</head>')<old.index('<body data-version="MT-94"')
 new=old.replace('</head>',CSS+'</head>',1).replace('MT-94','MT-95')
 assert new.replace('MT-95','MT-94').replace(CSS,'')==old,'scope violation'
 assert '<title>MatchThis MT-95</title>' in new
 assert 'body data-version="MT-95"' in new
 assert "const APP_VERSION='MT-95'" in new
 assert 'id="appversion" aria-label="Wersja MT-95">MT-95</span>' in new
 for i,js in enumerate(re.findall(r'<script\b[^>]*>(.*?)</script>',new,re.S|re.I)):
  if not js.strip():continue
  tmp=Path(tempfile.gettempdir())/f'mt95-{suffix or "admin"}-{i}.js'
  tmp.write_text(js,'utf8')
  subprocess.run(['node','--check',str(tmp)],check=True,capture_output=True)
 dest=out/('MatchThis_MT-95'+suffix+'.html')
 dest.write_text(new,'utf8')
 assert sha(dest.read_bytes())==OUTPUT[suffix],(dest.name,sha(dest.read_bytes()))
 print('MT95_VERIFIED_BASE_VERSION_SCOPE_JS_SHA_PASS',dest.name,OUTPUT[suffix],flush=True)
