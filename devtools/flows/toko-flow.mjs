// Toko PPAPI — end-to-end flow (Mode Demo).  Run from the workspace root:  node devtools/flows/toko-flow.mjs [--mobile]
// admin adds a T-shirt (variants, photo) + a soft-file/print CoP (private file URL served by this test server)
// → buyer (active member) adds both to the cart, checks out with an address, cannot read the file before payment,
//   submits a payment proof → admin sets shipping + confirms payment → buyer downloads the WATERMARKED PDF
//   (watermark verified in the PDF bytes: Info dict + inflated page content streams) → admin sets resi → Selesai.
// The admin section is rendered into an in-memory harness page (/__toko_admin.html, never written to site/),
// because admin.html is wired by the integrator.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { DEMO_USER, DEMO_MEMBER, registryEntryFor } from './qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots', 'toko');
fs.mkdirSync(SHOTS, { recursive: true });
const MOBILE = process.argv.includes('--mobile');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };

/* ---- a small 2-page PDF (valid xref) ---- */
function makePdf() {
  const objs = [];
  objs.push('<< /Type /Catalog /Pages 2 0 R >>');
  objs.push('<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>');
  const content = (t) => `BT /F1 20 Tf 72 720 Td (${t}) Tj ET`;
  objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 7 0 R >> >> /Contents 4 0 R >>');
  const c1 = content('CoP Pemasangan Perancah - halaman 1');
  objs.push(`<< /Length ${c1.length} >>\nstream\n${c1}\nendstream`);
  objs.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>');
  const c2 = content('Halaman 2');
  objs.push(`<< /Length ${c2.length} >>\nstream\n${c2}\nendstream`);
  objs.push('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');
  let out = '%PDF-1.4\n'; const offs = [];
  objs.forEach((o, i) => { offs.push(out.length); out += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + offs.map(o => String(o).padStart(10, '0') + ' 00000 n \n').join('');
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(out, 'latin1');
}
const PDF = makePdf();
const HARNESS = `<!doctype html><html lang="id" class="no-js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Uji Konsol Toko — PPAPI</title>
<link rel="stylesheet" href="assets/css/main.css"><link rel="stylesheet" href="assets/css/pages/admin.css"><script>document.documentElement.classList.replace('no-js','js')</script></head>
<body data-page="admin" data-auth="admin"><div id="site-header"></div><main id="main" tabindex="-1"><section class="section section--tight"><div class="container"><h1 class="h2">Toko <em>PPAPI</em></h1><div id="sec-toko"></div></div></section></main><div id="site-footer"></div>
<script src="assets/js/config.js" defer></script><script src="assets/data/organisasi.js" defer></script><script src="assets/js/core.js" defer></script><script src="assets/js/auth.js" defer></script><script src="assets/js/store.js" defer></script>
<script src="assets/js/store-toko.js" defer></script><script src="assets/js/pages/admin-toko.js" defer></script>
<script>document.addEventListener('DOMContentLoaded',function(){PPAPI.onReady(function(){var s=window.PPAPI_ADMIN_SECTIONS.filter(function(x){return x.key==='toko'})[0];window.__tokoSection=s;s.render(document.getElementById('sec-toko'));});});</script></body></html>`;

let pdfHits = 0;
const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/__toko_admin.html') { res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(HARNESS); }
  if (p === '/__files/cop-01.pdf') { pdfHits++; res.writeHead(200, { 'content-type': 'application/pdf', 'access-control-allow-origin': '*' }); return res.end(PDF); }
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  let body = fs.readFileSync(file);
  if (p === '/assets/js/config.js') body = body.toString('utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''");
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(body);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg); } };
const browser = await chromium.launch();
const vp = MOBILE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } };
const context = await browser.newContext({ ...vp, reducedMotion: 'reduce', locale: 'id-ID', acceptDownloads: true });
const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
await context.addInitScript(({ u, m, r, a }) => {
  try {
    if (localStorage.getItem('__seeded')) return;
    localStorage.setItem('__seeded', '1');
    const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
    users[u.email] = { uid: u.uid, name: u.name, email: u.email, phone: u.phone, provider: u.provider, createdAt: u.createdAt, hash: 'x' };
    localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
    localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
    localStorage.setItem('ppapi_registry', JSON.stringify({ [r.kta]: r }));
    localStorage.setItem('ppapi_demo_admins', JSON.stringify([a.uid]));
    localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
  } catch (e) {}
}, { u: DEMO_USER, m: DEMO_MEMBER, r: registryEntryFor(DEMO_MEMBER), a: ADMIN });

