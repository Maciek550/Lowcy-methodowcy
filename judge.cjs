'use strict';
// Explicit judge allow-list, independent of administrative and player routes.
module.exports=function judgeRoutes({pool,bcrypt,readBody,sendJson,requireAdmin,normalizePhone,buildDetail,addResultItem,deleteResultItem,refreshResultAggregate}){
  const allowed=async(user,id)=>(await pool.query("select 1 from competition_judges j join users u on u.id=j.user_id where j.user_id=$1 and j.competition_id=$2 and u.role='JUDGE' and u.judge_enabled=true",[user.id,id])).rows.length>0;
  const fail=(res,status,error)=>sendJson(res,status,{ok:false,error});
  function safeDetail(d){
    const clean=e=>({id:e.id,user_id:e.user_id,first_name:e.first_name,last_name:e.last_name,pzw_club:e.pzw_club,status:e.status});
    d.entries=d.activeEntries.map(clean);d.activeEntries=d.entries;d.reserveEntries=[];d.cancelledEntries=[];d.myEntry=null;
    for(const rows of Object.values(d.classification))for(const r of rows)delete r.phone;
    return d;
  }
  return async function handleJudgeRoutes(req,res,path,method,user){
    const management=path==='/api/admin/judges'||/^\/api\/admin\/judges\/\d+$/.test(path);
    if(management){
      if(!requireAdmin(user,res))return true;
      if(path==='/api/admin/judges'&&method==='GET'){
        const judges=(await pool.query("select u.id,u.phone,u.first_name,u.last_name,u.judge_enabled,coalesce((select json_agg(j.competition_id) from competition_judges j where j.user_id=u.id),'[]'::json) competition_ids from users u where u.role='JUDGE' order by u.last_name,u.first_name")).rows;
        const competitions=(await pool.query('select id,title,competition_date,fishery from competitions order by competition_date desc nulls last,id desc')).rows;
        sendJson(res,200,{ok:true,judges,competitions});return true;
      }
      const create=path==='/api/admin/judges'&&method==='POST',update=/^\/api\/admin\/judges\/\d+$/.test(path)&&method==='PUT';
      if(!create&&!update){fail(res,405,'Niedozwolona operacja');return true}
      const b=await readBody(req),first=String(b.firstName||'').trim(),last=String(b.lastName||'').trim(),phone=normalizePhone(b.phone),password=String(b.password||'');
      if(!first||!last||!phone||(create&&!password)||((create||password)&&(password.length<8||password.length>128))){fail(res,400,'Podaj imię, nazwisko, telefon i hasło o długości 8–128 znaków.');return true}
      if(!Array.isArray(b.competitionIds)||b.competitionIds.some(x=>!Number.isSafeInteger(Number(x))||Number(x)<=0)){fail(res,400,'Nieprawidłowa lista zawodów');return true}
      const ids=[...new Set(b.competitionIds.map(Number))],hash=password?await bcrypt.hash(password,12):null,client=await pool.connect();
      try{
        await client.query('begin');
        const existing=(await client.query('select id from competitions where id=any($1::bigint[])',[ids])).rows;
        if(existing.length!==ids.length){await client.query('rollback');fail(res,400,'Lista zawodów zmieniła się. Odśwież formularz.');return true}
        let id;
        if(create){id=(await client.query("insert into users(phone,password_hash,first_name,last_name,pzw_club,role,account_source,judge_enabled) values($1,$2,$3,$4,'','JUDGE','JUDGE',true) returning id",[phone,hash,first,last])).rows[0].id}
        else{
          id=Number(path.split('/').pop());
          const result=await client.query("update users set phone=$1,first_name=$2,last_name=$3,password_hash=coalesce($4,password_hash),judge_enabled=$5 where id=$6 and role='JUDGE' returning id",[phone,first,last,hash,b.enabled!==false,id]);
          if(!result.rows.length){await client.query('rollback');fail(res,404,'Nie znaleziono konta sędziego');return true}
        }
        await client.query('delete from competition_judges where user_id=$1',[id]);
        if(ids.length)await client.query('insert into competition_judges(user_id,competition_id) select $1,unnest($2::bigint[])',[id,ids]);
        await client.query('commit');sendJson(res,200,{ok:true,id});
      }catch(e){await client.query('rollback');if(e.code==='23505')fail(res,409,'Ten numer telefonu jest już używany. Użyj oddzielnego numeru konta sędziego.');else throw e}
      finally{client.release()}
      return true;
    }
    if(user?.role!=='JUDGE')return false;
    if(user.judge_enabled===false){fail(res,403,'Konto sędziego jest wyłączone');return true}
    if(path==='/api/me'&&method==='GET'){sendJson(res,200,{ok:true,user});return true}
    if(path==='/api/push-subscription'&&method==='DELETE'){await pool.query('delete from push_subscriptions where user_id=$1',[user.id]);sendJson(res,200,{ok:true});return true}
    if(path==='/api/competitions'&&method==='GET'){
      const competitions=(await pool.query('select c.id,c.title,c.fishery,c.competition_date,c.status from competitions c join competition_judges j on j.competition_id=c.id where j.user_id=$1 order by c.competition_date desc nulls last,c.id desc',[user.id])).rows;
      sendJson(res,200,{ok:true,competitions});return true;
    }
    let m=path.match(/^\/api\/competitions\/(\d+)$/);
    if(m&&method==='GET'){
      if(!await allowed(user,Number(m[1]))){fail(res,403,'Te zawody nie są przypisane do Twojego konta');return true}
      const d=await buildDetail(Number(m[1]),user);if(!d)fail(res,404,'Nie znaleziono zawodów');else sendJson(res,200,safeDetail(d));return true;
    }
    m=path.match(/^\/api\/admin\/competitions\/(\d+)\/results\/(1|2)(\/items)?$/);
    if(m&&method==='POST'){
      const id=Number(m[1]),round=Number(m[2]);
      if(!await allowed(user,id)){fail(res,403,'Nie masz dostępu do wyników tych zawodów');return true}
      const b=await readBody(req);
      if(m[3]){
        if(!['NET','BF'].includes(b.kind)||!Number.isSafeInteger(Number(b.userId))){fail(res,400,'Nieprawidłowy wpis wagi');return true}
        try{const out=await addResultItem(id,Number(b.userId),round,b.kind,b.weight);sendJson(res,200,{ok:true,item:out.item,aggregate:out.aggregate})}catch(e){fail(res,400,e.message)}
      }else{
        // Recalculate current entries only: ignore client-supplied weights and user IDs.
        const entries=(await pool.query("select user_id from entries where competition_id=$1 and status='ACTIVE'",[id])).rows,client=await pool.connect();
        try{await client.query('begin');for(const e of entries)await refreshResultAggregate(client,id,e.user_id,round);await client.query('commit');sendJson(res,200,{ok:true})}catch(e){await client.query('rollback');throw e}finally{client.release()}
      }
      return true;
    }
    m=path.match(/^\/api\/admin\/results\/items\/(\d+)$/);
    if(m&&method==='DELETE'){
      const item=(await pool.query('select competition_id from result_items where id=$1',[Number(m[1])])).rows[0];
      if(!item||!await allowed(user,Number(item.competition_id))){fail(res,403,'Nie masz dostępu do tego wpisu wagi');return true}
      try{await deleteResultItem(Number(m[1]));sendJson(res,200,{ok:true})}catch(e){fail(res,400,e.message)}return true;
    }
    fail(res,403,'Sędzia może tylko wpisywać i przeglądać wyniki przypisanych zawodów');return true;
  };
};
