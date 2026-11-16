#!/usr/bin/env bash
# MatchThis MT78 -> MT79: explicit orange PNG bookmark icons; no application data/logic changes.
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
prior="$HOME/matchthis-independent/mt-79-r2/previous"
test -f "$prior/panel.php" && test -f "$prior/index.html"
test "$(sha256sum "$prior/index.html"|awk '{print $1}')" = 3ebed336016c0af5ef51fc86b19bc7e7244ec95940ff68aae95b18742f0a4f45
cp -p "$prior/panel.php" "$web/panel.php.mt79-rollback"
mv -f "$web/panel.php.mt79-rollback" "$web/panel.php"
cp -p "$prior/index.html" "$web/index.html.mt79-rollback"
mv -f "$web/index.html.mt79-rollback" "$web/index.html"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = 3ebed336016c0af5ef51fc86b19bc7e7244ec95940ff68aae95b18742f0a4f45
echo MT79_ROUTES_ROLLED_BACK_MT78_PRIVATE_STATE_INTACT
ROLLBACK
 exit
fi
test "$(sha256sum matchthis/MatchThis_MT-79.html|awk '{print $1}')" = 51baa122e97f39b733408e51076adaf98c052b025471b10559f9a234d627e0d1
test "$(sha256sum matchthis/MatchThis_MT-79_OGLADACZ.html|awk '{print $1}')" = ece29feb50dd671461f984eccb17e9367514d37e802a291b924f4d199947eaa1
test "$(sha256sum matchthis/MatchThis_MT-79_SEDZIA.html|awk '{print $1}')" = a71e5455a86565c726006bb6c31a89564ad42b28312adbd69d65300bf7d9c25b
sshpass -e ssh "${options[@]}" "$remote" 'bash -s' <<'CHECK'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = 3ebed336016c0af5ef51fc86b19bc7e7244ec95940ff68aae95b18742f0a4f45
test "$(tail -n +2 "$web/role-pages/mt78-admin.php"|sha256sum|awk '{print $1}')" = 1218a11dc52da24543420c0fffb5d89c9ab222156c77fc92e55fd99905564e0c
test "$(tail -n +2 "$web/role-pages/mt78-sedzia.php"|sha256sum|awk '{print $1}')" = 53492a431e8aae5c1d6729b96d4111afdc2dfdc7e6671604faf171b98812d951
grep -Fq 'mt78-admin.php' "$web/panel.php"
grep -Fq 'mt78-sedzia.php' "$web/panel.php"
test ! -e "$web/role-pages/mt79-admin.php" && test ! -e "$web/role-pages/mt79-sedzia.php"
test ! -e "$HOME/matchthis-independent/mt-79-r2/previous"
test ! -e "$web/matchthis-orange-mt79-32.png" && test ! -e "$web/matchthis-orange-mt79-64.png"
test "$(sha256sum "$web/favicon.ico" | awk '{print $1}')" = 162ac423fdd594d3db0213b05cde40203d2053b44c135b18ea29880c36b60d5c
test -f "$web/.mt41-private/state-mt73.json"
test -f "$web/.mt41-private/mt60-published-draws.json"
test ! -L "$web/index.html" && test ! -L "$web/panel.php"
echo MT79_PREDEPLOY_EXACT_MT78_SMALL2_PASS
CHECK
sshpass -e ssh "${options[@]}" "$remote" 'mkdir -p "$HOME/matchthis-independent/mt-79-r2";chmod 700 "$HOME/matchthis-independent/mt-79-r2"'
sshpass -e scp "${options[@]}" matchthis/MatchThis_MT-79.html matchthis/MatchThis_MT-79_SEDZIA.html matchthis/MatchThis_MT-79_OGLADACZ.html matchthis/assets/matchthis-orange-mt79-32.png matchthis/assets/matchthis-orange-mt79-64.png "$remote:matchthis-independent/mt-79-r2/"
switched=0
failure(){
 code=$?;trap - EXIT
 if test "$code" -ne 0 && test "$switched" = 1;then
   echo MT79_AUTO_ROUTE_ROLLBACK_TRIGGERED
   sshpass -e ssh "${options[@]}" "$remote" 'bash -s' <<'RESTORE' || echo MT79_AUTO_ROLLBACK_FAILED
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
prior="$HOME/matchthis-independent/mt-79-r2/previous"
test "$(sha256sum "$prior/index.html"|awk '{print $1}')" = 3ebed336016c0af5ef51fc86b19bc7e7244ec95940ff68aae95b18742f0a4f45
cp -p "$prior/panel.php" "$web/panel.php.revert";mv -f "$web/panel.php.revert" "$web/panel.php"
cp -p "$prior/index.html" "$web/index.html.revert";mv -f "$web/index.html.revert" "$web/index.html"
echo MT79_ROUTES_RESTORED_MT78
RESTORE
 fi
 exit "$code"
}
trap failure EXIT
switched=1
sshpass -e ssh "${options[@]}" "$remote" 'bash -s' <<'INSTALL'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-79-r2"
prior="$stage/previous"
hash(){ sha256sum "$1"|awk '{print $1}'; }
test "$(hash "$web/index.html")" = 3ebed336016c0af5ef51fc86b19bc7e7244ec95940ff68aae95b18742f0a4f45
test "$(hash "$stage/MatchThis_MT-79.html")" = 51baa122e97f39b733408e51076adaf98c052b025471b10559f9a234d627e0d1
test "$(hash "$stage/MatchThis_MT-79_OGLADACZ.html")" = ece29feb50dd671461f984eccb17e9367514d37e802a291b924f4d199947eaa1
test "$(hash "$stage/MatchThis_MT-79_SEDZIA.html")" = a71e5455a86565c726006bb6c31a89564ad42b28312adbd69d65300bf7d9c25b
test "$(sha256sum "$stage/matchthis-orange-mt79-32.png" | awk '{print $1}')" = c1dc3ff23667d074224eb6eb6265c7c9b5cbc40f0329a63fe3b0199f7b2e3f02
test "$(sha256sum "$stage/matchthis-orange-mt79-64.png" | awk '{print $1}')" = 1e83413b4db09f971a2f5f5e13cb268ba548a63259eb50f313ca1ece1652c6ce
test ! -e "$web/matchthis-orange-mt79-32.png"
test ! -e "$web/matchthis-orange-mt79-64.png"
mkdir -m 700 "$prior"
cp -p "$web/index.html" "$prior/index.html"
cp -p "$web/panel.php" "$prior/panel.php"
cp -p "$web/role-pages/mt78-admin.php" "$prior/mt78-admin.php"
cp -p "$web/role-pages/mt78-sedzia.php" "$prior/mt78-sedzia.php"
cp -p "$web/.mt41-private/state-mt73.json" "$prior/state-mt73.json"
cp -p "$web/.mt41-private/mt60-published-draws.json" "$prior/mt60-published-draws.json"
cmp -s "$prior/state-mt73.json" "$web/.mt41-private/state-mt73.json"
cmp -s "$prior/mt60-published-draws.json" "$web/.mt41-private/mt60-published-draws.json"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$stage/MatchThis_MT-79.html"; } > "$stage/mt79-admin.php"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$stage/MatchThis_MT-79_SEDZIA.html"; } > "$stage/mt79-sedzia.php"
php -l "$stage/mt79-admin.php" >/dev/null
php -l "$stage/mt79-sedzia.php" >/dev/null
python3 - "$prior/panel.php" "$stage/panel.php" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text('utf8')
for x,y in [('mt78-admin.php','mt79-admin.php'),('mt78-sedzia.php','mt79-sedzia.php')]:
 assert s.count(x)==1,(x,s.count(x))
 s=s.replace(x,y)
