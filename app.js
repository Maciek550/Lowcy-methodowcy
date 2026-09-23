const CLIENT_VERSION='138';const CLIENT_VERSION_NAME='V138_PHOTO_SUM_PRIORITY';window.__LOWCY_APP_JS_138=1;try{fetch('/__probe_js_v138',{cache:'no-store'}).catch(()=>{})}catch(_){};console.log('CLIENT_V138_PHOTO_SUM_PRIORITY_LOADED');try{document.title='Łowcy Methodowcy — V'+CLIENT_VERSION}catch(_){}
const STORE={get(k){try{return localStorage.getItem(k)||''}catch(e){return ''}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
let ACHIEVEMENT_POLL=null, ACHIEVEMENT_BUSY=false, ACHIEVEMENT_TIMEOUT=null, ACHIEVEMENT_ACK=null;
const ACHIEVEMENT_SESSION_SEEN=new Set();
function stopAchievements(){ACHIEVEMENT_ACK=null;clearInterval(ACHIEVEMENT_POLL);ACHIEVEMENT_POLL=null;clearTimeout(ACHIEVEMENT_TIMEOUT);document.getElementById('achievementToast')?.remove()}
function startAchievements(){stopAchievements();if(!ME||ME.role==='ADMIN')return;pollAchievements();ACHIEVEMENT_POLL=setInterval(pollAchievements,12000)}
function closeAchievementToast(){
  clearTimeout(ACHIEVEMENT_TIMEOUT);
  const ack=ACHIEVEMENT_ACK;ACHIEVEMENT_ACK=null;
  if(ack)ack();
  const el=document.getElementById('achievementToast');
  if(el){el.classList.add('closing');setTimeout(()=>{el.remove();pollAchievements()},180)}
}
function renderCarpEncouragement(a){return '<button type="button" class="achievementClose" aria-label="Zamknij">×</button><svg class="carpScene" viewBox="0 0 400 260" aria-hidden="true"><defs><linearGradient id="carpGold" x2=".3" y2="1"><stop stop-color="#fff1a5"/><stop offset=".45" stop-color="#d6a548"/><stop offset="1" stop-color="#74451e"/></linearGradient><linearGradient id="carpFin"><stop stop-color="#d8a353"/><stop offset="1" stop-color="#6f3e20"/></linearGradient><radialGradient id="carpGlow"><stop stop-color="#73cfc4" stop-opacity=".35"/><stop offset="1" stop-color="#73cfc4" stop-opacity="0"/></radialGradient></defs><ellipse cx="200" cy="140" rx="180" ry="120" fill="url(#carpGlow)"/><g class="carpWater"><path d="M0 216 Q50 200 100 216T200 216T300 216T400 216V260H0Z" fill="#166d72" opacity=".7"/><path d="M0 223 Q50 207 100 223T200 223T300 223T400 223" fill="none" stroke="#85ddd3" stroke-width="2" opacity=".65"/></g><g class="carpRipple" fill="none" stroke="#9be9e0"><ellipse cx="200" cy="220" rx="48" ry="8" stroke-width="3"/><ellipse cx="200" cy="220" rx="72" ry="13" opacity=".55"/></g><g class="carpLeap"><g class="carpFish"><defs><clipPath id="carpBodyClip"><path d="M144 0H400V260H134L143 157L144 135Z"/></clipPath><clipPath id="carpTailClip"><path d="M0 0H146V136L145 157L136 260H0Z"/></clipPath></defs><g clip-path="url(#carpBodyClip)"><image href="/carp-real-v116.png" x="16" y="12" width="368" height="214" preserveAspectRatio="xMidYMid meet"/></g><g class="carpTailSwing"><g clip-path="url(#carpTailClip)"><image href="/carp-real-v116.png" x="16" y="12" width="368" height="214" preserveAspectRatio="xMidYMid meet"/></g></g></g></g><circle class="carpDrop" style="--dx:-110px;--dy:-85px;--delay:0s" cx="200" cy="218" r="4" fill="#b0f4ed"/><circle class="carpDrop" style="--dx:-70px;--dy:-125px;--delay:0.08s" cx="200" cy="218" r="3" fill="#b0f4ed"/><circle class="carpDrop" style="--dx:-135px;--dy:-50px;--delay:0.12s" cx="200" cy="218" r="3" fill="#b0f4ed"/><circle class="carpDrop" style="--dx:90px;--dy:-105px;--delay:0.04s" cx="200" cy="218" r="5" fill="#b0f4ed"/><circle class="carpDrop" style="--dx:130px;--dy:-65px;--delay:0.1s" cx="200" cy="218" r="3" fill="#b0f4ed"/><circle class="carpDrop" style="--dx:45px;--dy:-145px;--delay:0.15s" cx="200" cy="218" r="3" fill="#b0f4ed"/><circle class="carpDrop" style="--dx:-30px;--dy:-150px;--delay:0.18s" cx="200" cy="218" r="2" fill="#b0f4ed"/><circle class="carpDrop" style="--dx:70px;--dy:-70px;--delay:0.2s" cx="200" cy="218" r="2" fill="#b0f4ed"/><path class="carpSplash" d="M145 219L130 199L167 210L159 185L189 210L201 187L214 210L247 188L239 214L270 203L253 224" fill="#7fdbd2" opacity=".8"/></svg><div class="carpMessage"><h3>'+(Number(a.round)===2?'TEN KARP CZEKA<br>NA REWANŻ!':'POWODZENIA<br>W 2 TURZE!')+'</h3><p>'+(Number(a.round)===2?'Do zobaczenia na kolejnych zawodach!':'Nowa tura, nowa szansa! 💪')+'</p><small>'+esc(a.title)+'</small></div><div class="achievementTimer"></div>'}
let CARP_IMAGE_READY=null;
function preloadRealCarp(){
  if(!CARP_IMAGE_READY)CARP_IMAGE_READY=new Promise((resolve,reject)=>{
    const img=new Image();
    const timeout=setTimeout(()=>{CARP_IMAGE_READY=null;reject(new Error('Nie wczytano grafiki karpia'))},15000);
    img.onload=()=>{clearTimeout(timeout);resolve()};
    img.onerror=()=>{clearTimeout(timeout);CARP_IMAGE_READY=null;reject(new Error('Nie wczytano grafiki karpia'))};
    img.src='/carp-real-v116.png';
  });
  return CARP_IMAGE_READY;
}
function achievementDeliveryKey(uid,a){return 'achievement:'+uid+':'+a.id+(Number(a.delivery||1)>1?':delivery:'+a.delivery:'')}
function renderPodiumAchievement(a){
  const general=String(a.key||'').startsWith('GENERAL:');
  const match=String(a.label||'').match(/^([0-9]+(?:[.,][0-9]+)?)/);
  const place=a.place??(match?match[1]:'');
  const sector=a.sector??String(a.label||'').split(' w sektorze ')[1]??'';
  const category=general?'Klasyfikacja generalna':'Sektor '+sector+(a.context?' · '+a.context:'');
  return '<button type="button" class="achievementClose" aria-label="Zamknij gratulacje">×</button><div class="achievementTrophy" aria-hidden="true">🏆</div><h3 class="achievementPlace">'+esc(String(place).replace('.',','))+'. miejsce</h3><p class="achievementCategory">'+esc(category)+'</p><p class="achievementWeight">Waga <strong>'+esc(Number(a.weight||0).toLocaleString('pl-PL'))+' g</strong></p><small>'+esc(a.title||'')+'</small><div class="achievementTimer"></div>';
}
async function pollAchievements(){
  if(ACHIEVEMENT_BUSY||!ME||ME.role==='ADMIN'||document.hidden||document.getElementById('achievementToast'))return;
  const uid=ME.id;ACHIEVEMENT_BUSY=true;
  try{
    const d=await api('/api/achievements');
    if(!ME||ME.id!==uid||document.hidden)return;
    const fresh=[];
    for(const a of d.achievements||[]){
      const key=achievementDeliveryKey(uid,a);
      if(ACHIEVEMENT_SESSION_SEEN.has(key)||STORE.get(key)){await api('/api/achievements/'+a.id+'/seen',{method:'POST',body:JSON.stringify({delivery:Number(a.delivery||1)})});continue}
      fresh.push(a);
    }
    if(!fresh.length)return;
    const group=[fresh.find(a=>String(a.payload.key||'').startsWith('GENERAL:'))||fresh[0]];
    let carpReady=true;
    if(group[0].payload.kind==='ENCOURAGEMENT')try{await preloadRealCarp()}catch(e){carpReady=false;console.warn(e.message)}
    if(!ME||ME.id!==uid||document.hidden)return;
    const el=document.createElement('aside');el.id='achievementToast';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
    el.innerHTML=renderPodiumAchievement(group[0].payload);
    if(group[0].payload.kind==='ENCOURAGEMENT'){el.classList.add('carpEncouragement');el.innerHTML=renderCarpEncouragement(group[0].payload);if(!carpReady)el.querySelector('.carpScene')?.remove()}
    el.querySelector('button').onclick=closeAchievementToast;
    document.body.appendChild(el);
    ACHIEVEMENT_TIMEOUT=setTimeout(closeAchievementToast,8000);
    ACHIEVEMENT_ACK=()=>{
      if(!ME||ME.id!==uid)return;
      for(const a of group){const key=achievementDeliveryKey(uid,a);ACHIEVEMENT_SESSION_SEEN.add(key);STORE.set(key,'1');api('/api/achievements/'+a.id+'/seen',{method:'POST',body:JSON.stringify({delivery:Number(a.delivery||1)})}).catch(()=>{})}
    };
  }catch(e){console.warn('Nie udało się pobrać dymków:',e.message)}finally{ACHIEVEMENT_BUSY=false}
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(ACHIEVEMENT_TIMEOUT);ACHIEVEMENT_ACK=null;document.getElementById('achievementToast')?.remove()}else pollAchievements()});
let TOKEN = STORE.get('carp_token') || '';
let ME = null;
let CURRENT_DETAIL = null;
let CREATING_COMPETITION = false;
let SAVING_RESULTS = false;
let SAVING_RESULT_ITEM = false;
let LOGIN_IN_PROGRESS = false;
let STRUCTURE_SAVE_TIMER = null;
let STRUCTURE_READY = false;
let SECTOR_MANUAL_DRAFT = undefined;
let ACTIVE_ADMIN_ZONE = 'roster';
let PLAYER_DRAW_ROUND = 1;
let PLAYER_DRAW_VIEW = 'map';
let PLAYER_RESULTS_TAB = 't1';
let PLAYER_MOBILE_PANEL = null;
const UI_STATE_KEY='lowcy_player_ui_state_v2';
try{if(STORE.get('lowcy_ui_fix_version')!=='78'){STORE.del(UI_STATE_KEY);STORE.set('lowcy_ui_fix_version','78')}}catch(_){}
function readPersistentUiState(){try{return JSON.parse(STORE.get(UI_STATE_KEY)||'{}')||{}}catch(_){return {}}}
function activeTopTab(){for(const n of ['competitions','notifications','profile','history']){const el=q('tab-'+n);if(el&&!el.classList.contains('hidden'))return n}return 'competitions'}
function isRealPageReload(){
  try{
    const nav=performance.getEntriesByType&&performance.getEntriesByType('navigation')?.[0];
    if(nav&&nav.type)return nav.type==='reload';
    return Boolean(performance.navigation&&performance.navigation.type===1);
  }catch(_){return false}
}
function savePersistentUiState(){
  if(!ME||ME.role==='ADMIN')return;
  try{
    const detail=q('competitionDetail');
    STORE.set(UI_STATE_KEY,JSON.stringify({
      activeTab:activeTopTab(),
      competitionId:CURRENT_DETAIL?.competition?.id||null,
      detailVisible:Boolean(CURRENT_DETAIL&&detail&&!detail.classList.contains('hidden')),
      playerPanel:PLAYER_MOBILE_PANEL||null,
      scrollY:Math.max(0,Math.round(window.scrollY||0)),
      savedAt:Date.now()
    }));
  }catch(_){ }
}
async function restorePersistentUiState(){
  if(!ME||ME.role==='ADMIN')return;
  /* V78: nigdy nie otwieramy panelu zawodów automatycznie przy starcie lub reloadzie.
     Panel pojawia się wyłącznie po świadomym kliknięciu „Losowanie/Wyniki”. */
  const detail=q('competitionDetail');
  CURRENT_DETAIL=null;PLAYER_MOBILE_PANEL=null;PLAYER_RESULTS_TAB='t1';PLAYER_DRAW_ROUND=1;PLAYER_DRAW_VIEW='map';
  try{STORE.del(UI_STATE_KEY)}catch(_){}
  if(detail){detail.classList.add('hidden');detail.innerHTML=''}
  showTab('competitions');
  requestAnimationFrame(()=>{clearPlayerFixed(document.querySelector('.playerUnifiedNav'),document.querySelector('.playerDrawStickySlot'));window.scrollTo(0,0);syncPlayerStickyBars()});
}

function closePlayerCompetition(ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  const detail=q('competitionDetail');
  if(detail){detail.classList.add('hidden');detail.innerHTML=''}
  CURRENT_DETAIL=null;PLAYER_MOBILE_PANEL=null;PLAYER_RESULTS_TAB='t1';PLAYER_DRAW_ROUND=1;PLAYER_DRAW_VIEW='map';
  try{STORE.del(UI_STATE_KEY)}catch(_){ }
  requestAnimationFrame(()=>{syncPlayerStickyBars();window.scrollTo({top:0,behavior:'smooth'})});
}
window.addEventListener('pagehide',savePersistentUiState,{capture:true});
window.addEventListener('beforeunload',savePersistentUiState,{capture:true});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')savePersistentUiState()});
let PLAYER_SECTOR_STATE = {1:null,2:null};
let SHOW_FINAL_CLUB = false;
let PUSH_CONFIG = null;
let PUSH_SUBSCRIBED = false;
let PLAYER_UNREAD_NOTIFICATIONS = 0;
let PLAYER_COMP_FILTER = 'upcoming';
let PLAYER_COMP_MONTH = 'all';
let PLAYER_COMPETITIONS_CACHE = [];
let PLAYER_RESULT_POLL_TIMER = null;
let PLAYER_RESULT_POLL_BUSY = false;
let PLAYER_ATTENTION={count:0,items:[],byCompetition:{}};
let PLAYER_ATTENTION_BUSY=false;
const q = id => document.getElementById(id);
window.addEventListener('error',e=>{console.error('CLIENT_ERR',e.message);try{const m=document.getElementById('msg');if(m)m.innerHTML='<div class=\"card bad danger-line\">Błąd ekranu: '+String(e.message||'nieznany')+'</div>'}catch(_){}});
window.addEventListener('unhandledrejection',e=>{console.error('CLIENT_REJECT',e.reason);});
function esc(s){return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function phoneTelHref(phone){
  const raw=String(phone||'').trim();if(!raw)return '';
  const compact=raw.replace(/[^0-9+]/g,'');
  if(!compact)return '';
  return compact.startsWith('+')?('+'+compact.slice(1).replace(/\+/g,'')):compact.replace(/\+/g,'');
}
function renderPhoneCall(phone,cls=''){
  const raw=String(phone||'').trim(),href=phoneTelHref(raw);
  if(!href)return '<span class="muted">—</span>';
  return '<a class="phoneCallBtn '+esc(cls)+'" href="tel:'+esc(href)+'" title="Zadzwoń: '+esc(raw)+'" aria-label="Zadzwoń pod numer '+esc(raw)+'"><span class="phoneCallIcon">☎</span><span>'+esc(raw)+'</span></a>';
}
function msg(t,type='ok'){const el=q('msg');if(!el)return;el.innerHTML='<div class="card '+(type==='bad'?'bad danger-line':'ok success-line')+'">'+esc(t)+'</div>';setTimeout(()=>{const x=q('msg');if(x)x.innerHTML=''},3500)}
async function api(path, opts={}){const fetchOpts={...opts},timeoutMs=Math.max(800,Number(fetchOpts.timeoutMs||30000));delete fetchOpts.timeoutMs;const ctrl=typeof AbortController!=='undefined'?new AbortController():null;const to=ctrl?setTimeout(()=>ctrl.abort(),timeoutMs):null;try{const res=await fetch(path,Object.assign({cache:'no-store',signal:ctrl?ctrl.signal:undefined,headers:{'Content-Type':'application/json',...(TOKEN?{Authorization:'Bearer '+TOKEN}:{})}},fetchOpts));const data=await res.json().catch(()=>({ok:false,error:'Błąd odpowiedzi'}));if(!res.ok||data.ok===false){const error=new Error(data.error||'Błąd');error.status=res.status;throw error}return data}catch(e){if(e&&e.name==='AbortError'){const error=new Error('Serwer jeszcze nie odpowiada. Spróbuj ponownie.');error.timeout=true;throw error}throw e}finally{if(to)clearTimeout(to)}}
function fmtDate(d){if(!d)return '—';const s=String(d);const m=s.match(/^\d{4}-\d{2}-\d{2}/);const dt=new Date(m?(m[0]+'T12:00:00'):s);return isNaN(dt.getTime())?'—':dt.toLocaleDateString('pl-PL')}
function dateInputValue(d){if(!d)return '';const s=String(d);const m=s.match(/^\d{4}-\d{2}-\d{2}/);return m?m[0]:''}
function fmtGram(v){v=Number(v||0);return v?String(v).replace(/\B(?=(\d{3})+(?!\d))/g,' '):'0'}
function statusName(s){return s==='OPEN'?'ZAWODY OTWARTE':s==='CLOSED'?'ZAPISY ZAKOŃCZONE':s==='TEST'?'TESTOWE — TYLKO ADMIN':esc(s||'')}
function playerNotifLabel(unread=PLAYER_UNREAD_NOTIFICATIONS){const n=Math.max(0,Number(unread||0));return 'POWIADOMIENIA'+(n?'<span class="playerNotifBadge">'+(n>99?'99+':n)+'</span>':'')}
function playerRoundHasResults(d,round){const n=Number(round);return (d?.results||[]).some(r=>Number(r.round)===n)||(d?.resultItems||[]).some(r=>Number(r.round)===n)}
function playerRoundHasOwnDraw(d,round){const n=Number(round),uid=Number(ME?.id||0);return Boolean(uid&&(d?.draws||[]).some(r=>Number(r.round)===n&&Number(r.user_id)===uid))}
function playerResultSeenKey(compId,round){return 'lowcy_result_seen_'+Number(compId||0)+'_'+Number(round)}
function playerDrawSeenKey(compId,round){return 'lowcy_draw_seen_'+Number(compId||0)+'_'+Number(round)}
function playerResultSeen(compId,round){return STORE.get(playerResultSeenKey(compId,round))==='1'}
function playerDrawSeen(compId,round){return STORE.get(playerDrawSeenKey(compId,round))==='1'}
function playerHasNewResults(d,round){const id=Number(d?.competition?.id||0),kind='RESULTS_T'+Number(round);return Boolean(id&&playerRoundHasResults(d,round)&&playerAttentionItemsFor({id}).some(x=>x.kind===kind))}
function playerHasNewDraw(d,round){const id=Number(d?.competition?.id||0);return Boolean(id&&playerRoundHasOwnDraw(d,round)&&playerAttentionItemsFor({id}).some(x=>x.kind==='DRAW_PUBLISH'))}
function playerResultStar(d,round){return playerHasNewResults(d,round)?'<span class="playerNewResultStar" data-result-round="'+Number(round)+'" aria-label="Nowe wyniki" title="Nowe wyniki">★</span>':''}
function playerDrawStar(d,round){return playerHasNewDraw(d,round)?'<span class="playerNewResultStar playerNewDrawStar" data-draw-round="'+Number(round)+'" aria-label="Nowe losowanie" title="Nowe losowanie">★</span>':''}
function markPlayerResultSeen(round){const id=CURRENT_DETAIL?.competition?.id;if(!id)return;STORE.set(playerResultSeenKey(id,round),'1');document.querySelectorAll('.playerNewResultStar[data-result-round="'+Number(round)+'"]').forEach(x=>x.remove());markPlayerAttentionRead(id,'RESULTS_T'+Number(round),true)}
function markPlayerDrawSeen(round){const id=CURRENT_DETAIL?.competition?.id;if(!id)return;STORE.set(playerDrawSeenKey(id,round),'1');document.querySelectorAll('.playerNewResultStar[data-draw-round="'+Number(round)+'"]').forEach(x=>x.remove());markPlayerAttentionRead(id,'DRAW_PUBLISH',true)}
function playerResultsSignature(d){const items=[...(d?.results||[]).map(r=>['r',r.round,r.user_id,r.weight,r.big_fish]),...(d?.resultItems||[]).map(r=>['i',r.round,r.user_id,r.kind,r.weight])];return JSON.stringify(items.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))}
function playerDrawSignature(d){const uid=Number(ME?.id||0);const items=(d?.draws||[]).filter(r=>!uid||Number(r.user_id)===uid).map(r=>[r.round,r.user_id,r.stand,r.sector]);return JSON.stringify(items.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b))))}
function playerContentSignature(d){return playerResultsSignature(d)+'|'+playerDrawSignature(d)}
function syncPlayerContentStars(d=CURRENT_DETAIL){[1,2].forEach(round=>{const freshResult=playerHasNewResults(d,round);document.querySelectorAll('.playerNewResultStar[data-result-round="'+round+'"]').forEach(x=>{if(!freshResult)x.remove()});if(freshResult&&!document.querySelector('.playerNewResultStar[data-result-round="'+round+'"]'))document.querySelectorAll('.playerUnifiedNav button,.playerDesktopUnifiedNav button').forEach(btn=>{const click=btn.getAttribute('onclick')||'';if(click.includes("'t"+round+"'"))btn.insertAdjacentHTML('beforeend',playerResultStar(d,round))});const freshDraw=playerHasNewDraw(d,round);document.querySelectorAll('.playerNewResultStar[data-draw-round="'+round+'"]').forEach(x=>{if(!freshDraw)x.remove()});if(freshDraw&&!document.querySelector('.playerNewResultStar[data-draw-round="'+round+'"]'))document.querySelectorAll('.playerUnifiedNav button,.playerDesktopUnifiedNav button').forEach(btn=>{const click=btn.getAttribute('onclick')||'';if(click.includes("'draw"+round+"'"))btn.insertAdjacentHTML('beforeend',playerDrawStar(d,round))})})}
function stopPlayerResultPolling(){if(PLAYER_RESULT_POLL_TIMER){clearInterval(PLAYER_RESULT_POLL_TIMER);PLAYER_RESULT_POLL_TIMER=null}}
function startPlayerResultPolling(){if(PLAYER_RESULT_POLL_TIMER)return;PLAYER_RESULT_POLL_TIMER=setInterval(()=>pollPlayerCompetitionResults(),12000)}
async function pollPlayerCompetitionResults(){if(PLAYER_RESULT_POLL_BUSY||!ME||ME.role==='ADMIN'||!CURRENT_DETAIL?.competition?.id||q('competitionDetail')?.classList.contains('hidden'))return;PLAYER_RESULT_POLL_BUSY=true;try{const id=CURRENT_DETAIL.competition.id,d=await api('/api/competitions/'+id);if(playerContentSignature(d)===playerContentSignature(CURRENT_DETAIL))return;CURRENT_DETAIL=d;const active=PLAYER_MOBILE_PANEL;if(active==='t1'||active==='t2')markPlayerResultSeen(active==='t1'?1:2);if(active==='draw1'||active==='draw2')markPlayerDrawSeen(active==='draw1'?1:2);const mobile=q('playerMobilePanelContent'),desktop=q('playerDesktopPanelContent');if(mobile)mobile.innerHTML=renderPlayerMobilePanelContent(d,active);if(desktop)desktop.innerHTML=renderPlayerDesktopPanelContent(d,active);syncPlayerContentStars(d);requestAnimationFrame(()=>{syncPlayerStickyBars();fitPlayerMobileFullMaps()})}catch(_){ }finally{PLAYER_RESULT_POLL_BUSY=false}}
function syncNotificationBadges(unread=PLAYER_UNREAD_NOTIFICATIONS){const n=Math.max(0,Number(unread||0));document.querySelectorAll('#playerNotifBtn,.notificationTile').forEach(btn=>{btn.innerHTML=playerNotifLabel(n)});const top=q('btn-notifications');if(top){let b=top.querySelector('.topNotifBadge');if(n){if(!b){b=document.createElement('span');b.className='topNotifBadge';top.appendChild(b)}b.textContent=n>99?'99+':String(n)}else if(b)b.remove()}}

function applyPlayerAppBadge(n){
  n=Math.max(0,Number(n||0));
  try{
    if(typeof navigator!=='undefined'&&typeof navigator.setAppBadge==='function'){
      if(n)navigator.setAppBadge(n).catch(()=>{});
      else if(typeof navigator.clearAppBadge==='function')navigator.clearAppBadge().catch(()=>{});
    }
  }catch(_){}
}
function playerAttentionMap(items){
  const by={};for(const it of (items||[])){const id=Number(it.competitionId||0);if(!id)continue;(by[id]=by[id]||[]).push(it)}
  return by;
}
function applyPlayerAttention(data,rerender=false){
  if(!data||typeof data!=='object')data={count:0,items:[]};
  PLAYER_ATTENTION={count:Math.max(0,Number(data.count||0)),items:Array.isArray(data.items)?data.items:[],byCompetition:{}};
  PLAYER_ATTENTION.byCompetition=playerAttentionMap(PLAYER_ATTENTION.items);
  if(ME?.role==='PLAYER'){
    syncNotificationBadges(PLAYER_ATTENTION.count);
    const counter=q('notifCounter');if(counter)counter.textContent=PLAYER_ATTENTION.count?'🔴 '+PLAYER_ATTENTION.count+' do sprawdzenia':'';
    applyPlayerAppBadge(PLAYER_ATTENTION.count);
    if(rerender&&PLAYER_COMPETITIONS_CACHE.length)renderPlayerCompetitionList();
  }
}
async function refreshPlayerAttention(rerender=false){
  if(!ME||ME.role!=='PLAYER'||PLAYER_ATTENTION_BUSY)return PLAYER_ATTENTION;
  PLAYER_ATTENTION_BUSY=true;
  try{const d=await api('/api/me/attention');applyPlayerAttention(d,rerender);return PLAYER_ATTENTION}catch(_){return PLAYER_ATTENTION}
  finally{PLAYER_ATTENTION_BUSY=false}
}
function playerAttentionItemsFor(c){return PLAYER_ATTENTION.byCompetition[Number(c?.id||0)]||[]}
function playerAttentionPrimary(c){
  const items=playerAttentionItemsFor(c);
  if(!items.length)return null;
  const presence=items.find(x=>x.kind==='PRESENCE_CONFIRM');if(presence)return presence;
  const pr={RESULTS_GENERAL:50,RESULTS_T2:40,DRAW_PUBLISH:30,RESULTS_T1:20};
  return [...items].sort((a,b)=>{
    const at=Date.parse(a.createdAt||0)||0,bt=Date.parse(b.createdAt||0)||0;
    return bt-at||(pr[b.kind]||0)-(pr[a.kind]||0);
  })[0]||null;
}
function playerCompetitionAttentionBadge(c){
  const n=playerAttentionItemsFor(c).length;
  return n?'<span class="playerCompAttentionBadge" title="'+n+' rzeczy do sprawdzenia">'+(n>9?'9+':n)+'</span>':'';
}
function playerPrimaryButton(c,extraClass=''){
  const a=playerAttentionPrimary(c),id=Number(c.id);
  if(!a)return '<button type="button" class="'+esc(extraClass)+'" onclick="openCompetition('+id+')">LOSOWANIE / WYNIKI</button>';
  if(a.kind==='PRESENCE_CONFIRM')return '<button type="button" class="playerCompAttentionMain '+esc(extraClass)+'" onclick="confirmPlayerPresence('+id+',this,event)">POTWIERDŹ OBECNOŚĆ</button>';
  const panel=String(a.panel||'').replace(/[^a-z0-9]/gi,'');
  const kind=String(a.kind||'').replace(/[^A-Z0-9_]/g,'');
  return '<button type="button" class="playerCompAttentionMain '+esc(extraClass)+'" onclick="openCompetitionAttention('+id+',\''+panel+'\',\''+kind+'\',event)">★ '+esc(a.label||'NOWOŚĆ')+'</button>';
}
async function markPlayerAttentionRead(compId,types,rerender=true){
  types=(Array.isArray(types)?types:[types]).filter(Boolean);
  if(!compId||!types.length)return;
  try{const d=await api('/api/notifications/attention/read',{method:'POST',body:JSON.stringify({competitionId:Number(compId),types})});applyPlayerAttention(d,rerender)}catch(_){}
}
async function openCompetitionAttention(id,panel,kind,ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  if(!await openCompetition(Number(id),true))return;
  if(panel)showPlayerMobilePanel(panel);
  await markPlayerAttentionRead(Number(id),kind,true);
}
function setLoggedOut(showMsg){q('accountSwitch')?.remove();q('accountLinkDialog')?.remove();document.body.classList.remove('judgeTheme');q('judgeShell')?.remove();stopAchievements();
  try{document.documentElement.classList.remove('hasSavedSession');document.body.classList.add('authMode')}catch(_){}
  stopPlayerResultPolling();
  q('playerGlobalBottomNav')?.remove();
  TOKEN=''; ME=null; document.body.classList.remove('playerTheme'); STORE.del('carp_token');applyPlayerAppBadge(0);
  const logout=q('logoutBtn'), auth=q('auth'), app=q('app');
  if(logout)logout.classList.add('hidden');
  if(auth)auth.classList.remove('hidden');
  if(app)app.classList.add('hidden');
  const who=q('who'), role=q('role'), notif=q('notifCounter');
  if(who)who.textContent=''; if(role)role.textContent=''; if(notif)notif.textContent='';
  if(showMsg)msg('Sesja wyczyszczona. Zaloguj się ponownie.','ok');
}
async function boot(){
  const logout=q('logoutBtn'), auth=q('auth'), app=q('app');
  if(logout)logout.classList.add('hidden');
  if(!TOKEN){if(auth)auth.classList.remove('hidden');if(app)app.classList.add('hidden');setLoggedOut(false);return}
  if(auth)auth.classList.add('hidden');
  if(app)app.classList.add('hidden');
  try{const d=await api('/api/me');ME=d.user;if(ME?.role==='JUDGE')STORE.set(JUDGE_ME_CACHE,JSON.stringify(ME))}catch(e){if(e.status===401||e.status===403){setLoggedOut(false);return}try{const cached=JSON.parse(STORE.get(JUDGE_ME_CACHE)||'null');if(cached?.role==='JUDGE'){ME=cached}else throw e}catch(_){throw e}}
  if(auth)auth.classList.add('hidden');
  if(app)app.classList.remove('hidden');
  if(logout)logout.classList.remove('hidden');
  mountAccountSwitch();
  document.body.classList.toggle('judgeTheme',ME.role==='JUDGE');
  if(ME.role==='JUDGE'){mountJudgeShell();hideBootGuard();await judgeLoadCompetitions();if(navigator.onLine)flushJudgeQueue(true).catch(()=>{});return}
  q('judgeShell')?.remove();
  if(ME.role==='ADMIN')await loadJudgeManagement();else {q('judgeManagement')?.remove();q('adminQuickActions')?.remove()}
  q('who').textContent=ME.first_name+' '+ME.last_name+' — Koło PZW '+(ME.pzw_club||'');q('role').textContent=ME.role==='ADMIN'?'Administrator':'Zawodnik';
  const admin=ME.role==='ADMIN';document.body.classList.remove('authMode');document.body.classList.toggle('playerTheme',!admin);q('btn-players').classList.toggle('hidden',!admin);q('btn-profile')?.classList.toggle('hidden',admin);q('btn-history')?.classList.toggle('hidden',admin);q('btn-rules')?.classList.remove('hidden');q('adminCreate').classList.toggle('hidden',!admin);if(q('adminCreate'))q('adminCreate').open=false;const notifTop=q('btn-notifications');if(notifTop)notifTop.textContent=admin?'Powiadomienia':'NOWOŚCI';const rulesTop=q('btn-rules');if(rulesTop)rulesTop.innerHTML=admin?'Regulamin ogólny':'Regulamin<br>ogólny';const historyTop=q('btn-history');if(historyTop&&!admin)historyTop.innerHTML='Historia<br>startów';
  mountPlayerBottomNav();
  renderPushStatus();
  showTab('competitions');
  if(!admin){const detail=q('competitionDetail');if(detail)detail.classList.add('hidden')}
  hideBootGuard();
  await Promise.allSettled([loadCompetitions(),loadNotifications(),admin?loadPlayers():Promise.resolve()]);
  startAchievements();
  if(!admin)await restorePersistentUiState();
  if('serviceWorker' in navigator){navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(reg=>{try{reg.update()}catch(_){ }if('Notification' in window&&Notification.permission==='granted')ensurePushSubscription(true,false).catch(()=>{})}).catch(()=>{})}
}
async function login(){try{const phone=q('loginPhone')?.value||'';const password=q('loginPassword')?.value||'';if(!phone.trim()||!password)throw new Error('Wpisz telefon i hasło');const d=await api('/api/login',{method:'POST',body:JSON.stringify({phone,password})});TOKEN=d.token;STORE.set('carp_token',TOKEN);msg('Zalogowano');await boot()}catch(e){msg(e.message,'bad')}}
async function registerPlayer(ev){if(ev){ev.preventDefault&&ev.preventDefault();ev.stopPropagation&&ev.stopPropagation()}try{const d=await api('/api/register',{method:'POST',body:JSON.stringify({phone:q('regPhone').value,password:q('regPassword').value,firstName:q('regFirst').value,lastName:q('regLast').value,pzwClub:q('regClub').value})});TOKEN=d.token;STORE.set('carp_token',TOKEN);msg('Konto zawodnika utworzone');await boot()}catch(e){msg(e.message,'bad')}}
async function setupAdmin(ev){if(ev){ev.preventDefault&&ev.preventDefault();ev.stopPropagation&&ev.stopPropagation()}try{const d=await api('/api/setup-admin',{method:'POST',body:JSON.stringify({setupCode:q('setupCode').value,phone:q('setupPhone').value,password:q('setupPassword').value,firstName:q('setupFirst').value,lastName:q('setupLast').value,pzwClub:q('setupClub').value})});TOKEN=d.token;STORE.set('carp_token',TOKEN);msg('Admin utworzony');await boot()}catch(e){msg(e.message,'bad')}}
async function logout(){STORE.del('lowcy_account_sessions');stopAchievements();try{await disablePushSubscription(false)}catch(_){}STORE.del('carp_token');TOKEN='';ME=null;setLoggedOut(true)}
async function clearSession(){STORE.del('lowcy_account_sessions');try{await disablePushSubscription(true);if('caches'in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k).catch(()=>{})));}}catch(_){}setLoggedOut(true)}
function renderMyProfile(){
  const box=q('myProfileContent');if(!box||!ME)return;
  box.innerHTML='<div class="card myProfileCard"><div class="myProfileHead"><div><h2>Mój profil</h2><p class="small muted">Tutaj możesz poprawić swoje dane logowania i dane zawodnika.</p></div><span class="myProfileRole">ZAWODNIK</span></div>'
    +'<div class="myProfileGrid"><div><label>Imię</label><input id="profileFirstName" autocomplete="given-name" value="'+esc(ME.first_name||'')+'"></div><div><label>Nazwisko</label><input id="profileLastName" autocomplete="family-name" value="'+esc(ME.last_name||'')+'"></div><div><label>Koło PZW</label><input id="profileClub" value="'+esc(ME.pzw_club||'')+'"></div><div><label>Telefon</label><input id="profilePhone" type="tel" inputmode="tel" autocomplete="tel" value="'+esc(ME.phone||'')+'"></div></div>'
    +'<div class="myProfilePassword"><h3>Zmiana hasła</h3><p class="small muted">Jeżeli nie chcesz zmieniać hasła, zostaw oba pola puste.</p><div class="myProfileGrid"><div><label>Nowe hasło</label><input id="profilePassword" type="password" autocomplete="new-password" placeholder="Nowe hasło"></div><div><label>Powtórz nowe hasło</label><input id="profilePassword2" type="password" autocomplete="new-password" placeholder="Powtórz hasło"></div></div></div>'
    +'<div class="myProfileActions"><button type="button" onclick="saveMyProfile(event)">Zapisz moje dane</button></div></div>';
}
async function saveMyProfile(ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  const firstName=String(q('profileFirstName')?.value||'').trim(),lastName=String(q('profileLastName')?.value||'').trim(),pzwClub=String(q('profileClub')?.value||'').trim(),phone=String(q('profilePhone')?.value||'').trim(),password=String(q('profilePassword')?.value||''),password2=String(q('profilePassword2')?.value||'');
  if(!firstName||!lastName||!pzwClub||!phone){msg('Uzupełnij imię, nazwisko, Koło PZW i telefon','bad');return}
  if(password!==password2){msg('Nowe hasła nie są takie same','bad');return}
  try{
    const d=await api('/api/me',{method:'PATCH',body:JSON.stringify({firstName,lastName,pzwClub,phone,password})});
    ME=d.user||ME;if(d.token){TOKEN=d.token;STORE.set('carp_token',TOKEN)}
    const who=q('who');if(who)who.textContent=ME.first_name+' '+ME.last_name+' — Koło PZW '+(ME.pzw_club||'');
    renderMyProfile();msg('Dane profilu zapisane');
  }catch(e){msg(e.message,'bad')}
}
function meetingTimeText(c){
  const raw=String(c?.meeting_time||'').trim();
  if(!raw)return '06:00';
  const m=raw.match(/^(\d{2}):(\d{2})/);return m?(m[1]+':'+m[2]):raw;
}
async function renderPlayerRules(){
  const box=q('playerRulesContent');if(!box)return;
  box.innerHTML='<div class="card playerRulesCard"><p class="muted">Wczytuję regulamin ogólny…</p></div>';
  try{
    const d=await api('/api/general-rules');
    const text=String(d.rules||'').trim();
    if(ME?.role==='ADMIN'){
      box.innerHTML='<div class="card playerRulesCard generalRulesAdmin"><div class="playerRulesHead"><h2>Regulamin ogólny</h2><span>dla wszystkich zawodników</span></div><p class="small muted">Ten regulamin jest wspólny dla wszystkich zawodów. Harmonogram i zasady konkretnego wydarzenia wpisujesz przez „Edytuj” przy danych zawodach.</p><textarea id="generalRulesEditor" class="rulesEditor generalRulesEditor" placeholder="Wpisz regulamin ogólny obowiązujący na wszystkich zawodach…">'+esc(d.rules||'')+'</textarea><div class="inlineBtns"><button type="button" onclick="saveGeneralRules(event)">Zapisz regulamin ogólny</button></div></div>';
    }else{
      box.innerHTML='<div class="card playerRulesCard generalRulesPlayer"><div class="playerRulesHead"><h2>Regulamin ogólny</h2></div>'+(text?'<div class="playerRuleText generalRulesText">'+esc(d.rules).replace(/\n/g,'<br>')+'</div>':'<p class="muted">Regulamin ogólny nie został jeszcze opublikowany.</p>')+'</div>';
    }
  }catch(e){box.innerHTML='<div class="card bad danger-line">Nie udało się wczytać regulaminu ogólnego.</div>';msg(e.message,'bad')}
}
async function saveGeneralRules(ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  if(ME?.role!=='ADMIN')return;
  const rules=String(q('generalRulesEditor')?.value||'');
  try{await api('/api/general-rules',{method:'PATCH',body:JSON.stringify({rules})});msg('Zapisano regulamin ogólny');await renderPlayerRules()}catch(e){msg(e.message,'bad')}
}
function renderPlayerHistory(rows){
  const box=q('playerHistoryContent');if(!box)return;
  rows=Array.isArray(rows)?rows:[];
  if(!rows.length){box.innerHTML='<div class="card playerHistoryCard"><h2>Historia startów</h2><p class="muted">Brak zakończonych startów z pełnymi wynikami T1 i T2.</p></div>';return}
  const starts=rows.length,podiums=rows.filter(r=>Number(r.general_rank)>0&&Number(r.general_rank)<=3).length;
  const best=Math.min(...rows.map(r=>Number(r.general_rank||9999)).filter(Number.isFinite));
  const total=rows.reduce((s,r)=>s+Number(r.total_weight||0),0);
  const biggest=Math.max(0,...rows.map(r=>Number(r.biggest_fish||0)));
  const stat=(label,value,cls='')=>'<div class="historyStat '+cls+'"><small>'+esc(label)+'</small><strong>'+value+'</strong></div>';
  const round=(r,n)=>{const place=placeText(r['t'+n+'_place']),size=Number(r['t'+n+'_sector_size']||0),stand=r['t'+n+'_stand'],sector=r['t'+n+'_sector']||'—',weight=Number(r['t'+n+'_weight']||0),bf=Number(r['t'+n+'_big_fish']||0);return '<div class="historyRound historyRound'+n+'"><div class="historyRoundTitle">TURA '+n+'</div><div class="historyRoundPlace"><b>'+place+'</b><span>/'+size+'</span></div><div class="historyRoundMeta"><span>Stan. <b>'+(stand??'—')+'</b></span><span>Sektor <b>'+esc(sector)+'</b></span></div><div class="historyRoundWeight">'+fmtGram(weight)+' g</div><div class="historyRoundBF">BF: <b>'+fmtGram(bf)+' g</b></div></div>'};
  const card=r=>'<article class="historyStartCard"><div class="historyStartHead"><div><h3>'+esc(r.fishery||r.title||'Zawody')+'</h3><span>'+fmtDate(r.competition_date)+(r.title&&r.fishery?' · '+esc(r.title):'')+'</span></div><div class="historyGeneral"><small>GENERAL</small><strong>'+Number(r.general_rank||0)+'/'+Number(r.general_count||0)+'</strong></div></div><div class="historyRounds">'+round(r,1)+round(r,2)+'</div><div class="historyStartFoot"><div><small>SUMA WAGI</small><b>'+fmtGram(r.total_weight)+' g</b></div><div><small>NAJWIĘKSZA RYBA</small><b>'+fmtGram(r.biggest_fish||0)+' g</b></div><button type="button" onclick="openHistoryCompetition('+Number(r.competition_id)+')">PEŁNE WYNIKI</button></div></article>';
  box.innerHTML='<section class="playerHistoryDashboard"><div class="historyHero"><div><h2>Historia startów</h2><p>Twoje wyniki i statystyki zawodów.</p></div><div class="historyStats">'+stat('STARTY',starts)+stat('PODIA',podiums,'podium')+stat('NAJLEPSZE MIEJSCE',best<9999?best:'—','best')+stat('NAJWIĘKSZA RYBA',fmtGram(biggest)+' g','fish')+stat('ŁĄCZNA WAGA',fmtGram(total)+' g','weight')+'</div></div><div class="historyStartList">'+rows.map(card).join('')+'</div></section>';
}
async function openHistoryCompetition(id){
  showTab('competitions');
  if(await openCompetition(Number(id),true))showPlayerMobilePanel('general');
}

