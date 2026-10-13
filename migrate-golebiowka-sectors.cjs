const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 1,
  connectionTimeoutMillis: 8000
});

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
    const applied = await client.query(
      'SELECT 1 FROM app_migrations WHERE id = $1',
      ['20261013_golebiowka_two_along']
    );
    if (applied.rowCount) {
      await client.query('COMMIT');
      console.log('Migration 20261013_golebiowka_two_along already applied');
      return;
    }

    const result = await client.query(`
      UPDATE competitions
         SET map_mode = 'TWO_ALONG'
       WHERE translate(lower(COALESCE(fishery, '')), 'łęó', 'leo')
             LIKE '%golebiowka%'
         AND COALESCE(map_mode, '') <> 'TWO_ALONG'
    `);
    await client.query(
      'INSERT INTO app_migrations (id) VALUES ($1)',
      ['20261013_golebiowka_two_along']
    );
    await client.query('COMMIT');
    console.log('Gołębiówka sector layout set to two banks along the shore; competitions updated=' + result.rowCount);
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
