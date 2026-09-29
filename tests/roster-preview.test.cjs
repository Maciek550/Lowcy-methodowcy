'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),server=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
function sourceBetween(begin,end){
  const start=app.indexOf(begin),stop=app.indexOf(end,start+begin.length);
  assert.ok(start>=0&&stop>start,'Expected source between '+begin+' and '+end);
  return app.slice(start,stop);
}
test('V235: LISTA visible only until 06:00 Europe/Warsaw, including daylight-saving dates',()=>{
  const ctx={Intl,Date,playerCompetitionDateKey:c=>c.competition_date};
  vm.runInNewContext(sourceBetween('function playerEarlyListAvailable','function renderPlayerMobilePanelContent')+';this.available=playerEarlyListAvailable;',ctx);
  const c={competition_date:'2026-09-29'};
  assert.equal(ctx.available(c,new Date('2026-09-29T03:59:59Z')),true,'05:59:59 Warsaw: visible');
  assert.equal(ctx.available(c,new Date('2026-09-29T04:00:00Z')),false,'06:00 Warsaw: hidden');
  assert.equal(ctx.available({competition_date:'2026-09-30'},new Date('2026-09-29T19:00:00Z')),true,'tomorrow: visible');
  assert.equal(ctx.available({competition_date:'2026-09-28'},new Date('2026-09-29T03:00:00Z')),false,'yesterday: hidden');
  assert.equal(ctx.available({competition_date:'2026-12-01'},new Date('2026-12-01T04:59:59Z')),true,'winter 05:59');
  assert.equal(ctx.available({competition_date:'2026-12-01'},new Date('2026-12-01T05:00:00Z')),false,'winter 06:00');
  assert.equal(ctx.available({competition_date:''},new Date()),false,'no date: no LISTA');
});
test('V235: participant LISTA renders numbered main roster and reserve without exposing telephone',()=>{
  const ctx={Intl,Date,playerCompetitionDateKey:c=>c.competition_date,ME:{id:2},esc:value=>String(value).replace(/</g,'&lt;')};
  vm.runInNewContext(sourceBetween('function playerEarlyListAvailable','function renderPlayerMobilePanelContent')+';this.list=renderPlayerEarlyListPanel;',ctx);
  const d={competition:{competition_date:'2099-09-29'},activeEntries:[
    {user_id:1,first_name:'Anna',last_name:'Nowak',phone:'+48500111222'},
    {user_id:2,first_name:'Jan',last_name:'Kowalski',phone:'+48600999888'}
  ],reserveEntries:[{user_id:3,first_name:'Maria',last_name:'Test',phone:'123456789'}]};
  const html=ctx.list(d);
  assert.match(html,/LISTA GŁÓWNA/);
  assert.match(html,/playerEarlyListNo">1<\/span>/);
  assert.match(html,/playerEarlyListNo">2<\/span>/);
  assert.match(html,/Anna Nowak/);
  assert.match(html,/Jan Kowalski/);
  assert.match(html,/REZERWA \(1\)/);
  assert.doesNotMatch(html,/\+48500111222|600999888|123456789/);
});
test('V235: mobile and desktop nav include the compact LISTA tile conditionally',()=>{
  for(const name of ['renderPlayerMobileDashboard','renderPlayerDesktopDashboard']){
    const begin='function '+name,end=name==='renderPlayerMobileDashboard'?'function renderPlayerDesktopPanelContent':'function instantPlayerScrollTo';
    const ctx={PLAYER_MOBILE_PANEL:'list',playerEarlyListAvailable:()=>true,
      playerDrawStar:()=>'',playerResultStar:()=>'',renderPlayerMobilePanelContent:()=>'',renderPlayerDesktopPanelContent:()=>''};
    vm.runInNewContext(sourceBetween(begin,end)+ ';this.dashboard='+name+';',ctx);
    const d={competition:{},activeEntries:[{},{}]},before=ctx.dashboard(d);
    assert.match(before,/earlyListTile/);
    assert.match(before,/playerEarlyListCount">2<\/span>/);
    ctx.playerEarlyListAvailable=()=>false;
    assert.doesNotMatch(ctx.dashboard(d),/earlyListTile/);
  }
  assert.match(app,/setInterval\(\(\)=>\{syncPlayerEarlyListCutoff\(\);pollPlayerCompetitionResults\(\)\},12000\)/);
});
test('V235: call icon and quick-add are distinct for real versus imported telephone numbers',()=>{
  const ctx={phoneTelHref:p=>/^\+?\d{9,15}$/.test(String(p))?p:'',renderPhoneCall:(p,cls,small)=>'CALL '+p+' '+cls+' '+small};
  vm.runInNewContext(sourceBetween('function rosterPhoneControl','function msg(')+';this.phoneAction=rosterPhoneControl;',ctx);
  assert.match(ctx.phoneAction({phone:'500600700'},11),/CALL 500600700 rosterPhoneCall true/);
  const missing=ctx.phoneAction({phone:'IMPORT-abcdef',first_name:'Anna',last_name:'Nowak',pzw_club:''},11);
  assert.match(missing,/\+ TELEFON/);
  assert.match(missing,/editPlayerName\(11,/);
  assert.doesNotMatch(missing,/href="tel:/);
});
test('V235: admin contact phone remains separate from login, with dedicated CSS and offline shell',()=>{
  const css=fs.readFileSync(path.join(root,'roster-preview-v235.css'),'utf8');
  assert.match(server,/add column if not exists contact_phone text/);
  assert.match(server,/coalesce\(nullif\(u\.contact_phone,''\),u\.phone\) as phone/);
  assert.match(server,/contact_phone=case when \$4::boolean/);
  assert.match(server,/\/roster-preview-v235\.css/);
  assert.match(css,/\.phoneCallBtn\.rosterPhoneCall/);
  assert.match(css,/\.playerMapNav\.withEarlyList/);
  assert.match(app,/const CLIENT_VERSION='236'/);
  assert.match(server,/const APP_VERSION = '236'/);
  assert.match(server,/class="headerVersion">V236</);
});
