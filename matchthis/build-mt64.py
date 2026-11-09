from pathlib import Path
import hashlib,re,subprocess
D=Path(__file__).resolve().parent
BASE={'':'4ae350918420b29fec7f856d39db0b17a14c3951c0637056f789f45c422a1734','_OGLADACZ':'8fcb2bfacf19feb7255dc58e36bcb1f39622b4025ea2b00d4df22acc12621cd1','_SEDZIA':'7600d5419923d14c67732770a629c51d62622ec553fdb05169f48afb71e18906'}
def once(s,a,b):
 assert s.count(a)==1,(a[:80],s.count(a))
 return s.replace(a,b,1)
for role,sha in BASE.items():
 old=(D/f'MatchThis_MT-63{role}.html').read_text();assert hashlib.sha256(old.encode()).hexdigest()==sha
 s=old
 for a,b in [('<title>MatchThis MT-63</title>','<title>MatchThis MT-64</title>'),('data-version="MT-63"','data-version="MT-64"'),('aria-label="Wersja MT-63">MT-63','aria-label="Wersja MT-64">MT-64'),('<div class="version" id="appversion">MT-63</div>','<div class="version" id="appversion">MT-64</div>'),("const APP_VERSION='MT-63';","const APP_VERSION='MT-64';"),("const STORAGE_KEY='matchthis-preview-MT-63';","const STORAGE_KEY='matchthis-preview-MT-64';\nconst MT63_STORAGE_KEY='matchthis-preview-MT-63';")]:s=once(s,a,b)
 if 'localStorage.getItem(MT62_STORAGE_KEY)||' in s:s=once(s,'localStorage.getItem(MT62_STORAGE_KEY)||','localStorage.getItem(MT63_STORAGE_KEY)||localStorage.getItem(MT62_STORAGE_KEY)||')
 # Organizer accepted this roster on 09.11.2026. Acceptance is scoped to
 # exactly these source names in XIV Puchar, never historical player records.
 s=once(s,'function renderRosterView(e,t){', '''function mt64RosterNameNeedsReview(e,p){
 const accepted=mt52IsXiv(e)&&MT52_XIV_NAMES.some(name=>norm(name)===norm(mt52CleanName(fullName(p))));
 return Boolean(p.nameNeedsReview&&!accepted);
}
function renderRosterView(e,t){''')
 s=once(s,"(p.nameNeedsReview?'<small class=\"review-name\">Potwierdź zapis nazwiska</small>':'')", "(mt64RosterNameNeedsReview(e,p)?'<small class=\"review-name\">Potwierdź zapis nazwiska</small>':'')")
 for script in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S):
  if script.strip():
   p=D/'_mt64_check.js';p.write_text(script);subprocess.run(['node','--check',str(p)],check=True);p.unlink()
 (D/f'MatchThis_MT-64{role}.html').write_text(s)
 print('MT64_BUILD_PASS',role,hashlib.sha256(s.encode()).hexdigest())
for kind in ('deploy','rollback'):
 s=(D/f'{kind}-mt63-small2.sh').read_text()
 for a,b in [('MT-63','MT-64'),('MT63','MT64'),('mt63','mt64'),('mt-63','mt-64'),('MT-62','MT-63'),('MT62','MT63'),('mt62','mt63'),('mt-62','mt-63')]:s=s.replace(a,b)
 (D/f'{kind}-mt64-small2.sh').write_text(s)
