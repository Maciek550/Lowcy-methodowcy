
const http = require('http');
const fs = require('fs');
const pathModule = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
let jwt = null;
try { jwt = require('jsonwebtoken'); } catch (_) {}
let webpush = null;
try { webpush = require('web-push'); } catch (_) {}
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ADMIN_SETUP_CODE = process.env.ADMIN_SETUP_CODE || '';
let VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
let VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@carp.local';
const APP_VERSION = '97';
const APP_VERSION_NAME = 'V98_COMPACT_PLAYER_CARDS_POLISH';
const APP_JS = fs.readFileSync(pathModule.join(__dirname, 'app.js'), 'utf8');
const ICON_192 = fs.readFileSync(pathModule.join(__dirname, 'icon-192.png'));
const ICON_512 = fs.readFileSync(pathModule.join(__dirname, 'icon-512.png'));
const ICON_180 = fs.readFileSync(pathModule.join(__dirname, 'apple-touch-icon.png'));
const ICON_64 = fs.readFileSync(pathModule.join(__dirname, 'icon-64.png'));
const FAVICON_32 = fs.readFileSync(pathModule.join(__dirname, 'favicon-32.png'));


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
  max: 8,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 8000
});

function nowIso() { return new Date().toISOString(); }
function safeJsonParse(s) { try { return JSON.parse(s || '{}'); } catch { return {}; } }
function normalizePhone(s) { return String(s || '').trim().replace(/\s+/g, ''); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function intOrNull(v) { const n = Number.parseInt(String(v ?? '').trim(), 10); return Number.isFinite(n) ? n : null; }
function clampInt(v, min, max, fallback) { const n = intOrNull(v); if (n === null) return fallback; return Math.max(min, Math.min(max, n)); }
function grams(v) { const cleaned = String(v ?? '').replace(/[^0-9]/g, ''); const n = Number.parseInt(cleaned || '0', 10); return Math.max(0, Math.min(9999999, Number.isFinite(n) ? n : 0)); }
function send(res, status, data, headers={}) {
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  res.writeHead(status, Object.assign({
    'Content-Type': typeof data === 'string' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }, headers));
  res.end(body);
}
function sendJson(res, status, data) { send(res, status, data, {'Content-Type':'application/json; charset=utf-8'}); }
function sendBinary(res,status,buf,type='application/octet-stream',cache='public, max-age=604800'){res.writeHead(status,{'Content-Type':type,'Content-Length':buf.length,'Cache-Control':cache});res.end(buf);}

async function readBody(req) {
  return await new Promise((resolve, reject) => {
    let b = '';
    req.on('data', c => { b += c; if (b.length > 2_000_000) { req.destroy(); reject(new Error('Payload too large')); }});
    req.on('end', () => resolve(safeJsonParse(b)));
    req.on('error', reject);
  });
}

function signToken(user) {
  if (jwt) return jwt.sign({ uid:user.id, role:user.role }, JWT_SECRET, { expiresIn:'90d' });
  const payload = Buffer.from(JSON.stringify({ uid:user.id, role:user.role, exp: Date.now() + 90*24*3600*1000 })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
  return payload + '.' + sig;
}
function verifyToken(token) {
  if (!token) return null;
  if (jwt) {
    try { return jwt.verify(token, JWT_SECRET); } catch { return null; }
  }
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(payload).digest('base64url');
  if (expected !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch { return null; }
}
async function auth(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  const p = verifyToken(token);
  if (!p) return null;
  try {
    const { rows } = await pool.query('select id, phone, first_name, last_name, pzw_club, role, created_at, account_source, last_login_at from users where id=$1', [p.uid]);
    return rows[0] || null;
  } catch { return null; }
}
function requireUser(user, res) {
  if (!user) { sendJson(res, 401, { ok:false, error:'Brak logowania' }); return false; }
  return true;
}
function requireAdmin(user, res) {
  if (!requireUser(user, res)) return false;
  if (user.role !== 'ADMIN') { sendJson(res, 403, { ok:false, error:'Brak uprawnień admina' }); return false; }
  return true;
}

async function initDb() {
  await pool.query(`
    create table if not exists users (
      id bigserial primary key,
      phone text unique not null,
      password_hash text not null,
      first_name text not null,
      last_name text not null,
      pzw_club text not null default '',
      role text not null default 'PLAYER',
      created_at timestamptz not null default now()
    );
    create table if not exists competitions (
      id bigserial primary key,
      title text not null,
      fishery text not null default '',
      competition_date date,
      limit_places integer,
      status text not null default 'OPEN',
      notes text not null default '',
      created_by bigint references users(id),
      created_at timestamptz not null default now()
    );
    create table if not exists entries (
      id bigserial primary key,
      competition_id bigint not null references competitions(id) on delete cascade,
      user_id bigint not null references users(id) on delete cascade,
      status text not null default 'ACTIVE',
      joined_at timestamptz not null default now(),
      cancelled_at timestamptz,
      unique(competition_id, user_id)
    );
    create table if not exists notifications (
      id bigserial primary key,
      recipient_user_id bigint references users(id) on delete cascade,
      type text not null,
      title text not null,
      body text not null,
      data jsonb not null default '{}'::jsonb,
      read_at timestamptz,
      created_at timestamptz not null default now()
    );
    create table if not exists leave_requests (
      id bigserial primary key,
      competition_id bigint not null references competitions(id) on delete cascade,
      user_id bigint not null references users(id) on delete cascade,
      status text not null default 'PENDING',
      created_at timestamptz not null default now(),
      decided_at timestamptz,
      decided_by bigint references users(id)
    );
    create unique index if not exists leave_requests_one_pending_idx on leave_requests(competition_id,user_id) where status='PENDING';
    create table if not exists push_subscriptions (
      id bigserial primary key,
      user_id bigint not null references users(id) on delete cascade,
      endpoint text not null unique,
      subscription jsonb not null,
      created_at timestamptz not null default now()
    );
    create table if not exists app_settings (
      key text primary key,
      value text not null
    );
  `);
  await pool.query(`
    alter table users add column if not exists account_source text not null default 'SELF';
    alter table users add column if not exists last_login_at timestamptz;
    update users set account_source='ADMIN' where role='PLAYER' and (phone like 'MANUAL-%' or phone like 'ZPRO-%' or phone like 'IMPORT-%');
    update users set last_login_at=created_at where role='PLAYER' and account_source='SELF' and last_login_at is null and phone not like 'MANUAL-%' and phone not like 'ZPRO-%' and phone not like 'IMPORT-%';
  `);
  await pool.query(`
    alter table competitions add column if not exists map_mode text not null default 'TWO_OPPOSITE';
    alter table competitions add column if not exists bank1_count integer not null default 15;
    alter table competitions add column if not exists bank2_count integer not null default 15;
    alter table competitions add column if not exists sectors_count integer not null default 4;
    alter table competitions add column if not exists signup_open boolean not null default true;
    alter table competitions add column if not exists sector_layout jsonb;
    alter table competitions add column if not exists meeting_time time;
    alter table competitions add column if not exists regulations text not null default '';
    alter table competitions alter column meeting_time set default '06:00';
    update competitions set meeting_time='06:00' where meeting_time is null;
  `);
  await pool.query(`
    alter table entries add column if not exists confirmed boolean not null default false;
    alter table entries add column if not exists confirmed_at timestamptz;
  `);
  await pool.query(`
    create table if not exists draws (
      id bigserial primary key,
      competition_id bigint not null references competitions(id) on delete cascade,
      user_id bigint not null references users(id) on delete cascade,
      round integer not null check (round in (1,2)),
      stand integer not null,
      sector text not null default '',
      created_at timestamptz not null default now(),
      unique(competition_id, user_id, round),
      unique(competition_id, round, stand)
    );
    create table if not exists results (
      id bigserial primary key,
      competition_id bigint not null references competitions(id) on delete cascade,
      user_id bigint not null references users(id) on delete cascade,
      round integer not null check (round in (1,2)),
      weight integer not null default 0,
      big_fish integer not null default 0,
      updated_at timestamptz not null default now(),
      unique(competition_id, user_id, round)
    );
    create table if not exists result_items (
      id bigserial primary key,
      competition_id bigint not null references competitions(id) on delete cascade,
      user_id bigint not null references users(id) on delete cascade,
      round integer not null check (round in (1,2)),
      kind text not null check (kind in ('NET','BF')),
      weight integer not null default 0,
      created_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    insert into result_items(competition_id,user_id,round,kind,weight,created_at)
    select r.competition_id,r.user_id,r.round,'NET',r.weight,r.updated_at
    from results r
    where r.weight > 0
      and not exists (
        select 1 from result_items i
        where i.competition_id=r.competition_id and i.user_id=r.user_id and i.round=r.round
      );
    insert into result_items(competition_id,user_id,round,kind,weight,created_at)
    select r.competition_id,r.user_id,r.round,'BF',r.big_fish,r.updated_at
    from results r
    where r.big_fish > 0
      and not exists (
        select 1 from result_items i
        where i.competition_id=r.competition_id and i.user_id=r.user_id and i.round=r.round and i.kind='BF'
      );
  `);
  await ensureVapidConfig();
}

async function ensureVapidConfig(){
  if(!webpush)return false;
  if(!VAPID_PUBLIC_KEY||!VAPID_PRIVATE_KEY){
    const q=await pool.query(`select key,value from app_settings where key in ('vapid_public_key','vapid_private_key')`);
    const m=new Map(q.rows.map(r=>[r.key,r.value]));
    VAPID_PUBLIC_KEY=VAPID_PUBLIC_KEY||m.get('vapid_public_key')||'';
    VAPID_PRIVATE_KEY=VAPID_PRIVATE_KEY||m.get('vapid_private_key')||'';
    if((!VAPID_PUBLIC_KEY||!VAPID_PRIVATE_KEY)&&typeof webpush.generateVAPIDKeys==='function'){
      const keys=webpush.generateVAPIDKeys();VAPID_PUBLIC_KEY=keys.publicKey;VAPID_PRIVATE_KEY=keys.privateKey;
      await pool.query(`insert into app_settings(key,value) values('vapid_public_key',$1),('vapid_private_key',$2) on conflict(key) do update set value=excluded.value`,[VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY]);
      console.log('PUSH_VAPID_GENERATED_AND_SAVED');
    }
  }
  if(VAPID_PUBLIC_KEY&&VAPID_PRIVATE_KEY){webpush.setVapidDetails(VAPID_SUBJECT,VAPID_PUBLIC_KEY,VAPID_PRIVATE_KEY);return true}
  return false;
}

async function waitForDb() {
  const deadline = Date.now() + 90_000;
  let lastErr = null;
  while (Date.now() < deadline) {
    try {
      await pool.query('select 1');
      await initDb();
      console.log('CARP_MOBILE_DB_READY');
      return;
    } catch (e) {
      lastErr = e;
      console.log('DB_WAIT ' + e.message);
      await new Promise(r => setTimeout(r, 2500));
    }
  }
  throw lastErr || new Error('DB not ready');
}

async function pushToUser(userId, title, body, url='/', meta={}) {
  if (!webpush || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return { ready:false, sent:0, failed:0 };
  const subs = await pool.query('select id, subscription from push_subscriptions where user_id=$1', [userId]);
  let sent=0,failed=0;
  for (const s of subs.rows) {
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify({ title, body, url, type:meta.type||'', competitionId:meta.competitionId||null }));
      sent++;
    } catch (e) {
      failed++;
      console.log('PUSH_SEND_ERR user=' + userId + ' sub=' + s.id + ' ' + e.message);
      if (Number(e.statusCode)===404 || Number(e.statusCode)===410) await pool.query('delete from push_subscriptions where id=$1',[s.id]).catch(()=>{});
    }
  }
  return { ready:true, sent, failed };
}
function playerPushType(type){return ['NEW_COMPETITION','DRAW_PUBLISH','RESULTS_T1','RESULTS_T2','RESULTS_GENERAL'].includes(String(type||''))}
async function notifyUser(userId, type, title, body, data={}) {
  await pool.query('insert into notifications(recipient_user_id,type,title,body,data) values($1,$2,$3,$4,$5)', [userId, type, title, body, data]);
  const u=await pool.query('select role from users where id=$1',[userId]);
  const role=u.rows[0]?.role||'PLAYER';
  if(role==='ADMIN'||playerPushType(type))await pushToUser(userId,title,body,data.url||'/',{type,competitionId:data.competitionId});
}
async function notifyAdmins(type, title, body, data={}) {
  const admins = await pool.query(`select id from users where role='ADMIN'`);
  for (const admin of admins.rows) await notifyUser(admin.id, type, title, body, Object.assign({ url:'/admin' }, data));
}


function competitionStandTotal(comp) {
  const b1 = Math.max(0, Number(comp.bank1_count || 0));
  const b2 = Math.max(0, Number(comp.bank2_count || 0));
  return Math.max(1, b1 + b2);
}

function autoBankSplit(total, mode='TWO_OPPOSITE') {
  total = Math.max(1, Number(total || 1));
  if (mode === 'ONE_BANK') return { bank1: total, bank2: 0 };
  // Dolny brzeg = bank1. Przy nieparzystej liczbie dolny brzeg dostaje +1.
  return { bank1: Math.ceil(total / 2), bank2: Math.floor(total / 2) };
}
async function autoSyncBanksForRoster(competitionId) {
  const comp = await getCompetition(competitionId);
  if (!comp) return null;
  const cnt = await getRosterCounts(competitionId);
  const target = Math.max(1, Number(cnt.active_count || 0) || Number(comp.limit_places || 0) || competitionStandTotal(comp));
  const split = autoBankSplit(target, comp.map_mode || 'TWO_OPPOSITE');
  const { rows } = await pool.query('update competitions set bank1_count=$1, bank2_count=$2, sector_layout=case when bank1_count+bank2_count=$4 then sector_layout else null end where id=$3 returning *', [split.bank1, split.bank2, competitionId, split.bank1+split.bank2]);
  return rows[0] || null;
}
function sectorSizes(total, n, mode) {
  total = Math.max(1, Number(total || 1));
  n = Math.max(1, Math.min(26, Number(n || 1), total));
  const base = Math.floor(total / n);
  const rem = total % n;
  // Reguła z projektu losowania: sektory różnią się maksymalnie o 1.
  // Najmniej liczny jest A, potem B itd.; nadwyżka idzie na końcowe sektory.
  return Array.from({ length:n }, (_, i) => base + (i >= n - rem ? 1 : 0));
}
function allocateBottomCountsForSectors(sizes, bank1, bank2, mode) {
  bank1 = Math.max(0, Number(bank1 || 0));
  bank2 = Math.max(0, Number(bank2 || 0));
  const total = Math.max(1, bank1 + bank2);
  if ((mode || 'TWO_OPPOSITE') === 'ONE_BANK') return sizes.slice();
  const raw = sizes.map((s, i) => ({ i, size:s, val:s * bank1 / total }));
  const bottom = raw.map(x => Math.max(0, Math.min(x.size, Math.floor(x.val))));
  let diff = bank1 - bottom.reduce((a,b)=>a+b,0);
  if (diff > 0) {
    const altRank = i => (i % 2 === 0 ? Math.floor(i / 2) : Math.ceil(raw.length / 2) + Math.floor(i / 2));
    const order = raw.slice().sort((a,b)=>((b.val - Math.floor(b.val)) - (a.val - Math.floor(a.val))) || (((mode || 'TWO_OPPOSITE') === 'TWO_OPPOSITE') ? (altRank(a.i) - altRank(b.i)) : (a.i - b.i)));
    let guard = 0;
    while (diff > 0 && guard++ < 1000) {
      let changed = false;
      for (const x of order) {
        if (diff <= 0) break;
        if (bottom[x.i] < x.size) { bottom[x.i]++; diff--; changed = true; }
      }
      if (!changed) break;
    }
  } else if (diff < 0) {
    const order = raw.slice().sort((a,b)=>((a.val - Math.floor(a.val)) - (b.val - Math.floor(b.val))) || b.i - a.i);
    let guard = 0;
    while (diff < 0 && guard++ < 1000) {
      let changed = false;
      for (const x of order) {
        if (diff >= 0) break;
        if (bottom[x.i] > 0) { bottom[x.i]--; diff++; changed = true; }
      }
      if (!changed) break;
    }
  }
  return bottom;
}
function parseStandSpec(value) {
  if (Array.isArray(value)) return value.map(Number);
  const out = [];
  for (const token of String(value || '').split(/[;,]+/).map(x => x.trim()).filter(Boolean)) {
    const m = token.match(/^(\d+)\s*[-–—]\s*(\d+)$/);
    if (m) {
      const a = Number(m[1]); const b = Number(m[2]);
      const step = a <= b ? 1 : -1;
      for (let n=a; ; n+=step) { out.push(n); if (n === b) break; }
    } else if (/^\d+$/.test(token)) out.push(Number(token));
    else throw new Error('Nieprawidłowy zapis stanowisk: "' + token + '"');
  }
  return out;
}
function validateSectorLayout(raw, total, sectorsCount) {
  if (raw === undefined) return undefined;
  if (raw === null || raw === '') return null;
  if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (_) { throw new Error('Nieprawidłowe dane sektorów'); } }
  if (!Array.isArray(raw) || raw.length !== Number(sectorsCount)) throw new Error('Liczba paneli sektorów musi zgadzać się z polem „Liczba sektorów”');
  const seenStands = new Map(); const seenNames = new Set(); const normalized = [];
  raw.forEach((item, idx) => {
    const name = String(item?.name ?? item?.letter ?? '').trim() || String.fromCharCode(65 + idx);
    if (name.length > 12) throw new Error('Nazwa sektora ' + (idx + 1) + ' jest za długa');
    const nameKey = name.toLocaleUpperCase('pl');
    if (seenNames.has(nameKey)) throw new Error('Nazwa sektora „' + name + '” jest powtórzona');
    seenNames.add(nameKey);
    const stands = parseStandSpec(item?.stands ?? item?.range);
    if (!stands.length) throw new Error('Sektor ' + name + ' nie ma stanowisk');
    const own = new Set();
    for (const stand of stands) {
      if (!Number.isInteger(stand) || stand < 1 || stand > total) throw new Error('Stanowisko ' + stand + ' jest poza zakresem 1–' + total);
      if (own.has(stand)) throw new Error('Stanowisko ' + stand + ' powtarza się w sektorze ' + name);
      if (seenStands.has(stand)) throw new Error('Stanowisko ' + stand + ' występuje w sektorach ' + seenStands.get(stand) + ' i ' + name);
      own.add(stand); seenStands.set(stand, name);
    }
    normalized.push({ name, stands:Array.from(own).sort((a,b)=>a-b) });
  });
  const missing = [];
  for (let n=1; n<=total; n++) if (!seenStands.has(n)) missing.push(n);
  if (missing.length) throw new Error('Brakuje stanowisk: ' + missing.join(', '));
  return normalized;
}
function customSectorLayout(comp) {
  const total = Math.max(1, Number(comp.bank1_count || 0) + Number(comp.bank2_count || 0));
  let normalized;
  try { normalized = validateSectorLayout(comp.sector_layout, total, comp.sectors_count || 1); } catch (_) { return null; }
  if (!Array.isArray(normalized)) return null;
  const b1 = Math.max(0, Number(comp.bank1_count || 0));
  const mode = comp.map_mode || 'TWO_OPPOSITE';
  return normalized.map((item, idx) => {
    const bottom = item.stands.filter(n => n <= b1).sort((a,b)=>a-b);
    const top = item.stands.filter(n => n > b1).sort((a,b)=>mode === 'TWO_OPPOSITE' ? b-a : a-b);
    return { letter:item.name || String.fromCharCode(65+idx), size:item.stands.length, bottomCount:bottom.length, topCount:top.length, bottom, top };
  });
}
function alongSectorCounts(sectors, bank1, bank2) {
  sectors = Math.max(1, Number(sectors || 1)); bank1 = Math.max(0, Number(bank1 || 0)); bank2 = Math.max(0, Number(bank2 || 0));
  if (!bank2) return [sectors, 0];
  if (!bank1) return [0, sectors];
  if (sectors === 1) return [1, 0];
  let best = null;
  for (let first=1; first<sectors; first++) {
    const second = sectors-first;
    if (first>bank1 || second>bank2) continue;
    const sizes = sectorSizes(bank1, first, 'ONE_BANK').concat(sectorSizes(bank2, second, 'ONE_BANK'));
    const spread = Math.max(...sizes)-Math.min(...sizes);
    const proportional = Math.abs(first/sectors-bank1/(bank1+bank2));
    const score = spread*100+proportional;
    if (!best || score<best.score) best={first,second,score};
  }
  if (best) return [best.first,best.second];
  const first = Math.max(1, Math.min(sectors-1, Math.round(sectors*bank1/(bank1+bank2))));
  return [first,sectors-first];
}
function sectorLayoutForCompetition(comp) {
  const b1 = Math.max(0, Number(comp.bank1_count || 0));
  const b2 = Math.max(0, Number(comp.bank2_count || 0));
  const total = Math.max(1, b1 + b2);
  const mode = comp.map_mode || 'TWO_OPPOSITE';
  const custom = customSectorLayout(comp);
  if (custom) return custom;
  if (mode === 'TWO_ALONG' && Number(comp.sectors_count || 1) > 1 && b1 > 0 && b2 > 0) {
    const counts = alongSectorCounts(Math.min(Number(comp.sectors_count || 1), total), b1, b2);
    const bottomSizes = sectorSizes(b1, counts[0], 'ONE_BANK');
    const topSizes = sectorSizes(b2, counts[1], 'ONE_BANK');
    let bottomCursor=1, topCursor=b1+1, idx=0; const out=[];
    for (const size of bottomSizes) { const bottom=[]; for(let i=0;i<size;i++)bottom.push(bottomCursor++); out.push({letter:String.fromCharCode(65+idx++),size,bottomCount:size,topCount:0,bottom,top:[]}); }
    for (const size of topSizes) { const top=[]; for(let i=0;i<size;i++)top.push(topCursor++); out.push({letter:String.fromCharCode(65+idx++),size,bottomCount:0,topCount:size,bottom:[],top}); }
    return out;
  }
  const sizes = sectorSizes(total, comp.sectors_count || 1, mode);
  const bottomCounts = allocateBottomCountsForSectors(sizes, b1, b2, mode);
  let bottomCursor = 1;
  let topCursorAsc = b1 + 1;
  let topCursorDesc = b1 + b2;
  return sizes.map((size, idx) => {
    const letter = String.fromCharCode(65 + idx);
    const bottomCount = mode === 'ONE_BANK' ? size : Math.max(0, Math.min(size, bottomCounts[idx] || 0));
    const topCount = mode === 'ONE_BANK' ? 0 : Math.max(0, size - bottomCount);
    const bottom = [];
    const top = [];
    for (let i=0; i<bottomCount; i++) if (bottomCursor <= b1) bottom.push(bottomCursor++);
    if (mode === 'TWO_ALONG') {
      for (let i=0; i<topCount; i++) if (topCursorAsc <= b1 + b2) top.push(topCursorAsc++);
    } else {
      for (let i=0; i<topCount; i++) if (topCursorDesc > b1) top.push(topCursorDesc--);
    }
    return { letter, size, bottomCount, topCount, bottom, top };
  });
}
function visualColumnCountForCompetition(comp) {
  const total = Math.max(1, Number(comp.bank1_count || 0) + Number(comp.bank2_count || 0));
  return sectorSizes(total, comp.sectors_count || 1, comp.map_mode || 'TWO_OPPOSITE').reduce((a,b)=>a+b,0);
}
function balancedColumnSpans(cols, sectors) {
  const sizes = sectorSizes(cols, sectors, 'ONE_BANK');
  let cursor = 1;
  return sizes.map((width, i) => {
    const sp = { letter:String.fromCharCode(65+i), start:cursor, end:cursor+width-1, width };
    cursor += width;
    return sp;
  });
}
function standColumnForCompetition(stand, comp) {
  stand = Number(stand);
  const layout = sectorLayoutForCompetition(comp);
  let cursor = 1;
  for (const sec of layout) {
    if (sec.bottom.includes(stand) || sec.top.includes(stand)) return cursor;
    cursor += sec.size;
  }
  return 1;
}
function sectorForColumn(col, spans) {
  col = Number(col || 1);
  for (const sp of spans) if (col >= sp.start && col <= sp.end) return sp.letter;
  return spans[spans.length - 1]?.letter || 'A';
}
function buildSectorMap(comp) {
  const map = new Map();
  for (const sec of sectorLayoutForCompetition(comp)) {
    for (const stand of sec.bottom) map.set(Number(stand), sec.letter);
    for (const stand of sec.top) map.set(Number(stand), sec.letter);
  }
  return map;
}
function sectorForStand(stand, comp) {
  const m = buildSectorMap(comp);
  return m.get(Number(stand)) || 'A';
}
function shuffle(a) {
  const x = a.slice();
  for (let i=x.length-1; i>0; i--) { const j = Math.floor(Math.random()*(i+1)); [x[i],x[j]]=[x[j],x[i]]; }
  return x;
}
function makeStandList(comp, activeCount) {
  let total = Number(comp.bank1_count || 0) + Number(comp.bank2_count || 0);
  if (!Number.isFinite(total) || total < activeCount) total = Math.max(activeCount, Number(comp.limit_places || 0), 1);
  return Array.from({length:total}, (_,i)=>i+1);
}
function bankMetaForStand(stand, comp) {
  stand = Number(stand);
  const b1 = Math.max(0, Number(comp.bank1_count || 0));
  const b2 = Math.max(0, Number(comp.bank2_count || 0));
  if (stand >= 1 && stand <= b1) return { bank:1, start:1, end:b1, count:b1, pos:stand };
  if (stand > b1 && stand <= b1 + b2) return { bank:2, start:b1+1, end:b1+b2, count:b2, pos:stand-b1 };
  return null;
}
function t2CandidatesForStand(t1Stand, comp, allowedStands) {
  const meta = bankMetaForStand(t1Stand, comp);
  if (!meta || meta.count < 2) return [];
  const n = meta.count;
  const pos = meta.pos;
  let fromPos, toPos;
  if (n % 2 === 0) {
    const half = n / 2;
    if (pos <= half) { fromPos = half + 1; toPos = n; }
    else { fromPos = 1; toPos = half; }
  } else {
    const mid = Math.ceil(n / 2);
    if (meta.bank === 1) {
      // Brzeg 1: 1..mid przechodzi do mid..n, a mid+1..n do 1..mid-1.
      if (pos <= mid) { fromPos = mid; toPos = n; }
      else { fromPos = 1; toPos = mid - 1; }
    } else {
      // Brzeg 2 jest lustrzanym odbiciem: środkowe stanowisko należy do drugiej grupy.
      if (pos < mid) { fromPos = mid + 1; toPos = n; }
      else { fromPos = 1; toPos = mid; }
    }
  }
  const ownIsEdge = pos === 1 || pos === n;
  const out = [];
  for (let p=fromPos; p<=toPos; p++) {
    const stand = meta.start + p - 1;
    if (!allowedStands.has(stand) || stand === Number(t1Stand)) continue;
    if (Math.abs(Number(stand) - Number(t1Stand)) < 2) continue;
    if (ownIsEdge && (p === 1 || p === n)) continue;
    out.push(stand);
  }
  return out;
}
function tryT2Matching(userIds, candidates, randomize=false) {
  const lists = new Map();
  for (const uid of userIds) {
    const src = (candidates.get(uid) || []).slice();
    const list = randomize ? shuffle(src) : src.sort((a,b)=>a-b);
    if (!list.length) return null;
    lists.set(uid, list);
  }
  const order = (randomize ? shuffle(userIds) : userIds.slice()).sort((a,b)=>lists.get(a).length-lists.get(b).length);
  const matchRight = new Map();
  function visit(uid, seen) {
    for (const stand of lists.get(uid)) {
      if (seen.has(stand)) continue;
      seen.add(stand);
      const other = matchRight.get(stand);
      if (other === undefined || visit(other, seen)) { matchRight.set(stand, uid); return true; }
    }
    return false;
  }
  for (const uid of order) if (!visit(uid, new Set())) return null;
  return matchRight.size === userIds.length ? matchRight : null;
}
function randomT2BankMatching(userIds, candidates) {
  if (!userIds.length) return new Map();
  for (let attempt=0; attempt<250; attempt++) {
    const match = tryT2Matching(userIds, candidates, true);
    if (match) return match;
  }
  return tryT2Matching(userIds, candidates, false);
}
function buildT2Assignment(entries, comp, stands, t1Map) {
  const allowed = new Set(stands.map(Number));
  const candidates = new Map();
  const byBank = new Map([[1,[]],[2,[]]]);
  for (const e of entries) {
    const uid=Number(e.user_id), own=Number(t1Map.get(uid));
    const meta=bankMetaForStand(own,comp);
    if (!meta) throw new Error('Losowanie T1 nie pasuje do aktualnego układu stanowisk');
    const list=t2CandidatesForStand(own,comp,allowed);
    if (!list.length) throw new Error('Nie da się poprawnie wylosować T2 przy aktualnym układzie stanowisk');
    candidates.set(uid,list);
    byBank.get(meta.bank).push(uid);
  }
  const matchRight=new Map();
  for (const bank of [1,2]) {
    const match=randomT2BankMatching(byBank.get(bank),candidates);
    if (!match || match.size!==byBank.get(bank).length) throw new Error('Nie da się poprawnie wylosować T2 przy aktualnym układzie stanowisk');
    for (const [stand,uid] of match.entries()) matchRight.set(stand,uid);
  }
  const userToStand=new Map();
  for (const [stand,uid] of matchRight.entries()) userToStand.set(Number(uid),Number(stand));
  return entries.map(e=>{
    const stand=userToStand.get(Number(e.user_id));
    return { userId:e.user_id, stand, sector:sectorForStand(stand,comp), name:e.first_name+' '+e.last_name };
  });
}
async function getCompetition(id) {
  const { rows } = await pool.query('select * from competitions where id=$1', [id]);
  return rows[0] || null;
}
async function getActiveEntries(id) {
  const { rows } = await pool.query(`
    select e.*, u.phone, u.first_name, u.last_name, u.pzw_club
    from entries e join users u on u.id=e.user_id
    where e.competition_id=$1 and e.status='ACTIVE'
    order by e.joined_at, u.last_name, u.first_name
  `, [id]);
  return rows;
}
async function getRosterCounts(competitionId) {
  const { rows } = await pool.query(`
    select
      count(*) filter (where status='ACTIVE')::int as active_count,
      count(*) filter (where status='RESERVE')::int as reserve_count,
      count(*) filter (where status='CANCELLED')::int as cancelled_count,
      count(*)::int as total_count
    from entries where competition_id=$1
  `, [competitionId]);
  return rows[0] || { active_count:0, reserve_count:0, cancelled_count:0, total_count:0 };
}
async function nextRosterStatus(competitionId, preferred='AUTO') {
  if (preferred === 'ACTIVE') return 'ACTIVE';
  if (preferred === 'RESERVE') return 'RESERVE';
  const comp = await getCompetition(competitionId);
  const limit = Number(comp?.limit_places || 0);
  if (!limit) return 'ACTIVE';
  const cnt = await getRosterCounts(competitionId);
  return Number(cnt.active_count || 0) >= limit ? 'RESERVE' : 'ACTIVE';
}
function rosterStatusLabel(s) {
  if (s === 'ACTIVE') return 'lista główna';
  if (s === 'RESERVE') return 'lista rezerwowa';
  if (s === 'CANCELLED') return 'wypisany';
  return String(s || '');
}

async function generateDraw(competitionId, round, actor) {
  let comp = await getCompetition(competitionId);
  if (!customSectorLayout(comp)) { await autoSyncBanksForRoster(competitionId); comp = await getCompetition(competitionId); }
  if (!comp) throw new Error('Nie znaleziono zawodów');
  const entries = await getActiveEntries(competitionId);
  if (!entries.length) throw new Error('Brak aktywnych zawodników do losowania');
  const stands = makeStandList(comp, entries.length);
  let assignment = [];

  if (round === 2) {
    const t1 = await pool.query('select user_id, stand from draws where competition_id=$1 and round=1', [competitionId]);
    const t1Map = new Map(t1.rows.map(r => [Number(r.user_id), Number(r.stand)]));
    const missingT1 = entries.filter(e=>!t1Map.has(Number(e.user_id)));
    if (missingT1.length || t1Map.size !== entries.length) throw new Error('Najpierw wykonaj ponownie losowanie T1 dla aktualnej listy zawodników');
    assignment = buildT2Assignment(entries, comp, stands, t1Map);
  } else {
    const poolStands = shuffle(stands).slice(0, entries.length);
    assignment = entries.map((e, idx) => ({ userId: e.user_id, stand: poolStands[idx], sector: sectorForStand(poolStands[idx], comp), name: e.first_name + ' ' + e.last_name }));
  }

  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query('delete from draws where competition_id=$1 and round=$2', [competitionId, round]);
    for (const a of assignment) {
      await client.query('insert into draws(competition_id,user_id,round,stand,sector) values($1,$2,$3,$4,$5)', [competitionId, a.userId, round, a.stand, a.sector]);
    }
    await client.query('commit');
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally { client.release(); }

  // Losowanie zapisuje dane, ale nie publikuje ich zawodnikom.
  // Powiadomienia do zawodników idą dopiero po kliknięciu "Publikuj losowanie".
  await notifyAdmins('DRAW_T'+round, 'Wykonano losowanie T'+round, `${actor.first_name} ${actor.last_name} wykonał losowanie T${round}: ${comp.title} — bez publikacji`, { competitionId, round });
  return assignment;
}

async function publishDraw(competitionId, actor) {
  const comp = await getCompetition(competitionId);
  if (!comp) throw new Error('Nie znaleziono zawodów');
  const active = await getActiveEntries(competitionId);
  if (!active.length) throw new Error('Brak zawodników na liście głównej');
  const dr = await pool.query('select * from draws where competition_id=$1 and round in (1,2)', [competitionId]);
  const by = new Map();
  for (const d of dr.rows) by.set(Number(d.user_id)+':' + Number(d.round), d);
  let notified = 0;
  for (const e of active) {
    const t1 = by.get(Number(e.user_id)+':1');
    const t2 = by.get(Number(e.user_id)+':2');
    if (!t1 && !t2) continue;
    const parts = [];
    if (t1) parts.push(`T1: stanowisko ${t1.stand}, sektor ${t1.sector}`);
    if (t2) parts.push(`T2: stanowisko ${t2.stand}, sektor ${t2.sector}`);
    await notifyUser(e.user_id, 'DRAW_PUBLISH', 'Twoje losowanie', `${comp.title}: ${parts.join(' | ')}`, { competitionId, t1:t1?{stand:t1.stand,sector:t1.sector}:null, t2:t2?{stand:t2.stand,sector:t2.sector}:null, url:'/' });
    notified++;
  }
  await notifyAdmins('DRAW_PUBLISH_ADMIN', 'Opublikowano losowanie', `${actor.first_name} ${actor.last_name} opublikował losowanie: ${comp.title}. Powiadomiono: ${notified}`, { competitionId, notified });
  return { notified };
}

function randomGram(min, max) {
  min = Number(min || 0); max = Number(max || min);
  const n = min + Math.floor(Math.random() * (max - min + 1));
  return Math.max(min, Math.min(max, Math.round(n / 100) * 100));
}
async function generateRandomResults(competitionId, round, actor) {
  const comp = await getCompetition(competitionId);
  if (!comp) throw new Error('Nie znaleziono zawodów');
  const entries = await getActiveEntries(competitionId);
  if (!entries.length) throw new Error('Brak zawodników na liście głównej');
  const client = await pool.connect();
  try {
    await client.query('begin');
    for (const e of entries) {
      const uid = Number(e.user_id);
      await client.query('delete from result_items where competition_id=$1 and user_id=$2 and round=$3', [competitionId, uid, round]);
      const net = randomGram(10000, 99000);
      const bf = randomGram(6000, 15000);
      await client.query('insert into result_items(competition_id,user_id,round,kind,weight) values($1,$2,$3,$4,$5)', [competitionId, uid, round, 'NET', net]);
      await client.query('insert into result_items(competition_id,user_id,round,kind,weight) values($1,$2,$3,$4,$5)', [competitionId, uid, round, 'BF', bf]);
      await refreshResultAggregate(client, competitionId, uid, round);
    }
    await client.query('commit');
  } catch (e) { await client.query('rollback'); throw e; }
  finally { client.release(); }
  await notifyAdmins('RESULTS_GENERATE_T'+round, 'Wygenerowano wyniki T'+round, `${actor.first_name} ${actor.last_name} wygenerował testowe wyniki T${round}: ${comp.title}`, { competitionId, round, count:entries.length });
  return { count: entries.length };
}

function computeClassification(comp, entries, draws, results) {
  const drawBy = new Map();
  for (const d of draws) drawBy.set(Number(d.user_id) + ':' + Number(d.round), d);
  const resBy = new Map();
  for (const r of results) resBy.set(Number(r.user_id) + ':' + Number(r.round), r);
  const roundRows = { 1: [], 2: [] };

  for (const round of [1,2]) {
    const grouped = new Map();
    for (const e of entries) {
      const d = drawBy.get(Number(e.user_id)+':'+round);
      const r = resBy.get(Number(e.user_id)+':'+round) || { weight:0, big_fish:0 };
      const row = {
        user_id: Number(e.user_id),
        name: e.first_name + ' ' + e.last_name,
        phone: e.phone,
        pzw_club: e.pzw_club,
        round,
        stand: d ? Number(d.stand) : null,
        sector: d ? d.sector : '-',
        weight: Number(r.weight || 0),
        big_fish: Number(r.big_fish || 0),
        sector_place: null,
        points: null
      };
      if (!grouped.has(row.sector)) grouped.set(row.sector, []);
      grouped.get(row.sector).push(row);
    }
    const maxSectorSize = Math.max(1, ...Array.from(grouped.values()).map(a => a.length));
    for (const rows of grouped.values()) {
      const positives = rows.filter(r => r.weight > 0).sort((a,b)=>b.weight-a.weight || a.name.localeCompare(b.name, 'pl'));
      let lastWeight = null, lastPlace = 0;
      positives.forEach((r, idx) => {
        const place = (lastWeight !== null && r.weight === lastWeight) ? lastPlace : idx + 1;
        r.sector_place = place;
        r.points = place;
        lastWeight = r.weight; lastPlace = place;
      });
      rows.filter(r => r.weight <= 0).forEach(r => { r.sector_place = maxSectorSize; r.points = maxSectorSize; });
    }
    roundRows[round] = Array.from(grouped.values()).flat().sort((a,b)=>(a.points-b.points) || (b.weight-a.weight) || String(a.sector).localeCompare(String(b.sector),'pl') || (a.stand||9999)-(b.stand||9999) || a.name.localeCompare(b.name,'pl'));
  }

  const r1 = new Map(roundRows[1].map(r => [r.user_id, r]));
  const r2 = new Map(roundRows[2].map(r => [r.user_id, r]));
  const general = entries.map(e => {
    const a = r1.get(Number(e.user_id));
    const b = r2.get(Number(e.user_id));
    return {
      user_id: Number(e.user_id),
      name: e.first_name + ' ' + e.last_name,
      pzw_club: e.pzw_club,
      t1_stand: a?.stand || null,
      t1_sector: a?.sector || '-',
      t1_points: a?.points || null,
      t1_weight: a?.weight || 0,
      t2_stand: b?.stand || null,
      t2_sector: b?.sector || '-',
      t2_points: b?.points || null,
      t2_weight: b?.weight || 0,
      sum_points: (a?.points || 0) + (b?.points || 0),
      total_weight: (a?.weight || 0) + (b?.weight || 0),
      biggest_fish: Math.max(a?.big_fish || 0, b?.big_fish || 0),
      rank: null
    };
  }).sort((a,b)=>(a.sum_points-b.sum_points) || (b.total_weight-a.total_weight) || a.name.localeCompare(b.name,'pl'));
  general.forEach((r,i)=>r.rank=i+1);
  return { round1: roundRows[1], round2: roundRows[2], general };
}



async function refreshResultAggregate(client, competitionId, userId, round) {
  const db = client || pool;
  const q = await db.query(`
    select coalesce(sum(weight),0)::int as total_weight,
           coalesce(max(weight) filter (where kind='BF'),0)::int as biggest_fish
    from result_items
    where competition_id=$1 and user_id=$2 and round=$3
  `, [competitionId, userId, round]);
  const total = Number(q.rows[0]?.total_weight || 0);
  const bf = Number(q.rows[0]?.biggest_fish || 0);
  await db.query(`
    insert into results(competition_id,user_id,round,weight,big_fish,updated_at)
    values($1,$2,$3,$4,$5,now())
    on conflict(competition_id,user_id,round) do update set
      weight=excluded.weight,
      big_fish=excluded.big_fish,
      updated_at=now()
  `, [competitionId, userId, round, total, bf]);
  return { weight:total, big_fish:bf };
}

async function addResultItem(competitionId, userId, round, kind, weight) {
  kind = String(kind || '').toUpperCase() === 'BF' ? 'BF' : 'NET';
  const g = grams(weight);
  if (!g) throw new Error('Podaj wagę większą od 0');
  const entry = await pool.query(`select 1 from entries where competition_id=$1 and user_id=$2 and status='ACTIVE'`, [competitionId, userId]);
  if (!entry.rows[0]) throw new Error('Ten zawodnik nie jest na liście głównej tych zawodów');
  const client = await pool.connect();
  try {
    await client.query('begin');
    const ins = await client.query(`
      insert into result_items(competition_id,user_id,round,kind,weight)
      values($1,$2,$3,$4,$5) returning *
    `, [competitionId, userId, round, kind, g]);
    const aggregate = await refreshResultAggregate(client, competitionId, userId, round);
    await client.query('commit');
    return { item:ins.rows[0], aggregate };
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally { client.release(); }
}

async function deleteResultItem(itemId) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const del = await client.query('delete from result_items where id=$1 returning *', [itemId]);
    const item = del.rows[0];
    if (!item) throw new Error('Nie znaleziono wpisu wagi');
    const aggregate = await refreshResultAggregate(client, item.competition_id, item.user_id, item.round);
    await client.query('commit');
    return { item, aggregate };
  } catch (e) {
    await client.query('rollback');
    throw e;
  } finally { client.release(); }
}

function decodeEntities(str) {
  return String(str || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(Number(n)); } catch { return ' '; } })
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCharCode(parseInt(n, 16)); } catch { return ' '; } });
}
function stripTagsToLines(html) {
  return decodeEntities(String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(tr|li|p|div|section|article|h\d|td|th)>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .split(/\r?\n/)
    .map(s => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}
function normalizePersonName(s) {
  return decodeEntities(String(s || ''))
    .replace(/[|•·]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[-–—\s]+|[-–—\s]+$/g, '')
    .trim();
}
function nameKey(s) {
  return normalizePersonName(s).toLocaleLowerCase('pl-PL').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}
function looksLikePersonName(s) {
  s = normalizePersonName(s);
  if (s.length < 5 || s.length > 80) return false;
  if (/\d/.test(s)) return false;
  if (!/[\p{L}]/u.test(s)) return false;
  const bad = /^(lp|zawodnik|zawodnik\s*\/\s*drużyna|drużyna|tura|strefa|sektor|stanowisko|wyniki|wynik|klasyfikacja|lista|startowa|opis|harmonogram|łowisko|organizator|sponsor|partnerzy|limit|dostępne|zajęte|suma|waga|max|min|big fish|live|wczytywanie|www|zaloguj|zapisz|tabela|mapa|otwórz|regulamin|cookies|ustawienia|akceptuj|anuluj)$/iu;
  if (bad.test(s)) return false;
  if (/(zawody\.pro|suma pkt|suma waga|pkt|kg|^t\d\b|tura|strefa|stanowisko|zawody zakończone|miejsca|zawodników|rezerwa|dostępne|zaloguj|kliknij|poniżej|organizator udostępni|wkrótce)/iu.test(s)) return false;
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length < 2 || words.length > 6) return false;
  return true;
}
function splitFullName(fullName) {
  const n = normalizePersonName(fullName);
  const parts = n.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName:n, lastName:'' };
  return { firstName:parts[0], lastName:parts.slice(1).join(' ') };
}
function addParsedName(target, seen, source, rawName) {
  const n = normalizePersonName(rawName);
  if (!looksLikePersonName(n)) return false;
  const key = nameKey(n);
  if (!key || seen.has(key)) return false;
  seen.add(key);
  const p = splitFullName(n);
  target.push({ fullName:n, firstName:p.firstName, lastName:p.lastName, pzwClub:'', source });
  return true;
}
function parseZawodyProPlayers(html) {
  const lines = stripTagsToLines(html);
  const players = [];
  const seen = new Set();
  const text = lines.join('\n');

  let listedCount = null;
  const countText = text.match(/Zajęte miejsca \(osoby\)\s*(\d+)\s*\/\s*(\d+)/iu) || text.match(/Zajęte miejsca:\s*(\d+)\s*\/\s*(\d+)/iu);
  if (countText) listedCount = Number(countText[1]);

  const tableRowRe = /^\s*\d+\s*\|\s*([^|\n]+?)\s*\|\s*(?:-|\d|[A-ZŁŚŻŹĆŃÓĘ])/gmi;
  let mr;
  while ((mr = tableRowRe.exec(text))) addParsedName(players, seen, 'tabela', mr[1]);

  for (let i = 0; i < lines.length; i++) {
    if (!/Lista\s+Startowa/iu.test(lines[i])) continue;
    const stop = Math.min(lines.length, i + 260);
    for (let j = i + 1; j < stop; j++) {
      if (j > i + 8 && /^(Opis|Harmonogram|Łowisko|Mapa|©|Regulamin|Wyniki Losowania)$/iu.test(lines[j])) break;
      if (/^\d{1,4}$/.test(lines[j]) && lines[j+1]) {
        addParsedName(players, seen, 'lista-startowa', lines[j+1]);
      }
      const row = lines[j].match(/^\s*\d+\s+([\p{L}][\p{L} .'-]+\s+[\p{L}][\p{L} .'-]+)\s+(?:T\d|[-–—])/u);
      if (row) addParsedName(players, seen, 'lista-startowa', row[1]);
    }
  }

  if (!players.length) {
    for (let i = 0; i < lines.length; i++) {
      if (/Klasyfikacja|Generalna|Tura|Lista/iu.test(lines[i])) {
        const stop = Math.min(lines.length, i + 420);
        for (let j = i + 1; j < stop; j++) {
          if (/^\d{1,3}$/.test(lines[j]) && lines[j+1]) addParsedName(players, seen, 'klasyfikacja', lines[j+1]);
        }
      }
    }
  }

  if (listedCount && players.length > listedCount) return { players: players.slice(0, listedCount), listedCount };
  return { players, listedCount };
}
function normalizeZawodyProImportUrls(rawUrl) {
  const input = String(rawUrl || '').trim();
  if (!input) throw new Error('Wklej link do zawody.pro');
  let u;
  try { u = new URL(input); } catch { throw new Error('Nieprawidłowy link'); }
  if (!/(^|\.)zawody\.pro$/i.test(u.hostname)) throw new Error('Link musi prowadzić do zawody.pro');
  u.hash = '';
  const urls = [u.toString()];
  const m = u.pathname.match(/\/(?:public\/szczegoly|competitions)\/(\d+)/i);
  if (m) {
    const id = m[1];
    urls.push(`https://www.zawody.pro/public/szczegoly/${id}`);
    urls.push(`https://www.zawody.pro/competitions/${id}/details`);
    urls.push(`https://www.zawody.pro/competitions/${id}/results`);
  }
  return Array.from(new Set(urls));
}
async function fetchText(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 18000);
  try {
    const r = await fetch(url, { redirect:'follow', signal:ctrl.signal, headers:{ 'user-agent':'Mozilla/5.0 LowcyMethodowcyImporter/1.0', 'accept':'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}
async function ensureCompetitionPlayer(competitionId, person, mode='IMPORT', preferredStatus='AUTO') {
  const full = normalizePersonName(person.fullName || ((person.firstName||'') + ' ' + (person.lastName||'')));
  if (!looksLikePersonName(full)) return { status:'skipped', reason:'Nieprawidłowe imię i nazwisko', fullName:full };
  const p = splitFullName(full);
  const firstName = normalizePersonName(person.firstName || p.firstName);
  const lastName = normalizePersonName(person.lastName || p.lastName);
  const pzwClub = String(person.pzwClub || '').trim();
  let phone = normalizePhone(person.phone || '');
  if (!phone) phone = `${mode}-` + crypto.createHash('sha1').update(nameKey(full) + '|' + pzwClub).digest('hex').slice(0, 18);
  let passwordHash = null;
  if (person.password) passwordHash = await bcrypt.hash(String(person.password), 10);
  else passwordHash = await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
  const wantedStatus = await nextRosterStatus(competitionId, preferredStatus);
  const accountSource = ['MANUAL','ZPRO','IMPORT'].includes(String(mode||'').toUpperCase()) ? 'ADMIN' : 'SELF';
  const { rows } = await pool.query(`
    insert into users(phone,password_hash,first_name,last_name,pzw_club,role,account_source)
    values($1,$2,$3,$4,$5,'PLAYER',$6)
    on conflict(phone) do update set first_name=excluded.first_name, last_name=excluded.last_name, pzw_club=excluded.pzw_club
    returning id, first_name, last_name, phone, pzw_club, account_source, last_login_at
  `, [phone, passwordHash, firstName, lastName, pzwClub, accountSource]);
  const uid = rows[0].id;
  await pool.query(`
    insert into entries(competition_id,user_id,status,joined_at,cancelled_at)
    values($1,$2,$3,now(),null)
    on conflict(competition_id,user_id) do update set
      status = case when entries.status='ACTIVE' then 'ACTIVE' else excluded.status end,
      joined_at = case when entries.status='ACTIVE' then entries.joined_at else now() end,
      cancelled_at = null
    returning id
  `, [competitionId, uid, wantedStatus]);
  return { status: 'added', entryStatus:wantedStatus, user: rows[0], fullName: firstName + ' ' + lastName };
}
async function importZawodyProList(competitionId, rawUrl, actor) {
  const comp = await getCompetition(competitionId);
  if (!comp) throw new Error('Nie znaleziono zawodów');
  const urls = normalizeZawodyProImportUrls(rawUrl);
  const all = [];
  const seen = new Set();
  const sourceReports = [];
  for (const url of urls) {
    try {
      const html = await fetchText(url);
      const parsed = parseZawodyProPlayers(html);
      sourceReports.push({ url, count:parsed.players.length, listedCount:parsed.listedCount || null });
      for (const p of parsed.players) {
        const key = nameKey(p.fullName);
        if (!key || seen.has(key)) continue;
        seen.add(key); all.push(p);
      }
    } catch (e) {
      sourceReports.push({ url, error:e.message });
    }
  }
  if (!all.length) throw new Error('Nie znalazłem listy zawodników na podanej stronie zawody.pro');
  let added = 0, skipped = 0, main = 0, reserve = 0;
  for (const p of all) {
    const r = await ensureCompetitionPlayer(competitionId, p, 'ZPRO', 'AUTO');
    if (r.status === 'skipped') skipped++; else { added++; if (r.entryStatus === 'RESERVE') reserve++; else main++; }
  }
  await notifyAdmins('ZAWODY_PRO_IMPORT', 'Import listy zawodników', `${actor.first_name} ${actor.last_name} zaimportował ${added} zawodników do: ${comp.title}`, { competitionId, count:added, main, reserve });
  return { imported:added, main, reserve, skipped, parsed:all.length, sources:sourceReports };
}


async function buildDetail(competitionId, user) {
  const comp = await getCompetition(competitionId);
  if (!comp) return null;
  const entriesAll = await pool.query(`
    select e.*, u.phone, u.first_name, u.last_name, u.pzw_club
    from entries e join users u on u.id=e.user_id
    where e.competition_id=$1
    order by case when e.status='ACTIVE' then 0 when e.status='RESERVE' then 1 else 2 end, e.joined_at, u.last_name, u.first_name
  `, [competitionId]);
  const active = entriesAll.rows.filter(e => e.status === 'ACTIVE');
  const reserve = entriesAll.rows.filter(e => e.status === 'RESERVE');
  const cancelled = entriesAll.rows.filter(e => e.status === 'CANCELLED');
  const rosterCounts = await getRosterCounts(competitionId);
  const draws = (await pool.query('select * from draws where competition_id=$1 order by round, stand', [competitionId])).rows;
  const results = (await pool.query('select * from results where competition_id=$1 order by round, user_id', [competitionId])).rows;
  const resultItems = (await pool.query('select * from result_items where competition_id=$1 order by round, user_id, created_at, id', [competitionId])).rows;
  const classification = computeClassification(comp, active, draws, results);
  const myEntry = entriesAll.rows.find(e => Number(e.user_id) === Number(user.id)) || null;
  return { ok:true, competition:comp, entries:entriesAll.rows, activeEntries:active, reserveEntries:reserve, cancelledEntries:cancelled, rosterCounts, draws, results, resultItems, classification, myEntry };
}

async function buildPlayerStartHistory(userId) {
  const q = await pool.query(`
    select c.id
    from competitions c
    join entries e on e.competition_id=c.id and e.user_id=$1 and e.status='ACTIVE'
    where c.competition_date is not null
      and c.competition_date <= current_date
      and (select count(distinct r.round) from results r where r.competition_id=c.id and r.user_id=$1) = 2
    order by c.competition_date desc, c.id desc
  `, [userId]);
  const history=[];
  for (const row of q.rows) {
    const d=await buildDetail(Number(row.id), {id:userId});
    if(!d)continue;
    const r1=(d.classification.round1||[]).find(r=>Number(r.user_id)===Number(userId));
    const r2=(d.classification.round2||[]).find(r=>Number(r.user_id)===Number(userId));
    const g=(d.classification.general||[]).find(r=>Number(r.user_id)===Number(userId));
    if(!r1||!r2||!g)continue;
    const s1=(d.classification.round1||[]).filter(r=>String(r.sector)===String(r1.sector)).length;
    const s2=(d.classification.round2||[]).filter(r=>String(r.sector)===String(r2.sector)).length;
    history.push({
      competition_id:Number(d.competition.id),
      title:d.competition.title||'',
      fishery:d.competition.fishery||'',
      competition_date:d.competition.competition_date||null,
      t1_place:Number(r1.points||r1.sector_place||0),
      t1_sector_size:Number(s1||0),
      t2_place:Number(r2.points||r2.sector_place||0),
      t2_sector_size:Number(s2||0),
      general_rank:Number(g.rank||0),
      general_count:Number((d.classification.general||[]).length||0),
      total_weight:Number(g.total_weight||0)
    });
  }
  return history;
}

async function route(req, res) {
  const url = new URL(req.url, 'http://local');
  const path = url.pathname;
  const method = req.method;

  if (path === '/__probe_js_v98' || path === '/__probe_boot_v98' || path === '/__probe_js_v97' || path === '/__probe_boot_v97' || path === '/__probe_js_v96' || path === '/__probe_boot_v96' || path === '/__probe_js_v95' || path === '/__probe_boot_v95' || path === '/__probe_js_v94' || path === '/__probe_boot_v94' || path === '/__probe_js_v93' || path === '/__probe_boot_v93' || path === '/__probe_js_v91' || path === '/__probe_boot_v91' || path === '/__probe_js_v90' || path === '/__probe_boot_v90' || path === '/__probe_js_v89' || path === '/__probe_boot_v89' || path === '/__probe_js_v88' || path === '/__probe_boot_v88' || path === '/__probe_js_v87' || path === '/__probe_boot_v87' || path === '/__probe_js_v86' || path === '/__probe_boot_v86' || path === '/__probe_js_v85' || path === '/__probe_boot_v85' || path === '/__probe_js_v84' || path === '/__probe_boot_v84' || path === '/__probe_js_v83' || path === '/__probe_boot_v83' || path === '/__probe_js_v82' || path === '/__probe_boot_v82' || path === '/__probe_js_v81' || path === '/__probe_boot_v81' || path === '/__probe_js_v80' || path === '/__probe_boot_v80' || path === '/__probe_js_v79' || path === '/__probe_boot_v79' || path === '/__probe_js_v78' || path === '/__probe_boot_v78' || path === '/__probe_js_v77' || path === '/__probe_boot_v77' || path === '/__probe_js_v76' || path === '/__probe_boot_v76' || path === '/__probe_js_v75' || path === '/__probe_boot_v75' || path === '/__probe_js_v74' || path === '/__probe_boot_v74' || path === '/__probe_js_v73' || path === '/__probe_boot_v73' || path === '/__probe_js_v72' || path === '/__probe_boot_v72' || path === '/__probe_js_v71' || path === '/__probe_boot_v71') return sendJson(res, 200, { ok:true, path, version:APP_VERSION_NAME, appVersion:APP_VERSION, time:nowIso() });

  if (path === '/__probe_js_v68' || path === '/__probe_boot_v68' || path === '/__probe_js_v67' || path === '/__probe_boot_v67' || path === '/__probe_js_v66' || path === '/__probe_boot_v66' || path === '/__probe_js_v65' || path === '/__probe_boot_v65' || path === '/__probe_js_v63' || path === '/__probe_boot_v63' || path === '/__probe_js_v62' || path === '/__probe_boot_v62' || path === '/__probe_js_v60' || path === '/__probe_boot_v60' || path === '/__probe_js_v59' || path === '/__probe_boot_v59' || path === '/__probe_js_v58' || path === '/__probe_boot_v58' || path === '/__probe_js_v57' || path === '/__probe_boot_v57' || path === '/__probe_js_v56' || path === '/__probe_boot_v56' || path === '/__probe_js_v55' || path === '/__probe_boot_v55' || path === '/__probe_js_v54' || path === '/__probe_boot_v54' || path === '/__probe_js_v53' || path === '/__probe_boot_v53' || path === '/__probe_js_v52' || path === '/__probe_boot_v52' || path === '/__probe_js_v51' || path === '/__probe_boot_v51' || path === '/__probe_js_v50' || path === '/__probe_boot_v50' || path === '/__probe_js_v49' || path === '/__probe_boot_v49' || path === '/__probe_js_v36' || path === '/__probe_boot_v36' || path === '/__probe_js_v35' || path === '/__probe_boot_v35' || path === '/__probe_js_v34' || path === '/__probe_boot_v34' || path === '/__probe_js_v33' || path === '/__probe_boot_v33' || path === '/__probe_js_v32' || path === '/__probe_boot_v32' || path === '/__probe_js_v30' || path === '/__probe_boot_v30' || path === '/__probe_js_v29' || path === '/__probe_boot_v29' || path === '/__probe_js_v27' || path === '/__probe_boot_v27' || path === '/__probe_inline_v26') return sendJson(res, 200, { ok:true, path, version:APP_VERSION_NAME, appVersion:APP_VERSION, time:nowIso() });
  if (path === '/api/version') return sendJson(res, 200, { ok:true, version:APP_VERSION_NAME, appVersion:APP_VERSION, time:nowIso() });
  if (path === '/app.js') return send(res, 200, APP_JS, {'Content-Type':'application/javascript; charset=utf-8', 'Cache-Control':'no-store, no-cache, must-revalidate'});

  if (path === '/health') return sendJson(res, 200, { ok:true, time:nowIso(), version:APP_VERSION_NAME });

  if (path === '/reset-cache') return send(res, 200, `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reset aplikacji</title><style>body{font-family:system-ui;margin:20px;background:#f3f6ef;color:#18251d}.card{background:#fff;border:1px solid #cfd8cc;border-radius:16px;padding:16px;max-width:520px;margin:auto}button{width:100%;padding:12px;border:0;border-radius:12px;background:#114b2f;color:white;font-weight:900}






/* V37 — naprawa sticky kafelków i kompaktowy podgląd sektorów admina na telefonie */
#competitionDetail,.adminZone{overflow:visible!important}
.workZoneTabs{
  position:sticky!important;
  top:calc(var(--app-header-height,56px) + 4px)!important;
  z-index:95!important;
  background:rgba(243,246,239,.99)!important;
  border-radius:14px!important;
  padding:8px!important;
  margin:2px 0 12px!important;
  box-shadow:0 8px 18px #00000018!important;
  overflow:visible!important;
}
.structurePreviewDesktop{display:block}.structurePreviewMobile{display:none}
.mobileStructureMap{display:block;background:#f9fcf8;border:1px solid var(--line);border-radius:14px;padding:10px}
.compactAdminSectors{display:grid;grid-template-columns:1fr;gap:10px}
.compactAdminSector{border-radius:14px;border:1px solid #c8d5cb;padding:8px;background:#fff;overflow:hidden}
.mobileStructureBank{margin-top:7px}
.mobileStructureGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.mobileStructureStand{min-height:46px;border:1.5px solid #95a99b;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px #00000010}
.mobileStructureStand b{font-size:24px;line-height:1;color:#173627}
@media(min-width:761px){
  .structurePreviewMobile{display:none!important}
  .structurePreviewDesktop{display:block!important}
}
@media(max-width:760px){
  .workZoneTabs{
    top:calc(var(--app-header-height,52px) + 4px)!important;
    z-index:95!important;
    margin:2px 0 10px!important;
    padding:6px!important;
    border-radius:12px!important;
  }
  .structurePreviewDesktop{display:none!important}
  .structurePreviewMobile{display:block!important}
  .mobileStructureMap{padding:8px;border-radius:12px}
  .mobileStructureGrid{gap:5px}
  .mobileStructureStand{min-height:44px}
  .mobileStructureStand b{font-size:22px}
}

</style></head><body><div class="card"><h2>Reset pamięci aplikacji</h2><p>Usuwam cache i starego service workera. Przekierowanie jest natychmiastowe, bez czekania na zawieszone obietnice przeglądarki.</p><button onclick="go()">Wyczyść teraz</button></div><script>function go(){try{localStorage.removeItem('carp_token');localStorage.removeItem('lowcy_app_version_seen');sessionStorage.clear();if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(function(rs){rs.forEach(function(r){r.unregister()})}).catch(function(){})}if('caches'in window){caches.keys().then(function(ks){ks.forEach(function(k){caches.delete(k)})}).catch(function(){})}}catch(e){}setTimeout(function(){location.replace('/?hard=36&t='+Date.now())},50)}go();</script></body></html>`, {'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store, no-cache, must-revalidate'});

  if (path === '/icon-192.png') return sendBinary(res,200,ICON_192,'image/png','public, max-age=604800');
  if (path === '/icon-512.png') return sendBinary(res,200,ICON_512,'image/png','public, max-age=604800');
  if (path === '/apple-touch-icon.png') return sendBinary(res,200,ICON_180,'image/png','public, max-age=604800');
  if (path === '/icon-64.png') return sendBinary(res,200,ICON_64,'image/png','public, max-age=604800');
  if (path === '/favicon-32.png' || path === '/favicon.ico') return sendBinary(res,200,FAVICON_32,'image/png','public, max-age=604800');
  if (path === '/manifest.webmanifest') return send(res, 200, JSON.stringify({
    name:'Łowcy Methodowcy', short_name:'Łowcy', description:'Zawody, losowania i wyniki Łowcy Methodowcy',
    start_url:'/', scope:'/', id:'/', display:'standalone', orientation:'portrait-primary',
    background_color:'#061521', theme_color:'#0b3b35',
    icons:[
      {src:'/icon-192.png',sizes:'192x192',type:'image/png',purpose:'any'},
      {src:'/icon-512.png',sizes:'512x512',type:'image/png',purpose:'any maskable'}
    ]
  }), {'Content-Type':'application/manifest+json; charset=utf-8','Cache-Control':'no-cache'});
  if (path === '/sw.js') return send(res, 200, `
const SW_VERSION='lowcy-v98-compact-player-cards-polish';
const SHELL_CACHE='lowcy-shell-v98';
const APP_SHELL_JS='/app.js?v=98';
const SHELL=['/',APP_SHELL_JS,'/manifest.webmanifest','/icon-192.png','/icon-512.png','/apple-touch-icon.png'];
self.addEventListener('install', event => event.waitUntil((async()=>{const c=await caches.open(SHELL_CACHE);await Promise.all(SHELL.map(async url=>{try{const r=await fetch(url,{cache:'no-store'});if(r&&r.ok)await c.put(url,r.clone())}catch(e){}}));await self.skipWaiting()})()));
self.addEventListener('activate', event => event.waitUntil((async()=>{try{const keys=await caches.keys();await Promise.all(keys.filter(k=>k.startsWith('lowcy-shell-')&&k!==SHELL_CACHE).map(k=>caches.delete(k)))}catch(e){}await self.clients.claim()})()));
self.addEventListener('fetch', event => {
  const req=event.request;if(req.method!=='GET')return;
  const u=new URL(req.url);if(u.origin!==self.location.origin)return;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{try{const r=await fetch(req,{cache:'no-store'});if(r&&r.ok){const c=await caches.open(SHELL_CACHE);c.put('/',r.clone()).catch(()=>{})}return r}catch(e){return (await caches.match('/'))||Response.error()}})());
    return;
  }
  if(u.pathname==='/app.js'||u.pathname==='/manifest.webmanifest'||u.pathname.startsWith('/icon-')||u.pathname==='/apple-touch-icon.png'){
    event.respondWith((async()=>{try{const r=await fetch(req,{cache:'no-store'});if(r&&r.ok){const c=await caches.open(SHELL_CACHE);const key=u.pathname==='/app.js'?APP_SHELL_JS:req;await c.put(key,r.clone()).catch(()=>{});return r}throw new Error('bad network response')}catch(e){if(u.pathname==='/app.js')return (await caches.match(APP_SHELL_JS))||Response.error();return (await caches.match(req))||Response.error()}})());
  }
});
self.addEventListener('push', event => {
  let data={}; try{data=event.data?event.data.json():{}}catch(e){}
  const title=data.title||'Łowcy Methodowcy';
  const options={body:data.body||'Nowe powiadomienie',icon:'/icon-192.png',badge:'/icon-64.png',data:{url:data.url||'/'},tag:data.type?(data.type+'-'+(data.competitionId||'')):undefined,renotify:true};
  event.waitUntil(self.registration.showNotification(title,options));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target=(event.notification.data&&event.notification.data.url)||'/';
  event.waitUntil((async()=>{const list=await clients.matchAll({type:'window',includeUncontrolled:true});for(const c of list){try{if('focus'in c){await c.focus();if('navigate'in c)await c.navigate(target);return}}catch(e){}}return clients.openWindow(target)})());
});
`, {'Content-Type':'application/javascript; charset=utf-8', 'Cache-Control':'no-store, no-cache, must-revalidate'});
  if (path === '/api/config') return sendJson(res, 200, { ok:true, vapidPublicKey: VAPID_PUBLIC_KEY, pushReady: Boolean(webpush && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY), appVersion:APP_VERSION, version:APP_VERSION_NAME });

  if (path === '/api/setup-admin' && method === 'POST') {
    const b = await readBody(req);
    if (!ADMIN_SETUP_CODE || b.setupCode !== ADMIN_SETUP_CODE) return sendJson(res, 403, { ok:false, error:'Błędny kod setupu' });
    const admins = await pool.query(`select count(*)::int n from users where role='ADMIN'`);
    if (admins.rows[0].n > 0) return sendJson(res, 409, { ok:false, error:'Admin już istnieje' });
    const phone = normalizePhone(b.phone);
    if (!phone || !b.password || !b.firstName || !b.lastName) return sendJson(res, 400, { ok:false, error:'Uzupełnij telefon, hasło, imię i nazwisko' });
    const hash = await bcrypt.hash(String(b.password), 12);
    const { rows } = await pool.query(
      `insert into users(phone,password_hash,first_name,last_name,pzw_club,role,account_source,last_login_at) values($1,$2,$3,$4,$5,'ADMIN','ADMIN',now()) returning id, phone, first_name, last_name, pzw_club, role, created_at, last_login_at`,
      [phone, hash, String(b.firstName).trim(), String(b.lastName).trim(), String(b.pzwClub||'').trim()]
    );
    return sendJson(res, 200, { ok:true, user:rows[0], token:signToken(rows[0]) });
  }
  if (path === '/api/register' && method === 'POST') {
    const b = await readBody(req);
    const phone = normalizePhone(b.phone);
    if (!phone || !b.password || !b.firstName || !b.lastName || !b.pzwClub) return sendJson(res, 400, { ok:false, error:'Uzupełnij telefon, hasło, imię, nazwisko i Koło PZW' });
    const hash = await bcrypt.hash(String(b.password), 12);
    try {
      const { rows } = await pool.query(
        `insert into users(phone,password_hash,first_name,last_name,pzw_club,role,account_source,last_login_at) values($1,$2,$3,$4,$5,'PLAYER','SELF',now()) returning id, phone, first_name, last_name, pzw_club, role, created_at, account_source, last_login_at`,
        [phone, hash, String(b.firstName).trim(), String(b.lastName).trim(), String(b.pzwClub).trim()]
      );
      await notifyAdmins('REGISTER', 'Nowe konto zawodnika', `${rows[0].first_name} ${rows[0].last_name}, Koło PZW ${rows[0].pzw_club}`, { userId: rows[0].id });
      return sendJson(res, 200, { ok:true, user:rows[0], token:signToken(rows[0]) });
    } catch (e) {
      if (String(e.message).includes('duplicate')) return sendJson(res, 409, { ok:false, error:'Ten numer telefonu jest już zarejestrowany' });
      throw e;
    }
  }
  if (path === '/api/login' && method === 'POST') {
    const b = await readBody(req);
    const phone = normalizePhone(b.phone);
    const { rows } = await pool.query('select * from users where phone=$1', [phone]);
    const u = rows[0];
    if (!u || !(await bcrypt.compare(String(b.password||''), u.password_hash))) return sendJson(res, 401, { ok:false, error:'Błędny telefon lub hasło' });
    const loginStamp = new Date();
    await pool.query('update users set last_login_at=$1 where id=$2', [loginStamp, u.id]);
    return sendJson(res, 200, { ok:true, user:{id:u.id,phone:u.phone,first_name:u.first_name,last_name:u.last_name,pzw_club:u.pzw_club,role:u.role,created_at:u.created_at,account_source:u.account_source||'SELF',last_login_at:loginStamp.toISOString()}, token:signToken(u) });
  }

  const user = await auth(req);
  if (path === '/api/me' && method === 'GET') { if (!requireUser(user, res)) return; return sendJson(res, 200, { ok:true, user }); }
  if (path === '/api/general-rules' && method === 'GET') {
    if (!requireUser(user, res)) return;
    const q=await pool.query(`select value from app_settings where key='general_regulations' limit 1`);
    return sendJson(res, 200, {ok:true, rules:q.rows[0]?.value||''});
  }
  if (path === '/api/general-rules' && method === 'PATCH') {
    if (!requireAdmin(user, res)) return;
    const b=await readBody(req), rules=String(b.rules||'');
    await pool.query(`insert into app_settings(key,value) values('general_regulations',$1) on conflict(key) do update set value=excluded.value`,[rules]);
    return sendJson(res, 200, {ok:true, rules});
  }
  if (path === '/api/me/history' && method === 'GET') {
    if (!requireUser(user, res)) return;
    const history=await buildPlayerStartHistory(Number(user.id));
    return sendJson(res, 200, {ok:true, history});
  }
  if (path === '/api/me' && method === 'PATCH') {
    if (!requireUser(user, res)) return;
    const b = await readBody(req);
    const firstName = String(b.firstName||'').trim(), lastName = String(b.lastName||'').trim(), pzwClub = String(b.pzwClub||'').trim(), phone = normalizePhone(b.phone);
    const newPassword = String(b.password||'');
    if (!firstName || !lastName || !pzwClub || !phone) return sendJson(res, 400, { ok:false, error:'Uzupełnij imię, nazwisko, Koło PZW i telefon' });
    try {
      let rows;
      if (newPassword) {
        const hash = await bcrypt.hash(newPassword, 12);
        ({rows} = await pool.query(`update users set first_name=$1,last_name=$2,pzw_club=$3,phone=$4,password_hash=$5 where id=$6 returning id,phone,first_name,last_name,pzw_club,role,created_at,account_source,last_login_at`, [firstName,lastName,pzwClub,phone,hash,user.id]));
      } else {
        ({rows} = await pool.query(`update users set first_name=$1,last_name=$2,pzw_club=$3,phone=$4 where id=$5 returning id,phone,first_name,last_name,pzw_club,role,created_at,account_source,last_login_at`, [firstName,lastName,pzwClub,phone,user.id]));
      }
      const updated=rows[0];
      return sendJson(res, 200, {ok:true,user:updated,token:signToken(updated)});
    } catch(e) {
      if (String(e.code||'')==='23505' || String(e.message||'').toLowerCase().includes('duplicate')) return sendJson(res, 409, {ok:false,error:'Ten numer telefonu jest już używany przez inne konto'});
      throw e;
    }
  }
  if (path === '/api/push-subscription' && method === 'POST') {
    if (!requireUser(user, res)) return;
    const b = await readBody(req);
    if (!b.subscription || !b.subscription.endpoint) return sendJson(res, 400, { ok:false, error:'Brak subskrypcji push' });
    await pool.query(`insert into push_subscriptions(user_id, endpoint, subscription) values($1,$2,$3) on conflict(endpoint) do update set user_id=excluded.user_id, subscription=excluded.subscription`, [user.id, b.subscription.endpoint, b.subscription]);
    return sendJson(res, 200, { ok:true });
  }
  if (path === '/api/push-subscription' && method === 'DELETE') {
    if (!requireUser(user, res)) return;
    await pool.query('delete from push_subscriptions where user_id=$1', [user.id]);
    return sendJson(res, 200, { ok:true });
  }
  if (path === '/api/push-test' && method === 'POST') {
    if (!requireUser(user, res)) return;
    const out=await pushToUser(user.id,'Test powiadomień','Powiadomienia telefonu działają poprawnie.','/',{type:'PUSH_TEST'});
    return sendJson(res, 200, { ok:true, sent:Number(out.sent||0), failed:Number(out.failed||0), ready:Boolean(out.ready) });
  }

  if (path === '/api/competitions' && method === 'GET') {
    if (!requireUser(user, res)) return;
    const { rows } = await pool.query(`
      select c.*, (select count(*)::int from entries e where e.competition_id=c.id and e.status='ACTIVE') active_count,
             (select count(*)::int from entries e where e.competition_id=c.id and e.status='RESERVE') reserve_count,
             (select status from entries e where e.competition_id=c.id and e.user_id=$1) my_status,
             coalesce((select confirmed from entries e where e.competition_id=c.id and e.user_id=$1),false) my_confirmed,
             (select confirmed_at from entries e where e.competition_id=c.id and e.user_id=$1) my_confirmed_at,
             (select lr.status from leave_requests lr where lr.competition_id=c.id and lr.user_id=$1 order by lr.created_at desc limit 1) my_leave_request_status
      from competitions c order by c.competition_date nulls last, c.created_at desc
    `, [user.id]);
    return sendJson(res, 200, { ok:true, competitions:rows });
  }
  if (path === '/api/competitions' && method === 'POST') {
    if (!requireAdmin(user, res)) return;
    const b = await readBody(req);
    const limit = intOrNull(b.limitPlaces);
    if (!limit || limit < 1) return sendJson(res, 400, { ok:false, error:'Podaj liczbę osób / limit miejsc' });
    const fishery = String(b.fishery || '').trim();
    const title = String(b.title || '').trim() || (fishery ? ('Zawody — ' + fishery) : 'Zawody');
    const mapMode = b.mapMode || 'TWO_OPPOSITE';
    const split = autoBankSplit(limit || 1, mapMode);
    const bank1 = clampInt(b.bank1Count, 0, 300, split.bank1);
    const bank2 = clampInt(b.bank2Count, 0, 300, split.bank2);
    const sectors = clampInt(b.sectorsCount, 1, 26, Math.min(6, Math.max(1, Math.ceil((limit || 1) / 5))));
    const { rows } = await pool.query(
      `insert into competitions(title,fishery,competition_date,meeting_time,limit_places,status,notes,regulations,created_by,map_mode,bank1_count,bank2_count,sectors_count,signup_open)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning *`,
      [title, fishery, b.competitionDate || null, (/^\d{2}:\d{2}$/.test(String(b.meetingTime||''))?String(b.meetingTime):'06:00'), limit, b.status || 'OPEN', String(b.notes||''), String(b.regulations||''), user.id, mapMode, bank1, bank2, sectors, b.signupOpen !== false]
    );
    await notifyAdmins('COMPETITION_CREATE', 'Utworzono zawody', user.first_name + ' ' + user.last_name + ' utworzył zawody: ' + rows[0].title, { competitionId: rows[0].id });
    const players=await pool.query(`select id from users where role='PLAYER'`);
    const dateTxt=rows[0].competition_date?String(rows[0].competition_date).slice(0,10):'termin do ustalenia';
    for(const p of players.rows)await notifyUser(p.id,'NEW_COMPETITION','Nowe zawody',`${rows[0].title} — ${rows[0].fishery||'łowisko'} — ${dateTxt}`,{competitionId:rows[0].id,url:'/'});
    return sendJson(res, 200, { ok:true, competition:rows[0] });
  }

  let m = path.match(/^\/api\/competitions\/(\d+)$/);
  if (m && method === 'GET') {
    if (!requireUser(user, res)) return;
    const detail = await buildDetail(Number(m[1]), user);
    if (!detail) return sendJson(res, 404, { ok:false, error:'Nie znaleziono zawodów' });
    return sendJson(res, 200, detail);
  }
  if (m && method === 'PATCH') {
    if (!requireAdmin(user, res)) return;
    const id = Number(m[1]);
    const b = await readBody(req);
    const old = await getCompetition(id);
    if (!old) return sendJson(res, 404, { ok:false, error:'Nie znaleziono zawodów' });
    const sectors = clampInt(b.sectorsCount, 1, 26, old.sectors_count || 4);
    const limit = intOrNull(b.limitPlaces);
    const mapMode = b.mapMode || old.map_mode || 'TWO_OPPOSITE';
    let bank1, bank2;
    if (b.autoBanks === true || b.autoBanks === 'true') {
      const cnt = await getRosterCounts(id);
      const target = Math.max(1, Number(cnt.active_count || 0) || Number(limit || 0) || competitionStandTotal(old));
      const split = autoBankSplit(target, mapMode);
      bank1 = split.bank1; bank2 = split.bank2;
    } else {
      bank1 = clampInt(b.bank1Count, 0, 300, old.bank1_count || 15);
      bank2 = clampInt(b.bank2Count, 0, 300, old.bank2_count || 15);
    }
    const total = Math.max(1, bank1 + bank2);
    let sectorLayout;
    try { sectorLayout = b.sectorLayout === undefined ? old.sector_layout : validateSectorLayout(b.sectorLayout, total, sectors); }
    catch (e) { return sendJson(res, 400, { ok:false, error:e.message }); }
    const { rows } = await pool.query(`
      update competitions set title=$1, fishery=$2, competition_date=$3, meeting_time=$4, limit_places=$5, status=$6, notes=$7, regulations=$8, map_mode=$9, bank1_count=$10, bank2_count=$11, sectors_count=$12, sector_layout=$13, signup_open=$14
      where id=$15 returning *
    `, [String(b.title||old.title).trim(), String(b.fishery||'').trim(), b.competitionDate || null, (/^\d{2}:\d{2}$/.test(String(b.meetingTime||''))?String(b.meetingTime):'06:00'), limit, b.status || old.status || 'OPEN', String(b.notes||''), String(b.regulations||''), mapMode, bank1, bank2, sectors, sectorLayout === undefined ? old.sector_layout : sectorLayout, b.signupOpen !== false, id]);
    await notifyAdmins('COMPETITION_UPDATE', 'Edytowano zawody', `${user.first_name} ${user.last_name} edytował zawody: ${rows[0].title}`, { competitionId:id });
    return sendJson(res, 200, { ok:true, competition:rows[0] });
  }
  if (m && method === 'DELETE') {
    if (!requireAdmin(user, res)) return;
    const id = Number(m[1]);
    const old = await pool.query('select title from competitions where id=$1', [id]);
    if (!old.rows[0]) return sendJson(res, 404, { ok:false, error:'Nie znaleziono zawodów' });
    await pool.query('delete from competitions where id=$1', [id]);
    await notifyAdmins('COMPETITION_DELETE', 'Usunięto zawody', user.first_name + ' ' + user.last_name + ' usunął zawody: ' + old.rows[0].title, { competitionId: id });
    return sendJson(res, 200, { ok:true });
  }

  if (path === '/api/admin/competitions/clear' && method === 'POST') {
    if (!requireAdmin(user, res)) return;
    const b = await readBody(req);
    if (b.confirm !== 'USUN') return sendJson(res, 400, { ok:false, error:'Wymagane potwierdzenie USUN' });
    const deleted = await pool.query('delete from competitions returning id');
    await notifyAdmins('COMPETITIONS_CLEAR', 'Usunięto zawody testowe', user.first_name + ' ' + user.last_name + ' usunął ' + deleted.rowCount + ' zawodów', { count: deleted.rowCount });
    return sendJson(res, 200, { ok:true, deleted: deleted.rowCount });
  }


  m = path.match(/^\/api\/admin\/competitions\/(\d+)\/players\/manual$/);
  if (m && method === 'POST') {
    if (!requireAdmin(user, res)) return;
    const compId = Number(m[1]);
    const comp = await getCompetition(compId);
    if (!comp) return sendJson(res, 404, { ok:false, error:'Nie znaleziono zawodów' });
    const b = await readBody(req);
    const fullName = normalizePersonName(b.fullName || ((b.firstName || '') + ' ' + (b.lastName || '')));
    const added = await ensureCompetitionPlayer(compId, { fullName, firstName:b.firstName, lastName:b.lastName, phone:b.phone, pzwClub:b.pzwClub, password:b.password }, 'MANUAL', b.entryStatus || 'AUTO');
    if (added.status === 'skipped') return sendJson(res, 400, { ok:false, error:added.reason || 'Nieprawidłowe dane zawodnika' });
    await notifyAdmins('MANUAL_PLAYER_ADD', 'Dopisano zawodnika', `${user.first_name} ${user.last_name} dopisał zawodnika ${added.fullName} do: ${comp.title}`, { competitionId:compId });
    await autoSyncBanksForRoster(compId);
    return sendJson(res, 200, { ok:true, added });
  }
  m = path.match(/^\/api\/admin\/competitions\/(\d+)\/import-zawody-pro$/);
  if (m && method === 'POST') {
    if (!requireAdmin(user, res)) return;
    const compId = Number(m[1]);
    const b = await readBody(req);
    try {
      const result = await importZawodyProList(compId, b.url, user);
      await autoSyncBanksForRoster(compId);
      return sendJson(res, 200, { ok:true, result });
    } catch (e) {
      return sendJson(res, 400, { ok:false, error:e.message });
    }
  }


  m = path.match(/^\/api\/competitions\/(\d+)\/confirm-presence$/);
  if (m && method === 'POST') {
    if (!requireUser(user, res)) return;
    if (String(user.role||'') === 'ADMIN') return sendJson(res, 403, { ok:false, error:'Potwierdzenie obecności dotyczy zawodnika' });
    const compId = Number(m[1]);
    const q = await pool.query(`
      select e.id,e.status,e.confirmed,e.confirmed_at,c.competition_date,
             (c.competition_date::date-current_date)::int as days_left
      from entries e join competitions c on c.id=e.competition_id
      where e.competition_id=$1 and e.user_id=$2
    `,[compId,user.id]);
    const row=q.rows[0];
    if(!row||row.status!=='ACTIVE')return sendJson(res,409,{ok:false,error:'Potwierdzenie jest dostępne tylko dla zawodnika z listy głównej'});
    const days=Number(row.days_left);
    if(!Number.isFinite(days)||days<0||days>4)return sendJson(res,409,{ok:false,error:'Obecność można potwierdzić od 4 dni przed zawodami do dnia zawodów'});
    const upd=await pool.query(`update entries set confirmed=true, confirmed_at=coalesce(confirmed_at,now()) where id=$1 returning confirmed,confirmed_at`,[row.id]);
    return sendJson(res,200,{ok:true,confirmed:true,confirmedAt:upd.rows[0]?.confirmed_at||row.confirmed_at});
  }

  m = path.match(/^\/api\/admin\/competitions\/(\d+)\/entries\/(\d+)\/confirm$/);
  if (m && method === 'POST') {
    if (!requireAdmin(user, res)) return;
    const compId = Number(m[1]);
    const entryId = Number(m[2]);
    const q = await pool.query(`update entries set confirmed=not confirmed, confirmed_at=case when not confirmed then now() else null end where id=$1 and competition_id=$2 and status='ACTIVE' returning confirmed, confirmed_at`, [entryId, compId]);
    if (!q.rows[0]) return sendJson(res, 404, { ok:false, error:'Nie znaleziono aktywnego zawodnika' });
    return sendJson(res, 200, { ok:true, confirmed:Boolean(q.rows[0].confirmed), confirmedAt:q.rows[0].confirmed_at });
  }

  m = path.match(/^\/api\/admin\/competitions\/(\d+)\/entries\/(\d+)\/(promote|reserve|cancel)$/);
  if (m && method === 'POST') {
    if (!requireAdmin(user, res)) return;
    const compId = Number(m[1]);
    const entryId = Number(m[2]);
    const action = m[3];
    const comp = await getCompetition(compId);
    if (!comp) return sendJson(res, 404, { ok:false, error:'Nie znaleziono zawodów' });
    const entQ = await pool.query(`select e.*, u.first_name, u.last_name from entries e join users u on u.id=e.user_id where e.id=$1 and e.competition_id=$2`, [entryId, compId]);
    const ent = entQ.rows[0];
    if (!ent) return sendJson(res, 404, { ok:false, error:'Nie znaleziono zapisu' });
    const newStatus = action === 'promote' ? 'ACTIVE' : action === 'reserve' ? 'RESERVE' : 'CANCELLED';
    await pool.query(`update entries set status=$1, cancelled_at=case when $1='CANCELLED' then now() else null end, confirmed=case when $1='CANCELLED' then false else confirmed end, confirmed_at=case when $1='CANCELLED' then null else confirmed_at end where id=$2`, [newStatus, entryId]);
    if (newStatus==='CANCELLED') {
      const pendingRq = await pool.query(`update leave_requests set status='APPROVED', decided_at=now(), decided_by=$1 where competition_id=$2 and user_id=$3 and status='PENDING' returning id`, [user.id,compId,ent.user_id]);
      for (const rq of pendingRq.rows) await pool.query(`update notifications set data=jsonb_set(coalesce(data,'{}'::jsonb),'{status}',to_jsonb('APPROVED'::text),true), read_at=coalesce(read_at,now()) where type='LEAVE_REQUEST' and (data->>'requestId')=$1`, [String(rq.id)]);
    }
    await notifyUser(ent.user_id, 'ENTRY_STATUS', 'Zmiana statusu zapisu', `${comp.title}: ${rosterStatusLabel(newStatus)}`, { competitionId:compId, status:newStatus, url:'/' });
    await notifyAdmins('ENTRY_STATUS_ADMIN', 'Zmieniono status zawodnika', `${ent.first_name} ${ent.last_name}: ${rosterStatusLabel(newStatus)} — ${comp.title}`, { competitionId:compId, entryId, status:newStatus });
    await autoSyncBanksForRoster(compId);
    return sendJson(res, 200, { ok:true, status:newStatus });
  }

  m = path.match(/^\/api\/competitions\/(\d+)\/join$/);
  if (m && method === 'POST') {
    if (!requireUser(user, res)) return;
    const id = Number(m[1]);
    const c = await getCompetition(id);
    if (!c) return sendJson(res, 404, { ok:false, error:'Nie znaleziono zawodów' });
    if (c.status !== 'OPEN' || c.signup_open === false) return sendJson(res, 409, { ok:false, error:'Zapisy są zamknięte' });
    const wantedStatus = await nextRosterStatus(id, 'AUTO');
    await pool.query(`insert into entries(competition_id,user_id,status,joined_at,cancelled_at,confirmed,confirmed_at) values($1,$2,$3,now(),null,false,null)
      on conflict(competition_id,user_id) do update set status=excluded.status, joined_at=now(), cancelled_at=null, confirmed=false, confirmed_at=null`, [id, user.id, wantedStatus]);
    const label = rosterStatusLabel(wantedStatus);
    await notifyAdmins('JOIN', 'Nowy zapis', `${user.first_name} ${user.last_name} zapisał się: ${c.title} — ${label}`, { competitionId:id, userId:user.id, status:wantedStatus });
    await notifyUser(user.id, 'JOIN_CONFIRM', wantedStatus === 'RESERVE' ? 'Zapisano na rezerwę' : 'Zapisano na zawody', `${c.title}: ${label}`, { competitionId:id, status:wantedStatus });
    await autoSyncBanksForRoster(id);
    return sendJson(res, 200, { ok:true, status:wantedStatus, label });
  }
  m = path.match(/^\/api\/competitions\/(\d+)\/leave$/);
  if (m && method === 'POST') {
    if (!requireUser(user, res)) return;
    const id = Number(m[1]);
    const c = await getCompetition(id);
    if (!c) return sendJson(res, 404, { ok:false, error:'Nie znaleziono zawodów' });
    const entQ = await pool.query(`select id,status from entries where competition_id=$1 and user_id=$2`, [id,user.id]);
    const ent = entQ.rows[0];
    if (!ent || !['ACTIVE','RESERVE'].includes(ent.status)) return sendJson(res, 409, { ok:false, error:'Nie masz aktywnego zapisu na te zawody' });
    const pending = await pool.query(`select id from leave_requests where competition_id=$1 and user_id=$2 and status='PENDING' order by created_at desc limit 1`, [id,user.id]);
    if (pending.rows[0]) return sendJson(res, 200, { ok:true, pending:true, requestId:pending.rows[0].id });
    let request;
    try {
      const rq = await pool.query(`insert into leave_requests(competition_id,user_id,status) values($1,$2,'PENDING') returning *`, [id,user.id]);
      request = rq.rows[0];
    } catch (e) {
      if (String(e.code)==='23505') {
        const rq = await pool.query(`select * from leave_requests where competition_id=$1 and user_id=$2 and status='PENDING' order by created_at desc limit 1`, [id,user.id]);
        request = rq.rows[0];
      } else throw e;
    }
    await notifyAdmins('LEAVE_REQUEST', 'Prośba o wypisanie', `${user.first_name} ${user.last_name} prosi o wypisanie z: ${c.title}`, { competitionId:id, userId:user.id, requestId:request.id, status:'PENDING' });
    await notifyUser(user.id, 'LEAVE_REQUEST_CONFIRM', 'Prośba o wypisanie wysłana', `Administrator musi zaakceptować wypisanie z: ${c.title}`, { competitionId:id, requestId:request.id, status:'PENDING' });
    return sendJson(res, 200, { ok:true, pending:true, requestId:request.id });
  }

  m = path.match(/^\/api\/admin\/leave-requests\/(\d+)\/(approve|reject)$/);
  if (m && method === 'POST') {
    if (!requireAdmin(user, res)) return;
    const requestId = Number(m[1]);
    const decision = m[2];
    const client = await pool.connect();
    let info;
    try {
      await client.query('begin');
      const rq = await client.query(`select lr.*, c.title, u.first_name, u.last_name from leave_requests lr join competitions c on c.id=lr.competition_id join users u on u.id=lr.user_id where lr.id=$1 for update`, [requestId]);
      info = rq.rows[0];
      if (!info) { await client.query('rollback'); return sendJson(res, 404, { ok:false, error:'Nie znaleziono prośby' }); }
      if (info.status !== 'PENDING') { await client.query('rollback'); return sendJson(res, 200, { ok:true, status:info.status, competitionId:Number(info.competition_id) }); }
      const status = decision==='approve' ? 'APPROVED' : 'REJECTED';
      await client.query(`update leave_requests set status=$1, decided_at=now(), decided_by=$2 where id=$3`, [status,user.id,requestId]);
      if (status==='APPROVED') await client.query(`update entries set status='CANCELLED', cancelled_at=now(), confirmed=false, confirmed_at=null where competition_id=$1 and user_id=$2 and status in ('ACTIVE','RESERVE')`, [info.competition_id,info.user_id]);
      await client.query(`update notifications set data=jsonb_set(coalesce(data,'{}'::jsonb),'{status}',to_jsonb($1::text),true), read_at=coalesce(read_at,now()) where type='LEAVE_REQUEST' and (data->>'requestId')=$2`, [status,String(requestId)]);
      await client.query('commit');
      info.status=status;
    } catch (e) { try{await client.query('rollback')}catch(_){} throw e; }
    finally { client.release(); }
    if (info.status==='APPROVED') {
      await notifyUser(info.user_id, 'LEAVE_APPROVED', 'Zaakceptowano wypisanie', `Administrator zaakceptował wypisanie z: ${info.title}`, { competitionId:Number(info.competition_id), requestId, status:'APPROVED' });
      await autoSyncBanksForRoster(Number(info.competition_id));
    } else {
      await notifyUser(info.user_id, 'LEAVE_REJECTED', 'Prośba o wypisanie odrzucona', `Administrator odrzucił prośbę o wypisanie z: ${info.title}`, { competitionId:Number(info.competition_id), requestId, status:'REJECTED' });
    }
    return sendJson(res, 200, { ok:true, status:info.status, competitionId:Number(info.competition_id), userId:Number(info.user_id) });
  }

  m = path.match(/^\/api\/admin\/competitions\/(\d+)\/draw\/(1|2)$/);
  if (m && method === 'POST') {
    if (!requireAdmin(user, res)) return;
    try {
      const assignment = await generateDraw(Number(m[1]), Number(m[2]), user);
      return sendJson(res, 200, { ok:true, assignment });
    } catch (e) { return sendJson(res, 400, { ok:false, error:e.message }); }
  }
  m = path.match(/^\/api\/admin\/competitions\/(\d+)\/draw\/publish$/);
  if (m && method === 'POST') {
    if (!requireAdmin(user, res)) return;
    try {
      const out = await publishDraw(Number(m[1]), user);
      return sendJson(res, 200, { ok:true, notified:out.notified });
    } catch (e) { return sendJson(res, 400, { ok:false, error:e.message }); }
  }
  m = path.match(/^\/api\/admin\/competitions\/(\d+)\/draw$/);
  if (m && method === 'DELETE') {
    if (!requireAdmin(user, res)) return;
    const compId = Number(m[1]);
    const comp = await getCompetition(compId);
    if (!comp) return sendJson(res, 404, { ok:false, error:'Nie znaleziono zawodów' });
    const b = await readBody(req);
    if (b.confirm !== 'RESET_LOSOWANIA') return sendJson(res, 400, { ok:false, error:'Brak potwierdzenia resetu losowania' });
    const client = await pool.connect();
    try {
      await client.query('begin');
      const items = await client.query('delete from result_items where competition_id=$1 returning id', [compId]);
      const aggregates = await client.query('delete from results where competition_id=$1 returning id', [compId]);
      const removed = await client.query('delete from draws where competition_id=$1 returning id', [compId]);
      await client.query('commit');
      await notifyAdmins('DRAW_RESET', 'Usunięto losowanie i wyniki', `${user.first_name} ${user.last_name} usunął całe losowanie T1/T2 oraz wyniki: ${comp.title}`, { competitionId:compId, deletedDraws:removed.rowCount, deletedItems:items.rowCount, deletedResults:aggregates.rowCount });
      return sendJson(res, 200, { ok:true, deletedDraws:removed.rowCount, deletedItems:items.rowCount, deletedResults:aggregates.rowCount });
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally {
      client.release();
    }
  }
  m = path.match(/^\/api\/admin\/competitions\/(\d+)\/results\/(1|2)\/generate$/);
  if (m && method === 'POST') {
    if (!requireAdmin(user, res)) return;
    try {
      const out = await generateRandomResults(Number(m[1]), Number(m[2]), user);
      return sendJson(res, 200, { ok:true, count:out.count });
    } catch (e) { return sendJson(res, 400, { ok:false, error:e.message }); }
  }
  m = path.match(/^\/api\/admin\/competitions\/(\d+)\/results$/);
  if (m && method === 'DELETE') {
    if (!requireAdmin(user, res)) return;
    const compId = Number(m[1]);
    const comp = await getCompetition(compId);
    if (!comp) return sendJson(res, 404, { ok:false, error:'Nie znaleziono zawodów' });
    const b = await readBody(req);
    if (b.confirm !== 'WYCZYSC_WYNIKI') return sendJson(res, 400, { ok:false, error:'Brak potwierdzenia czyszczenia wyników' });
    const client = await pool.connect();
    try {
      await client.query('begin');
      const items = await client.query('delete from result_items where competition_id=$1 returning id', [compId]);
      const aggregates = await client.query('delete from results where competition_id=$1 returning id', [compId]);
      await client.query('commit');
      await notifyAdmins('RESULTS_CLEAR', 'Wyczyszczono wyniki', `${user.first_name} ${user.last_name} wyczyścił wyniki T1 i T2: ${comp.title}`, { competitionId:compId, items:items.rowCount, results:aggregates.rowCount });
      return sendJson(res, 200, { ok:true, deletedItems:items.rowCount, deletedResults:aggregates.rowCount });
    } catch (e) { await client.query('rollback'); throw e; }
    finally { client.release(); }
  }
  m = path.match(/^\/api\/admin\/competitions\/(\d+)\/results\/(1|2)$/);
  if (m && method === 'POST') {
    if (!requireAdmin(user, res)) return;
    const compId = Number(m[1]); const round = Number(m[2]);
    const comp = await getCompetition(compId);
    if (!comp) return sendJson(res, 404, { ok:false, error:'Nie znaleziono zawodów' });
    const b = await readBody(req);
    const list = Array.isArray(b.results) ? b.results : [];
    const client = await pool.connect();
    try {
      await client.query('begin');
      for (const r of list) {
        const uid = Number(r.userId);
        if (!Number.isFinite(uid)) continue;
        const hasNewNet = r.weight !== undefined && String(r.weight).trim() !== '';
        const hasNewBf = r.bigFish !== undefined && String(r.bigFish).trim() !== '';
        if (hasNewNet || hasNewBf) {
          await client.query('delete from result_items where competition_id=$1 and user_id=$2 and round=$3', [compId, uid, round]);
          const net = grams(r.weight);
          const bf = grams(r.bigFish);
          if (net > 0) await client.query('insert into result_items(competition_id,user_id,round,kind,weight) values($1,$2,$3,$4,$5)', [compId, uid, round, 'NET', net]);
          if (bf > 0) await client.query('insert into result_items(competition_id,user_id,round,kind,weight) values($1,$2,$3,$4,$5)', [compId, uid, round, 'BF', bf]);
        }
        await refreshResultAggregate(client, compId, uid, round);
      }
      await client.query('commit');
    } catch (e) { await client.query('rollback'); throw e; }
    finally { client.release(); }
    await notifyAdmins('RESULTS_SAVE_T'+round, 'Zapisano wyniki T'+round, `${user.first_name} ${user.last_name} zapisał wyniki T${round}: ${comp.title}`, { competitionId:compId, round });
    return sendJson(res, 200, { ok:true });
  }
  m = path.match(/^\/api\/admin\/competitions\/(\d+)\/results\/(1|2)\/items$/);
  if (m && method === 'POST') {
    if (!requireAdmin(user, res)) return;
    const compId = Number(m[1]); const round = Number(m[2]);
    const comp = await getCompetition(compId);
    if (!comp) return sendJson(res, 404, { ok:false, error:'Nie znaleziono zawodów' });
    const b = await readBody(req);
    try {
      const out = await addResultItem(compId, Number(b.userId), round, b.kind, b.weight);
      return sendJson(res, 200, { ok:true, item:out.item, aggregate:out.aggregate });
    } catch (e) { return sendJson(res, 400, { ok:false, error:e.message }); }
  }
  m = path.match(/^\/api\/admin\/results\/items\/(\d+)$/);
  if (m && method === 'DELETE') {
    if (!requireAdmin(user, res)) return;
    try {
      const out = await deleteResultItem(Number(m[1]));
      return sendJson(res, 200, { ok:true, deleted:out.item, aggregate:out.aggregate });
    } catch (e) { return sendJson(res, 404, { ok:false, error:e.message }); }
  }
  m = path.match(/^\/api\/admin\/competitions\/(\d+)\/results\/(1|2)\/notify$/);
  if (m && method === 'POST') {
    if (!requireAdmin(user, res)) return;
    const compId = Number(m[1]); const round = Number(m[2]);
    const comp = await getCompetition(compId);
    if (!comp) return sendJson(res, 404, { ok:false, error:'Nie znaleziono zawodów' });
    const active = await getActiveEntries(compId);
    const detail=await buildDetail(compId,user);
    const rr=round===1?detail.classification.round1:detail.classification.round2;
    const fmtW=n=>String(Number(n||0)).replace(/\B(?=(\d{3})+(?!\d))/g,' ');
    for (const e of active) {
      const r=rr.find(x=>Number(x.user_id)===Number(e.user_id));
      const bf=r&&Number(r.big_fish||0)>0?`, BF ${fmtW(r.big_fish)} g`:'';
      const body=r?`${comp.title}: T${round} — sektor ${r.sector}, miejsce ${r.points}, waga ${fmtW(r.weight)} g${bf}`:`${comp.title}: wyniki T${round} są dostępne`;
      await notifyUser(e.user_id,'RESULTS_T'+round,'Twój wynik T'+round,body,{competitionId:compId,round,url:'/'});
      if(round===2){
        const g=detail.classification.general.find(x=>Number(x.user_id)===Number(e.user_id));
        if(g)await notifyUser(e.user_id,'RESULTS_GENERAL','Klasyfikacja końcowa',`${comp.title}: ${g.rank}. miejsce, ${g.sum_points} pkt, ${fmtW(g.total_weight)} g${Number(g.biggest_fish||0)>0?', BF '+fmtW(g.biggest_fish)+' g':''}`,{competitionId:compId,url:'/'});
      }
    }
    await notifyAdmins('RESULTS_NOTIFY_T'+round,'Powiadomiono o wynikach T'+round,`Wysłano indywidualne powiadomienia o wynikach T${round}: ${comp.title}`,{competitionId:compId,round});
    return sendJson(res, 200, { ok:true, notified: active.length });
  }

  if ((path === '/api/notifications' || path === '/api/admin/notifications') && method === 'GET') {
    if (!requireUser(user, res)) return;
    if (path === '/api/admin/notifications' && user.role !== 'ADMIN') return sendJson(res, 403, { ok:false, error:'Brak uprawnień admina' });
    const { rows } = await pool.query(`select * from notifications where recipient_user_id=$1 and ($2::boolean=false or type not like 'RESULT_ITEM_T%') order by case when type='LEAVE_REQUEST' and coalesce(data->>'status','PENDING')='PENDING' then 0 else 1 end, created_at desc limit 150`, [user.id, user.role==='ADMIN']);
    return sendJson(res, 200, { ok:true, notifications:rows });
  }
  if ((path === '/api/notifications/read-all' || path === '/api/admin/notifications/read-all') && method === 'POST') {
    if (!requireUser(user, res)) return;
    if (path === '/api/admin/notifications/read-all' && user.role !== 'ADMIN') return sendJson(res, 403, { ok:false, error:'Brak uprawnień admina' });
    const out = await pool.query(`update notifications set read_at=now() where recipient_user_id=$1 and read_at is null`, [user.id]);
    return sendJson(res, 200, { ok:true, updated:out.rowCount || 0 });
  }
  if ((path === '/api/notifications' || path === '/api/admin/notifications') && method === 'DELETE') {
    if (!requireUser(user, res)) return;
    if (path === '/api/admin/notifications' && user.role !== 'ADMIN') return sendJson(res, 403, { ok:false, error:'Brak uprawnień admina' });
    if (user.role === 'ADMIN') {
      const pending = await pool.query(`select count(*)::int as n from notifications where recipient_user_id=$1 and type='LEAVE_REQUEST' and coalesce(data->>'status','PENDING')='PENDING'`, [user.id]);
      const out = await pool.query(`delete from notifications where recipient_user_id=$1 and not (type='LEAVE_REQUEST' and coalesce(data->>'status','PENDING')='PENDING')`, [user.id]);
      return sendJson(res, 200, { ok:true, deleted:out.rowCount || 0, keptPending:Number(pending.rows[0]?.n || 0) });
    }
    const out = await pool.query(`delete from notifications where recipient_user_id=$1`, [user.id]);
    return sendJson(res, 200, { ok:true, deleted:out.rowCount || 0, keptPending:0 });
  }
  m = path.match(/^\/api\/(?:admin\/)?notifications\/(\d+)\/read$/);
  if (m && method === 'POST') {
    if (!requireUser(user, res)) return;
    await pool.query(`update notifications set read_at=now() where id=$1 and recipient_user_id=$2`, [Number(m[1]), user.id]);
    return sendJson(res, 200, { ok:true });
  }
  if (path === '/api/admin/players' && method === 'GET') {
    if (!requireAdmin(user, res)) return;
    const { rows } = await pool.query(`
      select u.id, u.phone, u.first_name, u.last_name, u.pzw_club, u.role, u.created_at,
      coalesce(u.account_source,'SELF') account_source, u.last_login_at,
      (u.last_login_at is not null) has_logged_in,
      (select count(*)::int from entries e where e.user_id=u.id and e.status='ACTIVE') active_entries
      from users u where u.role='PLAYER' order by u.created_at desc
    `);
    return sendJson(res, 200, { ok:true, players:rows });
  }
  if (path === '/api/admin/players/admin-added' && method === 'DELETE') {
    if (!requireAdmin(user, res)) return;
    const list = await pool.query(`select id, first_name, last_name from users where role='PLAYER' and upper(coalesce(account_source,'SELF'))='ADMIN' order by id`);
    const ids = list.rows.map(r => Number(r.id)).filter(Boolean);
    if (!ids.length) return sendJson(res, 200, { ok:true, deleted:0, players:[] });
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('update competitions set created_by=null where created_by = any($1::bigint[])', [ids]);
      await client.query('update leave_requests set decided_by=null where decided_by = any($1::bigint[])', [ids]);
      const out = await client.query("delete from users where role='PLAYER' and id = any($1::bigint[]) and upper(coalesce(account_source,'SELF'))='ADMIN' returning id, first_name, last_name", [ids]);
      await client.query('commit');
      return sendJson(res, 200, { ok:true, deleted:out.rowCount || 0, players:out.rows.map(p=>({id:Number(p.id),name:`${p.first_name||''} ${p.last_name||''}`.trim()})) });
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally { client.release(); }
  }
  m = path.match(/^\/api\/admin\/players\/(\d+)$/);
  if (m && method === 'PATCH') {
    if (!requireAdmin(user, res)) return;
    const playerId = Number(m[1]);
    const b = await readBody(req);
    const fullName = normalizePersonName(b.fullName || '');
    if (!looksLikePersonName(fullName)) return sendJson(res, 400, { ok:false, error:'Podaj poprawne imię i nazwisko zawodnika' });
    const parts = splitFullName(fullName);
    const out = await pool.query(`update users set first_name=$1, last_name=$2 where id=$3 and role='PLAYER' returning id, first_name, last_name`, [parts.firstName, parts.lastName, playerId]);
    if (!out.rowCount) return sendJson(res, 404, { ok:false, error:'Nie znaleziono zawodnika' });
    const p = out.rows[0];
    await notifyAdmins('PLAYER_NAME_EDIT', 'Poprawiono nazwę zawodnika', `${p.first_name} ${p.last_name}`, { userId:playerId });
    return sendJson(res, 200, { ok:true, player:{id:playerId,name:`${p.first_name} ${p.last_name}`.trim(),first_name:p.first_name,last_name:p.last_name} });
  }
  if (m && method === 'DELETE') {
    if (!requireAdmin(user, res)) return;
    const playerId = Number(m[1]);
    const pq = await pool.query(`select id, first_name, last_name, role from users where id=$1`, [playerId]);
    const player = pq.rows[0];
    if (!player || player.role !== 'PLAYER') return sendJson(res, 404, { ok:false, error:'Nie znaleziono zawodnika' });
    const name = `${player.first_name} ${player.last_name}`.trim();
    const client = await pool.connect();
    try {
      await client.query('begin');
      await client.query('update competitions set created_by=null where created_by=$1', [playerId]);
      await client.query('update leave_requests set decided_by=null where decided_by=$1', [playerId]);
      await client.query("delete from users where id=$1 and role='PLAYER'", [playerId]);
      await client.query('commit');
    } catch (e) {
      await client.query('rollback');
      throw e;
    } finally { client.release(); }
    return sendJson(res, 200, { ok:true, player:{ id:playerId, name } });
  }

  return send(res, 200, HTML);
}

const LEGACY_APP_JS = String.raw`const CLIENT_VERSION='28';const CLIENT_VERSION_NAME='V28_EXTERNAL_JS_STABLE_LOGIN';try{fetch('/__probe_js_v28',{cache:'no-store'}).catch(()=>{})}catch(_){};console.log('CLIENT_V28_EXTERNAL_JS_STABLE_LOGIN_LOADED');
const STORE={get(k){try{return localStorage.getItem(k)||''}catch(e){return ''}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
let TOKEN = STORE.get('carp_token') || '';
let ME = null;
let CURRENT_DETAIL = null;
let CREATING_COMPETITION = false;
let SAVING_RESULTS = false;
let SAVING_RESULT_ITEM = false;
let LOGIN_IN_PROGRESS = false;
let STRUCTURE_SAVE_TIMER = null;
let STRUCTURE_READY = false;
const q = id => document.getElementById(id);
window.addEventListener('error',e=>{console.error('CLIENT_ERR',e.message);try{const m=document.getElementById('msg');if(m)m.innerHTML='<div class=\"card bad danger-line\">Błąd ekranu: '+String(e.message||'nieznany')+'</div>'}catch(_){}});
window.addEventListener('unhandledrejection',e=>{console.error('CLIENT_REJECT',e.reason);});
function esc(s){return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function msg(t,type='ok'){const el=q('msg');if(!el)return;el.innerHTML='<div class="card '+(type==='bad'?'bad danger-line':'ok success-line')+'">'+esc(t)+'</div>';setTimeout(()=>{const x=q('msg');if(x)x.innerHTML=''},3500)}
async function api(path, opts={}){const ctrl=typeof AbortController!=='undefined'?new AbortController():null;const to=ctrl?setTimeout(()=>ctrl.abort(),15000):null;try{const res=await fetch(path,Object.assign({cache:'no-store',signal:ctrl?ctrl.signal:undefined,headers:{'Content-Type':'application/json',...(TOKEN?{Authorization:'Bearer '+TOKEN}:{})}},opts));const data=await res.json().catch(()=>({ok:false,error:'Błąd odpowiedzi'}));if(!res.ok||data.ok===false)throw new Error(data.error||'Błąd');return data}catch(e){if(e&&e.name==='AbortError')throw new Error('Brak odpowiedzi serwera po 15 s');throw e}finally{if(to)clearTimeout(to)}}
function fmtDate(d){if(!d)return '—';const s=String(d);const m=s.match(/^\d{4}-\d{2}-\d{2}/);const dt=new Date(m?(m[0]+'T12:00:00'):s);return isNaN(dt.getTime())?'—':dt.toLocaleDateString('pl-PL')}
function dateInputValue(d){if(!d)return '';const s=String(d);const m=s.match(/^\d{4}-\d{2}-\d{2}/);return m?m[0]:''}
function fmtGram(v){v=Number(v||0);return v?String(v).replace(/\B(?=(\d{3})+(?!\d))/g,' '):'0'}
function statusName(s){return s==='OPEN'?'OPEN':s==='CLOSED'?'CLOSED':esc(s||'')}
function setLoggedOut(showMsg){
  TOKEN=''; ME=null; STORE.del('carp_token');
  const logout=q('logoutBtn'), auth=q('auth'), app=q('app');
  if(logout)logout.classList.add('hidden');
  if(auth)auth.classList.remove('hidden');
  if(app)app.classList.add('hidden');
  const who=q('who'), role=q('role'), notif=q('notifCounter');
  if(who)who.textContent=''; if(role)role.textContent=''; if(notif)notif.textContent='';
  if(showMsg)msg('Sesja wyczyszczona. Zaloguj się ponownie.','ok');
}
async function boot(){
  const logout=q('logoutBtn'), auth=q('auth'), app=q('app');
  if(logout)logout.classList.add('hidden');
  if(auth)auth.classList.remove('hidden');
  if(app)app.classList.add('hidden');
  if(!TOKEN){setLoggedOut(false);return}
  try{const d=await api('/api/me');ME=d.user}catch(e){setLoggedOut(false);return}
  if(auth)auth.classList.add('hidden');
  if(app)app.classList.remove('hidden');
  if(logout)logout.classList.remove('hidden');
  q('who').textContent=ME.first_name+' '+ME.last_name+' — Koło PZW '+(ME.pzw_club||'');q('role').textContent=ME.role==='ADMIN'?'Administrator':'Zawodnik';
  const admin=ME.role==='ADMIN';q('btn-players').classList.toggle('hidden',!admin);q('adminCreate').classList.toggle('hidden',!admin);
  // Service worker wyłączony w V23, żeby nie blokował logowania ani nie robił pętli cache.
  renderPushStatus();
  showTab('competitions');
  await Promise.allSettled([loadCompetitions(),loadNotifications(),admin?loadPlayers():Promise.resolve()]);
}
async function login(){try{const phone=q('loginPhone')?.value||'';const password=q('loginPassword')?.value||'';if(!phone.trim()||!password)throw new Error('Wpisz telefon i hasło');const d=await api('/api/login',{method:'POST',body:JSON.stringify({phone,password})});TOKEN=d.token;STORE.set('carp_token',TOKEN);msg('Zalogowano');await boot()}catch(e){msg(e.message,'bad')}}
async function registerPlayer(ev){if(ev){ev.preventDefault&&ev.preventDefault();ev.stopPropagation&&ev.stopPropagation()}try{const d=await api('/api/register',{method:'POST',body:JSON.stringify({phone:q('regPhone').value,password:q('regPassword').value,firstName:q('regFirst').value,lastName:q('regLast').value,pzwClub:q('regClub').value})});TOKEN=d.token;STORE.set('carp_token',TOKEN);msg('Konto zawodnika utworzone');await boot()}catch(e){msg(e.message,'bad')}}
async function setupAdmin(ev){if(ev){ev.preventDefault&&ev.preventDefault();ev.stopPropagation&&ev.stopPropagation()}try{const d=await api('/api/setup-admin',{method:'POST',body:JSON.stringify({setupCode:q('setupCode').value,phone:q('setupPhone').value,password:q('setupPassword').value,firstName:q('setupFirst').value,lastName:q('setupLast').value,pzwClub:q('setupClub').value})});TOKEN=d.token;STORE.set('carp_token',TOKEN);msg('Admin utworzony');await boot()}catch(e){msg(e.message,'bad')}}
function logout(){STORE.del('carp_token');TOKEN='';ME=null;setLoggedOut(true)}
async function clearSession(){try{if('serviceWorker'in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister().catch(()=>{})));}if('caches'in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k).catch(()=>{})));}}catch(_){}setLoggedOut(true)}
function showTab(n){['competitions','notifications','players'].forEach(x=>{q('tab-'+x).classList.toggle('hidden',x!==n);q('btn-'+x)?.classList.toggle('active',x===n)});if(n==='notifications')loadNotifications();if(n==='players')loadPlayers()}
async function loadCompetitions(){
  const d=await api('/api/competitions'); const arr=d.competitions||[]; const admin=ME&&ME.role==='ADMIN'; let html='';
  if(admin){html+='<div class="small muted" style="margin-bottom:8px">Liczba zawodów w bazie: <b>'+arr.length+'</b></div>'; if(arr.length)html+='<button type="button" class="warn" style="margin-bottom:10px" onclick="clearCompetitions()">Usuń wszystkie zawody testowe</button>'}
  if(!arr.length){q('competitionsList').innerHTML=html+'<p class="muted">Brak zawodów.</p>';return}
  html+='<div class="tablewrap"><table><thead><tr><th>Zawody</th><th>Data</th><th>Stan zapisów</th><th>Status</th><th>Akcja</th></tr></thead><tbody>';
  html+=arr.map(c=>{const mine=c.my_status==='ACTIVE'||c.my_status==='RESERVE';const closed=c.status!=='OPEN'||c.signup_open===false;const main=Number(c.active_count||0), reserve=Number(c.reserve_count||0), limit=Number(c.limit_places||0);const stat='<b>'+main+'</b>'+(limit?' / '+limit:'')+(reserve?' + rezerwa '+reserve:'');const actions=admin?'<div class="inlineBtns"><button type="button" onclick="openCompetition('+c.id+')">Panel</button><button type="button" class="secondary" onclick="openCompetition('+c.id+')">Edytuj</button><button type="button" class="warn" onclick="deleteCompetition('+c.id+')">Usuń</button></div>':('<div class="inlineBtns"><button type="button" onclick="openCompetition('+c.id+')">Szczegóły</button>'+(mine?'<button type="button" class="warn" onclick="leaveComp('+c.id+')">Wypisz</button>':'<button type="button" '+(closed?'disabled':'')+' onclick="joinComp('+c.id+')">Zapisz</button>')+'</div>');return '<tr class="'+(mine?'mine':'')+'"><td><b>'+esc(c.title)+'</b><br><span class="muted small">'+esc(c.fishery||'')+'</span></td><td class="nowrap">'+fmtDate(c.competition_date)+'</td><td class="nowrap">'+stat+'</td><td><span class="pill">'+statusName(c.status)+'</span></td><td>'+actions+'</td></tr>'}).join('');
  html+='</tbody></table></div>'; q('competitionsList').innerHTML=html;
}
async function createCompetition(ev){if(CREATING_COMPETITION)return;CREATING_COMPETITION=true;const btn=ev?.target;if(btn){btn.disabled=true;btn.textContent='Tworzę...'}try{const limit=q('cLimit').value.trim();if(!limit)throw new Error('Podaj liczbę osób');await api('/api/competitions',{method:'POST',body:JSON.stringify({fishery:q('cFishery').value,competitionDate:q('cDate').value,limitPlaces:limit,notes:q('cNotes').value,status:'OPEN'})});['cFishery','cDate','cLimit','cNotes'].forEach(id=>q(id).value='');await loadCompetitions();await loadNotifications();msg('Utworzono zawody')}catch(e){msg(e.message,'bad')}finally{CREATING_COMPETITION=false;if(btn){btn.disabled=false;btn.textContent='Utwórz zawody'}}}
async function deleteCompetition(id){try{if(!confirm('Usunąć te zawody?'))return;await api('/api/competitions/'+id,{method:'DELETE'});q('competitionDetail').classList.add('hidden');msg('Usunięto zawody');await loadCompetitions();await loadNotifications()}catch(e){msg(e.message,'bad')}}
async function clearCompetitions(){try{if(!confirm('Usunąć WSZYSTKIE zawody testowe z bazy?'))return;if(!confirm('Na pewno? Operacji nie da się cofnąć.'))return;const d=await api('/api/admin/competitions/clear',{method:'POST',body:JSON.stringify({confirm:'USUN'})});q('competitionDetail').classList.add('hidden');msg('Usunięto zawody: '+d.deleted);await loadCompetitions();await loadNotifications()}catch(e){msg(e.message,'bad')}}
async function joinComp(id){try{await api('/api/competitions/'+id+'/join',{method:'POST',body:'{}'});msg('Zapisano na zawody');await loadCompetitions();if(CURRENT_DETAIL?.competition?.id==id)await refreshCompetitionKeepScroll(id)}catch(e){msg(e.message,'bad')}}
async function leaveComp(id){try{if(!confirm('Wypisać się z tych zawodów?'))return;await api('/api/competitions/'+id+'/leave',{method:'POST',body:'{}'});msg('Wypisano z zawodów');await loadCompetitions();if(CURRENT_DETAIL?.competition?.id==id)await refreshCompetitionKeepScroll(id)}catch(e){msg(e.message,'bad')}}
async function openCompetition(id,preserve=false){try{const d=await api('/api/competitions/'+id);CURRENT_DETAIL=d;renderDetail();q('competitionDetail').classList.remove('hidden');if(!preserve)q('competitionDetail').scrollIntoView({behavior:'smooth',block:'start'})}catch(e){msg(e.message,'bad')}}
function myDraw(round){return (CURRENT_DETAIL.draws||[]).find(d=>Number(d.user_id)===Number(ME.id)&&Number(d.round)===round)}
function resMap(round){const m={};(CURRENT_DETAIL.results||[]).forEach(r=>{if(Number(r.round)===round)m[Number(r.user_id)]=r});return m}
function resultItems(round,userId,kind){return (CURRENT_DETAIL.resultItems||[]).filter(x=>Number(x.round)===Number(round)&&Number(x.user_id)===Number(userId)&&(!kind||String(x.kind)===kind))}
function drawMap(round){const m={};(CURRENT_DETAIL.draws||[]).forEach(r=>{if(Number(r.round)===round)m[Number(r.user_id)]=r});return m}
function renderDetail(){
  const d=CURRENT_DETAIL;const c=d.competition;const admin=ME.role==='ADMIN';let html='<div class="card"><div class="inlineBtns"><button type="button" class="secondary" onclick="q(\'competitionDetail\').classList.add(\'hidden\')">Zamknij panel zawodów</button><button type="button" onclick="openCompetition('+c.id+')">Odśwież</button></div><h2>'+esc(c.title)+'</h2><p class="muted">'+fmtDate(c.competition_date)+' — '+esc(c.fishery||'')+'</p></div>';
  if(admin) html+=renderAdminDetail(d); else html+=renderPlayerDetail(d);
  q('competitionDetail').innerHTML=html;
  if(admin) setTimeout(()=>setupStructureAuto(c.id),0);
  setTimeout(()=>renderPushStatus(),0);
}
function rosterCounts(d){const c=d.rosterCounts||{};return {main:Number(c.active_count||0),reserve:Number(c.reserve_count||0),cancel:Number(c.cancelled_count||0),limit:Number(d.competition.limit_places||0),draw:Number((d.activeEntries||[]).length),stands:Number(d.competition.bank1_count||0)+Number(d.competition.bank2_count||0)}}
function statusLabel(s){return s==='ACTIVE'?'Lista główna':s==='RESERVE'?'Rezerwa':s==='CANCELLED'?'Wypisany':esc(s||'')}
function renderCountPanelInner(d){const x=rosterCounts(d);const over=x.limit&&x.main>x.limit;const bad=x.stands&&x.stands!==x.draw;return '<h2>Kontrola stanu zawodników</h2><div class="grid4"><div><span class="muted small">Lista główna</span><br><b style="font-size:24px">'+x.main+'</b>'+(x.limit?' / '+x.limit:'')+'</div><div><span class="muted small">Rezerwa</span><br><b style="font-size:24px">'+x.reserve+'</b></div><div><span class="muted small">Do losowania</span><br><b style="font-size:24px">'+x.draw+'</b></div><div><span class="muted small">Stanowiska w strukturze</span><br><b style="font-size:24px">'+x.stands+'</b></div></div>'+(over?'<p class="bad">Lista główna jest powyżej limitu — decyzja admina. Losowanie obejmie wszystkich z listy głównej.</p>':'')+(bad?'<p class="bad">Liczba stanowisk w strukturze nie zgadza się z liczbą zawodników do losowania. Popraw strukturę albo świadomie zostaw nadmiar/rezerwę stanowisk.</p>':'')+'<p class="small muted">Panel losowania używa dokładnie listy głównej. Rezerwa nie trafia do losowania, dopóki admin nie przeniesie zawodnika strzałką na listę główną.</p>'}
function renderCountPanel(d){const x=rosterCounts(d);const over=x.limit&&x.main>x.limit;const bad=x.stands&&x.stands!==x.draw;return '<div id="liveCountPanel" class="card '+(over||bad?'danger-line':'success-line')+'">'+renderCountPanelInner(d)+'</div>'}
function renderAdminDetail(d){const c=d.competition;return renderCountPanel(d)+'<div class="card"><h2>Dane zawodów</h2><div class="grid"><div><label>Nazwa</label><input id="dTitle" value="'+esc(c.title)+'"></div><div><label>Łowisko</label><input id="dFishery" value="'+esc(c.fishery||'')+'"></div><div><label>Data</label><input id="dDate" type="date" value="'+dateInputValue(c.competition_date)+'"></div><div><label>Liczba osób / limit listy głównej</label><input id="dLimit" type="number" value="'+esc(c.limit_places||'')+'"></div><div><label>Status zapisów</label><select id="dStatus"><option value="OPEN" '+(c.status==='OPEN'?'selected':'')+'>OPEN — zapisy otwarte</option><option value="CLOSED" '+(c.status==='CLOSED'?'selected':'')+'>CLOSED — zamknięte</option></select></div></div><label>Opis / notatki</label><textarea id="dNotes">'+esc(c.notes||'')+'</textarea><button type="button" onclick="saveCompetition('+c.id+')">Zapisz dane zawodów</button></div>'+renderStructurePanel(d)+renderRosterTools(d)+renderEntries(d)+renderDrawPanel(d)+renderResultsAdmin(d)}
function renderStructurePanel(d){const c=d.competition;const x=rosterCounts(d);return '<div class="card"><h2>Struktura łowiska i sektory</h2><p class="small muted">Mapa działa jak w projekcie losowania: sektory są pionowe, granice góra/dół są wspólne, numery stanowisk mają jeden algorytm. Podgląd przelicza się automatycznie po zmianie pola. Przycisk Zastosuj zapisuje strukturę.</p><div class="grid"><div><label>Tryb mapy</label><select id="dMapMode"><option value="TWO_OPPOSITE" '+(c.map_mode==='TWO_OPPOSITE'?'selected':'')+'>Dwa brzegi naprzeciwko</option><option value="ONE_BANK" '+(c.map_mode==='ONE_BANK'?'selected':'')+'>Jeden brzeg</option><option value="TWO_ALONG" '+(c.map_mode==='TWO_ALONG'?'selected':'')+'>Dwa brzegi wzdłuż brzegu</option></select></div><div><label>Brzeg dolny / brzeg 1</label><input id="dBank1" type="number" value="'+esc(c.bank1_count||0)+'"></div><div><label>Brzeg górny / brzeg 2</label><input id="dBank2" type="number" value="'+esc(c.bank2_count||0)+'"></div><div><label>Liczba sektorów</label><input id="dSectors" type="number" value="'+esc(c.sectors_count||1)+'" min="1" max="26"></div></div><label class="checkline"><input id="dAutoBanks" type="checkbox" checked> Automatycznie dopasuj brzegi do listy głównej / limitu. Przy nieparzystej liczbie więcej dostaje brzeg dolny.</label><div class="inlineBtns"><button type="button" class="secondary" onclick="autoFillBanksFromRoster(false,event)">Auto dopasuj teraz</button><button type="button" onclick="saveCompetition('+c.id+',false,event)">Zastosuj / zapisz strukturę</button></div><div class="small muted" id="structureHint">Cel: '+x.draw+' do losowania; limit: '+x.limit+'.</div><h3>Szybki podgląd graficzny podziału na sektory</h3><div id="structurePreview">'+renderMap(d)+'</div><h3>Zakresy stanowisk dla sektorów</h3><div id="sectorCardsWrap">'+renderSectorCards(c)+'</div></div>'}
function renderPlayerDetail(d){const c=d.competition;const e=d.myEntry;const t1=myDraw(1), t2=myDraw(2);let html='<div class="playerView"><div class="card ownbox"><div class="ownitem"><span class="tag t1tag">T1</span><br><strong>'+(t1?esc(t1.stand):'—')+'</strong><br><span>'+(t1?'Sektor '+esc(t1.sector):'Brak losowania')+'</span></div><div class="ownitem"><span class="tag t2tag">T2</span><br><strong>'+(t2?esc(t2.stand):'—')+'</strong><br><span>'+(t2?'Sektor '+esc(t2.sector):'Brak losowania')+'</span></div></div>';html+='<div class="card"><h2>Mapa sytuacyjna — Twoje stanowiska mocnym kolorem</h2>'+renderMap(d)+'</div>';html+='<div class="card"><h2>Losowanie</h2>'+renderDrawTable(d,false)+'</div>';html+='<div class="card"><h2>Wyniki T1</h2>'+renderClassTable(d.classification.round1)+'</div><div class="card"><h2>Wyniki T2</h2>'+renderClassTable(d.classification.round2)+'</div><div class="card"><h2>Klasyfikacja końcowa</h2>'+renderGeneralTable(d.classification.general)+'</div></div>';return html}
async function saveCompetition(id,quiet=false,ev){const btn=ev?.target;try{if(btn){btn.disabled=true}await api('/api/competitions/'+id,{method:'PATCH',body:JSON.stringify({title:q('dTitle')?.value||'',fishery:q('dFishery')?.value||'',competitionDate:q('dDate')?.value||'',limitPlaces:q('dLimit')?.value||'',status:q('dStatus')?.value||'OPEN',mapMode:q('dMapMode')?.value||'TWO_OPPOSITE',bank1Count:q('dBank1')?.value||0,bank2Count:q('dBank2')?.value||0,sectorsCount:q('dSectors')?.value||1,autoBanks:Boolean(q('dAutoBanks')?.checked),notes:q('dNotes')?.value||''})});if(!quiet)msg('Zapisano zmiany');await loadCompetitions();if(!quiet)await refreshCompetitionKeepScroll(id)}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false}}}
function renderRosterTools(d){const c=d.competition;return '<div class="card"><h2>Wgranie listy zawodników</h2><p class="small muted">Import i ręczne dopisanie uzupełniają najpierw listę główną do limitu, a nadmiar idzie na rezerwę. Admin może później przenieść rezerwowego na listę główną nawet powyżej limitu.</p><label>Link zawody.pro</label><input id="zproUrl" placeholder="https://www.zawody.pro/competitions/79/details"><button type="button" class="blue" onclick="importZawodyPro('+c.id+',event)">Importuj listę z zawody.pro</button><hr style="border:0;border-top:1px solid var(--line);margin:14px 0"><h3>Ręcznie dopisz zawodnika</h3><div class="grid"><div><label>Imię i nazwisko</label><input id="manualFullName" placeholder="Jan Kowalski"></div><div><label>Telefon — opcjonalnie</label><input id="manualPhone" placeholder="np. 501222333"></div><div><label>Nr Koła PZW — opcjonalnie</label><input id="manualClub"></div><div><label>Hasło — opcjonalnie, jeśli ma się logować</label><input id="manualPassword" type="password"></div><div><label>Gdzie dopisać</label><select id="manualStatus"><option value="AUTO">Auto: główna do limitu, potem rezerwa</option><option value="ACTIVE">Od razu lista główna</option><option value="RESERVE">Od razu rezerwa</option></select></div></div><button type="button" onclick="addManualPlayer('+c.id+',event)">Dopisz zawodnika</button></div>'}
function importZawodyPro(id,ev){const btn=ev?.target;if(btn){btn.disabled=true;btn.textContent='Importuję...'}try{const url=q('zproUrl').value.trim();api('/api/admin/competitions/'+id+'/import-zawody-pro',{method:'POST',body:JSON.stringify({url})}).then(async d=>{const r=d.result||{};msg('Import: główna '+(r.main||0)+', rezerwa '+(r.reserve||0)+', razem '+(r.imported||0));await refreshCompetitionKeepScroll(id);await loadCompetitions();await loadPlayers();await loadNotifications()}).catch(e=>msg(e.message,'bad')).finally(()=>{if(btn){btn.disabled=false;btn.textContent='Importuj listę z zawody.pro'}})}catch(e){msg(e.message,'bad');if(btn){btn.disabled=false;btn.textContent='Importuj listę z zawody.pro'}}}
async function addManualPlayer(id,ev){const btn=ev?.target;if(btn){btn.disabled=true;btn.textContent='Dopisuję...'}try{const fullName=q('manualFullName').value.trim();if(!fullName)throw new Error('Podaj imię i nazwisko');await api('/api/admin/competitions/'+id+'/players/manual',{method:'POST',body:JSON.stringify({fullName,phone:q('manualPhone').value,pzwClub:q('manualClub').value,password:q('manualPassword').value,entryStatus:q('manualStatus').value})});['manualFullName','manualPhone','manualClub','manualPassword'].forEach(x=>{const el=q(x);if(el)el.value='' });msg('Dopisano zawodnika');await refreshCompetitionKeepScroll(id);await loadCompetitions();await loadPlayers();await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Dopisz zawodnika'}}}
async function setEntryStatus(compId,entryId,action){try{const txt=action==='promote'?'Przenieść na listę główną?':action==='reserve'?'Przenieść na rezerwę?':'Wypisać zawodnika z zawodów?';if(!confirm(txt))return;await api('/api/admin/competitions/'+compId+'/entries/'+entryId+'/'+action,{method:'POST',body:'{}'});msg('Zmieniono status zawodnika');await refreshCompetitionKeepScroll(compId);await loadCompetitions();await loadPlayers();await loadNotifications()}catch(e){msg(e.message,'bad')}}
function rosterTable(title,rows,compId,kind){rows=rows||[];let html='<h3>'+title+' <span class="pill">'+rows.length+'</span></h3>';if(!rows.length)return html+'<p class="muted small">Brak.</p>';html+='<div class="tablewrap"><table><thead><tr><th>Zawodnik</th><th>Telefon</th><th>Koło</th><th>Status</th><th>Akcja</th></tr></thead><tbody>';html+=rows.map(e=>{let buttons='';if(kind==='ACTIVE')buttons='<div class="inlineBtns"><button type="button" class="secondary" onclick="setEntryStatus('+compId+','+e.id+',\'reserve\')">⬇ Rezerwa</button><button type="button" class="warn" onclick="setEntryStatus('+compId+','+e.id+',\'cancel\')">Wypisz</button></div>';else if(kind==='RESERVE')buttons='<div class="inlineBtns"><button type="button" onclick="setEntryStatus('+compId+','+e.id+',\'promote\')">⬆ Do głównej</button><button type="button" class="warn" onclick="setEntryStatus('+compId+','+e.id+',\'cancel\')">Wypisz</button></div>';else buttons='<button type="button" class="secondary" onclick="setEntryStatus('+compId+','+e.id+',\'reserve\')">Przywróć na rezerwę</button>';return '<tr><td><b>'+esc(e.first_name+' '+e.last_name)+'</b></td><td class="nowrap">'+esc(e.phone)+'</td><td>'+esc(e.pzw_club)+'</td><td><span class="pill">'+statusLabel(e.status)+'</span></td><td>'+buttons+'</td></tr>'}).join('');return html+'</tbody></table></div>'}
function renderEntries(d){const c=d.competition;return '<div class="card"><h2>Panel zapisów — lista główna i rezerwa</h2>'+renderCountPanel(d)+rosterTable('Lista główna — bierze udział w losowaniu',d.activeEntries||[],c.id,'ACTIVE')+rosterTable('Lista rezerwowa',d.reserveEntries||[],c.id,'RESERVE')+rosterTable('Wypisani',d.cancelledEntries||[],c.id,'CANCELLED')+'</div>'}
function renderDrawPanel(d){const c=d.competition;const x=rosterCounts(d);return '<div class="card"><h2>Losowanie stanowisk</h2><div class="card '+(x.stands===x.draw?'success-line':'danger-line')+'"><b>Do losowania: '+x.draw+' zawodników z listy głównej.</b><br><span class="small muted">Stanowiska w strukturze: '+x.stands+'. Rezerwa nie jest losowana. Przed losowaniem system jeszcze raz dopasuje brzegi do listy głównej.</span></div><div class="grid3"><button type="button" onclick="drawRound('+c.id+',1,event)">Losuj T1</button><button type="button" class="blue" onclick="drawRound('+c.id+',2,event)">Losuj T2</button><button type="button" class="secondary" onclick="publishDraw('+c.id+',event)">Publikuj losowanie</button></div><p class="small muted">Losuj T1/T2 zapisuje testowe losowanie bez wysyłki do zawodników. Publikuj losowanie wysyła powiadomienia z T1/T2. T2 pilnuje, żeby zawodnik nie dostał tego samego stanowiska co w T1.</p>'+renderMap(d)+'<h3>Tabela losowania</h3>'+renderDrawTable(d,true)+'</div>'}
async function drawRound(id,round,ev){const btn=ev?.target;try{if(!confirm('Wykonać losowanie T'+round+' dla aktualnej listy głównej? Poprzednie T'+round+' zostanie zastąpione. Powiadomienia pójdą dopiero po kliknięciu Publikuj losowanie.'))return;if(btn){btn.disabled=true;btn.textContent='Losuję...'}await api('/api/admin/competitions/'+id+'/draw/'+round,{method:'POST',body:'{}'});msg('Wylosowano T'+round+' — bez publikacji');await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Losuj T'+round}}}
async function publishDraw(id,ev){const btn=ev?.target;try{if(!confirm('Opublikować losowanie i wysłać powiadomienia zawodnikom?'))return;if(btn){btn.disabled=true;btn.textContent='Publikuję...'}const d=await api('/api/admin/competitions/'+id+'/draw/publish',{method:'POST',body:'{}'});msg('Opublikowano losowanie. Powiadomiono: '+d.notified);await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Publikuj losowanie'}}}
function renderDrawTable(d,admin){const entries=(d.activeEntries||[]);const dm1=drawMap(1), dm2=drawMap(2);if(!entries.length)return '<p class="muted">Brak aktywnych zawodników.</p>';return '<div class="tablewrap"><table><thead><tr><th>Zawodnik</th><th>T1 stan.</th><th>T1 sektor</th><th>T2 stan.</th><th>T2 sektor</th></tr></thead><tbody>'+entries.map(e=>{const a=dm1[Number(e.user_id)],b=dm2[Number(e.user_id)];const mine=Number(e.user_id)===Number(ME.id);return '<tr class="'+(mine?'mine':'')+'"><td><b>'+esc(e.first_name+' '+e.last_name)+'</b><br><span class="small muted">'+esc(e.pzw_club)+'</span></td><td class="nowrap">'+(a?esc(a.stand):'—')+'</td><td>'+(a?esc(a.sector):'—')+'</td><td class="nowrap">'+(b?esc(b.stand):'—')+'</td><td>'+(b?esc(b.sector):'—')+'</td></tr>'}).join('')+'</tbody></table></div>'}
function sectorSizesClient(total,n,mode){total=Math.max(1,Number(total||1));n=Math.max(1,Math.min(26,Number(n||1),total));const base=Math.floor(total/n),rem=total%n;return Array.from({length:n},(_,i)=>base+(i>=n-rem?1:0))}
function autoBankSplitClient(total,mode){total=Math.max(1,Number(total||1));if(mode==='ONE_BANK')return [total,0];return [Math.ceil(total/2),Math.floor(total/2)]}
function rosterTargetForStructure(){const active=Number(CURRENT_DETAIL?.rosterCounts?.active_count||CURRENT_DETAIL?.activeEntries?.length||0),limit=Number(q('dLimit')?.value||CURRENT_DETAIL?.competition?.limit_places||0);return Math.max(1,active||limit||1)}
function autoBankSplitClient(total,mode){total=Math.max(1,Number(total||1));if(mode==='ONE_BANK')return [total,0];return [Math.ceil(total/2),Math.floor(total/2)]}
function draftCompetition(){const c=Object.assign({},CURRENT_DETAIL.competition);c.map_mode=q('dMapMode')?.value||c.map_mode;c.bank1_count=Number(q('dBank1')?.value||0);c.bank2_count=Number(q('dBank2')?.value||0);c.sectors_count=Number(q('dSectors')?.value||1);c.limit_places=Number(q('dLimit')?.value||c.limit_places||0);return c}
function liveCountUpdate(){const el=q('liveCountPanel');if(!el||!CURRENT_DETAIL)return;const d={competition:draftCompetition(),rosterCounts:CURRENT_DETAIL.rosterCounts,activeEntries:CURRENT_DETAIL.activeEntries};el.innerHTML=renderCountPanelInner(d)}
function scheduleStructureSave(){/* auto-zapis struktury wyłączony: zapis tylko przyciskiem, bez pętli przewijania */}
function autoFillBanksFromRoster(saveNow=false,ev){if(ev){ev.preventDefault&&ev.preventDefault();ev.stopPropagation&&ev.stopPropagation()}const c=draftCompetition();const target=rosterTargetForStructure();const sp=autoBankSplitClient(target,c.map_mode);if(q('dBank1'))q('dBank1').value=sp[0];if(q('dBank2'))q('dBank2').value=sp[1];updateStructurePreview();if(saveNow===true)scheduleStructureSave();}
function setupStructureAuto(compId){STRUCTURE_READY=false;['dMapMode','dBank1','dBank2','dSectors','dLimit'].forEach(id=>{const el=q(id);if(!el||el.dataset.autoReady)return;el.dataset.autoReady='1';el.addEventListener('input',()=>{if((id==='dBank1'||id==='dBank2')&&q('dAutoBanks'))q('dAutoBanks').checked=false;if(q('dAutoBanks')?.checked&&(id==='dMapMode'||id==='dLimit'))autoFillBanksFromRoster(false);else updateStructurePreview();});el.addEventListener('change',()=>{if((id==='dBank1'||id==='dBank2')&&q('dAutoBanks'))q('dAutoBanks').checked=false;if(q('dAutoBanks')?.checked&&(id==='dMapMode'||id==='dLimit'))autoFillBanksFromRoster(false);else updateStructurePreview();});});const auto=q('dAutoBanks');if(auto&&!auto.dataset.autoReady){auto.dataset.autoReady='1';auto.addEventListener('change',()=>{if(auto.checked)autoFillBanksFromRoster(false);else updateStructurePreview();});}if(q('dAutoBanks')?.checked)autoFillBanksFromRoster(false);else updateStructurePreview();setTimeout(()=>{STRUCTURE_READY=true},120);}
function updateStructurePreview(){if(!CURRENT_DETAIL||!q('structurePreview'))return;const d=JSON.parse(JSON.stringify(CURRENT_DETAIL));d.competition=draftCompetition();q('structurePreview').innerHTML=renderMap(d);const cards=q('sectorCardsWrap');if(cards)cards.innerHTML=renderSectorCards(d.competition);liveCountUpdate();const x=rosterCounts({competition:d.competition,rosterCounts:CURRENT_DETAIL.rosterCounts,activeEntries:CURRENT_DETAIL.activeEntries});const hint=q('structureHint');if(hint)hint.innerHTML='Cel: <b>'+x.draw+'</b> do losowania, limit: <b>'+x.limit+'</b>, struktura: <b>'+x.stands+'</b> stanowisk. '+(x.stands===x.draw?'Zgodne.':'Różnica — kliknij Auto dopasuj albo przejdź do innego pola, żeby zapisać.');}
function visualColumnCountClient(c){const b1=Math.max(0,Number(c.bank1_count||0)),b2=Math.max(0,Number(c.bank2_count||0));return Math.max(1,b1+b2)}
function allocateBottomCountsClient(sizes,b1,b2,mode){b1=Math.max(0,Number(b1||0));b2=Math.max(0,Number(b2||0));const total=Math.max(1,b1+b2);if((mode||'TWO_OPPOSITE')==='ONE_BANK')return sizes.slice();const raw=sizes.map((s,i)=>({i,size:s,val:s*b1/total}));const bottom=raw.map(x=>Math.max(0,Math.min(x.size,Math.floor(x.val))));let diff=b1-bottom.reduce((a,b)=>a+b,0);if(diff>0){const order=raw.slice().sort((a,b)=>((b.val-Math.floor(b.val))-(a.val-Math.floor(a.val)))||a.i-b.i);let guard=0;while(diff>0&&guard++<1000){let changed=false;for(const x of order){if(diff<=0)break;if(bottom[x.i]<x.size){bottom[x.i]++;diff--;changed=true}}if(!changed)break}}else if(diff<0){const order=raw.slice().sort((a,b)=>((a.val-Math.floor(a.val))-(b.val-Math.floor(b.val)))||b.i-a.i);let guard=0;while(diff<0&&guard++<1000){let changed=false;for(const x of order){if(diff>=0)break;if(bottom[x.i]>0){bottom[x.i]--;diff++;changed=true}}if(!changed)break}}return bottom}
function sectorLayoutClient(c){const b1=Math.max(0,Number(c.bank1_count||0)),b2=Math.max(0,Number(c.bank2_count||0)),total=Math.max(1,b1+b2),mode=c.map_mode||'TWO_OPPOSITE';const sizes=sectorSizesClient(total,c.sectors_count||1,mode);const bottomCounts=allocateBottomCountsClient(sizes,b1,b2,mode);let bottomCursor=1,topCursorAsc=b1+1,topCursorDesc=b1+b2;return sizes.map((size,idx)=>{const letter=String.fromCharCode(65+idx);const bottomCount=mode==='ONE_BANK'?size:Math.max(0,Math.min(size,bottomCounts[idx]||0));const topCount=mode==='ONE_BANK'?0:Math.max(0,size-bottomCount);const bottom=[],top=[];for(let i=0;i<bottomCount;i++)if(bottomCursor<=b1)bottom.push(bottomCursor++);if(mode==='TWO_ALONG'){for(let i=0;i<topCount;i++)if(topCursorAsc<=b1+b2)top.push(topCursorAsc++)}else{for(let i=0;i<topCount;i++)if(topCursorDesc>b1)top.push(topCursorDesc--)}return {letter,size,bottomCount,topCount,bottom,top}})}
function balancedColumnSpansClient(cols,sectors){const sizes=sectorSizesClient(cols,sectors,'ONE_BANK');let cursor=1;return sizes.map((w,i)=>{const o={letter:String.fromCharCode(65+i),start:cursor,end:cursor+w-1,width:w};cursor+=w;return o})}
function standColumnClient(stand,c){stand=Number(stand);let cursor=1;for(const sec of sectorLayoutClient(c)){if(sec.bottom.includes(stand)||sec.top.includes(stand))return cursor;cursor+=sec.size}return 1}
function sectorSpansClient(c){return sectorLayoutClient(c).map((s,i)=>({letter:s.letter,start:i+1,end:i+1,width:s.size,size:s.size,bottom:s.bottom,top:s.top}))}
function sectorForColumnClient(col,spans){return spans[Math.max(0,Math.min(spans.length-1,Number(col||1)-1))]?.letter||'A'}
function sectorMapClient(c){const m={};for(const sec of sectorLayoutClient(c)){for(const n of sec.bottom)m[Number(n)]=sec.letter;for(const n of sec.top)m[Number(n)]=sec.letter}return m}
function sectorForStandClient(stand,c){return sectorMapClient(c)[Number(stand)]||'A'}
function sectorRangesData(c){return sectorLayoutClient(c).map(sec=>{const stands=[...sec.bottom,...sec.top].sort((a,b)=>a-b);return {letter:sec.letter,stands,size:stands.length,bottom:sec.bottom,top:sec.top,width:sec.size}})}
function compactRange(arr){arr=(arr||[]).slice();if(!arr.length)return '—';const asc=arr.slice().sort((a,b)=>a-b);if(asc.length===1)return String(asc[0]);return asc[0]+'-'+asc[asc.length-1]}
function renderSectorRanges(c){const ranges=sectorRangesData(c);let txt='Automatyczny podział równy — sektory różnią się maksymalnie o 1; najmniejsze idą od A. ';if((c.map_mode||'TWO_OPPOSITE')==='ONE_BANK'){txt+=ranges.map(r=>r.letter+' ('+r.size+' os.): '+compactRange(r.bottom)).join(' • ')}else if((c.map_mode||'TWO_OPPOSITE')==='TWO_ALONG'){txt+=ranges.map(r=>r.letter+' ('+r.size+' os.): brzeg 1 '+compactRange(r.bottom)+' / brzeg 2 '+compactRange(r.top)).join(' • ')}else{txt+=ranges.map(r=>r.letter+' ('+r.size+' os.): dół '+compactRange(r.bottom)+' / góra '+compactRange(r.top)).join(' • ')}return '<div class="sectorSummary">'+esc(txt)+'</div>'}
function sectorColorClass(letter){return 'sectorFill-'+String(letter||'A').replace(/[^A-Z]/g,'')}
function renderStandCell(n,c,drawStands,own1,own2,empty=false){if(empty)return '<div class="standCell empty"></div>';const sec=sectorForStandClient(n,c);let cls='standCell '+sectorColorClass(sec)+' '+(drawStands.has(Number(n))?'occ':'');const t1=own1&&Number(own1.stand)===Number(n),t2=own2&&Number(own2.stand)===Number(n);if(t1&&t2)cls+=' both';else if(t1)cls+=' t1';else if(t2)cls+=' t2';return '<div class="'+cls+'"><b>'+n+'</b></div>'}
function mapMinWidth(c){const total=Math.max(1,Number(c.bank1_count||0)+Number(c.bank2_count||0));return Math.max(640,total*34)}
function renderBankGroupRow(c,which,drawStands,own1,own2){const layout=sectorLayoutClient(c),minw=mapMinWidth(c);let html='<div class="sectorFlexRow standFlex" style="min-width:'+minw+'px">';for(const sec of layout){const arr=which==='top'?sec.top:sec.bottom;const count=Math.max(1,arr.length);html+='<div class="sectorGroup" style="flex:'+sec.size+' 0 0;grid-template-columns:repeat('+count+',minmax(32px,1fr))">';if(arr.length){for(const n of arr)html+=renderStandCell(n,c,drawStands,own1,own2)}else html+=renderStandCell(0,c,drawStands,own1,own2,true);html+='</div>'}return html+'</div>'}
function renderOneBankRow(c,drawStands,own1,own2){const layout=sectorLayoutClient(c),minw=mapMinWidth(c);let html='<div class="sectorFlexRow standFlex" style="min-width:'+minw+'px">';for(const sec of layout){const arr=sec.bottom;html+='<div class="sectorGroup" style="flex:'+sec.size+' 0 0;grid-template-columns:repeat('+Math.max(1,arr.length)+',minmax(32px,1fr))">';for(const n of arr)html+=renderStandCell(n,c,drawStands,own1,own2);html+='</div>'}return html+'</div>'}
function renderSectorBand(c){const layout=sectorLayoutClient(c),minw=mapMinWidth(c);let html='<div class="sectorFlexRow sectorBand clean" style="min-width:'+minw+'px">';for(const sec of layout){html+='<div class="sectorBlock '+sectorColorClass(sec.letter)+'" style="flex:'+sec.size+' 0 0"><div class="sectorWord">SEKTOR</div><div class="sectorLetter">'+sec.letter+'</div><div class="sectorPeople">'+sec.size+' osób</div></div>'}return html+'</div>'}
function renderMap(d){const c=d.competition;const own1=myDraw(1),own2=myDraw(2);const drawStands=new Set((d.draws||[]).map(x=>Number(x.stand)));let html='<div class="sectorMap">';if(c.map_mode==='ONE_BANK'){html+='<div class="mapTitle">SEKTORY NA JEDNYM BRZEGU</div>'+renderOneBankRow(c,drawStands,own1,own2)+renderSectorBand(c)}else if(c.map_mode==='TWO_ALONG'){html+='<div class="bankLabel">BRZEG 2</div>'+renderBankGroupRow(c,'top',drawStands,own1,own2)+renderSectorBand(c)+renderBankGroupRow(c,'bottom',drawStands,own1,own2)+'<div class="bankLabel bankLabelBottom">BRZEG 1</div>'}else{html+='<div class="bankLabel">BRZEG GÓRNY</div>'+renderBankGroupRow(c,'top',drawStands,own1,own2)+renderSectorBand(c)+renderBankGroupRow(c,'bottom',drawStands,own1,own2)+'<div class="bankLabel bankLabelBottom">BRZEG DOLNY</div>'}html+=renderSectorRanges(c)+'<p class="small muted"><span class="tag t1tag">czerwony = Twoje T1</span> <span class="tag t2tag">niebieski = Twoje T2</span></p></div>';return html}

function sectorCardRangeText(sec,c){if((c.map_mode||'TWO_OPPOSITE')==='ONE_BANK')return compactRange(sec.bottom);if((c.map_mode||'TWO_OPPOSITE')==='TWO_ALONG')return compactRange(sec.bottom)+', '+compactRange(sec.top);return compactRange(sec.bottom)+', '+compactRange(sec.top)}
function renderSectorCards(c){const layout=sectorLayoutClient(c);return '<div class="grid3 sectorCards">'+layout.map((sec,idx)=>'<div class="card"><h3 style="margin-top:0">Sektor '+(idx+1)+'</h3><label>Nazwa sektora</label><input value="'+esc(sec.letter)+'" readonly><label>Stanowiska przypisane do sektora</label><input value="'+esc(sectorCardRangeText(sec,c))+'" readonly><div class="small muted">Zakresy i pojedyncze numery. Bez powtórzeń między sektorami.</div></div>').join('')+'</div>'}

function renderResultsAdmin(d){const c=d.competition;return '<div class="card"><h2>Wyniki — wpisywanie wag</h2><p class="small muted">Wpisz wagę siatki albo dużej ryby i przejdź do innego pola. Wpis zapisuje się automatycznie, pole mignie na zielono, waga wskakuje na listę powyżej i możesz wpisać kolejną. Krzyżyk usuwa pojedynczy wpis. Generator testowy daje siatki 10 000–99 000g i BF 6 000–15 000g, z odstępem tysięcy w widoku.</p><div class="grid3"><button type="button" class="secondary" onclick="generateResults('+c.id+',1,event)">Generuj wyniki T1</button><button type="button" class="secondary" onclick="generateResults('+c.id+',2,event)">Generuj wyniki T2</button><button type="button" class="blue" onclick="generateResultsAll('+c.id+',event)">Generuj T1 + T2</button></div><div class="twoCols"><div><h3>T1</h3>'+renderResultForm(d,1)+'</div><div><h3>T2</h3>'+renderResultForm(d,2)+'</div></div><div class="grid"><button type="button" onclick="saveResults('+c.id+',1,event)">Przelicz T1</button><button type="button" onclick="saveResults('+c.id+',2,event)">Przelicz T2</button></div><div class="grid"><button type="button" class="blue" onclick="notifyResults('+c.id+',1)">Powiadom o wynikach T1</button><button type="button" class="blue" onclick="notifyResults('+c.id+',2)">Powiadom o wynikach T2</button></div>'+renderSectorResultsBoard(d)+'<h3>Klasyfikacja T1</h3>'+renderClassTable(d.classification.round1)+'<h3>Klasyfikacja T2</h3>'+renderClassTable(d.classification.round2)+'<h3>Klasyfikacja końcowa</h3>'+renderGeneralTable(d.classification.general)+'</div>'}

function sortRowsBySectorPlace(rows){return [...(rows||[])].sort((a,b)=>Number(a.points||999)-Number(b.points||999)||Number(b.weight||0)-Number(a.weight||0)||String(a.name||'').localeCompare(String(b.name||''),'pl'))}
function groupRowsBySector(rows){const box={};for(const r of (rows||[])){const sec=String(r.sector||'—').trim()||'—';(box[sec]=box[sec]||[]).push(r)}return Object.keys(box).sort((a,b)=>a.localeCompare(b,'pl')).map(sec=>({sector:sec,rows:sortRowsBySectorPlace(box[sec])}))}
function renderSectorMiniTable(group){return '<div class="card" style="padding:8px;margin:0 0 10px 0"><h4 style="margin:0 0 6px 0;text-align:center">Sektor '+esc(group.sector)+'</h4><div class="tablewrap"><table class="sharpTable"><thead><tr><th class="center" style="width:42px">Msc</th><th class="center" style="width:50px">Stan</th><th>Zawodnik</th><th class="right" style="width:108px">Waga</th></tr></thead><tbody>'+group.rows.map(r=>'<tr class="'+(Number(r.user_id)===Number(ME.id)?'mine':'')+'"><td class="center"><b>'+placeText(r.points)+'</b></td><td class="center nowrap">'+(r.stand||'—')+'</td><td><b>'+esc(r.name)+'</b><br><span class="small muted">'+esc(r.pzw_club||'')+'</span></td><td class="right nowrap">'+resultCellSummary(r)+'</td></tr>').join('')+'</tbody></table></div></div>'}
function renderSectorResultsColumn(rows,title){const groups=groupRowsBySector(rows);return '<div><h3 style="text-align:center;margin-top:0">'+esc(title)+'</h3>'+(groups.length?groups.map(renderSectorMiniTable).join(''):'<p class="muted">Brak wyników sektorowych.</p>')+'</div>'}
function renderSectorResultsBoard(d){return '<div class="card"><h2>Wyniki sektorowe</h2><p class="small muted">Układ jak w projekcie losowania: po lewej tabelki sektorowe 1 tury, po prawej tabelki sektorowe 2 tury.</p><div class="twoCols"><div>'+renderSectorResultsColumn(d.classification.round1,'1 tura')+'</div><div>'+renderSectorResultsColumn(d.classification.round2,'2 tura')+'</div></div></div>'}

function renderWeightItems(round,uid,kind){const arr=resultItems(round,uid,kind);if(!arr.length)return '<div class="small muted">Brak zapisanych wag.</div>';return '<div class="weightItems">'+arr.map(i=>'<span class="weightTag '+(kind==='BF'?'bfTag':'netTag')+'">'+fmtGram(i.weight)+'g <button type="button" title="Usuń" onclick="deleteWeightItem('+i.id+')">×</button></span>').join('')+'</div>'}
function resultCellSummary(r){r=r||{};const bf=Number(r.big_fish||0);return '<b>'+fmtGram(r.weight||0)+'g</b>'+(bf?'<br><span class="bfLine">BF: '+fmtGram(bf)+'g</span>':'')}
function renderResultForm(d,round){const entries=d.activeEntries||[];const dm=drawMap(round);const rm=resMap(round);if(!entries.length)return '<p class="muted">Brak aktywnych zawodników.</p>';let html='<div class="tablewrap"><table class="resultInputTable"><thead><tr><th>Zawodnik</th><th>Stan.</th><th>Sektor</th><th>Wagi siatek</th><th>Duże ryby BF</th><th>Suma</th></tr></thead><tbody>';html+=entries.map(e=>{const uid=Number(e.user_id),dr=dm[uid],r=rm[uid]||{};return '<tr><td><b>'+esc(e.first_name+' '+e.last_name)+'</b></td><td>'+(dr?esc(dr.stand):'—')+'</td><td>'+(dr?esc(dr.sector):'—')+'</td><td>'+renderWeightItems(round,uid,'NET')+'<input class="weightInput" inputmode="numeric" id="net-'+round+'-'+uid+'" placeholder="nowa waga siatki g" onblur="addWeightItem('+d.competition.id+','+round+','+uid+',\'NET\',this)" onkeydown="weightKey(event)"></td><td>'+renderWeightItems(round,uid,'BF')+'<input class="weightInput" inputmode="numeric" id="bf-'+round+'-'+uid+'" placeholder="nowa duża ryba g" onblur="addWeightItem('+d.competition.id+','+round+','+uid+',\'BF\',this)" onkeydown="weightKey(event)"></td><td class="nowrap">'+resultCellSummary(r)+'</td></tr>'}).join('');return html+'</tbody></table></div>'}
function weightKey(ev){if(ev.key==='Enter'){ev.preventDefault();ev.target.blur();}}
async function refreshCompetitionKeepScroll(compId){try{const d=await api('/api/competitions/'+compId);CURRENT_DETAIL=d;renderDetail();q('competitionDetail').classList.remove('hidden');}catch(e){msg(e.message,'bad')}}
async function addWeightItem(compId,round,userId,kind,el){try{const val=String(el?.value||'').trim();if(!val)return;if(el?.dataset?.saving==='1')return;if(el&&el.dataset)el.dataset.saving='1';const td=el.closest('td');if(td)td.classList.add('flashSave');await api('/api/admin/competitions/'+compId+'/results/'+round+'/items',{method:'POST',body:JSON.stringify({userId,kind,weight:val})});if(el)el.value='';setTimeout(async()=>{try{await refreshCompetitionKeepScroll(compId);await loadNotifications()}finally{if(el&&el.dataset)el.dataset.saving='0'}},350)}catch(e){if(el&&el.dataset)el.dataset.saving='0';msg(e.message,'bad')}}
async function deleteWeightItem(itemId){try{if(!confirm('Usunąć ten wpis wagi?'))return;const compId=CURRENT_DETAIL.competition.id;await api('/api/admin/results/items/'+itemId,{method:'DELETE'});msg('Usunięto wpis wagi');await refreshCompetitionKeepScroll(compId)}catch(e){msg(e.message,'bad')}}
async function saveResults(id,round,ev){if(SAVING_RESULTS)return;SAVING_RESULTS=true;const btn=ev?.target;if(btn){btn.disabled=true;btn.textContent='Przeliczam...'}try{const results=(CURRENT_DETAIL.activeEntries||[]).map(e=>({userId:e.user_id}));await api('/api/admin/competitions/'+id+'/results/'+round,{method:'POST',body:JSON.stringify({results})});msg('Przeliczono wyniki T'+round);await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{SAVING_RESULTS=false;if(btn){btn.disabled=false;btn.textContent='Przelicz T'+round}}}
async function generateResults(id,round,ev){const btn=ev?.target;try{if(!confirm('Wygenerować testowe wyniki T'+round+'? Obecne wpisy wag tej tury zostaną zastąpione.'))return;if(btn){btn.disabled=true;btn.textContent='Generuję...'}const d=await api('/api/admin/competitions/'+id+'/results/'+round+'/generate',{method:'POST',body:'{}'});msg('Wygenerowano wyniki T'+round+' dla '+d.count+' zawodników');await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Generuj wyniki T'+round}}}
async function generateResultsAll(id,ev){const btn=ev?.target;try{if(!confirm('Wygenerować testowe wyniki T1 i T2? Obecne wpisy wag obu tur zostaną zastąpione.'))return;if(btn){btn.disabled=true;btn.textContent='Generuję...'}const a=await api('/api/admin/competitions/'+id+'/results/1/generate',{method:'POST',body:'{}'});const b=await api('/api/admin/competitions/'+id+'/results/2/generate',{method:'POST',body:'{}'});msg('Wygenerowano T1 i T2: '+a.count+' / '+b.count+' zawodników');await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}finally{if(btn){btn.disabled=false;btn.textContent='Generuj T1 + T2'}}}
async function notifyResults(id,round){try{if(!confirm('Wysłać zawodnikom powiadomienie o wynikach T'+round+'?'))return;const d=await api('/api/admin/competitions/'+id+'/results/'+round+'/notify',{method:'POST',body:'{}'});msg('Powiadomiono zawodników: '+d.notified);await refreshCompetitionKeepScroll(id);await loadNotifications()}catch(e){msg(e.message,'bad')}}
function renderClassTable(rows){rows=rows||[];if(!rows.length)return '<p class="muted">Brak wyników.</p>';return '<div class="tablewrap"><table><thead><tr><th>Zawodnik</th><th>Stan.</th><th>Sektor</th><th>Miejsce</th><th>Waga</th></tr></thead><tbody>'+rows.map(r=>'<tr class="'+(Number(r.user_id)===Number(ME.id)?'mine':'')+'"><td><b>'+esc(r.name)+'</b><br><span class="small muted">'+esc(r.pzw_club||'')+'</span></td><td class="nowrap">'+(r.stand||'—')+'</td><td>'+esc(r.sector||'—')+'</td><td>'+esc(r.points||'—')+'</td><td class="nowrap">'+resultCellSummary(r)+'</td></tr>').join('')+'</tbody></table></div>'}
function placeText(v){return (v===0||v)?esc(v):'—'}
function renderGeneralTable(rows){rows=rows||[];if(!rows.length)return '<p class="muted">Brak klasyfikacji końcowej.</p>';return '<div class="tablewrap finalWrap"><table class="generalTable sharpTable"><thead><tr><th class="colRank center">MSC</th><th class="colName">Zawodnik</th><th class="colRound center">T1</th><th class="colRound center">T2</th><th class="colSum center">Suma miejsc</th><th class="colWeight right">Waga</th></tr></thead><tbody>'+rows.map(r=>'<tr class="'+(Number(r.user_id)===Number(ME.id)?'mine':'')+'"><td class="colRank center"><b>'+r.rank+'</b></td><td class="colName nameCell"><b>'+esc(r.name)+'</b><br><span class="small muted">'+esc(r.pzw_club||'')+'</span></td><td class="colRound center scoreCell"><b>'+placeText(r.t1_points)+'</b></td><td class="colRound center scoreCell"><b>'+placeText(r.t2_points)+'</b></td><td class="colSum center sumCell"><b>'+placeText(r.sum_points)+'</b></td><td class="colWeight right weightCell"><b>'+fmtGram(r.total_weight)+'g</b>'+(Number(r.biggest_fish||0)?'<br><span class="bfLine">BF: '+fmtGram(r.biggest_fish)+'g</span>':'')+'</td></tr>').join('')+'</tbody></table></div>'}
async function loadNotifications(){if(!ME)return;const d=await api('/api/notifications');const arr=d.notifications||[];const unread=arr.filter(n=>!n.read_at).length;q('notifCounter').textContent=unread?'Nowe powiadomienia: '+unread:'';q('notificationsList').innerHTML=arr.length?'<div class="tablewrap"><table><thead><tr><th>Zdarzenie</th><th>Czas</th><th>Status</th></tr></thead><tbody>'+arr.map(n=>'<tr class="'+(!n.read_at?'mine':'')+'"><td><b>'+esc(n.title)+'</b><br>'+esc(n.body)+'</td><td class="nowrap small">'+new Date(n.created_at).toLocaleString('pl-PL')+'</td><td>'+(n.read_at?'Przecz.':'<button type="button" onclick="readNotif('+n.id+')">OK</button>')+'</td></tr>').join('')+'</tbody></table></div>':'<p class="muted">Brak powiadomień.</p>'}
async function readNotif(id){await api('/api/notifications/'+id+'/read',{method:'POST',body:'{}'});loadNotifications()}
async function loadPlayers(){if(!ME||ME.role!=='ADMIN')return;const d=await api('/api/admin/players');q('playersList').innerHTML='<div class="tablewrap"><table><thead><tr><th>Imię i nazwisko</th><th>Telefon</th><th>Koło PZW</th><th>Rola</th><th>Aktywne zapisy</th></tr></thead><tbody>'+d.players.map(p=>'<tr><td><b>'+esc(p.first_name+' '+p.last_name)+'</b></td><td class="nowrap">'+esc(p.phone)+'</td><td>'+esc(p.pzw_club)+'</td><td>'+esc(p.role)+'</td><td>'+esc(p.active_entries||0)+'</td></tr>').join('')+'</tbody></table></div>'}
function urlBase64ToUint8Array(base64String){const padding='='.repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base64);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;++i)out[i]=raw.charCodeAt(i);return out}
function pushHelpText(){if(!('Notification'in window))return 'Ta przeglądarka nie obsługuje powiadomień.';if(Notification.permission==='granted')return 'Push: zgoda udzielona. Powiadomienia systemowe mogą działać na tym urządzeniu.';if(Notification.permission==='denied')return 'Push: zablokowane w przeglądarce. Kod aplikacji nie może włączyć tego na siłę. Odblokuj: kłódka/ustawienia strony → Powiadomienia → Zezwalaj, albo wyczyść dane strony i wejdź ponownie. Powiadomienia w aplikacji dalej działają.';return 'Push: nieustawione. Kliknij Push/status i zaakceptuj zgodę.'}
function renderPushStatus(){const el=q('pushStatus');if(!el)return;let cls='tag';if('Notification'in window){if(Notification.permission==='granted')cls+=' ok';else if(Notification.permission==='denied')cls+=' bad'}el.innerHTML='<span class="'+cls+'">'+esc(pushHelpText())+'</span>'}
async function resetPush(){try{if('serviceWorker'in navigator){const reg=await navigator.serviceWorker.getRegistration('/');const sub=reg?await reg.pushManager.getSubscription():null;if(sub)await sub.unsubscribe();}if(TOKEN)await api('/api/push-subscription',{method:'DELETE'}).catch(()=>{});msg('Subskrypcja push wyczyszczona w aplikacji. Zgody zablokowanej w przeglądarce nie da się wyczyścić kodem.');renderPushStatus()}catch(e){msg(e.message,'bad')}}
async function enablePush(){msg('Push chwilowo wyłączony w V23, żeby odciąć problem cache/logowania. Powiadomienia w aplikacji dalej działają.','bad');renderPushStatus()}
function scrollAppTop(){window.scrollTo({top:0,behavior:'smooth'})}

function bindAuthButtons(){
  const pairs=[['clearSessionBtn',clearSession],['regBtn',registerPlayer],['setupAdminBtn',setupAdmin],['pushBtn',enablePush],['logoutBtn',logout]];
  for(const [id,fn] of pairs){const el=q(id);if(el&&!el.dataset.bound){el.dataset.bound='1';el.onclick=null;el.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();fn(ev);});}}
  ['loginPhone','loginPassword'].forEach(id=>{const el=q(id);if(el&&!el.dataset.enterLogin){el.dataset.enterLogin='1';el.addEventListener('keydown',ev=>{if(ev.key==='Enter')login(ev);});}});
}

function scrollAppBottom(){window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'})}
Object.assign(window,{boot,login,registerPlayer,setupAdmin,logout,showTab,loadCompetitions,createCompetition,deleteCompetition,clearCompetitions,joinComp,leaveComp,openCompetition,saveCompetition,drawRound,publishDraw,saveResults,generateResults,generateResultsAll,addWeightItem,deleteWeightItem,notifyResults,readNotif,loadNotifications,loadPlayers,enablePush,resetPush,clearSession,importZawodyPro,addManualPlayer,setEntryStatus,setupStructureAuto,autoFillBanksFromRoster,updateStructurePreview,scrollAppTop,scrollAppBottom});
function startBoot(){console.log('CLIENT_V28_BOOT');try{fetch('/__probe_boot_v28',{cache:'no-store'}).catch(()=>{})}catch(_){};try{if('serviceWorker'in navigator){navigator.serviceWorker.getRegistrations().then(rs=>rs.forEach(r=>r.unregister().catch(()=>{}))).catch(()=>{})}if('caches'in window){caches.keys().then(ks=>ks.forEach(k=>caches.delete(k).catch(()=>{}))).catch(()=>{})}}catch(_){}bindAuthButtons();boot().catch(e=>{console.error('BOOT_FATAL',e);try{msg('Błąd startu aplikacji: '+(e.message||e),'bad')}catch(_){}})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startBoot);else startBoot();`;

const HTML = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0b3b35">
<meta name="application-name" content="Łowcy Methodowcy">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Łowcy Methodowcy">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<script>try{if(localStorage.getItem('carp_token'))document.documentElement.classList.add('hasSavedSession')}catch(e){}</script>
<title>Łowcy Methodowcy — V98</title>
<style>
:root{--green:#114b2f;--green2:#17643f;--bg:#f3f6ef;--card:#fff;--line:#cfd8cc;--txt:#18251d;--muted:#68746d;--red:#b32020;--gold:#ffc400;--blue:#1057c8;--soft:#eaf2eb}
*{box-sizing:border-box}html,body{height:auto!important;min-height:100%!important;overflow-y:auto!important;overscroll-behavior:auto!important}body{margin:0;background:var(--bg);color:var(--txt);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}header{position:sticky;top:0;z-index:5;background:var(--green);color:white;padding:12px 14px;box-shadow:0 2px 8px #0002}header .row{display:flex;justify-content:space-between;gap:12px;align-items:center;max-width:1180px;margin:auto}h1{font-size:18px;margin:0}h2{font-size:18px;margin:0 0 8px}h3{font-size:16px;margin:12px 0 8px}main{max-width:1180px;margin:0 auto;padding:12px}.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;margin:12px 0;box-shadow:0 2px 8px #0000000d}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}input,select,textarea,button{width:100%;font:inherit;border-radius:12px;border:1px solid var(--line);padding:10px 11px;background:white}textarea{min-height:70px}button{border:0;background:var(--green);color:white;font-weight:900;cursor:pointer}button.secondary{background:#e7eee7;color:var(--green);border:1px solid #bfd0c2}button.warn{background:var(--red)}button.blue{background:var(--blue)}button:disabled{opacity:.55;cursor:not-allowed}label{display:block;font-size:12px;font-weight:900;color:var(--muted);margin:8px 0 4px}.tabs{display:flex;gap:8px;overflow:auto;padding:8px 0}.tabs button{white-space:nowrap;width:auto;padding:9px 13px}.tabs button.active{background:#072e1c}.tablewrap{width:100%;overflow:auto;border-radius:12px;border:1px solid var(--line)}table{width:100%;border-collapse:collapse;background:white}th,td{border:1px solid var(--line);padding:8px 7px;text-align:left;vertical-align:middle}th{background:#e6f0e8;color:#103b28;font-size:12px;text-transform:uppercase}.nowrap{white-space:nowrap}.muted{color:var(--muted)}.ok{color:var(--green);font-weight:900}.bad{color:var(--red);font-weight:900}.pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#e6f0e8;font-weight:900}.hidden{display:none!important}.top-actions{display:flex;gap:8px;align-items:center}.top-actions button{width:auto;padding:8px 11px;background:#ffffff22;border:1px solid #ffffff55}.small{font-size:12px}.right{text-align:right}.mine{background:#fff4b8!important;outline:3px solid var(--gold);outline-offset:-3px;font-weight:900}.mine td{font-weight:900}.danger-line{border-left:6px solid var(--red)}.success-line{border-left:6px solid var(--green)}.mapbox{background:#f7faf4;border:1px solid var(--line);border-radius:14px;padding:10px;overflow:auto}.banktitle{font-size:12px;font-weight:900;color:var(--muted);margin:8px 0 5px}.bank{display:grid;grid-template-columns:repeat(auto-fit,minmax(42px,1fr));gap:5px;min-width:320px}.stand{min-height:42px;border:1px solid #a8b7aa;border-radius:9px;background:white;display:flex;align-items:center;justify-content:center;flex-direction:column;font-weight:900;font-size:12px}.stand small{font-size:9px;font-weight:800;color:#555}.stand.occ{box-shadow:inset 0 -4px 0 #cbd8cc}.stand.t1{background:#ffe1e1;border:3px solid #d00000;color:#8e0000}.stand.t2{background:#dfeaff;border:3px solid #005bd8;color:#003c91}.stand.both{background:#f0dcff;border:3px solid #7a1fc2;color:#461078}.ownbox{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ownitem{border:2px solid var(--line);border-radius:14px;padding:12px;background:#fff}.ownitem strong{font-size:24px}.twoCols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.inlineBtns{display:flex;gap:6px;flex-wrap:wrap}.inlineBtns button{width:auto}.competitionActions{gap:22px;align-items:center}.competitionActions button{min-width:96px}.adminbar{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.tag{font-size:11px;border-radius:999px;padding:3px 7px;background:#f0f4ee;font-weight:900}.t1tag{background:#ffe1e1;color:#8e0000}.t2tag{background:#dfeaff;color:#003c91}.sector-A{box-shadow:inset 0 0 0 2px #b32020}.sector-B{box-shadow:inset 0 0 0 2px #1057c8}.sector-C{box-shadow:inset 0 0 0 2px #14803a}.sector-D{box-shadow:inset 0 0 0 2px #7a1fc2}.sector-E{box-shadow:inset 0 0 0 2px #b36b00}.sector-F{box-shadow:inset 0 0 0 2px #006b7a}.checkline{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--txt);font-weight:800}.checkline input{width:auto}.sectorMap{background:#fbfdf9;border:1px solid var(--line);border-radius:14px;padding:12px;overflow:auto}.mapTitle,.bankLabel{font-weight:1000;color:#204b38;margin:5px 0}.standRow{display:grid;gap:0;min-width:640px}.standCell{min-height:45px;border:2px solid #446b56;display:flex;align-items:center;justify-content:center;flex-direction:column;font-weight:1000;color:#123827;margin:-1px 0 0 -1px}.standCell small{font-size:10px}.standCell.empty{border:0;background:transparent}.sectorBand{display:grid;min-width:640px;gap:0}.sectorBlock{min-height:78px;border:3px solid #38664d;display:flex;align-items:center;justify-content:center;flex-direction:column;margin:-1px 0 0 -1px;text-align:center}.sectorBlock span{font-size:22px;font-weight:1000}.sectorSummary{background:#ecf2ed;border-radius:10px;padding:10px;margin-top:10px;font-size:13px}.water{text-align:center;background:#f2f6f1;color:#6a756d;font-weight:1000;padding:12px;min-width:640px}.sectorFill-A{background:#d8f1dd}.sectorFill-B{background:#dbe8fb}.sectorFill-C{background:#ffe7bd}.sectorFill-D{background:#f6d9e3}.sectorFill-E{background:#eadffb}.sectorFill-F{background:#dff4f4}.sectorFill-G{background:#f7e8ce}.sectorFill-H{background:#e5f0d0}.standCell.t1{background:#ffb5b5!important;border:4px solid #d00000!important;color:#7c0000}.standCell.t2{background:#b9d2ff!important;border:4px solid #005bd8!important;color:#002c70}.standCell.both{background:#e1b8ff!important;border:4px solid #7a1fc2!important;color:#3c0060}.standCell.occ{box-shadow:inset 0 -5px 0 #244f36}.weightItems{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px}.weightTag{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 6px;font-size:11px;font-weight:900;background:#edf4ec;border:1px solid #bfd0c2}.weightTag button{width:auto;padding:0 4px;border-radius:8px;background:#b91c1c;color:#fff;line-height:1.1}.bfTag{background:#fff0d6;border-color:#e5b965}.netTag{background:#e7f5e7}.bfLine{font-size:12px;font-weight:1000;color:#b91c1c}.flashSave{background:#bff7c8!important;transition:background .25s}.resultInputTable input{min-width:120px}.sectorBand.clean{margin:0}.sectorFlexRow{display:flex;gap:0;min-width:640px}.sectorGroup{display:grid;gap:0;margin:0}.sectorGroup .standCell{border-radius:0;margin:-1px 0 0 -1px}.sectorFlexRow .sectorBlock{border-radius:0;margin:-1px 0 0 -1px}.standFlex{align-items:stretch}.sectorBand.clean .sectorBlock{min-height:72px}.pushBox{margin-top:6px;line-height:1.35}.bankLabelBottom{margin-top:8px}.quickScroll{position:fixed;right:10px;bottom:14px;z-index:30;display:flex;flex-direction:column;gap:7px}.quickScroll button{width:52px;padding:9px 0;border-radius:999px;background:#123827cc;box-shadow:0 3px 10px #0003}.quickScroll button:last-child{background:#e7eee7;color:#123827;border:1px solid #bfd0c2}

.sectorMap,.sectorMap .mapTitle,.sectorMap .bankLabel,.sectorMap .sectorSummary{text-align:center}.sectorBlock{min-height:118px;text-align:center;gap:4px;padding:10px 4px}.sectorWord{font-size:13px;font-weight:1000;letter-spacing:.08em;line-height:1}.sectorLetter{font-size:36px;font-weight:1000;line-height:1}.sectorPeople{font-size:13px;font-weight:1000;line-height:1.1}.standCell{text-align:center}.playerView{text-align:center}.playerView table th,.playerView table td{text-align:center}.playerView .inlineBtns{justify-content:center}.playerView .ownitem{text-align:center}.playerView .sectorSummary{text-align:center}.playerView .card{text-align:center}
.sharpTable{border-collapse:collapse;background:#fff;color:#001b12;font-size:14px;line-height:1.18;text-rendering:geometricPrecision}.sharpTable th,.sharpTable td{border:1.5px solid #b8cbbb;padding:8px 8px}.sharpTable th{background:#e2eee5;color:#052719;font-weight:1000;letter-spacing:.02em}.generalTable{width:100%;table-layout:auto}.generalTable .center{text-align:center}.generalTable .right{text-align:right}.generalTable .colRank{width:42px}.generalTable .colRound{width:52px;min-width:44px}.generalTable .colSum{width:78px;min-width:68px}.generalTable .colWeight{width:118px;min-width:105px}.generalTable .colName{width:auto;min-width:130px;white-space:normal}.generalTable .nameCell b{font-weight:1000}.generalTable .scoreCell b,.generalTable .sumCell b,.generalTable .weightCell b{font-size:15px;font-weight:1000}.generalTable .weightCell{white-space:nowrap}.finalWrap{box-shadow:0 1px 0 #00000012}.workZoneTabs{position:sticky;top:58px;z-index:4;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;background:var(--bg);padding:10px 0 6px}.workZoneTabs button{min-height:58px;background:#dfe9e1;color:#123827;border:2px solid #a9bcae;font-size:14px;line-height:1.2}.workZoneTabs button.active{background:var(--green);color:#fff;border-color:var(--green);box-shadow:0 3px 10px #0002}.adminZone{min-height:120px}

.place1 td{background:#fdeaea!important}.place2 td{background:#e8edf7!important}.place3 td{background:#e8f4eb!important}
.place1 td:first-child{background:#c62828!important;color:#fff!important}.place2 td:first-child{background:#173b70!important;color:#fff!important}.place3 td:first-child{background:#2e7d32!important;color:#fff!important}
.playerDrawTabs{display:grid;grid-template-columns:1fr 1fr;gap:14px}.playerDrawTabs button{background:#dfe9e1;color:#123827;border:2px solid #a9bcae}.playerDrawTabs button.active{background:var(--green);color:#fff;border-color:var(--green)}
.roundDrawSection{margin-top:12px}.roundMapHeading{font-weight:1000;font-size:20px;color:#204b38;margin-bottom:10px}.roundDrawRow{align-items:stretch}.roundDrawCell{min-height:132px;border:1.5px solid #9aafa2;margin:-1px 0 0 -1px;padding:5px 3px;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;position:relative;overflow:hidden}.roundDrawCell.empty{border:0;background:transparent}.roundStandNo{font-size:15px;align-self:flex-start}.roundDrawName{font-size:12px;font-weight:800;writing-mode:vertical-rl;transform:rotate(180deg);line-height:1.05;margin-top:5px;white-space:nowrap}.ownRoundDraw{outline:4px solid var(--gold);outline-offset:-4px}.fisheryWater{font-size:20px;color:#315b48}.drawSectorGrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:10px;margin-top:12px}.drawSectorBox{margin:0;padding:8px}.drawSectorBox h4{text-align:center;margin:2px 0 8px;color:#204b38}.center{text-align:center!important}.workZoneTabs{grid-template-columns:repeat(4,minmax(0,1fr))}

@media(max-width:760px){.competitionActions{gap:16px}.competitionActions button{min-width:92px}main{padding:8px}.grid,.grid3,.grid4,.twoCols,.ownbox,.adminbar{grid-template-columns:1fr}.card{border-radius:12px;padding:10px}th,td{padding:6px 4px;font-size:11px}h1{font-size:16px}input,select,textarea,button{padding:10px}.tabs button{font-size:12px;padding:8px 10px}.top-actions button{font-size:12px}.stand{min-height:36px;font-size:11px}.bank{grid-template-columns:repeat(auto-fit,minmax(36px,1fr))}.standRow,.sectorBand{min-width:520px}.sectorBlock span{font-size:17px}.sectorBlock{min-height:105px}.sectorLetter{font-size:30px}.sectorWord,.sectorPeople{font-size:11px}.finalWrap{border-radius:10px}.generalTable{min-width:360px;width:100%;table-layout:fixed}.generalTable .colRank{width:34px}.generalTable .colRound{width:36px;min-width:36px}.generalTable .colSum{width:54px;min-width:54px}.generalTable .colWeight{width:82px;min-width:82px}.generalTable .colName{width:auto;min-width:0}.generalTable th,.generalTable td{padding:7px 4px;font-size:11.5px}.generalTable th{font-size:10px}.generalTable .nameCell b{font-size:12px}.generalTable .scoreCell b,.generalTable .sumCell b,.generalTable .weightCell b{font-size:12px}.generalTable .bfLine{font-size:10px}.workZoneTabs{top:52px;grid-template-columns:repeat(2,minmax(0,1fr));padding-top:6px;gap:5px}.workZoneTabs button{min-height:58px;padding:7px 5px;font-size:11px}}
/* V33 — czytelność, mobilność i stabilny układ */
html,body{max-width:100%;overflow-x:hidden!important}body{-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility;font-size:15px}main,.card,.adminZone,.grid>*,.grid3>*,.grid4>*,.twoCols>*,.resultEntryRounds>*,.workZoneTabs>*{min-width:0}.tablewrap{max-width:100%;overflow-x:auto;overflow-y:hidden;-webkit-overflow-scrolling:touch;overscroll-behavior-inline:contain}.sectorMap{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;overscroll-behavior-inline:contain}.workZoneTabs{grid-template-columns:repeat(5,minmax(0,1fr))}.resultEntryRounds{display:grid;grid-template-columns:minmax(0,1fr);gap:18px;margin-top:14px}.resultRoundPanel{min-width:0}.resultInputTable{min-width:760px}.resultInputTable input{min-width:108px;font-size:14px}.roundDrawCell{min-height:138px;padding:6px 4px}.roundStandNo{font-size:22px!important;line-height:1;font-weight:1000;align-self:flex-start}.roundDrawName{font-size:13px;font-weight:900}.standCell>b{font-size:18px;line-height:1}.sectorBlock{min-height:104px}.sectorLetter{font-size:34px}.sharpTable{font-size:14px}.stationStandBest{background:#c9ecd2!important;color:#0b4927!important;font-size:18px!important;font-weight:1000}.stationStandWorst{background:#ffd8a6!important;color:#7a3700!important;font-size:18px!important;font-weight:1000}.finalClub{display:inline!important;margin-left:5px;font-size:12px!important;font-weight:700}.finalClub.hidden{display:none!important}.finalClubToggle{margin:8px 0 10px}.roundClassTable td,.roundClassTable th{text-rendering:geometricPrecision}
@media(max-width:760px){body{font-size:14px}main{padding:7px}.card{padding:10px}.workZoneTabs{grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;top:52px}.workZoneTabs button{font-size:12px;min-height:54px;padding:8px 6px}.workZoneTabs button:last-child{grid-column:1/-1}th,td{font-size:12.5px;padding:7px 5px}.sharpTable{font-size:12.5px}.sharpTable th,.sharpTable td{padding:7px 5px}.small{font-size:11.5px}.roundStandNo{font-size:20px!important}.roundDrawName{font-size:12px}.standCell>b{font-size:17px}.sectorMap{padding:8px}.sectorBlock{min-height:92px;padding:6px 3px}.sectorLetter{font-size:29px}.sectorWord,.sectorPeople{font-size:11.5px}.resultInputTable{min-width:720px}.resultInputTable input{min-width:104px;font-size:13px}.generalTable{min-width:0;width:100%;table-layout:fixed}.generalTable th,.generalTable td{font-size:12px;padding:7px 4px}.generalTable th{font-size:10.5px}.generalTable .nameCell b{font-size:12.5px}.generalTable .scoreCell b,.generalTable .sumCell b,.generalTable .weightCell b{font-size:12.5px}.generalTable .colRank{width:34px}.generalTable .colRound{width:38px;min-width:38px}.generalTable .colSum{width:58px;min-width:58px}.generalTable .colWeight{width:88px;min-width:88px}.finalClub{font-size:10.5px!important;margin-left:3px}.twoCols{grid-template-columns:1fr}.drawSectorGrid{grid-template-columns:1fr}.competitionActions{gap:18px}}

/* V34 — osobny, pionowy widok zawodnika na telefonie */
.playerMobileDraw{display:none}.playerDesktopDraw{display:block}.playerOwnTitle{margin:12px 0 7px;font-size:13px;font-weight:1000;color:#315b48;text-transform:uppercase;letter-spacing:.02em}.playerOwnGrid{margin-top:0}.playerOwnItem{text-align:center}.playerOwnItem strong{display:block;font-size:30px;line-height:1.05;margin:4px 0 2px}.playerOwnItem>span:last-child{font-weight:800}.mobileDrawMap{width:100%}.mobileMapMeta{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px;padding:9px 10px;border-radius:12px;background:#edf4ee;color:#173d2e}.mobileMapMeta b{font-size:15px}.mobileMapMeta span{font-size:12px;font-weight:800;color:#557063;text-align:right}.mobileSectorStack{display:grid;gap:9px}.mobileSectorCard{border:1px solid #aebfb4;border-radius:14px;overflow:hidden;box-shadow:0 1px 3px #00000010}.mobileSectorHeader{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:8px 10px;border-bottom:1px solid #aebfb4;background:#ffffffb8;color:#123827}.mobileSectorHeader span{font-size:16px;font-weight:1000}.mobileSectorHeader span b{font-size:24px;line-height:1}.mobileSectorHeader small{font-size:12px;font-weight:900}.mobileBankBlock{padding:7px}.mobileBankBlock+.mobileBankBlock{border-top:1px dashed #9fb0a5}.mobileBankName{margin:0 0 5px;font-size:10.5px;font-weight:1000;letter-spacing:.04em;color:#365b49}.mobileStandGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px}.mobileStandCard{min-width:0;min-height:62px;display:grid;grid-template-columns:44px minmax(0,1fr);align-items:center;border:1px solid #93aa9c;border-radius:10px;overflow:hidden;background:#fff}.mobileStandNo{align-self:stretch;display:flex;align-items:center;justify-content:center;border-right:1px solid #91a89a;font-size:25px;line-height:1;font-weight:1000;color:#123827;background:#ffffff7d}.mobileStandInfo{min-width:0;padding:6px 7px;font-size:12.5px;line-height:1.15;color:#14251b}.mobileStandInfo b{display:block;overflow-wrap:anywhere;word-break:normal}.mobileMineBadge{display:inline-block;margin-top:4px;padding:2px 5px;border-radius:999px;background:#f6b900;color:#3e2b00;font-size:8.5px;font-weight:1000;letter-spacing:.02em}.ownMobileStand{outline:3px solid #f1b800;outline-offset:-3px;box-shadow:0 0 0 2px #fff7c2 inset}.playerRoundDrawSection{overflow:hidden}.playerView .roundClassTable{width:100%}.playerView .drawSectorBox{box-shadow:none}
@media(max-width:760px){
  .playerView{width:100%;max-width:100%;overflow:hidden}.playerView>.card,.playerView .playerResultCard{margin:8px 0;padding:9px}.playerView h2{font-size:17px;line-height:1.18;margin-bottom:8px}.playerView h3{font-size:15px}.playerDrawHeaderCard{padding:8px!important}.playerDrawTabs{gap:7px}.playerDrawTabs button{min-height:48px;padding:9px 5px;font-size:13.5px;line-height:1.15;border-radius:11px}.playerOwnTitle{margin:9px 2px 6px;font-size:11px}.playerView .ownbox.playerOwnGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:7px}.playerOwnItem{min-height:88px;padding:8px 5px;border-radius:12px}.playerOwnItem .tag{font-size:10px;padding:2px 7px}.playerOwnItem strong{font-size:33px;margin:2px 0 0}.playerOwnItem>span:last-child{font-size:12.5px}.playerDesktopDraw{display:none!important}.playerMobileDraw{display:block!important}.playerRoundDrawSection{padding:8px!important}.playerRoundDrawSection>h2{font-size:18px;text-align:center;margin:0 0 8px}.mobileMapMeta{padding:8px;margin-bottom:7px}.mobileMapMeta b{font-size:14px}.mobileMapMeta span{font-size:11px}.mobileSectorStack{gap:7px}.mobileSectorCard{border-radius:12px}.mobileSectorHeader{padding:6px 8px}.mobileSectorHeader span{font-size:13.5px}.mobileSectorHeader span b{font-size:21px}.mobileSectorHeader small{font-size:10.5px}.mobileBankBlock{padding:5px}.mobileBankName{font-size:9.5px;margin-bottom:4px}.mobileStandGrid{gap:4px}.mobileStandCard{min-height:58px;grid-template-columns:40px minmax(0,1fr);border-radius:8px}.mobileStandNo{font-size:23px}.mobileStandInfo{padding:5px 5px;font-size:12px;line-height:1.12}.mobileMineBadge{font-size:7.5px;padding:2px 4px;margin-top:3px}.playerView .drawSectorGrid{grid-template-columns:1fr;gap:7px;margin-top:8px}.playerView .drawSectorBox{padding:6px;margin:0}.playerView .drawSectorBox h4{font-size:14px;margin:1px 0 5px}.playerView .drawSectorBox .sharpTable{table-layout:fixed;width:100%;min-width:0}.playerView .drawSectorBox .sharpTable th,.playerView .drawSectorBox .sharpTable td{font-size:11.5px;padding:6px 4px}.playerView .drawSectorBox .sharpTable th:nth-child(1),.playerView .drawSectorBox .sharpTable td:nth-child(1){width:34px}.playerView .drawSectorBox .sharpTable th:nth-child(2),.playerView .drawSectorBox .sharpTable td:nth-child(2){width:44px}.playerView .roundClassTable{table-layout:fixed;width:100%;min-width:0}.playerView .roundClassTable th,.playerView .roundClassTable td{font-size:11px;padding:6px 3px;line-height:1.15}.playerView .roundClassTable th{font-size:9px}.playerView .roundClassTable th:nth-child(1),.playerView .roundClassTable td:nth-child(1){width:29px}.playerView .roundClassTable th:nth-child(3),.playerView .roundClassTable td:nth-child(3){width:38px}.playerView .roundClassTable th:nth-child(4),.playerView .roundClassTable td:nth-child(4){width:39px}.playerView .roundClassTable th:nth-child(5),.playerView .roundClassTable td:nth-child(5){width:45px}.playerView .roundClassTable th:nth-child(6),.playerView .roundClassTable td:nth-child(6){width:86px}.playerView .roundClassTable td:nth-child(2){font-size:11.5px;overflow-wrap:anywhere}.playerView .roundClassTable td:nth-child(6){white-space:nowrap;font-size:10.5px}.playerView .roundClassTable .bfLine{font-size:9px}.playerView .twoCols{grid-template-columns:1fr!important}.playerView .stationStandBest,.playerView .stationStandWorst{font-size:16px!important}.playerView .finalClubToggle{font-size:11.5px}.playerView .tablewrap{border-radius:10px}.quickScroll{right:4px;bottom:8px;gap:5px}.quickScroll button{width:40px;height:40px;padding:0;font-size:16px;opacity:.88}
}
@media(max-width:350px){.mobileStandGrid{grid-template-columns:1fr}.mobileStandCard{grid-template-columns:44px minmax(0,1fr)}.mobileStandInfo{font-size:12px}}


/* V35 — sticky nawigacja, mobilne karty zawodów, pochyła mapa zawodnika */
.workZoneTabs{
  position:sticky!important;
  top:58px!important;
  z-index:45!important;
  background:linear-gradient(180deg,var(--bg) 0%,var(--bg) 84%,rgba(243,246,239,.96) 100%);
  padding:9px 0 8px!important;
  margin:0!important;
  box-shadow:0 7px 12px -12px #0009;
}
.workZoneTabs button{box-shadow:0 1px 2px #00000012}
.competitionMobileList{display:none}
.competitionMobileCard{width:100%;min-width:0;border:1px solid var(--line);border-radius:14px;background:#fff;padding:11px;box-shadow:0 1px 4px #0000000d;margin:8px 0;overflow:hidden}
.competitionMobileTitle{display:flex;flex-direction:column;gap:2px;min-width:0;padding-right:2px}.competitionMobileTitle>b{font-size:17px;line-height:1.13;color:#102f21;overflow-wrap:anywhere}.competitionMobileTitle>span{font-size:12px;font-weight:700;color:var(--muted);overflow-wrap:anywhere}.competitionMobileMeta{display:grid;grid-template-columns:1.05fr 1.05fr .9fr;gap:6px;margin-top:9px}.competitionMobileMeta>div{min-width:0;border:1px solid #d8e1d9;border-radius:10px;padding:7px 6px;background:#f8fbf7}.competitionMobileMeta small{display:block;font-size:9.5px;line-height:1.05;text-transform:uppercase;color:#5c6c62;font-weight:1000;margin-bottom:4px}.competitionMobileMeta strong{display:block;font-size:13px;line-height:1.12;color:#14251b}.competitionMobileMeta .pill{font-size:11px;padding:4px 7px;white-space:nowrap}.competitionCardActions{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px!important;margin-top:10px}.competitionCardActions button{width:100%!important;min-width:0!important;min-height:44px;padding:9px 7px;font-size:13px}.competitionCardActions button:only-child{grid-column:1/-1}.adminCompetitionCardActions{grid-template-columns:repeat(3,minmax(0,1fr))!important}
#competitionDetail{width:100%;max-width:100%;min-width:0}.playerView{max-width:100%}
/* Lekkie pochylenie kafelków mapy: górny i dolny brzeg są lustrzane; tekst pozostaje prosty. */
.mobileStandCard{overflow:visible!important;background:transparent!important;border:0!important;border-radius:0!important;min-height:64px!important;padding:2px 3px}
.mobileStandCardInner{height:100%;min-height:60px;display:grid;grid-template-columns:43px minmax(0,1fr);align-items:center;border:1.5px solid #8fa698;border-radius:9px;background:#fff;overflow:hidden;box-shadow:0 1px 2px #0000000d;transform-origin:center center}
.mobileStandCard .mobileStandNo{border-right:1px solid #91a89a;background:#ffffffc9}
.mobileBankUpper .mobileStandCardInner{transform:skewX(-4deg)}
.mobileBankUpper .mobileStandCardInner>*{transform:skewX(4deg)}
.mobileBankLower .mobileStandCardInner{transform:skewX(4deg)}
.mobileBankLower .mobileStandCardInner>*{transform:skewX(-4deg)}
.mobileBankSingle .mobileStandCardInner{transform:none}.mobileBankSingle .mobileStandCardInner>*{transform:none}
.mobileStandCard.sectorFill-A .mobileStandCardInner{background:#f7fff8}.mobileStandCard.sectorFill-B .mobileStandCardInner{background:#f7faff}.mobileStandCard.sectorFill-C .mobileStandCardInner{background:#fffaf1}.mobileStandCard.sectorFill-D .mobileStandCardInner{background:#fff7fa}.mobileStandCard.sectorFill-E .mobileStandCardInner{background:#fbf8ff}.mobileStandCard.sectorFill-F .mobileStandCardInner{background:#f6ffff}
.mobileStandCard.ownMobileStand{outline:0!important;box-shadow:none!important}.mobileStandCard.ownMobileStand .mobileStandCardInner{border:3px solid #e6ae00!important;background:#fff9cf!important;box-shadow:0 0 0 2px #fff inset,0 2px 6px #8d6d002f!important}
.mobileStandGrid{padding:0 3px;column-gap:6px!important;row-gap:3px!important}.mobileBankBlock{overflow:hidden}.mobileBankUpper .mobileStandGrid{padding-left:6px;padding-right:2px}.mobileBankLower .mobileStandGrid{padding-left:2px;padding-right:6px}
@media(max-width:760px){
  main{width:100%;max-width:100%;padding-left:6px!important;padding-right:6px!important}
  .competitionDesktopList{display:none!important}.competitionMobileList{display:block!important;width:100%}
  #competitionsList{width:100%;max-width:100%;min-width:0}.competitionMobileCard{margin:7px 0;padding:10px;border-radius:12px}.competitionMobileTitle>b{font-size:16px}.competitionMobileTitle>span{font-size:11.5px}.competitionMobileMeta{grid-template-columns:1fr 1fr;gap:5px}.competitionMobileMeta>div:last-child{grid-column:1/-1;display:flex;align-items:center;justify-content:space-between;gap:8px}.competitionMobileMeta>div:last-child small{margin:0}.competitionMobileMeta small{font-size:9px}.competitionMobileMeta strong{font-size:12.5px}.competitionCardActions{gap:7px!important;margin-top:8px}.competitionCardActions button{min-height:43px;font-size:12.5px}
  #competitionDetail>.card:first-child{margin-top:8px;padding:10px}.competitionActions{width:100%;display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px!important}.competitionActions button{width:100%!important;min-width:0!important}
  .workZoneTabs{top:50px!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:4px!important;padding:5px 0 5px!important;margin:0 -1px!important;background:rgba(243,246,239,.98)!important;box-shadow:0 5px 10px #00000016!important}
  .workZoneTabs button{min-height:44px!important;padding:6px 3px!important;font-size:10.2px!important;line-height:1.08!important;border-radius:9px!important}
  .workZoneTabs button:nth-child(1),.workZoneTabs button:nth-child(2),.workZoneTabs button:nth-child(3){grid-column:span 2}.workZoneTabs button:nth-child(4),.workZoneTabs button:nth-child(5){grid-column:span 3}
  .mobileStandGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:3px 5px!important;padding:0 3px}.mobileStandCard{min-height:61px!important;padding:2px 3px}.mobileStandCardInner{min-height:57px;grid-template-columns:42px minmax(0,1fr);border-radius:8px}.mobileStandNo{font-size:24px!important}.mobileStandInfo{font-size:12.2px!important;line-height:1.12!important;padding:5px 5px!important}.mobileMineBadge{font-size:7.6px!important}.mobileBankUpper .mobileStandCardInner{transform:skewX(-3.5deg)}.mobileBankUpper .mobileStandCardInner>*{transform:skewX(3.5deg)}.mobileBankLower .mobileStandCardInner{transform:skewX(3.5deg)}.mobileBankLower .mobileStandCardInner>*{transform:skewX(-3.5deg)}
}
@media(max-width:380px){
  .competitionMobileMeta{grid-template-columns:1fr 1fr}.competitionMobileTitle>b{font-size:15.5px}.competitionCardActions button{font-size:12px;padding:8px 5px}
  .mobileStandCardInner{grid-template-columns:39px minmax(0,1fr)}.mobileStandNo{font-size:22px!important}.mobileStandInfo{font-size:11.6px!important}
}
@media(max-width:330px){.mobileStandGrid{grid-template-columns:1fr!important}.mobileStandCardInner{grid-template-columns:44px minmax(0,1fr)}.workZoneTabs button{font-size:9.6px!important}}

/* V36 — prosta mapa mobilna, pewny sticky pasek, prośby o wypisanie */
header{z-index:100!important}
.workZoneTabs{position:sticky!important;top:var(--app-header-height,56px)!important;z-index:90!important;background:#f3f6ef!important;box-shadow:0 5px 12px #0000001f!important;border-bottom:1px solid #d2ddd4;padding:7px 0 7px!important}
.leavePendingBtn{background:#f0f3ef!important;color:#607066!important;border:1px solid #c7d2ca!important;opacity:1!important}
.confirmEntryBtn{background:#e2e6e3!important;color:#435047!important;border:1px solid #b9c3bc!important;min-width:106px;font-weight:900}.confirmEntryBtn.confirmed{background:#2e7d32!important;color:#fff!important;border-color:#256b2a!important;box-shadow:0 2px 7px #1d5b2233}.confirmEntryBtn:disabled{opacity:.65}
.leaveRequestRow td{background:#fff9d8}.leaveRequestRow td:first-child{border-left:5px solid #e0aa00}.leaveRequestActions{display:grid;grid-template-columns:1fr 1fr;gap:6px;min-width:190px}.leaveRequestActions button{min-height:38px;padding:7px 8px}.notificationTable td{vertical-align:middle}
/* Wycofanie pochylenia v35: kafelki są znów proste i stabilne. */
.mobileStandCard{overflow:visible!important;background:transparent!important;border:0!important;border-radius:0!important;min-height:62px!important;padding:2px!important}
.mobileStandCardInner{transform:none!important;min-height:58px!important;height:100%;display:grid;grid-template-columns:43px minmax(0,1fr);align-items:center;border:1.5px solid #8fa698;border-radius:9px;background:#fff;overflow:hidden;box-shadow:0 1px 2px #0000000d}
.mobileStandCardInner>*{transform:none!important}.mobileBankUpper .mobileStandCardInner,.mobileBankLower .mobileStandCardInner,.mobileBankSingle .mobileStandCardInner{transform:none!important}.mobileBankUpper .mobileStandCardInner>*,.mobileBankLower .mobileStandCardInner>*,.mobileBankSingle .mobileStandCardInner>*{transform:none!important}
.mobileBankUpper .mobileStandGrid,.mobileBankLower .mobileStandGrid{padding-left:3px!important;padding-right:3px!important}.mobileStandGrid{column-gap:5px!important;row-gap:5px!important}
.mobileStandCard.ownMobileStand .mobileStandCardInner{border:3px solid #e6ae00!important;background:#fff9cf!important;box-shadow:0 0 0 2px #fff inset,0 2px 6px #8d6d002f!important}
@media(max-width:760px){
  .workZoneTabs{top:var(--app-header-height,52px)!important;margin:0 -6px!important;padding:5px 6px!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:4px!important}
  .workZoneTabs button{min-height:45px!important;font-size:10.4px!important;padding:6px 3px!important}
  .mobileStandCardInner{transform:none!important;grid-template-columns:42px minmax(0,1fr);min-height:58px!important}.mobileStandCardInner>*{transform:none!important}
  .notificationWrap{overflow:visible;border:0}.notificationTable,.notificationTable tbody,.notificationTable tr,.notificationTable td{display:block;width:100%}.notificationTable thead{display:none}.notificationTable tr{border:1px solid var(--line);border-radius:12px;margin:8px 0;background:#fff;overflow:hidden}.notificationTable td{border:0;border-bottom:1px solid #e3e9e4;padding:9px;font-size:12px}.notificationTable td:last-child{border-bottom:0}.leaveRequestActions{min-width:0;width:100%;grid-template-columns:1fr 1fr}.leaveRequestActions button{width:100%;min-height:44px}
}

/* V38 — niezawodny pasek kafelków: po przewinięciu przechodzi z układu normalnego na fixed */
.workZoneTabsSlot{width:100%;min-width:0;overflow:visible!important;position:relative}
.workZoneTabs{position:relative!important;top:auto!important;z-index:95!important}
.workZoneTabs.fixedAdminNav{
  position:fixed!important;
  z-index:1000!important;
  margin:0!important;
  background:rgba(243,246,239,.995)!important;
  border:1px solid #d1ddd4!important;
  border-radius:12px!important;
  box-shadow:0 7px 22px #0000002b!important;
  padding:7px!important;
}
@media(max-width:760px){
  .workZoneTabs.fixedAdminNav{padding:5px!important;border-radius:10px!important}
}


/* V37 — naprawa sticky kafelków i kompaktowy podgląd sektorów admina na telefonie */
#competitionDetail,.adminZone{overflow:visible!important}
.workZoneTabs{
  position:sticky!important;
  top:calc(var(--app-header-height,56px) + 4px)!important;
  z-index:95!important;
  background:rgba(243,246,239,.99)!important;
  border-radius:14px!important;
  padding:8px!important;
  margin:2px 0 12px!important;
  box-shadow:0 8px 18px #00000018!important;
  overflow:visible!important;
}
.structurePreviewDesktop{display:block}.structurePreviewMobile{display:none}
.mobileStructureMap{display:block;background:#f9fcf8;border:1px solid var(--line);border-radius:14px;padding:10px}
.compactAdminSectors{display:grid;grid-template-columns:1fr;gap:10px}
.compactAdminSector{border-radius:14px;border:1px solid #c8d5cb;padding:8px;background:#fff;overflow:hidden}
.mobileStructureBank{margin-top:7px}
.mobileStructureGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}
.mobileStructureStand{min-height:46px;border:1.5px solid #95a99b;border-radius:10px;background:#fff;display:flex;align-items:center;justify-content:center;box-shadow:0 1px 2px #00000010}
.mobileStructureStand b{font-size:24px;line-height:1;color:#173627}
@media(min-width:761px){
  .structurePreviewMobile{display:none!important}
  .structurePreviewDesktop{display:block!important}
}
@media(max-width:760px){
  .workZoneTabs{
    top:calc(var(--app-header-height,52px) + 4px)!important;
    z-index:95!important;
    margin:2px 0 10px!important;
    padding:6px!important;
    border-radius:12px!important;
  }
  .structurePreviewDesktop{display:none!important}
  .structurePreviewMobile{display:block!important}
  .mobileStructureMap{padding:8px;border-radius:12px}
  .mobileStructureGrid{gap:5px}
  .mobileStructureStand{min-height:44px}
  .mobileStructureStand b{font-size:22px}
}


/* V39 — mobilny admin bez ucinania + pasek możliwie wysoko */
.adminMobileOnly{display:none!important}.adminDesktopOnly{display:block}
.notificationBulkActions{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 10px}
.mobileAdminCard{background:#fff;border:1px solid #cbd8ce;border-radius:12px;padding:9px;margin:7px 0;box-shadow:0 1px 3px #0000000b;min-width:0;overflow:hidden}
.mobileAdminCardHead{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:7px;align-items:center}.mobileAdminCardHead>b{overflow-wrap:anywhere;font-size:13px}.mobileLp,.mobileRank{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:30px;padding:0 6px;border-radius:9px;background:#e7efe8;color:#123827;font-weight:1000}.mobileAdminMeta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}.mobileAdminMeta>span,.mobileScoreGrid>span{border:1px solid #dde6df;border-radius:9px;padding:6px;background:#f9fbf8;min-width:0}.mobileAdminMeta small,.mobileScoreGrid small,.mobileAdminLine small{display:block;font-size:9px;text-transform:uppercase;color:#68766d;font-weight:900}.mobileAdminMeta b,.mobileScoreGrid b{font-size:13px}.mobileAdminLine{display:flex;justify-content:space-between;gap:8px;margin-top:6px;padding:6px 2px}.mobileAdminActions{margin-top:8px}.mobileAdminActions .inlineBtns{display:grid!important;grid-template-columns:1fr 1fr;gap:6px}.mobileAdminActions button,.mobileConfirmWrap button{width:100%!important;min-width:0!important}.mobileConfirmWrap{margin-top:7px}.mobileDrawPair,.mobileScoreGrid{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}.mobileDrawPair>div{border:1px solid #dbe5dd;border-radius:10px;padding:7px;text-align:center}.mobileDrawPair small{display:block;font-size:9px;font-weight:900;color:#68766d}.mobileDrawPair b{display:block;font-size:21px;line-height:1.1}.mobileDrawPair span{font-size:10px}.mobileWeightBlock{margin-top:8px;padding-top:7px;border-top:1px solid #e2e9e3}.mobileWeightBlock label{margin:0 0 5px;font-size:11px}.mobileWeightBlock input{width:100%;min-width:0!important}.mobileResultSum,.mobilePlace{font-size:12px;white-space:nowrap;color:#113c28}.mobileResultFooter{display:flex;justify-content:space-between;align-items:center;margin-top:7px;padding-top:7px;border-top:1px solid #e2e9e3}.mobileScoreGrid{grid-template-columns:repeat(4,minmax(0,1fr))}.mobileScoreGrid>span{text-align:center;padding:6px 3px}.mobileScoreGrid em{display:block;font-style:normal;font-size:8.5px;color:#b91c1c;font-weight:900}.mobileStatsList{display:grid;gap:6px}.mobileStatsCard{border:1px solid #cedbd1;border-radius:11px;padding:7px;background:#fff}.mobileStatsStand{display:block;margin-bottom:6px;font-size:14px}.mobileStatsCard>div{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:4px}.mobileStatsCard span{text-align:center;border:1px solid #e0e7e1;border-radius:8px;padding:5px 2px;background:#fafcfa}.mobileStatsCard small{display:block;font-size:8px;text-transform:uppercase;color:#6c786f}.mobileStatsCard b{font-size:11px;overflow-wrap:anywhere}
.workZoneTabs.fixedAdminNav{border-radius:0 0 10px 10px!important;box-shadow:0 5px 14px #00000022!important}.workZoneTabsSlot{margin-top:0!important}
@media(max-width:760px){
  .adminDesktopOnly{display:none!important}.adminMobileOnly{display:block!important}
  .notificationBulkActions{grid-template-columns:1fr 1fr;gap:6px}.notificationBulkActions button{font-size:11px;padding:9px 5px}
  .workZoneTabs.fixedAdminNav{padding:3px 4px!important;border-top:0!important}
  .workZoneTabs.fixedAdminNav button{min-height:40px!important;font-size:9.8px!important;padding:5px 2px!important}
  .resultEntryRounds{gap:10px}.resultRoundPanel>h3{margin:5px 0;padding:4px 0}
  #adminZone-entry .grid3,#adminZone-draw .grid3,#adminZone-pdf .grid3{grid-template-columns:1fr!important}
  #adminZone-entry .grid3 button,#adminZone-draw .grid3 button,#adminZone-pdf .grid3 button{width:100%}
  .sectorCards{grid-template-columns:1fr!important}.drawSectorGrid{grid-template-columns:1fr!important}
  .mobileAdminCard{width:100%;max-width:100%;box-sizing:border-box}.mobileAdminCard *{max-width:100%;box-sizing:border-box}
  .mobileScoreGrid{grid-template-columns:repeat(4,minmax(0,1fr))}.mobileScoreGrid b{font-size:11.5px}.mobileScoreGrid small{font-size:8px}
  #adminZone-entry .card,#adminZone-results .card,#adminZone-roster .card,#adminZone-draw .card,#adminZone-pdf .card{overflow:visible!important;max-width:100%}
  #adminZone-entry input,#adminZone-entry button,#adminZone-entry select,#adminZone-results button,#adminZone-roster input,#adminZone-roster button,#adminZone-draw input,#adminZone-draw select,#adminZone-draw button,#adminZone-pdf button{max-width:100%;min-width:0}
  #adminZone-results .tablewrap:not(.adminDesktopOnly),#adminZone-draw .tablewrap:not(.adminDesktopOnly){overflow-x:visible!important}
  #adminZone-results .tablewrap:not(.adminDesktopOnly) table,#adminZone-draw .tablewrap:not(.adminDesktopOnly) table{width:100%!important;min-width:0!important;table-layout:fixed}
  #adminZone-results .tablewrap:not(.adminDesktopOnly) th,#adminZone-results .tablewrap:not(.adminDesktopOnly) td,#adminZone-draw .tablewrap:not(.adminDesktopOnly) th,#adminZone-draw .tablewrap:not(.adminDesktopOnly) td{font-size:9.5px!important;padding:5px 2px!important;white-space:normal!important;overflow-wrap:anywhere}
  #adminZone-results .roundClassTable,#adminZone-results .generalTable{display:none!important}
}


/* V40 — mobilny admin: zwarty, pełne wykorzystanie ekranu */
.adminMobileOnly{display:none}
@media(max-width:760px){
  body{font-size:13px!important}
  main{padding:3px!important}
  .card{margin:4px 0!important;padding:6px!important;border-radius:9px!important}
  h2{font-size:15px!important;line-height:1.1!important;margin:0 0 5px!important}
  h3{font-size:13px!important;line-height:1.1!important;margin:6px 0 4px!important}
  .small{font-size:10.5px!important}
  label{font-size:9.5px!important;margin:4px 0 2px!important}
  input,select,textarea,button{font-size:11.5px!important;padding:6px 7px!important;border-radius:8px!important}
  textarea{min-height:48px!important}
  .grid,.grid3,.grid4,.twoCols,.ownbox,.adminbar{gap:4px!important}
  .inlineBtns{gap:3px!important}
  .inlineBtns button{min-height:28px!important;padding:4px 6px!important;font-size:10.5px!important}
  .adminDesktopOnly{display:none!important}
  .adminMobileOnly{display:block!important}

  /* pasek stref: możliwie wysoko i zwarty */
  .workZoneTabs{gap:3px!important;padding:3px!important;margin:0!important}
  .workZoneTabs.fixedAdminNav{z-index:1000!important;margin:0!important}
  .workZoneTabs button{min-height:34px!important;padding:4px 3px!important;font-size:9.2px!important;line-height:1.02!important;border-radius:7px!important}

  /* lista zawodników — gęste wiersze zamiast dużych kart */
  .rosterSectionTitle{margin-top:5px!important}
  .mobileRosterCompact{display:flex;flex-direction:column;gap:2px}
  .mobileRosterCompactRow{border:1px solid #d5dfd7;border-radius:7px;background:#fff;padding:4px 5px}
  .mobileRosterCompactHead{display:grid;grid-template-columns:22px minmax(0,1fr) auto;align-items:center;gap:4px}
  .mobileRosterCompactLp{display:flex;align-items:center;justify-content:center;width:22px;height:22px;background:#edf3ee;border-radius:6px;font-weight:1000;font-size:11px}
  .mobileRosterCompactHead>b{font-size:11.8px;line-height:1.05;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mobileRosterCompactStatus{font-size:8.8px;font-weight:900;color:#5a6860;white-space:nowrap}
  .mobileRosterCompactMeta{display:flex;justify-content:space-between;gap:5px;margin:2px 0 3px 26px;font-size:9px;color:#647068;white-space:nowrap;overflow:hidden}
  .mobileRosterCompactMeta span{overflow:hidden;text-overflow:ellipsis}
  .mobileRosterCompactActions{display:grid;grid-template-columns:1.05fr 1.5fr;gap:3px;margin-left:26px}
  .mobileRosterCompactActions>.confirmEntryBtn{grid-column:auto;min-width:0!important}
  .mobileRosterCompactActions>.inlineBtns{display:grid!important;grid-template-columns:1fr 1fr!important;gap:3px!important}
  .mobileRosterCompactActions button{width:100%!important;min-width:0!important;min-height:27px!important;padding:3px 3px!important;font-size:9.8px!important}

  /* wpisywanie wyników — maksymalnie zwarte karty */
  .mobileResultEntryList{display:flex;flex-direction:column;gap:3px!important}
  .mobileAdminCard,.mobileResultEntryCard{margin:0!important;padding:5px!important;border-radius:7px!important}
  .mobileAdminCardHead{gap:4px!important;margin-bottom:3px!important}
  .mobileAdminCardHead>b{font-size:11.5px!important}
  .mobileLp{width:22px!important;height:22px!important;font-size:10.5px!important}
  .mobileResultSum{font-size:10.5px!important}
  .mobileAdminMeta{grid-template-columns:1fr 1fr!important;gap:3px!important;margin:3px 0!important}
  .mobileAdminMeta span{padding:3px 5px!important;border-radius:6px!important}
  .mobileAdminMeta small{font-size:8px!important}
  .mobileWeightBlock{margin-top:3px!important}
  .mobileWeightBlock label{margin:2px 0!important}
  .weightItems{gap:2px!important;margin-bottom:2px!important}
  .weightTag{font-size:9px!important;padding:2px 4px!important}
  .weightInput{min-width:0!important;width:100%!important;min-height:30px!important;padding:5px 6px!important;font-size:11px!important}

  /* sektor/mapa, wyniki i PDF */
  .mobileStructureMap{padding:4px!important}
  .compactAdminSectors{gap:4px!important}
  .compactAdminSector{padding:4px!important;border-radius:7px!important}
  .mobileStructureGrid{gap:3px!important}
  .mobileStructureStand{min-height:30px!important;border-radius:6px!important}
  .mobileStructureStand b{font-size:16px!important}
  .drawSectorGrid{gap:4px!important}
  .drawSectorBox{padding:4px!important}
  .sharpTable th,.sharpTable td{padding:4px 3px!important;font-size:10.5px!important}
  .generalTable th,.generalTable td{padding:4px 3px!important;font-size:10.5px!important}
  .notificationTable td{padding:5px!important;font-size:10.5px!important}
  .leaveRequestActions{gap:3px!important}
  .leaveRequestActions button{min-height:29px!important;padding:4px!important;font-size:10px!important}

  /* mniej miejsca na przewijanie pomocnicze */
  .quickScroll{right:4px!important;bottom:44px!important;gap:4px!important}
  .quickScroll button{width:34px!important;padding:5px 0!important;font-size:11px!important}
}


/* V41 — pasek administratora naprawdę przy samej górze ekranu */
.workZoneTabs.fixedAdminNav{
  top:0!important;
  z-index:5000!important;
  border-radius:0 0 10px 10px!important;
}
header{z-index:100!important}
@media(max-width:760px){
  .workZoneTabs.fixedAdminNav{top:0!important}
}


/* V42 — mobilny panel wyników zawodnika */
.playerResultsMobile{display:none}
@media(max-width:760px){
  .playerView{overflow:visible!important}
  .playerResultsDesktop{display:none!important}
  .playerResultsMobile{display:block!important;overflow:visible!important}
  .playerResultsNavSlot{width:100%;min-height:40px;overflow:visible!important}
  .playerResultsNav{
    position:sticky!important;
    top:0!important;
    z-index:4200!important;
    display:grid!important;
    grid-template-columns:repeat(4,minmax(0,1fr))!important;
    gap:2px!important;
    width:100%!important;
    padding:3px!important;
    margin:4px 0 5px!important;
    background:rgba(243,246,239,.995)!important;
    border:1px solid #c9d6cc!important;
    border-radius:8px!important;
    box-shadow:0 4px 12px #00000020!important;
  }
  .playerResultsNav button{
    min-width:0!important;
    min-height:34px!important;
    padding:4px 2px!important;
    border-radius:6px!important;
    font-size:9px!important;
    line-height:1.02!important;
    background:#e2ebe4!important;
    color:#173d2e!important;
    border:1px solid #b9cabd!important;
  }
  .playerResultsNav button.active{
    background:#0b5634!important;
    color:#fff!important;
    border-color:#0b5634!important;
  }
  .playerResultsSection{min-width:0!important}
  .playerResultsSection>.card,.playerResultsSection .playerResultCard{margin:4px 0!important;padding:5px!important}
  .playerResultsSection h2{font-size:14px!important;margin:2px 0 5px!important}
  .playerResultsSection h3{font-size:12px!important;margin:5px 0 3px!important}
  .playerWholeRoundTitle{margin-top:8px!important;padding-top:5px!important;border-top:1px solid #dce5de!important}

  /* Wyniki sektorowe pozostają w dotychczasowym układzie, tylko mieszczą się w ekranie. */
  .playerResultsSection .drawSectorBox,
  .playerResultsSection .card{max-width:100%!important}
  .playerResultsSection .tablewrap{max-width:100%!important}
  .playerResultsSection .twoCols{grid-template-columns:1fr!important}

  /* Całe T1/T2 — gęsta tabela bez przewijania poziomego. */
  .playerNoScroll{width:100%!important;max-width:100%!important;overflow:hidden!important;border:1px solid #cbd8ce;border-radius:7px}
  .playerCompactRoundTable{width:100%!important;min-width:0!important;table-layout:fixed!important}
  .playerCompactRoundTable th,.playerCompactRoundTable td{padding:4px 2px!important;font-size:9.8px!important;line-height:1.08!important;overflow:hidden!important}
  .playerCompactRoundTable th{font-size:8.3px!important}
  .playerCompactRoundTable .pcLp{width:25px!important}
  .playerCompactRoundTable .pcPos{width:48px!important}
  .playerCompactRoundTable .pcPlace{width:31px!important}
  .playerCompactRoundTable .pcWeight{width:70px!important;white-space:nowrap!important}
  .playerCompactRoundTable .pcName{font-size:10.5px!important;overflow-wrap:anywhere!important}
  .playerCompactRoundTable .pcPos span{font-weight:700}
  .pcBf{display:block!important;font-size:7.8px!important;line-height:1.05!important;color:#b91c1c!important;font-weight:900!important;white-space:nowrap!important;margin-top:1px!important}

  /* Klasyfikacja końcowa: MSC | Zawodnik | T1 | T2 | Punkty | Waga */
  .playerCompactFinalTable{width:100%!important;min-width:0!important;table-layout:fixed!important}
  .playerCompactFinalTable th,.playerCompactFinalTable td{padding:4px 2px!important;font-size:9.4px!important;line-height:1.08!important;overflow:hidden!important}
  .playerCompactFinalTable th{font-size:7.7px!important}
  .playerCompactFinalTable .pfRank{width:27px!important}
  .playerCompactFinalTable .pfRound{width:27px!important}
  .playerCompactFinalTable .pfPoints{width:42px!important}
  .playerCompactFinalTable .pfWeight{width:72px!important;white-space:nowrap!important}
  .playerCompactFinalTable .pfName{width:auto!important;font-size:10px!important;overflow-wrap:anywhere!important}
  .playerCompactFinalTable td.pfRound b,.playerCompactFinalTable td.pfPoints b{font-size:10.5px!important}
  .playerCompactFinalTable td.pfRank b{font-size:11px!important}

  /* Statystyki w jednej zwartej tabeli. */
  .playerCompactStats{width:100%!important;min-width:0!important;table-layout:fixed!important}
  .playerCompactStats th,.playerCompactStats td{padding:4px 3px!important;font-size:9.5px!important}
  .playerCompactStats th{font-size:8px!important}
  .playerCompactStats th:nth-child(1),.playerCompactStats td:nth-child(1){width:45px!important}
  .playerCompactStats th:nth-child(2),.playerCompactStats td:nth-child(2){width:72px!important}
  .playerCompactStats th:nth-child(3),.playerCompactStats td:nth-child(3){width:48px!important}
  .playerStatsCompact .stationStandBest,.playerStatsCompact .stationStandWorst{font-size:11px!important}

  /* W mobilnym panelu wyników nie wymuszamy szerokości desktopowych tabel. */
  .playerResultsMobile table{max-width:100%!important}
}
@media(min-width:761px){
  .playerResultsDesktop{display:block!important}
  .playerResultsMobile{display:none!important}
}


/* V43 — kompaktowe zobrazowanie losowania dla zawodnika na telefonie */
@media(max-width:760px){
  .playerRoundDrawSection{padding:5px!important;margin:4px 0!important;overflow:visible!important}
  .playerRoundDrawSection>h2{font-size:14px!important;margin:2px 0 4px!important}
  .playerDrawHeaderCard{
    position:sticky!important;
    top:0!important;
    z-index:4100!important;
    padding:4px!important;
    margin:0 0 4px!important;
    border-radius:0 0 8px 8px!important;
    background:rgba(243,246,239,.995)!important;
    box-shadow:0 4px 10px #0000001e!important;
  }
  .playerDrawTabs{display:grid!important;grid-template-columns:1fr 1fr!important;gap:3px!important}
  .playerDrawTabs button{min-height:32px!important;padding:4px!important;font-size:10.5px!important;border-radius:6px!important}
  .playerOwnTitle{display:none!important}
  .playerOwnGrid{grid-template-columns:1fr 1fr!important;gap:3px!important;margin-top:3px!important}
  .playerOwnItem{padding:3px 5px!important;border-radius:6px!important;min-height:0!important}
  .playerOwnItem .tag{font-size:8px!important;padding:1px 4px!important}
  .playerOwnItem strong{font-size:18px!important;display:inline!important;margin:0 4px!important}
  .playerOwnItem>span:last-child{font-size:9px!important}

  .compactPlayerDrawMap{width:100%!important;max-width:100%!important}
  .compactPlayerDrawMap .mobileMapMeta{margin:0 0 4px!important;padding:5px 6px!important;border-radius:7px!important}
  .compactPlayerDrawMap .mobileMapMeta b{font-size:11.5px!important}
  .compactPlayerDrawMap .mobileMapMeta span{font-size:9px!important}
  .compactPlayerDrawMap .mobileSectorStack{gap:4px!important}
  .compactPlayerSector{border-radius:7px!important}
  .compactPlayerSector .mobileSectorHeader{padding:3px 5px!important;min-height:24px!important}
  .compactPlayerSector .mobileSectorHeader span{font-size:10.5px!important;line-height:1!important}
  .compactPlayerSector .mobileSectorHeader span b{font-size:15px!important}
  .compactPlayerSector .mobileBankBlock{padding:3px 4px!important}
  .compactPlayerSector .mobileBankBlock+.mobileBankBlock{border-top:1px dashed #b7c5ba!important}
  .compactPlayerSector .mobileBankName{margin:0 0 2px!important;font-size:7.8px!important;line-height:1!important}
  .compactPlayerSector .mobileStandGrid{
    grid-template-columns:repeat(3,minmax(0,1fr))!important;
    gap:2px!important;
    padding:0!important;
  }
  .compactPlayerSector .mobileStandCard{min-height:34px!important;padding:0!important}
  .compactPlayerSector .mobileStandCardInner{
    min-height:34px!important;
    grid-template-columns:27px minmax(0,1fr)!important;
    border-radius:5px!important;
    border-width:1px!important;
  }
  .compactPlayerSector .mobileStandNo{
    font-size:16px!important;
    border-right:1px solid #a4b4a8!important;
  }
  .compactPlayerSector .mobileStandInfo{
    padding:2px 3px!important;
    font-size:8.8px!important;
    line-height:1.02!important;
    overflow:hidden!important;
  }
  .compactPlayerSector .mobileStandInfo b{
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }
  .compactPlayerSector .mobileMineBadge{
    margin-top:1px!important;
    padding:1px 3px!important;
    font-size:6.5px!important;
  }
  .compactPlayerSector .ownMobileStand .mobileStandCardInner{
    border:2px solid #e6ae00!important;
    background:#fff4a8!important;
  }
}
@media(max-width:360px){
  .compactPlayerSector .mobileStandGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .compactPlayerSector .mobileStandCardInner{grid-template-columns:29px minmax(0,1fr)!important}
  .compactPlayerSector .mobileStandInfo{font-size:9px!important}
}


/* V44 — dwa niezależne paski mobilnego zawodnika:
   1) Losowanie T1/T2 + moje stanowiska
   2) Wyniki T1/T2/Klasyfikacja/Statystyki */
.playerDrawStickySlot,.playerResultsNavSlot{overflow:visible!important;position:relative!important;width:100%!important}
@media(max-width:760px){
  .playerView{overflow:visible!important}
  .playerDrawHeaderCard,.playerResultsNav{
    position:relative!important;
    top:auto!important;
  }
  .playerDrawHeaderCard.fixedPlayerBar,
  .playerResultsNav.fixedPlayerBar{
    position:fixed!important;
    top:0!important;
    z-index:5200!important;
    margin:0!important;
    border-radius:0 0 8px 8px!important;
    box-shadow:0 5px 14px #00000028!important;
    background:rgba(243,246,239,.998)!important;
  }
  .playerDrawHeaderCard.fixedPlayerBar{
    padding:4px!important;
  }
  .playerResultsNav.fixedPlayerBar{
    padding:3px!important;
  }
}


/* V45 — mobilny zawodnik: wspólny górny pasek + czytelniejsze losowanie */
@media(max-width:760px){
  .playerView{overflow:visible!important}
  .playerDrawStickySlot{overflow:visible!important;position:relative!important;width:100%!important}
  .playerDrawHeaderCard{position:relative!important;top:auto!important;margin:0 0 6px!important;padding:4px!important;border-radius:0 0 8px 8px!important;background:rgba(243,246,239,.998)!important;box-shadow:0 4px 10px #0000001e!important}
  .playerDrawHeaderCard.fixedPlayerBar{position:fixed!important;top:0!important;left:0;z-index:5300!important;margin:0!important;box-shadow:0 6px 16px #00000026!important}
  .playerDrawTabs{display:grid!important;grid-template-columns:1fr 1fr!important;gap:3px!important;margin-bottom:3px!important}
  .playerDrawTabs button{min-height:35px!important;padding:4px 4px!important;font-size:10.5px!important;line-height:1.05!important;border-radius:7px!important}
  .playerResultsNavInline{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:2px!important;margin:0 0 3px!important;padding-top:3px!important;border-top:1px solid #d4dfd7!important}
  .playerResultsNavInline button{min-width:0!important;min-height:31px!important;padding:4px 1px!important;font-size:8.7px!important;line-height:1.02!important;border-radius:6px!important;background:#e2ebe4!important;color:#173d2e!important;border:1px solid #b9cabd!important}
  .playerResultsNavInline button.active{background:#0b5634!important;color:#fff!important;border-color:#0b5634!important}
  .playerOwnTitle{display:none!important}
  .playerOwnGridWrap{margin-top:0!important}
  .playerOwnGrid{grid-template-columns:1fr 1fr!important;gap:3px!important;margin-top:0!important}
  .playerOwnItem{min-height:0!important;padding:4px 5px!important;border-radius:7px!important}
  .playerOwnItem .tag{font-size:8px!important;padding:1px 4px!important}
  .playerOwnItem strong{display:inline!important;font-size:19px!important;line-height:1!important;margin:0 4px 0 2px!important}
  .playerOwnItem>span:last-child{font-size:9px!important;font-weight:900!important}

  .playerResultsMobile{display:block!important;overflow:visible!important}
  .playerResultsDesktop{display:none!important}
  .playerRoundDrawSection{padding:5px!important;margin:4px 0!important;overflow:visible!important}
  .playerRoundDrawSection>h2{display:none!important}

  .compactPlayerDrawMap{width:100%!important;max-width:100%!important}
  .compactPlayerDrawMap .mobileMapMeta{display:flex!important;justify-content:space-between!important;align-items:center!important;gap:6px!important;margin:0 0 5px!important;padding:6px 8px!important;border-radius:8px!important;background:#eef4ef!important}
  .compactPlayerDrawMap .mobileMapMeta b{font-size:12px!important;line-height:1.1!important;color:#133b2a!important}
  .compactPlayerDrawMap .mobileMapMeta span{font-size:9.5px!important;font-weight:900!important;color:#476554!important}
  .compactPlayerDrawMap .mobileSectorStack{gap:5px!important}
  .compactPlayerSector{border-radius:9px!important;border:1px solid #b7c6bb!important;overflow:hidden!important;box-shadow:none!important}
  .compactPlayerSector .mobileSectorHeader{padding:4px 7px!important;min-height:28px!important;background:#ffffffc4!important;border-bottom:1px solid #bfd0c3!important}
  .compactPlayerSector .mobileSectorHeader span{font-size:12.5px!important;line-height:1!important;font-weight:1000!important;color:#183b2d!important}
  .compactPlayerSector .mobileSectorHeader span b{font-size:19px!important;margin-right:2px!important}
  .compactPlayerSector .mobileBankBlock{padding:4px 5px!important}
  .compactPlayerSector .mobileBankBlock+.mobileBankBlock{border-top:1px dashed #b7c5ba!important}
  .compactPlayerSector .mobileBankName{margin:0 0 3px!important;font-size:9px!important;font-weight:1000!important;letter-spacing:.04em!important;color:#355846!important;text-align:center!important}
  .compactPlayerSector .mobileStandGrid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:4px!important;padding:0!important}
  .compactPlayerSector .mobileStandCard{min-height:0!important;padding:0!important;background:transparent!important}
  .compactPlayerSector .mobileStandCardInner{display:grid!important;grid-template-columns:34px minmax(0,1fr)!important;align-items:center!important;min-height:42px!important;border:1px solid #95a99a!important;border-radius:8px!important;background:#ffffffd7!important;overflow:hidden!important}
  .compactPlayerSector .mobileStandNo{display:flex!important;align-items:center!important;justify-content:center!important;height:100%!important;font-size:22px!important;line-height:1!important;font-weight:1000!important;border-right:1px solid #a6b6ab!important;color:#103b2a!important;background:#ffffff90!important}
  .compactPlayerSector .mobileStandInfo{min-width:0!important;padding:4px 5px!important;font-size:11px!important;line-height:1.05!important;color:#183125!important;overflow:hidden!important}
  .compactPlayerSector .mobileStandInfo b{display:block!important;font-size:11.5px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .compactPlayerSector .mobileMineBadge{display:inline-block!important;margin-top:2px!important;padding:1px 4px!important;border-radius:999px!important;background:#f6b900!important;color:#3e2b00!important;font-size:7px!important;font-weight:1000!important;letter-spacing:.02em!important}
  .compactPlayerSector .ownMobileStand .mobileStandCardInner{border:2px solid #e6ae00!important;background:#fff8c6!important;box-shadow:0 0 0 1px #fff inset!important}

  .playerResultsSection>.card,.playerResultsSection .playerResultCard{margin:4px 0!important;padding:5px!important}
  .playerResultsSection h2{font-size:14px!important;margin:2px 0 5px!important}
}
@media(max-width:390px){
  .compactPlayerSector .mobileStandGrid{grid-template-columns:repeat(2,minmax(0,1fr))!important}
  .compactPlayerSector .mobileStandCardInner{grid-template-columns:36px minmax(0,1fr)!important;min-height:44px!important}
  .compactPlayerSector .mobileStandNo{font-size:23px!important}
  .compactPlayerSector .mobileStandInfo b{font-size:12px!important}
}


/* V47 — mobilne Szczegóły zawodnika: najpierw kafelki, treść dopiero po wyborze */
.playerMobileDashboard{display:none}
@media(max-width:760px){
  .playerDetailHead{display:none!important}
  .playerDesktopDashboard{display:none!important}
  .playerMobileDashboard{display:block!important;width:100%!important;overflow:visible!important}
  .playerDrawStickySlot{position:relative!important;width:100%!important;overflow:visible!important}
  .playerUnifiedNav{position:relative!important;top:auto!important;margin:0 0 5px!important;padding:4px!important;border-radius:0 0 9px 9px!important;background:rgba(243,246,239,.998)!important;box-shadow:0 4px 10px #0000001d!important}
  .playerUnifiedNav.fixedPlayerBar{position:fixed!important;top:0!important;z-index:5400!important;margin:0!important;border-radius:0 0 9px 9px!important;box-shadow:0 6px 16px #00000028!important}
  .playerUnifiedNav .playerDrawTabs{display:grid!important;grid-template-columns:1fr 1fr!important;gap:3px!important;margin:0 0 3px!important}
  .playerUnifiedNav .playerDrawTabs button{min-height:39px!important;padding:5px 3px!important;font-size:11px!important;line-height:1.05!important;border-radius:7px!important}
  .playerUnifiedNav .playerResultsNavInline{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:2px!important;margin:0!important;padding:0!important;border:0!important}
  .playerUnifiedNav .playerResultsNavInline button{min-width:0!important;min-height:34px!important;padding:4px 1px!important;font-size:8.8px!important;line-height:1.02!important;border-radius:6px!important;background:#e2ebe4!important;color:#173d2e!important;border:1px solid #b9cabd!important}
  .playerUnifiedNav button.active{background:#0b5634!important;color:#fff!important;border-color:#0b5634!important}
  #playerMobilePanelContent{width:100%!important;min-height:0!important}
  .playerMobileSelectedPanel{width:100%!important;margin:0!important}
  .playerSelectedOwn{display:flex!important;align-items:center!important;justify-content:center!important;gap:6px!important;margin:4px 0!important;padding:5px 7px!important;border:1px solid #c8d6cc!important;border-radius:8px!important;background:#fff!important}
  .playerSelectedOwn .tag{font-size:8px!important;padding:1px 5px!important}
  .playerSelectedOwn strong{font-size:25px!important;line-height:1!important;color:#103b2a!important}
  .playerSelectedOwn b{font-size:11px!important;color:#294d3d!important}

  .compactPlayerDrawMap{width:100%!important;max-width:100%!important}
  .compactPlayerDrawMap .mobileMapMeta{margin:0 0 5px!important;padding:6px 8px!important;border-radius:8px!important;background:#edf4ee!important}
  .compactPlayerDrawMap .mobileMapMeta b{font-size:12.5px!important;color:#153d2c!important}
  .compactPlayerDrawMap .mobileMapMeta span{font-size:9.5px!important;font-weight:900!important}
  .compactPlayerDrawMap .mobileSectorStack{gap:6px!important}
  .compactPlayerSector{border:1px solid #b6c6ba!important;border-radius:9px!important;overflow:hidden!important;box-shadow:none!important}
  .compactPlayerSector .mobileSectorHeader{display:flex!important;align-items:center!important;justify-content:space-between!important;padding:5px 8px!important;min-height:31px!important;background:#ffffffc9!important;border-bottom:1px solid #becdc2!important}
  .compactPlayerSector .mobileSectorHeader span{font-size:11px!important;font-weight:900!important;color:#224937!important}
  .compactPlayerSector .mobileSectorHeader span b{font-size:21px!important;line-height:1!important;margin-left:2px!important}
  .compactPlayerSector .mobileSectorHeader small{font-size:10px!important;font-weight:900!important;color:#355846!important}
  .compactPlayerSector .mobileBankBlock{padding:5px 6px!important}
  .compactPlayerSector .mobileBankBlock+.mobileBankBlock{border-top:1px dashed #b1c1b5!important}
  .compactPlayerSector .mobileBankName{text-align:center!important;margin:0 0 4px!important;font-size:9px!important;font-weight:1000!important;letter-spacing:.035em!important;color:#355846!important}
  .compactPlayerSector .mobileStandGrid{display:grid!important;gap:5px!important;padding:0!important}
  .compactPlayerSector .mobileStandCard{min-width:0!important;min-height:0!important;padding:0!important;background:transparent!important}
  .compactPlayerSector .mobileStandCardInner{display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;min-height:58px!important;padding:3px!important;border:1px solid #94a99b!important;border-radius:8px!important;background:#ffffffe6!important;overflow:hidden!important}
  .compactPlayerSector .mobileStandNo{display:block!important;width:auto!important;height:auto!important;border:0!important;background:transparent!important;font-size:25px!important;line-height:1!important;font-weight:1000!important;color:#103b2a!important;padding:0!important}
  .compactPlayerSector .mobileStandInfo{width:100%!important;min-width:0!important;padding:2px 2px 0!important;text-align:center!important;font-size:10px!important;line-height:1.05!important;color:#1c3328!important}
  .compactPlayerSector .mobileStandInfo b{display:block!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;font-size:10.5px!important;font-weight:900!important}
  .compactPlayerSector .mobileMineBadge{display:inline-block!important;margin-top:2px!important;padding:1px 4px!important;border-radius:999px!important;background:#f6b900!important;color:#3e2b00!important;font-size:6.8px!important;font-weight:1000!important}
  .compactPlayerSector .ownMobileStand .mobileStandCardInner{border:3px solid #e5ad00!important;background:#fff8c5!important;box-shadow:0 0 0 1px #fff inset!important}

  .playerMobileSelectedPanel .playerResultCard{margin:4px 0!important;padding:5px!important}
  .playerMobileSelectedPanel h2{font-size:14px!important;margin:2px 0 5px!important}
}



/* V48 — mobilny zawodnik: sticky kafelki, czytelniejsze losowanie i tabelki sektorowe pod mapą */
@media(max-width:760px){
  .playerMobileDashboard .playerDrawStickySlot{position:relative!important;overflow:visible!important}
  .playerMobileDashboard .playerUnifiedNav{position:relative!important;z-index:20!important}
  .playerMobileDashboard .playerUnifiedNav.fixedPlayerBar{position:fixed!important;top:0!important;left:0!important;z-index:5400!important}
  .playerMobileDashboard .playerMobileSelectedPanel{padding-top:0!important}
  .playerMobileDashboard .compactPlayerDrawMap{margin-top:2px!important}
  .playerMobileDashboard .mobileSectorStack{gap:7px!important}
  .playerMobileDashboard .compactPlayerSector{border:1px solid #b5c7ba!important;border-radius:11px!important;overflow:hidden!important;background:#fff!important}
  .playerMobileDashboard .compactPlayerSector .mobileSectorHeader{padding:6px 9px!important;min-height:34px!important;background:#ffffffd9!important;border-bottom:1px solid #c2d2c6!important}
  .playerMobileDashboard .compactPlayerSector .mobileSectorHeader span{font-size:15px!important;font-weight:1000!important;color:#183b2d!important}
  .playerMobileDashboard .compactPlayerSector .mobileSectorHeader span b{font-size:25px!important}
  .playerMobileDashboard .compactPlayerSector .mobileSectorHeader small{font-size:11px!important;font-weight:900!important}
  .playerMobileDashboard .compactPlayerSector .mobileBankBlock{padding:6px!important}
  .playerMobileDashboard .compactPlayerSector .mobileBankName{font-size:10px!important;margin:0 0 5px!important;letter-spacing:.04em!important;color:#335646!important;font-weight:1000!important}
  .playerMobileDashboard .compactPlayerSector .mobileStandGridReadable{display:grid!important;gap:6px!important}
  .playerMobileDashboard .compactPlayerSector .mobileStandCardInner{display:grid!important;grid-template-columns:38px minmax(0,1fr)!important;align-items:center!important;min-height:48px!important;padding:0!important;border:1px solid #97ac9d!important;border-radius:10px!important;background:#ffffffe6!important;overflow:hidden!important}
  .playerMobileDashboard .compactPlayerSector .mobileStandNo{display:flex!important;align-items:center!important;justify-content:center!important;height:100%!important;font-size:23px!important;line-height:1!important;font-weight:1000!important;border-right:1px solid #a7b8ad!important;background:#ffffffb5!important;padding:0!important}
  .playerMobileDashboard .compactPlayerSector .mobileStandInfo{padding:5px 5px 4px!important;text-align:left!important;font-size:10px!important;line-height:1.08!important;color:#173126!important}
  .playerMobileDashboard .compactPlayerSector .mobileStandInfo b{display:block!important;font-size:11.5px!important;font-weight:1000!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .playerMobileDashboard .compactPlayerSector .mobileMineBadge{display:inline-block!important;margin-top:2px!important;padding:1px 4px!important;font-size:7px!important;font-weight:1000!important;border-radius:999px!important;background:#f4b500!important;color:#4a3200!important}
  .playerMobileDashboard .compactPlayerSector .ownMobileStand .mobileStandCardInner{border:2px solid #e0aa00!important;background:#fff7c3!important;box-shadow:0 0 0 1px #fff inset!important}
  .playerMobileDashboard .playerMobileSectorTables{margin-top:8px!important}
  .playerMobileDashboard .playerMobileSectorTables .drawSectorGrid{display:grid!important;grid-template-columns:1fr!important;gap:7px!important;margin-top:8px!important}
  .playerMobileDashboard .playerMobileSectorTables .drawSectorBox{padding:7px!important;margin:0!important;border-radius:10px!important}
  .playerMobileDashboard .playerMobileSectorTables .drawSectorBox h4{font-size:15px!important;margin:1px 0 6px!important}
  .playerMobileDashboard .playerMobileSectorTables .sharpTable{table-layout:fixed!important;width:100%!important;min-width:0!important}
  .playerMobileDashboard .playerMobileSectorTables .sharpTable th,.playerMobileDashboard .playerMobileSectorTables .sharpTable td{font-size:11.5px!important;padding:6px 4px!important;line-height:1.15!important}
  .playerMobileDashboard .playerMobileSectorTables .sharpTable th:nth-child(1),.playerMobileDashboard .playerMobileSectorTables .sharpTable td:nth-child(1){width:34px!important}
  .playerMobileDashboard .playerMobileSectorTables .sharpTable th:nth-child(2),.playerMobileDashboard .playerMobileSectorTables .sharpTable td:nth-child(2){width:44px!important}
}
.roundDrawCell{padding:6px 4px!important}
.roundDrawName{font-size:14px!important;font-weight:1000!important;letter-spacing:.01em!important;text-rendering:geometricPrecision!important;-webkit-font-smoothing:antialiased!important}
.roundStandNo{font-size:24px!important}



/* V49 — mobilne losowanie zawodnika: czytelne sektory + pełna mapa łowiska */
@media(max-width:760px){
  .playerMobileDashboard .playerUnifiedNav{position:relative!important;top:0!important;z-index:40!important}
  .playerMobileDashboard .playerUnifiedNav.fixedPlayerBar{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:5400!important}
  .playerDrawModeTabs{display:grid!important;grid-template-columns:1fr 1fr!important;gap:6px!important;margin:6px 0 8px!important}
  .playerDrawModeTabs button{min-height:36px!important;padding:6px 5px!important;border-radius:8px!important;border:1px solid #b8c9bd!important;background:#eef4ef!important;color:#173d2e!important;font-size:10.5px!important;font-weight:900!important;line-height:1.05!important}
  .playerDrawModeTabs button.active{background:#0b5634!important;color:#fff!important;border-color:#0b5634!important}
  .playerMobileFullMapWrap{margin:6px 0 8px!important;border:1px solid #c8d5cc!important;border-radius:10px!important;background:#fff!important;overflow:hidden!important}
  .playerMobileFullMapScroll{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;padding:8px!important}
  .playerMobileFullMapScroll .sectorMap{min-width:760px!important;margin:0!important}
  .playerMobileFullMapScroll .roundMapHeading{font-size:20px!important;margin-bottom:4px!important}
  .playerMobileFullMapScroll .roundStandNo{font-size:24px!important}
  .playerMobileFullMapScroll .roundDrawName{font-size:14px!important;font-weight:1000!important;line-height:1.05!important;writing-mode:vertical-rl!important;transform:rotate(180deg)!important}
  .compactPlayerDrawMap{width:100%!important;max-width:100%!important}
  .compactPlayerDrawMap .mobileMapMeta{display:flex!important;justify-content:space-between!important;align-items:center!important;gap:6px!important;margin:0 0 6px!important;padding:7px 9px!important;border-radius:9px!important;background:#edf4ee!important}
  .compactPlayerDrawMap .mobileMapMeta b{font-size:12px!important;color:#143a2b!important;line-height:1.1!important}
  .compactPlayerDrawMap .mobileMapMeta span{font-size:10px!important;font-weight:900!important;color:#466455!important}
  .compactPlayerDrawMap .mobileSectorStack{display:grid!important;grid-template-columns:1fr!important;gap:8px!important}
  .compactPlayerSector{border:1px solid #b7c6bb!important;border-radius:12px!important;overflow:hidden!important;background:#fff!important;box-shadow:0 1px 2px #00000010!important}
  .compactPlayerSector .mobileSectorHeader{display:flex!important;justify-content:space-between!important;align-items:center!important;padding:7px 10px!important;background:#ffffffd9!important;border-bottom:1px solid #c2d2c6!important}
  .compactPlayerSector .mobileSectorHeader span{font-size:16px!important;font-weight:1000!important;color:#173b2c!important}
  .compactPlayerSector .mobileSectorHeader span b{font-size:26px!important;line-height:1!important;margin-left:2px!important}
  .compactPlayerSector .mobileSectorHeader small{font-size:11px!important;font-weight:900!important;color:#355947!important}
  .compactPlayerSector .mobileBankBlock{padding:8px!important}
  .compactPlayerSector .mobileBankBlock+.mobileBankBlock{border-top:1px dashed #b9c8bd!important}
  .compactPlayerSector .mobileBankName{text-align:center!important;font-size:10px!important;font-weight:1000!important;letter-spacing:.06em!important;color:#355947!important;margin:0 0 6px!important}
  .compactPlayerSector .mobileStandGridReadable{display:grid!important;gap:6px!important}
  .compactPlayerSector .mobileStandCard{min-width:0!important}
  .compactPlayerSector .mobileStandCardInner{display:grid!important;grid-template-columns:40px minmax(0,1fr)!important;align-items:center!important;min-height:50px!important;border:1px solid #98ac9f!important;border-radius:10px!important;background:#ffffffeb!important;overflow:hidden!important}
  .compactPlayerSector .mobileStandNo{display:flex!important;align-items:center!important;justify-content:center!important;height:100%!important;font-size:24px!important;font-weight:1000!important;color:#103b2a!important;background:#ffffffb8!important;border-right:1px solid #a7b8ad!important}
  .compactPlayerSector .mobileStandInfo{padding:5px 6px!important;text-align:left!important;color:#183226!important}
  .compactPlayerSector .mobileStandInfo b{display:block!important;font-size:12px!important;line-height:1.08!important;font-weight:1000!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .compactPlayerSector .mobileMineBadge{display:inline-block!important;margin-top:3px!important;padding:1px 5px!important;border-radius:999px!important;background:#f3b500!important;color:#4a3200!important;font-size:7px!important;font-weight:1000!important}
  .compactPlayerSector .ownMobileStand .mobileStandCardInner{border:2px solid #e0aa00!important;background:#fff6c2!important}
  .playerMobileSectorTables{margin-top:8px!important}
  .playerMobileSectorTables .drawSectorGrid{display:grid!important;grid-template-columns:1fr!important;gap:8px!important}
  .playerMobileSectorTables .drawSectorBox{padding:8px!important;border-radius:10px!important}
}
.roundDrawName{font-size:15px!important;font-weight:1000!important;letter-spacing:.01em!important;text-rendering:geometricPrecision!important;-webkit-font-smoothing:antialiased!important}
.roundStandNo{font-size:25px!important}



/* V50 — mobilny zawodnik: układ zgodny z zaakceptowaną makietą */
@media(max-width:760px){
  .playerMobileDashboard{width:100%!important;overflow:visible!important}
  .playerUnifiedNav{padding:4px!important;background:rgba(243,246,239,.998)!important}
  .playerUnifiedNav.fixedPlayerBar{position:fixed!important;top:0!important;left:0!important;right:0!important;z-index:5500!important}
  .playerUnifiedNav .playerDrawTabs{display:grid!important;grid-template-columns:1fr 1fr!important;gap:3px!important;margin:0 0 3px!important}
  .playerUnifiedNav .playerDrawTabs button{min-height:42px!important;font-size:11px!important;font-weight:1000!important}
  .playerUnifiedNav .playerResultsNavInline{display:grid!important;grid-template-columns:repeat(4,minmax(0,1fr))!important;gap:3px!important;margin:0 0 3px!important}
  .playerUnifiedNav .playerResultsNavInline button{min-height:37px!important;font-size:8.8px!important;font-weight:1000!important}
  .playerMapNav{display:grid!important;grid-template-columns:1fr 1fr!important;gap:4px!important}
  .playerMapNav button{min-height:34px!important;padding:5px 3px!important;font-size:9.5px!important;font-weight:1000!important;border-radius:7px!important;background:#164b75!important;color:#fff!important;border:1px solid #2c6a99!important}
  .playerMapNav button.active{background:#0b5634!important;border-color:#0b5634!important}

  .playerOwnSummaryWrap{margin:6px 0 7px!important}
  .playerOwnSummaryHeading{font-size:11px!important;font-weight:1000!important;color:#315544!important;margin:0 2px 4px!important}
  .playerOwnSummaryGrid{display:grid!important;grid-template-columns:1fr 1fr!important;gap:5px!important}
  .playerOwnSummaryCard{border:1px solid #c3d1c7!important;border-radius:10px!important;padding:6px!important;background:#fff!important;overflow:hidden!important}
  .playerOwnSummaryCard.round1{background:#eefbf0!important}.playerOwnSummaryCard.round2{background:#eef6ff!important}
  .playerOwnSummaryTitle{font-size:10px!important;font-weight:1000!important;color:#1f4c38!important;margin-bottom:3px!important}
  .playerOwnSummaryMain{display:grid!important;grid-template-columns:40px 48px minmax(0,1fr)!important;gap:4px!important;align-items:end!important}
  .playerOwnSummaryRound{font-size:18px!important;font-weight:1000!important}.playerOwnSummaryStand{font-size:28px!important;line-height:1!important;font-weight:1000!important;color:#102f23!important}.playerOwnSummarySector{font-size:13px!important;font-weight:1000!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
  .playerOwnSummaryLabels{display:grid!important;grid-template-columns:40px 48px minmax(0,1fr)!important;gap:4px!important;margin-top:1px!important;color:#5b6d63!important;font-size:7.5px!important;font-weight:800!important}

  .playerMobileSectionTitle{font-size:11px!important;font-weight:1000!important;color:#315544!important;margin:7px 3px 6px!important}
  .playerSectorAccordionList{display:flex!important;flex-direction:column!important;gap:6px!important}
  .playerSectorAccordion{border:1px solid #a9bcb0!important;border-radius:10px!important;overflow:hidden!important;background:#fff!important}
  .playerSectorAccordionHead{display:grid!important;grid-template-columns:34px minmax(0,1fr) auto 24px!important;gap:6px!important;align-items:center!important;width:100%!important;min-height:42px!important;padding:5px 8px!important;border-radius:0!important;text-align:left!important;color:#fff!important}
  .playerSectorAccordionHead b{font-size:14px!important;line-height:1!important}.playerSectorCount{font-size:10px!important;font-weight:1000!important}.playerSectorChevron{font-size:19px!important;line-height:1!important;text-align:center!important;transition:transform .15s ease!important}
  .playerSectorCircle{display:flex!important;align-items:center!important;justify-content:center!important;width:30px!important;height:30px!important;border-radius:999px!important;background:#ffffffd8!important;color:#173d2e!important;font-size:18px!important;font-weight:1000!important}
  .playerSectorAccordion.sectorFill-A .playerSectorAccordionHead{background:#0c7b42!important}
  .playerSectorAccordion.sectorFill-B .playerSectorAccordionHead{background:#cc3131!important}
  .playerSectorAccordion.sectorFill-C .playerSectorAccordionHead{background:#d98b13!important}
  .playerSectorAccordion.sectorFill-D .playerSectorAccordionHead{background:#176cc2!important}
  .playerSectorAccordion.sectorFill-E .playerSectorAccordionHead{background:#703ac6!important}
  .playerSectorAccordion.sectorFill-F .playerSectorAccordionHead{background:#50697c!important}
  .playerSectorAccordion.sectorFill-G .playerSectorAccordionHead{background:#8c671f!important}
  .playerSectorAccordion.sectorFill-H .playerSectorAccordionHead{background:#4a7b2b!important}
  .playerSectorAccordion.collapsed .playerSectorAccordionBody{display:none!important}.playerSectorAccordion.collapsed .playerSectorChevron{transform:rotate(180deg)!important}
  .playerSectorAccordionBody{padding:5px 6px 6px!important;background:#f9fbf9!important}
  .playerSectorBank+.playerSectorBank{border-top:1px dashed #bbc9bf!important;margin-top:5px!important;padding-top:5px!important}
  .playerSectorBankTitle{font-size:9.5px!important;font-weight:1000!important;color:#2a5b43!important;margin:0 0 4px!important}.playerSectorBankTitle span{font-weight:800!important;color:#6b7d72!important}
  .playerSectorStandGrid{display:grid!important;gap:4px!important}.playerSectorStandGrid.cols1{grid-template-columns:1fr!important}.playerSectorStandGrid.cols2{grid-template-columns:repeat(2,minmax(0,1fr))!important}.playerSectorStandGrid.cols3{grid-template-columns:repeat(3,minmax(0,1fr))!important}.playerSectorStandGrid.cols4{grid-template-columns:repeat(4,minmax(0,1fr))!important}
  .playerSectorStand{position:relative!important;min-width:0!important;min-height:48px!important;border:1px solid #b7c6bc!important;border-radius:7px!important;background:#eef3f0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;padding:3px 2px!important;overflow:hidden!important}
  .playerSectorStandNo{font-size:20px!important;line-height:1!important;font-weight:1000!important;color:#142f24!important}.playerSectorStandName{display:block!important;width:100%!important;text-align:center!important;margin-top:2px!important;font-size:9.5px!important;font-weight:900!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;color:#1d3228!important}
  .minePlayerSectorStand{border:3px solid #e0aa00!important;background:#fff6bf!important}.playerSectorMineBadge{position:absolute!important;top:1px!important;right:2px!important;background:#f0ba00!important;color:#3d2b00!important;border-radius:4px!important;padding:1px 3px!important;font-size:6px!important;font-weight:1000!important}

  .playerMobileSectorTables{margin-top:8px!important}.playerMobileSectorTables .drawSectorGrid{grid-template-columns:1fr!important;gap:7px!important}.playerMobileSectorTables .drawSectorBox{margin:0!important;padding:7px!important}
  .playerMobileFullMapWrap{margin:6px 0 8px!important;border:1px solid #c4d2c8!important;border-radius:10px!important;background:#fff!important;overflow:hidden!important}.playerMobileFullMapTitle{padding:7px 8px!important;background:#edf4ef!important;color:#18432f!important;font-size:12px!important;font-weight:1000!important}.playerMobileFullMapScroll{overflow-x:auto!important;-webkit-overflow-scrolling:touch!important;padding:7px!important}.playerMobileFullMapScroll .sectorMap{min-width:760px!important;margin:0!important}
}



/* V51 — pełna mapa mobilna dopasowana do ekranu + przyciski powiadomień zawodnika */
@media(max-width:760px){
  .playerNotificationNav{display:grid!important;grid-template-columns:1.35fr .85fr!important;gap:3px!important;margin-top:3px!important}
  .playerNotificationNav button{min-width:0!important;min-height:32px!important;padding:4px 3px!important;border-radius:6px!important;font-size:8.8px!important;line-height:1.02!important}
  .playerMobileFullMapWrap{margin:5px 0 8px!important;padding:0!important;border:1px solid #c4d2c8!important;border-radius:10px!important;background:#fff!important;overflow:hidden!important}
  .playerMobileFullMapTitle{padding:7px 8px!important;background:#edf4ef!important;color:#18432f!important;font-size:12px!important;font-weight:1000!important;text-align:center!important}
  .playerMobileFullMapViewport{position:relative!important;width:100%!important;overflow:hidden!important;background:#fff!important;padding:4px!important;box-sizing:border-box!important}
  .playerMobileFullMapCanvas{position:relative!important;transform-origin:top left!important}
  .playerMobileFullMapCanvas .sectorMap{max-width:none!important;overflow:visible!important;min-width:640px!important;padding:6px!important;margin:0!important;box-sizing:border-box!important}
  .playerMobileFullMapCanvas .roundMapHeading{font-size:21px!important;line-height:1.05!important;margin:0 0 5px!important}
  .playerMobileFullMapCanvas .bankLabel{font-size:15px!important;margin:3px 0!important}
  .playerMobileFullMapCanvas .roundDrawCell{min-height:118px!important;padding:4px 2px!important}
  .playerMobileFullMapCanvas .roundStandNo{font-size:26px!important;line-height:1!important}
  .playerMobileFullMapCanvas .roundDrawName{font-size:15px!important;font-weight:1000!important;line-height:1!important}
  .playerMobileFullMapCanvas .sectorBlock{min-height:82px!important;padding:4px 2px!important}
  .playerMobileFullMapCanvas .sectorLetter{font-size:29px!important;line-height:1!important}
  .playerMobileFullMapCanvas .sectorWord,.playerMobileFullMapCanvas .sectorPeople{font-size:10px!important}
  .playerMobileFullMapCanvas .water{min-height:38px!important;padding:7px!important;font-size:17px!important}
  .playerMobileFullMapCanvas .sectorSummary{font-size:10px!important;line-height:1.15!important;padding:5px!important}
  .playerMobileMapHint{padding:4px 7px 6px!important;font-size:9px!important;text-align:center!important;color:#617166!important;background:#fafcfb!important}
}


/* V52 — realne Web Push + kompaktowy interfejs powiadomień */
.pushBox{display:none!important}
.notificationHeaderRow{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.notificationHeaderRow h2{margin:0}
.phoneAlertControls{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.phoneAlertControls button{width:auto;min-height:32px;padding:5px 8px;font-size:11px}
.compactUserBar{padding:8px 10px!important;margin:6px 0!important}
.compactUserBar .adminbar{align-items:center}
@media(max-width:760px){
  .compactUserBar{padding:5px 7px!important;margin:3px 0!important}
  .compactUserBar .adminbar{grid-template-columns:minmax(0,1fr) auto auto!important;gap:4px!important}
  .compactUserBar #who{font-size:11px!important}.compactUserBar #role{font-size:9px!important}.compactUserBar #notifCounter{font-size:11px!important}
  .notificationHeaderRow{gap:5px!important}.phoneAlertControls{width:100%;display:grid!important;grid-template-columns:minmax(0,1fr) auto!important;gap:5px!important}
  .phoneAlertControls #notifPushState{font-size:9.5px!important}.phoneAlertControls button{min-height:30px!important;padding:4px 6px!important;font-size:10px!important}
  .playerNotificationNav{grid-template-columns:1fr!important}
  .playerNotificationNav button{min-height:32px!important;padding:4px!important;font-size:10px!important}
}



/* V54 — edycja nazw po imporcie + V/A + usuwanie */
.playerAccountLegend{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin:0 0 9px;padding:7px 9px;border:1px solid #d4ddd6;border-radius:9px;background:#f7faf7;font-size:11px;font-weight:800;color:#334b3d}
.playerAccountLegend>span{display:inline-flex;align-items:center;gap:5px}
.playerAccountBadge{display:inline-flex;align-items:center;justify-content:center;width:25px;height:25px;border-radius:999px;font-size:13px;font-weight:1000;line-height:1;border:2px solid transparent;box-sizing:border-box;margin-right:3px}
.playerAccountVerified{background:#0b8f46;color:#fff;border-color:#08753a;box-shadow:0 0 0 2px #d9f2e3}
.playerAccountAdmin{background:#f0b429;color:#3e2a00;border-color:#cf9414;box-shadow:0 0 0 2px #fff1bf}
.playerBadgeCell{white-space:nowrap;text-align:center}
.playerDeleteBtn{width:auto!important;min-width:60px!important;padding:5px 9px!important;font-size:11px!important;min-height:30px!important}
.adminPlayersTable td,.adminPlayersTable th{vertical-align:middle}
.mobilePlayerBadges{display:flex;gap:2px;margin-left:auto;align-items:center}
.mobilePlayerDeleteBtn{width:100%!important;margin-top:7px!important}
@media(max-width:760px){
  .playerAccountLegend{gap:8px!important;padding:5px 6px!important;margin-bottom:6px!important;font-size:9px!important}
  .playerAccountBadge{width:22px!important;height:22px!important;font-size:11px!important;margin-right:1px!important}
  .mobilePlayerManageCard{padding:7px!important}
  .mobilePlayerManageCard .mobileAdminCardHead{display:flex!important;align-items:center!important;gap:5px!important}
  .mobilePlayerDeleteBtn{min-height:30px!important;padding:4px 7px!important;font-size:10px!important}
}

/* V54 — szybka korekta nazw zawodników po imporcie */
.rosterNameEdit{display:flex;align-items:center;gap:7px;min-width:0}.rosterNameEdit b{min-width:0}.rosterEditNameBtn{padding:4px 7px!important;min-height:28px!important;font-size:10px!important;white-space:nowrap}.playerManageBtns{display:grid!important;grid-template-columns:1fr 1fr!important;gap:4px!important}.mobilePlayerManageActions{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:7px}.mobilePlayerManageActions button{width:100%;min-width:0}.mobileRosterCompactHead .rosterEditNameBtn{margin-left:auto}.mobileRosterCompactHead .mobileRosterCompactStatus{margin-left:0!important}
@media(max-width:760px){.rosterEditNameBtn{font-size:9px!important;padding:3px 5px!important;min-height:25px!important}.mobilePlayerManageActions{gap:4px}}


/* V55 — zawodnik: pulpit komputerowy jak mobilny + zapis P.Nowak w sektorach */
.playerDesktopDashboardV55{display:block;width:100%;min-width:0}
.playerDesktopUnifiedNav{position:sticky;top:0;z-index:1400;margin:0 0 10px;padding:8px;background:rgba(247,250,246,.985);box-shadow:0 5px 18px #00000018;border:1px solid #c8d5cc}
.playerDesktopMainNav{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:7px}
.playerDesktopMainNav button,.playerDesktopSubNav button{min-width:0;min-height:50px;padding:8px 7px;border-radius:9px;font-size:13px;font-weight:1000;line-height:1.08;white-space:normal}
.playerDesktopMainNav .drawTile{background:#146db7;border-color:#0d5b9b;color:#fff}
.playerDesktopMainNav .resultTile{background:#0d7a42;border-color:#096334;color:#fff}
.playerDesktopMainNav .resultTile:nth-child(5),.playerDesktopMainNav .resultTile:nth-child(6){background:#6b3bb3;border-color:#572b9a}
.playerDesktopUnifiedNav button.active{outline:3px solid #f1bd16;outline-offset:1px;box-shadow:0 0 0 1px #fff inset}
.playerDesktopSubNav{display:grid;grid-template-columns:1fr 1fr .8fr;gap:7px;margin-top:7px}
.playerDesktopSubNav .mapTile{background:#164f7f;border-color:#0d416d;color:#fff}
.playerDesktopSubNav .notificationTile{background:#285a3e;border-color:#17472e;color:#fff}
.playerDesktopDashboardV55 .playerOwnSummaryWrap{margin:10px 0}
.playerDesktopDashboardV55 .playerOwnSummaryHeading{margin:0 0 6px;font-size:14px;font-weight:1000;color:#315544;letter-spacing:.02em}
.playerDesktopDashboardV55 .playerOwnSummaryGrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.playerDesktopDashboardV55 .playerOwnSummaryCard{border:1px solid #bed0c3;border-radius:12px;padding:12px 14px;background:#fff;box-shadow:0 2px 8px #0000000e}
.playerDesktopDashboardV55 .playerOwnSummaryCard.round1{background:#eefbf0}.playerDesktopDashboardV55 .playerOwnSummaryCard.round2{background:#eef6ff}
.playerDesktopDashboardV55 .playerOwnSummaryTitle{font-size:13px;font-weight:1000;color:#1f4c38;margin-bottom:5px}
.playerDesktopDashboardV55 .playerOwnSummaryMain{display:grid;grid-template-columns:70px 90px minmax(0,1fr);gap:10px;align-items:end}
.playerDesktopDashboardV55 .playerOwnSummaryRound{font-size:24px;font-weight:1000}.playerDesktopDashboardV55 .playerOwnSummaryStand{font-size:42px;line-height:1;font-weight:1000;color:#102f23}.playerDesktopDashboardV55 .playerOwnSummarySector{font-size:20px;font-weight:1000}
.playerDesktopDashboardV55 .playerOwnSummaryLabels{display:grid;grid-template-columns:70px 90px minmax(0,1fr);gap:10px;margin-top:3px;color:#607169;font-size:10px;font-weight:800;text-transform:uppercase}
.playerDesktopSectionTitle{margin:12px 2px 8px;font-size:15px;font-weight:1000;color:#315544;letter-spacing:.02em}
.playerDesktopDashboardV55 .playerSectorAccordionList{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;align-items:start}
.playerDesktopDashboardV55 .playerSectorAccordion{border:1px solid #a9bcb0;border-radius:12px;overflow:hidden;background:#fff;box-shadow:0 2px 8px #0000000d}
.playerDesktopDashboardV55 .playerSectorAccordionHead{display:grid;grid-template-columns:42px minmax(0,1fr) auto 30px;gap:8px;align-items:center;width:100%;min-height:50px;padding:7px 10px;border-radius:0;text-align:left;color:#fff}
.playerDesktopDashboardV55 .playerSectorAccordionHead b{font-size:17px;line-height:1}.playerDesktopDashboardV55 .playerSectorCount{font-size:12px;font-weight:1000}.playerDesktopDashboardV55 .playerSectorChevron{font-size:21px;text-align:center;transition:transform .15s ease}
.playerDesktopDashboardV55 .playerSectorCircle{display:flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:999px;background:#ffffffdf;color:#173d2e;font-size:21px;font-weight:1000}
.playerDesktopDashboardV55 .playerSectorAccordion.sectorFill-A .playerSectorAccordionHead{background:#0c7b42}.playerDesktopDashboardV55 .playerSectorAccordion.sectorFill-B .playerSectorAccordionHead{background:#cc3131}.playerDesktopDashboardV55 .playerSectorAccordion.sectorFill-C .playerSectorAccordionHead{background:#d98b13}.playerDesktopDashboardV55 .playerSectorAccordion.sectorFill-D .playerSectorAccordionHead{background:#176cc2}.playerDesktopDashboardV55 .playerSectorAccordion.sectorFill-E .playerSectorAccordionHead{background:#703ac6}.playerDesktopDashboardV55 .playerSectorAccordion.sectorFill-F .playerSectorAccordionHead{background:#50697c}.playerDesktopDashboardV55 .playerSectorAccordion.sectorFill-G .playerSectorAccordionHead{background:#8c671f}.playerDesktopDashboardV55 .playerSectorAccordion.sectorFill-H .playerSectorAccordionHead{background:#4a7b2b}
.playerDesktopDashboardV55 .playerSectorAccordion.collapsed .playerSectorAccordionBody{display:none}.playerDesktopDashboardV55 .playerSectorAccordion.collapsed .playerSectorChevron{transform:rotate(180deg)}
.playerDesktopDashboardV55 .playerSectorAccordionBody{padding:8px;background:#f9fbf9}
.playerDesktopDashboardV55 .playerSectorBank+.playerSectorBank{border-top:1px dashed #bbc9bf;margin-top:8px;padding-top:8px}
.playerDesktopDashboardV55 .playerSectorBankTitle{font-size:12px;font-weight:1000;color:#2a5b43;margin:0 0 6px}.playerDesktopDashboardV55 .playerSectorBankTitle span{font-weight:800;color:#6b7d72}
.playerDesktopDashboardV55 .playerSectorStandGrid{display:grid;gap:6px}.playerDesktopDashboardV55 .playerSectorStandGrid.cols1{grid-template-columns:1fr}.playerDesktopDashboardV55 .playerSectorStandGrid.cols2{grid-template-columns:repeat(2,minmax(0,1fr))}.playerDesktopDashboardV55 .playerSectorStandGrid.cols3{grid-template-columns:repeat(3,minmax(0,1fr))}.playerDesktopDashboardV55 .playerSectorStandGrid.cols4{grid-template-columns:repeat(4,minmax(0,1fr))}
.playerDesktopDashboardV55 .playerSectorStand{position:relative;min-width:0;min-height:70px;border:1px solid #b7c6bc;border-radius:9px;background:#eef3f0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5px 4px;overflow:hidden}
.playerDesktopDashboardV55 .playerSectorStandNo{font-size:29px;line-height:1;font-weight:1000;color:#142f24}.playerDesktopDashboardV55 .playerSectorStandName{display:block;width:100%;text-align:center;margin-top:5px;font-size:14px;font-weight:1000;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#1d3228}
.playerDesktopDashboardV55 .minePlayerSectorStand{border:3px solid #e0aa00;background:#fff6bf}.playerDesktopDashboardV55 .playerSectorMineBadge{position:absolute;top:3px;right:4px;background:#f0ba00;color:#3d2b00;border-radius:5px;padding:2px 5px;font-size:8px;font-weight:1000}
.playerDesktopSectorTables{margin-top:12px}.playerDesktopSectorTables .drawSectorGrid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.playerDesktopSectorTables .drawSectorBox{margin:0;padding:9px}.playerDesktopSectorTables .drawSectorBox h4{font-size:16px;margin:2px 0 7px}
.playerDesktopFullMap{margin-top:10px;overflow:hidden}.playerDesktopFullMap>h2{margin:0 0 8px}.playerDesktopFullMap .sectorMap{max-width:100%;overflow-x:auto;margin:0}.playerDesktopFullMap .roundDrawName{font-size:14px!important;font-weight:1000!important}
.playerDesktopSelectedPanel .playerResultCard,.playerDesktopSelectedPanel>.card{margin-top:10px}
@media(max-width:1000px) and (min-width:761px){.playerDesktopMainNav{grid-template-columns:repeat(3,minmax(0,1fr))}.playerDesktopDashboardV55 .playerSectorAccordionList{grid-template-columns:1fr}.playerDesktopSectorTables .drawSectorGrid{grid-template-columns:1fr}}
@media(max-width:760px){.playerDesktopDashboardV55{display:none!important}}


/* V56 — pewne przypięcie nawigacji zawodnika pod nagłówkiem */
.playerDesktopStickySlot,.playerDrawStickySlot{position:relative!important;width:100%!important;overflow:visible!important}
.playerDesktopUnifiedNav.fixedPlayerBar,.playerUnifiedNav.fixedPlayerBar{
  position:fixed!important;
  z-index:9000!important;
  margin:0!important;
  background:#f3f6ef!important;
  border:1px solid #b9cbbf!important;
  box-shadow:0 7px 20px #00000030!important;
}
.playerDesktopUnifiedNav.fixedPlayerBar{border-radius:0 0 12px 12px!important;padding:6px 8px!important}
@media(max-width:760px){
  .playerUnifiedNav.fixedPlayerBar{right:auto!important;border-radius:0 0 10px 10px!important;padding:3px 4px 4px!important}
  .playerUnifiedNav.fixedPlayerBar .playerDrawTabs{margin-bottom:2px!important;gap:2px!important}
  .playerUnifiedNav.fixedPlayerBar .playerDrawTabs button{min-height:34px!important;padding:3px 2px!important;font-size:9.8px!important}
  .playerUnifiedNav.fixedPlayerBar .playerResultsNavInline{margin-bottom:2px!important;gap:2px!important}
  .playerUnifiedNav.fixedPlayerBar .playerResultsNavInline button{min-height:30px!important;padding:2px 1px!important;font-size:7.8px!important}
  .playerUnifiedNav.fixedPlayerBar .playerMapNav{gap:2px!important}
  .playerUnifiedNav.fixedPlayerBar .playerMapNav button{min-height:29px!important;padding:2px!important;font-size:8.3px!important}
  .playerUnifiedNav.fixedPlayerBar .playerNotificationNav{margin-top:2px!important}
  .playerUnifiedNav.fixedPlayerBar .playerNotificationNav button{min-height:27px!important;padding:2px!important;font-size:8px!important}
}
@media(min-width:761px){
  .playerDesktopUnifiedNav{position:relative!important;top:auto!important}
  .playerDesktopUnifiedNav.fixedPlayerBar{position:fixed!important}
}



/* V57 — desktop player nav should stay at real top, never in the middle */
.playerDesktopStickySlot{position:relative!important;overflow:visible!important}
.playerDesktopUnifiedNav{
  position:sticky!important;
  top:calc(var(--app-header-height,56px) + 4px)!important;
  left:auto!important;
  right:auto!important;
  width:auto!important;
  z-index:4200!important;
  margin:0 0 10px!important;
}
.playerDesktopUnifiedNav.fixedPlayerBar{
  position:sticky!important;
  top:calc(var(--app-header-height,56px) + 4px)!important;
  left:auto!important;
  right:auto!important;
  width:auto!important;
  margin:0 0 10px!important;
  border-radius:12px!important;
}
@media(min-width:761px){
  .playerDesktopDashboardV56 .playerDesktopUnifiedNav,
  .playerDesktopDashboardV55 .playerDesktopUnifiedNav{
    position:sticky!important;
    top:calc(var(--app-header-height,56px) + 4px)!important;
  }
  .playerDesktopDashboardV56 .playerDesktopUnifiedNav.fixedPlayerBar,
  .playerDesktopDashboardV55 .playerDesktopUnifiedNav.fixedPlayerBar{
    position:sticky!important;
    top:calc(var(--app-header-height,56px) + 4px)!important;
    left:auto!important;
    width:auto!important;
  }
}



/* V58 — desktop: sticky is applied to the slot itself.
   This avoids the CSS sticky-parent trap where the nav was constrained
   by a wrapper exactly as tall as the nav and therefore did not stick. */
@media(min-width:761px){
  .playerDesktopDashboardV56 .playerDesktopStickySlot,
  .playerDesktopDashboardV55 .playerDesktopStickySlot{
    position:sticky!important;
    top:calc(var(--app-header-height,56px) + 4px)!important;
    z-index:4800!important;
    width:100%!important;
    height:auto!important;
    overflow:visible!important;
    margin:0!important;
  }
  .playerDesktopDashboardV56 .playerDesktopUnifiedNav,
  .playerDesktopDashboardV55 .playerDesktopUnifiedNav,
  .playerDesktopDashboardV56 .playerDesktopUnifiedNav.fixedPlayerBar,
  .playerDesktopDashboardV55 .playerDesktopUnifiedNav.fixedPlayerBar{
    position:relative!important;
    top:auto!important;
    left:auto!important;
    right:auto!important;
    width:100%!important;
    margin:0 0 10px!important;
    border-radius:12px!important;
    z-index:1!important;
    background:#f3f6ef!important;
    box-shadow:0 7px 20px #00000024!important;
  }
}



/* V59 — przypięcie zawodnika dokładnie tym samym mechanizmem co admin */
.playerDesktopStickySlot,.playerDrawStickySlot{
  position:relative!important;
  top:auto!important;
  width:100%!important;
  min-width:0!important;
  overflow:visible!important;
  z-index:auto!important;
}
.playerDesktopUnifiedNav,.playerUnifiedNav{
  position:relative!important;
  top:auto!important;
}
.playerDesktopUnifiedNav.fixedPlayerBar,.playerUnifiedNav.fixedPlayerBar{
  position:fixed!important;
  top:0!important;
  z-index:5000!important;
  margin:0!important;
  background:rgba(243,246,239,.995)!important;
  border:1px solid #d1ddd4!important;
  border-radius:0 0 10px 10px!important;
  box-shadow:0 5px 14px #00000022!important;
}
@media(min-width:761px){
  .playerDesktopDashboardV56 .playerDesktopStickySlot,
  .playerDesktopDashboardV55 .playerDesktopStickySlot{
    position:relative!important;
    top:auto!important;
    height:auto;
    z-index:auto!important;
  }
  .playerDesktopDashboardV56 .playerDesktopUnifiedNav,
  .playerDesktopDashboardV55 .playerDesktopUnifiedNav{
    position:relative!important;
    top:auto!important;
    left:auto!important;
    right:auto!important;
    width:100%!important;
  }
  .playerDesktopDashboardV56 .playerDesktopUnifiedNav.fixedPlayerBar,
  .playerDesktopDashboardV55 .playerDesktopUnifiedNav.fixedPlayerBar{
    position:fixed!important;
    top:0!important;
    z-index:5000!important;
    margin:0!important;
    border-radius:0 0 10px 10px!important;
  }
}
@media(max-width:760px){
  .playerMobileDashboard .playerDrawStickySlot{position:relative!important;top:auto!important}
  .playerMobileDashboard .playerUnifiedNav.fixedPlayerBar{position:fixed!important;top:0!important;z-index:5000!important}
}
header{z-index:100!important}



/* V60 — zbiorcze usuwanie zawodników oznaczonych A */
.playerAccountTop{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin:0 0 8px}
.playerAccountTop .playerAccountLegend{margin:0!important;flex:1 1 420px}
.playerDeleteAllAdminBtn{min-height:38px!important;padding:8px 13px!important;font-weight:1000!important;white-space:nowrap}
.playerDeleteAllAdminBtn:disabled{opacity:.45!important;cursor:not-allowed!important}
@media(max-width:760px){.playerAccountTop{align-items:stretch;gap:7px}.playerAccountTop .playerAccountLegend{flex-basis:100%}.playerDeleteAllAdminBtn{width:100%!important;min-height:42px!important}}



/* V62 — uporządkowana, kompaktowa lista zawodów zawodnika: mobile + desktop */
.playerCompetitionOrganizer{display:grid;grid-template-columns:minmax(0,1fr) 230px;gap:10px;align-items:center;margin-bottom:10px;padding:8px;border:1px solid #cbd8cf;border-radius:12px;background:#f8fbf7}
.playerCompFilters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.playerCompFilter{min-height:42px!important;display:flex!important;align-items:center;justify-content:center;gap:8px;padding:6px 8px!important;background:#e7efe9!important;color:#173d2e!important;border:1px solid #b9cbbf!important;border-radius:9px!important;font-weight:1000!important}
.playerCompFilter b{display:inline-flex;align-items:center;justify-content:center;min-width:25px;height:25px;border-radius:999px;background:#fff;color:#173d2e;font-size:12px}
.playerCompFilter.active{background:#0b5634!important;color:#fff!important;border-color:#0b5634!important}.playerCompFilter.active b{background:#fff;color:#0b5634}
.playerCompMonthSelect{height:42px!important;margin:0!important;font-weight:900;background:#fff}
.playerCompGroups{display:grid;gap:8px}.playerCompMonthGroup{border:1px solid #c8d5cc;border-radius:11px;background:#fff;overflow:hidden}.playerCompMonthGroup>summary{list-style:none;cursor:pointer;display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 11px;background:#edf4ef;color:#214c38;font-size:13px;font-weight:1000;letter-spacing:.02em}.playerCompMonthGroup>summary::-webkit-details-marker{display:none}.playerCompMonthGroup>summary b{display:inline-flex;align-items:center;justify-content:center;min-width:27px;height:23px;padding:0 7px;border-radius:999px;background:#d4e4d8;color:#173d2e;font-size:11px}.playerCompMonthGroup[open]>summary{border-bottom:1px solid #cbd8cf}.playerCompMonthBody{padding:5px}
.playerCompDesktopRow{display:grid;grid-template-columns:52px minmax(240px,1.8fr) 105px 105px 115px 94px minmax(190px,.9fr);gap:8px;align-items:center;min-height:54px;padding:6px 7px;border-bottom:1px solid #e1e8e3}.playerCompDesktopRow:last-child{border-bottom:0}.playerCompDesktopRow.mine{background:#f3fbf5}.playerCompNo{display:inline-flex;align-items:center;justify-content:center;min-width:43px;height:30px;border-radius:8px;background:#173d2e;color:#fff;font-size:13px;font-weight:1000}.playerCompDesktopTitle{min-width:0}.playerCompDesktopTitle b{display:block;font-size:14px;line-height:1.1;color:#142b20;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.playerCompDesktopTitle span{display:block;margin-top:2px;font-size:11px;color:#66756d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.playerCompDesktopDate,.playerCompDesktopCount{font-size:12px;font-weight:900;white-space:nowrap}.playerCompStatus{display:inline-flex;align-items:center;justify-content:center;min-height:26px;padding:4px 7px;border-radius:999px;font-size:10px;font-weight:1000;white-space:nowrap}.playerCompStatus.open{background:#dff4e4;color:#09642f}.playerCompStatus.full{background:#fff0c4;color:#7a5100}.playerCompStatus.closed{background:#eceff0;color:#4c5953}.playerCompStatus.done{background:#e1e4e3;color:#59635e}.playerCompMineBadge{display:inline-flex;align-items:center;justify-content:center;padding:4px 7px;border-radius:999px;background:#dff4e4;color:#0c6832;font-size:9px;font-weight:1000;white-space:nowrap}.playerCompCompactActions{display:grid;grid-template-columns:1fr 1fr;gap:5px;min-width:0}.playerCompCompactActions button{min-width:0!important;min-height:31px!important;padding:4px 6px!important;font-size:10px!important;border-radius:7px!important}.playerCompEmpty{padding:18px;text-align:center;color:#68766e;font-weight:800;background:#f8fbf7;border:1px dashed #c4d2c8;border-radius:10px}.playerCompetitionMobileOnly{display:none}
.playerCompCompactCard{border-bottom:1px solid #e0e8e2;padding:7px 5px;background:#fff}.playerCompCompactCard:last-child{border-bottom:0}.playerCompCompactCard.mine{background:#f3fbf5}.playerCompCompactTop{display:grid;grid-template-columns:44px minmax(0,1fr) auto;gap:7px;align-items:center}.playerCompTitle{min-width:0}.playerCompTitle b{display:block;font-size:13.5px;line-height:1.1;color:#142b20;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.playerCompTitle span{display:block;margin-top:3px;font-size:10.3px;line-height:1.05;color:#65756c;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.playerCompCompactBottom{display:grid;grid-template-columns:minmax(90px,.75fr) minmax(170px,1.25fr);gap:7px;align-items:center;margin-top:6px}.playerCompMiniInfo{display:flex;align-items:center;gap:5px;min-width:0}.playerCompMiniInfo>b{font-size:11.5px;color:#173d2e;white-space:nowrap}
@media(max-width:760px){
  .playerCompetitionOrganizer{grid-template-columns:1fr;gap:6px;margin:0 -2px 7px;padding:6px;border-radius:10px}.playerCompFilters{gap:4px}.playerCompFilter{min-height:38px!important;gap:4px;padding:4px 2px!important;font-size:9.5px!important}.playerCompFilter b{min-width:22px;height:22px;font-size:10px}.playerCompMonthSelect{height:36px!important;font-size:11px!important;padding:4px 7px!important}.playerCompetitionDesktopOnly{display:none!important}.playerCompetitionMobileOnly{display:block!important}.playerCompGroups{gap:6px}.playerCompMonthGroup{border-radius:9px}.playerCompMonthGroup>summary{padding:7px 8px;font-size:11px}.playerCompMonthBody{padding:2px 4px}.playerCompCompactCard{padding:7px 2px}.playerCompCompactTop{grid-template-columns:42px minmax(0,1fr) auto;gap:6px}.playerCompNo{min-width:40px;height:28px;font-size:12px}.playerCompTitle b{font-size:13px}.playerCompTitle span{font-size:9.8px}.playerCompStatus{min-height:24px;padding:3px 6px;font-size:8.5px}.playerCompCompactBottom{grid-template-columns:minmax(80px,.72fr) minmax(155px,1.28fr);gap:5px;margin-top:5px}.playerCompMineBadge{padding:3px 5px;font-size:8px}.playerCompMiniInfo>b{font-size:10.5px}.playerCompCompactActions{gap:4px}.playerCompCompactActions button{min-height:30px!important;padding:3px 4px!important;font-size:9.5px!important}
}
@media(max-width:390px){.playerCompFilter{font-size:8.6px!important}.playerCompFilter b{min-width:20px;height:20px}.playerCompCompactTop{grid-template-columns:39px minmax(0,1fr) auto}.playerCompNo{min-width:37px}.playerCompCompactBottom{grid-template-columns:1fr}.playerCompMiniInfo{min-height:24px}.playerCompCompactActions button{font-size:9.2px!important}}



/* V62 — zasada nr 1: trzy najbliższe zawody zawsze na górze */
.playerNearestThree{margin:10px 0 12px}
.playerNearestThreeHead{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:7px 10px;background:#0b5634;color:#fff;border-radius:10px 10px 0 0;border:1px solid #084629}
.playerNearestThreeHead b{font-size:13px;letter-spacing:.03em}
.playerNearestThreeHead span{font-size:10px;font-weight:900;opacity:.88}
.playerNearestThreeBody{border:1px solid #aac0b0;border-top:0;border-radius:0 0 10px 10px;background:#fff;padding:6px}
.playerNearestThree.desktop .playerCompDesktopRow{margin:0 0 4px}.playerNearestThree.desktop .playerCompDesktopRow:last-child{margin-bottom:0}
.playerNearestThree.mobile .playerCompCompactCard{margin:0 0 5px}.playerNearestThree.mobile .playerCompCompactCard:last-child{margin-bottom:0}
@media(max-width:760px){
  .playerNearestThree{margin:7px 0 9px}
  .playerNearestThreeHead{padding:6px 8px;border-radius:8px 8px 0 0}
  .playerNearestThreeHead b{font-size:11px}.playerNearestThreeHead span{font-size:8px}
  .playerNearestThreeBody{padding:4px;border-radius:0 0 8px 8px}
}



/* V64 — kafel admina: usuń całe losowanie razem z wynikami */
.adminDeleteDrawTile{margin-top:12px;padding:10px;border:2px solid #c62828;border-radius:14px;background:#fff3f3}
.adminDeleteDrawBtn{min-height:48px;font-size:14px;letter-spacing:.02em}
.adminDeleteDrawTile .small{margin-top:6px;color:#8a2020;line-height:1.35}
@media(max-width:760px){
  .adminDeleteDrawTile{padding:8px;margin-top:9px;border-radius:11px}
  .adminDeleteDrawBtn{min-height:44px;font-size:12px;padding:8px 6px}
  .adminDeleteDrawTile .small{font-size:10px}
}



/* V64 — numeracja zawodów od 1 + czytelniejszy stan zapisów */
.playerCompCountBadge{display:inline-flex;align-items:center;gap:5px;min-height:25px;padding:3px 7px;border:1px solid #9eb7a7;border-radius:7px;background:#fff;color:#173d2e;white-space:nowrap}
.playerCompCountBadge small{font-size:7.5px;line-height:1;font-weight:1000;color:#6a7b70;letter-spacing:.04em}
.playerCompCountBadge b{font-size:11.5px;line-height:1;font-weight:1000;color:#102f23}
.playerCompReserveBadge{display:inline-flex;align-items:center;min-height:25px;padding:3px 6px;border-radius:7px;background:#fff4d1;color:#755000;font-size:9px;font-weight:1000;white-space:nowrap}
.playerCompMiniInfo{display:flex!important;align-items:center!important;gap:6px!important;min-width:0!important;flex-wrap:wrap!important}
.playerCompDesktopCount{display:flex;align-items:center;gap:5px;min-width:0}
@media(max-width:760px){
  .playerCompCompactBottom{grid-template-columns:minmax(128px,.9fr) minmax(155px,1.1fr)!important;align-items:center!important}
  .playerCompMiniInfo{gap:4px!important;flex-wrap:nowrap!important}
  .playerCompCountBadge{min-height:24px;padding:3px 6px;gap:4px}
  .playerCompCountBadge small{font-size:7px}.playerCompCountBadge b{font-size:10.5px}
  .playerCompMineBadge{margin-left:1px!important;flex:0 0 auto!important}
}
@media(max-width:390px){
  .playerCompCompactBottom{grid-template-columns:1fr!important}
  .playerCompMiniInfo{justify-content:flex-start!important;min-height:26px!important}
}



/* V65 — mały czerwony licznik nieprzeczytanych powiadomień */
#playerNotifBtn,.notificationTile,#btn-notifications{position:relative!important}
.playerNotifBadge,.topNotifBadge{
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  min-width:18px!important;
  height:18px!important;
  padding:0 5px!important;
  margin-left:6px!important;
  border-radius:999px!important;
  background:#d71920!important;
  color:#fff!important;
  border:2px solid #fff!important;
  box-shadow:0 1px 4px #00000040!important;
  font-size:10px!important;
  line-height:1!important;
  font-weight:1000!important;
  vertical-align:middle!important;
}
.topNotifBadge{position:absolute!important;top:-5px!important;right:-5px!important;margin:0!important;min-width:17px!important;height:17px!important;padding:0 4px!important;font-size:9px!important}
@media(max-width:760px){
  .playerNotifBadge{min-width:17px!important;height:17px!important;padding:0 4px!important;margin-left:5px!important;font-size:9px!important}
}



/* V66 — profil zawodnika + czytelna data i odliczanie do startu */
.myProfileCard{max-width:980px;margin:0 auto}.myProfileHead{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}.myProfileHead h2{margin:0 0 3px}.myProfileHead p{margin:0}.myProfileRole{display:inline-flex;align-items:center;justify-content:center;padding:5px 9px;border-radius:999px;background:#173d2e;color:#fff;font-size:10px;font-weight:1000}.myProfileGrid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.myProfilePassword{margin-top:14px;padding-top:12px;border-top:1px solid #d7e1da}.myProfilePassword h3{margin:0 0 3px}.myProfilePassword p{margin:0 0 8px}.myProfileActions{display:flex;justify-content:flex-end;margin-top:14px}.myProfileActions button{min-width:220px}
.playerCompDateLine{display:flex;align-items:center;gap:8px;min-width:0;margin-top:4px;white-space:nowrap}.playerCompDate{font-size:16px!important;line-height:1;font-weight:1000!important;color:#163d2e!important;letter-spacing:.01em}.playerCompWeekday{display:inline-flex!important;align-items:center;justify-content:center!important;min-height:23px;padding:4px 8px!important;border-radius:7px;background:#315b96!important;color:#fff!important;border:1px solid #234a7e!important;font-size:12px!important;line-height:1!important;font-weight:1000!important;letter-spacing:.06em!important;box-shadow:0 1px 2px #00000018}.playerCompSubLine{display:flex;align-items:center;gap:7px;min-width:0;margin-top:5px}.playerCompFishery{display:block!important;min-width:0;flex:1 1 auto;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px!important;font-weight:800!important;color:#5c6e64!important}.playerCompCountdown{display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;min-height:25px;padding:5px 9px;border-radius:8px;font-size:11px!important;line-height:1!important;font-style:normal;font-weight:1000;letter-spacing:.025em;white-space:nowrap;border:1px solid transparent;box-shadow:0 1px 2px #00000015}.playerCompCountdown.today{background:#ffe1df;color:#a31f1a;border-color:#df6a62}.playerCompCountdown.tomorrow{background:#dcefff;color:#125d90;border-color:#7eb6da}.playerCompCountdown.soon{background:#fff0bd;color:#704600;border-color:#dfba43}.playerCompCountdown.future{background:#e5edff;color:#2e4f8f;border-color:#a8bce9}.playerCompCountdown.past{background:#e7eae8;color:#5b665f;border-color:#c7ceca}.playerCompDesktopDateBox{display:flex;flex-direction:column;align-items:flex-start;gap:5px;white-space:nowrap}.playerCompDesktopDateTop{display:flex;align-items:center;gap:8px}.playerCompDesktopDateBox .playerCompDate{font-size:16px!important}.playerCompDesktopDateBox .playerCompWeekday{font-size:11.5px!important;min-height:23px;padding:4px 8px!important}.playerCompDesktopDateBox .playerCompCountdown{font-size:10.5px!important;min-height:24px;padding:5px 8px}
.playerCompDesktopRow{grid-template-columns:52px minmax(240px,1.8fr) 145px 105px 115px 94px minmax(190px,.9fr)!important;min-height:64px!important}.playerCompDesktopDate{font-size:inherit!important}
@media(max-width:760px){.myProfileCard{padding:10px!important}.myProfileHead{align-items:center}.myProfileGrid{grid-template-columns:1fr;gap:7px}.myProfileActions{display:block}.myProfileActions button{width:100%;min-width:0}.playerCompCompactCard{padding-top:8px!important;padding-bottom:8px!important}.playerCompTitle b{font-size:13px!important}.playerCompDateLine{gap:7px!important}.playerCompDate{font-size:16px!important}.playerCompWeekday{font-size:11.5px!important;min-height:23px!important;padding:4px 7px!important}.playerCompSubLine{gap:6px!important}.playerCompCountdown{font-size:10.5px!important;min-height:24px!important;padding:5px 8px!important}.playerCompFishery{font-size:9.8px!important}}
@media(max-width:390px){.playerCompDateLine{gap:5px!important}.playerCompDate{font-size:15px!important}.playerCompWeekday{font-size:10.5px!important;padding:4px 6px!important}.playerCompCountdown{font-size:9.8px!important;padding:5px 6px!important}.playerCompFishery{font-size:9.2px!important}}



/* V68 — desktop: data / dzień / odliczanie bez nachodzenia na kolejne kolumny */
@media(min-width:761px){
  .playerCompDesktopRow{
    grid-template-columns:52px minmax(220px,1fr) 200px 110px 112px 92px minmax(180px,.82fr)!important;
    column-gap:8px!important;
    min-height:74px!important;
    align-items:center!important;
  }
  .playerCompDesktopRow>*{min-width:0!important}
  .playerCompDesktopDate{width:100%!important;min-width:0!important;overflow:visible!important;white-space:normal!important}
  .playerCompDesktopDateBox{
    width:100%!important;
    display:grid!important;
    grid-template-rows:auto auto!important;
    gap:6px!important;
    align-items:center!important;
    white-space:normal!important;
  }
  .playerCompDesktopDateTop{
    display:grid!important;
    grid-template-columns:max-content max-content!important;
    justify-content:start!important;
    align-items:center!important;
    gap:7px!important;
    min-width:0!important;
  }
  .playerCompDesktopDateBox .playerCompDate{font-size:15px!important;white-space:nowrap!important}
  .playerCompDesktopDateBox .playerCompWeekday{
    font-size:11px!important;
    min-height:24px!important;
    padding:4px 8px!important;
    white-space:nowrap!important;
  }
  .playerCompDesktopDateBox .playerCompCountdown{
    justify-self:start!important;
    font-size:10.5px!important;
    min-height:25px!important;
    padding:5px 9px!important;
    white-space:nowrap!important;
  }
  .playerCompDesktopCount{
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    gap:4px!important;
    min-width:0!important;
  }
  .playerCompDesktopRow .playerCompMineBadge{justify-self:center!important}
  .playerCompDesktopRow .playerCompStatus{justify-self:stretch!important}
  .playerCompDesktopRow .playerCompCompactActions{min-width:0!important}
}
@media(min-width:761px) and (max-width:1080px){
  .playerCompetitionDesktopOnly{overflow-x:auto!important;-webkit-overflow-scrolling:touch}
  .playerCompDesktopRow{min-width:1030px!important}
}


/* V69: appearance only. Scoped to the existing player detail; handlers and data unchanged. */
body:has(#competitionDetail:not(.hidden) .playerView){background:#06121d;color:#18251d}
body:has(#competitionDetail:not(.hidden) .playerView) header{background:linear-gradient(90deg,#061521ed,#102e4680),url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%201400%20160%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22sky%22%20x2%3D%220%22%20y2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23446078%22%2F%3E%3Cstop%20offset%3D%22.55%22%20stop-color%3D%22%23c1ab88%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2312314a%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Cpath%20fill%3D%22url%28%23sky%29%22%20d%3D%22M0%200h1400v160H0z%22%2F%3E%3Cpath%20fill%3D%22%23243c4e%22%20d%3D%22M0%2095%20180%2037%20300%2072%20440%2020%20660%2091%20850%2028%201010%2068%201200%2010%201400%2081v80H0z%22%2F%3E%3Cpath%20fill%3D%22%23062130%22%20d%3D%22M0%20115Q350%2096%20690%20113T1400%20109v51H0z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M0%20120v-35l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L0%2085z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M35%20120v-52l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L35%2068z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M70%20120v-69l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L70%2051z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M105%20120v-86l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L105%2034z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M140%20120v-38l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L140%2082z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M175%20120v-55l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L175%2065z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M210%20120v-72l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L210%2048z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M245%20120v-89l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L245%2031z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M280%20120v-41l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L280%2079z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M315%20120v-58l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L315%2062z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M350%20120v-75l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L350%2045z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M385%20120v-92l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L385%2028z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M420%20120v-44l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L420%2076z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M455%20120v-61l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L455%2059z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M490%20120v-78l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L490%2042z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M525%20120v-95l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L525%2025z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M560%20120v-47l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L560%2073z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M595%20120v-64l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L595%2056z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M630%20120v-81l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L630%2039z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M665%20120v-98l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L665%2022z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M700%20120v-50l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L700%2070z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M735%20120v-67l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L735%2053z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M770%20120v-84l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L770%2036z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M805%20120v-36l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L805%2084z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M840%20120v-53l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L840%2067z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M875%20120v-70l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L875%2050z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M910%20120v-87l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L910%2033z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M945%20120v-39l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L945%2081z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M980%20120v-56l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L980%2064z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1015%20120v-73l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1015%2047z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1050%20120v-90l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1050%2030z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1085%20120v-42l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1085%2078z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1120%20120v-59l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1120%2061z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1155%20120v-76l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1155%2044z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1190%20120v-93l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1190%2027z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1225%20120v-45l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1225%2075z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1260%20120v-62l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1260%2058z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1295%20120v-79l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1295%2041z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1330%20120v-96l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1330%2024z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1365%20120v-48l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1365%2072z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1400%20120v-65l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1400%2055z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1435%20120v-82l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1435%2038z%22%2F%3E%3C%2Fsvg%3E");background-size:cover;background-position:center;border-bottom:1px solid #32516a;color:#d5ecff}
body:has(#competitionDetail:not(.hidden) .playerView) header h1{color:#d5ecff;text-shadow:0 2px 10px #000}
body:has(#competitionDetail:not(.hidden) .playerView) #competitionDetail>.card{background:#0b2130;border:1px solid #36546a;color:#e8f4ff}
body:has(#competitionDetail:not(.hidden) .playerView) #competitionDetail>.card .muted{color:#c0daeb}
body:has(#competitionDetail:not(.hidden) .playerView) #competitionDetail>.card p{font-size:18px;font-weight:700}
.playerView{background:#071723!important;color:#e4f2ff!important;border:1px solid #28445c;border-radius:12px;padding:12px;box-sizing:border-box}
.playerView .playerUnifiedNav,.playerView .playerDesktopUnifiedNav{background:#071723!important;border:0!important;box-shadow:0 5px 16px #0005!important;border-radius:6px!important;padding:5px!important}
.playerView .playerUnifiedNav button,.playerView .playerDesktopUnifiedNav button{border-radius:6px!important;color:#fff!important;border:1px solid #547999!important;box-shadow:inset 0 1px 2px #ffffff40!important;line-height:1.15!important}
.playerView .playerDrawTabs button,.playerView .playerDesktopMainNav .drawTile{background:linear-gradient(#137cda,#06428a)!important;border-color:#399df7!important}
.playerView .playerResultsNavInline button,.playerView .playerDesktopMainNav .resultTile{background:linear-gradient(#20913c,#07542c)!important;border-color:#43bc63!important}
.playerView .playerResultsNavInline button:nth-child(n+3),.playerView .playerDesktopMainNav button:nth-child(n+5){background:linear-gradient(#7940dc,#362078)!important;border-color:#9970ff!important}
.playerView .playerMapNav button,.playerView .playerDesktopSubNav .mapTile{background:linear-gradient(#123e61,#092338)!important;border-color:#3b91ce!important}
.playerView .playerNotificationNav button,.playerView .playerDesktopSubNav .notificationTile{background:#183746!important;border-color:#52798c!important}
.playerView .playerUnifiedNav button.active,.playerView .playerDesktopUnifiedNav button.active{outline:2px solid #c3e9ff!important;outline-offset:-3px!important;box-shadow:0 0 9px #318ed555!important}
.playerView button:focus-visible{outline:3px solid #ffd13b!important;outline-offset:2px!important}
.playerView .playerDesktopMainNav button{min-height:82px!important}
.playerView .playerDesktopMainNav button:before,.playerView .playerDrawTabs button:before,.playerView .playerResultsNavInline button:before{content:'';display:block;width:24px;height:24px;margin:0 auto 6px;background:currentColor;mask:var(--nav-icon) center/contain no-repeat;-webkit-mask:var(--nav-icon) center/contain no-repeat}
.playerView .playerOwnSummaryHeading,.playerView .playerMobileSectionTitle,.playerView .playerDesktopSectionTitle{color:#beddf2!important;letter-spacing:.03em}
.playerView .playerOwnSummaryCard{border:1px solid #b4e2d5!important;border-radius:7px!important;box-shadow:inset 0 1px 2px #fff5!important;color:#08221c!important}
.playerView .playerOwnSummaryCard.round1{background:linear-gradient(120deg,#b9ebd3,#d1f4e6)!important}
.playerView .playerOwnSummaryCard.round2{background:linear-gradient(120deg,#a5d9f2,#d1efff)!important;border-color:#9acfea!important}
.playerView .playerOwnSummaryTitle,.playerView .playerOwnSummaryStand,.playerView .playerOwnSummaryRound,.playerView .playerOwnSummarySector{color:#082523!important}
.playerView .playerOwnSummaryLabels{color:#34514e!important}
.playerView .playerSectorAccordion{--sector:#15a650;background:#091b28!important;border:1px solid var(--sector)!important;border-radius:7px!important;box-shadow:0 2px 8px #0003!important}
.playerView .playerSectorAccordion.sectorFill-B{--sector:#eb3d53}
.playerView .playerSectorAccordion.sectorFill-C{--sector:#e7a21d}
.playerView .playerSectorAccordion.sectorFill-D{--sector:#2789ed}
.playerView .playerSectorAccordion.sectorFill-E{--sector:#8d50e9}
.playerView .playerSectorAccordion.sectorFill-F{--sector:#7591aa}
.playerView .playerSectorAccordion.sectorFill-G{--sector:#a37e3b}
.playerView .playerSectorAccordion.sectorFill-H{--sector:#75a743}
.playerView .playerSectorAccordion .playerSectorAccordionHead{background:linear-gradient(#ffffff12,#0005),var(--sector)!important;color:white!important;box-shadow:inset 0 1px 2px #fff6!important;border:0!important;grid-template-columns:minmax(0,1fr) auto 24px!important;min-height:44px!important}
.playerView .playerSectorCircle{display:none!important}
.playerView .playerSectorAccordionBody{background:#091b28!important}
.playerView .playerSectorBank+.playerSectorBank{border-color:#2a485c!important}
.playerView .playerSectorBankTitle,.playerView .playerSectorBankTitle span{color:#88cefa!important}
.playerView .playerSectorStand{background:linear-gradient(135deg,#263e52,#142737)!important;border:1px solid #58788f!important;border-radius:5px!important;box-shadow:inset 0 1px 1px #ffffff18!important}
.playerView .playerSectorStandNo,.playerView .playerSectorStandName{color:#f0f7ff!important}
.playerView .minePlayerSectorStand{border:3px solid #ffcf23!important;background:linear-gradient(135deg,#354138,#172c28)!important;box-shadow:0 0 6px #ffce2330!important}
.playerView .playerSectorMineBadge{background:#ffd12b!important;color:#13222a!important;border-radius:2px!important;font-size:9px!important;top:0!important;right:0!important;padding:2px 4px!important}
/* Keep table/map surfaces light so all existing inline rank and sector colors stay legible. */
.playerView .card,.playerView .playerResultCard,.playerView .drawSectorBox,.playerView .playerDesktopFullMap,.playerView .playerMobileFullMapWrap,.playerView .stationStats{color:#18251d}
.playerView .playerMobileMapHint{color:#173d2e}
@media(min-width:761px){
 .playerView{padding:16px}
 .playerView .playerDesktopUnifiedNav .playerDesktopMainNav{grid-template-columns:repeat(6,minmax(0,1fr))!important}
 .playerView .playerSectorAccordionList{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:12px!important;align-items:start}
 .playerView .playerSectorStand{min-height:68px!important}
}
@media(max-width:760px){
 .playerView{padding:6px!important;border-radius:8px!important}
 .playerView .playerUnifiedNav{display:grid!important;grid-template-columns:repeat(6,minmax(0,1fr))!important;gap:5px!important}
 .playerView .playerUnifiedNav .playerDrawTabs,.playerView .playerUnifiedNav .playerResultsNavInline{display:contents!important}
 .playerView .playerUnifiedNav .playerDrawTabs button,.playerView .playerUnifiedNav .playerResultsNavInline button{min-height:64px!important;padding:5px 2px!important;font-size:9px!important;margin:0!important;min-width:0!important;overflow-wrap:normal!important}
 .playerView .playerMapNav{grid-column:1/-1;gap:5px!important;margin:0!important}
 .playerView .playerNotificationNav{grid-column:1/-1;margin:0!important}
 .playerView .playerNotificationNav button{min-height:34px!important}
 .playerView .playerDrawTabs button:before,.playerView .playerResultsNavInline button:before{width:21px;height:21px;margin-bottom:5px}
 .playerView .playerOwnSummaryCard{padding:8px 6px!important}
 .playerView .playerOwnSummaryMain,.playerView .playerOwnSummaryLabels{grid-template-columns:25px 40px minmax(0,1fr)!important;gap:3px!important}
 .playerView .playerOwnSummaryStand{font-size:29px!important}
 .playerView .playerOwnSummarySector{font-size:12px!important}
 .playerView .playerSectorAccordionHead{padding:7px 9px!important}
 .playerView .playerSectorAccordionHead b{font-size:14px!important}
 .playerView .playerSectorBankTitle{font-size:11px!important}
 .playerView .playerSectorStand{min-height:53px!important}
 .playerView .playerSectorStandNo{font-size:23px!important}
 .playerView .playerSectorStandName{font-size:10px!important;font-weight:600!important}
 .playerView .playerSectorAccordionBody{padding:7px!important}
}
@media(max-width:360px){.playerView .playerUnifiedNav .playerResultsNavInline button{font-size:8px!important}.playerView .playerOwnSummaryMain,.playerView .playerOwnSummaryLabels{grid-template-columns:20px 30px minmax(0,1fr)!important}.playerView .playerOwnSummarySector{font-size:11px!important}}
@media print{.playerView{background:white!important;color:black!important;box-shadow:none!important}}
.playerView .drawTile{--nav-icon:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%224%22%20y%3D%224%22%20width%3D%2216%22%20height%3D%2216%22%20rx%3D%223%22%2F%3E%3Cpath%20d%3D%22M8%208h.01M16%208h.01M12%2012h.01M8%2016h.01M16%2016h.01%22%20stroke-width%3D%223%22%2F%3E%3C%2Fsvg%3E")}
.playerView .playerDesktopMainNav .resultTile,.playerView .playerResultsNavInline button{--nav-icon:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M8%203h8v7a4%204%200%200%201-8%200V3ZM8%205H4v3a4%204%200%200%200%204%204m8-7h4v3a4%204%200%200%201-4%204m-4%202v6m-4%201h8%22%2F%3E%3C%2Fsvg%3E")}
.playerView .playerDesktopMainNav button:nth-child(5),.playerView .playerResultsNavInline button:nth-child(3){--nav-icon:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M5%2020V11h3v9zm6%200V4h3v16zm6%200V8h3v12z%22%2F%3E%3C%2Fsvg%3E")}
.playerView .playerDesktopMainNav button:nth-child(6),.playerView .playerResultsNavInline button:nth-child(4){--nav-icon:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m3%2016%206-6%204%203%207-9m-6%200h6v6M4%2021h17%22%2F%3E%3C%2Fsvg%3E")}

/* V70: the dark theme starts at player sign-in, including the competition list. */
body.playerTheme{background:#061420!important;color:#e8f3fd!important;font-family:Arial,Helvetica,sans-serif!important;--green:#087344;--bg:#061420;--txt:#e8f3fd}
body.playerTheme button,body.playerTheme input,body.playerTheme select,body.playerTheme textarea{font-family:Arial,Helvetica,sans-serif!important}
body.playerTheme header{background:linear-gradient(100deg,#061521eb,#132e4880),url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%201400%20160%22%3E%3Cdefs%3E%3ClinearGradient%20id%3D%22sky%22%20x2%3D%220%22%20y2%3D%221%22%3E%3Cstop%20stop-color%3D%22%23446078%22%2F%3E%3Cstop%20offset%3D%22.55%22%20stop-color%3D%22%23c1ab88%22%2F%3E%3Cstop%20offset%3D%221%22%20stop-color%3D%22%2312314a%22%2F%3E%3C%2FlinearGradient%3E%3C%2Fdefs%3E%3Cpath%20fill%3D%22url%28%23sky%29%22%20d%3D%22M0%200h1400v160H0z%22%2F%3E%3Cpath%20fill%3D%22%23243c4e%22%20d%3D%22M0%2095%20180%2037%20300%2072%20440%2020%20660%2091%20850%2028%201010%2068%201200%2010%201400%2081v80H0z%22%2F%3E%3Cpath%20fill%3D%22%23062130%22%20d%3D%22M0%20115Q350%2096%20690%20113T1400%20109v51H0z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M0%20120v-35l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L0%2085z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M35%20120v-52l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L35%2068z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M70%20120v-69l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L70%2051z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M105%20120v-86l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L105%2034z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M140%20120v-38l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L140%2082z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M175%20120v-55l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L175%2065z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M210%20120v-72l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L210%2048z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M245%20120v-89l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L245%2031z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M280%20120v-41l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L280%2079z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M315%20120v-58l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L315%2062z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M350%20120v-75l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L350%2045z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M385%20120v-92l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L385%2028z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M420%20120v-44l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L420%2076z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M455%20120v-61l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L455%2059z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M490%20120v-78l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L490%2042z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M525%20120v-95l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L525%2025z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M560%20120v-47l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L560%2073z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M595%20120v-64l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L595%2056z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M630%20120v-81l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L630%2039z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M665%20120v-98l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L665%2022z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M700%20120v-50l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L700%2070z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M735%20120v-67l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L735%2053z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M770%20120v-84l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L770%2036z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M805%20120v-36l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L805%2084z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M840%20120v-53l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L840%2067z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M875%20120v-70l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L875%2050z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M910%20120v-87l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L910%2033z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M945%20120v-39l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L945%2081z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M980%20120v-56l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L980%2064z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1015%20120v-73l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1015%2047z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1050%20120v-90l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1050%2030z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1085%20120v-42l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1085%2078z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1120%20120v-59l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1120%2061z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1155%20120v-76l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1155%2044z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1190%20120v-93l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1190%2027z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1225%20120v-45l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1225%2075z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1260%20120v-62l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1260%2058z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1295%20120v-79l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1295%2041z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1330%20120v-96l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1330%2024z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1365%20120v-48l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1365%2072z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1400%20120v-65l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1400%2055z%22%2F%3E%3Cpath%20fill%3D%22%23061b26%22%20d%3D%22M1435%20120v-82l-14%2028h8l-18%2027h14l-20%2025h60l-20-25h14l-18-27h8L1435%2038z%22%2F%3E%3C%2Fsvg%3E") center/cover!important;border-bottom:1px solid #365875!important;color:#d8efff!important;box-shadow:0 3px 16px #0006}
body.playerTheme header h1{color:#d8efff!important;font-size:24px;letter-spacing:.01em}
body.playerTheme main{max-width:1220px}
body.playerTheme #app>.card,body.playerTheme #tab-competitions>.card,body.playerTheme #competitionDetail>.card,body.playerTheme #tab-profile .card,body.playerTheme #tab-notifications .card{background:#102536!important;color:#e5f2ff!important;border-color:#36536b!important;box-shadow:0 4px 18px #0003!important}
body.playerTheme .compactUserBar{border-left-color:#3ab9ed!important}
body.playerTheme #role,body.playerTheme #app>.card .muted,body.playerTheme #tab-profile .muted,body.playerTheme #tab-notifications .muted{color:#bfd3e3!important}
body.playerTheme #app>.tabs{gap:12px;margin:16px 0}
body.playerTheme #app>.tabs button,body.playerTheme #logoutBtn{background:linear-gradient(#214763,#112c43)!important;color:#e7f4ff!important;border:1px solid #5586ac!important;border-radius:7px!important;min-height:44px}
body.playerTheme #app>.tabs button.active{background:linear-gradient(#147bd0,#074583)!important;border-color:#5cb7ff!important}
body.playerTheme #app>.tabs #btn-profile{background:linear-gradient(#683dc0,#352166)!important}
body.playerTheme #app>.tabs #btn-notifications{background:linear-gradient(#118750,#075030)!important}
body.playerTheme .playerCompetitionOrganizer{background:#0a1d2c;border:1px solid #36536b;padding:10px;gap:12px}
body.playerTheme .playerCompFilter{background:#1a354b!important;color:#d4e7f7!important;border-color:#496985!important;font-size:12px!important;min-height:44px!important}
body.playerTheme .playerCompFilter.active{background:linear-gradient(#147acf,#084478)!important;border-color:#4ba5ed!important;color:white!important}
body.playerTheme .playerCompFilter b{background:#c7e9ff;color:#08304a}
body.playerTheme select,body.playerTheme input,body.playerTheme textarea{background:#0a1b29!important;color:#e8f4ff!important;border:1px solid #527591!important;color-scheme:dark}
body.playerTheme .playerNearestThreeHead{background:linear-gradient(#155386,#0b304f)!important;border-color:#408ac1;padding:12px}
body.playerTheme .playerNearestThreeHead b{font-size:15px}
body.playerTheme .playerNearestThreeBody,body.playerTheme .playerCompMonthBody{background:#091d2b!important;border-color:#365c77!important;padding:10px!important}
body.playerTheme .playerCompMonthGroup{background:#0d2233;border-color:#3c607b}
body.playerTheme .playerCompMonthGroup>summary{background:#17364e;color:#d4eaff;padding:12px}
body.playerTheme .playerCompEmpty{background:#0d2233!important;color:#b9cfe0!important;border-color:#36536b!important;font-weight:500}
body.playerTheme .playerCompDesktopRow,body.playerTheme .playerCompCompactCard{background:linear-gradient(120deg,#18354b,#0e2537)!important;border:1px solid #456e8c!important;border-radius:9px!important;outline:none!important;box-shadow:none!important;color:#eaf4ff!important;margin-bottom:10px!important}
body.playerTheme .playerCompDesktopRow.mine,body.playerTheme .playerCompCompactCard.mine{background:linear-gradient(120deg,#18354b,#0e2537)!important;border-color:#3d8ab1!important;outline:none!important;box-shadow:none!important}
body.playerTheme .playerCompTitle b,body.playerTheme .playerCompDesktopTitle b{color:#fff!important;font-size:18px!important;line-height:1.3!important;white-space:normal!important;overflow-wrap:anywhere!important}
body.playerTheme .playerCompFishery,body.playerTheme .playerCompDesktopTitle span{color:#b9e6ff!important;font-size:21px!important;font-weight:800!important;line-height:1.3!important;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;overflow-wrap:anywhere!important}
body.playerTheme .playerCompDesktopTitle span{margin-top:8px}
body.playerTheme .playerCompDate,body.playerTheme .playerCompDesktopDateBox .playerCompDate{color:#fff!important;font-size:23px!important}
body.playerTheme .playerCompWeekday{background:#265b89!important;border-color:#609fcd!important;font-size:12px!important}
body.playerTheme .playerCompCountdown{background:#ffe9aa!important;color:#44340b!important;border-color:#d6b961!important;font-size:12px!important}
body.playerTheme .playerCompCountdown.today{background:#ffdedb!important;color:#791c16!important}
body.playerTheme .playerCompCountdown.past{background:#cad6df!important;color:#263b4c!important}
body.playerTheme .playerCompNo{background:#0b5184;border:1px solid #4083b2;color:white;min-height:36px}
body.playerTheme .playerCompCountBadge{background:#112b3c;color:#deeffa;border-color:#528098;padding:7px 9px}
body.playerTheme .playerCompCountBadge small{color:#b5d3e4;font-size:9px}
body.playerTheme .playerCompCountBadge b{color:white;font-size:16px}
body.playerTheme .playerCompMineBadge{background:#bceacc;color:#075329;font-size:11px;padding:7px 9px}
body.playerTheme .playerCompStatus{font-size:11px;padding:7px 9px;min-height:30px}
body.playerTheme .playerCompCompactActions{grid-template-columns:1fr!important;gap:22px!important;width:100%;margin:0!important}
body.playerTheme .playerCompCompactActions button{min-height:48px!important;padding:10px 12px!important;font-size:15px!important;font-weight:700!important;border-radius:7px!important;background:linear-gradient(#167dca,#084579)!important;color:#fff!important;border:1px solid #61b0e6!important;white-space:normal!important;line-height:1.25!important}
body.playerTheme .playerCompCompactActions button.warn{background:#351b29!important;color:#ffd8dd!important;border:2px solid #eb637b!important}
body.playerTheme .playerCompCompactActions button:disabled{opacity:.65!important;background:#273b49!important;border-color:#708493!important;cursor:not-allowed}
body.playerTheme button:focus-visible{outline:3px solid #ffd12a!important;outline-offset:3px!important}
body.playerTheme #tab-profile label{color:#d3e9fa}
body.playerTheme .playerView{border-color:#36536b}
@media(min-width:761px){
 body.playerTheme .playerCompetitionDesktopOnly{overflow:visible!important}
 body.playerTheme .playerCompDesktopRow{min-width:0!important;grid-template-columns:54px minmax(0,1fr) minmax(150px,.6fr) 205px!important;grid-template-rows:auto auto auto!important;gap:10px 18px!important;padding:18px!important;align-items:center!important}
 body.playerTheme .playerCompDesktopRow>.playerCompNo{grid-column:1;grid-row:1/4}
 body.playerTheme .playerCompDesktopRow>.playerCompDesktopTitle{grid-column:2;grid-row:1/3}
 body.playerTheme .playerCompDesktopRow>.playerCompDesktopDate{grid-column:3;grid-row:1/3}
 body.playerTheme .playerCompDesktopRow>.playerCompDesktopCount{grid-column:2;grid-row:3;justify-content:flex-start!important}
 body.playerTheme .playerCompDesktopRow>div:nth-child(5){grid-column:3;grid-row:3}
 body.playerTheme .playerCompDesktopRow>.playerCompStatus{grid-column:4;grid-row:1;justify-self:end!important}
 body.playerTheme .playerCompDesktopRow>.playerCompCompactActions{grid-column:4;grid-row:2/4}
 body.playerTheme .playerCompDesktopDateTop{display:flex!important;flex-wrap:wrap!important;gap:8px!important}
 body.playerTheme .playerCompDesktopDateBox{gap:12px!important}
}
@media(min-width:761px) and (max-width:1000px){
 body.playerTheme .playerCompDesktopRow{grid-template-columns:44px minmax(0,1fr) 150px!important;gap:12px!important}
 body.playerTheme .playerCompDesktopRow>.playerCompNo{grid-row:1}
 body.playerTheme .playerCompDesktopRow>.playerCompDesktopTitle{grid-column:2/4;grid-row:1}
 body.playerTheme .playerCompDesktopRow>.playerCompDesktopDate{grid-column:1/3;grid-row:2}
 body.playerTheme .playerCompDesktopRow>.playerCompStatus{grid-column:3;grid-row:2}
 body.playerTheme .playerCompDesktopRow>.playerCompDesktopCount{grid-column:1/3;grid-row:3}
 body.playerTheme .playerCompDesktopRow>div:nth-child(5){grid-column:3;grid-row:3}
 body.playerTheme .playerCompDesktopRow>.playerCompCompactActions{grid-column:1/4;grid-row:4;grid-template-columns:1fr 1fr!important;gap:28px!important}
}
@media(max-width:760px){
 body.playerTheme main{padding:10px!important}
 body.playerTheme header h1{font-size:19px!important}
 body.playerTheme #tab-competitions>.card{padding:10px!important}
 body.playerTheme .playerNearestThreeHead{padding:10px!important}
 body.playerTheme .playerNearestThreeHead b{font-size:12px}
 body.playerTheme .playerNearestThreeBody{padding:7px!important}
 body.playerTheme .playerCompCompactCard{padding:12px!important}
 body.playerTheme .playerCompCompactTop{grid-template-columns:46px minmax(0,1fr)!important;gap:10px!important;align-items:start!important}
 body.playerTheme .playerCompCompactTop>.playerCompNo{grid-column:1;grid-row:1}
 body.playerTheme .playerCompCompactTop>.playerCompTitle{grid-column:1/3;grid-row:2}
 body.playerTheme .playerCompCompactTop>.playerCompStatus{grid-column:2;grid-row:1;justify-self:end}
 body.playerTheme .playerCompTitle b{font-size:18px!important}
 body.playerTheme .playerCompDateLine{flex-wrap:wrap!important;gap:9px!important;margin-top:12px!important}
 body.playerTheme .playerCompSubLine{display:flex!important;flex-direction:column!important;align-items:flex-start!important;gap:10px!important;margin-top:10px!important}
 body.playerTheme .playerCompFishery{font-size:21px!important;flex:none!important}
 body.playerTheme .playerCompCompactBottom{grid-template-columns:1fr!important;gap:16px!important;margin-top:15px!important}
 body.playerTheme .playerCompMiniInfo{flex-wrap:wrap!important;gap:8px!important}
 body.playerTheme .playerCompCompactActions{gap:24px!important}
 body.playerTheme .playerCompCompactActions button{min-height:50px!important;font-size:16px!important}
 body.playerTheme .playerCompFilter{font-size:10px!important;gap:4px!important}
 body.playerTheme #app>.tabs{display:flex;flex-wrap:wrap;gap:9px}
 body.playerTheme #app>.tabs button{font-size:13px!important;padding:9px!important}
}
.playerView .playerOwnSummaryBank{display:block;margin-top:5px;font-size:11px;font-weight:1000;letter-spacing:.03em;text-transform:uppercase;color:#143c37!important}
.adminSetupGate{border:1px solid #c5d2c8;border-radius:12px;background:#f6f9f5;padding:0;align-self:start}
.adminSetupGate>summary{cursor:pointer;list-style:none;padding:13px 14px;font-weight:900;color:#3c5b4a}
.adminSetupGate>summary::-webkit-details-marker{display:none}
.adminSetupGate>summary:before{content:'＋';display:inline-block;margin-right:7px;font-size:16px}
.adminSetupGate[open]>summary:before{content:'−'}
.adminSetupCard{margin:0;border:0;border-top:1px solid #d4ded6;border-radius:0 0 12px 12px;box-shadow:none}
.playerRegisterCard{border-color:#93cbb0;box-shadow:0 3px 12px #1b6a3b18}
.playerDrawViewSwitch{display:flex;justify-content:flex-end;gap:5px;margin:0 0 7px}
.playerDrawViewSwitch button{width:auto!important;min-width:74px!important;min-height:30px!important;padding:5px 10px!important;border-radius:999px!important;background:#17384d!important;border:1px solid #4b7895!important;color:#bfe3f7!important;font-size:10px!important;font-weight:1000!important}
.playerDrawViewSwitch button.active{background:#1987c6!important;border-color:#b7e9ff!important;color:#fff!important;box-shadow:0 0 7px #43bff466!important}
.playerBottomNav{display:none}
@media(max-width:760px){
 body.playerTheme main{padding-bottom:78px!important}
 .playerBottomNav{display:grid;position:fixed;left:0;right:0;bottom:0;z-index:5300;grid-template-columns:repeat(6,minmax(0,1fr));gap:0;padding:5px max(6px,env(safe-area-inset-left)) calc(5px + env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-right));background:#071522f2;border-top:1px solid #3d6077;box-shadow:0 -4px 16px #0008;backdrop-filter:blur(8px)}
 .playerBottomNav button{width:100%;min-height:38px;padding:4px 0;border:0;border-radius:6px;background:transparent;color:#b9d8eb;font-size:23px;line-height:1;font-weight:700}
 .playerBottomNav button:active,.playerBottomNav button:focus-visible{background:#1d5c84;color:#fff}
 .playerView .playerOwnSummaryBank{font-size:9px;margin-top:4px}
}
/* V71 compact front: three upcoming competitions should fit on a phone screen. */
@media(max-width:760px){
 body.playerTheme main{padding:5px 5px 76px!important}
 body.playerTheme #tab-competitions>.card{padding:6px!important;margin:5px 0!important}
 body.playerTheme .playerNearestThree{margin:4px 0 6px!important}
 body.playerTheme .playerNearestThreeHead{padding:6px 8px!important;border-radius:7px 7px 0 0!important}
 body.playerTheme .playerNearestThreeHead b{font-size:11px!important}
 body.playerTheme .playerNearestThreeHead span{font-size:8px!important}
 body.playerTheme .playerNearestThreeBody{padding:4px!important;border-radius:0 0 7px 7px!important}
 body.playerTheme .playerCompCompactCard{padding:5px 6px!important;margin:0 0 4px!important;border-radius:6px!important}
 body.playerTheme .playerCompCompactTop{grid-template-columns:32px minmax(0,1fr) auto!important;gap:5px!important;align-items:center!important}
 body.playerTheme .playerCompCompactTop>.playerCompNo{grid-column:1!important;grid-row:1!important}
 body.playerTheme .playerCompCompactTop>.playerCompTitle{grid-column:2!important;grid-row:1!important}
 body.playerTheme .playerCompCompactTop>.playerCompStatus{grid-column:3!important;grid-row:1!important;justify-self:end!important}
 body.playerTheme .playerCompNo{min-width:32px!important;height:24px!important;min-height:24px!important;font-size:10px!important;border-radius:5px!important}
 body.playerTheme .playerCompTitle b{font-size:12px!important;line-height:1.05!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
 body.playerTheme .playerCompDateLine{display:flex!important;align-items:center!important;gap:5px!important;margin-top:2px!important;flex-wrap:nowrap!important}
 body.playerTheme .playerCompDate{font-size:14px!important;line-height:1!important;white-space:nowrap!important}
 body.playerTheme .playerCompWeekday{font-size:8px!important;line-height:1!important;min-height:18px!important;padding:3px 5px!important;white-space:nowrap!important}
 body.playerTheme .playerCompSubLine{display:flex!important;align-items:center!important;gap:5px!important;margin-top:2px!important;min-width:0!important;flex-direction:row!important}
 body.playerTheme .playerCompFishery{font-size:9px!important;line-height:1!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;flex:1 1 auto!important}
 body.playerTheme .playerCompCountdown{font-size:8px!important;line-height:1!important;min-height:18px!important;padding:3px 5px!important;white-space:nowrap!important;flex:none!important}
 body.playerTheme .playerCompStatus{font-size:8px!important;min-height:20px!important;padding:3px 5px!important;border-radius:5px!important}
 body.playerTheme .playerCompCompactBottom{grid-template-columns:minmax(0,1fr) minmax(150px,1.35fr)!important;gap:5px!important;margin-top:4px!important;align-items:center!important}
 body.playerTheme .playerCompMiniInfo{gap:3px!important;min-height:22px!important;overflow:hidden!important}
 body.playerTheme .playerCompCountBadge{padding:3px 5px!important;border-radius:5px!important;line-height:1!important}
 body.playerTheme .playerCompCountBadge small{font-size:7px!important}
 body.playerTheme .playerCompCountBadge b{font-size:11px!important}
 body.playerTheme .playerCompMineBadge{font-size:8px!important;padding:3px 5px!important}
 body.playerTheme .playerCompCompactActions{grid-template-columns:1fr 1fr!important;gap:4px!important;width:auto!important}
 body.playerTheme .playerCompCompactActions button{min-height:27px!important;height:27px!important;padding:3px 4px!important;font-size:8.5px!important;border-radius:5px!important;line-height:1.05!important;white-space:nowrap!important}
 body.playerTheme .playerCompMonthGroup>summary{padding:6px 8px!important;font-size:10px!important}
 body.playerTheme .playerCompMonthBody{padding:4px!important}
}
@media(max-width:360px){
 body.playerTheme .playerCompCompactBottom{grid-template-columns:minmax(0,1fr) minmax(136px,1.25fr)!important}
 body.playerTheme .playerCompCompactActions button{font-size:8px!important;padding-left:2px!important;padding-right:2px!important}
}
/* V71 top-to-bottom mobile density: reclaim the header and navigation space too. */
@media(max-width:760px){
 body.playerTheme header{padding:6px 8px!important;min-height:0!important}
 body.playerTheme header .row{gap:6px!important}
 body.playerTheme header h1{font-size:15px!important;line-height:1.05!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
 body.playerTheme header .top-actions button{font-size:10px!important;padding:5px 7px!important;border-radius:6px!important}
 body.playerTheme main{padding:2px 4px 72px!important}
 body.playerTheme #app>.compactUserBar{margin:3px 0!important;padding:4px 6px!important;border-radius:7px!important}
 body.playerTheme #app>.compactUserBar .adminbar{grid-template-columns:minmax(0,1fr) auto auto!important;gap:5px!important;align-items:center!important}
 body.playerTheme #app>.compactUserBar #who{font-size:11px!important;line-height:1.05!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;display:block!important}
 body.playerTheme #app>.compactUserBar #role{font-size:8px!important;line-height:1!important}
 body.playerTheme #app>.compactUserBar #notifCounter{font-size:9px!important;white-space:nowrap!important}
 body.playerTheme #app>.compactUserBar .tag{font-size:8px!important;padding:2px 4px!important}
 body.playerTheme #app>.tabs{padding:2px 0!important;gap:4px!important;flex-wrap:nowrap!important;overflow:hidden!important}
 body.playerTheme #app>.tabs button{min-height:28px!important;height:28px!important;padding:4px 6px!important;font-size:9px!important;border-radius:5px!important;white-space:nowrap!important}
 body.playerTheme #tab-competitions>.card{margin:3px 0!important;padding:4px!important;border-radius:7px!important}
 body.playerTheme #tab-competitions>.card>h2{font-size:13px!important;margin:1px 2px 4px!important}
 body.playerTheme .playerCompetitionOrganizer{grid-template-columns:1fr!important;gap:3px!important;margin:0 0 4px!important;padding:4px!important;border-radius:6px!important}
 body.playerTheme .playerCompFilters{gap:3px!important;min-width:0!important}
 body.playerTheme .playerCompFilter{min-height:27px!important;height:27px!important;padding:2px 1px!important;font-size:8px!important;border-radius:5px!important;line-height:1!important;white-space:nowrap!important}
 body.playerTheme .playerCompFilter b{min-width:16px!important;width:16px!important;height:16px!important;font-size:8px!important}
 body.playerTheme .playerCompMonthSelect{grid-column:1/-1!important;height:25px!important;min-height:25px!important;padding:2px 5px!important;font-size:9px!important;border-radius:5px!important}
 body.playerTheme .playerCompGroups{gap:3px!important}
 body.playerTheme .playerCompMonthGroup{border-radius:6px!important}
 body.playerTheme .playerCompMonthGroup>summary{padding:4px 6px!important;font-size:9px!important}
 body.playerTheme .playerCompMonthBody{padding:2px!important}
 body.playerTheme .playerNearestThree{margin:2px 0 4px!important}
 body.playerTheme .playerNearestThreeHead{padding:4px 6px!important}
 body.playerTheme .playerNearestThreeHead b{font-size:9px!important}
 body.playerTheme .playerNearestThreeHead span{font-size:7px!important}
 body.playerTheme .playerNearestThreeBody{padding:2px!important}
}
.appVersionBadge{display:inline-flex!important;align-items:center;justify-content:center;padding:4px 9px!important;border-radius:999px!important;background:#ffd34d!important;color:#102536!important;border:1px solid #fff1a6!important;font-size:11px!important;font-weight:1000!important;letter-spacing:.03em!important;line-height:1!important;white-space:nowrap!important;box-shadow:0 1px 3px #0005!important}
@media(max-width:760px){body.playerTheme #app>.compactUserBar .appVersionBadge{font-size:9px!important;padding:3px 6px!important;letter-spacing:0!important}}
.headerVersion{display:inline-block;margin-left:6px;padding:2px 6px;border:1px solid #8fd9ff;background:#0b4262;color:#dff6ff;border-radius:5px;font-size:10px;vertical-align:middle;letter-spacing:.04em}
@media(max-width:760px){header .headerVersion{margin-left:3px;padding:1px 4px;font-size:8px}}
@media(max-width:760px){
 .playerView .playerUnifiedNav .playerResultsNavInline button:nth-child(3),
 .playerView .playerUnifiedNav .playerResultsNavInline button:nth-child(4){grid-column:1/-1!important;width:100%!important;min-height:50px!important;padding:6px 8px!important}
}
@keyframes playerNewResultPulse{0%,100%{transform:scale(1);filter:drop-shadow(0 0 2px #fff)}50%{transform:scale(1.22);filter:drop-shadow(0 0 7px #ffe600)}}
.playerView .playerNewResultStar{position:absolute;top:3px;right:7px;z-index:2;color:#ffe600!important;font-size:23px!important;line-height:1!important;font-weight:1000!important;text-shadow:0 0 2px #071723,0 0 6px #fff!important;animation:playerNewResultPulse 1.15s ease-in-out infinite;pointer-events:none}
@media(max-width:760px){
 body.playerTheme main{padding-top:4px!important}
 body.playerTheme header{padding:3px 6px!important}
 body.playerTheme header h1{font-size:13px!important;line-height:1!important}
 body.playerTheme header .top-actions button{min-height:34px!important;padding:3px 6px!important;font-size:9px!important}
 body.playerTheme #app>.compactUserBar{margin:2px 0!important;padding:3px 5px!important}
 body.playerTheme #app>.compactUserBar .adminbar{gap:3px!important}
 body.playerTheme #app>.compactUserBar #who{font-size:10px!important;line-height:1!important}
 body.playerTheme #app>.compactUserBar #role{font-size:7px!important;line-height:1!important}
 body.playerTheme #app>.compactUserBar #notifCounter{font-size:8px!important}
 body.playerTheme #app>.tabs{margin:4px 0!important;padding:1px 0!important;gap:4px!important}
 body.playerTheme #app>.tabs button{min-height:34px!important;padding:5px 7px!important;font-size:11px!important}
 .playerView .playerUnifiedNav .playerResultsNavInline button:nth-child(1),
 .playerView .playerUnifiedNav .playerResultsNavInline button:nth-child(2){grid-column:1/-1!important;width:100%!important;min-height:42px!important;padding:5px 25px 5px 8px!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:6px!important}
 .playerView .playerUnifiedNav .playerResultsNavInline button:nth-child(1):before,
 .playerView .playerUnifiedNav .playerResultsNavInline button:nth-child(2):before{display:inline-block!important;width:18px!important;height:18px!important;margin:0!important;flex:0 0 18px!important}
 .playerView .playerNewResultStar{top:2px;right:8px;font-size:21px!important}
}

/* V71 — desktop player detail header compacted into one line.
   Layout only: no logic, buttons, results or mobile view changed. */
@media (min-width:761px){
  .competitionDetailHead.playerDetailHead{
    display:grid!important;
    grid-template-columns:auto minmax(220px,1fr) auto!important;
    align-items:center!important;
    column-gap:12px!important;
    row-gap:0!important;
    padding:7px 10px!important;
    margin-top:6px!important;
    min-height:0!important;
  }
  .competitionDetailHead.playerDetailHead .inlineBtns{
    display:flex!important;
    flex-wrap:nowrap!important;
    gap:6px!important;
    margin:0!important;
    width:auto!important;
  }
  .competitionDetailHead.playerDetailHead .inlineBtns button{
    width:auto!important;
    min-width:0!important;
    min-height:34px!important;
    padding:6px 10px!important;
    margin:0!important;
    white-space:nowrap!important;
    font-size:12px!important;
    line-height:1!important;
  }
  .competitionDetailHead.playerDetailHead h2{
    margin:0!important;
    min-width:0!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
    white-space:nowrap!important;
    font-size:17px!important;
    line-height:1.1!important;
  }
  .competitionDetailHead.playerDetailHead p{
    margin:0!important;
    white-space:nowrap!important;
    font-size:13px!important;
    line-height:1.1!important;
    font-weight:800!important;
  }
}



/* V72 — kompaktowy pasek zawodnika: 4 główne kafle + GENERAL/STATYSTYKI jeden nad drugim w 5. kolumnie. */
.playerView .playerPrimaryNav,
.playerView .playerDesktopPrimaryNav{
  display:grid!important;
  grid-template-columns:repeat(5,minmax(0,1fr))!important;
  gap:5px!important;
  align-items:stretch!important;
  margin:0 0 5px!important;
}
.playerView .playerPrimaryNav>button,
.playerView .playerDesktopPrimaryNav>button{
  position:relative!important;
  min-width:0!important;
  width:100%!important;
  min-height:66px!important;
  height:66px!important;
  padding:5px 2px!important;
  margin:0!important;
  border-radius:8px!important;
  font-size:9.5px!important;
  font-weight:1000!important;
  line-height:1.08!important;
  white-space:normal!important;
  overflow:hidden!important;
}
.playerView .playerPrimaryStack{
  display:grid!important;
  grid-template-rows:1fr 1fr!important;
  gap:4px!important;
  min-width:0!important;
  height:66px!important;
}
.playerView .playerPrimaryStack>button{
  position:relative!important;
  min-width:0!important;
  width:100%!important;
  min-height:0!important;
  height:auto!important;
  padding:2px 1px!important;
  margin:0!important;
  border-radius:7px!important;
  font-size:7.6px!important;
  line-height:1!important;
  font-weight:1000!important;
  white-space:nowrap!important;
  overflow:hidden!important;
}
.playerView .playerPrimaryNav .drawTile,
.playerView .playerDesktopPrimaryNav .drawTile{background:linear-gradient(#1684e6,#06468f)!important;border-color:#3aa5ff!important;color:#fff!important}
.playerView .playerPrimaryNav .resultTile,
.playerView .playerDesktopPrimaryNav .resultTile{background:linear-gradient(#249b43,#07562e)!important;border-color:#49c76b!important;color:#fff!important}
.playerView .playerPrimaryStack .generalTile,
.playerView .playerPrimaryStack .statsTile{background:linear-gradient(#7d43df,#38217d)!important;border-color:#9c72ff!important;color:#fff!important}
.playerView .playerPrimaryNav>button.active,
.playerView .playerDesktopPrimaryNav>button.active,
.playerView .playerPrimaryStack>button.active{outline:2px solid #f5cf36!important;outline-offset:1px!important;box-shadow:0 0 0 1px #fff8 inset!important}

/* ikony jak w poprzednim kompaktowym układzie */
.playerView .playerPrimaryNav>button:before,
.playerView .playerDesktopPrimaryNav>button:before{
  content:'';display:block;width:20px;height:20px;margin:0 auto 4px;background:currentColor;
  mask:var(--nav-icon) center/contain no-repeat;-webkit-mask:var(--nav-icon) center/contain no-repeat
}
.playerView .playerPrimaryStack>button:before{
  content:'';display:inline-block;width:12px;height:12px;margin:0 3px -2px 0;background:currentColor;
  mask:var(--nav-icon) center/contain no-repeat;-webkit-mask:var(--nav-icon) center/contain no-repeat
}
.playerView .playerPrimaryNav .drawTile,
.playerView .playerDesktopPrimaryNav .drawTile{--nav-icon:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%222%22%3E%3Crect%20x%3D%224%22%20y%3D%224%22%20width%3D%2216%22%20height%3D%2216%22%20rx%3D%223%22%2F%3E%3Ccircle%20cx%3D%229%22%20cy%3D%229%22%20r%3D%221%22%2F%3E%3Ccircle%20cx%3D%2215%22%20cy%3D%229%22%20r%3D%221%22%2F%3E%3Ccircle%20cx%3D%229%22%20cy%3D%2215%22%20r%3D%221%22%2F%3E%3Ccircle%20cx%3D%2215%22%20cy%3D%2215%22%20r%3D%221%22%2F%3E%3C%2Fsvg%3E")}
.playerView .playerPrimaryNav .resultTile,
.playerView .playerDesktopPrimaryNav .resultTile{--nav-icon:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M8%203h8v7a4%204%200%200%201-8%200V3ZM8%205H4v3a4%204%200%200%200%204%204m8-7h4v3a4%204%200%200%201-4%204m-4%202v6m-4%201h8%22%2F%3E%3C%2Fsvg%3E")}
.playerView .playerPrimaryStack .generalTile{--nav-icon:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22M5%2020V11h3v9zm6%200V4h3v16zm6%200V8h3v12z%22%2F%3E%3C%2Fsvg%3E")}
.playerView .playerPrimaryStack .statsTile{--nav-icon:url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22white%22%20stroke-width%3D%222%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m3%2016%206-6%204%203%207-9m-6%200h6v6M4%2021h17%22%2F%3E%3C%2Fsvg%3E")}

/* Uzgodniony znacznik nowych treści: pulsująca kontrastowa gwiazdka, znika po wejściu w dany kafel. */
.playerView .playerPrimaryNav .playerNewResultStar,
.playerView .playerDesktopPrimaryNav .playerNewResultStar{
  top:2px!important;right:4px!important;font-size:17px!important;line-height:1!important;color:#ffe600!important;
  text-shadow:0 0 2px #061621,0 0 6px #fff!important;z-index:5!important
}
.playerView .playerPrimaryStack .playerNewResultStar{font-size:13px!important;top:1px!important;right:3px!important}

@media(min-width:761px){
  .playerView .playerDesktopPrimaryNav{gap:7px!important;margin-bottom:7px!important}
  .playerView .playerDesktopPrimaryNav>button{height:72px!important;min-height:72px!important;font-size:12px!important;padding:7px 5px!important}
  .playerView .playerDesktopPrimaryNav>button:before{width:23px;height:23px;margin-bottom:5px}
  .playerView .playerDesktopPrimaryNav .playerPrimaryStack{height:72px!important;gap:5px!important}
  .playerView .playerDesktopPrimaryNav .playerPrimaryStack>button{font-size:9px!important}
}
@media(max-width:760px){
  .playerView .playerUnifiedNav{padding:4px!important}
  .playerView .playerPrimaryNav{gap:3px!important;margin-bottom:4px!important}
  .playerView .playerPrimaryNav>button{height:64px!important;min-height:64px!important;font-size:8.8px!important;padding:4px 1px!important;border-radius:7px!important}
  .playerView .playerPrimaryNav>button:before{width:19px;height:19px;margin-bottom:4px}
  .playerView .playerPrimaryStack{height:64px!important;gap:3px!important}
  .playerView .playerPrimaryStack>button{font-size:7px!important;border-radius:6px!important}
  .playerView .playerPrimaryStack>button:before{width:10px;height:10px;margin-right:2px}
  .playerView .playerMapNav{margin-top:0!important}
}
@media(max-width:360px){
  .playerView .playerPrimaryNav>button{font-size:8px!important}
  .playerView .playerPrimaryStack>button{font-size:6.4px!important}
}



/* V73 — stabilna aplikacja z ekranu głównego + brak cofania do logowania przy odświeżeniu. */
html,body{overscroll-behavior-y:auto!important}
html.hasSavedSession #auth{display:none!important}
.brandIcon{width:34px;height:34px;border-radius:9px;object-fit:cover;vertical-align:middle;margin-right:8px;box-shadow:0 0 0 1px #59c9ff66,0 2px 8px #0008}
header h1{display:flex;align-items:center;min-width:0}
body.playerTheme .appVersionBadge{background:#ffd34d!important;color:#102536!important}
.playerView .playerNewResultStar,
.playerView .playerPrimaryNav .playerNewResultStar,
.playerView .playerDesktopPrimaryNav .playerNewResultStar,
.playerView .playerPrimaryStack .playerNewResultStar{
  display:flex!important;align-items:center!important;justify-content:center!important;
  width:20px!important;height:20px!important;border-radius:50%!important;
  background:#ef3038!important;color:#fff!important;border:2px solid #fff!important;
  font-size:12px!important;line-height:1!important;text-shadow:none!important;
  box-shadow:0 2px 7px #0008!important;top:-5px!important;right:-5px!important;
}
@media(max-width:760px){
  .brandIcon{width:27px;height:27px;border-radius:7px;margin-right:5px}
  body.playerTheme header h1{display:flex!important;align-items:center!important;font-size:15px!important}
  .playerView .playerPrimaryStack .playerNewResultStar{width:17px!important;height:17px!important;font-size:10px!important;top:-4px!important;right:-4px!important}
}



/* V74 — mobilne przewijanie: dokument ma jeden naturalny pionowy scroll.
   Nie blokujemy gestu palca ani overscroll na html/body. */
html{
  height:auto!important;
  min-height:100%!important;
  overflow-x:hidden!important;
  overflow-y:auto!important;
  overscroll-behavior-y:auto!important;
  -webkit-overflow-scrolling:touch;
}
body{
  height:auto!important;
  min-height:100vh!important;
  max-height:none!important;
  overflow-x:hidden!important;
  overflow-y:visible!important;
  overscroll-behavior-y:auto!important;
}
@media(max-width:760px){
  body,body.playerTheme{
    height:auto!important;
    min-height:100dvh!important;
    max-height:none!important;
    overflow-y:visible!important;
    overscroll-behavior-y:auto!important;
  }
  body.playerTheme main,
  body.playerTheme #app,
  body.playerTheme #tab-competitions,
  body.playerTheme #tab-notifications,
  body.playerTheme #tab-profile,
  body.playerTheme #competitionDetail,
  body.playerTheme .playerView,
  body.playerTheme .playerMobileDashboard,
  body.playerTheme .playerMobileSelectedPanel{
    height:auto!important;
    min-height:0!important;
    max-height:none!important;
    overflow-y:visible!important;
  }
  /* poziome elementy nadal mogą przewijać się własnym torem */
  body.playerTheme .tablewrap,
  body.playerTheme .sectorMap,
  body.playerTheme .playerMobileFullMapViewport{
    -webkit-overflow-scrolling:touch!important;
  }
}

/* V74 — powiadomienia zawodnika w tej samej ciemnej stylistyce co reszta panelu. */
body.playerTheme #tab-notifications>.card{
  background:#0b1d2b!important;
  border-color:#31536a!important;
  color:#eef8ff!important;
}
body.playerTheme #tab-notifications h2{color:#fff!important}
body.playerTheme #tab-notifications .notificationBulkActions button{min-height:36px!important}
body.playerTheme #tab-notifications .notificationTable{background:transparent!important}
body.playerTheme #tab-notifications .notificationTable th{
  background:#14354a!important;color:#dff3ff!important;border-color:#31536a!important;
}
body.playerTheme #tab-notifications .notificationTable tr{
  background:#102838!important;border-color:#31536a!important;color:#eef8ff!important;
}
body.playerTheme #tab-notifications .notificationTable tr.mine{
  background:#17364b!important;
  box-shadow:inset 4px 0 0 #ffbf3b!important;
  outline:none!important;
}
body.playerTheme #tab-notifications .notificationTable td{
  color:#eef8ff!important;border-color:#2f4c60!important;background:transparent!important;
}
body.playerTheme #tab-notifications .notificationTable td b{color:#fff!important}
body.playerTheme #tab-notifications .notificationTable .small{color:#9fc1d5!important}
body.playerTheme #tab-notifications .notificationTable button{width:auto!important;min-width:58px!important;padding:6px 10px!important}
@media(max-width:760px){
  body.playerTheme #tab-notifications>.card{padding:7px!important;margin:4px 0!important}
  body.playerTheme #tab-notifications .notificationTable tr{margin:5px 0!important;border-radius:8px!important}
  body.playerTheme #tab-notifications .notificationTable td{padding:7px!important;font-size:11px!important}
  body.playerTheme #tab-notifications .notificationTable td b{font-size:12px!important}
}



/* V75/V76 — stabilne przewijanie + poprawka desktopowych wyników T1/T2 bez rozjeżdżania szerokości. */
html{
  width:100%!important;
  min-height:100%!important;
  overflow-x:hidden!important;
  overflow-y:auto!important;
  touch-action:pan-y pinch-zoom!important;
  -webkit-overflow-scrolling:touch!important;
}
body{
  position:static!important;
  width:100%!important;
  min-height:100%!important;
  max-width:100%!important;
  max-height:none!important;
  overflow-x:hidden!important;
  overflow-y:visible!important;
  touch-action:pan-y pinch-zoom!important;
}
@media(max-width:760px){
  body,body.playerTheme,body.playerTheme main,body.playerTheme #app,
  body.playerTheme #competitionDetail,body.playerTheme .playerView,
  body.playerTheme .playerMobileDashboard,body.playerTheme .playerMobileSelectedPanel,
  body.playerTheme #playerMobilePanelContent{
    position:static!important;
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    height:auto!important;
    min-height:0!important;
    max-height:none!important;
    overflow-x:hidden!important;
    overflow-y:visible!important;
    touch-action:pan-y pinch-zoom!important;
  }

  /* główny pasek pozostaje w niezmienionym kompaktowym układzie 5 kolumn */
  .playerView .playerPrimaryNav{
    display:grid!important;
    grid-template-columns:repeat(5,minmax(0,1fr))!important;
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
  }
  .playerView .playerPrimaryNav>button,
  .playerView .playerPrimaryStack{
    min-width:0!important;
    max-width:100%!important;
  }

  /* T1/T2 — żaden element wyniku nie może poszerzyć dokumentu */
  .playerMobileSelectedPanel,
  .playerMobileSelectedPanel .playerResultCard,
  .playerMobileSelectedPanel .card,
  .playerMobileSelectedPanel .playerNoScroll,
  .playerMobileSelectedPanel .tablewrap{
    box-sizing:border-box!important;
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
  }
  .playerMobileSelectedPanel .playerResultCard{
    overflow:hidden!important;
  }
  .playerMobileSelectedPanel .tablewrap{
    overflow-x:hidden!important;
    overflow-y:visible!important;
  }
  .playerMobileSelectedPanel .sharpTable{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    table-layout:fixed!important;
  }
  .playerMobileSelectedPanel .sharpTable th,
  .playerMobileSelectedPanel .sharpTable td{
    min-width:0!important;
    max-width:none!important;
    white-space:normal!important;
    overflow:hidden!important;
    overflow-wrap:anywhere!important;
    word-break:normal!important;
  }

  /* sektorowe wyniki T1/T2: stałe, małe kolumny i elastyczne nazwisko */
  .playerMobileSelectedPanel .tablewrap .sharpTable th:nth-child(1),
  .playerMobileSelectedPanel .tablewrap .sharpTable td:nth-child(1){width:34px!important;padding-left:2px!important;padding-right:2px!important}
  .playerMobileSelectedPanel .tablewrap .sharpTable th:nth-child(2),
  .playerMobileSelectedPanel .tablewrap .sharpTable td:nth-child(2){width:38px!important;padding-left:2px!important;padding-right:2px!important}
  .playerMobileSelectedPanel .tablewrap .sharpTable th:nth-child(4),
  .playerMobileSelectedPanel .tablewrap .sharpTable td:nth-child(4){width:72px!important;padding-left:2px!important;padding-right:2px!important;white-space:nowrap!important}
  .playerMobileSelectedPanel .tablewrap .sharpTable th:nth-child(3),
  .playerMobileSelectedPanel .tablewrap .sharpTable td:nth-child(3){width:auto!important}
  .playerMobileSelectedPanel .tablewrap .sharpTable th{font-size:8px!important;line-height:1!important}
  .playerMobileSelectedPanel .tablewrap .sharpTable td{font-size:9.6px!important;line-height:1.08!important;padding-top:4px!important;padding-bottom:4px!important}

  /* Cała Tura 1 / 2 zachowuje własne kolumny z renderPlayerRoundCompact */
  .playerMobileSelectedPanel .playerCompactRoundTable .pcLp{width:25px!important}
  .playerMobileSelectedPanel .playerCompactRoundTable .pcPos{width:48px!important}
  .playerMobileSelectedPanel .playerCompactRoundTable .pcPlace{width:31px!important}
  .playerMobileSelectedPanel .playerCompactRoundTable .pcWeight{width:70px!important;white-space:nowrap!important}
  .playerMobileSelectedPanel .playerCompactRoundTable .pcName{width:auto!important}

  /* poziome przewijanie tylko tam, gdzie jest świadomie potrzebne (pełna mapa) */
  .playerMobileFullMapViewport,.sectorMap{
    touch-action:pan-x pan-y pinch-zoom!important;
  }
}


/* V76 — zawodnik desktop: Wyniki T1/T2 nie mogą rozszerzać strony ani wypychać menu poza ekran. */
@media(min-width:761px){
  body.playerTheme,body.playerTheme main,body.playerTheme #app,body.playerTheme #competitionDetail,body.playerTheme .playerView,body.playerTheme .playerDesktopDashboardV55,body.playerTheme #playerDesktopPanelContent{
    width:100%!important;max-width:100%!important;overflow-x:hidden!important;
  }
  .playerDesktopSelectedPanel,.playerDesktopSelectedPanel .playerResultCard,.playerDesktopSelectedPanel .card{
    box-sizing:border-box!important;width:100%!important;max-width:100%!important;min-width:0!important;overflow:hidden!important;
  }
  .playerDesktopSelectedPanel .tablewrap{
    box-sizing:border-box!important;display:block!important;width:100%!important;max-width:100%!important;min-width:0!important;overflow-x:auto!important;overflow-y:visible!important;
  }
  .playerDesktopSelectedPanel .sharpTable,.playerDesktopSelectedPanel .roundClassTable{
    width:100%!important;max-width:100%!important;min-width:0!important;table-layout:fixed!important;
  }
  .playerDesktopSelectedPanel .sharpTable th,.playerDesktopSelectedPanel .sharpTable td,.playerDesktopSelectedPanel .roundClassTable th,.playerDesktopSelectedPanel .roundClassTable td{
    min-width:0!important;white-space:normal!important;overflow-wrap:anywhere!important;word-break:normal!important;
  }
  .playerDesktopSelectedPanel .roundClassTable th:nth-child(1),.playerDesktopSelectedPanel .roundClassTable td:nth-child(1){width:42px!important}
  .playerDesktopSelectedPanel .roundClassTable th:nth-child(3),.playerDesktopSelectedPanel .roundClassTable td:nth-child(3){width:62px!important}
  .playerDesktopSelectedPanel .roundClassTable th:nth-child(4),.playerDesktopSelectedPanel .roundClassTable td:nth-child(4){width:74px!important}
  .playerDesktopSelectedPanel .roundClassTable th:nth-child(5),.playerDesktopSelectedPanel .roundClassTable td:nth-child(5){width:78px!important}
  .playerDesktopSelectedPanel .roundClassTable th:nth-child(6),.playerDesktopSelectedPanel .roundClassTable td:nth-child(6){width:118px!important;white-space:nowrap!important}
  .playerDesktopSelectedPanel .roundClassTable td:nth-child(2){font-size:13px!important}
  .playerDesktopUnifiedNav,.playerDesktopUnifiedNav.fixedPlayerBar,.playerDesktopStickySlot{max-width:100%!important;min-width:0!important}
}


/* V77 — mobilka: panel zawodów jest całkowicie odseparowany od ekranu startowego. */
#competitionDetail.hidden{display:none!important}
@media(max-width:760px){
  body.playerTheme #competitionDetail.hidden,
  body.playerTheme #competitionDetail.hidden *{display:none!important}
  body.playerTheme #competitionDetail.hidden .playerUnifiedNav,
  body.playerTheme #competitionDetail.hidden .playerUnifiedNav.fixedPlayerBar{display:none!important;position:static!important}
  body.playerTheme #competitionDetail:not(.hidden){width:100%!important;max-width:100%!important;min-width:0!important}
  body.playerTheme #competitionDetail:not(.hidden) .playerView,
  body.playerTheme #competitionDetail:not(.hidden) .playerMobileDashboard{width:100%!important;max-width:100%!important;min-width:0!important}
  body.playerTheme #competitionDetail:not(.hidden) .playerPrimaryNav{grid-template-columns:repeat(5,minmax(0,1fr))!important}
}


/* V78 — HARD FIX mobilnego ekranu startowego i szerokości kafelków.
   Stary grid .playerUnifiedNav nie może ścieśniać nowego 5-kolumnowego paska. */
@media(max-width:760px){
  body.playerTheme #competitionDetail.hidden{display:none!important}
  body.playerTheme #competitionDetail.hidden *{display:none!important}

  .playerView .playerUnifiedNav,
  .playerView .playerUnifiedNav:not(.fixedPlayerBar),
  .playerView .playerUnifiedNav.fixedPlayerBar{
    display:block!important;
    grid-template-columns:none!important;
    box-sizing:border-box!important;
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
  }
  .playerView .playerPrimaryNav{
    display:grid!important;
    grid-template-columns:repeat(5,minmax(0,1fr))!important;
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
  }
  .playerView .playerPrimaryNav>button,
  .playerView .playerPrimaryStack{
    width:100%!important;
    min-width:0!important;
    max-width:none!important;
  }
  .playerView .playerMapNav{
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    width:100%!important;
  }
  .playerView .playerNotificationNav{display:block!important;width:100%!important}
  .playerView .playerNotificationNav button{width:100%!important}
}

/* V79 — ekran startowy podczas bezpiecznej aktualizacji PWA; zamiast białego ekranu. */
#bootGuard{position:fixed;inset:0;z-index:20000;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;background:#061521;color:#eef8ff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;text-align:center;padding:24px}
#bootGuard.hidden{display:none!important}#bootGuard img{width:76px;height:76px;border-radius:18px;box-shadow:0 6px 22px #0008}#bootGuard b{font-size:20px}#bootGuard span{font-size:13px;color:#a8c7d9}
@media(min-width:761px){.playerDesktopSubNav.playerDesktopMapsOnly{grid-template-columns:1fr 1fr!important}}


/* V80 — tylko desktop zawodnika: wyniki T1/T2 wracają do zwartej szerokości. Mobilka bez zmian. */
@media(min-width:761px){
  body.playerTheme main{
    width:100%!important;
    max-width:1220px!important;
    margin-left:auto!important;
    margin-right:auto!important;
  }
  body.playerTheme #app,
  body.playerTheme #competitionDetail,
  body.playerTheme .playerView,
  body.playerTheme .playerDesktopDashboardV55,
  body.playerTheme #playerDesktopPanelContent{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
  }
  .playerDesktopSelectedPanel{
    width:100%!important;
    max-width:1080px!important;
    min-width:0!important;
    margin:10px auto 0!important;
  }
  .playerDesktopSelectedPanel .playerResultCard,
  .playerDesktopSelectedPanel>.card{
    width:100%!important;
    max-width:1080px!important;
    margin-left:auto!important;
    margin-right:auto!important;
  }
  .playerDesktopSelectedPanel .tablewrap{
    width:100%!important;
    max-width:100%!important;
    overflow-x:auto!important;
  }
  .playerDesktopSelectedPanel .sharpTable,
  .playerDesktopSelectedPanel .roundClassTable{
    width:100%!important;
    max-width:100%!important;
    table-layout:fixed!important;
  }
  .playerDesktopSelectedPanel .sharpTable th,
  .playerDesktopSelectedPanel .sharpTable td{
    padding:7px 6px!important;
  }
  .playerDesktopSelectedPanel .roundClassTable th:nth-child(1),
  .playerDesktopSelectedPanel .roundClassTable td:nth-child(1){width:42px!important}
  .playerDesktopSelectedPanel .roundClassTable th:nth-child(3),
  .playerDesktopSelectedPanel .roundClassTable td:nth-child(3){width:58px!important}
  .playerDesktopSelectedPanel .roundClassTable th:nth-child(4),
  .playerDesktopSelectedPanel .roundClassTable td:nth-child(4){width:68px!important}
  .playerDesktopSelectedPanel .roundClassTable th:nth-child(5),
  .playerDesktopSelectedPanel .roundClassTable td:nth-child(5){width:74px!important}
  .playerDesktopSelectedPanel .roundClassTable th:nth-child(6),
  .playerDesktopSelectedPanel .roundClassTable td:nth-child(6){width:110px!important}
}

/* V81 — potwierdzenie obecności zawodnika od 4 dni przed zawodami. */
.playerCompMineStack{display:flex;flex-direction:column;align-items:flex-start;gap:4px;min-width:0}
.playerPresenceConfirm{display:inline-flex!important;align-items:center!important;justify-content:center!important;box-sizing:border-box!important;min-height:26px!important;padding:4px 8px!important;border-radius:7px!important;font-size:9px!important;font-weight:1000!important;line-height:1.05!important;white-space:nowrap!important}
button.playerPresenceConfirm.pending{background:#b91f2d!important;color:#fff!important;border:1px solid #ef6070!important;box-shadow:0 2px 7px #7c101955!important}
.playerPresenceConfirm.confirmed{background:#168247!important;color:#fff!important;border:1px solid #54c77f!important;box-shadow:0 2px 7px #0d573155!important}
body.playerTheme .playerPresenceConfirm{color:#fff!important}
body.playerTheme .playerCompMineCell{min-width:0!important}
@media(max-width:760px){
  .playerCompMiniInfo{align-items:flex-start!important}
  .playerCompMineStack{gap:3px!important}
  .playerPresenceConfirm{min-height:23px!important;padding:3px 5px!important;font-size:7.6px!important;max-width:126px!important;white-space:normal!important;text-align:center!important}
}


/* V82/V83 — czytelne „Moje stanowiska” + wyrównane przewijanie paneli losowania. */
.playerView .playerOwnSummaryGrid{align-items:stretch!important}
.playerView .playerOwnSummaryCard{display:grid!important;grid-template-columns:112px 165px minmax(0,1fr)!important;align-items:stretch!important;min-height:106px!important;padding:0!important;overflow:hidden!important;border-width:2px!important;border-radius:12px!important}
.playerView .playerOwnRoundBlock,.playerView .playerOwnStandBlock,.playerView .playerOwnBankBlock{min-width:0!important;display:flex!important;flex-direction:column!important;align-items:center!important;justify-content:center!important;text-align:center!important;padding:10px 12px!important}
.playerView .playerOwnRoundBlock,.playerView .playerOwnStandBlock{border-right:2px solid rgba(8,37,35,.22)!important}
.playerView .playerOwnRoundBlock{background:rgba(255,255,255,.22)!important}.playerView .playerOwnStandBlock{background:rgba(255,255,255,.12)!important}
.playerView .playerOwnFieldLabel,.playerView .playerOwnRoundLabel{display:block!important;font-size:12px!important;line-height:1!important;font-weight:1000!important;letter-spacing:.08em!important;color:#284b47!important}
.playerView .playerOwnRoundValue{display:block!important;margin-top:5px!important;font-size:40px!important;line-height:.92!important;font-weight:1000!important;color:#082523!important}
.playerView .playerOwnStandValue{display:block!important;margin-top:4px!important;font-size:54px!important;line-height:.9!important;font-weight:1000!important;color:#071f1c!important}
.playerView .playerOwnBankValue{display:block!important;width:100%!important;margin-top:6px!important;font-size:clamp(22px,2vw,31px)!important;line-height:1!important;font-weight:1000!important;text-transform:uppercase!important;color:#082523!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}
.playerView .playerOwnSectorValue{display:block!important;margin-top:8px!important;padding-top:6px!important;width:100%!important;border-top:1px solid rgba(8,37,35,.22)!important;font-size:15px!important;line-height:1!important;font-weight:1000!important;letter-spacing:.03em!important;color:#284b47!important}
.playerView .playerOwnSummaryMain,.playerView .playerOwnSummaryLabels,.playerView .playerOwnSummaryBank,.playerView .playerOwnSummaryTitle{display:none!important}
@media(max-width:760px){
 .playerView .playerOwnSummaryWrap{margin:8px 0!important}.playerView .playerOwnSummaryHeading{font-size:12px!important;margin-bottom:5px!important}.playerView .playerOwnSummaryGrid{grid-template-columns:1fr 1fr!important;gap:7px!important}
 .playerView .playerOwnSummaryCard{grid-template-columns:48px 58px minmax(0,1fr)!important;min-height:92px!important;border-radius:10px!important}
 .playerView .playerOwnRoundBlock,.playerView .playerOwnStandBlock,.playerView .playerOwnBankBlock{padding:6px 4px!important}
 .playerView .playerOwnFieldLabel,.playerView .playerOwnRoundLabel{font-size:7.5px!important;letter-spacing:.035em!important}.playerView .playerOwnRoundValue{font-size:25px!important;margin-top:4px!important}.playerView .playerOwnStandValue{font-size:36px!important;margin-top:3px!important}
 .playerView .playerOwnBankValue{font-size:clamp(12px,3.5vw,18px)!important;margin-top:5px!important;white-space:normal!important;line-height:1.02!important;overflow:visible!important;text-overflow:clip!important}.playerView .playerOwnSectorValue{font-size:9px!important;margin-top:5px!important;padding-top:4px!important}
}
@media(max-width:380px){.playerView .playerOwnSummaryCard{grid-template-columns:42px 52px minmax(0,1fr)!important}.playerView .playerOwnRoundValue{font-size:22px!important}.playerView .playerOwnStandValue{font-size:32px!important}.playerView .playerOwnBankValue{font-size:11px!important}.playerView .playerOwnSectorValue{font-size:8px!important}}


/* V84 — desktop zawodnika: jeden identyczny układ i punkt startu dla każdego kafla. Mobilka bez zmian. */
@media(min-width:761px){
  body.playerTheme main{max-width:1220px!important;width:100%!important;margin-left:auto!important;margin-right:auto!important}
  .playerDesktopDashboardV56,.playerDesktopDashboardV55,.playerDesktopStickySlot,#playerDesktopPanelContent{
    width:100%!important;max-width:100%!important;min-width:0!important;
  }
  /* Stabilny pasek: sticky na slocie, bez ręcznego left/width z JS. */
  .playerDesktopStickySlot{
    position:sticky!important;
    top:var(--app-header-height,0px)!important;
    z-index:6200!important;
    height:auto!important;
    overflow:visible!important;
    margin:0!important;
  }
  .playerDesktopUnifiedNav,
  .playerDesktopUnifiedNav.fixedPlayerBar{
    position:relative!important;
    top:auto!important;left:auto!important;right:auto!important;
    width:100%!important;max-width:100%!important;min-width:0!important;
    margin:0 0 10px!important;
    transform:none!important;
  }
  /* Każdy wybrany widok ma identyczną szerokość i środek. */
  #playerDesktopPanelContent{
    max-width:1080px!important;
    margin:0 auto!important;
    scroll-margin-top:calc(var(--app-header-height,0px) + 106px)!important;
  }
  .playerDesktopSelectedPanel,
  .playerDesktopSelectedPanel.playerDesktopDrawSelected{
    width:100%!important;max-width:100%!important;min-width:0!important;
    margin:10px 0 0!important;
  }
  .playerDesktopSelectedPanel .playerResultCard,
  .playerDesktopSelectedPanel>.card,
  .playerDesktopSelectedPanel .playerDesktopFullMap{
    width:100%!important;max-width:100%!important;min-width:0!important;
    margin-left:0!important;margin-right:0!important;
  }
  .playerDesktopDrawSelected .playerSectorAccordionList,
  .playerDesktopSelectedPanel .playerDesktopSectorTables,
  .playerDesktopSelectedPanel .stationStats{
    width:100%!important;max-width:100%!important;min-width:0!important;
  }
}


/* V85 — desktop zawodnika: wszystkie widoki zachowują się jak GENERAL. */
@media(min-width:761px){
  #playerDesktopPanelContent{
    width:100%!important;
    max-width:1080px!important;
    margin:0 auto!important;
  }
  #playerDesktopPanelContent>.playerDesktopSelectedPanel{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    margin:0!important;
    padding:12px 0 0!important;
  }
  #playerDesktopPanelContent>.playerDesktopSelectedPanel>.card,
  #playerDesktopPanelContent>.playerDesktopSelectedPanel>.playerDesktopPanelCard{
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    margin:0!important;
    padding:14px!important;
    border-radius:16px!important;
    overflow:hidden!important;
  }
  .playerDesktopPanelCard .playerDesktopSectionTitle,
  .playerDesktopPanelCard>h2{
    margin:0 0 10px!important;
    min-height:24px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
  }
  .playerDesktopDrawSelected .playerDrawViewSwitch{margin:0 auto 10px!important;max-width:360px!important}
  .playerDesktopSelectedPanel .playerSectorAccordionList,
  .playerDesktopSelectedPanel .playerDesktopSectorTables,
  .playerDesktopSelectedPanel .playerDesktopFullMap,
  .playerDesktopSelectedPanel .stationStats,
  .playerDesktopSelectedPanel .tablewrap,
  .playerDesktopSelectedPanel table{
    max-width:100%!important;
  }
  .playerDesktopSelectedPanel .sectorMap{max-width:100%!important;margin-left:auto!important;margin-right:auto!important}
}


/* V86 — DESKTOP zawodnika: WSZYSTKIE kafle mają dokładnie zachowanie GENERAL.
   Jeden viewport, jedna szerokość, brak poziomego rozpychania i jeden punkt przewinięcia. */
@media(min-width:761px){
  html,body{overflow-x:hidden!important}
  body.playerTheme main{
    box-sizing:border-box!important;
    width:min(1220px,calc(100vw - 32px))!important;
    max-width:1220px!important;
    margin-left:auto!important;margin-right:auto!important;
    overflow:visible!important;
  }
  body.playerTheme #app,
  body.playerTheme #tab-competitions,
  body.playerTheme #competitionDetail,
  body.playerTheme .playerView,
  body.playerTheme .playerDesktopDashboardV55,
  body.playerTheme .playerDesktopDashboardV56,
  body.playerTheme .playerDesktopStickySlot,
  body.playerTheme .playerDesktopUnifiedNav,
  body.playerTheme .playerDesktopPrimaryNav,
  body.playerTheme .playerDesktopSubNav,
  body.playerTheme .playerOwnSummaryWrap,
  body.playerTheme #playerDesktopPanelContent,
  body.playerTheme .playerDesktopSelectedPanel,
  body.playerTheme .playerDesktopPanelCard{
    box-sizing:border-box!important;
    width:100%!important;max-width:100%!important;min-width:0!important;
  }
  /* Pasek zachowuje się jednakowo niezależnie od otwartego widoku. */
  body.playerTheme .playerDesktopStickySlot{
    position:sticky!important;top:0!important;z-index:6200!important;
    margin:0!important;height:auto!important;overflow:visible!important;
  }
  body.playerTheme .playerDesktopUnifiedNav,
  body.playerTheme .playerDesktopUnifiedNav.fixedPlayerBar{
    position:relative!important;inset:auto!important;
    transform:none!important;margin:0 0 8px!important;
  }
  body.playerTheme .playerDesktopPrimaryNav{
    display:grid!important;grid-template-columns:repeat(5,minmax(0,1fr))!important;
    gap:7px!important;overflow:hidden!important;
  }
  body.playerTheme .playerDesktopPrimaryNav>button,
  body.playerTheme .playerDesktopPrimaryNav>.playerPrimaryStack,
  body.playerTheme .playerPrimaryStack>button{min-width:0!important;max-width:100%!important}
  body.playerTheme .playerDesktopSubNav.playerDesktopMapsOnly{display:grid!important;grid-template-columns:1fr 1fr!important;gap:7px!important}

  /* To samo pudełko dla GENERAL, T1, T2, losowań, map i statystyk. */
  body.playerTheme #playerDesktopPanelContent{
    width:100%!important;max-width:1080px!important;margin:0 auto!important;
    overflow:visible!important;
  }
  body.playerTheme #playerDesktopPanelContent>.playerDesktopSelectedPanel{
    width:100%!important;max-width:100%!important;min-width:0!important;
    margin:0!important;padding:12px 0 24px!important;overflow:visible!important;
  }
  body.playerTheme #playerDesktopPanelContent>.playerDesktopSelectedPanel>.playerDesktopPanelCard{
    width:100%!important;max-width:100%!important;min-width:0!important;
    margin:0!important;padding:14px!important;border-radius:16px!important;
    overflow:hidden!important;
  }
  /* Statystyki miały własne karty — spłaszczamy je do tego samego kontenera co GENERAL. */
  body.playerTheme .playerStatsPanelCard>.card,
  body.playerTheme .playerStatsPanelCard .stationStats{
    width:100%!important;max-width:100%!important;min-width:0!important;
    margin-left:0!important;margin-right:0!important;
  }
  /* Tabele nigdy nie mogą poszerzać całego dokumentu. */
  body.playerTheme .playerDesktopSelectedPanel .tablewrap{
    box-sizing:border-box!important;width:100%!important;max-width:100%!important;min-width:0!important;
    overflow-x:auto!important;overflow-y:visible!important;
  }
  body.playerTheme .playerDesktopSelectedPanel table{
    width:100%!important;max-width:100%!important;min-width:0!important;table-layout:fixed!important;
  }
  body.playerTheme .playerDesktopSelectedPanel th,
  body.playerTheme .playerDesktopSelectedPanel td{min-width:0!important;overflow-wrap:anywhere!important}
  /* Mapy mogą mieć szeroką naturalną grafikę, ale tylko we własnym oknie — nie rozpychają paska. */
  body.playerTheme .playerDesktopSelectedPanel .sectorMap,
  body.playerTheme .playerDesktopFullMap{
    box-sizing:border-box!important;width:100%!important;max-width:100%!important;min-width:0!important;
    overflow-x:auto!important;overflow-y:visible!important;
  }
  body.playerTheme .playerDesktopSelectedPanel .sectorFlexRow,
  body.playerTheme .playerDesktopSelectedPanel .water{max-width:none!important}
  body.playerTheme .playerDesktopDrawSelected .playerSectorAccordionList,
  body.playerTheme .playerDesktopSelectedPanel .playerDesktopSectorTables{
    width:100%!important;max-width:100%!important;min-width:0!important;
  }
}

/* V87 — desktop: krótkie panele dostają wysokość viewportu, aby każdy kafel mógł
   przewinąć pasek dokładnie tak samo jak GENERAL. Mobile pozostaje bez zmian. */
@media(min-width:761px){
  body.playerTheme #playerDesktopPanelContent{
    min-height:calc(100vh - var(--player-desktop-nav-height,150px) + 56px)!important;
    scroll-margin-top:calc(var(--player-desktop-nav-height,150px) + 8px)!important;
  }
  body.playerTheme .playerDesktopDashboardV56{padding-bottom:8px!important}
}


/* V88 — stabilny panel zawodnika.
   Po wejściu pasek jest ustawiany na górze raz. Klikanie kafelków nie przewija strony.
   Losowanie pokazuje „Moje stanowiska”; wyniki/mapy/general/statystyki pokazują tylko swoją treść. */
@media(min-width:761px){
  body.playerTheme #playerDesktopPanelContent{
    min-height:0!important;
    scroll-margin-top:0!important;
    overflow-anchor:none!important;
  }
  body.playerTheme .playerDesktopStickySlot{
    position:sticky!important;
    top:0!important;
    z-index:6200!important;
    overflow-anchor:none!important;
  }
  body.playerTheme .playerDesktopUnifiedNav{margin-bottom:8px!important}
  body.playerTheme .playerDesktopDrawSelected>.playerOwnSummaryWrap{
    width:100%!important;
    max-width:1080px!important;
    margin:0 auto 10px!important;
  }
}
@media(max-width:760px){
  body.playerTheme #playerMobilePanelContent{overflow-anchor:none!important}
  body.playerTheme .playerMobileDrawSelected>.playerOwnSummaryWrap{margin:4px 0 8px!important}
  body.playerTheme .playerDrawStickySlot{overflow-anchor:none!important}
}

/* V85 — ekran logowania/rejestracji w ciemnym stylu aplikacji. */
body.authMode{
  min-height:100vh!important;
  background:radial-gradient(circle at 50% 0,#173a50 0,#0b2130 34%,#06131e 72%,#040d14 100%)!important;
  color:#e9f6ff!important;
}
body.authMode header{
  background:linear-gradient(100deg,#061521f2,#12334cf0),url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%201200%20120%22%3E%3Cpath%20fill%3D%22%23132d42%22%20d%3D%22M0%2085%20180%2030%20320%2068%20480%2020%20690%2079%20870%2028%201040%2064%201200%2020v100H0z%22%2F%3E%3Cpath%20fill%3D%22%23071b28%22%20d%3D%22M0%2092q300-24%20600%200t600%200v28H0z%22%2F%3E%3C%2Fsvg%3E") center/cover!important;
  border-bottom:1px solid #31536a!important;
  box-shadow:0 5px 18px #0007!important;
}
body.authMode main{max-width:980px!important;padding-top:24px!important}
body.authMode #auth{
  background:linear-gradient(180deg,#102a3d 0%,#091b29 100%)!important;
  border:1px solid #33566f!important;
  box-shadow:0 18px 48px #0007!important;
  color:#edf8ff!important;
}
body.authMode #auth>h2{font-size:24px!important;color:#fff!important;text-align:center!important;margin:2px 0 16px!important}
body.authMode #auth label{color:#b8d3e3!important}
body.authMode #auth input,
body.authMode #auth select,
body.authMode #auth textarea{
  background:#071723!important;
  color:#f4fbff!important;
  border:1px solid #3d6179!important;
  box-shadow:inset 0 1px 5px #0007!important;
}
body.authMode #auth input:focus{outline:2px solid #269ee8!important;border-color:#269ee8!important}
body.authMode #auth button{background:linear-gradient(#168c4d,#096637)!important;border:1px solid #36b56e!important;box-shadow:inset 0 1px 2px #ffffff35!important}
body.authMode #auth button.secondary{background:#17384d!important;color:#e9f7ff!important;border-color:#4b728b!important}
body.authMode #auth .playerRegisterCard,
body.authMode #auth .adminSetupCard,
body.authMode #auth .adminSetupGate{
  background:#0b2232!important;
  color:#edf8ff!important;
  border-color:#31536a!important;
  box-shadow:none!important;
}
body.authMode #auth .playerRegisterCard h3,
body.authMode #auth .adminSetupCard h3{color:#fff!important}
body.authMode #auth .muted{color:#9fbfd2!important}
body.authMode #auth .adminSetupGate>summary{color:#c8e2f0!important}
@media(max-width:760px){
  body.authMode main{padding:10px!important}
  body.authMode #auth{padding:12px!important;border-radius:14px!important}
  body.authMode #auth>.twoCols{grid-template-columns:1fr!important}
}


/* V89 — panel zawodnika: wejście od razu na top, brak podskoków między kaflami, mapa bez przelewania. */
body.playerTheme #competitionDetail,
body.playerTheme .playerView,
body.playerTheme .playerMobileDashboard,
body.playerTheme .playerDesktopDashboardV56,
body.playerTheme #playerMobilePanelContent,
body.playerTheme #playerDesktopPanelContent{overflow-anchor:none!important;min-height:100vh!important;min-height:100dvh!important}
@media(max-width:760px){
  html,body.playerTheme{max-width:100%!important;overflow-x:hidden!important}
  body.playerTheme .playerMobileDashboard,
  body.playerTheme #playerMobilePanelContent,
  body.playerTheme .playerMobileSelectedPanel,
  body.playerTheme .playerMobileFullMapWrap,
  body.playerTheme .playerMobileFullMapViewport{
    width:100%!important;max-width:100%!important;min-width:0!important;box-sizing:border-box!important;overflow-x:hidden!important;
  }
  body.playerTheme .playerMobileFullMapViewport{
    position:relative!important;overflow:hidden!important;contain:layout paint!important;min-height:120px!important;padding:0!important;
  }
  body.playerTheme .playerMobileFullMapCanvas{
    position:absolute!important;left:4px!important;top:4px!important;max-width:none!important;margin:0!important;transform-origin:top left!important;
  }
  body.playerTheme .playerMobileFullMapCanvas .sectorMap{max-width:none!important;overflow:visible!important}
  body.playerTheme .playerDrawStickySlot{scroll-margin-top:0!important}
}
@media(min-width:761px){
  body.playerTheme .playerDesktopStickySlot{scroll-margin-top:0!important}
}


/* V90 — ADMIN: numer telefonu jako bezpośredni przycisk do połączenia. */
.phoneCallBtn{
  display:inline-flex!important;
  align-items:center!important;
  justify-content:center!important;
  gap:6px!important;
  min-height:32px!important;
  padding:5px 10px!important;
  border:1px solid #2b8c65!important;
  border-radius:8px!important;
  background:#e8f7ef!important;
  color:#075c3c!important;
  font-weight:900!important;
  line-height:1!important;
  text-decoration:none!important;
  white-space:nowrap!important;
  cursor:pointer!important;
  box-shadow:0 1px 2px #00000012!important;
}
.phoneCallBtn:hover{background:#d9f1e5!important;border-color:#16734f!important;color:#064b32!important}
.phoneCallBtn:focus-visible{outline:3px solid #75c9a7!important;outline-offset:2px!important}
.phoneCallIcon{font-size:16px!important;line-height:1!important}
@media(max-width:760px){
  .mobilePhoneLine{align-items:center!important}
  .mobilePhoneCallBtn{min-height:36px!important;padding:7px 11px!important;font-size:14px!important}
  .mobileRosterCompactMeta .mobilePhoneCallBtn{width:auto!important;max-width:100%!important}
}



/* V91 — Historia startów zawodnika: jeden start = jeden zwarty wiersz. */
body.playerTheme #app>.tabs #btn-history{background:linear-gradient(#8a5b20,#4f3312)!important;border-color:#c9974f!important}
body.playerTheme #app>.tabs #btn-history.active{background:linear-gradient(#c98725,#85510d)!important;border-color:#ffd17c!important}
.playerHistoryCard{padding:12px!important}
.playerHistoryHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:7px}
.playerHistoryHead h2{margin:0!important}
.playerHistoryHead>span{font-size:11px;font-weight:900;color:#7591a4;white-space:nowrap}
.playerHistoryList{border:1px solid #34546b;border-radius:8px;overflow:hidden;background:#0c2232}
.playerHistoryRow{display:grid;grid-template-columns:minmax(150px,1.5fr) 96px minmax(190px,1fr) 110px;align-items:center;gap:8px;min-height:38px;padding:6px 9px;border-bottom:1px solid #29485d;color:#dcecf7;font-size:12.5px;line-height:1.05;white-space:nowrap}
.playerHistoryRow:last-child{border-bottom:0}
.playerHistoryRow:nth-child(even){background:#102b3e}
.playerHistoryFishery{min-width:0;overflow:hidden;text-overflow:ellipsis;font-weight:1000;color:#fff}
.playerHistoryDate{color:#9fb9ca;font-weight:800;text-align:center}
.playerHistoryScore{text-align:center;color:#dcecf7;font-weight:800}
.playerHistoryScore b{color:#8fe2ad}.playerHistoryScore strong{color:#ffd56c;font-size:14px}
.playerHistoryWeight{text-align:right;color:#fff;font-weight:1000}
@media(max-width:760px){
  .playerHistoryCard{padding:8px!important}
  .playerHistoryHead{margin-bottom:5px}.playerHistoryHead h2{font-size:15px!important}.playerHistoryHead>span{font-size:9px}
  .playerHistoryRow{grid-template-columns:minmax(72px,1fr) 66px 124px 76px;gap:4px;min-height:32px;padding:5px 5px;font-size:9.5px}
  .playerHistoryDate{font-size:9px}.playerHistoryScore{font-size:9.5px}.playerHistoryScore strong{font-size:10.5px}.playerHistoryWeight{font-size:9.5px}
}
@media(max-width:360px){
  .playerHistoryRow{grid-template-columns:minmax(62px,1fr) 62px 116px 70px;gap:3px;padding:5px 4px;font-size:9px}
  .playerHistoryDate,.playerHistoryScore,.playerHistoryWeight{font-size:8.8px}.playerHistoryScore strong{font-size:9.8px}
}


/* V92 — ciemny panel admina + regulamin + zbiórka. */
body:not(.playerTheme):not(.authMode){background:#061824!important;color:#e7f2f8!important}
body:not(.playerTheme):not(.authMode) header{background:linear-gradient(135deg,#071a28,#0b3445)!important;border-bottom:1px solid #1f5f74!important;box-shadow:0 5px 18px #0006!important}
body:not(.playerTheme):not(.authMode) header h1{color:#fff!important}
body:not(.playerTheme):not(.authMode) main{max-width:1500px!important}
body:not(.playerTheme):not(.authMode) #app>.card,
body:not(.playerTheme):not(.authMode) #tab-competitions>.card,
body:not(.playerTheme):not(.authMode) #competitionDetail>.card,
body:not(.playerTheme):not(.authMode) .adminZone>.card,
body:not(.playerTheme):not(.authMode) #tab-notifications>.card,
body:not(.playerTheme):not(.authMode) #tab-players>.card{background:#0d2636!important;color:#e8f3fa!important;border:1px solid #28536a!important;box-shadow:0 5px 18px #0003!important}
body:not(.playerTheme):not(.authMode) .muted{color:#91adbd!important}
body:not(.playerTheme):not(.authMode) #app>.tabs{display:flex!important;gap:10px!important;flex-wrap:wrap!important;margin:10px 0 12px!important;padding:0!important;background:transparent!important}
body:not(.playerTheme):not(.authMode) #app>.tabs button{min-height:46px!important;padding:9px 20px!important;border-radius:8px!important;background:linear-gradient(#0b4562,#082c40)!important;color:#fff!important;border:1px solid #2d7da3!important;font-weight:1000!important;box-shadow:inset 0 1px 1px #ffffff24,0 3px 8px #0003!important}
body:not(.playerTheme):not(.authMode) #app>.tabs button.active{background:linear-gradient(#2b9b4d,#177137)!important;border-color:#5bc87b!important;box-shadow:0 0 0 2px #87ec9d33!important}
body:not(.playerTheme):not(.authMode) .compactUserBar{background:linear-gradient(90deg,#0a2535,#103e4c)!important;border-left:4px solid #35ba60!important}
body:not(.playerTheme):not(.authMode) .workZoneTabs{background:#071b29!important;border:1px solid #28536a!important;border-radius:10px!important;padding:7px!important;gap:7px!important;box-shadow:0 5px 16px #0004!important}
body:not(.playerTheme):not(.authMode) .workZoneTabs button{background:linear-gradient(#103951,#0a293c)!important;color:#dcecf5!important;border:1px solid #32627c!important;border-radius:8px!important;min-height:54px!important;font-weight:1000!important}
body:not(.playerTheme):not(.authMode) .workZoneTabs button.active{background:linear-gradient(#289748,#166e35)!important;color:#fff!important;border-color:#5bd27b!important}
body:not(.playerTheme):not(.authMode) input,
body:not(.playerTheme):not(.authMode) select,
body:not(.playerTheme):not(.authMode) textarea{background:#071c2a!important;color:#eef8ff!important;border:1px solid #35627a!important;box-shadow:inset 0 1px 4px #0005!important}
body:not(.playerTheme):not(.authMode) input:focus,
body:not(.playerTheme):not(.authMode) select:focus,
body:not(.playerTheme):not(.authMode) textarea:focus{border-color:#4db6e7!important;outline:2px solid #4db6e733!important}
body:not(.playerTheme):not(.authMode) table{background:#0a2130!important;color:#e6f2f8!important}
body:not(.playerTheme):not(.authMode) th{background:#12364b!important;color:#fff!important;border-color:#31566b!important}
body:not(.playerTheme):not(.authMode) td{border-color:#24475a!important}
body:not(.playerTheme):not(.authMode) tbody tr:nth-child(even){background:#0f2b3c!important}
body:not(.playerTheme):not(.authMode) tbody tr:hover{background:#15384b!important}
body:not(.playerTheme):not(.authMode) .competitionDetailHead.adminDetailHead{border-left:4px solid #36bc61!important;background:linear-gradient(100deg,#0b2637,#10394a)!important}
.competitionDetailMeta{display:flex;align-items:center;gap:8px 18px;flex-wrap:wrap;margin-top:5px;font-size:13px;font-weight:800}
.competitionDetailMeta span{display:inline-flex;align-items:center;gap:4px}.competitionDetailMeta .meetingStrong{color:#ffd36d!important;font-weight:1000}
.adminTextPair{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:10px 0}.adminTextPair textarea{min-height:120px!important}.adminTextPair .rulesEditor{min-height:150px!important}
body:not(.playerTheme):not(.authMode) .competitionDesktopList table{border:1px solid #31566b!important;border-radius:8px!important;overflow:hidden!important}
body:not(.playerTheme):not(.authMode) .pill{background:#174c63!important;color:#eaf8ff!important;border-color:#397d98!important}
body:not(.playerTheme):not(.authMode) button:not(.warn):not(.secondary){background:linear-gradient(#279b4d,#166f35)!important;border-color:#57ca77!important;color:#fff!important}
body:not(.playerTheme):not(.authMode) button.secondary{background:linear-gradient(#164d6c,#0c354f)!important;border-color:#3a82a7!important;color:#fff!important}
body:not(.playerTheme):not(.authMode) button.warn{background:linear-gradient(#9b2836,#6c1723)!important;border-color:#dc5261!important;color:#fff!important}
body.playerTheme #app>.tabs #btn-rules{background:linear-gradient(#1c6c78,#0f3c49)!important;border-color:#3ca8b8!important}
body.playerTheme #app>.tabs #btn-rules.active{background:linear-gradient(#2a9aaa,#14606d)!important;border-color:#7de2ef!important}
.playerCompMeeting{font-weight:1000;color:#ffd36d!important;white-space:nowrap}
.playerEventInfo{display:grid!important;grid-template-columns:minmax(0,1fr) minmax(230px,.8fr)!important;gap:8px!important;padding:8px!important;margin:7px 0!important;background:#0a2030!important}
.playerEventNote,.playerEventRules{background:#102d40;border:1px solid #31566b;border-radius:8px;padding:8px;color:#e9f5fc;font-size:12px;line-height:1.35}
.playerEventNote{display:flex;gap:8px;align-items:flex-start}.playerEventNote>b{color:#6fd68a;white-space:nowrap}.playerEventRules summary{cursor:pointer;color:#ffd36d;font-weight:1000}.playerEventRules>div{padding-top:7px}
.playerRulesCard{padding:10px!important}.playerRulesHead{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:8px}.playerRulesHead h2{margin:0!important}.playerRulesHead span{font-size:11px;color:#91adbd;font-weight:900}
.playerRuleItem{border:1px solid #31566b;border-radius:8px;background:#0c2232;margin-bottom:7px;overflow:hidden}.playerRuleItem summary{display:flex;align-items:center;justify-content:space-between;gap:12px;cursor:pointer;padding:9px 11px;color:#fff}.playerRuleItem summary span{display:flex;flex-direction:column;gap:3px;min-width:0}.playerRuleItem summary small{color:#9fb9ca}.playerRuleItem summary strong{color:#ffd36d;font-size:11px}.playerRuleBody{border-top:1px solid #29495c;padding:10px;color:#dfeef7;font-size:12.5px;line-height:1.45}.playerRuleInfo{margin-top:10px;padding-top:8px;border-top:1px solid #29495c;color:#b9cfdd}
@media(max-width:760px){
 .adminTextPair{grid-template-columns:1fr!important}.adminTextPair textarea,.adminTextPair .rulesEditor{min-height:105px!important}
 body:not(.playerTheme):not(.authMode) #app>.tabs{gap:5px!important}body:not(.playerTheme):not(.authMode) #app>.tabs button{min-height:39px!important;padding:7px 10px!important;font-size:11px!important}
 .competitionDetailMeta{font-size:10.5px!important;gap:5px 10px!important}.playerEventInfo{grid-template-columns:1fr!important}.playerEventNote{font-size:10.5px!important}.playerEventRules{font-size:10.5px!important}
 .playerRuleItem summary{padding:8px!important}.playerRuleItem summary b{font-size:11px}.playerRuleItem summary small{font-size:9px}.playerRuleBody{font-size:10.5px}
 .playerCompMeeting{font-size:9px!important}
}


/* V93 — regulamin ogólny + czytelna edycja danych zawodów */
.generalRulesAdmin .generalRulesEditor{min-height:320px!important;width:100%!important;line-height:1.5!important;font-size:15px!important}
.generalRulesPlayer .generalRulesText{padding:16px!important;border:1px solid #31566a!important;border-radius:10px!important;background:#0b2230!important;color:#eef8ff!important;line-height:1.55!important}
body.playerTheme #btn-rules{background:linear-gradient(#187383,#0e4755)!important;border-color:#46afbd!important}
body.playerTheme #btn-rules.active{background:linear-gradient(#29a5b5,#126171)!important;border-color:#8ce7f0!important}
.adminEventSettings{scroll-margin-top:92px!important}
@media(max-width:760px){.generalRulesAdmin .generalRulesEditor{min-height:250px!important}.adminEventSettings{scroll-margin-top:76px!important}}


/* V94 — tylko desktop admina: 5 kafelków stref zawsze w jednym, widocznym rzędzie.
   Mobile pozostaje bez zmian. */
@media(min-width:761px){
  body:not(.playerTheme):not(.authMode) .workZoneTabsSlot{
    width:100%!important;
    min-width:0!important;
    overflow:visible!important;
  }
  body:not(.playerTheme):not(.authMode) .workZoneTabs{
    display:grid!important;
    grid-template-columns:repeat(5,minmax(0,1fr))!important;
    visibility:visible!important;
    opacity:1!important;
    overflow:visible!important;
  }
  body:not(.playerTheme):not(.authMode) .workZoneTabs:not(.fixedAdminNav){
    width:100%!important;
  }
  body:not(.playerTheme):not(.authMode) .workZoneTabs.fixedAdminNav{
    display:grid!important;
    grid-template-columns:repeat(5,minmax(0,1fr))!important;
    visibility:visible!important;
    opacity:1!important;
    overflow:visible!important;
  }
  body:not(.playerTheme):not(.authMode) .workZoneTabs button{
    min-width:0!important;
    white-space:normal!important;
  }
}


/* V95 — admin: unread notifications stay in dark theme.
   The global .mine class is intentionally yellow elsewhere (e.g. own draw row),
   so this override is scoped only to the admin notifications tab. */
body:not(.playerTheme):not(.authMode) #tab-notifications .notificationWrap{
  background:transparent!important;
  border-color:#31566b!important;
}
body:not(.playerTheme):not(.authMode) #tab-notifications .notificationTable{
  background:transparent!important;
  color:#eaf6ff!important;
}
body:not(.playerTheme):not(.authMode) #tab-notifications .notificationTable th{
  background:#12364b!important;
  color:#fff!important;
  border-color:#31566b!important;
}
body:not(.playerTheme):not(.authMode) #tab-notifications .notificationTable tr{
  background:#0b2433!important;
  color:#eaf6ff!important;
}
body:not(.playerTheme):not(.authMode) #tab-notifications .notificationTable tr.mine{
  background:#14354a!important;
  color:#eef8ff!important;
  outline:none!important;
  box-shadow:inset 4px 0 0 #35a6df!important;
}
body:not(.playerTheme):not(.authMode) #tab-notifications .notificationTable td,
body:not(.playerTheme):not(.authMode) #tab-notifications .notificationTable tr.mine td{
  background:transparent!important;
  color:#eaf6ff!important;
  border-color:#294b5f!important;
}
body:not(.playerTheme):not(.authMode) #tab-notifications .notificationTable td b{color:#fff!important}
body:not(.playerTheme):not(.authMode) #tab-notifications .notificationTable .small{color:#9fc1d5!important}
body:not(.playerTheme):not(.authMode) #tab-notifications .leaveRequestRow td{
  background:transparent!important;
}
body:not(.playerTheme):not(.authMode) #tab-notifications .leaveRequestRow td:first-child{
  border-left:5px solid #37b76c!important;
}
@media(max-width:760px){
  body:not(.playerTheme):not(.authMode) #tab-notifications .notificationTable tr{
    border-color:#31566b!important;
    background:#0b2433!important;
  }
  body:not(.playerTheme):not(.authMode) #tab-notifications .notificationTable tr.mine{
    background:#14354a!important;
  }
}



/* V96 — zawodnik: czytelniejsze karty zawodów. Regulamin i historia zostają wyłącznie w górnych zakładkach. */
@media(max-width:760px){
  body.playerTheme .playerCompCardV96{
    padding:8px!important;
    margin:0 0 7px!important;
    border-radius:9px!important;
    overflow:hidden!important;
  }
  body.playerTheme .playerCompCardV96 .playerCompCardHead{
    display:grid!important;
    grid-template-columns:40px minmax(0,1fr) auto!important;
    gap:7px!important;
    align-items:center!important;
    min-width:0!important;
  }
  body.playerTheme .playerCompCardV96 .playerCompNo{
    min-width:40px!important;
    width:40px!important;
    height:28px!important;
    min-height:28px!important;
    padding:0 3px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    font-size:12px!important;
    line-height:1!important;
    font-weight:1000!important;
    border-radius:6px!important;
  }
  body.playerTheme .playerCompCardV96 .playerCompCardTitle{
    min-width:0!important;
    color:#fff!important;
    font-size:15px!important;
    line-height:1.12!important;
    font-weight:1000!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }
  body.playerTheme .playerCompCardV96 .playerCompCardMeeting{
    color:#fff!important;
    border:1px solid #3b7294!important;
    background:#0a2638!important;
    border-radius:7px!important;
    padding:5px 7px!important;
    font-size:11px!important;
    line-height:1!important;
    font-weight:1000!important;
    white-space:nowrap!important;
  }
  body.playerTheme .playerCompCardV96 .playerCompCardDate{
    display:flex!important;
    align-items:center!important;
    gap:6px!important;
    margin-top:7px!important;
    min-width:0!important;
    flex-wrap:nowrap!important;
  }
  body.playerTheme .playerCompCardV96 .playerCompDate{
    color:#fff!important;
    font-size:16px!important;
    line-height:1!important;
    font-weight:1000!important;
    white-space:nowrap!important;
  }
  body.playerTheme .playerCompCardV96 .playerCompWeekday{
    font-size:9px!important;
    min-height:21px!important;
    padding:4px 7px!important;
    border-radius:6px!important;
    white-space:nowrap!important;
    flex:0 0 auto!important;
  }
  body.playerTheme .playerCompCardV96 .playerCompCountdown{
    margin:0!important;
    font-size:9px!important;
    min-height:21px!important;
    padding:4px 7px!important;
    border-radius:6px!important;
    white-space:nowrap!important;
    flex:0 0 auto!important;
  }
  body.playerTheme .playerCompCardV96 .playerCompCardFishery{
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto!important;
    gap:8px!important;
    align-items:center!important;
    margin-top:7px!important;
    min-width:0!important;
  }
  body.playerTheme .playerCompCardV96 .playerCompFishery{
    min-width:0!important;
    color:#d9f1ff!important;
    font-size:15px!important;
    line-height:1.08!important;
    font-weight:1000!important;
    white-space:nowrap!important;
    overflow:hidden!important;
    text-overflow:ellipsis!important;
  }
  body.playerTheme .playerCompCardV96 .playerCompFishery:before{
    content:'Łowisko ';font-weight:700!important;color:#9fcde5!important;
  }
  body.playerTheme .playerCompCardV96 .playerCompStatus{
    justify-self:end!important;
    min-height:24px!important;
    padding:4px 7px!important;
    font-size:8.5px!important;
    line-height:1!important;
    border-radius:6px!important;
    white-space:nowrap!important;
  }
  body.playerTheme .playerCompCardV96 .playerCompCardMeta{
    border-top:1px solid #345a70!important;
    margin-top:7px!important;
    padding-top:6px!important;
  }
  body.playerTheme .playerCompCardV96 .playerCompMiniInfo{
    display:flex!important;
    align-items:center!important;
    gap:5px!important;
    min-height:24px!important;
    overflow:visible!important;
    flex-wrap:wrap!important;
  }
  body.playerTheme .playerCompCardV96 .playerCompCountBadge{padding:4px 6px!important}
  body.playerTheme .playerCompCardV96 .playerCompCountBadge small{font-size:7px!important}
  body.playerTheme .playerCompCardV96 .playerCompCountBadge b{font-size:11px!important}
  body.playerTheme .playerCompCardV96 .playerCompMineStack{display:flex!important;align-items:center!important;gap:5px!important;flex-wrap:wrap!important}
  body.playerTheme .playerCompCardV96 .playerCompMineBadge{font-size:8.5px!important;padding:4px 6px!important}
  body.playerTheme .playerCompCardV96 .playerPresenceConfirm{font-size:8px!important;padding:4px 6px!important;min-height:24px!important}
  body.playerTheme .playerCompCardV96>.playerCompCompactActions{
    display:grid!important;
    grid-template-columns:1fr 1fr!important;
    gap:7px!important;
    margin-top:7px!important;
    width:100%!important;
  }
  body.playerTheme .playerCompCardV96>.playerCompCompactActions button{
    height:34px!important;
    min-height:34px!important;
    padding:5px 7px!important;
    font-size:10px!important;
    line-height:1!important;
    border-radius:7px!important;
  }
}
@media(max-width:370px){
  body.playerTheme .playerCompCardV96 .playerCompCardHead{grid-template-columns:36px minmax(0,1fr) auto!important;gap:5px!important}
  body.playerTheme .playerCompCardV96 .playerCompNo{min-width:36px!important;width:36px!important;font-size:11px!important}
  body.playerTheme .playerCompCardV96 .playerCompCardTitle{font-size:13.5px!important}
  body.playerTheme .playerCompCardV96 .playerCompCardMeeting{font-size:10px!important;padding:5px!important}
  body.playerTheme .playerCompCardV96 .playerCompDate{font-size:14.5px!important}
  body.playerTheme .playerCompCardV96 .playerCompWeekday,
  body.playerTheme .playerCompCardV96 .playerCompCountdown{font-size:8px!important;padding:4px 5px!important}
  body.playerTheme .playerCompCardV96 .playerCompFishery{font-size:13.5px!important}
  body.playerTheme .playerCompCardV96 .playerCompStatus{font-size:7.5px!important;padding:4px 5px!important}
}

/* V97 — zwarte karty zawodów na telefonie + czytelne zakładki Regulamin/Historia. */
body.playerTheme #playerRulesContent>.card,
body.playerTheme #playerHistoryContent>.card,
body.playerTheme .generalRulesPlayer,
body.playerTheme .playerHistoryCard{
  background:#0b2232!important;
  color:#eef8ff!important;
  border:1px solid #31566a!important;
  box-shadow:0 4px 14px #0004!important;
}
body.playerTheme #playerRulesContent h2,
body.playerTheme #playerHistoryContent h2,
body.playerTheme .generalRulesPlayer h2,
body.playerTheme .playerHistoryCard h2{color:#eef8ff!important}
body.playerTheme #playerRulesContent .muted,
body.playerTheme #playerHistoryContent .muted,
body.playerTheme .generalRulesPlayer .muted,
body.playerTheme .playerHistoryCard .muted{color:#a9c5d5!important}
@media(max-width:760px){
  body.playerTheme #app>.tabs{gap:3px!important}
  body.playerTheme #app>.tabs button{padding-left:5px!important;padding-right:5px!important;font-size:10px!important;min-width:0!important;flex:1 1 0!important}
  body.playerTheme #app>.tabs #btn-notifications{font-size:10px!important}
  body.playerTheme #app>.tabs #btn-history{font-size:9.2px!important;line-height:1.02!important;white-space:normal!important}

  body.playerTheme .playerCompCardV97{
    padding:6px 7px!important;
    margin:0 0 5px!important;
    border-radius:8px!important;
  }
  body.playerTheme .playerCompCardV97 .playerCompCardHead{
    grid-template-columns:38px minmax(0,1fr) auto!important;
    gap:5px!important;
    min-height:27px!important;
  }
  body.playerTheme .playerCompCardV97 .playerCompNo{
    min-width:38px!important;width:38px!important;height:26px!important;min-height:26px!important;
    font-size:11px!important;border-radius:6px!important;
  }
  body.playerTheme .playerCompCardV97 .playerCompCardTitle{
    font-size:14px!important;line-height:1.05!important;
  }
  body.playerTheme .playerCompCardV97 .playerCompCardMeeting{
    font-size:9.5px!important;padding:4px 5px!important;border-radius:6px!important;
  }
  body.playerTheme .playerCompCardV97 .playerCompCardDate{
    display:grid!important;
    grid-template-columns:auto auto auto minmax(68px,auto)!important;
    justify-content:start!important;
    align-items:center!important;
    gap:4px!important;
    margin-top:4px!important;
  }
  body.playerTheme .playerCompCardV97 .playerCompDate{font-size:13.5px!important}
  body.playerTheme .playerCompCardV97 .playerCompWeekday,
  body.playerTheme .playerCompCardV97 .playerCompCountdown,
  body.playerTheme .playerCompCardV97 .playerCompStatus{
    min-height:20px!important;height:20px!important;padding:3px 5px!important;border-radius:5px!important;
    font-size:7.4px!important;line-height:1!important;white-space:nowrap!important;
  }
  body.playerTheme .playerCompCardV97 .playerCompStatus{justify-self:start!important;margin:0!important}
  body.playerTheme .playerCompCardV97 .playerCompCardFishery{
    display:flex!important;align-items:center!important;gap:5px!important;
    margin-top:4px!important;min-height:24px!important;
  }
  body.playerTheme .playerCompCardV97 .playerCompFishery{
    flex:1 1 auto!important;min-width:74px!important;font-size:13.5px!important;line-height:1!important;
  }
  body.playerTheme .playerCompCardV97 .playerCompMineStack{
    flex:0 1 auto!important;display:flex!important;align-items:center!important;justify-content:flex-end!important;
    gap:4px!important;flex-wrap:nowrap!important;min-width:0!important;
  }
  body.playerTheme .playerCompCardV97 .playerCompMineBadge{
    font-size:7.5px!important;padding:3px 5px!important;min-height:20px!important;
  }
  body.playerTheme .playerCompCardV97 .playerPresenceConfirm{
    font-size:6.8px!important;padding:3px 5px!important;min-height:20px!important;height:20px!important;
    max-width:112px!important;line-height:1!important;white-space:nowrap!important;
  }
  body.playerTheme .playerCompCardV97 .playerCompCardMeta,
  body.playerTheme .playerCompCardV97>.playerCompCompactActions{display:none!important}
  body.playerTheme .playerCompCardV97 .playerCompBottomRow{
    display:grid!important;grid-template-columns:72px minmax(0,1fr) minmax(0,.92fr)!important;
    align-items:center!important;gap:5px!important;margin-top:5px!important;padding-top:5px!important;
    border-top:1px solid #345a70!important;min-width:0!important;
  }
  body.playerTheme .playerCompCardV97 .playerCompBottomCount{min-width:0!important;overflow:hidden!important}
  body.playerTheme .playerCompCardV97 .playerCompBottomCount .playerCompCountBadge{
    width:100%!important;display:flex!important;align-items:center!important;justify-content:center!important;gap:3px!important;
    padding:3px 4px!important;min-height:27px!important;border-radius:5px!important;white-space:nowrap!important;
  }
  body.playerTheme .playerCompCardV97 .playerCompBottomCount .playerCompCountBadge small{font-size:6.5px!important;margin:0!important}
  body.playerTheme .playerCompCardV97 .playerCompBottomCount .playerCompCountBadge b{font-size:10px!important}
  body.playerTheme .playerCompCardV97 .playerCompBottomCount .playerCompReserveBadge{display:none!important}
  body.playerTheme .playerCompCardV97 .playerCompBottomRow>button{
    min-width:0!important;width:100%!important;height:29px!important;min-height:29px!important;
    padding:3px 4px!important;border-radius:6px!important;font-size:8.5px!important;line-height:1!important;
    white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;
  }
}
@media(max-width:370px){
  body.playerTheme .playerCompCardV97 .playerCompCardDate{gap:3px!important;grid-template-columns:auto auto auto minmax(62px,auto)!important}
  body.playerTheme .playerCompCardV97 .playerCompDate{font-size:12.7px!important}
  body.playerTheme .playerCompCardV97 .playerCompWeekday,
  body.playerTheme .playerCompCardV97 .playerCompCountdown,
  body.playerTheme .playerCompCardV97 .playerCompStatus{font-size:6.8px!important;padding-left:4px!important;padding-right:4px!important}
  body.playerTheme .playerCompCardV97 .playerCompFishery{font-size:12.7px!important}
  body.playerTheme .playerCompCardV97 .playerPresenceConfirm{font-size:6.3px!important;max-width:103px!important}
  body.playerTheme .playerCompCardV97 .playerCompBottomRow{grid-template-columns:66px minmax(0,1fr) minmax(0,.9fr)!important;gap:4px!important}
  body.playerTheme .playerCompCardV97 .playerCompBottomRow>button{font-size:8px!important;padding-left:2px!important;padding-right:2px!important}
}


/* V98 — dopracowany, zwarty panel zawodów zawodnika zgodny z zaakceptowanym podglądem. */
@media(max-width:760px){
  body.playerTheme #app>.tabs{
    display:grid!important;
    grid-template-columns:repeat(5,minmax(0,1fr))!important;
    gap:4px!important;
  }
  body.playerTheme #app>.tabs button{
    min-width:0!important;
    min-height:42px!important;
    padding:5px 3px!important;
    font-size:9.4px!important;
    line-height:1.03!important;
    white-space:normal!important;
    overflow:visible!important;
    text-overflow:clip!important;
  }
  body.playerTheme #app>.tabs #btn-rules,
  body.playerTheme #app>.tabs #btn-history{
    font-size:9.1px!important;
    line-height:1.02!important;
  }

  body.playerTheme .playerCompCardV98{
    padding:6px 7px!important;
    margin:0 0 5px!important;
    border-radius:9px!important;
    overflow:hidden!important;
  }
  body.playerTheme .playerCompCardV98 .playerCompCardHead{
    display:grid!important;
    grid-template-columns:38px minmax(0,1fr) auto!important;
    align-items:center!important;
    gap:6px!important;
    min-height:27px!important;
  }
  body.playerTheme .playerCompCardV98 .playerCompNo{
    width:38px!important;min-width:38px!important;height:27px!important;min-height:27px!important;
    display:flex!important;align-items:center!important;justify-content:center!important;
    font-size:11px!important;line-height:1!important;border-radius:7px!important;
  }
  body.playerTheme .playerCompCardV98 .playerCompCardTitle{
    min-width:0!important;font-size:14px!important;line-height:1.03!important;
    white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;
  }
  body.playerTheme .playerCompCardV98 .playerCompCardMeeting{
    justify-self:end!important;font-size:9.2px!important;line-height:1!important;
    padding:4px 6px!important;min-height:24px!important;border-radius:7px!important;white-space:nowrap!important;
  }

  body.playerTheme .playerCompCardV98 .playerCompCardDate{
    display:flex!important;
    align-items:center!important;
    justify-content:flex-start!important;
    flex-wrap:nowrap!important;
    gap:4px!important;
    margin:4px 0 0!important;
    min-width:0!important;
  }
  body.playerTheme .playerCompCardV98 .playerCompDate{
    flex:0 0 auto!important;font-size:13.6px!important;line-height:1!important;white-space:nowrap!important;
  }
  body.playerTheme .playerCompCardV98 .playerCompWeekday,
  body.playerTheme .playerCompCardV98 .playerCompCountdown,
  body.playerTheme .playerCompCardV98 .playerCompStatus{
    flex:0 0 auto!important;
    min-height:20px!important;height:20px!important;
    padding:3px 5px!important;border-radius:6px!important;
    font-size:7.2px!important;line-height:1!important;white-space:nowrap!important;
  }
  body.playerTheme .playerCompCardV98 .playerCompStatus{margin-left:0!important}

  body.playerTheme .playerCompCardV98 .playerCompCardFishery{
    display:grid!important;
    grid-template-columns:minmax(0,1fr) auto!important;
    align-items:center!important;
    gap:6px!important;
    margin-top:4px!important;
    min-height:24px!important;
  }
  body.playerTheme .playerCompCardV98 .playerCompFishery{
    min-width:0!important;font-size:14px!important;line-height:1!important;font-weight:900!important;
    white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;
  }
  body.playerTheme .playerCompCardV98 .playerCompMineStack{
    min-width:0!important;
    display:flex!important;
    flex-direction:row!important;
    align-items:center!important;
    justify-content:flex-end!important;
    gap:4px!important;
    flex-wrap:nowrap!important;
  }
  body.playerTheme .playerCompCardV98 .playerCompMineBadge{
    flex:0 0 auto!important;
    font-size:7.1px!important;line-height:1!important;
    padding:3px 5px!important;min-height:20px!important;height:20px!important;
    display:inline-flex!important;align-items:center!important;justify-content:center!important;
    white-space:nowrap!important;border-radius:6px!important;
  }
  body.playerTheme .playerCompCardV98 .playerPresenceConfirm{
    flex:0 1 auto!important;
    max-width:118px!important;
    min-height:20px!important;height:20px!important;
    padding:3px 5px!important;
    font-size:6.5px!important;line-height:1!important;
    white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;
    border-radius:6px!important;
  }

  body.playerTheme .playerCompCardV98 .playerCompBottomRow{
    display:grid!important;
    grid-template-columns:72px minmax(0,1fr) minmax(0,.92fr)!important;
    align-items:center!important;
    gap:5px!important;
    margin-top:5px!important;
    padding-top:5px!important;
    border-top:1px solid #345a70!important;
  }
  body.playerTheme .playerCompCardV98 .playerCompBottomCount .playerCompCountBadge{
    width:100%!important;min-height:29px!important;
    display:flex!important;align-items:center!important;justify-content:center!important;gap:3px!important;
    padding:3px 4px!important;border-radius:6px!important;white-space:nowrap!important;
  }
  body.playerTheme .playerCompCardV98 .playerCompBottomCount .playerCompCountBadge small{font-size:6.5px!important;margin:0!important}
  body.playerTheme .playerCompCardV98 .playerCompBottomCount .playerCompCountBadge b{font-size:10.5px!important}
  body.playerTheme .playerCompCardV98 .playerCompBottomCount .playerCompReserveBadge{display:none!important}
  body.playerTheme .playerCompCardV98 .playerCompBottomRow>button{
    width:100%!important;min-width:0!important;
    min-height:29px!important;height:29px!important;
    padding:3px 4px!important;border-radius:7px!important;
    font-size:8.5px!important;line-height:1!important;font-weight:900!important;
    white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;
  }
  body.playerTheme .playerCompCardV98 .playerCompBottomMain{background:linear-gradient(#138f44,#0b6d34)!important;border-color:#43b96b!important}
  body.playerTheme .playerCompCardV98 .playerCompBottomRow>.warn{background:linear-gradient(#c83b35,#9d2f2a)!important;border-color:#e75b54!important}

  body.playerTheme .playerCompEmpty{
    min-height:44px!important;
    padding:12px 8px!important;
    margin:4px 0 0!important;
    display:flex!important;align-items:center!important;justify-content:center!important;
    font-size:12px!important;
  }
}
@media(max-width:370px){
  body.playerTheme .playerCompCardV98 .playerCompCardHead{grid-template-columns:36px minmax(0,1fr) auto!important;gap:4px!important}
  body.playerTheme .playerCompCardV98 .playerCompNo{width:36px!important;min-width:36px!important;font-size:10px!important}
  body.playerTheme .playerCompCardV98 .playerCompCardTitle{font-size:13.2px!important}
  body.playerTheme .playerCompCardV98 .playerCompCardMeeting{font-size:8.6px!important;padding-left:4px!important;padding-right:4px!important}
  body.playerTheme .playerCompCardV98 .playerCompCardDate{gap:3px!important}
  body.playerTheme .playerCompCardV98 .playerCompDate{font-size:12.6px!important}
  body.playerTheme .playerCompCardV98 .playerCompWeekday,
  body.playerTheme .playerCompCardV98 .playerCompCountdown,
  body.playerTheme .playerCompCardV98 .playerCompStatus{font-size:6.5px!important;padding-left:4px!important;padding-right:4px!important}
  body.playerTheme .playerCompCardV98 .playerCompFishery{font-size:13px!important}
  body.playerTheme .playerCompCardV98 .playerCompMineBadge{font-size:6.6px!important;padding-left:4px!important;padding-right:4px!important}
  body.playerTheme .playerCompCardV98 .playerPresenceConfirm{font-size:5.9px!important;max-width:105px!important;padding-left:4px!important;padding-right:4px!important}
  body.playerTheme .playerCompCardV98 .playerCompBottomRow{grid-template-columns:66px minmax(0,1fr) minmax(0,.88fr)!important;gap:4px!important}
  body.playerTheme .playerCompCardV98 .playerCompBottomRow>button{font-size:7.8px!important}
}

</style>
</head>
<body class="authMode">
<div id="bootGuard"><img src="/icon-192.png" alt=""><b>Łowcy Methodowcy</b><span>Aktualizuję aplikację…</span></div>
<header><div class="row"><h1><img class="brandIcon" src="/icon-64.png" alt="">Łowcy Methodowcy <span class="headerVersion">V98</span></h1><div class="top-actions"><button type="button" id="logoutBtn" class="hidden">Wyloguj</button></div></div></header>
<main>
<div id="msg"></div>
<section id="auth" class="card">
  <h2>Logowanie</h2>
  <div class="grid"><div><label>Telefon</label><input id="loginPhone" autocomplete="username"></div><div><label>Hasło</label><input id="loginPassword" type="password" autocomplete="current-password"></div></div>
  <div class="grid" style="margin-top:10px"><button type="button" id="loginBtn" onclick="login(event)">Zaloguj</button><button type="button" id="clearSessionBtn" class="secondary">Wyczyść sesję</button></div>
  <div class="twoCols">
    <div class="card playerRegisterCard"><h3>Rejestracja zawodnika</h3><p class="small muted">Załóż konto zawodnika, aby zapisywać się na zawody i sprawdzać losowania oraz wyniki.</p><label>Telefon</label><input id="regPhone" autocomplete="tel"><label>Hasło</label><input id="regPassword" type="password" autocomplete="new-password"><label>Imię</label><input id="regFirst" autocomplete="given-name"><label>Nazwisko</label><input id="regLast" autocomplete="family-name"><label>Nr Koła PZW</label><input id="regClub"><button type="button" id="regBtn">Utwórz konto zawodnika</button></div>
    <details class="adminSetupGate"><summary>Konfiguracja pierwszego administratora</summary><div class="card adminSetupCard"><h3>Konto administratora</h3><p class="small muted">Ta ścieżka jest tylko dla właściciela systemu. Wymaga kodu setupu i działa wyłącznie, jeśli administrator nie został jeszcze utworzony.</p><label>Kod setupu</label><input id="setupCode" autocomplete="off"><label>Telefon administratora</label><input id="setupPhone" autocomplete="tel"><label>Hasło</label><input id="setupPassword" type="password" autocomplete="new-password"><label>Imię</label><input id="setupFirst" autocomplete="given-name"><label>Nazwisko</label><input id="setupLast" autocomplete="family-name"><label>Koło PZW</label><input id="setupClub"><button type="button" id="setupAdminBtn">Utwórz konto administratora</button></div></details>
  </div>
</section>
<section id="app" class="hidden">
  <div class="card success-line compactUserBar"><div class="adminbar"><div><b id="who"></b><br><span id="role" class="muted small"></span></div><div id="notifCounter" class="ok"></div><div class="right"><span class="appVersionBadge">V98</span><div id="pushStatus" class="pushBox hidden"></div></div></div></div>
  <div class="tabs"><button id="btn-competitions" onclick="showTab('competitions')">Zawody</button><button id="btn-rules" class="hidden" onclick="showTab('rules')">Regulamin ogólny</button><button id="btn-notifications" onclick="showTab('notifications')">Powiadomienia</button><button id="btn-profile" class="hidden" onclick="showTab('profile')">Mój profil</button><button id="btn-history" class="hidden" onclick="showTab('history')">Historia startów</button><button id="btn-players" class="hidden" onclick="showTab('players')">Zawodnicy</button></div>
  <section id="tab-competitions">
    <div id="adminCreate" class="card hidden adminCreateV93"><h2>Utwórz zawody</h2><p class="small muted">Dane z tego formularza są później widoczne dla zawodnika.</p><div class="grid"><div><label>Nazwa zawodów</label><input id="cTitle" value="Method Feeder" placeholder="Method Feeder"></div><div><label>Łowisko</label><input id="cFishery" placeholder="Łowisko Lasomin"></div><div><label>Data zawodów</label><input id="cDate" type="date"></div><div><label>Zbiórka / godzina</label><input id="cMeetingTime" type="time" value="06:00"></div><div><label>Liczba osób / limit listy głównej</label><input id="cLimit" type="number" min="1" placeholder="30"></div></div><div class="adminTextPair"><div><label>Informacje organizacyjne</label><textarea id="cNotes" placeholder="Parking, miejsce zbiórki, godzina losowania, dodatkowe informacje…"></textarea></div><div><label>Program / regulamin tych zawodów</label><textarea id="cRegulations" class="rulesEditor" placeholder="Np. 06:00 zbiórka, 06:15 losowanie, 07:00–15:00 zawody, ważne zasady tylko dla tego wydarzenia…"></textarea></div></div><button onclick="createCompetition(event)">Utwórz zawody</button></div>
    <div class="card"><h2>Lista zawodów</h2><div id="competitionsList"></div></div>
    <div id="competitionDetail" class="hidden"></div>
  </section>
  <section id="tab-notifications" class="hidden"><div class="card"><div class="notificationHeaderRow"><h2>Powiadomienia</h2><div class="phoneAlertControls"><span id="notifPushState" class="small muted">Alerty telefonu</span><button type="button" id="notifPushBtn" class="secondary" onclick="enablePush(event)">Włącz alerty telefonu</button></div></div><div id="notificationsList"></div></div></section>
  <section id="tab-rules" class="hidden"><div id="playerRulesContent"></div></section>
  <section id="tab-profile" class="hidden"><div id="myProfileContent"></div></section>
  <section id="tab-history" class="hidden"><div id="playerHistoryContent"></div></section>
  <section id="tab-players" class="hidden"><div class="card"><h2>Zawodnicy</h2><div id="playersList"></div></div></section>
</section>
</main>
<div class="quickScroll"><button onclick="scrollAppTop()">↑</button><button onclick="scrollAppBottom()">↓</button></div>
<script>
(function(){
  var retried=false;
  try{retried=sessionStorage.getItem('lowcy_update_retry_98')==='1'}catch(e){}
  window.__lowcyRecover98=function(){
    if(retried){var g=document.getElementById('bootGuard');if(g){var s=g.querySelector('span');if(s)s.textContent='Nie udało się pobrać aktualizacji. Odśwież stronę.'}return}
    retried=true;try{sessionStorage.setItem('lowcy_update_retry_98','1')}catch(e){}
    var jobs=[];
    try{if('caches'in window)jobs.push(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k.indexOf('lowcy-shell-')===0}).map(function(k){return caches.delete(k)}))}))}catch(e){}
    try{if('serviceWorker'in navigator)jobs.push(navigator.serviceWorker.getRegistration('/').then(function(r){return r?r.update():null}))}catch(e){}
    Promise.allSettled(jobs).finally(function(){location.replace('/?update=98&t='+Date.now())});
  };
  setTimeout(function(){if(!window.__LOWCY_BOOT_OK_98)window.__lowcyRecover98()},15000);
})();
</script>
<script src="/app.js?v=98" defer onerror="window.__lowcyRecover98&&window.__lowcyRecover98()"></script>
</body>
</html>`;

waitForDb().then(() => {
  const server = http.createServer((req, res) => {
    route(req, res).catch(err => {
      console.error('REQ_ERR', err);
      sendJson(res, 500, { ok:false, error:'Błąd serwera' });
    });
  });
  server.listen(PORT, '0.0.0.0', () => { console.log('LOWCY_METHODOWCY_V98_COMPACT_PLAYER_CARDS_POLISH_READY'); console.log('CARP_MOBILE_READY port=' + PORT); });
}).catch(err => { console.error('START_FAILED', err); process.exit(1); });
