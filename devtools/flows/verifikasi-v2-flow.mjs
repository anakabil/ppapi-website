// PPAPI — verifikasi.html v2 flow (Mode Demo): PPAPI.store.registry.lookup as the only data source,
// v1 behaviour kept (?kta=, name search, expired state), demo approvals become verifiable, the signed-in
// member's own record per status, error / slow / race handling, escaping, mobile.
// Run from devtools/:  node flows/verifikasi-v2-flow.mjs [--shots]
// Leaves the shared regulasi-verifikasi-flow.mjs (v1) untouched — it still has to pass as well.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
const SAVE = process.argv.includes('--shots');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* Firebase mode (section F): config.js served with a FAKE apiKey + the in-memory compat-SDK stub (with its
   mirror of firestore.rules) taken read-only from flows/firebase-v2-stub.mjs — that file is not edited. */
const fbServer = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  let body = fs.readFileSync(file);
  if (p === '/assets/js/config.js') body = body.toString('utf8').replace("apiKey: ''", "apiKey: 'AIzaSyFAKE-stub-key-000000000000000000'").replace("projectId: ''", "projectId: 'ppapi-stub'");
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(body);
});
await new Promise(r => fbServer.listen(0, '127.0.0.1', r));
const FB_BASE = `http://127.0.0.1:${fbServer.address().port}`;
function stubSource() {
  try {
    const src = fs.readFileSync(path.join(__dirname, 'firebase-v2-stub.mjs'), 'utf8').replace(/\r\n/g, '\n');
    const start = src.indexOf('const STUB = () => {');
    const testMark = src.indexOf('/* ------------------------------------------------------------------ test */', start);
    const end = testMark === -1 ? -1 : src.lastIndexOf('\n};', testMark);
    if (start === -1 || end === -1 || end < start) return '';
    return '(' + src.slice(start + 'const STUB = '.length, end + 2) + ')();';
  } catch (e) { return ''; }
}

