from pathlib import Path
import hashlib,re,subprocess
D=Path(__file__).resolve().parent
BASE={
 '':'', '_OGLADACZ':'', '_SEDZIA':''
}
for suffix in BASE:
    b=(D/'home/runner/work/Lowcy-methodowcy/Lowcy-methodowcy/matchthis'/f'MatchThis_MT-67{suffix}.html').read_bytes()
    BASE[suffix]=hashlib.sha256(b).hexdigest()

def one(s,a,b):
    count=s.count(a)
    assert count==1,(a[:110],count)
    return s.replace(a,b,1)

def allof(s,a,b,n):
    count=s.count(a)
    assert count==n,(a[:110],count,n)
    return s.replace(a,b)

helper='''// MT-68: one display label for all rounds. Existing round names and dates remain untouched.
const MT68_WEEKDAYS=['NIEDZIELA','PONIEDZIAŁEK','WTOREK','ŚRODA','CZWARTEK','PIĄTEK','SOBOTA'];
function mt68RoundNumber(tour,entity,index){
 if(Number.isInteger(index)&&index>=0)return index+1;
 const rounds=entity?getRounds(entity):[];
 const found=rounds.findIndex(x=>x===tour||x.id&&tour?.id&&x.id===tour.id);
 if(found>=0)return found+1;
 const name=String(tour?.name||'');
 const arabic=name.match(/^\\s*(?:tura\\s*)?(\\d+)(?:\\.\\s*tura)?\\b/i);
 if(arabic)return Number(arabic[1]);
 const roman=name.match(/^\\s*(I|II|III|IV|V|VI|VII|VIII|IX|X)\\s*tura\\b/i);
 if(roman){const numerals={I:1,II:2,III:3,IV:4,V:5,VI:6,VII:7,VIII:8,IX:9,X:10};return numerals[roman[1].toUpperCase()];}
 return 1;
}
function mt68TourDayDate(tour,entity){
 const iso=verifiedIsoDate(tour?.date)||(entity&&getRounds(entity).length===1?verifiedIsoDate(entity.date):'');
 if(!iso)return 'DATA NIEPOTWIERDZONA';
 const date=new Date(iso+'T12:00:00Z');
 if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==iso)return 'DATA NIEPOTWIERDZONA';
 return MT68_WEEKDAYS[date.getUTCDay()]+' '+plDate(iso);
}
function mt68TourLabel(tour,entity,index){
 return 'TURA '+mt68RoundNumber(tour,entity,index)+' · '+mt68TourDayDate(tour,entity);
}
function mt68TourTitle(tour,entity,index){return 'TURA '+mt68RoundNumber(tour,entity,index);}
'''
css='''<style id="mt68-readable-round-labels">
/* A two-line tab makes the number and the weekday/date readable on narrow screens. */
.rounds button.mt68-round-button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;min-height:45px;padding:6px 10px;line-height:1.2;white-space:normal;text-align:center}
.rounds button.mt68-round-button strong{font-size:12px;letter-spacing:.02em}
.rounds button.mt68-round-button small{font-size:10px;opacity:.9;font-weight:600;white-space:nowrap}
@media(max-width:470px){.rounds button.mt68-round-button{flex:1 1 135px}.rounds button.mt68-round-button small{font-size:9px}}
</style>'''

