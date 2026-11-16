#!/usr/bin/env python3
"""MT85: XIV Puchar T2 results first, published draw collapsed below; no data mutation."""
from pathlib import Path
import hashlib,sys
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path('matchthis')
expected={
 '':'2daaeef1f9c3a404b55d01588682c93f615daf3a824d1f393967c4b19292bdbc',
 '_OGLADACZ':'665ba63846b5481ceeb2d7812b29cc3738fa1bb66029aaf2cb3836358511f263',
 '_SEDZIA':'5ddbdc2796786518967d5026f002c41d7d2c47c125f15cc09d6b4a3d7c64770b',
}
def once(s,a,b):
 assert s.count(a)==1,(a[:90],s.count(a))
 return s.replace(a,b,1)
helper='''// MT85: scope exclusively to the XIV Puchar's second tour. No data writes.
function mt85TargetRound(e,t){
 return e?.id==='mt2026-xiv-puchar-matchthis-28-29-nov' && roundIndex===1 && getRounds(e)[1]===t;
}
function mt85DrawDetails(draw){
 return draw?'<details class="mt85-published-draw noprint"><summary>Opublikowane losowanie stanowisk — pokaż</summary>'+draw+'</details>':'';
}
function mt85NoWeights(e,t,draw){
 if(!mt85TargetRound(e,t)||t.sourceOfficial||(t.results||[]).length || !(t.mt55Entries||[]).length ||
    (t.mt55Entries||[]).some(r=>r.weightG!=null))return '';
 return '<section class="panel mt85-empty-results"><h2>Wyniki sektorowe — '+safeName(mt68TourLabel(t,e))+'</h2>'+
  '<p class="sub">Zapisane przydziały stanowisk i sektorów są dostępne. Wagi II tury nie zostały jeszcze wprowadzone.</p>'+
  (roleMode==='admin'?'<button class="btn" data-result-mode="edit">Wpisz wagi II tury</button>':'<p class="sub">Wyniki pojawią się po zapisaniu wag.</p>')+
  '</section>'+mt85DrawDetails(draw);
}
'''
css='''.mt85-published-draw{margin:10px 0 20px;background:#fff;border:1px solid #dedfe1;padding:10px;border-radius:4px}
.mt85-published-draw>summary{cursor:pointer;font-weight:700;color:#9f4300}
.mt85-published-draw>.mt60-published-draw{margin-top:10px}
'''
for suffix,digest in expected.items():
 f=root/f'MatchThis_MT-84{suffix}.html'
 raw=f.read_bytes();assert hashlib.sha256(raw).hexdigest()==digest, 'MT84 base changed: '+str(f)
 s=raw.decode('utf-8')
 s=once(s,'function renderSectorsView(e,t){',helper+'function renderSectorsView(e,t){')
 s=once(s,'function renderSectorsView(e,t){\n const published=mt60PublicDrawTable(e,t);',
 '''function renderSectorsView(e,t){
 const allDraw=mt60PublicDrawTable(e,t);
 const mt85=mt85TargetRound(e,t),published=mt85?'':allDraw,drawAfter=mt85?mt85DrawDetails(allDraw):'';
 const empty=mt85NoWeights(e,t,allDraw);if(empty)return empty;''')
 s=once(s,'if(!sectors.length&&published)return published;',
           'if(!sectors.length&&allDraw)return mt85?mt85DrawDetails(allDraw):published;')
 s=once(s, '${mt83PendingPanel(e,t,view)}</section>`;\n}\nfunction renderRoundGeneral(e,t){',
           '${mt83PendingPanel(e,t,view)}</section>`+drawAfter;\n}\nfunction renderRoundGeneral(e,t){')
 s=once(s,'function renderRoundGeneral(e,t){\n const published=mt60PublicDrawTable(e,t);',
 '''function renderRoundGeneral(e,t){
 const allDraw=mt60PublicDrawTable(e,t);
 const mt85=mt85TargetRound(e,t),published=mt85?'':allDraw,drawAfter=mt85?mt85DrawDetails(allDraw):'';
 const empty=mt85NoWeights(e,t,allDraw);if(empty)return empty;''')
 s=once(s,'if(!rows.length&&published)return published;',
           'if(!rows.length&&allDraw)return mt85?mt85DrawDetails(allDraw):published;')
 s=once(s,'${readableResultsTable(rows)}${mt83PendingPanel(e,t,view)}</section>`;',
           '${readableResultsTable(rows)}${mt83PendingPanel(e,t,view)}</section>`+drawAfter;')
 # Sector FB photos and vector PDFs must use the SAME read-only classified tour view as result tables.
 # Do not invent catches: add only explicitly assigned starters with 0g.
 s=once(s,'function photoCandidates(){',
          'function mt85ExportRows(e,t){\\n return core.tourClassification(mt83TourView(e,t)).filter(r=>!core.isNonStarter(r));\\n}\\nfunction photoCandidates(){')
 s=once(s,'hasActive=rows.length>0;sectors=genuinePhotoSectors(tour);',
          'hasActive=rows.length>0;sectors=genuinePhotoSectors(mt83TourView(entity,tour));')
 s=once(s,'const tour=chosenRound.tour,ranked=core.tourClassification(tour).filter(r=>!core.isNonStarter(r));',
          'const tour=chosenRound.tour,ranked=mt85ExportRows(entity,tour);')
 s=once(s,'const ranked=core.tourClassification(tour).filter(r=>!core.isNonStarter(r));\\n const sectors=genuinePhotoSectors(tour);',
          'const ranked=mt85ExportRows(entity,tour);\\n const sectors=genuinePhotoSectors(mt83TourView(entity,tour));')
 s=once(s,'const tour=getRounds(entity)[roundIndex];const ranked=core.tourClassification(tour).filter(r=>!core.isNonStarter(r));const pdf=MatchThisVectorPdf.create(',
          'const tour=getRounds(entity)[roundIndex];const ranked=mt85ExportRows(entity,tour);const pdf=MatchThisVectorPdf.create(')
 s=once(s,'function renderFbPhoto(e,t){const ranked=core.tourClassification(t).filter(r=>!core.isNonStarter(r));const sectors=genuinePhotoSectors(t);',
          'function renderFbPhoto(e,t){const ranked=mt85ExportRows(e,t);const sectors=genuinePhotoSectors(mt83TourView(e,t));')
 s=s.replace('</style>',css+'</style>',1)
 s=s.replace('MT-84','MT-85')
 out=root/f'MatchThis_MT-85{suffix}.html';out.write_text(s,'utf-8')
 print(out.name,hashlib.sha256(out.read_bytes()).hexdigest())
