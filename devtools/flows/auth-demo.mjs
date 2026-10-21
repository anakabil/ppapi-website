// PPAPI foundation — demo-mode auth/store flow test.
// Run from devtools/:  node flows/auth-demo.mjs
// Serves ../site over HTTP (plus two in-memory test pages for auth gating),
// drives PPAPI.auth / PPAPI.store / PPAPI.util through page.evaluate and
// asserts the results. Exits with code 1 on the first failure.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { galleryFile, GALLERY } from './dev-gallery.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };

const SKELETON = (page, gate, body) => `<!doctype html><html lang="id" class="no-js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Uji — PPAPI</title>
<link rel="icon" href="assets/img/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="assets/css/main.css"><script>document.documentElement.classList.replace('no-js','js')</script></head>
<body data-page="${page}" data-auth="${gate}"><a class="skip-link" href="#main">Lewati ke konten utama</a><div id="site-header"></div>
<main id="main" tabindex="-1"><section class="page-hero page-hero--compact"><div class="container page-hero__inner"><h1 class="h1">Halaman uji</h1></div></section><section class="section"><div class="container"><p id="secret">KONTEN-RAHASIA</p></div></section></main>
<div id="site-footer"></div><script src="assets/js/config.js" defer></script><script src="assets/js/core.js" defer></script><script src="assets/js/auth.js" defer></script><script src="assets/js/store.js" defer></script></body></html>`;
const VIRTUAL = {
  '/__req.html': SKELETON('dashboard', 'required'),
  '/__guest.html': SKELETON('masuk', 'guest'),
};

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (VIRTUAL[p]) { res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(VIRTUAL[p]); }
  const file = galleryFile(p) || path.join(ROOT, p.endsWith('/') ? p + 'index.html' : p);
  if (!(file.startsWith(ROOT) || file.startsWith(GALLERY)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'content-type': MIME['.html'] }); return res.end('<!doctype html><title>404</title><p>Not found</p>'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let passed = 0;
const fail = (msg, extra) => { console.error('✗ ' + msg + (extra !== undefined ? '\n    ' + JSON.stringify(extra) : '')); process.exitCode = 1; throw new Error(msg); };
const ok = (cond, msg, extra) => { if (!cond) fail(msg, extra); passed++; console.log('✓ ' + msg); };

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, locale: 'id-ID', reducedMotion: 'reduce' });
const page = await context.newPage();
const errors = [];
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
// pages owned by other authors may not exist yet → ignore 404 resource noise
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console.error: ' + m.text()); });

