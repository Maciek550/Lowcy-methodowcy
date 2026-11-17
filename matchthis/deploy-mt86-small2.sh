#!/usr/bin/env bash
set -Eeuo pipefail
mode="${1:-deploy}"
test "$mode" = deploy || test "$mode" = rollback
test -n "${SSH_PASSWORD:-}" || { echo MISSING_SMALL2_SECRET;exit 2; }
sudo apt-get -qq update
sudo apt-get -qq install -y sshpass
mkdir -p "$HOME/.ssh";chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256|awk '{print $2}')" = 'SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8'
export SSHPASS="$SSH_PASSWORD"
opts=(-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15)
remote=lowcymethodowcy@s3.small.pl
site=https://matchthis.lowcymethodowcy.smallhost.pl
old=7b7fcf03f536250d3677db5fff2cdbcb866a8eadd6d5ae7373ddd661d722da9f
new=f4b78addbd62b6ac60c814a27e9d4e6673fc65d0b9a1aba2afd15d6b0dd8b050
if test "$mode" = rollback;then
 sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'ROLL'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-86-player-r1"
prior="$stage/previous"
test -f "$prior/index.html" && test -f "$prior/panel.php"
test "$(sha256sum "$prior/index.html"|awk '{print $1}')" = 7b7fcf03f536250d3677db5fff2cdbcb866a8eadd6d5ae7373ddd661d722da9f
for f in index.html panel.php;do cp -p "$prior/$f" "$web/$f.mt86-restore";mv -f "$web/$f.mt86-restore" "$web/$f";done
for f in player-login.php player-session.php player-logout.php player-password.php player-recovery.php player-accounts.php;do
 if test -f "$web/$f";then mv -f "$web/$f" "$stage/$f.deactivated";fi
done
echo MT86_ROLLBACK_MT85_RESTORED_PRIVATE_PLAYER_RECORDS_PRESERVED
ROLL
 exit 0
fi
for pair in \
 '31df19ab51bd687d4212bbdfdb264671241ff0481c8d4e71bc912e2887892e31 matchthis/MatchThis_MT-86.html' \
 'f4b78addbd62b6ac60c814a27e9d4e6673fc65d0b9a1aba2afd15d6b0dd8b050 matchthis/MatchThis_MT-86_OGLADACZ.html' \
 '8305b3c467f3ca240e2b20af2014ebdd780e176717031f0b66b6aa4ca8958848 matchthis/MatchThis_MT-86_SEDZIA.html';do echo "$pair"|sha256sum -c -;done
for f in matchthis/server/mt86-player-*.php;do php -l "$f" >/dev/null;done
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'PRE'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-86-player-r1"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = 7b7fcf03f536250d3677db5fff2cdbcb866a8eadd6d5ae7373ddd661d722da9f
test "$(tail -n +2 "$web/role-pages/mt85-admin.php"|sha256sum|awk '{print $1}')" = 0dff776b91424c9a82a07aec477781b382ea66ed0a1186ac85c3fc82cd47c5ae
test "$(tail -n +2 "$web/role-pages/mt85-sedzia.php"|sha256sum|awk '{print $1}')" = b28d43c81505b8b3039ede692c3c29c1903ea8e3b4f01265990f822ab7578f4b
grep -Fq 'mt85-admin.php' "$web/panel.php"
grep -Fq 'mt85-sedzia.php' "$web/panel.php"
test ! -e "$stage"
test -f "$web/.mt41-private/state-mt73.json" && test ! -L "$web/.mt41-private/state-mt73.json"
test -f "$web/.mt41-private/users.php" && test ! -L "$web/.mt41-private/users.php"
test -f "$web/.mt41-private/mt60-published-draws.json"
test ! -e "$web/.mt41-private/mt86-player-lib.php"
for f in player-login.php player-session.php player-logout.php player-password.php player-recovery.php player-accounts.php;do test ! -e "$web/$f";done
mkdir -m 700 "$stage"
echo MT86_PRECHECK_ORIGINAL_85_UNCHANGED_PASS
PRE
sshpass -e scp "${opts[@]}" matchthis/MatchThis_MT-86*.html matchthis/server/mt86-player-*.php "$remote:matchthis-independent/mt-86-player-r1/"
deployed=0
finish(){
 code=$?;trap - EXIT
 if test "$code" -ne 0 && test "$deployed" -eq 1;then echo MT86_AUTO_ROLLBACK;bash "$0" rollback || echo MT86_MANUAL_ROLLBACK_REQUIRED;fi
 exit "$code"
}
trap finish EXIT
deployed=1
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'INSTALL'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-86-player-r1"
prior="$stage/previous"
sha(){ sha256sum "$1"|awk '{print $1}'; }
test "$(sha "$web/index.html")" = 7b7fcf03f536250d3677db5fff2cdbcb866a8eadd6d5ae7373ddd661d722da9f
test "$(sha "$stage/MatchThis_MT-86.html")" = 31df19ab51bd687d4212bbdfdb264671241ff0481c8d4e71bc912e2887892e31
test "$(sha "$stage/MatchThis_MT-86_OGLADACZ.html")" = f4b78addbd62b6ac60c814a27e9d4e6673fc65d0b9a1aba2afd15d6b0dd8b050
test "$(sha "$stage/MatchThis_MT-86_SEDZIA.html")" = 8305b3c467f3ca240e2b20af2014ebdd780e176717031f0b66b6aa4ca8958848
mkdir -m 700 "$prior"
for f in index.html panel.php;do cp -p "$web/$f" "$prior/$f";done
for f in mt85-admin.php mt85-sedzia.php;do cp -p "$web/role-pages/$f" "$prior/$f";done
for f in state-mt73.json users.php mt60-published-draws.json;do cp -p "$web/.mt41-private/$f" "$prior/$f";done
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$stage/MatchThis_MT-86.html"; } > "$stage/mt86-admin.php"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$stage/MatchThis_MT-86_SEDZIA.html"; } > "$stage/mt86-sedzia.php"
python3 - "$prior/panel.php" "$stage/panel.php" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text('utf8')
for a,b in [('mt85-admin.php','mt86-admin.php'),('mt85-sedzia.php','mt86-sedzia.php')]:
 assert s.count(a)==1,(a,s.count(a));s=s.replace(a,b)
