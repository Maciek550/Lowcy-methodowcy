from pathlib import Path
import json,re
root=Path(__file__).resolve().parent
records=[]
for line in (root/'mt42_maver_oct2025.tsv').read_text(encoding='utf8').splitlines():
 if not line or line.startswith('#'):continue
 name,peg,w1,p1,w2,p2=line.split('|')
 if name=='ZYDRUNAS ULEVICIUS':last,first='ULEVICIUS','ZYDRUNAS'
 elif name=='SILVIUS DVILIS':last,first='DVILIS','SILVIUS'
 else:last,first=name.rsplit(' ',1)
 n=int(peg) if peg else None
 sector=('A' if n<=10 else 'B' if n<=20 else 'C') if n else None
 records.append(dict(name=name,last=last,first=first,peg=n,sector=sector,w1=int(w1),p1=float(p1),w2=int(w2),p2=float(p2)))
assert len(records)==32 and len(set(x['name'] for x in records))==32
assert sorted(x['peg'] for x in records if x['peg'])==list(range(1,31))
assert [sum(x['sector']==s for x in records) for s in 'ABC']==[10,10,10]
assert [x['p1']+x['p2'] for x in records]==[3,5,6,6,6,7,7,7,7,8,8,9.5,11.5,12,12,12,13,13,14,14,14,15,15,15,16,16,17,18,19,20,34,34]
assert [x['w1']+x['w2'] for x in records]==[20890,23210,23220,17950,14505,19610,18920,18470,18135,15150,15035,18100,12840,15255,14920,13030,16075,13405,15130,13105,12180,14405,14010,9785,13130,11655,11705,9375,8390,6930,11530,10200]
assert sorted(records,key=lambda x:(x['p1']+x['p2'],-x['w1']-x['w2']))==records
description='MAVER SUPER CUP 11–12.10.2025: tura 1 źródła 558908097, 558258285, 560636609, 559217588; końcowa tabela i tura 2 559138797. Nie podano stanowisk i sektorów tury 2.'
players=[];first=[];second=[]
for i,r in enumerate(records,1):
 pid=f'mt2025-maver-super-cup-oct-person-{i}'
 players.append(dict(id=pid,lastName=r['last'],firstName=r['first'],aliases=[r['name']],club='',archived=False,source=description))
 first.append(dict(competitorId=pid,competitorName=r['name'],sourceName=r['name'],sector=r['sector'],peg=r['peg'],weightG=r['w1'],officialPlace=r['p1'],sourceOfficial=True,**({'noStartFirstRound':True} if r['peg'] is None else {})))
 second.append(dict(competitorId=pid,competitorName=r['name'],sourceName=r['name'],sector=None,peg=None,weightG=r['w2'],officialPlace=r['p2'],sourceOfficial=True,sectorSource='Brak danych stanowisk i sektorów II tury w tabeli źródłowej'))
eid='mt2025-maver-super-cup-oct'
event=dict(id=eid,name='MAVER SUPER CUP 2025 — 11–12.10.2025',kind='EVENT',year=2025,date='2025-10-12',archived=True,source=description,entrantIds=[p['id'] for p in players],rounds=[
 dict(id=eid+'-round1',name='I tura 11.10.2025',date='2025-10-11',status='FINAL',sourceOfficial=True,drawPublished=False,results=first),
 dict(id=eid+'-round2',name='II tura 12.10.2025',date='2025-10-12',status='FINAL',sourceOfficial=True,drawPublished=False,results=second)])
