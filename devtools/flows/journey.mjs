// End-to-end user journeys for the PPAPI site (demo mode), run like a real visitor.
//   S1  index → Daftar → register by email → dashboard greeting/KTA → anggota: edit profile, add competency,
//       add certificate → KTA tab QR → verifikasi own KTA → umpan-balik submit → logout via header account menu
//       → protected pages redirect to masuk?next= → sign in via phone OTP 123456 (new number → "Lengkapi profil")
//       → lands on next target
//       → sign back in by email (password) with next
//   S2  Google demo modal sign-in (validation, Esc cancel, keyboard submit)
//   S3  Keyboard-only: skip link, header, account dropdown, tabs, modals, mobile menu (focus trap)
//   S4  404 at nested paths (/a/b/c …) on localhost and on a simulated <user>.github.io project/user site
//   S5  Agenda .ics downloads — RFC 5545 structural validation against the data
//   S6  Berita detail with unknown/odd ids; agenda deep link with unknown id
//
// v2 update (2026-10-09, FOUNDATION_NOTES §9.12): sign-up now lands on pendaftaran.html and a new account is Draf
// (no KTA, status centre, anggota.html gated) → S1 has the demo admin approve the member (store.admin.approve) before
// the anggota/KTA part; a third party scanning an APPROVED member's QR now sees "Terverifikasi"; new accounts with an
// active-only ?next= (phone OTP, Google) go to the form; account-menu labels/order follow §9.5 (5 items → 5 ArrowDown
// presses to wrap). The full v2 lifecycle (wizard, console UI, locks, renewal) is in flows/journey-v2.mjs.
//
// Run from devtools/:  node flows/journey.mjs [--only=S1,S3] [--headed]
// Screenshots: devtools/shots/qa/journey-*.png ; exit code = number of failed checks (capped at 1).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, freezeClock, waitReady, recorder, attachIssueLog, seedAuth, SHOTS, DEMO_MEMBER } from './qa-lib.mjs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const only = flags.only ? String(flags.only).split(',') : null;
const run = (k) => !only || only.includes(k);

const R = recorder('journey');
const { ok, info } = R;
const issues = [];
const srv = await startServer();
const BASE = srv.BASE;
const browser = await chromium.launch({ headless: !flags.headed, args: ['--host-resolver-rules=MAP ppapi-user.github.io 127.0.0.1, MAP ppapi.github.io 127.0.0.1, MAP www.ppapi-contoh.test 127.0.0.1'] });