async function loadPlayerHistory(){
  if(!ME||ME.role==='ADMIN')return;
  const box=q('playerHistoryContent');if(box)box.innerHTML='<div class="card"><p class="muted">Wczytuję historię startów…</p></div>';
  try{const d=await api('/api/me/history');renderPlayerHistory(d.history||[])}catch(e){if(box)box.innerHTML='<div class="card bad danger-line">Nie udało się wczytać historii startów.</div>';msg(e.message,'bad')}
}
function showTab(n){syncPlayerStickyBars();['competitions','rules','notifications','players','profile','history'].forEach(x=>{q('tab-'+x)?.classList.toggle('hidden',x!==n);q('btn-'+x)?.classList.toggle('active',x===n)});if(n==='rules')renderPlayerRules();if(n==='notifications')loadNotifications();if(n==='players')loadPlayers();if(n==='profile')renderMyProfile();if(n==='history')loadPlayerHistory()}
function competitionActionHtml(c,admin,mine,closed,cardMode=false){
  if(admin)return '<div class="inlineBtns '+(cardMode?'competitionCardActions adminCompetitionCardActions':'')+'"><button type="button" onclick="openCompetition('+c.id+')">Panel</button><button type="button" class="secondary" onclick="openCompetitionEdit('+c.id+')">Edytuj</button><button type="button" class="warn" onclick="deleteCompetition('+c.id+')">Usuń</button></div>';
  const leavePending=String(c.my_leave_request_status||'').toUpperCase()==='PENDING';
  const leaveButton=leavePending?'<button type="button" class="secondary leavePendingBtn" disabled>Prośba wysłana</button>':'<button type="button" class="warn" onclick="leaveComp('+c.id+')">Zrezygnuj</button>';
  return '<div class="inlineBtns competitionActions '+(cardMode?'competitionCardActions':'')+'"><button type="button" onclick="openCompetition('+c.id+')">LOSOWANIE / WYNIKI</button>'+(mine?leaveButton:'<button type="button" '+(closed?'disabled':'')+' onclick="joinComp('+c.id+')">Zapisz</button>')+'</div>';
}
function renderCompetitionMobileCard(c,admin){
  const mine=c.my_status==='ACTIVE'||c.my_status==='RESERVE',closed=c.status!=='OPEN'||c.signup_open===false,main=Number(c.active_count||0),reserve=Number(c.reserve_count||0),limit=Number(c.limit_places||0),stat='<b>'+main+'</b>'+(limit?' / '+limit:'')+(reserve?' + rezerwa '+reserve:'');
  return '<article class="competitionMobileCard '+(mine?'mine':'')+'"><div class="competitionMobileTitle"><b>'+esc(c.title)+'</b><span>'+esc(c.fishery||'')+'</span></div><div class="competitionMobileMeta"><div><small>Data / zbiórka</small><strong>'+fmtDate(c.competition_date)+' · '+esc(meetingTimeText(c))+'</strong></div><div><small>Stan zapisów</small><strong>'+stat+'</strong></div><div><small>Status</small><span class="pill">'+statusName(c.status)+'</span></div></div>'+competitionActionHtml(c,admin,mine,closed,true)+'</article>';
}
function playerCompetitionMine(c){return c.my_status==='ACTIVE'||c.my_status==='RESERVE'}
function playerCompetitionDateKey(c){return dateInputValue(c?.competition_date)||''}
function playerCompetitionTodayKey(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Warsaw',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());const val=t=>parts.find(p=>p.type===t).value;return val('year')+'-'+val('month')+'-'+val('day')}
function playerCompetitionPast(c){const k=playerCompetitionDateKey(c);return !!k&&k<playerCompetitionTodayKey()}
function playerCompetitionMonthKey(c){const k=playerCompetitionDateKey(c);return k?k.slice(0,7):'no-date'}
function playerCompetitionMonthLabel(key){if(key==='no-date')return 'BEZ DATY';const m=String(key).match(/^(\d{4})-(\d{2})$/);if(!m)return String(key).toUpperCase();const d=new Date(Number(m[1]),Number(m[2])-1,1);return d.toLocaleDateString('pl-PL',{month:'long',year:'numeric'}).toUpperCase()}
function playerCompetitionDateInfo(c){
  const key=playerCompetitionDateKey(c);if(!key)return {date:'—',weekday:'BRAK DATY',countdown:''};
  const m=key.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!m)return {date:fmtDate(c.competition_date),weekday:'',countdown:''};
  const y=Number(m[1]),mo=Number(m[2])-1,d=Number(m[3]);
  const dt=new Date(y,mo,d,12,0,0);const now=new Date();
  const todayUtc=Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()),targetUtc=Date.UTC(y,mo,d);
  const days=Math.round((targetUtc-todayUtc)/86400000);
  const weekday=dt.toLocaleDateString('pl-PL',{weekday:'long'}).toUpperCase();
  let countdown='';if(days===0)countdown='DZISIAJ';else if(days===1)countdown='JUTRO';else if(days>1)countdown='START ZA '+days+' DNI';else countdown='ZAKOŃCZONE';
  return {date:dt.toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit',year:'numeric'}),weekday,countdown,days};
}
function playerCompetitionCountdownClass(x){const d=Number(x?.days);if(!Number.isFinite(d))return 'future';if(d<0)return 'past';if(d===0)return 'today';if(d===1)return 'tomorrow';if(d<=7)return 'soon';return 'future'}
function renderPlayerCompetitionMobileDate(c){const x=playerCompetitionDateInfo(c),cc=playerCompetitionCountdownClass(x);return '<div class="playerCompDateLine"><strong class="playerCompDate">'+esc(x.date)+'</strong><span class="playerCompWeekday">'+esc(x.weekday)+'</span></div><div class="playerCompSubLine"><span class="playerCompFishery">'+esc(c.fishery||'—')+'</span><span class="playerCompMeeting">⏰ '+esc(meetingTimeText(c))+'</span>'+(x.countdown?'<em class="playerCompCountdown '+cc+'">'+esc(x.countdown)+'</em>':'')+'</div>'}
function renderPlayerCompetitionDesktopDate(c){const x=playerCompetitionDateInfo(c),cc=playerCompetitionCountdownClass(x);return '<div class="playerCompDesktopDateBox"><div class="playerCompDesktopDateTop"><strong class="playerCompDate">'+esc(x.date)+'</strong><b class="playerCompWeekday">'+esc(x.weekday)+'</b></div><span class="playerCompMeeting">⏰ Zbiórka '+esc(meetingTimeText(c))+'</span>'+(x.countdown?'<span class="playerCompCountdown '+cc+'">'+esc(x.countdown)+'</span>':'')+'</div>'}
function playerCompetitionNo(c){
  const all=Array.isArray(PLAYER_COMPETITIONS_CACHE)?PLAYER_COMPETITIONS_CACHE:[];
  const ordered=[...all].sort((a,b)=>Number(a.id)-Number(b.id));
  const idx=ordered.findIndex(x=>Number(x.id)===Number(c.id));
  return '#'+String(idx>=0?idx+1:1).padStart(2,'0');
}
function playerCompetitionStatus(c){const main=Number(c.active_count||0),limit=Number(c.limit_places||0);if(playerCompetitionPast(c))return {label:'ZAKOŃCZONE',cls:'done'};if(String(c.status||'')!=='OPEN'||c.signup_open===false)return {label:'ZAPISY ZAKOŃCZONE',cls:'closed'};if(limit&&main>=limit)return {label:'PEŁNE',cls:'full'};return {label:'ZAWODY OTWARTE',cls:'open'}}
function playerCompetitionCountStat(c){const main=Number(c.active_count||0),reserve=Number(c.reserve_count||0),limit=Number(c.limit_places||0);return main+(limit?'/'+limit:'')+(reserve?' +R'+reserve:'')}
function playerCompetitionCountHtml(c){const main=Number(c.active_count||0),reserve=Number(c.reserve_count||0),limit=Number(c.limit_places||0);return '<span class="playerCompCountBadge"><small>ZAPISANI</small><b>'+main+(limit?'/'+limit:'')+'</b></span>'+(reserve?'<span class="playerCompReserveBadge">R: '+reserve+'</span>':'')}
function playerCompetitionMineLabel(c){if(c.my_status==='RESERVE')return '✓ REZERWA';if(c.my_status==='ACTIVE')return '✓ ZAPISANY';return ''}
function playerPresenceConfirmWindow(c){
  if(String(c?.my_status||'')!=='ACTIVE')return false;
  const x=playerCompetitionDateInfo(c),days=Number(x?.days);
  return Number.isFinite(days)&&days>=0&&days<=4;
}
function renderPlayerPresenceConfirm(c){
  if(!playerPresenceConfirmWindow(c))return '';
  if(c.my_confirmed===true||String(c.my_confirmed).toLowerCase()==='true')return '<span class="playerPresenceConfirm confirmed">✓ OBECNOŚĆ POTWIERDZONA</span>';
  return '<button type="button" class="playerPresenceConfirm pending" onclick="confirmPlayerPresence('+Number(c.id)+',this,event)">POTWIERDŹ OBECNOŚĆ</button>';
}
function renderPlayerMineStack(c,mine){if(!mine)return '';const pending=playerPresenceConfirmWindow(c)&&!(c.my_confirmed===true||String(c.my_confirmed).toLowerCase()==='true');const presence=pending?'<span class="playerPresenceConfirm pending playerPresenceHint">⚠ POTWIERDŹ OBECNOŚĆ</span>':(playerPresenceConfirmWindow(c)?'<span class="playerPresenceConfirm confirmed">✓ OBECNOŚĆ POTWIERDZONA</span>':'');return '<div class="playerCompMineStack"><span class="playerCompMineBadge">'+mine+'</span>'+presence+'</div>'}
async function confirmPlayerPresence(id,el,ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  try{
    if(el){el.disabled=true;el.textContent='Potwierdzam...'}
    const out=await api('/api/competitions/'+Number(id)+'/confirm-presence',{method:'POST',body:'{}'});
    const c=(PLAYER_COMPETITIONS_CACHE||[]).find(x=>Number(x.id)===Number(id));if(c)c.my_confirmed=true;
    if(out?.attention)applyPlayerAttention(out.attention,false);else await refreshPlayerAttention(false);
    renderPlayerCompetitionList();
    loadNotifications().catch(()=>{});
    msg('Obecność potwierdzona');
  }catch(e){msg(e.message,'bad');if(el){el.disabled=false;el.textContent='POTWIERDŹ OBECNOŚĆ'}}
}
function filterPlayerCompetitions(arr,filter,applyMonth=true){
  let out=(arr||[]).filter(c=>filter==='registered'?playerCompetitionMine(c):filter==='completed'?playerCompetitionPast(c):!playerCompetitionPast(c));
  if(applyMonth&&PLAYER_COMP_MONTH!=='all')out=out.filter(c=>playerCompetitionMonthKey(c)===PLAYER_COMP_MONTH);
  out.sort((a,b)=>{const ak=playerCompetitionDateKey(a)||'9999-99-99',bk=playerCompetitionDateKey(b)||'9999-99-99';if(filter==='completed')return bk.localeCompare(ak)||Number(b.id)-Number(a.id);if(filter==='registered'){const ap=playerCompetitionPast(a),bp=playerCompetitionPast(b);if(ap!==bp)return ap?1:-1;return ap?(bk.localeCompare(ak)||Number(b.id)-Number(a.id)):(ak.localeCompare(bk)||Number(a.id)-Number(b.id))}return ak.localeCompare(bk)||Number(a.id)-Number(b.id)});
  return out;
}
function setPlayerCompetitionFilter(filter){if(!['upcoming','registered','completed'].includes(filter))return;PLAYER_COMP_FILTER=filter;PLAYER_COMP_MONTH='all';renderPlayerCompetitionList();requestAnimationFrame(()=>{const el=[...document.querySelectorAll('.playerFilteredResults')].find(x=>x.getClientRects().length);el?.scrollIntoView({behavior:'smooth',block:'start'})})}
function setPlayerCompetitionMonth(value){PLAYER_COMP_MONTH=String(value||'all');renderPlayerCompetitionList()}
function renderPlayerCompetitionFilters(arr){
  const upcoming=(arr||[]).filter(c=>!playerCompetitionPast(c)).length,registered=(arr||[]).filter(playerCompetitionMine).length,completed=(arr||[]).filter(playerCompetitionPast).length;
  const base=filterPlayerCompetitions(arr,PLAYER_COMP_FILTER,false),months=[...new Set(base.map(playerCompetitionMonthKey))];
  months.sort((a,b)=>PLAYER_COMP_FILTER==='completed'?b.localeCompare(a):a.localeCompare(b));
  if(PLAYER_COMP_MONTH!=='all'&&!months.includes(PLAYER_COMP_MONTH))PLAYER_COMP_MONTH='all';
  const f=(key,label,count)=>'<button type="button" class="playerCompFilter '+(PLAYER_COMP_FILTER===key?'active':'')+'" onclick="setPlayerCompetitionFilter(\''+key+'\')"><span>'+label+'</span><b>'+count+'</b></button>';
  const opts=['<option value="all">Wszystkie miesiące</option>'].concat(months.map(m=>'<option value="'+esc(m)+'" '+(PLAYER_COMP_MONTH===m?'selected':'')+'>'+esc(playerCompetitionMonthLabel(m))+'</option>')).join('');
  return '<div class="playerCompetitionOrganizer"><div class="playerCompFilters">'+f('upcoming','NADCHODZĄCE',upcoming)+f('registered','ZAPISANE',registered)+f('completed','HISTORIA',completed)+'</div><select class="playerCompMonthSelect" onchange="setPlayerCompetitionMonth(this.value)">'+opts+'</select></div>';
}
function renderPlayerCompetitionCompactActions(c){const mine=playerCompetitionMine(c),closed=c.status!=='OPEN'||c.signup_open===false,leavePending=String(c.my_leave_request_status||'').toUpperCase()==='PENDING';let second='';if(mine)second=leavePending?'<button type="button" class="secondary" disabled>Prośba wysłana</button>':'<button type="button" class="warn" onclick="leaveComp('+c.id+')">Zrezygnuj</button>';else second='<button type="button" '+(closed?'disabled':'')+' onclick="joinComp('+c.id+')">Zapisz</button>';return '<div class="playerCompCompactActions">'+playerPrimaryButton(c)+second+'</div>'}
function renderPlayerCompetitionMobileItem(c){
  const st=playerCompetitionStatus(c),mine=playerCompetitionMineLabel(c),x=playerCompetitionDateInfo(c),cc=playerCompetitionCountdownClass(x),isMine=playerCompetitionMine(c),closed=c.status!=='OPEN'||c.signup_open===false,leavePending=String(c.my_leave_request_status||'').toUpperCase()==='PENDING';
  const action2=isMine?(leavePending?'<button type="button" class="secondary" disabled>PROŚBA WYSŁANA</button>':'<button type="button" class="warn" onclick="leaveComp('+c.id+')">REZYGNUJ</button>'):'<button type="button" '+(closed?'disabled':'')+' onclick="joinComp('+c.id+')">ZAPISZ</button>';
  return '<article class="playerCompCompactCard playerCompCardV96 playerCompCardV97 playerCompCardV98 '+(mine?'mine':'')+'">'
    +'<div class="playerCompCardHead"><span class="playerCompNo">'+playerCompetitionNo(c)+'</span><b class="playerCompCardTitle">'+esc(c.title)+'</b>'+playerCompetitionAttentionBadge(c)+'<span class="playerCompMeeting playerCompCardMeeting">◷ '+esc(meetingTimeText(c))+'</span></div>'
    +'<div class="playerCompLocationDate"><span class="playerCompFishery">'+esc(c.fishery||'—')+'</span><strong class="playerCompDate">'+esc(x.date)+'</strong></div>'
    +'<div class="playerCompCardDate"><span class="playerCompWeekday">'+esc(x.weekday)+'</span>'+(x.countdown?'<em class="playerCompCountdown '+cc+'">'+esc(x.countdown)+'</em>':'')+'<span class="playerCompStatus '+st.cls+'">'+st.label+'</span></div>'
    +(mine?'<div class="playerCompCardFishery">'+renderPlayerMineStack(c,mine)+'</div>':'')
    +'<div class="playerCompBottomRow"><span class="playerCompBottomCount">'+playerCompetitionCountHtml(c)+'</span>'+playerPrimaryButton(c,'playerCompBottomMain')+action2+'</div>'
    +'</article>';
}
function renderPlayerCompetitionDesktopItem(c){const st=playerCompetitionStatus(c),mine=playerCompetitionMineLabel(c);return '<div class="playerCompDesktopRow '+(mine?'mine':'')+'"><span class="playerCompNo">'+playerCompetitionNo(c)+'</span><div class="playerCompDesktopTitle"><b>'+esc(c.title)+'</b>'+playerCompetitionAttentionBadge(c)+'<span>'+esc(c.fishery||'—')+'</span></div><div class="playerCompDesktopDate">'+renderPlayerCompetitionDesktopDate(c)+'</div><div class="playerCompDesktopCount">'+playerCompetitionCountHtml(c)+'</div><div class="playerCompMineCell">'+renderPlayerMineStack(c,mine)+'</div><span class="playerCompStatus '+st.cls+'">'+st.label+'</span>'+renderPlayerCompetitionCompactActions(c)+'</div>'}
function renderPlayerCompetitionGroups(arr,mode){
  if(!arr.length)return '<div class="playerCompEmpty">Brak zawodów w tej kategorii.</div>';
  const groups=[];for(const c of arr){const key=playerCompetitionMonthKey(c);let g=groups.find(x=>x.key===key);if(!g){g={key,items:[]};groups.push(g)}g.items.push(c)}
  return '<div class="playerCompGroups '+(mode==='desktop'?'desktop':'mobile')+'">'+groups.map((g,i)=>{const autoOpen=true;const items=g.items.map(c=>mode==='desktop'?renderPlayerCompetitionDesktopItem(c):renderPlayerCompetitionMobileItem(c)).join('');return '<details class="playerCompMonthGroup" '+(autoOpen?'open':'')+'><summary><span>'+esc(playerCompetitionMonthLabel(g.key))+'</span><b>'+g.items.length+'</b></summary><div class="playerCompMonthBody">'+items+'</div></details>'}).join('')+'</div>';
}
function getPlayerNearestThree(arr){
  return (arr||[]).filter(c=>!playerCompetitionPast(c)).sort((a,b)=>{const ak=playerCompetitionDateKey(a)||'9999-99-99',bk=playerCompetitionDateKey(b)||'9999-99-99';return ak.localeCompare(bk)||Number(a.id)-Number(b.id)}).slice(0,3);
}
function renderPlayerNearestThree(arr,mode){
  const nearest=getPlayerNearestThree(arr);
  if(!nearest.length)return '<div class="playerCompEmpty">Brak nadchodzących zawodów.</div>';
  const items=nearest.map(c=>mode==='desktop'?renderPlayerCompetitionDesktopItem(c):renderPlayerCompetitionMobileItem(c)).join('');
  return '<section class="playerNearestThree '+(mode==='desktop'?'desktop':'mobile')+'"><div class="playerNearestThreeHead"><b>NAJBLIŻSZE 3 ZAWODY</b><span>Według daty</span></div><div class="playerNearestThreeBody">'+items+'</div></section>';
}
function renderPlayerCompetitionList(){
  const box=q('competitionsList');if(!box)return;
  const arr=PLAYER_COMPETITIONS_CACHE||[];
  const filtersHtml=renderPlayerCompetitionFilters(arr);
  const filtered=filterPlayerCompetitions(arr,PLAYER_COMP_FILTER,true);
  const filteredView=mode=>'<section class="playerFilteredResults">'+renderPlayerCompetitionGroups(filtered,mode)+'</section>';
  const defaultNearestOnly=PLAYER_COMP_FILTER==='upcoming'&&PLAYER_COMP_MONTH==='all';
  const desktopContent=defaultNearestOnly?renderPlayerNearestThree(arr,'desktop'):filteredView('desktop');
  const mobileContent=defaultNearestOnly?renderPlayerNearestThree(arr,'mobile'):filteredView('mobile');
  box.innerHTML=filtersHtml
    +'<div class="playerCompetitionDesktopOnly">'+desktopContent+'</div>'
    +'<div class="playerCompetitionMobileOnly">'+mobileContent+'</div>';
}
async function loadCompetitions(){
  if(ME?.role==='JUDGE')return judgeLoadCompetitions();
  const d=await api('/api/competitions'); const arr=d.competitions||[]; const admin=ME&&ME.role==='ADMIN'; let html='';
  if(admin){
    if(!arr.length){q('competitionsList').innerHTML=html+'<p class="muted">Brak zawodów.</p>';return}
    let desktop='<div class="competitionDesktopList tablewrap"><table><thead><tr><th>Zawody</th><th>Data</th><th>Stan zapisów</th><th>Status</th><th>Akcja</th></tr></thead><tbody>';
    desktop+=arr.map(c=>{const mine=playerCompetitionMine(c);const closed=c.status!=='OPEN'||c.signup_open===false;const main=Number(c.active_count||0), reserve=Number(c.reserve_count||0), limit=Number(c.limit_places||0);const stat='<b>'+main+'</b>'+(limit?' / '+limit:'')+(reserve?' + rezerwa '+reserve:'');return '<tr class="'+(mine?'mine':'')+'"><td><b>'+esc(c.title)+'</b><br><span class="muted small">'+esc(c.fishery||'')+'</span></td><td class="nowrap">'+fmtDate(c.competition_date)+'<br><span class="small muted">Zbiórka '+esc(meetingTimeText(c))+'</span></td><td class="nowrap">'+stat+'</td><td><span class="pill">'+statusName(c.status)+'</span></td><td>'+competitionActionHtml(c,admin,mine,closed,false)+'</td></tr>'}).join('');
    desktop+='</tbody></table></div>';
    const mobile='<div class="competitionMobileList">'+arr.map(c=>renderCompetitionMobileCard(c,admin)).join('')+'</div>';
    q('competitionsList').innerHTML=html+desktop+mobile;return;
  }
  PLAYER_COMPETITIONS_CACHE=arr;
  await refreshPlayerAttention(false);
  renderPlayerCompetitionList();
  if(q('tab-rules')&&!q('tab-rules').classList.contains('hidden'))renderPlayerRules();
}
async function createCompetition(ev){if(CREATING_COMPETITION)return;CREATING_COMPETITION=true;const btn=ev?.target;if(btn){btn.disabled=true;btn.textContent='Tworzę...'}try{const limit=q('cLimit').value.trim();if(!limit)throw new Error('Podaj liczbę osób');await api('/api/competitions',{method:'POST',body:JSON.stringify({title:q('cTitle')?.value||'Method Feeder',fishery:q('cFishery').value,competitionDate:q('cDate').value,meetingTime:q('cMeetingTime')?.value||'06:00',limitPlaces:limit,notes:q('cNotes').value,regulations:q('cRegulations')?.value||'',status:q('cStatus')?.value||'OPEN'})});['cFishery','cDate','cLimit','cNotes','cRegulations'].forEach(id=>{const el=q(id);if(el)el.value=''});if(q('cMeetingTime'))q('cMeetingTime').value='06:00';if(q('cTitle'))q('cTitle').value='Method Feeder';await loadCompetitions();await loadNotifications();q('adminCreate').open=false;msg('Utworzono zawody')}catch(e){msg(e.message,'bad')}finally{CREATING_COMPETITION=false;if(btn){btn.disabled=false;btn.textContent='Utwórz zawody'}}}
async function deleteCompetition(id){try{if(!confirm('Usunąć te zawody?'))return;await api('/api/competitions/'+id,{method:'DELETE'});q('competitionDetail').classList.add('hidden');msg('Usunięto zawody');await loadCompetitions();await loadNotifications()}catch(e){msg(e.message,'bad')}}
async function joinComp(id){try{await api('/api/competitions/'+id+'/join',{method:'POST',body:'{}'});msg('Zapisano na zawody');await loadCompetitions();if(CURRENT_DETAIL?.competition?.id==id)await refreshCompetitionKeepScroll(id)}catch(e){msg(e.message,'bad')}}
async function leaveComp(id){try{if(!confirm('Wysłać do administratora prośbę o wypisanie z tych zawodów?'))return;await api('/api/competitions/'+id+'/leave',{method:'POST',body:'{}'});msg('Prośba o wypisanie została wysłana do administratora');await loadCompetitions();await loadNotifications();if(CURRENT_DETAIL?.competition?.id==id)await refreshCompetitionKeepScroll(id)}catch(e){msg(e.message,'bad')}}
async function openCompetition(id,preserve=false){
  if(ME?.role==='JUDGE')return judgeOpenCompetition(id);
  try{
    const d=await api('/api/competitions/'+id);
    CURRENT_DETAIL=d;
    if(!preserve&&ME?.role!=='ADMIN')PLAYER_MOBILE_PANEL=null;
    renderDetail();
    const detail=q('competitionDetail');
    detail.classList.remove('hidden');
    if(!preserve){
      if(ME?.role==='ADMIN')detail.scrollIntoView({behavior:'smooth',block:'start'});
      else focusPlayerNavOnOpen();
    }
    return true;
  }catch(e){msg(e.message,'bad');return false}
}
async function openCompetitionEdit(id){
  if(ME?.role!=='ADMIN')return openCompetition(id);
  ACTIVE_ADMIN_ZONE='draw';
  await openCompetition(id,true);
  setTimeout(()=>{const box=document.querySelector('.adminEventSettings');if(box)box.scrollIntoView({behavior:'smooth',block:'start'});const first=q('dTitle');if(first)first.focus({preventScroll:true})},80);
}
function myDraw(round){return (CURRENT_DETAIL.draws||[]).find(d=>Number(d.user_id)===Number(ME.id)&&Number(d.round)===round)}
function resMap(round){const m={};(CURRENT_DETAIL.results||[]).forEach(r=>{if(Number(r.round)===round)m[Number(r.user_id)]=r});return m}
function resultItems(round,userId,kind){return (CURRENT_DETAIL.resultItems||[]).filter(x=>Number(x.round)===Number(round)&&Number(x.user_id)===Number(userId)&&(!kind||String(x.kind)===kind))}
function drawMap(round){const m={};(CURRENT_DETAIL.draws||[]).forEach(r=>{if(Number(r.round)===round)m[Number(r.user_id)]=r});return m}
function renderDetail(){
  if(ME?.role==='JUDGE'){renderJudgeWork();return}
  const d=CURRENT_DETAIL;const c=d.competition;const admin=ME.role==='ADMIN';const confirmed=(d.activeEntries||[]).filter(e=>e.confirmed===true||String(e.confirmed).toLowerCase()==='true').length;let html='<div class="card competitionDetailHead '+(admin?'adminDetailHead':'playerDetailHead')+'"><div class="inlineBtns"><button type="button" class="secondary" onclick="q(\'competitionDetail\').classList.add(\'hidden\')">Zamknij panel zawodów</button><button type="button" onclick="openCompetition('+c.id+')">Odśwież</button></div><h2>'+esc(c.title)+'</h2><div class="competitionDetailMeta"><span>📅 '+fmtDate(c.competition_date)+'</span><span>📍 '+esc(c.fishery||'—')+'</span><span class="meetingStrong">⏰ Zbiórka '+esc(meetingTimeText(c))+'</span>'+(admin?'<span>👥 '+Number(d.rosterCounts?.active_count||0)+' + R'+Number(d.rosterCounts?.reserve_count||0)+'</span><span>✓ '+confirmed+' potwierdzonych</span>':'')+'</div></div>';if(!admin&&(String(c.notes||'').trim()||String(c.regulations||'').trim()))html+='<div class="playerEventInfo card">'+(String(c.notes||'').trim()?'<div class="playerEventNote"><b>INFORMACJE</b><span>'+esc(c.notes).replace(/\n/g,'<br>')+'</span></div>':'')+(String(c.regulations||'').trim()?'<details class="playerEventRules"><summary>PROGRAM / REGULAMIN ZAWODÓW</summary><div>'+esc(c.regulations).replace(/\n/g,'<br>')+'</div></details>':'')+'</div>';
  SECTOR_MANUAL_DRAFT=undefined;
  if(admin) html+=renderAdminDetail(d); else html+=renderPlayerDetail(d);
  q('competitionDetail').innerHTML=html;
  syncStickyNavOffset();
  setTimeout(syncFixedAdminNav,0);
  setTimeout(syncPlayerStickyBars,0);
  if(admin&&ACTIVE_ADMIN_ZONE==='draw') setTimeout(()=>setupStructureAuto(c.id),0);
  setTimeout(()=>renderPushStatus(),0);
  if(!admin)startPlayerResultPolling();
}
function rosterCounts(d){const c=d.rosterCounts||{};return {main:Number(c.active_count||0),reserve:Number(c.reserve_count||0),cancel:Number(c.cancelled_count||0),limit:Number(d.competition.limit_places||0),draw:Number((d.activeEntries||[]).length),stands:Number(d.competition.bank1_count||0)+Number(d.competition.bank2_count||0)}}
function statusLabel(s){return s==='ACTIVE'?'Lista główna':s==='RESERVE'?'Rezerwa':s==='CANCELLED'?'Wypisany':esc(s||'')}
function renderCountPanelInner(d){const x=rosterCounts(d);const over=x.limit&&x.main>x.limit;const bad=x.stands&&x.stands!==x.draw;return '<h2>Kontrola stanu zawodników</h2><div class="grid4"><div><span class="muted small">Lista główna</span><br><b style="font-size:24px">'+x.main+'</b>'+(x.limit?' / '+x.limit:'')+'</div><div><span class="muted small">Rezerwa</span><br><b style="font-size:24px">'+x.reserve+'</b></div><div><span class="muted small">Do losowania</span><br><b style="font-size:24px">'+x.draw+'</b></div><div><span class="muted small">Stanowiska w strukturze</span><br><b style="font-size:24px">'+x.stands+'</b></div></div>'+(over?'<p class="bad">Lista główna jest powyżej limitu — decyzja admina. Losowanie obejmie wszystkich z listy głównej.</p>':'')+(bad?'<p class="bad">Liczba stanowisk w strukturze nie zgadza się z liczbą zawodników do losowania. Popraw strukturę albo świadomie zostaw nadmiar/rezerwę stanowisk.</p>':'')+'<p class="small muted">Panel losowania używa dokładnie listy głównej. Rezerwa nie trafia do losowania, dopóki admin nie przeniesie zawodnika strzałką na listę główną.</p>'}
function renderCountPanel(d){const x=rosterCounts(d);const over=x.limit&&x.main>x.limit;const bad=x.stands&&x.stands!==x.draw;return '<div id="liveCountPanel" class="card '+(over||bad?'danger-line':'success-line')+'">'+renderCountPanelInner(d)+'</div>'}
function renderCompetitionSettings(d){const c=d.competition;return '<div class="card adminEventSettings"><h2>Dane zawodów</h2><div class="grid"><div><label>Nazwa</label><input id="dTitle" value="'+esc(c.title)+'"></div><div><label>Łowisko</label><input id="dFishery" value="'+esc(c.fishery||'')+'"></div><div><label>Data zawodów</label><input id="dDate" type="date" value="'+dateInputValue(c.competition_date)+'"></div><div><label>Zbiórka / godzina</label><input id="dMeetingTime" type="time" value="'+esc(meetingTimeText(c))+'"></div><div><label>Liczba osób / limit listy głównej</label><input id="dLimit" type="number" value="'+esc(c.limit_places||'')+'"></div><div><label>Status zapisów</label><select id="dStatus"><option value="OPEN" '+(c.status==='OPEN'?'selected':'')+'>Zawody otwarte — każdy może się zapisać</option><option value="CLOSED" '+(c.status==='CLOSED'?'selected':'')+'>Zapisy zakończone — widoczne, bez zapisów</option><option value="TEST" '+(c.status==='TEST'?'selected':'')+'>Testowe — tylko admin</option></select></div></div><div class="adminTextPair"><div><label>Informacje organizacyjne</label><textarea id="dNotes" placeholder="Zbiórka, parking, losowanie, dodatkowe informacje…">'+esc(c.notes||'')+'</textarea></div><div><label>Program / regulamin tych zawodów</label><textarea id="dRegulations" class="rulesEditor" placeholder="Np. 06:00 zbiórka, 06:15 losowanie, 07:00–15:00 zawody, ważne zasady tylko dla tego wydarzenia…">'+esc(c.regulations||'')+'</textarea></div></div><button type="button" onclick="saveCompetition('+c.id+')">Zapisz dane zawodów</button></div>'}
function adminZoneButton(zone,label){return '<button type="button" id="adminZoneBtn-'+zone+'" class="'+(ACTIVE_ADMIN_ZONE===zone?'active':'')+'" onclick="showAdminZone(\''+zone+'\',event)">'+label+'</button>'}
function renderAdminDetail(d){
  return '<div class="workZoneTabsSlot"><div class="workZoneTabs" role="tablist" aria-label="Strefy obsługi zawodów">'
    +adminZoneButton('roster','1. Lista zawodników')
    +adminZoneButton('draw','2. Losowanie i sektory')
    +adminZoneButton('entry','3. Wpisywanie wyników')
    +adminZoneButton('results','4. Wyniki')
    +adminZoneButton('pdf','5. Generowanie PDF')
    +'</div></div>'
    +renderCompetitionModeBar(d.competition)
    +'<section id="adminZone-roster" class="adminZone '+(ACTIVE_ADMIN_ZONE==='roster'?'':'hidden')+'">'+renderCountPanel(d)+renderRosterTools(d)+renderEntries(d)+'</section>'
    +'<section id="adminZone-draw" class="adminZone '+(ACTIVE_ADMIN_ZONE==='draw'?'':'hidden')+'">'+renderCompetitionSettings(d)+renderStructurePanel(d)+renderDrawPanel(d)+'</section>'
    +'<section id="adminZone-entry" class="adminZone '+(ACTIVE_ADMIN_ZONE==='entry'?'':'hidden')+'">'+renderResultsEntryPanel(d)+'</section>'
    +'<section id="adminZone-results" class="adminZone '+(ACTIVE_ADMIN_ZONE==='results'?'':'hidden')+'">'+renderResultsSummaryPanel(d)+'</section>'
    +'<section id="adminZone-pdf" class="adminZone '+(ACTIVE_ADMIN_ZONE==='pdf'?'':'hidden')+'">'+renderPdfPanel(d)+'</section>';
}
function showAdminZone(zone,ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  if(!['roster','draw','entry','results','pdf'].includes(zone))zone='roster';
  ACTIVE_ADMIN_ZONE=zone;
  ['roster','draw','entry','results','pdf'].forEach(name=>{q('adminZone-'+name)?.classList.toggle('hidden',name!==zone);q('adminZoneBtn-'+name)?.classList.toggle('active',name===zone)});
  if(zone==='draw'&&CURRENT_DETAIL)setTimeout(()=>setupStructureAuto(CURRENT_DETAIL.competition.id),0);
  const slot=document.querySelector('.workZoneTabsSlot');if(ev&&slot)slot.scrollIntoView({behavior:'smooth',block:'start'});setTimeout(syncFixedAdminNav,0);
}
function renderFinalClubToggle(){return '<label class="checkline finalClubToggle"><input type="checkbox" '+(SHOW_FINAL_CLUB?'checked':'')+' onchange="toggleFinalClub(this)"> Pokaż koło — tylko w klasyfikacji końcowej</label>'}
function toggleFinalClub(el){SHOW_FINAL_CLUB=!!(el&&typeof el==='object'?el.checked:el);document.querySelectorAll('.finalClub').forEach(x=>x.classList.toggle('hidden',!SHOW_FINAL_CLUB));document.querySelectorAll('.finalClubToggle input').forEach(x=>{x.checked=SHOW_FINAL_CLUB})}
function renderStructurePanel(d){const c=d.competition;const x=rosterCounts(d);const manual=Array.isArray(c.sector_layout);return '<div class="card"><h2>Struktura łowiska i sektory</h2><p class="small muted">W trybie „Dwa brzegi wzdłuż brzegów” sektory są układane osobno na każdym brzegu, a nie naprzeciwko siebie. Zakresy sektorów możesz wpisać ręcznie — mapa zmienia się od razu, a przycisk Zastosuj zapisuje układ.</p><div class="grid"><div><label>Tryb mapy</label><select id="dMapMode"><option value="TWO_OPPOSITE" '+(c.map_mode==='TWO_OPPOSITE'?'selected':'')+'>Dwa brzegi naprzeciwko</option><option value="ONE_BANK" '+(c.map_mode==='ONE_BANK'?'selected':'')+'>Jeden brzeg</option><option value="TWO_ALONG" '+(c.map_mode==='TWO_ALONG'?'selected':'')+'>Dwa brzegi — sektory wzdłuż brzegów</option></select></div><div><label>Brzeg dolny / brzeg 1</label><input id="dBank1" type="number" value="'+esc(c.bank1_count||0)+'"></div><div><label>Brzeg górny / brzeg 2</label><input id="dBank2" type="number" value="'+esc(c.bank2_count||0)+'"></div><div><label>Liczba sektorów</label><input id="dSectors" type="number" value="'+esc(c.sectors_count||1)+'" min="1" max="26"></div></div><label class="checkline"><input id="dAutoBanks" type="checkbox" '+(manual?'':'checked')+'> Automatycznie dopasuj brzegi do listy głównej / limitu. Przy nieparzystej liczbie więcej dostaje brzeg dolny.</label><div class="inlineBtns"><button type="button" class="secondary" onclick="autoFillBanksFromRoster(false,event)">Auto dopasuj teraz</button><button type="button" class="secondary" onclick="resetSectorLayout(event)">Przywróć automatyczne sektory</button><button type="button" onclick="saveCompetition('+c.id+',false,event)">Zastosuj / zapisz strukturę</button></div><div class="small muted" id="structureHint">Cel: '+x.draw+' do losowania; limit: '+x.limit+'.</div><h3>Szybki podgląd graficzny podziału na sektory</h3><div class="structurePreviewDesktop" id="structurePreview">'+renderMap(d)+'</div><div class="structurePreviewMobile" id="structurePreviewMobile">'+renderAdminMobileStructurePreview(d)+'</div><h3>Zakresy stanowisk dla sektorów</h3><div id="sectorCardsWrap">'+renderSectorCards(c)+'</div><div id="sectorEditStatus" class="small '+(manual?'ok':'muted')+'">'+(manual?'Ręczny układ jest zapisany.':'Obecnie działa podział automatyczny.')+'</div></div>'}
function renderPlayerRoundCompact(rows,round){
  rows=sortRowsBySectorPlace(rows||[]);
  if(!rows.length)return '<p class="muted">Brak wyników T'+round+'.</p>';
  return '<div class="playerNoScroll"><table class="sharpTable playerCompactRoundTable"><thead><tr><th class="pcLp">#</th><th>Zawodnik</th><th class="pcPos">Sek/Stan</th><th class="pcPlace">Msc</th><th class="pcWeight">Waga</th></tr></thead><tbody>'
    +rows.map((r,idx)=>'<tr class="'+placeRowClass(r.points)+' '+(Number(r.user_id)===Number(ME.id)?'mine':'')+'"><td class="center pcLp">'+(idx+1)+'</td><td class="pcName"><b>'+esc(r.name)+'</b></td><td class="center pcPos"><b>'+esc(r.sector||'—')+'</b>/<span>'+(r.stand||'—')+'</span></td><td class="center pcPlace"><b>'+placeText(r.points)+'</b></td><td class="right pcWeight"><b>'+fmtGram(r.weight||0)+'</b>'+(Number(r.big_fish||0)?'<span class="pcBf">BF: '+fmtGram(r.big_fish)+'</span>':'')+'</td></tr>').join('')
    +'</tbody></table></div>';
}
function renderPlayerFinalCompact(rows){
  rows=rows||[];
  if(!rows.length)return '<p class="muted">Brak klasyfikacji końcowej.</p>';
  return '<div class="playerNoScroll"><table class="sharpTable playerCompactFinalTable"><thead><tr><th class="pfRank">MSC</th><th class="pfName">Zawodnik</th><th class="pfRound">T1</th><th class="pfRound">T2</th><th class="pfPoints">Punkty</th><th class="pfWeight">Waga</th></tr></thead><tbody>'
    +rows.map(r=>'<tr class="'+placeRowClass(r.rank)+' '+(Number(r.user_id)===Number(ME.id)?'mine':'')+'"><td class="center pfRank"><b>'+r.rank+'</b></td><td class="pfName"><b>'+esc(r.name)+'</b></td><td class="center pfRound"><b>'+placeText(r.t1_points)+'</b></td><td class="center pfRound"><b>'+placeText(r.t2_points)+'</b></td><td class="center pfPoints"><b>'+placeText(r.sum_points)+'</b></td><td class="right pfWeight"><b>'+fmtGram(r.total_weight||0)+'</b>'+(Number(r.biggest_fish||0)?'<span class="pcBf">BF: '+fmtGram(r.biggest_fish)+'</span>':'')+'</td></tr>').join('')
    +'</tbody></table></div>';
}
function renderPlayerStatsCompact(d){
  const rows=stationStatisticsRows(d);
  const best=[...rows].filter(x=>x.places.length).sort((a,b)=>a.avg-b.avg||b.totalWeight-a.totalWeight||a.stand-b.stand).slice(0,5);
  const worst=[...rows].filter(x=>x.places.length).sort((a,b)=>b.avg-a.avg||a.totalWeight-b.totalWeight||a.stand-b.stand).slice(0,5);
  const table=(arr,kind='')=>{
    if(!arr.length)return '<p class="muted">Brak danych.</p>';
    const cls=kind==='best'?'stationStandBest':kind==='worst'?'stationStandWorst':'';
    return '<div class="playerNoScroll"><table class="sharpTable playerCompactStats"><thead><tr><th>Stan.</th><th>Miejsca</th><th>Śr.</th><th>Waga</th></tr></thead><tbody>'
      +arr.map(r=>'<tr><td class="center '+cls+'"><b>'+r.stand+'</b></td><td class="center">'+r.places.join('/')+'</td><td class="center"><b>'+r.avg.toFixed(2).replace('.',',')+'</b></td><td class="right"><b>'+fmtGram(r.totalWeight)+'</b></td></tr>').join('')
      +'</tbody></table></div>';
  };
  return '<div class="card playerResultCard playerStatsCompact"><h2>Statystyki stanowisk</h2><h3>5 najlepszych</h3>'+table(best,'best')+'<h3>5 najgorszych</h3>'+table(worst,'worst')+'<h3>Wszystkie stanowiska</h3>'+table(rows)+'</div>';
}
function renderPlayerResultsMobile(d){
  const active=PLAYER_RESULTS_TAB||'t1';
  return '<div class="playerResultsMobile">'
    +'<section id="playerResults-t1" class="playerResultsSection '+(active==='t1'?'':'hidden')+'"><div class="card playerDesktopPanelCard playerResultCard"><h2>Wyniki sektorowe — Tura 1</h2>'+renderSectorResultsColumn(d.classification.round1,'')+'<h2 class="playerWholeRoundTitle">Cała Tura 1</h2>'+renderPlayerRoundCompact(d.classification.round1,1)+'</div></section>'
    +'<section id="playerResults-t2" class="playerResultsSection '+(active==='t2'?'':'hidden')+'"><div class="card playerDesktopPanelCard playerResultCard"><h2>Wyniki sektorowe — Tura 2</h2>'+renderSectorResultsColumn(d.classification.round2,'')+'<h2 class="playerWholeRoundTitle">Cała Tura 2</h2>'+renderPlayerRoundCompact(d.classification.round2,2)+'</div></section>'
    +'<section id="playerResults-general" class="playerResultsSection '+(active==='general'?'':'hidden')+'"><div class="card playerDesktopPanelCard playerResultCard"><h2>Klasyfikacja końcowa</h2>'+renderPlayerFinalCompact(d.classification.general)+'</div></section>'
    +'<section id="playerResults-stats" class="playerResultsSection '+(active==='stats'?'':'hidden')+'">'+renderPlayerStatsCompact(d)+'</section>'
    +'</div>';
}
function playerNameCompact(name,cramped=false){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return '—';
  const first=parts[0]||'',last=parts[parts.length-1]||'';
  if(cramped || last.length>12)return (first?first.charAt(0)+'.':'')+last;
  return last;
}
function playerInitialSurname(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return '—';
  if(parts.length===1)return parts[0];
  const first=parts[0]||'',last=parts[parts.length-1]||'';
  return (first?first.charAt(0).toUpperCase()+'.':'')+last;
}
function playerOwnBankLabel(draw,c){
  if(!draw)return 'Brak losowania';
  const mode=String(c?.map_mode||'TWO_OPPOSITE');
  const stand=Number(draw.stand),b1=Math.max(0,Number(c?.bank1_count||0)),b2=Math.max(0,Number(c?.bank2_count||0));
  if(mode==='ONE_BANK')return 'Jeden brzeg';
  if(mode==='TWO_ALONG')return stand>b1?'Brzeg 2':'Brzeg 1';
  return stand>b1?'Brzeg górny':'Brzeg dolny';
}
function renderPlayerOwnSummary(d){
  const c=d.competition||{};
  const one=(round)=>{const x=(d.draws||[]).find(v=>Number(v.round)===Number(round)&&Number(v.user_id)===Number(ME.id));const bank=playerOwnBankLabel(x,c);const bankValue=x?bank.replace(/^Brzeg\s+/i,''):'Brak losowania';return '<div class="playerOwnSummaryCard round'+round+'"><div class="playerOwnRoundBlock"><span class="playerOwnRoundLabel">TURA</span><strong class="playerOwnRoundValue">'+round+'</strong></div><div class="playerOwnStandBlock"><span class="playerOwnFieldLabel">STANOWISKO</span><strong class="playerOwnStandValue">'+(x?esc(x.stand):'—')+'</strong></div><div class="playerOwnBankBlock"><span class="playerOwnFieldLabel">BRZEG</span><strong class="playerOwnBankValue">'+esc(bankValue)+'</strong><span class="playerOwnSectorValue">SEKTOR '+(x?esc(x.sector):'—')+'</span></div></div>'};
  return '<div class="playerOwnSummaryWrap"><div class="playerOwnSummaryHeading">MOJE STANOWISKA</div><div class="playerOwnSummaryGrid">'+one(1)+one(2)+'</div></div>';
}
function renderPlayerSectorStand(n,c,byStand,cramped){
  const sec=sectorForStandClient(n,c),x=byStand[Number(n)],mine=x&&Number(x.draw.user_id)===Number(ME.id),name=x?x.name.trim():'—';
  return '<div class="playerSectorStand '+sectorColorClass(sec,c)+(mine?' minePlayerSectorStand':'')+'"><b class="playerSectorStandNo">'+n+'</b><span class="playerSectorStandName">'+esc(playerInitialSurname(name))+'</span>'+(mine?'<small class="playerSectorMineBadge">TY</small>':'')+'</div>';
}
function renderPlayerSectorBank(label,arr,c,byStand){
  if(!arr||!arr.length)return '';
  const cramped=arr.length>=4;
  return '<div class="playerSectorBank"><div class="playerSectorBankTitle">≋ '+esc(label)+' <span>('+arr.length+' os.)</span></div><div class="playerSectorStandGrid cols'+Math.min(4,Math.max(1,arr.length))+'">'+arr.map(n=>renderPlayerSectorStand(n,c,byStand,cramped)).join('')+'</div></div>';
}
function renderPlayerSectorAccordion(d,round){
  const c=d.competition,layout=sectorLayoutClient(c),byStand=roundDrawStandMap(d,round),mine=(d.draws||[]).find(v=>Number(v.round)===Number(round)&&Number(v.user_id)===Number(ME.id)),mineSector=mine?String(mine.sector||''):'';
  if(!Object.keys(byStand).length)return '<div class="card"><p class="muted">Brak losowania T'+round+'.</p></div>';
  return '<div class="playerSectorAccordionList">'+layout.map((sec,idx)=>{const letter=String(sec.letter||''),open=(idx===0||letter===mineSector),total=(sec.top||[]).length+(sec.bottom||[]).length;let inner='';if(c.map_mode==='ONE_BANK')inner+=renderPlayerSectorBank('JEDEN BRZEG',sec.bottom,c,byStand);else if(c.map_mode==='TWO_ALONG'){if(sec.top?.length)inner+=renderPlayerSectorBank('BRZEG 2',sec.top,c,byStand);if(sec.bottom?.length)inner+=renderPlayerSectorBank('BRZEG 1',sec.bottom,c,byStand)}else{if(sec.top?.length)inner+=renderPlayerSectorBank('BRZEG GÓRNY',sec.top,c,byStand);if(sec.bottom?.length)inner+=renderPlayerSectorBank('BRZEG DOLNY',sec.bottom,c,byStand)}return '<section class="playerSectorAccordion '+sectorColorClass(letter,c)+' '+(open?'open':'collapsed')+'"><button type="button" class="playerSectorAccordionHead" onclick="togglePlayerSectorAccordion(this,event)"><span class="playerSectorCircle">'+esc(letter)+'</span><b>SEKTOR '+esc(letter)+'</b><span class="playerSectorCount">'+total+' os.</span><span class="playerSectorChevron">⌃</span></button><div class="playerSectorAccordionBody">'+inner+'</div></section>'}).join('')+'</div>';
}
function togglePlayerSectorAccordion(btn,ev){if(ev){ev.preventDefault();ev.stopPropagation()}const box=btn&&btn.closest('.playerSectorAccordion');if(!box)return;box.classList.toggle('collapsed');box.classList.toggle('open');}
function renderPlayerMobilePanelContent(d,panel){
  if(panel==='draw1'||panel==='draw2'){
    const round=panel==='draw2'?2:1;
    const mapView=PLAYER_DRAW_VIEW!=='table';
    return '<div class="playerMobileSelectedPanel playerMobileDrawSelected">'
      +renderPlayerOwnSummary(d)
      +'<div class="playerMobileSectionTitle">ROZMIESZCZENIE W SEKTORACH — TURA '+round+'</div>'
      +'<div class="playerDrawViewSwitch" role="tablist"><button type="button" class="'+(mapView?'active':'')+'" onclick="setPlayerDrawView(\'map\',event)">MAPA</button><button type="button" class="'+(!mapView?'active':'')+'" onclick="setPlayerDrawView(\'table\',event)">TABELA</button></div>'
      +(mapView?renderPlayerSectorAccordion(d,round):'<div class="playerMobileSectorTables">'+renderDrawSectorTables(d,round)+'</div>')
      +'</div>';
  }
  if(panel==='map1'||panel==='map2'){
    const round=panel==='map2'?2:1;
    if(!(d.draws||[]).some(x=>Number(x.round)===round))return '<div class="card"><p>Losowanie Tury '+round+' nie zostało jeszcze opublikowane.</p></div>';
    return '<div class="playerMobileSelectedPanel"><div class="playerMobileFullMapWrap"><div class="playerMobileFullMapTitle">MAPA ŁOWISKA — TURA '+round+'</div><div class="playerMobileFullMapViewport"><div class="playerMobileFullMapCanvas">'+renderRoundDrawMap(d,round)+'</div></div><div class="playerMobileMapHint">Pełna mapa dopasowana do szerokości ekranu.</div></div></div>';
  }
  if(panel==='t1')return '<div class="playerMobileSelectedPanel"><div class="card playerDesktopPanelCard playerResultCard"><h2>Wyniki sektorowe — Tura 1</h2>'+renderSectorResultsColumn(d.classification.round1,'')+'<h2 class="playerWholeRoundTitle">Cała Tura 1</h2>'+renderPlayerRoundCompact(d.classification.round1,1)+'</div></div>';
  if(panel==='t2')return '<div class="playerMobileSelectedPanel"><div class="card playerDesktopPanelCard playerResultCard"><h2>Wyniki sektorowe — Tura 2</h2>'+renderSectorResultsColumn(d.classification.round2,'')+'<h2 class="playerWholeRoundTitle">Cała Tura 2</h2>'+renderPlayerRoundCompact(d.classification.round2,2)+'</div></div>';
  if(panel==='general')return '<div class="playerMobileSelectedPanel"><div class="card playerDesktopPanelCard playerResultCard"><h2>Klasyfikacja końcowa</h2>'+renderPlayerFinalCompact(d.classification.general)+'</div></div>';
  if(panel==='stats')return '<div class="playerMobileSelectedPanel">'+renderPlayerStatsCompact(d)+'</div>';
  return '';
}
function renderPlayerMobileDashboard(d){
  const p=PLAYER_MOBILE_PANEL;
  const b=(panel,label,cls='')=>'<button type="button" class="'+cls+' '+(p===panel?'active':'')+'" onclick="showPlayerMobilePanel(\''+panel+'\',event)">'+label+'</button>';
  return '<div class="playerMobileDashboard">'
    +'<div class="playerDrawStickySlot"><div class="card playerDrawHeaderCard playerUnifiedNav">'
    +'<div class="playerPrimaryNav">'
      +b('draw1','Losowanie<br>Tura 1'+playerDrawStar(d,1),'drawTile')
      +b('draw2','Losowanie<br>Tura 2'+playerDrawStar(d,2),'drawTile')
      +b('t1','Wyniki<br>Tura 1'+playerResultStar(d,1),'resultTile')
      +b('t2','Wyniki<br>Tura 2'+playerResultStar(d,2),'resultTile')
      +'<div class="playerPrimaryStack">'+b('general','GENERAL','resultTile generalTile')+b('stats','STATYSTYKI','resultTile statsTile')+'</div>'
    +'</div>'
    +'<div class="playerMapNav">'+b('map1','MAPA ŁOWISKA T1','mapTile')+b('map2','MAPA ŁOWISKA T2','mapTile')+'</div>'
    +'</div></div>'
    +'<div id="playerMobilePanelContent">'+renderPlayerMobilePanelContent(d,p)+'</div>'
    +'</div>';
}
function renderPlayerDesktopPanelContent(d,panel){
  if(panel==='draw1'||panel==='draw2'){
    const round=panel==='draw2'?2:1;
    const mapView=PLAYER_DRAW_VIEW!=='table';
    return '<div class="playerDesktopSelectedPanel playerDesktopDrawSelected">'
      +renderPlayerOwnSummary(d)
      +'<div class="card playerDesktopPanelCard">'
      +'<div class="playerDesktopSectionTitle">ROZMIESZCZENIE W SEKTORACH — TURA '+round+'</div>'
      +'<div class="playerDrawViewSwitch" role="tablist"><button type="button" class="'+(mapView?'active':'')+'" onclick="setPlayerDrawView(\'map\',event)">MAPA</button><button type="button" class="'+(!mapView?'active':'')+'" onclick="setPlayerDrawView(\'table\',event)">TABELA</button></div>'
      +(mapView?renderPlayerSectorAccordion(d,round):'<div class="playerDesktopSectorTables">'+renderDrawSectorTables(d,round)+'</div>')
      +'</div></div>';
  }
  if(panel==='map1'||panel==='map2'){
    const round=panel==='map2'?2:1;
    if(!(d.draws||[]).some(x=>Number(x.round)===round))return '<div class="card"><p>Losowanie Tury '+round+' nie zostało jeszcze opublikowane.</p></div>';
    return '<div class="playerDesktopSelectedPanel"><div class="card playerDesktopPanelCard playerDesktopFullMap"><h2>MAPA ŁOWISKA — TURA '+round+'</h2>'+renderRoundDrawMap(d,round)+'</div></div>';
  }
  if(panel==='t1')return '<div class="playerDesktopSelectedPanel"><div class="card playerDesktopPanelCard playerResultCard"><h2>Wyniki sektorowe — Tura 1</h2>'+renderSectorResultsColumn(d.classification.round1,'')+'<h2 class="playerWholeRoundTitle">Cała Tura 1</h2>'+renderClassTable(d.classification.round1)+'</div></div>';
  if(panel==='t2')return '<div class="playerDesktopSelectedPanel"><div class="card playerDesktopPanelCard playerResultCard"><h2>Wyniki sektorowe — Tura 2</h2>'+renderSectorResultsColumn(d.classification.round2,'')+'<h2 class="playerWholeRoundTitle">Cała Tura 2</h2>'+renderClassTable(d.classification.round2)+'</div></div>';
  if(panel==='general')return '<div class="playerDesktopSelectedPanel"><div class="card playerDesktopPanelCard playerResultCard"><h2>Klasyfikacja końcowa</h2>'+renderFinalClubToggle()+renderGeneralTable(d.classification.general)+'</div></div>';
  if(panel==='stats')return '<div class="playerDesktopSelectedPanel"><div class="card playerDesktopPanelCard playerStatsPanelCard">'+renderStationStatistics(d)+'</div></div>';
  return '';
}
function renderPlayerDesktopDashboard(d){
  const p=PLAYER_MOBILE_PANEL;
  const b=(panel,label,cls='')=>'<button type="button" class="'+cls+' '+(p===panel?'active':'')+'" onclick="showPlayerDesktopPanel(\''+panel+'\',event)">'+label+'</button>';
  return '<div class="playerDesktopDashboardV56 playerDesktopDashboardV55">'
    +'<div class="playerDesktopStickySlot"><div class="card playerDesktopUnifiedNav">'
    +'<div class="playerDesktopPrimaryNav">'
      +b('draw1','Losowanie<br>Tura 1'+playerDrawStar(d,1),'drawTile')
      +b('draw2','Losowanie<br>Tura 2'+playerDrawStar(d,2),'drawTile')
      +b('t1','Wyniki<br>Tura 1'+playerResultStar(d,1),'resultTile')
      +b('t2','Wyniki<br>Tura 2'+playerResultStar(d,2),'resultTile')
      +'<div class="playerPrimaryStack">'+b('general','GENERAL','resultTile generalTile')+b('stats','STATYSTYKI','resultTile statsTile')+'</div>'
    +'</div>'
    +'<div class="playerDesktopSubNav playerDesktopMapsOnly">'+b('map1','MAPA ŁOWISKA T1','mapTile')+b('map2','MAPA ŁOWISKA T2','mapTile')+'</div>'
    +'</div></div>'
    +'<div id="playerDesktopPanelContent">'+renderPlayerDesktopPanelContent(d,p)+'</div>'
    +'</div>';
}
function instantPlayerScrollTo(top){
  const y=Math.max(0,Math.round(Number(top)||0));
  const root=document.documentElement,body=document.body;
  const oldRoot=root.style.scrollBehavior,oldBody=body.style.scrollBehavior;
  root.style.scrollBehavior='auto';body.style.scrollBehavior='auto';
  window.scrollTo(0,y);
  root.style.scrollBehavior=oldRoot;body.style.scrollBehavior=oldBody;
}
function restorePlayerViewport(y){
  const wanted=Math.max(0,Math.round(Number(y)||0));
  requestAnimationFrame(()=>{
    instantPlayerScrollTo(wanted);
    syncPlayerStickyBars();
    fitPlayerMobileFullMaps();
    requestAnimationFrame(()=>{instantPlayerScrollTo(wanted);syncPlayerStickyBars()});
  });
}
function focusPlayerNavOnOpen(){
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    const mobile=window.matchMedia&&window.matchMedia('(max-width:760px)').matches;
    const slot=document.querySelector(mobile?'.playerMobileDashboard .playerDrawStickySlot':'.playerDesktopDashboardV56 .playerDesktopStickySlot');
    if(!slot)return;
    /* +2 px: slot przechodzi minimalnie ponad krawędź viewportu, więc pasek od razu
       wchodzi w tryb fixed/sticky dokładnie na top:0 — bez resztek listy zawodów nad nim. */
    const docTop=Math.max(0,Math.round(window.scrollY+slot.getBoundingClientRect().top+2));
    instantPlayerScrollTo(docTop);
    requestAnimationFrame(()=>{
      syncPlayerStickyBars();
      fitPlayerMobileFullMaps();
      requestAnimationFrame(()=>{
        const bar=document.querySelector(mobile?'.playerMobileDashboard .playerUnifiedNav':'.playerDesktopDashboardV56 .playerDesktopUnifiedNav');
        if(bar){
          const delta=Math.round(bar.getBoundingClientRect().top);
          if(Math.abs(delta)>1)instantPlayerScrollTo(window.scrollY+delta+1);
        }
        syncPlayerStickyBars();
      });
    });
  }));
}
function showPlayerDesktopPanel(panel,ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  const keepY=Math.round(window.scrollY||0);
  const allowed=['draw1','draw2','map1','map2','t1','t2','general','stats'];
  if(!allowed.includes(panel))return;
  if(panel==='t1'||panel==='t2')markPlayerResultSeen(panel==='t1'?1:2);
  if(panel==='general'&&CURRENT_DETAIL?.competition?.id)markPlayerAttentionRead(CURRENT_DETAIL.competition.id,'RESULTS_GENERAL',true);
  if(panel==='draw1'||panel==='draw2')markPlayerDrawSeen(panel==='draw1'?1:2);
  PLAYER_MOBILE_PANEL=panel;
  if(panel==='draw1'||panel==='draw2'||panel==='map1'||panel==='map2')PLAYER_DRAW_ROUND=(panel==='draw2'||panel==='map2')?2:1;
  if(['t1','t2','general','stats'].includes(panel))PLAYER_RESULTS_TAB=panel;
  const desktopBox=q('playerDesktopPanelContent');
  if(desktopBox&&CURRENT_DETAIL)desktopBox.innerHTML=renderPlayerDesktopPanelContent(CURRENT_DETAIL,panel);
  const mobileBox=q('playerMobilePanelContent');
  if(mobileBox&&CURRENT_DETAIL)mobileBox.innerHTML=renderPlayerMobilePanelContent(CURRENT_DETAIL,panel);
  document.querySelectorAll('.playerDesktopUnifiedNav button,.playerUnifiedNav button').forEach(btn=>btn.classList.toggle('active',btn.getAttribute('onclick')?.includes("'"+panel+"'")));
  restorePlayerViewport(keepY);
}
function setPlayerDrawView(view,ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  PLAYER_DRAW_VIEW=view==='table'?'table':'map';
  if(!CURRENT_DETAIL)return;
  const desktop=q('playerDesktopPanelContent'),mobile=q('playerMobilePanelContent');
  if(desktop&&(PLAYER_MOBILE_PANEL==='draw1'||PLAYER_MOBILE_PANEL==='draw2'))desktop.innerHTML=renderPlayerDesktopPanelContent(CURRENT_DETAIL,PLAYER_MOBILE_PANEL);
  if(mobile&&(PLAYER_MOBILE_PANEL==='draw1'||PLAYER_MOBILE_PANEL==='draw2'))mobile.innerHTML=renderPlayerMobilePanelContent(CURRENT_DETAIL,PLAYER_MOBILE_PANEL);
}
function renderPlayerDetail(d){
  if(!PLAYER_MOBILE_PANEL)PLAYER_MOBILE_PANEL='draw1';
  let html='<div class="playerView">';
  html+=renderPlayerDesktopDashboard(d);
  html+=renderPlayerMobileDashboard(d);
  html+='</div>';
  return html;
}

