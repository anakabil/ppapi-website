// PPAPI v2 — content / accessibility / performance / SEO lens (REVIEW ONLY: never writes to site/).
//
// Usage (cwd = devtools/):
//   node flows/v2lens-audit.mjs [--only=<regex on scenario id>] [--vp=desktop|mobile] [--force] [--noperf] [--noaxe]
//
// For each scenario (page × session state × optional sub-state) and viewport:
//   • axe-core 4.10.2 (cdnjs, cached in shots/axe-4.10.2.min.js) — WCAG 2.0/2.1/2.2 A+AA + best-practice,
//     whole document incl. the shared header, at scroll 0 and (main state) again after scrolling 700px
//   • copy dump (document.title + <main> innerText + open dialog text) → shots/v2lens/copy/<id>.txt (desktop)
//   • perf pass (main state only, separate fresh context, motion allowed; mobile = 4× CPU throttle):
//     first visit (empty storage → demo seed hashing) and repeat visit: CLS (+sources), LCP, FCP,
//     long tasks, transferred bytes (+ gzip estimate), request count
// Results: shots/v2lens/axe/<id>-<vp>.json, shots/v2lens/perf/<id>-<vp>.json (incremental; reruns skip done
// files unless --force), summary on stdout.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { startServer, ROOT } from './qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'shots', 'v2lens');
for (const d of ['axe', 'perf', 'copy', 'png']) fs.mkdirSync(path.join(OUT, d), { recursive: true });
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));

const AXE_CACHE = path.resolve(__dirname, '..', 'shots', 'axe-4.10.2.min.js');
let AXE_SRC = fs.existsSync(AXE_CACHE) ? fs.readFileSync(AXE_CACHE, 'utf8') : '';
if (!AXE_SRC.startsWith('/*! axe v4.10.2')) {
  const r = await fetch('https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js');
  AXE_SRC = await r.text();
  if (!AXE_SRC.startsWith('/*! axe v4.10.2')) throw new Error('unexpected axe payload');
  fs.writeFileSync(AXE_CACHE, AXE_SRC);
}

