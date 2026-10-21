// Kegiatan (webinar/pelatihan) — alur ujung ke ujung dalam Mode Demo dengan jam beku (context.clock).
// Jalankan dari folder workspace:  node devtools/flows/kegiatan-flow.mjs
// Mencakup: admin membuat webinar (akses semua akun) + pelatihan (anggota Aktif) lewat bagian konsol
// "Kegiatan" (PPAPI_ADMIN_SECTIONS, dipasang pada halaman uji __kegiatan_admin.html); anggota Draf dapat
// mendaftar ke yang pertama tetapi tidak ke yang kedua; tombol "Isi Daftar Hadir" nonaktif sebelum
// jendela, aktif pada selesai−30 menit, nonaktif setelah selesai+3 jam; unggah desain sertifikat + geser
// kolom; PDF sertifikat (bita diperiksa: nama + nomor); verifikasi publik per nomor; Kegiatan Saya;
// CSV peserta; pencabutan sertifikat; pemeriksaan statis fragmen aturan Firestore.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_USER, DEMO_MEMBER } from './qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };

/* halaman uji (tidak ditulis ke site/): bagian konsol Kegiatan + Kegiatan Saya */
const head = (title, auth) => `<!doctype html><html lang="id" class="no-js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title} — PPAPI</title>
<link rel="stylesheet" href="assets/css/main.css"><link rel="stylesheet" href="assets/css/pages/admin.css"><script>document.documentElement.classList.replace('no-js','js')</script></head>
<body data-page="${auth === 'admin' ? 'admin' : 'dashboard'}" data-auth="${auth}" data-header="solid"><a class="skip-link" href="#main">Lewati</a><div id="site-header"></div>`;
const tail = (extra, mount) => `<div id="site-footer"></div>
<script src="assets/js/config.js" defer></script><script src="assets/js/core.js" defer></script><script src="assets/js/auth.js" defer></script><script src="assets/js/store.js" defer></script>
<script src="assets/js/store-kegiatan.js" defer></script>${extra}
<script>document.addEventListener('DOMContentLoaded',function(){PPAPI.onReady(async function(){${mount}});});</script></body></html>`;
const VIRTUAL = {
  '/__blank.html': '<!doctype html><title>kosong</title>',
  '/__kegiatan_admin.html': head('Uji Konsol Kegiatan', 'admin') +
    `<main id="main" tabindex="-1"><section class="section section--tight" style="padding-top:calc(var(--header-offset) + 32px)"><div class="container"><p class="eyebrow">Konsol Admin</p><h1 class="h2" id="sec-title"></h1><p class="muted" id="sec-lead"></p><div id="sec-body" class="mt-4"></div></div></section></main>` +
    tail('<script src="assets/js/kegiatan-saya.js" defer></script><script src="assets/js/pages/admin-kegiatan.js" defer></script>',
      `var s=(window.PPAPI_ADMIN_SECTIONS||[]).filter(function(x){return x.key==='kegiatan';})[0];document.getElementById('sec-title').innerHTML=s.title;document.getElementById('sec-lead').textContent=s.lead;window.__sec=s;await s.render(document.getElementById('sec-body'));window.__ready=true;`),
  '/__kegiatan_saya.html': head('Uji Kegiatan Saya', 'required') +
    `<main id="main" tabindex="-1"><section class="section section--tight" style="padding-top:calc(var(--header-offset) + 32px)"><div class="container"><div id="kgs"></div></div></section></main>` +
    tail('<script src="assets/js/kegiatan-saya.js" defer></script>', `window.__kgs=await PPAPI.kegiatanSaya.render(document.getElementById('kgs'));window.__ready=true;`),
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (VIRTUAL[p]) { res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(VIRTUAL[p]); }
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('<!doctype html><title>404</title>Not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let pass = 0, fail = 0;
const ok = (cond, msg, extra) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg + (extra !== undefined ? '  → ' + JSON.stringify(extra).slice(0, 600) : '')); } };
const T = s => new Date(s + '+07:00');

/* akun uji */
const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
const DRAF_USER = { uid: 'demo-draf-0002', name: 'Budi Santoso', email: 'budi.uji@contoh.id', phone: '+6281298765432', provider: 'password', photoURL: '', createdAt: '2026-10-01T02:00:00.000Z' };
const DRAF_MEMBER = Object.assign(structuredClone(DEMO_MEMBER), { uid: DRAF_USER.uid, name: DRAF_USER.name, email: DRAF_USER.email, phone: DRAF_USER.phone, kta: '', status: 'Draf', validUntil: '', approvedAt: '', approvedBy: '', joinedAt: '2026-10-01' });
DRAF_MEMBER.application = Object.assign({}, DRAF_MEMBER.application, { submittedAt: '' });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta', reducedMotion: 'reduce', acceptDownloads: true });
await ctx.clock.setFixedTime(T('2026-10-21T10:00:00'));
/* formulir Google penyelenggara (contoh) → halaman tiruan, tanpa jaringan */
await ctx.route('https://docs.google.com/**', r => r.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>Formulir</title><p>Formulir penyelenggara (tiruan uji)</p>' }));
const errors = [];
const page = await ctx.newPage();
page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(`console.${m.type()}: ${m.text()}`); });
page.on('pageerror', e => errors.push('pageerror: ' + e.message));
page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss().catch(() => {}); });

