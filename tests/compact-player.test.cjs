'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
const css=fs.readFileSync(path.join(root,'compact-player-v237.css'),'utf8');
function slice(from,to){const a=app.indexOf(from),b=app.indexOf(to,a+from.length);assert.ok(a>=0&&b>a,'Expected adjacent functions '+from);return app.slice(a,b)}
function renderFixture(filter,nearest=[],remaining=[]){
  const box={innerHTML:''},arr=[...nearest,...remaining],ctx={
    q:id=>id==='competitionsList'?box:null,
    PLAYER_COMPETITIONS_CACHE:arr,PLAYER_COMP_FILTER:filter,PLAYER_COMP_MONTH:'all',
    getPlayerNearestThree:()=>nearest,
    renderPlayerCompetitionFilters:()=>'<nav class="filter-fixture">FILTRY</nav>',
    filterPlayerCompetitions:()=>remaining,
    renderPlayerCompetitionGroups:()=>'<div class="playerCompGroups">ZAWODY</div>',
    renderPlayerNearestThree:()=>'<section class="playerNearestThree">NAJBLIŻSZE ZAWODY</section>',
    renderPlayerMyUpcoming:()=>nearest.length?'<section class="playerMyUpcoming">MOJE STARTY</section>':''
  };
  vm.runInNewContext(slice('function renderPlayerCompetitionList(){','async function loadCompetitions(){')+';this.render=renderPlayerCompetitionList;',ctx);
  ctx.render();return box.innerHTML;
}
test('V237: history with zero upcoming starts shows filters then event without empty-nearest block',()=>{
  const html=renderFixture('completed',[],[{id:1}]);
  assert.doesNotMatch(html,/Brak nadchodzących zawodów|playerNearestThree|MOJE STARTY/);
  assert.ok(html.indexOf('FILTRY')<html.indexOf('ZAWODY'));
});
test('V237: history does not waste room on upcoming starts that belong to another filter',()=>{
  const html=renderFixture('completed',[{id:1}],[{id:2}]);
  assert.doesNotMatch(html,/playerNearestThree|MOJE STARTY/);
  assert.match(html,/ZAWODY/);
});
test('V237: upcoming filter shows a single short empty message when no events exist',()=>{
  const html=renderFixture('upcoming',[],[]);
  const notices=html.match(/Brak nadchodzących zawodów/g)||[];
  assert.equal(notices.length,2,'One per responsive layout, with only one visible');
  assert.doesNotMatch(html,/playerNearestThree|MOJE STARTY/);
});
test('V237: upcoming events still retain nearest-three and saved-start panels',()=>{
  const html=renderFixture('upcoming',[{id:1}],[{id:2}]);
  assert.match(html,/playerNearestThree/);
  assert.match(html,/MOJE STARTY/);
  assert.match(html,/POZOSTAŁE NADCHODZĄCE/);
});
test('V237: all filters occupy one row and buttons remain comfortable on narrow screens',()=>{
  assert.match(css,/grid-template-columns:repeat\(3,minmax\(0,1fr\)\)!important/);
  assert.match(css,/grid-column:auto!important/);
  assert.match(css,/min-height:46px!important;height:46px!important/);
  assert.match(css,/height:44px!important;min-height:44px!important/);
  assert.match(css,/player181Main\{\s*min-height:47px!important/);
  assert.match(css,/player181Small\{\s*min-height:44px!important/);
  assert.match(css,/\.playerFilterShort\{display:inline!important\}/);
  assert.match(app,/NADCHODZ\./);
  assert.match(app,/aria-label="'\+label\+' '\+count/);
});
test('V237: only active dock buttons are green; passive primary and news are navy',()=>{
  assert.match(css,/\.playerDockItem\[data-action="primary"\]:not\(\.active\)/);
  assert.match(css,/\.playerDockItem\[data-action="notifications"\]:not\(\.active\)/);
  assert.match(css,/background:#1a4055!important/);
  assert.match(css,/\.playerDockItem\.active,/);
  assert.match(css,/border:2px solid #f9d46d!important/);
});
test('V237: CSS is loaded last and cached in offline shell, version labels stay in sync',()=>{
  assert.match(server,/<link rel="stylesheet" href="\/compact-player-v237\.css\?v=\$\{APP_VERSION\}">/);
  assert.match(server,/const COMPACT_CSS='\/compact-player-v237\.css\?v=\$\{APP_VERSION\}'/);
  assert.match(server,/const APP_VERSION = '251'/);
  assert.match(app,/const CLIENT_VERSION='251'/);
  assert.match(server,/class="headerVersion">V251</);
});
