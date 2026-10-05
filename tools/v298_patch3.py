from pathlib import Path
import re
import runpy

# Apply the already-reviewed V298 implementation first.
runpy.run_path('tools/v298_patch2.py', run_name='__main__')

# Fix the generated focused test file: patch2 intentionally used a raw triple-quoted
# payload and left one literal backslash at the beginning. Remove only that marker.
focused = Path('tests/competition-rounds-v298.test.cjs')
if focused.exists():
    t = focused.read_text(encoding='utf-8')
    if t.startswith('\\\n'):
        focused.write_text(t[2:], encoding='utf-8')
    elif t.startswith('\\'):
        focused.write_text(t[1:], encoding='utf-8')

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
