#!/usr/bin/env bash
set -euo pipefail
test -n "${SSH_PASSWORD:-}" || { echo MISSING_SMALL2_SSH_PASSWORD; exit 2; }
for suffix in '' _OGLADACZ _SEDZIA; do
  f="matchthis/MatchThis_MT-46${suffix}.html"
  test -f "$f"
  grep -Fq '<title>MatchThis MT-46</title>' "$f"
  grep -Fq 'aria-label="Wersja MT-46">MT-46' "$f"
  grep -Fq 'data-version="MT-46"' "$f"
  grep -Fq "const APP_VERSION='MT-46'" "$f"
done
test -f matchthis/mt41-panel.php
test -f matchthis/mt41-change-password.php
old="$(sha256sum matchthis/MatchThis_MT-45_OGLADACZ.html | awk '{print $1}')"
new="$(sha256sum matchthis/MatchThis_MT-46_OGLADACZ.html | awk '{print $1}')"
admin="$(sha256sum matchthis/MatchThis_MT-46.html | awk '{print $1}')"
judge="$(sha256sum matchthis/MatchThis_MT-46_SEDZIA.html | awk '{print $1}')"
# Preserve MT45 server authentication and access control: only change the protected
# role template file targets, and the displayed version on the password page.
sed 's/mt41-admin.php/mt46-admin.php/g;s/mt41-sedzia.php/mt46-sedzia.php/g' matchthis/mt41-panel.php > /tmp/mt46-panel.php
sed 's/MT-41/MT-46/g' matchthis/mt41-change-password.php > /tmp/mt46-change-password.php
php -l /tmp/mt46-panel.php
php -l /tmp/mt46-change-password.php
grep -Fq "mt46-admin.php" /tmp/mt46-panel.php
grep -Fq "mt46-sedzia.php" /tmp/mt46-panel.php
grep -Fq 'MatchThis MT-46' /tmp/mt46-change-password.php
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
stage="$HOME/matchthis-independent/mt-46"
test -f "$HOME/matchthis-independent/MT45-OWNED"
test -d "$web/role-pages" && test ! -L "$web/role-pages"
test -f "$web/index.html" && test ! -L "$web/index.html"
test -f "$web/panel.php" && test ! -L "$web/panel.php"
test -f "$web/change-password.php" && test ! -L "$web/change-password.php"
test -f "$web/login.php" && test ! -L "$web/login.php"
test -f "$web/role-pages/mt45-admin.php" && test -f "$web/role-pages/mt45-sedzia.php"
test ! -e "$web/role-pages/mt46-admin.php" && test ! -e "$web/role-pages/mt46-sedzia.php"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = "$OLD_SHA" || { echo MT45_LIVE_BASELINE_CHANGED_ABORT;exit 7; }
devil www list | grep -F 'matchthis.lowcymethodowcy.smallhost.pl'
mkdir -p "$stage"
echo MT46_PREFLIGHT_AND_SOURCE_OK
REMOTE
sshpass -e scp "${opts[@]}"   matchthis/MatchThis_MT-46.html matchthis/MatchThis_MT-46_SEDZIA.html matchthis/MatchThis_MT-46_OGLADACZ.html   "$remote:matchthis-independent/mt-46/"
sshpass -e scp "${opts[@]}" /tmp/mt46-panel.php /tmp/mt46-change-password.php "$remote:matchthis-independent/mt-46/"
sshpass -e ssh "${opts[@]}" "$remote" "OLD_SHA='$old' NEW_SHA='$new' ADMIN_SHA='$admin' JUDGE_SHA='$judge' bash -s" <<'REMOTE'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-46"
test -f "$HOME/matchthis-independent/MT45-OWNED"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = "$OLD_SHA"
test "$(sha256sum "$stage/MatchThis_MT-46_OGLADACZ.html" | awk '{print $1}')" = "$NEW_SHA"
test "$(sha256sum "$stage/MatchThis_MT-46.html" | awk '{print $1}')" = "$ADMIN_SHA"
test "$(sha256sum "$stage/MatchThis_MT-46_SEDZIA.html" | awk '{print $1}')" = "$JUDGE_SHA"
cp -p "$web/index.html" "$stage/index-MT45.backup"
cp -p "$web/panel.php" "$stage/panel-MT45.backup"
cp -p "$web/change-password.php" "$stage/change-password-MT45.backup"
test "$(sha256sum "$stage/index-MT45.backup" | awk '{print $1}')" = "$OLD_SHA"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>'; cat "$stage/MatchThis_MT-46.html"; } > "$web/role-pages/mt46-admin.php.next"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>'; cat "$stage/MatchThis_MT-46_SEDZIA.html"; } > "$web/role-pages/mt46-sedzia.php.next"
cp "$stage/mt46-panel.php" "$web/panel.php.next"
cp "$stage/mt46-change-password.php" "$web/change-password.php.next"
cp "$stage/MatchThis_MT-46_OGLADACZ.html" "$web/index.html.next"
for f in "$web/role-pages/mt46-admin.php.next" "$web/role-pages/mt46-sedzia.php.next" "$web/panel.php.next" "$web/change-password.php.next"; do php -l "$f";done
test "$(sha256sum "$web/index.html.next" | awk '{print $1}')" = "$NEW_SHA"
rollback(){
 cp "$stage/index-MT45.backup" "$web/index.html.rollback" && mv "$web/index.html.rollback" "$web/index.html"
 cp "$stage/panel-MT45.backup" "$web/panel.php.rollback" && mv "$web/panel.php.rollback" "$web/panel.php"
 cp "$stage/change-password-MT45.backup" "$web/change-password.php.rollback" && mv "$web/change-password.php.rollback" "$web/change-password.php"
 rm -f "$web/role-pages/mt46-admin.php" "$web/role-pages/mt46-sedzia.php"
 echo MT46_RESTORED_MT45
}
trap rollback ERR
mv "$web/role-pages/mt46-admin.php.next" "$web/role-pages/mt46-admin.php"
mv "$web/role-pages/mt46-sedzia.php.next" "$web/role-pages/mt46-sedzia.php"
mv "$web/panel.php.next" "$web/panel.php"
mv "$web/change-password.php.next" "$web/change-password.php"
mv "$web/index.html.next" "$web/index.html"
chmod 644 "$web/role-pages/mt46-admin.php" "$web/role-pages/mt46-sedzia.php" "$web/panel.php" "$web/change-password.php" "$web/index.html"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = "$NEW_SHA"
printf '%s\n' 'MT46: XIII Puchar MatchThis.pl 22.11.2025 I tura stanowiska/sektory 77, prior data preserved' > "$HOME/matchthis-independent/MT46-OWNED"
trap - ERR
echo MT46_PUBLISHED_ONLY_MATCHTHIS
REMOTE
url=https://matchthis.lowcymethodowcy.smallhost.pl
curl -fsSL --max-time 25 "$url/" -o /tmp/mt46-public.html
test "$(sha256sum /tmp/mt46-public.html | awk '{print $1}')" = "$new"
grep -Fq '<title>MatchThis MT-46</title>' /tmp/mt46-public.html
for path in panel.php change-password.php; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$url/$path")"
  test "$code" = 303 || { echo "ANONYMOUS_ROUTE_CHANGED $path $code"; exit 8; }
done
for path in mt46-admin.php mt46-sedzia.php; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$url/role-pages/$path")"
  test "$code" = 403 -o "$code" = 404 || { echo "ROLE_TEMPLATE_EXPOSED $path $code"; exit 9; }
done
echo MT46_VERSION_AUTH_HTTPS_OK
