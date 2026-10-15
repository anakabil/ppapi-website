// PPAPI v2 lens — Konsol Admin at association scale (REVIEW ONLY; never writes to site/).
// Seeds N demo members (default 300) straight into localStorage (demo mode), then measures:
//   load → html[data-admin-ready], long tasks (count / total / max / TBT>50ms), DOM size,
//   section switches (Anggota, Permohonan), search keystrokes, filter change, drawer open,
//   Event Timing (INP proxy) for every interaction, and the admin dashboard band.
// Usage (cwd devtools/): node flows/v2lens-admin-scale.mjs [--n=300] [--vp=desktop|mobile]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'shots', 'v2lens');
fs.mkdirSync(OUT, { recursive: true });
const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const N = +(flags.n || 300);

const DEMO_ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
const FIRST = ['Budi', 'Siti', 'Agus', 'Dewi', 'Rudi', 'Rina', 'Joko', 'Tari', 'Hendra', 'Maya', 'Yusuf', 'Lina', 'Bayu', 'Putri', 'Fajar', 'Indah', 'Eko', 'Wulan', 'Arif', 'Sri'];
const LAST = ['Santoso', 'Wijaya', 'Pratama', 'Lestari', 'Saputra', 'Hidayat', 'Kurniawan', 'Nugroho', 'Siregar', 'Harahap', 'Simanjuntak', 'Wibowo', 'Setiawan', 'Rahman', 'Sitompul'];
const PROV = ['DKI Jakarta', 'Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'Banten', 'Kalimantan Timur', 'Riau', 'Sumatera Utara', 'Sulawesi Selatan', 'Papua'];
function gen(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = i % 20;
    const status = r < 4 ? 'Menunggu Verifikasi' : r < 5 ? 'Perlu Perbaikan' : r < 6 ? 'Ditolak' : r < 7 ? 'Nonaktif' : r < 8 ? 'Draf' : 'Aktif';
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 7) % LAST.length]} (Uji ${String(i + 1).padStart(3, '0')})`;
    const uid = 'scale-' + String(i + 1).padStart(4, '0');
    const aktif = status === 'Aktif' || status === 'Nonaktif';
    const day = String(1 + (i % 28)).padStart(2, '0');
    const vu = aktif ? (i % 9 === 0 ? '2026-11-' + day : i % 13 === 0 ? '2026-06-' + day : '2029-12-31') : '';
    out.push({
      uid, name, email: `uji${i + 1}@contoh.id`, phone: '+62812' + String(10000000 + i), photoURL: '',
      kta: aktif ? `PPAPI-2025-${String(i + 1).padStart(6, '0')}` : '', memberType: i % 5 === 0 ? 'Ahli' : 'Praktisi', status,
      joinedAt: `2025-${String(1 + (i % 12)).padStart(2, '0')}-${day}`, validUntil: vu, approvedAt: aktif ? '2025-06-01T02:00:00.000Z' : '', approvedBy: aktif ? 'demo-admin-0001' : '',
      profile: { birthPlace: 'Bandung', birthDate: '1988-05-' + day, gender: i % 2 ? 'Perempuan' : 'Laki-laki', province: PROV[i % PROV.length], city: 'Kota Uji ' + (i % 30), address: 'Jl. Uji No. ' + i, company: 'PT Uji Perancah ' + (i % 40), position: 'Supervisor Perancah', experienceYears: 3 + (i % 20), education: 'Sarjana (S1)', bio: '', linkedin: '' },
      competencies: [{ id: 'k' + i, code: 'SCF-05', name: 'Teknisi Scaffolding', level: 'Mahir', since: 2018, notes: '' }],
      certificates: [{ id: 'c' + i, title: 'Teknisi Scaffolding', number: 'UJI/' + i, issuer: 'BNSP / LSP', issuedAt: '2023-05-10', expiresAt: '2028-05-10', link: '' }],
      application: {
        type: 'baru', kategori: i % 5 === 0 ? 'Ahli' : 'Praktisi', submittedAt: status === 'Draf' ? '' : `2026-${String(1 + (i % 9)).padStart(2, '0')}-${day}T02:00:00.000Z`, updatedAt: '2026-09-01T02:00:00.000Z',
        pengalaman: [{ id: 'p1-' + i, proyek: 'Proyek uji gedung ' + i, peran: 'Supervisor', tahun: '2024', lokasi: 'Jakarta' }, { id: 'p2-' + i, proyek: 'Proyek uji kilang ' + i, peran: 'Teknisi', tahun: '2022', lokasi: 'Balikpapan' }],
        dokumen: [{ id: 'd1-' + i, jenis: 'CV', label: 'CV', url: 'https://example.com/cv-' + i + '.pdf' }, { id: 'd2-' + i, jenis: 'Sertifikat', label: 'Sertifikat', url: 'https://example.com/s-' + i + '.pdf' }],
        pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' },
        pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: name, tanggal: '2026-09-01' }, catatan: ''
      },
      review: { note: '', history: [{ at: '2026-09-01T02:00:00.000Z', by: uid, byName: name, action: 'diajukan', note: '' }] },
      contoh: false, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: `2026-09-${day}T02:00:00.000Z`,
    });
  }
  return out;
}
const MEMBERS = gen(N);

const { BASE, close } = await startServer();
const browser = await chromium.launch();
const VPS = [
  { name: 'desktop', width: 1440, height: 900, dpr: 1, cpu: 1 },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, dpr: 2, cpu: 4 },
].filter(v => !flags.vp || v.name === flags.vp);

const OBS = `
window.__sc = { long: [], ev: [] };
try { new PerformanceObserver(l => l.getEntries().forEach(e => window.__sc.long.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }))).observe({ type: 'longtask', buffered: true }); } catch (e) {}
try { new PerformanceObserver(l => l.getEntries().forEach(e => { if (e.interactionId || e.name === 'input' || e.name === 'keydown' || e.name === 'click' || e.name === 'change') window.__sc.ev.push({ n: e.name, t: Math.round(e.startTime), d: Math.round(e.duration), id: e.interactionId || 0 }); })).observe({ type: 'event', buffered: true, durationThreshold: 16 }); } catch (e) {}
`;
const report = {};
for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.dpr, locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  await ctx.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, r => r.abort());
  await ctx.addInitScript(({ a, ms }) => {
    try {
      if (!localStorage.getItem('ppapi_demo_session')) {
        localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
        localStorage.setItem('ppapi_demo_admins', JSON.stringify([a.uid]));
        for (const m of ms) localStorage.setItem('ppapi_member_' + m.uid, JSON.stringify(m));
      }
    } catch (e) { console.warn('seed failed', e.message); }
  }, { a: DEMO_ADMIN, ms: MEMBERS });
  await ctx.addInitScript(OBS);
  const page = await ctx.newPage();
  if (vp.cpu > 1) { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: vp.cpu }); }
  const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text().slice(0, 200)); });
  const R = { errs };
  const lt = async (since) => page.evaluate(s => { const L = window.__sc.long.filter(x => x.t >= s); return { n: L.length, total: L.reduce((a, x) => a + x.d, 0), max: L.reduce((a, x) => Math.max(a, x.d), 0), tbt: L.reduce((a, x) => a + Math.max(0, x.d - 50), 0) }; }, since);
  const now = () => page.evaluate(() => performance.now());
  const evs = async (since) => page.evaluate(s => window.__sc.ev.filter(x => x.t >= s).sort((a, b) => b.d - a.d).slice(0, 5), since);

  // 1. load
  let t0 = Date.now();
  await page.goto(`${BASE}/admin.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('html[data-admin-ready]', { timeout: 60000 });
  R.loadReadyMs = Date.now() - t0;
  await page.waitForTimeout(800);
  R.load = await lt(0);
  R.storedMembers = await page.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('ppapi_member_')).length);
  R.lsBytes = await page.evaluate(() => { let n = 0; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); n += k.length + (localStorage.getItem(k) || '').length; } return n * 2; });
  R.kpis = await page.$$eval('.adm-kpi', els => els.map(e => e.textContent.trim().replace(/\s+/g, ' ')).slice(0, 6));

  // 2. Anggota section
  let s = await now(); t0 = Date.now();
  await page.click('.adm-nav__link[data-section="anggota"]');
  await page.waitForSelector('#aq-list tbody tr', { timeout: 30000 });
  R.anggotaMs = Date.now() - t0;
  await page.waitForTimeout(500);
  R.anggota = await lt(s);
  R.anggotaRows = await page.$$eval('#aq-list tbody tr', r => r.length);
  R.domNodes = await page.evaluate(() => document.getElementsByTagName('*').length);
  R.anggotaEvents = await evs(s);

  // 3. search, typed char by char
  s = await now(); t0 = Date.now();
  await page.click('#aq-q');
  await page.keyboard.type('budi', { delay: 80 });
  await page.waitForTimeout(800);
  R.searchMs = Date.now() - t0;
  R.search = await lt(s);
  R.searchEvents = await evs(s);
  R.searchRows = await page.$$eval('#aq-list tbody tr', r => r.length);
  R.searchFocusKept = await page.evaluate(() => document.activeElement && document.activeElement.id === 'aq-q');
  // clear search
  await page.fill('#aq-q', ''); await page.waitForTimeout(600);

  // 4. filter change (status = Aktif) then sort by name
  s = await now(); t0 = Date.now();
  if (await page.isVisible('#aq-filter-toggle')) await page.click('#aq-filter-toggle'); // phones: selects sit behind "Saring"
  await page.selectOption('#aq-status', 'Aktif');
  await page.waitForTimeout(400);
  await page.selectOption('#aq-sort', 'nama');
  await page.waitForTimeout(600);
  R.filterMs = Date.now() - t0;
  R.filter = await lt(s);
  R.filterEvents = await evs(s);

  // 5. drawer open
  s = await now(); t0 = Date.now();
  await page.click('#aq-list .adm-act >> nth=0');
  await page.waitForSelector('.drawer__panel', { timeout: 20000 });
  R.drawerMs = Date.now() - t0;
  await page.waitForTimeout(500);
  R.drawer = await lt(s);
  R.drawerEvents = await evs(s);
  await page.keyboard.press('Escape'); await page.waitForTimeout(500);

  // 6. Permohonan with many pending
  s = await now(); t0 = Date.now();
  await page.click('.adm-nav__link[data-section="permohonan"]');
  await page.waitForSelector('#pq-list tbody tr', { timeout: 30000 }).catch(() => {});
  R.permohonanMs = Date.now() - t0;
  await page.waitForTimeout(500);
  R.permohonan = await lt(s);
  R.permohonanRows = await page.$$eval('#pq-list tbody tr', r => r.length);

  // 7. Muat Ulang Data
  s = await now(); t0 = Date.now();
  await page.click('#adm-refresh');
  await page.waitForFunction(() => !document.querySelector('#adm-refresh').disabled, null, { timeout: 30000 });
  R.refreshMs = Date.now() - t0;
  await page.waitForTimeout(300);
  R.refresh = await lt(s);

  // 8. Log + Ringkasan
  s = await now(); t0 = Date.now();
  await page.click('.adm-nav__link[data-section="ringkasan"]');
  await page.waitForTimeout(800);
  R.ringkasan = await lt(s);
  await page.screenshot({ path: path.join(OUT, `admin-scale-${vp.name}.png`) });

  // 9. dashboard (admin band uses store.admin.summary())
  s = 0; t0 = Date.now();
  await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady(), null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  R.dashboardMs = Date.now() - t0;
  R.dashboard = await lt(0);
  R.inp = await page.evaluate(() => 0);
  report[vp.name] = R;
  console.log(`\n[${vp.name}] N=${N}`, JSON.stringify(R, null, 1));
  await ctx.close();
}
fs.writeFileSync(path.join(OUT, `admin-scale-${N}.json`), JSON.stringify(report, null, 1));
await browser.close();
await close();
