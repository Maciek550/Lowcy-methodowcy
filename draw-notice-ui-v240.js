'use strict';
/* V240 – special publishing notice. Never invents sector or stand numbers. */
(function(){
 const playersBlueStyle=document.createElement('style');
 playersBlueStyle.id='playersDesktopBlueHotfixV294';
 playersBlueStyle.textContent='@media(min-width:761px){'
  +'body #app #playersList .adminPlayersTable tbody tr:nth-child(odd)>td{background:#b7d8ec!important;color:#062b43!important;-webkit-text-fill-color:#062b43!important;border-color:#6f9fbb!important;}'
  +'body #app #playersList .adminPlayersTable tbody tr:nth-child(even)>td{background:#9fc9e2!important;color:#062b43!important;-webkit-text-fill-color:#062b43!important;border-color:#6f9fbb!important;}'
  +'body #app #playersList .adminPlayersTable tbody tr:hover>td{background:#cbe5f4!important;}'
  +'body #app #playersList .adminPlayersTable tbody td>b{color:#062b43!important;-webkit-text-fill-color:#062b43!important;text-shadow:none!important;}'
  +'body #app #playersList .adminPlayersTable tbody td{color:#062b43!important;-webkit-text-fill-color:#062b43!important;}'
  +'body #app #playersList .adminPlayersTable .center,body #app #playersList .adminPlayersTable .center>b{color:#062b43!important;-webkit-text-fill-color:#062b43!important;text-shadow:none!important;}'
  +'}';
 document.head.appendChild(playersBlueStyle);
 let activeUid=0,timer=null,to=null,lastId=0;
 const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const details=n=>n&&n.data&&typeof n.data==='object'?n.data:{};
 const marker=(uid,id)=>'lowcy_draw_notice_v240:'+Number(uid)+':'+Number(id);
 function spot(r){
   if(!r||typeof r!=='object')return '';
   const sec=String(r.sector??'').trim().toLocaleUpperCase('pl-PL'),num=Number(r.stand);
   return sec&&Number.isInteger(num)&&num>0?sec+' '+num:'';
 }
 function tiles(n){
   const d=details(n),t1=spot(d.t1),t2=spot(d.t2);
   if(!t1&&!t2)return '';
   const b=[t1?'<div class="drawNoticeTile round1"><small>TURA 1</small><strong>'+esc(t1)+'</strong></div>':'',
            t2?'<div class="drawNoticeTile round2"><small>TURA 2</small><strong>'+esc(t2)+'</strong></div>':''].filter(Boolean);
   return '<div class="drawNotice"><div class="drawNoticeHead">NOWE LOSOWANIE NA DZIŚ</div><div class="drawNoticeTiles '+(b.length===1?'one':'')+'">'+b.join('')+'</div><div class="drawNoticeGoodLuck">Powodzenia! 🎣</div></div>';
 }
 function close(){
   clearTimeout(to);to=null;lastId=0;
   document.getElementById('drawNoticeToast')?.remove();
 }
 async function open(n){
   if(!n)return;
   close();
   const d=details(n),id=Number(n.id),compId=Number(d.competitionId||0);
   if(!compId)return;
   try{
     if(id)await window.readNotif(id);
     window.showTab('competitions');
     if(await window.openCompetition(compId,true)){
       window.showPlayerMobilePanel(d.t1?'draw1':'draw2');
     }
   }catch(e){console.warn('Nie udało się otworzyć losowania:',e?.message)}
 }
 function inbox(n){
   const html=tiles(n);
   if(!html)return '<b>'+esc(n.title)+'</b><br>'+esc(n.body);
   const d=details(n),cid=Number(d.competitionId||0),id=Number(n.id);
   return '<div class="drawNoticeInbox" data-notice-id="'+id+'">'+html
       +(cid?'<button type="button" class="drawNoticeOpen" onclick="window.lowcyDrawNoticeOpen('+id+')">ZOBACZ LOSOWANIE</button>':'')+'</div>';
 }
 function notificationRowOpen(id){
   const n=(window.__lowcyDrawNotifications||[]).find(x=>Number(x.id)===Number(id));
   if(n)open(n);
 }
 function onNotifications(list,uid){
   activeUid=Number(uid||0);
   if(!activeUid)return;
   const notices=(Array.isArray(list)?list:[]).filter(x=>x?.type==='DRAW_PUBLISH');
   window.__lowcyDrawNotifications=notices;
   if(document.hidden||document.getElementById('drawNoticeToast')||document.getElementById('achievementToast'))return;
   const now=Date.now();
   const fresh=notices.filter(n=>{
     if(n.read_at||!tiles(n))return false;
     const published=Date.parse(n.created_at||'');
     if(!Number.isFinite(published)||published>now+60000||now-published>6*3600000)return false;
     try{return localStorage.getItem(marker(activeUid,n.id))!=='1'}catch(_){return true}
   }).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at))[0];
   if(!fresh||!Number(details(fresh).competitionId))return;
   const id=Number(fresh.id);
   if(lastId===id)return;
   const el=document.createElement('aside');el.id='drawNoticeToast';el.setAttribute('role','status');
   el.setAttribute('aria-live','polite');el.setAttribute('aria-label','Nowe losowanie na dziś');
   el.innerHTML='<button type="button" class="drawNoticeClose" aria-label="Zamknij dymek">×</button>'
      +tiles(fresh)
      +'<button type="button" class="drawNoticeOpen">ZOBACZ LOSOWANIE</button>'
      +'<div class="drawNoticeProgress" aria-hidden="true"></div>';
   el.querySelector('.drawNoticeClose').addEventListener('click',close);
   el.querySelector('.drawNoticeOpen').addEventListener('click',()=>open(fresh));
   document.body.appendChild(el);lastId=id;
   try{localStorage.setItem(marker(activeUid,id),'1')}catch(_){}
   to=setTimeout(close,15000);
 }
 function start(uid){
   stop();activeUid=Number(uid||0);
   if(!activeUid)return;
   timer=setInterval(()=>{
     if(!activeUid||document.hidden||navigator.onLine===false)return;
     window.loadNotifications?.().catch(()=>{});
   },20000);
 }
 function stop(){clearInterval(timer);timer=null;close();activeUid=0}
 document.addEventListener('visibilitychange',()=>{
   if(document.hidden)close();
   else if(activeUid)window.loadNotifications?.().catch(()=>{});
 });
 window.lowcyDrawNoticeInbox=inbox;
 window.lowcyDrawNoticeOnNotifications=onNotifications;
 window.lowcyDrawNoticeOpen=notificationRowOpen;
 window.lowcyDrawNoticeStartPolling=start;
 window.lowcyDrawNoticeStop=stop;
 window.lowcyDrawNoticeSpot=spot;
})();