async function signInAs(user, member, isAdmin) {
  await page.goto(`${BASE}/__blank.html`);
  await page.evaluate(({ u, m, a }) => {
    localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
    localStorage.setItem('ppapi_demo_ribbon_dismissed', '1');
    const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
    if (!a) users[u.email] = { uid: u.uid, name: u.name, email: u.email, phone: u.phone, provider: u.provider, createdAt: u.createdAt, hash: 'x' };
    localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
    if (m) localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
    if (a) { const ad = JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]'); if (!ad.includes(u.uid)) ad.push(u.uid); localStorage.setItem('ppapi_demo_admins', JSON.stringify(ad)); }
  }, { u: user, m: member, a: isAdmin });
}
const events = () => page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_events') || '{}'));
const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

async function fillEventForm(o) {
  const m = page.locator('.modal').last();
  await m.locator('#kg-judul').fill(o.judul);
  await m.locator('#kg-jenis').selectOption(o.jenis);
  await m.locator('#kg-narasumber').fill(o.narasumber || '');
  await m.locator('#kg-deskripsi').fill(o.deskripsi || '');
  await m.locator('#kg-mulai-tgl').fill(o.tgl);
  await m.locator('#kg-mulai-jam').fill(o.mulai);
  await m.locator('#kg-selesai-tgl').fill(o.tgl);
  await m.locator('#kg-selesai-jam').fill(o.selesai);
  await m.locator('#kg-mode').selectOption(o.mode);
  await m.locator('#kg-lokasi').fill(o.lokasi || '');
  await m.locator('#kg-ruang').fill(o.ruang || '');
  await m.locator('#kg-ruang-cat').fill(o.ruangCat || '');
  await m.locator(`input[name="kg-akses"][value="${o.akses}"]`).check();
  await m.locator('#kg-kuota').fill(String(o.kuota || 0));
  await m.locator('#kg-tautan').fill(o.tautan || '');
  await m.locator(`input[name="kg-status"][value="${o.status}"]`).check();
}

