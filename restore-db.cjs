const fs=require('fs');
const {Pool}=require('pg');

function qi(name){return '"'+String(name).replace(/"/g,'""')+'"';}
function decode(v){
  if(v&&typeof v==='object'&&v.__lowcy_type==='bytea'&&typeof v.base64==='string')return Buffer.from(v.base64,'base64');
  return v;
}

(async()=>{
  const file=process.argv[2];
  if(!file)throw new Error('Użycie: node restore-db.cjs <backup.json>');
  if(!process.env.DATABASE_URL)throw new Error('Brak DATABASE_URL');
  const snapshot=JSON.parse(fs.readFileSync(file,'utf8'));
  if(snapshot.format!=='LOWCY_METHODOWCY_DB_BACKUP_V1')throw new Error('Nieobsługiwany format backupu');
  const tables=Object.keys(snapshot.data||{});
  if(!tables.length)throw new Error('Backup nie zawiera tabel');
  const pool=new Pool({connectionString:process.env.DATABASE_URL,ssl:false,max:1});
  const c=await pool.connect();
  try{
    await c.query('BEGIN');
    const existing=(await c.query("select table_name from information_schema.tables where table_schema='public' and table_type='BASE TABLE'")).rows.map(r=>r.table_name);
    const missing=tables.filter(t=>!existing.includes(t));
    if(missing.length)throw new Error('Brak tabel w docelowej bazie: '+missing.join(', ')+'. Najpierw uruchom aplikację, aby utworzyła schemat.');

    const truncate=tables.map(t=>'public.'+qi(t)).join(',');
    await c.query(`TRUNCATE TABLE ${truncate} RESTART IDENTITY CASCADE`);

    const order=(snapshot.restore_order||tables).filter(t=>tables.includes(t));
    for(const table of order){
      const rows=snapshot.data[table]||[];
      if(!rows.length)continue;
      const cols=(snapshot.columns?.[table]||[]).map(x=>x.name).filter(Boolean);
      const useCols=cols.length?cols:Object.keys(rows[0]);
      const batchSize=100;
      for(let off=0;off<rows.length;off+=batchSize){
        const part=rows.slice(off,off+batchSize);
        const vals=[];const groups=[];
        for(const row of part){
          const marks=[];
          for(const col of useCols){vals.push(decode(row[col]));marks.push('$'+vals.length);}
          groups.push('('+marks.join(',')+')');
        }
        await c.query(`insert into public.${qi(table)} (${useCols.map(qi).join(',')}) values ${groups.join(',')}`,vals);
      }
    }

    for(const s of snapshot.sequences||[]){
      if(!s.sequence_name||!tables.includes(s.table_name))continue;
      const q=await c.query(`select max(${qi(s.column_name)}) as m from public.${qi(s.table_name)}`);
      const m=Number(q.rows[0]?.m||0);
      if(m>0)await c.query('select setval($1::regclass,$2,true)',[s.sequence_name,m]);
      else await c.query('select setval($1::regclass,1,false)',[s.sequence_name]);
    }

    const verify={};
    for(const table of tables){
      const q=await c.query(`select count(*)::int as n from public.${qi(table)}`);
      verify[table]=q.rows[0].n;
      const expected=Number(snapshot.database?.counts?.[table]||0);
      if(verify[table]!==expected)throw new Error(`Kontrola ${table}: ${verify[table]} zamiast ${expected}`);
    }
    await c.query('COMMIT');
    console.log('LOWCY_RESTORE_OK '+JSON.stringify({created_at:snapshot.created_at,counts:verify}));
  }catch(e){
    try{await c.query('ROLLBACK')}catch(_){}
    throw e;
  }finally{c.release();await pool.end();}
})().catch(e=>{console.error('LOWCY_RESTORE_FAILED',e&&e.stack?e.stack:e);process.exitCode=1});
