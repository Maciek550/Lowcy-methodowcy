from pathlib import Path
import hashlib,re,subprocess
root=Path(__file__).resolve().parent
main=(root/'MatchThis_MT-60.html').read_text('utf8')
expected={
 '':'929413d687332e24b71ea775d971a201be6b51d5dee494597f6a1a99baf9eb56',
 '_SEDZIA':'5536b19e7089686c821b6ab5e827ff4af7a4712a050d98d275b8982b0191d864',
 '_OGLADACZ':'7e0ba35366add30dc791f5c750ce9d201fc85a8d9969243ca64ca129cae88aeb'
}
assert hashlib.sha256(main.encode()).hexdigest()==expected['']
start=main.index('<style id="mt60-sector-compact-and-draw">')
css=main[start:main.index('</style>',start)+len('</style>')]
start=main.index('// MT-60: Anonymous viewer reads published draws only')
viewer=main[start:main.index('function renderSectorsView(e,t){',start)]
start=main.index('async function toggleDrawPublication(){')
publication=main[start:main.index('function previewPublishedDraw(){',start)]
def once(s,old,new):
 assert s.count(old)==1,(old[:80],s.count(old))
 return s.replace(old,new,1)
for suffix in ('','_SEDZIA','_OGLADACZ'):
 prev=(root/f'MatchThis_MT-59{suffix}.html').read_text('utf8')
 if suffix:
  new=prev.replace('</head>',css+'\n</head>',1)
  for before,after in (
   ('<title>MatchThis MT-59</title>','<title>MatchThis MT-60</title>'),
   ('data-version="MT-59"','data-version="MT-60"'),
   ('aria-label="Wersja MT-59">MT-59','aria-label="Wersja MT-60">MT-60'),
   ('<div class="version" id="appversion">MT-59</div>','<div class="version" id="appversion">MT-60</div>'),
   ("const APP_VERSION='MT-59';","const APP_VERSION='MT-60';"),
   ("const STORAGE_KEY='matchthis-preview-MT-59';","const STORAGE_KEY='matchthis-preview-MT-60';\nconst MT59_STORAGE_KEY='matchthis-preview-MT-59';")
  ):new=once(new,before,after)
  if 'localStorage.getItem(MT58_STORAGE_KEY)||' in new:
   new=once(new,'localStorage.getItem(MT58_STORAGE_KEY)||','localStorage.getItem(MT59_STORAGE_KEY)||localStorage.getItem(MT58_STORAGE_KEY)||')
  new=once(new,'function renderSectorsView(e,t){','\n'+viewer+'function renderSectorsView(e,t){')
  new=once(new,'function renderSectorsView(e,t){\n let ranked=[];',
    'function renderSectorsView(e,t){\n const published=mt60PublicDrawTable(e,t);\n let ranked=[];')
  start=new.index('function renderSectorsView(e,t){')
  end=new.index('function renderRoundGeneral(e,t){',start)
  part=new[start:end]
  assert part.count('if(!sectors.length)return ')==1
  part=part.replace('if(!sectors.length)return ','if(!sectors.length&&published)return published;\n if(!sectors.length)return ',1)
  token='return '+chr(96)+'<section class="panel compact-sector-panel"'
  assert part.count(token)==1
  part=part.replace(token,'return published+'+chr(96)+'<section class="panel compact-sector-panel"',1)
  new=new[:start]+part+new[end:]
  new=once(new,'function renderRoundGeneral(e,t){\n let rows=[];',
    'function renderRoundGeneral(e,t){\n const published=mt60PublicDrawTable(e,t);\n let rows=[];')
  marker='return '+chr(96)+'<section class="panel"><div class="result-title"><h2>Cała tura'
  new=once(new,marker,'if(!rows.length&&published)return published;\n return published+'+chr(96)+'<section class="panel"><div class="result-title"><h2>Cała tura')
  start=new.index('function toggleDrawPublication(){')
  end=new.index('function previewPublishedDraw(){',start)
  new=new[:start]+'\n'+publication+new[end:]
  new=once(new,"case 'toggleDrawPublication':toggleDrawPublication();break;",
    "case 'toggleDrawPublication':toggleDrawPublication();break;case 'mt60RefreshPublicDraw':mt60RefreshPublicDraws();break;")
  new=once(new,'Ten lokalny plik nie publikuje nic w internecie.',
    'Publikacja jest świadoma: przydział zobaczą wszyscy dopiero po zatwierdzeniu. Lokalny plik nie publikuje w internecie.')
  new=once(new,'mtNavInit();\nrender();\n</script>',
    'mtNavInit();\nrender();\nmt60RefreshPublicDraws();\n</script>')
  new=new.replace("console.error('MatchThis MT-59:","console.error('MatchThis MT-60:")
  new=new.replace("console.warn('MatchThis MT-59:","console.warn('MatchThis MT-60:")
  (root/f'MatchThis_MT-60{suffix}.html').write_text(new,'utf8')
 else:new=main
 assert hashlib.sha256(new.encode()).hexdigest()==expected[suffix],(suffix,hashlib.sha256(new.encode()).hexdigest())
 for marker in ('<title>MatchThis MT-60</title>',"const APP_VERSION='MT-60'",'data-version="MT-60"', 'aria-label="Wersja MT-60">MT-60'):
  assert marker in new,(suffix,marker)
 for key in ('MATCHTHIS_ARCHIVE_2026','MATCHTHIS_STANDALONE_2026','MATCHTHIS_ARCHIVE_2025_MEGA_V',
             'MATCHTHIS_ARCHIVE_2025_MAVER_OCT','MT44_MISSING_2025','MT44_MEGA_2025',
             'MT45_MEGA_2025_ROUNDS','MT46_PUCHAR_ROUND1_DRAW','MT47_PUCHAR_ROUND2_DRAW','MT48_FLOAT_ROUND2_DRAW'):
  grab=lambda text:text.split('const '+key+'=',1)[1].split(';\n',1)[0]
  assert grab(prev)==grab(new),(suffix,'archive regression',key)
 for script in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',new,re.S):
  if script.strip():
   Path('/tmp/mt60.js').write_text(script)
   subprocess.run(['node','--check','/tmp/mt60.js'],check=True)
 print('MT60_ROLE_SOURCE_DATA_VERSION_JS_OK',suffix)
for kind in ('deploy','rollback'):
 data=(root/f'{kind}-mt59-small2.sh').read_text('utf8')
 for a,b in (('MT-59','MT-60'),('MT59','MT60'),('mt59','mt60'),('mt-59','mt-60'),
             ('MT-58','MT-59'),('MT58','MT59'),('mt58','mt59'),('mt-58','mt-59')):
  data=data.replace(a,b)
 assert 'index-MT59.backup' in data and 'matchthis-independent/mt-60' in data
 assert 'MatchThis_MT-60_OGLADACZ.html' in data
 assert ('MT60_VERSION_AUTH_HTTPS_OK' in data if kind=='deploy' else 'MT60_ROLLBACK_MT59' in data)
 (root/f'{kind}-mt60-small2.sh').write_text(data,'utf8')
print('MT60_DEPLOY_BACKUP_ROLLBACK_READY')