dataset=dict(format='matchthis-integration-preview-1',data=dict(players=players,events=[event],cycles=[]))
old_note='I tura B: zachowano oryginalnie zamienione miejsca 5/6 ZALEWSKI/PASTUSZKA.'
new_note='I tura B: zatwierdzona korekta miejsc według wag — ZALEWSKI 2975 g 5. miejsce; PASTUSZKA 2880 g 6. miejsce.'
anchor="if(!db.events.some(x=>x.id==='mt2025-maver-super-cup-apr')){mergeDatabase({players:MATCHTHIS_ARCHIVE_2025_ADDITIONAL.data.players,cycles:[],events:MATCHTHIS_ARCHIVE_2025_ADDITIONAL.data.events.filter(x=>x.id==='mt2025-maver-super-cup-apr')});}"
injection="""
// MT-42: complete missing October results once, preserve existing local edits.
if(!db.events.some(x=>x.id==='mt2025-maver-super-cup-oct'))mergeDatabase(MATCHTHIS_ARCHIVE_2025_MAVER_OCT.data);
// Update existing MT-41 saved copies only if the original uncorrected result is still present.
function mt42ApprovedAprilRankFix(){
 const event=db.events.find(x=>x.id==='mt2025-maver-super-cup-apr');
 const round=event?.rounds?.find(t=>t.date==='2025-04-26');
 if(!round)return 0;
 let n=0;
 for(const [name,peg,weight,oldRank,newRank] of [
  ['ZALEWSKI GRZEGORZ',14,2975,6,5],['PASTUSZKA TOMASZ',17,2880,5,6]
 ]){
   const found=round.results.filter(r=>r.competitorName?.toUpperCase()===name&&r.sector==='B'&&Number(r.peg)===peg&&Number(r.weightG)===weight&&Number(r.officialPlace)===oldRank);
   if(found.length!==1)continue;
   found[0].officialPlace=newRank;n++;
 }
 if(n){if(event.source?.includes('I tura B: zachowano oryginalnie zamienione miejsca 5/6 ZALEWSKI/PASTUSZKA.'))event.source=event.source.replace('I tura B: zachowano oryginalnie zamienione miejsca 5/6 ZALEWSKI/PASTUSZKA.','I tura B: zatwierdzona korekta miejsc według wag — ZALEWSKI 2975 g 5. miejsce; PASTUSZKA 2880 g 6. miejsce.');save();}
 return n;
}
mt42ApprovedAprilRankFix();
"""
for suffix in ('','_OGLADACZ','_SEDZIA'):
 original=(root/f'MatchThis_MT-41{suffix}.html').read_text(encoding='utf8')
 s=original.replace('MT-41','MT-42')
 if suffix!='_OGLADACZ':
  key="const MT40_STORAGE_KEY='matchthis-preview-MT-40';"
  assert s.count(key)==1
  s=s.replace(key,"const MT41_STORAGE_KEY='matchthis-preview-MT-41';\n"+key)
  old="localStorage.getItem(MT40_STORAGE_KEY)||"
  assert s.count(old)==1
  s=s.replace(old,"localStorage.getItem(MT41_STORAGE_KEY)||"+old)
 mark='const MATCHTHIS_ARCHIVE_2025_MEGA_V='
 assert s.count(mark)==1
 s=s.replace(mark,'const MATCHTHIS_ARCHIVE_2025_MAVER_OCT='+json.dumps(dataset,ensure_ascii=False,separators=(',',':'))+';\n'+mark)
 for name,peg,weight,oldrank,newrank in [('ZALEWSKI GRZEGORZ',14,2975,'6.0','5.0'),('PASTUSZKA TOMASZ',17,2880,'5.0','6.0')]:
  fragment=f'"competitorName":"{name}","sourceName":"{name}","sector":"B","peg":{peg},"weightG":{weight},"officialPlace":{oldrank}'
  assert s.count(fragment)==1,(suffix,name)
  s=s.replace(fragment,fragment.replace('"officialPlace":'+oldrank,'"officialPlace":'+newrank))
 assert old_note in s
 s=s.replace(old_note,new_note)
 assert s.count(anchor)==1
 s=s.replace(anchor,anchor+'\n'+injection)
 for check in ['<title>MatchThis MT-42</title>','aria-label="Wersja MT-42">MT-42','data-version="MT-42"', "const APP_VERSION='MT-42';"]:
  assert check in s,(suffix,check)
 (root/f'MatchThis_MT-42{suffix}.html').write_text(s,encoding='utf8')
 print('BUILT',f'MatchThis_MT-42{suffix}.html',len(s))
print('MT42_SOURCE_ROWS',len(records),'FIRST_ROUND_PEGS',sum(r['peg'] is not None for r in records),'SECOND_ROUND_PEGS',0)
