from pathlib import Path
import re


def rep(text, old, new, label, count=1):
    if old not in text:
        raise SystemExit(f'V298 patch: missing {label}')
    return text.replace(old, new, count)


def insert_after_line_in_function(text, function_name, line_contains, insertion):
    start=text.find('function '+function_name+'(')
    if start<0: raise SystemExit(f'V298 patch: missing function {function_name}')
    next_pos=text.find('\nfunction ',start+10)
    if next_pos<0: next_pos=len(text)
    block=text[start:next_pos]
    pos=block.find(line_contains)
    if pos<0: raise SystemExit(f'V298 patch: missing line in {function_name}: {line_contains}')
    eol=block.find('\n',pos)
    if eol<0: raise SystemExit(f'V298 patch: no newline after {line_contains}')
    block=block[:eol+1]+insertion+block[eol+1:]
    return text[:start]+block+text[next_pos:]

server=Path('server.cjs')
s=server.read_text(encoding='utf-8')
s=rep(s,"const APP_VERSION = '297';","const APP_VERSION = '298';",'server version')
s=rep(s,"const APP_VERSION_NAME = 'V297_PLAYERS_SPECIFICITY_FIX';","const APP_VERSION_NAME = 'V298_ONE_TWO_ROUNDS';",'server version name')

# DB migration: existing and old-client events remain 2-round.
anchor="    create table if not exists competition_judges ("
s=rep(s,anchor,"    alter table competitions add column if not exists round_count integer not null default 2;\n"+anchor,'round_count migration')

# Competition creation API.
old="    const title = String(b.title || '').trim() || (fishery ? ('Zawody — ' + fishery) : 'Zawody');\n    const mapMode = b.mapMode || 'TWO_OPPOSITE';"
new="    const title = String(b.title || '').trim() || (fishery ? ('Zawody — ' + fishery) : 'Zawody');\n    const roundCount = Number(b.roundCount)===1 ? 1 : 2;\n    const mapMode = b.mapMode || 'TWO_OPPOSITE';"
s=rep(s,old,new,'create roundCount')
old="`insert into competitions(title,fishery,competition_date,meeting_time,limit_places,status,notes,regulations,created_by,map_mode,bank1_count,bank2_count,sectors_count,signup_open,presence_reminder_note)\n       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning *`,\n      [title, fishery, b.competitionDate || null, (/^\\d{2}:\\d{2}$/.test(String(b.meetingTime||''))?String(b.meetingTime):'06:00'), limit, b.status || 'OPEN', String(b.notes||''), String(b.regulations||''), user.id, mapMode, bank1, bank2, sectors, b.signupOpen !== false, presenceReminderNote]"
new="`insert into competitions(title,fishery,competition_date,meeting_time,limit_places,status,notes,regulations,created_by,map_mode,bank1_count,bank2_count,sectors_count,signup_open,presence_reminder_note,round_count)\n       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) returning *`,\n      [title, fishery, b.competitionDate || null, (/^\\d{2}:\\d{2}$/.test(String(b.meetingTime||''))?String(b.meetingTime):'06:00'), limit, b.status || 'OPEN', String(b.notes||''), String(b.regulations||''), user.id, mapMode, bank1, bank2, sectors, b.signupOpen !== false, presenceReminderNote, roundCount]"
s=rep(s,old,new,'create insert round_count')

# One-round events reuse T1 exactly; T2 cannot be generated.
old="  if (!comp) throw new Error('Nie znaleziono zawodów');\n  const entries = await getActiveEntries(competitionId);"
new="  if (!comp) throw new Error('Nie znaleziono zawodów');\n  if (Number(comp.round_count||2)===1 && Number(round)!==1) throw new Error('Zawody 1-turowe mają tylko jedno losowanie.');\n  const entries = await getActiveEntries(competitionId);"
s=rep(s,old,new,'draw guard')
old="async function generateRandomResults(competitionId, round, actor) {\n  const comp = await getCompetition(competitionId);\n  if (!comp) throw new Error('Nie znaleziono zawodów');"
new="async function generateRandomResults(competitionId, round, actor) {\n  const comp = await getCompetition(competitionId);\n  if (!comp) throw new Error('Nie znaleziono zawodów');\n  if (Number(comp.round_count||2)===1 && Number(round)!==1) throw new Error('Zawody 1-turowe mają tylko jedną turę wyników.');"
s=rep(s,old,new,'result generator guard')

