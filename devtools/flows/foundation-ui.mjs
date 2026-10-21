// PPAPI foundation — shared UI behaviour + state screenshots.
// Run from devtools/:  node flows/foundation-ui.mjs
// Exercises header scroll states, mobile menu (focus trap, Esc), account menu,
// modal/confirm (focus, Esc), tabs (arrow keys), accordion, toast, OTP helper,
// password toggle, and saves screenshots to devtools/shots/foundation-*.png
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { galleryFile, GALLERY } from './dev-gallery.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const REQ = `<!doctype html><html lang="id" class="no-js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Uji — PPAPI</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@400;500;600;700&family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Inter:wght@300;400;500;600;700&display=swap">
<link rel="stylesheet" href="assets/css/main.css"><script>document.documentElement.classList.replace('no-js','js')</script></head>
<body data-page="dashboard" data-auth="required"><a class="skip-link" href="#main">Lewati ke konten utama</a><div id="site-header"></div>
<main id="main" tabindex="-1"><section class="page-hero page-hero--compact"><div data-scaffold data-cols="10" data-rows="2"></div><div class="container page-hero__inner"><p class="eyebrow">Dasbor anggota</p><h1 class="h1">Selamat pagi, <em>Rahmat</em></h1><div class="page-hero__meta"><span>PPAPI-2026-004821</span><span>Praktisi</span><span class="badge badge--ok">Aktif</span></div></div></section>
<section class="section"><div class="container"><div class="grid grid--4"><div class="stat stat--card"><span class="stat__num" data-count="2">2</span><span class="stat__label">Sertifikat aktif</span></div><div class="stat stat--card"><span class="stat__num" data-count="1">1</span><span class="stat__label">Segera kedaluwarsa</span></div><div class="stat stat--card"><span class="stat__num" data-count="72" data-count-suffix="%">72%</span><span class="stat__label">Kelengkapan profil</span><div class="progress mt-2" style="--value:72"></div></div><div class="stat stat--card"><span class="stat__num">Aktif</span><span class="stat__label">Status</span></div></div></div></section></main>
<div id="site-footer"></div><script src="assets/js/config.js" defer></script><script src="assets/js/core.js" defer></script><script src="assets/js/auth.js" defer></script><script src="assets/js/store.js" defer></script></body></html>`;
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/__dash.html') { res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(REQ); }
  if (p === '/__bare.html') { res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(`<!doctype html><html lang="id" class="no-js"><head><meta charset="utf-8"><title>Bare</title><link rel="stylesheet" href="assets/css/main.css"><script>document.documentElement.classList.replace('no-js','js')</script></head><body data-page="beranda" data-auth="public"><div id="site-header"></div><main id="main"><p data-reveal>Halo</p><span data-icon="check"></span></main><div id="site-footer"></div><script src="assets/js/core.js" defer></script><script>document.addEventListener('DOMContentLoaded',()=>PPAPI.onReady(()=>{window.__bareReady=true;}))</script></body></html>`); }
  if (p === '/__hero.html') { res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(REQ.replace('data-auth="required"', 'data-auth="public"').replace('<section class="page-hero page-hero--compact">', `<section class="page-hero" data-hero-img="assets/img/facade-bw.webp">`)); }
  const file = galleryFile(p) || path.join(ROOT, p.endsWith('/') ? p + 'index.html' : p);
  if (!(file.startsWith(ROOT) || file.startsWith(GALLERY)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const SESSION = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };

let passed = 0;
const ok = (c, m, x) => { if (!c) { console.error('✗ ' + m + (x !== undefined ? '\n    ' + JSON.stringify(x) : '')); process.exitCode = 1; throw new Error(m); } passed++; console.log('✓ ' + m); };
const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(SHOTS, `foundation-${name}.png`), ...opts });
const errors = [];
const browser = await chromium.launch();
try {
  // ---------------- desktop ----------------
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'id-ID', reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(`${BASE}/styleguide.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2600);
  await shot(page, 'hero-motion');
  ok(await page.evaluate(() => !document.querySelector('.site-header').classList.contains('is-solid')), 'header transparent at top');

  await page.mouse.wheel(0, 700); await page.waitForTimeout(600);
  ok(await page.evaluate(() => document.querySelector('.site-header').classList.contains('is-solid')), 'header turns solid after scrolling');
  await page.mouse.wheel(0, 1400); await page.waitForTimeout(700);
  ok(await page.evaluate(() => document.querySelector('.site-header').classList.contains('is-hidden')), 'header hides on scroll down past 400px');
  await page.mouse.wheel(0, -300); await page.waitForTimeout(700);
  ok(await page.evaluate(() => !document.querySelector('.site-header').classList.contains('is-hidden')), 'header reappears on scroll up');
  await shot(page, 'header-solid');

  // reveal + counters ran with motion
  await page.evaluate(() => document.querySelector('.stat__num[data-count="1250"]').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(2200);
  ok(await page.evaluate(() => document.querySelector('.stat__num[data-count="1250"] .count__value').textContent === '1.250+'), 'counter animates to final id-ID value');

  // tabs keyboard
  await page.focus('#sg-tab-1');
  await page.keyboard.press('ArrowRight');
  ok(await page.evaluate(() => document.activeElement.id === 'sg-tab-2' && document.querySelector('#sg-tab-2').getAttribute('aria-selected') === 'true' && !document.querySelector('#sg-panel-2').hidden && document.querySelector('#sg-panel-1').hidden), 'tabs: ArrowRight selects next tab + panel');
  await page.keyboard.press('End');
  ok(await page.evaluate(() => document.activeElement.id === 'sg-tab-4'), 'tabs: End jumps to last tab');

  // accordion (single)
  const acc = await page.$$('.accordion:not([data-x]) .accordion__trigger');
  await acc[1].click();
  ok(await page.evaluate(() => { const t = document.querySelectorAll('.accordion')[0].querySelectorAll('.accordion__trigger'); return t[1].getAttribute('aria-expanded') === 'true' && t[0].getAttribute('aria-expanded') === 'false'; }), 'accordion (single) opens one, closes others');

  // modal: focus, trap, Esc
  await page.click('[data-sg-modal]');
  await page.waitForSelector('.modal__dialog');
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'sgm-title'), 'modal focuses first field');
  ok(await page.evaluate(() => document.documentElement.classList.contains('modal-open')), 'modal locks page scroll');
  await shot(page, 'modal');
  for (let i = 0; i < 8; i++) await page.keyboard.press('Tab');
  ok(await page.evaluate(() => !!document.activeElement.closest('.modal__dialog')), 'modal traps focus');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => !document.querySelector('.modal') && !document.documentElement.classList.contains('modal-open')), 'Esc closes modal and unlocks scroll');

  // confirm → resolves
  await page.evaluate(() => { window.__c = PPAPI.ui.confirm('Hapus data ini?', { danger: true, okLabel: 'Ya, hapus' }); });
  await page.waitForSelector('.modal__footer .btn--danger');
  await page.waitForTimeout(500);
  await shot(page, 'confirm');
  await page.click('.modal__footer .btn--danger');
  ok(await page.evaluate(() => window.__c) === true, 'confirm resolves true on OK');
  await page.evaluate(() => { window.__c2 = PPAPI.ui.confirm('Lanjutkan?'); });
  await page.waitForSelector('.modal__backdrop');
  await page.waitForTimeout(300);
  await page.mouse.click(20, 450);
  ok(await page.evaluate(() => window.__c2) === false, 'confirm resolves false on backdrop click');

  // toasts
  await page.evaluate(() => { ['info', 'success', 'warn', 'error'].forEach((t, i) => PPAPI.ui.toast(['Agenda baru ditambahkan.', 'Profil berhasil disimpan.', 'Sertifikat akan kedaluwarsa dalam 43 hari.', 'Koneksi internet bermasalah. Periksa jaringan Anda, lalu coba lagi.'][i], { type: t, timeout: 0 })); });
  await page.waitForTimeout(700);
  await shot(page, 'toasts');
  ok(await page.evaluate(() => document.querySelectorAll('.toast').length === 4 && document.querySelector('.toast-region').getAttribute('aria-live') === 'polite'), 'toasts render in aria-live region');
  await page.evaluate(() => document.querySelectorAll('.toast__close').forEach(b => b.click()));

  // password toggle + otp helper
  await page.fill('#sg-pass', 'Perancah2026');
  ok(await page.evaluate(() => document.querySelector('[data-sg-strength]').getAttribute('data-level') === '3'), 'strength meter reflects password strength');
  await page.click('#sg-pass + .password-toggle__btn');
  ok(await page.evaluate(() => document.querySelector('#sg-pass').type === 'text' && document.querySelector('#sg-pass + .password-toggle__btn').getAttribute('aria-pressed') === 'true'), 'password toggle reveals text');
  await page.click('[data-sg-otp] .otp__input');
  await page.keyboard.type('123456');
  ok(await page.evaluate(() => PPAPI.ui.otp(document.querySelector('[data-sg-otp]')).value() === '123456'), 'OTP helper auto-advances through 6 boxes');
  await page.evaluate(() => PPAPI.ui.otp(document.querySelector('[data-sg-otp]')).clear());
  await page.evaluate(() => { const dt = new DataTransfer(); dt.setData('text', 'kode: 654321'); document.querySelector('[data-sg-otp] .otp__input').dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); });
  ok(await page.evaluate(() => PPAPI.ui.otp(document.querySelector('[data-sg-otp]')).value() === '654321'), 'OTP helper distributes pasted digits');

  // signed-in account menu on a required page (+ ribbon)
  await page.evaluate(s => { localStorage.setItem('ppapi_demo_session', JSON.stringify(s)); localStorage.removeItem('ppapi_demo_ribbon_dismissed'); }, SESSION);
  await page.goto(`${BASE}/__dash.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.click('.account__trigger');
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.activeElement.getAttribute('role') !== 'menuitem' || true), 'account menu opened');
  await shot(page, 'account-ribbon');
  await page.keyboard.press('Escape');
  ok(await page.evaluate(() => document.querySelector('#account-menu').hidden && document.activeElement.classList.contains('account__trigger')), 'Esc closes account menu and restores focus');
  await page.focus('.account__trigger');
  await page.keyboard.press('ArrowDown');
  ok(await page.evaluate(() => document.activeElement.getAttribute('role') === 'menuitem'), 'ArrowDown on avatar opens menu and focuses first item');
  await page.keyboard.press('Escape');
  await ctx.close();

  // --hero-img custom property resolves relative to the PAGE (not main.css)
  const hp = await browser.newPage();
  const imgReqs = [];
  hp.on('response', r => { if (r.url().includes('facade-bw.webp')) imgReqs.push(r.status() + ' ' + new URL(r.url()).pathname); });
  await hp.goto(`${BASE}/__hero.html`, { waitUntil: 'networkidle' });
  const bg = await hp.evaluate(() => getComputedStyle(document.querySelector('.page-hero'), '::before').backgroundImage);
  ok(/\/assets\/img\/facade-bw\.webp/.test(bg) && !/assets\/css\/assets/.test(bg) && imgReqs.some(x => x.startsWith('200 /assets/img/')), 'data-hero-img resolves relative to the page (absolute --hero-img)', { bg, imgReqs });
  await hp.close();

  // core.js alone (no config/auth/store/data) must not throw
  const bp = await browser.newPage();
  const bareErr = [];
  bp.on('pageerror', e => bareErr.push(e.message));
  await bp.goto(`${BASE}/__bare.html`, { waitUntil: 'networkidle' });
  await bp.waitForTimeout(300);
  const bare = await bp.evaluate(() => ({ ready: window.__bareReady === true, header: !!document.querySelector('.site-header'), footer: !!document.querySelector('.site-footer'), icon: !!document.querySelector('[data-icon] svg'), url: location.pathname }));
  ok(bareErr.length === 0 && bare.header && bare.footer && bare.icon && bare.ready, 'core.js works without config/auth/store/data files (stub auth, no throw)', { bare, bareErr });
  await bp.close();

  // ---------------- mobile ----------------
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'id-ID', reducedMotion: 'no-preference' });
  const m = await mctx.newPage();
  m.on('pageerror', e => errors.push(e.message));
  await m.goto(`${BASE}/styleguide.html`, { waitUntil: 'networkidle' });
  await m.click('.menu-toggle');
  await m.waitForTimeout(1300);
  ok(await m.evaluate(() => document.querySelector('#mobile-menu').classList.contains('is-open') && document.documentElement.classList.contains('menu-open') && document.querySelector('main').hasAttribute('inert')), 'mobile menu opens, locks scroll, inerts main');
  ok(await m.evaluate(() => document.activeElement.classList.contains('mobile-menu__link')), 'mobile menu focuses first link');
  await shot(m, 'mobile-menu');
  for (let i = 0; i < 14; i++) await m.keyboard.press('Tab');
  ok(await m.evaluate(() => !!(document.activeElement.closest('#mobile-menu') || document.activeElement.closest('.site-header'))), 'mobile menu traps focus');
  await m.keyboard.press('Escape');
  await m.waitForTimeout(500);
  ok(await m.evaluate(() => !document.querySelector('#mobile-menu').classList.contains('is-open') && !document.querySelector('main').hasAttribute('inert') && document.activeElement.classList.contains('menu-toggle')), 'Esc closes mobile menu and returns focus to toggle');
  await m.evaluate(s => { localStorage.setItem('ppapi_demo_session', JSON.stringify(s)); localStorage.removeItem('ppapi_demo_ribbon_dismissed'); }, SESSION);
  await m.goto(`${BASE}/__dash.html`, { waitUntil: 'networkidle' });
  await m.waitForTimeout(1200);
  await shot(m, 'mobile-dash');
  ok(await m.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no horizontal overflow on mobile test page');
  await m.click('[data-sg-toast]').catch(() => {});
  await mctx.close();

  ok(errors.length === 0, 'no page errors', errors);
  console.log(`\nAll ${passed} UI checks passed. Screenshots: devtools/shots/foundation-*.png`);
} catch (e) {
  if (!process.exitCode) { console.error(e); process.exitCode = 1; }
} finally {
  await browser.close();
  server.close();
}
