#!/usr/bin/env bash
# Restore only MT89 index and auth router if MT90 live verification fails.
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
stage="$HOME/matchthis-independent/mt90-mobile-20261117"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = f8cb9863a81091ec556b497244db9d3300dc4023c5626c8bc32130929356f184
test "$(sha256sum "$stage/previous/index.html"|awk '{print $1}')" = acef7ad0a0d7eb75b02cb06d92a139be7a49c5042e6b9311ea6230e14c1d8a83
cp -p "$stage/previous/panel.php" "$web/panel.php.next.mt90rollback"
mv -f "$web/panel.php.next.mt90rollback" "$web/panel.php"
cp -p "$stage/previous/index.html" "$web/index.html.next.mt90rollback"
mv -f "$web/index.html.next.mt90rollback" "$web/index.html"
echo MT90_ROLLBACK_UI_MT89_RESTORED_NO_DATA_CHANGED
RB
