#!/usr/bin/env bash
# MT94: UI-only guarded SMALL2 release; no database, users, sessions or results writes.
set -Eeuo pipefail
test -n "$SSH_PASSWORD"
for suffix in '' '_OGLADACZ' '_SEDZIA'; do
 test -s "matchthis/mt94-release/MatchThis_MT-94$suffix.html"
done
test "$(sha256sum matchthis/mt94-release/MatchThis_MT-94.html|cut -d' ' -f1)" = 85f053e24c4181714c574aa42494042eacfa64d12de7689b2b1b38042d0731b0
test "$(sha256sum matchthis/mt94-release/MatchThis_MT-94_OGLADACZ.html|cut -d' ' -f1)" = 377cde541531feb53843d424b3e5b638aa146f561a6fb0af08430797a957f946
test "$(sha256sum matchthis/mt94-release/MatchThis_MT-94_SEDZIA.html|cut -d' ' -f1)" = 4c021912c08d01c3f6d7cd546388b09bbe5be1f5e0c783cb9ebdbbdf58de77e8
sudo apt-get -qq update && sudo apt-get -qq install -y sshpass
mkdir -p "$HOME/.ssh";chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256|awk '{print $2}')" = 'SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8'
export SSHPASS="$SSH_PASSWORD"
opts='-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15'
remote=lowcymethodowcy@s3.small.pl
if [ "$1" = rollback ];then
 sshpass -e ssh $opts "$remote" 'bash -s' <<'RB'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt94-bream-20261118"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = 377cde541531feb53843d424b3e5b638aa146f561a6fb0af08430797a957f946
test "$(sha256sum "$stage/previous/index.html"|awk '{print $1}')" = d685396a243d55bf56ea18580144b2909d31544e5af81f012bc786c33384de9e
cp -p "$stage/previous/panel.php" "$web/panel.php.next.mt94rollback";mv -f "$web/panel.php.next.mt94rollback" "$web/panel.php"
cp -p "$stage/previous/index.html" "$web/index.html.next.mt94rollback";mv -f "$web/index.html.next.mt94rollback" "$web/index.html"
if test -f "$stage/previous/favicon.ico";then cp -p "$stage/previous/favicon.ico" "$web/favicon.ico.next.mt94rollback";mv -f "$web/favicon.ico.next.mt94rollback" "$web/favicon.ico";else rm -f "$web/favicon.ico";fi
php -l "$web/panel.php" >/dev/null
echo MT94_ROLLBACK_TO_MT93_UI_AND_ICON_NO_DATABASE_CHANGES
RB
 exit 0
