'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
const css=fs.readFileSync(path.join(root,'history-lux-v239.css'),'utf8');
function fixture(rows){
 const start=app.indexOf("let PLAYER_HISTORY_YEAR='all';"),
       stop=app.indexOf('async function openHistoryCompetition(',start);
 assert.ok(start>=0&&stop>start,'History renderer must exist');
 const box={innerHTML:''};
 const ctx={
  q:id=>id==='playerHistoryContent'?box:null,
  document:{querySelectorAll:()=>[]},
  esc:s=>String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
  placeText:v=>(v===0||v)?String(v).replace('.',','):'—',
  fmtGram:v=>{const n=Number(v||0);return n?String(n).replace(/\B(?=(\d{3})+(?!\d))/g,' '):'0'},
  fmtDate:s=>String(s).slice(0,10)
 };
 vm.runInNewContext(app.slice(start,stop)+';this.render=renderPlayerHistory;',ctx);
 ctx.render(rows);
 return box.innerHTML;
}
const sample={
 competition_id:78,competition_date:'2026-09-26',fishery:'LASOMIN nr 1',title:'Method Feeder – Gandalf CUP',
 t1_place:1,t1_sector_size:8,t1_stand:16,t1_sector:'D',t1_weight:8290,t1_big_fish:0,
 t2_place:1,t2_sector_size:7,t2_stand:27,t2_sector:'A',t2_weight:17750,t2_big_fish:7330,
 general_rank:2,general_count:29,total_weight:26040,biggest_fish:7330
};
test('V239: one event keeps LUX compact headline, five metrics, T1/T2 and GENERAL',()=>{
 const html=fixture([sample]);
 assert.match(html,/historyHeroHead/);
 assert.equal((html.match(/class="historyStat /g)||[]).length,5);
 assert.match(html,/historyGeneral/);
 assert.match(html,/2\/29/);
 assert.match(html,/TURA 1/);
 assert.match(html,/TURA 2/);
 assert.match(html,/historyRoundSlash/);
 assert.match(html,/historyRoundWeight/);
 assert.match(html,/PEŁNE WYNIKI/);
});
test('V239: BF 0 hidden; only actual big fish shown; sum of sector places not duplicated totals',()=>{
 const html=fixture([sample]);
 assert.equal((html.match(/BF:/g)||[]).length,1);
 assert.match(html,/BF: <b>7 330 g<\/b>/);
 assert.doesNotMatch(html,/BF: <b>0 g<\/b>/);
 assert.match(html,/SUMA MIEJSC<\/small><b>2 pkt<\/b>/);
 assert.doesNotMatch(html,/class="historyStartFoot"[^]*?SUMA WAGI/);
 assert.doesNotMatch(html,/class="historyStartFoot"[^]*?NAJWIĘKSZA RYBA/);
});
test('V239: a single season is a compact label; multiple seasons retain working filters',()=>{
 const single=fixture([sample]);
 assert.match(single,/class="historySingleYear" aria-label="Sezon 2026">2026<\/span>/);
 assert.equal((single.match(/class="historySeasonBtn/g)||[]).length,1);
 const multi=fixture([sample,{...sample,competition_id:79,competition_date:'2025-05-01'}]);
 assert.ok(multi.includes('data-year="2026"'));
 assert.ok(multi.includes('data-year="2025"'));
 assert.doesNotMatch(multi,/historySingleYear/);
});
test('V239: round points retain fractional place notation and realistic 0 catch points',()=>{
 const html=fixture([{...sample,t1_place:2.5,t2_place:4,t1_big_fish:0,t2_big_fish:0}]);
 assert.match(html,/<b>2,5<\/b><span class="historyRoundSlash"/);
 assert.match(html,/SUMA MIEJSC<\/small><b>6,5 pkt<\/b>/);
 assert.doesNotMatch(html,/BF:/);
});
test('V239: compact CSS prioritizes round placement and maintains touch controls on mobile',()=>{
 assert.match(css,/\.historyRoundPlace\{\s*display:flex!important/);
 assert.match(css,/gap:9px!important;[^\n]*Large legible digits/);
 assert.match(css,/\.historyRoundPlace b\{\s*font-size:30px!important/);
 assert.match(css,/\.historyRoundPlace span\{\s*font-size:22px!important/);
 assert.match(css,/\.historyStartCard\.hidden\{display:none!important\}/);
 assert.match(css,/\.historyStartFoot button\{[\s\S]*?min-height:44px!important/);
 assert.match(css,/@media\(max-width:760px\)/);
 assert.match(css,/grid-template-columns:repeat\(6,minmax\(0,1fr\)\)!important/);
});
test('V239: style is limited to player history and included in offline app shell',()=>{
 assert.match(css,/body\.playerTheme #playerHistoryContent/);
 assert.match(server,/const HISTORY_CSS='\/history-lux-v239\.css\?v=\$\{APP_VERSION\}'/);
 assert.match(server,/<link rel="stylesheet" href="\/history-lux-v239\.css\?v=\$\{APP_VERSION\}">/);
 assert.match(server,/const APP_VERSION = '239'/);
 assert.match(app,/const CLIENT_VERSION='239'/);
 assert.match(server,/class="headerVersion">V239/);
});
