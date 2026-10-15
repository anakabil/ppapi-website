// aplikasi-perencanaan-ref — PERHITUNGAN ACUAN INDEPENDEN untuk koreksi metode PPAPI Scaffold (v2.3.0 → v2.4.0 Beta).
//
// v2.4.0 (tinjauan independen 9 Okt 2026, KOREKSI-PERHITUNGAN §19): + 50 % beban layan pada satu lift berpapan berikutnya
// (BS EN 12811-1:2003 §6.2.9.2 a)3, dibaca dari teks standar), + pagar ujung pada tiang ujung, + transom antara (opsional),
// + lentur transom/ledger (momen izin W_pl·f_y/1,65 = TG20:21 Tabel 5.9), batas beban terpusat kelas dalam kg (100/150/200).
//
// Skrip ini TIDAK memuat atau memanggil kode aplikasi (site/aplikasi/perencanaan/app.js). Rumus ditulis ulang
// dari dokumen sumber dengan struktur yang berbeda:
//   • beban tiang: SETIAP batang (ledger per bay, transom per posisi, papan per bay, pagar per bay, …) dihitung
//     satu per satu lalu reaksinya dibagikan ke titik simpul di ujung-ujungnya (aplikasi memakai rumus tertutup
//     "lebar pengaruh" per posisi tiang);
//   • tekuk: rumus Perry–Robertson dalam bentuk EN 1993-1-1 §6.3.1.2 (Ayrton–Perry) dihitung dari sifat penampang;
//   • nilai "sebelum" memakai rumus aplikasi lama sebagaimana dicatat di devtools/legacy/ANALISIS_PERENCANAAN.md §2.1–2.4.
// Dipakai oleh devtools/flows/aplikasi-perencanaan-koreksi.mjs (nilai harapan) dan site/aplikasi/KOREKSI-PERHITUNGAN.md.
//
// usage (cwd devtools): node flows/aplikasi-perencanaan-ref.mjs        → mencetak laporan kasus acuan
//                       node flows/aplikasi-perencanaan-ref.mjs --json → JSON

/* ---------- konstanta & sumber ---------- */
export const g = 9.80665;                  // m/s², gravitasi standar (konversi kg ↔ kN)
export const RHO = 7850;                   // kg/m³, massa jenis baja
export const E_MPA = 210000;               // N/mm², modulus elastisitas baja (EN 1993-1-1 §3.2.6)
export const GAMMA_F = 1.5;                // BS EN 12811-1:2003 §10.3.2.1 (beban tetap & variabel, ULS)
export const GAMMA_M = 1.1;                // BS EN 12811-1:2003 §10.3.2.2 (tahanan komponen baja)
export const ALPHA = { a: 0.21, c: 0.49 }; // EN 1993-1-1 Tabel 6.1 (kurva tekuk a dan c)
export const COUPLER_FK = { A: 10.0, B: 15.0 }; // kN, gaya gelincir karakteristik klem siku, BS EN 12811-1:2003 Tabel C.1
export const FY_MIN = 235;                 // N/mm², kuat leleh nominal minimum pipa lepas Ø48,3 (BS EN 12811-1:2003 §4.2.1.2)
export const DUTY = { light: 2.2, medium: 4.4, heavy: 6.6 }; // kN per bay per platform (AS/NZS 1576.1, lihat CFMEU Vic.)
export const DUTY_PT = { light: 1.0, medium: 1.5, heavy: 2.0 }; // kN beban terpusat per kelas (pemeriksaan papan/transom; dibulatkan ke atas)
export const DUTY_PT_KG = { light: 100, medium: 150, heavy: 200 }; // kg batas kelas beban terpusat (CFMEU Victoria, Scaffold Guide 2024)
export const TG20_MCAP_48x4 = 1.12;        // kNm, "Moment Capacity" pipa 48,3 × 4,0 (TG20:21 Tabel 5.9, dikutip PSD 9989-1 E hlm. 3)

/* Beban aksial aman pipa 48,3 × 4,0 (BS EN 39 tipe 4, fy 235) menurut NASC TG20:21, sebagaimana dikutip dalam perhitungan
   desain PSD No. 9989-1 E "Scaffold access, Fraser House, Manchester" (30 Juni 2022), hlm. 3:
   https://docs.planning.org.uk/20220921/27/RF9QPMBC0E700/u4qbkc35h6ia08xh.pdf — dipakai untuk VALIDASI, bukan sebagai input. */
