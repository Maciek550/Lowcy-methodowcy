const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: false, max: 1 });

const players = [
  ['Rafał Siporski', ['C',21,23500,0], ['B',26,25280,0]],
  ['Maciek Fabisiak', ['D',16,8290,0], ['A',27,17750,7330]],
  ['Radek Łukasiewicz', ['C',8,11260,0], ['C',10,43500,0]],
  ['Marcin Czarnocki', ['B',6,11160,0], ['D',15,20600,0]],
  ['Krzysztof Krupiński', ['D',17,3530,0], ['A',29,15170,0]],
  ['Jakub Pieniak', ['B',24,14250,7350], ['D',18,15770,0]],
  ['Tomasz Rek', ['C',20,8600,0], ['B',24,21160,0]],
  ['Jacek Olewiński', ['A',29,9630,0], ['C',21,25660,0]],
  ['Kamil Bieńczak', ['B',26,15590,9320], ['C',22,16850,0]],
  ['Paweł Kępa', ['B',5,10660,0], ['D',12,17100,0]],
  ['Henryk Lipski', ['A',1,10720,0], ['D',14,12500,0]],
  ['Bogdan Shubak', ['D',15,3490,0], ['A',3,13310,0]],
  ['Sylwek Orzechowski', ['A',4,20060,0], ['C',8,15650,0]],
  ['Piotr Rostkowski', ['B',7,2360,0], ['C',11,26100,0]],
  ['Damian Abram', ['C',22,5100,0], ['B',25,12920,0]],
  ['Александр Слепченко', ['D',14,2660,0], ['B',7,11910,0]],
  ['Radek Jastrzębski', ['B',25,3500,0], ['C',20,19770,0]],
  ['Aliaksei Kavalenka', ['C',11,4850,0], ['A',1,13180,0]],
  ['Piotr Muranowicz', ['D',12,0,0], ['B',5,16000,0]],
  ['Volodymyr Tsimmerman', ['B',23,4630,0], ['D',16,11340,0]],
  ['Jacek Dorant', ['C',10,8300,0], ['A',4,6080,0]],
  ['Kamil Burczyński', ['A',3,5040,0], ['D',13,9110,0]],
  ['Rafał Klimkiewicz', ['D',19,2490,0], ['B',23,8620,0]],
  ['Bartosz Zduńczyk', ['A',2,1090,0], ['C',9,12060,0]],
  ['Michał Fabisiak', ['D',13,0,0], ['A',2,6230,0]],
  ['Wojtek Wojno', ['A',28,0,0], ['D',19,8420,0]],
  ['Dariusz Jasiński', ['A',27,1030,0], ['D',17,6200,0]],
  ['Jurij Marynets', ['C',9,0,0], ['B',6,2320,0]]
];

const expectedOrder = players.map(x => x[0]);
const expectedPoints = [2,2,3,4,4,5,5,6,6,6,6,6,7,9,9,9,10,10,10,10,10,10,11,12,12,14,14,14];

function norm(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ł/g,'l').replace(/\s+/g,' ').trim();
}
function splitName(name) {
  const p = String(name).trim().split(/\s+/); return { first:p.shift() || '', last:p.join(' ') };
}
function matchesSource(source, user) {
  const s = norm(source), u = norm(`${user.first_name} ${user.last_name}`);
  if (s === u) return true;
  return s === 'maciek fabisiak' && u === 'maciej fabisiak';
}
function classifySource() {
  const rounds = {};
  for (const round of [1,2]) {
    const grouped = new Map();
    for (const p of players) {
      const d = p[round];
      if (!grouped.has(d[0])) grouped.set(d[0], []);
      grouped.get(d[0]).push({ name:p[0], weight:d[2], points:0 });
    }
    const sizes = [...grouped.values()].map(x=>x.length);
    const zeroPoints = Math.max(...sizes);
    const byName = new Map();
    for (const rows of grouped.values()) {
      const positives = rows.filter(x=>x.weight>0).sort((a,b)=>b.weight-a.weight || a.name.localeCompare(b.name,'pl'));
      for (let i=0;i<positives.length;) {
        let j=i+1; while(j<positives.length && positives[j].weight===positives[i].weight) j++;
        const pts=((i+1)+j)/2;
        for(let k=i;k<j;k++){ positives[k].points=pts; byName.set(positives[k].name,pts); }
        i=j;
      }
      for(const r of rows.filter(x=>x.weight<=0)) byName.set(r.name,zeroPoints);
    }
    rounds[round]=byName;
  }
  return players.map(p=>({name:p[0],points:rounds[1].get(p[0])+rounds[2].get(p[0]),weight:p[1][2]+p[2][2]}))
    .sort((a,b)=>a.points-b.points || b.weight-a.weight || a.name.localeCompare(b.name,'pl'));
}

