'use strict';
/* V234: password-reset request and admin SMS draft. Deliberately no automatic SMS provider. */
(function(){
const el=id=>document.getElementById(id);
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let busy=false,adminBusy=false;
let lastSms=null;
async function post(url,body){
  const res=await fetch(url,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',...(typeof TOKEN!=='undefined'&&TOKEN?{Authorization:'Bearer '+TOKEN}:{})},body:JSON.stringify(body||{})});
  const d=await res.json().catch(()=>({ok:false,error:'Błąd odpowiedzi'}));
  if(!res.ok||d.ok===false)throw new Error(d.error||'Nie udało się wykonać operacji.');
  return d;
}
function openRequest(){
  el('passwordRequestDialog')?.remove();
  const d=document.createElement('dialog');d.id='passwordRequestDialog';d.className='passwordResetDialog';
  d.innerHTML='<form method="dialog" class="passwordResetForm" id="resetRequestForm"><button type="button" data-close class="resetClose" aria-label="Zamknij">×</button><h2>Poproś o nowe hasło</h2><p>Podaj numer telefonu konta zawodnika. Administrator otrzyma osobną prośbę i sam wyśle Ci SMS z hasłem tymczasowym.</p><label for="passwordResetPhone">Numer telefonu</label><input type="tel" id="passwordResetPhone" name="phone" required inputmode="tel" autocomplete="tel" pattern="[\+0-9 ()-]{9,20}" placeholder="np. 500 600 700"><p class="resetFeedback" id="passwordRequestFeedback" role="status" aria-live="polite"></p><button type="submit" class="resetMainButton">WYŚLIJ PROŚBĘ</button><button type="button" data-close class="resetSecondaryButton">Wróć do logowania</button></form>';
  document.body.appendChild(d);
  d.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>d.close()));
  d.addEventListener('close',()=>d.remove(),{once:true});
  const form=d.querySelector('form');form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy)return;
    const phone=el('passwordResetPhone').value.trim();
    busy=true;const b=form.querySelector('[type="submit"]'),feedback=el('passwordRequestFeedback');b.disabled=true;b.textContent='Wysyłam prośbę…';
    try{
      const out=await post('/api/password-reset/request',{phone});
      feedback.className='resetFeedback resetFeedbackSuccess';feedback.textContent=out.message||'Jeśli numer ma konto, administrator otrzyma prośbę.';
      b.textContent='PROŚBA PRZYJĘTA';el('passwordResetPhone').readOnly=true;
    }catch(e){feedback.className='resetFeedback resetFeedbackError';feedback.textContent=e.message;b.disabled=false;b.textContent='WYŚLIJ PROŚBĘ'}
    finally{busy=false}
  });
  d.showModal();el('passwordResetPhone')?.focus();
}
function initLogin(){
  el('forgotPasswordBtn')?.addEventListener('click',openRequest);
  const toggle=el('loginPasswordToggle'),field=el('loginPassword');
  if(toggle&&field)toggle.addEventListener('click',()=>{
    const visible=field.type==='password';field.type=visible?'text':'password';
    toggle.setAttribute('aria-pressed',String(visible));
    toggle.setAttribute('aria-label',visible?'Ukryj hasło':'Pokaż hasło');
    toggle.textContent=visible?'UKRYJ':'POKAŻ';
    field.focus({preventScroll:true});
  });
  const nav=document.querySelector('#app>.tabs');
  if(nav)nav.addEventListener('keydown',ev=>{
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(ev.key))return;
    const tabs=[...nav.querySelectorAll('button[role="tab"]')].filter(b=>!b.classList.contains('hidden')&&!b.disabled);
    const current=tabs.indexOf(document.activeElement);if(current<0||!tabs.length)return;
    ev.preventDefault();const next=ev.key==='Home'?0:ev.key==='End'?tabs.length-1:(current+(ev.key==='ArrowLeft'?-1:1)+tabs.length)%tabs.length;
    tabs[next].focus();tabs[next].click();
  });
}
function adminTile(){
  let node=el('adminPasswordResetTile');
  if(node)return node;
  if(typeof ME==='undefined'||ME?.role!=='ADMIN')return null;
  const parent=el('tab-notifications');if(!parent)return null;
  node=document.createElement('section');node.id='adminPasswordResetTile';node.className='card passwordResetAdminTile';
  node.setAttribute('aria-label','Prośby o nowe hasło');
  parent.insertBefore(node,el('adminNotificationOverview')?.nextSibling||parent.firstChild);
  node.addEventListener('click',event=>{
    const btn=event.target.closest('button[data-reset-action]');if(!btn)return;
    const id=Number(btn.dataset.id),action=btn.dataset.resetAction;if(!id||adminBusy)return;
    if(action==='prepare')prepareSms(id,btn);
    else if(action==='sent')markSmsSent(id,btn);
    else if(action==='reject')rejectRequest(id,btn);
  });
  return node;
}
function draftDialog(request,body){
  lastSms={id:Number(request.id),phone:String(request.phone),body:String(body)};
  el('passwordSmsDialog')?.remove();
  const d=document.createElement('dialog');d.className='passwordResetDialog';d.id='passwordSmsDialog';
  d.innerHTML='<div class="passwordResetForm"><button type="button" data-close class="resetClose" aria-label="Zamknij">×</button><h2>Gotowy SMS do zawodnika</h2><p><b>'+safe(request.first_name+' '+request.last_name)+'</b><br><strong>'+safe(request.phone)+'</strong></p><label for="passwordSmsText">Treść wiadomości</label><textarea id="passwordSmsText" readonly rows="5">'+safe(body)+'</textarea><p class="resetFeedback">Hasło 12345678 jest tymczasowe. Wyślij wiadomość wyłącznie na numer przypisany do konta. Zawodnik musi zmienić hasło po zalogowaniu.</p><div class="resetSmsActions"><button type="button" id="passwordSmsOpen" class="resetMainButton">OTWÓRZ SMS</button><button type="button" id="passwordSmsCopy" class="resetSecondaryButton">KOPIUJ TREŚĆ</button></div><p id="passwordSmsFeedback" role="status" aria-live="polite">Po wysłaniu SMS-a wróć tutaj i zamknij prośbę. Ten sam przycisk jest też na karcie prośby.</p><button type="button" id="passwordSmsSent" class="resetSentButton">SMS WYSŁANY — ZAMKNIJ PROŚBĘ</button><button type="button" data-close class="resetSecondaryButton">Wróć do prośby</button></div>';
  document.body.appendChild(d);
  d.querySelectorAll('[data-close]').forEach(b=>b.addEventListener('click',()=>d.close()));
  d.addEventListener('close',()=>d.remove(),{once:true});
  el('passwordSmsOpen').onclick=()=>{
    const raw=String(lastSms.phone).replace(/[^0-9+]/g,''),phone=raw.length===9?'+48'+raw:raw.startsWith('48')&&!raw.startsWith('+')?('+'+raw):raw;
    window.location.href='sms:'+phone+'?body='+encodeURIComponent(lastSms.body);
  };
  el('passwordSmsCopy').onclick=async()=>{
    try{
      if(navigator.clipboard?.writeText)await navigator.clipboard.writeText(lastSms.body);
      else {el('passwordSmsText').select();if(!document.execCommand('copy'))throw Error('Skopiuj tekst ręcznie.')}
      el('passwordSmsFeedback').textContent='Treść SMS skopiowana.';
    }catch(e){el('passwordSmsFeedback').textContent=e.message||'Zaznacz i skopiuj treść ręcznie.'}
  };
  el('passwordSmsSent').onclick=()=>markSmsSent(lastSms.id,el('passwordSmsSent'),d);
  d.showModal();
}
async function prepareSms(id,button){
  if(button.textContent.includes('STWÓRZ')&&!await appConfirmLegacy('Przygotować SMS? Dotychczasowe hasło zawodnika przestanie działać. Nowe hasło 12345678 będzie ważne przez 24 godziny.'))return;
  adminBusy=true;button.disabled=true;
  try{
    const r=await post('/api/admin/password-resets/'+id+'/prepare',{});
    const request=(window.__lowcyPasswordRequests||[]).find(x=>Number(x.id)===id);
    if(request)draftDialog(request,r.body);
    await refreshAdmin();
  }catch(e){const status=el('passwordResetAdminFeedback');if(status)status.textContent=e.message}
  finally{adminBusy=false;button.disabled=false}
}
async function rejectRequest(id,button){
  if(!await appConfirmLegacy('Odrzucić prośbę o nowe hasło?'))return;
  adminBusy=true;button.disabled=true;
  try{await post('/api/admin/password-resets/'+id+'/reject',{});await refreshAdmin()}
  catch(e){const status=el('passwordResetAdminFeedback');if(status)status.textContent=e.message}
  finally{adminBusy=false;button.disabled=false}
}
async function markSmsSent(id,button,dialog){
  if(adminBusy||!await appConfirmLegacy('Potwierdzasz, że SMS został wysłany? Prośba zniknie z kolejki.'))return;
  adminBusy=true;button.disabled=true;
  try{
    await post('/api/admin/password-resets/'+id+'/sent',{});
    dialog?.close();
    await refreshAdmin();
    window.loadNotifications?.();
  }catch(e){
    const status=dialog?el('passwordSmsFeedback'):el('passwordResetAdminFeedback');
    if(status)status.textContent=e.message;
  }finally{adminBusy=false;button.disabled=false}
}
async function refreshAdmin(){
  if(typeof ME==='undefined'||ME?.role!=='ADMIN')return;
  const tile=adminTile();if(!tile)return;
  let rows;
  try{const r=await fetch('/api/admin/password-resets',{cache:'no-store',headers:{Authorization:'Bearer '+TOKEN}});if(!r.ok)throw Error('Nie udało się pobrać próśb.');rows=(await r.json()).requests||[]}
  catch(e){window.lowcyAdminNotificationsUpdate?.(null);tile.innerHTML='<h2>🔐 Prośby o nowe hasło</h2><p role="alert">'+safe(e.message)+'</p>';return}
  window.__lowcyPasswordRequests=rows;
  const count=rows.length;
  window.lowcyAdminNotificationsUpdate?.(count);
  tile.innerHTML='<div class="passwordResetAdminHead"><div><h2>🔐 Prośby o nowe hasło</h2><p>Przygotuj SMS i wyślij go ze swojego telefonu. Po wysłaniu zamknij prośbę.</p></div><span class="passwordResetCount">'+count+'</span></div><div id="passwordResetAdminFeedback" role="status" aria-live="polite"></div>'+
    (count?'<div class="passwordResetRequestList">'+rows.map(r=>'<article class="passwordResetRequest"><div class="resetRequestIdentity"><strong>'+safe(r.first_name+' '+r.last_name)+'</strong><a href="tel:'+safe(r.phone)+'">'+safe(r.phone)+'</a></div><small>'+new Date(r.created_at).toLocaleString('pl-PL')+' · '+(r.status==='PREPARED'?'SMS przygotowany':'Nowa prośba')+'</small><div class="passwordResetRequestActions"><button type="button" data-reset-action="prepare" data-id="'+Number(r.id)+'" class="resetMainButton">'+(r.status==='PREPARED'?'PONOWNIE OTWÓRZ SMS':'STWÓRZ SMS')+'</button>'+(r.status==='PREPARED'?'<button type="button" data-reset-action="sent" data-id="'+Number(r.id)+'" class="resetSentButton">SMS WYSŁANY — ZAMKNIJ PROŚBĘ</button>':'<button type="button" data-reset-action="reject" data-id="'+Number(r.id)+'" class="resetSecondaryButton">Odrzuć</button>')+'</div></article>').join('')+'</div>':'<p class="passwordResetEmpty">Brak oczekujących próśb.</p>');
}
window.lowcyPasswordResetRefresh=refreshAdmin;
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initLogin,{once:true});else initLogin();
})();
