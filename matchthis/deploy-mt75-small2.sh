#!/usr/bin/env bash
# Guarded MT74 -> MT75 on independent MatchThis SMALL2 only.
# Back up prior roles, keep published draws and users, seed central state once.
set -Eeuo pipefail
test -n "${SSH_PASSWORD:-}" || { echo SMALL2_SSH_PASSWORD_MISSING; exit 2; }
mode="${1:-deploy}"
test "$mode" = deploy || test "$mode" = rollback
if test "$mode" = deploy; then
  for suffix in '' '_OGLADACZ' '_SEDZIA'; do
    test -f "matchthis/MatchThis_MT-75$suffix.html"
  done
  test -f matchthis/mt75-seed.json
  test "$(sha256sum matchthis/MatchThis_MT-75.html | cut -d' ' -f1)" = bffd09ff07c8771ff3a359f180d0b4fe930295bc3a10f079b5ecbf27a711fac0
  test "$(sha256sum matchthis/MatchThis_MT-75_OGLADACZ.html | cut -d' ' -f1)" = db6b74cb6bbe139efac93197842ae3da97131b7af486b586e88408e39455875a
  test "$(sha256sum matchthis/MatchThis_MT-75_SEDZIA.html | cut -d' ' -f1)" = d7c9e4ef9737f9651fe1c7697aa9eed69647235b19a81e6252b1756a42cf5147
fi
sudo apt-get -qq update
sudo apt-get -qq install -y sshpass
mkdir -p "$HOME/.ssh";chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256 | awk '{print $2}')" = 'SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8'
export SSHPASS="$SSH_PASSWORD"
opts=(-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15)
remote=lowcymethodowcy@s3.small.pl
if test "$mode" = rollback; then
  sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'RB'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
backup="$HOME/matchthis-independent/mt-75/rollback-mt74"
test -f "$backup/index.html" && test -f "$backup/panel.php"
test "$(sha256sum "$backup/index.html"|cut -d' ' -f1)" = 2595a4fad3fa4a2b5457a345e65f896171b4ca95578d246ec0e599ad537aa4a6
cp -p "$backup/panel.php" "$web/panel.php.next.rollback"
mv -f "$web/panel.php.next.rollback" "$web/panel.php"
cp -p "$backup/index.html" "$web/index.html.next.rollback"
mv -f "$web/index.html.next.rollback" "$web/index.html"
test "$(sha256sum "$web/index.html"|cut -d' ' -f1)" = 2595a4fad3fa4a2b5457a345e65f896171b4ca95578d246ec0e599ad537aa4a6
echo MT75_ROUTES_ROLLED_BACK_MT74_PRIVATE_SEED_PRESERVED
RB
  exit
