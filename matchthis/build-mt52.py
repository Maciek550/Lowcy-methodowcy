from pathlib import Path
import json,re,unicodedata
root=Path(__file__).resolve().parent
rows=[]
for line in (root/'mt52_xiv_puchar_2026_startowa.txt').read_text(encoding='utf8').splitlines():
 n,name=line.split('|',1)
 assert int(n)==len(rows)+1
 assert name==name.strip().rstrip('.') and len(name)>2
 rows.append(name)
assert len(rows)==72 and rows[70]=='REZERWACJA' and len(set(rows))==72
SOURCE=json.dumps(rows,ensure_ascii=False,separators=(',',':'))
IMPORTED=r"""
// MT-52: sourced list of 72 registration slots, item 71 is REZERWACJA.
// Never reset an existing user's list or recreate a replacement on refresh.
const MT52_XIV_NAMES=__ROSTER_JSON__;
function mt52CleanName(name){return String(name||'').trim().replace(/\.+\s*$/,'').trim();}
function mt52IsXiv(e){
 const n=String(e?.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\s+/g,' ');
 return Number(e?.year)===2026&&/XIV\s+PUCHAR/.test(n)&&/MATCH\s*THIS/.test(n)&&
   (/28\s*[-./]\s*29/.test(n)||e.date==='2026-11-28'||(e.rounds||[]).some(t=>t.date==='2026-11-28'));
}
function mt52Placeholder(event){
 const id='mt52-reservation-'+event.id;
 let p=findPlayer(id);
 if(!p){p={id,firstName:'',lastName:'REZERWACJA',club:'',isReservation:true,archived:false};db.players.push(p);}
 return p;
}
function mt52ResolvePerson(label,existing){
 const clean=mt52CleanName(label),key=norm(clean);
 const matches=db.players.filter(p=>!p.isReservation&&!p.archived&&
  (norm(fullName(p))===key||(p.aliases||[]).some(a=>norm(mt52CleanName(a))===key)));
 const prior=matches.filter(p=>(existing.entrantIds||[]).includes(p.id));
 if(prior.length===1)return prior[0];
 if(matches.length===1)return matches[0];
 if(matches.length>1){
  // Do not randomly join ambiguous records: create a separate flagged person.
  const already=matches.find(p=>p.source==='XIV Puchar MatchThis 28-29.11.2026: do weryfikacji');
  if(already)return already;
 }
 const cut=clean.lastIndexOf(' ');if(cut<1)throw Error('Nieprawidłowe nazwisko: '+clean);
 const player={id:uid(),lastName:clean.slice(0,cut),firstName:clean.slice(cut+1),club:'',archived:false,
    source:'XIV Puchar MatchThis 28-29.11.2026'+(matches.length?': do weryfikacji':''),
    ...(matches.length?{nameNeedsReview:true}:{})};
 db.players.push(player);return player;
}
function mt52ImportXivRoster(){
 if(MT52_XIV_NAMES.length!==72||MT52_XIV_NAMES[70]!=='REZERWACJA'||new Set(MT52_XIV_NAMES.map(norm)).size!==72)return false;
 const candidates=db.events.filter(mt52IsXiv);
 if(candidates.length>1){console.warn('MT52: więcej niż jedne zawody XIV Puchar. Import nie został wykonany.');return false;}
 let e=candidates[0],created=false;
 if(!e){
  e={id:'mt2026-xiv-puchar-matchthis-28-29-nov',name:'XIV PUCHAR SKLEPU MatchThis.pl 28-29.11.2026r – Kanał Żerański ALEKSANDRÓW',
     kind:'EVENT',year:2026,date:'2026-11-28',archived:false,entrantIds:[],
     rounds:[{id:'mt52-xiv-t1',name:'Tura 1',date:'2026-11-28',status:'DRAFT',results:[]},
             {id:'mt52-xiv-t2',name:'Tura 2',date:'2026-11-29',status:'DRAFT',results:[]}]};
  db.events.push(e);created=true;
 }
 // Respect already imported/edited registration; in particular a replaced reservation.
 if(e.mt52RosterImported===true)return false;
 if((e.rounds||[]).length!==2){console.warn('MT52: istniejące zawody mają inną liczbę tur; lista nie nadpisana');return false;}
 if(e.rounds.some(r=>(r.results||[]).length>0)){console.warn('MT52: istniejące wyniki — nie ingeruję w listę startową');return false;}
 const expected=[];
 for(const label of MT52_XIV_NAMES){
  const p=label==='REZERWACJA'?mt52Placeholder(e):mt52ResolvePerson(label,e);
  if(expected.includes(p.id)){console.warn('MT52: niejednoznaczne przypisanie nazwiska',label);return false;}
  expected.push(p.id);
 }
 // Keep any user-added registrations intact, even when they are not in the source list.
 const existing=e.entrantIds||[];
 const extras=existing.filter(id=>!expected.includes(id));
 e.entrantIds=[...expected,...extras];
 if(!e.date)e.date='2026-11-28';
 if(!e.rounds[0].date)e.rounds[0].date='2026-11-28';
 if(!e.rounds[1].date)e.rounds[1].date='2026-11-29';
 e.mt52RosterImported=true;
 e.mt52Source='Lista 72 pozycji od organizatora, 8.11.2026, REZERWACJA na pozycji 71';
 save();
 return created?'created':'merged';
}
mt52ImportXivRoster();
"""
ROSTER=r"""
function mt52DrawSafeNames(e){
 return (e.entrantIds||[]).map(findPlayer).filter(p=>p&&!p.isReservation).map(fullName).join('\n');
}
function mt52AddReservation(){
 requireAdmin();const e=current();
 if(page!=='event'||!e||e.archived)throw Error('Rezerwacja może być dodana tylko do aktywnych zawodów');
 const p={id:uid(),firstName:'',lastName:'REZERWACJA',club:'',isReservation:true,archived:false};
 db.players.push(p);e.entrantIds=e.entrantIds||[];e.entrantIds.push(p.id);
 const stored=save();render();alertMsg(stored?'Dodano REZERWACJĘ do listy startowej':'Dodano do pamięci karty. Zabezpiecz zapis przed zamknięciem.',stored);
}
function mt52ReplaceReservation(e){
 e.preventDefault();requireAdmin();
 const f=e.target,event=current(),id=f.dataset.reservationId;
 if(!event||page!=='event'||!id)throw Error('Wybierz zawody i rezerwację');
 const index=(event.entrantIds||[]).indexOf(id),res=findPlayer(id);
 if(index<0||!res?.isReservation)throw Error('Nie znaleziono aktywnej rezerwacji');
 if(getRounds(event).some(t=>(t.results||[]).some(r=>r.competitorId===id)))throw Error('Rezerwacja ma już wyniki — najpierw rozstrzygnij przydział');
 const chosen=f.elements.existingPlayerId.value;
 let person=null;
 if(chosen){
  person=findPlayer(chosen);
  if(!person||person.isReservation||person.archived)throw Error('Wybierz aktywnego zawodnika z bazy');
 }else{
  const lastName=mt52CleanName(f.elements.lastName.value),firstName=mt52CleanName(f.elements.firstName.value);
  if(!lastName||!firstName||lastName.length>100||firstName.length>90)throw Error('Wpisz nazwisko i imię nowego zawodnika albo wybierz z bazy');
  const found=activePlayers().filter(p=>norm(fullName(p))===norm(lastName+' '+firstName));
  if(found.length>1)throw Error('W bazie jest kilka osób o tych danych. Wybierz właściwą z listy.');
  person=found[0]||{id:uid(),lastName,firstName,club:'',archived:false};
  if(!found.length)db.players.push(person);
 }
 if((event.entrantIds||[]).includes(person.id))throw Error('Ten zawodnik jest już wpisany do tych zawodów');
 event.entrantIds[index]=person.id;replaceReservationId=null;
 // Source reservation is event-specific; never remove historical results.
 if(!db.events.some(x=>(x.entrantIds||[]).includes(id))&&!db.cycles.some(x=>(x.entrantIds||[]).includes(id)))db.players=db.players.filter(p=>p.id!==id);
 const stored=save();render();
 alertMsg(stored?'Rezerwacja zastąpiona: '+fullName(person):'Zmiana w pamięci karty — wykonaj eksport przed zamknięciem',stored);
}
function mt52ReservationForm(id,event){
 const present=new Set(event.entrantIds||[]);
 const options=activePlayers().filter(p=>!present.has(p.id)).sort((a,b)=>fullName(a).localeCompare(fullName(b),'pl'));
 return '<form id="mt52ReplaceReservation" data-reservation-id="'+escapeHtml(id)+'" class="panel" style="margin:8px 0;padding:12px">'+
 '<h3>Obsadź miejsce REZERWACJA</h3>'+
 '<label>Wybierz zawodnika z bazy<select name="existingPlayerId"><option value="">— lub wpisz nowego poniżej —</option>'+
 options.map(p=>'<option value="'+escapeHtml(p.id)+'">'+safeName(mt52CleanName(fullName(p)))+'</option>').join('')+'</select></label>'+
 '<div class="grid"><label>Nazwisko nowego zawodnika<input name="lastName" maxlength="100"></label>'+
 '<label>Imię nowego zawodnika<input name="firstName" maxlength="90"></label></div>'+
 '<div class="row"><button class="btn small" type="submit">Zastąp REZERWACJĘ</button><button class="btn small secondary" type="button" data-action="mt52CancelReplace">Anuluj</button></div></form>';
}
function renderRosterView(e,t){
 const sourceOrder=Boolean(e.mt52RosterImported);
 const entrants=(e.entrantIds||[]).map(findPlayer).filter(Boolean);
 if(!sourceOrder)entrants.sort((a,b)=>String(a.lastName).localeCompare(String(b.lastName),'pl'));
 const canEdit=roleMode==='admin'&&page==='event'&&!e.archived;
 const reserveCount=entrants.filter(p=>p.isReservation).length;
 return '<section class="panel noprint"><div class="result-title"><h2>Lista startowa — '+safeName(e.name)+' · '+safeName(entityDateLabel(e))+'</h2>'+
 (roleMode==='admin'?'<div class="row"><button class="btn small" data-action="choosePlayers">Wybierz zawodników z bazy</button>'+
 (canEdit?'<button class="btn small secondary" data-action="mt52AddReservation">+ REZERWACJA</button>':'')+'</div>':'')+'</div>'+
 '<p class="sub">'+entrants.length+' pozycji · '+(entrants.length-reserveCount)+' zawodników · '+reserveCount+' rezerwacji. Rezerwacja nie jest wynikiem ani zawodnikiem w bazie.</p>'+
 (entrants.length?'<div class="tablewrap"><table><thead><tr><th>LP</th><th>Zawodnik</th><th>Akcja</th></tr></thead><tbody>'+
 entrants.map((p,i)=>'<tr'+(p.isReservation?' class="mt52-reservation"':'')+'><td>'+(i+1)+'</td><td>'+
 '<strong>'+safeName(mt52CleanName(fullName(p)))+'</strong>'+
 (p.nameNeedsReview?'<small class="review-name">Potwierdź zapis nazwiska</small>':'')+
 '</td><td>'+(canEdit?(p.isReservation?
 '<button class="btn small" type="button" data-replace-reservation="'+escapeHtml(p.id)+'">Zastąp zawodnikiem</button>':
 '<button class="btn small secondary" type="button" data-remove-entrant="'+escapeHtml(p.id)+'">Usuń z listy</button>'):'—')+
 '</td></tr>').join('')+'</tbody></table></div>':'<p>Brak uczestników. Możesz wybrać ich z bazy.</p>')+
 (canEdit&&replaceReservationId?mt52ReservationForm(replaceReservationId,e):'')+'</section>';
}
"""
for suffix in ('','_SEDZIA','_OGLADACZ'):
 original=(root/f'MatchThis_MT-51{suffix}.html').read_text(encoding='utf8')
 s=original.replace('MT-51','MT-52')
 if suffix!='_OGLADACZ':
  anchor="const MT50_STORAGE_KEY='matchthis-preview-MT-50';"
  assert s.count(anchor)==1,(suffix,'storage key')
  s=s.replace(anchor,"const MT51_STORAGE_KEY='matchthis-preview-MT-51';\n"+anchor)
  anchor="localStorage.getItem(MT50_STORAGE_KEY)||"
  assert s.count(anchor)==1,(suffix,'migration fallback')
  s=s.replace(anchor,"localStorage.getItem(MT51_STORAGE_KEY)||"+anchor)
 anchor="let selectedPlayerIds=new Set(),playerFilter='',rosterTarget='',editingPlayerId=null,profilePlayerId=null,includeArchivedPlayers=false;"
 assert s.count(anchor)==1
 s=s.replace(anchor,anchor+"\nlet replaceReservationId=null;")
 marker="mt48ApplyFloatKingRoundTwoDraw();"
 assert s.count(marker)==1
 s=s.replace(marker,marker+"\n"+IMPORTED.replace('__ROSTER_JSON__',SOURCE)+"\n")
 anchor="function activePlayers(){return db.players.filter(p=>!p.archived)}"
 assert s.count(anchor)==1
 s=s.replace(anchor,"function activePlayers(){return db.players.filter(p=>!p.archived&&!p.isReservation)}")
 anchor="return db.players.filter(p=>(includeArchivedPlayers||!p.archived)&&(!query||"
 assert s.count(anchor)==1
 s=s.replace(anchor,"return db.players.filter(p=>!p.isReservation&&(includeArchivedPlayers||!p.archived)&&(!query||")
 a=s.index('function renderRosterView(e,t){')
 b=s.index('\nfunction renderDrawView(e,t){',a)
 s=s[:a]+ROSTER+s[b:]
 anchor="const entrants=(e.entrantIds||[]).map(findPlayer).filter(Boolean),rosterNames=entrants.map(fullName).join('\\n');"
 assert s.count(anchor)==1
 s=s.replace(anchor,"const rosterNames=mt52DrawSafeNames(e);")
 anchor="if(!nameLines.length)throw new Error('Podaj zawodników do losowania');"
 assert s.count(anchor)==1
 s=s.replace(anchor,anchor+"if(nameLines.some(n=>norm(n)==='rezerwacja'))throw new Error('Zastąp REZERWACJĘ prawdziwym zawodnikiem przed losowaniem');")
 anchor="if(e.target.id==='playerForm')formPlayer(e)"
 assert s.count(anchor)==1
 s=s.replace(anchor,anchor+";if(e.target.id==='mt52ReplaceReservation')mt52ReplaceReservation(e)")
 anchor="document.addEventListener('click',e=>{const fold=e.target.closest('summary');"
 assert s.count(anchor)==1
 s=s.replace(anchor,
  "document.addEventListener('click',e=>{const b=e.target.closest('[data-replace-reservation]');if(!b)return;try{requireAdmin();replaceReservationId=b.dataset.replaceReservation;render();}catch(err){alertMsg(err.message)}});\n"+anchor)
 anchor="case 'choosePlayers':{rosterTarget=selectedId;page='players';render();break}"
 assert s.count(anchor)==1
 s=s.replace(anchor,anchor+
  "case 'mt52AddReservation':mt52AddReservation();break;case 'mt52CancelReplace':replaceReservationId=null;render();break;")
 anchor="const adminOnlyActions=new Set(["
 assert s.count(anchor)==1
 s=s.replace(anchor,anchor+"'mt52AddReservation','mt52CancelReplace',")
 s=s.replace("mt52ImportXivRoster();\n","mt52ImportXivRoster();\n")
 for marker in ('<title>MatchThis MT-52</title>','aria-label="Wersja MT-52">MT-52','data-version="MT-52"', "const APP_VERSION='MT-52'"):
  assert marker in s,(suffix,marker)
 assert s.count("function renderRosterView(e,t){")==1
 assert s.count("function mt52ImportXivRoster(){")==1
 out=root/f'MatchThis_MT-52{suffix}.html'
 out.write_text(s,encoding='utf8')
 print('MT52_BUILT',out.name,len(s))
print('MT52_LIST',len(rows),'RESERVATION_POSITION',rows.index('REZERWACJA')+1,'NO_TERMINAL_DOTS',True)
