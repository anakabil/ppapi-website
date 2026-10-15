// Fixer "admin" probe — console density + table fit, per section and viewport.
// Seeds the demo admin + N generated members (default 40; ~1/4 pending) and measures, at scrollTop 0:
//   bandH (header + dark band), firstDataY, rowsVisible (data rows fully inside the viewport),
//   overflow (scrollWidth − clientWidth of every .table-wrap), demoNotices (Konten), and saves screenshots.
// Usage (cwd devtools/): node flows/fix-admin-probe.mjs [--n=40] [--tag=before] [--shots]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'shots', 'fix-admin');
fs.mkdirSync(OUT, { recursive: true });
const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const N = +(flags.n || 40);
const TAG = flags.tag || 'probe';

const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
const FIRST = ['Budi', 'Siti', 'Agus', 'Dewi', 'Rudi', 'Rina', 'Joko', 'Tari', 'Hendra', 'Maya'];
const LAST = ['Santoso', 'Wijaya', 'Pratama', 'Lestari', 'Saputra', 'Hidayat', 'Kurniawan', 'Nugroho', 'Siregar', 'Harahap'];
export function gen(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const r = i % 8;
    const status = r < 2 ? 'Menunggu Verifikasi' : r < 3 ? 'Perlu Perbaikan' : r < 4 ? 'Draf' : 'Aktif';
    const uid = 'fx-' + String(i + 1).padStart(4, '0');
    const name = `${FIRST[i % FIRST.length]} ${LAST[(i * 3) % LAST.length]} Uji ${String(i + 1).padStart(3, '0')}`;
    const aktif = status === 'Aktif';
    const day = String(1 + (i % 28)).padStart(2, '0');
    out.push({
      uid, name, email: `uji${i + 1}@contoh.id`, phone: '+62812' + String(10000000 + i), photoURL: '',
      kta: aktif ? `PPAPI-2025-${String(i + 1).padStart(6, '0')}` : '', memberType: i % 5 === 0 ? 'Ahli' : 'Praktisi', status,
      joinedAt: `2025-${String(1 + (i % 12)).padStart(2, '0')}-${day}`, validUntil: aktif ? (i % 6 === 0 ? '2026-11-' + day : '2029-12-31') : '',
      approvedAt: aktif ? '2025-06-01T02:00:00.000Z' : '', approvedBy: aktif ? ADMIN.uid : '',
      profile: { birthPlace: 'Bandung', birthDate: '1988-05-' + day, gender: i % 2 ? 'Perempuan' : 'Laki-laki', province: i % 2 ? 'Kalimantan Timur' : 'DKI Jakarta', city: i % 2 ? 'Balikpapan' : 'Jakarta Selatan', address: 'Jl. Uji No. ' + i, company: 'PT Uji Perancah ' + (i % 9), position: 'Supervisor Perancah', experienceYears: 3 + (i % 20), education: 'Sarjana (S1)', bio: '', linkedin: '' },
      competencies: [], certificates: [],
      application: {
        type: 'baru', kategori: i % 5 === 0 ? 'Ahli' : 'Praktisi', submittedAt: status === 'Draf' ? '' : `2026-0${1 + (i % 9)}-${day}T02:00:00.000Z`, updatedAt: '2026-09-01T02:00:00.000Z',
        pengalaman: [{ id: 'p1-' + i, proyek: 'Proyek uji ' + i, peran: 'Supervisor', tahun: '2024', lokasi: 'Jakarta' }],
        dokumen: [{ id: 'd1-' + i, jenis: 'CV', label: 'CV', url: 'https://example.com/cv-' + i + '.pdf' }],
        pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' },
        pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: name, tanggal: '2026-09-01' }, catatan: ''
      },
      review: { note: status === 'Perlu Perbaikan' ? 'Lengkapi dokumen.' : '', history: [] },
      contoh: false, createdAt: '2025-01-01T00:00:00.000Z', updatedAt: `2026-09-${day}T02:00:00.000Z`,
    });
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('fix-admin-probe.mjs')) {
  const MEMBERS = gen(N);
  const { BASE, close } = await startServer();
  const browser = await chromium.launch();
  const VPS = [
    { name: '1440', width: 1440, height: 900 },
    { name: '1280', width: 1280, height: 800 },
    { name: '1200', width: 1200, height: 800 },
    { name: '1024', width: 1024, height: 768 },
    { name: '768', width: 768, height: 1024 },
    { name: '390', width: 390, height: 844, mobile: true },
  ];
  const SECTIONS = ['ringkasan', 'permohonan', 'anggota', 'konten', 'umpan-balik', 'admin', 'log'];
  const res = {};
  const errs = [];
  for (const vp of VPS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.mobile, hasTouch: !!vp.mobile, reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
    await ctx.addInitScript(({ a, ms }) => {
      try {
        if (!localStorage.getItem('ppapi_demo_session')) {
          localStorage.setItem('ppapi_demo_ribbon_dismissed', 'true');
          localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
          localStorage.setItem('ppapi_demo_admins', JSON.stringify([a.uid]));
          for (const m of ms) localStorage.setItem('ppapi_member_' + m.uid, JSON.stringify(m));
        }
      } catch (e) { /* ignore */ }
    }, { a: ADMIN, ms: MEMBERS });
    const p = await ctx.newPage();
    p.on('pageerror', e => errs.push(vp.name + ' pageerror: ' + e.message));
    p.on('console', m => { if (m.type() === 'error') errs.push(vp.name + ' console: ' + m.text().slice(0, 200)); });
    await p.goto(BASE + '/admin.html#ringkasan', { waitUntil: 'networkidle' });
    await p.waitForSelector('html[data-admin-ready]', { timeout: 30000 });
    await p.waitForTimeout(600);
    res[vp.name] = {};
    for (const s of SECTIONS) {
      await p.evaluate(x => { location.hash = x; }, s);
      await p.waitForTimeout(500);
      await p.evaluate(() => window.scrollTo(0, 0));
      await p.waitForTimeout(150);
      res[vp.name][s] = await p.evaluate(x => {
        const sec = document.getElementById('sec-' + x);
        const hero = document.querySelector('.adm-hero');
        const rows = [...sec.querySelectorAll('tbody tr, .adm-list__item, .adm-feed__item')].filter(r => r.offsetParent !== null);
        const first = sec.querySelector('tbody tr, .kpi, .adm-list__item, .adm-feed__item, .empty-state');
        const vis = rows.filter(r => r.getBoundingClientRect().bottom <= innerHeight).length;
        const overflow = [...sec.querySelectorAll('.table-wrap')].map(tw => tw.scrollWidth - tw.clientWidth);
        const notices = [...document.querySelectorAll('#sec-konten .alert, #sec-konten .adm-demo-note, .adm-hero__mode, .adm-nav__note')].filter(e => e.offsetParent !== null && /demo/i.test(e.textContent)).length;
        return {
          bandBottom: hero ? Math.round(hero.getBoundingClientRect().bottom + scrollY) : null,
          headH: Math.round(sec.querySelector('.adm-head').getBoundingClientRect().height),
          firstDataY: first ? Math.round(first.getBoundingClientRect().top + scrollY) : null,
          rows: rows.length, rowsVisible: vis, overflow,
          docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          ...(x === 'konten' ? { demoNotices: notices } : {}),
        };
      }, s);
      if (flags.shots) await p.screenshot({ path: path.join(OUT, `${TAG}-${s}-${vp.name}.png` ) });
    }
    await ctx.close();
  }
  console.log(JSON.stringify(res, null, 1));
  if (errs.length) console.log('ERRORS', errs);
  fs.writeFileSync(path.join(OUT, `_probe-${TAG}.json`), JSON.stringify({ res, errs }, null, 1));
  await browser.close(); await close();
}
