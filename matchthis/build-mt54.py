from pathlib import Path
import re
root=Path(__file__).resolve().parent
CSS=r"""
<style id="mt54-admin-tool-tiles">
.mt54-tools{margin:-4px 0 10px;padding:9px 11px 11px;background:#fff;border:1px solid #dfe0e4;border-radius:4px}
.mt54-tools-head{font-weight:800;font-size:10px;letter-spacing:.09em;color:#666b74;margin:0 0 7px}
.mt54-tool-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;width:100%}
.mt54-tool{appearance:none;min-width:0;display:flex;align-items:center;justify-content:center;gap:11px;min-height:61px;padding:10px 12px;border:1px solid #d9dce0;border-radius:5px;background:#fafbfc;color:#30343b;cursor:pointer;text-align:left;transition:background .12s,border-color .12s,box-shadow .12s}
.mt54-tool:not(:disabled):hover{border-color:#e96609;background:#fff8f1;box-shadow:0 1px 6px #a64d0020}
.mt54-tool:focus-visible{outline:2px solid #e96609;outline-offset:2px}
.mt54-tool.active{border-color:#e96609;background:#fff3e8;box-shadow:inset 0 -3px #e96609}
.mt54-tool:disabled{cursor:not-allowed;opacity:.45;background:#f5f5f5}
.mt54-tool-icon{flex:0 0 auto;width:30px;height:30px;display:grid;place-items:center;border-radius:7px;background:#eceef1;color:#505763}
.mt54-tool.active .mt54-tool-icon{background:#ffe0c5;color:#ae4900}
.mt54-tool-icon svg{width:19px;height:19px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linejoin:round;stroke-linecap:round}
.mt54-tool-label{display:flex;flex-direction:column;min-width:0;gap:3px}
.mt54-tool-label strong{font-size:13px;line-height:1.15;font-weight:800;overflow-wrap:anywhere}
.mt54-tool-label small{font-size:11px;color:#747983;line-height:1.15}
.mt54-tool.active .mt54-tool-label strong{color:#ac4800}
@media(max-width:620px){.mt54-tools{padding:8px;margin-bottom:8px}.mt54-tool-grid{gap:5px}.mt54-tool{min-height:58px;padding:7px 5px;flex-direction:column;gap:4px;text-align:center}.mt54-tool-icon{width:23px;height:23px;background:transparent}.mt54-tool-icon svg{width:18px;height:18px}.mt54-tool-label strong{font-size:11px;line-height:1.1}.mt54-tool-label small{display:none}}
@media(max-width:340px){.mt54-tool{padding:5px 3px}.mt54-tool-label strong{font-size:10px}}
</style>
"""
TILES=r"""const mt54AdminTiles=roleMode==='admin'?__TICK__<section class="mt54-tools noprint" aria-label="Narzędzia administratora">
 <div class="mt54-tools-head">NARZĘDZIA</div>
 <div class="mt54-tool-grid" role="group" aria-label="Narzędzia administratora">
  <button type="button" class="mt54-tool __DOLLAR__{resultMode==='edit'?'active':''}" data-result-mode="edit" aria-pressed="__DOLLAR__{resultMode==='edit'}">
   <span class="mt54-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></span>
   <span class="mt54-tool-label"><strong>Edytuj wyniki</strong><small>Wagi i miejsca</small></span>
  </button>
  <button type="button" class="mt54-tool __DOLLAR__{resultMode==='roster'?'active':''}" data-result-mode="roster" aria-pressed="__DOLLAR__{resultMode==='roster'}">
   <span class="mt54-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg></span>
   <span class="mt54-tool-label"><strong>Lista startowa</strong><small>Zawodnicy i rezerwacje</small></span>
  </button>
  <button type="button" class="mt54-tool __DOLLAR__{resultMode==='draw'?'active':''}" data-result-mode="draw" aria-pressed="__DOLLAR__{resultMode==='draw'}" __DOLLAR__{canDraw?'':'disabled aria-disabled="true" title="Losowanie niedostępne dla tej tury"'}>
   <span class="mt54-tool-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/></svg></span>
   <span class="mt54-tool-label"><strong>Losowanie</strong><small>Stanowiska i sektory</small></span>
  </button>
 </div>
</section>__TICK__:'';""".replace('__DOLLAR__',chr(36)).replace('__TICK__',chr(96))
oldToolsPattern=re.compile(r"""\$\{roleMode==='admin'\?__TICK__<details class="admin-tools-menu compact-dropdown">.*?</details>__TICK__:''\}""".replace('__TICK__',chr(96)),re.S)
for suffix in ('','_SEDZIA','_OGLADACZ'):
 previous=(root/f'MatchThis_MT-53{suffix}.html').read_text('utf8')
 assert previous.count("const APP_VERSION='MT-53'")==1
 s=previous.replace('MT-53','MT-54')
 if suffix!='_OGLADACZ':
  anchor="const MT52_STORAGE_KEY='matchthis-preview-MT-52';"
  assert s.count(anchor)==1,(suffix,'MT52_STORAGE_KEY')
  s=s.replace(anchor,"const MT53_STORAGE_KEY='matchthis-preview-MT-53';\n"+anchor)
  anchor="localStorage.getItem(MT52_STORAGE_KEY)||"
  assert s.count(anchor)==1,(suffix,'storage migration')
  s=s.replace(anchor,"localStorage.getItem(MT53_STORAGE_KEY)||"+anchor)
 assert s.count('</head>')>=1
 s=s.replace('</head>',CSS+'</head>',1)
 start=s.index('function renderEntity(e){')
 end=s.index('\nfunction renderArchive(){',start)
 original=s[start:end]
 assert len(oldToolsPattern.findall(original))==1,(suffix,'dropdown not unique')
 transformed=oldToolsPattern.sub('',original)
 assert transformed.count(' let body;')==1
 transformed=transformed.replace(' let body;', ' '+TILES+'\n let body;')
 assert transformed.count('${nav}<div class="result-view">')==1
 transformed=transformed.replace('${nav}<div class="result-view">','${nav}${mt54AdminTiles}<div class="result-view">')
 assert "admin-tools-menu compact-dropdown" not in transformed
 s=s[:start]+transformed+s[end:]
 for tag in ('<title>MatchThis MT-54</title>','aria-label="Wersja MT-54">MT-54','data-version="MT-54"', "const APP_VERSION='MT-54'"):
  assert tag in s,(suffix,tag)
 assert s.count('class="mt54-tool-grid"')==1
 assert s.count('id="mt54-admin-tool-tiles"')==1
 path=root/f'MatchThis_MT-54{suffix}.html'
 path.write_text(s,'utf8')
 print('MT54_BUILT',path.name,'bytes',len(s),'difference',len(s)-len(previous))
print('MT54 only responsive three-tile administrator menu. All data and other views unchanged.')
