// verify-eng-perencanaan — PEMERIKSAAN INDEPENDEN (adversarial) atas koreksi metode perhitungan
// PPAPI Scaffold v2.3.0 (Beta), aplikasi/perencanaan.
//
// Prinsip:
//  • Nilai harapan dihitung ulang di modul ini dengan rumus yang ditulis tangan — TIDAK memakai
//    kode aplikasi dan TIDAK memakai devtools/flows/aplikasi-perencanaan-ref.mjs.
//  • Tekuk dihitung dengan bentuk TEGANGAN Perry–Robertson (σ_cr, η), bukan bentuk χ/Φ aplikasi.
//  • Beban tiang dihitung dengan enumerasi batang → simpul (grid nb+1 × 2 baris).
//  • Hasil aplikasi dibaca dari TEKS LAYAR (DOM), bukan dari analisisData().
//  • Sumber pembanding: NASC TG20:21 Tabel 5.9/5.10/5.15 sebagaimana dikutip PSD Calc. 9989-1 E
//    (30-06-2022) hlm. 3, 10, 14; BS EN 12811-1:2003 §6.2.2.1, §6.2.9.2, §10.3.2, Tabel C.1;
//    CFMEU Victoria Scaffold Guide (2024) — kelas duty 225/450/675 kg, terpusat 100/150/200 kg.
//
// usage (cwd devtools): node flows/verify-eng-perencanaan.mjs [--no-browser]
import { startServer, launch, newContext, seedSession, watch, recorder, DEMO_USER } from './aplikasi-lib.mjs';
import fs from 'node:fs';

/* Release QA 2026-10-09: bagian B membandingkan TEKS LAYAR dengan model v2.3.0. Temuannya telah dikoreksi di
   v2.4.0 (KOREKSI-PERHITUNGAN §19); untuk v2.4.0 ke atas skenario B2–B8 diuji ulang oleh
   flows/aplikasi-perencanaan-temuan.mjs dan nilai kasus acuan oleh flows/aplikasi-perencanaan-koreksi.mjs (modul acuan
   independen aplikasi-perencanaan-ref.mjs). Bagian A (hitungan tangan) dan C (simulator) tetap dijalankan. */
const APP_VER = (/APP_VERSION\s*=\s*'([\d.]+)'/.exec(fs.readFileSync(new URL('../../site/aplikasi/perencanaan/app.js', import.meta.url), 'utf8')) || [])[1] || '?';
const B_ON = APP_VER === '2.3.0' || process.argv.includes('--b');

const BROWSER = !process.argv.includes('--no-browser');
const T = recorder('verify-eng-perencanaan');
const FINDINGS = [];                                   // temuan (bukan kegagalan uji) — dicetak di akhir
const finding = (sev, title, data) => { FINDINGS.push({ sev, title, data }); console.log(`  ! [${sev}] ${title}` + (data ? '  →  ' + JSON.stringify(data) : '')); };

/* ======================================================================
   0. Konstanta & sifat penampang (ditulis ulang dari nol)
   ====================================================================== */
const g = 9.80665, RHO = 7850, E = 210000, FY = 235, GF = 1.5, GM = 1.1, K = GF * GM;
function tube(t, D = 48.3) {
  const d = D - 2 * t;
  const A = Math.PI * (D * D - d * d) / 4;
  const I = Math.PI * (D ** 4 - d ** 4) / 64;
  const Wpl = (D ** 3 - d ** 3) / 6;                  // modulus plastis pipa
  return { t, A, I, i: Math.sqrt(I / A), m: A * 1e-6 * RHO, Wpl };
}
/* Perry–Robertson, bentuk tegangan: σ_b = ½[(f_y + (1+η)σ_cr) − √((f_y + (1+η)σ_cr)² − 4 f_y σ_cr)], η = α(λ̄ − 0,2) */
function prCapacity(t, Le, alpha = 0.49) {
  const s = tube(t);
  const lam = Le * 1000 / s.i;
  const scr = Math.PI ** 2 * E / lam ** 2;
  const lb = Math.sqrt(FY / scr);
  const eta = Math.max(0, alpha * (lb - 0.2));
  const a = FY + (1 + eta) * scr;
  const sb = Math.min(FY, (a - Math.sqrt(a * a - 4 * FY * scr)) / 2);
  const NRk = sb * s.A / 1000;
  return { lam, lb, chi: sb / FY, NRk, Nperm: NRk / K };
}
const nfi = (v, d = 0) => Number(v).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });

/* ======================================================================
   1. Model beban tiang: enumerasi batang → simpul
   ====================================================================== */