function mountPlayerBottomNav(){
  q('playerGlobalBottomNav')?.remove();
  if(!ME||ME.role==='ADMIN')return;
  const icons={top:'<path d="m3 11 9-8 9 8M5 10v11h14V10M9 21v-7h6v7"/>',map1:'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2ZM9 3v16M15 5v16"/>',t1:'<path d="M7 3h10v6a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 5 4M17 5h4v3a4 4 0 0 1-5 4M12 14v6M7 21h10"/>',stats:'<path d="M4 20V10h4v10ZM10 20V4h4v16ZM16 20v-7h4v7Z"/>',notifications:'<path d="M6 8a6 6 0 0 1 12 0c0 8 3 8 3 10H3c0-2 3-2 3-10M10 21h4"/>',bottom:'<path d="M12 3v16m-7-7 7 7 7-7M4 22h16"/>'};
  const labels={top:'Góra',map1:'Mapa T1',t1:'Wyniki T1',stats:'Statystyki',notifications:'Nowości',bottom:'Dół'};
  const nav=document.createElement('nav');nav.id='playerGlobalBottomNav';nav.className='playerBottomNav';nav.setAttribute('aria-label','Szybka nawigacja');
  nav.innerHTML=Object.keys(icons).map(key=>'<button type="button" data-action="'+key+'" aria-label="'+labels[key]+'"><svg viewBox="0 0 24 24" aria-hidden="true">'+icons[key]+'</svg></button>').join('');
  nav.addEventListener('click',ev=>{const btn=ev.target.closest('button[data-action]');if(btn)playerDockAction(btn.dataset.action)});
  document.body.appendChild(nav);
}
let PLAYER_DOCK_BUSY=false;
async function playerDockAction(action){
  if(action==='top'){showTab('competitions');closePlayerCompetition();scrollAppTop();return}
  if(action==='bottom'){scrollAppBottom();return}
  if(action==='notifications'){openPlayerNotifications();return}
  if(!['map1','t1','stats'].includes(action)||PLAYER_DOCK_BUSY)return;
  PLAYER_DOCK_BUSY=true;
  try{
    const detail=q('competitionDetail');
    const inCompetition=!!CURRENT_DETAIL&&detail&&!detail.classList.contains('hidden')&&!q('tab-competitions')?.classList.contains('hidden');
    if(!inCompetition){
      await loadCompetitions();
      const nearest=getPlayerNearestThree(PLAYER_COMPETITIONS_CACHE)[0];
      if(!nearest){showTab('competitions');msg('Brak nadchodzących zawodów.');return}
      showTab('competitions');
      if(!await openCompetition(nearest.id,true))return;
      if(Number(CURRENT_DETAIL?.competition?.id)!==Number(nearest.id)||q('competitionDetail')?.classList.contains('hidden'))return;
    }
    showTab('competitions');showPlayerMobilePanel(action);
    requestAnimationFrame(()=>focusPlayerNavOnOpen());
  }catch(e){msg(e.message||'Nie udało się otworzyć zawodów.','bad')}
  finally{PLAYER_DOCK_BUSY=false}
}

