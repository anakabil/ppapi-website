// Security lens part 2: anggota edit/delete modals + KTA card + feedback success panel with payloads.
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
const X = `<img src=x onerror="window.__xss=(window.__xss||0)+1">`;
const X2 = `"><svg onload="window.__xss=(window.__xss||0)+1"></svg>`;
const U = { uid: 'sec-xss-0003', name: 'Budi ' + X, email: 'budi@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const M = {
  uid: U.uid, name: 'Budi ' + X, email: 'budi@contoh.id', phone: '+6281234567890', kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14',
  profile: { city: X, province: X2, company: X2, position: X, bio: X2, address: X, birthPlace: X, education: X },
  competencies: [{ id: 'k1', code: 'SCF-SUP', name: 'Supervisor ' + X, level: 'Mahir', since: 2019, notes: X2 }],
  certificates: [{ id: 'c1', title: 'Teknisi ' + X, number: X2, issuer: X, issuedAt: '2024-02-10', expiresAt: '2026-11-20', link: 'javascript:window.__xss=1' }],
  updatedAt: '2026-09-30T08:00:00.000Z',
};
function seedFn({ u, m }) {
  try { if (!sessionStorage.getItem('__s')) { sessionStorage.setItem('__s', '1'); localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m)); } } catch (e) {}
}
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
await ctx.addInitScript(seedFn, { u: U, m: M });
const scan = (page) => page.evaluate(() => {
  const on = []; for (const el of document.querySelectorAll('*')) for (const a of el.attributes) if (/^on/i.test(a.name)) on.push(el.tagName + '[' + a.name + ']');
  return { xss: window.__xss || 0, on, modalText: (document.querySelector('.modal') || {}).innerText || '' };
});
let dialogs = 0;
const page = await ctx.newPage();
page.on('dialog', d => { dialogs++; d.dismiss(); });
page.on('pageerror', e => console.log('pageerror', e.message));
await page.goto(BASE + '/anggota.html#kompetensi', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
for (const act of ['edit-kompetensi', 'delete-kompetensi']) {
  await page.click(`[data-action="${act}"]`);
  await page.waitForTimeout(500);
  const s = await scan(page);
  console.log(act, JSON.stringify({ xss: s.xss, on: s.on, dialogs }), '\n   modal:', s.modalText.replace(/\s+/g, ' ').slice(0, 260));
  const vals = await page.evaluate(() => [...document.querySelectorAll('.modal input, .modal textarea, .modal select')].map(i => i.name + '=' + i.value).join(' | '));
  console.log('   values:', vals.slice(0, 300));
  await page.screenshot({ path: path.join(SHOTS, `sec2-${act}.png`) });
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
}
await page.goto(BASE + '/anggota.html#sertifikat', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
for (const act of ['edit-sertifikat', 'delete-sertifikat']) {
  await page.click(`[data-action="${act}"]`);
  await page.waitForTimeout(500);
  const s = await scan(page);
  console.log(act, JSON.stringify({ xss: s.xss, on: s.on, dialogs }), '\n   modal:', s.modalText.replace(/\s+/g, ' ').slice(0, 260));
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
}
const links = await page.evaluate(() => [...document.querySelectorAll('a')].map(a => a.getAttribute('href')).filter(h => /javascript/i.test(h || '')));
console.log('js links on sertifikat tab:', links);
await page.goto(BASE + '/anggota.html#profil', { waitUntil: 'networkidle' });
await page.waitForTimeout(600);
const pv = await page.evaluate(() => [...document.querySelectorAll('#panel-profil input, #panel-profil textarea')].slice(0, 20).map(i => i.name + '=' + i.value.slice(0, 50)).join(' | '));
console.log('profil values:', pv.slice(0, 600));
console.log('after anggota', JSON.stringify(await scan(page)).slice(0, 200), 'dialogs', dialogs);

/* feedback submit */
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
const p2 = await ctx2.newPage();
p2.on('dialog', d => { dialogs++; d.dismiss(); });
await p2.goto(BASE + '/umpan-balik.html', { waitUntil: 'networkidle' });
await p2.fill('#ub-nama', 'Nama ' + X);
await p2.fill('#ub-email', 'a@contoh.id');
await p2.fill('#ub-subjek', 'Subjek ' + X2);
await p2.fill('#ub-pesan', 'Pesan panjang untuk pengujian ' + X + X2);
await p2.click('form button[type="submit"]');
await p2.waitForTimeout(1500);
const fb = await p2.evaluate(() => localStorage.getItem('ppapi_feedback'));
const errs = await p2.evaluate(() => [...document.querySelectorAll('.field.is-invalid .field__error')].map(e => e.textContent));
console.log('feedback stored:', (fb || 'null').slice(0, 400));
console.log('field errors:', errs);
const s2 = await scan(p2);
console.log('feedback page', JSON.stringify({ xss: s2.xss, on: s2.on, dialogs }));
await p2.screenshot({ path: path.join(SHOTS, 'sec2-feedback-success.png') });
await browser.close(); server.close();