fi
# Preflight: require exactly the production build audited from SMALL2.
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'PRE'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-75"
test -f "$web/index.html" && test -f "$web/panel.php" && test -d "$web/role-pages"
test -f "$web/.mt41-private/mt60-published-draws.json"
test -f "$web/.mt41-private/mt41-auth.php"
test ! -L "$web/index.html" && test ! -L "$web/panel.php"
test "$(sha256sum "$web/index.html"|cut -d' ' -f1)" = 2595a4fad3fa4a2b5457a345e65f896171b4ca95578d246ec0e599ad537aa4a6
test "$(tail -n +2 "$web/role-pages/mt74-admin.php"|sha256sum|cut -d' ' -f1)" = c92b517bc45e281ea44c8890d0089ad1daf183be67d7689deb33151f16de8581
test "$(tail -n +2 "$web/role-pages/mt74-sedzia.php"|sha256sum|cut -d' ' -f1)" = 8d10378ebb8152bb16da39199f398dcf57d61801b286c356bf6fa5459d21bdd2
grep -Fq 'mt74-admin.php' "$web/panel.php"
grep -Fq 'mt74-sedzia.php' "$web/panel.php"
test ! -e "$web/mt73-state.php" || cmp -s "$web/mt73-state.php" "$stage/mt73-state.php"
test ! -e "$web/mt73-store.php" || cmp -s "$web/mt73-store.php" "$stage/mt73-store.php"
test ! -e "$web/.mt41-private/state-mt73.json"
test ! -e "$stage/rollback-mt74" || test "$(sha256sum "$stage/rollback-mt74/index.html"|cut -d\u0027 \u0027 -f1)" = 2595a4fad3fa4a2b5457a345e65f896171b4ca95578d246ec0e599ad537aa4a6
test ! -e "$web/role-pages/mt75-admin.php" && test ! -e "$web/role-pages/mt75-sedzia.php"
mkdir -p "$stage";chmod 700 "$stage"
echo MT75_PREDEPLOY_EXACT_MT74_AND_NO_PREVIOUS_SERVER_STATE_CONFIRMED
PRE
sshpass -e scp "${opts[@]}" matchthis/MatchThis_MT-75.html matchthis/MatchThis_MT-75_OGLADACZ.html matchthis/MatchThis_MT-75_SEDZIA.html matchthis/mt75-seed.json matchthis/mt73-state.php matchthis/mt73-store.php matchthis/mt73-install-state.php "$remote:matchthis-independent/mt-75/"
switched=0
restore_on_error(){
  st=$?;trap - EXIT
  if test "$st" != 0 && test "$switched" = 1; then
    echo MT75_AUTO_ROUTE_ROLLBACK_START
    sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'RB' || echo MT75_ROLLBACK_FAILED_REQUIRES_INSPECTION
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
backup="$HOME/matchthis-independent/mt-75/rollback-mt74"
cp -p "$backup/panel.php" "$web/panel.php.next.rollback"
mv -f "$web/panel.php.next.rollback" "$web/panel.php"
cp -p "$backup/index.html" "$web/index.html.next.rollback"
mv -f "$web/index.html.next.rollback" "$web/index.html"
echo MT75_AUTO_ROLLED_BACK_ROUTES_PRIVATE_STATE_SAVED
RB
  fi
  exit "$st"
}
trap restore_on_error EXIT
# Switch only after the authoritative state is seeded and validated.
switched=1
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'ACT'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-75"
backup="$stage/rollback-mt74"
test ! -e "$backup" || test "$(sha256sum "$backup/index.html"|cut -d\u0027 \u0027 -f1)" = 2595a4fad3fa4a2b5457a345e65f896171b4ca95578d246ec0e599ad537aa4a6
test "$(sha256sum "$web/index.html"|cut -d' ' -f1)" = 2595a4fad3fa4a2b5457a345e65f896171b4ca95578d246ec0e599ad537aa4a6
test "$(sha256sum "$stage/MatchThis_MT-75.html"|cut -d' ' -f1)" = bffd09ff07c8771ff3a359f180d0b4fe930295bc3a10f079b5ecbf27a711fac0
test "$(sha256sum "$stage/MatchThis_MT-75_OGLADACZ.html"|cut -d' ' -f1)" = db6b74cb6bbe139efac93197842ae3da97131b7af486b586e88408e39455875a
test "$(sha256sum "$stage/MatchThis_MT-75_SEDZIA.html"|cut -d' ' -f1)" = d7c9e4ef9737f9651fe1c7697aa9eed69647235b19a81e6252b1756a42cf5147
mkdir -p -m 700 "$backup"
cp -p "$web/index.html" "$backup/index.html"
cp -p "$web/panel.php" "$backup/panel.php"
cp -p "$web/role-pages/mt74-admin.php" "$backup/mt74-admin.php"
cp -p "$web/role-pages/mt74-sedzia.php" "$backup/mt74-sedzia.php"
cp -p "$web/.mt41-private/mt60-published-draws.json" "$backup/mt60-published-draws.json"
# Central state does not yet exist; never overwrite an existing store.
test ! -e "$web/mt73-store.php" || cmp -s "$web/mt73-store.php" "$stage/mt73-store.php"
test ! -e "$web/mt73-state.php" || cmp -s "$web/mt73-state.php" "$stage/mt73-state.php"
cp -p "$stage/mt73-store.php" "$web/mt73-store.php"
cp -p "$stage/mt73-state.php" "$web/mt73-state.php"
php -l "$web/mt73-state.php" >/dev/null
php -l "$web/mt73-store.php" >/dev/null
cp -p "$stage/mt75-seed.json" "$stage/mt73-seed.json"
php "$stage/mt73-install-state.php" "$web" "$stage"
python3 - "$web" <<'PY'
import json,sys,pathlib
web=pathlib.Path(sys.argv[1]);s=json.loads((web/'.mt41-private/state-mt73.json').read_text())
assert s['revision']==1 and s['seeded'] is True
db=s['data'];assert len(db['events'])==14 and len(db['cycles'])==2
f=next(x for x in db['events'] if x['id']=='mt2025-mega_final_2025')['rounds'][1]['results']
assert len(f)==54 and all(r.get('sector') and r.get('peg') for r in f)
assert len({r['peg'] for r in f})==54
print('MT75_PRIVATE_SERVER_STATE_SEEDED_54_SECTORS_CORRECT')
PY
# Prepare private guarded PHP roles before any public route changes.
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$stage/MatchThis_MT-75.html"; } > "$stage/mt75-admin.php"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$stage/MatchThis_MT-75_SEDZIA.html"; } > "$stage/mt75-sedzia.php"
php -l "$stage/mt75-admin.php" >/dev/null
php -l "$stage/mt75-sedzia.php" >/dev/null
python3 - "$backup/panel.php" "$stage/panel.php" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text('utf8')
for a,b in (('mt74-admin.php','mt75-admin.php'),('mt74-sedzia.php','mt75-sedzia.php')):
 assert s.count(a)==1,(a,s.count(a))
 s=s.replace(a,b)
