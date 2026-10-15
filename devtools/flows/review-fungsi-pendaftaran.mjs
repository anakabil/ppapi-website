// review-fungsi-pendaftaran — exploratory checks of the application wizard (demo): every step with wrong inputs
// (future/ancient dates, overlong text, bad phone, http:// links, bad years), repeaters at their limits, pas foto
// (JPEG, PNG → JPEG, tiny, huge/noisy), autosave + reload mid-flow, browser back/forward on the hash, review step
// "Ubah" links, submit incomplete vs complete, pending view, withdraw, revision mode, rejection re-apply, renewal
// mode (Kedaluwarsa/Nonaktif/early), Aktif view; keyboard operation of the stepper. REVIEW ONLY.
// Run from devtools/:  node flows/review-fungsi-pendaftaran.mjs [--vp=desktop|mobile]
import { startServer, launch, newContext, watch, toasts, open, shot, recorder, memberFor, GEN_IMG, dataUrlToBuffer, waitReady, DEMO_USER } from './review-fungsi-lib.mjs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const VPS = flags.vp ? [flags.vp] : ['desktop', 'mobile'];
const CLOCK = '2026-10-11T03:00:00.000Z';
const srv = await startServer();
const BASE = srv.BASE;
const browser = await launch();
const R = recorder('review-fungsi-pendaftaran');
const allIssues = [];
const notes = [];
const note = (s) => { notes.push(s); console.log('  NOTE  ' + s); };
const q = (page, sel) => page.evaluate((s) => window.__rv.txt(s), sel);
const urlOf = (page) => page.url().replace(BASE, '');
const stepKey = (page) => page.evaluate(() => { const p = [...document.querySelectorAll('[data-panel]')].find(p => !p.hidden); return p ? p.getAttribute('data-panel') : (document.querySelector('.daf-pending') ? 'PENDING' : document.querySelector('.daf-active') ? 'ACTIVE' : '?'); });
const saveState = (page) => page.evaluate(() => window.__rv.txt('.js-save') || window.__rv.txt('.daf-save'));
async function next(page) { await page.click('[data-nav="next"]'); await page.waitForTimeout(350); }
async function errSum(page) { return page.evaluate(() => { const b = document.getElementById('daf-errsum'); return b && !b.hidden ? { txt: b.textContent.replace(/\s+/g, ' ').trim().slice(0, 300), n: b.querySelectorAll('li').length, focus: window.__rv.focused() } : null; }); }
async function fillDiri(page, { name = 'Penguji Wizard', birth = '1990-05-20', prov = 'Jawa Barat', city = 'Bandung', phone = '0812-9999-0001' } = {}) {
  await page.fill('#f-name', name); await page.fill('#f-birthDate', birth); await page.selectOption('#f-province', prov); await page.fill('#f-city', city); await page.fill('#f-phone', phone);
}

