from pathlib import Path
import hashlib,re,subprocess
D=Path(__file__).resolve().parent
ROOT=D
BASE={
 '':'4bc7ec955026494834a5c50f81b8d8d5f3d2b4ec5d30c85a2b24bc0fec98f20d',
 '_OGLADACZ':'128297bcc88deb7fbeb1aa24d3ddbc37a0d8c84feb673a19e1b47ecf8b0b19b5',
 '_SEDZIA':'5cf53b163654849b7bfe89c709d837f58a033224807ca2fd9793196e35724d1f'
}
def once(s,a,b):
 c=s.count(a)
 assert c==1,('anchor',a[:120],c)
 return s.replace(a,b,1)

css='''<style id="mt67-draw-fb">
.mt67-draw-export{margin:12px 0;padding:13px 15px;border:1px solid #d9dfe5;border-left:4px solid #e96609;background:#fffaf4;border-radius:5px}
.mt67-draw-export h3{margin:0 0 5px;font-size:16px}
.mt67-draw-export .mt67-action{background:#e96609;border:1px solid #d25800;color:#fff;font-weight:800;padding:9px 13px;border-radius:4px;cursor:pointer;min-height:35px}
.mt67-draw-export .mt67-action[disabled]{opacity:.6;cursor:progress}
.mt67-draw-export .smallprint{margin:6px 0 10px}
.mt67-draw-export .mt67-pickers{display:flex;flex-wrap:wrap;gap:10px;margin:10px 0}
.mt67-draw-export .mt67-pickers label{flex:1 1 235px;min-width:180px;font-size:12px;font-weight:700}
.mt67-draw-export .mt67-pickers select{width:100%;max-width:100%;padding:7px;border:1px solid #b8c2ce;border-radius:4px}
.mt67-draw-export .mt67-info{font-weight:700;color:#93480c;margin-bottom:8px}
</style>'''

