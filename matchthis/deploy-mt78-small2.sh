#!/usr/bin/env bash
# MatchThis-only MT77 -> MT78: show true results instead of empty sector cards; guarded SHA and rollback.
set -Eeuo pipefail
test -n "${SSH_PASSWORD:-}" || { echo SMALL2_PASSWORD_NOT_CONFIGURED; exit 2; }
mode="${1:-deploy}"
test "$mode" = deploy || test "$mode" = rollback
sudo apt-get -qq update
sudo apt-get -qq install -y sshpass
mkdir -p "$HOME/.ssh"; chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256 | awk '{print $2}')" = 'SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8'
export SSHPASS="$SSH_PASSWORD"
options=(-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15)
remote=lowcymethodowcy@s3.small.pl
if test "$mode" = rollback;then
 sshpass -e ssh "${options[@]}" "$remote" 'bash -s' <<'ROLLBACK'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
prior="$HOME/matchthis-independent/mt-78/previous"
test -f "$prior/panel.php" && test -f "$prior/index.html"
test "$(sha256sum "$prior/index.html"|awk '{print $1}')" = a74812f3f8dccb855ae59b5ae1731f195e08e346ff029cd4e73bdbd8af2cabab
cp -p "$prior/panel.php" "$web/panel.php.mt78-rollback"
mv -f "$web/panel.php.mt78-rollback" "$web/panel.php"
cp -p "$prior/index.html" "$web/index.html.mt78-rollback"
mv -f "$web/index.html.mt78-rollback" "$web/index.html"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = a74812f3f8dccb855ae59b5ae1731f195e08e346ff029cd4e73bdbd8af2cabab
echo MT78_ROUTES_ROLLED_BACK_MT77_PRIVATE_STATE_INTACT
ROLLBACK
 exit
fi
test "$(sha256sum matchthis/MatchThis_MT-78.html|awk '{print $1}')" = 1218a11dc52da24543420c0fffb5d89c9ab222156c77fc92e55fd99905564e0c
test "$(sha256sum matchthis/MatchThis_MT-78_OGLADACZ.html|awk '{print $1}')" = 3ebed336016c0af5ef51fc86b19bc7e7244ec95940ff68aae95b18742f0a4f45
test "$(sha256sum matchthis/MatchThis_MT-78_SEDZIA.html|awk '{print $1}')" = 53492a431e8aae5c1d6729b96d4111afdc2dfdc7e6671604faf171b98812d951
sshpass -e ssh "${options[@]}" "$remote" 'bash -s' <<'CHECK'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = a74812f3f8dccb855ae59b5ae1731f195e08e346ff029cd4e73bdbd8af2cabab
test "$(tail -n +2 "$web/role-pages/mt77-admin.php"|sha256sum|awk '{print $1}')" = ea61426e32455b591c5c464e7de93118a10e485daa412137095f131d37dcecd3
test "$(tail -n +2 "$web/role-pages/mt77-sedzia.php"|sha256sum|awk '{print $1}')" = 91033a1f6abc2685f1598aedfc0ce8608bc74edc5b44edacf7b353022ea176c1
grep -Fq 'mt77-admin.php' "$web/panel.php"
grep -Fq 'mt77-sedzia.php' "$web/panel.php"
test ! -e "$web/role-pages/mt78-admin.php" && test ! -e "$web/role-pages/mt78-sedzia.php"
test ! -e "$HOME/matchthis-independent/mt-78/previous"
test -f "$web/.mt41-private/state-mt73.json"
test -f "$web/.mt41-private/mt60-published-draws.json"
test ! -L "$web/index.html" && test ! -L "$web/panel.php"
echo MT78_PREDEPLOY_EXACT_MT77_SMALL2_PASS
CHECK
sshpass -e ssh "${options[@]}" "$remote" 'mkdir -p "$HOME/matchthis-independent/mt-78";chmod 700 "$HOME/matchthis-independent/mt-78"'
sshpass -e scp "${options[@]}" matchthis/MatchThis_MT-78.html matchthis/MatchThis_MT-78_SEDZIA.html matchthis/MatchThis_MT-78_OGLADACZ.html "$remote:matchthis-independent/mt-78/"
switched=0
failure(){
 code=$?;trap - EXIT
 if test "$code" -ne 0 && test "$switched" = 1;then
   echo MT78_AUTO_ROUTE_ROLLBACK_TRIGGERED
   sshpass -e ssh "${options[@]}" "$remote" 'bash -s' <<'RESTORE' || echo MT78_AUTO_ROLLBACK_FAILED
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
prior="$HOME/matchthis-independent/mt-78/previous"
test "$(sha256sum "$prior/index.html"|awk '{print $1}')" = a74812f3f8dccb855ae59b5ae1731f195e08e346ff029cd4e73bdbd8af2cabab
cp -p "$prior/panel.php" "$web/panel.php.revert";mv -f "$web/panel.php.revert" "$web/panel.php"
cp -p "$prior/index.html" "$web/index.html.revert";mv -f "$web/index.html.revert" "$web/index.html"
echo MT78_ROUTES_RESTORED_MT77
RESTORE
 fi
 exit "$code"
}
trap failure EXIT
switched=1
sshpass -e ssh "${options[@]}" "$remote" 'bash -s' <<'INSTALL'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-78"
prior="$stage/previous"
hash(){ sha256sum "$1"|awk '{print $1}'; }
test "$(hash "$web/index.html")" = a74812f3f8dccb855ae59b5ae1731f195e08e346ff029cd4e73bdbd8af2cabab
test "$(hash "$stage/MatchThis_MT-78.html")" = 1218a11dc52da24543420c0fffb5d89c9ab222156c77fc92e55fd99905564e0c
test "$(hash "$stage/MatchThis_MT-78_OGLADACZ.html")" = 3ebed336016c0af5ef51fc86b19bc7e7244ec95940ff68aae95b18742f0a4f45
test "$(hash "$stage/MatchThis_MT-78_SEDZIA.html")" = 53492a431e8aae5c1d6729b96d4111afdc2dfdc7e6671604faf171b98812d951
mkdir -m 700 "$prior"
cp -p "$web/index.html" "$prior/index.html"
cp -p "$web/panel.php" "$prior/panel.php"
cp -p "$web/role-pages/mt77-admin.php" "$prior/mt77-admin.php"
cp -p "$web/role-pages/mt77-sedzia.php" "$prior/mt77-sedzia.php"
cp -p "$web/.mt41-private/state-mt73.json" "$prior/state-mt73.json"
cp -p "$web/.mt41-private/mt60-published-draws.json" "$prior/mt60-published-draws.json"
cmp -s "$prior/state-mt73.json" "$web/.mt41-private/state-mt73.json"
cmp -s "$prior/mt60-published-draws.json" "$web/.mt41-private/mt60-published-draws.json"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$stage/MatchThis_MT-78.html"; } > "$stage/mt78-admin.php"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$stage/MatchThis_MT-78_SEDZIA.html"; } > "$stage/mt78-sedzia.php"
php -l "$stage/mt78-admin.php" >/dev/null
php -l "$stage/mt78-sedzia.php" >/dev/null
python3 - "$prior/panel.php" "$stage/panel.php" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text('utf8')
for x,y in [('mt77-admin.php','mt78-admin.php'),('mt77-sedzia.php','mt78-sedzia.php')]:
 assert s.count(x)==1,(x,s.count(x))
 s=s.replace(x,y)
