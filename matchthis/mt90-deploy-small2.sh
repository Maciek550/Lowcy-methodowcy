#!/usr/bin/env bash
# MT90: UI-only guarded SMALL2 release; no database, users, sessions or results writes.
set -Eeuo pipefail
test -n "$SSH_PASSWORD"
for suffix in '' '_OGLADACZ' '_SEDZIA'; do
 test -s "matchthis/mt90-release/MatchThis_MT-90$suffix.html"
done
test "$(sha256sum matchthis/mt90-release/MatchThis_MT-90.html|cut -d' ' -f1)" = 694c7f36f02fb529372b99aa6de682634bccb9f42d3812c902030c199bf851a4
test "$(sha256sum matchthis/mt90-release/MatchThis_MT-90_OGLADACZ.html|cut -d' ' -f1)" = f8cb9863a81091ec556b497244db9d3300dc4023c5626c8bc32130929356f184
test "$(sha256sum matchthis/mt90-release/MatchThis_MT-90_SEDZIA.html|cut -d' ' -f1)" = 980206818cdc5bc8b50db8f0e4b3d22965c689a1c26c0da1a7b5fa27a50c82b3
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
stage="$HOME/matchthis-independent/mt90-mobile-20261117"
test -d "$web" && test ! -e "$stage"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = acef7ad0a0d7eb75b02cb06d92a139be7a49c5042e6b9311ea6230e14c1d8a83
test "$(tail -n +2 "$web/role-pages/mt89-admin.php"|sha256sum|awk '{print $1}')" = a66509aaac44ae63a496644ac045c20f7a12e69a59a6145c4ce7f7e93d96be5e
test "$(tail -n +2 "$web/role-pages/mt89-sedzia.php"|sha256sum|awk '{print $1}')" = 4dd762b306658585bb290136ca1828e1c9c40bb7967a62daeecbe202b6498a70
test "$(grep -Fc mt89-admin.php "$web/panel.php")" = 1
test "$(grep -Fc mt89-sedzia.php "$web/panel.php")" = 1
mkdir -m 700 "$stage";mkdir -m 700 "$stage/previous"
cp -p "$web/index.html" "$web/panel.php" "$stage/previous/"
echo MT90_PREFLIGHT_MT89_VERIFIED_PREVIOUS_INDEX_AND_PANEL_BACKED_UP
PRE
sshpass -e scp $opts matchthis/mt90-release/MatchThis_MT-90*.html "$remote:matchthis-independent/mt90-mobile-20261117/"
sshpass -e ssh $opts "$remote" 'bash -s' <<'APPLY'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt90-mobile-20261117"
switched=0
restore_on_error(){
 status=$?
 trap - EXIT
 if [ "$status" -ne 0 ] && [ "$switched" = 1 ];then
  cp -p "$stage/previous/panel.php" "$web/panel.php.next.mt90rollback"
  mv -f "$web/panel.php.next.mt90rollback" "$web/panel.php"
  cp -p "$stage/previous/index.html" "$web/index.html.next.mt90rollback"
  mv -f "$web/index.html.next.mt90rollback" "$web/index.html"
  echo MT90_AUTO_ROLLBACK_TO_MT89
 fi
 exit "$status"
}
trap restore_on_error EXIT
for item in 'MatchThis_MT-90.html:694c7f36f02fb529372b99aa6de682634bccb9f42d3812c902030c199bf851a4' 'MatchThis_MT-90_OGLADACZ.html:f8cb9863a81091ec556b497244db9d3300dc4023c5626c8bc32130929356f184' 'MatchThis_MT-90_SEDZIA.html:980206818cdc5bc8b50db8f0e4b3d22965c689a1c26c0da1a7b5fa27a50c82b3'; do
 file="$(printf '%s' "$item"|cut -d: -f1)"
 hash="$(printf '%s' "$item"|cut -d: -f2)"
 test "$(sha256sum "$stage/$file"|awk '{print $1}')" = "$hash"
done
for role in admin sedzia;do
 src="$stage/MatchThis_MT-90.html"
 test "$role" = sedzia && src="$stage/MatchThis_MT-90_SEDZIA.html"
 { echo '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$src"; } > "$stage/mt90-$role.php"
 php -l "$stage/mt90-$role.php" >/dev/null
done
sed -e 's/mt89-admin.php/mt90-admin.php/' -e 's/mt89-sedzia.php/mt90-sedzia.php/' "$stage/previous/panel.php" > "$stage/panel90.php"
php -l "$stage/panel90.php" >/dev/null
for role in admin sedzia;do
 cp -p "$stage/mt90-$role.php" "$web/role-pages/mt90-$role.php.next"
 mv -f "$web/role-pages/mt90-$role.php.next" "$web/role-pages/mt90-$role.php"
done
switched=1
cp -p "$stage/panel90.php" "$web/panel.php.next.mt90"
mv -f "$web/panel.php.next.mt90" "$web/panel.php"
cp -p "$stage/MatchThis_MT-90_OGLADACZ.html" "$web/index.html.next.mt90"
mv -f "$web/index.html.next.mt90" "$web/index.html"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = f8cb9863a81091ec556b497244db9d3300dc4023c5626c8bc32130929356f184
php -l "$web/panel.php" >/dev/null
test "$(grep -Fc mt90-admin.php "$web/panel.php")" = 1
test "$(grep -Fc mt90-sedzia.php "$web/panel.php")" = 1
echo MT90_UI_ONLY_DEPLOYED_SMALL2_MT89_BACKUP_PRESENT
APPLY
