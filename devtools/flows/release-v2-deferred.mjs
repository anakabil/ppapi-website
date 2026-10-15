// Release QA v2 (2026-10-09) — the items deferred by the fix groups and closed during release QA.
// Run from devtools/:  node flows/release-v2-deferred.mjs
//
//   A  static: Content-Security-Policy on every page (apps: + cdnjs), rules contain identityKept / kategoriAllowed
//   B  demo: no 1200 px logo PNG master requested on masuk, umpan-balik, dashboard (KTA teaser) and the simulator gate;
//      no CSP violation on the visited pages
//   C  demo: public registry keeps the APPROVED snapshot (nama, kompetensi, kota) through extend / kategori /
//      nonaktif / aktifkan kembali, while the secretariat-controlled fields follow the member record
//   D  demo: identity lock — after approval the member cannot rename themselves (store/identity-locked), an admin can,
//      a never-approved applicant can; auth.updateName stays quiet; pendaftaran (renewal) shows the name read-only
//   E  demo: Konsol Admin → Admin: copy says only VERIFIED email accounts can become admin
//   F  Firebase (compat-SDK stub + rules mirror from firebase-v2-stub.mjs): rules refuse a renamed approved member and a
//      self-chosen "Kehormatan"; admin extend keeps the registry snapshot inside the transaction
//   G  Firebase: dashboard e-mail verification notice (resend + "Saya Sudah Memverifikasi"), pendaftaran hint; none in demo
//   H  demo: cross-page #fragment links to data-rendered pages (berita #arsip, pustaka #katalog/#aplikasi, keanggotaan
//      #alur) land on the target without layout shift (core.js deferredHashScroll), desktop + mobile, reduced motion
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, DEMO_USER, DEMO_MEMBER, registryEntryFor } from './qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots', 'qa');
fs.mkdirSync(SHOTS, { recursive: true });
const T = (() => {
  let pass = 0; const fails = [];
  return {
    section(t) { console.log('\n' + t); },
    ok(cond, label, detail) {
      if (cond) { pass++; console.log('  ✓ ' + label); }
      else { fails.push(label); console.log('  ✗ ' + label + (detail !== undefined ? '\n      ' + JSON.stringify(detail).slice(0, 600) : '')); }
      return !!cond;
    },
    done() {
      console.log(`\nrelease-v2-deferred: ${pass}/${pass + fails.length} passed` + (fails.length ? ' — FAILED: ' + fails.join(' | ') : ''));
      if (fails.length) process.exitCode = 1;
    }
  };
})();
const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
const clone = o => JSON.parse(JSON.stringify(o));

/* ------------------------------------------------------------------ A · static */
T.section('A · CSP meta + rules');
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).concat(['aplikasi/perencanaan/index.html', 'aplikasi/simulator/index.html']);
const cspOf = f => (/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(fs.readFileSync(path.join(ROOT, f), 'utf8')) || [])[1] || '';
const base = cspOf('index.html');
T.ok(/default-src 'self'/.test(base) && /object-src 'none'/.test(base) && /base-uri 'self'/.test(base), 'index.html CSP: default-src self, object-src none, base-uri self');
const appCsp = base.replace("https://www.google.com; style-src", "https://www.google.com https://cdnjs.cloudflare.com; style-src");
const wrong = pages.filter(f => cspOf(f) !== (f.startsWith('aplikasi/') ? appCsp : base));
T.ok(!wrong.length, `every page (${pages.length}) carries the same CSP; the two apps add https://cdnjs.cloudflare.com to script-src`, wrong);
const headOrder = pages.filter(f => { const s = fs.readFileSync(path.join(ROOT, f), 'utf8'); const i = s.indexOf('Content-Security-Policy'); return !(i > 0 && i < s.search(/<script|<link rel="stylesheet"/)); });
T.ok(!headOrder.length, 'the CSP meta comes before every script and stylesheet', headOrder);
const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
T.ok(/function identityKept\(after, before\)/.test(rules) && /&& identityKept\(after, before\)/.test(rules), 'firestore.rules: identityKept() defined and used in ownerUpdate');
T.ok(/function kategoriAllowed\(after, before\)/.test(rules) && /&& kategoriAllowed\(after, before\)/.test(rules) && /get\('kategori', ''\)\s*in \['', 'Praktisi', 'Ahli', 'Mitra Korporat'\]/.test(rules), 'firestore.rules: kategoriAllowed() in ownerUpdate + kategori check on create');