/* ======================================================================= */
console.log('\n[K1] Admin — bagian konsol "Kegiatan": membuat webinar (semua akun) & pelatihan (anggota Aktif)');
let idA, idB;
{
  await signInAs(ADMIN, null, true);
  await page.goto(`${BASE}/__kegiatan_admin.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ready === true);
  const sec = await page.evaluate(() => { const s = window.PPAPI_ADMIN_SECTIONS.filter(x => x.key === 'kegiatan')[0]; return { key: s.key, label: s.label, icon: s.icon, fn: typeof s.render }; });
  ok(sec.key === 'kegiatan' && sec.label === 'Kegiatan' && sec.icon === 'calendar' && sec.fn === 'function', 'PPAPI_ADMIN_SECTIONS memuat {key:"kegiatan", label, icon, render}', sec);
  ok(await page.locator('[data-kga-list] .empty-state').count() === 1, 'daftar awal kosong → keadaan kosong + tombol Tambah');
  await page.click('.kga-toolbar [data-kga="new"]');
  await page.waitForSelector('.modal [data-kga-form]');
  // validasi: judul kosong
  await page.locator('.modal #kg-judul').fill('');
  await page.click('.modal #kga-save');
  await page.waitForTimeout(200);
  ok(await page.locator('.modal [data-field="judul"].is-invalid').count() === 1, 'validasi: judul kosong ditandai, modal tetap terbuka');
  await fillEventForm({ judul: 'Webinar Inspeksi Perancah Sebelum Digunakan', jenis: 'Webinar', narasumber: 'Tim Teknis PPAPI', deskripsi: 'Pemeriksaan harian perancah sebelum dipakai: komponen, sambungan, landasan, dan penandaan.', tgl: '2026-10-25', mulai: '09:00', selesai: '11:00', mode: 'Daring', lokasi: 'Zoom Meeting', ruang: 'https://zoom.us/j/1234567890', ruangCat: 'Meeting ID 123 456 7890 · kode sandi PPAPI', akses: 'semua', kuota: 50, tautan: 'https://docs.google.com/forms/d/e/contoh/viewform', status: 'terbit' });
  const winTxt = await page.locator('.modal [data-kga-window]').textContent();
  ok(/Minggu, 25 Oktober 2026 pukul 10\.30 WIB/.test(winTxt) && /pukul 14\.00 WIB/.test(winTxt), 'pratinjau jendela daftar hadir: dibuka 10.30, ditutup 14.00 WIB', winTxt);
  await page.screenshot({ path: path.join(SHOTS, 'flow-kegiatan-admin-form.png') });
  await page.click('.modal #kga-save');
  await page.waitForSelector('.drawer [data-kga-designer] .kga-stage', { timeout: 8000 });
  let ev = await events();
  idA = Object.keys(ev)[0];
  const a = ev[idA];
  ok(idA === 'kg-webinar-inspeksi-perancah-sebelum-digunakan-20261025', 'ID kegiatan dari judul + tanggal', idA);
  ok(a.status === 'terbit' && a.akses === 'semua' && a.kuota === 50 && a.kode === 'WEB1025' && a.tahun === 2026 && a.terdaftar === 0, 'tersimpan: terbit, akses semua, kuota 50, kode WEB1025', a);
  ok(a.mulaiAt === '2026-10-25T02:00:00.000Z' && a.selesaiAt === '2026-10-25T04:00:00.000Z', 'jam WIB → UTC benar (09.00–11.00 WIB)', [a.mulaiAt, a.selesaiAt]);
  ok(a.hadirBuka === '2026-10-25T03:30:00.000Z' && a.hadirTutup === '2026-10-25T07:00:00.000Z', 'hadirBuka = selesai − 30 menit, hadirTutup = selesai + 3 jam', [a.hadirBuka, a.hadirTutup]);
  const priv = await page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_event_private') || '{}'));
  ok(priv[idA] && priv[idA].linkRuang === 'https://zoom.us/j/1234567890' && !('linkRuang' in a), 'tautan ruang disimpan terpisah (privat), tidak di dokumen publik', priv[idA]);
  ok(await page.locator('.drawer .tabs__tab[data-tab="sertifikat"][aria-selected="true"]').count() === 1, 'setelah dibuat: panel Kelola terbuka di tab Sertifikat');

  console.log('\n[K2] Perancang sertifikat — unggah desain, geser kolom, atur ukuran, simpan');
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 1754; c.height = 1240;
    const x = c.getContext('2d'); x.fillStyle = '#f6f6f4'; x.fillRect(0, 0, c.width, c.height);
    x.strokeStyle = '#111113'; x.lineWidth = 18; x.strokeRect(40, 40, c.width - 80, c.height - 80);
    x.fillStyle = '#111113'; x.font = 'bold 110px serif'; x.textAlign = 'center'; x.fillText('SERTIFIKAT', c.width / 2, 260);
    x.font = '42px sans-serif'; x.fillText('diberikan kepada', c.width / 2, 470);
    for (let i = 0; i < 4000; i++) { x.fillStyle = `rgba(${(i * 37) % 255},${(i * 91) % 255},${(i * 53) % 255},.08)`; x.fillRect((i * 97) % c.width, (i * 61) % c.height, 9, 9); }
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.setInputFiles('.drawer [data-kgd-file]', { name: 'desain-sertifikat.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await page.waitForSelector('.drawer .kga-stage__bg', { timeout: 8000 });
  const bgInfo = await page.locator('.drawer [data-kgd-bginfo]').textContent();
  ok(/1754×1240 px/.test(bgInfo), 'desain diunggah & dikompresi (ukuran ditampilkan)', bgInfo);
  const field = page.locator('.drawer .kga-field[data-key="nama"]');
  await page.locator('.drawer [data-kgd-stage]').scrollIntoViewIfNeeded();
  const b0 = await field.boundingBox();
  const stage = await page.locator('.drawer [data-kgd-stage]').boundingBox();
  await page.mouse.move(b0.x + b0.width / 2, b0.y + b0.height / 2);
  await page.mouse.down();
  await page.mouse.move(b0.x + b0.width / 2 + 40, b0.y + b0.height / 2 + stage.height * 0.05, { steps: 6 });
  await page.mouse.up();
  const posX = +(await page.locator('.drawer [data-kgd-prop="x"]').inputValue()), posY = +(await page.locator('.drawer [data-kgd-prop="y"]').inputValue());
  ok(posY > 50 && posY < 54 && posX > 50, 'geser kolom nama dengan tetikus → posisi X/Y ikut berubah', [posX, posY]);
  await page.locator('.drawer [data-kgd-prop="size"]').fill('36');
  await page.locator('.drawer .kga-field[data-key="qr"]').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForTimeout(100);
  ok(await page.locator('.drawer [data-kgd-pick="qr"][aria-pressed="true"]').count() === 1, 'kolom QR dipilih dengan papan ketik (Enter), panah menggeser');
  await page.screenshot({ path: path.join(SHOTS, 'flow-kegiatan-designer.png') });
  await page.click('.drawer [data-kgd="save"]');
  await page.waitForTimeout(400);
  const design = await page.evaluate(id => JSON.parse(localStorage.getItem('ppapi_event_design_' + id) || 'null'), idA);
  ok(design && /^data:image\/jpeg;base64,/.test(design.bg) && design.bg.length <= 921600 && design.orient === 'landscape', 'desain tersimpan: JPEG data URL ≤ 900 KB, lanskap', design && [design.bg.length, design.orient]);
  ok(design && Math.abs(design.fields.nama.y - posY / 100) < 0.002 && design.fields.nama.size === 36 && design.fields.qr.x < 0.885, 'tata letak tersimpan (nama Y, ukuran 36 pt, QR digeser)', design && design.fields);
  const dl = page.waitForEvent('download');
  await page.click('.drawer [data-kgd="sample"]');
  const sample = await dl;
  const sbuf = fs.readFileSync(await sample.path());
  ok(sbuf.slice(0, 5).toString() === '%PDF-' && /Nama Peserta Contoh/.test(sbuf.toString('latin1')), 'contoh PDF dari perancang (jsPDF + SRI dari cdnjs)', sample.suggestedFilename());
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // kegiatan kedua: khusus anggota Aktif
  await page.click('.kga-toolbar [data-kga="new"]');
  await page.waitForSelector('.modal [data-kga-form]');
  await fillEventForm({ judul: 'Pelatihan Teknisi Perancah Sistem Ringlock', jenis: 'Pelatihan', tgl: '2026-10-28', mulai: '08:00', selesai: '16:00', mode: 'Luring', lokasi: 'Jakarta', akses: 'aktif', kuota: 2, status: 'terbit' });
  await page.click('.modal #kga-save');
  await page.waitForSelector('.drawer .kga-stage', { timeout: 8000 });
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  ev = await events();
  idB = Object.keys(ev).find(k => k !== idA);
  ok(ev[idB] && ev[idB].akses === 'aktif' && ev[idB].kode === 'PLT1028', 'pelatihan tersimpan: akses anggota Aktif, kode PLT1028', ev[idB]);
  const rows = await page.locator('.kga-table tbody tr').count();
  ok(rows === 2 && await page.locator('.kga-table .badge--metal').count() === 1, 'daftar konsol: 2 kegiatan, lencana "Anggota Aktif" pada pelatihan', rows);
  await page.click('[data-kga-status="draf"]');
  ok(await page.locator('[data-kga-list] .empty-state').count() === 1, 'saring Draf → tidak ada');
  await page.click('[data-kga-status=""]');
  await page.locator('#kga-q').fill('ringlock');
  await page.waitForTimeout(350);
  ok(await page.locator('.kga-table tbody tr').count() === 1, 'pencarian "ringlock" → 1 baris');
  await page.locator('#kga-q').fill('');
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(SHOTS, 'flow-kegiatan-admin-list.png'), fullPage: true });
  ok(await overflow() <= 1, 'tanpa luapan horizontal (konsol, 1440)');
}

/* ======================================================================= */
console.log('\n[K3] Anggota Draf — boleh mendaftar webinar "semua akun", tidak boleh pelatihan "anggota Aktif"');
{
  await signInAs(DRAF_USER, DRAF_MEMBER, false);
  await page.goto(`${BASE}/agenda.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const s = await page.evaluate(() => ({
    rows: [...document.querySelectorAll('.agenda-row .event-row__title')].map(e => e.textContent.trim()),
    akses: [...document.querySelectorAll('.agenda-row .badge--metal, .agenda-row .badge--outline')].map(e => e.textContent.trim()),
    feature: document.querySelector('.agenda-feature__title')?.textContent.trim(),
  }));
  ok(s.rows.length === 2 && s.feature === 'Webinar Inspeksi Perancah Sebelum Digunakan', 'agenda menampilkan 2 kegiatan terbit; webinar disorot sebagai terdekat', s);
  ok(s.akses.includes('Semua akun') && s.akses.includes('Anggota Aktif'), 'lencana akses tampil di baris agenda', s.akses);
  await page.goto(`${BASE}/agenda.html?id=${idA}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.modal .kg-panel [data-kg="register"]', { timeout: 8000 });
  ok(await page.locator('.modal .kg-panel .badge', { hasText: 'Terbuka untuk semua akun' }).count() === 1, 'detail webinar: panel pendaftaran, akses semua akun');
  ok(await page.locator('.modal .kg-attend').isDisabled(), 'sebelum mendaftar: tombol "Isi Daftar Hadir" nonaktif');
  await page.locator('.modal .kg-field input').fill('Ir. Budi Santoso, S.T.');
  await page.click('.modal [data-kg="register"]');
  await page.waitForSelector('.modal .kg-step.is-done .badge--ok', { timeout: 8000 });
  await page.waitForTimeout(300);
  const after = await page.evaluate(id => ({
    part: JSON.parse(localStorage.getItem('ppapi_event_participants_' + id) || '{}'),
    terdaftar: JSON.parse(localStorage.getItem('ppapi_events'))[id].terdaftar,
    meeting: document.querySelector('.modal a[href="https://zoom.us/j/1234567890"]') !== null,
    note: document.querySelector('.modal .kg-step')?.textContent || '',
    attendDisabled: document.querySelector('.modal .kg-attend')?.disabled,
    cd: document.querySelector('.modal [data-kg-cd-time]')?.textContent,
    cdLabel: document.querySelector('.modal .kg-cd__label')?.textContent,
    embedModal: document.querySelectorAll('.kg-form-modal iframe').length,
  }), idA);
  ok(after.part['demo-draf-0002'] && after.part['demo-draf-0002'].nama === 'Ir. Budi Santoso, S.T.' && after.terdaftar === 1, 'pendaftaran tersimpan dengan nama sertifikat; kursi terpakai 1', after);
  ok(after.meeting && /Meeting ID 123/.test(after.note), 'tautan ruang + catatan hanya tampil setelah terdaftar');
  ok(after.embedModal === 1, 'formulir Google penyelenggara dibuka tersemat setelah mendaftar');
  await page.locator('.kg-form-modal').getByRole('button', { name: 'Selesai' }).click();
  ok(after.attendDisabled === true && after.cdLabel === 'Dibuka dalam' && after.cd === '4 hari 00:30:00', 'sebelum jendela: tombol nonaktif + hitung mundur "Dibuka dalam 4 hari 00:30:00"', after);
  await page.screenshot({ path: path.join(SHOTS, 'flow-kegiatan-agenda-registered.png') });
  await page.keyboard.press('Escape');

  await page.goto(`${BASE}/agenda.html?id=${idB}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.modal .kg-panel', { timeout: 8000 });
  await page.waitForTimeout(300);
  const lock = await page.evaluate(() => ({ text: document.querySelector('.modal .kg-step')?.textContent || '', reg: document.querySelectorAll('.modal [data-kg="register"]').length, cta: [...document.querySelectorAll('.modal .kg-step a')].map(a => a.getAttribute('href')) }));
  ok(lock.reg === 0 && /khusus anggota berstatus Aktif/.test(lock.text), 'pelatihan "anggota Aktif": tanpa tombol daftar, penjelasan terkunci', lock);
  ok(lock.cta.some(h => /pendaftaran\.html/.test(h || '')), 'CTA menuju formulir pendaftaran anggota', lock.cta);
  const apiErr = await page.evaluate(id => PPAPI.kegiatan.register(id).then(() => 'ok', e => e.code), idB);
  ok(apiErr === 'kegiatan/khusus-aktif', 'PPAPI.kegiatan.register(pelatihan) ditolak: kegiatan/khusus-aktif', apiErr);
  await page.screenshot({ path: path.join(SHOTS, 'flow-kegiatan-agenda-locked.png') });
  await page.keyboard.press('Escape');
  const attEarly = await page.evaluate(id => PPAPI.kegiatan.attend(id).then(() => 'ok', e => e.code), idA);
  ok(attEarly === 'kegiatan/hadir-belum', 'attend() sebelum jendela ditolak: kegiatan/hadir-belum', attEarly);
}

/* ======================================================================= */
console.log('\n[K4] Anggota Aktif — mendaftar kedua kegiatan (kuota pelatihan 2)');
{
  await signInAs(DEMO_USER, DEMO_MEMBER, false);
  await page.goto(`${BASE}/agenda.html`, { waitUntil: 'networkidle' });
  const r = await page.evaluate(async ([a, b]) => {
    const x = await PPAPI.kegiatan.register(a); const y = await PPAPI.kegiatan.register(b);
    return [x.nama, y.nama, JSON.parse(localStorage.getItem('ppapi_events'))[b].terdaftar];
  }, [idA, idB]);
  ok(r[0] === 'Rahmat Hidayat' && r[1] === 'Rahmat Hidayat' && r[2] === 1, 'anggota Aktif terdaftar di webinar & pelatihan', r);
}

/* ======================================================================= */
console.log('\n[K5] Jendela daftar hadir — nonaktif sebelum, aktif pada selesai−30 menit, nonaktif setelah selesai+3 jam');
{
  await signInAs(DRAF_USER, DRAF_MEMBER, false);
  await ctx.clock.setFixedTime(T('2026-10-25T10:29:30'));
  await page.goto(`${BASE}/agenda.html?id=${idA}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.modal .kg-attend', { timeout: 8000 });
  await page.waitForTimeout(300);
  let s = await page.evaluate(() => ({ dis: document.querySelector('.modal .kg-attend').disabled, cd: document.querySelector('.modal [data-kg-cd-time]')?.textContent }));
  ok(s.dis === true && s.cd === '00:00:30', '10.29.30 WIB: nonaktif, dibuka dalam 00:00:30', s);
  await ctx.clock.setFixedTime(T('2026-10-25T10:30:00'));
  await page.waitForFunction(() => document.querySelector('.modal .kg-attend') && !document.querySelector('.modal .kg-attend').disabled, null, { timeout: 4000 }).catch(() => {});
  s = await page.evaluate(() => ({ dis: document.querySelector('.modal .kg-attend').disabled, label: document.querySelector('.modal .kg-cd__label')?.textContent, cd: document.querySelector('.modal [data-kg-cd-time]')?.textContent, live: document.querySelector('.modal [data-kg-live]')?.textContent }));
  ok(s.dis === false && s.label === 'Ditutup dalam' && s.cd === '03:30:00', '10.30.00 WIB (selesai − 30 menit): tombol aktif otomatis, ditutup dalam 03:30:00', s);
  ok(s.live === 'Daftar hadir sudah dibuka.', 'pengumuman pembaca layar saat jendela dibuka', s.live);
  await page.screenshot({ path: path.join(SHOTS, 'flow-kegiatan-attend-open.png') });
  await ctx.clock.setFixedTime(T('2026-10-25T10:42:00'));
  await page.click('.modal [data-kg="attend"]');
  await page.waitForSelector('.modal [data-kg="cert"]', { timeout: 8000 });
  const att = await page.evaluate(id => JSON.parse(localStorage.getItem('ppapi_event_attendance_' + id) || '{}'), idA);
  ok(att['demo-draf-0002'] && att['demo-draf-0002'].at === '2026-10-25T03:42:00.000Z' && att['demo-draf-0002'].nama === 'Ir. Budi Santoso, S.T.', 'kehadiran tercatat (waktu & nama sertifikat)', att);
  ok(await page.locator('.modal .kg-step', { hasText: 'Hadir' }).count() >= 1 && await page.locator('.modal .kg-inline-btn[data-kg="rename"]').count() === 0, 'setelah hadir: status "Hadir", nama terkunci');

  console.log('\n[K6] Sertifikat PDF — nomor unik, nama, QR; verifikasi publik');
  const dl = page.waitForEvent('download');
  await page.click('.modal [data-kg="cert"]');
  const file = await dl;
  const buf = fs.readFileSync(await file.path());
  const txt = buf.toString('latin1');
  ok(file.suggestedFilename() === 'sertifikat-ppapi-sert-2026-web1025-0001.pdf', 'nama berkas mengikuti nomor', file.suggestedFilename());
  ok(txt.startsWith('%PDF-') && /\/Subtype \/Image/.test(txt), 'berkas PDF valid dengan gambar desain latar');
  ok(txt.includes('(Ir. Budi Santoso, S.T.)'), 'PDF memuat nama peserta');
  ok(txt.includes('(Nomor: PPAPI/SERT/2026/WEB1025/0001)'), 'PDF memuat nomor PPAPI/SERT/2026/WEB1025/0001');
  ok(txt.includes('(Webinar Inspeksi Perancah Sebelum Digunakan)') && txt.includes('(25 Oktober 2026)'), 'PDF memuat judul & tanggal kegiatan');
  ok((txt.match(/ re\n?f/g) || txt.match(/ re/g) || []).length > 100, 'kode QR digambar sebagai modul vektor');
  fs.writeFileSync(path.join(SHOTS, 'flow-kegiatan-sertifikat.pdf'), buf);
  await page.waitForSelector('.modal .kg-no', { timeout: 6000 });
  ok((await page.locator('.modal .kg-no').textContent()) === 'PPAPI/SERT/2026/WEB1025/0001', 'panel menampilkan nomor sertifikat + tautan periksa keaslian');
  const again = await page.evaluate(id => PPAPI.kegiatan.issueCertificate(id).then(r => r.display), idA);
  ok(again === 'PPAPI/SERT/2026/WEB1025/0001', 'unduh ulang memakai nomor yang sama (tidak bertambah)', again);
  await page.keyboard.press('Escape');

  // halaman verifikasi
  await page.goto(`${BASE}/sertifikat.html?no=${encodeURIComponent('PPAPI/SERT/2026/WEB1025/0001')}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.sf-card', { timeout: 6000 });
  let v = await page.evaluate(() => ({ eyebrow: document.querySelector('.sf-card .eyebrow').textContent, name: document.querySelector('.sf-card__title').textContent, no: document.querySelector('.sf-card__no').textContent, kv: document.querySelector('.sf-card__kv').textContent }));
  ok(v.eyebrow === 'Sertifikat sah' && v.name === 'Ir. Budi Santoso, S.T.' && v.no === 'PPAPI/SERT/2026/WEB1025/0001' && /Webinar Inspeksi/.test(v.kv) && /25 Oktober 2026/.test(v.kv), 'verifikasi ?no= → sah, nama & kegiatan', v);
  await page.screenshot({ path: path.join(SHOTS, 'flow-kegiatan-verifikasi-sah.png'), fullPage: true });
  await page.fill('#sf-no', 'ppapi-sert-2026-web1025-0001');
  await page.click('.sf-form button[type="submit"]');
  await page.waitForTimeout(300);
  ok(await page.locator('.sf-card--ok').count() === 1 && new URL(page.url()).searchParams.get('no') === 'PPAPI/SERT/2026/WEB1025/0001', 'nomor huruf kecil + tanda hubung dikenali; URL dinormalkan');
  await page.fill('#sf-no', 'PPAPI/SERT/2026/WEB1025/0099');
  await page.click('.sf-form button[type="submit"]');
  await page.waitForTimeout(300);
  ok(await page.locator('.sf-none .empty-state__title', { hasText: 'Nomor tidak ditemukan' }).count() === 1, 'nomor tidak terdaftar → "Nomor tidak ditemukan"');
  await page.fill('#sf-no', 'abc');
  await page.click('.sf-form button[type="submit"]');
  ok(await page.locator('[data-sf="field"].is-invalid').count() === 1, 'format salah → pesan galat pada isian');

  console.log('\n[K7] Setelah selesai + 3 jam — tombol nonaktif bagi peserta yang belum hadir');
  await signInAs(DEMO_USER, DEMO_MEMBER, false);
  await ctx.clock.setFixedTime(T('2026-10-25T13:59:00'));
  await page.goto(`${BASE}/agenda.html?id=${idA}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.modal .kg-attend', { timeout: 8000 });
  await page.waitForTimeout(300);
  ok(!(await page.locator('.modal .kg-attend').isDisabled()), '13.59 WIB: masih dibuka');
  await ctx.clock.setFixedTime(T('2026-10-25T14:00:01'));
  await page.waitForFunction(() => document.querySelector('.modal .kg-attend')?.disabled === true, null, { timeout: 4000 }).catch(() => {});
  s = await page.evaluate(() => ({ dis: document.querySelector('.modal .kg-attend').disabled, text: document.querySelector('.modal .kg-step.is-closed')?.textContent || '' }));
  ok(s.dis === true && /sudah ditutup pada Minggu, 25 Oktober 2026 pukul 14\.00 WIB/.test(s.text), '14.00.01 WIB (selesai + 3 jam): nonaktif otomatis, "sudah ditutup"', s);
  const late = await page.evaluate(id => PPAPI.kegiatan.attend(id).then(() => 'ok', e => e.code), idA);
  ok(late === 'kegiatan/hadir-tutup', 'attend() setelah jendela ditolak: kegiatan/hadir-tutup', late);
  const noCert = await page.evaluate(id => PPAPI.kegiatan.issueCertificate(id).then(() => 'ok', e => e.code), idA);
  ok(noCert === 'kegiatan/belum-hadir', 'sertifikat tidak terbit tanpa daftar hadir', noCert);
  await page.screenshot({ path: path.join(SHOTS, 'flow-kegiatan-attend-closed.png') });
  await page.keyboard.press('Escape');
}

/* ======================================================================= */
console.log('\n[K8] Kegiatan Saya (render untuk dasbor)');
{
  await signInAs(DRAF_USER, DRAF_MEMBER, false);
  await ctx.clock.setFixedTime(T('2026-10-25T15:00:00'));
  await page.goto(`${BASE}/__kegiatan_saya.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ready === true);
  const k = await page.evaluate(() => ({ cards: document.querySelectorAll('.kgs-card').length, title: document.querySelector('.kgs-card__title')?.textContent, no: document.querySelector('.kgs-card .kg-no')?.textContent, hadir: !!document.querySelector('.kgs-card .kg-step.is-done .badge--ok'), count: window.__kgs.count }));
  ok(k.cards === 1 && k.count === 1 && k.title === 'Webinar Inspeksi Perancah Sebelum Digunakan' && k.no === 'PPAPI/SERT/2026/WEB1025/0001' && k.hadir, 'Kegiatan Saya: 1 kegiatan, hadir, nomor sertifikat', k);
  await page.screenshot({ path: path.join(SHOTS, 'flow-kegiatan-saya-desktop.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(200);
  ok(await overflow() <= 1, 'Kegiatan Saya tanpa luapan pada 390 px');
  await page.screenshot({ path: path.join(SHOTS, 'flow-kegiatan-saya-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await signInAs(DEMO_USER, DEMO_MEMBER, false);
  await page.goto(`${BASE}/__kegiatan_saya.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ready === true);
  ok(await page.locator('.kgs-card').count() === 2, 'anggota Aktif: 2 kegiatan (pelatihan akan datang di atas)');
}

/* ======================================================================= */
console.log('\n[K9] Admin — peserta, CSV, daftar hadir, sertifikat terbit, pencabutan');
{
  await signInAs(ADMIN, null, true);
  await page.goto(`${BASE}/__kegiatan_admin.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ready === true);
  await page.click(`.kga-table [data-kga="manage"][data-id="${idA}"] >> nth=0`);
  await page.waitForSelector('.drawer .tabs', { timeout: 8000 });
  ok(await page.locator('#kgp-peserta tbody tr').count() === 2, 'tab Peserta: 2 peserta');
  const dl = page.waitForEvent('download');
  await page.click('#kgp-peserta [data-kgm="csv"]');
  const csv = fs.readFileSync(await (await dl).path(), 'utf8');
  ok(csv.charCodeAt(0) === 0xFEFF && /Ir\. Budi Santoso, S\.T\./.test(csv) && /;Ya;/.test(csv) && /PPAPI\/SERT\/2026\/WEB1025\/0001/.test(csv), 'CSV: BOM, nama, hadir, nomor sertifikat', csv.slice(0, 300));
  await page.click('.drawer .tabs__tab[data-tab="hadir"]');
  ok(await page.locator('#kgp-hadir tbody tr').count() === 1, 'tab Daftar Hadir: 1 orang hadir');
  await page.click('.drawer .tabs__tab[data-tab="sertifikat"]');
  await page.waitForSelector('#kgp-sertifikat [data-kgm="revoke"]');
  await page.click('#kgp-sertifikat [data-kgm="revoke"]');
  await page.locator('#kga-alasan').fill('Diterbitkan atas nama yang keliru.');
  await page.getByRole('button', { name: 'Cabut Sertifikat' }).click();
  await page.waitForSelector('#kgp-sertifikat .badge--err', { timeout: 6000 });
  ok(true, 'admin mencabut sertifikat');
  // tandai hadir manual (peserta kedua)
  await page.click('.drawer .tabs__tab[data-tab="peserta"]');
  await page.click('#kgp-peserta [data-kgm="mark"]');
  await page.waitForTimeout(400);
  ok(await page.locator('#kgp-peserta .badge--ok', { hasText: 'Hadir' }).count() === 2, 'admin menandai hadir peserta kedua');
  await page.screenshot({ path: path.join(SHOTS, 'flow-kegiatan-admin-manage.png') });
  const log = await page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_audit_log') || '[]').map(x => x.action));
  ok(log.includes('kegiatan.disimpan') && log.includes('kegiatan.desain') && log.includes('sertifikat.dicabut') && log.includes('kegiatan.hadir-ditandai'), 'log aktivitas admin tercatat', log);
  await page.goto(`${BASE}/sertifikat.html?no=PPAPI-SERT-2026-WEB1025-0001`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.sf-card');
  ok(await page.locator('.sf-card--err', { hasText: 'Diterbitkan atas nama yang keliru.' }).count() === 1, 'verifikasi publik menampilkan "Dicabut" + alasannya');
  await page.screenshot({ path: path.join(SHOTS, 'flow-kegiatan-verifikasi-dicabut.png') });
  // ubah → draf → hilang dari agenda
  await page.goto(`${BASE}/__kegiatan_admin.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__ready === true);
  await page.click(`.kga-table [data-kga="manage"][data-id="${idB}"] >> nth=0`);
  await page.waitForSelector('.drawer [data-kgm="draft"]');
  await page.click('.drawer [data-kgm="draft"]');
  await page.waitForTimeout(400);
  ok((await events())[idB].status === 'draf', 'pelatihan dijadikan draf');
  await page.goto(`${BASE}/agenda.html`, { waitUntil: 'networkidle' });
  ok(await page.locator('.agenda-row').count() === 1, 'draf tidak tampil di agenda publik');
  const hiddenGet = await page.evaluate(async id => { localStorage.removeItem('ppapi_demo_session'); return 'x'; }, idB);
}

/* ======================================================================= */
console.log('\n[K10] Aturan Firestore (fragmen) — pemeriksaan statis');
{
  const rules = fs.readFileSync(path.resolve(__dirname, '..', 'rules-fragments', 'kegiatan.rules'), 'utf8');
  const code = rules.replace(/'(?:[^'\\]|\\.)*'/g, "''").replace(/\/\/.*$/gm, '');
  const bal = (o, c) => (code.split(o).length - 1) === (code.split(c).length - 1);
  ok(bal('{', '}') && bal('(', ')') && bal('[', ']'), 'kurung seimbang');
  ok(/request\.time >= ev\.hadirBuka && request\.time <= ev\.hadirTutup/.test(rules), 'daftar hadir: request.time di antara hadirBuka & hadirTutup');
  ok(/hadirBuka == d\.selesaiAt - duration\.value\(30, 'm'\)/.test(rules) && /hadirTutup == d\.selesaiAt \+ duration\.value\(3, 'h'\)/.test(rules), 'hadirBuka/hadirTutup terikat pada selesaiAt (30 menit / 3 jam)');
  ok(/d\.at == request\.time/.test(rules) && /exists\(partPath\(eid, uid\)\)|get\(partPath\(eid, uid\)\)/.test(rules), 'waktu hadir = waktu server; wajib terdaftar');
  ok(/ev\.akses == 'semua' \|\| isActiveMember\(\) \|\| isAdmin\(\)/.test(rules), 'pendaftaran mengikuti akses (semua akun / anggota Aktif)');
  ok(/match \/certificates\/\{no\}[\s\S]*allow get: if true;[\s\S]*allow list: if isAdmin\(\);/.test(rules), 'sertifikat: get publik, list hanya admin');
  const fns = [...code.matchAll(/function (\w+)\(/g)].map(m => m[1]);
  const existing = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
  /* integrasi 2026-10-21: fragmen sudah digabung ke site/firestore.rules → setiap fungsinya ada TEPAT satu kali
     di berkas gabungan (tidak bentrok, tidak tertinggal), dan seluruh nama fungsi di berkas itu unik */
  const once = fns.filter(f => (existing.match(new RegExp('function ' + f + '\\(', 'g')) || []).length !== 1);
  ok(once.length === 0, 'fragmen kegiatan tergabung di firestore.rules; nama fungsi tidak bentrok', once);
  const allFns = [...existing.matchAll(/function (\w+)\(/g)].map(m => m[1]);
  ok(new Set(allFns).size === allFns.length, 'firestore.rules: semua nama fungsi unik', allFns.filter((f, i) => allFns.indexOf(f) !== i));
  ok(existing.indexOf('match /events/{eid}') > 0 && existing.indexOf('match /events/{eid}') < existing.indexOf('match /{document=**}'), 'blok kegiatan berada sebelum aturan penutup');
  ok(['signedIn', 'isOwner', 'isAdmin', 'isActiveMember', 'strMax'].every(f => new RegExp('function ' + f + '\\(').test(existing)), 'fungsi bantu yang dipakai tersedia di firestore.rules');
}

ok(errors.length === 0, 'tanpa galat konsol/halaman/HTTP', errors);
await browser.close();
server.close();
console.log(`\n${pass} lulus, ${fail} gagal.`);
process.exit(fail ? 1 : 0);
