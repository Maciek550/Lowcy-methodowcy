from pathlib import Path
import re
import runpy

# Apply the already-reviewed V298 implementation first.
runpy.run_path('tools/v298_patch2.py', run_name='__main__')

# A few legacy regression tests still pin the application to V253.
# Keep those tests meaningful by synchronizing only their version assertions
# with the release under test. Historical feature names (V236/V237/etc.) stay intact.
for p in Path('tests').glob('*.test.cjs'):
    text = p.read_text(encoding='utf-8')
    original = text
    text = re.sub(r"const APP_VERSION = '\d+'", "const APP_VERSION = '298'", text)
    text = re.sub(r"const CLIENT_VERSION='\d+'", "const CLIENT_VERSION='298'", text)
    text = re.sub(r'class=\\"headerVersion\\">V\d+', r'class=\\"headerVersion\\">V298', text)
    if text != original:
        p.write_text(text, encoding='utf-8')
