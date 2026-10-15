// Captures copy of dynamic states (modals, verification results, pending member) for content review.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'content-type': MIME['.html'] }); return res.end(fs.readFileSync(path.join(ROOT, '404.html'))); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const txt = (page, sel) => page.evaluate(s => [...document.querySelectorAll(s)].map(e => e.innerText.replace(/\n{2,}/g, '\n')).join('\n---\n'), sel);

const g = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
let page = await g.newPage();
await page.goto(BASE + '/agenda.html?id=seminar-keselamatan-perancah-2026', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
console.log('=== AGENDA MODAL ===\n' + await txt(page, '.modal'));
await page.goto(BASE + '/regulasi.html', { waitUntil: 'networkidle' });
await page.click('text=Ringkasan >> nth=0').catch(() => {});
await page.waitForTimeout(500);
console.log('=== REGULASI MODAL ===\n' + await txt(page, '.modal'));
for (const q of ['PPAPI-2026-000123', 'PPAPI-2023-000089', 'PPAPI-2026-999999', 'Siti', 'abc']) {
  await page.goto(BASE + '/verifikasi.html?kta=' + encodeURIComponent(q), { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  console.log(`=== VERIFIKASI ${q} ===\n` + await txt(page, '[data-vf-result], .vf-result, #vf-result'));
}
// pending fresh member
const U = { uid: 'demo-pending-01', name: 'Dewi Anggraini', email: 'dewi@contoh.id', phone: '', provider: 'password', photoURL: '', createdAt: '2026-10-08T01:00:00.000Z' };
const M = { uid: U.uid, name: U.name, email: U.email, phone: '', kta: 'PPAPI-2026-551203', memberType: 'Praktisi', status: 'Menunggu Verifikasi', joinedAt: '2026-10-08', profile: {}, competencies: [], certificates: [] };
const a = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
await a.addInitScript(({ u, m }) => { try { if (!localStorage.getItem('ppapi_demo_session')) { localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m)); } } catch (e) {} }, { u: U, m: M });
page = await a.newPage();
await page.goto(BASE + '/anggota.html#kartu', { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
console.log('=== ANGGOTA KARTU (pending) ===\n' + await txt(page, '#panel-kartu'));
await page.screenshot({ path: path.join(SHOTS, 'copy-anggota-kartu-pending.png') });
await page.goto(BASE + '/verifikasi.html?kta=' + M.kta, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
console.log('=== VERIFIKASI own pending ===\n' + await txt(page, '[data-vf-result], .vf-result, #vf-result'));
await page.screenshot({ path: path.join(SHOTS, 'copy-verifikasi-own-pending.png'), fullPage: true });
await page.goto(BASE + '/dashboard.html', { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
console.log('=== DASHBOARD pending (kpi) ===\n' + await txt(page, '.dash-kpis, [class*="kpi"]'));
await browser.close(); server.close();
