
const http = require('http');
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
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@carp.local';
const APP_VERSION = '22';
const APP_VERSION_NAME = 'V22_NO_RELOAD_SAFE_SCROLL';

if (webpush && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

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
    const { rows } = await pool.query('select id, phone, first_name, last_name, pzw_club, role, created_at from users where id=$1', [p.uid]);
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
    create table if not exists push_subscriptions (
      id bigserial primary key,
      user_id bigint not null references users(id) on delete cascade,
      endpoint text not null unique,
      subscription jsonb not null,
      created_at timestamptz not null default now()
    );
  `);
  await pool.query(`
    alter table competitions add column if not exists map_mode text not null default 'TWO_OPPOSITE';
    alter table competitions add column if not exists bank1_count integer not null default 15;
    alter table competitions add column if not exists bank2_count integer not null default 15;
    alter table competitions add column if not exists sectors_count integer not null default 4;
    alter table competitions add column if not exists signup_open boolean not null default true;
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

async function pushToUser(userId, title, body, url='/') {
  if (!webpush || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  const subs = await pool.query('select id, subscription from push_subscriptions where user_id=$1', [userId]);
  for (const s of subs.rows) {
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify({ title, body, url }));
    } catch (e) {
      console.log('PUSH_SEND_ERR user=' + userId + ' sub=' + s.id + ' ' + e.message);
    }
  }
}
async function notifyUser(userId, type, title, body, data={}) {
  await pool.query('insert into notifications(recipient_user_id,type,title,body,data) values($1,$2,$3,$4,$5)', [userId, type, title, body, data]);
  await pushToUser(userId, title, body, data.url || '/');
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
  const { rows } = await pool.query('update competitions set bank1_count=$1, bank2_count=$2 where id=$3 returning *', [split.bank1, split.bank2, competitionId]);
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
    const order = raw.slice().sort((a,b)=>((b.val - Math.floor(b.val)) - (a.val - Math.floor(a.val))) || a.i - b.i);
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
function sectorLayoutForCompetition(comp) {
  const b1 = Math.max(0, Number(comp.bank1_count || 0));
  const b2 = Math.max(0, Number(comp.bank2_count || 0));
  const total = Math.max(1, b1 + b2);
  const mode = comp.map_mode || 'TWO_OPPOSITE';
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
  await autoSyncBanksForRoster(competitionId);
  const comp = await getCompetition(competitionId);
  if (!comp) throw new Error('Nie znaleziono zawodów');
  const entries = await getActiveEntries(competitionId);
  if (!entries.length) throw new Error('Brak aktywnych zawodników do losowania');
  const stands = makeStandList(comp, entries.length);
  let assignment = [];

  if (round === 2) {
    const t1 = await pool.query('select user_id, stand from draws where competition_id=$1 and round=1', [competitionId]);
    const t1Map = new Map(t1.rows.map(r => [Number(r.user_id), Number(r.stand)]));
    let poolStands = shuffle(stands);
    const maxTry = 600;
    let ok = false;
    for (let attempt=0; attempt<maxTry; attempt++) {
      poolStands = shuffle(stands).slice(0, entries.length);
      ok = entries.every((e, idx) => !t1Map.has(Number(e.user_id)) || Number(poolStands[idx]) !== Number(t1Map.get(Number(e.user_id))));
      if (ok) break;
    }
    if (!ok) {
      poolStands = [];
      const used = new Set();
      for (const e of entries) {
        const own = t1Map.get(Number(e.user_id));
        const cand = stands.find(s => !used.has(s) && s !== own) || stands.find(s => !used.has(s));
        if (!cand) throw new Error('Nie da się wylosować T2 bez powtórzeń przy tej liczbie stanowisk');
        used.add(cand); poolStands.push(cand);
      }
    }
    assignment = entries.map((e, idx) => ({ userId: e.user_id, stand: poolStands[idx], sector: sectorForStand(poolStands[idx], comp), name: e.first_name + ' ' + e.last_name }));
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
    await notifyUser(e.user_id, 'DRAW_PUBLISH', 'Opublikowano losowanie', `${comp.title}: ${parts.join(' | ')}`, { competitionId, t1:t1?{stand:t1.stand,sector:t1.sector}:null, t2:t2?{stand:t2.stand,sector:t2.sector}:null, url:'/' });
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
    roundRows[round] = Array.from(grouped.values()).flat().sort((a,b)=>String(a.sector).localeCompare(String(b.sector),'pl') || (a.points-b.points) || (b.weight-a.weight) || (a.stand||9999)-(b.stand||9999));
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
  const { rows } = await pool.query(`
    insert into users(phone,password_hash,first_name,last_name,pzw_club,role)
    values($1,$2,$3,$4,$5,'PLAYER')
    on conflict(phone) do update set first_name=excluded.first_name, last_name=excluded.last_name, pzw_club=excluded.pzw_club
    returning id, first_name, last_name, phone, pzw_club
  `, [phone, passwordHash, firstName, lastName, pzwClub]);
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

async function route(req, res) {
  const url = new URL(req.url, 'http://local');
  const path = url.pathname;
  const method = req.method;

  if (path === '/__probe_js_v22' || path === '/__probe_boot_v22') return sendJson(res, 200, { ok:true, path, version:APP_VERSION_NAME, appVersion:APP_VERSION, time:nowIso() });
  if (path === '/api/version') return sendJson(res, 200, { ok:true, version:APP_VERSION_NAME, appVersion:APP_VERSION, time:nowIso() });
  if (path === '/app.js') return send(res, 200, APP_JS, {'Content-Type':'application/javascript; charset=utf-8', 'Cache-Control':'no-store, no-cache, must-revalidate'});

  if (path === '/health') return sendJson(res, 200, { ok:true, time:nowIso(), version:APP_VERSION_NAME });
  if (path === '/manifest.webmanifest') return send(res, 200, JSON.stringify({
    name:'Łowcy Methodowcy', short_name:'Łowcy', start_url:'/', scope:'/', id:'/', display:'standalone', background_color:'#f3f6ef', theme_color:'#114b2f', icons:[]
  }), {'Content-Type':'application/manifest+json; charset=utf-8'});
  if (path === '/sw.js') return send(res, 200, `
const SW_VERSION='lowcy-v22-no-reload-safe-scroll';
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil((async()=>{try{const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)));}catch(e){} await self.clients.claim();})()));
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}
  event.waitUntil(self.registration.showNotification(data.title || 'Łowcy Methodowcy', { body: data.body || 'Nowe powiadomienie', data: { url: data.url || '/'  } }));
});
self.addEventListener('notificationclick', event => { event.notification.close(); event.waitUntil(clients.openWindow((event.notification.data && event.notification.data.url) || '/')); });
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
      `insert into users(phone,password_hash,first_name,last_name,pzw_club,role) values($1,$2,$3,$4,$5,'ADMIN') returning id, phone, first_name, last_name, pzw_club, role, created_at`,
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
        `insert into users(phone,password_hash,first_name,last_name,pzw_club,role) values($1,$2,$3,$4,$5,'PLAYER') returning id, phone, first_name, last_name, pzw_club, role, created_at`,
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
    return sendJson(res, 200, { ok:true, user:{id:u.id,phone:u.phone,first_name:u.first_name,last_name:u.last_name,pzw_club:u.pzw_club,role:u.role,created_at:u.created_at}, token:signToken(u) });
  }

  const user = await auth(req);
  if (path === '/api/me') { if (!requireUser(user, res)) return; return sendJson(res, 200, { ok:true, user }); }
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

  if (path === '/api/competitions' && method === 'GET') {
    if (!requireUser(user, res)) return;
    const { rows } = await pool.query(`
      select c.*, (select count(*)::int from entries e where e.competition_id=c.id and e.status='ACTIVE') active_count,
             (select count(*)::int from entries e where e.competition_id=c.id and e.status='RESERVE') reserve_count,
             (select status from entries e where e.competition_id=c.id and e.user_id=$1) my_status
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
      `insert into competitions(title,fishery,competition_date,limit_places,status,notes,created_by,map_mode,bank1_count,bank2_count,sectors_count,signup_open)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning *`,
      [title, fishery, b.competitionDate || null, limit, b.status || 'OPEN', String(b.notes||''), user.id, mapMode, bank1, bank2, sectors, b.signupOpen !== false]
    );
    await notifyAdmins('COMPETITION_CREATE', 'Utworzono zawody', user.first_name + ' ' + user.last_name + ' utworzył zawody: ' + rows[0].title, { competitionId: rows[0].id });
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
    const { rows } = await pool.query(`
      update competitions set title=$1, fishery=$2, competition_date=$3, limit_places=$4, status=$5, notes=$6, map_mode=$7, bank1_count=$8, bank2_count=$9, sectors_count=$10, signup_open=$11
      where id=$12 returning *
    `, [String(b.title||old.title).trim(), String(b.fishery||'').trim(), b.competitionDate || null, limit, b.status || old.status || 'OPEN', String(b.notes||''), mapMode, bank1, bank2, sectors, b.signupOpen !== false, id]);
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
    await pool.query(`update entries set status=$1, cancelled_at=case when $1='CANCELLED' then now() else null end where id=$2`, [newStatus, entryId]);
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
    await pool.query(`insert into entries(competition_id,user_id,status,joined_at,cancelled_at) values($1,$2,$3,now(),null)
      on conflict(competition_id,user_id) do update set status=excluded.status, joined_at=now(), cancelled_at=null`, [id, user.id, wantedStatus]);
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
    await pool.query(`update entries set status='CANCELLED', cancelled_at=now() where competition_id=$1 and user_id=$2`, [id, user.id]);
    await notifyAdmins('LEAVE', 'Wypis z zawodów', `${user.first_name} ${user.last_name} wypisał się: ${c.title}`, { competitionId:id, userId:user.id });
    await notifyUser(user.id, 'LEAVE_CONFIRM', 'Wypisano z zawodów', `Wypisałeś się: ${c.title}`, { competitionId:id });
    await autoSyncBanksForRoster(id);
    return sendJson(res, 200, { ok:true });
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
  m = path.match(/^\/api\/admin\/competitions\/(\d+)\/results\/(1|2)\/generate$/);
  if (m && method === 'POST') {
    if (!requireAdmin(user, res)) return;
    try {
      const out = await generateRandomResults(Number(m[1]), Number(m[2]), user);
      return sendJson(res, 200, { ok:true, count:out.count });
    } catch (e) { return sendJson(res, 400, { ok:false, error:e.message }); }
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
      await notifyAdmins('RESULT_ITEM_T'+round, 'Dodano wagę T'+round, `${user.first_name} ${user.last_name} dodał wagę ${out.item.weight} g (${out.item.kind}) do: ${comp.title}`, { competitionId:compId, round, userId:Number(b.userId), itemId:out.item.id });
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
    for (const e of active) await notifyUser(e.user_id, 'RESULTS_T'+round, 'Wyniki T'+round, `Są dostępne wyniki T${round}: ${comp.title}`, { competitionId:compId, round, url:'/' });
    await notifyAdmins('RESULTS_NOTIFY_T'+round, 'Powiadomiono o wynikach T'+round, `Wysłano powiadomienia o wynikach T${round}: ${comp.title}`, { competitionId:compId, round });
    return sendJson(res, 200, { ok:true, notified: active.length });
  }

  if ((path === '/api/notifications' || path === '/api/admin/notifications') && method === 'GET') {
    if (!requireUser(user, res)) return;
    if (path === '/api/admin/notifications' && user.role !== 'ADMIN') return sendJson(res, 403, { ok:false, error:'Brak uprawnień admina' });
    const { rows } = await pool.query(`select * from notifications where recipient_user_id=$1 order by created_at desc limit 150`, [user.id]);
    return sendJson(res, 200, { ok:true, notifications:rows });
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
      (select count(*)::int from entries e where e.user_id=u.id and e.status='ACTIVE') active_entries
      from users u order by u.created_at desc
    `);
    return sendJson(res, 200, { ok:true, players:rows });
  }

  return send(res, 200, HTML);
}

const APP_JS = String.raw`const CLIENT_VERSION='22';const CLIENT_VERSION_NAME='V22_NO_RELOAD_SAFE_SCROLL';try{fetch('/__probe_js_v22',{cache:'no-store'}).catch(()=>{})}catch(_){};console.log('CLIENT_V22_NO_RELOAD_SAFE_SCROLL_LOADED');(async()=>{try{const k='lowcy_app_version_seen';const old=localStorage.getItem(k);if(old!==CLIENT_VERSION){localStorage.setItem(k,CLIENT_VERSION);try{if('caches'in window){const keys=await caches.keys();await Promise.all(keys.map(x=>caches.delete(x)));}}catch(_){}/* Bez wymuszonego location.replace — koniec pętli odświeżania. */}}catch(e){console.warn('version guard',e)}})();
const STORE={get(k){try{return localStorage.getItem(k)||''}catch(e){return ''}},set(k,v){try{localStorage.setItem(k,v)}catch(e){}},del(k){try{localStorage.removeItem(k)}catch(e){}}};
let TOKEN = STORE.get('carp_token') || '';
let ME = null;
let CURRENT_DETAIL = null;
let CREATING_COMPETITION = false;
let SAVING_RESULTS = false;
let SAVING_RESULT_ITEM = false;
let STRUCTURE_SAVE_TIMER = null;
let STRUCTURE_READY = false;
const q = id => document.getElementById(id);
window.addEventListener('error',e=>{console.error('CLIENT_ERR',e.message);try{const m=document.getElementById('msg');if(m)m.innerHTML='<div class=\\"card bad danger-line\\">Błąd ekranu: '+String(e.message||'nieznany')+'</div>'}catch(_){}});
window.addEventListener('unhandledrejection',e=>{console.error('CLIENT_REJECT',e.reason);});
function esc(s){return String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function msg(t,type='ok'){const el=q('msg');if(!el)return;el.innerHTML='<div class="card '+(type==='bad'?'bad danger-line':'ok success-line')+'">'+esc(t)+'</div>';setTimeout(()=>{const x=q('msg');if(x)x.innerHTML=''},3500)}
async function api(path, opts={}){const res=await fetch(path,Object.assign({cache:'no-store',headers:{'Content-Type':'application/json',...(TOKEN?{Authorization:'Bearer '+TOKEN}:{})}},opts));const data=await res.json().catch(()=>({ok:false,error:'Błąd odpowiedzi'}));if(!res.ok||data.ok===false)throw new Error(data.error||'Błąd');return data}
function fmtDate(d){if(!d)return '—';const s=String(d);const m=s.match(/^\\d{4}-\\d{2}-\\d{2}/);const dt=new Date(m?(m[0]+'T12:00:00'):s);return isNaN(dt.getTime())?'—':dt.toLocaleDateString('pl-PL')}
function dateInputValue(d){if(!d)return '';const s=String(d);const m=s.match(/^\\d{4}-\\d{2}-\\d{2}/);return m?m[0]:''}
function fmtGram(v){v=Number(v||0);return v?String(v).replace(/\\B(?=(\\d{3})+(?!\\d))/g,' '):'0'}
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
  try{if('serviceWorker'in navigator)navigator.serviceWorker.register('/sw.js?v='+CLIENT_VERSION).catch(()=>{})}catch(_){}
  renderPushStatus();
  showTab('competitions');
  await Promise.allSettled([loadCompetitions(),loadNotifications(),admin?loadPlayers():Promise.resolve()]);
}
async function login(){try{const d=await api('/api/login',{method:'POST',body:JSON.stringify({phone:q('loginPhone').value,password:q('loginPassword').value})});TOKEN=d.token;STORE.set('carp_token',TOKEN);msg('Zalogowano');boot()}catch(e){msg(e.message,'bad')}}
async function registerPlayer(){try{const d=await api('/api/register',{method:'POST',body:JSON.stringify({phone:q('regPhone').value,password:q('regPassword').value,firstName:q('regFirst').value,lastName:q('regLast').value,pzwClub:q('regClub').value})});TOKEN=d.token;STORE.set('carp_token',TOKEN);msg('Konto zawodnika utworzone');boot()}catch(e){msg(e.message,'bad')}}
async function setupAdmin(){try{const d=await api('/api/setup-admin',{method:'POST',body:JSON.stringify({setupCode:q('setupCode').value,phone:q('setupPhone').value,password:q('setupPassword').value,firstName:q('setupFirst').value,lastName:q('setupLast').value,pzwClub:q('setupClub').value})});TOKEN=d.token;STORE.set('carp_token',TOKEN);msg('Admin utworzony');boot()}catch(e){msg(e.message,'bad')}}
function logout(){STORE.del('carp_token');TOKEN='';ME=null;setLoggedOut(true)}
function clearSession(){setLoggedOut(true)}
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
  const d=CURRENT_DETAIL;const c=d.competition;const admin=ME.role==='ADMIN';let html='<div class="card"><div class="inlineBtns"><button type="button" class="secondary" onclick="q(\\'competitionDetail\\').classList.add(\\'hidden\\')">Zamknij panel zawodów</button><button type="button" onclick="openCompetition('+c.id+')">Odśwież</button></div><h2>'+esc(c.title)+'</h2><p class="muted">'+fmtDate(c.competition_date)+' — '+esc(c.fishery||'')+'</p></div>';
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
function rosterTable(title,rows,compId,kind){rows=rows||[];let html='<h3>'+title+' <span class="pill">'+rows.length+'</span></h3>';if(!rows.length)return html+'<p class="muted small">Brak.</p>';html+='<div class="tablewrap"><table><thead><tr><th>Zawodnik</th><th>Telefon</th><th>Koło</th><th>Status</th><th>Akcja</th></tr></thead><tbody>';html+=rows.map(e=>{let buttons='';if(kind==='ACTIVE')buttons='<div class="inlineBtns"><button type="button" class="secondary" onclick="setEntryStatus('+compId+','+e.id+',\\'reserve\\')">⬇ Rezerwa</button><button type="button" class="warn" onclick="setEntryStatus('+compId+','+e.id+',\\'cancel\\')">Wypisz</button></div>';else if(kind==='RESERVE')buttons='<div class="inlineBtns"><button type="button" onclick="setEntryStatus('+compId+','+e.id+',\\'promote\\')">⬆ Do głównej</button><button type="button" class="warn" onclick="setEntryStatus('+compId+','+e.id+',\\'cancel\\')">Wypisz</button></div>';else buttons='<button type="button" class="secondary" onclick="setEntryStatus('+compId+','+e.id+',\\'reserve\\')">Przywróć na rezerwę</button>';return '<tr><td><b>'+esc(e.first_name+' '+e.last_name)+'</b></td><td class="nowrap">'+esc(e.phone)+'</td><td>'+esc(e.pzw_club)+'</td><td><span class="pill">'+statusLabel(e.status)+'</span></td><td>'+buttons+'</td></tr>'}).join('');return html+'</tbody></table></div>'}
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
function renderResultForm(d,round){const entries=d.activeEntries||[];const dm=drawMap(round);const rm=resMap(round);if(!entries.length)return '<p class="muted">Brak aktywnych zawodników.</p>';let html='<div class="tablewrap"><table class="resultInputTable"><thead><tr><th>Zawodnik</th><th>Stan.</th><th>Sektor</th><th>Wagi siatek</th><th>Duże ryby BF</th><th>Suma</th></tr></thead><tbody>';html+=entries.map(e=>{const uid=Number(e.user_id),dr=dm[uid],r=rm[uid]||{};return '<tr><td><b>'+esc(e.first_name+' '+e.last_name)+'</b></td><td>'+(dr?esc(dr.stand):'—')+'</td><td>'+(dr?esc(dr.sector):'—')+'</td><td>'+renderWeightItems(round,uid,'NET')+'<input class="weightInput" inputmode="numeric" id="net-'+round+'-'+uid+'" placeholder="nowa waga siatki g" onblur="addWeightItem('+d.competition.id+','+round+','+uid+',\\'NET\\',this)" onkeydown="weightKey(event)"></td><td>'+renderWeightItems(round,uid,'BF')+'<input class="weightInput" inputmode="numeric" id="bf-'+round+'-'+uid+'" placeholder="nowa duża ryba g" onblur="addWeightItem('+d.competition.id+','+round+','+uid+',\\'BF\\',this)" onkeydown="weightKey(event)"></td><td class="nowrap">'+resultCellSummary(r)+'</td></tr>'}).join('');return html+'</tbody></table></div>'}
function weightKey(ev){if(ev.key==='Enter'){ev.preventDefault();ev.target.blur();}}
async function refreshCompetitionKeepScroll(compId){const y=window.scrollY||document.documentElement.scrollTop||0;const x=window.scrollX||document.documentElement.scrollLeft||0;try{const d=await api('/api/competitions/'+compId);CURRENT_DETAIL=d;renderDetail();q('competitionDetail').classList.remove('hidden');requestAnimationFrame(()=>{const maxY=Math.max(0,document.documentElement.scrollHeight-window.innerHeight);window.scrollTo({left:x,top:Math.min(y,maxY),behavior:'auto'});});}catch(e){msg(e.message,'bad')}}
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
async function enablePush(){try{if(!('Notification'in window))throw new Error('Ta przeglądarka nie obsługuje powiadomień');if(Notification.permission==='denied')throw new Error('Push jest zablokowany w ustawieniach strony. Odblokuj ręcznie w przeglądarce: ustawienia strony/kłódka → Powiadomienia → Zezwalaj. Tego nie da się przestawić kodem.');if(!('serviceWorker'in navigator)||!('PushManager'in window))throw new Error('Ten telefon/przeglądarka nie obsługuje push w PWA');if(!TOKEN)throw new Error('Najpierw się zaloguj');const cfg=await api('/api/config');if(!cfg.pushReady)throw new Error('Push nie jest jeszcze skonfigurowany na serwerze');const reg=await navigator.serviceWorker.register('/sw.js?v='+CLIENT_VERSION);const perm=await Notification.requestPermission();if(perm!=='granted')throw new Error('Brak zgody na powiadomienia');let sub=await reg.pushManager.getSubscription();if(!sub)sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(cfg.vapidPublicKey)});await api('/api/push-subscription',{method:'POST',body:JSON.stringify({subscription:sub})});msg('Push włączony na tym urządzeniu');renderPushStatus()}catch(e){msg(e.message,'bad');renderPushStatus()}}
function scrollAppTop(){window.scrollTo({top:0,behavior:'smooth'})}
function scrollAppBottom(){window.scrollTo({top:document.documentElement.scrollHeight,behavior:'smooth'})}
Object.assign(window,{login,registerPlayer,setupAdmin,logout,showTab,loadCompetitions,createCompetition,deleteCompetition,clearCompetitions,joinComp,leaveComp,openCompetition,saveCompetition,drawRound,publishDraw,saveResults,generateResults,generateResultsAll,addWeightItem,deleteWeightItem,notifyResults,readNotif,loadNotifications,loadPlayers,enablePush,resetPush,clearSession,importZawodyPro,addManualPlayer,setEntryStatus,setupStructureAuto,autoFillBanksFromRoster,updateStructurePreview,scrollAppTop,scrollAppBottom});
function startBoot(){console.log('CLIENT_V21_BOOT');try{fetch('/__probe_boot_v21',{cache:'no-store'}).catch(()=>{})}catch(_){};boot().catch(e=>{console.error('BOOT_FATAL',e);try{msg('Błąd startu aplikacji: '+(e.message||e),'bad')}catch(_){}})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',startBoot);else startBoot();`;

const HTML = `<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#114b2f">
<link rel="manifest" href="/manifest.webmanifest">
<title>Łowcy Methodowcy</title>
<style>
:root{--green:#114b2f;--green2:#17643f;--bg:#f3f6ef;--card:#fff;--line:#cfd8cc;--txt:#18251d;--muted:#68746d;--red:#b32020;--gold:#ffc400;--blue:#1057c8;--soft:#eaf2eb}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}header{position:sticky;top:0;z-index:5;background:var(--green);color:white;padding:12px 14px;box-shadow:0 2px 8px #0002}header .row{display:flex;justify-content:space-between;gap:12px;align-items:center;max-width:1180px;margin:auto}h1{font-size:18px;margin:0}h2{font-size:18px;margin:0 0 8px}h3{font-size:16px;margin:12px 0 8px}main{max-width:1180px;margin:0 auto;padding:12px}.card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;margin:12px 0;box-shadow:0 2px 8px #0000000d}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}input,select,textarea,button{width:100%;font:inherit;border-radius:12px;border:1px solid var(--line);padding:10px 11px;background:white}textarea{min-height:70px}button{border:0;background:var(--green);color:white;font-weight:900;cursor:pointer}button.secondary{background:#e7eee7;color:var(--green);border:1px solid #bfd0c2}button.warn{background:var(--red)}button.blue{background:var(--blue)}button:disabled{opacity:.55;cursor:not-allowed}label{display:block;font-size:12px;font-weight:900;color:var(--muted);margin:8px 0 4px}.tabs{display:flex;gap:8px;overflow:auto;padding:8px 0}.tabs button{white-space:nowrap;width:auto;padding:9px 13px}.tabs button.active{background:#072e1c}.tablewrap{width:100%;overflow:auto;border-radius:12px;border:1px solid var(--line)}table{width:100%;border-collapse:collapse;background:white}th,td{border:1px solid var(--line);padding:8px 7px;text-align:left;vertical-align:middle}th{background:#e6f0e8;color:#103b28;font-size:12px;text-transform:uppercase}.nowrap{white-space:nowrap}.muted{color:var(--muted)}.ok{color:var(--green);font-weight:900}.bad{color:var(--red);font-weight:900}.pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#e6f0e8;font-weight:900}.hidden{display:none!important}.top-actions{display:flex;gap:8px;align-items:center}.top-actions button{width:auto;padding:8px 11px;background:#ffffff22;border:1px solid #ffffff55}.small{font-size:12px}.right{text-align:right}.mine{background:#fff4b8!important;outline:3px solid var(--gold);outline-offset:-3px;font-weight:900}.mine td{font-weight:900}.danger-line{border-left:6px solid var(--red)}.success-line{border-left:6px solid var(--green)}.mapbox{background:#f7faf4;border:1px solid var(--line);border-radius:14px;padding:10px;overflow:auto}.banktitle{font-size:12px;font-weight:900;color:var(--muted);margin:8px 0 5px}.bank{display:grid;grid-template-columns:repeat(auto-fit,minmax(42px,1fr));gap:5px;min-width:320px}.stand{min-height:42px;border:1px solid #a8b7aa;border-radius:9px;background:white;display:flex;align-items:center;justify-content:center;flex-direction:column;font-weight:900;font-size:12px}.stand small{font-size:9px;font-weight:800;color:#555}.stand.occ{box-shadow:inset 0 -4px 0 #cbd8cc}.stand.t1{background:#ffe1e1;border:3px solid #d00000;color:#8e0000}.stand.t2{background:#dfeaff;border:3px solid #005bd8;color:#003c91}.stand.both{background:#f0dcff;border:3px solid #7a1fc2;color:#461078}.ownbox{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.ownitem{border:2px solid var(--line);border-radius:14px;padding:12px;background:#fff}.ownitem strong{font-size:24px}.twoCols{display:grid;grid-template-columns:1fr 1fr;gap:12px}.inlineBtns{display:flex;gap:6px;flex-wrap:wrap}.inlineBtns button{width:auto}.adminbar{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}.tag{font-size:11px;border-radius:999px;padding:3px 7px;background:#f0f4ee;font-weight:900}.t1tag{background:#ffe1e1;color:#8e0000}.t2tag{background:#dfeaff;color:#003c91}.sector-A{box-shadow:inset 0 0 0 2px #b32020}.sector-B{box-shadow:inset 0 0 0 2px #1057c8}.sector-C{box-shadow:inset 0 0 0 2px #14803a}.sector-D{box-shadow:inset 0 0 0 2px #7a1fc2}.sector-E{box-shadow:inset 0 0 0 2px #b36b00}.sector-F{box-shadow:inset 0 0 0 2px #006b7a}.checkline{display:flex;gap:8px;align-items:center;font-size:13px;color:var(--txt);font-weight:800}.checkline input{width:auto}.sectorMap{background:#fbfdf9;border:1px solid var(--line);border-radius:14px;padding:12px;overflow:auto}.mapTitle,.bankLabel{font-weight:1000;color:#204b38;margin:5px 0}.standRow{display:grid;gap:0;min-width:640px}.standCell{min-height:45px;border:2px solid #446b56;display:flex;align-items:center;justify-content:center;flex-direction:column;font-weight:1000;color:#123827;margin:-1px 0 0 -1px}.standCell small{font-size:10px}.standCell.empty{border:0;background:transparent}.sectorBand{display:grid;min-width:640px;gap:0}.sectorBlock{min-height:78px;border:3px solid #38664d;display:flex;align-items:center;justify-content:center;flex-direction:column;margin:-1px 0 0 -1px;text-align:center}.sectorBlock span{font-size:22px;font-weight:1000}.sectorSummary{background:#ecf2ed;border-radius:10px;padding:10px;margin-top:10px;font-size:13px}.water{text-align:center;background:#f2f6f1;color:#6a756d;font-weight:1000;padding:12px;min-width:640px}.sectorFill-A{background:#d8f1dd}.sectorFill-B{background:#dbe8fb}.sectorFill-C{background:#ffe7bd}.sectorFill-D{background:#f6d9e3}.sectorFill-E{background:#eadffb}.sectorFill-F{background:#dff4f4}.sectorFill-G{background:#f7e8ce}.sectorFill-H{background:#e5f0d0}.standCell.t1{background:#ffb5b5!important;border:4px solid #d00000!important;color:#7c0000}.standCell.t2{background:#b9d2ff!important;border:4px solid #005bd8!important;color:#002c70}.standCell.both{background:#e1b8ff!important;border:4px solid #7a1fc2!important;color:#3c0060}.standCell.occ{box-shadow:inset 0 -5px 0 #244f36}.weightItems{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:5px}.weightTag{display:inline-flex;align-items:center;gap:4px;border-radius:999px;padding:3px 6px;font-size:11px;font-weight:900;background:#edf4ec;border:1px solid #bfd0c2}.weightTag button{width:auto;padding:0 4px;border-radius:8px;background:#b91c1c;color:#fff;line-height:1.1}.bfTag{background:#fff0d6;border-color:#e5b965}.netTag{background:#e7f5e7}.bfLine{font-size:12px;font-weight:1000;color:#b91c1c}.flashSave{background:#bff7c8!important;transition:background .25s}.resultInputTable input{min-width:120px}.sectorBand.clean{margin:0}.sectorFlexRow{display:flex;gap:0;min-width:640px}.sectorGroup{display:grid;gap:0;margin:0}.sectorGroup .standCell{border-radius:0;margin:-1px 0 0 -1px}.sectorFlexRow .sectorBlock{border-radius:0;margin:-1px 0 0 -1px}.standFlex{align-items:stretch}.sectorBand.clean .sectorBlock{min-height:72px}.pushBox{margin-top:6px;line-height:1.35}.bankLabelBottom{margin-top:8px}.quickScroll{position:fixed;right:10px;bottom:14px;z-index:30;display:flex;flex-direction:column;gap:7px}.quickScroll button{width:52px;padding:9px 0;border-radius:999px;background:#123827cc;box-shadow:0 3px 10px #0003}.quickScroll button:last-child{background:#e7eee7;color:#123827;border:1px solid #bfd0c2}

.sectorMap,.sectorMap .mapTitle,.sectorMap .bankLabel,.sectorMap .sectorSummary{text-align:center}.sectorBlock{min-height:118px;text-align:center;gap:4px;padding:10px 4px}.sectorWord{font-size:13px;font-weight:1000;letter-spacing:.08em;line-height:1}.sectorLetter{font-size:36px;font-weight:1000;line-height:1}.sectorPeople{font-size:13px;font-weight:1000;line-height:1.1}.standCell{text-align:center}.playerView{text-align:center}.playerView table th,.playerView table td{text-align:center}.playerView .inlineBtns{justify-content:center}.playerView .ownitem{text-align:center}.playerView .sectorSummary{text-align:center}.playerView .card{text-align:center}
.sharpTable{border-collapse:collapse;background:#fff;color:#001b12;font-size:14px;line-height:1.18;text-rendering:geometricPrecision}.sharpTable th,.sharpTable td{border:1.5px solid #b8cbbb;padding:8px 8px}.sharpTable th{background:#e2eee5;color:#052719;font-weight:1000;letter-spacing:.02em}.generalTable{width:100%;table-layout:auto}.generalTable .center{text-align:center}.generalTable .right{text-align:right}.generalTable .colRank{width:42px}.generalTable .colRound{width:52px;min-width:44px}.generalTable .colSum{width:78px;min-width:68px}.generalTable .colWeight{width:118px;min-width:105px}.generalTable .colName{width:auto;min-width:130px;white-space:normal}.generalTable .nameCell b{font-weight:1000}.generalTable .scoreCell b,.generalTable .sumCell b,.generalTable .weightCell b{font-size:15px;font-weight:1000}.generalTable .weightCell{white-space:nowrap}.finalWrap{box-shadow:0 1px 0 #00000012}
@media(max-width:760px){main{padding:8px}.grid,.grid3,.grid4,.twoCols,.ownbox,.adminbar{grid-template-columns:1fr}.card{border-radius:12px;padding:10px}th,td{padding:6px 4px;font-size:11px}h1{font-size:16px}input,select,textarea,button{padding:10px}.tabs button{font-size:12px;padding:8px 10px}.top-actions button{font-size:12px}.stand{min-height:36px;font-size:11px}.bank{grid-template-columns:repeat(auto-fit,minmax(36px,1fr))}.standRow,.sectorBand{min-width:520px}.sectorBlock span{font-size:17px}.sectorBlock{min-height:105px}.sectorLetter{font-size:30px}.sectorWord,.sectorPeople{font-size:11px}.finalWrap{border-radius:10px}.generalTable{min-width:360px;width:100%;table-layout:fixed}.generalTable .colRank{width:34px}.generalTable .colRound{width:36px;min-width:36px}.generalTable .colSum{width:54px;min-width:54px}.generalTable .colWeight{width:82px;min-width:82px}.generalTable .colName{width:auto;min-width:0}.generalTable th,.generalTable td{padding:7px 4px;font-size:11.5px}.generalTable th{font-size:10px}.generalTable .nameCell b{font-size:12px}.generalTable .scoreCell b,.generalTable .sumCell b,.generalTable .weightCell b{font-size:12px}.generalTable .bfLine{font-size:10px}}
</style>
</head>
<body>
<header><div class="row"><h1>🎣 Łowcy Methodowcy</h1><div class="top-actions"><button onclick="enablePush()">Push/status</button><button onclick="logout()" id="logoutBtn" class="hidden">Wyloguj</button></div></div></header>
<main>
<div id="msg"></div>
<section id="auth" class="card">
  <h2>Logowanie</h2>
  <div class="grid"><div><label>Telefon</label><input id="loginPhone" autocomplete="username"></div><div><label>Hasło</label><input id="loginPassword" type="password" autocomplete="current-password"></div></div>
  <div class="grid" style="margin-top:10px"><button onclick="login()">Zaloguj</button><button class="secondary" onclick="clearSession()">Wyczyść sesję</button></div>
  <div class="twoCols">
    <div class="card"><h3>Rejestracja zawodnika</h3><label>Telefon</label><input id="regPhone"><label>Hasło</label><input id="regPassword" type="password"><label>Imię</label><input id="regFirst"><label>Nazwisko</label><input id="regLast"><label>Nr Koła PZW</label><input id="regClub"><button onclick="registerPlayer()">Utwórz konto zawodnika</button></div>
    <div class="card"><h3>Pierwsze konto admina</h3><p class="small muted">Sekcja działa tylko, gdy w bazie nie ma jeszcze admina.</p><label>Kod setupu</label><input id="setupCode"><label>Telefon admina</label><input id="setupPhone"><label>Hasło</label><input id="setupPassword" type="password"><label>Imię</label><input id="setupFirst"><label>Nazwisko</label><input id="setupLast"><label>Koło PZW</label><input id="setupClub"><button onclick="setupAdmin()">Utwórz admina</button></div>
  </div>
</section>
<section id="app" class="hidden">
  <div class="card success-line"><div class="adminbar"><div><b id="who"></b><br><span id="role" class="muted small"></span></div><div id="notifCounter" class="ok"></div><div class="right"><span class="tag">V22 bez pętli cache</span><div id="pushStatus" class="pushBox"></div><button class="secondary" style="margin-top:6px;width:auto" onclick="resetPush()">Reset push</button></div></div></div>
  <div class="tabs"><button id="btn-competitions" onclick="showTab('competitions')">Zawody</button><button id="btn-notifications" onclick="showTab('notifications')">Powiadomienia</button><button id="btn-players" class="hidden" onclick="showTab('players')">Zawodnicy</button></div>
  <section id="tab-competitions">
    <div id="adminCreate" class="card hidden"><h2>Utwórz zawody</h2><p class="small muted">Szybkie tworzenie: liczba osób, data, łowisko i opis. Brzegi, sektory i mapę ustawiasz potem w osobnym panelu struktury.</p><div class="grid"><div><label>Liczba osób / limit listy głównej</label><input id="cLimit" type="number" min="1" placeholder="30"></div><div><label>Data zawodów</label><input id="cDate" type="date"></div><div><label>Łowisko</label><input id="cFishery" placeholder="Łowisko Lasomin"></div></div><label>Opis</label><textarea id="cNotes" placeholder="Opis zawodów, zasady, informacje organizacyjne."></textarea><button onclick="createCompetition(event)">Utwórz zawody</button></div>
    <div class="card"><h2>Lista zawodów</h2><div id="competitionsList"></div></div>
    <div id="competitionDetail" class="hidden"></div>
  </section>
  <section id="tab-notifications" class="hidden"><div class="card"><h2>Powiadomienia</h2><div id="notificationsList"></div></div></section>
  <section id="tab-players" class="hidden"><div class="card"><h2>Zawodnicy</h2><div id="playersList"></div></div></section>
</section>
</main>
<div class="quickScroll"><button onclick="scrollAppTop()">↑</button><button onclick="scrollAppBottom()">↓</button></div>
<script src="/app.js?v=${APP_VERSION}" defer></script>
</body>
</html>`;

waitForDb().then(() => {
  const server = http.createServer((req, res) => {
    route(req, res).catch(err => {
      console.error('REQ_ERR', err);
      sendJson(res, 500, { ok:false, error:'Błąd serwera' });
    });
  });
  server.listen(PORT, '0.0.0.0', () => { console.log('LOWCY_METHODOWCY_V22_NO_RELOAD_SAFE_SCROLL_READY'); console.log('CARP_MOBILE_READY port=' + PORT); });
}).catch(err => { console.error('START_FAILED', err); process.exit(1); });
