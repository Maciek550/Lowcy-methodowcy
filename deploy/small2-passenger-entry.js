'use strict';

// SMALL2 Passenger entrypoint. Copy this file as public_nodejs/app.js.
// Keep original frontend app.js in the separate, unchanged source directory.
// This adapter will refuse to start against any database except p1828_lowcy_kop.
const fs = require('node:fs');
const path = require('node:path');

const source = '/usr/home/lowcymethodowcy/lowcy-small2-20261023';
const readinessFile = path.join(source, '.small2-start-approved');
const runtimeFile = '/usr/home/lowcymethodowcy/.config/lowcy-small2/runtime.json';
const allowedRuntimeKeys = Object.freeze(['DATABASE_URL', 'JWT_SECRET', 'ADMIN_SETUP_CODE', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT']);
function loadRuntimeConfig() {
  if (!fs.existsSync(runtimeFile)) throw new Error('Brak prywatnej konfiguracji runtime SMALL2.');
  const st = fs.statSync(runtimeFile);
  if (!st.isFile() || (st.mode & 0o077)) throw new Error('Niebezpieczne uprawnienia konfiguracji SMALL2.');
  const parsed = JSON.parse(fs.readFileSync(runtimeFile, 'utf8'));
  for (const key of allowedRuntimeKeys) {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      if (typeof parsed[key] !== 'string') throw new Error('Nieprawidłowy typ ustawienia ' + key);
      process.env[key] = parsed[key];
    }
  }
}

function fail(reason) {
  console.error('LOWCY_SMALL2_START_BLOCKED: ' + reason);
  process.exitCode = 1;
}

try {
  if (!fs.existsSync(path.join(source, 'server.cjs'))) {
    throw new Error('Brak server.cjs w katalogu kopii SMALL2.');
  }
  if (!fs.existsSync(path.join(source, 'app.js'))) {
    throw new Error('Brak oryginalnego app.js w katalogu kopii SMALL2.');
  }
  // Requires a separate, explicit verification step performed by an operator.
  if (!fs.existsSync(readinessFile)) {
    throw new Error('Brak znacznika zatwierdzenia docelowej bazy; nie uruchamiam aplikacji.');
  }
  loadRuntimeConfig();
  const db = process.env.DATABASE_URL;
  if (!db) throw new Error('Nie ustawiono DATABASE_URL.');
  const u = new URL(db);
  if (!['postgres:', 'postgresql:'].includes(u.protocol)
      || u.hostname.toLowerCase() !== 'pgsql3.small.pl'
      || decodeURIComponent(u.pathname) !== '/p1828_lowcy_kop') {
    throw new Error('DATABASE_URL nie wskazuje wyłącznie bazy p1828_lowcy_kop na SMALL2.');
  }
  if (!u.username || !u.password || u.search || u.hash) {
    throw new Error('Niekompletny lub niestandardowy DATABASE_URL.');
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 24
      || process.env.JWT_SECRET === 'dev-secret-change-me') {
    throw new Error('Brak silnego, osobnego JWT_SECRET.');
  }
  console.log('LOWCY_SMALL2_PASSENGER_ADAPTER_START');
  require(path.join(source, 'server.cjs'));
} catch (e) {
  fail(e && e.message || 'Błąd uruchamiania.');
}
