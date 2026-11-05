'use strict';
// Decrypts a snapshot on the independent SMALL2 account.
// Both the encrypted input and the decoded backup live in private mode-0600 files.
const {readFileSync,writeFileSync,statSync}=require('node:fs');
const {createPrivateKey,createPublicKey,diffieHellman,hkdfSync,createDecipheriv}=require('node:crypto');
const zlib=require('node:zlib');
const path=require('node:path');
const INFO=Buffer.from('lowcy-small2-v311-source-snapshot-v1','utf8');
const privPath=path.join(process.env.HOME,'.config/lowcy-small2/backup_x25519_private.pem');
const file=process.argv[2], output=process.argv[3];
if(!file||!output)throw Error('USAGE: decrypt-encrypted-snapshot.cjs input output');
const st=statSync(privPath);
if((st.mode&0o077)!==0)throw Error('PRIVATE_KEY_PERMISSIONS_TOO_BROAD');
const buf=readFileSync(file);
const split=buf.indexOf(10);
if(split<20||split>10000)throw Error('ENCRYPTED_HEADER_INVALID');
const header=JSON.parse(buf.subarray(0,split).toString('utf8'));
if(header.format!=='LOWCY_SMALL2_ENCRYPTED_SNAPSHOT_V1')throw Error('INVALID_ENCRYPTED_FORMAT');
if(header.encryption!=='x25519-hkdf-sha256-aes-256-gcm')throw Error('UNSUPPORTED_ENCRYPTION');
const ciphertext=buf.subarray(split+1);
if(ciphertext.length!==header.encryptedLength)throw Error('ENCRYPTED_FILE_TRUNCATED');
const privateKey=createPrivateKey(readFileSync(privPath));
const publicKey=createPublicKey(header.ephemeralPublicKey);
const secret=diffieHellman({privateKey,publicKey});
const key=Buffer.from(hkdfSync('sha256',secret,Buffer.alloc(0),INFO,32));
const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(header.iv,'base64'));
decipher.setAuthTag(Buffer.from(header.tag,'base64'));
const zipped=Buffer.concat([decipher.update(ciphertext),decipher.final()]);
const json=zlib.gunzipSync(zipped);
const snapshot=JSON.parse(json.toString('utf8'));
if(snapshot.format!=='LOWCY_METHODOWCY_DB_BACKUP_V1'||!snapshot.database||!snapshot.data)throw Error('INVALID_BACKUP_FORMAT');
const expected=['users','competitions','entries','draws','results','result_items','app_migrations','historical_import_audit'];
for(const t of expected){
  if(!Array.isArray(snapshot.data[t])||snapshot.data[t].length!==Number(snapshot.database.counts[t]))throw Error('BACKUP_COUNTS_INVALID_'+t);
}
if(snapshot.data.users.length<50||snapshot.data.competitions.length<5||snapshot.data.draws.length<200||snapshot.data.results.length<200)throw Error('BACKUP_TOO_SMALL');
if(snapshot.database.tables!==Object.keys(snapshot.data).length)throw Error('BACKUP_TABLE_COUNT_MISMATCH');
if(!/^2026-11-0[45]T/.test(snapshot.created_at))throw Error('BACKUP_DATE_UNEXPECTED');
writeFileSync(output,json,{mode:0o600,flag:'wx'});
console.log('SMALL2_ENCRYPTED_SNAPSHOT_DECRYPTED_AND_VERIFIED '+JSON.stringify({created_at:snapshot.created_at,tables:snapshot.database.tables,counts:snapshot.database.counts}));
