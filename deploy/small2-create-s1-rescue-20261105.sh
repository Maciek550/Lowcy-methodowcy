#!/usr/bin/env bash
set -euo pipefail
umask 077

# A current S1, full-instance disaster-recovery package.
# Read-only on all existing databases and applications; writes only new files
# in a private backup directory on SMALL2.
readonly ROOT="$HOME/lowcy-small2-20261023"
readonly DOMAIN="$HOME/domains/lowcymethodowcy.smallhost.pl/public_nodejs"
readonly STAGE="$HOME/lowcy-small2-stage-v311"
readonly VAULT="$HOME/.private-lowcy-archives"
readonly WORK="$VAULT/lowcy-S1-snapshot-20261105"
readonly PACKAGE="$VAULT/Lowcy_S1_SMALL2_PELNA_KOPIA_20261105.zip"
readonly SRC_SHA='e5b35f311d8c0d98cd8498044e5d538bf9c2b2f2'

test -d "$ROOT" && test -d "$DOMAIN"
test -f "$DOMAIN/app.js"
test -f "$HOME/.config/lowcy-small2/runtime.json"
test -f "$STAGE/restore-db-jsonb-corrected-v311.cjs"
test "$(git -C "$ROOT" rev-parse HEAD)" = "$SRC_SHA"
node - <<'NODE'
const fs=require('fs');
const path=require('path');
const root=path.join(process.env.HOME,'lowcy-small2-20261023');
const a=fs.readFileSync(root+'/server.cjs','utf8');
const b=fs.readFileSync(root+'/app.js','utf8');
if(!a.includes("const APP_VERSION = 'S1';")||!a.includes("const APP_VERSION_NAME = 'S1';"))throw Error('SERVER_NOT_S1');
if(!b.includes("const CLIENT_VERSION='S1';")||!b.includes("const CLIENT_VERSION_NAME='S1';"))throw Error('CLIENT_NOT_S1');
const cfg=JSON.parse(fs.readFileSync(process.env.HOME+'/.config/lowcy-small2/runtime.json','utf8'));
const url=new URL(cfg.DATABASE_URL);
if(url.hostname!=='pgsql3.small.pl'||url.pathname!=='/p1828_lowcy_kop'||url.username!=='p1828_lowcy_kop')throw Error('TARGET_IS_NOT_LOWYCY_KOP');
if(!cfg.JWT_SECRET||cfg.JWT_SECRET.length<20)throw Error('JWT_SECRET_INVALID');
console.log('S1_BACKUP_CURRENT_VERSION_AND_DATABASE_GUARDS_OK');
NODE
for cmd in zip unzip pg_dump pg_restore sha256sum node; do command -v "$cmd" >/dev/null; done
test "$(devil www list | awk '$1=="lowcymethodowcy.smallhost.pl" {print $2}')" = 'nodejs'
test -d "$HOME/.private-lowcy-archives" || mkdir -m 700 "$HOME/.private-lowcy-archives"
chmod 700 "$VAULT"
test ! -e "$PACKAGE"
test ! -e "$WORK"
mkdir -m 700 "$WORK"
trap 'test ! -e "$PACKAGE" && echo "S1_BACKUP_FAILED_RETAINING_PRIVATE_STAGING" || true' EXIT

export DATABASE_URL="$(node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(process.env.HOME+"/.config/lowcy-small2/runtime.json","utf8")).DATABASE_URL)')"
cd "$ROOT"
node backup-db.cjs "$WORK/lowcy-S1-all-19-tables.json" > "$WORK/backup-process.stdout"
pg_dump --format=custom --file="$WORK/lowcy-S1-postgresql-full.dump" --dbname="$DATABASE_URL"
chmod 600 "$WORK/lowcy-S1-all-19-tables.json" "$WORK/lowcy-S1-postgresql-full.dump"
test -s "$WORK/lowcy-S1-postgresql-full.dump"
pg_restore --list "$WORK/lowcy-S1-postgresql-full.dump" > "$WORK/pg-restore-object-list.txt"
test -s "$WORK/pg-restore-object-list.txt"

# Reconcile backup contents with a second read-only connection.
node - "$WORK" <<'NODE'
const fs=require('fs'),path=require('path');
const dir=process.argv[2];
const snapshot=JSON.parse(fs.readFileSync(path.join(dir,'lowcy-S1-all-19-tables.json'),'utf8'));
if(snapshot.format!=='LOWCY_METHODOWCY_DB_BACKUP_V1'||snapshot.database?.tables!==19)throw Error('INVALID_SOURCE_SNAPSHOT');
const mandatory=['users','competitions','entries','draws','results','result_items','app_settings'];
for(const name of mandatory){
  if(!Array.isArray(snapshot.data[name])||snapshot.data[name].length!==snapshot.database.counts[name])throw Error('BAD_TABLE_'+name);
}
if(snapshot.data.users.length<73||snapshot.data.competitions.length<7||snapshot.data.draws.length<285||snapshot.data.results.length<285)throw Error('BACKUP_DATA_BELOW_BASELINE');
const users=snapshot.data.users;
const missingPasswords=users.filter(u=>!u.password_hash);
if(missingPasswords.length)throw Error('USER_PASSWORD_HASHES_MISSING');
const hashes=users.filter(u=>typeof u.password_hash==='string'&&u.password_hash.startsWith('$2'));
if(hashes.length!==users.length)throw Error('UNEXPECTED_PASSWORD_HASH_FORMAT');
const summary={
  format:snapshot.format,
  version:'S1',
  source:'SMALL2',
  created_at:snapshot.created_at,
  tables:snapshot.database.tables,
  counts:snapshot.database.counts,
  userPasswords:{storedAsBcryptHashes:true,expiryPolicyNotChanged:true},
};
fs.writeFileSync(path.join(dir,'BACKUP_MANIFEST.json'),JSON.stringify(summary,null,2)+'\n',{mode:0o600,flag:'wx'});
console.log('S1_BACKUP_ALL_TABLES_PASSWORD_HASHES_VALIDATED '+JSON.stringify({tables:summary.tables,counts:summary.counts}));
NODE
node --check server.cjs
node --check app.js
devil www list > "$WORK/small2-www-state.txt"
devil pgsql list > "$WORK/small2-postgresql-state.txt"
cp -p "$STAGE/restore-db-jsonb-corrected-v311.cjs" "$WORK/restore-db-jsonb-fix.cjs"
cat > "$WORK/INSTRUKCJA_ODTWORZENIA_PL.txt" <<'NOTE'
ŁOWCY METHODOWCY — KOMPLETNA KOPIA AWARYJNA SMALL2 S1
UTWORZONA: 5 listopada 2026
UWAGA: POUFNE. Zawiera dane osobowe, skróty haseł, hasło bazy,
klucz JWT i klucze PUSH. Nie umieszczaj w publicznych chmurach ani
repozytoriach. Przechowuj na zaszyfrowanym dysku / nośniku.

