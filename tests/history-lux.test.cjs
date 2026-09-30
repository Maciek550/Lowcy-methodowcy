'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
const css=fs.readFileSync(path.join(root,'history-compact-v241.css'),'utf8');
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
test('V241: complete compact mobile row with two tours and summary on a single card',()=>{
 const html=fixture([sample]);
 assert.match(html,/historyHeroHead/);
 assert.equal((html.match(/class="historyStat /g)||[]).length,5);
 assert.match(html,/historyCompactCard/);
 assert.match(html,/historyPodium2/);
 assert.match(html,/2\/29/);
 assert.match(html,/historyRoundTag">T1/);
 assert.match(html,/historyRoundTag">T2/);
 assert.match(html,/Miejsce 1 na 8 zawodników/);
 assert.match(html,/historyRoundMeta">Sektor <b>D<\/b> · stan\. <b>16<\/b>/);
 assert.match(html,/historyRoundMeta">Sektor <b>A<\/b> · stan\. <b>27<\/b>/);
 assert.match(html,/8 290 g/);
 assert.match(html,/17 750 g/);
 assert.match(html,/SUMA MIEJSC<\/small><b>2 pkt<\/b>/);
 assert.match(html,/SUMA WAGI<\/small><b>26 040 g<\/b>/);
 assert.match(html,/PEŁNE WYNIKI/);
 assert.match(html,/openHistoryCompetition\(78\)/);
});
test('V241: BF only where actually present, no zero BF; fractional and zero sector points retained',()=>{
 const html=fixture([{...sample,t1_place:2.5,t2_place:4,t1_big_fish:0,t2_big_fish:0}]);
 assert.match(html,/<b>2,5<\/b><span class="historyRoundSlash"/);
 assert.match(html,/SUMA MIEJSC<\/small><b>6,5 pkt<\/b>/);
 assert.doesNotMatch(html,/historyRoundBF/);
 const zero=fixture([{...sample,t1_place:0,t2_place:1}]);
 assert.match(zero,/<b>0<\/b><span class="historyRoundSlash"/);
 const bf=fixture([sample]);
 assert.equal((bf.match(/class="historyRoundBF"/g)||[]).length,1);
 assert.match(bf,/BF <b>7 330 g<\/b>/);
});
test('V241: single and multiple-season selectors still work, empty input has clear message',()=>{
 const single=fixture([sample]);
 assert.match(single,/class="historySingleYear" aria-label="Sezon 2026">2026<\/span>/);
 assert.equal((single.match(/class="historySeasonBtn/g)||[]).length,1);
 const multi=fixture([sample,{...sample,competition_id:79,competition_date:'2025-05-01'}]);
 assert.ok(multi.includes('data-year="2026"'));
 assert.ok(multi.includes('data-year="2025"'));
 assert.doesNotMatch(multi,/historySingleYear/);
 assert.match(fixture([]),/Brak zakończonych startów/);
});
test('V241: long event names and station labels escaped without breaking the layout',()=>{
 const html=fixture([{...sample,title:'Open <Special> "CUP"',fishery:'Nad Długą Rzeką & Stawem',t1_stand:'<9>'}]);
 assert.match(html,/Nad Długą Rzeką &amp; Stawem/);
 assert.match(html,/Open &lt;Special> &quot;CUP&quot;/);
 assert.match(html,/stan\. <b>&lt;9>/);
});
test('V241: scoped compact CSS makes both rounds horizontal and preserves phone touch targets',()=>{
 assert.match(css,/body\.playerTheme #playerHistoryContent/);
 assert.match(css,/\.historyCompactCard \.historyRound\.historyCompactRound\{[\s\S]*?display:grid!important/);
 assert.match(css,/grid-template-columns:45px minmax\(0,1fr\) minmax\(98px,auto\)/);
 assert.match(css,/\.historyCompactCard\.hidden\{display:none!important\}/);
 assert.match(css,/\.historyResultsBtn\{[\s\S]*?min-height:44px!important/);
 assert.match(css,/@media\(max-width:380px\)/);
 assert.match(css,/\.historyCompactCard \.historyRound2 \.historyRoundTag\{background:#9b531d!important\}/);
});
test('V241: only history gets a new stylesheet; old V239 and draw V240 remain, offline too',()=>{
 assert.match(server,/const HISTORY_CSS='\/history-lux-v239\.css\?v=\$\{APP_VERSION\}'/);
 assert.match(server,/const HISTORY_COMPACT_CSS='\/history-compact-v241\.css\?v=\$\{APP_VERSION\}'/);
 assert.match(server,/<link rel="stylesheet" href="\/history-compact-v241\.css\?v=\$\{APP_VERSION\}">/);
 assert.match(server,/DESKTOP_NAV_CSS,HISTORY_CSS,HISTORY_COMPACT_CSS,DRAW_CSS/);
 assert.match(server,/const APP_VERSION = '245'/);
 assert.match(app,/const CLIENT_VERSION='245'/);
 assert.match(server,/class="headerVersion">V245/);
});