const page = await context.newPage();
const issues = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) issues.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => issues.push('pageerror: ' + e.message));
const as = async (who) => { await page.evaluate((s) => localStorage.setItem('ppapi_demo_session', JSON.stringify(s)), who); };
const go = async (url) => { await page.goto(BASE + url, { waitUntil: 'load' }); await page.waitForLoadState('networkidle').catch(() => {}); await page.waitForTimeout(400); };
const shot = (n) => page.screenshot({ path: path.join(SHOTS, `${n}-${MOBILE ? 'mobile' : 'desktop'}.png`), fullPage: true });
const drawerSave = async (id) => { await page.click(`#${id}`); await page.waitForTimeout(500); };

console.log('\n1. Toko kosong');
await go('/toko.html');
ok(await page.isVisible('.tk-soon'), 'katalog kosong menampilkan keadaan "Katalog sedang disiapkan"');
ok((await page.locator('.tk-tile').count()) === 5, 'lima koleksi tampil');

console.log('\n2. Admin menambah produk');
await go('/__toko_admin.html');
await page.waitForSelector('[data-atk]');
await page.click('[data-atk-tab="produk"]');
await page.waitForSelector('[data-atk="new"]');
await page.click('[data-atk="new"] >> nth=0');
await page.waitForSelector('#pf-nama');
await page.fill('#pf-nama', 'Kaus PPAPI Edisi Perancah');
await page.selectOption('#pf-kat', 'Pakaian');
await page.fill('#pf-kode', 'PPAPI-KS-01');
await page.fill('#pf-ring', 'Kaus katun combed 30s dengan logo PPAPI.');
await page.fill('#pf-harga', '125000');
await page.fill('#pf-hang', '100000');
await page.fill('#pf-stok', '10');
await page.fill('#pf-vn0', 'Ukuran'); await page.fill('#pf-vo0', 'S, M, L, XL');
await page.fill('#pf-vn1', 'Warna'); await page.fill('#pf-vo1', 'Hitam, Abu');
await page.setInputFiles('[data-pf-file]', path.join(ROOT, 'assets/img/og-image.jpg'));
await page.waitForSelector('.atk-photo img');
ok(await page.evaluate(() => { const s = document.querySelector('.atk-photo img').src; return s.startsWith('data:image/jpeg') && (s.length - 23) * 0.75 <= 150 * 1024; }), 'foto dikompresi menjadi JPEG ≤ 150 KB');
await shot('admin-produk-form');
await drawerSave('pf-save');
await page.waitForSelector('[data-edit="kaus-ppapi-edisi-perancah"]');
ok(true, 'kaus tersimpan');
await page.click('[data-atk="new"] >> nth=0');
await page.waitForSelector('#pf-nama');
await page.fill('#pf-nama', 'Code of Practice Pemasangan Perancah Tube & Coupler');
await page.selectOption('#pf-kat', 'Produk Pengetahuan');
await page.fill('#pf-kode', 'PPAPI-CoP-01');
await page.check('#pf-cetak');
await page.fill('#pf-harga', '150000');
await page.fill('#pf-hcetak', '250000');
await page.fill('#pf-stok', '5');
await page.fill('#pf-file', BASE + '/__files/cop-01.pdf');
await page.fill('#pf-hal', '2');
await drawerSave('pf-save');
await page.waitForSelector('[data-edit^="code-of-practice"]');
ok(await page.evaluate(() => { const f = JSON.parse(localStorage.getItem('ppapi_toko_files') || '{}'); const p = JSON.parse(localStorage.getItem('ppapi_toko_products') || '{}'); const id = Object.keys(f)[0]; return !!id && !('url' in p[id]) && p[id].berkasAda === true; }), 'tautan berkas disimpan terpisah (product_files), produk publik hanya berkasAda');
await shot('admin-produk-list');
await page.click('[data-atk-tab="pengaturan"]');
await page.waitForSelector('#st-bank0');
await page.fill('#st-bank0', 'Bank Uji'); await page.fill('#st-no0', '123 456 7890'); await page.fill('#st-an0', 'Perkumpulan Praktisi dan Ahli Perancah Indonesia');
await page.click('#st-save'); await page.waitForTimeout(400);
ok(await page.evaluate(() => (JSON.parse(localStorage.getItem('ppapi_toko_settings')) || {}).rekening.length === 1), 'rekening disimpan');

