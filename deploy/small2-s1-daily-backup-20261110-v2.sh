#!/bin/sh
# SMALL2 S1 independent encrypted-access private backup; do not access Railway.
set -eu
umask 077
PATH=/usr/local/bin:/usr/bin:/bin:/sbin:/usr/sbin
export PATH
ROOT="$HOME/lowcy-small2-20261023"
CONFIG="$HOME/.config/lowcy-small2/runtime.json"
VAULT="$HOME/.private-lowcy-archives/s1-daily"
mkdir -p "$VAULT"
chmod 700 "$VAULT"
LOCK="$VAULT/.s1-backup.lock"
if ! mkdir "$LOCK" 2>/dev/null; then echo 'SMALL2_S1_BACKUP_ALREADY_RUNNING'; exit 2; fi
TEMP=''
cleanup(){ [ -z "$TEMP" ] || { [ ! -d "$TEMP" ] || rm -rf -- "$TEMP"; }; rmdir "$LOCK" 2>/dev/null || true; }
trap cleanup EXIT HUP INT TERM
for f in "$ROOT/server.cjs" "$ROOT/backup-db.cjs" "$ROOT/backup-lib.cjs" "$CONFIG"; do test -s "$f"; done
for cmd in node pg_dump pg_restore zip unzip sha256sum mktemp; do command -v "$cmd" >/dev/null; done
TEMP="$(mktemp -d "$VAULT/.build-s1.XXXXXXXX")"
node - "$ROOT" "$CONFIG" "$TEMP" <<'NODE'
'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const [root,config,dir]=process.argv.slice(2);
const settings=JSON.parse(fs.readFileSync(config,'utf8'));
const url=new URL(settings.DATABASE_URL||'postgres://x:y@invalid/invalid');
if(url.hostname!=='pgsql3.small.pl'||url.pathname!=='/p1828_lowcy_kop'||!['postgres:','postgresql:'].includes(url.protocol))throw Error('SMALL2_S1_WRONG_DB');
const connection={...process.env,PGPASSWORD:decodeURIComponent(url.password)};
const pgargs=['--host',url.hostname,'--port',url.port||'5432','--username',decodeURIComponent(url.username),'--dbname',url.pathname.slice(1),'--format=custom','--file',path.join(dir,'postgres-full.dump')];
const pg=cp.spawnSync('pg_dump',pgargs,{env:connection,encoding:'utf8',maxBuffer:8*1024*1024});
if(pg.status!==0)throw Error('SMALL2_S1_PGDUMP_FAILED '+pg.status);
const json=cp.spawnSync(process.execPath,['backup-db.cjs',path.join(dir,'snapshot-19-tables.json')],{
 cwd:root,env:{...process.env,DATABASE_URL:settings.DATABASE_URL,APP_VERSION:'S1',BACKUP_NOTE:'SMALL2 autonomous daily copy'},encoding:'utf8',maxBuffer:8*1024*1024
});
if(json.status!==0)throw Error('SMALL2_S1_JSON_BACKUP_FAILED '+json.status);
const snapshot=JSON.parse(fs.readFileSync(path.join(dir,'snapshot-19-tables.json'),'utf8'));
if(snapshot.format!=='LOWCY_METHODOWCY_DB_BACKUP_V1'||snapshot.database?.tables!==19)throw Error('SMALL2_S1_BACKUP_SCHEMA_INVALID');
for(const [table,min] of Object.entries({users:73,competitions:7,draws:285,results:285})){
 if((snapshot.database.counts?.[table]||0)<min)throw Error('SMALL2_S1_BACKUP_BASELINE_INVALID_'+table);
}
const manifest={created_at:new Date().toISOString(),source:'SMALL2',dbHost:url.hostname,database:url.pathname.slice(1),tables:snapshot.database.tables,counts:snapshot.database.counts};
fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600});
console.log('SMALL2_S1_DB_SNAPSHOT_VALIDATED',JSON.stringify({tables:manifest.tables,users:manifest.counts.users,competitions:manifest.counts.competitions,draws:manifest.counts.draws,results:manifest.counts.results}));
NODE
pg_restore --list "$TEMP/postgres-full.dump" > "$TEMP/pg-restore-list.txt"
test -s "$TEMP/pg-restore-list.txt"
(
 cd "$TEMP"
 zip -q -9 "backup-S1.zip" postgres-full.dump snapshot-19-tables.json manifest.json pg-restore-list.txt
 unzip -t -qq backup-S1.zip >/dev/null
 sha256sum backup-S1.zip > SHA256SUMS
)
DATE="$(date -u +%Y%m%d-%H%M%S)"
DEST="$VAULT/$DATE"
test ! -e "$DEST"
mkdir -m 700 "$DEST"
for name in backup-S1.zip SHA256SUMS manifest.json; do mv "$TEMP/$name" "$DEST/$name"; done
chmod 600 "$DEST/"*
echo "SMALL2_S1_AUTONOMOUS_BACKUP_OK dir=$DATE size=$(wc -c < "$DEST/backup-S1.zip" | tr -d ' ')"
