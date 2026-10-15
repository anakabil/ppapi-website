// Art-direction review v2 — captures every v2 page/state the AD lens needs, desktop 1440 + mobile 390.
// Run from devtools/:  node flows/ad-v2-shots.mjs [--only=substr,substr] [--vp=desktop|mobile] [--force]
// Output: devtools/shots/ad2/<state>-<vp>.png (full page unless the state says viewport/element).
// Resumable: existing PNGs are skipped unless --force.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const OUT = path.resolve(__dirname, '..', 'shots', 'ad2');
fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const ONLY = String(flags.only || '').split(',').filter(Boolean);

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json' };
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

/* ---------- fixtures ---------- */
const U = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
const emptyApp = () => ({ type: 'baru', kategori: '', submittedAt: '', updatedAt: '', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: false, kebenaranData: false, privasi: false, namaTerang: '', tanggal: '' }, catatan: '' });
const filledApp = (submitted) => ({
  type: 'baru', kategori: 'Praktisi', submittedAt: submitted ? '2026-10-06T03:20:00.000Z' : '', updatedAt: '2026-10-06T03:20:00.000Z',
  pengalaman: [
    { id: 'p1', proyek: 'Pembangunan kilang RDMP Balikpapan — area CDU', peran: 'Supervisor perancah', tahun: '2024', lokasi: 'Balikpapan' },
    { id: 'p2', proyek: 'Gedung perkantoran 24 lantai', peran: 'Mandor pemasangan perancah', tahun: '2021', lokasi: 'Jakarta Selatan' },
  ],
  dokumen: [
    { id: 'd1', jenis: 'CV', label: 'Daftar riwayat hidup', url: 'https://drive.google.com/file/d/contoh-cv/view' },
    { id: 'd2', jenis: 'Sertifikat', label: 'Sertifikat Teknisi Perancah', url: 'https://drive.google.com/file/d/contoh-sert/view' },
  ],
  pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' },
  pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Rahmat Hidayat', tanggal: '2026-10-06' },
  catatan: 'Bersedia mengikuti verifikasi lanjutan bila diperlukan.',
});
function member(status, variant) {
  const m = {
    uid: U.uid, name: U.name, email: U.email, phone: U.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31',
    approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001', createdAt: '2026-03-14T09:00:00.000Z',
    profile: { birthPlace: 'Balikpapan', birthDate: '1988-06-21', gender: 'Laki-laki', city: 'Balikpapan', province: 'Kalimantan Timur', address: 'Jl. Contoh Jenderal Sudirman No. 12', company: 'PT Contoh Konstruksi', position: 'Scaffolding Supervisor', experienceYears: 9, education: 'Diploma III (D3)', bio: 'Supervisor perancah dengan pengalaman proyek kilang dan gedung bertingkat.', linkedin: '' },
    competencies: [{ id: 'k1', code: 'SCF-SUP', name: 'Supervisor Perancah', level: 'Mahir', since: 2019, notes: '' }, { id: 'k2', code: 'SCF-INS', name: 'Inspektur Perancah', level: 'Menengah', since: 2022, notes: '' }],
    certificates: [{ id: 'c1', title: 'Teknisi Perancah', number: 'CONTOH/001/2024', issuer: 'Kemnaker RI', issuedAt: '2024-02-10', expiresAt: '2027-02-10', link: '' }, { id: 'c2', title: 'Ahli K3 Umum', number: 'CONTOH/002/2021', issuer: 'Kemnaker RI', issuedAt: '2021-11-02', expiresAt: '2026-11-20', link: '' }],
    updatedAt: '2026-09-30T08:00:00.000Z', application: filledApp(true), review: { note: '', history: [] },
  };
  const blank = () => { m.kta = ''; m.validUntil = ''; m.approvedAt = ''; m.approvedBy = ''; };
  if (status === 'Kedaluwarsa') { m.validUntil = '2026-06-30'; return m; }
  if (status === 'Aktif-60') { m.validUntil = '2026-11-20'; return m; }
  m.status = status;
  if (status === 'Draf') {
    blank();
    if (variant === 'fresh') { m.application = emptyApp(); m.profile = { birthPlace: '', birthDate: '', gender: '', city: '', province: '', address: '', company: '', position: '', experienceYears: null, education: '', bio: '', linkedin: '' }; m.competencies = []; m.certificates = []; m.phone = ''; }
    else m.application = filledApp(false);
  }
  if (status === 'Menunggu Verifikasi') { blank(); m.review = { note: '', history: [{ at: '2026-10-06T03:20:00.000Z', by: U.uid, byName: U.name, action: 'diajukan', note: '' }] }; }
  if (status === 'Perlu Perbaikan') { blank(); m.review = { note: 'Mohon lengkapi tautan sertifikat dan riwayat proyek.', history: [{ at: '2026-10-06T03:20:00.000Z', by: U.uid, byName: U.name, action: 'diajukan', note: '' }, { at: '2026-10-08T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'perbaikan', note: 'Mohon lengkapi tautan sertifikat dan riwayat proyek.' }] }; }
  if (status === 'Ditolak') { blank(); m.review = { note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.', history: [{ at: '2026-10-01T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'ditolak', note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.' }] }; }
  if (status === 'Nonaktif') { m.review = { note: 'Keanggotaan dibekukan sementara karena iuran belum dilunasi.', history: [{ at: '2026-09-01T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'dinonaktifkan', note: 'Keanggotaan dibekukan sementara karena iuran belum dilunasi.' }] }; }
  return m;
}
const FEEDBACK = [
  { id: 'UB-20261007-AB12', kategori: 'Saran', nama: 'Yusuf Prakoso (Contoh)', email: 'yusuf@contoh.id', phone: '', subjek: 'Jadwal pelatihan inspektur', pesan: 'Mohon jadwal pelatihan inspektur perancah diumumkan lebih awal agar perusahaan dapat mengatur penugasan.', rating: 4, anonim: false, uid: null, halaman: 'agenda.html', createdAt: '2026-10-07T02:00:00.000Z', status: 'Baru', catatanAdmin: '' },
  { id: 'UB-20261003-CD34', kategori: 'Pertanyaan', nama: 'Rina Kartika (Contoh)', email: 'rina@contoh.id', phone: '+6281100000002', subjek: 'Verifikasi KTA', pesan: 'Apakah nomor KTA dapat diverifikasi oleh pemberi kerja melalui situs ini?', rating: null, anonim: false, uid: null, halaman: 'verifikasi.html', createdAt: '2026-10-03T05:30:00.000Z', status: 'Diproses', catatanAdmin: 'Sudah dijawab via telepon.' },
  { id: 'UB-20260921-EF56', kategori: 'Apresiasi', nama: '', email: '', phone: '', subjek: '', pesan: 'Situs baru sangat membantu, terutama halaman regulasi.', rating: 5, anonim: true, uid: null, halaman: 'regulasi.html', createdAt: '2026-09-21T01:00:00.000Z', status: 'Selesai', catatanAdmin: '' },
];

/* seed: { as: 'out'|'member'|'admin', status, variant, ribbon (show), feedback } */
async function seedCtx(ctx, seed) {
  await ctx.addInitScript(({ s, u, m, a, fb }) => {
    try {
      if (sessionStorage.getItem('__ad2')) return;
      sessionStorage.setItem('__ad2', '1');
      if (!s.ribbon) localStorage.setItem('ppapi_demo_ribbon_dismissed', 'true');
      if (s.as === 'member') {
        localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
        const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
        users[u.email] = { uid: u.uid, name: u.name, email: u.email, phone: u.phone, provider: u.provider, createdAt: u.createdAt, hash: 'x' };
        localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
        localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
      }
      if (s.as === 'admin') {
        localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
        localStorage.setItem('ppapi_demo_admins', JSON.stringify([a.uid]));
        if (s.feedback) localStorage.setItem('ppapi_feedback', JSON.stringify(fb));
      }
    } catch (e) { /* ignore */ }
  }, { s: seed, u: U, m: seed.as === 'member' ? member(seed.status || 'Aktif', seed.variant) : null, a: ADMIN, fb: FEEDBACK });
}

/* ---------- helpers for states ---------- */
const wait = ms => new Promise(r => setTimeout(r, ms));
async function dafReady(page) { await page.waitForFunction(() => { const r = document.getElementById('daf-root'); return r && r.getAttribute('aria-busy') === 'false' && r.getAttribute('data-view'); }, null, { timeout: 15000 }).catch(() => {}); await wait(300); }
async function admReady(page) { await page.waitForFunction(() => document.querySelector('.adm-nav__link') && !document.querySelector('.adm-section:not([hidden]) .skeleton'), null, { timeout: 15000 }).catch(() => {}); await wait(600); }
async function admNav(page, s) { await page.evaluate(x => { location.hash = x; }, s); await page.waitForFunction(x => { const e = document.getElementById('sec-' + x.split('/')[0]); return e && !e.hidden; }, s, { timeout: 8000 }).catch(() => {}); await wait(700); }
async function modalOpen(page) { await page.waitForSelector('.modal, .drawer', { state: 'visible', timeout: 8000 }).catch(() => {}); await wait(500); }

const S = [];
const add = (id, p, seed, opt = {}) => S.push({ id, path: p, seed, ...opt });
// --- pendaftaran
add('daf-01-kategori', 'pendaftaran.html#kategori', { as: 'member', status: 'Draf', variant: 'fresh' }, { ready: dafReady });
add('daf-02-datadiri-empty', 'pendaftaran.html#data-diri', { as: 'member', status: 'Draf', variant: 'fresh' }, { ready: dafReady });
add('daf-02-datadiri-error', 'pendaftaran.html#data-diri', { as: 'member', status: 'Draf', variant: 'fresh' }, { ready: dafReady, prep: async p => { await p.click('.daf-foot__next'); await wait(600); await p.evaluate(() => scrollTo(0, 0)); } });
add('daf-02-datadiri', 'pendaftaran.html#data-diri', { as: 'member', status: 'Draf', variant: 'filled' }, { ready: dafReady });
add('daf-03-profesional', 'pendaftaran.html#profesional', { as: 'member', status: 'Draf', variant: 'filled' }, { ready: dafReady });
add('daf-04-kompetensi', 'pendaftaran.html#kompetensi', { as: 'member', status: 'Draf', variant: 'filled' }, { ready: dafReady });
add('daf-04-kompetensi-empty', 'pendaftaran.html#kompetensi', { as: 'member', status: 'Draf', variant: 'fresh' }, { ready: dafReady });
add('daf-05-dokumen', 'pendaftaran.html#dokumen', { as: 'member', status: 'Draf', variant: 'filled' }, { ready: dafReady });
add('daf-06-pernyataan', 'pendaftaran.html#pernyataan', { as: 'member', status: 'Draf', variant: 'filled' }, { ready: dafReady });
add('daf-07-tinjau', 'pendaftaran.html#tinjau', { as: 'member', status: 'Draf', variant: 'filled' }, { ready: dafReady });
add('daf-07-tinjau-incomplete', 'pendaftaran.html#tinjau', { as: 'member', status: 'Draf', variant: 'fresh' }, { ready: dafReady });
add('daf-08-terkirim', 'pendaftaran.html#tinjau', { as: 'member', status: 'Draf', variant: 'filled' }, { ready: dafReady, prep: async p => { await p.click('.daf-foot__next'); await p.waitForFunction(() => document.getElementById('daf-root').getAttribute('data-view') === 'pending', null, { timeout: 8000 }).catch(() => {}); await wait(700); await p.evaluate(() => scrollTo(0, 0)); } });
add('daf-09-menunggu', 'pendaftaran.html', { as: 'member', status: 'Menunggu Verifikasi' }, { ready: dafReady });
add('daf-09-tarik-dialog', 'pendaftaran.html', { as: 'member', status: 'Menunggu Verifikasi' }, { ready: dafReady, shot: 'viewport', prep: async p => { await p.click('[data-action="withdraw"]'); await modalOpen(p); } });
add('daf-10-perbaikan', 'pendaftaran.html', { as: 'member', status: 'Perlu Perbaikan' }, { ready: dafReady });
add('daf-11-aktif', 'pendaftaran.html', { as: 'member', status: 'Aktif' }, { ready: dafReady });
add('daf-12-ditolak', 'pendaftaran.html', { as: 'member', status: 'Ditolak' }, { ready: dafReady, shot: 'viewport' });
add('daf-13-perpanjangan', 'pendaftaran.html', { as: 'member', status: 'Kedaluwarsa' }, { ready: dafReady, shot: 'viewport' });
// --- admin
const AD = { as: 'admin' };
const ADF = { as: 'admin', feedback: true };
add('adm-01-ringkasan', 'admin.html#ringkasan', ADF, { ready: admReady });
add('adm-02-permohonan', 'admin.html#permohonan', AD, { ready: admReady });
add('adm-03-drawer-permohonan', 'admin.html#permohonan', AD, { ready: admReady, shot: 'viewport-scroll-drawer', prep: async p => { await p.click('#pq-list .adm-act[data-id="demo-contoh-0001"]'); await modalOpen(p); } });
add('adm-04-dialog-setujui', 'admin.html#permohonan', AD, { ready: admReady, shot: 'viewport', prep: async p => { await p.click('#pq-list .adm-act[data-id="demo-contoh-0001"]'); await modalOpen(p); await p.click('#act-approve'); await wait(700); } });
add('adm-05-dialog-perbaikan', 'admin.html#permohonan', AD, { ready: admReady, shot: 'viewport', prep: async p => { await p.click('#pq-list .adm-act[data-id="demo-contoh-0001"]'); await modalOpen(p); await p.click('#act-revise'); await wait(700); } });
add('adm-06-dialog-tolak', 'admin.html#permohonan', AD, { ready: admReady, shot: 'viewport', prep: async p => { await p.click('#pq-list .adm-act[data-id="demo-contoh-0001"]'); await modalOpen(p); await p.click('#act-reject'); await wait(700); } });
add('adm-07-anggota', 'admin.html#anggota', AD, { ready: admReady });
add('adm-08-drawer-anggota', 'admin.html#anggota', AD, { ready: admReady, shot: 'viewport-scroll-drawer', prep: async p => { await p.click('#aq-list .adm-act[data-id="demo-contoh-0003"]'); await modalOpen(p); } });
add('adm-09-dialog-nonaktif', 'admin.html#anggota', AD, { ready: admReady, shot: 'viewport', prep: async p => { await p.click('#aq-list .adm-act[data-id="demo-contoh-0003"]'); await modalOpen(p); await p.click('#act-deactivate'); await wait(700); } });
add('adm-10-konten', 'admin.html#konten/berita', AD, { ready: admReady });
add('adm-11-konten-pustaka', 'admin.html#konten/pustaka', AD, { ready: admReady });
add('adm-12-dialog-konten', 'admin.html#konten/pustaka', AD, { ready: admReady, shot: 'viewport-scroll-modal', prep: async p => { await p.click('#kt-add'); await modalOpen(p); } });
add('adm-13-umpan-balik-kosong', 'admin.html#umpan-balik', AD, { ready: admReady });
add('adm-14-umpan-balik', 'admin.html#umpan-balik', ADF, { ready: admReady });
add('adm-15-drawer-umpan-balik', 'admin.html#umpan-balik', ADF, { ready: admReady, shot: 'viewport', prep: async p => { await p.click('#fb-list .adm-act'); await modalOpen(p); } });
add('adm-16-admin', 'admin.html#admin', AD, { ready: admReady });
add('adm-17-log', 'admin.html#log', AD, { ready: admReady });
// --- pustaka
add('pus-01-keluar', 'pustaka.html', { as: 'out' });
add('pus-02-draf', 'pustaka.html', { as: 'member', status: 'Draf', variant: 'fresh' });
add('pus-03-aktif', 'pustaka.html', { as: 'member', status: 'Aktif' });
add('pus-04-admin', 'pustaka.html', AD);
add('pus-05-modal-terkunci', 'pustaka.html?id=cop-pemasangan-tube-coupler', { as: 'out' }, { shot: 'viewport' });
add('pus-06-modal-aktif', 'pustaka.html?id=cop-pemasangan-tube-coupler', { as: 'member', status: 'Aktif' }, { shot: 'viewport' });
add('pus-07-modal-regulasi', 'pustaka.html?id=formulir-daftar-periksa-inspeksi', { as: 'member', status: 'Aktif' }, { shot: 'viewport' });
add('pus-08-daftar', 'pustaka.html?tampilan=daftar', { as: 'member', status: 'Aktif' });
// --- dashboard
for (const st of ['Draf', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Ditolak', 'Nonaktif', 'Kedaluwarsa']) add('dash-' + st.toLowerCase().replace(/\s+/g, '-'), 'dashboard.html', { as: 'member', status: st, variant: st === 'Draf' ? 'fresh' : undefined });
add('dash-aktif', 'dashboard.html', { as: 'member', status: 'Aktif' });
add('dash-aktif-60', 'dashboard.html', { as: 'member', status: 'Aktif-60' });
add('dash-admin', 'dashboard.html', AD);
// --- anggota
add('agt-aktif', 'anggota.html', { as: 'member', status: 'Aktif' });
add('agt-aplikasi', 'anggota.html#aplikasi', { as: 'member', status: 'Aktif' });
// --- masuk / keanggotaan / index
add('masuk-demo', 'masuk.html', { as: 'out', ribbon: true });
add('masuk-daftar', 'masuk.html#daftar', { as: 'out', ribbon: true });
add('kea-keluar', 'keanggotaan.html', { as: 'out' });
add('kea-draf', 'keanggotaan.html', { as: 'member', status: 'Draf', variant: 'fresh' });
add('idx-keluar', 'index.html', { as: 'out' });
add('idx-aktif', 'index.html', { as: 'member', status: 'Aktif' });
add('idx-perbaikan', 'index.html', { as: 'member', status: 'Perlu Perbaikan' });
// --- apps (first viewport only)
add('app-perencanaan', 'aplikasi/perencanaan/index.html', { as: 'member', status: 'Aktif' }, { shot: 'viewport', wait: 2500 });
add('app-simulator', 'aplikasi/simulator/index.html', { as: 'member', status: 'Aktif' }, { shot: 'viewport', wait: 2500 });
add('app-perencanaan-admin', 'aplikasi/perencanaan/index.html', AD, { shot: 'viewport', wait: 2500 });

const VPS = [];
if (flags.vp !== 'mobile') VPS.push({ name: 'desktop', width: 1440, height: 900 });
if (flags.vp !== 'desktop') VPS.push({ name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, dpr: 2 });

// swiftshader caps screenshots at 8192 device px (page top repeats below) — use it only for the WebGL apps
const browserPlain = await chromium.launch();
const browserGL = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const log = [];
for (const st of S) {
  if (ONLY.length && !ONLY.some(o => st.id.includes(o))) continue;
  for (const vp of VPS) {
    const file = path.join(OUT, `${st.id}-${vp.name}.png`);
    if (fs.existsSync(file) && !flags.force) continue;
    const browser = st.path.startsWith('aplikasi/') ? browserGL : browserPlain;
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.dpr || 1, reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
    await seedCtx(ctx, st.seed);
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text().slice(0, 200)); });
    try {
      await page.goto(`${BASE}/${st.path}`, { waitUntil: 'networkidle', timeout: 30000 });
      if (st.ready) await st.ready(page);
      await wait(st.wait || 900);
      if (!/viewport/.test(st.shot || '')) {
        await page.evaluate(async () => { const step = Math.round(innerHeight * 0.8); for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); } scrollTo(0, 0); });
        await wait(500);
      }
      if (st.prep) await st.prep(page, vp);
      const shot = st.shot || 'full';
      if (shot === 'full') await page.screenshot({ path: file, fullPage: true });
      else if (shot === 'viewport') await page.screenshot({ path: file });
      else if (shot.startsWith('viewport-scroll')) {
        // first viewport + additional frames of the scrolled drawer/modal body
        await page.screenshot({ path: file });
        const sel = shot.endsWith('drawer') ? ['.drawer__body'] : ['.modal__body', '.modal__panel', '.modal__dialog', '.modal'];
        const info = await page.evaluate(ss => { let el = null; for (const s of ss) { el = [...document.querySelectorAll(s)].find(e => e.scrollHeight > e.clientHeight + 4 && getComputedStyle(e).overflowY !== 'visible'); if (el) break; } if (!el) return null; el.setAttribute('data-ad2-scroll', '1'); return { sh: el.scrollHeight, ch: el.clientHeight }; }, sel);
        if (info) {
          let k = 1;
          for (let y = info.ch - 60; y < info.sh && k < 6; y += info.ch - 60, k++) {
            await page.evaluate(yy => { document.querySelector('[data-ad2-scroll]').scrollTop = yy; }, y);
            await wait(250);
            await page.screenshot({ path: file.replace(/\.png$/, `-s${k}.png`) });
          }
        }
      }
      const meta = await page.evaluate(() => ({ url: location.pathname + location.hash, h: document.documentElement.scrollHeight, ov: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
      log.push(`${st.id}-${vp.name}: ${meta.url} h=${meta.h} ov=${meta.ov}${errs.length ? ' ERR ' + errs.join(' | ') : ''}`);
      console.log(log[log.length - 1]);
    } catch (e) { console.log(`${st.id}-${vp.name}: FAILED ${e.message.split('\n')[0]}`); }
    await ctx.close();
  }
}
fs.appendFileSync(path.join(OUT, '_log.txt'), log.join('\n') + '\n');
await browserPlain.close(); await browserGL.close();
server.close();