# Classification: 2-round formula stays the same. With one round b=null, so general == round1.
old="  const roundRows = { 1: [], 2: [] };\n\n  for (const round of [1,2]) {"
new="  const roundRows = { 1: [], 2: [] };\n  const roundCount = Number(comp?.round_count||2)===1 ? 1 : 2;\n\n  for (const round of (roundCount===1 ? [1] : [1,2])) {"
s=rep(s,old,new,'classification round list')
s=rep(s,"    const b = r2.get(Number(e.user_id));","    const b = roundCount===2 ? r2.get(Number(e.user_id)) : null;",'classification r2')

# General notification can close after T1 for one-round events.
old="    if(![1,2].every(t=>(detail.results||[]).some(r=>Number(r.round)===t)))\n      return sendJson(res,409,{ok:false,error:'Najpierw wpisz i przelicz wyniki T1 oraz T2.'});"
new="    const requiredRounds=Number(detail.competition?.round_count||2)===1?[1]:[1,2];\n    if(!requiredRounds.every(t=>(detail.results||[]).some(r=>Number(r.round)===t)))\n      return sendJson(res,409,{ok:false,error:requiredRounds.length===1?'Najpierw wpisz i przelicz wyniki.':'Najpierw wpisz i przelicz wyniki T1 oraz T2.'});"
s=rep(s,old,new,'general publication completeness')

# Achievements: don't promise T2 after a one-round event.
old="function publishedAchievements(detail, round, userId) {\n  const c=detail.competition, rr=round===1?detail.classification.round1:detail.classification.round2;"
new="function publishedAchievements(detail, round, userId) {\n  const c=detail.competition, oneRound=Number(c?.round_count||2)===1, rr=round===1?detail.classification.round1:detail.classification.round2;"
s=rep(s,old,new,'achievements oneRound')
s=rep(s,"if((round===1||round===2) && r && r.sector && r.sector!=='-'){","if((round===1||round===2) && !(oneRound&&round===1) && r && r.sector && r.sector!=='-'){",'encouragement oneRound')
s=rep(s,"  const complete=[1,2].every(t=>(detail.results||[]).some(x=>Number(x.round)===t));","  const complete=(oneRound?[1]:[1,2]).every(t=>(detail.results||[]).some(x=>Number(x.round)===t));",'achievement completeness')

# Create form selector.
marker='<p class="small muted">Dane z tego formularza są później widoczne dla zawodnika.</p><div class="grid">'
chooser='<p class="small muted">Dane z tego formularza są później widoczne dla zawodnika.</p><div class="competitionRoundChoice" role="radiogroup" aria-label="Liczba tur"><label class="checkline"><input type="radio" name="cRoundCount" value="1"> <b>Zawody 1-turowe</b></label><label class="checkline"><input type="radio" name="cRoundCount" value="2" checked> <b>Zawody 2-turowe</b></label></div><div class="grid">'
s=rep(s,marker,chooser,'create form selector')
server.write_text(s,encoding='utf-8')

app=Path('app.js')
a=app.read_text(encoding='utf-8')
a=rep(a,"const CLIENT_VERSION='297';const CLIENT_VERSION_NAME='V297_PLAYERS_SPECIFICITY_FIX';","const CLIENT_VERSION='298';const CLIENT_VERSION_NAME='V298_ONE_TWO_ROUNDS';",'client version')
old="presenceReminderNote:q('cPresenceReminderNote')?.value||'',status:q('cStatus')?.value||'OPEN'"
new="presenceReminderNote:q('cPresenceReminderNote')?.value||'',status:q('cStatus')?.value||'OPEN',roundCount:Number(document.querySelector('input[name=\"cRoundCount\"]:checked')?.value||2)"
a=rep(a,old,new,'createCompetition roundCount')

