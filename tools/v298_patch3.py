from pathlib import Path
import re
import runpy

# Apply the already-reviewed V298 implementation first.
runpy.run_path('tools/v298_patch2.py', run_name='__main__')

# Normalize the generated focused test file.
focused = Path('tests/competition-rounds-v298.test.cjs')
if focused.exists():
    t = focused.read_text(encoding='utf-8')
    if t.startswith('\\\n'):
        t = t[2:]
    elif t.startswith('\\'):
        t = t[1:]
    old = "function extractFunction(name,nextName){const start=server.indexOf('function '+name+'('),end=server.indexOf('\\nfunction '+nextName+'(',start);assert.ok(start>=0&&end>start,'cannot extract '+name);return server.slice(start,end)}"
    new = "function extractFunction(name,nextName){const start=server.indexOf('function '+name+'(');let end=server.indexOf('\\nfunction '+nextName+'(',start);if(end<0)end=server.indexOf('\\nasync function '+nextName+'(',start);assert.ok(start>=0&&end>start,'cannot extract '+name);return server.slice(start,end)}"
    if old not in t:
        raise SystemExit('V298 patch3: focused extractor anchor missing')
    t = t.replace(old, new, 1)
    focused.write_text(t, encoding='utf-8')

# A few legacy regression tests still pin the application to old release numbers.
# Synchronize only version assertions; historical feature labels stay untouched.
for p in Path('tests').glob('*.test.cjs'):
    text = p.read_text(encoding='utf-8')
    original = text
    text = re.sub(r"const APP_VERSION = '\d+'", "const APP_VERSION = '298'", text)
    text = re.sub(r"const CLIENT_VERSION='\d+'", "const CLIENT_VERSION='298'", text)
    text = re.sub(r'class=\\"headerVersion\\">V\d+', r'class=\\"headerVersion\\">V298', text)
    if text != original:
        p.write_text(text, encoding='utf-8')
