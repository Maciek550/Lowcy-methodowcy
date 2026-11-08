#!/usr/bin/env bash
set -euo pipefail
test -n "${SSH_PASSWORD:-}"
sudo apt-get -qq update && sudo apt-get -qq install -y sshpass
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256 | awk '{print $2}')" = 'SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8'
export SSHPASS="$SSH_PASSWORD"
opts=(-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15)
sshpass -e ssh "${opts[@]}" lowcymethodowcy@s3.small.pl 'bash -s' <<'REMOTE'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-45"
for f in index-MT44.backup panel-MT44.backup change-password-MT44.backup;do test -f "$stage/$f";done
test ! -L "$web/index.html" && test ! -L "$web/panel.php" && test ! -L "$web/change-password.php"
old="$(sha256sum "$stage/index-MT44.backup" | awk '{print $1}')"
current="$(sha256sum "$web/index.html" | awk '{print $1}')"
expected="$(sha256sum "$stage/MatchThis_MT-45_OGLADACZ.html" | awk '{print $1}')"
if test "$current" = "$old";then echo MT45_ROLLBACK_ALREADY_MT44;exit 0;fi
if test "$current" != "$expected";then echo MT45_ROLLBACK_SOURCE_CHANGED_ABORT;exit 9;fi
cp "$stage/index-MT44.backup" "$web/index.html.rollback"
cp "$stage/panel-MT44.backup" "$web/panel.php.rollback"
cp "$stage/change-password-MT44.backup" "$web/change-password.php.rollback"
mv "$web/index.html.rollback" "$web/index.html"
mv "$web/panel.php.rollback" "$web/panel.php"
mv "$web/change-password.php.rollback" "$web/change-password.php"
rm -f "$web/role-pages/mt45-admin.php" "$web/role-pages/mt45-sedzia.php"
rm -f "$HOME/matchthis-independent/MT45-OWNED"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = "$old"
echo MT45_ROLLBACK_MT44_NO_PASSWORD_OR_RESULTS_CHANGE
REMOTE
