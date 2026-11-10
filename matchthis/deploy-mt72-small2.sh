#!/usr/bin/env bash
# MatchThis only: guarded, atomic MT70 -> MT72 HTML roles and panel router.
# No SQL, no publication writes; all prior production files backed up.
set -Eeuo pipefail
test -n "${SSH_PASSWORD:-}" || { echo SMALL2_SSH_PASSWORD_MISSING; exit 2; }
mode="${1:-deploy}"
test "$mode" = deploy || test "$mode" = rollback
if test "$mode" = deploy; then
  for role in '' '_OGLADACZ' '_SEDZIA'; do
    test -f "matchthis/MatchThis_MT-72$role.html"
  done
  test "$(sha256sum matchthis/MatchThis_MT-72.html | awk '{print $1}')" = 8bc8f99c4e6559cb123178aa4c0e017b6c3cc8772147d66b9ce9c37985bee660
  test "$(sha256sum matchthis/MatchThis_MT-72_OGLADACZ.html | awk '{print $1}')" = eea8eec389f8f4a586444765740965180a244a3b3a6833f5742e59681400a845
  test "$(sha256sum matchthis/MatchThis_MT-72_SEDZIA.html | awk '{print $1}')" = 0896badb55553196778b48a294439a32445aeb7a7b6140afff2ffdfc8d145fac
fi
sudo apt-get -qq update
sudo apt-get -qq install -y sshpass
mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"
ssh-keyscan -T 10 -t ed25519 s3.small.pl > "$HOME/.ssh/known_hosts" 2>/dev/null
test "$(ssh-keygen -lf "$HOME/.ssh/known_hosts" -E sha256 | awk '{print $2}')" = SHA256:mr4Xcr1WrWoINIWGI2KwI3c/KI94+L2hL4FVeCsphh8
export SSHPASS="$SSH_PASSWORD"
opts=(-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15)
remote=lowcymethodowcy@s3.small.pl
if test "$mode" = rollback; then
  sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'ROLLBACK'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
backup="$HOME/matchthis-independent/mt-72/rollback-mt70"
test -f "$backup/index.html" && test -f "$backup/panel.php"
current="$(sha256sum "$web/index.html" | awk '{print $1}')"
case "$current" in
  8bc8f99c4e6559cb123178aa4c0e017b6c3cc8772147d66b9ce9c37985bee660|eea8eec389f8f4a586444765740965180a244a3b3a6833f5742e59681400a845|ef6f8b5839f56f44fba6fff47eaf26d09714d7861ef7285199167dde94db9ee0) ;;
  *) echo STOP_UNEXPECTED_MATCHTHIS_VERSION;exit 7;;
esac
test "$(sha256sum "$backup/index.html" | awk '{print $1}')" = ef6f8b5839f56f44fba6fff47eaf26d09714d7861ef7285199167dde94db9ee0
cp -p "$backup/panel.php" "$web/panel.php.next.rollback"
mv -f "$web/panel.php.next.rollback" "$web/panel.php"
cp -p "$backup/index.html" "$web/index.html.next.rollback"
mv -f "$web/index.html.next.rollback" "$web/index.html"
php -l "$web/panel.php" >/dev/null
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = ef6f8b5839f56f44fba6fff47eaf26d09714d7861ef7285199167dde94db9ee0
rm -f "$HOME/matchthis-independent/mt-72/DEPLOYED"
echo MATCHTHIS_MT72_ROLLBACK_TO_MT70_VERIFIED
ROLLBACK
  exit
fi

# This flag becomes true just before writes; any later error rolls back the two live routes.
switched=0
auto_restore(){
  status=$?
  trap - EXIT
  if test "$status" != 0 && test "$switched" = 1; then
    echo MT72_AUTO_ROLLBACK_START
    sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'RB' || echo MT72_AUTO_ROLLBACK_REMOTE_FAILED
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
backup="$HOME/matchthis-independent/mt-72/rollback-mt70"
test -f "$backup/index.html" && test -f "$backup/panel.php"
cp -p "$backup/panel.php" "$web/panel.php.next.rollback"
mv -f "$web/panel.php.next.rollback" "$web/panel.php"
cp -p "$backup/index.html" "$web/index.html.next.rollback"
mv -f "$web/index.html.next.rollback" "$web/index.html"
rm -f "$HOME/matchthis-independent/mt-72/DEPLOYED"
echo MT72_AUTOMATIC_ROLLBACK_COMPLETE
RB
  fi
  exit "$status"
}
trap auto_restore EXIT
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'PREFLIGHT'
set -euo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-72"
test -f "$web/index.html" && test -f "$web/panel.php" && test -d "$web/role-pages"
test -f "$web/mt60-draws.php" && test -f "$web/role-pages/mt70-admin.php" && test -f "$web/role-pages/mt70-sedzia.php"
test ! -L "$web/index.html" && test ! -L "$web/panel.php"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = ef6f8b5839f56f44fba6fff47eaf26d09714d7861ef7285199167dde94db9ee0
test "$(tail -n +2 "$web/role-pages/mt70-admin.php" | sha256sum | awk '{print $1}')" = e21ba17b772dd52152fdad791bc1ad2cdd80d614084c55ec36b763f1f9cfa07e
test "$(tail -n +2 "$web/role-pages/mt70-sedzia.php" | sha256sum | awk '{print $1}')" = e0c3dcab7211a8f0fbab4ac0d17599df65bfe92520025b8b06c5e5f24b3ab72b
grep -Fq 'mt70-admin.php' "$web/panel.php"
grep -Fq 'mt70-sedzia.php' "$web/panel.php"
test ! -e "$web/role-pages/mt72-admin.php"
test ! -e "$web/role-pages/mt72-sedzia.php"
test ! -e "$stage/DEPLOYED"
test ! -e "$stage/rollback-mt70"
mkdir -p "$stage"
chmod 700 "$stage"
echo MT72_PREDEPLOY_SMALL2_EXACT_MT70_BASE_PASSED
PREFLIGHT
sshpass -e scp "${opts[@]}" matchthis/MatchThis_MT-72.html matchthis/MatchThis_MT-72_OGLADACZ.html matchthis/MatchThis_MT-72_SEDZIA.html "$remote:matchthis-independent/mt-72/"

