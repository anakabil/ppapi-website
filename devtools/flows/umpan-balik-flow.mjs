// PPAPI — interaction flow for umpan-balik.html, kebijakan-privasi.html and 404.html
// Run from devtools/:  node flows/umpan-balik-flow.mjs
//
// A) Umpan balik: initial render, inline validation (aria-invalid, focus, summary), phone
//    normalisation, live counter, rating + clear, anonymous toggle (disable/clear/restore),
//    kategori hint + ?kategori= preselect, successful submit (store record, reference id, success
//    panel, focus), "Kirim umpan balik lain" reset, anonymous submit, signed-in prefill, config
//    contact values (rows, wa.me, mailto, maps iframe, alt links), mobile layout, keyboard.
// B) Kebijakan privasi: TOC ↔ sections, scroll-spy aria-current, mobile <details> TOC.
// C) 404: nested paths on localhost (base href '/'), simulated GitHub project site
//    (https://<user>.github.io/<repo>/a/b/c → base '/<repo>/'), no wrong-path requests,
//    header/footer + links resolve, skip link stays on page, missing-brace motif (motion).
// Screenshots: devtools/shots/ubflow-*.png
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };

function serveFile(p) {
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    return { status: 404, type: MIME['.html'], body: fs.readFileSync(path.join(ROOT, '404.html')) };
  }
  return { status: 200, type: MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', body: fs.readFileSync(file) };
}
const server = http.createServer((req, res) => {
  const r = serveFile(decodeURIComponent(new URL(req.url, 'http://x').pathname));
  res.writeHead(r.status, { 'content-type': r.type });
  res.end(r.body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const SESSION = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };

let passed = 0, failed = 0;
function check(cond, msg, extra) {
  if (cond) { passed++; console.log('  ✓ ' + msg); }
  else { failed++; console.log('  ✗ ' + msg + (extra !== undefined ? '\n      ' + JSON.stringify(extra) : '')); }
}
// real mouse click on the checkbox spot (the transparent native input and the custom .check__box overlap, so
// Playwright's actionability check sees one 'intercepting' the other — force skips only that check)
async function setCheck(page, sel, val) { if ((await page.isChecked(sel)) !== val) await page.click(sel, { force: true }); }
const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(SHOTS, `ubflow-${name}.png`), ...opts });
function watch(page, label) {
  const issues = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) issues.push(`${label} console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => issues.push(`${label} pageerror: ${e.message}`));
  page.on('requestfailed', r => { if (!/fonts\.(googleapis|gstatic)\.com/.test(r.url())) issues.push(`${label} requestfailed: ${r.url()}`); });
  return issues;
}

const browser = await chromium.launch();
const newCtx = (o = {}) => browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'id-ID', ...o });

/* =====================================================================
   A) UMPAN BALIK
   ===================================================================== */
console.log('\nA) umpan-balik.html');
{
  const ctx = await newCtx();
  const page = await ctx.newPage();
  const issues = watch(page, 'ub');
  await page.goto(`${BASE}/umpan-balik.html`, { waitUntil: 'networkidle' });

  // --- initial render
  check(await page.locator('input[name="kategori"][value="Kritik"]').isChecked(), 'kategori default = Kritik');
  check((await page.textContent('[data-ub-kat-hint]')).includes('perlu diperbaiki'), 'hint kategori Kritik tampil');
  check((await page.textContent('[data-ub-counter]')).trim() === '0 / 2.000', 'counter awal "0 / 2.000"');
  check(await page.locator('[data-ub-faq] .accordion__item').count() === 4, 'FAQ umum: 4 butir');
  check(await page.getAttribute('[data-ub-faq] .accordion__trigger >> nth=0', 'aria-expanded') === 'true', 'FAQ pertama terbuka');
  check((await page.textContent('[data-ub-office]')).includes('Alamat sekretariat akan segera diperbarui.'), 'fallback alamat sekretariat');
  check(await page.locator('.ub-map--placeholder').count() === 1 && await page.locator('.ub-map iframe').count() === 0, 'mapsQuery kosong → placeholder peta (tanpa iframe)');
  check(await page.locator('[data-ub-office] a[href^="tel:"], [data-ub-office] a[href^="mailto:"], [data-ub-office] a[href*="wa.me"]').count() === 0, 'tidak ada baris telepon/WA/email saat kosong');
  check(await page.locator('[data-ub-alt]').isHidden(), 'tautan alternatif WA/Email disembunyikan saat kontak kosong');
  check(await page.locator('[data-ub-signed]').isHidden(), 'catatan "masuk sebagai" tersembunyi untuk tamu');

  // sticky secretariat card (desktop, fits the viewport)
  check(await page.locator('[data-ub-aside].is-sticky').count() === 1, 'desktop: kartu Sekretariat lengket (tingginya muat di layar)');
  await page.evaluate(() => { const c = document.querySelector('.ub-card'); window.scrollTo(0, c.getBoundingClientRect().top + window.scrollY + 700); });
  await page.waitForTimeout(250);
  const stickTop = await page.evaluate(() => document.querySelector('.ub-office').getBoundingClientRect().top);
  check(stickTop > 70 && stickTop < 140, 'kartu Sekretariat tetap terlihat saat formulir digulir', stickTop);
  await page.evaluate(() => window.scrollTo(0, 0));

  // FAQ accordion toggles
  await page.click('[data-ub-faq] .accordion__trigger >> nth=1');
  check(await page.getAttribute('[data-ub-faq] .accordion__trigger >> nth=1', 'aria-expanded') === 'true'
    && await page.getAttribute('[data-ub-faq] .accordion__trigger >> nth=0', 'aria-expanded') === 'false', 'accordion single: membuka butir 2 menutup butir 1');

  // --- empty submit → inline errors
  await page.click('[data-ub-submit]');
  const invalid = await page.$$eval('[aria-invalid="true"]', els => els.map(e => e.name));
  check(['nama', 'email', 'subjek', 'pesan', 'consent'].every(n => invalid.includes(n)) && !invalid.includes('phone'), 'submit kosong → error pada nama, email, subjek, pesan, persetujuan (HP opsional)', invalid);
  check(await page.evaluate(() => document.activeElement && document.activeElement.name) === 'nama', 'fokus pindah ke isian pertama yang salah');
  check((await page.textContent('[data-ub-alert]')).includes('5 isian'), 'ringkasan kesalahan "Ada 5 isian…"');
  check((await page.textContent('#ub-email-err')).length > 10 && await page.locator('#ub-email-err').isVisible(), 'pesan error email terlihat');
  await shot(page, 'errors-desktop', { fullPage: false, clip: { x: 0, y: 0, width: 1440, height: 900 } }).catch(() => {});
  await page.locator('.ub-card').screenshot({ path: path.join(SHOTS, 'ubflow-errors-card.png') });

  // --- invalid email / phone, then valid
  await page.fill('#ub-nama', 'Budi Santoso');
  await page.fill('#ub-email', 'budi@contoh');
  await page.fill('#ub-phone', '12-34');
  await page.locator('#ub-phone').blur();
  check(await page.getAttribute('#ub-email', 'aria-invalid') === 'true', 'email tanpa domain valid → error');
  check(await page.getAttribute('#ub-phone', 'aria-invalid') === 'true', 'nomor HP tidak valid → error');
  check(await page.getAttribute('#ub-nama', 'aria-invalid') === null, 'nama valid → error hilang saat diketik');
  await page.fill('#ub-email', 'budi@contoh.id');
  await page.fill('#ub-phone', '0812 3456 7890');
  await page.locator('#ub-phone').blur();
  check(await page.inputValue('#ub-phone') === '812-3456-7890', 'nomor HP dirapikan → "812-3456-7890"', await page.inputValue('#ub-phone'));
  check(await page.getAttribute('#ub-phone', 'aria-invalid') === null && await page.getAttribute('#ub-email', 'aria-invalid') === null, 'email & HP valid → tanpa error');

  // --- kategori
  await page.click('.ub-seg input[value="Pengaduan"] + .segmented__option');
  check(await page.locator('input[name="kategori"][value="Pengaduan"]').isChecked(), 'pilih kategori Pengaduan');
  check((await page.textContent('[data-ub-kat-hint]')).includes('kronologinya'), 'hint berganti sesuai kategori');

  // --- subjek & pesan & counter
  await page.fill('#ub-subjek', 'Uji');
  await page.fill('#ub-pesan', 'Terlalu');
  check((await page.textContent('[data-ub-counter]')).trim() === '7 / 2.000', 'counter live "7 / 2.000"');
  check(await page.locator('[data-ub-counter].is-short').count() === 1, 'counter menandai pesan < 10 karakter');
  check(await page.getAttribute('#ub-pesan', 'aria-invalid') === 'true', 'pesan < 10 karakter → error (setelah submit)');
  const msg = 'Pendaftaran pelatihan inspeksi perancah bulan ini belum mencantumkan kuota peserta. Mohon informasi lebih lanjut.';
  await page.fill('#ub-pesan', msg);
  check((await page.textContent('[data-ub-counter]')).trim() === `${msg.length} / 2.000`, `counter "${msg.length} / 2.000"`);
  check(await page.getAttribute('#ub-pesan', 'aria-invalid') === null, 'pesan valid → error hilang');
  check(await page.getAttribute('#ub-pesan', 'maxlength') === '2000', 'textarea maxlength 2000');

  // --- rating
  await page.click('label[for="ub-r4"]');
  check((await page.textContent('[data-ub-rating-label]')).trim() === 'Baik', 'rating 4 → label "Baik"');
  check(await page.locator('[data-ub-rating-clear]').isVisible(), 'tombol "Hapus penilaian" muncul');
  await page.click('[data-ub-rating-clear]');
  check((await page.textContent('[data-ub-rating-label]')).trim() === 'Belum dinilai' && !(await page.locator('input[name="rating"]:checked').count()), 'hapus penilaian → kosong');
  await page.click('label[for="ub-r4"]');

  // --- anonymous toggle (disable/clear/restore)
  await setCheck(page, '#ub-anon', true);
  check(await page.isDisabled('#ub-nama') && await page.isDisabled('#ub-email') && await page.isDisabled('#ub-phone'), 'anonim → nama/email/HP nonaktif');
  check(await page.inputValue('#ub-nama') === '' && await page.inputValue('#ub-email') === '', 'anonim → nama/email dikosongkan');
  await setCheck(page, '#ub-anon', false);
  check(await page.inputValue('#ub-nama') === 'Budi Santoso' && await page.inputValue('#ub-email') === 'budi@contoh.id' && await page.inputValue('#ub-phone') === '812-3456-7890', 'batal anonim → nilai dipulihkan');

  // --- consent missing → still blocked
  await page.fill('#ub-subjek', 'Kuota pelatihan inspeksi');
  await page.click('[data-ub-submit]');
  check(await page.getAttribute('#ub-consent', 'aria-invalid') === 'true' && await page.locator('[data-ub-success]').isHidden(), 'tanpa persetujuan → tidak terkirim');
  check(await page.evaluate(() => document.activeElement && document.activeElement.id) === 'ub-consent', 'fokus ke kotak persetujuan');

  // --- valid submit
  await setCheck(page, '#ub-consent', true);
  await page.click('[data-ub-submit]');
  await page.waitForSelector('[data-ub-success]:not([hidden])', { timeout: 5000 });
  const ref = (await page.textContent('[data-ub-ref]')).trim();
  check(/^UB-\d{8}-[A-Z0-9]{4}$/.test(ref), `nomor referensi = id dari store (${ref})`);
  check(await page.locator('[data-ub-form]').isHidden(), 'formulir diganti panel sukses');
  check(await page.evaluate(() => document.activeElement && document.activeElement.hasAttribute('data-ub-success-title')), 'fokus ke judul panel sukses');
  const succText = await page.textContent('[data-ub-success]');
  check(succText.includes('Pengaduan') && succText.includes('Kuota pelatihan inspeksi') && succText.includes('Budi Santoso'), 'ringkasan sukses: kategori, subjek, pengirim');
  check(succText.includes('Mode Demo'), 'catatan Mode Demo jujur (belum diteruskan ke sekretariat)');
  check(await page.locator('[data-ub-success] [data-copy]').getAttribute('data-copy') === ref, 'tombol salin membawa nomor referensi');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_feedback') || '[]').pop());
  check(stored && stored.id === ref && stored.kategori === 'Pengaduan' && stored.nama === 'Budi Santoso' && stored.email === 'budi@contoh.id'
    && stored.phone === '+6281234567890' && stored.rating === 4 && stored.anonim === false && stored.halaman === 'umpan-balik.html'
    && stored.pesan === msg && stored.subjek === 'Kuota pelatihan inspeksi', 'record tersimpan sesuai kontrak submitFeedback', stored);
  await page.locator('.ub-card').screenshot({ path: path.join(SHOTS, 'ubflow-success-card.png') });

  // --- reset
  await page.click('[data-ub-again]');
  check(await page.locator('[data-ub-form]').isVisible() && await page.locator('[data-ub-success]').isHidden(), '"Kirim umpan balik lain" → formulir kembali');
  check(await page.inputValue('#ub-subjek') === '' && await page.inputValue('#ub-pesan') === '' && !(await page.isChecked('#ub-consent')), 'formulir dikosongkan');
  check((await page.textContent('[data-ub-counter]')).trim() === '0 / 2.000' && (await page.textContent('[data-ub-rating-label]')).trim() === 'Belum dinilai', 'counter & rating direset');
  check(await page.locator('[aria-invalid="true"]').count() === 0 && (await page.textContent('[data-ub-alert]')).trim() === '', 'tanpa sisa error');

  // --- anonymous submit
  await setCheck(page, '#ub-anon', true);
  await page.fill('#ub-subjek', 'Apresiasi pelatihan');
  await page.fill('#ub-pesan', 'Materi pelatihan sangat aplikatif. Terima kasih kepada narasumber.');
  await setCheck(page, '#ub-consent', true);
  await page.click('[data-ub-submit]');
  await page.waitForSelector('[data-ub-success]:not([hidden])', { timeout: 5000 });
  const anon = await page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_feedback') || '[]').pop());
  check(anon && anon.anonim === true && anon.nama === '' && anon.email === '' && anon.phone === '' && anon.uid === null, 'kirim anonim → identitas kosong di record', anon);
  check((await page.textContent('[data-ub-success]')).includes('Anonim'), 'panel sukses menyebut pengirim "Anonim"');

  // --- keyboard: arrow keys move between kategori radios
  await page.click('[data-ub-again]');
  await page.focus('input[name="kategori"][value="Kritik"]');
  await page.keyboard.press('ArrowRight');
  check(await page.locator('input[name="kategori"][value="Saran"]').isChecked(), 'keyboard: panah kanan memilih kategori berikutnya');
  const focusStyle = await page.evaluate(() => getComputedStyle(document.querySelector('input[name="kategori"]:checked + .segmented__option')).outlineStyle);
  check(focusStyle !== 'none', 'kategori terfokus memiliki outline fokus terlihat', focusStyle);

  await shot(page, 'desktop-full', { fullPage: true });
  check(issues.length === 0, 'tanpa error konsol / request gagal', issues);
  await ctx.close();
}

/* --- ?kategori= preselect + signed-in prefill --- */
{
  const ctx = await newCtx();
  await ctx.addInitScript(u => { try { localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); } catch (e) {} }, SESSION);
  const page = await ctx.newPage();
  const issues = watch(page, 'ub-auth');
  await page.goto(`${BASE}/umpan-balik.html?kategori=apresiasi`, { waitUntil: 'networkidle' });
  check(await page.locator('input[name="kategori"][value="Apresiasi"]').isChecked(), '?kategori=apresiasi → Apresiasi terpilih');
  check(await page.inputValue('#ub-nama') === SESSION.name && await page.inputValue('#ub-email') === SESSION.email && await page.inputValue('#ub-phone') === '812-3456-7890', 'masuk → identitas terisi dari akun');
  check(await page.locator('[data-ub-signed]').isVisible() && (await page.textContent('[data-ub-signed]')).includes(SESSION.name), 'catatan "Anda masuk sebagai …" tampil');
  await page.fill('#ub-subjek', 'Saran dasbor');
  await page.fill('#ub-pesan', 'Mohon tambahkan pengingat agenda pada dasbor anggota.');
  await setCheck(page, '#ub-consent', true);
  await page.click('[data-ub-submit]');
  await page.waitForSelector('[data-ub-success]:not([hidden])');
  const rec = await page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_feedback') || '[]').pop());
  check(rec && rec.uid === SESSION.uid && rec.kategori === 'Apresiasi', 'record anggota menyimpan uid akun', rec);
  check(issues.length === 0, 'tanpa error (sesi masuk)', issues);
  await ctx.close();
}

/* --- config contact values present → rows, links, maps iframe, alt links --- */
{
  const ctx = await newCtx();
  await ctx.route('**/assets/js/config.js', async route => {
    const res = await route.fetch();
    let body = await res.text();
    body = body.replace(/contact:\s*\{[\s\S]*?hours:\s*\[\]\s*\}/, `contact: { address: 'Jl. Uji Coba No. 1', city: 'Kota Uji 12345', mapsQuery: 'Monas, Jakarta', phone: '+62 21 0000 0000', whatsapp: '+6281200000000', email: 'uji@contoh.id', hours: [{ hari: 'Senin – Jumat', jam: '08.00 – 16.00 WIB' }] }`)
      .replace(/instagram:\s*''/, "instagram: 'https://instagram.com/contoh'");
    await route.fulfill({ response: res, body, headers: { ...res.headers(), 'content-type': 'text/javascript; charset=utf-8' } });
  });
  await ctx.route('https://www.google.com/maps**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>peta</title><body style="background:#ddd"></body>' }));
  const page = await ctx.newPage();
  const issues = watch(page, 'ub-config');
  await page.goto(`${BASE}/umpan-balik.html`, { waitUntil: 'networkidle' });
  const office = page.locator('[data-ub-office]');
  check((await office.textContent()).includes('Jl. Uji Coba No. 1') && (await office.textContent()).includes('Kota Uji 12345'), 'alamat + kota tampil dari config');
  check(await office.locator('a[href="tel:+622100000000"]').count() === 1, 'telepon → tautan tel:');
  check(await office.locator('a[href="https://wa.me/6281200000000"][target="_blank"][rel="noopener"]').count() === 1, 'WhatsApp → wa.me (tab baru, noopener)');
  check(await office.locator('a[href="mailto:uji@contoh.id"]').count() === 1, 'email → mailto:');
  check((await office.textContent()).includes('08.00 – 16.00 WIB'), 'jam layanan tampil');
  check(await office.locator('.ub-office__note').count() === 0, 'catatan "akan dicantumkan" tidak tampil bila kontak ada');
  const iframe = office.locator('.ub-map iframe');
  check(await iframe.count() === 1 && (await iframe.getAttribute('src')).startsWith('https://www.google.com/maps?q=Monas%2C%20Jakarta&output=embed')
    && await iframe.getAttribute('loading') === 'lazy' && !!(await iframe.getAttribute('title')), 'mapsQuery → iframe Google Maps (lazy, title)');
  const filt = await page.evaluate(() => getComputedStyle(document.querySelector('.ub-map iframe')).filter);
  check(filt.includes('grayscale'), 'peta grayscale', filt);
  check(await office.locator('a[aria-label^="Instagram"]').count() === 1, 'media sosial tampil bila ada');
  check(await page.locator('[data-ub-alt]').isVisible() && await page.locator('[data-ub-alt] a').count() === 2, 'tautan alternatif WhatsApp/Email tampil');
  const tall = await page.evaluate(() => document.querySelector('.ub-office').offsetHeight);
  check((tall + 124 > 900) === !(await page.locator('[data-ub-aside].is-sticky').count()), 'kartu tinggi (kontak lengkap) tidak dibuat lengket bila melebihi layar', tall);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('.ub-office').screenshot({ path: path.join(SHOTS, 'ubflow-office-filled.png') });
  check(issues.length === 0, 'tanpa error (kontak terisi)', issues);
  await ctx.close();
}

/* --- mobile layout --- */
{
  const ctx = await newCtx({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const issues = watch(page, 'ub-mobile');
  await page.goto(`${BASE}/umpan-balik.html`, { waitUntil: 'networkidle' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 1, 'mobile: tanpa overflow horizontal', overflow);
  const rows = await page.$$eval('.ub-seg .segmented__option', els => els.map(e => Math.round(e.getBoundingClientRect().top)));
  check(new Set(rows).size === 2 && rows[0] === rows[2] && rows[3] === rows[4], 'mobile: kategori tersusun 3 + 2', rows);
  const minH = await page.$$eval('.ub-seg .segmented__option, .rating__stars > label, .check', els => Math.min(...els.map(e => e.getBoundingClientRect().height)));
  check(minH >= 32, 'mobile: target sentuh kategori/bintang/centang memadai', minH);
  await page.click('[data-ub-submit]');
  await shot(page, 'mobile-errors', { fullPage: false });
  check(issues.length === 0, 'tanpa error (mobile)', issues);
  await ctx.close();
}

/* =====================================================================
   B) KEBIJAKAN PRIVASI
   ===================================================================== */
console.log('\nB) kebijakan-privasi.html');
{
  const ctx = await newCtx();
  const page = await ctx.newPage();
  const issues = watch(page, 'kp');
  await page.goto(`${BASE}/kebijakan-privasi.html`, { waitUntil: 'networkidle' });
  const hrefs = await page.$$eval('[data-kp-toc] a[href^="#"]', as => as.map(a => a.getAttribute('href')));
  const ids = await page.$$eval('.kp-section[id]', s => s.map(x => '#' + x.id));
  check(hrefs.length === 13 && JSON.stringify(hrefs) === JSON.stringify(ids), 'daftar isi 13 tautan = 13 bagian (urutan sama)', { hrefs, ids });
  check(await page.locator('h1').count() === 1, 'satu h1');
  check((await page.textContent('main')).includes('Terakhir diperbarui: 9 Oktober 2026'), '"Terakhir diperbarui: 9 Oktober 2026" (kebijakan diperbarui untuk v2)');
  check(await page.locator('a[href="https://peraturan.bpk.go.id/Details/229798"][rel="noopener"]').count() === 1, 'tautan UU 27/2022 (BPK, noopener)');
  check(await page.locator('.kp-aside').isVisible() && await page.locator('.kp-toc-mobile').isHidden(), 'desktop: daftar isi lengket tampil, versi ponsel tersembunyi');
  await page.click('[data-kp-toc] a[href="#hak"]');
  await page.waitForTimeout(400);
  check(await page.getAttribute('[data-kp-toc] a[href="#hak"]', 'aria-current') === 'location', 'scroll-spy: "Hak Subjek Data" aktif setelah diklik');
  const asideTop = await page.evaluate(() => document.querySelector('.kp-aside').getBoundingClientRect().top);
  check(asideTop > 60 && asideTop < 200, 'daftar isi tetap lengket di viewport', asideTop);
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(300);
  check(await page.getAttribute('[data-kp-toc] a[href="#kontak"]', 'aria-current') === 'location', 'scroll-spy: bagian terakhir aktif di dasar halaman');
  await page.evaluate(() => document.getElementById('penyimpanan').scrollIntoView());
  await page.waitForTimeout(300);
  await shot(page, 'kp-desktop-sticky');
  check(issues.length === 0, 'tanpa error', issues);
  await ctx.close();
}
{
  const ctx = await newCtx({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const issues = watch(page, 'kp-mobile');
  await page.goto(`${BASE}/kebijakan-privasi.html`, { waitUntil: 'networkidle' });
  check(await page.locator('.kp-aside').isHidden() && await page.locator('.kp-toc-mobile').isVisible(), 'mobile: daftar isi <details> tampil');
  await page.click('.kp-toc-mobile summary');
  check(await page.evaluate(() => document.querySelector('.kp-toc-mobile').open), 'mobile: daftar isi terbuka');
  await page.click('.kp-toc-mobile a[href="#cookie"]');
  await page.waitForTimeout(300);
  check(!(await page.evaluate(() => document.querySelector('.kp-toc-mobile').open)) && page.url().endsWith('#cookie'), 'mobile: memilih tautan menutup daftar isi & menuju #cookie');
  const top = await page.evaluate(() => document.getElementById('cookie').getBoundingClientRect().top);
  check(top >= 50 && top < 160, 'judul bagian tidak tertutup header', top);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 1, 'mobile: tanpa overflow horizontal', overflow);
  check(issues.length === 0, 'tanpa error (mobile)', issues);
  await ctx.close();
}

/* =====================================================================
   C) 404
   ===================================================================== */
console.log('\nC) 404.html');
async function check404(page, url, expectBase, label) {
  const requests = [];
  page.on('request', r => requests.push(r.url()));
  const resp = await page.goto(url, { waitUntil: 'networkidle' });
  check(resp.status() === 404 || url.endsWith('/404.html'), `${label}: status ${resp.status()}`);
  const info = await page.evaluate(() => ({
    base: document.querySelector('base') && document.querySelector('base').getAttribute('href'),
    baseURI: document.baseURI,
    bg: getComputedStyle(document.body).backgroundColor,
    font: getComputedStyle(document.querySelector('.nf__digits')).fontFamily,
    header: !!document.querySelector('.site-header .brand'),
    footer: !!document.querySelector('.site-footer'),
    ppapi: !!(window.PPAPI && window.PPAPI.isReady && window.PPAPI.isReady()),
    authMode: window.PPAPI && window.PPAPI.auth && window.PPAPI.auth.mode,
    navHref: document.querySelector('.site-nav__link') && document.querySelector('.site-nav__link').href,
    homeHref: document.querySelector('.nf__actions a').href,
    logo: document.querySelector('.brand__logo') && document.querySelector('.brand__logo').complete && document.querySelector('.brand__logo').naturalWidth,
    path: document.querySelector('[data-nf-path]').textContent,
    h1: document.querySelectorAll('h1').length
  }));
  const origin = new URL(url).origin;
  check(info.base === expectBase, `${label}: <base href="${expectBase}">`, info.base);
  check(info.bg === 'rgb(10, 10, 11)', `${label}: main.css + 404.css termuat (latar gelap)`, info.bg);
  check(info.header && info.footer && info.ppapi && info.authMode === 'demo', `${label}: core/auth termuat — header & footer tampil`, info);
  check(info.logo > 0, `${label}: logo header termuat dari akar situs`);
  check(info.navHref === origin + expectBase + 'index.html' && info.homeHref === origin + expectBase + 'index.html', `${label}: tautan menuju ${expectBase}index.html`, { nav: info.navHref, home: info.homeHref });
  const nested = new URL(url).pathname.replace(/[^/]*$/, '');
  const wrong = nested !== expectBase ? requests.filter(u => u.startsWith(origin + nested + 'assets/')) : [];
  check(wrong.length === 0, `${label}: tidak ada permintaan aset ke folder bertingkat yang salah`, wrong);
  check(info.h1 === 1, `${label}: satu h1`);
  return info;
}
{
  const ctx = await newCtx();
  const page = await ctx.newPage();
  const issues = watch(page, '404');
  await check404(page, `${BASE}/does/not/exist.html`, '/', '/does/not/exist.html');
  check((await page.textContent('[data-nf-path]')) === '/does/not/exist.html' && await page.locator('[data-nf-path-row]').isVisible(), 'alamat yang diminta ditampilkan');
  // skip link must stay on this page (with <base>, "#main" would otherwise resolve to the site root)
  const before = page.url();
  await page.keyboard.press('Tab');
  check(await page.evaluate(() => document.activeElement.classList.contains('skip-link')), 'Tab pertama → skip link');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  check(page.url() === before && await page.evaluate(() => document.activeElement.id) === 'main', 'skip link memfokuskan <main> tanpa berpindah halaman');
  await shot(page, '404-desktop');
  await page.click('.nf__actions a.btn--primary');
  await page.waitForLoadState('domcontentloaded');
  check(page.url() === `${BASE}/index.html`, '"Kembali ke Beranda" → /index.html', page.url());
  const p2 = await ctx.newPage();
  const issues2 = watch(p2, '404-abc');
  await check404(p2, `${BASE}/a/b/c`, '/', '/a/b/c');
  const p3 = await ctx.newPage();
  const issues3 = watch(p3, '404-root');
  await check404(p3, `${BASE}/404.html`, '/', '/404.html');
  check(await p3.locator('[data-nf-path-row]').isHidden(), '/404.html langsung: baris alamat disembunyikan');
  const all = [...issues, ...issues2, ...issues3].filter(i => !/status of 404 \(Not Found\)/.test(i));
  check(all.length === 0, 'tanpa error selain status 404 dokumen itu sendiri', all);
  await ctx.close();
}
/* simulated GitHub Pages project site: https://ppapi-uji.github.io/ppapi/… */
{
  const ctx = await newCtx({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  await ctx.route('https://ppapi-uji.github.io/**', route => {
    const p = decodeURIComponent(new URL(route.request().url()).pathname);
    if (!p.startsWith('/ppapi/')) return route.fulfill({ status: 404, contentType: 'text/html', body: 'GitHub 404' });
    const r = serveFile(p.slice('/ppapi'.length));
    return route.fulfill({ status: r.status, contentType: r.type, body: r.body });
  });
  const page = await ctx.newPage();
  const issues = watch(page, 'gh');
  await check404(page, 'https://ppapi-uji.github.io/ppapi/a/b/c', '/ppapi/', 'GitHub /ppapi/a/b/c');
  const css = await page.evaluate(() => [...document.styleSheets].map(s => s.href).filter(Boolean));
  check(css.includes('https://ppapi-uji.github.io/ppapi/assets/css/main.css') && css.includes('https://ppapi-uji.github.io/ppapi/assets/css/pages/404.css'), 'GitHub: stylesheet dari /ppapi/assets/…', css);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  check(overflow <= 1, 'GitHub (mobile): tanpa overflow horizontal', overflow);
  await shot(page, '404-github-mobile');
  const real = issues.filter(i => !/status of 404 \(Not Found\)/.test(i) && !/fonts\./.test(i));
  check(real.length === 0, 'GitHub: tanpa error selain status 404 dokumen', real);
  await ctx.close();
}
/* motion: the missing brace appears after the scaffold draws */
{
  const ctx = await newCtx({ reducedMotion: 'no-preference' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/x/y`, { waitUntil: 'networkidle' });
  const early = await page.evaluate(() => getComputedStyle(document.querySelector('.nf-missing')).opacity);
  await page.waitForTimeout(3600);
  const late = await page.evaluate(() => ({ dash: getComputedStyle(document.querySelector('.nf-missing')).opacity, bay: document.querySelector('.nf__bay').classList.contains('is-visible') }));
  check(late.bay && Number(late.dash) > 0.5, 'motion: rangka tergambar, pengaku hilang muncul setelahnya', { early, late });
  await shot(page, '404-motion');
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\n${passed} lulus, ${failed} gagal.`);
if (failed) process.exitCode = 1;
