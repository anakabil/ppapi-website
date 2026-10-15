// PPAPI v2 lens — CLS sweep (REVIEW ONLY; never writes to site/).
// Every page/state on first visit (empty storage → demo seed hashing runs before auth.ready) under
// three font conditions: fast (60 ms), slow (web fonts 1.2 s late), blocked. Motion allowed.
// Reports CLS + the shifted nodes. Usage (cwd devtools/): node flows/v2lens-cls.mjs [--only=regex] [--vp=desktop|mobile]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'shots', 'v2lens');
const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const DEMO_USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const DEMO_ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
function member(st) {
  const m = { uid: DEMO_USER.uid, name: DEMO_USER.name, email: DEMO_USER.email, phone: DEMO_USER.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31', approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001',
    profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Contoh Konstruksi', position: 'Scaffolding Supervisor', experienceYears: 9, education: 'D3 Teknik Sipil', bio: '' },
    competencies: [{ id: 'k1', code: 'SCF-SUP', name: 'Supervisor Perancah', level: 'Mahir', since: 2019, notes: '' }], certificates: [{ id: 'c2', title: 'Ahli K3 Umum', number: 'CONTOH/002/2021', issuer: 'Kemnaker RI', issuedAt: '2021-11-02', expiresAt: '2026-11-20', link: '' }], updatedAt: '2026-09-30T08:00:00.000Z',
    application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z', updatedAt: '2026-03-15T02:00:00.000Z', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Rahmat Hidayat', tanggal: '2026-03-15' }, catatan: '' }, review: { note: '', history: [] } };
  if (st === 'Draf') Object.assign(m, { status: 'Draf', kta: '', validUntil: '', approvedAt: '' }, { application: { ...m.application, submittedAt: '' } });
  if (st === 'Menunggu Verifikasi') Object.assign(m, { status: st, kta: '', validUntil: '', approvedAt: '' });
  if (st === 'Kedaluwarsa') m.validUntil = '2026-06-30';
  return m;
}
async function seed(ctx, state) {
  if (state === 'guest') return;
  if (state === 'admin') return ctx.addInitScript(({ a }) => { if (!localStorage.getItem('ppapi_demo_session')) { localStorage.setItem('ppapi_demo_session', JSON.stringify(a)); localStorage.setItem('ppapi_demo_admins', JSON.stringify([a.uid])); } }, { a: DEMO_ADMIN });
  const m = member(state === 'auth' ? 'Aktif' : state);
  return ctx.addInitScript(({ u, m }) => { if (!localStorage.getItem('ppapi_demo_session')) { localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); const us = {}; us[u.email] = { uid: u.uid, name: u.name, email: u.email, phone: u.phone, provider: u.provider, createdAt: u.createdAt, hash: 'x' }; localStorage.setItem('ppapi_demo_users', JSON.stringify(us)); localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m)); } }, { u: DEMO_USER, m });
}
const INIT = `window.__cls={v:0,e:[]};try{new PerformanceObserver(l=>{for(const e of l.getEntries()){if(e.hadRecentInput)continue;window.__cls.v+=e.value;window.__cls.e.push({t:Math.round(e.startTime),v:+e.value.toFixed(4),s:(e.sources||[]).slice(0,4).map(s=>{const n=s.node;if(!n||n.nodeType!==1)return '#text';let c=n.tagName.toLowerCase();if(n.id)c+='#'+n.id;const k=[...n.classList].slice(0,2).join('.');if(k)c+='.'+k;return c+' dy='+Math.round(s.currentRect.y-s.previousRect.y)+' dh='+Math.round(s.currentRect.height-s.previousRect.height);})})}}).observe({type:'layout-shift',buffered:true})}catch(e){}`;
const CASES = [
  ['index', 'guest'], ['agenda', 'guest'],
  ['agenda.html?id=pelatihan-inspeksi-tube-coupler-okt-2026', 'guest'], ['agenda.html?id=pelatihan-dasar-perancah-pelaksana-agu-2026', 'guest'],
  ['pustaka', 'guest'], ['pustaka', 'auth'], ['pustaka.html?id=cop-inspeksi-penandaan', 'auth'],
  ['keanggotaan', 'guest'], ['keanggotaan', 'Draf'], ['verifikasi', 'guest'], ['verifikasi.html?kta=PPAPI-2025-000318', 'guest'], ['verifikasi', 'auth'],
  ['masuk', 'guest'], ['dashboard', 'auth'], ['dashboard', 'Draf'], ['dashboard', 'Kedaluwarsa'], ['dashboard', 'admin'],
  ['anggota', 'auth'], ['pendaftaran', 'Draf'], ['pendaftaran', 'Menunggu Verifikasi'], ['pendaftaran', 'auth'], ['admin', 'admin'], ['admin.html#anggota', 'admin'],
  ['aplikasi/perencanaan/index', 'auth'], ['aplikasi/simulator/index', 'auth'],
];
const FONT_CACHE = new Map();
const { BASE, close } = await startServer();
const browser = await chromium.launch();
const VPS = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, dpr: 2 }].filter(v => !flags.vp || v.name === flags.vp);
const only = flags.only ? new RegExp(flags.only) : null;
const out = [];
for (const [pg, state] of CASES) {
  const url = /\.html/.test(pg) ? pg : pg + '.html';
  if (only && !only.test(url + ' ' + state)) continue;
  for (const vp of VPS) {
    const row = { url, state, vp: vp.name };
    for (const mode of (flags.modes || 'fast,reduce,slow').split(',')) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.dpr || 1, reducedMotion: mode === 'reduce' ? 'reduce' : 'no-preference', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
      await seed(ctx, state);
      await ctx.addInitScript(INIT);
      await ctx.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, async route => {
        if (mode === 'blocked') return route.abort();
        const u = route.request().url();
        let hit = FONT_CACHE.get(u);
        if (!hit) { try { const r = await fetch(u, { headers: { 'user-agent': route.request().headers()['user-agent'] } }); hit = { s: r.status, b: Buffer.from(await r.arrayBuffer()), t: r.headers.get('content-type') || '' }; FONT_CACHE.set(u, hit); } catch { return route.abort(); } }
        await new Promise(r => setTimeout(r, mode === 'slow' && /gstatic/.test(u) ? 1200 : 60));
        return route.fulfill({ status: hit.s, body: hit.b, headers: { 'content-type': hit.t, 'access-control-allow-origin': '*' } });
      });
      const page = await ctx.newPage();
      if (vp.name === 'mobile') { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
      await page.goto(`${BASE}/${url}`, { waitUntil: 'load', timeout: 45000 }).catch(() => {});
      await page.waitForTimeout(3500);
      const r = await page.evaluate(() => window.__cls).catch(() => ({ v: -1, e: [] }));
      row[mode] = +r.v.toFixed(4);
      if (r.v >= 0.02) row[mode + 'Src'] = r.e.filter(e => e.v >= 0.005).map(e => `t${e.t} ${e.v} ${e.s.join(' | ')}`);
      row.final = page.url().replace(BASE, '');
      await ctx.close();
    }
    out.push(row);
    console.log(`[${vp.name}] ${url} (${state}) → ${row.final}  fast ${row.fast}  reduce ${row.reduce}  slow ${row.slow}${row.blocked !== undefined ? '  blocked ' + row.blocked : ''}`);
    for (const m of ['fast', 'reduce', 'slow', 'blocked']) if (row[m + 'Src']) console.log(`    ${m}: ${row[m + 'Src'].join('\n          ')}`);
    fs.writeFileSync(path.join(OUT, 'cls-sweep.json'), JSON.stringify(out, null, 1));
  }
}
await browser.close();
await close();
