// aplikasi-flow — member apps (SPEC-v2 §4.4): gate, portal bar, planning-app SSO + stages + regression values
// (ANALISIS_PERENCANAAN §2.8), bug fixes, security, and simulator steps.
// usage (cwd devtools): node flows/aplikasi-flow.mjs [--only=A,B,C,D,E] [--no-net]
//   sections: A gate + portal bar · B SSO + per-member data · C planning app (stages, reference values, bug fixes,
//   security, print, mobile) · D simulator (desktop, mobile, no-WebGL) · E axe-core.  Default: all five.
//   --no-net skips the checks that need cdnjs (jsPDF, three.js, axe-core): the PDF check in C, all of D and E.
//   The summary line names the sections that ran and the count per section, e.g.
//   "aplikasi-flow [--only=A,B,C,D,E]: n/n passed  (A …/… · B …/… · C …/… · D …/… · E …/…)" — quote it as printed.
import fs from 'node:fs';
import { startServer, launch, newContext, seedSession, setSession, watch, recorder, shot,
  simClick, simDrawn, simGeometries, DEMO_USER, DEMO_USER_B, DEMO_ADMIN } from './aplikasi-lib.mjs';
import * as REF from './aplikasi-perencanaan-ref.mjs';   // perhitungan acuan independen (tidak memanggil app.js)

const args = process.argv.slice(2);
const only = (args.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const NET = !args.includes('--no-net');
const run = (k) => !only.length || only.includes(k);
// sections that actually run (D and E need cdnjs) — printed in the summary line, so a report can quote
// "aplikasi-flow [--only=…]: n/n" for exactly the sections it ran
const SECTIONS = ['A', 'B', 'C', 'D', 'E'].filter(k => run(k) && (NET || !['D', 'E'].includes(k)));
const T = recorder('aplikasi-flow', { scope: `[--only=${SECTIONS.join(',')}${NET ? '' : '; --no-net'}]` });
console.log(`aplikasi-flow: sections ${SECTIONS.join(', ') || '(none)'}${!NET && (run('D') || run('E')) ? ' (D, E skipped: --no-net)' : ''}`);
const { server, BASE } = await startServer();
const browser = await launch();
const PR = `${BASE}/aplikasi/perencanaan/index.html`;
const SIM = `${BASE}/aplikasi/simulator/index.html`;
const gateOk = (page) => page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'), null, { timeout: 30000 });
const noIssues = (label, issues) => T.ok(issues.length === 0, `${label}: no console errors / page errors / failed requests`, issues.slice(0, 4));
const txt = (page, sel) => page.$eval(sel, el => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
async function setVal(page, id, v) {
  await page.evaluate(({ id, v }) => {
    const e = document.getElementById(id); e.value = v;
    e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }));
  }, { id, v });
}
/* Simulator memory checks (B8): every geometry count is read in a settled state — simClick() waits until the click
   was drawn, simDrawn() until pending changes are drawn (aplikasi-lib.mjs explains the race: read straight after a
   click, the count misses the new model, e.g. 6 → 40). */
async function menuGo(page, v) {
  await page.click('#menu-btn');
  await page.click(`#menu-panel .tab[data-v="${v}"]`);
  await page.waitForTimeout(120);
}

/* ======================================================================
   A. Gerbang & bilah portal
   ====================================================================== */