/* ---------------- seeded sessions (same as check.mjs) ---------------- */
const DEMO_USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
function demoMember(status) {
  const m = {
    uid: DEMO_USER.uid, name: DEMO_USER.name, email: DEMO_USER.email, phone: DEMO_USER.phone,
    kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31',
    approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001',
    profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Contoh Konstruksi', position: 'Scaffolding Supervisor', experienceYears: 9, education: 'D3 Teknik Sipil', bio: 'Supervisor perancah dengan pengalaman proyek kilang dan gedung bertingkat.' },
    competencies: [{ id: 'k1', code: 'SCF-SUP', name: 'Supervisor Perancah', level: 'Mahir', since: 2019, notes: '' }, { id: 'k2', code: 'SCF-INS', name: 'Inspektur Perancah', level: 'Menengah', since: 2022, notes: '' }],
    certificates: [{ id: 'c1', title: 'Teknisi Perancah', number: 'CONTOH/001/2024', issuer: 'Kemnaker RI', issuedAt: '2024-02-10', expiresAt: '2027-02-10', link: '' }, { id: 'c2', title: 'Ahli K3 Umum', number: 'CONTOH/002/2021', issuer: 'Kemnaker RI', issuedAt: '2021-11-02', expiresAt: '2026-11-20', link: '' }],
    updatedAt: '2026-09-30T08:00:00.000Z',
    application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z', updatedAt: '2026-03-15T02:00:00.000Z', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Rahmat Hidayat', tanggal: '2026-03-15' }, catatan: '' },
    review: { note: '', history: [] },
  };
  const st = status;
  if (!st || st === 'Aktif') return m;
  if (st === 'Kedaluwarsa') { m.validUntil = '2026-06-30'; return m; }
  if (st === 'Segera') { m.validUntil = '2026-11-20'; return m; } // ≤60 days → renewal CTA
  m.status = st;
  const clear = () => { m.kta = ''; m.validUntil = ''; m.approvedAt = ''; m.approvedBy = ''; };
  if (st === 'Draf') { clear(); m.application.submittedAt = ''; }
  if (st === 'Menunggu Verifikasi') clear();
  if (st === 'Perlu Perbaikan') { clear(); m.review = { note: 'Mohon lengkapi tautan sertifikat dan riwayat proyek.', history: [{ at: '2026-10-01T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'perbaikan', note: 'Mohon lengkapi tautan sertifikat dan riwayat proyek.' }] }; }
  if (st === 'Ditolak') { clear(); m.review = { note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.', history: [{ at: '2026-10-01T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'ditolak', note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.' }] }; }
  return m;
}
const DEMO_ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
const FEEDBACK = [
  { id: 'UB-20261005-AB12', kategori: 'Saran', pesan: 'Mohon tambahkan jadwal pelatihan inspektur perancah di wilayah Sumatra.', anonim: false, nama: 'Penguji Umpan Balik', email: 'penguji@contoh.id', phone: '', subjek: 'Jadwal pelatihan', halaman: 'agenda.html', rating: 4, uid: null, createdAt: '2026-10-05T03:00:00.000Z' },
  { id: 'UB-20261007-CD34', kategori: 'Pertanyaan', pesan: 'Bagaimana cara memperpanjang keanggotaan yang sudah kedaluwarsa?', anonim: true, nama: '', email: '', phone: '', subjek: '', halaman: 'keanggotaan.html', rating: null, uid: null, createdAt: '2026-10-07T03:00:00.000Z', status: 'Diproses', catatanAdmin: 'Dijawab lewat telepon.' },
];

async function seed(context, state) {
  if (state === 'guest') return;
  if (state === 'admin') {
    await context.addInitScript(({ a, fb }) => {
      try {
        if (!localStorage.getItem('ppapi_demo_session')) localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
        const admins = JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]');
        if (!admins.includes(a.uid)) { admins.push(a.uid); localStorage.setItem('ppapi_demo_admins', JSON.stringify(admins)); }
        if (!localStorage.getItem('ppapi_feedback')) localStorage.setItem('ppapi_feedback', JSON.stringify(fb));
      } catch (e) {}
    }, { a: DEMO_ADMIN, fb: FEEDBACK });
    return;
  }
  const m = demoMember(state === 'auth' ? 'Aktif' : state);
  await context.addInitScript(({ u, m }) => {
    try {
      if (!localStorage.getItem('ppapi_demo_session')) {
        localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
        const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
        users[u.email] = { uid: u.uid, name: u.name, email: u.email, phone: u.phone, provider: u.provider, createdAt: u.createdAt, hash: 'x' };
        localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
        localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
      }
    } catch (e) {}
  }, { u: DEMO_USER, m });
}

const OBSERVERS = `
window.__lens = { cls: 0, shifts: [], lcp: null, fcp: null, long: [] };
(function(){
  function sel(el){ if(!el||el.nodeType!==1) return null; var p=[],n=el; for(var i=0;n&&n.nodeType===1&&i<4;i++){ var s=n.tagName.toLowerCase(); if(n.id){p.unshift(s+'#'+n.id);break;} var c=[].slice.call(n.classList,0,2); if(c.length)s+='.'+c.join('.'); p.unshift(s); n=n.parentElement;} return p.join(' > '); }
  window.__lens.sel = sel;
  try { new PerformanceObserver(function(l){ l.getEntries().forEach(function(e){ if(e.hadRecentInput) return; window.__lens.cls+=e.value; window.__lens.shifts.push({ t: Math.round(e.startTime), v: +e.value.toFixed(4), src: (e.sources||[]).map(function(s){ return { n: sel(s.node), p: s.previousRect?[s.previousRect.x,s.previousRect.y,s.previousRect.width,s.previousRect.height].map(Math.round):null, c: s.currentRect?[s.currentRect.x,s.currentRect.y,s.currentRect.width,s.currentRect.height].map(Math.round):null }; }) }); }); }).observe({ type: 'layout-shift', buffered: true }); } catch(e){}
  try { new PerformanceObserver(function(l){ var es=l.getEntries(), e=es[es.length-1]; if(e) window.__lens.lcp={ t: Math.round(e.startTime), el: sel(e.element), size: e.size, url: e.url||'' }; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch(e){}
  try { new PerformanceObserver(function(l){ l.getEntries().forEach(function(e){ if(e.name==='first-contentful-paint') window.__lens.fcp=Math.round(e.startTime); }); }).observe({ type: 'paint', buffered: true }); } catch(e){}
  try { new PerformanceObserver(function(l){ l.getEntries().forEach(function(e){ window.__lens.long.push({ t: Math.round(e.startTime), d: Math.round(e.duration) }); }); }).observe({ type: 'longtask', buffered: true }); } catch(e){}
})();`;

/* ---------------- Google Fonts: fetched once, then served from memory (deterministic timing; the
   real CDN answers in ~50-150 ms, this sandbox's network sometimes stalls for 20 s) ---------------- */
const FONT_CACHE = new Map();
async function routeFonts(ctx, latency = 60) {
  await ctx.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, async route => {
    const url = route.request().url();
    let hit = FONT_CACHE.get(url);
    if (!hit) {
      try {
        const r = await fetch(url, { headers: { 'user-agent': route.request().headers()['user-agent'] || 'Mozilla/5.0 Chrome/130' } });
        hit = { status: r.status, body: Buffer.from(await r.arrayBuffer()), type: r.headers.get('content-type') || '' };
        FONT_CACHE.set(url, hit);
      } catch (e) { return route.abort(); }
    }
    await new Promise(r => setTimeout(r, latency));
    return route.fulfill({ status: hit.status, body: hit.body, headers: { 'content-type': hit.type, 'access-control-allow-origin': '*', 'cache-control': 'max-age=31536000' } });
  });
}

/* ---------------- helpers ---------------- */
async function settle(page, extra = 600) {
  await page.waitForFunction(() => (window.PPAPI && PPAPI.isReady && PPAPI.isReady()) || !document.documentElement.classList.contains('app-gate-pending') && !window.PPAPI, null, { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => !document.querySelector('main [aria-busy="true"]') && !document.documentElement.classList.contains('app-gate-pending'), null, { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(extra);
}
async function axeRun(page, onlyRules) {
  if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ content: AXE_SRC });
  return page.evaluate(async (only) => {
    const opts = only ? { runOnly: { type: 'rule', values: only } } : { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } };
    opts.resultTypes = ['violations'];
    const r = await window.axe.run(document, opts);
    return r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, count: v.nodes.length,
      nodes: v.nodes.slice(0, 8).map(n => ({ target: n.target.join(' '), html: n.html.slice(0, 200), summary: (n.failureSummary || '').slice(0, 260) })) }));
  }, onlyRules || null);
}
async function copyDump(page) {
  return page.evaluate(() => {
    const t = el => el ? el.innerText.replace(/\n{3,}/g, '\n\n').trim() : '';
    const dlg = [...document.querySelectorAll('.modal__dialog, .drawer__panel, [role="dialog"]')].filter(d => d.offsetParent || d.getClientRects().length).map(t).join('\n---DIALOG---\n');
    const toasts = [...document.querySelectorAll('.toast')].map(t).join(' | ');
    return `TITLE: ${document.title}\nURL: ${location.pathname}${location.search}${location.hash}\nDESC: ${document.querySelector('meta[name=description]')?.content || ''}\nROBOTS: ${document.querySelector('meta[name=robots]')?.content || ''}\nTOASTS: ${toasts}\n\n=== MAIN\n${t(document.querySelector('main') || document.body)}${dlg ? '\n\n=== DIALOG\n' + dlg : ''}`;
  });
}
function gz(url, BASE) {
  try {
    const u = new URL(url); if (!url.startsWith(BASE.replace(/\/$/, ''))) return null;
    let p = decodeURIComponent(u.pathname); if (p.endsWith('/')) p += 'index.html';
    const f = path.join(ROOT, p); if (!fs.existsSync(f)) return null;
    if (!/\.(html|css|js|svg|txt|json)$/i.test(f)) return fs.statSync(f).size;
    return zlib.gzipSync(fs.readFileSync(f), { level: 9 }).length;
  } catch { return null; }
}

