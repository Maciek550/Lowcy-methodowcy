from pathlib import Path
import hashlib,re,subprocess
D=Path(__file__).resolve().parent
BASE={'':'ff3ef02ec1d9f3550366f5671460194c27c2e3b643f9fa1b54b94ff010d7f851','_OGLADACZ':'e93a66c5941e5177ea1a6e126c5c4ef8a2fc5fd5a132a73b2d4b7a53a5ebd317','_SEDZIA':'7ea30c27e0b2b951f94ae8c7e1835de426320548dcdee686c9c91d617ce3d421'}
def once(s,a,b):
 assert s.count(a)==1,(a[:100],s.count(a))
 return s.replace(a,b,1)
helpers='''function mt63Players(e){return (e?.entrantIds||[]).map(findPlayer).filter(p=>p&&!p.isReservation)}
function mt63Confirmed(e){return mt63Players(e).filter(p=>e.mt63ConfirmedIds?.includes(p.id))}
function mt63Summary(e){
 const total=mt63Players(e).length,confirmed=mt63Confirmed(e).length;
 return '<div class="mt63-summary" role="status"><span>Zawodników na liście <strong>'+total+'</strong></span><span>Potwierdzonych do losowania <strong>'+confirmed+'</strong></span><span>Niepotwierdzonych <strong>'+(total-confirmed)+'</strong></span></div>';
}
function mt63ConfirmationButton(e,p){
 if(p.isReservation)return '';
 const yes=e.mt63ConfirmedIds?.includes(p.id)===true;
 return '<button type="button" class="btn small mt63-confirm '+(yes?'confirmed':'secondary')+'" data-confirm-entrant="'+escapeHtml(p.id)+'" aria-pressed="'+yes+'">'+(yes?'✓ Potwierdzony':'Potwierdź')+'</button> ';
}
function mt63ToggleConfirmation(id){
 requireAdmin();const e=current(),p=findPlayer(id);
 if(!e||e.archived||!p||p.isReservation||!e.entrantIds?.includes(id))throw Error('Potwierdzenie niedostępne');
 const previous=e.mt63ConfirmedIds;
 const ids=new Set(previous||[]);if(ids.has(id))ids.delete(id);else ids.add(id);
 e.mt63ConfirmedIds=[...ids];
 if(!save()){e.mt63ConfirmedIds=previous;throw Error('Nie udało się zapisać potwierdzenia. Spróbuj ponownie.');}
 render();
}
function mt63DrawRange(e,t){
 const assigned=[...(t.results||[]),...(t.mt55Entries||[])].some(r=>r.peg!=null||r.weightG!=null);
 if(assigned&&t.mt55SectorPlan?.pegs?.length)return mt55CompactPegs(t.mt55SectorPlan.pegs);
 const n=mt63Confirmed(e).length;return n?'1-'+n:'';
}
document.addEventListener('click',event=>{
 const b=event.target.closest('[data-confirm-entrant]');if(!b)return;
 try{mt63ToggleConfirmation(b.dataset.confirmEntrant)}catch(err){alertMsg(err.message)}
});
'''
for role,sha in BASE.items():
 old=(D/f'MatchThis_MT-62{role}.html').read_text()
 assert hashlib.sha256(old.encode()).hexdigest()==sha
 s=old
 for a,b in [('<title>MatchThis MT-62</title>','<title>MatchThis MT-63</title>'),('data-version="MT-62"','data-version="MT-63"'),('aria-label="Wersja MT-62">MT-62','aria-label="Wersja MT-63">MT-63'),('<div class="version" id="appversion">MT-62</div>','<div class="version" id="appversion">MT-63</div>'),("const APP_VERSION='MT-62';","const APP_VERSION='MT-63';"),("const STORAGE_KEY='matchthis-preview-MT-62';","const STORAGE_KEY='matchthis-preview-MT-63';\nconst MT62_STORAGE_KEY='matchthis-preview-MT-62';"),('localStorage.getItem(MT61_STORAGE_KEY)||','localStorage.getItem(MT62_STORAGE_KEY)||localStorage.getItem(MT61_STORAGE_KEY)||')]:
  if a.startswith('localStorage') and a not in s:continue
  s=once(s,a,b)
 s=once(s,'function renderRosterView(e,t){',helpers+'\nfunction renderRosterView(e,t){')
 s=once(s,"'<p class=\"sub\">'+entrants.length", "mt63Summary(e)+'<p class=\"sub\">'+entrants.length")
 s=once(s,"'</td><td>'+(canEdit?(p.isReservation?", "'</td><td>'+(canEdit?mt63ConfirmationButton(e,p):'')+(canEdit?(p.isReservation?")
 s=once(s,"return (e.entrantIds||[]).map(findPlayer).filter(p=>p&&!p.isReservation).map(fullName).join('\\n');", "return mt63Confirmed(e).map(fullName).join('\\n');")
 a=s.index('function mt62EligibleCount(entity){');b=s.index('function mt62RequireExactStations',a)
 s=s[:a]+"function mt62EligibleCount(entity){return mt63Confirmed(entity).length;}\n"+s[b:]
 s=s.replace('Brak zawodników uprawnionych do losowania (rezerwacje nie losują).','Brak potwierdzonych zawodników. Kliknij Potwierdź na liście startowej.')
 s=s.replace('zawodników bez rezerwy (','potwierdzonych zawodników (').replace('zawodników bez rezerwy. Sprawdź listę.','potwierdzonych zawodników. Sprawdź listę.')
 # Preserve all existing assignments/results. Only blank rows require confirmation.
 s=once(s,'const person=findPlayer(id);if(!person||person.isReservation)continue;', 'const person=findPlayer(id);if(!person||person.isReservation||!e.mt63ConfirmedIds?.includes(id))continue;')
 s=once(s,'const entries=old.map(r=>({...r}));',"const entries=old.filter(r=>r.peg!=null||r.weightG!=null||e.mt63ConfirmedIds?.includes(r.competitorId)).map(r=>({...r}));")
 s=once(s,"const pegs=parsePegs(),n=Number(document.getElementById('sectors').value);\n mt62RequireExactStations(e,pegs);\n const groups=mt55CheckPlan(pegs,n),sectors=", "const confirmed=mt63Confirmed(e);\n if(names.some((name,i)=>name!==fullName(confirmed[i])))throw Error('Lista losowania musi zawierać wyłącznie potwierdzonych zawodników. Otwórz losowanie ponownie.');\n const pegs=parsePegs(),n=Number(document.getElementById('sectors').value);\n mt62RequireExactStations(e,pegs);\n const groups=mt55CheckPlan(pegs,n),sectors=")
 s=once(s,"names.map(n=>({competitorId:resolveCompetitor(n),competitorName:n}))", "confirmed.map(p=>({competitorId:p.id,competitorName:fullName(p)}))")
 s=once(s,'<label>Zawodnicy (jeden w wierszu)<textarea id="rosterText" rows="4"', '${mt63Summary(e)}<label>Potwierdzeni zawodnicy do losowania<textarea id="rosterText" readonly rows="4"')
 s=once(s,"t.mt55SectorPlan?.pegs?.length?mt55CompactPegs(t.mt55SectorPlan.pegs):(mt62EligibleCount(e)?'1-'+mt62EligibleCount(e):'')",'mt63DrawRange(e,t)')
 s=s.replace('</style>', '.mt63-summary{display:flex;flex-wrap:wrap;gap:8px;margin:10px 0}.mt63-summary span{padding:8px 12px;background:#f0f2f4;border:1px solid #d8dde2;border-radius:7px}.mt63-summary strong{margin-left:6px}.mt63-confirm{min-width:130px;margin:3px 6px 3px 0}.mt63-confirm.confirmed{background:#16733a!important;border-color:#16733a!important;color:#fff!important}\n</style>',1)
 for key in ('MATCHTHIS_ARCHIVE_2026','MATCHTHIS_STANDALONE_2026','MATCHTHIS_ARCHIVE_2025_MEGA_V','MATCHTHIS_ARCHIVE_2025_MAVER_OCT','MT44_MISSING_2025','MT44_MEGA_2025','MT45_MEGA_2025_ROUNDS','MT46_PUCHAR_ROUND1_DRAW','MT47_PUCHAR_ROUND2_DRAW','MT48_FLOAT_ROUND2_DRAW'):
  get=lambda x:x.split('const '+key+'=',1)[1].split(';\n',1)[0]
  assert get(old)==get(s),key
 for script in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S):
  if script.strip():
   temp=D/'_mt63_check.js';temp.write_text(script);subprocess.run(['node','--check',str(temp)],check=True);temp.unlink()
 (D/f'MatchThis_MT-63{role}.html').write_text(s)
 print('MT63_BUILD_PASS',role,hashlib.sha256(s.encode()).hexdigest())
for kind in ('deploy','rollback'):
 s=(D/f'{kind}-mt62-small2.sh').read_text()
 for a,b in [('MT-62','MT-63'),('MT62','MT63'),('mt62','mt63'),('mt-62','mt-63'),('MT-61','MT-62'),('MT61','MT62'),('mt61','mt62'),('mt-61','mt-62')]:s=s.replace(a,b)
 (D/f'{kind}-mt63-small2.sh').write_text(s)