export const TG20_PC_48x4 = { 1.2: 51.9, 1.4: 45.3, 1.6: 39.2, 1.8: 33.7, 2.0: 29.1, 2.2: 25.3, 2.4: 22.0, 2.6: 19.3, 2.8: 17.1, 3.0: 15.2, 3.2: 13.6 };
export const TG20_COUPLER = { RA_A: 6.1, RA_B: 9.1, SW_A: 6.1, SW_B: 9.1, SLEEVE_A: 3.6, SLEEVE_B: 5.5 };   // kN, sumber sama

/* asumsi berat komponen — sama dengan estimasi material aplikasi lama (bukan nilai standar) */
export const W_RA = 1.2;        // kg, klem siku (fix clamp)
export const W_SWIVEL = 1.4;    // kg, klem putar
export const W_SLEEVE = 1.1;    // kg, klem sambung
export const W_BOARD_M = 5.2;   // kg per meter per lembar metal plank
export const W_TOE_M = 5 / 2.4; // kg per meter papan kaki (aplikasi lama: 5 kg per lembar 2,4 m)
export const H_GUARD = 1.0;     // m, tiang menjulang di atas platform teratas (pagar pengaman)
export const TRANSOM_EXTRA = 0.2; // m, tambahan panjang transom terhadap lebar perancah (aplikasi lama)
export const STD_MAX_LEN = 6;   // m, panjang pipa maksimum → jumlah sambungan tiang

/* ---------- penampang pipa (dihitung dari D dan t) ---------- */
export function tube(D, t) {
  const d = D - 2 * t;
  const A = Math.PI / 4 * (D * D - d * d);           // mm²
  const I = Math.PI / 64 * (D ** 4 - d ** 4);        // mm⁴
  // modulus plastis pipa bulat: integral |y| dA = (D³ − d³)/6
  const Wpl = (D ** 3 - d ** 3) / 6;
  return { D, t, A, I, i: Math.sqrt(I / A), m: A * 1e-6 * RHO, Wpl, MpermkNm: Wpl * FY_MIN / (GAMMA_M * GAMMA_F) / 1e6 };   // i mm, m kg/m
}

/* ---------- tekuk lentur Perry–Robertson / Ayrton–Perry (EN 1993-1-1 §6.3.1.2) ---------- */
export function bucklingCapacity({ D = 48.3, t = 4.0, fy = FY_MIN, curve = 'c', Le }) {
  const s = tube(D, t);
  const lambda = Le * 1000 / s.i;                          // kelangsingan L_e/i
  const lambda1 = Math.PI * Math.sqrt(E_MPA / fy);         // kelangsingan acuan
  const lb = lambda / lambda1;                             // kelangsingan relatif λ̄
  const alpha = ALPHA[curve];
  const eta = alpha * (lb - 0.2);                          // faktor ketidaksempurnaan Perry (η)
  const Phi = 0.5 * (1 + eta + lb * lb);
  const chi = Math.min(1, 1 / (Phi + Math.sqrt(Phi * Phi - lb * lb)));
  const NbRk = chi * s.A * fy / 1000;                      // kN, tahanan tekuk karakteristik
  const NbRd = NbRk / GAMMA_M;                             // kN, tahanan rencana
  const Nperm = NbRd / GAMMA_F;                            // kN, kapasitas IZIN (dasar tegangan izin)
  // pemeriksaan silang memakai bentuk Perry–Robertson "tegangan": σ_c = [σy+(1+η)σE]/2 − √(…² − σy·σE)
  const sE = Math.PI ** 2 * E_MPA / lambda ** 2;
  const k = (fy + (1 + eta) * sE) / 2;
  const sc = k - Math.sqrt(k * k - fy * sE);
  return { ...s, fy, Le, lambda, lambda1, lb, alpha, eta, Phi, chi, NbRk, NbRd, Nperm, NpermKg: Nperm * 1000 / g, sigmaPR: sc, chiPR: sc / fy };
}

