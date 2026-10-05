from pathlib import Path
import re


def rep(text, old, new, label):
    if old not in text:
        raise SystemExit(f'V298 patch failed: {label}')
    return text.replace(old, new, 1)

server=Path('server.cjs')
s=server.read_text(encoding='utf-8')
s=rep(s,"const APP_VERSION = '297';","const APP_VERSION = '298';",'server version')
s=rep(s,"const APP_VERSION_NAME = 'V297_PLAYERS_SPECIFICITY_FIX';","const APP_VERSION_NAME = 'V298_ONE_TWO_ROUND_COMPETITIONS';",'server version name')
s=s.replace('players-dark-v297.css','players-dark-v298.css')
s=rep(s,"function clampInt(v, min, max, fallback) { const n = intOrNull(v); if (n === null) return fallback; return Math.max(min, Math.min(max, n)); }","function clampInt(v, min, max, fallback) { const n = intOrNull(v); if (n === null) return fallback; return Math.max(min, Math.min(max, n)); }\nfunction competitionRoundCount(comp) { return Number(comp?.round_count) === 1 ? 1 : 2; }\nfunction assertCompetitionRound(comp, round) { if (Number(round) === 2 && competitionRoundCount(comp) === 1) { const e=new Error('Te zawody są 1-turowe — Tura 2 jest wyłączona.'); e.status=409; throw e; } }",'server round helper')
s=rep(s,"alter table competitions add column if not exists zero_score_rule text not null default 'MIN';","alter table competitions add column if not exists zero_score_rule text not null default 'MIN';\n    alter table competitions add column if not exists round_count integer not null default 2;\n    update competitions set round_count=2 where round_count is null or round_count not in (1,2);",'round_count migration')

create_old="""    let presenceReminderNote='';
    try { presenceReminderNote=presenceReminders.normalizeOrganizerNote(b.presenceReminderNote); }
    catch (e) { return sendJson(res,400,{ok:false,error:e.message}); }
    const { rows } = await pool.query(`
      insert into competitions(title,fishery,competition_date,meeting_time,limit_places,status,notes,regulations,created_by,map_mode,bank1_count,bank2_count,sectors_count,signup_open,presence_reminder_note)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning *
    `, [String(b.title||'Method Feeder').trim()||'Method Feeder', String(b.fishery||'').trim(), b.competitionDate || null, meetingTime, limit, b.status || 'OPEN', String(b.notes||''), String(b.regulations||''), user.id, mapMode, bank1, bank2, sectors, b.status==='PRIVATE'?b.signupOpen!==false:['OPEN'].includes(b.status||'OPEN'), presenceReminderNote]);"""
create_new="""    let presenceReminderNote='';
    try { presenceReminderNote=presenceReminders.normalizeOrganizerNote(b.presenceReminderNote); }
    catch (e) { return sendJson(res,400,{ok:false,error:e.message}); }
    const roundCount=Number(b.roundCount)===1?1:2;
    const { rows } = await pool.query(`
      insert into competitions(title,fishery,competition_date,meeting_time,limit_places,status,notes,regulations,created_by,map_mode,bank1_count,bank2_count,sectors_count,signup_open,presence_reminder_note,round_count)
      values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning *
    `, [String(b.title||'Method Feeder').trim()||'Method Feeder', String(b.fishery||'').trim(), b.competitionDate || null, meetingTime, limit, b.status || 'OPEN', String(b.notes||''), String(b.regulations||''), user.id, mapMode, bank1, bank2, sectors, b.status==='PRIVATE'?b.signupOpen!==false:['OPEN'].includes(b.status||'OPEN'), presenceReminderNote, roundCount]);"""
s=rep(s,create_old,create_new,'create competition roundCount')

patch_old="""    let presenceReminderNote;
    try { presenceReminderNote=presenceReminders.normalizeOrganizerNote(b.presenceReminderNote===undefined ? old.presence_reminder_note : b.presenceReminderNote); }
    catch(e) { return sendJson(res,400,{ok:false,error:e.message}); }
    const { rows } = await pool.query(`
      update competitions set title=$1, fishery=$2, competition_date=$3, meeting_time=$4, limit_places=$5, status=$6, notes=$7, regulations=$8, map_mode=$9, bank1_count=$10, bank2_count=$11, sectors_count=$12, sector_layout=$13, signup_open=$14, presence_reminder_note=$15
      where id=$16 returning *
    `, [String(b.title||old.title).trim(), String(b.fishery||'').trim(), b.competitionDate || null, (/^\\d{2}:\\d{2}$/.test(String(b.meetingTime||''))?String(b.meetingTime):'06:00'), limit, b.status || old.status || 'OPEN', String(b.notes||''), String(b.regulations||''), mapMode, bank1, bank2, sectors, sectorLayout === undefined ? old.sector_layout : sectorLayout, b.status!==undefined ? (b.status==='PRIVATE'&&old.status==='PRIVATE'&&b.signupOpen===undefined?old.signup_open:['OPEN','PRIVATE'].includes(b.status)&&b.signupOpen!==false) : (b.signupOpen===undefined ? old.signup_open : b.signupOpen!==false), presenceReminderNote, id]);"""