code=r'''
// MT-67 — Drawing-only, admin-only, one sector per portrait PNG, packed locally into ZIP.
let mt67DrawEventId='';
let mt67DrawRoundIndex=0;
let mt67ExportBusy=false;
function mt67DrawRows(t){
 const source=Array.isArray(t?.mt55Entries)?t.mt55Entries:[];
 const list=source.filter(r=>r&&r.peg!==null&&r.peg!==undefined&&Number.isSafeInteger(Number(r.peg))&&Number(r.peg)>0&&
    typeof r.sector==='string'&&/^[A-Z]+$/.test(r.sector)&&String(r.competitorName||'').trim())
  .map(r=>({peg:Number(r.peg),sector:String(r.sector),name:String(r.competitorName).trim(),id:String(r.competitorId||'')}));
 if(new Set(list.map(r=>r.sector+'#'+r.peg)).size!==list.length)throw Error('Powtórzone stanowisko w tym samym sektorze — popraw losowanie przed pobraniem zdjęć.');
 return list.sort((a,b)=>a.sector.localeCompare(b.sector,'pl')||a.peg-b.peg);
}
function mt67DrawCandidates(){
 return [...db.events,...db.cycles].flatMap(entity=>getRounds(entity).map((tour,index)=>({entity,tour,index}))
  .filter(x=>{try{return mt67DrawRows(x.tour).length>0;}catch(_error){return false;}}))
  .sort((a,b)=>String(b.tour.date||b.entity.date||'').localeCompare(String(a.tour.date||a.entity.date||''),'pl')); 
}
function mt67DrawPanelButton(entity,tour){
 const rows=mt67DrawRows(tour);
 if(!rows.length)return '<div class="mt67-draw-export"><h3>Zdjęcia losowania na Facebook</h3><p class="smallprint">Nie ma jeszcze przydzielonych stanowisk do eksportu. Najpierw wykonaj losowanie lub wpisz stanowiska ręcznie.</p></div>';
 const count=new Set(rows.map(r=>r.sector)).size;
 return '<div class="mt67-draw-export noprint"><h3>Zdjęcia losowania na Facebook</h3>'+
  '<p class="smallprint">Tylko losowanie: stanowiska i zawodnicy, bez wag i miejsc. Każdy sektor = osobny pionowy PNG 2160 × 2700 px.</p>'+
  '<div class="mt67-info">'+count+' sektorów · '+rows.length+' zawodników · '+safeName(tour.name)+' · '+safeName(tourDateLabel(tour,entity))+'</div>'+
  '<button type="button" class="mt67-action" data-action="mt67DownloadAllDrawSectors">Pobierz wszystkie sektory FB — ZIP ('+count+' zdjęć)</button></div>';
}
function mt67DrawHubPanel(){
 const candidates=mt67DrawCandidates();
 if(!candidates.length)return '<section class="mt67-draw-export"><h3>Zdjęcia losowania — wszystkie sektory</h3><p>Brak zapisanych stanowisk w losowaniach. Zapisz losowanie, aby wygenerować oddzielne zdjęcia sektorowe.</p></section>';
 const entities=[];for(const x of candidates)if(!entities.some(e=>e.id===x.entity.id))entities.push(x.entity);
 let entity=entities.find(e=>e.id===mt67DrawEventId)||entities.find(e=>e.id===selectedId)||entities[0];
 mt67DrawEventId=entity.id;
 const rounds=candidates.filter(x=>x.entity.id===entity.id);
 let sel=rounds.find(x=>x.index===mt67DrawRoundIndex)||rounds[0];
 mt67DrawRoundIndex=sel.index;
 const buttons=mt67DrawPanelButton(sel.entity,sel.tour);
 return '<section class="panel noprint" aria-label="Zdjęcia FB z losowania">'
   +'<h2>LOSOWANIE — zdjęcia sektorów FB</h2>'
   +'<div class="mt67-pickers">'
   +'<label>Zawody<select id="mt67DrawEvent">'+entities.map(e=>'<option value="'+escapeHtml(e.id)+'" '+(e.id===entity.id?'selected':'')+'>'+safeName(e.name)+'</option>').join('')+'</select></label>'
   +'<label>Tura<select id="mt67DrawRound">'+rounds.map(x=>'<option value="'+x.index+'" '+(x.index===sel.index?'selected':'')+'>'+safeName(x.tour.name)+' · '+safeName(tourDateLabel(x.tour,x.entity))+'</option>').join('')+'</select></label>'
   +'</div>'+buttons+'</section>';
}
function mt67DrawSelection(){
 requireAdmin();
 if(page==='photoHub'){
  const x=mt67DrawCandidates().find(x=>x.entity.id===mt67DrawEventId&&x.index===mt67DrawRoundIndex);
  if(!x)throw Error('Wybierz zawody i turę z zapisanym losowaniem.');return x;
 }
 if((page==='event'||page==='cycle')&&resultMode==='draw'){
  const entity=current(),tour=entity&&getRounds(entity)[roundIndex];
  if(!entity||!tour)throw Error('Wybierz turę losowania.');return {entity,tour,index:roundIndex};
 }
 throw Error('Pobieranie losowania dostępne w zakładce Losowanie albo module FOTO FB.');
}
function mt67CanvasForSector(entity,tour,sector,rows){
 const W=2160,H=2700,canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;
 const ctx=canvas.getContext('2d');if(!ctx)throw Error('Przeglądarka nie obsługuje rysowania PNG.');
 const dark='#272d35',orange='#e96609',muted='#637081';
 ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
 ctx.fillStyle=dark;ctx.fillRect(0,0,W,180);
 ctx.textAlign='left';ctx.fillStyle='#fff';ctx.font='900 80px Arial, sans-serif';ctx.fillText('MATCH',92,115);
 ctx.fillStyle=orange;ctx.fillText('THIS',92+ctx.measureText('MATCH').width,115);
 ctx.textAlign='right';ctx.fillStyle='#dce1e8';ctx.font='bold 36px Arial, sans-serif';ctx.fillText('LOSOWANIE STANOWISK',W-96,114);ctx.textAlign='left';
 ctx.fillStyle=orange;ctx.fillRect(92,216,100,9);
 ctx.fillStyle=dark;ctx.font='900 78px Arial, sans-serif';ctx.fillText('SEKTOR '+sector,92,320);
 const label=String(entity.name||'Zawody'),maxWidth=W-184;
 const split=(str,font,maxLines)=>{ctx.font=font;let lines=[],line='';for(const word of str.split(/\s+/)){
  const next=line?line+' '+word:word;if(line&&ctx.measureText(next).width>maxWidth){lines.push(line);line=word;}else line=next;
 }if(line)lines.push(line);return lines.slice(0,maxLines);};
 let nameSize=48,lines=split(label,'bold '+nameSize+'px Arial, sans-serif',3);
 while(lines.length>2&&nameSize>36){nameSize-=2;lines=split(label,'bold '+nameSize+'px Arial, sans-serif',3);}
 ctx.fillStyle=dark;ctx.font='bold '+nameSize+'px Arial, sans-serif';let yy=405;
 for(const line of lines){ctx.fillText(line,92,yy,maxWidth);yy+=nameSize*1.22;}
 ctx.fillStyle=muted;ctx.font='bold 36px Arial, sans-serif';
 yy+=20;ctx.fillText(String(tour.name||'Tura')+'  •  '+tourDateLabel(tour,entity),92,yy,maxWidth);
 yy+=52;ctx.fillText(rows.length+' zawodników • stanowiska '+rows[0].peg+'–'+rows[rows.length-1].peg,92,yy,maxWidth);
 const tableTop=Math.max(655,yy+60),tableBottom=2540,headH=82;
 const tableWidth=W-184,headX=92;
 ctx.fillStyle=dark;ctx.fillRect(headX,tableTop,tableWidth,headH);
 ctx.fillStyle='#fff';ctx.font='bold 35px Arial, sans-serif';ctx.fillText('STAN.',115,tableTop+54);ctx.fillText('ZAWODNIK',385,tableTop+54);
 const n=rows.length,available=tableBottom-tableTop-headH;
 const rowHeight=Math.min(136,available/n),fontSize=Math.max(22,Math.min(46,rowHeight*.43));
 for(let i=0;i<rows.length;i++){
  const item=rows[i],y=tableTop+headH+i*rowHeight;
  ctx.fillStyle=i%2?'#f1f4f7':'#ffffff';ctx.fillRect(headX,y,tableWidth,rowHeight);
  ctx.fillStyle='#dce1e7';ctx.fillRect(headX,y+rowHeight-2,tableWidth,2);
  ctx.fillStyle=dark;ctx.font='900 '+fontSize+'px Arial, sans-serif';ctx.fillText(String(item.peg),115,y+rowHeight*.67,205);
  ctx.font='bold '+fontSize+'px Arial, sans-serif';ctx.fillText(item.name,385,y+rowHeight*.67,tableWidth-355);
 }
 ctx.fillStyle=orange;ctx.fillRect(92,2585,W-184,6);
 ctx.fillStyle=muted;ctx.font='30px Arial, sans-serif';ctx.fillText('MatchThis • Lista wylosowanych stanowisk',92,2640);
 ctx.textAlign='right';ctx.fillText('2160 × 2700 px • 4:5',W-92,2640);ctx.textAlign='left';
 return canvas;
}
function mt67Crc32(data){
 let crc=0xffffffff;for(const val of data){crc^=val;for(let i=0;i<8;i++)crc=(crc>>>1)^(crc&1?0xedb88320:0);}
 return (crc^0xffffffff)>>>0;
}
function mt67MakeZip(files){
 if(!files.length||files.length>100)throw Error('Nieprawidłowa liczba zdjęć ZIP.');
 const enc=new TextEncoder(),chunks=[],directory=[];let offset=0;
 for(const file of files){
  const name=enc.encode(file.name),data=file.data,crc=mt67Crc32(data);
  if(name.length>250||data.length>0xffffffff)throw Error('Plik jest zbyt duży dla ZIP.');
  const header=new Uint8Array(30+name.length),v=new DataView(header.buffer);
  v.setUint32(0,0x04034b50,true);v.setUint16(4,20,true);v.setUint16(6,0x0800,true);v.setUint16(8,0,true);
  v.setUint32(14,crc,true);v.setUint32(18,data.length,true);v.setUint32(22,data.length,true);v.setUint16(26,name.length,true);
  header.set(name,30);chunks.push(header,data);
  const cd=new Uint8Array(46+name.length),c=new DataView(cd.buffer);
  c.setUint32(0,0x02014b50,true);c.setUint16(4,20,true);c.setUint16(6,20,true);c.setUint16(8,0x0800,true);
  c.setUint16(10,0,true);c.setUint32(16,crc,true);c.setUint32(20,data.length,true);c.setUint32(24,data.length,true);
  c.setUint16(28,name.length,true);c.setUint32(42,offset,true);cd.set(name,46);directory.push(cd);
  offset+=header.length+data.length;
 }
 const dirSize=directory.reduce((n,x)=>n+x.length,0);
 const end=new Uint8Array(22),v=new DataView(end.buffer);
 v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);v.setUint16(10,files.length,true);
 v.setUint32(12,dirSize,true);v.setUint32(16,offset,true);
 return new Blob([...chunks,...directory,end],{type:'application/zip'});
}
async function mt67DownloadAllDrawSectors(){
 requireAdmin();if(mt67ExportBusy)return;
 const {entity,tour}=mt67DrawSelection(),rows=mt67DrawRows(tour);
 if(!rows.length)throw Error('Brak zapisanych stanowisk z nazwiskami w wybranej turze.');
 const sectors=[...new Set(rows.map(r=>r.sector))].sort((a,b)=>a.localeCompare(b,'pl'));
 if(sectors.length>30)throw Error('Zbyt wiele sektorów do eksportu.');
 mt67ExportBusy=true;
 const buttons=[...document.querySelectorAll('[data-action="mt67DownloadAllDrawSectors"]')];
 buttons.forEach(b=>{b.disabled=true;b.dataset.oldText=b.textContent;b.textContent='Tworzenie zdjęć ZIP…';});
 try{
  const files=[];
  for(const sector of sectors){
   const people=rows.filter(r=>r.sector===sector).sort((a,b)=>a.peg-b.peg);
   const canvas=mt67CanvasForSector(entity,tour,sector,people);
   const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('Błąd generowania zdjęcia sektora '+sector)),'image/png'));
   const bytes=new Uint8Array(await blob.arrayBuffer());
   files.push({name:'SEKTOR_'+safeFilePart(sector)+'_LOSOWANIE_FB.png',data:bytes});
  }
  const zip=mt67MakeZip(files),filename='MatchThis_'+safeFilePart(entity.name)+'_'+safeFilePart(tour.name)+'_LOSOWANIE_FB_'+sectors.length+'_SEKTOROW.zip';
  downloadBlob(zip,filename);alertMsg('Pobrano ZIP: '+sectors.length+' zdjęć losowania, 1 sektor = 1 PNG.',true);
 }finally{mt67ExportBusy=false;buttons.forEach(b=>{b.disabled=false;b.textContent=b.dataset.oldText||'Pobierz wszystkie sektory FB — ZIP';});}
}
// Selection is scoped to the draw exporter; existing results-photo pickers remain unchanged.
document.addEventListener('change',event=>{
 const t=event.target;
 if(t.id==='mt67DrawEvent'){mt67DrawEventId=t.value;mt67DrawRoundIndex=0;render();}
 else if(t.id==='mt67DrawRound'){mt67DrawRoundIndex=Number(t.value);render();}
});
'''

