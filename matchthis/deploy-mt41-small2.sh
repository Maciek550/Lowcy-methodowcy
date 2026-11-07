#!/usr/bin/env bash
set -euo pipefail
test -n "$SSH_PASSWORD" || { echo MISSING_SSH_SECRET; exit 2; }
for f in MatchThis_MT-41.html MatchThis_MT-41_OGLADACZ.html MatchThis_MT-41_SEDZIA.html mt41-auth.php mt41-panel.php mt41-login.php mt41-change-password.php mt41-seed.php; do
  test -f "matchthis/$f"
done
for suffix in '' _SEDZIA _OGLADACZ; do
  html="matchthis/MatchThis_MT-41$suffix.html"
  grep -Fq '<title>MatchThis MT-41</title>' "$html"
  grep -Fq 'data-version="MT-41"' "$html"
  grep -Fq 'aria-label="Wersja MT-41">MT-41' "$html"
  grep -Fq "const APP_VERSION='MT-41'" "$html"
done
for f in mt41-auth.php mt41-panel.php mt41-login.php mt41-change-password.php mt41-seed.php; do php -l "matchthis/$f"; done
VIEW_SHA="$(sha256sum matchthis/MatchThis_MT-41_OGLADACZ.html | cut -d' ' -f1)"
ADMIN_SHA="$(sha256sum matchthis/MatchThis_MT-41.html | cut -d' ' -f1)"
JUDGE_SHA="$(sha256sum matchthis/MatchThis_MT-41_SEDZIA.html | cut -d' ' -f1)"
OLD_SHA="$(sha256sum matchthis/MatchThis_MT-40_OGLADACZ.html | cut -d' ' -f1)"
test "$OLD_SHA" = 'fb70fc8e13fe56757cfc3e402c9dcdb55ddceebd16d4bc5d2ee3a3de2b270971'
sudo apt-get -qq update && sudo apt-get -qq install -y sshpass
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256 | awk '{print $2}')" = 'SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8'
export SSHPASS="$SSH_PASSWORD"
remote=lowcymethodowcy@s3.small.pl
sshpass -e ssh -o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15 "$remote" "OLD_SHA='$OLD_SHA' bash -s" <<'REMOTE'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
test -f "$HOME/matchthis-independent/MT40-OWNED"
test -f "$web/login.php" && test ! -L "$web/login.php"
test -f "$web/panel.php" && test ! -L "$web/panel.php"
test -f "$web/index.html" && test ! -L "$web/index.html"
test -d "$web/role-pages" && test ! -L "$web/role-pages"
test ! -e "$web/change-password.php"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = "$OLD_SHA" || { echo BASELINE_MISMATCH_ABORT; exit 7; }
devil www list | grep -F 'matchthis.lowcymethodowcy.smallhost.pl'
mkdir -p "$HOME/matchthis-independent/mt-41"
echo MT41_PREFLIGHT_OK
REMOTE
sshpass -e scp -o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15   matchthis/MatchThis_MT-41.html matchthis/MatchThis_MT-41_OGLADACZ.html matchthis/MatchThis_MT-41_SEDZIA.html   matchthis/mt41-auth.php matchthis/mt41-panel.php matchthis/mt41-login.php matchthis/mt41-change-password.php matchthis/mt41-seed.php   "$remote:matchthis-independent/mt-41/"
sshpass -e ssh -o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15 "$remote" "OLD_SHA='$OLD_SHA' VIEW_SHA='$VIEW_SHA' ADMIN_SHA='$ADMIN_SHA' JUDGE_SHA='$JUDGE_SHA' bash -s" <<'REMOTE'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-41"
auth="$HOME/matchthis-independent/auth"
test -f "$HOME/matchthis-independent/MT40-OWNED"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = "$OLD_SHA"
test "$(sha256sum "$stage/MatchThis_MT-41.html" | awk '{print $1}')" = "$ADMIN_SHA"
test "$(sha256sum "$stage/MatchThis_MT-41_SEDZIA.html" | awk '{print $1}')" = "$JUDGE_SHA"
test "$(sha256sum "$stage/MatchThis_MT-41_OGLADACZ.html" | awk '{print $1}')" = "$VIEW_SHA"
for f in mt41-auth.php mt41-login.php mt41-panel.php mt41-change-password.php mt41-seed.php; do php -l "$stage/$f"; done
test ! -e "$web/change-password.php"
test ! -e "$web/role-pages/mt41-admin.php" && test ! -e "$web/role-pages/mt41-sedzia.php"
# Preserve complete previously working frontend and authentication.
cp -p "$web/index.html" "$stage/index-MT40.backup"
cp -p "$web/login.php" "$stage/login-MT40.backup"
cp -p "$web/panel.php" "$stage/panel-MT40.backup"
test "$(sha256sum "$stage/index-MT40.backup" | awk '{print $1}')" = "$OLD_SHA"
test ! -L "$auth" && test ! -L "$auth/users.json"
mkdir -p "$auth" && chmod 700 "$auth"
if test ! -e "$auth/users.json"; then
  php "$stage/mt41-seed.php" "$stage/login-MT40.backup" "$auth/users.json" || { echo HASH_MIGRATION_FAILED; exit 8; }
