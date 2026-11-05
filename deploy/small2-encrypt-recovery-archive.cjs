'use strict';
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const crypto=require('node:crypto');
const archive=path.join(os.homedir(),'.private-lowcy-archives','Lowcy_V311_SMALL2_PELNA_KOPIA_20261105.zip');
const EXPECTED_SHA256='e2937cdb96cc390c6ba81f47427eb56cad675251a80fe16c8f554c4b13292046';
const RECIPIENT_PUBLIC=String.raw`-----BEGIN PUBLIC KEY-----
MCowBQYDK2VuAyEALNrXO9F/0n26VWsGYtOvfRldOi+f8mEJMAAUApr6L1o=
-----END PUBLIC KEY-----
`;
const INFO=Buffer.from('lowcy-small2-v311-user-recovery-archive-v1');
function fail(error){console.error('SMALL2_ARCHIVE_ENCRYPTION_FAILED '+String(error?.message||error));process.exitCode=1;}
(async()=>{
 const stat=fs.statSync(archive);
 if(!stat.isFile()||(stat.mode&0o077)!==0)throw Error('ARCHIVE_NOT_PRIVATE');
 const clear=fs.readFileSync(archive);
 if(crypto.createHash('sha256').update(clear).digest('hex')!==EXPECTED_SHA256)throw Error('ARCHIVE_SHA256_CHANGED');
 if(clear.length<10000000||clear.length>300000000)throw Error('ARCHIVE_UNEXPECTED_SIZE');
 const recipient=crypto.createPublicKey(RECIPIENT_PUBLIC);
 if(recipient.asymmetricKeyType!=='x25519')throw Error('RECIPIENT_KEY_NOT_X25519');
 const kp=crypto.generateKeyPairSync('x25519');
 const shared=crypto.diffieHellman({privateKey:kp.privateKey,publicKey:recipient});
 const key=Buffer.from(crypto.hkdfSync('sha256',shared,Buffer.alloc(0),INFO,32));
 const iv=crypto.randomBytes(12);
 const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 const ciphertext=Buffer.concat([cipher.update(clear),cipher.final()]);
 const header={
  format:'LOWCY_SMALL2_ENCRYPTED_ARCHIVE_V1',
  encryption:'x25519-hkdf-sha256-aes-256-gcm',
  ephemeralPublicKey:kp.publicKey.export({format:'pem',type:'spki'}),
  iv:iv.toString('base64'),
  tag:cipher.getAuthTag().toString('base64'),
  encryptedLength:ciphertext.length,
  sourceSha256:EXPECTED_SHA256,
  originalFilename:path.basename(archive)
 };
 process.stdout.write(Buffer.concat([Buffer.from(JSON.stringify(header)+'\n'),ciphertext]));
})().catch(fail);
