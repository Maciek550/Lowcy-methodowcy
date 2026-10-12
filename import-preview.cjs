'use strict';
// Import preview only. No DB writes. Used to identify accounts before approval.
function key(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').replace(/Ł/g,'L').toLowerCase().replace(/[^\p{L}\p{N} ]/gu,' ').replace(/\s+/g,' ').trim()}
function realPhone(p){let s=String(p||'').trim();return !/^(ZPRO|IMPORT|MANUAL)-/i.test(s)&&/^(?:48)?[0-9]{9}$/.test(s.replace(/\D/g,''))}
function matchPlayers(players,accounts){
 if(!Array.isArray(players)||!Array.isArray(accounts))throw Error('Nieprawidłowe dane');
 const grouped=new Map();
 for(const a of accounts){const k=key(a.first_name+' '+a.last_name);if(!grouped.has(k))grouped.set(k,[]);grouped.get(k).push(a)}
 const used=new Set();
 return players.map(p=>{
 const name=String(p.fullName||'').trim(),k=key(name);
 if(!k)return {name,status:'INVALID'};
 if(used.has(k))return {name,status:'DUPLICATE_SOURCE'};
 used.add(k);
 const matches=(grouped.get(k)||[]).slice().sort((a,b)=>Number(realPhone(b.phone))-Number(realPhone(a.phone))||(Date.parse(a.created_at)||0)-(Date.parse(b.created_at)||0)||Number(a.id)-Number(b.id));
 if(!matches.length)return {name,status:'NEW_REQUIRES_REVIEW'};
 return {name,status:'MATCHED',userId:matches[0].id,mergeFromIds:matches.slice(1).map(a=>a.id)};
 });
}
module.exports={key,realPhone,matchPlayers};