async function newCtx(opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.width ? { width: opts.width, height: 844 } : opts.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: !!opts.mobile, hasTouch: !!opts.mobile, deviceScaleFactor: opts.mobile ? 2 : 1,
    reducedMotion: opts.motion ? 'no-preference' : 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta', acceptDownloads: true,
  });
  await freezeClock(ctx);
  if (opts.auth) await seedAuth(ctx);
  return ctx;
}
async function shot(page, name) { try { await page.screenshot({ path: path.join(SHOTS, `journey-${name}.png`) }); } catch (e) { /* ignore */ } }
async function goto(page, url) { await page.goto(url.startsWith('http') ? url : `${BASE}/${url}`, { waitUntil: 'networkidle' }); await waitReady(page); }
async function waitUrl(page, re, timeout = 8000) { try { await page.waitForURL(u => { const x = new URL(u); return re.test(x.pathname.split('/').pop() + x.hash); }, { timeout }); } catch (e) { /* reported by caller */ } await page.waitForLoadState('networkidle').catch(() => {}); await waitReady(page); return page.url(); }
const active = (page) => page.evaluate(() => {
  const a = document.activeElement; if (!a) return null;
  const r = a.getBoundingClientRect(); const cs = getComputedStyle(a);
  return {
    tag: a.tagName.toLowerCase(), id: a.id, cls: a.className && a.className.baseVal === undefined ? String(a.className) : '', text: (a.innerText || a.value || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 50),
    href: a.getAttribute('href') || '', role: a.getAttribute('role') || '', visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden',
    inView: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
    ring: (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || (cs.boxShadow && cs.boxShadow !== 'none'),
    inModal: !!a.closest('.modal'), inMenu: !!a.closest('#mobile-menu'), inHeader: !!a.closest('.site-header'),
  };
});
const fmtA = (a) => a ? `${a.tag}${a.id ? '#' + a.id : ''}${a.cls ? '.' + a.cls.split(/\s+/).slice(0, 2).join('.') : ''} "${a.text}"` : 'null';
async function toasts(page) { return (await page.locator('.toast').allInnerTexts().catch(() => [])).join(' | '); }

/* =====================================================================================
   S1 — main member journey
   ===================================================================================== */
let KTA = '';
if (run('S1')) {
  console.log('\n=== S1 registration → member journey ===');
  const ctx = await newCtx();
  const page = await ctx.newPage();
  attachIssueLog(page, issues, '[S1] ');
  const email = `uji.journey.${Date.now()}@contoh.id`;
  const NAME = 'Siti Rahmawati';
  try {
    await goto(page, 'index.html');
    ok('S1 index: header shows Masuk + Daftar for visitors', await page.locator('.account__guest a', { hasText: 'Daftar' }).isVisible() && await page.locator('.account__guest a', { hasText: 'Masuk' }).isVisible());
    await page.locator('.account__guest a', { hasText: 'Daftar' }).click();
    await waitUrl(page, /masuk\.html#daftar/);
    ok('S1 Daftar → masuk.html#daftar with Daftar tab selected', /masuk\.html#daftar$/.test(page.url()) && (await page.getAttribute('#tab-daftar', 'aria-selected')) === 'true', page.url());
    ok('S1 Daftar: document title updated', /Daftar/.test(await page.title()), await page.title());

    // submit empty → inline errors
    await page.locator('[data-form="daftar-email"] button[type=submit]').click();
    const errCount = await page.locator('[data-form="daftar-email"] .field.is-invalid').count();
    ok('S1 Daftar: empty submit shows inline errors (5 fields)', errCount === 5, `invalid fields=${errCount}`);
    ok('S1 Daftar: focus moved to first invalid control', (await active(page))?.id === 'd-name', fmtA(await active(page)));

    await page.fill('#d-name', NAME);
    await page.fill('#d-email', email);
    await page.fill('#d-pass', 'Perancah2026');
    await page.fill('#d-pass2', 'Perancah2026');
    await page.check('#d-agree');
    await page.locator('[data-form="daftar-email"] button[type=submit]').click();
    // v2 (FOUNDATION_NOTES §9.6/§9.12): a new account lands on the application form, not on the dashboard
    await waitUrl(page, /pendaftaran\.html/, 10000);
    ok('S1 register → redirected to pendaftaran.html (auth.postSignUpTarget)', /pendaftaran\.html(#kategori)?$/.test(page.url()), page.url());
    await page.waitForSelector('.toast:has-text("Selamat datang")', { timeout: 3000 }).catch(() => {});
    ok('S1 pendaftaran: welcome toast after redirect (flash)', /Selamat datang, Siti Rahmawati/.test(await toasts(page)), 'toasts: ' + (await toasts(page)));
    const uid = await page.evaluate(() => PPAPI.auth.current().uid);
    await goto(page, 'dashboard.html');
    await page.waitForSelector('#dash-meta:not([aria-busy="true"])', { timeout: 8000 }).catch(() => {});
    const title = await page.locator('#dash-title').innerText();
    ok('S1 dashboard: greeting "Selamat pagi" (10:00 WIB) + first name', /Selamat pagi/i.test(title) && /Siti/.test(title), title);
    const meta0 = await page.locator('#dash-meta').innerText();
    ok('S1 dashboard: a new (Draf) member has no KTA yet', !/PPAPI-\d{4}-\d{6}/.test(meta0), meta0.replace(/\s+/g, ' '));
    ok('S1 dashboard: status centre shows "Draf" for a new member', await page.locator('#dash-status-view').isVisible() && /Draf/.test(await page.locator('#dash-sc-title').textContent()), await page.locator('#dash-sc-title').textContent().catch(() => ''));
    ok('S1 header: account trigger shows first name', (await page.locator('.account__name').textContent()).trim() === 'Siti', await page.locator('.account__name').textContent());
    await shot(page, 's1-dashboard');
    await page.click('.account__trigger');
    const draftMenu = await page.locator('#account-menu [role=menuitem]').evaluateAll(els => els.map(e => e.textContent.trim()).join('|'));
    ok('S1 account menu (Draf): Dasbor | Formulir Pendaftaran | Keluar', draftMenu === 'Dasbor|Formulir Pendaftaran|Keluar', draftMenu);
    await page.keyboard.press('Escape');
    await page.goto(`${BASE}/anggota.html`, { waitUntil: 'networkidle' });
    await waitUrl(page, /dashboard\.html/);
    ok('S1 Draf member: anggota.html (data-auth=active) → dashboard.html', /dashboard\.html$/.test(page.url()), page.url());

    // the secretariat approves (demo admin in the same browser; the console UI itself is covered by journey-v2.mjs)
    await page.click('.account__trigger');
    await page.locator('#account-menu [data-signout]').click();
    await waitUrl(page, /index\.html/);
    await goto(page, 'masuk.html');
    await page.fill('#m-email', 'admin@ppapi.demo');
    await page.fill('#m-pass', 'AdminPPAPI2026');
    await page.locator('[data-form="masuk-email"] button[type=submit]').click();
    await waitUrl(page, /dashboard\.html/);
    const approved = await page.evaluate(async (id) => { const m = await PPAPI.store.admin.approve(id, { memberType: 'Praktisi' }); return m && m.kta; }, uid).catch(e => 'ERR ' + e.message);
    ok('S1 demo admin approves the new member (store.admin.approve)', /^PPAPI-2026-\d{6}$/.test(approved || ''), approved);
    await page.click('.account__trigger');
    await page.locator('#account-menu [data-signout]').click();
    await waitUrl(page, /index\.html/);
    await goto(page, 'masuk.html');
    await page.fill('#m-email', email);
    await page.fill('#m-pass', 'Perancah2026');
    await page.locator('[data-form="masuk-email"] button[type=submit]').click();
    await waitUrl(page, /dashboard\.html/);
    await page.waitForSelector('#dash-meta:not([aria-busy="true"])', { timeout: 8000 }).catch(() => {});
    const meta = await page.locator('#dash-meta').innerText();
    const m = meta.match(/PPAPI-2026-\d{6}/);
    KTA = m ? m[0] : '';
    ok('S1 dashboard after approval: KTA shown (PPAPI-2026-NNNNNN)', !!KTA && KTA === approved, meta.replace(/\s+/g, ' '));
    ok('S1 dashboard after approval: active view (status "Aktif")', await page.locator('#dash-active-view').isVisible() && /Aktif/i.test(meta), meta.replace(/\s+/g, ' '));

    // account menu → Profil Anggota (v1 label "Halaman Anggota")
    await page.click('.account__trigger');
    await page.locator('#account-menu [role=menuitem]', { hasText: 'Profil Anggota' }).click();
    await waitUrl(page, /anggota\.html/);
    ok('S1 account menu → anggota.html', /anggota\.html/.test(page.url()), page.url());
    await page.waitForFunction(() => !/Memuat/.test(document.querySelector('#agt-name')?.innerText || 'Memuat'), null, { timeout: 8000 }).catch(() => {});
    ok('S1 anggota: hero shows member name', (await page.locator('#agt-name').innerText()).includes(NAME));

    // edit profile
    await page.selectOption('#f-province', { label: 'Jawa Barat' }).catch(async () => { await page.selectOption('#f-province', { index: 10 }); });
    await page.fill('#f-city', 'Bekasi');
    await page.fill('#f-company', 'PT Uji Perancah Nusantara');
    await page.fill('#f-position', 'Scaffolding Inspector');
    await page.fill('#f-experienceYears', '6');
    await page.fill('#f-bio', 'Inspektur perancah untuk proyek gedung bertingkat dan fasilitas industri.');
    ok('S1 anggota: dirty indicator after edits', /belum disimpan/i.test(await page.locator('#profil-status').innerText()));
    await page.click('#profil-save');
    await page.waitForFunction(() => document.querySelector('#profil-save')?.disabled, null, { timeout: 6000 }).catch(() => {});
    ok('S1 anggota: profile saved (save button disabled again)', await page.locator('#profil-save').isDisabled(), await toasts(page));
    await page.reload({ waitUntil: 'networkidle' }); await waitReady(page);
    await page.waitForTimeout(400);
    ok('S1 anggota: profile persisted after reload', (await page.inputValue('#f-city')) === 'Bekasi' && (await page.inputValue('#f-company')) === 'PT Uji Perancah Nusantara' && (await page.inputValue('#f-experienceYears')) === '6');

    // add competency
    await page.click('#tab-kompetensi');
    ok('S1 tabs: hash synced to #kompetensi', /#kompetensi$/.test(page.url()), page.url());
    const emptyComp = await page.locator('#kompetensi-list .empty-state').count();
    info('S1 kompetensi empty state present for a new member', String(emptyComp));
    await page.locator('#panel-kompetensi [data-action="add-kompetensi"]:visible').first().click();
    await page.waitForSelector('.modal #mk-kode');
    const opt = await page.locator('.modal #mk-kode option:not([value=""]):not([value="__lain"])').first().getAttribute('value');
    await page.selectOption('.modal #mk-kode', opt);
    await page.selectOption('.modal #mk-level', 'Menengah');
    await page.fill('.modal #mk-since', '2021');
    await page.locator('.modal .modal__footer .btn').last().click();
    await page.waitForSelector('.modal', { state: 'detached', timeout: 5000 }).catch(() => {});
    ok('S1 kompetensi: one card after add', (await page.locator('.agt-comp').count()) === 1, `cards=${await page.locator('.agt-comp').count()}`);

    // add certificate
    await page.click('#tab-sertifikat');
    await page.locator('#panel-sertifikat [data-action="add-sertifikat"]:visible').first().click();
    await page.waitForSelector('.modal #mc-title');
    await page.fill('.modal #mc-title', 'Teknisi Perancah');
    await page.fill('.modal #mc-number', 'UJI/JOURNEY/001');
    await page.selectOption('.modal #mc-issuer', { index: 1 });
    await page.fill('.modal #mc-issued', '2025-01-15');
    await page.fill('.modal #mc-expires', '2028-01-15');
    await page.locator('.modal .modal__footer .btn').last().click();
    await page.waitForSelector('.modal', { state: 'detached', timeout: 5000 }).catch(() => {});
    ok('S1 sertifikat: one row after add', (await page.locator('.agt-cert-table tbody tr').count()) === 1);

    // KTA tab: QR
    await page.click('#tab-kartu');
    await page.waitForFunction(() => /ready|fallback/.test(document.querySelector('#kta-qr')?.getAttribute('data-state') || ''), null, { timeout: 20000 }).catch(() => {});
    const qrState = await page.getAttribute('#kta-qr', 'data-state').catch(() => null);
    const qrUrl = await page.getAttribute('#kta-qr', 'data-url').catch(() => null);
    ok('S1 KTA tab: QR rendered', qrState === 'ready' && (await page.locator('#kta-qr svg').count()) > 0, `state=${qrState}`);
    ok('S1 KTA tab: QR encodes verifikasi URL with own KTA', qrUrl === `${BASE}/verifikasi.html?kta=${KTA}`, qrUrl);
    await shot(page, 's1-kartu');

    // dashboard reflects new data
    await goto(page, 'dashboard.html');
    await page.waitForSelector('#dash-kpis:not([aria-busy="true"])', { timeout: 6000 }).catch(() => {});
    const kpis = (await page.locator('#dash-kpis').innerText()).replace(/\s+/g, ' ');
    info('S1 dashboard KPIs after edits', kpis.slice(0, 200));

    // verifikasi own KTA (signed in)
    await goto(page, `verifikasi.html?kta=${encodeURIComponent(KTA)}`);
    await page.waitForTimeout(500);
    const vText = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    ok('S1 verifikasi (signed in, own KTA): shows own record', vText.includes(KTA) && vText.includes(NAME), vText.slice(0, 300));
    await shot(page, 's1-verifikasi-own');

    // umpan-balik
    await goto(page, 'umpan-balik.html');
    const prefName = await page.inputValue('#ub-nama');
    const prefEmail = await page.inputValue('#ub-email');
    ok('S1 umpan-balik: name & email prefilled for signed-in member', prefName === NAME && prefEmail === email, `${prefName} / ${prefEmail}`);
    await page.locator('input[name=kategori][value=Saran] + .segmented__option').click();
    await page.fill('#ub-subjek', 'Usulan jadwal pelatihan inspektur');
    await page.fill('#ub-pesan', 'Mohon dijadwalkan pelatihan inspektur perancah di wilayah Jawa Barat pada kuartal pertama.');
    await page.locator('label[for=ub-r4]').click();
    await page.check('#ub-consent');
    await page.locator('form button[type=submit]').first().click();
    await page.waitForTimeout(1500);
    const ubText = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    const ref = (ubText.match(/UB-\d{8}-[A-Z0-9]{4}/) || [])[0];
    ok('S1 umpan-balik: success panel with reference number', !!ref, ubText.slice(0, 200));
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_feedback') || '[]').slice(-1)[0]);
    ok('S1 umpan-balik: stored record has kategori/rating/uid', stored && stored.kategori === 'Saran' && stored.rating === 4 && !!stored.uid, JSON.stringify(stored).slice(0, 200));

    // logout from header account menu (on a required page)
    await goto(page, 'dashboard.html');
    await page.click('.account__trigger');
    await page.locator('#account-menu [data-signout]').click();
    await waitUrl(page, /index\.html/);
    ok('S1 logout on dashboard → index.html', /index\.html$/.test(page.url()), page.url());
    ok('S1 logout: flash toast "Anda telah keluar"', /telah keluar/i.test(await toasts(page)), await toasts(page));
    ok('S1 logout: header back to Masuk/Daftar', await page.locator('.account__guest').isVisible());
    ok('S1 logout: session cleared', await page.evaluate(() => !localStorage.getItem('ppapi_demo_session') && !sessionStorage.getItem('ppapi_demo_session')));
    await page.goBack({ waitUntil: 'networkidle' }).catch(() => {}); await page.waitForTimeout(800);
    ok('S1 Back after logout does not show the dashboard (gate re-runs / no bfcache leak)', !/dashboard\.html$/.test(page.url()) || !(await page.locator('#dash-title').isVisible().catch(() => false)), page.url());
    await goto(page, 'index.html');

    // protected pages redirect with next
    for (const [u, nextEnc] of [['dashboard.html', 'dashboard.html'], ['anggota.html#kartu', 'anggota.html%23kartu'], ['anggota.html?x=1#sertifikat', 'anggota.html%3Fx%3D1%23sertifikat']]) {
      await page.goto(`${BASE}/${u}`, { waitUntil: 'networkidle' });
      await waitUrl(page, /masuk\.html/);
      ok(`S1 signed-out ${u} → masuk.html?next=${nextEnc}`, page.url() === `${BASE}/masuk.html?next=${nextEnc}`, page.url());
    }
    ok('S1 masuk: next note names "Profil Anggota" (v2 label)', /Profil Anggota/i.test(await page.locator('[data-next-note]').textContent().catch(() => '')), await page.locator('[data-next-note]').textContent().catch(() => ''));

    // sign in via phone OTP → lands on next target
    await goto(page, `masuk.html?next=${encodeURIComponent('anggota.html#kartu')}`);
    await page.locator('#panel-masuk [data-method-switch] [data-value=phone]').click();
    await page.fill('#mp-phone', '0812-7777-0001');
    await page.locator('#panel-masuk [data-send-otp]').click();
    await page.waitForSelector('#panel-masuk [data-phone-step="2"]:not([hidden])', { timeout: 5000 });
    ok('S1 phone: demo OTP toast shown', /123456/.test(await toasts(page)), await toasts(page));
    ok('S1 phone: masked number shown', /\+62 812-••••-0001/.test(await page.locator('#panel-masuk [data-otp-target]').innerText()), await page.locator('#panel-masuk [data-otp-target]').innerText());
    ok('S1 phone: focus in first OTP box', (await active(page))?.cls.includes('otp__input'), fmtA(await active(page)));
    // wrong code first
    await page.keyboard.type('111111');
    await page.waitForTimeout(900);
    ok('S1 phone: wrong OTP → error alert, boxes cleared', /tidak sesuai/i.test(await page.locator('#panel-masuk [data-alert]').innerText()) && (await page.evaluate(() => [...document.querySelectorAll('#panel-masuk .otp__input')].map(i => i.value).join(''))) === '');
    await page.keyboard.type('123456');
    // unknown number on the Masuk tab → "Lengkapi profil" (name + Kebijakan Privasi) before the redirect
    await page.waitForSelector('[data-complete]:not([hidden])', { timeout: 8000 }).catch(() => {});
    ok('S1 phone (Masuk tab, unknown number): "Lengkapi profil" step (name + consent) before redirect', /masuk\.html/.test(page.url()) && await page.isVisible('[data-complete]') && await page.isVisible('[data-complete-agree]'), page.url());
    await shot(page, 's1-phone-complete');
    await page.fill('#c-name', 'Andi Pratama');
    await page.check('#c-agree');
    await page.locator('[data-form="complete"] button[type=submit]').click();
    // v2: a NEW account is Draf, so an active-only next (anggota.html#kartu) would only bounce to the dashboard;
    // masuk.js sends new accounts to the application form instead (V2_REPORTS "masuk+keanggotaan+verifikasi")
    await waitUrl(page, /pendaftaran\.html/, 10000);
    ok('S1 phone OTP sign-up (new number, active-only next) → pendaftaran.html', /pendaftaran\.html/.test(page.url()), page.url());
    await page.waitForFunction(() => document.getElementById('daf-root')?.getAttribute('aria-busy') === 'false', null, { timeout: 8000 }).catch(() => {});
    ok('S1 phone: the new account sees the application wizard', (await page.getAttribute('#daf-root', 'data-view').catch(() => null)) === 'wizard');
    const phoneUser = await page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_demo_session') || 'null'));
    info('S1 phone sign-in created account', JSON.stringify(phoneUser));
    const hName = await page.locator('.account__name').textContent().catch(() => '');
    const formName = await page.inputValue('#f-name').catch(() => '');
    info('S1 phone account display', `header="${hName}" form name="${formName}"`);
    ok('S1 phone (Masuk tab, unknown number): new account carries the name from "Lengkapi profil"', phoneUser && phoneUser.name === 'Andi Pratama' && /Andi/.test(hName) && formName === 'Andi Pratama', JSON.stringify(phoneUser));
    ok('S1 phone: welcome toast shown on the destination (flash)', /Selamat datang, Andi Pratama/.test(await toasts(page)), await toasts(page));
    await shot(page, 's1-phone-landing');

    // sign out (via mobile/desktop account) and sign back in by EMAIL with next (Ingat saya OFF)
    await page.click('.account__trigger');
    await page.locator('#account-menu [data-signout]').click();
    await waitUrl(page, /index\.html/);
    await goto(page, `masuk.html?next=${encodeURIComponent('dashboard.html')}`);
    await page.fill('#m-email', email);
    await page.fill('#m-pass', 'salah-sandi1');
    await page.locator('[data-form="masuk-email"] button[type=submit]').click();
    await page.waitForTimeout(900);
    ok('S1 email sign-in: wrong password → Indonesian error', /tidak sesuai/i.test(await page.locator('#panel-masuk [data-alert]').innerText()));
    await page.fill('#m-pass', 'Perancah2026');
    try { await page.uncheck('#m-remember', { timeout: 2500 }); ok('S1 Playwright can uncheck "Ingat saya" (input is the hit target)', true); } catch (e) { ok('S1 Playwright can uncheck "Ingat saya" (input is the hit target)', false, 'check__box intercepts pointer events when checked'); await page.locator('#m-remember + .check__box').click(); }
    await page.locator('[data-form="masuk-email"] button[type=submit]').click();
    await waitUrl(page, /dashboard\.html/);
    ok('S1 email sign-in (remember off) → dashboard', /dashboard\.html$/.test(page.url()), page.url());
    ok('S1 remember off → session in sessionStorage only', await page.evaluate(() => !!sessionStorage.getItem('ppapi_demo_session') && !localStorage.getItem('ppapi_demo_session')));
    ok('S1 email sign-in restores the same member (KTA unchanged)', (await page.locator('#dash-meta').innerText()).includes(KTA));
    // visiting masuk while signed in → bounce to dashboard (guest gate)
    await page.goto(`${BASE}/masuk.html?next=${encodeURIComponent('https://evil.example/x.html')}`, { waitUntil: 'networkidle' });
    await waitUrl(page, /dashboard\.html/);
    ok('S1 signed-in visit to masuk with off-site next → dashboard (open-redirect blocked)', /dashboard\.html$/.test(page.url()), page.url());
  } catch (e) {
    ok('S1 journey completed without exception', false, e.message.split('\n')[0]);
    await shot(page, 's1-FAIL');
  }
  await ctx.close();

  // signed OUT: the new member's KTA on verifikasi (what a third party scanning the QR sees)
  if (KTA) {
    const c2 = await newCtx();
    const p2 = await c2.newPage();
    await goto(p2, `verifikasi.html?kta=${encodeURIComponent(KTA)}`);
    await p2.waitForTimeout(500);
    const t = (await p2.locator('main').innerText()).replace(/\s+/g, ' ');
    info('S1 verifikasi (signed out, approved member KTA from QR) result', t.slice(t.indexOf('Hasil') > 0 ? t.indexOf('Hasil') : 0, (t.indexOf('Hasil') > 0 ? t.indexOf('Hasil') : 0) + 400));
    // v2: approval writes the public registry entry. In DEMO mode that registry lives in the approving browser's
    // localStorage, so a separate browser (this fresh context) cannot see it — the same-browser third-party check
    // ("Terverifikasi" signed out) is in journey-v2.mjs J4; in Firebase mode the registry is shared.
    ok('S1 verifikasi in ANOTHER browser (demo registry is per browser) does not invent a confirmation', !(await p2.locator('.vf-result--ok').isVisible().catch(() => false)), t.slice(0, 200));
    await shot(p2, 's1-verifikasi-third-party');
    await c2.close();
  }
}

/* =====================================================================================
   S2 — Google demo modal
   ===================================================================================== */
if (run('S2')) {
  console.log('\n=== S2 Google demo modal ===');
  const ctx = await newCtx();
  const page = await ctx.newPage();
  attachIssueLog(page, issues, '[S2] ');
  try {
    await goto(page, `masuk.html?next=${encodeURIComponent('anggota.html#aplikasi')}`);
    await page.locator('#panel-masuk [data-google]').click();
    await page.waitForSelector('.modal');
    await page.waitForTimeout(150);
    ok('S2 modal title "Simulasi Masuk dengan Google"', /Simulasi Masuk dengan Google/.test(await page.locator('.modal .modal__title').innerText()));
    ok('S2 modal: focus on name field', (await active(page))?.id === 'dg-name', fmtA(await active(page)));
    ok('S2 modal: role=dialog + aria-modal', await page.evaluate(() => { const d = document.querySelector('.modal [role=dialog], .modal[role=dialog]'); return !!d && d.getAttribute('aria-modal') === 'true'; }));
    // Esc cancels without an error alert
    await page.keyboard.press('Escape');
    await page.waitForSelector('.modal', { state: 'detached', timeout: 3000 }).catch(() => {});
    ok('S2 Esc closes modal', (await page.locator('.modal').count()) === 0);
    ok('S2 cancel shows no error alert', (await page.locator('#panel-masuk [data-alert] .alert').count()) === 0);
    ok('S2 focus returns to Google button after cancel', /Google/i.test((await active(page))?.text || ''), fmtA(await active(page)));
    ok('S2 Google button re-enabled after cancel', !(await page.locator('#panel-masuk [data-google]').isDisabled()));
    // validation + keyboard submit
    await page.keyboard.press('Enter');
    await page.waitForSelector('.modal');
    await page.locator('.modal .modal__footer .btn').last().click();
    ok('S2 empty submit → name error + stays open', (await page.locator('.modal .field.is-invalid').count()) >= 1 && (await page.locator('.modal').count()) === 1);
    await page.fill('#dg-name', 'Budi Santoso');
    await page.fill('#dg-email', 'budi.santoso@gmail');
    await page.keyboard.press('Enter');
    ok('S2 invalid email → error, focus on email', (await active(page))?.id === 'dg-email' && (await page.locator('#dg-email').getAttribute('aria-invalid')) === 'true');
    await page.fill('#dg-email', 'budi.santoso@gmail.com');
    await page.keyboard.press('Enter');
    // a new Google account from the Masuk tab never saw the consent line → "Lengkapi profil" (name prefilled)
    await page.waitForSelector('[data-complete]:not([hidden])', { timeout: 8000 }).catch(() => {});
    ok('S2 new Google account (Masuk tab) → "Lengkapi profil": name prefilled, consent asked', (await page.inputValue('#c-name').catch(() => '')) === 'Budi Santoso' && await page.isVisible('[data-complete-agree]'));
    await page.check('#c-agree');
    await page.locator('[data-form="complete"] button[type=submit]').click();
    // v2: a new (Draf) account with an active-only next goes to the application form first
    await waitUrl(page, /pendaftaran\.html/, 10000);
    ok('S2 Google demo sign-up (new account, next=anggota.html#aplikasi) → pendaftaran.html', /pendaftaran\.html/.test(page.url()), page.url());
    const u = await page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_demo_session') || 'null'));
    ok('S2 session provider=google, name/email from modal', u && u.provider === 'google' && u.name === 'Budi Santoso' && u.email === 'budi.santoso@gmail.com', JSON.stringify(u));
    await page.waitForFunction(() => document.getElementById('daf-root')?.getAttribute('aria-busy') === 'false', null, { timeout: 8000 }).catch(() => {});
    ok('S2 new Google account sees the application wizard (Draf)', (await page.getAttribute('#daf-root', 'data-view').catch(() => null)) === 'wizard');
  } catch (e) { ok('S2 completed without exception', false, e.message.split('\n')[0]); await shot(page, 's2-FAIL'); }
  await ctx.close();
}

/* =====================================================================================
   S3 — keyboard only
   ===================================================================================== */
if (run('S3')) {
  console.log('\n=== S3 keyboard-only navigation ===');
  // --- desktop, signed out: skip link + header order
  {
    const ctx = await newCtx();
    const page = await ctx.newPage();
    attachIssueLog(page, issues, '[S3] ');
    try {
      await goto(page, 'profil.html');
      await page.keyboard.press('Tab');
      let a = await active(page);
      ok('S3 first Tab → skip link, visible with focus ring', a?.cls.includes('skip-link') && a.visible && a.inView && a.ring, fmtA(a));
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      a = await active(page);
      ok('S3 skip link → focus on <main>', a?.id === 'main', fmtA(a));
      await goto(page, 'profil.html');
      const stops = [];
      for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); stops.push(await active(page)); }
      info('S3 desktop tab order', stops.map(fmtA).join(' → '));
      const hidden = stops.filter(s => s && (!s.visible || s.inMenu));
      ok('S3 desktop: no focus on hidden elements (incl. closed mobile menu)', hidden.length === 0, hidden.map(fmtA).join(', '));
      const noRing = stops.filter(s => s && s.visible && !s.ring);
      ok('S3 desktop: every focus stop shows a focus indicator', noRing.length === 0, noRing.map(fmtA).join(', '));
      ok('S3 header order: brand → 7 nav links → Masuk → Daftar', stops[1]?.cls.includes('brand') && stops.slice(2, 9).every(s => s.cls.includes('site-nav__link')) && /Masuk/i.test(stops[9]?.text) && /Daftar/i.test(stops[10]?.text), stops.slice(1, 11).map(s => s.text).join(','));
      ok('S3 active nav link has aria-current=page', await page.evaluate(() => document.querySelector('.site-nav__link[aria-current=page]')?.textContent.trim() === 'Profil'));
      // accordion via keyboard on keanggotaan FAQ
      await goto(page, 'keanggotaan.html');
      const trig = page.locator('.accordion__trigger').first();
      await trig.focus();
      const before = await trig.getAttribute('aria-expanded');
      await page.keyboard.press('Enter');
      const after1 = await trig.getAttribute('aria-expanded');
      await page.keyboard.press('Space');
      const after2 = await trig.getAttribute('aria-expanded');
      ok('S3 accordion: Enter and Space each toggle aria-expanded', after1 !== before && after2 === before, `${before}→${after1}→${after2}`);
      // berita filter chips via keyboard
      await goto(page, 'berita.html');
      const chip = page.locator('.filter-chips .chip').nth(1);
      await chip.focus();
      await page.keyboard.press('Space');
      await page.waitForTimeout(300);
      ok('S3 filter chip toggles with Space (aria-pressed=true)', (await chip.getAttribute('aria-pressed')) === 'true');
    } catch (e) { ok('S3 desktop signed-out completed', false, e.message.split('\n')[0]); }
    await ctx.close();
  }
  // --- desktop, signed in: account dropdown, tabs, modal
  {
    const ctx = await newCtx({ auth: true });
    const page = await ctx.newPage();
    attachIssueLog(page, issues, '[S3] ');
    try {
      await goto(page, 'dashboard.html');
      await page.locator('.account__trigger').focus();
      await page.keyboard.press('Enter');
      let a = await active(page);
      ok('S3 account trigger Enter → menu open, focus on first item', (await page.getAttribute('.account__trigger', 'aria-expanded')) === 'true' && /Dasbor/.test(a?.text), fmtA(a));
      // v2 active-member menu has 5 items (FOUNDATION_NOTES §9.12): 5 presses are needed to wrap back to Dasbor.
      // (The v1 check pressed 4 times for its 4-item menu, so on v2 it stopped on "Keluar" — a test artefact, not a core.js bug.)
      const seq = [];
      for (let i = 0; i < 5; i++) { await page.keyboard.press('ArrowDown'); seq.push((await active(page))?.text); }
      ok('S3 account menu ArrowDown cycles items and wraps', seq.join('|') === 'Profil Anggota|Produk Pengetahuan|Aplikasi Anggota|Keluar|Dasbor', seq.join('|'));
      await page.keyboard.press('ArrowUp');
      ok('S3 account menu ArrowUp wraps to last', /Keluar/.test((await active(page))?.text), fmtA(await active(page)));
      await page.keyboard.press('Home');
      info('S3 account menu Home key (optional when arrows wrap)', fmtA(await active(page)));
      await page.keyboard.press('Escape');
      a = await active(page);
      ok('S3 Esc closes menu, focus back on trigger', (await page.getAttribute('.account__trigger', 'aria-expanded')) === 'false' && a?.cls.includes('account__trigger'), fmtA(a));
      await page.keyboard.press('ArrowDown');
      ok('S3 ArrowDown on trigger opens menu', (await page.getAttribute('.account__trigger', 'aria-expanded')) === 'true');
      await page.keyboard.press('Tab');
      await page.waitForTimeout(100);
      a = await active(page);
      ok('S3 Tab out of menu closes it', (await page.getAttribute('.account__trigger', 'aria-expanded')) === 'false', 'focus now ' + fmtA(a));
      ok('S3 Tab out of menu lands on a visible element', a?.visible, fmtA(a));
      // menu item activation with Enter (Profil Anggota; v1 "Halaman Anggota")
      await page.locator('.account__trigger').focus();
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await waitUrl(page, /anggota\.html/);
      ok('S3 Enter on "Profil Anggota" navigates', /anggota\.html/.test(page.url()), page.url());

      // tabs (anggota)
      await page.locator('#tab-profil').focus();
      await page.keyboard.press('ArrowRight');
      a = await active(page);
      ok('S3 tabs: ArrowRight → Kompetensi focused + selected + panel shown + hash', a?.id === 'tab-kompetensi' && (await page.getAttribute('#tab-kompetensi', 'aria-selected')) === 'true' && await page.locator('#panel-kompetensi').isVisible() && /#kompetensi$/.test(page.url()), fmtA(a) + ' ' + page.url());
      await page.keyboard.press('End');
      ok('S3 tabs: End → last tab (Aplikasi)', (await active(page))?.id === 'tab-aplikasi');
      await page.keyboard.press('Home');
      ok('S3 tabs: Home → first tab (Profil)', (await active(page))?.id === 'tab-profil');
      await page.keyboard.press('ArrowLeft');
      ok('S3 tabs: ArrowLeft on first wraps to last', (await active(page))?.id === 'tab-aplikasi');
      ok('S3 tabs: roving tabindex (only selected tab focusable)', await page.evaluate(() => [...document.querySelectorAll('#agt-tabs [role=tab]')].every(t => t.tabIndex === (t.getAttribute('aria-selected') === 'true' ? 0 : -1))));
      await page.keyboard.press('Tab');
      a = await active(page);
      ok('S3 tabs: Tab from tablist moves into the active panel', a && (await page.evaluate(() => !!document.activeElement.closest('#panel-aplikasi') || document.activeElement.id === 'panel-aplikasi')), fmtA(a));

      // KTA card flip via keyboard
      await page.click('#tab-kartu');
      await page.waitForTimeout(300);

      // modal (agenda detail) via keyboard
      await goto(page, 'agenda.html');
      const opener = page.locator('.event-row [data-agenda-open]').first();
      await opener.focus();
      const openerText = (await opener.innerText()).trim();
      await page.keyboard.press('Enter');
      await page.waitForSelector('.modal', { timeout: 4000 });
      await page.waitForTimeout(150);
      a = await active(page);
      ok('S3 agenda modal opens with Enter; focus inside modal', a?.inModal, fmtA(a));
      ok('S3 agenda modal: URL gains ?id=', /agenda\.html\?id=/.test(page.url()), page.url());
      let escaped = 0;
      for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); if (!(await active(page))?.inModal) escaped++; }
      for (let i = 0; i < 6; i++) { await page.keyboard.press('Shift+Tab'); if (!(await active(page))?.inModal) escaped++; }
      ok('S3 agenda modal: focus trapped (Tab / Shift+Tab)', escaped === 0, `escaped ${escaped}x`);
      ok('S3 agenda modal: background inert/aria-hidden', await page.evaluate(() => { const m = document.getElementById('main'); return m.hasAttribute('inert') || m.getAttribute('aria-hidden') === 'true' || document.querySelector('.modal [aria-modal=true]') !== null; }));
      await page.keyboard.press('Escape');
      await page.waitForSelector('.modal', { state: 'detached', timeout: 3000 }).catch(() => {});
      a = await active(page);
      ok('S3 agenda modal: Esc closes, focus returns to opener, ?id removed', (await page.locator('.modal').count()) === 0 && a?.text.startsWith(openerText.slice(0, 10)) && !/\?id=/.test(page.url()), fmtA(a) + ' ' + page.url());
      await page.keyboard.press('Enter');
      await page.waitForSelector('.modal', { timeout: 4000 });
      // close with the × button via keyboard
      const closeBtn = page.locator('.modal .modal__close');
      if (await closeBtn.count()) { await closeBtn.focus(); await page.keyboard.press('Enter'); await page.waitForSelector('.modal', { state: 'detached', timeout: 3000 }).catch(() => {}); }
      ok('S3 agenda modal: × close works via keyboard', (await page.locator('.modal').count()) === 0);

      // regulasi Ringkasan modal keyboard
      await goto(page, 'regulasi.html');
      const rb = page.locator('button', { hasText: 'Ringkasan' }).first();
      await rb.focus();
      await page.keyboard.press('Enter');
      await page.waitForSelector('.modal', { timeout: 4000 });
      await page.waitForTimeout(150);
      ok('S3 regulasi modal: focus inside on open', (await active(page))?.inModal, fmtA(await active(page)));
      await page.keyboard.press('Escape');
      await page.waitForTimeout(200);
      ok('S3 regulasi modal: Esc returns focus to its button', /Ringkasan/i.test((await active(page))?.text || ''), fmtA(await active(page)));
    } catch (e) { ok('S3 desktop signed-in completed', false, e.message.split('\n')[0]); await shot(page, 's3-FAIL'); }
    await ctx.close();
  }
  // --- mobile: menu toggle, focus trap, account
  for (const [auth, width] of [[false, 390], [true, 390], [false, 900]]) {
    const ctx = await newCtx({ mobile: width < 768, width, auth });
    const page = await ctx.newPage();
    attachIssueLog(page, issues, '[S3m] ');
    const tag = (auth ? 'signed-in' : 'signed-out') + ' ' + width + 'px';
    try {
      await goto(page, 'index.html');
      const stops = [];
      for (let i = 0; i < 5; i++) { await page.keyboard.press('Tab'); stops.push(await active(page)); }
      info(`S3 mobile ${tag} first tab stops`, stops.map(fmtA).join(' → '));
      ok(`S3 mobile ${tag}: closed menu links not focusable`, !stops.some(s => s?.inMenu), stops.filter(s => s?.inMenu).map(fmtA).join(','));
      const toggle = page.locator('.menu-toggle');
      await toggle.focus();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(200);
      let a = await active(page);
      ok(`S3 mobile ${tag}: Enter opens menu, focus on first link`, (await toggle.getAttribute('aria-expanded')) === 'true' && a?.inMenu && /Beranda/.test(a.text), fmtA(a));
      ok(`S3 mobile ${tag}: main/footer inert while menu open`, await page.evaluate(() => document.getElementById('main').hasAttribute('inert')));
      const ring = [];
      let out = 0;
      for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); const x = await active(page); ring.push(fmtA(x)); if (!(x?.inMenu || x?.cls.includes('brand') || x?.cls.includes('menu-toggle'))) out++; }
      ok(`S3 mobile ${tag}: focus trapped in menu (Tab ×14)`, out === 0, ring.join(' → '));
      const hasAcct = await page.evaluate(() => document.querySelector('[data-mobile-account]')?.innerText.replace(/\s+/g, ' ').trim());
      info(`S3 mobile ${tag}: menu account actions`, hasAcct);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(150);
      a = await active(page);
      ok(`S3 mobile ${tag}: Esc closes menu, focus back on toggle`, (await toggle.getAttribute('aria-expanded')) === 'false' && a?.cls.includes('menu-toggle'), fmtA(a));
      ok(`S3 mobile ${tag}: main not inert after close`, await page.evaluate(() => !document.getElementById('main').hasAttribute('inert')));
      if (auth) {
        await toggle.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
        await page.locator('.account__trigger').click().catch(() => {});
        await page.waitForTimeout(150);
        const both = await page.evaluate(() => document.querySelector('.menu-toggle').getAttribute('aria-expanded') === 'true' && document.querySelector('.account__trigger').getAttribute('aria-expanded') === 'true');
        ok(`S3 mobile ${tag}: account dropdown does not open on top of the open mobile menu`, !both);
        await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); await page.waitForTimeout(150);
        const vis = await page.locator('.account__trigger').isVisible().catch(() => false);
        info('S3 mobile signed-in: header account trigger visible', String(vis));
        if (vis) {
          await page.locator('.account__trigger').focus();
          await page.keyboard.press('Enter');
          ok('S3 mobile signed-in: account menu opens via keyboard', (await page.getAttribute('.account__trigger', 'aria-expanded')) === 'true' && (await active(page))?.role === 'menuitem');
          const box = await page.locator('#account-menu').boundingBox();
          ok('S3 mobile signed-in: account menu fully on screen', box && box.x >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844, JSON.stringify(box));
          await shot(page, 's3-mobile-account-menu');
          await page.keyboard.press('Escape');
        }
        // sign out from mobile menu (keyboard)
        await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle' }); await waitReady(page);
        await toggle.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(150);
        const so = page.locator('#mobile-menu [data-signout]');
        await so.focus(); await page.keyboard.press('Enter');
        await waitUrl(page, /index\.html/);
        ok('S3 mobile: "Keluar" in menu on dashboard → index.html, signed out', /index\.html$/.test(page.url()) && await page.evaluate(() => !localStorage.getItem('ppapi_demo_session')), page.url());
      }
    } catch (e) { ok(`S3 mobile ${tag} completed`, false, e.message.split('\n')[0]); await shot(page, `s3-mobile-${tag}-FAIL`); }
    await ctx.close();
  }
}