console.log('\n3. Pembeli belanja & checkout');
await as(DEMO_USER);
await go('/toko.html');
ok((await page.locator('.tk-card').count()) === 2, 'katalog menampilkan 2 produk');
ok((await page.textContent('.tk-grid')).includes('Rp 100.000'), 'harga anggota tampil untuk anggota Aktif');
await shot('toko-katalog');
await page.click('[data-open="kaus-ppapi-edisi-perancah"]');
await page.waitForSelector('.tk-modal');
await page.click('#d-add');
ok(await page.locator('.tk-opt.is-invalid').count() > 0, 'varian wajib dipilih sebelum ditambahkan');
await page.click('.tk-modal input[name="d-var-0"][value="L"] + .segmented__option');
await page.click('.tk-modal input[name="d-var-1"][value="Hitam"] + .segmented__option');
await page.click('.tk-modal [data-step="1"]');
await page.waitForTimeout(300);
await shot('toko-detail');
await page.click('#d-add');
await page.waitForTimeout(500);
ok(await page.evaluate(() => PPAPI.toko.cart.count()) === 2, 'kaus ×2 masuk keranjang');
const copId = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ppapi_toko_products'))).find(k => k.startsWith('code')));
await page.click(`[data-open="${copId}"]`);
await page.waitForSelector('.tk-modal');
ok((await page.textContent('.tk-modal')).includes('tanda air identitas pembeli'), 'detail soft file menjelaskan tanda air');
await page.click('#d-add');
await page.waitForTimeout(400);
ok(await page.isVisible('.tk-fab'), 'tombol keranjang mengambang tampil');
await go('/keranjang.html');
ok((await page.locator('.kr-line').count()) === 2, 'keranjang berisi 2 baris');
ok((await page.textContent('.kr-summary')).includes('Rp 350.000'), 'subtotal Rp 350.000 (2 × 100.000 + 150.000)');
await page.click('[data-kr="submit"]');
ok(await page.locator('.field.is-invalid').count() > 0, 'alamat wajib divalidasi');
await page.fill('#kr-alamat', 'Jl. Contoh Raya No. 10, RT 01/RW 02, Kel. Uji');
await page.fill('#kr-kota', 'Kota Bandung');
await page.selectOption('#kr-provinsi', 'Jawa Barat');
await page.fill('#kr-kodePos', '40115');
await page.check('#kr-setuju', { force: true });
await shot('keranjang');
await Promise.all([page.waitForURL(/pesanan\.html\?id=PSN-/), page.click('[data-kr="submit"]')]);
await page.waitForTimeout(600);
const orderId = new URL(page.url()).searchParams.get('id');
ok(/^PSN-\d{8}-[A-Z0-9]{5}$/.test(orderId), 'pesanan dibuat: ' + orderId);
ok(await page.evaluate(() => PPAPI.toko.cart.count()) === 0, 'keranjang dikosongkan');
ok((await page.textContent('main')).includes('Ongkos kirim sedang dihitung'), 'ongkir menunggu konfirmasi sekretariat');
const before = await page.evaluate(async (pid) => { try { await PPAPI.toko.fileUrl(pid); return 'read'; } catch (e) { return e.code; } }, copId);
ok(before === 'toko/forbidden', 'pembeli belum bayar TIDAK dapat membaca tautan berkas (' + before + ')');
ok(!(await page.isVisible('[data-dl]')), 'tombol unduh belum tersedia');
await shot('pesanan-bayar');
await page.fill('#ps-bukti', 'https://drive.google.com/file/d/contohBuktiTransfer123/view');
await page.fill('#ps-jml', '370.000');
await page.fill('#ps-pengirim', 'Rahmat Hidayat — Bank Uji');
await page.click('[data-ps="proof-submit"]');
await page.waitForTimeout(600);
ok((await page.textContent('.ps-head')).includes('Menunggu Konfirmasi'), 'status → Menunggu Konfirmasi');

