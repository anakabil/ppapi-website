// Uji lanjutan (read-only) aplikasi legacy "PPAPI Scaffold": 404, persistensi, sesi palsu Supabase,
// tanggal default (zona WIB), akun lintas perangkat, render PDF (pdf.js) untuk cek visual.
// Usage (cwd = devtools): node flows/legacy-perencanaan-2.mjs <outJson> [pdfPath]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'legacy', 'asosiasi.ppapi-main');
const SHOTS = path.resolve(__dirname, '..', 'shots');
const OUT = process.argv[2];
const PDF = process.argv[3] || '';
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.pdf': 'application/pdf' };
const server = http.createServer((req, res) => {
  let u = decodeURIComponent(req.url.split('?')[0]);
  if (u === '/__report.pdf' && PDF) { res.writeHead(200, { 'content-type': 'application/pdf', 'access-control-allow-origin': '*' }); (String(PDF).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(PDF, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(PDF).pipe(res)); return; }
  if (u === '/__pdfview.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html><body style="margin:0;background:#888"><div id=w></div></body>'); return; }
  if (u.endsWith('/')) u += 'index.html';
  const f = path.join(ROOT, path.normalize(u));
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); res.end('nf'); return; }
  res.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' });
  (String(f).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(f, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(f).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const R = { notFound: [], dialogs: [] };
const save = () => fs.writeFileSync(OUT, JSON.stringify(R, null, 2));
const wire = (page, tag) => {
  page.on('response', r => { if (r.status() >= 400) R.notFound.push(`[${tag}] ${r.status()} ${r.url().slice(0, 160)}`); });
  page.on('dialog', async d => { R.dialogs.push(`[${tag}] ${d.type()}: ${d.message().slice(0, 160)}`); await d.accept().catch(() => {}); });
};
async function login(page, u = 'admin', p = 'admin123') { await page.fill('#lg-user', u); await page.fill('#lg-pass', p); await page.click('#login-screen button.btn-pri'); await page.waitForTimeout(400); }
async function goView(page, v) { await page.click('#menu-btn'); await page.click(`#menu-panel .tab[data-v="${v}"]`); await page.waitForTimeout(500); }

const browser = await chromium.launch();

// 1) 404 + persistensi input analisis setelah muat ulang + tanggal default 01:30 WIB
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, timezoneId: 'Asia/Jakarta' });
  await ctx.clock.install({ time: new Date('2026-10-09T01:30:00+07:00') });
  const page = await ctx.newPage(); wire(page, 'P');
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await login(page);
  R.defaultTanggalAt0130WIB = await page.evaluate(() => document.getElementById('f-tanggal').value);
  await goView(page, 'beban'); await page.fill('#ll-org', '5'); await page.fill('#ll-mat', '400');
  await goView(page, 'analisis'); await page.fill('#an-tiang', '10'); await page.fill('#an-nklem', '20');
  await goView(page, 'material'); await page.click('#v-material .btn-row .btn-pri'); await page.waitForTimeout(200);
  R.beforeReload = await page.evaluate(() => ({ llOrg: document.getElementById('ll-org').value, anTiang: document.getElementById('an-tiang').value, mats: matRows.length }));
  await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(600);
  R.afterReload = await page.evaluate(() => ({ llOrg: document.getElementById('ll-org').value, anTiang: document.getElementById('an-tiang').value, mats: matRows.length }));
  // 2) akun dibuat admin hanya ada di peramban ini
  await goView(page, 'admin');
  await page.fill('#nu-user', 'inspektor02'); await page.fill('#nu-pass', 'uji12345'); await page.fill('#nu-nama', 'Inspektor Dua'); await page.click('#nu-save');
  R.usersHere = await page.evaluate(() => Object.keys(getUsers()));
  R.pwHashSample = await page.evaluate(() => getUsers().admin.p);
  await ctx.close();
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p2 = await ctx2.newPage(); wire(p2, 'P2');
  await p2.goto(BASE + '/index.html', { waitUntil: 'load' });
  await login(p2, 'inspektor02', 'uji12345');
  R.otherDeviceLogin = await p2.evaluate(() => ({ err: document.getElementById('lg-err').textContent, locked: document.body.classList.contains('locked') }));
  await ctx2.close();
}

// 3) sesi Supabase palsu (token tak pernah divalidasi; peran dari localStorage)
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    if (!sessionStorage.getItem('__seeded')) {
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('ppapi_backend', JSON.stringify({ on: true, url: 'https://contoh-tidak-ada.supabase.co', key: 'anon' }));
      localStorage.setItem('ppapi_session', JSON.stringify({ m: 'sb', e: 'siapa.saja@contoh.id', r: 'admin', t: 'token-palsu' }));
    }
  });
  const page = await ctx.newPage(); wire(page, 'SB');
  await page.goto(BASE + '/index.html', { waitUntil: 'load' }); await page.waitForTimeout(500);
  R.forgedSupabase = await page.evaluate(() => ({ locked: document.body.classList.contains('locked'), user: CURRENT_USER, role: CURRENT_ROLE, adminTab: getComputedStyle(document.getElementById('tab-admin')).display, badge: document.getElementById('bk-badge').textContent }));
  await page.screenshot({ path: path.join(SHOTS, 'legacy-pr-d-14b-forged-supabase.png') });
  await ctx.close();
}

// 4) render PDF laporan dengan pdf.js untuk inspeksi visual
if (PDF) {
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1270 }, deviceScaleFactor: 1 });
  const page = await ctx.newPage(); wire(page, 'PDF');
  await page.goto(BASE + '/__pdfview.html');
  await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js' });
  R.pdfPages = await page.evaluate(async () => {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    const doc = await pdfjsLib.getDocument('/__report.pdf').promise;
    const w = document.getElementById('w'); const fonts = new Set();
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i); const vp = pg.getViewport({ scale: 1.5 });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; c.id = 'p' + i; c.style.display = 'block'; c.style.marginBottom = '8px';
      w.appendChild(c); await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      const tc = await pg.getTextContent(); tc.items.forEach(it => fonts.add(it.fontName));
    }
    return { n: doc.numPages, fonts: [...fonts] };
  });
  for (let i = 1; i <= Math.min(R.pdfPages.n, 5); i++) {
    await page.locator('#p' + i).screenshot({ path: path.join(SHOTS, `legacy-pr-d-15-pdf-p${i}.png`) });
  }
  await ctx.close();
}

await browser.close(); server.close(); save();
console.log(JSON.stringify(R, null, 1));
