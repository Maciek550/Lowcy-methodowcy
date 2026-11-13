#!/usr/bin/env bash
# Re-activate already installed/verified MT75 routes only; do NOT alter server state.
set -Eeuo pipefail
test -n "${SSH_PASSWORD:-}" || exit 2
mode="${1:-activate}"
test "$mode" = activate || test "$mode" = rollback
sudo apt-get -qq update
sudo apt-get -qq install -y sshpass
mkdir -p "$HOME/.ssh";chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256 | awk '{print $2}')" = 'SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8'
export SSHPASS="$SSH_PASSWORD"
opts=(-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15)
remote=lowcymethodowcy@s3.small.pl
if test "$mode" = rollback;then
 sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'RB'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
old="$HOME/matchthis-independent/mt-75/rollback-mt74"
test "$(sha256sum "$old/index.html"|awk '{print $1}')" = 2595a4fad3fa4a2b5457a345e65f896171b4ca95578d246ec0e599ad537aa4a6
cp -p "$old/panel.php" "$web/panel.php.rollback.next"
mv -f "$web/panel.php.rollback.next" "$web/panel.php"
cp -p "$old/index.html" "$web/index.html.rollback.next"
mv -f "$web/index.html.rollback.next" "$web/index.html"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = 2595a4fad3fa4a2b5457a345e65f896171b4ca95578d246ec0e599ad537aa4a6
echo MT75_ROLLBACK_MT74_ROUTES_SERVER_DATA_PRESERVED
RB
 exit
fi
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'ACT'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-75"
old="$stage/rollback-mt74"
sha(){ sha256sum "$1" | awk '{print $1}'; }
test -f "$stage/DEPLOYED" && test -f "$stage/panel.php" && test -f "$old/panel.php"
test "$(sha "$web/index.html")" = 2595a4fad3fa4a2b5457a345e65f896171b4ca95578d246ec0e599ad537aa4a6
test "$(sha "$old/index.html")" = 2595a4fad3fa4a2b5457a345e65f896171b4ca95578d246ec0e599ad537aa4a6
cmp -s "$web/panel.php" "$old/panel.php"
cmp -s "$web/.mt41-private/mt60-published-draws.json" "$old/mt60-published-draws.json"
test "$(sha "$stage/MatchThis_MT-75_OGLADACZ.html")" = db6b74cb6bbe139efac93197842ae3da97131b7af486b586e88408e39455875a
test "$(tail -n +2 "$web/role-pages/mt75-admin.php"|sha256sum|awk '{print $1}')" = bffd09ff07c8771ff3a359f180d0b4fe930295bc3a10f079b5ecbf27a711fac0
test "$(tail -n +2 "$web/role-pages/mt75-sedzia.php"|sha256sum|awk '{print $1}')" = d7c9e4ef9737f9651fe1c7697aa9eed69647235b19a81e6252b1756a42cf5147
test -f "$web/mt73-state.php" && test -f "$web/mt73-store.php"
test -f "$web/.mt41-private/state-mt73.json"
python3 - "$web" <<'PY'
import pathlib,sys,json
w=pathlib.Path(sys.argv[1])
state=json.loads((w/'.mt41-private/state-mt73.json').read_text(encoding='utf8'))
assert state['revision']>=1
db=state['data'];e=next(e for e in db['events'] if e['id']=='mt2025-mega_final_2025')
rows=e['rounds'][1]['results']
assert len(rows)==54 and all(x.get('sector') and x.get('peg') for x in rows)
assert len({x['peg'] for x in rows})==54
print('MT75_RESUME_READONLY_STATE_54_VERIFIED')
PY
test ! -L "$web/index.html" && test ! -L "$web/panel.php"
cp -p "$stage/panel.php" "$web/panel.php.next"
mv -f "$web/panel.php.next" "$web/panel.php"
cp -p "$stage/MatchThis_MT-75_OGLADACZ.html" "$web/index.html.next"
mv -f "$web/index.html.next" "$web/index.html"
test "$(sha "$web/index.html")" = db6b74cb6bbe139efac93197842ae3da97131b7af486b586e88408e39455875a
grep -Fq 'mt75-admin.php' "$web/panel.php"
grep -Fq 'mt75-sedzia.php' "$web/panel.php"
php -l "$web/panel.php" >/dev/null
echo MT75_REACTIVATED_ONLY_VIEWER_AND_AUTH_ROUTER_SERVER_STATE_UNCHANGED
ACT
url=https://matchthis.lowcymethodowcy.smallhost.pl
curl -fsSL --max-time 30 "$url/" -o /tmp/mt75-reactivated.html
test "$(sha256sum /tmp/mt75-reactivated.html|awk '{print $1}')" = db6b74cb6bbe139efac93197842ae3da97131b7af486b586e88408e39455875a
curl -fsSL --max-time 30 "$url/mt73-state.php?public=1" -o /tmp/mt75-reactivated-state.json
node -e 'let d=require("/tmp/mt75-reactivated-state.json");let r=d.data.events.find(e=>e.id==="mt2025-mega_final_2025").rounds[1].results;if(r.length!==54||r.some(x=>!x.peg||!x.sector))process.exit(1);console.log("MT75_RESUMED_PUBLIC_SERVER_54_PASS")'
test "$(curl -sS -o /dev/null -w '%{http_code}' "$url/mt73-state.php")" = 401
test "$(curl -sS -o /dev/null -w '%{http_code}' "$url/panel.php")" = 303
echo MT75_PUBLIC_HTTP_ROLE_AND_STATE_CHECK_PASS
