#!/usr/bin/env python3
"""MatchThis MT93: guarded screen-only selection highlighting, from verified MT92."""
from pathlib import Path
import hashlib,re,subprocess,tempfile
root=Path('matchthis');source=root/'mt93-source';output=root/'mt93-release';output.mkdir(parents=True,exist_ok=True)
digests={
'':('6f00c1717e3a500e052a4f667630ecf17e454c1327365ed081b33ded73184fd7','a73377ce9efc974543f8f67d43098001d002250eb8b0c0cb12e69d3e4bb29700'),
'_OGLADACZ':('49960517aeabfaa132c8072466f300ca719b5db652e9e4c4c69a5058c0739316','d685396a243d55bf56ea18580144b2909d31544e5af81f012bc786c33384de9e'),
'_SEDZIA':('6b4866d0719be45fccb2e94f4fcf8bf94bdb775a327e7ed70277957086e920ec','118673fee882c13090d1f1bf00a210d8a514e80d1d2931542225fd97734bdfb2')
}
STYLE='''<style id="mt93-result-tabs-active-style">
/* MT-93: one unequivocal selection rule for event results tabs.
   Selected = orange fill / white text; unselected = neutral white.
   This only affects screen navigation, not data, calculations or print. */
@media screen {
 .results-navigation .rounds button,
 .results-navigation .rounds button.overall-tab,
 .results-navigation .view-modes button[data-result-mode],
 .results-navigation .view-modes button.mt61-draw-tab,
 .compact-sector-panel .sector-choice button,
 .fb-panel .sector-choice button {
   background:#fff;
   color:#343841;
   border-color:#b9bec6;
   box-shadow:none;
 }
 .results-navigation .rounds button.active,
 .results-navigation .rounds button.overall-tab.active,
 .results-navigation .view-modes button[data-result-mode].active,
 .results-navigation .view-modes button.mt61-draw-tab.active,
 .compact-sector-panel .sector-choice button.active,
 .fb-panel .sector-choice button.active {
   background:#e96609;
   color:#fff;
   border-color:#e96609;
   box-shadow:inset 0 -2px #a74500;
 }
 .results-navigation .rounds button:not(.active):hover,
 .results-navigation .view-modes button[data-result-mode]:not(.active):hover,
 .compact-sector-panel .sector-choice button:not(.active):hover,
 .fb-panel .sector-choice button:not(.active):hover {
   background:#fff;
   color:#343841;
 }
}
</style>
'''
for suffix,(prior,expected) in digests.items():
 p=source/f'MatchThis_MT-92{suffix}.html'
 original=p.read_text('utf-8')
 assert hashlib.sha256(p.read_bytes()).hexdigest()==prior,p
 assert original.count('</head>\n<body data-version="MT-92"')==1
 assert original.count('<title>MatchThis MT-92</title>')==1
 assert original.count('body data-version="MT-92"')==1
 assert original.count("const APP_VERSION='MT-92'")==1
 assert original.count('id="appversion" aria-label="Wersja MT-92">MT-92</span>')==1
 s=original.replace('</head>',STYLE+'</head>',1).replace('MT-92','MT-93')
 assert '<title>MatchThis MT-93</title>' in s
 assert 'body data-version="MT-93"' in s
 assert "const APP_VERSION='MT-93'" in s
 assert 'id="appversion" aria-label="Wersja MT-93">MT-93</span>' in s
 assert s.replace(STYLE,'').replace('MT-93','MT-92')==original,'Unrequested code change'
 for i,js in enumerate(re.findall(r'<script\b[^>]*>(.*?)</script>',s,re.S|re.I)):
  if not js.strip():continue
  f=Path(tempfile.gettempdir())/f'mt93-{suffix or "admin"}-{i}.js'
  f.write_text(js,'utf-8')
  subprocess.run(['node','--check',str(f)],check=True,capture_output=True)
 dest=output/f'MatchThis_MT-93{suffix}.html';dest.write_text(s,'utf-8')
 actual=hashlib.sha256(dest.read_bytes()).hexdigest()
 assert actual==expected,(dest,actual,expected)
 print('MT93_SHA_SCOPED_STYLE_JS_VERSION_PASS',dest.name,actual,flush=True)
