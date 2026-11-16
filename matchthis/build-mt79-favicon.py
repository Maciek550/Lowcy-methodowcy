#!/usr/bin/env python3
"""MT79: add explicit, cache-busting orange favicon links to exact MT78 3 roles.

Never edit source data, JS logic, style, roles or results. Preserve original HTML.
"""
from pathlib import Path
import hashlib,re,subprocess
DIR=Path('matchthis')
SOURCES={
 '':'1218a11dc52da24543420c0fffb5d89c9ab222156c77fc92e55fd99905564e0c',
 '_OGLADACZ':'3ebed336016c0af5ef51fc86b19bc7e7244ec95940ff68aae95b18742f0a4f45',
 '_SEDZIA':'53492a431e8aae5c1d6729b96d4111afdc2dfdc7e6671604faf171b98812d951'
}
OLD='<title>MatchThis MT-78</title>'
NEW='''<title>MatchThis MT-79</title>
<link rel="icon" type="image/png" sizes="32x32" href="/matchthis-orange-mt79-32.png">
<link rel="icon" type="image/png" sizes="64x64" href="/matchthis-orange-mt79-64.png">
<link rel="shortcut icon" type="image/x-icon" href="/favicon.ico?matchthis=mt79">'''
for role,expected in SOURCES.items():
 old=DIR/f'MatchThis_MT-78{role}.html'
 b=old.read_bytes()
 assert hashlib.sha256(b).hexdigest()==expected,('Wrong source version',role)
 s=b.decode('utf8')
 assert s.count(OLD)==1 and s.count('rel="icon"')==0
 n=9 if role=='_OGLADACZ' else 12
 assert s.count('MT-78')==n,(role,'old header version mismatch')
 out=s.replace(OLD,NEW,1).replace('MT-78','MT-79')
 assert out.count('MT-79')==n
 for needle in ['<title>MatchThis MT-79</title>','data-version="MT-79"',
                "const APP_VERSION='MT-79';",'id="appversion">MT-79']:
  assert needle in out,(role,needle)
 assert out.count('rel="icon"')==2 and out.count('rel="shortcut icon"')==1
 assert out.replace(NEW,OLD,1).replace('MT-79','MT-78')==s,('Unrelated HTML change',role)
 for js in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',out,re.S):
  if js.strip():
   tmp=Path('/tmp/mt79-syntax.js');tmp.write_text(js,encoding='utf8')
   subprocess.run(['node','--check',str(tmp)],check=True,stdout=subprocess.DEVNULL)
 final=DIR/f'MatchThis_MT-79{role}.html'
 final.write_text(out,encoding='utf8')
 print('MT79_RELEASE_ICON_ONLY_VALIDATED',role or 'ADMIN',hashlib.sha256(final.read_bytes()).hexdigest(),final.stat().st_size)
