// Konsol Admin (admin.html) — functional + visual flow.
// Run from devtools/:   node flows/admin-flow.mjs [--headed]
// Clock frozen at 2026-10-09 10:00 WIB (Asia/Jakarta). Demo mode; the session is the seeded demo admin
// (same objects as check.mjs --admin) on top of the auth.js demo seed (4 contoh members).
// Scenarios:
//   A  desktop admin: ringkasan KPIs · hash navigation · approve the seeded Menunggu Verifikasi contoh
//      member (KTA + registry lookup) · revise (validation + template) · reject · deactivate → reactivate ·
//      extend · ubah kategori · directory search/sort/filter + CSV download · content CRUD (create, edit
//      static → restore, hide → show, member-only pustaka file, delete, validation) · feedback status +
//      note + mailto · admins add/remove + last-admin guard · log filter · XSS-hardening · keyboard
//   B  mobile 390: every section + drawer + dialog screenshots, no horizontal overflow
//   C  deep link #konten/agenda
//   D  non-admin member (check.mjs --auth fixture) → redirected to dashboard.html with the flash toast
//   E  signed out → masuk.html?next=admin.html%23permohonan
//   F  axe-core 4.10.2 (cdnjs; skipped when offline) on every section, drawers and dialogs, desktop + mobile
// Screenshots: devtools/shots/admin-flow-*.png
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const HEADED = process.argv.includes('--headed');
const NOW = new Date('2026-10-09T10:00:00+07:00');

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404, { 'content-type': MIME['.html'] });
    return res.end('<!doctype html><title>404</title><p>Not found</p>');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  /* The sample (contoh) content was removed from assets/data on 15 Oct 2026 (pengumuman and agenda are empty, pustaka
     holds only the two apps). The content-CRUD scenario needs one static item per type, so the TEST server appends a
     small fixture (served only here; nothing is written to site/). */
  const fixture = FIXTURES[String(file).replace(/\\/g, '/').split('/assets/data/')[1]];
  if (fixture) return res.end(fs.readFileSync(file, 'utf8') + '\n' + fixture);
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
const FIXTURES = {
  'berita.js': "PPAPI_DATA.pengumuman = (PPAPI_DATA.pengumuman || []).concat([{ id: 'uji-pengumuman-statis', judul: 'Pengumuman statis uji', isi: 'Pengumuman bawaan untuk pengujian konsol.', tanggal: '2026-10-05', penting: false }]);",
  'agenda.js': "PPAPI_DATA.agenda = (PPAPI_DATA.agenda || []).concat([{ id: 'uji-agenda-statis', judul: 'Agenda statis uji', jenis: 'Pelatihan', mulai: '2026-11-12', selesai: '2026-11-12', waktu: '09.00 – 12.00 WIB', lokasi: 'Jakarta', mode: 'Luring', kuota: 20, deskripsi: 'Agenda bawaan untuk pengujian konsol.', tautanDaftar: '', contoh: false }]);",
  'pustaka.js': "PPAPI_DATA.pustaka = [{ id: 'uji-petunjuk-teknis-statis', judul: 'Petunjuk Teknis statis uji', kategori: 'Petunjuk Teknis', kode: 'PT-UJI', versi: '', tanggal: '2026-09-01', status: 'Berlaku', ringkasan: 'Dokumen bawaan untuk pengujian konsol.', penyusun: '', format: 'PDF', halaman: '', akses: 'publik', tautan: 'pustaka/uji.pdf', tag: [], contoh: false }].concat(PPAPI_DATA.pustaka || []);"
};
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
const USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const MEMBER = {
  uid: USER.uid, name: USER.name, email: USER.email, phone: USER.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31',
  approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001', profile: { city: 'Balikpapan', province: 'Kalimantan Timur' }, competencies: [], certificates: [],
  application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z', pengalaman: [], dokumen: [], pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Rahmat Hidayat', tanggal: '2026-03-15' } },
  review: { note: '', history: [] }, updatedAt: '2026-09-30T08:00:00.000Z',
};
function applicant(uid, name, extra = {}) {
  return Object.assign({
    uid, name, email: uid + '@ppapi.demo', phone: '+6281200000' + uid.slice(-3), kta: '', memberType: 'Praktisi', status: 'Menunggu Verifikasi', joinedAt: '2026-10-01',
    validUntil: '', approvedAt: '', approvedBy: '', contoh: true,
    profile: { birthPlace: 'Medan', birthDate: '1990-01-01', gender: 'Laki-laki', province: 'Sumatera Utara', city: 'Medan', address: '', company: 'PT Uji Alur', position: 'Teknisi Perancah', experienceYears: 4, education: 'SMA / SMK / Sederajat', bio: '', linkedin: '' },
    competencies: [], certificates: [],
    application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-10-07T02:00:00.000Z', updatedAt: '2026-10-07T02:00:00.000Z', pengalaman: [{ id: 'p1', proyek: 'Proyek uji', peran: 'Teknisi', tahun: '2025', lokasi: 'Medan' }], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: name, tanggal: '2026-10-07' }, catatan: '' },
    review: { note: '', history: [] }, createdAt: '2026-10-01T02:00:00.000Z', updatedAt: '2026-10-07T02:00:00.000Z',
  }, extra);
}

