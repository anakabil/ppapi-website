// Full-page screenshot helper that SCROLLS through the page first, so
// loading="lazy" images (and, with --motion, scroll reveals/counters) are
// actually loaded before capturing. check.mjs --full does not scroll, so
// images far below the fold appear as empty grey boxes there.
//
// Run from devtools/:
//   node flows/fullshot.mjs <page> [--auth] [--mobile|--desktop] [--motion] [--query=a=b] [--tag=x]
// Output: devtools/shots/<page>-<viewport>-scrolled[-tag].png
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedAuth } from './qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const pages = args.filter(a => !a.startsWith('--'));
if (!pages.length) { console.error('Usage: node flows/fullshot.mjs <page> [--auth] [--mobile|--desktop] [--motion]'); process.exit(1); }

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

// --auth: the same seeded session as check.mjs --auth — the shared fixture of qa-lib.mjs (ACTIVE member
// PPAPI-2026-004821 as an approval leaves it, plus its ppapi_registry entry)

const vps = [];
if (!flags.mobile) vps.push({ name: 'desktop', width: 1440, height: 900 });
if (!flags.desktop) vps.push({ name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const browser = await chromium.launch();
for (const vp of vps) {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1, reducedMotion: flags.motion ? 'no-preference' : 'reduce', locale: 'id-ID' });
  if (flags.auth) await seedAuth(ctx);
  for (const pg of pages) {
    const page = await ctx.newPage();
    await page.goto(`${BASE}/${pg}.html${flags.query ? '?' + flags.query : ''}`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => {
      const step = Math.round(innerHeight * 0.8);
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 140)); }
      scrollTo(0, 0);
    });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(flags.motion ? 2400 : 600);
    const out = path.join(SHOTS, `${pg}-${vp.name}-scrolled${flags.tag ? '-' + flags.tag : ''}.png`);
    await page.screenshot({ path: out, fullPage: true });
    console.log('saved', path.relative(process.cwd(), out));
    await page.close();
  }
  await ctx.close();
}
await browser.close();
server.close();
