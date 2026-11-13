#!/usr/bin/env bash
# MatchThis-only MT75 -> MT76 display patch, exact hash pinned and rollback safe.
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
prior="$HOME/matchthis-independent/mt-76/previous"
test -f "$prior/panel.php" && test -f "$prior/index.html"
test "$(sha256sum "$prior/index.html"|awk '{print $1}')" = db6b74cb6bbe139efac93197842ae3da97131b7af486b586e88408e39455875a
cp -p "$prior/panel.php" "$web/panel.php.mt76-rollback"
mv -f "$web/panel.php.mt76-rollback" "$web/panel.php"
cp -p "$prior/index.html" "$web/index.html.mt76-rollback"
mv -f "$web/index.html.mt76-rollback" "$web/index.html"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = db6b74cb6bbe139efac93197842ae3da97131b7af486b586e88408e39455875a
echo MT76_ROUTES_ROLLED_BACK_MT75_PRIVATE_STATE_INTACT
ROLLBACK
 exit
fi
test "$(sha256sum matchthis/MatchThis_MT-76.html|awk '{print $1}')" = 7c48d3b7bd8400dc432e563697f77fbc7ea6ee5c724fc6191c35bd9003843522
test "$(sha256sum matchthis/MatchThis_MT-76_OGLADACZ.html|awk '{print $1}')" = 2ac2deb60ef64860b141d8048442b02dc8a1e0584efe384ef161f160eb642b28
test "$(sha256sum matchthis/MatchThis_MT-76_SEDZIA.html|awk '{print $1}')" = e7cba2388d827f2698e5848dfb9ee1a7a91bc405dbeac86dcb69e8a15d6dab31
sshpass -e ssh "${options[@]}" "$remote" 'bash -s' <<'CHECK'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = db6b74cb6bbe139efac93197842ae3da97131b7af486b586e88408e39455875a
test "$(tail -n +2 "$web/role-pages/mt75-admin.php"|sha256sum|awk '{print $1}')" = bffd09ff07c8771ff3a359f180d0b4fe930295bc3a10f079b5ecbf27a711fac0
test "$(tail -n +2 "$web/role-pages/mt75-sedzia.php"|sha256sum|awk '{print $1}')" = d7c9e4ef9737f9651fe1c7697aa9eed69647235b19a81e6252b1756a42cf5147
grep -Fq 'mt75-admin.php' "$web/panel.php"
grep -Fq 'mt75-sedzia.php' "$web/panel.php"
test ! -e "$web/role-pages/mt76-admin.php" && test ! -e "$web/role-pages/mt76-sedzia.php"
test ! -e "$HOME/matchthis-independent/mt-76/previous"
test -f "$web/.mt41-private/state-mt73.json"
test -f "$web/.mt41-private/mt60-published-draws.json"
test ! -L "$web/index.html" && test ! -L "$web/panel.php"
echo MT76_PREDEPLOY_EXACT_MT75_SMALL2_PASS
CHECK
sshpass -e ssh "${options[@]}" "$remote" 'mkdir -p "$HOME/matchthis-independent/mt-76";chmod 700 "$HOME/matchthis-independent/mt-76"'
sshpass -e scp "${options[@]}" matchthis/MatchThis_MT-76.html matchthis/MatchThis_MT-76_SEDZIA.html matchthis/MatchThis_MT-76_OGLADACZ.html "$remote:matchthis-independent/mt-76/"
switched=0
failure(){
 code=$?;trap - EXIT
 if test "$code" -ne 0 && test "$switched" = 1;then
   echo MT76_AUTO_ROUTE_ROLLBACK_TRIGGERED
   sshpass -e ssh "${options[@]}" "$remote" 'bash -s' <<'RESTORE' || echo MT76_AUTO_ROLLBACK_FAILED
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
prior="$HOME/matchthis-independent/mt-76/previous"
test "$(sha256sum "$prior/index.html"|awk '{print $1}')" = db6b74cb6bbe139efac93197842ae3da97131b7af486b586e88408e39455875a
cp -p "$prior/panel.php" "$web/panel.php.revert";mv -f "$web/panel.php.revert" "$web/panel.php"
cp -p "$prior/index.html" "$web/index.html.revert";mv -f "$web/index.html.revert" "$web/index.html"
echo MT76_ROUTES_RESTORED_MT75
RESTORE
 fi
 exit "$code"
}
trap failure EXIT
switched=1
sshpass -e ssh "${options[@]}" "$remote" 'bash -s' <<'INSTALL'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-76"
prior="$stage/previous"
hash(){ sha256sum "$1"|awk '{print $1}'; }
test "$(hash "$web/index.html")" = db6b74cb6bbe139efac93197842ae3da97131b7af486b586e88408e39455875a
test "$(hash "$stage/MatchThis_MT-76.html")" = 7c48d3b7bd8400dc432e563697f77fbc7ea6ee5c724fc6191c35bd9003843522
test "$(hash "$stage/MatchThis_MT-76_OGLADACZ.html")" = 2ac2deb60ef64860b141d8048442b02dc8a1e0584efe384ef161f160eb642b28
test "$(hash "$stage/MatchThis_MT-76_SEDZIA.html")" = e7cba2388d827f2698e5848dfb9ee1a7a91bc405dbeac86dcb69e8a15d6dab31
mkdir -m 700 "$prior"
cp -p "$web/index.html" "$prior/index.html"
cp -p "$web/panel.php" "$prior/panel.php"
cp -p "$web/role-pages/mt75-admin.php" "$prior/mt75-admin.php"
cp -p "$web/role-pages/mt75-sedzia.php" "$prior/mt75-sedzia.php"
cp -p "$web/.mt41-private/state-mt73.json" "$prior/state-mt73.json"
cp -p "$web/.mt41-private/mt60-published-draws.json" "$prior/mt60-published-draws.json"
cmp -s "$prior/state-mt73.json" "$web/.mt41-private/state-mt73.json"
cmp -s "$prior/mt60-published-draws.json" "$web/.mt41-private/mt60-published-draws.json"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$stage/MatchThis_MT-76.html"; } > "$stage/mt76-admin.php"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$stage/MatchThis_MT-76_SEDZIA.html"; } > "$stage/mt76-sedzia.php"
php -l "$stage/mt76-admin.php" >/dev/null
php -l "$stage/mt76-sedzia.php" >/dev/null
python3 - "$prior/panel.php" "$stage/panel.php" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text('utf8')
for x,y in [('mt75-admin.php','mt76-admin.php'),('mt75-sedzia.php','mt76-sedzia.php')]:
 assert s.count(x)==1,(x,s.count(x))
 s=s.replace(x,y)