# Admin draw panel.
old="  const c=d.competition,x=rosterCounts(d),disabled=disabledStandList(c),addon=disabled.length>0,physical=Math.max(0,Number(c.bank1_count||0)+Number(c.bank2_count||0)),available=physical-disabled.length,hasDraw=(d.draws||[]).length>0;"
new="  const c=d.competition,oneRound=Number(c.round_count||2)===1,rounds=oneRound?[1]:[1,2],x=rosterCounts(d),disabled=disabledStandList(c),addon=disabled.length>0,physical=Math.max(0,Number(c.bank1_count||0)+Number(c.bank2_count||0)),available=physical-disabled.length,hasDraw=(d.draws||[]).length>0;"
a=rep(a,old,new,'draw panel round flag')
old="+'<div class=\"grid3\"><button type=\"button\" '+(ready?'':'disabled')+' onclick=\"drawRound('+c.id+',1,event)\">Losuj T1</button><button type=\"button\" class=\"blue\" '+(ready?'':'disabled')+' onclick=\"drawRound('+c.id+',2,event)\">Losuj T2</button><button type=\"button\" class=\"secondary\" onclick=\"publishDraw('+c.id+',event)\">Publikuj losowanie</button></div>'"
new="+(oneRound?'<div class=\"grid\"><button type=\"button\" '+(ready?'':'disabled')+' onclick=\"drawRound('+c.id+',1,event)\">Losuj stanowiska</button><button type=\"button\" class=\"secondary\" onclick=\"publishDraw('+c.id+',event)\">Publikuj losowanie</button></div>':'<div class=\"grid3\"><button type=\"button\" '+(ready?'':'disabled')+' onclick=\"drawRound('+c.id+',1,event)\">Losuj T1</button><button type=\"button\" class=\"blue\" '+(ready?'':'disabled')+' onclick=\"drawRound('+c.id+',2,event)\">Losuj T2</button><button type=\"button\" class=\"secondary\" onclick=\"publishDraw('+c.id+',event)\">Publikuj losowanie</button></div>')"
a=rep(a,old,new,'draw buttons')
a=rep(a,"+[1,2].map(round=>'<details class=\"adminDrawPreview\"","+rounds.map(round=>'<details class=\"adminDrawPreview\"",'draw previews')
a=rep(a,"<summary>Pełna tabela losowania T1 / T2</summary>","<summary>'+(oneRound?'Pełna tabela losowania':'Pełna tabela losowania T1 / T2')+'</summary>",'draw summary')

# One-round result entry: insert an early-return branch. Existing two-round return remains unchanged.
needle="  const c=d.competition,p=chatGptPendingForCurrent();"
a=rep(a,needle,"  const c=d.competition,p=chatGptPendingForCurrent(),oneRound=Number(d.competition?.round_count||2)===1;",'results entry oneRound flag')
one_entry="  if(oneRound)return '<div class=\"card\"><h2>Wpisywanie wyników — 1 tura</h2>'+pending+'<div class=\"photoImportQuick\"><b>📸 SZYBKI IMPORT ZE ZDJĘCIA</b><span class=\"mobileWaterHint\">Telefon nad wodą: zrób 1–2 zdjęcia → ChatGPT → skopiuj JSON → wróć i wklej.</span><div class=\"grid\"><button type=\"button\" class=\"blue\" onclick=\"openChatGptPasteImport(1,false)\">📸 WYNIKI — ZE ZDJĘCIA</button></div></div><details class=\"card\" style=\"margin-top:10px\"><summary><b>OpenAI API (opcjonalny / płatny)</b></summary><div class=\"grid\"><button type=\"button\" class=\"secondary\" onclick=\"startPhotoResultImport(1)\">API — WYNIKI</button></div></details><div class=\"grid\"><button type=\"button\" class=\"secondary\" onclick=\"generateResults('+c.id+',1,event)\">Generuj wyniki testowe</button></div><details class=\"dangerousOps resultClearOps\"><summary>Operacje awaryjne: wyczyść wyniki</summary><p class=\"small\">Przed usunięciem powstaje kopia wag, BF i wyników.</p><button type=\"button\" class=\"warn\" onclick=\"clearResults('+c.id+',event)\">Wyczyść wyniki</button>'+renderRecoveryAction(d)+'</details><div class=\"resultEntryRounds\"><div class=\"resultRoundPanel resultRoundPanel1\"><h3 class=\"resultRoundTitle resultRoundTitle1\">WYNIKI</h3>'+renderResultForm(d,1)+'</div></div></div>';\n"
a=insert_after_line_in_function(a,'renderResultsEntryPanel','const pending=',one_entry)