switched=1
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'ACTIVATE'
set -Eeuo pipefail
web="$HOME/domains/matchthis.lowcymethodowcy.smallhost.pl/public_html"
stage="$HOME/matchthis-independent/mt-72"
backup="$stage/rollback-mt70"
test ! -e "$backup"
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = ef6f8b5839f56f44fba6fff47eaf26d09714d7861ef7285199167dde94db9ee0
test "$(sha256sum "$stage/MatchThis_MT-72.html" | awk '{print $1}')" = 8bc8f99c4e6559cb123178aa4c0e017b6c3cc8772147d66b9ce9c37985bee660
test "$(sha256sum "$stage/MatchThis_MT-72_OGLADACZ.html" | awk '{print $1}')" = eea8eec389f8f4a586444765740965180a244a3b3a6833f5742e59681400a845
test "$(sha256sum "$stage/MatchThis_MT-72_SEDZIA.html" | awk '{print $1}')" = 0896badb55553196778b48a294439a32445aeb7a7b6140afff2ffdfc8d145fac
mkdir -m 700 "$backup"
cp -p "$web/index.html" "$backup/index.html"
cp -p "$web/panel.php" "$backup/panel.php"
cp -p "$web/role-pages/mt70-admin.php" "$backup/mt70-admin.php"
cp -p "$web/role-pages/mt70-sedzia.php" "$backup/mt70-sedzia.php"
test "$(sha256sum "$backup/index.html" | awk '{print $1}')" = ef6f8b5839f56f44fba6fff47eaf26d09714d7861ef7285199167dde94db9ee0
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$stage/MatchThis_MT-72.html"; } > "$stage/mt72-admin.php"
{ printf '%s\n' '<?php if (!defined("MATCHTHIS_AUTHED")) {http_response_code(404);exit;} ?>';cat "$stage/MatchThis_MT-72_SEDZIA.html"; } > "$stage/mt72-sedzia.php"
php -l "$stage/mt72-admin.php" >/dev/null
php -l "$stage/mt72-sedzia.php" >/dev/null
python3 - "$backup/panel.php" "$stage/panel.php" <<'PY'
from pathlib import Path
import sys
s=Path(sys.argv[1]).read_text('utf8')
for a,b in (('mt70-admin.php','mt72-admin.php'),('mt70-sedzia.php','mt72-sedzia.php')):
 assert s.count(a)==1,(a,s.count(a))
 s=s.replace(a,b)
Path(sys.argv[2]).write_text(s,'utf8')
PY
php -l "$stage/panel.php" >/dev/null
cp -p "$stage/mt72-admin.php" "$web/role-pages/mt72-admin.php.next"
cp -p "$stage/mt72-sedzia.php" "$web/role-pages/mt72-sedzia.php.next"
mv -f "$web/role-pages/mt72-admin.php.next" "$web/role-pages/mt72-admin.php"
mv -f "$web/role-pages/mt72-sedzia.php.next" "$web/role-pages/mt72-sedzia.php"
cp -p "$stage/panel.php" "$web/panel.php.next"
mv -f "$web/panel.php.next" "$web/panel.php"
cp -p "$stage/MatchThis_MT-72_OGLADACZ.html" "$web/index.html.next"
mv -f "$web/index.html.next" "$web/index.html"
php -l "$web/panel.php" >/dev/null
test "$(sha256sum "$web/index.html" | awk '{print $1}')" = eea8eec389f8f4a586444765740965180a244a3b3a6833f5742e59681400a845
grep -Fq 'mt72-admin.php' "$web/panel.php"
grep -Fq 'mt72-sedzia.php' "$web/panel.php"
test "$(tail -n +2 "$web/role-pages/mt72-admin.php" | sha256sum | awk '{print $1}')" = 8bc8f99c4e6559cb123178aa4c0e017b6c3cc8772147d66b9ce9c37985bee660
test "$(tail -n +2 "$web/role-pages/mt72-sedzia.php" | sha256sum | awk '{print $1}')" = 0896badb55553196778b48a294439a32445aeb7a7b6140afff2ffdfc8d145fac
touch "$stage/DEPLOYED"
echo MT72_SMALL2_INSTALLED_3_ROLES_WITH_BACKUP_AND_GUARDED_ROUTER
ACTIVATE

url=https://matchthis.lowcymethodowcy.smallhost.pl
curl -fsSL --max-time 30 "$url/" -o /tmp/mt72-published.html
test "$(sha256sum /tmp/mt72-published.html | awk '{print $1}')" = eea8eec389f8f4a586444765740965180a244a3b3a6833f5742e59681400a845
test "$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$url/panel.php")" = 303
for role in mt72-admin.php mt72-sedzia.php;do
  status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 25 "$url/role-pages/$role")"
  test "$status" = 403 || test "$status" = 404
done
curl -fsSL --max-time 25 "$url/mt60-draws.php" > /tmp/mt72-live-published-draws.json
node -e 'const d=require("/tmp/mt72-live-published-draws.json");if(!Array.isArray(d.draws))process.exit(1)'
switched=0
echo MT72_SMALL2_PUBLIC_HTTP_ADMIN_AUTH_API_CHECKS_PASS
