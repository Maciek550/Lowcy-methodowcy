#!/usr/bin/env bash
# MT95: UI-only update. Only index.html, panel.php, new guarded role-pages and manifest.
set -Eeuo pipefail
test -n "$SSH_PASSWORD" || { echo STOP_PASSWORD_MISSING;exit 2; }
test "$1" = deploy || test "$1" = rollback
dir=matchthis/mt95-release
test "$(sha256sum "$dir/MatchThis_MT-95.html"|cut -d' ' -f1)" = 683ce11d793cc9e9db0639758e8de1d3be1c115440d7f06caa32c09813653a61
test "$(sha256sum "$dir/MatchThis_MT-95_OGLADACZ.html"|cut -d' ' -f1)" = f94ae5af18ef0cedd6e70526dd2a796d771b23c0a34642e9007f3b127c9289c3
test "$(sha256sum "$dir/MatchThis_MT-95_SEDZIA.html"|cut -d' ' -f1)" = dceccf1bc9c7680e634c39ec99912384e179699518379c5429f47ad9b14adf93
test "$(sha256sum "$dir/matchthis-mt95.webmanifest"|cut -d' ' -f1)" = 89650fa9c18b977e95bccfa1453102645f228606b95009d492fea6fb216d01ae
sudo apt-get -qq update && sudo apt-get -qq install -y sshpass
mkdir -p "$HOME/.ssh";chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256|awk '{print $2}')" = SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8
export SSHPASS="$SSH_PASSWORD"
opts='-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15'
remote=lowcymethodowcy@s3.small.pl
if test "$1" = rollback; then
 sshpass -e ssh $opts "$remote" 'bash -s' <<'RB'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt95-mobile-20261119"
test "$(sha256sum "$stage/previous/index.html"|awk '{print $1}')" = 377cde541531feb53843d424b3e5b638aa146f561a6fb0af08430797a957f946
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = f94ae5af18ef0cedd6e70526dd2a796d771b23c0a34642e9007f3b127c9289c3
cp -p "$stage/previous/panel.php" "$web/panel.php.next.mt95rollback"
mv -f "$web/panel.php.next.mt95rollback" "$web/panel.php"
cp -p "$stage/previous/index.html" "$web/index.html.next.mt95rollback"
mv -f "$web/index.html.next.mt95rollback" "$web/index.html"
php -l "$web/panel.php" >/dev/null
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = 377cde541531feb53843d424b3e5b638aa146f561a6fb0af08430797a957f946
echo MT95_ROLLBACK_UI_TO_MT94_DATA_UNCHANGED
RB
 exit
