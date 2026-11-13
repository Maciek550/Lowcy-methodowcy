#!/usr/bin/env python3
"""MT77: show real official scores/weights instead of empty sector placeholders.

No changes to approved sector count, rankings, results, roles or server persistence.
"""
from pathlib import Path
import hashlib,re,subprocess
D=Path('matchthis')
SOURCE={
'':'7c48d3b7bd8400dc432e563697f77fbc7ea6ee5c724fc6191c35bd9003843522',
'_OGLADACZ':'2ac2deb60ef64860b141d8048442b02dc8a1e0584efe384ef161f160eb642b28',
'_SEDZIA':'e7cba2388d827f2698e5848dfb9ee1a7a91bc405dbeac86dcb69e8a15d6dab31'
}
START=' if(!sectors.length){\n  // MT76: approved sector metadata is not a competitor-to-sector assignment.'
END="\n if(selectedSector!=='ALL'&&!sectors.includes(selectedSector))"
PATCH=''' if(!sectors.length){
  // MT77: show ORIGINAL names, official points and weights; no synthetic sector allocations.
  const approved=Number(t.sectorCount);
  const valid=Number.isInteger(approved)&&approved>=2&&approved<=26;
  if(!valid)return §<section class="panel"><h2>Wyniki sektorowe — ${safeName(mt68TourLabel(t,e))}</h2><div class="notice">Brak potwierdzonego przydziału zawodników do sektorów. Wyniki są dostępne dla całej tury.</div><button class="btn" data-result-mode="round">Pokaż całą turę</button></section>§;
  selectedSector='ALL';
  const missing=ranked.filter(x=>!x.sector||x.sector==='—').length;
  const distribution=[...new Set(ranked.map(x=>Number(x.place)).filter(Number.isFinite))].sort((a,b)=>a-b)
   .map(p=>({points:p,count:ranked.filter(x=>Number(x.place)===p).length}));
  const pointsSummary=distribution.map(x=>§${fmt(x.points)}: ${x.count}§).join(' · ');
  const rows=ranked.map(r=>§<tr data-verified-score="${fmt(Number(r.place))}">
   <td class="points-cell" data-label="Punkty sektorowe">${fmt(Number(r.place))}</td>
   <td class="name-cell">${safeName(r.competitorName||r.competitorId||'—')}</td>
   <td class="weight weight-value">${weightText(r.weightG)}</td>
   <td class="sector-cell">${safeName(r.sector||'—')}</td>
   <td class="peg-cell">${r.peg??'—'}</td></tr>§).join('');
  return §<section class="panel compact-sector-panel" data-approved-sectors="${approved}" data-assignment-status="pending" data-unassigned-results="${missing}">
   <div class="result-title"><h2>Wyniki tury — ${safeName(mt68TourLabel(t,e))}</h2><span class="pill">${approved} sektorów · zatwierdzone</span></div>
   <div class="notice">Liczba sektorów jest potwierdzona, ale brak przypisania nazwisk do liter sektorów i stanowisk. Zamiast pustych pól pokazujemy poniżej <b>${ranked.length} rzeczywistych wyników</b> z wagą i oficjalnymi punktami. Nie wymyślamy przydziałów.</div>
   <div class="row" style="gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0"><b>Sektory A–${String.fromCharCode(64+approved)}:</b> przydziały niepotwierdzone <span class="pill">${missing} do przypisania</span></div>
   <p class="sub" data-source-points-summary="true"><b>Punkty źródłowe — liczba zawodników:</b> ${pointsSummary}</p>
   <div class="tablewrap"><table class="round-result match-results mt77-unassigned-results" aria-label="Rzeczywiste wyniki bez podziału na sektory"><thead><tr><th>Pkt. sekt.</th><th class="name-column">Zawodnik</th><th>Waga (g)</th><th>Sektor</th><th>Stan.</th></tr></thead><tbody>${rows}</tbody></table></div>
   <button class="btn noprint" data-result-mode="round">Zobacz pełną klasyfikację tury</button>
  </section>§;
 }'''
PATCH=PATCH.replace('§',chr(96)).replace('$','$')
for role,expected in SOURCE.items():
 p=D/f'MatchThis_MT-76{role}.html'
 b=p.read_bytes()
 assert hashlib.sha256(b).hexdigest()==expected,('MT76_SOURCE_SHA_CHANGED',role)
 s=b.decode('utf8')
 a=s.find(START,s.index('function renderSectorsView('))
 z=s.find(END,a)
 assert a>0 and z>a and s.count(START)==1,('BRANCH_ANCHOR_CHANGED',role)
 s=s[:a]+PATCH+s[z:]
 assert s.count('mt77-unassigned-results')==1
 s=s.replace('MT-76','MT-77')
 for marker in ['<title>MatchThis MT-77</title>','data-version="MT-77"', "const APP_VERSION='MT-77';",'id="appversion">MT-77']:
  assert marker in s,(role,marker)
 for script in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S):
  if script.strip():
   f=Path('/tmp/mt77-script.js');f.write_text(script,encoding='utf8')
   subprocess.run(['node','--check',str(f)],check=True)
 out=D/f'MatchThis_MT-77{role}.html'
 out.write_text(s,encoding='utf8')
 print('MT77_BUILT',role or 'ADMIN',hashlib.sha256(out.read_bytes()).hexdigest(),out.stat().st_size)
