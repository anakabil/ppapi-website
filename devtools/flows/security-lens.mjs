// Security lens review flow (read-only against site/): XSS via query params & stored data,
// open redirect via ?next, target=_blank rel audit. Run from devtools/: node flows/security-lens.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain' };
const server = http.createServer((req, res) => {
  let p; try { p = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { p = '/__bad__'; }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': MIME['.html'] });
    return res.end(fs.readFileSync(path.join(ROOT, '404.html')));
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const X = `<img src=x onerror="window.__xss=(window.__xss||0)+1">`;
const X2 = `"><svg onload="window.__xss=(window.__xss||0)+1"></svg>`;
const X3 = `'><img src=x onerror=window.__xss=1>`;
const JS = `javascript:window.__xss=(window.__xss||0)+1`;
const results = [];
const log = (name, ok, info = '') => { results.push({ name, ok, info }); console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${info ? '  — ' + info : ''}`); };

const browser = await chromium.launch();

async function scan(page) {
  return page.evaluate(() => {
    const onAttrs = [];
    for (const el of document.querySelectorAll('*')) for (const a of el.attributes) if (/^on/i.test(a.name)) onAttrs.push(el.tagName.toLowerCase() + '[' + a.name + ']');
    const badHref = [...document.querySelectorAll('a[href],area[href],iframe[src],form[action]')].map(a => a.getAttribute('href') || a.getAttribute('src') || a.getAttribute('action')).filter(h => /^\s*javascript:/i.test(h || ''));
    const blank = [...document.querySelectorAll('a[target="_blank"]')].filter(a => !/noopener|noreferrer/i.test(a.rel)).map(a => a.outerHTML.slice(0, 160));
    return { xss: window.__xss || 0, onAttrs, badHref, blank };
  });
}

async function ctx(opts = {}) {
  const c = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', locale: 'id-ID' });
  if (opts.seed) await c.addInitScript(opts.seed.fn, opts.seed.arg);
  return c;
}

async function visit(c, url, label, after) {
  const page = await c.newPage();
  let dialogs = 0;
  const errors = [];
  page.on('dialog', d => { dialogs++; d.dismiss().catch(() => {}); });
  page.on('pageerror', e => errors.push(e.message));
  try { await page.goto(BASE + url, { waitUntil: 'networkidle', timeout: 20000 }); } catch (e) { errors.push('goto ' + e.message.split('\n')[0]); }
  await page.waitForTimeout(500);
  if (after) { try { await after(page); } catch (e) { errors.push('after: ' + e.message.split('\n')[0]); } }
  await page.waitForTimeout(300);
  const s = await scan(page).catch(e => ({ xss: -1, onAttrs: ['scan failed ' + e.message], badHref: [], blank: [] }));
  const ok = !dialogs && !s.xss && !s.onAttrs.length && !s.badHref.length;
  log(label, ok, `final=${page.url().replace(BASE, '')} dialogs=${dialogs} xss=${s.xss} on*=${s.onAttrs.join(',')} jsHref=${s.badHref.join(',')} blankNoRel=${s.blank.length}${errors.length ? ' errors=' + errors.join(' | ').slice(0, 300) : ''}`);
  return page;
}

/* ---------------- A. Query parameter / path XSS (guest) ---------------- */
{
  const c = await ctx();
  const enc = encodeURIComponent;
  const cases = [
    ['berita ?id', `/berita.html?id=${enc(X)}`],
    ['berita ?q', `/berita.html?q=${enc(X)}`],
    ['berita ?q svg', `/berita.html?q=${enc(X2)}`],
    ['berita ?kategori', `/berita.html?kategori=${enc(X)}`],
    ['agenda ?id', `/agenda.html?id=${enc(X)}`],
    ['agenda ?jenis ?mode ?tab', `/agenda.html?jenis=${enc(X)}&mode=${enc(X2)}&tab=${enc(X3)}`],
    ['regulasi ?q ?jenis ?status ?urut', `/regulasi.html?q=${enc(X)}&jenis=${enc(X2)}&status=${enc(X3)}&urut=${enc(X)}`],
    ['regulasi ?q svg', `/regulasi.html?q=${enc(X2)}`],
    ['verifikasi ?kta img', `/verifikasi.html?kta=${enc(X)}`],
    ['verifikasi ?kta svg', `/verifikasi.html?kta=${enc(X2)}`],
    ['verifikasi ?kta name-like', `/verifikasi.html?kta=${enc('Contoh ' + X)}`],
    ['umpan-balik ?kategori', `/umpan-balik.html?kategori=${enc(X)}`],
    ['masuk ?next img', `/masuk.html?next=${enc(X)}`],
    ['masuk ?next html+payload', `/masuk.html?next=${enc('anggota.html?x=' + X)}`],
    ['masuk ?next js', `/masuk.html?next=${enc(JS)}`],
    ['404 path payload', `/${enc(X)}`],
    ['404 nested path payload', `/a/b/${enc(X2)}`],
    ['404 query payload', `/nope.html?q=${enc(X)}#${enc(X2)}`],
    ['index hash', `/index.html#${enc(X)}`],
    ['keanggotaan hash', `/keanggotaan.html#${enc(X2)}`],
    ['kebijakan hash', `/kebijakan-privasi.html#${enc(X)}`],
    ['profil hash', `/profil.html#${enc(X)}`],
  ];
  for (const [label, url] of cases) { const p = await visit(c, url, 'XSS-param: ' + label); await p.close(); }
  await c.close();
}

/* ---------------- B. Open redirect via ?next (signed-in guest gate) ---------------- */
const DEMO_USER = { uid: 'sec-uji-0001', name: 'Penguji Keamanan', email: 'uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
function seedFn({ u, m }) {
  try {
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
      const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
      users[u.email] = { uid: u.uid, name: u.name, email: u.email, phone: u.phone, provider: u.provider, createdAt: u.createdAt, hash: 'x' };
      localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
      if (m) localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
    }
  } catch (e) {}
}
{
  const c = await ctx({ seed: { fn: seedFn, arg: { u: DEMO_USER, m: null } } });
  const nexts = ['https://evil.example/', '//evil.example/', '/\\evil.example/', '\\\\evil.example', '/%5Cevil.example', JS, 'JaVaScRiPt:alert(1)', ' javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>', 'https:evil.example', '%2F%2Fevil.example', '/%09/evil.example', 'http://127.0.0.1.evil.example/x.html',
    'evil.example/x.html', 'dashboard.html?x=//evil', 'dashboard.html#//evil', 'berita.html?id=x', '../x.html', './/evil.example/a.html', 'a.html\t//evil'];
  for (const n of nexts) {
    const page = await c.newPage();
    let dialogs = 0; page.on('dialog', d => { dialogs++; d.dismiss().catch(() => {}); });
    let left = null;
    page.on('request', r => { if (r.isNavigationRequest() && !r.url().startsWith(BASE)) left = r.url(); });
    try { await page.goto(`${BASE}/masuk.html?next=${encodeURIComponent(n)}`, { waitUntil: 'networkidle', timeout: 15000 }); } catch (e) {}
    await page.waitForTimeout(400);
    const fin = page.url();
    const ok = fin.startsWith(BASE) && !left && !dialogs;
    log('redirect ?next=' + JSON.stringify(n), ok, 'final=' + fin.replace(BASE, '') + (left ? ' LEFT ORIGIN→' + left : ''));
    await page.close();
  }
  await c.close();
}

/* ---------------- C. Stored XSS via member record + session ---------------- */
const XU = { ...DEMO_USER, uid: 'sec-xss-0002', name: 'Budi ' + X, email: 'budi@contoh.id' };
const XM = {
  uid: XU.uid, name: 'Budi ' + X, email: 'budi' + X2 + '@contoh.id', phone: '+62812' + X3, photoURL: `x" onerror="window.__xss=1`,
  kta: 'PPAPI-2026-' + X, memberType: 'Praktisi' + X, status: 'Aktif' + X2, joinedAt: '2026-03-14' + X,
  profile: { birthPlace: X, birthDate: '1990-01-01' + X2, gender: X, city: X, province: X2, address: X, company: X2, position: X3, experienceYears: 9, education: X, bio: X2, linkedin: JS },
  competencies: [{ id: 'k1"' + X2, code: X, name: 'Supervisor ' + X, level: 'Mahir' + X, since: 2019, notes: X2 },
                 { id: 'k2', code: 'SCF-INS', name: X2, level: 'Menengah', since: '2022' + X, notes: '' }],
  certificates: [{ id: 'c1"' + X2, title: 'Teknisi ' + X, number: X2, issuer: X3, issuedAt: '2024-02-10', expiresAt: '2026-11-20', link: JS },
                 { id: 'c2', title: X2, number: 'N2', issuer: 'Kemnaker RI', issuedAt: '2024-02-10' + X, expiresAt: '2027-02-10' + X2, link: 'https://ok.example/"' + X2 }],
  updatedAt: '2026-09-30T08:00:00.000Z',
};
{
  const c = await ctx({ seed: { fn: seedFn, arg: { u: XU, m: XM } } });
  const openMenu = async (page) => { const b = await page.$('.account__btn, [data-account-btn], .account button'); if (b) await b.click().catch(() => {}); };
  let p = await visit(c, '/dashboard.html', 'XSS-stored: dashboard', openMenu); await p.screenshot({ path: path.join(SHOTS, 'sec-dashboard-xss.png'), fullPage: true }); await p.close();
  for (const tab of ['profil', 'kompetensi', 'sertifikat', 'kartu', 'aplikasi']) {
    p = await visit(c, '/anggota.html#' + tab, 'XSS-stored: anggota #' + tab, async (page) => {
      await page.waitForTimeout(800);
      if (tab === 'kompetensi' || tab === 'sertifikat') {
        const btn = await page.$(`#panel-${tab} [data-action="edit"], [data-edit], button:has-text("Ubah")`);
        if (btn) { await btn.click().catch(() => {}); await page.waitForTimeout(500); }
      }
    });
    await p.screenshot({ path: path.join(SHOTS, `sec-anggota-${tab}-xss.png`), fullPage: false }); await p.close();
  }
  p = await visit(c, '/verifikasi.html', 'XSS-stored: verifikasi own-KTA', async (page) => {
    const b = await page.$('button:has-text("KTA saya"), [data-own-kta]'); if (b) { await b.click().catch(() => {}); await page.waitForTimeout(600); }
  }); await p.screenshot({ path: path.join(SHOTS, 'sec-verifikasi-xss.png'), fullPage: true }); await p.close();
  p = await visit(c, `/verifikasi.html?kta=${encodeURIComponent(XM.kta)}`, 'XSS-stored: verifikasi ?kta=own payload KTA'); await p.close();
  p = await visit(c, '/umpan-balik.html', 'XSS-stored: umpan-balik prefill'); await p.close();
  p = await visit(c, '/index.html', 'XSS-stored: index header menu', openMenu); await p.close();
  p = await visit(c, '/keanggotaan.html', 'XSS-stored: keanggotaan'); await p.close();
  await c.close();
}

/* ---------------- D. Feedback form with payloads → success panel ---------------- */
{
  const c = await ctx();
  const p = await visit(c, '/umpan-balik.html', 'XSS-feedback: submit payload via form', async (page) => {
    const fill = async (sel, v) => { const el = await page.$(sel); if (el) await el.fill(v).catch(() => {}); };
    await fill('input[name="nama"], #ub-nama', 'Nama ' + X);
    await fill('input[name="email"], #ub-email', 'a@contoh.id');
    await fill('input[name="subjek"], #ub-subjek', 'Subjek ' + X2);
    await fill('textarea[name="pesan"], #ub-pesan', 'Pesan panjang ' + X + X2);
    const submit = await page.$('form button[type="submit"]');
    if (submit) await submit.click().catch(() => {});
    await page.waitForTimeout(1200);
    const stored = await page.evaluate(() => localStorage.getItem('ppapi_feedback'));
    console.log('   stored feedback:', (stored || '').slice(0, 300));
  });
  await p.screenshot({ path: path.join(SHOTS, 'sec-umpan-balik-xss.png'), fullPage: false });
  await p.close();
  await c.close();
}

/* ---------------- E. Rel audit on every page (guest + auth) ---------------- */
{
  const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html'));
  const g = await ctx();
  const a = await ctx({ seed: { fn: seedFn, arg: { u: DEMO_USER, m: null } } });
  for (const [c, tag] of [[g, 'guest'], [a, 'auth']]) {
    for (const f of pages) {
      const page = await c.newPage();
      try { await page.goto(`${BASE}/${f}`, { waitUntil: 'networkidle', timeout: 15000 }); } catch {}
      await page.waitForTimeout(300);
      const s = await scan(page).catch(() => ({ blank: ['scan failed'] }));
      if (s.blank.length) log(`rel audit ${tag} ${f}`, false, s.blank.join(' || '));
      await page.close();
    }
  }
  log('rel audit complete', true);
  await g.close(); await a.close();
}

await browser.close();
server.close();
const fails = results.filter(r => !r.ok);
console.log(`\n${results.length - fails.length} passed, ${fails.length} failed`);
fs.writeFileSync(path.join(SHOTS, 'security-lens-results.json'), JSON.stringify(results, null, 2));