const W_RA = 1.2, W_SW = 1.4, W_SL = 1.1, W_PLANK_M = 5.2, W_TOE_M = 5 / 2.4;   // berat komponen (asumsi aplikasi lama; diuji ulang terpisah)
function nodeLoads(c) {
  const s = tube(c.t), m = s.m;
  const nlev = c.nl + 1, Hs = c.nl * c.h + 1.0;
  const bpb = Math.max(3, Math.round(c.B / 0.24));
  const nodes = {}; const key = (i, r) => i + r;
  for (let i = 0; i <= c.nb; i++) for (const r of ['i', 'o']) nodes[key(i, r)] = { self: 0, boards: 0, edge: 0, live: 0 };
  const add = (i, r, f, v) => { nodes[key(i, r)][f] += v; };
  const nStd = 2 * (c.nb + 1);
  // tiang + klem sambung
  const joints = Math.max(0, Math.ceil(Hs / 6) - 1);
  for (const k in nodes) nodes[k].self += Hs * m + joints * W_SL;
  // ledger per level per baris per segmen bay; transom per simpul per level; 2 klem siku per simpul per level
  for (let lev = 0; lev < nlev; lev++) {
    for (const r of ['i', 'o']) for (let j = 0; j < c.nb; j++) { add(j, r, 'self', c.L * m / 2); add(j + 1, r, 'self', c.L * m / 2); }
    for (let i = 0; i <= c.nb; i++) { const w = (c.B + 0.2) * m; add(i, 'i', 'self', w / 2); add(i, 'o', 'self', w / 2); for (const r of ['i', 'o']) add(i, r, 'self', 2 * W_RA); }
  }
  // bracing — dibagi rata
  const brace = 2 * c.nl * Math.hypot(c.L, c.h) * m + (4 * c.nl + 4) * W_SW;
  for (const k in nodes) nodes[k].self += brace / nStd;
  // papan, pagar, beban hidup per bay — ¼ ke setiap sudut bay (papan & hidup), ½ ke setiap ujung (pagar sisi luar)
  for (let lift = 0; lift < c.nbd; lift++) for (let j = 0; j < c.nb; j++) {
    const wb = bpb * c.L * W_PLANK_M;
    for (const [i, r] of [[j, 'i'], [j, 'o'], [j + 1, 'i'], [j + 1, 'o']]) add(i, r, 'boards', wb / 4);
    const we = c.L * (2 * m + W_TOE_M);
    add(j, 'o', 'edge', we / 2); add(j + 1, 'o', 'edge', we / 2);
  }
  for (let lift = 0; lift < c.nbd; lift++) for (let i = 0; i <= c.nb; i++) add(i, 'o', 'edge', 2 * W_RA);
  for (let p = 0; p < c.nwork; p++) for (let j = 0; j < c.nb; j++) for (const [i, r] of [[j, 'i'], [j, 'o'], [j + 1, 'i'], [j + 1, 'o']]) add(i, r, 'live', c.q / 4);
  let max = null, sum = 0, n = 0;
  for (const k in nodes) { const v = nodes[k]; v.N = v.self + v.boards + v.edge + v.live; sum += v.N; n++; if (!max || v.N > max.N + 1e-9) max = { k, ...v }; }
  return { nodes, max, avg: sum / n, bpb, m, Hs };
}
function couplerReaction(c) {
  const s = tube(c.t), m = s.m, bpb = Math.max(3, Math.round(c.B / 0.24));
  const tr = c.nb >= 2 ? 1 : 0.5;
  // simpul tengah pada level platform kerja: ½ dari setiap bay di kiri/kanan (lebar ½)
  const kg = tr * (c.q / 2 + bpb * c.L * W_PLANK_M / 2) + tr * c.L * m + (c.B + 0.2) * m / 2;
  return { kg, kN: kg * g / 1000 };
}
/* lentur transom pada simpul (papan logam membentang satu bay → seluruh beban 1 bay ke transom di tiang) */
function transomBending(c) {
  const s = tube(c.t), bpb = Math.max(3, Math.round(c.B / 0.24));
  const tr = c.nb >= 2 ? 1 : 0.5;
  const WkN = tr * (c.q + bpb * c.L * W_PLANK_M) * g / 1000;
  const M = WkN * c.B / 8;                            // balok sederhana, beban merata, bentang = lebar
  const Mcap = s.Wpl * FY / K / 1e6;                  // M_pl,k / (γM γF) — TG20:21 Tabel 5.9: 1,12 kNm (pipa 4,0)
  return { M, Mcap, ratio: M / Mcap };
}
function materialEstimate(c) {
  const s = tube(c.t), m = s.m, nStd = 2 * (c.nb + 1), nlev = c.nl + 1, Hs = c.nl * c.h + 1, joints = Math.max(0, Math.ceil(Hs / 6) - 1);
  const bpb = Math.max(3, Math.round(c.B / 0.24)), r1 = v => Math.round(v * 10) / 10;
  const rows = [
    [nStd, r1(Hs * m)], [2 * nlev, r1(c.nb * c.L * m)], [(c.nb + 1) * nlev, r1((c.B + 0.2) * m)], [2 * c.nl, r1(Math.hypot(c.L, c.h) * m)],
    [2 * c.nbd, r1(c.nb * c.L * m)], [4 * (c.nb + 1) * nlev + 2 * (c.nb + 1) * c.nbd, W_RA], [4 * c.nl + 4, W_SW], [nStd * joints, W_SL],
    [nStd, 2.5], [nStd, 4], [c.nb * bpb * c.nbd, r1(W_PLANK_M * c.L)], [c.nb * c.nbd, r1(W_TOE_M * c.L)], [Math.max(1, Math.ceil(c.nl / 2)), 15],
  ].filter(r => r[0] > 0);
  return { rows: rows.length, pcs: rows.reduce((a, r) => a + r[0], 0), kg: rows.reduce((a, r) => a + r[0] * r[1], 0) };
}
const qOf = kN => kN * 1000 / g;

/* ======================================================================
   A. PERHITUNGAN TANGAN (tanpa peramban)
   ====================================================================== */