fi
sshpass -e ssh $opts "$remote" 'bash -s' <<'PRE'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt95-mobile-20261119"
test -d "$web" && test ! -e "$stage"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = 377cde541531feb53843d424b3e5b638aa146f561a6fb0af08430797a957f946
test "$(tail -n +2 "$web/role-pages/mt94-admin.php"|sha256sum|awk '{print $1}')" = 85f053e24c4181714c574aa42494042eacfa64d12de7689b2b1b38042d0731b0
test "$(tail -n +2 "$web/role-pages/mt94-sedzia.php"|sha256sum|awk '{print $1}')" = 4c021912c08d01c3f6d7cd546388b09bbe5be1f5e0c783cb9ebdbbdf58de77e8
test "$(grep -Fc mt94-admin.php "$web/panel.php")" = 1
test "$(grep -Fc mt94-sedzia.php "$web/panel.php")" = 1
test -f "$web/.mt41-private/state-mt73.json"
test -f "$web/.mt41-private/mt60-published-draws.json"
test ! -e "$web/matchthis-mt95.webmanifest"
test ! -L "$web/index.html" && test ! -L "$web/panel.php"
mkdir -m 700 "$stage";mkdir -m 700 "$stage/previous"
cp -p "$web/index.html" "$web/panel.php" "$stage/previous/"
cp -p "$web/.mt41-private/state-mt73.json" "$web/.mt41-private/mt60-published-draws.json" "$stage/previous/"
echo MT95_GUARDED_MT94_BASE_AND_BACKUP_PASS
PRE
sshpass -e scp $opts "$dir/MatchThis_MT-95.html" "$dir/MatchThis_MT-95_OGLADACZ.html" "$dir/MatchThis_MT-95_SEDZIA.html" "$dir/matchthis-mt95.webmanifest" "$remote:matchthis-independent/mt95-mobile-20261119/"
sshpass -e ssh $opts "$remote" 'bash -s' <<'APPLY'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt95-mobile-20261119"
switched=0
restore_on_error(){
 status=$?
 trap - EXIT
 if test "$status" -ne 0 && test "$switched" = 1;then
  cp -p "$stage/previous/panel.php" "$web/panel.php.next.mt95rollback"
  mv -f "$web/panel.php.next.mt95rollback" "$web/panel.php"
  cp -p "$stage/previous/index.html" "$web/index.html.next.mt95rollback"
  mv -f "$web/index.html.next.mt95rollback" "$web/index.html"
  echo MT95_AUTO_ROLLBACK_TO_MT94
 fi
 exit "$status"
}
trap restore_on_error EXIT
test "$(sha256sum "$stage/MatchThis_MT-95.html"|cut -d' ' -f1)" = 683ce11d793cc9e9db0639758e8de1d3be1c115440d7f06caa32c09813653a61
test "$(sha256sum "$stage/MatchThis_MT-95_OGLADACZ.html"|cut -d' ' -f1)" = f94ae5af18ef0cedd6e70526dd2a796d771b23c0a34642e9007f3b127c9289c3
test "$(sha256sum "$stage/MatchThis_MT-95_SEDZIA.html"|cut -d' ' -f1)" = dceccf1bc9c7680e634c39ec99912384e179699518379c5429f47ad9b14adf93
test "$(sha256sum "$stage/matchthis-mt95.webmanifest"|cut -d' ' -f1)" = 89650fa9c18b977e95bccfa1453102645f228606b95009d492fea6fb216d01ae
for role in admin sedzia;do
 src="$stage/MatchThis_MT-95.html"
 test "$role" = sedzia && src="$stage/MatchThis_MT-95_SEDZIA.html"
 { echo '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$src"; } > "$stage/mt95-$role.php"
 php -l "$stage/mt95-$role.php" >/dev/null
done
sed -e 's/mt94-admin.php/mt95-admin.php/' -e 's/mt94-sedzia.php/mt95-sedzia.php/' "$stage/previous/panel.php" > "$stage/panel95.php"
php -l "$stage/panel95.php" >/dev/null
for role in admin sedzia;do
 cp -p "$stage/mt95-$role.php" "$web/role-pages/mt95-$role.php.next"
 mv -f "$web/role-pages/mt95-$role.php.next" "$web/role-pages/mt95-$role.php"
done
cp -p "$stage/matchthis-mt95.webmanifest" "$web/matchthis-mt95.webmanifest.next"
chmod 644 "$web/matchthis-mt95.webmanifest.next"
mv -f "$web/matchthis-mt95.webmanifest.next" "$web/matchthis-mt95.webmanifest"
switched=1
cp -p "$stage/panel95.php" "$web/panel.php.next.mt95"
mv -f "$web/panel.php.next.mt95" "$web/panel.php"
cp -p "$stage/MatchThis_MT-95_OGLADACZ.html" "$web/index.html.next.mt95"
mv -f "$web/index.html.next.mt95" "$web/index.html"
test "$(sha256sum "$web/index.html"|cut -d' ' -f1)" = f94ae5af18ef0cedd6e70526dd2a796d771b23c0a34642e9007f3b127c9289c3
php -l "$web/panel.php" >/dev/null
test "$(grep -Fc mt95-admin.php "$web/panel.php")" = 1
test "$(grep -Fc mt95-sedzia.php "$web/panel.php")" = 1
cmp "$stage/previous/state-mt73.json" "$web/.mt41-private/state-mt73.json"
cmp "$stage/previous/mt60-published-draws.json" "$web/.mt41-private/mt60-published-draws.json"
echo MT95_MOBILE_TOUR_BUTTONS_SMALL2_DEPLOYED_DATA_UNCHANGED
APPLY
