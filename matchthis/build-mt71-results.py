#!/usr/bin/env python3
"""MatchThis MT70->MT71: SHA-locked roles, two approved 2026 weights and shared ranks."""
import hashlib,json,re,subprocess
from pathlib import Path
d=Path('matchthis')
baselines={'':'e21ba17b772dd52152fdad791bc1ad2cdd80d614084c55ec36b763f1f9cfa07e','_OGLADACZ':'ef6f8b5839f56f44fba6fff47eaf26d09714d7861ef7285199167dde94db9ee0','_SEDZIA':'e0c3dcab7211a8f0fbab4ac0d17599df65bfe92520025b8b06c5e5f24b3ab72b'}
outshas={'':'221d744077e7a633937a5a428681d9aebb7d293fde8cfdb98a290a63301559e6','_OGLADACZ':'74118fde6cf5cf01e2b3a05141be5d11020797fa223a262f2367366baa3ee438','_SEDZIA':'447e293fc0ccb11b2fedfbc964ff6f3c04f29a5c8a45da115c5bd107e07d14f6'}
oldtour='return ranked.slice().sort((a,b)=>a.place-b.place||b.weightG-a.weightG||sortText(a.competitorName||a.competitorId,b.competitorName||b.competitorId)).map((r,i)=>({...r,order:i+1}));'
newtour='''let preceding=null,sharedOrder=0;
    return ranked.slice().sort((a,b)=>a.place-b.place||b.weightG-a.weightG||sortText(a.competitorName||a.competitorId,b.competitorName||b.competitorId)).map((r,i)=>{
      if(!preceding || r.place!==preceding.place || r.weightG!==preceding.weightG)sharedOrder=i+1;
      preceding=r;
      return {...r,order:sharedOrder};
    });'''
oldevent='rows.forEach((r,i)=>r.rank=r.eligible?i+1:null);'
newevent='''let previousRanked=null,sharedRank=0;
    rows.forEach((r,i)=>{
      if(!r.eligible){r.rank=null;return;}
      if(!previousRanked || r.points!==previousRanked.points || r.weightG!==previousRanked.weightG)sharedRank=i+1;
      r.rank=sharedRank;
      previousRanked=r;
    });'''
repair="""// MT-71: repair only two organizer-approved 2026 overall weight sums.
// Guard on exact old total and points; preserve 2025 archives, all tours, and local edits.
function mt71RepairApprovedCycleWeights(){
 const cycle=db.cycles.find(c=>c.id==='mt2026-mega-match-this-cup-cycle');
 if(!cycle || cycle.officialDataEdited===true)return 0;
 const fixes=[
  {id:'mt2026-person-chyb-andrzej',name:'CHYB ANDRZEJ',points:119,old:4295,approved:6040},
  {id:'mt2026-person-krackowski-kazimierz',name:'KRĄCKOWSKI KAZIMIERZ',points:220,old:1695,approved:4745},
 ];
 let changed=0;
 for(const fix of fixes){
  const row=cycle.officialRows?.[fix.id];
  if(!row || Number(row.points)!==fix.points)continue;
  if(Number(row.weightG)===fix.old){row.weightG=fix.approved;changed++;}
  if(Number(row.weightG)===fix.approved){
   for(const issue of cycle.sourceIssues||[]){
    if(issue.name===fix.name && !issue.resolved){
     issue.resolved=true;
     issue.resolution='Suma wag zatwierdzona przez organizatora w MT-71; pierwotna wartość zachowana w source.';
     changed++;
    }
   }
  }
 }
 if(changed)save();
 return changed;
}
try{mt71RepairApprovedCycleWeights()}catch(err){console.warn('MT-71: korekta zatwierdzonych sum nie powiodła się',err)}
"""
for suffix,sha in baselines.items():
  path=d/f'MatchThis_MT-70{suffix}.html'
  assert hashlib.sha256(path.read_bytes()).hexdigest()==sha,('MT70_BASELINE_HASH_CHANGED',suffix)
  s=path.read_text(encoding='utf8')
  assert s.count(oldtour)==1 and s.count(oldevent)==1
  s=s.replace(oldtour,newtour).replace(oldevent,newevent)
  start=s.index('const MATCHTHIS_ARCHIVE_2026=')+len('const MATCHTHIS_ARCHIVE_2026=')
  end=s.index(';\n',start)
  archive=json.loads(s[start:end])
  c=next(x for x in archive['data']['cycles'] if x['id']=='mt2026-mega-match-this-cup-cycle')
  assert c['officialDataEdited'] is False
  for id,name,pts,old,new in (
    ('mt2026-person-chyb-andrzej','CHYB ANDRZEJ',119,4295,6040),
    ('mt2026-person-krackowski-kazimierz','KRĄCKOWSKI KAZIMIERZ',220,1695,4745)):
    row=c['officialRows'][id]
    assert row['points']==pts and row['weightG']==old,(id,row)
    row['weightG']=new
    issue=next(x for x in c['sourceIssues'] if x['name']==name)
    assert issue['source']==[pts,old] and issue['computed']==[pts,new]
    issue['resolved']=True
    issue['resolution']='Suma wag zgodna z czterema liczonymi turami, zatwierdzona przez organizatora; poprzednia wartość zachowana w polu source.'
  s=s[:start]+json.dumps(archive,ensure_ascii=False,separators=(',',':'))+s[end:]
  a='cycle.sourceIssues?.length&&!cycle.officialDataEdited'
  b='cycle.sourceIssues?.some(issue=>!issue.resolved)&&!cycle.officialDataEdited'
  assert s.count(a)==1
  s=s.replace(a,b)
  if suffix!='_OGLADACZ':
    a='function applyVerifiedFifthTourSectorImport(){'
    assert s.count(a)==1
    s=s.replace(a,repair+a)
    a='const r=mergeDatabase(data.data);selectedPlayerIds.clear();'
    assert s.count(a)==1
    s=s.replace(a,'const r=mergeDatabase(data.data);mt71RepairApprovedCycleWeights();selectedPlayerIds.clear();')
  assert s.count('MT-70')==8
  s=s.replace('MT-70','MT-71')
  a="const MT69_STORAGE_KEY='matchthis-preview-MT-69';"
  assert s.count(a)==1
  if suffix!='_OGLADACZ':
    s=s.replace(a,"const MT70_STORAGE_KEY='matchthis-preview-MT-70';\n"+a)
    a='localStorage.getItem(MT69_STORAGE_KEY)||localStorage.getItem(MT68_STORAGE_KEY)'
    assert s.count(a)==1
    s=s.replace(a,'localStorage.getItem(MT70_STORAGE_KEY)||'+a)
  s=s.replace("a.download='MatchThis_MT-23_backup.json'","a.download='MatchThis_MT-71_backup.json'")
  for marker in ('<title>MatchThis MT-71</title>','data-version="MT-71"',"const APP_VERSION='MT-71'","const STORAGE_KEY='matchthis-preview-MT-71'",'id="appversion">MT-71<'):
    assert marker in s,(suffix,marker)
  for i,script in enumerate(re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S)):
    if script.strip():
      temp=d/f'_mt71_check_{i}{suffix}.js'
      temp.write_text(script,encoding='utf8')
      subprocess.run(['node','--check',str(temp)],check=True)
      temp.unlink()
  out=d/f'MatchThis_MT-71{suffix}.html'
  out.write_text(s,encoding='utf8')
  assert hashlib.sha256(out.read_bytes()).hexdigest()==outshas[suffix],('OUTPUT_SHA_MISMATCH',suffix)
  print('MT71_VERIFIED',suffix or 'ADMIN',outshas[suffix],out.stat().st_size)
