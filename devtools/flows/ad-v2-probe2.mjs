// AD v2 probe 2 — admin console density: y of the first data row per section at 1440×900 and 390×844.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); (String(f).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? r.end(fs.readFileSync(f, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(f).pipe(r)); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const BASE = `http://127.0.0.1:${server.address().port}`;
const b = await chromium.launch(); const res = {};
for (const vp of [{ width: 1440, height: 900 }, { width: 1280, height: 800 }, { width: 390, height: 844 }]) {
  const ctx = await b.newContext({ viewport: vp, isMobile: vp.width < 500, hasTouch: vp.width < 500, reducedMotion: 'reduce' });
  await ctx.addInitScript(() => { if (sessionStorage.getItem('__p')) return; sessionStorage.setItem('__p', '1'); localStorage.setItem('ppapi_demo_ribbon_dismissed', 'true'); localStorage.setItem('ppapi_demo_session', JSON.stringify({ uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', provider: 'password' })); localStorage.setItem('ppapi_demo_admins', JSON.stringify(['demo-admin-0001'])); });
  const p = await ctx.newPage(); await p.goto(BASE + '/admin.html#ringkasan', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
  const k = vp.width + 'x' + vp.height; res[k] = {};
  for (const s of ['ringkasan', 'permohonan', 'anggota', 'konten', 'umpan-balik', 'admin', 'log']) {
    await p.evaluate(x => { location.hash = x; }, s); await p.waitForTimeout(900);
    res[k][s] = await p.evaluate(x => {
      const sec = document.getElementById('sec-' + x); if (!sec) return null;
      const first = sec.querySelector('tbody tr, .kpi, .adm-card, li, .empty-state, .adm-row');
      const tw = sec.querySelector('.table-wrap');
      return { firstDataY: first ? Math.round(first.getBoundingClientRect().top + scrollY) : null, secTop: Math.round(sec.getBoundingClientRect().top + scrollY), tableOverflow: tw ? tw.scrollWidth - tw.clientWidth : null };
    }, s);
  }
  await ctx.close();
}
console.log(JSON.stringify(res, null, 1));
fs.writeFileSync(path.resolve(__dirname, '..', 'shots', 'ad2', '_probe2.json'), JSON.stringify(res, null, 1));
await b.close(); server.close();
