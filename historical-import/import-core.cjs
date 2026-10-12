'use strict';
const {key,realPhone}=require('../import-preview.cjs');
function validateDraft(d){
 if(!d||typeof d!=='object'||!/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')||!String(d.title||'').trim())throw Error('Brak nazwy lub daty zawodów');
 if(!Array.isArray(d.rows)||!d.rows.length)throw Error('Brak wyników');
 const seen=new Set(),stands=new Set();
 const rows=d.rows.map((r,i)=>{
  const name=String(r.name||'').trim(),sector=String(r.sector||'').trim().toUpperCase();
  const round=Number(r.round||1),stand=Number(r.stand),weight=Number(r.weight),bigFish=Number(r.bigFish||0);
  if(!key(name)||!sector||![1,2].includes(round)||!Number.isInteger(stand)||stand<1||!Number.isSafeInteger(weight)||weight<0||!Number.isSafeInteger(bigFish)||bigFish<0||bigFish>weight)throw Error('Niepoprawny wynik w wierszu '+(i+1));
  const nk=key(name)+':'+round,sk=round+':'+stand;
  if(seen.has(nk)||stands.has(sk))throw Error('Powtórzony zawodnik lub stanowisko w turze '+round);
  seen.add(nk);stands.add(sk);
  return {name,sector,round,stand,weight,bigFish,userId:r.userId||null};
 });
 return {title:d.title.trim(),fishery:String(d.fishery||'').trim(),date:d.date,sourceId:String(d.sourceId||''),rows};
}
function mapAccounts(rows,accounts){
 const groups=new Map();
 for(const a of accounts){const k=key(a.first_name+' '+a.last_name);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(a)}
 const chosen=new Map();
 for(const r of rows){
  const k=key(r.name),list=(groups.get(k)||[]).slice().sort((a,b)=>Number(realPhone(b.phone))-Number(realPhone(a.phone))||(Date.parse(a.created_at)||0)-(Date.parse(b.created_at)||0)||Number(a.id)-Number(b.id));
  if(!list.length)throw Error('Brak konta dla '+r.name+'; wymagana weryfikacja administratora');
  if(list.length>1 && !r.userId)throw Error('Wymagane ręczne wskazanie ID dla '+r.name);
  const id=Number(r.userId||list[0].id);
  if(!list.some(a=>Number(a.id)===id))throw Error('Nieprawidłowe ID dla '+r.name);
  if(!Number.isSafeInteger(id))throw Error('Niepoprawny identyfikator');
  if(chosen.has(k) && chosen.get(k)!==id)throw Error('Sprzeczne ID tego samego zawodnika: '+r.name);
  chosen.set(k,id);
 }
 return rows.map(r=>({...r,userId:chosen.get(key(r.name))}));
}
async function saveApprovedDraft(pool,raw,actorId){
 const draft=validateDraft(raw);
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  // Advisory lock serializes imports for the same external competition.
  const source=draft.sourceId||draft.date+':'+key(draft.title);
  await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',['historical-import:'+source]);
  const users=(await client.query('SELECT id,first_name,last_name,phone,created_at FROM users')).rows;
  const rows=mapAccounts(draft.rows,users);
  const existing=await client.query('SELECT id FROM competitions WHERE competition_date=$1 AND lower(title)=lower($2) FOR UPDATE',[draft.date,draft.title]);
  if(existing.rowCount)throw Error('Zawody już istnieją. Nie nadpisuję danych bez osobnego uzgodnienia.');
  const c=(await client.query('INSERT INTO competitions(title,fishery,competition_date,status,round_count,created_by,notes) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',[draft.title,draft.fishery,draft.date,'CLOSED',Math.max(...rows.map(x=>x.round)),actorId,'Import historyczny: '+source])).rows[0];
  for(const r of rows){
   await client.query('INSERT INTO entries(competition_id,user_id,status) VALUES($1,$2,$3) ON CONFLICT(competition_id,user_id) DO NOTHING',[c.id,r.userId,'ACTIVE']);
   await client.query('INSERT INTO draws(competition_id,user_id,round,stand,sector) VALUES($1,$2,$3,$4,$5)',[c.id,r.userId,r.round,r.stand,r.sector]);
   await client.query('INSERT INTO results(competition_id,user_id,round,weight,big_fish) VALUES($1,$2,$3,$4,$5)',[c.id,r.userId,r.round,r.weight,r.bigFish]);
   if(r.weight>0)await client.query("INSERT INTO result_items(competition_id,user_id,round,kind,weight) VALUES($1,$2,$3,'NET',$4)",[c.id,r.userId,r.round,r.weight]);
   if(r.bigFish>0)await client.query("INSERT INTO result_items(competition_id,user_id,round,kind,weight) VALUES($1,$2,$3,'BF',$4)",[c.id,r.userId,r.round,r.bigFish]);
  }
  await client.query('COMMIT');
  return {competitionId:c.id,results:rows.length};
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
module.exports={validateDraft,mapAccounts,saveApprovedDraft};
