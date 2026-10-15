'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'..');

test('V288 mobile player cards use silver gunmetal styling',()=>{
  const css=fs.readFileSync(path.join(root,'players-dark-v283.css'),'utf8');
  assert.match(css,/V288 — MOBILE Zawodnicy/);
  assert.match(css,/#playersList \.mobilePlayersList \.mobileAdminCard\.mobilePlayerManageCard/);
  assert.match(css,/#a2adb3/);
});

test('password recovery confirmations never use the browser native confirm',()=>{
  const js=fs.readFileSync(path.join(root,'password-recovery-ui.js'),'utf8');
  assert.match(js,/async function passwordConfirm\(message\)/);
  assert.equal(js.includes('window.confirm('),false);
  assert.equal(js.includes('confirm('),false);
  assert.equal((js.match(/await passwordConfirm\(/g)||[]).length,3);
});

test('server and client use the same current version for PWA cache refresh',()=>{
  const server=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
  const client=fs.readFileSync(path.join(root,'app.js'),'utf8');
  const serverVersion=server.match(/const APP_VERSION = '(\\d+)';/);
  const clientVersion=client.match(/const CLIENT_VERSION='(\\d+)';/);
  assert.ok(serverVersion,'server version must be declared');
  assert.ok(clientVersion,'client version must be declared');
  assert.equal(serverVersion[1],clientVersion[1]);
  assert.match(server,/lowcy-shell-v\\$\\{APP_VERSION\\}/);
});