console.log('\n4. Admin konfirmasi');
await as(ADMIN);
await go('/__toko_admin.html');
await page.waitForSelector(`[data-order="${orderId}"]`);
await page.click(`[data-order="${orderId}"]`);
await page.waitForSelector('.atk-drawer');
await shot('admin-pesanan');
await page.click('#atk-confirm');
await page.waitForTimeout(400);
ok((await page.textContent('body')).includes('Tetapkan ongkos kirim terlebih dahulu'), 'konfirmasi ditolak sebelum ongkir final');
await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
await page.click('.atk-drawer button:has-text("Tetapkan Ongkir")');
await page.fill('#atk-ong', '20000');
await page.click('.modal__footer .btn--primary');
await page.waitForTimeout(700);
await page.click('#atk-confirm');
await page.waitForTimeout(300);
await page.click('.modal__footer .btn--primary');
await page.waitForTimeout(800);
const st = await page.evaluate((id) => JSON.parse(localStorage.getItem('ppapi_toko_orders'))[id], orderId);
ok(st.status === 'Dibayar' && st.ringkasan.total === 370000, 'Dibayar, total 370.000 (ongkir 20.000)');
ok(await page.evaluate(({ id, pid, uid }) => !!JSON.parse(localStorage.getItem('ppapi_toko_entitlements'))[uid + '_' + pid], { id: orderId, pid: copId, uid: DEMO_USER.uid }), 'hak unduh entitlements/{uid}_{produk} dibuat');
ok(await page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_toko_products'))['kaus-ppapi-edisi-perancah'].stok === 8), 'stok kaus berkurang 10 → 8');

console.log('\n5. Pembeli mengunduh soft file bertanda air');
await as(DEMO_USER);
await go('/pesanan.html?id=' + orderId);
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.click('[data-dl]')]);
const out = path.join(SHOTS, 'unduhan-' + orderId + '.pdf');
await dl.saveAs(out);
const encBytes = fs.readFileSync(out);
ok(encBytes.toString('latin1').startsWith('%PDF-'), 'berkas PDF terunduh (' + encBytes.length + ' bita, nama ' + dl.suggestedFilename() + ')');
// berkas dikunci (AES, kata sandi = email pembeli); buka dengan pustaka yang sama lalu simpan tanpa kunci untuk diperiksa
const PDFLib = createRequire(import.meta.url)('../../site/assets/vendor/pdf-lib-cantoo-2.8.4.min.js');
const probe = await PDFLib.PDFDocument.load(encBytes, { ignoreEncryption: true });
ok(probe.isEncrypted, 'berkas terenkripsi');
let tolak = false; try { await PDFLib.PDFDocument.load(encBytes, { password: 'salah@contoh.id' }); } catch { tolak = true; }
ok(tolak, 'kata sandi lain ditolak');
const dec = await PDFLib.PDFDocument.load(encBytes, { password: DEMO_USER.email.toLowerCase(), updateMetadata: false });
const bytes = Buffer.from(await dec.save({ useObjectStreams: false }));
const txt = bytes.toString('latin1');
const u16 = (x) => Buffer.from(x, 'utf16le').swap16().toString('hex').toUpperCase();   // pdf-lib writes Info text as UTF-16BE hex
const TXTU = txt.toUpperCase();
ok([DEMO_USER.name, DEMO_USER.email, orderId].every(x => txt.includes(x) || TXTU.includes(u16(x))), 'metadata PDF (Subject/Keywords) memuat nama, email, dan nomor pesanan');
// inflate every content stream and look for the hex-encoded watermark text
const streams = []; const re = /stream\r?\n/g; let m;
while ((m = re.exec(txt))) { const s = m.index + m[0].length; const e = txt.indexOf('endstream', s); const raw = bytes.subarray(s, e); try { streams.push(zlib.inflateSync(raw).toString('latin1')); } catch { streams.push(raw.toString('latin1')); } }
const hex = (s) => Buffer.from(s, 'latin1').toString('hex').toUpperCase();
const all = streams.join('\n').toUpperCase();
const wm = `${DEMO_USER.name} - ${orderId}`;
const pagesWithWm = streams.filter(s => s.toUpperCase().includes(hex(wm))).length;
ok(pagesWithWm >= 2, `tanda air diagonal "${wm}" ada di ${pagesWithWm} aliran konten (2 halaman)`);
ok(all.includes(hex('Berlisensi untuk ' + DEMO_USER.name)), 'baris kaki "Berlisensi untuk …" ada di aliran konten');
ok(pdfHits >= 1, 'berkas diambil dari tautan privat di server uji');
await shot('pesanan-dibayar');

