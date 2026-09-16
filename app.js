const CLIENT_VERSION='57';const CLIENT_VERSION_NAME='V57_PLAYER_STICKY_TOP_FIX';try{fetch('/__probe_js_v57',{cache:'no-store'}).catch(()=>{})}catch(_){};console.log('CLIENT_V57_PLAYER_STICKY_TOP_FIX_LOADED');
const STORE={get(k){try{return localStorage.getItem(k)||''}catch(e){return ''}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
let TOKEN = STORE.get('carp_token') || '';
let ME = null;
let CURRENT_DETAIL = null;
let CREATING_COMPETITION = false;
let SAVING_RESULTS = false;
let SAVING_RESULT_ITEM = false;
let LOGIN_IN_PROGRESS = false;
let STRUCTURE_SAVE_TIMER = null;
let STRUCTURE_READY = false;
let SECTOR_MANUAL_DRAFT = undefined;
let ACTIVE_ADMIN_ZONE = 'roster';
let PLAYER_DRAW_ROUND = 1;
let PLAYER_RESULTS_TAB = 't1';
let PLAYER_MOBILE_PANEL = null;
let PLAYER_SECTOR_STATE = {1:null,2:null};
let SHOW_FINAL_CLUB = false;
let PUSH_CONFIG = null;
let PUSH_SUBSCRIBED = false;
let PLAYER_UNREAD_NOTIFICATIONS = 0;
const q = id => document.getElementById(id);
window.addEventListener('error',e=>{console.error('CLIENT_ERR',e.message);try{const m=document.getElementById('msg');if(m)m.innerHTML='<div class=\"card bad danger-line\">Błąd ekranu: '+String(e.message||'nieznany')+'</div>'}catch(_){}});
window.addEventListener('unhandledrejection',e=>{console.error('CLIENT_REJECT',e.reason);});
function esc(s){return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function msg(t,type='ok'){const el=q('msg');if(!el)return;el.innerHTML='<div class="card '+(type==='bad'?'bad danger-line':'ok success-line')+'">'+esc(t)+'</div>';setTimeout(()=>{const x=q('msg');if(x)x.innerHTML=''},3500)}
async function api(path, opts={}){const ctrl=typeof AbortController!=='undefined'?new AbortController():null;const to=ctrl?setTimeout(()=>ctrl.abort(),15000):null;try{const res=await fetch(path,Object.assign({cache:'no-store',signal:ctrl?ctrl.signal:undefined,headers:{'Content-Type':'application/json',...(TOKEN?{Authorization:'Bearer '+TOKEN}:{})}},opts));const data=await res.json().catch(()=>({ok:false,error:'Błąd odpowiedzi'}));if(!res.ok||data.ok===false)throw new Error(data.error||'Błąd');return data}catch(e){if(e&&e.name==='AbortError')throw new Error('Brak odpowiedzi serwera po 15 s');throw e}finally{if(to)clearTimeout(to)}}
function fmtDate(d){if(!d)return '—';const s=String(d);const m=s.match(/^\d{4}-\d{2}-\d{2}/);const dt=new Date(m?(m[0]+'T12:00:00'):s);return isNaN(dt.getTime())?'—':dt.toLocaleDateString('pl-PL')}
function dateInputValue(d){if(!d)return '';const s=String(d);const m=s.match(/^\d{4}-\d{2}-\d{2}/);return m?m[0]:''}
function fmtGram(v){v=Number(v||0);return v?String(v).replace(/\B(?=(\d{3})+(?!\d))/g,' '):'0'}
function statusName(s){return s==='OPEN'?'OPEN':s==='CLOSED'?'CLOSED':esc(s||'')}
function setLoggedOut(showMsg){
  TOKEN=''; ME=null; STORE.del('carp_token');
  const logout=q('logoutBtn'), auth=q('auth'), app=q('app');
  if(logout)logout.classList.add('hidden');
  if(auth)auth.classList.remove('hidden');
  if(app)app.classList.add('hidden');
  const who=q('who'), role=q('role'), notif=q('notifCounter');
  if(who)who.textContent=''; if(role)role.textContent=''; if(notif)notif.textContent='';
  if(showMsg)msg('Sesja wyczyszczona. Zaloguj się ponownie.','ok');
}
async function boot(){
  const logout=q('logoutBtn'), auth=q('auth'), app=q('app');
  if(logout)logout.classList.add('hidden');
  if(auth)auth.classList.remove('hidden');
  if(app)app.classList.add('hidden');
  if(!TOKEN){setLoggedOut(false);return}
  try{const d=await api('/api/me');ME=d.user}catch(e){setLoggedOut(false);return}
  if(auth)auth.classList.add('hidden');
  if(app)app.classList.remove('hidden');
  if(logout)logout.classList.remove('hidden');
  q('who').textContent=ME.first_name+' '+ME.last_name+' — Koło PZW '+(ME.pzw_club||'');q('role').textContent=ME.role==='ADMIN'?'Administrator':'Zawodnik';
  const admin=ME.role==='ADMIN';q('btn-players').classList.toggle('hidden',!admin);q('adminCreate').classList.toggle('hidden',!admin);
  renderPushStatus();
  showTab('competitions');
  await Promise.allSettled([loadCompetitions(),loadNotifications(),admin?loadPlayers():Promise.resolve()]);
  if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js?v=56',{scope:'/'}).then(()=>{if('Notification' in window&&Notification.permission==='granted')ensurePushSubscription(true,false).catch(()=>{})}).catch(()=>{})}
}
async function login(){try{const phone=q('loginPhone')?.value||'';const password=q('loginPassword')?.value||'';if(!phone.trim()||!password)throw new Error('Wpisz telefon i hasło');const d=await api('/api/login',{method:'POST',body:JSON.stringify({phone,password})});TOKEN=d.token;STORE.set('carp_token',TOKEN);msg('Zalogowano');await boot()}catch(e){msg(e.message,'bad')}}
async function registerPlayer(ev){if(ev){ev.preventDefault&&ev.preventDefault();ev.stopPropagation&&ev.stopPropagation()}try{const d=await api('/api/register',{method:'POST',body:JSON.stringify({phone:q('regPhone').value,password:q('regPassword').value,firstName:q('regFirst').value,lastName:q('regLast').value,pzwClub:q('regClub').value})});TOKEN=d.token;STORE.set('carp_token',TOKEN);msg('Konto zawodnika utworzone');await boot()}catch(e){msg(e.message,'bad')}}
async function setupAdmin(ev){if(ev){ev.preventDefault&&ev.preventDefault();ev.stopPropagation&&ev.stopPropagation()}try{const d=await api('/api/setup-admin',{method:'POST',body:JSON.stringify({setupCode:q('setupCode').value,phone:q('setupPhone').value,password:q('setupPassword').value,firstName:q('setupFirst').value,lastName:q('setupLast').value,pzwClub:q('setupClub').value})});TOKEN=d.token;STORE.set('carp_token',TOKEN);msg('Admin utworzony');await boot()}catch(e){msg(e.message,'bad')}}
async function logout(){try{await disablePushSubscription(false)}catch(_){}STORE.del('carp_token');TOKEN='';ME=null;setLoggedOut(true)}
async function clearSession(){try{await disablePushSubscription(true);if('caches'in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k).catch(()=>{})));}}catch(_){}setLoggedOut(true)}
function showTab(n){['competitions','notifications','players'].forEach(x=>{q('tab-'+x).classList.toggle('hidden',x!==n);q('btn-'+x)?.classList.toggle('active',x===n)});if(n==='notifications')loadNotifications();if(n==='players')loadPlayers()}
function competitionActionHtml(c,admin,mine,closed,cardMode=false){
  if(admin)return '<div class="inlineBtns '+(cardMode?'competitionCardActions adminCompetitionCardActions':'')+'"><button type="button" onclick="openCompetition('+c.id+')">Panel</button><button type="button" class="secondary" onclick="openCompetition('+c.id+')">Edytuj</button><button type="button" class="warn" onclick="deleteCompetition('+c.id+')">Usuń</button></div>';
  const leavePending=String(c.my_leave_request_status||'').toUpperCase()==='PENDING';
  const leaveButton=leavePending?'<button type="button" class="secondary leavePendingBtn" disabled>Prośba wysłana</button>':'<button type="button" class="warn" onclick="leaveComp('+c.id+')">Wypisz</button>';
  return '<div class="inlineBtns competitionActions '+(cardMode?'competitionCardActions':'')+'"><button type="button" onclick="openCompetition('+c.id+')">Szczegóły</button>'+(mine?leaveButton:'<button type="button" '+(closed?'disabled':'')+' onclick="joinComp('+c.id+')">Zapisz</button>')+'</div>';
}
function renderCompetitionMobileCard(c,admin){
  const mine=c.my_status==='ACTIVE'||c.my_status==='RESERVE',closed=c.status!=='OPEN'||c.signup_open===false,main=Number(c.active_count||0),reserve=Number(c.reserve_count||0),limit=Number(c.limit_places||0),stat='<b>'+main+'</b>'+(limit?' / '+limit:'')+(reserve?' + rezerwa '+reserve:'');
  return '<article class="competitionMobileCard '+(mine?'mine':'')+'"><div class="competitionMobileTitle"><b>'+esc(c.title)+'</b><span>'+esc(c.fishery||'')+'</span></div><div class="competitionMobileMeta"><div><small>Data</small><strong>'+fmtDate(c.competition_date)+'</strong></div><div><small>Stan zapisów</small><strong>'+stat+'</strong></div><div><small>Status</small><span class="pill">'+statusName(c.status)+'</span></div></div>'+competitionActionHtml(c,admin,mine,closed,true)+'</article>';
}
async function loadCompetitions(){
  const d=await api('/api/competitions'); const arr=d.competitions||[]; const admin=ME&&ME.role==='ADMIN'; let html='';
  if(admin){html+='<div class="small muted" style="margin-bottom:8px">Liczba zawodów w bazie: <b>'+arr.length+'</b></div>'; if(arr.length)html+='<button type="button" class="warn" style="margin-bottom:10px" onclick="clearCompetitions()">Usuń wszystkie zawody testowe</button>'}
  if(!arr.length){q('competitionsList').innerHTML=html+'<p class="muted">Brak zawodów.</p>';return}
  let desktop='<div class="competitionDesktopList tablewrap"><table><thead><tr><th>Zawody</th><th>Data</th><th>Stan zapisów</th><th>Status</th><th>Akcja</th></tr></thead><tbody>';
  desktop+=arr.map(c=>{const mine=c.my_status==='ACTIVE'||c.my_status==='RESERVE';const closed=c.status!=='OPEN'||c.signup_open===false;const main=Number(c.active_count||0), reserve=Number(c.reserve_count||0), limit=Number(c.limit_places||0);const stat='<b>'+main+'</b>'+(limit?' / '+limit:'')+(reserve?' + rezerwa '+reserve:'');return '<tr class="'+(mine?'mine':'')+'"><td><b>'+esc(c.title)+'</b><br><span class="muted small">'+esc(c.fishery||'')+'</span></td><td class="nowrap">'+fmtDate(c.competition_date)+'</td><td class="nowrap">'+stat+'</td><td><span class="pill">'+statusName(c.status)+'</span></td><td>'+competitionActionHtml(c,admin,mine,closed,false)+'</td></tr>'}).join('');
  desktop+='</tbody></table></div>';
  const mobile='<div class="competitionMobileList">'+arr.map(c=>renderCompetitionMobileCard(c,admin)).join('')+'</div>';
  q('competitionsList').innerHTML=html+desktop+mobile;
}
async function createCompetition(ev){if(CREATING_COMPETITION)return;CREATING_COMPETITION=true;const btn=ev?.target;if(btn){btn.disabled=true;btn.textContent='Tworzę...'}try{const limit=q('cLimit').value.trim();if(!limit)throw new Error('Podaj liczbę osób');await api('/api/competitions',{method:'POST',body:JSON.stringify({title:q('cTitle')?.value||'Method Feeder',fishery:q('cFishery').value,competitionDate:q('cDate').value,limitPlaces:limit,notes:q('cNotes').value,status:'OPEN'})});['cFishery','cDate','cLimit','cNotes'].forEach(id=>{const el=q(id);if(el)el.value=''});if(q('cTitle'))q('cTitle').value='Method Feeder';await loadCompetitions();await loadNotifications();msg('Utworzono zawody')}catch(e){msg(e.message,'bad')}finally{CREATING_COMPETITION=false;if(btn){btn.disabled=false;btn.textContent='Utwórz zawody'}}}
async function deleteCompetition(id){try{if(!confirm('Usunąć te zawody?'))return;await api('/api/competitions/'+id,{method:'DELETE'});q('competitionDetail').classList.add('hidden');msg('Usunięto zawody');await loadCompetitions();await loadNotifications()}catch(e){msg(e.message,'bad')}}
async function clearCompetitions(){try{if(!confirm('Usunąć WSZYSTKIE zawody testowe z bazy?'))return;if(!confirm('Na pewno? Operacji nie da się cofnąć.'))return;const d=await api('/api/admin/competitions/clear',{method:'POST',body:JSON.stringify({confirm:'USUN'})});q('competitionDetail').classList.add('hidden');msg('Usunięto zawody: '+d.deleted);await loadCompetitions();await loadNotifications()}catch(e){msg(e.message,'bad')}}
async function joinComp(id){try{await api('/api/competitions/'+id+'/join',{method:'POST',body:'{}'});msg('Zapisano na zawody');await loadCompetitions();if(CURRENT_DETAIL?.competition?.id==id)await refreshCompetitionKeepScroll(id)}catch(e){msg(e.message,'bad')}}
async function leaveComp(id){try{if(!confirm('Wysłać do administratora prośbę o wypisanie z tych zawodów?'))return;await api('/api/competitions/'+id+'/leave',{method:'POST',body:'{}'});msg('Prośba o wypisanie została wysłana do administratora');await loadCompetitions();await loadNotifications();if(CURRENT_DETAIL?.competition?.id==id)await refreshCompetitionKeepScroll(id)}catch(e){msg(e.message,'bad')}}
async function openCompetition(id,preserve=false){try{const d=await api('/api/competitions/'+id);CURRENT_DETAIL=d;if(!preserve&&ME?.role!=='ADMIN')PLAYER_MOBILE_PANEL=null;renderDetail();q('competitionDetail').classList.remove('hidden');if(!preserve)q('competitionDetail').scrollIntoView({behavior:'smooth',block:'start'})}catch(e){msg(e.message,'bad')}}
function myDraw(round){return (CURRENT_DETAIL.draws||[]).find(d=>Number(d.user_id)===Number(ME.id)&&Number(d.round)===round)}
function resMap(round){const m={};(CURRENT_DETAIL.results||[]).forEach(r=>{if(Number(r.round)===round)m[Number(r.user_id)]=r});return m}
function resultItems(round,userId,kind){return (CURRENT_DETAIL.resultItems||[]).filter(x=>Number(x.round)===Number(round)&&Number(x.user_id)===Number(userId)&&(!kind||String(x.kind)===kind))}
function drawMap(round){const m={};(CURRENT_DETAIL.draws||[]).forEach(r=>{if(Number(r.round)===round)m[Number(r.user_id)]=r});return m}
function renderDetail(){
  const d=CURRENT_DETAIL;const c=d.competition;const admin=ME.role==='ADMIN';let html='<div class="card competitionDetailHead '+(admin?'adminDetailHead':'playerDetailHead')+'"><div class="inlineBtns"><button type="button" class="secondary" onclick="q(\'competitionDetail\').classList.add(\'hidden\')">Zamknij panel zawodów</button><button type="button" onclick="openCompetition('+c.id+')">Odśwież</button></div><h2>'+esc(c.title)+'</h2><p class="muted">'+fmtDate(c.competition_date)+' — '+esc(c.fishery||'')+'</p></div>';
  SECTOR_MANUAL_DRAFT=undefined;
  if(admin) html+=renderAdminDetail(d); else html+=renderPlayerDetail(d);
  q('competitionDetail').innerHTML=html;
  syncStickyNavOffset();
  setTimeout(syncFixedAdminNav,0);
  setTimeout(syncPlayerStickyBars,0);
  if(admin&&ACTIVE_ADMIN_ZONE==='draw') setTimeout(()=>setupStructureAuto(c.id),0);
  setTimeout(()=>renderPushStatus(),0);
}
function rosterCounts(d){const c=d.rosterCounts||{};return {main:Number(c.active_count||0),reserve:Number(c.reserve_count||0),cancel:Number(c.cancelled_count||0),limit:Number(d.competition.limit_places||0),draw:Number((d.activeEntries||[]).length),stands:Number(d.competition.bank1_count||0)+Number(d.competition.bank2_count||0)}}
function statusLabel(s){return s==='ACTIVE'?'Lista główna':s==='RESERVE'?'Rezerwa':s==='CANCELLED'?'Wypisany':esc(s||'')}
function renderCountPanelInner(d){const x=rosterCounts(d);const over=x.limit&&x.main>x.limit;const bad=x.stands&&x.stands!==x.draw;return '<h2>Kontrola stanu zawodników</h2><div class="grid4"><div><span class="muted small">Lista główna</span><br><b style="font-size:24px">'+x.main+'</b>'+(x.limit?' / '+x.limit:'')+'</div><div><span class="muted small">Rezerwa</span><br><b style="font-size:24px">'+x.reserve+'</b></div><div><span class="muted small">Do losowania</span><br><b style="font-size:24px">'+x.draw+'</b></div><div><span class="muted small">Stanowiska w strukturze</span><br><b style="font-size:24px">'+x.stands+'</b></div></div>'+(over?'<p class="bad">Lista główna jest powyżej limitu — decyzja admina. Losowanie obejmie wszystkich z listy głównej.</p>':'')+(bad?'<p class="bad">Liczba stanowisk w strukturze nie zgadza się z liczbą zawodników do losowania. Popraw strukturę albo świadomie zostaw nadmiar/rezerwę stanowisk.</p>':'')+'<p class="small muted">Panel losowania używa dokładnie listy głównej. Rezerwa nie trafia do losowania, dopóki admin nie przeniesie zawodnika strzałką na listę główną.</p>'}
function renderCountPanel(d){const x=rosterCounts(d);const over=x.limit&&x.main>x.limit;const bad=x.stands&&x.stands!==x.draw;return '<div id="liveCountPanel" class="card '+(over||bad?'danger-line':'success-line')+'">'+renderCountPanelInner(d)+'</div>'}
function renderCompetitionSettings(d){const c=d.competition;return '<div class="card"><h2>Dane zawodów</h2><div class="grid"><div><label>Nazwa</label><input id="dTitle" value="'+esc(c.title)+'"></div><div><label>Łowisko</label><input id="dFishery" value="'+esc(c.fishery||'')+'"></div><div><label>Data</label><input id="dDate" type="date" value="'+dateInputValue(c.competition_date)+'"></div><div><label>Liczba osób / limit listy głównej</label><input id="dLimit" type="number" value="'+esc(c.limit_places||'')+'"></div><div><label>Status zapisów</label><select id="dStatus"><option value="OPEN" '+(c.status==='OPEN'?'selected':'')+'>OPEN — zapisy otwarte</option><option value="CLOSED" '+(c.status==='CLOSED'?'selected':'')+'>CLOSED — zamknięte</option></select></div></div><label>Opis / notatki</label><textarea id="dNotes">'+esc(c.notes||'')+'</textarea><button type="button" onclick="saveCompetition('+c.id+')">Zapisz dane zawodów</button></div>'}
function adminZoneButton(zone,label){return '<button type="button" id="adminZoneBtn-'+zone+'" class="'+(ACTIVE_ADMIN_ZONE===zone?'active':'')+'" onclick="showAdminZone(\''+zone+'\',event)">'+label+'</button>'}
function renderAdminDetail(d){
  return '<div class="workZoneTabsSlot"><div class="workZoneTabs" role="tablist" aria-label="Strefy obsługi zawodów">'
    +adminZoneButton('roster','1. Lista zawodników')
    +adminZoneButton('draw','2. Losowanie i sektory')
    +adminZoneButton('entry','3. Wpisywanie wyników')
    +adminZoneButton('results','4. Wyniki')
    +adminZoneButton('pdf','5. Generowanie PDF')
    +'</div></div>'
    +'<section id="adminZone-roster" class="adminZone '+(ACTIVE_ADMIN_ZONE==='roster'?'':'hidden')+'">'+renderCountPanel(d)+renderRosterTools(d)+renderEntries(d)+'</section>'
    +'<section id="adminZone-draw" class="adminZone '+(ACTIVE_ADMIN_ZONE==='draw'?'':'hidden')+'">'+renderCompetitionSettings(d)+renderStructurePanel(d)+renderDrawPanel(d)+'</section>'
    +'<section id="adminZone-entry" class="adminZone '+(ACTIVE_ADMIN_ZONE==='entry'?'':'hidden')+'">'+renderResultsEntryPanel(d)+'</section>'
    +'<section id="adminZone-results" class="adminZone '+(ACTIVE_ADMIN_ZONE==='results'?'':'hidden')+'">'+renderResultsSummaryPanel(d)+'</section>'
    +'<section id="adminZone-pdf" class="adminZone '+(ACTIVE_ADMIN_ZONE==='pdf'?'':'hidden')+'">'+renderPdfPanel(d)+'</section>';
}
function showAdminZone(zone,ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  if(!['roster','draw','entry','results','pdf'].includes(zone))zone='roster';
  ACTIVE_ADMIN_ZONE=zone;
  ['roster','draw','entry','results','pdf'].forEach(name=>{q('adminZone-'+name)?.classList.toggle('hidden',name!==zone);q('adminZoneBtn-'+name)?.classList.toggle('active',name===zone)});
  if(zone==='draw'&&CURRENT_DETAIL)setTimeout(()=>setupStructureAuto(CURRENT_DETAIL.competition.id),0);
  const slot=document.querySelector('.workZoneTabsSlot');if(ev&&slot)slot.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(syncFixedAdminNav,0);
}
function renderFinalClubToggle(){return '<label class="checkline finalClubToggle"><input type="checkbox" '+(SHOW_FINAL_CLUB?'checked':'')+' onchange="toggleFinalClub(this)"> Pokaż koło — tylko w klasyfikacji końcowej</label>'}
function toggleFinalClub(el){SHOW_FINAL_CLUB=!!(el&&typeof el==='object'?el.checked:el);document.querySelectorAll('.finalClub').forEach(x=>x.classList.toggle('hidden',!SHOW_FINAL_CLUB));document.querySelectorAll('.finalClubToggle input').forEach(x=>{x.checked=SHOW_FINAL_CLUB})}
function renderStructurePanel(d){const c=d.competition;const x=rosterCounts(d);const manual=Array.isArray(c.sector_layout);return '<div class="card"><h2>Struktura łowiska i sektory</h2><p class="small muted">W trybie „Dwa brzegi wzdłuż brzegów” sektory są układane osobno na każdym brzegu, a nie naprzeciwko siebie. Zakresy sektorów możesz wpisać ręcznie — mapa zmienia się od razu, a przycisk Zastosuj zapisuje układ.</p><div class="grid"><div><label>Tryb mapy</label><select id="dMapMode"><option value="TWO_OPPOSITE" '+(c.map_mode==='TWO_OPPOSITE'?'selected':'')+'>Dwa brzegi naprzeciwko</option><option value="ONE_BANK" '+(c.map_mode==='ONE_BANK'?'selected':'')+'>Jeden brzeg</option><option value="TWO_ALONG" '+(c.map_mode==='TWO_ALONG'?'selected':'')+'>Dwa brzegi — sektory wzdłuż brzegów</option></select></div><div><label>Brzeg dolny / brzeg 1</label><input id="dBank1" type="number" value="'+esc(c.bank1_count||0)+'"></div><div><label>Brzeg górny / brzeg 2</label><input id="dBank2" type="number" value="'+esc(c.bank2_count||0)+'"></div><div><label>Liczba sektorów</label><input id="dSectors" type="number" value="'+esc(c.sectors_count||1)+'" min="1" max="26"></div></div><label class="checkline"><input id="dAutoBanks" type="checkbox" '+(manual?'':'checked')+'> Automatycznie dopasuj brzegi do listy głównej / limitu. Przy nieparzystej liczbie więcej dostaje brzeg dolny.</label><div class="inlineBtns"><button type="button" class="secondary" onclick="autoFillBanksFromRoster(false,event)">Auto dopasuj teraz</button><button type="button" class="secondary" onclick="resetSectorLayout(event)">Przywróć automatyczne sektory</button><button type="button" onclick="saveCompetition('+c.id+',false,event)">Zastosuj / zapisz strukturę</button></div><div class="small muted" id="structureHint">Cel: '+x.draw+' do losowania; limit: '+x.limit+'.</div><h3>Szybki podgląd graficzny podziału na sektory</h3><div class="structurePreviewDesktop" id="structurePreview">'+renderMap(d)+'</div><div class="structurePreviewMobile" id="structurePreviewMobile">'+renderMobileStructureMap(c)+'</div><h3>Zakresy stanowisk dla sektorów</h3><div id="sectorCardsWrap">'+renderSectorCards(c)+'</div><div id="sectorEditStatus" class="small '+(manual?'ok':'muted')+'">'+(manual?'Ręczny układ jest zapisany.':'Obecnie działa podział automatyczny.')+'</div></div>'}
function renderPlayerRoundCompact(rows,round){
  rows=sortRowsBySectorPlace(rows||[]);
  if(!rows.length)return '<p class="muted">Brak wyników T'+round+'.</p>';
  return '<div class="playerNoScroll"><table class="sharpTable playerCompactRoundTable"><thead><tr><th class="pcLp">#</th><th>Zawodnik</th><th class="pcPos">Sek/Stan</th><th class="pcPlace">Msc</th><th class="pcWeight">Waga</th></tr></thead><tbody>'
    +rows.map((r,idx)=>'<tr class="'+placeRowClass(r.points)+' '+(Number(r.user_id)===Number(ME.id)?'mine':'')+'"><td class="center pcLp">'+(idx+1)+'</td><td class="pcName"><b>'+esc(r.name)+'</b></td><td class="center pcPos"><b>'+esc(r.sector||'—')+'</b>/<span>'+(r.stand||'—')+'</span></td><td class="center pcPlace"><b>'+placeText(r.points)+'</b></td><td class="right pcWeight"><b>'+fmtGram(r.weight||0)+'</b>'+(Number(r.big_fish||0)?'<span class="pcBf">BF: '+fmtGram(r.big_fish)+'</span>':'')+'</td></tr>').join('')
    +'</tbody></table></div>';
}
function renderPlayerFinalCompact(rows){
  rows=rows||[];
  if(!rows.length)return '<p class="muted">Brak klasyfikacji końcowej.</p>';
  return '<div class="playerNoScroll"><table class="sharpTable playerCompactFinalTable"><thead><tr><th class="pfRank">MSC</th><th class="pfName">Zawodnik</th><th class="pfRound">T1</th><th class="pfRound">T2</th><th class="pfPoints">Punkty</th><th class="pfWeight">Waga</th></tr></thead><tbody>'
    +rows.map(r=>'<tr class="'+placeRowClass(r.rank)+' '+(Number(r.user_id)===Number(ME.id)?'mine':'')+'"><td class="center pfRank"><b>'+r.rank+'</b></td><td class="pfName"><b>'+esc(r.name)+'</b></td><td class="center pfRound"><b>'+placeText(r.t1_points)+'</b></td><td class="center pfRound"><b>'+placeText(r.t2_points)+'</b></td><td class="center pfPoints"><b>'+placeText(r.sum_points)+'</b></td><td class="right pfWeight"><b>'+fmtGram(r.total_weight||0)+'</b>'+(Number(r.biggest_fish||0)?'<span class="pcBf">BF: '+fmtGram(r.biggest_fish)+'</span>':'')+'</td></tr>').join('')
    +'</tbody></table></div>';
}
function renderPlayerStatsCompact(d){
  const rows=stationStatisticsRows(d);
  const best=[...rows].filter(x=>x.places.length).sort((a,b)=>a.avg-b.avg||b.totalWeight-a.totalWeight||a.stand-b.stand).slice(0,5);
  const worst=[...rows].filter(x=>x.places.length).sort((a,b)=>b.avg-a.avg||a.totalWeight-b.totalWeight||a.stand-b.stand).slice(0,5);
  const table=(arr,kind='')=>{
    if(!arr.length)return '<p class="muted">Brak danych.</p>';
    const cls=kind==='best'?'stationStandBest':kind==='worst'?'stationStandWorst':'';
    return '<div class="playerNoScroll"><table class="sharpTable playerCompactStats"><thead><tr><th>Stan.</th><th>Miejsca</th><th>Śr.</th><th>Waga</th></tr></thead><tbody>'
      +arr.map(r=>'<tr><td class="center '+cls+'"><b>'+r.stand+'</b></td><td class="center">'+r.places.join('/')+'</td><td class="center"><b>'+r.avg.toFixed(2).replace('.',',')+'</b></td><td class="right"><b>'+fmtGram(r.totalWeight)+'</b></td></tr>').join('')
      +'</tbody></table></div>';
  };
  return '<div class="card playerResultCard playerStatsCompact"><h2>Statystyki stanowisk</h2><h3>5 najlepszych</h3>'+table(best,'best')+'<h3>5 najgorszych</h3>'+table(worst,'worst')+'<h3>Wszystkie stanowiska</h3>'+table(rows)+'</div>';
}
function renderPlayerResultsMobile(d){
  const active=PLAYER_RESULTS_TAB||'t1';
  return '<div class="playerResultsMobile">'
    +'<section id="playerResults-t1" class="playerResultsSection '+(active==='t1'?'':'hidden')+'"><div class="card playerResultCard"><h2>Wyniki sektorowe — Tura 1</h2>'+renderSectorResultsColumn(d.classification.round1,'1 tura')+'<h2 class="playerWholeRoundTitle">Cała Tura 1</h2>'+renderPlayerRoundCompact(d.classification.round1,1)+'</div></section>'
    +'<section id="playerResults-t2" class="playerResultsSection '+(active==='t2'?'':'hidden')+'"><div class="card playerResultCard"><h2>Wyniki sektorowe — Tura 2</h2>'+renderSectorResultsColumn(d.classification.round2,'2 tura')+'<h2 class="playerWholeRoundTitle">Cała Tura 2</h2>'+renderPlayerRoundCompact(d.classification.round2,2)+'</div></section>'
    +'<section id="playerResults-general" class="playerResultsSection '+(active==='general'?'':'hidden')+'"><div class="card playerResultCard"><h2>Klasyfikacja końcowa</h2>'+renderPlayerFinalCompact(d.classification.general)+'</div></section>'
    +'<section id="playerResults-stats" class="playerResultsSection '+(active==='stats'?'':'hidden')+'">'+renderPlayerStatsCompact(d)+'</section>'
    +'</div>';
}
function playerNameCompact(name,cramped=false){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return '—';
  const first=parts[0]||'',last=parts[parts.length-1]||'';
  if(cramped || last.length>12)return (first?first.charAt(0)+'.':'')+last;
  return last;
}
function playerInitialSurname(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return '—';
  if(parts.length===1)return parts[0];
  const first=parts[0]||'',last=parts[parts.length-1]||'';
  return (first?first.charAt(0).toUpperCase()+'.':'')+last;
}
function renderPlayerOwnSummary(d){
  const one=(round)=>{const x=(d.draws||[]).find(v=>Number(v.round)===Number(round)&&Number(v.user_id)===Number(ME.id));return '<div class="playerOwnSummaryCard round'+round+'"><div class="playerOwnSummaryTitle">TURA '+round+'</div><div class="playerOwnSummaryMain"><span class="playerOwnSummaryRound">T'+round+'</span><span class="playerOwnSummaryStand">'+(x?esc(x.stand):'—')+'</span><span class="playerOwnSummarySector">Sektor '+(x?esc(x.sector):'—')+'</span></div><div class="playerOwnSummaryLabels"><span>Tura</span><span>Stanowisko</span><span>Sektor</span></div></div>'};
  return '<div class="playerOwnSummaryWrap"><div class="playerOwnSummaryHeading">MOJE STANOWISKA</div><div class="playerOwnSummaryGrid">'+one(1)+one(2)+'</div></div>';
}
function renderPlayerSectorStand(n,c,byStand,cramped){
  const sec=sectorForStandClient(n,c),x=byStand[Number(n)],mine=x&&Number(x.draw.user_id)===Number(ME.id),name=x?x.name.trim():'—';
  return '<div class="playerSectorStand '+sectorColorClass(sec,c)+(mine?' minePlayerSectorStand':'')+'"><b class="playerSectorStandNo">'+n+'</b><span class="playerSectorStandName">'+esc(playerInitialSurname(name))+'</span>'+(mine?'<small class="playerSectorMineBadge">TY</small>':'')+'</div>';
}
function renderPlayerSectorBank(label,arr,c,byStand){
  if(!arr||!arr.length)return '';
  const cramped=arr.length>=4;
  return '<div class="playerSectorBank"><div class="playerSectorBankTitle">≋ '+esc(label)+' <span>('+arr.length+' os.)</span></div><div class="playerSectorStandGrid cols'+Math.min(4,Math.max(1,arr.length))+'">'+arr.map(n=>renderPlayerSectorStand(n,c,byStand,cramped)).join('')+'</div></div>';
}
function renderPlayerSectorAccordion(d,round){
  const c=d.competition,layout=sectorLayoutClient(c),byStand=roundDrawStandMap(d,round),mine=(d.draws||[]).find(v=>Number(v.round)===Number(round)&&Number(v.user_id)===Number(ME.id)),mineSector=mine?String(mine.sector||''):'';
  if(!Object.keys(byStand).length)return '<div class="card"><p class="muted">Brak losowania T'+round+'.</p></div>';
  return '<div class="playerSectorAccordionList">'+layout.map((sec,idx)=>{const letter=String(sec.letter||''),open=(idx===0||letter===mineSector),total=(sec.top||[]).length+(sec.bottom||[]).length;let inner='';if(c.map_mode==='ONE_BANK')inner+=renderPlayerSectorBank('JEDEN BRZEG',sec.bottom,c,byStand);else if(c.map_mode==='TWO_ALONG'){if(sec.top?.length)inner+=renderPlayerSectorBank('BRZEG 2',sec.top,c,byStand);if(sec.bottom?.length)inner+=renderPlayerSectorBank('BRZEG 1',sec.bottom,c,byStand)}else{if(sec.top?.length)inner+=renderPlayerSectorBank('BRZEG GÓRNY',sec.top,c,byStand);if(sec.bottom?.length)inner+=renderPlayerSectorBank('BRZEG DOLNY',sec.bottom,c,byStand)}return '<section class="playerSectorAccordion '+sectorColorClass(letter,c)+' '+(open?'open':'collapsed')+'"><button type="button" class="playerSectorAccordionHead" onclick="togglePlayerSectorAccordion(this,event)"><span class="playerSectorCircle">'+esc(letter)+'</span><b>SEKTOR '+esc(letter)+'</b><span class="playerSectorCount">'+total+' os.</span><span class="playerSectorChevron">⌃</span></button><div class="playerSectorAccordionBody">'+inner+'</div></section>'}).join('')+'</div>';
}
function togglePlayerSectorAccordion(btn,ev){if(ev){ev.preventDefault();ev.stopPropagation()}const box=btn&&btn.closest('.playerSectorAccordion');if(!box)return;box.classList.toggle('collapsed');box.classList.toggle('open');}
function renderPlayerMobilePanelContent(d,panel){
  if(panel==='draw1'||panel==='draw2'){
    const round=panel==='draw2'?2:1;
    return '<div class="playerMobileSelectedPanel playerMobileDrawSelected">'
      +'<div class="playerMobileSectionTitle">ROZMIESZCZENIE W SEKTORACH — TURA '+round+'</div>'
      +renderPlayerSectorAccordion(d,round)
      +'<div class="playerMobileSectorTables">'+renderDrawSectorTables(d,round)+'</div>'
      +'</div>';
  }
  if(panel==='map1'||panel==='map2'){
    const round=panel==='map2'?2:1;
    return '<div class="playerMobileSelectedPanel"><div class="playerMobileFullMapWrap"><div class="playerMobileFullMapTitle">MAPA ŁOWISKA — TURA '+round+'</div><div class="playerMobileFullMapViewport"><div class="playerMobileFullMapCanvas">'+renderRoundDrawMap(d,round)+'</div></div><div class="playerMobileMapHint">Pełna mapa dopasowana do szerokości ekranu.</div></div></div>';
  }
  if(panel==='t1')return '<div class="playerMobileSelectedPanel"><div class="card playerResultCard"><h2>Wyniki sektorowe — Tura 1</h2>'+renderSectorResultsColumn(d.classification.round1,'1 tura')+'<h2 class="playerWholeRoundTitle">Cała Tura 1</h2>'+renderPlayerRoundCompact(d.classification.round1,1)+'</div></div>';
  if(panel==='t2')return '<div class="playerMobileSelectedPanel"><div class="card playerResultCard"><h2>Wyniki sektorowe — Tura 2</h2>'+renderSectorResultsColumn(d.classification.round2,'2 tura')+'<h2 class="playerWholeRoundTitle">Cała Tura 2</h2>'+renderPlayerRoundCompact(d.classification.round2,2)+'</div></div>';
  if(panel==='general')return '<div class="playerMobileSelectedPanel"><div class="card playerResultCard"><h2>Klasyfikacja końcowa</h2>'+renderPlayerFinalCompact(d.classification.general)+'</div></div>';
  if(panel==='stats')return '<div class="playerMobileSelectedPanel">'+renderPlayerStatsCompact(d)+'</div>';
  return '';
}
function renderPlayerMobileDashboard(d){
  const p=PLAYER_MOBILE_PANEL;
  const b=(panel,label,cls='')=>'<button type="button" class="'+cls+' '+(p===panel?'active':'')+'" onclick="showPlayerMobilePanel(\''+panel+'\',event)">'+label+'</button>';
  return '<div class="playerMobileDashboard">'
    +'<div class="playerDrawStickySlot"><div class="card playerDrawHeaderCard playerUnifiedNav">'
    +'<div class="playerDrawTabs">'+b('draw1','Losowanie Tura 1','drawTile')+b('draw2','Losowanie Tura 2','drawTile')+'</div>'
    +'<div class="playerResultsNav playerResultsNavInline">'+b('t1','TURA 1')+b('t2','TURA 2')+b('general','KLASYFIKACJA')+b('stats','STATYSTYKI')+'</div>'
    +'<div class="playerMapNav">'+b('map1','MAPA ŁOWISKA T1','mapTile')+b('map2','MAPA ŁOWISKA T2','mapTile')+'</div>'
    +'<div class="playerNotificationNav"><button type="button" id="playerNotifBtn" onclick="openPlayerNotifications(event)">POWIADOMIENIA'+(PLAYER_UNREAD_NOTIFICATIONS?' ('+PLAYER_UNREAD_NOTIFICATIONS+')':'')+'</button></div>'
    +'</div></div>'
    +renderPlayerOwnSummary(d)
    +'<div id="playerMobilePanelContent">'+renderPlayerMobilePanelContent(d,p)+'</div>'
    +'</div>';
}
function renderPlayerDesktopPanelContent(d,panel){
  if(panel==='draw1'||panel==='draw2'){
    const round=panel==='draw2'?2:1;
    return '<div class="playerDesktopSelectedPanel playerDesktopDrawSelected">'
      +'<div class="playerDesktopSectionTitle">ROZMIESZCZENIE W SEKTORACH — TURA '+round+'</div>'
      +renderPlayerSectorAccordion(d,round)
      +'<div class="playerDesktopSectorTables">'+renderDrawSectorTables(d,round)+'</div>'
      +'</div>';
  }
  if(panel==='map1'||panel==='map2'){
    const round=panel==='map2'?2:1;
    return '<div class="playerDesktopSelectedPanel"><div class="card playerDesktopFullMap"><h2>MAPA ŁOWISKA — TURA '+round+'</h2>'+renderRoundDrawMap(d,round)+'</div></div>';
  }
  if(panel==='t1')return '<div class="playerDesktopSelectedPanel"><div class="card playerResultCard"><h2>Wyniki sektorowe — Tura 1</h2>'+renderSectorResultsColumn(d.classification.round1,'1 tura')+'<h2 class="playerWholeRoundTitle">Cała Tura 1</h2>'+renderClassTable(d.classification.round1)+'</div></div>';
  if(panel==='t2')return '<div class="playerDesktopSelectedPanel"><div class="card playerResultCard"><h2>Wyniki sektorowe — Tura 2</h2>'+renderSectorResultsColumn(d.classification.round2,'2 tura')+'<h2 class="playerWholeRoundTitle">Cała Tura 2</h2>'+renderClassTable(d.classification.round2)+'</div></div>';
  if(panel==='general')return '<div class="playerDesktopSelectedPanel"><div class="card playerResultCard"><h2>Klasyfikacja końcowa</h2>'+renderFinalClubToggle()+renderGeneralTable(d.classification.general)+'</div></div>';
  if(panel==='stats')return '<div class="playerDesktopSelectedPanel">'+renderStationStatistics(d)+'</div>';
  return '';
}
function renderPlayerDesktopDashboard(d){
  const p=PLAYER_MOBILE_PANEL;
  const b=(panel,label,cls='')=>'<button type="button" class="'+cls+' '+(p===panel?'active':'')+'" onclick="showPlayerDesktopPanel(\''+panel+'\',event)">'+label+'</button>';
  return '<div class="playerDesktopDashboardV56 playerDesktopDashboardV55">'
    +'<div class="playerDesktopStickySlot"><div class="card playerDesktopUnifiedNav">'
    +'<div class="playerDesktopMainNav">'+b('draw1','Losowanie Tura 1','drawTile')+b('draw2','Losowanie Tura 2','drawTile')+b('t1','TURA 1','resultTile')+b('t2','TURA 2','resultTile')+b('general','KLASYFIKACJA','resultTile')+b('stats','STATYSTYKI','resultTile')+'</div>'
    +'<div class="playerDesktopSubNav">'+b('map1','MAPA ŁOWISKA T1','mapTile')+b('map2','MAPA ŁOWISKA T2','mapTile')+'<button type="button" class="notificationTile" onclick="openPlayerNotifications(event)">POWIADOMIENIA'+(PLAYER_UNREAD_NOTIFICATIONS?' ('+PLAYER_UNREAD_NOTIFICATIONS+')':'')+'</button></div>'
    +'</div></div>'
    +renderPlayerOwnSummary(d)
    +'<div id="playerDesktopPanelContent">'+renderPlayerDesktopPanelContent(d,p)+'</div>'
    +'</div>';
}
function showPlayerDesktopPanel(panel,ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  const allowed=['draw1','draw2','map1','map2','t1','t2','general','stats'];
  if(!allowed.includes(panel))return;
  PLAYER_MOBILE_PANEL=panel;
  if(panel==='draw1'||panel==='draw2'||panel==='map1'||panel==='map2')PLAYER_DRAW_ROUND=(panel==='draw2'||panel==='map2')?2:1;
  if(['t1','t2','general','stats'].includes(panel))PLAYER_RESULTS_TAB=panel;
  const desktopBox=q('playerDesktopPanelContent');
  if(desktopBox&&CURRENT_DETAIL)desktopBox.innerHTML=renderPlayerDesktopPanelContent(CURRENT_DETAIL,panel);
  const mobileBox=q('playerMobilePanelContent');
  if(mobileBox&&CURRENT_DETAIL)mobileBox.innerHTML=renderPlayerMobilePanelContent(CURRENT_DETAIL,panel);
  document.querySelectorAll('.playerDesktopUnifiedNav button,.playerUnifiedNav button').forEach(btn=>btn.classList.toggle('active',btn.getAttribute('onclick')?.includes("'"+panel+"'")));
  requestAnimationFrame(()=>{syncPlayerStickyBars();fitPlayerMobileFullMaps();const el=q('playerDesktopPanelContent'),nav=document.querySelector('.playerDesktopUnifiedNav');if(el&&nav){const top=window.scrollY+el.getBoundingClientRect().top-nav.getBoundingClientRect().height-getPlayerStickyTop()-6;window.scrollTo({top:Math.max(0,top),behavior:'smooth'})}});
}
function renderPlayerDetail(d){
  let html='<div class="playerView">';
  html+=renderPlayerDesktopDashboard(d);
  html+=renderPlayerMobileDashboard(d);
  html+='</div>';
  return html;
}
function showPlayerMobilePanel(panel,ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  const allowed=['draw1','draw2','map1','map2','t1','t2','general','stats'];
  if(!allowed.includes(panel))return;
  PLAYER_MOBILE_PANEL=panel;
  if(panel==='draw1'||panel==='draw2'||panel==='map1'||panel==='map2')PLAYER_DRAW_ROUND=(panel==='draw2'||panel==='map2')?2:1;
  if(['t1','t2','general','stats'].includes(panel))PLAYER_RESULTS_TAB=panel;
  const box=q('playerMobilePanelContent');
  if(box&&CURRENT_DETAIL)box.innerHTML=renderPlayerMobilePanelContent(CURRENT_DETAIL,panel);
  const desktopBox=q('playerDesktopPanelContent');
  if(desktopBox&&CURRENT_DETAIL)desktopBox.innerHTML=renderPlayerDesktopPanelContent(CURRENT_DETAIL,panel);
  document.querySelectorAll('.playerUnifiedNav button,.playerDesktopUnifiedNav button').forEach(btn=>btn.classList.toggle('active',btn.getAttribute('onclick')?.includes("'"+panel+"'")));
  requestAnimationFrame(()=>{
    syncPlayerStickyBars();
    fitPlayerMobileFullMaps();
    const nav=document.querySelector('.playerUnifiedNav'),content=q('playerMobilePanelContent');
    if(nav&&content){const top=window.scrollY+content.getBoundingClientRect().top-nav.getBoundingClientRect().height-getPlayerStickyTop()-5;window.scrollTo({top:Math.max(0,top),behavior:'smooth'})}
  });
}
function fitPlayerMobileFullMaps(){
  document.querySelectorAll('.playerMobileFullMapViewport').forEach(viewport=>{
    const canvas=viewport.querySelector('.playerMobileFullMapCanvas');
    const map=canvas?.querySelector('.sectorMap');
    if(!canvas||!map)return;
    canvas.style.transform='none';canvas.style.width='auto';canvas.style.height='auto';
    map.style.transform='none';
    const available=Math.max(280,viewport.clientWidth-4);
    const naturalW=Math.max(map.scrollWidth,map.offsetWidth,640);
    const naturalH=Math.max(map.scrollHeight,map.offsetHeight,1);
    const scale=Math.min(1,available/naturalW);
    canvas.style.width=naturalW+'px';
    canvas.style.height=naturalH+'px';
    canvas.style.transformOrigin='top left';
    canvas.style.transform='scale('+scale+')';
    viewport.style.height=Math.ceil(naturalH*scale)+'px';
  });
}
function openPlayerNotifications(ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  showTab('notifications');
  requestAnimationFrame(()=>{const el=q('tab-notifications');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})});
}
function showPlayerResults(tab,ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  if(!['t1','t2','general','stats'].includes(tab))tab='t1';
  PLAYER_RESULTS_TAB=tab;
  document.querySelectorAll('.playerResultsSection').forEach(s=>s.classList.add('hidden'));
  q('playerResults-'+tab)?.classList.remove('hidden');
  document.querySelectorAll('.playerResultsNav button').forEach(b=>b.classList.toggle('active',b.getAttribute('onclick')?.includes("'"+tab+"'")));
  setTimeout(syncPlayerStickyBars,0);
}

