#!/usr/bin/env bash
# Safe first-time schema bootstrap of Łowcy V311 on a VERIFIED isolated SMALL2 database.
# DB_PASSWORD_B64 is passed only over the authenticated SSH stream and is never logged.
set -euo pipefail
umask 077
src="$HOME/lowcy-small2-20261023"
cfgdir="$HOME/.config/lowcy-small2"
cfg="$cfgdir/runtime.json"
archive="$HOME/lowcy-small2-stage-v311"
port=34119

test -d "$src/.git"
test "$(git -C "$src" rev-parse HEAD)" = 'e5b35f311d8c0d98cd8498044e5d538bf9c2b2f2'
test -z "$(git -C "$src" status --porcelain)"
test -n "${DB_PASSWORD_B64:-}"
test ! -e "$cfg"
mkdir -p "$cfgdir" "$archive"
chmod 700 "$cfgdir" "$archive"
export PGPASSWORD="$(printf '%s' "$DB_PASSWORD_B64" | base64 -d)"
unset DB_PASSWORD_B64
trap 'unset PGPASSWORD' EXIT
export PGCONNECT_TIMEOUT=8
dbhost=pgsql3.small.pl
db=p1828_lowcy_kop

# Verify the EXACT database and an empty public schema before ANY mutation.
identity="$(psql -w -X -v ON_ERROR_STOP=1 -At -h "$dbhost" -U "$db" -d "$db" -c "select current_database() || ':' || current_user")"
test "$identity" = 'p1828_lowcy_kop:p1828_lowcy_kop'
num="$(psql -w -X -v ON_ERROR_STOP=1 -At -h "$dbhost" -U "$db" -d "$db" -c "select count(*) from pg_tables where schemaname='public'")"
if [ "$num" != 0 ]; then
  echo "BLOCK: existing public schema is not empty; do not initialize or touch data."
  exit 2
fi
dump="$archive/lowcy_kop_before_init_20261104.dump"
test ! -e "$dump"
pg_dump -w -Fc -h "$dbhost" -U "$db" -d "$db" -f "$dump"
test -s "$dump"
chmod 600 "$dump"
sha256sum "$dump" | cut -d' ' -f1 | sed 's/^/SMALL2_EMPTY_DATABASE_BACKUP_SHA256=/'

# Create private runtime.json directly on SMALL2. No passwords or secrets in repo/logs.
export SMALL2_PRIVATE_CONFIG="$cfg"
node <<'NODE'
'use strict';
const fs=require('fs'),crypto=require('crypto');
const pass=process.env.PGPASSWORD;
if (!pass) throw new Error('No database password');
const url=new URL('postgresql://p1828_lowcy_kop@pgsql3.small.pl:5432/p1828_lowcy_kop');
url.password=pass;
if(url.hostname!=='pgsql3.small.pl'||url.pathname!=='/p1828_lowcy_kop') throw new Error('Invalid SMALL2 database target');
const v={
 DATABASE_URL:url.toString(),
 JWT_SECRET:crypto.randomBytes(48).toString('hex'),
 ADMIN_SETUP_CODE:crypto.randomBytes(18).toString('hex')
};
fs.writeFileSync(process.env.SMALL2_PRIVATE_CONFIG,JSON.stringify(v,null,2)+'\n',{mode:0o600,flag:'wx'});
NODE
chmod 600 "$cfg"
echo 'SMALL2_PRIVATE_RUNTIME_CONFIG_CREATED'

# Bootstrap schema using the original V311 server. Restrict test requests to localhost.
# Never run npm start here: its migration precedes first-time schema initialization.
cd "$src"
export DATABASE_URL="$(node -e 'process.stdout.write(require(process.env.SMALL2_PRIVATE_CONFIG).DATABASE_URL)')"
export JWT_SECRET="$(node -e 'process.stdout.write(require(process.env.SMALL2_PRIVATE_CONFIG).JWT_SECRET)')"
export ADMIN_SETUP_CODE="$(node -e 'process.stdout.write(require(process.env.SMALL2_PRIVATE_CONFIG).ADMIN_SETUP_CODE)')"
export PORT="$port"
log="$archive/first_boot_20261104.log"
node --check server.cjs
node server.cjs > "$log" 2>&1 &
pid=$!
cleanup(){ kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; }
trap 'cleanup; unset PGPASSWORD DATABASE_URL JWT_SECRET ADMIN_SETUP_CODE' EXIT
ready=false
for i in $(seq 1 50); do
  if ! kill -0 "$pid" 2>/dev/null; then break; fi
  if curl -fsS --max-time 2 "http://127.0.0.1:$port/health" -o "$archive/first_boot_health.json" 2>/dev/null; then
    ready=true
    break
  fi
  sleep 2
done
if [ "$ready" != true ]; then
  echo 'BLOCK: first V311 boot did not pass local health; inspect private SMALL2 log.'
  exit 3
fi
node -e 'const j=require(process.argv[1]); if (!j.ok || j.version!=="V311_GOLEBIOWKA_JULY_BANKS") process.exit(1);' "$archive/first_boot_health.json"
echo 'SMALL2_LOCAL_APP_V311_HEALTH_OK'
cleanup
trap 'unset PGPASSWORD DATABASE_URL JWT_SECRET ADMIN_SETUP_CODE' EXIT

# Verify schema and record counts without changing any data.
echo '=== SMALL2_POST_INIT_TABLE_COUNTS ==='
for table in users competitions entries draws results; do
  n="$(psql -w -X -v ON_ERROR_STOP=1 -At -h "$dbhost" -U "$db" -d "$db" -c "select count(*) from public.$table")"
  echo "$table=$n"
done
touch "$src/.small2-start-approved"
chmod 600 "$src/.small2-start-approved"
echo 'SMALL2_SCHEMA_INITIALIZED_AND_START_GUARD_APPROVED'