patch_new="""    let presenceReminderNote;
    try { presenceReminderNote=presenceReminders.normalizeOrganizerNote(b.presenceReminderNote===undefined ? old.presence_reminder_note : b.presenceReminderNote); }
    catch(e) { return sendJson(res,400,{ok:false,error:e.message}); }
    const roundCount=b.roundCount===undefined?competitionRoundCount(old):(Number(b.roundCount)===1?1:2);
    if(roundCount!==competitionRoundCount(old)){
      const used=await pool.query(`select ((select count(*) from draws where competition_id=$1)+(select count(*) from results where competition_id=$1)+(select count(*) from result_items where competition_id=$1))::int n`,[id]);
      if(Number(used.rows[0]?.n||0)>0)return sendJson(res,409,{ok:false,error:'Format 1/2 tury można zmienić tylko przed losowaniem i wpisaniem wyników.'});
    }
    const { rows } = await pool.query(`
      update competitions set title=$1, fishery=$2, competition_date=$3, meeting_time=$4, limit_places=$5, status=$6, notes=$7, regulations=$8, map_mode=$9, bank1_count=$10, bank2_count=$11, sectors_count=$12, sector_layout=$13, signup_open=$14, presence_reminder_note=$15, round_count=$16
      where id=$17 returning *
    `, [String(b.title||old.title).trim(), String(b.fishery||'').trim(), b.competitionDate || null, (/^\\d{2}:\\d{2}$/.test(String(b.meetingTime||''))?String(b.meetingTime):'06:00'), limit, b.status || old.status || 'OPEN', String(b.notes||''), String(b.regulations||''), mapMode, bank1, bank2, sectors, sectorLayout === undefined ? old.sector_layout : sectorLayout, b.status!==undefined ? (b.status==='PRIVATE'&&old.status==='PRIVATE'&&b.signupOpen===undefined?old.signup_open:['OPEN','PRIVATE'].includes(b.status)&&b.signupOpen!==false) : (b.signupOpen===undefined ? old.signup_open : b.signupOpen!==false), presenceReminderNote, roundCount, id]);"""
s=rep(s,patch_old,patch_new,'patch competition roundCount')

def add_guard(src, fn):
    pat=rf"(async function {fn}\(competitionId, round, actor\) \{{.*?if \(!comp\) throw new Error\('Nie znaleziono zawodów'\);)"
    out,n=re.subn(pat,r"\1\n  assertCompetitionRound(comp, round);",src,count=1,flags=re.S)
    if n!=1: raise SystemExit(f'V298 patch failed: {fn} guard')
    return out
s=add_guard(s,'generateDraw')
s=add_guard(s,'generateRandomResults')

s=rep(s,"  const resBy = new Map();\n  for (const r of results) resBy.set(Number(r.user_id) + ':' + Number(r.round), r);","  const resBy = new Map();\n  for (const r of results) resBy.set(Number(r.user_id) + ':' + Number(r.round), r);\n  const oneRound = competitionRoundCount(comp) === 1;",'classification flag')
for old,new,label in [
("      t2_stand: b?.stand || null,","      t2_stand: oneRound ? null : (b?.stand || null),",'t2 stand'),
("      t2_sector: b?.sector || '-',","      t2_sector: oneRound ? '-' : (b?.sector || '-'),",'t2 sector'),
("      t2_points: b?.points || null,","      t2_points: oneRound ? null : (b?.points || null),",'t2 points'),
("      t2_weight: b?.weight || 0,","      t2_weight: oneRound ? 0 : (b?.weight || 0),",'t2 weight'),
("      sum_points: (a?.points || 0) + (b?.points || 0),","      sum_points: (a?.points || 0) + (oneRound ? 0 : (b?.points || 0)),",'sum points'),
("      total_weight: (a?.weight || 0) + (b?.weight || 0),","      total_weight: (a?.weight || 0) + (oneRound ? 0 : (b?.weight || 0)),",'total weight'),
("      biggest_fish: Math.max(a?.big_fish || 0, b?.big_fish || 0),","      biggest_fish: oneRound ? (a?.big_fish || 0) : Math.max(a?.big_fish || 0, b?.big_fish || 0),",'big fish')]: s=rep(s,old,new,label)

