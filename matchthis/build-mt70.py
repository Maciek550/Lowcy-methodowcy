from pathlib import Path
import json, re, hashlib, subprocess

D=Path(__file__).resolve().parent
SOURCE=next(root for root in (D,D.parent/'mt69work',D.parent) if (root/'MatchThis_MT-69_OGLADACZ.html').exists())
BASE={
    '':'cc3794c3a1874589bc20d2b37a94b284b06ea63a7f101c95a40c7ca83c563ab8',
    '_OGLADACZ':'90b111d6df3faf4612ff63c639e7ea38c3b7b0ff72ec595ca9c1d0237e87a621',
    '_SEDZIA':'705503d7f9a2af484c1041355c4d324acb919cd80dbade0bed4f558c1c3540da',
}
ID='mt2026-standalone-kiestralewicz-pawe'
EVENT='mt2026-traper-cup-kobialka'
OLD='KIESTRALEWICZ PAWEŁ'
NEW='WESTFALEWICZ PAWEŁ'

def replace_exact(text,before,after):
    assert text.count(before)==1,(before[:110],text.count(before))
    return text.replace(before,after,1)

MIGRATION='''// MT-70: one organizer-confirmed TRAPER CUP surname, sector A station 11, 4 285 g.
// Constrained by immutable source ID, event, date, sector, peg, weight and prior spelling.
// Never modify scores, sectors, points, places, unrelated players or other events.
function mt70ApplyApprovedTraperName(){
 const ev=db.events.find(e=>e.id==='mt2026-traper-cup-kobialka'&&e.date==='2026-04-11');
 const round=ev?.rounds?.find(t=>t.date==='2026-04-11');
 if(!round||!Array.isArray(round.results))return 0;
 const matches=round.results.filter(r=>r.competitorId==='mt2026-standalone-kiestralewicz-pawe'&&
    r.sector==='A'&&Number(r.peg)===11&&Number(r.weightG)===4285&&
    (r.competitorName==='KIESTRALEWICZ PAWEŁ'||r.competitorName==='WESTFALEWICZ PAWEŁ'));
 if(matches.length!==1)return 0;
 const row=matches[0];
 const player=db.players.find(p=>p.id==='mt2026-standalone-kiestralewicz-pawe');
 if(!player)return 0;
 let changed=0;
 if(row.competitorName==='KIESTRALEWICZ PAWEŁ'){
    row.competitorName='WESTFALEWICZ PAWEŁ';changed++;
 }
 if(row.nameNeedsReview===true){row.nameNeedsReview=false;changed++;}
 const others=db.events.flatMap(e=>e.rounds||[]).flatMap(t=>t.results||[])
    .filter(r=>r!==row&&r.competitorId===player.id);
 const safe=!others.some(r=>r.competitorName!=='WESTFALEWICZ PAWEŁ');
 if(safe&&fullName(player)==='KIESTRALEWICZ PAWEŁ'){
    player.lastName='WESTFALEWICZ';player.firstName='PAWEŁ';
    player.aliases=['WESTFALEWICZ PAWEŁ'];changed++;
 }
 if(safe&&fullName(player)==='WESTFALEWICZ PAWEŁ'&&
    player.nameNeedsReview===true&&!others.some(r=>r.nameNeedsReview===true)){
    player.nameNeedsReview=false;changed++;
 }
 if(changed)save();
 return changed;
}
const mt70ApprovedTraperNameChanges=mt70ApplyApprovedTraperName();
'''