T.section('A1 Penampang pipa & Perry–Robertson (bentuk tegangan) vs NASC TG20:21 (PSD 9989-1 E hlm. 3 & 14)');
const t4 = tube(4.0), t3 = tube(3.2);
T.ok(Math.abs(t4.A - 556.69) < 0.01 && Math.abs(t4.i - 15.73) < 0.005 && Math.abs(t4.m - 4.37) < 0.005, `48,3×4,0: A ${t4.A.toFixed(2)} mm², i ${t4.i.toFixed(3)} mm, ${t4.m.toFixed(3)} kg/m`);
T.ok(Math.abs(t3.A - 453.39) < 0.01 && Math.abs(t3.m - 3.56) < 0.005, `48,3×3,2: A ${t3.A.toFixed(2)} mm², ${t3.m.toFixed(3)} kg/m`);
T.ok(Math.abs(t4.Wpl * FY / K / 1e6 - 1.12) < 0.005, `M_pl/1,65 pipa 4,0 = ${(t4.Wpl * FY / K / 1e6).toFixed(3)} kNm = TG20:21 Tabel 5.9 "Moment Capacity 1.12 kN.m" (PSD hlm. 3)`);
const TG20 = { 1.2: 51.9, 1.4: 45.3, 1.6: 39.2, 1.8: 33.7, 2.0: 29.1, 2.2: 25.3, 2.4: 22.0, 2.6: 19.3, 2.8: 17.1, 3.0: 15.2, 3.2: 13.6 };
const devC = Object.entries(TG20).map(([le, pc]) => { const n = prCapacity(4.0, +le, 0.49).Nperm; return { le: +le, tg20: pc, c: +n.toFixed(2), dev: +((n / pc - 1) * 100).toFixed(2) }; });
T.ok(devC.every(x => x.dev <= 0.05 && x.dev > -0.6), 'kurva c ÷ 1,65 vs 11 nilai Tabel 5.10 TG20:21: selisih 0 … −0,5 %', devC);
const c25 = prCapacity(4.0, 2.5, 0.49).Nperm;
T.ok(Math.abs(c25 - 20.58) < 0.01, `L_e 2,5 m: kurva c = ${c25.toFixed(2)} kN (aplikasi/dokumen 20,58 kN)`);
if (c25 > 20.53) finding('low', `Klaim "tidak pernah di atas TG20" tidak berlaku di antara titik tabel: L_e 2,5 m → ${c25.toFixed(2)} kN > 20,53 kN (TG20:21, dikutip PSD hlm. 14), +${((c25 / 20.53 - 1) * 100).toFixed(2)} %`);
const devA = Object.entries(TG20).sort((a, b) => a[0] - b[0]).map(([le, pc]) => le + ' m ' + ((prCapacity(4.0, +le, 0.21).Nperm / pc - 1) * 100).toFixed(1));
T.ok(true, `kurva a vs TG20 (%): ${devA.join(' / ')} (dokumen: "±20 %")`);
const ref20 = prCapacity(4.0, 2.0);
T.ok(Math.abs(ref20.chi - 0.3667) < 0.0001 && Math.abs(ref20.Nperm - 29.08) < 0.005, `χ 2,0 m = ${ref20.chi.toFixed(4)}, N_izin ${ref20.Nperm.toFixed(3)} kN (${(ref20.Nperm * 1000 / g).toFixed(0)} kg)`);
const sens = { '4c2.5': prCapacity(4, 2.5).Nperm, '4c2.7': prCapacity(4, 2.7).Nperm, '4a2.0': prCapacity(4, 2, 0.21).Nperm, '4a2.5': prCapacity(4, 2.5, 0.21).Nperm, '4a2.7': prCapacity(4, 2.7, 0.21).Nperm, '3c2.0': prCapacity(3.2, 2).Nperm, '3c2.5': prCapacity(3.2, 2.5).Nperm, '3c2.7': prCapacity(3.2, 2.7).Nperm, '3a2.0': prCapacity(3.2, 2, 0.21).Nperm, '3a2.5': prCapacity(3.2, 2.5, 0.21).Nperm, '3a2.7': prCapacity(3.2, 2.7, 0.21).Nperm };
const docSens = { '4c2.5': 20.58, '4c2.7': 18.12, '4a2.0': 34.97, '4a2.5': 23.92, '4a2.7': 20.83, '3c2.0': 24.25, '3c2.5': 17.21, '3c2.7': 15.16, '3a2.0': 29.23, '3a2.5': 20.06, '3a2.7': 17.48 };
const sensBad = Object.keys(docSens).filter(k => Math.abs(sens[k] - docSens[k]) > 0.006);
T.ok(sensBad.length === 0, 'tabel sensitivitas §5 KOREKSI-PERHITUNGAN (11 sel) direproduksi ±0,005 kN', sensBad.map(k => [k, sens[k].toFixed(3), docSens[k]]));

T.section('A2 Kasus acuan — enumerasi batang → simpul');
const REFC = { nb: 3, L: 2.4, B: 1.2, h: 2.0, nl: 4, nbd: 2, nwork: 1, t: 4.0, q: qOf(4.4) };
const NL = nodeLoads(REFC);
const pos = { 'tengah-luar': NL.nodes['1o'], 'tengah-dalam': NL.nodes['1i'], 'ujung-luar': NL.nodes['0o'], 'ujung-dalam': NL.nodes['0i'] };
T.ok(Math.abs(NL.max.N - 480.81) < 0.01 && NL.max.k === '1o', `N maks ${NL.max.N.toFixed(2)} kg di tiang tengah sisi luar (dokumen 480,81)`);
T.ok(Math.abs(pos['tengah-dalam'].N - 424.06) < 0.01 && Math.abs(pos['ujung-luar'].N - 285.24) < 0.01 && Math.abs(pos['ujung-dalam'].N - 254.47) < 0.01, `posisi lain ${pos['tengah-dalam'].N.toFixed(2)} / ${pos['ujung-luar'].N.toFixed(2)} / ${pos['ujung-dalam'].N.toFixed(2)} kg`);
T.ok(Math.abs(NL.avg - 361.14) < 0.01 && Math.abs(NL.max.N / NL.avg - 1.331) < 0.001, `rata-rata ${NL.avg.toFixed(2)} kg → ${(NL.max.N / NL.avg * 100).toFixed(1)} %`);
const util = NL.max.N * g / 1000 / ref20.Nperm;
T.ok(Math.abs(util - 0.162) < 0.001, `rasio tiang ${util.toFixed(3)}`);
const CR = couplerReaction(REFC);
T.ok(Math.abs(CR.kg - 269.08) < 0.01 && Math.abs(CR.kN - 2.639) < 0.001, `reaksi klem ${CR.kg.toFixed(2)} kg = ${CR.kN.toFixed(3)} kN; rasio ${(CR.kN / (10 / K)).toFixed(3)}`);
T.ok(Math.abs(NL.max.N / 0.04 - 12020) < 1, `pondasi ${(NL.max.N / 0.04).toFixed(0)} kg/m²`);
const ME = materialEstimate(REFC);
T.ok(ME.rows === 13 && ME.pcs === 228 && Math.abs(ME.kg - 1626) < 0.05, `estimasi material: ${ME.rows} komponen, ${ME.pcs} pcs, ${ME.kg.toFixed(1)} kg`);
// suspended & mobile (dokumen §9)
const liveTot = REFC.q * REFC.nb * REFC.nwork, Tsus = (ME.kg + liveTot) / 2;
T.ok(Math.abs(Tsus - 1486.0) < 0.1 && Math.ceil(3 * Tsus * 0.9 / (3.6 * 25)) === 45, `suspended T ${Tsus.toFixed(1)} kg (${(Tsus * g / 1000).toFixed(2)} kN), CW ${Math.ceil(3 * Tsus * 0.9 / (3.6 * 25))}`);
// v2.2.0 data: material bawaan lama 393 kg (8 komponen) tetap dimuat
const T393 = (393 + liveTot) / 2;
finding('high', `Data v2.2.0 menyimpan 8 komponen material bawaan (393 kg); setelah migrasi suspended T = ${T393.toFixed(1)} kg (${(T393 * g / 1000).toFixed(2)} kN ≤ 10 kN → MEMENUHI), padahal estimasi geometri memberi ${Tsus.toFixed(1)} kg (${(Tsus * g / 1000).toFixed(2)} kN > 10 kN → CEK)`);
// EN 12811-1 §6.2.9.2 a)3): 50 % beban layan pada level berpapan berikutnya
if (REFC.nbd > REFC.nwork) {
  const extra = 0.5 * REFC.q / 2;                      // tiang tengah: ½ lebar × 1 bay × 50 %
  const N2 = NL.max.N + extra;
  finding('medium', `BS EN 12811-1 §6.2.9.2 a)3 (50 % beban layan pada level berpapan berikutnya) tidak diterapkan: kasus acuan N maks ${NL.max.N.toFixed(1)} → ${N2.toFixed(1)} kg (+${(extra / NL.max.N * 100).toFixed(0)} %), pondasi ${(N2 / 0.04).toFixed(0)} kg/m²`);
}

