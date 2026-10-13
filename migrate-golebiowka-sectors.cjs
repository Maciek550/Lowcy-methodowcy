const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 1,
  connectionTimeoutMillis: 8000
});

const migrations = {
  along: '20261013_golebiowka_two_along',
  results: '20261013_golebiowka_results_alignment'
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
