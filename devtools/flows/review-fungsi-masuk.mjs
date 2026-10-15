// review-fungsi-masuk — masuk.html exploratory checks (demo mode): tabs/hash, validation (empty, wrong formats,
// overlong, mismatch), strength meter, sign-up → pendaftaran, sign-in → next, wrong password, duplicate e-mail,
// forgot-password modal, phone OTP (wrong code, 123456, resend countdown), Google demo, next= handling incl.
// unsafe values, back/forward after sign-in, demo admin fill. Desktop + mobile. REVIEW ONLY.
// Run from devtools/:  node flows/review-fungsi-masuk.mjs
import { startServer, launch, newContext, watch, toasts, open, shot, recorder, waitReady } from './review-fungsi-lib.mjs';

const srv = await startServer();
const BASE = srv.BASE;
const browser = await launch();
const R = recorder('review-fungsi-masuk');
const allIssues = [];
const urlOf = (page) => page.url().replace(BASE, '');
const q = (page, sel) => page.evaluate((s) => window.__rv.txt(s), sel);

async function fresh(vp = 'desktop', state = 'signed-out') {
  const ctx = await newContext(browser, { vp, state });
  const page = await ctx.newPage();
  const issues = watch(page, `[masuk/${vp}] `);
  return { ctx, page, issues };
}

