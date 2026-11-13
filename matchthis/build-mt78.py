#!/usr/bin/env python3
"""MT78 minimal Foto FB fix from exact deployed MT77 across three roles.

Fixes the undefined datedTourLabel in JPG canvas rendering and lets the draw
ZIP generator read genuine imported historical pegs when mt55Entries is empty.
Does not touch any underlying data, role, PDF renderer, or result calculation.
"""
from pathlib import Path
import subprocess,hashlib,re
D=Path('matchthis')
SOURCES={
'':'ea61426e32455b591c5c464e7de93118a10e485daa412137095f131d37dcecd3',
'_OGLADACZ':'a74812f3f8dccb855ae59b5ae1731f195e08e346ff029cd4e73bdbd8af2cabab',
'_SEDZIA':'91033a1f6abc2685f1598aedfc0ce8608bc74edc5b44edacf7b353022ea176c1'
}
ANCHOR='/* MatchThis R14: standalone, offline VECTOR PDF export. No canvas or image data is used here. */'
HELPER=r"""/* MT78: photo and vector export live in a different script scope than
 * the navigation module. Supply a safe tour label locally, not an unresolved
 * function from the private async application closure. */
function datedTourLabel(tour,entity){
 const raw=String(tour?.name||'').replace(/\b\d{4}-\d{2}-\d{2}\b/g,'').trim();
 const number=String(tour?.id||'').match(/round(\d+)$/);
 const name=number?'TURA '+number[1]:(raw||'TURA');
 const iso=String(tour?.date||entity?.date||'');
 const date=/^\d{4}-\d{2}-\d{2}$/.test(iso)?iso.slice(8,10)+'.'+iso.slice(5,7)+'.'+iso.slice(0,4):iso;
 return name+(date?' · '+date:'');
}
"""
SOURCE='const source=Array.isArray(t?.mt55Entries)?t.mt55Entries:[];'
REPLACEMENT=r"""// MT78: organizer-confirmed historical stations may be in results instead of
 // in the automated draw's mt55Entries. Use only explicit real peg/sector/name.
 const drawn=Array.isArray(t?.mt55Entries)?t.mt55Entries:[];
 const valid=r=>r&&r.peg!==null&&r.peg!==undefined&&Number.isSafeInteger(Number(r.peg))&&Number(r.peg)>0&&
   typeof r.sector==='string'&&/^[A-Z]+$/.test(r.sector)&&String(r.competitorName||'').trim();
 const source=drawn.some(valid)?drawn:(Array.isArray(t?.results)?t.results:[]);"""
for role,expected in SOURCES.items():
    file=D/f'MatchThis_MT-77{role}.html'
    data=file.read_bytes()
    assert hashlib.sha256(data).hexdigest()==expected,('MT77_BASELINE_SHA_MISMATCH',role)
    s=data.decode('utf8')
    assert s.count(ANCHOR)==1 and s.count(SOURCE)==1
    assert s.count('MT-77')==(9 if role=='_OGLADACZ' else 12)
    s=s.replace(ANCHOR,HELPER+ANCHOR,1)
    s=s.replace(SOURCE,REPLACEMENT,1)
    s=s.replace('MT-77','MT-78')
    for check in ['<title>MatchThis MT-78</title>','data-version="MT-78"',"const APP_VERSION='MT-78';",'id="appversion">MT-78']:
        assert check in s,(role,check)
    assert s.count('MT-78')==(9 if role=='_OGLADACZ' else 12)
    for i,js in enumerate(re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S)):
        if js.strip():
            path=Path('/tmp/check-mt78.js')
            path.write_text(js,encoding='utf8')
            subprocess.run(['node','--check',str(path)],check=True)
    out=D/f'MatchThis_MT-78{role}.html'
    out.write_text(s,encoding='utf8')
    print('MT78_BUILT',role or 'ADMIN','sha256',hashlib.sha256(out.read_bytes()).hexdigest(),'bytes',out.stat().st_size)
