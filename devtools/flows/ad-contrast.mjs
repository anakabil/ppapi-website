// Hero text-on-photo contrast estimate: hides hero text, samples the background under each text block,
// reports the worst-case (95th-percentile brightest) background and resulting contrast ratio.
// node flows/ad-contrast.mjs [--mobile] page...
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const args = process.argv.slice(2); const mobile = args.includes('--mobile'); const pages = args.filter(a => !a.startsWith('--'));
const MIME = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => { let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); (String(f).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(f, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(f).pipe(res)); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const BASE = `http://127.0.0.1:${server.address().port}`;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile, reducedMotion: 'reduce' });
const lum = c => { const f = v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }; return .2126 * f(c[0]) + .7152 * f(c[1]) + .0722 * f(c[2]); };
for (const pg of pages) {
  const page = await ctx.newPage(); await page.goto(`${BASE}/${pg}.html`, { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
  const blocks = await page.evaluate(() => { const hero = document.querySelector('main section'); return [...hero.querySelectorAll('.lead, p, .breadcrumb, .eyebrow, .page-hero__meta, [class*=__lead], [class*=__meta]')].filter(e => e.offsetParent && e.getBoundingClientRect().width > 0).slice(0, 8).map(e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return { cls: e.className.slice(0, 40), x: r.x, y: r.y + scrollY, w: r.width, h: r.height, color: cs.color }; }); });
  await page.addStyleTag({ content: 'main section *{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important} main section svg{opacity:0!important}' });
  for (const bl of blocks) {
    if (bl.h < 4) continue;
    const buf = await page.screenshot({ clip: { x: Math.max(0, bl.x), y: bl.y, width: Math.min(bl.w, (mobile ? 390 : 1440) - bl.x), height: bl.h } });
    const stats = await page.evaluate(async (d) => { const img = new Image(); img.src = 'data:image/png;base64,' + d; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const px = x.getImageData(0, 0, c.width, c.height).data; const L = []; for (let i = 0; i < px.length; i += 4) L.push([px[i], px[i + 1], px[i + 2]]); return L; }, buf.toString('base64'));
    const ls = stats.map(c => ({ c, l: lum(c) })).sort((a, b) => a.l - b.l);
    const p95 = ls[Math.floor(ls.length * .95)];
    const m = bl.color.match(/[\d.]+/g).map(Number); const a = m[3] ?? 1;
    const txt = [0, 1, 2].map(i => m[i] * a + p95.c[i] * (1 - a));
    const L1 = lum(txt), L2 = p95.l; const cr = (Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05);
    console.log(pg.padEnd(12), (mobile ? 'M' : 'D'), bl.cls.padEnd(40), 'bg95=', p95.c.join(','), 'CR=', cr.toFixed(2));
  }
  await page.close();
}
await b.close(); server.close();
