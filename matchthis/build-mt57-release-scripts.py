from pathlib import Path
root=Path(__file__).resolve().parent
# Production currently MT55. Only the HTML/PHP frontend is upgraded, never database or credentials.
original=(root/'deploy-mt55-small2.sh').read_text('utf8')
rollback=(root/'rollback-mt55-small2.sh').read_text('utf8')
def upgrade(script):
 script=script.replace('MT-55','MT-57').replace('MT55','MT57').replace('mt55','mt57').replace('mt-55','mt-57')
 script=script.replace('MT-54','MT-55').replace('MT54','MT55').replace('mt54','mt55').replace('mt-54','mt-55')
 return script
deploy=upgrade(original)
restore=upgrade(rollback)
for marker in ('MatchThis_MT-55_OGLADACZ.html','MatchThis_MT-57.html','index-MT55.backup','MT55-OWNED',
               'mt55-admin.php','mt57-admin.php','stage="$HOME/matchthis-independent/mt-57"',
               'MT57_VERSION_AUTH_HTTPS_OK'):
 assert marker in deploy,('missing deploy safety check',marker)
for marker in ('MatchThis_MT-57_OGLADACZ.html','index-MT55.backup','MT57_ROLLBACK_MT55',
               'stage="$HOME/matchthis-independent/mt-57"'):
 assert marker in restore,('missing rollback safety check',marker)
(root/'deploy-mt57-small2.sh').write_text(deploy,encoding='utf8')
(root/'rollback-mt57-small2.sh').write_text(restore,encoding='utf8')
print('MT57_DEPLOY_AND_ROLLBACK_GUARDED_WITH_MT55_BASELINE')
