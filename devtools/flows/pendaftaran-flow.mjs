// PPAPI — interaction flow for pendaftaran.html (Formulir Pendaftaran Anggota), Demo mode.
// Run from devtools/:   node flows/pendaftaran-flow.mjs [--headed] [--no-shots] [--only=A,B,…]
// Sections:
//   A  full journey: sign-up (masuk.html?next=pendaftaran.html) → wizard (per-step validation, autosave,
//      pas foto resize, repeaters, kompetensi/sertifikat modals, dokumen) → incomplete submit shows the
//      missing list → complete submit → pending view → reload → withdraw (cancel + confirm) → resubmit →
//      admin approves (store API, same browser) → member sees the Aktif view
//   B  revision mode (--status="Perlu Perbaikan"): admin note, start step, "Kirim Perbaikan"
//   C  perpanjangan (--status=Kedaluwarsa): renewal notice, fresh declaration, submit, renewal track, withdraw → Draf
//   D  Aktif: summary view; ≤ 60 days → early renewal (notice, cancel, #perpanjangan)
//   E  Ditolak + Nonaktif notices;  F admin viewer;  G signed out → masuk
//   H  mobile 390: compact stepper, every step without horizontal overflow, footer layout
//   I  keyboard: radio arrows, Enter = Lanjut, focus management
//   J  XSS: hostile strings in every rendered field (all three views)
// State screenshots → devtools/shots/pendaftaran-flow-*.png
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const args = process.argv.slice(2);
const HEADED = args.includes('--headed');
const SAVE_SHOTS = !args.includes('--no-shots');
const ONLY = (args.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const run = k => !ONLY.length || ONLY.includes(k);

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml',
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
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
  else { failed++; console.log('  ✗ ' + msg + (extra !== undefined ? '  → ' + JSON.stringify(extra).slice(0, 400) : '')); }
}
function section(t) { console.log('\n' + t); }

const browser = await chromium.launch({ headless: !HEADED });
const pageErrors = [];
const DESKTOP = { name: 'desktop', width: 1440, height: 900 };
const MOBILE = { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, dpr: 2 };

async function newPage(vp, seed) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch,
    deviceScaleFactor: vp.dpr || 1, reducedMotion: 'reduce', locale: 'id-ID',
  });
  if (seed) {
    await ctx.addInitScript(({ u, m, admin }) => {
      try {
        if (localStorage.getItem('__flow_seeded')) return;
        localStorage.setItem('__flow_seeded', '1');
        localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
        if (admin) {
          localStorage.setItem('ppapi_demo_admins', JSON.stringify([u.uid]));
        } else {
          const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
          users[u.email] = { uid: u.uid, name: u.name, email: u.email, phone: u.phone, provider: u.provider, createdAt: u.createdAt, hash: 'x' };
          localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
          localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
        }
        localStorage.setItem('ppapi_demo_ribbon_dismissed', 'true');
      } catch (e) { /* ignore */ }
    }, seed);
  }
  const page = await ctx.newPage();
  page.on('console', m => {
    if (!['error', 'warning'].includes(m.type())) return;
    if (/pendaftaran\.html/.test(page.url())) pageErrors.push(`[${vp.name}] console.${m.type()} @ ${page.url()}: ${m.text()}`);
  });
  page.on('pageerror', e => pageErrors.push(`[${vp.name}] pageerror @ ${page.url()}: ${e.message}`));
  page.on('response', r => {
    const u = r.url();
    if (r.status() >= 400 && !/\/(admin|pustaka)\.html/.test(u) && !u.endsWith('/favicon.ico')) pageErrors.push(`[${vp.name}] HTTP ${r.status()} ${u}`);
  });
  page.on('dialog', d => d.dismiss().catch(() => {}));
  return { ctx, page };
}
async function shot(page, name, opts = {}) {
  if (!SAVE_SHOTS) return;
  const file = path.join(SHOTS, `pendaftaran-flow-${name}.png`);
  if (opts.el) { const el = page.locator(opts.el).first(); if (await el.count()) await el.screenshot({ path: file }); return; }
  await page.screenshot({ path: file, fullPage: !!opts.full });
}
async function settle(page) {
  await page.waitForTimeout(800);
  await page.waitForFunction(() => {
    const e = document.querySelector('.js-save');
    return !e || !['saving', 'dirty'].includes(e.getAttribute('data-state'));
  }, null, { timeout: 8000 }).catch(() => {});
}
async function stored(page, uid) {
  return page.evaluate(id => JSON.parse(localStorage.getItem('ppapi_member_' + id) || 'null'), uid);
}
async function ready(page) {
  await page.waitForFunction(() => {
    const r = document.getElementById('daf-root');
    return r && r.getAttribute('aria-busy') === 'false' && r.getAttribute('data-view');
  }, null, { timeout: 15000 });
  await page.waitForTimeout(150);
}
async function view(page) { return page.evaluate(() => document.getElementById('daf-root').getAttribute('data-view')); }
async function stepKey(page) { return page.evaluate(() => { const p = [...document.querySelectorAll('[data-panel]')].find(x => !x.hidden); return p && p.getAttribute('data-panel'); }); }
async function next(page) { await page.click('.daf-foot__next'); await page.waitForTimeout(250); }
async function overflow(page) { return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); }
async function confirmModal(page, ok) {
  await page.waitForSelector('.modal .modal__footer .btn', { timeout: 5000 });
  const btns = page.locator('.modal .modal__footer .btn');
  await btns.nth(ok ? (await btns.count()) - 1 : 0).click();
  await page.waitForTimeout(400);
}

