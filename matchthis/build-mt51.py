from pathlib import Path
root=Path(__file__).resolve().parent
HELPERS=r"""
// MT-51: dates for each competition round, independent manual changes.
function mt51NextDate(iso){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(iso||''))return '';
 const d=new Date(iso+'T12:00:00Z');if(Number.isNaN(d.getTime()))return '';
 d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);
}
function mt51Weekday(iso){return iso?['niedziela','poniedziałek','wtorek','środa','czwartek','piątek','sobota'][new Date(iso+'T12:00:00Z').getUTCDay()]:''}
function mt51DateInput(i,item){
 const label=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII'][i];
 const date=/^\d{4}-\d{2}-\d{2}$/.test(item?.value||'')?item.value:'';
 return '<label>Data '+label+' tury (opcjonalnie)<input name="tourDate'+i+'" data-event-tour-date="'+i+'" data-autofilled="'+(item?.auto?'true':'false')+'" type="date" value="'+date+'"><small class="mt51-weekday">'+mt51Weekday(date)+'</small></label>';
}
function mt51SetDateCount(form){
 const wrap=form.querySelector('#mt51EventTourDates');if(!wrap)return;
 const count=Math.max(1,Math.min(12,Number(form.elements.rounds.value)||1));
 const items=[...wrap.querySelectorAll('[data-event-tour-date]')].map(x=>({value:x.value,auto:x.dataset.autofilled==='true'}));
 if(count===items.length)return;
 while(items.length<count){
  const prev=items.length?items[items.length-1].value:'';
  items.push({value:prev?mt51NextDate(prev):'',auto:true});
 }
 wrap.innerHTML=items.slice(0,count).map((x,i)=>mt51DateInput(i,x)).join('');
}
function mt51DateChanged(input){
 const form=input.closest('form#createEvent');if(!form)return;
 input.dataset.autofilled='false';
 const arr=[...form.querySelectorAll('[data-event-tour-date]')];
 for(let i=Number(input.dataset.eventTourDate)+1;i<arr.length;i++){
  if(arr[i].value&&arr[i].dataset.autofilled!=='true')break;
  arr[i].value=arr[i-1].value?mt51NextDate(arr[i-1].value):'';
  arr[i].dataset.autofilled='true';
  const w=arr[i].closest('label')?.querySelector('.mt51-weekday');if(w)w.textContent=mt51Weekday(arr[i].value);
 }
 const w=input.closest('label')?.querySelector('.mt51-weekday');if(w)w.textContent=mt51Weekday(input.value);
}
"""
EVENT=r"""function formEvent(e){
 e.preventDefault();
 const f=e.target,name=f.elements.name.value.trim(),year=Number(f.elements.year.value),n=Number(f.elements.rounds.value),kind=f.elements.kind.value;
 if(!name||!Number.isInteger(n)||n<1||n>12)throw new Error('Podaj nazwę i prawidłową liczbę tur');
 if(!Number.isInteger(year)||year<2020||year>2100)throw new Error('Niepoprawny rok');
 const dates=Array.from({length:n},(_,i)=>f.querySelector('[data-event-tour-date="'+i+'"]')?.value||'');
 for(let i=0;i<n;i++){
  if(dates[i]&&!/^\d{4}-\d{2}-\d{2}$/.test(dates[i]))throw new Error('Niepoprawna data '+(i+1)+'. tury');
  if(dates[i]&&Number(dates[i].slice(0,4))!==year)throw new Error('Data '+(i+1)+'. tury musi należeć do '+year+' roku');
 }
 const rounds=createEventRounds(n);rounds.forEach((r,i)=>r.date=dates[i]);
 const event={id:uid(),name,year,date:dates[0]||'',kind,archived:false,rounds};
 db.events.push(event);save();page='event';selectedId=event.id;roundIndex=0;render();alertMsg('Utworzono zawody z datami tur',true);
}"""
HOOKS=r"""document.addEventListener('input',e=>{if(e.target.closest('form#createEvent')){if(e.target.name==='rounds')mt51SetDateCount(e.target.form);else if(e.target.matches('[data-event-tour-date]'))mt51DateChanged(e.target);}});
document.addEventListener('change',e=>{if(e.target.closest('form#createEvent')){if(e.target.name==='rounds')mt51SetDateCount(e.target.form);else if(e.target.matches('[data-event-tour-date]'))mt51DateChanged(e.target);}});
"""
for suffix in ('','_SEDZIA','_OGLADACZ'):
 s=(root/f'MatchThis_MT-50{suffix}.html').read_text('utf8').replace('MT-50','MT-51')
 if suffix!='_OGLADACZ':
  a="const MT49_STORAGE_KEY='matchthis-preview-MT-49';"
  assert s.count(a)==1
  s=s.replace(a,"const MT50_STORAGE_KEY='matchthis-preview-MT-50';\n"+a)
  a="localStorage.getItem(MT49_STORAGE_KEY)||"
  assert s.count(a)==1
  s=s.replace(a,"localStorage.getItem(MT50_STORAGE_KEY)||"+a)
 a=s.index('function formEvent(e){');b=s.index('\nfunction current(){',a)
 assert 'rounds:createEventRounds(n)' in s[a:b]
 s=s[:a]+EVENT+s[b:]
 a=s.index('function formNewEvent(){');b=s.index('\nfunction tableRows(',a)
 old=s[a:b]
 assert old.count('<label>Data zawodów (opcjonalnie)<input name="date" type="date"></label>')==1
 new=old.replace('<label>Data zawodów (opcjonalnie)<input name="date" type="date"></label>',
    '<div class="grid" id="mt51EventTourDates">'+chr(36)+'{mt51DateInput(0,{value:"",auto:false})}</div><p class="sub">Druga data jest podpowiadana na następny dzień. Możesz ją zmienić niezależnie.</p>')
 s=s[:a]+HELPERS+'\n'+new+s[b:]
 a="document.addEventListener('input',e=>{if(e.target.id==='playerSearch')"
 assert s.count(a)==1
 s=s.replace(a,HOOKS+a)
 for chk in ('<title>MatchThis MT-51</title>','aria-label="Wersja MT-51">MT-51','data-version="MT-51"', "const APP_VERSION='MT-51'"):
  assert chk in s,(suffix,chk)
 (root/f'MatchThis_MT-51{suffix}.html').write_text(s,'utf8')
 print('MT51_BUILT',suffix,len(s))
print('MT51: stored tour dates only for newly created events; existing datasets unchanged.')
