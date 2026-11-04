'use strict';

// LOWCY V311 / SMALL2: safe, read-only target database preflight.
// Does not create tables, apply migrations, read or contact Railway, or print credentials.
const EXPECTED_HOST = 'pgsql3.small.pl';
const EXPECTED_DB = 'p1828_lowcy_kop';
const TABLES = Object.freeze(['users', 'competitions', 'entries', 'draws', 'results', 'app_migrations']);

function validateDbUrl(raw) {
  if (!raw || typeof raw !== 'string') throw new Error('DATABASE_URL nie jest ustawiony.');
  let u;
  try { u = new URL(raw); } catch { throw new Error('DATABASE_URL ma nieprawidłową składnię.'); }
  if (!['postgresql:', 'postgres:'].includes(u.protocol)) throw new Error('DATABASE_URL musi używać protokołu PostgreSQL.');
  if (u.hostname.toLowerCase() !== EXPECTED_HOST) throw new Error('BLOKADA: host bazy nie jest hostem SMALL2.');
  if (decodeURIComponent(u.pathname) !== '/' + EXPECTED_DB) throw new Error('BLOKADA: baza nie jest p1828_lowcy_kop.');
  if (!u.username || !u.password) throw new Error('DATABASE_URL nie zawiera użytkownika i hasła.');
  if (u.port && u.port !== '5432') throw new Error('BLOKADA: port PostgreSQL inny niż 5432.');
  if (u.search || u.hash) throw new Error('BLOKADA: parametry URL są niedozwolone, aby uniknąć nadpisania konfiguracji.');
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'dev-secret-change-me' || process.env.JWT_SECRET.length < 24) {
    throw new Error('JWT_SECRET nie jest skonfigurowany bezpiecznie dla SMALL2.');
  }
  return { host: EXPECTED_HOST, database: EXPECTED_DB };
}

async function auditConnection(raw, ClientConstructor) {
  const target = validateDbUrl(raw);
  const Client = ClientConstructor || require('pg').Client;
  const client = new Client({ connectionString: raw, ssl: false, connectionTimeoutMillis: 8000, application_name: 'lowcy-small2-readonly-preflight' });
  let connected = false;
  let transaction = false;
  try {
    await client.connect(); connected = true;
    await client.query('BEGIN READ ONLY'); transaction = true;
    const {rows} = await client.query('SELECT current_database() AS db, current_user AS db_user');
    if (!rows[0] || rows[0].db !== EXPECTED_DB) throw new Error('BLOKADA: połączenie dotarło do innej bazy niż p1828_lowcy_kop.');
    const tables = {};
    for (const table of TABLES) {
      const found = await client.query('SELECT to_regclass($1) AS tbl', ['public.' + table]);
      if (found.rows[0]?.tbl === null || found.rows[0]?.tbl === undefined) {
        tables[table] = null;
      } else {
        const count = await client.query(`SELECT COUNT(*)::integer AS n FROM public.${table}`);
        tables[table] = count.rows[0].n;
      }
    }
    return {ok:true, host:target.host, database:target.database, databaseUser:rows[0].db_user, tables};
  } finally {
    if (transaction) await client.query('ROLLBACK').catch(() => {});
    if (connected) await client.end().catch(() => {});
  }
}

async function main() {
  try {
    const target = validateDbUrl(process.env.DATABASE_URL);
    if (process.argv.includes('--config-only')) {
      console.log('OK: sprawdzono składnię i cel DATABASE_URL: ' + target.host + '/' + target.database + '.');
      console.log('INFO: test połączenia z PostgreSQL nie został wykonany (--config-only).');
      return;
    }
    const result = await auditConnection(process.env.DATABASE_URL);
    console.log('OK: odczytowy test połączenia SMALL2. Cel: '+result.host+'/'+result.database+'.');
    console.log('Użytkownik bazy: '+result.databaseUser);
    for (const [table, count] of Object.entries(result.tables)) {
      console.log(table+': '+(count === null?'brak tabeli':count+' rekordów'));
    }
    console.log('Nie wykonano żadnej migracji ani zapisu danych.');
  } catch (error) {
    // Never include connection strings, potentially sensitive driver error messages, or passwords.
    const safe = error.message && (/^(BLOKADA:|DATABASE_URL|JWT_SECRET)/.test(error.message)) ? error.message : 'Nie można potwierdzić połączenia PostgreSQL (kod: ' + (error.code || 'nieznany') + ').';
    console.error(safe);
    process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = {validateDbUrl, auditConnection};
