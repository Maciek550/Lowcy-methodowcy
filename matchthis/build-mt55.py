from pathlib import Path
import re
src=Path(__file__).resolve().parent
css='''
<style id="mt55-workspace-style">
.mt55-workspace{margin-top:11px}.mt55-workspace .mt55-hint{font-size:13px;color:#5f6771;margin:8px 0}
.mt55-sector-plan{padding:8px 12px;margin:7px 0 12px;border:1px solid #dfe3e6;background:#f7f8f9;border-radius:4px}
.mt55-sector-plan strong{display:block;margin-bottom:5px}
.mt55-actions{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:8px 0}
.mt55-reset{color:#943c19;border-color:#be977f;background:#fff}
.mt55-table{width:100%;border-collapse:collapse;font-size:13px}
.mt55-table th{background:#292d32;color:#fff;position:sticky;top:0;z-index:1}
.mt55-table td,.mt55-table th{padding:7px 8px;border:1px solid #dadde2;text-align:left}
.mt55-table td.mt55-num{width:72px;text-align:center}
.mt55-table input{box-sizing:border-box;width:100%;max-width:130px;padding:7px;border:1px solid #afb6bf;border-radius:4px;background:#fff;color:#1d2329;font:inherit}
.mt55-table input:focus{outline:2px solid #e96609;outline-offset:1px}
.mt55-table .mt55-weight{text-align:right;font-variant-numeric:tabular-nums}
.mt55-table .mt55-sector-name{font-weight:700;color:#b95206}
.mt55-saved{background-color:#b5edc1!important;border-color:#2f9e51!important;transition:background-color .3s ease}
.mt55-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0}
.mt55-sector-card{min-width:0;background:#fff;border:1px solid #dfe2e6;border-radius:5px;overflow:hidden}
.mt55-sector-card h3{padding:9px 12px;margin:0;background:#fff6ed;border-bottom:2px solid #e96609;font-size:15px}
.mt55-sector-card .tablewrap{margin:0;max-height:440px;overflow:auto}
.mt55-overflow{max-height:470px;overflow:auto;border:1px solid #ddd}
.mt55-muted{font-size:12px;color:#707680;margin:10px 12px}
.mt55-mini-status{font-size:12px;color:#287c3e}
@media(max-width:780px){.mt55-grid{grid-template-columns:minmax(0,1fr)}.mt55-table td,.mt55-table th{padding:5px}.mt55-table input{min-width:60px}}
</style>
'''
logic=r'''
// MT-55: per-round station assignments and weights are separate.
// Unweighed entries stay in mt55Entries and are NEVER converted to 0 g results.
function mt55Tour(){const e=current();return {e,t:e?getRounds(e)[roundIndex]:null}}
function mt55Writable(e,t){return roleMode==='admin'&&e&&t&&t.status!=='FINAL'&&isFutureDraw(e,t)}
function mt55Entries(e,t){
 const old=Array.isArray(t.mt55Entries)?t.mt55Entries:[];
 const source=(t.results||[]);
 const entries=old.map(r=>({...r}));
 for(const r of source){
  if(!r.competitorId)continue;
  if(!entries.some(x=>String(x.competitorId)===String(r.competitorId))){
   entries.push({competitorId:r.competitorId,competitorName:r.competitorName,peg:r.peg??null,sector:r.sector||null,weightG:r.weightG??null});
  }
 }
 for(const id of (e.entrantIds||[])){
  const person=findPlayer(id);if(!person||person.isReservation)continue;
  if(!entries.some(x=>String(x.competitorId)===String(id)))entries.push({competitorId:id,competitorName:fullName(person),peg:null,sector:null,weightG:null});
 }
 return entries;
}
function mt55PegMap(t){
 if(!t.mt55SectorPlan?.pegs?.length)return new Map();
 return new Map(core.sectorsFromPegs(t.mt55SectorPlan.pegs,t.mt55SectorPlan.sectors)
  .flatMap(g=>g.pegs.map(peg=>[peg,g.sector])));
}
function mt55CheckPlan(pegs,sectors){return core.sectorsFromPegs(pegs,sectors)}
function mt55SectorInfo(e,t){
 const plan=t.mt55SectorPlan;if(!plan?.pegs?.length)return '';
 const groups=core.sectorsFromPegs(plan.pegs,plan.sectors);
 return groups.map(g=>'<div><strong>Sektor '+escapeHtml(g.sector)+'</strong> · stanowiska '+g.pegs.join(', ')+'</div>').join('');
}
function mt55EntryInput(row,field){
 const val=field==='peg'?(row.peg??''):(row.weightG??'');
 const aria=field==='peg'?'Stanowisko':'Waga w gramach';
 return '<input type="number" inputmode="numeric" name="mt55'+field+'" data-mt55-id="'+escapeHtml(row.competitorId)+'" data-mt55-field="'+field+'" aria-label="'+aria+' · '+escapeHtml(row.competitorName)+'" min="'+(field==='peg'?'1':'0')+'" step="1" value="'+escapeHtml(val)+'" placeholder="—">';
}
function mt55SectorPanels(e,t){
 const groups=t.mt55SectorPlan?.pegs?.length?core.sectorsFromPegs(t.mt55SectorPlan.pegs,t.mt55SectorPlan.sectors):[];
 if(!groups.length)return '<p class="mt55-hint">Najpierw podaj stanowiska, liczbę sektorów i kliknij „Ustal sektory”.</p>';
 const entries=mt55Entries(e,t);
 return '<div class="mt55-grid">'+groups.map(g=>{
  const rows=entries.filter(x=>x.sector===g.sector&&Number.isInteger(Number(x.peg))&&x.peg!==null)
   .sort((a,b)=>Number(a.peg)-Number(b.peg));
  return '<section class="mt55-sector-card"><h3>Sektor '+escapeHtml(g.sector)+' · '+rows.length+' stanowisk obsadzonych</h3>'+
   (rows.length?'<div class="tablewrap"><table class="mt55-table"><thead><tr><th>Stan.</th><th>Zawodnik</th><th>Waga (g)</th></tr></thead><tbody>'+
   rows.map(x=>'<tr><td class="mt55-num">'+x.peg+'</td><td>'+safeName(x.competitorName)+'</td><td class="mt55-num">'+mt55EntryInput(x,'weight')+'</td></tr>').join('')+'</tbody></table></div>':
    '<p class="mt55-muted">Brak wpisanych stanowisk w tym sektorze.</p>')+'</section>';
 }).join('')+'</div>';
}
function mt55Workspace(e,t){
 const entries=mt55Entries(e,t);
 return '<section class="panel mt55-workspace noprint"><h2>Stanowiska i wagi — zapis automatyczny</h2>'+
 '<p class="mt55-hint">Wpisz stanowisko, a sektor uzupełni się automatycznie z ustalonego podziału. Po opuszczeniu pola numer lub waga zapisują się automatycznie. Zielone podświetlenie trwa 2 sekundy. Pusta waga oznacza brak ważenia, nie 0 g.</p>'+
 '<div class="mt55-overflow"><table class="mt55-table" id="mt55Assignments"><thead><tr><th>Lp.</th><th>Zawodnik</th><th>Stanowisko</th><th>Sektor</th><th>Waga (g)</th></tr></thead><tbody>'+
 entries.map((r,i)=>'<tr data-mt55-row="'+escapeHtml(r.competitorId)+'"><td>'+(i+1)+'</td><td>'+safeName(r.competitorName)+'</td><td class="mt55-num">'+mt55EntryInput(r,'peg')+'</td><td class="mt55-num mt55-sector-name" data-mt55-sector="'+escapeHtml(r.competitorId)+'">'+escapeHtml(r.sector||'—')+'</td><td class="mt55-num">'+mt55EntryInput(r,'weight')+'</td></tr>').join('')+'</tbody></table></div>'+
 '<h2 style="margin-top:18px">Wpisywanie wag według sektorów i stanowisk</h2><div id="mt55SectorPanels">'+mt55SectorPanels(e,t)+'</div></section>';
}
function mt55RefreshUI(e,t,changedField,changedId){
 const map=new Map(mt55Entries(e,t).map(r=>[String(r.competitorId),r]));
 for(const cell of document.querySelectorAll('[data-mt55-sector]'))cell.textContent=map.get(cell.dataset.mt55Sector)?.sector||'—';
 if(changedField==='peg'){
  const panel=document.getElementById('mt55SectorPanels');if(panel)panel.innerHTML=mt55SectorPanels(e,t);
 }
 for(const field of document.querySelectorAll('[data-mt55-field]')){
  if(field===document.activeElement)continue;
  const r=map.get(String(field.dataset.mt55Id));if(!r)continue;
  const v=r[field.dataset.mt55Field==='peg'?'peg':'weightG'];
  if(field.dataset.mt55Field!=='peg'&&String(field.dataset.mt55Id)!==String(changedId))continue;
  field.value=v??'';
 }
}
function mt55Blink(input){
 if(!input.isConnected)return;
 input.classList.add('mt55-saved');
 if(input.mt55GreenTimer)clearTimeout(input.mt55GreenTimer);
 input.mt55GreenTimer=setTimeout(()=>{if(input.isConnected)input.classList.remove('mt55-saved');},2000);
}
function mt55EditOnBlur(input){
 const {e,t}=mt55Tour();if(!mt55Writable(e,t))throw Error('Nie można zmieniać zatwierdzonej lub historycznej tury');
 const entries=mt55Entries(e,t),id=input.dataset.mt55Id,field=input.dataset.mt55Field;
 const row=entries.find(x=>String(x.competitorId)===String(id));if(!row)throw Error('Nie znaleziono zawodnika');
 const raw=input.value.trim(),value=raw===''?null:Number(raw);
 if(value!==null&&(!Number.isInteger(value)||value<(field==='peg'?1:0)))throw Error(field==='peg'?'Stanowisko musi być dodatnią liczbą całkowitą':'Waga musi być nieujemną liczbą całkowitą');
 const oldValue=row[field==='peg'?'peg':'weightG'];
 if((oldValue??null)===(value??null))return;
 if(field==='peg'){
  if(value!==null&&!t.mt55SectorPlan?.pegs?.length)throw Error('Najpierw ustal stanowiska i sektory');
  const map=mt55PegMap(t);
  if(value!==null&&!map.has(value))throw Error('Stanowisko '+value+' nie należy do ustalonego podziału sektorów');
  if(entries.some(x=>String(x.competitorId)!==String(id)&&x.peg!==null&&Number(x.peg)===value))throw Error('Stanowisko '+value+' jest już zajęte');
  row.peg=value;row.sector=value===null?null:map.get(value);
 }else{
  if(value!==null&&(!row.peg||!row.sector))throw Error('Najpierw wpisz stanowisko, aby ustalić sektor');
  row.weightG=value;
 }
 const oldEntries=t.mt55Entries,oldResults=t.results,oldPub=t.drawPublished;
 const results=(t.results||[]).map(x=>({...x}));
 const idx=results.findIndex(x=>String(x.competitorId)===String(id));
 if(row.weightG!==null&&row.peg!==null&&row.sector){
  const existing=idx>=0?results[idx]:{};
  const result={...existing,competitorId:row.competitorId,competitorName:row.competitorName,peg:row.peg,sector:row.sector,weightG:Number(row.weightG)};
  if(idx<0)results.push(result);else results[idx]=result;
 }else if(idx>=0){
  if(results[idx].officialPlace!==undefined||results[idx].absent)throw Error('Wiersz oficjalnego wyniku zmieniaj przez Edytuj wyniki');
  results.splice(idx,1);
 }
 core.validateTour({...t,results});
 t.mt55Entries=entries;t.results=results;
 if(field==='peg')t.drawPublished=false;
 const success=save();
 if(!success){t.mt55Entries=oldEntries;t.results=oldResults;t.drawPublished=oldPub;throw Error('Nie udało się trwale zapisać zmiany — pamięć przeglądarki jest pełna. Wykonaj eksport.');}
 mt55RefreshUI(e,t,field,id);
 mt55Blink(input);
 if(field==='weightG')return;
}
function mt55PlanSectors(){
 const {e,t}=mt55Tour();if(!mt55Writable(e,t))throw Error('Edycja podziału niedostępna');
 const pegs=parsePegs(),n=Number(document.getElementById('sectors').value);
 const groups=mt55CheckPlan(pegs,n),map=new Map(groups.flatMap(g=>g.pegs.map(p=>[p,g.sector])));
 const entries=mt55Entries(e,t),oldPlan=t.mt55SectorPlan,oldEntries=t.mt55Entries;
 for(const r of entries){
  if(r.peg!=null&&!map.has(Number(r.peg)))throw Error('Wpisane stanowisko '+r.peg+' nie należy do nowego planu. Najpierw popraw przydział.');
  const destination=r.peg==null?null:map.get(Number(r.peg));
  if((t.results||[]).some(x=>String(x.competitorId)===String(r.competitorId)&&x.sector!==destination))throw Error('Nie można zmieniać sektora już zapisanego wyniku.');
  r.sector=destination;
 }
 t.mt55SectorPlan={pegs:pegs.slice(),sectors:n};t.mt55Entries=entries;
 if(!save()){t.mt55SectorPlan=oldPlan;t.mt55Entries=oldEntries;throw Error('Nie udało się zapisać podziału sektorów');}
 document.getElementById('drawInfo').textContent=groups.map(g=>g.sector+': '+g.pegs.join(', ')).join(' | ');
 render();alertMsg('Podział sektorów zapisany. Teraz wpisuj stanowiska i wagi.',true);
}
function mt55Draw(){
 const {e,t}=mt55Tour();if(!mt55Writable(e,t))throw Error('Losowanie tej tury jest niedostępne');
 if((t.results||[]).length||mt55Entries(e,t).some(x=>x.peg!=null||x.weightG!=null))throw Error('Są już przydziały lub wyniki. Aby losować ponownie, użyj Resetuj losowanie (tylko bez wpisanych wag).');
 const text=document.getElementById('rosterText')?.value||'';
 const names=text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(!names.length||names.some(n=>norm(n)==='rezerwacja'))throw Error('Wybierz zawodników i zastąp REZERWACJĘ');
 const pegs=parsePegs(),n=Number(document.getElementById('sectors').value);
 const groups=mt55CheckPlan(pegs,n),sectors=new Map(groups.flatMap(g=>g.pegs.map(p=>[p,g.sector])));
 const history=getRounds(e).filter((_,i)=>i!==roundIndex).flatMap(x=>x.results||[]);
 const drawn=core.drawStations(names.map(n=>({competitorId:resolveCompetitor(n),competitorName:n})),pegs,history);
 const oldPlan=t.mt55SectorPlan,oldEntries=t.mt55Entries,oldPub=t.drawPublished;
 t.mt55SectorPlan={pegs:pegs.slice(),sectors:n};t.mt55Entries=drawn.map(x=>({competitorId:x.competitorId,competitorName:x.competitorName,peg:x.peg,sector:sectors.get(x.peg),weightG:null}));t.drawPublished=false;
 if(!save()){t.mt55SectorPlan=oldPlan;t.mt55Entries=oldEntries;t.drawPublished=oldPub;throw Error('Nie udało się zapisać losowania');}
 render();alertMsg('Losowanie zapisane. Wagi wpisuj w tabelach sektorów.',true);
}
function mt55ResetDraw(){
 const {e,t}=mt55Tour();if(!mt55Writable(e,t))throw Error('Reset niedostępny dla tej tury');
 if((t.results||[]).length||mt55Entries(e,t).some(r=>r.weightG!==null&&r.weightG!==undefined))throw Error('Reset zablokowany: są już zapisane wagi lub wyniki. Nie usuwam wyników.');
 const allocated=mt55Entries(e,t).filter(r=>r.peg!=null);
 if(!allocated.length)throw Error('Nie ma losowania do zresetowania');
 if(!window.confirm('Usunąć tylko przydziały stanowisk bieżącej tury? Lista zawodników, plan sektorów i druga tura zostaną zachowane.'))return;
 const oldEntries=t.mt55Entries,oldPub=t.drawPublished;
 t.mt55Entries=mt55Entries(e,t).map(r=>({...r,peg:null,sector:null}));t.drawPublished=false;
 if(!save()){t.mt55Entries=oldEntries;t.drawPublished=oldPub;throw Error('Nie udało się trwale zapisać resetu');}
 render();alertMsg('Przydziały bieżącej tury zresetowane. Możesz losować lub wpisać stanowiska ręcznie.',true);
}
function mt55HandleAutoSave(event){
 const target=event.target.closest?.('[data-mt55-field]');if(!target)return;
 try{mt55EditOnBlur(target);}catch(err){alertMsg(err.message);const {e,t}=mt55Tour();if(e&&t){const row=mt55Entries(e,t).find(x=>String(x.competitorId)===String(target.dataset.mt55Id));if(row)target.value=row[target.dataset.mt55Field==='peg'?'peg':'weightG']??'';}}
}
'''

