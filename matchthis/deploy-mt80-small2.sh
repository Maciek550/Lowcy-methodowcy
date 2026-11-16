#!/usr/bin/env bash
# MT80: only logo+icon homepage URL and orange SKLEPMT link in three role pages.
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
stage="$HOME/matchthis-independent/mt-80/previous"
test -f "$stage/index.html" && test -f "$stage/panel.php"
test "$(sha256sum "$stage/index.html"|awk '{print $1}')" = ece29feb50dd671461f984eccb17e9367514d37e802a291b924f4d199947eaa1
current="$(sha256sum "$web/index.html"|awk '{print $1}')"
test "$current" = f0541e9b09a7dc4d8e14d1d9d8d30b2120d06a10ee552b8e06f385c63dd0498c || test "$current" = ece29feb50dd671461f984eccb17e9367514d37e802a291b924f4d199947eaa1
cp -p "$stage/panel.php" "$web/panel.php.mt80-rollback"
mv -f "$web/panel.php.mt80-rollback" "$web/panel.php"
cp -p "$stage/index.html" "$web/index.html.mt80-rollback"
mv -f "$web/index.html.mt80-rollback" "$web/index.html"
echo MT80_ROLLBACK_TO_MT79_SERVER_DATA_UNTOUCHED
RESTORE
  exit
fi
for item in \
  '59efe4f1ffd6000ea7ae634f0002cb21819e0885bf8a5c74da50320dac02d0bf matchthis/MatchThis_MT-80.html' \
  'f0541e9b09a7dc4d8e14d1d9d8d30b2120d06a10ee552b8e06f385c63dd0498c matchthis/MatchThis_MT-80_OGLADACZ.html' \
  'ac2da3f8a0cf1f1f880aa90de96823a14118c4be3d4783933e899bdb537d7664 matchthis/MatchThis_MT-80_SEDZIA.html'; do
  echo "$item" | sha256sum -c -
done
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'PRE'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = ece29feb50dd671461f984eccb17e9367514d37e802a291b924f4d199947eaa1
test "$(tail -n +2 "$web/role-pages/mt79-admin.php"|sha256sum|awk '{print $1}')" = 51baa122e97f39b733408e51076adaf98c052b025471b10559f9a234d627e0d1
test "$(tail -n +2 "$web/role-pages/mt79-sedzia.php"|sha256sum|awk '{print $1}')" = a71e5455a86565c726006bb6c31a89564ad42b28312adbd69d65300bf7d9c25b
grep -Fq 'mt79-admin.php' "$web/panel.php"
grep -Fq 'mt79-sedzia.php' "$web/panel.php"
test ! -e "$web/role-pages/mt80-admin.php"
test ! -e "$web/role-pages/mt80-sedzia.php"
test ! -e "$HOME/matchthis-independent/mt-80/previous"
test ! -L "$web/index.html" && test ! -L "$web/panel.php"
test -f "$web/.mt41-private/state-mt73.json" && test ! -L "$web/.mt41-private/state-mt73.json"
test -f "$web/.mt41-private/mt60-published-draws.json"
test "$(sha256sum "$web/matchthis-orange-mt79-32.png"|awk '{print $1}')" = c1dc3ff23667d074224eb6eb6265c7c9b5cbc40f0329a63fe3b0199f7b2e3f02
mkdir -p "$HOME/matchthis-independent/mt-80"
chmod 700 "$HOME/matchthis-independent/mt-80"
echo MT80_EXACT_MT79_THREE_ROLES_AND_ICON_PRECHECK_PASS
PRE
sshpass -e scp "${opts[@]}" matchthis/MatchThis_MT-80.html matchthis/MatchThis_MT-80_OGLADACZ.html matchthis/MatchThis_MT-80_SEDZIA.html "$remote:matchthis-independent/mt-80/"
installed=0
cleanup(){
  code=$?
  trap - EXIT
  if test "$code" -ne 0 && test "$installed" = 1;then
    echo MT80_AUTO_ROLLBACK_ON_FAILED_RELEASE
    sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'REVERT' || echo MT80_ROLLBACK_ERROR_REQUIRES_REVIEW
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
prior="$HOME/matchthis-independent/mt-80/previous"
test -f "$prior/index.html" && test -f "$prior/panel.php"
test "$(sha256sum "$prior/index.html"|awk '{print $1}')" = ece29feb50dd671461f984eccb17e9367514d37e802a291b924f4d199947eaa1
cp -p "$prior/panel.php" "$web/panel.php.tmp-restore"
mv -f "$web/panel.php.tmp-restore" "$web/panel.php"
cp -p "$prior/index.html" "$web/index.html.tmp-restore"
mv -f "$web/index.html.tmp-restore" "$web/index.html"
echo MT80_ROUTES_RESTORED_MT79_DATA_NEVER_CHANGED
REVERT
  fi
  exit "$code"
}
trap cleanup EXIT
installed=1
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'INSTALL'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-80"
prior="$stage/previous"
sha(){ sha256sum "$1"|awk '{print $1}'; }
test "$(sha "$web/index.html")" = ece29feb50dd671461f984eccb17e9367514d37e802a291b924f4d199947eaa1
test "$(sha "$stage/MatchThis_MT-80.html")" = 59efe4f1ffd6000ea7ae634f0002cb21819e0885bf8a5c74da50320dac02d0bf
test "$(sha "$stage/MatchThis_MT-80_OGLADACZ.html")" = f0541e9b09a7dc4d8e14d1d9d8d30b2120d06a10ee552b8e06f385c63dd0498c
test "$(sha "$stage/MatchThis_MT-80_SEDZIA.html")" = ac2da3f8a0cf1f1f880aa90de96823a14118c4be3d4783933e899bdb537d7664
mkdir -m 700 "$prior"
cp -p "$web/index.html" "$prior/index.html"
cp -p "$web/panel.php" "$prior/panel.php"
cp -p "$web/role-pages/mt79-admin.php" "$prior/mt79-admin.php"
cp -p "$web/role-pages/mt79-sedzia.php" "$prior/mt79-sedzia.php"
cp -p "$web/.mt41-private/state-mt73.json" "$prior/state-mt73.json"
cp -p "$web/.mt41-private/mt60-published-draws.json" "$prior/mt60-published-draws.json"
cmp "$prior/state-mt73.json" "$web/.mt41-private/state-mt73.json"
cmp "$prior/mt60-published-draws.json" "$web/.mt41-private/mt60-published-draws.json"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>'; cat "$stage/MatchThis_MT-80.html"; } > "$stage/mt80-admin.php"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>'; cat "$stage/MatchThis_MT-80_SEDZIA.html"; } > "$stage/mt80-sedzia.php"
php -l "$stage/mt80-admin.php" >/dev/null
php -l "$stage/mt80-sedzia.php" >/dev/null
python3 - "$prior/panel.php" "$stage/panel.php" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text('utf8')
for old,new in [('mt79-admin.php','mt80-admin.php'),('mt79-sedzia.php','mt80-sedzia.php')]:
 assert s.count(old)==1,(old,s.count(old))
 s=s.replace(old,new)
