#!/usr/bin/env bash
set -euo pipefail
test -n "${SSH_PASSWORD:-}" || exit 0
test -f matchthis/MatchThis_MT-32_OGLADACZ.html || exit 0
NEW="$(sha256sum matchthis/MatchThis_MT-32_OGLADACZ.html | awk '{print $1}')"
OLD="$(sha256sum matchthis/MatchThis_MT-31_OGLADACZ.html | awk '{print $1}')"
command -v sshpass >/dev/null || exit 0
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256 | awk '{print $2}')" = 'SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8'
export SSHPASS="$SSH_PASSWORD"
opts=(-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15)
sshpass -e ssh "${opts[@]}" lowcymethodowcy@s3.small.pl "NEW_SHA='$NEW' OLD_SHA='$OLD' bash -s" <<'REMOTE'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-32"
test -f "$web/index.html" && test ! -L "$web/index.html"
actual="$(sha256sum "$web/index.html" | awk '{print $1}')"
if test "$actual" = "$OLD_SHA"; then echo MATCHTHIS_MT32_PREVIOUS_VERSION_ALREADY_ACTIVE;exit 0;fi
if test "$actual" != "$NEW_SHA"; then echo MATCHTHIS_MT32_ROLLBACK_UNEXPECTED_LIVE_HASH_REFUSED;exit 7;fi
test -f "$stage/MatchThis_MT-31_PRE_UPDATE_BACKUP.html" && test ! -L "$stage/MatchThis_MT-31_PRE_UPDATE_BACKUP.html"
test -f "$stage/mt31-panel-pre-update.php" && test ! -L "$stage/mt31-panel-pre-update.php"
test "$(sha256sum "$stage/MatchThis_MT-31_PRE_UPDATE_BACKUP.html" | awk '{print $1}')" = "$OLD_SHA"
cp "$stage/mt31-panel-pre-update.php" "$web/panel.php.rollback"
mv "$web/panel.php.rollback" "$web/panel.php"
cp "$stage/MatchThis_MT-31_PRE_UPDATE_BACKUP.html" "$web/index.html.rollback"
mv "$web/index.html.rollback" "$web/index.html"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = "$OLD_SHA"
echo MATCHTHIS_MT32_ROLLED_BACK_ONLY_OWN_VHOST_TO_MT31
REMOTE
