#!/usr/bin/env bash
# MT92: UI-only guarded SMALL2 release; no database, users, sessions or results writes.
set -Eeuo pipefail
test -n "$SSH_PASSWORD"
for suffix in '' '_OGLADACZ' '_SEDZIA'; do
 test -s "matchthis/mt92-release/MatchThis_MT-92$suffix.html"
done
test "$(sha256sum matchthis/mt92-release/MatchThis_MT-92.html|cut -d' ' -f1)" = 6f00c1717e3a500e052a4f667630ecf17e454c1327365ed081b33ded73184fd7
test "$(sha256sum matchthis/mt92-release/MatchThis_MT-92_OGLADACZ.html|cut -d' ' -f1)" = 49960517aeabfaa132c8072466f300ca719b5db652e9e4c4c69a5058c0739316
test "$(sha256sum matchthis/mt92-release/MatchThis_MT-92_SEDZIA.html|cut -d' ' -f1)" = 6b4866d0719be45fccb2e94f4fcf8bf94bdb775a327e7ed70277957086e920ec
sudo apt-get -qq update && sudo apt-get -qq install -y sshpass
mkdir -p "$HOME/.ssh";chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256|awk '{print $2}')" = 'SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8'
export SSHPASS="$SSH_PASSWORD"
opts='-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15'
remote=lowcymethodowcy@s3.small.pl
sshpass -e ssh $opts "$remote" 'bash -s' <<'PRE'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt92-mobile-20261118"
test -d "$web" && test ! -e "$stage"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = ba7521d6877d9d0552a315c655ea4fd3175827df02c8f4e65f43c5df6222e2d4
test "$(tail -n +2 "$web/role-pages/mt91-admin.php"|sha256sum|awk '{print $1}')" = d40ede0022d7c44fb98289dc631810de2cef6a8955437fbf473ec56b1ce9a69b
test "$(tail -n +2 "$web/role-pages/mt91-sedzia.php"|sha256sum|awk '{print $1}')" = 8f2c4fbf23f7b2c4198529bbce266ffc6e6d9ff8fdf022273bc3594a0064cfda
test "$(grep -Fc mt91-admin.php "$web/panel.php")" = 1
test "$(grep -Fc mt91-sedzia.php "$web/panel.php")" = 1
mkdir -m 700 "$stage";mkdir -m 700 "$stage/previous"
cp -p "$web/index.html" "$web/panel.php" "$stage/previous/"
echo MT92_PREFLIGHT_MT91_VERIFIED_PREVIOUS_INDEX_AND_PANEL_BACKED_UP
PRE
sshpass -e scp $opts matchthis/mt92-release/MatchThis_MT-92*.html "$remote:matchthis-independent/mt92-mobile-20261118/"
sshpass -e ssh $opts "$remote" 'bash -s' <<'APPLY'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt92-mobile-20261118"
switched=0
restore_on_error(){
 status=$?
 trap - EXIT
 if [ "$status" -ne 0 ] && [ "$switched" = 1 ];then
  cp -p "$stage/previous/panel.php" "$web/panel.php.next.mt92rollback"
  mv -f "$web/panel.php.next.mt92rollback" "$web/panel.php"
  cp -p "$stage/previous/index.html" "$web/index.html.next.mt92rollback"
  mv -f "$web/index.html.next.mt92rollback" "$web/index.html"
  echo MT92_AUTO_ROLLBACK_TO_MT91
 fi
 exit "$status"
}
trap restore_on_error EXIT
for item in 'MatchThis_MT-92.html:6f00c1717e3a500e052a4f667630ecf17e454c1327365ed081b33ded73184fd7' 'MatchThis_MT-92_OGLADACZ.html:49960517aeabfaa132c8072466f300ca719b5db652e9e4c4c69a5058c0739316' 'MatchThis_MT-92_SEDZIA.html:6b4866d0719be45fccb2e94f4fcf8bf94bdb775a327e7ed70277957086e920ec'; do
 file="$(printf '%s' "$item"|cut -d: -f1)"
 hash="$(printf '%s' "$item"|cut -d: -f2)"
 test "$(sha256sum "$stage/$file"|awk '{print $1}')" = "$hash"
done
for role in admin sedzia;do
 src="$stage/MatchThis_MT-92.html"
 test "$role" = sedzia && src="$stage/MatchThis_MT-92_SEDZIA.html"
 { echo '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$src"; } > "$stage/mt92-$role.php"
 php -l "$stage/mt92-$role.php" >/dev/null
done
sed -e 's/mt91-admin.php/mt92-admin.php/' -e 's/mt91-sedzia.php/mt92-sedzia.php/' "$stage/previous/panel.php" > "$stage/panel92.php"
php -l "$stage/panel92.php" >/dev/null
for role in admin sedzia;do
 cp -p "$stage/mt92-$role.php" "$web/role-pages/mt92-$role.php.next"
 mv -f "$web/role-pages/mt92-$role.php.next" "$web/role-pages/mt92-$role.php"
done
switched=1
cp -p "$stage/panel92.php" "$web/panel.php.next.mt92"
mv -f "$web/panel.php.next.mt92" "$web/panel.php"
cp -p "$stage/MatchThis_MT-92_OGLADACZ.html" "$web/index.html.next.mt92"
mv -f "$web/index.html.next.mt92" "$web/index.html"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = 49960517aeabfaa132c8072466f300ca719b5db652e9e4c4c69a5058c0739316
php -l "$web/panel.php" >/dev/null
test "$(grep -Fc mt92-admin.php "$web/panel.php")" = 1
test "$(grep -Fc mt92-sedzia.php "$web/panel.php")" = 1
echo MT92_UI_ONLY_DEPLOYED_SMALL2_MT91_BACKUP_PRESENT
APPLY
