// End-to-end journeys for PPAPI v2 (Demo mode), driven like real people in ONE browser context, so the
// demo admin and the member share localStorage exactly as they would on one shared computer.
//
//   J1  visitor → header "Daftar" → sign-up by e-mail → lands on pendaftaran.html → all 7 wizard steps
//       (kategori, data diri + generated JPEG pas foto, profesional + 2 riwayat proyek, kompetensi + sertifikat,
//       2 dokumen, pernyataan, tinjau) → submit → pending view
//   J2  pending applicant: dashboard status centre (Menunggu Verifikasi, track, locked teasers), header menu,
//       anggota.html / admin.html / aplikasi/* gated, pustaka locked (UI + store.pustaka.fileUrl), sign out
//   J3  admin@ppapi.demo signs in through masuk.html → header menu (Konsol Admin) → Permohonan → drawer shows
//       every application field → Setujui → KTA PPAPI-2026-0000NN → sign out
//   J4  member signs in → active dashboard, menu, anggota KTA card + QR → verifikasi?kta= (signed in + out),
//       pustaka unlocked, both apps open with the portal bar and the SSO identity, pendaftaran Aktif view
//   J5  admin: revision on a contoh applicant (member sees the note; resubmits) → rejection (member sees reason)
//   J6  admin content: berita + agenda + member-only pustaka file → visible on the public pages; escaping
//   J7  feedback: visitor submits → admin list (Baru) → Diproses → Selesai, KPI/nav counts
//   J8  admin deactivates the approved member → everything locks again (dashboard, menu, anggota, pustaka,
//       apps, verifikasi) → admin reactivates
//   J9  clock moves to 2030-01-15 → member Kedaluwarsa → renewal (perpanjangan) → admin approves → active,
//       KTA kept, new validity, registry updated
//
// Run from devtools/:  node flows/journey-v2.mjs [--headed] [--mobile]   (--mobile: 390×844 touch phone; steps build on each other)
// Screenshots: devtools/shots/qa/journey-v2-*.png · results: devtools/shots/qa/journey-v2-results.json
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, waitReady, recorder, SHOTS } from './qa-lib.mjs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));

const R = recorder('journey-v2');
const { ok, info } = R;
const issues = [];
const srv = await startServer();
const BASE = srv.BASE;
const browser = await chromium.launch({ headless: !flags.headed, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const ADMIN = { email: 'admin@ppapi.demo', pass: 'AdminPPAPI2026', uid: 'demo-admin-0001' };
const NAME = 'Rina Kartika Sari';
const FIRST = 'Rina';
const EMAIL = `rina.kartika.${Date.now()}@contoh.id`;
const PASS = 'PerancahAman2026';
const T0 = '2026-10-09T03:00:00.000Z'; // 10:00 WIB "today"

/* ---------- one context for everybody ---------- */
const MOBILE = !!flags.mobile;
const ctx = await browser.newContext({
  ...(MOBILE ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } }),
  reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta', acceptDownloads: true,
});
// Ticking clock, continuous ACROSS navigations (so audit/submit timestamps stay ordered): the wall clock is
// <__qa_clock ISO> + (real now − __qa_clock_anchor). The test moves it with setClock(); default start T0.
await ctx.addInitScript((defIso) => {
  const real = Date;
  let iso = defIso, anchor = 0;
  try {
    iso = localStorage.getItem('__qa_clock') || defIso;
    anchor = Number(localStorage.getItem('__qa_clock_anchor')) || 0;
    if (!anchor) { anchor = real.now(); localStorage.setItem('__qa_clock_anchor', String(anchor)); }
  } catch (e) { anchor = real.now(); }
  const offset = new real(iso).getTime() - anchor;
  class FakeDate extends real {
    constructor(...a) { if (a.length) super(...a); else super(real.now() + offset); }
    static now() { return real.now() + offset; }
  }
  FakeDate.UTC = real.UTC; FakeDate.parse = real.parse;
  window.Date = FakeDate;
}, T0);
await ctx.addInitScript(() => { try { localStorage.setItem('ppapi_demo_ribbon_dismissed', 'true'); } catch (e) { /* ignore */ } });

const page = await ctx.newPage();
page.on('console', m => { if (['error', 'warning'].includes(m.type())) issues.push(`console.${m.type()}: ${m.text().slice(0, 300)} @ ${page.url()}`); });
page.on('pageerror', e => issues.push(`pageerror: ${e.message.slice(0, 300)} @ ${page.url()}`));
page.on('requestfailed', r => { const u = r.url(); const t = r.failure()?.errorText || ''; if (/fonts\.(googleapis|gstatic)\.com/.test(u) || /ERR_ABORTED/.test(t)) return; issues.push(`requestfailed: ${u} (${t}) @ ${page.url()}`); });
page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE) && !r.url().endsWith('/favicon.ico')) issues.push(`HTTP ${r.status()} ${r.url()} @ ${page.url()}`); });
page.on('dialog', d => { issues.push('native dialog: ' + d.message()); d.dismiss().catch(() => {}); });

