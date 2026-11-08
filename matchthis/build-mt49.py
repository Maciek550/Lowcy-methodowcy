from pathlib import Path
root=Path(__file__).resolve().parent
STYLE=r"""
<style id="mt49-competition-layout">
.mt49-section{margin:0 0 16px;min-width:0}
.mt49-section-head{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:8px}
.mt49-section-head h1,.mt49-section-head h2{margin:0;color:#292b30;line-height:1.2}
.mt49-section-head h1{font-size:21px}.mt49-section-head h2{font-size:18px}
.mt49-two-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;align-items:start}
.mt49-column{border:1px solid #dedfe1;background:#fff;padding:13px;min-width:0;border-radius:3px}
.mt49-column h2{margin:0 0 9px;font-size:17px;color:#2c2e35;line-height:1.25}
.mt49-column .archival{margin:0 0 8px;min-height:60px}
.mt49-column .archival:last-child{margin-bottom:0}
.mt49-card-group{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
.mt49-card-group .archival{margin:0;min-height:66px}
.mt49-column .mt49-cycle{background:#fff8f1;border-left-width:4px}
.mt49-column .mt49-tour{min-height:52px}
.mt49-column .mt49-tour b{font-size:13px}
.mt49-hint{color:#656a74;margin:6px 0;font-size:13px}
.mt49-subhead{font-size:12px;color:#69707a;font-weight:700;margin:10px 0 6px}
.mt49-subhead:first-child{margin-top:0}
.mt49-home-panel{background:#fff;border:1px solid #dedfe1;padding:13px;border-radius:3px}
.mt49-top-actions{display:flex;align-items:center;flex-wrap:wrap;gap:6px}
@media(max-width:750px){
 .mt49-two-columns,.mt49-card-group{grid-template-columns:minmax(0,1fr)}
 .mt49-column,.mt49-home-panel{padding:10px}
 .mt49-section-head h1{font-size:19px}
 .mt49-column h2{font-size:16px}
}
</style>
"""
HELPERS=r"""
// MT-49: local calendar boundaries in Poland. No stored year or 1 January manual edit.
function mt49SiteYear(date=new Date()){
 return Number(new Intl.DateTimeFormat('en-GB',{year:'numeric',timeZone:'Europe/Warsaw'}).format(date));
}
function mt49TodayIso(date=new Date()){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);
 const v={};for(const p of parts)if(p.type==='year'||p.type==='month'||p.type==='day')v[p.type]=p.value;
 return v.year+'-'+v.month+'-'+v.day;
}
function mt49NavLabelsAt(year){return {events:'ZAWODY '+year,archive:'ZAWODY DO '+(year-1)};}
function mt49EntityDates(entity){
 return getRounds(entity).map(t=>verifiedIsoDate(t.date)).filter(Boolean).sort();
}
function mt49StartDate(entity){
 const dates=mt49EntityDates(entity);
 return dates[0]||verifiedIsoDate(entity.date);
}
function mt49EndDate(entity){
 const dates=mt49EntityDates(entity);
 return dates[dates.length-1]||verifiedIsoDate(entity.date);
}
function mt49EventCard(entity,extra=''){
 return '<button class="archival mt49-card" data-open="'+escapeHtml(entity.id)+'" data-type="event"><b>'+safeName(entity.name)+'</b><span class="date">'+safeName(entityDateLabel(entity))+' · '+getRounds(entity).length+' '+(getRounds(entity).length===1?'tura':'tury')+(extra?' · '+safeName(extra):'')+'</span></button>';
}
function mt49CycleCard(entity){
 return '<button class="archival mt49-cycle" data-open="'+escapeHtml(entity.id)+'" data-type="cycle"><b>'+safeName(entity.name)+'</b><span class="date">'+getRounds(entity).length+' tur · klasyfikacja cyklu</span></button>';
}
function mt49TourCard(cycle,tour,index){
 const date=dateForTour(tour,cycle)||'Data niepotwierdzona';
 return '<button class="archival mt49-tour" data-open="'+escapeHtml(cycle.id)+'" data-type="cycle" data-open-round="'+index+'"><b>'+safeName((index+1)+'. tura')+'</b><span class="date">'+safeName(date)+' · '+safeName(tour.name||'Wyniki tury')+'</span></button>';
}
function mt49Upcoming(year=null){
 const today=mt49TodayIso();
 const items=[];
 for(const e of db.events){
  if(year!==null&&Number(e.year)!==year)continue;
  const day=mt49StartDate(e);
  const planned=!e.archived && (!day||day>=today) && !getRounds(e).every(t=>t.status==='FINAL');
  if(planned)items.push({day:day||'9999-12-31',html:mt49EventCard(e,day?'Planowane':'Termin do ustalenia')});
 }
 for(const c of db.cycles){
  if(year!==null&&Number(c.year)!==year)continue;
  getRounds(c).forEach((t,i)=>{
   const day=verifiedIsoDate(t.date);
   if(!c.archived&&day>=today&&t.status!=='FINAL')items.push({day,html:mt49TourCard(c,t,i)});
  });
 }
 return items.sort((a,b)=>a.day.localeCompare(b.day));
}
function mt49Recent(){
 const today=mt49TodayIso();
 return db.events.filter(e=>{
  const day=mt49EndDate(e);
  return day&&day<today&&getRounds(e).some(t=>(t.results||[]).length>0);
 }).sort((a,b)=>mt49EndDate(b).localeCompare(mt49EndDate(a))||String(a.name).localeCompare(String(b.name),'pl')).slice(0,8);
}
function mt49NewestFirst(a,b){return mt49EndDate(b).localeCompare(mt49EndDate(a))||String(a.name).localeCompare(String(b.name),'pl');}
"""
HOME=r"""function renderHome(){
 const planned=mt49Upcoming();
 const recent=mt49Recent();
 const admin=roleMode==='admin';
 return '<section class="mt49-section"><div class="mt49-section-head"><h1>Planowane zawody</h1>'+
 (admin?'<div class="mt49-top-actions"><button class="btn small" data-view="newEvent">+ Nowe zawody</button><button class="btn small secondary" data-view="newCycle">+ Nowy cykl</button></div>':'')+
 '</div><div class="mt49-home-panel">'+
 (planned.length?'<div class="mt49-card-group">'+planned.map(x=>x.html).join('')+'</div>':'<p class="mt49-hint">Brak utworzonych przyszłych zawodów. Po zaplanowaniu pojawią się tutaj automatycznie.</p>')+
 '</div></section>'+
 '<section class="mt49-section"><div class="mt49-section-head"><h2>Ostatnio rozegrane zawody</h2></div><div class="mt49-home-panel">'+
 (recent.length?'<div class="mt49-card-group">'+recent.map(e=>mt49EventCard(e)).join('')+'</div>':'<p class="mt49-hint">Nie ma jeszcze rozegranych zawodów.</p>')+
 '</div></section>';
}
"""
EVENTS=r"""function renderEventsIndex(){
 const year=mt49SiteYear(),planned=mt49Upcoming(year);
 const cycles=db.cycles.filter(c=>Number(c.year)===year).sort(mt49NewestFirst);
 const mega=cycles.find(c=>/MEGA\s*MATCH\s*THIS/i.test(String(c.name||'')))||null;
 const finals=mega?db.events.filter(e=>Number(e.year)===year&&e.cycleId===mega.id).sort(mt49NewestFirst):[];
 const linked=new Set(finals.map(e=>e.id));
 const others=db.events.filter(e=>Number(e.year)===year&&!linked.has(e.id)).sort(mt49NewestFirst);
 const otherCycles=cycles.filter(c=>!mega);
 const tours=mega?getRounds(mega).map((t,i)=>({t,i})).sort((a,b)=>String(b.t.date||'').localeCompare(String(a.t.date||''))||b.i-a.i):[];
 const left=mega?mt49CycleCard(mega)+finals.map(e=>mt49EventCard(e,'Finał cyklu')).join('')+
 (tours.length?'<p class="mt49-subhead">TURY CYKLU — OD NAJNOWSZEJ</p>'+tours.map(x=>mt49TourCard(mega,x.t,x.i)).join(''):''):
 '<p class="mt49-hint">Nie utworzono jeszcze cyklu MEGA MATCH THIS CUP na '+year+' rok.</p>';
 const right=others.map(e=>mt49EventCard(e)).join('')+otherCycles.map(c=>mt49CycleCard(c)).join('')||
 '<p class="mt49-hint">Brak innych zawodów w '+year+' roku.</p>';
 return '<section class="mt49-section"><div class="mt49-section-head"><h1>Zawody '+year+'</h1>'+
 (roleMode==='admin'?'<div class="mt49-top-actions"><button class="btn small" data-view="newEvent">+ Nowe zawody</button><button class="btn small secondary" data-view="newCycle">+ Nowy cykl</button></div>':'')+
 '</div>'+
 (planned.length?'<section class="mt49-section"><h2>Planowane zawody</h2><div class="mt49-card-group">'+planned.map(x=>x.html).join('')+'</div></section>':'')+
 '<div class="mt49-two-columns">'+
 '<section class="mt49-column" aria-label="Cykl MEGA MATCH THIS '+year+'"><h2>MEGA MATCH THIS CUP '+year+'</h2>'+left+'</section>'+
 '<section class="mt49-column" aria-label="Pozostałe zawody '+year+'"><h2>Pozostałe zawody '+year+'</h2>'+right+'</section>'+
 '</div></section>';
}
"""
ARCHIVE=r"""function renderArchive(){
 const lastYear=mt49SiteYear()-1;
 return '<div class="compact-home-heading"><h1>Zawody do '+lastYear+'</h1><p class="sub">Wybierz rok i zawody, aby przeglądać tury, sektory oraz klasyfikacje.</p></div>'+renderYearAccordion(lastYear);
}
"""
for suffix in ('','_OGLADACZ','_SEDZIA'):
 src=root/('MatchThis_MT-48'+suffix+'.html')
 assert src.exists(),('MT48 missing',src)
 old=src.read_text('utf8')
 assert old.count("const APP_VERSION='MT-48'")==1
 assert old.count("<title>MatchThis MT-48</title>")==1
 assert old.count('data-version="MT-48"')==1
 s=old.replace('MT-48','MT-49')
 if suffix!='_OGLADACZ':
  key="const MT47_STORAGE_KEY='matchthis-preview-MT-47';"
  assert s.count(key)==1,(suffix,'old storage key')
  s=s.replace(key,"const MT48_STORAGE_KEY='matchthis-preview-MT-48';\n"+key)
  key="localStorage.getItem(MT47_STORAGE_KEY)||"
  assert s.count(key)==1,(suffix,'migration')
  s=s.replace(key,"localStorage.getItem(MT48_STORAGE_KEY)||"+key)
 assert s.count('</head>')>=1
 s=s.replace('</head>',STYLE+'</head>',1)
 anchor='function renderNav(){'
 assert s.count(anchor)==1
 s=s.replace(anchor,HELPERS+anchor)
 links="[['home','GŁÓWNA'],['cycles','CYKLE'],['events','ZAWODY']"
 assert s.count(links)==1,(suffix,'navbar')
 s=s.replace(links,"[['home','GŁÓWNA'],['events',mt49NavLabelsAt(mt49SiteYear()).events]")
 archiveLink="['archive','ARCHIWUM']"
 assert s.count(archiveLink)==1
 s=s.replace(archiveLink,"['archive',mt49NavLabelsAt(mt49SiteYear()).archive]")
 def change_function(start_tag,next_tag,replacement):
  global s
  assert s.count(start_tag)==1,(suffix,start_tag)
  i=s.index(start_tag);j=s.index(next_tag,i)
  s=s[:i]+replacement+s[j:]
 change_function('function renderHome(){','function renderCyclesIndex(){',HOME)
 change_function('function renderEventsIndex(){','function genuinePhotoSectors(',EVENTS)
 change_function('function renderArchive(){','function render(){',ARCHIVE)
 assert s.count('function renderYearAccordion(){')==1
 s=s.replace('function renderYearAccordion(){  const years=archivedYearEntries();',
             'function renderYearAccordion(maxYear=Infinity){  const years=archivedYearEntries().filter(g=>g.year<=maxYear);')
 assert s.count("year===expandedYear?'open':''")==1
 s=s.replace("year===expandedYear?'open':''","year===(expandedYear<=maxYear?expandedYear:maxYear)?'open':''")
 assert s.count('function render(){if(roleMode')==1
 s=s.replace('function render(){if(roleMode','function render(){if(page===\'cycles\')page=\'events\';if(roleMode')
 start='roundIndex=partialHistoricCycle(current())?firstPopulatedHistoricRound(current()):0;'
 assert s.count(start)==1,(suffix,'data-open handler')
 s=s.replace(start,'roundIndex=b.dataset.openRound!==undefined?Math.max(0,Math.min(getRounds(current()).length-1,Number(b.dataset.openRound)||0)):(partialHistoricCycle(current())?firstPopulatedHistoricRound(current()):0);')
 start='mtNavInit(); render(); </script>'
 assert s.count(start)==1,(suffix,'startup')
 s=s.replace(start,
   "let mt49LastCalendarYear=mt49SiteYear();"
   "setInterval(()=>{const now=mt49SiteYear();if(now!==mt49LastCalendarYear){mt49LastCalendarYear=now;if(['home','events','archive'].includes(page))render();else renderNav();}},60000); "
   +start)
 for check in ['<title>MatchThis MT-49</title>','aria-label="Wersja MT-49">MT-49','data-version="MT-49"', "const APP_VERSION='MT-49'"]:
  assert check in s,(suffix,check)
 assert "['cycles','CYKLE']" not in s
 assert "data-open-round=" in s
 out=root/('MatchThis_MT-49'+suffix+'.html')
 out.write_text(s,'utf8')
 print('MT49_BUILT',out.name,len(s), 'net_change',len(s)-len(old))
print('MT49: UI-only. Previous source data and security logic unchanged.')