Path(sys.argv[2]).write_text(s,'utf8')
PY
php -l "$stage/panel.php" >/dev/null
cp -p "$stage/mt78-admin.php" "$web/role-pages/mt78-admin.php.next"
cp -p "$stage/mt78-sedzia.php" "$web/role-pages/mt78-sedzia.php.next"
mv -f "$web/role-pages/mt78-admin.php.next" "$web/role-pages/mt78-admin.php"
mv -f "$web/role-pages/mt78-sedzia.php.next" "$web/role-pages/mt78-sedzia.php"
cp -p "$stage/panel.php" "$web/panel.php.next"
mv -f "$web/panel.php.next" "$web/panel.php"
cp -p "$stage/MatchThis_MT-78_OGLADACZ.html" "$web/index.html.next"
mv -f "$web/index.html.next" "$web/index.html"
test "$(hash "$web/index.html")" = 3ebed336016c0af5ef51fc86b19bc7e7244ec95940ff68aae95b18742f0a4f45
test "$(tail -n +2 "$web/role-pages/mt78-admin.php"|sha256sum|awk '{print $1}')" = 1218a11dc52da24543420c0fffb5d89c9ab222156c77fc92e55fd99905564e0c
test "$(tail -n +2 "$web/role-pages/mt78-sedzia.php"|sha256sum|awk '{print $1}')" = 53492a431e8aae5c1d6729b96d4111afdc2dfdc7e6671604faf171b98812d951
cmp -s "$prior/state-mt73.json" "$web/.mt41-private/state-mt73.json"
cmp -s "$prior/mt60-published-draws.json" "$web/.mt41-private/mt60-published-draws.json"
echo MT78_PRODUCTION_THREE_ROLES_INSTALLED_MT77_BACKED_UP_DATA_UNCHANGED
INSTALL
curl -fsSL --max-time 30 https://matchthis.lowcymethodowcy.smallhost.pl/ -o /tmp/mt78-published.html
test "$(sha256sum /tmp/mt78-published.html|awk '{print $1}')" = 3ebed336016c0af5ef51fc86b19bc7e7244ec95940ff68aae95b18742f0a4f45
test "$(curl -sS -o /dev/null -w '%{http_code}' https://matchthis.lowcymethodowcy.smallhost.pl/mt73-state.php)" = 401
test "$(curl -sS -o /dev/null -w '%{http_code}' https://matchthis.lowcymethodowcy.smallhost.pl/panel.php)" = 303
echo MT78_PUBLIC_ROUTING_AUTH_AND_SOURCE_HASH_PASS
switched=0
