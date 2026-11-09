from pathlib import Path
import hashlib,re,subprocess
D=Path(__file__).resolve().parent
BASE={
 '':'929413d687332e24b71ea775d971a201be6b51d5dee494597f6a1a99baf9eb56',
 '_OGLADACZ':'7e0ba35366add30dc791f5c750ce9d201fc85a8d9969243ca64ca129cae88aeb',
 '_SEDZIA':'5536b19e7089686c821b6ab5e827ff4af7a4712a050d98d275b8982b0191d864',
}
NEW={}
addon='''
/* MT-61: an explicit, visible viewer tab for published station drawings. */
.view-modes button.mt61-draw-tab{border-color:#e96609;color:#983a00;background:#fff4e9;font-weight:800}
.view-modes button.mt61-draw-tab.active{background:#e96609;color:white}
.mt61-draw-overview>.mt61-round-status{display:flex;flex-wrap:wrap;gap:7px;margin:9px 0 14px}
.mt61-round-status span{display:inline-block;padding:4px 8px;border:1px solid #d9dee3;border-radius:4px;font-size:12px}
.mt61-round-status .mt61-published{border-color:#e96609;background:#fff6ee;color:#893500;font-weight:700}
.mt61-draw-overview .mt60-published-draw{margin-top:12px}
'''
newfunc='''
// MT-61: only published server assignments are available to anonymous viewers.
// The overview is independent of which results round the visitor last selected.
function mt61PublishedDrawOverview(e,rounds){
 const items=rounds.map((t,i)=>({t,i,draw:mt60PublishedDrawFor(e,t,i)}));
 const available=items.filter(x=>x.draw?.rows?.length);
 const statuses='<div class="mt61-round-status">'+items.map(x=>
  '<span class="'+(x.draw?.rows?.length?'mt61-published':'')+'">'+safeName(x.t.name)+
  ' · '+safeName(tourDateLabel(x.t,e))+' — '+
  (x.draw?.rows?.length?x.draw.rows.length+' wylosowanych stanowisk':'nieopublikowane')+'</span>'
 ).join('')+'</div>';
 const heading='<h2>Losowanie stanowisk — '+safeName(e.name)+'</h2>'+
 '<p class="sub">Publiczne losowania pokazujemy według sektorów i numerów stanowisk, niezależnie od wpisanych wag.</p>';
 if(!available.length)return '<section class="panel mt61-draw-overview">'+heading+statuses+
  '<p>Brak opublikowanych losowań dla tych zawodów. Stanowiska będą dostępne po zatwierdzeniu publikacji przez administratora.</p></section>';
 return '<section class="panel mt61-draw-overview">'+heading+statuses+'</section>'+
 available.map(x=>mt60PublicDrawTable(e,x.t,x.i)).join('');
}
'''

def one(s,a,b,tag):
 n=s.count(a)
 if n!=1:raise AssertionError((tag,n,a[:120]))
 return s.replace(a,b,1)

