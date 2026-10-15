// Security lens v2 — stored XSS / HTML injection through every member-, visitor- and admin-controlled field.
// Demo mode: payloads are written straight into localStorage (= data that reached Firestore around the
// store, e.g. through the SDK or the console), then every consumer is rendered: admin console (all
// sections, every drawer/modal), dashboard, anggota (all tabs + KTA), pendaftaran (wizard steps, review,
// pending summary), public pages (index, berita, agenda, pustaka, regulasi, verifikasi) and the CSV export.
// Every payload calls __x(<id>) → hits are mapped back to the field. Also scans the DOM for on* attributes,
// javascript:/data: links, injected <img src=x>/<svg>.
// Run from devtools/:  node flows/sec-v2-xss.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.resolve(__dirname, '..', 'shots');
const { BASE, close } = await startServer();

let n = 0; const MAP = {};
const P = f => { const i = ++n; MAP[i] = f; return `<img src=x onerror=__x(${i})>`; };
const Q = f => { const i = ++n; MAP[i] = f; return `"'><svg onload=__x(${i})>`; };
const J = f => { const i = ++n; MAP[i] = f; return `javascript:__x(${i})`; };
const T = f => P(f) + Q(f);   /* both forms (text + attribute break-out) */

const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
function evilMember(uid, status, tag) {
  const t = k => tag + '.' + k;
  return {
    uid, name: 'Evil ' + T(t('name')), email: 'evil@contoh.id' + Q(t('email')), phone: '+62812' + P(t('phone')), photoURL: J(t('photoURL')),
    kta: status === 'Aktif' ? 'PPAPI-2026-0' + (uid.slice(-5)) : '', memberType: 'Praktisi' + P(t('memberType')), status,
    joinedAt: '2026-03-14' + P(t('joinedAt')), validUntil: status === 'Aktif' ? '2029-12-31' : '', approvedAt: status === 'Aktif' ? '2026-03-20T03:00:00.000Z' : '',
    approvedBy: P(t('approvedBy')),
    profile: {
      birthPlace: T(t('birthPlace')), birthDate: '1990-01-01' + P(t('birthDate')), gender: T(t('gender')), city: T(t('city')), province: T(t('province')),
      address: T(t('address')), company: T(t('company')), position: T(t('position')), experienceYears: 9, education: T(t('education')), bio: T(t('bio')),
      linkedin: 'https://linkedin.com/in/x"onmouseover=__x(1)' + T(t('linkedin'))
    },
    competencies: [{ id: Q(t('comp.id')), code: T(t('comp.code')), name: 'Supervisor ' + T(t('comp.name')), level: 'Mahir' + P(t('comp.level')), since: 2019, notes: T(t('comp.notes')) }],
    certificates: [
      { id: Q(t('cert.id')), title: 'Teknisi ' + T(t('cert.title')), number: T(t('cert.number')), issuer: T(t('cert.issuer')), issuedAt: '2024-02-10' + P(t('cert.issuedAt')), expiresAt: '2027-02-10' + P(t('cert.expiresAt')), link: J(t('cert.link')) },
      { id: 'c2', title: 'Data URL', number: '', issuer: '', issuedAt: '', expiresAt: '', link: 'data:text/html,<script>__x(0)</script>' },
    ],
    createdAt: '2026-03-14T09:00:00.000Z' + P(t('createdAt')), updatedAt: '2026-09-30T08:00:00.000Z' + P(t('updatedAt')),
    application: {
      type: 'baru', kategori: 'Praktisi', submittedAt: status === 'Draf' ? '' : '2026-10-01T02:00:00.000Z' + P(t('submittedAt')), updatedAt: '2026-10-01T02:00:00.000Z' + P(t('app.updatedAt')),
      pengalaman: [{ id: Q(t('peng.id')), proyek: T(t('peng.proyek')), peran: T(t('peng.peran')), tahun: '2024' + P(t('peng.tahun')), lokasi: T(t('peng.lokasi')) }],
      dokumen: [
        { id: Q(t('dok.id')), jenis: 'CV' + P(t('dok.jenis')), label: T(t('dok.label')), url: J(t('dok.url')) },
        { id: 'd2', jenis: 'Lainnya', label: 'https quote', url: 'https://x.example/a"onmouseover="__x(2)' },
        { id: 'd3', jenis: 'Lainnya', label: 'data url', url: 'data:text/html;base64,PHNjcmlwdD5fX3goMyk8L3NjcmlwdD4=' },
      ],
      pasFoto: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIG9ubG9hZD0iX194KDQpIi8+',
      pembayaran: { metode: T(t('pay.metode')), tanggal: '2026-10-01' + P(t('pay.tanggal')), buktiUrl: J(t('pay.buktiUrl')) },
      pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: T(t('namaTerang')), tanggal: '2026-10-01' + P(t('pern.tanggal')) },
      catatan: T(t('catatan')),
    },
    review: { note: T(t('review.note')), history: [{ at: '2026-10-02T03:00:00.000Z' + P(t('hist.at')), by: P(t('hist.by')), byName: T(t('hist.byName')), action: 'perbaikan' + P(t('hist.action')), note: T(t('hist.note')) }] },
  };
}
const VIEWER = { uid: 'evil-viewer-00001', name: 'Evil ' + P('session.name'), email: 'viewer@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: J('session.photoURL'), createdAt: '2026-03-14T09:00:00.000Z' };
const MEMBERS = {
  'evil-pending-0001': evilMember('evil-pending-0001', 'Menunggu Verifikasi', 'pending'),
  'evil-aktif-00002': evilMember('evil-aktif-00002', 'Aktif', 'aktif'),
  'evil-revisi-0003': evilMember('evil-revisi-0003', 'Perlu Perbaikan', 'revisi'),
};
const FEEDBACK = [
  { id: 'UB-1' + Q('fb.id'), kategori: 'Kritik' + P('fb.kategori'), nama: T('fb.nama'), email: 'a@b.id', phone: T('fb.phone'), subjek: T('fb.subjek'), pesan: T('fb.pesan'), rating: '5' + P('fb.rating'), anonim: false, uid: P('fb.uid'), halaman: T('fb.halaman'), createdAt: '2026-10-08T03:00:00.000Z' + P('fb.createdAt'), status: 'Baru', catatanAdmin: T('fb.catatanAdmin') },
  { id: 'UB-2', kategori: 'Saran', nama: 'Mailto', email: 'x@y.id?cc=attacker@evil.id&body=', phone: '', subjek: 'Mailto injection', pesan: 'Pesan uji mailto injection.', rating: 99999, anonim: false, createdAt: '2026-10-08T04:00:00.000Z', status: 'Baru' },
];
const REGISTRY = { 'PPAPI-2026-777777': { kta: 'PPAPI-2026-777777', nama: 'Evil ' + T('reg.nama'), kategori: T('reg.kategori'), kompetensi: [T('reg.kompetensi')], kota: T('reg.kota'), berlakuHingga: '2029-12-31' + P('reg.berlakuHingga'), status: 'Aktif' + P('reg.status') } };
const AUDIT = [{ id: 'log-x', at: '2026-10-08T05:00:00.000Z' + P('audit.at'), by: P('audit.by'), byName: T('audit.byName'), action: 'anggota.disetujui' + P('audit.action'), label: T('audit.label'), targetType: T('audit.targetType'), targetId: T('audit.targetId'), targetName: T('audit.targetName'), note: T('audit.note') }];
const CONTENT = {
  berita: [{ id: 'evil-berita', judul: 'Evil ' + T('berita.judul'), kategori: 'Kegiatan' + P('berita.kategori'), tanggal: '2026-10-08', ringkasan: T('berita.ringkasan'), isi: [T('berita.isi')], gambar: J('berita.gambar'), penulis: T('berita.penulis'), sorot: true }],
  pengumuman: [{ id: 'evil-peng', judul: 'Evil ' + T('peng.judul'), isi: T('peng.isi'), tanggal: '2026-10-08', penting: true }],
  agenda: [{ id: 'evil-agenda', judul: 'Evil ' + T('agenda.judul'), jenis: 'Seminar' + P('agenda.jenis'), mulai: '2026-11-08', selesai: '2026-11-09', waktu: T('agenda.waktu'), lokasi: T('agenda.lokasi'), mode: 'Luring' + P('agenda.mode'), kuota: '10' + P('agenda.kuota'), deskripsi: T('agenda.deskripsi'), tautanDaftar: J('agenda.tautanDaftar') }],
  pustaka: [
    { id: 'evil-pustaka', judul: 'Evil ' + T('pustaka.judul'), kategori: 'Standar', kode: T('pustaka.kode'), versi: T('pustaka.versi'), tanggal: '2026-10-01', status: 'Berlaku', ringkasan: T('pustaka.ringkasan'), penyusun: T('pustaka.penyusun'), format: T('pustaka.format'), halaman: T('pustaka.halaman'), akses: 'publik', tautan: J('pustaka.tautan'), tag: [T('pustaka.tag')] },
    { id: 'evil-pustaka-2', judul: 'Evil relatif', kategori: 'Standar', status: 'Berlaku', ringkasan: 'x', akses: 'publik', tautan: '//evil.example/x.pdf' },
    { id: 'evil-pustaka-3', judul: 'Evil backslash', kategori: 'Standar', status: 'Berlaku', ringkasan: 'x', akses: 'publik', tautan: '/\\evil.example/x.pdf' },
  ],
  regulasi: [{ id: 'evil-reg', jenis: 'SNI', nomor: T('reg2.nomor'), tahun: 2024, judul: 'Evil ' + T('reg2.judul'), singkatan: T('reg2.singkatan'), instansi: T('reg2.instansi'), status: 'Berlaku', relevansi: T('reg2.relevansi'), tautan: J('reg2.tautan'), kunci: true, sumber: [J('reg2.sumber')] }],
};

function seed(s) {
  window.__hits = []; window.__x = function (i) { window.__hits.push(i); };
  try {
    if (sessionStorage.getItem('__seeded')) return;
    sessionStorage.setItem('__seeded', '1');
    localStorage.setItem('ppapi_demo_seed_v2', JSON.stringify({ v: 2, at: 'x' }));
    localStorage.setItem('ppapi_demo_session', JSON.stringify(s.session));
    localStorage.setItem('ppapi_demo_admins', JSON.stringify(s.admins));
    Object.keys(s.members).forEach(k => localStorage.setItem('ppapi_member_' + k, JSON.stringify(s.members[k])));
    localStorage.setItem('ppapi_feedback', JSON.stringify(s.feedback));
    const reg = JSON.parse(localStorage.getItem('ppapi_registry') || '{}'); Object.assign(reg, s.registry); localStorage.setItem('ppapi_registry', JSON.stringify(reg));
    localStorage.setItem('ppapi_audit_log', JSON.stringify(s.audit));
    Object.keys(s.content).forEach(k => localStorage.setItem('ppapi_content_' + k, JSON.stringify(s.content[k])));
  } catch (e) { console.log('seed error', e.message); }
}
const scanFn = () => {
  const on = [], js = [], inj = [];
  for (const el of document.querySelectorAll('body *')) {
    for (const a of el.attributes) {
      if (/^on/i.test(a.name)) on.push(el.tagName.toLowerCase() + '[' + a.name + '=' + a.value.slice(0, 30) + ']');
      if (/^(href|src|action|formaction|xlink:href)$/i.test(a.name) && /^\s*(javascript|vbscript|data:(?!image\/(jpeg|png|webp|gif);base64,))/i.test(a.value)) js.push(el.tagName.toLowerCase() + '[' + a.name + '=' + a.value.slice(0, 50) + ']');
    }
    if ((el.tagName === 'IMG' && el.getAttribute('src') === 'x') || (el.tagName === 'svg' && el.hasAttribute('onload'))) inj.push(el.outerHTML.slice(0, 60));
  }
  return { hits: (window.__hits || []).slice(), on, js, inj };
};

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const report = [];
async function ctxFor(session, members, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 }, reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta', acceptDownloads: true });
  await ctx.clock.setFixedTime(new Date('2026-10-09T10:00:00+07:00'));
  await ctx.addInitScript(seed, { session, admins: [ADMIN.uid, 'evil-aktif-00002'], members, feedback: FEEDBACK, registry: REGISTRY, audit: AUDIT, content: CONTENT, ...extra });
  return ctx;
}
async function check(page, label) {
  await page.waitForTimeout(500);
  const s = await page.evaluate(scanFn).catch(e => ({ err: e.message, hits: [], on: [], js: [], inj: [] }));
  const bad = s.hits.length || s.on.length || s.js.length || s.inj.length;
  report.push({ label, ...s });
  console.log((bad ? '  ✗ ' : '  ✓ ') + label + (bad ? '  ' + JSON.stringify({ hits: [...new Set(s.hits)].map(i => i + ':' + (MAP[i] || '?')), on: s.on.slice(0, 6), js: s.js.slice(0, 6), inj: s.inj.slice(0, 3) }) : ''));
  return s;
}
let dialogs = 0;
function wire(page) {
  page.on('dialog', d => { dialogs++; d.dismiss().catch(() => {}); });
  page.on('pageerror', e => console.log('    pageerror:', e.message.slice(0, 160)));
}
async function clickEach(page, sel, label, max = 12) {
  const n = Math.min(max, await page.locator(sel).count());
  for (let i = 0; i < n; i++) {
    const el = page.locator(sel).nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const name = ((await el.getAttribute('data-id').catch(() => '')) || (await el.textContent().catch(() => '')) || '').slice(0, 30);
    await el.click({ timeout: 4000 }).catch(() => {});
    await page.waitForTimeout(500);
    await check(page, `${label} #${i} (${name.replace(/\s+/g, ' ')})`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  }
}

/* ======================= ADMIN ======================= */
console.log('\n── Admin console (admin session)');
{
  const ctx = await ctxFor(ADMIN, MEMBERS);
  const page = await ctx.newPage(); wire(page);
  for (const sec of ['ringkasan', 'permohonan', 'anggota', 'konten/berita', 'konten/pengumuman', 'konten/agenda', 'konten/pustaka', 'konten/regulasi', 'umpan-balik', 'admin', 'log']) {
    await page.goto(`${BASE}/admin.html#${sec}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(900);
    await check(page, 'admin #' + sec);
    if (sec === 'permohonan' || sec === 'anggota') await clickEach(page, '[data-open="member"]', `admin #${sec} drawer`);
    if (sec === 'umpan-balik') await clickEach(page, 'button.adm-act[data-open="feedback"]', 'admin feedback drawer');
    if (sec.startsWith('konten/')) await clickEach(page, '[data-content-act="edit"][data-id^="evil"]', `admin ${sec} edit modal`, 4);
    if (sec === 'anggota') {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 5000 }).catch(() => null), page.click('#aq-export').catch(() => {})]);
      if (dl) {
        const p = path.join(SHOTS, 'sec-v2-export.csv'); await dl.saveAs(p);
        const csv = fs.readFileSync(p, 'utf8');
        const cells = csv.split(/\r\n/).flatMap(r => r.split(';'));
        const formula = cells.filter(c => /^[=+\-@\t\r＝＋－＠]/.test(c.replace(/^"/, '')));
        console.log('  CSV: ' + csv.split(/\r\n/).length + ' rows; cells starting with formula chars after export: ' + JSON.stringify(formula.slice(0, 5)));
      } else console.log('  CSV: no download captured');
    }
  }
  /* approve dialog of the pending applicant (prefill values) */
  await page.goto(`${BASE}/admin.html#permohonan`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  const open = page.locator('[data-open="member"][data-id="evil-pending-0001"]:visible').first();
  if (await open.count()) {
    await open.click(); await page.waitForTimeout(600);
    const btns = await page.locator('.drawer button').allTextContents();
    for (const lbl of ['Setujui', 'Minta Perbaikan', 'Tolak']) {
      const b = page.locator('.drawer button', { hasText: lbl }).first();
      if (await b.count()) { await b.click().catch(() => {}); await page.waitForTimeout(500); await check(page, 'admin action dialog: ' + lbl); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    }
    console.log('    drawer buttons: ' + btns.map(s => s.trim()).filter(Boolean).join(' | ').slice(0, 200));
  }
  await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle' }); await check(page, 'dashboard (admin)');
  await ctx.close();
}

/* ======================= MEMBERS ======================= */
for (const [uid, label] of [['evil-aktif-00002', 'Aktif member'], ['evil-pending-0001', 'pending member'], ['evil-revisi-0003', 'Perlu Perbaikan member']]) {
  console.log('\n── ' + label);
  const sess = Object.assign({}, VIEWER, { uid });
  const ctx = await ctxFor(sess, MEMBERS);
  const page = await ctx.newPage(); wire(page);
  await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle' }); await check(page, label + ' dashboard');
  if (uid === 'evil-aktif-00002') {
    for (const tab of ['profil', 'kompetensi', 'sertifikat', 'kartu', 'aplikasi']) {
      await page.goto(`${BASE}/anggota.html#${tab}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(700);
      await check(page, label + ' anggota #' + tab);
      if (tab === 'kompetensi' || tab === 'sertifikat') await clickEach(page, `[data-action^="edit-"]`, `${label} anggota ${tab} edit`, 2);
    }
    await page.goto(`${BASE}/pendaftaran.html`, { waitUntil: 'networkidle' }); await check(page, label + ' pendaftaran');
    await page.goto(`${BASE}/aplikasi/perencanaan/index.html`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500); await check(page, label + ' app perencanaan');
    await page.goto(`${BASE}/aplikasi/simulator/index.html`, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500); await check(page, label + ' app simulator');
  } else {
    for (const step of ['', '#kategori', '#data-diri', '#profesional', '#kompetensi', '#dokumen', '#pernyataan', '#tinjau']) {
      await page.goto(`${BASE}/pendaftaran.html${step}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(700);
      await check(page, `${label} pendaftaran ${step || '(start)'}`);
      if (uid === 'evil-pending-0001') break;
    }
  }
  await ctx.close();
}

/* ======================= PUBLIC ======================= */
console.log('\n── Public pages (signed out; admin-managed content + registry with payloads)');
{
  const ctx = await ctxFor(null, {});
  await ctx.addInitScript(() => { try { localStorage.removeItem('ppapi_demo_session'); } catch (e) {} });
  const page = await ctx.newPage(); wire(page);
  for (const u of ['index.html', 'berita.html', 'berita.html?id=evil-berita', 'agenda.html', 'agenda.html?id=evil-agenda', 'pustaka.html', 'pustaka.html?q=%3Cimg%20src%3Dx%20onerror%3D__x(0)%3E', 'regulasi.html', 'keanggotaan.html',
    'verifikasi.html?kta=PPAPI-2026-777777', 'verifikasi.html?q=Evil', 'verifikasi.html?q=%3Cimg%20src%3Dx%20onerror%3D__x(0)%3E', 'berita.html?kategori=%3Cimg%20src%3Dx%20onerror%3D__x(0)%3E', 'agenda.html?jenis=%3Cimg%20src%3Dx%20onerror%3D__x(0)%3E']) {
    await page.goto(`${BASE}/${u}`, { waitUntil: 'networkidle' }); await page.waitForTimeout(700);
    await check(page, 'public ' + u);
    if (u === 'pustaka.html') await clickEach(page, '[data-pk-open], .doc-card__title a, .doc-card button', 'pustaka item', 4);
  }
  await ctx.close();
}
console.log('\ndialogs (alert/confirm): ' + dialogs);
fs.writeFileSync(path.join(SHOTS, 'sec-v2-xss.json'), JSON.stringify({ map: MAP, report }, null, 1));
await browser.close();
await close();
