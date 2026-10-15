// Element screenshots for the Beranda / Berita / Agenda pages in a given session state.
// Run from devtools/:
//   node flows/beranda-shots.mjs <page[?query]> <selector> [<selector> …] [--mobile] [--auth [--status=X]] [--admin] [--tag=x] [--managed] [--width=1024]
//   --managed  seeds admin-managed demo content (ppapi_content_*) like flows/beranda-flow.mjs does
// Output: devtools/shots/bx-<page>-<n>-<vp>[-tag].png (one per selector; the element is scrolled into view first)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const [pg, ...sels] = args.filter(a => !a.startsWith('--'));

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
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

const U = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const M = { uid: U.uid, name: U.name, email: U.email, phone: U.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31',
  application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z' }, profile: {}, competencies: [], certificates: [] };
if (flags.status) {
  const st = String(flags.status);
  if (st === 'Kedaluwarsa') M.validUntil = '2026-06-30';
  else { M.status = st; if (st !== 'Aktif') { M.kta = ''; M.validUntil = ''; } if (st === 'Draf') M.application.submittedAt = ''; }
}
const A = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };

const mobile = !!flags.mobile;
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: Number(flags.width) || 1440, height: 900 }, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
await ctx.clock.setFixedTime(new Date('2026-10-09T10:00:00+07:00'));
if (flags.auth) await ctx.addInitScript(({ u, m }) => { try { if (!sessionStorage.getItem('__s')) { sessionStorage.setItem('__s', '1'); localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m)); } } catch (e) {} }, { u: U, m: M });
if (flags.admin) await ctx.addInitScript(({ a }) => { try { if (!sessionStorage.getItem('__s')) { sessionStorage.setItem('__s', '1'); localStorage.setItem('ppapi_demo_session', JSON.stringify(a)); localStorage.setItem('ppapi_demo_admins', JSON.stringify([a.uid])); } } catch (e) {} }, { a: A });
if (flags.managed) await ctx.addInitScript(() => { try {
  if (sessionStorage.getItem('__m')) return; sessionStorage.setItem('__m', '1');
  localStorage.setItem('ppapi_content_berita', JSON.stringify([{ id: 'kabar-kelolaan-admin', judul: 'Kabar Kelolaan Admin: Rapat Koordinasi Sekretariat', kategori: 'Organisasi', tanggal: '2026-10-09', ringkasan: 'Ringkasan berita yang ditambahkan admin melalui Konsol Admin.', isi: ['Paragraf pertama.'], gambar: '', penulis: 'Sekretariat PPAPI', sorot: false, contoh: false, updatedAt: '2026-10-09T03:00:00.000Z', updatedBy: 'demo-admin-0001' }]));
} catch (e) {} });

const page = await ctx.newPage();
await page.goto(`${BASE}/${pg.includes('.html') ? pg : pg + '.html'}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(500);
let n = 0;
for (const sel of sels) {
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const out = path.join(SHOTS, `bx-${pg.replace(/[^a-z0-9-]/gi, '_')}-${n++}-${mobile ? 'mobile' : 'desktop'}${flags.tag ? '-' + flags.tag : ''}.png`);
  await el.screenshot({ path: out });
  console.log('saved', path.relative(process.cwd(), out));
}
await browser.close();
server.close();
