// Shared helpers for the aplikasi/* flows (owned by the "aplikasi" task).
// Static server for ../site, demo-session seeding (same objects as check.mjs), browser launch with
// SwiftShader WebGL (no "GPU stall" console noise), and a tiny assertion recorder.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { registryEntryFor } from './qa-lib.mjs';   // the public registry entry an approval writes (store.js registryEntry)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..', 'site');
export const SHOTS = path.resolve(__dirname, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};
export async function startServer() {
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      const nf = path.join(ROOT, '404.html');
      res.writeHead(404, { 'content-type': MIME['.html'] });
      return res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found');
    }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  return { server, BASE: `http://127.0.0.1:${server.address().port}` };
}

export const DEMO_USER = {
  uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890',
  provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z',
};
export const DEMO_USER_B = {
  uid: 'demo-uji-0002', name: 'Wulan Prasetyo', email: 'wulan.uji@contoh.id', phone: '+6281298765432',
  provider: 'password', photoURL: '', createdAt: '2026-04-02T09:00:00.000Z',
};
export const DEMO_ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
export function demoMember(user, status = 'Aktif') {
  const m = {
    uid: user.uid, name: user.name, email: user.email, phone: user.phone,
    kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31',
    approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001',
    profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Contoh Konstruksi', position: 'Scaffolding Supervisor', experienceYears: 9, education: 'D3 Teknik Sipil', bio: '' },
    competencies: [], certificates: [], updatedAt: '2026-09-30T08:00:00.000Z',
    application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z', updatedAt: '2026-03-15T02:00:00.000Z', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: user.name, tanggal: '2026-03-15' }, catatan: '' },
    review: { note: '', history: [] },
  };
  if (user.uid !== DEMO_USER.uid) m.kta = 'PPAPI-2026-004822';
  if (status === 'Kedaluwarsa') m.validUntil = '2026-06-30';
  else if (status === 'Nonaktif') m.status = 'Nonaktif';   // deactivated after approval: KTA, validity, approvedAt stay (store.js deactivate())
  else if (status !== 'Aktif') {
    m.status = status; m.kta = ''; m.validUntil = ''; m.approvedAt = ''; m.approvedBy = '';
    if (status === 'Draf') m.application.submittedAt = '';
  }
  return m;
}
/** seed localStorage once per context (only when no session yet), like check.mjs --auth / --admin: session, demo
 *  user, member record and — for an approved member (Aktif, Kedaluwarsa, Nonaktif) — its ppapi_registry entry */
export async function seedSession(context, { user = DEMO_USER, status = 'Aktif', admin = false } = {}) {
  if (admin) {
    await context.addInitScript(({ a }) => {
      try {
        if (!localStorage.getItem('ppapi_demo_session')) localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
        const admins = JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]');
        if (!admins.includes(a.uid)) { admins.push(a.uid); localStorage.setItem('ppapi_demo_admins', JSON.stringify(admins)); }
      } catch (e) {}
    }, { a: DEMO_ADMIN });
    return;
  }
  const m = demoMember(user, status);
  await context.addInitScript(({ u, m, r }) => {
    try {
      if (!localStorage.getItem('ppapi_demo_session')) {
        localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
        const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
        users[u.email] = { uid: u.uid, name: u.name, email: u.email, phone: u.phone, provider: u.provider, createdAt: u.createdAt, hash: 'x' };
        localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
        localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
        if (r) {
          let reg = JSON.parse(localStorage.getItem('ppapi_registry') || '{}');
          if (!reg || typeof reg !== 'object' || Array.isArray(reg)) reg = {};
          reg[r.kta] = r;
          localStorage.setItem('ppapi_registry', JSON.stringify(reg));
        }
      }
    } catch (e) {}
  }, { u: user, m, r: registryEntryFor(m) });
}
/** write a session directly into an open page (switch accounts inside one context) */
export async function setSession(page, { user, status = 'Aktif', admin = false }) {
  const m = admin ? null : demoMember(user, status);
  await page.evaluate(({ u, m, r, admin }) => {
    localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
    if (m) localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
    if (r) { let reg = {}; try { reg = JSON.parse(localStorage.getItem('ppapi_registry') || '{}') || {}; } catch (e) {} reg[r.kta] = r; localStorage.setItem('ppapi_registry', JSON.stringify(reg)); }
    if (admin) { const a = JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]'); if (!a.includes(u.uid)) { a.push(u.uid); localStorage.setItem('ppapi_demo_admins', JSON.stringify(a)); } }
  }, { u: admin ? DEMO_ADMIN : user, m, r: m ? registryEntryFor(m) : null, admin });
}

