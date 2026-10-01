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

test('server exposes V289 so PWA shell cache refreshes',()=>{
  const js=fs.readFileSync(path.join(root,'server.cjs'),'utf8');
  assert.match(js,/const APP_VERSION = '289';/);
  assert.match(js,/V289_MOBILE_PLAYERS_SILVER_CONFIRM_SYNC/);
});
