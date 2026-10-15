// AD v2 probe 3 — pendaftaran data-diri error state: rail hint vs error summary vs invalid fields.
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); (String(f).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? r.end(fs.readFileSync(f, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(f).pipe(r)); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const BASE = `http://127.0.0.1:${server.address().port}`;
const U = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const M = { uid: U.uid, name: U.name, email: U.email, phone: '', kta: '', memberType: 'Praktisi', status: 'Draf', joinedAt: '2026-03-14', validUntil: '', profile: {}, competencies: [], certificates: [], application: { type: 'baru', kategori: '', submittedAt: '', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: false, kebenaranData: false, privasi: false, namaTerang: '', tanggal: '' }, catatan: '' }, review: { note: '', history: [] } };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
await ctx.addInitScript(({ u, m }) => { if (sessionStorage.getItem('__p')) return; sessionStorage.setItem('__p', '1'); localStorage.setItem('ppapi_demo_ribbon_dismissed', 'true'); localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); const us = {}; us[u.email] = { ...u, hash: 'x' }; localStorage.setItem('ppapi_demo_users', JSON.stringify(us)); localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m)); }, { u: U, m: M });
const p = await ctx.newPage(); await p.goto(BASE + '/pendaftaran.html#data-diri', { waitUntil: 'networkidle' }); await p.waitForTimeout(1200);
await p.click('.daf-foot__next'); await p.waitForTimeout(800);
const r = await p.evaluate(() => ({
  railHint: [...document.querySelectorAll('.stepper__item')].map(li => (li.className.match(/is-\w+/g) || []).join(',') + ' | ' + (li.querySelector('.stepper__hint') || {}).textContent),
  summary: [...document.querySelectorAll('.daf-main [role=alert] li, .daf-errors li, .daf-main .callout--err li, .daf-main .alert li')].map(x => x.textContent.trim()),
  invalid: [...document.querySelectorAll('.daf-main [aria-invalid=true]')].map(x => x.id + ':' + x.value),
  phone: (document.querySelector('.daf-main input[type=tel]') || {}).value,
}));
console.log(JSON.stringify(r, null, 1));
await b.close(); server.close();
