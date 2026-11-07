from pathlib import Path
import re
base=Path(__file__).resolve().parent
for suffix in ('','_SEDZIA','_OGLADACZ'):
    src=base/f'MatchThis_MT-40{suffix}.html'
    out=base/f'MatchThis_MT-41{suffix}.html'
    s=src.read_text(encoding='utf-8')
    if s.count("const APP_VERSION='MT-40';")!=1: raise ValueError(f'missing version in {src.name}')
    s=s.replace('MT-40','MT-41')
    if suffix!='_OGLADACZ':
        anchor="const MT39_STORAGE_KEY='matchthis-preview-MT-39';"
        if s.count(anchor)!=1:raise ValueError('storage key anchor absent')
        s=s.replace(anchor,"const MT40_STORAGE_KEY='matchthis-preview-MT-40';\n"+anchor)
        old="localStorage.getItem(STORAGE_KEY);const loaded=JSON.parse(fresh||localStorage.getItem(MT39_STORAGE_KEY)"
        new=old.replace("fresh||", "fresh||localStorage.getItem(MT40_STORAGE_KEY)||")
        if s.count(old)!=1:raise ValueError('migration fallback missing')
        s=s.replace(old,new)
        anchor='<form id="mtLogoutForm" action="/logout.php" method="post" style="margin:0">'
        if s.count(anchor)!=1:raise ValueError('logout form missing')
        s=s.replace(anchor,'<a class="btn small secondary mt-login mt-password-link" href="/change-password.php">Zmień hasło</a>'+anchor)
        s=s.replace('.mt-login{padding:', '.mt-password-link{text-decoration:none}.mt-login{padding:')
    if not re.search(r'<title>MatchThis MT-41</title>',s):raise ValueError('html title mismatch')
    if not re.search(r'data-version="MT-41"',s):raise ValueError('data version mismatch')
    if "const APP_VERSION='MT-41'" not in s:raise ValueError('JS version mismatch')
    out.write_text(s,encoding='utf-8')
    print(out.name, out.stat().st_size)
