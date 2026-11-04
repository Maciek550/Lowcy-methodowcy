#!/usr/bin/env bash
set -euo pipefail
umask 077
domain='lowcymethodowcy.smallhost.pl'
root="$HOME/domains/$domain"
stage="$HOME/lowcy-small2-stage-v311"
adapter="$stage/public_nodejs/app.js"
source="$HOME/lowcy-small2-20261023"
logs="$stage/www_node_conversion_20261104.log"
state='original_php'
rollback() {
  code=$?
  if [ "$state" = 'removed_php' ] || [ "$state" = 'nodejs_active' ]; then
    echo "SMALL2_CUTOVER_FAILED: attempting PHP configuration restore."
    existing="$(devil www list | awk -v d="$domain" '$1==d {print $2}')"
    if [ -n "$existing" ]; then devil www del "$domain" >> "$logs" 2>&1 || true; fi
    if devil www add "$domain" php >> "$logs" 2>&1; then
      echo "SMALL2_PHP_ROLLBACK_DONE"
    else
      echo "SMALL2_PHP_ROLLBACK_FAILED: inspect private WWW logs and DevilWEB."
    fi
  fi
  exit "$code"
}
trap rollback ERR
test "$(id -un)" = 'lowcymethodowcy'
test "$(git -C "$source" rev-parse HEAD)" = 'e5b35f311d8c0d98cd8498044e5d538bf9c2b2f2'
test -f "$source/.small2-start-approved"
test -f "$HOME/.config/lowcy-small2/runtime.json"
test -f "$stage/lowcy_kop_before_init_20261104.dump"
test -s "$stage/lowcy_kop_before_init_20261104.dump"
test -f "$stage/php-before-conversion.tar.gz"
test -f "$stage/www-before.txt"
test -f "$adapter"
test "$(stat -f '%Sp' "$HOME/.config/lowcy-small2/runtime.json")" = '-rw-------'
node --check "$adapter"
node --check "$source/server.cjs"
current="$(devil www list | awk -v d="$domain" '$1==d {print $2}')"
if [ "$current" = 'nodejs' ]; then
  echo 'SMALL2_CUTOVER_ALREADY_NODEJS: refuse to modify existing configuration.'
  exit 2
fi
if [ "$current" != 'php' ]; then
  echo "SMALL2_CUTOVER_BLOCKED: domain is not expected PHP configuration."
  exit 2
fi
test -d "$root/public_html"
# One existing 7.7 KB PHP landing page was found. Switch only if its
# exact bytes are preserved in the prior off-site-of-domain backup.
if [ "$(find "$root/public_html" -mindepth 1 | awk 'END{print NR+0}')" != '1' ]; then
  echo 'SMALL2_CUTOVER_BLOCKED: unexpected PHP public_html contents.'
  exit 2
fi
test -f "$root/public_html/index.html"
archived="$(tar -xOf "$stage/php-before-conversion.tar.gz" public_html/index.html | sha256sum | awk '{print $1}')"
current="$(sha256sum "$root/public_html/index.html" | awk '{print $1}')"
if [ -z "$archived" ] || [ "$archived" != "$current" ]; then
  echo 'SMALL2_CUTOVER_BLOCKED: PHP landing page differs from original backup.'
  exit 2
fi
echo 'SMALL2_PHP_LANDING_PAGE_BACKUP_SHA256_MATCH'
test -f "$root/logs/error.log" || true
# Record current domain tree and WWW configuration outside the domain.
devil www list > "$stage/www-before-cutover.txt"
find "$root" -mindepth 1 -maxdepth 2 -type d | sort > "$stage/www-dirs-before-cutover.txt"
echo '=== SMALL2 CUTOVER PHP -> Node.js ==='
devil www del "$domain" >> "$logs" 2>&1
state='removed_php'
# SMALL.PL's CLI syntax supports executable path and environment.
if ! devil www add "$domain" nodejs /usr/local/bin/node22 production >> "$logs" 2>&1; then
  echo 'SMALL2_NODE_ADD_PRODUCTION_VARIANT_REJECTED; trying documented short variant.'
  devil www add "$domain" nodejs /usr/local/bin/node22 >> "$logs" 2>&1
fi
state='nodejs_active'
target="$root/public_nodejs"
test -d "$target"
mkdir -p "$target/public"
cp "$adapter" "$target/app.js"
chmod 644 "$target/app.js"
node --check "$target/app.js"
if [ -f "$target/public/index.html" ]; then
  cp "$target/public/index.html" "$stage/public-node-default-index.html"
  rm "$target/public/index.html"
fi
new="$(devil www list | awk -v d="$domain" '$1==d {print $2}')"
test "$new" = 'nodejs'
devil www restart "$domain" >> "$logs" 2>&1
trap - ERR
echo 'SMALL2_NODE_DOMAIN_CONVERTED_AND_PASSENGER_ENTRY_INSTALLED'
echo 'SMALL2_DOMAIN_TYPE=nodejs'