console.log('\n6. Admin mengirim & menyelesaikan');
await as(ADMIN);
await go('/__toko_admin.html');
await page.waitForSelector(`[data-order="${orderId}"]`);
await page.click(`[data-order="${orderId}"]`);
await page.waitForSelector('#atk-ship');
await page.click('#atk-ship');
await page.fill('#atk-kurir', 'JNE'); await page.fill('#atk-resi', 'JNEUJI1234567');
await page.click('.modal__footer .btn--primary');
await page.waitForTimeout(700);
await page.click('#atk-done');
await page.waitForTimeout(700);
ok(await page.evaluate((id) => JSON.parse(localStorage.getItem('ppapi_toko_orders'))[id].status === 'Selesai', orderId), 'status → Selesai');
await page.keyboard.press('Escape'); await page.waitForTimeout(300);
const csv = await page.evaluate(async () => PPAPI.toko.admin.exportOrdersCsv(await PPAPI.toko.admin.listOrders()));
ok(csv.startsWith('﻿') && csv.includes(orderId) && csv.includes('JNEUJI1234567'), 'CSV memuat pesanan + resi');
await as(DEMO_USER);
await go('/pesanan.html?id=' + orderId);
ok((await page.textContent('[data-ps="resi"]')).includes('JNEUJI1234567'), 'pembeli melihat nomor resi');
await shot('pesanan-selesai');
await go('/pesanan.html');
ok((await page.locator('.ps-row').count()) === 1, 'daftar Pesanan Saya berisi 1 pesanan');
await shot('pesanan-daftar');

console.log('\n7. Pembatalan oleh pembeli');
await go('/toko.html?produk=kaus-ppapi-edisi-perancah');
await page.waitForSelector('.tk-modal');
await page.click('.tk-modal input[name="d-var-0"][value="M"] + .segmented__option');
await page.click('.tk-modal input[name="d-var-1"][value="Abu"] + .segmented__option');
await page.click('#d-add'); await page.waitForTimeout(400);
await go('/keranjang.html');
await page.fill('#kr-alamat', 'Jl. Contoh Raya No. 10, RT 01/RW 02, Kel. Uji');
await page.fill('#kr-kota', 'Kota Bandung');
await page.selectOption('#kr-provinsi', 'Jawa Barat');
await page.fill('#kr-kodePos', '40115');
await page.check('#kr-setuju', { force: true });
await Promise.all([page.waitForURL(/pesanan\.html\?id=/), page.click('[data-kr="submit"]')]);
await page.waitForTimeout(500);
await page.click('[data-ps="cancel"]');
await page.click('.modal__footer .btn--danger');
await page.waitForTimeout(600);
ok((await page.textContent('.ps-head')).includes('Dibatalkan'), 'pesanan belum dibayar dapat dibatalkan pembeli');
const paidCancel = await page.evaluate(async (id) => { try { await PPAPI.toko.cancelOrder(id); return 'ok'; } catch (e) { return e.code; } }, orderId);
ok(paidCancel === 'toko/invalid-transition', 'pesanan yang sudah dibayar tidak dapat dibatalkan pembeli');

