// AD v2 probe — measures layout facts behind the art-direction findings. Run from devtools/: node flows/ad-v2-probe.mjs
import { chromium } from 'playwright';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((q, r) => { let p = decodeURIComponent(new URL(q.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html'; const f = path.join(ROOT, p); if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { r.writeHead(404); return r.end(); } r.writeHead(200, { 'content-type': MIME[path.extname(f)] || 'application/octet-stream' }); (String(f).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? r.end(fs.readFileSync(f, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(f).pipe(r)); });
await new Promise(r => server.listen(0, '127.0.0.1', r)); const BASE = `http://127.0.0.1:${server.address().port}`;
const U = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const fresh = { uid: U.uid, name: U.name, email: U.email, phone: '', kta: '', memberType: 'Praktisi', status: 'Draf', joinedAt: '2026-03-14', validUntil: '', profile: {}, competencies: [], certificates: [], application: { type: 'baru', kategori: '', submittedAt: '', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: false, kebenaranData: false, privasi: false, namaTerang: '', tanggal: '' }, catatan: '' }, review: { note: '', history: [] } };
const b = await chromium.launch();
async function pg(vp, seed, url) {
  const ctx = await b.newContext({ viewport: vp, isMobile: vp.width < 500, hasTouch: vp.width < 500, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  await ctx.addInitScript(({ s, u, m }) => { if (sessionStorage.getItem('__p')) return; sessionStorage.setItem('__p', '1'); localStorage.setItem('ppapi_demo_ribbon_dismissed', 'true'); if (s === 'member') { localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); const us = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}'); us[u.email] = { ...u, hash: 'x' }; localStorage.setItem('ppapi_demo_users', JSON.stringify(us)); localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m)); } if (s === 'admin') { localStorage.setItem('ppapi_demo_session', JSON.stringify({ uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', provider: 'password' })); localStorage.setItem('ppapi_demo_admins', JSON.stringify(['demo-admin-0001'])); } }, { s: seed, u: U, m: fresh });
  const p = await ctx.newPage(); await p.goto(BASE + '/' + url, { waitUntil: 'networkidle' }); await p.waitForTimeout(1200); return { p, ctx };
}
const out = {};
const M = { width: 390, height: 844 }, D = { width: 1440, height: 900 };
{ const { p, ctx } = await pg(M, 'member', 'pendaftaran.html#data-diri');
  out.dafMobile = await p.evaluate(() => { const r = s => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null; }; return { firstField: r('.daf-main input:not([type=hidden]), .daf-main select'), stepTitle: r('.daf-main h2'), stepper: r('.stepper'), next: r('.daf-foot__next'), docH: document.documentElement.scrollHeight, footSticky: getComputedStyle(document.querySelector('.daf-foot') || document.body).position }; });
  await ctx.close(); }
{ const { p, ctx } = await pg(D, 'member', 'pendaftaran.html#kategori');
  out.dafDesktop = await p.evaluate(() => { const r = s => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null; }; const c = [...document.querySelectorAll('.daf-kat, [class*=daf-cat], .daf-main label.choice, .daf-main [role=radio], .daf-main input[type=radio]')].length; return { stepTitle: r('.daf-main h2'), next: r('.daf-foot__next'), radios: c, docH: document.documentElement.scrollHeight }; });
  await ctx.close(); }
{ const { p, ctx } = await pg(D, 'admin', 'admin.html#anggota');
  await p.waitForTimeout(800);
  out.admAnggota = await p.evaluate(() => { const w = document.querySelector('#sec-anggota .table-wrap'); const t = w && w.querySelector('table'); const ths = t ? [...t.querySelectorAll('th')].map(x => [x.textContent.trim(), Math.round(x.getBoundingClientRect().width)]) : []; return { wrapW: w && w.clientWidth, tableW: t && t.scrollWidth, ths }; });
  out.admRows = await p.evaluate(() => [...document.querySelectorAll('#aq-list tr, #aq-list .adm-row')].slice(0, 6).map(r => Math.round(r.getBoundingClientRect().height)));
  await p.evaluate(() => { location.hash = 'permohonan'; }); await p.waitForTimeout(900);
  out.admPerm = await p.evaluate(() => [...document.querySelectorAll('#pq-list tr, #pq-list .adm-row, #pq-list > *')].slice(0, 6).map(r => Math.round(r.getBoundingClientRect().height)));
  out.admRingkasanLayout = await p.evaluate(() => { const n = document.querySelector('.adm-nav'); const m = document.querySelector('.adm-main, .adm-content, main .container'); return { nav: n && Math.round(n.getBoundingClientRect().width), main: m && Math.round(m.getBoundingClientRect().width) }; });
  await ctx.close(); }
{ const { p, ctx } = await pg(D, 'out', 'pustaka.html');
  out.pustakaSections = await p.evaluate(() => [...document.querySelectorAll('main > section, main > div')].map(e => [e.id || e.className.slice(0, 30), Math.round(e.offsetHeight)]));
  out.pustakaCatalogue = await p.evaluate(() => { const s = document.getElementById('katalog'); return s ? { h: s.offsetHeight, shelves: s.querySelectorAll('[class*=shelf]').length, cards: s.querySelectorAll('.doc-card').length } : null; });
  await ctx.close(); }
fs.writeFileSync(path.resolve(__dirname, '..', 'shots', 'ad2', '_probe.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(out, null, 1));
await b.close(); server.close();
