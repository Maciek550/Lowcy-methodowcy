from pathlib import Path
import re, hashlib, subprocess
ROOT=Path('/mnt/data')
STORAGE='matchthis-preview-MT-59'
css='''<style id="mt60-sector-compact-and-draw">
/* MT60: Only editable sector weight tables; the main roster remains untouched. */
.mt55-sector-card .tablewrap{max-height:none!important;overflow:visible!important}
.mt55-sector-card .mt55-table{width:100%;table-layout:fixed;font-size:12px}
.mt55-sector-card .mt55-table th,.mt55-sector-card .mt55-table td{padding:3px 4px;height:32px;line-height:1.2}
.mt55-sector-card .mt55-table th:first-child,.mt55-sector-card .mt55-table td:first-child{width:44px!important;text-align:center}
.mt55-sector-card .mt55-table th:last-child,.mt55-sector-card .mt55-table td:last-child{width:116px!important;text-align:center}
.mt55-sector-card .mt55-table td:nth-child(2){white-space:nowrap;font-size:11px;letter-spacing:-.15px;overflow:visible}
.mt55-sector-card .mt55-table input{min-width:0!important;max-width:none;width:100%;height:26px;padding:2px 5px;font-size:12px}
.mt55-sector-card h3{padding:7px 10px}
.mt60-draw-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:11px 0}
.mt60-draw-card{border:1px solid #d7dce0;border-radius:5px;overflow:hidden;min-width:0}
.mt60-draw-card h3{margin:0;padding:8px 11px;background:#fff4e9;border-bottom:2px solid #e96609;color:#913e02;font-size:14px}
.mt60-draw-card table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px}
.mt60-draw-card th{background:#292d32;color:white}
.mt60-draw-card th,.mt60-draw-card td{padding:5px 8px;border:1px solid #d9dde3}
.mt60-draw-card th:first-child,.mt60-draw-card td:first-child{width:51px;text-align:center}
.mt60-draw-card td:last-child{white-space:nowrap}
.mt60-refresh{border:1px solid #aeb7bf;background:#fff;padding:5px 10px;border-radius:4px;cursor:pointer}
@media(max-width:800px){.mt60-draw-grid{grid-template-columns:1fr}.mt55-sector-card .mt55-table td:nth-child(2){font-size:11px}}
@media(max-width:390px){.mt55-sector-card .mt55-table th:last-child,.mt55-sector-card .mt55-table td:last-child{width:102px!important}}
</style>'''
viewer_logic=r'''
// MT-60: Anonymous viewer reads published draws only; never the organizer's browser storage.
let mt60PublicDraws=new Map();
const mt60DrawKey=(eventId,index)=>String(eventId)+'#'+String(index);
function mt60PublishedDrawFor(e,t){
 if(!e||!t)return null;
 const key=mt60DrawKey(e.id,roundIndex);
 if(roleMode==='viewer')return mt60PublicDraws.get(key)||null;
 if(!t.drawPublished)return null;
 const rows=t.mt55Entries?.length?t.mt55Entries:t.results||[];
 if(!rows.length)return null;
 return {eventId:e.id,roundIndex,rows:rows.map(r=>({competitorId:r.competitorId,competitorName:r.competitorName,peg:r.peg,sector:r.sector}))};
}
function mt60PublicDrawTable(e,t){
 const data=mt60PublishedDrawFor(e,t);if(!data?.rows?.length)return '';
 const rows=data.rows.filter(r=>Number.isInteger(Number(r.peg))&&r.sector);
 const sectors=[...new Set(rows.map(r=>r.sector))].sort((a,b)=>a.localeCompare(b,'pl'));
 return '<section class="panel mt60-published-draw" aria-label="Opublikowane losowanie stanowisk">'+
 '<div class="row" style="align-items:center;justify-content:space-between;gap:12px"><h2>Losowanie stanowisk — '+safeName(t.name)+'</h2>'+
 (roleMode==='viewer'?'<button type="button" class="mt60-refresh noprint" data-action="mt60RefreshPublicDraw">Odśwież</button>':'')+'</div>'+
 '<p class="sub">Opublikowany przydział stanowisk według sektorów. Wagi i klasyfikacja wyników są oddzielne.</p>'+
 '<div class="mt60-draw-grid">'+sectors.map(sector=>{
  const list=rows.filter(r=>r.sector===sector).sort((a,b)=>Number(a.peg)-Number(b.peg));
  return '<section class="mt60-draw-card"><h3>Sektor '+safeName(sector)+' · '+list.length+' zawodników</h3><table><thead><tr><th>Stan.</th><th>Zawodnik</th></tr></thead><tbody>'+
   list.map(r=>'<tr><td>'+Number(r.peg)+'</td><td>'+safeName(r.competitorName)+'</td></tr>').join('')+'</tbody></table></section>';
 }).join('')+'</div></section>';
}
async function mt60RefreshPublicDraws(){
 if(roleMode!=='viewer'||!['https:','http:'].includes(location.protocol))return;
 try{
  const response=await fetch('/mt60-draws.php',{method:'GET',cache:'no-store',credentials:'omit',headers:{'Accept':'application/json'}});
  if(!response.ok)throw Error('HTTP '+response.status);
  const payload=await response.json();
  if(!Array.isArray(payload.draws))throw Error('Nieprawidłowa odpowiedź serwera');
  const fresh=new Map();
  for(const item of payload.draws){
   if(!item||typeof item.eventId!=='string'||!Number.isInteger(item.roundIndex)||!Array.isArray(item.rows))continue;
   if(!db.events.some(e=>e.id===item.eventId))continue;
   fresh.set(mt60DrawKey(item.eventId,item.roundIndex),item);
  }
  mt60PublicDraws=fresh;
  if(page==='event'||page==='cycle')render();
 }catch(error){console.warn('MT-60: publiczny podgląd losowania jest niedostępny',error);}
}
async function mt60ServerPublication(action,e,t){
 const tokenResponse=await fetch('/mt60-draws.php?token=1',{cache:'no-store',credentials:'same-origin',headers:{'Accept':'application/json'}});
 if(!tokenResponse.ok)throw Error('Nie ma aktywnej sesji administratora (HTTP '+tokenResponse.status+'). Zaloguj się ponownie.');
 const token=await tokenResponse.json();
 if(!token.csrf)throw Error('Brak tokenu sesji publikacji');
 const data={action,eventId:String(e.id),roundIndex};
 if(action==='publish'){
  const entries=t.mt55Entries?.length?t.mt55Entries:t.results||[];
  data.eventName=e.name;data.tourName=t.name;data.date=t.date||e.date||'';
  data.rows=entries.map(r=>({competitorId:String(r.competitorId),competitorName:String(r.competitorName),peg:Number(r.peg),sector:String(r.sector||'')}));
 }
 const response=await fetch('/mt60-draws.php',{method:'POST',credentials:'same-origin',cache:'no-store',
  headers:{'Content-Type':'application/json','Accept':'application/json','X-MT-CSRF':token.csrf},body:JSON.stringify(data)});
 if(!response.ok)throw Error('Serwer nie zapisał publikacji (HTTP '+response.status+').');
 const result=await response.json();if(!result.ok)throw Error('Serwer nie potwierdził publikacji');
 return result;
}
'''
# work around same-origin viewer file prototype without network; this uses no arbitrary user data
publication=r'''
async function toggleDrawPublication(){
 const e=current(),t=e?getRounds(e)[roundIndex]:null;
 if(!e||!t) {alertMsg('Nie wybrano tury');return;}
 const visible=!!t.drawPublished;
 if(!visible){
  if(!isFutureDraw(e,t)){alertMsg('Losowania archiwalne i minione pozostają niepubliczne');return;}
  const rows=t.mt55Entries?.length?t.mt55Entries:t.results||[];
  if(!rows.length||!rows.every(r=>r.competitorName&&Number.isInteger(Number(r.peg))&&Number(r.peg)>0&&r.sector)){
   alertMsg('Najpierw przypisz wszystkim zawodnikom stanowiska i sektory');return;
  }
 }
 try{
  const remote=['https:','http:'].includes(location.protocol);
  if(remote)await mt60ServerPublication(visible?'hide':'publish',e,t);
  t.drawPublished=!visible;
  const stored=save();render();
  alertMsg(visible?(remote?'Losowanie ukryto w publicznym widoku oglądacza':'Losowanie ukryto lokalnie'):
    (remote?'Losowanie opublikowano. WIDOK OGLĄDACZA pokazuje stanowiska według sektorów.':'Zaznaczono publikację lokalnie. Ten plik nie publikuje do internetu.'),stored);
 }catch(err){alertMsg('Publikacja nieudana: '+err.message);}
}
'''
for suffix in ('','_OGLADACZ','_SEDZIA'):
 src=ROOT/f'MatchThis_MT-59{suffix}.html'
 s=src.read_text('utf-8')
 def change(old,new,count=1):
  global s
  c=s.count(old)
  assert c==count,(suffix,'count',c,old[:70])
  s=s.replace(old,new,count)
 s=s.replace('</head>',css+'\n</head>',1)
 change('<title>MatchThis MT-59</title>','<title>MatchThis MT-60</title>')
 change('data-version="MT-59"','data-version="MT-60"')
 change('aria-label="Wersja MT-59">MT-59','aria-label="Wersja MT-60">MT-60')
 change('<div class="version" id="appversion">MT-59</div>','<div class="version" id="appversion">MT-60</div>')
 change("const APP_VERSION='MT-59';","const APP_VERSION='MT-60';")
 change("const STORAGE_KEY='matchthis-preview-MT-59';","const STORAGE_KEY='matchthis-preview-MT-60';\nconst MT59_STORAGE_KEY='matchthis-preview-MT-59';")
 if 'localStorage.getItem(MT58_STORAGE_KEY)||' in s:
  change('localStorage.getItem(MT58_STORAGE_KEY)||','localStorage.getItem(MT59_STORAGE_KEY)||localStorage.getItem(MT58_STORAGE_KEY)||')
 # Add isolated viewer + publish utility once before public results renderer
 change('function renderSectorsView(e,t){',viewer_logic+'\nfunction renderSectorsView(e,t){')
 change('function renderSectorsView(e,t){\n let ranked=[];', 'function renderSectorsView(e,t){\n const published=mt60PublicDrawTable(e,t);\n let ranked=[];')
 sectionStart=s.index('function renderSectorsView(e,t){')
 sectionEnd=s.index('function renderRoundGeneral(e,t){',sectionStart)
 part=s[sectionStart:sectionEnd]
 old='if(!sectors.length)return `<section class="panel">'
 assert part.count(old)==1
 part=part.replace(old,'if(!sectors.length&&published)return published;\n '+old,1)
 s=s[:sectionStart]+part+s[sectionEnd:]
 change("return `<section class=\"panel compact-sector-panel\"><div class=\"sector-tools", "return published+`<section class=\"panel compact-sector-panel\"><div class=\"sector-tools")
 change('function renderRoundGeneral(e,t){\n let rows=[];', 'function renderRoundGeneral(e,t){\n const published=mt60PublicDrawTable(e,t);\n let rows=[];')
 change('return `<section class="panel"><div class="result-title"><h2>Cała tura', "if(!rows.length&&published)return published;\n return published+`<section class=\"panel\"><div class=\"result-title\"><h2>Cała tura")
 # Replace existing local-only publication with guarded authenticated server update
 start=s.index('function toggleDrawPublication(){')
 end=s.index('function previewPublishedDraw(){',start)
 s=s[:start]+publication+'\n'+s[end:]
 # The existing file must be read-only for viewer; don't give the viewer the publisher action
 change("case 'toggleDrawPublication':toggleDrawPublication();break;", "case 'toggleDrawPublication':toggleDrawPublication();break;case 'mt60RefreshPublicDraw':mt60RefreshPublicDraws();break;")
 # adjust controls: don't say local file on hosted server
 change('Ten lokalny plik nie publikuje nic w internecie.', 'Publikacja jest świadoma: przydział zobaczą wszyscy dopiero po zatwierdzeniu. Lokalny plik nie publikuje w internecie.')
 # refresh public snapshot after UI init and first paint; controlled no writes
 change('mtNavInit();\nrender();\n</script>', 'mtNavInit();\nrender();\nmt60RefreshPublicDraws();\n</script>')
 # other version log/visible status; limited to app-current marker
 s=s.replace("console.error('MatchThis MT-59:","console.error('MatchThis MT-60:")
 s=s.replace("console.warn('MatchThis MT-59:","console.warn('MatchThis MT-60:")
 out=ROOT/f'MatchThis_MT-60{suffix}.html'
 out.write_text(s,'utf-8')
 scripts=re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S)
 for i,script in enumerate(scripts):
  if script.strip():
   path=ROOT/f'_mt60_js_check_{suffix or "admin"}_{i}.js';path.write_text(script,'utf8')
   subprocess.run(['node','--check',str(path)],check=True,capture_output=True)
   path.unlink()
 tokens=['<title>MatchThis MT-60</title>',"const APP_VERSION='MT-60'",'data-version="MT-60"','aria-label="Wersja MT-60">MT-60']
 assert all(x in s for x in tokens)
 assert 'function mt59AssignmentsWorkspace' in s and 'function mt59WeightsWorkspace' in s
 assert 'mt55EntryInput(r,\'weight\')' not in s
 print(out.name,'bytes',out.stat().st_size,'SHA256',hashlib.sha256(out.read_bytes()).hexdigest())