s=rep(s,"  const c=detail.competition, rr=round===1?detail.classification.round1:detail.classification.round2;","  const c=detail.competition, oneRound=competitionRoundCount(c)===1, rr=round===1?detail.classification.round1:detail.classification.round2;",'achievement flag')
s=rep(s,"  if((round===1||round===2) && r && r.sector && r.sector!=='-'){","  if((round===2||(!oneRound&&round===1)) && r && r.sector && r.sector!=='-'){",'one-round encouragement')
s=rep(s,"  const complete=[1,2].every(t=>(detail.results||[]).some(x=>Number(x.round)===t));","  const complete=(oneRound?[1]:[1,2]).every(t=>(detail.results||[]).some(x=>Number(x.round)===t));",'general complete')
s=rep(s,"    await notifyUser(e.user_id,'DRAW_PUBLISH',DRAW_NOTICE_TITLE,drawNoticeText(first,second),{","    await notifyUser(e.user_id,'DRAW_PUBLISH',DRAW_NOTICE_TITLE,drawNoticeText(first,second,competitionRoundCount(comp)===1),{",'draw notice')
s=rep(s,"    if(![1,2].every(t=>(detail.results||[]).some(r=>Number(r.round)===t)))\n      return sendJson(res,409,{ok:false,error:'Najpierw wpisz i przelicz wyniki T1 oraz T2.'});","    const requiredRounds=competitionRoundCount(detail.competition)===1?[1]:[1,2];\n    if(!requiredRounds.every(t=>(detail.results||[]).some(r=>Number(r.round)===t)))\n      return sendJson(res,409,{ok:false,error:requiredRounds.length===1?'Najpierw wpisz i przelicz wyniki.':'Najpierw wpisz i przelicz wyniki T1 oraz T2.'});",'general notify')

s=rep(s,"    if(!r1||!r2||!g)continue;","    const oneRound=competitionRoundCount(d.competition)===1;\n    if(!r1||(!oneRound&&!r2)||!g)continue;",'history requirement')
s=rep(s,"    const s2=(d.classification.round2||[]).filter(r=>String(r.sector)===String(r2.sector)).length;","    const s2=oneRound?0:(d.classification.round2||[]).filter(r=>String(r.sector)===String(r2.sector)).length;",'history s2')
for old,new,label in [
("      t2_place:Number(r2.points||r2.sector_place||0),","      t2_place:oneRound?0:Number(r2.points||r2.sector_place||0),",'history place'),
("      t2_weight:Number(r2.weight||0),","      t2_weight:oneRound?0:Number(r2.weight||0),",'history weight'),
("      t2_big_fish:Number(r2.big_fish||0),","      t2_big_fish:oneRound?0:Number(r2.big_fish||0),",'history bf'),
("      t2_stand:r2.stand==null?null:Number(r2.stand),","      t2_stand:oneRound?null:(r2.stand==null?null:Number(r2.stand)),",'history stand'),
("      t2_sector:String(r2.sector||''),","      t2_sector:oneRound?'':String(r2.sector||''),",'history sector')]: s=rep(s,old,new,label)

marker='<div><label>Liczba osób / limit listy głównej</label><input id="cLimit" type="number" min="1" placeholder="30"></div></div><div class="adminTextPair">'
rounds='<div><label>Liczba osób / limit listy głównej</label><input id="cLimit" type="number" min="1" placeholder="30"></div><div class="competitionRoundsField"><label>Format zawodów</label><div class="competitionRoundOptions"><label><input type="radio" name="cRoundCount" value="1"><span><b>1 TURA</b><small>jedno losowanie + klasyfikacja z jednej tury</small></span></label><label><input type="radio" name="cRoundCount" value="2" checked><span><b>2 TURY</b><small>pełna logika T1 + T2</small></span></label></div></div></div><div class="adminTextPair">'
s=rep(s,marker,rounds,'create form radios')
server.write_text(s,encoding='utf-8')

notice=Path('draw-notice.cjs')
n=notice.read_text(encoding='utf-8')
n=rep(n,"function drawNoticeText(t1,t2){\n  const a=drawSpot(t1),b=drawSpot(t2);\n  return [\n    a?'TURA 1 – '+a:null,\n    b?'TURA 2 – '+b:null,\n    'Powodzenia! 🎣'\n  ].filter(Boolean).join('\\n');\n}","function drawNoticeText(t1,t2,oneRound=false){\n  const a=drawSpot(t1),b=drawSpot(t2);\n  if(oneRound)return [a?'LOSOWANIE – '+a:null,'Powodzenia! 🎣'].filter(Boolean).join('\\n');\n  return [\n    a?'TURA 1 – '+a:null,\n    b?'TURA 2 – '+b:null,\n    'Powodzenia! 🎣'\n  ].filter(Boolean).join('\\n');\n}",'draw notice format')
notice.write_text(n,encoding='utf-8')

