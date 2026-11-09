from pathlib import Path
import hashlib,re,subprocess
D=Path(__file__).resolve().parent
BASE={
 '':'4bddcfc8a7b8360fc7f42e7e83477c93063bdbb5a122fe67c487a414fb3579d3',
 '_OGLADACZ':'70270279df0aa4da7079996912f2d7d38d049adaf5282a10323c9aa398459423',
 '_SEDZIA':'03a82edd96d755343388f579d4d48d9e9b5805871454829b6f5bda779ffc4c2f',
}
CSS='''<style id="mt66-bulk-confirm-controls">
.mt66-bulk-actions{display:flex;flex-wrap:wrap;gap:10px;margin:4px 0 12px}
.mt66-bulk-tile{display:flex;align-items:center;gap:9px;min-height:41px;padding:9px 13px;border-radius:6px;border:1px solid #cbd5df;background:#f7fafc;color:#222b36;font-weight:700;text-align:left}
.mt66-bulk-tile.mt66-all{border-color:#88bd9a;background:#eaf7ee;color:#176536}
.mt66-bulk-tile.mt66-none{border-color:#d9c1b5;background:#fff7f2;color:#9b4217}
.mt66-bulk-tile:not(:disabled):hover{filter:brightness(.97)}
.mt66-bulk-tile:disabled{opacity:.52}
@media(max-width:570px){.mt66-bulk-tile{width:100%;justify-content:center}}
</style>'''
JS=r'''// MT-66: Change confirmation flags for only non-reserved entrants of this event; leave draws and results untouched.
function mt66BulkControls(e){
 const total=mt63Players(e).length,yes=mt63Confirmed(e).length;
 return '<div class="mt66-bulk-actions" role="group" aria-label="Zbiorcze potwierdzanie zawodników">'+
 '<button type="button" class="mt66-bulk-tile mt66-all" data-mt66-bulk="all" '+(yes===total||total===0?'disabled':'')+'>✓ Potwierdź wszystkich</button>'+
 '<button type="button" class="mt66-bulk-tile mt66-none" data-mt66-bulk="none" '+(yes===0?'disabled':'')+'>Usuń potwierdzenie wszystkich</button></div>';
}
function mt66BulkConfirm(all){
 requireAdmin();const e=current();
 if(!e||page!=='event'||e.archived)throw Error('Nie można zmieniać potwierdzeń tej listy.');
 const eligible=mt63Players(e).map(p=>p.id),eligibleSet=new Set(eligible);
 if(!eligible.length)throw Error('Brak zawodników do potwierdzenia.');
 const previous=e.mt63ConfirmedIds;
 const original=Array.isArray(previous)?previous:[];
 const confirmed=eligible.filter(id=>original.includes(id));
 if((all&&confirmed.length===eligible.length)||(!all&&confirmed.length===0))return;
 if(!all&&!window.confirm('Usunąć potwierdzenia '+confirmed.length+' zawodników z tej listy? Losowanie, stanowiska i wyniki pozostaną bez zmian.'))return;
 const keepOtherIds=original.filter(id=>!eligibleSet.has(id));
 e.mt63ConfirmedIds=all?[...keepOtherIds,...eligible]:keepOtherIds;
 if(!save()){
  e.mt63ConfirmedIds=previous;
  throw Error('Nie udało się zapisać potwierdzeń. Poprzedni stan został przywrócony.');
 }
 render();
 alertMsg(all?'Potwierdzono '+eligible.length+' zawodników.':'Usunięto '+confirmed.length+' potwierdzeń.',true);
}
document.addEventListener('click',ev=>{
 const b=ev.target.closest('[data-mt66-bulk]');if(!b||b.disabled)return;
 try{mt66BulkConfirm(b.dataset.mt66Bulk==='all')}catch(err){alertMsg(err.message)}
});
'''
def once(s,a,b):
 assert s.count(a)==1,(a[:130],s.count(a));return s.replace(a,b,1)
for suffix,sha in BASE.items():
 source=D/f'MatchThis_MT-65{suffix}.html'
 old=source.read_text('utf8')
 assert hashlib.sha256(old.encode()).hexdigest()==sha,(suffix,'BASE_CHANGED',hashlib.sha256(old.encode()).hexdigest())
 s=old
 for a,b in [
  ('<title>MatchThis MT-65</title>','<title>MatchThis MT-66</title>'),
  ('data-version="MT-65"','data-version="MT-66"'),
  ('aria-label="Wersja MT-65">MT-65','aria-label="Wersja MT-66">MT-66'),
  ('<div class="version" id="appversion">MT-65</div>','<div class="version" id="appversion">MT-66</div>'),
  ("const APP_VERSION='MT-65';","const APP_VERSION='MT-66';"),
  ("const STORAGE_KEY='matchthis-preview-MT-65';","const STORAGE_KEY='matchthis-preview-MT-66';\nconst MT65_STORAGE_KEY='matchthis-preview-MT-65';"),
  ('localStorage.getItem(MT64_STORAGE_KEY)||','localStorage.getItem(MT65_STORAGE_KEY)||localStorage.getItem(MT64_STORAGE_KEY)||'),
  ('function mt63DrawRange(e,t){',JS+'\nfunction mt63DrawRange(e,t){'),
  ('mt63Summary(e)+\'<p class="sub">\'',"mt63Summary(e)+(canEdit?mt66BulkControls(e):'')+'<p class=\"sub\">'"),
 ]:
  if a.startswith('localStorage.getItem(') and a not in s: continue
  s=once(s,a,b)
 s=once(s,'</style>\n</head>','</style>\n'+CSS+'\n</head>')
 # No other changes to historical records, generated photographs, draw routines or services.
 for name in ('MATCHTHIS_ARCHIVE_2026','MATCHTHIS_STANDALONE_2026','MATCHTHIS_ARCHIVE_2025_MEGA_V',
              'MATCHTHIS_ARCHIVE_2025_MAVER_OCT','MT44_MISSING_2025','MT44_MEGA_2025',
              'MT45_MEGA_2025_ROUNDS','MT46_PUCHAR_ROUND1_DRAW','MT47_PUCHAR_ROUND2_DRAW',
              'MT48_FLOAT_ROUND2_DRAW'):
  def section(a):return a.split('const '+name+'=',1)[1].split(';\n',1)[0]
  assert section(old)==section(s),(suffix,name,'archive changed')
 for code in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S):
  if code.strip():
   path=Path('/tmp/mt66-script.js');path.write_text(code)
   subprocess.run(['node','--check',str(path)],check=True,capture_output=True)
   path.unlink()
 for token in ('<title>MatchThis MT-66</title>','data-version="MT-66"','aria-label="Wersja MT-66">MT-66',"const APP_VERSION='MT-66'",'function mt66BulkConfirm(all)'):
  assert token in s,(suffix,token)
 destination=D/f'MatchThis_MT-66{suffix}.html'
 destination.write_text(s,'utf8')
 print('MT66_BUILT',suffix,hashlib.sha256(s.encode()).hexdigest(),len(s))
