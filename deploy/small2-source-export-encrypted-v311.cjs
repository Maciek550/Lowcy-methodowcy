'use strict';
// This file is sent by SSH stdin to the existing, already-running Railway app.
// Its only database operation is the existing buildSnapshot() helper, which
// starts REPEATABLE READ READ ONLY and commits the read-only transaction.
// Encrypts contents in the app process before any backup bytes leave Railway.
const {buildSnapshot}=require('/app/backup-lib.cjs');
const {createPublicKey,generateKeyPairSync,diffieHellman,hkdfSync,randomBytes,createCipheriv}=require('node:crypto');
const zlib=require('node:zlib');
const RECIPIENT_PUBLIC_KEY=Buffer.from('__RECIPIENT_X25519_PUB_B64__','base64').toString('utf8');
const INFO=Buffer.from('lowcy-small2-v311-source-snapshot-v1','utf8');

(async()=>{
  if(!process.env.DATABASE_URL)throw Error('SOURCE_DATABASE_NOT_CONFIGURED');
  if(!RECIPIENT_PUBLIC_KEY.startsWith('-----BEGIN PUBLIC KEY-----'))throw Error('MISSING_TARGET_PUBLIC_KEY');
  const url=new URL(process.env.DATABASE_URL);
  if(!['postgres:','postgresql:'].includes(url.protocol))throw Error('SOURCE_NOT_POSTGRESQL');
  if(url.hostname==='pgsql3.small.pl')throw Error('SOURCE_POINTS_TO_SMALL2_INSTEAD_OF_RAILWAY');
  const snapshot=await buildSnapshot(process.env.DATABASE_URL,{
    appVersion:'V311',
    note:'One-time source export to independent SMALL2, REPEATABLE READ READ ONLY',
  });
  const count=snapshot.database?.counts||{};
  if(snapshot.format!=='LOWCY_METHODOWCY_DB_BACKUP_V1'||!Array.isArray(snapshot.data?.users)||!Array.isArray(snapshot.data?.competitions))throw Error('SOURCE_SNAPSHOT_INVALID');
  if(Number(count.users)<50||Number(count.competitions)<5||Number(count.draws)<200||Number(count.results)<200)throw Error('SOURCE_SNAPSHOT_TOO_SMALL');
  const data=zlib.gzipSync(Buffer.from(JSON.stringify(snapshot)),{level:6});
  const recipient=createPublicKey(RECIPIENT_PUBLIC_KEY);
  if(recipient.asymmetricKeyType!=='x25519')throw Error('INVALID_RECIPIENT_KEY_TYPE');
  const pair=generateKeyPairSync('x25519');
  const shared=diffieHellman({privateKey:pair.privateKey,publicKey:recipient});
  const key=Buffer.from(hkdfSync('sha256',shared,Buffer.alloc(0),INFO,32));
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key,iv);
  const encrypted=Buffer.concat([cipher.update(data),cipher.final()]);
  const header={
    format:'LOWCY_SMALL2_ENCRYPTED_SNAPSHOT_V1',
    encryption:'x25519-hkdf-sha256-aes-256-gcm',
    ephemeralPublicKey:pair.publicKey.export({format:'pem',type:'spki'}),
    iv:iv.toString('base64'),
    tag:cipher.getAuthTag().toString('base64'),
    encryptedLength:encrypted.length,
  };
  process.stdout.write(Buffer.concat([Buffer.from(JSON.stringify(header)+'\n'),encrypted]));
})().catch(e=>{console.error('SOURCE_READONLY_EXPORT_FAILED: '+String(e?.message||e).replace(/postgres(ql)?:\/\/[^ ]+/g,'[REDACTED_DB_URL]'));process.exitCode=1;});