fi
(cd matchthis/mt94-release && sha256sum MatchThis_MT-94*.html matchthis-mt94-*.png matchthis-mt94.webmanifest favicon.ico) > /tmp/mt94-release-checksums.sha256
sshpass -e ssh $opts "$remote" 'bash -s' <<'PRE'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt94-bream-20261118"
test -d "$web" && test ! -e "$stage"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = d685396a243d55bf56ea18580144b2909d31544e5af81f012bc786c33384de9e
test "$(tail -n +2 "$web/role-pages/mt93-admin.php"|sha256sum|awk '{print $1}')" = a73377ce9efc974543f8f67d43098001d002250eb8b0c0cb12e69d3e4bb29700
test "$(tail -n +2 "$web/role-pages/mt93-sedzia.php"|sha256sum|awk '{print $1}')" = 118673fee882c13090d1f1bf00a210d8a514e80d1d2931542225fd97734bdfb2
test "$(grep -Fc mt93-admin.php "$web/panel.php")" = 1
test "$(grep -Fc mt93-sedzia.php "$web/panel.php")" = 1
test -f "$web/.mt41-private/state-mt73.json" && test -f "$web/.mt41-private/mt60-published-draws.json"
for n in 16 32 48 64 180 192 512 maskable-512;do test ! -e "$web/matchthis-mt94-$n.png";done
test ! -e "$web/matchthis-mt94.webmanifest"
mkdir -m 700 "$stage";mkdir -m 700 "$stage/previous"
cp -p "$web/index.html" "$web/panel.php" "$stage/previous/"
if test -f "$web/favicon.ico";then cp -p "$web/favicon.ico" "$stage/previous/";fi
cp -p "$web/.mt41-private/state-mt73.json" "$web/.mt41-private/mt60-published-draws.json" "$stage/previous/"
echo MT94_PREFLIGHT_MT93_VERIFIED_PREVIOUS_INDEX_AND_PANEL_BACKED_UP
PRE
sshpass -e scp $opts matchthis/mt94-release/MatchThis_MT-94*.html matchthis/mt94-release/matchthis-mt94-*.png matchthis/mt94-release/matchthis-mt94.webmanifest matchthis/mt94-release/favicon.ico /tmp/mt94-release-checksums.sha256 "$remote:matchthis-independent/mt94-bream-20261118/"
sshpass -e ssh $opts "$remote" 'bash -s' <<'APPLY'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt94-bream-20261118"
switched=0
restore_on_error(){
 status=$?
 trap - EXIT
 if [ "$status" -ne 0 ] && [ "$switched" = 1 ];then
  cp -p "$stage/previous/panel.php" "$web/panel.php.next.mt94rollback"
  mv -f "$web/panel.php.next.mt94rollback" "$web/panel.php"
  cp -p "$stage/previous/index.html" "$web/index.html.next.mt94rollback"
  mv -f "$web/index.html.next.mt94rollback" "$web/index.html"
  if test -f "$stage/previous/favicon.ico";then cp -p "$stage/previous/favicon.ico" "$web/favicon.ico.next.mt94rollback";mv -f "$web/favicon.ico.next.mt94rollback" "$web/favicon.ico";else rm -f "$web/favicon.ico";fi
  echo MT94_AUTO_ROLLBACK_TO_MT93
 fi
 exit "$status"
}
trap restore_on_error EXIT
(cd "$stage" && sha256sum -c mt94-release-checksums.sha256 >/dev/null)
for item in 'MatchThis_MT-94.html:85f053e24c4181714c574aa42494042eacfa64d12de7689b2b1b38042d0731b0' 'MatchThis_MT-94_OGLADACZ.html:377cde541531feb53843d424b3e5b638aa146f561a6fb0af08430797a957f946' 'MatchThis_MT-94_SEDZIA.html:4c021912c08d01c3f6d7cd546388b09bbe5be1f5e0c783cb9ebdbbdf58de77e8'; do
 file="$(printf '%s' "$item"|cut -d: -f1)"
 hash="$(printf '%s' "$item"|cut -d: -f2)"
 test "$(sha256sum "$stage/$file"|awk '{print $1}')" = "$hash"
done
for role in admin sedzia;do
 src="$stage/MatchThis_MT-94.html"
 test "$role" = sedzia && src="$stage/MatchThis_MT-94_SEDZIA.html"
 { echo '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$src"; } > "$stage/mt94-$role.php"
 php -l "$stage/mt94-$role.php" >/dev/null
done
sed -e 's/mt93-admin.php/mt94-admin.php/' -e 's/mt93-sedzia.php/mt94-sedzia.php/' "$stage/previous/panel.php" > "$stage/panel94.php"
php -l "$stage/panel94.php" >/dev/null
for role in admin sedzia;do
 cp -p "$stage/mt94-$role.php" "$web/role-pages/mt94-$role.php.next"
 mv -f "$web/role-pages/mt94-$role.php.next" "$web/role-pages/mt94-$role.php"
done
switched=1
for icon in "$stage"/matchthis-mt94-*.png "$stage"/matchthis-mt94.webmanifest;do
 name="$(basename "$icon")"
 cp -p "$icon" "$web/$name.next.mt94"
 chmod 644 "$web/$name.next.mt94"
 mv -f "$web/$name.next.mt94" "$web/$name"
done
cp -p "$stage/favicon.ico" "$web/favicon.ico.next.mt94"
chmod 644 "$web/favicon.ico.next.mt94"
mv -f "$web/favicon.ico.next.mt94" "$web/favicon.ico"
cp -p "$stage/panel94.php" "$web/panel.php.next.mt94"
mv -f "$web/panel.php.next.mt94" "$web/panel.php"
cp -p "$stage/MatchThis_MT-94_OGLADACZ.html" "$web/index.html.next.mt94"
mv -f "$web/index.html.next.mt94" "$web/index.html"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = 377cde541531feb53843d424b3e5b638aa146f561a6fb0af08430797a957f946
php -l "$web/panel.php" >/dev/null
test "$(grep -Fc mt94-admin.php "$web/panel.php")" = 1
test "$(grep -Fc mt94-sedzia.php "$web/panel.php")" = 1
cmp "$stage/previous/state-mt73.json" "$web/.mt41-private/state-mt73.json"
cmp "$stage/previous/mt60-published-draws.json" "$web/.mt41-private/mt60-published-draws.json"
echo MT94_BREAM_PWA_ICONS_DEPLOYED_SMALL2_MT93_BACKUP_DATA_IDENTICAL
APPLY
