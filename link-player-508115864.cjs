const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const targetRes = await client.query(`
      SELECT id, phone, first_name, last_name, role, account_source
      FROM users
      WHERE phone = $1
      ORDER BY id
    `, ['508115864']);
    if (targetRes.rowCount !== 1) {
      throw new Error(`Expected exactly 1 player account with phone 508115864, found ${targetRes.rowCount}`);
    }
    const target = targetRes.rows[0];

    const compRes = await client.query(`
      SELECT id, title, date, status
      FROM competitions
      WHERE date = DATE '2026-09-26'
      ORDER BY id
    `);
    if (compRes.rowCount !== 1) {
      throw new Error(`Expected exactly 1 competition on 2026-09-26, found ${compRes.rowCount}`);
    }
    const comp = compRes.rows[0];

    const sourceRes = await client.query(`
      SELECT DISTINCT u.id, u.phone, u.first_name, u.last_name, u.role
      FROM users u
      JOIN entries e ON e.player_id = u.id
      WHERE e.competition_id = $1
        AND lower(u.last_name) = 'fabisiak'
        AND lower(u.first_name) IN ('maciek','maciej')
      ORDER BY u.id
    `, [comp.id]);
    if (sourceRes.rowCount !== 1) {
      throw new Error(`Expected exactly 1 historical Maciek/Maciej Fabisiak entry, found ${sourceRes.rowCount}`);
    }
    const source = sourceRes.rows[0];

    if (String(source.id) === String(target.id)) {
      console.log('ALREADY_LINKED', JSON.stringify({ competition: comp, target }));
      await client.query('COMMIT');
      return;
    }

    const targetExisting = await client.query(`
      SELECT
        (SELECT count(*)::int FROM entries WHERE competition_id=$1 AND player_id=$2) AS entries,
        (SELECT count(*)::int FROM draws WHERE competition_id=$1 AND player_id=$2) AS draws,
        (SELECT count(*)::int FROM results WHERE competition_id=$1 AND player_id=$2) AS results
    `, [comp.id, target.id]);
    const existing = targetExisting.rows[0];
    if (existing.entries || existing.draws || existing.results) {
      throw new Error(`Target account already has historical rows for this competition: ${JSON.stringify(existing)}`);
    }

    const sourceCountsRes = await client.query(`
      SELECT
        (SELECT count(*)::int FROM entries WHERE competition_id=$1 AND player_id=$2) AS entries,
        (SELECT count(*)::int FROM draws WHERE competition_id=$1 AND player_id=$2) AS draws,
        (SELECT count(*)::int FROM results WHERE competition_id=$1 AND player_id=$2) AS results
    `, [comp.id, source.id]);
    const before = sourceCountsRes.rows[0];
    if (before.entries !== 1 || before.draws !== 2 || before.results !== 2) {
      throw new Error(`Unexpected historical row counts on source account: ${JSON.stringify(before)}`);
    }

    const e = await client.query(`UPDATE entries SET player_id=$1 WHERE competition_id=$2 AND player_id=$3`, [target.id, comp.id, source.id]);
    const d = await client.query(`UPDATE draws SET player_id=$1 WHERE competition_id=$2 AND player_id=$3`, [target.id, comp.id, source.id]);
    const r = await client.query(`UPDATE results SET player_id=$1 WHERE competition_id=$2 AND player_id=$3`, [target.id, comp.id, source.id]);

    const verify = await client.query(`
      SELECT
        (SELECT count(*)::int FROM entries WHERE competition_id=$1 AND player_id=$2) AS target_entries,
        (SELECT count(*)::int FROM draws WHERE competition_id=$1 AND player_id=$2) AS target_draws,
        (SELECT count(*)::int FROM results WHERE competition_id=$1 AND player_id=$2) AS target_results,
        (SELECT count(*)::int FROM entries WHERE competition_id=$1 AND player_id=$3) AS source_entries,
        (SELECT count(*)::int FROM draws WHERE competition_id=$1 AND player_id=$3) AS source_draws,
        (SELECT count(*)::int FROM results WHERE competition_id=$1 AND player_id=$3) AS source_results
    `, [comp.id, target.id, source.id]);

    const v = verify.rows[0];
    if (v.target_entries !== 1 || v.target_draws !== 2 || v.target_results !== 2 ||
        v.source_entries !== 0 || v.source_draws !== 0 || v.source_results !== 0) {
      throw new Error(`Verification failed: ${JSON.stringify(v)}`);
    }

    await client.query('COMMIT');
    console.log('LINK_SUCCESS', JSON.stringify({
      competition: comp,
      source: { id: source.id, phone: source.phone, first_name: source.first_name, last_name: source.last_name, role: source.role },
      target: { id: target.id, phone: target.phone, first_name: target.first_name, last_name: target.last_name, role: target.role, account_source: target.account_source },
      updated: { entries: e.rowCount, draws: d.rowCount, results: r.rowCount },
      verified: v
    }));
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('LINK_FAILED', err && err.stack ? err.stack : err);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
})();
