// PPAPI — element / region screenshot helper for masuk, keanggotaan and verifikasi (review only).
// Run from devtools/:
//   node flows/mkv-shot.mjs <page[?query][#hash]> <selector|viewport> <out-name> [--mobile] [--auth] [--status=X] [--admin]
//        [--eval="js before the shot"] [--click=selector] [--wait=ms] [--full]
// Same demo fixtures as check.mjs (--auth = ACTIVE member PPAPI-2026-004821 valid until 2029-12-31; --status overrides).
// Output: devtools/shots/mkv/<out-name>-<desktop|mobile>.png
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const OUT = path.resolve(__dirname, '..', 'shots', 'mkv');
fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const [pg, sel, name] = args.filter(a => !a.startsWith('--'));
if (!pg || !sel || !name) { console.error('usage: node flows/mkv-shot.mjs <page> <selector|viewport> <name> [flags]'); process.exit(1); }

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'content-type': MIME['.html'] }); return res.end('<!doctype html><title>404</title>stub'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

export function memberFixture(status) {
  const m = {
    uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890',
    kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31',
    approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001',
    profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Contoh Konstruksi', position: 'Scaffolding Supervisor', experienceYears: 9, education: 'D3 Teknik Sipil' },
    competencies: [{ id: 'k1', code: 'SCF-SUP', name: 'Supervisor Perancah', level: 'Mahir', since: 2019, notes: '' }, { id: 'k2', code: 'SCF-INS', name: 'Inspektur Perancah', level: 'Menengah', since: 2022, notes: '' }],
    certificates: [], updatedAt: '2026-09-30T08:00:00.000Z',
    application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z', updatedAt: '2026-03-15T02:00:00.000Z', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Rahmat Hidayat', tanggal: '2026-03-15' }, catatan: '' },
    review: { note: '', history: [] },
  };
  if (status === 'Kedaluwarsa') m.validUntil = '2026-06-30';
  else if (status && status !== 'Aktif') {
    m.status = status;
    if (status !== 'Nonaktif') { m.kta = ''; m.validUntil = ''; m.approvedAt = ''; m.approvedBy = ''; }
    if (status === 'Draf') m.application.submittedAt = '';
    if (status === 'Perlu Perbaikan') m.review = { note: 'Mohon lengkapi tautan sertifikat dan riwayat proyek.', history: [] };
    if (status === 'Ditolak') m.review = { note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.', history: [] };
  }
  return m;
}

const browser = await chromium.launch();
const mobile = !!flags.mobile;
const ctx = await browser.newContext({
  viewport: flags.w ? { width: +flags.w, height: +(flags.h || 800) } : (mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }), isMobile: mobile, hasTouch: mobile,
  deviceScaleFactor: mobile ? 2 : 1, reducedMotion: flags.motion ? 'no-preference' : 'reduce', locale: 'id-ID',
});
if (flags.auth) {
  const u = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
  await ctx.addInitScript(({ u, m }) => {
    try {
      if (sessionStorage.getItem('__mkv')) return;
      sessionStorage.setItem('__mkv', '1');
      localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
      const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
      users[u.email] = { ...u, hash: 'x' };
      localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
      localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
    } catch (e) {}
  }, { u, m: memberFixture(flags.status) });
}
if (flags.admin) {
  await ctx.addInitScript(() => {
    try {
      if (!localStorage.getItem('ppapi_demo_session')) localStorage.setItem('ppapi_demo_session', JSON.stringify({ uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' }));
      const a = JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]');
      if (!a.includes('demo-admin-0001')) { a.push('demo-admin-0001'); localStorage.setItem('ppapi_demo_admins', JSON.stringify(a)); }
    } catch (e) {}
  });
}
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.text()); });
page.on('pageerror', e => errs.push('pageerror ' + e.message));
const [pp, hash = ''] = pg.split('#');
const [p0, q = ''] = pp.split('?');
await page.goto(`${BASE}/${p0}.html${q ? '?' + q : ''}${hash ? '#' + hash : ''}`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.body.classList.contains('auth-ready'), null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(Number(flags.wait || 500));
if (flags.click) { await page.click(flags.click); await page.waitForTimeout(400); }
if (flags.eval) { await page.evaluate(flags.eval); await page.waitForTimeout(400); }
const file = path.join(OUT, `${name}-${flags.w ? 'w' + flags.w : (mobile ? 'mobile' : 'desktop')}.png`);
if (sel === 'viewport') await page.screenshot({ path: file, fullPage: !!flags.full });
else {
  const loc = page.locator(sel).first();
  await loc.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  await loc.screenshot({ path: file });
}
console.log(file.replace(/\\/g, '/'), errs.length ? 'ERRORS: ' + errs.join(' | ') : 'ok', page.url().replace(BASE, ''));
await browser.close();
server.close();
