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
  classification: '20261013_golebiowka_weight_classification'
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
        WITH checks AS (
          SELECT c.id, c.title,
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
              translate(lower(COALESCE(c.fishery,'')), 'łęó', 'leo') LIKE '%golebiowka%'
              OR translate(lower(COALESCE(c.title,'')), 'łęó', 'leo') LIKE '%golebiowka%'
            )
        )
        SELECT * FROM checks
        WHERE active_count=17
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
            AND (SELECT count(*) FROM entries e WHERE e.competition_id=c.id AND e.status='ACTIVE')=17
          ORDER BY c.id
        `);
        console.log('Gołębiówka result recalculation diagnostics=' + JSON.stringify(diagnostics.rows));
        console.log('Gołębiówka result recalculation skipped; exact verified event candidates=' + candidates.rowCount);
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
        console.log('Gołębiówka classification recalculated from verified weights; competition=' + comp.id + ', imported points cleared=' + cleared.rowCount + ', weights and draws preserved.');
      }
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
    console.error('Gołębiówka sector layout migration failed:', error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());

