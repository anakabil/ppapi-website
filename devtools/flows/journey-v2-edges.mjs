// Edge journeys for PPAPI v2 (Demo mode, one browser context — admin and members share localStorage).
// Companion to journey-v2.mjs: these cover lifecycle corners the happy path does not reach.
//   X1  category drift on renewal: applied "Praktisi", approved as "Ahli" (console) → expires → renewal form
//       and the console's approve dialog default to the OLD application category
//   X2  early renewal (Aktif, ≤ 60 days left) rejected by the secretariat → member status / public registry
//   X3  revision loop: after "Kirim Perbaikan" the dashboard must not keep showing the old revision request
//   X4  applicant who signed up by phone (no e-mail) → contact e-mail in the wizard and the console
//   X5  Back button after signing out (admin console, profil anggota, member app)
//   X6  verifikasi by name finds a member approved in the console
//   X7  admin role granted to an approved member through the console → member's menu / console access → revoked
//   X8  a deactivated (Nonaktif) member self-submits a "perpanjangan" → what the secretariat sees
// Members without a password (fixtures) are "signed in" by writing the demo session, like aplikasi-lib setSession.
// Run from devtools/:  node flows/journey-v2-edges.mjs [--headed]
// Screenshots: devtools/shots/qa/journey-v2-edges-*.png · results: devtools/shots/qa/journey-v2-edges-results.json
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, waitReady, recorder, SHOTS } from './qa-lib.mjs';