function showPlayerMobilePanel(panel,ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  const keepY=Math.round(window.scrollY||0);
  const allowed=['draw1','draw2','map1','map2','t1','t2','general','stats'];
  if(!allowed.includes(panel))return;
  if(panel==='t1'||panel==='t2')markPlayerResultSeen(panel==='t1'?1:2);
  if(panel==='general'&&CURRENT_DETAIL?.competition?.id)markPlayerAttentionRead(CURRENT_DETAIL.competition.id,'RESULTS_GENERAL',true);
  if(panel==='draw1'||panel==='draw2')markPlayerDrawSeen(panel==='draw1'?1:2);
  PLAYER_MOBILE_PANEL=panel;
  if(panel==='draw1'||panel==='draw2'||panel==='map1'||panel==='map2')PLAYER_DRAW_ROUND=(panel==='draw2'||panel==='map2')?2:1;
  if(['t1','t2','general','stats'].includes(panel))PLAYER_RESULTS_TAB=panel;
  const box=q('playerMobilePanelContent');
  if(box&&CURRENT_DETAIL)box.innerHTML=renderPlayerMobilePanelContent(CURRENT_DETAIL,panel);
  const desktopBox=q('playerDesktopPanelContent');
  if(desktopBox&&CURRENT_DETAIL)desktopBox.innerHTML=renderPlayerDesktopPanelContent(CURRENT_DETAIL,panel);
  document.querySelectorAll('.playerUnifiedNav button,.playerDesktopUnifiedNav button').forEach(btn=>btn.classList.toggle('active',btn.getAttribute('onclick')?.includes("'"+panel+"'")));
  restorePlayerViewport(keepY);
}
function fitPlayerMobileFullMaps(){
  document.querySelectorAll('.playerMobileFullMapViewport').forEach(viewport=>{
    const canvas=viewport.querySelector('.playerMobileFullMapCanvas');
    const map=canvas?.querySelector('.sectorMap');
    if(!canvas||!map)return;
    canvas.style.transform='none';canvas.style.width='auto';canvas.style.height='auto';
    map.style.transform='none';
    const available=Math.max(1,viewport.clientWidth-8);
    const naturalW=Math.max(map.scrollWidth,map.offsetWidth,640);
    const naturalH=Math.max(map.scrollHeight,map.offsetHeight,1);
    const scale=Math.min(1,available/naturalW);
    canvas.style.position='absolute';
    canvas.style.left='4px';
    canvas.style.top='4px';
    canvas.style.width=naturalW+'px';
    canvas.style.height=naturalH+'px';
    canvas.style.transformOrigin='top left';
    canvas.style.transform='scale('+scale+')';
    viewport.style.height=Math.ceil(naturalH*scale+8)+'px';
  });
}
function openPlayerNotifications(ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  showTab('notifications');
  requestAnimationFrame(()=>{const el=q('tab-notifications');if(el)el.scrollIntoView({behavior:'smooth',block:'start'})});
}
function showPlayerResults(tab,ev){
  if(ev){ev.preventDefault();ev.stopPropagation()}
  if(!['t1','t2','general','stats'].includes(tab))tab='t1';
  if(tab==='t1'||tab==='t2')markPlayerResultSeen(tab==='t1'?1:2);
  PLAYER_RESULTS_TAB=tab;
  document.querySelectorAll('.playerResultsSection').forEach(s=>s.classList.add('hidden'));
  q('playerResults-'+tab)?.classList.remove('hidden');
  document.querySelectorAll('.playerResultsNav button').forEach(b=>b.classList.toggle('active',b.getAttribute('onclick')?.includes("'"+tab+"'")));
  setTimeout(syncPlayerStickyBars,0);
}