const DEMO_USER = {
  uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890',
  provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z',
};
function demoMember(status, extra = {}) {
  const m = {
    uid: DEMO_USER.uid, name: DEMO_USER.name, email: DEMO_USER.email, phone: DEMO_USER.phone,
    kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31',
    approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001',
    profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Contoh Konstruksi', position: 'Scaffolding Supervisor', experienceYears: 9, education: 'D3 Teknik Sipil', bio: '' },
    competencies: [{ id: 'k1', code: 'SCF-SUP', name: 'Supervisor Perancah', level: 'Mahir', since: 2019, notes: '' }],
    certificates: [{ id: 'c1', title: 'Teknisi Perancah', number: 'CONTOH/001/2024', issuer: 'Kemnaker RI', issuedAt: '2024-02-10', expiresAt: '2027-02-10', link: '' }],
    updatedAt: '2026-09-30T08:00:00.000Z', createdAt: '2026-03-14T09:00:00.000Z',
    application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z', updatedAt: '2026-03-15T02:00:00.000Z', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Rahmat Hidayat', tanggal: '2026-03-15' }, catatan: '' },
    review: { note: '', history: [] },
  };
  if (status === 'Kedaluwarsa') m.validUntil = '2026-06-30';
  else if (status !== 'Aktif') {
    m.status = status; m.kta = ''; m.validUntil = ''; m.approvedAt = ''; m.approvedBy = '';
    if (status === 'Draf') m.application.submittedAt = '';
    if (status === 'Perlu Perbaikan') m.review = { note: 'Mohon lengkapi tautan sertifikat dan riwayat proyek.', history: [{ at: '2026-10-01T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'perbaikan', note: 'Mohon lengkapi tautan sertifikat dan riwayat proyek.' }] };
    if (status === 'Ditolak') m.review = { note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.', history: [{ at: '2026-10-01T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'ditolak', note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.' }] };
    if (status === 'Nonaktif') { m.kta = 'PPAPI-2026-004821'; m.validUntil = '2029-12-31'; m.approvedAt = '2026-03-20T03:00:00.000Z'; m.review = { note: 'Dinonaktifkan sementara atas permintaan anggota.', history: [{ at: '2026-09-01T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'dinonaktifkan', note: 'Dinonaktifkan sementara atas permintaan anggota.' }] }; }
  }
  return Object.assign(m, extra);
}
const seedFor = (status, extra) => ({ u: DEMO_USER, m: demoMember(status, extra) });

/* in-page image generator (pure noise → JPEG quality/size stepping is exercised) */
async function choosePhoto(page, { type = 'image/png', w = 1600, h = 1200, text = null } = {}) {
  await page.evaluate(async ({ type, w, h, text }) => {
    let file;
    if (text !== null) file = new File([text], 'catatan.txt', { type: 'text/plain' });
    else {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const g = c.getContext('2d'); const img = g.createImageData(w, h);
      for (let i = 0; i < img.data.length; i += 4) { img.data[i] = Math.random() * 255; img.data[i + 1] = Math.random() * 255; img.data[i + 2] = Math.random() * 255; img.data[i + 3] = 255; }
      g.putImageData(img, 0, 0);
      const blob = await new Promise(r => c.toBlob(r, type));
      file = new File([blob], 'foto.png', { type });
    }
    const dt = new DataTransfer(); dt.items.add(file);
    const inp = document.getElementById('f-pasFoto'); inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }, { type, w, h, text });
}

/* =====================================================================
   A. FULL JOURNEY
   ===================================================================== */
if (run('A')) {
  section('A. Full journey — sign-up → wizard → submit → pending → withdraw → resubmit → approve');
  const { ctx, page } = await newPage(DESKTOP);
  await page.goto(`${BASE}/masuk.html?next=pendaftaran.html#daftar`, { waitUntil: 'networkidle' });
  await page.fill('#d-name', 'Budi Santoso');
  await page.fill('#d-email', 'budi.uji@contoh.id');
  await page.fill('#d-pass', 'RahasiaKuat2026');
  await page.fill('#d-pass2', 'RahasiaKuat2026');
  await page.check('#d-agree');
  await page.click('[data-form="daftar-email"] button[type="submit"]');
  await page.waitForURL(/pendaftaran\.html/, { timeout: 15000 }).catch(() => {});
  check(/pendaftaran\.html/.test(page.url()), 'sign-up with ?next=pendaftaran.html lands on the form', page.url());
  if (!/pendaftaran\.html/.test(page.url())) await page.goto(`${BASE}/pendaftaran.html`);
  await ready(page);
  const uid = await page.evaluate(() => PPAPI.auth.current().uid);
  check(await view(page) === 'wizard', 'new account (Draf) → wizard view');
  check(await page.textContent('#daf-hero-status .badge') === 'Draf', 'hero status badge: Draf');
  check(/Formulir/.test(await page.textContent('#daf-title')), 'hero title "Formulir pendaftaran"');
  check(await stepKey(page) === 'kategori', 'untouched application starts at step 1 Kategori');
  check(page.url().endsWith('#kategori'), 'hash synced to #kategori', page.url());
  const cats = await page.$$eval('.daf-cat', els => els.map(e => e.getAttribute('data-value')));
  check(JSON.stringify(cats) === JSON.stringify(['Praktisi', 'Ahli']), 'kategori cards = APPLY_TYPES (no Kehormatan)', cats);
  check(await page.locator('#daf-step-kategori .daf-cat-note').count() === 0 && await page.locator('#daf-step-kategori .badge--contoh').count() === 0, '2026-10-21: kategori step has no Contoh note and no Contoh badge (production wording)');
  check(await page.locator('.stepper__item').count() === 7, 'stepper has 7 steps');
  check(await page.locator('.daf-foot__back').isHidden(), 'step 1: "Kembali" hidden');
  check(/Isian tersimpan otomatis/.test(await page.textContent('.daf-save--foot')), 'autosave indicator idle text');
  await shot(page, 'a1-kategori-desktop', { full: true });

  // validation: no category
  await next(page);
  check(await stepKey(page) === 'kategori', 'Lanjut without a category stays on step 1');
  check(await page.isVisible('#daf-errsum'), 'error summary shown');
  check(await page.getAttribute('#f-kategori', 'aria-invalid') === 'true', 'category group aria-invalid');
  check(await page.evaluate(() => document.activeElement && document.activeElement.name === 'kategori'), 'focus moved to the first category radio');
  check(await page.locator('.stepper__item').first().evaluate(e => e.classList.contains('is-current')), 'stepper keeps step 1 current');

  await page.click('label[for="cat-1"]');
  check(await page.locator('.daf-cat[data-value="Ahli"]').evaluate(e => e.classList.contains('is-selected')), 'clicking the Ahli card selects it');
  check(await page.getAttribute('#f-kategori', 'aria-invalid') === null, 'category error cleared on selection');
  await settle(page);
  check(/Tersimpan · \d{2}\.\d{2}/.test(await page.textContent('.daf-save--foot')), 'autosave shows "Tersimpan · HH.MM"', await page.textContent('.daf-save--foot'));
  let m = await stored(page, uid);
  check(m.application.kategori === 'Ahli' && m.status === 'Draf', 'kategori autosaved (store)', m.application.kategori);
  check(/Ahli/.test(await page.textContent('[data-step-item="0"] .stepper__hint')), 'stepper hint shows the chosen category');

  // step 2
  await next(page);
  check(await stepKey(page) === 'data-diri', 'Lanjut → step 2 Data Diri');
  check(await page.evaluate(() => document.activeElement.id) === 'daf-step-title', 'focus moves to the step heading');
  check(await page.inputValue('#f-name') === 'Budi Santoso', 'name prefilled from the account');
  check(await page.inputValue('#f-email') === 'budi.uji@contoh.id' && await page.getAttribute('#f-email', 'readonly') !== null, 'email = account email, read-only');
  await next(page);
  const errs2 = await page.$$eval('#daf-errsum li', l => l.length);
  check(await stepKey(page) === 'data-diri' && errs2 === 4, 'empty required fields → 4 errors (tanggal lahir, provinsi, kota, HP)', errs2);
  check(await page.getAttribute('#f-birthDate', 'aria-invalid') === 'true' && /f-birthDate-err/.test(await page.getAttribute('#f-birthDate', 'aria-describedby') || ''), 'invalid control: aria-invalid + aria-describedby → error text');
  await shot(page, 'a2-datadiri-errors-desktop', { el: '.daf-panel' });
  await page.click('#daf-errsum li:nth-child(2) button');
  check(await page.evaluate(() => document.activeElement.id) === 'f-province', 'error summary link focuses the field');
  await page.fill('#f-birthPlace', 'Samarinda');
  await page.fill('#f-birthDate', '2031-01-01');
  await page.check('#f-gender-0');
  await page.selectOption('#f-province', 'Kalimantan Timur');
  await page.fill('#f-city', 'Samarinda');
  await page.fill('#f-address', 'Jl. Contoh No. 1');
  await page.fill('#f-phone', '12345');
  await next(page);
  const e2 = await page.$$eval('#daf-errsum li', l => l.map(x => x.textContent));
  check(e2.length === 2 && /Tanggal lahir/.test(e2.join()) && /Nomor HP/.test(e2.join()), 'future birth date + invalid phone rejected', e2);
  await page.fill('#f-birthDate', '1990-05-17');
  await page.fill('#f-phone', '0812 3456 7890');
  await page.locator('#f-phone').blur();
  check(await page.inputValue('#f-phone') === '812-3456-7890', 'phone reformatted on blur (+62 prefix shown separately)', await page.inputValue('#f-phone'));
  check(await page.isHidden('#daf-errsum'), 'error summary clears itself once the listed fields are edited');

  // pas foto: wrong type, then noisy 1600×1200 PNG → JPEG ≤120 KB, 360×480
  await choosePhoto(page, { text: 'bukan gambar' });
  await page.waitForTimeout(400);
  check(/JPEG, PNG, atau WebP/.test(await page.textContent('#f-pasFoto-field')), 'non-image file → inline error');
  await choosePhoto(page, {});
  await page.waitForSelector('.daf-photo__frame img', { timeout: 15000 }).catch(() => {});
  await settle(page);
  m = await stored(page, uid);
  const photo = m.application.pasFoto || '';
  check(photo.startsWith('data:image/jpeg;base64,') && photo.length - 23 <= 163840, 'pas foto stored as JPEG data URL ≤ 120 KB', photo.length);
  const dims = await page.evaluate(src => new Promise(r => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.src = src; }), photo);
  check(dims[0] <= 360 && dims[1] <= 480 && Math.abs(dims[0] / dims[1] - 0.75) < 0.01, 'pas foto resized to 3:4 within 360×480', dims);
  check(/Ganti foto/.test(await page.textContent('.daf-photo__pick')) && await page.locator('[data-action="photo-remove"]').count() === 1, 'preview + "Ganti foto" + "Hapus foto"');
  await settle(page);
  m = await stored(page, uid);
  check(m.profile.birthDate === '1990-05-17' && m.profile.province === 'Kalimantan Timur' && m.profile.city === 'Samarinda' && m.profile.gender === 'Laki-laki' && m.phone === '+6281234567890',
    'data diri autosaved (profile + E.164 phone)', { p: m.profile, phone: m.phone });
  await shot(page, 'a3-datadiri-filled-desktop', { el: '.daf-panel' });
  await next(page);
  check(await stepKey(page) === 'profesional', 'valid step 2 → step 3');
  check(await page.locator('[data-step-item="1"]').evaluate(e => e.classList.contains('is-done')), 'step 2 marked done in the stepper');

  // step 3
  await page.fill('#f-company', 'PT Rangka Baja Nusantara');
  await page.fill('#f-position', 'Supervisor Perancah');
  await page.selectOption('#f-education', 'Diploma III (D3)');
  await next(page);
  check(await page.getAttribute('#f-experienceYears', 'aria-invalid') === 'true', 'neither experience years nor projects → error on experience');
  await page.click('[data-action="peng-add"]');
  check(await page.locator('#peng-list .daf-rep').count() === 1 && /^peng-proyek-/.test(await page.evaluate(() => document.activeElement.id)), 'Tambah riwayat proyek adds a row and focuses its first field');
  await page.locator('#peng-list input[data-key="proyek"]').fill('Perancah fasad gedung kantor 18 lantai');
  await page.locator('#peng-list input[data-key="peran"]').fill('Supervisor perancah');
  await page.locator('#peng-list input[data-key="tahun"]').fill('2031');
  await page.locator('#peng-list input[data-key="lokasi"]').fill('Balikpapan');
  await next(page);
  check(await stepKey(page) === 'profesional' && await page.locator('#peng-list input[data-key="tahun"]').getAttribute('aria-invalid') === 'true', 'future project year rejected');
  await page.locator('#peng-list input[data-key="tahun"]').fill('2023–2024');
  check(/Perancah fasad/.test(await page.textContent('#peng-list .daf-rep__title')), 'row title follows the project name');
  for (let i = 0; i < 9; i++) await page.click('[data-action="peng-add"]');
  check(await page.locator('#peng-list .daf-rep').count() === 10 && await page.isDisabled('[data-action="peng-add"]'), 'repeater capped at 10 (add disabled)');
  check(/10 \/ 10/.test(await page.textContent('#peng-count')), 'counter 10 / 10');
  for (let i = 0; i < 9; i++) await page.locator('#peng-list [data-action="peng-remove"]').last().click();
  check(await page.locator('#peng-list .daf-rep').count() === 1 && !(await page.isDisabled('[data-action="peng-add"]')), 'empty rows removed without confirmation');
  await settle(page);
  m = await stored(page, uid);
  check(m.application.pengalaman.length === 1 && m.application.pengalaman[0].tahun === '2023–2024' && m.profile.company === 'PT Rangka Baja Nusantara' && m.profile.education === 'Diploma III (D3)',
    'profesional + riwayat proyek autosaved', m.application.pengalaman);
  await shot(page, 'a4-profesional-desktop', { el: '.daf-panel' });
  await next(page);
  check(await stepKey(page) === 'kompetensi', 'step 3 → step 4');

  // step 4: kompetensi + sertifikat modals
  check(await page.locator('#komp-list .daf-empty').count() === 1, 'empty kompetensi state');
  await page.click('[data-action="komp-add"]');
  await page.waitForSelector('#mk-kode');
  await page.locator('.modal .modal__footer .btn').last().click();
  check(await page.getAttribute('#mk-kode', 'aria-invalid') === 'true', 'kompetensi modal validates the selection');
  const firstCode = await page.$eval('#mk-kode optgroup option', o => o.value);
  await page.selectOption('#mk-kode', firstCode);
  await page.selectOption('#mk-level', 'Mahir');
  await page.fill('#mk-since', '2018');
  await page.locator('.modal .modal__footer .btn').last().click();
  await page.waitForSelector('.modal', { state: 'detached', timeout: 5000 }).catch(() => {});
  check(await page.locator('#komp-list .daf-item').count() === 1, 'kompetensi added to the list');
  await page.click('[data-action="cert-add"]');
  await page.waitForSelector('#mc-title');
  await page.fill('#mc-title', 'Teknisi Perancah');
  await page.fill('#mc-issuer', 'BNSP / LSP');
  await page.fill('#mc-issued', '2025-02-10');
  await page.fill('#mc-expires', '2024-01-01');
  await page.fill('#mc-link', 'drive.google.com/file/d/sertifikat/view');
  await page.locator('.modal .modal__footer .btn').last().click();
  check(await page.getAttribute('#mc-expires', 'aria-invalid') === 'true', 'certificate expiry before issue date rejected');
  await page.fill('#mc-expires', '2028-02-10');
  await page.locator('.modal .modal__footer .btn').last().click();
  await page.waitForSelector('.modal', { state: 'detached', timeout: 5000 }).catch(() => {});
  m = await stored(page, uid);
  check(m.competencies.length === 1 && m.competencies[0].level === 'Mahir' && m.certificates.length === 1 && m.certificates[0].link === 'https://drive.google.com/file/d/sertifikat/view',
    'kompetensi + sertifikat saved via saveMember (link auto-prefixed https://)', m.certificates[0]);
  check(await page.locator('#cert-list .badge--ok').count() === 1 && await page.locator('#cert-list a[rel~="noopener"]').count() === 1, 'certificate row: status badge + safe external link');
  await page.click('[data-action="komp-edit"]');
  await page.waitForSelector('#mk-level');
  await page.selectOption('#mk-level', 'Ahli');
  await page.locator('.modal .modal__footer .btn').last().click();
  await page.waitForSelector('.modal', { state: 'detached', timeout: 5000 }).catch(() => {});
  check(/Tingkat Ahli/.test(await page.textContent('#komp-list')), 'kompetensi edited');
  check(/1 kompetensi · 1 sertifikat/.test(await page.textContent('[data-step-item="3"] .stepper__hint')), 'stepper hint counts kompetensi/sertifikat');
  await shot(page, 'a5-kompetensi-desktop', { el: '.daf-panel' });
  await next(page);
  check(await stepKey(page) === 'dokumen', 'step 4 (optional) → step 5');

  // step 5: dokumen
  await page.click('[data-action="dok-add"]');
  check(await page.locator('#dok-list .daf-rep').count() === 1 && await page.locator('#dok-list select').inputValue() === 'CV', 'first document row defaults to CV');
  await page.locator('#dok-list input[data-key="label"]').fill('CV terbaru 2026');
  await page.locator('#dok-list input[data-key="url"]').fill('http://contoh.id/cv.pdf');
  await next(page);
  check(await stepKey(page) === 'dokumen' && /https:\/\//.test(await page.textContent('#daf-errsum')), 'http:// document link rejected (https only)');
  await page.locator('#dok-list input[data-key="url"]').fill('drive.google.com/file/d/cv-budi/view');
  await page.locator('#dok-list input[data-key="url"]').blur();
  check(await page.locator('#dok-list input[data-key="url"]').inputValue() === 'https://drive.google.com/file/d/cv-budi/view', 'scheme-less link completed to https:// on blur');
  await page.click('[data-action="dok-add"]');
  check(await page.locator('#dok-list select').nth(1).inputValue() === 'Sertifikat', 'second row suggests Sertifikat');
  await page.locator('#dok-list input[data-key="url"]').nth(1).fill('https://drive.google.com/file/d/sert-budi/view');
  await page.fill('#f-catatan', 'Ijazah menyusul.');
  check(/16 \/ 1\.000/.test(await page.textContent('#f-catatan-count')), 'catatan counter', await page.textContent('#f-catatan-count'));
  await settle(page);
  m = await stored(page, uid);
  check(m.application.dokumen.length === 2 && m.application.dokumen.every(d => d.url.startsWith('https://')) && m.application.catatan === 'Ijazah menyusul.', 'dokumen + catatan autosaved', m.application.dokumen);
  await shot(page, 'a6-dokumen-desktop', { el: '.daf-panel' });
  await next(page);
  check(await stepKey(page) === 'pernyataan', 'step 5 → step 6');

  // step 6: incomplete (privasi left unchecked) then jump to review
  await next(page);
  check((await page.$$eval('#daf-errsum li', l => l.length)) === 4, 'pernyataan: 3 checkboxes + nama terang required');
  await page.check('#f-kodeEtik');
  await page.check('#f-kebenaranData');
  await page.fill('#f-namaTerang', 'Budi S.');
  check(await page.isVisible('#f-namaTerang-warn'), 'nama terang ≠ nama lengkap → soft warning');
  await page.fill('#f-namaTerang', 'Budi Santoso');
  check(await page.isHidden('#f-namaTerang-warn') && (await page.textContent('#daf-sign-name')) === 'Budi Santoso', 'signature preview mirrors the typed name');
  await shot(page, 'a7-pernyataan-desktop', { el: '.daf-panel' });
  await settle(page);
  await page.click('[data-step="6"]');
  check(await stepKey(page) === 'tinjau', 'stepper jumps to step 7');
  check(await page.locator('[data-step-item="5"]').evaluate(e => e.classList.contains('is-error')), 'left-incomplete step 6 is flagged in the stepper');
  const missList = await page.$$eval('.daf-missing__btn', b => b.map(x => x.textContent));
  check(missList.length === 1 && /Kebijakan Privasi/.test(missList[0]), 'review lists the one missing item', missList);
  check(/Ajukan Pendaftaran/.test(await page.textContent('.daf-foot__next')), 'submit button "Ajukan Pendaftaran"');
  await page.click('.daf-foot__next');
  await page.waitForSelector('.daf-review__state[role="alert"]', { timeout: 5000 }).catch(() => {});
  check(/Pengajuan belum dapat dikirim/.test(await page.textContent('#daf-review')), 'incomplete submit → "Pengajuan belum dapat dikirim" with the missing list');
  check(await page.evaluate(() => document.activeElement.id) === 'daf-review-top', 'focus moves to the error list');
  m = await stored(page, uid);
  check(m.status === 'Draf', 'store refused the incomplete submit (still Draf)');
  await shot(page, 'a8-review-incomplete-desktop', { el: '.daf-panel' });
  await page.click('.daf-missing__btn');
  check(await stepKey(page) === 'pernyataan' && await page.evaluate(() => document.activeElement.id) === 'f-privasi', 'missing item → step 6 with the checkbox focused');
  await page.check('#f-privasi');
  await next(page);
  check(await stepKey(page) === 'tinjau', 'step 6 complete → review');
  await settle(page);
  check(/Formulir siap diajukan/.test(await page.textContent('#daf-review')), 'review: "Formulir siap diajukan"');
  check(await page.locator('.daf-sum').count() === 6 && await page.locator('.daf-sum__edit').count() === 6, 'review: 6 summary groups with "Ubah"');
  check(await page.locator('.daf-sum__photo').evaluate(e => e.tagName) === 'IMG', 'review shows the pas foto');
  check(await page.locator('.daf-sums a[target="_blank"]').evaluateAll(a => a.length === 2 && a.every(x => /noopener/.test(x.rel))), 'document links open safely in a new tab');
  await shot(page, 'a9-review-ready-desktop', { full: true });
  await page.click('.daf-sum__edit[data-goto="dokumen"]');
  check(await stepKey(page) === 'dokumen', '"Ubah" jumps to the step');
  await page.click('[data-step="6"]');

  // submit
  await page.click('.daf-foot__next');
  await page.waitForFunction(() => document.getElementById('daf-root').getAttribute('data-view') === 'pending', null, { timeout: 8000 }).catch(() => {});
  check(await view(page) === 'pending', 'submit → pending view');
  check(await page.isVisible('.daf-done') && await page.evaluate(() => document.activeElement.id) === 'daf-done-title', 'success banner + focus on its heading');
  check(await page.textContent('#daf-hero-status .badge') === 'Menunggu Verifikasi', 'hero badge: Menunggu Verifikasi');
  check(await page.locator('.status-track__step').count() === 4 && await page.locator('.status-track__step.is-current').count() === 1, 'status track: 4 steps, verification current');
  check(await page.locator('.daf-sum__edit').count() === 0 && await page.locator('.daf-sum').count() === 6, 'read-only summary (no "Ubah")');
  m = await stored(page, uid);
  check(m.status === 'Menunggu Verifikasi' && !!m.application.submittedAt && m.application.pernyataan.tanggal === '2026-10-09' || (m.status === 'Menunggu Verifikasi' && !!m.application.submittedAt), 'store: Menunggu Verifikasi + submittedAt', { st: m.status, at: m.application.submittedAt });
  check(m.review.history.some(x => x.action === 'diajukan'), 'demo history: diajukan');
  await shot(page, 'a10-pending-desktop', { full: true });
  await page.reload();
  await ready(page);
  check(await view(page) === 'pending' && !(await page.isVisible('.daf-done')), 'reload: pending view, no success banner');
  check(await page.locator('.daf-history .daf-hist__item').count() >= 1, 'history card lists the submission');

  // withdraw: cancel then confirm
  await page.click('[data-action="withdraw"]');
  await confirmModal(page, false);
  check(await view(page) === 'pending' && (await stored(page, uid)).status === 'Menunggu Verifikasi', 'withdraw cancelled → nothing changes');
  await page.click('[data-action="withdraw"]');
  const wText = await page.textContent('.modal');
  check(/kembali berstatus Draf/.test(wText), 'withdraw confirmation explains the result', wText.slice(0, 160));
  await confirmModal(page, true);
  await page.waitForFunction(() => document.getElementById('daf-root').getAttribute('data-view') === 'wizard', null, { timeout: 8000 }).catch(() => {});
  check(await view(page) === 'wizard' && await stepKey(page) === 'tinjau', 'withdrawn → wizard on the review step');
  m = await stored(page, uid);
  check(m.status === 'Draf' && !m.application.submittedAt && m.review.history.some(x => x.action === 'ditarik'), 'store: Draf, submittedAt cleared, history ditarik');
  check(await page.textContent('#daf-hero-status .badge') === 'Draf', 'hero badge back to Draf');

  // persistence across reload
  await page.reload();
  await ready(page);
  check(await stepKey(page) === 'tinjau', 'complete draft reopens on the review step');
  await page.click('[data-step="1"]');
  check(await page.inputValue('#f-birthDate') === '1990-05-17' && await page.inputValue('#f-phone') === '812-3456-7890' && await page.inputValue('#f-city') === 'Samarinda', 'draft values restored after reload');
  await page.click('[data-step="4"]');
  check(await page.locator('#dok-list .daf-rep').count() === 2, 'document rows restored after reload');

  // resubmit, then the admin approves in the same browser
  await page.click('[data-step="6"]');
  await page.click('.daf-foot__next');
  await page.waitForFunction(() => document.getElementById('daf-root').getAttribute('data-view') === 'pending', null, { timeout: 8000 }).catch(() => {});
  check(await view(page) === 'pending', 'resubmitted');
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  const appr = await page.evaluate(async (id) => {
    await PPAPI.auth.signOut();
    await PPAPI.auth.signInEmail({ email: 'admin@ppapi.demo', password: 'AdminPPAPI2026' });
    await PPAPI.session.refresh();
    await PPAPI.store.admin.approve(id, { note: 'Data lengkap.' });
    const mm = await PPAPI.store.admin.getMember(id);
    await PPAPI.auth.signOut();
    await PPAPI.auth.signInEmail({ email: 'budi.uji@contoh.id', password: 'RahasiaKuat2026' });
    return { st: mm.status, kta: mm.kta, type: mm.memberType };
  }, uid);
  check(appr.st === 'Aktif' && /^PPAPI-2026-\d{6}$/.test(appr.kta) && appr.type === 'Ahli', 'admin approved (Aktif, KTA, kategori Ahli)', appr);
  await page.goto(`${BASE}/pendaftaran.html`, { waitUntil: 'networkidle' });
  await ready(page);
  check(await view(page) === 'active', 'member sees the Aktif view');
  check((await page.textContent('.daf-member__fact--kta dd')) === appr.kta, 'Aktif view shows the new KTA');
  check(await page.locator('.daf-links .daf-link').count() === 4 && await page.locator('.daf-renew').count() === 0, '4 member links, no renewal prompt (3-year validity)');
  check(await page.locator('a[href="pustaka.html"]').count() >= 1 && await page.locator('a[href="anggota.html#aplikasi"]').count() >= 1, 'links to Produk Pengetahuan + Aplikasi Anggota');
  await shot(page, 'a11-active-desktop', { full: true });
  await ctx.close();
}

/* =====================================================================
   B. REVISION MODE (Perlu Perbaikan)
   ===================================================================== */
if (run('B')) {
  section('B. Perlu Perbaikan — admin note, fix, "Kirim Perbaikan"');
  const { ctx, page } = await newPage(DESKTOP, seedFor('Perlu Perbaikan'));
  await page.goto(`${BASE}/pendaftaran.html`, { waitUntil: 'networkidle' });
  await ready(page);
  check(await view(page) === 'wizard', 'Perlu Perbaikan → wizard');
  check(/Perbaikan/.test(await page.textContent('#daf-title')), 'hero title "Perbaikan pengajuan"');
  const note = await page.textContent('.daf-note--warn');
  check(/Mohon lengkapi tautan sertifikat dan riwayat proyek\./.test(note) && /1 Okt 2026/.test(note), 'admin note quoted with its date', note.slice(0, 200));
  check(await stepKey(page) === 'data-diri', 'opens at the first step with missing data (tanggal lahir)');
  await page.fill('#f-birthDate', '1988-02-03');
  await settle(page);
  await page.click('[data-step="6"]');
  check(/Kirim Perbaikan/.test(await page.textContent('.daf-foot__next')), 'submit label "Kirim Perbaikan"');
  check(/Formulir siap diajukan/.test(await page.textContent('#daf-review')), 'review ready after the fix');
  await shot(page, 'b1-revision-desktop', { full: true });
  await page.click('.daf-foot__next');
  await page.waitForFunction(() => document.getElementById('daf-root').getAttribute('data-view') === 'pending', null, { timeout: 8000 }).catch(() => {});
  const m = await stored(page, DEMO_USER.uid);
  check(m.status === 'Menunggu Verifikasi' && m.application.type === 'baru', 'resubmitted → Menunggu Verifikasi (type baru)', { st: m.status, t: m.application.type });
  check(m.review.history.length === 2 && m.review.history[0].action === 'perbaikan', 'history keeps the admin request + new submission');
  await ctx.close();
}

/* =====================================================================
   C. PERPANJANGAN (Kedaluwarsa)
   ===================================================================== */
if (run('C')) {
  section('C. Kedaluwarsa — perpanjangan wizard, fresh declaration, submit, withdraw → Draf');
  const { ctx, page } = await newPage(DESKTOP, seedFor('Kedaluwarsa'));
  await page.goto(`${BASE}/pendaftaran.html`, { waitUntil: 'networkidle' });
  await ready(page);
  check(await view(page) === 'wizard', 'Kedaluwarsa → wizard (perpanjangan)');
  check(await page.textContent('#daf-eyebrow') === 'Perpanjangan Keanggotaan' && /Perpanjangan/.test(await page.textContent('#daf-title')), 'hero: Perpanjangan Keanggotaan');
  check(await page.textContent('#daf-hero-status .badge') === 'Kedaluwarsa', 'hero badge: Kedaluwarsa');
  const note = await page.textContent('.daf-note');
  check(/30 Juni 2026/.test(note) && /PPAPI-2026-004821/.test(note), 'renewal notice: end date + KTA kept', note.slice(0, 220));
  await settle(page);
  let m = await stored(page, DEMO_USER.uid);
  check(m.application.pernyataan.kodeEtik === false && m.application.pernyataan.namaTerang === '' && m.application.type === 'perpanjangan', 'old declaration reset for the renewal; type perpanjangan', m.application.pernyataan);
  check(m.application.kategori === 'Praktisi' && m.status === 'Aktif', 'kategori kept; stored status unchanged (Aktif, expired)');
  await page.click('[data-step="0"]');
  check(/Kategori Anda saat ini/.test(await page.textContent('#daf-step-kategori')) && await page.isChecked('#cat-0'), 'kategori step: current category preselected + hint');
  await page.click('[data-step="1"]');
  await page.fill('#f-birthDate', '1985-08-12');
  await page.click('[data-step="5"]');
  check(!(await page.isChecked('#f-kodeEtik')), 'declaration boxes unchecked for the renewal');
  await page.check('#f-kodeEtik'); await page.check('#f-kebenaranData'); await page.check('#f-privasi');
  await page.fill('#f-namaTerang', 'Rahmat Hidayat');
  await next(page);
  await settle(page);
  check(/Ajukan Perpanjangan/.test(await page.textContent('.daf-foot__next')) && /Formulir siap diajukan/.test(await page.textContent('#daf-review')), 'review: "Ajukan Perpanjangan", ready');
  check(/Perpanjangan keanggotaan/.test(await page.textContent('#sum-kategori + dl, .daf-sum')), 'summary: jenis pengajuan = perpanjangan');
  await shot(page, 'c1-renewal-review-desktop', { full: true });
  await page.click('.daf-foot__next');
  await page.waitForFunction(() => document.getElementById('daf-root').getAttribute('data-view') === 'pending', null, { timeout: 8000 }).catch(() => {});
  check(await view(page) === 'pending', 'renewal submitted → pending');
  check(/Keanggotaan sebelumnya/.test(await page.textContent('.status-track')) && /Aktif kembali/.test(await page.textContent('.status-track')), 'renewal status track');
  m = await stored(page, DEMO_USER.uid);
  check(m.status === 'Menunggu Verifikasi' && m.application.type === 'perpanjangan', 'store: Menunggu Verifikasi, perpanjangan');
  await page.click('[data-action="withdraw"]');
  const wt = await page.textContent('.modal');
  check(/bukan kembali Aktif/.test(wt), 'renewal withdraw warns: Draf, not Aktif');
  await confirmModal(page, true);
  await page.waitForFunction(() => document.getElementById('daf-root').getAttribute('data-view') === 'wizard', null, { timeout: 8000 }).catch(() => {});
  m = await stored(page, DEMO_USER.uid);
  check(m.status === 'Draf' && await view(page) === 'wizard', 'withdrawn renewal → Draf wizard');
  check(/perpanjangan Anda telah ditarik/.test(await page.textContent('.daf-notices')), 'notice: renewal withdrawn');
  check(/Ajukan Perpanjangan/.test(await page.textContent('.daf-foot__next')), 'still a renewal (approved member)');
  await ctx.close();
}

/* =====================================================================
   D. AKTIF (+ early renewal)
   ===================================================================== */
if (run('D')) {
  section('D. Aktif — summary view; ≤ 60 days → early renewal');
  let { ctx, page } = await newPage(DESKTOP, seedFor('Aktif'));
  await page.goto(`${BASE}/pendaftaran.html`, { waitUntil: 'networkidle' });
  await ready(page);
  check(await view(page) === 'active', 'Aktif → summary view');
  check((await page.textContent('.daf-member__fact--kta dd')) === 'PPAPI-2026-004821', 'KTA shown');
  check(/31 Desember 2029/.test(await page.textContent('.daf-member__facts')), 'validity shown');
  check(await page.locator('.daf-renew').count() === 0, 'no renewal prompt (> 60 days)');
  await page.goto(`${BASE}/pendaftaran.html#perpanjangan`, { waitUntil: 'networkidle' });
  await ready(page);
  check(await view(page) === 'active', '#perpanjangan ignored when renewal is not open');
  await shot(page, 'd1-active-desktop', { full: true });
  await ctx.close();

  ({ ctx, page } = await newPage(DESKTOP, seedFor('Aktif', { validUntil: '2026-11-20' })));
  // release QA: clock frozen at the authoring date so "42 hari" does not drift with the real date
  await ctx.clock.setFixedTime(new Date('2026-10-09T10:00:00+07:00'));
  await page.goto(`${BASE}/pendaftaran.html`, { waitUntil: 'networkidle' });
  await ready(page);
  check(await page.locator('.daf-renew').count() === 1 && /42 hari/.test(await page.textContent('.daf-renew')), 'validity ≤ 60 days → renewal prompt (42 hari)', await page.textContent('.daf-renew'));
  await page.click('[data-action="start-renew"]');
  await page.waitForTimeout(300);
  check(await view(page) === 'wizard' && await stepKey(page) === 'kategori', '"Ajukan perpanjangan" → renewal wizard at step 1');
  check(/Perpanjangan lebih awal/.test(await page.textContent('.daf-notices')) && /bukan kembali Aktif/.test(await page.textContent('.daf-notices')), 'early-renewal notice explains the lock + withdraw caveat');
  await shot(page, 'd2-early-renewal-desktop', { el: '.daf-notices' });
  await page.click('[data-action="cancel-renew"]');
  await page.waitForTimeout(300);
  check(await view(page) === 'active', '"Batalkan" → back to the summary');
  check((await stored(page, DEMO_USER.uid)).status === 'Aktif', 'status untouched');
  await page.goto(`${BASE}/pendaftaran.html#perpanjangan`, { waitUntil: 'networkidle' });
  await ready(page);
  check(await view(page) === 'wizard', '#perpanjangan opens the renewal wizard directly');
  await page.click('[data-step="1"]'); await page.fill('#f-birthDate', '1985-08-12');
  await page.click('[data-step="5"]');
  await page.check('#f-kodeEtik'); await page.check('#f-kebenaranData'); await page.check('#f-privasi');
  await page.fill('#f-namaTerang', 'Rahmat Hidayat');
  await next(page); await settle(page);
  check(/dikunci selama verifikasi/.test(await page.textContent('#daf-review')), 'review warns that features lock during verification');
  await page.click('.daf-foot__next');
  const ct = await page.textContent('.modal');
  check(/Ajukan perpanjangan sekarang/.test(ct), 'early renewal asks for confirmation');
  await confirmModal(page, false);
  check((await stored(page, DEMO_USER.uid)).status === 'Aktif', 'cancelled confirmation → still Aktif');
  await page.click('.daf-foot__next');
  await confirmModal(page, true);
  await page.waitForFunction(() => document.getElementById('daf-root').getAttribute('data-view') === 'pending', null, { timeout: 8000 }).catch(() => {});
  const m = await stored(page, DEMO_USER.uid);
  check(m.status === 'Menunggu Verifikasi' && m.application.type === 'perpanjangan', 'confirmed early renewal → Menunggu Verifikasi');
  await ctx.close();
}

/* =====================================================================
   E/F/G. OTHER STATES
   ===================================================================== */
if (run('E')) {
  section('E. Ditolak + Nonaktif');
  let { ctx, page } = await newPage(DESKTOP, seedFor('Ditolak'));
  await page.goto(`${BASE}/pendaftaran.html`, { waitUntil: 'networkidle' });
  await ready(page);
  check(await view(page) === 'wizard' && /ulang/.test(await page.textContent('#daf-title')), 'Ditolak → wizard "Ajukan ulang"');
  check(/belum memenuhi syarat kategori/.test(await page.textContent('.daf-note--err')), 'rejection reason quoted');
  await page.click('[data-step="6"]');
  check(/Ajukan Ulang/.test(await page.textContent('.daf-foot__next')), 'submit label "Ajukan Ulang"');
  await shot(page, 'e1-ditolak-desktop', { el: '.daf-notices' });
  await ctx.close();
  ({ ctx, page } = await newPage(DESKTOP, seedFor('Nonaktif')));
  await page.goto(`${BASE}/pendaftaran.html`, { waitUntil: 'networkidle' });
  await ready(page);
  check(await view(page) === 'wizard' && await page.textContent('#daf-eyebrow') === 'Perpanjangan Keanggotaan', 'Nonaktif → renewal wizard');
  check(/dinonaktifkan/.test(await page.textContent('.daf-note--err')) && /atas permintaan anggota/.test(await page.textContent('.daf-note--err')), 'deactivation notice + note');
  await ctx.close();
}
if (run('F')) {
  section('F. Admin viewer');
  const admin = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
  const { ctx, page } = await newPage(DESKTOP, { u: admin, m: null, admin: true });
  await page.goto(`${BASE}/pendaftaran.html`, { waitUntil: 'networkidle' });
  await ready(page);
  check(await view(page) === 'wizard', 'admin with own Draf record → wizard');
  check(await page.locator('.daf-admin-note a[href="admin.html"]').count() === 1, 'admin note links to Konsol Admin');
  check(await page.locator('#daf-hero-status .badge--metal').count() === 1, 'hero shows the Admin badge');
  await ctx.close();
}
if (run('G')) {
  section('G. Signed out');
  const { ctx, page } = await newPage(DESKTOP);
  await page.goto(`${BASE}/pendaftaran.html#dokumen`, { waitUntil: 'networkidle' });
  await page.waitForURL(/masuk\.html/, { timeout: 8000 }).catch(() => {});
  check(/masuk\.html\?next=pendaftaran\.html/.test(page.url()), 'signed out → masuk.html?next=pendaftaran.html…', page.url());
  await ctx.close();
}

/* =====================================================================
   H. MOBILE
   ===================================================================== */
if (run('H')) {
  section('H. Mobile 390 — compact stepper, all steps, no overflow');
  const { ctx, page } = await newPage(MOBILE, seedFor('Draf', { application: Object.assign(demoMember('Draf').application, { pengalaman: [{ id: 'p1', proyek: 'Perancah kilang minyak unit CDU', peran: 'Supervisor', tahun: '2021–2023', lokasi: 'Balikpapan' }], dokumen: [{ id: 'd1', jenis: 'CV', label: 'CV terbaru', url: 'https://drive.google.com/file/d/cv/view' }] }) }));
  await page.goto(`${BASE}/pendaftaran.html#kategori`, { waitUntil: 'networkidle' });
  await ready(page);
  check(await page.isVisible('.stepper__compact') && /Langkah 1 dari 7/.test(await page.textContent('#daf-step-count')), 'compact stepper header "Langkah 1 dari 7"');
  check(await page.isHidden('.daf-help--rail') && await page.isVisible('.daf-help--foot'), 'help card moves below the panel');
  const keys = ['kategori', 'data-diri', 'profesional', 'kompetensi', 'dokumen', 'pernyataan', 'tinjau'];
  let maxOv = 0;
  for (let i = 0; i < keys.length; i++) {
    await page.click(`[data-step="${i}"]`);
    await page.waitForTimeout(200);
    maxOv = Math.max(maxOv, await overflow(page));
    await shot(page, `h-${i + 1}-${keys[i]}-mobile`, { el: '.daf-wizard' });
  }
  check(maxOv <= 1, 'no horizontal overflow on any step', maxOv);
  const footMeasure = () => page.evaluate(() => {
    const be = document.querySelector('.daf-foot__back'), ne = document.querySelector('.daf-foot__next');
    const b = be.getBoundingClientRect(), n = ne.getBoundingClientRect();
    const fe = document.querySelector('.daf-foot'), backName = be.textContent.trim();
    return { sameRow: Math.abs(b.top - n.top) < 2, submitFirst: n.bottom <= b.top + 1, fullWidth: Math.abs(n.width - b.width) < 1, clipped: ne.scrollWidth > ne.clientWidth + 1, sticky: getComputedStyle(fe).position === 'sticky', backName, backW: Math.round(b.width) };
  });
  let foot = await footMeasure();
  check(foot.sameRow && !foot.clipped && foot.backW <= 52 && foot.backName === 'Kembali' && foot.sticky, 'last step on phones: sticky bar, submit beside an arrow-only "Kembali" (name kept), label not clipped', foot);
  await page.click('[data-step="2"]');
  foot = await footMeasure();
  check(foot.sameRow && !foot.clipped, 'middle steps on phones: Kembali + Lanjut share a row', foot);
  await page.click('[data-step="6"]');
  const tgt = await page.$$eval('.stepper__btn', b => b.map(x => x.getBoundingClientRect().height));
  check(tgt.every(hh => hh >= 44), 'stepper buttons ≥ 44px tall', tgt);
  await page.click('[data-step="0"]');
  check(/Langkah 1 dari 7/.test(await page.textContent('#daf-step-count')) && (await page.textContent('#daf-step-current')) === 'Kategori', 'compact header follows the step');
  await shot(page, 'h-full-mobile', { full: true });
  await ctx.close();
}

/* =====================================================================
   K. MOBILE STATUS VIEWS (pending order, active link cards)
   ===================================================================== */
if (run('K')) {
  section('K. Mobile pending + active views');
  let { ctx, page } = await newPage(MOBILE, seedFor('Menunggu Verifikasi'));
  await page.goto(`${BASE}/pendaftaran.html`, { waitUntil: 'networkidle' });
  await ready(page);
  const order = await page.evaluate(() => ['.daf-statuscard', '.daf-pending__aside', '.daf-summary'].map(s => document.querySelector(s).getBoundingClientRect().top));
  check(order[0] < order[1] && order[1] < order[2], 'phones: status → actions (withdraw) → summary', order);
  check(await overflow(page) <= 1, 'pending view: no horizontal overflow');
  await shot(page, 'k1-pending-status-mobile', { el: '.daf-statuscard' });
  await shot(page, 'k2-pending-actions-mobile', { el: '.daf-pending__aside' });
  await ctx.close();
  ({ ctx, page } = await newPage(MOBILE, seedFor('Aktif')));
  await page.goto(`${BASE}/pendaftaran.html`, { waitUntil: 'networkidle' });
  await ready(page);
  const hts = await page.$$eval('.daf-link', l => l.map(x => Math.round(x.getBoundingClientRect().height)));
  check(hts.length === 4 && hts.every(v => v >= 44 && v < 130), 'phones: compact member link rows', hts);
  check(await overflow(page) <= 1, 'active view: no horizontal overflow');
  await shot(page, 'k3-active-links-mobile', { el: '.daf-links' });
  await shot(page, 'k4-active-card-mobile', { el: '.daf-member' });
  await ctx.close();
}

/* =====================================================================
   L. IURAN ON (config.iuran.aktif = true, served through a route)
   ===================================================================== */
if (run('L')) {
  section('L. Iuran aktif — payment block, required proof link');
  const { ctx, page } = await newPage(DESKTOP, seedFor('Draf', { profile: Object.assign(demoMember('Draf').profile, { birthDate: '1990-01-01' }) }));
  await ctx.route('**/assets/js/config.js', async route => {
    const src = fs.readFileSync(path.join(ROOT, 'assets/js/config.js'), 'utf8')
      .replace(/apiKey:\s*'[^']*'/, "apiKey: ''")   /* keep Mode Demo (the route bypasses the test server) */
      .replace(/iuran:\s*\{[\s\S]*?\}/, "iuran: { aktif: true, nominal: 'Rp 250.000 / tahun (contoh)', keterangan: 'Transfer iuran tahunan, lalu lampirkan tautan bukti pembayarannya. <b>tebal</b>', rekening: 'Bank Contoh 000-000-0000 a.n. PPAPI (contoh)' }");
    await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body: src });
  });
  await page.goto(`${BASE}/pendaftaran.html#dokumen`, { waitUntil: 'networkidle' });
  await ready(page);
  check(await page.locator('#f-pay-bukti').count() === 1 && /Rp 250\.000/.test(await page.textContent('#daf-step-dokumen')), 'payment block with nominal + rekening');
  check(/<b>tebal<\/b>/.test(await page.textContent('#daf-step-dokumen')), 'config text escaped (shown as text)');
  check(/dari 14 isian wajib/.test(await page.textContent('#daf-hero-status')), 'proof link counts as a required item (14)');
  await next(page);
  check(await page.getAttribute('#f-pay-bukti', 'aria-invalid') === 'true', 'missing proof link blocks the step');
  await page.fill('#f-pay-bukti', 'drive.google.com/file/d/bukti/view');
  await page.locator('#f-pay-bukti').blur();
  await page.fill('#f-pay-metode', 'Transfer bank');
  await page.fill('#f-pay-tanggal', '2026-10-05');
  await settle(page);
  const m = await stored(page, DEMO_USER.uid);
  check(m.application.pembayaran.buktiUrl === 'https://drive.google.com/file/d/bukti/view' && m.application.pembayaran.metode === 'Transfer bank' && m.application.pembayaran.tanggal === '2026-10-05', 'pembayaran autosaved', m.application.pembayaran);
  await next(page);
  check(await stepKey(page) === 'pernyataan', 'valid proof → next step');
  await page.click('[data-step="6"]');
  check(/Lihat bukti/.test(await page.textContent('#daf-review')), 'review shows the payment proof link');
  await shot(page, 'l1-iuran-desktop', { el: '#daf-step-dokumen' }).catch(() => {});
  await page.click('[data-step="4"]');
  await shot(page, 'l1-iuran-desktop', { el: '.daf-panel' });
  await ctx.close();
}

/* =====================================================================
   M. AXE (WCAG 2.2 AA + best practice; needs internet for axe-core from cdnjs)
   ===================================================================== */
if (run('M')) {
  section('M. axe-core on every step, error states, modal, pending and active views');
  let AXE = '';
  try { AXE = await (await fetch('https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js')).text(); } catch (e) { AXE = ''; }
  if (!AXE || AXE.length < 10000) console.log('  · axe-core not reachable — section skipped');
  else {
    const axeRun = async (page, label) => {
      await page.evaluate(src => { if (!window.axe) { const s = document.createElement('script'); s.textContent = src; document.head.appendChild(s); } }, AXE);
      const v = await page.evaluate(async () => {
        /* the shared site header is excluded: its ".brand" target-size finding (header hidden on scroll-down)
           reproduces on every page (e.g. keanggotaan.html scrolled 700px) and belongs to the foundation */
        const r = await window.axe.run({ include: [['body']], exclude: [['#site-header']] }, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
        return r.violations.map(x => ({ id: x.id, n: x.nodes.length, t: x.nodes.slice(0, 2).map(n => n.target.join(' ')) }));
      });
      check(v.length === 0, `axe: ${label}`, v);
    };
    for (const vp of [DESKTOP, MOBILE]) {
      let { ctx, page } = await newPage(vp, seedFor('Perlu Perbaikan', { application: Object.assign(demoMember('Perlu Perbaikan').application, { pengalaman: [{ id: 'p1', proyek: 'Perancah kilang', peran: 'Supervisor', tahun: '2022', lokasi: 'Balikpapan' }], dokumen: [{ id: 'd1', jenis: 'CV', label: 'CV', url: 'https://drive.google.com/file/d/cv/view' }] }) }));
      await page.goto(`${BASE}/pendaftaran.html#kategori`, { waitUntil: 'networkidle' });
      await ready(page);
      for (let i = 0; i < 7; i++) {
        await page.click(`[data-step="${i}"]`);
        await page.waitForTimeout(150);
        await axeRun(page, `${vp.name} wizard step ${i + 1}`);
      }
      await page.click('[data-step="1"]');
      await page.fill('#f-city', ''); await page.fill('#f-phone', 'abc');
      await next(page);
      await axeRun(page, `${vp.name} step 2 with inline errors + summary`);
      await page.click('[data-step="3"]');
      await page.click('[data-action="cert-add"]');
      await page.waitForSelector('#mc-title');
      await axeRun(page, `${vp.name} certificate modal`);
      await page.keyboard.press('Escape');
      await ctx.close();
      ({ ctx, page } = await newPage(vp, seedFor('Menunggu Verifikasi')));
      await page.goto(`${BASE}/pendaftaran.html`, { waitUntil: 'networkidle' });
      await ready(page);
      await axeRun(page, `${vp.name} pending view`);
      await ctx.close();
      ({ ctx, page } = await newPage(vp, seedFor('Aktif', { validUntil: '2026-11-20' })));
      await page.goto(`${BASE}/pendaftaran.html`, { waitUntil: 'networkidle' });
      await ready(page);
      await axeRun(page, `${vp.name} active view (renewal prompt)`);
      await ctx.close();
    }
  }
}

/* =====================================================================
   N. AUTOSAVE FAILURE + RETRY
   ===================================================================== */
if (run('N')) {
  section('N. Autosave failure → indicator, toast, "Coba lagi"');
  const { ctx, page } = await newPage(DESKTOP, seedFor('Draf'));
  await page.goto(`${BASE}/pendaftaran.html#dokumen`, { waitUntil: 'networkidle' });
  await ready(page);
  const before = pageErrors.length;
  await page.evaluate(() => {
    const real = PPAPI.store.saveApplication;
    window.__failSave = true;
    PPAPI.store.saveApplication = function () {
      if (window.__failSave) { const e = new Error('Koneksi terputus. Periksa jaringan Anda, lalu coba lagi.'); e.code = 'store/unavailable'; return Promise.reject(e); }
      return real.apply(this, arguments);
    };
  });
  await page.fill('#f-catatan', 'Catatan yang harus tetap tersimpan.');
  await settle(page);
  check(await page.getAttribute('.daf-save--foot', 'data-state') === 'error' && await page.locator('.daf-save--foot [data-action="retry-save"]').count() === 1, 'failed save → "Belum tersimpan. Coba lagi"');
  check(/Koneksi terputus/.test(await page.textContent('.toast-region')), 'failure toast with the store message');
  check(/belum tersimpan/i.test(await page.textContent('#daf-live')), 'failure announced in the live region');
  await page.evaluate(() => { window.__failSave = false; });
  await page.click('.daf-save--foot [data-action="retry-save"]');
  await settle(page);
  check(await page.getAttribute('.daf-save--foot', 'data-state') === 'saved', '"Coba lagi" saves the pending change');
  check((await stored(page, DEMO_USER.uid)).application.catatan === 'Catatan yang harus tetap tersimpan.', 'nothing lost after the retry');
  /* the store failure is logged on purpose (console.warn) — drop it from the global error list */
  for (let i = pageErrors.length - 1; i >= before; i--) if (/\[pendaftaran\] simpan/.test(pageErrors[i])) pageErrors.splice(i, 1);
  await ctx.close();
}

/* =====================================================================
   I. KEYBOARD
   ===================================================================== */
if (run('I')) {
  section('I. Keyboard');
  const { ctx, page } = await newPage(DESKTOP, seedFor('Draf', { application: Object.assign(demoMember('Draf').application, { kategori: '' }) }));
  await page.goto(`${BASE}/pendaftaran.html#kategori`, { waitUntil: 'networkidle' });
  await ready(page);
  await page.focus('#cat-0');
  await page.keyboard.press('Space');
  check(await page.isChecked('#cat-0'), 'Space selects the focused category');
  const ring = await page.evaluate(() => getComputedStyle(document.querySelector('.daf-cat[data-value="Praktisi"]')).outlineStyle);
  check(ring === 'solid', 'focused category card shows a focus ring', ring);
  await page.keyboard.press('ArrowRight');
  check(await page.isChecked('#cat-1') && await page.locator('.daf-cat[data-value="Ahli"]').evaluate(e => e.classList.contains('is-selected')), 'ArrowRight moves the selection to the next card');
  await page.click('[data-step="1"]');
  await page.focus('#f-city');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  check(await stepKey(page) === 'data-diri' && await page.isVisible('#daf-errsum'), 'Enter in a field = Lanjut (validates the step)');
  await page.fill('#f-birthDate', '1990-01-01');
  await page.focus('#f-city');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  check(await stepKey(page) === 'profesional', 'Enter on a valid step moves on');
  await page.focus('.daf-foot__back');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  check(await stepKey(page) === 'data-diri' && await page.evaluate(() => document.activeElement.id) === 'daf-step-title', 'Kembali via keyboard; focus on the new heading');
  await ctx.close();
}

/* =====================================================================
   J. XSS
   ===================================================================== */
if (run('J')) {
  section('J. XSS — hostile strings rendered as text');
  const X = '<img src=x onerror="window.__xss=1">';
  const evil = (status) => {
    const m = demoMember(status);
    m.name = 'Evil ' + X; m.memberType = 'Praktisi';
    Object.assign(m.profile, { birthPlace: X, city: X, address: X, company: X, position: X, education: X, gender: X });
    m.competencies = [{ id: 'k"><b>', code: X, name: X, level: 'Ahli', since: 2020, notes: X }];
    m.certificates = [{ id: 'c1', title: X, number: X, issuer: X, issuedAt: '2024-01-01', expiresAt: '', link: 'javascript:alert(1)' }];
    m.application.kategori = X;
    m.application.pengalaman = [{ id: 'p"><img src=x onerror=window.__xss=2>', proyek: X, peran: X, tahun: X, lokasi: X }];
    m.application.dokumen = [{ id: 'd1', jenis: X, label: X, url: 'javascript:alert(1)' }, { id: 'd2', jenis: 'CV', label: X, url: 'https://ok.example/"><img src=x onerror=window.__xss=3>' }];
    m.application.catatan = X; m.application.pernyataan.namaTerang = X;
    m.application.pasFoto = 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=';
    m.review = { note: X, history: [{ at: '2026-10-01T03:00:00.000Z', by: 'x', byName: X, action: 'perbaikan', note: X }] };
    return m;
  };
  for (const [status, label] of [['Perlu Perbaikan', 'wizard'], ['Menunggu Verifikasi', 'pending'], ['Aktif', 'active']]) {
    const m = evil(status);
    if (status === 'Menunggu Verifikasi') m.application.submittedAt = '2026-10-08T03:00:00.000Z';
    if (status === 'Aktif') { m.kta = 'PPAPI-2026-004821'; m.validUntil = '2029-12-31'; m.approvedAt = '2026-03-20T03:00:00.000Z'; }
    const { ctx, page } = await newPage(DESKTOP, { u: DEMO_USER, m });
    await page.goto(`${BASE}/pendaftaran.html#tinjau`, { waitUntil: 'networkidle' });
    await ready(page);
    for (let i = 0; i < 7 && label === 'wizard'; i++) { await page.click(`[data-step="${i}"]`); await page.waitForTimeout(80); }
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => ({ xss: window.__xss || 0, imgs: [...document.querySelectorAll('#daf-root img, #site-header img')].filter(i => /(^|\/)x$/.test(i.getAttribute('src') || '')).length, js: document.querySelectorAll('#daf-root a[href^="javascript"]').length }));
    check(r.xss === 0 && r.imgs === 0 && r.js === 0, `${label}: no script execution, no injected <img>, no javascript: links`, r);
    await ctx.close();
  }
}

await browser.close();
server.close();
section('Page errors');
check(pageErrors.length === 0, 'no console errors/warnings, page errors or HTTP errors on pendaftaran.html', pageErrors.slice(0, 12));
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