/* ---------- geometri ---------- */
export function geometry({ nb = 3, L = 2.4, B = 1.2, h = 2.0, nl = 4, nbd = 2, nwork = 1, D = 48.3, t = 4.0, ntr = 0 }) {
  const tb = tube(D, t);
  const nbd2 = Math.max(nbd, nwork);
  return { nb, L, B, h, nl, nbd: nbd2, nwork, nlev: nl + 1, Hs: nl * h + H_GUARD, H: nl * h, m: tb.m, tube: tb, ntr,
    halfLevel: nbd2 > nwork,                               // §6.2.9.2 a)3: ada lift berpapan selain platform kerja
    boardsPerBay: Math.max(3, Math.round(B / 0.24)), brace: Math.hypot(L, h) };
}

/* ---------- beban tiang: ENUMERASI BATANG → SIMPUL ---------- */
// kolom: pos 0..nb, sisi 'in' (dalam/bangunan) dan 'out' (luar)
export function standardLoads(cfg) {
  const G = geometry(cfg);
  const qkg = cfg.qkN * 1000 / g;                         // beban kelas per bay per platform (kg)
  const cols = {};
  const key = (i, s) => s + i;
  for (let i = 0; i <= G.nb; i++) for (const s of ['in', 'out']) cols[key(i, s)] = { self: 0, boards: 0, edge: 0, live: 0 };
  const add = (i, s, cat, kg) => { cols[key(i, s)][cat] += kg; };
  // 1. tiang & sambungan tiang
  const joints = Math.max(0, Math.ceil(G.Hs / STD_MAX_LEN) - 1);
  for (const k of Object.keys(cols)) cols[k].self += G.Hs * G.m + joints * W_SLEEVE;
  // 2. setiap level (lift dasar + nl lift): ledger per bay per sisi, transom per posisi, 2 klem siku per simpul
  for (let lv = 0; lv < G.nlev; lv++) {
    for (const s of ['in', 'out']) for (let b = 0; b < G.nb; b++) { const w = G.L * G.m; add(b, s, 'self', w / 2); add(b + 1, s, 'self', w / 2); }
    for (let i = 0; i <= G.nb; i++) { const w = (G.B + TRANSOM_EXTRA) * G.m; add(i, 'in', 'self', w / 2); add(i, 'out', 'self', w / 2); }
    for (let i = 0; i <= G.nb; i++) for (const s of ['in', 'out']) add(i, s, 'self', 2 * W_RA);
  }
  // 3. bracing: dibagi rata ke semua tiang
  const braceKg = 2 * G.nl * G.brace * G.m + (4 * G.nl + 4) * W_SWIVEL;
  const ncol = Object.keys(cols).length;
  for (const k of Object.keys(cols)) cols[k].self += braceKg / ncol;
  // 4. lift berpapan: papan per bay → 4 sudut; pagar + papan kaki di sisi luar
  for (let p = 0; p < G.nbd; p++) {
    for (let b = 0; b < G.nb; b++) {
      const wb = G.boardsPerBay * G.L * W_BOARD_M;
      for (const [i, s] of [[b, 'in'], [b + 1, 'in'], [b, 'out'], [b + 1, 'out']]) add(i, s, 'boards', wb / 4);
      const rail = 2 * G.L * G.m, toe = G.L * W_TOE_M;
      add(b, 'out', 'edge', (rail + toe) / 2); add(b + 1, 'out', 'edge', (rail + toe) / 2);
    }
    for (let i = 0; i <= G.nb; i++) add(i, 'out', 'edge', 2 * W_RA);
    // pagar ujung (v2.4.0): pada kedua ujung, 2 rail (B + 0,2 m) dan papan kaki (B) melintang; ½ ke tiang dalam, ½ ke tiang luar;
    // setiap rail diklem di kedua tiang ujung → 2 klem siku per tiang ujung per lift berpapan
    for (const i of [0, G.nb]) {
      const rails = 2 * (G.B + TRANSOM_EXTRA) * G.m, toe = G.B * W_TOE_M;
      for (const s of ['in', 'out']) add(i, s, 'edge', (rails + toe) / 2 + 2 * W_RA);
    }
    // transom antara (opsional): satu per bay di tengah bentang ledger dalam & luar → ¼ (pipa + 2 klem) ke tiap sudut bay
    if (G.ntr) for (let b = 0; b < G.nb; b++) {
      const wt = (G.B + TRANSOM_EXTRA) * G.m + 2 * W_RA;
      for (const [i, s] of [[b, 'in'], [b + 1, 'in'], [b, 'out'], [b + 1, 'out']]) add(i, s, 'self', wt / 4);
    }
  }
  // 5. beban hidup kelas duty pada setiap platform kerja (seluruh bay dibebani)
  // + 50 % beban layan pada SATU level berpapan berikutnya bila ada (BS EN 12811-1:2003 §6.2.9.2 a)3)
  const levels = [];
  for (let w = 0; w < G.nwork; w++) levels.push(1);
  if (G.halfLevel && cfg.halfRule !== false) levels.push(0.5);
  for (const f of levels) for (let b = 0; b < G.nb; b++)
    for (const [i, s] of [[b, 'in'], [b + 1, 'in'], [b, 'out'], [b + 1, 'out']]) add(i, s, 'live', f * qkg / 4);
  const list = Object.entries(cols).map(([k, c]) => ({ k, ...c, N: c.self + c.boards + c.edge + c.live }));
  const max = list.reduce((a, b) => (b.N > a.N ? b : a));
  const sum = list.reduce((a, c) => a + c.N, 0);
  // reaksi klem siku ledger–tiang terbesar pada satu level platform kerja (papan + beban hidup + ledger + ½ transom)
  let R = 0;
  for (let i = 0; i <= G.nb; i++) for (const s of ['in', 'out']) {
    let r = 0;
    for (const b of [i - 1, i]) if (b >= 0 && b < G.nb) r += (qkg + G.boardsPerBay * G.L * W_BOARD_M) / 4 + G.L * G.m / 2;
    r += (G.B + TRANSOM_EXTRA) * G.m / 2;
    R = Math.max(R, r);
  }
  return { G, qkg, cols, list, max, sum, avg: sum / list.length, braceKg, joints, couplerKg: R, couplerKN: R * g / 1000, levels };
}