/* ------------------------------------------------------------------ demo helpers */
const { BASE, close } = await startServer();
const browser = await chromium.launch();
async function ctxWith(session, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta', reducedMotion: 'reduce', ...extra });
  await ctx.addInitScript(({ s, admin, records, registry }) => {
    try {
      if (sessionStorage.getItem('__rqa_seeded')) return;
      sessionStorage.setItem('__rqa_seeded', '1');
      if (s) {
        localStorage.setItem('ppapi_demo_session', JSON.stringify(s));
        const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
        if (!users[s.email]) users[s.email] = { uid: s.uid, name: s.name, email: s.email, phone: s.phone || '', provider: 'password', createdAt: s.createdAt, hash: 'x' };
        localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
      }
      if (admin) { const a = JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]'); if (!a.includes(admin)) a.push(admin); localStorage.setItem('ppapi_demo_admins', JSON.stringify(a)); }
      (records || []).forEach(m => localStorage.setItem('ppapi_member_' + m.uid, JSON.stringify(m)));
      if (registry) { const r = JSON.parse(localStorage.getItem('ppapi_registry') || '{}'); Object.assign(r, registry); localStorage.setItem('ppapi_registry', JSON.stringify(r)); }
    } catch (e) {}
  }, { s: session || null, admin: extra.admin || null, records: extra.records || [], registry: extra.registry || null });
  await ctx.addInitScript(() => { window.__csp = []; document.addEventListener('securitypolicyviolation', e => window.__csp.push(e.violatedDirective + ' ' + e.blockedURI)); });
  return ctx;
}
async function open(ctx, url, ready = true) {
  const page = await ctx.newPage();
  const issues = [], reqs = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/Failed to load resource.*fonts/.test(m.text())) issues.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', e => issues.push('pageerror: ' + e.message));
  page.on('request', r => reqs.push(r.url()));
  await page.goto(BASE + '/' + url, { waitUntil: 'networkidle' });
  if (ready) await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady(), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  return { page, issues, reqs };
}

/* ------------------------------------------------------------------ B · logos + CSP violations */
T.section('B · logo masters + CSP at runtime (demo)');
{
  const draf = Object.assign(clone(DEMO_MEMBER), { status: 'Draf', kta: '', validUntil: '', approvedAt: '', approvedBy: '' });
  draf.application.submittedAt = '';
  const ctxG = await ctxWith(null);
  for (const url of ['masuk.html', 'umpan-balik.html']) {
    const { page, issues, reqs } = await open(ctxG, url);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(500);
    T.ok(!reqs.some(u => /logo-light\.png/.test(u)), `${url}: no logo-light.png (1200 px master) requested`, reqs.filter(u => /logo-/.test(u)));
    T.ok(!(await page.evaluate(() => window.__csp.length)) && !issues.length, `${url}: no CSP violation, no console error`, { csp: await page.evaluate(() => window.__csp), issues });
    await page.close();
  }
  await ctxG.close();
  const ctxD = await ctxWith(DEMO_USER, { records: [draf] });
  {
    const { page, issues, reqs } = await open(ctxD, 'dashboard.html');
    await page.waitForSelector('#dash-teasers:not(:empty)', { timeout: 8000 }).catch(() => {});
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(500);
    T.ok(await page.$eval('.dash-ktamock__top img', i => /logo-light-sm\.webp$/.test(i.getAttribute('src')) && i.naturalWidth === 480), 'dashboard (Draf): KTA teaser logo = logo-light-sm.webp (480 px)');
    T.ok(!reqs.some(u => /logo-light\.png/.test(u)), 'dashboard: no logo-light.png requested', reqs.filter(u => /logo-/.test(u)));
    T.ok(await page.$eval('#dash-verify', el => el.hidden), 'dashboard (demo): no e-mail verification notice (demo accounts count as verified)');
    T.ok(!(await page.evaluate(() => window.__csp.length)) && !issues.length, 'dashboard: no CSP violation, no console error', issues);
    await page.close();
  }
  await ctxD.close();
  const ctxA = await ctxWith(DEMO_USER, { records: [clone(DEMO_MEMBER)], registry: { [DEMO_MEMBER.kta]: registryEntryFor(DEMO_MEMBER) } });
  {
    const { page, issues, reqs } = await open(ctxA, 'aplikasi/simulator/index.html', false);
    await page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'), null, { timeout: 30000 }).catch(() => {});
    T.ok(!reqs.some(u => /logo-light\.png/.test(u)), 'simulator gate: logo-light-mark.webp, no 1200 px PNG', reqs.filter(u => /logo-/.test(u)));
    T.ok(reqs.some(u => /cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js/.test(u)) && !(await page.evaluate(() => window.__csp.length)), 'simulator: three.js from cdnjs allowed by the app CSP (no violation)', await page.evaluate(() => window.__csp));
    T.ok(!issues.filter(i => !/WebGL|GPU stall|GL Driver/i.test(i)).length, 'simulator: no console error (WebGL driver notices aside)', issues);
    await page.close();
  }
  await ctxA.close();
}

