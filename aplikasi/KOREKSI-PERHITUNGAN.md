# Koreksi Metode Perhitungan — PPAPI Scaffold v2.3.0 (Beta)

Dokumen tinjauan teknis untuk pemilik aplikasi dan **Komite Teknis PPAPI**.

| | |
|---|---|
| Aplikasi | PPAPI Scaffold — Perencanaan & Analisis Struktur (`aplikasi/perencanaan/`) |
| Versi | **2.3.0 (Beta)**, 9 Oktober 2026. Versi sebelumnya: 2.2.0 (commit `7f828ba`) |
| Dasar keputusan | Persetujuan pemilik aplikasi: **"Koreksi + tandai Beta"** |
| Temuan yang dikoreksi | `devtools/legacy/ANALISIS_PERENCANAAN.md` §2.6–2.7 (E1–E14) dan §4 (bug pasti) |
| Status | **Beta** — metode perhitungan telah dikoreksi dan menunggu tinjauan Komite Teknis PPAPI. Hasil bersifat indikatif dan wajib diverifikasi oleh ahli perancah yang kompeten. |
| Berkas yang berubah | `aplikasi/perencanaan/app.js`, `index.html`, `app.css`; dokumen ini; `aplikasi/CATATAN.md` |
| Perhitungan acuan independen | `devtools/flows/aplikasi-perencanaan-ref.mjs` (tidak memanggil kode aplikasi) |
| Uji regresi | `devtools/flows/aplikasi-perencanaan-koreksi.mjs` dan `devtools/flows/aplikasi-flow.mjs` |

Rujukan baris: "lama" menunjuk `app.js`/`index.html` versi 2.2.0 (commit `7f828ba`) dan, bila disebut, `index.html` aplikasi asal (`devtools/legacy/asosiasi.ppapi-main`). "Baru" menunjuk `app.js` versi 2.3.0.

---

## 0. Ringkasan

1. **Satu dasar keamanan (E6).** Semua pemeriksaan kini memakai metode tegangan izin: *beban kerja tanpa faktor ≤ kapasitas izin*, dengan kapasitas izin = tahanan karakteristik ÷ (γ<sub>M</sub> 1,1 × γ<sub>F</sub> 1,5) sesuai BS EN 12811-1:2003 §10.3.2. SF 1,5 pada beban hidup dan FK 1,5 pada beban rencana dihapus.
2. **Kelas duty dari bay terberat (E4).** Isian Tahap 2 kini berarti beban pada satu bay yang paling berat; tidak lagi dirata-ratakan ke seluruh bay. Beban terpusat terbesar ikut menentukan kelas.
3. **Beban tiang dari geometri (E1, E2).** Jumlah bay, lift, lift berpapan, dan platform kerja diambil dari Data Proyek. Beban dihitung per posisi tiang dengan lebar pengaruh; yang diperiksa adalah tiang **terbesar**.
4. **Kapasitas tekuk dihitung (E3).** Perry–Robertson dalam bentuk EN 1993-1-1 §6.3.1.2, panjang efektif = k × tinggi lift, pipa 48,3 × 4,0 atau 48,3 × 3,2 mm. Dengan kurva c hasilnya **sama dengan tabel beban aksial aman NASC TG20:21** (selisih ≤ 0,5 %, lihat §5).
5. **Klem siku (E5, E14).** Reaksi pada simpul ledger–tiang yang paling dibebani dibandingkan dengan 6,06 kN (kelas A) atau 9,09 kN (kelas B). Nilai ini diturunkan dari BS EN 12811-1:2003 Tabel C.1 dan setara dengan NASC TG20:21 (6,1 / 9,1 kN). Nilai BS 5973 (6,3 / 9,4 kN) tidak dipakai lagi.
6. **Papan, pondasi, checklist, rujukan (E7–E14).** Beban terpusat papan diperiksa terhadap data pabrikan. Pondasi memakai beban tiang terbesar. Kategori FRM otomatis N/A untuk perancah tubular. N/A pada butir kritis wajib beralasan. Rujukan diperbarui; KEP-74/PPK/XII/2013 dihapus sampai dapat diverifikasi.
7. **Tanda Beta** tampil di semua tampilan aplikasi, judul halaman, bilah portal, beranda, menu Tentang, kesimpulan otomatis, dan kaki setiap halaman laporan PDF.

**Kasus acuan** (3 bay × 2,4 m, lebar 1,2 m, 4 lift × 2,0 m, 2 lift berpapan, 1 platform kerja, Medium Duty, pipa 48,3 × 4,0 mm):

| Besaran | Sebelum (v2.2.0) | Sesudah (v2.3.0) |
|---|---|---|
| Kelas duty dari isian bawaan Tahap 2 | 645 kg ÷ 3 bay = 215 kg → **Light** | bay terberat 430 kg → **Medium** |
| Beban yang diperiksa pada tiang | 472,0 kg (4,63 kN): rata-rata, sudah × 1,5 | **480,8 kg (4,72 kN)**: tiang tengah sisi luar, beban kerja |
| Kapasitas tiang | 2.500 kg (24,5 kN), angka tetap | **29,08 kN (2.965 kg)**, dihitung, L<sub>e</sub> 2,0 m |
| Rasio pemanfaatan tiang | 0,19 | 0,16 |
| Reaksi klem siku | 4,63 kN vs 6,3 kN (rasio 0,73) | **2,64 kN vs 6,06 kN (rasio 0,44)** |
| Tekanan pondasi (A = 0,04 m²) | 11.799 kg/m² | 12.020 kg/m² |

Untuk kasus acuan ini rasio tiang berubah sedikit karena dua koreksi saling mengimbangi: beban tiang menentukan 33 % di atas rata-rata (E1), sedangkan FK ganda dihapus dan kapasitas pada lift 2,0 m ternyata di atas 2.500 kg. Perbedaannya menjadi tajam pada lift tinggi, pipa 3,2 mm, dan banyak platform kerja. Pada skenario C (§15), metode lama menyatakan rasio 0,63 (aman), sedangkan metode terkoreksi memberi **1,04 (tidak memenuhi)**.

