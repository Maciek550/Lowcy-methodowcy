#!/usr/bin/env bash
# MT91: UI-only guarded SMALL2 release; no database, users, sessions or results writes.
set -Eeuo pipefail
test -n "$SSH_PASSWORD"
for suffix in '' '_OGLADACZ' '_SEDZIA'; do
 test -s "matchthis/mt91-release/MatchThis_MT-91$suffix.html"
done
test "$(sha256sum matchthis/mt91-release/MatchThis_MT-91.html|cut -d' ' -f1)" = d40ede0022d7c44fb98289dc631810de2cef6a8955437fbf473ec56b1ce9a69b
test "$(sha256sum matchthis/mt91-release/MatchThis_MT-91_OGLADACZ.html|cut -d' ' -f1)" = ba7521d6877d9d0552a315c655ea4fd3175827df02c8f4e65f43c5df6222e2d4
test "$(sha256sum matchthis/mt91-release/MatchThis_MT-91_SEDZIA.html|cut -d' ' -f1)" = 8f2c4fbf23f7b2c4198529bbce266ffc6e6d9ff8fdf022273bc3594a0064cfda
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
stage="$HOME/matchthis-independent/mt91-mobile-20261118"
test -d "$web" && test ! -e "$stage"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = f8cb9863a81091ec556b497244db9d3300dc4023c5626c8bc32130929356f184
test "$(tail -n +2 "$web/role-pages/mt90-admin.php"|sha256sum|awk '{print $1}')" = 694c7f36f02fb529372b99aa6de682634bccb9f42d3812c902030c199bf851a4
test "$(tail -n +2 "$web/role-pages/mt90-sedzia.php"|sha256sum|awk '{print $1}')" = 980206818cdc5bc8b50db8f0e4b3d22965c689a1c26c0da1a7b5fa27a50c82b3
test "$(grep -Fc mt90-admin.php "$web/panel.php")" = 1
test "$(grep -Fc mt90-sedzia.php "$web/panel.php")" = 1
mkdir -m 700 "$stage";mkdir -m 700 "$stage/previous"
cp -p "$web/index.html" "$web/panel.php" "$stage/previous/"
echo MT91_PREFLIGHT_MT90_VERIFIED_PREVIOUS_INDEX_AND_PANEL_BACKED_UP
PRE
sshpass -e scp $opts matchthis/mt91-release/MatchThis_MT-91*.html "$remote:matchthis-independent/mt91-mobile-20261118/"
sshpass -e ssh $opts "$remote" 'bash -s' <<'APPLY'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt91-mobile-20261118"
switched=0
restore_on_error(){
 status=$?
 trap - EXIT
 if [ "$status" -ne 0 ] && [ "$switched" = 1 ];then
  cp -p "$stage/previous/panel.php" "$web/panel.php.next.mt91rollback"
  mv -f "$web/panel.php.next.mt91rollback" "$web/panel.php"
  cp -p "$stage/previous/index.html" "$web/index.html.next.mt91rollback"
  mv -f "$web/index.html.next.mt91rollback" "$web/index.html"
  echo MT91_AUTO_ROLLBACK_TO_MT90
 fi
 exit "$status"
}
trap restore_on_error EXIT
for item in 'MatchThis_MT-91.html:d40ede0022d7c44fb98289dc631810de2cef6a8955437fbf473ec56b1ce9a69b' 'MatchThis_MT-91_OGLADACZ.html:ba7521d6877d9d0552a315c655ea4fd3175827df02c8f4e65f43c5df6222e2d4' 'MatchThis_MT-91_SEDZIA.html:8f2c4fbf23f7b2c4198529bbce266ffc6e6d9ff8fdf022273bc3594a0064cfda'; do
 file="$(printf '%s' "$item"|cut -d: -f1)"
 hash="$(printf '%s' "$item"|cut -d: -f2)"
 test "$(sha256sum "$stage/$file"|awk '{print $1}')" = "$hash"
done
for role in admin sedzia;do
 src="$stage/MatchThis_MT-91.html"
 test "$role" = sedzia && src="$stage/MatchThis_MT-91_SEDZIA.html"
 { echo '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$src"; } > "$stage/mt91-$role.php"
 php -l "$stage/mt91-$role.php" >/dev/null
done
sed -e 's/mt90-admin.php/mt91-admin.php/' -e 's/mt90-sedzia.php/mt91-sedzia.php/' "$stage/previous/panel.php" > "$stage/panel91.php"
php -l "$stage/panel91.php" >/dev/null
for role in admin sedzia;do
 cp -p "$stage/mt91-$role.php" "$web/role-pages/mt91-$role.php.next"
 mv -f "$web/role-pages/mt91-$role.php.next" "$web/role-pages/mt91-$role.php"
done
switched=1
cp -p "$stage/panel91.php" "$web/panel.php.next.mt91"
mv -f "$web/panel.php.next.mt91" "$web/panel.php"
cp -p "$stage/MatchThis_MT-91_OGLADACZ.html" "$web/index.html.next.mt91"
mv -f "$web/index.html.next.mt91" "$web/index.html"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = ba7521d6877d9d0552a315c655ea4fd3175827df02c8f4e65f43c5df6222e2d4
php -l "$web/panel.php" >/dev/null
test "$(grep -Fc mt91-admin.php "$web/panel.php")" = 1
test "$(grep -Fc mt91-sedzia.php "$web/panel.php")" = 1
echo MT91_UI_ONLY_DEPLOYED_SMALL2_MT90_BACKUP_PRESENT
APPLY
