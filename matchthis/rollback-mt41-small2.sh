#!/usr/bin/env bash
set -euo pipefail
test -n "$SSH_PASSWORD" || { echo NO_SSH_SECRET; exit 2; }
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256 | awk '{print $2}')" = 'SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8'
export SSHPASS="$SSH_PASSWORD"
sshpass -e ssh -o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15 lowcymethodowcy@s3.small.pl 'bash -s' <<'REMOTE'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-41"
auth="$web/.mt41-private"
for f in index-MT40.backup login-MT40.backup panel-MT40.backup credentials-before.sha; do test -f "$stage/$f"; done
test ! -L "$web" && test ! -L "$web/login.php" && test ! -L "$web/panel.php" && test ! -L "$web/index.html"
test -f "$auth/users.php" && test ! -L "$auth/users.php"
# Never restore the old static login if someone already changed a password.
original="$(cat "$stage/credentials-before.sha")"
current="$(sha256sum "$auth/users.php" | awk '{print $1}')"
if test "$current" != "$original"; then echo CREDENTIALS_CHANGED_NO_UNSAFE_ROLLBACK; exit 9; fi
cp "$stage/login-MT40.backup" "$web/login.php.rollback"
cp "$stage/panel-MT40.backup" "$web/panel.php.rollback"
cp "$stage/index-MT40.backup" "$web/index.html.rollback"
mv "$web/login.php.rollback" "$web/login.php"
mv "$web/panel.php.rollback" "$web/panel.php"
mv "$web/index.html.rollback" "$web/index.html"
rm -f "$web/change-password.php" "$web/role-pages/mt41-admin.php" "$web/role-pages/mt41-sedzia.php"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = 'fb70fc8e13fe56757cfc3e402c9dcdb55ddceebd16d4bc5d2ee3a3de2b270971'
rm -f "$HOME/matchthis-independent/MT41-OWNED"
echo MT41_RESTORED_TO_MT40_WITHOUT_ACCOUNT_CHANGES
REMOTE