for role,sha in BASE.items():
    src=SOURCE/f'MatchThis_MT-69{role}.html'
    assert src.is_file(),str(src)
    data=src.read_bytes()
    assert hashlib.sha256(data).hexdigest()==sha,('BASELINE_SHA_CHANGED',role)
    original=data.decode('utf8')
    start=original.index('const MATCHTHIS_STANDALONE_2026=')+len('const MATCHTHIS_STANDALONE_2026=')
    raw, length=json.JSONDecoder().raw_decode(original[start:]);end=start+length
    event=next(e for e in raw['data']['events'] if e['id']==EVENT)
    assert event['date']=='2026-04-11' and len(event['rounds'])==1
    rows=event['rounds'][0]['results']
    candidates=[r for r in rows if r.get('sector')=='A' and r.get('peg')==11]
    assert len(candidates)==1
    row=candidates[0]
    assert row=={'competitorId':ID,'competitorName':OLD,'sector':'A','peg':11,'weightG':4285,'nameNeedsReview':True},row
    player=next(p for p in raw['data']['players'] if p['id']==ID)
    assert player['lastName']=='KIESTRALEWICZ' and player['firstName']=='PAWEŁ' and player['nameNeedsReview'] is True
    assert sum(r.get('nameNeedsReview') is True for r in rows)==11
    reviews=[r for r in raw['sourceReview'] if r.get('event')=='TRAPER' and r.get('sector')=='A' and r.get('peg')==11]
    assert len(reviews)==1 and reviews[0]['originalTranscription']==OLD and reviews[0].get('verifiedName') is None
    old_row=json.dumps(row,ensure_ascii=False,separators=(',',':'))
    old_player=json.dumps(player,ensure_ascii=False,separators=(',',':'))
    old_review=json.dumps(reviews[0],ensure_ascii=False,separators=(',',':'))
    row['competitorName']=NEW;row['nameNeedsReview']=False
    player['lastName']='WESTFALEWICZ';player['firstName']='PAWEŁ';player['aliases']=[NEW];player['nameNeedsReview']=False
    reviews[0]['reviewStatus']='CONFIRMED';reviews[0]['verifiedName']=NEW
    reviews[0]['verifiedSource']='Decyzja organizatora 10.11.2026'
    reviews[0]['issue']='Potwierdzono prawidłowe nazwisko'
    s=original
    for old,new in [
        (old_row,json.dumps(row,ensure_ascii=False,separators=(',',':'))),
        (old_player,json.dumps(player,ensure_ascii=False,separators=(',',':'))),
        (old_review,json.dumps(reviews[0],ensure_ascii=False,separators=(',',':'))),
    ]:
        # Restricted to exact embedded source JSON to avoid modifying code or other competitions.
        sub=s[start:end];assert sub.count(old)==1,(old[:80],sub.count(old))
        sub=sub.replace(old,new,1);s=s[:start]+sub+s[end:];end+=len(new)-len(old)
    updated,_=json.JSONDecoder().raw_decode(s[start:])
    assert updated==raw
    assert len(updated['data']['events'][0]['rounds'][0]['results'])==55
    assert sum(r.get('nameNeedsReview') is True for r in updated['data']['events'][0]['rounds'][0]['results'])==10
    assert sum(r.get('nameNeedsReview') is True for r in updated['data']['events'][1]['rounds'][0]['results'])==1
    # Apart from the designated row, person and sourceReview, preserve the complete imported dataset.
    s=replace_exact(s,'<title>MatchThis MT-69</title>','<title>MatchThis MT-70</title>')
    s=replace_exact(s,'data-version="MT-69"','data-version="MT-70"')
    s=replace_exact(s,'aria-label="Wersja MT-69">MT-69','aria-label="Wersja MT-70">MT-70')
    s=replace_exact(s,'<div class="version" id="appversion">MT-69</div>','<div class="version" id="appversion">MT-70</div>')
    s=replace_exact(s,"const APP_VERSION='MT-69';","const APP_VERSION='MT-70';")
    s=replace_exact(s,"const STORAGE_KEY='matchthis-preview-MT-69';","const STORAGE_KEY='matchthis-preview-MT-70';\nconst MT69_STORAGE_KEY='matchthis-preview-MT-69';")
    if role!='_OGLADACZ':
        s=replace_exact(s,'localStorage.getItem(MT68_STORAGE_KEY)||','localStorage.getItem(MT69_STORAGE_KEY)||localStorage.getItem(MT68_STORAGE_KEY)||')
    s=replace_exact(s,'const mt69ApprovedTraperNameChanges=mt69ApplyApprovedTraperNames();',
        'const mt69ApprovedTraperNameChanges=mt69ApplyApprovedTraperNames();\n'+MIGRATION)
    # Verify that restoring an old local DB has a one-time version migration and precise guard.
    assert 'const mt70ApprovedTraperNameChanges=mt70ApplyApprovedTraperName();' in s
    assert 'function mt67DownloadAllDrawSectors' in s
    assert 'function mt66BulkConfirm' in s
    assert 'function mt65SaveSectorSize' in s
    for script in re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S):
        if script.strip():
            scratch=D/'_mt70_syntax.js';scratch.write_text(script,encoding='utf8')
            subprocess.run(['node','--check',str(scratch)],check=True)
            scratch.unlink()
    output=D/f'MatchThis_MT-70{role}.html';output.write_text(s,encoding='utf8')
    print('MT70_BUILT',role or 'ADMIN',hashlib.sha256(output.read_bytes()).hexdigest(),output.stat().st_size)