let pass = 0, fail = 0;
const failures = [];
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; failures.push(name); console.log('  ✗ ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
const browser = await chromium.launch({ headless: !HEADED });
const VPS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
const consoleIssues = [];
async function newCtx(vp, { who = 'admin', motion = false } = {}) {
  const ctx = await browser.newContext({ ...VPS[vp], locale: 'id-ID', timezoneId: 'Asia/Jakarta', reducedMotion: motion ? 'no-preference' : 'reduce', acceptDownloads: true });
  await ctx.clock.setFixedTime(NOW);
  if (who === 'admin') {
    await ctx.addInitScript(({ a }) => {
      try {
        if (!localStorage.getItem('ppapi_demo_session')) localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
        const admins = JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]');
        if (!admins.includes(a.uid)) { admins.push(a.uid); localStorage.setItem('ppapi_demo_admins', JSON.stringify(admins)); }
      } catch (e) { /* ignore */ }
    }, { a: ADMIN });
  } else if (who === 'member') {
    await ctx.addInitScript(({ u, m }) => {
      try {
        if (!localStorage.getItem('ppapi_demo_session')) {
          localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
          const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
          users[u.email] = { uid: u.uid, name: u.name, email: u.email, phone: u.phone, provider: u.provider, createdAt: u.createdAt, hash: 'x' };
          localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
          localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
        }
      } catch (e) { /* ignore */ }
    }, { u: USER, m: MEMBER });
  }
  return ctx;
}
async function openPage(ctx, url) {
  const page = await ctx.newPage();
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) consoleIssues.push(`${url} console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => consoleIssues.push(`${url} pageerror: ${e.message}`));
  page.on('dialog', async dlg => { consoleIssues.push('unexpected dialog: ' + dlg.message()); await dlg.dismiss(); });
  await page.goto(BASE + '/' + url, { waitUntil: 'networkidle' });
  return page;
}
async function ready(page) { await page.waitForSelector('html[data-admin-ready]', { timeout: 15000 }); await page.waitForTimeout(150); }
const shot = (page, name, full = false) => page.screenshot({ path: path.join(SHOTS, `admin-flow-${name}.png`), fullPage: full });
/* stricter than check.mjs: on an emulated phone, innerWidth grows with overflowing content, clientWidth does not */
async function overflow(page) { return page.evaluate(() => Math.max(document.documentElement.scrollWidth - window.innerWidth, document.documentElement.scrollWidth - document.documentElement.clientWidth, window.innerWidth - (window.visualViewport ? Math.round(window.visualViewport.width) : window.innerWidth))); }
async function toastText(page) { await page.waitForSelector('.toast__msg', { timeout: 5000 }).catch(() => {}); return page.evaluate(() => Array.from(document.querySelectorAll('.toast__msg')).map(t => t.textContent).join(' | ')); }
async function clearToasts(page) { await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove())); }
async function member(page, uid) { return page.evaluate(id => PPAPI.store.normalizeMember(JSON.parse(localStorage.getItem('ppapi_member_' + id))), uid); }
async function nav(page, section) { await page.click(`.adm-nav__link[data-section="${section}"]`); await page.waitForFunction(s => !document.getElementById('sec-' + s).hidden, section); await page.waitForTimeout(80); }
async function drawerOpen(page) { await page.waitForSelector('.drawer__panel', { timeout: 5000 }); await page.waitForTimeout(120); }
async function closeDrawer(page) { await page.keyboard.press('Escape'); await page.waitForSelector('.drawer', { state: 'detached', timeout: 5000 }); await page.waitForTimeout(120); }
async function modalOpen(page) { await page.waitForSelector('.modal__dialog', { timeout: 5000 }); await page.waitForTimeout(100); }
async function inject(page, list) {
  await page.evaluate(ms => { ms.forEach(m => localStorage.setItem('ppapi_member_' + m.uid, JSON.stringify(m))); }, list);
  await page.click('#adm-refresh');
  await page.waitForFunction(() => !document.querySelector('#adm-refresh').disabled);
  await page.waitForTimeout(100);
}

try {
  /* ================================================================ A — desktop admin */
  console.log('\nA — desktop admin');
  {
    const ctx = await newCtx('desktop');
    const page = await openPage(ctx, 'admin.html');
    await ready(page);
    check('A1 stays on admin.html', page.url().endsWith('/admin.html'), page.url());
    check('A2 robots noindex', await page.$eval('meta[name="robots"]', m => m.content.includes('noindex')));
    check('A3 one h1 "Konsol Admin"', await page.evaluate(() => document.querySelectorAll('h1').length === 1 && /Konsol\s+Admin/.test(document.querySelector('h1').textContent)));
    /* since 2026-10-21: + 08 Instruktur, 09 Kegiatan, 10 Toko (PPAPI_ADMIN_SECTIONS) */
    check('A4 nav: 10 links, Ringkasan current', await page.evaluate(() => document.querySelectorAll('.adm-nav__link').length === 10 && document.querySelector('.adm-nav__link[aria-current="page"]').dataset.section === 'ringkasan'));
    check('A5 hero meta: admin name + Mode Demo', await page.evaluate(() => /Admin PPAPI \(Demo\)/.test(document.getElementById('adm-meta').textContent) && /Mode Demo/.test(document.getElementById('adm-meta').textContent)));
    const kpis = await page.$$eval('.adm-kpi', els => els.map(e => [e.querySelector('.kpi__label').textContent.trim(), e.querySelector('.kpi__value').textContent.trim()]));
    check('A6 6 KPI tiles', kpis.length === 6, kpis);
    check('A7 KPI menunggu = 1, perbaikan = 1, aktif = 1', /^1/.test(kpis[0][1]) && /^1/.test(kpis[1][1]) && /^1/.test(kpis[2][1]), kpis);
    check('A8 nav count Permohonan = 1', await page.$eval('[data-count-for="permohonan"]', e => !e.hidden && e.textContent.trim().startsWith('1')));
    check('A9 latest applications list Bagus first', await page.$eval('.adm-list__item', e => /Bagus Pratama/.test(e.textContent)).catch(() => false));
    check('A10 contoh badge on sample members', (await page.$$('.adm-list .badge--contoh')).length >= 1);
    await shot(page, 'd-ringkasan', true);

    /* hash navigation */
    await nav(page, 'permohonan');
    check('A11 hash #permohonan', page.url().endsWith('#permohonan'));
    check('A12 only permohonan visible', await page.evaluate(() => Array.from(document.querySelectorAll('.adm-section')).filter(s => !s.hidden).map(s => s.dataset.section).join() === 'permohonan'));
    check('A13 focus on section heading', await page.evaluate(() => document.activeElement && document.activeElement.id === 'h-permohonan'));
    check('A14 queue shows Bagus (Menunggu Verifikasi)', await page.evaluate(() => /Bagus Pratama/.test(document.getElementById('pq-list').textContent)));
    await page.goBack();
    await page.waitForFunction(() => !document.getElementById('sec-ringkasan').hidden);
    check('A15 back button returns to Ringkasan', true);
    await page.goForward();
    await page.waitForFunction(() => !document.getElementById('sec-permohonan').hidden);
    await shot(page, 'd-permohonan');

    /* ---- approve ---- */
    await page.click('#pq-list [data-open="member"][data-id="demo-contoh-0001"].adm-act');
    await drawerOpen(page);
    const dtext = await page.$eval('.drawer__panel', e => e.textContent);
    check('A16 drawer title = applicant name', await page.$eval('.drawer__title', e => e.textContent.trim() === 'Bagus Pratama (Contoh)'));
    check('A17 drawer shows all application groups', ['Data diri', 'Data profesional', 'Riwayat proyek', 'Kompetensi', 'Sertifikat', 'Dokumen pendukung', 'Pernyataan', 'Catatan pemohon', 'Riwayat'].every(s => dtext.includes(s)), dtext.slice(0, 200));
    check('A18 dokumen links https + noopener', await page.$$eval('.adm-docs a', as => as.length === 2 && as.every(a => a.href.startsWith('https://') && /noopener/.test(a.rel) && a.target === '_blank')));
    check('A19 mailto prefilled to applicant', await page.$eval('.adm-dhead__cta a', a => a.href.startsWith('mailto:bagus.pratama@ppapi.demo?subject=')).catch(() => false));
    check('A20 actions: Tolak · Minta Perbaikan · Setujui', await page.$$eval('.drawer__footer .btn', b => b.map(x => x.textContent.trim()).join('|')) === 'Tolak|Minta Perbaikan|Setujui');
    check('A21 completeness alert ok', /Seluruh data wajib formulir telah terisi/.test(dtext));
    await shot(page, 'd-drawer-permohonan');
    await page.click('#act-approve');
    await modalOpen(page);
    const appr = await page.evaluate(() => ({ kat: document.querySelector('.modal [name="memberType"]').value, until: document.querySelector('.modal [name="validUntil"]').value, min: document.querySelector('.modal [name="validUntil"]').min }));
    check('A22 approve dialog defaults (Praktisi, 2029-12-31, min today)', appr.kat === 'Praktisi' && appr.until === '2029-12-31' && appr.min === '2026-10-09', appr);
    await shot(page, 'd-dialog-approve');
    await page.fill('.modal [name="note"]', 'Data lengkap dan sesuai.');
    await page.click('#dlg-approve-ok');
    await page.waitForSelector('#adm-kta-result', { timeout: 8000 });
    const kta = await page.$eval('.adm-kta__num', e => e.textContent.trim());
    check('A23 approval shows the generated KTA', /^PPAPI-2026-\d{6}$/.test(kta), kta);
    await shot(page, 'd-kta-result');
    const bagus = await member(page, 'demo-contoh-0001');
    check('A24 member Aktif + same KTA + validUntil + note', bagus.status === 'Aktif' && bagus.kta === kta && bagus.validUntil === '2029-12-31' && bagus.review.note === 'Data lengkap dan sesuai.', { s: bagus.status, k: bagus.kta, v: bagus.validUntil });
    check('A25 member features open (util.isActiveMember)', await page.evaluate(id => PPAPI.util.isActiveMember(PPAPI.store.normalizeMember(JSON.parse(localStorage.getItem('ppapi_member_' + id)))), 'demo-contoh-0001'));
    const look = await page.evaluate(k => PPAPI.store.registry.lookup(k), kta);
    check('A26 registry lookup finds the new KTA', look.exact && look.exact.nama === 'Bagus Pratama (Contoh)' && look.exact.status === 'Aktif' && look.exact.berlakuHingga === '2029-12-31', look);
    const audit1 = await page.evaluate(() => PPAPI.store.admin.audit(5));
    check('A27 audit: Menyetujui pendaftaran', audit1[0] && audit1[0].action === 'anggota.disetujui' && audit1[0].targetName === 'Bagus Pratama (Contoh)');
    await page.click('.modal__footer .btn:last-child');
    await page.waitForSelector('.modal', { state: 'detached' });
    check('A28 drawer refreshed → Aktif actions', await page.$$eval('.drawer__footer .btn', b => b.map(x => x.textContent.trim()).join('|')) === 'Nonaktifkan|Ubah Kategori|Perpanjang');
    check('A29 drawer shows KTA + verifikasi link', await page.evaluate(k => document.querySelector('.adm-dhead__kta').textContent.includes(k) && !!document.querySelector('.drawer a[href^="verifikasi.html?kta="]'), kta));
    await closeDrawer(page);
    check('A30 Esc closes drawer, focus restored (trigger re-rendered → section heading)', await page.evaluate(() => document.activeElement && document.activeElement.id === 'h-permohonan'));
    check('A31 queue now empty + nav count hidden', await page.evaluate(() => /Antrean kosong/.test(document.getElementById('pq-list').textContent) && document.querySelector('[data-count-for="permohonan"]').hidden));
    await clearToasts(page);

    /* ---- revise + reject (fresh applicants) ---- */
    /* the store keeps only JPEG pas foto data URLs (the wizard re-encodes every upload to JPEG) */
    const PNG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJ+AD//Z';
    await inject(page, [applicant('flow-0001', 'Rina Uji Revisi', { application: Object.assign(applicant('x', 'x').application, { pasFoto: PNG }) }), applicant('flow-0002', 'Tono Uji Tolak', { application: Object.assign(applicant('x', 'x').application, { submittedAt: '2026-10-08T02:00:00.000Z', pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Tono', tanggal: '2026-10-08' } }) })]);
    check('A32 refresh shows 2 new applicants', await page.evaluate(() => document.querySelectorAll('#pq-list tbody tr').length === 2));
    check('A33 FIFO: older submission first', await page.evaluate(() => /Rina Uji Revisi/.test(document.querySelector('#pq-list tbody tr').textContent)));
    await page.click('#pq-list .adm-act[data-id="flow-0001"]');
    await drawerOpen(page);
    check('A33b pas foto (data URL) shown in the drawer with alt text', await page.evaluate(() => { const i = document.querySelector('.drawer .adm-dhead__photo'); return !!i && i.src.startsWith('data:image/jpeg') && /Pas foto Rina/.test(i.alt); }));
    await page.click('#act-revise');
    await modalOpen(page);
    await page.click('#dlg-revise-ok');
    await page.waitForTimeout(150);
    check('A34 revise: empty note → inline error, stays open', await page.evaluate(() => {
      const f = document.querySelector('.modal textarea[name="note"]');
      return !!document.querySelector('.modal') && f.getAttribute('aria-invalid') === 'true' && f.closest('.field').classList.contains('is-invalid') && document.activeElement === f;
    }));
    await page.click('.modal [data-template="0"]');
    await page.click('.modal [data-template="2"]');
    const noteVal = await page.$eval('.modal textarea[name="note"]', t => t.value);
    check('A35 templates fill the note', /dokumen pendukung/.test(noteVal) && /riwayat proyek/.test(noteVal), noteVal);
    await shot(page, 'd-dialog-revise');
    await page.click('#dlg-revise-ok');
    await page.waitForSelector('.modal', { state: 'detached' });
    await page.waitForTimeout(200);
    const rina = await member(page, 'flow-0001');
    check('A36 revise → Perlu Perbaikan + note + history', rina.status === 'Perlu Perbaikan' && /dokumen pendukung/.test(rina.review.note) && rina.review.history.some(x => x.action === 'perbaikan'), rina.status);
    check('A37 toast after revise', /Permintaan perbaikan/.test(await toastText(page)));
    check('A38 drawer shows the revision note', await page.evaluate(() => /Catatan perbaikan untuk pemohon/.test(document.querySelector('.drawer__body').textContent)));
    await closeDrawer(page);
    await page.click('#pq-list .adm-act[data-id="flow-0002"]');
    await drawerOpen(page);
    await page.click('#act-reject');
    await modalOpen(page);
    await page.fill('.modal textarea[name="note"]', 'Pengalaman belum memenuhi syarat kategori Praktisi.');
    await page.click('#dlg-reject-ok');
    await page.waitForSelector('.modal', { state: 'detached' });
    await page.waitForTimeout(150);
    const tono = await member(page, 'flow-0002');
    check('A39 reject → Ditolak + reason', tono.status === 'Ditolak' && /belum memenuhi/.test(tono.review.note), tono.status);
    check('A40 Ditolak drawer offers Tutup · Setujui', await page.$$eval('.drawer__footer .btn', b => b.map(x => x.textContent.trim()).join('|')) === 'Tutup|Setujui');
    await closeDrawer(page);
    await page.click('[data-chips="pq-status"] .chip[data-value="Ditolak"]');
    check('A41 Ditolak filter lists 2 (Andi + Tono)', await page.evaluate(() => document.querySelectorAll('#pq-list tbody tr').length === 2));
    await clearToasts(page);

    /* ---- anggota: deactivate → reactivate → extend → kategori ---- */
    await nav(page, 'anggota');
    check('A42 hash #anggota + directory rows (≥7)', page.url().endsWith('#anggota') && await page.evaluate(() => document.querySelectorAll('#aq-list tbody tr').length >= 7));
    await page.fill('#aq-q', 'dimas');
    await page.waitForTimeout(350);
    check('A43 search "dimas" → 1 row', await page.evaluate(() => document.querySelectorAll('#aq-list tbody tr').length === 1));
    check('A44 search keeps focus in the box', await page.evaluate(() => document.activeElement.id === 'aq-q'));
    await shot(page, 'd-anggota-search');
    await page.click('#aq-list .adm-act[data-id="demo-contoh-0003"]');
    await drawerOpen(page);
    await page.click('#act-deactivate');
    await modalOpen(page);
    await page.fill('.modal textarea[name="note"]', 'Belum memperbarui iuran tahunan.');
    await page.click('#dlg-deactivate-ok');
    await page.waitForSelector('.modal', { state: 'detached' });
    await page.waitForTimeout(150);
    let dimas = await member(page, 'demo-contoh-0003');
    check('A45 deactivate → Nonaktif', dimas.status === 'Nonaktif');
    let look2 = await page.evaluate(() => PPAPI.store.registry.lookup('PPAPI-2025-000318'));
    check('A46 registry entry → Nonaktif', look2.exact && look2.exact.status === 'Nonaktif', look2.exact);
    check('A47 member features locked (isActiveMember false)', !(await page.evaluate(id => PPAPI.util.isActiveMember(PPAPI.store.normalizeMember(JSON.parse(localStorage.getItem('ppapi_member_' + id)))), 'demo-contoh-0003')));
    check('A48 Nonaktif actions: Ubah Kategori · Aktifkan Kembali', await page.$$eval('.drawer__footer .btn', b => b.map(x => x.textContent.trim()).join('|')) === 'Ubah Kategori|Aktifkan Kembali');
    await page.click('#act-reactivate');
    await modalOpen(page);
    check('A49 reactivate keeps the future validUntil (2028-12-31)', await page.$eval('.modal [name="validUntil"]', i => i.value === '2028-12-31'));
    await page.click('#dlg-reactivate-ok');
    await page.waitForSelector('.modal', { state: 'detached' });
    await page.waitForTimeout(150);
    dimas = await member(page, 'demo-contoh-0003');
    look2 = await page.evaluate(() => PPAPI.store.registry.lookup('PPAPI-2025-000318'));
    check('A50 reactivate → Aktif, registry Aktif', dimas.status === 'Aktif' && look2.exact.status === 'Aktif', [dimas.status, look2.exact && look2.exact.status]);
    await page.click('#act-extend');
    await modalOpen(page);
    check('A51 extend proposes 2031-12-31', await page.$eval('.modal [name="validUntil"]', i => i.value === '2031-12-31'));
    await page.fill('.modal [name="validUntil"]', '2027-01-01');
    await page.click('#dlg-extend-ok');
    await page.waitForTimeout(150);
    check('A52 extend: date before current validity rejected inline', await page.evaluate(() => !!document.querySelector('.modal .field.is-invalid')));
    await page.fill('.modal [name="validUntil"]', '2031-12-31');
    await page.click('#dlg-extend-ok');
    await page.waitForSelector('.modal', { state: 'detached' });
    await page.waitForTimeout(150);
    dimas = await member(page, 'demo-contoh-0003');
    look2 = await page.evaluate(() => PPAPI.store.registry.lookup('PPAPI-2025-000318'));
    check('A53 extend → validUntil 2031-12-31 (+ registry)', dimas.validUntil === '2031-12-31' && look2.exact.berlakuHingga === '2031-12-31');
    await page.click('#act-type');
    await modalOpen(page);
    await page.click('#dlg-type-ok');
    await page.waitForTimeout(120);
    check('A54 ubah kategori: same value → inline error', await page.evaluate(() => !!document.querySelector('.modal .field.is-invalid')));
    await page.selectOption('.modal [name="memberType"]', 'Kehormatan');
    await page.click('#dlg-type-ok');
    await page.waitForSelector('.modal', { state: 'detached' });
    await page.waitForTimeout(150);
    dimas = await member(page, 'demo-contoh-0003');
    look2 = await page.evaluate(() => PPAPI.store.registry.lookup('PPAPI-2025-000318'));
    check('A55 kategori → Kehormatan (+ registry)', dimas.memberType === 'Kehormatan' && look2.exact.kategori === 'Kehormatan');
    check('A56 history lists every decision', ['dinonaktifkan', 'diaktifkan', 'diperpanjang', 'kategori-diubah'].every(a => dimas.review.history.some(x => x.action === a)));
    await shot(page, 'd-drawer-anggota');
    await closeDrawer(page);
    await page.fill('#aq-q', '');
    await page.waitForTimeout(300);
    check('A56b directory marks admin accounts (metal "Admin" badge on the admin row only)', await page.evaluate(() => { const b = Array.from(document.querySelectorAll('#aq-list .badge--metal')); return b.length === 1 && b[0].closest('tr').querySelector('[data-id="demo-admin-0001"]') !== null; }));
    await page.selectOption('#aq-status', 'Aktif');
    check('A57 status filter Aktif → 2 rows (Bagus, Dimas)', await page.evaluate(() => document.querySelectorAll('#aq-list tbody tr').length === 2));
    await page.selectOption('#aq-sort', 'nama');
    check('A58 sort by name', await page.evaluate(() => { const n = Array.from(document.querySelectorAll('#aq-list .adm-person__name')).map(e => e.textContent); return n.join('|') === n.slice().sort((a, b) => a.localeCompare(b, 'id')).join('|'); }));
    await page.selectOption('#aq-status', '');
    const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#aq-export')]);
    const csvPath = await dl.path();
    const csv = fs.readFileSync(csvPath, 'utf8');
    check('A59 CSV download name', dl.suggestedFilename() === 'anggota-ppapi-2026-10-09.csv', dl.suggestedFilename());
    check('A60 CSV: BOM + ; header + rows', csv.charCodeAt(0) === 0xFEFF && csv.slice(1).startsWith('Nomor KTA;Nama;Email') && csv.split('\r\n').filter(Boolean).length >= 8, csv.slice(0, 60));
    await shot(page, 'd-anggota', true);
    await clearToasts(page);

    /* ---- content ---- */
    await nav(page, 'konten');
    check('A61 konten defaults to #konten/berita', page.url().endsWith('#konten/berita'));
    await page.waitForSelector('#kt-list tbody tr');
    /* since 15 Oct 2026 the static berita are real articles (no contoh items) */
    const A62 = await page.evaluate(() => ({ rows: document.querySelectorAll('#kt-list tbody tr').length, src: document.querySelectorAll('#kt-list .adm-src').length, contoh: document.querySelectorAll('#kt-list .badge--contoh').length, data: PPAPI.data.berita.filter(x => !x.hidden).length }));
    check('A62 berita list: one row per static article, Bawaan badges, no contoh badges', A62.rows === A62.data && A62.rows > 0 && A62.src === A62.rows && A62.contoh === 0, A62);
    check('A63 demo notice in Konten', await page.evaluate(() => /hanya tersimpan di peramban ini/.test(document.getElementById('konten-body').textContent)));
    await shot(page, 'd-konten-berita');
    await page.click('#kt-add');
    await modalOpen(page);
    await page.click('#dlg-content-ok');
    await page.waitForTimeout(120);
    check('A64 new berita: required fields flagged', await page.evaluate(() => document.querySelectorAll('.modal .field.is-invalid').length >= 2));
    await page.fill('.modal [name="judul"]', 'Uji Konsol: Rapat Koordinasi Sekretariat');
    await page.fill('.modal [name="ringkasan"]', 'Ringkasan berita uji dari konsol admin.');
    await page.fill('.modal [name="isi"]', 'Paragraf pertama berita uji.\n\n## Agenda rapat\n- Butir satu\n- Butir dua\n\nParagraf penutup.');
    await page.selectOption('.modal [name="kategori"]', 'Organisasi');
    await shot(page, 'd-dialog-berita');
    await page.click('#dlg-content-ok');
    await page.waitForSelector('.modal', { state: 'detached' });
    await page.waitForTimeout(200);
    const listed = await page.evaluate(() => PPAPI.store.content.list('berita'));
    const created = listed.find(x => x.judul === 'Uji Konsol: Rapat Koordinasi Sekretariat');
    check('A65 created berita visible via store.content.list', !!created && created._managed && !created._static, created && created.id);
    check('A66 isi split into paragraphs / subheading / bullets', created && JSON.stringify(created.isi) === JSON.stringify(['Paragraf pertama berita uji.', '## Agenda rapat', '- Butir satu', '- Butir dua', 'Paragraf penutup.']), created && created.isi);
    /* sorted newest first: the new item (dated today) sits after the static articles dated later */
    check('A67 newest first + "Dikelola" badge', await page.evaluate(t => { const rows = [...document.querySelectorAll('#kt-list tbody tr')]; const i = PPAPI.data.berita.filter(x => !x.hidden && String(x.tanggal) > t).length; return !!rows[i] && /Uji Konsol/.test(rows[i].textContent) && /Dikelola/.test(rows[i].textContent); }, created && created.tanggal));
    check('A68 "Lihat" link → berita.html?id=', await page.evaluate(id => !!document.querySelector('#kt-list a[href="berita.html?id=' + id + '"]'), created && created.id));
    /* edit a static pengumuman → restore */
    await page.click('.adm-subnav__link[data-type="pengumuman"]');
    await page.waitForSelector('#kt-list tbody tr');
    check('A69 sub-tab → #konten/pengumuman', page.url().endsWith('#konten/pengumuman'));
    const firstP = await page.$eval('#kt-list tbody tr', r => r.dataset.row);
    await page.click(`#kt-list [data-content-act="edit"][data-id="${firstP}"]`);
    await modalOpen(page);
    await page.fill('.modal [name="judul"]', 'Pengumuman bawaan yang diubah admin');
    await page.click('#dlg-content-ok');
    await page.waitForSelector('.modal', { state: 'detached' });
    await page.waitForTimeout(150);
    let p1 = (await page.evaluate(() => PPAPI.store.content.list('pengumuman'))).find(x => x.id === firstP);
    check('A70 static override saved (same id, Bawaan · Diubah)', p1.judul === 'Pengumuman bawaan yang diubah admin' && p1._static && p1._managed && await page.evaluate(id => /Bawaan · Diubah/.test(document.querySelector(`#kt-list tr[data-row="${id}"]`).textContent), firstP));
    await page.click(`#kt-list [data-content-act="restore"][data-id="${firstP}"]`);
    await modalOpen(page);
    await page.click('.modal__footer .btn:last-child');
    await page.waitForTimeout(250);
    p1 = (await page.evaluate(() => PPAPI.store.content.list('pengumuman'))).find(x => x.id === firstP);
    check('A71 restore → original title back', p1.judul !== 'Pengumuman bawaan yang diubah admin' && !p1._managed);
    /* hide a static agenda item → show again */
    await page.click('.adm-subnav__link[data-type="agenda"]');
    await page.waitForSelector('#kt-list tbody tr');
    const ag = await page.$eval('#kt-list tbody tr', r => r.dataset.row);
    await page.click(`#kt-list [data-content-act="hide"][data-id="${ag}"]`);
    await modalOpen(page);
    await page.click('.modal__footer .btn:last-child');
    await page.waitForTimeout(250);
    check('A72 hidden static agenda gone from content.list', !(await page.evaluate(() => PPAPI.store.content.list('agenda'))).some(x => x.id === ag));
    check('A73 hidden row: badge + "Tampilkan lagi"', await page.evaluate(id => { const r = document.querySelector(`#kt-list tr[data-row="${id}"]`); return r && r.classList.contains('is-hidden') && /Disembunyikan/.test(r.textContent) && !!r.querySelector('[data-content-act="restore"]'); }, ag));
    await shot(page, 'd-konten-agenda');
    await page.click(`#kt-list [data-content-act="restore"][data-id="${ag}"]`);
    await page.waitForTimeout(250);
    check('A74 shown again', (await page.evaluate(() => PPAPI.store.content.list('agenda'))).some(x => x.id === ag));
    /* agenda validation: selesai < mulai */
    await page.click('#kt-add');
    await modalOpen(page);
    await page.fill('.modal [name="judul"]', 'Uji tanggal');
    await page.fill('.modal [name="lokasi"]', 'Jakarta');
    await page.fill('.modal [name="mulai"]', '2026-11-10');
    await page.fill('.modal [name="selesai"]', '2026-11-08');
    await page.click('#dlg-content-ok');
    await page.waitForTimeout(120);
    check('A75 agenda: selesai before mulai rejected', await page.evaluate(() => /sebelum tanggal mulai/.test(document.querySelector('.modal').textContent)));
    await page.keyboard.press('Escape');
    await page.waitForSelector('.modal', { state: 'detached' });
    /* pustaka member-only file */
    await page.click('.adm-subnav__link[data-type="pustaka"]');
    await page.waitForSelector('#kt-list tbody tr');
    await page.click('#kt-add');
    await modalOpen(page);
    await page.fill('.modal [name="judul"]', 'Petunjuk Teknis Uji Konsol');
    await page.fill('.modal [name="ringkasan"]', 'Dokumen uji khusus anggota.');
    await page.fill('.modal [name="tautan"]', 'javascript:alert(1)');
    await page.click('#dlg-content-ok');
    await page.waitForTimeout(120);
    check('A76 pustaka: javascript: link rejected inline', await page.evaluate(() => document.querySelector('.modal [name="tautan"]').getAttribute('aria-invalid') === 'true'));
    await page.fill('.modal [name="tautan"]', 'https://example.com/uji-konsol.pdf');
    await page.click('#dlg-content-ok');
    await page.waitForSelector('.modal', { state: 'detached' });
    await page.waitForTimeout(200);
    const pus = (await page.evaluate(() => PPAPI.store.content.list('pustaka'))).find(x => x.judul === 'Petunjuk Teknis Uji Konsol');
    check('A77 pustaka public item has no link, berkasAnggota', pus && pus.tautan === '' && pus.berkasAnggota === true && pus.akses === 'anggota', pus);
    check('A78 fileUrl gives the private link to the admin', (await page.evaluate(it => PPAPI.store.pustaka.fileUrl(it), pus)) === 'https://example.com/uji-konsol.pdf');
    check('A79 placed after the static Petunjuk Teknis items', await page.evaluate(() => { const l = Array.from(document.querySelectorAll('#kt-list tbody tr')).map(r => r.textContent); const i = l.findIndex(t => /Petunjuk Teknis Uji Konsol/.test(t)); return i > 0 && /Petunjuk Teknis/.test(l[i - 1]); }));
    await page.click(`#kt-list [data-content-act="edit"][data-id="${pus.id}"]`);
    await modalOpen(page);
    await page.waitForTimeout(200);
    check('A80 edit pre-fills the stored member-only link', await page.$eval('.modal [name="tautan"]', i => i.value === 'https://example.com/uji-konsol.pdf'));
    await page.keyboard.press('Escape');
    await page.waitForSelector('.modal', { state: 'detached' });
    await page.click(`#kt-list [data-content-act="delete"][data-id="${pus.id}"]`);
    await modalOpen(page);
    await page.click('.modal__footer .btn:last-child');
    await page.waitForTimeout(250);
    check('A81 delete managed pustaka → gone', !(await page.evaluate(() => PPAPI.store.content.list('pustaka', { includeHidden: true }))).some(x => x.judul === 'Petunjuk Teknis Uji Konsol'));
    await page.click('.adm-subnav__link[data-type="regulasi"]');
    await page.waitForSelector('#kt-list tbody tr');
    check('A82 regulasi list (28 bawaan)', await page.evaluate(() => document.querySelectorAll('#kt-list tbody tr').length === 28));
    await clearToasts(page);

    /* ---- feedback ---- */
    await page.evaluate(() => PPAPI.store.submitFeedback({ kategori: 'Saran', nama: 'Uji Flow', email: 'uji.flow@contoh.id', subjek: 'Uji konsol', pesan: 'Pesan uji untuk konsol admin.\nBaris kedua.', rating: 4 }));
    await page.click('#adm-refresh');
    await page.waitForFunction(() => !document.querySelector('#adm-refresh').disabled);
    check('A83 nav count Umpan Balik = 1', await page.$eval('[data-count-for="umpan-balik"]', e => !e.hidden && e.textContent.trim().startsWith('1')));
    await nav(page, 'umpan-balik');
    check('A84 feedback row listed', await page.evaluate(() => /Uji konsol/.test(document.getElementById('fb-list').textContent)));
    await page.click('#fb-list .adm-act');
    await drawerOpen(page);
    check('A85 mailto reply to sender', await page.$eval('.drawer a[href^="mailto:"]', a => a.href.startsWith('mailto:uji.flow@contoh.id?subject=')).catch(() => false));
    check('A86 message keeps line breaks (pre-wrap)', await page.$eval('.drawer .adm-message', e => e.textContent.includes('\n') && getComputedStyle(e).whiteSpace === 'pre-wrap'));
    await page.click('.drawer input[name="status"][value="Diproses"] + .segmented__option');
    await page.fill('.drawer textarea[name="catatanAdmin"]', 'Diteruskan ke bidang teknis.');
    await shot(page, 'd-drawer-feedback');
    await page.click('#fb-save');
    await page.waitForSelector('.drawer', { state: 'detached' });
    await page.waitForTimeout(150);
    const fbList = await page.evaluate(() => PPAPI.store.admin.listFeedback());
    check('A87 feedback status Diproses + note', fbList[0].status === 'Diproses' && fbList[0].catatanAdmin === 'Diteruskan ke bidang teknis.');
    check('A88 list + count refreshed', await page.evaluate(() => /Diproses/.test(document.getElementById('fb-list').textContent) && document.querySelector('[data-count-for="umpan-balik"]').hidden));
    await clearToasts(page);

    /* ---- admins ---- */
    await nav(page, 'admin');
    check('A89 one admin, last-admin guard (no remove button)', await page.evaluate(() => document.querySelectorAll('#admin-body tbody tr').length === 1 && !document.querySelector('[data-remove-admin]') && /Admin terakhir/.test(document.getElementById('admin-body').textContent)));
    await page.fill('#adm-add-email', 'tidak.ada@contoh.id');
    await page.click('#adm-add-check');
    check('A90 unknown email → "Akun belum ditemukan"', await page.evaluate(() => /Akun belum ditemukan/.test(document.getElementById('adm-add-result').textContent)));
    await page.fill('#adm-add-email', 'Dimas.Haryanto@ppapi.demo');
    await page.click('#adm-add-check');
    check('A91 candidate card shows the matching member', await page.evaluate(() => /Dimas Haryanto/.test(document.getElementById('adm-add-result').textContent) && !!document.getElementById('adm-add-confirm')));
    await shot(page, 'd-admin-candidate');
    await page.click('#adm-add-confirm');
    await modalOpen(page);
    await page.click('.modal__footer .btn:last-child');
    await page.waitForFunction(() => document.querySelectorAll('#admin-body tbody tr').length === 2, null, { timeout: 5000 }).catch(() => {});
    check('A92 admin added (2 rows, remove buttons)', await page.evaluate(() => document.querySelectorAll('#admin-body tbody tr').length === 2 && document.querySelectorAll('[data-remove-admin]').length === 2));
    check('A93 ppapi_demo_admins contains Dimas', await page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_demo_admins')).includes('demo-contoh-0003')));
    await page.click('[data-remove-admin="demo-contoh-0003"]');
    await modalOpen(page);
    await page.click('.modal__footer .btn:last-child');
    await page.waitForFunction(() => document.querySelectorAll('#admin-body tbody tr').length === 1, null, { timeout: 5000 }).catch(() => {});
    check('A94 admin removed', await page.evaluate(() => !JSON.parse(localStorage.getItem('ppapi_demo_admins')).includes('demo-contoh-0003') && document.querySelectorAll('#admin-body tbody tr').length === 1));
    await clearToasts(page);

    /* ---- log ---- */
    await nav(page, 'log');
    const logCount = await page.evaluate(() => document.querySelectorAll('#log-list .adm-feed__item').length);
    check('A95 log lists every action (≥ 15)', logCount >= 15, logCount);
    await page.click('[data-chips="log-group"] .chip[data-value="konten"]');
    check('A96 log filter Konten', await page.evaluate(() => { const items = Array.from(document.querySelectorAll('#log-list .adm-feed__item')); return items.length > 0 && items.every(i => /Konten|Berita|Pengumuman|Agenda|Produk|Regulasi/.test(i.querySelector('.adm-feed__meta').textContent)); }));
    await page.click('[data-chips="log-group"] .chip[data-value=""]');
    await shot(page, 'd-log', true);

    /* ---- XSS hardening ---- */
    await inject(page, [applicant('flow-xss1', '<img src=x onerror="window.__xss=1">Eve', {
      email: 'eve@ppapi.demo', profile: Object.assign(applicant('x', 'x').profile, { company: '<script>window.__xss=2</script>', linkedin: 'javascript:alert(1)' }),
      application: Object.assign(applicant('x', 'x').application, { catatan: '<b onmouseover=alert(1)>hai</b>', dokumen: [{ id: 'd1', jenis: 'CV', label: '<i>cv</i>', url: 'javascript:alert(1)' }, { id: 'd2', jenis: 'Lainnya', label: 'ok', url: 'https://example.com/a' }], pasFoto: 'javascript:alert(1)' }),
      certificates: [{ id: 'c1', title: '<svg onload=alert(1)>', issuer: 'x', number: '1', issuedAt: '', expiresAt: '', link: 'javascript:alert(1)' }],
    })]);
    await nav(page, 'permohonan');
    await page.click('[data-chips="pq-status"] .chip[data-value="Menunggu Verifikasi"]');
    await page.click('#pq-list .adm-act[data-id="flow-xss1"]');
    await drawerOpen(page);
    await page.waitForTimeout(200);
    check('A97 XSS: nothing executed, no javascript: links', await page.evaluate(() => window.__xss === undefined && !document.querySelector('a[href^="javascript:" i], img[src^="javascript:" i], main script, .drawer script') && !document.querySelector('.drawer img[src="x"]')));
    check('A98 XSS: markup rendered as text', await page.evaluate(() => document.querySelector('.drawer__title').textContent.includes('<img') && document.querySelector('.drawer__body').textContent.includes('<script>')));
    await closeDrawer(page);

    const ov = await overflow(page);
    check('A99 desktop: no horizontal overflow', ov <= 1, ov);
    await ctx.close();
  }

  /* ================================================================ B — mobile */
  console.log('\nB — mobile 390');
  {
    const ctx = await newCtx('mobile');
    const page = await openPage(ctx, 'admin.html');
    await ready(page);
    await page.evaluate(() => PPAPI.store.submitFeedback({ kategori: 'Pertanyaan', nama: 'Penanya Seluler', email: 'penanya@contoh.id', subjek: 'Jadwal sertifikasi', pesan: 'Kapan jadwal sertifikasi inspektur perancah berikutnya dibuka?', rating: 5 }));
    await page.click('#adm-refresh');
    await page.waitForFunction(() => !document.querySelector('#adm-refresh').disabled);
    await clearToasts(page);
    check('B1 tab strip visible, rail label hidden', await page.evaluate(() => getComputedStyle(document.querySelector('.adm-nav__list')).display === 'flex' && getComputedStyle(document.querySelector('.adm-nav__label')).display === 'none'));
    await shot(page, 'm-ringkasan', true);
    for (const s of ['permohonan', 'anggota', 'konten', 'umpan-balik', 'admin', 'log']) {
      await nav(page, s);
      if (s === 'konten') await page.waitForSelector('#kt-list tbody tr');
      await page.waitForTimeout(120);
      const ov = await overflow(page);
      check(`B ${s}: no horizontal overflow`, ov <= 1, ov);
      check(`B ${s}: active tab scrolled into the strip`, await page.evaluate(() => { const a = document.querySelector('.adm-nav__link[aria-current="page"]'); const l = a.closest('.adm-nav__list').getBoundingClientRect(); const r = a.getBoundingClientRect(); return r.left >= l.left - 1 && r.right <= l.right + 1; }));
      await shot(page, 'm-' + s, true);
    }
    await nav(page, 'permohonan');
    await page.click('#pq-list .adm-act');
    await drawerOpen(page);
    await shot(page, 'm-drawer');
    const foot = await page.$$eval('.drawer__footer .btn', bs => bs.map(b => { const r = b.getBoundingClientRect(); return [b.textContent.trim(), Math.round(r.top), Math.round(r.width)]; }));
    check('B8 drawer footer: primary full row first, two secondary share the next', foot.length === 3 && foot[2][1] < foot[0][1] && foot[0][1] === foot[1][1], foot);
    check('B9 drawer no overflow', (await page.evaluate(() => { const p = document.querySelector('.drawer__body'); return p.scrollWidth - p.clientWidth; })) <= 1);
    await page.click('#act-approve');
    await modalOpen(page);
    await shot(page, 'm-dialog-approve');
    await page.keyboard.press('Escape');
    await page.waitForSelector('.modal', { state: 'detached' });
    check('B10 Esc closes the dialog first, drawer stays', await page.evaluate(() => !!document.querySelector('.drawer')));
    await closeDrawer(page);
    await nav(page, 'konten');
    await page.waitForSelector('#kt-list tbody tr');
    await page.click('#kt-add');
    await modalOpen(page);
    await shot(page, 'm-dialog-berita');
    await page.keyboard.press('Escape');
    await ctx.close();
  }

  /* ================================================================ C — deep link */
  console.log('\nC — deep link');
  {
    const ctx = await newCtx('desktop');
    const page = await openPage(ctx, 'admin.html#konten/agenda');
    await ready(page);
    await page.waitForSelector('#kt-list tbody tr');
    check('C1 #konten/agenda opens Konten → Agenda', await page.evaluate(() => !document.getElementById('sec-konten').hidden && document.querySelector('.adm-subnav__link[aria-current="page"]').dataset.type === 'agenda' && document.querySelector('.adm-nav__link[aria-current="page"]').dataset.section === 'konten'));
    check('C2 initial load does not steal focus', await page.evaluate(() => document.activeElement === document.body || document.activeElement === document.documentElement));
    await page.focus('.adm-nav__link[data-section="permohonan"]');
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => !document.getElementById('sec-permohonan').hidden);
    await page.waitForTimeout(100);
    check('C3 keyboard: Enter on a nav link switches section + focuses its heading', await page.evaluate(() => document.activeElement.id === 'h-permohonan'));
    await page.click('#pq-list .adm-act');
    await drawerOpen(page);
    await page.goBack();
    await page.waitForFunction(() => !document.getElementById('sec-konten').hidden);
    await page.waitForTimeout(150);
    check('C4 browser Back with a drawer open closes the drawer and returns to Konten', await page.evaluate(() => !document.querySelector('.drawer') && document.querySelector('.adm-subnav__link[aria-current="page"]').dataset.type === 'agenda'));
    await nav(page, 'umpan-balik');
    await page.evaluate(() => PPAPI.store.submitFeedback({ kategori: 'Apresiasi', nama: 'Uji', email: 'uji@contoh.id', subjek: 'Tanpa perubahan', pesan: 'Pesan uji tanpa perubahan status.' }));
    await page.click('#adm-refresh');
    await page.waitForFunction(() => !document.querySelector('#adm-refresh').disabled);
    await clearToasts(page);
    await page.click('#fb-list .adm-act');
    await drawerOpen(page);
    await page.click('#fb-save');
    check('C5 feedback: saving without changes writes nothing', /Tidak ada perubahan/.test(await toastText(page)) && (await page.evaluate(() => PPAPI.store.admin.audit(5))).every(x => x.action !== 'umpan-balik.diperbarui'));
    await ctx.close();
  }

  /* ================================================================ D — non-admin */
  console.log('\nD — non-admin member');
  {
    const ctx = await newCtx('desktop', { who: 'member' });
    const page = await openPage(ctx, 'admin.html');
    await page.waitForURL(/dashboard\.html/, { timeout: 10000 }).catch(() => {});
    check('D1 member redirected to dashboard.html', /dashboard\.html$/.test(page.url()), page.url());
    check('D2 flash toast "Halaman ini khusus admin PPAPI."', /Halaman ini khusus admin PPAPI\./.test(await toastText(page)));
    check('D3 admin API refuses the member', await page.evaluate(() => PPAPI.store.admin.listMembers().then(() => false, e => e.code === 'store/forbidden')));
    await ctx.close();
  }

  /* ================================================================ E — signed out */
  console.log('\nE — signed out');
  {
    const ctx = await newCtx('desktop', { who: 'none' });
    const page = await openPage(ctx, 'admin.html#permohonan');
    await page.waitForURL(/masuk\.html/, { timeout: 10000 }).catch(() => {});
    check('E1 signed out → masuk.html?next=admin.html#permohonan', /masuk\.html\?next=admin\.html%23permohonan$/.test(page.url()), page.url());
    await ctx.close();
  }

  /* ================================================================ F — axe-core */
  console.log('\nF — axe-core (WCAG 2.2 A/AA + best practice; serious/critical/moderate)');
  let AXE = null;
  try { AXE = await (await fetch('https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js')).text(); } catch (e) { console.log('  (axe-core tidak dapat diunduh — skenario F dilewati)'); }
  if (AXE && AXE.length > 10000) {
    for (const vp of ['desktop', 'mobile']) {
      const ctx = await newCtx(vp);
      const page = await openPage(ctx, 'admin.html');
      await ready(page);
      await page.evaluate(() => PPAPI.store.submitFeedback({ kategori: 'Kritik', nama: 'Penguji Aksesibilitas', email: 'a11y@contoh.id', subjek: 'Uji axe', pesan: 'Pesan untuk pengujian aksesibilitas konsol.', rating: 3 }));
      await page.click('#adm-refresh');
      await page.waitForFunction(() => !document.querySelector('#adm-refresh').disabled);
      await clearToasts(page);
      await page.addScriptTag({ content: AXE });
      const run = async (label) => {
        const v = await page.evaluate(async () => {
          const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
          return r.violations.filter(x => ['serious', 'critical', 'moderate'].includes(x.impact)).map(x => x.id + ' (' + x.impact + '): ' + x.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | '));
        });
        check(`F ${vp} axe ${label}: 0 violations`, v.length === 0, v);
      };
      for (const s of ['ringkasan', 'permohonan', 'anggota', 'konten', 'umpan-balik', 'admin', 'log']) {
        if (s !== 'ringkasan') await nav(page, s);
        if (s === 'konten') await page.waitForSelector('#kt-list tbody tr');
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(100);
        await run(s);
      }
      await nav(page, 'permohonan');
      await page.click('#pq-list .adm-act');
      await drawerOpen(page);
      await run('drawer permohonan');
      await page.click('#act-revise');
      await modalOpen(page);
      await page.click('#dlg-revise-ok');
      await page.waitForTimeout(100);
      await run('dialog (with inline error)');
      await page.keyboard.press('Escape');
      await page.waitForSelector('.modal', { state: 'detached' });
      await closeDrawer(page);
      await nav(page, 'umpan-balik');
      await page.click('#fb-list .adm-act');
      await drawerOpen(page);
      await run('drawer umpan balik');
      await closeDrawer(page);
      await nav(page, 'konten');
      await page.waitForSelector('#kt-list tbody tr');
      await page.click('.adm-subnav__link[data-type="pustaka"]');
      await page.waitForSelector('#kt-list tbody tr');
      await page.click('#kt-add');
      await modalOpen(page);
      await run('dialog pustaka');
      await page.keyboard.press('Escape');
      await ctx.close();
    }
  }
} catch (err) {
  fail++;
  failures.push('EXCEPTION: ' + err.message);
  console.error(err);
}

const relevant = consoleIssues.filter(x => !/favicon/.test(x));
check('no console errors/warnings or page errors', relevant.length === 0, relevant.slice(0, 8));
await browser.close();
server.close();
console.log(`\nadmin-flow: ${pass} passed, ${fail} failed`);
if (failures.length) console.log('Failures:\n - ' + failures.join('\n - '));
process.exit(fail ? 1 : 0);
