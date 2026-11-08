from pathlib import Path
root=Path(__file__).resolve().parent
# Production baseline is MT54: create the MT55 release directly from its guarded scripts.
current=(root/'deploy-mt54-small2.sh').read_text('utf8')
rollback=(root/'rollback-mt54-small2.sh').read_text('utf8')
def promote(s):
 s=s.replace('MT-54','MT-55').replace('MT54','MT55').replace('mt54','mt55').replace('mt-54','mt-55')
 s=s.replace('MT-52','MT-54').replace('MT52','MT54').replace('mt52','mt54').replace('mt-52','mt-54')
 return s
current=promote(current)
rollback=promote(rollback)
for token in ('MatchThis_MT-54_OGLADACZ.html','MatchThis_MT-55.html','index-MT54.backup','MT54-OWNED',
              'mt54-admin.php','mt55-admin.php','stage="$HOME/matchthis-independent/mt-55"',
              'MT55_VERSION_AUTH_HTTPS_OK'):
 assert token in current,('deployment safeguard',token)
for token in ('MatchThis_MT-55_OGLADACZ.html','index-MT54.backup','MT55_ROLLBACK_MT54',
              'stage="$HOME/matchthis-independent/mt-55"'):
 assert token in rollback,('rollback safeguard',token)
(root/'deploy-mt55-small2.sh').write_text(current,'utf8')
(root/'rollback-mt55-small2.sh').write_text(rollback,'utf8')
print('MT55_RELEASE_SCRIPTS_MT54_BACKUP_AND_ROLLBACK_CHECKED')
