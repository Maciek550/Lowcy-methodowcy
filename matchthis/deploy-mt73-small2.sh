#!/usr/bin/env bash
set -Eeuo pipefail
mode=${1:-deploy}
export SSHPASS="$SSH_PASSWORD"
mkdir -p -m 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256 | awk '{print $2}')" = SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8
opts=(-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o ConnectTimeout=20)
remote=lowcymethodowcy@s3.small.pl
if [ "$mode" = rollback ]; then
 sshpass -e ssh "${opts[@]}" "$remote" 'sh -s' <<'REMOTE'
set -eu
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-73"
test -s "$stage/rollback-mt72/index.html"
cp -p "$stage/rollback-mt72/index.html" "$web/index.html.next"
cp -p "$stage/rollback-mt72/panel.php" "$web/panel.php.next"
mv "$web/panel.php.next" "$web/panel.php"
mv "$web/index.html.next" "$web/index.html"
echo MT73_ROLLBACK_MT72_STATE_PRESERVED
REMOTE
 exit
fi
on_exit(){ status=$?;trap - EXIT;if [ "$status" != 0 ];then bash "$0" rollback || echo MT73_ROLLBACK_REQUIRES_INSPECTION;fi;exit "$status"; }
trap on_exit EXIT
sshpass -e ssh "${opts[@]}" "$remote" 'sh -s' <<'REMOTE'
set -eu
umask 077
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = eea8eec389f8f4a586444765740965180a244a3b3a6833f5742e59681400a845
test -s "$web/.mt41-private/users.php"
test ! -e "$web/.mt41-private/state-mt73.json"
stage="$HOME/matchthis-independent/mt-73"
mkdir -p "$stage/rollback-mt72"
test ! -e "$stage/rollback-mt72/index.html"
cp -p "$web/index.html" "$web/panel.php" "$stage/rollback-mt72/"
cp -Rp "$web/role-pages" "$stage/rollback-mt72/"
sha256sum "$web/mt60-draws.php" "$web/.mt41-private/mt60-published-draws.json" > "$stage/publication-before.sha256"
REMOTE
sshpass -e scp "${opts[@]}" matchthis/MatchThis_MT-73*.html matchthis/mt73-state.php matchthis/mt73-store.php matchthis/mt73-seed.json matchthis/mt73-install-state.php "$remote:matchthis-independent/mt-73/"
sshpass -e ssh "${opts[@]}" "$remote" 'sh -s' <<'REMOTE'
set -eu
umask 077
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-73"
php -l "$stage/mt73-state.php"
php -l "$stage/mt73-store.php"
for f in mt73-store.php mt73-state.php; do test ! -e "$web/$f";cp "$stage/$f" "$web/$f";chmod 644 "$web/$f";done
php "$stage/mt73-install-state.php" "$web" "$stage"
for role in admin sedzia; do
 case "$role" in admin) suffix='';;sedzia) suffix='_SEDZIA';;esac
 { printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$stage/MatchThis_MT-73$suffix.html"; } > "$web/role-pages/mt73-$role.php"
 chmod 644 "$web/role-pages/mt73-$role.php"
 php -l "$web/role-pages/mt73-$role.php" >/dev/null
done
sed 's/mt72-admin.php/mt73-admin.php/g;s/mt72-sedzia.php/mt73-sedzia.php/g' "$web/panel.php" > "$web/panel.php.next"
grep -q 'mt73-admin.php' "$web/panel.php.next"
php -l "$web/panel.php.next" >/dev/null
cp "$stage/MatchThis_MT-73_OGLADACZ.html" "$web/index.html.next"
chmod 644 "$web/panel.php.next" "$web/index.html.next"
mv "$web/panel.php.next" "$web/panel.php"
mv "$web/index.html.next" "$web/index.html"
sha256sum -c "$stage/publication-before.sha256"
echo MT73_PRODUCTION_ACTIVATED
"$HOME/.config/independent-project-backups/full-backup-20261110.sh" matchthis
latest=$(ls -1dt "$HOME"/.private-project-backups/matchthis/20* | head -n 1)
verify=$(mktemp -d "$stage/.backup-verify.XXXXXXXX")
tar -xzf "$latest/backup.tar.gz" -C "$verify"
mkdir "$verify/restore"
tar -xzf "$verify/application.tar.gz" -C "$verify/restore"
php -r '$s=json_decode(file_get_contents($argv[1]),true,512,JSON_THROW_ON_ERROR);if(!isset($s["revision"],$s["data"]["events"]))exit(1);echo "MT73_ACTUAL_BACKUP_STATE_RESTORED_PASS revision=".$s["revision"].PHP_EOL;' "$verify/restore/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html/.mt41-private/state-mt73.json"
rm -rf "$verify"
echo MT73_SERVER_STATE_AND_DAILY_BACKUP_VERIFIED
REMOTE
