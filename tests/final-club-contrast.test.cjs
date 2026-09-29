'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const css=fs.readFileSync(path.join(root,'result-contrast-v242.css'),'utf8');
const server=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
function luminance(hex){
 const values=hex.match(/[0-9a-f]{2}/gi).map(x=>parseInt(x,16)/255);
 const linear=values.map(x=>x<=0.04045?x/12.92:Math.pow((x+0.055)/1.055,2.4));
 return .2126*linear[0]+.7152*linear[1]+.0722*linear[2];
}
test('V242: player desktop and admin checkbox labels have sufficient explicit contrast',()=>{
 const bg=luminance('eaf3f8'),fg=luminance('14344a'),ratio=(bg+.05)/(fg+.05);
 assert.ok(ratio>=7,'contrast ratio '+ratio.toFixed(2)+' must be >=7');
 assert.match(css,/body\.playerTheme #app #playerDesktopPanelContent \.playerResultCard \.finalClubToggle\{[\s\S]*?background:#eaf3f8!important;color:#14344a!important/);
 assert.match(css,/body:not\(\.playerTheme\):not\(\.authMode\) #app #adminZone-results \.finalClubToggle\{[\s\S]*?background:#eaf3f8!important;color:#14344a!important/);
 assert.match(css,/-webkit-text-fill-color:#14344a!important/);
});
test('V242: visible, tappable checkbox and keyboard focus, no change to table rendering',()=>{
 assert.match(css,/\.finalClubToggle input\[type="checkbox"\]\{[\s\S]*?width:20px!important;height:20px!important/);
 assert.match(css,/accent-color:#125e92!important/);
 assert.match(css,/\.finalClubToggle input\[type="checkbox"\]:focus-visible/);
 assert.match(app,/function renderFinalClubToggle\(\)\{return '<label class="checkline finalClubToggle"/);
 assert.match(app,/onchange="toggleFinalClub\(this\)"/);
 assert.match(app,/if\(panel==='general'\)return '[^']*'/);
 assert.match(app,/renderFinalClubToggle\(\)\+renderGeneralTable/);
});
test('V242: contrast stylesheet is in online and offline shell, version synchronized',()=>{
 assert.match(server,/if\(path==='\/result-contrast-v242\.css'\)/);
 assert.match(server,/const RESULT_CONTRAST_CSS='\/result-contrast-v242\.css\?v=\$\{APP_VERSION\}'/);
 assert.match(server,/<link rel="stylesheet" href="\/result-contrast-v242\.css\?v=\$\{APP_VERSION\}">/);
 assert.match(server,/HISTORY_COMPACT_CSS,DRAW_CSS,RESULT_CONTRAST_CSS,DESKTOP_DRAW_CSS,DRAW_JS/);
 assert.match(server,/const APP_VERSION = '243'/);
 assert.match(app,/const CLIENT_VERSION='243'/);
 assert.match(server,/class="headerVersion">V243</);
});
