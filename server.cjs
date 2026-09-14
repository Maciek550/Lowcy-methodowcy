
const http = require('http');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
let webpush = null;
try { webpush = require('web-push'); } catch (_) {}

const PORT = Number(process.env.PORT || 3000);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const ADMIN_SETUP_CODE = process.env.ADMIN_SETUP_CODE || '';
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@carp.local';

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
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
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
    req.on('data', c => { b += c; if (b.length > 1_000_000) { req.destroy(); reject(new Error('Payload too large')); }});
    req.on('end', () => resolve(safeJsonParse(b)));
    req.on('error', reject);
  });
}
async function auth(req) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : '';
  if (!token) return null;
  try {
    const p = jwt.verify(token, JWT_SECRET);
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
function tokenFor(user) {
  return jwt.sign({ uid:user.id, role:user.role }, JWT_SECRET, { expiresIn:'90d' });
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

async function notifyAdmins(type, title, body, data={}) {
  const admins = await pool.query(`select id from users where role='ADMIN'`);
  for (const admin of admins.rows) {
    await pool.query(
      'insert into notifications(recipient_user_id,type,title,body,data) values($1,$2,$3,$4,$5)',
      [admin.id, type, title, body, data]
    );
    if (webpush && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      const subs = await pool.query('select subscription from push_subscriptions where user_id=$1', [admin.id]);
      for (const s of subs.rows) {
        try {
          await webpush.sendNotification(s.subscription, JSON.stringify({ title, body, url:'/admin' }));
        } catch (e) {
          console.log('PUSH_SEND_ERR ' + e.message);
        }
      }
    }
  }
}

async function route(req, res) {
  const url = new URL(req.url, 'http://local');
  const path = url.pathname;
  const method = req.method;
  if (path === '/health') return sendJson(res, 200, { ok:true, time:nowIso() });
  if (path === '/manifest.webmanifest') return send(res, 200, JSON.stringify({
    name:'Carp Mobile App',
    short_name:'Carp',
    start_url:'/',
    scope:'/',
    display:'standalone',
    background_color:'#f3f6ef',
    theme_color:'#114b2f',
    icons:[]
  }), {'Content-Type':'application/manifest+json; charset=utf-8'});
  if (path === '/sw.js') return send(res, 200, `
self.addEventListener('install', event => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch(e) {}
  event.waitUntil(self.registration.showNotification(data.title || 'Carp', {
    body: data.body || 'Nowe powiadomienie',
    icon: '/icon.png',
    data: { url: data.url || '/' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.openWindow(event.notification.data?.url || '/'));
});
`, {'Content-Type':'application/javascript; charset=utf-8'});

  if (path === '/api/config') return sendJson(res, 200, { ok:true, vapidPublicKey: VAPID_PUBLIC_KEY, pushReady: Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) });

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
    return sendJson(res, 200, { ok:true, user:rows[0], token:tokenFor(rows[0]) });
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
      return sendJson(res, 200, { ok:true, user:rows[0], token:tokenFor(rows[0]) });
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
    return sendJson(res, 200, { ok:true, user:{id:u.id,phone:u.phone,first_name:u.first_name,last_name:u.last_name,pzw_club:u.pzw_club,role:u.role,created_at:u.created_at}, token:tokenFor(u) });
  }

  const user = await auth(req);

  if (path === '/api/me') {
    if (!requireUser(user, res)) return;
    return sendJson(res, 200, { ok:true, user });
  }

  if (path === '/api/push-subscription' && method === 'POST') {
    if (!requireUser(user, res)) return;
    const b = await readBody(req);
    if (!b.subscription || !b.subscription.endpoint) return sendJson(res, 400, { ok:false, error:'Brak subskrypcji push' });
    await pool.query(
      `insert into push_subscriptions(user_id, endpoint, subscription) values($1,$2,$3)
       on conflict(endpoint) do update set user_id=excluded.user_id, subscription=excluded.subscription`,
      [user.id, b.subscription.endpoint, b.subscription]
    );
    return sendJson(res, 200, { ok:true });
  }

  if (path === '/api/competitions' && method === 'GET') {
    if (!requireUser(user, res)) return;
    const { rows } = await pool.query(`
      select c.*,
        (select count(*)::int from entries e where e.competition_id=c.id and e.status='ACTIVE') active_count,
        (select status from entries e where e.competition_id=c.id and e.user_id=$1) my_status
      from competitions c
      order by c.competition_date nulls last, c.created_at desc
    `, [user.id]);
    return sendJson(res, 200, { ok:true, competitions:rows });
  }

  if (path === '/api/competitions' && method === 'POST') {
    if (!requireAdmin(user, res)) return;
    const b = await readBody(req);
    if (!b.title) return sendJson(res, 400, { ok:false, error:'Podaj nazwę zawodów' });
    const { rows } = await pool.query(
      `insert into competitions(title,fishery,competition_date,limit_places,status,notes,created_by)
       values($1,$2,$3,$4,$5,$6,$7) returning *`,
      [String(b.title).trim(), String(b.fishery||'').trim(), b.competitionDate || null, b.limitPlaces ? Number(b.limitPlaces) : null, b.status || 'OPEN', String(b.notes||''), user.id]
    );
    await notifyAdmins('COMPETITION_CREATE', 'Utworzono zawody', user.first_name + ' ' + user.last_name + ' utworzył zawody: ' + rows[0].title, { competitionId: rows[0].id, userId: user.id });
    return sendJson(res, 200, { ok:true, competition:rows[0] });
  }

  if (path === '/api/admin/competitions/clear' && method === 'POST') {
    if (!requireAdmin(user, res)) return;
    const b = await readBody(req);
    if (b.confirm !== 'USUN') return sendJson(res, 400, { ok:false, error:'Wymagane potwierdzenie USUN' });
    const deleted = await pool.query('delete from competitions returning id');
    await notifyAdmins('COMPETITIONS_CLEAR', 'Usunięto zawody testowe', user.first_name + ' ' + user.last_name + ' usunął ' + deleted.rowCount + ' zawodów', { count: deleted.rowCount, userId: user.id });
    return sendJson(res, 200, { ok:true, deleted: deleted.rowCount });
  }

  let del = path.match(/^\/api\/competitions\/(\d+)$/);
  if (del && method === 'DELETE') {
    if (!requireAdmin(user, res)) return;
    const id = Number(del[1]);
    const old = await pool.query('select title from competitions where id=$1', [id]);
    if (!old.rows[0]) return sendJson(res, 404, { ok:false, error:'Nie znaleziono zawodów' });
    await pool.query('delete from competitions where id=$1', [id]);
    await notifyAdmins('COMPETITION_DELETE', 'Usunięto zawody', user.first_name + ' ' + user.last_name + ' usunął zawody: ' + old.rows[0].title, { competitionId: id, userId: user.id });
    return sendJson(res, 200, { ok:true });
  }

  let m = path.match(/^\/api\/competitions\/(\d+)\/join$/);
  if (m && method === 'POST') {
    if (!requireUser(user, res)) return;
    const id = Number(m[1]);
    const c = await pool.query('select * from competitions where id=$1', [id]);
    if (!c.rows[0]) return sendJson(res, 404, { ok:false, error:'Nie znaleziono zawodów' });
    if (c.rows[0].status !== 'OPEN') return sendJson(res, 409, { ok:false, error:'Zapisy są zamknięte' });
    if (c.rows[0].limit_places) {
      const cnt = await pool.query(`select count(*)::int n from entries where competition_id=$1 and status='ACTIVE'`, [id]);
      if (cnt.rows[0].n >= c.rows[0].limit_places) return sendJson(res, 409, { ok:false, error:'Brak wolnych miejsc' });
    }
    await pool.query(`
      insert into entries(competition_id,user_id,status,joined_at,cancelled_at)
      values($1,$2,'ACTIVE',now(),null)
      on conflict(competition_id,user_id) do update set status='ACTIVE', joined_at=now(), cancelled_at=null
    `, [id, user.id]);
    await notifyAdmins('JOIN', 'Nowy zapis', `${user.first_name} ${user.last_name} zapisał się: ${c.rows[0].title}`, { competitionId:id, userId:user.id });
    return sendJson(res, 200, { ok:true });
  }

  m = path.match(/^\/api\/competitions\/(\d+)\/leave$/);
  if (m && method === 'POST') {
    if (!requireUser(user, res)) return;
    const id = Number(m[1]);
    const c = await pool.query('select * from competitions where id=$1', [id]);
    if (!c.rows[0]) return sendJson(res, 404, { ok:false, error:'Nie znaleziono zawodów' });
    await pool.query(`update entries set status='CANCELLED', cancelled_at=now() where competition_id=$1 and user_id=$2`, [id, user.id]);
    await notifyAdmins('LEAVE', 'Wypis z zawodów', `${user.first_name} ${user.last_name} wypisał się: ${c.rows[0].title}`, { competitionId:id, userId:user.id });
    return sendJson(res, 200, { ok:true });
  }

  if (path === '/api/admin/notifications' && method === 'GET') {
    if (!requireAdmin(user, res)) return;
    const { rows } = await pool.query(`select * from notifications where recipient_user_id=$1 order by created_at desc limit 100`, [user.id]);
    return sendJson(res, 200, { ok:true, notifications:rows });
  }

  m = path.match(/^\/api\/admin\/notifications\/(\d+)\/read$/);
  if (m && method === 'POST') {
    if (!requireAdmin(user, res)) return;
    await pool.query(`update notifications set read_at=now() where id=$1 and recipient_user_id=$2`, [Number(m[1]), user.id]);
    return sendJson(res, 200, { ok:true });
  }

  if (path === '/api/admin/players' && method === 'GET') {
    if (!requireAdmin(user, res)) return;
    const { rows } = await pool.query(`select id, phone, first_name, last_name, pzw_club, role, created_at from users order by created_at desc`);
    return sendJson(res, 200, { ok:true, players:rows });
  }

  m = path.match(/^\/api\/admin\/competitions\/(\d+)\/entries$/);
  if (m && method === 'GET') {
    if (!requireAdmin(user, res)) return;
    const { rows } = await pool.query(`
      select e.*, u.phone, u.first_name, u.last_name, u.pzw_club
      from entries e join users u on u.id=e.user_id
      where e.competition_id=$1
      order by e.status, e.joined_at
    `, [Number(m[1])]);
    return sendJson(res, 200, { ok:true, entries:rows });
  }

  return send(res, 200, HTML);
}