/* ---------- lentur transom & ledger (v2.4.0) ----------
   Balok sederhana; momen di tengah bentang dihitung dari reaksi tumpuan (bukan rumus tertutup aplikasi):
   M_tengah = R·(ℓ/2) − w·(ℓ/2)²/2 (bagian merata) dengan R = (w·ℓ + P)/2. Beban kelas AS/NZS memuat satu beban
   terpusat F (CFMEU 2024); F diletakkan pada posisi paling merugikan (BS EN 12811-1:2003 §6.2.2.3). */
function midspanMoment(span, wkNm, PkN) { const R = (wkNm * span + PkN) / 2; return R * span / 2 - wkNm * (span / 2) ** 2 / 2; }
export function memberBendingRef(cfg) {
  const G = geometry(cfg), tb = G.tube;
  const Wq = cfg.qkN, F = cfg.FkN != null ? cfg.FkN : 0;
  const Wb = G.boardsPerBay * G.L * W_BOARD_M * g / 1000, wp = G.m * g / 1000;
  // transom yang ditinjau menerima pias dari bay di kiri/kanannya (fraksi bay): tanpa transom antara, transom di
  // tiang tengah [½, ½]; menara 1 bay [½]; dengan transom antara: transom simpul [¼, ¼] (atau [¼]) dan transom antara [½].
  // F (bagian dari beban kelas SATU bay) diletakkan di tengah bentang transom; bay pemilik F menyumbang (W_q − F) merata.
  const kinds = G.ntr ? [G.nb >= 2 ? [0.25, 0.25] : [0.25], [0.5]] : [G.nb >= 2 ? [0.5, 0.5] : [0.5]];
  let tr = null;
  for (const pias of kinds) {
    for (let host = 0; host < pias.length; host++) {          // coba setiap bay sebagai pemilik F
      let w = 0;
      pias.forEach((fr, j) => { w += fr * ((j === host ? Math.max(0, Wq - F) : Wq) + Wb); });
      const Mudl = midspanMoment(G.B, pias.reduce((a, fr) => a + fr * (Wq + Wb), 0) / G.B + wp, 0);
      const Mpt = midspanMoment(G.B, w / G.B + wp, F);
      const M = Math.max(Mudl, Mpt);
      if (!tr || M > tr.M) tr = { share: pias.reduce((a, b) => a + b, 0), Mudl, Mpt, M, Mcap: tb.MpermkNm };
    }
  }
  tr.ratio = tr.M / tr.Mcap;
  let lg = null;
  if (G.ntr) {
    // transom antara memikul ½ bay merata (sisa kelas + papan); F diletakkan di ujung transom dekat ledger yang ditinjau
    const wMid = 0.5 * (Math.max(0, Wq - F) + Wb), Wt = ((G.B + TRANSOM_EXTRA) * G.m + 2 * W_RA) * g / 1000;
    const P = wMid / 2 + F + Wt / 2;                      // reaksi ke satu ledger, di tengah bentang L
    lg = { P, M: midspanMoment(G.L, wp, P), Mcap: tb.MpermkNm };
    lg.ratio = lg.M / lg.Mcap;
  }
  return { tr, lg, Wq, Wb, F };
}

