'use strict';
const fs=require('fs');
const path=require('path');
const src=path.join(__dirname,'activate-history-accounts.cjs');
const dst=path.join(__dirname,'activate-history-accounts.runtime.cjs');
const code=fs.readFileSync(src,'utf8').replace(/total_grams/g,'weight');
fs.writeFileSync(dst,code);
require(dst);
