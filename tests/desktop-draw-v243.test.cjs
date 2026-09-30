'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
const css=fs.readFileSync(path.join(root,'desktop-draw-v243.css'),'utf8');
const drawCss=fs.readFileSync(path.join(root,'draw-ui-v240.css'),'utf8');
const start=app.indexOf('function renderPlayerSectorAccordion('),
  end=app.indexOf('function togglePlayerSectorAccordion(',start);
assert.ok(start>0&&end>start);
const ctx={
  ME:{id:7},esc:x=>String(x??''),sectorLayoutClient:()=>[
    {letter:'A',top:[],bottom:[1]},{letter:'B',top:[],bottom:[2]},{letter:'C',top:[],bottom:[3]}],
  roundDrawStandMap:()=>({1:{draw:{user_id:8}},2:{draw:{user_id:7}},3:{draw:{user_id:9}}}),
  activeSectorSize:()=>7,renderPlayerSectorBank:(label,nums)=>'<p>'+label+':'+nums.join(',')+'</p>',
  sectorColorClass:letter=>'sectorFill-'+letter
};
vm.runInNewContext(app.slice(start,end)+'this.render=renderPlayerSectorAccordion;',ctx);
const sample={competition:{map_mode:'ONE_BANK'},draws:[{round:1,user_id:7,sector:'B'}]};
test('V243: desktop T1/T2 shows all sectors expanded immediately, mobile retains compact behavior',()=>{
 const desktop=ctx.render(sample,1,true);
 assert.equal((desktop.match(/playerSectorAccordion sectorFill-[A-C] open/g)||[]).length,3);
 assert.doesNotMatch(desktop,/collapsed/);
 const mobile=ctx.render(sample,1);
 assert.equal((mobile.match(/playerSectorAccordion sectorFill-[A-C] open/g)||[]).length,2);
 assert.match(mobile,/sectorFill-C collapsed/);
 assert.match(app,/renderPlayerSectorAccordion\(d,round,true\)/);
 assert.match(app,/mapView\?renderPlayerSectorAccordion\(d,round\):/);
 assert.match(app,/function togglePlayerSectorAccordion\(btn,ev\)/);
});
test('V243: dark desktop draw only, burgundy main map tiles retained from V240',()=>{
 assert.match(css,/@media \(min-width:761px\)/);
 assert.match(css,/body\.playerTheme #playerDesktopPanelContent \.playerDesktopDrawSelected > \.playerDesktopPanelCard/);
 assert.match(css,/background:linear-gradient\(155deg,#142f43/);
 assert.match(css,/\.playerSectorAccordionBody \{/);
 assert.match(css,/\.minePlayerSectorStand \{/);
 assert.doesNotMatch(css,/\.mapTile/);
 assert.match(drawCss,/\.playerDesktopSubNav \.mapTile\{/);
 assert.match(drawCss,/linear-gradient\(145deg,#b93042,#721526\)/);
});
test('V243: new CSS online and offline, versions matched',()=>{
 assert.match(server,/const DESKTOP_DRAW_CSS='\/desktop-draw-v243\.css\?v=\$\{APP_VERSION\}'/);
 assert.match(server,/<link rel="stylesheet" href="\/desktop-draw-v243\.css\?v=\$\{APP_VERSION\}">/);
 assert.match(server,/if\(path==='\/desktop-draw-v243\.css'\)/);
 assert.match(server,/RESULT_CONTRAST_CSS,DESKTOP_DRAW_CSS,DRAW_JS/);
 assert.match(server,/const APP_VERSION = '250'/);
 assert.match(app,/const CLIENT_VERSION='250'/);
 assert.match(server,/class="headerVersion">V250/);
});
