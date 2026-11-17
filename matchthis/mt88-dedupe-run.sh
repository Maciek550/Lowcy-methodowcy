#!/usr/bin/env bash
set -Eeuo pipefail
test -n "$SSH_PASSWORD" || { echo MISSING_SMALL2_SECRET; exit 2; }
sudo apt-get -qq update
sudo apt-get -qq install -y sshpass
mkdir -p "$HOME/.ssh";chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256|awk '{print $2}')" = 'SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8'
export SSHPASS="$SSH_PASSWORD"
opts=(-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15)
remote=lowcymethodowcy@s3.small.pl
sshpass -e scp "${opts[@]}" matchthis/mt88-dedupe-bartczak.php "$remote:matchthis-independent/mt88-bartczak-20261117/"
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'REMOTE'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt88-bartczak-20261117"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = 1e990e680c7138c06df5e197d4d8dcadb40289af351c703ace893acb9e372b92
old_users="$(sha256sum "$web/.mt41-private/users.php"|awk '{print $1}')"
old_panel="$(sha256sum "$web/panel.php"|awk '{print $1}')"
old_playerlib="$(sha256sum "$web/.mt41-private/mt86-player-lib.php"|awk '{print $1}')"
php -l "$stage/mt88-dedupe-bartczak.php"
php "$stage/mt88-dedupe-bartczak.php" check
php "$stage/mt88-dedupe-bartczak.php" apply
test "$(sha256sum "$web/.mt41-private/users.php"|awk '{print $1}')" = "$old_users"
test "$(sha256sum "$web/panel.php"|awk '{print $1}')" = "$old_panel"
test "$(sha256sum "$web/.mt41-private/mt86-player-lib.php"|awk '{print $1}')" = "$old_playerlib"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = 1e990e680c7138c06df5e197d4d8dcadb40289af351c703ace893acb9e372b92
echo MT88_ADMIN_ACCOUNT_LOGIN_AND_FRONTEND_UNCHANGED_PASS
REMOTE
