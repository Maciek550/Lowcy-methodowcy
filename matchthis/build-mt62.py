from pathlib import Path
import hashlib,re,subprocess
D=Path(__file__).resolve().parent
# Verified exact MT61 artifacts. Do not overwrite them.
BASE={
 '':'87909ba2d3438f43bd64f444f3bdae947e55eda794178fe07bc829d12c26f36a',
 '_OGLADACZ':'19a5c5f4551c8388c64edbdc6bd54605790e3fe92c1ec0fad04eb707c1af24e9',
 '_SEDZIA':'0aa056a94fcbc87e51ce9ac993aa1394f1259ef8b814a8f89a81f2006a8a610f'
}

def once(s,a,b):
 count=s.count(a)
 assert count==1,(a[:85],count)
 return s.replace(a,b,1)

for role,expected in BASE.items():
 old=(D/f'MatchThis_MT-61{role}.html').read_text('utf8')
 assert hashlib.sha256(old.encode()).hexdigest()==expected,(role,'BASE_HASH_MISMATCH')
 s=old
 for a,b in (
  ('<title>MatchThis MT-61</title>','<title>MatchThis MT-62</title>'),
  ('data-version="MT-61"','data-version="MT-62"'),
  ('aria-label="Wersja MT-61">MT-61','aria-label="Wersja MT-62">MT-62'),
  ('<div class="version" id="appversion">MT-61</div>','<div class="version" id="appversion">MT-62</div>'),
  ("const APP_VERSION='MT-61';", "const APP_VERSION='MT-62';"),
  ("const STORAGE_KEY='matchthis-preview-MT-61';", "const STORAGE_KEY='matchthis-preview-MT-62';\nconst MT61_STORAGE_KEY='matchthis-preview-MT-61';")
 ):s=once(s,a,b)
 # Retain existing client data during upgrade. User data is never erased.
 if 'localStorage.getItem(MT60_STORAGE_KEY)||' in s:
  s=once(s,'localStorage.getItem(MT60_STORAGE_KEY)||', 'localStorage.getItem(MT61_STORAGE_KEY)||localStorage.getItem(MT60_STORAGE_KEY)||')
 for prefix in ('console.warn(\'MT-61:', 'console.error(\'MT-61:', "console.error('MatchThis MT-61:","console.warn('MatchThis MT-61:"):
  s=s.replace(prefix,prefix.replace('MT-61','MT-62'))
 # Existing order of undersized sectors is A, last, B, penultimate ... — preserve.
 assert 'edgeOrder.push(i);' in s and 'edgeOrder.push(sectors-1-i)' in s
 # Count eligible registered people, never reservations.
 eligibility='''// MT-62: one station per actual competitor. Reservations are not contestants.
function mt62EligibleCount(entity){
 return (entity?.entrantIds||[]).filter(id=>{
  const player=findPlayer(id);return !!player&&!player.isReservation;
 }).length;
}
function mt62RequireExactStations(entity,pegs){
 const count=mt62EligibleCount(entity);
 if(!count)throw Error('Brak zawodników uprawnionych do losowania (rezerwacje nie losują).');
 if(pegs.length!==count)throw Error('Liczba stanowisk ('+pegs.length+') musi być równa liczbie zawodników bez rezerwy ('+count+'). Zmień zakres na 1-'+count+'. Rezerwacja nie bierze udziału w losowaniu.');
 return count;
}
'''
 s=once(s,'function mt55Tour(){',eligibility+'\nfunction mt55Tour(){')
 # Also enforce equal cardinality in the matching engine — no bypass via future call sites.
 s=once(s,"if(!entrants.length||entrants.length>pegs.length)throw Error('Liczba zawodników przekracza dostępne stanowiska');",
  "if(!entrants.length||entrants.length!==pegs.length)throw Error('Liczba stanowisk ('+pegs.length+') musi być równa liczbie zawodników losowanych ('+entrants.length+').');")
 # Sector preview reflects the same check; invalid ranges never look accepted.
 s=once(s,'const pegs=parsePegs(),n=Number(document.getElementById(\'sectors\')?.value);\n  const groups=mt56BalancedGroups(pegs,n);',
  "const pegs=parsePegs(),n=Number(document.getElementById('sectors')?.value);\n  mt62RequireExactStations(mt55Tour().e,pegs);\n  const groups=mt56BalancedGroups(pegs,n);")
 # Both 'Ustal sektory' and 'Losuj stanowiska' must reject mismatches before mutating.
 assert s.count("const pegs=parsePegs(),n=Number(document.getElementById('sectors').value);\n const groups=mt55CheckPlan(pegs,n)")==2
 s=s.replace("const pegs=parsePegs(),n=Number(document.getElementById('sectors').value);\n const groups=mt55CheckPlan(pegs,n)",
             "const pegs=parsePegs(),n=Number(document.getElementById('sectors').value);\n mt62RequireExactStations(e,pegs);\n const groups=mt55CheckPlan(pegs,n)",2)
 # Also compare the editable draw list to registered actual competitors (without the reservation).
 s=once(s,"if(!names.length||names.some(n=>norm(n)==='rezerwacja'))throw Error('Wybierz zawodników i zastąp REZERWACJĘ');",
  "if(!names.length||names.some(n=>norm(n)==='rezerwacja'))throw Error('Nie można losować rezerwacji. Z listy losowania wybierz rzeczywistych zawodników.');\n if(names.length!==mt62EligibleCount(e))throw Error('Lista losowania zawiera '+names.length+' osób, ale lista startowa ma '+mt62EligibleCount(e)+' zawodników bez rezerwy. Sprawdź listę.');")
 # For a newly created draw, default to exactly the active competitors, not all roster positions.
 s=once(s,"(e.entrantIds?.length?'1-'+e.entrantIds.length:'')", "(mt62EligibleCount(e)?'1-'+mt62EligibleCount(e):'')")
 # Never rewrite a saved plan, draw, server publication or historic corpus implicitly.
 for key in ('MATCHTHIS_ARCHIVE_2026','MATCHTHIS_STANDALONE_2026','MATCHTHIS_ARCHIVE_2025_MEGA_V',
             'MATCHTHIS_ARCHIVE_2025_MAVER_OCT','MT44_MISSING_2025','MT44_MEGA_2025',
             'MT45_MEGA_2025_ROUNDS','MT46_PUCHAR_ROUND1_DRAW','MT47_PUCHAR_ROUND2_DRAW','MT48_FLOAT_ROUND2_DRAW'):
  def grab(t):return t.split('const '+key+'=',1)[1].split(';\n',1)[0]
  assert grab(old)==grab(s),(role,key,'ARCHIVE_CHANGED')
 for marker in ('<title>MatchThis MT-62</title>',"const APP_VERSION='MT-62'",'data-version="MT-62"','aria-label="Wersja MT-62">MT-62'):
  assert marker in s,(role,marker)
 for script in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S):
  if script.strip():
   temp=D/'_mt62_check.js';temp.write_text(script,'utf8')
   subprocess.run(['node','--check',str(temp)],check=True,capture_output=True)
   temp.unlink()
 (D/f'MatchThis_MT-62{role}.html').write_text(s,'utf8')
 print(role or 'ADMIN','SHA256',hashlib.sha256(s.encode()).hexdigest(),'BYTES',len(s))
print('MT62_BUILD_SOURCE_VERSION_ARCHIVES_JS_PASS')