function showPlayerDraw(round,ev){if(ev){ev.preventDefault();ev.stopPropagation()}PLAYER_DRAW_ROUND=Number(round)===2?2:1;const box=q('playerDrawView');if(box&&CURRENT_DETAIL)box.innerHTML=renderRoundDrawView(CURRENT_DETAIL,PLAYER_DRAW_ROUND,true);document.querySelectorAll('.playerDrawTabs button').forEach((b,i)=>b.classList.toggle('active',i===PLAYER_DRAW_ROUND-1));setTimeout(syncPlayerStickyBars,0)}
async function saveCompetition(id,quiet=false,ev){const btn=ev?.target;try{if(btn){btn.disabled=true}const sectorLayout=sectorLayoutPayloadForSave();await api('/api/competitions/'+id,{method:'PATCH',body:JSON.stringify({title:q('dTitle')?.value||'',fishery:q('dFishery')?.value||'',competitionDate:q('dDate')?.value||'',limitPlaces:q('dLimit')?.value||'',status:q('dStatus')?.value||'OPEN',mapMode:q('dMapMode')?.value||'TWO_OPPOSITE',bank1Count:q('dBank1')?.value||0,bank2Count:q('dBank2')?.value||0,sectorsCount:q('dSectors')?.value||1,sectorLayout,autoBanks:Boolean(q('dAutoBanks')?.checked),notes:q('dNotes')?.value||''})});if(!quiet)msg('Zapisano strukturę, sektory i zakresy stanowisk');await loadCompetitions();if(!quiet)await refreshCompetitionKeepScroll(id)}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false}}}
function renderRosterTools(d){const c=d.competition;return '<div class="card"><h2>Wgranie listy zawodników</h2><p class="small muted">Import i ręczne dopisanie uzupełniają najpierw listę główną do limitu, a nadmiar idzie na rezerwę. Admin może później przenieść rezerwowego na listę główną nawet powyżej limitu.</p><label>Link zawody.pro</label><input id="zproUrl" placeholder="https://www.zawody.pro/competitions/79/details"><button type="button" class="blue" onclick="importZawodyPro('+c.id+',event)">Importuj listę z zawody.pro</button><hr style="border:0;border-top:1px solid var(--line);margin:14px 0"><h3>Ręcznie dopisz zawodnika</h3><div class="grid"><div><label>Imię i nazwisko</label><input id="manualFullName" placeholder="Jan Kowalski"></div><div><label>Telefon — opcjonalnie</label><input id="manualPhone" placeholder="np. 501222333"></div><div><label>Nr Koła PZW — opcjonalnie</label><input id="manualClub"></div><div><label>Hasło — opcjonalnie, jeśli ma się logować</label><input id="manualPassword" type="password"></div><div><label>Gdzie dopisać</label><select id="manualStatus"><option value="AUTO">Auto: główna do limitu, potem rezerwa</option><option value="ACTIVE">Od razu lista główna</option><option value="RESERVE">Od razu rezerwa</option></select></div></div><button type="button" onclick="addManualPlayer('+c.id+',event)">Dopisz zawodnika</button></div>'}
function importZawodyPro(id,ev){const btn=ev?.target;if(btn){btn.disabled=true;btn.textContent='Importuję...'}try{const url=q('zproUrl').value.trim();api('/api/admin/competitions/'+id+'/import-zawody-pro',{method:'POST',body:JSON.stringify({url})}).then(async d=>{const r=d.result||{};msg('Import: główna '+(r.main||0)+', rezerwa '+(r.reserve||0)+', razem '+(r.imported||0));await refreshCompetitionKeepScroll(id);await loadCompetitions();await loadPlayers();await loadNotifications()}).catch(e=>msg(e.message,'bad')).finally(()=>{if(btn){btn.disabled=false;btn.textContent='Importuj listę z zawody.pro'}})}catch(e){msg(e.message,'bad');if(btn){btn.disabled=false;btn.textContent='Importuj listę z zawody.pro'}}}
async function addManualPlayer(id,ev){const btn=ev?.target;if(btn){btn.disabled=true;btn.textContent='Dopisuję...'}try{const fullName=q('manualFullName').value.trim();if(!fullName)throw new Error('Podaj imię i nazwisko');await api('/api/admin/competitions/'+id+'/players/manual',{method:'POST',body:JSON.stringify({fullName,phone:q('manualPhone').value,pzwClub:q('manualClub').value,password:q('manualPassword').value,entryStatus:q('manualStatus').value})});['manualFullName','manualPhone','manualClub','manualPassword'].forEach(x=>{const el=q(x);if(el)el.value='' });msg('Dopisano zawodnika');await refreshCompetitionKeepScroll(id);await loadCompetitions();await loadPlayers();await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Dopisz zawodnika'}}}
async function setEntryStatus(compId,entryId,action){try{const txt=action==='promote'?'Przenieść na listę główną?':action==='reserve'?'Przenieść na rezerwę?':'Wypisać zawodnika z zawodów?';if(!confirm(txt))return;await api('/api/admin/competitions/'+compId+'/entries/'+entryId+'/'+action,{method:'POST',body:'{}'});msg('Zmieniono status zawodnika');await refreshCompetitionKeepScroll(compId);await loadCompetitions();await loadPlayers();await loadNotifications()}catch(e){msg(e.message,'bad')}}
async function toggleEntryConfirm(compId,entryId,el){try{if(el)el.disabled=true;const d=await api('/api/admin/competitions/'+compId+'/entries/'+entryId+'/confirm',{method:'POST',body:'{}'});msg(d.confirmed?'Potwierdzono zawodnika':'Cofnięto potwierdzenie');await refreshCompetitionKeepScroll(compId)}catch(e){msg(e.message,'bad');if(el)el.disabled=false}}
function rosterTable(title,rows,compId,kind){
  rows=rows||[];
  let html='<h3 class="rosterSectionTitle">'+title+' <span class="pill">'+rows.length+'</span></h3>';
  if(!rows.length)return html+'<p class="muted small">Brak.</p>';
  const makeButtons=e=>{
    if(kind==='ACTIVE')return '<div class="inlineBtns"><button type="button" class="secondary" onclick="setEntryStatus('+compId+','+e.id+',\'reserve\')">↓ Rezerwa</button><button type="button" class="warn" onclick="setEntryStatus('+compId+','+e.id+',\'cancel\')">Wypisz</button></div>';
    if(kind==='RESERVE')return '<div class="inlineBtns"><button type="button" onclick="setEntryStatus('+compId+','+e.id+',\'promote\')">↑ Główna</button><button type="button" class="warn" onclick="setEntryStatus('+compId+','+e.id+',\'cancel\')">Wypisz</button></div>';
    return '<button type="button" class="secondary" onclick="setEntryStatus('+compId+','+e.id+',\'promote\')">Przywróć</button>';
  };
  const confirmBtn=e=>kind==='ACTIVE'
    ?'<button type="button" class="confirmEntryBtn '+(e.confirmed?'confirmed':'')+'" onclick="toggleEntryConfirm('+compId+','+e.id+',this)">'+(e.confirmed?'✓':'Potwierdź')+'</button>'
    :'';
  const editBtn=e=>{const nm=String((e.first_name||'')+' '+(e.last_name||'')).trim(),safe=encodeURIComponent(nm);return '<button type="button" class="secondary rosterEditNameBtn" onclick="editPlayerName('+Number(e.user_id)+',decodeURIComponent(\''+safe+'\'))">Edytuj</button>'};
  const desktop='<div class="tablewrap adminDesktopOnly"><table><thead><tr><th style="width:46px">Lp.</th><th>Zawodnik</th><th>Telefon</th><th>Koło</th><th>Status</th><th>Potw.</th><th>Akcja</th></tr></thead><tbody>'
    +rows.map((e,idx)=>'<tr><td class="center"><b>'+(idx+1)+'</b></td><td><div class="rosterNameEdit"><b>'+esc(e.first_name+' '+e.last_name)+'</b>'+editBtn(e)+'</div></td><td class="nowrap">'+esc(e.phone||'')+'</td><td>'+esc(e.pzw_club||'')+'</td><td>'+statusLabel(e.status)+'</td><td class="center">'+(confirmBtn(e)||'—')+'</td><td>'+makeButtons(e)+'</td></tr>').join('')
    +'</tbody></table></div>';
  const mobile='<div class="adminMobileOnly mobileRosterCompact">'
    +rows.map((e,idx)=>{const club=e.pzw_club?('K'+esc(e.pzw_club)):'';return '<div class="mobileRosterCompactRow">'
        +'<div class="mobileRosterCompactHead"><span class="mobileRosterCompactLp">'+(idx+1)+'</span><b>'+esc(e.first_name+' '+e.last_name)+'</b>'+editBtn(e)+'<span class="mobileRosterCompactStatus">'+statusLabel(e.status)+'</span></div>'
        +'<div class="mobileRosterCompactMeta"><span>'+esc(e.phone||'')+'</span>'+(club?'<span>'+club+'</span>':'')+'</div>'
        +'<div class="mobileRosterCompactActions">'+(confirmBtn(e)||'')+makeButtons(e)+'</div>'
        +'</div>';}).join('')
    +'</div>';
  return html+desktop+mobile;
}
function renderEntries(d){const c=d.competition;return '<div class="card"><h2>Panel zapisów — lista główna i rezerwa</h2>'+rosterTable('Lista główna — bierze udział w losowaniu',d.activeEntries||[],c.id,'ACTIVE')+rosterTable('Lista rezerwowa',d.reserveEntries||[],c.id,'RESERVE')+rosterTable('Wypisani',d.cancelledEntries||[],c.id,'CANCELLED')+'</div>'}
function renderDrawPanel(d){const c=d.competition;const x=rosterCounts(d);const hasDraw=(d.draws||[]).length>0;return '<div class="card"><h2>Losowanie stanowisk</h2><div class="card '+(x.stands===x.draw?'success-line':'danger-line')+'"><b>Do losowania: '+x.draw+' zawodników z listy głównej.</b><br><span class="small muted">Stanowiska w strukturze: '+x.stands+'. Rezerwa nie jest losowana.</span></div><div class="grid3"><button type="button" onclick="drawRound('+c.id+',1,event)">Losuj T1</button><button type="button" class="blue" onclick="drawRound('+c.id+',2,event)">Losuj T2</button><button type="button" class="secondary" onclick="publishDraw('+c.id+',event)">Publikuj losowanie</button></div><button type="button" class="warn" style="margin-top:10px" '+(hasDraw?'':'disabled')+' onclick="resetDraw('+c.id+',event)">Resetuj losowanie T1 i T2</button><p class="small muted">Reset usuwa wyłącznie wylosowane stanowiska obu tur. Lista zawodników, sektory, ustawienia zawodów i wpisane wyniki pozostają bez zmian.</p>'+renderRoundDrawView(d,1,false)+renderRoundDrawView(d,2,false)+'<h3>Tabela zbiorcza losowania</h3>'+renderDrawTable(d,true)+'</div>'}
async function drawRound(id,round,ev){const btn=ev?.target;try{if(!confirm('Wykonać losowanie T'+round+' dla aktualnej listy głównej? Poprzednie T'+round+' zostanie zastąpione. Powiadomienia pójdą dopiero po kliknięciu Publikuj losowanie.'))return;if(btn){btn.disabled=true;btn.textContent='Losuję...'}await api('/api/admin/competitions/'+id+'/draw/'+round,{method:'POST',body:'{}'});msg('Wylosowano T'+round+' — bez publikacji');await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Losuj T'+round}}}
async function publishDraw(id,ev){const btn=ev?.target;try{if(!confirm('Opublikować losowanie i wysłać powiadomienia zawodnikom?'))return;if(btn){btn.disabled=true;btn.textContent='Publikuję...'}const d=await api('/api/admin/competitions/'+id+'/draw/publish',{method:'POST',body:'{}'});msg('Opublikowano losowanie. Powiadomiono: '+d.notified);await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Publikuj losowanie'}}}
async function resetDraw(id,ev){const btn=ev?.target;try{if(!confirm('Zresetować całe losowanie T1 i T2? Znikną wszystkie wylosowane stanowiska obu tur. Lista zawodników, sektory, ustawienia i wyniki pozostaną bez zmian.'))return;if(btn){btn.disabled=true;btn.textContent='Resetuję...'}const d=await api('/api/admin/competitions/'+id+'/draw',{method:'DELETE',body:JSON.stringify({confirm:'RESET_LOSOWANIA'})});msg('Zresetowano losowanie T1 i T2 — usunięto '+d.deleted+' wpisów');await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Resetuj losowanie T1 i T2'}}}
function renderDrawTable(d,admin){const entries=(d.activeEntries||[]);const dm1=drawMap(1),dm2=drawMap(2);if(!entries.length)return '<p class="muted">Brak aktywnych zawodników.</p>';const desktop='<div class="tablewrap adminDesktopOnly"><table><thead><tr><th style="width:46px">Lp.</th><th>Zawodnik</th><th>T1 stan.</th><th>T1 sektor</th><th>T2 stan.</th><th>T2 sektor</th></tr></thead><tbody>'+entries.map((e,idx)=>{const a=dm1[Number(e.user_id)],b=dm2[Number(e.user_id)];const mine=Number(e.user_id)===Number(ME.id);return '<tr class="'+(mine?'mine':'')+'"><td class="center"><b>'+(idx+1)+'</b></td><td><b>'+esc(e.first_name+' '+e.last_name)+'</b></td><td class="nowrap">'+(a?esc(a.stand):'—')+'</td><td>'+(a?esc(a.sector):'—')+'</td><td class="nowrap">'+(b?esc(b.stand):'—')+'</td><td>'+(b?esc(b.sector):'—')+'</td></tr>'}).join('')+'</tbody></table></div>';const mobile='<div class="adminMobileOnly mobileDrawSummary">'+entries.map((e,idx)=>{const a=dm1[Number(e.user_id)],b=dm2[Number(e.user_id)];return '<article class="mobileAdminCard"><div class="mobileAdminCardHead"><span class="mobileLp">'+(idx+1)+'</span><b>'+esc(e.first_name+' '+e.last_name)+'</b></div><div class="mobileDrawPair"><div><small>T1</small><b>'+(a?esc(a.stand):'—')+'</b><span>Sektor '+(a?esc(a.sector):'—')+'</span></div><div><small>T2</small><b>'+(b?esc(b.stand):'—')+'</b><span>Sektor '+(b?esc(b.sector):'—')+'</span></div></div></article>'}).join('')+'</div>';return desktop+mobile}
function sectorSizesClient(total,n,mode){total=Math.max(1,Number(total||1));n=Math.max(1,Math.min(26,Number(n||1),total));const base=Math.floor(total/n),rem=total%n;return Array.from({length:n},(_,i)=>base+(i>=n-rem?1:0))}
function autoBankSplitClient(total,mode){total=Math.max(1,Number(total||1));if(mode==='ONE_BANK')return [total,0];return [Math.ceil(total/2),Math.floor(total/2)]}
function rosterTargetForStructure(){const active=Number(CURRENT_DETAIL?.rosterCounts?.active_count||CURRENT_DETAIL?.activeEntries?.length||0),limit=Number(q('dLimit')?.value||CURRENT_DETAIL?.competition?.limit_places||0);return Math.max(1,active||limit||1)}
function autoBankSplitClient(total,mode){total=Math.max(1,Number(total||1));if(mode==='ONE_BANK')return [total,0];return [Math.ceil(total/2),Math.floor(total/2)]}
function draftCompetition(){const c=Object.assign({},CURRENT_DETAIL.competition);c.map_mode=q('dMapMode')?.value||c.map_mode;c.bank1_count=Number(q('dBank1')?.value||0);c.bank2_count=Number(q('dBank2')?.value||0);c.sectors_count=Number(q('dSectors')?.value||1);c.limit_places=Number(q('dLimit')?.value||c.limit_places||0);if(SECTOR_MANUAL_DRAFT!==undefined)c.sector_layout=SECTOR_MANUAL_DRAFT;return c}
function liveCountUpdate(){const el=q('liveCountPanel');if(!el||!CURRENT_DETAIL)return;const d={competition:draftCompetition(),rosterCounts:CURRENT_DETAIL.rosterCounts,activeEntries:CURRENT_DETAIL.activeEntries};el.innerHTML=renderCountPanelInner(d)}
function scheduleStructureSave(){/* auto-zapis struktury wyłączony: zapis tylko przyciskiem, bez pętli przewijania */}
function autoFillBanksFromRoster(saveNow=false,ev){if(ev){ev.preventDefault&&ev.preventDefault();ev.stopPropagation&&ev.stopPropagation()}SECTOR_MANUAL_DRAFT=null;const c=draftCompetition();const target=rosterTargetForStructure();const sp=autoBankSplitClient(target,c.map_mode);if(q('dBank1'))q('dBank1').value=sp[0];if(q('dBank2'))q('dBank2').value=sp[1];updateStructurePreview(true);if(saveNow===true)scheduleStructureSave();}
function setupStructureAuto(compId){STRUCTURE_READY=false;['dMapMode','dBank1','dBank2','dSectors','dLimit'].forEach(id=>{const el=q(id);if(!el||el.dataset.autoReady)return;el.dataset.autoReady='1';const changed=()=>{SECTOR_MANUAL_DRAFT=null;if((id==='dBank1'||id==='dBank2')&&q('dAutoBanks'))q('dAutoBanks').checked=false;if(q('dAutoBanks')?.checked&&(id==='dMapMode'||id==='dLimit'))autoFillBanksFromRoster(false);else updateStructurePreview(true)};el.addEventListener('input',changed);el.addEventListener('change',changed);});const auto=q('dAutoBanks');if(auto&&!auto.dataset.autoReady){auto.dataset.autoReady='1';auto.addEventListener('change',()=>{if(auto.checked)autoFillBanksFromRoster(false);else updateStructurePreview(false);});}if(q('dAutoBanks')?.checked)autoFillBanksFromRoster(false);else updateStructurePreview(false);setTimeout(()=>{STRUCTURE_READY=true},120);}
function updateStructurePreview(resetCards=false){if(!CURRENT_DETAIL||!q('structurePreview'))return;const d=JSON.parse(JSON.stringify(CURRENT_DETAIL));d.competition=draftCompetition();if(resetCards)d.competition.sector_layout=null;q('structurePreview').innerHTML=renderMap(d);const mobile=q('structurePreviewMobile');if(mobile)mobile.innerHTML=renderMobileStructureMap(d.competition);const cards=q('sectorCardsWrap');if(cards&&resetCards)cards.innerHTML=renderSectorCards(d.competition);liveCountUpdate();const x=rosterCounts({competition:d.competition,rosterCounts:CURRENT_DETAIL.rosterCounts,activeEntries:CURRENT_DETAIL.activeEntries});const hint=q('structureHint');if(hint)hint.innerHTML='Cel: <b>'+x.draw+'</b> do losowania, limit: <b>'+x.limit+'</b>, struktura: <b>'+x.stands+'</b> stanowisk. '+(x.stands===x.draw?'Zgodne.':'Różnica — kliknij Auto dopasuj albo popraw liczbę stanowisk.');const status=q('sectorEditStatus');if(status&&resetCards){status.className='small muted';status.textContent='Podział automatyczny — możesz teraz wpisać własne zakresy.'}}
function visualColumnCountClient(c){const b1=Math.max(0,Number(c.bank1_count||0)),b2=Math.max(0,Number(c.bank2_count||0));return Math.max(1,b1+b2)}
function allocateBottomCountsClient(sizes,b1,b2,mode){b1=Math.max(0,Number(b1||0));b2=Math.max(0,Number(b2||0));const total=Math.max(1,b1+b2);if((mode||'TWO_OPPOSITE')==='ONE_BANK')return sizes.slice();const raw=sizes.map((s,i)=>({i,size:s,val:s*b1/total}));const bottom=raw.map(x=>Math.max(0,Math.min(x.size,Math.floor(x.val))));let diff=b1-bottom.reduce((a,b)=>a+b,0);if(diff>0){const altRank=i=>(i%2===0?Math.floor(i/2):Math.ceil(raw.length/2)+Math.floor(i/2));const order=raw.slice().sort((a,b)=>((b.val-Math.floor(b.val))-(a.val-Math.floor(a.val)))||(((mode||'TWO_OPPOSITE')==='TWO_OPPOSITE')?(altRank(a.i)-altRank(b.i)):(a.i-b.i)));let guard=0;while(diff>0&&guard++<1000){let changed=false;for(const x of order){if(diff<=0)break;if(bottom[x.i]<x.size){bottom[x.i]++;diff--;changed=true}}if(!changed)break}}else if(diff<0){const order=raw.slice().sort((a,b)=>((a.val-Math.floor(a.val))-(b.val-Math.floor(b.val)))||b.i-a.i);let guard=0;while(diff<0&&guard++<1000){let changed=false;for(const x of order){if(diff>=0)break;if(bottom[x.i]>0){bottom[x.i]--;diff++;changed=true}}if(!changed)break}}return bottom}
function parseStandSpecClient(value){const out=[];for(const token of String(value||'').split(/[;,]+/).map(x=>x.trim()).filter(Boolean)){const m=token.match(/^(\d+)\s*[-–—]\s*(\d+)$/);if(m){const a=Number(m[1]),b=Number(m[2]),step=a<=b?1:-1;for(let n=a;;n+=step){out.push(n);if(n===b)break}}else if(/^\d+$/.test(token))out.push(Number(token));else throw new Error('Nieprawidłowy zapis: „'+token+'”')}return out}
function normalizeSectorLayoutClient(raw,c){if(raw===null||raw===undefined||raw==='')return null;if(typeof raw==='string'){try{raw=JSON.parse(raw)}catch(_){throw new Error('Nieprawidłowe dane sektorów')}}const total=Math.max(1,Number(c.bank1_count||0)+Number(c.bank2_count||0)),count=Math.max(1,Number(c.sectors_count||1));if(!Array.isArray(raw)||raw.length!==count)throw new Error('Liczba paneli musi być taka sama jak liczba sektorów');const used=new Map(),names=new Set(),out=[];raw.forEach((item,idx)=>{const name=String(item?.name??item?.letter??'').trim()||String.fromCharCode(65+idx),key=name.toLocaleUpperCase('pl');if(names.has(key))throw new Error('Powtórzona nazwa sektora: '+name);names.add(key);const stands=Array.isArray(item?.stands)?item.stands.map(Number):parseStandSpecClient(item?.range??item?.stands);if(!stands.length)throw new Error('Sektor '+name+' nie ma stanowisk');const own=new Set();for(const stand of stands){if(!Number.isInteger(stand)||stand<1||stand>total)throw new Error('Stanowisko '+stand+' jest poza zakresem 1–'+total);if(own.has(stand))throw new Error('Stanowisko '+stand+' powtarza się w sektorze '+name);if(used.has(stand))throw new Error('Stanowisko '+stand+' jest już w sektorze '+used.get(stand));own.add(stand);used.set(stand,name)}out.push({name,stands:Array.from(own).sort((a,b)=>a-b)})});const missing=[];for(let n=1;n<=total;n++)if(!used.has(n))missing.push(n);if(missing.length)throw new Error('Brakuje stanowisk: '+missing.join(', '));return out}
function customSectorLayoutClient(c){let raw=c.sector_layout;if(SECTOR_MANUAL_DRAFT!==undefined)raw=SECTOR_MANUAL_DRAFT;let normalized;try{normalized=normalizeSectorLayoutClient(raw,c)}catch(_){return null}if(!normalized)return null;const b1=Math.max(0,Number(c.bank1_count||0)),opposite=(c.map_mode||'TWO_OPPOSITE')==='TWO_OPPOSITE';return normalized.map(item=>{const bottom=item.stands.filter(n=>n<=b1).sort((a,b)=>a-b),top=item.stands.filter(n=>n>b1).sort((a,b)=>opposite?b-a:a-b);return {letter:item.name,size:item.stands.length,bottomCount:bottom.length,topCount:top.length,bottom,top}})}
function alongSectorCountsClient(sectors,b1,b2){sectors=Math.max(1,Number(sectors||1));b1=Math.max(0,Number(b1||0));b2=Math.max(0,Number(b2||0));if(!b2)return[sectors,0];if(!b1)return[0,sectors];if(sectors===1)return[1,0];let best=null;for(let first=1;first<sectors;first++){const second=sectors-first;if(first>b1||second>b2)continue;const sizes=sectorSizesClient(b1,first,'ONE_BANK').concat(sectorSizesClient(b2,second,'ONE_BANK')),spread=Math.max(...sizes)-Math.min(...sizes),score=spread*100+Math.abs(first/sectors-b1/(b1+b2));if(!best||score<best.score)best={first,second,score}}if(best)return[best.first,best.second];const first=Math.max(1,Math.min(sectors-1,Math.round(sectors*b1/(b1+b2))));return[first,sectors-first]}
function sectorLayoutClient(c){const custom=customSectorLayoutClient(c);if(custom)return custom;const b1=Math.max(0,Number(c.bank1_count||0)),b2=Math.max(0,Number(c.bank2_count||0)),total=Math.max(1,b1+b2),mode=c.map_mode||'TWO_OPPOSITE',sectorCount=Math.min(Math.max(1,Number(c.sectors_count||1)),total);if(mode==='TWO_ALONG'&&sectorCount>1&&b1>0&&b2>0){const counts=alongSectorCountsClient(sectorCount,b1,b2),bottomSizes=sectorSizesClient(b1,counts[0],'ONE_BANK'),topSizes=sectorSizesClient(b2,counts[1],'ONE_BANK');let bottomCursor=1,topCursor=b1+1,idx=0;const out=[];for(const size of bottomSizes){const bottom=[];for(let i=0;i<size;i++)bottom.push(bottomCursor++);out.push({letter:String.fromCharCode(65+idx++),size,bottomCount:size,topCount:0,bottom,top:[]})}for(const size of topSizes){const top=[];for(let i=0;i<size;i++)top.push(topCursor++);out.push({letter:String.fromCharCode(65+idx++),size,bottomCount:0,topCount:size,bottom:[],top})}return out}const sizes=sectorSizesClient(total,sectorCount,mode),bottomCounts=allocateBottomCountsClient(sizes,b1,b2,mode);let bottomCursor=1,topCursorDesc=b1+b2;return sizes.map((size,idx)=>{const letter=String.fromCharCode(65+idx),bottomCount=mode==='ONE_BANK'?size:Math.max(0,Math.min(size,bottomCounts[idx]||0)),topCount=mode==='ONE_BANK'?0:Math.max(0,size-bottomCount),bottom=[],top=[];for(let i=0;i<bottomCount;i++)if(bottomCursor<=b1)bottom.push(bottomCursor++);for(let i=0;i<topCount;i++)if(topCursorDesc>b1)top.push(topCursorDesc--);return{letter,size,bottomCount,topCount,bottom,top}})}
function balancedColumnSpansClient(cols,sectors){const sizes=sectorSizesClient(cols,sectors,'ONE_BANK');let cursor=1;return sizes.map((w,i)=>{const o={letter:String.fromCharCode(65+i),start:cursor,end:cursor+w-1,width:w};cursor+=w;return o})}
function standColumnClient(stand,c){stand=Number(stand);let cursor=1;for(const sec of sectorLayoutClient(c)){if(sec.bottom.includes(stand)||sec.top.includes(stand))return cursor;cursor+=sec.size}return 1}
function sectorSpansClient(c){return sectorLayoutClient(c).map((s,i)=>({letter:s.letter,start:i+1,end:i+1,width:s.size,size:s.size,bottom:s.bottom,top:s.top}))}
function sectorForColumnClient(col,spans){return spans[Math.max(0,Math.min(spans.length-1,Number(col||1)-1))]?.letter||'A'}
function sectorMapClient(c){const m={};for(const sec of sectorLayoutClient(c)){for(const n of sec.bottom)m[Number(n)]=sec.letter;for(const n of sec.top)m[Number(n)]=sec.letter}return m}
function sectorForStandClient(stand,c){return sectorMapClient(c)[Number(stand)]||'A'}
function sectorRangesData(c){return sectorLayoutClient(c).map(sec=>{const stands=[...sec.bottom,...sec.top].sort((a,b)=>a-b);return {letter:sec.letter,stands,size:stands.length,bottom:sec.bottom,top:sec.top,width:sec.size}})}
function compactRange(arr){const asc=Array.from(new Set((arr||[]).map(Number).filter(Number.isFinite))).sort((a,b)=>a-b);if(!asc.length)return '—';const parts=[];let start=asc[0],prev=asc[0];for(let i=1;i<=asc.length;i++){const n=asc[i];if(n===prev+1){prev=n;continue}parts.push(start===prev?String(start):start+'-'+prev);start=n;prev=n}return parts.join(', ')}
function renderSectorRanges(c){const ranges=sectorRangesData(c);let txt=Array.isArray(c.sector_layout)||Array.isArray(SECTOR_MANUAL_DRAFT)?'Ręczny podział sektorów. ':'Automatyczny podział sektorów. ';if((c.map_mode||'TWO_OPPOSITE')==='ONE_BANK'){txt+=ranges.map(r=>r.letter+' ('+r.size+' os.): '+compactRange(r.bottom)).join(' • ')}else if((c.map_mode||'TWO_OPPOSITE')==='TWO_ALONG'){txt+=ranges.map(r=>r.letter+' ('+r.size+' os.): '+(r.bottom.length?'brzeg 1 '+compactRange(r.bottom):'brzeg 2 '+compactRange(r.top))).join(' • ')}else{txt+=ranges.map(r=>r.letter+' ('+r.size+' os.): dół '+compactRange(r.bottom)+' / góra '+compactRange(r.top)).join(' • ')}return '<div class="sectorSummary">'+esc(txt)+'</div>'}
function sectorColorClass(letter,c){const layout=sectorLayoutClient(c),idx=Math.max(0,layout.findIndex(s=>String(s.letter)===String(letter))),colors=['A','B','C','D','E','F','G','H'];return 'sectorFill-'+colors[idx%colors.length]}
function renderStandCell(n,c,drawStands,own1,own2,empty=false){if(empty)return '<div class="standCell empty"></div>';const sec=sectorForStandClient(n,c);let cls='standCell '+sectorColorClass(sec,c)+' '+(drawStands.has(Number(n))?'occ':'');const t1=own1&&Number(own1.stand)===Number(n),t2=own2&&Number(own2.stand)===Number(n);if(t1&&t2)cls+=' both';else if(t1)cls+=' t1';else if(t2)cls+=' t2';return '<div class="'+cls+'"><b>'+n+'</b></div>'}
function mapMinWidth(c){const total=Math.max(1,Number(c.bank1_count||0)+Number(c.bank2_count||0));return Math.max(640,total*34)}
function renderBankGroupRow(c,which,drawStands,own1,own2){const layout=sectorLayoutClient(c),minw=mapMinWidth(c);let html='<div class="sectorFlexRow standFlex" style="min-width:'+minw+'px">';for(const sec of layout){const arr=which==='top'?sec.top:sec.bottom;const count=Math.max(1,arr.length);html+='<div class="sectorGroup" style="flex:'+sec.size+' 0 0;grid-template-columns:repeat('+count+',minmax(32px,1fr))">';if(arr.length){for(const n of arr)html+=renderStandCell(n,c,drawStands,own1,own2)}else html+=renderStandCell(0,c,drawStands,own1,own2,true);html+='</div>'}return html+'</div>'}
function renderOneBankRow(c,drawStands,own1,own2){const layout=sectorLayoutClient(c),minw=mapMinWidth(c);let html='<div class="sectorFlexRow standFlex" style="min-width:'+minw+'px">';for(const sec of layout){const arr=sec.bottom;html+='<div class="sectorGroup" style="flex:'+sec.size+' 0 0;grid-template-columns:repeat('+Math.max(1,arr.length)+',minmax(32px,1fr))">';for(const n of arr)html+=renderStandCell(n,c,drawStands,own1,own2);html+='</div>'}return html+'</div>'}
function renderSectorBand(c){const layout=sectorLayoutClient(c),minw=mapMinWidth(c);let html='<div class="sectorFlexRow sectorBand clean" style="min-width:'+minw+'px">';for(const sec of layout){html+='<div class="sectorBlock '+sectorColorClass(sec.letter,c)+'" style="flex:'+sec.size+' 0 0"><div class="sectorWord">SEKTOR</div><div class="sectorLetter">'+esc(sec.letter)+'</div><div class="sectorPeople">'+sec.size+' osób</div></div>'}return html+'</div>'}
function renderAlongBankRow(c,which,drawStands,own1,own2){const layout=sectorLayoutClient(c).filter(sec=>(which==='top'?sec.top:sec.bottom).length),bankCount=which==='top'?Number(c.bank2_count||0):Number(c.bank1_count||0),minw=Math.max(640,bankCount*60);let html='<div class="sectorFlexRow standFlex" style="min-width:'+minw+'px">';for(const sec of layout){const arr=which==='top'?sec.top:sec.bottom;html+='<div class="sectorGroup" style="flex:'+arr.length+' 0 0;grid-template-columns:repeat('+arr.length+',minmax(44px,1fr))">';for(const n of arr)html+=renderStandCell(n,c,drawStands,own1,own2);html+='</div>'}return html+'</div>'}
function renderAlongSectorBand(c,which){const layout=sectorLayoutClient(c).filter(sec=>(which==='top'?sec.top:sec.bottom).length),bankCount=which==='top'?Number(c.bank2_count||0):Number(c.bank1_count||0),minw=Math.max(640,bankCount*60);let html='<div class="sectorFlexRow sectorBand clean" style="min-width:'+minw+'px">';for(const sec of layout){const size=(which==='top'?sec.top:sec.bottom).length;html+='<div class="sectorBlock '+sectorColorClass(sec.letter,c)+'" style="flex:'+size+' 0 0"><div class="sectorWord">SEKTOR</div><div class="sectorLetter">'+esc(sec.letter)+'</div><div class="sectorPeople">'+size+' osób</div></div>'}return html+'</div>'}
function renderMap(d){const c=d.competition;const own1=myDraw(1),own2=myDraw(2);const drawStands=new Set((d.draws||[]).map(x=>Number(x.stand)));const commonW=mapMinWidth(c),alongW=Math.max(640,Math.max(Number(c.bank1_count||0),Number(c.bank2_count||0))*60);let html='<div class="sectorMap">';if(c.map_mode==='ONE_BANK'){html+='<div class="mapTitle">SEKTORY NA JEDNYM BRZEGU</div>'+renderOneBankRow(c,drawStands,own1,own2)+renderSectorBand(c)}else if(c.map_mode==='TWO_ALONG'){html+='<div class="mapTitle">SEKTORY WZDŁUŻ DWÓCH BRZEGÓW</div><div class="bankLabel">BRZEG 2</div>'+renderAlongBankRow(c,'top',drawStands,own1,own2)+renderAlongSectorBand(c,'top')+'<div class="water" style="min-width:'+alongW+'px">WODA</div>'+renderAlongSectorBand(c,'bottom')+renderAlongBankRow(c,'bottom',drawStands,own1,own2)+'<div class="bankLabel bankLabelBottom">BRZEG 1</div>'}else{html+='<div class="bankLabel">BRZEG GÓRNY</div>'+renderBankGroupRow(c,'top',drawStands,own1,own2)+renderSectorBand(c)+'<div class="water" style="min-width:'+commonW+'px">'+esc(c.fishery||'Łowisko')+'</div>'+renderSectorBand(c)+renderBankGroupRow(c,'bottom',drawStands,own1,own2)+'<div class="bankLabel bankLabelBottom">BRZEG DOLNY</div>'}html+=renderSectorRanges(c)+'<p class="small muted"><span class="tag t1tag">czerwony = Twoje T1</span> <span class="tag t2tag">niebieski = Twoje T2</span></p></div>';return html}
function renderMobileStructureStand(n,c){const sec=sectorForStandClient(n,c);return '<div class="mobileStructureStand '+sectorColorClass(sec,c)+'"><b>'+n+'</b></div>'}
function renderMobileStructureBank(label,arr,c){if(!arr||!arr.length)return '';return '<div class="mobileStructureBank"><div class="mobileBankName">'+esc(label)+'</div><div class="mobileStructureGrid">'+arr.map(n=>renderMobileStructureStand(n,c)).join('')+'</div></div>'}
function renderMobileStructureMap(c){const layout=sectorLayoutClient(c);let html='<div class="mobileStructureMap"><div class="mobileMapMeta"><b>Podgląd sektorów</b><span>'+esc(c.fishery||'Łowisko')+'</span></div><div class="mobileSectorStack compactAdminSectors">';for(const sec of layout){const total=(sec.top||[]).length+(sec.bottom||[]).length;html+='<section class="mobileSectorCard compactAdminSector '+sectorColorClass(sec.letter,c)+'"><div class="mobileSectorHeader"><span>SEKTOR <b>'+esc(sec.letter)+'</b></span><small>'+total+' '+(total===1?'osoba':total>=2&&total<=4?'osoby':'osób')+'</small></div>';if((c.map_mode||'TWO_OPPOSITE')==='ONE_BANK')html+=renderMobileStructureBank('JEDEN BRZEG',sec.bottom,c);else if((c.map_mode||'TWO_OPPOSITE')==='TWO_ALONG'){if(sec.top?.length)html+=renderMobileStructureBank('BRZEG 2',sec.top,c);if(sec.bottom?.length)html+=renderMobileStructureBank('BRZEG 1',sec.bottom,c)}else{if(sec.top?.length)html+=renderMobileStructureBank('BRZEG GÓRNY',sec.top,c);if(sec.bottom?.length)html+=renderMobileStructureBank('BRZEG DOLNY',sec.bottom,c)}html+='</section>'}html+='</div></div>';return html}
function roundDrawStandMap(d,round){const entryByUser={};for(const e of (d.activeEntries||[]))entryByUser[Number(e.user_id)]=e;const byStand={};for(const dr of (d.draws||[])){if(Number(dr.round)!==Number(round))continue;const e=entryByUser[Number(dr.user_id)];byStand[Number(dr.stand)]={draw:dr,entry:e,name:e?(e.first_name+' '+e.last_name):''}}return byStand}
function renderRoundDrawCell(n,c,byStand,empty=false){if(empty)return '<div class=\"roundDrawCell empty\"></div>';const sec=sectorForStandClient(n,c),x=byStand[Number(n)],mine=x&&Number(x.draw.user_id)===Number(ME.id),label=x?shortPlayerLabel(x.name):'—';return '<div class=\"roundDrawCell '+sectorColorClass(sec,c)+(mine?' ownRoundDraw':'')+'\"><b class=\"roundStandNo\">'+n+'</b><span class=\"roundDrawName\">'+esc(label)+'</span></div>'}
function renderRoundBankGroup(c,which,byStand){const layout=sectorLayoutClient(c),minw=Math.max(680,mapMinWidth(c));let html='<div class="sectorFlexRow roundDrawRow" style="min-width:'+minw+'px">';for(const sec of layout){const arr=which==='top'?sec.top:sec.bottom;const count=Math.max(1,arr.length);html+='<div class="sectorGroup" style="flex:'+sec.size+' 0 0;grid-template-columns:repeat('+count+',minmax(50px,1fr))">';if(arr.length){for(const n of arr)html+=renderRoundDrawCell(n,c,byStand)}else html+=renderRoundDrawCell(0,c,byStand,true);html+='</div>'}return html+'</div>'}
function renderRoundOneBank(c,byStand){const layout=sectorLayoutClient(c),minw=Math.max(680,mapMinWidth(c));let html='<div class="sectorFlexRow roundDrawRow" style="min-width:'+minw+'px">';for(const sec of layout){const arr=sec.bottom;html+='<div class="sectorGroup" style="flex:'+sec.size+' 0 0;grid-template-columns:repeat('+Math.max(1,arr.length)+',minmax(50px,1fr))">';for(const n of arr)html+=renderRoundDrawCell(n,c,byStand);html+='</div>'}return html+'</div>'}
function renderRoundAlongBank(c,which,byStand){const layout=sectorLayoutClient(c).filter(sec=>(which==='top'?sec.top:sec.bottom).length),bankCount=which==='top'?Number(c.bank2_count||0):Number(c.bank1_count||0),minw=Math.max(640,bankCount*60);let html='<div class="sectorFlexRow roundDrawRow" style="min-width:'+minw+'px">';for(const sec of layout){const arr=which==='top'?sec.top:sec.bottom;html+='<div class="sectorGroup" style="flex:'+arr.length+' 0 0;grid-template-columns:repeat('+arr.length+',minmax(50px,1fr))">';for(const n of arr)html+=renderRoundDrawCell(n,c,byStand);html+='</div>'}return html+'</div>'}
function renderRoundDrawMap(d,round){const c=d.competition,byStand=roundDrawStandMap(d,round),has=Object.keys(byStand).length;if(!has)return '<p class="muted">Brak losowania T'+round+'.</p>';const commonW=Math.max(680,mapMinWidth(c)),alongW=Math.max(640,Math.max(Number(c.bank1_count||0),Number(c.bank2_count||0))*60);let html='<div class="sectorMap roundDrawMap"><div class="roundMapHeading">MAPA ŁOWISKA — TURA '+round+'</div>';if(c.map_mode==='ONE_BANK'){html+='<div class="bankLabel">JEDEN BRZEG</div>'+renderRoundOneBank(c,byStand)+renderSectorBand(c)}else if(c.map_mode==='TWO_ALONG'){html+='<div class="bankLabel">BRZEG 2</div>'+renderRoundAlongBank(c,'top',byStand)+renderAlongSectorBand(c,'top')+'<div class="water fisheryWater" style="min-width:'+alongW+'px">'+esc(c.fishery||'Łowisko')+'</div>'+renderAlongSectorBand(c,'bottom')+renderRoundAlongBank(c,'bottom',byStand)+'<div class="bankLabel bankLabelBottom">BRZEG 1</div>'}else{html+='<div class="bankLabel">BRZEG GÓRNY</div>'+renderRoundBankGroup(c,'top',byStand)+renderSectorBand(c)+'<div class="water fisheryWater" style="min-width:'+commonW+'px">'+esc(c.fishery||'Łowisko')+'</div>'+renderSectorBand(c)+renderRoundBankGroup(c,'bottom',byStand)+'<div class="bankLabel bankLabelBottom">BRZEG DOLNY</div>'}html+=renderSectorRanges(c)+'</div>';return html}
function drawRowsBySector(d,round){const entryByUser={};for(const e of (d.activeEntries||[]))entryByUser[Number(e.user_id)]=e;const box={};for(const dr of (d.draws||[])){if(Number(dr.round)!==Number(round))continue;const sec=String(dr.sector||'—'),e=entryByUser[Number(dr.user_id)]||{};(box[sec]=box[sec]||[]).push({user_id:dr.user_id,stand:Number(dr.stand),sector:sec,name:(e.first_name||'')+' '+(e.last_name||''),pzw_club:e.pzw_club||''})}return Object.keys(box).sort((a,b)=>a.localeCompare(b,'pl')).map(sec=>({sector:sec,rows:box[sec].sort((a,b)=>a.stand-b.stand)}))}
function renderDrawSectorTables(d,round){const groups=drawRowsBySector(d,round);if(!groups.length)return '';return '<div class="drawSectorGrid">'+groups.map(g=>'<div class="card drawSectorBox"><h4>Sektor '+esc(g.sector)+'</h4><div class="tablewrap"><table class="sharpTable"><thead><tr><th style="width:42px">Lp.</th><th style="width:54px">Stan.</th><th>Zawodnik</th></tr></thead><tbody>'+g.rows.map((r,i)=>'<tr class="'+(Number(r.user_id)===Number(ME.id)?'mine':'')+'"><td class="center">'+(i+1)+'</td><td class="center"><b>'+r.stand+'</b></td><td><b>'+esc(r.name.trim())+'</b></td></tr>').join('')+'</tbody></table></div></div>').join('')+'</div>'}
function shortPlayerName(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return '—';
  const last=parts[parts.length-1];
  if(last.length<=15)return last;
  return last.slice(0,14)+'…';
}
function shortPlayerLabel(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return '—';
  const last=parts[parts.length-1];
  const first=parts[0]||'';
  return (first?first.charAt(0)+'. ':'')+last;
}
function renderMobileRoundStand(n,c,byStand){
  const sec=sectorForStandClient(n,c),x=byStand[Number(n)],mine=x&&Number(x.draw.user_id)===Number(ME.id),name=x?x.name.trim():'—';
  return '<div class="mobileStandCard '+sectorColorClass(sec,c)+(mine?' ownMobileStand':'')+'"><div class="mobileStandCardInner"><div class="mobileStandNo">'+n+'</div><div class="mobileStandInfo"><b>'+esc(shortPlayerLabel(name))+'</b>'+(mine?'<span class="mobileMineBadge">TWOJE STANOWISKO</span>':'')+'</div></div></div>';
}
function renderMobileBankStands(label,arr,c,byStand){
  if(!arr||!arr.length)return '';
  const cols=arr.length<=2?2:(arr.length<=4?2:3);
  return '<div class="mobileBankBlock"><div class="mobileBankName">'+esc(label)+'</div><div class="mobileStandGrid mobileStandGridReadable" style="grid-template-columns:repeat('+cols+',minmax(0,1fr))">'+arr.map(n=>renderMobileRoundStand(n,c,byStand)).join('')+'</div></div>';
}
function renderMobileRoundDrawMap(d,round){
  const c=d.competition,byStand=roundDrawStandMap(d,round),layout=sectorLayoutClient(c);
  if(!Object.keys(byStand).length)return '<div class="card"><p class="muted">Brak losowania T'+round+'.</p></div>';
  let html='<div class="mobileDrawMap compactPlayerDrawMap"><div class="mobileMapMeta"><b>ZOBRAZOWANIE SEKTORÓW — TURA '+round+'</b><span>'+esc(c.fishery||'Łowisko')+'</span></div><div class="mobileSectorStack">';
  for(const sec of layout){
    const total=(sec.top||[]).length+(sec.bottom||[]).length;
    html+='<section class="mobileSectorCard compactPlayerSector '+sectorColorClass(sec.letter,c)+'"><div class="mobileSectorHeader"><span>Sektor <b>'+esc(sec.letter)+'</b></span><small>'+total+' os.</small></div>';
    if(c.map_mode==='ONE_BANK')html+=renderMobileBankStands('JEDEN BRZEG',sec.bottom,c,byStand);
    else if(c.map_mode==='TWO_ALONG'){
      if(sec.top?.length)html+=renderMobileBankStands('BRZEG 2',sec.top,c,byStand);
      if(sec.bottom?.length)html+=renderMobileBankStands('BRZEG 1',sec.bottom,c,byStand);
    }else{
      if(sec.top?.length)html+=renderMobileBankStands('BRZEG GÓRNY',sec.top,c,byStand);
      if(sec.bottom?.length)html+=renderMobileBankStands('BRZEG DOLNY',sec.bottom,c,byStand);
    }
    html+='</section>';
  }
  return html+'</div></div>';
}
function renderRoundDrawView(d,round,forPlayer){const has=(d.draws||[]).some(x=>Number(x.round)===Number(round));let body='';if(has){if(forPlayer)body='<div class="playerDesktopDraw">'+renderRoundDrawMap(d,round)+renderDrawSectorTables(d,round)+'</div><div class="playerMobileDraw">'+renderMobileRoundDrawMap(d,round)+'</div>';else body='<div class="adminDesktopOnly">'+renderRoundDrawMap(d,round)+renderDrawSectorTables(d,round)+'</div><div class="adminMobileOnly">'+renderMobileRoundDrawMap(d,round)+'</div>'}else body='<p class="muted">Losowanie Tury '+round+' nie zostało jeszcze wykonane.</p>';return '<div class="card roundDrawSection '+(forPlayer?'playerRoundDrawSection':'')+'"><h2>Losowanie Tura '+round+'</h2>'+body+'</div>'}
function sectorCardRangeText(sec,c){if((c.map_mode||'TWO_OPPOSITE')==='ONE_BANK')return compactRange(sec.bottom);return [compactRange(sec.bottom),compactRange(sec.top)].filter(x=>x!=='—').join(', ')}
function renderSectorCards(c){const layout=sectorLayoutClient(c);return '<div class="grid3 sectorCards">'+layout.map((sec,idx)=>'<div class="card"><h3 style="margin-top:0">Sektor '+(idx+1)+'</h3><label>Nazwa sektora</label><input class="sectorNameInput" data-sector="'+idx+'" value="'+esc(sec.letter)+'" oninput="sectorCardsChanged()"><label>Stanowiska przypisane do sektora</label><input class="sectorRangeInput" data-sector="'+idx+'" value="'+esc(sectorCardRangeText(sec,c))+'" oninput="sectorCardsChanged()"><div class="small muted">Możesz wpisać np. 1-4, 17-19. Bez powtórzeń między sektorami.</div></div>').join('')+'</div>'}
function readSectorCards(){const names=Array.from(document.querySelectorAll('#sectorCardsWrap .sectorNameInput')),ranges=Array.from(document.querySelectorAll('#sectorCardsWrap .sectorRangeInput'));return names.map((el,idx)=>({name:el.value.trim()||String.fromCharCode(65+idx),range:ranges[idx]?.value||''}))}
function sectorCardsChanged(){if(!CURRENT_DETAIL)return;SECTOR_MANUAL_DRAFT=readSectorCards();if(q('dAutoBanks'))q('dAutoBanks').checked=false;const c=draftCompetition(),status=q('sectorEditStatus');try{const normalized=normalizeSectorLayoutClient(SECTOR_MANUAL_DRAFT,c);c.sector_layout=normalized;SECTOR_MANUAL_DRAFT=normalized;const d=JSON.parse(JSON.stringify(CURRENT_DETAIL));d.competition=c;q('structurePreview').innerHTML=renderMap(d);const mobile=q('structurePreviewMobile');if(mobile)mobile.innerHTML=renderMobileStructureMap(d.competition);if(status){status.className='small ok';status.textContent='Układ poprawny — kliknij „Zastosuj / zapisz strukturę”.'}}catch(e){if(status){status.className='small bad';status.textContent=e.message}}}
function sectorLayoutPayloadForSave(){if(SECTOR_MANUAL_DRAFT===undefined)return Array.isArray(CURRENT_DETAIL?.competition?.sector_layout)?CURRENT_DETAIL.competition.sector_layout:null;if(SECTOR_MANUAL_DRAFT===null)return null;return normalizeSectorLayoutClient(SECTOR_MANUAL_DRAFT,draftCompetition())}
function resetSectorLayout(ev){if(ev){ev.preventDefault();ev.stopPropagation()}SECTOR_MANUAL_DRAFT=null;updateStructurePreview(true)}

function renderResultsEntryPanel(d){const c=d.competition;return '<div class="card"><h2>Wpisywanie wyników</h2><p class="small muted"><b>Przeliczanie jest automatyczne.</b> Po zapisaniu lub usunięciu każdej wagi klasyfikacje T1, T2 i końcowa są liczone ponownie. Wpisz wagę siatki albo dużej ryby i przejdź do innego pola.</p><div class="grid3"><button type="button" class="secondary" onclick="generateResults('+c.id+',1,event)">Generuj wyniki T1</button><button type="button" class="secondary" onclick="generateResults('+c.id+',2,event)">Generuj wyniki T2</button><button type="button" class="blue" onclick="generateResultsAll('+c.id+',event)">Generuj T1 + T2</button></div><button type="button" class="warn" style="margin-top:10px" onclick="clearResults('+c.id+',event)">Wyczyść wszystkie wyniki T1 i T2</button><div class="resultEntryRounds"><div class="resultRoundPanel"><h3>T1</h3>'+renderResultForm(d,1)+'</div><div class="resultRoundPanel"><h3>T2</h3>'+renderResultForm(d,2)+'</div></div></div>'}
function renderResultsSummaryPanel(d){const c=d.competition;return '<div class="card"><h2>Wyniki i klasyfikacja</h2><div class="grid"><button type="button" class="blue" onclick="notifyResults('+c.id+',1)">Powiadom o wynikach T1</button><button type="button" class="blue" onclick="notifyResults('+c.id+',2)">Powiadom o wynikach T2</button></div>'+renderSectorResultsBoard(d)+'<h3>Klasyfikacja T1</h3>'+renderClassTable(d.classification.round1)+'<h3>Klasyfikacja T2</h3>'+renderClassTable(d.classification.round2)+'<h3>Klasyfikacja końcowa</h3>'+renderFinalClubToggle()+renderGeneralTable(d.classification.general)+renderStationStatistics(d)+'</div>'}
function placeRowClass(rank){const r=Number(rank);return r===1?'place1':r===2?'place2':r===3?'place3':''}
function sortRowsBySectorPlace(rows){return [...(rows||[])].sort((a,b)=>Number(a.points||999)-Number(b.points||999)||Number(b.weight||0)-Number(a.weight||0)||String(a.name||'').localeCompare(String(b.name||''),'pl'))}
function groupRowsBySector(rows){const box={};for(const r of (rows||[])){const sec=String(r.sector||'—').trim()||'—';(box[sec]=box[sec]||[]).push(r)}return Object.keys(box).sort((a,b)=>a.localeCompare(b,'pl')).map(sec=>({sector:sec,rows:sortRowsBySectorPlace(box[sec])}))}
function renderSectorMiniTable(group){return '<div class="card" style="padding:8px;margin:0 0 10px 0"><h4 style="margin:0 0 6px 0;text-align:center">Sektor '+esc(group.sector)+'</h4><div class="tablewrap"><table class="sharpTable"><thead><tr><th class="center" style="width:42px">Msc</th><th class="center" style="width:50px">Stan</th><th>Zawodnik</th><th class="right" style="width:108px">Waga</th></tr></thead><tbody>'+group.rows.map(r=>'<tr class="'+placeRowClass(r.points)+' '+(Number(r.user_id)===Number(ME.id)?'mine':'')+'"><td class="center"><b>'+placeText(r.points)+'</b></td><td class="center nowrap">'+(r.stand||'—')+'</td><td><b>'+esc(r.name)+'</b></td><td class="right nowrap">'+resultCellSummary(r)+'</td></tr>').join('')+'</tbody></table></div></div>'}
function renderSectorResultsColumn(rows,title){const groups=groupRowsBySector(rows);return '<div><h3 style="text-align:center;margin-top:0">'+esc(title)+'</h3>'+(groups.length?groups.map(renderSectorMiniTable).join(''):'<p class="muted">Brak wyników sektorowych.</p>')+'</div>'}
function renderSectorResultsBoard(d){return '<div class="card"><h2>Wyniki sektorowe</h2><div class="twoCols"><div>'+renderSectorResultsColumn(d.classification.round1,'1 tura')+'</div><div>'+renderSectorResultsColumn(d.classification.round2,'2 tura')+'</div></div></div>'}
function stationStatisticsRows(d){const all=[];for(const r of (d.classification?.round1||[]))all.push({round:1,...r});for(const r of (d.classification?.round2||[]))all.push({round:2,...r});const by={};for(const r of all){const stand=Number(r.stand||0);if(!stand)continue;const x=by[stand]||(by[stand]={stand,items:[],totalWeight:0});x.items.push(r);x.totalWeight+=Number(r.weight||0)}return Object.values(by).map(x=>{const places=x.items.map(r=>Number(r.points||0)).filter(Boolean),avg=places.length?places.reduce((a,b)=>a+b,0)/places.length:0;return {...x,occ:x.items.length,places,avg}}).sort((a,b)=>a.stand-b.stand)}
function stationStatsTable(rows,kind=''){if(!rows.length)return '<p class="muted">Brak danych.</p>';const cls=kind==='best'?'stationStandBest':kind==='worst'?'stationStandWorst':'';const desktop='<div class="tablewrap adminDesktopOnly"><table class="sharpTable"><thead><tr><th>Lp.</th><th>Stan.</th><th>Wystąpienia</th><th>Miejsca</th><th>Śr.</th><th>Waga łączna</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr><td class="center">'+(i+1)+'</td><td class="center '+cls+'"><b>'+r.stand+'</b></td><td class="center">'+r.occ+'</td><td class="center">'+r.places.join(' / ')+'</td><td class="center"><b>'+r.avg.toFixed(2).replace('.',',')+'</b></td><td class="right nowrap"><b>'+fmtGram(r.totalWeight)+'g</b></td></tr>').join('')+'</tbody></table></div>';const mobile='<div class="adminMobileOnly mobileStatsList">'+rows.map((r,i)=>'<article class="mobileStatsCard"><b class="mobileStatsStand '+cls+'">Stan. '+r.stand+'</b><div><span><small>Wyst.</small><b>'+r.occ+'</b></span><span><small>Miejsca</small><b>'+r.places.join(' / ')+'</b></span><span><small>Śr.</small><b>'+r.avg.toFixed(2).replace('.',',')+'</b></span><span><small>Waga</small><b>'+fmtGram(r.totalWeight)+'g</b></span></div></article>').join('')+'</div>';return desktop+mobile}
function renderStationStatistics(d){const rows=stationStatisticsRows(d),best=[...rows].filter(x=>x.places.length).sort((a,b)=>a.avg-b.avg||b.totalWeight-a.totalWeight||a.stand-b.stand).slice(0,5),worst=[...rows].filter(x=>x.places.length).sort((a,b)=>b.avg-a.avg||a.totalWeight-b.totalWeight||a.stand-b.stand).slice(0,5),detail=[];for(const r of rows)for(const it of r.items)detail.push({round:it.round,stand:r.stand,sector:it.sector,points:it.points,weight:it.weight,name:it.name});detail.sort((a,b)=>a.round-b.round||a.stand-b.stand);return '<div class="card"><h2>Statystyki stanowisk</h2><h3>Stanowiska po 2 turach</h3>'+stationStatsTable(rows)+'<div class="twoCols"><div><h3>5 najlepszych stanowisk</h3>'+stationStatsTable(best,'best')+'</div><div><h3>5 najgorszych stanowisk</h3>'+stationStatsTable(worst,'worst')+'</div></div><h3>Stanowiska wg tury</h3><div class="tablewrap"><table class="sharpTable"><thead><tr><th>Lp.</th><th>Tura</th><th>Stan.</th><th>Sektor</th><th>Miejsce</th><th>Zawodnik</th><th>Waga</th></tr></thead><tbody>'+detail.map((r,i)=>'<tr class="'+placeRowClass(r.points)+'"><td class="center">'+(i+1)+'</td><td class="center">T'+r.round+'</td><td class="center"><b>'+r.stand+'</b></td><td class="center">'+esc(r.sector||'—')+'</td><td class="center"><b>'+placeText(r.points)+'</b></td><td>'+esc(r.name||'')+'</td><td class="right nowrap">'+fmtGram(r.weight||0)+'g</td></tr>').join('')+'</tbody></table></div></div>'}
function renderWeightItems(round,uid,kind){const arr=resultItems(round,uid,kind);if(!arr.length)return '<div class="small muted">Brak zapisanych wag.</div>';return '<div class="weightItems">'+arr.map(i=>'<span class="weightTag '+(kind==='BF'?'bfTag':'netTag')+'">'+fmtGram(i.weight)+'g <button type="button" title="Usuń" onclick="deleteWeightItem('+i.id+')">×</button></span>').join('')+'</div>'}
function resultCellSummary(r){r=r||{};const bf=Number(r.big_fish||0);return '<b>'+fmtGram(r.weight||0)+'g</b>'+(bf?'<br><span class="bfLine">BF: '+fmtGram(bf)+'g</span>':'')}
function renderResultForm(d,round){const entries=d.activeEntries||[];const dm=drawMap(round);const rm=resMap(round);if(!entries.length)return '<p class="muted">Brak aktywnych zawodników.</p>';let desktop='<div class="tablewrap adminDesktopOnly"><table class="resultInputTable"><thead><tr><th style="width:42px">Lp.</th><th>Zawodnik</th><th>Stan.</th><th>Sektor</th><th>Wagi siatek</th><th>Duże ryby BF</th><th>Suma</th></tr></thead><tbody>';desktop+=entries.map((e,idx)=>{const uid=Number(e.user_id),dr=dm[uid],r=rm[uid]||{};return '<tr><td class="center"><b>'+(idx+1)+'</b></td><td><b>'+esc(e.first_name+' '+e.last_name)+'</b></td><td>'+(dr?esc(dr.stand):'—')+'</td><td>'+(dr?esc(dr.sector):'—')+'</td><td>'+renderWeightItems(round,uid,'NET')+'<input class="weightInput" inputmode="numeric" id="net-'+round+'-'+uid+'" placeholder="nowa waga siatki g" onblur="addWeightItem('+d.competition.id+','+round+','+uid+',\'NET\',this)" onkeydown="weightKey(event)"></td><td>'+renderWeightItems(round,uid,'BF')+'<input class="weightInput" inputmode="numeric" id="bf-'+round+'-'+uid+'" placeholder="nowa duża ryba g" onblur="addWeightItem('+d.competition.id+','+round+','+uid+',\'BF\',this)" onkeydown="weightKey(event)"></td><td class="nowrap">'+resultCellSummary(r)+'</td></tr>'}).join('');desktop+='</tbody></table></div>';const mobile='<div class="adminMobileOnly mobileResultEntryList">'+entries.map((e,idx)=>{const uid=Number(e.user_id),dr=dm[uid],r=rm[uid]||{};return '<article class="mobileAdminCard mobileResultEntryCard"><div class="mobileAdminCardHead"><span class="mobileLp">'+(idx+1)+'</span><b>'+esc(e.first_name+' '+e.last_name)+'</b><strong class="mobileResultSum">'+resultCellSummary(r)+'</strong></div><div class="mobileAdminMeta"><span><small>Stan.</small><b>'+(dr?esc(dr.stand):'—')+'</b></span><span><small>Sektor</small><b>'+(dr?esc(dr.sector):'—')+'</b></span></div><div class="mobileWeightBlock"><label>Wagi siatek</label>'+renderWeightItems(round,uid,'NET')+'<input class="weightInput" inputmode="numeric" id="mnet-'+round+'-'+uid+'" placeholder="Nowa waga siatki (g)" onblur="addWeightItem('+d.competition.id+','+round+','+uid+',\'NET\',this)" onkeydown="weightKey(event)"></div><div class="mobileWeightBlock"><label>Duże ryby BF</label>'+renderWeightItems(round,uid,'BF')+'<input class="weightInput" inputmode="numeric" id="mbf-'+round+'-'+uid+'" placeholder="Nowa duża ryba (g)" onblur="addWeightItem('+d.competition.id+','+round+','+uid+',\'BF\',this)" onkeydown="weightKey(event)"></div></article>'}).join('')+'</div>';return desktop+mobile}
function weightKey(ev){if(ev.key==='Enter'){ev.preventDefault();ev.target.blur();}}
async function refreshCompetitionKeepScroll(compId){try{const d=await api('/api/competitions/'+compId);CURRENT_DETAIL=d;renderDetail();q('competitionDetail').classList.remove('hidden');}catch(e){msg(e.message,'bad')}}
async function addWeightItem(compId,round,userId,kind,el){try{const val=String(el?.value||'').trim();if(!val)return;if(el?.dataset?.saving==='1')return;if(el&&el.dataset)el.dataset.saving='1';const td=el.closest('td');if(td)td.classList.add('flashSave');await api('/api/admin/competitions/'+compId+'/results/'+round+'/items',{method:'POST',body:JSON.stringify({userId,kind,weight:val})});if(el)el.value='';setTimeout(async()=>{try{await refreshCompetitionKeepScroll(compId)}finally{if(el&&el.dataset)el.dataset.saving='0'}},350)}catch(e){if(el&&el.dataset)el.dataset.saving='0';msg(e.message,'bad')}}
async function deleteWeightItem(itemId){try{if(!confirm('Usunąć ten wpis wagi?'))return;const compId=CURRENT_DETAIL.competition.id;await api('/api/admin/results/items/'+itemId,{method:'DELETE'});msg('Usunięto wpis wagi');await refreshCompetitionKeepScroll(compId)}catch(e){msg(e.message,'bad')}}
async function saveResults(id,round,ev){if(SAVING_RESULTS)return;SAVING_RESULTS=true;const btn=ev?.target;if(btn){btn.disabled=true;btn.textContent='Przeliczam...'}try{const results=(CURRENT_DETAIL.activeEntries||[]).map(e=>({userId:e.user_id}));await api('/api/admin/competitions/'+id+'/results/'+round,{method:'POST',body:JSON.stringify({results})});msg('Przeliczono wyniki T'+round);await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{SAVING_RESULTS=false;if(btn){btn.disabled=false;btn.textContent='Przelicz T'+round}}}
async function generateResults(id,round,ev){const btn=ev?.target;try{if(!confirm('Wygenerować testowe wyniki T'+round+'? Obecne wpisy wag tej tury zostaną zastąpione.'))return;if(btn){btn.disabled=true;btn.textContent='Generuję...'}const d=await api('/api/admin/competitions/'+id+'/results/'+round+'/generate',{method:'POST',body:'{}'});msg('Wygenerowano wyniki T'+round+' dla '+d.count+' zawodników');await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Generuj wyniki T'+round}}}
async function generateResultsAll(id,ev){const btn=ev?.target;try{if(!confirm('Wygenerować testowe wyniki T1 i T2? Obecne wpisy wag obu tur zostaną zastąpione.'))return;if(btn){btn.disabled=true;btn.textContent='Generuję...'}const a=await api('/api/admin/competitions/'+id+'/results/1/generate',{method:'POST',body:'{}'});const b=await api('/api/admin/competitions/'+id+'/results/2/generate',{method:'POST',body:'{}'});msg('Wygenerowano T1 i T2: '+a.count+' / '+b.count+' zawodników');await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Generuj T1 + T2'}}}
async function clearResults(id,ev){const btn=ev?.target;try{if(!confirm('Wyczyścić WSZYSTKIE wpisane wyniki T1 i T2 dla tych zawodów? Losowanie i lista zawodników pozostaną bez zmian.'))return;if(btn){btn.disabled=true;btn.textContent='Czyszczę...'}await api('/api/admin/competitions/'+id+'/results',{method:'DELETE',body:JSON.stringify({confirm:'WYCZYSC_WYNIKI'})});msg('Wyczyszczono wszystkie wyniki T1 i T2');await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Wyczyść wszystkie wyniki T1 i T2'}}}
async function notifyResults(id,round){try{if(!confirm('Wysłać zawodnikom powiadomienie o wynikach T'+round+'?'))return;const d=await api('/api/admin/competitions/'+id+'/results/'+round+'/notify',{method:'POST',body:'{}'});msg('Powiadomiono zawodników: '+d.notified);await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}}
function renderClassTable(rows){rows=sortRowsBySectorPlace(rows||[]);if(!rows.length)return '<p class="muted">Brak wyników.</p>';const desktop='<div class="tablewrap adminDesktopOnly"><table class="sharpTable roundClassTable"><thead><tr><th style="width:42px">Lp.</th><th>Zawodnik</th><th>Stan.</th><th>Sektor</th><th>Miejsce</th><th>Waga</th></tr></thead><tbody>'+rows.map((r,idx)=>'<tr class="'+placeRowClass(r.points)+' '+(Number(r.user_id)===Number(ME.id)?'mine':'')+'"><td class="center">'+(idx+1)+'</td><td><b>'+esc(r.name)+'</b></td><td class="nowrap">'+(r.stand||'—')+'</td><td>'+esc(r.sector||'—')+'</td><td><b>'+esc(r.points||'—')+'</b></td><td class="nowrap">'+resultCellSummary(r)+'</td></tr>').join('')+'</tbody></table></div>';const mobile='<div class="adminMobileOnly mobileClassList">'+rows.map((r,idx)=>'<article class="mobileAdminCard '+placeRowClass(r.points)+'"><div class="mobileAdminCardHead"><span class="mobileLp">'+(idx+1)+'</span><b>'+esc(r.name)+'</b><strong class="mobilePlace">Msc '+placeText(r.points)+'</strong></div><div class="mobileAdminMeta"><span><small>Stan.</small><b>'+(r.stand||'—')+'</b></span><span><small>Sektor</small><b>'+esc(r.sector||'—')+'</b></span></div><div class="mobileResultFooter"><span>Waga</span><b>'+resultCellSummary(r)+'</b></div></article>').join('')+'</div>';return desktop+mobile}
function placeText(v){return (v===0||v)?esc(v):'—'}
function renderGeneralTable(rows){rows=rows||[];if(!rows.length)return '<p class="muted">Brak klasyfikacji końcowej.</p>';const desktop='<div class="tablewrap finalWrap adminDesktopOnly"><table class="generalTable sharpTable"><thead><tr><th class="colRank center">MSC</th><th class="colName">Zawodnik</th><th class="colRound center">T1</th><th class="colRound center">T2</th><th class="colSum center">Suma miejsc</th><th class="colWeight right">Waga</th></tr></thead><tbody>'+rows.map(r=>{const club=String(r.pzw_club||'').trim();return '<tr class="'+placeRowClass(r.rank)+' '+(Number(r.user_id)===Number(ME.id)?'mine':'')+'"><td class="colRank center"><b>'+r.rank+'</b></td><td class="colName nameCell"><b>'+esc(r.name)+'</b>'+(club?'<span class="finalClub small muted '+(SHOW_FINAL_CLUB?'':'hidden')+'"> • '+esc(club)+'</span>':'')+'</td><td class="colRound center scoreCell"><b>'+placeText(r.t1_points)+'</b></td><td class="colRound center scoreCell"><b>'+placeText(r.t2_points)+'</b></td><td class="colSum center sumCell"><b>'+placeText(r.sum_points)+'</b></td><td class="colWeight right weightCell"><b>'+fmtGram(r.total_weight)+'g</b>'+(Number(r.biggest_fish||0)?'<br><span class="bfLine">BF: '+fmtGram(r.biggest_fish)+'g</span>':'')+'</td></tr>'}).join('')+'</tbody></table></div>';const mobile='<div class="adminMobileOnly mobileGeneralList">'+rows.map(r=>{const club=String(r.pzw_club||'').trim();return '<article class="mobileAdminCard '+placeRowClass(r.rank)+'"><div class="mobileAdminCardHead"><strong class="mobileRank">'+r.rank+'</strong><b>'+esc(r.name)+'</b>'+(club?'<span class="finalClub small muted '+(SHOW_FINAL_CLUB?'':'hidden')+'"> • '+esc(club)+'</span>':'')+'</div><div class="mobileScoreGrid"><span><small>T1</small><b>'+placeText(r.t1_points)+'</b></span><span><small>T2</small><b>'+placeText(r.t2_points)+'</b></span><span><small>Suma</small><b>'+placeText(r.sum_points)+'</b></span><span><small>Waga</small><b>'+fmtGram(r.total_weight)+'g</b>'+(Number(r.biggest_fish||0)?'<em>BF '+fmtGram(r.biggest_fish)+'g</em>':'')+'</span></div></article>'}).join('')+'</div>';return desktop+mobile}
function renderPdfPanel(d){const c=d.competition;return '<div class="card"><h2>Generowanie plików PDF</h2><p class="small muted">Każdy PDF ma wspólny nagłówek: nazwa zawodów, data, łowisko i opis zawartości.</p><h3>Losowanie</h3><div class="grid3"><button type="button" onclick="generateDrawPdf(1)">PDF Losowanie T1</button><button type="button" onclick="generateDrawPdf(2)">PDF Losowanie T2</button><button type="button" class="secondary" onclick="generateDrawPdf(0)">PDF Losowanie T1 + T2</button></div><h3>Wyniki</h3>'+renderFinalClubToggle()+'<div class="grid3"><button type="button" onclick="generateResultsPdfV33(1)">PDF Wyniki T1</button><button type="button" onclick="generateResultsPdfV33(2)">PDF Wyniki T2</button><button type="button" class="secondary" onclick="generateResultsPdfV33(0)">PDF Klasyfikacja końcowa + statystyki</button></div><h3>Lista startowa</h3><button type="button" class="blue" onclick="generateStartListPdf()">PDF Tabela startowa zawodników — 1 strona</button><p class="small muted">Tabela startowa: Lp., Zawodnik, Potwierdzenie ✓, Wpisowe, Koszyk +, Uwagi. Układ automatycznie wykorzystuje całą stronę.</p></div>'}
function pdfAsciiBytes(x){return new TextEncoder().encode(x)}
function pdfConcatBytes(chunks){let n=chunks.reduce((a,b)=>a+b.length,0),out=new Uint8Array(n),o=0;for(const c of chunks){out.set(c,o);o+=c.length}return out}
function pdfDataUrlBytes(url){const b64=url.split(',')[1],bin=atob(b64),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
function buildSimplePdf(jpegs,widths,heights){const chunks=[],offsets=[0];let length=0;const push=b=>{chunks.push(b);length+=b.length},pushS=x=>push(pdfAsciiBytes(x));pushS('%PDF-1.4\n%1234\n');const objCount=2+jpegs.length*3;function os(n){offsets[n]=length;pushS(n+' 0 obj\n')}function oe(){pushS('endobj\n')}os(1);pushS('<< /Type /Catalog /Pages 2 0 R >>\n');oe();os(2);pushS('<< /Type /Pages /Kids ['+jpegs.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] /Count '+jpegs.length+' >>\n');oe();jpegs.forEach((jpg,i)=>{const page=3+i*3,img=4+i*3,content=5+i*3;os(page);pushS('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im'+(i+1)+' '+img+' 0 R >> >> /Contents '+content+' 0 R >>\n');oe();os(img);pushS('<< /Type /XObject /Subtype /Image /Width '+widths[i]+' /Height '+heights[i]+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpg.length+' >>\nstream\n');push(jpg);pushS('\nendstream\n');oe();const stream='q\n595.28 0 0 841.89 0 0 cm\n/Im'+(i+1)+' Do\nQ\n';os(content);pushS('<< /Length '+pdfAsciiBytes(stream).length+' >>\nstream\n'+stream+'endstream\n');oe()});const xref=length;pushS('xref\n0 '+(objCount+1)+'\n0000000000 65535 f \n');for(let i=1;i<=objCount;i++)pushS(String(offsets[i]).padStart(10,'0')+' 00000 n \n');pushS('trailer\n<< /Size '+(objCount+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');return pdfConcatBytes(chunks)}
function pdfCanvas(scale=1.5){const logicalW=1240,logicalH=1754,c=document.createElement('canvas');c.width=Math.round(logicalW*scale);c.height=Math.round(logicalH*scale);const ctx=c.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='#fff';ctx.fillRect(0,0,logicalW,logicalH);ctx.textBaseline='top';ctx.imageSmoothingEnabled=true;return{canvas:c,ctx,logicalW,logicalH,scale}}
function wrapPdfText(ctx,text,maxW){const lines=[];for(const para of String(text??'').split(/\n/)){const words=para.split(/\s+/).filter(Boolean);let line='';if(!words.length){lines.push('');continue}for(const w of words){const t=line?line+' '+w:w;if(ctx.measureText(t).width<=maxW||!line)line=t;else{lines.push(line);line=w}}if(line)lines.push(line)}return lines.length?lines:['']}
function drawPdfHeaderV33(ctx,context){const c=CURRENT_DETAIL.competition;ctx.fillStyle='#123d2e';ctx.fillRect(0,0,1240,168);ctx.fillStyle='#fff';ctx.font='800 38px Arial';const titleLines=wrapPdfText(ctx,String(c.title||'Zawody'),900).slice(0,2);titleLines.forEach((line,i)=>ctx.fillText(line,44,24+i*40));ctx.font='700 19px Arial';ctx.fillText('Data: '+fmtDate(c.competition_date),44,106);ctx.fillText('Łowisko: '+String(c.fishery||'—'),312,106);ctx.font='800 27px Arial';ctx.fillText(String(context||''),44,136);return 188}
function pdfPlaceThemeV33(rank){const r=Number(rank);if(r===1)return{row:'#fdeaea',cell:'#c62828',text:'#ffffff'};if(r===2)return{row:'#e8edf7',cell:'#173b70',text:'#ffffff'};if(r===3)return{row:'#e8f4eb',cell:'#2e7d32',text:'#ffffff'};return null}
function drawPdfTablePage(context,headers,rows,widths,startIndex=0,rowRanks=null,scale=1.8){const o=pdfCanvas(scale),ctx=o.ctx;let y=drawPdfHeaderV33(ctx,context),x0=Math.round((1240-widths.reduce((a,b)=>a+b,0))/2),total=widths.reduce((a,b)=>a+b,0),headH=44,bottomLimit=1704;ctx.lineWidth=1;ctx.font='800 14px Arial';ctx.fillStyle='#e5efe8';ctx.fillRect(x0,y,total,headH);ctx.strokeStyle='#8ea99a';let x=x0;headers.forEach((h,i)=>{ctx.strokeRect(x,y,widths[i],headH);ctx.fillStyle='#173d2e';ctx.fillText(String(h),x+7,y+13);x+=widths[i]});y+=headH;const rowCount=Math.max(1,rows.length||1),rowH=Math.max(35,Math.min(54,Math.floor((bottomLimit-y)/rowCount))),bodyFont=Math.max(12,Math.min(16,Math.floor(rowH*0.34))),lineH=Math.max(14,bodyFont+3),maxLines=rowH>=48?2:1;for(let r=0;r<rows.length;r++){const theme=rowRanks?pdfPlaceThemeV33(rowRanks[r]):null;x=x0;for(let i=0;i<headers.length;i++){ctx.fillStyle=theme?(i===0?theme.cell:theme.row):'#fff';ctx.fillRect(x,y,widths[i],rowH);ctx.strokeStyle='#b8c8bd';ctx.strokeRect(x,y,widths[i],rowH);ctx.fillStyle=theme&&i===0?theme.text:'#17251d';ctx.font=(i===0||i===1?'800 ':'600 ')+bodyFont+'px Arial';const lines=wrapPdfText(ctx,String(rows[r][i]??''),widths[i]-14).slice(0,maxLines);const blockH=lines.length*lineH,startY=y+Math.max(5,(rowH-blockH)/2);lines.forEach((line,j)=>ctx.fillText(line,x+7,startY+j*lineH));x+=widths[i]}y+=rowH;if(y+rowH>bottomLimit)break}return o.canvas}
function makePdfTablePages(context,headers,rows,widths,rowRanks=null){const per=rows.length&&rows.length<=30?rows.length:30,pages=[];for(let i=0;i<rows.length||i===0;i+=per){const slice=rows.slice(i,i+per),ranks=rowRanks?rowRanks.slice(i,i+per):null;pages.push(drawPdfTablePage(context+(rows.length>per?' — str. '+(Math.floor(i/per)+1):''),headers,slice,widths,i,ranks,1.8))}return pages}
function downloadPdfPages(canvases,filename){const jpgs=canvases.map(c=>pdfDataUrlBytes(c.toDataURL('image/jpeg',0.995))),bytes=buildSimplePdf(jpgs,canvases.map(c=>c.width),canvases.map(c=>c.height)),blob=new Blob([bytes],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2200)}
function pdfSafeName(s){return String(s||'zawody').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'_')}
function drawMapPdfPage(round){const o=pdfCanvas(2),ctx=o.ctx,d=CURRENT_DETAIL,c=d.competition,by=roundDrawStandMap(d,round),layout=sectorLayoutClient(c),palette=['#d8f1dd','#dbe8fb','#ffe7bd','#f6d9e3','#eadffb','#dff4f4'];let y=drawPdfHeaderV33(ctx,'LOSOWANIE — TURA '+round);const x0=40,innerW=1160,b1=Number(c.bank1_count||0),b2=Number(c.bank2_count||0),bottom=Array.from({length:b1},(_,i)=>i+1),top=Array.from({length:b2},(_,i)=>b1+b2-i),maxCount=Math.max(1,bottom.length,top.length),tileW=Math.max(34,Math.min(76,Math.floor(innerW/maxCount))),cellH=136,bandH=70,waterH=56;function sectorColor(letter){const idx=Math.max(0,layout.findIndex(s=>String(s.letter||'')===String(letter||'')));return palette[idx%palette.length]}function displayName(full){const parts=String(full||'').trim().split(/\s+/).filter(Boolean);if(!parts.length)return '—';const last=parts[parts.length-1];if(last.length<=14)return last;return last.slice(0,13)+'…'}function rowStart(arr){return x0+Math.round((innerW-arr.length*tileW)/2)}function segments(arr){const out=[];let cur=null,start=0;arr.forEach((n,i)=>{const sec=sectorForStandClient(n,c);if(cur===null){cur=sec;start=i}else if(sec!==cur){out.push({letter:cur,start,count:i-start});cur=sec;start=i}});if(cur!==null)out.push({letter:cur,start,count:arr.length-start});return out}function drawBankLabel(label,yy){ctx.fillStyle='#173d2e';ctx.font='800 22px Arial';ctx.fillText(label,44,yy)}function drawStandRow(arr,yy){const sx=rowStart(arr);for(let i=0;i<arr.length;i++){const n=arr[i],x=sx+i*tileW,sec=sectorForStandClient(n,c),item=by[n];ctx.fillStyle=sectorColor(sec);ctx.fillRect(x,yy,tileW-2,cellH);ctx.strokeStyle='#9ab0a3';ctx.strokeRect(x,yy,tileW-2,cellH);ctx.fillStyle='#173d2e';ctx.font='900 26px Arial';ctx.fillText(String(n),x+6,yy+6);ctx.save();ctx.translate(x+Math.floor(tileW*0.62),yy+cellH-8);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.font='800 17px Arial';ctx.fillText(displayName(item?.name||''),0,0);ctx.restore();ctx.textAlign='left'}return sx}function drawSectorBands(arr,yy){const sx=rowStart(arr);for(const seg of segments(arr)){const x=sx+seg.start*tileW,w=seg.count*tileW-2,letter=seg.letter,color=sectorColor(letter);ctx.fillStyle=color;ctx.fillRect(x,yy,w,bandH);ctx.strokeStyle='#49715f';ctx.lineWidth=2;ctx.strokeRect(x,yy,w,bandH);ctx.fillStyle='#173d2e';ctx.textAlign='center';ctx.font='800 18px Arial';ctx.fillText('SEKTOR',x+w/2,yy+10);ctx.font='900 34px Arial';ctx.fillText(String(letter||''),x+w/2,yy+25);ctx.font='800 16px Arial';ctx.fillText(seg.count+' os.',x+w/2,yy+53);ctx.textAlign='left'}ctx.lineWidth=1}if(c.map_mode==='ONE_BANK'){drawBankLabel('JEDEN BRZEG',y);y+=34;drawStandRow(bottom,y);y+=cellH+12;drawSectorBands(bottom,y);y+=bandH+22}else{drawBankLabel('BRZEG GÓRNY',y);y+=34;drawStandRow(top,y);y+=cellH+10;drawSectorBands(top,y);y+=bandH+16;ctx.fillStyle='#eef4f0';ctx.fillRect(44,y,1152,waterH);ctx.fillStyle='#315b48';ctx.font='800 28px Arial';ctx.textAlign='center';ctx.fillText(c.fishery||'Łowisko',620,y+14);ctx.textAlign='left';y+=waterH+16;drawSectorBands(bottom,y);y+=bandH+10;drawStandRow(bottom,y);y+=cellH+22;drawBankLabel('BRZEG DOLNY',y);y+=24}const ranges=sectorRangesData(c);ctx.fillStyle='#173d2e';ctx.font='800 20px Arial';ctx.fillText('Sektory i zakresy stanowisk:',44,y);ctx.font='17px Arial';const colW=560,rowGap=28;ranges.forEach((r,i)=>{const col=i%2,row=Math.floor(i/2),xx=58+col*colW,yy=y+32+row*rowGap;ctx.fillText('Sektor '+r.letter+': '+compactRange(r.stands),xx,yy)});return o.canvas}
function generateDrawPdf(round){const d=CURRENT_DETAIL;if(!d)return;const rounds=Number(round)===0?[1,2]:[Number(round)];const pages=[];for(const r of rounds){if(!(d.draws||[]).some(x=>Number(x.round)===r)){msg('Brak losowania T'+r,'bad');continue}pages.push(drawMapPdfPage(r));const dm=drawMap(r),rows=(d.activeEntries||[]).map((e,i)=>{const x=dm[Number(e.user_id)];return [i+1,e.first_name+' '+e.last_name,x?x.stand:'—',x?x.sector:'—']});pages.push(...makePdfTablePages('LOSOWANIE — TURA '+r,['Lp.','Zawodnik','Stan.','Sektor'],rows,[70,650,190,238]))}if(pages.length)downloadPdfPages(pages,'losowanie_'+pdfSafeName(d.competition.title)+'_'+(Number(round)===0?'T1_T2':'T'+round)+'.pdf')}
function pdfResultWeight(r,total=false){const weight=total?Number(r.total_weight||0):Number(r.weight||0),bf=Number(total?r.biggest_fish:r.big_fish||0);return fmtGram(weight)+' g'+(bf?'\nBF: '+fmtGram(bf)+' g':'')}
function makeSectorResultsPdfPagesV33(round){const rows=Number(round)===1?(CURRENT_DETAIL.classification.round1||[]):(CURRENT_DETAIL.classification.round2||[]),groups=groupRowsBySector(rows),pages=[];for(const g of groups){const rr=g.rows,tableRows=rr.map((r,i)=>[i+1,r.points??'—',r.name,r.stand||'—',pdfResultWeight(r,false)]),ranks=rr.map(r=>r.points);pages.push(...makePdfTablePages('KLASYFIKACJA SEKTOROWA — TURA '+round+' — SEKTOR '+g.sector,['Lp.','Msc','Zawodnik','Stan.','Waga'],tableRows,[65,80,555,120,328],ranks))}return pages}
function drawStationStatsPdfPage(d){const o=pdfCanvas(1.5),ctx=o.ctx,rows=stationStatisticsRows(d),best=[...rows].filter(x=>x.places.length).sort((a,b)=>a.avg-b.avg||b.totalWeight-a.totalWeight||a.stand-b.stand).slice(0,5),worst=[...rows].filter(x=>x.places.length).sort((a,b)=>b.avg-a.avg||a.totalWeight-b.totalWeight||a.stand-b.stand).slice(0,5);let y=drawPdfHeaderV33(ctx,'STATYSTYKI STANOWISK — 5 NAJLEPSZYCH / 5 NAJGORSZYCH');const boxW=552,gap=28,xs=[46,46+552+gap];function drawBox(title,data,x,bg,accent){ctx.fillStyle=bg;ctx.fillRect(x,y,boxW,48);ctx.strokeStyle='#8ea99a';ctx.strokeRect(x,y,boxW,48);ctx.fillStyle='#173d2e';ctx.font='800 18px Arial';ctx.fillText(title,x+10,y+13);let yy=y+48;const widths=[48,72,146,80,206],heads=['Lp.','Stan.','Miejsca','Śr.','Waga łączna'];let xx=x;ctx.font='800 13px Arial';for(let i=0;i<heads.length;i++){ctx.fillStyle='#e8f0ea';ctx.fillRect(xx,yy,widths[i],42);ctx.strokeStyle='#b8c8bd';ctx.strokeRect(xx,yy,widths[i],42);ctx.fillStyle='#173d2e';ctx.fillText(heads[i],xx+5,yy+12);xx+=widths[i]}yy+=42;data.forEach((r,i)=>{xx=x;const vals=[i+1,r.stand,r.places.join(' / '),r.avg.toFixed(2).replace('.',','),fmtGram(r.totalWeight)+' g'];for(let j=0;j<vals.length;j++){ctx.fillStyle=j===1?accent:'#fff';ctx.fillRect(xx,yy,widths[j],54);ctx.strokeStyle='#c0cec4';ctx.strokeRect(xx,yy,widths[j],54);ctx.fillStyle='#17251d';ctx.font=(j===1?'900 20px':'700 14px')+' Arial';ctx.fillText(String(vals[j]),xx+6,yy+(j===1?14:17));xx+=widths[j]}yy+=54})}drawBox('5 NAJLEPSZYCH STANOWISK',best,xs[0],'#e4f2e8','#bfe8c9');drawBox('5 NAJGORSZYCH STANOWISK',worst,xs[1],'#fff0d9','#ffd39a');return o.canvas}
function generateResultsPdfV33(round){const d=CURRENT_DETAIL;if(!d)return;const pages=[];if(Number(round)===1||Number(round)===2){const rr=sortRowsBySectorPlace(Number(round)===1?d.classification.round1:d.classification.round2),context='KLASYFIKACJA TURY '+round,headers=['Lp.','Zawodnik','Stan.','Sektor','Miejsce','Waga'],rows=rr.map((r,i)=>[i+1,r.name,r.stand||'—',r.sector||'—',r.points||'—',pdfResultWeight(r,false)]),widths=[60,430,120,110,130,298],ranks=rr.map(r=>r.points);pages.push(...makePdfTablePages(context,headers,rows,widths,ranks));pages.push(...makeSectorResultsPdfPagesV33(Number(round)))}else{const rr=d.classification.general||[],headers=['Msc','Zawodnik','T1','T2','Suma','Waga'],rows=rr.map(r=>[r.rank,r.name+(SHOW_FINAL_CLUB&&r.pzw_club?' • '+r.pzw_club:''),r.t1_points??'—',r.t2_points??'—',r.sum_points??'—',pdfResultWeight(r,true)]),widths=[70,480,100,100,130,268],ranks=rr.map(r=>r.rank);pages.push(...makePdfTablePages('KLASYFIKACJA KOŃCOWA',headers,rows,widths,ranks));pages.push(drawStationStatsPdfPage(d))}if(pages.length)downloadPdfPages(pages,'wyniki_'+pdfSafeName(d.competition.title)+'_'+(Number(round)===0?'general':'T'+round)+'.pdf')}
function drawStartListPdfPage(rows){const o=pdfCanvas(2),ctx=o.ctx;let y=drawPdfHeaderV33(ctx,'LISTA STARTOWA ZAWODNIKÓW'),x0=36,widths=[62,408,176,150,150,222],total=widths.reduce((a,b)=>a+b,0),headH=52;ctx.fillStyle='#e5efe8';ctx.fillRect(x0,y,total,headH);ctx.strokeStyle='#8ea99a';ctx.lineWidth=1;ctx.font='800 15px Arial';let x=x0;['Lp.','Zawodnik','Potwierdzenie ✓','Wpisowe','Koszyk +','Uwagi'].forEach((h,i)=>{ctx.strokeRect(x,y,widths[i],headH);ctx.fillStyle='#173d2e';ctx.fillText(h,x+7,y+16);x+=widths[i]});y+=headH;const count=Math.max(1,rows.length),available=1698-y,rowH=Math.max(24,Math.min(56,Math.floor(available/count))),fontSize=Math.max(12,Math.min(19,Math.floor(rowH*0.43)));for(let r=0;r<rows.length;r++){x=x0;for(let i=0;i<widths.length;i++){ctx.fillStyle='#fff';ctx.fillRect(x,y,widths[i],rowH);ctx.strokeStyle='#aebfb4';ctx.strokeRect(x,y,widths[i],rowH);ctx.fillStyle='#14251b';ctx.font=(i===0||i===1?'800 ':'600 ')+fontSize+'px Arial';const txt=String(rows[r][i]??'');const lines=wrapPdfText(ctx,txt,widths[i]-14).slice(0,rowH>=42?2:1);const lineH=Math.max(15,fontSize+2),blockH=lines.length*lineH,startY=y+Math.max(5,(rowH-blockH)/2);lines.forEach((line,j)=>ctx.fillText(line,x+7,startY+j*lineH));x+=widths[i]}y+=rowH}return o.canvas}
function generateStartListPdf(){const d=CURRENT_DETAIL;if(!d)return;const rows=(d.activeEntries||[]).map((e,i)=>[i+1,e.first_name+' '+e.last_name,e.confirmed?'✓':'','','','']);downloadPdfPages([drawStartListPdfPage(rows)],'lista_startowa_'+pdfSafeName(d.competition.title)+'.pdf')}
function notifData(n){return n&&n.data&&typeof n.data==='object'?n.data:{}}
function notificationStatusHtml(n){const data=notifData(n);if(ME?.role==='ADMIN'&&String(n.type)==='LEAVE_REQUEST'){const status=String(data.status||'PENDING').toUpperCase();if(status==='PENDING')return '<div class="leaveRequestActions"><button type="button" onclick="decideLeaveRequest('+Number(data.requestId||0)+',\'approve\','+n.id+')">Akceptuj</button><button type="button" class="warn" onclick="decideLeaveRequest('+Number(data.requestId||0)+',\'reject\','+n.id+')">Odrzuć</button></div>';if(status==='APPROVED')return '<span class="tag ok">Zaakceptowano</span>';if(status==='REJECTED')return '<span class="tag bad">Odrzucono</span>'}return n.read_at?'Przecz.':'<button type="button" onclick="readNotif('+n.id+')">OK</button>'}
async function loadNotifications(){if(!ME)return;const d=await api('/api/notifications');const arr=d.notifications||[];const unread=arr.filter(n=>!n.read_at).length;PLAYER_UNREAD_NOTIFICATIONS=unread;const counter=q('notifCounter');if(counter)counter.textContent=unread?'🔔 '+unread:'';const mobileBtn=q('playerNotifBtn');if(mobileBtn)mobileBtn.textContent='POWIADOMIENIA'+(unread?' ('+unread+')':'');const actions='<div class="notificationBulkActions"><button type="button" onclick="confirmAllNotifications()">✓ Potwierdź wszystkie</button><button type="button" class="warn" onclick="deleteAllNotifications()">Usuń powiadomienia</button></div>';q('notificationsList').innerHTML=actions+(arr.length?'<div class="tablewrap notificationWrap"><table class="notificationTable"><thead><tr><th>Zdarzenie</th><th>Czas</th><th>Status / decyzja</th></tr></thead><tbody>'+arr.map(n=>'<tr class="'+(!n.read_at?'mine':'')+' '+(String(n.type)==='LEAVE_REQUEST'?'leaveRequestRow':'')+'"><td><b>'+esc(n.title)+'</b><br>'+esc(n.body)+'</td><td class="nowrap small">'+new Date(n.created_at).toLocaleString('pl-PL')+'</td><td>'+notificationStatusHtml(n)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="muted">Brak powiadomień.</p>')}

async function confirmAllNotifications(){try{const path=ME?.role==='ADMIN'?'/api/admin/notifications/read-all':'/api/notifications/read-all';const d=await api(path,{method:'POST',body:'{}'});msg('Potwierdzono powiadomienia: '+Number(d.updated||0));await loadNotifications()}catch(e){msg(e.message,'bad')}}
async function deleteAllNotifications(){try{const admin=ME?.role==='ADMIN';const question=admin?'Usunąć wszystkie zwykłe i zakończone powiadomienia? Oczekujące prośby o wypisanie pozostaną.':'Usunąć wszystkie swoje powiadomienia?';if(!confirm(question))return;const path=admin?'/api/admin/notifications':'/api/notifications';const d=await api(path,{method:'DELETE',body:'{}'});msg('Usunięto powiadomienia: '+Number(d.deleted||0)+(Number(d.keptPending||0)?'. Oczekujące prośby: '+Number(d.keptPending):''));await loadNotifications()}catch(e){msg(e.message,'bad')}}
async function decideLeaveRequest(requestId,decision,notifId){try{if(!requestId)throw new Error('Brak identyfikatora prośby');const approve=decision==='approve';if(!confirm(approve?'Zaakceptować prośbę i wypisać zawodnika z zawodów?':'Odrzucić prośbę o wypisanie?'))return;const out=await api('/api/admin/leave-requests/'+requestId+'/'+(approve?'approve':'reject'),{method:'POST',body:'{}'});msg(approve?'Zawodnik został wypisany':'Prośba została odrzucona');await loadNotifications();await loadCompetitions();if(CURRENT_DETAIL?.competition?.id==out.competitionId)await refreshCompetitionKeepScroll(out.competitionId)}catch(e){msg(e.message,'bad')}}
async function readNotif(id){await api('/api/notifications/'+id+'/read',{method:'POST',body:'{}'});loadNotifications()}
async function editPlayerName(id,currentName){if(!ME||ME.role!=='ADMIN')return;const before=String(currentName||'').replace(/\s+/g,' ').trim();const entered=prompt('Popraw imię i nazwisko zawodnika:',before);if(entered===null)return;const fullName=String(entered||'').replace(/\s+/g,' ').trim();if(!fullName){msg('Imię i nazwisko nie może być puste','bad');return}if(fullName===before)return;try{const d=await api('/api/admin/players/'+Number(id),{method:'PATCH',body:JSON.stringify({fullName})});msg('Poprawiono nazwę zawodnika: '+(d.player?.name||fullName));await loadPlayers();if(CURRENT_DETAIL?.competition?.id)await refreshCompetitionKeepScroll(CURRENT_DETAIL.competition.id)}catch(e){msg(e.message,'bad')}}
function playerInfoBadges(p){let out='';if(p.has_logged_in)out+='<span class="playerAccountBadge playerAccountVerified" title="Zawodnik zalogował się w aplikacji">V</span>';if(String(p.account_source||'SELF').toUpperCase()==='ADMIN')out+='<span class="playerAccountBadge playerAccountAdmin" title="Zawodnik dodany przez administratora">A</span>';return out||'<span class="muted">—</span>'}
async function deletePlayer(id,name){if(!ME||ME.role!=='ADMIN')return;const label=String(name||'zawodnika');if(!confirm('Usunąć zawodnika '+label+'?\n\nUsunięte zostaną także jego zapisy, losowania, wyniki i powiadomienia.'))return;try{const d=await api('/api/admin/players/'+Number(id),{method:'DELETE',body:'{}'});msg('Usunięto zawodnika: '+(d.player?.name||label));await loadPlayers();await loadCompetitions();if(CURRENT_DETAIL?.competition?.id)await refreshCompetitionKeepScroll(CURRENT_DETAIL.competition.id)}catch(e){msg(e.message,'bad')}}
async function loadPlayers(){if(!ME||ME.role!=='ADMIN')return;const d=await api('/api/admin/players');const legend='<div class="playerAccountLegend"><span><b class="playerAccountBadge playerAccountVerified">V</b> zalogował się w aplikacji</span><span><b class="playerAccountBadge playerAccountAdmin">A</b> dodany przez admina</span></div>';const desktop='<div class="tablewrap adminDesktopOnly"><table class="adminPlayersTable"><thead><tr><th style="width:46px">Lp.</th><th>Imię i nazwisko</th><th style="width:82px">Info</th><th>Telefon</th><th>Koło PZW</th><th>Aktywne zapisy</th><th style="width:150px">Akcja</th></tr></thead><tbody>'+d.players.map((p,i)=>{const name=String((p.first_name||'')+' '+(p.last_name||'')).trim();const safeName=encodeURIComponent(name);return '<tr><td class="center"><b>'+(i+1)+'</b></td><td><b>'+esc(name)+'</b></td><td class="playerBadgeCell">'+playerInfoBadges(p)+'</td><td class="nowrap">'+esc(p.phone)+'</td><td>'+esc(p.pzw_club)+'</td><td class="center">'+esc(p.active_entries||0)+'</td><td><div class="inlineBtns playerManageBtns"><button type="button" class="secondary" onclick="editPlayerName('+Number(p.id)+',decodeURIComponent(\''+safeName+'\'))">Edytuj</button><button type="button" class="warn playerDeleteBtn" onclick="deletePlayer('+Number(p.id)+',decodeURIComponent(\''+safeName+'\'))">Usuń</button></div></td></tr>'}).join('')+'</tbody></table></div>';const mobile='<div class="adminMobileOnly mobilePlayersList">'+d.players.map((p,i)=>{const name=String((p.first_name||'')+' '+(p.last_name||'')).trim();const safeName=encodeURIComponent(name);return '<article class="mobileAdminCard mobilePlayerManageCard"><div class="mobileAdminCardHead"><span class="mobileLp">'+(i+1)+'</span><b>'+esc(name)+'</b><span class="mobilePlayerBadges">'+playerInfoBadges(p)+'</span></div><div class="mobileAdminMeta"><span><small>Koło</small><b>'+esc(p.pzw_club||'—')+'</b></span><span><small>Zapisy</small><b>'+esc(p.active_entries||0)+'</b></span></div><div class="mobileAdminLine"><small>Telefon</small><span>'+esc(p.phone||'—')+'</span></div><div class="mobilePlayerManageActions"><button type="button" class="secondary" onclick="editPlayerName('+Number(p.id)+',decodeURIComponent(\''+safeName+'\'))">Edytuj nazwę</button><button type="button" class="warn playerDeleteBtn mobilePlayerDeleteBtn" onclick="deletePlayer('+Number(p.id)+',decodeURIComponent(\''+safeName+'\'))">Usuń zawodnika</button></div></article>'}).join('')+'</div>';q('playersList').innerHTML=legend+desktop+mobile}
function urlBase64ToUint8Array(base64String){const padding='='.repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base64);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;++i)out[i]=raw.charCodeAt(i);return out}
async function getPushConfig(force=false){if(PUSH_CONFIG&&!force)return PUSH_CONFIG;PUSH_CONFIG=await api('/api/config');return PUSH_CONFIG}
function pushUiLabel(){if(!('Notification'in window))return 'Alerty niedostępne';if(Notification.permission==='denied')return 'Alerty zablokowane';if(Notification.permission==='granted'&&PUSH_SUBSCRIBED)return 'Test alertu';return 'Włącz alerty telefonu'}
function renderPushStatus(){
  const legacy=q('pushStatus');if(legacy)legacy.innerHTML='';
  const state=q('notifPushState');
  const btn=q('notifPushBtn');
  const pbtn=q('playerPushBtn');
  let label='Alerty telefonu: wyłączone';
  if('Notification'in window){if(Notification.permission==='granted')label=PUSH_SUBSCRIBED?'Alerty telefonu: włączone':'Alerty telefonu: gotowe do włączenia';else if(Notification.permission==='denied')label='Alerty telefonu: zablokowane w przeglądarce'}
  if(state)state.textContent=label;
  if(btn)btn.textContent=pushUiLabel();
  if(pbtn)pbtn.textContent=pushUiLabel();
}
async function ensurePushSubscription(silent=false,sendTest=false){
  if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window)){
    if(!silent){const isiPhone=/iPhone|iPad|iPod/i.test(navigator.userAgent);msg(isiPhone?'Na iPhone alerty działają po dodaniu strony do ekranu początkowego.':'Ta przeglądarka nie obsługuje powiadomień telefonu.','bad')}
    renderPushStatus();return false;
  }
  const cfg=await getPushConfig(true);
  if(!cfg.pushReady||!cfg.vapidPublicKey){if(!silent)msg('Serwer powiadomień nie jest jeszcze gotowy.','bad');renderPushStatus();return false}
  let permission=Notification.permission;
  if(permission==='default'&&!silent)permission=await Notification.requestPermission();
  if(permission!=='granted'){if(!silent)msg(permission==='denied'?'Powiadomienia są zablokowane w ustawieniach tej strony.':'Nie włączono powiadomień telefonu.','bad');renderPushStatus();return false}
  const reg=await navigator.serviceWorker.register('/sw.js?v=56',{scope:'/'});
  await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  if(sub&&sendTest){await sub.unsubscribe().catch(()=>{});sub=null}
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(cfg.vapidPublicKey)});
  await api('/api/push-subscription',{method:'POST',body:JSON.stringify({subscription:sub.toJSON?sub.toJSON():sub})});
  PUSH_SUBSCRIBED=true;renderPushStatus();
  if(sendTest){const t=await api('/api/push-test',{method:'POST',body:'{}'});if(!silent)msg(t.sent?'Wysłano testowe powiadomienie na telefon.':'Subskrypcja zapisana, ale test nie został dostarczony.',t.sent?'ok':'bad')}
  return true;
}
async function disablePushSubscription(unregister=false){
  try{if(TOKEN)await api('/api/push-subscription',{method:'DELETE',body:'{}'}).catch(()=>{});if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.getRegistration('/');if(reg){const sub=await reg.pushManager.getSubscription();if(sub)await sub.unsubscribe().catch(()=>{});if(unregister)await reg.unregister().catch(()=>{})}}}finally{PUSH_SUBSCRIBED=false;renderPushStatus()}
}
async function resetPush(){try{await disablePushSubscription(false);msg('Alerty telefonu wyłączone.');}catch(e){msg(e.message,'bad')}}
async function enablePush(ev){if(ev){ev.preventDefault();ev.stopPropagation()}try{await ensurePushSubscription(false,true)}catch(e){msg('Nie udało się włączyć alertów: '+(e.message||e),'bad');renderPushStatus()}}
async function sendPushTest(ev){return enablePush(ev)}
function scrollAppTop(){window.scrollTo({top:0,behavior:'smooth'})}

function syncStickyNavOffset(){const header=document.querySelector('header');const h=header?Math.ceil(header.getBoundingClientRect().height):52;document.documentElement.style.setProperty('--app-header-height',h+'px')}
let ADMIN_NAV_RAF=0;
function syncFixedAdminNav(){
  if(ADMIN_NAV_RAF){cancelAnimationFrame(ADMIN_NAV_RAF);ADMIN_NAV_RAF=0}
  ADMIN_NAV_RAF=requestAnimationFrame(()=>{
    ADMIN_NAV_RAF=0;
    const slot=document.querySelector('.workZoneTabsSlot'),tabs=document.querySelector('.workZoneTabs'),detail=q('competitionDetail');
    if(!slot||!tabs||!detail||detail.classList.contains('hidden')||ME?.role!=='ADMIN'){
      if(tabs){tabs.classList.remove('fixedAdminNav');tabs.style.left='';tabs.style.width='';tabs.style.top=''}
      if(slot)slot.style.height='';
      return;
    }
    const top=0;
    const slotRect=slot.getBoundingClientRect(),detailRect=detail.getBoundingClientRect();
    const tabH=Math.ceil(tabs.getBoundingClientRect().height||tabs.offsetHeight||44);
    const shouldFix=slotRect.top<=top && detailRect.bottom>top+tabH+6;
    if(shouldFix){
      slot.style.height=tabH+'px';
      tabs.classList.add('fixedAdminNav');
      const r=slot.getBoundingClientRect();
      tabs.style.left=Math.round(r.left)+'px';
      tabs.style.width=Math.round(r.width)+'px';
      tabs.style.top=top+'px';
    }else{
      tabs.classList.remove('fixedAdminNav');
      tabs.style.left='';
      tabs.style.width='';
      tabs.style.top='';
      slot.style.height='';
    }
  });
}
window.addEventListener('scroll',syncFixedAdminNav,{passive:true});

window.addEventListener('resize',()=>{clearTimeout(window.__stickySyncTimer);window.__stickySyncTimer=setTimeout(()=>{syncStickyNavOffset();syncFixedAdminNav()},80)},{passive:true});

let PLAYER_STICKY_RAF=0;
function clearPlayerFixed(el,slot){
  if(el){
    el.classList.remove('fixedPlayerBar');
    el.style.left='';
    el.style.right='';
    el.style.width='';
    el.style.top='';
  }
  if(slot)slot.style.height='';
}
function getPlayerStickyTop(){
  const header=document.querySelector('header');
  if(!header)return 0;
  const r=header.getBoundingClientRect();
  return Math.max(0,Math.ceil(r.bottom));
}
function syncOnePlayerBar(slot,bar,boundary,top){
  if(!slot||!bar||!boundary){clearPlayerFixed(bar,slot);return}
  const stickyTop=Number.isFinite(top)?top:getPlayerStickyTop();
  const slotRect=slot.getBoundingClientRect();
  const boundaryRect=boundary.getBoundingClientRect();
  const wasFixed=bar.classList.contains('fixedPlayerBar');
  if(wasFixed)bar.classList.remove('fixedPlayerBar');
  const naturalH=Math.ceil(bar.getBoundingClientRect().height||bar.offsetHeight||40);
  if(wasFixed)bar.classList.add('fixedPlayerBar');
  const fixedH=Math.ceil(bar.getBoundingClientRect().height||naturalH);
  const barH=Math.max(naturalH,fixedH);
  const shouldFix=slotRect.top<=stickyTop && boundaryRect.bottom>stickyTop+barH+6;
  if(shouldFix){
    slot.style.height=barH+'px';
    bar.classList.add('fixedPlayerBar');
    const r=slot.getBoundingClientRect();
    bar.style.left=Math.round(r.left)+'px';
    bar.style.width=Math.round(r.width)+'px';
    bar.style.top=stickyTop+'px';
  }else clearPlayerFixed(bar,slot);
}
function syncPlayerStickyBars(){
  if(PLAYER_STICKY_RAF){cancelAnimationFrame(PLAYER_STICKY_RAF);PLAYER_STICKY_RAF=0}
  PLAYER_STICKY_RAF=requestAnimationFrame(()=>{
    PLAYER_STICKY_RAF=0;
    const mobile=window.matchMedia&&window.matchMedia('(max-width:760px)').matches;
    const player=ME&&ME.role!=='ADMIN';
    const detail=q('competitionDetail');
    const top=getPlayerStickyTop();
    const mobileSlot=document.querySelector('.playerMobileDashboard .playerDrawStickySlot');
    const mobileBar=document.querySelector('.playerMobileDashboard .playerUnifiedNav');
    const mobileBoundary=document.querySelector('.playerMobileDashboard');
    const desktopSlot=document.querySelector('.playerDesktopDashboardV56 .playerDesktopStickySlot');
    const desktopBar=document.querySelector('.playerDesktopDashboardV56 .playerDesktopUnifiedNav');
    const desktopBoundary=document.querySelector('.playerDesktopDashboardV56');
    if(!player||!detail||detail.classList.contains('hidden')){
      clearPlayerFixed(mobileBar,mobileSlot);clearPlayerFixed(desktopBar,desktopSlot);return;
    }
    if(mobile){
      clearPlayerFixed(desktopBar,desktopSlot);
      syncOnePlayerBar(mobileSlot,mobileBar,mobileBoundary,top);
    }else{
      clearPlayerFixed(mobileBar,mobileSlot);
      clearPlayerFixed(desktopBar,desktopSlot);
      if(desktopSlot)desktopSlot.style.height='';
    }
  });
}
window.addEventListener('scroll',syncPlayerStickyBars,{passive:true});
window.addEventListener('resize',()=>{clearTimeout(window.__playerStickyResize);window.__playerStickyResize=setTimeout(()=>{syncPlayerStickyBars();fitPlayerMobileFullMaps()},60)},{passive:true});

function bindAuthButtons(){
  const pairs=[['clearSessionBtn',clearSession],['regBtn',registerPlayer],['setupAdminBtn',setupAdmin],['pushBtn',enablePush],['logoutBtn',logout]];
  for(const [id,fn] of pairs){const el=q(id);if(el&&!el.dataset.bound){el.dataset.bound='1';el.onclick=null;el.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();fn(ev);});}}
  ['loginPhone','loginPassword'].forEach(id=>{const el=q(id);if(el&&!el.dataset.enterLogin){el.dataset.enterLogin='1';el.addEventListener('keydown',ev=>{if(ev.key==='Enter')login(ev);});}});
}

function scrollAppBottom(){window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'})}
Object.assign(window,{boot,login,registerPlayer,setupAdmin,logout,showTab,showAdminZone,loadCompetitions,createCompetition,deleteCompetition,clearCompetitions,joinComp,leaveComp,openCompetition,saveCompetition,drawRound,publishDraw,resetDraw,saveResults,generateResults,generateResultsAll,clearResults,addWeightItem,deleteWeightItem,notifyResults,readNotif,confirmAllNotifications,deleteAllNotifications,decideLeaveRequest,loadNotifications,loadPlayers,editPlayerName,deletePlayer,enablePush,sendPushTest,resetPush,clearSession,importZawodyPro,addManualPlayer,setEntryStatus,toggleEntryConfirm,setupStructureAuto,autoFillBanksFromRoster,updateStructurePreview,sectorCardsChanged,resetSectorLayout,scrollAppTop,scrollAppBottom,showPlayerDraw,showPlayerResults,showPlayerMobilePanel,openPlayerNotifications,fitPlayerMobileFullMaps,togglePlayerSectorAccordion,toggleFinalClub,generateDrawPdf,generateResultsPdfV33,generateStartListPdf});
function startBoot(){console.log('CLIENT_V57_BOOT');syncStickyNavOffset();try{fetch('/__probe_boot_v57',{cache:'no-store'}).catch(()=>{})}catch(_){};bindAuthButtons();boot().catch(e=>{console.error('BOOT_FATAL',e);try{msg('Błąd startu aplikacji: '+(e.message||e),'bad')}catch(_){}})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startBoot);else startBoot();
