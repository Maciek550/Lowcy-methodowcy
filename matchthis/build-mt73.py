from pathlib import Path
import re,json,hashlib,subprocess
D=Path('matchthis')
base={'':'8bc8f99c4e6559cb123178aa4c0e017b6c3cc8772147d66b9ce9c37985bee660','_OGLADACZ':'eea8eec389f8f4a586444765740965180a244a3b3a6833f5742e59681400a845','_SEDZIA':'0896badb55553196778b48a294439a32445aeb7a7b6140afff2ffdfc8d145fac'}
rows=json.loads((D/'mt73-traper-verified.json').read_text())
assert len(rows)==55 and sum(r[3] for r in rows)==170210
for sec in 'ABCD':
 part=[r for r in rows if r[0]==sec]
 for place,r in enumerate(sorted(part,key=lambda r:-r[3]),1):assert r[4]==place,(sec,r)
correction='''
// Verified against four organizer-supplied handwritten protocols; two names confirmed by organizer.
function mt73RepairTraper(){
 const e=db.events.find(e=>e.id==='mt2026-traper-cup-kobialka');if(!e)return;
 const t=e.rounds?.[0];if(!t)return;
 const fixes=RECORDS;
 for(const fix of fixes){
  const r=t.results.find(r=>r.sector===fix.sector&&Number(r.peg)===fix.peg&&r.competitorId===fix.id);if(!r)continue;
  if(r.competitorName===fix.oldName||r.competitorName===fix.name){
   r.competitorName=fix.name;r.nameNeedsReview=false;
   if(r.weightG===fix.oldWeight)r.weightG=fix.weight;
   const p=db.players.find(p=>p.id===r.competitorId);
   if(p&&fullName(p)===fix.oldName){const words=fix.name.split(' ');p.firstName=words.pop();p.lastName=words.join(' ');p.nameNeedsReview=false;p.aliases=[fix.name];}
  }
 }
}
mt73RepairTraper();
'''
for role,sha in base.items():
 s=(D/f'MatchThis_MT-72{role}.html').read_text();assert hashlib.sha256(s.encode()).hexdigest()==sha
 start=s.index('const MATCHTHIS_STANDALONE_2026=')+len('const MATCHTHIS_STANDALONE_2026=');raw,n=json.JSONDecoder().raw_decode(s[start:]);event=next(e for e in raw['data']['events'] if e['id']=='mt2026-traper-cup-kobialka');fixes=[]
 for sec,peg,name,weight,place in rows:
  r=next(r for r in event['rounds'][0]['results'] if r['peg']==peg and r['sector']==sec)
  fixes.append(dict(sector=sec,peg=peg,id=r['competitorId'],oldName=r['competitorName'],name=name,oldWeight=r['weightG'],weight=weight))
  p=next((p for p in raw['data']['players'] if p['id']==r['competitorId']),None);r.update(competitorName=name,weightG=weight,nameNeedsReview=False)
  words=name.split()
  if p:p.update(firstName=words[-1],lastName=' '.join(words[:-1]),aliases=[name],nameNeedsReview=False)
 s=s[:start]+json.dumps(raw,ensure_ascii=False,separators=(',',':'))+s[start+n:]
 s=s.replace('MT-72','MT-73')
 s=s.replace("const STORAGE_KEY='matchthis-preview-MT-73';","const STORAGE_KEY='matchthis-preview-MT-73';\nconst MT72_STORAGE_KEY='matchthis-preview-MT-72';")
 if role!='_OGLADACZ':s=s.replace('localStorage.getItem(MT71_STORAGE_KEY)||','localStorage.getItem(MT72_STORAGE_KEY)||localStorage.getItem(MT71_STORAGE_KEY)||',1)
 # Freeze the app until its authoritative state arrives. Core/drawing scripts stay unchanged.
 anchor="<script>\n'use strict';\nconst APP_VERSION='MT-73';"
 assert s.count(anchor)==1;s=s.replace(anchor,"<script>\n(async()=>{\n'use strict';\nconst APP_VERSION='MT-73';",1)
 a=s.index('function save(){');b=s.index('\ntry{const fresh=',a) if role!='_OGLADACZ' else s.index('\n',a)
 s=s[:a]+(D/'mt73-client.js').read_text()+s[b:]
 # Keep early migration save() calls harmless; all business changes later use server persistence.
 end='mtNavInit();\nrender();\nmt60RefreshPublicDraws();'
 assert s.count(end)==1
 s=s.replace(end,correction.replace('RECORDS',json.dumps(fixes,ensure_ascii=False))+'\nawait mt73Start();\n'+end+"\n})().catch(e=>{document.getElementById('mt73-sync').textContent=e.message;document.getElementById('contentShell').inert=true;});")
 s=s.replace('<div class="shell" id="contentShell">','<div id="mt73-savebar" style="padding:6px 14px;background:#f3f5f6;font-size:13px" role="status"><span id="mt73-sync">Łączenie z serwerem…</span> <button id="mt73-retry" type="button" hidden>Ponów zapis</button><span id="mt73-migration"></span></div><div class="shell" id="contentShell">')
 s=s.replace('Wyniki zapisane w przeglądarce','Wyniki przekazane do zapisu na serwerze').replace('Wagi zapisane lokalnie w tej przeglądarce. Brak centralnego zapisu na serwerze.','Wagi przekazane do zapisu na serwerze.')
 # Suppress stale success claims until server confirmation is visible in the persistent status bar.
 s=s.replace("function alertMsg(msg,good=false){", "function alertMsg(msg,good=false){if(good&&(mt73Queued||mt73Busy)){msg+=' · Trwa zapis na serwerze';}")
 for marker in ['<title>MatchThis MT-73</title>','data-version="MT-73"',"const APP_VERSION='MT-73';",'id="appversion">MT-73'] :assert marker in s
 for i,script in enumerate(re.findall(r'<script(?:\s[^>]*)?>(.*?)</script>',s,re.S)):
  if script.strip():
   p=D/'_mt73-check.js';p.write_text(script);subprocess.run(['node','--check',str(p)],check=True);p.unlink()
 (D/f'MatchThis_MT-73{role}.html').write_text(s)
 if role=='':(D/'MT73_SEED.html').write_text(s.replace('await mt73Start();','window.__MT73_SEED=mt73Clone(db);'))
 print('MT73_BUILD_PASS',role,hashlib.sha256(s.encode()).hexdigest())
