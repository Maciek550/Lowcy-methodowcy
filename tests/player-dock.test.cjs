'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
const css=fs.readFileSync(path.join(root,'player-dock-v236.css'),'utf8');
function extractDock(){
  const start=app.indexOf('/* V236: five compact dock actions');
  const end=app.indexOf('function showPlayerMobilePanel(',start);
  assert.ok(start>=0&&end>start,'Dedicated V236 dock code must exist');
  return app.slice(start,end);
}
function context(overrides={}){
  let mounted=null,arrow=null;
  const ctx={
    Intl,Date,Math,Number,String,
    CURRENT_DETAIL:null,ME:{role:'PLAYER',id:11},
    PLAYER_COMPETITIONS_CACHE:[],
    q:id=>id==='playerGlobalBottomNav'?mounted:id==='playerDockTopArrow'?arrow:id==='tab-competitions'?{classList:{contains:()=>false}}:id==='competitionDetail'?{classList:{contains:()=>true}}:null,
    playerCompetitionRegisteredUpcoming:c=>c.my_status==='ACTIVE'||c.my_status==='RESERVE',
    playerCompetitionDateKey:c=>c.competition_date,
    getPlayerNearestThree:arr=>arr.filter(x=>x.competition_date>='2026-09-29').sort((a,b)=>a.competition_date.localeCompare(b.competition_date)).slice(0,3),
    playerEarlyListAvailable:()=>false,playerRoundHasResults:(d,n)=>(d?.results||[]).some(x=>x.round===n),
    document:{body:{appendChild:element=>{if(element.id==='playerGlobalBottomNav')mounted=element;else if(element.id==='playerDockTopArrow')arrow=element},classList:{contains:()=>false}},
      createElement:tag=>({nodeType:1,tag,innerHTML:'',hidden:false,dataset:{},classList:{toggle:()=>{}},
        setAttribute:()=>{},addEventListener:()=>{},remove:()=>{},querySelector:()=>null,querySelectorAll:()=>[]}),
      addEventListener:()=>{},querySelector:()=>null},
    window:{scrollY:0,addEventListener:()=>{}},
    clearInterval:()=>{},setInterval:()=>123,requestAnimationFrame:fn=>fn(),
    showTab:()=>{},closePlayerCompetition:()=>{},scrollAppTop:()=>{},
    openPlayerNotifications:()=>{},loadCompetitions:async()=>{},
    openCompetition:async()=>true,showPlayerMobilePanel:()=>{},syncPlayerEarlyListCutoff:()=>{},
    msg:()=>{},
    ...overrides
  };
  vm.runInNewContext(extractDock()+';this.dock={preview:playerDockPreviewCompetition,detail:playerDockDetailedView,map:playerDockLatestMap,results:playerDockLatestResults,mount:mountPlayerBottomNav,action:playerDockAction,refresh:refreshPlayerDock};',ctx);
  ctx.mounted=()=>mounted;ctx.arrow=()=>arrow;return ctx;
}
test('V236: nearest registered start takes priority, an opened competition stays selected',()=>{
  const ctx=context();
  const other={id:1,competition_date:'2026-10-01',my_status:''};
  const mine={id:2,competition_date:'2026-10-03',my_status:'ACTIVE'};
  const mineEarly={id:3,competition_date:'2026-10-02',my_status:'RESERVE'};
  ctx.PLAYER_COMPETITIONS_CACHE.push(other,mine,mineEarly);
  assert.equal(ctx.dock.preview().id,3);
  ctx.q=id=>id==='competitionDetail'?{classList:{contains:()=>false}}:id==='tab-competitions'?{classList:{contains:()=>false}}:null;
  ctx.CURRENT_DETAIL={competition:{id:4,competition_date:'2026-09-29'}};
  assert.equal(ctx.dock.preview().id,4);
});
test('V236: dock always opens map T1 while results select existing rounds',()=>{
  const d=context().dock;
  assert.equal(d.map({draws:[{round:1}]}),'map1');
  assert.equal(d.map({draws:[{round:1},{round:2}]}),'map1');
  assert.equal(d.results({results:[],classification:{general:[]}}),'t1');
  assert.equal(d.results({results:[{round:1}],classification:{general:[]}}),'t1');
  assert.equal(d.results({results:[{round:2}],classification:{general:[]}}),'t2');
  assert.equal(d.results({results:[{round:1},{round:2}],classification:{general:[{}]}}),'general');
});
test('V236: exactly five buttons, readable labels and separate top arrow',()=>{
  const ctx=context();ctx.dock.mount();
  const nav=ctx.mounted(),arrow=ctx.arrow();
  assert.ok(nav);assert.ok(arrow);
  assert.equal((nav.innerHTML.match(/class="playerDockItem"/g)||[]).length,5);
  for(const text of ['START','LOS T1','MAPA','WYNIKI','NOWOŚCI'])assert.ok(nav.innerHTML.includes(text));
  assert.equal((nav.innerHTML.match(/playerDockBadge/g)||[]).length,1,'the dock only badges notifications');
  assert.equal(arrow.getAttribute,undefined,'arrow is a distinct control with own attribute setter mock');
  assert.match(extractDock(),/arrow\.setAttribute\('aria-label','Przewiń na górę strony'\)/);
});
test('V248: dock opens T1 before and after 06:00; LISTA stays in each competition panel',async()=>{
  const clicks=[],ctx=context();
  const detail={competition:{id:2,competition_date:'2026-09-29'},activeEntries:[{},{}],draws:[{round:1},{round:2}],results:[{round:1},{round:2}],classification:{general:[{}]}};
  ctx.CURRENT_DETAIL=detail;
  ctx.q=id=>id==='competitionDetail'?{classList:{contains:()=>false}}:
    id==='tab-competitions'?{classList:{contains:()=>false}}:null;
  ctx.showTab=name=>clicks.push('tab:'+name);
  ctx.openPlayerNotifications=()=>clicks.push('notifications');
  ctx.showPlayerMobilePanel=panel=>clicks.push(panel);
  ctx.playerEarlyListAvailable=()=>true;
  await ctx.dock.action('primary');
  assert.equal(clicks.at(-1),'draw1');
  ctx.playerEarlyListAvailable=()=>false;
  await ctx.dock.action('primary');
  assert.equal(clicks.at(-1),'draw1');
  assert.ok(!clicks.includes('list'));
  assert.match(app,/early\?b\('list','LISTA <span class="playerEarlyListCount">'/);
  await ctx.dock.action('map');
  assert.ok(clicks.includes('map1'));
  await ctx.dock.action('results');
  assert.ok(clicks.includes('general'));
  await ctx.dock.action('notifications');
  assert.ok(clicks.includes('notifications'));
  assert.ok(clicks.includes('tab:competitions'));
});
test('V236: CSS has 5 proportional columns, 48+ px targets, clear label contrast and safe-area padding',()=>{
  assert.match(css,/grid-template-columns:repeat\(5,minmax\(0,1fr\)\)!important/);
  assert.match(css,/min-height:50px!important;height:50px!important/);
  assert.match(css,/min-height:48px!important;height:48px!important/);
  assert.match(css,/font-size:clamp\(10\.5px,3\.1vw,12px\)/);
  assert.match(css,/safe-area-inset-bottom/);
  assert.match(css,/playerDockBadge\[hidden\]/);
  assert.match(css,/#playerDockTopArrow:not\(\[hidden\]\)/);
  assert.match(server,/\/player-dock-v236\.css\?v=\$\{APP_VERSION\}/);
  assert.match(server,/const APP_VERSION = '253'/);
  assert.match(app,/const CLIENT_VERSION='253'/);
});
