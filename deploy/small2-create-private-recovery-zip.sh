#!/bin/bash
set -euo pipefail
umask 077
src="$HOME/lowcy-small2-20261023"
domain="$HOME/domains/lowcymethodowcy.smallhost.pl/public_nodejs"
vault="$HOME/.private-lowcy-archives"
stage="$HOME/lowcy-small2-stage-v311"
archive="$vault/Lowcy_V311_SMALL2_PELNA_KOPIA_20261105.zip"
test "$(git -C "$src" rev-parse HEAD)" = 'e5b35f311d8c0d98cd8498044e5d538bf9c2b2f2'
test -d "$domain"
test -f "$domain/app.js"
test -f "$HOME/.config/lowcy-small2/runtime.json"
test -f "$stage/restore-db-jsonb-corrected-v311.cjs"
test "$(devil www list | awk '$1=="lowcymethodowcy.smallhost.pl" {print $2}')" = 'nodejs'
command -v zip >/dev/null
command -v unzip >/dev/null
command -v pg_dump >/dev/null
mkdir -p "$vault"
chmod 700 "$vault"
test ! -e "$archive"
dbjson="$vault/lowcy-db-all-19-tables-v311-20261105.json"
dbdump="$vault/lowcy-postgresql-custom-v311-20261105.dump"
test ! -e "$dbjson" && test ! -e "$dbdump"
export DATABASE_URL="$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.env.HOME+"/.config/lowcy-small2/runtime.json","utf8")).DATABASE_URL)')"
export APP_VERSION='V311'
cd "$src"
node backup-db.cjs "$dbjson" >/dev/null
node - "$dbjson" <<'NODE'
const fs=require('fs');
const p=process.argv[2];
const x=JSON.parse(fs.readFileSync(p,'utf8'));
const e={users:73,competitions:7,entries:157,draws:285,results:285,result_items:278,app_settings:2};
if(x.format!=='LOWCY_METHODOWCY_DB_BACKUP_V1'||x.database.tables!==19)throw Error('INVALID_BACKUP_FORMAT');
for(const [k,n] of Object.entries(e))if(x.data[k].length!==n)throw Error('BACKUP_MISSING_'+k);
console.log('SMALL2_RECOVERY_BACKUP_JSON_VERIFIED_19_TABLES');
NODE
pg_dump --format=custom --file="$dbdump" --dbname="$DATABASE_URL"
test -s "$dbdump"
chmod 600 "$dbjson" "$dbdump"
cp -p "$stage/restore-db-jsonb-corrected-v311.cjs" "$vault/restore-db-jsonb-v311.cjs"
devil www list > "$vault/www-state-20261105.txt"
devil pgsql list > "$vault/postgres-state-20261105.txt"
cat > "$vault/RESTORE_INSTRUCTIONS.txt" <<'NOTE'
ŁOWCY METHODOWCY V311 / SMALL2 — RECOVERY 2026-11-05
The archive includes:
- independent V311 source code, git metadata, static assets, node_modules,
- a Passenger app.js from this SMALL2 domain,
- private runtime settings (DATABASE_URL, JWT secret, VAPID and key material),
- an exact PostgreSQL custom dump and JSON snapshot of all 19 tables,
- fixed JSONB-aware standalone importer for recovery,
- hosting configuration listings.
CONFIDENTIAL: the archive contains personal data, password hashes and server credentials.
Store only in a controlled/private vault. Do not upload to public GitHub.
Restore on a separate machine/DB only after validating the intended destination,
schema and table counts. Never restore into the Railway production database.
NODE / Passenger must serve server.cjs through the isolated entrypoint.
Preserve this archive unchanged and verify its SHA-256 before use.
NOTE
chmod 600 "$vault/RESTORE_INSTRUCTIONS.txt" "$vault/restore-db-jsonb-v311.cjs" "$vault/www-state-20261105.txt" "$vault/postgres-state-20261105.txt"
cd "$HOME"
zip -q -r "$archive" \
  lowcy-small2-20261023 \
  .config/lowcy-small2 \
  domains/lowcymethodowcy.smallhost.pl/public_nodejs \
  .private-lowcy-archives/lowcy-db-all-19-tables-v311-20261105.json \
  .private-lowcy-archives/lowcy-postgresql-custom-v311-20261105.dump \
  .private-lowcy-archives/restore-db-jsonb-v311.cjs \
  .private-lowcy-archives/www-state-20261105.txt \
  .private-lowcy-archives/postgres-state-20261105.txt \
  .private-lowcy-archives/RESTORE_INSTRUCTIONS.txt
chmod 600 "$archive"
unzip -tq "$archive" >/dev/null
printf 'SMALL2_COMPLETE_RECOVERY_ZIP_OK size_bytes=%s sha256=%s\n' "$(wc -c < "$archive" | tr -d ' ')" "$(sha256sum "$archive" | cut -d' ' -f1)"
echo 'SMALL2_RESTORE_ARCHIVE_STORED_PRIVATE_0700_DIRECTORY'
