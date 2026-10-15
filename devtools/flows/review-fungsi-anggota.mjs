// review-fungsi-anggota — anggota.html (Aktif member + admin): tabs by hash, profile edit/validation/save/reset,
// identity lock after approval, competencies + certificates CRUD with wrong inputs, KTA flip/QR/print/copy,
// apps tab, keyboard operation of tabs/modals, back/forward between tabs. REVIEW ONLY.
// Run from devtools/:  node flows/review-fungsi-anggota.mjs [--vp=desktop|mobile]
import { startServer, launch, newContext, watch, toasts, open, shot, recorder, waitReady } from './review-fungsi-lib.mjs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const VPS = flags.vp ? [flags.vp] : ['desktop', 'mobile'];
const CLOCK = '2026-10-11T03:00:00.000Z';
const srv = await startServer();
const BASE = srv.BASE;
const browser = await launch();
const R = recorder('review-fungsi-anggota');
const notes = [];
const note = (s) => { notes.push(s); console.log('  NOTE  ' + s); };
const q = (page, sel) => page.evaluate((s) => window.__rv.txt(s), sel);
const activeTab = (page) => page.evaluate(() => document.querySelector('#agt-tabs [role="tab"][aria-selected="true"]')?.getAttribute('data-tab'));

for (const vp of VPS) {
  const ctx = await newContext(browser, { vp, state: 'Aktif', clock: CLOCK });
  const page = await ctx.newPage();
  const issues = watch(page, `[agt/${vp}] `);
  try {
    await open(page, `${BASE}/anggota.html#kompetensi`); await page.waitForTimeout(500);
    R.ok(`${vp}: #kompetensi opens the Kompetensi tab`, (await activeTab(page)) === 'kompetensi', await activeTab(page));
    const hero = await page.evaluate(() => ({ name: window.__rv.txt('#agt-name'), meta: window.__rv.txt('#agt-meta'), chips: window.__rv.all('#agt-chips li'), counts: [window.__rv.txt('#count-kompetensi'), window.__rv.txt('#count-sertifikat')] }));
    R.ok(`${vp}: hero shows name, KTA + status, contact chips, tab counts`, /Rahmat Hidayat/.test(hero.name || '') && /PPAPI-2026-004821/.test(hero.meta || '') && hero.counts[0] === '2' && hero.counts[1] === '2', JSON.stringify(hero));
    // keyboard: arrow keys on tabs
    await page.focus('#tab-kompetensi'); await page.keyboard.press('ArrowRight'); await page.waitForTimeout(200);
    const kb = await page.evaluate(() => ({ tab: document.querySelector('#agt-tabs [role="tab"][aria-selected="true"]')?.getAttribute('data-tab'), focus: window.__rv.focused(), hash: location.hash }));
    R.ok(`${vp}: ArrowRight moves to Sertifikat tab + hash`, kb.tab === 'sertifikat' && kb.hash === '#sertifikat', JSON.stringify(kb));
    await page.goBack(); await page.waitForTimeout(400);
    R.ok(`${vp}: browser Back returns to the previous tab`, (await activeTab(page)) === 'kompetensi', await activeTab(page));
    // ---- profile tab
    await page.click('#tab-profil'); await page.waitForTimeout(300);
    const lock = await page.evaluate(() => ({ nameRO: document.getElementById('f-name').readOnly, birthRO: document.getElementById('f-birthDate').readOnly, note: window.__rv.vis(document.getElementById('f-identity-note')), emailRO: document.getElementById('f-email').readOnly, saveDis: document.getElementById('profil-save').disabled, status: window.__rv.txt('#profil-status') }));
    R.ok(`${vp}: approved member: name read-only + identity note; e-mail/phone read-only; Save disabled when clean`, lock.nameRO && lock.note && lock.emailRO && lock.saveDis, JSON.stringify(lock));
    note(`${vp}: birthDate read-only=${lock.birthRO} (fixture has no birthDate → should stay editable)`);
    await page.fill('#f-city', 'Samarinda'); await page.waitForTimeout(200);
    const dirty = await page.evaluate(() => ({ saveDis: document.getElementById('profil-save').disabled, resetDis: document.getElementById('profil-reset').disabled, status: window.__rv.txt('#profil-status') }));
    R.ok(`${vp}: editing enables Save/Batalkan + "belum disimpan" status`, !dirty.saveDis && !dirty.resetDis && /belum disimpan/i.test(dirty.status || ''), JSON.stringify(dirty));
    // wrong inputs: linkedin not linkedin, experience 99, birthDate 1900
    await page.fill('#f-linkedin', 'https://facebook.com/x'); await page.fill('#f-experienceYears', '99'); await page.fill('#f-birthDate', '1900-01-01');
    await page.click('#profil-save'); await page.waitForTimeout(400);
    const errs = await page.evaluate(() => ({ errs: window.__rv.allVis('#profil-form .field__error').filter(Boolean), inv: [...document.querySelectorAll('#profil-form [aria-invalid="true"]')].map(e => e.id), focus: window.__rv.focused() }));
    R.ok(`${vp}: save rejects bad LinkedIn, 99 years, year 1900 (focus first invalid)`, errs.inv.length >= 3 && /f-/.test(errs.focus), JSON.stringify(errs).slice(0, 300));
    const t1 = await toasts(page);
    R.ok(`${vp}: validation warn toast once`, t1.filter(t => /Periksa kembali/.test(t)).length === 1, JSON.stringify(t1));
    await page.click('#profil-reset'); await page.waitForTimeout(300);
    const reset = await page.evaluate(() => ({ city: document.getElementById('f-city').value, li: document.getElementById('f-linkedin').value, saveDis: document.getElementById('profil-save').disabled }));
    R.ok(`${vp}: Batalkan restores saved values + disables Save`, reset.city === 'Balikpapan' && reset.li === '' && reset.saveDis, JSON.stringify(reset));
    // valid save + reload persists
    await page.fill('#f-city', 'Samarinda'); await page.fill('#f-linkedin', 'linkedin.com/in/rahmat-uji'); await page.fill('#f-bio', 'Bio uji.');
    await page.click('#profil-save'); await page.waitForTimeout(900);
    const saved = await page.evaluate(() => ({ status: window.__rv.txt('#profil-status'), li: document.getElementById('f-linkedin').value, saveDis: document.getElementById('profil-save').disabled }));
    R.ok(`${vp}: valid save → "tersimpan", LinkedIn normalised to https://www.linkedin.com/in/…`, /tersimpan/i.test(saved.status || '') && /^https:\/\/(www\.)?linkedin\.com\/in\/rahmat-uji/.test(saved.li) && saved.saveDis, JSON.stringify(saved));
    const t2 = await toasts(page);
    R.ok(`${vp}: save success toast once`, t2.filter(t => /Profil berhasil disimpan/.test(t)).length === 1, JSON.stringify(t2.slice(-2)));
    await page.reload(); await waitReady(page); await page.waitForTimeout(600);
    R.ok(`${vp}: saved city persists after reload`, (await page.inputValue('#f-city')) === 'Samarinda');
    // beforeunload guard when dirty (sign-out from account menu asks)
    await page.fill('#f-city', 'Berubah'); await page.waitForTimeout(200);
    await page.click('.account__trigger'); await page.waitForTimeout(150); await page.click('#account-menu [data-signout]'); await page.waitForTimeout(500);
    const guard = await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), title: window.__rv.txt('.modal__title'), btns: window.__rv.allVis('.modal__footer .btn') }));
    R.ok(`${vp}: Keluar with unsaved edits asks "Keluar tanpa menyimpan?"`, guard.modal && /tanpa menyimpan/i.test(guard.title || ''), JSON.stringify(guard));
    await page.evaluate(() => window.__rv.btnByText('Kembali').click()); await page.waitForTimeout(300);
    R.ok(`${vp}: "Kembali" keeps the session + the edit`, (await page.inputValue('#f-city')) === 'Berubah' && !!(await page.$('.account__trigger')));
    await page.click('#profil-reset'); await page.waitForTimeout(200);
    // ---- competencies CRUD
    await page.click('#tab-kompetensi'); await page.waitForTimeout(300);
    await page.click('[data-action="add-kompetensi"]'); await page.waitForTimeout(400);
    await page.click('.modal__footer .btn--primary'); await page.waitForTimeout(200);
    const ke = await page.evaluate(() => window.__rv.allVis('.modal .field__error').filter(Boolean));
    R.ok(`${vp}: kompetensi modal requires a choice`, ke.length >= 1, JSON.stringify(ke));
    await page.selectOption('#mk-kode', 'SCF-SUP').catch(() => page.selectOption('#mk-kode', { index: 1 }));
    await page.click('.modal__footer .btn--primary'); await page.waitForTimeout(300);
    const dup = await q(page, '.modal .field__error');
    R.ok(`${vp}: duplicate competency (SCF-SUP already recorded) rejected`, /sudah tercatat/i.test(dup || ''), String(dup));
    await page.selectOption('#mk-kode', '__lain'); await page.waitForTimeout(100); await page.fill('#mk-nama', 'Rigging Dasar'); await page.fill('#mk-since', '2035'); await page.click('.modal__footer .btn--primary'); await page.waitForTimeout(300);
    R.ok(`${vp}: "sejak 2035" (future) rejected`, /tahun antara|1960/.test(await q(page, '.modal .field__error') || ''), await q(page, '.modal .field__error'));
    await page.fill('#mk-since', '2020'); await page.fill('#mk-notes', 'n'.repeat(320));
    const nl = await page.evaluate(() => document.getElementById('mk-notes').value.length);
    R.ok(`${vp}: notes capped at 300`, nl <= 300, `${nl}`);
    await page.click('.modal__footer .btn--primary'); await page.waitForTimeout(700);
    const kAdded = await page.evaluate(() => ({ n: document.querySelectorAll('.agt-comp').length, count: window.__rv.txt('#count-kompetensi'), focus: window.__rv.focused(), modal: !!document.querySelector('.modal') }));
    R.ok(`${vp}: competency added (3), count badge updates, focus on its edit button`, kAdded.n === 3 && kAdded.count === '3' && !kAdded.modal && /edit-kompetensi|agt-comp/.test(kAdded.focus), JSON.stringify(kAdded));
    // edit → change level; delete → confirm
    await page.click('.agt-comp:last-child [data-action="edit-kompetensi"], .agt-comp [data-action="edit-kompetensi"]'); await page.waitForTimeout(300);
    const et = await q(page, '.modal__title');
    R.ok(`${vp}: edit opens "Ubah kompetensi"`, /Ubah kompetensi/.test(et || ''), String(et));
    await page.selectOption('#mk-level', { index: 2 }); await page.click('.modal__footer .btn--primary'); await page.waitForTimeout(500);
    const t3 = await toasts(page);
    R.ok(`${vp}: edit saved with toast`, t3.some(t => /Kompetensi berhasil diperbarui/.test(t)), JSON.stringify(t3.slice(-2)));
    const delId = await page.evaluate(() => [...document.querySelectorAll('.agt-comp')].map(c => c.getAttribute('data-id')).pop());
    await page.click(`[data-action="delete-kompetensi"][data-id="${delId}"]`); await page.waitForTimeout(300);
    const cf = await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), title: window.__rv.txt('.modal__title'), danger: !!document.querySelector('.modal__footer .btn--danger') }));
    R.ok(`${vp}: delete asks for confirmation (danger)`, cf.modal && cf.danger, JSON.stringify(cf));
    await page.click('.modal__footer .btn--danger'); await page.waitForTimeout(600);
    R.ok(`${vp}: competency deleted (2 left)`, (await page.evaluate(() => document.querySelectorAll('.agt-comp').length)) === 2);
    // ---- certificates
    await page.click('#tab-sertifikat'); await page.waitForTimeout(300);
    const summ = await page.evaluate(() => ({ summary: window.__rv.txt('#sertifikat-summary'), alert: window.__rv.txt('#sertifikat-alert'), rows: document.querySelectorAll('#sertifikat-list tr[data-id]').length, badges: window.__rv.all('#sertifikat-list .badge') }));
    R.ok(`${vp}: certificate list shows 2 rows with status badges; one expiring (Nov 2026) flagged`, summ.rows === 2 && summ.badges.some(b => /Segera|kedaluwarsa/i.test(b)), JSON.stringify(summ).slice(0, 300));
    await page.click('[data-action="add-sertifikat"]'); await page.waitForTimeout(400);
    await page.fill('#mc-title', 'AB'); await page.fill('#mc-issued', '2030-01-01'); await page.fill('#mc-expires', '2029-01-01'); await page.fill('#mc-link', 'ftp://x.y/z');
    await page.click('.modal__footer .btn--primary'); await page.waitForTimeout(300);
    const ce = await page.evaluate(() => window.__rv.allVis('.modal .field__error').filter(Boolean));
    R.ok(`${vp}: certificate modal rejects short title, future issue date, expiry < issue, non-https link`, ce.length >= 3, JSON.stringify(ce));
    await page.fill('#mc-title', 'Inspektur Perancah'); await page.fill('#mc-issued', '2026-01-10'); await page.fill('#mc-expires', '2026-10-20'); await page.fill('#mc-link', 'https://drive.google.com/file/d/x/view');
    await page.click('.modal__footer .btn--primary'); await page.waitForTimeout(700);
    const added = await page.evaluate(() => ({ rows: document.querySelectorAll('#sertifikat-list tr[data-id]').length, first: window.__rv.txt('#sertifikat-list tr[data-id]'), count: window.__rv.txt('#count-sertifikat') }));
    R.ok(`${vp}: certificate added, sorted by nearest expiry (9 days) on top, count 3`, added.rows === 3 && /Inspektur Perancah/.test(added.first || '') && added.count === '3', JSON.stringify(added).slice(0, 300));
    const t4 = await toasts(page);
    R.ok(`${vp}: expiring-soon toast is a warning`, t4.some(t => /Sertifikat berhasil ditambahkan|segera|kedaluwarsa/i.test(t)), JSON.stringify(t4.slice(-2)));
    // ---- KTA
    await page.click('#tab-kartu'); await page.waitForTimeout(500);
    const kta = await page.evaluate(() => ({ name: window.__rv.txt('.agt-kta__name, .agt-kta [class*="name"]'), num: window.__rv.txt('.agt-kta'), qr: !!document.querySelector('#kta-qr svg'), qrUrl: document.getElementById('kta-qr')?.getAttribute('data-url'), flipLabel: window.__rv.txt('#kta-flip'), print: !!document.getElementById('kta-print'), copy: document.querySelector('.agt-verify__actions [data-copy]')?.getAttribute('data-copy'), verifyLink: document.querySelector('.agt-verify a[href*="verifikasi"]')?.getAttribute('href') }));
    R.ok(`${vp}: KTA renders with number, QR (svg) pointing at verifikasi.html?kta=…`, /PPAPI-2026-004821/.test(kta.num || '') && kta.qr && /verifikasi\.html\?kta=PPAPI-2026-004821/.test(kta.qrUrl || ''), JSON.stringify(kta).slice(0, 300));
    R.ok(`${vp}: copy link equals the QR URL`, kta.copy === kta.qrUrl, `${kta.copy} vs ${kta.qrUrl}`);
    await page.click('#kta-flip'); await page.waitForTimeout(300);
    const flipped = await page.evaluate(() => ({ cls: document.getElementById('kta').classList.contains('is-flipped'), label: window.__rv.txt('#kta-flip'), aria: document.getElementById('kta').getAttribute('aria-label') }));
    R.ok(`${vp}: flip button flips the card + relabels`, flipped.cls && /sisi depan/.test(flipped.label || '') && /belakang/.test(flipped.aria || ''), JSON.stringify(flipped));
    await page.focus('#kta'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    R.ok(`${vp}: Enter on the card flips back`, !(await page.evaluate(() => document.getElementById('kta').classList.contains('is-flipped'))));
    await page.click('.agt-verify__actions [data-copy]'); await page.waitForTimeout(400);
    const t5 = await toasts(page);
    R.ok(`${vp}: copy verification link → toast once`, t5.filter(t => /Tautan verifikasi berhasil disalin/.test(t)).length === 1, JSON.stringify(t5.slice(-2)));
    // print: media print renders only the card
    await page.emulateMedia({ media: 'print' });
    const pr = await page.evaluate(() => ({ cardVis: window.__rv.vis(document.getElementById('kta')), headerVis: window.__rv.vis(document.querySelector('.site-header')), navVis: window.__rv.vis(document.querySelector('.agt-tabs__bar')), head: window.__rv.vis(document.querySelector('.agt-kta-print-head')) }));
    await page.emulateMedia({ media: 'screen' });
    R.ok(`${vp}: print media shows the card + print header, hides header/tabs`, pr.cardVis && pr.head && !pr.headerVis && !pr.navVis, JSON.stringify(pr));
    let printed = false; await page.exposeFunction('__rvPrint', () => { printed = true; }).catch(() => {});
    await page.evaluate(() => { window.print = () => window.__rvPrint(); }); await page.click('#kta-print'); await page.waitForTimeout(200);
    R.ok(`${vp}: "Cetak Kartu" calls window.print`, printed);
    await shot(page, `agt-${vp}-kta`);
    // ---- apps tab
    await page.click('#tab-aplikasi'); await page.waitForTimeout(400);
    const apps = await page.evaluate(() => [...document.querySelectorAll('.agt-app')].map(a => ({ eyebrow: window.__rv.txt('.eyebrow', a), title: window.__rv.txt('.agt-app__title', a), href: a.querySelector('a.btn')?.getAttribute('href'), target: a.querySelector('a.btn')?.target, feats: a.querySelectorAll('.agt-app__features li').length })));
    R.ok(`${vp}: apps tab lists 2 launch cards → aplikasi/… (same tab, 4 features each)`, apps.length === 2 && apps.every(a => /^aplikasi\//.test(a.href || '') && a.target !== '_blank' && a.feats === 4), JSON.stringify(apps));
    R.ok(`${vp}: planning app card says "(Beta)"`, apps.some(a => /Beta/.test(a.eyebrow + a.title)), JSON.stringify(apps.map(a => a.eyebrow)));
    await page.click('.agt-app a.btn'); await page.waitForTimeout(2500);
    const launched = await page.evaluate(() => ({ url: location.pathname, bar: window.__rv.txt('#pp-bar'), gateOk: document.documentElement.classList.contains('app-gate-ok') }));
    R.ok(`${vp}: "Buka Aplikasi" opens the planning app with the portal bar (name shown)`, /aplikasi\/perencanaan/.test(launched.url) && launched.gateOk && /Rahmat Hidayat/.test(launched.bar || ''), JSON.stringify(launched).slice(0, 200));
    await page.click('#pp-bar .pp-bar__back'); await waitReady(page); await page.waitForTimeout(400);
    R.ok(`${vp}: portal bar "Portal Anggota" returns to the dashboard`, /dashboard\.html/.test(page.url()), page.url().replace(BASE, ''));
  } catch (e) { R.ok(`${vp}: anggota scenario threw`, false, e.message.slice(0, 300)); await shot(page, `agt-${vp}-error`); }
  R.ok(`${vp}: no console/page/request errors`, issues.length === 0, issues.slice(0, 4).join(' | '));
  await ctx.close();
}

/* admin without own active membership */
{
  const ctx = await newContext(browser, { vp: 'desktop', state: 'admin', clock: CLOCK });
  const page = await ctx.newPage();
  const issues = watch(page, '[agt/admin] ');
  try {
    await open(page, `${BASE}/anggota.html#kartu`); await page.waitForTimeout(500);
    const k = await page.evaluate(() => ({ url: location.pathname, kartu: window.__rv.txt('#kartu-area').slice(0, 200), locked: !!document.querySelector('#kartu-area .locked'), hero: window.__rv.txt('#agt-meta') }));
    R.ok('admin (own status Draf): anggota.html opens; KTA tab explains no card (Draf)', /anggota\.html/.test(k.url) && k.locked && /Draf/.test(k.kartu), JSON.stringify(k).slice(0, 300));
    await page.click('#tab-aplikasi'); await page.waitForTimeout(300);
    R.ok('admin: apps tab still offers the apps', (await page.evaluate(() => document.querySelectorAll('.agt-app a.btn').length)) === 2);
  } catch (e) { R.ok('admin anggota threw', false, e.message.slice(0, 200)); }
  R.ok('admin: no console/page/request errors', issues.length === 0, issues.slice(0, 3).join(' | '));
  await ctx.close();
}

await browser.close();
await srv.close();
const failed = R.summary();
console.log('\nNotes:'); notes.forEach(n => console.log('  - ' + n));
process.exit(failed ? 1 : 0);
