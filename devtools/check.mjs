// PPAPI site checker — serves ../site over HTTP, opens pages in headless Chromium,
// reports console errors / page errors / failed requests, and saves screenshots.
//
// Usage:
//   node devtools/check.mjs <page> [<page> ...] [--auth] [--mobile] [--desktop] [--full] [--motion] [--tag=name] [--wait=ms]
//     <page>     file name without .html (e.g. index, masuk, dashboard) or "all"
//     --auth     seed a demo-mode signed-in session before load: the ACTIVE member PPAPI-2026-004821 as an approval
//                leaves it (validUntil 2029-12-31, v2 application) plus its ppapi_registry entry — the same fixture
//                as flows/qa-lib.mjs (DEMO_USER / DEMO_MEMBER / registryEntryFor)
//     --status=X with --auth: override the member status (Draf | Menunggu Verifikasi | Perlu Perbaikan | Aktif | Ditolak | Nonaktif | Kedaluwarsa);
//                the registry entry follows it (none without a KTA; berlakuHingga 2026-06-30 for Kedaluwarsa; status Nonaktif)
//     PPAPI_REAL_FIREBASE=1 env: serve config.js unmodified (real Firebase); default: apiKey blanked → Mode Demo for tests
//     --admin    seed a demo-mode session for the seeded demo ADMIN (uid demo-admin-0001, admin@ppapi.demo) + ppapi_demo_admins
//     <page> may include a sub-path, e.g. aplikasi/perencanaan/index (screenshot name uses "__" for "/")
//     --mobile   only mobile viewport (390x844);  --desktop  only desktop (1440x900)  (default: both)
//     --full     full-page screenshot (default: viewport only)
//     --motion   keep animations enabled (default: prefers-reduced-motion = reduce so reveals show instantly)
//     --tag=x    suffix for screenshot names
//     --wait=ms  extra wait after load (default 900)
//     --eval="js expression"  evaluate in page after load and print the result (JSON)
//
// Screenshots go to devtools/shots/<page>-<viewport>[-tag].png
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEMO_USER, DEMO_MEMBER as BASE_MEMBER, registryEntryFor } from './flows/qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.SITE_ROOT ? path.resolve(process.env.SITE_ROOT) : path.resolve(__dirname, '..', 'site');
const SHOTS = path.join(__dirname, 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.length ? v.join('=') : true];
}));
let pages = args.filter(a => !a.startsWith('--'));
if (!pages.length || pages.includes('all')) {
  pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).map(f => f.replace(/\.html$/, ''));
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};
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
const BASE = `http://127.0.0.1:${server.address().port}`;