Path(sys.argv[2]).write_text(s,'utf8')
PY
php -l "$stage/panel.php" >/dev/null
cp -p "$stage/mt79-admin.php" "$web/role-pages/mt79-admin.php.next"
cp -p "$stage/mt79-sedzia.php" "$web/role-pages/mt79-sedzia.php.next"
mv -f "$web/role-pages/mt79-admin.php.next" "$web/role-pages/mt79-admin.php"
mv -f "$web/role-pages/mt79-sedzia.php.next" "$web/role-pages/mt79-sedzia.php"
for size in 32 64; do
 cp -p "$stage/matchthis-orange-mt79-$size.png" "$web/matchthis-orange-mt79-$size.png.next"
 chmod 644 "$web/matchthis-orange-mt79-$size.png.next"
 mv -f "$web/matchthis-orange-mt79-$size.png.next" "$web/matchthis-orange-mt79-$size.png"
done
cp -p "$stage/panel.php" "$web/panel.php.next"
mv -f "$web/panel.php.next" "$web/panel.php"
cp -p "$stage/MatchThis_MT-79_OGLADACZ.html" "$web/index.html.next"
mv -f "$web/index.html.next" "$web/index.html"
test "$(sha256sum "$web/matchthis-orange-mt79-32.png" | awk '{print $1}')" = c1dc3ff23667d074224eb6eb6265c7c9b5cbc40f0329a63fe3b0199f7b2e3f02
test "$(sha256sum "$web/matchthis-orange-mt79-64.png" | awk '{print $1}')" = 1e83413b4db09f971a2f5f5e13cb268ba548a63259eb50f313ca1ece1652c6ce
test "$(hash "$web/index.html")" = ece29feb50dd671461f984eccb17e9367514d37e802a291b924f4d199947eaa1
test "$(tail -n +2 "$web/role-pages/mt79-admin.php"|sha256sum|awk '{print $1}')" = 51baa122e97f39b733408e51076adaf98c052b025471b10559f9a234d627e0d1
test "$(tail -n +2 "$web/role-pages/mt79-sedzia.php"|sha256sum|awk '{print $1}')" = a71e5455a86565c726006bb6c31a89564ad42b28312adbd69d65300bf7d9c25b
cmp -s "$prior/state-mt73.json" "$web/.mt41-private/state-mt73.json"
cmp -s "$prior/mt60-published-draws.json" "$web/.mt41-private/mt60-published-draws.json"
echo MT79_PRODUCTION_THREE_ROLES_INSTALLED_MT78_BACKED_UP_DATA_UNCHANGED
INSTALL
curl -fsSL --max-time 30 https://matchthis.lowcymethodowcy.smallhost.pl/ -o /tmp/mt79-published.html
test "$(sha256sum /tmp/mt79-published.html|awk '{print $1}')" = ece29feb50dd671461f984eccb17e9367514d37e802a291b924f4d199947eaa1
test "$(curl -sS -o /dev/null -w '%{http_code}' https://matchthis.lowcymethodowcy.smallhost.pl/mt73-state.php)" = 401
test "$(curl -sS -o /dev/null -w '%{http_code}' https://matchthis.lowcymethodowcy.smallhost.pl/panel.php)" = 303
echo MT79_PUBLIC_ROUTING_AUTH_AND_SOURCE_HASH_PASS
switched=0