for suffix in BASE:
 s=(D/f'MatchThis_MT-66{suffix}.html').read_text()
 assert hashlib.sha256(s.encode()).hexdigest()==BASE[suffix]
 s=once(s,'</style>\n</head>\n<body data-version="MT-66"','</style>\n'+css+'\n</head>\n<body data-version="MT-66"')
 for a,b in [('<title>MatchThis MT-66</title>','<title>MatchThis MT-67</title>'),('data-version="MT-66"','data-version="MT-67"'),('aria-label="Wersja MT-66">MT-66','aria-label="Wersja MT-67">MT-67'),('<div class="version" id="appversion">MT-66</div>','<div class="version" id="appversion">MT-67</div>'),("const APP_VERSION='MT-66';","const APP_VERSION='MT-67';"),("const STORAGE_KEY='matchthis-preview-MT-66';","const STORAGE_KEY='matchthis-preview-MT-67';\nconst MT66_STORAGE_KEY='matchthis-preview-MT-66';")]:
  s=once(s,a,b)
 if 'localStorage.getItem(MT65_STORAGE_KEY)||' in s:
  s=once(s,'localStorage.getItem(MT65_STORAGE_KEY)||','localStorage.getItem(MT66_STORAGE_KEY)||localStorage.getItem(MT65_STORAGE_KEY)||')
 s=once(s,'function renderPhotoHub(){',code+'\nfunction renderPhotoHub(){')
 s=once(s,'function renderPhotoHub(){\n const selected=getPhotoSelection();','function renderPhotoHub(){\n const mt67Export=mt67DrawHubPanel();\n const selected=getPhotoSelection();')
 s=once(s,"if(!selected)return '<h1>FOTO FB</h1>","if(!selected)return mt67Export+'<h1>FOTO FB</h1>")
 s=once(s,"return '<div class=\"list-title\"><h1>FOTO FB</h1><span class=\"pill\">Wyniki bez podziału na sektory", "return mt67Export+'<div class=\"list-title\"><h1>FOTO FB</h1><span class=\"pill\">Wyniki bez podziału na sektory")
 s=once(s,'return `<div class="list-title"><h1>FOTO FB</h1><span class="pill">1 sektor = 1 zdjęcie','return mt67Export+`<div class="list-title"><h1>FOTO FB</h1><span class="pill">1 sektor = 1 zdjęcie')
 s=once(s,'${mt65InitialPreview(e,t)}</div></section>${mt59AssignmentsWorkspace(e,t)}', '${mt65InitialPreview(e,t)}</div>${mt67DrawPanelButton(e,t)}</section>${mt59AssignmentsWorkspace(e,t)}')
 s=once(s,"'mt65DownloadRoster','mt52AddReservation'", "'mt65DownloadRoster','mt67DownloadAllDrawSectors','mt52AddReservation'")
 s=once(s,"case 'mt65DownloadRoster':mt65DownloadRoster();break;", "case 'mt65DownloadRoster':mt65DownloadRoster();break;case 'mt67DownloadAllDrawSectors':mt67DownloadAllDrawSectors().catch(err=>alertMsg(err.message));break;")
 for old,new in [("console.error('MatchThis MT-66:","console.error('MatchThis MT-67:"),("console.warn('MatchThis MT-66:","console.warn('MatchThis MT-67:")]:s=s.replace(old,new)
 assert all(x in s for x in ['<title>MatchThis MT-67</title>',"const APP_VERSION='MT-67'",'data-version="MT-67"','aria-label="Wersja MT-67">MT-67','function mt67MakeZip','function mt67DrawHubPanel','function mt63Confirmed','function mt65SaveSectorSize','function mt66BulkConfirm'])
 for ix,script in enumerate(re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S)):
  if script.strip():
   p=D/'_mt67_check.js';p.write_text(script)
   t=subprocess.run(['node','--check',str(p)],capture_output=True,text=True)
   assert t.returncode==0,(suffix,ix,t.stderr)
   p.unlink()
 for key in ('MATCHTHIS_ARCHIVE_2026','MATCHTHIS_STANDALONE_2026','MATCHTHIS_ARCHIVE_2025_MEGA_V','MATCHTHIS_ARCHIVE_2025_MAVER_OCT','MT44_MISSING_2025','MT44_MEGA_2025','MT45_MEGA_2025_ROUNDS','MT46_PUCHAR_ROUND1_DRAW','MT47_PUCHAR_ROUND2_DRAW','MT48_FLOAT_ROUND2_DRAW'):
  a=(D/f'MatchThis_MT-66{suffix}.html').read_text().split('const '+key+'=',1)[1].split(';\n',1)[0]
  b=s.split('const '+key+'=',1)[1].split(';\n',1)[0]
  assert a==b,(suffix,key)
 out=ROOT/f'MatchThis_MT-67{suffix}.html';out.write_text(s)
 print('BUILT',suffix,hashlib.sha256(s.encode()).hexdigest(),len(s))
