// aplikasi-perencanaan-temuan — regresi atas TEMUAN TINJAUAN INDEPENDEN (9 Oktober 2026) untuk PPAPI Scaffold v2.4.0 (Beta).
// Setiap bagian mereproduksi skenario temuan (devtools/flows/verify-eng-perencanaan.mjs, bagian B2–B8) dan memeriksa
// bahwa perilaku kini benar. Nilai harapan berasal dari modul acuan independen aplikasi-perencanaan-ref.mjs; hasil aplikasi
// dibaca dari TEKS LAYAR bila memungkinkan. Rincian: site/aplikasi/KOREKSI-PERHITUNGAN.md §19.
// usage (cwd devtools): node flows/aplikasi-perencanaan-temuan.mjs [--no-net]   (--no-net: lewati PDF, SRI-CDN & axe)
import fs from 'node:fs';
import { startServer, launch, newContext, seedSession, watch, recorder, shot, DEMO_USER } from './aplikasi-lib.mjs';
import * as REF from './aplikasi-perencanaan-ref.mjs';

const NET = !process.argv.includes('--no-net');
const T = recorder('aplikasi-perencanaan-temuan');
const { server, BASE } = await startServer();
const browser = await launch();
const PR = `${BASE}/aplikasi/perencanaan/index.html`;
const KEY = 'ppapi_app_perencanaan_v1_u_' + DEMO_USER.uid;
const nfi = (v, d = 0) => Number(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const txt = (page, sel) => page.$eval(sel, el => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
const noIssues = (label, issues) => T.ok(issues.length === 0, `${label}: no console errors / page errors / failed requests`, issues.slice(0, 4));
const seedOnce = (a) => { if (!sessionStorage.getItem('__seed')) { sessionStorage.setItem('__seed', '1'); localStorage.setItem(a.key, JSON.stringify(a.d)); } };
async function open(vp = 'desktop', seed, extra) {
  const ctx = await newContext(browser, vp, extra);
  await seedSession(ctx, {});
  if (seed) await ctx.addInitScript(seedOnce, { key: KEY, d: seed });
  const page = await ctx.newPage();
  const issues = watch(page);
  const reqs = [];
  page.on('request', r => reqs.push(r.url()));
  await page.goto(PR, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'), null, { timeout: 30000 });
  return { ctx, page, issues, reqs };
}
const setF = (page, o) => page.evaluate((o) => { for (const [id, v] of Object.entries(o)) { const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } }, o);
const goV = (page, v) => page.evaluate(v => go(v), v);
const checks = (page) => page.evaluate(() => analisisData().checks.map(c => ({ g: c.g, ok: c.ok, info: !!c.info, key: c.key || '', t: c.t })));
/* 8 komponen material bawaan v2.2.0 (devtools: git show 7f828ba:aplikasi/perencanaan/app.js baris 114) */
const MAT_V22 = [['Standard / tiang (3 m)', 6, 12], ['Ledger (2,5 m)', 8, 10], ['Transom (1,2 m)', 6, 5], ['Bracing (±3 m)', 4, 12], ['Coupler / klem', 40, 1.2], ['Base plate / jack base', 6, 2.5], ['Papan / plank', 5, 16], ['Toe board', 4, 5]].map(r => ({ n: r[0], q: r[1], w: r[2] }));
const v22Record = (model, extraVals = {}, mats = MAT_V22, fields = {}) => ({ v: 2, answers: {},
  fields: { 'f-proyek': 'Proyek v2.2', 'f-nbay': '3', 'f-lbay': '2.4', 'f-lebar': '1.2', 'f-hlift': '2.0', 'f-lift': '4', 'f-model': model, ...fields },
  analisis: { vals: { 'an-kelas': '4.4', 'an-bay': '3', 'an-lantai': '1', 'an-fk': '1.5', 'an-tiang': '6', 'an-kaptiang': '2500', 'an-nrope': '2', 'an-ftali': '6', 'an-mbl': '60', 'an-klemcls': '6.3', 'an-nklem': '8', 'll-sf': '1.5', ...extraVals }, mats }, ts: 1 });
const ME = REF.materialEstimate(REF.REF), TS = REF.totals(REF.REF, 'suspended');
/* rekaman v2.2.0 asli tidak menyimpan jenis pipa → v2.4.0 menghitungnya sebagai 48,3 × 3,2 (F16) */
const REF32 = { ...REF.REF, t: 3.2 }, ME32 = REF.materialEstimate(REF32), TS32 = REF.totals(REF32, 'suspended');

/* ======================================================================
   F1. jsPDF dimuat dengan Subresource Integrity (satu origin dengan portal)
   ====================================================================== */
T.section('F1 jsPDF loaded with SRI, crossorigin and no referrer');
{
  const src = fs.readFileSync(new URL('../../site/aplikasi/perencanaan/app.js', import.meta.url), 'utf8');
  T.ok(/s\.integrity=JSPDF_SRI/.test(src) && /JSPDF_SRI='sha512-qZvrmS2ekKPF2mSznTQsxqPgnpkI4DNTlrdUmTzrDgektczlKNRRhy5X5AAOnx5S09ydFYWWNSfcEqDTTHgtNA=='/.test(src) && /s\.crossOrigin='anonymous'/.test(src) && /s\.referrerPolicy='no-referrer'/.test(src), 'ensureJsPDF sets integrity (sha512 of jspdf.umd.min.js 2.5.1), crossOrigin and referrerPolicy');
  if (NET) {
    const { ctx, page, issues } = await open('desktop');
    await page.evaluate(() => { go('checklist'); bulk('ok'); go('laporan'); });
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#v-laporan [data-pdf-btn]')]);
    const tag = await page.evaluate(() => { const s = [...document.scripts].find(x => /jspdf/.test(x.src)); return s && { i: s.integrity, c: s.crossOrigin, r: s.referrerPolicy }; });
    T.ok(!!dl && tag && /^sha512-/.test(tag.i) && tag.c === 'anonymous' && tag.r === 'no-referrer', 'PDF still builds: the cdnjs file matches the pinned hash', tag);
    const pdfPath = await dl.path();
    T.ok(fs.statSync(pdfPath).size > 20000, `PDF downloaded (${Math.round(fs.statSync(pdfPath).size / 1024)} KB)`);
    noIssues('F1 genuine CDN file', issues);
    await ctx.close();
    // berkas CDN yang diubah → ditolak peramban, pesan galat jelas, tanpa eksekusi
    const o = await open('desktop');
    await o.page.route('**/jspdf.umd.min.js', route => route.fulfill({ status: 200, contentType: 'text/javascript', headers: { 'access-control-allow-origin': '*' }, body: 'window.__tampered=1;window.jspdf={jsPDF:function(){}};' }));
    await o.page.evaluate(() => { go('laporan'); });
    await o.page.click('#v-laporan [data-pdf-btn]');
    await o.page.waitForTimeout(1500);
    const t = await o.page.evaluate(() => ({ exec: window.__tampered, toast: (document.querySelector('.toast-region') || {}).textContent || '' }));
    T.ok(t.exec === undefined && /Pustaka PDF tidak dapat dimuat/.test(t.toast), 'tampered CDN response is blocked by SRI (not executed) and the user sees the load-error message', t);
    await o.ctx.close();
  }
}

/* ======================================================================
   F2–F4. Integrasi portal: chrome ringkas, logo WebP, tombol simulator dalam landmark
   ====================================================================== */
T.section('F2 portal chrome ≤ 110 px desktop / ≤ 100 px phone, one identity, monochrome demo chip');
for (const vp of ['desktop', 'mobile']) {
  const { ctx, page, issues, reqs } = await open(vp);
  await page.evaluate(() => save());
  const g = await page.evaluate(() => {
    const hd = document.querySelector('body > header'), hi = document.querySelector('header .head-in'), h1 = document.querySelector('header h1');
    const st = getComputedStyle(hi), nav = document.querySelector('header nav');
    const demo = document.querySelector('.pp-bar__demo'), hz = document.querySelectorAll('.hazard').length, nv = document.querySelector('header nav');
    return { bottom: Math.round(hd.getBoundingClientRect().bottom), headInVisible: hi.getBoundingClientRect().width > 2 && st.clip !== 'rect(0px, 0px, 0px, 0px)', h1: h1 && h1.textContent.trim(),
      savedInNav: nav.contains(document.getElementById('saved-ind')), chipInNav: nav.contains(document.getElementById('head-verdict')), saved: document.getElementById('saved-ind').textContent,
      demoColor: demo && getComputedStyle(demo).color, hz, navBg: getComputedStyle(nv).backgroundColor, navLine: getComputedStyle(nv).borderBottomColor, navLabel: nav.getAttribute('aria-label'), sw: document.documentElement.scrollWidth - innerWidth,
      gateLogo: document.querySelector('#app-gate img').getAttribute('src') };
  });
  const lim = vp === 'desktop' ? 110 : 100;
  T.ok(g.bottom <= lim, `${vp}: portal bar + menu band end at ${g.bottom} px (≤ ${lim})`, g);
  T.ok(!g.headInVisible && /PPAPI Scaffold/.test(g.h1), `${vp}: app brand row hidden under the portal (title only in the portal bar), h1 kept for screen readers`);
  T.ok(g.savedInNav && g.chipInNav && /^Tersimpan \d{2}\.\d{2}$/.test(g.saved) && g.navLabel === 'Tahap aplikasi', `${vp}: "Tersimpan HH.MM" and checklist status sit in the menu band`, g.saved);
  T.ok(g.demoColor === 'rgb(185, 185, 191)' && g.hz === 0 && g.navBg === 'rgb(17, 17, 19)' && g.navLine === 'rgba(255, 255, 255, 0.1)', `${vp}: demo chip silver; no hazard stripe — ink menu band with a hairline bottom rule (retheme Oktober 2026)`, { demo: g.demoColor, hz: g.hz, navBg: g.navBg, navLine: g.navLine });
  T.ok(g.sw <= 1, `${vp}: no horizontal overflow`, g.sw);
  T.ok(/logo-light-mark\.webp$/.test(g.gateLogo) && !reqs.some(u => /logo-light\.png/.test(u)), `${vp}: gate logo is the 13 KB WebP; logo-light.png (132 KB) is not requested`, reqs.filter(u => /logo/.test(u)));
  await shot(page, `temuan-f2-chrome-${vp}`, { clip: { x: 0, y: 0, width: vp === 'desktop' ? 1440 : 390, height: vp === 'desktop' ? 220 : 280 } });
  noIssues(`F2 ${vp}`, issues);
  await ctx.close();
}
{
  const src = fs.readFileSync(new URL('../../site/aplikasi/gate.js', import.meta.url), 'utf8');
  T.ok(/logo-light-mark\.webp/.test(src) && !/logo-light\.png/.test(src), 'F3: gate.js error screen uses logo-light-mark.webp');
}
T.section('F4 floating "Simulator 3D" button inside a labelled landmark');
{
  const { ctx, page } = await open('desktop');
  const lm = await page.evaluate(() => { const a = document.querySelector('.fab'); const w = a.closest('aside,nav,main'); return w && { tag: w.tagName, label: w.getAttribute('aria-label'), fixed: getComputedStyle(a).position === 'fixed' ? 'fixed' : getComputedStyle(w).position }; });   // retheme: the <aside> wrapper is the fixed element
  T.ok(lm && lm.tag === 'ASIDE' && lm.label === 'Pintasan aplikasi' && lm.fixed === 'fixed', '.fab is inside <aside aria-label="Pintasan aplikasi"> (fixed)', lm);
  if (NET) {
    await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
    const r = await page.evaluate(async () => (await axe.run(document, { runOnly: ['region', 'landmark-unique', 'landmark-complementary-is-top-level'] })).violations.map(v => ({ id: v.id, n: v.nodes.map(x => x.target.join(' ')) })));
    T.ok(r.length === 0, 'axe region / landmark rules: 0 violations (the .fab "region" finding is gone)', r);
  }
  await ctx.close();
}

/* ======================================================================
   F5. Data v2.2.0 dengan 8 komponen material bawaan (393 kg)
   ====================================================================== */
T.section('F5 v2.2.0 data with the 393 kg default material list (suspended / mobile)');
{
  const { ctx, page, issues } = await open('desktop', v22Record('suspended'));
  const st = await page.evaluate(() => ({ rows: matRows.length, kg: matRows.reduce((a, r) => a + r.q * r.w, 0), meta: matMeta, toast: (document.querySelector('.toast-region') || {}).textContent || '' }));
  T.ok(st.rows === ME32.rows && Math.abs(st.kg - ME32.Wd) < 0.05 && st.meta.src === 'auto', `the 8 legacy default rows are replaced by the geometry estimate (${ME32.rows} components, ${nfi(ME32.Wd)} kg)`, st);
  T.ok(/bawaan versi 2\.2\.0/.test(st.toast), 'a notice explains the replacement', st.toast.slice(0, 160));
  await goV(page, 'analisis');
  const cap = await txt(page, '#fx-cap');
  const Texp = TS32.total / 2;
  T.ok(cap.includes('Tarik per tali ' + nfi(Texp) + ' kg (' + nfi(Texp * REF.g / 1000, 2) + ' kN)') && /TALI TIDAK MEMENUHI/.test(cap), `suspended, 2 ropes: T = (${nfi(ME32.Wd)} + ${nfi(TS32.live)})/2 = ${nfi(Texp)} kg (${nfi(Texp * REF.g / 1000, 2)} kN) > 10 kN → TALI TIDAK MEMENUHI (was 869,5 kg / MEMENUHI)`, cap.slice(0, 220));
  await setF(page, { 'f-model': 'mobile' });
  await goV(page, 'analisis');
  const capM = await txt(page, '#fx-cap');
  T.ok(capM.includes('Beban per castor ' + nfi(TS32.total / 4) + ' kg') && /CASTOR TIDAK MEMENUHI/.test(capM), `mobile, 4 castors: ${nfi(TS32.total / 4)} kg > WLL 500 → CASTOR TIDAK MEMENUHI (was 435 kg / MEMENUHI)`, capM.slice(0, 160));
  noIssues('F5 default list', issues);
  await ctx.close();
}
{
  // rincian v2.2.0 yang DISUNTING pengguna (bukan bawaan): dipertahankan, ditandai CEK, beban mati tidak di bawah estimasi geometri
  const edited = [{ n: 'Standard / tiang (3 m)', q: 6, w: 12 }, { n: 'Ledger (2,5 m)', q: 8, w: 10 }, { n: 'Papan', q: 5, w: 16 }];
  const { ctx, page } = await open('desktop', v22Record('suspended', {}, edited));
  await goV(page, 'material');
  const note = await txt(page, '#mat-note');
  const A = await page.evaluate(() => { const A = analisisData(); return { dead: A.dead, used: A.deadUsed, est: A.deadEst, ok: A.ok, T: A.X.Tkg }; });
  const ch = (await checks(page)).find(c => c.key === 'mat');
  T.ok(/data versi sebelumnya/.test(note) && ch && !ch.ok, 'user-edited legacy rows are kept but flagged CEK ("Rincian material … data versi sebelumnya")', { note: note.slice(0, 120), ch });
  T.ok(Math.abs(A.dead - 232) < 0.01 && Math.abs(A.used - ME32.Wd) < 0.05 && Math.abs(A.T - (ME32.Wd + TS32.live) / 2) < 0.05, `dead load used for the rope = max(232 kg list, ${nfi(ME32.Wd)} kg estimate)`, A);
  await page.click('#mat-note button:has-text("Rincian ini sudah sesuai")');
  const ch2 = (await checks(page)).find(c => c.key === 'mat');
  T.ok(ch2 && ch2.ok && /dikonfirmasi/.test(ch2.t), 'confirming the rows clears the CEK (max() rule still applies)', ch2);
  await ctx.close();
}
{
  // rekaman v2.2.0 yang jenis pipanya sudah dipilih 4,0 mm: estimasi geometri pipa 4,0
  const { ctx, page } = await open('desktop', v22Record('suspended', {}, MAT_V22, { 'f-pipa': '4.0' }));
  await goV(page, 'analisis');
  const cap = await txt(page, '#fx-cap'), Texp = TS.total / 2;
  T.ok(cap.includes('Tarik per tali ' + nfi(Texp) + ' kg (' + nfi(Texp * REF.g / 1000, 2) + ' kN)') && /TALI TIDAK MEMENUHI/.test(cap), `same record with tube 48,3 × 4,0: T = (${nfi(ME.Wd)} + ${nfi(TS.live)})/2 = ${nfi(Texp)} kg (${nfi(Texp * REF.g / 1000, 2)} kN) → CEK`, cap.slice(0, 200));
  await ctx.close();
}
{
  // arsip proyek (openProject) dan impor .json lama juga dimigrasi
  const { ctx, page } = await open('desktop');
  const rec = v22Record('suspended');
  await page.evaluate((rec) => { const list = [{ id: 7, name: 'Arsip v2.2', tag: 'A1', status: 'BELUM LENGKAP', fields: rec.fields, answers: {}, analisis: rec.analisis, ts: 1 }]; localStorage.setItem(projStoreKey(CURRENT_USER), JSON.stringify(list)); openProject(7); }, rec);
  let st = await page.evaluate(() => ({ rows: matRows.length, src: matMeta.src }));
  T.ok(st.rows === ME.rows && st.src === 'auto', 'archived v2.2.0 project (openProject) → default rows replaced', st);
  await page.evaluate(() => { matRows = [{ n: 'x', q: 1, w: 1 }]; matMeta = { src: 'user', geom: '' }; go('laporan'); });
  await page.setInputFiles('#imp', { name: 'lama.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ v: 1, ...rec })) });
  await page.waitForTimeout(400);
  st = await page.evaluate(() => ({ rows: matRows.length, src: matMeta.src }));
  T.ok(st.rows === ME.rows && st.src === 'auto', 'imported v2.2.0 .json → default rows replaced', st);
  await ctx.close();
}

/* ======================================================================
   F6. Lentur transom & ledger
   ====================================================================== */
T.section('F6 transom and ledger bending (finding B2: LOLOS on overstressed transoms)');
{
  const { ctx, page, issues } = await open('desktop');
  const c = { nb: 3, L: 2.4, B: 1.5, h: 2.0, nl: 2, nbd: 1, nwork: 1, t: 4.0, qkN: 6.6, FkN: 2.0 };
  await setF(page, { 'f-nbay': 3, 'f-lbay': 2.4, 'f-lebar': 1.5, 'f-hlift': 2.0, 'f-lift': 2, 'f-tinggi': '', 'f-papan': 1, 'f-pipa': '4.0', 'an-kelas': '6.6', 'an-lantai': 1, 'an-ptpapan': '2.0', 'an-plate': '0.1' });
  await goV(page, 'analisis');
  const verdict = await txt(page, '#an-verdict'), bend = await txt(page, '#fx-bend');
  const R = REF.memberBendingRef(c);
  T.ok(!/LOLOS/.test(verdict) && /PERLU REVIEW/.test(verdict), 'Heavy, width 1,5 m, 48,3 × 4,0, 2 lifts: no longer "LOLOS PEMERIKSAAN INDIKATIF"', verdict.slice(0, 60));
  T.ok(bend.includes('M = ' + nfi(R.tr.M, 2) + ' kNm') && bend.includes(nfi(R.tr.Mcap, 2) + ' kNm') && /TRANSOM TIDAK MEMENUHI/.test(bend), `transom M ${nfi(R.tr.M, 2)} kNm > ${nfi(R.tr.Mcap, 2)} kNm (ratio ${nfi(R.tr.ratio, 2)}; UDL only ${nfi(R.tr.Mudl, 2)} kNm = finding's 1,38)`, bend.slice(0, 300));
  T.ok(Math.abs(R.tr.Mudl - 1.387) < 0.005 && Math.abs(R.tr.Mcap - 1.121) < 0.001, 'reference: UDL-only moment 1,387 kNm (finding: (673 + 74,9) kg × g × 1,5/8 = 1,375 kNm + self weight 0,012)');
  // pipa 3,2 & lebar 1,2
  await setF(page, { 'f-pipa': '3.2', 'f-lebar': 1.2 });
  const R2 = REF.memberBendingRef({ ...c, B: 1.2, t: 3.2 });
  const t2 = (await checks(page)).find(x => /Lentur transom/.test(x.t));
  T.ok(t2 && !t2.ok && t2.t.includes(nfi(R2.tr.M, 2) + ' kNm'), `Heavy, width 1,2 m, 48,3 × 3,2: transom ${nfi(R2.tr.M, 2)} kNm > ${nfi(R2.tr.Mcap, 2)} kNm → CEK`, t2);
  // transom antara → ledger diperiksa
  await setF(page, { 'f-pipa': '4.0', 'f-transom': '1' });
  await goV(page, 'analisis');
  const R3 = REF.memberBendingRef({ ...c, B: 1.2, ntr: 1 });
  const b3 = await txt(page, '#fx-bend'), ck3 = await checks(page);
  const lg = ck3.find(x => /Lentur ledger M/.test(x.t)), tr3 = ck3.find(x => /Lentur transom/.test(x.t));
  T.ok(lg && !lg.ok && lg.t.includes(nfi(R3.lg.M, 2) + ' kNm') && tr3.t.includes(nfi(R3.tr.M, 2) + ' kNm') && /LEDGER TIDAK MEMENUHI/.test(b3), `with an intermediate transom: transom ${nfi(R3.tr.M, 2)} kNm, ledger ${nfi(R3.lg.M, 2)} kNm vs ${nfi(R3.lg.Mcap, 2)} → CEK`, { lg, tr3 });
  const mat = await page.evaluate(() => matRows.find(r => /Transom antara/.test(r.n)));
  T.ok(mat && mat.q === 3 * 1, 'material list gains 1 intermediate transom per bay per boarded lift', mat);
  // kasus acuan Medium: transom memenuhi, ledger tidak menentukan (INFO)
  await setF(page, { 'f-transom': '0', 'f-lift': 4, 'f-papan': 2, 'an-kelas': '4.4', 'f-lebar': 1.2 });
  const R4 = REF.memberBendingRef({ ...REF.REF, FkN: 1.5 });
  const ck4 = await checks(page);
  const tr4 = ck4.find(x => /Lentur transom/.test(x.t)), lg4 = ck4.find(x => /Lentur ledger/.test(x.t));
  T.ok(tr4.ok && tr4.t.includes(nfi(R4.tr.M, 2) + ' kNm') && lg4.ok && lg4.info, `reference case (Medium, 4,0): transom ${nfi(R4.tr.M, 2)} kNm ≤ 1,12 kNm (ratio ${nfi(R4.tr.ratio, 2)}); ledger shown as INFO (transoms only at standards)`, { tr4, lg4 });
  await shot(page, 'temuan-f6-bend-desktop', { fullPage: false });
  noIssues('F6', issues);
  await ctx.close();
}

/* ======================================================================
   F7–F8. Beban terpusat Special & kelas Tahap 2 ditegakkan
   ====================================================================== */
T.section('F7 point load above 2,0 kN: board checked against the actual load');
{
  const { ctx, page } = await open('desktop');
  await goV(page, 'beban');
  await setF(page, { 'll-pt': 300 });
  await page.click('#v-beban button:has-text("Terapkan Kelas Duty")');
  const sp = await page.evaluate(() => ({ k: document.getElementById('an-kelas').value, pt: document.getElementById('an-sdpt').value, vis: getComputedStyle(document.getElementById('fld-sdpt')).display !== 'none' }));
  await setF(page, { 'an-ptpapan': '2.0' });
  await goV(page, 'duty');
  let plt = await txt(page, '#an-checks-sta');
  T.ok(sp.k === 'sp' && sp.pt === '2.95' && sp.vis, '"Terapkan" sets Special and the Special point load 2,95 kN (300 kg, rounded up)', sp);
  T.ok(/Beban terpusat kelas 2,95 kN > kapasitas beban terpusat papan 2,00 kN/.test(plt), 'board check uses 2,95 kN (was a fixed 2,0 kN → OK)', plt.slice(0, 200));
  await setF(page, { 'an-ptpapan': '3.0' });
  plt = await txt(page, '#an-checks-sta');
  T.ok(/Beban terpusat kelas 2,95 kN ≤ kapasitas beban terpusat papan 3,00 kN/.test(plt), 'board 3,0 kN → OK');
  // tanpa "Terapkan": kelas Heavy dipilih manual, Tahap 2 tetap 300 kg → beban terpusat Tahap 2 dipakai
  await setF(page, { 'an-kelas': '6.6', 'an-ptpapan': '2.0' });
  plt = await txt(page, '#an-checks-sta');
  T.ok(/Beban terpusat Tahap 2 2,94 kN \(300 kg; lebih besar dari nilai kelas 2,0 kN\) > kapasitas/.test(plt), 'without "Terapkan", the Tahap 2 point load (2,94 kN) still governs the board check', plt.slice(0, 220));
  await ctx.close();
}
T.section('F8 Tahap 2 class enforced (finding B4 and B8)');
{
  const { ctx, page } = await open('desktop');
  await goV(page, 'beban');
  await setF(page, { 'll-org': 4, 'll-mat': 300, 'f-lift': 1, 'f-hlift': 2.0, 'f-tinggi': '', 'f-papan': 1, 'an-ptpapan': '2.0', 'an-plate': '0.1', 'an-tie': 'ya' });
  await goV(page, 'analisis');
  const verdict = await txt(page, '#an-verdict');
  const d = (await checks(page)).find(c => c.key === 'duty');
  T.ok(d && !d.ok && /lebih rendah dari rekomendasi Tahap 2 Special Duty \(7,9 kN\/bay/.test(d.t) && /PERLU REVIEW/.test(verdict), 'Tahap 2 recommends Special 7,9 kN, Medium still selected → CEK "lebih rendah dari rekomendasi Tahap 2" → PERLU REVIEW', d);
  await goV(page, 'beban');
  await page.click('#v-beban button:has-text("Terapkan Kelas Duty")');
  const d2 = (await checks(page)).find(c => c.key === 'duty');
  T.ok(d2 && d2.ok, 'after "Terapkan" the check passes', d2);
  await ctx.close();
}
{
  const legacy = { v: 2, answers: {}, fields: { 'f-proyek': 'Proyek v2.2 Light', 'f-nbay': '3', 'f-lift': '4' },
    analisis: { vals: { 'an-kelas': '2.2', 'an-lantai': '1', 'll-org': '2', 'll-worg': '90', 'll-eq': '50', 'll-mat': '150', 'll-imp': '25', 'll-sf': '1.5' }, mats: [] }, ts: 1 };
  const { ctx, page } = await open('desktop', legacy);
  await page.evaluate(() => { go('checklist'); bulk('ok'); });
  await goV(page, 'duty');
  const sta = await txt(page, '#an-checks-sta');
  await goV(page, 'laporan');
  const tag = await txt(page, '#tag-preview');
  T.ok(/Kelas beban dipilih Light Duty \(2,2 kN\/bay\) lebih rendah dari rekomendasi Tahap 2 Medium Duty \(4,4 kN\/bay/.test(sta), 'migrated v2.2.0 "Light" project: Tahap 3 shows the CEK (Tahap 2 now recommends Medium)', sta.slice(0, 200));
  T.ok(/Rekomendasi Tahap 2\s*Medium Duty · 4,4 kN\/bay — lebih tinggi/.test(tag) && !/AMAN DIGUNAKAN/.test(tag) && /MENUNGGU VERIFIKASI DESAIN/.test(tag), 'tag shows the higher Tahap 2 recommendation and is held (no "AMAN DIGUNAKAN")', tag.slice(0, 400));
  await ctx.close();
}

/* ======================================================================
   F9. BS EN 12811-1 §6.2.9.2 a)3 — 50 % beban layan pada lift berpapan berikutnya
   ====================================================================== */
T.section('F9 50 % service load on the next decked level (independent model)');
{
  const { ctx, page } = await open('desktop');
  await setF(page, { 'f-lift': 4 });
  await goV(page, 'analisis');
  const C = REF.corrected(REF.REF), C0 = REF.corrected({ ...REF.REF, halfRule: false });
  const cap = await txt(page, '#fx-cap');
  T.ok(Math.abs(C.NmaxKg - C0.NmaxKg - 0.5 * 224.34) < 0.01 && cap.includes(nfi(C.NmaxKg) + ' kg · ' + nfi(C.NmaxKN, 2) + ' kN') && cap.includes(nfi(C.bearing) + ' kg/m²'),
    `reference case N max ${nfi(C0.NmaxKg, 2)} → ${nfi(C.NmaxKg, 2)} kg (+0,5 × 224,34), foundation ${nfi(C.bearing)} kg/m²`, cap.slice(0, 200));
  T.ok(/50 % satu lift berpapan/.test(cap) && /§6\.2\.9\.2 a\)3/.test(cap), 'formula text cites BS EN 12811-1:2003 §6.2.9.2 a)3');
  await setF(page, { 'f-papan': 1 });
  const N1 = await page.evaluate(() => analisisData().N);
  T.ok(Math.abs(N1 - REF.corrected({ ...REF.REF, nbd: 1 }).NmaxKg) < 1e-6 && Math.abs(N1 - REF.corrected({ ...REF.REF, nbd: 1, halfRule: false }).NmaxKg) < 1e-6, 'single decked level → no extra 50 % level');
  await ctx.close();
}

/* ======================================================================
   F10. Tag & PDF tidak menyatakan AMAN bila analisis gagal
   ====================================================================== */
T.section('F10 tag and PDF verdict follow the structural analysis (finding B7)');
{
  const { ctx, page, issues } = await open('desktop');
  const c = { nb: 4, L: 2.4, B: 1.2, h: 2.7, nl: 7, nbd: 7, nwork: 3, t: 3.2, qkN: 6.6 };
  await setF(page, { 'f-nbay': c.nb, 'f-lift': c.nl, 'f-hlift': c.h, 'f-papan': c.nbd, 'f-pipa': '3.2', 'an-lantai': c.nwork, 'an-kelas': '6.6' });
  await page.evaluate(() => { go('checklist'); bulk('ok'); });
  await goV(page, 'laporan');
  const tag = await txt(page, '#tag-preview'), ring = await txt(page, '#ringkasan-root'), chip = await txt(page, '#prog-verdict');
  T.ok(!/AMAN DIGUNAKAN/.test(tag) && !/SAFE FOR USE/.test(tag) && /MENUNGGU VERIFIKASI DESAIN/.test(tag) && /AWAITING DESIGN VERIFICATION/.test(tag), 'scenario C, checklist all OK: tag reads "MENUNGGU VERIFIKASI DESAIN", not "AMAN DIGUNAKAN"', tag.slice(0, 200));
  T.ok(/Analisis struktur\s*Perlu review \(Beta\)/.test(tag), 'tag carries the analysis status');
  T.ok(/v2\.4\.0 \(Beta\) bersifat indikatif dan bukan sertifikasi desain/.test(tag), 'tag back carries the Beta / indicative caveat (printed with the tag)');
  T.ok(/KUNING — Menunggu Verifikasi Desain/.test(ring) && /Checklist inspeksi: HIJAU/.test(ring) && /PERLU REVIEW/.test(ring) && chip === 'HIJAU', 'Laporan banner held at KUNING; basis line shows checklist HIJAU + analysis PERLU REVIEW; checklist chip unchanged', ring.slice(0, 200));
  await page.emulateMedia({ media: 'print' });
  await page.evaluate(() => { renderTag(); document.getElementById('print-tag-area').innerHTML = '<div style="padding:30px">' + tagHTML() + '</div>'; });
  const pr = await page.evaluate(() => { const b = document.querySelector('#print-tag-area .tag-beta'); return b && getComputedStyle(b).display !== 'none' && b.getBoundingClientRect().height > 0; });
  T.ok(pr, 'Beta caveat is visible on the printed tag');
  await page.emulateMedia({ media: 'screen' });
  if (NET) {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#v-laporan [data-pdf-btn]')]);
    const b64 = fs.readFileSync(await dl.path()).toString('base64');
    // release QA 2026-10-10: parse the PDF in a separate CSP-free page — pdf.js starts a blob: worker that the app
    // page's Content-Security-Policy (correctly) refuses, which surfaced as a console error of the TEST, not the app
    const pdfPage = await ctx.newPage();
    await pdfPage.setContent('<!doctype html><title>pdf</title>');
    await pdfPage.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js' });
    const p1 = await pdfPage.evaluate(async (b64) => { pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; const doc = await pdfjsLib.getDocument({ data: Uint8Array.from(atob(b64), c => c.charCodeAt(0)) }).promise; let s = ''; for (let i = 1; i <= doc.numPages; i++) { const tc = await (await doc.getPage(i)).getTextContent(); s += tc.items.map(t => t.str).join(' ') + ' '; } return s.replace(/\s+/g, ' '); }, b64);
    T.ok(/STATUS: KUNING - MENUNGGU VERIFIKASI DESAIN/.test(p1) && /Checklist inspeksi: HIJAU/.test(p1) && /Analisis struktur indikatif \(Beta\): PERLU REVIEW/.test(p1) && !/Perancah layak dan aman digunakan/.test(p1), 'PDF banner: held status + checklist and analysis status side by side', p1.slice(0, 400));
    T.ok(/LENTUR TRANSOM/i.test(p1) && /DATA & ASUMSI MASUKAN/.test(p1), 'PDF lists the transom check and the data/assumption group');
  }
  noIssues('F10 held', issues);
  await ctx.close();
}
{
  // konfigurasi yang LOLOS seluruh pemeriksaan → tag HIJAU "AMAN DIGUNAKAN" tetap mungkin (F18: perancah diikat)
  const { ctx, page } = await open('desktop');
  await setF(page, { 'f-lift': 4, 'an-ptpapan': '2.0', 'an-plate': '0.1', 'an-tie': 'ya' });
  await page.evaluate(() => { go('checklist'); bulk('ok'); });
  await goV(page, 'analisis');
  const verdict = await txt(page, '#an-verdict'), ck = await checks(page);
  const tie = ck.find(c => /diikat ke bangunan/.test(c.t));
  await goV(page, 'laporan');
  const tag = await txt(page, '#tag-preview');
  T.ok(/LOLOS PEMERIKSAAN INDIKATIF/.test(verdict) && tie && tie.ok && tie.info && !ck.some(c => /3 × lebar dasar terkecil/.test(c.t)), 'F18: tied reference case (plate 0,1 m², board 2,0 kN) reaches LOLOS; the free-standing H ≤ 3B rule is replaced by an INFO on ties', { verdict: verdict.slice(0, 40), fails: ck.filter(c => !c.ok) });
  T.ok(/AMAN DIGUNAKAN/.test(tag) && /Lolos indikatif \(Beta\)/.test(tag), 'when checklist and analysis pass, the tag is HIJAU "AMAN DIGUNAKAN" with "Lolos indikatif (Beta)"', tag.slice(0, 160));
  await setF(page, { 'an-tie': 'tidak' });
  T.ok((await checks(page)).some(c => /3 × lebar dasar terkecil/.test(c.t) && !c.ok), 'not tied → free-standing rule H ≤ 3B applies again (CEK)');
  await ctx.close();
}

/* ======================================================================
   F11. Rincian material mengikuti geometri
   ====================================================================== */
T.section('F11 Tahap 5 follows geometry changes (finding B6)');
{
  const { ctx, page } = await open('desktop');
  await setF(page, { 'f-model': 'suspended', 'f-nbay': 6, 'f-lift': 8 });
  await goV(page, 'material');
  const c8 = { ...REF.REF, nb: 6, nl: 8 }, M8 = REF.materialEstimate(c8);
  let mat = await txt(page, '#mat-stats');
  T.ok(mat.includes(nfi(M8.Wd) + ' kg') && mat.includes(nfi(M8.pcs)), `auto rows regenerate for 6 bay × 8 lift: ${nfi(M8.Wd)} kg (was stuck at 1.626 kg)`, mat);
  await page.fill('#mat-body tr:first-child td:nth-child(2) input', '20');
  await setF(page, { 'f-nbay': 3, 'f-lift': 4 });
  await goV(page, 'material');
  const note = await txt(page, '#mat-note');
  const ck = (await checks(page)).find(c => c.key === 'mat');
  T.ok(/geometri lain/.test(note) && ck && !ck.ok, 'edited rows + geometry change → notice and CEK "disusun untuk geometri lain"', { note: note.slice(0, 100), ck });
  await page.click('#mat-note button:has-text("Ganti dengan estimasi geometri")');
  mat = await txt(page, '#mat-stats');
  T.ok(mat.includes(nfi(ME.Wd) + ' kg') && (await checks(page)).find(c => c.key === 'mat').ok, '"Ganti dengan estimasi geometri" restores the auto rows and clears the CEK');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'));
  const meta = await page.evaluate(() => matMeta);
  T.ok(meta.src === 'auto' && meta.geom === '3|2.4|1.2|2|4|2|4.0|0', 'provenance and geometry key survive a reload', meta);
  // rekaman v2.3.0 (v:3) dengan rincian otomatis v2.3.0 yang belum disunting (13 baris, tanpa set pagar ujung)
  await page.evaluate((k) => { const d = JSON.parse(localStorage.getItem(k)); d.v = 3; d.analisis = { vals: d.analisis.vals, mats: materialRowsV23(geom()) }; localStorage.setItem(k, JSON.stringify(d)); }, KEY);
  const v23rows = await page.evaluate(() => materialRowsV23(geom()).length);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'));
  const up = await page.evaluate(() => ({ src: matMeta.src, rows: matRows.length, toast: (document.querySelector('.toast-region') || {}).textContent || '' }));
  T.ok(v23rows === 13 && up.src === 'auto' && up.rows === ME.rows && !/versi sebelumnya|bawaan versi/.test(up.toast), 'untouched v2.3.0 auto rows (13) are recognised and silently upgraded to the v2.4.0 estimate (no legacy flag)', up);
  await ctx.close();
}

/* ======================================================================
   F12. Batas kelas beban terpusat dalam kg
   ====================================================================== */
T.section('F12 point-load class limits compared in kg (100/150/200 kg)');
{
  const { ctx, page } = await open('desktop');
  await goV(page, 'beban');
  await setF(page, { 'll-org': 0, 'll-eq': 0, 'll-mat': 0 });
  for (const [kg, cls] of [[100, 'LIGHT'], [101, 'MEDIUM'], [150, 'MEDIUM'], [152, 'HEAVY'], [200, 'HEAVY'], [203, 'SPECIAL']]) {
    await setF(page, { 'll-pt': kg });
    const st = await txt(page, '#ll-status');
    T.ok(st.startsWith('REKOMENDASI: ' + cls + ' DUTY'), `${kg} kg → ${cls}`, st.slice(0, 60));
  }
  T.ok(/100 \/ 150 \/ 200 kg/.test(await txt(page, '#v-beban')), 'Tahap 2 states the limits in kg');
  await ctx.close();
}

/* ======================================================================
   F14–F17. Kurva a, pagar ujung, jenis pipa data lama, teks rujukan
   ====================================================================== */
T.section('F14 buckling curve a: always CEK, justification required and printed');
{
  const { ctx, page } = await open('desktop');
  const c = { nb: 4, L: 2.4, B: 1.2, h: 2.7, nl: 7, nbd: 7, nwork: 3, t: 3.2, qkN: 6.6 };
  await setF(page, { 'f-nbay': c.nb, 'f-lift': c.nl, 'f-hlift': c.h, 'f-papan': c.nbd, 'f-pipa': '3.2', 'an-lantai': c.nwork, 'an-kelas': '6.6', 'an-kurva': 'a' });
  await goV(page, 'analisis');
  let k = (await checks(page)).find(x => x.key === 'kurva');
  const vis = await page.evaluate(() => getComputedStyle(document.getElementById('fld-kurva-why')).display !== 'none');
  T.ok(k && !k.ok && /belum diisi/.test(k.t) && vis, 'curve a → CEK "Alasan/sertifikat belum diisi"; justification field shown', k);
  await setF(page, { 'an-kurva-why': 'Sertifikat <b>uji</b> 123' });
  k = (await checks(page)).find(x => x.key === 'kurva');
  const html = await page.$eval('#an-checks', e => e.innerHTML);
  T.ok(k && !k.ok && /Sertifikat <b>uji<\/b> 123/.test(k.t) && !/<b>uji<\/b>/.test(html), 'with a justification the item stays CEK (Komite Q9) and the text is escaped');
  const cap = await txt(page, '#fx-cap');
  T.ok(/Pembanding\s*kurva c/.test(cap) && /selalu ditandai CEK/.test(cap), 'curve-c comparison shown next to curve a');
  await page.evaluate(() => { go('checklist'); bulk('ok'); go('laporan'); });
  T.ok(/MENUNGGU VERIFIKASI DESAIN/.test(await txt(page, '#tag-preview')), 'scenario C with curve a can no longer produce a green tag');
  await ctx.close();
}
T.section('F15 end guardrails on end standards; note labelled by the position used');
{
  const { ctx, page } = await open('desktop');
  const c = { nb: 1, L: 2.0, B: 1.2, h: 2.0, nl: 3, nbd: 1, nwork: 1, qkN: 2.2, t: 4.0 };
  await setF(page, { 'f-nbay': 1, 'f-lbay': 2.0, 'f-lebar': 1.2, 'f-hlift': 2.0, 'f-lift': 3, 'f-papan': 1, 'an-kelas': '2.2' });
  await goV(page, 'analisis');
  const A = await page.evaluate(() => analisisData().ST.pos.map(p => ({ key: p.key, N: p.N, edge: p.edge })));
  const R = REF.corrected(c);
  const ends = 1.4 * REF.tube(48.3, 4).m + 0.5 * 1.2 * REF.W_TOE_M + 2 * REF.W_RA;
  T.ok(Math.abs(A.find(p => p.key === 'ujung-luar').N - R.S.list.find(x => x.k === 'out0').N) < 1e-6 && Math.abs(A.find(p => p.key === 'ujung-dalam').edge - ends) < 1e-6, `1-bay tower: end standards carry the end guardrail set (${ends.toFixed(2)} kg per boarded lift); N max ${nfi(R.NmaxKg, 2)} kg = reference`, A);
  const note = await txt(page, '#fx-cap .calc-note');
  T.ok(/Berat sendiri per lift \(tiang ujung · sisi luar\)/.test(note), 'self-weight note names the position actually used (tiang ujung · sisi luar)', note);
  await ctx.close();
}
T.section('F16 legacy data without tube type: unset, computed as 3,2 mm, flagged');
{
  const { ctx, page } = await open('desktop', v22Record('independent', {}, MAT_V22));
  const s = await page.evaluate(() => ({ pipa: document.getElementById('f-pipa').value, A: analisisData().G.tubeKey }));
  const k = (await checks(page)).find(c => c.key === 'pipa');
  T.ok(s.pipa === '' && s.A === '3.2' && k && !k.ok, 'record without f-pipa → "Belum dipilih", computed as 48,3 × 3,2, CEK', { s, k });
  await setF(page, { 'f-pipa': '4.0' });
  T.ok(!(await checks(page)).some(c => c.key === 'pipa'), 'choosing a tube clears the CEK');
  await ctx.close();
}
T.section('F17 reference claims in UI text');
{
  const { ctx, page } = await open('desktop');
  const t = await page.evaluate(() => ({ help: document.getElementById('h-pipa').textContent, hero: document.querySelector('.hero-body').textContent, about: document.getElementById('v-tentang').textContent }));
  await goV(page, 'laporan');
  const tag = await txt(page, '#tag-preview');
  T.ok(!/SNI 8987:2021;/.test(t.help) && /belum diverifikasi/.test(t.help) && /§4\.2\.1\.2/.test(t.help), 'tube help no longer ties SNI 8987:2021 to 48,3 × 4,0/3,2 or f_y 235', t.help);
  T.ok(/rujukan pada butir checklist masih historis/.test(t.hero), 'hero qualifies the reference list (checklist refs are historical)');
  T.ok(!/JIS G3444/.test(t.about) && /Perancah frame dan modular memakai standar/.test(t.about), 'About "Lingkup" matches the Data Proyek note (no JIS G3444)');
  T.ok(/Acuan perhitungan\s*BS EN 12811-1 · BS EN 74-1 · NASC TG20:21/.test(tag), 'tag back: "Acuan perhitungan" (method), not a blanket compliance claim');
  await ctx.close();
}

/* ======================================================================
   Ponsel + axe pada tampilan yang berubah
   ====================================================================== */
T.section('M mobile layout and axe on changed views');
{
  const { ctx, page, issues } = await open('mobile');
  await setF(page, { 'f-transom': '1', 'an-kurva': 'a', 'an-kelas': '2.2' });
  for (const v of ['proyek', 'beban', 'duty', 'material', 'analisis', 'laporan']) {
    await goV(page, v); await page.waitForTimeout(60);
    T.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, `mobile ${v}: no horizontal overflow`);
  }
  await goV(page, 'analisis');
  await shot(page, 'temuan-mobile-analisis', { fullPage: false });
  if (NET) {
    await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
    for (const v of ['proyek', 'duty', 'material', 'analisis', 'laporan']) {
      await goV(page, v); await page.waitForTimeout(80);
      const r = await page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical' || x.id === 'region').map(x => ({ id: x.id, n: x.nodes.length, t: x.nodes.slice(0, 2).map(n => n.target.join(' ')) })));
      T.ok(r.length === 0, `axe ${v} (mobile): 0 serious/critical, no region violations`, r);
    }
  }
  noIssues('mobile', issues);
  await ctx.close();
}

await browser.close();
server.close();
process.exit(T.done() ? 1 : 0);