# Results summary: early return for one-round, leaving the old two-round expression untouched.
summary_prefix="function renderResultsSummaryPanel(d){const c=d.competition;"
one_summary="function renderResultsSummaryPanel(d){const c=d.competition,oneRound=Number(d.competition?.round_count||2)===1;if(oneRound)return '<div class=\"card\"><h2>Wyniki i klasyfikacja — 1 tura</h2>'+renderZeroScoreRule(c)+renderResultsPreflight(d)+'<div class=\"resultsNotifyGrid\"><button type=\"button\" class=\"blue resultNotifyTile\" onclick=\"notifyResults('+c.id+',1)\"><span class=\"resultActionIcon\">📣</span><span class=\"resultActionCopy\"><b>POWIADOM</b><small>WYNIKI</small></span></button></div><div class=\"resultToastActions\"><button type=\"button\" class=\"secondary resultToastTile\" onclick=\"retryAchievementToasts('+c.id+',1,this)\"><span>↻</span><b>DYMKI</b></button><button type=\"button\" class=\"secondary resultToastTile\" onclick=\"retryAchievementToasts('+c.id+',\\'general\\',this)\"><span>↻</span><b>GENERAL</b></button></div><p id=\"achievementPublishStatus\" role=\"status\"></p><h3>Wyniki sektorowe</h3>'+renderSectorResultsColumn(d.classification.round1,'')+'<h3>Klasyfikacja generalna</h3><button type=\"button\" class=\"blue\" onclick=\"notifyGeneralResults('+c.id+',this)\">Powiadom o klasyfikacji generalnej</button><p id=\"generalPublishStatus\" role=\"status\"></p>'+renderFinalClubToggle()+renderGeneralTable(d.classification.general)+renderStationStatistics(d)+'</div>';"
a=rep(a,summary_prefix,one_summary,'results summary oneRound')

# Player mobile + desktop navigation. Preserve exact 2-round labels in else path.
for _ in range(2):
    old="const p=PLAYER_MOBILE_PANEL,early=playerEarlyListAvailable(d.competition);"
    new="const p=PLAYER_MOBILE_PANEL,early=playerEarlyListAvailable(d.competition),oneRound=Number(d.competition?.round_count||2)===1;"
    a=rep(a,old,new,'player dashboard round flag')
    old="+b('draw1','Losowanie<br>Tura 1'+playerDrawStar(d,1),'drawTile')\n      +b('draw2','Losowanie<br>Tura 2'+playerDrawStar(d,2),'drawTile')\n      +b('t1','Wyniki<br>Tura 1'+playerResultStar(d,1),'resultTile')\n      +b('t2','Wyniki<br>Tura 2'+playerResultStar(d,2),'resultTile')"
    new="+b('draw1',(oneRound?'Losowanie':'Losowanie<br>Tura 1')+playerDrawStar(d,1),'drawTile')\n      +(oneRound?'':b('draw2','Losowanie<br>Tura 2'+playerDrawStar(d,2),'drawTile'))\n      +b('t1',(oneRound?'Wyniki':'Wyniki<br>Tura 1')+playerResultStar(d,1),'resultTile')\n      +(oneRound?'':b('t2','Wyniki<br>Tura 2'+playerResultStar(d,2),'resultTile'))"
    a=rep(a,old,new,'player primary nav')
    old="+b('info','INFO','infoTile')+b('map1','MAPA T1','mapTile')+b('map2','MAPA T2','mapTile')"
    new="+b('info','INFO','infoTile')+b('map1',oneRound?'MAPA':'MAPA T1','mapTile')+(oneRound?'':b('map2','MAPA T2','mapTile'))"
    a=rep(a,old,new,'player map nav')

