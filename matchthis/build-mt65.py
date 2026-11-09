from pathlib import Path
import hashlib,re,subprocess
D=Path(__file__).resolve().parent
BASE={
 '':'0ab5e58989bd9fb8bd3b7dc33bd23c6bad2a83f7ad73f5883d3f79b8b2e85cda',
 '_OGLADACZ':'6fac30aa53a17e3948445781de56c4b7604e1beca6ae688b87a03da819aac5a7',
 '_SEDZIA':'30cc66ddbeaec9c26de4446cec40f3ad04e26d7cddc5d54555f3c5b6c5c907a0'
}
def once(s,a,b):
 assert s.count(a)==1,(a[:90],s.count(a))
 return s.replace(a,b,1)
new_funcs='\n// MT-63: sector size editing is explicit and never silently resets a published draw.\nfunction mt65PlanGroups(pegs,sectors,sizes){\n const defaults=mt56BalancedGroups(pegs,sectors);\n if(!Array.isArray(sizes)||sizes.length!==defaults.length||\n    sizes.some(n=>!Number.isInteger(n)||n<1)||sizes.reduce((a,b)=>a+b,0)!==pegs.length)return defaults;\n const sorted=pegs.map(Number).sort((a,b)=>a-b);let offset=0;\n return sizes.map((size,i)=>{const result={sector:String.fromCharCode(65+i),pegs:sorted.slice(offset,offset+size)};offset+=size;return result;});\n}\nfunction mt65SavedGroups(t){\n const p=t?.mt55SectorPlan;\n return p?.pegs?.length?mt65PlanGroups(p.pegs,p.sectors,p.sizes):[];\n}\nfunction mt65SamePlan(plan,pegs,n){\n return Boolean(plan&&plan.sectors===n&&plan.pegs?.length===pegs.length&&plan.pegs.every((v,i)=>v===pegs[i]));\n}\nfunction mt65EditableGroups(e,t,pegs,n){\n const same=mt65SamePlan(t?.mt55SectorPlan,pegs,n);\n return mt65PlanGroups(pegs,n,same?t.mt55SectorPlan.sizes:null);\n}\nfunction mt65SectorEditor(groups,editable){\n return \'<div class="mt56-sector-grid mt65-sector-grid">\'+groups.map((g,index)=>\n  \'<div class="mt56-sector-box"><strong>Sektor \'+escapeHtml(g.sector)+\'</strong><span>\'+escapeHtml(mt56Range(g.pegs))+\'</span>\'+\n  \'<label class="mt65-sector-control">Stanowisk <input type="number" inputmode="numeric" min="1" step="1" data-mt65-sector-index="\'+index+\'" aria-label="Liczba stanowisk w sektorze \'+escapeHtml(g.sector)+\'" value="\'+g.pegs.length+\'" \'+(editable?\'\':\'disabled title="Najpierw ukryj publikację lub odblokuj turę"\')+\'></label></div>\'\n ).join(\'\')+\'</div><p class="mt65-tip">Po zmianie liczby i opuszczeniu pola zapis jest automatyczny. Początek każdego następnego sektora przesuwa się sam. Ostatni sektor wyrównuje łączną liczbę stanowisk; zmiana ostatniego wyrównuje przedostatni.</p>\';\n}\nfunction mt65SaveSectorSize(el){\n const {e,t}=mt55Tour();if(!mt55Writable(e,t))throw Error(\'Edycja sektora niedostępna dla tej tury.\');\n if(t.drawPublished)throw Error(\'Losowanie jest opublikowane. Najpierw użyj „Ukryj losowanie”; nie zmieniam opublikowanych przydziałów.\');\n const pegs=parsePegs(),n=Number(document.getElementById(\'sectors\')?.value);\n mt62RequireExactStations(e,pegs);\n const groups=mt65EditableGroups(e,t,pegs,n), index=Number(el.dataset.mt65SectorIndex),count=Number(el.value);\n if(!Number.isInteger(index)||index<0||index>=groups.length)throw Error(\'Nieprawidłowy sektor.\');\n if(!Number.isSafeInteger(count)||count<1)throw Error(\'Sektor musi mieć co najmniej jedno stanowisko.\');\n if(groups.length<2&&count!==pegs.length)throw Error(\'Jeden sektor musi zawierać wszystkie stanowiska.\');\n const sizes=groups.map(g=>g.pegs.length),change=count-sizes[index];\n if(!change&&mt65SamePlan(t.mt55SectorPlan,pegs,n))return;\n const compensator=index===sizes.length-1?index-1:sizes.length-1;\n if(compensator>=0&&change){sizes[index]=count;sizes[compensator]-=change;}\n if(sizes.some(x=>x<1))throw Error(\'Nie wystarczy stanowisk dla pozostałych sektorów. Zmniejsz wpisaną liczbę.\');\n const updated=mt65PlanGroups(pegs,n,sizes),map=new Map(updated.flatMap(g=>g.pegs.map(p=>[p,g.sector])));\n const entries=mt55Entries(e,t);\n for(const r of entries){\n  if(r.peg!=null&&!map.has(Number(r.peg)))throw Error(\'Stanowisko \'+r.peg+\' jest poza nowym zakresem. Najpierw popraw przydział.\');\n  if((t.results||[]).some(x=>String(x.competitorId)===String(r.competitorId))&&r.sector!==map.get(Number(r.peg)))\n    throw Error(\'Nie zmieniam sektora zawodnika z zapisanym wynikiem.\');\n  if(r.weightG!==null&&r.weightG!==undefined&&r.peg!=null&&r.sector!==map.get(Number(r.peg)))\n    throw Error(\'Nie zmieniam sektora zawodnika z zapisaną wagą.\');\n }\n const oldPlan=t.mt55SectorPlan,oldEntries=t.mt55Entries;\n t.mt55SectorPlan={pegs:pegs.slice(),sectors:n,sizes:sizes.slice()};\n t.mt55Entries=entries.map(r=>({...r,sector:r.peg==null?null:map.get(Number(r.peg))}));\n if(!save()){t.mt55SectorPlan=oldPlan;t.mt55Entries=oldEntries;throw Error(\'Nie udało się trwale zapisać podziału sektorów.\');}\n render();alertMsg(\'Podział zapisany: \'+updated.map(g=>g.sector+\' \'+mt56Range(g.pegs)).join(\' · \'),true);\n}\nfunction mt65DrawRosterImage(canvas,e){\n const people=(e.entrantIds||[]).map(findPlayer).filter(p=>p&&!p.isReservation);\n if(!people.length||people.length>180)throw Error(\'Lista musi mieć od 1 do 180 pozycji.\');\n const W=2160,H=2700,ctx=canvas.getContext(\'2d\');\n canvas.width=W;canvas.height=H;\n const dark=\'#252c35\',orange=\'#e96609\',muted=\'#6c7682\',line=\'#dce2e8\';\n ctx.fillStyle=\'#ffffff\';ctx.fillRect(0,0,W,H);\n ctx.fillStyle=dark;ctx.fillRect(0,0,W,172);\n ctx.fillStyle=\'#ffffff\';ctx.font=\'900 81px Arial, sans-serif\';ctx.fillText(\'MATCH\',96,112);\n const mw=ctx.measureText(\'MATCH\').width;\n ctx.fillStyle=orange;ctx.fillText(\'THIS\',96+mw,112);\n ctx.textAlign=\'right\';ctx.fillStyle=\'#cbd2dc\';ctx.font=\'bold 34px Arial, sans-serif\';ctx.fillText(\'LISTA STARTOWA\',W-95,95);ctx.textAlign=\'left\';\n ctx.fillStyle=orange;ctx.fillRect(96,218,90,9);\n ctx.fillStyle=dark;ctx.font=\'900 58px Arial, sans-serif\';ctx.fillText(\'LISTA ZAWODNIKÓW\',96,300);\n const name=String(e.name||\'Zawody\');\n let size=44;ctx.font=\'800 \'+size+\'px Arial, sans-serif\';\n const maxNameWidth=W-192;\n while(ctx.measureText(name).width>maxNameWidth&&size>29){size-=1;ctx.font=\'800 \'+size+\'px Arial, sans-serif\';}\n let titleY=372;\n if(ctx.measureText(name).width<=maxNameWidth)ctx.fillText(name,96,titleY);\n else {\n  const words=name.split(\' \');const lines=[];let cur=\'\';\n  for(const word of words){const next=cur?cur+\' \'+word:word;\n   if(cur&&ctx.measureText(next).width>maxNameWidth){lines.push(cur);cur=word;}else cur=next;}\n  if(cur)lines.push(cur);\n  for(let i=0;i<Math.min(lines.length,3);i++)ctx.fillText(lines[i],96,titleY+i*51);\n  titleY+=Math.min(lines.length,3)*51-51;\n }\n const status={valid:mt63Players(e).length,yes:mt63Confirmed(e).length,no:mt63Players(e).length-mt63Confirmed(e).length};\n const date=entityDateLabel(e);\n ctx.font=\'bold 32px Arial, sans-serif\';ctx.fillStyle=muted;\n ctx.fillText(date+\'    •    \'+status.valid+\' zawodników    •    \'+status.yes+\' potwierdzonych    •    \'+status.no+\' niepotwierdzonych\',96,titleY+64);\n const headerY=Math.max(510,titleY+105);\n const columns=people.length>39?2:1,rows=Math.ceil(people.length/columns),gap=46,left=96,right=96,\n       cw=(W-left-right-gap*(columns-1))/columns;\n const top=headerY+100,bottom=2520,rowHeight=Math.min(55,(bottom-top)/Math.max(1,rows));\n for(let c=0;c<columns;c++){\n  const x=left+c*(cw+gap);\n  ctx.fillStyle=dark;ctx.fillRect(x,headerY,cw,76);\n  ctx.fillStyle=\'#ffffff\';ctx.font=\'800 27px Arial, sans-serif\';\n  ctx.fillText(\'LP.\',x+14,headerY+48);ctx.fillText(\'ZAWODNIK\',x+92,headerY+48);\n  ctx.textAlign=\'right\';ctx.fillText(\'POTWIERDZENIE\',x+cw-14,headerY+48);ctx.textAlign=\'left\';\n }\n for(let i=0;i<people.length;i++){\n  const col=Math.floor(i/rows),pos=i%rows,p=people[i];const x=left+col*(cw+gap),y=top+pos*rowHeight;\n  ctx.fillStyle=i%2===0?\'#fafbfd\':\'#f0f3f7\';ctx.fillRect(x,y,cw,rowHeight-2);\n  ctx.fillStyle=line;ctx.fillRect(x,y+rowHeight-2,cw,2);\n  ctx.fillStyle=muted;ctx.font=\'bold 24px Arial, sans-serif\';ctx.fillText(String(i+1).padStart(2,\'0\'),x+16,y+rowHeight*.67);\n  const label=mt52CleanName(fullName(p));\n  let fs=27;ctx.font=\'bold \'+fs+\'px Arial, sans-serif\';\n  const nameMax=cw-356;\n  while(ctx.measureText(label).width>nameMax&&fs>18){fs--;ctx.font=\'bold \'+fs+\'px Arial, sans-serif\';}\n  ctx.fillStyle=dark;ctx.fillText(label,x+91,y+rowHeight*.67);\n  const ok=e.mt63ConfirmedIds?.includes(p.id)===true;\n  const state=p.isReservation?\'REZERWACJA\':(ok?\'POTWIERDZONY\':\'NIEPOTWIERDZONY\');\n  ctx.textAlign=\'right\';ctx.fillStyle=p.isReservation?muted:(ok?\'#26774b\':\'#aa4d15\');\n  ctx.font=\'bold 19px Arial, sans-serif\';ctx.fillText(state,x+cw-14,y+rowHeight*.67);ctx.textAlign=\'left\';\n }\n ctx.fillStyle=orange;ctx.fillRect(96,2583,W-192,5);\n ctx.font=\'27px Arial, sans-serif\';ctx.fillStyle=muted;ctx.fillText(\'MatchThis • Status zapisów według aktualnej listy startowej\',96,2635);\n ctx.textAlign=\'right\';ctx.fillText(\'JEDNA STRONA  •  2160 × 2700 px\',W-96,2635);ctx.textAlign=\'left\';\n}\nfunction mt65DownloadRoster(){\n requireAdmin();const e=current();if(!e||page!==\'event\')throw Error(\'Otwórz listę startową zawodów.\');\n const canvas=document.createElement(\'canvas\');mt65DrawRosterImage(canvas,e);\n canvas.toBlob(blob=>{\n  if(!blob){alertMsg(\'Nie udało się przygotować obrazu listy.\');return;}\n  downloadBlob(blob,\'MatchThis_\'+safeFilePart(e.name)+\'_LISTA_STARTOWA_FB.png\');\n },\'image/png\');\n}\n'
extra_css='<style id="mt65-roster-sector-styles">\n.mt65-sector-grid .mt56-sector-box{min-width:0}\n.mt65-sector-control{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:5px;font-size:12px;color:#56606a;font-weight:600}\n.mt65-sector-control input{width:72px;max-width:72px;height:32px;min-width:0;padding:2px 6px;border:1px solid #b7c1cc;border-radius:4px;text-align:center;appearance:textfield;-moz-appearance:textfield;font-weight:700;color:#252c35;background:#fff}\n.mt65-sector-control input::-webkit-inner-spin-button,.mt65-sector-control input::-webkit-outer-spin-button{-webkit-appearance:none;margin:0}\n.mt65-tip{font-size:12px;color:#5e6874;margin:8px 2px}\n.mt65-alert{background:#fff3e7;border-left:4px solid #e96609;padding:9px 12px;margin:8px 0;font-size:13px}\n.mt65-roster-confirmed{font-size:11px;color:#196b3e;font-weight:700;display:inline-block}\n.mt65-roster-unconfirmed{font-size:11px;color:#a54a14;font-weight:700;display:inline-block}\n.mt65-status-toggle{font-size:11px!important;white-space:nowrap}\n.mt65-roster-buttons{display:flex;flex-wrap:wrap;gap:8px}\n</style>'

