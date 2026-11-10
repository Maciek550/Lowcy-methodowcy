#!/bin/sh
# Separate server-side restore bundles. No application changes or old-backup deletion.
set -eu
umask 077
PATH=/usr/local/bin:/usr/bin:/bin:/sbin:/usr/sbin
export PATH
project=${1:?Expected lowcy or matchthis}
case "$project" in lowcy|matchthis) ;; *) exit 64;; esac
vault="$HOME/.private-project-backups/$project"
mkdir -p "$vault"
chmod 700 "$HOME/.private-project-backups" "$vault"
lock="$vault/.lock"
mkdir "$lock" 2>/dev/null || { echo "BACKUP_LOCKED $project"; exit 2; }
stage=''
cleanup(){ if [ -n "$stage" ] && [ -d "$stage" ]; then rm -rf -- "$stage"; fi; rmdir "$lock" 2>/dev/null || true; }
trap cleanup EXIT HUP INT TERM
stage=$(mktemp -d "$vault/.build.XXXXXXXX")
mkdir "$stage/payload" "$stage/verify"
stamp=$(date -u +%Y%m%d-%H%M%S)
if [ "$project" = lowcy ]; then
  "$HOME/.config/lowcy-small2/daily-backup-s1-20261110-v2.sh"
  latest=$(ls -1dt "$HOME"/.private-lowcy-archives/s1-daily/20* | head -n 1)
  (cd "$latest" && sha256sum -c SHA256SUMS)
  cp "$latest/backup-S1.zip" "$stage/payload/database.zip"
  mkdir "$stage/payload/database"
  unzip -q "$stage/payload/database.zip" -d "$stage/payload/database"
  pg_restore --file=/dev/null "$stage/payload/database/postgres-full.dump"
  test -s "$HOME/lowcy-small2-20261023/server.cjs"
  test -s "$HOME/.config/lowcy-small2/runtime.json"
  tar -czf "$stage/payload/application.tar.gz" -C "$HOME" lowcy-small2-20261023 .config/lowcy-small2 domains/lowcymethodowcy.smallhost.pl
else
  root="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
  test -s "$root/index.html"
  test -s "$root/.mt41-private/users.php"
  test -d "$HOME/matchthis-independent"
  tar -czf "$stage/payload/application.tar.gz" -C "$HOME" domains/matchthis.lowcymethodowcy.smallhost.pl matchthis-independent
fi
tar -xzf "$stage/payload/application.tar.gz" -C "$stage/verify"
if [ "$project" = lowcy ]; then
  test -s "$stage/verify/lowcy-small2-20261023/server.cjs"
  test -s "$stage/verify/.config/lowcy-small2/runtime.json"
else
  check="$stage/verify/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
  test -s "$check/index.html"
  test -s "$check/.mt41-private/users.php"
  php -l "$check/.mt41-private/users.php" >/dev/null
  if [ -f "$check/.mt41-private/mt60-published-draws.json" ]; then
    node -e 'const fs=require("fs");const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));if(!Array.isArray(j))process.exit(1);console.log("PUBLISHED_ROUNDS_BACKED_UP",j.length)' "$check/.mt41-private/mt60-published-draws.json"
  fi
fi
printf 'project=%s\ncreated_utc=%s\nvalidation=archive_extracted_and_required_files_checked\n' "$project" "$stamp" > "$stage/payload/manifest.txt"
cat > "$stage/payload/RESTORE.txt" <<'RESTORE'
Private server backup. Includes configuration and account data: keep confidential.
Verify SHA256SUMS first. Extract backup.tar.gz into a private empty directory.
application.tar.gz contains paths relative to the SMALL2 account home directory.
Restore into a separate test environment first; do not overwrite production blindly.
Lowcy only: database/postgres-full.dump is a PostgreSQL custom-format dump.
Restore using pg_restore into a new empty database, then adapt runtime.json.
MatchThis: includes site files, private account data, role pages, published draws,
and matchthis-independent release files. Browser-only localStorage edits are NOT
included. Export those from the original administrator browser separately.
This backup validates extraction, not a complete application/database restore.
RESTORE
(cd "$stage/payload" && tar -czf "$stage/backup.tar.gz" .)
gzip -t "$stage/backup.tar.gz"
(cd "$stage" && sha256sum backup.tar.gz > SHA256SUMS)
dest="$vault/$stamp"
test ! -e "$dest"
mkdir -m 700 "$dest"
mv "$stage/backup.tar.gz" "$stage/SHA256SUMS" "$dest/"
cp "$stage/payload/manifest.txt" "$dest/manifest.txt"
chmod 600 "$dest/"*
(cd "$dest" && sha256sum -c SHA256SUMS)
printf 'FULL_BACKUP_OK project=%s utc=%s bytes=%s\n' "$project" "$stamp" "$(wc -c < "$dest/backup.tar.gz" | tr -d ' ')"
