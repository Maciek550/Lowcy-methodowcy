#!/usr/bin/env bash
set -euo pipefail
umask 077
test -n "${RAILWAY_API_TOKEN:-}" && test -n "${SSH_PASSWORD:-}"
export SSHPASS="$SSH_PASSWORD"
remote='lowcymethodowcy@s3.small.pl'
opts=(-o StrictHostKeyChecking=yes -o PubkeyAuthentication=no -o PreferredAuthentications=keyboard-interactive,password -o KbdInteractiveAuthentication=yes -o NumberOfPasswordPrompts=1 -o ConnectTimeout=15)
privateStage='lowcy-small2-stage-v311'
target='railway-source-20261105-v311'
tmp="$RUNNER_TEMP"
ws='c1179069-8e59-44d8-aae9-1dd3f188d881'
project='a1cb25a7-9ef3-4ee5-af9e-efafecf527ed'
env='193be84b-d9f4-49bf-8a75-f432c8dda992'
svc='b45540b3-3201-4991-bd11-987cd1c68963'
# Prepare a decryption key only at SMALL2; never export its private half.
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'EOSSH'
set -euo pipefail
umask 077
cfg="$HOME/.config/lowcy-small2"
test -d "$cfg"
node <<'NODE'
const {generateKeyPairSync}=require('node:crypto'), fs=require('node:fs');
const p=process.env.HOME+'/.config/lowcy-small2/';
const priv=p+'backup_x25519_private.pem',pub=p+'backup_x25519_public.pem';
if(fs.existsSync(priv)!==fs.existsSync(pub))throw Error('RECIPIENT_KEYPAIR_INCOMPLETE');
if(!fs.existsSync(priv)){
 const kp=generateKeyPairSync('x25519');
 fs.writeFileSync(priv,kp.privateKey.export({format:'pem',type:'pkcs8'}),{mode:0o600,flag:'wx'});
 fs.writeFileSync(pub,kp.publicKey.export({format:'pem',type:'spki'}),{mode:0o600,flag:'wx'});
}
if((fs.statSync(priv).mode&0o077)!==0)throw Error('PRIVATE_KEY_PERMISSIONS');
console.log('SMALL2_ENCRYPTION_RECIPIENT_READY');
NODE
test ! -e "$HOME/lowcy-small2-stage-v311/railway-source-20261105-v311.encrypted"
test ! -e "$HOME/lowcy-small2-stage-v311/railway-source-20261105-v311.json"
EOSSH
sshpass -e ssh "${opts[@]}" "$remote" 'cat "$HOME/.config/lowcy-small2/backup_x25519_public.pem"' > "$tmp/small2-pub.pem"
node <<'NODE'
const fs=require('node:fs');
const pem=fs.readFileSync(process.env.RUNNER_TEMP+'/small2-pub.pem');
const b64=pem.toString('base64');
const orig=fs.readFileSync('deploy/small2-source-export-encrypted-v311.cjs','utf8');
if(!orig.includes('__RECIPIENT_X25519_PUB_B64__'))throw Error('MISSING_EXPORT_PLACEHOLDER');
fs.writeFileSync(process.env.RUNNER_TEMP+'/export-for-railway.cjs',orig.replace('__RECIPIENT_X25519_PUB_B64__',b64),{mode:0o600});
NODE
ssh-keygen -q -t ed25519 -N '' -f "$HOME/.ssh/id_ed25519" -C "lowcy-small2-transfer-${GITHUB_RUN_ID}"
keyfp="$(ssh-keygen -lf "$HOME/.ssh/id_ed25519.pub" -E sha256 | awk '{print $2}')"
registered=0
cleanup(){
 rc=$?
 trap - EXIT
 if [ "$registered" = 1 ]; then
   railway ssh keys --workspace "$ws" remove "$keyfp" > "$tmp/rail-key-cleanup.log" 2>&1 || { echo 'TEMP_KEY_REVOKE_FAILED'; rc=1; }
   if [ "$rc" -eq 0 ]; then echo 'RAILWAY_TEMP_SSH_KEY_REVOKED'; fi
 fi
 exit "$rc"
}
trap cleanup EXIT
railway ssh keys --workspace "$ws" add --key "$HOME/.ssh/id_ed25519.pub" --name "lowcy-small2-transfer-${GITHUB_RUN_ID}" > "$tmp/rail-key-add.log" 2>&1
registered=1
echo 'RAILWAY_TEMP_SSH_KEY_REGISTERED'
timeout 120 railway ssh --project "$project" --environment "$env" --service "$svc" --identity-file "$HOME/.ssh/id_ed25519" -- 'node -' < "$tmp/export-for-railway.cjs" > "$tmp/source.encrypted"
node <<'NODE'
const fs=require('node:fs');const b=fs.readFileSync(process.env.RUNNER_TEMP+'/source.encrypted');
const k=b.indexOf(10);if(k<10||k>10000)throw Error('INVALID_ENCRYPTED_SOURCE_HEADER');
const h=JSON.parse(b.subarray(0,k).toString('utf8'));
if(h.format!=='LOWCY_SMALL2_ENCRYPTED_SNAPSHOT_V1'||h.encryptedLength!==b.length-k-1)throw Error('ENCRYPTED_SOURCE_INCOMPLETE');
console.log('RAILWAY_READONLY_ENCRYPTED_EXPORT_OK bytes='+b.length);
NODE
sshpass -e scp "${opts[@]}" "$tmp/source.encrypted" "$remote:$privateStage/$target.encrypted"
sshpass -e scp "${opts[@]}" deploy/small2-decrypt-snapshot-v311.cjs "$remote:$privateStage/decrypt-snapshot-v311.cjs"
localhash="$(sha256sum "$tmp/source.encrypted" | cut -d' ' -f1)"
remotehash="$(sshpass -e ssh "${opts[@]}" "$remote" 'sha256sum "$HOME/lowcy-small2-stage-v311/railway-source-20261105-v311.encrypted" | cut -d" " -f1')"
test "$localhash" = "$remotehash"
echo 'SMALL2_ENCRYPTED_SHA256_VERIFIED'
sshpass -e ssh "${opts[@]}" "$remote" 'bash -s' <<'EOSSH'
set -euo pipefail
umask 077
stage="$HOME/lowcy-small2-stage-v311"
chmod 600 "$stage/railway-source-20261105-v311.encrypted" "$stage/decrypt-snapshot-v311.cjs"
node "$stage/decrypt-snapshot-v311.cjs" "$stage/railway-source-20261105-v311.encrypted" "$stage/railway-source-20261105-v311.json"
echo 'SMALL2_SNAPSHOT_READY_FOR_RESTORE'
EOSSH