Path(sys.argv[2]).write_text(s,'utf8')
PY
php -l "$stage/panel.php" >/dev/null
cp -p "$stage/mt75-admin.php" "$web/role-pages/mt75-admin.php.next"
cp -p "$stage/mt75-sedzia.php" "$web/role-pages/mt75-sedzia.php.next"
mv -f "$web/role-pages/mt75-admin.php.next" "$web/role-pages/mt75-admin.php"
mv -f "$web/role-pages/mt75-sedzia.php.next" "$web/role-pages/mt75-sedzia.php"
cp -p "$stage/panel.php" "$web/panel.php.next"
mv -f "$web/panel.php.next" "$web/panel.php"
cp -p "$stage/MatchThis_MT-75_OGLADACZ.html" "$web/index.html.next"
mv -f "$web/index.html.next" "$web/index.html"
test "$(sha256sum "$web/index.html"|cut -d' ' -f1)" = db6b74cb6bbe139efac93197842ae3da97131b7af486b586e88408e39455875a
test "$(tail -n +2 "$web/role-pages/mt75-admin.php"|sha256sum|cut -d' ' -f1)" = bffd09ff07c8771ff3a359f180d0b4fe930295bc3a10f079b5ecbf27a711fac0
test "$(tail -n +2 "$web/role-pages/mt75-sedzia.php"|sha256sum|cut -d' ' -f1)" = d7c9e4ef9737f9651fe1c7697aa9eed69647235b19a81e6252b1756a42cf5147
grep -Fq 'mt75-admin.php' "$web/panel.php"
grep -Fq 'mt75-sedzia.php' "$web/panel.php"
touch "$stage/DEPLOYED"
echo MT75_INSTALLED_3_ROLES_AND_PRIVATE_SERVER_STATE_WITH_BACKUP
ACT
url=https://matchthis.lowcymethodowcy.smallhost.pl
curl -fsSL --max-time 25 "$url/" -o /tmp/mt75-published.html
test "$(sha256sum /tmp/mt75-published.html|cut -d' ' -f1)" = db6b74cb6bbe139efac93197842ae3da97131b7af486b586e88408e39455875a
curl -fsSL --max-time 25 "$url/mt73-state.php?public=1" -o /tmp/mt75-public-state.json
node -e 'const d=require("/tmp/mt75-public-state.json");const r=d.data.events.find(e=>e.id==="mt2025-mega_final_2025").rounds[1].results;if(r.length!==54||r.some(x=>!x.sector||!x.peg))process.exit(1);console.log("MT75_LIVE_PUBLIC_SERVER_STATE_54_ASSIGNMENTS_PASS")'
test "$(curl -sS -o /dev/null -w '%{http_code}' "$url/mt73-state.php")" = 401
test "$(curl -sS -o /dev/null -w '%{http_code}' -X POST "$url/mt73-state.php")" = 401
test "$(curl -sS -o /dev/null -w '%{http_code}' "$url/panel.php")" = 303
for role in mt75-admin.php mt75-sedzia.php; do
  status="$(curl -sS -o /dev/null -w '%{http_code}' "$url/role-pages/$role")"
  test "$status" = 403 || test "$status" = 404
done
echo MT75_PUBLIC_SERVER_STATE_SECURITY_ROUTER_CHECK_PASS
switched=0
