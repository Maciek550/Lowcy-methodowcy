const qs=(s,r=document)=>r.querySelector(s);const qsa=(s,r=document)=>[...r.querySelectorAll(s)];

const modal=qs('#createModal');
qsa('[data-open-create],[data-open-cycle]').forEach(b=>b.addEventListener('click',()=>modal.classList.remove('hidden')));
qsa('[data-close-modal]').forEach(b=>b.addEventListener('click',()=>modal.classList.add('hidden')));
qsa('[data-scroll]').forEach(b=>b.addEventListener('click',()=>qs('#'+b.dataset.scroll)?.scrollIntoView({behavior:'smooth'})));

function showConfig(){modal.classList.add('hidden');qs('#config').classList.remove('hidden');renderSectors();qs('#config').scrollIntoView({behavior:'smooth',block:'start'});}
qsa('[data-show-config]').forEach(b=>b.addEventListener('click',showConfig));
qs('[data-hide-config]')?.addEventListener('click',()=>qs('#config').classList.add('hidden'));

const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ';
function computeSectors(){
  const players=Math.max(2,Number(qs('#playersCount').value)||50);
  const sectors=Math.min(12,Math.max(2,Number(qs('#sectorCount').value)||4));
  const first=Math.max(1,Number(qs('#firstPeg').value)||1);
  const base=Math.floor(players/sectors),extra=players%sectors;
  let cursor=first;
  return Array.from({length:sectors},(_,i)=>{
    const count=base+(i<extra?1:0);
    const from=cursor,to=cursor+count-1;cursor=to+1;
    return {name:letters[i],count,from,to};
  });
}
function renderSectors(custom){
  const data=custom||computeSectors();
  const shore=qs('#shore'),editor=qs('#sectorEditor');shore.innerHTML='';editor.innerHTML='';
  data.forEach((s,i)=>{
    const el=document.createElement('div');el.className='sector';el.style.flex=String(s.count);el.innerHTML=`<b>${s.name}</b><span>${s.count} zawodników</span><small>${s.from}–${s.to}</small>`;shore.appendChild(el);
    const edit=document.createElement('div');edit.className='sector-edit';edit.innerHTML=`<b>Sektor ${s.name}</b><div class="sector-edit-grid"><label>Zawodnicy<input type="number" min="1" value="${s.count}" data-field="count" data-i="${i}"></label><label>Zakres<input value="${s.from}-${s.to}" data-field="range" data-i="${i}"></label></div>`;editor.appendChild(edit);
  });
  qsa('#sectorEditor input').forEach(inp=>inp.addEventListener('change',manualEdit));
}
function manualEdit(){
  const cards=qsa('.sector-edit');let next=Math.max(1,Number(qs('#firstPeg').value)||1);const arr=[];
  cards.forEach((card,i)=>{
    const count=Math.max(1,Number(qs('[data-field="count"]',card).value)||1);
    const range=qs('[data-field="range"]',card).value.trim();let from=next,to=next+count-1;
    const m=range.match(/^(\d+)\s*[-–]\s*(\d+)$/);if(m){from=Number(m[1]);to=Number(m[2]);}
    arr.push({name:letters[i],count,from,to});next=to+1;
  });
  const shore=qs('#shore');shore.innerHTML='';arr.forEach(s=>{const el=document.createElement('div');el.className='sector';el.style.flex=String(s.count);el.innerHTML=`<b>${s.name}</b><span>${s.count} zawodników</span><small>${s.from}–${s.to}</small>`;shore.appendChild(el);});
}
qs('#autoSectors')?.addEventListener('click',()=>renderSectors());
['#playersCount','#sectorCount','#firstPeg'].forEach(s=>qs(s)?.addEventListener('change',()=>renderSectors()));

qsa('.type-card').forEach(c=>c.addEventListener('click',()=>{qsa('.type-card').forEach(x=>x.style.outline='none');c.style.outline='2px solid #f36b11';}));

const weightInputs=qsa('.weigh-card input');weightInputs.forEach(i=>i.addEventListener('input',()=>{const sum=weightInputs.reduce((a,x)=>a+(Number(x.value)||0),0);qs('.sum b').textContent=sum.toLocaleString('pl-PL')+' g';}));

renderSectors();