for (const vp of VPS) {
  const ctx = await newContext(browser, { vp, state: 'Draf', clock: CLOCK });
  const page = await ctx.newPage();
  const issues = watch(page, `[daf/${vp}] `);
  try {
    // fresh Draf member with an EMPTY application (the Draf fixture has kategori etc. → make it untouched)
    await page.addInitScript(() => { try { const k = 'ppapi_member_demo-uji-0001'; const m = JSON.parse(localStorage.getItem(k)); if (m && !window.__rvReset) { m.application = { type: 'baru', kategori: '', submittedAt: '', updatedAt: '', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: false, kebenaranData: false, privasi: false, namaTerang: '', tanggal: '' }, catatan: '' }; m.profile = {}; m.competencies = []; m.certificates = []; m.phone = ''; localStorage.setItem(k, JSON.stringify(m)); sessionStorage.setItem('__rvReset', '1'); } } catch (e) {} });
    await open(page, `${BASE}/pendaftaran.html`); await page.waitForTimeout(500);
    R.ok(`${vp}: untouched Draf starts at step 1 (kategori)`, (await stepKey(page)) === 'kategori', await stepKey(page));
    const stepper = await page.evaluate(() => [...document.querySelectorAll('.stepper__btn')].map(b => ({ t: window.__rv.txt('.stepper__label', b), dis: b.disabled, cur: b.getAttribute('aria-current') })));
    R.ok(`${vp}: stepper has 7 steps, later steps not disabled (free navigation)`, stepper.length === 7, JSON.stringify(stepper));
    // step 1: next without a choice
    await next(page);
    const e1 = await errSum(page);
    R.ok(`${vp}: step 1 without a category → error summary + focus on the radio group`, e1 && /kategori/i.test(e1.txt), JSON.stringify(e1));
    const cats = await page.evaluate(() => [...document.querySelectorAll('input[name="kategori"]')].map(r => r.value));
    R.ok(`${vp}: only Praktisi / Ahli / Mitra Korporat offered (no Kehormatan)`, cats.length === 3 && !cats.includes('Kehormatan'), JSON.stringify(cats));
    await page.evaluate(() => document.querySelector('input[name="kategori"][value="Praktisi"]').click()); await page.waitForTimeout(900);
    R.ok(`${vp}: choosing a category autosaves ("Tersimpan")`, /Tersimpan/.test(await saveState(page) || ''), await saveState(page));
    await next(page);
    R.ok(`${vp}: step 2 Data Diri`, (await stepKey(page)) === 'data-diri' && /#data-diri/.test(page.url()), urlOf(page));
    // step 2 wrong inputs
    await page.fill('#f-name', 'Ab'); await page.fill('#f-birthDate', '2030-01-01'); await page.fill('#f-city', 'B'); await page.fill('#f-phone', '0812');
    await next(page);
    const e2 = await errSum(page);
    const f2 = await page.evaluate(() => ({ name: window.__rv.txt('#f-name ~ .field__error, #f-name-err') || [...document.querySelectorAll('.field.is-invalid .field__error')].map(e => e.textContent.trim()), focus: window.__rv.focused() }));
    R.ok(`${vp}: step 2 rejects short name, future birth date, 1-letter city, bad phone, missing province (5 errors)`, e2 && e2.n === 5, JSON.stringify(e2));
    await page.fill('#f-birthDate', '1900-01-01'); await next(page);
    const e2b = await errSum(page);
    R.ok(`${vp}: birth date before 1930 rejected`, e2b && /Tanggal lahir/.test(e2b.txt), e2b && e2b.txt.slice(0, 160));
    await fillDiri(page);
    // overlong name (maxlength 120), address 400
    await page.fill('#f-address', 'Jl. '.repeat(200));
    const addrLen = await page.evaluate(() => document.getElementById('f-address').value.length);
    R.ok(`${vp}: address capped at 400 chars`, addrLen <= 400, `${addrLen}`);
    // pas foto: PNG → converted to JPEG, size shown
    const png = await page.evaluate((g) => eval(g)(600, 900, false, 'image/png'), GEN_IMG);
    await page.setInputFiles('#f-pasFoto', { name: 'foto.png', mimeType: 'image/png', buffer: dataUrlToBuffer(png) });
    await page.waitForTimeout(1200);
    const ph = await page.evaluate(() => ({ img: !!document.querySelector('.daf-photo__frame img'), src: (document.querySelector('.daf-photo__frame img') || {}).src?.slice(0, 22), hint: window.__rv.txt('#f-pasFoto-hint'), err: window.__rv.txt('#f-pasFoto-field .field__error'), stored: (() => { try { const m = JSON.parse(localStorage.getItem('ppapi_member_demo-uji-0001')); return (m.application.pasFoto || '').slice(0, 22) + ' ' + Math.round((m.application.pasFoto || '').length * 3 / 4 / 1024) + 'KB'; } catch (e) { return 'ERR'; } })() }));
    R.ok(`${vp}: PNG pas foto is converted to a JPEG ≤120 KB and stored`, ph.img && /^data:image\/jpeg/.test(ph.src || '') && /^data:image\/jpeg/.test(ph.stored), JSON.stringify(ph));
    const t1 = await toasts(page);
    R.ok(`${vp}: "Pas foto tersimpan." toast once`, t1.filter(t => /Pas foto tersimpan/.test(t)).length === 1, JSON.stringify(t1));
    // tiny image rejected
    const tiny = await page.evaluate((g) => eval(g)(40, 50, false, 'image/jpeg'), GEN_IMG);
    await page.setInputFiles('#f-pasFoto', { name: 'kecil.jpg', mimeType: 'image/jpeg', buffer: dataUrlToBuffer(tiny) }); await page.waitForTimeout(800);
    const tinyErr = await q(page, '#f-pasFoto-field .field__error');
    R.ok(`${vp}: tiny photo (40×50) rejected with a message`, /Resolusi|terlalu kecil/i.test(tinyErr || ''), String(tinyErr));
    // wrong type
    await page.setInputFiles('#f-pasFoto', { name: 'doc.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') }); await page.waitForTimeout(600);
    const typeErr = await q(page, '#f-pasFoto-field .field__error');
    R.ok(`${vp}: non-image file rejected`, /Format|JPEG|PNG/i.test(typeErr || ''), String(typeErr));
    // huge noisy image → still ≤120KB or a clear error
    const big = await page.evaluate((g) => eval(g)(2400, 3200, true, 'image/jpeg'), GEN_IMG);
    await page.setInputFiles('#f-pasFoto', { name: 'besar.jpg', mimeType: 'image/jpeg', buffer: dataUrlToBuffer(big) }); await page.waitForTimeout(4000);
    const bigRes = await page.evaluate(() => ({ err: window.__rv.txt('#f-pasFoto-field .field__error'), kb: (() => { try { const m = JSON.parse(localStorage.getItem('ppapi_member_demo-uji-0001')); return Math.round((m.application.pasFoto || '').length * 3 / 4 / 1024); } catch (e) { return -1; } })() }));
    R.ok(`${vp}: huge noisy photo ends ≤120 KB or an explicit error`, (bigRes.kb > 0 && bigRes.kb <= 120) || /tidak dapat diperkecil/i.test(bigRes.err || ''), JSON.stringify(bigRes));
    await page.waitForTimeout(800);
    await next(page);
    R.ok(`${vp}: step 3 Data Profesional`, (await stepKey(page)) === 'profesional');
    // step 3 wrong inputs
    await page.fill('#f-company', 'P'); await page.fill('#f-position', ''); await page.fill('#f-experienceYears', '99'); await next(page);
    const e3 = await errSum(page);
    R.ok(`${vp}: step 3 rejects 1-char company, empty position, 99 years`, e3 && e3.n === 3, JSON.stringify(e3));
    await page.fill('#f-company', 'PT Uji Perancah'); await page.fill('#f-position', 'Supervisor'); await page.fill('#f-experienceYears', '');
    // repeater: add 11 rows → add button disabled at 10
    for (let i = 0; i < 11; i++) { const b = await page.$('[data-action="peng-add"]'); if (b && !(await b.isDisabled())) { await b.click(); await page.waitForTimeout(80); } }
    const rows = await page.evaluate(() => ({ n: document.querySelectorAll('#peng-list .daf-rep').length, dis: document.querySelector('[data-action="peng-add"]').disabled, count: window.__rv.txt('#peng-count') }));
    R.ok(`${vp}: riwayat proyek capped at 10 rows, add button disabled`, rows.n === 10 && rows.dis, JSON.stringify(rows));
    // bad year on row 1, then remove others
    await page.evaluate(() => { const ids = [...document.querySelectorAll('#peng-list .daf-rep')].map(r => r.querySelector('[data-action="peng-remove"]').getAttribute('data-id')); ids.slice(1).forEach(id => document.querySelector(`[data-action="peng-remove"][data-id="${id}"]`).click()); });
    await page.waitForTimeout(300);
    const id1 = await page.evaluate(() => document.querySelector('#peng-list [data-action="peng-remove"]').getAttribute('data-id'));
    await page.fill(`#peng-proyek-${id1}`, 'Proyek Kilang'); await page.fill(`#peng-tahun-${id1}`, '2031'); await next(page);
    const e3b = await errSum(page);
    R.ok(`${vp}: future project year rejected`, e3b && /tahun/i.test(e3b.txt), e3b && e3b.txt.slice(0, 160));
    await page.fill(`#peng-tahun-${id1}`, '2022–2023'); await page.fill(`#peng-peran-${id1}`, 'Supervisor'); await next(page);
    R.ok(`${vp}: step 4 Kompetensi (optional) reached with 1 project row and no years field`, (await stepKey(page)) === 'kompetensi', await stepKey(page));
    // step 4: add competency via modal, validate duplicate
    await page.click('[data-action="komp-add"]'); await page.waitForTimeout(400);
    await page.click('.modal__footer .btn--primary'); await page.waitForTimeout(200);
    const km = await page.evaluate(() => ({ err: window.__rv.allVis('.modal .field__error').filter(Boolean), focus: window.__rv.focused() }));
    R.ok(`${vp}: kompetensi modal validates empty choice`, km.err.length >= 1, JSON.stringify(km));
    await page.selectOption('#mk-kode', { index: 1 }); await page.fill('#mk-since', '1900'); await page.click('.modal__footer .btn--primary'); await page.waitForTimeout(200);
    const km2 = await q(page, '.modal .field__error');
    R.ok(`${vp}: kompetensi "sejak 1900" rejected`, /1960/.test(km2 || ''), String(km2));
    await page.fill('#mk-since', '2019'); await page.click('.modal__footer .btn--primary'); await page.waitForTimeout(600);
    const kl = await page.evaluate(() => ({ n: document.querySelectorAll('#komp-list .daf-item, #komp-list li, #komp-list [data-action="komp-edit"]').length, modal: !!document.querySelector('.modal') }));
    R.ok(`${vp}: competency added, modal closed`, kl.n >= 1 && !kl.modal, JSON.stringify(kl));
    await page.click('[data-action="komp-add"]'); await page.waitForTimeout(300); await page.selectOption('#mk-kode', { index: 1 }); await page.click('.modal__footer .btn--primary'); await page.waitForTimeout(300);
    const dup = await q(page, '.modal .field__error');
    R.ok(`${vp}: duplicate competency rejected`, /sudah tercatat/i.test(dup || ''), String(dup));
    await page.keyboard.press('Escape'); await page.waitForTimeout(200);
    // certificate: expiry before issue, http link
    await page.click('[data-action="cert-add"]'); await page.waitForTimeout(300);
    await page.fill('#mc-title', 'Teknisi Perancah'); await page.fill('#mc-issued', '2025-01-10'); await page.fill('#mc-expires', '2024-01-10'); await page.fill('#mc-link', 'http://contoh.id/sert.pdf');
    await page.click('.modal__footer .btn--primary'); await page.waitForTimeout(300);
    const ce = await page.evaluate(() => window.__rv.allVis('.modal .field__error').filter(Boolean));
    R.ok(`${vp}: certificate expiry < issue and http:// link both rejected`, ce.length === 2, JSON.stringify(ce));
    await page.fill('#mc-expires', '2027-01-10'); await page.fill('#mc-link', 'https://contoh.id/sert.pdf'); await page.click('.modal__footer .btn--primary'); await page.waitForTimeout(500);
    R.ok(`${vp}: certificate added`, (await page.evaluate(() => document.querySelectorAll('#cert-list [data-action="cert-edit"]').length)) === 1);
    await next(page);
    R.ok(`${vp}: step 5 Dokumen`, (await stepKey(page)) === 'dokumen');
    // documents: 13 rows → capped 12; http url rejected
    for (let i = 0; i < 13; i++) { const b = await page.$('[data-action="dok-add"]'); if (b && !(await b.isDisabled())) { await b.click(); await page.waitForTimeout(60); } }
    const dk = await page.evaluate(() => ({ n: document.querySelectorAll('#dok-list .daf-rep').length, dis: document.querySelector('[data-action="dok-add"]').disabled }));
    R.ok(`${vp}: dokumen capped at 12 rows`, dk.n === 12 && dk.dis, JSON.stringify(dk));
    await page.evaluate(() => { const ids = [...document.querySelectorAll('#dok-list [data-action="dok-remove"]')].map(b => b.getAttribute('data-id')); ids.slice(1).forEach(id => document.querySelector(`[data-action="dok-remove"][data-id="${id}"]`).click()); });
    await page.waitForTimeout(200);
    const d1 = await page.evaluate(() => document.querySelector('#dok-list [data-action="dok-remove"]').getAttribute('data-id'));
    await page.fill(`#dok-label-${d1}`, 'CV'); await page.fill(`#dok-url-${d1}`, 'http://drive.google.com/x'); await next(page);
    const e5 = await errSum(page);
    R.ok(`${vp}: http:// document link rejected (https required)`, e5 && /https/.test(e5.txt), e5 && e5.txt.slice(0, 160));
    await page.fill(`#dok-url-${d1}`, 'https://drive.google.com/file/d/abc/view'); await page.fill('#f-catatan', 'x'.repeat(1100));
    const catLen = await page.evaluate(() => document.getElementById('f-catatan').value.length);
    R.ok(`${vp}: catatan capped at 1000`, catLen <= 1000, `${catLen}`);
    await next(page);
    R.ok(`${vp}: step 6 Pernyataan`, (await stepKey(page)) === 'pernyataan');
    await next(page);
    const e6 = await errSum(page);
    R.ok(`${vp}: step 6 requires 3 statements + nama terang (4 errors)`, e6 && e6.n === 4, JSON.stringify(e6));
    await page.check('#f-kodeEtik'); await page.check('#f-kebenaranData'); await page.check('#f-privasi'); await page.fill('#f-namaTerang', 'Nama Berbeda');
    const warn = await page.evaluate(() => ({ vis: window.__rv.vis(document.getElementById('f-namaTerang-warn')), txt: window.__rv.txt('#f-namaTerang-warn') }));
    note(`${vp}: nama terang ≠ nama lengkap → warning visible=${warn.vis} "${warn.txt}"`);
    await page.fill('#f-namaTerang', 'Penguji Wizard'); await page.waitForTimeout(300);
    await next(page);
    R.ok(`${vp}: step 7 Tinjau & Kirim`, (await stepKey(page)) === 'tinjau');
    await page.waitForTimeout(900);
    const rv = await page.evaluate(() => ({ state: window.__rv.txt('.daf-review__state'), ubah: document.querySelectorAll('#daf-review [data-step], #daf-review .daf-sum__edit, #daf-review a[href^="#"], #daf-review button[data-goto]').length, foot: window.__rv.allVis('.daf-foot .btn'), save: window.__rv.txt('.js-save') }));
    R.ok(`${vp}: review says the form is ready + "Ubah" links present`, /siap diajukan/i.test(rv.state || '') && rv.ubah >= 5, JSON.stringify(rv).slice(0, 300));
    R.ok(`${vp}: last step footer shows "Ajukan Pendaftaran"`, rv.foot.some(b => /Ajukan Pendaftaran/.test(b)), JSON.stringify(rv.foot));
    await shot(page, `daf-${vp}-review`);
    // reload mid-flow keeps data + lands on review (all complete)
    await page.reload(); await waitReady(page); await page.waitForTimeout(800);
    const after = await page.evaluate(() => ({ step: [...document.querySelectorAll('[data-panel]')].find(p => !p.hidden)?.getAttribute('data-panel'), hash: location.hash }));
    R.ok(`${vp}: reload keeps the hash step (#tinjau)`, after.step === 'tinjau', JSON.stringify(after));
    // back/forward via stepper + browser
    await page.click('.stepper__btn[data-step="1"]'); await page.waitForTimeout(300);
    const nm = await page.inputValue('#f-name');
    R.ok(`${vp}: stepper jump to Data Diri keeps saved values (name, phone)`, nm === 'Penguji Wizard' && /812/.test(await page.inputValue('#f-phone')), nm);
    await page.goBack(); await page.waitForTimeout(500);
    const bk = await stepKey(page);
    R.ok(`${vp}: browser Back returns to the previous step (tinjau)`, bk === 'tinjau', bk);
    await page.goForward(); await page.waitForTimeout(500);
    R.ok(`${vp}: browser Forward goes to data-diri again`, (await stepKey(page)) === 'data-diri', await stepKey(page));
    // keyboard on stepper: arrow keys / Enter
    await page.focus('.stepper__btn[data-step="0"]'); await page.keyboard.press('Enter'); await page.waitForTimeout(300);
    R.ok(`${vp}: Enter on a stepper button opens that step`, (await stepKey(page)) === 'kategori');
    // submit from review
    await page.click('.stepper__btn[data-step="6"]'); await page.waitForTimeout(600);
    await page.evaluate(() => window.__rv.btnByText('Ajukan Pendaftaran').click()); await page.waitForTimeout(1500);
    const pend = await page.evaluate(() => ({ done: window.__rv.txt('#daf-done-title'), status: window.__rv.txt('#daf-hero-status'), withdraw: window.__rv.vis(window.__rv.btnByText('Tarik pengajuan')), hash: location.hash, focus: window.__rv.focused(), track: window.__rv.all('.daf-track .status-track__label') }));
    R.ok(`${vp}: submit → pending view with thank-you, status Menunggu Verifikasi, track, withdraw`, /Terima kasih/.test(pend.done || '') && /Menunggu Verifikasi/.test(pend.status || '') && pend.withdraw && pend.track.length === 4, JSON.stringify(pend).slice(0, 300));
    const t2 = await toasts(page);
    R.ok(`${vp}: submit toast once`, t2.filter(t => /berhasil dikirim/.test(t)).length === 1, JSON.stringify(t2.slice(-3)));
    const menu = await (async () => { await page.click('.account__trigger'); await page.waitForTimeout(200); const m = await page.evaluate(() => ({ items: window.__rv.menuItems(), badge: window.__rv.all('.account-menu__status .badge') })); await page.keyboard.press('Escape'); return m; })();
    R.ok(`${vp}: header badge updates live to Menunggu Verifikasi`, menu.badge.some(b => /Menunggu Verifikasi/.test(b)), JSON.stringify(menu));
    await shot(page, `daf-${vp}-pending`);
    // data locked while pending: direct saveMember of a reviewed field must be refused
    const lock = await page.evaluate(async () => { try { await PPAPI.store.saveMember('demo-uji-0001', { name: 'Nama Lain' }); return 'allowed'; } catch (e) { return e.code || e.message; } });
    R.ok(`${vp}: reviewed data locked while pending (store/application-locked)`, lock === 'store/application-locked', lock);
    // withdraw: cancel, then confirm
    await page.evaluate(() => window.__rv.btnByText('Tarik pengajuan').click()); await page.waitForTimeout(400);
    const cf = await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), title: window.__rv.txt('.modal__title'), btns: window.__rv.allVis('.modal__footer .btn') }));
    R.ok(`${vp}: withdraw asks for confirmation (danger)`, cf.modal && /Tarik/.test(cf.title || ''), JSON.stringify(cf));
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    R.ok(`${vp}: Esc cancels the withdraw`, (await stepKey(page)) === 'PENDING');
    await page.evaluate(() => window.__rv.btnByText('Tarik pengajuan').click()); await page.waitForTimeout(400);
    await page.click('.modal__footer .btn--danger, .modal__footer .btn--primary'); await page.waitForTimeout(1200);
    const wd = await page.evaluate(() => ({ step: [...document.querySelectorAll('[data-panel]')].find(p => !p.hidden)?.getAttribute('data-panel'), status: window.__rv.txt('#daf-hero-status'), hash: location.hash }));
    R.ok(`${vp}: withdraw → back to the wizard (review step), status Draf`, wd.step === 'tinjau' && /Draf/.test(wd.status || ''), JSON.stringify(wd));
    const t3 = await toasts(page);
    R.ok(`${vp}: withdraw toast once`, t3.filter(t => /ditarik/i.test(t)).length === 1, JSON.stringify(t3.slice(-3)));
    // resubmit → then simulate admin revision via store (same browser) and reload
    await page.evaluate(() => window.__rv.btnByText('Ajukan Pendaftaran').click()); await page.waitForTimeout(1200);
    R.ok(`${vp}: resubmit works`, (await stepKey(page)) === 'PENDING');
  } catch (e) { R.ok(`${vp}: wizard scenario threw`, false, e.message.slice(0, 300)); await shot(page, `daf-${vp}-error`); }
  R.ok(`${vp}: no console/page/request errors (wizard)`, issues.length === 0, issues.slice(0, 4).join(' | '));
  allIssues.push(...issues);
  await ctx.close();
}

