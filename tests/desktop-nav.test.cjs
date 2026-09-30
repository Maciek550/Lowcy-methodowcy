'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..');
const css=fs.readFileSync(path.join(root,'desktop-nav-v238.css'),'utf8');
const app=fs.readFileSync(path.join(root,'app.js'),'utf8');
const server=fs.readFileSync(path.join(root,'server.cjs'),'utf8');

function navigationHarness(role='PLAYER',wide=true){
  const from=app.indexOf('let PLAYER_TOP_NAV_MEDIA=null;');
  const end=app.indexOf('async function boot(){',from);
  assert.ok(from>=0&&end>from);
  const nodes={'btn-rules':{innerHTML:'Regulamin<br>ogólny'},'btn-history':{innerHTML:'Historia<br>startów'}};
  const media={matches:wide,listener:null,addEventListener(type,handler){assert.equal(type,'change');this.listener=handler}};
  const ctx={ME:{role},q:id=>nodes[id],window:{matchMedia:q=>{assert.equal(q,'(min-width:761px)');return media}}};
  vm.runInNewContext(app.slice(from,end)+';this.syncLabels=syncPlayerDesktopNavLabels;this.initLabels=initPlayerDesktopNavLabels;',ctx);
  return {ctx,nodes,media};
}
test('V238 desktop: section names fit one row at desktop widths and resync on resize',()=>{
  const {ctx,nodes,media}=navigationHarness();
  ctx.initLabels();
  assert.equal(nodes['btn-rules'].innerHTML,'Regulamin ogólny');
  assert.equal(nodes['btn-history'].innerHTML,'Historia startów');
  assert.equal(typeof media.listener,'function');
  media.matches=false;media.listener();
  assert.equal(nodes['btn-rules'].innerHTML,'Regulamin<br>ogólny');
  assert.equal(nodes['btn-history'].innerHTML,'Historia<br>startów');
  media.matches=true;media.listener();
  assert.equal(nodes['btn-rules'].innerHTML,'Regulamin ogólny');
});
test('V238 mobile: old two-line button labels remain unchanged',()=>{
  const {ctx,nodes}=navigationHarness('PLAYER',false);
  ctx.initLabels();
  assert.equal(nodes['btn-rules'].innerHTML,'Regulamin<br>ogólny');
  assert.equal(nodes['btn-history'].innerHTML,'Historia<br>startów');
});
test('V238 admin: desktop navigation makeover does not alter administrator labels',()=>{
  const {ctx,nodes,media}=navigationHarness('ADMIN',true);
  ctx.initLabels();ctx.syncLabels();
  assert.equal(media.listener,null);
  assert.equal(nodes['btn-rules'].innerHTML,'Regulamin<br>ogólny');
});
test('V238 CSS: only desktop player navigation, equal height, single line and uniform navy',()=>{
  assert.match(css,/@media\s*\(min-width:761px\)/);
  assert.doesNotMatch(css,/@media\s*\(max-width:760px\)/);
  assert.match(css,/body\.playerTheme:not\(\.authMode\) #app > \.tabs/);
  assert.match(css,/flex-wrap:nowrap!important/);
  assert.match(css,/height:50px!important/);
  assert.match(css,/white-space:nowrap!important/);
  assert.match(css,/background:linear-gradient\(180deg,#21465e,#102d40\)!important/);
  assert.match(css,/\.topNotifBadge/);
  assert.match(css,/background:#ffdb71/);
  assert.match(css,/:focus-visible/);
  assert.match(css,/\.hidden\s*\{\s*display:none!important/);
});
test('V238 asset loaded last, cached for offline use, version synchronized',()=>{
  assert.match(server,/<link rel="stylesheet" href="\/desktop-nav-v238\.css\?v=\$\{APP_VERSION\}">/);
  assert.ok(server.indexOf('<link rel="stylesheet" href="/desktop-nav-v238.css')>server.indexOf('<link rel="stylesheet" href="/compact-player-v237.css'));
  assert.match(server,/const DESKTOP_NAV_CSS='\/desktop-nav-v238\.css\?v=\$\{APP_VERSION\}'/);
  assert.match(server,/const APP_VERSION = '252'/);
  assert.match(app,/const CLIENT_VERSION='252'/);
  assert.match(server,/class="headerVersion">V252</);
});
