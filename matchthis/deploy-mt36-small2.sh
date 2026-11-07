#!/usr/bin/env bash
set -euo pipefail
test -n "${SSH_PASSWORD:-}" || { echo MISSING_SMALL2_SSH_PASSWORD; exit 2; }
test -f matchthis/MatchThis_MT-36.html
test -f matchthis/MatchThis_MT-36_OGLADACZ.html
test -f matchthis/MatchThis_MT-36_SEDZIA.html
test -f matchthis/mt36-panel.php
test "$(sha256sum matchthis/MatchThis_MT-36.html | awk '{print $1}')" = "1be1d47da241ed244052006d51b50ba3135a095ea0fce7dcef8d6fb8bb1017db"
test "$(sha256sum matchthis/MatchThis_MT-36_OGLADACZ.html | awk '{print $1}')" = "ee778be0a4f02b4acea2d3ba0ca896649033f0f5a953c2eba4b0c04694108caf"
test "$(sha256sum matchthis/MatchThis_MT-36_SEDZIA.html | awk '{print $1}')" = "b26b12d540ae5a0a6a70816abf77bec3b44a81a9fa0265d0ba9e15dfc80133a5"
VIEW_SHA="$(sha256sum matchthis/MatchThis_MT-36_OGLADACZ.html | awk '{print $1}')"
ADMIN_SHA="$(sha256sum matchthis/MatchThis_MT-36.html | awk '{print $1}')"
JUDGE_SHA="$(sha256sum matchthis/MatchThis_MT-36_SEDZIA.html | awk '{print $1}')"
OLD_SHA="$(sha256sum matchthis/MatchThis_MT-35_OGLADACZ.html | awk '{print $1}')"
grep -Fq '<title>MatchThis MT-36</title>' matchthis/MatchThis_MT-36.html
grep -Fq 'aria-label="Wersja MT-36">MT-36' matchthis/MatchThis_MT-36.html
grep -Fq 'data-version="MT-36"' matchthis/MatchThis_MT-36.html
grep -Fq 'Brak danych do zdjęć sektorowych tej tury.' matchthis/MatchThis_MT-36.html
php -l matchthis/mt36-panel.php
sudo apt-get -qq update && sudo apt-get -qq install -y sshpass
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256 | awk '{print $2}')" = 'SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8'
export SSHPASS="$SSH_PASSWORD"
opts=(-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15)
remote=lowcymethodowcy@s3.small.pl
sshpass -e ssh "${opts[@]}" "$remote" "OLD_SHA='$OLD_SHA' bash -s" <<'REMOTE'
set -euo pipefail
domain=matchthis.lowcymethodowcy.smallhost.pl
web="$HOME/domains/$domain/public_html"
test -f "$HOME/matchthis-independent/MT35-OWNED"
test -f "$web/index.html" && test ! -L "$web/index.html"
test -f "$web/panel.php" && test ! -L "$web/panel.php"
test -d "$web/role-pages" && test ! -L "$web/role-pages"
devil www list | grep -F "$domain"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = "$OLD_SHA" || { echo STOP_SOURCE_CHANGED; exit 7; }
mkdir -p "$HOME/matchthis-independent/mt-36"
echo MATCHTHIS_MT36_PREFLIGHT_OK
REMOTE
sshpass -e scp "${opts[@]}" matchthis/MatchThis_MT-36.html matchthis/MatchThis_MT-36_OGLADACZ.html matchthis/MatchThis_MT-36_SEDZIA.html matchthis/mt36-panel.php "$remote:matchthis-independent/mt-36/"
sshpass -e ssh "${opts[@]}" "$remote" "OLD_SHA='$OLD_SHA' VIEW_SHA='$VIEW_SHA' ADMIN_SHA='$ADMIN_SHA' JUDGE_SHA='$JUDGE_SHA' bash -s" <<'REMOTE'
set -euo pipefail
domain=matchthis.lowcymethodowcy.smallhost.pl
web="$HOME/domains/$domain/public_html"
stage="$HOME/matchthis-independent/mt-36"
test -f "$HOME/matchthis-independent/MT35-OWNED"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = "$OLD_SHA"
test "$(sha256sum "$stage/MatchThis_MT-36.html" | awk '{print $1}')" = "$ADMIN_SHA"
test "$(sha256sum "$stage/MatchThis_MT-36_OGLADACZ.html" | awk '{print $1}')" = "$VIEW_SHA"
test "$(sha256sum "$stage/MatchThis_MT-36_SEDZIA.html" | awk '{print $1}')" = "$JUDGE_SHA"
php -l "$stage/mt36-panel.php"
test ! -L "$web/role-pages/mt36-admin.php"
test ! -L "$web/role-pages/mt36-sedzia.php"
cp -p "$web/index.html" "$stage/MatchThis_MT-35_PRE_UPDATE_BACKUP.html"
cp -p "$web/panel.php" "$stage/mt35-panel-pre-update.php"
test "$(sha256sum "$stage/MatchThis_MT-35_PRE_UPDATE_BACKUP.html" | awk '{print $1}')" = "$OLD_SHA"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>'; cat "$stage/MatchThis_MT-36.html"; } > "$web/role-pages/mt36-admin.php.next"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>'; cat "$stage/MatchThis_MT-36_SEDZIA.html"; } > "$web/role-pages/mt36-sedzia.php.next"
php -l "$web/role-pages/mt36-admin.php.next"
php -l "$web/role-pages/mt36-sedzia.php.next"
mv "$web/role-pages/mt36-admin.php.next" "$web/role-pages/mt36-admin.php"
mv "$web/role-pages/mt36-sedzia.php.next" "$web/role-pages/mt36-sedzia.php"
chmod 644 "$web/role-pages/mt36-admin.php" "$web/role-pages/mt36-sedzia.php"
cp "$stage/mt36-panel.php" "$web/panel.php.next"
mv "$web/panel.php.next" "$web/panel.php"
cp "$stage/MatchThis_MT-36_OGLADACZ.html" "$web/index.html.next"
test "$(sha256sum "$web/index.html.next" | awk '{print $1}')" = "$VIEW_SHA"
mv "$web/index.html.next" "$web/index.html"
chmod 644 "$web/panel.php" "$web/index.html"
echo 'MT-36 isolated MatchThis: fake sector FB blocked' > "$HOME/matchthis-independent/MT36-OWNED"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = "$VIEW_SHA"
echo MATCHTHIS_MT36_PUBLISHED_ONLY_MATCHTHIS
REMOTE
url=https://matchthis.lowcymethodowcy.smallhost.pl
curl -fsSL --max-time 25 "$url/" -o /tmp/matchthis-mt36-public.html
test "$(sha256sum /tmp/matchthis-mt36-public.html | awk '{print $1}')" = "$VIEW_SHA"
grep -Fq '<title>MatchThis MT-36</title>' /tmp/matchthis-mt36-public.html
status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$url/panel.php")"
test "$status" = 303 || { echo "ANONYMOUS_PANEL_HTTP_$status"; exit 8; }
for p in mt36-admin.php mt36-sedzia.php; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$url/role-pages/$p")"
  if test "$code" != 403 && test "$code" != 404; then echo "PRIVATE_EXPOSED_$p:$code"; exit 9;fi
done
echo MATCHTHIS_MT36_HTTPS_SOURCE_HASH_AND_PRIVACY_OK
