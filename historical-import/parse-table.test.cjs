'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');
const {parseDelimitedResults}=require('./parse-table.cjs');
const meta={title:'Gołębiówka',date:'2026-07-18'};
test('parse semicolon table',()=>{const d=parseDelimitedResults('Zawodnik;Sektor;Stanowisko;Waga;BF\nJan Kowalski;A;2;1230;230',meta);assert.equal(d.rows[0].weight,1230);assert.equal(d.rows[0].bigFish,230)});
test('parse tab table',()=>assert.equal(parseDelimitedResults('name\tsector\tstand\tweight\nJan Kowalski\tA\t2\t0',meta).rows.length,1));
test('reject missing stand column',()=>assert.throws(()=>parseDelimitedResults('name;sector;weight\nJan Kowalski;A;1230',meta),/stand/));
test('reject ambiguous weight',()=>assert.throws(()=>parseDelimitedResults('name;sector;stand;weight\nJan Kowalski;A;2;1,23',meta),/gramach/));
test('reject duplicate stand',()=>assert.throws(()=>parseDelimitedResults('name;sector;stand;weight\nJan Kowalski;A;2;100\nJan Nowak;A;2;100',meta),/Powtórzony/));
