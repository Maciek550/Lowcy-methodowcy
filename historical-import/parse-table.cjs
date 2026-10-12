'use strict';
const {validateDraft}=require('./import-core.cjs');
// Deterministic text-table parser. Does not guess missing sector, stand or weight.
function parseDelimitedResults(input,meta={}){
 const lines=String(input||'').replace(/^\uFEFF/,'').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 if(lines.length<2)throw Error('Brak tabeli wyników');
 const delimiter=lines[0].includes('\t')?'\t':lines[0].includes(';')?';':',';
 const split=s=>s.split(delimiter).map(v=>v.trim().replace(/^"|"$/g,''));
 const headers=split(lines[0]).map(s=>s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''));
 const aliases={name:['zawodnik','imie i nazwisko','nazwisko i imie','name','full name'],sector:['sektor','sector'],stand:['stanowisko','stand','nr stanowiska'],round:['tura','round'],weight:['waga','weight','waga g','waga (g)'],bigFish:['bf','big fish','najwieksza ryba']};
 const idx={};for(const [k,options] of Object.entries(aliases)){idx[k]=headers.findIndex(h=>options.includes(h));}
 for(const k of ['name','sector','stand','weight'])if(idx[k]<0)throw Error('Brak kolumny: '+k);
 const rows=lines.slice(1).map((line,i)=>{const a=split(line);if(a.length!==headers.length)throw Error('Niepoprawna liczba kolumn w wierszu '+(i+2));
 const get=k=>idx[k]<0?'':a[idx[k]];
 const parseWeight=s=>{const x=String(s).replace(/\s/g,'');if(!/^\d+$/.test(x))throw Error('Waga musi być podana w gramach jako liczba całkowita');return Number(x)};
 return {name:get('name'),sector:get('sector'),stand:get('stand'),round:get('round')||1,weight:parseWeight(get('weight')),bigFish:get('bigFish')?parseWeight(get('bigFish')):0};});
 return validateDraft({...meta,rows});
}
module.exports={parseDelimitedResults};
