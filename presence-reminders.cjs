'use strict';
// V229: one inbox + one PUSH reminder per unconfirmed entrant, at D-2 (or catch-up).
function dateKey(value){if(value instanceof Date)return value.toISOString().slice(0,10);return String(value||'').slice(0,10)}
function normalizeOrganizerNote(value){
  const note=String(value??'').replace(/\r\n?/g,'\n').trim();
  if(note.length>160)throw new Error('Treść do dymku potwierdzenia może mieć maksymalnie 160 znaków.');
  return note;
}
function formatCompetitionDate(value){
  const key=dateKey(value);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(key))return '';
  return new Intl.DateTimeFormat('pl-PL',{timeZone:'Europe/Warsaw',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(key+'T12:00:00Z'));
}
async function init(pool){
  await pool.query("create unique index if not exists presence_reminder_2d_once_idx on notifications(recipient_user_id,(data->>'competitionId')) where type='PRESENCE_REMINDER_2D'");
}
async function ensureTwoDayReminders({pool,pushToUser,getPlayerAttention}){
  const q=await pool.query("select e.user_id,c.id competition_id,c.title,c.fishery,c.competition_date,c.presence_reminder_note,(c.competition_date::date-(now() at time zone 'Europe/Warsaw')::date)::int days_left from entries e join competitions c on c.id=e.competition_id join users u on u.id=e.user_id and u.role='PLAYER' and u.archived_at is null where e.status='ACTIVE' and e.confirmed=false and c.status<>'TEST' and c.competition_date is not null and (c.competition_date::date-(now() at time zone 'Europe/Warsaw')::date)::int between 0 and 2 and not exists(select 1 from notifications n where n.recipient_user_id=e.user_id and n.type='PRESENCE_REMINDER_2D' and n.data->>'competitionId'=c.id::text) order by c.competition_date,e.id");
  let created=0,pushSent=0,pushFailed=0;
  for(const r of q.rows){
    const uid=Number(r.user_id),cid=Number(r.competition_id);
    const date=dateKey(r.competition_date),fullDate=formatCompetitionDate(r.competition_date);
    const title='Potwierdź udział w zawodach',fishery=String(r.fishery||''),organizerNote=normalizeOrganizerNote(r.presence_reminder_note);
    const body=String(r.title||'Zawody')+' · '+(fishery||'Łowisko')+' · '+fullDate+'. Potwierdź udział w aplikacji.'+(organizerNote?' '+organizerNote:'');
    const data={competitionId:cid,competitionTitle:r.title||'',fishery,competitionDate:date,organizerNote,displayMode:'ALL',url:'/'};
    const inserted=await pool.query("insert into notifications(recipient_user_id,type,title,body,data) select $1,'PRESENCE_REMINDER_2D',$2,$3,$4 where exists(select 1 from entries e join competitions c on c.id=e.competition_id where e.user_id=$1 and e.competition_id=$5 and e.status='ACTIVE' and e.confirmed=false and c.status<>'TEST' and (c.competition_date::date-(now() at time zone 'Europe/Warsaw')::date)::int between 0 and 2) on conflict do nothing returning id",[uid,title,body,data,cid]);
    if(!inserted.rows.length)continue;
    created++;
    const still=await pool.query("select 1 from entries where user_id=$1 and competition_id=$2 and status='ACTIVE' and confirmed=false",[uid,cid]);
    if(!still.rows.length){await pool.query("update notifications set read_at=now() where id=$1",[inserted.rows[0].id]);continue}
    try{
      const attention=await getPlayerAttention(uid);
      const manual=await pool.query("select count(*)::int as n from notifications where recipient_user_id=$1 and read_at is null and type='ADMIN_MESSAGE' and data->>'inboxEnabled' is distinct from 'false'",[uid]);
      const badgeCount=Number(attention.count||0)+Number(manual.rows[0]?.n||0);
      const result=await pushToUser(uid,title,body,'/',{type:'PRESENCE_REMINDER_2D',competitionId:cid,badgeCount});
      pushSent+=Number(result.sent||0);pushFailed+=Number(result.failed||0);
    }catch(e){pushFailed++;console.error('PRESENCE_REMINDER_PUSH_ERR',e.message)}
  }
  return {created,pushSent,pushFailed};
}
module.exports={init,ensureTwoDayReminders,dateKey,formatCompetitionDate,normalizeOrganizerNote};
