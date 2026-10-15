// Dumps visible text (+ title/meta/aria-labels/alt) of every page for copy review. Output: devtools/shots/copy/<page>[-auth].txt
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const OUT = path.resolve(__dirname, '..', 'shots', 'copy');
fs.mkdirSync(OUT, { recursive: true });
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
const DEMO_USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const DEMO_MEMBER = {
  uid: DEMO_USER.uid, name: DEMO_USER.name, email: DEMO_USER.email, phone: DEMO_USER.phone,
  kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14',
  profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Contoh Konstruksi', position: 'Scaffolding Supervisor', experienceYears: 9, education: 'D3 Teknik Sipil', bio: 'Supervisor perancah.' },
  competencies: [{ id: 'k1', code: 'SCF-SUP', name: 'Supervisor Perancah', level: 'Mahir', since: 2019, notes: '' }],
  certificates: [{ id: 'c1', title: 'Teknisi Perancah', number: 'CONTOH/001/2024', issuer: 'Kemnaker RI', issuedAt: '2024-02-10', expiresAt: '2027-02-10', link: '' },
                 { id: 'c2', title: 'Ahli K3 Umum', number: 'CONTOH/002/2021', issuer: 'Kemnaker RI', issuedAt: '2021-11-02', expiresAt: '2026-11-20', link: '' }],
  updatedAt: '2026-09-30T08:00:00.000Z',
};
const pages = process.argv.slice(2).length ? process.argv.slice(2) : fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).map(f => f.replace('.html', ''));
const browser = await chromium.launch();
for (const auth of [false, true]) {
  const c = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'id-ID' });
  if (auth) await c.addInitScript(({ u, m }) => { try { if (!localStorage.getItem('ppapi_demo_session')) { localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m)); } } catch (e) {} }, { u: DEMO_USER, m: DEMO_MEMBER });
  for (const pg of pages) {
    if (!auth && (pg === 'dashboard' || pg === 'anggota')) continue;
    const page = await c.newPage();
    const url = pg.includes('?') || pg.includes('#') ? pg : pg + '.html';
    await page.goto(`${BASE}/${url}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(700);
    const txt = await page.evaluate(() => {
      // reveal hidden-tab panels text too
      const meta = ['title: ' + document.title, 'desc: ' + (document.querySelector('meta[name=description]') || {}).content, 'og:title: ' + (document.querySelector('meta[property="og:title"]') || {}).content, 'robots: ' + ((document.querySelector('meta[name=robots]') || {}).content || '')];
      const labels = [...document.querySelectorAll('[aria-label],img[alt],[title]')].map(e => `${e.tagName.toLowerCase()} aria="${e.getAttribute('aria-label') || ''}" alt="${e.getAttribute('alt') || ''}" title="${e.getAttribute('title') || ''}"`);
      const panels = [...document.querySelectorAll('[role=tabpanel][hidden], .tabs__panel[hidden]')].map(p => '\n### hidden panel ' + p.id + '\n' + p.textContent.replace(/\s+/g, ' ').trim());
      return meta.join('\n') + '\n\n' + document.body.innerText + '\n' + panels.join('\n') + '\n\n--- LABELS ---\n' + [...new Set(labels)].join('\n');
    });
    const name = (pg.replace(/[^a-z0-9-]/gi, '_')) + (auth ? '-auth' : '');
    fs.writeFileSync(path.join(OUT, name + '.txt'), txt);
    await page.close();
  }
  await c.close();
}
await browser.close(); server.close();
console.log('done', OUT);