---

## 1. Kasus acuan dan asumsi model

**Kasus acuan.** Perancah independent tube & coupler dengan 3 bay × 2,4 m dan lebar 1,2 m (dua baris tiang). Terdapat 4 lift × 2,0 m ditambah lift dasar (kicker), sehingga platform teratas di 8,0 m dan tiang setinggi 9,0 m (menjulang 1,0 m untuk pagar). Ada 2 lift berpapan, dan 1 platform kerja dibebani Medium Duty 4,4 kN per bay. Pipa 48,3 × 4,0 mm, kurva tekuk c, k = 1,0, klem siku kelas A, dan bidang dukung 0,04 m² per tiang. Isian ini sama dengan nilai bawaan aplikasi, ditambah **Jumlah Lift = 4**.

**Model beban tiang.**

- **Posisi tiang.** Tiang tengah memikul 1 bay (½ bay kiri + ½ bay kanan), tiang ujung ½ bay. Setiap baris (dalam dan luar) memikul ½ lebar platform. Pembagian ini sesuai cara BS EN 12811-1:2003 §6.2.2.1: batas area beban adalah garis tengah antar-tiang, dan hanya beban merata q₁ yang diteruskan ke struktur.
- **Berat sendiri per level** (lift dasar + setiap lift): ledger sepanjang lebar pengaruh, ½ transom (lebar + 0,2 m), dan 2 klem siku per simpul.
- **Tiang:** tinggi platform teratas + 1,0 m, ditambah klem sambung untuk setiap 6 m.
- **Bracing:** 2 × jumlah lift batang diagonal √(L² + h²) dan (4 × lift + 4) klem putar, dibagi rata ke semua tiang. Jumlah ini sama dengan estimasi material aplikasi lama.
- **Lift berpapan:** metal plank 5,2 kg/m per lembar, jumlah lembar = maks(3, bulat(B/0,24)) per bay. Pagar (guardrail + midrail, 2 pipa) dan papan kaki 5 kg per 2,4 m hanya di **sisi luar**, termasuk 2 klem siku per tiang.
- **Beban hidup:** q<sub>duty</sub> × lebar pengaruh × ½ × jumlah platform kerja. Seluruh bay pada platform kerja dibebani penuh.
- **Tidak dimasukkan:** base plate dan sole board (berada di bawah tiang), tangga (dianggap pada bay akses terpisah), papan lift dalam (*hop-up*), dan pagar ujung. Kedua yang terakhir tidak memengaruhi tiang menentukan.

**Berat komponen.** Berat pipa dihitung dari penampangnya (§5). Klem siku 1,2 kg, klem putar 1,4 kg, klem sambung 1,1 kg, plank 5,2 kg/m, dan papan kaki 5 kg per 2,4 m berasal dari estimasi material aplikasi lama. Nilai-nilai ini **bukan nilai standar** dan diajukan untuk dikonfirmasi Komite (Q6).

---

## 2. E6 — Dasar keamanan tunggal

| | |
|---|---|
| **Masalah** | Faktor keamanan diterapkan ganda dan bercampur. SF 1,5 dipakai pada estimasi beban hidup, lalu FK 1,5 dipakai pada beban total, kemudian hasilnya dibandingkan dengan kapasitas "aman"/SWL yang sudah mengandung faktor keamanan. |
| **Sebelum** | Tahap 2: `tot = sub × SF` (app.js lama baris 994; isian `ll-sf` di index.html lama baris 367). Tahap 6: `fact = total × fk` lalu `perT = fact/tiang ≤ kapT` (baris 823, 857; isian `an-fk` baris 318). Suspended/mobile: `T = fact/n_tali`, `N = fact/n_castor` (baris 837, 848). |
| **Sesudah** | Beban kerja **tanpa faktor** ≤ kapasitas **izin**. Kapasitas izin = R<sub>k</sub> ÷ (γ<sub>M</sub> × γ<sub>F</sub>) = R<sub>k</sub> ÷ 1,65 untuk tiang dan klem. Konstanta di app.js baru baris 904–912. Isian SF dan FK dihapus. |
| **Alasan** | Kelas duty, SWL klem, WLL castor, dan MBL/FoS tali adalah besaran kerja yang sudah memuat faktor keamanan. Dengan satu dasar, hasil dapat ditelusuri dan sebanding dengan TG20. Bila beban diberi faktor 1,5, pembandingnya adalah tahanan rencana R<sub>k</sub>/1,1; hasilnya identik karena γ<sub>F</sub> sama untuk beban tetap dan beban hidup. |
| **Sumber** | BS EN 12811-1:2003 §10.3.2.1 (γ<sub>F</sub> = 1,5 untuk semua beban tetap dan variabel pada ULS) dan §10.3.2.2 (γ<sub>M</sub> = 1,1 untuk komponen baja). |
| **Contoh** | Kasus acuan, model suspended dengan 2 tali. Sebelum: T = (393 + 1.346) × 1,5 / 2 = 1.304 kg (12,79 kN). Sesudah, dengan material yang diestimasi dari geometri: T = (1.626 + 1.346) / 2 = **1.486 kg (14,57 kN)**. Nilai ini dibandingkan dengan MBL/FoS tanpa faktor tambahan. Kenaikan T berasal dari estimasi material yang kini lengkap, bukan dari faktor. |

---

## 3. E4 — Kelas duty dari bay terberat (+ beban terpusat)