let pass = 0, fail = 0;
const ok = (cond, label, detail) => { if (cond) { pass++; console.log('  ✓ ' + label); } else { fail++; console.log('  ✗ ' + label + (detail !== undefined ? '  → ' + String(typeof detail === 'string' ? detail : JSON.stringify(detail)).slice(0, 300) : '')); } };
const shot = async (page, name) => { if (SAVE) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

const USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
function member(status, extra = {}) {
  const m = {
    uid: USER.uid, name: USER.name, email: USER.email, phone: USER.phone,
    kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31',
    approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: ADMIN.uid,
    profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Contoh Konstruksi', position: 'Supervisor', birthDate: '1990-01-01' },
    competencies: [{ id: 'k1', code: 'SCF-SUP', name: 'Supervisor Perancah', level: 'Mahir', since: 2019, notes: '' }], certificates: [],
    application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z', updatedAt: '2026-03-15T02:00:00.000Z', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: USER.name, tanggal: '2026-03-15' }, catatan: '' },
    review: { note: '', history: [] }, updatedAt: '2026-09-30T08:00:00.000Z',
  };
  if (status === 'Kedaluwarsa') m.validUntil = '2026-06-30';
  else if (status !== 'Aktif') m.status = status;
  return Object.assign(m, extra);
}

const browser = await chromium.launch();
const errors = [];
function watch(page, tag) {
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(`${tag} console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`${tag} pageerror: ${e.message}`));
}
/* 2026-10-15: registry.js is empty (sample people removed). The public list used by these flows is seeded the way
   approvals write it (store.js registryEntry → localStorage ppapi_registry) — test fixtures, flagged contoh:true. */
const REG_FIX = [
  { kta: 'PPAPI-2026-000123', nama: 'Andika Prasetya', kategori: 'Praktisi', kompetensi: ['Teknisi Scaffolding'], kota: 'Jakarta Timur', berlakuHingga: '2029-12-31', status: 'Aktif', contoh: true },
  { kta: 'PPAPI-2026-001208', nama: 'Siti Rahmawati', kategori: 'Ahli', kompetensi: ['Inspektur Scaffolding'], kota: 'Surabaya', berlakuHingga: '2029-12-31', status: 'Aktif', contoh: true },
  { kta: 'PPAPI-2025-000457', nama: 'Yoga Pranata', kategori: 'Praktisi', kompetensi: ['Operator Scaffolding'], kota: 'Balikpapan', berlakuHingga: '2028-12-31', status: 'Aktif', contoh: true },
  { kta: 'PPAPI-2025-000731', nama: 'Maria Kristina Sitorus', kategori: 'Ahli', kompetensi: ['Perancang Scaffolding'], kota: 'Medan', berlakuHingga: '2028-12-31', status: 'Aktif', contoh: true },
  { kta: 'PPAPI-2023-000089', nama: 'Bayu Firmansyah', kategori: 'Praktisi', kompetensi: ['Kepala Tukang Pasang Perancah'], kota: 'Semarang', berlakuHingga: '2026-06-30', status: 'Nonaktif', contoh: true },
  { kta: 'PPAPI-2026-002310', nama: 'Ni Kadek Ayu Lestari', kategori: 'Praktisi', kompetensi: ['Petugas K3 Konstruksi'], kota: 'Denpasar', berlakuHingga: '2029-12-31', status: 'Aktif', contoh: true },
];
async function ctxFor(vp, seed) {
  const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.dpr || 1, reducedMotion: 'reduce', locale: 'id-ID' });
  await ctx.addInitScript(fix => {
    try {
      if (sessionStorage.getItem('__vf_reg')) return;
      sessionStorage.setItem('__vf_reg', '1');
      const reg = JSON.parse(localStorage.getItem('ppapi_registry') || '{}');
      fix.forEach(e => { if (!reg[e.kta]) reg[e.kta] = Object.assign({ namaCari: e.nama.toLowerCase(), updatedAt: '2026-10-01T00:00:00.000Z' }, e); });
      localStorage.setItem('ppapi_registry', JSON.stringify(reg));
    } catch (e) {}
  }, REG_FIX);
  if (seed) await ctx.addInitScript(seed.fn, seed.arg);
  return ctx;
}
async function open(ctx, q = '', tag = '') {
  const page = await ctx.newPage(); watch(page, tag);
  await page.goto(`${BASE}/verifikasi.html${q}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.classList.contains('auth-ready'), null, { timeout: 15000 });
  await page.waitForTimeout(150);
  return page;
}
async function search(page, q) {
  await page.fill('#vf-q', q);
  await page.press('#vf-q', 'Enter');
  await page.waitForFunction(() => !document.querySelector('[data-vf="results"]').hasAttribute('aria-busy'), null, { timeout: 8000 });
  await page.waitForTimeout(80);
}
const txt = (page, sel) => page.locator(sel).first().evaluate(el => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
/** set the demo session (localStorage) and reload */
async function becomes(page, user, extraStorage = {}) {
  await page.evaluate(({ u, extra }) => {
    if (u) localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); else { localStorage.removeItem('ppapi_demo_session'); sessionStorage.removeItem('ppapi_demo_session'); }
    Object.entries(extra).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v)));
  }, { u: user, extra: extraStorage });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.classList.contains('auth-ready'), null, { timeout: 15000 });
  await page.waitForTimeout(150);
}

const DESKTOP = { name: 'desktop', viewport: { width: 1440, height: 900 } };
const MOBILE = { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, dpr: 2 };

