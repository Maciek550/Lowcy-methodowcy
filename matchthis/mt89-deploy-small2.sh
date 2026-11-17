#!/usr/bin/env bash
set -Eeuo pipefail
test -n "$SSH_PASSWORD"
sudo apt-get -qq update && sudo apt-get -qq install -y sshpass
mkdir -p "$HOME/.ssh";chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256|awk '{print $2}')" = 'SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8'
export SSHPASS="$SSH_PASSWORD"
opts=(-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15)
remote=lowcymethodowcy@s3.small.pl
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'PRE'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt89-peil-20261117"
test ! -e "$stage"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = 1e990e680c7138c06df5e197d4d8dcadb40289af351c703ace893acb9e372b92
test "$(tail -n +2 "$web/role-pages/mt88-admin.php"|sha256sum|awk '{print $1}')" = b0a603fde6ae0fa9feb7f3a410394d56a3a881ce3d60cdd3dafa7bcf8328e9c7
test "$(tail -n +2 "$web/role-pages/mt88-sedzia.php"|sha256sum|awk '{print $1}')" = 2b2ba6f2d6381ad0704bc006d62fb66fa5adac8689a54faf74f30383d35be090
test "$(grep -Fc mt88-admin.php "$web/panel.php")" = 1
test "$(grep -Fc mt88-sedzia.php "$web/panel.php")" = 1
mkdir -m 700 "$stage";mkdir -m 700 "$stage/previous"
cp -p "$web/index.html" "$web/panel.php" "$stage/previous/"
cp -p "$web/role-pages/mt88-admin.php" "$web/role-pages/mt88-sedzia.php" "$stage/previous/"
cp -p "$web/.mt41-private/state-mt73.json" "$web/.mt41-private/users.php" "$stage/previous/"
echo MT89_PRIOR_MT88_AND_DATABASE_BACKED_UP
PRE
sshpass -e scp "${opts[@]}" matchthis/mt89-release/MatchThis_MT-89*.html matchthis/mt89-peil-merge.php "$remote:matchthis-independent/mt89-peil-20261117/"
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'APPLY'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt89-peil-20261117"
test "$(sha256sum "$stage/MatchThis_MT-89.html"|awk '{print $1}')" = a66509aaac44ae63a496644ac045c20f7a12e69a59a6145c4ce7f7e93d96be5e
test "$(sha256sum "$stage/MatchThis_MT-89_OGLADACZ.html"|awk '{print $1}')" = acef7ad0a0d7eb75b02cb06d92a139be7a49c5042e6b9311ea6230e14c1d8a83
test "$(sha256sum "$stage/MatchThis_MT-89_SEDZIA.html"|awk '{print $1}')" = 4dd762b306658585bb290136ca1828e1c9c40bb7967a62daeecbe202b6498a70
php -l "$stage/mt89-peil-merge.php" >/dev/null
php "$stage/mt89-peil-merge.php" check
for role in admin sedzia;do
 src="$stage/MatchThis_MT-89.html"
 test "$role" = sedzia && src="$stage/MatchThis_MT-89_SEDZIA.html"
 { echo '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$src"; } > "$stage/mt89-$role.php"
 php -l "$stage/mt89-$role.php" >/dev/null
done
sed -e 's/mt88-admin.php/mt89-admin.php/' -e 's/mt88-sedzia.php/mt89-sedzia.php/' "$stage/previous/panel.php" > "$stage/panel89.php"
php -l "$stage/panel89.php" >/dev/null
php "$stage/mt89-peil-merge.php" apply
php "$stage/mt89-peil-merge.php" verify
for role in admin sedzia;do
 cp -p "$stage/mt89-$role.php" "$web/role-pages/mt89-$role.php.next"
 mv -f "$web/role-pages/mt89-$role.php.next" "$web/role-pages/mt89-$role.php"
done
cp -p "$stage/panel89.php" "$web/panel.php.next";mv -f "$web/panel.php.next" "$web/panel.php"
cp -p "$stage/MatchThis_MT-89_OGLADACZ.html" "$web/index.html.next";mv -f "$web/index.html.next" "$web/index.html"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = acef7ad0a0d7eb75b02cb06d92a139be7a49c5042e6b9311ea6230e14c1d8a83
cmp "$stage/previous/users.php" "$web/.mt41-private/users.php"
echo MT89_UI_PEIL_18_RESULTS_DEPLOYED_AUTH_UNCHANGED
APPLY