/* ---------- helpers ---------- */
const sleep = (ms) => page.waitForTimeout(ms);
async function shot(name, full = false) { try { await page.screenshot({ path: path.join(SHOTS, `journey-v2${MOBILE ? '-mobile' : ''}-${name}.png`), fullPage: full }); } catch (e) { /* ignore */ } }
async function goto(url) { await page.goto(url.startsWith('http') ? url : `${BASE}/${url}`, { waitUntil: 'networkidle' }); await settleNav(); }
async function settleNav() { await page.waitForLoadState('networkidle').catch(() => {}); await waitReady(page); }
const file = () => { const u = new URL(page.url()); return u.pathname.split('/').pop() + u.search + u.hash; };
async function waitFile(re, timeout = 12000) {
  try { await page.waitForURL(u => re.test(new URL(u).pathname.split('/').pop() + new URL(u).search + new URL(u).hash), { timeout }); } catch (e) { /* reported by caller */ }
  await settleNav();
  return file();
}
async function toastSeen(re, timeout = 4000) {
  try { await page.waitForFunction((src) => [...document.querySelectorAll('.toast')].some(t => new RegExp(src, 'i').test(t.innerText)), re.source, { timeout }); return true; }
  catch (e) { return false; }
}
const toastsNow = () => page.evaluate(() => [...document.querySelectorAll('.toast')].map(t => t.innerText.replace(/\s+/g, ' ').trim()).join(' | '));
async function clearToasts() { await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove())).catch(() => {}); }
// textContent (not innerText): many labels are text-transform:uppercase, innerText would return the rendered case
const text = async (sel) => ((await page.locator(sel).first().textContent({ timeout: 5000 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
async function menu() {
  const trig = page.locator('.account__trigger');
  if (!(await trig.isVisible().catch(() => false))) return { items: [], badges: [], visible: false };
  await trig.click();
  await page.waitForSelector('#account-menu:not([hidden])', { timeout: 3000 }).catch(() => {});
  const r = await page.evaluate(() => ({
    items: [...document.querySelectorAll('#account-menu [role=menuitem]')].map(a => ({ t: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') || '' })),
    badges: [...document.querySelectorAll('#account-menu .account-menu__status .badge')].map(b => b.textContent.trim()),
    name: document.querySelector('#account-menu .account-menu__name')?.innerText.trim() || '',
  }));
  await page.keyboard.press('Escape');
  return { ...r, visible: true, labels: r.items.map(i => i.t).join('|') };
}
async function signOutViaMenu(expect = /index\.html$/) {
  // the header slides away while scrolling down (by design) — come back to the top like a user would
  await page.evaluate(() => window.scrollTo(0, 0)); await sleep(200);
  await page.locator('.account__trigger').click();
  await page.locator('#account-menu [data-signout]').click();
  await waitFile(expect);
}
async function signIn(email, pass, next = '') {
  await goto('masuk.html' + (next ? '?next=' + encodeURIComponent(next) : ''));
  await page.fill('#m-email', email);
  await page.fill('#m-pass', pass);
  await page.locator('[data-form="masuk-email"] button[type=submit]').click();
  await page.waitForURL(u => !/masuk\.html/.test(u), { timeout: 12000 }).catch(() => {});
  await settleNav();
}
const memberRec = (uid) => page.evaluate(id => { try { return PPAPI.store.normalizeMember(JSON.parse(localStorage.getItem('ppapi_member_' + id))); } catch (e) { return JSON.parse(localStorage.getItem('ppapi_member_' + id) || 'null'); } }, uid);
async function gatedTo(url) { // visit a gated URL, return { file, toast }
  await page.goto(`${BASE}/${url}`, { waitUntil: 'networkidle' });
  await page.waitForURL(u => !u.endsWith('/' + url), { timeout: 12000 }).catch(() => {});
  await settleNav();
  const f = file();
  const t = await toastsNow();
  return { file: f, toast: t };
}
// admin console helpers (selectors from admin-flow.mjs)
async function admReady() { await page.waitForSelector('html[data-admin-ready]', { timeout: 15000 }); await sleep(150); }
async function admNav(section) { await page.click(`.adm-nav__link[data-section="${section}"]`); await page.waitForFunction(s => !document.getElementById('sec-' + s).hidden, section); await sleep(120); }
async function drawerOpen() { await page.waitForSelector('.drawer__panel', { timeout: 6000 }); await sleep(150); }
async function closeDrawer() { await page.keyboard.press('Escape'); await page.waitForSelector('.drawer', { state: 'detached', timeout: 5000 }).catch(() => {}); await sleep(120); }
async function modalOpen() { await page.waitForSelector('.modal__dialog', { timeout: 6000 }); await sleep(120); }
async function modalGone() { await page.waitForSelector('.modal', { state: 'detached', timeout: 6000 }).catch(() => {}); await sleep(150); }
// pendaftaran helpers (selectors from pendaftaran-flow.mjs)
async function dafReady() {
  await page.waitForFunction(() => { const r = document.getElementById('daf-root'); return r && r.getAttribute('aria-busy') === 'false' && r.getAttribute('data-view'); }, null, { timeout: 15000 });
  await sleep(150);
}
const dafView = () => page.evaluate(() => document.getElementById('daf-root')?.getAttribute('data-view'));
const dafStep = () => page.evaluate(() => { const p = [...document.querySelectorAll('[data-panel]')].find(x => !x.hidden); return p && p.getAttribute('data-panel'); });
async function dafNext() { await page.click('.daf-foot__next'); await sleep(300); }
async function dafSettle() {
  await sleep(800);
  await page.waitForFunction(() => { const e = document.querySelector('.js-save'); return !e || !['saving', 'dirty'].includes(e.getAttribute('data-state')); }, null, { timeout: 8000 }).catch(() => {});
}
async function setClock(iso) {
  await page.evaluate(v => {
    if (v) localStorage.setItem('__qa_clock', v); else localStorage.removeItem('__qa_clock');
    localStorage.setItem('__qa_clock_anchor', String(Math.round(performance.timeOrigin + performance.now()))); // real epoch ms
  }, iso);
}

let UID = '';
let KTA = '';
const NEWS_TITLE = 'Rapat Koordinasi Komite Teknis Perancah <b>2026</b> & "Uji"';
const AGENDA_TITLE = 'Klinik Teknis Inspeksi Perancah Sistem (Uji Journey)';
const DOC_TITLE = 'Petunjuk Teknis Penandaan Scafftag (Uji Journey)';
const DOC_URL = 'https://example.com/ppapi/pt-scafftag-uji.pdf';
let NEWS_ID = '', AGENDA_ID = '', DOC_ID = '';
let HIDDEN_NEWS = null;

async function step(label, fn) {
  console.log(`\n=== ${label} ===`);
  try { await fn(); }
  catch (e) {
    ok(`${label.split(' ')[0]} completed without exception`, false, e.message.split('\n')[0]);
    info(`${label.split(' ')[0]} exception call log`, e.message.split('\n').slice(1, 14).join(' / '));
    await shot(label.split(' ')[0] + '-FAIL', true);
    // leave a clean state for the next journey: close dialogs, end the session
    await page.keyboard.press('Escape').catch(() => {}); await page.keyboard.press('Escape').catch(() => {});
    await page.evaluate(() => { try { localStorage.removeItem('ppapi_demo_session'); sessionStorage.removeItem('ppapi_demo_session'); } catch (er) { /* ignore */ } }).catch(() => {});
    await goto('index.html').catch(() => {});
  }
}

/* =====================================================================================
   J1 — sign-up → wizard → submit
   ===================================================================================== */
await step('J1 registration + application wizard', async () => {
  await goto('index.html');
  if (MOBILE) { // below 768px Masuk/Daftar live in the full-screen menu foot
    await page.locator('.menu-toggle').click();
    await page.waitForSelector('#mobile-menu.is-open', { timeout: 4000 }).catch(() => {});
    ok('J1 index (phone): menu foot shows Masuk + Daftar to a visitor', await page.locator('[data-mobile-account] a', { hasText: 'Daftar' }).isVisible());
    await page.locator('[data-mobile-account] a', { hasText: 'Daftar' }).click();
  } else {
    ok('J1 index: header shows Masuk + Daftar to a visitor', await page.locator('.account__guest a', { hasText: 'Daftar' }).isVisible());
    await page.locator('.account__guest a', { hasText: 'Daftar' }).click();
  }
  await waitFile(/masuk\.html#daftar$/);
  ok('J1 Daftar → masuk.html#daftar (Daftar tab)', /masuk\.html#daftar$/.test(file()) && (await page.getAttribute('#tab-daftar', 'aria-selected')) === 'true', file());
  await page.fill('#d-name', NAME);
  await page.fill('#d-email', EMAIL);
  await page.fill('#d-pass', PASS);
  await page.fill('#d-pass2', PASS);
  await page.check('#d-agree');
  await page.locator('[data-form="daftar-email"] button[type=submit]').click();
  await waitFile(/pendaftaran\.html/, 15000);
  ok('J1 sign-up without ?next → pendaftaran.html (auth.postSignUpTarget)', /^pendaftaran\.html/.test(file()), file());
  ok('J1 welcome toast after sign-up', await toastSeen(/Selamat datang/), await toastsNow());
  await dafReady();
  UID = await page.evaluate(() => PPAPI.auth.current().uid);
  let m = await memberRec(UID);
  ok('J1 new account → member record Draf, KTA empty', m && m.status === 'Draf' && m.kta === '', m && `${m.status} kta="${m.kta}"`);
  ok('J1 wizard view, step 1 Kategori, 7 steps', (await dafView()) === 'wizard' && (await dafStep()) === 'kategori' && (await page.locator('.stepper__item').count()) === 7);
  ok('J1 header account name = first name', (await text('.account__name')) === FIRST, await text('.account__name'));
  const mn = await menu();
  ok('J1 Draf account menu: Dasbor | Formulir Pendaftaran | Keluar + Draf badge', mn.labels === 'Dasbor|Formulir Pendaftaran|Keluar' && mn.badges.join() === 'Draf', `${mn.labels} [${mn.badges}]`);

  // step 1 — kategori
  await page.click('label[for="cat-0"]');
  await dafSettle();
  await dafNext();
  ok('J1 step 1 Praktisi chosen → step 2 Data Diri', (await dafStep()) === 'data-diri', await dafStep());

  // step 2 — data diri + generated JPEG pas foto
  ok('J1 step 2 name/email prefilled from the account', (await page.inputValue('#f-name')) === NAME && (await page.inputValue('#f-email')) === EMAIL);
  await page.fill('#f-birthPlace', 'Bandung');
  await page.fill('#f-birthDate', '1991-04-23');
  await page.check('#f-gender-1').catch(async () => { await page.locator('label[for="f-gender-1"]').click(); });
  await page.selectOption('#f-province', 'Jawa Barat');
  await page.fill('#f-city', 'Bekasi');
  await page.fill('#f-address', 'Jl. Perancah Raya No. 12, Bekasi Selatan');
  await page.fill('#f-phone', '0813-2222-4545');
  await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 1200; c.height = 1600;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 1200, 1600); gr.addColorStop(0, '#d9d9d9'); gr.addColorStop(1, '#3a3a3a');
    g.fillStyle = gr; g.fillRect(0, 0, 1200, 1600);
    const img = g.getImageData(0, 0, 1200, 1600);
    for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 120; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
    g.putImageData(img, 0, 0);
    g.fillStyle = '#111'; g.beginPath(); g.arc(600, 620, 260, 0, Math.PI * 2); g.fill(); g.fillRect(260, 980, 680, 620);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.95));
    const f = new File([blob], 'pas-foto-rina.jpg', { type: 'image/jpeg' });
    window.__qaPhotoBytes = blob.size;
    const dt = new DataTransfer(); dt.items.add(f);
    const inp = document.getElementById('f-pasFoto'); inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  });
  info('J1 generated JPEG size (bytes, before client resize)', String(await page.evaluate(() => window.__qaPhotoBytes)));
  await page.waitForSelector('.daf-photo__frame img', { timeout: 15000 }).catch(() => {});
  await dafSettle();
  m = await memberRec(UID);
  const photo = (m && m.application.pasFoto) || '';
  const bytes = photo ? Math.floor((photo.length - photo.indexOf(',') - 1) * 3 / 4) : 0;
  const dims = photo ? await page.evaluate(src => new Promise(r => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.onerror = () => r([0, 0]); i.src = src; }), photo) : [0, 0];
  ok('J1 pas foto: JPEG data URL ≤ 120 KB, ≤ 360×480 (3:4)', photo.startsWith('data:image/jpeg;base64,') && bytes <= 120 * 1024 && dims[0] <= 360 && dims[1] <= 480 && dims[0] > 0, `${bytes} B ${dims.join('×')}`);
  ok('J1 profile autosaved (phone E.164, province, city)', m.phone === '+6281322224545' && m.profile.province === 'Jawa Barat' && m.profile.city === 'Bekasi' && m.profile.birthDate === '1991-04-23', `${m.phone} ${m.profile.province} ${m.profile.city}`);
  await shot('j1-datadiri');
  await dafNext();
  ok('J1 step 2 → step 3 Profesional', (await dafStep()) === 'profesional', await dafStep());

  // step 3 — profesional + 2 riwayat proyek
  await page.fill('#f-company', 'PT Rangka Konstruksi Andalan');
  await page.fill('#f-position', 'Scaffolding Inspector');
  await page.selectOption('#f-education', { index: 5 }).catch(() => {});
  await page.fill('#f-experienceYears', '8').catch(() => {});
  const rows = [
    ['Perancah fasad apartemen 32 lantai', 'Inspektur perancah', '2024', 'Bekasi'],
    ['Pemeliharaan boiler PLTU (perancah internal)', 'Supervisor perancah', '2022–2023', 'Cilegon'],
  ];
  for (let i = 0; i < rows.length; i++) {
    await page.click('[data-action="peng-add"]');
    const r = page.locator('#peng-list .daf-rep').nth(i);
    await r.locator('input[data-key="proyek"]').fill(rows[i][0]);
    await r.locator('input[data-key="peran"]').fill(rows[i][1]);
    await r.locator('input[data-key="tahun"]').fill(rows[i][2]);
    await r.locator('input[data-key="lokasi"]').fill(rows[i][3]);
  }
  await dafSettle();
  m = await memberRec(UID);
  ok('J1 two riwayat proyek autosaved in order', m.application.pengalaman.length === 2 && m.application.pengalaman[0].proyek === rows[0][0] && m.application.pengalaman[1].lokasi === 'Cilegon', JSON.stringify(m.application.pengalaman).slice(0, 200));
  await dafNext();
  ok('J1 step 3 → step 4 Kompetensi', (await dafStep()) === 'kompetensi', await dafStep());

  // step 4 — kompetensi + sertifikat (modals)
  await page.click('[data-action="komp-add"]');
  await page.waitForSelector('#mk-kode');
  const code = await page.$eval('#mk-kode optgroup option', o => o.value);
  await page.selectOption('#mk-kode', code);
  await page.selectOption('#mk-level', 'Menengah');
  await page.fill('#mk-since', '2019');
  await page.locator('.modal .modal__footer .btn').last().click();
  await modalGone();
  await page.click('[data-action="cert-add"]');
  await page.waitForSelector('#mc-title');
  await page.fill('#mc-title', 'Inspektur Perancah');
  await page.fill('#mc-issuer', 'BNSP / LSP');
  await page.fill('#mc-issued', '2024-03-01');
  await page.fill('#mc-expires', '2027-03-01');
  await page.fill('#mc-link', 'https://drive.google.com/file/d/sertifikat-rina/view');
  await page.locator('.modal .modal__footer .btn').last().click();
  await modalGone();
  m = await memberRec(UID);
  ok('J1 kompetensi + sertifikat saved', m.competencies.length === 1 && m.certificates.length === 1, `${m.competencies.length}/${m.certificates.length}`);
  await dafNext();
  ok('J1 step 4 → step 5 Dokumen', (await dafStep()) === 'dokumen', await dafStep());

  // step 5 — dokumen (2 rows) + catatan
  await page.click('[data-action="dok-add"]');
  await page.locator('#dok-list .daf-rep').nth(0).locator('input[data-key="label"]').fill('Daftar riwayat hidup 2026');
  await page.locator('#dok-list .daf-rep').nth(0).locator('input[data-key="url"]').fill('https://drive.google.com/file/d/cv-rina/view');
  await page.click('[data-action="dok-add"]');
  await page.locator('#dok-list .daf-rep').nth(1).locator('input[data-key="label"]').fill('Sertifikat inspektur');
  await page.locator('#dok-list .daf-rep').nth(1).locator('input[data-key="url"]').fill('drive.google.com/file/d/sert-rina/view');
  await page.locator('#dok-list .daf-rep').nth(1).locator('input[data-key="url"]').blur();
  await page.fill('#f-catatan', 'Surat rekomendasi dari pemberi kerja menyusul.');
  await dafSettle();
  m = await memberRec(UID);
  ok('J1 two dokumen autosaved (https only; scheme-less completed)', m.application.dokumen.length === 2 && m.application.dokumen.every(d => d.url.startsWith('https://')), JSON.stringify(m.application.dokumen.map(d => d.jenis + ' ' + d.url)));
  await dafNext();
  ok('J1 step 5 → step 6 Pernyataan', (await dafStep()) === 'pernyataan', await dafStep());

  // step 6 — pernyataan
  await page.check('#f-kodeEtik');
  await page.check('#f-kebenaranData');
  await page.check('#f-privasi');
  await page.fill('#f-namaTerang', NAME);
  await dafSettle();
  await dafNext();
  ok('J1 step 6 → step 7 Tinjau', (await dafStep()) === 'tinjau', await dafStep());
  await dafSettle();
  ok('J1 review: "Formulir siap diajukan", 6 groups, pas foto shown', /Formulir siap diajukan/.test(await text('#daf-review')) && (await page.locator('.daf-sum').count()) === 6 && (await page.locator('.daf-sum__photo').count()) === 1, await text('#daf-review'));
  await shot('j1-review', true);

  // submit
  await page.click('.daf-foot__next');
  await page.waitForFunction(() => document.getElementById('daf-root').getAttribute('data-view') === 'pending', null, { timeout: 8000 }).catch(() => {});
  ok('J1 submit → pending view, badge Menunggu Verifikasi', (await dafView()) === 'pending' && (await text('#daf-hero-status .badge')) === 'Menunggu Verifikasi', `${await dafView()} ${await text('#daf-hero-status .badge')}`);
  m = await memberRec(UID);
  ok('J1 store: Menunggu Verifikasi + submittedAt + type baru, still no KTA', m.status === 'Menunggu Verifikasi' && !!m.application.submittedAt && m.application.type === 'baru' && m.kta === '', `${m.status} ${m.application.submittedAt} ${m.application.type}`);
  await shot('j1-pending', true);
});

/* =====================================================================================
   J2 — pending applicant: status centre, menu, gates, pustaka lock, sign out
   ===================================================================================== */
await step('J2 pending applicant sees status centre + locks', async () => {
  await goto('dashboard.html');
  await page.waitForSelector('#dash-status-view:not([hidden])', { timeout: 8000 }).catch(() => {});
  ok('J2 dashboard: status view shown, active view hidden', await page.locator('#dash-status-view').isVisible() && !(await page.locator('#dash-active-view').isVisible()));
  ok('J2 status card: "Menunggu Verifikasi"', /Menunggu Verifikasi/.test(await text('#dash-sc-title')), await text('#dash-sc-title'));
  const track = await page.evaluate(() => [...document.querySelectorAll('#dash-sc .status-track__step')].map(s => s.className.replace('status-track__step', '').trim() + ':' + (s.querySelector('.status-track__label')?.textContent || '').replace(/\s+/g, ' ').trim()));
  info('J2 status track', track.join(' · '));
  ok('J2 status track: current step = verification', track.some(t => /is-current/.test(t) && /Verifikasi/i.test(t)), track.join(' · '));
  const teasers = await page.locator('#dash-teasers .dash-teaser, #dash-teasers .locked').count();
  ok('J2 locked feature teasers rendered (≥ 4)', teasers >= 4, String(teasers));
  ok('J2 teasers mention KTA, Produk Pengetahuan and both apps', await page.evaluate(() => { const t = document.getElementById('dash-teasers').innerText; return /Kartu|KTA/i.test(t) && /Pengetahuan/i.test(t) && /Perencanaan/i.test(t) && /Simulator/i.test(t); }));
  ok('J2 no KTA number in the hero', !/PPAPI-\d{4}-\d{6}/.test(await text('#dash-meta')), await text('#dash-meta'));
  ok('J2 no app launch links on the page', (await page.locator('main a[href*="aplikasi/"]').count()) === 0, String(await page.locator('main a[href*="aplikasi/"]').count()));
  const mn = await menu();
  ok('J2 pending menu: Dasbor | Formulir Pendaftaran | Keluar, badge Menunggu Verifikasi', mn.labels === 'Dasbor|Formulir Pendaftaran|Keluar' && mn.badges.join() === 'Menunggu Verifikasi', `${mn.labels} [${mn.badges}]`);
  await shot('j2-dashboard-pending', true);

  let g = await gatedTo('anggota.html');
  ok('J2 anggota.html → dashboard.html + "Fitur ini khusus anggota berstatus Aktif."', /^dashboard\.html/.test(g.file) && (await toastSeen(/khusus anggota berstatus Aktif/)), `${g.file} | ${g.toast}`);
  await clearToasts();
  g = await gatedTo('anggota.html#kartu');
  ok('J2 anggota.html#kartu → dashboard.html', /^dashboard\.html/.test(g.file), g.file);
  await clearToasts();
  g = await gatedTo('admin.html');
  ok('J2 admin.html → dashboard.html + "Halaman ini khusus admin PPAPI."', /^dashboard\.html/.test(g.file) && (await toastSeen(/khusus admin PPAPI/)), `${g.file} | ${g.toast}`);
  await clearToasts();
  for (const app of ['aplikasi/perencanaan/index.html', 'aplikasi/simulator/index.html']) {
    g = await gatedTo(app);
    ok(`J2 ${app} → dashboard.html + toast`, /^dashboard\.html/.test(g.file) && (await toastSeen(/khusus anggota berstatus Aktif/)), `${g.file} | ${g.toast}`);
    await clearToasts();
  }
  await goto('pustaka.html');
  await sleep(400);
  ok('J2 pustaka: lock panel shown, no "Akses penuh" strip', (await page.locator('.pk-lockbar').count()) > 0 && (await page.locator('.pk-granted').count()) === 0);
  ok('J2 pustaka: member documents locked', (await page.locator('[data-pk="results"] .doc-card--locked').count()) > 0);
  ok('J2 pustaka: both app cards locked', (await page.locator('.pk-app.doc-card--locked').count()) === 2);
  ok('J2 pustaka: no link into aplikasi/ for a pending applicant', (await page.locator('main a[href^="aplikasi/"]').count()) === 0);
  const lockCta = await page.evaluate(() => [...document.querySelectorAll('.pk-lockbar a')].map(a => a.textContent.trim() + '→' + a.getAttribute('href')).join(', '));
  ok('J2 pustaka lock CTA: "Lihat Status Pendaftaran" → dashboard', /Lihat Status Pendaftaran→dashboard\.html/.test(lockCta), lockCta);
  const fu = await page.evaluate(async () => { try { await PPAPI.store.pustaka.fileUrl(PPAPI.data.pustaka[0]); return 'resolved'; } catch (e) { return e.code || e.message; } });
  ok('J2 store.pustaka.fileUrl refuses a pending applicant (store/forbidden)', fu === 'store/forbidden', fu);
  await page.locator('[data-pk-open="d:cop-pemasangan-tube-coupler"]').first().click(); // akses: anggota
  await page.waitForSelector('.modal .modal__dialog', { timeout: 4000 }).catch(() => {});
  ok('J2 pustaka detail modal (member-only document): locked panel, no "Buka Dokumen"', (await page.locator('.modal .locked').count()) > 0 && (await page.locator('.modal a', { hasText: 'Buka Dokumen' }).count()) === 0);
  await page.keyboard.press('Escape'); await sleep(300);
  await shot('j2-pustaka-locked');

  await goto('keanggotaan.html');
  const kCta = await page.evaluate(() => [...document.querySelectorAll('main a')].filter(a => /Status|Lanjutkan|Pendaftaran/i.test(a.textContent)).map(a => a.textContent.replace(/\s+/g, ' ').trim() + '→' + a.getAttribute('href')).slice(0, 4).join(', '));
  ok('J2 keanggotaan CTA for a pending applicant: a status link (pendaftaran pending view or dashboard), never "Mulai"', /Status[^→]*→(pendaftaran|dashboard)\.html/i.test(kCta) && !/Mulai/i.test(kCta), kCta);
  await goto('index.html');
  const appBtns = await page.evaluate(() => [...document.querySelectorAll('a')].filter(a => /aplikasi\//.test(a.getAttribute('href') || '')).length);
  ok('J2 beranda: no direct app link for a pending applicant', appBtns === 0, String(appBtns));
  const v = await page.evaluate(async (n) => PPAPI.store.registry.lookup(n), NAME);
  ok('J2 registry: applicant not listed before approval', !v.exact && !(v.matches || []).some(x => x.nama === NAME), JSON.stringify(v).slice(0, 200));

  await goto('dashboard.html');
  await signOutViaMenu();
  ok('J2 sign out from dashboard → index.html, signed out', /index\.html$/.test(file()) && await page.evaluate(() => !localStorage.getItem('ppapi_demo_session') && !sessionStorage.getItem('ppapi_demo_session')), file());
  ok('J2 sign-out flash toast', await toastSeen(/telah keluar/), await toastsNow());
});

/* =====================================================================================
   J3 — admin approves the applicant (console UI)
   ===================================================================================== */
await step('J3 admin approves the applicant', async () => {
  await goto('masuk.html');
  const note = await text('main');
  ok('J3 masuk demo note shows the demo admin credentials', note.includes(ADMIN.email) && note.includes(ADMIN.pass));
  await signIn(ADMIN.email, ADMIN.pass);
  ok('J3 admin sign-in → dashboard.html', /^dashboard\.html/.test(file()), file());
  await page.waitForSelector('#dash-admin:not([hidden])', { timeout: 8000 }).catch(() => {});
  ok('J3 admin dashboard: Konsol Admin band visible', await page.locator('#dash-admin').isVisible());
  info('J3 admin band', (await text('#dash-admin')).slice(0, 220));
  const mn = await menu();
  ok('J3 admin menu: Dasbor | Profil Anggota | Produk Pengetahuan | Aplikasi Anggota | Konsol Admin | Keluar', mn.labels === 'Dasbor|Profil Anggota|Produk Pengetahuan|Aplikasi Anggota|Konsol Admin|Keluar', mn.labels);
  ok('J3 admin menu badge: Admin (own Draf status hidden)', mn.badges.join() === 'Admin', mn.badges.join());
  await page.locator('.account__trigger').click();
  await page.locator('#account-menu [role=menuitem]', { hasText: 'Konsol Admin' }).click();
  await waitFile(/admin\.html/);
  await admReady();
  ok('J3 menu "Konsol Admin" → admin.html', /^admin\.html/.test(file()), file());
  await admNav('permohonan');
  const rows = await page.evaluate(() => [...document.querySelectorAll('#pq-list tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ').slice(0, 80)));
  info('J3 queue', rows.join(' || '));
  ok('J3 queue lists the applicant (FIFO: seeded Bagus first)', rows.length >= 2 && /Bagus/.test(rows[0]) && rows.some(r => r.includes(NAME)), rows.join(' || '));
  await page.click(`#pq-list .adm-act[data-id="${UID}"]`);
  await drawerOpen();
  const d = await page.evaluate(() => ({
    title: document.querySelector('.drawer__title')?.innerText.trim(), body: document.querySelector('.drawer__panel').innerText,
    photo: document.querySelector('.drawer .adm-dhead__photo')?.getAttribute('src')?.slice(0, 23) || '',
    docs: [...document.querySelectorAll('.drawer .adm-docs a')].map(a => ({ href: a.href, rel: a.rel, target: a.target })),
    actions: [...document.querySelectorAll('.drawer__footer .btn')].map(b => b.textContent.trim()).join('|'),
    mail: document.querySelector('.drawer a[href^="mailto:"]')?.getAttribute('href') || '',
  }));
  ok('J3 drawer title = applicant name', d.title === NAME, d.title);
  ok('J3 drawer shows the JPEG pas foto', d.photo === 'data:image/jpeg;base64,', d.photo);
  ok('J3 drawer shows data diri, profesional, both projects, kompetensi, sertifikat, catatan', ['Bekasi', 'PT Rangka Konstruksi Andalan', 'Perancah fasad apartemen 32 lantai', 'Pemeliharaan boiler PLTU', 'Inspektur Perancah', 'Surat rekomendasi dari pemberi kerja menyusul.'].every(s => d.body.includes(s)), d.body.slice(0, 300));
  ok('J3 drawer: 2 document links (https, new tab, noopener)', d.docs.length === 2 && d.docs.every(x => x.href.startsWith('https://') && /noopener/.test(x.rel) && x.target === '_blank'), JSON.stringify(d.docs));
  ok('J3 drawer: completeness OK', /Seluruh data wajib formulir telah terisi/.test(d.body));
  ok('J3 drawer: mailto to the applicant', d.mail.startsWith('mailto:' + EMAIL), d.mail.slice(0, 80));
  ok('J3 drawer actions Tolak | Minta Perbaikan | Setujui', d.actions === 'Tolak|Minta Perbaikan|Setujui', d.actions);
  await shot('j3-drawer', true);
  await page.click('#act-approve');
  await modalOpen();
  const def = await page.evaluate(() => ({ kat: document.querySelector('.modal [name="memberType"]').value, until: document.querySelector('.modal [name="validUntil"]').value }));
  ok('J3 approve dialog defaults: kategori from the application (Praktisi), validity 2029-12-31', def.kat === 'Praktisi' && def.until === '2029-12-31', JSON.stringify(def));
  await page.fill('.modal [name="note"]', 'Berkas lengkap. Selamat bergabung.');
  await page.click('#dlg-approve-ok');
  await page.waitForSelector('#adm-kta-result', { timeout: 8000 }).catch(() => {});
  KTA = (await text('.adm-kta__num')).trim();
  ok('J3 approval shows KTA PPAPI-2026-0000NN', /^PPAPI-2026-0000\d\d$/.test(KTA), KTA);
  await shot('j3-kta');
  await page.locator('.modal__footer .btn').last().click();
  await modalGone();
  await closeDrawer();
  const m = await memberRec(UID);
  ok('J3 store: Aktif, KTA, validUntil 2029-12-31, approvedBy admin, joinedAt = approval date', m.status === 'Aktif' && m.kta === KTA && m.validUntil === '2029-12-31' && m.approvedBy === ADMIN.uid && m.joinedAt === '2026-10-09', `${m.status} ${m.kta} ${m.validUntil} ${m.approvedBy} ${m.joinedAt}`);
  const queue = await page.evaluate(() => [...document.querySelectorAll('#pq-list tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ').slice(0, 60)));
  ok('J3 queue no longer lists the applicant', !queue.some(r => r.includes(NAME)), queue.join(' || '));
  await goto('dashboard.html');
  await page.waitForSelector('#dash-admin-body:not([aria-busy="true"])', { timeout: 6000 }).catch(() => {});
  const band = await text('#dash-admin');
  ok('J3 dashboard admin band: 1 application waiting after the approval', /1 pengajuan/.test(band) || /Menunggu verifikasi\s*1|1\s*Menunggu verifikasi/i.test(band), band.slice(0, 200));
  await goto('aplikasi/perencanaan/index.html');
  await page.waitForSelector('html.app-gate-ok', { timeout: 15000 }).catch(() => {});
  const ad = await page.evaluate(() => ({ badge: document.querySelector('.pp-bar__badge')?.textContent.trim(), tab: document.getElementById('tab-admin')?.hidden, role: document.querySelector('.sso-line [data-sso="role"]')?.textContent.trim() }));
  ok('J3 admin in the planning app: bar badge "Admin", app admin tab visible (role mapping)', ad.badge === 'Admin' && ad.tab === false && /admin/i.test(ad.role || ''), JSON.stringify(ad));
  await goto('admin.html');
  await admReady();
  await signOutViaMenu();
  ok('J3 admin sign out (admin page) → index.html', /index\.html$/.test(file()), file());
});

/* =====================================================================================
   J4 — the approved member
   ===================================================================================== */
await step('J4 approved member: active features', async () => {
  await signIn(EMAIL, PASS);
  ok('J4 member sign-in → dashboard.html', /^dashboard\.html/.test(file()), file());
  await page.waitForSelector('#dash-active-view:not([hidden])', { timeout: 8000 }).catch(() => {});
  ok('J4 dashboard: active view, status view hidden', await page.locator('#dash-active-view').isVisible() && !(await page.locator('#dash-status-view').isVisible()));
  ok('J4 hero shows the official KTA + kategori', (await text('#dash-meta')).includes(KTA) && /Praktisi/.test(await text('#dash-meta')), await text('#dash-meta'));
  await page.waitForSelector('#dash-apps:not([aria-busy="true"])', { timeout: 6000 }).catch(() => {});
  const apps = await page.evaluate(() => [...document.querySelectorAll('#dash-apps a[href*="aplikasi/"]')].map(a => a.getAttribute('href') + (a.target ? ' target=' + a.target : '')));
  ok('J4 dashboard app cards → internal aplikasi/… in the same tab', apps.some(h => h === 'aplikasi/perencanaan/index.html') && apps.some(h => h === 'aplikasi/simulator/index.html') && apps.every(h => !/target=_blank/.test(h)), apps.join(', '));
  const kpis = await text('#dash-kpis');
  ok('J4 KPIs mention the validity (31 Des 2029)', /2029/.test(kpis), kpis.slice(0, 200));
  const mn = await menu();
  ok('J4 active menu: Dasbor | Profil Anggota | Produk Pengetahuan | Aplikasi Anggota | Keluar, badge Aktif', mn.labels === 'Dasbor|Profil Anggota|Produk Pengetahuan|Aplikasi Anggota|Keluar' && mn.badges.join() === 'Aktif', `${mn.labels} [${mn.badges}]`);
  await shot('j4-dashboard-active', true);

  // anggota → KTA card + QR
  await page.locator('.account__trigger').click();
  await page.locator('#account-menu [role=menuitem]', { hasText: 'Profil Anggota' }).click();
  await waitFile(/anggota\.html/);
  ok('J4 menu "Profil Anggota" → anggota.html (no redirect)', /^anggota\.html/.test(file()), file());
  await page.click('#tab-kartu');
  await page.waitForFunction(() => /ready|fallback/.test(document.querySelector('#kta-qr')?.getAttribute('data-state') || ''), null, { timeout: 20000 }).catch(() => {});
  const qr = await page.evaluate(() => ({ st: document.querySelector('#kta-qr')?.getAttribute('data-state'), url: document.querySelector('#kta-qr')?.getAttribute('data-url'), svg: !!document.querySelector('#kta-qr svg, #kta-qr canvas, #kta-qr img'), card: document.getElementById('kta')?.innerText.replace(/\s+/g, ' ') || '' }));
  ok('J4 KTA card shows KTA, name and validity', qr.card.includes(KTA) && qr.card.includes(NAME) && /2029/.test(qr.card), qr.card.slice(0, 200));
  ok('J4 QR rendered and encodes verifikasi.html?kta=<KTA>', qr.st === 'ready' && qr.svg && qr.url === `${BASE}/verifikasi.html?kta=${KTA}`, JSON.stringify({ st: qr.st, url: qr.url }));
  await shot('j4-kartu');
  await page.click('#tab-aplikasi');
  await sleep(300);
  const agtApps = await page.evaluate(() => [...document.querySelectorAll('#panel-aplikasi a[href*="aplikasi/"]')].map(a => a.getAttribute('href') + (a.target ? ' target=' + a.target : '')));
  ok('J4 anggota Aplikasi tab → internal app paths', agtApps.includes('aplikasi/perencanaan/index.html') && agtApps.includes('aplikasi/simulator/index.html'), agtApps.join(', '));

  // verifikasi (signed in)
  await goto(`verifikasi.html?kta=${encodeURIComponent(KTA)}`);
  await page.waitForSelector('.vf-result', { timeout: 6000 }).catch(() => {});
  ok('J4 verifikasi?kta= finds the member: Terverifikasi', await page.locator('.vf-result--ok').isVisible() && (await text('.vf-result__name')).includes(NAME), await text('.vf-result'));

  // pustaka unlocked
  await goto('pustaka.html');
  await sleep(400);
  ok('J4 pustaka: no lock panel, "Akses penuh" strip', (await page.locator('.pk-lockbar').count()) === 0 && /Anggota Aktif/.test(await text('.pk-granted')), await text('.pk-granted'));
  ok('J4 pustaka: no locked document cards', (await page.locator('[data-pk="results"] .doc-card--locked').count()) === 0);
  ok('J4 pustaka: app cards unlocked → internal paths', (await page.locator('.pk-app.doc-card--locked').count()) === 0 && (await page.locator('#app-perencanaan a.btn--primary').getAttribute('href').catch(() => '')) === 'aplikasi/perencanaan/index.html');
  const fu = await page.evaluate(async () => { try { return 'ok:' + (await PPAPI.store.pustaka.fileUrl(PPAPI.data.pustaka.find(x => x.app === 'perencanaan'))); } catch (e) { return e.code; } });
  ok('J4 store.pustaka.fileUrl allowed for an active member', fu === 'ok:aplikasi/perencanaan/index.html', fu);

  // planning app via dashboard card
  await goto('dashboard.html');
  await page.locator('#dash-apps a[href="aplikasi/perencanaan/index.html"]').first().click();
  await waitFile(/index\.html/);
  await page.waitForSelector('html.app-gate-ok', { timeout: 15000 }).catch(() => {});
  const pa = await page.evaluate(() => ({
    path: location.pathname, ok: document.documentElement.classList.contains('app-gate-ok'), bar: !!document.getElementById('pp-bar'),
    barName: document.querySelector('.pp-bar__name')?.innerText.trim(), badge: document.querySelector('.pp-bar__badge')?.textContent.trim(),
    back: document.querySelector('.pp-bar__back')?.getAttribute('href') || '',
    sso: document.querySelector('[data-sso="name"]')?.textContent.trim(), role: document.querySelector('.sso-line [data-sso="role"]')?.textContent.trim(),
    kta: document.querySelector('.sso-line [data-sso="kta"]')?.textContent.trim(), adminTab: document.getElementById('tab-admin')?.hidden,
    login: [...document.querySelectorAll('input[type=password]')].filter(i => i.offsetParent).length,
  }));
  ok('J4 planning app opens (gate ok) with the portal bar', pa.path.endsWith('/aplikasi/perencanaan/index.html') && pa.ok && pa.bar, JSON.stringify(pa));
  ok('J4 portal bar: member name + "Aktif" + back link to the portal', pa.barName === NAME && pa.badge === 'Aktif' && /dashboard\.html$/.test(pa.back), JSON.stringify(pa));
  ok('J4 planning app SSO: name, role "Pengguna (anggota Aktif)", KTA; no admin tab, no password field', pa.sso === NAME && /Pengguna/.test(pa.role || '') && (pa.kta || '').includes(KTA) && pa.adminTab === true && pa.login === 0, JSON.stringify(pa));
  await shot('j4-perencanaan');
  await page.locator('.pp-bar__back').click();
  await waitFile(/dashboard\.html/);
  ok('J4 portal bar "Portal Anggota" → dashboard.html', /^dashboard\.html/.test(file()), file());

  // simulator
  await goto('aplikasi/simulator/index.html');
  await page.waitForSelector('html.app-gate-ok', { timeout: 15000 }).catch(() => {});
  const sa = await page.evaluate(() => ({ ok: document.documentElement.classList.contains('app-gate-ok'), barName: document.querySelector('.pp-bar__name')?.innerText.trim(), title: document.querySelector('.pp-bar__title')?.innerText.trim() }));
  ok('J4 simulator opens with the portal bar and the member name', sa.ok && sa.barName === NAME, JSON.stringify(sa));
  const startBtn = page.locator('button', { hasText: /Mulai Simulasi/i }).first();
  if (await startBtn.count()) {
    await startBtn.click().catch(() => {});
    await page.waitForFunction(() => !!document.querySelector('#app-main canvas'), null, { timeout: 20000 }).catch(() => {});
    ok('J4 simulator: "Mulai Simulasi" builds the WebGL scene (canvas)', await page.evaluate(() => !!document.querySelector('#app-main canvas')));
  } else info('J4 simulator start button', 'not found');
  await shot('j4-simulator');
  // sign out from the portal bar
  await page.locator('[data-pp-signout]').click();
  await waitFile(/index\.html$/);
  ok('J4 portal-bar "Keluar" → index.html, signed out', /index\.html$/.test(file()) && await page.evaluate(() => !localStorage.getItem('ppapi_demo_session')), file());

  // third party scanning the QR (signed out)
  await goto(`verifikasi.html?kta=${encodeURIComponent(KTA)}`);
  await page.waitForSelector('.vf-result', { timeout: 6000 }).catch(() => {});
  ok('J4 signed-out verifikasi?kta= → Terverifikasi with name + validity', await page.locator('.vf-result--ok').isVisible() && (await text('.vf-result')).includes(NAME) && /2029/.test(await text('.vf-result')), await text('.vf-result'));
  await shot('j4-verifikasi-public');

  // pendaftaran Aktif view
  await signIn(EMAIL, PASS, 'pendaftaran.html');
  await dafReady();
  ok('J4 pendaftaran.html for an Aktif member: "active" view with KTA', (await dafView()) === 'active' && (await text('main')).includes(KTA), await dafView());
});

/* =====================================================================================
   J5 — revision loop + rejection on a contoh applicant
   ===================================================================================== */
async function actAs(uid) { // switch the demo session to a seeded contoh member (they have no password)
  await page.evaluate((id) => {
    const m = JSON.parse(localStorage.getItem('ppapi_member_' + id));
    const u = { uid: id, name: m.name, email: m.email, phone: m.phone || '', provider: 'password', photoURL: '', createdAt: m.createdAt || '2026-10-01T00:00:00.000Z' };
    const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
    if (!users[u.email]) { users[u.email] = { ...u, hash: 'x' }; localStorage.setItem('ppapi_demo_users', JSON.stringify(users)); }
    sessionStorage.removeItem('ppapi_demo_session');
    localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
  }, uid);
}
await step('J5 revision + rejection on a contoh applicant', async () => {
  const BAGUS = 'demo-contoh-0001';
  const REV = 'Mohon unggah ulang sertifikat teknisi dengan tautan yang dapat dibuka dan lengkapi tahun proyek terakhir.';
  await goto('index.html');
  if (await page.locator('.account__trigger').isVisible().catch(() => false)) await signOutViaMenu(/index\.html$/).catch(() => {});
  await signIn(ADMIN.email, ADMIN.pass, 'admin.html#permohonan');
  await admReady();
  ok('J5 admin sign-in with next=admin.html#permohonan lands on the queue', /^admin\.html#permohonan/.test(file()), file());
  await page.click(`#pq-list .adm-act[data-id="${BAGUS}"]`);
  await drawerOpen();
  await page.click('#act-revise');
  await modalOpen();
  await page.fill('.modal textarea[name="note"]', REV);
  await page.click('#dlg-revise-ok');
  await modalGone();
  let b = await memberRec(BAGUS);
  ok('J5 Minta Perbaikan → Perlu Perbaikan + note', b.status === 'Perlu Perbaikan' && b.review.note === REV, b.status);
  await closeDrawer();
  await signOutViaMenu();

  await actAs(BAGUS);
  await goto('dashboard.html');
  await page.waitForSelector('#dash-status-view:not([hidden])', { timeout: 8000 }).catch(() => {});
  ok('J5 member dashboard: "Perlu Perbaikan" with the secretariat note', /Perlu Perbaikan/.test(await text('#dash-sc-title')) && (await text('.dash-sc__note-text')).includes(REV), `${await text('#dash-sc-title')} | ${(await text('.dash-sc__note-text')).slice(0, 80)}`);
  const cta = await page.evaluate(() => [...document.querySelectorAll('.dash-sc__actions a')].map(a => a.textContent.replace(/\s+/g, ' ').trim() + '→' + a.getAttribute('href')).join(', '));
  ok('J5 dashboard CTA "Perbaiki Pengajuan" → pendaftaran.html', /Perbaiki[^→]*→pendaftaran\.html/.test(cta), cta);
  const mn = await menu();
  ok('J5 Perlu Perbaikan menu: Dasbor | Formulir Pendaftaran | Keluar + badge', mn.labels === 'Dasbor|Formulir Pendaftaran|Keluar' && mn.badges.join() === 'Perlu Perbaikan', `${mn.labels} [${mn.badges}]`);
  await shot('j5-revision-dashboard', true);
  await goto('pendaftaran.html');
  await dafReady();
  ok('J5 pendaftaran (revision): wizard + admin note quoted', (await dafView()) === 'wizard' && (await text('main')).includes(REV), await dafView());
  // resubmit as is → review → "Kirim Perbaikan"
  await page.click('[data-step="6"]').catch(() => {});
  await sleep(300);
  const btnLabel = await text('.daf-foot__next');
  ok('J5 review submit button reads "Kirim Perbaikan"', /Kirim Perbaikan/.test(btnLabel), btnLabel);
  await page.click('.daf-foot__next');
  await page.waitForFunction(() => document.getElementById('daf-root').getAttribute('data-view') === 'pending', null, { timeout: 8000 }).catch(() => {});
  b = await memberRec(BAGUS);
  ok('J5 resubmitted → Menunggu Verifikasi', b.status === 'Menunggu Verifikasi', b.status + ' / view ' + (await dafView()));
  await signOutViaMenu();

  // reject
  const REJ = 'Pengalaman lapangan belum memenuhi syarat minimal kategori Praktisi.';
  await signIn(ADMIN.email, ADMIN.pass, 'admin.html#permohonan');
  await admReady();
  await page.click(`#pq-list .adm-act[data-id="${BAGUS}"]`);
  await drawerOpen();
  await page.click('#act-reject');
  await modalOpen();
  await page.click('#dlg-reject-ok');
  await sleep(200);
  ok('J5 Tolak without a reason → inline error, dialog stays open', (await page.locator('.modal .field.is-invalid').count()) > 0);
  await page.fill('.modal textarea[name="note"]', REJ);
  await page.click('#dlg-reject-ok');
  await modalGone();
  b = await memberRec(BAGUS);
  ok('J5 Tolak → Ditolak + reason; history keeps perbaikan + ditolak', b.status === 'Ditolak' && b.review.note === REJ && ['perbaikan', 'ditolak'].every(a => b.review.history.some(x => x.action === a)), b.status);
  await closeDrawer();
  await signOutViaMenu();
  await actAs(BAGUS);
  await goto('dashboard.html');
  await page.waitForSelector('#dash-status-view:not([hidden])', { timeout: 8000 }).catch(() => {});
  const cta2 = await page.evaluate(() => [...document.querySelectorAll('.dash-sc__actions a')].map(a => a.textContent.replace(/\s+/g, ' ').trim() + '→' + a.getAttribute('href')).join(', '));
  ok('J5 member sees Ditolak + reason + "Ajukan Ulang"', /Ditolak/.test(await text('#dash-sc-title')) && (await text('.dash-sc__note-text')).includes(REJ) && /Ajukan Ulang→pendaftaran\.html/.test(cta2), `${await text('#dash-sc-title')} | ${cta2}`);
  await shot('j5-rejected-dashboard', true);
  await goto('pendaftaran.html');
  await dafReady();
  ok('J5 Ditolak: pendaftaran offers the wizard again (re-apply)', (await dafView()) === 'wizard', await dafView());
  await signOutViaMenu();
});

/* =====================================================================================
   J6 — admin content → public pages
   ===================================================================================== */
await step('J6 admin content create → public pages', async () => {
  await signIn(ADMIN.email, ADMIN.pass, 'admin.html#konten/berita');
  await admReady();
  await page.waitForSelector('#kt-list tbody tr', { timeout: 8000 });
  // berita
  await page.click('#kt-add');
  await modalOpen();
  await page.fill('.modal [name="judul"]', NEWS_TITLE);
  await page.selectOption('.modal [name="kategori"]', { index: 1 }).catch(() => {});
  await page.fill('.modal [name="ringkasan"]', 'Komite Teknis membahas rancangan Code of Practice pemasangan perancah tube & coupler.');
  await page.fill('.modal [name="isi"]', 'Paragraf pembuka berita uji.\n\n## Butir pembahasan\n- Rancangan CoP-01\n- Jadwal uji publik\n\nParagraf penutup.');
  await page.click('#dlg-content-ok');
  await modalGone();
  NEWS_ID = (await page.evaluate((t) => PPAPI.store.content.list('berita').then(l => (l.find(x => x.judul === t) || {}).id || ''), NEWS_TITLE));
  ok('J6 berita created (managed)', !!NEWS_ID, NEWS_ID);
  // hide a built-in article → it disappears from the public list; restored afterwards
  const staticNews = await page.evaluate(() => PPAPI.data.berita[1]);
  await page.locator(`#kt-list [data-content-act="hide"][data-id="${staticNews.id}"]`).click({ timeout: 10000 });
  await modalOpen();
  await page.locator('.modal__footer .btn').last().click();
  await modalGone();
  ok('J6 built-in berita hidden (store)', !(await page.evaluate((id) => PPAPI.store.content.list('berita').then(l => l.some(x => x.id === id)), staticNews.id)));
  HIDDEN_NEWS = staticNews;
  // agenda
  await page.click('.adm-subnav__link[data-type="agenda"]');
  await page.waitForSelector('#kt-list tbody tr');
  await page.click('#kt-add');
  await modalOpen();
  await page.fill('.modal [name="judul"]', AGENDA_TITLE);
  await page.fill('.modal [name="mulai"]', '2026-11-18');
  await page.fill('.modal [name="waktu"]', '09.00 – 15.00 WIB');
  await page.fill('.modal [name="lokasi"]', 'Bekasi, Gedung Serbaguna PPAPI');
  await page.fill('.modal [name="deskripsi"]', 'Klinik teknis untuk anggota: inspeksi perancah sistem ringlock dan cuplock.');
  await page.click('#dlg-content-ok');
  await modalGone();
  AGENDA_ID = (await page.evaluate((t) => PPAPI.store.content.list('agenda').then(l => (l.find(x => x.judul === t) || {}).id || ''), AGENDA_TITLE));
  ok('J6 agenda created (managed)', !!AGENDA_ID, AGENDA_ID);
  // pustaka (member-only file)
  await page.click('.adm-subnav__link[data-type="pustaka"]');
  await page.waitForSelector('#kt-list tbody tr');
  await page.click('#kt-add');
  await modalOpen();
  await page.fill('.modal [name="judul"]', DOC_TITLE);
  await page.selectOption('.modal [name="kategori"]', 'Petunjuk Teknis').catch(() => {});
  await page.selectOption('.modal [name="status"]', 'Berlaku').catch(() => {});
  await page.fill('.modal [name="kode"]', 'PPAPI-PT-09');
  await page.fill('.modal [name="ringkasan"]', 'Tata cara penandaan perancah dengan scafftag hijau, kuning, dan merah.');
  await page.fill('.modal [name="tautan"]', DOC_URL);
  await page.click('#dlg-content-ok');
  await modalGone();
  const doc = await page.evaluate((t) => PPAPI.store.content.list('pustaka').then(l => l.find(x => x.judul === t) || null), DOC_TITLE);
  DOC_ID = doc ? doc.id : '';
  ok('J6 pustaka created: public item has no link, berkasAnggota true', !!doc && doc.tautan === '' && doc.berkasAnggota === true && doc.akses === 'anggota', JSON.stringify(doc || {}).slice(0, 200));
  await shot('j6-konten');
  await signOutViaMenu();

  // public pages (signed out)
  await goto('berita.html');
  const bt = await page.evaluate((id) => ({ found: !!document.querySelector(`a[href="berita.html?id=${id}"]`), b: !!document.querySelector('main b'), txt: document.querySelector('main').innerText }), NEWS_ID);
  ok('J6 berita.html lists the new article (escaped title, no <b> element)', bt.found && !bt.b && bt.txt.includes('Rapat Koordinasi Komite Teknis Perancah <b>2026</b>'), JSON.stringify({ found: bt.found, b: bt.b }));
  if (HIDDEN_NEWS) {
    ok('J6 hidden built-in article no longer on berita.html', !(await page.evaluate((id) => !!document.querySelector(`main a[href="berita.html?id=${id}"]`), HIDDEN_NEWS.id)), HIDDEN_NEWS.id);
    await goto(`berita.html?id=${encodeURIComponent(HIDDEN_NEWS.id)}`);
    ok('J6 hidden built-in article: detail URL shows "tidak ditemukan"', /tidak ditemukan/i.test(await text('main')), (await text('h1')).slice(0, 80));
    await goto('berita.html');
  }
  await goto(`berita.html?id=${encodeURIComponent(NEWS_ID)}`);
  const det = await page.evaluate(() => ({ h1: document.querySelector('h1')?.innerText, main: document.querySelector('main').innerText, title: document.title }));
  ok('J6 berita detail: title, subheading and list from the console', det.h1.includes('Rapat Koordinasi Komite Teknis') && /Butir pembahasan/.test(det.main) && /Rancangan CoP-01/.test(det.main) && /Rapat Koordinasi/.test(det.title), JSON.stringify(det).slice(0, 200));
  await shot('j6-berita-detail');
  await goto('index.html');
  ok('J6 beranda news section shows the new article', await page.evaluate((id) => !!document.querySelector(`a[href="berita.html?id=${id}"]`), NEWS_ID));
  await goto('agenda.html');
  ok('J6 agenda.html lists the new event', (await text('main')).includes(AGENDA_TITLE));
  await goto(`agenda.html?id=${encodeURIComponent(AGENDA_ID)}`);
  await page.waitForSelector('.modal', { timeout: 5000 }).catch(() => {});
  ok('J6 agenda.html?id= opens the event detail', (await text('.modal')).includes(AGENDA_TITLE) && /18/.test(await text('.modal')), (await text('.modal')).slice(0, 120));
  await page.keyboard.press('Escape');
  await goto('pustaka.html');
  await sleep(400);
  const card = page.locator(`[data-key="d:${DOC_ID}"]`);
  ok('J6 pustaka (signed out): new document listed + locked', (await card.count()) === 1 && /Terkunci/.test(await card.locator('.doc-card__access').textContent().catch(() => '')), await card.locator('.doc-card__access').textContent().catch(() => 'missing card'));
  // member opens the file
  await signIn(EMAIL, PASS, 'pustaka.html');
  await sleep(500);
  ok('J6 pustaka (active member): "Dapat dibuka"', /Dapat dibuka/.test(await page.locator(`[data-key="d:${DOC_ID}"] .doc-card__access`).textContent().catch(() => '')));
  await page.locator(`[data-pk-open="d:${DOC_ID}"]`).first().click();
  await page.waitForSelector('.modal a.btn--primary', { timeout: 5000 }).catch(() => {});
  const href = await page.locator('.modal a.btn--primary').first().getAttribute('href').catch(() => '');
  ok('J6 member: "Buka Dokumen" → the private link from the console', href === DOC_URL, href);
  await page.keyboard.press('Escape');
  await goto('dashboard.html');
  await page.waitForSelector('#dash-berita:not([aria-busy="true"])', { timeout: 6000 }).catch(() => {});
  ok('J6 member dashboard: new article + new document appear', (await text('#dash-berita')).includes('Rapat Koordinasi Komite Teknis') && (await text('#dash-pustaka')).includes('Penandaan Scafftag'), `${(await text('#dash-berita')).slice(0, 80)} | ${(await text('#dash-pustaka')).slice(0, 80)}`);
  await signOutViaMenu();
  if (HIDDEN_NEWS) {
    await signIn(ADMIN.email, ADMIN.pass, 'admin.html#konten/berita');
    await admReady();
    await page.waitForSelector('#kt-list tbody tr', { timeout: 8000 }).catch(() => {});
    await page.click(`#kt-list [data-content-act="restore"][data-id="${HIDDEN_NEWS.id}"]`);
    await sleep(300);
    if (await page.locator('.modal__dialog').count()) { await page.locator('.modal__footer .btn').last().click(); await modalGone(); }
    ok('J6 hidden article restored (store)', await page.evaluate((id) => PPAPI.store.content.list('berita').then(l => l.some(x => x.id === id)), HIDDEN_NEWS.id));
  }
  if (await page.locator('.account__trigger').isVisible().catch(() => false)) await signOutViaMenu();
});

/* =====================================================================================
   J7 — feedback → admin status workflow
   ===================================================================================== */
await step('J7 feedback → admin workflow', async () => {
  await goto('umpan-balik.html');
  await page.locator('input[name=kategori][value=Pertanyaan] + .segmented__option').click();
  await page.fill('#ub-nama', 'Hendra Wijaya');
  await page.fill('#ub-email', 'hendra.wijaya@contoh.id');
  await page.fill('#ub-subjek', 'Jadwal uji kompetensi inspektur');
  await page.fill('#ub-pesan', 'Kapan jadwal uji kompetensi inspektur perancah berikutnya di wilayah Jawa Barat?\nTerima kasih.');
  await page.locator('label[for=ub-r5]').click();
  await page.check('#ub-consent');
  await page.locator('form button[type=submit]').first().click();
  await sleep(1500);
  const ref = ((await text('main')).match(/UB-\d{8}-[A-Z0-9]{4}/) || [])[0];
  ok('J7 visitor feedback → reference number', !!ref, ref);
  await signIn(ADMIN.email, ADMIN.pass, 'admin.html');
  await admReady();
  const cnt = await page.$eval('[data-count-for="umpan-balik"]', e => e.hidden ? '' : e.textContent.trim()).catch(() => '');
  ok('J7 admin nav: Umpan Balik count ≥ 1', /^\d+/.test(cnt) && parseInt(cnt, 10) >= 1, cnt);
  await admNav('umpan-balik');
  ok('J7 feedback listed (status Baru)', /Jadwal uji kompetensi inspektur/.test(await text('#fb-list')) && /Baru/.test(await text('#fb-list')));
  const row = page.locator('#fb-list tr', { hasText: 'Jadwal uji kompetensi inspektur' }).locator('.adm-act').first();
  await row.click();
  await drawerOpen();
  ok('J7 drawer: message + mailto reply', (await text('.drawer__panel')).includes('Kapan jadwal uji kompetensi') && (await page.locator('.drawer a[href^="mailto:hendra.wijaya@contoh.id"]').count()) === 1);
  await page.click('.drawer input[name="status"][value="Diproses"] + .segmented__option');
  await page.fill('.drawer textarea[name="catatanAdmin"]', 'Diteruskan ke Bidang Sertifikasi.');
  await page.click('#fb-save');
  await page.waitForSelector('.drawer', { state: 'detached', timeout: 5000 }).catch(() => {});
  await sleep(200);
  let fb = (await page.evaluate(() => PPAPI.store.admin.listFeedback())).find(f => f.subjek === 'Jadwal uji kompetensi inspektur');
  ok('J7 status Baru → Diproses + catatan', fb && fb.status === 'Diproses' && fb.catatanAdmin === 'Diteruskan ke Bidang Sertifikasi.', fb && fb.status);
  await page.locator('#fb-list tr', { hasText: 'Jadwal uji kompetensi inspektur' }).locator('.adm-act').first().click();
  await drawerOpen();
  await page.click('.drawer input[name="status"][value="Selesai"] + .segmented__option');
  await page.fill('.drawer textarea[name="catatanAdmin"]', 'Dijawab melalui email pada 9 Oktober 2026.');
  await page.click('#fb-save');
  await page.waitForSelector('.drawer', { state: 'detached', timeout: 5000 }).catch(() => {});
  await sleep(200);
  fb = (await page.evaluate(() => PPAPI.store.admin.listFeedback())).find(f => f.subjek === 'Jadwal uji kompetensi inspektur');
  ok('J7 status Diproses → Selesai', fb && fb.status === 'Selesai' && /Dijawab/.test(fb.catatanAdmin), fb && fb.status);
  ok('J7 list shows Selesai', /Selesai/.test(await page.locator('#fb-list tr', { hasText: 'Jadwal uji kompetensi inspektur' }).textContent()));
  const log = await page.evaluate(() => PPAPI.store.admin.audit(10).then(a => a.map(x => x.action)));
  info('J7 latest audit actions (newest first)', log.join(', '));
  ok('J7 audit log newest first: 2 feedback updates, restore, pustaka, agenda, hide, berita', log.slice(0, 7).join(',') === 'umpan-balik.diperbarui,umpan-balik.diperbarui,konten.dipulihkan,konten.disimpan,konten.disimpan,konten.dihapus,konten.disimpan', log.join(', '));
  ok('J7 audit log records the feedback updates', log.some(a => /umpan|feedback/i.test(a)), log.join(', '));
  await signOutViaMenu();
});

/* =====================================================================================
   J8 — deactivate → everything locks → reactivate
   ===================================================================================== */
await step('J8 deactivate the approved member', async () => {
  await signIn(ADMIN.email, ADMIN.pass, 'admin.html#anggota');
  await admReady();
  await page.fill('#aq-q', 'Rina Kartika');
  await sleep(400);
  await page.click(`#aq-list .adm-act[data-id="${UID}"]`);
  await drawerOpen();
  await page.click('#act-deactivate');
  await modalOpen();
  await page.fill('.modal textarea[name="note"]', 'Dinonaktifkan sementara: iuran tahunan belum diterima.');
  await page.click('#dlg-deactivate-ok');
  await modalGone();
  const m = await memberRec(UID);
  ok('J8 Nonaktifkan → Nonaktif (KTA kept)', m.status === 'Nonaktif' && m.kta === KTA, m.status);
  await closeDrawer();
  await signOutViaMenu();

  await signIn(EMAIL, PASS);
  await page.waitForSelector('#dash-status-view:not([hidden])', { timeout: 8000 }).catch(() => {});
  ok('J8 member dashboard: status centre "Nonaktif" + note', /Nonaktif/.test(await text('#dash-sc-title')) && /iuran tahunan/.test(await text('#dash-sc')), await text('#dash-sc-title'));
  ok('J8 no app links / active view hidden', !(await page.locator('#dash-active-view').isVisible()) && (await page.locator('main a[href*="aplikasi/"]').count()) === 0);
  const mn = await menu();
  ok('J8 Nonaktif menu: Dasbor | Formulir Pendaftaran | Keluar, badge Nonaktif', mn.labels === 'Dasbor|Formulir Pendaftaran|Keluar' && mn.badges.join() === 'Nonaktif', `${mn.labels} [${mn.badges}]`);
  await shot('j8-nonaktif-dashboard', true);
  let g = await gatedTo('anggota.html');
  ok('J8 anggota.html → dashboard + toast', /^dashboard\.html/.test(g.file) && await toastSeen(/khusus anggota berstatus Aktif/), g.file);
  await clearToasts();
  g = await gatedTo('aplikasi/perencanaan/index.html');
  ok('J8 planning app → dashboard', /^dashboard\.html/.test(g.file), g.file);
  await clearToasts();
  g = await gatedTo('aplikasi/simulator/index.html');
  ok('J8 simulator → dashboard', /^dashboard\.html/.test(g.file), g.file);
  await goto('pustaka.html');
  await sleep(300);
  ok('J8 pustaka locked again', (await page.locator('.pk-lockbar').count()) > 0 && (await page.locator(`[data-key="d:${DOC_ID}"] .doc-card--locked, [data-key="d:${DOC_ID}"].doc-card--locked`).count()) === 1);
  const fu = await page.evaluate(async (id) => { try { return 'resolved:' + await PPAPI.store.pustaka.fileUrl((await PPAPI.store.content.list('pustaka')).find(x => x.id === id)); } catch (e) { return e.code; } }, DOC_ID);
  ok('J8 fileUrl refused (store/forbidden)', fu === 'store/forbidden', fu);
  await goto(`verifikasi.html?kta=${encodeURIComponent(KTA)}`);
  await page.waitForSelector('.vf-result', { timeout: 6000 }).catch(() => {});
  ok('J8 verifikasi: not "Terverifikasi", shows Nonaktif', !(await page.locator('.vf-result--ok').isVisible().catch(() => false)) && /Nonaktif/i.test(await text('.vf-result')), await text('.vf-result'));
  await goto('dashboard.html');
  await signOutViaMenu();

  // reactivate
  await signIn(ADMIN.email, ADMIN.pass, 'admin.html#anggota');
  await admReady();
  await page.fill('#aq-q', 'Rina Kartika');
  await sleep(400);
  await page.click(`#aq-list .adm-act[data-id="${UID}"]`);
  await drawerOpen();
  await page.click('#act-reactivate');
  await modalOpen();
  await page.click('#dlg-reactivate-ok');
  await modalGone();
  const m2 = await memberRec(UID);
  ok('J8 Aktifkan Kembali → Aktif, validity 2029-12-31 kept', m2.status === 'Aktif' && m2.validUntil === '2029-12-31' && m2.kta === KTA, `${m2.status} ${m2.validUntil}`);
  await closeDrawer();
  await signOutViaMenu();
});

/* =====================================================================================
   J9 — Kedaluwarsa → perpanjangan → approved
   ===================================================================================== */
await step('J9 renewal of an expired membership', async () => {
  await setClock('2030-01-15T03:00:00.000Z');
  await signIn(EMAIL, PASS);
  ok('J9 clock moved: today is 2030-01-15', (await page.evaluate(() => PPAPI.util.todayIso())) === '2030-01-15');
  await page.waitForSelector('#dash-status-view:not([hidden])', { timeout: 8000 }).catch(() => {});
  ok('J9 dashboard: "Kedaluwarsa"', /Kedaluwarsa/.test(await text('#dash-sc-title')), await text('#dash-sc-title'));
  const cta = await page.evaluate(() => [...document.querySelectorAll('.dash-sc__actions a')].map(a => a.textContent.replace(/\s+/g, ' ').trim() + '→' + a.getAttribute('href')).join(', '));
  ok('J9 CTA "Ajukan Perpanjangan" → pendaftaran.html', /Ajukan Perpanjangan→pendaftaran\.html/.test(cta), cta);
  const mn = await menu();
  ok('J9 Kedaluwarsa menu: Dasbor | Formulir Pendaftaran | Keluar, badge Kedaluwarsa', mn.labels === 'Dasbor|Formulir Pendaftaran|Keluar' && mn.badges.join() === 'Kedaluwarsa', `${mn.labels} [${mn.badges}]`);
  let g = await gatedTo('anggota.html');
  ok('J9 Kedaluwarsa: anggota.html → dashboard', /^dashboard\.html/.test(g.file), g.file);
  await clearToasts();
  await shot('j9-kedaluwarsa', true);
  await page.locator('.dash-sc__actions a', { hasText: 'Ajukan Perpanjangan' }).first().click();
  await waitFile(/pendaftaran\.html/);
  await dafReady();
  ok('J9 pendaftaran: renewal wizard', (await dafView()) === 'wizard' && /perpanjangan/i.test(await text('main')), await dafView());
  let m = await memberRec(UID);
  ok('J9 renewal draft: type perpanjangan, declarations cleared, kategori kept', m.application.type === 'perpanjangan' && !m.application.pernyataan.kodeEtik && m.application.kategori === 'Praktisi', `${m.application.type} ${JSON.stringify(m.application.pernyataan)}`);
  await page.click('[data-step="5"]');
  await sleep(300);
  await page.check('#f-kodeEtik');
  await page.check('#f-kebenaranData');
  await page.check('#f-privasi');
  await page.fill('#f-namaTerang', NAME);
  await dafSettle();
  await page.click('[data-step="6"]');
  await sleep(300);
  await dafSettle();
  const lbl = await text('.daf-foot__next');
  info('J9 renewal submit label', lbl);
  await page.click('.daf-foot__next');
  if (await page.locator('.modal__dialog').count()) { await page.locator('.modal .modal__footer .btn').last().click(); }
  await page.waitForFunction(() => document.getElementById('daf-root').getAttribute('data-view') === 'pending', null, { timeout: 8000 }).catch(() => {});
  m = await memberRec(UID);
  ok('J9 renewal submitted → Menunggu Verifikasi (perpanjangan), KTA kept', m.status === 'Menunggu Verifikasi' && m.application.type === 'perpanjangan' && m.kta === KTA, `${m.status} ${m.application.type} ${m.kta}`);
  await shot('j9-renewal-pending', true);
  await goto(`verifikasi.html?kta=${encodeURIComponent(KTA)}`);
  await page.waitForSelector('.vf-result', { timeout: 6000 }).catch(() => {});
  ok('J9 during the pending renewal verifikasi does not say "Terverifikasi" (validity 2029 has passed)', !(await page.locator('.vf-result--ok').isVisible().catch(() => false)), await text('.vf-result'));
  await goto('dashboard.html');
  await signOutViaMenu();
  await goto(`verifikasi.html?kta=${encodeURIComponent(KTA)}`);
  await page.waitForSelector('.vf-result', { timeout: 6000 }).catch(() => {});
  ok('J9 signed-out third party during the pending renewal: not "Terverifikasi"', !(await page.locator('.vf-result--ok').isVisible().catch(() => false)), await text('.vf-result'));

  await signIn(ADMIN.email, ADMIN.pass, 'admin.html#permohonan');
  await admReady();
  const qrow = await page.evaluate((id) => document.querySelector(`#pq-list tr:has([data-id="${id}"])`)?.innerText.replace(/\s+/g, ' ') || '', UID);
  ok('J9 queue marks the renewal (Perpanjangan)', /perpanjangan/i.test(qrow), qrow.slice(0, 160));
  await page.click(`#pq-list .adm-act[data-id="${UID}"]`);
  await drawerOpen();
  await page.click('#act-approve');
  await modalOpen();
  const until = await page.$eval('.modal [name="validUntil"]', i => i.value);
  ok('J9 approve dialog proposes 2033-12-31 (2030 + 3 years)', until === '2033-12-31', until);
  await page.click('#dlg-approve-ok');
  await page.waitForSelector('#adm-kta-result', { timeout: 8000 }).catch(() => {});
  const kta2 = (await text('.adm-kta__num')).trim();
  ok('J9 renewal approval keeps the KTA', kta2 === KTA, kta2);
  await page.locator('.modal__footer .btn').last().click().catch(() => {});
  await modalGone();
  await closeDrawer();
  m = await memberRec(UID);
  ok('J9 member Aktif until 2033-12-31', m.status === 'Aktif' && m.validUntil === '2033-12-31', `${m.status} ${m.validUntil}`);
  const look = await page.evaluate(k => PPAPI.store.registry.lookup(k), KTA);
  ok('J9 registry: Aktif, berlakuHingga 2033-12-31', look.exact && look.exact.status === 'Aktif' && look.exact.berlakuHingga === '2033-12-31', JSON.stringify(look.exact));
  await signOutViaMenu();
  await signIn(EMAIL, PASS, 'anggota.html#kartu');
  ok('J9 member back on anggota.html#kartu (active again)', /^anggota\.html/.test(file()), file());
  await page.waitForFunction(() => /ready|fallback/.test(document.querySelector('#kta-qr')?.getAttribute('data-state') || ''), null, { timeout: 20000 }).catch(() => {});
  ok('J9 KTA card shows the new validity (2033)', /2033/.test(await text('#kta')), (await text('#kta')).slice(0, 160));
  await signOutViaMenu();
  await setClock('');
});

await ctx.close();
await browser.close();
await srv.close();
const relevant = issues.filter(x => !/favicon/.test(x));
ok('journey-v2: no console errors/warnings, page errors or failed requests', relevant.length === 0, relevant.slice(0, 10).join(' || '));
const failed = R.summary();
fs.writeFileSync(path.join(SHOTS, `journey-v2${MOBILE ? '-mobile' : ''}-results.json`), JSON.stringify({ results: R.results, issues: relevant, kta: KTA, uid: UID }, null, 2));
process.exitCode = failed ? 1 : 0;