for suffix,sha in BASE.items():
 previous=(D/f'MatchThis_MT-64{suffix}.html').read_text('utf8')
 assert hashlib.sha256(previous.encode()).hexdigest()==sha,(suffix,'MT64 baseline mismatch')
 s=previous
 old_archive={}
 for key in ('MATCHTHIS_ARCHIVE_2026','MATCHTHIS_STANDALONE_2026','MATCHTHIS_ARCHIVE_2025_MEGA_V','MATCHTHIS_ARCHIVE_2025_MAVER_OCT','MT44_MISSING_2025','MT44_MEGA_2025','MT45_MEGA_2025_ROUNDS','MT46_PUCHAR_ROUND1_DRAW','MT47_PUCHAR_ROUND2_DRAW','MT48_FLOAT_ROUND2_DRAW'):
  old_archive[key]=s.split('const '+key+'=',1)[1].split(';\n',1)[0]
 s=s.replace('</head>',extra_css+'\n</head>',1)
 for a,b in (
  ('<title>MatchThis MT-64</title>','<title>MatchThis MT-65</title>'),
  ('data-version="MT-64"','data-version="MT-65"'),
  ('aria-label="Wersja MT-64">MT-64','aria-label="Wersja MT-65">MT-65'),
  ('<div class="version" id="appversion">MT-64</div>','<div class="version" id="appversion">MT-65</div>'),
  ("const APP_VERSION='MT-64';","const APP_VERSION='MT-65';"),
  ("const STORAGE_KEY='matchthis-preview-MT-64';","const STORAGE_KEY='matchthis-preview-MT-65';\nconst MT64_STORAGE_KEY='matchthis-preview-MT-64';"),
 ):
  s=once(s,a,b)
 if 'localStorage.getItem(MT63_STORAGE_KEY)||' in s:
  s=once(s,'localStorage.getItem(MT63_STORAGE_KEY)||','localStorage.getItem(MT64_STORAGE_KEY)||localStorage.getItem(MT63_STORAGE_KEY)||')
 s=s.replace("console.error('MatchThis MT-64:","console.error('MatchThis MT-65:")
 s=s.replace("console.warn('MatchThis MT-64:","console.warn('MatchThis MT-65:")
 s=once(s,'function mt55Tour(){',new_funcs+'\nfunction mt55Tour(){')
 s=once(s,'function mt55PegMap(t){\n if(!t.mt55SectorPlan?.pegs?.length)return new Map();\n return new Map(mt56BalancedGroups(t.mt55SectorPlan.pegs,t.mt55SectorPlan.sectors)',
  'function mt55PegMap(t){\n if(!t.mt55SectorPlan?.pegs?.length)return new Map();\n return new Map(mt65SavedGroups(t)')
 s=once(s,'const groups=mt56BalancedGroups(plan.pegs,plan.sectors);\n return mt56GroupsHtml(groups);',
  'const groups=mt65SavedGroups(t);\n return mt65SectorEditor(groups,false);')
 s=once(s,'const groups=t.mt55SectorPlan?.pegs?.length?mt56BalancedGroups(t.mt55SectorPlan.pegs,t.mt55SectorPlan.sectors):[];',
  'const groups=mt65SavedGroups(t);')
 s=once(s,'const groups=mt56BalancedGroups(tour.mt55SectorPlan.pegs,tour.mt55SectorPlan.sectors);',
  'const groups=mt65SavedGroups(tour);')
 s=once(s,'''  const groups=mt56BalancedGroups(pegs,n);
  const tour=mt55Tour().t,stored=tour?.mt55SectorPlan;
  const same=stored?.sectors===n&&stored.pegs?.length===pegs.length&&stored.pegs.every((v,i)=>v===pegs[i]);
  target.innerHTML='<strong class="mt56-caption">'+(same?'Zapisany podział sektorów':'Podgląd podziału — kliknij „Ustal sektory”, aby zapisać')+'</strong>'+mt56GroupsHtml(groups);''',
  '''  const tour=mt55Tour().t,stored=tour?.mt55SectorPlan;
  const same=mt65SamePlan(stored,pegs,n),groups=mt65EditableGroups(mt55Tour().e,tour,pegs,n);
  target.innerHTML='<strong class="mt56-caption">'+(same?'Zapisany podział sektorów':'Podgląd podziału — edycja liczby stanowisk zapisze nowy plan')+'</strong>'+mt65SectorEditor(groups,!tour.drawPublished);''')
 s=once(s,'const groups=mt55CheckPlan(pegs,n),map=new Map(groups.flatMap(g=>g.pegs.map(p=>[p,g.sector])));',
  "if(t.drawPublished)throw Error('Najpierw ukryj opublikowane losowanie; nie zmieniam publicznych przydziałów.');\n const groups=mt65EditableGroups(e,t,pegs,n),map=new Map(groups.flatMap(g=>g.pegs.map(p=>[p,g.sector])));")
 s=once(s,'t.mt55SectorPlan={pegs:pegs.slice(),sectors:n};t.mt55Entries=entries;',
  't.mt55SectorPlan={pegs:pegs.slice(),sectors:n,sizes:groups.map(g=>g.pegs.length)};t.mt55Entries=entries;')
 s=once(s,"document.getElementById('drawInfo').innerHTML='<strong class=\"mt56-caption\">Zapisany podział sektorów</strong>'+mt56GroupsHtml(groups);",
  "document.getElementById('drawInfo').innerHTML='<strong class=\"mt56-caption\">Zapisany podział sektorów</strong>'+mt65SectorEditor(groups,true);")
 s=once(s,'const groups=mt55CheckPlan(pegs,n),sectors=new Map(groups.flatMap(g=>g.pegs.map(p=>[p,g.sector])));',
  'const groups=mt65EditableGroups(e,t,pegs,n),sectors=new Map(groups.flatMap(g=>g.pegs.map(p=>[p,g.sector])));')
 s=once(s,'t.mt55SectorPlan={pegs:pegs.slice(),sectors:n};t.mt55Entries=drawn.map',
  't.mt55SectorPlan={pegs:pegs.slice(),sectors:n,sizes:groups.map(g=>g.pegs.length)};t.mt55Entries=drawn.map')
 s=once(s,'''${mt55SectorInfo(e,t)||'Podział nieustalony — wpisz zakres stanowisk i liczbę sektorów.'}''',
  '''${t.mt55SectorPlan?.pegs?.length&&t.mt55SectorPlan.pegs.length!==mt62EligibleCount(e)?'<div class="mt65-alert">Wcześniejszy zapisany plan: '+t.mt55SectorPlan.pegs.length+' stanowiska, a do losowania jest '+mt62EligibleCount(e)+' potwierdzonych. Proponowany poprawny zakres nie jest jeszcze zapisany. Opublikowane przydziały nie zostały zmienione.</div>':''}${mt65InitialPreview(e,t)}''')
 # Existing MT64 mt63DrawRange preserves already allocated plan; only show new eligible range in proposed input, with warning.
 old='if(assigned&&t.mt55SectorPlan?.pegs?.length)return mt55CompactPegs(t.mt55SectorPlan.pegs);'
 new='if(assigned&&t.mt55SectorPlan?.pegs?.length===mt62EligibleCount(e))return mt55CompactPegs(t.mt55SectorPlan.pegs);'
 s=once(s,old,new)
 # Preserve MT64 roster data and button; only add FB export action.
 s=once(s,'<button class="btn small" data-action="choosePlayers">Wybierz zawodników z bazy</button>',
  '<button class="btn small" data-action="choosePlayers">Wybierz zawodników z bazy</button><button class="btn small" data-action="mt65DownloadRoster">Pobierz listę FB · pion 2160 × 2700 PNG</button>')
 s=once(s,"'mt55ResetDraw','mt52AddReservation'","'mt55ResetDraw','mt65DownloadRoster','mt52AddReservation'")
 s=once(s,"case 'downloadFbPhoto':downloadFbPhoto();break;","case 'mt65DownloadRoster':mt65DownloadRoster();break;case 'downloadFbPhoto':downloadFbPhoto();break;")
 s=once(s,"document.addEventListener('focusout',mt55HandleAutoSave);",'''document.addEventListener('focusout',mt55HandleAutoSave);
document.addEventListener('change',event=>{
 const f=event.target.closest?.('[data-mt65-sector-index]');if(!f)return;
 try{mt65SaveSectorSize(f);}catch(error){alertMsg(error.message);render();}
});''')
 initial=r'''function mt65InitialPreview(e,t){
 const eligible=mt62EligibleCount(e),plan=t.mt55SectorPlan;
 if(plan?.pegs?.length===eligible)return mt65SectorEditor(mt65SavedGroups(t),!t.drawPublished);
 if(!eligible)return 'Najpierw potwierdź zawodników na liście startowej.';
 const pegs=Array.from({length:eligible},(_,i)=>i+1),n=Math.max(1,Number(plan?.sectors||2));
 return '<strong class="mt56-caption">Proponowany podział dla '+eligible+' potwierdzonych — nie zapisano</strong>'+mt65SectorEditor(mt56BalancedGroups(pegs,n),!t.drawPublished);
}
'''
 s=once(s,'function mt65SaveSectorSize(el){',initial+'function mt65SaveSectorSize(el){')
 for key,original in old_archive.items():
  assert s.split('const '+key+'=',1)[1].split(';\n',1)[0]==original,(suffix,key)
 for token in ('<title>MatchThis MT-65</title>',"const APP_VERSION='MT-65'",'data-version="MT-65"','aria-label="Wersja MT-65">MT-65'):
  assert token in s,(suffix,token)
 for script in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S):
  if script.strip():
   p=D/'_mt65_check.js';p.write_text(script);subprocess.run(['node','--check',str(p)],check=True);p.unlink()
 out=D/f'MatchThis_MT-65{suffix}.html';out.write_text(s,'utf8')
 print('MT65_BUILT',suffix,hashlib.sha256(s.encode()).hexdigest(),len(s))