/* ---------- metode BARU (koreksi) untuk satu kasus ---------- */
export function corrected(cfg) {
  const S = standardLoads(cfg);
  const B = bucklingCapacity({ D: cfg.D || 48.3, t: cfg.t || 4.0, fy: cfg.fy || FY_MIN, curve: cfg.curve || 'c', Le: (cfg.k || 1) * S.G.h });
  const NkN = S.max.N * g / 1000;
  const swl = COUPLER_FK[cfg.couplerClass || 'A'] / (GAMMA_M * GAMMA_F);
  return { S, B, NmaxKg: S.max.N, NmaxKN: NkN, util: NkN / B.Nperm, bearing: S.max.N / (cfg.plate || 0.04),
    coupler: { kg: S.couplerKg, kN: S.couplerKN, swl, util: S.couplerKN / swl } };
}

/* ---------- estimasi material Tahap 5 (spesifikasi v2.3.0, ditulis ulang di sini) ---------- */
export function materialEstimate(cfg) {
  const G = geometry(cfg), r1 = (v) => Math.round(v * 10) / 10, ncol = 2 * (G.nb + 1);
  const joints = Math.max(0, Math.ceil(G.Hs / STD_MAX_LEN) - 1);
  const rows = [
    [ncol, r1(G.Hs * G.m)], [2 * G.nlev, r1(G.nb * G.L * G.m)], [(G.nb + 1) * G.nlev, r1((G.B + TRANSOM_EXTRA) * G.m)],
    [2 * G.nl, r1(G.brace * G.m)], [G.ntr * G.nb * G.nbd, r1((G.B + TRANSOM_EXTRA) * G.m)], [2 * G.nbd, r1(G.nb * G.L * G.m)],
    [2 * G.nbd, r1(2 * (G.B + TRANSOM_EXTRA) * G.m + G.B * W_TOE_M)],                          // set pagar ujung per ujung
    [4 * (G.nb + 1) * G.nlev + 2 * (G.nb + 1) * G.nbd + 8 * G.nbd + 2 * G.ntr * G.nb * G.nbd, W_RA], [4 * G.nl + 4, W_SWIVEL], [ncol * joints, W_SLEEVE],
    [ncol, 2.5], [ncol, 4], [G.nb * G.boardsPerBay * G.nbd, r1(W_BOARD_M * G.L)], [G.nb * G.nbd, r1(W_TOE_M * G.L)],
    [Math.max(1, Math.ceil(G.nl / 2)), 15],
  ].filter(r => r[0] > 0);
  return { rows: rows.length, pcs: rows.reduce((a, r) => a + r[0], 0), Wd: Math.round(rows.reduce((a, r) => a + r[0] * r[1], 0) * 10) / 10 };
}
/* beban kerja total TANPA faktor (gross load). Model independent (perancah fasad, bawaan aplikasi): platform kerja
   + 50 % pada satu lift berpapan berikutnya (BS EN 12811-1:2003 §6.2.9.2 a)3). Suspended / mobile: platform kerja saja. */
export function totals(cfg, model = 'independent') {
  const G = geometry(cfg), mat = materialEstimate(cfg);
  const levels = G.nwork + (model === 'independent' && G.halfLevel ? 0.5 : 0);
  const live = cfg.qkN * 1000 / g * G.nb * levels;
  return { Wd: mat.Wd, live, total: mat.Wd + live, levels };
}