T.section('A3 Skenario B–D (§15) dan lentur transom');
const SC = {
  B: { nb: 3, L: 2.4, B: 1.2, h: 2.7, nl: 5, nbd: 3, nwork: 2, t: 3.2, q: qOf(4.4), doc: { N: 770.4, Np: 15.16, u: 0.50, R: 2.61 } },
  C: { nb: 4, L: 2.4, B: 1.2, h: 2.7, nl: 7, nbd: 7, nwork: 3, t: 3.2, q: qOf(6.6), doc: { N: 1603.4, Np: 15.16, u: 1.04, R: 3.71 } },
  D: { nb: 4, L: 2.4, B: 1.2, h: 2.0, nl: 6, nbd: 4, nwork: 2, t: 4.0, q: qOf(6.6), doc: { N: 1102.3, Np: 29.08, u: 0.37, R: 3.74 } },
};
for (const [k, c] of Object.entries(SC)) {
  const n = nodeLoads(c).max.N, Np = prCapacity(c.t, c.h).Nperm, u = n * g / 1000 / Np, R = couplerReaction(c).kN;
  T.ok(Math.abs(n - c.doc.N) < 0.06 && Math.abs(Np - c.doc.Np) < 0.006 && Math.abs(u - c.doc.u) < 0.006 && Math.abs(R - c.doc.R) < 0.006, `skenario ${k}: N ${n.toFixed(1)} kg, N_izin ${Np.toFixed(2)} kN, rasio ${u.toFixed(3)}, klem ${R.toFixed(2)} kN`, c.doc);
}
const TB = {
  'acuan Medium B1,2 pipa 4,0': transomBending(REFC),
  'Heavy B1,2 pipa 4,0': transomBending({ ...REFC, q: qOf(6.6) }),
  'Heavy B1,2 pipa 3,2': transomBending({ ...REFC, t: 3.2, q: qOf(6.6) }),
  'Heavy B1,5 pipa 4,0': transomBending({ ...REFC, B: 1.5, q: qOf(6.6) }),
  'Special 7,9 kN B1,2 pipa 4,0': transomBending({ ...REFC, q: qOf(7.9) }),
};
for (const [k, v] of Object.entries(TB)) T.ok(true, `lentur transom ${k}: M ${v.M.toFixed(3)} kNm vs ${v.Mcap.toFixed(3)} kNm → rasio ${v.ratio.toFixed(2)}`);

T.section('A4 Tahap 2 (E4) — batas kelas dalam kg vs kN');
for (const kg of [100, 101, 102, 150, 152, 200, 203]) {
  const kN = kg * g / 1000;
  const app = kN <= 1.0 ? 'Light' : kN <= 1.5 ? 'Medium' : kN <= 2.0 ? 'Heavy' : 'Special';
  const src = kg <= 100 ? 'Light' : kg <= 150 ? 'Medium' : kg <= 200 ? 'Heavy' : 'Special';
  T.ok(true, `benda tunggal ${kg} kg (${kN.toFixed(3)} kN): aplikasi → ${app}; batas sumber (100/150/200 kg) → ${src}`);
  if (app !== src) finding('low', `Batas beban terpusat dibulatkan ke 1,0/1,5/2,0 kN: ${kg} kg (${kN.toFixed(2)} kN) diklasifikasikan ${app}, padahal batas sumber 100/150/200 kg memberi ${src}`);
}

/* ======================================================================
   B. APLIKASI DI PERAMBAN — nilai dibaca dari teks layar
   ====================================================================== */
