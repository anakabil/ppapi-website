// Screenshots of the v2 foundation components in styleguide.html (light + dark twin, desktop + mobile,
// drawer open, account menu per role). Run from devtools/:  node flows/styleguide-v2-shots.mjs
// Output: devtools/shots/sgv2-*.png  (READ them — visual review).
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { galleryFile, GALLERY } from './dev-gallery.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = galleryFile(p) || path.join(ROOT, p);
  if (!(file.startsWith(ROOT) || file.startsWith(GALLERY)) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const issues = [];
const VPS = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }];
const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
try {
  for (const vp of VPS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1, reducedMotion: 'reduce', locale: 'id-ID' });
    const page = await ctx.newPage();
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) issues.push(`${vp.name} console.${m.type()}: ${m.text()}`); });
    page.on('pageerror', e => issues.push(`${vp.name} pageerror: ${e.message}`));
    await page.goto(`${BASE}/styleguide.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.PPAPI && PPAPI.isReady());
    const light = page.locator('section[aria-label="Komponen keanggotaan dan konsol"]');
    const dark = page.locator('section[aria-label="Komponen keanggotaan dan konsol (konteks gelap)"]');
    await light.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await light.screenshot({ path: path.join(SHOTS, `sgv2-light-${vp.name}.png`) });
    await dark.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await dark.screenshot({ path: path.join(SHOTS, `sgv2-dark-${vp.name}.png`) });
    if (vp.name === 'mobile') {
      for (const [sel, name] of [['.stepper', 'stepper'], ['.status-track', 'track'], ['.grid--4:has(.kpi)', 'kpi'], ['.doc-card--feature', 'feature'], ['.locked-veil', 'veil']]) {
        const el = light.locator(sel).first();
        await el.scrollIntoViewIfNeeded();
        await el.screenshot({ path: path.join(SHOTS, `sgv2-m-${name}.png`) });
      }
    } else {
      const el = light.locator('.doc-card--feature');
      await el.scrollIntoViewIfNeeded();
      await el.screenshot({ path: path.join(SHOTS, `sgv2-d-feature.png`) });
    }
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    if (ov > 1) issues.push(`${vp.name}: horizontal overflow ${ov}px`);
    await light.locator('button[data-sg-drawer].btn').click();
    await page.waitForSelector('.drawer__panel');
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(SHOTS, `sgv2-drawer-${vp.name}.png`) });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    // account menu as admin
    await page.evaluate(a => { localStorage.setItem('ppapi_demo_session', JSON.stringify(a)); }, ADMIN);
    await page.goto(`${BASE}/styleguide.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.PPAPI && PPAPI.isReady());
    await page.click('.account__trigger');
    await page.waitForTimeout(200);
    await page.screenshot({ path: path.join(SHOTS, `sgv2-account-admin-${vp.name}.png`), clip: { x: 0, y: 0, width: vp.width, height: Math.min(vp.height, 560) } });
    await ctx.close();
  }
} finally {
  await browser.close();
  server.close();
}
console.log(issues.length ? issues.join('\n') : 'no console errors / overflow');
console.log('shots: devtools/shots/sgv2-*.png');
