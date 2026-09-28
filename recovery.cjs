'use strict';
// Safe recovery points for destructive competition actions. No background deletion.
const same=(x,y)=>JSON.stringify(x)===JSON.stringify(y);
function canRestore(comp,activeIds,snapshot,currentDraws,currentResults,currentItems,operation){
 const reasons=[];
 const sorted=arr=>[...(arr||[])].map(Number).sort((a,b)=>a-b);
 if(!same(sorted(activeIds),sorted(snapshot.activeIds)))reasons.push('Zmieniła się lista główna zawodników.');
 if(Number(comp.bank1_count)!==Number(snapshot.bank1)||Number(comp.bank2_count)!==Number(snapshot.bank2)||
   String(comp.map_mode)!==String(snapshot.mapMode)||!same(sorted(comp.disabled_stands),sorted(snapshot.disabled)))
   reasons.push('Zmieniła się fizyczna mapa łowiska.');
 if(currentResults.length||currentItems.length)reasons.push('Po utworzeniu kopii zapisano nowe wyniki.');
 if(operation==='DRAW_RESET'&&currentDraws.length)reasons.push('Istnieje już nowe losowanie.');
 if(operation==='RESULTS_CLEAR'){
   const slim=xs=>(xs||[]).map(x=>[Number(x.user_id),Number(x.round),Number(x.stand),String(x.sector)]);
   if(!same(slim(currentDraws),slim(snapshot.draws)))reasons.push('Od wykonania kopii zmieniło się losowanie.');
 }
 return {ready:!reasons.length,reasons};
}
async function initRecovery(pool){
 await pool.query("create table if not exists competition_recoveries (id bigserial primary key,competition_id bigint not null references competitions(id) on delete cascade,created_by bigint references users(id),operation text not null check (operation in ('DRAW_RESET','RESULTS_CLEAR')),snapshot jsonb not null,created_at timestamptz not null default now(),restored_at timestamptz); create index if not exists competition_recoveries_recent on competition_recoveries(competition_id,id desc)");
}
async function lastRecovery(pool,compId){
 return (await pool.query("select id,operation,created_at from competition_recoveries where competition_id=$1 and restored_at is null order by id desc limit 1",[compId])).rows[0]||null;
}
async function capture(client,compId,actorId,op,disabledForComp){
 const comp=(await client.query("select * from competitions where id=$1 for update",[compId])).rows[0];
 if(!comp)throw new Error('Nie znaleziono zawodów.');
 const draws=(await client.query("select * from draws where competition_id=$1 order by round,stand",[compId])).rows;
 const results=(await client.query("select * from results where competition_id=$1 order by round,user_id",[compId])).rows;
 const items=(await client.query("select * from result_items where competition_id=$1 order by round,user_id,id",[compId])).rows;
 if(!draws.length&&!results.length&&!items.length)return null;
 const activeIds=(await client.query("select user_id from entries where competition_id=$1 and status='ACTIVE' order by user_id",[compId])).rows.map(x=>Number(x.user_id));
 const snapshot={bank1:Number(comp.bank1_count),bank2:Number(comp.bank2_count),
  disabled:disabledForComp(comp),mapMode:comp.map_mode,activeIds,draws,results,items};
 const out=await client.query("insert into competition_recoveries(competition_id,created_by,operation,snapshot) values($1,$2,$3,$4::jsonb) returning id",[compId,actorId,op,JSON.stringify(snapshot)]);
 return Number(out.rows[0].id);
}
async function restore(client,compId,disabledForComp){
 const comp=(await client.query("select * from competitions where id=$1 for update",[compId])).rows[0];
 if(!comp)throw new Error('Nie znaleziono zawodów.');
 const entry=(await client.query("select * from competition_recoveries where competition_id=$1 and restored_at is null order by id desc limit 1 for update",[compId])).rows[0];
 if(!entry)throw new Error('Nie ma kopii do przywrócenia.');
 const snap=entry.snapshot;
 const currentDraws=(await client.query("select user_id,round,stand,sector from draws where competition_id=$1 order by round,stand",[compId])).rows;
 const currentResults=(await client.query("select id from results where competition_id=$1",[compId])).rows;
 const currentItems=(await client.query("select id from result_items where competition_id=$1",[compId])).rows;
 const activeIds=(await client.query("select user_id from entries where competition_id=$1 and status='ACTIVE' order by user_id",[compId])).rows.map(x=>Number(x.user_id));
 const checked=canRestore({...comp,disabled_stands:disabledForComp(comp)},activeIds,snap,currentDraws,currentResults,currentItems,entry.operation);
 if(!checked.ready)throw new Error('Przywracanie zablokowane: '+checked.reasons.join(' '));
 if(entry.operation==='DRAW_RESET'&&snap.draws?.length)
  await client.query("insert into draws(competition_id,user_id,round,stand,sector,created_at) select $1,j.user_id,j.round,j.stand,j.sector,coalesce(j.created_at,now()) from jsonb_to_recordset($2::jsonb) as j(user_id bigint,round int,stand int,sector text,created_at timestamptz)",[compId,JSON.stringify(snap.draws)]);
 if(snap.results?.length)
  await client.query("insert into results(competition_id,user_id,round,weight,big_fish,updated_at) select $1,j.user_id,j.round,j.weight,j.big_fish,coalesce(j.updated_at,now()) from jsonb_to_recordset($2::jsonb) as j(user_id bigint,round int,weight int,big_fish int,updated_at timestamptz)",[compId,JSON.stringify(snap.results)]);
 if(snap.items?.length)
  await client.query("insert into result_items(competition_id,user_id,round,kind,weight,created_at,client_mutation_id) select $1,j.user_id,j.round,j.kind,j.weight,coalesce(j.created_at,now()),j.client_mutation_id from jsonb_to_recordset($2::jsonb) as j(user_id bigint,round int,kind text,weight int,created_at timestamptz,client_mutation_id text)",[compId,JSON.stringify(snap.items)]);
 await client.query("update competition_recoveries set restored_at=now() where id=$1",[entry.id]);
 return {id:Number(entry.id),operation:entry.operation,draws:(snap.draws||[]).length,results:(snap.results||[]).length,items:(snap.items||[]).length};
}
module.exports={initRecovery,capture,restore,lastRecovery,canRestore};