const HTML = `<!doctype html>
<html lang="pl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#114b2f">
  <link rel="manifest" href="/manifest.webmanifest">
  <title>Carp Mobile App</title>
  <style>
    :root{--green:#114b2f;--green2:#17643f;--bg:#f3f6ef;--card:#fff;--line:#cfd8cc;--txt:#18251d;--muted:#68746d;--red:#b32020}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--txt);font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif}
    header{position:sticky;top:0;z-index:5;background:var(--green);color:white;padding:14px 16px;box-shadow:0 2px 8px #0002}
    header .row{display:flex;justify-content:space-between;gap:12px;align-items:center;max-width:1100px;margin:auto}
    h1{font-size:19px;margin:0}main{max-width:1100px;margin:0 auto;padding:14px}
    .card{background:var(--card);border:1px solid var(--line);border-radius:16px;padding:14px;margin:12px 0;box-shadow:0 2px 8px #0000000d}
    .grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
    input,select,textarea,button{width:100%;font:inherit;border-radius:12px;border:1px solid var(--line);padding:11px 12px;background:white}
    button{border:0;background:var(--green);color:white;font-weight:800;cursor:pointer}button.secondary{background:#e7eee7;color:var(--green);border:1px solid #bfd0c2}button.warn{background:var(--red)}
    label{display:block;font-size:12px;font-weight:800;color:var(--muted);margin:9px 0 4px}.tabs{display:flex;gap:8px;overflow:auto;padding:8px 0}.tabs button{white-space:nowrap;width:auto;padding:10px 14px}
    table{width:100%;border-collapse:collapse;background:white}th,td{border:1px solid var(--line);padding:8px 7px;text-align:left;vertical-align:middle}th{background:#e6f0e8;color:#103b28;font-size:12px;text-transform:uppercase}.nowrap{white-space:nowrap}.muted{color:var(--muted)}.ok{color:var(--green);font-weight:800}.bad{color:var(--red);font-weight:800}.pill{display:inline-block;padding:4px 8px;border-radius:999px;background:#e6f0e8;font-weight:800}
    .notice{border-left:5px solid var(--green);padding-left:10px}.hidden{display:none!important}.top-actions{display:flex;gap:8px;align-items:center}.top-actions button{width:auto;padding:9px 12px;background:#ffffff22;border:1px solid #ffffff55}.small{font-size:12px}.right{text-align:right}
    @media(max-width:760px){main{padding:10px}.grid,.grid3{grid-template-columns:1fr}.card{border-radius:12px;padding:10px}th,td{padding:6px 4px;font-size:11px}h1{font-size:16px}input,select,textarea,button{padding:10px}.hide-mobile{display:none}.tabs button{font-size:12px;padding:8px 10px}}
  </style>
</head>
<body>
<header><div class="row"><h1>🎣 Carp Mobile App</h1><div class="top-actions"><button onclick="enablePush()">Push</button><button onclick="logout()">Wyloguj</button></div></div></header>
<main>
  <div id="msg"></div>

  <section id="auth" class="card">
    <h2>Logowanie</h2>
    <div class="grid">
      <div><label>Telefon</label><input id="loginPhone" autocomplete="username"></div>
      <div><label>Hasło</label><input id="loginPassword" type="password" autocomplete="current-password"></div>
    </div>
    <button onclick="login()">Zaloguj</button>
    <hr>
    <h3>Rejestracja zawodnika</h3>
    <div class="grid">
      <div><label>Telefon</label><input id="regPhone" autocomplete="tel"></div>
      <div><label>Hasło</label><input id="regPassword" type="password" autocomplete="new-password"></div>
      <div><label>Imię</label><input id="regFirst"></div>
      <div><label>Nazwisko</label><input id="regLast"></div>
      <div><label>Nr Koła PZW</label><input id="regClub"></div>
    </div>
    <button onclick="registerPlayer()">Załóż konto zawodnika</button>
    <hr>
    <details>
      <summary><b>Pierwsze konto admina</b></summary>
      <p class="muted">Użyj tylko raz. Wymaga kodu setupu.</p>
      <div class="grid">
        <div><label>Kod setupu</label><input id="setupCode"></div>
        <div><label>Telefon admina</label><input id="setupPhone"></div>
        <div><label>Hasło admina</label><input id="setupPassword" type="password"></div>
        <div><label>Imię</label><input id="setupFirst"></div>
        <div><label>Nazwisko</label><input id="setupLast"></div>
        <div><label>Koło PZW</label><input id="setupClub"></div>
      </div>
      <button onclick="setupAdmin()">Utwórz admina</button>
    </details>
  </section>

  <section id="app" class="hidden">
    <div class="card notice"><b id="who"></b><div class="small muted" id="role"></div></div>
    <div class="tabs">
      <button onclick="showTab('competitions')">Zawody</button>
      <button id="adminNotifTab" onclick="showTab('notifications')">🔔 Powiadomienia</button>
      <button id="adminPlayersTab" onclick="showTab('players')">Zawodnicy</button>
    </div>

    <section id="tab-competitions">
      <div id="adminCreate" class="card hidden">
        <h2>Dodaj zawody</h2>
        <div class="grid3">
          <div><label>Nazwa</label><input id="cTitle" placeholder="Lasomin Method Feeder"></div>
          <div><label>Łowisko</label><input id="cFishery" placeholder="Łowisko Lasomin"></div>
          <div><label>Data</label><input id="cDate" type="date"></div>
          <div><label>Limit miejsc</label><input id="cLimit" type="number" min="1"></div>
          <div><label>Status</label><select id="cStatus"><option value="OPEN">Otwarte</option><option value="CLOSED">Zamknięte</option></select></div>
        </div>
        <label>Notatki</label><textarea id="cNotes" rows="2"></textarea>
        <button onclick="createCompetition()">Utwórz zawody</button>
      </div>
      <div class="card"><h2>Dostępne zawody</h2><div id="competitionsList"></div></div>
    </section>

    <section id="tab-notifications" class="hidden">
      <div class="card"><h2>Powiadomienia admina</h2><div id="notificationsList"></div></div>
    </section>

    <section id="tab-players" class="hidden">
      <div class="card"><h2>Zawodnicy</h2><div id="playersList"></div></div>
    </section>
  </section>
</main>
<script>
let TOKEN = localStorage.getItem('carp_token') || '';
let ME = null;
const q = id => document.getElementById(id);
function esc(s){return String(s ?? '').replace(/[&<>\"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]})}
function msg(t, type='ok'){q('msg').innerHTML='<div class="card '+(type==='bad'?'bad':'ok')+'">'+t+'</div>';setTimeout(()=>q('msg').innerHTML='',3500)}
async function api(path, opts={}){
  const res = await fetch(path, Object.assign({headers:{'Content-Type':'application/json',...(TOKEN?{Authorization:'Bearer '+TOKEN}:{})}}, opts));
  const data = await res.json().catch(()=>({ok:false,error:'Błąd odpowiedzi'}));
  if(!res.ok || data.ok===false) throw new Error(data.error || 'Błąd');
  return data;
}
function fmtDate(d){return d?new Date(d+'T12:00:00').toLocaleDateString('pl-PL'):'—'}
async function boot(){
  if(!TOKEN){q('auth').classList.remove('hidden');q('app').classList.add('hidden');return}
  try{
    const d=await api('/api/me');ME=d.user;
  }catch(e){
    localStorage.removeItem('carp_token');TOKEN='';ME=null;
    q('auth').classList.remove('hidden');q('app').classList.add('hidden');
    return;
  }
  q('auth').classList.add('hidden');q('app').classList.remove('hidden');
  q('who').textContent=ME.first_name+' '+ME.last_name+' — Koło PZW '+(ME.pzw_club||'');
  q('role').textContent=ME.role==='ADMIN'?'Administrator':'Zawodnik';
  const admin=ME.role==='ADMIN';
  q('adminNotifTab').classList.toggle('hidden',!admin);q('adminPlayersTab').classList.toggle('hidden',!admin);q('adminCreate').classList.toggle('hidden',!admin);
  try{await loadCompetitions();}catch(e){console.warn('COMPETITIONS_LOAD_ERR', e.message);}
  if(admin){
    try{await loadNotifications();}catch(e){console.warn('NOTIFICATIONS_LOAD_ERR', e.message);}
    try{await loadPlayers();}catch(e){console.warn('PLAYERS_LOAD_ERR', e.message);}
  }
}
async function login(){
  try{const d=await api('/api/login',{method:'POST',body:JSON.stringify({phone:q('loginPhone').value,password:q('loginPassword').value})});TOKEN=d.token;localStorage.setItem('carp_token',TOKEN);msg('Zalogowano');boot()}catch(e){msg(e.message,'bad')}
}
async function registerPlayer(){
  try{const d=await api('/api/register',{method:'POST',body:JSON.stringify({phone:q('regPhone').value,password:q('regPassword').value,firstName:q('regFirst').value,lastName:q('regLast').value,pzwClub:q('regClub').value})});TOKEN=d.token;localStorage.setItem('carp_token',TOKEN);msg('Konto zawodnika utworzone');boot()}catch(e){msg(e.message,'bad')}
}
async function setupAdmin(){
  try{const d=await api('/api/setup-admin',{method:'POST',body:JSON.stringify({setupCode:q('setupCode').value,phone:q('setupPhone').value,password:q('setupPassword').value,firstName:q('setupFirst').value,lastName:q('setupLast').value,pzwClub:q('setupClub').value})});TOKEN=d.token;localStorage.setItem('carp_token',TOKEN);msg('Admin utworzony');boot()}catch(e){msg(e.message,'bad')}
}
function logout(){localStorage.removeItem('carp_token');TOKEN='';ME=null;location.reload()}
function showTab(n){['competitions','notifications','players'].forEach(x=>q('tab-'+x).classList.toggle('hidden',x!==n)); if(n==='notifications') loadNotifications(); if(n==='players') loadPlayers();}
async function loadCompetitions(){
  const d=await api('/api/competitions');
  const arr=d.competitions||[];
  const admin=ME&&ME.role==='ADMIN';
  let html='';
  if(admin){
    html+='<div class="small muted" style="margin-bottom:8px">Liczba zawodów w bazie: <b>'+arr.length+'</b></div>';
    if(arr.length){html+='<button class="warn" style="margin-bottom:10px" onclick="clearCompetitions()">Usuń wszystkie zawody testowe</button>';}
  }
  if(!arr.length){q('competitionsList').innerHTML=html+'<p class="muted">Brak zawodów.</p>';return}
  html+='<table><thead><tr><th>Zawody</th><th>Data</th><th>Zapisy</th><th>Akcja</th></tr></thead><tbody>';
  html+=arr.map(c=>{
    const mine=c.my_status==='ACTIVE'; const closed=c.status!=='OPEN';
    const actions=admin
      ? '<div style="display:grid;gap:6px"><span class="pill">'+esc(c.status)+'</span><button class="warn" onclick="deleteCompetition('+c.id+')">Usuń</button></div>'
      : (mine?'<button class="warn" onclick="leaveComp('+c.id+')">Wypisz</button>':'<button '+(closed?'disabled':'')+' onclick="joinComp('+c.id+')">Zapisz</button>');
    return '<tr><td><b>'+esc(c.title)+'</b><br><span class="muted small">'+esc(c.fishery||'')+'</span></td><td class="nowrap">'+fmtDate(c.competition_date)+'</td><td class="nowrap">'+c.active_count+(c.limit_places?' / '+c.limit_places:'')+'</td><td>'+actions+'</td></tr>';
  }).join('');
  html+='</tbody></table>';
  q('competitionsList').innerHTML=html;
}
let CREATING_COMPETITION=false;
async function createCompetition(){
  if(CREATING_COMPETITION) return;
  CREATING_COMPETITION=true;
  const btn=(window.event&&window.event.target&&window.event.target.tagName==='BUTTON')?window.event.target:null;
  if(btn){btn.disabled=true;btn.textContent='Tworzę...'}
  try{
    const title=q('cTitle').value.trim();
    if(!title) throw new Error('Podaj nazwę zawodów');
    await api('/api/competitions',{method:'POST',body:JSON.stringify({title:title,fishery:q('cFishery').value,competitionDate:q('cDate').value,limitPlaces:q('cLimit').value,status:q('cStatus').value,notes:q('cNotes').value})});
    q('cTitle').value='';q('cFishery').value='';q('cDate').value='';q('cLimit').value='';q('cNotes').value='';q('cStatus').value='OPEN';
    await loadCompetitions();
    if(ME&&ME.role==='ADMIN'){try{await loadNotifications();}catch(e){console.warn('NOTIF_REFRESH_ERR',e.message)}}
    msg('Utworzono zawody');
  }catch(e){msg(e.message,'bad')}
  finally{CREATING_COMPETITION=false;if(btn){btn.disabled=false;btn.textContent='Utwórz zawody'}}
}
async function joinCompasync function deleteCompetition(id){
  try{
    if(!confirm('Usunąć te zawody?')) return;
    await api('/api/competitions/'+id,{method:'DELETE'});
    msg('Usunięto zawody');
    await loadCompetitions();
    if(ME&&ME.role==='ADMIN'){try{await loadNotifications();}catch(e){console.warn('NOTIF_REFRESH_ERR',e.message)}}
  }catch(e){msg(e.message,'bad')}
}
async function clearCompetitions(){
  try{
    if(!confirm('Usunąć WSZYSTKIE zawody testowe z bazy?')) return;
    if(!confirm('Na pewno? Operacji nie da się cofnąć.')) return;
    const d=await api('/api/admin/competitions/clear',{method:'POST',body:JSON.stringify({confirm:'USUN'})});
    msg('Usunięto zawody: '+d.deleted);
    await loadCompetitions();
    if(ME&&ME.role==='ADMIN'){try{await loadNotifications();}catch(e){console.warn('NOTIF_REFRESH_ERR',e.message)}}
  }catch(e){msg(e.message,'bad')}
}
async function joinComp(id){try{await api('/api/competitions/'+id+'/join',{method:'POST',body:'{}'});msg('Zapisano na zawody');loadCompetitions();}catch(e){msg(e.message,'bad')}}
async function leaveComp(id){try{await api('/api/competitions/'+id+'/leave',{method:'POST',body:'{}'});msg('Wypisano z zawodów');loadCompetitions();}catch(e){msg(e.message,'bad')}}
async function loadNotifications(){
  if(!ME||ME.role!=='ADMIN')return;
  const d=await api('/api/admin/notifications');
  q('notificationsList').innerHTML=d.notifications.length?'<table><thead><tr><th>Zdarzenie</th><th>Czas</th><th>Status</th></tr></thead><tbody>'+d.notifications.map(n=>'<tr><td><b>'+esc(n.title)+'</b><br>'+esc(n.body)+'</td><td class="nowrap small">'+new Date(n.created_at).toLocaleString('pl-PL')+'</td><td>'+(n.read_at?'Przecz.':'<button onclick="readNotif('+n.id+')">OK</button>')+'</td></tr>').join('')+'</tbody></table>':'<p class="muted">Brak powiadomień.</p>';
}
async function readNotif(id){await api('/api/admin/notifications/'+id+'/read',{method:'POST',body:'{}'});loadNotifications()}
async function loadPlayers(){
  if(!ME||ME.role!=='ADMIN')return;
  const d=await api('/api/admin/players');
  q('playersList').innerHTML='<table><thead><tr><th>Imię i nazwisko</th><th>Telefon</th><th>Koło PZW</th><th>Rola</th></tr></thead><tbody>'+d.players.map(p=>'<tr><td>'+esc(p.first_name+' '+p.last_name)+'</td><td class="nowrap">'+esc(p.phone)+'</td><td>'+esc(p.pzw_club)+'</td><td>'+esc(p.role)+'</td></tr>').join('')+'</tbody></table>';
}
function urlBase64ToUint8Array(base64String){const padding='='.repeat((4-base64String.length%4)%4);const base64=(base64String+padding).replace(/-/g,'+').replace(/_/g,'/');const raw=atob(base64);const out=new Uint8Array(raw.length);for(let i=0;i<raw.length;++i)out[i]=raw.charCodeAt(i);return out}
async function enablePush(){
  try{
    if(!('serviceWorker' in navigator)||!('PushManager' in window)) throw new Error('Ten telefon/przeglądarka nie obsługuje push w PWA');
    if(!TOKEN) throw new Error('Najpierw się zaloguj');
    const cfg=await api('/api/config');
    if(!cfg.pushReady) throw new Error('Push nie jest jeszcze skonfigurowany na serwerze');
    const reg=await navigator.serviceWorker.register('/sw.js');
    const perm=await Notification.requestPermission();
    if(perm!=='granted') throw new Error('Brak zgody na powiadomienia');
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:urlBase64ToUint8Array(cfg.vapidPublicKey)});
    await api('/api/push-subscription',{method:'POST',body:JSON.stringify({subscription:sub})});
    msg('Push włączony na tym urządzeniu');
  }catch(e){msg(e.message,'bad')}
}
boot();
</script>
</body>
</html>`;

waitForDb().then(() => {
  const server = http.createServer((req, res) => {
    route(req, res).catch(err => {
      console.error('REQ_ERR', err);
      sendJson(res, 500, { ok:false, error:'Błąd serwera' });
    });
  });
  server.listen(PORT, '0.0.0.0', () => console.log('CARP_MOBILE_READY port=' + PORT));
}).catch(err => {
  console.error('START_FAILED', err);
  process.exit(1);
});
