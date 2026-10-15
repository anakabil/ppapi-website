// PPAPI — focus-ring spot check (review only): keyboard-focus selected elements and save clipped screenshots.
//   node flows/focus-spot.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots', 'a11y-audit');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'content-type': MIME['.html'] }); return res.end(fs.readFileSync(path.join(ROOT, '404.html'))); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const U = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const cases = [
  { page: 'index.html', sel: '.site-nav__link[href="profil.html"]', name: 'nav-link' },
  { page: 'index.html', sel: '.home-hero__actions .btn--primary', name: 'hero-primary' },
  { page: 'index.html', sel: '.home-reg__intro .btn--primary', name: 'light-primary' },
  { page: 'agenda.html', sel: '#agenda-chips .chip', name: 'chip' },
  { page: 'umpan-balik.html', sel: '#ub-anon', name: 'check-anon' },
  { page: 'umpan-balik.html', sel: 'input[name="rating"]', name: 'rating' },
  { page: 'umpan-balik.html', sel: '.ub-seg input', name: 'segmented-radio' },
  { page: 'anggota.html', sel: '#f-birthDate', name: 'date-input', auth: true },
  { page: 'anggota.html', sel: '#f-city', name: 'text-input', auth: true },
];
const browser = await chromium.launch();
for (const c of cases) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  if (c.auth) await ctx.addInitScript(u => { try { localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); } catch (e) {} }, U);
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${c.page}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  // focus the element via keyboard: focus previous focusable programmatically, then press Tab
  const ok = await page.evaluate(sel => {
    const el = document.querySelector(sel); if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    const all = [...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && x.offsetParent !== null || x === el);
    const i = all.indexOf(el);
    const prev = all.slice(0, i).reverse().find(x => x.offsetParent !== null && !x.closest('[hidden]'));
    if (prev) prev.focus(); else document.body.focus();
    return true;
  }, c.sel);
  if (!ok) { console.log(c.name, 'not found'); await ctx.close(); continue; }
  for (let k = 0; k < 4; k++) {
    const isIt = await page.evaluate(sel => document.activeElement === document.querySelector(sel) || (document.querySelector(sel)?.name && document.activeElement?.name === document.querySelector(sel).name), c.sel);
    if (isIt) break;
    await page.keyboard.press('Tab');
  }
  await page.waitForTimeout(150);
  const info = await page.evaluate(sel => {
    const el = document.activeElement; const cs = getComputedStyle(el);
    const vis = el.closest('label')?.querySelector('.check__box, .segmented__option') || (el.id ? document.querySelector(`label[for="${el.id}"]`) : null) || el;
    const vcs = getComputedStyle(vis);
    return { active: el.tagName + '#' + el.id + '.' + el.className, focusVisible: el.matches(':focus-visible'), focus: el.matches(':focus'), outline: cs.outline, border: cs.borderColor, shadow: cs.boxShadow,
      visual: vis.className, visOutline: vcs.outline, visShadow: vcs.boxShadow, rect: (() => { const r = vis.getBoundingClientRect(); return [r.x, r.y, r.width, r.height]; })() };
  }, c.sel);
  const [x, y, w, h] = info.rect;
  await page.screenshot({ path: path.join(SHOTS, `focus-${c.name}.png`), clip: { x: Math.max(0, x - 24), y: Math.max(0, y - 24), width: Math.min(1440, w + 48), height: h + 48 } });
  // unfocused comparison
  await page.evaluate(() => document.activeElement.blur());
  await page.screenshot({ path: path.join(SHOTS, `focus-${c.name}-blur.png`), clip: { x: Math.max(0, x - 24), y: Math.max(0, y - 24), width: Math.min(1440, w + 48), height: h + 48 } });
  console.log(c.name, JSON.stringify(info));
  await ctx.close();
}
await browser.close(); server.close();
