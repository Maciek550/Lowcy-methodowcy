#!/usr/bin/env python3
"""MT76: replace only no-assignment sector view, preserving MT75 data and roles."""
from pathlib import Path
import re,hashlib,subprocess
D=Path("matchthis")
BASE={"":"bffd09ff07c8771ff3a359f180d0b4fe930295bc3a10f079b5ecbf27a711fac0",
"_OGLADACZ":"db6b74cb6bbe139efac93197842ae3da97131b7af486b586e88408e39455875a",
"_SEDZIA":"d7c9e4ef9737f9651fe1c7697aa9eed69647235b19a81e6252b1756a42cf5147"}
OLD=''' if(!sectors.length&&published)return published;
 if(!sectors.length)return §<section class="panel"><h2>Wyniki sektorowe — ¤{safeName(mt68TourLabel(t,e))}</h2><div class="notice">W dostarczonych tabelach tej tury nie ma przypisania zawodników do sektorów. Nie tworzymy sztucznych sektorów. Dostępne są wyniki całej tury.</div><button class="btn" data-result-mode="round">Pokaż całą turę</button></section>§;'''
NEW=''' if(!sectors.length&&published)return published;
 if(!sectors.length){
  // MT76: approved sector metadata is not a competitor-to-sector assignment.
  const approved=Number(t.sectorCount);
  const labels=Number.isInteger(approved)&&approved>=2&&approved<=26?Array.from({length:approved},(_,i)=>String.fromCharCode(65+i)):[];
  if(!labels.length)return §<section class="panel"><h2>Wyniki sektorowe — ¤{safeName(mt68TourLabel(t,e))}</h2><div class="notice">W dostarczonych tabelach tej tury nie ma przypisania zawodników do sektorów. Nie tworzymy sztucznych sektorów. Dostępne są wyniki całej tury.</div><button class="btn" data-result-mode="round">Pokaż całą turę</button></section>§;
  if(selectedSector!=='ALL'&&!labels.includes(selectedSector))selectedSector='ALL';
  const shown=selectedSector==='ALL'?labels:labels.filter(x=>x===selectedSector);
  return §<section class="panel compact-sector-panel" data-approved-sectors="¤{approved}" data-assignment-status="pending">
   <div class="result-title"><h2>Wyniki sektorowe — ¤{safeName(mt68TourLabel(t,e))}</h2><span class="pill">¤{approved} sektorów · zatwierdzone</span></div>
   <p class="sub">Liczba sektorów jest zatwierdzona. Brak potwierdzonego przypisania zawodników do sektorów i stanowisk — nie rozdzielamy ich na podstawie punktów ani wagi. Wyniki ¤{ranked.length} zawodników dostępne są w widoku całej tury.</p>
   <div class="sector-tools noprint"><div class="sector-choice" aria-label="Wybór zatwierdzonego sektora">
    <button class="¤{selectedSector==='ALL'?'active':''}" data-sector-filter="ALL">Wszystkie (¤{approved})</button>
    ¤{labels.map(s=>§<button class="¤{selectedSector===s?'active':''}" data-sector-filter="¤{s}">Sektor ¤{s}</button>§).join('')}
   </div></div>
   <div class="mt76-sector-pending-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px;margin:10px 0 14px">
    ¤{shown.map(s=>§<div class="mt76-sector-pending" style="border:1px solid #d4d8df;border-radius:4px;padding:12px;background:#f8f9fa"><strong>SEKTOR ¤{s}</strong><div class="smallprint" style="margin-top:6px">Oczekuje na potwierdzenie przydziałów</div></div>§).join('')}
   </div>
   <button class="btn" data-result-mode="round">Pokaż wyniki całej tury (¤{ranked.length})</button>
  </section>§;
 }'''
OLD=OLD.replace('§',chr(96)).replace('¤{','$'+'{')
NEW=NEW.replace('§',chr(96)).replace('¤{','$'+'{')
for role,sha in BASE.items():
 p=D/f'MatchThis_MT-75{role}.html'
 b=p.read_bytes()
 assert hashlib.sha256(b).hexdigest()==sha,('MT75_SOURCE_CHANGED',role)
 s=b.decode('utf8')
 assert s.count(OLD)==1,('MISSING_EXACT_SECTOR_BRANCH',role)
 count=9 if role=='_OGLADACZ' else 12
 assert s.count('MT-75')==count
 s=s.replace(OLD,NEW,1).replace('MT-75','MT-76')
 assert s.count('MT-76')==count
 for marker in ['<title>MatchThis MT-76</title>','data-version="MT-76"',"const APP_VERSION='MT-76';",'id="appversion">MT-76']:
  assert marker in s,(role,marker)
 for js in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S):
  if not js.strip():continue
  tmp=Path('/tmp/check-mt76.js');tmp.write_text(js,encoding='utf8')
  subprocess.run(['node','--check',str(tmp)],check=True,stdout=subprocess.DEVNULL)
 out=D/f'MatchThis_MT-76{role}.html';out.write_text(s,encoding='utf8')
 print('MT76_BUILD_PASS',role or 'ADMIN',hashlib.sha256(out.read_bytes()).hexdigest(),out.stat().st_size)
