// Audits that every rendered sample (contoh:true) item shows a "Contoh" badge near its title.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
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
const U = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const M = { uid: U.uid, name: U.name, email: U.email, phone: U.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', profile: {}, competencies: [], certificates: [] };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'id-ID' });
await ctx.addInitScript(({ u, m }) => { try { if (!localStorage.getItem('ppapi_demo_session')) { localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m)); } } catch (e) {} }, { u: U, m: M });
const targets = ['index.html', 'berita.html', 'berita.html?id=situs-resmi-dan-layanan-anggota-daring', 'berita.html?id=memahami-penandaan-perancah', 'agenda.html', 'agenda.html?tab=lalu', 'agenda.html?id=seminar-keselamatan-perancah-2026', 'dashboard.html', 'profil.html', 'keanggotaan.html', 'verifikasi.html?kta=PPAPI-2026-000123', 'verifikasi.html?kta=PPAPI-2023-000089', 'verifikasi.html?kta=PPAPI-2026', 'verifikasi.html?kta=Siti', 'umpan-balik.html', 'anggota.html#kompetensi'];
for (const t of targets) {
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${t}`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(800);
  const res = await page.evaluate(() => {
    const D = window.PPAPI_DATA || {};
    const items = [];
    (D.berita || []).forEach(b => b.contoh && items.push(['berita', b.judul]));
    (D.pengumuman || []).forEach(b => b.contoh && items.push(['pengumuman', b.judul]));
    (D.agenda || []).forEach(b => b.contoh && items.push(['agenda', b.judul]));
    (D.registry || []).forEach(b => b.contoh && items.push(['registry', b.nama]));
    const o = D.organisasi || {};
    (o.sejarah || []).forEach(b => b.contoh && items.push(['sejarah', b.judul]));
    (o.pengurus || []).forEach(b => b.contoh && items.push(['pengurus', b.jabatan]));
    ((o.keanggotaan || {}).kategori || []).forEach(b => b.contoh && items.push(['kategori', b.nama]));
    const out = [];
    const all = [...document.querySelectorAll('h1,h2,h3,h4,h5,p,a,span,strong,td,li,dt,dd,div,button')];
    for (const [kind, title] of items) {
      const hits = all.filter(el => el.children.length <= 3 && (el.textContent || '').trim() === title && el.offsetParent !== null);
      for (const el of hits) {
        // walk up to 5 levels looking for a badge
        let n = el, found = false, lvl = 0;
        while (n && lvl < 5) { if (n.querySelector && n.querySelector('.badge--contoh')) { found = true; break; } n = n.parentElement; lvl++; }
        if (!found) out.push(`${kind}: "${title}" <${el.tagName.toLowerCase()} class="${el.className}"> (no Contoh badge within 5 ancestors)`);
      }
    }
    return { badges: document.querySelectorAll('.badge--contoh').length, missing: [...new Set(out)] };
  });
  console.log(`\n${t}: ${res.badges} Contoh badges`);
  res.missing.forEach(m => console.log('  MISSING ' + m));
  await page.close();
}
await browser.close(); server.close();