try {
  /* ------------------------------------------------------------------ */
  console.log('\nA. Data comes from PPAPI.store.registry.lookup (demo: samples + seeded approvals)');
  let ctx = await ctxFor(DESKTOP);
  let page = await open(ctx, '', 'A');
  await page.evaluate(() => {
    window.__lookups = [];
    const real = PPAPI.store.registry.lookup;
    PPAPI.store.registry.lookup = function (q) { window.__lookups.push(q); return real.apply(this, arguments); };
  });
  await search(page, 'PPAPI-2026-000123');
  ok(await page.evaluate(() => window.__lookups.length === 1 && window.__lookups[0] === 'PPAPI-2026-000123'), 'one lookup per search, with the typed query', await page.evaluate(() => window.__lookups));
  ok(await page.locator('.vf-result--ok').isVisible() && /Andika Prasetya/.test(await txt(page, '.vf-result__name')), 'registry entry (seeded like an approval) → Terverifikasi');
  ok((await page.evaluate(() => (PPAPI.data.registry || []).length)) === 0, 'static registry.js is empty (sample people removed 2026-10-15)');
  await search(page, 'PPAPI-2025-000318');
  ok(await page.locator('.vf-result--ok').isVisible() && /Dimas Haryanto/.test(await txt(page, '.vf-result__name')), 'demo-approved member (seed, ppapi_registry) is verifiable', await txt(page, '.vf-result__name'));
  ok(await page.locator('.vf-result .badge--contoh').count() === 1, 'seeded approval keeps its Contoh badge');
  await search(page, 'dimas');
  ok(await page.locator('.vf-item').count() === 1 || await page.locator('.vf-result').isVisible(), 'name search finds the approved member');
  await search(page, 'ari');
  ok(await page.locator('.vf-item').count() === 2 && await page.locator('.vf-item mark.vf-hl').count() === 2, 'name search "ari" → 2 highlighted matches (v1 kept)');
  await search(page, 'PPAPI-2026');
  ok(await page.locator('.vf-item').count() === 3, 'KTA prefix → list of 3 (v1 kept)');
  await search(page, 'ra');
  ok(/minimal 3 huruf/.test(await txt(page, '[data-vf="error"]')) && await page.evaluate(() => window.__lookups.filter(q => q === 'ra').length === 0), 'too-short query → inline error, no lookup');
  ok(await page.locator('[data-vf="sample"]').count() === 0, 'no sample-data notice on the page (removed with the sample registry)');
  await page.close();
  page = await open(ctx, '?kta=PPAPI-2023-000089', 'A2');
  ok(await page.inputValue('#vf-q') === 'PPAPI-2023-000089' && await page.locator('.vf-result--warn').isVisible() && /Masa berlaku telah habis/.test(await txt(page, '.vf-result__state')), '?kta= expired entry → warn state');
  await page.close();
  page = await open(ctx, '?kta=PPAPI-2026-999999', 'A3');
  ok(/Belum tercantum/.test(await txt(page, '.vf-result__state')) && /diperbarui saat keanggotaan disetujui/.test(await txt(page, '.vf-result__desc')), 'unknown well-formed KTA → "Belum tercantum" (registry updated on approval)');
  await page.close();

  /* ------------------------------------------------------------------ */
  console.log('\nB. Admin approves an applicant → public verification works; deactivate → "tidak aktif"');
  page = await open(ctx, '', 'B');
  await becomes(page, ADMIN, { ppapi_demo_admins: [ADMIN.uid] });
  const approved = await page.evaluate(async () => {
    const m = await PPAPI.store.admin.approve('demo-contoh-0001', { note: 'Data lengkap.' });
    return { kta: m.kta, status: m.status, kategori: m.memberType, kota: m.profile.city };
  });
  ok(/^PPAPI-\d{4}-\d{6}$/.test(approved.kta) && approved.status === 'Aktif', 'admin.approve assigns a KTA', approved);
  await becomes(page, null);
  await search(page, approved.kta);
  ok(await page.locator('.vf-result--ok').isVisible() && /Bagus Pratama/.test(await txt(page, '.vf-result__name')), 'signed-out visitor: newly approved KTA → Terverifikasi', await txt(page, '.vf-result'));
  ok((await txt(page, '.vf-result__kv')).includes(approved.kota) && (await txt(page, '.vf-result__kv')).includes(approved.kategori), 'record shows kategori + kota from the approval');
  ok(page.url().includes('kta='), 'URL synced with ?kta=');
  await shot(page, 'vf2-approved-desktop');
  await becomes(page, ADMIN);
  await page.evaluate(async () => { await PPAPI.store.admin.deactivate('demo-contoh-0001', 'Uji penonaktifan.'); });
  await becomes(page, null);
  await page.waitForTimeout(200);
  ok(await page.inputValue('#vf-q') === approved.kta && await page.locator('.vf-result--warn').isVisible() && /tidak aktif/.test(await txt(page, '.vf-result__state')), 'after deactivation: same link → "Keanggotaan tidak aktif"', await txt(page, '.vf-result__state'));
  await page.close();
  await ctx.close();

  /* ------------------------------------------------------------------ */
  console.log('\nC. The signed-in member\'s own record');
  const seedMember = m => ({
    fn: ({ u, m }) => {
      try {
        if (sessionStorage.getItem('__vf2')) return;
        sessionStorage.setItem('__vf2', '1');
        localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
        const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
        users[u.email] = { ...u, hash: 'x' };
        localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
        localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
      } catch (e) {}
    }, arg: { u: USER, m },
  });
  // C1 active, not in the registry → own summary
  ctx = await ctxFor(DESKTOP, seedMember(member('Aktif')));
  page = await open(ctx, '', 'C1');
  ok(await page.locator('[data-vf="mine"]').isVisible() && /Rahmat Hidayat/.test(await txt(page, '[data-vf="mine"]')) && await page.locator('[data-vf="mine"] .badge').count() === 0, 'active member → "Periksa KTA saya" (no status badge)');
  await page.click('[data-vf="mine"] [data-vf-kta]');
  await page.waitForTimeout(250);
  ok(await page.locator('.vf-result--self').isVisible() && /belum tercantum/.test(await txt(page, '.vf-result--self')), 'own KTA not in registry → "KTA Anda" summary');
  const selfKv = await txt(page, '.vf-result--self .kv');
  ok(/31 Desember 2029/.test(selfKv) && /Aktif/.test(selfKv) && /Supervisor Perancah/.test(selfKv), 'summary shows validity (validUntil), status, competencies', selfKv);
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'vf-r-state'), 'focus moves to the result heading');
  await shot(page, 'vf2-self-desktop');
  // C2 sign out (header menu equivalent) → re-checked as a visitor
  await page.evaluate(() => PPAPI.auth.signOut());
  await page.waitForFunction(() => !location.pathname.endsWith('verifikasi.html') || !document.querySelector('.vf-result--self'), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(300);
  ok(page.url().includes('verifikasi.html') && await page.locator('[data-vf="mine"]').isHidden() && /Belum tercantum/.test(await txt(page, '.vf-result__state')), 'sign-out → shortcut hidden, the same number re-checked publicly ("Belum tercantum")');
  await page.close();
  await ctx.close();

  // C3 approved through the console → registry hit + "KTA Anda" note
  ctx = await ctxFor(DESKTOP, seedMember(member('Menunggu Verifikasi', { kta: '', validUntil: '', approvedAt: '', approvedBy: '' })));
  page = await open(ctx, '', 'C3');
  ok(await page.locator('[data-vf="mine"]').isHidden(), 'pending applicant (no KTA yet) → no shortcut');
  await becomes(page, ADMIN, { ppapi_demo_admins: [ADMIN.uid] });
  const own = await page.evaluate(async () => (await PPAPI.store.admin.approve('demo-uji-0001', {})).kta);
  await becomes(page, USER);
  ok(await page.locator('[data-vf="mine"]').isVisible(), 'approved → shortcut appears');
  await page.click('[data-vf="mine"] [data-vf-kta]');
  await page.waitForTimeout(250);
  ok(await page.locator('.vf-result--ok').isVisible() && (await txt(page, '.vf-result__kta')).includes(own), 'own KTA now in the registry → Terverifikasi', own);
  ok(/Ini adalah KTA Anda/.test(await txt(page, '.vf-result__mine')) && await page.locator('.vf-result__mine a[href="anggota.html"]').count() === 1, '"KTA Anda" note links Profil Anggota');
  await search(page, 'PPAPI-2026-000123');
  ok(await page.locator('.vf-result__mine').count() === 0, 'someone else\'s KTA → no "KTA Anda" note');
  await search(page, 'rahmat');
  ok(await page.locator('.vf-item .badge--outline:has-text("KTA Anda")').count() === 1 || (await page.locator('.vf-result__mine').count()) === 1, 'name search marks the own entry');
  await page.close();
  await ctx.close();

  // C4 expired (Kedaluwarsa) own KTA not in the registry → public view + renewal note
  ctx = await ctxFor(DESKTOP, seedMember(member('Kedaluwarsa')));
  page = await open(ctx, '', 'C4');
  ok(await page.locator('[data-vf="mine"] .badge[data-status="Kedaluwarsa"]').count() === 1, 'expired member → shortcut with "Kedaluwarsa" badge');
  await page.click('[data-vf="mine"] [data-vf-kta]');
  await page.waitForTimeout(250);
  ok(await page.locator('.vf-result--self').count() === 0 && /Belum tercantum/.test(await txt(page, '.vf-result__state')), 'not active → no private summary, the public "Belum tercantum" state');
  ok(/perpanjangan/.test(await txt(page, '.vf-result__mine')) && await page.locator('.vf-result__mine a[href="pendaftaran.html"]').count() === 1, 'note offers the renewal form');
  await shot(page, 'vf2-expired-own-desktop');
  await page.close();
  await ctx.close();

  // C5 v1 account (Draf) still carrying an unofficial number → never treated as a KTA
  ctx = await ctxFor(DESKTOP, seedMember(member('Draf', { kta: 'PPAPI-2026-777001', validUntil: '', approvedAt: '', approvedBy: '', application: { submittedAt: '' } })));
  page = await open(ctx, '', 'C5');
  ok(await page.locator('[data-vf="mine"]').isHidden(), 'Draf with a v1 number → no shortcut');
  await search(page, 'PPAPI-2026-777001');
  ok(/Belum tercantum/.test(await txt(page, '.vf-result__state')) && await page.locator('.vf-result__mine, .vf-result--self').count() === 0, 'its number → public "Belum tercantum", no own-record card');
  await page.close();
  await ctx.close();

  /* ------------------------------------------------------------------ */
  console.log('\nD. Robustness: failure + retry, slow lookup, races, escaping, cap');
  ctx = await ctxFor(DESKTOP);
  page = await open(ctx, '', 'D');
  await page.evaluate(() => {
    window.__real = PPAPI.store.registry.lookup;
    PPAPI.store.registry.lookup = () => Promise.reject(Object.assign(new Error('Koneksi ke server terputus.'), { code: 'store/unavailable' }));
  });
  await search(page, 'PPAPI-2026-000123');
  ok(await page.locator('.vf-result--error').isVisible() && /belum dapat dilakukan/.test(await txt(page, '.vf-result__state')), 'lookup failure → calm error card');
  ok(/Koneksi ke server terputus/.test(await txt(page, '.vf-result__desc')), 'error message (escaped text) shown');
  await page.evaluate(() => { PPAPI.store.registry.lookup = window.__real; });
  await page.click('[data-vf-retry]');
  await page.waitForTimeout(300);
  ok(await page.locator('.vf-result--ok').isVisible(), '"Coba lagi" → result');
  // slow lookup → loader + busy button
  await page.evaluate(() => { PPAPI.store.registry.lookup = q => new Promise(r => setTimeout(() => r(window.__real(q)), 700)); });
  await page.fill('#vf-q', 'PPAPI-2025-000457');
  await page.press('#vf-q', 'Enter');
  await page.waitForTimeout(350);
  ok(await page.locator('.vf-loading .skeleton').isVisible() && await page.isDisabled('.vf-form__btn') && await page.getAttribute('[data-vf="results"]', 'aria-busy') === 'true', 'slow lookup → skeleton, aria-busy, button disabled');
  await page.waitForFunction(() => !document.querySelector('[data-vf="results"]').hasAttribute('aria-busy'), null, { timeout: 5000 });
  await page.waitForTimeout(80);
  ok(/Yoga Pranata/.test(await txt(page, '.vf-result__name')) && !(await page.isDisabled('.vf-form__btn')) && /Periksa/.test(await txt(page, '.vf-form__btn')), 'then the result; button restored');
  // race: a slow first query must not overwrite a faster second one
  await page.evaluate(() => {
    PPAPI.store.registry.lookup = q => new Promise(r => setTimeout(() => r(window.__real(q)), /000457/.test(q) ? 900 : 50));
  });
  await page.fill('#vf-q', 'PPAPI-2025-000457');
  await page.press('#vf-q', 'Enter');
  await page.waitForTimeout(60);
  await page.fill('#vf-q', 'PPAPI-2026-000123');
  await page.press('#vf-q', 'Enter');
  await page.waitForTimeout(1200);
  ok(/Andika Prasetya/.test(await txt(page, '.vf-result__name')), 'newest query wins (stale slow result ignored)', await txt(page, '.vf-result__name'));
  // escaping + capped list
  await page.evaluate(() => {
    const evil = i => ({ kta: 'PPAPI-2026-1000' + String(i).padStart(2, '0'), nama: 'Uji <img src=x onerror="window.__xss=1"> Nama ' + i, kategori: '<b>Ahli</b>', kompetensi: ['<script>window.__xss=2</script>'], kota: 'Kota "' + i + '"', berlakuHingga: '2029-12-31', status: 'Aktif' });
    PPAPI.store.registry.lookup = () => Promise.resolve({ exact: null, matches: Array.from({ length: 20 }, (_, i) => evil(i)), kind: 'nama' });
  });
  await search(page, 'uji nama');
  ok(/Sedikitnya 20 anggota ditemukan/.test(await txt(page, '.vf-list__title')) && await page.locator('.vf-item').count() === 10 && /hasil pertama/.test(await txt(page, '.vf-list__more')), 'capped lookup (20) → "Sedikitnya 20", 10 shown, refine hint');
  ok(await page.evaluate(() => !window.__xss && !document.querySelector('.vf-results img, .vf-results script, .vf-results b')), 'names / categories escaped (no injected elements)');
  await page.click('.vf-item [data-vf-kta]');
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => !window.__xss && !document.querySelector('.vf-results img, .vf-results script')), 'detail rendering escaped too');
  await page.close();
  await ctx.close();

  /* ------------------------------------------------------------------ */
  console.log('\nE. Mobile 390 px');
  ctx = await ctxFor(MOBILE, seedMember(member('Kedaluwarsa')));
  page = await open(ctx, '?kta=PPAPI-2026-000123', 'E');
  ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, 'no horizontal overflow (result)');
  await page.click('[data-vf="mine"] [data-vf-kta]');
  await page.waitForTimeout(250);
  ok(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, 'no horizontal overflow (own expired KTA)');
  const small = await page.evaluate(() => Array.from(document.querySelectorAll('.vf-lookup button, .vf-results a, .vf-results button')).filter(el => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0 && b.height < 43.5 && !el.closest('p'); }).map(el => el.textContent.trim().slice(0, 24) + ':' + Math.round(el.getBoundingClientRect().height)));
  ok(small.length === 0, 'touch targets ≥ 44 px in the lookup card + results', small);
  await shot(page, 'vf2-expired-own-mobile');
  await page.close();
  await ctx.close();

  /* ------------------------------------------------------------------ */
  console.log('\nF. Firebase mode (compat-SDK stub + rules mirror): registry collection, samples hidden');
  const STUB_SRC = stubSource();
  ok(!!STUB_SRC, 'Firebase stub source found in flows/firebase-v2-stub.mjs');
  if (STUB_SRC) {
    ctx = await browser.newContext({ viewport: DESKTOP.viewport, reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
    await ctx.addInitScript({ content: STUB_SRC });
    page = await ctx.newPage();
    const fbErrors = [];
    page.on('pageerror', e => fbErrors.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fbErrors.push(m.text()); });
    await page.goto(`${FB_BASE}/verifikasi.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.body.classList.contains('auth-ready'), null, { timeout: 15000 });
    ok(await page.evaluate(() => PPAPI.auth.mode === 'firebase' && PPAPI.store.mode === 'firebase'), 'page runs in Firebase mode');
    ok(await page.locator('[data-vf="sample"]').count() === 0, 'no sample-data notice (Firebase mode)');
    // the secretariat's approval wrote a public entry (simulated through the "console", bypassing rules)
    await page.evaluate(() => window.__fstub.console.set('registry/PPAPI-2026-000500', { kta: 'PPAPI-2026-000500', nama: 'Wahyu Setiawan', kategori: 'Ahli', kompetensi: ['Inspektur Scaffolding'], kota: 'Cilegon', berlakuHingga: '2029-12-31', status: 'Aktif', namaCari: 'wahyu setiawan' }));
    await search(page, 'ppapi 2026 000500');
    ok(await page.locator('.vf-result--ok').isVisible() && /Wahyu Setiawan/.test(await txt(page, '.vf-result__name')) && await page.locator('.vf-result .badge--contoh').count() === 0, 'Firestore registry entry → Terverifikasi (no Contoh badge)');
    ok(await page.evaluate(() => window.__fstub.log.some(l => /^registry\/PPAPI-2026-000500$/.test(l[1]) && l[2] === true)), 'exact KTA = one allowed read of registry/{kta} (signed out)');
    await search(page, 'PPAPI-2026-000123');
    ok(/Belum tercantum/.test(await txt(page, '.vf-result__state')), 'a demo-only (localStorage) number is not verifiable in Firebase mode');
    await search(page, 'wahyu');
    ok(await page.locator('.vf-item').count() === 1 && /Wahyu/.test(await txt(page, '.vf-item__name')), 'name search over the registry collection');
    await search(page, 'andika');
    ok(/Data tidak ditemukan/.test(await txt(page, '.vf-result__state')), 'demo-only names are not searchable in Firebase mode');
    ok(fbErrors.length === 0, 'Firebase mode: no page / console errors', fbErrors);
    await page.close();
    await ctx.close();
  }

  ok(errors.length === 0, 'no console errors / warnings / page errors', errors);
} catch (e) {
  fail++;
  console.error('\nFLOW ERROR:', e);
} finally {
  await browser.close();
  server.close();
  fbServer.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exitCode = fail ? 1 : 0;
}
