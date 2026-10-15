// Interaction flow for pustaka.html (Produk Pengetahuan, SPEC-v2 §4.3).
// Run from devtools/:  node flows/pustaka-flow.mjs [--shots] [--only=desktop|mobile]
// Serves ../site, drives the page on desktop (1440) and mobile (390) in every access state:
//   signed out (locked) · active member (unlocked) · Draf / Menunggu Verifikasi / Kedaluwarsa (locked,
//   status CTA) · admin (unlocked + managed content) · config.pustaka.katalogPublik = false
// and asserts tiles, toolbar (search / chips / status / sort / view) with URL sync, shelves, detail
// modal, access logic (store.pustaka.fileUrl), app cards, XSS escaping and in-place session changes.
// --shots saves full-page screenshots (lazy images scrolled in) to devtools/shots/pkflow-*.png.
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
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

/* fixtures = check.mjs --auth / --status / --admin */
const USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
function member(status) {
  const m = {
    uid: USER.uid, name: USER.name, email: USER.email, phone: USER.phone,
    kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31',
    approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001',
    profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Contoh Konstruksi', position: 'Scaffolding Supervisor', experienceYears: 9 },
    competencies: [], certificates: [], updatedAt: '2026-09-30T08:00:00.000Z',
    application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z', updatedAt: '2026-03-15T02:00:00.000Z', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: USER.name, tanggal: '2026-03-15' }, catatan: '' },
    review: { note: '', history: [] },
  };
  if (status === 'Kedaluwarsa') m.validUntil = '2026-06-30';
  else if (status && status !== 'Aktif') {
    m.status = status; m.kta = ''; m.validUntil = ''; m.approvedAt = ''; m.approvedBy = '';
    if (status === 'Draf') m.application.submittedAt = '';
  }
  return m;
}
const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log('  ✓ ' + label); } else { fail++; console.log('  ✗ ' + label); } };

const browser = await chromium.launch();
const VPS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
].filter(v => !ONLY || v.name === ONLY);

/* 2026-10-15: the static catalogue (assets/data/pustaka.js) holds only the two member apps — the sample drafts were
   removed. This flow seeds the same ten draft documents as ADMIN-MANAGED content (Konsol Admin › Konten › Produk
   Pengetahuan writes ppapi_content_pustaka), flagged contoh:true, so the catalogue UI — collections, shelves, locks,
   Contoh badges, modals, sorting — is still exercised with a full catalogue. The empty catalogue is covered separately. */