export const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};
export async function launch() {
  return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
}
export async function newContext(browser, vp = 'desktop', extra = {}) {
  return browser.newContext({ ...VIEWPORTS[vp], reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta', acceptDownloads: true, ...extra });
}
/** collect console errors/warnings, page errors, failed requests */
export function watch(page) {
  const issues = [];
  page.on('console', msg => { if (['error', 'warning'].includes(msg.type())) issues.push(`console.${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', err => issues.push(`pageerror: ${err.message}`));
  page.on('requestfailed', r => { const t = r.failure()?.errorText || ''; if (!/ERR_ABORTED/.test(t)) issues.push(`requestfailed: ${r.url()} (${t})`); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) issues.push(`HTTP ${r.status()}: ${r.url()}`); });
  return issues;
}

/**
 * Assertion recorder. Checks are also tallied per section group — the leading capital letters of the section
 * title ("A1 …" → A, "D (mobile) …" / "D-nowebgl" → D, "K3 …" → K) — so the summary line states exactly what ran:
 *   aplikasi-flow [--only=A,B,C,D,E]: 199/199 passed  (A 41/41 · B 12/12 · …)
 * `scope` (optional) names the selection that was run, e.g. the effective --only list.
 */
export function recorder(name, { scope = '' } = {}) {
  let pass = 0, fail = 0, group = '';
  const fails = [];
  const groups = new Map();
  const tally = (ok) => { const g = groups.get(group) || { pass: 0, fail: 0 }; if (ok) g.pass++; else g.fail++; groups.set(group, g); };
  return {
    ok(cond, label, extra) {
      if (cond) { pass++; console.log(`  ✓ ${label}`); }
      else { fail++; fails.push(label); console.log(`  ✗ ${label}${extra !== undefined ? '  →  ' + (typeof extra === 'string' ? extra : JSON.stringify(extra)) : ''}`); }
      tally(!!cond);
      return !!cond;
    },
    section(t) { group = (String(t).match(/^[A-Z]+/) || ['-'])[0]; console.log(`\n— ${t}`); },
    done() {
      const by = [...groups].map(([k, g]) => `${k} ${g.pass}/${g.pass + g.fail}`).join(' · ');
      console.log(`\n${name}${scope ? ' ' + scope : ''}: ${pass}/${pass + fail} passed${by ? `  (${by})` : ''}${fail ? ' — FAILED: ' + fails.join(' | ') : ''}`);
      return fail;
    },
  };
}
/* Simulator memory reads. The simulator renders on demand (simulator.js loop(): a frame is drawn only when the
   scene is dirty, the camera moves or the library model spins), and renderer.info.memory.geometries counts the
   geometries three.js holds for drawing: a disposed model leaves the count at once, the model that replaces it joins
   only when the next frame draws it. Read straight after a click, the count therefore misses the new model
   (seen: 6 instead of 40). Always settle before reading:
   • simDrawn(page) — waits two animation frames. The render loop's own requestAnimationFrame callback is registered
     before ours, so by the second frame whatever a click handler changed (synchronously) has been drawn. Safe when
     the action changes nothing (it cannot time out).
   • simClick(page, sel) — clicks, waits until PPAPISim.frames has advanced past its value from before the click (the
     click really was drawn; times out if it was not), then simDrawn(). Use it for clicks that must change the scene. */
export const simDrawn = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
export async function simClick(page, sel) {
  const before = await page.evaluate(() => PPAPISim.frames);
  await page.click(sel);
  await page.waitForFunction((n) => PPAPISim.frames > n, before, { timeout: 15000 });
  await simDrawn(page);
}
export const simGeometries = (page) => page.evaluate(() => PPAPISim.renderer.info.memory.geometries);
export const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(SHOTS, name + '.png'), ...opts });
