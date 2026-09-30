'use strict';
/* V228: lightweight messaging UI, kept separate from draw/results code. */
(function(){
const style=document.createElement('style');
style.textContent='.commEnvelope{display:inline-flex!important;align-items:center;justify-content:center;flex:none;width:38px;min-width:38px!important;height:38px;min-height:38px!important;padding:0!important;border:1px solid #91caff!important;background:#145b96!important;color:#fff!important;border-radius:9px!important;font-size:21px!important;line-height:1!important;box-shadow:0 1px 3px #061a24!important}.commEnvelope:focus-visible{outline:3px solid #fbd65b!important}.commPhonePair{display:inline-flex;align-items:center;gap:5px;flex-wrap:nowrap}.commGroupBtn{display:block;margin:9px 0;background:#155a93!important;color:#fff!important;font-weight:800}.commDialog{position:fixed;border:2px solid #4a95cf;border-radius:18px;padding:0;max-width:min(96vw,560px);max-height:88vh;width:calc(100% - 20px);overflow:auto;background:#12283b;color:#fff;box-shadow:0 12px 50px #0009;z-index:100001}.commDialog::backdrop{background:#07131dcc}.commDialog .commForm{display:grid;gap:10px;padding:18px}.commDialog h2{margin:0;color:#fff}.commDialog label{display:block;font-size:14px;font-weight:750;color:#fff}.commDialog textarea,.commDialog select{display:block;width:100%;min-height:42px;border:1px solid #89b2cd;border-radius:8px;margin-top:6px;padding:10px;background:#f5faff;color:#15293d;font-size:16px}.commDialog textarea{min-height:120px;resize:vertical}.commDialog .commActions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.commDialog .commActions button{flex:1;min-width:115px;min-height:44px}.commHistory{font-size:12px;line-height:1.4;max-height:180px;overflow:auto}.commHistoryItem{padding:7px 0;border-bottom:1px solid #456078;color:#fff}.commHistoryItem small{display:block;color:#c6dff0}.commPopup{position:fixed;inset:0;z-index:100002;background:#07131dc9;display:flex;align-items:center;justify-content:center;padding:12px}.commPopupPanel{width:min(96vw,530px);max-height:90vh;overflow:auto;background:#102b40;color:#fff;padding:22px;border:3px solid #e3b74f;border-radius:20px;box-shadow:0 12px 50px #000c;text-align:center}.commPopupTitle{font-size:clamp(23px,5vw,32px);line-height:1.13;margin:0 0 12px;font-weight:900;color:#ffe08e}.commPopupText{font-size:clamp(17px,4.5vw,22px);font-weight:750;line-height:1.4;white-space:pre-wrap;overflow-wrap:anywhere}.commPopupDate{font-size:20px;font-weight:900;color:#aee8ff;margin:6px 0}.commPopupOrganizer{margin:14px 0 6px;padding:12px;text-align:left;border:2px solid #b5daa9;border-radius:12px;background:#254438;color:#fff;white-space:pre-wrap;overflow-wrap:anywhere;font-size:17px;font-weight:700;line-height:1.35}.commPopupOrganizer b{display:block;color:#e5f4b7;font-size:13px;margin-bottom:5px;letter-spacing:.03em}.commPopupActions{display:grid;gap:9px;margin-top:20px}.commPopupActions button{min-height:54px;font-size:19px;font-weight:900}.commPopupActions .commConfirm{background:#197b44;color:#fff;border:2px solid #8cddb0}.commPopupActions .commResign{min-height:39px;font-size:15px;background:#9e2b35;color:#fff;border:1px solid #e68a8a}.commPopupClose{font-size:13px;min-height:34px;color:#fff;background:#31536c}.commPopupTimer{font-size:12px;margin-top:8px;color:#bfdbec}';

style.textContent += '@media(max-width:760px){body:not(.playerTheme) #app #competitionDetail #adminZone-roster .mobileRosterCompactHead.hasCall{grid-template-columns:26px minmax(0,1fr) 44px 38px auto!important;gap:4px!important}body:not(.playerTheme) #app #competitionDetail #adminZone-roster .mobileRosterCompactHead:not(.hasCall){grid-template-columns:26px minmax(0,1fr) 38px auto!important;gap:4px!important}body:not(.playerTheme):not(.authMode) #app #playersList .mobilePlayerManageCard .mobileAdminCardHead.hasCall{display:grid!important;grid-template-columns:28px minmax(0,1fr) 40px 38px auto!important;gap:4px!important}body:not(.playerTheme):not(.authMode) #app #playersList .mobilePlayerManageCard .mobileAdminCardHead:not(.hasCall){display:grid!important;grid-template-columns:28px minmax(0,1fr) 38px auto!important;gap:4px!important}#app .mobileRosterCompactHead .commEnvelope,#app #playersList .mobileAdminCardHead .commEnvelope{width:38px!important;min-width:38px!important;height:40px!important;min-height:40px!important;padding:0!important;font-size:22px!important}#app .mobileRosterCompactIdentity,#app #playersList .playerNameLogin{min-width:0!important}}';
style.textContent += '.commDialog .commChannelLabel{display:block;font-weight:850;font-size:15px;margin-bottom:3px}.commDialog .commChannelChoices{display:grid;gap:7px}.commDialog .commChoice{display:flex;align-items:center;gap:10px;border:1px solid #87b6d6;border-radius:11px;padding:10px 12px;min-height:49px;background:#1c3e55;color:#fff;cursor:pointer;font-size:15px}.commDialog .commChoice input{flex:none;width:22px;height:22px;accent-color:#5ac89b;margin:0}.commDialog .commAllToggle{min-height:40px;width:100%;border:1px solid #84d0a0!important;background:#234e3f!important;color:#fff!important;font-weight:800}.commDialog .commChannelHint{font-size:12px;color:#c6dff0}';
document.head.appendChild(style);
let popupId=0,popupTimer=null,refreshTimer=null;
const shown=new Set();
const find=id=>document.getElementById(id);
const hasInbox=n=>n?.type!=='ADMIN_MESSAGE'||n?.data?.inboxEnabled!==false;
const hasPopup=n=>n?.data?.popupEnabled===true||(['POPUP','ALL'].includes(String(n?.data?.displayMode||'').toUpperCase()));
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function getMode(n){const d=n?.data||{};return String(d.displayMode||'').toUpperCase()}
function notifDate(date){
  const key=String(date||'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(key))return '';
  const d=new Date(key+'T12:00:00Z');
  return new Intl.DateTimeFormat('pl-PL',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Warsaw'}).format(d).toLocaleUpperCase('pl-PL');
}
function closePopup(){
  if(popupTimer){clearTimeout(popupTimer);popupTimer=null}
  find('commPopup')?.remove();popupId=0;
}
function showPopup(n){
  if(popupId||shown.has(Number(n.id)))return;
  shown.add(Number(n.id));popupId=Number(n.id);
  const d=n.data||{},reminder=n.type==='PRESENCE_REMINDER_2D',invitation=n.type==='COMPETITION_INVITATION';
  const c=(window.PLAYER_COMPETITIONS_CACHE||[]).find(x=>Number(x.id)===Number(d.competitionId))||{};
  const title=reminder?'POTWIERDŹ SWÓJ UDZIAŁ!':invitation?'Zaproszenie na zawody':String(n.title||'Wiadomość od organizatora');
  const comp=String(d.competitionTitle||c.title||''),fishery=String(d.fishery||c.fishery||'');
  const date=notifDate(d.competitionDate||c.competition_date);
  const organizerNote=String(Object.prototype.hasOwnProperty.call(c,'presence_reminder_note')?c.presence_reminder_note:(d.organizerNote||'')).trim().slice(0,160);
  const modal=document.createElement('div');modal.id='commPopup';modal.className='commPopup';modal.setAttribute('role','dialog');modal.setAttribute('aria-modal','true');modal.setAttribute('aria-label',title);
  const msg=reminder?'<div class="commPopupText">'+safe(comp)+'</div><div class="commPopupDate">'+safe(date)+'</div><div class="commPopupText">'+safe(fishery)+'</div>'+(organizerNote?'<div class="commPopupOrganizer"><b>OD ORGANIZATORA</b>'+safe(organizerNote)+'</div>':'')+'<p>Czy potwierdzasz obecność na zawodach?</p>':invitation?'<div class="commPopupText">'+safe(comp)+'</div><div class="commPopupDate">'+safe(date)+'</div><div class="commPopupText">'+safe(fishery)+'</div><p>Możesz obejrzeć zawody nawet po odrzuceniu zaproszenia.</p>':'<div class="commPopupText">'+safe(n.body||'')+'</div>';
  const act=reminder?'<button type="button" class="commConfirm" id="commYes">✓ POTWIERDZAM UDZIAŁ</button><button type="button" class="commResign" id="commNo">REZYGNUJĘ</button>':invitation?'<button type="button" class="commConfirm" id="commYes">ZAPISZ SIĘ</button><button type="button" id="commView">ZOBACZ ZAWODY</button><button type="button" class="commResign" id="commNo">ODRZUĆ ZAPROSZENIE</button>':'<button type="button" id="commInbox">'+(hasInbox(n)?'ZOBACZ W POWIADOMIENIACH':'ROZUMIEM')+'</button>';
  modal.innerHTML='<div class="commPopupPanel"><h2 class="commPopupTitle">'+safe(title)+'</h2>'+msg+'<div class="commPopupActions">'+act+'<button type="button" id="commDismiss" class="commPopupClose">Zamknij</button></div><div class="commPopupTimer">Komunikat zamknie się po 15 sekundach.'+(hasInbox(n)?' Pozostanie w powiadomieniach.':'')+'</div></div>';
  document.body.appendChild(modal);
  find('commDismiss').onclick=closePopup;
  if(invitation){
    find('commYes').onclick=()=>{closePopup();window.joinComp?.(Number(d.competitionId))};
    find('commNo').onclick=()=>{closePopup();window.declineCompetitionInvitation?.(Number(d.competitionId))};
    find('commView').onclick=()=>{closePopup();window.openInvitationCompetition?.(Number(d.competitionId),Number(n.id))};
  }else if(reminder){
    find('commYes').onclick=async()=>{closePopup();if(typeof window.confirmPlayerPresence==='function')await window.confirmPlayerPresence(Number(d.competitionId),null,null)};
    find('commNo').onclick=()=>{closePopup();if(typeof window.leaveComp==='function')window.leaveComp(Number(d.competitionId))};
  }else find('commInbox').onclick=()=>{closePopup();if(hasInbox(n))window.showTab?.('notifications')};
  api('/api/notifications/'+Number(n.id)+'/popup-seen',{method:'POST',body:'{}'}).catch(()=>{});
  popupTimer=setTimeout(closePopup,15000);
}
window.lowcyCommPopup=function(notifs){
  if(ME?.role!=='PLAYER'||popupId)return;
  const arr=(notifs||[]).filter(n=>!n.read_at&&!n.popup_seen_at&&!shown.has(Number(n.id))&&((n.type==='ADMIN_MESSAGE'&&hasPopup(n))||n.type==='PRESENCE_REMINDER_2D'||n.type==='COMPETITION_INVITATION'));
  const first=arr[0];if(first)showPopup(first);
};
window.lowcyCommEnvelope=function(userId,compId,name){
  const label=String(name||'Zawodnik');return '<button type="button" class="commEnvelope" title="Napisz do '+safe(label)+'" aria-label="Wyślij wiadomość do '+safe(label)+'" onclick="openAdminMessage('+Number(userId)+','+Number(compId)+',decodeURIComponent(\''+encodeURIComponent(label).replace(/'/g,'%27')+'\'))">✉</button>';
};
window.openAdminMessage=async function(userId,compId,name){
  if(ME?.role!=='ADMIN')return;
  find('commAdminDialog')?.remove();
  const dialog=document.createElement('dialog');dialog.className='commDialog';dialog.id='commAdminDialog';
  const group=Number(userId)===0,title=group?'Grupowa wiadomość':'Wiadomość do: '+String(name||'zawodnika');
  dialog.innerHTML='<form class="commForm"><h2>✉ '+safe(title)+'</h2>'+(group?'<label>Odbiorcy<select name="group"><option value="ACTIVE">Lista główna</option><option value="UNCONFIRMED">Niepotwierdzeni</option><option value="RESERVE">Rezerwa</option><option value="ALL">Lista główna i rezerwa</option></select></label>':'')+'<label>Treść wiadomości<textarea name="body" maxlength="700" required placeholder="Napisz wiadomość…" autofocus></textarea></label><div class="commChannelChoices" role="group" aria-label="Sposób wysyłki"><span class="commChannelLabel">Wybierz sposób wysyłki</span><label class="commChoice"><input type="checkbox" name="channels" value="INBOX" checked><span>1. Powiadomienie w aplikacji</span></label><label class="commChoice"><input type="checkbox" name="channels" value="POPUP"><span>2. Duży dymek przez 15 sekund</span></label><label class="commChoice"><input type="checkbox" name="channels" value="PUSH"><span>3. Alert PUSH na telefon</span></label><button type="button" class="commAllToggle" id="commSelectAll">✓ Zaznacz wszystkie trzy</button><small class="commChannelHint">Możesz wybrać jeden, dwa albo wszystkie trzy. Domyślnie tylko powiadomienie.</small></div><div class="commActions"><button type="submit">Wyślij wiadomość</button><button type="button" class="secondary" id="commCancel">Anuluj</button></div><details><summary>Historia wysłanych wiadomości</summary><div id="commHistory" class="commHistory">Wczytywanie…</div></details></form>';
  document.body.appendChild(dialog);find('commCancel').onclick=()=>dialog.close();
  find('commSelectAll').onclick=()=>dialog.querySelectorAll('input[name="channels"]').forEach(input=>{input.checked=true});dialog.addEventListener('close',()=>dialog.remove());
  dialog.querySelector('form').onsubmit=async ev=>{
    ev.preventDefault();const form=ev.currentTarget,body=form.elements.body.value.trim();
    const channels=[...form.querySelectorAll('input[name="channels"]:checked')].map(input=>input.value);
    if(!channels.length){msg('Wybierz co najmniej jeden sposób wysyłki.','bad');return}
    const payload={body,channels,competitionId:Number(compId)||0};
    if(group)payload.group=form.elements.group.value;else payload.userId=Number(userId);
    const submit=form.querySelector('[type="submit"]');submit.disabled=true;submit.textContent='Wysyłam…';
    try{
      const out=await api('/api/admin/messages',{method:'POST',body:JSON.stringify(payload),timeoutMs:45000});
      dialog.close();
      const notice='Wysłano do '+out.delivered+' zawodników. Wybrane: '+channels.map(c=>({INBOX:'powiadomienie',POPUP:'dymek',PUSH:'PUSH'})[c]).join(' + ')+'.';
      if(channels.includes('PUSH')){
        const status=' PUSH wysłane: '+Number(out.pushSent||0)+
          (Number(out.pushFailed||0)?', błędy: '+Number(out.pushFailed):'')+
          (Number(out.pushUnavailable||0)?', bez aktywnego PUSH: '+Number(out.pushUnavailable):'')+'.';
        msg(notice+status+(Number(out.pushSent||0)===0?' Sprawdź alerty u odbiorcy.':''),Number(out.pushSent||0)>0?'ok':'bad');
      }else msg(notice);
    }
    catch(e){msg(e.message,'bad');submit.disabled=false;submit.textContent='Wyślij wiadomość'}
  };
  dialog.showModal();
  try{
    const out=await api('/api/admin/messages?limit=12');
    const history=find('commHistory');
    if(history)history.innerHTML=(out.messages||[]).length?out.messages.map(m=>'<div class="commHistoryItem"><b>'+safe(m.recipient_label)+'</b> · '+safe(new Date(m.created_at).toLocaleString('pl-PL'))+'<small>'+safe(m.competition_title||'Wiadomość ogólna')+' · '+(['PUSH','POPUP','POPUP+PUSH'].includes(m.display_mode)?'Wysyłka '+safe(m.display_mode):m.read_count+'/'+m.recipient_count+' przeczytało')+'</small>'+safe(m.body)+'</div>').join(''):'Brak wcześniejszych wiadomości.';
  }catch(_){const h=find('commHistory');if(h)h.textContent='Nie udało się pobrać historii.'}
};
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&ME?.role==='PLAYER'&&TOKEN)loadNotifications().catch(()=>{})});
refreshTimer=setInterval(()=>{if(document.visibilityState==='visible'&&ME?.role==='PLAYER'&&TOKEN)loadNotifications().catch(()=>{})},30000);
})();