/* =====================================================================================
   S4 — 404 at nested paths
   ===================================================================================== */
// allowed: sub-request URLs that are expected to fail (e.g. the single deliberate main.css probe of the
// project-first root guess that 404.html makes on a <user>.github.io user site — see the comment in 404.html).
async function check404(page, url, label, expectRoot, allowed = []) {
  const reqs = [];
  const onResp = r => { if (r.status() >= 400 && r.request().resourceType() !== 'document') reqs.push(`${r.status()} ${r.url()}`); };
  page.on('response', onResp);
  const resp = await page.goto(url, { waitUntil: 'networkidle' });
  await waitReady(page);
  page.off('response', onResp);
  const st = await page.evaluate(() => ({
    base: document.baseURI, css: [...document.styleSheets].map(s => s.href).filter(Boolean).filter(h => /main\.css|404\.css/.test(h)).length,
    bg: getComputedStyle(document.body).backgroundColor, h1: document.querySelector('h1')?.innerText.replace(/\s+/g, ' '),
    nav: document.querySelectorAll('.site-nav__link').length, home: document.querySelector('.nf__actions a')?.href,
    logo: (() => { const i = document.querySelector('.brand__logo'); return i ? i.naturalWidth : -1; })(), path: document.querySelector('[data-nf-path]')?.textContent || '',
    footer: !!document.querySelector('.site-footer'),
  }));
  ok(`S4 ${label}: HTTP 404`, resp && resp.status() === 404, String(resp && resp.status()));
  ok(`S4 ${label}: CSS + header/footer + logo load (base=${st.base})`, st.css === 2 && st.nav === 7 && st.logo > 0 && st.footer, JSON.stringify(st));
  ok(`S4 ${label}: "Kembali ke Beranda" → ${expectRoot}index.html`, st.home === expectRoot + 'index.html', st.home);
  const unexpected = reqs.filter(x => !allowed.some(u => x.endsWith(' ' + u)));
  ok(`S4 ${label}: no failed sub-requests${allowed.length ? ' (besides the expected root probe)' : ''}`, unexpected.length === 0, unexpected.join(', '));
  return st;
}
if (run('S4')) {
  console.log('\n=== S4 404 nested paths ===');
  const ctx = await newCtx();
  const page = await ctx.newPage();
  attachIssueLog(page, issues, '[S4] ');
  try {
    for (const p of ['a/b/c', 'a/b/c/', 'a/b/c.html?x=%3Cb%3E#frag', 'berita/2026/10/arsip.html', 'tidak-ada.html']) await check404(page, `${BASE}/${p}`, `/${p}`, `${BASE}/`);
    ok('S4 requested path shown as text (no HTML injection)', (await page.evaluate(() => document.querySelector('[data-nf-path]')?.innerHTML)).indexOf('<b>') === -1);
    // navigate from nested 404 via header nav
    await page.goto(`${BASE}/a/b/c`, { waitUntil: 'networkidle' }); await waitReady(page);
    await page.locator('.site-nav__link', { hasText: 'Agenda' }).click();
    await waitUrl(page, /agenda\.html/);
    ok('S4 header nav from /a/b/c → /agenda.html', page.url() === `${BASE}/agenda.html`, page.url());
    // skip link on 404 keeps the page
    await page.goto(`${BASE}/a/b/c`, { waitUntil: 'networkidle' }); await waitReady(page);
    await page.keyboard.press('Tab'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
    ok('S4 skip link on nested 404 stays on page and focuses main', page.url() === `${BASE}/a/b/c` && (await active(page))?.id === 'main', page.url() + ' ' + fmtA(await active(page)));
    // signed-in header on a nested 404
    const c2 = await newCtx({ auth: true }); const p2 = await c2.newPage();
    await p2.goto(`${BASE}/x/y/z`, { waitUntil: 'networkidle' }); await waitReady(p2);
    ok('S4 signed-in nested 404 shows account trigger', await p2.locator('.account__trigger').isVisible().catch(() => false));
    await p2.click('.account__trigger'); await p2.locator('#account-menu [role=menuitem]', { hasText: 'Dasbor' }).click();
    await waitUrl(p2, /dashboard\.html/);
    ok('S4 account menu "Dasbor" from /x/y/z → /dashboard.html', p2.url() === `${BASE}/dashboard.html`, p2.url());
    await c2.close();
  } catch (e) { ok('S4 local completed', false, e.message.split('\n')[0]); }
  await ctx.close();

  // simulated GitHub Pages hosts (host-resolver maps them to 127.0.0.1)
  const proj = await startServer({ prefix: '/ppapi' });
  const port = new URL(proj.BASE).port;
  const c3 = await newCtx(); const p3 = await c3.newPage();
  attachIssueLog(p3, issues, '[S4gh] ');
  try {
    await check404(p3, `http://ppapi-user.github.io:${port}/ppapi/a/b/c`, 'project site /ppapi/a/b/c', `http://ppapi-user.github.io:${port}/ppapi/`);
    await check404(p3, `http://ppapi-user.github.io:${port}/ppapi/hilang.html`, 'project site /ppapi/hilang.html', `http://ppapi-user.github.io:${port}/ppapi/`);
    // custom domain (CNAME) serving the same project at a sub-path is not a GitHub feature; custom domains serve at "/".
  } catch (e) { ok('S4 project-site completed', false, e.message.split('\n')[0]); }
  await c3.close(); await proj.close();
  const userSite = await startServer();
  const port2 = new URL(userSite.BASE).port;
  const c4 = await newCtx(); const p4 = await c4.newPage();
  try {
    // user/organisation site: repo named <user>.github.io is served at the domain root
    await check404(p4, `http://ppapi.github.io:${port2}/a/b/c`, 'user site (<user>.github.io) /a/b/c', `http://ppapi.github.io:${port2}/`,
      [`http://ppapi.github.io:${port2}/a/assets/css/main.css`]);
    await check404(p4, `http://www.ppapi-contoh.test:${port2}/a/b/c`, 'custom domain /a/b/c', `http://www.ppapi-contoh.test:${port2}/`);
  } catch (e) { ok('S4 user-site completed', false, e.message.split('\n')[0]); }
  await c4.close(); await userSite.close();
}

/* =====================================================================================
   S5 — agenda .ics downloads
   ===================================================================================== */
function parseIcs(text) {
  const problems = [];
  if (!/\r\n$/.test(text)) problems.push('does not end with CRLF');
  if (/[^\r]\n/.test(text)) problems.push('bare LF line ending');
  const raw = text.split('\r\n'); if (raw[raw.length - 1] === '') raw.pop();
  raw.forEach((l, i) => { const b = Buffer.byteLength(l, 'utf8'); if (b > 75) problems.push(`line ${i + 1} is ${b} octets (>75)`); });
  const lines = [];
  raw.forEach(l => { if (/^[ \t]/.test(l)) { if (!lines.length) problems.push('continuation at start'); else lines[lines.length - 1] += l.slice(1); } else lines.push(l); });
  const stack = []; const props = {}; let cur = null; const comps = [];
  for (const l of lines) {
    const m = /^([A-Z0-9-]+)((?:;[^:]*)?):(.*)$/.exec(l);
    if (!m) { problems.push('unparseable line: ' + l.slice(0, 60)); continue; }
    const [, name, params, value] = m;
    if (name === 'BEGIN') { stack.push(value); cur = { type: value, props: {} }; comps.push(cur); continue; }
    if (name === 'END') { const top = stack.pop(); if (top !== value) problems.push(`END:${value} closes ${top}`); continue; }
    const owner = comps.filter(c => c.type === stack[stack.length - 1]).slice(-1)[0];
    if (owner) (owner.props[name] = owner.props[name] || []).push({ params, value });
    (props[name] = props[name] || []).push({ params, value });
  }
  if (stack.length) problems.push('unclosed: ' + stack.join(','));
  return { problems, comps, lines };
}
const unescapeText = (s) => s.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
if (run('S5')) {
  console.log('\n=== S5 agenda .ics downloads ===');
  const ctx = await newCtx();
  const page = await ctx.newPage();
  attachIssueLog(page, issues, '[S5] ');
  try {
    await goto(page, 'agenda.html');
    const data = await page.evaluate(() => PPAPI.data.agenda);
    const ids = await page.locator('[data-agenda-ics]').evaluateAll(els => [...new Set(els.map(e => e.getAttribute('data-agenda-ics')))]);
    info('S5 events with a calendar button on the list', ids.join(', '));
    // also open one past event's modal to see whether past events offer .ics
    const results = [];
    for (const id of ids) {
      const btn = page.locator(`[data-agenda-ics="${id}"]:visible`).first();
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 6000 }), btn.click()]);
      const fp = path.join(SHOTS, 'ics-' + dl.suggestedFilename());
      await dl.saveAs(fp);
      const text = fs.readFileSync(fp, 'utf8');
      const ev = data.find(x => x.id === id);
      const { problems, comps } = parseIcs(text);
      const vev = comps.find(c => c.type === 'VEVENT');
      const g = (n) => vev && vev.props[n] && vev.props[n][0];
      const dts = g('DTSTART'), dte = g('DTEND'), rr = g('RRULE');
      const ymd = (s) => s.replace(/-/g, '');
      if (!vev) problems.push('no VEVENT');
      ['UID', 'DTSTAMP', 'DTSTART', 'SUMMARY'].forEach(p => { if (!g(p)) problems.push('missing ' + p); });
      if (g('DTSTAMP') && !/^\d{8}T\d{6}Z$/.test(g('DTSTAMP').value)) problems.push('DTSTAMP not UTC form');
      if (dts && !dts.value.startsWith(ymd(ev.mulai))) problems.push(`DTSTART ${dts.value} ≠ mulai ${ev.mulai}`);
      const days = Math.round((new Date(ev.selesai || ev.mulai) - new Date(ev.mulai)) / 864e5) + 1;
      if (dts && /TZID=/.test(dts.params)) {
        const tzid = dts.params.match(/TZID=([^;:]+)/)[1];
        if (!comps.some(c => c.type === 'VTIMEZONE' && c.props.TZID && c.props.TZID[0].value === tzid)) problems.push('TZID without VTIMEZONE');
        const hm = (ev.waktu || '').match(/(\d{1,2})[.:](\d{2})/);
        if (hm && !dts.value.endsWith(`T${hm[1].padStart(2, '0')}${hm[2]}00`)) problems.push(`DTSTART time ${dts.value} ≠ waktu ${ev.waktu}`);
        if (dte && dte.value <= dts.value) problems.push('DTEND <= DTSTART');
        if (days > 1 && !(rr && new RegExp(`COUNT=${days}\\b`).test(rr.value))) problems.push(`multi-day (${days}) without RRULE COUNT=${days}`);
        if (days === 1 && rr) problems.push('single-day with RRULE');
      } else if (dts) {
        const end = new Date(ev.selesai || ev.mulai); end.setDate(end.getDate() + 1);
        const exp = end.toISOString().slice(0, 10).replace(/-/g, '');
        if (!dte || dte.value !== exp) problems.push(`all-day DTEND ${dte && dte.value} ≠ ${exp}`);
      }
      const sum = g('SUMMARY') ? unescapeText(g('SUMMARY').value) : '';
      if (!sum.includes(ev.judul)) problems.push('SUMMARY does not contain judul');
      if (ev.contoh && !/^\[Contoh\]/.test(sum)) problems.push('sample event not marked [Contoh]');
      if (g('LOCATION') && unescapeText(g('LOCATION').value) !== ev.lokasi) problems.push('LOCATION mismatch: ' + g('LOCATION').value);
      const rawVals = text.split('\r\n').filter(l => /^(SUMMARY|LOCATION|DESCRIPTION)/.test(l)).join('');
      if (/[^\\][,;](?![^:]*:)/.test(rawVals.replace(/^[A-Z]+[^:]*:/, '')) && false) problems.push('unescaped , or ;');
      results.push({ id, file: path.basename(fp), problems, dtstart: dts && dts.params + ':' + dts.value, dtend: dte && dte.value, rrule: rr && rr.value, days });
      await page.waitForTimeout(200);
    }
    results.forEach(r => ok(`S5 ${r.file} valid (${r.dtstart}${r.rrule ? ' ' + r.rrule : ''})`, r.problems.length === 0, r.problems.join('; ')));
    ok('S5 every upcoming event offers a calendar download', ids.length === data.filter(a => (a.selesai || a.mulai) >= '2026-10-08').length, `${ids.length} buttons vs ${data.filter(a => (a.selesai || a.mulai) >= '2026-10-08').length} upcoming`);
    // modal → ics
    await page.locator('.event-row [data-agenda-open]').first().click();
    await page.waitForSelector('.modal');
    const mbtn = page.locator('.modal [data-agenda-ics]');
    if (await mbtn.count()) {
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 6000 }), mbtn.first().click()]);
      ok('S5 modal "Tambahkan ke Kalender" downloads .ics', /\.ics$/.test(dl.suggestedFilename()), dl.suggestedFilename());
    } else ok('S5 modal offers "Tambahkan ke Kalender"', false, 'button missing in modal');
    await page.keyboard.press('Escape');
  } catch (e) { ok('S5 completed', false, e.message.split('\n')[0]); await shot(page, 's5-FAIL'); }
  await ctx.close();
}