async function main() {
  const sourceClass = classifySource();
  if (sourceClass.length !== 28 || sourceClass.some((x,i)=>x.name!==expectedOrder[i] || x.points!==expectedPoints[i])) {
    throw new Error('Source classification self-check failed');
  }
  const sourceWeight = players.reduce((s,p)=>s+p[1][2]+p[2][2],0);
  if (sourceWeight !== 622350) throw new Error('Source weight self-check failed');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const comp = (await client.query(`
      select c.id,c.competition_date,c.status,
        (select count(*)::int from entries e where e.competition_id=c.id) entries,
        (select count(*)::int from draws d where d.competition_id=c.id) draws,
        (select count(*)::int from results r where r.competition_id=c.id) results
      from competitions c where c.id=1 for update
    `)).rows[0];
    if (!comp) throw new Error('Competition ID 1 not found');

    if (Number(comp.entries)===28 && Number(comp.draws)===56 && Number(comp.results)===56) {
      await client.query('ROLLBACK');
      console.log('LASOMIN_RECOVERY_ALREADY_DONE');
      return;
    }
    if (String(comp.competition_date).slice(0,10)!=='2026-09-26' || comp.status!=='TEST') throw new Error('Safety check: ID 1 is not TEST 2026-09-26');
    if (Number(comp.entries)||Number(comp.draws)||Number(comp.results)) throw new Error(`Safety check: competition not empty ${comp.entries}/${comp.draws}/${comp.results}`);

    const layout = [
      {name:'A',stands:[1,2,3,4,27,28,29]},
      {name:'B',stands:[5,6,7,23,24,25,26]},
      {name:'C',stands:[8,9,10,11,20,21,22]},
      {name:'D',stands:[12,13,14,15,16,17,18,19]}
    ];
    await client.query(`update competitions set
      title=$1, fishery=$2, limit_places=28, signup_open=false, round_count=2, meeting_time='06:00',
      map_mode='TWO_OPPOSITE', bank1_count=15, bank2_count=14, sectors_count=4,
      sector_layout=$3::jsonb, disabled_stands='[]'::jsonb, zero_score_rule='MAX'
      where id=1`, ['Method Feeder - Gandalf CUP','Łowisko Lasomin',JSON.stringify(layout)]);

    const users = (await client.query(`select id,first_name,last_name,role,account_source,last_login_at from users where archived_at is null order by (last_login_at is not null) desc,id asc`)).rows;
    const used = new Set(), linked = [], created = [];

    for (let i=0;i<players.length;i++) {
      const [name,t1,t2] = players[i];
      let user = users.find(u=>!used.has(Number(u.id)) && matchesSource(name,u));
      let uid;
      if (user) {
        uid=Number(user.id);
        linked.push({source:name,id:uid,account:`${user.first_name} ${user.last_name}`,role:user.role});
      } else {
        const {first,last}=splitName(name);
        const phone=`ZPRO-HIST79-${String(i+1).padStart(2,'0')}`;
        const out=await client.query(`insert into users(phone,password_hash,first_name,last_name,pzw_club,role,account_source,last_login_at,last_active_at,archived_at)
          values($1,'!', $2,$3,'','PLAYER','EXTERNAL',null,null,null) returning id,first_name,last_name,role,account_source,last_login_at`,[phone,first,last]);
        user=out.rows[0]; uid=Number(user.id); users.push(user); created.push({source:name,id:uid});
      }
      used.add(uid);
      await client.query(`insert into entries(competition_id,user_id,status,joined_at,cancelled_at,confirmed,confirmed_at)
        values(1,$1,'ACTIVE',now(),null,true,now())`,[uid]);

      for (const [round,d] of [[1,t1],[2,t2]]) {
        const [sector,stand,total,bf]=d;
        await client.query(`insert into draws(competition_id,user_id,round,stand,sector) values(1,$1,$2,$3,$4)`,[uid,round,stand,sector]);
        const net=Number(total)-Number(bf);
        if(net>0) await client.query(`insert into result_items(competition_id,user_id,round,kind,weight) values(1,$1,$2,'NET',$3)`,[uid,round,net]);
        if(Number(bf)>0) await client.query(`insert into result_items(competition_id,user_id,round,kind,weight) values(1,$1,$2,'BF',$3)`,[uid,round,Number(bf)]);
        await client.query(`insert into results(competition_id,user_id,round,weight,big_fish,updated_at) values(1,$1,$2,$3,$4,now())`,[uid,round,Number(total),Number(bf)]);
      }
    }

    const verify=(await client.query(`select
      (select count(*)::int from entries where competition_id=1 and status='ACTIVE') entries,
      (select count(*)::int from draws where competition_id=1) draws,
      (select count(*)::int from results where competition_id=1) results,
      (select count(*)::int from result_items where competition_id=1) items,
      (select coalesce(sum(weight),0)::bigint from results where competition_id=1) grams,
      (select coalesce(max(big_fish),0)::int from results where competition_id=1) bf`)).rows[0];
    if(Number(verify.entries)!==28 || Number(verify.draws)!==56 || Number(verify.results)!==56 || Number(verify.grams)!==622350 || Number(verify.bf)!==9320) {
      throw new Error('Database verification failed: '+JSON.stringify(verify));
    }

    await client.query(`update competitions set status='CLOSED',signup_open=false where id=1`);
    await client.query('COMMIT');
    console.log('LASOMIN_RECOVERY_OK='+JSON.stringify({verify,linked,created:created.length}));
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) {}
    throw e;
  } finally { client.release(); }
}

main().catch(e=>{ console.error('LASOMIN_RECOVERY_ERROR='+String(e.stack||e)); process.exitCode=1; }).finally(()=>pool.end());
