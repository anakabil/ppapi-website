// Security lens v2 — open redirects via ?next= and DOM XSS via location.hash / query on every page.
// 1) signed in (guest gate on masuk.html redirects at once through util.safeNext)
// 2) signed out: sign in through the form (masuk.js explicitNext) and sign up (signUpTarget)
// 3) hash / query payloads on every page (as Aktif member and as admin)
// Run from devtools/:  node flows/sec-v2-redirect.mjs
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';

const { BASE, close } = await startServer();
const host = new URL(BASE).host;
const USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const MEMBER = { uid: USER.uid, name: USER.name, email: USER.email, phone: USER.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31', approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001', profile: {}, competencies: [], certificates: [], application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z' } };
const NEXT = [
  'https://evil.example/', '//evil.example/', '/\\evil.example/', '\\\\evil.example\\a.html', '\\/evil.example/a.html', 'javascript:alert(1)', 'JaVaScRiPt:alert(1)//a.html',
  'java\nscript:alert(1)', ' https://evil.example/a.html', 'https:evil.example/a.html', 'http:/evil.example/a.html', 'data:text/html,<script>alert(1)</script>.html',
  '%2F%2Fevil.example%2Fa.html', '/%2F/evil.example/a.html', '/evil.example/a.html', './/evil.example/a.html', 'a.html#//evil.example', 'index.html?u=https://evil.example',
  'aplikasi/perencanaan/index.html', 'aplikasi/simulator/index.html?x=1#y', 'aplikasi/../admin.html', 'aplikasi%2F..%2Fadmin.html', 'admin.html', 'anggota.html#kartu',
  'masuk.html?next=https://evil.example', 'MASUK.html', 'pendaftaran.html#<svg/onload=__x(1)>', 'evil.example/a.html', ' https://evil.example', '\thttps://evil.example', 'https://evil.example\\@' + 'x.html',
];
const browser = await chromium.launch();
function seedFn(s) {
  window.__hits = []; window.__x = i => window.__hits.push(i);
  try {
    if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1');
    localStorage.setItem('ppapi_demo_seed_v2', JSON.stringify({ v: 2 }));
    if (s.user) { localStorage.setItem('ppapi_demo_session', JSON.stringify(s.user)); localStorage.setItem('ppapi_member_' + s.user.uid, JSON.stringify(s.member)); }
    localStorage.setItem('ppapi_demo_admins', JSON.stringify(s.admins || []));
  } catch (e) {}
}
const verdict = (u) => { try { const x = new URL(u); return x.host === host ? (x.pathname.replace(/^\//, '') + x.search + x.hash) : 'EXTERNAL ' + u; } catch (e) { return 'BAD ' + u; } };

console.log('\n── 1) signed in → masuk.html?next=<v> (guest gate)');
let ext = 0;
for (const v of NEXT) {
  const ctx = await browser.newContext(); await ctx.addInitScript(seedFn, { user: USER, member: MEMBER });
  const page = await ctx.newPage();
  let navs = [];
  page.on('framenavigated', f => { if (f === page.mainFrame()) navs.push(f.url()); });
  await page.goto(`${BASE}/masuk.html?next=${encodeURIComponent(v)}`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(800);
  const fin = verdict(page.url());
  if (/^EXTERNAL|^BAD|javascript/i.test(fin) || navs.some(n => !n.includes(host))) ext++;
  console.log('  ' + JSON.stringify(v).padEnd(52) + ' → ' + fin + (navs.some(n => !n.includes(host) && !/^about:/.test(n)) ? '   !! visited ' + navs.filter(n => !n.includes(host)).join(',') : ''));
  await ctx.close();
}

console.log('\n── 2) signed out → sign in / sign up through the form with ?next=');
for (const v of ['https://evil.example/', '//evil.example/', '/\\evil.example/', 'javascript:alert(1)', 'aplikasi/perencanaan/index.html', 'admin.html', 'anggota.html#kartu', 'aplikasi/../admin.html']) {
  for (const mode of ['masuk', 'daftar']) {
    const ctx = await browser.newContext(); await ctx.addInitScript(seedFn, { user: null, admins: ['demo-admin-0001'] });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/masuk.html?next=${encodeURIComponent(v)}${mode === 'daftar' ? '#daftar' : ''}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    try {
      if (mode === 'masuk') {
        await page.fill('#m-email', 'admin@ppapi.demo');
        await page.fill('#m-pass', 'AdminPPAPI2026');
        await page.locator('form[data-form="masuk-email"] button[type="submit"]').first().click();
      } else {
        await page.fill('#d-name', 'Penguji Redirect');
        await page.fill('#d-email', 'redir' + Math.random().toString(36).slice(2, 6) + '@contoh.id');
        await page.fill('#d-pass', 'Perancah2026');
        await page.fill('#d-pass2', 'Perancah2026');
        await page.check('#d-agree').catch(() => page.locator('label[for="d-agree"]').click());
        await page.locator('form[data-form="daftar-email"] button[type="submit"]').first().click();
      }
      await page.waitForTimeout(3500);
    } catch (e) { console.log('    form error', e.message.split('\n')[0]); }
    console.log('  ' + mode.padEnd(7) + JSON.stringify(v).padEnd(36) + ' → ' + verdict(page.url()));
    await ctx.close();
  }
}

console.log('\n── 3) DOM XSS via #hash and ?query on every page');
const PAGES = ['index', 'profil', 'berita', 'agenda', 'pustaka', 'regulasi', 'keanggotaan', 'verifikasi', 'umpan-balik', 'kebijakan-privasi', 'dashboard', 'anggota', 'pendaftaran', 'admin', 'styleguide', '404', 'masuk', 'aplikasi/perencanaan/index', 'aplikasi/simulator/index', 'tidak-ada/sama/sekali'];
const PAY = '<img src=x onerror=__x(7)>';
const PAY2 = '"><svg/onload=__x(8)>';
let hits = 0;
for (const who of ['member', 'admin', 'out']) {
  const s = who === 'member' ? { user: USER, member: MEMBER } : who === 'admin' ? { user: { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', provider: 'password' }, member: { uid: 'demo-admin-0001', name: 'Admin', status: 'Draf' }, admins: ['demo-admin-0001'] } : { user: null };
  const ctx = await browser.newContext(); await ctx.addInitScript(seedFn, s);
  const page = await ctx.newPage();
  page.on('dialog', d => d.dismiss().catch(() => {}));
  for (const pg of PAGES) {
    for (const suffix of [`?q=${encodeURIComponent(PAY)}&id=${encodeURIComponent(PAY2)}&kategori=${encodeURIComponent(PAY)}&kta=${encodeURIComponent(PAY2)}&next=${encodeURIComponent(PAY)}#${PAY2}`, `#${encodeURIComponent(PAY)}`]) {
      await page.goto(`${BASE}/${pg}${pg.includes('/sama/') ? '' : '.html'}${suffix}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(700);
      const r = await page.evaluate(() => ({ hits: window.__hits || [], inj: [...document.querySelectorAll('img[src="x"], svg[onload]')].length })).catch(() => ({ hits: [], inj: 0 }));
      if (r.hits.length || r.inj) { hits++; console.log('  ✗ ' + who + ' ' + pg + suffix.slice(0, 40) + ' ' + JSON.stringify(r)); }
    }
  }
  await ctx.close();
}
console.log(hits ? `  ${hits} DOM-XSS hits` : '  ✓ no DOM XSS through hash/query on ' + PAGES.length + ' pages × 3 viewers');
await browser.close();
await close();