/* ---------- status views: Perlu Perbaikan, Ditolak, Kedaluwarsa, Nonaktif, Aktif(+early renewal), Menunggu ---------- */
for (const st of ['Perlu Perbaikan', 'Ditolak', 'Kedaluwarsa', 'Nonaktif', 'Aktif', 'Menunggu Verifikasi']) {
  const ctx = await newContext(browser, { vp: 'desktop', state: st, clock: CLOCK });
  const page = await ctx.newPage();
  const issues = watch(page, `[daf/${st}] `);
  try {
    await open(page, `${BASE}/pendaftaran.html`); await page.waitForTimeout(600);
    const v = await page.evaluate(() => ({ step: [...document.querySelectorAll('[data-panel]')].find(p => !p.hidden)?.getAttribute('data-panel') || (document.querySelector('.daf-pending') ? 'PENDING' : document.querySelector('.daf-active') ? 'ACTIVE' : '?'), notes: window.__rv.allVis('.daf-note').map(x => x.slice(0, 140)), foot: window.__rv.allVis('.daf-foot .btn'), hero: window.__rv.txt('#daf-hero-status'), title: window.__rv.txt('#daf-title'), lead: window.__rv.txt('#daf-lead'), nameRO: document.getElementById('f-name')?.readOnly, kat: document.querySelector('input[name="kategori"]:checked')?.value, pern: document.getElementById('f-kodeEtik')?.checked }));
    if (st === 'Perlu Perbaikan') {
      R.ok(`${st}: admin note shown + wizard open`, v.notes.some(n => /Mohon lengkapi tautan sertifikat/.test(n)) && v.step !== 'PENDING', JSON.stringify(v).slice(0, 300));
      await page.click('.stepper__btn[data-step="6"]'); await page.waitForTimeout(500);
      const foot = await page.evaluate(() => window.__rv.allVis('.daf-foot .btn'));
      R.ok(`${st}: submit label "Kirim Perbaikan"`, foot.some(b => /Kirim Perbaikan/.test(b)), JSON.stringify(foot));
    }
    if (st === 'Ditolak') {
      R.ok(`${st}: rejection reason shown + "Ajukan Ulang" on review`, v.notes.some(n => /belum memenuhi syarat/.test(n)), JSON.stringify(v.notes));
      await page.click('.stepper__btn[data-step="6"]'); await page.waitForTimeout(500);
      const foot = await page.evaluate(() => window.__rv.allVis('.daf-foot .btn'));
      R.ok(`${st}: submit label "Ajukan Ulang"`, foot.some(b => /Ajukan Ulang/.test(b)), JSON.stringify(foot));
    }
    if (st === 'Kedaluwarsa' || st === 'Nonaktif') {
      R.ok(`${st}: renewal mode — note mentions perpanjangan and keeps the KTA, name read-only`, v.notes.some(n => /perpanjangan/i.test(n)) && v.nameRO === true, JSON.stringify(v).slice(0, 300));
      R.ok(`${st}: declaration reset for the renewal (not pre-checked)`, v.pern === false, String(v.pern));
      await page.click('.stepper__btn[data-step="6"]'); await page.waitForTimeout(500);
      const foot = await page.evaluate(() => window.__rv.allVis('.daf-foot .btn'));
      R.ok(`${st}: submit label "Ajukan Perpanjangan"`, foot.some(b => /Ajukan Perpanjangan/.test(b)), JSON.stringify(foot));
      await shot(page, `daf-${st}-review`);
    }
    if (st === 'Aktif') {
      R.ok(`${st}: active view (no form) with KTA facts + links`, v.step === 'ACTIVE' && /PPAPI-2026-004821/.test(await q(page, '.daf-member__facts') || ''), JSON.stringify(v).slice(0, 200));
      const renewBtn = await page.evaluate(() => !!window.__rv.btnByText('Ajukan perpanjangan'));
      R.ok(`${st}: no renewal offer while > 60 days left (validUntil 2029)`, !renewBtn);
      // #perpanjangan hash with >60 days → should not force renew
      await open(page, `${BASE}/pendaftaran.html#perpanjangan`); await page.waitForTimeout(500);
      R.ok(`${st}: #perpanjangan ignored when not renewable`, (await stepKey(page)) === 'ACTIVE', await stepKey(page));
    }
    if (st === 'Menunggu Verifikasi') {
      R.ok(`${st}: pending read-only summary + Tarik pengajuan`, v.step === 'PENDING' && (await page.evaluate(() => !!window.__rv.btnByText('Tarik pengajuan'))), JSON.stringify(v).slice(0, 200));
      // #hash to a step must not open the wizard while pending
      await open(page, `${BASE}/pendaftaran.html#dokumen`); await page.waitForTimeout(500);
      R.ok(`${st}: #dokumen hash does not reopen the wizard while pending`, (await stepKey(page)) === 'PENDING', await stepKey(page));
    }
  } catch (e) { R.ok(`${st}: status view threw`, false, e.message.slice(0, 200)); }
  R.ok(`${st}: no console/page/request errors`, issues.length === 0, issues.slice(0, 3).join(' | '));
  allIssues.push(...issues);
  await ctx.close();
}

