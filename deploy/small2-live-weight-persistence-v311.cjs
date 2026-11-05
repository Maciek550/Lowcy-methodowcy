'use strict';
const fs=require('node:fs'), path=require('node:path'), crypto=require('node:crypto');
const root=path.join(process.env.HOME,'lowcy-small2-20261023');
const config=JSON.parse(fs.readFileSync(path.join(process.env.HOME,'.config/lowcy-small2/runtime.json'),'utf8'));
const target=new URL(config.DATABASE_URL);
if(target.hostname!=='pgsql3.small.pl'||target.pathname!=='/p1828_lowcy_kop'||target.username!=='p1828_lowcy_kop')throw Error('WRONG_TARGET');
const {Client}=require(path.join(root,'node_modules/pg'));
const jwt=require(path.join(root,'node_modules/jsonwebtoken'));
const base='https://lowcymethodowcy.smallhost.pl';
const tag='SMALL2-E2E-'+crypto.randomBytes(8).toString('hex');
const users=[], baseline={};
let competitionId=null;
const tables=['users','competitions','entries','draws','results','result_items','notifications'];
const quote=s=>'"'+s.replaceAll('"','""')+'"';
const readJson=async response=>({status:response.status,body:await response.json()});
function assert(v,message){if(!v)throw Error(message)}
const freshFetch=async(path,options={})=>readJson(await fetch(base+path,{...options,signal:AbortSignal.timeout(20000)}));
(async()=>{
  const c=new Client({connectionString:config.DATABASE_URL});
  await c.connect();
  try{
    const ident=await c.query('SELECT current_database() AS db');
    assert(ident.rows[0].db==='p1828_lowcy_kop','INVALID_DB_IDENTITY');
    for(const t of tables)baseline[t]=Number((await c.query('SELECT count(*)::int n FROM public.'+quote(t))).rows[0].n);
    assert(baseline.users===73 && baseline.competitions===7,'WRONG_BASELINE_USERS_OR_EVENTS');
    const admin=(await c.query("SELECT id,auth_version FROM users WHERE role='ADMIN' AND archived_at IS NULL ORDER BY id LIMIT 1")).rows[0];
    assert(admin,'MISSING_ADMIN');
    const token=jwt.sign({uid:admin.id,role:'ADMIN',v:Number(admin.auth_version||0)},config.JWT_SECRET,{expiresIn:'8m'});
    const headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
    // SQL fixtures bypass competition creation notifications. TEST state hides the event from players.
    for(let i=1;i<=2;i++){
      const r=await c.query("INSERT INTO users(phone,password_hash,first_name,last_name,pzw_club,role,account_source) VALUES($1,$2,'SMALL2','AUTOTEST','TEST','PLAYER','ADMIN') RETURNING id",
        [tag+'-'+i,'smoke-test-not-a-login-'+tag]);
      users.push(r.rows[0].id);
    }
    const event=(await c.query("INSERT INTO competitions(title,fishery,competition_date,limit_places,status,created_by,round_count,map_mode,bank1_count,bank2_count,sectors_count) VALUES($1,'AUTOTEST SMALL2','2027-11-05',2,'TEST',$2,2,'ONE_BANK',2,0,1) RETURNING id",[tag,admin.id])).rows[0];
    competitionId=event.id;
    for(const uid of users)await c.query("INSERT INTO entries(competition_id,user_id,status) VALUES($1,$2,'ACTIVE')",[competitionId,uid]);
    for(let round=1;round<=2;round++)
      for(let i=0;i<2;i++)
        await c.query("INSERT INTO draws(competition_id,user_id,round,stand,sector) VALUES($1,$2,$3,$4,'A')",[competitionId,users[i],round,round===1?i+1:2-i]);
    const detailsPath='/api/competitions/'+competitionId;
    let resp=await freshFetch(detailsPath,{headers});
    assert(resp.status===200&&resp.body.ok,'FIXTURE_DETAIL_NOT_ACCESSIBLE');
    assert(resp.body.entries.length===2&&resp.body.draws.length===4,'FIXTURE_ROUNDS_OR_ENTRY_MISMATCH');
    const add=async(uid,round,kind,weight,mutation)=>
      freshFetch('/api/admin/competitions/'+competitionId+'/results/'+round+'/items',
       {method:'POST',headers,body:JSON.stringify({userId:uid,round,kind,weight,clientMutationId:mutation})});
    let x=await add(users[0],1,'NET',1234,tag+'-NET1');
    assert(x.status===200&&x.body.ok&&Number(x.body.aggregate.weight)===1234,'FIRST_NET_SAVE_FAILED');
    const firstItemId=x.body.item.id;
    x=await add(users[0],1,'NET',1234,tag+'-NET1');
    assert(x.status===200&&x.body.ok&&String(x.body.item.id)===String(firstItemId),'OFFLINE_DEDUP_FAILED');
    x=await add(users[0],1,'NET',500,tag+'-NET2');
    assert(x.status===200&&Number(x.body.aggregate.weight)===1734,'SECOND_NET_SAVE_FAILED');
    const secondItemId=x.body.item.id;
    x=await add(users[0],1,'BF',220,tag+'-BF');
    assert(x.status===200&&Number(x.body.aggregate.big_fish)===220,'BF_SAVE_FAILED');
    x=await add(users[1],1,'NET',3000,tag+'-OTHER');
    assert(x.status===200&&Number(x.body.aggregate.weight)===3000,'OTHER_USER_NET_SAVE_FAILED');
    x=await add(users[0],2,'NET',1900,tag+'-ROUND2');
    assert(x.status===200&&Number(x.body.aggregate.weight)===1900,'ROUND2_SAVE_FAILED');
    resp=await freshFetch(detailsPath,{headers});
    assert(resp.status===200&&resp.body.ok,'READ_AFTER_WRITE_FAILED');
    assert(resp.body.results.length===3&&resp.body.resultItems.length===5,'RESULT_ROWS_NOT_PERSISTED');
    const round1=resp.body.results.find(r=>String(r.user_id)===String(users[0])&&Number(r.round)===1);
    const round2=resp.body.results.find(r=>String(r.user_id)===String(users[0])&&Number(r.round)===2);
    assert(round1&&Number(round1.weight)===1954&&Number(round1.big_fish)===220,'ROUND1_AGGREGATE_BAD');
    assert(round2&&Number(round2.weight)===1900,'ROUND2_AGGREGATE_BAD');
    assert(resp.body.classification?.round1?.length===2,'SECTOR_CLASSIFICATION_FAILED');
    const ranked=resp.body.classification.round1.find(r=>String(r.user_id)===String(users[1]));
    assert(ranked&&Number(ranked.weight)===3000,'RESULT_SECTOR_RANKING_MISSING');
    const removed=await freshFetch('/api/admin/results/items/'+secondItemId,{method:'DELETE',headers});
    assert(removed.status===200&&removed.body.ok&&Number(removed.body.aggregate.weight)===1454,'DELETE_WEIGHT_DID_NOT_REAGGREGATE');
    resp=await freshFetch(detailsPath,{headers});
    assert(resp.status===200&&resp.body.resultItems.length===4,'RELOAD_AFTER_DELETE_NOT_PERSISTED');
    const revised=resp.body.results.find(r=>String(r.user_id)===String(users[0])&&Number(r.round)===1);
    assert(revised&&Number(revised.weight)===1454,'UPDATED_AGGREGATE_NOT_PERSISTED');
    console.log('SMALL2_REAL_API_WEIGHTS_T1_T2_BF_DEDUP_DELETE_REREAD_OK');
  } finally {
    // Never delete any preexisting event: cleanup requires the exact randomized test title.
    try{
      if(competitionId!==null){
        const row=(await c.query('SELECT title,status FROM competitions WHERE id=$1',[competitionId])).rows[0];
        if(!row||row.title!==tag||row.status!=='TEST')throw Error('REFUSE_DELETE_NONTEST_COMPETITION');
        await c.query('DELETE FROM competitions WHERE id=$1 AND title=$2 AND status=$3',[competitionId,tag,'TEST']);
      }
      for(let i=0;i<users.length;i++){
        const deleted=await c.query('DELETE FROM users WHERE id=$1 AND phone=$2 RETURNING id',[users[i],tag+'-'+(i+1)]);
        if(deleted.rowCount!==1)throw Error('TEMP_PLAYER_CLEANUP_FAILED');
      }
      for(const t of tables){
        const count=Number((await c.query('SELECT count(*)::int n FROM public.'+quote(t))).rows[0].n);
        assert(count===baseline[t],'BASELINE_NOT_RESTORED_'+t+'_'+count);
      }
      console.log('SMALL2_TEST_FIXTURES_REMOVED_ORIGINAL_COUNTS_PRESERVED '+JSON.stringify(baseline));
    }finally{await c.end()}
  }
})().catch(error=>{console.error('SMALL2_API_WRITE_TEST_FAILED '+error.message);process.exitCode=1});
