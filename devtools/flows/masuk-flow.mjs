// PPAPI — interaction flow for masuk.html (Masuk & Daftar), Demo mode.
// Run from devtools/:   node flows/masuk-flow.mjs [--headed] [--no-shots]
// Covers: tabs + #daftar hash, method switch, inline validation (blur + submit, aria),
// strength meter, email sign-up → pendaftaran.html, sign-out, wrong password (Indonesian error),
// sign-in, duplicate e-mail action, "Lupa kata sandi?" modal, phone OTP (auto-advance,
// backspace, wrong code, paste 123456, resend countdown, "Ubah nomor"), phone sign-up,
// Google (demo simulation, cancel + success), "Ingat saya" off, ?next= honoured,
// open-redirect attempts ignored, header links switch tabs in place, mobile layout.
// v2: NEW accounts (email / phone / Google sign-up, and unfinished new accounts) continue to
// pendaftaran.html (PPAPI.auth.postSignUpTarget) unless an explicit, reachable ?next= is given — a
// member-only target (anggota/admin/aplikasi) still goes to the form; existing accounts keep the
// dashboard / ?next= behaviour. Demo admin card (PPAPI.auth.demoAdmin): copy + "isi formulir".
// The ?next= note adapts to the tab; the Daftar tab shows the 3 registration stages.
// State screenshots → devtools/shots/masuk-flow-*.png
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { galleryFile, GALLERY } from './dev-gallery.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const args = process.argv.slice(2);
const HEADED = args.includes('--headed');
const SAVE_SHOTS = !args.includes('--no-shots');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = galleryFile(p) || path.join(ROOT, p);
  if (!(file.startsWith(ROOT) || file.startsWith(GALLERY)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': MIME['.html'] });
    return res.end('<!doctype html><title>404</title><p>Not found (flow stub)</p>');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let passed = 0, failed = 0;
function check(cond, msg, extra) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.log('  ✗ ' + msg + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function section(t) { console.log('\n' + t); }

const browser = await chromium.launch({ headless: !HEADED });
const pageErrors = [];
const evilRequests = [];

async function newPage(vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch,
    deviceScaleFactor: vp.dpr || 1, reducedMotion: 'reduce', locale: 'id-ID',
  });
  const page = await ctx.newPage();
  page.on('console', m => {
    if (!['error', 'warning'].includes(m.type())) return;
    const u = page.url();
    if (/masuk\.html/.test(u) || /styleguide\.html/.test(u)) pageErrors.push(`[${vp.name}] console.${m.type()} @ ${u}: ${m.text()}`);
  });
  page.on('pageerror', e => { if (/masuk\.html/.test(page.url())) pageErrors.push(`[${vp.name}] pageerror @ ${page.url()}: ${e.message}`); });
  page.on('request', r => { if (/evil\.example/i.test(new URL(r.url()).host)) evilRequests.push(r.url()); });
  page.on('response', r => {
    const u = r.url();
    if (r.status() >= 400 && !/\/(dashboard|anggota|kebijakan-privasi|pendaftaran|admin|berita)\.html/.test(u) && !u.endsWith('/favicon.ico')) pageErrors.push(`[${vp.name}] HTTP ${r.status()} ${u}`);
  });
  return { ctx, page };
}
async function ready(page) {
  await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady() && document.querySelector('[data-auth-root]'), null, { timeout: 15000 });
  await page.waitForTimeout(80);
}
async function gotoMasuk(page, suffix = '') {
  // always a fresh document (masuk.html → masuk.html#daftar would otherwise be a same-document hash change)
  if (/\/masuk\.html/.test(page.url())) await page.goto('about:blank');
  await page.goto(`${BASE}/masuk.html${suffix}`, { waitUntil: 'domcontentloaded' });
  await ready(page);
}
async function signOut(page) {
  await page.goto(`${BASE}/styleguide.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady(), null, { timeout: 15000 });
  await page.evaluate(() => PPAPI.auth.signOut());
  return page.evaluate(() => PPAPI.auth.current());
}
async function shot(page, name) {
  if (!SAVE_SHOTS) return;
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOTS, `masuk-flow-${name}.png`) });
}
const session = page => page.evaluate(() => {
  const raw = localStorage.getItem('ppapi_demo_session') || sessionStorage.getItem('ppapi_demo_session');
  return raw ? JSON.parse(raw) : null;
});
/** The welcome flash: read from the toast when the destination page booted PPAPI, else from sessionStorage
    (pendaftaran.html may not exist yet while pages are built in parallel → the stub 404 page keeps it). */
async function welcome(page) {
  const hasPPAPI = await page.evaluate(() => !!(window.PPAPI && PPAPI.isReady)).catch(() => false);
  if (hasPPAPI) {
    await page.waitForSelector('.toast:has-text("Selamat datang")', { timeout: 5000 }).catch(() => {});
    return page.locator('.toast-region').first().evaluate(el => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
  }
  return page.evaluate(() => sessionStorage.getItem('ppapi_flash') || '').catch(() => '');
}
const text = (page, sel) => page.locator(sel).first().evaluate(el => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
const activeId = page => page.evaluate(() => document.activeElement && document.activeElement.id);
const pathAfter = page => page.url().replace(BASE, '');
async function fieldState(page, id) {
  return page.evaluate(id => {
    const el = document.getElementById(id), f = el.closest('.field');
    return { invalid: f.classList.contains('is-invalid'), aria: el.getAttribute('aria-invalid'), desc: el.getAttribute('aria-describedby') || '', err: (f.querySelector('.field__error') || {}).textContent || '' };
  }, id);
}

const DESKTOP = { name: 'desktop', width: 1440, height: 900 };
const MOBILE = { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, dpr: 2 };
const USER = { name: 'Siti Rahmawati', email: 'siti.uji@contoh.id', pass: 'Perancah2026' };

try {
  const { ctx, page } = await newPage(DESKTOP);

  /* ---------------------------------------------------------------- */
  section('A. Keadaan awal');
  await gotoMasuk(page);
  check(await page.getAttribute('#tab-masuk', 'aria-selected') === 'true', 'tab Masuk aktif secara bawaan');
  check(await page.isHidden('#panel-daftar'), 'panel Daftar tersembunyi');
  check(await page.isVisible('#masuk-email-pane') && await page.isHidden('#masuk-phone-pane'), 'metode Email aktif, Nomor HP tersembunyi');
  check(await page.isVisible('[data-demo-note]'), 'catatan Mode Demo tampil');
  const demoAdmin = await page.evaluate(() => PPAPI.auth.demoAdmin);
  check(demoAdmin && demoAdmin.email === 'admin@ppapi.demo' && demoAdmin.password === 'AdminPPAPI2026', 'PPAPI.auth.demoAdmin tersedia (Mode Demo)', demoAdmin);
  check(await page.isVisible('[data-demo-admin]') && await text(page, '[data-demo-admin-email]') === 'admin@ppapi.demo' && await text(page, '[data-demo-admin-pass]') === 'AdminPPAPI2026', 'kartu akun admin demo menampilkan email + kata sandi');
  check(await page.locator('[data-demo-admin] [data-demo-copy][aria-label]').count() === 2, '2 tombol salin berlabel aksesibel');
  check(await page.getAttribute('[data-demo-note]', 'role') === 'note' && !!(await page.getAttribute('[data-demo-admin]', 'aria-labelledby')), 'catatan demo: role=note, grup admin berlabel');
  check(await page.isVisible('.auth-benefits__caption') && /anggota berstatus Aktif/i.test(await text(page, '.auth-benefits__caption')), 'panel visual: fitur terbuka bagi anggota Aktif');
  check(await page.locator('#panel-daftar .auth-steps__item').count() === 3 && await page.locator('#panel-daftar .auth-steps__item[aria-current="step"]').count() === 1, 'tab Daftar: 3 tahap pendaftaran, tahap "Buat akun" aktif');
  check(await page.locator('#panel-masuk .btn-google svg').count() === 1, 'tombol Google memuat ikon G');
  check((await page.locator('#panel-masuk .btn-google svg path').evaluateAll(ps => new Set(ps.map(p => p.getAttribute('fill'))).size)) >= 4, 'ikon Google berwarna resmi (4 warna)');
  check(await page.title() === 'Masuk — PPAPI', 'judul dokumen menyesuaikan tab', await page.title());
  check(await page.locator('h1').count() === 1, 'tepat satu h1');
  await shot(page, 'masuk-desktop');

  /* ---------------------------------------------------------------- */
  section('B. Validasi inline — Masuk (submit + blur)');
  await page.click('[data-form="masuk-email"] button[type="submit"]');
  let st = await fieldState(page, 'm-email');
  check(st.invalid && st.aria === 'true' && st.desc.includes('m-email-err') && /wajib diisi/.test(st.err), 'email kosong → galat + aria-invalid + aria-describedby', st);
  st = await fieldState(page, 'm-pass');
  check(st.invalid && /Kata sandi wajib diisi/.test(st.err), 'kata sandi kosong → galat', st);
  check(await activeId(page) === 'm-email', 'fokus ke isian tidak valid pertama');
  await shot(page, 'validation-desktop');
  await page.fill('#m-email', 'bukan-email');
  await page.keyboard.press('Tab');
  st = await fieldState(page, 'm-email');
  check(/Format alamat email tidak valid/.test(st.err), 'blur → format email tidak valid', st);
  await page.fill('#m-email', 'siti.uji@contoh.id');
  st = await fieldState(page, 'm-email');
  check(!st.invalid && st.aria === null && !st.desc.includes('m-email-err'), 'galat hilang saat diperbaiki (live)', st);
  check(await page.locator('#panel-masuk [data-alert] .alert').count() === 0, 'tidak ada alert sebelum memanggil PPAPI.auth');

  /* ---------------------------------------------------------------- */
  section('C. Tab & hash #daftar');
  await gotoMasuk(page, '#daftar');
  check(await page.getAttribute('#tab-daftar', 'aria-selected') === 'true' && await page.isVisible('#panel-daftar'), '#daftar membuka tab Daftar');
  check(await page.title() === 'Daftar Anggota — PPAPI', 'judul dokumen tab Daftar');
  await page.click('#tab-masuk');
  check(new URL(page.url()).hash === '#masuk', 'beralih ke Masuk memperbarui hash → #masuk');
  await page.click('#tab-daftar');
  check(new URL(page.url()).hash === '#daftar', 'beralih ke Daftar memperbarui hash → #daftar');
  await page.focus('#tab-daftar');
  await page.keyboard.press('ArrowLeft');
  check(await page.getAttribute('#tab-masuk', 'aria-selected') === 'true' && await activeId(page) === 'tab-masuk', 'navigasi panah antartab');
  await page.click('#panel-masuk [data-switch="daftar"]');
  check(await page.getAttribute('#tab-daftar', 'aria-selected') === 'true', 'tautan "Daftar sekarang" membuka tab Daftar');

  /* ---------------------------------------------------------------- */
  section('D. Validasi Daftar + meter kekuatan');
  await page.click('[data-form="daftar-email"] button[type="submit"]');
  for (const id of ['d-name', 'd-email', 'd-pass', 'd-pass2', 'd-agree']) {
    st = await fieldState(page, id);
    check(st.invalid && st.err.length > 5, `galat pada ${id}`, st);
  }
  check(await activeId(page) === 'd-name', 'fokus ke Nama lengkap');
  await shot(page, 'daftar-validation-desktop');
  await page.fill('#d-pass', 'abc');
  check(await text(page, '#d-pass-strength-label') === 'Lemah' && await page.getAttribute('[data-strength]', 'data-level') === '1', 'meter: "abc" → Lemah');
  await page.fill('#d-pass', 'perancah1');
  check(await text(page, '#d-pass-strength-label') === 'Sedang', 'meter: "perancah1" → Sedang');
  await page.fill('#d-pass', USER.pass);
  check(await text(page, '#d-pass-strength-label') === 'Kuat', 'meter: "Perancah2026" → Kuat');
  st = await fieldState(page, 'd-pass');
  check(!st.invalid, 'galat kata sandi hilang setelah memenuhi syarat', st);
  await page.fill('#d-pass2', 'Perancah2025');
  await page.keyboard.press('Tab');
  st = await fieldState(page, 'd-pass2');
  check(/belum sama/.test(st.err), 'konfirmasi tidak sama → galat', st);
  await page.fill('#d-name', 'Si');
  await page.keyboard.press('Tab');
  check(/minimal 3 karakter/.test((await fieldState(page, 'd-name')).err), 'nama < 3 karakter → galat');

  /* ---------------------------------------------------------------- */
  section('E. Daftar dengan email → formulir pendaftaran (pendaftaran.html)');
  await page.fill('#d-name', USER.name);
  await page.fill('#d-email', USER.email);
  await page.fill('#d-pass', USER.pass);
  await page.fill('#d-pass2', USER.pass);
  await page.setChecked('#d-agree', true, { force: true });
  check(!(await fieldState(page, 'd-agree')).invalid, 'centang Kebijakan Privasi menghapus galat');
  await shot(page, 'daftar-filled-desktop');
  await page.click('[data-form="daftar-email"] button[type="submit"]');
  await page.waitForURL(/\/pendaftaran\.html$/, { timeout: 8000 });
  check(true, 'akun baru tanpa ?next= → pendaftaran.html (PPAPI.auth.postSignUpTarget)');
  // the greeting is carried over with UI.flash and shown on the destination page (not lost with masuk.html)
  let greet = await welcome(page);
  check(/Selamat datang, Siti Rahmawati\./.test(greet) && /formulir pendaftaran anggota/.test(greet), 'ucapan "Selamat datang, {nama}" + ajakan mengisi formulir dibawa ke halaman formulir', greet);
  let s = await session(page);
  check(s && s.email === USER.email && s.name === USER.name && s.provider === 'password', 'sesi demo tersimpan', s);

  /* ---------------------------------------------------------------- */
  section('F. Keluar (PPAPI.auth.signOut via evaluate)');
  check(await signOut(page) === null, 'signOut → current() null');
  await gotoMasuk(page);
  check(pathAfter(page).startsWith('/masuk.html'), 'masuk.html dapat dibuka kembali sebagai tamu');

  /* ---------------------------------------------------------------- */
  section('G. Kata sandi salah → galat berbahasa Indonesia');
  await page.fill('#m-email', USER.email);
  await page.fill('#m-pass', 'SalahSandi99');
  await page.click('[data-form="masuk-email"] button[type="submit"]');
  await page.waitForSelector('#panel-masuk [data-alert] .alert--err', { timeout: 5000 });
  const alertTxt = await text(page, '#panel-masuk [data-alert] .alert--err');
  check(/Email atau kata sandi tidak sesuai/.test(alertTxt), 'alert--err berisi pesan Indonesia', alertTxt);
  check(await page.getAttribute('#panel-masuk [data-alert]', 'aria-live') === 'assertive', 'wilayah alert memakai aria-live');
  check(await activeId(page) === 'm-pass', 'fokus kembali ke kata sandi');
  check(pathAfter(page).startsWith('/masuk.html'), 'tetap di halaman masuk');
  check((await page.textContent('[data-form="masuk-email"] button[type="submit"]')).includes('Masuk'), 'tombol kembali normal setelah gagal');
  await shot(page, 'error-desktop');

  section('G2. Masuk dengan kata sandi benar');
  await page.fill('#m-pass', USER.pass);
  await page.click('[data-form="masuk-email"] button[type="submit"]');
  check(await page.locator('#panel-masuk [data-alert] .alert').count() === 0, 'alert dibersihkan saat mencoba lagi');
  await page.waitForURL(/\/dashboard\.html$/, { timeout: 8000 });
  check(true, 'masuk berhasil → dashboard.html');
  s = await session(page);
  check(s && s.email === USER.email, 'sesi sesuai akun', s);

  /* ---------------------------------------------------------------- */
  section('H. Email sudah terdaftar → aksi "Masuk dengan email ini"');
  await signOut(page);
  await gotoMasuk(page, '#daftar');
  await page.fill('#d-name', 'Pengguna Lain');
  await page.fill('#d-email', USER.email);
  await page.fill('#d-pass', 'Kokoh12345');
  await page.fill('#d-pass2', 'Kokoh12345');
  await page.setChecked('#d-agree', true, { force: true });
  await page.click('[data-form="daftar-email"] button[type="submit"]');
  await page.waitForSelector('#panel-daftar [data-alert] .alert--err', { timeout: 5000 });
  check(/sudah terdaftar/.test(await text(page, '#panel-daftar [data-alert]')), 'pesan email sudah terdaftar');
  await page.click('#panel-daftar [data-alert-action]');
  check(await page.getAttribute('#tab-masuk', 'aria-selected') === 'true' && await page.inputValue('#m-email') === USER.email && await activeId(page) === 'm-pass', 'aksi membuka tab Masuk, email terisi, fokus ke kata sandi');

  /* ---------------------------------------------------------------- */
  section('I. Lupa kata sandi (modal → resetPassword)');
  await page.click('[data-forgot]');
  await page.waitForSelector('.modal .modal__title');
  check((await text(page, '.modal .modal__title')) === 'Atur ulang kata sandi', 'modal terbuka');
  check(await page.inputValue('#fp-email') === USER.email, 'email terisi otomatis');
  await page.fill('#fp-email', 'salah');
  await page.click('.modal__footer .btn--primary');
  check(/Format alamat email tidak valid/.test((await fieldState(page, 'fp-email')).err), 'validasi email di modal');
  await page.fill('#fp-email', USER.email);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.modal .auth-sent', { timeout: 5000 });
  check(/Periksa kotak masuk Anda/.test(await text(page, '.modal .auth-sent')), 'pesan berhasil tampil');
  check(await page.isHidden('.modal__footer [hidden]') || (await page.locator('.modal__footer .btn:visible').count()) === 1, 'hanya tombol Tutup yang tersisa');
  await shot(page, 'forgot-desktop');
  await page.click('.modal__footer .btn:visible');
  await page.waitForSelector('.modal', { state: 'detached', timeout: 3000 });
  check(true, 'modal tertutup');
  await page.click('[data-forgot]');
  await page.waitForSelector('.modal');
  await page.keyboard.press('Escape');
  await page.waitForSelector('.modal', { state: 'detached', timeout: 3000 });
  check(await page.evaluate(() => document.activeElement.hasAttribute('data-forgot')), 'Esc menutup modal dan fokus kembali ke "Lupa kata sandi?"');

  /* ---------------------------------------------------------------- */
  section('J. "Ingat saya" tidak dicentang → sesi hanya untuk tab ini');
  await page.fill('#m-pass', USER.pass);
  await page.setChecked('#m-remember', false, { force: true });
  check(!(await page.isChecked('#m-remember')), '"Ingat saya" dapat dimatikan');
  await page.click('[data-form="masuk-email"] button[type="submit"]');
  await page.waitForURL(/\/dashboard\.html$/, { timeout: 8000 });
  const where = await page.evaluate(() => ({ local: !!localStorage.getItem('ppapi_demo_session'), sess: !!sessionStorage.getItem('ppapi_demo_session') }));
  check(!where.local && where.sess, 'sesi disimpan di sessionStorage', where);

  /* ---------------------------------------------------------------- */
  section('K. Nomor HP + OTP (Masuk)');
  await signOut(page);
  await gotoMasuk(page);
  await page.click('#panel-masuk [data-method-switch] [data-value="phone"]');
  check(await page.isVisible('#masuk-phone-pane') && await page.isHidden('#masuk-email-pane'), 'metode Nomor HP tampil');
  check(await page.getAttribute('#panel-daftar [data-method-switch] [data-value="phone"]', 'aria-pressed') === 'true', 'pilihan metode sinkron di tab Daftar');
  await page.click('#masuk-phone-pane [data-send-otp]');
  check(/Nomor HP wajib diisi/.test((await fieldState(page, 'mp-phone')).err), 'nomor kosong → galat');
  await page.fill('#mp-phone', '12-34');
  await page.keyboard.press('Tab');
  check(/Nomor HP tidak valid/.test((await fieldState(page, 'mp-phone')).err), 'nomor tidak valid → galat');
  await page.fill('#mp-phone', '0812 3456 7890');
  await page.keyboard.press('Tab');
  check(await page.inputValue('#mp-phone') === '812-3456-7890', 'nomor dirapikan setelah blur', await page.inputValue('#mp-phone'));
  check(!(await fieldState(page, 'mp-phone')).invalid, 'format 08… diterima');
  await page.click('#masuk-phone-pane [data-send-otp]');
  await page.waitForSelector('#masuk-phone-pane [data-phone-step="2"]:not([hidden])', { timeout: 5000 });
  check(await text(page, '#masuk-phone-pane [data-otp-target]') === '+62 812-••••-7890', 'nomor tujuan ditampilkan tersamar', await text(page, '#masuk-phone-pane [data-otp-target]'));
  check(await page.locator('#masuk-phone-pane .otp__input').count() === 6, '6 kotak OTP');
  const otpAttrs = await page.evaluate(() => { const i = document.querySelector('#masuk-phone-pane .otp__input'); return { im: i.getAttribute('inputmode'), ac: i.getAttribute('autocomplete') }; });
  check(otpAttrs.im === 'numeric' && otpAttrs.ac === 'one-time-code', 'inputmode numeric + autocomplete one-time-code', otpAttrs);
  const rs = await page.evaluate(() => { const b = document.querySelector('#masuk-phone-pane [data-resend]'); return { dis: b.disabled, t: b.textContent }; });
  check(rs.dis && /Kirim ulang dalam (1:00|0:5\d)/.test(rs.t), 'kirim ulang dikunci dengan hitung mundur 60 detik', rs);
  check(await page.evaluate(() => document.activeElement.classList.contains('otp__input')), 'fokus ke kotak OTP pertama');
  check(/123456/.test(await text(page, '.toast-region')), 'toast Mode Demo menyebut kode 123456');
  await shot(page, 'otp-desktop');

  // incomplete code
  await page.keyboard.type('12');
  await page.click('#masuk-phone-pane [data-verify]');
  check(/Masukkan 6 digit/.test(await text(page, '#mp-otp-err')), 'kode belum lengkap → galat');
  // auto-advance + backspace
  await page.evaluate(() => { const i = document.querySelectorAll('#masuk-phone-pane .otp__input'); i.forEach(x => { x.value = ''; }); i[0].focus(); });
  await page.keyboard.type('4');
  check(await page.evaluate(() => document.activeElement === document.querySelectorAll('#masuk-phone-pane .otp__input')[1]), 'auto-advance ke kotak berikutnya');
  await page.keyboard.press('Backspace');
  const bs = await page.evaluate(() => { const i = document.querySelectorAll('#masuk-phone-pane .otp__input'); return { back: document.activeElement === i[0], v: i[0].value }; });
  check(bs.back && bs.v === '', 'backspace pada kotak kosong kembali & menghapus kotak sebelumnya', bs);
  // wrong code (auto-submits when complete)
  await page.keyboard.type('111111');
  await page.waitForSelector('#panel-masuk [data-alert] .alert--err', { timeout: 5000 });
  check(/Kode OTP tidak sesuai/.test(await text(page, '#panel-masuk [data-alert]')), 'kode salah → galat Indonesia');
  check(await page.evaluate(() => document.querySelector('#masuk-phone-pane .otp').classList.contains('is-invalid')), 'kotak OTP ditandai tidak valid');
  await shot(page, 'otp-error-desktop');
  // change number and back
  await page.click('#masuk-phone-pane [data-change-number]');
  check(await page.isVisible('#masuk-phone-pane [data-phone-step="1"]') && await activeId(page) === 'mp-phone', '"Ubah nomor" kembali ke langkah 1');
  await page.click('#masuk-phone-pane [data-send-otp]');
  await page.waitForSelector('#masuk-phone-pane [data-phone-step="2"]:not([hidden])', { timeout: 5000 });
  // resend after countdown (fast-forward the clock by 61 s)
  await page.evaluate(() => { const real = Date.now; Date.now = () => real() + 61000; });
  await page.waitForFunction(() => !document.querySelector('#masuk-phone-pane [data-resend]').disabled, null, { timeout: 3000 });
  check(/Kirim ulang kode/.test(await text(page, '#masuk-phone-pane [data-resend]')), 'setelah 60 detik tombol "Kirim ulang kode" aktif');
  await page.click('#masuk-phone-pane [data-resend]');
  await page.waitForFunction(() => { const b = document.querySelector('#masuk-phone-pane [data-resend]'); return b.disabled && /Kirim ulang dalam/.test(b.textContent); }, null, { timeout: 5000 });
  check(true, 'kirim ulang → hitung mundur dimulai lagi');
  // paste the right code
  await page.evaluate(() => {
    const inp = document.querySelector('#masuk-phone-pane .otp__input');
    inp.focus();
    const dt = new DataTransfer(); dt.setData('text', '123456');
    inp.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  });
  // an unknown number on the Masuk tab creates an account → "Lengkapi profil" (name + consent) before any redirect
  await page.waitForSelector('[data-complete]:not([hidden])', { timeout: 8000 });
  check(pathAfter(page).startsWith('/masuk.html') && await page.isHidden('[data-auth-tabs]'), 'tempel 123456 → nomor baru → langkah "Lengkapi profil" (belum dialihkan)', pathAfter(page));
  check(await activeId(page) === 'complete-title', 'fokus pindah ke judul langkah', await activeId(page));
  const cText = await text(page, '[data-complete-text]');
  check(/belum terdaftar/.test(cText) && /Kebijakan Privasi/.test(cText), 'penjelasan: akun baru dibuat, nama & persetujuan diperlukan', cText);
  check(await text(page, '[data-complete-id]') === '+62 812-3456-7890', 'nomor terverifikasi ditampilkan', await text(page, '[data-complete-id]'));
  check(await page.isVisible('[data-complete-agree]') && await page.inputValue('#c-name') === '', 'kolom nama kosong + kotak Kebijakan Privasi tampil');
  check(await page.title() === 'Lengkapi Profil — PPAPI', 'judul dokumen diperbarui', await page.title());
  s = await session(page);
  check(s && s.phone === '+6281234567890' && !s.name, 'sesi akun baru (belum bernama) aktif', s);
  await shot(page, 'complete-desktop');
  await page.click('[data-form="complete"] button[type="submit"]');
  check((await fieldState(page, 'c-name')).invalid && (await fieldState(page, 'c-agree')).invalid && await activeId(page) === 'c-name', 'nama & persetujuan wajib → galat, fokus ke nama');
  check(/minimal 3|wajib/.test((await fieldState(page, 'c-name')).err) && (await fieldState(page, 'c-name')).desc.includes('c-name-err'), 'galat nama terhubung lewat aria-describedby');
  await shot(page, 'complete-validation-desktop');
  // "Keluar" → signed out, tabs back, phone flow reset, info note
  await page.click('[data-complete-cancel]');
  await page.waitForSelector('[data-complete]', { state: 'hidden', timeout: 5000 });
  check(await page.isVisible('[data-auth-tabs]') && await session(page) === null, '"Keluar" → sesi dihapus, tab kembali');
  check(/telah keluar/i.test(await text(page, '#panel-masuk [data-alert]')) && await page.isVisible('#masuk-phone-pane [data-phone-step="1"]'), 'catatan info + alur HP kembali ke langkah 1', await text(page, '#panel-masuk [data-alert]'));
  check(await page.title() === 'Masuk — PPAPI', 'judul dokumen kembali', await page.title());
  // the same (still nameless) account signs in again → asked again, then — still a new account — lands on the form
  await page.click('#masuk-phone-pane [data-send-otp]');
  await page.waitForSelector('#masuk-phone-pane [data-phone-step="2"]:not([hidden])', { timeout: 5000 });
  await page.keyboard.type('123456');
  await page.waitForSelector('[data-complete]:not([hidden])', { timeout: 8000 });
  check(/belum lengkap/.test(await text(page, '[data-complete-text]')) && await page.isVisible('[data-complete-agree]'), 'akun tanpa nama → diminta melengkapi lagi', await text(page, '[data-complete-text]'));
  await page.fill('#c-name', '  Andi   Pratama ');
  await page.setChecked('#c-agree', true, { force: true });
  await page.click('[data-form="complete"] button[type="submit"]');
  await page.waitForURL(/\/pendaftaran\.html$/, { timeout: 8000 });
  s = await session(page);
  check(s && s.phone === '+6281234567890' && s.provider === 'phone' && s.name === 'Andi Pratama', 'Simpan & Lanjutkan → nama tersimpan → formulir pendaftaran (akun baru)', s);
  greet = await welcome(page);
  check(/Selamat datang, Andi Pratama/.test(greet), 'ucapan selamat datang dibawa ke halaman formulir', greet);
  check(await page.evaluate(() => !localStorage.getItem('ppapi_profile_pending')), 'penanda "belum lengkap" dihapus');
  // a registered (named) number on the Masuk tab goes straight through
  await signOut(page);
  await gotoMasuk(page);
  await page.click('#panel-masuk [data-method-switch] [data-value="phone"]');
  await page.fill('#mp-phone', '0812-3456-7890');
  await page.click('#masuk-phone-pane [data-send-otp]');
  await page.waitForSelector('#masuk-phone-pane [data-phone-step="2"]:not([hidden])', { timeout: 5000 });
  await page.keyboard.type('123456');
  await page.waitForURL(/\/dashboard\.html$/, { timeout: 8000 });
  s = await session(page);
  check(s && s.name === 'Andi Pratama', 'nomor terdaftar → langsung ke dasbor tanpa langkah tambahan', s);

  /* ---------------------------------------------------------------- */
  section('L. Daftar dengan Nomor HP (nama lengkap wajib)');
  await signOut(page);
  await gotoMasuk(page, '#daftar');
  await page.click('#panel-daftar [data-method-switch] [data-value="phone"]');
  await page.fill('#dp-phone', '081398765432');
  await page.click('#daftar-phone-pane [data-send-otp]');
  check((await fieldState(page, 'dp-name')).invalid && (await fieldState(page, 'dp-agree')).invalid && await activeId(page) === 'dp-name', 'nama & persetujuan wajib sebelum OTP dikirim');
  await page.fill('#dp-name', 'Budi Santoso');
  await page.setChecked('#dp-agree', true, { force: true });
  await page.click('#daftar-phone-pane [data-send-otp]');
  await page.waitForSelector('#daftar-phone-pane [data-phone-step="2"]:not([hidden])', { timeout: 5000 });
  await page.keyboard.type('123456');
  await page.waitForURL(/\/pendaftaran\.html$/, { timeout: 8000 });
  s = await session(page);
  check(s && s.name === 'Budi Santoso' && s.phone === '+6281398765432', 'akun HP baru dengan nama lengkap → formulir pendaftaran', s);

  /* ---------------------------------------------------------------- */
  section('M. Google (simulasi Mode Demo)');
  await signOut(page);
  await gotoMasuk(page);
  await page.click('#panel-masuk [data-google]');
  await page.waitForSelector('.modal .modal__title');
  check(/Simulasi Masuk dengan Google/.test(await text(page, '.modal .modal__title')), 'modal simulasi Google terbuka');
  await page.click('.modal__footer .btn--ghost');
  await page.waitForSelector('.modal', { state: 'detached' });
  await page.waitForTimeout(150);
  check(await page.locator('#panel-masuk [data-alert] .alert').count() === 0, 'membatalkan tidak memunculkan galat');
  check(/Lanjutkan dengan Google/.test(await text(page, '#panel-masuk [data-google]')) && !(await page.isDisabled('#panel-masuk [data-google]')), 'tombol Google kembali normal');
  await page.click('#panel-masuk [data-google]');
  await page.waitForSelector('#dg-name');
  await page.fill('#dg-name', 'Rina Kusuma');
  await page.fill('#dg-email', 'rina.uji@gmail.com');
  await page.click('.modal__footer .btn--primary');
  // a new Google account from the Masuk tab never saw the consent line → completion step (name prefilled)
  await page.waitForSelector('[data-complete]:not([hidden])', { timeout: 8000 });
  check(/Akun Google ini belum terdaftar/.test(await text(page, '[data-complete-text]')) && await text(page, '[data-complete-id]') === 'rina.uji@gmail.com', 'Google baru dari tab Masuk → langkah "Lengkapi profil"', await text(page, '[data-complete-text]'));
  check(await page.inputValue('#c-name') === 'Rina Kusuma' && await page.isVisible('[data-complete-agree]'), 'nama dari Google terisi; persetujuan diminta');
  await page.click('[data-form="complete"] button[type="submit"]');
  check(!(await fieldState(page, 'c-name')).invalid && (await fieldState(page, 'c-agree')).invalid && await activeId(page) === 'c-agree', 'tanpa centang → galat persetujuan saja');
  await page.setChecked('#c-agree', true, { force: true });
  await page.click('[data-form="complete"] button[type="submit"]');
  await page.waitForURL(/\/pendaftaran\.html$/, { timeout: 8000 });
  s = await session(page);
  check(s && s.provider === 'google' && s.name === 'Rina Kusuma', 'akun Google baru → formulir pendaftaran', s);
  // the same Google account again → straight through
  await signOut(page);
  await gotoMasuk(page);
  await page.click('#panel-masuk [data-google]');
  await page.waitForSelector('#dg-name');
  await page.fill('#dg-name', 'Rina Kusuma');
  await page.fill('#dg-email', 'rina.uji@gmail.com');
  await page.click('.modal__footer .btn--primary');
  await page.waitForURL(/\/dashboard\.html$/, { timeout: 8000 });
  check(true, 'akun Google terdaftar → langsung ke dasbor');
  // a new Google account from the Daftar tab: the consent line sits under the button → no extra step
  await signOut(page);
  await gotoMasuk(page, '#daftar');
  await page.click('#panel-daftar [data-google]');
  await page.waitForSelector('#dg-name');
  await page.fill('#dg-name', 'Dewi Lestari');
  await page.fill('#dg-email', 'dewi.uji@gmail.com');
  await page.click('.modal__footer .btn--primary');
  await page.waitForURL(/\/pendaftaran\.html$/, { timeout: 8000 });
  s = await session(page);
  check(s && s.name === 'Dewi Lestari', 'Google baru dari tab Daftar → langsung ke formulir pendaftaran', s);

  /* ---------------------------------------------------------------- */
  section('N. ?next= dihormati (akun admin demo) + catatan tujuan per tab');
  await signOut(page);
  await gotoMasuk(page, '?next=anggota.html%23aplikasi');
  check(await page.isVisible('[data-next-note]') && /Silakan masuk untuk melanjutkan ke Aplikasi Anggota/.test(await text(page, '[data-next-note]')), 'catatan tujuan tampil (tab Masuk)', await text(page, '[data-next-note]'));
  await page.click('#tab-daftar');
  const nd = await text(page, '[data-next-note]');
  check(/Aplikasi Anggota terbuka setelah keanggotaan Anda Aktif/.test(nd) && /Formulir Pendaftaran Anggota/.test(nd), 'tab Daftar: tujuan khusus anggota dijelaskan, akun baru ke formulir', nd);
  await shot(page, 'next-daftar-desktop');
  // the demo admin card fills the Masuk form (switches tab + method back), focus on "Masuk"
  await page.click('#panel-daftar [data-method-switch] [data-value="phone"]');
  await page.click('[data-demo-admin-fill]');
  check(await page.getAttribute('#tab-masuk', 'aria-selected') === 'true' && await page.isVisible('#masuk-email-pane'), '"Isi formulir" → tab Masuk + metode Email');
  check(await page.inputValue('#m-email') === 'admin@ppapi.demo' && await page.inputValue('#m-pass') === 'AdminPPAPI2026', 'email & kata sandi admin demo terisi');
  check(await page.evaluate(() => !!document.activeElement && document.activeElement.matches('[data-form="masuk-email"] button[type="submit"]')), 'fokus pada tombol Masuk');
  check(/akun admin demo/i.test(await text(page, '.toast-region')), 'toast menjelaskan langkah berikutnya', await text(page, '.toast-region'));
  await shot(page, 'next-desktop');
  await page.click('[data-form="masuk-email"] button[type="submit"]');
  await page.waitForURL(/\/anggota\.html#aplikasi$/, { timeout: 8000 });
  check(pathAfter(page) === '/anggota.html#aplikasi', 'admin demo masuk → anggota.html#aplikasi (akun lama: ?next= dihormati)', pathAfter(page));
  await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady(), null, { timeout: 15000 }).catch(() => {});
  check(await page.evaluate(() => PPAPI.auth.isAdmin()).catch(() => false), 'sesi admin (PPAPI.auth.isAdmin)');
  // copy buttons (the clipboard may be unavailable headless → either toast is fine)
  await signOut(page);
  await gotoMasuk(page);
  await page.click('[data-demo-copy="email"]');
  await page.waitForSelector('.toast', { timeout: 3000 }).catch(() => {});
  check(/admin demo disalin|Gagal menyalin/.test(await text(page, '.toast-region')), 'tombol salin memberi umpan balik (toast)', await text(page, '.toast-region'));

  section('N2. Akun baru + ?next= (khusus anggota → formulir; halaman publik → dihormati)');
  await gotoMasuk(page, '?next=anggota.html#daftar');
  await page.fill('#d-name', 'Hendra Wijaya');
  await page.fill('#d-email', 'hendra.uji@contoh.id');
  await page.fill('#d-pass', 'Perancah2026');
  await page.fill('#d-pass2', 'Perancah2026');
  await page.setChecked('#d-agree', true, { force: true });
  await page.click('[data-form="daftar-email"] button[type="submit"]');
  await page.waitForURL(/\/pendaftaran\.html$/, { timeout: 8000 });
  check(true, 'next=anggota.html (khusus anggota Aktif) → akun baru tetap ke pendaftaran.html');
  await signOut(page);
  await gotoMasuk(page, '?next=berita.html#daftar');
  check(/Setelah akun dibuat, Anda diarahkan ke halaman yang Anda tuju/.test(await text(page, '[data-next-note]')), 'tab Daftar + halaman publik → "diarahkan ke halaman yang Anda tuju"', await text(page, '[data-next-note]'));
  await page.fill('#d-name', 'Lina Marlina');
  await page.fill('#d-email', 'lina.uji@contoh.id');
  await page.fill('#d-pass', 'Perancah2026');
  await page.fill('#d-pass2', 'Perancah2026');
  await page.setChecked('#d-agree', true, { force: true });
  await page.click('[data-form="daftar-email"] button[type="submit"]');
  await page.waitForURL(/\/berita\.html$/, { timeout: 8000 });
  check(true, 'next=berita.html (publik, eksplisit) → akun baru diarahkan ke berita.html');
  await signOut(page);
  await gotoMasuk(page, '?next=pendaftaran.html#daftar');
  check(/Setelah akun dibuat, Anda diarahkan ke Formulir Pendaftaran Anggota/.test(await text(page, '[data-next-note]')), 'CTA "Mulai Pendaftaran" (next=pendaftaran.html#daftar) → catatan formulir', await text(page, '[data-next-note]'));
  await page.click('#tab-masuk');
  check(/Silakan masuk untuk melanjutkan ke Formulir Pendaftaran Anggota/.test(await text(page, '[data-next-note]')), 'tab Masuk → "… melanjutkan ke Formulir Pendaftaran Anggota"', await text(page, '[data-next-note]'));
  await page.fill('#m-email', USER.email);
  await page.fill('#m-pass', USER.pass);
  await page.click('[data-form="masuk-email"] button[type="submit"]');
  await page.waitForURL(/\/pendaftaran\.html$/, { timeout: 8000 });
  check(true, 'akun lama + next=pendaftaran.html → pendaftaran.html');
  greet = await welcome(page);
  check(/Selamat datang, Siti Rahmawati\./.test(greet) && !/telah dibuat/.test(greet), 'akun lama: ucapan tanpa kalimat "akun telah dibuat"', greet);

  /* ---------------------------------------------------------------- */
  section('O. Upaya open redirect diabaikan');
  for (const evil of ['https%3A%2F%2Fevil.example%2Fphish', '%2F%2Fevil.example', 'javascript%3Aalert(1)', '%2F%2Fevil.example%2Fx.html', 'https%3A%2F%2Fevil.example%2Fdashboard.html']) {
    await signOut(page);
    await gotoMasuk(page, '?next=' + evil);
    check(await page.isHidden('[data-next-note]'), `catatan tujuan tidak tampil untuk next=${decodeURIComponent(evil)}`);
    await page.fill('#m-email', USER.email);
    await page.fill('#m-pass', USER.pass);
    await page.click('[data-form="masuk-email"] button[type="submit"]');
    await page.waitForURL(/\/dashboard\.html$/, { timeout: 8000 });
    check(page.url() === `${BASE}/dashboard.html`, `next=${decodeURIComponent(evil)} → dashboard.html (situs sendiri)`, page.url());
  }
  check(evilRequests.length === 0, 'tidak ada permintaan ke evil.example', evilRequests);
  // a signed-in visitor opening masuk.html with a hostile next is redirected by core gating to the dashboard too
  await gotoMasuk(page, '?next=%2F%2Fevil.example').catch(() => {});
  await page.waitForURL(/\/dashboard\.html$/, { timeout: 8000 }).catch(() => {});
  check(page.url() === `${BASE}/dashboard.html`, 'tamu yang sudah masuk + next berbahaya → dashboard.html', page.url());

  /* ---------------------------------------------------------------- */
  section('P. Tautan header ke halaman ini berpindah tab tanpa memuat ulang');
  await signOut(page);
  await gotoMasuk(page, '?next=anggota.html');
  await page.evaluate(() => { window.__marker = 42; });
  await page.click('.site-header .account__guest a[href="masuk.html#daftar"]');
  check(await page.getAttribute('#tab-daftar', 'aria-selected') === 'true', 'tombol header "Daftar" membuka tab Daftar');
  check(await page.evaluate(() => window.__marker) === 42 && /\?next=anggota\.html#daftar$/.test(page.url()), 'tanpa memuat ulang; ?next= tetap ada', page.url());
  await page.click('.site-header .account__guest a[href="masuk.html"]');
  check(await page.getAttribute('#tab-masuk', 'aria-selected') === 'true' && await page.evaluate(() => window.__marker) === 42, 'tombol header "Masuk" membuka tab Masuk tanpa memuat ulang');

  await ctx.close();

  /* ---------------------------------------------------------------- */
  section('Q. Seluler (390 px)');
  const m = await newPage(MOBILE);
  const mp = m.page;
  await gotoMasuk(mp);
  const ov = await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  check(ov <= 1, 'tanpa overflow horizontal (Masuk)', ov);
  const cardTop = await mp.evaluate(() => Math.round(document.querySelector('.auth-card').getBoundingClientRect().top));
  check(cardTop < 420, 'kartu formulir dekat bagian atas layar', cardTop);
  await mp.click('#tab-daftar');
  await mp.waitForTimeout(100);
  check(await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, 'tanpa overflow horizontal (Daftar)');
  await shot(mp, 'daftar-mobile');
  await mp.click('#panel-daftar [data-form="daftar-email"] button[type="submit"]');
  await shot(mp, 'daftar-validation-mobile');
  await mp.click('#tab-masuk');
  await mp.click('#panel-masuk [data-method-switch] [data-value="phone"]');
  await mp.fill('#mp-phone', '81234567890');
  await mp.click('#masuk-phone-pane [data-send-otp]');
  await mp.waitForSelector('#masuk-phone-pane [data-phone-step="2"]:not([hidden])', { timeout: 5000 });
  const otpBox = await mp.evaluate(() => { const r = document.querySelector('#masuk-phone-pane .otp').getBoundingClientRect(), c = document.querySelector('.auth-card').getBoundingClientRect(); return { otpR: Math.round(r.right), cardR: Math.round(c.right), w: Math.round(document.querySelector('#masuk-phone-pane .otp__input').getBoundingClientRect().width) }; });
  check(otpBox.otpR <= otpBox.cardR && otpBox.w >= 40, '6 kotak OTP muat di layar 390 px (≥40 px per kotak)', otpBox);
  check(await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, 'tanpa overflow horizontal (OTP)');
  await mp.evaluate(() => document.querySelector('#masuk-phone-pane .auth-sent-to').scrollIntoView({ block: 'center' }));
  await shot(mp, 'otp-mobile');
  const tt = await mp.evaluate(() => [...document.querySelectorAll('.auth-card button, .auth-card .check')].filter(b => b.offsetParent).map(b => ({ t: (b.textContent || '').trim().slice(0, 24), h: Math.round(b.getBoundingClientRect().height) })).filter(x => x.h < 44));
  check(tt.length === 0, 'target sentuh ≥ 44 px di kartu', tt);
  // new number → "Lengkapi profil" on a phone
  await mp.locator('#masuk-phone-pane .otp__input').first().focus();
  await mp.keyboard.type('123456');
  await mp.waitForSelector('[data-complete]:not([hidden])', { timeout: 8000 });
  check(await mp.evaluate(() => document.documentElement.scrollWidth - innerWidth) <= 1, 'tanpa overflow horizontal (Lengkapi profil)');
  const cTop = await mp.evaluate(() => Math.round(document.querySelector('#complete-title').getBoundingClientRect().top));
  check(cTop >= 0 && cTop < 844, 'judul langkah terlihat di layar', cTop);
  await mp.evaluate(() => window.scrollTo(0, Math.max(0, document.querySelector('.auth-card').getBoundingClientRect().top + scrollY - 80)));
  await shot(mp, 'complete-mobile');
  const tt2 = await mp.evaluate(() => [...document.querySelectorAll('[data-complete] button, [data-complete] .check')].filter(b => b.offsetParent).map(b => ({ t: (b.textContent || '').trim().slice(0, 24), h: Math.round(b.getBoundingClientRect().height) })).filter(x => x.h < 44));
  check(tt2.length === 0, 'target sentuh ≥ 44 px (Lengkapi profil)', tt2);
  await m.ctx.close();

  /* ---------------------------------------------------------------- */
  section('R. Mode Firebase (stub SDK dari flows/firebase-v2-stub.mjs, hanya dibaca): tanpa catatan demo / akun admin demo');
  const stubSrc = (() => {
    try {
      const src = fs.readFileSync(path.join(__dirname, 'firebase-v2-stub.mjs'), 'utf8').replace(/\r\n/g, '\n');
      const start = src.indexOf('const STUB = () => {');
      const mark = src.indexOf('/* ------------------------------------------------------------------ test */', start);
      const end = mark === -1 ? -1 : src.lastIndexOf('\n};', mark);
      return start === -1 || end < start ? '' : '(' + src.slice(start + 'const STUB = '.length, end + 2) + ')();';
    } catch (er) { return ''; }
  })();
  check(!!stubSrc, 'stub Firebase ditemukan');
  if (stubSrc) {
    const fctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'id-ID' });
    await fctx.route('**/assets/js/config.js', async route => {
      const body = fs.readFileSync(path.join(ROOT, 'assets/js/config.js'), 'utf8').replace("apiKey: ''", "apiKey: 'AIzaSyFAKE-stub-key-000000000000000000'").replace("projectId: ''", "projectId: 'ppapi-stub'");
      await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body });
    });
    await fctx.addInitScript({ content: stubSrc });
    const fp = await fctx.newPage();
    const fErr = [];
    fp.on('pageerror', er => fErr.push(er.message));
    await fp.goto(`${BASE}/masuk.html?next=pendaftaran.html#daftar`, { waitUntil: 'domcontentloaded' });
    await ready(fp);
    check(await fp.evaluate(() => PPAPI.auth.mode === 'firebase' && PPAPI.auth.demoAdmin === null), 'mode firebase; PPAPI.auth.demoAdmin = null');
    check(await fp.isHidden('[data-demo-note]') && await fp.isHidden('[data-demo-admin]') && !(await fp.textContent('main')).includes('AdminPPAPI2026'), 'catatan Mode Demo & akun admin demo tidak tampil (kata sandi demo tidak ada di halaman)');
    check(/Formulir Pendaftaran Anggota/.test(await text(fp, '[data-next-note]')), 'catatan tujuan tetap tampil');
    check(fErr.length === 0, 'tanpa galat halaman (mode Firebase)', fErr);
    await fctx.close();
  }
} catch (e) {
  failed++;
  console.error('\nFLOW ERROR:', e);
} finally {
  if (pageErrors.length) { failed += pageErrors.length; console.log('\nConsole/page errors:\n' + pageErrors.map(x => '  ! ' + x).join('\n')); }
  else console.log('\n  ✓ tanpa galat konsol / halaman pada masuk.html');
  await browser.close();
  server.close();
  console.log(`\n${passed} lulus, ${failed} gagal.`);
  process.exitCode = failed ? 1 : 0;
}
