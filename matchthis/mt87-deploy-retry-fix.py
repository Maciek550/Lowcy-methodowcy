#!/usr/bin/env python3
"""MT87: exact repair of deploy bash function syntax and safe retry of upload-only staging.
Only executable deployment script changes. Application data and HTML are untouched.
"""
from pathlib import Path
p=Path('matchthis/deploy-mt87-small2.sh')
s=p.read_text()
old="sha(){sha256sum \"$1\"|awk '{print $1}';}"
new="sha(){ sha256sum \"$1\"|awk '{print $1}'; }"
assert s.count(old)==1,(old,s.count(old))
s=s.replace(old,new)
old='''test ! -e "$stage"
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = d5ddcc58aa3e118743573e776069af8eeabb3234cf27b36ae5615689888b268f'''
new='''# The first, syntax-blocked run uploaded files only; allow this exact staged package to be reused.
if test -e "$stage";then
 test -d "$stage" && test ! -L "$stage" && test ! -e "$stage/previous"
 test "$(sha256sum "$stage/MatchThis_MT-87.html"|awk '{print $1}')" = 810ebd485c21c30da23ba13d439c4aa48afcc92d3947838fc510d26c81d1c7fa
 test "$(sha256sum "$stage/MatchThis_MT-87_OGLADACZ.html"|awk '{print $1}')" = d325e33d7d3b598457c53e52439c9993c876f21ab2cd4d385fedac78ad21d01a
 test "$(sha256sum "$stage/MatchThis_MT-87_SEDZIA.html"|awk '{print $1}')" = f74db6bfd00bdfa410cf525582eeb87e4aa4ac9cede28cc617879da0b391c687
else
 mkdir -m 700 "$stage"
fi
test "$(sha256sum "$web/index.html"|awk '{print $1}')" = d5ddcc58aa3e118743573e776069af8eeabb3234cf27b36ae5615689888b268f'''
assert s.count(old)==1,(old,s.count(old))
s=s.replace(old,new)
old='''mkdir -m 700 "$stage"
echo MT87_PRECHECK_EXACT_MT86_NO_DATABASE_WRITE_PASS'''
new='''echo MT87_PRECHECK_EXACT_MT86_NO_DATABASE_WRITE_PASS'''
assert s.count(old)==1
s=s.replace(old,new)
# If installation never started there is nothing to roll back.
old='''test -f "$prior/index.html" && test -f "$prior/panel.php"
test "$(sha256sum "$prior/index.html"|awk '{print $1}')" = d5ddcc58aa3e118743573e776069af8eeabb3234cf27b36ae5615689888b268f'''
new='''if test ! -f "$prior/index.html";then echo MT87_NO_FILES_REPLACED_STAGED_UPLOAD_ONLY;exit 0;fi
test -f "$prior/panel.php"
test "$(sha256sum "$prior/index.html"|awk '{print $1}')" = d5ddcc58aa3e118743573e776069af8eeabb3234cf27b36ae5615689888b268f'''
assert s.count(old)==1
s=s.replace(old,new)
p.write_text(s)
print('MT87_INSTALLER_RETRY_SAFE_SYNTAX_FIXED',len(s))