Path(sys.argv[2]).write_text(s,'utf8')
PY
php -l "$stage/panel.php" >/dev/null
for role in admin sedzia;do
 cp -p "$stage/mt80-$role.php" "$web/role-pages/mt80-$role.php.next"
 mv -f "$web/role-pages/mt80-$role.php.next" "$web/role-pages/mt80-$role.php"
done
cp -p "$stage/panel.php" "$web/panel.php.next"
mv -f "$web/panel.php.next" "$web/panel.php"
cp -p "$stage/MatchThis_MT-80_OGLADACZ.html" "$web/index.html.next"
mv -f "$web/index.html.next" "$web/index.html"
test "$(sha "$web/index.html")" = f0541e9b09a7dc4d8e14d1d9d8d30b2120d06a10ee552b8e06f385c63dd0498c
test "$(tail -n +2 "$web/role-pages/mt80-admin.php"|sha256sum|awk '{print $1}')" = 59efe4f1ffd6000ea7ae634f0002cb21819e0885bf8a5c74da50320dac02d0bf
test "$(tail -n +2 "$web/role-pages/mt80-sedzia.php"|sha256sum|awk '{print $1}')" = ac2da3f8a0cf1f1f880aa90de96823a14118c4be3d4783933e899bdb537d7664
cmp "$prior/state-mt73.json" "$web/.mt41-private/state-mt73.json"
cmp "$prior/mt60-published-draws.json" "$web/.mt41-private/mt60-published-draws.json"
echo MT80_THREE_ROLES_INSTALLED_ON_SMALL2_MT79_BACKUP_AND_UNTOUCHED_DATA_PASS
INSTALL
curl -fsSL --max-time 30 https://matchthis.lowcymethodowcy.smallhost.pl/ -o /tmp/mt80-live.html
test "$(sha256sum /tmp/mt80-live.html|awk '{print $1}')" = f0541e9b09a7dc4d8e14d1d9d8d30b2120d06a10ee552b8e06f385c63dd0498c
test "$(curl -sS -o /dev/null -w '%{http_code}' https://matchthis.lowcymethodowcy.smallhost.pl/mt73-state.php)" = 401
test "$(curl -sS -o /dev/null -w '%{http_code}' https://matchthis.lowcymethodowcy.smallhost.pl/panel.php)" = 303
echo MT80_PRODUCTION_PUBLIC_LINKS_AND_AUTH_ROUTE_PASS
installed=0