/* ---------------- scenarios ---------------- */
const STATUSES = ['Draf', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Ditolak', 'Nonaktif', 'Kedaluwarsa'];
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const click = (sel) => async page => { await page.click(sel); await page.waitForTimeout(500); };
const SC = [];
const add = (id, url, state, subs = [], opts = {}) => SC.push({ id, url, state, subs, ...opts });

add('index-guest', 'index.html', 'guest');
add('index-auth', 'index.html', 'auth');
add('index-draf', 'index.html', 'Draf');
add('index-admin', 'index.html', 'admin');
add('berita-guest', 'berita.html', 'guest');
add('berita-detail', 'berita.html?id=situs-resmi-dan-layanan-anggota-daring', 'guest');
add('agenda-guest', 'agenda.html', 'guest');
add('agenda-detail', 'agenda.html?id=pelatihan-dasar-perancah-pelaksana-agu-2026', 'guest');
add('pustaka-guest', 'pustaka.html', 'guest', [
  { name: 'modal-locked', run: click('[data-pk-open="d:cop-inspeksi-penandaan"]') },
]);
add('pustaka-auth', 'pustaka.html', 'auth', [
  { name: 'modal-open', run: click('[data-pk-open="d:cop-inspeksi-penandaan"]') },
  { name: 'list-view', run: async page => { await page.keyboard.press('Escape'); await page.waitForTimeout(400); const b = await page.$('[data-pk-view="daftar"], [data-view="daftar"], button:has-text("Daftar")'); if (b) await b.click(); await page.waitForTimeout(500); } },
]);
add('pustaka-draf', 'pustaka.html', 'Draf');
add('pustaka-admin', 'pustaka.html', 'admin');
add('regulasi-guest', 'regulasi.html', 'guest');
add('regulasi-auth', 'regulasi.html', 'auth');
add('keanggotaan-guest', 'keanggotaan.html', 'guest');
add('keanggotaan-draf', 'keanggotaan.html', 'Draf');
add('keanggotaan-auth', 'keanggotaan.html', 'auth');
add('keanggotaan-admin', 'keanggotaan.html', 'admin');
add('verifikasi-guest', 'verifikasi.html', 'guest');
add('verifikasi-kta', 'verifikasi.html?kta=PPAPI-2025-000318', 'guest');
add('verifikasi-none', 'verifikasi.html?kta=PPAPI-2026-999999', 'guest');
add('verifikasi-auth', 'verifikasi.html', 'auth');
add('masuk-guest', 'masuk.html', 'guest');
add('masuk-daftar', 'masuk.html?next=pendaftaran.html#daftar', 'guest');
add('dashboard-auth', 'dashboard.html', 'auth');
add('dashboard-segera', 'dashboard.html', 'Segera');
add('dashboard-admin', 'dashboard.html', 'admin');
for (const st of STATUSES) add('dashboard-' + slug(st), 'dashboard.html', st);
add('anggota-auth', 'anggota.html', 'auth', [
  { name: 'tab-kta', run: async page => { const t = await page.$('[role="tab"]:has-text("Kartu"), [role="tab"]:has-text("KTA")'); if (t) await t.click(); await page.waitForTimeout(500); } },
  { name: 'tab-aplikasi', run: async page => { const t = await page.$('[role="tab"]:has-text("Aplikasi")'); if (t) await t.click(); await page.waitForTimeout(500); } },
]);
add('anggota-admin', 'anggota.html', 'admin');
add('pendaftaran-draf', 'pendaftaran.html', 'Draf', [
  { name: 'step-errors', run: async page => { await page.click('[data-step="1"]').catch(() => {}); await page.waitForTimeout(300); await page.fill('#f-city', '').catch(() => {}); await page.fill('#f-birthPlace', '').catch(() => {}); await page.click('.daf-foot__next').catch(() => {}); await page.waitForTimeout(500); } },
]);
for (const [h, n] of [['data-diri', 2], ['profesional', 3], ['kompetensi', 4], ['dokumen', 5], ['pernyataan', 6], ['tinjau', 7]]) add('pendaftaran-draf-' + n + '-' + h, 'pendaftaran.html#' + h, 'Draf');
for (const st of ['Menunggu Verifikasi', 'Perlu Perbaikan', 'Ditolak', 'Nonaktif', 'Kedaluwarsa']) add('pendaftaran-' + slug(st), 'pendaftaran.html', st);
add('pendaftaran-aktif', 'pendaftaran.html', 'auth');
add('pendaftaran-segera', 'pendaftaran.html', 'Segera');
add('pendaftaran-admin', 'pendaftaran.html', 'admin');
add('admin-ringkasan', 'admin.html', 'admin');
add('admin-permohonan', 'admin.html#permohonan', 'admin', [
  { name: 'drawer', run: async page => { await page.click('#pq-list [data-open="member"][data-id="demo-contoh-0001"].adm-act'); await page.waitForSelector('.drawer__panel'); await page.waitForTimeout(500); } },
  { name: 'dialog-approve', run: async page => { await page.click('#act-approve'); await page.waitForSelector('.modal__dialog'); await page.waitForTimeout(400); } },
  { name: 'dialog-revise-error', run: async page => { await page.keyboard.press('Escape'); await page.waitForTimeout(300); await page.click('#act-revise'); await page.waitForSelector('.modal__dialog'); await page.click('#dlg-revise-ok'); await page.waitForTimeout(400); } },
]);
add('admin-anggota', 'admin.html#anggota', 'admin', [
  { name: 'drawer', run: async page => { await page.click('#aq-list .adm-act[data-id="demo-contoh-0003"]'); await page.waitForSelector('.drawer__panel'); await page.waitForTimeout(500); } },
]);
add('admin-konten', 'admin.html#konten', 'admin', [
  { name: 'pustaka-tab', run: async page => { await page.evaluate(() => { location.hash = '#konten/pustaka'; }); await page.waitForTimeout(700); } },
  { name: 'edit-modal', run: async page => { const b = await page.$('#sec-konten [data-act="edit"], #sec-konten button:has-text("Ubah")'); if (b) { await b.click(); await page.waitForSelector('.modal__dialog, .drawer__panel').catch(() => {}); } await page.waitForTimeout(500); } },
]);
add('admin-umpan-balik', 'admin.html#umpan-balik', 'admin');
add('admin-admin', 'admin.html#admin', 'admin');
add('admin-log', 'admin.html#log', 'admin');
add('app-perencanaan', 'aplikasi/perencanaan/index.html', 'auth', [], { app: true });
add('app-simulator', 'aplikasi/simulator/index.html', 'auth', [], { app: true });
add('kebijakan-privasi', 'kebijakan-privasi.html', 'guest');

/* ---------------- run ---------------- */
const { BASE, close } = await startServer();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const VPS = [
  { name: 'desktop', width: 1440, height: 900, dpr: 1 },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, dpr: 2 },
].filter(v => !flags.vp || v.name === flags.vp);
const only = flags.only ? new RegExp(flags.only) : null;
const summary = [];