/* ---------- tahap 2 (beban hidup) — sebelum & sesudah ---------- */
export function liveLoadLegacy({ org = 2, worg = 90, eq = 50, mat = 150, imp = 25, sf = 1.5, nbay = 3, plat = 1 }) {
  const tot = (org * worg + eq + mat + (eq + mat) * imp / 100) * sf;
  const perBay = tot / (nbay * plat);
  return { tot, perBay, cls: classOfKg(perBay) };
}
export function liveLoadCorrected({ org = 2, worg = 90, eq = 50, mat = 150, imp = 25, ptKg = 0 }) {
  const bay = org * worg + eq + mat + (eq + mat) * imp / 100;   // beban kerja pada SATU bay terberat (tanpa SF)
  const c1 = classOfKg(bay), c2 = classOfPointKg(ptKg);
  const order = ['Light', 'Medium', 'Heavy', 'Special'];
  const cls = order[Math.max(order.indexOf(c1), order.indexOf(c2))];
  const kn = cls === 'Special' ? Math.max(6.6, Math.ceil(bay * g / 100) / 10) : DUTY[cls.toLowerCase()];
  return { bay, byBay: c1, byPoint: c2, cls, kn };
}
function classOfKg(kg) { return kg <= 225 ? 'Light' : kg <= 450 ? 'Medium' : kg <= 675 ? 'Heavy' : 'Special'; }
function classOfPointKg(kg) { return kg <= DUTY_PT_KG.light ? 'Light' : kg <= DUTY_PT_KG.medium ? 'Medium' : kg <= DUTY_PT_KG.heavy ? 'Heavy' : 'Special'; }

/* ---------- metode LAMA (aplikasi v2.2.0) — ANALISIS_PERENCANAAN.md §2.3–2.4 ---------- */
export function legacyMaterial({ nb = 3, L = 2.4, B = 1.2, H = 8, h = 2 }) {
  const kgm = 3.56, r1 = (v) => Math.round(v * 10) / 10;
  const nl = Math.max(1, Math.round((H - 0.3) / h)), nStd = (nb + 1) * 2, joints = Math.max(0, Math.ceil((H + 0.5) / 6) - 1);
  const rows = [
    [nStd, r1((H + 0.5) * kgm)], [2 * nl, r1(nb * L * kgm)], [(nb + 1) * nl, r1((B + 0.2) * kgm)], [2 * nl, r1(Math.hypot(L, h) * kgm)],
    [4, r1(nb * L * kgm)], [nb + 1, r1((B + 0.2) * kgm)], [4 * (nb + 1) * nl + 2 * (nb + 1), 1.2], [4 * nl + 4, 1.4], [nStd * joints, 1.1],
    [nStd, 2.5], [nStd, 4], [nb * Math.max(3, Math.round(B / 0.24)), r1(5.2 * L)], [2 * nb + 2, 5], [Math.max(1, Math.ceil(nl / 2)), 15],
  ].filter(r => r[0] > 0);
  return { nl, rows: rows.length, pcs: rows.reduce((a, r) => a + r[0], 0), Wd: rows.reduce((a, r) => a + r[0] * r[1], 0) };
}
export function legacyAnalysis({ Wd, qkN = 4.4, anBay = 3, plat = 1, fk = 1.5, tiang = 6, kap = 2500, plate = 0.04, nklem = 8 }) {
  const kgBay = qkN * 1000 / g, live = kgBay * anBay * plat, total = Wd + live, fact = total * fk;
  const perT = fact / tiang;
  return { kgBay, live, total, fact, perT, perTkN: perT * g / 1000, util: perT / kap, bearing: perT / plate, klemKN: fact / nklem * g / 1000 };
}

/* ---------- kasus acuan & laporan ---------- */
export const REF = { nb: 3, L: 2.4, B: 1.2, h: 2.0, nl: 4, nbd: 2, nwork: 1, qkN: DUTY.medium, D: 48.3, t: 4.0, curve: 'c', k: 1.0, plate: 0.04, couplerClass: 'A' };