Path(sys.argv[2]).write_text(s,'utf8')
PY
php -l "$stage/panel.php" >/dev/null
cp -p "$stage/mt76-admin.php" "$web/role-pages/mt76-admin.php.next"
cp -p "$stage/mt76-sedzia.php" "$web/role-pages/mt76-sedzia.php.next"
mv -f "$web/role-pages/mt76-admin.php.next" "$web/role-pages/mt76-admin.php"
mv -f "$web/role-pages/mt76-sedzia.php.next" "$web/role-pages/mt76-sedzia.php"
cp -p "$stage/panel.php" "$web/panel.php.next"
mv -f "$web/panel.php.next" "$web/panel.php"
cp -p "$stage/MatchThis_MT-76_OGLADACZ.html" "$web/index.html.next"
mv -f "$web/index.html.next" "$web/index.html"
test "$(hash "$web/index.html")" = 2ac2deb60ef64860b141d8048442b02dc8a1e0584efe384ef161f160eb642b28
test "$(tail -n +2 "$web/role-pages/mt76-admin.php"|sha256sum|awk '{print $1}')" = 7c48d3b7bd8400dc432e563697f77fbc7ea6ee5c724fc6191c35bd9003843522
test "$(tail -n +2 "$web/role-pages/mt76-sedzia.php"|sha256sum|awk '{print $1}')" = e7cba2388d827f2698e5848dfb9ee1a7a91bc405dbeac86dcb69e8a15d6dab31
cmp -s "$prior/state-mt73.json" "$web/.mt41-private/state-mt73.json"
cmp -s "$prior/mt60-published-draws.json" "$web/.mt41-private/mt60-published-draws.json"
echo MT76_PRODUCTION_THREE_ROLES_INSTALLED_MT75_BACKED_UP_DATA_UNCHANGED
INSTALL
curl -fsSL --max-time 30 https://matchthis.lowcymethodowcy.smallhost.pl/ -o /tmp/mt76-published.html
test "$(sha256sum /tmp/mt76-published.html|awk '{print $1}')" = 2ac2deb60ef64860b141d8048442b02dc8a1e0584efe384ef161f160eb642b28
test "$(curl -sS -o /dev/null -w '%{http_code}' https://matchthis.lowcymethodowcy.smallhost.pl/mt73-state.php)" = 401
test "$(curl -sS -o /dev/null -w '%{http_code}' https://matchthis.lowcymethodowcy.smallhost.pl/panel.php)" = 303
echo MT76_PUBLIC_ROUTING_AUTH_AND_SOURCE_HASH_PASS
switched=0