app.write_text(a,encoding='utf-8')

# Focused regression test file; the existing integration suite is also run by CI.
test_path=Path('tests/competition-rounds-v298.test.cjs')
test_path.write_text(r'''\
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const server=fs.readFileSync('server.cjs','utf8'),app=fs.readFileSync('app.js','utf8');
function extractFunction(name,nextName){const start=server.indexOf('function '+name+'('),end=server.indexOf('\nfunction '+nextName+'(',start);assert.ok(start>=0&&end>start,'cannot extract '+name);return server.slice(start,end)}
test('schema and create API default keep historical/two-round behavior',()=>{assert.match(server,/round_count integer not null default 2/);assert.match(server,/const roundCount = Number\(b\.roundCount\)===1 \? 1 : 2/);assert.match(server,/presence_reminder_note,round_count/)});
test('classification: one-round general equals T1 and two-round still sums T1+T2',()=>{const fn=extractFunction('computeClassification','refreshResultAggregate'),ctx={};vm.runInNewContext(fn+';this.computeClassification=computeClassification;',ctx);const entries=[{user_id:1,first_name:'A',last_name:'One',phone:'',pzw_club:''},{user_id:2,first_name:'B',last_name:'Two',phone:'',pzw_club:''}],draws=[{user_id:1,round:1,stand:1,sector:'A'},{user_id:2,round:1,stand:2,sector:'A'},{user_id:1,round:2,stand:2,sector:'A'},{user_id:2,round:2,stand:1,sector:'A'}],results=[{user_id:1,round:1,weight:1000,big_fish:300},{user_id:2,round:1,weight:500,big_fish:200},{user_id:1,round:2,weight:100,big_fish:50},{user_id:2,round:2,weight:2000,big_fish:900}];const one=ctx.computeClassification({round_count:1,zero_score_rule:'MIN'},entries,draws,results);assert.equal(one.round2.length,0);for(const g of one.general){const r=one.round1.find(x=>x.user_id===g.user_id);assert.equal(g.sum_points,r.points);assert.equal(g.total_weight,r.weight);assert.equal(g.t2_points,null)}const two=ctx.computeClassification({round_count:2,zero_score_rule:'MIN'},entries,draws,results);assert.equal(two.round2.length,2);for(const g of two.general){const r1=two.round1.find(x=>x.user_id===g.user_id),r2=two.round2.find(x=>x.user_id===g.user_id);assert.equal(g.sum_points,r1.points+r2.points);assert.equal(g.total_weight,r1.weight+r2.weight)}});
test('one-round hides T2 UI while full two-round UI remains in code',()=>{assert.match(app,/oneRound\?'Losowanie':'Losowanie<br>Tura 1'/);assert.match(app,/Losowanie<br>Tura 2/);assert.match(app,/oneRound\?'MAPA':'MAPA T1'/);assert.match(app,/Wpisywanie wyników — 1 tura/);assert.match(app,/WYNIKI T2/)});
test('server guards T2 only when round_count is 1',()=>{assert.match(server,/round_count\|\|2\)===1 && Number\(round\)!==1/);assert.match(server,/Zawody 1-turowe mają tylko jedno losowanie/);assert.match(server,/Zawody 1-turowe mają tylko jedną turę wyników/)});
''',encoding='utf-8')
print('V298 patch prepared')
