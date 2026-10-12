'use strict';
const {key,realPhone}=require('../import-preview.cjs');
const crypto=require('node:crypto');
function validateDraft(d){
 if(!d||typeof d!=='object'||!/^\d{4}-\d{2}-\d{2}$/.test(d.date||'')||!String(d.title||'').trim())throw Error('Brak nazwy lub daty zawodów');
 if(!Number.isFinite(Date.parse(d.date))||new Date(d.date).toISOString().slice(0,10)!==d.date)throw Error('Niepoprawna data');
 if(!Array.isArray(d.rows)||!d.rows.length||d.rows.length>1000)throw Error('Brak wyników lub przekroczony limit 1000');
 const roundCount=Number(d.roundCount||Math.max(...d.rows.map(r=>Number(r.round||1))));
 if(![1,2].includes(roundCount))throw Error('Niepoprawna liczba tur');
 const seen=new Set(),stands=new Set(),names=new Map();
 const rows=d.rows.map((r,i)=>{
  const name=String(r.name||'').trim().replace(/\s+/g,' '),sector=String(r.sector||'').trim().toUpperCase();
  const round=Number(r.round||1),stand=Number(r.stand),weight=r.weight===''||r.weight==null?NaN:Number(r.weight),bigFish=Number(r.bigFish||0);
  const points=r.points==null||r.points===''?null:Number(r.points);
  if(key(name).split(' ').length<2||!/^[\p{L}]{1,8}$/u.test(sector)||![1,2].includes(round)||round>roundCount||!Number.isInteger(stand)||stand<1||stand>10000||!Number.isSafeInteger(weight)||weight<0||weight>2147483647||!Number.isSafeInteger(bigFish)||bigFish<0||bigFish>weight||points!==null&&(!Number.isFinite(points)||points<1||points>1000))throw Error('Niepoprawny wynik w wierszu '+(i+1));
  const nk=key(name)+':'+round,sk=round+':'+stand;
  if(seen.has(nk)||stands.has(sk))throw Error('Powtórzony zawodnik lub stanowisko w turze '+round);
  seen.add(nk);stands.add(sk);names.set(key(name),(names.get(key(name))||0)+1);
  return {name,sector,round,stand,weight,bigFish,points,userId:r.userId?Number(r.userId):null};
 });
 if([...names.values()].some(n=>n!==roundCount))throw Error('Każdy zawodnik musi mieć wynik w każdej turze; brakującą wagę trzeba potwierdzić jako 0');
 const title=String(d.title).trim(),fishery=String(d.fishery||'').trim();
 if(title.length>300||fishery.length>200)throw Error('Za długa nazwa');
 const general=Array.isArray(d.general)?d.general.map(r=>({name:String(r.name),rank:Number(r.rank),points:Number(r.points),weight:Number(r.weight)})):[];
 if(general.length){
  if(general.length!==names.size||new Set(general.map(r=>key(r.name))).size!==names.size)throw Error('Niepełna klasyfikacja ogólna');
  for(const g of general){const rr=rows.filter(r=>key(r.name)===key(g.name));if(rr.length!==roundCount||rr.some(r=>r.points===null)||rr.reduce((s,r)=>s+r.weight,0)!==g.weight||rr.reduce((s,r)=>s+r.points,0)!==g.points)throw Error('Klasyfikacja nie zgadza się z turami: '+g.name)}
  const sorted=[...general].sort((a,b)=>a.points-b.points||b.weight-a.weight);
  sorted.forEach((g,i)=>{if(g.rank!==i+1&&!(i>0&&g.points===sorted[i-1].points&&g.weight===sorted[i-1].weight&&g.rank===sorted[i-1].rank))throw Error('Niepoprawne miejsce w klasyfikacji: '+g.name)});
 }
 return {title,fishery,date:d.date,sourceId:String(d.sourceId||'').slice(0,200),roundCount,rows,general};
}
function accountPlan(rows,accounts){
 const groups=new Map();
 for(const a of accounts){if(a.archived_at)continue;const k=key(a.first_name+' '+a.last_name);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(a)}
 const chosen=new Map(),plan=[];
 for(const r of rows){
  const k=key(r.name);if(chosen.has(k)){if(r.userId&&Number(r.userId)!==chosen.get(k).userId)throw Error('Sprzeczne ID tego samego zawodnika: '+r.name);continue}
  const list=(groups.get(k)||[]).slice().sort((a,b)=>Number(realPhone(b.phone))-Number(realPhone(a.phone))||(Date.parse(a.created_at)||0)-(Date.parse(b.created_at)||0)||Number(a.id)-Number(b.id));
  if(!list.length){const m={name:r.name,status:'NEW',userId:null,mergeFromIds:[],candidates:[]};chosen.set(k,m);plan.push(m);continue}
  const real=list.filter(a=>realPhone(a.phone)),selected=rows.filter(x=>key(x.name)===k&&x.userId).map(x=>Number(x.userId));
  if(new Set(selected).size>1)throw Error('Sprzeczne ID tego samego zawodnika: '+r.name);
  const explicit=selected[0];
  if(explicit&&!list.some(a=>Number(a.id)===explicit))throw Error('Nieprawidłowe ID dla '+r.name);
  // A technical duplicate with no login can be merged automatically; two real accounts need an explicit ID.
  const id=explicit||Number((real[0]||list[0]).id);
  const mergeFromIds=list.filter(a=>Number(a.id)!==id&&!realPhone(a.phone)&&!a.last_login_at&&a.role==='PLAYER').map(a=>Number(a.id));
  const conflict=!explicit&&list.length>1&&(real.length>1||list.some(a=>Number(a.id)!==id&&!mergeFromIds.includes(Number(a.id))));
  const m={name:r.name,status:conflict?'CONFLICT':'MATCHED',userId:conflict?null:id,mergeFromIds,candidates:list.map(a=>({id:Number(a.id),phone:realPhone(a.phone)?String(a.phone).slice(-3).padStart(9,'•'):'konto techniczne',role:a.role||'PLAYER'}))};
  chosen.set(k,m);plan.push(m);
 }
 return plan;
}
function mapAccounts(rows,accounts){
 const plan=accountPlan(rows,accounts);
 for(const p of plan){if(p.status==='NEW')throw Error('Brak konta dla '+p.name+'; wymagana weryfikacja administratora');if(p.status==='CONFLICT')throw Error('Wymagane ręczne wskazanie ID dla '+p.name)}
 return rows.map(r=>({...r,userId:plan.find(p=>key(p.name)===key(r.name)).userId}));
}
async function mergeTechnical(client,from,to){
 const overlaps=await client.query('SELECT 1 FROM entries a JOIN entries b ON a.competition_id=b.competition_id WHERE a.user_id=$1 AND b.user_id=$2 LIMIT 1',[from,to]);
 if(overlaps.rowCount)throw Error('Konta #'+from+' i #'+to+' mają wspólne zawody; scalanie wymaga osobnej kontroli historii');
 for(const table of ['entries','draws','results','result_items','player_achievements','competition_invitations','leave_requests'])await client.query('UPDATE '+table+' SET user_id=$2 WHERE user_id=$1',[from,to]);
 await client.query('UPDATE notifications SET recipient_user_id=$2 WHERE recipient_user_id=$1',[from,to]);
 await client.query('UPDATE users SET archived_at=now() WHERE id=$1',[from]);
}
async function saveApprovedDraft(pool,raw,actorId,expectedAccountDigest){
 const draft=validateDraft(raw),client=await pool.connect();
 try{
  await client.query('BEGIN');
  // Serialize import/merge operations, including different sources pointing at the same event.
  await client.query("SELECT pg_advisory_xact_lock(hashtext('historical-import'))");
  const fingerprint=crypto.createHash('sha256').update(JSON.stringify({date:draft.date,rows:draft.rows.map(({userId,...r})=>r).sort((a,b)=>key(a.name).localeCompare(key(b.name))||a.round-b.round)})).digest('hex');
  const source=draft.sourceId||'data:'+fingerprint;
  const existing=await client.query('SELECT id FROM competitions WHERE (competition_date=$1 AND lower(title)=lower($2)) OR historical_source=$3 OR historical_fingerprint=$4 FOR UPDATE',[draft.date,draft.title,source,fingerprint]);
  if(existing.rowCount)throw Error('Zawody już istnieją (#'+existing.rows[0].id+'). Import nie nadpisuje danych.');
  const users=(await client.query('SELECT id,first_name,last_name,phone,created_at,archived_at,role,last_login_at FROM users FOR UPDATE')).rows;
  const plan=accountPlan(draft.rows,users);
  if(expectedAccountDigest&&crypto.createHash('sha256').update(JSON.stringify(plan)).digest('hex')!==expectedAccountDigest)throw Error('Konta zmieniły się od podglądu; sprawdź powiązania ponownie');
  for(const p of plan){
   if(p.status==='CONFLICT')throw Error('Wymagane ręczne wskazanie ID dla '+p.name);
   if(p.status==='NEW'){
    const parts=p.name.split(' '),first=parts.shift(),last=parts.join(' ');
    const passwordHash=await require('bcryptjs').hash(crypto.randomBytes(32).toString('hex'),10);
    p.userId=Number((await client.query("INSERT INTO users(phone,password_hash,first_name,last_name,role,account_source) VALUES($1,$2,$3,$4,'PLAYER','EXTERNAL') RETURNING id",['IMPORT-'+crypto.randomUUID(),passwordHash,first,last])).rows[0].id);
   }
   for(const id of p.mergeFromIds)await mergeTechnical(client,id,p.userId);
  }
  const rows=draft.rows.map(r=>({...r,userId:plan.find(p=>key(p.name)===key(r.name)).userId}));
  const c=(await client.query('INSERT INTO competitions(title,fishery,competition_date,status,round_count,created_by,notes,signup_open,limit_places,historical_source,historical_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7,false,$8,$9,$10) RETURNING id',[draft.title,draft.fishery,draft.date,'CLOSED',draft.roundCount,actorId,'Import historyczny: '+source,plan.length,source,fingerprint])).rows[0];
  for(const r of rows){
   await client.query('INSERT INTO entries(competition_id,user_id,status) VALUES($1,$2,$3) ON CONFLICT(competition_id,user_id) DO NOTHING',[c.id,r.userId,'ACTIVE']);
   await client.query('INSERT INTO draws(competition_id,user_id,round,stand,sector) VALUES($1,$2,$3,$4,$5)',[c.id,r.userId,r.round,r.stand,r.sector]);
   await client.query('INSERT INTO results(competition_id,user_id,round,weight,big_fish,historical_points) VALUES($1,$2,$3,$4,$5,$6)',[c.id,r.userId,r.round,r.weight,r.bigFish,r.points]);
   if(r.weight>r.bigFish)await client.query("INSERT INTO result_items(competition_id,user_id,round,kind,weight) VALUES($1,$2,$3,'NET',$4)",[c.id,r.userId,r.round,r.weight-r.bigFish]);
   if(r.bigFish>0)await client.query("INSERT INTO result_items(competition_id,user_id,round,kind,weight) VALUES($1,$2,$3,'BF',$4)",[c.id,r.userId,r.round,r.bigFish]);
  }
  await client.query('INSERT INTO historical_import_audit(competition_id,actor_id,payload) VALUES($1,$2,$3::jsonb)',[c.id,actorId,JSON.stringify({source,fingerprint,plan,draft})]);
  await client.query('COMMIT');
  return {competitionId:c.id,results:rows.length,players:plan.length};
 }catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}
}
module.exports={validateDraft,accountPlan,mapAccounts,saveApprovedDraft};
