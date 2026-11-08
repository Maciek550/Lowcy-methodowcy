#!/usr/bin/env bash
set -euo pipefail
test -n "${SSH_PASSWORD:-}" || { echo MISSING_SMALL2_SSH_PASSWORD; exit 2; }
for suffix in '' _OGLADACZ _SEDZIA; do
  f="matchthis/MatchThis_MT-42${suffix}.html"
  test -f "$f"
  grep -Fq '<title>MatchThis MT-42</title>' "$f"
  grep -Fq 'aria-label="Wersja MT-42">MT-42' "$f"
  grep -Fq 'data-version="MT-42"' "$f"
  grep -Fq "const APP_VERSION='MT-42'" "$f"
done
test -f matchthis/mt41-panel.php
test -f matchthis/mt41-change-password.php
old="$(sha256sum matchthis/MatchThis_MT-41_OGLADACZ.html | awk '{print $1}')"
expected='aaa1dedd27efee8a8fbe440378c98691b6881dc130e5c22c33957cfa83bdbbcf'
test "$old" = "$expected" || { echo MT41_SOURCE_SHA_UNEXPECTED; exit 4; }
new="$(sha256sum matchthis/MatchThis_MT-42_OGLADACZ.html | awk '{print $1}')"
admin="$(sha256sum matchthis/MatchThis_MT-42.html | awk '{print $1}')"
judge="$(sha256sum matchthis/MatchThis_MT-42_SEDZIA.html | awk '{print $1}')"
# Preserve MT41 server authentication and access control: only change the protected
# role template file targets, and the displayed version on the password page.
sed 's/mt41-admin.php/mt42-admin.php/g;s/mt41-sedzia.php/mt42-sedzia.php/g' matchthis/mt41-panel.php > /tmp/mt42-panel.php
sed 's/MT-41/MT-42/g' matchthis/mt41-change-password.php > /tmp/mt42-change-password.php
php -l /tmp/mt42-panel.php
php -l /tmp/mt42-change-password.php
grep -Fq "mt42-admin.php" /tmp/mt42-panel.php
grep -Fq "mt42-sedzia.php" /tmp/mt42-panel.php
grep -Fq 'MatchThis MT-42' /tmp/mt42-change-password.php
sudo apt-get -qq update && sudo apt-get -qq install -y sshpass
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256 | awk '{print $2}')" = 'SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8'
export SSHPASS="$SSH_PASSWORD"
remote=lowcymethodowcy@s3.small.pl
opts=(-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15)
sshpass -e ssh "${opts[@]}" "$remote" "OLD_SHA='$old' bash -s" <<'REMOTE'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-42"
test -f "$HOME/matchthis-independent/MT41-OWNED"
test -d "$web/role-pages" && test ! -L "$web/role-pages"
test -f "$web/index.html" && test ! -L "$web/index.html"
test -f "$web/panel.php" && test ! -L "$web/panel.php"
test -f "$web/change-password.php" && test ! -L "$web/change-password.php"
test -f "$web/login.php" && test ! -L "$web/login.php"
test -f "$web/role-pages/mt41-admin.php" && test -f "$web/role-pages/mt41-sedzia.php"
test ! -e "$web/role-pages/mt42-admin.php" && test ! -e "$web/role-pages/mt42-sedzia.php"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = "$OLD_SHA" || { echo MT41_LIVE_BASELINE_CHANGED_ABORT;exit 7; }
devil www list | grep -F 'matchthis.lowcymethodowcy.smallhost.pl'
mkdir -p "$stage"
echo MT42_PREFLIGHT_AND_SOURCE_OK
REMOTE
sshpass -e scp "${opts[@]}"   matchthis/MatchThis_MT-42.html matchthis/MatchThis_MT-42_SEDZIA.html matchthis/MatchThis_MT-42_OGLADACZ.html   "$remote:matchthis-independent/mt-42/"
sshpass -e scp "${opts[@]}" /tmp/mt42-panel.php /tmp/mt42-change-password.php "$remote:matchthis-independent/mt-42/"
sshpass -e ssh "${opts[@]}" "$remote" "OLD_SHA='$old' NEW_SHA='$new' ADMIN_SHA='$admin' JUDGE_SHA='$judge' bash -s" <<'REMOTE'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-42"
test -f "$HOME/matchthis-independent/MT41-OWNED"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = "$OLD_SHA"
test "$(sha256sum "$stage/MatchThis_MT-42_OGLADACZ.html" | awk '{print $1}')" = "$NEW_SHA"
test "$(sha256sum "$stage/MatchThis_MT-42.html" | awk '{print $1}')" = "$ADMIN_SHA"
test "$(sha256sum "$stage/MatchThis_MT-42_SEDZIA.html" | awk '{print $1}')" = "$JUDGE_SHA"
cp -p "$web/index.html" "$stage/index-MT41.backup"
cp -p "$web/panel.php" "$stage/panel-MT41.backup"
cp -p "$web/change-password.php" "$stage/change-password-MT41.backup"
test "$(sha256sum "$stage/index-MT41.backup" | awk '{print $1}')" = "$OLD_SHA"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>'; cat "$stage/MatchThis_MT-42.html"; } > "$web/role-pages/mt42-admin.php.next"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>'; cat "$stage/MatchThis_MT-42_SEDZIA.html"; } > "$web/role-pages/mt42-sedzia.php.next"
cp "$stage/mt42-panel.php" "$web/panel.php.next"
cp "$stage/mt42-change-password.php" "$web/change-password.php.next"
cp "$stage/MatchThis_MT-42_OGLADACZ.html" "$web/index.html.next"
for f in "$web/role-pages/mt42-admin.php.next" "$web/role-pages/mt42-sedzia.php.next" "$web/panel.php.next" "$web/change-password.php.next"; do php -l "$f";done
test "$(sha256sum "$web/index.html.next" | awk '{print $1}')" = "$NEW_SHA"
rollback(){
 cp "$stage/index-MT41.backup" "$web/index.html.rollback" && mv "$web/index.html.rollback" "$web/index.html"
 cp "$stage/panel-MT41.backup" "$web/panel.php.rollback" && mv "$web/panel.php.rollback" "$web/panel.php"
 cp "$stage/change-password-MT41.backup" "$web/change-password.php.rollback" && mv "$web/change-password.php.rollback" "$web/change-password.php"
 rm -f "$web/role-pages/mt42-admin.php" "$web/role-pages/mt42-sedzia.php"
 echo MT42_RESTORED_MT41
}
trap rollback ERR
mv "$web/role-pages/mt42-admin.php.next" "$web/role-pages/mt42-admin.php"
mv "$web/role-pages/mt42-sedzia.php.next" "$web/role-pages/mt42-sedzia.php"
mv "$web/panel.php.next" "$web/panel.php"
mv "$web/change-password.php.next" "$web/change-password.php"
mv "$web/index.html.next" "$web/index.html"
chmod 644 "$web/role-pages/mt42-admin.php" "$web/role-pages/mt42-sedzia.php" "$web/panel.php" "$web/change-password.php" "$web/index.html"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = "$NEW_SHA"
printf '%s\n' 'MT42 Maver October 2025 completed, April points corrected, preserved MT41 authentication' > "$HOME/matchthis-independent/MT42-OWNED"
trap - ERR
echo MT42_PUBLISHED_ONLY_MATCHTHIS
REMOTE
url=https://matchthis.lowcymethodowcy.smallhost.pl
curl -fsSL --max-time 25 "$url/" -o /tmp/mt42-public.html
test "$(sha256sum /tmp/mt42-public.html | awk '{print $1}')" = "$new"
grep -Fq '<title>MatchThis MT-42</title>' /tmp/mt42-public.html
for path in panel.php change-password.php; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$url/$path")"
  test "$code" = 303 || { echo "ANONYMOUS_ROUTE_CHANGED $path $code"; exit 8; }
done
for path in mt42-admin.php mt42-sedzia.php; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$url/role-pages/$path")"
  test "$code" = 403 -o "$code" = 404 || { echo "ROLE_TEMPLATE_EXPOSED $path $code"; exit 9; }
done
echo MT42_VERSION_AUTH_HTTPS_OK
