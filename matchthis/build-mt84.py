from pathlib import Path
import hashlib,sys
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path('matchthis')
expected=['defbdb62a66f70c016b83ec6cfdb2f281f1e4b07709ea0a26fc0ed362f71361c','24c6e6757e5dbc85769597dda6c5df3afcb6e1e537cc9ece7664855db6ad38aa','af5727e4f26b7019de7502963322725d6d5528f8b0ece0a91969fca1867c56ef']
def once(s,a,b):
 assert s.count(a)==1,(a[:80],s.count(a))
 return s.replace(a,b,1)
helper='''// MT84: read only explicit saved peg/sector pairs when legacy draws have no plan.
// Never balance, infer missing stations, mutate a draw or overwrite saved metadata.
function mt84AssignedGroups(t){
 const byPeg=new Map(),byPerson=new Map();
 for(const r of [...(t?.mt55Entries||[]),...(t?.results||[])]){
  if(r.peg==null||r.peg===''||!r.sector)continue;
  const peg=Number(r.peg),sector=String(r.sector),id=String(r.competitorId||'');
  if(!Number.isSafeInteger(peg)||peg<1||!id)return [];
  const old=byPeg.get(peg),person=byPerson.get(id);
  if(old&&(old.sector!==sector||old.id!==id))return [];
  if(person&&(person.peg!==peg||person.sector!==sector))return [];
  byPeg.set(peg,{sector,id});byPerson.set(id,{peg,sector});
 }
 const groups=new Map();
 for(const [peg,{sector}] of byPeg){
  if(!groups.has(sector))groups.set(sector,[]);
  groups.get(sector).push(peg);
 }
 return [...groups].sort((a,b)=>a[0].localeCompare(b[0],'pl')).map(([sector,pegs])=>({sector,pegs:pegs.sort((a,b)=>a-b)}));
}
'''
for suffix,digest in zip(['','_OGLADACZ','_SEDZIA'],expected):
 raw=(root/f'MatchThis_MT-83{suffix}.html').read_bytes()
 assert hashlib.sha256(raw).hexdigest()==digest,'MT83 base changed'
 s=raw.decode()
 s=once(s,'function mt65SavedGroups(t){',helper+'function mt65SavedGroups(t){')
 s=once(s,'return p?.pegs?.length?mt65PlanGroups(p.pegs,p.sectors,p.sizes):[];', 'return p?.pegs?.length?mt65PlanGroups(p.pegs,p.sectors,p.sizes):mt84AssignedGroups(t);')
 s=once(s,'const eligible=mt62EligibleCount(e),plan=t.mt55SectorPlan;', '''const eligible=mt62EligibleCount(e),plan=t.mt55SectorPlan;
 if(!plan?.pegs?.length){
  const assigned=mt84AssignedGroups(t);
  if(assigned.length)return '<strong class="mt56-caption">Zapisane przydziały sektorów i stanowisk</strong>'+mt56GroupsHtml(assigned);
 }''')
 s=once(s,"const tour=mt55Tour().t,stored=tour?.mt55SectorPlan;", """const tour=mt55Tour().t,stored=tour?.mt55SectorPlan;
  const assigned=!stored?.pegs?.length?mt84AssignedGroups(tour):[];
  if(assigned.length){target.innerHTML='<strong class="mt56-caption">Zapisane przydziały sektorów i stanowisk</strong>'+mt56GroupsHtml(assigned);return;}""")
 s=once(s,"${t.mt55SectorPlan?.sectors||2}","${t.mt55SectorPlan?.sectors||mt84AssignedGroups(t).length||2}")
 s=once(s,"if(assigned&&t.mt55SectorPlan?.pegs?.length===mt62EligibleCount(e))return mt55CompactPegs(t.mt55SectorPlan.pegs);", """if(assigned&&t.mt55SectorPlan?.pegs?.length===mt62EligibleCount(e))return mt55CompactPegs(t.mt55SectorPlan.pegs);
 if(assigned&&!t.mt55SectorPlan?.pegs?.length){
  const pegs=mt84AssignedGroups(t).flatMap(g=>g.pegs).sort((a,b)=>a-b);
  if(pegs.length)return mt55CompactPegs(pegs);
 }""")
 s=s.replace('MT-83','MT-84')
 out=root/f'MatchThis_MT-84{suffix}.html';out.write_text(s)
 print(out.name,hashlib.sha256(out.read_bytes()).hexdigest())
