'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.join(__dirname,'..'),app=fs.readFileSync(path.join(root,'app.js'),'utf8'),
  server=fs.readFileSync(path.join(root,'server.cjs'),'utf8'),
  css=fs.readFileSync(path.join(root,'draw-ui-v240.css'),'utf8'),
  ui=fs.readFileSync(path.join(root,'draw-notice-ui-v240.js'),'utf8');
const {drawSpot,drawNoticeText,DRAW_NOTICE_TITLE}=require('../draw-notice.cjs');
const sample={id:501,type:'DRAW_PUBLISH',title:DRAW_NOTICE_TITLE,created_at:new Date().toISOString(),
  data:{competitionId:78,t1:{sector:'a',stand:6},t2:{sector:'c',stand:25}}};
function harness(){
 const stored=new Map(),added=[],events={},buttons={};
 let current=null,timeoutMs=0;
 const document={
  hidden:false,body:{appendChild(el){added.push(el);current=el}},
  addEventListener(type,fn){events[type]=fn},
  getElementById(id){return current?.id===id?current:null},
  createElement(tag){return {tag,innerHTML:'',id:'',attributes:{},setAttribute(k,v){this.attributes[k]=v},
    remove(){if(current===this)current=null},querySelector(selector){return {addEventListener(type,fn){buttons[selector+type]=fn}}}}}
 };
 const window={readNotif:async()=>{},showTab:()=>{},openCompetition:async()=>true,showPlayerMobilePanel:()=>{}};
 const ctx={document,window,localStorage:{getItem:k=>stored.get(k)||null,setItem:(k,v)=>stored.set(k,v)},navigator:{onLine:true},
  setTimeout:(_,ms)=>{timeoutMs=ms;return 1},clearTimeout:()=>{},setInterval:()=>2,clearInterval:()=>{},console};
 vm.runInNewContext(ui,ctx);
 return {window,document,stored,added,events,buttons,current:()=>current,timeoutMs:()=>timeoutMs};
}
test('V240: official push copy contains spaced sector and stand – A 6 and C 25',()=>{
 assert.equal(DRAW_NOTICE_TITLE,'NOWE LOSOWANIE NA DZIŚ');
 assert.equal(drawSpot({sector:'a',stand:6}),'A 6');
 assert.equal(drawSpot({sector:'c',stand:25}),'C 25');
 assert.equal(drawSpot({sector:'',stand:25}),'');
 assert.equal(drawSpot({sector:'A',stand:null}),'');
 assert.equal(drawNoticeText(sample.data.t1,sample.data.t2),
   'TURA 1 – A 6\nTURA 2 – C 25\nPowodzenia! 🎣');
 assert.equal(drawNoticeText(sample.data.t1,null),'TURA 1 – A 6\nPowodzenia! 🎣');
 assert.match(server,/drawNoticeText\(first,second\)/);
});
test('V240: rich inbox uses colored round tiles with spaced, genuine drawing data',()=>{
 const h=harness();h.window.lowcyDrawNoticeOnNotifications([sample],77);
 const html=h.window.lowcyDrawNoticeInbox(sample);
 assert.match(html,/class="drawNoticeTile round1"/);
 assert.match(html,/class="drawNoticeTile round2"/);
 assert.match(html,/<strong>A 6<\/strong>/);
 assert.match(html,/<strong>C 25<\/strong>/);
 assert.match(html,/ZOBACZ LOSOWANIE/);
 assert.doesNotMatch(html,/<strong>A6<\/strong>|<strong>C25<\/strong>/);
 assert.doesNotMatch(h.window.lowcyDrawNoticeInbox({...sample,data:{}}),/drawNoticeTile/);
});
test('V240: prominent popup stays for 15 seconds and is once per notification',()=>{
 const h=harness();h.window.lowcyDrawNoticeOnNotifications([sample],77);
 assert.equal(h.added.length,1);
 assert.equal(h.current().id,'drawNoticeToast');
 assert.match(h.current().innerHTML,/<strong>A 6<\/strong>/);
 assert.match(h.current().innerHTML,/<strong>C 25<\/strong>/);
 assert.equal(h.timeoutMs(),15000);
 h.window.lowcyDrawNoticeOnNotifications([sample],77);
 assert.equal(h.added.length,1);
 h.buttons['.drawNoticeCloseclick']();
 assert.equal(h.current(),null);
 h.window.lowcyDrawNoticeOnNotifications([sample],77);
 assert.equal(h.added.length,1,'one appearance only, even after manual close');
});
test('V240: notification opens the current competition in the T1 drawing panel',async()=>{
 const h=harness(),actions=[];
 h.window.readNotif=async id=>actions.push('read:'+id);
 h.window.showTab=name=>actions.push('tab:'+name);
 h.window.openCompetition=async(id)=>{actions.push('competition:'+id);return true};
 h.window.showPlayerMobilePanel=panel=>actions.push('panel:'+panel);
 h.window.lowcyDrawNoticeOnNotifications([sample],77);
 h.buttons['.drawNoticeOpenclick']();
 // The event action is asynchronous: wait for the microtasks that await read and open.
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(actions,['read:501','tab:competitions','competition:78','panel:draw1']);
});
test('V240: lower MAPA button is always first-tour map even with two published tours',()=>{
 const from=app.indexOf('function playerDockLatestMap('),end=app.indexOf('function playerDockLatestResults(',from);
 assert.ok(from>=0&&end>from);
 const ctx={};vm.runInNewContext(app.slice(from,end)+'this.map=playerDockLatestMap;',ctx);
 assert.equal(ctx.map({draws:[{round:1},{round:2}]}),'map1');
 assert.equal(ctx.map({draws:[{round:1}]}),'map1');
});
test('V240: premium draw styles preserve large TURA, darker stand and large MAPA/TABELA controls',()=>{
 assert.match(css,/\.playerMapNav \.mapTile/);
 assert.match(css,/linear-gradient\(145deg,#bd3043,#791324\)/);
 assert.match(css,/\.playerOwnRoundLabel\{/);
 assert.match(css,/\.playerOwnStandBlock\{/);
 assert.match(css,/linear-gradient\(150deg,#06704f,#04432f\)/);
 assert.match(css,/linear-gradient\(150deg,#1d76ad,#123e72\)/);
 assert.match(css,/\.playerDrawViewSwitch button\{/);
 assert.match(css,/min-height:52px!important/);
 assert.match(css,/\.drawNoticeTile\.round1/);
 assert.match(css,/\.drawNoticeTile\.round2/);
 assert.match(css,/animation:drawNoticeCountdown 15s/);
 assert.match(css,/@media\(max-width:350px\)/);
});
test('V240: assets included in production shell and code version is synchronized',()=>{
 assert.match(server,/const DRAW_CSS='\/draw-ui-v240\.css\?v=\$\{APP_VERSION\}'/);
 assert.match(server,/const DRAW_JS='\/draw-notice-ui-v240\.js\?v=\$\{APP_VERSION\}'/);
 assert.match(server,/<link rel="stylesheet" href="\/draw-ui-v240\.css\?v=\$\{APP_VERSION\}">/);
 assert.match(server,/<script src="\/draw-notice-ui-v240\.js\?v=\$\{APP_VERSION\}" defer><\/script>/);
 assert.match(server,/const APP_VERSION = '241'/);
 assert.match(app,/const CLIENT_VERSION='241'/);
 assert.match(server,/class="headerVersion">V241</);
});
