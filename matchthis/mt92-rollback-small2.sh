#!/usr/bin/env bash
# Restore only MT91 index and auth router if MT92 live verification fails.
set -Eeuo pipefail
test -n "$SSH_PASSWORD"
sudo apt-get -qq update && sudo apt-get -qq install -y sshpass
mkdir -p "$HOME/.ssh";chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256|awk '{print $2}')" = 'SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8'
export SSHPASS="$SSH_PASSWORD"
opts='-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15'
sshpass -e ssh $opts lowcymethodowcy@s3.small.pl 'bash -s' <<'RB'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt92-mobile-20261118"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = 49960517aeabfaa132c8072466f300ca719b5db652e9e4c4c69a5058c0739316
test "$(sha256sum "$stage/previous/index.html"|awk '{print $1}')" = ba7521d6877d9d0552a315c655ea4fd3175827df02c8f4e65f43c5df6222e2d4
cp -p "$stage/previous/panel.php" "$web/panel.php.next.mt92rollback"
mv -f "$web/panel.php.next.mt92rollback" "$web/panel.php"
cp -p "$stage/previous/index.html" "$web/index.html.next.mt92rollback"
mv -f "$web/index.html.next.mt92rollback" "$web/index.html"
echo MT92_ROLLBACK_UI_MT91_RESTORED_NO_DATA_CHANGED
RB
