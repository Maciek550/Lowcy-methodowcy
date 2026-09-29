'use strict';
// V234: operator-mediated recovery. The application never sends SMS itself.
const crypto=require('crypto');
const DEFAULT_PASSWORD='12345678';
const ACK='Jeśli numer jest przypisany do konta zawodnika, prośba trafi do administratora.';
const ipTraffic=new Map();
function phoneVariants(raw){
  const clean=String(raw||'').replace(/[\s()\-]/g,'');
  const digits=clean.replace(/^\+/,'');
  const local=digits.startsWith('48')&&digits.length===11?digits.slice(2):digits;
  if(!/^\d{9}$/.test(local))return [];
  return [local,'+48'+local,'48'+local];
}
function smsBody(name,password){
  return 'Łowcy Methodowcy: nowe hasło tymczasowe: '+password+'. Zaloguj się swoim numerem telefonu i od razu zmień hasło w aplikacji. Hasło jest ważne 24 godziny.';
}
function allowIp(req){
  const now=Date.now();
  const ip=String(req.headers['x-forwarded-for']||req.socket?.remoteAddress||'').split(',')[0].trim().slice(0,64);
  const key=crypto.createHash('sha256').update(ip).digest('hex');
  if(ipTraffic.size>3000)for(const [k,v] of ipTraffic)if(now-v.from>900000)ipTraffic.delete(k);
  const found=ipTraffic.get(key);
  if(!found||now-found.from>900000){ipTraffic.set(key,{from:now,count:1});return true}
  found.count++;return found.count<=20;
}
async function init(pool){
  await pool.query("alter table users add column if not exists auth_version integer not null default 0");
  await pool.query("alter table users add column if not exists password_must_change boolean not null default false");
  await pool.query("alter table users add column if not exists password_temp_expires_at timestamptz");
  await pool.query(
    "create table if not exists password_reset_requests ("+
    "id bigserial primary key,"+
    "user_id bigint not null references users(id) on delete cascade,"+
    "status text not null default 'PENDING' check(status in ('PENDING','PREPARED','SENT','REJECTED')),"+
    "created_at timestamptz not null default now(),"+
    "prepared_at timestamptz,"+
    "prepared_by bigint references users(id),"+
    "sent_at timestamptz,"+
    "expires_at timestamptz)"
  );
  await pool.query("create unique index if not exists password_reset_one_open_idx on password_reset_requests(user_id) where status in ('PENDING','PREPARED')");
}
function makeRoute({pool,bcrypt,readBody,sendJson,requireAdmin,notifyAdmins}){
  return async function passwordResetRoute(req,res,path,method,user){
    if(path==='/api/password-reset/request'&&method==='POST'){
      const b=await readBody(req),phones=phoneVariants(b.phone);
      if(!phones.length)return sendJson(res,400,{ok:false,error:'Podaj poprawny dziewięciocyfrowy numer telefonu.'}),true;
      if(!allowIp(req))return sendJson(res,200,{ok:true,message:ACK}),true;
      const q=await pool.query("select id,phone,first_name,last_name from users where phone=any($1::text[]) and role='PLAYER' and archived_at is null order by case when phone=$2 then 0 else 1 end limit 1",[phones,phones[0]]);
      const person=q.rows[0];
      if(person){
        const recent=await pool.query("select count(*)::int n from password_reset_requests where user_id=$1 and created_at>now()-interval '24 hours'",[person.id]);
        if(Number(recent.rows[0]?.n||0)<3){
          const inserted=await pool.query("insert into password_reset_requests(user_id) values($1) on conflict do nothing returning id",[person.id]);
          if(inserted.rows.length){
            try{await notifyAdmins('PASSWORD_RESET_REQUEST','Prośba o nowe hasło',person.first_name+' '+person.last_name+' prosi o nowe hasło.',{resetRequestId:Number(inserted.rows[0].id),url:'/admin'})}
            catch(error){console.error('PASSWORD_RESET_NOTIFY_FAILED',error.message)}
          }
        }
      }
      return sendJson(res,200,{ok:true,message:ACK}),true;
    }
    if(!path.startsWith('/api/admin/password-resets'))return false;
    if(!user)return false;
    if(!requireAdmin(user,res))return true;
    if(path==='/api/admin/password-resets'&&method==='GET'){
      const q=await pool.query("select r.id,r.status,r.created_at,r.prepared_at,r.expires_at,u.first_name,u.last_name,u.phone from password_reset_requests r join users u on u.id=r.user_id and u.role='PLAYER' and u.archived_at is null where r.status in ('PENDING','PREPARED') order by case r.status when 'PENDING' then 0 else 1 end,r.created_at asc limit 100");
      sendJson(res,200,{ok:true,requests:q.rows});return true;
    }
    const match=path.match(/^\/api\/admin\/password-resets\/(\d+)\/(prepare|sent|reject)$/);
    if(!match||method!=='POST'){sendJson(res,404,{ok:false,error:'Nie znaleziono operacji'});return true}
    const id=Number(match[1]),op=match[2];
    if(op==='prepare'){
      const password=DEFAULT_PASSWORD,hash=await bcrypt.hash(password,12),client=await pool.connect();
      try{
        await client.query('begin');
        const q=await client.query("select r.id,r.status,r.user_id,r.expires_at,u.first_name,u.last_name,u.phone from password_reset_requests r join users u on u.id=r.user_id and u.archived_at is null and u.role='PLAYER' where r.id=$1 for update of r,u",[id]);
        const item=q.rows[0];
        if(!item||!['PENDING','PREPARED'].includes(item.status)){await client.query('rollback');sendJson(res,409,{ok:false,error:'Ta prośba nie jest już aktywna.'});return true}
        if(item.status==='PENDING'){
          await client.query("update users set password_hash=$1,password_must_change=true,password_temp_expires_at=now()+interval '24 hours',auth_version=auth_version+1 where id=$2",[hash,item.user_id]);
          await client.query("update password_reset_requests set status='PREPARED',prepared_by=$1,prepared_at=now(),expires_at=now()+interval '24 hours' where id=$2",[user.id,id]);
        }else if(item.expires_at&&new Date(item.expires_at).getTime()<Date.now()){
          // Reissue the same default temporary password only on explicit admin action.
          await client.query("update users set password_hash=$1,password_must_change=true,password_temp_expires_at=now()+interval '24 hours',auth_version=auth_version+1 where id=$2",[hash,item.user_id]);
          await client.query("update password_reset_requests set prepared_by=$1,prepared_at=now(),expires_at=now()+interval '24 hours' where id=$2",[user.id,id]);
        }
        await client.query('commit');
        sendJson(res,200,{ok:true,phone:item.phone,body:smsBody(item.first_name,password),expiresAt:item.status==='PENDING'||(item.expires_at&&new Date(item.expires_at).getTime()<Date.now())?new Date(Date.now()+24*3600000).toISOString():item.expires_at});
      }catch(e){await client.query('rollback');throw e}finally{client.release()}
      return true;
    }
    if(op==='sent'){
      const q=await pool.query("update password_reset_requests set status='SENT',sent_at=now() where id=$1 and status='PREPARED' returning id",[id]);
      return sendJson(res,q.rowCount?200:409,q.rowCount?{ok:true}:{ok:false,error:'Najpierw przygotuj SMS.'}),true;
    }
    if(op==='reject'){
      const q=await pool.query("update password_reset_requests set status='REJECTED' where id=$1 and status='PENDING' returning id",[id]);
      return sendJson(res,q.rowCount?200:409,q.rowCount?{ok:true}:{ok:false,error:'Można odrzucić tylko nieprzygotowaną prośbę.'}),true;
    }
    return false;
  };
}
module.exports={init,makeRoute,phoneVariants,smsBody};