if (run('A')) {
  T.section('A1 signed out → masuk.html?next=…, no flash of app content');
  for (const [app, url] of [['perencanaan', PR], ['simulator', SIM]]) {
    const ctx = await newContext(browser, 'desktop');
    await ctx.addInitScript(() => {
      document.addEventListener('DOMContentLoaded', () => {
        if (!/\/aplikasi\//.test(location.pathname)) return;
        const m = document.getElementById('app-main');
        window.__dcl = { pending: document.documentElement.classList.contains('app-gate-pending'), vis: m ? getComputedStyle(m).visibility : 'none', gate: getComputedStyle(document.getElementById('app-gate')).display };
        try { sessionStorage.setItem('__dcl_' + location.pathname, JSON.stringify(window.__dcl)); } catch (e) {}
      });
    });
    const page = await ctx.newPage();
    const issues = watch(page);
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.waitForURL(/masuk\.html/, { timeout: 15000 }).catch(() => {});
    const u = new URL(page.url());
    T.ok(u.pathname.endsWith('/masuk.html') && u.searchParams.get('next') === `aplikasi/${app}/index.html`, `${app}: redirected to masuk.html?next=aplikasi/${app}/index.html`, page.url());
    const dcl = await page.evaluate((p) => JSON.parse(sessionStorage.getItem('__dcl_' + p) || 'null'), `/aplikasi/${app}/index.html`);
    T.ok(dcl && dcl.pending && dcl.vis === 'hidden' && dcl.gate !== 'none', `${app}: app hidden behind the gate screen at DOMContentLoaded`, dcl);
    noIssues(`${app} signed-out`, issues);
    await ctx.close();
  }

  T.section('A2 non-active statuses → dashboard.html + flash toast (both apps)');
  for (const status of ['Draf', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Ditolak', 'Nonaktif', 'Kedaluwarsa']) {
    for (const [app, url] of [['perencanaan', PR], ['simulator', SIM]]) {
      const ctx = await newContext(browser, 'desktop');
      await seedSession(ctx, { status });
      const page = await ctx.newPage();
      const issues = watch(page);
      const three = [];
      page.on('request', r => { if (/three(\.min)?\.js/.test(r.url())) three.push(r.url()); });
      await page.goto(url, { waitUntil: 'networkidle' });
      await page.waitForURL(/dashboard\.html/, { timeout: 15000 }).catch(() => {});
      const toast = await page.waitForSelector('.toast__msg', { timeout: 5000 }).then(h => h.textContent()).catch(() => '');
      T.ok(new URL(page.url()).pathname.endsWith('/dashboard.html') && /khusus anggota berstatus Aktif/.test(toast), `${status} · ${app}: → dashboard.html with toast`, { url: page.url(), toast });
      if (app === 'simulator') T.ok(three.length === 0, `${status} · simulator: three.js never requested`, three);
      noIssues(`${status} · ${app}`, issues);
      await ctx.close();
    }
  }

  T.section('A3 active member: app shown, portal bar, keyboard');
  {
    const ctx = await newContext(browser, 'desktop');
    await seedSession(ctx, {});
    const page = await ctx.newPage();
    const issues = watch(page);
    await page.goto(PR, { waitUntil: 'networkidle' });
    await gateOk(page);
    T.ok(await page.$eval('#app-gate', el => getComputedStyle(el).display === 'none'), 'gate screen hidden after verification');
    const bar = await page.evaluate(() => {
      const b = document.getElementById('pp-bar');
      return b && { tag: b.tagName, label: b.getAttribute('aria-label'), back: b.querySelector('.pp-bar__back').href, title: b.querySelector('.pp-bar__title-long').textContent,
        name: b.querySelector('.pp-bar__name').textContent, badge: b.querySelector('.pp-bar__badge').textContent, user: b.querySelector('.pp-bar__user').href,
        demo: !!b.querySelector('.pp-bar__demo'), first: document.body.firstElementChild.id };
    });
    T.ok(bar && bar.tag === 'NAV' && bar.label === 'Portal Anggota PPAPI', 'portal bar is a labelled <nav>', bar);
    T.ok(bar && bar.back.endsWith('/dashboard.html'), '"← Portal Anggota" links to dashboard.html', bar && bar.back);
    T.ok(bar && bar.title === 'PPAPI Scaffold (Beta) — Perencanaan & Analisis Struktur', 'bar shows the app title with the Beta mark (data-app-title)', bar && bar.title);
    T.ok(bar && bar.name === 'Rahmat Hidayat' && bar.badge === 'Aktif', 'bar shows member name + Aktif badge', bar);
    T.ok(bar && bar.user.endsWith('/anggota.html') && bar.demo, 'name links to profile; Mode Demo chip present', bar);
    // does not cover app UI (scroll 0 and scrolled)
    const geo = await page.evaluate(() => { const b = document.getElementById('pp-bar').getBoundingClientRect(); const h = document.querySelector('body > header').getBoundingClientRect(); return { bb: b.bottom, ht: h.top }; });
    T.ok(geo.ht >= geo.bb - 0.5, 'app header starts below the bar', geo);
    await page.evaluate(() => go('checklist'));
    await page.evaluate(() => window.scrollTo(0, 1400));
    await page.waitForTimeout(200);
    const geo2 = await page.evaluate(() => { const b = document.getElementById('pp-bar').getBoundingClientRect(); const h = document.querySelector('body > header').getBoundingClientRect(); const p = document.querySelector('#v-checklist .prog-wrap').getBoundingClientRect(); return { bb: b.bottom, bt: b.top, ht: h.top, hb: h.bottom, pt: p.top }; });
    T.ok(geo2.bt === 0 && Math.abs(geo2.ht - geo2.bb) < 1 && geo2.pt >= geo2.hb - 1, 'scrolled: bar sticks at top, header right below, checklist progress below header', geo2);
    await page.evaluate(() => { go('beranda'); window.scrollTo(0, 0); });
    // keyboard: skip link then back link
    await page.keyboard.press('Tab');
    const f1 = await page.evaluate(() => ({ cls: document.activeElement.className, text: document.activeElement.textContent }));
    T.ok(/pp-skip/.test(f1.cls) && f1.text === 'Lewati ke aplikasi', 'first Tab → "Lewati ke aplikasi" skip link', f1);
    await page.keyboard.press('Tab');
    const f2 = await page.evaluate(() => { const a = document.activeElement; return { cls: a.className, outline: getComputedStyle(a).outlineStyle, name: a.getAttribute('aria-label') }; });
    T.ok(/pp-bar__back/.test(f2.cls) && f2.outline !== 'none', 'second Tab → back link with visible focus ring', f2);
    T.ok(f2.name === 'Kembali ke Portal Anggota (dasbor)', 'back link accessible name', f2.name);
    await page.keyboard.press('Shift+Tab');
    await page.keyboard.press('Enter');
    const focusedMain = await page.evaluate(() => location.hash === '#app-main' || document.activeElement.id === 'app-main');
    T.ok(focusedMain, 'skip link moves to #app-main');
    await page.evaluate(() => document.querySelector('.pp-bar__back').focus());
    await Promise.all([page.waitForURL(/dashboard\.html/), page.keyboard.press('Enter')]);
    T.ok(new URL(page.url()).pathname.endsWith('/dashboard.html'), 'Enter on back link opens dashboard.html');
    noIssues('active member app + bar', issues);
    await shot(page, 'apl-flow-dashboard-after-back');
    await ctx.close();
  }

  T.section('A4 simulator: bar offsets the 3D stage');
  {
    const ctx = await newContext(browser, 'desktop');
    await seedSession(ctx, {});
    const page = await ctx.newPage();
    const issues = watch(page);
    await page.goto(SIM, { waitUntil: 'networkidle' });
    await gateOk(page);
    const g = await page.evaluate(() => ({ bar: document.getElementById('pp-bar').getBoundingClientRect().bottom, stage: document.getElementById('app-main').getBoundingClientRect().top, intro: document.getElementById('intro').getBoundingClientRect().top, title: document.querySelector('.pp-bar__title-long').textContent }));
    T.ok(Math.abs(g.bar - g.stage) < 1 && Math.abs(g.bar - g.intro) < 1, 'stage and intro start exactly below the bar', g);
    T.ok(g.title === 'Simulator Pemasangan Perancah Tube & Coupler', 'simulator bar title', g.title);
    noIssues('simulator intro', issues);
    await ctx.close();
  }

  T.section('A5 admin: both apps open, Admin badge');
  {
    const ctx = await newContext(browser, 'desktop');
    await seedSession(ctx, { admin: true });
    const page = await ctx.newPage();
    const issues = watch(page);
    for (const url of [PR, SIM]) {
      await page.goto(url, { waitUntil: 'networkidle' });
      await gateOk(page);
      const b = await txt(page, '.pp-bar__badge');
      T.ok(b === 'Admin', `admin badge on ${url.includes('simulator') ? 'simulator' : 'perencanaan'}`, b);
    }
    noIssues('admin apps', issues);
    await ctx.close();
  }

  T.section('A6 sign in from masuk.html?next=… returns to the app; sign out from the bar');
  {
    const ctx = await newContext(browser, 'desktop');
    const page = await ctx.newPage();
    const issues = watch(page);
    await page.goto(PR, { waitUntil: 'networkidle' });
    await page.waitForURL(/masuk\.html/);
    await page.fill('#m-email', 'admin@ppapi.demo');
    await page.fill('#m-pass', 'AdminPPAPI2026');
    await Promise.all([page.waitForURL(/aplikasi\/perencanaan\/index\.html/, { timeout: 15000 }), page.click('#masuk-email-pane button[type=submit]')]);
    await gateOk(page);
    T.ok(true, 'after sign-in the planning app opens (next= honoured)');
    await Promise.all([page.waitForURL(/index\.html$/, { timeout: 15000 }), page.click('[data-pp-signout]')]);
    T.ok(new URL(page.url()).pathname === '/index.html', 'bar "Keluar" signs out → index.html', page.url());
    const sess = await page.evaluate(() => localStorage.getItem('ppapi_demo_session') || sessionStorage.getItem('ppapi_demo_session'));
    T.ok(!sess, 'demo session cleared');
    await page.goto(PR, { waitUntil: 'networkidle' });
    await page.waitForURL(/masuk\.html/);
    T.ok(true, 'app afterwards redirects to masuk.html again');
    noIssues('sign-in/out', issues);
    await ctx.close();
  }

  T.section('A7 membership deactivated while the app is open → dashboard');
  {
    const ctx = await newContext(browser, 'desktop');
    await seedSession(ctx, {});
    const page = await ctx.newPage();
    const issues = watch(page);
    await page.goto(SIM, { waitUntil: 'networkidle' });
    await gateOk(page);
    await page.evaluate(() => { const k = 'ppapi_member_demo-uji-0001'; const m = JSON.parse(localStorage.getItem(k)); m.status = 'Nonaktif'; localStorage.setItem(k, JSON.stringify(m)); PPAPI.session.refresh(); });
    await page.waitForURL(/dashboard\.html/, { timeout: 15000 }).catch(() => {});
    T.ok(new URL(page.url()).pathname.endsWith('/dashboard.html'), 'session refresh with Nonaktif → leaves the app', page.url());
    noIssues('deactivate while open', issues);
    await ctx.close();
  }
}

/* ======================================================================
   B. Aplikasi perencanaan: SSO
   ====================================================================== */
if (run('B')) {
  T.section('B1 SSO identity, no local login, namespaced storage, legacy secrets purged');
  const ctx = await newContext(browser, 'desktop');
  await seedSession(ctx, {});
  await ctx.addInitScript(() => {
    if (!sessionStorage.getItem('__legacy_seeded')) {
      sessionStorage.setItem('__legacy_seeded', '1');
      localStorage.setItem('ppapi_session', JSON.stringify({ m: 'local', id: 'admin' }));
      localStorage.setItem('ppapi_users', JSON.stringify({ admin: { p: 'h16yzmn0', role: 'admin' } }));
      localStorage.setItem('ppapi_remote', JSON.stringify({ url: 'https://x.upstash.io', token: 'SECRET', on: true }));
    }
  });
  const page = await ctx.newPage();
  const issues = watch(page);
  await page.goto(PR, { waitUntil: 'networkidle' });
  await gateOk(page);
  const st = await page.evaluate(() => ({
    login: !!document.getElementById('login-screen'), sb: !!document.getElementById('bk-url'), up: !!document.getElementById('rm-token'),
    tabAdmin: document.getElementById('tab-admin').hidden, name: document.querySelector('[data-sso="name"]').textContent,
    role: document.querySelector('.sso-line [data-sso="role"]').textContent, kta: document.querySelector('.sso-line [data-sso="kta"]').textContent,
    insp: document.getElementById('f-inspektor').value,
    keys: Object.keys(localStorage), KEY,
  }));
  T.ok(!st.login && !st.sb && !st.up, 'no app login screen, no Supabase/Upstash panels', st);
  T.ok(st.tabAdmin === true, 'member: Admin menu hidden');
  T.ok(st.name === 'Rahmat Hidayat' && st.role === 'Pengguna (anggota Aktif)' && st.kta === 'KTA PPAPI-2026-004821', 'SSO user shown inside the app (name, role, KTA)', st);
  T.ok(st.insp === 'Rahmat Hidayat · KTA PPAPI-2026-004821', 'inspector field auto-filled from the PPAPI account', st.insp);
  T.ok(st.KEY === 'ppapi_app_perencanaan_v1_u_demo-uji-0001' && st.keys.includes(st.KEY), 'per-member storage key', st.KEY);
  T.ok(!st.keys.some(k => ['ppapi_session', 'ppapi_users', 'ppapi_remote'].includes(k)), 'legacy session/user/Upstash keys purged', st.keys);

  T.section('B2 per-member data isolation in one browser');
  await setVal(page, 'f-proyek', 'Menara Uji A');
  await page.evaluate(() => saveProject());
  await page.waitForTimeout(200);
  const listA = await txt(page, '#proj-list');
  T.ok(/Menara Uji A/.test(listA), 'member A sees own saved project', listA);
  await setSession(page, { user: DEMO_USER_B });
  await page.reload({ waitUntil: 'networkidle' });
  await gateOk(page);
  const b = await page.evaluate(() => ({ proj: document.getElementById('f-proyek').value, list: document.getElementById('proj-list').textContent, name: document.querySelector('[data-sso="name"]').textContent, KEY }));
  T.ok(b.name === 'Wulan Prasetyo' && b.proj === '' && !/Menara Uji A/.test(b.list) && b.KEY.endsWith('u_demo-uji-0002'), 'member B does not see member A\'s data', b);
  await setSession(page, { user: DEMO_USER, admin: false });
  await setSession(page, { admin: true });
  await page.reload({ waitUntil: 'networkidle' });
  await gateOk(page);
  await page.evaluate(() => go('admin'));
  const adm = await page.evaluate(() => ({ hidden: document.getElementById('tab-admin').hidden, rows: document.getElementById('user-rows').textContent, link: document.querySelector('#v-admin a[href$="admin.html"]') !== null, role: document.querySelector('.sso-line [data-sso="role"]').textContent }));
  T.ok(!adm.hidden && adm.role === 'Admin aplikasi (admin PPAPI)', 'PPAPI admin → app admin role + Admin menu', adm);
  T.ok(/Rahmat Hidayat/.test(adm.rows) && /Wulan Prasetyo/.test(adm.rows) && adm.link, 'admin view lists members using this browser + link to Konsol Admin', adm.rows);
  await shot(page, 'apl-flow-pr-admin');
  noIssues('SSO', issues);
  await ctx.close();
}

/* ======================================================================
   C. Aplikasi perencanaan: tahapan, nilai acuan §2.8, perbaikan bug, keamanan
   ====================================================================== */
if (run('C')) {
  const ctx = await newContext(browser, 'desktop');
  await seedSession(ctx, {});
  const page = await ctx.newPage();
  const issues = watch(page);
  await page.goto(PR, { waitUntil: 'networkidle' });
  await gateOk(page);

  T.section('C1 stage navigation through the menu (9 stages)');
  const stages = ['proyek', 'beban', 'duty', 'gambar', 'material', 'analisis', 'jsa', 'checklist', 'laporan'];
  for (const v of stages) {
    await menuGo(page, v);
    const ok = await page.evaluate(v => document.getElementById('v-' + v).classList.contains('active') && document.getElementById('menu-btn').getAttribute('aria-expanded') === 'false', v);
    T.ok(ok, `menu → ${v}`);
  }
  T.ok(/9 Tahap/.test(await txt(page, '#v-beranda')), 'home card says "9 Tahap" (was "8")');

  T.section('C2 regression values — corrected method v2.3.0 Beta (expected values from flows/aplikasi-perencanaan-ref.mjs)');
  const nfi = (v, d = 0) => Number(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
  const REFC = REF.corrected(REF.REF), LL0 = REF.liveLoadCorrected({}), LL1 = REF.liveLoadCorrected({ org: 4, mat: 300 });
  await menuGo(page, 'beban');
  let s = await txt(page, '#ll-stats'), st2 = await txt(page, '#ll-status');
  T.ok(s.includes(nfi(LL0.bay) + ' kg') && /MEDIUM DUTY/.test(st2) && !/SF/.test(s), `live load default: worst bay ${nfi(LL0.bay)} kg → ${LL0.cls} (no SF; legacy 645 kg / 3 bay → Light)`, { s, st2 });
  await setVal(page, 'll-org', '4'); await setVal(page, 'll-mat', '300');
  s = await txt(page, '#ll-stats'); st2 = await txt(page, '#ll-status');
  T.ok(s.includes(nfi(LL1.bay) + ' kg') && /SPECIAL DUTY/.test(st2) && st2.includes(nfi(LL1.kn, 1) + ' kN'), `4 workers + 300 kg on one bay: ${nfi(LL1.bay)} kg → ${LL1.cls} ${LL1.kn} kN (legacy averaged to 399 kg/bay → Medium)`, { s, st2 });
  await setVal(page, 'll-org', '2'); await setVal(page, 'll-mat', '150');
  await menuGo(page, 'duty');
  s = await txt(page, '#duty-stats'); const fxl = await txt(page, '#fx-live');
  T.ok(s.includes(nfi(REF.totals(REF.REF).live) + ' kg') && /UDL 156 kg\/m²/.test(fxl), 'Medium, 3 bay × 1 platform kerja + 50 % satu lift berpapan (BS EN 12811-1 §6.2.9.2): live ' + nfi(REF.totals(REF.REF).live) + ' kg, UDL 156 kg/m²', { s, fxl });
  const sta = await txt(page, '#an-checks-sta');
  T.ok(sta.includes(`${nfi(REFC.bearing)} kg/m² > daya dukung izin 10.000`), `E13 + E8: failing foundation check reads ">" and uses N max (q ${nfi(REFC.bearing)} kg/m²)`, sta.slice(0, 240));
  await menuGo(page, 'analisis');
  s = await txt(page, '#an-dead'); const ans = await txt(page, '#an-stats'), klem = await txt(page, '#fx-klem');
  T.ok(s.includes(nfi(REFC.NmaxKg) + ' kg') && s.includes(nfi(REFC.B.Nperm, 2) + ' kN') && klem.includes(nfi(REFC.coupler.kN, 2) + ' kN') && klem.includes('6,06 kN'),
    `reference case: N max ${nfi(REFC.NmaxKg)} kg, N_izin ${nfi(REFC.B.Nperm, 2)} kN, coupler ${nfi(REFC.coupler.kN, 2)} kN vs 6,06 kN`, { s, ans, klem: klem.slice(-160) });
  T.ok(/belum diisi di Data Proyek/.test(await txt(page, '#geom-hint-an')), 'E2: note when lifts/height are not filled (geometry defaults stated)');
  await setVal(page, 'f-nbay', '4'); await setVal(page, 'f-lbay', '2.4'); await setVal(page, 'f-lebar', '1.2'); await setVal(page, 'f-tinggi', '8'); await setVal(page, 'f-hlift', '2');
  const C4 = { ...REF.REF, nb: 4 }, M4 = REF.materialEstimate(C4), R4 = REF.corrected(C4), T4 = REF.totals(C4);
  await menuGo(page, 'material');
  await page.click('#v-material button:has-text("Estimasi Otomatis")');
  s = await txt(page, '#mat-stats'); const gl = await txt(page, '#gl-stats');
  T.ok(s.includes(String(M4.rows)) && s.includes(nfi(M4.pcs)) && s.includes(nfi(M4.Wd) + ' kg') && gl.includes(nfi(T4.total) + ' kg'),
    `auto estimate 4 × 2,4 × 1,2 m, H 8 m: ${M4.rows} komponen, ${M4.pcs} pcs, ${nfi(M4.Wd)} kg, gross ${nfi(T4.total)} kg (no ×FK)`, { s, gl });
  await menuGo(page, 'analisis');
  const ans2 = await txt(page, '#an-stats'), klem2 = await txt(page, '#fx-klem');
  T.ok(ans2.includes(nfi(R4.NmaxKg) + ' kg') && ans2.includes(nfi(R4.NmaxKN, 2) + ' kN') && klem2.includes(nfi(R4.coupler.kN, 2) + ' kN'),
    `4 bay: N max ${nfi(R4.NmaxKg)} kg (${nfi(R4.NmaxKN, 2)} kN), coupler ${nfi(R4.coupler.kN, 2)} kN`, { ans2, klem2: klem2.slice(-140) });
  const gone = await page.evaluate(() => ['an-tiang', 'an-nklem', 'an-kaptiang', 'an-fk', 'an-bay', 'll-sf'].filter(id => document.getElementById(id)));
  T.ok(gone.length === 0, 'free inputs for tiang/klem/bay counts, fixed 2.500 kg capacity, FK and SF removed (E2/E3/E6)', gone);

  T.section('C3 checklist verdicts');
  await menuGo(page, 'checklist');
  await page.click('#v-checklist button:has-text("Tandai semua Sesuai")');
  T.ok((await txt(page, '#prog-verdict')) === 'HIJAU', 'all OK → HIJAU');
  await page.click('#item-0-0 .ab:has-text("Tidak")');
  T.ok((await txt(page, '#prog-verdict')) === 'MERAH', 'one critical "Tidak" → MERAH');
  T.ok(await page.$eval('#item-0-0 .ab:nth-child(2)', b => b.getAttribute('aria-pressed') === 'true'), 'answer button exposes aria-pressed');
  await page.click('#item-0-0 .ab:has-text("Sesuai")');
  await page.click('#item-0-1 .ab:has-text("Tidak")');
  T.ok((await txt(page, '#prog-verdict')) === 'KUNING', 'one non-critical "Tidak" → KUNING');

  T.section('C4 Laporan: ringkasan (B1) + kesimpulan (B2) + PDF (B7/B8)');
  await menuGo(page, 'laporan');
  const ring = await txt(page, '#ringkasan-root');
  T.ok(/KUNING/.test(ring) && /Skor per Kategori/i.test(ring), 'B1: summary rendered on Laporan & Tagging', ring.slice(0, 80));
  await page.click('#v-laporan button:has-text("Buat Otomatis")');
  const kes = await page.$eval('#f-kesimpulan', e => e.value);
  T.ok(!/undefined/.test(kes) && /52\/52 item dinilai/.test(kes), 'B2: conclusion says "52/52 item dinilai" (no "undefined")', kes.slice(0, 160));
  if (NET) {
    await page.evaluate(() => { go('gambar'); dwgAdd('pipe', 5, 45, { len: 4, rot: 90 }); dwgAdd('pipe', 7, 45, { len: 4, rot: 90 }); dwgAdd('pipe', 6, 44, { len: 2 }); go('laporan'); });
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#v-laporan [data-pdf-btn]')]);
    const p = await dl.path();
    const size = fs.statSync(p).size;
    T.ok(size > 20000 && size < 2 * 1024 * 1024, `B7: PDF with drawing < 2 MB (${Math.round(size / 1024)} KB)`, size);
    T.ok(/^Laporan_Perancah_/.test(dl.suggestedFilename()), 'PDF file name', dl.suggestedFilename());
  }

  T.section('C5 B4: stage 2–6 inputs survive a reload');
  await setVal(page, 'll-org', '5');
  await setVal(page, 'an-kurva', 'a'); await setVal(page, 'an-kle', '1.2');
  await page.waitForTimeout(700);
  const before = await page.evaluate(() => matRows.length);
  await page.reload({ waitUntil: 'networkidle' });
  await gateOk(page);
  const after = await page.evaluate(() => ({ org: document.getElementById('ll-org').value, kurva: document.getElementById('an-kurva').value, kle: document.getElementById('an-kle').value, mats: matRows.length, nbay: document.getElementById('f-nbay').value }));
  T.ok(after.org === '5' && after.kurva === 'a' && after.kle === '1.2' && after.mats === before && after.mats === REF.materialEstimate({ ...REF.REF, nb: 4 }).rows && after.nbay === '4', 'll-org 5, buckling curve a, k 1,2, material rows (geometry estimate), f-nbay 4 restored', after);

  T.section('C6 B5: "Proyek Baru" clears everything open');
  await page.evaluate(() => {
    state.photos['0-0'] = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ=='; savePhotos();
    state.plans = [{ name: 'a.png', type: 'image/png', data: 'data:image/png;base64,iVBORw0KGgo=', ts: 1 }]; savePlans();
    go('gambar'); dwgAdd('pipe', 5, 45, { len: 2 });
  });
  await menuGo(page, 'laporan');
  page.once('dialog', d => d.accept());
  await page.click('#v-laporan button:has-text("Proyek Baru")');
  await page.waitForTimeout(300);
  const cleared = await page.evaluate(() => ({ photos: Object.keys(state.photos).length, plans: state.plans.length, dwg: DWG.depan.length + DWG.samping.length + DWG.atas.length, mats: matRows.length, org: document.getElementById('ll-org').value, kurva: document.getElementById('an-kurva').value, answers: Object.keys(state.answers).length, nbay: document.getElementById('f-nbay').value, ph: localStorage.getItem(KEY + '_photos'), insp: document.getElementById('f-inspektor').value }));
  T.ok(cleared.photos === 0 && cleared.plans === 0 && cleared.dwg === 0 && cleared.mats === REF.materialEstimate(REF.REF).rows && cleared.org === '2' && cleared.kurva === 'c' && cleared.answers === 0 && cleared.nbay === '3' && cleared.ph === null, 'photos, uploads, drawing, analysis, materials (estimate for default geometry), answers reset to defaults', cleared);
  T.ok(cleared.insp === 'Rahmat Hidayat · KTA PPAPI-2026-004821', 'inspector re-filled from SSO after reset', cleared.insp);

  T.section('C7 security: stored/imported data never executes');
  const X = '<img src=x onerror="window.__xss=1">';
  await setVal(page, 'f-proyek', X);
  await setVal(page, 'f-lokasi', '"><svg onload="window.__xss=2">');
  await setVal(page, 'f-tag', '<b onmouseover=window.__xss=7>T</b>');
  await page.evaluate((X) => { setMat(0, 'n', '"><img src=x onerror="window.__xss=3">'); renderAnalisis(); saveProject(); go('laporan'); go('proyek'); }, X);
  const evil = {
    v: 1, answers: { '0-0': 'ok', '99-1': 'ok', '0-1': '<x>' }, photos: { '0-0': 'javascript:window.__xss=4', '0-1': 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' },
    plans: [{ name: '<img src=x onerror="window.__xss=5">', type: 'image/png', data: 'data:text/html,<script>window.__xss=6</script>' }, { name: 'ok"><img src=x onerror=window.__xss=8>.png', type: 'image/png', data: 'data:image/png;base64,iVBORw0KGgo=' }],
    dwg: { _w: 2, depan: [{ id: '1" onmouseover="window.__xss=9', t: 'pipe', x: 1, y: 45, len: 2 }, { id: 5, t: 'note', x: 2, y: 44, txt: '<img src=x onerror=window.__xss=10>' }], samping: [], atas: [] },
    jsa: [{ step: '</textarea><img src=x onerror=window.__xss=11>', cat: '<b>', hazard: 'h', control: 'c' }],
    analisis: { vals: { 'an-tiang': '"><img src=x onerror=window.__xss=12>' }, mats: [{ n: '"><img src=x onerror=window.__xss=13>', q: '2', w: 1 }] },
    fields: { 'f-proyek': X },
  };
  await menuGo(page, 'laporan');
  await page.setInputFiles('#imp', { name: 'evil.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(evil)) });
  await page.waitForTimeout(500);
  for (const v of ['proyek', 'gambar', 'material', 'jsa', 'checklist', 'laporan']) { await page.evaluate(v => go(v), v); await page.waitForTimeout(80); }
  await page.hover('#dwg-svg').catch(() => {});
  const sec = await page.evaluate(() => ({ xss: window.__xss, imgX: document.querySelectorAll('img[src="x"]').length, svgOn: document.querySelectorAll('svg[onload]').length, plans: state.plans.length, photos: Object.keys(state.photos), ids: DWG.depan.map(i => i.id) }));
  T.ok(sec.xss === undefined && sec.imgX === 0 && sec.svgOn === 0, 'no payload executed or injected', sec);
  T.ok(sec.plans === 1 && sec.photos.length === 0 && sec.ids.every(i => typeof i === 'number'), 'import validated: bad upload/photo dropped, drawing ids numeric', sec);

  T.section('C8 print, service worker, simulator link');
  await page.emulateMedia({ media: 'print' });
  const pr = await page.evaluate(() => ({ fab: getComputedStyle(document.querySelector('.fab')).display, bar: getComputedStyle(document.getElementById('pp-bar')).display, nav: getComputedStyle(document.querySelector('body > header')).display, hz: document.querySelectorAll('.hazard').length }));
  T.ok(pr.fab === 'none' && pr.bar === 'none' && pr.nav === 'none' && pr.hz === 0, 'B9: FAB, app header and portal bar hidden in print; hazard stripe no longer exists (retheme Oktober 2026)', pr);
  await page.emulateMedia({ media: 'screen' });
  T.ok((await page.evaluate(() => navigator.serviceWorker ? navigator.serviceWorker.getRegistrations().then(r => r.length) : 0)) === 0, 'no service worker registered under /aplikasi/');
  T.ok(!(await page.evaluate(() => typeof SIM_B64 !== 'undefined' || !!document.getElementById('sim-frame'))), 'embedded base64 simulator + blob iframe removed');
  const fab = await page.$eval('.fab', a => a.href);
  T.ok(fab.endsWith('/aplikasi/simulator/index.html'), 'FAB links to the simulator app', fab);
  await Promise.all([page.waitForURL(/aplikasi\/simulator/), page.click('.fab')]);
  await gateOk(page);
  T.ok(true, 'FAB opens the gated simulator');
  noIssues('planning stages', issues);
  await ctx.close();

  T.section('C9 B3: default date is the LOCAL date at 01:30 WIB');
  {
    const c2 = await newContext(browser, 'desktop');
    await seedSession(c2, {});
    const p2 = await c2.newPage();
    await p2.clock.install({ time: new Date('2026-10-09T01:30:00+07:00') });
    await p2.goto(PR, { waitUntil: 'load' });
    await gateOk(p2);
    const d = await p2.$eval('#f-tanggal', e => e.value);
    T.ok(d === '2026-10-09', 'f-tanggal = 2026-10-09 (legacy UTC gave 2026-10-08)', d);
    await c2.close();
  }

  T.section('C10 mobile 390px: no sideways scroll, touch targets, header not sticky');
  {
    const c3 = await newContext(browser, 'mobile');
    await seedSession(c3, {});
    const p3 = await c3.newPage();
    const iss = watch(p3);
    await p3.goto(PR, { waitUntil: 'networkidle' });
    await gateOk(p3);
    for (const v of ['beranda', 'proyek', 'beban', 'duty', 'gambar', 'material', 'analisis', 'jsa', 'checklist', 'laporan', 'tentang']) {
      await p3.evaluate(v => go(v), v);
      await p3.waitForTimeout(60);
      const ov = await p3.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      T.ok(ov <= 1, `mobile ${v}: no horizontal overflow`, ov);
    }
    await p3.evaluate(() => go('checklist'));
    const m = await p3.evaluate(() => { const ab = document.querySelector('.ab').getBoundingClientRect(); window.scrollTo(0, 2000); return new Promise(r => setTimeout(() => { const pw = document.querySelector('#v-checklist .prog-wrap').getBoundingClientRect(); const bar = document.getElementById('pp-bar').getBoundingClientRect(); r({ abH: ab.height, abW: ab.width, pw: pw.top, bar: bar.bottom, hdr: getComputedStyle(document.querySelector('body > header')).position }); }, 200)); });
    T.ok(m.abH >= 44 && m.abW >= 44, 'answer buttons ≥ 44px', m);
    T.ok(m.hdr === 'static' && Math.abs(m.pw - m.bar) < 2, 'header scrolls away; checklist progress sticks under the bar', m);
    await shot(p3, 'apl-flow-pr-mobile-checklist-scrolled');
    noIssues('planning mobile', iss);
    await c3.close();
  }
}

/* ======================================================================
   D. Simulator
   ====================================================================== */
if (run('D') && NET) {
  for (const vp of ['desktop', 'mobile']) {
    T.section(`D (${vp}) simulator steps`);
    const ctx = await newContext(browser, vp);
    await seedSession(ctx, {});
    const page = await ctx.newPage();
    const issues = watch(page);
    await page.goto(SIM, { waitUntil: 'networkidle' });
    await gateOk(page);
    T.ok(await page.isVisible('#intro #startBtn'), 'intro with "Mulai Simulasi"');
    await page.waitForFunction(() => !!window.THREE, null, { timeout: 30000 });
    T.ok(await page.evaluate(() => THREE.REVISION === '128'), 'three.js r128 loaded after the gate (cdnjs + SRI)');
    await page.click('#startBtn');
    await page.waitForFunction(() => window.PPAPISim && document.querySelector('#app-main canvas'), null, { timeout: 30000 });
    const st = await page.evaluate(() => ({ mode: PPAPISim.mode, gl: !!PPAPISim.renderer.getContext(), intro: document.getElementById('intro').hidden, sel: document.getElementById('tab-lib').getAttribute('aria-selected'), role: document.getElementById('tabs').getAttribute('role') }));
    T.ok(st.mode === 'lib' && st.gl && st.intro && st.sel === 'true' && st.role === 'tablist', 'scene created; ARIA tabs; library module', st);
    // library + memory
    await simClick(page, '[data-lib="swivel"]');
    T.ok(/Klem Putar/.test(await txt(page, '.spec h3')) && await page.$eval('[data-lib="swivel"]', b => b.getAttribute('aria-pressed') === 'true'), 'library item selected (aria-pressed)');
    const g0 = await simGeometries(page);
    for (let i = 0; i < 6; i++) { await simClick(page, '[data-lib="fix"]'); await simClick(page, '[data-lib="swivel"]'); }
    const g1 = await simGeometries(page);
    T.ok(g1 - g0 <= 2, `B8: no geometry leak switching library models, each switch drawn (${g0} → ${g1})`);
    // keyboard tabs
    await page.focus('#tab-lib');
    await page.keyboard.press('ArrowRight');
    T.ok(await page.evaluate(() => PPAPISim.mode === 'build' && document.activeElement.id === 'tab-build' && document.getElementById('tab-build').getAttribute('aria-selected') === 'true'), 'ArrowRight on tabs → Perakitan');
    for (let i = 0; i < 3; i++) await page.click('#placeBtn');
    let prog = await page.evaluate(() => ({ cnt: document.querySelector('.prog .cnt').textContent, now: document.querySelector('.prog .bar').getAttribute('aria-valuenow'), saved: JSON.parse(localStorage.getItem('ppapi_progress_demo-uji-0001_simulator') || 'null') }));
    T.ok(prog.cnt === '3/20' && prog.now === '3' && prog.saved && prog.saved.current === 3, '3 steps placed; progressbar + saved progress', prog);
    await page.click('#undoBtn');
    T.ok((await txt(page, '.prog .cnt')) === '2/20', 'undo → 2/20');
    await page.focus('#app-main canvas');
    await page.keyboard.press('Enter');
    T.ok((await txt(page, '.prog .cnt')) === '3/20', 'Enter on focused canvas places the next component');
    const scroll = await page.$eval('#pBody', e => e.scrollTop);
    T.ok(scroll === 0, 'B11: panel scrolled to top after each step', scroll);
    await shot(page, `apl-flow-sim-${vp}-build3`);
    // resume after reload
    await page.reload({ waitUntil: 'networkidle' });
    await gateOk(page);
    const intro = await page.evaluate(() => ({ resume: document.getElementById('introResume').textContent, btn: document.getElementById('startBtn').textContent, restart: !document.getElementById('restartBtn').hidden }));
    T.ok(/3 dari 20 tahap selesai/.test(intro.resume) && /Lanjutkan Perakitan/.test(intro.btn) && intro.restart, 'reload → intro offers to resume at step 4', intro);
    await page.click('#startBtn');
    await page.waitForFunction(() => window.PPAPISim && PPAPISim.mode === 'build', null, { timeout: 30000 });
    T.ok((await txt(page, '.prog .cnt')) === '3/20' && /Tahap 4/.test(await txt(page, '.stepcard h3')), 'resumed at step 4 of 20');
    // inspection
    await page.click('#tab-insp');
    for (const k of ['vert', 'horz', 'dist', 'square', 'edge', 'stab']) await page.click(`[data-insp="${k}"]`);
    const ins = await page.evaluate(() => {
      const panel = document.getElementById('panel').getBoundingClientRect();
      const inside = [...document.querySelectorAll('.toggle .tlbl')].every(l => { const r = l.getBoundingClientRect(); return r.left >= panel.left - 1 && r.right <= panel.right + 1; });
      return { pressed: [...document.querySelectorAll('[data-insp]')].every(b => b.getAttribute('aria-pressed') === 'true'), labels: document.querySelectorAll('#labels .lbl').length, inside, tools: JSON.parse(localStorage.getItem('ppapi_progress_demo-uji-0001_simulator')).tools };
    });
    T.ok(ins.pressed && ins.labels >= 10, 'six measuring overlays on (aria-pressed) with 3D labels (state 3/20: standards only)', ins);
    T.ok(ins.inside, 'B1: toggle labels stay inside the panel', ins);
    T.ok(ins.tools.vert && ins.tools.horz && ins.tools.dist && ins.tools.square, 'inspection tools recorded in progress', ins.tools);
    await simDrawn(page);   // overlays drawn
    const gi0 = await simGeometries(page);
    for (let i = 0; i < 6; i++) await simClick(page, '[data-insp="vert"]');
    const gi1 = await simGeometries(page);
    T.ok(gi1 - gi0 <= 2, `B8: no geometry leak toggling overlays, each toggle drawn (${gi0} → ${gi1})`);
    if (vp === 'mobile') { await page.click('#camToggle'); T.ok(await page.$eval('#camToggle', b => b.getAttribute('aria-expanded') === 'true'), 'mobile: camera controls open from the toggle'); }
    await page.click('#workerBtn');
    await page.waitForTimeout(200);
    const tc = await page.evaluate(() => {
      const t = document.getElementById('toast'); const cs = getComputedStyle(t);
      const p = (c) => c.match(/[\d.]+/g).map(Number);
      const L = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
      const fg = L(p(cs.color)), bg = L(p(cs.backgroundColor));
      return { ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05), shown: t.classList.contains('show'), role: t.getAttribute('role') };
    });
    T.ok(tc.ratio >= 4.5 && tc.shown && tc.role === 'status', `B2: toast readable (contrast ${tc.ratio.toFixed(1)}:1) and announced`, tc);
    if (vp === 'mobile') {
      const cover = await page.evaluate(() => ['u', 'l', 'camReset', 'r', 'd', 'zoomIn', 'zoomOut', 'workerBtn', 'laserBtn'].every(id => { const b = document.getElementById(id); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e === b || b.contains(e); }));
      T.ok(cover, 'B3: every camera control is reachable (not under the panel)');
      await page.click('#sheetToggle');
      T.ok(await page.$eval('#sheetToggle', b => b.getAttribute('aria-expanded') === 'false'), 'sheet collapses (aria-expanded=false)');
      const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      T.ok(ov <= 1, 'mobile simulator: no horizontal overflow', ov);
    } else {
      const cover = await page.evaluate(() => ['u', 'camReset', 'zoomIn', 'laserBtn'].every(id => { const b = document.getElementById(id); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e === b || b.contains(e); }));
      T.ok(cover, 'B3: camera pad not covered by the panel (desktop)');
    }
    await shot(page, `apl-flow-sim-${vp}-insp`);
    noIssues(`simulator ${vp}`, issues);
    await ctx.close();
  }

  T.section('D-nowebgl: friendly message, no errors');
  {
    const ctx = await newContext(browser, 'desktop');
    await seedSession(ctx, {});
    await ctx.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/i.test(t) ? null : g.call(this, t, ...a); }; });
    const page = await ctx.newPage();
    const issues = watch(page);
    await page.goto(SIM, { waitUntil: 'networkidle' });
    await gateOk(page);
    await page.click('#startBtn');
    await page.waitForSelector('#sim-msg:not([hidden])', { timeout: 30000 });
    T.ok(/WebGL/.test(await txt(page, '#sim-msg')), 'B6: "tidak mendukung WebGL" message instead of a dead button');
    noIssues('no-WebGL', issues);
    await ctx.close();
  }
}

/* ======================================================================
   E. axe-core (serious + critical) on the ported apps
   ====================================================================== */
if (run('E') && NET) {
  const AXE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
  async function axe(page, label, include) {
    await page.addScriptTag({ url: AXE_URL });
    const r = await page.evaluate(async (inc) => {
      const res = await window.axe.run(inc ? { include: inc } : document, { resultTypes: ['violations'] });
      return res.violations.filter(v => v.impact === 'serious' || v.impact === 'critical')
        .map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, t: v.nodes.slice(0, 2).map(n => n.target.join(' ')) }));
    }, include || null);
    T.ok(r.length === 0, `axe ${label}: 0 serious/critical`, r);
    return r;
  }
  for (const vp of ['desktop', 'mobile']) {
    T.section(`E (${vp}) axe`);
    const ctx = await newContext(browser, vp);
    await seedSession(ctx, { admin: vp === 'desktop' });
    const page = await ctx.newPage();
    await page.goto(PR, { waitUntil: 'networkidle' });
    await gateOk(page);
    for (const v of ['beranda', 'proyek', 'beban', 'duty', 'material', 'analisis', 'jsa', 'checklist', 'laporan', 'tentang'].concat(vp === 'desktop' ? ['admin'] : [])) {
      await page.evaluate(v => go(v), v);
      await page.waitForTimeout(80);
      await axe(page, `perencanaan ${v}`);
    }
    await page.goto(SIM, { waitUntil: 'networkidle' });
    await gateOk(page);
    await axe(page, 'simulator intro');
    await page.click('#startBtn');
    await page.waitForFunction(() => window.PPAPISim && document.querySelector('#app-main canvas'), null, { timeout: 30000 });
    await axe(page, 'simulator library', ['#app-main']);
    await page.click('#tab-build');
    await axe(page, 'simulator build', ['#app-main']);
    await page.click('#tab-insp');
    await axe(page, 'simulator inspection', ['#app-main']);
    await ctx.close();
  }
}

await browser.close();
server.close();
process.exit(T.done() ? 1 : 0);
