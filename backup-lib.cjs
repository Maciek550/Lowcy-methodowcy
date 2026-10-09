const { Pool } = require('pg');

function qi(name){ return '"'+String(name).replace(/"/g,'""')+'"'; }

async function buildSnapshot(connectionString, extra={}) {
  if (!connectionString) throw new Error('Brak DATABASE_URL');
  const pool = new Pool({ connectionString, ssl:false, max:1 });
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');

    const tableRows = await client.query(`
      select table_name
      from information_schema.tables
      where table_schema='public' and table_type='BASE TABLE'
      order by table_name
    `);
    const tables = tableRows.rows.map(r=>r.table_name);

    const columnsRows = await client.query(`
      select table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default
      from information_schema.columns
      where table_schema='public'
      order by table_name,ordinal_position
    `);
    const columnsByTable = new Map();
    for (const c of columnsRows.rows) {
      if (!columnsByTable.has(c.table_name)) columnsByTable.set(c.table_name, []);
      columnsByTable.get(c.table_name).push(c);
    }

    const fkRows = await client.query(`
      select tc.table_name as child_table, ccu.table_name as parent_table
      from information_schema.table_constraints tc
      join information_schema.constraint_column_usage ccu
        on ccu.constraint_schema=tc.constraint_schema and ccu.constraint_name=tc.constraint_name
      where tc.table_schema='public' and tc.constraint_type='FOREIGN KEY'
    `);
    const deps = new Map(tables.map(t=>[t,new Set()]));
    for (const r of fkRows.rows) if (deps.has(r.child_table) && deps.has(r.parent_table) && r.child_table!==r.parent_table) deps.get(r.child_table).add(r.parent_table);
    const restoreOrder=[];
    const remaining=new Set(tables);
    while(remaining.size){
      const ready=[...remaining].filter(t=>[...deps.get(t)].every(p=>!remaining.has(p))).sort();
      if(!ready.length){ restoreOrder.push(...[...remaining].sort()); break; }
      for(const t of ready){ restoreOrder.push(t); remaining.delete(t); }
    }

    const sequenceRows = await client.query(`
      select table_name,column_name,
        pg_get_serial_sequence(format('%I.%I',table_schema,table_name),column_name) as sequence_name
      from information_schema.columns
      where table_schema='public'
      order by table_name,ordinal_position
    `);
    const sequences = sequenceRows.rows.filter(r=>r.sequence_name);

    const data={};
    const counts={};
    for(const table of tables){
      const cols=columnsByTable.get(table)||[];
      const q=await client.query(`select * from public.${qi(table)}`);
      const byteaCols=new Set(cols.filter(c=>c.udt_name==='bytea').map(c=>c.column_name));
      data[table]=q.rows.map(row=>{
        const out={};
        for(const [k,v] of Object.entries(row)){
          if(byteaCols.has(k) && Buffer.isBuffer(v)) out[k]={__lowcy_type:'bytea',base64:v.toString('base64')};
          else out[k]=v;
        }
        return out;
      });
      counts[table]=q.rowCount;
    }

    const snapshot={
      format:'LOWCY_METHODOWCY_DB_BACKUP_V1',
      created_at:new Date().toISOString(),
      app_version:extra.appVersion||null,
      git_commit:extra.gitCommit||null,
      note:extra.note||'',
      database:{schema:'public',tables:tables.length,counts},
      restore_order:restoreOrder,
      sequences,
      columns:Object.fromEntries(tables.map(t=>[t,(columnsByTable.get(t)||[]).map(c=>({name:c.column_name,data_type:c.data_type,udt_name:c.udt_name,nullable:c.is_nullable==='YES',default:c.column_default}))])),
      data
    };
    await client.query('COMMIT');
    return snapshot;
  } catch(e) {
    try{ await client.query('ROLLBACK'); }catch(_){}
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

module.exports={buildSnapshot};
