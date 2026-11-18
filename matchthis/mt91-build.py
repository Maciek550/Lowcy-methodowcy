#!/usr/bin/env python3
"""MT-91: exactly MT-90 plus approved high-resolution home-screen icon and manifest."""
from pathlib import Path
from PIL import Image
import base64, hashlib, io, json, re, subprocess, tempfile

root = Path('matchthis')
base = root / 'mt91-source'
out = root / 'mt91-release'
out.mkdir(parents=True, exist_ok=True)
SOURCE = {
    '': '694c7f36f02fb529372b99aa6de682634bccb9f42d3812c902030c199bf851a4',
    '_OGLADACZ': 'f8cb9863a81091ec556b497244db9d3300dc4023c5626c8bc32130929356f184',
    '_SEDZIA': '980206818cdc5bc8b50db8f0e4b3d22965c689a1c26c0da1a7b5fa27a50c82b3'
}
ORIGINAL = '''<link rel="icon" type="image/png" sizes="32x32" href="/matchthis-orange-mt79-32.png">
<link rel="icon" type="image/png" sizes="64x64" href="/matchthis-orange-mt79-64.png">
<link rel="shortcut icon" type="image/x-icon" href="/favicon.ico?matchthis=mt79">'''
REPLACEMENT = '''<link rel="icon" type="image/png" sizes="32x32" href="/matchthis-mt91-32.png">
<link rel="icon" type="image/png" sizes="64x64" href="/matchthis-mt91-64.png">
<link rel="shortcut icon" type="image/x-icon" href="/favicon.ico?v=mt91">
<link rel="apple-touch-icon" sizes="180x180" href="/matchthis-mt91-180.png">
<link rel="manifest" href="/matchthis-mt91.webmanifest">
<meta name="theme-color" content="#e96609">'''

def sha(data): return hashlib.sha256(data).hexdigest()

parts = [(root / 'assets' / f'mt91-bream-part{i}.b64').read_text('ascii').strip() for i in range(3)]
encoded = ''.join(parts)
assert [len(p) for p in parts] == [7116, 7116, 14232]
source = base64.b64decode(encoded, validate=True)
assert len(source) == 21348 and sha(source) == 'e31535151577a4bdd84d36affae5431c4a3f7b0642b60d7833867cf772ac8861'
logo = Image.open(io.BytesIO(source)).convert('RGB')
assert logo.size == (384, 384)
files = {}
for size in (16, 32, 48, 64, 180, 192, 512):
    path = out / f'matchthis-mt91-{size}.png'
    logo.resize((size,size), Image.Resampling.LANCZOS).save(path, optimize=True)
    files[path.name] = sha(path.read_bytes())
maskable = Image.new('RGB', (512,512), '#050505')
maskable.paste(logo.resize((410,410),Image.Resampling.LANCZOS), (51,51))
maskable.save(out / 'matchthis-mt91-maskable-512.png', optimize=True)
files['matchthis-mt91-maskable-512.png'] = sha((out / 'matchthis-mt91-maskable-512.png').read_bytes())
logo.save(out / 'favicon.ico', format='ICO', sizes=[(n,n) for n in (16,32,48,64)])
files['favicon.ico'] = sha((out/'favicon.ico').read_bytes())
manifest = {
    'id':'/', 'name':'MatchThis – Zawody Wędkarskie', 'short_name':'MatchThis',
    'description':'Zawody wędkarskie MatchThis', 'start_url':'/', 'scope':'/',
    'display':'standalone','background_color':'#050505','theme_color':'#e96609',
    'icons': [
      {'src':'/matchthis-mt91-192.png','sizes':'192x192','type':'image/png','purpose':'any'},
      {'src':'/matchthis-mt91-512.png','sizes':'512x512','type':'image/png','purpose':'any'},
      {'src':'/matchthis-mt91-maskable-512.png','sizes':'512x512','type':'image/png','purpose':'maskable'}
    ], 'version':'MT-91'
}
(out/'matchthis-mt91.webmanifest').write_text(json.dumps(manifest, ensure_ascii=False, separators=(',',':'))+'\n','utf8')
files['matchthis-mt91.webmanifest'] = sha((out/'matchthis-mt91.webmanifest').read_bytes())
for suffix, digest in SOURCE.items():
    path = base / f'MatchThis_MT-90{suffix}.html'
    oldbytes = path.read_bytes()
    assert sha(oldbytes) == digest, ('WRONG_MT90_BASE', path.name)
    old = oldbytes.decode('utf8')
    assert old.count(ORIGINAL) == 1
    assert old.count('<title>MatchThis MT-90</title>') == 1
    assert old.count('body data-version="MT-90"') == 1
    assert old.count("const APP_VERSION='MT-90'") == 1
    assert old.count('id="appversion" aria-label="Wersja MT-90">MT-90</span>') == 1
    new = old.replace(ORIGINAL, REPLACEMENT, 1).replace('MT-90','MT-91')
    assert new.count('<title>MatchThis MT-91</title>') == 1
    assert new.count('body data-version="MT-91"') == 1
    assert new.count("const APP_VERSION='MT-91'") == 1
    assert new.count('id="appversion" aria-label="Wersja MT-91">MT-91</span>') == 1
    assert 'MT-90' not in new
    assert new.replace('MT-91','MT-90').replace(REPLACEMENT,ORIGINAL,1) == old
    for i,script in enumerate(re.findall(r'<script\b[^>]*>(.*?)</script>', new, re.I|re.S)):
        if not script.strip(): continue
        f = Path(tempfile.gettempdir()) / f'mt91-{suffix or "admin"}-{i}.js'
        f.write_text(script,'utf8')
        subprocess.run(['node','--check',str(f)],check=True,capture_output=True)
    dest = out / f'MatchThis_MT-91{suffix}.html'
    dest.write_text(new,'utf8')
    files[dest.name] = sha(dest.read_bytes())
    print('MT91_VERSION_LOGIC_DATA_IDENTICAL_JS_PASS', dest.name,files[dest.name],flush=True)
print('MT91_ASSETS',json.dumps(files,sort_keys=True),flush=True)
