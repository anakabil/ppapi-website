// PPAPI — clipped screenshot helper (review only). node flows/clip-shot.mjs <page[?q][#h]> <x> <y> <w> <h> <out> [--mobile] [--auth] [--scrollTo=sel]
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { seedAuth } from './qa-lib.mjs';   // --auth: the shared active-member fixture (as check.mjs --auth, incl. its registry entry)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const a = process.argv.slice(2); const flags = Object.fromEntries(a.filter(x => x.startsWith('--')).map(x => { const [k, ...v] = x.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const [pg, x, y, w, h, out] = a.filter(x => !x.startsWith('--'));
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const file = path.join(ROOT, p); if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res)); });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const vp = flags.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 };
const ctx = await browser.newContext({ viewport: vp, isMobile: !!flags.mobile, hasTouch: !!flags.mobile, deviceScaleFactor: 2, reducedMotion: 'reduce' });
if (flags.auth) await seedAuth(ctx);
const page = await ctx.newPage();
const [pp, hash = ''] = pg.split('#'); const [p0, q = ''] = pp.split('?');
await page.goto(`${BASE}/${p0}.html${q ? '?' + q : ''}${hash ? '#' + hash : ''}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
if (flags.scrollTo) await page.evaluate(s => document.querySelector(s)?.scrollIntoView({ block: 'start' }), flags.scrollTo);
if (flags.click) { await page.click(flags.click); await page.waitForTimeout(500); }
await page.waitForTimeout(300);
await page.screenshot({ path: path.resolve(__dirname, '..', 'shots', 'a11y-audit', out), clip: { x: +x, y: +y, width: +w, height: +h } });
await browser.close(); server.close();