const DOC_META = { updatedAt: '2026-10-01T00:00:00.000Z', updatedBy: 'demo-admin-0001' };
const doc = (id, judul, kategori, kode, ringkasan, akses, tag) => Object.assign({ id, judul, kategori, kode, versi: 'Rancangan', tanggal: '', status: 'Dalam Penyusunan', ringkasan, penyusun: 'Tim Penyusun PPAPI', format: 'PDF', halaman: '', akses, tautan: '', tag, app: '', contoh: true }, DOC_META);
const DOCS = [
  doc('standar-kompetensi-ppapi', 'Standar Kompetensi Praktisi dan Ahli Perancah PPAPI (Rancangan)', 'Standar', 'PPAPI-STD-01', 'Rancangan jenjang kompetensi anggota beserta unit kompetensi dan bukti yang dipersyaratkan.', 'publik', ['kompetensi', 'jenjang']),
  doc('cop-pemasangan-tube-coupler', 'Code of Practice Pemasangan Perancah Tube & Coupler', 'Code of Practice', 'PPAPI-CoP-01', 'Pedoman praktik baik pemasangan dan pembongkaran perancah pipa dan klem.', 'anggota', ['tube & coupler', 'pemasangan']),
  doc('cop-inspeksi-penandaan', 'Code of Practice Inspeksi dan Penandaan Perancah (Scafftag)', 'Code of Practice', 'PPAPI-CoP-02', 'Tata cara inspeksi dan penandaan status perancah hijau, kuning, merah.', 'anggota', ['inspeksi', 'scafftag']),
  doc('pt-perancah-pekerjaan-ketinggian', 'Petunjuk Teknis Penggunaan Perancah pada Pekerjaan di Ketinggian', 'Petunjuk Teknis', 'PPAPI-PT-01', 'Petunjuk penerapan perancah sebagai sarana kerja di ketinggian.', 'anggota', ['bekerja di ketinggian']),
  doc('pt-perancah-sistem', 'Petunjuk Teknis Perancah Sistem (Ringlock dan Cuplock)', 'Petunjuk Teknis', 'PPAPI-PT-02', 'Petunjuk perakitan dan batasan penggunaan perancah sistem modular jenis ringlock dan cuplock.', 'anggota', ['ringlock', 'cuplock']),
  doc('modul-teknisi-perancah-dasar', 'Modul Pelatihan Teknisi Perancah Tingkat Dasar', 'Modul Pelatihan', 'PPAPI-MP-01', 'Materi pelatihan bagi teknisi pemula.', 'anggota', ['pelatihan', 'teknisi']),
  doc('modul-inspektur-perancah', 'Modul Pelatihan Inspektur Perancah', 'Modul Pelatihan', 'PPAPI-MP-02', 'Materi bagi calon inspektur: metode inspeksi berbasis elemen.', 'anggota', ['pelatihan', 'inspektur']),
  doc('panduan-aplikasi-anggota', 'Panduan Penggunaan Aplikasi PPAPI Scaffold dan Simulator Tube & Coupler', 'Modul Pelatihan', 'PPAPI-MP-03', 'Panduan langkah demi langkah memakai aplikasi anggota.', 'anggota', ['panduan', 'aplikasi']),
  doc('formulir-daftar-periksa-inspeksi', 'Formulir Daftar Periksa Inspeksi Perancah', 'Formulir & Daftar Periksa', 'PPAPI-FR-01', 'Rancangan formulir cetak daftar periksa inspeksi.', 'anggota', ['formulir', 'daftar periksa']),
  doc('kajian-kapasitas-klem', 'Kajian Teknis Kapasitas Sambungan Klem pada Perancah Tube & Coupler', 'Kajian Teknis', 'PPAPI-KT-01', 'Kajian tentang jenis klem dan kapasitas sambungan.', 'anggota', ['klem', 'kapasitas']),
];
async function newCtx(vp, { status, admin, extra, katalogTertutup, noDocs } = {}) {
  const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1, reducedMotion: 'reduce', locale: 'id-ID' });
  if (!noDocs) {
    await ctx.addInitScript(docs => {
      try { if (!sessionStorage.getItem('__pk_docs')) { sessionStorage.setItem('__pk_docs', '1'); localStorage.setItem('ppapi_content_pustaka', JSON.stringify(docs)); } } catch (e) {}
    }, DOCS);
  }
  if (status) {
    await ctx.addInitScript(({ u, m }) => {
      try {
        if (!localStorage.getItem('ppapi_demo_session') && !sessionStorage.getItem('__pk_seeded')) {
          sessionStorage.setItem('__pk_seeded', '1');
          localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
          const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
          users[u.email] = { uid: u.uid, name: u.name, email: u.email, phone: u.phone, provider: u.provider, createdAt: u.createdAt, hash: 'x' };
          localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
          localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
        }
      } catch (e) {}
    }, { u: USER, m: member(status) });
  }
  if (admin) {
    await ctx.addInitScript(({ a }) => {
      try {
        if (!localStorage.getItem('ppapi_demo_session') && !sessionStorage.getItem('__pk_seeded')) {
          sessionStorage.setItem('__pk_seeded', '1');
          localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
        }
        const admins = JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]');
        if (!admins.includes(a.uid)) { admins.push(a.uid); localStorage.setItem('ppapi_demo_admins', JSON.stringify(admins)); }
      } catch (e) {}
    }, { a: ADMIN });
  }
  if (extra) await ctx.addInitScript(extra);
  if (katalogTertutup) {
    await ctx.route('**/assets/js/config.js', async route => {
      // same as the test server: blank the Firebase apiKey so the page stays in Mode Demo (a live Firestore channel never reaches networkidle)
      const body = fs.readFileSync(path.join(ROOT, 'assets/js/config.js'), 'utf8').replace(/katalogPublik:[ \t]*true(?=[ \t]*\r?\n)/, 'katalogPublik: false').replace(/apiKey:\s*'[^']*'/, "apiKey: ''");
      await route.fulfill({ status: 200, contentType: 'text/javascript; charset=utf-8', body });
    });
  }
  return ctx;
}

/* --axe: axe-core scan of the main states (needs internet for the axe script) */
let AXE = '';
if (process.argv.includes('--axe')) {
  try { AXE = await (await fetch('https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js')).text(); }
  catch (e) { console.log('  INFO axe-core could not be downloaded — axe checks skipped'); }
}
async function axeScan(page, label) {
  if (!AXE) return;
  await page.addScriptTag({ content: AXE });
  const v = await page.evaluate(async () => (await window.axe.run(document, { resultTypes: ['violations'] })).violations
    .map(x => `${x.id} (${x.impact}) ×${x.nodes.length}: ${x.nodes.slice(0, 2).map(n => n.target.join(' ')).join(' | ')}`));
  ok(v.length === 0, `axe ${label}: 0 violations` + (v.length ? ' — ' + v.join(' ; ') : ''));
}