function showPlayerDraw(round,ev){if(ev){ev.preventDefault();ev.stopPropagation()}PLAYER_DRAW_ROUND=Number(round)===2?2:1;const box=q('playerDrawView');if(box&&CURRENT_DETAIL)box.innerHTML=renderRoundDrawView(CURRENT_DETAIL,PLAYER_DRAW_ROUND,true);document.querySelectorAll('.playerDrawTabs button').forEach((b,i)=>b.classList.toggle('active',i===PLAYER_DRAW_ROUND-1));setTimeout(syncPlayerStickyBars,0)}
async function saveCompetition(id,quiet=false,ev){const btn=ev?.target;try{if(btn){btn.disabled=true}const sectorLayout=sectorLayoutPayloadForSave();await api('/api/competitions/'+id,{method:'PATCH',body:JSON.stringify({title:q('dTitle')?.value||'',fishery:q('dFishery')?.value||'',competitionDate:q('dDate')?.value||'',meetingTime:q('dMeetingTime')?.value||'',limitPlaces:q('dLimit')?.value||'',status:q('dStatus')?.value||'OPEN',mapMode:q('dMapMode')?.value||'TWO_OPPOSITE',bank1Count:q('dBank1')?.value||0,bank2Count:q('dBank2')?.value||0,sectorsCount:q('dSectors')?.value||1,sectorLayout,autoBanks:Boolean(q('dAutoBanks')?.checked),notes:q('dNotes')?.value||'',regulations:q('dRegulations')?.value||''})});if(!quiet)msg('Zapisano strukturę, sektory i zakresy stanowisk');await loadCompetitions();if(!quiet)await refreshCompetitionKeepScroll(id)}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false}}}
function renderRosterTools(d){const c=d.competition;return '<div class="card"><h2>Wgranie listy zawodników</h2><p class="small muted">Import i ręczne dopisanie uzupełniają najpierw listę główną do limitu, a nadmiar idzie na rezerwę. Admin może później przenieść rezerwowego na listę główną nawet powyżej limitu.</p><label>Link zawody.pro</label><input id="zproUrl" placeholder="https://www.zawody.pro/competitions/79/details"><button type="button" class="blue" onclick="importZawodyPro('+c.id+',event)">Importuj listę z zawody.pro</button><hr style="border:0;border-top:1px solid var(--line);margin:14px 0"><h3>Ręcznie dopisz zawodnika</h3><div class="grid"><div><label>Imię i nazwisko</label><input id="manualFullName" placeholder="Jan Kowalski"></div><div><label>Telefon — opcjonalnie</label><input id="manualPhone" placeholder="np. 501222333"></div><div><label>Nr Koła PZW — opcjonalnie</label><input id="manualClub"></div><div><label>Hasło — opcjonalnie, jeśli ma się logować</label><input id="manualPassword" type="password"></div><div><label>Gdzie dopisać</label><select id="manualStatus"><option value="AUTO">Auto: główna do limitu, potem rezerwa</option><option value="ACTIVE">Od razu lista główna</option><option value="RESERVE">Od razu rezerwa</option></select></div></div><button type="button" onclick="addManualPlayer('+c.id+',event)">Dopisz zawodnika</button></div>'}
function importZawodyPro(id,ev){const btn=ev?.target;if(btn){btn.disabled=true;btn.textContent='Importuję...'}try{const url=q('zproUrl').value.trim();api('/api/admin/competitions/'+id+'/import-zawody-pro',{method:'POST',body:JSON.stringify({url})}).then(async d=>{const r=d.result||{};msg('Import: główna '+(r.main||0)+', rezerwa '+(r.reserve||0)+', razem '+(r.imported||0));await refreshCompetitionKeepScroll(id);await loadCompetitions();await loadPlayers();await loadNotifications()}).catch(e=>msg(e.message,'bad')).finally(()=>{if(btn){btn.disabled=false;btn.textContent='Importuj listę z zawody.pro'}})}catch(e){msg(e.message,'bad');if(btn){btn.disabled=false;btn.textContent='Importuj listę z zawody.pro'}}}
async function addManualPlayer(id,ev){const btn=ev?.target;if(btn){btn.disabled=true;btn.textContent='Dopisuję...'}try{const fullName=q('manualFullName').value.trim();if(!fullName)throw new Error('Podaj imię i nazwisko');await api('/api/admin/competitions/'+id+'/players/manual',{method:'POST',body:JSON.stringify({fullName,phone:q('manualPhone').value,pzwClub:q('manualClub').value,password:q('manualPassword').value,entryStatus:q('manualStatus').value})});['manualFullName','manualPhone','manualClub','manualPassword'].forEach(x=>{const el=q(x);if(el)el.value='' });msg('Dopisano zawodnika');await refreshCompetitionKeepScroll(id);await loadCompetitions();await loadPlayers();await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Dopisz zawodnika'}}}
async function setEntryStatus(compId,entryId,action){try{const txt=action==='promote'?'Przenieść na listę główną?':action==='reserve'?'Przenieść na rezerwę?':'Wypisać zawodnika z zawodów?';if(!confirm(txt))return;await api('/api/admin/competitions/'+compId+'/entries/'+entryId+'/'+action,{method:'POST',body:'{}'});msg('Zmieniono status zawodnika');await refreshCompetitionKeepScroll(compId);await loadCompetitions();await loadPlayers();await loadNotifications()}catch(e){msg(e.message,'bad')}}
async function toggleEntryConfirm(compId,entryId,el){try{if(el)el.disabled=true;const d=await api('/api/admin/competitions/'+compId+'/entries/'+entryId+'/confirm',{method:'POST',body:'{}'});msg(d.confirmed?'Potwierdzono zawodnika':'Cofnięto potwierdzenie');await refreshCompetitionKeepScroll(compId)}catch(e){msg(e.message,'bad');if(el)el.disabled=false}}
async function approveRosterLeaveRequest(requestId,button){
  if(button?.disabled)return;
  if(button)button.disabled=true;
  try{
    const out=await api('/api/admin/leave-requests/'+Number(requestId)+'/approve',{method:'POST',body:'{}'});
    if(CURRENT_DETAIL?.competition?.id==out.competitionId)await refreshCompetitionKeepScroll(out.competitionId);
    await loadNotifications();
    await loadCompetitions();
    msg(out.status==='APPROVED'?'Zawodnik został wypisany':'Prośba została już rozpatrzona');
  }catch(e){msg(e.message,'bad')}
  finally{if(button)button.disabled=false}
}
async function deleteCancelledEntry(compId,entryId,button){
  if(button?.disabled)return;
  if(!confirm('Usunąć wypisanego zawodnika z listy tych zawodów? Konto zawodnika pozostanie.'))return;
  if(button)button.disabled=true;
  try{
    await api('/api/admin/competitions/'+compId+'/entries/'+entryId,{method:'DELETE'});
    await refreshCompetitionKeepScroll(compId);
    await loadCompetitions();
    msg('Usunięto z listy wypisanych');
  }catch(e){msg(e.message,'bad')}
  finally{if(button)button.disabled=false}
}
function rosterTable(title,rows,compId,kind){
  rows=rows||[];
  let html='<h3 class="rosterSectionTitle">'+title+' <span class="pill">'+rows.length+'</span></h3>';
  if(!rows.length)return html+'<p class="muted small">Brak.</p>';
  const baseButtons=e=>{
    if(kind==='ACTIVE')return '<div class="inlineBtns"><button type="button" class="secondary" onclick="setEntryStatus('+compId+','+e.id+',\'reserve\')">↓ Rezerwa</button><button type="button" class="warn" onclick="setEntryStatus('+compId+','+e.id+',\'cancel\')">Zrezygnuj</button></div>';
    if(kind==='RESERVE')return '<div class="inlineBtns"><button type="button" onclick="setEntryStatus('+compId+','+e.id+',\'promote\')">↑ Główna</button><button type="button" class="warn" onclick="setEntryStatus('+compId+','+e.id+',\'cancel\')">Zrezygnuj</button></div>';
    return '<div class="inlineBtns"><button type="button" class="secondary" onclick="setEntryStatus('+compId+','+e.id+',\'promote\')">Przywróć</button><button type="button" class="warn" onclick="deleteCancelledEntry('+compId+','+e.id+',this)">Usuń</button></div>';
  };
  const makeButtons=e=>{
    const requestId=Number(e.pending_leave_request_id);
    const tile=ME?.role==='ADMIN'&&kind!=='CANCELLED'&&requestId>0
      ?'<button type="button" class="rosterLeaveRequest" onclick="approveRosterLeaveRequest('+requestId+',this)">Prośba o wypisanie<small>Kliknij, aby wypisać</small></button>':'';
    return '<div class="rosterLeaveActions">'+baseButtons(e)+tile+'</div>';
  };
  const confirmBtn=e=>kind==='ACTIVE'
    ?'<button type="button" class="confirmEntryBtn '+(e.confirmed?'confirmed':'')+'" onclick="toggleEntryConfirm('+compId+','+e.id+',this)">'+(e.confirmed?'✓':'Potwierdź')+'</button>'
    :'';
  const editBtn=e=>{const nm=String((e.first_name||'')+' '+(e.last_name||'')).trim(),safe=encodeURIComponent(nm);return '<button type="button" class="secondary rosterEditNameBtn" onclick="editPlayerName('+Number(e.user_id)+',decodeURIComponent(\''+safe+'\'))">Edytuj</button>'};
  const callEnabled=kind==='ACTIVE'||kind==='RESERVE';
  const desktop='<div class="tablewrap adminDesktopOnly"><table><thead><tr><th style="width:46px">Lp.</th><th>Zawodnik</th><th>Telefon</th><th>Koło</th><th>Status</th><th>Potw.</th><th>Akcja</th></tr></thead><tbody>'
    +rows.map((e,idx)=>'<tr><td class="center"><b>'+(idx+1)+'</b></td><td><div class="rosterNameEdit"><b>'+esc(e.first_name+' '+e.last_name)+'</b>'+editBtn(e)+'</div></td><td class="nowrap">'+(callEnabled?renderPhoneCall(e.phone):esc(e.phone||'—'))+'</td><td>'+esc(e.pzw_club||'')+'</td><td>'+statusLabel(e.status)+'</td><td class="center">'+(confirmBtn(e)||'—')+'</td><td>'+makeButtons(e)+'</td></tr>').join('')
    +'</tbody></table></div>';
  const mobile='<div class="adminMobileOnly mobileRosterCompact">'
    +rows.map((e,idx)=>{const club=e.pzw_club?('K'+esc(e.pzw_club)):'';return '<div class="mobileRosterCompactRow">'
        +'<div class="mobileRosterCompactHead"><span class="mobileRosterCompactLp">'+(idx+1)+'</span><b>'+esc(e.first_name+' '+e.last_name)+'</b>'+editBtn(e)+'<span class="mobileRosterCompactStatus">'+statusLabel(e.status)+'</span></div>'
        +'<div class="mobileRosterCompactMeta"><span>'+(callEnabled?renderPhoneCall(e.phone,'mobilePhoneCallBtn'):esc(e.phone||'—'))+'</span>'+(club?'<span>'+club+'</span>':'')+'</div>'
        +'<div class="mobileRosterCompactActions">'+(confirmBtn(e)||'')+makeButtons(e)+'</div>'
        +'</div>';}).join('')
    +'</div>';
  return html+desktop+mobile;
}
function renderEntries(d){const c=d.competition;return '<div class="card"><h2>Panel zapisów — lista główna i rezerwa</h2>'+rosterTable('Lista główna — bierze udział w losowaniu',d.activeEntries||[],c.id,'ACTIVE')+rosterTable('Lista rezerwowa',d.reserveEntries||[],c.id,'RESERVE')+rosterTable('Wypisani',d.cancelledEntries||[],c.id,'CANCELLED')+'</div>'}
function renderDrawPanel(d){const c=d.competition;const x=rosterCounts(d);const hasDraw=(d.draws||[]).length>0;const hasResults=((d.results||[]).length>0)||((d.resultItems||[]).length>0)||((d.classification?.round1||[]).length>0)||((d.classification?.round2||[]).length>0);return '<div class="card"><h2>Losowanie stanowisk</h2><div class="card '+(x.stands===x.draw?'success-line':'danger-line')+'"><b>Do losowania: '+x.draw+' zawodników z listy głównej.</b><br><span class="small muted">Stanowiska w strukturze: '+x.stands+'. Rezerwa nie jest losowana.</span></div><div class="grid3"><button type="button" onclick="drawRound('+c.id+',1,event)">Losuj T1</button><button type="button" class="blue" onclick="drawRound('+c.id+',2,event)">Losuj T2</button><button type="button" class="secondary" onclick="publishDraw('+c.id+',event)">Publikuj losowanie</button></div><div class="adminDeleteDrawTile"><button type="button" class="warn adminDeleteDrawBtn" '+((hasDraw||hasResults)?'':'disabled')+' onclick="resetDraw('+c.id+',event)">USUŃ CAŁE LOSOWANIE + WYNIKI</button><div class="small"><b>Uwaga:</b> usuwa jednocześnie losowanie T1/T2 oraz wszystkie wpisane wyniki T1/T2 i klasyfikację. Zostawia listę zawodników, sektory i ustawienia zawodów.</div></div>'+renderRoundDrawView(d,1,false)+renderRoundDrawView(d,2,false)+'<h3>Tabela zbiorcza losowania</h3>'+renderDrawTable(d,true)+'</div>'}
async function drawRound(id,round,ev){const btn=ev?.target;try{if(!confirm('Wykonać losowanie T'+round+' dla aktualnej listy głównej? Poprzednie T'+round+' zostanie zastąpione. Powiadomienia pójdą dopiero po kliknięciu Publikuj losowanie.'))return;if(btn){btn.disabled=true;btn.textContent='Losuję...'}await api('/api/admin/competitions/'+id+'/draw/'+round,{method:'POST',body:'{}'});msg('Wylosowano T'+round+' — bez publikacji');await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Losuj T'+round}}}
async function publishDraw(id,ev){const btn=ev?.target;try{if(!confirm('Opublikować losowanie i wysłać powiadomienia zawodnikom?'))return;if(btn){btn.disabled=true;btn.textContent='Publikuję...'}const d=await api('/api/admin/competitions/'+id+'/draw/publish',{method:'POST',body:'{}'});msg('Opublikowano losowanie. Powiadomiono: '+d.notified);await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Publikuj losowanie'}}}
async function resetDraw(id,ev){const btn=ev?.target;try{if(!confirm('USUNĄĆ CAŁE LOSOWANIE I WYNIKI?\n\nZostaną usunięte:\n• losowanie T1 i T2,\n• wszystkie wpisy wag i BF,\n• wyniki T1 i T2,\n• klasyfikacja końcowa.\n\nLista zawodników, sektory i ustawienia zawodów zostaną zachowane.'))return;if(btn){btn.disabled=true;btn.textContent='Usuwam losowanie i wyniki...'}const d=await api('/api/admin/competitions/'+id+'/draw',{method:'DELETE',body:JSON.stringify({confirm:'RESET_LOSOWANIA'})});msg('Usunięto całe losowanie i wyniki — losowania: '+d.deletedDraws+', wpisy wag: '+d.deletedItems+', wyniki: '+d.deletedResults);await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='USUŃ CAŁE LOSOWANIE + WYNIKI'}}}
function renderDrawTable(d,admin){const entries=(d.activeEntries||[]);const dm1=drawMap(1),dm2=drawMap(2);if(!entries.length)return '<p class="muted">Brak aktywnych zawodników.</p>';const desktop='<div class="tablewrap adminDesktopOnly"><table><thead><tr><th style="width:46px">Lp.</th><th>Zawodnik</th><th>T1 stan.</th><th>T1 sektor</th><th>T2 stan.</th><th>T2 sektor</th></tr></thead><tbody>'+entries.map((e,idx)=>{const a=dm1[Number(e.user_id)],b=dm2[Number(e.user_id)];const mine=Number(e.user_id)===Number(ME.id);return '<tr class="'+(mine?'mine':'')+'"><td class="center"><b>'+(idx+1)+'</b></td><td><b>'+esc(e.first_name+' '+e.last_name)+'</b></td><td class="nowrap">'+(a?esc(a.stand):'—')+'</td><td>'+(a?esc(a.sector):'—')+'</td><td class="nowrap">'+(b?esc(b.stand):'—')+'</td><td>'+(b?esc(b.sector):'—')+'</td></tr>'}).join('')+'</tbody></table></div>';const mobile='<div class="adminMobileOnly mobileDrawSummary">'+entries.map((e,idx)=>{const a=dm1[Number(e.user_id)],b=dm2[Number(e.user_id)];return '<article class="mobileAdminCard"><div class="mobileAdminCardHead"><span class="mobileLp">'+(idx+1)+'</span><b>'+esc(e.first_name+' '+e.last_name)+'</b></div><div class="mobileDrawPair"><div><small>T1</small><b>'+(a?esc(a.stand):'—')+'</b><span>Sektor '+(a?esc(a.sector):'—')+'</span></div><div><small>T2</small><b>'+(b?esc(b.stand):'—')+'</b><span>Sektor '+(b?esc(b.sector):'—')+'</span></div></div></article>'}).join('')+'</div>';return desktop+mobile}
function sectorSizesClient(total,n,mode){total=Math.max(1,Number(total||1));n=Math.max(1,Math.min(26,Number(n||1),total));const base=Math.floor(total/n),rem=total%n;return Array.from({length:n},(_,i)=>base+(i>=n-rem?1:0))}
function autoBankSplitClient(total,mode){total=Math.max(1,Number(total||1));if(mode==='ONE_BANK')return [total,0];return [Math.ceil(total/2),Math.floor(total/2)]}
function rosterTargetForStructure(){const active=Number(CURRENT_DETAIL?.rosterCounts?.active_count||CURRENT_DETAIL?.activeEntries?.length||0),limit=Number(q('dLimit')?.value||CURRENT_DETAIL?.competition?.limit_places||0);return Math.max(1,active||limit||1)}
function autoBankSplitClient(total,mode){total=Math.max(1,Number(total||1));if(mode==='ONE_BANK')return [total,0];return [Math.ceil(total/2),Math.floor(total/2)]}
function draftCompetition(){const c=Object.assign({},CURRENT_DETAIL.competition);c.map_mode=q('dMapMode')?.value||c.map_mode;c.bank1_count=Number(q('dBank1')?.value||0);c.bank2_count=Number(q('dBank2')?.value||0);c.sectors_count=Number(q('dSectors')?.value||1);c.limit_places=Number(q('dLimit')?.value||c.limit_places||0);if(SECTOR_MANUAL_DRAFT!==undefined)c.sector_layout=SECTOR_MANUAL_DRAFT;return c}
function liveCountUpdate(){const el=q('liveCountPanel');if(!el||!CURRENT_DETAIL)return;const d={competition:draftCompetition(),rosterCounts:CURRENT_DETAIL.rosterCounts,activeEntries:CURRENT_DETAIL.activeEntries};el.innerHTML=renderCountPanelInner(d)}
function scheduleStructureSave(){/* auto-zapis struktury wyłączony: zapis tylko przyciskiem, bez pętli przewijania */}
function autoFillBanksFromRoster(saveNow=false,ev){if(ev){ev.preventDefault&&ev.preventDefault();ev.stopPropagation&&ev.stopPropagation()}SECTOR_MANUAL_DRAFT=null;const c=draftCompetition();const target=rosterTargetForStructure();const sp=autoBankSplitClient(target,c.map_mode);if(q('dBank1'))q('dBank1').value=sp[0];if(q('dBank2'))q('dBank2').value=sp[1];updateStructurePreview(true);if(saveNow===true)scheduleStructureSave();}
function setupStructureAuto(compId){STRUCTURE_READY=false;['dMapMode','dBank1','dBank2','dSectors','dLimit'].forEach(id=>{const el=q(id);if(!el||el.dataset.autoReady)return;el.dataset.autoReady='1';const changed=()=>{SECTOR_MANUAL_DRAFT=null;if((id==='dBank1'||id==='dBank2')&&q('dAutoBanks'))q('dAutoBanks').checked=false;if(q('dAutoBanks')?.checked&&(id==='dMapMode'||id==='dLimit'))autoFillBanksFromRoster(false);else updateStructurePreview(true)};el.addEventListener('input',changed);el.addEventListener('change',changed);});const auto=q('dAutoBanks');if(auto&&!auto.dataset.autoReady){auto.dataset.autoReady='1';auto.addEventListener('change',()=>{if(auto.checked)autoFillBanksFromRoster(false);else updateStructurePreview(false);});}if(q('dAutoBanks')?.checked)autoFillBanksFromRoster(false);else updateStructurePreview(false);setTimeout(()=>{STRUCTURE_READY=true},120);}
function updateStructurePreview(resetCards=false){if(!CURRENT_DETAIL||!q('structurePreview'))return;const d=JSON.parse(JSON.stringify(CURRENT_DETAIL));d.competition=draftCompetition();if(resetCards)d.competition.sector_layout=null;q('structurePreview').innerHTML=renderMap(d);const mobile=q('structurePreviewMobile');if(mobile)mobile.innerHTML=renderAdminMobileStructurePreview(d);const cards=q('sectorCardsWrap');if(cards&&resetCards)cards.innerHTML=renderSectorCards(d.competition);liveCountUpdate();const x=rosterCounts({competition:d.competition,rosterCounts:CURRENT_DETAIL.rosterCounts,activeEntries:CURRENT_DETAIL.activeEntries});const hint=q('structureHint');if(hint)hint.innerHTML='Cel: <b>'+x.draw+'</b> do losowania, limit: <b>'+x.limit+'</b>, struktura: <b>'+x.stands+'</b> stanowisk. '+(x.stands===x.draw?'Zgodne.':'Różnica — kliknij Auto dopasuj albo popraw liczbę stanowisk.');const status=q('sectorEditStatus');if(status&&resetCards){status.className='small muted';status.textContent='Podział automatyczny — możesz teraz wpisać własne zakresy.'}}
function visualColumnCountClient(c){const b1=Math.max(0,Number(c.bank1_count||0)),b2=Math.max(0,Number(c.bank2_count||0));return Math.max(1,b1+b2)}
function allocateBottomCountsClient(sizes,b1,b2,mode){b1=Math.max(0,Number(b1||0));b2=Math.max(0,Number(b2||0));const total=Math.max(1,b1+b2);if((mode||'TWO_OPPOSITE')==='ONE_BANK')return sizes.slice();const raw=sizes.map((s,i)=>({i,size:s,val:s*b1/total}));const bottom=raw.map(x=>Math.max(0,Math.min(x.size,Math.floor(x.val))));let diff=b1-bottom.reduce((a,b)=>a+b,0);if(diff>0){const altRank=i=>(i%2===0?Math.floor(i/2):Math.ceil(raw.length/2)+Math.floor(i/2));const order=raw.slice().sort((a,b)=>((b.val-Math.floor(b.val))-(a.val-Math.floor(a.val)))||(((mode||'TWO_OPPOSITE')==='TWO_OPPOSITE')?(altRank(a.i)-altRank(b.i)):(a.i-b.i)));let guard=0;while(diff>0&&guard++<1000){let changed=false;for(const x of order){if(diff<=0)break;if(bottom[x.i]<x.size){bottom[x.i]++;diff--;changed=true}}if(!changed)break}}else if(diff<0){const order=raw.slice().sort((a,b)=>((a.val-Math.floor(a.val))-(b.val-Math.floor(b.val)))||b.i-a.i);let guard=0;while(diff<0&&guard++<1000){let changed=false;for(const x of order){if(diff>=0)break;if(bottom[x.i]>0){bottom[x.i]--;diff++;changed=true}}if(!changed)break}}return bottom}
function parseStandSpecClient(value){const out=[];for(const token of String(value||'').split(/[;,]+/).map(x=>x.trim()).filter(Boolean)){const m=token.match(/^(\d+)\s*[-–—]\s*(\d+)$/);if(m){const a=Number(m[1]),b=Number(m[2]),step=a<=b?1:-1;for(let n=a;;n+=step){out.push(n);if(n===b)break}}else if(/^\d+$/.test(token))out.push(Number(token));else throw new Error('Nieprawidłowy zapis: „'+token+'”')}return out}
function normalizeSectorLayoutClient(raw,c){if(raw===null||raw===undefined||raw==='')return null;if(typeof raw==='string'){try{raw=JSON.parse(raw)}catch(_){throw new Error('Nieprawidłowe dane sektorów')}}const total=Math.max(1,Number(c.bank1_count||0)+Number(c.bank2_count||0)),count=Math.max(1,Number(c.sectors_count||1));if(!Array.isArray(raw)||raw.length!==count)throw new Error('Liczba paneli musi być taka sama jak liczba sektorów');const used=new Map(),names=new Set(),out=[];raw.forEach((item,idx)=>{const name=String(item?.name??item?.letter??'').trim()||String.fromCharCode(65+idx),key=name.toLocaleUpperCase('pl');if(names.has(key))throw new Error('Powtórzona nazwa sektora: '+name);names.add(key);const stands=Array.isArray(item?.stands)?item.stands.map(Number):parseStandSpecClient(item?.range??item?.stands);if(!stands.length)throw new Error('Sektor '+name+' nie ma stanowisk');const own=new Set();for(const stand of stands){if(!Number.isInteger(stand)||stand<1||stand>total)throw new Error('Stanowisko '+stand+' jest poza zakresem 1–'+total);if(own.has(stand))throw new Error('Stanowisko '+stand+' powtarza się w sektorze '+name);if(used.has(stand))throw new Error('Stanowisko '+stand+' jest już w sektorze '+used.get(stand));own.add(stand);used.set(stand,name)}out.push({name,stands:Array.from(own).sort((a,b)=>a-b)})});const missing=[];for(let n=1;n<=total;n++)if(!used.has(n))missing.push(n);if(missing.length)throw new Error('Brakuje stanowisk: '+missing.join(', '));return out}
function customSectorLayoutClient(c){let raw=c.sector_layout;if(SECTOR_MANUAL_DRAFT!==undefined)raw=SECTOR_MANUAL_DRAFT;let normalized;try{normalized=normalizeSectorLayoutClient(raw,c)}catch(_){return null}if(!normalized)return null;const b1=Math.max(0,Number(c.bank1_count||0)),opposite=(c.map_mode||'TWO_OPPOSITE')==='TWO_OPPOSITE';return normalized.map(item=>{const bottom=item.stands.filter(n=>n<=b1).sort((a,b)=>a-b),top=item.stands.filter(n=>n>b1).sort((a,b)=>opposite?b-a:a-b);return {letter:item.name,size:item.stands.length,bottomCount:bottom.length,topCount:top.length,bottom,top}})}
function alongSectorCountsClient(sectors,b1,b2){sectors=Math.max(1,Number(sectors||1));b1=Math.max(0,Number(b1||0));b2=Math.max(0,Number(b2||0));if(!b2)return[sectors,0];if(!b1)return[0,sectors];if(sectors===1)return[1,0];let best=null;for(let first=1;first<sectors;first++){const second=sectors-first;if(first>b1||second>b2)continue;const sizes=sectorSizesClient(b1,first,'ONE_BANK').concat(sectorSizesClient(b2,second,'ONE_BANK')),spread=Math.max(...sizes)-Math.min(...sizes),score=spread*100+Math.abs(first/sectors-b1/(b1+b2));if(!best||score<best.score)best={first,second,score}}if(best)return[best.first,best.second];const first=Math.max(1,Math.min(sectors-1,Math.round(sectors*b1/(b1+b2))));return[first,sectors-first]}
function sectorLayoutClient(c){const custom=customSectorLayoutClient(c);if(custom)return custom;const b1=Math.max(0,Number(c.bank1_count||0)),b2=Math.max(0,Number(c.bank2_count||0)),total=Math.max(1,b1+b2),mode=c.map_mode||'TWO_OPPOSITE',sectorCount=Math.min(Math.max(1,Number(c.sectors_count||1)),total);if(mode==='TWO_ALONG'&&sectorCount>1&&b1>0&&b2>0){const counts=alongSectorCountsClient(sectorCount,b1,b2),bottomSizes=sectorSizesClient(b1,counts[0],'ONE_BANK'),topSizes=sectorSizesClient(b2,counts[1],'ONE_BANK');let bottomCursor=1,topCursor=b1+1,idx=0;const out=[];for(const size of bottomSizes){const bottom=[];for(let i=0;i<size;i++)bottom.push(bottomCursor++);out.push({letter:String.fromCharCode(65+idx++),size,bottomCount:size,topCount:0,bottom,top:[]})}for(const size of topSizes){const top=[];for(let i=0;i<size;i++)top.push(topCursor++);out.push({letter:String.fromCharCode(65+idx++),size,bottomCount:0,topCount:size,bottom:[],top})}return out}const sizes=sectorSizesClient(total,sectorCount,mode),bottomCounts=allocateBottomCountsClient(sizes,b1,b2,mode);let bottomCursor=1,topCursorDesc=b1+b2;return sizes.map((size,idx)=>{const letter=String.fromCharCode(65+idx),bottomCount=mode==='ONE_BANK'?size:Math.max(0,Math.min(size,bottomCounts[idx]||0)),topCount=mode==='ONE_BANK'?0:Math.max(0,size-bottomCount),bottom=[],top=[];for(let i=0;i<bottomCount;i++)if(bottomCursor<=b1)bottom.push(bottomCursor++);for(let i=0;i<topCount;i++)if(topCursorDesc>b1)top.push(topCursorDesc--);return{letter,size,bottomCount,topCount,bottom,top}})}
function balancedColumnSpansClient(cols,sectors){const sizes=sectorSizesClient(cols,sectors,'ONE_BANK');let cursor=1;return sizes.map((w,i)=>{const o={letter:String.fromCharCode(65+i),start:cursor,end:cursor+w-1,width:w};cursor+=w;return o})}
function standColumnClient(stand,c){stand=Number(stand);let cursor=1;for(const sec of sectorLayoutClient(c)){if(sec.bottom.includes(stand)||sec.top.includes(stand))return cursor;cursor+=sec.size}return 1}
function sectorSpansClient(c){return sectorLayoutClient(c).map((s,i)=>({letter:s.letter,start:i+1,end:i+1,width:s.size,size:s.size,bottom:s.bottom,top:s.top}))}
function sectorForColumnClient(col,spans){return spans[Math.max(0,Math.min(spans.length-1,Number(col||1)-1))]?.letter||'A'}
function sectorMapClient(c){const m={};for(const sec of sectorLayoutClient(c)){for(const n of sec.bottom)m[Number(n)]=sec.letter;for(const n of sec.top)m[Number(n)]=sec.letter}return m}
function sectorForStandClient(stand,c){return sectorMapClient(c)[Number(stand)]||'A'}
function sectorRangesData(c){return sectorLayoutClient(c).map(sec=>{const stands=[...sec.bottom,...sec.top].sort((a,b)=>a-b);return {letter:sec.letter,stands,size:stands.length,bottom:sec.bottom,top:sec.top,width:sec.size}})}
function compactRange(arr){const asc=Array.from(new Set((arr||[]).map(Number).filter(Number.isFinite))).sort((a,b)=>a-b);if(!asc.length)return '—';const parts=[];let start=asc[0],prev=asc[0];for(let i=1;i<=asc.length;i++){const n=asc[i];if(n===prev+1){prev=n;continue}parts.push(start===prev?String(start):start+'-'+prev);start=n;prev=n}return parts.join(', ')}
function renderSectorRanges(c){const ranges=sectorRangesData(c);let txt=Array.isArray(c.sector_layout)||Array.isArray(SECTOR_MANUAL_DRAFT)?'Ręczny podział sektorów. ':'Automatyczny podział sektorów. ';if((c.map_mode||'TWO_OPPOSITE')==='ONE_BANK'){txt+=ranges.map(r=>r.letter+' ('+r.size+' os.): '+compactRange(r.bottom)).join(' • ')}else if((c.map_mode||'TWO_OPPOSITE')==='TWO_ALONG'){txt+=ranges.map(r=>r.letter+' ('+r.size+' os.): '+(r.bottom.length?'brzeg 1 '+compactRange(r.bottom):'brzeg 2 '+compactRange(r.top))).join(' • ')}else{txt+=ranges.map(r=>r.letter+' ('+r.size+' os.): dół '+compactRange(r.bottom)+' / góra '+compactRange(r.top)).join(' • ')}return '<div class="sectorSummary">'+esc(txt)+'</div>'}
function sectorColorClass(letter,c){const layout=sectorLayoutClient(c),idx=Math.max(0,layout.findIndex(s=>String(s.letter)===String(letter))),colors=['A','B','C','D','E','F','G','H'];return 'sectorFill-'+colors[idx%colors.length]}
function renderStandCell(n,c,drawStands,own1,own2,empty=false){if(empty)return '<div class="standCell empty"></div>';const sec=sectorForStandClient(n,c);let cls='standCell '+sectorColorClass(sec,c)+' '+(drawStands.has(Number(n))?'occ':'');const t1=own1&&Number(own1.stand)===Number(n),t2=own2&&Number(own2.stand)===Number(n);if(t1&&t2)cls+=' both';else if(t1)cls+=' t1';else if(t2)cls+=' t2';return '<div class="'+cls+'"><b>'+n+'</b></div>'}
function mapMinWidth(c){const total=Math.max(1,Number(c.bank1_count||0)+Number(c.bank2_count||0));return Math.max(640,total*34)}
function renderBankGroupRow(c,which,drawStands,own1,own2){const layout=sectorLayoutClient(c),minw=mapMinWidth(c);let html='<div class="sectorFlexRow standFlex" style="min-width:'+minw+'px">';for(const sec of layout){const arr=which==='top'?sec.top:sec.bottom;const count=Math.max(1,arr.length);html+='<div class="sectorGroup" style="flex:'+sec.size+' 0 0;grid-template-columns:repeat('+count+',minmax(32px,1fr))">';if(arr.length){for(const n of arr)html+=renderStandCell(n,c,drawStands,own1,own2)}else html+=renderStandCell(0,c,drawStands,own1,own2,true);html+='</div>'}return html+'</div>'}
function renderOneBankRow(c,drawStands,own1,own2){const layout=sectorLayoutClient(c),minw=mapMinWidth(c);let html='<div class="sectorFlexRow standFlex" style="min-width:'+minw+'px">';for(const sec of layout){const arr=sec.bottom;html+='<div class="sectorGroup" style="flex:'+sec.size+' 0 0;grid-template-columns:repeat('+Math.max(1,arr.length)+',minmax(32px,1fr))">';for(const n of arr)html+=renderStandCell(n,c,drawStands,own1,own2);html+='</div>'}return html+'</div>'}
function renderSectorBand(c){const layout=sectorLayoutClient(c),minw=mapMinWidth(c);let html='<div class="sectorFlexRow sectorBand clean" style="min-width:'+minw+'px">';for(const sec of layout){html+='<div class="sectorBlock '+sectorColorClass(sec.letter,c)+'" style="flex:'+sec.size+' 0 0"><div class="sectorWord">SEKTOR</div><div class="sectorLetter">'+esc(sec.letter)+'</div><div class="sectorPeople">'+sec.size+' osób</div></div>'}return html+'</div>'}
function renderAlongBankRow(c,which,drawStands,own1,own2){const layout=sectorLayoutClient(c).filter(sec=>(which==='top'?sec.top:sec.bottom).length),bankCount=which==='top'?Number(c.bank2_count||0):Number(c.bank1_count||0),minw=Math.max(640,bankCount*60);let html='<div class="sectorFlexRow standFlex" style="min-width:'+minw+'px">';for(const sec of layout){const arr=which==='top'?sec.top:sec.bottom;html+='<div class="sectorGroup" style="flex:'+arr.length+' 0 0;grid-template-columns:repeat('+arr.length+',minmax(44px,1fr))">';for(const n of arr)html+=renderStandCell(n,c,drawStands,own1,own2);html+='</div>'}return html+'</div>'}
function renderAlongSectorBand(c,which){const layout=sectorLayoutClient(c).filter(sec=>(which==='top'?sec.top:sec.bottom).length),bankCount=which==='top'?Number(c.bank2_count||0):Number(c.bank1_count||0),minw=Math.max(640,bankCount*60);let html='<div class="sectorFlexRow sectorBand clean" style="min-width:'+minw+'px">';for(const sec of layout){const size=(which==='top'?sec.top:sec.bottom).length;html+='<div class="sectorBlock '+sectorColorClass(sec.letter,c)+'" style="flex:'+size+' 0 0"><div class="sectorWord">SEKTOR</div><div class="sectorLetter">'+esc(sec.letter)+'</div><div class="sectorPeople">'+size+' osób</div></div>'}return html+'</div>'}
function renderMap(d){const c=d.competition;const own1=myDraw(1),own2=myDraw(2);const drawStands=new Set((d.draws||[]).map(x=>Number(x.stand)));const commonW=mapMinWidth(c),alongW=Math.max(640,Math.max(Number(c.bank1_count||0),Number(c.bank2_count||0))*60);let html='<div class="sectorMap">';if(c.map_mode==='ONE_BANK'){html+='<div class="mapTitle">SEKTORY NA JEDNYM BRZEGU</div>'+renderOneBankRow(c,drawStands,own1,own2)+renderSectorBand(c)}else if(c.map_mode==='TWO_ALONG'){html+='<div class="mapTitle">SEKTORY WZDŁUŻ DWÓCH BRZEGÓW</div><div class="bankLabel">BRZEG 2</div>'+renderAlongBankRow(c,'top',drawStands,own1,own2)+renderAlongSectorBand(c,'top')+'<div class="water" style="min-width:'+alongW+'px">WODA</div>'+renderAlongSectorBand(c,'bottom')+renderAlongBankRow(c,'bottom',drawStands,own1,own2)+'<div class="bankLabel bankLabelBottom">BRZEG 1</div>'}else{html+='<div class="bankLabel">BRZEG GÓRNY</div>'+renderBankGroupRow(c,'top',drawStands,own1,own2)+renderSectorBand(c)+'<div class="water" style="min-width:'+commonW+'px">'+esc(c.fishery||'Łowisko')+'</div>'+renderSectorBand(c)+renderBankGroupRow(c,'bottom',drawStands,own1,own2)+'<div class="bankLabel bankLabelBottom">BRZEG DOLNY</div>'}html+=renderSectorRanges(c)+'<p class="small muted"><span class="tag t1tag">czerwony = Twoje T1</span> <span class="tag t2tag">niebieski = Twoje T2</span></p></div>';return html}
function renderAdminMobileStructurePreview(d){
  const c=d.competition;
  const count=c.map_mode==='ONE_BANK'?Number(c.bank1_count||0):Math.max(Number(c.bank1_count||0),Number(c.bank2_count||0));
  const minWidth=Math.max(280,count*18);
  const map=renderMap(d).replace(/minmax\((?:32|44)px,1fr\)/g,'minmax(0,1fr)');
  return '<div class="adminMobileOverviewScroll"><div class="adminMobileOverviewCanvas" style="min-width:'+minWidth+'px">'+map+'</div></div><p class="adminOverviewHint">Całe łowisko i podział na sektory. Przy dużej liczbie stanowisk przesuń mapę w bok.</p><details class="adminSectorDetailToggle"><summary>Podgląd sektorów osobno</summary>'+renderMobileStructureMap(c)+'</details>';
}
function renderMobileStructureStand(n,c){const sec=sectorForStandClient(n,c);return '<div class="mobileStructureStand '+sectorColorClass(sec,c)+'"><b>'+n+'</b></div>'}
function renderMobileStructureBank(label,arr,c){if(!arr||!arr.length)return '';return '<div class="mobileStructureBank"><div class="mobileBankName">'+esc(label)+'</div><div class="mobileStructureGrid">'+arr.map(n=>renderMobileStructureStand(n,c)).join('')+'</div></div>'}
function renderMobileStructureMap(c){const layout=sectorLayoutClient(c);let html='<div class="mobileStructureMap"><div class="mobileMapMeta"><b>Podgląd sektorów</b><span>'+esc(c.fishery||'Łowisko')+'</span></div><div class="mobileSectorStack compactAdminSectors">';for(const sec of layout){const total=(sec.top||[]).length+(sec.bottom||[]).length;html+='<section class="mobileSectorCard compactAdminSector '+sectorColorClass(sec.letter,c)+'"><div class="mobileSectorHeader"><span>SEKTOR <b>'+esc(sec.letter)+'</b></span><small>'+total+' '+(total===1?'osoba':total>=2&&total<=4?'osoby':'osób')+'</small></div>';if((c.map_mode||'TWO_OPPOSITE')==='ONE_BANK')html+=renderMobileStructureBank('JEDEN BRZEG',sec.bottom,c);else if((c.map_mode||'TWO_OPPOSITE')==='TWO_ALONG'){if(sec.top?.length)html+=renderMobileStructureBank('BRZEG 2',sec.top,c);if(sec.bottom?.length)html+=renderMobileStructureBank('BRZEG 1',sec.bottom,c)}else{if(sec.top?.length)html+=renderMobileStructureBank('BRZEG GÓRNY',sec.top,c);if(sec.bottom?.length)html+=renderMobileStructureBank('BRZEG DOLNY',sec.bottom,c)}html+='</section>'}html+='</div></div>';return html}
function roundDrawStandMap(d,round){const entryByUser={};for(const e of (d.activeEntries||[]))entryByUser[Number(e.user_id)]=e;const byStand={};for(const dr of (d.draws||[])){if(Number(dr.round)!==Number(round))continue;const e=entryByUser[Number(dr.user_id)];byStand[Number(dr.stand)]={draw:dr,entry:e,name:e?(e.first_name+' '+e.last_name):''}}return byStand}
function renderRoundDrawCell(n,c,byStand,empty=false){if(empty)return '<div class=\"roundDrawCell empty\"></div>';const sec=sectorForStandClient(n,c),x=byStand[Number(n)],mine=x&&Number(x.draw.user_id)===Number(ME.id),label=x?shortPlayerLabel(x.name):'—';return '<div class=\"roundDrawCell '+sectorColorClass(sec,c)+(mine?' ownRoundDraw':'')+'\"><b class=\"roundStandNo\">'+n+'</b><span class=\"roundDrawName\">'+esc(label)+'</span></div>'}
function renderRoundBankGroup(c,which,byStand){const layout=sectorLayoutClient(c),minw=Math.max(680,mapMinWidth(c));let html='<div class="sectorFlexRow roundDrawRow" style="min-width:'+minw+'px">';for(const sec of layout){const arr=which==='top'?sec.top:sec.bottom;const count=Math.max(1,arr.length);html+='<div class="sectorGroup" style="flex:'+sec.size+' 0 0;grid-template-columns:repeat('+count+',minmax(50px,1fr))">';if(arr.length){for(const n of arr)html+=renderRoundDrawCell(n,c,byStand)}else html+=renderRoundDrawCell(0,c,byStand,true);html+='</div>'}return html+'</div>'}
function renderRoundOneBank(c,byStand){const layout=sectorLayoutClient(c),minw=Math.max(680,mapMinWidth(c));let html='<div class="sectorFlexRow roundDrawRow" style="min-width:'+minw+'px">';for(const sec of layout){const arr=sec.bottom;html+='<div class="sectorGroup" style="flex:'+sec.size+' 0 0;grid-template-columns:repeat('+Math.max(1,arr.length)+',minmax(50px,1fr))">';for(const n of arr)html+=renderRoundDrawCell(n,c,byStand);html+='</div>'}return html+'</div>'}
function renderRoundAlongBank(c,which,byStand){const layout=sectorLayoutClient(c).filter(sec=>(which==='top'?sec.top:sec.bottom).length),bankCount=which==='top'?Number(c.bank2_count||0):Number(c.bank1_count||0),minw=Math.max(640,bankCount*60);let html='<div class="sectorFlexRow roundDrawRow" style="min-width:'+minw+'px">';for(const sec of layout){const arr=which==='top'?sec.top:sec.bottom;html+='<div class="sectorGroup" style="flex:'+arr.length+' 0 0;grid-template-columns:repeat('+arr.length+',minmax(50px,1fr))">';for(const n of arr)html+=renderRoundDrawCell(n,c,byStand);html+='</div>'}return html+'</div>'}
function renderRoundDrawMap(d,round){const c=d.competition,byStand=roundDrawStandMap(d,round),has=Object.keys(byStand).length;if(!has)return '<p class="muted">Brak losowania T'+round+'.</p>';const commonW=Math.max(680,mapMinWidth(c)),alongW=Math.max(640,Math.max(Number(c.bank1_count||0),Number(c.bank2_count||0))*60);let html='<div class="sectorMap roundDrawMap"><div class="roundMapHeading">MAPA ŁOWISKA — TURA '+round+'</div>';if(c.map_mode==='ONE_BANK'){html+='<div class="bankLabel">JEDEN BRZEG</div>'+renderRoundOneBank(c,byStand)+renderSectorBand(c)}else if(c.map_mode==='TWO_ALONG'){html+='<div class="bankLabel">BRZEG 2</div>'+renderRoundAlongBank(c,'top',byStand)+renderAlongSectorBand(c,'top')+'<div class="water fisheryWater" style="min-width:'+alongW+'px">'+esc(c.fishery||'Łowisko')+'</div>'+renderAlongSectorBand(c,'bottom')+renderRoundAlongBank(c,'bottom',byStand)+'<div class="bankLabel bankLabelBottom">BRZEG 1</div>'}else{html+='<div class="bankLabel">BRZEG GÓRNY</div>'+renderRoundBankGroup(c,'top',byStand)+renderSectorBand(c)+'<div class="water fisheryWater" style="min-width:'+commonW+'px">'+esc(c.fishery||'Łowisko')+'</div>'+renderSectorBand(c)+renderRoundBankGroup(c,'bottom',byStand)+'<div class="bankLabel bankLabelBottom">BRZEG DOLNY</div>'}html+=renderSectorRanges(c)+'</div>';return html}
function drawRowsBySector(d,round){const entryByUser={};for(const e of (d.activeEntries||[]))entryByUser[Number(e.user_id)]=e;const box={};for(const dr of (d.draws||[])){if(Number(dr.round)!==Number(round))continue;const sec=String(dr.sector||'—'),e=entryByUser[Number(dr.user_id)]||{};(box[sec]=box[sec]||[]).push({user_id:dr.user_id,stand:Number(dr.stand),sector:sec,name:(e.first_name||'')+' '+(e.last_name||''),pzw_club:e.pzw_club||''})}return Object.keys(box).sort((a,b)=>a.localeCompare(b,'pl')).map(sec=>({sector:sec,rows:box[sec].sort((a,b)=>a.stand-b.stand)}))}
function renderDrawSectorTables(d,round){const groups=drawRowsBySector(d,round);if(!groups.length)return '';return '<div class="drawSectorGrid">'+groups.map(g=>'<div class="card drawSectorBox"><h4>Sektor '+esc(g.sector)+'</h4><div class="tablewrap"><table class="sharpTable"><thead><tr><th style="width:42px">Lp.</th><th style="width:54px">Stan.</th><th>Zawodnik</th></tr></thead><tbody>'+g.rows.map((r,i)=>'<tr class="'+(Number(r.user_id)===Number(ME.id)?'mine':'')+'"><td class="center">'+(i+1)+'</td><td class="center"><b>'+r.stand+'</b></td><td><b>'+esc(r.name.trim())+'</b></td></tr>').join('')+'</tbody></table></div></div>').join('')+'</div>'}
function shortPlayerName(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return '—';
  const last=parts[parts.length-1];
  if(last.length<=15)return last;
  return last.slice(0,14)+'…';
}
function shortPlayerLabel(name){
  const parts=String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length)return '—';
  const last=parts[parts.length-1];
  const first=parts[0]||'';
  return (first?first.charAt(0)+'. ':'')+last;
}
function renderMobileRoundStand(n,c,byStand){
  const sec=sectorForStandClient(n,c),x=byStand[Number(n)],mine=x&&Number(x.draw.user_id)===Number(ME.id),name=x?x.name.trim():'—';
  return '<div class="mobileStandCard '+sectorColorClass(sec,c)+(mine?' ownMobileStand':'')+'"><div class="mobileStandCardInner"><div class="mobileStandNo">'+n+'</div><div class="mobileStandInfo"><b>'+esc(shortPlayerLabel(name))+'</b>'+(mine?'<span class="mobileMineBadge">TWOJE STANOWISKO</span>':'')+'</div></div></div>';
}
function renderMobileBankStands(label,arr,c,byStand){
  if(!arr||!arr.length)return '';
  const cols=arr.length<=2?2:(arr.length<=4?2:3);
  return '<div class="mobileBankBlock"><div class="mobileBankName">'+esc(label)+'</div><div class="mobileStandGrid mobileStandGridReadable" style="grid-template-columns:repeat('+cols+',minmax(0,1fr))">'+arr.map(n=>renderMobileRoundStand(n,c,byStand)).join('')+'</div></div>';
}
function renderMobileRoundDrawMap(d,round){
  const c=d.competition,byStand=roundDrawStandMap(d,round),layout=sectorLayoutClient(c);
  if(!Object.keys(byStand).length)return '<div class="card"><p class="muted">Brak losowania T'+round+'.</p></div>';
  let html='<div class="mobileDrawMap compactPlayerDrawMap"><div class="mobileMapMeta"><b>ZOBRAZOWANIE SEKTORÓW — TURA '+round+'</b><span>'+esc(c.fishery||'Łowisko')+'</span></div><div class="mobileSectorStack">';
  for(const sec of layout){
    const total=(sec.top||[]).length+(sec.bottom||[]).length;
    html+='<section class="mobileSectorCard compactPlayerSector '+sectorColorClass(sec.letter,c)+'"><div class="mobileSectorHeader"><span>Sektor <b>'+esc(sec.letter)+'</b></span><small>'+total+' os.</small></div>';
    if(c.map_mode==='ONE_BANK')html+=renderMobileBankStands('JEDEN BRZEG',sec.bottom,c,byStand);
    else if(c.map_mode==='TWO_ALONG'){
      if(sec.top?.length)html+=renderMobileBankStands('BRZEG 2',sec.top,c,byStand);
      if(sec.bottom?.length)html+=renderMobileBankStands('BRZEG 1',sec.bottom,c,byStand);
    }else{
      if(sec.top?.length)html+=renderMobileBankStands('BRZEG GÓRNY',sec.top,c,byStand);
      if(sec.bottom?.length)html+=renderMobileBankStands('BRZEG DOLNY',sec.bottom,c,byStand);
    }
    html+='</section>';
  }
  return html+'</div></div>';
}
function renderRoundDrawView(d,round,forPlayer){const has=(d.draws||[]).some(x=>Number(x.round)===Number(round));let body='';if(has){if(forPlayer)body='<div class="playerDesktopDraw">'+renderRoundDrawMap(d,round)+renderDrawSectorTables(d,round)+'</div><div class="playerMobileDraw">'+renderMobileRoundDrawMap(d,round)+'</div>';else body='<div class="adminDesktopOnly">'+renderRoundDrawMap(d,round)+renderDrawSectorTables(d,round)+'</div><div class="adminMobileOnly">'+renderMobileRoundDrawMap(d,round)+'</div>'}else body='<p class="muted">Losowanie Tury '+round+' nie zostało jeszcze wykonane.</p>';return '<div class="card roundDrawSection '+(forPlayer?'playerRoundDrawSection':'')+'"><h2>Losowanie Tura '+round+'</h2>'+body+'</div>'}
function sectorCardRangeText(sec,c){if((c.map_mode||'TWO_OPPOSITE')==='ONE_BANK')return compactRange(sec.bottom);return [compactRange(sec.bottom),compactRange(sec.top)].filter(x=>x!=='—').join(', ')}
function renderSectorCards(c){const layout=sectorLayoutClient(c);return '<div class="grid3 sectorCards">'+layout.map((sec,idx)=>'<div class="card"><h3 style="margin-top:0">Sektor '+(idx+1)+'</h3><label>Nazwa sektora</label><input class="sectorNameInput" data-sector="'+idx+'" value="'+esc(sec.letter)+'" oninput="sectorCardsChanged()"><label>Stanowiska przypisane do sektora</label><input class="sectorRangeInput" data-sector="'+idx+'" value="'+esc(sectorCardRangeText(sec,c))+'" oninput="sectorCardsChanged()"><div class="small muted">Możesz wpisać np. 1-4, 17-19. Bez powtórzeń między sektorami.</div></div>').join('')+'</div>'}
function readSectorCards(){const names=Array.from(document.querySelectorAll('#sectorCardsWrap .sectorNameInput')),ranges=Array.from(document.querySelectorAll('#sectorCardsWrap .sectorRangeInput'));return names.map((el,idx)=>({name:el.value.trim()||String.fromCharCode(65+idx),range:ranges[idx]?.value||''}))}
function sectorCardsChanged(){if(!CURRENT_DETAIL)return;SECTOR_MANUAL_DRAFT=readSectorCards();if(q('dAutoBanks'))q('dAutoBanks').checked=false;const c=draftCompetition(),status=q('sectorEditStatus');try{const normalized=normalizeSectorLayoutClient(SECTOR_MANUAL_DRAFT,c);c.sector_layout=normalized;SECTOR_MANUAL_DRAFT=normalized;const d=JSON.parse(JSON.stringify(CURRENT_DETAIL));d.competition=c;q('structurePreview').innerHTML=renderMap(d);const mobile=q('structurePreviewMobile');if(mobile)mobile.innerHTML=renderMobileStructureMap(d.competition);if(status){status.className='small ok';status.textContent='Układ poprawny — kliknij „Zastosuj / zapisz strukturę”.'}}catch(e){if(status){status.className='small bad';status.textContent=e.message}}}
function sectorLayoutPayloadForSave(){if(SECTOR_MANUAL_DRAFT===undefined)return Array.isArray(CURRENT_DETAIL?.competition?.sector_layout)?CURRENT_DETAIL.competition.sector_layout:null;if(SECTOR_MANUAL_DRAFT===null)return null;return normalizeSectorLayoutClient(SECTOR_MANUAL_DRAFT,draftCompetition())}
function resetSectorLayout(ev){if(ev){ev.preventDefault();ev.stopPropagation()}SECTOR_MANUAL_DRAFT=null;updateStructurePreview(true)}


const PHOTO_OCR_MODEL_B64='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';
let PHOTO_OCR_PROTOS=null;
function photoOcrPrototypes(){
  if(PHOTO_OCR_PROTOS)return PHOTO_OCR_PROTOS;
  const bin=atob(PHOTO_OCR_MODEL_B64),out=[];
  for(let p=0;p<300;p++){
    const v=new Float32Array(64);let norm=0;
    for(let i=0;i<64;i++){const x=bin.charCodeAt(p*64+i)/255;v[i]=x;norm+=x*x}
    norm=Math.sqrt(norm)||1;for(let i=0;i<64;i++)v[i]/=norm;
    out.push({label:Math.floor(p/30),v});
  }
  return PHOTO_OCR_PROTOS=out;
}
function photoSheetGeometry(count){
  count=Math.max(1,Number(count||1));
  // Bezpieczny obszar druku A4: ok. 11–12 mm od krawędzi.
  // Geometria jest wspólna dla PDF i odczytu zdjęcia, więc OCR pozostaje zsynchronizowany.
  const x0=61,headerY=270,headerH=50,dataY=320,bottom=1635,rowH=Math.min(45,(bottom-dataY)/count);
  const widths=[42,320,126,126,126,126,126,126],fieldStart=x0+widths[0]+widths[1];
  return {x0,headerY,headerH,dataY,bottom,rowH,widths,fieldStart,fieldW:126,
    markers:[{x:85,y:238},{x:1155,y:238},{x:85,y:1680},{x:1155,y:1680}]};
}
function drawPhotoResultSheetPage(round){
  const d=CURRENT_DETAIL,o=pdfCanvas(),ctx=o.ctx,g=photoSheetGeometry((d.activeEntries||[]).length);
  drawPdfHeaderV33(ctx,'FORMULARZ DO IMPORTU ZE ZDJĘCIA — TURA '+round);
  ctx.fillStyle='#17251d';ctx.font='800 16px Arial';ctx.textAlign='center';
  ctx.fillText('Wpisuj normalnie całe wagi. * przed wagą oznacza dużą rybę, np. *9890. Ostatnia kolumna = SUMA.',620,196,1010);
  ctx.font='700 13px Arial';
  ctx.fillText('Przykład: 12450 | *9890 | 8700  → wszystkie wagi liczą się do sumy, a BF = 9890 g. Nie kadruj czarnych znaczników.',620,217,1020);
  ctx.textAlign='left';
  for(const m of g.markers){ctx.fillStyle='#000';ctx.fillRect(m.x-20,m.y-20,40,40);ctx.fillStyle='#fff';ctx.fillRect(m.x-6,m.y-6,12,12);ctx.fillStyle='#000';ctx.fillRect(m.x-2,m.y-2,4,4)}
  const headers=['Lp.','Zawodnik','W1','W2','W3','W4','W5','SUMA'];let x=g.x0;
  ctx.fillStyle='#e5efe8';ctx.fillRect(g.x0,g.headerY,g.widths.reduce((p,n)=>p+n,0),g.headerH);
  headers.forEach((h,i)=>{ctx.strokeStyle='#6c7d72';ctx.lineWidth=1.2;ctx.strokeRect(x,g.headerY,g.widths[i],g.headerH);ctx.fillStyle='#173d2e';ctx.font='800 15px Arial';ctx.textAlign=i<2?'left':'center';ctx.fillText(h,i<2?x+5:x+g.widths[i]/2,g.headerY+16,g.widths[i]-10);x+=g.widths[i]});
  ctx.textAlign='left';
  (d.activeEntries||[]).forEach((e,ri)=>{
    const y=g.dataY+ri*g.rowH;
    ctx.fillStyle=ri%2?'#fafafa':'#fff';ctx.fillRect(g.x0,y,g.widths.reduce((p,n)=>p+n,0),g.rowH);
    let xx=g.x0;
    for(let i=0;i<g.widths.length;i++){ctx.strokeStyle=i===7?'#597263':'#9dad9f';ctx.lineWidth=i===7?1.4:.9;ctx.strokeRect(xx,y,g.widths[i],g.rowH);xx+=g.widths[i]}
    ctx.fillStyle='#17251d';ctx.font='800 '+Math.min(18,g.rowH*.48)+'px Arial';ctx.fillText(String(ri+1),g.x0+7,y+Math.max(5,(g.rowH-18)/2),g.widths[0]-12);
    ctx.fillText(String(e.first_name+' '+e.last_name),g.x0+g.widths[0]+6,y+Math.max(5,(g.rowH-18)/2),g.widths[1]-12);
  });
  ctx.fillStyle='#17251d';ctx.font='700 13px Arial';ctx.textAlign='center';
  ctx.fillText('W1–W5 = kolejne ważenia w gramach • * przed wagą = BF • kilka * jest dozwolone • SUMA służy do kontroli odczytu',620,1658,1010);
  ctx.textAlign='left';return o.canvas;
}
function generatePhotoResultSheetPdf(round){
  const r=Number(round)===2?2:1,d=CURRENT_DETAIL;if(!d)return;
  if((d.activeEntries||[]).length>35){msg('Formularz zdjęciowy obsługuje do 35 zawodników na jednej stronie.','bad');return}
  return downloadPdfPages([drawPhotoResultSheetPage(r)],'formularz_zdjecie_'+pdfSafeName(d.competition.title)+'_T'+r+'.pdf');
}
function photoImageFromFile(file){
  return new Promise((resolve,reject)=>{const u=URL.createObjectURL(file),img=new Image();img.onload=()=>{URL.revokeObjectURL(u);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(u);reject(new Error('Nie udało się otworzyć zdjęcia'))};img.src=u});
}
function photoGrayData(img){
  const max=1800,scale=Math.min(1,max/Math.max(img.naturalWidth||img.width,img.naturalHeight||img.height)),w=Math.max(1,Math.round((img.naturalWidth||img.width)*scale)),h=Math.max(1,Math.round((img.naturalHeight||img.height)*scale));
  const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,w,h);
  const rgba=ctx.getImageData(0,0,w,h).data,gray=new Uint8Array(w*h);
  for(let i=0,p=0;i<rgba.length;i+=4,p++)gray[p]=Math.round(rgba[i]*.299+rgba[i+1]*.587+rgba[i+2]*.114);
  return {w,h,gray,canvas};
}
function photoIntegralDark(gray,w,h,limit=92){
  const stride=w+1,ii=new Uint32Array((w+1)*(h+1));
  for(let y=0;y<h;y++){let row=0;for(let x=0;x<w;x++){row+=gray[y*w+x]<limit?1:0;ii[(y+1)*stride+x+1]=ii[y*stride+x+1]+row}}
  return {ii,stride};
}
function photoRectSum(integral,x1,y1,x2,y2){
  const {ii,stride}=integral;x1=Math.max(0,x1|0);y1=Math.max(0,y1|0);x2=Math.max(x1,x2|0);y2=Math.max(y1,y2|0);
  return ii[y2*stride+x2]-ii[y1*stride+x2]-ii[y2*stride+x1]+ii[y1*stride+x1];
}
function photoFindMarker(image,rx1,ry1,rx2,ry2){
  const {w,h,gray}=image,integ=photoIntegralDark(gray,w,h),win=Math.max(18,Math.round(Math.min(w,h)*.028)),step=Math.max(2,Math.round(win/7));
  const x1=Math.round(w*rx1),x2=Math.round(w*rx2),y1=Math.round(h*ry1),y2=Math.round(h*ry2);let best=null;
  const scoreAt=(x,y)=>{
    const total=photoRectSum(integ,x,y,x+win,y+win),pad=Math.round(win*.33),ix1=x+pad,iy1=y+pad,ix2=x+win-pad,iy2=y+win-pad,inner=photoRectSum(integ,ix1,iy1,ix2,iy2);
    const innerArea=Math.max(1,(ix2-ix1)*(iy2-iy1)),outerArea=Math.max(1,win*win-innerArea),outer=(total-inner)/outerArea,inside=inner/innerArea;
    return {score:outer-inside*.8,outer,inside};
  };
  for(let y=y1;y<=y2-win;y+=step)for(let x=x1;x<=x2-win;x+=step){const sc=scoreAt(x,y);if(!best||sc.score>best.score)best={x:x+win/2,y:y+win/2,win,...sc,left:x,top:y}}
  if(!best||best.score<.18||best.outer<.28)return null;
  const refine=Math.max(2,step);let fine=best;
  for(let y=Math.max(y1,best.top-refine);y<=Math.min(y2-win,best.top+refine);y++)for(let x=Math.max(x1,best.left-refine);x<=Math.min(x2-win,best.left+refine);x++){const sc=scoreAt(x,y);if(sc.score>fine.score)fine={x:x+win/2,y:y+win/2,win,...sc,left:x,top:y}}
  return fine;
}
function photoSolveLinear(A,b){
  const n=b.length,M=A.map((r,i)=>r.slice().concat([b[i]]));
  for(let c=0;c<n;c++){let p=c;for(let r=c+1;r<n;r++)if(Math.abs(M[r][c])>Math.abs(M[p][c]))p=r;if(Math.abs(M[p][c])<1e-9)throw new Error('Nie udało się wyprostować zdjęcia');[M[c],M[p]]=[M[p],M[c]];const q=M[c][c];for(let k=c;k<=n;k++)M[c][k]/=q;for(let r=0;r<n;r++)if(r!==c){const f=M[r][c];for(let k=c;k<=n;k++)M[r][k]-=f*M[c][k]}}
  return M.map(r=>r[n]);
}
function photoHomography(src,dst){
  const A=[],b=[];for(let i=0;i<4;i++){const x=src[i].x,y=src[i].y,u=dst[i].x,v=dst[i].y;A.push([x,y,1,0,0,0,-u*x,-u*y]);b.push(u);A.push([0,0,0,x,y,1,-v*x,-v*y]);b.push(v)}
  const h=photoSolveLinear(A,b);return [h[0],h[1],h[2],h[3],h[4],h[5],h[6],h[7],1];
}
function photoMap(H,x,y){const d=H[6]*x+H[7]*y+1;return {x:(H[0]*x+H[1]*y+H[2])/d,y:(H[3]*x+H[4]*y+H[5])/d}}
function photoOtsu(vals){
  const hist=new Uint32Array(256);for(const v of vals)hist[v]++;const total=vals.length;let sum=0;for(let i=0;i<256;i++)sum+=i*hist[i];let sumB=0,wB=0,best=128,max=-1;
  for(let t=20;t<235;t++){wB+=hist[t];if(!wB)continue;const wF=total-wB;if(!wF)break;sumB+=t*hist[t];const mB=sumB/wB,mF=(sum-sumB)/wF,between=wB*wF*(mB-mF)*(mB-mF);if(between>max){max=between;best=t}}
  return Math.min(190,Math.max(70,best));
}
function photoFieldPixels(image,H,rect,sw=150,sh=44){
  const vals=new Uint8Array(sw*sh),{w,h,gray}=image;
  for(let yy=0;yy<sh;yy++)for(let xx=0;xx<sw;xx++){
    const lx=rect.x+(xx+.5)/sw*rect.w,ly=rect.y+(yy+.5)/sh*rect.h,p=photoMap(H,lx,ly),px=Math.max(0,Math.min(w-1,Math.round(p.x))),py=Math.max(0,Math.min(h-1,Math.round(p.y)));
    vals[yy*sw+xx]=gray[py*w+px];
  }
  return {vals,sw,sh};
}
function photoClassifyGlyph(points,sw,sh){
  if(!points||points.length<5)return {digit:'',confidence:0};
  let minX=sw,maxX=0,minY=sh,maxY=0;for(const p of points){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)}
  const bw=Math.max(1,maxX-minX+1),bh=Math.max(1,maxY-minY+1),vec=new Float32Array(64),scale=Math.min(6/bw,7/bh),tw=bw*scale,th=bh*scale,ox=(8-tw)/2,oy=(8-th)/2;
  for(const p of points){const tx=Math.max(0,Math.min(7,Math.floor(ox+(p.x-minX+.5)*scale))),ty=Math.max(0,Math.min(7,Math.floor(oy+(p.y-minY+.5)*scale)));vec[ty*8+tx]=1}
  let norm=0;for(const v of vec)norm+=v*v;norm=Math.sqrt(norm)||1;for(let i=0;i<64;i++)vec[i]/=norm;
  let best={label:0,score:-1},second={label:-1,score:-1};for(const p of photoOcrPrototypes()){let score=0;for(let i=0;i<64;i++)score+=vec[i]*p.v[i];if(score>best.score){if(p.label!==best.label)second=best;best={label:p.label,score}}else if(p.label!==best.label&&score>second.score)second={label:p.label,score}}
  const margin=best.score-(second.score<0?0:second.score),confidence=Math.max(0,Math.min(1,(best.score-.43)*1.7+margin*2.7));
  return {digit:String(best.label),confidence,best:best.score,margin,bbox:{minX,maxX,minY,maxY,bw,bh},points};
}
function photoMedian(values){
  if(!values||!values.length)return 0;const a=Array.from(values).sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2;
}
function photoBuildFieldReference(samples){
  if(!samples||samples.length<5)return null;const len=samples[0]?.vals?.length||0;if(!len)return null;const ref=new Uint8Array(len),tmp=new Array(samples.length);
  for(let i=0;i<len;i++){for(let r=0;r<samples.length;r++)tmp[r]=samples[r].vals[i];tmp.sort((a,b)=>a-b);ref[i]=tmp[Math.floor(tmp.length/2)]}
  return ref;
}
function photoReadWideSample(sample,allowStar=true,reference=null){
  const {vals,sw,sh}=sample,bin=new Uint8Array(sw*sh);
  if(reference&&reference.length===vals.length){
    const diffs=[];for(let yy=2;yy<sh-2;yy++)for(let xx=2;xx<sw-2;xx++){const i=yy*sw+xx;diffs.push(Number(reference[i])-Number(vals[i]))}
    const offset=photoMedian(diffs);
    for(let yy=2;yy<sh-2;yy++)for(let xx=2;xx<sw-2;xx++){const i=yy*sw+xx;if((Number(reference[i])-Number(vals[i])-offset)>18)bin[i]=1}
  }else{
    const thr=photoOtsu(vals);for(let yy=2;yy<sh-2;yy++)for(let xx=2;xx<sw-2;xx++)if(vals[yy*sw+xx]<thr-5)bin[yy*sw+xx]=1;
  }
  const seen=new Uint8Array(sw*sh),components=[],dirs=[-1,1,-sw,sw,-sw-1,-sw+1,sw-1,sw+1];let inkPixels=0;
  for(let i=0;i<bin.length;i++)if(bin[i]&&!seen[i]){const stack=[i],pts=[];seen[i]=1;while(stack.length){const q=stack.pop(),qy=Math.floor(q/sw),qx=q-qy*sw;pts.push({x:qx,y:qy});for(const d of dirs){const n=q+d;if(n<0||n>=bin.length||seen[n]||!bin[n])continue;const ny=Math.floor(n/sw),nx=n-ny*sw;if(Math.abs(nx-qx)>1||Math.abs(ny-qy)>1)continue;seen[n]=1;stack.push(n)}}if(pts.length>=7){let minX=sw,maxX=0,minY=sh,maxY=0;for(const p of pts){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y)}const bw=maxX-minX+1,bh=maxY-minY+1;if((bw>sw*.78&&bh<=3)||(bh>sh*.78&&bw<=2))continue;components.push(pts);inkPixels+=pts.length}}
  // Po odjęciu wzorca puste pola dają drobne artefakty. Prawdziwy odręczny wpis ma wyraźnie większą powierzchnię atramentu.
  if(reference&&inkPixels<450)return {value:'',isBigFish:false,low:false,blank:true,inkPixels};
  let glyphs=components.map(c=>photoClassifyGlyph(c,sw,sh)).filter(g=>g.bbox&&g.bbox.bh>=6&&g.bbox.bw>=1);
  glyphs.sort((a,b)=>a.bbox.minX-b.bbox.minX);
  if(!glyphs.length)return {value:'',isBigFish:false,low:false,blank:true,inkPixels};
  const major=glyphs.filter(g=>g.points.length>=12),minor=glyphs.filter(g=>g.points.length<12);
  for(const m of minor){let target=null,dist=999;for(const g of major){const dx=Math.max(0,Math.max(g.bbox.minX-m.bbox.maxX,m.bbox.minX-g.bbox.maxX));if(dx<dist&&dx<=5){dist=dx;target=g}}if(target){target.points=target.points.concat(m.points);Object.assign(target,photoClassifyGlyph(target.points,sw,sh))}}
  glyphs=major.length?major:glyphs;glyphs.sort((a,b)=>a.bbox.minX-b.bbox.minX);
  let isBigFish=false;
  if(allowStar&&glyphs.length>=2){const first=glyphs[0],rest=glyphs.slice(1),medH=rest.map(g=>g.bbox.bh).sort((a,b)=>a-b)[Math.floor(rest.length/2)]||first.bbox.bh;const square=first.bbox.bw/Math.max(1,first.bbox.bh);const small=first.bbox.bh<medH*.82;const left=first.bbox.minX<sw*.28;const uncertain=first.confidence<.48;const dense=first.points.length/Math.max(1,first.bbox.bw*first.bbox.bh)>.18;if(left&&(small||uncertain)&&(square>.35&&square<1.8)&&dense){isBigFish=true;glyphs=glyphs.slice(1)}}
  const digits=glyphs.slice(0,6);let value=digits.map(g=>g.digit).join('').replace(/^0+(?=\d)/,'');
  // W naszych zawodach wynik 1 g nie występuje; pojedyncze fałszywe „1” z OCR traktujemy jako 0.
  if(value==='1'){value='0';isBigFish=false}
  const low=digits.some(g=>g.confidence<.48)||(allowStar&&isBigFish&&digits.length===0);
  return {value:value||'',isBigFish,low,blank:!value,inkPixels,glyphs};
}
function photoReadWideField(image,H,x,y,w,h,allowStar=true,reference=null){return photoReadWideSample(photoFieldPixels(image,H,{x:x+3,y:y+3,w:w-6,h:h-6}),allowStar,reference)}
async function photoRecognizeSheet(file,round){
  const img=await photoImageFromFile(file),image=photoGrayData(img),g=photoSheetGeometry((CURRENT_DETAIL.activeEntries||[]).length);
  const found=[
    photoFindMarker(image,.005,.08,.18,.22),photoFindMarker(image,.82,.08,.995,.22),
    photoFindMarker(image,.005,.84,.18,.995),photoFindMarker(image,.82,.84,.995,.995)
  ];
  if(found.some(x=>!x))throw new Error('Nie widzę wszystkich 4 czarnych znaczników. Zrób zdjęcie całej kartki, bez obciętych rogów.');
  const H=photoHomography(g.markers,found),entries=CURRENT_DETAIL.activeEntries||[],samples=entries.map((e,ri)=>{const y=g.dataY+ri*g.rowH;return Array.from({length:6},(_,f)=>photoFieldPixels(image,H,{x:g.fieldStart+f*g.fieldW+3,y:y+3,w:g.fieldW-6,h:g.rowH-6}))});
  const refs=Array.from({length:6},(_,f)=>photoBuildFieldReference(samples.map(r=>r[f])));
  const rows=entries.map((e,ri)=>{
    const weights=[];for(let f=0;f<5;f++)weights.push(photoReadWideSample(samples[ri][f],true,refs[f]));
    const sum=photoReadWideSample(samples[ri][5],false,refs[5]);
    const calc=weights.reduce((acc,f)=>acc+(Number(f.value)||0),0),written=Number(sum.value)||0,bfTotal=weights.filter(f=>f.isBigFish).reduce((a,f)=>a+(Number(f.value)||0),0);
    if(written>0&&bfTotal>written)sum.low=true;
    return {userId:Number(e.user_id),name:e.first_name+' '+e.last_name,weights,sum,calculatedSum:calc,bigFishTotal:bfTotal};
  });
  return {round:Number(round),rows,markerQuality:Math.min(...found.map(x=>Number(x.score||0))),imageUrl:URL.createObjectURL(file)};
}
function closePhotoImportReview(){const x=q('photoImportOverlay');if(x){const u=x.dataset.imageUrl;if(u)URL.revokeObjectURL(u);x.remove()}}
function photoImportCell(field,key){
  const value=(field?.isBigFish?'*':'')+(field?.value||''),low=!!field?.low;return '<td class="'+(low?'photoOcrLow':'')+'"><input inputmode="text" data-key="'+key+'" value="'+esc(value)+'" placeholder="—">'+(low?'<small>sprawdź</small>':'')+'</td>';
}
function showPhotoImportReview(result){
  closePhotoImportReview();const overlay=document.createElement('div');overlay.id='photoImportOverlay';overlay.className='photoImportOverlay';overlay.dataset.round=String(result.round);overlay.dataset.imageUrl=result.imageUrl||'';
  const rows=result.rows.map((r,i)=>{const sumVal=r.sum?.value||'',calc=Number(r.calculatedSum||0),warn=!!r.sum?.low,info=sumVal?'SUMA = wynik końcowy':'z W1–W5: '+fmtGram(calc);return '<tr data-user-id="'+r.userId+'"><td class="photoOcrName"><b>'+(i+1)+'. '+esc(r.name)+'</b></td>'+r.weights.map((f,j)=>photoImportCell(f,'w'+(j+1))).join('')+'<td class="'+(warn?'photoOcrLow':'')+'"><input inputmode="numeric" data-key="sum" value="'+esc(sumVal)+'" placeholder="—"><small>'+info+'</small></td></tr>'}).join('');
  overlay.innerHTML='<div class="photoImportDialog"><div class="photoImportHead"><div><h2>Import ze zdjęcia — T'+result.round+'</h2><p>Sprawdź odczyt. <b>SUMA ma pierwszeństwo</b>. Zapis <b>*9890</b> oznacza BF 9890 g.</p></div><button type="button" class="warn" onclick="closePhotoImportReview()">Zamknij</button></div>'
    +'<div class="photoImportPreview"><img src="'+esc(result.imageUrl||'')+'" alt="Zdjęcie formularza"></div>'
    +'<div class="photoImportWarn">⚠ Zapis zastąpi wszystkie dotychczasowe wpisy wag w T'+result.round+'. Jeśli jest SUMA, stanie się wynikiem końcowym; z W1–W5 zachowane zostaną wtedy tylko wartości oznaczone * jako BF.</div>'
    +'<div class="tablewrap"><table class="photoImportTable"><thead><tr><th>Zawodnik</th><th>W1</th><th>W2</th><th>W3</th><th>W4</th><th>W5</th><th>SUMA</th></tr></thead><tbody>'+rows+'</tbody></table></div>'
    +'<div class="photoImportActions"><button type="button" class="blue" onclick="commitPhotoResultImport(this)">IMPORTUJ DO T'+result.round+'</button><button type="button" class="secondary" onclick="closePhotoImportReview()">Anuluj</button></div></div>';
  document.body.appendChild(overlay);overlay.querySelector('input')?.focus({preventScroll:true});
}
async function processPhotoResultImport(file,round){
  try{msg('Analizuję zdjęcie…');const result=await photoRecognizeSheet(file,round);showPhotoImportReview(result);msg('Zdjęcie odczytane — sprawdź dane przed importem.')}
  catch(e){msg(e.message||'Nie udało się odczytać zdjęcia','bad')}
}
function startPhotoResultImport(round){
  if(!CURRENT_DETAIL||ME?.role!=='ADMIN')return;const input=document.createElement('input');input.type='file';input.accept='image/*';input.setAttribute('capture','environment');input.style.display='none';
  input.onchange=()=>{const f=input.files?.[0];input.remove();if(f)processPhotoResultImport(f,Number(round)===2?2:1)};document.body.appendChild(input);input.click();
}
async function commitPhotoResultImport(button){
  const overlay=q('photoImportOverlay');if(!overlay||!CURRENT_DETAIL)return;const round=Number(overlay.dataset.round)===2?2:1,rows=[];
  const parseWeight=raw=>{raw=String(raw||'').trim();const bigFish=/^\s*\*/.test(raw);let n=Number(raw.replace(/\D/g,'').slice(0,7)||0);if(n===1)n=0;return {weight:n,bigFish:bigFish&&n>0}};
  for(const tr of overlay.querySelectorAll('tbody tr[data-user-id]')){
    const sourceItems=[];for(let i=1;i<=5;i++){const p=parseWeight(tr.querySelector('input[data-key="w'+i+'"]')?.value||'');if(p.weight>0)sourceItems.push(p)}
    let writtenSum=Number(String(tr.querySelector('input[data-key="sum"]')?.value||'').replace(/\D/g,'').slice(0,8)||0);if(writtenSum===1)writtenSum=0;
    let items;
    if(writtenSum>0){
      const bfItems=sourceItems.filter(x=>x.bigFish),bfTotal=bfItems.reduce((a,x)=>a+Number(x.weight||0),0);
      if(bfTotal>writtenSum){msg('Suma dużych ryb ('+fmtGram(bfTotal)+' g) jest większa niż SUMA ('+fmtGram(writtenSum)+' g). Popraw wiersz przed importem.','bad');return}
      items=bfItems.map(x=>({weight:x.weight,bigFish:true}));const remainder=writtenSum-bfTotal;if(remainder>0)items.push({weight:remainder,bigFish:false});
    }else items=sourceItems.map(x=>({weight:x.weight,bigFish:x.bigFish}));
    rows.push({userId:Number(tr.dataset.userId),items,sourceItems,writtenSum,sumAuthoritative:writtenSum>0});
  }
  if(!confirm('Zaimportować odczytane dane i ZASTĄPIĆ wszystkie obecne wpisy T'+round+'?'))return;
  if(button){button.disabled=true;button.textContent='Importuję…'}
  try{const d=await api('/api/admin/competitions/'+CURRENT_DETAIL.competition.id+'/results/'+round+'/import-photo',{method:'POST',body:JSON.stringify({rows})});closePhotoImportReview();msg('Zaimportowano T'+round+': '+d.inserted+' wpisów wag, BF: '+d.bigFishEntries+'.');await refreshCompetitionKeepScroll(CURRENT_DETAIL.competition.id);showAdminZone('entry')}
  catch(e){msg(e.message,'bad');if(button){button.disabled=false;button.textContent='IMPORTUJ DO T'+round}}
}

function renderResultsEntryPanel(d){const c=d.competition;return '<div class="card"><h2>Wpisywanie wyników</h2><p class="small muted"><b>Przeliczanie jest automatyczne.</b> Po zapisaniu lub usunięciu każdej wagi klasyfikacje T1, T2 i końcowa są liczone ponownie. Wpisz wagę siatki albo dużej ryby i przejdź do innego pola.</p><div class="photoImportQuick"><b>📷 Import z papierowej tabeli</b><span>Użyj formularza „do zdjęcia” z zakładki PDF. Odczyt zawsze wymaga kontroli przed zapisem.</span><div class="grid"><button type="button" class="blue" onclick="startPhotoResultImport(1)">Wczytaj T1 ze zdjęcia</button><button type="button" class="blue" onclick="startPhotoResultImport(2)">Wczytaj T2 ze zdjęcia</button></div></div><div class="grid3"><button type="button" class="secondary" onclick="generateResults('+c.id+',1,event)">Generuj wyniki T1</button><button type="button" class="secondary" onclick="generateResults('+c.id+',2,event)">Generuj wyniki T2</button><button type="button" class="blue" onclick="generateResultsAll('+c.id+',event)">Generuj T1 + T2</button></div><button type="button" class="warn" style="margin-top:10px" onclick="clearResults('+c.id+',event)">Wyczyść wszystkie wyniki T1 i T2</button><div class="resultEntryRounds"><div class="resultRoundPanel"><h3>T1</h3>'+renderResultForm(d,1)+'</div><div class="resultRoundPanel"><h3>T2</h3>'+renderResultForm(d,2)+'</div></div></div>'}
function renderResultsSummaryPanel(d){const c=d.competition;return '<div class="card"><h2>Wyniki i klasyfikacja</h2><div class="grid"><button type="button" class="blue" onclick="notifyResults('+c.id+',1)">Powiadom o wynikach T1</button><button type="button" class="blue" onclick="notifyResults('+c.id+',2)">Powiadom o wynikach T2</button></div><div class="inlineBtns"><button type="button" class="secondary" onclick="retryAchievementToasts('+c.id+',1,this)">Ponów dymki T1</button><button type="button" class="secondary" onclick="retryAchievementToasts('+c.id+',2,this)">Ponów dymki T2</button><button type="button" class="secondary" onclick="retryAchievementToasts('+c.id+',\'general\',this)">Ponów dymki generalne</button></div><p id="achievementPublishStatus" role="status"></p>'+renderSectorResultsBoard(d)+'<h3>Klasyfikacja T1</h3>'+renderClassTable(d.classification.round1)+'<h3>Klasyfikacja T2</h3>'+renderClassTable(d.classification.round2)+'<h3>Klasyfikacja końcowa</h3><button type="button" class="blue" onclick="notifyGeneralResults('+c.id+',this)">Powiadom o klasyfikacji końcowej</button><p id="generalPublishStatus" role="status"></p>'+renderFinalClubToggle()+renderGeneralTable(d.classification.general)+renderStationStatistics(d)+'</div>'}
function placeRowClass(rank){const r=Number(rank);return r===1?'place1':r===2?'place2':r===3?'place3':''}
function sortRowsBySectorPlace(rows){return [...(rows||[])].sort((a,b)=>Number(a.points||999)-Number(b.points||999)||Number(b.weight||0)-Number(a.weight||0)||String(a.name||'').localeCompare(String(b.name||''),'pl'))}
function groupRowsBySector(rows){const box={};for(const r of (rows||[])){const sec=String(r.sector||'—').trim()||'—';(box[sec]=box[sec]||[]).push(r)}return Object.keys(box).sort((a,b)=>a.localeCompare(b,'pl')).map(sec=>({sector:sec,rows:sortRowsBySectorPlace(box[sec])}))}
function renderSectorMiniTable(group){return '<div class="card" style="padding:8px;margin:0 0 10px 0"><h4 class="sectorMiniTitle" style="margin:0 0 6px 0;text-align:center">Sektor '+esc(group.sector)+'</h4><div class="tablewrap"><table class="sharpTable"><thead><tr><th class="center" style="width:42px">Msc</th><th class="center" style="width:50px">Stan</th><th>Zawodnik</th><th class="right" style="width:108px">Waga</th></tr></thead><tbody>'+group.rows.map(r=>'<tr class="'+placeRowClass(r.points)+' '+(Number(r.user_id)===Number(ME.id)?'mine':'')+'"><td class="center"><b>'+placeText(r.points)+'</b></td><td class="center nowrap">'+(r.stand||'—')+'</td><td><b>'+esc(r.name)+'</b></td><td class="right nowrap">'+resultCellSummary(r)+'</td></tr>').join('')+'</tbody></table></div></div>'}
function renderSectorResultsColumn(rows,title){const groups=groupRowsBySector(rows),head=title?'<h3 style="text-align:center;margin-top:0">'+esc(title)+'</h3>':'';return '<div>'+head+(groups.length?groups.map(renderSectorMiniTable).join(''):'<p class="muted">Brak wyników sektorowych.</p>')+'</div>'}
function renderSectorResultsBoard(d){return '<div class="card"><h2>Wyniki sektorowe</h2><div class="twoCols"><div>'+renderSectorResultsColumn(d.classification.round1,'1 tura')+'</div><div>'+renderSectorResultsColumn(d.classification.round2,'2 tura')+'</div></div></div>'}
function stationStatisticsRows(d){const all=[];for(const r of (d.classification?.round1||[]))all.push({round:1,...r});for(const r of (d.classification?.round2||[]))all.push({round:2,...r});const by={};for(const r of all){const stand=Number(r.stand||0);if(!stand)continue;const x=by[stand]||(by[stand]={stand,items:[],totalWeight:0});x.items.push(r);x.totalWeight+=Number(r.weight||0)}return Object.values(by).map(x=>{const places=x.items.map(r=>Number(r.points||0)).filter(Boolean),avg=places.length?places.reduce((a,b)=>a+b,0)/places.length:0;return {...x,occ:x.items.length,places,avg}}).sort((a,b)=>a.stand-b.stand)}
function stationStatsTable(rows,kind=''){if(!rows.length)return '<p class="muted">Brak danych.</p>';const cls=kind==='best'?'stationStandBest':kind==='worst'?'stationStandWorst':'';const desktop='<div class="tablewrap adminDesktopOnly"><table class="sharpTable"><thead><tr><th>Lp.</th><th>Stan.</th><th>Wystąpienia</th><th>Miejsca</th><th>Śr.</th><th>Waga łączna</th></tr></thead><tbody>'+rows.map((r,i)=>'<tr><td class="center">'+(i+1)+'</td><td class="center '+cls+'"><b>'+r.stand+'</b></td><td class="center">'+r.occ+'</td><td class="center">'+r.places.map(placeText).join(' / ')+'</td><td class="center"><b>'+r.avg.toFixed(2).replace('.',',')+'</b></td><td class="right nowrap"><b>'+fmtGram(r.totalWeight)+'g</b></td></tr>').join('')+'</tbody></table></div>';const mobile='<div class="adminMobileOnly mobileStatsList">'+rows.map((r,i)=>'<article class="mobileStatsCard"><b class="mobileStatsStand '+cls+'">Stan. '+r.stand+'</b><div><span><small>Wyst.</small><b>'+r.occ+'</b></span><span><small>Miejsca</small><b>'+r.places.map(placeText).join(' / ')+'</b></span><span><small>Śr.</small><b>'+r.avg.toFixed(2).replace('.',',')+'</b></span><span><small>Waga</small><b>'+fmtGram(r.totalWeight)+'g</b></span></div></article>').join('')+'</div>';return desktop+mobile}
function renderStationStatistics(d){const rows=stationStatisticsRows(d),best=[...rows].filter(x=>x.places.length).sort((a,b)=>a.avg-b.avg||b.totalWeight-a.totalWeight||a.stand-b.stand).slice(0,5),worst=[...rows].filter(x=>x.places.length).sort((a,b)=>b.avg-a.avg||a.totalWeight-b.totalWeight||a.stand-b.stand).slice(0,5),detail=[];for(const r of rows)for(const it of r.items)detail.push({round:it.round,stand:r.stand,sector:it.sector,points:it.points,weight:it.weight,name:it.name});detail.sort((a,b)=>a.round-b.round||a.stand-b.stand);return '<div class="card"><h2>Statystyki stanowisk</h2><h3>Stanowiska po 2 turach</h3>'+stationStatsTable(rows)+'<div class="twoCols"><div><h3>5 najlepszych stanowisk</h3>'+stationStatsTable(best,'best')+'</div><div><h3>5 najgorszych stanowisk</h3>'+stationStatsTable(worst,'worst')+'</div></div><h3>Stanowiska wg tury</h3><div class="tablewrap"><table class="sharpTable"><thead><tr><th>Lp.</th><th>Tura</th><th>Stan.</th><th>Sektor</th><th>Miejsce</th><th>Zawodnik</th><th>Waga</th></tr></thead><tbody>'+detail.map((r,i)=>'<tr class="'+placeRowClass(r.points)+'"><td class="center">'+(i+1)+'</td><td class="center">T'+r.round+'</td><td class="center"><b>'+r.stand+'</b></td><td class="center">'+esc(r.sector||'—')+'</td><td class="center"><b>'+placeText(r.points)+'</b></td><td>'+esc(r.name||'')+'</td><td class="right nowrap">'+fmtGram(r.weight||0)+'g</td></tr>').join('')+'</tbody></table></div></div>'}

const JUDGE_QUEUE_KEY='lowcy_judge_offline_queue_v1';
const JUDGE_ME_CACHE='lowcy_judge_offline_me_v1';
const JUDGE_COMP_CACHE='lowcy_judge_offline_competitions_v1';
let JUDGE_SYNC_BUSY=false;
function judgeQueueAll(){try{const x=JSON.parse(STORE.get(JUDGE_QUEUE_KEY)||'[]');return Array.isArray(x)?x:[]}catch(_){return []}}
function judgeSaveQueue(arr){STORE.set(JUDGE_QUEUE_KEY,JSON.stringify(arr||[]));}
function judgeOwnQueue(){const uid=Number(ME?.id||0);return judgeQueueAll().filter(x=>Number(x.judgeUserId||0)===uid)}
function judgePendingFor(compId,round,userId,kind){return judgeOwnQueue().filter(x=>Number(x.compId)===Number(compId)&&Number(x.round)===Number(round)&&Number(x.userId)===Number(userId)&&String(x.kind)===String(kind))}
function judgeMutationId(){return 'judge-'+Number(ME?.id||0)+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,10)}
function judgeCacheDetail(d){if(!d?.competition?.id)return;try{STORE.set('lowcy_judge_detail_'+Number(d.competition.id),JSON.stringify(d))}catch(_){}}
function judgeCachedDetail(id){try{return JSON.parse(STORE.get('lowcy_judge_detail_'+Number(id))||'null')}catch(_){return null}}
function judgeCacheCompetitions(arr){try{STORE.set(JUDGE_COMP_CACHE,JSON.stringify(arr||[]))}catch(_){}}
function judgeCachedCompetitions(){try{const a=JSON.parse(STORE.get(JUDGE_COMP_CACHE)||'[]');return Array.isArray(a)?a:[]}catch(_){return []}}
function judgeQueueStatus(){
  const n=judgeOwnQueue().length;
  const cls=n?(navigator.onLine?'syncing':'offline'):'ok';
  const text=n?(navigator.onLine?'⟳ '+n+' wpisów czeka na synchronizację':'📴 '+n+' wpisów zapisanych w telefonie'):'✓ Wszystkie wpisy zsynchronizowane';
  return '<div class="judgeOfflineState '+cls+'">'+text+'</div>';
}
function judgeAddPending(item){
  const all=judgeQueueAll();all.push(item);judgeSaveQueue(all);
}
function judgeRemovePending(id){
  const all=judgeQueueAll().filter(x=>String(x.id)!==String(id));judgeSaveQueue(all);
}
function judgeCancelPending(id){
  judgeRemovePending(id);renderJudgeWork();msg('Usunięto oczekujący wpis z telefonu');
}
async function flushJudgeQueue(silent=true){
  if(JUDGE_SYNC_BUSY||!ME||ME.role!=='JUDGE'||!navigator.onLine)return;
  const pending=judgeOwnQueue();if(!pending.length){if(JUDGE_VIEW==='entry')renderJudgeWork();return}
  JUDGE_SYNC_BUSY=true;
  let sent=0,failed=0;
  try{
    for(const item of pending){
      try{
        await api('/api/admin/competitions/'+item.compId+'/results/'+item.round+'/items',{method:'POST',body:JSON.stringify({userId:item.userId,kind:item.kind,weight:item.weight,clientMutationId:item.id}),timeoutMs:4000});
        judgeRemovePending(item.id);sent++;
      }catch(e){
        if(e&&Number(e.status)>=400&&Number(e.status)<500){item.error=e.message||'Błąd wpisu';const all=judgeQueueAll().map(x=>String(x.id)===String(item.id)?item:x);judgeSaveQueue(all);failed++;continue}
        break;
      }
    }
    if(sent&&CURRENT_DETAIL?.competition?.id){
      try{CURRENT_DETAIL=await api('/api/competitions/'+CURRENT_DETAIL.competition.id);judgeCacheDetail(CURRENT_DETAIL)}catch(_){}
    }
    if(JUDGE_VIEW==='entry')renderJudgeWork();
    if(!silent&&sent)msg('Zsynchronizowano wpisy: '+sent);
    if(failed)msg('Niektóre wpisy offline wymagają sprawdzenia.','bad');
  }finally{JUDGE_SYNC_BUSY=false}
}
window.addEventListener('online',()=>{flushJudgeQueue(false).catch(()=>{})});
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('message',ev=>{
    if(ev?.data?.type!=='LOWCY_ATTENTION_REFRESH'||!ME||ME.role==='ADMIN'||ME.role==='JUDGE')return;
    refreshPlayerAttention(true).then(()=>loadNotifications()).catch(()=>{});
  });
}
setInterval(()=>{if(ME?.role==='JUDGE'&&navigator.onLine)flushJudgeQueue(true).catch(()=>{})},15000);
function renderWeightItems(round,uid,kind){const arr=resultItems(round,uid,kind),compId=Number(CURRENT_DETAIL?.competition?.id||0),pending=ME?.role==='JUDGE'?judgePendingFor(compId,round,uid,kind):[];if(!arr.length&&!pending.length)return '<div class="small muted">Brak zapisanych wag.</div>';return '<div class="weightItems">'+arr.map(i=>'<span class="weightTag '+(kind==='BF'?'bfTag':'netTag')+'">'+fmtGram(i.weight)+'g <button type="button" title="Usuń" onclick="deleteWeightItem('+i.id+')">×</button></span>').join('')+pending.map(i=>'<span class="weightTag judgePendingWeight '+(i.error?'judgePendingError':'')+'" title="'+esc(i.error||'Zapisano w telefonie — oczekuje na serwer')+'">'+fmtGram(i.weight)+'g <small>'+(i.error?'⚠':'⟳')+'</small> <button type="button" title="Usuń oczekujący wpis" data-id="'+esc(i.id)+'" onclick="judgeCancelPending(this.dataset.id)">×</button></span>').join('')+'</div>'}
function resultCellSummary(r){r=r||{};const bf=Number(r.big_fish||0);return '<b>'+fmtGram(r.weight||0)+'g</b>'+(bf?'<br><span class="bfLine">BF: '+fmtGram(bf)+'g</span>':'')}
function renderResultForm(d,round){const entries=d.activeEntries||[];const dm=drawMap(round);const rm=resMap(round);if(!entries.length)return '<p class="muted">Brak aktywnych zawodników.</p>';let desktop='<div class="tablewrap adminDesktopOnly"><table class="resultInputTable"><thead><tr><th style="width:42px">Lp.</th><th>Zawodnik</th><th>Stan.</th><th>Sektor</th><th>Wagi siatek</th><th>Duże ryby BF</th><th>Suma</th></tr></thead><tbody>';desktop+=entries.map((e,idx)=>{const uid=Number(e.user_id),dr=dm[uid],r=rm[uid]||{};return '<tr><td class="center"><b>'+(idx+1)+'</b></td><td><b>'+esc(e.first_name+' '+e.last_name)+'</b></td><td>'+(dr?esc(dr.stand):'—')+'</td><td>'+(dr?esc(dr.sector):'—')+'</td><td>'+renderWeightItems(round,uid,'NET')+'<input class="weightInput" inputmode="numeric" id="net-'+round+'-'+uid+'" placeholder="nowa waga siatki g" onblur="addWeightItem('+d.competition.id+','+round+','+uid+',\'NET\',this)" onkeydown="weightKey(event)"></td><td>'+renderWeightItems(round,uid,'BF')+'<input class="weightInput" inputmode="numeric" id="bf-'+round+'-'+uid+'" placeholder="nowa duża ryba g" onblur="addWeightItem('+d.competition.id+','+round+','+uid+',\'BF\',this)" onkeydown="weightKey(event)"></td><td class="nowrap">'+resultCellSummary(r)+'</td></tr>'}).join('');desktop+='</tbody></table></div>';const mobile='<div class="adminMobileOnly mobileResultEntryList">'+entries.map((e,idx)=>{const uid=Number(e.user_id),dr=dm[uid],r=rm[uid]||{};return '<article class="mobileAdminCard mobileResultEntryCard"><div class="mobileAdminCardHead"><span class="mobileLp">'+(idx+1)+'</span><b>'+esc(e.first_name+' '+e.last_name)+'</b><strong class="mobileResultSum">'+resultCellSummary(r)+'</strong></div><div class="mobileAdminMeta"><span><small>Stan.</small><b>'+(dr?esc(dr.stand):'—')+'</b></span><span><small>Sektor</small><b>'+(dr?esc(dr.sector):'—')+'</b></span></div><div class="mobileWeightBlock"><label>Wagi siatek</label>'+renderWeightItems(round,uid,'NET')+'<input class="weightInput" inputmode="numeric" id="mnet-'+round+'-'+uid+'" placeholder="Nowa waga siatki (g)" onblur="addWeightItem('+d.competition.id+','+round+','+uid+',\'NET\',this)" onkeydown="weightKey(event)"></div><div class="mobileWeightBlock"><label>Duże ryby BF</label>'+renderWeightItems(round,uid,'BF')+'<input class="weightInput" inputmode="numeric" id="mbf-'+round+'-'+uid+'" placeholder="Nowa duża ryba (g)" onblur="addWeightItem('+d.competition.id+','+round+','+uid+',\'BF\',this)" onkeydown="weightKey(event)"></div></article>'}).join('')+'</div>';return desktop+mobile}
function weightKey(ev){if(ev.key==='Enter'){ev.preventDefault();ev.target.blur();}}
async function refreshCompetitionKeepScroll(compId){try{const d=await api('/api/competitions/'+compId);CURRENT_DETAIL=d;renderDetail();q('competitionDetail').classList.remove('hidden');}catch(e){msg(e.message,'bad')}}
async function addWeightItem(compId,round,userId,kind,el){
  const val=String(el?.value||'').trim();if(!val)return;if(el?.dataset?.saving==='1')return;
  if(el&&el.dataset)el.dataset.saving='1';const td=el?.closest('td');if(td)td.classList.add('flashSave');
  if(ME?.role==='JUDGE'){
    const item={id:judgeMutationId(),judgeUserId:Number(ME.id),compId:Number(compId),round:Number(round),userId:Number(userId),kind:String(kind),weight:val,createdAt:new Date().toISOString(),error:''};
    const queueAndFinish=()=>{judgeAddPending(item);if(el)el.value='';if(el&&el.dataset)el.dataset.saving='0';renderJudgeWork();msg('Zapisano w telefonie. Wyślę automatycznie po odzyskaniu zasięgu.','ok')};
    if(!navigator.onLine){queueAndFinish();return}
    try{
      await api('/api/admin/competitions/'+compId+'/results/'+round+'/items',{method:'POST',body:JSON.stringify({userId,kind,weight:val,clientMutationId:item.id}),timeoutMs:4000});
      if(el)el.value='';
      try{CURRENT_DETAIL=await api('/api/competitions/'+compId);judgeCacheDetail(CURRENT_DETAIL)}catch(_){}
      if(el&&el.dataset)el.dataset.saving='0';renderJudgeWork();
    }catch(e){
      if(e&&Number(e.status)>=400&&Number(e.status)<500){if(el&&el.dataset)el.dataset.saving='0';msg(e.message,'bad');return}
      queueAndFinish();
    }
    return;
  }
  try{
    await api('/api/admin/competitions/'+compId+'/results/'+round+'/items',{method:'POST',body:JSON.stringify({userId,kind,weight:val})});
    if(el)el.value='';
    setTimeout(async()=>{try{await refreshCompetitionKeepScroll(compId)}finally{if(el&&el.dataset)el.dataset.saving='0'}},350)
  }catch(e){if(el&&el.dataset)el.dataset.saving='0';msg(e.message,'bad')}
}
async function deleteWeightItem(itemId){try{if(!confirm('Usunąć ten wpis wagi?'))return;const compId=CURRENT_DETAIL.competition.id;await api('/api/admin/results/items/'+itemId,{method:'DELETE'});msg('Usunięto wpis wagi');await refreshCompetitionKeepScroll(compId)}catch(e){msg(e.message,'bad')}}
async function saveResults(id,round,ev){if(SAVING_RESULTS)return;SAVING_RESULTS=true;const btn=ev?.target;if(btn){btn.disabled=true;btn.textContent='Przeliczam...'}try{const results=(CURRENT_DETAIL.activeEntries||[]).map(e=>({userId:e.user_id}));await api('/api/admin/competitions/'+id+'/results/'+round,{method:'POST',body:JSON.stringify({results})});msg('Przeliczono wyniki T'+round);await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{SAVING_RESULTS=false;if(btn){btn.disabled=false;btn.textContent='Przelicz T'+round}}}
async function generateResults(id,round,ev){const btn=ev?.target;try{if(!confirm('Wygenerować testowe wyniki T'+round+'? Obecne wpisy wag tej tury zostaną zastąpione.'))return;if(btn){btn.disabled=true;btn.textContent='Generuję...'}const d=await api('/api/admin/competitions/'+id+'/results/'+round+'/generate',{method:'POST',body:'{}'});msg('Wygenerowano wyniki T'+round+' dla '+d.count+' zawodników');await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Generuj wyniki T'+round}}}
async function generateResultsAll(id,ev){const btn=ev?.target;try{if(!confirm('Wygenerować testowe wyniki T1 i T2? Obecne wpisy wag obu tur zostaną zastąpione.'))return;if(btn){btn.disabled=true;btn.textContent='Generuję...'}const a=await api('/api/admin/competitions/'+id+'/results/1/generate',{method:'POST',body:'{}'});const b=await api('/api/admin/competitions/'+id+'/results/2/generate',{method:'POST',body:'{}'});msg('Wygenerowano T1 i T2: '+a.count+' / '+b.count+' zawodników');await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Generuj T1 + T2'}}}
async function clearResults(id,ev){const btn=ev?.target;try{if(!confirm('Wyczyścić WSZYSTKIE wpisane wyniki T1 i T2 dla tych zawodów? Losowanie i lista zawodników pozostaną bez zmian.'))return;if(btn){btn.disabled=true;btn.textContent='Czyszczę...'}await api('/api/admin/competitions/'+id+'/results',{method:'DELETE',body:JSON.stringify({confirm:'WYCZYSC_WYNIKI'})});msg('Wyczyszczono wszystkie wyniki T1 i T2');await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Wyczyść wszystkie wyniki T1 i T2'}}}
async function retryAchievementToasts(id,round,button){
  if(button?.disabled)return;
  if(!confirm('Ponownie pokazać dymki zawodnikom, również tym, którzy już je widzieli?'))return;
  if(button)button.disabled=true;
  try{const d=await api('/api/admin/competitions/'+id+'/achievements/'+round+'/retry',{method:'POST',body:'{}'});const report='Dymki przygotowane ponownie: '+d.queued+'. Zawodnik zobaczy je po otwarciu aplikacji (do 12 sekund).';msg(report);if(q('achievementPublishStatus'))q('achievementPublishStatus').textContent=report}
  catch(e){msg(e.message,'bad')}
  finally{if(button)button.disabled=false}
}
async function notifyGeneralResults(id,button){
  if(button?.disabled)return;
  if(!confirm('Opublikować klasyfikację końcową i wysłać gratulacje pierwszej trójce? Niewpisane wagi będą liczone jako zero.'))return;
  if(button)button.disabled=true;
  try{const d=await api('/api/admin/competitions/'+id+'/results/general/notify',{method:'POST',body:'{}'});const report='Powiadomiono: '+d.notified+'. Gratulacje generalne — oczekują: '+d.achievementsPending+', już pokazane: '+d.achievementsSeen+'.';msg(report);if(q('generalPublishStatus'))q('generalPublishStatus').textContent=report;await loadNotifications()}
  catch(e){msg(e.message,'bad')}
  finally{if(button)button.disabled=false}
}
async function notifyResults(id,round){try{if(!confirm('Wysłać zawodnikom powiadomienie o wynikach T'+round+'?'))return;const d=await api('/api/admin/competitions/'+id+'/results/'+round+'/notify',{method:'POST',body:'{}'});await refreshCompetitionKeepScroll(id);const report='Powiadomiono: '+d.notified+'. Dymki oczekujące: '+d.achievementsPending+', już pokazane: '+d.achievementsSeen+'.';msg(report);if(q('achievementPublishStatus'))q('achievementPublishStatus').textContent=report;await loadNotifications()}catch(e){msg(e.message,'bad')}}
function renderClassTable(rows){rows=sortRowsBySectorPlace(rows||[]);if(!rows.length)return '<p class="muted">Brak wyników.</p>';const desktop='<div class="tablewrap adminDesktopOnly"><table class="sharpTable roundClassTable"><thead><tr><th style="width:42px">Lp.</th><th>Zawodnik</th><th>Stan.</th><th>Sektor</th><th>Miejsce</th><th>Waga</th></tr></thead><tbody>'+rows.map((r,idx)=>'<tr class="'+placeRowClass(r.points)+' '+(Number(r.user_id)===Number(ME.id)?'mine':'')+'"><td class="center">'+(idx+1)+'</td><td><b>'+esc(r.name)+'</b></td><td class="nowrap">'+(r.stand||'—')+'</td><td>'+esc(r.sector||'—')+'</td><td><b>'+placeText(r.points)+'</b></td><td class="nowrap">'+resultCellSummary(r)+'</td></tr>').join('')+'</tbody></table></div>';const mobile='<div class="adminMobileOnly mobileClassList">'+rows.map((r,idx)=>'<article class="mobileAdminCard '+placeRowClass(r.points)+'"><div class="mobileAdminCardHead"><span class="mobileLp">'+(idx+1)+'</span><b>'+esc(r.name)+'</b><strong class="mobilePlace">Msc '+placeText(r.points)+'</strong></div><div class="mobileAdminMeta"><span><small>Stan.</small><b>'+(r.stand||'—')+'</b></span><span><small>Sektor</small><b>'+esc(r.sector||'—')+'</b></span></div><div class="mobileResultFooter"><span>Waga</span><b>'+resultCellSummary(r)+'</b></div></article>').join('')+'</div>';return desktop+mobile}
function placeText(v){return (v===0||v)?esc(String(v).replace('.',',')):'—'}
function renderGeneralTable(rows){rows=rows||[];if(!rows.length)return '<p class="muted">Brak klasyfikacji końcowej.</p>';const desktop='<div class="tablewrap finalWrap adminDesktopOnly"><table class="generalTable sharpTable"><thead><tr><th class="colRank center">MSC</th><th class="colName">Zawodnik</th><th class="colRound center">T1</th><th class="colRound center">T2</th><th class="colSum center">Suma miejsc</th><th class="colWeight right">Waga</th></tr></thead><tbody>'+rows.map(r=>{const club=String(r.pzw_club||'').trim();return '<tr class="'+placeRowClass(r.rank)+' '+(Number(r.user_id)===Number(ME.id)?'mine':'')+'"><td class="colRank center"><b>'+r.rank+'</b></td><td class="colName nameCell"><b>'+esc(r.name)+'</b>'+(club?'<span class="finalClub small muted '+(SHOW_FINAL_CLUB?'':'hidden')+'"> • '+esc(club)+'</span>':'')+'</td><td class="colRound center scoreCell"><b>'+placeText(r.t1_points)+'</b></td><td class="colRound center scoreCell"><b>'+placeText(r.t2_points)+'</b></td><td class="colSum center sumCell"><b>'+placeText(r.sum_points)+'</b></td><td class="colWeight right weightCell"><b>'+fmtGram(r.total_weight)+'g</b>'+(Number(r.biggest_fish||0)?'<br><span class="bfLine">BF: '+fmtGram(r.biggest_fish)+'g</span>':'')+'</td></tr>'}).join('')+'</tbody></table></div>';const mobile='<div class="adminMobileOnly mobileGeneralList">'+rows.map(r=>{const club=String(r.pzw_club||'').trim();return '<article class="mobileAdminCard '+placeRowClass(r.rank)+'"><div class="mobileAdminCardHead"><strong class="mobileRank">'+r.rank+'</strong><b>'+esc(r.name)+'</b>'+(club?'<span class="finalClub small muted '+(SHOW_FINAL_CLUB?'':'hidden')+'"> • '+esc(club)+'</span>':'')+'</div><div class="mobileScoreGrid"><span><small>T1</small><b>'+placeText(r.t1_points)+'</b></span><span><small>T2</small><b>'+placeText(r.t2_points)+'</b></span><span><small>Suma</small><b>'+placeText(r.sum_points)+'</b></span><span><small>Waga</small><b>'+fmtGram(r.total_weight)+'g</b>'+(Number(r.biggest_fish||0)?'<em>BF '+fmtGram(r.biggest_fish)+'g</em>':'')+'</span></div></article>'}).join('')+'</div>';return desktop+mobile}
function renderPdfPanel(d){const c=d.competition;return '<div class="card"><h2>Generowanie plików PDF</h2><p class="small muted">Każdy PDF ma wspólny nagłówek: nazwa zawodów, data, łowisko i opis zawartości.</p><h3>Losowanie</h3><div class="grid3"><button type="button" onclick="generateDrawPdf(1)">PDF Losowanie T1</button><button type="button" onclick="generateDrawPdf(2)">PDF Losowanie T2</button><button type="button" class="secondary" onclick="generateDrawPdf(0)">PDF Losowanie T1 + T2</button></div><h3>Wyniki</h3>'+renderFinalClubToggle()+'<div class="grid3"><button type="button" onclick="generateResultsPdfV33(1)">PDF Wyniki T1</button><button type="button" onclick="generateResultsPdfV33(2)">PDF Wyniki T2</button><button type="button" class="secondary" onclick="generateResultsPdfV33(0)">PDF Klasyfikacja końcowa</button></div><div class="grid3"><button type="button" class="secondary" onclick="generateSectorPdf(1)">PDF Sektory T1</button><button type="button" class="secondary" onclick="generateSectorPdf(2)">PDF Sektory T2</button><button type="button" class="secondary" onclick="generateStatsPdf()">PDF Statystyki</button></div><h3>Tabelka wynikowa</h3><button type="button" class="secondary" onclick="generateWeightSheetPdf()">PDF Tabelka wynikowa — 1 strona</button><div class="photoPdfBox"><b>FORMULARZ DO ODCZYTU ZE ZDJĘCIA</b><span>Ma znaczniki do prostowania zdjęcia i szerokie pola na całe wagi. * przed wagą oznacza BF, ostatnia kolumna to SUMA.</span><div class="grid"><button type="button" class="blue" onclick="generatePhotoResultSheetPdf(1)">PDF do zdjęcia — T1</button><button type="button" class="blue" onclick="generatePhotoResultSheetPdf(2)">PDF do zdjęcia — T2</button></div></div><h3>Lista startowa</h3><button type="button" class="blue" onclick="generateStartListPdf()">PDF Tabela startowa zawodników — 1 strona</button><p class="small muted">Tabela startowa: Lp., Zawodnik, Potwierdzenie ✓, Wpisowe, Koszyk +, Uwagi. Układ automatycznie wykorzystuje całą stronę.</p></div>'}
function pdfAsciiBytes(x){return new TextEncoder().encode(x)}
function pdfConcatBytes(chunks){let n=chunks.reduce((a,b)=>a+b.length,0),out=new Uint8Array(n),o=0;for(const c of chunks){out.set(c,o);o+=c.length}return out}
function pdfDataUrlBytes(url){const b64=url.split(',')[1],bin=atob(b64),out=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);return out}
function buildSimplePdf(jpegs,widths,heights){const chunks=[],offsets=[0];let length=0;const push=b=>{chunks.push(b);length+=b.length},pushS=x=>push(pdfAsciiBytes(x));pushS('%PDF-1.4\n%1234\n');const objCount=2+jpegs.length*3;function os(n){offsets[n]=length;pushS(n+' 0 obj\n')}function oe(){pushS('endobj\n')}os(1);pushS('<< /Type /Catalog /Pages 2 0 R >>\n');oe();os(2);pushS('<< /Type /Pages /Kids ['+jpegs.map((_,i)=>(3+i*3)+' 0 R').join(' ')+'] /Count '+jpegs.length+' >>\n');oe();jpegs.forEach((jpg,i)=>{const page=3+i*3,img=4+i*3,content=5+i*3;os(page);pushS('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im'+(i+1)+' '+img+' 0 R >> >> /Contents '+content+' 0 R >>\n');oe();os(img);pushS('<< /Type /XObject /Subtype /Image /Width '+widths[i]+' /Height '+heights[i]+' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpg.length+' >>\nstream\n');push(jpg);pushS('\nendstream\n');oe();const stream='q\n595.28 0 0 841.89 0 0 cm\n/Im'+(i+1)+' Do\nQ\n';os(content);pushS('<< /Length '+pdfAsciiBytes(stream).length+' >>\nstream\n'+stream+'endstream\n');oe()});const xref=length;pushS('xref\n0 '+(objCount+1)+'\n0000000000 65535 f \n');for(let i=1;i<=objCount;i++)pushS(String(offsets[i]).padStart(10,'0')+' 00000 n \n');pushS('trailer\n<< /Size '+(objCount+1)+' /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF');return pdfConcatBytes(chunks)}
function pdfCanvas(){return LowcyPDF.canvas()}
function wrapPdfText(ctx,text,maxW){const lines=[];for(const para of String(text??'').split(/\n/)){const words=para.split(/\s+/).filter(Boolean);let line='';if(!words.length){lines.push('');continue}for(const w of words){const t=line?line+' '+w:w;if(ctx.measureText(t).width<=maxW||!line)line=t;else{lines.push(line);line=w}}if(line)lines.push(line)}return lines.length?lines:['']}
function drawPdfHeaderV33(ctx,context){const c=CURRENT_DETAIL.competition;ctx.fillStyle='#123d2e';ctx.fillRect(0,0,1240,168);ctx.fillStyle='#fff';ctx.font='800 38px Arial';const titleLines=wrapPdfText(ctx,String(c.title||'Zawody'),900).slice(0,2);titleLines.forEach((line,i)=>ctx.fillText(line,44,24+i*40));ctx.font='700 19px Arial';ctx.fillText('Data: '+fmtDate(c.competition_date),44,106);ctx.fillText('Łowisko: '+String(c.fishery||'—'),312,106);ctx.font='800 27px Arial';ctx.fillText(String(context||''),44,136);return 188}
function pdfPlaceThemeV33(rank){const r=Number(rank);if(r===1)return{row:'#fdeaea',cell:'#c62828',text:'#ffffff'};if(r===2)return{row:'#e8edf7',cell:'#173b70',text:'#ffffff'};if(r===3)return{row:'#e8f4eb',cell:'#2e7d32',text:'#ffffff'};return null}
function drawPdfTablePage(context,headers,rows,widths,startIndex=0,rowRanks=null,scale=1.8){const o=pdfCanvas(scale),ctx=o.ctx;let y=drawPdfHeaderV33(ctx,context),x0=Math.round((1240-widths.reduce((a,b)=>a+b,0))/2),total=widths.reduce((a,b)=>a+b,0),headH=44,bottomLimit=1704;ctx.lineWidth=1;ctx.font='800 14px Arial';ctx.fillStyle='#e5efe8';ctx.fillRect(x0,y,total,headH);ctx.strokeStyle='#8ea99a';let x=x0;headers.forEach((h,i)=>{ctx.strokeRect(x,y,widths[i],headH);ctx.fillStyle='#173d2e';ctx.fillText(String(h),x+7,y+13);x+=widths[i]});y+=headH;const sectorBreaks=headers[0]==='Sektor'?rows.reduce((n,r,i)=>n+(i>0&&r[0]!==rows[i-1][0]?1:0),0):0,rowCount=Math.max(1,rows.length||1),rowH=Math.max(35,Math.min(54,Math.floor((bottomLimit-y-sectorBreaks*6)/rowCount))),bodyFont=16,lineH=Math.max(14,bodyFont+3),maxLines=2;for(let r=0;r<rows.length;r++){if(headers[0]==='Sektor'&&r>0&&rows[r][0]!==rows[r-1][0]){y+=6;ctx.fillStyle='#64756c';ctx.fillRect(x0,y-3,total,2)}const theme=rowRanks?pdfPlaceThemeV33(rowRanks[r]):null;x=x0;for(let i=0;i<headers.length;i++){ctx.fillStyle=theme?(i===0?theme.cell:theme.row):'#fff';ctx.fillRect(x,y,widths[i],rowH);ctx.strokeStyle='#b8c8bd';ctx.strokeRect(x,y,widths[i],rowH);ctx.fillStyle=theme&&i===0?theme.text:'#17251d';ctx.font=(i===0||i===1?'800 ':'600 ')+bodyFont+'px Arial';const lines=wrapPdfText(ctx,String(rows[r][i]??''),widths[i]-14).slice(0,maxLines);const blockH=lines.length*lineH,startY=y+Math.max(2,(rowH-blockH)/2);lines.forEach((line,j)=>ctx.fillText(line,x+7,startY+j*lineH));x+=widths[i]}y+=rowH;if(y+rowH>bottomLimit)break}return o.canvas}
function makePdfTablePages(context,headers,rows,widths,rowRanks=null){const per=rows.length&&rows.length<=35?rows.length:35,pages=[];for(let i=0;i<rows.length||i===0;i+=per){const slice=rows.slice(i,i+per),ranks=rowRanks?rowRanks.slice(i,i+per):null;pages.push(drawPdfTablePage(context+(rows.length>per?' — str. '+(Math.floor(i/per)+1):''),headers,slice,widths,i,ranks,1.8))}return pages}
function downloadPdfPages(pages,filename){return LowcyPDF.download(pages,filename)}
function pdfSafeName(s){return String(s||'zawody').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9_-]+/g,'_')}
function drawMapPdfPage(round){const o=pdfCanvas(2),ctx=o.ctx,d=CURRENT_DETAIL,c=d.competition,by=roundDrawStandMap(d,round),layout=sectorLayoutClient(c),palette=['#d8f1dd','#dbe8fb','#ffe7bd','#f6d9e3','#eadffb','#dff4f4'];let y=drawPdfHeaderV33(ctx,'LOSOWANIE — TURA '+round);const x0=40,innerW=1160,b1=Number(c.bank1_count||0),b2=Number(c.bank2_count||0),bottom=Array.from({length:b1},(_,i)=>i+1),top=Array.from({length:b2},(_,i)=>b1+b2-i),maxCount=Math.max(1,bottom.length,top.length),tileW=Math.max(34,Math.min(76,Math.floor(innerW/maxCount))),cellH=136,bandH=70,waterH=56;function sectorColor(letter){const idx=Math.max(0,layout.findIndex(s=>String(s.letter||'')===String(letter||'')));return palette[idx%palette.length]}function displayName(full){const parts=String(full||'').trim().split(/\s+/).filter(Boolean);if(!parts.length)return '—';const last=parts[parts.length-1];if(last.length<=14)return last;return last.slice(0,13)+'…'}function rowStart(arr){return x0+Math.round((innerW-arr.length*tileW)/2)}function segments(arr){const out=[];let cur=null,start=0;arr.forEach((n,i)=>{const sec=sectorForStandClient(n,c);if(cur===null){cur=sec;start=i}else if(sec!==cur){out.push({letter:cur,start,count:i-start});cur=sec;start=i}});if(cur!==null)out.push({letter:cur,start,count:arr.length-start});return out}function drawBankLabel(label,yy){ctx.fillStyle='#173d2e';ctx.font='800 22px Arial';ctx.fillText(label,44,yy)}function drawStandRow(arr,yy){const sx=rowStart(arr);for(let i=0;i<arr.length;i++){const n=arr[i],x=sx+i*tileW,sec=sectorForStandClient(n,c),item=by[n];ctx.fillStyle=sectorColor(sec);ctx.fillRect(x,yy,tileW-2,cellH);ctx.strokeStyle='#9ab0a3';ctx.strokeRect(x,yy,tileW-2,cellH);ctx.fillStyle='#173d2e';ctx.font='900 26px Arial';ctx.fillText(String(n),x+6,yy+6);ctx.save();ctx.translate(x+Math.floor(tileW*0.62),yy+cellH-8);ctx.rotate(-Math.PI/2);ctx.textAlign='center';ctx.font='800 17px Arial';ctx.fillText(displayName(item?.name||''),0,0);ctx.restore();ctx.textAlign='left'}return sx}function drawSectorBands(arr,yy){const sx=rowStart(arr);for(const seg of segments(arr)){const x=sx+seg.start*tileW,w=seg.count*tileW-2,letter=seg.letter,color=sectorColor(letter);ctx.fillStyle=color;ctx.fillRect(x,yy,w,bandH);ctx.strokeStyle='#49715f';ctx.lineWidth=2;ctx.strokeRect(x,yy,w,bandH);ctx.fillStyle='#173d2e';ctx.textAlign='center';ctx.font='800 18px Arial';ctx.fillText('SEKTOR',x+w/2,yy+10);ctx.font='900 34px Arial';ctx.fillText(String(letter||''),x+w/2,yy+25);ctx.font='800 16px Arial';ctx.fillText(seg.count+' os.',x+w/2,yy+53);ctx.textAlign='left'}ctx.lineWidth=1}if(c.map_mode==='ONE_BANK'){drawBankLabel('JEDEN BRZEG',y);y+=34;drawStandRow(bottom,y);y+=cellH+12;drawSectorBands(bottom,y);y+=bandH+22}else{drawBankLabel('BRZEG GÓRNY',y);y+=34;drawStandRow(top,y);y+=cellH+10;drawSectorBands(top,y);y+=bandH+16;ctx.fillStyle='#eef4f0';ctx.fillRect(44,y,1152,waterH);ctx.fillStyle='#315b48';ctx.font='800 28px Arial';ctx.textAlign='center';ctx.fillText(c.fishery||'Łowisko',620,y+14);ctx.textAlign='left';y+=waterH+16;drawSectorBands(bottom,y);y+=bandH+10;drawStandRow(bottom,y);y+=cellH+22;drawBankLabel('BRZEG DOLNY',y);y+=24}const ranges=sectorRangesData(c);ctx.fillStyle='#173d2e';ctx.font='800 20px Arial';ctx.fillText('Sektory i zakresy stanowisk:',44,y);ctx.font='17px Arial';const colW=560,rowGap=28;ranges.forEach((r,i)=>{const col=i%2,row=Math.floor(i/2),xx=58+col*colW,yy=y+32+row*rowGap;ctx.fillText('Sektor '+r.letter+': '+compactRange(r.stands),xx,yy)});return o.canvas}
// One continuous table per round, one A4 page.
function drawCompactDrawPdfPage(round){const d=CURRENT_DETAIL,dm=drawMap(round),rows=(d.activeEntries||[]).map((e,i)=>{const dr=dm[Number(e.user_id)];return[i+1,e.first_name+' '+e.last_name,dr?.stand??'—',dr?.sector??'—']});return drawPlainSinglePage('LOSOWANIE — TURA '+round,['Lp.','Zawodnik','Stan.','Sektor'],rows,[65,805,150,150],false)}
function drawPlainSinglePage(title,headers,rows,widths,stripes){
 const o=pdfCanvas(),ctx=o.ctx,c=CURRENT_DETAIL.competition;
 ctx.fillStyle='#17251d';ctx.font='800 23px Arial';ctx.fillText([c.title,fmtDate(c.competition_date),c.fishery].filter(Boolean).join('  •  '),35,30,1170);
 ctx.font='800 26px Arial';ctx.fillText(title,35,68,1170);
 const top=112,head=42,rowH=Math.min(58,(1700-top-head)/Math.max(1,rows.length)),font=rows.length<=35?23:Math.min(23,rowH*.5);
 let x=35;headers.forEach((h,i)=>{ctx.strokeStyle='#777777';ctx.lineWidth=1;ctx.strokeRect(x,top,widths[i],head);ctx.font='800 17px Arial';ctx.fillText(h,x+5,top+12,widths[i]-10);x+=widths[i]});
 rows.forEach((row,r)=>{let x=35;const y=top+head+r*rowH;row.forEach((value,i)=>{if(stripes&&r%2===1){ctx.fillStyle='#f3f3f3';ctx.fillRect(x,y,widths[i],rowH)}ctx.strokeStyle='#999999';ctx.strokeRect(x,y,widths[i],rowH);ctx.fillStyle='#17251d';ctx.font=(i<2?'800 ':'400 ')+font+'px Arial';ctx.fillText(String(value??''),x+5,y+(rowH-font)/2,widths[i]-10);x+=widths[i]})});return o.canvas;
}
async function generateWeightSheetPdf(){const d=CURRENT_DETAIL;if(!d)return;try{const rows=(d.activeEntries||[]).map((e,i)=>[i+1,e.first_name+' '+e.last_name,'','','','','','']);const font=rows.length<=35?23:Math.min(23,((1700-112-42)/Math.max(1,rows.length))*.5);const sizes=await LowcyPDF.textWidths(['Zawodnik',...rows.map(r=>r[1])],font);const nameWidth=Math.min(760,Math.ceil(Math.max(...sizes)+12)),weightWidth=(1170-50-nameWidth)/6;return downloadPdfPages([drawPlainSinglePage('TABELKA WYNIKOWA',['Lp.','Zawodnik','Waga 1','Waga 2','Waga 3','Waga 4','Waga 5','SUMA'],rows,[50,nameWidth,...Array(6).fill(weightWidth)],true)],'tabelka_wynikowa_'+pdfSafeName(d.competition.title)+'.pdf')}catch(e){msg('PDF: '+e.message,'bad')}}
function generateDrawPdf(round){const d=CURRENT_DETAIL;if(!d)return;const r=Number(round);if(r===0){if(!(d.draws||[]).some(x=>[1,2].includes(Number(x.round)))){msg('Brak losowania T1 i T2','bad');return}const t1=drawMap(1),t2=drawMap(2),cell=dr=>dr?'Stan. '+dr.stand+' / Sektor '+dr.sector:'—';const rows=(d.activeEntries||[]).map((e,i)=>[i+1,e.first_name+' '+e.last_name,cell(t1[Number(e.user_id)]),cell(t2[Number(e.user_id)])]);return downloadPdfPages([drawPlainSinglePage('LOSOWANIE — T1 + T2',['Lp.','Zawodnik','T1 — Stanowisko / Sektor','T2 — Stanowisko / Sektor'],rows,[65,505,300,300],false)],'losowanie_'+pdfSafeName(d.competition.title)+'_T1_T2.pdf')}if(!(d.draws||[]).some(x=>Number(x.round)===r)){msg('Brak losowania T'+r,'bad');return}return downloadPdfPages([drawCompactDrawPdfPage(r)],'losowanie_'+pdfSafeName(d.competition.title)+'_T'+r+'.pdf')}
function pdfResultWeight(r,total=false){const weight=total?Number(r.total_weight||0):Number(r.weight||0),bf=Number(total?r.biggest_fish:r.big_fish||0);return fmtGram(weight)+' g'+(bf?'\nBF: '+fmtGram(bf)+' g':'')}
function makeSectorResultsPdfPagesV33(round){const groups=groupRowsBySector(Number(round)===1?CURRENT_DETAIL.classification.round1:CURRENT_DETAIL.classification.round2),rr=groups.flatMap(g=>g.rows.map(r=>({...r,sector:g.sector})));return makePdfTablePages('KLASYFIKACJA SEKTOROWA — TURA '+round,['Sektor','Msc','Zawodnik','Stan.','Waga'],rr.map(r=>[r.sector,placeText(r.points),r.name,r.stand||'—',pdfResultWeight(r,false)]),[85,80,555,120,308],rr.map(r=>r.points))}
function generateSectorPdf(round){return downloadPdfPages(makeSectorResultsPdfPagesV33(round),'sektory_'+pdfSafeName(CURRENT_DETAIL.competition.title)+'_T'+round+'.pdf')}
function generateStatsPdf(){if(CURRENT_DETAIL)return downloadPdfPages([drawStationStatsPdfPage(CURRENT_DETAIL)],'statystyki_'+pdfSafeName(CURRENT_DETAIL.competition.title)+'.pdf')}
function drawStationStatsPdfPage(d){const o=pdfCanvas(1.5),ctx=o.ctx,rows=stationStatisticsRows(d),best=[...rows].filter(x=>x.places.length).sort((a,b)=>a.avg-b.avg||b.totalWeight-a.totalWeight||a.stand-b.stand).slice(0,5),worst=[...rows].filter(x=>x.places.length).sort((a,b)=>b.avg-a.avg||a.totalWeight-b.totalWeight||a.stand-b.stand).slice(0,5);let y=drawPdfHeaderV33(ctx,'STATYSTYKI STANOWISK — 5 NAJLEPSZYCH / 5 NAJGORSZYCH');const boxW=552,gap=28,xs=[46,46+552+gap];function drawBox(title,data,x,bg,accent){ctx.fillStyle=bg;ctx.fillRect(x,y,boxW,48);ctx.strokeStyle='#8ea99a';ctx.strokeRect(x,y,boxW,48);ctx.fillStyle='#173d2e';ctx.font='800 18px Arial';ctx.fillText(title,x+10,y+13);let yy=y+48;const widths=[48,72,146,80,206],heads=['Lp.','Stan.','Miejsca','Śr.','Waga łączna'];let xx=x;ctx.font='800 13px Arial';for(let i=0;i<heads.length;i++){ctx.fillStyle='#e8f0ea';ctx.fillRect(xx,yy,widths[i],42);ctx.strokeStyle='#b8c8bd';ctx.strokeRect(xx,yy,widths[i],42);ctx.fillStyle='#173d2e';ctx.fillText(heads[i],xx+5,yy+12);xx+=widths[i]}yy+=42;data.forEach((r,i)=>{xx=x;const vals=[i+1,r.stand,r.places.map(placeText).join(' / '),r.avg.toFixed(2).replace('.',','),fmtGram(r.totalWeight)+' g'];for(let j=0;j<vals.length;j++){ctx.fillStyle=j===1?accent:'#fff';ctx.fillRect(xx,yy,widths[j],54);ctx.strokeStyle='#c0cec4';ctx.strokeRect(xx,yy,widths[j],54);ctx.fillStyle='#17251d';ctx.font=(j===1?'900 20px':'700 14px')+' Arial';ctx.fillText(String(vals[j]),xx+6,yy+(j===1?14:17));xx+=widths[j]}yy+=54})}drawBox('5 NAJLEPSZYCH STANOWISK',best,xs[0],'#e4f2e8','#bfe8c9');drawBox('5 NAJGORSZYCH STANOWISK',worst,xs[1],'#fff0d9','#ffd39a');return o.canvas}
function generateResultsPdfV33(round){const d=CURRENT_DETAIL;if(!d)return;const pages=[];if(Number(round)===1||Number(round)===2){const rr=sortRowsBySectorPlace(Number(round)===1?d.classification.round1:d.classification.round2),context='KLASYFIKACJA TURY '+round,headers=['Lp.','Zawodnik','Stan.','Sektor','Miejsce','Waga'],rows=rr.map((r,i)=>[i+1,r.name,r.stand||'—',r.sector||'—',placeText(r.points),pdfResultWeight(r,false)]),widths=[60,430,120,110,130,298],ranks=rr.map(r=>r.points);pages.push(...makePdfTablePages(context,headers,rows,widths,ranks))}else{const rr=d.classification.general||[],headers=['Msc','Zawodnik','T1','T2','Suma','Waga'],rows=rr.map(r=>[r.rank,r.name+(SHOW_FINAL_CLUB&&r.pzw_club?' • '+r.pzw_club:''),placeText(r.t1_points),placeText(r.t2_points),placeText(r.sum_points),pdfResultWeight(r,true)]),widths=[70,480,100,100,130,268],ranks=rr.map(r=>r.rank);pages.push(...makePdfTablePages('KLASYFIKACJA KOŃCOWA',headers,rows,widths,ranks))}if(pages.length)downloadPdfPages(pages,'wyniki_'+pdfSafeName(d.competition.title)+'_'+(Number(round)===0?'general':'T'+round)+'.pdf')}
function drawStartListPdfPage(rows){const o=pdfCanvas(2),ctx=o.ctx;let y=drawPdfHeaderV33(ctx,'LISTA STARTOWA ZAWODNIKÓW'),x0=36,widths=[62,408,176,150,150,222],total=widths.reduce((a,b)=>a+b,0),headH=52;ctx.fillStyle='#e5efe8';ctx.fillRect(x0,y,total,headH);ctx.strokeStyle='#8ea99a';ctx.lineWidth=1;ctx.font='800 15px Arial';let x=x0;['Lp.','Zawodnik','Potwierdzenie ✓','Wpisowe','Koszyk +','Uwagi'].forEach((h,i)=>{ctx.strokeRect(x,y,widths[i],headH);ctx.fillStyle='#173d2e';ctx.fillText(h,x+7,y+16);x+=widths[i]});y+=headH;const count=Math.max(1,rows.length),available=1698-y,rowH=Math.min(56,available/count),fontSize=Math.min(23,rowH*0.48);for(let r=0;r<rows.length;r++){x=x0;for(let i=0;i<widths.length;i++){ctx.fillStyle='#fff';ctx.fillRect(x,y,widths[i],rowH);ctx.strokeStyle='#aebfb4';ctx.strokeRect(x,y,widths[i],rowH);ctx.fillStyle='#14251b';ctx.font=(i===0||i===1?'800 ':'600 ')+fontSize+'px Arial';const txt=String(rows[r][i]??'');const startY=y+(rowH-fontSize)/2;ctx.fillText(txt,x+7,startY,widths[i]-14);x+=widths[i]}y+=rowH}return o.canvas}
function generateStartListPdf(){const d=CURRENT_DETAIL;if(!d)return;const rows=(d.activeEntries||[]).map((e,i)=>[i+1,e.first_name+' '+e.last_name,e.confirmed?'✓':'','','','']);downloadPdfPages([drawStartListPdfPage(rows)],'lista_startowa_'+pdfSafeName(d.competition.title)+'.pdf')}
function notifData(n){return n&&n.data&&typeof n.data==='object'?n.data:{}}
function notificationStatusHtml(n){const data=notifData(n);if(ME?.role==='ADMIN'&&String(n.type)==='LEAVE_REQUEST'){const status=String(data.status||'PENDING').toUpperCase();if(status==='PENDING')return '<div class="leaveRequestActions"><button type="button" onclick="decideLeaveRequest('+Number(data.requestId||0)+',\'approve\','+n.id+')">Akceptuj</button><button type="button" class="warn" onclick="decideLeaveRequest('+Number(data.requestId||0)+',\'reject\','+n.id+')">Odrzuć</button></div>';if(status==='APPROVED')return '<span class="tag ok">Zaakceptowano</span>';if(status==='REJECTED')return '<span class="tag bad">Odrzucono</span>'}return n.read_at?'Przecz.':'<button type="button" onclick="readNotif('+n.id+')">OK</button>'}
let ADMIN_NOTIFICATION_TAB='requests';
let NOTIFICATION_CACHE=[];
let ADMIN_PENDING_REQUESTS=[];
function setAdminNotificationTab(tab){
  if(!['requests','all'].includes(tab))return;
  ADMIN_NOTIFICATION_TAB=tab;renderNotificationContent();
}
window.setAdminNotificationTab=setAdminNotificationTab;
function renderNotificationContent(){
  const arr=NOTIFICATION_CACHE,admin=ME?.role==='ADMIN';
  const actions='<div class="notificationBulkActions"><button type="button" onclick="confirmAllNotifications()">✓ Potwierdź wszystkie</button><button type="button" class="warn" onclick="deleteAllNotifications()">Usuń powiadomienia</button></div>';
  const tabs=admin?'<div class="adminNotificationTabs" role="tablist"><button type="button" role="tab" aria-selected="'+(ADMIN_NOTIFICATION_TAB==='requests')+'" onclick="setAdminNotificationTab(\'requests\')">Prośby o wypisanie <b class="pendingLeaveBadge">'+ADMIN_PENDING_REQUESTS.length+'</b></button><button type="button" role="tab" aria-selected="'+(ADMIN_NOTIFICATION_TAB==='all')+'" onclick="setAdminNotificationTab(\'all\')">Pozostałe powiadomienia</button></div>':'';
  if(admin&&ADMIN_NOTIFICATION_TAB==='requests'){
    q('notificationsList').innerHTML=tabs+'<p>Prośby pozostają tutaj do zatwierdzenia lub odrzucenia.</p>'+(ADMIN_PENDING_REQUESTS.length?ADMIN_PENDING_REQUESTS.map(r=>'<article class="pendingLeaveCard"><strong>'+esc(r.first_name+' '+r.last_name)+'</strong><div>'+esc(r.title)+' · '+fmtDate(r.competition_date)+'</div><small>'+new Date(r.created_at).toLocaleString('pl-PL')+'</small><div class="leaveRequestActions"><button type="button" onclick="decideLeaveRequest('+Number(r.id)+',\'approve\')">Zatwierdź wypisanie</button><button type="button" class="warn" onclick="decideLeaveRequest('+Number(r.id)+',\'reject\')">Odrzuć</button></div></article>').join(''):'<p>Brak oczekujących próśb o wypisanie.</p>');return;
  }
  const visible=admin?arr.filter(n=>n.type!=='LEAVE_REQUEST'||String(notifData(n).status||'PENDING').toUpperCase()!=='PENDING'):arr;
  q('notificationsList').innerHTML=tabs+actions+(visible.length?'<div class="tablewrap notificationWrap"><table class="notificationTable"><thead><tr><th>Zdarzenie</th><th>Czas</th><th>Status / decyzja</th></tr></thead><tbody>'+visible.map(n=>'<tr class="'+(!n.read_at?'mine':'')+'"><td><b>'+esc(n.title)+'</b><br>'+esc(n.body)+'</td><td class="nowrap small">'+new Date(n.created_at).toLocaleString('pl-PL')+'</td><td>'+notificationStatusHtml(n)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="muted">Brak powiadomień.</p>');
}
async function loadNotifications(){
  if(ME?.role==='JUDGE')return;
  if(!ME)return;
  const d=await api('/api/notifications');
  NOTIFICATION_CACHE=d.notifications||[];ADMIN_PENDING_REQUESTS=d.pendingLeaveRequests||[];
  const unread=NOTIFICATION_CACHE.filter(n=>!n.read_at).length;
  PLAYER_UNREAD_NOTIFICATIONS=unread;
  if(ME.role==='PLAYER')await refreshPlayerAttention(false);
  const displayCount=ME.role==='PLAYER'?PLAYER_ATTENTION.count:unread;
  const counter=q('notifCounter');if(counter)counter.textContent=ME.role==='ADMIN'&&ADMIN_PENDING_REQUESTS.length?'Prośby o wypisanie: '+ADMIN_PENDING_REQUESTS.length:(displayCount?(ME.role==='PLAYER'?'🔴 '+displayCount+' do sprawdzenia':'🔔 '+displayCount):'');
  syncNotificationBadges(displayCount);
  const top=q('btn-notifications');if(top){top.querySelector('.pendingLeaveTopBadge')?.remove();if(ME.role==='ADMIN'&&ADMIN_PENDING_REQUESTS.length){const badge=document.createElement('b');badge.className='pendingLeaveTopBadge';badge.textContent='Wypisanie: '+ADMIN_PENDING_REQUESTS.length;top.appendChild(badge)}}
  renderNotificationContent();
}

async function confirmAllNotifications(){try{const path=ME?.role==='ADMIN'?'/api/admin/notifications/read-all':'/api/notifications/read-all';const d=await api(path,{method:'POST',body:'{}'});msg('Potwierdzono powiadomienia: '+Number(d.updated||0));await loadNotifications()}catch(e){msg(e.message,'bad')}}
async function deleteAllNotifications(){try{const admin=ME?.role==='ADMIN';const question=admin?'Usunąć wszystkie zwykłe i zakończone powiadomienia? Oczekujące prośby o wypisanie pozostaną.':'Usunąć wszystkie swoje powiadomienia?';if(!confirm(question))return;const path=admin?'/api/admin/notifications':'/api/notifications';const d=await api(path,{method:'DELETE',body:'{}'});msg('Usunięto powiadomienia: '+Number(d.deleted||0)+(Number(d.keptPending||0)?'. Oczekujące prośby: '+Number(d.keptPending):''));await loadNotifications()}catch(e){msg(e.message,'bad')}}
async function decideLeaveRequest(requestId,decision,notifId){try{if(!requestId)throw new Error('Brak identyfikatora prośby');const approve=decision==='approve';if(!confirm(approve?'Zaakceptować prośbę i wypisać zawodnika z zawodów?':'Odrzucić prośbę o wypisanie?'))return;const out=await api('/api/admin/leave-requests/'+requestId+'/'+(approve?'approve':'reject'),{method:'POST',body:'{}'});msg(approve?'Zawodnik został wypisany':'Prośba została odrzucona');await loadNotifications();await loadCompetitions();if(CURRENT_DETAIL?.competition?.id==out.competitionId)await refreshCompetitionKeepScroll(out.competitionId)}catch(e){msg(e.message,'bad')}}
async function readNotif(id){await api('/api/notifications/'+id+'/read',{method:'POST',body:'{}'});await loadNotifications();if(ME?.role==='PLAYER'){await refreshPlayerAttention(false);renderPlayerCompetitionList()}}
async function editPlayerName(id,currentName){if(!ME||ME.role!=='ADMIN')return;const before=String(currentName||'').replace(/\s+/g,' ').trim();const entered=prompt('Popraw imię i nazwisko zawodnika:',before);if(entered===null)return;const fullName=String(entered||'').replace(/\s+/g,' ').trim();if(!fullName){msg('Imię i nazwisko nie może być puste','bad');return}if(fullName===before)return;try{const d=await api('/api/admin/players/'+Number(id),{method:'PATCH',body:JSON.stringify({fullName})});msg('Poprawiono nazwę zawodnika: '+(d.player?.name||fullName));await loadPlayers();if(CURRENT_DETAIL?.competition?.id)await refreshCompetitionKeepScroll(CURRENT_DETAIL.competition.id)}catch(e){msg(e.message,'bad')}}
function playerInfoBadges(p){let out='';if(p.has_logged_in)out+='<span class="playerAccountBadge playerAccountVerified" title="Zawodnik zalogował się w aplikacji">V</span>';if(String(p.account_source||'SELF').toUpperCase()==='ADMIN')out+='<span class="playerAccountBadge playerAccountAdmin" title="Zawodnik dodany przez administratora">A</span>';return out||'<span class="muted">—</span>'}
async function deletePlayer(id,name){if(!ME||ME.role!=='ADMIN')return;const label=String(name||'zawodnika');if(!confirm('Usunąć zawodnika '+label+'?\n\nUsunięte zostaną także jego zapisy, losowania, wyniki i powiadomienia.'))return;try{const d=await api('/api/admin/players/'+Number(id),{method:'DELETE',body:'{}'});msg('Usunięto zawodnika: '+(d.player?.name||label));await loadPlayers();await loadCompetitions();if(CURRENT_DETAIL?.competition?.id)await refreshCompetitionKeepScroll(CURRENT_DETAIL.competition.id)}catch(e){msg(e.message,'bad')}}
async function deleteAllAdminPlayers(count){if(!ME||ME.role!=='ADMIN')return;const n=Number(count||0);if(n<1){msg('Brak zawodników oznaczonych A.');return}if(!confirm('Usunąć WSZYSTKICH zawodników oznaczonych A?\n\nLiczba zawodników: '+n+'\n\nZostaną usunięte także ich zapisy, losowania, wyniki, powiadomienia i dane PUSH. Tej operacji nie można cofnąć.'))return;try{const d=await api('/api/admin/players/admin-added',{method:'DELETE',body:'{}'});msg('Usunięto zawodników A: '+Number(d.deleted||0));await loadPlayers();await loadCompetitions();if(CURRENT_DETAIL?.competition?.id)await refreshCompetitionKeepScroll(CURRENT_DETAIL.competition.id)}catch(e){msg(e.message,'bad')}}
async function loadPlayers(){if(!ME||ME.role!=='ADMIN')return;const d=await api('/api/admin/players');const adminAdded=d.players.filter(p=>String(p.account_source||'SELF').toUpperCase()==='ADMIN').length;const legend='<div class="playerAccountTop"><div class="playerAccountLegend"><span><b class="playerAccountBadge playerAccountVerified">V</b> zalogował się w aplikacji</span><span><b class="playerAccountBadge playerAccountAdmin">A</b> dodany przez admina</span></div><button type="button" class="warn playerDeleteAllAdminBtn" '+(adminAdded?'':'disabled')+' onclick="deleteAllAdminPlayers('+adminAdded+')">Usuń wszystkich A ('+adminAdded+')</button></div>';const desktop='<div class="tablewrap adminDesktopOnly"><table class="adminPlayersTable"><thead><tr><th style="width:46px">Lp.</th><th>Imię i nazwisko</th><th style="width:82px">Info</th><th>Telefon</th><th>Koło PZW</th><th>Aktywne zapisy</th><th style="width:150px">Akcja</th></tr></thead><tbody>'+d.players.map((p,i)=>{const name=String((p.first_name||'')+' '+(p.last_name||'')).trim();const safeName=encodeURIComponent(name);return '<tr><td class="center"><b>'+(i+1)+'</b></td><td><b>'+esc(name)+'</b></td><td class="playerBadgeCell">'+playerInfoBadges(p)+'</td><td class="nowrap">'+renderPhoneCall(p.phone)+'</td><td>'+esc(p.pzw_club)+'</td><td class="center">'+esc(p.active_entries||0)+'</td><td><div class="inlineBtns playerManageBtns"><button type="button" class="secondary" onclick="editPlayerName('+Number(p.id)+',decodeURIComponent(\''+safeName+'\'))">Edytuj</button><button type="button" class="warn playerDeleteBtn" onclick="deletePlayer('+Number(p.id)+',decodeURIComponent(\''+safeName+'\'))">Usuń</button></div></td></tr>'}).join('')+'</tbody></table></div>';const mobile='<div class="adminMobileOnly mobilePlayersList">'+d.players.map((p,i)=>{const name=String((p.first_name||'')+' '+(p.last_name||'')).trim();const safeName=encodeURIComponent(name);return '<article class="mobileAdminCard mobilePlayerManageCard"><div class="mobileAdminCardHead"><span class="mobileLp">'+(i+1)+'</span><b>'+esc(name)+'</b><span class="mobilePlayerBadges">'+playerInfoBadges(p)+'</span></div><div class="mobileAdminMeta"><span><small>Koło</small><b>'+esc(p.pzw_club||'—')+'</b></span><span><small>Zapisy</small><b>'+esc(p.active_entries||0)+'</b></span></div><div class="mobileAdminLine mobilePhoneLine"><small>Telefon</small><span>'+renderPhoneCall(p.phone,'mobilePhoneCallBtn')+'</span></div><div class="mobilePlayerManageActions"><button type="button" class="secondary" onclick="editPlayerName('+Number(p.id)+',decodeURIComponent(\''+safeName+'\'))">Edytuj nazwę</button><button type="button" class="warn playerDeleteBtn mobilePlayerDeleteBtn" onclick="deletePlayer('+Number(p.id)+',decodeURIComponent(\''+safeName+'\'))">Usuń zawodnika</button></div></article>'}).join('')+'</div>';q('playersList').innerHTML=legend+desktop+mobile}
function urlBase64ToUint8Array(base64String){const padding='='.repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base64);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;++i)out[i]=raw.charCodeAt(i);return out}
async function getPushConfig(force=false){if(PUSH_CONFIG&&!force)return PUSH_CONFIG;PUSH_CONFIG=await api('/api/config');return PUSH_CONFIG}
function pushUiLabel(){if(!('Notification'in window))return 'Alerty niedostępne';if(Notification.permission==='denied')return 'Alerty zablokowane';if(Notification.permission==='granted'&&PUSH_SUBSCRIBED)return 'Test alertu';return 'Włącz alerty telefonu'}
function renderPushStatus(){
  const legacy=q('pushStatus');if(legacy)legacy.innerHTML='';
  const state=q('notifPushState');
  const btn=q('notifPushBtn');
  const pbtn=q('playerPushBtn');
  let label='Alerty telefonu: wyłączone';
  if('Notification'in window){if(Notification.permission==='granted')label=PUSH_SUBSCRIBED?'Alerty telefonu: włączone':'Alerty telefonu: gotowe do włączenia';else if(Notification.permission==='denied')label='Alerty telefonu: zablokowane w przeglądarce'}
  if(state)state.textContent=label;
  if(btn)btn.textContent=pushUiLabel();
  if(pbtn)pbtn.textContent=pushUiLabel();
}
async function ensurePushSubscription(silent=false,sendTest=false){
  if(!('Notification'in window)||!('serviceWorker'in navigator)||!('PushManager'in window)){
    if(!silent){const isiPhone=/iPhone|iPad|iPod/i.test(navigator.userAgent);msg(isiPhone?'Na iPhone alerty działają po dodaniu strony do ekranu początkowego.':'Ta przeglądarka nie obsługuje powiadomień telefonu.','bad')}
    renderPushStatus();return false;
  }
  const cfg=await getPushConfig(true);
  if(!cfg.pushReady||!cfg.vapidPublicKey){if(!silent)msg('Serwer powiadomień nie jest jeszcze gotowy.','bad');renderPushStatus();return false}
  let permission=Notification.permission;
  if(permission==='default'&&!silent)permission=await Notification.requestPermission();
  if(permission!=='granted'){if(!silent)msg(permission==='denied'?'Powiadomienia są zablokowane w ustawieniach tej strony.':'Nie włączono powiadomień telefonu.','bad');renderPushStatus();return false}
  const reg=await navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'});
  await navigator.serviceWorker.ready;
  let sub=await reg.pushManager.getSubscription();
  if(sub&&sendTest){await sub.unsubscribe().catch(()=>{});sub=null}
  if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(cfg.vapidPublicKey)});
  await api('/api/push-subscription',{method:'POST',body:JSON.stringify({subscription:sub.toJSON?sub.toJSON():sub})});
  PUSH_SUBSCRIBED=true;renderPushStatus();
  if(sendTest){const t=await api('/api/push-test',{method:'POST',body:'{}'});if(!silent)msg(t.sent?'Wysłano testowe powiadomienie na telefon.':'Subskrypcja zapisana, ale test nie został dostarczony.',t.sent?'ok':'bad')}
  return true;
}
async function disablePushSubscription(unregister=false){
  try{if(TOKEN)await api('/api/push-subscription',{method:'DELETE',body:'{}'}).catch(()=>{});if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.getRegistration('/');if(reg){const sub=await reg.pushManager.getSubscription();if(sub)await sub.unsubscribe().catch(()=>{});if(unregister)await reg.unregister().catch(()=>{})}}}finally{PUSH_SUBSCRIBED=false;renderPushStatus()}
}
async function resetPush(){try{await disablePushSubscription(false);msg('Alerty telefonu wyłączone.');}catch(e){msg(e.message,'bad')}}
async function enablePush(ev){if(ev){ev.preventDefault();ev.stopPropagation()}try{await ensurePushSubscription(false,true)}catch(e){msg('Nie udało się włączyć alertów: '+(e.message||e),'bad');renderPushStatus()}}
async function sendPushTest(ev){return enablePush(ev)}
function scrollAppTop(){window.scrollTo({top:0,behavior:'smooth'})}

function syncStickyNavOffset(){const header=document.querySelector('header');const h=header?Math.ceil(header.getBoundingClientRect().height):52;document.documentElement.style.setProperty('--app-header-height',h+'px')}
let ADMIN_NAV_RAF=0;
function syncFixedAdminNav(){
  if(ADMIN_NAV_RAF){cancelAnimationFrame(ADMIN_NAV_RAF);ADMIN_NAV_RAF=0}
  ADMIN_NAV_RAF=requestAnimationFrame(()=>{
    ADMIN_NAV_RAF=0;
    const slot=document.querySelector('.workZoneTabsSlot'),tabs=document.querySelector('.workZoneTabs'),detail=q('competitionDetail');
    if(!slot||!tabs||!detail||detail.classList.contains('hidden')||ME?.role!=='ADMIN'){
      if(tabs){tabs.classList.remove('fixedAdminNav');tabs.style.left='';tabs.style.width='';tabs.style.top=''}
      if(slot)slot.style.height='';
      return;
    }
    const top=0;
    const slotRect=slot.getBoundingClientRect(),detailRect=detail.getBoundingClientRect();
    const tabH=Math.ceil(tabs.getBoundingClientRect().height||tabs.offsetHeight||44);
    /* V94: desktop jest niższy niż mobile, więc wcześniejszy warunek detailRect.bottom
       potrafił odpiąć kafelki za wcześnie. Na komputerze po dojściu do góry pasek
       zostaje przypięty aż do zamknięcia szczegółów zawodów. Mobile bez zmian. */
    const desktop=window.innerWidth>=761;
    const shouldFix=slotRect.top<=top && (desktop || detailRect.bottom>top+tabH+6);
    if(shouldFix){
      slot.style.height=tabH+'px';
      tabs.classList.add('fixedAdminNav');
      const r=slot.getBoundingClientRect();
      tabs.style.left=Math.round(r.left)+'px';
      tabs.style.width=Math.round(r.width)+'px';
      tabs.style.top=top+'px';
    }else{
      tabs.classList.remove('fixedAdminNav');
      tabs.style.left='';
      tabs.style.width='';
      tabs.style.top='';
      slot.style.height='';
    }
  });
}
window.addEventListener('scroll',syncFixedAdminNav,{passive:true});

window.addEventListener('resize',()=>{clearTimeout(window.__stickySyncTimer);window.__stickySyncTimer=setTimeout(()=>{syncStickyNavOffset();syncFixedAdminNav()},80)},{passive:true});

let PLAYER_STICKY_RAF=0;
function clearPlayerFixed(el,slot){
  if(el){
    el.classList.remove('fixedPlayerBar');
    el.style.left='';
    el.style.right='';
    el.style.width='';
    el.style.top='';
  }
  if(slot)slot.style.height='';
}
function getPlayerStickyTop(){
  const header=document.querySelector('header');
  if(!header)return 0;
  const r=header.getBoundingClientRect();
  return Math.max(0,Math.ceil(r.bottom));
}
function syncOnePlayerBar(slot,bar,boundary){
  if(!slot||!bar||!boundary){clearPlayerFixed(bar,slot);return}
  const top=window.matchMedia('(min-width:761px)').matches?getPlayerStickyTop():0;
  const slotRect=slot.getBoundingClientRect();
  const boundaryRect=boundary.getBoundingClientRect();
  const wasFixed=bar.classList.contains('fixedPlayerBar');
  if(wasFixed){
    bar.classList.remove('fixedPlayerBar');
    bar.style.left='';bar.style.width='';bar.style.top='';
  }
  const barH=Math.ceil(bar.getBoundingClientRect().height||bar.offsetHeight||44);
  const shouldFix=slotRect.top<=top && (window.matchMedia('(min-width:761px)').matches||boundaryRect.bottom>top+barH+6);
  if(shouldFix){
    slot.style.setProperty('height',barH+'px','important');
    bar.classList.add('fixedPlayerBar');
    const r=slot.getBoundingClientRect();
    bar.style.left=Math.round(r.left)+'px';
    bar.style.width=Math.round(r.width)+'px';
    bar.style.top=top+'px';
    bar.style.setProperty('--desktop-nav-top',top+'px');bar.style.setProperty('--desktop-nav-left',Math.round(r.left)+'px');bar.style.setProperty('--desktop-nav-width',Math.round(r.width)+'px');
  }else{
    clearPlayerFixed(bar,slot);
  }
}
function syncPlayerStickyBars(){
  if(PLAYER_STICKY_RAF){cancelAnimationFrame(PLAYER_STICKY_RAF);PLAYER_STICKY_RAF=0}
  PLAYER_STICKY_RAF=requestAnimationFrame(()=>{
    PLAYER_STICKY_RAF=0;
    const mobile=window.matchMedia&&window.matchMedia('(max-width:760px)').matches;
    const player=ME&&ME.role!=='ADMIN';
    const detail=q('competitionDetail');
    const top=getPlayerStickyTop();
    const mobileSlot=document.querySelector('.playerMobileDashboard .playerDrawStickySlot');
    const mobileBar=document.querySelector('.playerMobileDashboard .playerUnifiedNav');
    const mobileBoundary=document.querySelector('.playerMobileDashboard');
    const desktopSlot=document.querySelector('.playerDesktopDashboardV56 .playerDesktopStickySlot');
    const desktopBar=document.querySelector('.playerDesktopDashboardV56 .playerDesktopUnifiedNav');
    const desktopBoundary=document.querySelector('.playerDesktopDashboardV56');
    if(!player||!detail||detail.classList.contains('hidden')||q('tab-competitions')?.classList.contains('hidden')){
      clearPlayerFixed(mobileBar,mobileSlot);clearPlayerFixed(desktopBar,desktopSlot);return;
    }
    if(mobile){
      clearPlayerFixed(desktopBar,desktopSlot);
      syncOnePlayerBar(mobileSlot,mobileBar,mobileBoundary);
    }else{
      clearPlayerFixed(mobileBar,mobileSlot);
      syncOnePlayerBar(desktopSlot,desktopBar,desktopBoundary);
    }
  });
}
window.addEventListener('scroll',syncPlayerStickyBars,{passive:true});
window.addEventListener('resize',()=>{clearTimeout(window.__playerStickyResize);window.__playerStickyResize=setTimeout(()=>{syncPlayerStickyBars();fitPlayerMobileFullMaps()},60)},{passive:true});

function bindAuthButtons(){
  const pairs=[['clearSessionBtn',clearSession],['regBtn',registerPlayer],['setupAdminBtn',setupAdmin],['pushBtn',enablePush],['logoutBtn',logout]];
  for(const [id,fn] of pairs){const el=q(id);if(el&&!el.dataset.bound){el.dataset.bound='1';el.onclick=null;el.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();fn(ev);});}}
  ['loginPhone','loginPassword'].forEach(id=>{const el=q(id);if(el&&!el.dataset.enterLogin){el.dataset.enterLogin='1';el.addEventListener('keydown',ev=>{if(ev.key==='Enter')login(ev);});}});
}

function scrollAppBottom(){window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'})}
Object.assign(window,{boot,login,registerPlayer,setupAdmin,logout,showTab,loadPlayerHistory,openHistoryCompetition,openCompetitionAttention,judgeCancelPending,saveGeneralRules,closePlayerCompetition,showAdminZone,loadCompetitions,createCompetition,openCompetitionEdit,deleteCompetition,joinComp,leaveComp,openCompetition,saveCompetition,drawRound,publishDraw,resetDraw,saveResults,generateResults,generateResultsAll,clearResults,addWeightItem,deleteWeightItem,notifyResults,readNotif,confirmAllNotifications,deleteAllNotifications,decideLeaveRequest,loadNotifications,loadPlayers,editPlayerName,deletePlayer,deleteAllAdminPlayers,saveMyProfile,setPlayerCompetitionFilter,setPlayerCompetitionMonth,confirmPlayerPresence,enablePush,sendPushTest,resetPush,clearSession,importZawodyPro,addManualPlayer,setEntryStatus,toggleEntryConfirm,setupStructureAuto,autoFillBanksFromRoster,updateStructurePreview,sectorCardsChanged,resetSectorLayout,scrollAppTop,scrollAppBottom,showPlayerDraw,showPlayerResults,showPlayerMobilePanel,setPlayerDrawView,openPlayerNotifications,fitPlayerMobileFullMaps,togglePlayerSectorAccordion,toggleFinalClub,generatePhotoResultSheetPdf,startPhotoResultImport,closePhotoImportReview,commitPhotoResultImport,generateDrawPdf,generateResultsPdfV33,generateStartListPdf});
function hideBootGuard(){const g=q('bootGuard');if(g)g.classList.add('hidden');try{sessionStorage.removeItem('lowcy_update_retry_138');sessionStorage.removeItem('lowcy_update_retry_102')}catch(_){}}
let BOOT_RUNNING=false;
function startBoot(){if(BOOT_RUNNING)return;BOOT_RUNNING=true;window.__LOWCY_JS_STARTED=true;try{syncStickyNavOffset();bindAuthButtons()}catch(e){console.error(e)}const guard=q('bootGuard');if(guard){guard.classList.remove('hidden');const text=guard.querySelector('span');if(text)text.textContent='Łączę z aplikacją…';q('bootRetry')?.classList.add('hidden')}boot().then(()=>{window.__LOWCY_BOOT_OK_138=1;for(const script of document.querySelectorAll('script[src*="/app.js"]')){const version=new URL(script.src,location.href).searchParams.get('v');if(version)window['__LOWCY_BOOT_OK_'+version]=1}hideBootGuard()}).catch(e=>{console.error('BOOT_FATAL',e);if(guard){guard.classList.remove('hidden');const text=guard.querySelector('span');if(text)text.textContent=e.message||'Nie udało się połączyć.';q('bootRetry')?.classList.remove('hidden')}}).finally(()=>{BOOT_RUNNING=false})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startBoot);else startBoot();

let JUDGE_VIEW='competitions',JUDGE_ROUND=1,JUDGE_COMPETITIONS=[],JUDGE_MANAGEMENT=null;
function mountJudgeShell(){
  document.body.classList.add('judgeTheme');document.body.classList.remove('playerTheme','authMode');
  stopAchievements();stopPlayerResultPolling();CURRENT_DETAIL=null;
  q('competitionDetail').innerHTML='';
  let shell=q('judgeShell');if(!shell){shell=document.createElement('section');shell.id='judgeShell';q('app').appendChild(shell)}
  shell.innerHTML='<nav class="judgeMenu" aria-label="Menu sędziego"><button type="button" onclick="judgeNavigate(\'competitions\')">📅<span>Zawody</span></button><button type="button" id="judge-entry" onclick="judgeNavigate(\'entry\')">⚖️<span>Wpisz wyniki</span></button><button type="button" id="judge-results" onclick="judgeNavigate(\'results\')">🏆<span>Wyniki</span></button></nav><div id="judgeWork"></div>';
  q('who').textContent=ME.first_name+' '+ME.last_name;q('role').textContent='Sędzia wagowy';JUDGE_VIEW='competitions';
}
async function judgeLoadCompetitions(){
  if(!navigator.onLine){JUDGE_COMPETITIONS=judgeCachedCompetitions();if(!JUDGE_COMPETITIONS.length)msg('Brak połączenia i brak zapisanej listy zawodów. Otwórz zawody raz z internetem przed startem.','bad');renderJudgeWork();return}
  try{const d=await api('/api/competitions');JUDGE_COMPETITIONS=d.competitions||[];judgeCacheCompetitions(JUDGE_COMPETITIONS)}
  catch(e){JUDGE_COMPETITIONS=judgeCachedCompetitions();if(!JUDGE_COMPETITIONS.length)msg('Brak połączenia i brak zapisanej listy zawodów.','bad')}
  renderJudgeWork();
}
async function judgeOpenCompetition(id){
  if(!navigator.onLine){CURRENT_DETAIL=judgeCachedDetail(id);if(!CURRENT_DETAIL){msg('Brak zapisanych danych tych zawodów. Otwórz je raz z internetem przed startem.','bad');return false}}
  else try{CURRENT_DETAIL=await api('/api/competitions/'+id);judgeCacheDetail(CURRENT_DETAIL)}
  catch(e){CURRENT_DETAIL=judgeCachedDetail(id);if(!CURRENT_DETAIL){msg('Nie udało się pobrać ani znaleźć zapisanych danych tych zawodów.','bad');return false}}
  JUDGE_VIEW='entry';JUDGE_ROUND=1;renderJudgeWork();scrollAppTop();if(navigator.onLine)flushJudgeQueue(true).catch(()=>{});return true;
}
async function judgeNavigate(view){
  if(view!=='competitions'&&!CURRENT_DETAIL)return;
  if(view==='competitions'){JUDGE_VIEW=view;await judgeLoadCompetitions();scrollAppTop();return}
  const id=Number(CURRENT_DETAIL.competition.id);
  if(!navigator.onLine){const cached=judgeCachedDetail(id);if(cached)CURRENT_DETAIL=cached;else{msg('Brak zapisanych danych zawodów.','bad');return}}
  else try{CURRENT_DETAIL=await api('/api/competitions/'+id);judgeCacheDetail(CURRENT_DETAIL)}
  catch(e){const cached=judgeCachedDetail(id);if(cached)CURRENT_DETAIL=cached;else{msg('Brak połączenia i brak zapisanych danych zawodów.','bad');return}}
  JUDGE_VIEW=view;renderJudgeWork();scrollAppTop();
}
function judgeChooseRound(round){JUDGE_ROUND=Number(round)===2?2:1;renderJudgeWork()}
function renderJudgeWork(){
  const box=q('judgeWork');if(!box)return;
  q('judge-entry').disabled=!CURRENT_DETAIL;q('judge-results').disabled=!CURRENT_DETAIL;
  document.querySelectorAll('.judgeMenu button').forEach((b,i)=>{const active=['competitions','entry','results'][i]===JUDGE_VIEW;b.classList.toggle('active',active);b.setAttribute('aria-current',active?'page':'false')});
  if(JUDGE_VIEW==='competitions'){
    box.innerHTML='<h2>Wybierz zawody</h2><p>Wybierz zawody, w których ważysz ryby.</p>'+(JUDGE_COMPETITIONS.length?'<div class="judgeCompetitionGrid">'+JUDGE_COMPETITIONS.map(c=>'<button type="button" class="judgeCompetitionCard" onclick="judgeOpenCompetition('+Number(c.id)+')"><strong>'+esc(c.title)+'</strong><span>📅 '+fmtDate(c.competition_date)+'</span><span>📍 '+esc(c.fishery||'')+'</span><b>Otwórz →</b></button>').join('')+'</div>':'<div class="card">Nie masz jeszcze przypisanych zawodów. Administrator nada Ci dostęp.</div>');return;
  }
  const d=CURRENT_DETAIL,c=d.competition;
  const heading='<div class="judgeEventHeading"><h2>'+esc(c.title)+'</h2><span>'+fmtDate(c.competition_date)+' · '+esc(c.fishery||'')+'</span></div>';
  if(JUDGE_VIEW==='entry')box.innerHTML=heading+judgeQueueStatus()+'<div class="judgeRoundTabs"><button type="button" class="judgeT1 '+(JUDGE_ROUND===1?'active':'')+'" aria-pressed="'+(JUDGE_ROUND===1)+'" onclick="judgeChooseRound(1)">Tura 1</button><button type="button" class="judgeT2 '+(JUDGE_ROUND===2?'active':'')+'" aria-pressed="'+(JUDGE_ROUND===2)+'" onclick="judgeChooseRound(2)">Tura 2</button></div><div class="card judgeEntryRound'+JUDGE_ROUND+'"><h2>Wpisz wagę — Tura '+JUDGE_ROUND+'</h2><p>Wagi podawaj w gramach. Wpisz wagę i naciśnij Enter lub dotknij poza polem — zapis i przeliczenie są automatyczne. Błędny wpis usuniesz krzyżykiem.</p>'+renderResultForm(d,JUDGE_ROUND)+'</div>';
  else box.innerHTML=heading+'<button type="button" class="secondary" onclick="judgeNavigate(\'results\')">↻ Odśwież wyniki</button>'+renderSectorResultsBoard(d)+'<div class="card"><h2>Klasyfikacja T1</h2>'+renderClassTable(d.classification.round1)+'<h2>Klasyfikacja T2</h2>'+renderClassTable(d.classification.round2)+'<h2>Klasyfikacja generalna</h2>'+renderGeneralTable(d.classification.general)+'</div>';
}
async function loadJudgeManagement(){
  if(ME?.role!=='ADMIN')return;
  if(!q('adminQuickActions')){const bar=document.createElement('div');bar.id='adminQuickActions';bar.innerHTML='<button type="button" aria-controls="adminCreate" aria-expanded="false" onclick="toggleAdminQuickPanel(\'adminCreate\',this)">Robimy zawody</button><button type="button" aria-controls="judgeManagement" aria-expanded="false" onclick="toggleAdminQuickPanel(\'judgeManagement\',this)">⚖️ Sędziowie wagowi</button>';q('adminCreate').before(bar)}
  let root=q('judgeManagement');if(!root){root=document.createElement('details');root.id='judgeManagement';root.className='card';root.innerHTML='<summary>⚖️ Sędziowie wagowi</summary><div id="judgeManagementBody"></div>';q('adminCreate').after(root);root.addEventListener('toggle',()=>{if(root.open)refreshJudgeManagement()})}
}
async function refreshJudgeManagement(){
  try{JUDGE_MANAGEMENT=await api('/api/admin/judges');renderJudgeManagement()}catch(e){q('judgeManagementBody').textContent=e.message}
}
function judgeAssignmentChoices(selected){const ids=new Set((selected||[]).map(Number));return JUDGE_MANAGEMENT.competitions.map(c=>'<label class="judgeAssignment"><input type="checkbox" name="competitionIds" value="'+Number(c.id)+'" '+(ids.has(Number(c.id))?'checked':'')+'><span>'+esc(c.title)+' · '+fmtDate(c.competition_date)+'</span></label>').join('')||'<p>Najpierw utwórz zawody. Konto może na razie pozostać bez przypisania.</p>'}
function judgeAccountFields(j){return '<div class="grid"><label>Imię<input name="firstName" required value="'+esc(j.first_name||'')+'" autocomplete="off"></label><label>Nazwisko<input name="lastName" required value="'+esc(j.last_name||'')+'" autocomplete="off"></label><label>Telefon — login<input name="phone" type="tel" required value="'+esc(j.phone||'')+'" autocomplete="off"></label><label>'+(!j.id?'Hasło (minimum 8 znaków)':'Nowe hasło (zostaw puste, aby zachować)')+'<input name="password" type="password" minlength="8" maxlength="128" '+(!j.id?'required':'')+' autocomplete="new-password"></label></div><h4>Przypisane zawody</h4><div class="judgeAssignments">'+judgeAssignmentChoices(j.competition_ids)+'</div>'+(j.id?'<label class="judgeAssignment"><input type="checkbox" name="enabled" '+(j.judge_enabled?'checked':'')+'> Konto aktywne</label>':'')}
function renderJudgeManagement(){
  const d=JUDGE_MANAGEMENT;
  q('judgeManagementBody').innerHTML='<p>Sędzia loguje się telefonem i hasłem. Widzi tylko zaznaczone zawody, wpisuje wagi i przegląda wyniki.</p><details class="judgeAccountEditor"><summary>＋ Utwórz konto sędziego</summary><form onsubmit="saveJudgeAccount(event,0)">'+judgeAccountFields({})+'<button type="submit">Utwórz konto sędziego</button></form></details><h3>Konta sędziów ('+d.judges.length+')</h3>'+d.judges.map(j=>'<details class="judgeAccountEditor"><summary>'+esc(j.first_name+' '+j.last_name)+' · '+(j.judge_enabled?'Aktywne':'Wyłączone')+'</summary><form onsubmit="saveJudgeAccount(event,'+Number(j.id)+')">'+judgeAccountFields(j)+'<button type="submit">Zapisz konto i przypisania</button></form></details>').join('');
}
async function saveJudgeAccount(ev,id){
  ev.preventDefault();const form=ev.target,button=form.querySelector('button[type="submit"]');if(button.disabled)return;button.disabled=true;
  const f=new FormData(form),body={firstName:f.get('firstName'),lastName:f.get('lastName'),phone:f.get('phone'),password:f.get('password'),enabled:!id||f.get('enabled')==='on',competitionIds:f.getAll('competitionIds').map(Number)};
  try{await api('/api/admin/judges'+(id?'/'+id:''),{method:id?'PUT':'POST',body:JSON.stringify(body)});msg(id?'Zapisano konto i przypisane zawody':'Utworzono konto sędziego. Może zalogować się podanym telefonem i hasłem.');await refreshJudgeManagement()}
  catch(e){msg(e.message,'bad');button.disabled=false}
}

function toggleAdminQuickPanel(id,button){const panel=q(id);if(!panel)return;panel.open=!panel.open;button.setAttribute('aria-expanded',String(panel.open))}

// Account switching remembers independently authenticated sessions on this device.
function savedAccountSessions(){try{return JSON.parse(STORE.get('lowcy_account_sessions')||'{}')}catch(_){return {}}}
function rememberActiveAccount(){if(!ME||!['ADMIN','PLAYER'].includes(ME.role))return;const accounts=savedAccountSessions();accounts[ME.role]={id:ME.id,token:TOKEN};STORE.set('lowcy_account_sessions',JSON.stringify(accounts))}
function mountAccountSwitch(){q('accountSwitch')?.remove();if(!ME||!['ADMIN','PLAYER'].includes(ME.role))return;rememberActiveAccount();const button=document.createElement('button');button.id='accountSwitch';button.type='button';button.className='secondary';button.textContent=ME.role==='ADMIN'?'⇄ Na zawodnika':'⇄ Na admina';button.onclick=quickSwitchAccount;document.querySelector('.compactUserBar .adminbar')?.appendChild(button)}
async function checkAccountSession(token){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),30000);try{const response=await fetch('/api/me',{cache:'no-store',signal:controller.signal,headers:{Authorization:'Bearer '+token}});const data=await response.json();if(!response.ok||!data.user){const e=Error('Sesja drugiego konta wygasła. Zaloguj je ponownie.');e.status=response.status;throw e}return data.user}finally{clearTimeout(timer)}}
async function activateAccount(token,user){if(!user||!['ADMIN','PLAYER'].includes(user.role)||user.role===ME.role)throw Error('Wybierz konto '+(ME.role==='ADMIN'?'zawodnika':'administratora')+'.');rememberActiveAccount();const accounts=savedAccountSessions();accounts[user.role]={id:user.id,token};STORE.set('lowcy_account_sessions',JSON.stringify(accounts));stopAchievements();stopPlayerResultPolling();try{await disablePushSubscription(false)}catch(_){}STORE.set('carp_token',token);location.reload()}
async function quickSwitchAccount(){const button=q('accountSwitch');if(button.disabled)return;const role=ME.role==='ADMIN'?'PLAYER':'ADMIN',saved=savedAccountSessions()[role];if(!saved?.token){showAccountLink();return}button.disabled=true;try{const user=await checkAccountSession(saved.token);if(user.role!==role||String(user.id)!==String(saved.id))throw Object.assign(Error('Zaloguj drugie konto ponownie.'),{status:401});await activateAccount(saved.token,user)}catch(e){if(e.status===401||e.status===403){const accounts=savedAccountSessions();delete accounts[role];STORE.set('lowcy_account_sessions',JSON.stringify(accounts));showAccountLink()}else msg(e.name==='AbortError'?'Brak połączenia. Konto nie zostało zmienione.':e.message,'bad');button.disabled=false}}
function showAccountLink(){q('accountLinkDialog')?.remove();const dialog=document.createElement('dialog');dialog.id='accountLinkDialog';dialog.innerHTML='<form id="accountLinkForm"><h3>Zaloguj konto '+(ME.role==='ADMIN'?'zawodnika':'administratora')+'</h3><p>Jednorazowo na tym urządzeniu. Kolejne przełączenia jednym kliknięciem. „Wyloguj” zapomni oba konta.</p><label>Telefon<input name="phone" type="tel" autocomplete="username" required></label><label>Hasło<input name="password" type="password" autocomplete="current-password" required></label><p id="accountLinkError" role="alert"></p><div class="row"><button type="submit">Zaloguj i przełącz</button><button type="button" class="secondary" onclick="this.closest(\'dialog\').close()">Anuluj</button></div></form>';document.body.appendChild(dialog);dialog.addEventListener('close',()=>dialog.remove());q('accountLinkForm').onsubmit=linkAccountSubmit;dialog.showModal()}
async function linkAccountSubmit(event){event.preventDefault();const form=event.target,button=form.querySelector('[type=submit]');button.disabled=true;q('accountLinkError').textContent='';try{const fields=new FormData(form);const d=await api('/api/login',{method:'POST',body:JSON.stringify({phone:fields.get('phone'),password:fields.get('password')})});const user=await checkAccountSession(d.token);await activateAccount(d.token,user)}catch(e){q('accountLinkError').textContent=e.message;button.disabled=false}}

function renderCompetitionModeBar(c){const closed=c.status==='CLOSED'||c.signup_open===false;return '<div class="competitionModeBar"><strong>'+statusName(c.status)+'</strong>'+(c.status==='TEST'?'<button onclick="setCompetitionMode('+c.id+',\'OPEN\',this)">Otwórz zawody dla wszystkich</button>':closed?'<button onclick="setCompetitionMode('+c.id+',\'OPEN\',this)">Wznów zapisy</button>':'<button class="warn" onclick="setCompetitionMode('+c.id+',\'CLOSED\',this)">Zakończ zapisy</button>')+'</div>'}
async function setCompetitionMode(id,status,button){if(status==='OPEN'&&!confirm('Udostępnić zawody i otworzyć zapisy dla wszystkich?'))return;button.disabled=true;try{await api('/api/competitions/'+id+'/mode',{method:'POST',body:JSON.stringify({status})});await loadCompetitions();await refreshCompetitionKeepScroll(id);msg(status==='OPEN'?'Zapisy otwarte':'Zapisy zakończone — lista zawodników zachowana')}catch(e){msg(e.message,'bad');button.disabled=false}}