Path(sys.argv[2]).write_text(s,'utf8')
PY
for f in "$stage"/mt86-*.php "$stage"/panel.php;do php -l "$f" >/dev/null;done
for role in admin sedzia;do
 cp -p "$stage/mt86-$role.php" "$web/role-pages/mt86-$role.php.next"
 mv -f "$web/role-pages/mt86-$role.php.next" "$web/role-pages/mt86-$role.php"
done
cp -p "$stage/mt86-player-lib.php" "$web/.mt41-private/mt86-player-lib.php.next"
chmod 600 "$web/.mt41-private/mt86-player-lib.php.next"
mv -f "$web/.mt41-private/mt86-player-lib.php.next" "$web/.mt41-private/mt86-player-lib.php"
for route in login session logout password recovery accounts;do
 cp -p "$stage/mt86-player-$route.php" "$web/player-$route.php.next"
 mv -f "$web/player-$route.php.next" "$web/player-$route.php"
done
cp -p "$stage/panel.php" "$web/panel.php.next";mv -f "$web/panel.php.next" "$web/panel.php"
cp -p "$stage/MatchThis_MT-86_OGLADACZ.html" "$web/index.html.next";mv -f "$web/index.html.next" "$web/index.html"
test "$(sha "$web/index.html")" = f4b78addbd62b6ac60c814a27e9d4e6673fc65d0b9a1aba2afd15d6b0dd8b050
test "$(tail -n +2 "$web/role-pages/mt86-admin.php"|sha256sum|awk '{print $1}')" = 31df19ab51bd687d4212bbdfdb264671241ff0481c8d4e71bc912e2887892e31
test "$(tail -n +2 "$web/role-pages/mt86-sedzia.php"|sha256sum|awk '{print $1}')" = 8305b3c467f3ca240e2b20af2014ebdd780e176717031f0b66b6aa4ca8958848
for f in state-mt73.json users.php mt60-published-draws.json;do cmp "$prior/$f" "$web/.mt41-private/$f";done
test ! -e "$web/.mt41-private/mt86-player-accounts.json"
echo MT86_SERVER_INSTALLED_MT85_BACKUP_CENTRAL_DATA_UNTOUCHED_PASS
INSTALL
curl -fsSL --max-time 30 "$site/" -o /tmp/mt86-live.html
test "$(sha256sum /tmp/mt86-live.html|awk '{print $1}')" = "$new"
test "$(curl -sS -o /dev/null -w '%{http_code}' "$site/panel.php")" = 303
test "$(curl -sS -o /dev/null -w '%{http_code}' "$site/player-session.php")" = 200
test "$(curl -sS -o /dev/null -w '%{http_code}' "$site/player-accounts.php")" = 403
echo MT86_PUBLIC_AND_AUTH_GUARD_HTTP_PASS
deployed=0