def build(s):
 s=s.replace('MT-54','MT-55')
 # migration
 if "const MT53_STORAGE_KEY='matchthis-preview-MT-53';" in s:
  s=s.replace("const MT53_STORAGE_KEY='matchthis-preview-MT-53';", "const MT54_STORAGE_KEY='matchthis-preview-MT-54';\nconst MT53_STORAGE_KEY='matchthis-preview-MT-53';",1)
  s=s.replace('localStorage.getItem(MT53_STORAGE_KEY)||','localStorage.getItem(MT54_STORAGE_KEY)||localStorage.getItem(MT53_STORAGE_KEY)||',1)
 s=s.replace('</head>',css+'</head>',1)
 # add helpers before renderDrawView
 assert s.count('function renderDrawView(e,t){')==1
 s=s.replace('function renderDrawView(e,t){',logic+'\nfunction renderDrawView(e,t){',1)
 # Draw editing area, + plan controls, reset, hint
 old='<div class="row"><button class="btn small secondary" data-action="draw" ${t.status===\'FINAL\'?\'disabled\':\'\'}>Losuj stanowiska</button><button class="btn small secondary" data-action="divide">Pokaż podział sektorów</button></div>'
 assert s.count(old)==1,'no draw buttons'
 new='<div class="row mt55-actions"><button class="btn small secondary" data-action="draw" ${t.status===\'FINAL\'?\'disabled\':\'\'}>Losuj stanowiska</button><button class="btn small secondary" data-action="divide">Ustal sektory</button><button class="btn small secondary mt55-reset" data-action="mt55ResetDraw">Resetuj losowanie</button></div>'
 s=s.replace(old,new,1)
 old='<input id="pegs" placeholder="1-20 lub 1,2,5,6">'
 assert s.count(old)==1
 new='<input id="pegs" value="${escapeHtml(t.mt55SectorPlan?.pegs?.length?mt55CompactPegs(t.mt55SectorPlan.pegs):\'\')}" placeholder="1-20 lub 1,2,5,6">'
 s=s.replace(old,new,1)
 # helper mt55CompactPegs
 s=s.replace('function mt55CheckPlan(pegs,sectors){', "function mt55CompactPegs(pegs){return pegs.every((p,i)=>i===0||p===pegs[i-1]+1)?pegs[0]+'-'+pegs[pegs.length-1]:pegs.join(',')}\nfunction mt55CheckPlan(pegs,sectors){",1)
 old='<input id="sectors" type="number" min="1" value="2">'
 assert s.count(old)==1
 s=s.replace(old,'<input id="sectors" type="number" min="1" value="${t.mt55SectorPlan?.sectors||2}">',1)
 old='<div id="drawInfo" class="smallprint"></div></section><section class="panel noprint"><h2>Wylosowane stanowiska / edycja</h2>${renderResultsEditor(t)}</section>`'
 assert s.count(old)==1
 s=s.replace(old,'<div id="drawInfo" class="mt55-sector-plan">${mt55SectorInfo(e,t)||\'Podział nieustalony — wpisz zakres stanowisk i liczbę sektorów.\'}</div></section>${mt55Workspace(e,t)}`',1)
 # edit tile shows workspace in future for nonofficial, otherwise historic old editor
 old='${renderResultsEditor(t)}</section>`;}'
 assert s.count(old)==1
 s=s.replace(old,"${mt55Writable(e,t)&&!t.sourceOfficial?mt55Workspace(e,t):renderResultsEditor(t)}</section>`;}",1)
 # replace automatic drawing code and divide via narrow regex
 p=r'function draw\(\)\{const e=current\(\).*?\}\nfunction divide\(\)\{const info=core.sectorsFromPegs\(parsePegs\(\),Number\(document.getElementById\(\'sectors\'\).value\)\);document.getElementById\(\'drawInfo\'\).textContent=info.map\(x=>x.sector\+\': \'\+x.pegs.join\(\', \'\)\).join\(\' \\| \'\)\}'
 # use indexes instead because regex fragile
 start=s.index('function draw(){const e=current(),t=getRounds(e)[roundIndex]')
 end=s.index('\nfunction buildSectorPrintHtml(',start)
 excerpt=s[start:end]
 assert excerpt.count('function divide()')==1
 s=s[:start]+'function draw(){mt55Draw();}\nfunction divide(){mt55PlanSectors();}\n'+s[end:]
 # publication adapt
 old="if(!t.results?.length||!t.results.every(r=>r.competitorName&&Number.isInteger(r.peg)&&r.peg>0))throw Error('Najpierw zapisz komplet stanowisk i nazwisk');"
 assert s.count(old)==1
 s=s.replace(old,"if(t.mt55Entries?.length){if(!t.mt55Entries.every(r=>r.competitorName&&Number.isInteger(r.peg)&&r.peg>0&&r.sector))throw Error('Najpierw przypisz wszystkie stanowiska');}else if(!t.results?.length||!t.results.every(r=>r.competitorName&&Number.isInteger(r.peg)&&r.peg>0))throw Error('Najpierw zapisz komplet stanowisk i nazwisk');",1)
 old='const rows=t.results.slice().sort((a,b)'
 assert s.count(old)==1
 s=s.replace(old,'const rows=(t.mt55Entries?.length?t.mt55Entries:t.results).slice().sort((a,b)',1)
 # admin click action; ensure
 old="'mt52AddReservation','mt52CancelReplace','saveRound'"
 assert s.count(old)==1
 s=s.replace(old,"'mt55ResetDraw','mt52AddReservation','mt52CancelReplace','saveRound'",1)
 old="case 'draw':draw();break;"
 assert s.count(old)==1
 s=s.replace(old,"case 'mt55ResetDraw':mt55ResetDraw();break;"+old,1)
 # attach blur capturing, no other changes to handlers
 marker="document.addEventListener('input',e=>{if(e.target.closest('form#createEvent'))"
 assert s.count(marker)==1
 s=s.replace(marker,"document.addEventListener('focusout',mt55HandleAutoSave);\n"+marker,1)
 # no accidental changed data corpus
 for v in ["<title>MatchThis MT-55</title>","const APP_VERSION='MT-55'",'aria-label="Wersja MT-55">MT-55','data-version="MT-55"']:
  assert v in s,v
 return s

for suf in ['','_SEDZIA','_OGLADACZ']:
 old=(src/f'MatchThis_MT-54{suf}.html').read_text('utf8')
 new=build(old)
 p=src/f'MatchThis_MT-55{suf}.html'
 p.write_text(new,'utf8')
 print(p.name,len(new),len(new)-len(old))