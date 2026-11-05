'use strict';
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const archive=path.join(os.homedir(),'.private-lowcy-archives','Lowcy_S1_SMALL2_PELNA_KOPIA_20261105.zip');
const recipientPem=String.raw`-----BEGIN PUBLIC KEY-----
MCowBQYDK2VuAyEALNrXO9F/0n26VWsGYtOvfRldOi+f8mEJMAAUApr6L1o=
-----END PUBLIC KEY-----
`;
const INFO=Buffer.from('lowcy-small2-s1-user-recovery-archive-v1');
(async()=>{
 const st=fs.statSync(archive);
 if(!st.isFile()||(st.mode&0o077)!==0)throw Error('ARCHIVE_NOT_PRIVATE');
 const data=fs.readFileSync(archive);
 if(data.length<10000000||data.length>300000000)throw Error('INVALID_ARCHIVE_SIZE');
 const recipient=crypto.createPublicKey(recipientPem);
 if(recipient.asymmetricKeyType!=='x25519')throw Error('NOT_X25519');
 const pair=crypto.generateKeyPairSync('x25519');
 const key=Buffer.from(crypto.hkdfSync('sha256',crypto.diffieHellman({privateKey:pair.privateKey,publicKey:recipient}),Buffer.alloc(0),INFO,32));
 const iv=crypto.randomBytes(12);
 const cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 const body=Buffer.concat([cipher.update(data),cipher.final()]);
 const header={
   format:'LOWCY_SMALL2_S1_ENCRYPTED_ARCHIVE_V1',
   encryption:'x25519-hkdf-sha256-aes-256-gcm',
   ephemeralPublicKey:pair.publicKey.export({format:'pem',type:'spki'}),
   iv:iv.toString('base64'),
   tag:cipher.getAuthTag().toString('base64'),
   encryptedLength:body.length,
   originalSha256:crypto.createHash('sha256').update(data).digest('hex'),
   originalName:path.basename(archive)
 };
 process.stdout.write(Buffer.concat([Buffer.from(JSON.stringify(header)+'\n'),body]));
})().catch(e=>{console.error('S1_ENCRYPTED_TRANSFER_FAILED '+e.message);process.exitCode=1});
