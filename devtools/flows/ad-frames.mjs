// Capture motion frames: node flows/ad-frames.mjs <page> <t1,t2,...ms> [--mobile] [--scrollTo=y] [--auth]
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site'); const OUT = path.resolve(__dirname, '..', 'shots', 'ad');
const args = process.argv.slice(2); const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const [pg, ts] = args.filter(a => !a.startsWith('--'));
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); (String(f).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(f, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(f).pipe(res)); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const BASE = `http://127.0.0.1:${server.address().port}`;
const b = await chromium.launch(); const mobile = !!flags.mobile;
const ctx = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, reducedMotion: 'no-preference' });
const page = await ctx.newPage(); await page.goto(`${BASE}/${pg}.html`, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle');
let t0 = Date.now();
if (flags.scrollTo) { await page.evaluate(y => window.scrollTo({ top: +y, behavior: 'instant' }), flags.scrollTo); t0 = Date.now(); }
for (const t of ts.split(',').map(Number)) { const wait = t - (Date.now() - t0); if (wait > 0) await page.waitForTimeout(wait); const f = `${pg}-${mobile ? 'm' : 'd'}-frame-${flags.scrollTo || 0}-${t}.png`; await page.screenshot({ path: path.join(OUT, f) }); console.log(f); }
await b.close(); server.close();
