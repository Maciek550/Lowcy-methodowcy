#!/usr/bin/env bash
set -Eeuo pipefail
test -n "$SSH_PASSWORD"
sudo apt-get -qq update && sudo apt-get -qq install -y sshpass
mkdir -p "$HOME/.ssh";chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256|awk '{print $2}')" = 'SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8'
export SSHPASS="$SSH_PASSWORD"
sshpass -e ssh -o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15 lowcymethodowcy@s3.small.pl 'bash -s' <<'ROLLBACK'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
prior="$HOME/matchthis-independent/mt89-peil-20261117-r2/previous"
test -f "$prior/index.html" && test -f "$prior/panel.php"
test "$(sha256sum "$prior/index.html"|awk '{print $1}')" = 1e990e680c7138c06df5e197d4d8dcadb40289af351c703ace893acb9e372b92
for f in index.html panel.php;do cp -p "$prior/$f" "$web/$f.mt89-restore";mv -f "$web/$f.mt89-restore" "$web/$f";done
echo MT89_FRONTEND_ROLLBACK_MT88_RESTORED_PRESERVING_PEIL_MERGE
ROLLBACK