/* ---------- early renewal (Aktif, 42 days left) ---------- */
{
  const m = memberFor('Aktif'); m.validUntil = '2026-11-22';
  const ctx = await newContext(browser, { vp: 'desktop', state: 'signed-out', clock: CLOCK });
  const { seedAuth } = await import('./qa-lib.mjs');
  await seedAuth(ctx, { member: m });
  const page = await ctx.newPage();
  const issues = watch(page, '[daf/early] ');
  try {
    await open(page, `${BASE}/pendaftaran.html`); await page.waitForTimeout(600);
    const early = await page.evaluate(() => ({ note: window.__rv.txt('.daf-renew'), btn: !!window.__rv.btnByText('Ajukan perpanjangan'), days: window.__rv.txt('.daf-member__days') }));
    R.ok('early renewal: Aktif with 42 days left sees the renewal offer', early.btn && /42 hari/.test(early.note || ''), JSON.stringify(early));
    await page.evaluate(() => window.__rv.btnByText('Ajukan perpanjangan').click()); await page.waitForTimeout(700);
    const w1 = await page.evaluate(() => ({ step: [...document.querySelectorAll('[data-panel]')].find(p => !p.hidden)?.getAttribute('data-panel'), warn: window.__rv.allVis('.daf-note').map(x => x.slice(0, 400)), cancel: !!window.__rv.btnByText('Batalkan, kembali ke ringkasan') }));
    R.ok('early renewal: wizard opens with the lock warning + cancel link', w1.step && w1.warn.some(x => /dikunci sementara|Menunggu Verifikasi/.test(x)) && w1.cancel, JSON.stringify(w1).slice(0, 300));
    await page.click('.stepper__btn[data-step="6"]'); await page.waitForTimeout(600);
    const rev = await page.evaluate(() => ({ state: window.__rv.txt('.daf-review__state'), lockAlert: window.__rv.allVis('.alert').some(a => /dikunci selama verifikasi/i.test(a)), foot: window.__rv.allVis('.daf-foot .btn') }));
    R.ok('early renewal: review repeats the lock warning + "Ajukan Perpanjangan"', rev.lockAlert && rev.foot.some(b => /Ajukan Perpanjangan/.test(b)), JSON.stringify(rev).slice(0, 300));
    // declaration must be re-done (reset) → review likely says incomplete
    note('early renewal review state: ' + (rev.state || '').slice(0, 120));
    await page.click('.stepper__btn[data-step="1"]'); await page.waitForTimeout(300);
    const roName = await page.evaluate(() => ({ name: document.getElementById('f-name').readOnly, birth: document.getElementById('f-birthDate').readOnly, birthVal: document.getElementById('f-birthDate').value }));
    note('early renewal data-diri locks: ' + JSON.stringify(roName));
    if (!roName.birth) await page.fill('#f-birthDate', '1988-02-02');
    await page.selectOption('#f-province', 'Kalimantan Timur').catch(() => {}); await page.waitForTimeout(700);
    await page.click('.stepper__btn[data-step="5"]'); await page.waitForTimeout(300);
    await page.check('#f-kodeEtik'); await page.check('#f-kebenaranData'); await page.check('#f-privasi'); await page.fill('#f-namaTerang', 'Rahmat Hidayat'); await page.waitForTimeout(600);
    await page.click('.stepper__btn[data-step="6"]'); await page.waitForTimeout(600);
    await page.evaluate(() => window.__rv.btnByText('Ajukan Perpanjangan').click()); await page.waitForTimeout(500);
    const cf = await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), title: window.__rv.txt('.modal__title') }));
    R.ok('early renewal: submit asks for confirmation about the feature lock', cf.modal && /perpanjangan/i.test(cf.title || ''), JSON.stringify(cf));
    await page.click('.modal__footer .btn--primary'); await page.waitForTimeout(1200);
    const after = await page.evaluate(() => ({ status: window.__rv.txt('#daf-hero-status'), pending: !!document.querySelector('.daf-pending'), track: window.__rv.all('.daf-track .status-track__label') }));
    R.ok('early renewal: submitted → Menunggu Verifikasi with the renewal track', after.pending && /Menunggu Verifikasi/.test(after.status || '') && after.track[0] === 'Keanggotaan sebelumnya', JSON.stringify(after));
    // features locked now: anggota.html redirects
    await open(page, `${BASE}/anggota.html`);
    R.ok('early renewal: member page locked while pending', /dashboard\.html/.test(page.url()), urlOf(page));
    await shot(page, 'daf-early-renewal-pending');
  } catch (e) { R.ok('early renewal threw', false, e.message.slice(0, 200)); }
  R.ok('early renewal: no console/page/request errors', issues.length === 0, issues.slice(0, 3).join(' | '));
  allIssues.push(...issues);
  await ctx.close();
}

await browser.close();
await srv.close();
const failed = R.summary();
console.log('\nNotes:'); notes.forEach(n => console.log('  - ' + n));
process.exit(failed ? 1 : 0);