// one shared fixture (flows/qa-lib.mjs); cloned because --status edits it
const DEMO_MEMBER = structuredClone(BASE_MEMBER);
if (flags.status) {
  const st = String(flags.status);
  if (st === 'Kedaluwarsa') { DEMO_MEMBER.validUntil = '2026-06-30'; }
  else {
    DEMO_MEMBER.status = st;
    // a new applicant that was never approved: no KTA, validity or approval (only Nonaktif keeps them — deactivated after approval)
    if (['Draf', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Ditolak'].includes(st)) Object.assign(DEMO_MEMBER, { kta: '', validUntil: '', approvedAt: '', approvedBy: '' });
    if (st === 'Draf') { DEMO_MEMBER.application.submittedAt = ''; }
    if (st === 'Perlu Perbaikan') { DEMO_MEMBER.review = { note: 'Mohon lengkapi tautan sertifikat dan riwayat proyek.', history: [{ at: '2026-10-01T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'perbaikan', note: 'Mohon lengkapi tautan sertifikat dan riwayat proyek.' }] }; }
    if (st === 'Ditolak') { DEMO_MEMBER.review = { note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.', history: [{ at: '2026-10-01T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'ditolak', note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.' }] }; }
  }
}
const DEMO_REGISTRY_ENTRY = registryEntryFor(DEMO_MEMBER);   // null when the status has no KTA
const DEMO_ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };

const viewports = [];
if (!flags.mobile) viewports.push({ name: 'desktop', width: 1440, height: 900 });
if (!flags.desktop) viewports.push({ name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });

const browser = await chromium.launch();
let problems = 0;
for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch,
    deviceScaleFactor: vp.deviceScaleFactor || 1, reducedMotion: flags.motion ? 'no-preference' : 'reduce', locale: 'id-ID',
  });
  if (flags.auth) {
    await context.addInitScript(({ u, m, r }) => {
      try {
        if (!localStorage.getItem('ppapi_demo_session')) {
          localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
          const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
          users[u.email] = { uid: u.uid, name: u.name, email: u.email, phone: u.phone, provider: u.provider, createdAt: u.createdAt, hash: 'x' };
          localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
          localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
          if (r) {   // the public registry entry the approval wrote (store.js registryEntry)
            let reg = JSON.parse(localStorage.getItem('ppapi_registry') || '{}');
            if (!reg || typeof reg !== 'object' || Array.isArray(reg)) reg = {};
            reg[r.kta] = r;
            localStorage.setItem('ppapi_registry', JSON.stringify(reg));
          }
        }
      } catch (e) {}
    }, { u: DEMO_USER, m: DEMO_MEMBER, r: DEMO_REGISTRY_ENTRY });
  }
  if (flags.admin) {
    await context.addInitScript(({ a }) => {
      try {
        if (!localStorage.getItem('ppapi_demo_session')) localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
        const admins = JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]');
        if (!admins.includes(a.uid)) { admins.push(a.uid); localStorage.setItem('ppapi_demo_admins', JSON.stringify(admins)); }
      } catch (e) {}
    }, { a: DEMO_ADMIN });
  }
  for (const pg of pages) {
    const page = await context.newPage();
    const issues = [];
    page.on('console', msg => { if (['error', 'warning'].includes(msg.type())) issues.push(`console.${msg.type()}: ${msg.text()}`); });
    page.on('pageerror', err => issues.push(`pageerror: ${err.message}`));
    page.on('requestfailed', r => { const err = r.failure()?.errorText || ''; if (err !== 'net::ERR_ABORTED') issues.push(`requestfailed: ${r.url()} (${err})`); }); // ERR_ABORTED = request cancelled by navigation/close (e.g. Firestore Listen channel), not a site error
    page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico')) issues.push(`HTTP ${r.status()}: ${r.url()}`); });
    const url = `${BASE}/${pg}.html${flags.query ? '?' + flags.query : ''}`;
    try {
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      // networkidle is best-effort: Firestore keeps a streaming channel open in real Firebase mode
      await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    } catch (e) { issues.push(`goto: ${e.message.split('\n')[0]}`); }
    await page.waitForTimeout(Number(flags.wait || 900));
    const finalUrl = page.url().replace(BASE, '');
    const shot = path.join(SHOTS, `${pg.replace(/[\/]/g, '__')}-${vp.name}${flags.tag ? '-' + flags.tag : ''}.png`);
    await page.screenshot({ path: shot, fullPage: !!flags.full });
    const overflow = await page.evaluate((w) => Math.max(document.documentElement.scrollWidth - window.innerWidth, document.documentElement.scrollWidth - w, document.documentElement.scrollWidth - document.documentElement.clientWidth), vp.width).catch(() => 0);
    if (overflow > 1) issues.push(`layout: horizontal overflow of ${overflow}px`);
    let evalOut = '';
    if (flags.eval) {
      try { evalOut = JSON.stringify(await page.evaluate(flags.eval)); } catch (e) { evalOut = 'EVAL ERROR: ' + e.message; }
    }
    problems += issues.length;
    console.log(`\n[${vp.name}] ${pg}  ->  ${finalUrl}`);
    console.log(`  screenshot: ${path.relative(process.cwd(), shot)}`);
    if (evalOut) console.log(`  eval: ${evalOut}`);
    console.log(issues.length ? issues.map(i => '  ! ' + i).join('\n') : '  ok: no console errors, page errors, failed requests or overflow');
    await page.close();
  }
  await context.close();
}
await browser.close();
server.close();
console.log(`\nDone. ${problems} issue(s).`);