for role,expected in BASE.items():
 path=D/f'MatchThis_MT-60{role}.html'
 original=path.read_text('utf8')
 assert hashlib.sha256(original.encode('utf8')).hexdigest()==expected,(role,'SOURCE_BASE_MISMATCH')
 s=original
 for a,b in (
  ('<title>MatchThis MT-60</title>','<title>MatchThis MT-61</title>'),
  ('data-version="MT-60"','data-version="MT-61"'),
  ('aria-label="Wersja MT-60">MT-60','aria-label="Wersja MT-61">MT-61'),
  ('<div class="version" id="appversion">MT-60</div>','<div class="version" id="appversion">MT-61</div>'),
  ("const APP_VERSION='MT-60';","const APP_VERSION='MT-61';"),
  ("const STORAGE_KEY='matchthis-preview-MT-60';", "const STORAGE_KEY='matchthis-preview-MT-61';\nconst MT60_STORAGE_KEY='matchthis-preview-MT-60';")
 ):
  s=one(s,a,b,(role,'VERSION'))
 # Only the admin and judge use their local storage; viewer never stores server data.
 if 'localStorage.getItem(MT59_STORAGE_KEY)||' in s:
  s=one(s,'localStorage.getItem(MT59_STORAGE_KEY)||',
        'localStorage.getItem(MT60_STORAGE_KEY)||localStorage.getItem(MT59_STORAGE_KEY)||',(role,'STORAGE_MIGRATION'))
 for typ in ("console.warn('MT-60:","console.error('MT-60:","console.warn('MatchThis MT-60:","console.error('MatchThis MT-60:"):
  s=s.replace(typ,typ.replace('MT-60','MT-61'))
 if role=='_OGLADACZ':
  assert s.index('</head>')<100000
  s=s.replace('</head>','<style>'+addon+'</style>\n</head>',1)
  s=one(s,"const viewerAllowedModes=new Set(['sectors','round','overall']);", "const viewerAllowedModes=new Set(['sectors','round','overall','publishedDraw']);",(role,'VIEWER_MODES'))
  s=one(s,"const allowedModes=['sectors','round','overall','photo','photoOverall','edit','roster','draw'];", "const allowedModes=['sectors','round','overall','publishedDraw','photo','photoOverall','edit','roster','draw'];",(role,'HISTORY_MODES'))
  s=one(s,'function mt60PublishedDrawFor(e,t){','function mt60PublishedDrawFor(e,t,index=roundIndex){',(role,'INDEX'))
  s=one(s,'const key=mt60DrawKey(e.id,roundIndex);','const key=mt60DrawKey(e.id,index);',(role,'ROUND_KEY'))
  s=one(s,'function mt60PublicDrawTable(e,t){\n const data=mt60PublishedDrawFor(e,t);',
        'function mt60PublicDrawTable(e,t,index=roundIndex){\n const data=mt60PublishedDrawFor(e,t,index);',(role,'TABLE_INDEX'))
  s=one(s,'function renderSectorsView(e,t){',newfunc+'\nfunction renderSectorsView(e,t){',(role,'PUBLIC_OVERVIEW'))
  s=one(s,"const currentScope=overall?(isCycle?'Cykl · 4 z 6':`Suma ${rounds.length} tur`):", 
        "const currentScope=resultMode==='publishedDraw'?'Opublikowane losowania':overall?(isCycle?'Cykl · 4 z 6':`Suma ${rounds.length} tur`):",(role,'SCOPE'))
  s=one(s,"draw:'Losowanie'})[resultMode]", "draw:'Losowanie',publishedDraw:'Losowanie stanowisk'})[resultMode]",(role,'VIEW_LABEL'))
  assert s.count("${!overall&&i===roundIndex?")==2
  s=s.replace("${!overall&&i===roundIndex?", "${resultMode!=='publishedDraw'&&!overall&&i===roundIndex?")
  # make a top-level tab even when results are empty or selected round is unpublished
  s=one(s,'<div class="view-modes">${overall?',
        '<div class="view-modes">${!isCycle?`<button class="mt61-draw-tab ${resultMode===\'publishedDraw\'?\'active\':\'\'}" data-result-mode="publishedDraw" ${resultMode===\'publishedDraw\'?\'aria-current="page"\':\'\'}>LOSOWANIE</button>`:\'\'}${overall?',
        (role,'DRAW_TAB'))
  s=one(s,"if(resultMode==='overall')body=", 
        "if(resultMode==='publishedDraw')body=mt61PublishedDrawOverview(e,rounds);\n else if(resultMode==='overall')body=",(role,'BODY_BRANCH'))
  # Admin stays protected - don't change the existing editing, download and publication handlers.
 s=s.replace('MT-60: publiczny podgląd losowania', 'MT-61: publiczny podgląd losowania')
 out=D/f'MatchThis_MT-61{role}.html'
 out.write_text(s,'utf8')
 for must in ("<title>MatchThis MT-61</title>","const APP_VERSION='MT-61'",'data-version="MT-61"','aria-label="Wersja MT-61">MT-61'):
  assert must in s,(role,'VERSION_MARKER',must)
 assert 'mt55EntryInput(r,\'weight\')' not in s
 if role=='_OGLADACZ':
  for must in ('LOSOWANIE</button>','function mt61PublishedDrawOverview','viewerAllowedModes=new Set([\'sectors\',\'round\',\'overall\',\'publishedDraw\'])'):
   assert must in s
 for i,code in enumerate(re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S)):
  if code.strip():
   check=D/f'_mt61_syntax_{role}_{i}.js'
   check.write_text(code,'utf8')
   subprocess.run(['node','--check',str(check)],check=True,capture_output=True)
   check.unlink()
 NEW[role]=hashlib.sha256(s.encode()).hexdigest()
 print(role or 'ADMIN',len(s),NEW[role], 'version css tests OK')
# Snapshot integrity: all embedded archive content identical; only nav presentation and release metadata change.
for role in BASE:
 old=(D/f'MatchThis_MT-60{role}.html').read_text('utf8')
 new=(D/f'MatchThis_MT-61{role}.html').read_text('utf8')
 for key in ('MATCHTHIS_ARCHIVE_2026','MATCHTHIS_STANDALONE_2026','MATCHTHIS_ARCHIVE_2025_MEGA_V','MATCHTHIS_ARCHIVE_2025_MAVER_OCT','MT44_MISSING_2025','MT44_MEGA_2025','MT45_MEGA_2025_ROUNDS','MT46_PUCHAR_ROUND1_DRAW','MT47_PUCHAR_ROUND2_DRAW','MT48_FLOAT_ROUND2_DRAW'):
  def get(s):return s.split('const '+key+'=',1)[1].split(';\n',1)[0]
  assert get(old)==get(new),(role,'ARCHIVE_CHANGED',key)
print('PASS: all roles verified, archives preserved, versions aligned')
