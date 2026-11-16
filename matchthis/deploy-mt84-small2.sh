#!/usr/bin/env bash
# MT84: read existing T2 assignments when separate sector plan is absent.
# Absolutely no server database, draw or icon changes.
set -Eeuo pipefail
mode="${1:-deploy}"
test "$mode" = deploy || test "$mode" = rollback
test -n "${SSH_PASSWORD:-}" || { echo 'No existing SMALL2 SSH secret';exit 2; }
sudo apt-get -qq update
sudo apt-get -qq install -y sshpass
mkdir -p "$HOME/.ssh";chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256|awk '{print $2}')" = 'SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8'
export SSHPASS="$SSH_PASSWORD"
opts=(-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15)
remote=lowcymethodowcy@s3.small.pl
if test "$mode" = rollback;then
  sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'RESTORE'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-84-t2-r1/previous"
test -f "$stage/index.html" && test -f "$stage/panel.php"
test "$(sha256sum "$stage/index.html"|awk '{print $1}')" = 24c6e6757e5dbc85769597dda6c5df3afcb6e1e537cc9ece7664855db6ad38aa
current="$(sha256sum "$web/index.html"|awk '{print $1}')"
test "$current" = 665ba63846b5481ceeb2d7812b29cc3738fa1bb66029aaf2cb3836358511f263 || test "$current" = 24c6e6757e5dbc85769597dda6c5df3afcb6e1e537cc9ece7664855db6ad38aa
cp -p "$stage/panel.php" "$web/panel.php.mt84-rollback"
mv -f "$web/panel.php.mt84-rollback" "$web/panel.php"
cp -p "$stage/index.html" "$web/index.html.mt84-rollback"
mv -f "$web/index.html.mt84-rollback" "$web/index.html"
echo MT84_ROLLBACK_TO_MT83_SERVER_DATA_UNTOUCHED
RESTORE
  exit
fi
for item in \
  '2daaeef1f9c3a404b55d01588682c93f615daf3a824d1f393967c4b19292bdbc matchthis/MatchThis_MT-84.html' \
  '665ba63846b5481ceeb2d7812b29cc3738fa1bb66029aaf2cb3836358511f263 matchthis/MatchThis_MT-84_OGLADACZ.html' \
  '5ddbdc2796786518967d5026f002c41d7d2c47c125f15cc09d6b4a3d7c64770b matchthis/MatchThis_MT-84_SEDZIA.html'; do
  echo "$item" | sha256sum -c -
