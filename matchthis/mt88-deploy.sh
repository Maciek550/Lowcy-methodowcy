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
site=https://matchthis.lowcymethodowcy.smallhost.pl
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'PRE'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt88-bartczak-20261117"
sha(){ sha256sum "$1"|awk '{print $1}'; }
test "$(sha "$web/index.html")" = 9760f55cb81ae0d0880163b98d8b29d2d5ea24ab271eb6cea0187e09faa1fba8
test "$(tail -n +2 "$web/role-pages/mt87-admin.php"|sha256sum|awk '{print $1}')" = 2083bdf2e972655cd2be0e5fccf56eddd64f7577931814419335715de159750e
test "$(tail -n +2 "$web/role-pages/mt87-sedzia.php"|sha256sum|awk '{print $1}')" = 141723803fb20133d94ad416232e987b791a260af86a057dcee23168dc314433
test "$(grep -Fc mt87-admin.php "$web/panel.php")" = 1
test "$(grep -Fc mt87-sedzia.php "$web/panel.php")" = 1
test ! -e "$stage"
test -f "$web/.mt41-private/state-mt73.json"
test ! -L "$web/.mt41-private/state-mt73.json"
test -f "$web/.mt41-private/users.php"
mkdir -m 700 "$stage"
cp -p "$web/index.html" "$stage/prior-index.html"
cp -p "$web/panel.php" "$stage/prior-panel.php"
sha "$web/.mt41-private/users.php" > "$stage/untouched-users.sha"
echo MT88_PRECHECK_PREVIOUS_MT87_BACKUP_PASS
PRE
sshpass -e scp "${opts[@]}" matchthis/MatchThis_MT-88*.html matchthis/mt88-state-correct.php "$remote:matchthis-independent/mt88-bartczak-20261117/"
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'INSTALL'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt88-bartczak-20261117"
sha(){ sha256sum "$1"|awk '{print $1}'; }
test "$(sha "$web/index.html")" = 9760f55cb81ae0d0880163b98d8b29d2d5ea24ab271eb6cea0187e09faa1fba8
test "$(sha "$stage/MatchThis_MT-88.html")" = b0a603fde6ae0fa9feb7f3a410394d56a3a881ce3d60cdd3dafa7bcf8328e9c7
test "$(sha "$stage/MatchThis_MT-88_OGLADACZ.html")" = 1e990e680c7138c06df5e197d4d8dcadb40289af351c703ace893acb9e372b92
test "$(sha "$stage/MatchThis_MT-88_SEDZIA.html")" = 2b2ba6f2d6381ad0704bc006d62fb66fa5adac8689a54faf74f30383d35be090
for role in admin sedzia;do
 src="$stage/MatchThis_MT-88.html"
 if test "$role" = sedzia;then src="$stage/MatchThis_MT-88_SEDZIA.html";fi
 { printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$src"; } > "$stage/mt88-$role.php"
 php -l "$stage/mt88-$role.php" >/dev/null
done
python3 - "$stage/prior-panel.php" "$stage/new-panel.php" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text('utf8')
for old,new in [('mt87-admin.php','mt88-admin.php'),('mt87-sedzia.php','mt88-sedzia.php')]:
 assert s.count(old)==1,(old,s.count(old))
 s=s.replace(old,new)
Path(sys.argv[2]).write_text(s,'utf8')
PY
php -l "$stage/new-panel.php" >/dev/null
php "$stage/mt88-state-correct.php"
changed=0
restore(){
 if test "$changed" = 1;then
  cp -p "$stage/prior-index.html" "$web/index.html.next";mv -f "$web/index.html.next" "$web/index.html"
  cp -p "$stage/prior-panel.php" "$web/panel.php.next";mv -f "$web/panel.php.next" "$web/panel.php"
  echo MT88_UI_RESTORED_MT87_CORRECTED_DATABASE_PRESERVED
 fi
}
trap restore ERR
changed=1
for role in admin sedzia;do
 cp -p "$stage/mt88-$role.php" "$web/role-pages/mt88-$role.php.next"
 mv -f "$web/role-pages/mt88-$role.php.next" "$web/role-pages/mt88-$role.php"
done
cp -p "$stage/new-panel.php" "$web/panel.php.next";mv -f "$web/panel.php.next" "$web/panel.php"
cp -p "$stage/MatchThis_MT-88_OGLADACZ.html" "$web/index.html.next";mv -f "$web/index.html.next" "$web/index.html"
test "$(sha "$web/index.html")" = 1e990e680c7138c06df5e197d4d8dcadb40289af351c703ace893acb9e372b92
test "$(tail -n +2 "$web/role-pages/mt88-admin.php"|sha256sum|awk '{print $1}')" = b0a603fde6ae0fa9feb7f3a410394d56a3a881ce3d60cdd3dafa7bcf8328e9c7
test "$(tail -n +2 "$web/role-pages/mt88-sedzia.php"|sha256sum|awk '{print $1}')" = 2b2ba6f2d6381ad0704bc006d62fb66fa5adac8689a54faf74f30383d35be090
test "$(sha "$web/.mt41-private/users.php")" = "$(cat "$stage/untouched-users.sha")"
test -f "$stage/before-state-mt73.json"
trap - ERR
echo MT88_SERVER_DATA_HTML_AUTH_UNCHANGED_PASS
INSTALL
curl -fLsS --max-time 30 "$site/" -o /tmp/mt88-live.html
test "$(sha256sum /tmp/mt88-live.html|awk '{print $1}')" = 1e990e680c7138c06df5e197d4d8dcadb40289af351c703ace893acb9e372b92
test "$(curl -sS -o /dev/null -w '%{http_code}' "$site/panel.php")" = 303
test "$(curl -sS -o /dev/null -w '%{http_code}' "$site/player-session.php")" = 200
curl -fLsS --max-time 30 "$site/mt73-state.php?public=1" -o /tmp/mt88-public.json
python3 - <<'PY'
import json
d=json.load(open('/tmp/mt88-public.json','rb'))
data=d['data'];blob=json.dumps(data,ensure_ascii=False)
assert 'BARCZAK JAN' not in blob
assert 'BARTCZAK JAN' in blob
print('MT88_LIVE_BARTCZAK_RESULTS_READBACK_PASS',len(data['players']),len(data['events']),len(data['cycles']))
PY