if (BROWSER) {
  const { server, BASE } = await startServer();
  const browser = await launch();
  const PR = `${BASE}/aplikasi/perencanaan/index.html`;
  async function open(seedFn, seedArg) {
    const ctx = await newContext(browser, 'desktop');
    await seedSession(ctx, {});
    if (seedFn) await ctx.addInitScript(seedFn, seedArg);
    const page = await ctx.newPage();
    const issues = watch(page);
    await page.goto(PR, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'), null, { timeout: 30000 });
    return { ctx, page, issues };
  }
  const setF = (page, o) => page.evaluate((o) => { for (const [id, v] of Object.entries(o)) { const e = document.getElementById(id); e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); } }, o);
  const txt = (page, sel) => page.$eval(sel, el => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');
  const goV = (page, v) => page.evaluate(v => go(v), v);

  if (!B_ON) {
    T.section('B (dilewati) — aplikasi v' + APP_VER + ': bagian B menguji v2.3.0; diganti aplikasi-perencanaan-temuan.mjs + aplikasi-perencanaan-koreksi.mjs (jalankan dengan --b untuk memaksa)');
  } else {
  T.section('B1 Kasus acuan di layar (desktop)');
  {
    const { ctx, page, issues } = await open();
    await setF(page, { 'f-lift': 4 });
    await goV(page, 'material');
    const mat = await txt(page, '#mat-stats');
    T.ok(/13/.test(mat) && mat.includes('228') && mat.includes(nfi(ME.kg) + ' kg'), `Tahap 5 menampilkan 13 komponen, 228 pcs, ${nfi(ME.kg)} kg`, mat);
    await goV(page, 'analisis');
    const cap = await txt(page, '#fx-cap'), kl = await txt(page, '#fx-klem'), chk = await txt(page, '#an-checks'), verdict = await txt(page, '#an-verdict');
    for (const [k, p] of Object.entries(pos)) T.ok(cap.includes(nfi(p.N) + ' kg · ' + nfi(p.N * g / 1000, 2) + ' kN'), `kartu ${k}: ${nfi(p.N)} kg · ${nfi(p.N * g / 1000, 2)} kN`);
    T.ok(cap.includes('χ = ' + nfi(ref20.chi, 3)) && cap.includes(nfi(ref20.Nperm, 2) + ' kN') && cap.includes('rasio ' + nfi(util, 2)), `tekuk χ ${nfi(ref20.chi, 3)}, N_izin ${nfi(ref20.Nperm, 2)} kN, rasio ${nfi(util, 2)}`);
    T.ok(kl.includes(nfi(CR.kN, 2) + ' kN') && kl.includes('6,06 kN') && kl.includes('rasio ' + nfi(CR.kN / (10 / K), 2)), `klem ${nfi(CR.kN, 2)} kN vs 6,06 kN`, kl.slice(-200));
    T.ok(cap.includes(nfi(NL.max.N / 0.04) + ' kg/m²'), `pondasi ${nfi(NL.max.N / 0.04)} kg/m²`);
    T.ok(/PERLU REVIEW/.test(verdict), 'kasus acuan → PERLU REVIEW (pondasi & H ≤ 3B)', verdict);
    const hb = chk.match(/Tinggi [\d,]+ m > 3 × lebar dasar terkecil/);
    if (hb) finding('low', 'Model independent: pemeriksaan "H ≤ 3 × B_min" (kaidah perancah tanpa ikatan) selalu CEK untuk perancah berikat > 3,6 m, sehingga LOLOS praktis hanya tercapai untuk perancah ≤ 3 × lebar; tidak ada isian "perancah diikat (tie)"');
    T.ok(issues.length === 0, 'B1 tanpa galat konsol', issues);
    await ctx.close();
  }

  T.section('B2 LOLOS PEMERIKSAAN INDIKATIF padahal lentur transom melampaui kapasitas');
  {
    const { ctx, page } = await open();
    const c = { nb: 3, L: 2.4, B: 1.5, h: 2.0, nl: 2, nbd: 1, nwork: 1, t: 4.0, q: qOf(6.6) };
    await setF(page, { 'f-nbay': 3, 'f-lbay': 2.4, 'f-lebar': 1.5, 'f-hlift': 2.0, 'f-lift': 2, 'f-tinggi': '', 'f-papan': 1, 'f-pipa': '4.0', 'an-kelas': '6.6', 'an-lantai': 1, 'an-ptpapan': '2.0', 'an-plate': '0.1' });
    await goV(page, 'analisis');
    const verdict = await txt(page, '#an-verdict'), chk = await txt(page, '#an-checks');
    const tb = transomBending(c);
    T.ok(/LOLOS PEMERIKSAAN INDIKATIF/.test(verdict), `aplikasi: "${verdict.slice(0, 60)}…" (Heavy, lebar 1,5 m, pipa 4,0, 2 lift)`, chk.slice(0, 300));
    if (/LOLOS PEMERIKSAAN INDIKATIF/.test(verdict) && tb.ratio > 1) finding('medium', `Aplikasi menyatakan LOLOS PEMERIKSAAN INDIKATIF ("KEKUATAN ✓ terpenuhi") padahal transom pada simpul memikul 1 bay Heavy: M = ${tb.M.toFixed(2)} kNm > ${tb.Mcap.toFixed(2)} kNm (TG20:21 Tabel 5.9), rasio ${tb.ratio.toFixed(2)} — lentur transom/ledger tidak diperiksa`);
    // pipa 3,2
    await setF(page, { 'f-pipa': '3.2', 'f-lebar': 1.2 });
    await goV(page, 'analisis');
    const v2 = await txt(page, '#an-verdict'), tb2 = transomBending({ ...c, B: 1.2, t: 3.2 });
    T.ok(true, `Heavy, lebar 1,2 m, pipa 3,2: aplikasi "${v2.slice(0, 40)}…"; lentur transom ${tb2.M.toFixed(2)}/${tb2.Mcap.toFixed(2)} kNm = ${tb2.ratio.toFixed(2)}`);
    if (/LOLOS/.test(v2) && tb2.ratio > 1) finding('medium', `Heavy, lebar 1,2 m, pipa 3,2 mm, 2 lift: LOLOS di aplikasi, lentur transom rasio ${tb2.ratio.toFixed(2)}`);
    await ctx.close();
  }

  T.section('B3 Special Duty karena beban terpusat → papan diperiksa terhadap 2,0 kN, bukan beban sebenarnya');
  {
    const { ctx, page } = await open();
    await goV(page, 'beban');
    await setF(page, { 'll-pt': 300 });
    const st = await txt(page, '#ll-status');
    T.ok(/SPECIAL DUTY/.test(st) && /ditentukan oleh beban terpusat/.test(st), `Tahap 2: 300 kg (${(300 * g / 1000).toFixed(2)} kN) → Special`, st);
    await page.click('#v-beban button:has-text("Terapkan Kelas Duty")');
    await setF(page, { 'an-ptpapan': '2.0' });
    await goV(page, 'duty');
    const plt = await txt(page, '#an-checks-sta');
    const m = plt.match(/Beban terpusat kelas ([\d,]+) kN (≤|>) kapasitas beban terpusat papan ([\d,]+) kN/);
    T.ok(!!m, 'baris pemeriksaan beban terpusat terbaca', plt.slice(0, 300));
    if (m && m[2] === '≤') finding('medium', `Beban terpusat 300 kg (${(300 * g / 1000).toFixed(2)} kN) menjadikan kelas Special, tetapi Tahap 3 memeriksa papan dengan ${m[1]} kN (nilai tetap dutyInfo().pt untuk Special) → papan 2,0 kN dinyatakan OK walaupun beban terpusat sebenarnya ${(300 * g / 1000).toFixed(2)} kN`);
    await ctx.close();
  }

  T.section('B4 Rekomendasi Tahap 2 tidak ditegakkan pada analisis');
  {
    const { ctx, page } = await open();
    await goV(page, 'beban');
    await setF(page, { 'll-org': 4, 'll-mat': 300 });
    const st = await txt(page, '#ll-status');
    await setF(page, { 'f-lift': 1, 'f-hlift': 2.0, 'f-tinggi': '', 'f-papan': 1, 'an-ptpapan': '2.0', 'an-plate': '0.1' });
    await goV(page, 'analisis');
    const verdict = await txt(page, '#an-verdict');
    const kes = await page.evaluate(() => kesimpulanText());
    T.ok(/SPECIAL DUTY/.test(st), 'Tahap 2 merekomendasikan Special Duty 7,9 kN', st);
    if (/LOLOS/.test(verdict)) finding('medium', 'Tahap 2 merekomendasikan Special Duty (797,5 kg/bay) tetapi, tanpa menekan "Terapkan", Tahap 3/6 tetap memakai Medium 4,4 kN dan menyatakan LOLOS PEMERIKSAAN INDIKATIF; tidak ada pemeriksaan CEK "kelas dipilih < rekomendasi Tahap 2"', { kesimpulan: kes.slice(0, 260) });
    await ctx.close();
  }

  T.section('B5 Migrasi data v2.2.0 (8 komponen material bawaan, 393 kg) — model suspended');
  {
    const MAT_V22 = [['Standard / tiang (3 m)', 6, 12], ['Ledger (2,5 m)', 8, 10], ['Transom (1,2 m)', 6, 5], ['Bracing (±3 m)', 4, 12], ['Coupler / klem', 40, 1.2], ['Base plate / jack base', 6, 2.5], ['Papan / plank', 5, 16], ['Toe board', 4, 5]].map(r => ({ n: r[0], q: r[1], w: r[2] }));
    const legacy = { v: 2, answers: {}, fields: { 'f-proyek': 'Proyek v2.2', 'f-nbay': '3', 'f-lbay': '2.4', 'f-lebar': '1.2', 'f-hlift': '2.0', 'f-lift': '4', 'f-model': 'suspended' },
      analisis: { vals: { 'an-kelas': '4.4', 'an-bay': '3', 'an-lantai': '1', 'an-fk': '1.5', 'an-tiang': '6', 'an-kaptiang': '2500', 'an-nrope': '2', 'an-ftali': '6', 'an-mbl': '60', 'an-klemcls': '6.3', 'an-nklem': '8', 'll-sf': '1.5' }, mats: MAT_V22 }, ts: 1 };
    const key = 'ppapi_app_perencanaan_v1_u_' + DEMO_USER.uid;
    const { ctx, page } = await open((a) => { if (!sessionStorage.getItem('__s')) { sessionStorage.setItem('__s', '1'); localStorage.setItem(a.key, JSON.stringify(a.d)); } }, { key, d: legacy });
    await goV(page, 'duty');
    const sta = await txt(page, '#an-checks-sta');
    await goV(page, 'analisis');
    const cap = await txt(page, '#fx-cap');
    const mT = cap.match(/Tarik per tali ([\d.]+) kg \(([\d,]+) kN\)/);
    T.ok(!!mT, 'tarik tali terbaca', cap.slice(0, 200));
    const shown = mT ? parseFloat(mT[1].replace(/\./g, '')) : NaN;
    T.ok(Math.abs(shown - Math.round(T393)) <= 1, `aplikasi memakai material lama: T = ${mT && mT[1]} kg (perhitungan: ${T393.toFixed(1)} kg); dengan estimasi geometri seharusnya ${Tsus.toFixed(1)} kg`);
    T.ok(/TALI MEMENUHI/.test(cap), `status tali: ${(cap.match(/TALI [A-Z ]+/) || [''])[0]}`);
    const note = await page.evaluate(() => document.body.innerText.includes('estimasi lama') || document.body.innerText.includes('material lama'));
    T.ok(!note, 'tidak ada pemberitahuan bahwa rincian material berasal dari bawaan v2.2.0', note);
    // model mobile dengan data yang sama
    await setF(page, { 'f-model': 'mobile' });
    await goV(page, 'analisis');
    const capM = await txt(page, '#fx-cap');
    const mC = capM.match(/Beban per castor ([\d.]+) kg vs WLL ([\d.]+) kg/);
    T.ok(!!mC, `mobile (data v2.2.0): ${mC && mC[0]} → ${(capM.match(/CASTOR [A-Z ]+?(?=Beban|$)/) || [''])[0].trim()}; estimasi geometri: ${((ME.kg + liveTot) / 4).toFixed(1)} kg`);
    if (mC && /CASTOR MEMENUHI/.test(capM) && (ME.kg + liveTot) / 4 > 500) finding('high', `Data v2.2.0 (material bawaan 393 kg) + E6 tanpa faktor: castor ${mC[1]} kg ≤ 500 kg → MEMENUHI, padahal estimasi geometri memberi ${((ME.kg + liveTot) / 4).toFixed(1)} kg > 500 kg; v2.2.0 sendiri (×1,5) memberi ${((393 + liveTot) * 1.5 / 4).toFixed(1)} kg → CEK`);
    await ctx.close();
  }

  T.section('B6 Material Tahap 5 tidak mengikuti perubahan geometri (klaim E2 "satu sumber data")');
  {
    const { ctx, page } = await open();
    await setF(page, { 'f-model': 'suspended', 'f-nbay': 6, 'f-lift': 8 });
    await goV(page, 'material');
    const mat = await txt(page, '#mat-stats');
    const c = { nb: 6, L: 2.4, B: 1.2, h: 2.0, nl: 8, nbd: 2, nwork: 1, t: 4.0, q: qOf(4.4) };
    const me = materialEstimate(c);
    T.ok(true, `setelah geometri diubah ke 6 bay × 8 lift, Tahap 5 menampilkan "${mat}"; estimasi geometri baru = ${me.kg.toFixed(0)} kg`);
    if (mat.includes(nfi(ME.kg) + ' kg') && Math.abs(me.kg - ME.kg) > 1) finding('medium', `Rincian material (dasar W_d suspended/mobile) tetap ${nfi(ME.kg)} kg setelah geometri diubah ke 6 bay × 8 lift (estimasi geometri ${nfi(me.kg)} kg, −${((1 - ME.kg / me.kg) * 100).toFixed(0)} %) tanpa peringatan; harus menekan "Estimasi Otomatis" secara manual`);
    await ctx.close();
  }

  T.section('B7 Tag "AMAN DIGUNAKAN / SAFE FOR USE" tidak memperhatikan hasil analisis struktur');
  {
    const { ctx, page } = await open();
    const c = SC.C;
    await setF(page, { 'f-nbay': c.nb, 'f-lift': c.nl, 'f-hlift': c.h, 'f-papan': c.nbd, 'f-pipa': '3.2', 'an-lantai': c.nwork, 'an-kelas': '6.6' });
    await page.evaluate(() => { go('checklist'); bulk('ok'); });
    await goV(page, 'analisis');
    const cap = await txt(page, '#fx-cap');
    await goV(page, 'laporan');
    const tag = await txt(page, '#tag-preview');
    T.ok(/TIANG TIDAK MEMENUHI/.test(cap), 'skenario C: TIANG TIDAK MEMENUHI (rasio 1,04)');
    if (/TIANG TIDAK MEMENUHI/.test(cap) && /AMAN DIGUNAKAN/.test(tag) && /SAFE FOR USE/.test(tag)) finding('medium', 'Skenario C: analisis menyatakan TIANG TIDAK MEMENUHI (rasio 1,04), tetapi scaffold tag tetap "AMAN DIGUNAKAN · SAFE FOR USE · Heavy Duty 6,6 kN/bay" (tag hanya membaca checklist; pita Beta disembunyikan saat tag dicetak)', { tag: tag.slice(0, 160) });
    // kurva a membalik hasil skenario C
    await setF(page, { 'an-kurva': 'a' });
    await goV(page, 'analisis');
    const capA = await txt(page, '#fx-cap');
    if (/TIANG MEMENUHI/.test(capA) && !/TIDAK MEMENUHI/.test(capA.match(/TIANG [A-Z ]+/)[0])) finding('low', `Skenario C dengan opsi "kurva a" (hanya catatan "perlu persetujuan ahli"): rasio tiang ${(capA.match(/rasio ([\d,]+)/) || [])[1]} → TIANG MEMENUHI; kurva a ${((prCapacity(3.2, 2.7, 0.21).Nperm / prCapacity(3.2, 2.7).Nperm - 1) * 100).toFixed(0)} % di atas kurva c dan 12–23 % di atas TG20:21`);
    await ctx.close();
  }

  T.section('B8 Migrasi v2.2.0: kelas Light hasil rumus rata-rata lama tetap dipakai');
  {
    const legacy = { v: 2, answers: {}, fields: { 'f-proyek': 'Proyek v2.2 Light', 'f-nbay': '3', 'f-lift': '4' },
      analisis: { vals: { 'an-kelas': '2.2', 'an-lantai': '1', 'll-org': '2', 'll-worg': '90', 'll-eq': '50', 'll-mat': '150', 'll-imp': '25', 'll-sf': '1.5' }, mats: [] }, ts: 1 };
    const key = 'ppapi_app_perencanaan_v1_u_' + DEMO_USER.uid;
    const { ctx, page } = await open((a) => { if (!sessionStorage.getItem('__s')) { sessionStorage.setItem('__s', '1'); localStorage.setItem(a.key, JSON.stringify(a.d)); } }, { key, d: legacy });
    await goV(page, 'beban');
    const st = await txt(page, '#ll-status');
    await goV(page, 'duty');
    const ds = await txt(page, '#duty-stats'), sta = await txt(page, '#an-checks-sta');
    T.ok(/MEDIUM DUTY/.test(st), 'Tahap 2 (terkoreksi) untuk isian lama: Medium', st.slice(0, 120));
    if (/MEDIUM DUTY/.test(st) && /Light Duty/.test(ds) && !/Tahap 2/.test(sta)) finding('medium', 'Proyek v2.2.0 yang dahulu menerapkan "Light" (645 kg ÷ 3 bay = 215 kg) tetap Light setelah migrasi; Tahap 2 terkoreksi kini merekomendasikan Medium (430 kg) tetapi Tahap 3/6, tag, dan PDF memakai Light tanpa tanda CEK');
    await ctx.close();
  }

  }   /* akhir bagian B (B_ON) */

  /* ==================================================================
     C. SIMULATOR — ukuran dari adegan (kotak batas dunia), urutan, dan tumpuan tangga
     ================================================================== */
  T.section('C Simulator: ukur adegan setelah 20 tahap');
  {
    const ctx = await newContext(browser, 'desktop');
    await seedSession(ctx, {});
    const page = await ctx.newPage();
    const issues = watch(page);
    await page.goto(`${BASE}/aplikasi/simulator/index.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'), null, { timeout: 30000 });
    await page.click('#startBtn');
    await page.waitForFunction(() => window.PPAPISim && document.querySelector('#app-main canvas'), null, { timeout: 30000 });
    await page.click('#tab-build');
    const MEASURE = () => {
      const S = window.PPAPISim.scene, TH = window.THREE; S.updateMatrixWorld(true);
      const vis = o => { for (let p = o; p && p !== S; p = p.parent) if (!p.visible) return false; return true; };
      const all = []; S.traverse(o => { if (o.isMesh && vis(o) && !(o.material && o.material.transparent && o.material.opacity < 0.6)) all.push(o); });
      const roleOf = o => { for (let p = o; p && p !== S; p = p.parent) if (p.userData && p.userData.role) return p.userData.role; return ''; };
      const bx = o => new TH.Box3().setFromObject(o);
      const items = all.map(o => ({ r: roleOf(o), b: bx(o) }));
      const boards = items.filter(i => i.r === 'board');
      const decks = [...new Set(boards.map(i => Math.round(i.b.max.y * 1000) / 1000))].sort((a, b) => a - b);
      const out = { decks: [] };
      decks.forEach(T0 => {
        const db = boards.filter(i => Math.abs(i.b.max.y - T0) < 0.002);
        const x0 = Math.min(...db.map(i => i.b.min.x)), x1 = Math.max(...db.map(i => i.b.max.x)), z0 = Math.min(...db.map(i => i.b.min.z)), z1 = Math.max(...db.map(i => i.b.max.z));
        // keliling lantai: sampel setiap 5 cm; cari top rail/mid rail/toe board (termasuk pintu) yang menutupi titik itu
        const H = (r, lo, hi) => items.filter(i => r.includes(i.r) && i.b.max.y > T0 + lo && i.b.min.y < T0 + hi);
        const tops = H(['rail-top', 'gate-top'], 0.8, 1.3), mids = H(['rail-mid', 'gate-mid'], 0.3, 0.8), toes = H(['toeboard', 'gate-kick'], -0.01, 0.4);
        const pts = []; const st = 0.05;
        for (let x = x0; x <= x1 + 1e-9; x += st) { pts.push([x, z0 - 0.04, 'z-']); pts.push([x, z1 + 0.04, 'z+']); }
        for (let z = z0; z <= z1 + 1e-9; z += st) { pts.push([x0 - 0.04, z, 'x-']); pts.push([x1 + 0.04, z, 'x+']); }
        const cover = (set, x, z, side) => set.filter(i => (side[0] === 'z' ? (x >= i.b.min.x - 0.03 && x <= i.b.max.x + 0.03 && Math.abs((i.b.min.z + i.b.max.z) / 2 - z) < 0.12) : (z >= i.b.min.z - 0.03 && z <= i.b.max.z + 0.03 && Math.abs((i.b.min.x + i.b.max.x) / 2 - x) < 0.12)));
        let gapTop = [], gapMid = [], gapToe = [], railTop = [], gapClear = [];
        pts.forEach(([x, z, s]) => {
          const t = cover(tops, x, z, s), m = cover(mids, x, z, s), e = cover(toes, x, z, s);
          if (!t.length) gapTop.push([+x.toFixed(2), +z.toFixed(2)]); if (!m.length) gapMid.push([+x.toFixed(2), +z.toFixed(2)]); if (!e.length) gapToe.push([+x.toFixed(2), +z.toFixed(2)]);
          if (t.length) railTop.push(Math.max(...t.map(i => i.b.max.y)) - T0);
          if (t.length && m.length && e.length) {
            const toeTop = Math.max(...e.map(i => i.b.max.y)) - T0, midBot = Math.min(...m.map(i => i.b.min.y)) - T0, midTop = Math.max(...m.map(i => i.b.max.y)) - T0, topBot = Math.min(...t.map(i => i.b.min.y)) - T0;
            gapClear.push(Math.max(midBot - toeTop, topBot - midTop));
            if (!out.toeH) out.toeH = []; out.toeH.push(toeTop);
          }
        });
        out.decks.push({ T0, x0, x1, z0, z1, nPts: pts.length, gapTop: gapTop.length, gapMid: gapMid.length, gapToe: gapToe.length, gapTopEx: gapTop.slice(0, 3),
          railMin: Math.min(...railTop), railMax: Math.max(...railTop), clearMax: Math.max(...gapClear), toeMin: Math.min(...out.toeH) });
      });
      // tumpuan atas tangga: titik ikat 'ladder-tie' tertinggi → benda non-tangga terdekat (kotak batas)
      const lad = items.filter(i => /^ladder/.test(i.r));
      const topTie = items.filter(i => i.r === 'ladder-tie').sort((a, b) => b.b.max.y - a.b.max.y).slice(0, 2);
      const others = items.filter(i => !/^ladder|^tag|^barrier|^inspector/.test(i.r) && i.r !== '');
      const dist = (b, c) => { const p = new TH.Vector3(); b.getCenter(p); return c.b.distanceToPoint(p); };
      out.ladderTop = topTie.map(t => { let best = null; others.forEach(o => { const d = dist(t.b, o); if (!best || d < best.d) best = { d, r: o.r }; }); const c = new TH.Vector3(); t.b.getCenter(c); return { at: [+c.x.toFixed(3), +c.y.toFixed(3), +c.z.toFixed(3)], nearest: best.r, d: +best.d.toFixed(3) }; });
      // rail-top yang melewati x tangga pada sisi akses
      const xs = lad.filter(i => i.r === 'ladder-rail').map(i => (i.b.min.x + i.b.max.x) / 2);
      out.railAtLadder = items.filter(i => i.r === 'rail-top' && i.b.min.y > 4.5 && i.b.max.z > 0.55 && i.b.min.x <= Math.min(...xs) && i.b.max.x >= Math.max(...xs)).length;
      out.ladderX = xs.map(v => +v.toFixed(3));
      return out;
    };
    for (let i = 0; i < 20; i++) { await page.click('#placeBtn'); await page.waitForTimeout(40); }
    const M = await page.evaluate(MEASURE);
    T.ok(M.decks.length === 2, `dua lantai berpapan: ${M.decks.map(d => d.T0.toFixed(3)).join(' & ')} m`);
    M.decks.forEach(d => {
      T.ok(d.gapTop === 0 && d.gapMid === 0 && d.gapToe === 0, `lantai +${d.T0.toFixed(3)}: keliling ${d.nPts} titik sampel — top rail, mid rail, toe board menerus (celah: ${d.gapTop}/${d.gapMid}/${d.gapToe})`, d.gapTopEx);
      T.ok(d.railMin >= 0.95 && d.railMin >= 0.999 && d.railMax <= 1.143, `lantai +${d.T0.toFixed(3)}: permukaan atas top rail ${d.railMin.toFixed(3)}–${d.railMax.toFixed(3)} m (Permenaker 9/2016 Ps. 24a ≥ 950 mm; EN 12811-1 5.5.2 ≥ 1 m; OSHA ≤ 45 in)`);
      T.ok(d.clearMax <= 0.47, `lantai +${d.T0.toFixed(3)}: celah bersih vertikal maks ${d.clearMax.toFixed(3)} m (≤ 470 mm, Ps. 24c / EN 5.5.3)`);
      T.ok(d.toeMin >= 0.15 - 1e-6, `lantai +${d.T0.toFixed(3)}: toe board min ${(d.toeMin * 1000).toFixed(0)} mm (≥ 150 mm, EN 5.5.4)`);
    });
    T.ok(true, `tangga: x rel ${M.ladderX.join(', ')}; top rail utuh yang melintasi tangga di sisi akses: ${M.railAtLadder}; titik ikat atas → ${JSON.stringify(M.ladderTop)}`);
    if (M.railAtLadder === 0 && M.ladderTop.every(t => t.nearest !== 'rail-top' || t.d > 0.03)) finding('medium', `Simulator: ujung atas tangga "bersandar dan diikat pada top rail", tetapi rail penutup di bukaan akses dilepas pada tahap 18 (hides: closure); titik ikat atas ${JSON.stringify(M.ladderTop.map(t => t.at))} tidak menempel pada top rail mana pun (benda terdekat: ${M.ladderTop.map(t => t.nearest + ' ' + (t.d * 1000).toFixed(0) + ' mm').join(', ')}); butir inspeksi "Tangga diikat" tetap lulus karena hanya menghitung jumlah objek ikat`);
    T.ok(issues.length === 0, 'simulator tanpa galat konsol', issues.slice(0, 3));
    await ctx.close();
  }

  await browser.close();
  server.close();
}

console.log('\n=== TEMUAN ===');
FINDINGS.forEach((f, i) => console.log(`${i + 1}. [${f.sev}] ${f.title}`));
process.exit(T.done() ? 1 : 0);