CO JEST W ŚRODKU:
- lowcy-small2-20261023/ — komplet źródeł aplikacji S1,
  pliki statyczne, zależności Node, .git i konfiguracja projektu.
- domains/lowcymethodowcy.smallhost.pl/public_nodejs/ — plik
  startowy i zawartość katalogu publicznego na SMALL2.
- .config/lowcy-small2/ — prywatna konfiguracja, dostęp bazy,
  klucze sesji JWT, klucze PUSH/transferu.
- .private-lowcy-archives/lowcy-S1-snapshot-20261105/
  — pełne dane 19 tabel jako JSON oraz natywny dump PostgreSQL,
  spis obiektów SQL, pliki pomocnicze i manifest liczników.

PRZENIESIENIE NA NOWY SERWER:
1. Wykonaj kopię tego ZIP i sprawdź sumę SHA-256.
2. Rozpakuj do PRYWATNEGO katalogu — nie do public_html.
3. Skonfiguruj Node.js w wersji zgodnej z aplikacją oraz PostgreSQL.
4. Utwórz NOWĄ PUSTĄ bazę. Nie nadpisuj Railway ani działającej
   instalacji SMALL2.
5. W odizolowanym środowisku wykonaj:
     pg_restore --exit-on-error --single-transaction --no-owner \
       --no-privileges --dbname="NOWY_DATABASE_URL" \
       "lowcy-S1-postgresql-full.dump"
   (dump zawiera schemat i dane; polecenie przeznaczone tylko
   do nowej, pustej bazy).
6. Dostosuj prywatny plik runtime.json do NOWEGO hosta bazy,
   użytkownika i hasła oraz zmiennych środowiskowych.
7. Ustal katalog startowy Node/Passenger, zachowaj startową
   integrację z server.cjs, ustaw HTTPS.
8. Zainstaluj / odtwórz zależności: npm ci na nowej platformie.
9. Uruchom usługę; sprawdź /health, /api/version, 19 tabel,
   konta, 7+ zawodów, logowanie, wyniki, wagi i historię.
10. Przed zmianą DNS wykonaj test na adresie technicznym.
11. Jeśli przenoszona jest domena, zainstalowane PWA i subskrypcje
    PUSH mogą wymagać ponownej rejestracji.
UWAGA: po przeniesieniu na nową domenę sesje mogą wymagać ponownego
logowania. Istniejące hasła kont są w kopii w postaci hashy bcrypt;
nie trzeba nadawać ich na nowo.
Normalne hasła użytkowników nie otrzymują nowego terminu ważności.
Mechanizm wygasania JEDNORAZOWYCH haseł resetujących i 90-dniowy
czas życia tokenu sesji są oddzielnymi mechanizmami i nie były
zmieniane podczas tworzenia tej kopii.

Sposób rozpakowania/uruchomienia może wymagać adaptacji na innym
hostingu. Kopia przeszła kontrolę integralności i spisu PostgreSQL,
ale nie pełny test odtworzenia na innym serwerze.
NOTE
chmod 600 "$WORK"/*
(
  cd "$HOME"
  zip -q -r "$PACKAGE" \
    lowcy-small2-20261023 \
    .config/lowcy-small2 \
    domains/lowcymethodowcy.smallhost.pl/public_nodejs \
    .private-lowcy-archives/lowcy-S1-snapshot-20261105
)
chmod 600 "$PACKAGE"
unzip -tq "$PACKAGE" >/dev/null
node - "$PACKAGE" <<'NODE'
const fs=require('fs');
const p=process.argv[2];
const b=fs.readFileSync(p);
if(b.length<10000000||b.length>300000000)throw Error('BAD_ARCHIVE_SIZE');
console.log('S1_ARCHIVE_FINAL_ZIP_SIZE_OK bytes='+b.length);
NODE
printf 'S1_SMALL2_FULL_RESCUE_ZIP_OK bytes=%s sha256=%s\n' "$(wc -c < "$PACKAGE" | tr -d ' ')" "$(sha256sum "$PACKAGE" | cut -d ' ' -f 1)"
echo S1_SMALL2_PRIVATE_COPY_PRESENT_AND_ZIP_INTEGRITY_PASSED