done
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'PRE'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = 24c6e6757e5dbc85769597dda6c5df3afcb6e1e537cc9ece7664855db6ad38aa
test "$(tail -n +2 "$web/role-pages/mt83-admin.php"|sha256sum|awk '{print $1}')" = defbdb62a66f70c016b83ec6cfdb2f281f1e4b07709ea0a26fc0ed362f71361c
test "$(tail -n +2 "$web/role-pages/mt83-sedzia.php"|sha256sum|awk '{print $1}')" = af5727e4f26b7019de7502963322725d6d5528f8b0ece0a91969fca1867c56ef
grep -Fq 'mt83-admin.php' "$web/panel.php"
grep -Fq 'mt83-sedzia.php' "$web/panel.php"
test ! -e "$web/role-pages/mt84-admin.php" || test "$(tail -n +2 "$web/role-pages/mt84-admin.php"|sha256sum|awk '{print $1}')" = 2daaeef1f9c3a404b55d01588682c93f615daf3a824d1f393967c4b19292bdbc
test ! -e "$web/role-pages/mt84-sedzia.php" || test "$(tail -n +2 "$web/role-pages/mt84-sedzia.php"|sha256sum|awk '{print $1}')" = 5ddbdc2796786518967d5026f002c41d7d2c47c125f15cc09d6b4a3d7c64770b
test ! -e "$HOME/matchthis-independent/mt-84-t2-r1/previous"
test ! -L "$web/index.html" && test ! -L "$web/panel.php"
test -f "$web/.mt41-private/state-mt73.json" && test ! -L "$web/.mt41-private/state-mt73.json"
test -f "$web/.mt41-private/mt60-published-draws.json"
test "$(sha256sum "$web/matchthis-orange-mt79-32.png"|awk '{print $1}')" = c1dc3ff23667d074224eb6eb6265c7c9b5cbc40f0329a63fe3b0199f7b2e3f02
mkdir -p "$HOME/matchthis-independent/mt-84-t2-r1"
chmod 700 "$HOME/matchthis-independent/mt-84-t2-r1"
python3 - "$web/.mt41-private/state-mt73.json" <<'PY_STATE'
import json,sys
s=json.load(open(sys.argv[1]))
e=next(e for e in s['data']['events'] if e['id']=='mt2026-xiv-puchar-matchthis-28-29-nov')
t=e['rounds'][1]
entries=t.get('mt55Entries',[])
assert len(entries)==71
assert len({r['peg'] for r in entries})==71
assert len({r['sector'] for r in entries})==6
assert all(r['competitorId'] for r in entries)
print('MT84_PRIVATE_T2_READONLY', 'entries',len(entries),'sectors',6,'has_plan',bool(t.get('mt55SectorPlan')), 'revision',s['revision'])
PY_STATE
echo MT84_EXACT_MT83_THREE_ROLES_AND_ICON_PRECHECK_PASS
PRE
sshpass -e scp "${opts[@]}" matchthis/MatchThis_MT-84.html matchthis/MatchThis_MT-84_OGLADACZ.html matchthis/MatchThis_MT-84_SEDZIA.html "$remote:matchthis-independent/mt-84-t2-r1/"
installed=0
cleanup(){
  code=$?
  trap - EXIT
  if test "$code" -ne 0 && test "$installed" = 1;then
    echo MT84_AUTO_ROLLBACK_ON_FAILED_RELEASE
    sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'REVERT' || echo MT84_ROLLBACK_ERROR_REQUIRES_REVIEW
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
prior="$HOME/matchthis-independent/mt-84-t2-r1/previous"
test -f "$prior/index.html" && test -f "$prior/panel.php"
test "$(sha256sum "$prior/index.html"|awk '{print $1}')" = 24c6e6757e5dbc85769597dda6c5df3afcb6e1e537cc9ece7664855db6ad38aa
cp -p "$prior/panel.php" "$web/panel.php.tmp-restore"
mv -f "$web/panel.php.tmp-restore" "$web/panel.php"
cp -p "$prior/index.html" "$web/index.html.tmp-restore"
mv -f "$web/index.html.tmp-restore" "$web/index.html"
echo MT84_ROUTES_RESTORED_MT83_DATA_NEVER_CHANGED
REVERT
  fi
  exit "$code"
}
trap cleanup EXIT
installed=1
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'INSTALL'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-84-t2-r1"
prior="$stage/previous"
sha(){ sha256sum "$1"|awk '{print $1}'; }
test "$(sha "$web/index.html")" = 24c6e6757e5dbc85769597dda6c5df3afcb6e1e537cc9ece7664855db6ad38aa
test "$(sha "$stage/MatchThis_MT-84.html")" = 2daaeef1f9c3a404b55d01588682c93f615daf3a824d1f393967c4b19292bdbc
test "$(sha "$stage/MatchThis_MT-84_OGLADACZ.html")" = 665ba63846b5481ceeb2d7812b29cc3738fa1bb66029aaf2cb3836358511f263
test "$(sha "$stage/MatchThis_MT-84_SEDZIA.html")" = 5ddbdc2796786518967d5026f002c41d7d2c47c125f15cc09d6b4a3d7c64770b
mkdir -m 700 "$prior"
cp -p "$web/index.html" "$prior/index.html"
cp -p "$web/panel.php" "$prior/panel.php"
cp -p "$web/role-pages/mt83-admin.php" "$prior/mt83-admin.php"
cp -p "$web/role-pages/mt83-sedzia.php" "$prior/mt83-sedzia.php"
cp -p "$web/.mt41-private/state-mt73.json" "$prior/state-mt73.json"
cp -p "$web/.mt41-private/mt60-published-draws.json" "$prior/mt60-published-draws.json"
cmp "$prior/state-mt73.json" "$web/.mt41-private/state-mt73.json"
cmp "$prior/mt60-published-draws.json" "$web/.mt41-private/mt60-published-draws.json"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>'; cat "$stage/MatchThis_MT-84.html"; } > "$stage/mt84-admin.php"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>'; cat "$stage/MatchThis_MT-84_SEDZIA.html"; } > "$stage/mt84-sedzia.php"
php -l "$stage/mt84-admin.php" >/dev/null
php -l "$stage/mt84-sedzia.php" >/dev/null
python3 - "$prior/panel.php" "$stage/panel.php" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text('utf8')
for old,new in [('mt83-admin.php','mt84-admin.php'),('mt83-sedzia.php','mt84-sedzia.php')]:
 assert s.count(old)==1,(old,s.count(old))
 s=s.replace(old,new)
Path(sys.argv[2]).write_text(s,'utf8')
PY
php -l "$stage/panel.php" >/dev/null
for role in admin sedzia;do
 cp -p "$stage/mt84-$role.php" "$web/role-pages/mt84-$role.php.next"
 mv -f "$web/role-pages/mt84-$role.php.next" "$web/role-pages/mt84-$role.php"
done
cp -p "$stage/panel.php" "$web/panel.php.next"
mv -f "$web/panel.php.next" "$web/panel.php"
cp -p "$stage/MatchThis_MT-84_OGLADACZ.html" "$web/index.html.next"
mv -f "$web/index.html.next" "$web/index.html"
test "$(sha "$web/index.html")" = 665ba63846b5481ceeb2d7812b29cc3738fa1bb66029aaf2cb3836358511f263
test "$(tail -n +2 "$web/role-pages/mt84-admin.php"|sha256sum|awk '{print $1}')" = 2daaeef1f9c3a404b55d01588682c93f615daf3a824d1f393967c4b19292bdbc
test "$(tail -n +2 "$web/role-pages/mt84-sedzia.php"|sha256sum|awk '{print $1}')" = 5ddbdc2796786518967d5026f002c41d7d2c47c125f15cc09d6b4a3d7c64770b
cmp "$prior/state-mt73.json" "$web/.mt41-private/state-mt73.json"
cmp "$prior/mt60-published-draws.json" "$web/.mt41-private/mt60-published-draws.json"
echo MT84_THREE_ROLES_INSTALLED_ON_SMALL2_MT83_BACKUP_AND_UNTOUCHED_DATA_PASS
INSTALL
curl -fsSL --max-time 30 https://matchthis.lowcymethodowcy.smallhost.pl/ -o /tmp/mt84-live.html
test "$(sha256sum /tmp/mt84-live.html|awk '{print $1}')" = 665ba63846b5481ceeb2d7812b29cc3738fa1bb66029aaf2cb3836358511f263
test "$(curl -sS -o /dev/null -w '%{http_code}' https://matchthis.lowcymethodowcy.smallhost.pl/mt73-state.php)" = 401
test "$(curl -sS -o /dev/null -w '%{http_code}' https://matchthis.lowcymethodowcy.smallhost.pl/panel.php)" = 303
echo MT84_PRODUCTION_PUBLIC_LINKS_AND_AUTH_ROUTE_PASS
installed=0
