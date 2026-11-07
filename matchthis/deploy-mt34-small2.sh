#!/usr/bin/env bash
set -euo pipefail
test -n "${SSH_PASSWORD:-}" || { echo MISSING_SMALL2_SSH_PASSWORD; exit 2; }
test -f matchthis/MatchThis_MT-34.html
test -f matchthis/MatchThis_MT-34_OGLADACZ.html
test -f matchthis/MatchThis_MT-34_SEDZIA.html
test -f matchthis/mt34-panel.php
test "$(sha256sum matchthis/MatchThis_MT-34.html | awk '{print $1}')" = "b69d1eb029d60464e8ccf42859f8731f10bb1cd389553220fee8acfc8b1e636c"
test "$(sha256sum matchthis/MatchThis_MT-34_OGLADACZ.html | awk '{print $1}')" = "d0930c8def4bee8f5a2052910e377319961ce698253004f53c9eb0bee8c3dafb"
test "$(sha256sum matchthis/MatchThis_MT-34_SEDZIA.html | awk '{print $1}')" = "87643f374cf89fda9f0bd5994c1fc01b38dde906d966b54000eb344c8289cb43"
VIEW_SHA="$(sha256sum matchthis/MatchThis_MT-34_OGLADACZ.html | awk '{print $1}')"
ADMIN_SHA="$(sha256sum matchthis/MatchThis_MT-34.html | awk '{print $1}')"
JUDGE_SHA="$(sha256sum matchthis/MatchThis_MT-34_SEDZIA.html | awk '{print $1}')"
OLD_SHA="$(sha256sum matchthis/MatchThis_MT-32_OGLADACZ.html | awk '{print $1}')"
grep -Fq '<title>MatchThis MT-34</title>' matchthis/MatchThis_MT-34.html
grep -Fq 'aria-label="Wersja MT-34">MT-34' matchthis/MatchThis_MT-34.html
grep -Fq 'data-version="MT-34"' matchthis/MatchThis_MT-34.html
grep -Fq 'Brak danych do zdjęć sektorowych tej tury.' matchthis/MatchThis_MT-34.html
php -l matchthis/mt34-panel.php
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
test -f "$HOME/matchthis-independent/MT32-OWNED"
test -f "$web/index.html" && test ! -L "$web/index.html"
test -f "$web/panel.php" && test ! -L "$web/panel.php"
test -d "$web/role-pages" && test ! -L "$web/role-pages"
devil www list | grep -F "$domain"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = "$OLD_SHA" || { echo STOP_SOURCE_CHANGED; exit 7; }
mkdir -p "$HOME/matchthis-independent/mt-32"
echo MATCHTHIS_MT34_PREFLIGHT_OK
REMOTE
sshpass -e scp "${opts[@]}" matchthis/MatchThis_MT-34.html matchthis/MatchThis_MT-34_OGLADACZ.html matchthis/MatchThis_MT-34_SEDZIA.html matchthis/mt34-panel.php "$remote:matchthis-independent/mt-32/"
sshpass -e ssh "${opts[@]}" "$remote" "OLD_SHA='$OLD_SHA' VIEW_SHA='$VIEW_SHA' ADMIN_SHA='$ADMIN_SHA' JUDGE_SHA='$JUDGE_SHA' bash -s" <<'REMOTE'
set -euo pipefail
domain=matchthis.lowcymethodowcy.smallhost.pl
web="$HOME/domains/$domain/public_html"
stage="$HOME/matchthis-independent/mt-32"
test -f "$HOME/matchthis-independent/MT32-OWNED"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = "$OLD_SHA"
test "$(sha256sum "$stage/MatchThis_MT-34.html" | awk '{print $1}')" = "$ADMIN_SHA"
test "$(sha256sum "$stage/MatchThis_MT-34_OGLADACZ.html" | awk '{print $1}')" = "$VIEW_SHA"
test "$(sha256sum "$stage/MatchThis_MT-34_SEDZIA.html" | awk '{print $1}')" = "$JUDGE_SHA"
php -l "$stage/mt34-panel.php"
test ! -L "$web/role-pages/mt34-admin.php"
test ! -L "$web/role-pages/mt34-sedzia.php"
cp -p "$web/index.html" "$stage/MatchThis_MT-32_PRE_UPDATE_BACKUP.html"
cp -p "$web/panel.php" "$stage/mt32-panel-pre-update.php"
test "$(sha256sum "$stage/MatchThis_MT-32_PRE_UPDATE_BACKUP.html" | awk '{print $1}')" = "$OLD_SHA"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>'; cat "$stage/MatchThis_MT-34.html"; } > "$web/role-pages/mt34-admin.php.next"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>'; cat "$stage/MatchThis_MT-34_SEDZIA.html"; } > "$web/role-pages/mt34-sedzia.php.next"
php -l "$web/role-pages/mt34-admin.php.next"
php -l "$web/role-pages/mt34-sedzia.php.next"
mv "$web/role-pages/mt34-admin.php.next" "$web/role-pages/mt34-admin.php"
mv "$web/role-pages/mt34-sedzia.php.next" "$web/role-pages/mt34-sedzia.php"
chmod 644 "$web/role-pages/mt34-admin.php" "$web/role-pages/mt34-sedzia.php"
cp "$stage/mt34-panel.php" "$web/panel.php.next"
mv "$web/panel.php.next" "$web/panel.php"
cp "$stage/MatchThis_MT-34_OGLADACZ.html" "$web/index.html.next"
test "$(sha256sum "$web/index.html.next" | awk '{print $1}')" = "$VIEW_SHA"
mv "$web/index.html.next" "$web/index.html"
chmod 644 "$web/panel.php" "$web/index.html"
echo 'MT-34 isolated MatchThis: fake sector FB blocked' > "$HOME/matchthis-independent/MT34-OWNED"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = "$VIEW_SHA"
echo MATCHTHIS_MT34_PUBLISHED_ONLY_MATCHTHIS
REMOTE
url=https://matchthis.lowcymethodowcy.smallhost.pl
curl -fsSL --max-time 25 "$url/" -o /tmp/matchthis-mt34-public.html
test "$(sha256sum /tmp/matchthis-mt34-public.html | awk '{print $1}')" = "$VIEW_SHA"
grep -Fq '<title>MatchThis MT-34</title>' /tmp/matchthis-mt34-public.html
status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$url/panel.php")"
test "$status" = 303 || { echo "ANONYMOUS_PANEL_HTTP_$status"; exit 8; }
for p in mt34-admin.php mt34-sedzia.php; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$url/role-pages/$p")"
  if test "$code" != 403 && test "$code" != 404; then echo "PRIVATE_EXPOSED_$p:$code"; exit 9;fi
done
echo MATCHTHIS_MT34_HTTPS_SOURCE_HASH_AND_PRIVACY_OK
