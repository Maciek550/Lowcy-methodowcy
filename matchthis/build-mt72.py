from pathlib import Path
import hashlib,re,subprocess,json
D=Path('matchthis')
OUT=D
BASIS={'':'221d744077e7a633937a5a428681d9aebb7d293fde8cfdb98a290a63301559e6','_OGLADACZ':'74118fde6cf5cf01e2b3a05141be5d11020797fa223a262f2367366baa3ee438','_SEDZIA':'447e293fc0ccb11b2fedfbc964ff6f3c04f29a5c8a45da115c5bd107e07d14f6'}
for role,sha in BASIS.items():
    src=D/f'MatchThis_MT-71{role}.html'
    assert hashlib.sha256(src.read_bytes()).hexdigest()==sha,(role,'baseline changed')
    s=src.read_text('utf8')
    def sub(a,b, count=1):
        global s
        n=s.count(a)
        assert n==count,(role,'expected hits',count,'found',n,a[:120])
        s=s.replace(a,b)
    # Review flags and archives remain untouched; remove only visible review signage.
    sub('.result-edit-table .row-needs-review td:first-child{border-left:3px solid #e96609;background:#fff7ee}','')
    sub("if(isReview){print(p,'ARCHIWUM — DANE DO WERYFIKACJI',margin,below-26,9,'bold','#bb540e');}","// Review metadata retained in source records; public PDF carries no review banner.")
    sub("${row.nameNeedsReview?'<small class=\"review-name\" title=\"Zapis nazwiska wymaga kontroli z fotografią\">Sprawdź nazwisko</small>':''}","")
    sub("Wiersze ze źródeł archiwalnych, których nazwiska wymagają kontroli, są oznaczone.","")
    sub("${r.nameNeedsReview?'<small class=\"review-name\">Do sprawdzenia</small>':''}","")
    sub("(mt64RosterNameNeedsReview(e,p)?'<small class=\"review-name\">Potwierdź zapis nazwiska</small>':'')+",'')
    sub(' const reviewCount=rounds.reduce((n,r)=>n+(r.results||[]).filter(x=>x.nameNeedsReview).length,0);','')
    sub("${reviewCount?`<div class=\"notice\">${reviewCount} nazwisk w archiwalnej transkrypcji oznaczono do sprawdzenia. Nie publikuj tych wyników jako ostatecznych bez weryfikacji.</div>`:''}",'')
    sub("${needsReview?'WYNIKI ARCHIWALNE — DO WERYFIKACJI':tour.status==='FINAL'?'WYNIKI OFICJALNE':'WYNIKI ROBOCZE'}","${needsReview?'WYNIKI ARCHIWALNE':tour.status==='FINAL'?'WYNIKI OFICJALNE':'WYNIKI ROBOCZE'}")
    sub('Brak zweryfikowanych wyników z ${year} r.','Brak wyników z ${year} r.')
    sub('Wyniki zostaną pokazane po weryfikacji protokołu.','Brak opublikowanych wyników.',count=2)
    sub('Zachowano oficjalne wartości do weryfikacji.','Sprawdź zgodność sum z czterema liczonymi turami w panelu administratora.')
    s=s.replace('MT-71','MT-72')
    sub("const STORAGE_KEY='matchthis-preview-MT-72';", "const STORAGE_KEY='matchthis-preview-MT-72';\nconst MT71_STORAGE_KEY='matchthis-preview-MT-71';")
    if role!='_OGLADACZ':
        sub('localStorage.getItem(MT70_STORAGE_KEY)||','localStorage.getItem(MT71_STORAGE_KEY)||localStorage.getItem(MT70_STORAGE_KEY)||')
    for check in ('<title>MatchThis MT-72</title>','data-version="MT-72"','aria-label="Wersja MT-72">MT-72',"const APP_VERSION='MT-72';","const STORAGE_KEY='matchthis-preview-MT-72';",'<div class="version" id="appversion">MT-72</div>'):
        assert check in s,(role,check)
    for i,script in enumerate(re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S)):
        if script.strip():
            temp=OUT/f'_script_{i}{role}.js';temp.write_text(script,'utf8')
            subprocess.run(['node','--check',str(temp)],check=True)
            temp.unlink()
    target=OUT/f'MatchThis_MT-72{role}.html'
    target.write_text(s,'utf8')
    assert 'nameNeedsReview' in s
    assert 'Sprawdź nazwisko</small>' not in s
    assert 'Do sprawdzenia</small>' not in s
    assert 'Potwierdź zapis nazwiska</small>' not in s
    print(role or 'ADMIN',len(s),hashlib.sha256(s.encode()).hexdigest())