app=Path('app.js')
a=app.read_text(encoding='utf-8')
a=rep(a,"const CLIENT_VERSION='297';const CLIENT_VERSION_NAME='V297_PLAYERS_SPECIFICITY_FIX';","const CLIENT_VERSION='298';const CLIENT_VERSION_NAME='V298_ONE_TWO_ROUND_COMPETITIONS';",'client version')
a=rep(a,"status:q('cStatus')?.value||'OPEN'})","status:q('cStatus')?.value||'OPEN',roundCount:Number(document.querySelector('input[name=\"cRoundCount\"]:checked')?.value||2)})",'create payload')
a=rep(a,"if(q('cTitle'))q('cTitle').value='Method Feeder';await loadCompetitions();","if(q('cTitle'))q('cTitle').value='Method Feeder';const rc2=document.querySelector('input[name=\"cRoundCount\"][value=\"2\"]');if(rc2)rc2.checked=true;await loadCompetitions();",'create reset radio')
a=rep(a,"presenceReminderNote:q('dPresenceReminderNote')?.value??cur.presence_reminder_note??''})","presenceReminderNote:q('dPresenceReminderNote')?.value??cur.presence_reminder_note??'',roundCount:Number(document.querySelector('input[name=\"dRoundCount\"]:checked')?.value||competitionRoundCountClient(cur))})",'save payload')