for (const vp of VPS) {
  console.log(`\n=== ${vp.name} ===`);
  const errors = [];
  const watch = (page, tag) => {
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(`${tag} ${m.type()}: ${m.text()}`); });
    page.on('pageerror', e => errors.push(`${tag} pageerror: ${e.message}`));
  };
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const click = async (page, sel) => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.click(); };
  const open = async (ctx, q = '', tag = '') => {
    const page = await ctx.newPage(); watch(page, tag || q);
    await page.goto(`${BASE}/pustaka.html${q}`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady());
    await page.waitForTimeout(150);
    return page;
  };
  const fullshot = async (page, name) => {
    if (!SAVE) return;
    await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); } window.scrollTo(0, 0); });
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, `pkflow-${name}-${vp.name}.png`), fullPage: true });
  };
  const shot = async (page, name) => { if (SAVE) await page.screenshot({ path: path.join(SHOTS, `pkflow-${name}-${vp.name}.png`) }); };
  const cards = (page) => page.locator('[data-pk="results"] [data-pk-open]').count();
  /* phones: Status, Urutkan and Tampilan sit behind the "Saring" toggle */
  const saring = async (page) => {
    const t = page.locator('[data-pk="saring-toggle"]');
    if (await t.isVisible() && (await t.getAttribute('aria-expanded')) !== 'true') { await t.click(); await page.waitForTimeout(80); }
  };

  /* ------------------------------------------------------------------ */
  console.log('-- signed out, katalog kosong (data bawaan: hanya dua aplikasi)');
  let ctx = await newCtx(vp, { noDocs: true });
  let page = await open(ctx, '', 'empty');
  const emptyTiles = await page.locator('.pk-tile__num').evaluateAll(els => els.map(e => parseInt(e.textContent, 10)));
  ok(JSON.stringify(emptyTiles) === JSON.stringify([9, 0, 19, 0, 0, 0, 0, 2]), `empty catalogue: tiles = ${emptyTiles.join(',')} (9 standards + 19 regulations from regulasi.js, 2 apps)`);
  ok(await page.locator('.pk-tile.is-empty').count() === 5 && (await page.locator('.pk-tile.is-empty .pk-tile__unit').allTextContents()).every(t => /^Belum ada/.test(t)), 'five empty collections say "Belum ada dokumen" (no PPAPI document published yet)');
  ok(await page.locator('.pk-shelf').count() === 2 && await page.locator('.badge--contoh').count() === 0 && await page.locator('[data-pk="note"]').isHidden(), 'only Standar + Peraturan shelves; no Contoh badge, Contoh note hidden');
  ok(!/\(contoh\)/.test(await page.locator('[data-pk="hero-meta"]').textContent()), 'hero meta no longer mentions sample drafts');
  ok((await page.locator('[data-pk="count"]').textContent()).includes('28') && !/Contoh/.test(await page.locator('[data-pk="count"]').textContent()), 'count line: 28 documents (regulations + standards), no "bertanda Contoh"');
  ok(await page.locator('.pk-app').count() === 2, '2 featured app cards still present');
  ok(await overflow(page) <= 1, 'no horizontal overflow (empty catalogue)');
  await fullshot(page, 'empty');
  await page.close();
  await ctx.close();

  console.log('-- signed out (katalog publik, isi terkunci; dokumen kelolaan admin)');
  ctx = await newCtx(vp);
  page = await open(ctx, '', 'out');
  ok(await page.locator('h1').count() === 1, 'one h1');
  ok(await page.locator('.pk-tile').count() === 8, '8 collection tiles');
  const tileNums = await page.locator('.pk-tile__num').evaluateAll(els => els.map(e => parseInt(e.textContent, 10)));
  ok(JSON.stringify(tileNums) === JSON.stringify([10, 2, 19, 2, 3, 1, 1, 2]), `tile counts Standar…Aplikasi = ${tileNums.join(',')}`);
  ok((await page.locator('.pk-tile').nth(7).getAttribute('href')) === '#aplikasi', 'Aplikasi tile → #aplikasi');
  ok((await page.locator('[data-pk="hero-meta"]').textContent()).includes('Isi khusus anggota Aktif'), 'hero meta: content locked');
  ok(await page.locator('.pk-lockbar').isVisible(), 'access bar = ui.locked panel');
  const masukHref = await page.locator('.pk-lockbar a.btn--primary').getAttribute('href');
  ok(masukHref === 'masuk.html?next=pustaka.html', `locked CTA → masuk.html?next=pustaka.html (${masukHref})`);
  ok((await page.locator('.pk-lockbar a.btn--ghost').getAttribute('href')) === 'masuk.html?next=pendaftaran.html#daftar', 'second CTA → Daftar Anggota');
  ok(await page.locator('.pk-shelf').count() === 7, '7 shelves (catalog order, apps in their own section)');
  ok((await page.locator('[data-pk="count"]').textContent()).includes('38'), 'count line: 38 documents');
  const CAP = vp.name === 'desktop' ? 3 : 2;
  ok(await page.locator('.pk-shelf[data-kat="Standar"] [data-pk-open]').count() === CAP, `Standar shelf capped at ${CAP} cards (one row; two stacked on a phone)`);
  /* one index: the tiles carry the collection descriptions, the shelves only a condensed rule line */
  ok(await page.locator('.pk-tile__desc').count() === 8 && await page.locator('.pk-shelf__desc').count() === 0, 'collection descriptions only on the tiles (shelf heads condensed)');
  const heroMeta = (await page.locator('[data-pk="hero-meta"]').textContent()).replace(/\s+/g, ' ');
  ok(/10 rancangan PPAPI \(contoh\)/.test(heroMeta) && !/10 dokumen PPAPI/.test(heroMeta), `hero counts sample drafts as such (${heroMeta.slice(0, 80)})`);
  ok((await page.locator('.pk-tile').nth(0).locator('.pk-tile__split').textContent()).includes('1 rancangan PPAPI · 9 SNI & internasional'), 'Standar tile says what the 10 are made of');
  ok(await page.locator('.pk-tile').nth(1).locator('.pk-tile__num .badge--contoh').count() === 1 && /rancangan/.test(await page.locator('.pk-tile').nth(1).locator('.pk-tile__num small').textContent()), 'all-sample tile: "rancangan" + Contoh badge');
  ok(await page.locator('.pk-tile').nth(2).locator('.badge--contoh').count() === 0, 'regulation tile: no Contoh badge');
  if (vp.name !== 'desktop') {
    ok(await page.locator('#pk-status').isHidden() && (await page.locator('[data-pk="saring-toggle"]').getAttribute('aria-expanded')) === 'false', 'phone: Status/Urutkan/Tampilan folded behind "Saring"');
    await saring(page);
    ok(await page.locator('#pk-status').isVisible() && await page.locator('#pk-sort').isVisible() && await page.locator('[data-pk="view"]').isVisible(), 'phone: "Saring" reveals Status, Urutkan and Tampilan');
  }
  ok((await page.locator('.pk-shelf[data-kat="Peraturan Perundangan"] [data-pk-open]').first().textContent()).includes('Keselamatan Kerja'), 'Peraturan shelf starts with UU 1/1970 (key regulations first)');
  ok(await page.locator('.pk-shelf[data-kat="Peraturan Perundangan"] .badge', { hasText: 'Kunci' }).count() === CAP, `all ${CAP} shown regulations are "Kunci" in the overview`);
  await click(page, '[data-pk-more="Standar"]');
  await page.waitForTimeout(150);
  ok(await page.locator('.pk-shelf[data-kat="Standar"] [data-pk-open]').count() === 10, '"Tampilkan lainnya" → 10 Standar cards');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.matches('[data-pk-open]')), 'focus moves to the first newly shown item');
  const cop = page.locator('[data-key="d:cop-pemasangan-tube-coupler"]');
  ok(await cop.evaluate(e => e.classList.contains('doc-card--locked')), 'member-only document card is locked');
  ok((await cop.locator('.doc-card__access').textContent()).includes('Terkunci'), 'locked access label "Terkunci"');
  ok(await cop.locator('.badge--contoh').count() === 1, 'sample document carries the Contoh badge');
  ok(await page.locator('[data-key="r:uu-1-1970"] .badge--contoh').count() === 0, 'regulations carry no Contoh badge');
  ok(await page.locator('[data-pk="note"]').isVisible(), 'Contoh explanation note visible');
  ok(await page.locator('a[href^="aplikasi/"]').count() === 0, 'no app link rendered for a signed-out visitor');
  ok(await page.locator('.pk-app').count() === 2, '2 featured app cards');
  ok(await page.locator('.pk-app.doc-card--locked').count() === 2, 'both app cards locked');
  ok(await page.locator('.pk-app .pk-app__actions a[href^="masuk.html"]').count() >= 2, 'app cards offer Masuk');
  ok((await page.locator('[data-pk="cta"]').textContent()).includes('Buka seluruh'), 'CTA band invites to unlock');
  ok(await overflow(page) <= 1, 'no horizontal overflow');
  await fullshot(page, 'out');
  await axeScan(page, 'signed out');

  // detail modal (locked)
  await click(page, '[data-pk-open="d:cop-inspeksi-penandaan"]');
  await page.waitForSelector('.modal .modal__dialog');
  ok((await page.locator('.modal__title').textContent()).includes('Inspeksi dan Penandaan'), 'modal title = document title');
  ok(await page.locator('.modal .locked').isVisible(), 'modal shows ui.locked for a non-active viewer');
  ok((await page.locator('.modal .locked__text').textContent()).trim() === 'Dokumen ini dapat dibuka oleh anggota berstatus Aktif.', 'modal lock copy is item-level, not the page-level text');
  ok(await page.locator('.modal .kv__row dt', { hasText: /^Status$/ }).count() === 0 && await page.locator('.modal .pk-modal__badges .badge', { hasText: 'Dalam Penyusunan' }).count() === 1, 'status shown once (badge), no Status row');
  ok(await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('modal__title'), null, { timeout: 2000 }).then(() => true, () => false), 'modal opens with focus on its title, not on "Tutup"');
  ok(/Inspeksi dan Penandaan.*\(Contoh\) — Produk Pengetahuan PPAPI$/.test(await page.title()), `document title follows the open document (${await page.title()})`);
  ok((await page.locator('meta[property="og:title"]').getAttribute('content')) === await page.title(), 'og:title follows the open document');
  const dsc = await page.locator('meta[name="description"]').getAttribute('content');
  ok(dsc.length <= 160 && !dsc.startsWith('Produk Pengetahuan PPAPI:') && dsc === await page.locator('meta[property="og:description"]').getAttribute('content'), 'description/og:description from the document summary');
  ok(await page.locator('.modal .locked a[href^="masuk.html"]').count() >= 1, 'modal lock CTA → masuk');
  ok(await page.locator('.modal a[target="_blank"]').count() === 0, 'no document link leaks for locked viewer');
  ok(page.url().includes('id=cop-inspeksi-penandaan'), 'URL synced with ?id=');
  await shot(page, 'modal-locked');
  await axeScan(page, 'locked modal');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  ok(await page.locator('.modal').count() === 0, 'Esc closes the modal');
  ok(!page.url().includes('id='), '?id= removed on close');
  ok((await page.title()) === 'Produk Pengetahuan — PPAPI' && (await page.locator('meta[name="description"]').getAttribute('content')).startsWith('Produk Pengetahuan PPAPI:'), 'title and description restored on close');
  ok(await page.waitForFunction(() => document.activeElement && document.activeElement.getAttribute('data-pk-open') === 'd:cop-inspeksi-penandaan', null, { timeout: 2500 }).then(() => true, () => false), 'focus returns to the card title');

  // regulation modal: public official link
  await click(page, '[data-pk-open="r:uu-1-1970"]');
  await page.waitForSelector('.modal .modal__dialog');
  const offLink = page.locator('.modal a[target="_blank"]').first();
  ok((await offLink.getAttribute('href')) === 'https://peraturan.bpk.go.id/Details/47614', 'regulation modal → official text (public)');
  ok((await offLink.getAttribute('rel')).includes('noopener'), 'external link rel=noopener');
  ok((await page.locator('.modal .pk-modal__reglink').getAttribute('href')) === 'regulasi.html?q=UU%201%2F1970', 'link to the regulation in regulasi.html');
  ok(await page.locator('.modal__title[lang]').count() === 0, 'Indonesian regulation title: no lang override');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  // WCAG 3.1.2 Language of Parts: English titles of international standards carry lang="en"
  const langs = await page.evaluate(() => [...document.querySelectorAll('[data-pk="results"] [data-pk-open^="r:"]')].map(b => [b.getAttribute('data-pk-open'), b.getAttribute('lang') || '']));
  const intlL = langs.filter(([k]) => /^r:(en-|nasc|osha|as-)/.test(k));
  ok(intlL.length > 0 && intlL.every(([, l]) => l === 'en') && langs.filter(([k]) => /^r:(uu|pp|permen|sni)/.test(k)).every(([, l]) => l === ''), `international titles lang="en" (${intlL.length}), national ones none`);

  // search + highlight + URL
  await page.fill('#pk-q', 'ringlock');
  await page.waitForTimeout(400);
  ok(await page.locator('[data-key="d:pt-perancah-sistem"]').count() === 1, 'search "ringlock" finds PPAPI-PT-02');
  ok(page.url().includes('q=ringlock'), 'URL synced with ?q=');
  ok(await page.locator('mark.pk-hl').count() > 0, 'matches highlighted');
  ok(!(await page.locator('[data-pk="reset"]').isHidden()), 'reset visible while filtered');
  await page.fill('#pk-q', 'simulator');
  await page.waitForTimeout(400);
  ok(await page.locator('[data-pk="apphint"]').isVisible(), 'search matching an app → app hint');
  ok(await page.locator('[data-pk="apphint"] a[href="#app-simulator"]').count() === 1, 'app hint links to the simulator card');
  await page.fill('#pk-q', 'zzzz tidak ada');
  await page.waitForTimeout(400);
  ok(await page.locator('[data-pk="empty"] .empty-state').isVisible(), 'empty state for no match');
  await click(page, '[data-pk-reset]');
  await page.waitForTimeout(150);
  ok(!page.url().includes('q='), 'reset clears ?q=');
  ok((await page.inputValue('#pk-q')) === '', 'reset clears the search box');

  // chips
  await click(page, '.chip[data-kat="Peraturan Perundangan"]');
  await page.waitForTimeout(150);
  ok(await cards(page) === 19, 'chip Peraturan Perundangan → 19 documents (uncapped)');
  ok(await page.locator('.pk-shelf').count() === 1, 'one shelf while a collection is selected');
  ok(page.url().includes('kategori=peraturan-perundangan'), 'URL synced with ?kategori=');
  await saring(page);
  await page.selectOption('#pk-status', 'Dicabut');
  await page.waitForTimeout(150);
  const nDic = await cards(page);
  ok(nDic >= 1 && await page.locator('[data-pk="results"] .badge', { hasText: 'Dicabut' }).count() === nDic, `status Dicabut → ${nDic} document(s), all Dicabut`);
  ok(page.url().includes('status=dicabut'), 'URL synced with ?status=');
  if (vp.name !== 'desktop') ok((await page.locator('[data-pk="saring-n"]').textContent()).startsWith('1'), 'phone: "Saring" shows 1 active setting');
  await page.selectOption('#pk-status', '');
  await click(page, '.chip[data-kat=""]');
  await page.waitForTimeout(150);

  // sort + view
  await page.selectOption('#pk-sort', 'terbaru');
  await page.waitForTimeout(150);
  ok(await page.locator('.pk-shelf').count() === 0 && await page.locator('.pk-flat').count() === 1, 'sort Terbaru → flat list');
  ok(await cards(page) === 38, 'flat list shows all 38');
  ok(page.url().includes('urut=terbaru'), 'URL synced with ?urut=');
  const firstYear = await page.locator('[data-pk="results"] .doc-card').first().locator('.doc-card__meta').textContent();
  ok(/2025|2026/.test(firstYear), `Terbaru starts with the newest dated item (${firstYear.trim().slice(0, 40)})`);
  await page.selectOption('#pk-sort', 'katalog');
  await click(page, '[data-pk="view"] [data-value="daftar"]');
  await page.waitForTimeout(150);
  ok(await page.locator('.pk-index .pk-row').count() > 0 && await page.locator('[data-pk="results"] .doc-card').count() === 0, 'view Daftar → index rows');
  ok(page.url().includes('tampilan=daftar'), 'URL synced with ?tampilan=');
  ok((await page.locator('[data-pk="view"] [data-value="daftar"]').getAttribute('aria-pressed')) === 'true', 'view toggle aria-pressed');
  await shot(page, 'list');
  await axeScan(page, 'list view');
  await page.goto(`${BASE}/pustaka.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  ok(await page.locator('.pk-index').count() > 0, 'list view remembered after reload');
  await saring(page);
  await click(page, '[data-pk="view"] [data-value="kisi"]');
  await page.waitForTimeout(100);

  // tile → filter
  await click(page, '.pk-tile[data-pk-kat="Code of Practice"]');
  await page.waitForTimeout(400);
  ok((await page.locator('.chip[data-kat="Code of Practice"]').getAttribute('aria-pressed')) === 'true', 'tile click selects the collection chip');
  ok(page.url().includes('kategori=code-of-practice'), 'tile click syncs ?kategori=');
  ok(await page.evaluate(() => { const r = document.getElementById('katalog').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }), 'tile click brings the catalog into view');
  await page.close();

  // deep links
  page = await open(ctx, '?kategori=standar&q=EN%2074', 'deep');
  ok((await page.inputValue('#pk-q')) === 'EN 74', 'deep link fills the search box');
  ok((await page.locator('.chip[data-kat="Standar"]').getAttribute('aria-pressed')) === 'true', 'deep link selects the chip');
  const nEn = await cards(page);
  ok(nEn >= 1 && nEn <= 3 && await page.locator('[data-key="r:en-74-1"]').count() === 1, `deep link → EN 74-1 among ${nEn} Standar match(es)`);
  await page.close();
  const X = encodeURIComponent('"><img src=x onerror="window.__pkq=1">');
  page = await open(ctx, `?q=${X}&kategori=${X}&status=${X}&urut=${X}&tampilan=${X}&id=${X}`, 'xss-url');
  ok(await page.evaluate(() => window.__pkq === undefined && !document.querySelector('[data-pk="results"] img[onerror], [data-pk="count"] img')), 'URL params are escaped (no XSS via ?q/kategori/status/id)');
  ok((await page.locator('[data-pk="count"]').textContent()).includes('<img'), 'query echoed as text in the count line');
  ok(await page.locator('.modal').count() === 0, 'unknown ?id= opens nothing');
  await page.close();
  page = await open(ctx, '?id=modul-inspektur-perancah', 'deep-id');
  await page.waitForSelector('.modal .modal__dialog');
  ok((await page.locator('.modal__title').textContent()).includes('Inspektur'), '?id= opens the document detail');
  await page.close();
  await ctx.close();

  /* ------------------------------------------------------------------ */
  console.log('-- active member (unlocked)');
  ctx = await newCtx(vp, {
    status: 'Aktif',
    extra: () => {
      try {
        if (sessionStorage.getItem('__pk_files')) return;
        sessionStorage.setItem('__pk_files', '1');
        // what store.content.save writes for a member-only file (admin console): public override + private link
        const cur = JSON.parse(localStorage.getItem('ppapi_content_pustaka') || '[]').filter(x => x.id !== 'cop-pemasangan-tube-coupler');
        cur.unshift({ id: 'cop-pemasangan-tube-coupler', judul: 'Code of Practice Pemasangan Perancah Tube & Coupler', kategori: 'Code of Practice', kode: 'PPAPI-CoP-01', versi: 'Revisi 0', tanggal: '2026-09-01', status: 'Berlaku', ringkasan: 'Pedoman praktik baik pemasangan dan pembongkaran perancah pipa dan klem.', penyusun: 'Tim Penyusun PPAPI', format: 'PDF', halaman: '48 halaman', akses: 'anggota', tautan: '', tag: ['tube & coupler'], app: '', contoh: true, berkasAnggota: true, updatedAt: '2026-10-01T00:00:00.000Z', updatedBy: 'demo-admin-0001' });
        localStorage.setItem('ppapi_content_pustaka', JSON.stringify(cur));
        localStorage.setItem('ppapi_pustaka_files', JSON.stringify({ 'cop-pemasangan-tube-coupler': 'https://example.com/ppapi-cop-01.pdf' }));
      } catch (e) {}
    }
  });
  page = await open(ctx, '', 'aktif');
  ok(await page.locator('.pk-lockbar').count() === 0, 'no lock panel for an active member');
  ok((await page.locator('.pk-granted').textContent()).includes('Anggota Aktif'), 'access strip: Akses penuh · Anggota Aktif');
  ok((await page.locator('.pk-granted').textContent()).replace(/ /g, ' ').includes('31 Desember 2029'), 'access strip mentions validity (date kept on one line)');
  ok((await page.locator('[data-pk="hero-meta"]').textContent()).includes('Akses penuh'), 'hero meta: full access');
  ok(await page.locator('[data-pk="results"] .doc-card--locked').count() === 0, 'no locked cards');
  ok((await page.locator('[data-key="d:cop-pemasangan-tube-coupler"] .doc-card__access').textContent()).includes('Dapat dibuka'), 'document with a member file → "Dapat dibuka"');
  ok((await page.locator('[data-key="d:cop-inspeksi-penandaan"] .doc-card__access').textContent()).includes('Belum terbit'), 'document still in preparation → "Belum terbit"');
  await click(page, '[data-pk-open="d:cop-pemasangan-tube-coupler"]');
  await page.waitForSelector('.modal .modal__dialog');
  await page.waitForSelector('.modal a.btn--primary', { timeout: 3000 }).catch(() => {});
  const docLink = page.locator('.modal a.btn--primary').first();
  ok((await docLink.getAttribute('href')) === 'https://example.com/ppapi-cop-01.pdf', 'modal "Buka Dokumen" uses store.pustaka.fileUrl (private link)');
  ok((await docLink.getAttribute('target')) === '_blank' && (await docLink.getAttribute('rel')).includes('noopener'), 'document opens in a new tab, rel=noopener');
  ok((await page.locator('.modal').textContent()).includes('1 September 2026'), 'modal shows the publication date');
  await shot(page, 'modal-open');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await click(page, '[data-pk-open="d:cop-inspeksi-penandaan"]');
  await page.waitForSelector('.modal .pk-modal__pending', { timeout: 3000 }).catch(() => {});
  ok(await page.locator('.modal .pk-modal__pending').isVisible(), 'no file yet → "Berkas belum tersedia" (honest pending state)');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  ok(await page.locator('.pk-app.doc-card--locked').count() === 0, 'app cards unlocked');
  ok((await page.locator('#app-perencanaan a.btn--primary').getAttribute('href')) === 'aplikasi/perencanaan/index.html', 'planning app → internal path');
  ok((await page.locator('#app-simulator a.btn--primary').getAttribute('href')) === 'aplikasi/simulator/index.html', 'simulator → internal path');
  ok(await page.locator('.pk-app a[target="_blank"]').count() === 0, 'apps open in the same tab (portal bar links back)');
  await click(page, '#app-simulator [data-pk-open]');
  await page.waitForSelector('.modal .modal__dialog');
  await page.waitForSelector('.modal a.btn--primary', { timeout: 3000 }).catch(() => {});
  ok((await page.locator('.modal a.btn--primary').getAttribute('href')) === 'aplikasi/simulator/index.html', 'app modal resolves the app path via fileUrl');
  ok(await page.locator('.modal .pk-modal__features li').count() === 4, 'app modal lists 4 features');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  ok((await page.locator('[data-pk="cta"]').textContent()).includes('usulan'), 'CTA: send a proposal');
  ok(await overflow(page) <= 1, 'no horizontal overflow');
  await fullshot(page, 'aktif');
  await axeScan(page, 'active member');

  // in-place session change: sign out → locked again without reload
  await page.evaluate(() => PPAPI.auth.signOut());
  await page.waitForTimeout(500);
  ok(page.url().includes('pustaka.html'), 'sign-out on a public page stays on pustaka');
  ok(await page.locator('.pk-lockbar').isVisible(), 'after sign-out the catalog locks in place');
  ok(await page.locator('a[href^="aplikasi/"]').count() === 0, 'app links removed after sign-out');
  await page.close();
  await ctx.close();

  /* ------------------------------------------------------------------ */
  for (const [st, cta, href, text] of [
    ['Draf', 'Lengkapi Pendaftaran', 'pendaftaran.html', 'Status keanggotaan Anda saat ini: Draf'],
    ['Menunggu Verifikasi', 'Lihat Status Pendaftaran', 'dashboard.html', 'sedang diverifikasi'],
    ['Kedaluwarsa', 'Ajukan Perpanjangan', 'pendaftaran.html', 'Kedaluwarsa'],
  ]) {
    console.log(`-- signed in, status ${st} (locked)`);
    ctx = await newCtx(vp, { status: st });
    page = await open(ctx, '', st);
    const bar = page.locator('.pk-lockbar');
    ok(await bar.isVisible(), `${st}: lock panel`);
    ok((await bar.textContent()).includes(text), `${st}: lock text explains the status`);
    ok((await bar.locator('a.btn--primary').textContent()).includes(cta) && (await bar.locator('a.btn--primary').getAttribute('href')) === href, `${st}: CTA "${cta}" → ${href}`);
    ok(await page.locator('[data-pk="results"] .doc-card--locked').count() > 0, `${st}: member documents locked`);
    ok(await page.locator('a[href^="aplikasi/"]').count() === 0, `${st}: no app links`);
    ok((await page.locator('#app-perencanaan .pk-app__actions').textContent()).includes(cta), `${st}: app card CTA "${cta}"`);
    await click(page, '[data-pk-open="d:modul-teknisi-perancah-dasar"]');
    await page.waitForSelector('.modal .locked');
    ok((await page.locator('.modal .locked a').first().getAttribute('href')) === href, `${st}: modal lock CTA → ${href}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    if (st === 'Draf') { await fullshot(page, 'draf'); await axeScan(page, 'Draf'); }
    await page.close();
    await ctx.close();
  }

  /* ------------------------------------------------------------------ */
  console.log('-- admin (unlocked + managed content)');
  ctx = await newCtx(vp, { admin: true });
  page = await open(ctx, '', 'admin');
  ok((await page.locator('.pk-granted').textContent()).includes('Akses admin'), 'access strip: Akses admin');
  ok((await page.locator('.pk-granted a').getAttribute('href')) === 'admin.html#konten', 'admin strip → Konsol Admin');
  ok(await page.locator('[data-pk="results"] .doc-card--locked').count() === 0, 'admin: nothing locked');
  ok(await page.locator('#app-perencanaan a[href="aplikasi/perencanaan/index.html"]').count() === 1, 'admin: app link');
  await fullshot(page, 'admin');
  const saved = await page.evaluate(async () => {
    const a = await PPAPI.store.content.save('pustaka', { judul: 'Catatan Teknis Uji <img src=x onerror="window.__pkxss=1">', kategori: 'Kajian Teknis', kode: 'PPAPI-KT-99', versi: 'Revisi 1', tanggal: '2026-10-05', status: 'Berlaku', ringkasan: 'Butir uji alur <b>admin</b>.', penyusun: 'Sekretariat', format: 'PDF', akses: 'anggota', tautan: 'https://example.com/uji.pdf', tag: ['uji'] });
    await PPAPI.store.content.remove('pustaka', 'formulir-daftar-periksa-inspeksi');
    const r = await PPAPI.store.content.save('regulasi', { jenis: 'Peraturan Menteri', nomor: '99', tahun: 2026, judul: 'Regulasi Uji Admin', singkatan: 'Permen Uji 99/2026', instansi: 'Kementerian Uji', status: 'Berlaku', relevansi: 'Butir uji.', tautan: 'https://example.com/reg' });
    return { a: a && a.id, berkas: a && a.berkasAnggota, tautan: a && a.tautan, r: r && r.id };
  });
  ok(saved.a && saved.berkas === true && saved.tautan === '', `admin save → managed item ${saved.a}, member-only link kept private`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  const kt = page.locator('.pk-shelf[data-kat="Kajian Teknis"] [data-pk-open]');
  ok(await kt.count() === 2, 'managed document appears in its collection');
  ok(await page.evaluate(() => window.__pkxss === undefined), 'markup in a managed title is escaped (no XSS)');
  ok((await page.locator('.pk-shelf[data-kat="Kajian Teknis"]').textContent()).includes('<img src=x'), 'escaped title shown as text');
  ok(await page.locator('[data-key="d:formulir-daftar-periksa-inspeksi"]').count() === 0, 'removed managed document disappears');
  ok(await page.locator('.pk-tile[data-pk-kat="Formulir & Daftar Periksa"].is-empty').count() === 1, 'its tile shows the empty state');
  ok(await page.locator('.pk-shelf[data-kat="Formulir & Daftar Periksa"]').count() === 0, 'empty collection has no shelf');
  ok(parseInt(await page.locator('.pk-tile__num').nth(2).textContent(), 10) === 20, 'managed regulation counted under Peraturan Perundangan (20)');
  await click(page, `[data-pk-open="d:${saved.a}"]`);
  await page.waitForSelector('.modal a.btn--primary', { timeout: 3000 }).catch(() => {});
  ok((await page.locator('.modal a.btn--primary').getAttribute('href')) === 'https://example.com/uji.pdf', 'admin opens the managed member file');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.goto(`${BASE}/regulasi.html?q=Uji%2099`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  ok(await page.locator('#reg-' + saved.r).isVisible(), 'managed regulation also listed on regulasi.html');
  await page.close();
  await ctx.close();

  /* ------------------------------------------------------------------ */
  console.log('-- config.pustaka.katalogPublik = false');
  ctx = await newCtx(vp, { katalogTertutup: true });
  page = await open(ctx, '', 'tertutup');
  ok(await page.locator('[data-pk="closed"]').isVisible(), 'closed catalog: locked panel section');
  ok(await page.locator('[data-pk="closed"] .locked').count() === 1, '… built with ui.locked');
  ok(await page.locator('#katalog').isHidden() && await page.locator('#koleksi').isHidden() && await page.locator('#aplikasi').isHidden(), 'catalog, tiles and apps hidden');
  ok(await page.locator('.doc-card').count() === 0 || await page.locator('.doc-card:visible').count() === 0, 'no document titles visible');
  ok((await page.locator('[data-pk="hero-primary"]').getAttribute('href')) === '#akses', 'hero CTA points to the access panel');
  ok(await page.locator('[data-pk="cta"]').isHidden(), 'CTA band hidden (panel already has the CTA)');
  ok(await overflow(page) <= 1, 'no horizontal overflow');
  await fullshot(page, 'tertutup');
  await axeScan(page, 'closed catalog');
  await page.close();
  await ctx.close();
  ctx = await newCtx(vp, { katalogTertutup: true, status: 'Aktif' });
  page = await open(ctx, '', 'tertutup-aktif');
  ok(await page.locator('[data-pk="closed"]').isHidden() && await page.locator('#katalog').isVisible(), 'closed catalog still opens fully for an active member');
  await page.close();
  await ctx.close();

  ok(errors.length === 0, 'no console errors/warnings' + (errors.length ? ': ' + errors.join(' | ') : ''));
}

// --widths: intermediate widths (small phone landscape / tablet / small laptop) — overflow + screenshots
if (process.argv.includes('--widths')) {
  console.log('\n=== intermediate widths ===');
  for (const w of [360, 480, 800, 1024, 1180]) {
    for (const view of ['kisi', 'daftar']) {
      const c = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce', locale: 'id-ID' });
      const p = await c.newPage();
      await p.goto(`${BASE}/pustaka.html${view === 'daftar' ? '?tampilan=daftar' : ''}`, { waitUntil: 'networkidle' });
      await p.waitForTimeout(250);
      const of = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      ok(of <= 1, `pustaka @${w}px (${view}): no horizontal overflow`);
      if (SAVE) await p.screenshot({ path: path.join(SHOTS, `pkflow-w${w}-${view}.png`), fullPage: true });
      await p.close();
      await c.close();
    }
  }
}

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