/* ------------------------------------------------------------------ C · registry snapshot (demo) */
T.section('C · registry keeps the approved snapshot (demo)');
const APPL = Object.assign(clone(DEMO_MEMBER), { uid: 'rqa-uji-0101', name: 'Rahmat Hidayat', email: 'rahmat.rqa@contoh.id', kta: '', status: 'Menunggu Verifikasi', validUntil: '', approvedAt: '', approvedBy: '' });
APPL.application.submittedAt = '2026-10-05T02:00:00.000Z';
{
  const ctx = await ctxWith(ADMIN, { admin: ADMIN.uid, records: [APPL] });
  const { page, issues } = await open(ctx, 'index.html');
  const R = await page.evaluate(async (uid) => {
    const A = PPAPI.store.admin, reg = () => JSON.parse(localStorage.getItem('ppapi_registry') || '{}');
    const out = {};
    const m1 = await A.approve(uid, { memberType: 'Praktisi', validUntil: '2029-12-31', note: 'Disetujui (uji rilis).' });
    out.kta = m1.kta; out.r1 = reg()[m1.kta];
    /* the member edits the record "around the store" (as an SDK write would have done before the rules change) */
    const k = 'ppapi_member_' + uid, raw = JSON.parse(localStorage.getItem(k));
    raw.name = 'Ir. Budi Santoso, M.T.'; raw.competencies = [{ id: 'x1', code: 'K3-UMUM', name: 'Ahli K3 Umum', level: 'Mahir', since: 2015, notes: '' }]; raw.profile.city = 'Jakarta Selatan';
    localStorage.setItem(k, JSON.stringify(raw));
    await A.extend(uid, '2030-12-31', 'Perpanjangan langsung (uji).'); out.r2 = reg()[m1.kta];
    await A.setMemberType(uid, 'Ahli'); out.r3 = reg()[m1.kta];
    await A.deactivate(uid, 'Nonaktif sementara (uji).'); out.r4 = reg()[m1.kta];
    await A.reactivate(uid, { validUntil: '2031-12-31', note: 'Aktif kembali (uji).' }); out.r5 = reg()[m1.kta];
    out.lookup = await PPAPI.store.registry.lookup(m1.kta);
    out.byNewName = await PPAPI.store.registry.lookup('Budi Santoso');
    return out;
  }, APPL.uid);
  const snap = r => r && [r.nama, (r.kompetensi || []).join('|'), r.kota];
  const want = ['Rahmat Hidayat', 'Supervisor Perancah|Inspektur Perancah', 'Balikpapan'];
  T.ok(/^PPAPI-\d{4}-\d{6}$/.test(R.kta) && JSON.stringify(snap(R.r1)) === JSON.stringify(want) && R.r1.status === 'Aktif' && R.r1.berlakuHingga === '2029-12-31', 'approve: registry snapshot of the reviewed data', R.r1);
  T.ok(JSON.stringify(snap(R.r2)) === JSON.stringify(want) && R.r2.berlakuHingga === '2030-12-31' && R.r2.status === 'Aktif', 'extend after a self-edit: nama/kompetensi/kota kept, berlakuHingga follows', R.r2);
  T.ok(JSON.stringify(snap(R.r3)) === JSON.stringify(want) && R.r3.kategori === 'Ahli', 'kategori change: kategori follows, snapshot kept', R.r3);
  T.ok(JSON.stringify(snap(R.r4)) === JSON.stringify(want) && R.r4.status === 'Nonaktif', 'deactivate: status Nonaktif, snapshot kept', R.r4);
  T.ok(JSON.stringify(snap(R.r5)) === JSON.stringify(want) && R.r5.status === 'Aktif' && R.r5.berlakuHingga === '2031-12-31' && R.r5.kategori === 'Ahli', 'reactivate: Aktif + new validity + kategori, snapshot kept', R.r5);
  T.ok(R.r5.namaCari === 'rahmat hidayat' && R.r5.namaKata.join() === 'rahmat,hidayat' && R.r5.ktaNomor === R.kta.slice(-6), 'search keys follow the snapshot name', { namaCari: R.r5.namaCari, namaKata: R.r5.namaKata });
  T.ok(R.lookup.exact && R.lookup.exact.nama === 'Rahmat Hidayat' && !(R.byNewName.matches || []).some(x => x.kta === R.kta), 'verification lookup: the KTA shows the approved name; the self-chosen name finds nothing', { exact: R.lookup.exact && R.lookup.exact.nama, byNewName: (R.byNewName.matches || []).map(x => x.nama) });
  T.ok(!issues.length, 'no console error', issues);
  await ctx.close();
}

