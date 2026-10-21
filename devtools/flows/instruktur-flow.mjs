// Interaction flow for the Instruktur feature (instruktur.html + Konsol Admin › Instruktur), Mode Demo.
// Run from the workspace root:  node devtools/flows/instruktur-flow.mjs [--shots] [--only=desktop|mobile]
//
// Integrated 2026-10-21: admin.html carries the Instruktur nav item + section shell and loads
// kompetensi.js / store-instruktur.js / admin-instruktur.js; admin.js lists 'instruktur' in SECTIONS.
// The test server serves the REAL files (the former in-memory integration was removed).
//
// Covers: empty public directory → admin creates a profile (photo, competencies, certificate,
// regions, private contact) and publishes it → visible on the public page; a draft stays hidden;
// filters (bidang chips, kompetensi, wilayah, bahasa, metode, search, reset); profile modal + ?id=;
// contact data never reaches the public page; XSS escaping; request form validation + submission
// → visible to the admin, status update + note; unpublish / delete; non-admin API calls forbidden.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
const SAVE = process.argv.includes('--shots');
const ONLY = (process.argv.find(a => a.startsWith('--only=')) || '').split('=')[1] || '';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  const f = String(file).replace(/\\/g, '/');
  if (f.endsWith('assets/js/config.js')) return res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''"));
  fs.createReadStream(file).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
const CONTACT_EMAIL = 'rahasia.instruktur@contoh.id';
const CONTACT_PHONE = '0812-9999-0001';

let pass = 0, fail = 0;
const fails = [];
const ok = (cond, label, detail = '') => { if (cond) { pass++; console.log('  ✓ ' + label); } else { fail++; fails.push(label); console.log('  ✗ ' + label + (detail ? '  — ' + String(detail).slice(0, 300) : '')); } };

const browser = await chromium.launch();
const VPS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
].filter(v => !ONLY || v.name === ONLY);

