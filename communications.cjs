'use strict';
// V228: admin-to-player messages. Stored notifications are retained in the normal inbox.
const MODES=new Set(['NOTIFICATION','POPUP','ALL']);
const CHANNELS=new Set(['INBOX','POPUP','PUSH']);
function normalizeChannels(input,legacyMode='NOTIFICATION'){
  if(input?.channels===undefined){
    if(legacyMode==='ALL')return ['INBOX','POPUP','PUSH'];
    if(legacyMode==='POPUP')return ['INBOX','POPUP'];
    return ['INBOX'];
  }
  if(!Array.isArray(input.channels)||!input.channels.length||input.channels.length>3)
    throw new Error('Wybierz co najmniej jeden sposób wysyłki.');
  const selected=input.channels.map(c=>String(c).toUpperCase());
  if(selected.some(c=>!CHANNELS.has(c))||new Set(selected).size!==selected.length)
    throw new Error('Nieprawidłowy zestaw sposobów wysyłki.');
  return ['INBOX','POPUP','PUSH'].filter(c=>selected.includes(c));
}
function normalizeMessage(input){
  const body=String(input?.body||'').replace(/\r\n?/g,'\n').trim();
  const mode=String(input?.mode||'NOTIFICATION').toUpperCase();
  if(!body||body.length>700)throw new Error('Wiadomość musi mieć od 1 do 700 znaków.');
  if(!MODES.has(mode))throw new Error('Nieprawidłowy sposób dostarczenia wiadomości.');
  return {body,mode};
}
async function init(pool){
  await pool.query("alter table notifications add column if not exists popup_seen_at timestamptz");
  await pool.query("create table if not exists admin_message_batches (id bigserial primary key, sender_user_id bigint not null references users(id), competition_id bigint references competitions(id) on delete set null, recipient_label text not null, recipient_count integer not null default 0, body text not null, display_mode text not null, created_at timestamptz not null default now())");
  await pool.query("create index if not exists admin_message_batches_recent_idx on admin_message_batches(sender_user_id,created_at desc)");
}
async function route(ctx){
  const {req,res,user,path,method,url,pool,sendJson,readBody,requireAdmin,requireUser,pushToUser,getPlayerAttention}=ctx;
  const mark=path.match(/^\/api\/notifications\/(\d+)\/popup-seen$/);
  if(mark&&method==='POST'){
    if(!requireUser(user,res))return true;
    await pool.query("update notifications set popup_seen_at=coalesce(popup_seen_at,now()) where id=$1 and recipient_user_id=$2",[Number(mark[1]),user.id]);
    sendJson(res,200,{ok:true});return true;
  }
  if(path==='/api/admin/messages'&&method==='GET'){
    if(!requireAdmin(user,res))return true;
    const limit=Math.min(50,Math.max(1,Number(url.searchParams.get('limit')||15)));
    const q=await pool.query("select b.id,b.recipient_label,b.recipient_count,b.body,b.display_mode,b.created_at,c.title competition_title,(select count(*)::int from notifications n where n.type='ADMIN_MESSAGE' and n.data->>'batchId'=b.id::text and n.read_at is not null) read_count from admin_message_batches b left join competitions c on c.id=b.competition_id where b.sender_user_id=$1 order by b.created_at desc,b.id desc limit $2",[user.id,limit]);
    sendJson(res,200,{ok:true,messages:q.rows});return true;
  }
  if(path==='/api/admin/messages'&&method==='POST'){
    if(!requireAdmin(user,res))return true;
    const b=await readBody(req);
    let text,mode,channels;try{({body:text,mode}=normalizeMessage(b));channels=normalizeChannels(b,mode)}catch(e){sendJson(res,400,{ok:false,error:e.message});return true}
    const compId=Number(b.competitionId||0),userId=Number(b.userId||0);
    const group=String(b.group||'ACTIVE').toUpperCase();
    if(!Number.isSafeInteger(compId)||compId<0||!Number.isSafeInteger(userId)||userId<0){sendJson(res,400,{ok:false,error:'Nieprawidłowy identyfikator'});return true}
    let compStatus='OPEN';
    if(compId){
      const cq=await pool.query("select id,title,status from competitions where id=$1",[compId]);
      if(!cq.rows[0]||cq.rows[0].status==='TEST'){sendJson(res,409,{ok:false,error:'Wysyłka wymaga prawdziwych, istniejących zawodów.'});return true}
      compStatus=cq.rows[0].status;
    }
    let recipients=[],label='',compTitle='';
    if(compId){const cq=await pool.query("select title from competitions where id=$1",[compId]);compTitle=cq.rows[0]?.title||''}
    if(userId){
      const q=await pool.query("select u.id,u.first_name,u.last_name from users u where u.id=$1 and u.role='PLAYER' and u.archived_at is null and ($2::bigint=0 or exists(select 1 from entries e where e.user_id=u.id and e.competition_id=$2 and e.status in ('ACTIVE','RESERVE'))) and ($3::boolean or exists(select 1 from competition_invitations i where i.competition_id=$2 and i.user_id=u.id))",[userId,compId,compStatus!=='PRIVATE']);
      recipients=q.rows;label=recipients[0]?(recipients[0].first_name+' '+recipients[0].last_name):'';
    }else{
      if(!compId||!['ACTIVE','RESERVE','ALL','UNCONFIRMED'].includes(group)){sendJson(res,400,{ok:false,error:'Wybierz zawody oraz poprawną grupę odbiorców.'});return true}
      const q=await pool.query("select distinct u.id,u.first_name,u.last_name from entries e join users u on u.id=e.user_id and u.role='PLAYER' and u.archived_at is null where e.competition_id=$1 and ($2='ALL' and e.status in ('ACTIVE','RESERVE') or $2='ACTIVE' and e.status='ACTIVE' or $2='RESERVE' and e.status='RESERVE' or $2='UNCONFIRMED' and e.status='ACTIVE' and e.confirmed=false) and ($3::boolean or exists(select 1 from competition_invitations i where i.competition_id=$1 and i.user_id=u.id)) order by u.last_name,u.first_name",[compId,group,compStatus!=='PRIVATE']);
      recipients=q.rows;label={ACTIVE:'Lista główna',RESERVE:'Rezerwa',ALL:'Główna i rezerwa',UNCONFIRMED:'Niepotwierdzeni'}[group]||group;
    }
    if(!recipients.length){sendJson(res,409,{ok:false,error:'Brak uprawnionych odbiorców w wybranej grupie.'});return true}
    if(recipients.length>150){sendJson(res,413,{ok:false,error:'Jednorazowo można powiadomić najwyżej 150 zawodników.'});return true}
    const q=await pool.query("insert into admin_message_batches(sender_user_id,competition_id,recipient_label,recipient_count,body,display_mode) values($1,$2,$3,$4,$5,$6) returning id",[user.id,compId||null,label,recipients.length,text,b.channels===undefined?mode:channels.join('+')]);
    const batchId=Number(q.rows[0].id),title=compTitle?'Wiadomość: '+compTitle:'Wiadomość od organizatora';
    const payload=compTitle?compTitle+': '+text:text;
    // Count the newly inserted unread message in the app-icon badge.
    for(const r of recipients){
      await pool.query("insert into notifications(recipient_user_id,type,title,body,data) values($1,'ADMIN_MESSAGE',$2,$3,$4)",[r.id,title,payload,{batchId,competitionId:compId||null,displayMode:mode,inboxEnabled:channels.includes('INBOX'),popupEnabled:channels.includes('POPUP'),pushEnabled:channels.includes('PUSH'),deliveryChannels:channels,url:'/'}]);
    }
    const pushJobs=channels.includes('PUSH')?recipients.map(async r=>{
      let badgeCount=channels.includes('INBOX')?1:0;
      try{
        const [attention,manual]=await Promise.all([
          getPlayerAttention(r.id),
          pool.query("select count(*)::int as n from notifications where recipient_user_id=$1 and read_at is null and type='ADMIN_MESSAGE' and data->>'inboxEnabled' is distinct from 'false'",[r.id])
        ]);
        badgeCount=Math.max(0,Number(attention?.count||0)+Number(manual.rows[0]?.n||0));
      }catch(e){console.error('ADMIN_MESSAGE_BADGE_ERR',e.message)}
      return pushToUser(r.id,title,payload,'/',{type:'ADMIN_MESSAGE',competitionId:compId||null,badgeCount});
    }):[];
    let pushSent=0,pushFailed=0,pushUnavailable=0;
    for(const result of await Promise.allSettled(pushJobs)){
      if(result.status==='fulfilled'){
        pushSent+=Number(result.value.sent||0);
        pushFailed+=Number(result.value.failed||0);
        if(!Number(result.value.sent||0))pushUnavailable++;
      }else{pushFailed++;pushUnavailable++}
    }
    sendJson(res,200,{ok:true,batchId,delivered:recipients.length,pushSent,pushFailed,pushUnavailable});return true;
  }
  return false;
}
module.exports={init,route,normalizeMessage,normalizeChannels};
