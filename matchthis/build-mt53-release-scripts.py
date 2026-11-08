from pathlib import Path
root=Path(__file__).resolve().parent
# The MT52 baseline script is constructed reproducibly from the MT51 release.
# Always rebuild it first, so this deploy is tied to the exact last production release.
def advance(s):
 s=s.replace('MT-52','MT-53').replace('MT52','MT53').replace('mt52','mt53').replace('mt-52','mt-53')
 s=s.replace('MT-51','MT-52').replace('MT51','MT52').replace('mt51','mt52').replace('mt-51','mt-52')
 return s
d=advance((root/'deploy-mt52-small2.sh').read_text('utf8'))
r=advance((root/'rollback-mt52-small2.sh').read_text('utf8'))
for token in ('MatchThis_MT-52_OGLADACZ.html','MatchThis_MT-53.html','index-MT52.backup','MT52-OWNED',
              'mt52-admin.php','mt53-admin.php','stage="$HOME/matchthis-independent/mt-53"',
              'MT53_VERSION_AUTH_HTTPS_OK'):
 assert token in d,('deploy guard',token)
for token in ('MatchThis_MT-53_OGLADACZ.html','index-MT52.backup','MT53_ROLLBACK_MT52',
              'stage="$HOME/matchthis-independent/mt-53"'):
 assert token in r,('rollback guard',token)
(root/'deploy-mt53-small2.sh').write_text(d,'utf8')
(root/'rollback-mt53-small2.sh').write_text(r,'utf8')
print('MT53_DEPLOY_MT52_BASELINE_BACKUP_AND_ROLLBACK_CHECKED')
