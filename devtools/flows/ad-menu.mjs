// Mobile menu open + header solid-state captures (art-direction review)
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site'); const OUT = path.resolve(__dirname, '..', 'shots', 'ad');
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); (String(f).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(f, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(f).pipe(res)); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const BASE = `http://127.0.0.1:${server.address().port}`;
const b = await chromium.launch();
const m = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: 'no-preference' });
const p = await m.newPage(); await p.goto(`${BASE}/profil.html`, { waitUntil: 'networkidle' });
await p.click('.menu-toggle'); await p.waitForTimeout(1600); await p.screenshot({ path: path.join(OUT, 'menu-mobile-open.png') });
const d = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const q = await d.newPage(); await q.goto(`${BASE}/keanggotaan.html`, { waitUntil: 'networkidle' });
await q.mouse.wheel(0, 1300); await q.waitForTimeout(500); await q.mouse.wheel(0, -200); await q.waitForTimeout(800);
await q.screenshot({ path: path.join(OUT, 'header-solid-desktop.png'), clip: { x: 0, y: 0, width: 1440, height: 220 } });
console.log('ok'); await b.close(); server.close();