| | |
|---|---|
| **Masalah** | Kelas duty adalah batas **per bay per platform**, tetapi aplikasi membagi total beban hidup ke semua bay dan platform. Material yang menumpuk di satu bay tidak terdeteksi. |
| **Sebelum** | `perBay = tot/(N_bay × N_platform)`, dengan `tot = (n·w + alat + material + impact) × SF` (app.js lama baris 994–1001; aplikasi asal baris 1702). |
| **Sesudah** | `W_bay = n·w + W_alat + W_material + impact% × (W_alat + W_material)`, diisi untuk **satu bay terberat**, tanpa SF. Kelas = maksimum dari (a) W<sub>bay</sub> ≤ 225/450/675 kg → Light/Medium/Heavy, dan (b) beban terpusat terbesar ≤ 1,0/1,5/2,0 kN. Di atas itu Special: kN = ⌈W<sub>bay</sub> · g/100⌉/10, minimal 6,6 kN. Fungsi `llData()`, app.js baru baris 1220. |
| **Alasan** | Batas kelas berlaku untuk setiap bay sehingga harus dibandingkan dengan bay yang paling berat. Beban terpusat adalah bagian definisi kelas duty. |
| **Sumber** | AS/NZS 1576.1:2019. Kelas Light/Medium/Heavy = 225/450/675 kg per platform per bay, dengan beban terpusat 100/150/200 kg: [CFMEU Victoria, *Scaffold Guide* 2024](https://vic.cfmeu.org/wp-content/uploads/2024/08/scaffold-guide-web.pdf); WorkSafe ACT (dikutip di ANALISIS_PERENCANAAN Lampiran B). |
| **Contoh** | Isian bawaan (2 orang × 90, alat 50, material 150, impact 25 %). Sebelum: (180 + 50 + 150 + 50) × 1,5 = 645 kg ÷ 3 bay = 215 kg → **Light**. Sesudah: 180 + 50 + 150 + 50 = **430 kg → Medium**. Dengan 4 orang dan material 300 kg: sebelum 1.196 ÷ 3 = 399 kg → Medium; sesudah 797,5 kg → **Special 7,9 kN**. Benda tunggal 180 kg (1,77 kN) → **Heavy**. |

---

## 4. E1 dan E2 — Beban tiang dari geometri; beban maksimum, bukan rata-rata

| | |
|---|---|
| **Masalah** | (E1) `W*/n_tiang` membagi rata seluruh beban ke semua tiang, padahal tiang tengah memikul dua kali beban tiang ujung dan sisi luar memikul pagar. (E2) Jumlah tiang (bawaan 6), bay dibebani (3), dan klem (8) diisi bebas, tidak diturunkan dari geometri. Akibatnya Tahap 5 dan Tahap 6 bisa memakai jumlah bay yang berbeda. |
| **Sebelum** | `live = kgBay × an-bay × an-lantai`; `perT = (W_d + live) × FK / an-tiang` (app.js lama baris 819–823; aplikasi asal 1531, 1565). Isian `an-tiang`, `an-bay`, dan `an-nklem` ada di index.html lama baris 319, 291, 335. Pada v2.2.0 hanya ada kotak SARAN (B6). |
| **Sesudah** | `geom()` (app.js baru baris 925) membaca bay, panjang bay, lebar, tinggi lift, jumlah lift (atau tinggi ÷ tinggi lift), jumlah lift berpapan (isian baru `f-papan`), platform kerja, dan jenis pipa (isian baru `f-pipa`). `stdLoad()` dan `stdAll()` (baris 948, 959) menghitung empat posisi tiang dan menandai yang terbesar. Rumus: **N = [H<sub>s</sub>·m + n<sub>sambung</sub>·1,1 + (n<sub>lift</sub>+1)·(t·L·m + ½(B+0,2)·m + 2·1,2) + W<sub>bracing</sub>/n<sub>tiang</sub>] + n<sub>papan</sub>·t·½·W<sub>papan/bay</sub> + [sisi luar] n<sub>papan</sub>·(t·L·(2m + m<sub>kaki</sub>) + 2·1,2) + n<sub>kerja</sub>·t·½·q<sub>duty</sub>**, dengan t = 1 (tiang tengah) atau ½ (tiang ujung). |
| **Alasan** | Batas kekuatan ditentukan oleh tiang yang paling dibebani. Geometri adalah satu sumber data untuk material dan analisis sehingga tidak ada angka yang "lupa diubah". |
| **Sumber** | BS EN 12811-1:2003 §6.2.2.1 (area beban dibatasi garis tengah antar-tiang; hanya q₁ diteruskan ke struktur). Model distribusi adalah statika dasar (balok sederhana antar-simpul). |

**Contoh — tiang tengah sisi luar (menentukan), kasus acuan:**

Data dasar: massa pipa m = 556,69 mm² × 7.850 kg/m³ = 4,370 kg/m; L = 2,4 m; B = 1,2 m; tiang H<sub>s</sub> = 4 × 2,0 + 1,0 = 9,0 m.

| Komponen | Perhitungan | kg |
|---|---|---|
| Tiang | 9,0 × 4,370 | 39,33 |
| Klem sambung tiang | (⌈9,0/6⌉ − 1) × 1,1 | 1,10 |
| 5 level (lift dasar + 4 lift) | 5 × (2,4 × 4,370 + ½ × 1,4 × 4,370 + 2 × 1,2) = 5 × 15,947 | 79,74 |
| Bracing (bagian per tiang) | [8 × 3,124 × 4,370 + 20 × 1,4] ÷ 8 = 137,22 ÷ 8 | 17,15 |
| **Berat sendiri struktur** | | **137,32** |
| Papan, 2 lift berpapan | 2 × 1 × ½ × (5 × 2,4 × 5,2 = 62,4) | 62,40 |
| Pagar + papan kaki, 2 lift | 2 × [2,4 × (2 × 4,370 + 2,083) + 2 × 1,2] = 2 × 28,376 | 56,75 |
| Beban hidup, 1 platform kerja | 1 × 1 × ½ × (4.400/9,80665 = 448,68) | 224,34 |
| **N maksimum** | | **480,81 kg = 4,715 kN** |

Posisi lain: tiang tengah sisi dalam 424,06 kg, tiang ujung sisi luar 285,24 kg, dan tiang ujung sisi dalam 254,47 kg. Rata-rata 8 tiang = 361,14 kg, sehingga tiang menentukan = **133 %** dari rata-rata. Selisih sepertiga inilah yang tidak terlihat oleh metode lama (E1).

Sebelum, dengan isian bawaan v2.2.0 (6 tiang, 8 komponen material = 393 kg): N = (393 + 1.346) × 1,5 / 6 = 434,8 kg. Bila diisi konsisten dengan geometri (8 tiang, estimasi material lama 1.171,1 kg): N = (1.171,1 + 1.346,0) × 1,5 / 8 = **472,0 kg** (sudah dikali 1,5).

---

## 5. E3 — Kapasitas tekuk tiang (Perry–Robertson)

| | |
|---|---|
| **Masalah** | Label "kapasitas tekuk Perry-Robertson" hanya angka isian 2.500 kg. Nilainya tidak bergantung pada tinggi lift, tebal pipa, atau kondisi pengaku. |
| **Sebelum** | `kapT = num('an-kaptiang', 2500)`; pemeriksaan `perT ≤ kapT` (app.js lama baris 822, 857; index.html lama baris 320; aplikasi asal 644, 1565). |
| **Sesudah** | `buckling()` (app.js baru baris 973): λ = L<sub>e</sub>/i; λ̄ = λ/λ₁, λ₁ = π√(E/f<sub>y</sub>); Φ = 0,5[1 + α(λ̄ − 0,2) + λ̄²]; χ = 1/(Φ + √(Φ² − λ̄²)); N<sub>b,Rk</sub> = χ·A·f<sub>y</sub>; **N<sub>izin</sub> = N<sub>b,Rk</sub>/(1,1 × 1,5)**. L<sub>e</sub> = k × tinggi lift, dengan k bawaan 1,0 untuk perancah yang di-bracing dan diikat di setiap simpul. |
| **Data pipa** | 48,3 × 4,0 mm: A = 556,69 mm², I = 13,77 cm⁴, i = 15,73 mm, 4,37 kg/m. 48,3 × 3,2 mm: A = 453,39 mm², I = 11,59 cm⁴, i = 15,99 mm, 3,56 kg/m. Baja f<sub>y</sub> = 235 N/mm², E = 210.000 N/mm². |
| **Faktor ketidaksempurnaan** | Kurva c, α = 0,49 (bawaan). Kurva a, α = 0,21, hanya untuk pipa canai panas bersertifikat dan dengan persetujuan ahli. |
| **Alasan** | Bentuk EN 1993-1-1 adalah persamaan Perry–Robertson (Ayrton–Perry) dengan η = α(λ̄ − 0,2). Kapasitas kini mengikuti tinggi lift dan jenis pipa, dan turun ±38 % dari lift 2,0 m ke 2,7 m. |
| **Sumber** | EN 1993-1-1 §6.3.1.2 dan Tabel 6.1 (α kurva a = 0,21, c = 0,49). Tabel 6.2: profil berongga canai panas → kurva a, canai dingin → kurva c ([SCI AD 546](https://www.steelconstruction.info/images/d/d4/AD-546.pdf); [Dlubal, rumus χ](https://www.dlubal.com/en-US/support-and-learning/support/knowledge-base/001622)). BS EN 12811-1:2003 §4.2.1.2 (pipa lepas Ø48,3: f<sub>y</sub> minimum 235 N/mm², tebal minimum 3,2 mm), §10.2.4.1 (tahanan baja menurut ENV 1993-1-1), dan §10.3.2. Massa pipa: BS EN 39 tipe 4 = 4,37 kg/m. |
| **Validasi** | NASC TG20:21 mencantumkan "safe axial load" pipa 48,3 × 4,0 (BS EN 39 tipe 4, f<sub>y</sub> 235): 51,9 / 39,2 / 29,1 / 22,0 / 17,1 / 13,6 kN pada L<sub>e</sub> 1,2 / 1,6 / 2,0 / 2,4 / 2,8 / 3,2 m. Nilai ini dikutip dalam perhitungan desain PSD No. 9989-1 E (Fraser House, Manchester, 30 Juni 2022, hlm. 3: [docs.planning.org.uk](https://docs.planning.org.uk/20220921/27/RF9QPMBC0E700/u4qbkc35h6ia08xh.pdf)). Rumus aplikasi dengan kurva c menghasilkan 51,88 / 39,10 / 29,08 / 21,98 / 17,04 / 13,54 kN. Selisihnya 0 sampai −0,5 % dan **tidak pernah di atas TG20**. Pemeriksaan ini otomatis untuk 11 panjang efektif (uji K0). Kurva a memberi nilai ±20 % di atas TG20, karena itu bukan bawaan. |

**Contoh (kasus acuan, 48,3 × 4,0, L<sub>e</sub> = 2,0 m, kurva c):** λ = 2.000/15,726 = 127,18; λ₁ = π√(210.000/235) = 93,91; λ̄ = 1,3542; Φ = 0,5[1 + 0,49 × 1,1542 + 1,8339] = 1,6997; χ = 1/(1,6997 + √(2,8890 − 1,8339)) = **0,3667**. N<sub>b,Rk</sub> = 0,3667 × 556,69 × 235 = 47,98 kN, sehingga **N<sub>izin</sub> = 47,98/1,65 = 29,08 kN (2.965 kg)**. Rasio = 4,715/29,08 = **0,16**.

**Sensitivitas N<sub>izin</sub> (kN; nilai kg dalam kurung):**

| Pipa / kurva | lift 2,0 m | lift 2,5 m | lift 2,7 m |
|---|---|---|---|
| 48,3 × 4,0, kurva c | 29,08 (2.965) | 20,58 (2.098) | 18,12 (1.847) |
| 48,3 × 4,0, kurva a | 34,97 (3.566) | 23,92 (2.439) | 20,83 (2.124) |
| 48,3 × 3,2, kurva c | 24,25 (2.472) | 17,21 (1.755) | 15,16 (1.546) |
| 48,3 × 3,2, kurva a | 29,23 (2.981) | 20,06 (2.045) | 17,48 (1.782) |

Angka tetap 2.500 kg pada aplikasi lama hanya wajar untuk lift ±2,0 m. Pada lift 2,7 m dengan pipa 3,2 mm, kapasitas sebenarnya 1.546 kg, sehingga angka lama **62 % terlalu tinggi**.

---

## 6. E5 dan E14 — Klem siku (right-angle coupler)

| | |
|---|---|
| **Masalah** | (E5) `R = W*/n_klem` membagi seluruh beban, termasuk berat tiang yang tidak melewati klem, ke sejumlah klem yang diisi bebas. Cara ini bukan metode TG20/BS. (E14) SWL 6,3/9,4 kN berasal dari BS 5973 Tabel 17, sedangkan BS 5973 telah ditarik dan label "Kelas A / BS 1139-2" rancu. |
| **Sebelum** | `klemKg = fact/nklem` dibandingkan dengan 6,3 atau 9,4 kN (app.js lama baris 862–865; index.html lama baris 332–335; aplikasi asal 655–656, 1571–1574). |
| **Sesudah** | `couplerData()` (app.js baru baris 984). Reaksi klem siku ledger–tiang pada simpul tengah di level platform kerja: **R = ½ (q<sub>duty</sub> + W<sub>papan/bay</sub>) × t + t·L·m + ½ (B + 0,2)·m**, dengan t = 1 (atau ½ untuk menara 1 bay). Pembandingnya adalah kapasitas izin gelincir **F<sub>s,k</sub>/1,65 = 10/1,65 = 6,06 kN (kelas A) atau 15/1,65 = 9,09 kN (kelas B)**. |
| **Alasan** | Klem menahan beban platform dari level tempatnya saja, bukan seluruh beban di atasnya. Platform kerja di level lain dipikul klem di level masing-masing. |
| **Sumber** | BS EN 12811-1:2003 Annex C, Tabel C.1. Gaya gelincir karakteristik klem siku kelas A = 10,0 kN dan kelas B = 15,0 kN; klem putar dan paralel juga 10/15 kN; klem sambung friksi 6,0/9,0 kN. Nilai NASC TG20:21: klem siku dan klem putar 6,1 kN (A) / 9,1 kN (B), klem sambung 3,6/5,5 kN (tarik), dikutip pada perhitungan PSD 9989-1 E hlm. 3 (tautan di §5) dan [Scaffolders Forum, TG20:13 Tabel 5.15](https://scaffoldersforum.com/goto/post?id=358682) (sumber sekunder). Aritmetikanya cocok: 10/1,65 = 6,06 ≈ 6,1 dan 15/1,65 = 9,09 ≈ 9,1. **Teks TG20 dan BS EN 74-1:2022 tidak diakses langsung** (berbayar); nilai TG20 diperoleh dari dua sumber kedua yang saling cocok dan cocok pula dengan Tabel C.1 yang dibaca langsung. |
| **Contoh** | Kasus acuan. Sebelum: (1.171,1 + 1.346,0) × 1,5 / 8 = 472,0 kg = **4,63 kN** terhadap 6,3 kN (rasio 0,73). Dengan isian bawaan v2.2.0: 3,20 kN. Sesudah: ½ × (448,68 + 62,40) + 2,4 × 4,370 + ½ × 1,4 × 4,370 = 255,54 + 10,49 + 3,06 = **269,08 kg = 2,64 kN** terhadap **6,06 kN** (rasio 0,44). |

---

## 7. E7 — Papan: beban merata **dan** beban terpusat

| | |
|---|---|
| **Masalah** | Beban terpusat kelas duty (1,0/1,5/2,0 kN) hanya ditampilkan dan tidak pernah diperiksa. "SWL papan 250 kg/m²" adalah konstanta, bukan data pabrikan. |
| **Sebelum** | `udl ≤ 250` (app.js lama baris 829). Nilai `pt` tidak dipakai. |
| **Sesudah** | UDL = q<sub>duty</sub>/(L × B) ≤ isian `an-udl` (bawaan 250 kg/m², dari aplikasi lama). Beban terpusat kelas ≤ isian `an-ptpapan` (kN, data pabrikan). **Selama isian beban terpusat kosong, pemeriksaan bertanda CEK** sehingga hasil tidak dapat dinyatakan lolos tanpa data papan. Lebar platform minimum tetap 450/900/1.000 mm (Q4). |
| **Sumber** | BS EN 12811-1:2003 Tabel 3 dan §6.2.2.1: setiap area kerja harus mampu memikul q₁, F₁, dan F₂ secara terpisah. Kapasitas papan bergantung pada jenis dan bentangnya (ANALISIS_PERENCANAAN §2.6). |
| **Contoh** | Medium, bay 2,4 × 1,2 m: UDL = 448,68/2,88 = 156 kg/m² ≤ 250 → OK. Beban terpusat 1,5 kN ≤ 2,0 kN (bila diisi) → OK. Heavy (2,0 kN) dengan papan 1,8 kN → CEK. |

---

## 8. E8 — Pondasi

| | |
|---|---|
| **Masalah** | q = N/A memakai N rata-rata (yang juga sudah difaktorkan) dan luas pelat dasar saja. |
| **Sebelum** | `bearing = perT/plateA` (app.js lama baris 823). |
| **Sesudah** | **q = N<sub>maks</sub>/A<sub>dukung</sub> ≤ daya dukung izin**. Isian luas diberi label "Luas bidang dukung per tiang — base plate/sole board", sehingga luas sole board dapat dimasukkan. |
| **Contoh** | Sebelum: 472,0/0,04 = 11.799 kg/m², atau 10.869 kg/m² dengan isian bawaan. Sesudah: 480,81/0,04 = **12.020 kg/m² > 10.000 → CEK** (perlu sole board ≥ 0,048 m² atau landasan lebih baik). |

---

## 9. E9 — Model suspended dan mobile

- **Suspended:** T = W/n<sub>tali</sub> ≤ MBL/FoS, dengan W = beban mati Tahap 5 + beban hidup, tanpa faktor (E6). Kebutuhan counterweight: n = ⌈3·T·L<sub>out</sub>/(L<sub>in</sub>·m<sub>cw</sub>)⌉. Asumsi kini dinyatakan di layar dan di PDF: beban dibagi rata ke semua tali, satu needle per tali, dan berat needle diabaikan. Nilai FoS 6/10 dan faktor stabilitas 3 **dipertahankan dari aplikasi lama** karena nomor klausul AS/NZS 1576.1 dan AS 4576 yang dicantumkan tidak dapat diverifikasi (Q8).
- **Mobile:** beban per castor = W/n<sub>castor</sub> ≤ WLL. Rasio H:B 3,5/3,0 dipertahankan dengan catatan bahwa batas yang berlaku adalah instruksi pabrikan menara (BS EN 1004).
- **Contoh** (kasus acuan, material dari estimasi geometri 1.626 kg). Suspended 2 tali: T = (1.626 + 1.346,04)/2 = 1.486,0 kg (14,57 kN) > 60/6 = 10 kN → CEK; counterweight ⌈3 × 1.486,0 × 0,9/(3,6 × 25)⌉ = **45 buah**. Sebelum: 1.304 kg dan 40 buah, dengan 8 komponen material bawaan dan × 1,5. Mobile 4 castor: 743,0 kg per castor terhadap WLL 500 kg → CEK.

---

## 10. E10 — Kekokohan

Label "Kekokohan terpenuhi" diganti menjadi **"Indikasi kekokohan"**. Butirnya diturunkan dari checklist BRC/STB dan batas bentang 2,4 m. Klaim yang tidak dapat diverifikasi ("tie menahan 2,5 % beban vertikal, kapasitas ≥ 6,0 kN, AS 1576.1 kl. 2.8.3") dihapus dari layar dan PDF. Aplikasi menyatakan dengan jelas bahwa **jarak dan kapasitas tie serta beban angin tidak dihitung**. Label hasil "INDIKASI AMAN" diganti dengan **"LOLOS PEMERIKSAAN INDIKATIF"** yang disertai keterangan "bukan sertifikasi". Kotak status memakai "MEMENUHI" (misalnya "TIANG MEMENUHI") alih-alih "KUAT" atau "AMAN".

## 11. E11 dan E12 — Checklist

- **E11:** kategori FRM (khusus perancah frame) otomatis N/A dan terkunci bila jenis perancah tubular. Butirnya tetap tampil sebagai rujukan (`autoNA()`, app.js baru baris 124). Skor kategori kini dihitung terhadap butir yang berlaku (N/A tidak dihitung), sehingga FRM tampil "N/A", bukan 0 %.
- **E12:** jawaban N/A pada **butir kritis** wajib disertai alasan. Tanpa alasan, butir dianggap belum dinilai (status BELUM LENGKAP, `stats()` baris 166). Alasan disimpan, ikut diekspor dan diimpor, tampil di ringkasan Laporan, dan dicetak di PDF pada bagian "N/A pada butir kritis (dengan alasan)".

## 12. E13 — Tanda pembanding

Sudah diperbaiki pada v2.2.0: "≤/≥" bila lolos dan "&gt;/&lt;" bila gagal. Pemeriksaan baru memakai fungsi yang sama.

## 13. E14 — Rujukan standar dan regulasi

| Sebelum | Sesudah |
|---|---|
| BS 5973 (Tabel 17, kl. 28) sebagai dasar SWL klem dan menara | BS EN 12811-1:2003 dan NASC TG20:21. BS 5973 disebut "telah ditarik". |
| BS 1139 / BS 1139-2 | BS EN 39:2001 (pipa), BS EN 74-1:2022 (klem), SNI 8987:2021 (pipa baja perancah) |
| AS/NZS 1576.1 dan AS 4576 tanpa edisi, dengan nomor klausul/tabel (kl. 2.4.3.2, 2.8.3, 2.9–2.11, 2.12, 11.5.2, 10.7, Tbl 8.7) | AS/NZS 1576.1:2019 dan AS 4576:2020. Nomor klausul yang tidak dapat diverifikasi dihapus (Q8). |
| AS/NZS 4576 (gambar rencana) | AS 4576:2020 (menggantikan AS/NZS 4576:1995) |
| "KEP-74/PPK/XII/2013" (beranda, Tahap 6, Tentang, PDF) | **Dihapus**: tidak ditemukan di JDIH maupun sumber publik lain (pencarian ulang 9 Oktober 2026). Diganti dengan regulasi terverifikasi di `assets/data/regulasi.js`: Permenakertrans PER.01/MEN/1980, Permenaker 9/2016, dan Kepmenaker 46/2022 (Q1). |
| Label klem "Kelas A / BS 1139-2 6,3 kN", "Kelas B / EN 74 9,4 kN" | "Kelas A/B (BS EN 74-1) — gelincir karakteristik 10/15 kN → kapasitas izin 6,06/9,09 kN" |

Rujukan pada **butir checklist** (mis. "BS 5973", "BS 1139 / AS 1576") belum dipetakan ulang per butir karena teks standarnya berbayar. Halaman Tentang kini menyatakan bahwa rujukan tersebut bersifat historis (Q2).

---

## 14. Bug pasti dan keamanan (§4 analisis) — status verifikasi ulang

Seluruh bug pasti sudah diperbaiki pada v2.2.0 dan **diverifikasi ulang** pada v2.3.0 dengan `node flows/aplikasi-flow.mjs --only=B,C` (64/64 lulus):

| ID | Masalah | Status v2.3.0 | Uji |
|---|---|---|---|
| B1 | Ringkasan Laporan kosong | Tampil (kini juga memuat daftar N/A kritis) | C4, K5 |
| B2 | "undefined/52" | "52/52 item dinilai" | C4 |
| B3 | Tanggal mundur sehari sebelum 07.00 WIB | Tanggal lokal. Tanggal pada tag dan PDF kini juga dibaca sebagai tanggal lokal (`localDate()`). | C9 |
| B4 | Isian Tahap 2–6 hilang saat dimuat ulang | Tersimpan, termasuk isian baru (kurva, k, papan) dan alasan N/A | C5, K5 |
| B5 | "Proyek Baru" menyisakan foto/gambar | Semua dikosongkan; material kembali ke estimasi geometri bawaan | C6 |
| B6 | Bay/tiang analisis ≠ Data Proyek | **Diselesaikan tuntas oleh E2**: tidak ada lagi isian bebas | C2, K1 |
| B7/B8 | PDF 10 MB; label menimpa nilai | PDF ±0,4–0,6 MB; tabel analisis kini satu kolom tanpa pemotongan | C4, K6 |
| B9 | Tombol simulator dan pita ikut tercetak pada tag | Tersembunyi, termasuk pita Beta | C8 |
| B10 | "≤" walaupun gagal | Mengikuti hasil | C2, K4 |
| — | Header menempel menutupi progres di ponsel | Header tidak menempel; progres menempel di bawah bilah portal | C10 |
| S1–S3 | Akun bawaan admin/admin123, sesi palsu, peran Supabase | Tidak ada login lokal; SSO portal; kunci lama dihapus saat mulai | B1 |
| S4/S5 | XSS pada tag, arsip, nama berkas, impor JSON | Semua di-escape; impor divalidasi. Isian baru (alasan N/A, catatan geometri, teks pemeriksaan) juga di-escape. | C7, K5 |
| S6 | Token Upstash di localStorage | Tidak ada token di penyimpanan aplikasi | B1 |
| S7 | Service worker menghapus cache lain | Tidak ada service worker di seluruh situs | C8 |
| S8 | Simulator blob satu origin | Tautan ke `aplikasi/simulator/` (gerbang sama) | C8 |

Gerbang dan SSO (`gate.js`) tidak diubah. `check.mjs` pada aplikasi (desktop + ponsel): tanpa sesi → `masuk.html?next=…`; `--auth` → 0 masalah; `--auth --status=Draf` → `dashboard.html`.

---

## 15. Contoh numerik sebelum vs sesudah — skenario tambahan

Skenario "sebelum" memakai rumus aplikasi lama dengan isian yang konsisten dengan geometri: jumlah tiang = 2 × (bay + 1), estimasi material otomatis lama, FK 1,5, dan kapasitas 2.500 kg. Semua nilai dihitung oleh `aplikasi-perencanaan-ref.mjs`.

| Skenario | Sebelum: beban/tiang (×1,5) → rasio | Sesudah: N<sub>maks</sub> → N<sub>izin</sub> → rasio | Klem sebelum → sesudah |
|---|---|---|---|
| **A** acuan (3 bay, Medium, 4 lift × 2,0 m, pipa 4,0) | 472,0 kg → 0,19 | 480,8 kg (4,72 kN) → 29,08 kN → **0,16** | 4,63 → 2,64 kN |
| **B** 3 bay, Medium, 5 lift × 2,7 m, 3 lift berpapan, 2 platform kerja, pipa 3,2 | 783,6 kg → 0,31 | 770,4 kg (7,56 kN) → 15,16 kN → **0,50** | 7,68 (CEK) → 2,61 kN |
| **C** 4 bay, Heavy, 7 lift × 2,7 m, 7 lift berpapan, 3 platform kerja, pipa 3,2 | 1.566,9 kg → **0,63 (lolos)** | 1.603,4 kg (15,72 kN) → 15,16 kN → **1,04 (CEK)** | 19,21 (CEK) → 3,71 kN |
| **D** 4 bay, Heavy, 6 lift × 2,0 m, 4 lift berpapan, 2 platform kerja, pipa 4,0 | 1.096,8 kg → 0,44 | 1.102,3 kg (10,81 kN) → 29,08 kN → **0,37** | 13,44 (CEK) → 3,74 kN |

Skenario C menunjukkan sisi **tidak konservatif** metode lama: tiang dinyatakan lolos padahal kapasitas tekuk pada lift 2,7 m dengan pipa 3,2 mm terlampaui. Skenario B–D menunjukkan sisi **terlalu konservatif** metode lama pada klem: beban seluruh perancah dibagi 8 klem sehingga muncul "CEK" palsu.

---

## 16. Asumsi yang dipakai (untuk ditinjau)

1. Perancah independent tube & coupler, diikat (tie) dan di-bracing sehingga panjang efektif tiang = tinggi lift (k = 1,0).
2. Beban dibagi menurut lebar pengaruh (balok sederhana antar-simpul). Efek menerus ledger, yang memberi reaksi tumpuan tengah ±1,1–1,25 wL, tidak diperhitungkan (Q5).
3. Beban dianggap sentris. Eksentrisitas sambungan klem dan imperfeksi kemiringan sambungan tiang (BS EN 12811-1 §10.2.2.2) tidak dihitung terpisah; hanya imperfeksi batang yang tercakup kurva tekuk (Q3).
4. Setiap baris tiang memikul ½ lebar platform. Papan lift dalam (*hop-up*) dan beban di luar baris tiang tidak dimodelkan.
5. Seluruh bay pada setiap platform kerja dibebani penuh beban kelas duty. Jumlah platform kerja yang dibebani bersamaan diisi pengguna.
6. Pagar dan papan kaki hanya di sisi luar, pada setiap lift berpapan. Tangga berada di bay akses terpisah.
7. Berat komponen non-pipa memakai nilai aplikasi lama (§1).
8. f<sub>y</sub> = 235 N/mm² untuk kedua tebal pipa (minimum BS EN 12811-1 §4.2.1.2).
9. Kapasitas izin = R<sub>k</sub>/1,65 untuk tiang dan klem. Untuk tali dan castor dipakai MBL/FoS dan WLL dari pengguna/pabrikan.

## 17. Pertanyaan terbuka untuk Komite Teknis PPAPI

1. **Q1 — KEP-74/PPK/XII/2013.** Mohon salinan dokumen ini. Bila yang dimaksud adalah SKB Menaker/Menteri PU KEP-174/MEN/1986 dan 104/KPTS/1986 (K3 konstruksi, bab perancah), mohon konfirmasi. Dugaan ini belum diverifikasi.
2. **Q2 — Rujukan butir checklist.** Apakah butir yang merujuk BS 5973/BS 1139 dipetakan ulang ke BS EN 12811-1, TG20:21/SG4, AS 4576:2020, atau SNI 8987:2021? Pemetaan per butir memerlukan teks standar.
3. **Q3 — Eksentrisitas klem.** Apakah pemeriksaan interaksi tekan–lentur akibat eksentrisitas sambungan ledger (±50 mm) diwajibkan? TG20 diduga sudah memperhitungkannya dalam tabel beban aksial aman; validasi §5 menunjukkan kecocokan dengan tabel tersebut.
4. **Q4 — Lebar platform minimum.** Nilai 450/900/1.000 mm berasal dari aplikasi lama ("AS 4576 Tbl 8.7", tidak dapat diverifikasi). WorkSafe ACT menyebut Light ≥ 2 papan, Medium ≥ 4 papan, Heavy ≥ 5 papan (5 × 225 = 1.125 mm > 1.000 mm). Nilai mana yang dipakai?
5. **Q5 — Kontinuitas ledger.** Apakah reaksi simpul tengah perlu dikalikan faktor kontinuitas, misalnya 1,1–1,25, terutama untuk papan kayu yang menerus di atas beberapa transom?
6. **Q6 — Berat komponen.** Konfirmasi berat klem (1,2/1,4/1,1 kg), metal plank 5,2 kg/m, papan kaki, dan perlunya transom antara untuk papan kayu 38 mm (bentang 1,2 m).
7. **Q7 — Pipa 3,2 mm.** Apakah PPAPI menerima f<sub>y</sub> lebih tinggi untuk pipa 3,2 mm bermutu tinggi (dengan sertifikat)? Bila ya, berapa nilainya dan apa sumbernya? Saat ini dipakai 235 N/mm² (konservatif).
8. **Q8 — Suspended dan mobile.** Verifikasi FoS tali 6/10, faktor stabilitas counterweight 3, inboard ≥ 3 × outboard, dan rasio H:B 3,5/3,0 terhadap AS/NZS 1576.1:2019, AS 4576:2020, dan BS EN 1004 (nomor klausul lama tidak dapat diverifikasi).
9. **Q9 — Kurva tekuk a.** Apakah opsi kurva a (±20 % di atas tabel TG20) dihapus saja, atau dipertahankan dengan syarat sertifikat pipa canai panas?
10. **Q10 — Jumlah platform kerja bersamaan.** Apakah aplikasi perlu membatasi jumlah platform kerja yang boleh dibebani bersamaan per kelas duty (AS/NZS 1576.1)?
11. **Q11 — Tie dan angin.** Apakah tahap berikutnya perlu menghitung jarak dan gaya tie serta beban angin (BS EN 12811-1 dan TG20)?
12. **Q12 — Dasar keamanan.** Konfirmasi bahwa PPAPI memakai dasar tegangan izin R<sub>k</sub>/1,65, setara TG20, sebagai dasar tunggal aplikasi.
13. **Q13 — Label Beta.** Kriteria apa yang harus dipenuhi agar label Beta dapat dicabut, misalnya uji banding terhadap desain TG20 yang sudah disahkan?

---

## 18. Cara memverifikasi ulang

```
cd devtools
node flows/aplikasi-perencanaan-ref.mjs            # laporan kasus acuan, sebelum/sesudah, sensitivitas
node flows/aplikasi-perencanaan-koreksi.mjs        # 88 pemeriksaan: acuan vs aplikasi, matriks skenario, Tahap 2, Beta, PDF, ponsel, axe
node flows/aplikasi-flow.mjs --only=B,C            # regresi SSO, sembilan tahap, bug B1–B10, keamanan
node check.mjs aplikasi/perencanaan/index --auth   # 0 masalah (desktop + ponsel)
```

Perhitungan acuan disusun ulang secara independen: setiap batang dienumerasi dan reaksinya dibagikan ke simpul, lalu tekuk dihitung dari sifat penampang dan dicek silang dengan bentuk tegangan Perry–Robertson. Rumus lama juga ditulis ulang di modul ini dan **mereproduksi seluruh nilai acuan lama** (ANALISIS_PERENCANAAN §2.8), sehingga kolom "sebelum" pada dokumen ini setia pada aplikasi lama.

## Lampiran — Sumber

- BS EN 12811-1:2003, *Temporary works equipment — Part 1: Scaffolds — Performance requirements and general design*: §4.2.1.2, §6.1.3 Tabel 3, §6.2.2.1, §10.2.4.1, §10.3.2.1–10.3.2.2, Annex C Tabel C.1. Teks dibaca dari salinan yang diunggah produsen: https://www.wm-scaffold.com/wp-content/uploads/2021/06/BS-EN-12811-1-British-Standard-Scaffolding-Performance-Requirement.pdf
- EN 1993-1-1 §6.3.1.2, Tabel 6.1–6.2 (kurva tekuk): https://www.dlubal.com/en-US/support-and-learning/support/knowledge-base/001622 ; SCI Advisory Desk AD 546: https://www.steelconstruction.info/images/d/d4/AD-546.pdf
- NASC TG20:21, nilai beban aksial aman pipa dan kapasitas klem sebagaimana dikutip dalam PSD Calculation No. 9989-1 E (30 Juni 2022), hlm. 3: https://docs.planning.org.uk/20220921/27/RF9QPMBC0E700/u4qbkc35h6ia08xh.pdf ; produk NASC: https://nasc.org.uk/product-category/technical-guidance
- Scaffolders Forum, kutipan TG20:13 Tabel 5.15 dan BS 5973 Tabel 17 (sumber sekunder): https://scaffoldersforum.com/goto/post?id=358682
- CFMEU Victoria, *Scaffold Guide* (2024), kelas duty AS/NZS 1576.1: https://vic.cfmeu.org/wp-content/uploads/2024/08/scaffold-guide-web.pdf
- Edisi standar dan regulasi terverifikasi: `site/assets/data/regulasi.js` (BS EN 74-1:2022, BS EN 39:2001, NASC TG20:21, AS/NZS 1576.1:2019, AS 4576:2020, SNI 8987:2021, Permenaker 9/2016, Kepmenaker 46/2022).
