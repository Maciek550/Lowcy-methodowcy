'use strict';
const {validateDraft}=require('./import-core.cjs');
const {key}=require('../import-preview.cjs');
function number(value){const s=String(value).trim().replace(/\s/g,'').replace(',','.');if(!/^\d+(?:\.\d+)?$/.test(s))throw Error('Nieczytelna liczba w źródle: '+value);return Number(s)}
function parseHtml(html,sourceId){
 const $=require('cheerio').load(html),rows=[],general=[];
 let meta; $('script[type="application/ld+json"]').each((i,e)=>{try{const v=JSON.parse($(e).text());if(v['@type']==='SportsEvent')meta=v}catch{}});
 if(!meta)throw Error('Brak danych zawodów na stronie');
 const roundCount=$('#live-results-table thead .zr-tura-cell').length||($('#live-results-table .live-t-2-sector').length?2:1);
 $('#live-results-table tbody tr').each((i,tr)=>{
  const t=$(tr),name=t.find('.cell-name').text().trim();
  if(!name)return;
  general.push({name,rank:number(t.find('.cell-place').text()),points:number(t.find('.cell-points').text()),weight:number(t.find('.cell-waga').text())});
  for(let round=1;round<=roundCount;round++){
   const sectorStand=t.find('.live-t-'+round+'-sector').text().trim().match(/^([\p{L}]+)\s*(\d+)$/u);
   if(!sectorStand)throw Error('Brak sektora lub stanowiska: '+name+', T'+round);
   rows.push({name,round,sector:sectorStand[1],stand:Number(sectorStand[2]),weight:number(t.find('.live-t-'+round+'-waga').text()),bigFish:number(t.find('.live-t-'+round+'-bf').text().replace(/^BF\s*/,'')),points:number(t.find('.live-t-'+round+'-pkt').text().replace(/[\[\]]/g,''))});
  }
 });
 return validateDraft({title:meta.name,date:String(meta.startDate).slice(0,10),fishery:meta.location?.name||'',sourceId,roundCount,rows,general});
}
async function fromUrl(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||!['www.zawody.pro','zawody.pro'].includes(url.hostname)||url.port||url.username||url.password||!/^\/public\/szczegoly\/\d+\/?$/.test(url.pathname))throw Error('Wklej adres https://www.zawody.pro/public/szczegoly/NUMER');
 const id=url.pathname.match(/\d+/)[0];
 const res=await fetch('https://www.zawody.pro/public/szczegoly/'+id,{redirect:'error',signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw Error('Nie udało się pobrać zawodów: HTTP '+res.status);
 let length=0,chunks=[];for await(const c of res.body){length+=c.length;if(length>5_000_000)throw Error('Strona przekracza limit 5 MB');chunks.push(c)}
 return parseHtml(Buffer.concat(chunks).toString('utf8'),'zawody.pro:'+id);
}
function parsePdfText(text,meta={}){
 const lines=text.split(/\r?\n/).map(l=>l.trim().replace(/\s+/g,' '));
 const heading=lines.find(l=>/\d{2}\.\d{2}\.\d{4}/.test(l))||'';
 const dateMatch=heading.match(/(\d{2})\.(\d{2})\.(\d{4})/);
 const declared=lines.find(l=>/Tury uwzględnione/.test(l));
 if(!declared)throw Error('PDF musi zawierać pełne wyniki z tabelami sektorowymi');
 const roundCount=/\b2\b/.test(declared)?2:1,rows=[],general=[];
 let round=0,sector='',mode='';
 for(const line of lines){
  if(line==='Klasyfikacja Ogólna'){mode='general';continue}
  if(line==='Wyniki Sektorowe wg Tur'){mode='sector';continue}
  const r=line.match(/^Tura ([12])$/);if(r){round=Number(r[1]);sector='';continue}
  const s=line.match(/^SEKTOR:\s*([\p{L}]+)$/u);if(s){sector=s[1];continue}
  if(mode==='general'){
   const m=line.match(roundCount===2?/^(\d+) (.+?) (\d+(?:[.,]\d+)?) (\d+) (\d+) (\d+(?:[.,]\d+)?) (\d+) (\d+(?:[.,]\d+)?) (\d+)$/:/^(\d+) (.+?) (\d+(?:[.,]\d+)?) (\d+) (\d+) (\d+(?:[.,]\d+)?) (\d+)$/);
   if(m)general.push({name:m[2],rank:number(m[1]),points:number(m[3]),weight:number(m[4])});
  }
  if(mode==='sector'&&round&&sector){
   const m=line.match(/^(\d+) (.+?) (\d+) (\d+) (\d+) (\d+(?:[.,]\d+)?)$/);
   if(m)rows.push({name:m[2],round,sector,stand:number(m[3]),weight:number(m[4]),bigFish:number(m[5]),points:number(m[6])});
  }
 }
 if(!general.length||rows.length!==general.length*roundCount)throw Error('Niepełny PDF: nie zgadza się liczba wyników i zawodników');
 return validateDraft({...meta,title:meta.title||heading,date:meta.date||(dateMatch?dateMatch[3]+'-'+dateMatch[2]+'-'+dateMatch[1]:''),roundCount,rows,general});
}
async function fromPdf(base64,meta={}){
 if(typeof base64!=='string'||base64.length>14_000_000||!/^[A-Za-z0-9+/]*={0,2}$/.test(base64))throw Error('Niepoprawny lub zbyt duży PDF (maks. 10 MB)');
 const data=Buffer.from(base64,'base64');if(data.subarray(0,5).toString()!=='%PDF-')throw Error('Plik nie jest PDF');
 const pdf=await import('pdfjs-dist/legacy/build/pdf.mjs');
 const doc=await pdf.getDocument({data:new Uint8Array(data),useSystemFonts:true,isEvalSupported:false}).promise;
 try{
  if(doc.numPages>40)throw Error('PDF przekracza limit 40 stron');
  let text='';for(let n=1;n<=doc.numPages;n++){
   const page=await doc.getPage(n),content=await page.getTextContent(),lines=[];
   for(const item of content.items){if(!item.str?.trim())continue;const y=item.transform[5];let l=lines.find(l=>Math.abs(l.y-y)<2);if(!l){l={y,items:[]};lines.push(l)}l.items.push({x:item.transform[4],text:item.str})}
   text+=lines.sort((a,b)=>b.y-a.y).map(l=>l.items.sort((a,b)=>a.x-b.x).map(i=>i.text).join(' ')).join('\n')+'\n';
  }
  return parsePdfText(text,meta);
 }finally{await doc.destroy()}
}
module.exports={parseHtml,parsePdfText,fromUrl,fromPdf};
