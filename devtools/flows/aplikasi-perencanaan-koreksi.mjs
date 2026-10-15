// aplikasi-perencanaan-koreksi — regresi KOREKSI METODE PERHITUNGAN PPAPI Scaffold v2.3.0 → v2.4.0 (Beta).
// Nilai harapan berasal dari devtools/flows/aplikasi-perencanaan-ref.mjs (perhitungan independen: enumerasi batang →
// simpul, Perry–Robertson dari sifat penampang) dan dari hitungan tangan di site/aplikasi/KOREKSI-PERHITUNGAN.md —
// TIDAK dari fungsi aplikasi. Hasil aplikasi dibaca dari layar (teks) dan dari analisisData() lalu dibandingkan.
// usage (cwd devtools): node flows/aplikasi-perencanaan-koreksi.mjs [--no-net]   (--no-net: lewati PDF & axe)
import fs from 'node:fs';
import { startServer, launch, newContext, seedSession, watch, recorder, shot } from './aplikasi-lib.mjs';
import * as REF from './aplikasi-perencanaan-ref.mjs';

const NET = !process.argv.includes('--no-net');
const T = recorder('aplikasi-perencanaan-koreksi');
const { server, BASE } = await startServer();
const browser = await launch();
const PR = `${BASE}/aplikasi/perencanaan/index.html`;
const nfi = (v, d = 0) => Number(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const rel = (a, b) => Math.abs(a - b) / Math.max(1e-9, Math.abs(b));
const txt = (page, sel) => page.$eval(sel, el => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
const noIssues = (label, issues) => T.ok(issues.length === 0, `${label}: no console errors / page errors / failed requests`, issues.slice(0, 4));
async function open(vp = 'desktop', seed) {
  const ctx = await newContext(browser, vp);
  await seedSession(ctx, {});
  if (seed) await ctx.addInitScript(seed.fn, seed.arg);
  const page = await ctx.newPage();
  const issues = watch(page);
  await page.goto(PR, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'), null, { timeout: 30000 });
  return { ctx, page, issues };
}
async function setFields(page, o) {
  await page.evaluate((o) => {
    for (const [id, v] of Object.entries(o)) {
      const e = document.getElementById(id); e.value = String(v);
      e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }, o);
}
/* skenario acuan → isian aplikasi */
function fieldsOf(c) {
  return { 'f-nbay': c.nb, 'f-lbay': c.L, 'f-lebar': c.B, 'f-hlift': c.h, 'f-lift': c.nl, 'f-tinggi': '', 'f-papan': c.nbd, 'f-pipa': c.t === 3.2 ? '3.2' : '4.0',
    'an-lantai': c.nwork, 'an-kelas': { 2.2: '2.2', 4.4: '4.4', 6.6: '6.6' }[c.qkN], 'an-kurva': c.curve || 'c', 'an-kle': c.k || 1, 'an-klemcls': c.couplerClass || 'A', 'an-plate': c.plate || 0.04 };
}
const appData = (page) => page.evaluate(() => {
  const A = analisisData();
  return { pos: A.ST.pos.map(p => ({ key: p.key, N: p.N, self: p.self, boards: p.boards, edge: p.edge, live: p.live, gov: !!p.gov })), N: A.N, Nperm: A.BK.Nperm, chi: A.BK.chi,
    lam: A.BK.lam, lb: A.BK.lb, NbRk: A.BK.NbRk, R: A.CP.kN, swl: A.CP.swl, bearing: A.bearing, avg: A.ST.avg, dead: A.dead, live: A.live, total: A.total, ok: A.ok,
    checks: A.checks.map(c => ({ g: c.g, ok: c.ok, t: c.t })), X: A.X };
});
const POSMAP = { 'tengah-luar': 'out1', 'tengah-dalam': 'in1', 'ujung-luar': 'out0', 'ujung-dalam': 'in0' };

/* ======================================================================
   K0. Perhitungan acuan itu sendiri — dicek terhadap hitungan tangan & sumber
   ====================================================================== */
T.section('K0 reference module vs hand calculation / published values');
{
  const t4 = REF.tube(48.3, 4.0), t3 = REF.tube(48.3, 3.2);
  T.ok(Math.abs(t4.A - 556.69) < 0.01 && Math.abs(t4.m - 4.37) < 0.005 && Math.abs(t4.I / 1e4 - 13.77) < 0.01 && Math.abs(t4.i - 15.73) < 0.01, '48,3 × 4,0: A 556,69 mm², 4,37 kg/m (EN 39 nominal), I 13,77 cm⁴, i 15,73 mm', t4);
  T.ok(Math.abs(t3.A - 453.39) < 0.01 && Math.abs(t3.m - 3.56) < 0.005, '48,3 × 3,2: A 453,39 mm², 3,56 kg/m', t3);
  const swlA = 10 / (1.1 * 1.5), swlB = 15 / (1.1 * 1.5);
  T.ok(Math.abs(swlA - 6.06) < 0.005 && Math.abs(swlB - 9.09) < 0.005 && Math.abs(swlA - 6.1) < 0.05 && Math.abs(swlB - 9.1) < 0.05, 'coupler 10/1,65 = 6,06 kN and 15/1,65 = 9,09 kN (≈ TG20 6,1 / 9,1 kN)');
  const b = REF.bucklingCapacity({ t: 4.0, curve: 'c', Le: 2.0 });
  // hitungan tangan: λ = 2000/15,726 = 127,18; λ̄ = 127,18/93,91 = 1,3542; Φ = 0,5[1 + 0,49·1,1542 + 1,8339] = 1,6997; χ = 1/(1,6997 + √(2,8890 − 1,8339)) = 0,3667
  T.ok(Math.abs(b.lambda - 127.18) < 0.01 && Math.abs(b.lb - 1.3542) < 0.0001 && Math.abs(b.Phi - 1.6997) < 0.0001 && Math.abs(b.chi - 0.3667) < 0.0001, 'Ayrton–Perry χ = 0,3667 for 48,3 × 4,0, L_e 2,0 m, curve c (hand calculation)', b);
  T.ok(Math.abs(b.chiPR - b.chi) < 1e-9, 'Perry–Robertson stress form gives the same χ as the EN 1993-1-1 form');
  const dev = Object.entries(REF.TG20_PC_48x4).map(([le, pc]) => { const n = REF.bucklingCapacity({ t: 4.0, curve: 'c', Le: +le }).Nperm; return { le, pc, n: +n.toFixed(2), d: (n / pc - 1) }; });
  T.ok(dev.every(x => x.d <= 0.001 && x.d > -0.006), 'curve c ÷ 1,65 reproduces the NASC TG20:21 safe axial loads for 48,3 × 4,0 at the 11 tabulated L_e (1,2–3,2 m): 0 … −0,5 %', dev);
  const b25 = REF.bucklingCapacity({ t: 4.0, curve: 'c', Le: 2.5 }).Nperm;
  T.ok(b25 > 20.53 && (b25 / 20.53 - 1) < 0.003, `between tabulated points the curve can be slightly above TG20: L_e 2,5 m → ${b25.toFixed(2)} kN vs 20,53 kN (PSD 9989-1 E hlm. 14), +${((b25 / 20.53 - 1) * 100).toFixed(2)} % (≤ +0,3 %, as stated in KOREKSI §5)`);
  T.ok(Math.abs(6 / 1.65 - REF.TG20_COUPLER.SLEEVE_A) < 0.05 && Math.abs(9 / 1.65 - REF.TG20_COUPLER.SLEEVE_B) < 0.06 && REF.TG20_COUPLER.RA_A === 6.1 && REF.TG20_COUPLER.RA_B === 9.1, 'EN 12811-1 Table C.1 ÷ 1,65 matches TG20:21 coupler values (RA 6,1/9,1; sleeve 3,6/5,5 kN)');
  T.ok(Math.abs(b.Nperm - 29.075) < 0.002 && Math.abs(b.NbRk - 47.975) < 0.002, 'N_b,Rk 47,98 kN → N_izin 29,08 kN', { NbRk: b.NbRk, Nperm: b.Nperm });
  const C = REF.corrected(REF.REF);
  // hitungan tangan (KOREKSI-PERHITUNGAN.md §4/§19): struktur 137,32 + papan 62,40 + pagar 56,75 + hidup 224,34 = 480,81 kg (v2.3.0);
  // v2.4.0: + 50 % beban layan pada lift berpapan kedua (BS EN 12811-1 §6.2.9.2 a)3): + 0,5 × 224,34 = 112,17 → 592,98 kg
  T.ok(Math.abs(C.NmaxKg - 592.98) < 0.01 && C.S.max.k === 'out1', 'reference case N max 592,98 kg at an interior outer standard (hand calculation incl. §6.2.9.2 a)3)', C.S.max);
  T.ok(Math.abs(REF.corrected({ ...REF.REF, halfRule: false }).NmaxKg - 480.81) < 0.01, 'without the 50 % level the reference module still gives the v2.3.0 value 480,81 kg (traceable)');
  const TB = REF.memberBendingRef({ ...REF.REF, FkN: 1.5 });
  // hitungan tangan §19: [½(4,4 + 0,612) + ½(4,4 − 1,5 + 0,612)]·1,2/8 + 1,5·1,2/4 + 0,0429·1,44/8 = 0,6393 + 0,45 + 0,0077 = 1,097 kNm
  T.ok(Math.abs(TB.tr.M - 1.097) < 0.001 && Math.abs(REF.tube(48.3, 4.0).MpermkNm - 1.121) < 0.001 && Math.abs(REF.tube(48.3, 4.0).MpermkNm - REF.TG20_MCAP_48x4) < 0.005,
    `transom bending, reference case: M ${TB.tr.M.toFixed(3)} kNm vs W_pl·f_y/1,65 = ${REF.tube(48.3, 4.0).MpermkNm.toFixed(3)} kNm (TG20:21 Tabel 5.9: 1,12 kNm)`);
  T.ok(Math.abs(C.coupler.kg - 269.08) < 0.01 && Math.abs(C.coupler.kN - 2.639) < 0.001, 'reference case coupler reaction 269,08 kg (2,64 kN)', C.coupler);
  const sumMembers = C.S.sum - C.S.list.reduce((a, c) => a + c.live, 0);
  const mat = REF.materialEstimate(REF.REF);
  T.ok(Math.abs(sumMembers - (mat.Wd - 8 * 2.5 - 8 * 4 - 2 * 15)) < 2, `Σ standard self-weight (${sumMembers.toFixed(1)} kg) = material list minus base plates, sole boards, ladders (${(mat.Wd - 82).toFixed(1)} kg, rounding < 2 kg)`);
  const L = REF.report().legacyCheck;
  T.ok(L.default.Wd === 393 && Math.round(L.default.fact) === 2609 && Math.round(L.default.perT) === 435 && Math.round(L.default.bearing) === 10869 && L.default.klemKN.toFixed(2) === '3.20'
    && L.auto4.rows === 14 && L.auto4.pcs === 227 && L.auto4.Wd.toFixed(1) === '1469.2' && Math.round(L.auto4.fact) === 4223 && Math.round(L.auto4.perT) === 704 && Math.round(L.auto4.bearing) === 17595 && L.auto4.klemKN.toFixed(2) === '5.18',
    'legacy formulas reproduce ANALISIS_PERENCANAAN §2.8 (so the "before" column is faithful)', L);
}

/* ======================================================================
   K1. Kasus acuan di aplikasi: 3 bay × 2,0 m lift × 4 lift, Medium, 2 lift berpapan
   ====================================================================== */
T.section('K1 reference case in the app (desktop)');
{
  const { ctx, page, issues } = await open('desktop');
  const C = REF.corrected(REF.REF);
  await setFields(page, fieldsOf(REF.REF));
  await page.evaluate(() => go('analisis'));
  const A = await appData(page);
  const posOk = A.pos.every(p => rel(p.N, C.S.list.find(x => x.k === POSMAP[p.key]).N) < 1e-9);
  T.ok(posOk && A.pos.length === 4, 'load on each standard position equals the member-by-member reference (4 positions)', A.pos.map(p => [p.key, p.N.toFixed(2)]));
  T.ok(A.pos.find(p => p.gov).key === 'tengah-luar' && rel(A.N, C.NmaxKg) < 1e-9, `governing = interior outer standard, N ${C.NmaxKg.toFixed(2)} kg (max, not average ${C.S.avg.toFixed(1)} kg)`, { N: A.N, avg: A.avg });
  T.ok(rel(A.avg, C.S.avg) < 1e-9, 'average of all 8 standards equals reference');
  T.ok(rel(A.Nperm, C.B.Nperm) < 1e-9 && rel(A.chi, C.B.chi) < 1e-9 && rel(A.lam, C.B.lambda) < 1e-9 && rel(A.NbRk, C.B.NbRk) < 1e-9, `buckling: χ ${C.B.chi.toFixed(4)}, N_izin ${C.B.Nperm.toFixed(3)} kN`, { app: [A.chi, A.Nperm], ref: [C.B.chi, C.B.Nperm] });
  T.ok(rel(A.R, C.coupler.kN) < 1e-9 && rel(A.swl, C.coupler.swl) < 1e-9, `coupler: R ${C.coupler.kN.toFixed(3)} kN vs ${C.coupler.swl.toFixed(3)} kN`);
  T.ok(rel(A.bearing, C.bearing) < 1e-9, `foundation q ${C.bearing.toFixed(1)} kg/m² from N max`);
  // tampilan
  const cap = await txt(page, '#fx-cap');
  for (const p of C.S.list.filter(x => ['out1', 'in1', 'out0', 'in0'].includes(x.k))) T.ok(cap.includes(nfi(p.N) + ' kg · ' + nfi(p.N * REF.g / 1000, 2) + ' kN'), `card shows ${p.k}: ${nfi(p.N)} kg · ${nfi(p.N * REF.g / 1000, 2)} kN`);
  T.ok(cap.includes('χ = ' + nfi(C.B.chi, 3)) && cap.includes(nfi(C.B.lb, 3)) && cap.includes(nfi(C.B.Nperm, 2) + ' kN') && cap.includes(nfi(C.B.NpermKg) + ' kg') && cap.includes('A = 557 mm²'),
    `buckling details shown: χ = ${nfi(C.B.chi, 3)}, λ̄ ${nfi(C.B.lb, 3)}, N_izin ${nfi(C.B.Nperm, 2)} kN (≈ ${nfi(C.B.NpermKg)} kg)`, cap.slice(cap.indexOf('Penampang'), cap.indexOf('Penampang') + 400));
  T.ok(/TIANG MEMENUHI/.test(cap) && cap.includes('rasio ' + nfi(C.util, 2)), `standard check OK, ratio ${nfi(C.util, 2)}`);
  const geo = await txt(page, '#an-geom');
  T.ok(geo.includes('3 bay × 2,40 m') && geo.includes('4 lift × 2,00 m') && geo.includes('2 lift berpapan') && geo.includes('1 platform kerja'), 'geometry used by the analysis is stated', geo);
  T.ok((await txt(page, '#geom-hint-an')) === '', 'no geometry note when lifts are given');
  await shot(page, 'koreksi-k1-analisis-desktop', { fullPage: true });
  noIssues('K1', issues);
  await ctx.close();
}

/* ======================================================================
   K2. Matriks skenario — aplikasi vs acuan
   ====================================================================== */
T.section('K2 scenario matrix (geometry, duty, tube, curve, effective length)');
{
  const { ctx, page, issues } = await open('desktop');
  const SC = [
    { name: 'menara 1 bay, Light, 3 lift', nb: 1, L: 2.0, B: 1.2, h: 2.0, nl: 3, nbd: 1, nwork: 1, qkN: 2.2, t: 4.0, curve: 'c', k: 1 },
    { name: '5 bay, Heavy, 6 lift × 2,5 m, 2 platform kerja, pipa 3,2, kurva a', nb: 5, L: 2.4, B: 1.5, h: 2.5, nl: 6, nbd: 4, nwork: 2, qkN: 6.6, t: 3.2, curve: 'a', k: 1 },
    { name: '3 bay, Medium, lift 2,7 m, pipa 3,2, kelas B', nb: 3, L: 2.4, B: 1.2, h: 2.7, nl: 5, nbd: 3, nwork: 2, qkN: 4.4, t: 3.2, curve: 'c', k: 1, couplerClass: 'B' },
    { name: '2 bay, k 1,5, 8 lift', nb: 2, L: 1.8, B: 0.9, h: 2.0, nl: 8, nbd: 2, nwork: 1, qkN: 4.4, t: 4.0, curve: 'c', k: 1.5 },
    { name: '4 bay, Heavy, 3 platform kerja, lift 2,7 m, pipa 3,2 (melampaui kapasitas)', nb: 4, L: 2.4, B: 1.2, h: 2.7, nl: 7, nbd: 7, nwork: 3, qkN: 6.6, t: 3.2, curve: 'c', k: 1.5 },
  ];
  for (const c of SC) {
    await setFields(page, fieldsOf(c));
    await page.evaluate(() => go('analisis'));
    const A = await appData(page), R = REF.corrected(c);
    const exp = { N: R.NmaxKg, Nperm: R.B.Nperm, R: R.coupler.kN, swl: R.coupler.swl, okN: R.util <= 1 };
    const stdCheck = A.checks.find(x => /Beban tiang terbesar/.test(x.t));
    T.ok(rel(A.N, exp.N) < 1e-9 && rel(A.Nperm, exp.Nperm) < 1e-9 && rel(A.R, exp.R) < 1e-9 && rel(A.swl, exp.swl) < 1e-9 && stdCheck.ok === exp.okN,
      `${c.name}: N ${exp.N.toFixed(1)} kg, N_izin ${exp.Nperm.toFixed(2)} kN (rasio ${R.util.toFixed(2)} → ${exp.okN ? 'OK' : 'CEK'}), klem ${exp.R.toFixed(2)}/${exp.swl.toFixed(2)} kN`,
      { app: { N: A.N, Nperm: A.Nperm, R: A.R, ok: stdCheck.ok }, exp });
  }
  // tinggi saja (tanpa jumlah lift): jumlah lift = round(H/h)
  await setFields(page, { ...fieldsOf(REF.REF), 'f-lift': '', 'f-tinggi': '8.2' });
  await page.evaluate(() => go('analisis'));
  T.ok(rel((await appData(page)).N, REF.corrected(REF.REF).NmaxKg) < 1e-9, 'height 8,2 m with 2,0 m lifts → 4 lifts (round(H/h))');
  await setFields(page, { 'f-lift': '4', 'f-tinggi': '12' });
  await page.evaluate(() => go('analisis'));
  T.ok(/tidak sesuai dengan jumlah lift/.test(await txt(page, '#geom-hint-an')), 'inconsistent height vs lifts → CATATAN shown');
  noIssues('K2', issues);
  await ctx.close();
}

/* ======================================================================
   K3. Tahap 2 — bay terberat (E4), tanpa SF (E6), beban terpusat
   ====================================================================== */
T.section('K3 live load on the worst bay (E4/E6)');
{
  const { ctx, page, issues } = await open('desktop');
  await page.evaluate(() => go('beban'));
  const cases = [[{}, {}], [{ 'll-pt': 180 }, { ptKg: 180 }], [{ 'll-pt': '', 'll-org': 4, 'll-mat': 300 }, { org: 4, mat: 300 }], [{ 'll-org': 1, 'll-mat': 0, 'll-eq': 20 }, { org: 1, mat: 0, eq: 20 }]];
  for (const [f, r] of cases) {
    await setFields(page, f);
    const exp = REF.liveLoadCorrected(r);
    const st = await txt(page, '#ll-status'), stats = await txt(page, '#ll-stats');
    T.ok(st.includes('KELAS ' + exp.cls.toUpperCase() + ' DUTY') || st.includes(exp.cls.toUpperCase() + ' DUTY'), `${JSON.stringify(r)} → bay ${exp.bay} kg → ${exp.cls} (${exp.kn} kN)`, { st, stats });
    T.ok(stats.includes(nfi(exp.bay) + ' kg') && st.includes(nfi(exp.kn, 1) + ' kN'), `  stats show ${nfi(exp.bay)} kg and ${nfi(exp.kn, 1)} kN`);
  }
  await setFields(page, { 'll-org': 4, 'll-mat': 300, 'll-eq': 50 });
  await page.click('#v-beban button:has-text("Terapkan Kelas Duty")');
  const sp = { k: await page.$eval('#an-kelas', e => e.value), kn: await page.$eval('#an-sduty', e => e.value) };
  T.ok(sp.k === 'sp' && sp.kn === String(REF.liveLoadCorrected({ org: 4, mat: 300 }).kn), 'apply → Special duty 7,9 kN set on Tahap 3', sp);
  const old = REF.liveLoadLegacy({});
  T.ok(old.perBay === 215 && old.cls === 'Light' && REF.liveLoadCorrected({}).cls === 'Medium', 'before/after documented: legacy 645 kg ÷ 3 bay = 215 kg → Light; corrected worst bay 430 kg → Medium');
  T.ok(!(await page.$('#ll-sf')), 'no safety factor input on Tahap 2');
  noIssues('K3', issues);
  await ctx.close();
}

/* ======================================================================
   K4. Dasar keamanan tunggal pada model suspended & mobile; platform (E7); kelas klem; migrasi data lama
   ====================================================================== */
T.section('K4 single safety basis (suspended/mobile), platform point load, coupler class, legacy data');
{
  const { ctx, page, issues } = await open('desktop');
  const tot = REF.totals(REF.REF, 'suspended');   /* suspended/mobile: tanpa level 50 % (§6.2.9.2 untuk perancah fasad) */
  await setFields(page, { 'f-model': 'suspended' });
  await page.evaluate(() => go('duty'));
  let A = await appData(page);
  const Texp = tot.total / 2, ncwExp = Math.ceil(3 * Texp * 0.9 / (3.6 * 25));
  T.ok(rel(A.total, tot.total) < 1e-9 && rel(A.X.Tkg, Texp) < 1e-9 && A.X.ncwReq === ncwExp, `suspended: T = (W_d ${tot.Wd} + live ${tot.live.toFixed(1)})/2 = ${Texp.toFixed(1)} kg (no ×1,5); counterweight ${ncwExp}`, { app: A.X, Texp, ncwExp });
  await setFields(page, { 'f-model': 'mobile' });
  await page.evaluate(() => go('duty'));
  A = await appData(page);
  T.ok(rel(A.X.Ncas, tot.total / 4) < 1e-9, `mobile: per castor = total/4 = ${(tot.total / 4).toFixed(1)} kg`);
  await setFields(page, { 'f-model': 'independent' });
  await page.evaluate(() => go('duty'));
  let plt = await txt(page, '#an-checks-sta');
  T.ok(/Beban terpusat kelas 1,5 kN belum dapat diperiksa/.test(plt), 'E7: point-load check flagged until board capacity is entered');
  await setFields(page, { 'an-ptpapan': '2' });
  plt = await txt(page, '#an-checks-sta');
  T.ok(/Beban terpusat kelas 1,5 kN ≤ kapasitas beban terpusat papan 2,00 kN/.test(plt), 'Medium 1,5 kN ≤ 2,0 kN → OK');
  await setFields(page, { 'an-kelas': '6.6', 'an-ptpapan': '1.8' });
  plt = await txt(page, '#an-checks-sta');
  T.ok(/Beban terpusat kelas 2,0 kN > kapasitas beban terpusat papan 1,80 kN/.test(plt), 'Heavy 2,0 kN > 1,8 kN → CEK with ">"');
  await setFields(page, { 'an-kelas': '4.4', 'an-klemcls': 'B' });
  await page.evaluate(() => go('analisis'));
  T.ok((await txt(page, '#fx-klem')).includes('kelas B 9,09 kN'), 'coupler class B → 9,09 kN');
  await ctx.close();
  // data tersimpan versi 2.2.0 (kunci an-tiang/an-fk/ll-sf, klem '9.4', 8 material lama)
  const legacy = { v: 2, answers: { '0-0': 'ok' }, fields: { 'f-proyek': 'Proyek Lama', 'f-nbay': '3' },
    analisis: { vals: { 'an-klemcls': '9.4', 'an-tiang': '10', 'an-fk': '1.5', 'll-sf': '1.5', 'an-bay': '3', 'an-kaptiang': '2500', 'an-nklem': '8', 'll-org': '3' },
      mats: [{ n: 'Standard / tiang (3 m)', q: 6, w: 12 }, { n: 'Ledger (2,5 m)', q: 8, w: 10 }] }, ts: 1 };
  const o = await open('desktop', { fn: (d) => { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); localStorage.setItem('ppapi_app_perencanaan_v1_u_demo-uji-0001', JSON.stringify(d)); } }, arg: legacy });
  await o.page.evaluate(() => go('analisis'));
  const mig = await o.page.evaluate(() => ({ klem: document.getElementById('an-klemcls').value, org: document.getElementById('ll-org').value, mats: matRows.length, proj: document.getElementById('f-proyek').value }));
  T.ok(mig.klem === 'B' && mig.org === '3' && mig.mats === 2 && mig.proj === 'Proyek Lama', 'v2.2.0 data loads: coupler 9,4 → class B, obsolete keys ignored, user material rows kept', mig);
  noIssues('K4', issues.concat(o.issues));
  await o.ctx.close();
}

/* ======================================================================
   K5. Checklist: FRM otomatis N/A (E11), N/A kritis wajib beralasan (E12)
   ====================================================================== */
T.section('K5 checklist E11/E12');
{
  const { ctx, page, issues } = await open('desktop');
  await page.evaluate(() => go('checklist'));
  const frm = await page.evaluate(() => { const si = DATA.findIndex(s => s.code === 'FRM'); return { si, dis: [...document.querySelectorAll(`[id^="item-${si}-"] .ab`)].every(b => b.disabled), note: !!document.querySelector('.sec-note') }; });
  T.ok(frm.dis && frm.note, 'E11: FRM items locked as N/A for tubular scaffolds, with an explanation');
  await page.click('#v-checklist button:has-text("Tandai semua Sesuai")');
  T.ok((await txt(page, '#prog-verdict')) === 'HIJAU', 'all applicable items OK → HIJAU (FRM counted as N/A)');
  await page.click('#item-0-0 .ab:has-text("N/A")');
  const s1 = await page.evaluate(() => ({ v: document.getElementById('prog-verdict').textContent, p: document.getElementById('prog-txt').textContent, focus: document.activeElement.id }));
  T.ok(s1.v === 'BELUM LENGKAP' && /1 N\/A kritis tanpa alasan/.test(s1.p) && s1.focus === 'na-0-0', 'E12: critical N/A without reason → BELUM LENGKAP, focus moves to the reason field', s1);
  await page.fill('#na-0-0', 'Pekerjaan internal tanpa izin kerja terpisah <b>uji</b>');
  await page.waitForTimeout(600);
  T.ok((await txt(page, '#prog-verdict')) === 'HIJAU', 'reason entered → HIJAU');
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'));
  await page.evaluate(() => go('laporan'));
  const lap = await page.evaluate(() => ({ v: stats().status, ring: document.getElementById('ringkasan-root').innerHTML, txt: document.getElementById('ringkasan-root').textContent, frmPct: [...document.querySelectorAll('#ringkasan-root tr')].find(r => /FRM/.test(r.textContent)).lastElementChild.textContent.trim() }));
  T.ok(lap.v === 'HIJAU' && /N\/A pada Butir Kritis/.test(lap.txt) && /Alasan: Pekerjaan internal/.test(lap.txt) && !/<b>uji<\/b>/.test(lap.ring), 'reason persists after reload, is listed in the report summary and escaped', lap.txt.slice(-200));
  T.ok(lap.frmPct === 'N/A', 'category score excludes N/A items (FRM shows "N/A", not 0%)', lap.frmPct);
  noIssues('K5', issues);
  await ctx.close();
}

/* ======================================================================
   K6. Tanda Beta: layar, judul, bilah portal, PDF
   ====================================================================== */
T.section('K6 Beta marking (screen, title, PDF)');
{
  const { ctx, page, issues } = await open('desktop');
  const BETA = 'Beta — metode perhitungan telah dikoreksi dan menunggu tinjauan Komite Teknis PPAPI. Hasil bersifat indikatif dan wajib diverifikasi oleh ahli perancah yang kompeten.';
  for (const v of ['beranda', 'proyek', 'beban', 'duty', 'analisis', 'checklist', 'laporan', 'tentang']) {
    await page.evaluate(v => go(v), v);
    const b = await page.evaluate(() => { const el = document.querySelector('.beta-note'); const r = el.getBoundingClientRect(); return { t: el.textContent.replace(/\s+/g, ' ').trim(), vis: r.height > 0 && getComputedStyle(el).display !== 'none' }; });
    T.ok(b.vis && b.t === BETA, `Beta notice visible with the approved wording on ${v}`, b.t);
  }
  const head = await page.evaluate(() => ({ title: document.title, h1: document.querySelector('header h1').textContent, bar: document.querySelector('.pp-bar__title-long').textContent, ver: document.getElementById('ver-tag').textContent, hero: document.querySelector('.hero-beta').textContent }));
  T.ok(/\(Beta\)/.test(head.title) && /Beta/.test(head.h1) && /\(Beta\)/.test(head.bar) && head.ver === 'v2.4.0' && /Versi Beta/.test(head.hero), 'title, header, portal bar, hero and version mark the app as Beta (v2.4.0)', head);
  if (NET) {
    await page.evaluate(() => { go('checklist'); bulk('ok'); go('laporan'); });
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#v-laporan [data-pdf-btn]')]);
    const p = await dl.path(), size = fs.statSync(p).size;
    const b64 = fs.readFileSync(p).toString('base64');
    // release QA 2026-10-10: parse the PDF in a separate CSP-free page — pdf.js starts a blob: worker that the app
    // page's Content-Security-Policy (correctly) refuses, which surfaced as a console error of the TEST, not the app
    const pdfPage = await ctx.newPage();
    await pdfPage.setContent('<!doctype html><title>pdf</title>');
    await pdfPage.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js' });
    const pages = await pdfPage.evaluate(async (b64) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      const doc = await pdfjsLib.getDocument({ data: Uint8Array.from(atob(b64), c => c.charCodeAt(0)) }).promise;
      const out = [];
      for (let i = 1; i <= doc.numPages; i++) { const tc = await (await doc.getPage(i)).getTextContent(); out.push(tc.items.map(t => t.str).join(' ').replace(/\s+/g, ' ')); }
      return out;
    }, b64);
    const C = REF.corrected(REF.REF);
    T.ok(pages.length >= 3 && pages.every(t => /BETA/.test(t) && /metode perhitungan telah dikoreksi dan menunggu tinjauan Komite Teknis PPAPI/.test(t)), `PDF footer carries the Beta notice on every page (${pages.length} pages)`);
    const all = pages.join(' ');
    T.ok(all.includes(nfi(C.NmaxKg) + ' kg (' + nfi(C.NmaxKN, 2) + ' kN)') && all.includes(nfi(C.B.Nperm, 2) + ' kN') && /tegangan izin/.test(all) && !/INDIKASI AMAN/.test(all) && !/KEP-74/.test(all), 'PDF shows corrected values, safety basis, no "INDIKASI AMAN", no KEP-74');
    T.ok(size < 2 * 1024 * 1024, `PDF size ${Math.round(size / 1024)} KB`);
  }
  noIssues('K6', issues);
  await ctx.close();
}

/* ======================================================================
   K7. Ponsel 390 px + axe
   ====================================================================== */
T.section('K7 mobile layout and accessibility');
{
  const { ctx, page, issues } = await open('mobile');
  await setFields(page, fieldsOf(REF.REF));
  for (const v of ['beban', 'duty', 'material', 'analisis', 'checklist', 'laporan']) {
    await page.evaluate(v => go(v), v);
    await page.waitForTimeout(60);
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    T.ok(ov <= 1, `mobile ${v}: no horizontal overflow`, ov);
  }
  await page.evaluate(() => go('analisis'));
  const cards = await page.evaluate(() => [...document.querySelectorAll('.std-card')].map(c => Math.round(c.getBoundingClientRect().width)));
  T.ok(cards.length === 4 && cards.every(w => w === cards[0] && w > 300), 'mobile: standard cards stack in one column', cards);
  await shot(page, 'koreksi-k7-analisis-mobile', { fullPage: false });
  if (NET) {
    const AXE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
    await page.evaluate(() => { go('checklist'); setA('0-0', 'na'); });
    for (const v of ['analisis', 'duty', 'beban', 'checklist', 'laporan']) {
      await page.evaluate(v => go(v), v);
      await page.waitForTimeout(80);
      if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ url: AXE_URL });
      const r = await page.evaluate(async () => (await axe.run(document, { resultTypes: ['violations'] })).violations.filter(x => x.impact === 'serious' || x.impact === 'critical').map(x => ({ id: x.id, n: x.nodes.length, t: x.nodes.slice(0, 2).map(n => n.target.join(' ')) })));
      T.ok(r.length === 0, `axe ${v} (mobile, with N/A reason field): 0 serious/critical`, r);
    }
  }
  noIssues('K7', issues);
  await ctx.close();
}

await browser.close();
server.close();
process.exit(T.done() ? 1 : 0);