try {
  await page.goto(`${BASE}/styleguide.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady());

  // ---------- environment ----------
  const env = await page.evaluate(async () => ({ mode: PPAPI.auth.mode, user: await PPAPI.auth.ready(), cur: PPAPI.auth.current(), guest: !!document.querySelector('.account__guest') }));
  ok(env.mode === 'demo', 'auth.mode is "demo" when firebase.apiKey is empty', env);
  ok(env.user === null && env.cur === null, 'ready() resolves null when signed out');
  ok(env.guest, 'header shows Masuk/Daftar when signed out');

  // ---------- util ----------
  const u = await page.evaluate(() => {
    const U = PPAPI.util;
    return {
      p1: U.normalizePhoneID('0812-3456-7890'), p2: U.normalizePhoneID('+62 812 3456 7890'), p3: U.normalizePhoneID('6281234567890'),
      p4: U.normalizePhoneID('812345678'), bad: U.normalizePhoneID('021-555-1234'), bad2: U.normalizePhoneID('abc'),
      fmt: U.formatPhoneID('+6281234567890'),
      d1: U.formatDate('2026-10-07'), d2: U.formatDate('2026-10-07', { short: true }), d3: U.formatDate('2026-10-08', { weekday: true }),
      r1: U.formatDateRange('2026-10-21', '2026-10-23'), r2: U.formatDateRange('2026-10-30', '2026-11-02'), r3: U.formatDateRange('2026-12-30', '2027-01-02'),
      kta1: U.ktaFromUid('abc', 2026), kta2: U.ktaFromUid('abc', 2026),
      c0: U.certStatus('').key, cPast: U.certStatus('2020-01-01').key, cSoon: U.certStatus(new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10)).key, cOk: U.certStatus('2099-01-01').key,
      init: U.initials('rahmat hidayat saputra'), esc: U.h('<b a="1">&\'</b>'),
      n1: U.safeNext('anggota.html#aplikasi'), n2: U.safeNext('https://evil.example'), n3: U.safeNext('//evil.example/x.html'), n4: U.safeNext('javascript:alert(1)'), n5: U.safeNext('../x.html'),
      badge: U.contohBadge({ contoh: true }), nobadge: U.contohBadge({}),
      greet: /^Selamat (pagi|siang|sore|malam)$/.test(U.greeting()),
      email: [U.isEmail('a@b.id'), U.isEmail('a@b'), U.isEmail('a b@c.id')],
      strength: [U.passwordStrength('abc').score, U.passwordStrength('Perancah2026').valid],
    };
  });
  ok(u.p1 === '+6281234567890' && u.p2 === '+6281234567890' && u.p3 === '+6281234567890' && u.p4 === '+62812345678', 'normalizePhoneID accepts 08…/+62…/62…/8…', u);
  ok(u.bad === null && u.bad2 === null, 'normalizePhoneID rejects non-mobile/garbage');
  ok(u.fmt === '+62 812-3456-7890', 'formatPhoneID → "+62 812-3456-7890"', u.fmt);
  ok(u.d1 === '7 Oktober 2026' && u.d2 === '7 Okt 2026' && u.d3 === 'Kamis, 8 Oktober 2026', 'formatDate long/short/weekday', [u.d1, u.d2, u.d3]);
  ok(u.r1 === '21–23 Oktober 2026' && u.r2 === '30 Oktober – 2 November 2026' && u.r3 === '30 Desember 2026 – 2 Januari 2027', 'formatDateRange', [u.r1, u.r2, u.r3]);
  ok(/^PPAPI-2026-\d{6}$/.test(u.kta1) && u.kta1 === u.kta2, 'ktaFromUid deterministic PPAPI-YYYY-NNNNNN', u.kta1);
  ok(u.c0 === 'tanpa-batas' && u.cPast === 'kedaluwarsa' && u.cSoon === 'segera' && u.cOk === 'aktif', 'certStatus keys');
  ok(u.init === 'RH' && u.esc === '&lt;b a=&quot;1&quot;&gt;&amp;&#39;&lt;/b&gt;', 'initials + h() escaping', [u.init, u.esc]);
  ok(u.n1 === 'anggota.html#aplikasi' && [u.n2, u.n3, u.n4, u.n5].every(v => v === 'dashboard.html'), 'safeNext allows relative pages, rejects open redirects', u);
  ok(u.badge === '<span class="badge badge--contoh">Contoh</span>' && u.nobadge === '', 'contohBadge');
  ok(u.greet && u.email.join() === 'true,false,false' && u.strength[0] === 1 && u.strength[1] === true, 'greeting / isEmail / passwordStrength');

  // ---------- sign up by email ----------
  const su = await page.evaluate(async () => {
    const user = await PPAPI.auth.signUpEmail({ name: 'Budi Uji Coba', email: 'Budi.Uji@Contoh.id', password: 'Perancah2026' });
    const member = await PPAPI.store.getMember(user.uid);
    const users = JSON.parse(localStorage.getItem('ppapi_demo_users'));
    return { user, cur: PPAPI.auth.current(), member, stored: users['budi.uji@contoh.id'], header: !!document.querySelector('.account__trigger'), initials: document.querySelector('.account__trigger .avatar')?.textContent };
  });
  ok(su.user && su.user.uid && su.user.name === 'Budi Uji Coba' && su.user.email === 'budi.uji@contoh.id' && su.user.provider === 'password', 'signUpEmail creates the user (email normalised)', su.user);
  ok(su.cur && su.cur.uid === su.user.uid, 'current() returns the signed-up user');
  ok(/^[0-9a-f]{64}$/.test(su.stored.hash), 'password stored as SHA-256 hex (never plain text)', su.stored.hash);
  /* v2 (SPEC-v2 §3.3, FOUNDATION_NOTES §9.12): a new account is 'Draf' without a KTA until the secretariat approves it */
  ok(su.member && su.member.status === 'Draf' && su.member.memberType === 'Praktisi' && su.member.kta === '' && su.member.joinedAt === new Date().toLocaleDateString('sv-SE'), 'ensureMember created default member record (v2: Draf, no KTA)', su.member);
  ok(su.header && su.initials === 'BU', 'header re-rendered with avatar initials after sign-up', su.initials);

  // ---------- validation errors ----------
  const errs = await page.evaluate(async () => {
    const out = {};
    for (const [k, fn] of Object.entries({
      dup: () => PPAPI.auth.signUpEmail({ name: 'Budi Lagi', email: 'budi.uji@contoh.id', password: 'Perancah2026' }),
      weak: () => PPAPI.auth.signUpEmail({ name: 'Budi Lagi', email: 'lain@contoh.id', password: 'pendek' }),
      bademail: () => PPAPI.auth.signUpEmail({ name: 'Budi Lagi', email: 'bukan-email', password: 'Perancah2026' }),
    })) { try { await fn(); out[k] = 'NO ERROR'; } catch (e) { out[k] = { code: e.code, message: e.message }; } }
    return out;
  });
  ok(errs.dup.code === 'auth/email-already-in-use' && /sudah terdaftar/.test(errs.dup.message), 'duplicate email → auth/email-already-in-use (Indonesian)', errs.dup);
  ok(errs.weak.code === 'auth/weak-password' && /minimal 8 karakter/.test(errs.weak.message), 'weak password → auth/weak-password', errs.weak);
  ok(errs.bademail.code === 'auth/invalid-email', 'invalid email → auth/invalid-email', errs.bademail);

  // ---------- sign out → wrong password → correct sign in ----------
  const so = await page.evaluate(async () => {
    await PPAPI.auth.signOut();
    const after = PPAPI.auth.current();
    let wrong;
    try { await PPAPI.auth.signInEmail({ email: 'budi.uji@contoh.id', password: 'SalahSandi99' }); wrong = 'NO ERROR'; }
    catch (e) { wrong = { code: e.code, message: e.message }; }
    const user = await PPAPI.auth.signInEmail({ email: 'budi.uji@contoh.id', password: 'Perancah2026', remember: false });
    return { after, wrong, user, inSession: !!sessionStorage.getItem('ppapi_demo_session'), inLocal: !!localStorage.getItem('ppapi_demo_session'), guest: !!document.querySelector('.account__guest') };
  });
  ok(so.after === null, 'signOut() clears the session');
  ok(so.wrong.code === 'auth/invalid-credential' && so.wrong.message === 'Email atau kata sandi tidak sesuai. Silakan periksa kembali.', 'wrong password → Indonesian invalid-credential error', so.wrong);
  ok(so.user && so.user.email === 'budi.uji@contoh.id', 'signInEmail with the right password succeeds');
  ok(so.inSession && !so.inLocal, 'remember:false keeps the session in sessionStorage only');

  // ---------- phone OTP ----------
  const ph = await page.evaluate(async () => {
    await PPAPI.auth.signOut();
    let invalidPhone;
    try { await PPAPI.auth.startPhone({ phone: '021 555' }); } catch (e) { invalidPhone = e.code; }
    const sent = await PPAPI.auth.startPhone({ phone: '0812-3456-7890', buttonEl: document.body });
    const toast = [...document.querySelectorAll('.toast__msg')].map(t => t.textContent).join(' | ');
    let wrong;
    try { await PPAPI.auth.confirmPhone({ code: '000000' }); } catch (e) { wrong = { code: e.code, message: e.message }; }
    const user = await PPAPI.auth.confirmPhone({ code: '123456', name: 'Sari Uji' });
    return { invalidPhone, sent, toast, wrong, user };
  });
  ok(ph.invalidPhone === 'auth/invalid-phone-number', 'startPhone rejects invalid number');
  ok(ph.sent.phone === '+6281234567890' && /••••/.test(ph.sent.masked), 'startPhone normalises and masks the number', ph.sent);
  ok(/Mode demo: kode OTP Anda 123456/.test(ph.toast), 'demo OTP toast shown', ph.toast);
  ok(ph.wrong.code === 'auth/invalid-verification-code' && /Kode OTP tidak sesuai/.test(ph.wrong.message), 'wrong OTP → Indonesian error', ph.wrong);
  ok(ph.user && ph.user.provider === 'phone' && ph.user.phone === '+6281234567890' && ph.user.name === 'Sari Uji', 'confirmPhone(123456) signs in a phone user', ph.user);

  // ---------- store ----------
  const st = await page.evaluate(async () => {
    const user = PPAPI.auth.current();
    const m0 = await PPAPI.store.ensureMember(user);
    const m1 = await PPAPI.store.saveMember(user.uid, {
      status: 'Aktif', kta: 'HACK', memberType: 'Kehormatan',
      profile: { city: 'Balikpapan', province: 'Kalimantan Timur' },
      competencies: [{ id: 'k1', code: 'SCF-05', name: 'Teknisi Scaffolding', level: 'Mahir', since: 2021, notes: '' }],
      certificates: [{ id: 'c1', title: 'Teknisi Scaffolding', number: 'CONTOH/01', issuer: 'BNSP / LSP', issuedAt: '2024-01-10', expiresAt: '2027-01-10', link: '' }],
    });
    const m2 = await PPAPI.store.saveMember(user.uid, { profile: { company: 'PT Contoh' } });
    const m3 = await PPAPI.store.getMember(user.uid);
    const fb = await PPAPI.store.submitFeedback({ kategori: 'Saran', pesan: 'Mohon tambahkan jadwal pelatihan di Kalimantan.', nama: 'Sari', email: 'sari@contoh.id', rating: 5, extra: 'dibuang' });
    let short; try { await PPAPI.store.submitFeedback({ kategori: 'Saran', pesan: 'pendek' }); } catch (e) { short = e.code; }
    let cat; try { await PPAPI.store.submitFeedback({ kategori: 'Spam', pesan: 'Pesan yang cukup panjang.' }); } catch (e) { cat = e.code; }
    const anon = await PPAPI.store.submitFeedback({ kategori: 'Kritik', pesan: 'Kritik anonim yang membangun.', nama: 'Rahasia', anonim: true });
    const list = JSON.parse(localStorage.getItem('ppapi_feedback'));
    return { m0, m1, m2, m3, fb, short, cat, list };
  });
  ok(st.m0 && st.m0.uid && st.m0.phone === '+6281234567890' && st.m0.name === 'Sari Uji', 'store.ensureMember returns member synced from the account', st.m0);
  ok(st.m1.status === 'Draf' && st.m1.kta === st.m0.kta && st.m1.memberType === 'Praktisi', 'saveMember ignores protected fields (status, kta, memberType) (v2 status Draf)', st.m1);
  ok(st.m1.profile.city === 'Balikpapan' && st.m1.competencies.length === 1 && st.m1.certificates.length === 1 && st.m1.updatedAt, 'saveMember merges profile/competencies/certificates and stamps updatedAt');
  ok(st.m2.profile.city === 'Balikpapan' && st.m2.profile.company === 'PT Contoh', 'profile patches merge (do not wipe other fields)', st.m2.profile);
  ok(JSON.stringify(st.m3) === JSON.stringify(st.m2), 'getMember returns the saved record');
  ok(/^UB-\d{8}-[A-Z0-9]{4}$/.test(st.fb.id), 'submitFeedback returns a reference id', st.fb);
  ok(st.short === 'store/message-too-short' && st.cat === 'store/invalid-category', 'submitFeedback validates message length and category');
  ok(st.list.length === 2 && !('extra' in st.list[0]) && st.list[0].uid && st.list[1].nama === '' && st.list[1].uid === null, 'feedback stored without unknown keys; anonim strips identity', st.list);

  // ---------- updateName + Google demo ----------
  const nm = await page.evaluate(async () => { const u = await PPAPI.auth.updateName('Sari Uji Coba'); return { u, header: document.querySelector('.account__name')?.textContent }; });
  ok(nm.u.name === 'Sari Uji Coba' && nm.header === 'Sari', 'updateName updates the session and header', nm);

  await page.evaluate(() => { PPAPI.auth.signOut(); window.__g = PPAPI.auth.signInGoogle().then(u => ({ u }), e => ({ e: { code: e.code, message: e.message } })); });
  await page.waitForSelector('.modal [data-demo-google]');
  ok(await page.textContent('.modal__title') === 'Simulasi Masuk dengan Google', 'demo Google modal opens');
  await page.click('.modal__footer .btn--primary');
  ok(await page.evaluate(() => document.querySelector('#dg-name').closest('.field').classList.contains('is-invalid')), 'demo Google modal validates empty fields');
  await page.fill('#dg-name', 'Gita Uji');
  await page.fill('#dg-email', 'gita.uji@gmail.com');
  await page.click('.modal__footer .btn--primary');
  const g = await page.evaluate(() => window.__g);
  ok(g.u && g.u.provider === 'google' && g.u.email === 'gita.uji@gmail.com', 'signInGoogle (demo) signs in after the simulated chooser', g);
  await page.evaluate(() => { PPAPI.auth.signOut(); window.__g2 = PPAPI.auth.signInGoogle().then(u => ({ u }), e => ({ e: e.code })); });
  await page.waitForSelector('.modal [data-demo-google]');
  await page.keyboard.press('Escape');
  const g2 = await page.evaluate(() => window.__g2);
  ok(g2.e === 'auth/popup-closed-by-user', 'closing the Google modal rejects with auth/popup-closed-by-user', g2);

  // ---------- auth gating (in-memory pages) ----------
  await page.evaluate(() => PPAPI.auth.signOut());
  await page.goto(`${BASE}/__req.html?x=1#aplikasi`, { waitUntil: 'networkidle' });
  await page.waitForURL(/masuk\.html/);
  ok(page.url().endsWith('/masuk.html?next=' + encodeURIComponent('__req.html?x=1#aplikasi')), 'data-auth="required" redirects to masuk.html?next=… when signed out', page.url());

  await page.goto(`${BASE}/styleguide.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => PPAPI.auth.signInEmail({ email: 'budi.uji@contoh.id', password: 'Perancah2026' }));
  await page.goto(`${BASE}/__req.html`, { waitUntil: 'networkidle' });
  const gate = await page.evaluate(() => ({ ready: document.body.classList.contains('auth-ready'), pending: document.body.classList.contains('auth-pending'), visible: getComputedStyle(document.querySelector('main')).visibility, ribbon: !document.querySelector('[data-demo-ribbon]').hidden && document.documentElement.classList.contains('has-demo-ribbon') }));
  ok(gate.ready && !gate.pending && gate.visible === 'visible', 'required page shows content once signed in', gate);
  ok(gate.ribbon, 'demo ribbon visible on auth pages in demo mode');
  await page.click('[data-ribbon-close]');
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_demo_ribbon_dismissed')) === true && !document.documentElement.classList.contains('has-demo-ribbon')), 'ribbon dismissal remembered');

  /* v2: anggota.html is data-auth="active" (a Draf account ends on dashboard.html) — a public page tests the next redirect */
  await page.goto(`${BASE}/__guest.html?next=${encodeURIComponent('keanggotaan.html#alur')}`, { waitUntil: 'networkidle' });
  await page.waitForURL(/keanggotaan\.html/);
  ok(page.url().endsWith('/keanggotaan.html#alur'), 'data-auth="guest" redirects signed-in users to next', page.url());
  await page.goto(`${BASE}/__guest.html?next=${encodeURIComponent('https://evil.example/')}`, { waitUntil: 'networkidle' });
  await page.waitForURL(/dashboard\.html/);
  ok(page.url().endsWith('/dashboard.html'), 'guest redirect ignores external next (open-redirect safe)', page.url());

  // sign out from the account menu on a required page → index.html
  await page.goto(`${BASE}/__req.html`, { waitUntil: 'networkidle' });
  await page.click('.account__trigger');
  ok(await page.isVisible('#account-menu'), 'account dropdown opens');
  await Promise.all([page.waitForURL(/index\.html$/), page.click('#account-menu [data-signout]')]);
  ok(await page.evaluate(() => !localStorage.getItem('ppapi_demo_session')), 'Keluar from the menu signs out and leaves the protected page');

  ok(errors.length === 0, 'no page errors / console errors during the flow', errors);
  console.log(`\nAll ${passed} checks passed.`);
} catch (e) {
  if (!process.exitCode) { console.error(e); process.exitCode = 1; }
  if (errors.length) console.error('Page errors:', errors);
} finally {
  await browser.close();
  server.close();
}
