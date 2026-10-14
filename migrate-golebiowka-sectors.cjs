const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 1,
  connectionTimeoutMillis: 8000
});

const migrations = {
  along: '20261013_golebiowka_two_along',
  results: '20261013_golebiowka_results_alignment',
  classification: '20261013_wapnica_weight_classification'
};

async function alreadyApplied(client, id) {
  const result = await client.query(
    'SELECT 1 FROM app_migrations WHERE id = $1',
    [id]
  );
  return result.rowCount > 0;
}

async function markApplied(client, id) {
  await client.query('INSERT INTO app_migrations (id) VALUES ($1)', [id]);
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TABLE IF NOT EXISTS app_migrations (
        id TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);

    if (!(await alreadyApplied(client, migrations.along))) {
      const result = await client.query(`
        UPDATE competitions
           SET map_mode = 'TWO_ALONG'
         WHERE translate(lower(COALESCE(fishery, '')), 'łęó', 'leo')
               LIKE '%golebiowka%'
           AND COALESCE(map_mode, '') <> 'TWO_ALONG'
      `);
      await markApplied(client, migrations.along);
      console.log('Gołębiówka two-bank layout applied; competitions updated=' + result.rowCount);
    }

    if (!(await alreadyApplied(client, migrations.results))) {
      const layout = JSON.stringify([
        { name: 'A', stands: [1, 2, 3, 4, 5] },
        { name: 'B', stands: [6, 7, 8, 9, 10, 11] },
        { name: 'C', stands: [12, 13, 14, 15, 16] }
      ]);
      const result = await client.query(`
        UPDATE competitions
           SET map_mode = 'TWO_ALONG',
               sector_layout = $1
         WHERE translate(lower(COALESCE(fishery, '')), 'łęó', 'leo')
               LIKE '%golebiowka%'
           AND bank1_count = 8
           AND bank2_count = 8
           AND sectors_count = 3
      `, [layout]);
      await markApplied(client, migrations.results);
      console.log('Gołębiówka map aligned with results (A: 1-5, B: 6-11, C: 12-16); competitions updated=' + result.rowCount);
    }

    if (!(await alreadyApplied(client, migrations.classification))) {
      const candidates = await client.query(`
        WITH expected(user_name,round,stand,sector,weight) AS (VALUES
          ('Radek Jastrzębski',1,1,'A',13890),
          ('Paweł Grzegorczyk',1,5,'A',9240),
          ('Henryk Lipski',1,3,'A',6100),
          ('Maciek Fabisiak',1,6,'A',6870),
          ('Krzysztof Krupiński',1,2,'A',0),
          ('Michał Fabisiak',1,4,'A',0),
          ('Piotr Muranowicz',1,10,'B',67490),
          ('Marcin Czarnocki',1,8,'B',49160),
          ('Robert Fabisiak',1,9,'B',18540),
          ('Przemek Warmijak',1,12,'B',15120),
          ('Karol Szostak',1,7,'B',13070),
          ('Jurij Marynets',1,11,'B',8260),
          ('Rafał Siporski',1,17,'C',21400),
          ('Dariusz Dolato',1,18,'C',5630),
          ('Mariusz Sudrowicz',1,16,'C',0),
          ('Piotr Machalski',1,14,'C',20330),
          ('Semen Sztyper',1,15,'C',0),
          ('Karol Szostak',2,6,'A',19130),
          ('Piotr Muranowicz',2,4,'A',16860),
          ('Marcin Czarnocki',2,5,'A',11150),
          ('Robert Fabisiak',2,3,'A',4030),
          ('Jurij Marynets',2,1,'A',11050),
          ('Przemek Warmijak',2,2,'A',0),
          ('Maciek Fabisiak',2,12,'B',82380),
          ('Henryk Lipski',2,11,'B',28070),
          ('Radek Jastrzębski',2,7,'B',8070),
          ('Krzysztof Krupiński',2,8,'B',24570),
          ('Paweł Grzegorczyk',2,9,'B',13720),
          ('Michał Fabisiak',2,10,'B',6060),
          ('Rafał Siporski',2,18,'C',36590),
          ('Mariusz Sudrowicz',2,15,'C',0),
          ('Piotr Machalski',2,16,'C',0),
          ('Dariusz Dolato',2,14,'C',15020),
          ('Semen Sztyper',2,17,'C',0)
        ), checks AS (
          SELECT c.id, c.title,
            (SELECT count(*)::int FROM expected x
             JOIN entries e ON e.competition_id=c.id AND e.status='ACTIVE'
             JOIN users u ON u.id=e.user_id
             JOIN draws d ON d.competition_id=c.id AND d.user_id=e.user_id AND d.round=x.round
             JOIN results r ON r.competition_id=c.id AND r.user_id=e.user_id AND r.round=x.round
             WHERE concat(u.first_name,' ',u.last_name)=x.user_name
               AND d.stand=x.stand AND d.sector=x.sector AND r.weight=x.weight
            ) AS screenshot_match_count,
            (SELECT count(*)::int FROM entries e
             WHERE e.competition_id=c.id AND e.status='ACTIVE') AS active_count,
            (SELECT count(*)::int FROM results r
             WHERE r.competition_id=c.id AND r.round=1) AS result1_count,
            (SELECT count(*)::int FROM results r
             WHERE r.competition_id=c.id AND r.round=2) AS result2_count,
            (SELECT COALESCE(sum(r.weight),0)::int FROM results r
             WHERE r.competition_id=c.id AND r.round=1) AS weight1,
            (SELECT COALESCE(sum(r.weight),0)::int FROM results r
             WHERE r.competition_id=c.id AND r.round=2) AS weight2,
            (SELECT count(*)::int FROM draws d
             WHERE d.competition_id=c.id AND d.round=1) AS draw1_count,
            (SELECT count(*)::int FROM draws d
             WHERE d.competition_id=c.id AND d.round=2) AS draw2_count,
            (SELECT jsonb_object_agg(x.sector,x.n) FROM (
               SELECT d.sector,count(*)::int AS n FROM draws d
               WHERE d.competition_id=c.id AND d.round=1 GROUP BY d.sector
             ) x) AS layout1,
            (SELECT jsonb_object_agg(x.sector,x.n) FROM (
               SELECT d.sector,count(*)::int AS n FROM draws d
               WHERE d.competition_id=c.id AND d.round=2 GROUP BY d.sector
             ) x) AS layout2,
            NOT EXISTS (
              SELECT 1 FROM entries e
              WHERE e.competition_id=c.id AND e.status='ACTIVE'
                AND (
                  NOT EXISTS (SELECT 1 FROM draws d WHERE d.competition_id=c.id AND d.round=1 AND d.user_id=e.user_id)
                  OR NOT EXISTS (SELECT 1 FROM draws d WHERE d.competition_id=c.id AND d.round=2 AND d.user_id=e.user_id)
                )
            ) AS all_stations_assigned,
            NOT EXISTS (
              SELECT 1 FROM results r
              WHERE r.competition_id=c.id AND r.round IN (1,2)
                AND NOT EXISTS (
                  SELECT 1 FROM entries e
                  WHERE e.competition_id=c.id AND e.status='ACTIVE' AND e.user_id=r.user_id
                )
            ) AS all_results_linked
          FROM competitions c
          WHERE COALESCE(c.round_count,2)=2
            AND (
              c.id = 6
              AND upper(COALESCE(c.title,'')) LIKE 'WAPNICA%'
            )
        )
        SELECT * FROM checks
        WHERE active_count=17
          AND screenshot_match_count=34
          AND result1_count=17 AND result2_count=17
          AND weight1=255100 AND weight2=276700
          AND draw1_count=17 AND draw2_count=17
          AND layout1='{"A":6,"B":6,"C":5}'::jsonb
          AND layout2='{"A":6,"B":6,"C":5}'::jsonb
          AND all_stations_assigned AND all_results_linked
      `);

      if (candidates.rowCount !== 1) {
        const diagnostics = await client.query(`
          SELECT c.id,c.title,c.round_count,
            (SELECT count(*)::int FROM entries e WHERE e.competition_id=c.id AND e.status='ACTIVE') AS active_count,
            (SELECT count(*)::int FROM results r WHERE r.competition_id=c.id AND r.round=1) AS result1_count,
            (SELECT count(*)::int FROM results r WHERE r.competition_id=c.id AND r.round=2) AS result2_count,
            (SELECT COALESCE(sum(r.weight),0)::int FROM results r WHERE r.competition_id=c.id AND r.round=1) AS weight1,
            (SELECT COALESCE(sum(r.weight),0)::int FROM results r WHERE r.competition_id=c.id AND r.round=2) AS weight2,
            (SELECT count(*)::int FROM draws d WHERE d.competition_id=c.id AND d.round=1) AS draw1_count,
            (SELECT count(*)::int FROM draws d WHERE d.competition_id=c.id AND d.round=2) AS draw2_count,
            (SELECT jsonb_object_agg(x.sector,x.n) FROM (
               SELECT d.sector,count(*)::int AS n FROM draws d
               WHERE d.competition_id=c.id AND d.round=1 GROUP BY d.sector
             ) x) AS layout1,
            (SELECT jsonb_object_agg(x.sector,x.n) FROM (
               SELECT d.sector,count(*)::int AS n FROM draws d
               WHERE d.competition_id=c.id AND d.round=2 GROUP BY d.sector
             ) x) AS layout2
          FROM competitions c
          WHERE COALESCE(c.round_count,2)=2
            AND c.id=6
            AND upper(COALESCE(c.title,'')) LIKE 'WAPNICA%'
            AND (SELECT count(*) FROM entries e WHERE e.competition_id=c.id AND e.status='ACTIVE')=17
          ORDER BY c.id
        `);
        console.log('Wapnica result recalculation diagnostics=' + JSON.stringify(diagnostics.rows));
        console.log('Wapnica result recalculation skipped; exact verified event candidates=' + candidates.rowCount);
      } else {
        const comp = candidates.rows[0];
        const old = await client.query(`
          SELECT user_id,round,weight,big_fish,historical_points
          FROM results WHERE competition_id=$1 AND round IN (1,2)
          ORDER BY round,user_id
        `, [comp.id]);
        await client.query(`
          INSERT INTO historical_import_audit(competition_id,actor_id,payload)
          VALUES($1,NULL,$2::jsonb)
        `, [comp.id, JSON.stringify({
          migration: migrations.classification,
          title: comp.title,
          resultRowsBefore: old.rows
        })]);
        const cleared = await client.query(`
          UPDATE results SET historical_points=NULL
          WHERE competition_id=$1 AND round IN (1,2)
            AND historical_points IS NOT NULL
        `, [comp.id]);
        await client.query(`
          UPDATE competitions SET zero_score_rule='MAX' WHERE id=$1
        `, [comp.id]);
        await markApplied(client, migrations.classification);
        console.log('Wapnica classification recalculated from verified weights; competition=' + comp.id + ', imported points cleared=' + cleared.rowCount + ', weights and draws preserved.');
      }
    }

    const lasominMapMigration='20261014_lasomin_0704_banks_14_13';
    if (!(await alreadyApplied(client,lasominMapMigration))) {
      const match=await client.query(`SELECT * FROM competitions
        WHERE id=5 AND competition_date='2026-07-04'
          AND upper(title) LIKE 'LASOMIN%' AND COALESCE(round_count,2)=2
        FOR UPDATE`);
      if(match.rowCount===1){
        const comp=match.rows[0];
        const drawRows=(await client.query('SELECT round,stand,sector FROM draws WHERE competition_id=$1 ORDER BY round,stand FOR UPDATE',[comp.id])).rows;
        const expected=n=>n<=7?'A':n<=14?'B':n<=21?'C':'D';
        const verified=drawRows.length===54&&[1,2].every(round=>{
          const rows=drawRows.filter(r=>Number(r.round)===round);
          return rows.length===27&&new Set(rows.map(r=>Number(r.stand))).size===27&&rows.every(r=>Number.isInteger(Number(r.stand))&&Number(r.stand)>=1&&Number(r.stand)<=27&&r.sector===expected(Number(r.stand)));
        });
        if(verified){
          const layout=['A','B','C','D'].map(name=>({name,stands:drawRows.filter(r=>Number(r.round)===1&&r.sector===name).map(r=>Number(r.stand))}));
          await client.query('INSERT INTO historical_import_audit(competition_id,actor_id,payload) VALUES($1,NULL,$2::jsonb)',[comp.id,JSON.stringify({migration:lasominMapMigration,before:{map_mode:comp.map_mode,bank1_count:comp.bank1_count,bank2_count:comp.bank2_count,sectors_count:comp.sectors_count,sector_layout:comp.sector_layout},after:{map_mode:'TWO_ALONG',bank1_count:14,bank2_count:13,sector_layout:layout}})]);
          const updated=await client.query("UPDATE competitions SET map_mode='TWO_ALONG',bank1_count=14,bank2_count=13,sectors_count=4,sector_layout=$2::jsonb WHERE id=$1 RETURNING id,map_mode,bank1_count,bank2_count,sector_layout",[comp.id,JSON.stringify(layout)]);
          await markApplied(client,lasominMapMigration);
          console.log('V310_LASOMIN_BANKS_VERIFIED '+JSON.stringify(updated.rows[0]));
        }else console.log('V310_LASOMIN_BANKS_SKIPPED: draws do not match verified 1-27 sectors in both rounds');
      }else console.log('V310_LASOMIN_BANKS_SKIPPED: exact event not found');
    }

    const julyMapMigration='20261014_golebiowka_0718_separate_banks';
    if (!(await alreadyApplied(client,julyMapMigration))) {
      const match=await client.query(`SELECT * FROM competitions
        WHERE competition_date='2026-07-18' AND round_count=1
          AND translate(lower(COALESCE(fishery,'')), 'łęó', 'leo') LIKE '%golebiowka%'
        FOR UPDATE`);
      if(match.rowCount===1){
        const comp=match.rows[0];
        const drawRows=(await client.query('SELECT round,stand,sector FROM draws WHERE competition_id=$1 ORDER BY round,stand FOR UPDATE',[comp.id])).rows;
        const expected=new Map([...Array.from({length:7},(_,i)=>[i+1,'A']),...Array.from({length:6},(_,i)=>[i+11,'B'])]);
        const verified=drawRows.length===13&&new Set(drawRows.map(r=>Number(r.stand))).size===13&&drawRows.every(r=>Number(r.round)===1&&expected.get(Number(r.stand))===r.sector);
        if(verified){
          await client.query('INSERT INTO historical_import_audit(competition_id,actor_id,payload) VALUES($1,NULL,$2::jsonb)',[comp.id,JSON.stringify({migration:julyMapMigration,before:{map_mode:comp.map_mode,bank1_count:comp.bank1_count,bank2_count:comp.bank2_count,sectors_count:comp.sectors_count,sector_layout:comp.sector_layout},after:{map_mode:'TWO_ALONG',bank1_count:10,bank2_count:6,sectors_count:2}})]);
          const updated=await client.query("UPDATE competitions SET map_mode='TWO_ALONG',bank1_count=10,bank2_count=6,sectors_count=2,sector_layout=NULL WHERE id=$1 RETURNING id,map_mode,bank1_count,bank2_count",[comp.id]);
          await markApplied(client,julyMapMigration);
          console.log('V311_GOLEBIOWKA_JULY_BANKS_VERIFIED '+JSON.stringify(updated.rows[0]));
        }else console.log('V311_GOLEBIOWKA_JULY_SKIPPED: draw does not match A1-7 B11-16');
      }else console.log('V311_GOLEBIOWKA_JULY_SKIPPED: exact event not uniquely found');
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch(error => {
    console.error('Competition result migration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