console.log('\n8. Impor tabel tarif kurir');
await as(ADMIN);
await go('/__toko_admin.html');
await page.waitForSelector('[data-atk-tab="pengaturan"]');
await page.click('[data-atk-tab="pengaturan"]');
await page.waitForSelector('[data-st-import]', { state: 'attached' });
const tarifFile = (obj) => ({ name: 'tarif.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(obj)) });
const tabelUji = { format: 'ppapi-toko-ongkir', kurir: 'Kurir Uji REG', asal: 'Kabupaten Bogor', sumber: 'pengecek tarif kurir uji', diperbarui: '2026-10-30', toleransi: 300, tarif: { 'jawa barat': 12000, 'DKI Jakarta': 'Rp 10.000', 'Papua Pegunungan': null } };
const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_toko_settings')) || {});
await page.setInputFiles('[data-st-import]', tarifFile({ ...tabelUji, tarif: { 'Jawa Barat': 12000, 'Jabar': 15000 } }));
await page.waitForTimeout(400);
ok(!(await page.isVisible('.modal__footer')) && !(await stored()).ongkirTabel, 'provinsi tak dikenal → berkas ditolak utuh, tidak ada yang disimpan');
await page.setInputFiles('[data-st-import]', tarifFile({ ...tabelUji, diperbarui: '31-02-2026' }));
await page.waitForTimeout(400);
ok(!(await stored()).ongkirTabel, 'tanggal pengecekan tidak sah (31-02-2026) → ditolak');
for (const tg of ['30-10-2026', '30/10/2026', '30 Oktober 2026']) {
  await page.setInputFiles('[data-st-import]', tarifFile({ ...tabelUji, diperbarui: tg }));
  await page.waitForSelector('.modal__footer .btn--primary');
  ok((await page.textContent('.modal')).includes('30 Oktober 2026'), 'format tanggal "' + tg + '" dikenali');
  await page.click('.modal__footer .btn--ghost'); await page.waitForTimeout(300);
}
ok(!(await stored()).ongkirTabel, 'membatalkan konfirmasi → tidak ada yang disimpan');
await page.setInputFiles('[data-st-import]', tarifFile({ format: 'ppapi-toko-produk', produk: [] }));
await page.waitForTimeout(400);
ok(!(await stored()).ongkirTabel, 'berkas berformat lain → ditolak');
await page.setInputFiles('[data-st-import]', tarifFile(tabelUji));
await page.waitForSelector('.modal__footer .btn--primary');
ok((await page.textContent('.modal')).includes('2 provinsi berisi tarif, 36 provinsi tetap dikonfirmasi sekretariat'), 'konfirmasi impor merangkum isi tabel');
await page.click('.modal__footer .btn--primary');
await page.waitForTimeout(700);
const sTabel = await stored();
ok(sTabel.ongkirMode === 'tabel' && sTabel.ongkirTabel.kurir === 'Kurir Uji REG' && sTabel.ongkirTabel.tarif['Jawa Barat'] === 12000 && sTabel.ongkirTabel.tarif['DKI Jakarta'] === 10000 && Object.keys(sTabel.ongkirTabel.tarif).length === 2, 'tabel tersimpan (nama provinsi dinormalkan, "Rp 10.000" → 10000) dan mode beralih ke tabel');
ok(sTabel.rekening.length === 1, 'pengaturan lain (rekening) tidak berubah');
await page.waitForSelector('#st-tk-kurir');
ok(await page.inputValue('#st-tk-kurir') === 'Kurir Uji REG' && await page.isChecked('input[name="st-mode"][value="tabel"]'), 'formulir pengaturan menampilkan tabel hasil impor');
const est = await page.evaluate(async () => { const T = PPAPI.toko, s = await T.getSettings({ fresh: true }); return [T.shippingQuote(s, true, { provinsi: 'Jawa Barat', berat: 1400 }), T.shippingQuote(s, true, { provinsi: 'Papua Pegunungan', berat: 600 })]; });
ok(est[0].final && est[0].ongkir === 24000 && est[0].catatan.includes('Kurir Uji REG'), 'tarif impor dipakai perhitungan ongkir (Jawa Barat, 1,4 kg → 2 kg × Rp12.000)');
ok(!est[1].final && est[1].ongkir === null, 'provinsi yang dikosongkan di berkas tetap dikonfirmasi sekretariat');
await shot('admin-impor-tarif');

ok(issues.length === 0, 'tanpa galat konsol' + (issues.length ? ': ' + issues.join(' | ') : ''));
await browser.close(); server.close();
console.log(`\n${pass} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