const args = process.argv.slice(2);
const R = recorder('journey-v2-edges');
const { ok, info } = R;
const issues = [];
const srv = await startServer();
const BASE = srv.BASE;
const browser = await chromium.launch({ headless: !args.includes('--headed'), args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
await ctx.addInitScript((defIso) => { // ticking clock, continuous across navigations, movable via localStorage
  const real = Date; let iso = defIso, anchor = 0;
  try {
    iso = localStorage.getItem('__qa_clock') || defIso;
    anchor = Number(localStorage.getItem('__qa_clock_anchor')) || 0;
    if (!anchor) { anchor = real.now(); localStorage.setItem('__qa_clock_anchor', String(anchor)); }
    localStorage.setItem('ppapi_demo_ribbon_dismissed', 'true');
  } catch (e) { anchor = real.now(); }
  const offset = new real(iso).getTime() - anchor;
  class FakeDate extends real { constructor(...a) { if (a.length) super(...a); else super(real.now() + offset); } static now() { return real.now() + offset; } }
  FakeDate.UTC = real.UTC; FakeDate.parse = real.parse; window.Date = FakeDate;
}, '2026-10-09T03:00:00.000Z');
const page = await ctx.newPage();
page.on('console', m => { if (['error', 'warning'].includes(m.type())) issues.push(`console.${m.type()}: ${m.text().slice(0, 300)} @ ${page.url()}`); });
page.on('pageerror', e => issues.push(`pageerror: ${e.message.slice(0, 300)} @ ${page.url()}`));
page.on('dialog', d => { issues.push('native dialog: ' + d.message()); d.dismiss().catch(() => {}); });

/* ---------- helpers ---------- */
const sleep = (ms) => page.waitForTimeout(ms);
const shot = (n, full = false) => page.screenshot({ path: path.join(SHOTS, `journey-v2-edges-${n}.png`), fullPage: full }).catch(() => {});
const settle = async () => { await page.waitForLoadState('networkidle').catch(() => {}); await waitReady(page); };
async function goto(u) { await page.goto(`${BASE}/${u}`, { waitUntil: 'networkidle' }); await settle(); }
const file = () => { const u = new URL(page.url()); return u.pathname.split('/').pop() + u.search + u.hash; };
const text = async (sel) => ((await page.locator(sel).first().textContent({ timeout: 4000 }).catch(() => '')) || '').replace(/\s+/g, ' ').trim();
async function setClock(iso) { await page.evaluate(v => { if (v) localStorage.setItem('__qa_clock', v); else localStorage.removeItem('__qa_clock'); localStorage.setItem('__qa_clock_anchor', String(Math.round(performance.timeOrigin + performance.now()))); }, iso); }
const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
async function signOut() { await page.evaluate(() => { localStorage.removeItem('ppapi_demo_session'); sessionStorage.removeItem('ppapi_demo_session'); }); }
async function as(user) { // write the demo session (admin or a fixture member)
  await page.evaluate((u) => {
    const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
    if (u.email && !users[u.email]) { users[u.email] = { ...u, hash: 'x' }; localStorage.setItem('ppapi_demo_users', JSON.stringify(users)); }
    sessionStorage.removeItem('ppapi_demo_session');
    localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
  }, user);
}
function fixture(uid, name, o = {}) {
  const email = uid + '@contoh.id';
  const user = { uid, name, email, phone: '+628120000' + uid.slice(-4), provider: 'password', photoURL: '', createdAt: '2026-01-10T02:00:00.000Z' };
  const member = {
    uid, name, email, phone: user.phone, kta: '', memberType: 'Praktisi', status: 'Draf', joinedAt: '2026-01-10', validUntil: '', approvedAt: '', approvedBy: '',
    profile: { birthPlace: 'Medan', birthDate: '1988-02-02', gender: 'Laki-laki', province: 'Sumatera Utara', city: 'Medan', address: 'Jl. Uji 1', company: 'PT Uji Tepi', position: 'Supervisor Perancah', experienceYears: 10, education: 'Diploma III (D3)', bio: '', linkedin: '' },
    competencies: [], certificates: [],
    application: { type: 'baru', kategori: 'Praktisi', submittedAt: '', updatedAt: '', pengalaman: [{ id: 'p1', proyek: 'Proyek uji tepi', peran: 'Supervisor', tahun: '2024', lokasi: 'Medan' }], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: name, tanggal: '2026-10-01' }, catatan: '' },
    review: { note: '', history: [] }, createdAt: '2026-01-10T02:00:00.000Z', updatedAt: '2026-10-01T02:00:00.000Z',
  };
  for (const [k, v] of Object.entries(o)) { if (k === 'application') Object.assign(member.application, v); else member[k] = v; }
  return { user, member };
}
async function put(member) { await page.evaluate((m) => localStorage.setItem('ppapi_member_' + m.uid, JSON.stringify(m)), member); }
const rec = (uid) => page.evaluate(id => PPAPI.store.normalizeMember(JSON.parse(localStorage.getItem('ppapi_member_' + id))), uid);
async function admOpen(section) { await goto(`admin.html#${section}`); await page.waitForSelector('html[data-admin-ready]', { timeout: 15000 }); await sleep(200); }
async function drawer(listSel, uid) { await page.click(`${listSel} .adm-act[data-id="${uid}"]`); await page.waitForSelector('.drawer__panel', { timeout: 6000 }); await sleep(150); }
async function modal() { await page.waitForSelector('.modal__dialog', { timeout: 6000 }); await sleep(120); }
async function modalGone() { await page.waitForSelector('.modal', { state: 'detached', timeout: 6000 }).catch(() => {}); await sleep(150); }
async function closeDrawer() { await page.keyboard.press('Escape'); await page.waitForSelector('.drawer', { state: 'detached', timeout: 5000 }).catch(() => {}); await sleep(100); }
async function dafReady() { await page.waitForFunction(() => { const r = document.getElementById('daf-root'); return r && r.getAttribute('aria-busy') === 'false' && r.getAttribute('data-view'); }, null, { timeout: 15000 }).catch(() => {}); await sleep(200); }
async function step(label, fn) {
  console.log(`\n=== ${label} ===`);
  try { await fn(); } catch (e) {
    ok(`${label.split(' ')[0]} completed without exception`, false, e.message.split('\n')[0]);
    info(`${label.split(' ')[0]} call log`, e.message.split('\n').slice(1, 10).join(' / '));
    await shot(label.split(' ')[0] + '-FAIL', true);
    await page.keyboard.press('Escape').catch(() => {});
  }
}

await goto('index.html'); // demo seed (admin + contoh)

/* X1 — category drift on renewal */
await step('X1 category drift on renewal', async () => {
  const { user, member } = fixture('edge-x1-0001', 'Yusuf Kategori', { status: 'Menunggu Verifikasi', application: { submittedAt: '2026-10-05T02:00:00.000Z' } });
  await put(member);
  await as(ADMIN);
  await admOpen('permohonan');
  await drawer('#pq-list', user.uid);
  await page.click('#act-approve');
  await modal();
  await page.selectOption('.modal [name="memberType"]', 'Ahli');
  await page.click('#dlg-approve-ok');
  await page.waitForSelector('#adm-kta-result', { timeout: 8000 }).catch(() => {});
  await page.locator('.modal__footer .btn').last().click().catch(() => {});
  await modalGone(); await closeDrawer();
  let m = await rec(user.uid);
  ok('X1 approved in the console as "Ahli" (applied "Praktisi")', m.status === 'Aktif' && m.memberType === 'Ahli' && m.application.kategori === 'Praktisi', `${m.memberType} / application ${m.application.kategori}`);
  // time passes: validity 2029-12-31 → expired in 2030
  await setClock('2030-02-01T03:00:00.000Z');
  await as(user);
  await goto('pendaftaran.html');
  await dafReady();
  const sel = await page.evaluate(() => ({ checked: document.querySelector('input[name="kategori"]:checked')?.value || '', hint: document.querySelector('.daf-hint-line')?.textContent.replace(/\s+/g, ' ').trim() || '' }));
  m = await rec(user.uid);
  info('X1 renewal form category', JSON.stringify(sel) + ' · stored application.kategori=' + m.application.kategori);
  ok('X1 renewal form pre-selects the CURRENT category (Ahli)', sel.checked === 'Ahli' && m.application.kategori === 'Ahli', JSON.stringify(sel) + ' stored=' + m.application.kategori);
  await shot('x1-renewal-kategori');
  // member confirms the declarations and submits as is
  await page.click('[data-step="5"]'); await sleep(250);
  for (const id of ['#f-kodeEtik', '#f-kebenaranData', '#f-privasi']) await page.check(id);
  await page.fill('#f-namaTerang', user.name);
  await sleep(900);
  await page.click('[data-step="6"]'); await sleep(900);
  await page.click('.daf-foot__next');
  if (await page.locator('.modal__dialog').count()) await page.locator('.modal .modal__footer .btn').last().click();
  await page.waitForFunction(() => document.getElementById('daf-root').getAttribute('data-view') === 'pending', null, { timeout: 8000 }).catch(() => {});
  await as(ADMIN);
  await admOpen('permohonan');
  await drawer('#pq-list', user.uid);
  const badge = await page.evaluate(() => [...document.querySelectorAll('.drawer .adm-badges .badge')].map(b => b.textContent.trim()).join(' | '));
  await page.click('#act-approve');
  await modal();
  const def = await page.$eval('.modal [name="memberType"]', s => s.value);
  info('X1 drawer badges / approve default for the renewal', `${badge} / ${def}`);
  ok('X1 console approve dialog for the renewal defaults to the member\'s current category (Ahli)', def === 'Ahli', def);
  await shot('x1-approve-default');
  await page.keyboard.press('Escape'); await modalGone(); await closeDrawer();
  await setClock('');
});

/* X2 — early renewal rejected */
await step('X2 early renewal rejected', async () => {
  const kta = 'PPAPI-2026-000777';
  const { user, member } = fixture('edge-x2-0001', 'Lestari Perpanjang', {
    status: 'Aktif', kta, validUntil: '2026-11-30', approvedAt: '2023-11-20T02:00:00.000Z', approvedBy: 'demo-admin-0001', joinedAt: '2023-11-20',
    application: { submittedAt: '2023-11-10T02:00:00.000Z', pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Lestari Perpanjang', tanggal: '2023-11-10' } },
  });
  await put(member);
  await page.evaluate(([k, m]) => { const r = JSON.parse(localStorage.getItem('ppapi_registry') || '{}'); r[k] = { kta: k, nama: m.name, kategori: 'Praktisi', kompetensi: [], kota: 'Medan', berlakuHingga: '2026-11-30', status: 'Aktif', updatedAt: '2023-11-20T02:00:00.000Z' }; localStorage.setItem('ppapi_registry', JSON.stringify(r)); }, [kta, member]);
  await as(user);
  await goto('pendaftaran.html#perpanjangan');
  await dafReady();
  ok('X2 Aktif (52 days left) → #perpanjangan opens the renewal form', await page.evaluate(() => document.getElementById('daf-root').getAttribute('data-view')) === 'wizard');
  await page.click('[data-step="5"]').catch(() => {}); await sleep(250);
  for (const id of ['#f-kodeEtik', '#f-kebenaranData', '#f-privasi']) await page.check(id).catch(() => {});
  await page.fill('#f-namaTerang', user.name).catch(() => {});
  await sleep(900);
  await page.click('[data-step="6"]'); await sleep(900);
  await page.click('.daf-foot__next');
  if (await page.locator('.modal__dialog').count()) await page.locator('.modal .modal__footer .btn').last().click();
  await page.waitForFunction(() => document.getElementById('daf-root').getAttribute('data-view') === 'pending', null, { timeout: 8000 }).catch(() => {});
  let m = await rec(user.uid);
  ok('X2 early renewal submitted (Menunggu Verifikasi, perpanjangan)', m.status === 'Menunggu Verifikasi' && m.application.type === 'perpanjangan', m.status);
  await as(ADMIN);
  await admOpen('permohonan');
  await drawer('#pq-list', user.uid);
  const acts = await page.evaluate(() => [...document.querySelectorAll('.drawer__footer .btn')].map(b => b.textContent.trim()).join('|'));
  info('X2 console actions for an early renewal', acts);
  await page.click('#act-reject');
  await modal();
  await page.fill('.modal textarea[name="note"]', 'Bukti pembayaran iuran perpanjangan belum dilampirkan.');
  await page.click('#dlg-reject-ok');
  await modalGone(); await closeDrawer();
  m = await rec(user.uid);
  info('X2 member after rejecting the renewal', `${m.status} validUntil=${m.validUntil} kta=${m.kta}`);
  await signOut();
  await goto(`verifikasi.html?kta=${kta}`);
  await page.waitForSelector('.vf-result', { timeout: 6000 }).catch(() => {});
  const pub = await text('.vf-result');
  const pubOk = await page.locator('.vf-result--ok').isVisible().catch(() => false);
  await as(user);
  await goto('dashboard.html');
  await page.waitForSelector('#dash-sc-title, #dash-active-view:not([hidden])', { timeout: 8000 }).catch(() => {});
  const dash = await text('#dash-sc-title') || 'active view';
  info('X2 public verifikasi / member dashboard', `${pubOk ? 'Terverifikasi' : 'not verified'} — ${pub.slice(0, 90)} / ${dash}`);
  ok('X2 rejecting an EARLY renewal leaves member + registry consistent (member keeps the paid period OR registry stops confirming)', (m.status === 'Aktif') || !pubOk, `member ${m.status} (validUntil ${m.validUntil}), public verifikasi ${pubOk ? 'Terverifikasi' : 'not verified'}`);
  await shot('x2-rejected-early-renewal', true);
});

/* X3 — revision → resubmit → dashboard */
await step('X3 dashboard after "Kirim Perbaikan"', async () => {
  const NOTE = 'Mohon lampirkan sertifikat yang masih berlaku.';
  const { user, member } = fixture('edge-x3-0001', 'Ratna Revisi', { status: 'Perlu Perbaikan', application: { submittedAt: '2026-10-02T02:00:00.000Z' }, review: { note: NOTE, history: [{ at: '2026-10-03T02:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'perbaikan', note: NOTE }] } });
  await put(member);
  await as(user);
  await goto('pendaftaran.html');
  await dafReady();
  await page.click('[data-step="6"]'); await sleep(600);
  await page.click('.daf-foot__next');
  await page.waitForFunction(() => document.getElementById('daf-root').getAttribute('data-view') === 'pending', null, { timeout: 8000 }).catch(() => {});
  const pend = await text('main');
  ok('X3 pending view after resubmission does not present the old revision note as current', !pend.includes(NOTE) || /sebelumnya|riwayat/i.test(pend.slice(Math.max(0, pend.indexOf(NOTE) - 160), pend.indexOf(NOTE))), pend.slice(Math.max(0, pend.indexOf(NOTE) - 160), pend.indexOf(NOTE) + 60));
  await goto('dashboard.html');
  await page.waitForSelector('#dash-sc-title', { timeout: 8000 }).catch(() => {});
  const dnote = await text('.dash-sc__note');
  info('X3 dashboard after resubmission', `${await text('#dash-sc-title')} | note: ${dnote.slice(0, 120)}`);
  ok('X3 dashboard (Menunggu Verifikasi) does not show the old "perbaikan" request as an open note', !dnote.includes(NOTE), dnote.slice(0, 160));
  await shot('x3-dashboard-after-resubmit', true);
});

/* X4 — applicant who signed up by phone */
await step('X4 phone-only applicant contact e-mail', async () => {
  await signOut();
  await goto('masuk.html#daftar');
  await page.locator('#panel-daftar [data-method-switch] [data-value=phone]').click();
  await page.fill('#dp-name', 'Joko Telepon');
  await page.fill('#dp-phone', '0812-5555-0101');
  await page.check('#dp-agree');
  await page.locator('#panel-daftar [data-send-otp]').click();
  await page.waitForSelector('#panel-daftar .otp__input', { state: 'visible', timeout: 6000 }).catch(() => {});
  await page.locator('#panel-daftar .otp__input').first().focus().catch(() => {});
  await page.keyboard.type('123456');
  await page.waitForURL(/pendaftaran\.html|masuk\.html/, { timeout: 10000 }).catch(() => {});
  await sleep(1200);
  if (/masuk\.html/.test(page.url()) && await page.isVisible('[data-complete]').catch(() => false)) {
    await page.fill('#c-name', 'Joko Telepon'); await page.check('#c-agree').catch(() => {});
    await page.locator('[data-form="complete"] button[type=submit]').click();
  }
  await page.waitForURL(/pendaftaran\.html/, { timeout: 10000 }).catch(() => {});
  await settle(); await dafReady();
  ok('X4 phone sign-up → pendaftaran.html', /pendaftaran\.html/.test(page.url()), page.url());
  await page.click('[data-step="1"]').catch(() => {}); await sleep(300);
  const em = await page.evaluate(() => { const i = document.getElementById('f-email'); return i ? { value: i.value, ro: i.readOnly || i.disabled, hint: (i.closest('.field')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 200) } : null; });
  info('X4 wizard e-mail field for a phone-only account', JSON.stringify(em));
  ok('X4 a phone-only applicant can give a contact e-mail (or the form explains how)', !!em && (!em.ro || /tambah|hubungi|tautkan|email/i.test(em.hint.replace(/^Email/i, ''))), JSON.stringify(em));
  await shot('x4-phone-email', false);
});

/* X5 — Back after sign-out */
await step('X5 Back after sign-out', async () => {
  const { user, member } = fixture('edge-x5-0001', 'Bima Kembali', { status: 'Aktif', kta: 'PPAPI-2026-000778', validUntil: '2029-12-31', approvedAt: '2026-05-01T02:00:00.000Z', approvedBy: 'demo-admin-0001', application: { submittedAt: '2026-04-20T02:00:00.000Z' } });
  await put(member);
  for (const [who, url, signOutSel, label] of [
    [ADMIN, 'admin.html#anggota', '#account-menu [data-signout]', 'admin console'],
    [user, 'anggota.html#kartu', '#account-menu [data-signout]', 'profil anggota'],
    [user, 'aplikasi/perencanaan/index.html', '[data-pp-signout]', 'planning app'],
  ]) {
    await as(who);
    await goto(url);
    await sleep(500);
    if (signOutSel.startsWith('#account')) { await page.evaluate(() => scrollTo(0, 0)); await page.click('.account__trigger'); }
    await page.click(signOutSel);
    await page.waitForURL(/index\.html/, { timeout: 8000 }).catch(() => {});
    await settle();
    await page.goBack({ waitUntil: 'networkidle' }).catch(() => {});
    await sleep(1200);
    const st = await page.evaluate(() => ({ url: location.pathname.split('/').pop() + location.search, ready: document.body.classList.contains('auth-ready'), gateOk: document.documentElement.classList.contains('app-gate-ok'), main: (document.querySelector('main')?.innerText || '').slice(0, 60) }));
    const where = st.url.split('?')[0];
    ok(`X5 Back after signing out of the ${label} shows no member data (gate re-runs)`, !/^(admin|anggota)\.html$/.test(where) && !st.gateOk, JSON.stringify(st));
  }
});

/* X6 — verifikasi by name */
await step('X6 verifikasi by name', async () => {
  await signOut();
  await goto('verifikasi.html');
  await page.fill('#vf-q', 'Yusuf Kategori');
  await page.locator('.vf-form button[type=submit]').click();
  await sleep(800);
  const t = await text('main');
  info('X6 verifikasi search "Yusuf Kategori"', t.slice(t.indexOf('Hasil') > 0 ? t.indexOf('Hasil') : 0, 300));
  ok('X6 name search finds the member approved in the console', /Yusuf Kategori/.test(t), t.slice(0, 200));
});

/* X7 — admin role through the console */
await step('X7 grant / revoke admin role', async () => {
  const uid = 'edge-x5-0001';
  const m0 = await rec(uid);
  await as(ADMIN);
  await admOpen('admin');
  await page.fill('#adm-add-email', m0.email);
  await page.click('#adm-add-check');
  await page.waitForSelector('#adm-add-confirm', { timeout: 5000 });
  await page.click('#adm-add-confirm');
  await modal();
  await page.locator('.modal__footer .btn').last().click();
  await page.waitForFunction(() => document.querySelectorAll('#admin-body tbody tr').length === 2, null, { timeout: 5000 }).catch(() => {});
  ok('X7 console: member added as admin', await page.evaluate((id) => JSON.parse(localStorage.getItem('ppapi_demo_admins')).includes(id), uid));
  await as({ uid, name: m0.name, email: m0.email, phone: m0.phone, provider: 'password', photoURL: '', createdAt: '2026-01-10T02:00:00.000Z' });
  await goto('dashboard.html');
  await page.click('.account__trigger');
  const mn = await page.evaluate(() => ({ items: [...document.querySelectorAll('#account-menu [role=menuitem]')].map(a => a.textContent.trim()).join('|'), badges: [...document.querySelectorAll('#account-menu .account-menu__status .badge')].map(b => b.textContent.trim()).join(',') }));
  await page.keyboard.press('Escape');
  ok('X7 new admin\'s menu: … Konsol Admin, badges Admin + Aktif', /Konsol Admin/.test(mn.items) && mn.badges === 'Admin,Aktif', JSON.stringify(mn));
  await goto('admin.html');
  await page.waitForSelector('html[data-admin-ready]', { timeout: 10000 }).catch(() => {});
  ok('X7 new admin opens the console', /admin\.html/.test(page.url()) && await page.evaluate(() => document.documentElement.hasAttribute('data-admin-ready')), page.url());
  // revoke from the original admin
  await as(ADMIN);
  await admOpen('admin');
  await page.click(`[data-remove-admin="${uid}"]`);
  await modal();
  await page.locator('.modal__footer .btn').last().click();
  await sleep(500);
  await as({ uid, name: m0.name, email: m0.email, phone: m0.phone, provider: 'password', photoURL: '', createdAt: '2026-01-10T02:00:00.000Z' });
  await goto('admin.html');
  await page.waitForURL(/dashboard\.html/, { timeout: 8000 }).catch(() => {});
  ok('X7 revoked admin → admin.html sends them to the dashboard', /dashboard\.html/.test(page.url()), page.url());
});

/* X8 — Nonaktif member self-renewal */
await step('X8 Nonaktif member submits a renewal', async () => {
  const NOTE = 'Dinonaktifkan: pelanggaran kode etik, menunggu sidang Dewan Kehormatan.';
  const { user, member } = fixture('edge-x8-0001', 'Seno Nonaktif', { status: 'Nonaktif', kta: 'PPAPI-2026-000779', validUntil: '2028-12-31', approvedAt: '2025-01-05T02:00:00.000Z', approvedBy: 'demo-admin-0001', application: { submittedAt: '2024-12-20T02:00:00.000Z', pernyataan: { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: 'Seno Nonaktif', tanggal: '2024-12-20' } }, review: { note: NOTE, history: [{ at: '2026-09-01T02:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'dinonaktifkan', note: NOTE }] } });
  await put(member);
  await as(user);
  await goto('dashboard.html');
  const cta = await page.evaluate(() => [...document.querySelectorAll('.dash-sc__actions a')].map(a => a.textContent.replace(/\s+/g, ' ').trim() + '→' + a.getAttribute('href')).join(', '));
  info('X8 Nonaktif dashboard CTA', cta);
  await goto('pendaftaran.html');
  await dafReady();
  await page.click('[data-step="5"]').catch(() => {}); await sleep(250);
  for (const id of ['#f-kodeEtik', '#f-kebenaranData', '#f-privasi']) await page.check(id).catch(() => {});
  await page.fill('#f-namaTerang', user.name).catch(() => {});
  await sleep(900);
  await page.click('[data-step="6"]'); await sleep(900);
  await page.click('.daf-foot__next');
  if (await page.locator('.modal__dialog').count()) await page.locator('.modal .modal__footer .btn').last().click();
  await sleep(1200);
  const m = await rec(user.uid);
  info('X8 after submit', `${m.status} ${m.application.type}`);
  await as(ADMIN);
  await admOpen('permohonan');
  const row = await page.evaluate((id) => document.querySelector(`#pq-list tr:has([data-id="${id}"])`)?.textContent.replace(/\s+/g, ' ').trim() || '', user.uid);
  await drawer('#pq-list', user.uid);
  const body = await text('.drawer__panel');
  info('X8 queue row', row.slice(0, 200));
  ok('X8 console shows that a suspended (Nonaktif) member is asking to be renewed (suspension note/history visible in the drawer)', /dinonaktifkan|Nonaktif/i.test(body) && body.includes('pelanggaran kode etik'), body.slice(0, 300));
  await shot('x8-nonaktif-renewal-drawer', true);
  await closeDrawer();
});

await setClock('');
await ctx.close(); await browser.close(); await srv.close();
const relevant = issues.filter(x => !/favicon/.test(x));
info('console/page issues', relevant.slice(0, 8).join(' || ') || 'none');
const failed = R.summary();
fs.writeFileSync(path.join(SHOTS, 'journey-v2-edges-results.json'), JSON.stringify({ results: R.results, issues: relevant }, null, 2));
process.exitCode = failed ? 1 : 0;