fi
test -f "$auth/users.json" && chmod 600 "$auth/users.json"
sha256sum "$auth/users.json" | awk '{print $1}' > "$stage/credentials-before.sha"
php -r '$p=$argv[1];$u=json_decode(file_get_contents($p),true);if(!isset($u["mt-admin"]["hash"],$u["mt-sedzia"]["hash"])||$u["mt-admin"]["role"]!=="admin"||$u["mt-sedzia"]["role"]!=="judge")exit(3);' "$auth/users.json"
cp "$stage/mt41-auth.php" "$auth/mt41-auth.php.next"
php -l "$auth/mt41-auth.php.next"
mv "$auth/mt41-auth.php.next" "$auth/mt41-auth.php"
chmod 600 "$auth/mt41-auth.php"
# Create protected role templates and all next-version endpoints before publishing.
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>'; cat "$stage/MatchThis_MT-41.html"; } > "$web/role-pages/mt41-admin.php.next"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>'; cat "$stage/MatchThis_MT-41_SEDZIA.html"; } > "$web/role-pages/mt41-sedzia.php.next"
php -l "$web/role-pages/mt41-admin.php.next"
php -l "$web/role-pages/mt41-sedzia.php.next"
cp "$stage/mt41-panel.php" "$web/panel.php.next"
cp "$stage/mt41-login.php" "$web/login.php.next"
cp "$stage/mt41-change-password.php" "$web/change-password.php.next"
cp "$stage/MatchThis_MT-41_OGLADACZ.html" "$web/index.html.next"
test "$(sha256sum "$web/index.html.next" | awk '{print $1}')" = "$VIEW_SHA"
for f in "$web/panel.php.next" "$web/login.php.next" "$web/change-password.php.next"; do php -l "$f"; done
rollback(){
  cp "$stage/login-MT40.backup" "$web/login.php.rollback" && mv "$web/login.php.rollback" "$web/login.php"
  cp "$stage/panel-MT40.backup" "$web/panel.php.rollback" && mv "$web/panel.php.rollback" "$web/panel.php"
  cp "$stage/index-MT40.backup" "$web/index.html.rollback" && mv "$web/index.html.rollback" "$web/index.html"
  rm -f "$web/change-password.php" "$web/role-pages/mt41-admin.php" "$web/role-pages/mt41-sedzia.php"
  echo MT41_ROLLBACK_TO_MT40
}
trap rollback ERR
mv "$web/role-pages/mt41-admin.php.next" "$web/role-pages/mt41-admin.php"
mv "$web/role-pages/mt41-sedzia.php.next" "$web/role-pages/mt41-sedzia.php"
mv "$web/change-password.php.next" "$web/change-password.php"
mv "$web/login.php.next" "$web/login.php"
mv "$web/panel.php.next" "$web/panel.php"
mv "$web/index.html.next" "$web/index.html"
chmod 644 "$web/role-pages/mt41-admin.php" "$web/role-pages/mt41-sedzia.php" "$web/change-password.php" "$web/login.php" "$web/panel.php" "$web/index.html"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = "$VIEW_SHA"
printf '%s\n' 'MatchThis MT-41 authentication self-service isolated deployment' > "$HOME/matchthis-independent/MT41-OWNED"
trap - ERR
echo MT41_PUBLISHED_ONLY_MATCHTHIS
REMOTE
url=https://matchthis.lowcymethodowcy.smallhost.pl
curl -fsSL --max-time 25 "$url/" -o /tmp/mt41-public.html
test "$(sha256sum /tmp/mt41-public.html | awk '{print $1}')" = "$VIEW_SHA"
for route in panel.php change-password.php; do
  status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$url/$route")"
  test "$status" = 303 || { echo "ANONYMOUS_ROUTE_BROKEN:$route:$status"; exit 10; }
done
for p in mt41-admin.php mt41-sedzia.php; do
  code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$url/role-pages/$p")"
  test "$code" = 403 -o "$code" = 404 || { echo "PRIVATE_EXPOSED:$p:$code"; exit 11; }
done
echo MT41_HTTPS_ANONYMOUS_PROTECTION_AND_VERSION_OK