for suffix,sha in BASE.items():
    filename=D/'home/runner/work/Lowcy-methodowcy/Lowcy-methodowcy/matchthis'/f'MatchThis_MT-67{suffix}.html'
    s=filename.read_text('utf8')
    assert hashlib.sha256(s.encode()).hexdigest()==sha
    # Unique release version everywhere, keep all prior localStorage keys for migration.
    for a,b in [
      ('<title>MatchThis MT-67</title>','<title>MatchThis MT-68</title>'),
      ('data-version="MT-67"','data-version="MT-68"'),
      ('aria-label="Wersja MT-67">MT-67','aria-label="Wersja MT-68">MT-68'),
      ('<div class="version" id="appversion">MT-67</div>','<div class="version" id="appversion">MT-68</div>'),
      ("const APP_VERSION='MT-67';","const APP_VERSION='MT-68';"),
      ("const STORAGE_KEY='matchthis-preview-MT-67';","const STORAGE_KEY='matchthis-preview-MT-68';\nconst MT67_STORAGE_KEY='matchthis-preview-MT-67';")
    ]:s=one(s,a,b)
    # Automatic local state migration; preserve existing data and don't overwrite source.
    migration='localStorage.getItem(MT66_STORAGE_KEY)||'
    if migration in s:
        s=one(s,migration,'localStorage.getItem(MT67_STORAGE_KEY)||'+migration)
    # Append CSS separately and insert helper at original derived date formatter.
    s=s.replace('</head>',css+'\n</head>',1)
    old='''function datedTourLabel(tour,entity){
 const name=String(tour?.name||'Tura'),date=dateForTour(tour,entity);
 if(!date)return name+' · data niepotwierdzona';
 // Nie dubluj daty już zapisanej w nazwie tury.
 return name.includes(date)||name.includes(verifiedIsoDate(tour?.date))&&!!verifiedIsoDate(tour?.date)?name:name+' · '+date;
}'''
    s=one(s,old,helper+'\nfunction datedTourLabel(tour,entity){return mt68TourLabel(tour,entity);}')
    # Event details, public draws, results, administration, archive and photo headers.
    replacements=[
      ('${roundIndex+1}. tura · ${dateCompact}', '${safeName(mt68TourLabel(t,e,roundIndex))}'),
      ('${i+1}. tura · ${empty?\'BRAK WYNIKÓW\':safeName(tourDateLabel(r,e))}', '<strong>${safeName(mt68TourTitle(r,e,i))}</strong><small>${safeName(mt68TourDayDate(r,e))}${empty?\' · BRAK WYNIKÓW\':\'\'}</small>'),
      ('class="${!overall&&i===roundIndex?\'active\':\'\'}" data-round=', 'class="mt68-round-button ${!overall&&i===roundIndex?\'active\':\'\'}" data-round='),
      ("'<b>'+safeName((index+1)+'. tura')+'</b><span class=\"date\">'+safeName(date)+' · '+safeName(tour.name||'Wyniki tury')+'</span>","'<b>'+safeName(mt68TourTitle(tour,cycle,index))+'</b><span class=\"date\">'+safeName(mt68TourDayDate(tour,cycle))+'</span>"),
      ("'+safeName(tour.name)+' · '+safeName(tourDateLabel(tour,entity))+'", "'+safeName(mt68TourLabel(tour,entity))+'"),
      ("'+safeName(x.tour.name)+' · '+safeName(tourDateLabel(x.tour,x.entity))+'", "'+safeName(mt68TourLabel(x.tour,x.entity,x.index))+'"),
      ("String(tour.name||'Tura')+'  •  '+tourDateLabel(tour,entity)","mt68TourLabel(tour,entity)"),
      ("'+safeName(x.tour.name)+' · '+safeName(tourDateLabel(x.tour,entity))+'", "'+safeName(mt68TourLabel(x.tour,entity,x.index))+'"),
      ("${safeName(x.tour.name)} · ${safeName(tourDateLabel(x.tour,entity))}","${safeName(mt68TourLabel(x.tour,entity,x.index))}"),
      ("${safeName(tourDateLabel(chosenRound.tour,entity))} · ${safeName(chosenRound.tour.name)}", "${safeName(mt68TourLabel(chosenRound.tour,entity,chosenRound.index))}"),
      ("${safeName(tour.name)} · ${safeName(tourDateLabel(tour))}","${safeName(mt68TourLabel(tour,null))}"),
      ("${safeName(t.name)} · ${safeName(tourDateLabel(t,e))}","${safeName(mt68TourLabel(t,e))}"),
      ("${safeName(t.name)}", "${safeName(mt68TourLabel(t,e))}"),
      ("'+safeName(t.name)+'", "'+safeName(mt68TourLabel(t,e))+'"),
      ("${safeName(tour.name)}", "${safeName(mt68TourLabel(tour,entity))}"),
      ("${roundIndex+1}. tury", "TURY ${roundIndex+1}"),
      ("${roundIndex+1}. tura", "TURA ${roundIndex+1}"),
    ]
    for a,b in replacements:
        if a not in s:
            print('SKIP',suffix,a[:100]);continue
        # Avoid template data modifications; only transform JS view references.
        if a=='${safeName(tour.name)}' and s.count(a)>6:
            print('SKIP_AMBIGUOUS',suffix,a,s.count(a));continue
        s=s.replace(a,b)
    # Archive tiles and public published-status strips have their own label renderers.
    s=one(s,"safeName((index+1)+'. tura')","safeName(mt68TourTitle(tour,cycle,index))")
    s=one(s,"safeName(date)+' · '+safeName(tour.name||'Wyniki tury')","safeName(mt68TourDayDate(tour,cycle))")
    if suffix=='_OGLADACZ':
        s=one(s,"class=\"${resultMode!=='publishedDraw'&&!overall&&i===roundIndex?'active':''}\" data-round=", "class=\"mt68-round-button ${resultMode!=='publishedDraw'&&!overall&&i===roundIndex?'active':''}\" data-round=")
        label="safeName(x.t.name)+\n  ' · '+safeName(tourDateLabel(x.t,e))"
        assert label in s
        s=one(s,label,"safeName(mt68TourLabel(x.t,e))")
    # Sektor result headings must include the weekday too, not date alone.
    s=s.replace("safeName(tourDateLabel(t,e))} · ${sr.length}", "safeName(mt68TourLabel(t,e))} · ${sr.length}")
    # Historical profile tour labels only at rendering, never change stored data.
    s=one(s,"tourName:tour.name||('Tura '+(index+1)),tourNumber:index+1", "tourName:mt68TourLabel(tour,entity,index),tourNumber:index+1")
    # All summary tables and mobile responsive cells show TURA and date without the ordinal shorthand.
    s=one(s,'''title="${safeName(tourDateLabel(rounds[i]))} · Punkty, sektor i stanowisko tury ${i+1}">Tura ${i+1}<small class="round-label">${safeName(tourDateLabel(rounds[i]))}</small>''',
            '''title="${safeName(mt68TourLabel(rounds[i],null,i))} · Punkty, sektor i stanowisko">TURA ${i+1}<small class="round-label">${safeName(mt68TourDayDate(rounds[i],null))}</small>''')
    s=one(s,'''<span title="${safeName(tourDateLabel(tour))}">T${i+1} · ${safeName(tourDateLabel(tour))}</span>''',
            '''<span title="${safeName(mt68TourLabel(tour,null,i))}">TURA ${i+1} · ${safeName(mt68TourDayDate(tour,null))}</span>''')
    # Printed vector PDF title and footer, filename changed only, raw results preserved.
    s=s.replace("formatted(tourDateLabel(tour,entity))", "formatted(mt68TourLabel(tour,entity))")
    s=s.replace("safeFilePart(tour.name)","safeFilePart(mt68TourLabel(tour,entity))")
    # HTML printable sector cards get the same informative label.
    s=s.replace('safeName(tour.name)}', 'safeName(mt68TourLabel(tour,entity))}')
    # Note: publishing payload tourName intentionally stays unchanged (API compatibility).
    # Basic invariants: all historical JSON corpora copied byte-for-byte.
    old=filename.read_text('utf8')
    for key in ('MATCHTHIS_ARCHIVE_2026','MATCHTHIS_STANDALONE_2026','MATCHTHIS_ARCHIVE_2025_MEGA_V',
               'MATCHTHIS_ARCHIVE_2025_MAVER_OCT','MT44_MISSING_2025','MT44_MEGA_2025',
               'MT45_MEGA_2025_ROUNDS','MT46_PUCHAR_ROUND1_DRAW','MT47_PUCHAR_ROUND2_DRAW','MT48_FLOAT_ROUND2_DRAW'):
        source=lambda z:z.split('const '+key+'=',1)[1].split(';\n',1)[0]
        assert source(old)==source(s),(suffix,key)
    for script in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S):
        if script.strip():
            t=D/'_mt68_check.js';t.write_text(script,'utf8');subprocess.run(['node','--check',str(t)],check=True);t.unlink()
    out=D/f'MatchThis_MT-68{suffix}.html';out.write_text(s,'utf8')
    print('BUILT',out.name,len(s),hashlib.sha256(s.encode()).hexdigest())
