from pathlib import Path
root=Path(__file__).resolve().parent
# MT53 was validated but not deployed. Production baseline is MT52.
# Build both scripts strictly from the same deployed MT52 release sources.
current=(root/'deploy-mt52-small2.sh').read_text('utf8')
rollback=(root/'rollback-mt52-small2.sh').read_text('utf8')
def promote(s):
 s=s.replace('MT-52','MT-54').replace('MT52','MT54').replace('mt52','mt54').replace('mt-52','mt-54')
 s=s.replace('MT-51','MT-52').replace('MT51','MT52').replace('mt51','mt52').replace('mt-51','mt-52')
 return s
current=promote(current);rollback=promote(rollback)
for token in ('MatchThis_MT-52_OGLADACZ.html','MatchThis_MT-54.html','index-MT52.backup','MT52-OWNED',
              'mt52-admin.php','mt54-admin.php','stage="$HOME/matchthis-independent/mt-54"',
              'MT54_VERSION_AUTH_HTTPS_OK'):
 assert token in current,('deployment safeguard',token)
for token in ('MatchThis_MT-54_OGLADACZ.html','index-MT52.backup','MT54_ROLLBACK_MT52',
              'stage="$HOME/matchthis-independent/mt-54"'):
 assert token in rollback,('rollback safeguard',token)
(root/'deploy-mt54-small2.sh').write_text(current,'utf8')
(root/'rollback-mt54-small2.sh').write_text(rollback,'utf8')
print('MT54_RELEASE_SCRIPTS_BASELINE_MT52_BACKUP_ROLLBACK_CHECKED')
