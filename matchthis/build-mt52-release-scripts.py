from pathlib import Path
root=Path(__file__).resolve().parent
d=(root/'deploy-mt51-small2.sh').read_text(encoding='utf8')
r=(root/'rollback-mt51-small2.sh').read_text(encoding='utf8')
for s in (d,r):
 assert 'mt-51' in s and 'MT-51' in s
def next_release(s):
 s=s.replace('MT-51','MT-52').replace('MT51','MT52').replace('mt51','mt52').replace('mt-51','mt-52')
 s=s.replace('MT-50','MT-51').replace('MT50','MT51').replace('mt50','mt51').replace('mt-50','mt-51')
 return s
d=next_release(d)
r=next_release(r)
assert 'MatchThis_MT-51_OGLADACZ.html' in d
assert 'MatchThis_MT-52.html' in d
assert 'index-MT51.backup' in d and 'index-MT51.backup' in r
assert 'stage="$HOME/matchthis-independent/mt-52"' in d
assert 'stage="$HOME/matchthis-independent/mt-52"' in r
assert 'MT51-OWNED' in d
assert 'mt51-admin.php' in d and 'mt52-admin.php' in d
assert 'MT52_ROLLBACK_MT51' in r
assert 'MT52_VERSION_AUTH_HTTPS_OK' in d
(root/'deploy-mt52-small2.sh').write_text(d,encoding='utf8')
(root/'rollback-mt52-small2.sh').write_text(r,encoding='utf8')
print('MT52_DEPLOY_SCRIPTS_SOURCE_GUARDS_PASS')