for (const sc of SC) {
  if (only && !only.test(sc.id)) continue;
  for (const vp of VPS) {
    const axeFile = path.join(OUT, 'axe', `${sc.id}-${vp.name}.json`);
    const perfFile = path.join(OUT, 'perf', `${sc.id}-${vp.name}.json`);
    /* ---------- axe + copy pass ---------- */
    const T0 = Date.now();
    if (!flags.noaxe && (flags.force || !fs.existsSync(axeFile))) {
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.dpr, reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
      await seed(ctx, sc.state);
      await routeFonts(ctx, 0);
      const page = await ctx.newPage();
      const errs = [];
      page.on('pageerror', e => errs.push('pageerror: ' + e.message));
      page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text().slice(0, 200)); });
      page.on('dialog', d => d.dismiss());
      await page.goto(`${BASE}/${sc.url}`, { waitUntil: 'networkidle', timeout: 30000 }).catch(e => errs.push('goto ' + e.message.split('\n')[0]));
      await settle(page);
      const res = { id: sc.id, vp: vp.name, url: sc.url, state: sc.state, finalUrl: page.url().replace(BASE, ''), errors: errs, runs: [] };
      res.runs.push({ name: 'main', violations: await axeRun(page).catch(e => [{ id: 'AXE-ERROR', impact: 'critical', help: e.message, count: 0, nodes: [] }]) });
      if (vp.name === 'desktop') fs.writeFileSync(path.join(OUT, 'copy', `${sc.id}.txt`), await copyDump(page));
      await page.screenshot({ path: path.join(OUT, 'png', `${sc.id}-${vp.name}.png`) }).catch(() => {});
      if (!sc.app) {
        // header after scrolling (it hides/condenses on scroll)
        await page.evaluate(() => window.scrollTo(0, 700)); await page.waitForTimeout(500);
        res.runs.push({ name: 'scrolled-700', violations: await axeRun(page, ['target-size', 'color-contrast', 'region', 'aria-hidden-focus']).catch(() => []) });
        await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(300);
      }
      for (const sub of sc.subs) {
        try {
          await sub.run(page);
          res.runs.push({ name: sub.name, violations: await axeRun(page) });
          if (vp.name === 'desktop') fs.writeFileSync(path.join(OUT, 'copy', `${sc.id}--${sub.name}.txt`), await copyDump(page));
          await page.screenshot({ path: path.join(OUT, 'png', `${sc.id}--${sub.name}-${vp.name}.png`) }).catch(() => {});
        } catch (e) { res.runs.push({ name: sub.name, error: e.message.split('\n')[0] }); }
      }
      res.ms = Date.now() - T0;
      fs.writeFileSync(axeFile, JSON.stringify(res, null, 1));
      await ctx.close();
      console.log(`   (axe pass ${sc.id}/${vp.name} ${res.ms} ms)`);
    }
    /* ---------- perf pass ---------- */
    if (!flags.noperf) {
      if (!(flags.force || !fs.existsSync(perfFile))) continue;
      if (/#/.test(sc.url) && /^admin/.test(sc.id) && sc.id !== 'admin-anggota') continue; // admin sections: one is enough
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.dpr, reducedMotion: 'no-preference', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
      await seed(ctx, sc.state);
      await routeFonts(ctx);
      await ctx.addInitScript(OBSERVERS);
      const out = { id: sc.id, vp: vp.name, url: sc.url, state: sc.state, visits: [] };
      const page = await ctx.newPage();
      if (vp.name === 'mobile') { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
      for (const visit of ['first', 'repeat']) {
        const reqs = [];
        const onReq = async r => { const rec = { url: r.url(), type: r.resourceType(), size: 0 }; reqs.push(rec); try { const s = await r.sizes(); rec.size = s.responseBodySize + s.responseHeadersSize; } catch {} };
        page.on('requestfinished', onReq);
        const t0 = Date.now();
        await page.goto(`${BASE}/${sc.url}`, { waitUntil: 'load', timeout: 45000 }).catch(() => {});
        const tLoad = Date.now() - t0;
        await page.waitForTimeout(3500);
        const m = await page.evaluate(() => ({ cls: +window.__lens.cls.toFixed(4), shifts: window.__lens.shifts, lcp: window.__lens.lcp, fcp: window.__lens.fcp, long: window.__lens.long,
          dcl: Math.round(performance.getEntriesByType('navigation')[0]?.domContentLoadedEventEnd || 0), docH: document.documentElement.scrollHeight })).catch(e => ({ error: e.message }));
        page.off('requestfinished', onReq);
        await page.waitForTimeout(200);
        let bytes = 0, gzBytes = 0; const byType = {};
        for (const r of reqs) { bytes += r.size; const g = gz(r.url, BASE); gzBytes += g != null ? g : r.size; byType[r.type] = (byType[r.type] || 0) + (g != null ? g : r.size); }
        out.visits.push({ visit, ms: Date.now() - t0, tLoad, ...m, reqs: reqs.length, bytes, gzBytes, byType, external: reqs.filter(r => !r.url.startsWith(BASE.replace(/\/$/, ''))).map(r => r.url.slice(0, 120) + ' ' + r.size) });
      }
      fs.writeFileSync(perfFile, JSON.stringify(out, null, 1));
      await ctx.close();
    }
  }
  // console summary per scenario
  for (const vp of VPS) {
    const f = path.join(OUT, 'axe', `${sc.id}-${vp.name}.json`);
    const p = path.join(OUT, 'perf', `${sc.id}-${vp.name}.json`);
    const a = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
    const pf = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
    const axeLine = a ? a.runs.map(r => `${r.name}:${r.error ? 'ERR ' + r.error : (r.violations.filter(v => ['serious', 'critical'].includes(v.impact)).map(v => v.id + '×' + v.count).join(',') || '0')}${r.violations && r.violations.some(v => !['serious', 'critical'].includes(v.impact)) ? ' (+' + r.violations.filter(v => !['serious', 'critical'].includes(v.impact)).map(v => v.id + '/' + v.impact).join(',') + ')' : ''}`).join(' | ') : '-';
    const perfLine = pf ? pf.visits.map(v => `${v.visit}: CLS ${v.cls} LCP ${v.lcp ? v.lcp.t : '-'} long ${v.long ? v.long.length + '/' + v.long.reduce((s, x) => s + x.d, 0) + 'ms' : '-'} ${(v.gzBytes / 1024).toFixed(0)}KBgz/${v.reqs}req`).join(' ; ') : '-';
    console.log(`[${vp.name}] ${sc.id} -> ${a ? a.finalUrl : ''}${a && a.errors.length ? '  ERR ' + a.errors.join(' / ').slice(0, 200) : ''}\n   axe ${axeLine}\n   perf ${perfLine}`);
  }
}
await browser.close();
await close();
console.log('\nDone.');