export function report() {
  const after = corrected(REF);
  const lm = legacyMaterial({ nb: REF.nb, L: REF.L, B: REF.B, H: REF.nl * REF.h, h: REF.h });
  const before = legacyAnalysis({ Wd: lm.Wd, qkN: REF.qkN, anBay: REF.nb, tiang: 2 * (REF.nb + 1) });
  const beforeDefault6 = legacyAnalysis({ Wd: lm.Wd, qkN: REF.qkN, anBay: REF.nb, tiang: 6 });
  const sens = [];
  for (const t of [4.0, 3.2]) for (const h of [2.0, 2.5, 2.7]) for (const curve of ['c', 'a']) {
    const b = bucklingCapacity({ t, curve, Le: h });
    sens.push({ t, h, curve, chi: b.chi, Nperm: b.Nperm, NpermKg: b.NpermKg });
  }
  // §2.8 aplikasi lama (pemeriksaan bahwa rumus lama dipahami dengan benar)
  const lm4 = legacyMaterial({ nb: 4, L: 2.4, B: 1.2, H: 8, h: 2 });
  const la4 = legacyAnalysis({ Wd: lm4.Wd, anBay: 3, tiang: 6 });
  const la0 = legacyAnalysis({ Wd: 393, anBay: 3, tiang: 6 });
  return {
    ref: REF, after, legacyMaterial: lm, newMaterial: materialEstimate(REF), totals: totals(REF), before, beforeDefault6, sens,
    live: { before: liveLoadLegacy({}), after: liveLoadCorrected({}) },
    legacyCheck: { default: { Wd: 393, fact: la0.fact, perT: la0.perT, bearing: la0.bearing, klemKN: la0.klemKN }, auto4: { ...lm4, fact: la4.fact, perT: la4.perT, perTkN: la4.perTkN, bearing: la4.bearing, klemKN: la4.klemKN } },
    couplerSWL: { A: COUPLER_FK.A / (GAMMA_M * GAMMA_F), B: COUPLER_FK.B / (GAMMA_M * GAMMA_F) },
  };
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('aplikasi-perencanaan-ref.mjs')) {
  const R = report();
  if (process.argv.includes('--json')) { console.log(JSON.stringify(R, null, 2)); process.exit(0); }
  const f = (v, d = 2) => Number(v).toFixed(d);
  const a = R.after, S = a.S, B = a.B;
  console.log('KASUS ACUAN: 3 bay × 2,4 m, lebar 1,2 m, 4 lift × 2,0 m, 2 lift berpapan, 1 platform kerja, Medium Duty 4,4 kN/bay, pipa 48,3 × 4,0, kurva c\n');
  console.log(`pipa: A=${f(B.A)} mm², I=${f(B.I / 1e4, 3)} cm⁴, i=${f(B.i, 3)} mm, massa=${f(B.m, 4)} kg/m; Hs=${S.G.Hs} m; sambungan/tiang=${S.joints}; bracing total=${f(S.braceKg)} kg`);
  for (const c of S.list) console.log(`  ${c.k.padEnd(5)} self=${f(c.self)} boards=${f(c.boards)} edge=${f(c.edge)} live=${f(c.live)}  N=${f(c.N)} kg (${f(c.N * g / 1000, 3)} kN)`);
  console.log(`N_maks = ${f(a.NmaxKg)} kg = ${f(a.NmaxKN, 3)} kN [${S.max.k}]; rata-rata = ${f(S.avg)} kg; Σ = ${f(S.sum)} kg`);
  console.log(`tekuk: Le=${B.Le} m λ=${f(B.lambda, 2)} λ1=${f(B.lambda1, 2)} λ̄=${f(B.lb, 4)} η=${f(B.eta, 4)} Φ=${f(B.Phi, 4)} χ=${f(B.chi, 4)} (cek PR χ=${f(B.chiPR, 4)}) NbRk=${f(B.NbRk, 3)} kN NbRd=${f(B.NbRd, 3)} kN N_izin=${f(B.Nperm, 3)} kN (${f(B.NpermKg, 1)} kg) rasio=${f(a.util, 3)}`);
  console.log(`pondasi: q=${f(a.bearing, 1)} kg/m² (A=0,04)`);
  console.log(`klem: R=${f(a.coupler.kg, 2)} kg = ${f(a.coupler.kN, 3)} kN; SWL A=${f(R.couplerSWL.A, 3)} B=${f(R.couplerSWL.B, 3)} kN; rasio=${f(a.coupler.util, 3)}`);
  console.log(`material otomatis baru: ${R.newMaterial.rows} komponen, ${R.newMaterial.pcs} pcs, W_d=${f(R.newMaterial.Wd, 1)} kg; gross=${f(R.totals.total, 1)} kg`);
  console.log(`\nSEBELUM (rumus lama): material otomatis lama ${R.legacyMaterial.rows} komponen, ${R.legacyMaterial.pcs} pcs, W_d=${f(R.legacyMaterial.Wd, 1)} kg`);
  const b = R.before;
  console.log(`  live=${f(b.live, 1)} total=${f(b.total, 1)} W*=${f(b.fact, 1)} kg; per tiang (8)=${f(b.perT, 1)} kg (${f(b.perTkN, 2)} kN) vs 2500 → rasio ${f(b.util, 3)}; q=${f(b.bearing, 0)}; klem=${f(b.klemKN, 2)} kN vs 6,3`);
  console.log(`  dengan an-tiang bawaan 6: per tiang ${f(R.beforeDefault6.perT, 1)} kg; q=${f(R.beforeDefault6.bearing, 0)}`);
  console.log(`\nTahap 2: sebelum ${f(R.live.before.tot, 1)} kg /3 bay = ${f(R.live.before.perBay, 1)} → ${R.live.before.cls}; sesudah bay terberat ${f(R.live.after.bay, 1)} kg → ${R.live.after.cls}`);
  console.log('\nsensitivitas N_izin:');
  for (const s of R.sens) console.log(`  t=${s.t} h=${s.h} kurva ${s.curve}: χ=${f(s.chi, 4)} N_izin=${f(s.Nperm, 2)} kN (${f(s.NpermKg, 0)} kg)`);
  console.log('\ncek rumus lama §2.8:', JSON.stringify(R.legacyCheck));
  // v2.4.0 — tinjauan independen (KOREKSI-PERHITUNGAN §19)
  const C0 = corrected({ ...REF, halfRule: false });
  console.log(`\nv2.4.0: N maks tanpa level 50 % = ${f(C0.NmaxKg)} kg → dengan §6.2.9.2 a)3 = ${f(a.NmaxKg)} kg (+${f(a.NmaxKg - C0.NmaxKg)})`);
  const PT = { 2.2: 1.0, 4.4: 1.5, 6.6: 2.0 };
  const SC = { A: { ...REF }, B: { ...REF, h: 2.7, nl: 5, nbd: 3, nwork: 2, t: 3.2 }, C: { ...REF, nb: 4, h: 2.7, nl: 7, nbd: 7, nwork: 3, t: 3.2, qkN: 6.6 }, D: { ...REF, nb: 4, nl: 6, nbd: 4, nwork: 2, qkN: 6.6 } };
  for (const [k, c] of Object.entries(SC)) {
    const x = corrected(c), y = corrected({ ...c, halfRule: false }), mb = memberBendingRef({ ...c, FkN: PT[c.qkN] });
    console.log(`  skenario ${k}: N ${f(y.NmaxKg, 1)} → ${f(x.NmaxKg, 1)} kg (${f(x.NmaxKN, 2)} kN), N_izin ${f(x.B.Nperm, 2)} kN, rasio ${f(x.util, 2)}; q ${f(x.bearing, 0)} kg/m²; klem ${f(x.coupler.kN, 2)} kN; transom ${f(mb.tr.M, 3)}/${f(mb.tr.Mcap, 3)} kNm = ${f(mb.tr.ratio, 2)} (merata saja ${f(mb.tr.Mudl, 3)})`);
  }
  const T32 = totals({ ...REF, t: 3.2 }, 'suspended'), T40 = totals(REF, 'suspended');
  console.log(`  suspended 2 tali: pipa 4,0 T = ${f(T40.total / 2, 1)} kg (${f(T40.total / 2 * g / 1000, 2)} kN), CW ${Math.ceil(3 * T40.total / 2 * 0.9 / (3.6 * 25))}; pipa 3,2 (data lama) T = ${f(T32.total / 2, 1)} kg (${f(T32.total / 2 * g / 1000, 2)} kN); mobile 4 castor ${f(T40.total / 4, 1)} / ${f(T32.total / 4, 1)} kg`);
}