/* ------------------------------------------------------------------ D · identity lock (demo) */
T.section('D · identity lock after approval (demo)');
{
  const ctx = await ctxWith(DEMO_USER, { records: [clone(DEMO_MEMBER)], registry: { [DEMO_MEMBER.kta]: registryEntryFor(DEMO_MEMBER) } });
  const { page, issues } = await open(ctx, 'index.html');
  const R = await page.evaluate(async (uid) => {
    const S = PPAPI.store, err = async p => { try { await p; return 'OK'; } catch (e) { return e.code || e.message; } };
    const out = {};
    out.rename = await err(S.saveMember(uid, { name: 'Ir. Budi Santoso, M.T.' }));
    out.same = await err(S.saveMember(uid, { name: 'Rahmat Hidayat', profile: { city: 'Balikpapan Kota' } }));
    out.city = (await S.getMember(uid)).profile.city;
    await PPAPI.auth.updateName('Rahmat H.');
    out.afterUpdateName = [(await S.getMember(uid)).name, PPAPI.auth.current().name];
    out.msg = await (async () => { try { await S.saveMember(uid, { name: 'X Y Z' }); return ''; } catch (e) { return e.message; } })();
    return out;
  }, DEMO_USER.uid);
  T.ok(R.rename === 'store/identity-locked', 'approved member: saveMember({name}) → store/identity-locked', R.rename);
  T.ok(R.same === 'OK' && R.city === 'Balikpapan Kota', 'same name + other fields still save', R);
  T.ok(R.afterUpdateName[0] === 'Rahmat Hidayat' && R.afterUpdateName[1] === 'Rahmat H.', 'auth.updateName: account name changes, the member record keeps the reviewed name', R.afterUpdateName);
  T.ok(/sekretariat/.test(R.msg) && /Kontak/.test(R.msg), 'error message points to the secretariat (Kontak)', R.msg);
  T.ok(!issues.length, 'no console error or warning (identity-locked is expected, not logged)', issues);
  await ctx.close();
}
{
  /* a never-approved applicant may still correct the name; an admin may rename an approved member */
  const draf = Object.assign(clone(DEMO_MEMBER), { status: 'Draf', kta: '', validUntil: '', approvedAt: '', approvedBy: '' });
  draf.application.submittedAt = '';
  const ctx = await ctxWith(DEMO_USER, { records: [draf] });
  const { page } = await open(ctx, 'index.html');
  const r = await page.evaluate(async uid => { try { const m = await PPAPI.store.saveMember(uid, { name: 'Rahmat Hidayat, S.T.' }); return m.name; } catch (e) { return e.code; } }, DEMO_USER.uid);
  T.ok(r === 'Rahmat Hidayat, S.T.', 'never-approved (Draf) applicant can still change the name', r);
  await ctx.close();
  const other = Object.assign(clone(DEMO_MEMBER), { uid: 'rqa-uji-0202', email: 'lain.rqa@contoh.id' });
  const ctxA = await ctxWith(ADMIN, { admin: ADMIN.uid, records: [other] });
  const { page: pa } = await open(ctxA, 'index.html');
  const ra = await pa.evaluate(async uid => { try { const m = await PPAPI.store.saveMember(uid, { name: 'Rahmat Hidayat Saputra' }); return m.name; } catch (e) { return e.code; } }, other.uid);
  T.ok(ra === 'Rahmat Hidayat Saputra', 'an admin can correct the name of an approved member', ra);
  await ctxA.close();
}
{
  /* pendaftaran in renewal mode (approved, validity passed) shows the reviewed name read-only */
  const exp = Object.assign(clone(DEMO_MEMBER), { validUntil: '2026-06-30' });
  exp.profile.birthDate = '1988-04-12';
  const ctx = await ctxWith(DEMO_USER, { records: [exp], registry: { [exp.kta]: Object.assign(registryEntryFor(exp), { berlakuHingga: '2026-06-30' }) } });
  const { page, issues } = await open(ctx, 'pendaftaran.html#data-diri');
  await page.waitForSelector('#f-name', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  const st = await page.evaluate(() => ({ ro: document.getElementById('f-name')?.readOnly, bd: document.getElementById('f-birthDate')?.readOnly, val: document.getElementById('f-name')?.value, hint: document.getElementById('f-name-hint')?.textContent, link: !!document.querySelector('#f-name-hint a[href^="umpan-balik.html"]'), desc: document.getElementById('f-birthDate')?.getAttribute('aria-describedby') }));
  T.ok(st.ro && st.bd && st.val === 'Rahmat Hidayat', 'renewal wizard: name + filled birth date read-only', st);
  T.ok(/tidak diubah melalui formulir ini/.test(st.hint) && st.link && st.desc === 'f-name-hint', 'renewal wizard: hint explains why and links to Kontak; birth date described by it', st.hint);
  const el = await page.$('#f-name');
  if (el) await el.screenshot({ path: path.join(SHOTS, 'release-renewal-name.png') }).catch(() => {});
  const box = await page.$('#f-name-hint');
  if (box) { await page.evaluate(() => document.getElementById('f-name').closest('.field').scrollIntoView({ block: 'center' })); await page.screenshot({ path: path.join(SHOTS, 'release-renewal-name-view.png') }); }
  T.ok(!issues.length, 'pendaftaran (renewal): no console error', issues);
  await ctx.close();
}

/* ------------------------------------------------------------------ E · admin console copy */
T.section('E · Konsol Admin → Admin (verified e-mail copy)');
{
  const ctx = await ctxWith(ADMIN, { admin: ADMIN.uid });
  const { page, issues } = await open(ctx, 'admin.html#admin');
  await page.waitForSelector('html[data-admin-ready]', { timeout: 15000 }).catch(() => {});
  await page.waitForSelector('#adm-add-form', { timeout: 8000 }).catch(() => {});
  T.ok(/Hanya email terverifikasi/.test(await page.textContent('.adm-add__note')) && !/tidak memverifikasi/.test(await page.textContent('.adm-add__note')), 'note: only verified e-mail accounts (old "does not verify" copy gone)');
  await page.fill('#adm-add-email', 'belum.ada@contoh.id');
  await page.click('#adm-add-check');
  await page.waitForTimeout(250);
  T.ok(/Belum ada akun dengan email terverifikasi ini/.test(await page.textContent('#adm-add-result')), 'unknown address: "Belum ada akun dengan email terverifikasi ini …"');
  T.ok(!issues.length, 'no console error', issues);
  await ctx.close();
}

/* ------------------------------------------------------------------ H · deferred #fragment jumps */
T.section('H · cross-page #fragment links: no layout shift, same landing position');
{
  const INIT = `window.__cls=0;new PerformanceObserver(l=>{for(const e of l.getEntries()){if(!e.hadRecentInput)window.__cls+=e.value}}).observe({type:'layout-shift',buffered:true});`;
  const URLS = ['berita.html?kategori=Kegiatan#arsip', 'berita.html#arsip', 'pustaka.html?kategori=modul-pelatihan#katalog', 'pustaka.html#aplikasi', 'keanggotaan.html#alur', 'umpan-balik.html?kategori=pertanyaan#formulir'];
  for (const vp of [{ n: 'desktop', width: 1440, height: 900 }, { n: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, reducedMotion: 'reduce' });
    await ctx.addInitScript(INIT);
    for (const url of URLS) {
      const page = await ctx.newPage();
      await page.goto(BASE + '/' + url, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1600);
      const r = await page.evaluate(() => { const el = document.querySelector(location.hash); return { cls: +window.__cls.toFixed(3), hash: location.hash, top: el ? Math.round(el.getBoundingClientRect().top) : null, offset: el ? (parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0) + (parseFloat(getComputedStyle(el).scrollMarginTop) || 0) : null }; });
      T.ok(r.cls <= 0.05 && r.hash === '#' + url.split('#')[1] && r.top !== null && Math.abs(r.top - r.offset) <= 2, `${vp.n} ${url}: CLS ${r.cls} ≤ 0,05; lands on the target (top ${r.top} = scroll offset ${r.offset}); #fragment kept in the address`, r);
      await page.close();
    }
    await ctx.close();
  }
}
await browser.close();
close();

/* ------------------------------------------------------------------ Firebase stub */
const stubFile = fs.readFileSync(path.join(__dirname, 'firebase-v2-stub.mjs'), 'utf8');
const s0 = stubFile.indexOf('const STUB = () => {');
const endM = s0 < 0 ? null : /\r?\n\};\r?\n/.exec(stubFile.slice(s0));
const STUB_SRC = '(' + stubFile.slice(s0 + 'const STUB = '.length, s0 + endM.index) + '\n})();';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const fbServer = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  let body = fs.readFileSync(file);
  if (p === '/assets/js/config.js') body = body.toString('utf8').replace("apiKey: ''", "apiKey: 'AIzaSyFAKE-stub-key-000000000000000000'").replace("projectId: ''", "projectId: 'ppapi-stub'");
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  res.end(body);
});
await new Promise(r => fbServer.listen(0, '127.0.0.1', r));
const FB = `http://127.0.0.1:${fbServer.address().port}`;
const fbBrowser = await chromium.launch();
async function fbPage(seed, url, arg) {
  const ctx = await fbBrowser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'id-ID', timezoneId: 'Asia/Jakarta', reducedMotion: 'reduce' });
  await ctx.clock.setFixedTime(new Date('2026-10-09T10:00:00+07:00'));
  await ctx.addInitScript({ content: STUB_SRC });
  if (seed) await ctx.addInitScript(seed, arg);
  const page = await ctx.newPage();
  const issues = [];
  page.on('pageerror', e => issues.push('pageerror: ' + e.message));
  page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/Failed to load resource/.test(m.text())) issues.push(m.type() + ': ' + m.text()); });
  await page.goto(FB + '/' + url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady(), null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(300);
  return { ctx, page, issues };
}