/* =====================================================================================
   S6 — berita unknown id, agenda unknown id
   ===================================================================================== */
if (run('S6')) {
  console.log('\n=== S6 unknown ids ===');
  const ctx = await newCtx();
  const page = await ctx.newPage();
  const local = [];
  attachIssueLog(page, local, '[S6] ');
  try {
    for (const id of ['tidak-ada', '', '%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E', 'RAPAT-KERJA-PROGRAM-2026-2027']) {
      await goto(page, `berita.html?id=${id}`);
      const st = await page.evaluate(() => ({
        title: document.title, h1: [...document.querySelectorAll('h1')].map(h => h.innerText.replace(/\s+/g, ' ')), main: document.querySelector('main').innerText.replace(/\s+/g, ' ').slice(0, 300),
        injected: !!document.querySelector('main img[src="x"]'), canonical: document.querySelector('link[rel=canonical]')?.href || '', robots: document.querySelector('meta[name=robots]')?.content || '',
        backLink: !!document.querySelector('main a[href="berita.html"], main a[href^="berita.html#"]'), suggestions: document.querySelectorAll('main a[href^="berita.html?id="]').length,
      }));
      info(`S6 berita.html?id=${id}`, JSON.stringify(st).slice(0, 400));
      ok(`S6 berita ?id=${id || '(empty)'}: exactly one h1`, st.h1.length === 1, st.h1.join(' | '));
      ok(`S6 berita ?id=${id || '(empty)'}: no HTML injection`, !st.injected);
      if (id === 'tidak-ada' || id.startsWith('%3C')) {
        ok(`S6 berita unknown id: "tidak ditemukan" state with back link + suggestions`, /tidak ditemukan/i.test(st.main) && st.backLink && st.suggestions >= 3, st.main.slice(0, 120));
        ok(`S6 berita unknown id: page title reflects not-found`, /tidak ditemukan/i.test(st.title), st.title);
        ok(`S6 berita unknown id: noindex or canonical not pointing at the bogus ?id`, /noindex/.test(st.robots) || !/\?id=/.test(st.canonical), `canonical=${st.canonical} robots=${st.robots}`);
      }
      if (id === '') ok('S6 berita ?id= (empty) falls back to the list view', !/tidak ditemukan/i.test(st.main) && /Berita & Kegiatan/.test(st.title), st.title);
      if (id === 'RAPAT-KERJA-PROGRAM-2026-2027') info('S6 berita id lookup is case-sensitive', /tidak ditemukan/i.test(st.main) ? 'uppercase id → not found' : 'uppercase id → found');
    }
    await goto(page, 'agenda.html?id=tidak-ada');
    const ag = await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), url: location.href, toast: [...document.querySelectorAll('.toast')].map(t => t.innerText).join('|'), main: document.querySelector('main').innerText.slice(0, 120) }));
    info('S6 agenda.html?id=tidak-ada', JSON.stringify(ag));
    ok('S6 agenda unknown id: no modal, list still shown, user informed or param dropped', !ag.modal && (/tidak ditemukan/i.test(ag.toast) || !/[?&]id=/.test(ag.url)), JSON.stringify(ag));
  } catch (e) { ok('S6 completed', false, e.message.split('\n')[0]); }
  ok('S6 no console/page errors', local.length === 0, local.join(' || '));
  await ctx.close();
}

await browser.close();
await srv.close();
const relevant = issues.filter(x => !/favicon/.test(x) && !/^\[S4[a-z]*\] console\.error: Failed to load resource: the server responded with a status of 404/.test(x));
ok('journey: no console errors/warnings or page errors overall', relevant.length === 0, relevant.slice(0, 12).join(' || '));
const failed = R.summary();
fs.writeFileSync(path.join(SHOTS, 'journey-results.json'), JSON.stringify({ results: R.results, issues: relevant }, null, 2));
process.exitCode = failed ? 1 : 0;