boot='function startBoot(){if(BOOT_RUNNING)return;'
if boot not in a: raise SystemExit('V298 patch failed: boot marker')
overrides=r'''
/* V298 — zawody 1- i 2-turowe. Dla 2 tur zawsze wywołujemy dotychczasową funkcję V297. */
function competitionRoundCountClient(c){return Number(c?.round_count)===1?1:2}
function oneRoundCompetition(d=CURRENT_DETAIL){return competitionRoundCountClient(d?.competition)===1}
function v298RemoveButton(html,needle){const i=String(html).indexOf(needle);if(i<0)return html;const s=html.lastIndexOf('<button',i),e=html.indexOf('</button>',i);return s>=0&&e>=0?html.slice(0,s)+html.slice(e+9):html}
const V298_renderCompetitionSettings=renderCompetitionSettings;
renderCompetitionSettings=function(d,forceOpen=false){let html=V298_renderCompetitionSettings(d,forceOpen);const c=d.competition,rounds=competitionRoundCountClient(c),locked=(d.draws||[]).length>0||(d.results||[]).length>0||(d.resultItems||[]).length>0;const selector='<div class="competitionRoundsField"><label>Format zawodów</label><div class="competitionRoundOptions"><label><input type="radio" name="dRoundCount" value="1" '+(rounds===1?'checked ':'')+(locked?'disabled ':'')+'><span><b>1 TURA</b><small>jedno losowanie + jedna klasyfikacja</small></span></label><label><input type="radio" name="dRoundCount" value="2" '+(rounds===2?'checked ':'')+(locked?'disabled ':'')+'><span><b>2 TURY</b><small>pełna logika T1 + T2</small></span></label></div>'+(locked?'<small class="roundModeLocked">Format jest zablokowany po wykonaniu losowania lub wpisaniu wyników.</small>':'')+'</div>';const mark='<div><label>Status zapisów</label><select id="dStatus">';return html.includes(mark)?html.replace(mark,selector+mark):html};
const V298_renderDrawTable=renderDrawTable;
renderDrawTable=function(d,admin){if(!oneRoundCompetition(d))return V298_renderDrawTable(d,admin);const entries=d.activeEntries||[],dm=new Map((d.draws||[]).filter(x=>Number(x.round)===1).map(x=>[Number(x.user_id),x]));if(!entries.length)return '<p class="muted">Brak aktywnych zawodników.</p>';const desktop='<div class="tablewrap adminDesktopOnly"><table><thead><tr><th>Zawodnik</th><th>Stanowisko</th><th>Sektor</th></tr></thead><tbody>'+entries.map(e=>{const x=dm.get(Number(e.user_id));return '<tr><td><b>'+esc(e.first_name+' '+e.last_name)+'</b></td><td class="center"><b>'+(x?esc(x.stand):'—')+'</b></td><td class="center">'+(x?esc(x.sector):'—')+'</td></tr>'}).join('')+'</tbody></table></div>';const mobile='<div class="adminMobileOnly mobileDrawSummary">'+entries.map((e,i)=>{const x=dm.get(Number(e.user_id));return '<article class="mobileAdminCard"><div class="mobileAdminCardHead"><span class="mobileLp">'+(i+1)+'</span><b>'+esc(e.first_name+' '+e.last_name)+'</b></div><div class="mobileDrawPair oneRound"><div><small>Stanowisko</small><b>'+(x?esc(x.stand):'—')+'</b><span>Sektor '+(x?esc(x.sector):'—')+'</span></div></div></article>'}).join('')+'</div>';return desktop+mobile};
const V298_renderDrawPanel=renderDrawPanel;
renderDrawPanel=function(d){if(!oneRoundCompetition(d))return V298_renderDrawPanel(d);const c=d.competition,x=rosterCounts(d),disabled=disabledStandList(c),addon=disabled.length>0,physical=Math.max(0,Number(c.bank1_count||0)+Number(c.bank2_count||0)),available=physical-disabled.length,hasDraw=(d.draws||[]).some(x=>Number(x.round)===1),hasResults=((d.results||[]).some(x=>Number(x.round)===1))||((d.resultItems||[]).some(x=>Number(x.round)===1))||((d.classification?.round1||[]).length>0),ready=available>0&&available===x.draw,normalStructureOk=x.stands===x.draw;return '<div class="card oneRoundAdminPanel"><h2>Losowanie stanowisk — 1 tura</h2>'+renderDrawChecklist(d)+renderDisabledStandsTool(d)+'<div class="card '+((addon?ready:normalStructureOk)?'success-line':'danger-line')+'"><b>Do losowania: '+x.draw+' zawodników z listy głównej.</b><br><span class="small muted">'+(addon?('Stanowiska fizyczne: '+physical+'. Dostępne po wyłączeniach: '+available+'.'):('Stanowiska w strukturze: '+x.stands+'.'))+' Rezerwa nie jest losowana.</span></div><div class="grid"><button type="button" '+(ready?'':'disabled')+' onclick="drawRound('+c.id+',1,event)">Losuj</button><button type="button" class="secondary" onclick="publishDraw('+c.id+',event)">Publikuj losowanie</button></div><details class="adminDeleteDrawTile dangerousOps"><summary>Operacje awaryjne: reset losowania i wyników</summary><button type="button" class="warn adminDeleteDrawBtn" '+((hasDraw||hasResults)?'':'disabled')+' onclick="resetDraw('+c.id+',event)">USUŃ LOSOWANIE + WYNIKI</button><div class="small"><b>Uwaga:</b> usuwa losowanie i wyniki tej jednej tury. Zostawia listę zawodników, sektory i ustawienia zawodów.</div>'+renderRecoveryAction(d)+'</details><details class="adminDrawPreview" '+(window.__lowcyAdminDrawPreview===1?'open':'')+' ontoggle="window.__lowcyAdminDrawPreview=this.open?1:0"><summary>Mapa i sektory — losowanie'+(hasDraw?' ✓':' · oczekuje')+'</summary>'+renderRoundDrawView(d,1,false)+'</details><details class="adminDrawPreview adminDrawSummary"><summary>Pełna tabela losowania</summary>'+renderDrawTable(d,true)+'</details></div>'};
const V298_drawRound=drawRound;
drawRound=async function(id,round,ev){if(oneRoundCompetition()&&Number(round)===1){const btn=ev?.target;try{if(!await appConfirmLegacy('Wykonać losowanie dla aktualnej listy głównej? Poprzednie losowanie zostanie zastąpione. Powiadomienia pójdą dopiero po publikacji.'))return;if(btn){btn.disabled=true;btn.textContent='Losuję...'}await api('/api/admin/competitions/'+id+'/draw/1',{method:'POST',body:'{}'});msg('Wylosowano stanowiska — bez publikacji');await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Losuj'}}return}return V298_drawRound(id,round,ev)};
const V298_renderResultsEntryPanel=renderResultsEntryPanel;
renderResultsEntryPanel=function(d){if(!oneRoundCompetition(d))return V298_renderResultsEntryPanel(d);const c=d.competition,p=chatGptPendingForCurrent(),pending=p&&Number(p.round)===1?'<div class="photoImportWarn" style="margin-bottom:10px"><b>📋 CZEKA ODCZYT Z CHATGPT</b><div style="margin-top:8px"><button type="button" class="blue" onclick="openChatGptPasteImport(1,true)">WKLEJ I WCZYTAJ</button></div></div>':'';return '<div class="card oneRoundAdminPanel"><h2>Wpisywanie wyników — 1 tura</h2>'+pending+'<div class="photoImportQuick"><b>📸 SZYBKI IMPORT ZE ZDJĘCIA</b><span class="mobileWaterHint">Telefon nad wodą: zrób 1–2 zdjęcia → ChatGPT → skopiuj JSON → wróć i wklej.</span><div class="grid"><button type="button" class="blue" onclick="openChatGptPasteImport(1,false)">📸 WYNIKI — ZE ZDJĘCIA</button></div></div><details class="card" style="margin-top:10px"><summary><b>OpenAI API (opcjonalny / płatny)</b></summary><button type="button" class="secondary" onclick="startPhotoResultImport(1)">API — WYNIKI</button></details><div class="grid"><button type="button" class="secondary" onclick="generateResults('+c.id+',1,event)">Generuj wyniki testowe</button></div><details class="dangerousOps resultClearOps"><summary>Operacje awaryjne: wyczyść wyniki</summary><p class="small">Przed usunięciem powstaje kopia wag, BF i wyników.</p><button type="button" class="warn" onclick="clearResults('+c.id+',event)">Wyczyść wyniki</button>'+renderRecoveryAction(d)+'</details><div class="resultEntryRounds oneRound"><div class="resultRoundPanel resultRoundPanel1"><h3 class="resultRoundTitle resultRoundTitle1">WYNIKI</h3>'+renderResultForm(d,1)+'</div></div></div>'};
const V298_renderResultsPreflight=renderResultsPreflight;
renderResultsPreflight=function(d){if(!oneRoundCompetition(d))return V298_renderResultsPreflight(d);const people=d.activeEntries||[],draws=new Set((d.draws||[]).filter(x=>Number(x.round)===1).map(x=>Number(x.user_id))),results=new Set((d.results||[]).filter(x=>Number(x.round)===1).map(x=>Number(x.user_id))),missingDraw=people.filter(e=>!draws.has(Number(e.user_id))),missingResults=people.filter(e=>!results.has(Number(e.user_id))),ready=!missingDraw.length&&!missingResults.length;return '<div class="resultsPreflight '+(ready?'ready':'warning')+'"><b>'+(ready?'✓ KONTROLA WYNIKÓW — GOTOWE':'⚠ KONTROLA WYNIKÓW')+'</b><span>Losowanie: '+(people.length-missingDraw.length)+'/'+people.length+' · Wynik: '+(people.length-missingResults.length)+'/'+people.length+'</span>'+(missingDraw.length?'<small>Brak losowania: '+missingDraw.map(e=>esc(e.first_name+' '+e.last_name)).join(', ')+'</small>':'')+(missingResults.length?'<small>Brak wyniku: '+missingResults.map(e=>esc(e.first_name+' '+e.last_name)).join(', ')+'</small>':'')+'</div>'};
const V298_renderSectorResultsBoard=renderSectorResultsBoard;
renderSectorResultsBoard=function(d){if(!oneRoundCompetition(d))return V298_renderSectorResultsBoard(d);return '<div class="card"><h2>Wyniki sektorowe</h2>'+renderSectorResultsColumn(d.classification.round1,'')+'</div>'};
const V298_renderGeneralTable=renderGeneralTable;
renderGeneralTable=function(rows){if(!oneRoundCompetition())return V298_renderGeneralTable(rows);rows=rows||[];if(!rows.length)return '<p class="muted">Brak klasyfikacji końcowej.</p>';const desktop='<div class="tablewrap finalWrap adminDesktopOnly"><table class="generalTable sharpTable oneRoundGeneral"><thead><tr><th class="center">MSC</th><th>Zawodnik</th><th class="center">Miejsce</th><th class="right">Waga</th></tr></thead><tbody>'+rows.map(r=>'<tr class="'+placeRowClass(r.rank)+' '+(Number(r.user_id)===Number(ME.id)?'mine':'')+'"><td class="center"><b>'+r.rank+'</b></td><td><b>'+esc(r.name)+'</b></td><td class="center"><b>'+placeText(r.t1_points)+'</b></td><td class="right nowrap"><b>'+fmtGram(r.total_weight)+'g</b>'+(Number(r.biggest_fish||0)?'<br><span class="bfLine">BF: '+fmtGram(r.biggest_fish)+'g</span>':'')+'</td></tr>').join('')+'</tbody></table></div>';const mobile='<div class="adminMobileOnly mobileGeneralList">'+rows.map(r=>'<article class="mobileAdminCard '+placeRowClass(r.rank)+'"><div class="mobileAdminCardHead"><strong class="mobileRank">'+r.rank+'</strong><b>'+esc(r.name)+'</b></div><div class="mobileScoreGrid oneRound"><span><small>Miejsce</small><b>'+placeText(r.t1_points)+'</b></span><span><small>Waga</small><b>'+fmtGram(r.total_weight)+'g</b>'+(Number(r.biggest_fish||0)?'<em>BF '+fmtGram(r.biggest_fish)+'g</em>':'')+'</span></div></article>').join('')+'</div>';return desktop+mobile};
const V298_renderStationStatistics=renderStationStatistics;
renderStationStatistics=function(d){let html=V298_renderStationStatistics(d);return oneRoundCompetition(d)?html.replace('Stanowiska po 2 turach','Stanowiska po 1 turze'):html};
const V298_renderResultsSummaryPanel=renderResultsSummaryPanel;
renderResultsSummaryPanel=function(d){if(!oneRoundCompetition(d))return V298_renderResultsSummaryPanel(d);const c=d.competition;return '<div class="card oneRoundAdminPanel"><h2>Wyniki i klasyfikacja — 1 tura</h2>'+renderZeroScoreRule(c)+renderResultsPreflight(d)+'<div class="resultsNotifyGrid oneRound"><button type="button" class="blue resultNotifyTile" onclick="notifyResults('+c.id+',1)"><span class="resultActionIcon">📣</span><span class="resultActionCopy"><b>POWIADOM</b><small>WYNIKI</small></span></button></div><div class="resultToastActions"><button type="button" class="secondary resultToastTile" onclick="retryAchievementToasts('+c.id+',1,this)"><span>↻</span><b>DYMKI WYNIKÓW</b></button><button type="button" class="secondary resultToastTile" onclick="retryAchievementToasts('+c.id+',\'general\',this)"><span>↻</span><b>GENERAL</b></button></div><p id="achievementPublishStatus" role="status"></p>'+renderSectorResultsBoard(d)+'<h3>Wyniki</h3>'+renderClassTable(d.classification.round1)+'<h3>Klasyfikacja generalna</h3><button type="button" class="blue" onclick="notifyGeneralResults('+c.id+',this)">Powiadom o klasyfikacji generalnej</button><p id="generalPublishStatus" role="status"></p>'+renderFinalClubToggle()+renderGeneralTable(d.classification.general)+renderStationStatistics(d)+'</div>'};
const V298_renderMap=renderMap;
renderMap=function(d){let html=V298_renderMap(d);if(oneRoundCompetition(d))html=html.replace('<span class="tag t1tag">czerwony = Twoje T1</span> <span class="tag t2tag">niebieski = Twoje T2</span>','<span class="tag t1tag">czerwony = Twoje stanowisko</span>');return html};
const V298_renderPlayerDesktopDashboard=renderPlayerDesktopDashboard;
renderPlayerDesktopDashboard=function(d){let html=V298_renderPlayerDesktopDashboard(d);if(!oneRoundCompetition(d))return html;html=v298RemoveButton(html,"showPlayerDesktopPanel('draw2',event)");html=v298RemoveButton(html,"showPlayerDesktopPanel('t2',event)");html=v298RemoveButton(html,"showPlayerDesktopPanel('map2',event)");return html.replace('playerDesktopDashboardV56 playerDesktopDashboardV55','playerDesktopDashboardV56 playerDesktopDashboardV55 oneRoundCompetition').replace('Losowanie<br>Tura 1','Losowanie').replace('Wyniki<br>Tura 1','Wyniki').replace('MAPA T1','MAPA')};
const V298_renderPlayerMobileDashboard=renderPlayerMobileDashboard;
renderPlayerMobileDashboard=function(d){let html=V298_renderPlayerMobileDashboard(d);if(!oneRoundCompetition(d))return html;html=v298RemoveButton(html,"showPlayerMobilePanel('draw2',event)");html=v298RemoveButton(html,"showPlayerMobilePanel('t2',event)");html=v298RemoveButton(html,"showPlayerMobilePanel('map2',event)");return html.replace('playerMobileDashboard','playerMobileDashboard oneRoundCompetition').replace('Losowanie<br>Tura 1','Losowanie').replace('Wyniki<br>Tura 1','Wyniki').replace('MAPA T1','MAPA')};
const V298_renderPlayerDesktopPanelContent=renderPlayerDesktopPanelContent;
renderPlayerDesktopPanelContent=function(d,panel){if(oneRoundCompetition(d)){if(panel==='draw2')panel='draw1';if(panel==='map2')panel='map1';if(panel==='t2')panel='t1'}let html=V298_renderPlayerDesktopPanelContent(d,panel);return oneRoundCompetition(d)?html.replaceAll('Wyniki sektorowe — Tura 1','Wyniki sektorowe').replaceAll('Cała Tura 1','Wyniki').replaceAll('MAPA ŁOWISKA — TURA 1','MAPA ŁOWISKA — LOSOWANIE'):html};
const V298_renderPlayerMobilePanelContent=renderPlayerMobilePanelContent;
renderPlayerMobilePanelContent=function(d,panel){if(oneRoundCompetition(d)){if(panel==='draw2')panel='draw1';if(panel==='map2')panel='map1';if(panel==='t2')panel='t1'}let html=V298_renderPlayerMobilePanelContent(d,panel);return oneRoundCompetition(d)?html.replaceAll('Wyniki sektorowe — Tura 1','Wyniki sektorowe').replaceAll('Cała Tura 1','Wyniki').replaceAll('MAPA ŁOWISKA — TURA 1','MAPA ŁOWISKA — LOSOWANIE'):html};
const V298_renderPlayerDetail=renderPlayerDetail;
renderPlayerDetail=function(d){if(oneRoundCompetition(d)){if(PLAYER_MOBILE_PANEL==='draw2')PLAYER_MOBILE_PANEL='draw1';if(PLAYER_MOBILE_PANEL==='map2')PLAYER_MOBILE_PANEL='map1';if(PLAYER_MOBILE_PANEL==='t2')PLAYER_MOBILE_PANEL='t1';PLAYER_DRAW_ROUND=1}return V298_renderPlayerDetail(d)};
const V298_showPlayerDesktopPanel=showPlayerDesktopPanel;
showPlayerDesktopPanel=function(panel,ev){if(oneRoundCompetition()){if(panel==='draw2')panel='draw1';if(panel==='map2')panel='map1';if(panel==='t2')panel='t1'}return V298_showPlayerDesktopPanel(panel,ev)};
const V298_showPlayerMobilePanel=showPlayerMobilePanel;
showPlayerMobilePanel=function(panel,ev){if(oneRoundCompetition()){if(panel==='draw2')panel='draw1';if(panel==='map2')panel='map1';if(panel==='t2')panel='t1'}return V298_showPlayerMobilePanel(panel,ev)};
const V298_showPlayerDraw=showPlayerDraw;
showPlayerDraw=function(round,ev){return V298_showPlayerDraw(oneRoundCompetition()?1:round,ev)};
const V298_renderPdfPanel=renderPdfPanel;
renderPdfPanel=function(d){let html=V298_renderPdfPanel(d);if(!oneRoundCompetition(d))return html;html=v298RemoveButton(html,'generateDrawPdf(2)');return html.replaceAll('Losowanie T1 / T2','Losowanie').replaceAll('PDF Losowanie T1','PDF Losowanie')};
const V298_renderFotoFbPanel=renderFotoFbPanel;
renderFotoFbPanel=function(d){let html=V298_renderFotoFbPanel(d);if(!oneRoundCompetition(d))return html;html=v298RemoveButton(html,"generateFotoFb('t2')");return html.replace('Wyniki sektorowe — Tura 1','Wyniki sektorowe')};
const V298_judgeChooseRound=judgeChooseRound;
judgeChooseRound=function(round){return V298_judgeChooseRound(oneRoundCompetition()?1:round)};
const V298_renderJudgeWork=renderJudgeWork;
renderJudgeWork=function(){if(oneRoundCompetition()&&JUDGE_ROUND===2)JUDGE_ROUND=1;V298_renderJudgeWork();if(!oneRoundCompetition()||!CURRENT_DETAIL)return;const box=q('judgeWork');if(!box)return;if(JUDGE_VIEW==='entry'){box.querySelector('.judgeT2')?.remove();const t1=box.querySelector('.judgeT1');if(t1)t1.textContent='Wyniki';const h=box.querySelector('.judgeEntryRound1 h2');if(h)h.textContent='Wpisz wagę'}else if(JUDGE_VIEW==='results'){const hs=[...box.querySelectorAll('h2')],h1=hs.find(h=>h.textContent.trim()==='Klasyfikacja T1'),h2=hs.find(h=>h.textContent.trim()==='Klasyfikacja T2');if(h1)h1.textContent='Wyniki';if(h2){let n=h2.nextSibling;while(n&&!(n.nodeType===1&&n.tagName==='H2')){const next=n.nextSibling;n.remove();n=next}h2.remove()}}};
'''
a=a.replace(boot,overrides+'\n'+boot,1)
app.write_text(a,encoding='utf-8')