for (const vp of ['desktop', 'mobile']) {
  const { ctx, page, issues } = await fresh(vp);
  try {
    // --- tabs + hash
    await open(page, `${BASE}/masuk.html#daftar`);
    const t0 = await page.evaluate(() => ({ sel: document.getElementById('tab-daftar').getAttribute('aria-selected'), panel: !document.getElementById('panel-daftar').hidden, demo: window.__rv.vis(document.querySelector('[data-demo-note]')), admin: window.__rv.txt('[data-demo-admin-email]'), pass: window.__rv.txt('[data-demo-admin-pass]') }));
    R.ok(`${vp}: #daftar opens the Daftar tab`, t0.sel === 'true' && t0.panel, JSON.stringify(t0));
    R.ok(`${vp}: demo note shows admin credentials`, t0.demo && t0.admin === 'admin@ppapi.demo' && t0.pass === 'AdminPPAPI2026', JSON.stringify(t0));
    // --- sign-up validation: empty submit
    await page.click('[data-form="daftar-email"] button[type="submit"]'); await page.waitForTimeout(300);
    const v1 = await page.evaluate(() => ({ errs: window.__rv.allVis('#panel-daftar .field__error').filter(Boolean), focus: window.__rv.focused(), inv: [...document.querySelectorAll('#panel-daftar [aria-invalid="true"]')].map(e => e.id) }));
    R.ok(`${vp}: empty sign-up → 5 errors, focus on first invalid (name)`, v1.inv.length >= 5 && /d-name/.test(v1.focus), JSON.stringify(v1).slice(0, 300));
    await page.fill('#d-name', 'Al'); await page.fill('#d-email', 'bukan email'); await page.fill('#d-pass', 'pendek'); await page.fill('#d-pass2', 'lain');
    await page.click('[data-form="daftar-email"] button[type="submit"]'); await page.waitForTimeout(300);
    const v2 = await page.evaluate(() => ({ name: window.__rv.txt('#d-name-err'), email: window.__rv.txt('#d-email-err'), pass: window.__rv.txt('#d-pass-err'), pass2: window.__rv.txt('#d-pass2-err'), agree: window.__rv.txt('#d-agree-err'), strength: document.querySelector('[data-strength]').getAttribute('data-level'), label: window.__rv.txt('#d-pass-strength-label') }));
    R.ok(`${vp}: short name / bad email / weak password / mismatch / no consent each flagged`, v2.name && v2.email && v2.pass && v2.pass2 && v2.agree, JSON.stringify(v2));
    await page.fill('#d-pass', 'Perancah2026!'); await page.waitForTimeout(200);
    const st = await page.evaluate(() => ({ level: document.querySelector('[data-strength]').getAttribute('data-level'), label: window.__rv.txt('#d-pass-strength-label') }));
    R.ok(`${vp}: strength meter reacts (level ≥ 2 for a strong password)`, Number(st.level) >= 2 && /Kuat|Sedang/.test(st.label), JSON.stringify(st));
    // overlong name (maxlength 120)
    await page.fill('#d-name', 'A'.repeat(150));
    const nl = await page.evaluate(() => document.getElementById('d-name').value.length);
    R.ok(`${vp}: name capped at 120 characters`, nl === 120, `${nl}`);
    // password toggle
    await page.click('#panel-daftar .password-toggle__btn'); await page.waitForTimeout(100);
    const pt = await page.evaluate(() => ({ type: document.getElementById('d-pass').type, pressed: document.querySelector('#panel-daftar .password-toggle__btn').getAttribute('aria-pressed') }));
    R.ok(`${vp}: password toggle reveals the password`, pt.type === 'text' && pt.pressed === 'true', JSON.stringify(pt));
    // --- successful sign-up → pendaftaran.html
    const email = `uji.${vp}.${Date.now()}@contoh.id`;
    await page.fill('#d-name', 'Penguji Masuk'); await page.fill('#d-email', email); await page.fill('#d-pass', 'Perancah2026!'); await page.fill('#d-pass2', 'Perancah2026!'); await page.check('#d-agree');
    await page.click('[data-form="daftar-email"] button[type="submit"]');
    await page.waitForURL(/pendaftaran\.html/, { timeout: 10000 }).catch(() => {});
    await waitReady(page); await page.waitForTimeout(800);
    R.ok(`${vp}: sign-up lands on pendaftaran.html`, /pendaftaran\.html/.test(page.url()), urlOf(page));
    const t1 = await toasts(page);
    R.ok(`${vp}: welcome toast after sign-up (once)`, t1.length === 1, JSON.stringify(t1));
    const hero = await q(page, '#daf-hero-status');
    R.ok(`${vp}: new account is Draf`, /Draf/.test(hero || ''), String(hero));
    // --- signed in → masuk.html redirects to dashboard (guest gate); with next= → next
    await open(page, `${BASE}/masuk.html?next=agenda.html`);
    R.ok(`${vp}: signed-in visitor on masuk.html?next=agenda.html → agenda.html`, /agenda\.html/.test(page.url()), urlOf(page));
    await open(page, `${BASE}/masuk.html?next=https://evil.example/x`);
    R.ok(`${vp}: unsafe absolute next= ignored → dashboard`, /dashboard\.html/.test(page.url()), urlOf(page));
    await open(page, `${BASE}/masuk.html?next=//evil.example`);
    R.ok(`${vp}: protocol-relative next= ignored → dashboard`, /dashboard\.html/.test(page.url()) && !/evil/.test(page.url()), urlOf(page));
    // --- sign out from a public page → stays, toast
    await open(page, `${BASE}/index.html`);
    await page.click('.account__trigger'); await page.waitForTimeout(200); await page.click('#account-menu [data-signout]'); await page.waitForTimeout(800);
    const so = await page.evaluate(() => ({ url: location.pathname, guest: !!document.querySelector('.account__guest') }));
    R.ok(`${vp}: Keluar from a public page stays on the page as guest`, /index\.html$/.test(so.url) && so.guest, JSON.stringify(so));
    const t2 = await toasts(page);
    R.ok(`${vp}: sign-out toast once`, t2.filter(t => /keluar/i.test(t)).length === 1, JSON.stringify(t2));
    // --- sign-in wrong password, then right with next=
    await open(page, `${BASE}/masuk.html?next=pustaka.html%3Fkategori%3Dstandar%23katalog`);
    const nn = await page.evaluate(() => ({ note: window.__rv.vis(document.querySelector('[data-next-note]')), txt: window.__rv.txt('[data-next-text]') }));
    R.ok(`${vp}: next= note visible and names the target`, nn.note && /Pengetahuan|pustaka|halaman/i.test(nn.txt), JSON.stringify(nn));
    await page.fill('#m-email', email); await page.fill('#m-pass', 'salah123'); await page.click('[data-form="masuk-email"] button[type="submit"]'); await page.waitForTimeout(900);
    const wrong = await page.evaluate(() => ({ alert: window.__rv.txt('#panel-masuk [data-alert]'), url: location.pathname }));
    R.ok(`${vp}: wrong password → Indonesian alert, stays on masuk`, /sandi|email|cocok|salah|tidak/i.test(wrong.alert || '') && /masuk\.html/.test(wrong.url), JSON.stringify(wrong));
    await page.fill('#m-pass', 'Perancah2026!'); await page.click('[data-form="masuk-email"] button[type="submit"]');
    await page.waitForURL(/pustaka\.html/, { timeout: 10000 }).catch(() => {}); await waitReady(page); await page.waitForTimeout(700);
    R.ok(`${vp}: sign-in follows next= (query + hash kept)`, /pustaka\.html\?kategori=standar#katalog/.test(page.url()), urlOf(page));
    // back after sign-in must not return to a usable masuk form (guest gate → dashboard)
    await page.goBack().catch(() => {}); await page.waitForTimeout(1200);
    R.ok(`${vp}: Back after sign-in does not re-show the sign-in form`, !/masuk\.html/.test(page.url()) || await page.evaluate(() => !document.body.classList.contains('auth-ready')), urlOf(page));
    // --- duplicate e-mail sign-up
    await open(page, `${BASE}/index.html`);
    await page.click('.account__trigger'); await page.waitForTimeout(150); await page.click('#account-menu [data-signout]'); await page.waitForTimeout(600);
    await open(page, `${BASE}/masuk.html#daftar`);
    await page.fill('#d-name', 'Penguji Dua'); await page.fill('#d-email', email); await page.fill('#d-pass', 'Perancah2026!'); await page.fill('#d-pass2', 'Perancah2026!'); await page.check('#d-agree');
    await page.click('[data-form="daftar-email"] button[type="submit"]'); await page.waitForTimeout(900);
    const dup = await page.evaluate(() => ({ alert: window.__rv.txt('#panel-daftar [data-alert]'), btns: window.__rv.allVis('#panel-daftar [data-alert] button, #panel-daftar [data-alert] a') }));
    R.ok(`${vp}: duplicate e-mail → alert with a "Masuk" action`, /terdaftar|sudah/i.test(dup.alert || '') && dup.btns.some(b => /Masuk/.test(b)), JSON.stringify(dup));
    // --- forgot password modal
    await page.click('[data-switch="masuk"]'); await page.waitForTimeout(200);
    await page.fill('#m-email', 'bukan-email'); await page.evaluate(() => document.getElementById('m-email').blur()); await page.waitForTimeout(200); await page.click('[data-forgot]'); await page.waitForTimeout(400);
    const fp0 = await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), title: window.__rv.txt('.modal__title'), prefill: document.getElementById('fp-email')?.value, focus: window.__rv.focused() }));
    R.ok(`${vp}: "Lupa kata sandi?" opens modal (invalid e-mail not prefilled)`, fp0.modal && /kata sandi/i.test(fp0.title) && fp0.prefill === '', JSON.stringify(fp0));
    await page.click('.modal__footer .btn--primary'); await page.waitForTimeout(300);
    const fp1 = await q(page, '#fp-email-err');
    R.ok(`${vp}: forgot modal validates empty e-mail`, !!fp1, String(fp1));
    await page.fill('#fp-email', 'tidak@terdaftar.id'); await page.click('.modal__footer .btn--primary'); await page.waitForTimeout(700);
    const fp2 = await page.evaluate(() => ({ sent: window.__rv.txt('.auth-sent'), btns: window.__rv.allVis('.modal__footer .btn') }));
    R.ok(`${vp}: forgot → neutral "periksa kotak masuk" (no account enumeration) + Tutup`, /Periksa kotak masuk|Jika/.test(fp2.sent || '') && fp2.btns.length === 1 && /Tutup/.test(fp2.btns[0]), JSON.stringify(fp2));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    R.ok(`${vp}: Esc closes forgot modal`, !(await page.evaluate(() => !!document.querySelector('.modal'))));
    // --- phone OTP sign-in (new number → Lengkapi profil)
    await page.click('#panel-masuk [data-method-switch] [data-value="phone"]'); await page.waitForTimeout(200);
    await page.fill('#mp-phone', '123'); await page.click('#masuk-phone-pane [data-send-otp]'); await page.waitForTimeout(300);
    R.ok(`${vp}: bad phone rejected`, !!(await q(page, '#mp-phone-err')));
    const phone = '0812' + String(Date.now()).slice(-8);
    await page.fill('#mp-phone', phone); await page.click('#masuk-phone-pane [data-send-otp]'); await page.waitForTimeout(800);
    const otp = await page.evaluate(() => ({ step2: window.__rv.vis(document.querySelector('#masuk-phone-pane [data-phone-step="2"]')), to: window.__rv.txt('#masuk-phone-pane [data-otp-target]'), demoHint: window.__rv.vis(document.querySelector('#masuk-phone-pane [data-demo-only]')), resend: window.__rv.txt('#masuk-phone-pane [data-resend]'), inputs: document.querySelectorAll('#masuk-phone-pane [data-otp] input').length }));
    R.ok(`${vp}: OTP step shows masked number, demo hint, 6 inputs, resend countdown`, otp.step2 && otp.demoHint && otp.inputs === 6 && /\d+:\d\d|dalam/.test(otp.resend || ''), JSON.stringify(otp));
    const inputs = await page.$$('#masuk-phone-pane [data-otp] input');
    for (let i = 0; i < 6; i++) await inputs[i].type('0');
    await page.click('#masuk-phone-pane [data-verify]'); await page.waitForTimeout(800);
    const bad = await page.evaluate(() => ({ err: window.__rv.txt('#mp-otp-err') || window.__rv.txt('#panel-masuk [data-alert]'), url: location.pathname }));
    R.ok(`${vp}: wrong OTP → error, stays`, !!bad.err && /masuk\.html/.test(bad.url), JSON.stringify(bad));
    await inputs[0].focus();
    await page.keyboard.press('Control+A').catch(() => {});
    // paste-like: type the code into the first box (auto-advance)
    for (let i = 0; i < 6; i++) { await inputs[i].fill(''); }
    await inputs[0].focus(); await page.keyboard.type('123456'); await page.waitForTimeout(200);
    await page.click('#masuk-phone-pane [data-verify]'); await page.waitForTimeout(1000);
    const comp = await page.evaluate(() => ({ vis: window.__rv.vis(document.querySelector('[data-complete]')), id: window.__rv.txt('[data-complete-id]'), label: window.__rv.txt('[data-complete-label]') }));
    R.ok(`${vp}: new phone number → "Lengkapi profil" step with the verified number`, comp.vis && /\+62/.test(comp.id || ''), JSON.stringify(comp));
    await page.click('[data-form="complete"] button[type="submit"]'); await page.waitForTimeout(300);
    const cerr = await q(page, '#c-name-err');
    R.ok(`${vp}: complete-profile validates name`, !!cerr, String(cerr));
    await page.fill('#c-name', 'Penguji OTP'); await page.check('#c-agree'); await page.click('[data-form="complete"] button[type="submit"]');
    await page.waitForURL(/pendaftaran\.html|dashboard\.html/, { timeout: 10000 }).catch(() => {}); await waitReady(page); await page.waitForTimeout(600);
    R.ok(`${vp}: completed phone sign-up continues to pendaftaran.html`, /pendaftaran\.html/.test(page.url()), urlOf(page));
    await shot(page, `masuk-${vp}-after-otp`);
    // --- Google demo (sign-out first)
    await open(page, `${BASE}/index.html`);
    await page.click('.account__trigger'); await page.waitForTimeout(150); await page.click('#account-menu [data-signout]'); await page.waitForTimeout(600);
    await open(page, `${BASE}/masuk.html`);
    await page.click('#panel-masuk [data-google]'); await page.waitForTimeout(1200);
    const g = await page.evaluate(() => ({ url: location.pathname, complete: window.__rv.vis(document.querySelector('[data-complete]')), id: window.__rv.txt('[data-complete-id]'), label: window.__rv.txt('[data-complete-label]'), alert: window.__rv.txt('#panel-masuk [data-alert]') }));
    R.ok(`${vp}: Google demo from Masuk tab → account or completion step (no error)`, (g.complete || /pendaftaran|dashboard/.test(g.url)) && !g.alert, JSON.stringify(g));
    if (g.complete) {
      await page.fill('#c-name', 'Penguji Google'); await page.check('#c-agree').catch(() => {}); await page.click('[data-form="complete"] button[type="submit"]');
      await page.waitForURL(/pendaftaran\.html|dashboard\.html/, { timeout: 10000 }).catch(() => {}); await waitReady(page); await page.waitForTimeout(500);
      R.ok(`${vp}: Google new account → pendaftaran.html`, /pendaftaran\.html/.test(page.url()), urlOf(page));
    }
    // --- demo admin fill button
    await open(page, `${BASE}/index.html`);
    await page.click('.account__trigger'); await page.waitForTimeout(150); await page.click('#account-menu [data-signout]'); await page.waitForTimeout(600);
    await open(page, `${BASE}/masuk.html#daftar`);
    await page.click('[data-demo-admin-fill]'); await page.waitForTimeout(400);
    const fill = await page.evaluate(() => ({ tab: document.getElementById('tab-masuk').getAttribute('aria-selected'), email: document.getElementById('m-email').value, pass: document.getElementById('m-pass').value, focus: window.__rv.focused() }));
    R.ok(`${vp}: "Isi formulir masuk dengan akun admin" switches to Masuk and fills both fields`, fill.tab === 'true' && fill.email === 'admin@ppapi.demo' && fill.pass === 'AdminPPAPI2026', JSON.stringify(fill));
    await page.click('[data-form="masuk-email"] button[type="submit"]');
    await page.waitForURL(/dashboard\.html/, { timeout: 10000 }).catch(() => {}); await waitReady(page); await page.waitForTimeout(800);
    const adm = await page.evaluate(() => ({ url: location.pathname, admin: window.__rv.vis(document.getElementById('dash-admin')), self: window.__rv.vis(document.getElementById('dash-self')) }));
    R.ok(`${vp}: admin sign-in → dashboard with Konsol Admin band`, /dashboard\.html/.test(adm.url) && adm.admin, JSON.stringify(adm));
    const t3 = await toasts(page);
    const dups = t3.filter((t, i) => t3.indexOf(t) !== i);
    R.ok(`${vp}: no duplicated toasts across the session`, dups.length === 0, JSON.stringify(dups));
  } catch (e) { R.ok(`${vp}: scenario threw`, false, e.message.slice(0, 300)); }
  R.ok(`${vp}: no console/page/request errors`, issues.length === 0, issues.slice(0, 4).join(' | '));
  allIssues.push(...issues);
  await ctx.close();
}

await browser.close();
await srv.close();
const failed = R.summary();
process.exit(failed ? 1 : 0);
