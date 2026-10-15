// Art-direction probe: open a page (scrolled through so lazy images load), then
//  - optionally zoom-capture a region at 2x:  --clip=x,y,w,h  (page coordinates, css px)
//  - optionally evaluate an expression and print JSON: --eval="..."
//  - optionally capture the viewport after scrolling to y: --at=y
// Run from devtools/: node flows/ad-probe.mjs <page> [--auth] [--mobile] [--motion] [--query=a=b] [--clip=..] [--eval=..] [--tag=x] [--at=y] [--wait=ms]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const OUT = path.resolve(__dirname, '..', 'shots', 'ad');
fs.mkdirSync(OUT, { recursive: true });
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const pg = args.find(a => !a.startsWith('--'));
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
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
const M = { uid: U.uid, name: U.name, email: U.email, phone: U.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14',
  profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Contoh Konstruksi', position: 'Scaffolding Supervisor', experienceYears: 9, education: 'D3 Teknik Sipil', bio: 'Supervisor perancah dengan pengalaman proyek kilang dan gedung bertingkat.' },
  competencies: [{ id: 'k1', code: 'SCF-SUP', name: 'Supervisor Perancah', level: 'Mahir', since: 2019, notes: '' }, { id: 'k2', code: 'SCF-INS', name: 'Inspektur Perancah', level: 'Menengah', since: 2022, notes: '' }],
  certificates: [{ id: 'c1', title: 'Teknisi Perancah', number: 'CONTOH/001/2024', issuer: 'Kemnaker RI', issuedAt: '2024-02-10', expiresAt: '2027-02-10', link: '' }, { id: 'c2', title: 'Ahli K3 Umum', number: 'CONTOH/002/2021', issuer: 'Kemnaker RI', issuedAt: '2021-11-02', expiresAt: '2026-11-20', link: '' }],
  updatedAt: '2026-09-30T08:00:00.000Z' };
const vp = flags.mobile ? { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { width: 1440, height: 900, deviceScaleFactor: 2 };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor, reducedMotion: flags.motion ? 'no-preference' : 'reduce', locale: 'id-ID' });
if (flags.auth) await ctx.addInitScript(({ u, m }) => { try { if (!localStorage.getItem('ppapi_demo_session')) { localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}'); users[u.email] = { ...u, hash: 'x' }; localStorage.setItem('ppapi_demo_users', JSON.stringify(users)); localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m)); } } catch (e) {} }, { u: U, m: M });
const page = await ctx.newPage();
await page.goto(`${BASE}/${pg}.html${flags.query ? '?' + flags.query : ''}`, { waitUntil: 'networkidle' });
if (!flags.noscroll) await page.evaluate(async () => { const step = Math.round(innerHeight * 0.8); for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } scrollTo(0, 0); });
await page.waitForTimeout(+(flags.wait || 500));
const tag = flags.tag || 'probe';
if (flags.eval) { const r = await page.evaluate(flags.eval); console.log(JSON.stringify(r, null, 1)); }
if (flags.clip) { const [x, y, w, h] = flags.clip.split(',').map(Number); await page.screenshot({ path: path.join(OUT, `${pg}-${tag}.png`), clip: { x, y, width: w, height: h }, fullPage: true }); console.log('saved', `${pg}-${tag}.png`); }
if (flags.at !== undefined) { await page.evaluate(y => scrollTo(0, +y), flags.at); await page.waitForTimeout(+(flags.wait || 900)); await page.screenshot({ path: path.join(OUT, `${pg}-${tag}.png`) }); console.log('saved', `${pg}-${tag}.png`); }
await browser.close(); server.close();