css=Path('players-dark-v297.css').read_text(encoding='utf-8')
css += r'''

/* V298 — wybór 1/2 tury i kompaktowe widoki jednej tury. */
.competitionRoundsField{grid-column:1/-1}
.competitionRoundOptions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:5px}
.competitionRoundOptions>label{display:block;cursor:pointer;margin:0}
.competitionRoundOptions input{position:absolute;opacity:0;pointer-events:none}
.competitionRoundOptions span{display:flex;flex-direction:column;gap:2px;padding:10px 12px;border:1px solid #47768d;border-radius:10px;background:#102f40;color:#eaf5fa;box-shadow:inset 0 1px 0 rgba(255,255,255,.05)}
.competitionRoundOptions span b{font-size:15px;letter-spacing:.04em}
.competitionRoundOptions span small{font-size:11px;color:#bad0dc}
.competitionRoundOptions label:has(input:checked) span{background:linear-gradient(180deg,#176d58,#10513f);border-color:#62c49b;box-shadow:0 0 0 2px rgba(83,196,151,.18),inset 0 1px 0 rgba(255,255,255,.08)}
.competitionRoundOptions label:has(input:checked) span b{color:#fff}
.competitionRoundOptions label:has(input:disabled) span{opacity:.68;cursor:not-allowed}
.roundModeLocked{display:block;margin-top:5px;color:#c8d6dd}
.oneRoundCompetition .playerDesktopPrimaryNav,.playerMobileDashboard.oneRoundCompetition .playerPrimaryNav{grid-template-columns:repeat(3,minmax(0,1fr))!important}
.oneRoundCompetition .playerQuickInfoNav{grid-template-columns:repeat(3,minmax(0,1fr))!important}
.resultEntryRounds.oneRound{grid-template-columns:1fr!important}
.mobileDrawPair.oneRound{grid-template-columns:1fr!important}
.mobileScoreGrid.oneRound{grid-template-columns:repeat(2,minmax(0,1fr))!important}
@media(max-width:760px){.competitionRoundOptions{grid-template-columns:1fr 1fr}.competitionRoundOptions span{padding:8px}.competitionRoundOptions span b{font-size:14px}.competitionRoundOptions span small{font-size:10px}}
'''
Path('players-dark-v298.css').write_text(css,encoding='utf-8')
print('V298 patch applied')