/* ------------------------------------------------------------------ F · rules mirror */
T.section('F · Firebase rules: identity lock + kategori (stub mirror of firestore.rules)');
{
  const SEED = () => {
    const F = window.__fstub;
    firebase.auth().createUserWithEmailAndPassword('gita@contoh.id', 'Perancah2026');
    F.verifyEmail('gita@contoh.id');
    const me = F.uid();
    const app = { type: 'baru', kategori: 'Ahli', submittedAt: '2026-02-01T02:00:00.000Z', updatedAt: '2026-02-01T02:00:00.000Z', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Gita Aktif', tanggal: '2026-02-01' }, catatan: '' };
    F.console.set('members/' + me, { uid: me, name: 'Gita Aktif', email: '', phone: '', photoURL: '', kta: 'PPAPI-2026-000050', memberType: 'Ahli', status: 'Aktif', joinedAt: '2026-02-01', validUntil: '2029-12-31', approvedAt: '2026-02-01T02:00:00.000Z', approvedBy: 'adm', profile: { city: 'Bogor' }, competencies: [], certificates: [], application: app, review: { note: '', history: [] }, createdAt: '2026-01-20T02:00:00.000Z', updatedAt: '2026-02-01T02:00:00.000Z' });
  };
  const { ctx, page, issues } = await fbPage(SEED, 'umpan-balik.html');
  const R = await page.evaluate(async () => {
    const F = window.__fstub, fb = firebase.firestore(), ts = firebase.firestore.FieldValue.serverTimestamp;
    const uid = F.uid(), ref = fb.collection('members').doc(uid);
    const err = async p => { try { await p; return 'OK'; } catch (e) { return e.code || e.message; } };
    const out = { mode: PPAPI.auth.mode };
    out.renameRules = await err(ref.update({ name: 'Ir. Gita Lain', updatedAt: ts() }));
    out.renameStore = await err(PPAPI.store.saveMember(uid, { name: 'Ir. Gita Lain' }));
    out.otherField = await err(ref.update({ phone: '', updatedAt: ts() }));
    /* renewal window of a holder of "Kehormatan" → may keep Kehormatan; an Ahli holder may not pick it */
    F.console.set('members/' + uid, Object.assign(F.console.get('members/' + uid), { validUntil: '2026-06-30' }));
    out.kehormatanByAhli = await err(ref.update({ 'application.kategori': 'Kehormatan', 'application.updatedAt': ts(), updatedAt: ts() }));
    out.ahliRenewal = await err(ref.update({ 'application.kategori': 'Ahli', 'application.updatedAt': ts(), updatedAt: ts() }));
    F.console.set('members/' + uid, Object.assign(F.console.get('members/' + uid), { memberType: 'Kehormatan' }));
    out.kehormatanByHolder = await err(ref.update({ 'application.kategori': 'Kehormatan', 'application.updatedAt': ts(), updatedAt: ts() }));
    /* a brand-new account cannot create its record with "Kehormatan" */
    await firebase.auth().createUserWithEmailAndPassword('baru@contoh.id', 'Perancah2026');
    const nu = F.uid();
    const base = { uid: nu, name: 'Calon Baru', email: '', phone: '', photoURL: '', kta: '', memberType: 'Praktisi', status: 'Draf', joinedAt: '2026-10-09', validUntil: '', approvedAt: '', approvedBy: '', profile: {}, competencies: [], certificates: [], review: { note: '', history: [] }, createdAt: ts(), updatedAt: ts() };
    out.createKehormatan = await err(fb.collection('members').doc(nu).set(Object.assign({}, base, { application: { type: 'baru', kategori: 'Kehormatan' } })));
    out.createPraktisi = await err(fb.collection('members').doc(nu).set(Object.assign({}, base, { application: { type: 'baru', kategori: 'Praktisi' } })));
    out.drafKehormatan = await err(fb.collection('members').doc(nu).update({ 'application.kategori': 'Kehormatan', 'application.updatedAt': ts(), updatedAt: ts() }));
    out.drafRename = await err(fb.collection('members').doc(nu).update({ name: 'Calon Baru Sekali', updatedAt: ts() }));
    return out;
  });
  T.ok(R.mode === 'firebase', 'Firebase mode (stub)');
  T.ok(R.renameRules === 'permission-denied', 'rules: an approved member cannot rename themselves (identityKept)', R.renameRules);
  T.ok(R.renameStore === 'store/identity-locked', 'store refuses before the write (store/identity-locked)', R.renameStore);
  T.ok(R.otherField === 'OK', 'other own fields still update', R.otherField);
  T.ok(R.kehormatanByAhli === 'permission-denied' && R.ahliRenewal === 'OK', 'rules: an Ahli member cannot choose Kehormatan; Ahli is fine', R);
  T.ok(R.kehormatanByHolder === 'OK', 'rules: a Kehormatan holder may keep Kehormatan on renewal', R.kehormatanByHolder);
  T.ok(R.createKehormatan === 'permission-denied' && R.createPraktisi === 'OK', 'rules: a new record cannot be created with Kehormatan', R);
  T.ok(R.drafKehormatan === 'permission-denied' && R.drafRename === 'OK', 'rules: a Draf applicant cannot choose Kehormatan, can still rename', R);
  T.ok(!issues.length, 'no console error', issues);
  await ctx.close();
}
{
  /* admin extend in Firebase mode: transaction reads the registry entry first and keeps the snapshot */
  const SEED = () => {
    const F = window.__fstub;
    firebase.auth().createUserWithEmailAndPassword('sekretariat@contoh.id', 'Perancah2026');
    const me = F.uid();
    F.console.set('admins/' + me, { uid: me, name: 'Sekretariat Uji', email: 'sekretariat@contoh.id', addedAt: '2026-10-01T02:00:00.000Z', addedBy: 'console' });
    F.console.set('members/' + me, { uid: me, name: 'Sekretariat Uji', email: '', phone: '', photoURL: '', kta: '', memberType: 'Praktisi', status: 'Draf', joinedAt: '2026-10-01', validUntil: '', approvedAt: '', approvedBy: '', profile: {}, competencies: [], certificates: [], application: {}, review: { note: '', history: [] }, createdAt: '2026-10-01T02:00:00.000Z', updatedAt: '2026-10-01T02:00:00.000Z' });
    F.console.set('members/fb-anggota-9', { uid: 'fb-anggota-9', name: 'Nama Diubah Sendiri', email: '', phone: '', photoURL: '', kta: 'PPAPI-2026-000090', memberType: 'Ahli', status: 'Aktif', joinedAt: '2026-02-01', validUntil: '2026-11-20', approvedAt: '2026-02-01T02:00:00.000Z', approvedBy: me, profile: { city: 'Kota Lain' }, competencies: [{ id: 'c', code: 'X', name: 'Kompetensi Baru', level: 'Mahir', since: 2020, notes: '' }], certificates: [], application: { type: 'baru', kategori: 'Ahli' }, review: { note: '', history: [] }, createdAt: '2026-01-20T02:00:00.000Z', updatedAt: '2026-02-01T02:00:00.000Z' });
    F.console.set('registry/PPAPI-2026-000090', { kta: 'PPAPI-2026-000090', nama: 'Gita Disetujui', kategori: 'Ahli', kompetensi: ['Supervisor Perancah'], kota: 'Bogor', berlakuHingga: '2026-11-20', status: 'Aktif' });
  };
  const { ctx, page, issues } = await fbPage(SEED, 'umpan-balik.html');
  const R = await page.evaluate(async () => {
    const F = window.__fstub, out = {};
    const t0 = F.transactions;
    try { await PPAPI.store.admin.extend('fb-anggota-9', '2030-12-31', 'Perpanjangan (uji rilis).'); out.ok = true; } catch (e) { out.ok = e.code || e.message; }
    out.tx = F.transactions - t0;
    out.reg = F.console.get('registry/PPAPI-2026-000090');
    out.denied = F.log.filter(l => l[2] === false).map(l => l[0] + ' ' + l[1]);
    return out;
  });
  T.ok(R.ok === true && R.tx === 1, 'admin.extend runs as one transaction (rules mirror allows every step)', R);
  T.ok(R.reg && R.reg.nama === 'Gita Disetujui' && R.reg.kompetensi.join() === 'Supervisor Perancah' && R.reg.kota === 'Bogor' && R.reg.berlakuHingga === '2030-12-31' && R.reg.namaCari === 'gita disetujui', 'registry keeps the approved snapshot; berlakuHingga follows (Firebase)', R.reg);
  T.ok(!R.denied.length && !issues.length, 'no denied operation, no console error', { denied: R.denied, issues });
  await ctx.close();
}

/* ------------------------------------------------------------------ G · verification notice */
T.section('G · e-mail verification notice (Firebase)');
{
  const SEED = () => {
    if (sessionStorage.getItem('__fbv')) return;          // keep one account per tab across reloads? (stub is in-memory → reseed)
    const F = window.__fstub;
    firebase.auth().createUserWithEmailAndPassword('calon@contoh.id', 'Perancah2026');
    const me = F.uid();
    firebase.auth().currentUser.updateProfile({ displayName: 'Calon Anggota' });
    F.console.set('members/' + me, { uid: me, name: 'Calon Anggota', email: '', phone: '', photoURL: '', kta: '', memberType: 'Praktisi', status: 'Draf', joinedAt: '2026-10-09', validUntil: '', approvedAt: '', approvedBy: '', profile: {}, competencies: [], certificates: [], application: { type: 'baru', kategori: '' }, review: { note: '', history: [] }, createdAt: '2026-10-09T02:00:00.000Z', updatedAt: '2026-10-09T02:00:00.000Z' });
  };
  for (const vp of [{ name: 'desktop', w: 1440, h: 900 }, { name: 'mobile', w: 390, h: 844 }]) {
    const { ctx, page, issues } = await fbPage(SEED, 'dashboard.html');
    await page.setViewportSize({ width: vp.w, height: vp.h });
    await page.waitForSelector('#dash-verify:not([hidden])', { timeout: 8000 }).catch(() => {});
    const v0 = await page.evaluate(() => ({ shown: !document.getElementById('dash-verify').hidden, text: document.getElementById('dash-verify').textContent.replace(/\s+/g, ' ').trim(), region: document.querySelector('#dash-verify [role="region"]')?.getAttribute('aria-labelledby'), btns: [...document.querySelectorAll('#dash-verify button')].map(b => b.textContent.trim()) }));
    T.ok(v0.shown && /calon@contoh\.id/.test(v0.text) && v0.region === 'dash-verify-title' && v0.btns.join('|') === 'Saya Sudah Memverifikasi|Kirim Ulang Tautan', `${vp.name}: unverified e-mail account → notice in the hero (address, labelled region, 2 actions)`, v0);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    T.ok(ov <= 1, `${vp.name}: no horizontal overflow`, ov);
    await page.evaluate(() => scrollTo(0, 0));
    await page.screenshot({ path: path.join(SHOTS, `release-verify-${vp.name}.png`) });
    if (vp.name === 'desktop') {
      await page.click('#dash-verify [data-verify="send"]');
      await page.waitForFunction(() => /Tautan verifikasi baru telah dikirim/.test(document.getElementById('dash-verify-status')?.textContent || ''), null, { timeout: 5000 }).catch(() => {});
      T.ok(await page.evaluate(() => window.__fstub.mails('calon@contoh.id')) === 1 && /calon@contoh\.id/.test(await page.textContent('#dash-verify-status')), 'Kirim Ulang Tautan → one mail sent, status line names the address');
      await page.click('#dash-verify [data-verify="check"]');
      await page.waitForTimeout(400);
      T.ok(/belum terverifikasi/.test(await page.textContent('#dash-verify-status')) && !(await page.$eval('#dash-verify', el => el.hidden)), 'not yet verified → explains (check Spam) and keeps the notice');
      await page.evaluate(() => window.__fstub.verifyEmail('calon@contoh.id'));
      await page.click('#dash-verify [data-verify="check"]');
      await page.waitForFunction(() => document.getElementById('dash-verify').hidden, null, { timeout: 6000 }).catch(() => {});
      const after = await page.evaluate(() => ({ hidden: document.getElementById('dash-verify').hidden, email: window.__fstub.console.get('members/' + window.__fstub.uid()).email, toast: document.querySelector('.toast-region')?.textContent || '' }));
      T.ok(after.hidden && after.email === 'calon@contoh.id' && /terverifikasi/.test(after.toast), 'after the link: "Saya Sudah Memverifikasi" hides the notice, member.email filled, success toast', after);
    }
    T.ok(!issues.length, `${vp.name}: no console error`, issues);
    await ctx.close();
  }
  const { ctx, page, issues } = await fbPage(SEED, 'pendaftaran.html#data-diri');
  await page.waitForSelector('#f-email-hint', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  T.ok(/belum diverifikasi/.test(await page.textContent('#f-email-hint')) && (await page.inputValue('#f-email')) === 'calon@contoh.id', 'pendaftaran Data Diri: the account e-mail is shown with a "belum diverifikasi" hint', await page.textContent('#f-email-hint'));
  T.ok(!issues.length, 'pendaftaran (Firebase): no console error', issues);
  await ctx.close();
}
await fbBrowser.close();
fbServer.close();
T.done();
