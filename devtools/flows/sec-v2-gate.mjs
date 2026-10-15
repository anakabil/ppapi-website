// Security lens v2 — gating matrix (demo mode).
// For every membership state × every page (incl. aplikasi/*): final URL after load, header account-menu
// items, member-feature links visible on the page, app gate result, and pustaka.fileUrl() outcome.
// Run from devtools/:  node flows/sec-v2-gate.mjs   → prints a matrix + writes shots/sec-v2-gate.json
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { startServer } from './qa-lib.mjs';

const OUT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'shots');
const { BASE, close } = await startServer();

const USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
function member(status) {
  const m = {
    uid: USER.uid, name: USER.name, email: USER.email, phone: USER.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif',
    joinedAt: '2026-03-14', validUntil: '2029-12-31', approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001',
    profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Contoh', position: 'Supervisor', experienceYears: 9, birthDate: '1990-01-01' },
    competencies: [], certificates: [], updatedAt: '2026-09-30T08:00:00.000Z',
    application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z', updatedAt: '2026-03-15T02:00:00.000Z', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Rahmat Hidayat', tanggal: '2026-03-15' }, catatan: '' },
    review: { note: '', history: [] },
  };
  if (status === 'Kedaluwarsa') { m.validUntil = '2026-06-30'; return m; }
  m.status = status;
  if (status !== 'Aktif' && status !== 'Nonaktif') { m.kta = ''; m.validUntil = ''; m.approvedAt = ''; m.approvedBy = ''; }
  if (status === 'Draf') m.application.submittedAt = '';
  return m;
}
const STATES = [
  { key: 'out' },
  ...['Draf', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Ditolak', 'Nonaktif', 'Kedaluwarsa', 'Aktif'].map(s => ({ key: s, user: USER, member: member(s) })),
  { key: 'admin', user: ADMIN, admins: [ADMIN.uid] },
  { key: 'admin-dicabut', user: ADMIN, admins: [] },
];
const PAGES = ['index', 'profil', 'berita', 'agenda', 'pustaka', 'regulasi', 'keanggotaan', 'verifikasi', 'umpan-balik', 'kebijakan-privasi', 'masuk', 'dashboard', 'anggota', 'pendaftaran', 'admin', 'styleguide', '404', 'aplikasi/perencanaan/index', 'aplikasi/simulator/index'];

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const result = {};
for (const st of STATES) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  await ctx.clock.setFixedTime(new Date('2026-10-09T10:00:00+07:00'));
  await ctx.addInitScript((s) => {
    try {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('ppapi_demo_seed_v2', JSON.stringify({ v: 2, at: 'x' }));   /* no sample members */
      if (s.user) {
        localStorage.setItem('ppapi_demo_session', JSON.stringify(s.user));
        if (s.member) localStorage.setItem('ppapi_member_' + s.user.uid, JSON.stringify(s.member));
      }
      localStorage.setItem('ppapi_demo_admins', JSON.stringify(s.admins || []));
    } catch (e) {}
  }, st);
  result[st.key] = {}; console.error('state', st.key);
  for (const pg of PAGES) {
    const page = await ctx.newPage();
    const three = [];
    page.on('request', r => { if (/three|jspdf/.test(r.url())) three.push(r.url()); });
    try {
      await page.goto(`${BASE}/${pg}.html`, { waitUntil: 'networkidle', timeout: 30000 });
    } catch (e) { /* redirect races */ }
    await page.waitForTimeout(1200);
    const info = await page.evaluate(() => {
      const href = (a) => a.getAttribute('href') || '';
      const menu = [...document.querySelectorAll('#account-menu a, #account-menu button')].map(a => (a.getAttribute('href') || '[' + (a.textContent || '').trim() + ']'));
      const main = document.querySelector('main') || document.body;
      const feat = [...main.querySelectorAll('a[href]')].map(href).filter(h => /aplikasi\/|anggota\.html|admin\.html|^https?:/i.test(h) && !/^https?:\/\/(fonts|www\.google|maps)/.test(h));
      const locked = main.querySelectorAll('.locked').length;
      const gateOk = document.documentElement.classList.contains('app-gate-ok');
      const appVisible = !!document.getElementById('app-main') && getComputedStyle(document.getElementById('app-main')).display !== 'none' && !document.documentElement.classList.contains('app-gate-pending');
      return { url: location.pathname.replace(/^.*\/site\//, '/').split('/').slice(-2).join('/') + location.search, menu, feat: [...new Set(feat)].slice(0, 30), locked, gateOk, appVisible };
    }).catch(e => ({ err: e.message }));
    info.lib = three.length;
    result[st.key][pg] = info;
    await page.close();
  }
  /* pustaka.fileUrl for a member-only item, as this viewer */
  const p = await ctx.newPage();
  await p.goto(`${BASE}/pustaka.html`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  result[st.key].__fileUrl = await p.evaluate(async () => {
    const it = (PPAPI.data.pustaka || []).find(x => x.akses === 'anggota' && x.tautan);
    try { return await PPAPI.store.pustaka.fileUrl(it); } catch (e) { return e.code; }
  });
  await p.close();
  await ctx.close();
}
await browser.close();
await close();
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'sec-v2-gate.json'), JSON.stringify(result, null, 1));
for (const [k, pages] of Object.entries(result)) {
  console.log('\n=== ' + k + '   fileUrl(member-only app item) → ' + JSON.stringify(pages.__fileUrl));
  for (const [pg, i] of Object.entries(pages)) {
    if (pg === '__fileUrl') continue;
    console.log(`  ${pg.padEnd(28)} → ${String(i.url).padEnd(44)} menu=[${(i.menu || []).join(' ')}] locked=${i.locked} gateOk=${i.gateOk} lib=${i.lib}` + (i.feat && i.feat.length ? `\n      links: ${i.feat.join(' ')}` : ''));
  }
}