for (const vp of VPS) {
  console.log(`\n=== ${vp.name} ===`);
  const context = await browser.newContext({ viewport: vp.viewport, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1, reducedMotion: 'reduce', locale: 'id-ID' });
  await context.addInitScript(({ a }) => {
    try {
      if (localStorage.getItem('__ins_anon') === '1') { localStorage.removeItem('ppapi_demo_session'); return; }
      if (!localStorage.getItem('ppapi_demo_session')) localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
      const admins = JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]');
      if (!admins.includes(a.uid)) { admins.push(a.uid); localStorage.setItem('ppapi_demo_admins', JSON.stringify(admins)); }
    } catch (e) {}
  }, { a: ADMIN });
  const page = await context.newPage();
  const issues = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) issues.push(`console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => issues.push('pageerror: ' + e.message));
  page.on('dialog', d => d.dismiss());
  const ready = () => page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady(), null, { timeout: 15000 });
  const asAnon = async (v) => { await page.evaluate((x) => localStorage.setItem('__ins_anon', x ? '1' : '0'), v); };
  const shot = async (name, full = true) => { if (SAVE) await page.screenshot({ path: path.join(SHOTS, `insflow-${vp.name}-${name}.png`), fullPage: full }); };

  /* ---------------- 1. empty public directory ---------------- */
  await page.goto(BASE + '/instruktur.html');
  await asAnon(true);
  await page.goto(BASE + '/instruktur.html');
  await ready();
  await page.waitForSelector('[data-in="results"] .empty-state');
  ok(await page.locator('[data-in="results"] .empty-state__title').innerText() === 'Direktori sedang disiapkan', 'empty directory: calm empty state');
  ok(await page.locator('[data-in="toolbar"]').isHidden(), 'empty directory: toolbar hidden');
  ok(await page.evaluate(() => PPAPI.session.current().user === null), 'public page viewed signed out');
  const forb = await page.evaluate(async () => {
    const out = [];
    for (const fn of [() => PPAPI.instruktur.admin.list(), () => PPAPI.instruktur.requests.list(), () => PPAPI.instruktur.admin.save({ nama: 'X' }), () => PPAPI.instruktur.requests.update('x', { status: 'Selesai' })]) {
      try { await fn(); out.push('ok'); } catch (e) { out.push(e.code); }
    }
    return out;
  });
  ok(forb.every(c => c === 'store/forbidden'), 'non-admin: admin & request-list APIs throw store/forbidden', forb.join(','));

  /* ---------------- 2. admin creates profiles ---------------- */
  await asAnon(false);
  await page.goto(BASE + '/admin.html#instruktur');
  await page.waitForSelector('html[data-admin-ready]', { timeout: 20000 });
  await page.waitForSelector('#instruktur-body .empty-state, #instruktur-body table', { timeout: 10000 });
  ok(!(await page.locator('#sec-instruktur').isHidden()), 'admin: #instruktur section shown');
  ok((await page.locator('#instruktur-body .empty-state__title').innerText()) === 'Belum ada profil instruktur', 'admin: empty profile list');
  await shot('admin-empty', false);

  // validation: empty save
  await page.click('#ins-add');
  await page.waitForSelector('.modal #ins-save');
  await shot('admin-form-top', false);
  await page.click('.modal #ins-save');
  ok(await page.locator('.modal .field.is-invalid').count() >= 2, 'admin form: required fields flagged on empty save');
  await page.fill('.modal input[name="nama"]', 'Budi Santoso');
  await page.fill('.modal input[name="gelar"]', 'Inspektur Scaffolding');
  await page.fill('.modal textarea[name="bio"]', 'Dua belas tahun menginspeksi perancah di proyek gedung tinggi dan kilang.');
  await page.click('.modal #ins-save');
  ok(await page.locator('.modal #ains-g-komp.is-invalid').count() === 1, 'admin form: competency group required');
  // fill profile A
  await page.locator('.modal input[name="kompetensi"][value="SCF-09"]').check({ force: true });
  await page.locator('.modal input[name="kompetensi"][value="SCF-05"]').check({ force: true });
  await page.locator('.modal input[name="metode"][value="Daring"]').check({ force: true });
  await page.locator('.modal input[name="bahasa"][value="Inggris"]').check({ force: true });
  await page.locator('.modal input[name="wilayah"][value="Kalimantan Timur"]').check({ force: true });
  await page.locator('.modal input[name="wilayah"][value="Jawa Barat"]').check({ force: true });
  await page.fill('.modal input[name="pengalamanTahun"]', '12');
  await page.fill('.modal textarea[name="materi"]', 'Inspeksi harian dan scafftag\nPemasangan perancah tube & coupler');
  await page.fill('.modal input[name="kta"]', 'PPAPI-2026-004821');
  await page.fill('.modal input[name="kEmail"]', CONTACT_EMAIL);
  await page.fill('.modal input[name="kTelepon"]', CONTACT_PHONE);
  await page.click('.modal [data-cert-add]');
  await page.fill('.modal [data-cert] [data-cert-f="nama"]', 'Inspektur Scaffolding (BNSP)');
  await page.selectOption('.modal [data-cert] [data-cert-f="penerbit"]', 'BNSP / LSP');
  await page.fill('.modal [data-cert] [data-cert-f="berlakuHingga"]', '2028-06-30');
  // photo: a generated 900×900 PNG
  const png = await page.evaluate(() => { const c = document.createElement('canvas'); c.width = 900; c.height = 900; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 900, 900); g.addColorStop(0, '#222'); g.addColorStop(1, '#ddd'); x.fillStyle = g; x.fillRect(0, 0, 900, 900); for (let i = 0; i < 4000; i++) { x.fillStyle = `rgb(${Math.random() * 255 | 0},${Math.random() * 255 | 0},${Math.random() * 255 | 0})`; x.fillRect(Math.random() * 900, Math.random() * 900, 6, 6); } return c.toDataURL('image/png').split(',')[1]; });
  await page.setInputFiles('.modal [data-photo-input]', { name: 'foto.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.waitForSelector('.modal [data-photo-preview] img');
  await page.locator('.modal input[name="published"]').check({ force: true });
  await page.locator('.modal input[name="published"]').scrollIntoViewIfNeeded();
  await shot('admin-form', false);
  await page.click('.modal #ins-save');
  await page.waitForSelector('.modal', { state: 'detached', timeout: 8000 });
  await page.waitForSelector('#ins-list table');
  ok(await page.locator('#ins-list tbody tr').count() === 1, 'admin: profile A listed');
  ok(/Terbit/i.test(await page.locator('#ins-list tbody tr').first().innerText()), 'admin: profile A published');
  const stored = await page.evaluate(() => { const m = JSON.parse(localStorage.getItem('ppapi_instructors') || '{}'); const k = Object.keys(m)[0]; return { foto: m[k].foto.length, email: JSON.stringify(m[k]).includes('rahasia'), contact: JSON.parse(localStorage.getItem('ppapi_instructor_contacts') || '{}')[k] }; });
  ok(stored.foto > 1000 && stored.foto <= 205000, 'photo compressed to JPEG data URL ≤ 150 KB', stored.foto);
  ok(!stored.email && stored.contact && stored.contact.email === CONTACT_EMAIL, 'contact stored separately from the public profile');

  // profile B: draft, nationwide, daring only, K3, XSS-ish text
  await page.click('#ins-add');
  await page.waitForSelector('.modal #ins-save');
  await page.fill('.modal input[name="nama"]', 'Sri <img src=x onerror="window.__xss=1"> Lestari');
  await page.fill('.modal input[name="gelar"]', 'Ahli K3 Konstruksi <b>Madya</b>');
  await page.fill('.modal textarea[name="bio"]', 'Instruktur K3 konstruksi untuk pekerjaan di ketinggian, berpengalaman melatih regu perancah.');
  await page.locator('.modal input[name="kompetensi"][value="SCF-13"]').check({ force: true });
  await page.locator('.modal input[name="metode"][value="Luring"]').uncheck({ force: true });
  await page.locator('.modal input[name="metode"][value="Daring"]').check({ force: true });
  await page.locator('.modal [data-seluruh]').check({ force: true });
  ok(await page.locator('.modal input[name="wilayah"]:disabled').count() === 38, 'Seluruh Indonesia disables the 38 provinces');
  await page.click('.modal #ins-save');
  await page.waitForSelector('.modal', { state: 'detached', timeout: 8000 });
  await page.waitForFunction(() => document.querySelectorAll('#ins-list tbody tr').length === 2);
  ok(/Draf/i.test(await page.locator('#ins-list tbody tr', { hasText: 'Lestari' }).innerText()), 'admin: profile B saved as draft');
  ok(await page.evaluate(() => !window.__xss), 'admin list: no script execution from names');
  await shot('admin-list', false);

  /* ---------------- 3. public page shows only the published profile ---------------- */
  await asAnon(true);
  await page.goto(BASE + '/instruktur.html');
  await ready();
  await page.waitForSelector('.in-card');
  ok(await page.locator('.in-card').count() === 1, 'public: only the published profile is listed');
  ok(await page.locator('.in-card').first().innerText().then(t => /Budi Santoso/.test(t) && /12 tahun/.test(t)), 'public card: name + experience');
  ok(await page.locator('.in-card .badge--metal').count() === 1, 'public card: PPAPI member badge for KTA');
  ok(await page.locator('.in-card .in-avatar img').count() === 1, 'public card: photo shown');
  const html1 = await page.content();
  ok(!html1.includes(CONTACT_EMAIL) && !html1.includes('9999-0001'), 'public page: instructor contact never rendered');
  const apiLeak = await page.evaluate(async () => JSON.stringify(await PPAPI.instruktur.list()));
  ok(!apiLeak.includes('rahasia') && !apiLeak.includes('Lestari'), 'public API: no contact data, no draft');
  ok(/1 instruktur/i.test(await page.locator('[data-in="hero-meta"]').innerText()), 'hero meta: count');

  // publish B from the admin, then filters
  await asAnon(false);
  await page.goto(BASE + '/admin.html#instruktur/profil');
  await page.waitForSelector('html[data-admin-ready]');
  await page.waitForSelector('#ins-list table');
  await page.locator('#ins-list tr', { hasText: 'Lestari' }).locator('[data-ins-act="publish"]').click();
  await page.waitForFunction(() => /Terbit/.test([...document.querySelectorAll('#ins-list tr')].find(r => /Lestari/.test(r.textContent))?.textContent || ''));
  ok(true, 'admin: profile B published via row action');

  await asAnon(true);
  await page.goto(BASE + '/instruktur.html');
  await ready();
  await page.waitForFunction(() => document.querySelectorAll('.in-card').length === 2);
  ok(await page.evaluate(() => !window.__xss) && (await page.locator('.in-card', { hasText: 'Lestari' }).innerText()).includes('<img src=x'), 'public: XSS text shown literally, not executed');
  const chip = async (label) => page.locator('[data-in="chips"] .chip', { hasText: label }).first();
  ok((await (await chip('Inspeksi')).innerText()).includes('1'), 'bidang chip counts (Inspeksi 1)');
  await (await chip('K3')).click();
  ok(await page.locator('.in-card').count() === 1 && /Lestari/.test(await page.locator('.in-card').innerText()), 'chip K3 → 1 card');
  await (await chip('Semua')).click();
  await page.selectOption('#in-wil', 'Jawa Barat');
  ok(await page.locator('.in-card').count() === 2, 'wilayah Jawa Barat → both (one serves the whole country)');
  await page.selectOption('#in-wil', 'Papua');
  ok(await page.locator('.in-card').count() === 1, 'wilayah Papua → nationwide instructor only');
  await page.selectOption('#in-wil', '');
  await page.selectOption('#in-met', 'Luring');
  ok(await page.locator('.in-card').count() === 1 && /Budi/.test(await page.locator('.in-card').innerText()), 'metode Luring → 1');
  await page.selectOption('#in-met', '');
  await page.selectOption('#in-bhs', 'Inggris');
  ok(await page.locator('.in-card').count() === 1, 'bahasa Inggris → 1');
  await page.selectOption('#in-bhs', '');
  await page.selectOption('#in-komp', 'SCF-09');
  ok(await page.locator('.in-card').count() === 1, 'kompetensi Inspektur → 1');
  await page.fill('#in-q', 'zzzz tidak ada');
  await page.waitForSelector('[data-in="results"] .empty-state');
  ok(/Belum ada instruktur yang cocok/.test(await page.locator('[data-in="results"]').innerText()), 'no-match empty state');
  ok(await page.locator('[data-in="reset"]').isVisible(), 'reset visible while filtering');
  await page.click('[data-in="reset"]');
  ok(await page.locator('.in-card').count() === 2, 'reset → all cards');
  await page.fill('#in-q', 'tube coupler');
  await page.waitForFunction(() => document.querySelectorAll('.in-card').length === 1);
  ok(true, 'search across materi → 1');
  await page.fill('#in-q', '');
  await page.waitForFunction(() => document.querySelectorAll('.in-card').length === 2);
  await shot('public-list');

  // detail modal
  await page.locator('.in-card', { hasText: 'Budi' }).locator('.in-card__open').click();
  await page.waitForSelector('.modal .in-profile');
  const modalText = await page.locator('.modal').innerText();
  ok(/Inspektur Scaffolding \(BNSP\)/.test(modalText) && /30 Juni 2028/.test(modalText), 'modal: certificate with issuer and validity');
  ok(await page.locator('.modal a[href="verifikasi.html?kta=PPAPI-2026-004821"]').count() === 1, 'modal: KTA verification link');
  ok(/Kontak pribadi instruktur tidak dipublikasikan/.test(modalText) && !modalText.includes(CONTACT_EMAIL), 'modal: privacy note, no contact');
  ok(/[?&]id=ins-/.test(page.url()), 'modal: ?id= in the address');
  await shot('public-modal', false);
  await page.click('.modal .modal__footer .btn--primary');
  await page.waitForSelector('[data-in="picked"]:not([hidden])');
  ok(/Budi Santoso/.test(await page.locator('[data-in="picked"]').innerText()), 'modal → request form pre-selects the instructor');
  ok(!/[?&]id=/.test(page.url()), 'closing the modal removes ?id=');

  /* ---------------- 4. request form ---------------- */
  await page.click('[data-in="submit"]');
  ok(await page.locator('.in-form .field.is-invalid').count() >= 5, 'request form: required fields flagged');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'in-organisasi'), 'request form: focus moves to the first error');
  await page.fill('#in-organisasi', 'PT Mitra Pelatihan Nusantara');
  await page.fill('#in-namaPic', 'Dewi Anggraini');
  await page.fill('#in-email', 'dewi@salah');
  await page.fill('#in-telepon', '021-555-1234');
  await page.fill('#in-lokasi', 'Bekasi, Jawa Barat');
  await page.fill('#in-tanggal', '2026-11-16');
  await page.fill('#in-peserta', '24');
  await page.fill('#in-catatan', 'Pelatihan dua hari untuk regu perancah proyek gedung.');
  await page.click('[data-in="submit"]');
  ok(/tidak valid/.test(await page.locator('#in-email-err').innerText()), 'request form: invalid email message');
  ok(await page.locator('#in-consent').evaluate(e => e.closest('.field').classList.contains('is-invalid')), 'request form: consent required');
  await page.fill('#in-email', 'dewi@mitrapelatihan.co.id');
  await page.locator('#in-consent').check({ force: true });
  await page.locator('input[name="metode"][value="Daring"] + .segmented__option').click();
  ok(await page.locator('[data-in="lokasi-opt"]').isVisible(), 'metode Daring → lokasi optional');
  await page.locator('input[name="metode"][value="Luring"] + .segmented__option').click();
  await page.click('[data-in="submit"]');
  await page.waitForSelector('[data-in="success"]:not([hidden])', { timeout: 8000 });
  const succ = await page.locator('[data-in="success"]').innerText();
  const ref = (succ.match(/PI-\d{8}-[A-Z0-9]{6}/) || [''])[0];
  ok(!!ref && /Budi Santoso/.test(succ), 'request submitted: reference number + chosen instructor', ref);
  await shot('public-success');

  /* ---------------- 5. admin processes the request ---------------- */
  await asAnon(false);
  await page.goto(BASE + '/admin.html#instruktur/permintaan');
  await page.waitForSelector('html[data-admin-ready]');
  await page.waitForSelector('#req-list table');
  ok(/PT Mitra Pelatihan Nusantara/.test(await page.locator('#req-list').innerText()), 'admin: request visible');
  ok((await page.locator('[data-count-for="instruktur"]').innerText()).trim().startsWith('1'), 'admin nav: 1 new request');
  await page.locator(`[data-req-open="${ref}"]`).first().click();
  await page.waitForSelector('.drawer #req-form');
  const dText = await page.locator('.drawer').innerText();
  ok(/dewi@mitrapelatihan\.co\.id/.test(dText) && /24 orang/.test(dText) && /Budi Santoso/.test(dText), 'drawer: full request details');
  ok(await page.locator('.drawer a[href^="mailto:dewi@mitrapelatihan.co.id"]').count() === 1, 'drawer: mailto reply');
  await shot('admin-request', false);
  await page.locator('.drawer input[name="status"][value="Diproses"] + .segmented__option').click();
  await page.fill('.drawer textarea[name="catatanAdmin"]', 'Budi bersedia; menunggu konfirmasi tanggal.');
  await page.click('.drawer #req-save');
  await page.waitForSelector('.drawer', { state: 'detached', timeout: 8000 });
  await page.waitForFunction((r) => /Diproses/.test(document.querySelector(`[data-req-row="${r}"]`)?.textContent || ''), ref);
  ok(true, 'admin: status updated to Diproses');
  const reqStored = await page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_instructor_requests'))[0]);
  ok(reqStored.catatanAdmin.includes('menunggu') && reqStored.updatedBy === 'demo-admin-0001', 'request: note + updatedBy stored');
  const auditN = await page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_audit_log') || '[]').filter(x => /^instruktur\./.test(x.action)).length);
  ok(auditN >= 4, 'audit log entries for instructor actions', auditN);

  /* ---------------- 6. unpublish + delete ---------------- */
  await page.click('[data-ins-tab="profil"]');
  await page.waitForSelector('#ins-list table');
  await page.locator('#ins-list tr', { hasText: 'Budi' }).locator('[data-ins-act="unpublish"]').click();
  await page.click('.modal .modal__footer .btn:last-child');
  await page.waitForFunction(() => /Draf/.test([...document.querySelectorAll('#ins-list tr')].find(r => /Budi/.test(r.textContent))?.textContent || ''));
  await page.locator('#ins-list tr', { hasText: 'Lestari' }).locator('[data-ins-act="delete"]').click();
  await page.click('.modal .modal__footer .btn:last-child');
  await page.waitForFunction(() => document.querySelectorAll('#ins-list tbody tr').length === 1);
  ok(true, 'admin: unpublish A, delete B');
  await asAnon(true);
  await page.goto(BASE + '/instruktur.html?id=does-not-exist');
  await ready();
  await page.waitForSelector('[data-in="results"] .empty-state');
  ok(await page.locator('.in-card').count() === 0, 'public: unpublished/deleted profiles gone (empty state back)');

  ok(issues.length === 0, 'no console errors/warnings or page errors', issues.join(' | '));
  await context.close();
}
await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { console.log('Failures:\n - ' + fails.join('\n - ')); process.exit(1); }
