/* V302: history importer, separate from start-list import. */
function openHistoricalImport(){
 if(document.getElementById('historicalImportDialog'))return;
 const dialog=document.createElement('dialog');dialog.id='historicalImportDialog';
 dialog.style.cssText='width:min(1180px,96vw);max-height:94dvh;padding:18px;border:2px solid #315a40;border-radius:14px;background:#f7faf7;color:#152c20;box-sizing:border-box';
 dialog.innerHTML=`<style>#historicalImportDialog input,#historicalImportDialog select,#historicalImportDialog textarea{background:white!important;color:#142d20!important;border:1px solid #7a8e81;border-radius:5px;padding:7px;font:inherit;box-sizing:border-box;max-width:100%}#historicalImportDialog button{background:#164c30;color:white;border:0;border-radius:7px;padding:10px 14px;margin:4px;cursor:pointer}#historicalImportDialog button:disabled{opacity:.45;cursor:wait}#historicalImportDialog th{background:#dceade;color:#142d20;position:sticky;top:0}#historicalImportDialog td,#historicalImportDialog th{padding:5px;text-align:left}#historicalImportDialog td input{width:84px}#historicalImportDialog td:first-child input{width:210px}#historicalImportDialog label{display:inline-flex;flex-direction:column;gap:4px;margin:6px 10px 6px 0}#historicalImportDialog::backdrop{background:#0009}</style>
 <div style="display:flex;justify-content:space-between;align-items:center"><h2 style="margin:0">Import zakończonych zawodów</h2><button data-action="close">Zamknij</button></div>
 <p>Wczytaj pełne wyniki, sprawdź tabelę i powiązania zawodników. Zapis nastąpi dopiero po zatwierdzeniu.</p>
 <div><label>Źródło<select data-field="source"><option value="url">zawody.pro</option><option value="pdf">Plik PDF</option><option value="csv">Tabela CSV</option></select></label></div>
 <section data-source="url"><label style="width:95%">Adres zawodów<input data-field="url" type="url" placeholder="https://www.zawody.pro/public/szczegoly/79"></label></section>
 <section data-source="pdf" hidden><label>Pełne wyniki z tabelami sektorowymi (do 10 MB)<input data-field="pdf" type="file" accept="application/pdf,.pdf"></label></section>
 <section data-source="csv" hidden><label>Nazwa<input data-field="csvTitle"></label><label>Data<input data-field="csvDate" type="date"></label><label style="width:95%">Wagi w gramach<textarea data-field="csv" rows="5" placeholder="Zawodnik;Sektor;Stanowisko;Waga;BF;Tura"></textarea></label></section>
 <button data-action="load">Wczytaj podgląd</button>
 <p data-field="status" role="status" aria-live="polite"></p>
 <section data-field="preview" hidden></section>
 <div data-field="actions" hidden><button data-action="verify">Sprawdź dane i powiązania</button><button data-action="save" disabled>Zatwierdź i zapisz zawody</button></div>`;
 document.body.appendChild(dialog);dialog.showModal();dialog.addEventListener('close',()=>dialog.remove());
 const f=n=>dialog.querySelector('[data-field="'+n+'"]'),btn=n=>dialog.querySelector('[data-action="'+n+'"]');
 let draft=null,verified=null,busy=false;
 function status(t,bad=false){f('status').textContent=t;f('status').style.color=bad?'#a51a1a':'#164c30'}
 function lock(value){busy=value;dialog.querySelectorAll('button,input,textarea,select').forEach(e=>e.disabled=value);btn('save').disabled=value||!verified;}
 function invalidate(){verified=null;btn('save').disabled=true;status('Dane zmienione — sprawdź ponownie przed zapisem.');}
 btn('close').onclick=()=>{if(!busy)dialog.close()};dialog.addEventListener('cancel',e=>{if(busy)e.preventDefault()});
 f('source').onchange=()=>dialog.querySelectorAll('[data-source]').forEach(s=>s.hidden=s.dataset.source!==f('source').value);
 function render(preview){
  draft=preview.draft;verified=null;btn('save').disabled=true;
  f('preview').hidden=false;f('actions').hidden=false;
  f('preview').innerHTML=`<label style="width:min(650px,95%)">Nazwa zawodów<input data-meta="title" value="${esc(draft.title)}"></label><label>Data<input type="date" data-meta="date" value="${esc(draft.date)}"></label><label>Łowisko<input data-meta="fishery" value="${esc(draft.fishery)}"></label><p><b>${preview.matches.length} zawodników · ${draft.roundCount} tury · ${draft.rows.length} wyników</b></p><div style="overflow:auto;max-height:42vh"><table><thead><tr><th>Zawodnik</th><th>Tura</th><th>Sektor</th><th>Stan.</th><th>Waga (g)</th><th>BF (g)</th><th>Pkt</th></tr></thead><tbody>${draft.rows.map((r,i)=>'<tr data-row="'+i+'">'+['name','round','sector','stand','weight','bigFish','points'].map(k=>'<td><input aria-label="'+esc(k+' '+r.name+' T'+r.round)+'" data-col="'+k+'" value="'+esc(r[k]??'')+'" '+(['name','sector'].includes(k)?'':'type="number" min="0" step="'+(k==='points'?'0.5':'1')+'"')+'></td>').join('')+'</tr>').join('')}</tbody></table></div><h3>Powiązanie z kontami i historią</h3><div data-matches></div>`;
  renderMatches(preview.matches);
  f('preview').oninput=invalidate;
  status('Odczytano wyniki. Sprawdź tabelę oraz konta poniżej.');
 }
 function renderMatches(matches){
  const holder=dialog.querySelector('[data-matches]');
  holder.innerHTML=matches.map((m,i)=>'<div style="padding:7px;border-bottom:1px solid #ccd8cf"><b>'+esc(m.name)+'</b> — '+(m.status==='NEW'?'nowy wpis historyczny (bez hasła do logowania)':m.status==='CONFLICT'?'wybierz właściwe konto':'konto #'+m.userId)+(m.mergeFromIds.length?' · historia z kont #'+m.mergeFromIds.join(', #')+' zostanie przeniesiona':'')+(m.candidates.length>1?'<select data-match="'+i+'"><option value="">'+(m.status==='CONFLICT'?'Wybierz konto':'Automatycznie: #'+m.userId)+'</option>'+m.candidates.map(c=>'<option value="'+c.id+'">#'+c.id+' · '+esc(c.phone)+'</option>').join('')+'</select>':'')+'</div>').join('');
  holder.querySelectorAll('select').forEach(select=>{select.onchange=()=>{const name=matches[Number(select.dataset.match)].name;draft.rows.filter(r=>r.name===name).forEach(r=>r.userId=select.value?Number(select.value):null);invalidate()}});
 }
 function collect(){
  for(const k of ['title','date','fishery'])draft[k]=dialog.querySelector('[data-meta="'+k+'"]').value;
  dialog.querySelectorAll('[data-row]').forEach(tr=>{const r=draft.rows[Number(tr.dataset.row)];tr.querySelectorAll('[data-col]').forEach(input=>{r[input.dataset.col]=input.value})});
  return draft;
 }
 btn('load').onclick=async()=>{
  lock(true);status('Odczytuję pełne wyniki…');
  try{let body;const source=f('source').value;
   if(source==='url')body={sourceUrl:f('url').value};
   else if(source==='pdf'){const file=f('pdf').files[0];if(!file)throw Error('Wybierz plik PDF');if(file.size>10_000_000)throw Error('PDF przekracza 10 MB');const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result.split(',')[1]);r.onerror=()=>reject(Error('Nie można odczytać pliku'));r.readAsDataURL(file)});body={pdfBase64:data}}
   else body={title:f('csvTitle').value,date:f('csvDate').value,tableText:f('csv').value};
   render(await api('/api/admin/historical-import/preview',{method:'POST',body:JSON.stringify(body)}));
  }catch(e){status(e.message,true)}finally{lock(false)}
 };
 btn('verify').onclick=async()=>{
  lock(true);status('Sprawdzam kompletność i konta…');
  try{const result=await api('/api/admin/historical-import/preview',{method:'POST',body:JSON.stringify(collect())});renderMatches(result.matches);if(result.matches.some(m=>m.status==='CONFLICT'))throw Error('Wybierz konto dla każdego konfliktu i sprawdź ponownie.');verified=result;status('Dane sprawdzone: '+result.matches.length+' zawodników, '+result.draft.rows.length+' wyników. Możesz zatwierdzić zapis.');}
  catch(e){verified=null;status(e.message,true)}finally{lock(false)}
 };
 btn('save').onclick=async()=>{
  if(!verified||busy)return;
  if(!confirm('Zapisać „'+verified.draft.title+'” ('+verified.draft.date+')? Wyniki będą widoczne w archiwum i historii zawodników.'))return;
  lock(true);status('Zapisuję zawody…');
  try{const result=await api('/api/admin/historical-import/confirm',{method:'POST',body:JSON.stringify({...verified.draft,previewToken:verified.previewToken,accountDigest:verified.accountDigest,confirm:true})});verified=null;status('Zapisano zawody #'+result.result.competitionId+' — '+result.result.players+' zawodników, '+result.result.results+' wyników.');f('actions').hidden=true;f('preview').hidden=true;await loadCompetitions()}
  catch(e){verified=null;status(e.message,true)}finally{lock(false)}
 };
}
