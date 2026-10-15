# Koreksi Metode Perhitungan — PPAPI Scaffold v2.3.0 dan v2.4.0 (Beta)

Dokumen tinjauan teknis untuk pemilik aplikasi dan **Komite Teknis PPAPI**.

| | |
|---|---|
| Aplikasi | PPAPI Scaffold — Perencanaan & Analisis Struktur (`aplikasi/perencanaan/`) |
| Versi | **2.4.0 (Beta)**, 9 Oktober 2026: revisi hasil tinjauan independen atas 2.3.0 (bagian 19). Sebelumnya: 2.3.0 (koreksi E1–E14) dan 2.2.0 (commit `7f828ba`) |
| Dasar keputusan | Persetujuan pemilik aplikasi: **"Koreksi + tandai Beta"** |
| Temuan yang dikoreksi | `devtools/legacy/ANALISIS_PERENCANAAN.md` §2.6–2.7 (E1–E14) dan §4 (bug pasti); tinjauan independen 9 Oktober 2026 (`devtools/flows/verify-eng-perencanaan.mjs`, bagian 19) |
| Status | **Beta** — metode perhitungan telah dikoreksi dan menunggu tinjauan Komite Teknis PPAPI. Hasil bersifat indikatif dan wajib diverifikasi oleh ahli perancah yang kompeten. |
| Berkas yang berubah | `aplikasi/perencanaan/app.js`, `index.html`, `app.css`; dokumen ini; `aplikasi/CATATAN.md` |
| Perhitungan acuan independen | `devtools/flows/aplikasi-perencanaan-ref.mjs` (tidak memanggil kode aplikasi) |
| Uji regresi | `devtools/flows/aplikasi-perencanaan-koreksi.mjs`, `devtools/flows/aplikasi-perencanaan-temuan.mjs` (temuan tinjauan v2.4.0), dan `devtools/flows/aplikasi-flow.mjs` |

Rujukan baris: "lama" menunjuk `app.js`/`index.html` versi 2.2.0 (commit `7f828ba`) dan, bila disebut, `index.html` aplikasi asal (`devtools/legacy/asosiasi.ppapi-main`). "Baru" menunjuk `app.js` versi 2.3.0. Bagian 1–18 mendokumentasikan koreksi 2.3.0; angka yang berubah pada 2.4.0 diberi catatan di tempatnya dan dirinci pada bagian 19. Lokasi kode 2.4.0 disebut dengan nama fungsi.

---

## 0. Ringkasan

1. **Satu dasar keamanan (E6).** Semua pemeriksaan kini memakai metode tegangan izin: *beban kerja tanpa faktor ≤ kapasitas izin*, dengan kapasitas izin = tahanan karakteristik ÷ (γ<sub>M</sub> 1,1 × γ<sub>F</sub> 1,5) sesuai BS EN 12811-1:2003 §10.3.2. SF 1,5 pada beban hidup dan FK 1,5 pada beban rencana dihapus.
2. **Kelas duty dari bay terberat (E4).** Isian Tahap 2 kini berarti beban pada satu bay yang paling berat; tidak lagi dirata-ratakan ke seluruh bay. Beban terpusat terbesar ikut menentukan kelas.
3. **Beban tiang dari geometri (E1, E2).** Jumlah bay, lift, lift berpapan, dan platform kerja diambil dari Data Proyek. Beban dihitung per posisi tiang dengan lebar pengaruh; yang diperiksa adalah tiang **terbesar**.
4. **Kapasitas tekuk dihitung (E3).** Perry–Robertson dalam bentuk EN 1993-1-1 §6.3.1.2, panjang efektif = k × tinggi lift, pipa 48,3 × 4,0 atau 48,3 × 3,2 mm. Dengan kurva c hasilnya **sama dengan tabel beban aksial aman NASC TG20:21** (selisih ≤ 0,5 %, lihat §5).
5. **Klem siku (E5, E14).** Reaksi pada simpul ledger–tiang yang paling dibebani dibandingkan dengan 6,06 kN (kelas A) atau 9,09 kN (kelas B). Nilai ini diturunkan dari BS EN 12811-1:2003 Tabel C.1 dan setara dengan NASC TG20:21 (6,1 / 9,1 kN). Nilai BS 5973 (6,3 / 9,4 kN) tidak dipakai lagi.
6. **Papan, pondasi, checklist, rujukan (E7–E14).** Beban terpusat papan diperiksa terhadap data pabrikan. Pondasi memakai beban tiang terbesar. Kategori FRM otomatis N/A untuk perancah tubular. N/A pada butir kritis wajib beralasan. Rujukan diperbarui; KEP-74/PPK/XII/2013 dihapus sampai dapat diverifikasi.
7. **Tanda Beta** tampil di semua tampilan aplikasi, judul halaman, bilah portal, beranda, menu Tentang, kesimpulan otomatis, dan kaki setiap halaman laporan PDF.
8. **Revisi 2.4.0 (bagian 19).** Pemeriksaan lentur transom dan ledger ditambahkan. Beban tiang model independent memuat 50 % beban layan pada satu lift berpapan berikutnya (BS EN 12811-1:2003 §6.2.9.2 a)3) dan pagar ujung pada tiang ujung. Kelas Tahap 2 yang tidak diterapkan, jenis pipa yang belum dipilih, kurva tekuk a, dan rincian material lama ditandai CEK. Data 2.2.0 dengan material bawaan 393 kg dimigrasi. Scaffold tag dan PDF tidak lagi menyatakan "aman digunakan" bila analisis struktur berstatus PERLU REVIEW.

**Kasus acuan** (3 bay × 2,4 m, lebar 1,2 m, 4 lift × 2,0 m, 2 lift berpapan, 1 platform kerja, Medium Duty, pipa 48,3 × 4,0 mm):

| Besaran | v2.2.0 | v2.3.0 | v2.4.0 |
|---|---|---|---|
| Kelas duty dari isian bawaan Tahap 2 | 645 kg ÷ 3 bay = 215 kg → **Light** | bay terberat 430 kg → **Medium** | sama dengan v2.3.0 |
| Beban yang diperiksa pada tiang | 472,0 kg (4,63 kN): rata-rata, sudah × 1,5 | 480,8 kg (4,72 kN): tiang tengah sisi luar, beban kerja | **593,0 kg (5,82 kN)**: ditambah 50 % beban layan pada lift berpapan kedua (§19.5) |
| Kapasitas tiang | 2.500 kg (24,5 kN), angka tetap | **29,08 kN (2.965 kg)**, dihitung, L<sub>e</sub> 2,0 m | 29,08 kN |
| Rasio pemanfaatan tiang | 0,19 | 0,16 | **0,20** |
| Reaksi klem siku | 4,63 kN vs 6,3 kN (rasio 0,73) | **2,64 kN vs 6,06 kN (rasio 0,44)** | sama dengan v2.3.0 |
| Lentur transom | tidak diperiksa | tidak diperiksa | **1,10 kNm vs 1,12 kNm (rasio 0,98)** (§19.2) |
| Tekanan pondasi (A = 0,04 m²) | 11.799 kg/m² | 12.020 kg/m² | **14.824 kg/m²** |
| Estimasi material bawaan | 8 komponen tetap, 393 kg | 13 komponen, 228 pcs, 1.626 kg | **14 komponen, 248 pcs, 1.704 kg** (set pagar ujung, §19.11) |

Untuk kasus acuan ini rasio tiang v2.3.0 berubah sedikit karena dua koreksi saling mengimbangi: beban tiang menentukan 33 % di atas rata-rata (E1), sedangkan FK ganda dihapus dan kapasitas pada lift 2,0 m ternyata di atas 2.500 kg. Perbedaannya menjadi tajam pada lift tinggi, pipa 3,2 mm, dan banyak platform kerja. Pada skenario C (§15), metode lama menyatakan rasio 0,63 (aman), metode v2.3.0 memberi **1,04**, dan v2.4.0 memberi **1,15 (tidak memenuhi)**.

---

## 1. Kasus acuan dan asumsi model

**Kasus acuan.** Perancah independent tube & coupler dengan 3 bay × 2,4 m dan lebar 1,2 m (dua baris tiang). Terdapat 4 lift × 2,0 m ditambah lift dasar (kicker), sehingga platform teratas di 8,0 m dan tiang setinggi 9,0 m (menjulang 1,0 m untuk pagar). Ada 2 lift berpapan, dan 1 platform kerja dibebani Medium Duty 4,4 kN per bay. Pipa 48,3 × 4,0 mm, kurva tekuk c, k = 1,0, klem siku kelas A, dan bidang dukung 0,04 m² per tiang. Isian ini sama dengan nilai bawaan aplikasi, ditambah **Jumlah Lift = 4**.

**Model beban tiang.**

- **Posisi tiang.** Tiang tengah memikul 1 bay (½ bay kiri + ½ bay kanan), tiang ujung ½ bay. Setiap baris (dalam dan luar) memikul ½ lebar platform. Pembagian ini sesuai cara BS EN 12811-1:2003 §6.2.2.1: batas area beban adalah garis tengah antar-tiang, dan hanya beban merata q₁ yang diteruskan ke struktur.
- **Berat sendiri per level** (lift dasar + setiap lift): ledger sepanjang lebar pengaruh, ½ transom (lebar + 0,2 m), dan 2 klem siku per simpul.
- **Tiang:** tinggi platform teratas + 1,0 m, ditambah klem sambung untuk setiap 6 m.
- **Bracing:** 2 × jumlah lift batang diagonal √(L² + h²) dan (4 × lift + 4) klem putar, dibagi rata ke semua tiang. Jumlah ini sama dengan estimasi material aplikasi lama.
- **Lift berpapan:** metal plank 5,2 kg/m per lembar, jumlah lembar = maks(3, bulat(B/0,24)) per bay. Pagar (guardrail + midrail, 2 pipa) dan papan kaki 5 kg per 2,4 m hanya di **sisi luar**, termasuk 2 klem siku per tiang.
- **Beban hidup:** q<sub>duty</sub> × lebar pengaruh × ½ × jumlah platform kerja. Seluruh bay pada platform kerja dibebani penuh. Sejak v2.4.0 ditambah 50 % beban layan pada satu lift berpapan berikutnya bila ada lift berpapan yang bukan platform kerja (BS EN 12811-1:2003 §6.2.9.2 a)3; §19.5).
- **Pagar ujung (sejak v2.4.0):** pada setiap lift berpapan, kedua ujung perancah diberi 2 rail (B + 0,2 m) dan papan kaki selebar B; setiap tiang ujung (dalam dan luar) memikul separuhnya ditambah 2 klem siku (§19.11).
- **Tidak dimasukkan:** base plate dan sole board (berada di bawah tiang), tangga (dianggap pada bay akses terpisah), dan papan lift dalam (*hop-up*). Pada v2.3.0 pagar ujung juga tidak dimasukkan dengan alasan tidak memengaruhi tiang menentukan; alasan itu keliru untuk menara 1 bay, karena tiang ujung justru menentukan (+5,5 % pada skenario menara 1 bay uji K2).

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
| **Contoh** | Kasus acuan, model suspended dengan 2 tali. Sebelum: T = (393 + 1.346) × 1,5 / 2 = 1.304 kg (12,79 kN). Sesudah, dengan material yang diestimasi dari geometri: T = (1.626 + 1.346) / 2 = **1.486 kg (14,57 kN)**. Nilai ini dibandingkan dengan MBL/FoS tanpa faktor tambahan. Kenaikan T berasal dari estimasi material yang kini lengkap, bukan dari faktor. **v2.4.0:** estimasi material bertambah dengan set pagar ujung menjadi 1.704 kg, sehingga T = (1.704 + 1.346) / 2 = **1.525 kg (14,96 kN)**. Data v2.2.0 yang masih menyimpan 8 komponen bawaan (393 kg) kini dikenali dan diganti estimasi geometri (§19.1); tanpa itu T hanya 869,5 kg (8,53 kN) dan tali dinyatakan memenuhi. |

---

## 3. E4 — Kelas duty dari bay terberat (+ beban terpusat)

| | |
|---|---|
| **Masalah** | Kelas duty adalah batas **per bay per platform**, tetapi aplikasi membagi total beban hidup ke semua bay dan platform. Material yang menumpuk di satu bay tidak terdeteksi. |
| **Sebelum** | `perBay = tot/(N_bay × N_platform)`, dengan `tot = (n·w + alat + material + impact) × SF` (app.js lama baris 994–1001; aplikasi asal baris 1702). |
| **Sesudah** | `W_bay = n·w + W_alat + W_material + impact% × (W_alat + W_material)`, diisi untuk **satu bay terberat**, tanpa SF. Kelas = maksimum dari (a) W<sub>bay</sub> ≤ 225/450/675 kg → Light/Medium/Heavy, dan (b) beban terpusat terbesar ≤ 100/150/200 kg (v2.3.0 membandingkan ≤ 1,0/1,5/2,0 kN; dikoreksi pada v2.4.0, §19.8). Di atas itu Special: kN = ⌈W<sub>bay</sub> · g/100⌉/10, minimal 6,6 kN. Fungsi `llData()`, app.js baru baris 1220. |
| **Alasan** | Batas kelas berlaku untuk setiap bay sehingga harus dibandingkan dengan bay yang paling berat. Beban terpusat adalah bagian definisi kelas duty. |
| **Sumber** | AS/NZS 1576.1:2019. Kelas Light/Medium/Heavy = 225/450/675 kg per platform per bay, dengan beban terpusat 100/150/200 kg: [CFMEU Victoria, *Scaffold Guide* 2024](https://vic.cfmeu.org/wp-content/uploads/2024/08/scaffold-guide-web.pdf); WorkSafe ACT (dikutip di ANALISIS_PERENCANAAN Lampiran B). |
| **Contoh** | Isian bawaan (2 orang × 90, alat 50, material 150, impact 25 %). Sebelum: (180 + 50 + 150 + 50) × 1,5 = 645 kg ÷ 3 bay = 215 kg → **Light**. Sesudah: 180 + 50 + 150 + 50 = **430 kg → Medium**. Dengan 4 orang dan material 300 kg: sebelum 1.196 ÷ 3 = 399 kg → Medium; sesudah 797,5 kg → **Special 7,9 kN**. Benda tunggal 180 kg (1,77 kN) → **Heavy**. Kelas yang direkomendasikan Tahap 2 kini wajib diterapkan; bila kelas pada Tahap 3 lebih rendah, analisis berstatus PERLU REVIEW (§19.4). |

---

## 4. E1 dan E2 — Beban tiang dari geometri; beban maksimum, bukan rata-rata

| | |
|---|---|
| **Masalah** | (E1) `W*/n_tiang` membagi rata seluruh beban ke semua tiang, padahal tiang tengah memikul dua kali beban tiang ujung dan sisi luar memikul pagar. (E2) Jumlah tiang (bawaan 6), bay dibebani (3), dan klem (8) diisi bebas, tidak diturunkan dari geometri. Akibatnya Tahap 5 dan Tahap 6 bisa memakai jumlah bay yang berbeda. |
| **Sebelum** | `live = kgBay × an-bay × an-lantai`; `perT = (W_d + live) × FK / an-tiang` (app.js lama baris 819–823; aplikasi asal 1531, 1565). Isian `an-tiang`, `an-bay`, dan `an-nklem` ada di index.html lama baris 319, 291, 335. Pada v2.2.0 hanya ada kotak SARAN (B6). |
| **Sesudah** | `geom()` (app.js baru baris 925) membaca bay, panjang bay, lebar, tinggi lift, jumlah lift (atau tinggi ÷ tinggi lift), jumlah lift berpapan (isian baru `f-papan`), platform kerja, dan jenis pipa (isian baru `f-pipa`). `stdLoad()` dan `stdAll()` (baris 948, 959) menghitung empat posisi tiang dan menandai yang terbesar. Rumus: **N = [H<sub>s</sub>·m + n<sub>sambung</sub>·1,1 + (n<sub>lift</sub>+1)·(t·L·m + ½(B+0,2)·m + 2·1,2) + W<sub>bracing</sub>/n<sub>tiang</sub>] + n<sub>papan</sub>·t·½·W<sub>papan/bay</sub> + [sisi luar] n<sub>papan</sub>·(t·L·(2m + m<sub>kaki</sub>) + 2·1,2) + n<sub>kerja</sub>·t·½·q<sub>duty</sub>**, dengan t = 1 (tiang tengah) atau ½ (tiang ujung). |
| **Alasan** | Batas kekuatan ditentukan oleh tiang yang paling dibebani. Analisis membaca geometri secara langsung. Rincian material Tahap 5 juga berasal dari geometri, tetapi pada v2.3.0 rincian itu baru diperbarui saat tombol *Estimasi Otomatis* ditekan, sehingga klaim "satu sumber data" hanya berlaku untuk analisis tiang. Sejak v2.4.0 rincian otomatis mengikuti perubahan geometri, sedangkan rincian yang disunting ditandai CEK bila geometrinya berubah (§19.7). |
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
| **N maksimum v2.3.0** | | **480,81 kg = 4,715 kN** |
| v2.4.0: 50 % beban layan pada lift berpapan kedua (§19.5) | 0,5 × 224,34 | 112,17 |
| **N maksimum v2.4.0** | | **592,98 kg = 5,815 kN** |

Posisi lain (v2.3.0): tiang tengah sisi dalam 424,06 kg, tiang ujung sisi luar 285,24 kg, dan tiang ujung sisi dalam 254,47 kg. Rata-rata 8 tiang = 361,14 kg, sehingga tiang menentukan = **133 %** dari rata-rata. Selisih sepertiga inilah yang tidak terlihat oleh metode lama (E1). Pada v2.4.0 nilainya 536,22 / 360,86 / 330,09 kg (tiang ujung kini memikul set pagar ujung 9,77 kg per lift berpapan), rata-rata 455,04 kg, dan tiang menentukan 130 % dari rata-rata.

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
| **Validasi** | NASC TG20:21 mencantumkan "safe axial load" pipa 48,3 × 4,0 (BS EN 39 tipe 4, f<sub>y</sub> 235): 51,9 / 39,2 / 29,1 / 22,0 / 17,1 / 13,6 kN pada L<sub>e</sub> 1,2 / 1,6 / 2,0 / 2,4 / 2,8 / 3,2 m. Nilai ini dikutip dalam perhitungan desain PSD No. 9989-1 E (Fraser House, Manchester, 30 Juni 2022, hlm. 3: [docs.planning.org.uk](https://docs.planning.org.uk/20220921/27/RF9QPMBC0E700/u4qbkc35h6ia08xh.pdf)). Rumus aplikasi dengan kurva c menghasilkan 51,88 / 39,10 / 29,08 / 21,98 / 17,04 / 13,54 kN. Pada 11 panjang efektif yang ditabelkan (1,2–3,2 m) selisihnya **0 sampai −0,5 %**. Di antara titik tabel nilainya dapat sedikit di atas TG20, **paling banyak +0,3 %**: pada L<sub>e</sub> 2,5 m rumus memberi 20,58 kN, sedangkan PSD 9989-1 E hlm. 14 mengutip 20,53 kN dari TG20:21 (+0,23 %). Versi sebelumnya dokumen ini menyatakan "tidak pernah di atas TG20"; pernyataan itu hanya benar pada titik tabel (§19.9). Pemeriksaan ini otomatis untuk 11 panjang efektif dan titik 2,5 m (uji K0). Kurva a memberi nilai **12–23 %** di atas TG20 (+12,0 % pada L<sub>e</sub> 3,2 m; +22,9 % pada 1,6 m), karena itu bukan bawaan dan sejak v2.4.0 selalu ditandai CEK (§19.10). |

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
| **Sesudah** | UDL = q<sub>duty</sub>/(L × B) ≤ isian `an-udl` (bawaan 250 kg/m², dari aplikasi lama). Beban terpusat kelas ≤ isian `an-ptpapan` (kN, data pabrikan). **Selama isian beban terpusat kosong, pemeriksaan bertanda CEK** sehingga hasil tidak dapat dinyatakan lolos tanpa data papan. Lebar platform minimum tetap 450/900/1.000 mm (Q4). **v2.4.0:** beban terpusat rencana = maksimum dari nilai kelas dan beban terpusat Tahap 2; kelas Special memakai isian beban terpusat Special (`an-sdpt`, minimal 2,0 kN, diisi dari Tahap 2) sehingga benda 300 kg diperiksa sebagai 2,95 kN, bukan 2,0 kN (§19.3). |
| **Sumber** | BS EN 12811-1:2003 Tabel 3 dan §6.2.2.1: setiap area kerja harus mampu memikul q₁, F₁, dan F₂ secara terpisah. Kapasitas papan bergantung pada jenis dan bentangnya (ANALISIS_PERENCANAAN §2.6). |
| **Contoh** | Medium, bay 2,4 × 1,2 m: UDL = 448,68/2,88 = 156 kg/m² ≤ 250 → OK. Beban terpusat 1,5 kN ≤ 2,0 kN (bila diisi) → OK. Heavy (2,0 kN) dengan papan 1,8 kN → CEK. |

---

## 8. E8 — Pondasi

| | |
|---|---|
| **Masalah** | q = N/A memakai N rata-rata (yang juga sudah difaktorkan) dan luas pelat dasar saja. |
| **Sebelum** | `bearing = perT/plateA` (app.js lama baris 823). |
| **Sesudah** | **q = N<sub>maks</sub>/A<sub>dukung</sub> ≤ daya dukung izin**. Isian luas diberi label "Luas bidang dukung per tiang — base plate/sole board", sehingga luas sole board dapat dimasukkan. |
| **Contoh** | Sebelum: 472,0/0,04 = 11.799 kg/m², atau 10.869 kg/m² dengan isian bawaan. v2.3.0: 480,81/0,04 = 12.020 kg/m². **v2.4.0: 592,98/0,04 = 14.824 kg/m² > 10.000 → CEK** (perlu bidang dukung ≥ 0,059 m² atau landasan lebih baik). |

---

## 9. E9 — Model suspended dan mobile

- **Suspended:** T = W/n<sub>tali</sub> ≤ MBL/FoS, dengan W = beban mati Tahap 5 + beban hidup, tanpa faktor (E6). Kebutuhan counterweight: n = ⌈3·T·L<sub>out</sub>/(L<sub>in</sub>·m<sub>cw</sub>)⌉. Asumsi kini dinyatakan di layar dan di PDF: beban dibagi rata ke semua tali, satu needle per tali, dan berat needle diabaikan. Nilai FoS 6/10 dan faktor stabilitas 3 **dipertahankan dari aplikasi lama** karena nomor klausul AS/NZS 1576.1 dan AS 4576 yang dicantumkan tidak dapat diverifikasi (Q8).
- **Mobile:** beban per castor = W/n<sub>castor</sub> ≤ WLL. Rasio H:B 3,5/3,0 dipertahankan dengan catatan bahwa batas yang berlaku adalah instruksi pabrikan menara (BS EN 1004).
- **Beban mati (sejak v2.4.0):** W<sub>d</sub> = maksimum dari rincian Tahap 5 dan estimasi material dari geometri, agar rincian lama atau basi tidak dapat meloloskan tali dan castor (§19.1). Beban hidup memakai platform kerja saja; aturan 50 % BS EN 12811-1 §6.2.9.2 berlaku untuk perancah fasad (model independent).
- **Contoh** (kasus acuan). v2.3.0, material estimasi 1.626 kg: suspended 2 tali T = (1.626 + 1.346,04)/2 = 1.486,0 kg (14,57 kN) > 60/6 = 10 kN → CEK; counterweight 45 buah; mobile 743,0 kg per castor > WLL 500 kg → CEK. **v2.4.0**, material 1.704 kg: T = (1.704 + 1.346,03)/2 = **1.525,0 kg (14,96 kN)** → CEK; counterweight ⌈3 × 1.525,0 × 0,9/(3,6 × 25)⌉ = **46 buah**; castor **762,5 kg** → CEK. Sebelum (v2.2.0): 1.304 kg dan 40 buah, dengan 8 komponen material bawaan dan × 1,5.

---

## 10. E10 — Kekokohan

Label "Kekokohan terpenuhi" diganti menjadi **"Indikasi kekokohan"**. Butirnya diturunkan dari checklist BRC/STB dan batas bentang 2,4 m. Klaim yang tidak dapat diverifikasi ("tie menahan 2,5 % beban vertikal, kapasitas ≥ 6,0 kN, AS 1576.1 kl. 2.8.3") dihapus dari layar dan PDF. Aplikasi menyatakan dengan jelas bahwa **jarak dan kapasitas tie serta beban angin tidak dihitung**. Label hasil "INDIKASI AMAN" diganti dengan **"LOLOS PEMERIKSAAN INDIKATIF"** yang disertai keterangan "bukan sertifikasi". Kotak status memakai "MEMENUHI" (misalnya "TIANG MEMENUHI") alih-alih "KUAT" atau "AMAN". Sejak v2.4.0 model independent memiliki isian **"Perancah diikat ke bangunan"**: perancah berikat tidak lagi diperiksa dengan kaidah perancah bebas berdiri H ≤ 3 × B<sub>min</sub>, tetapi diberi butir INFO bahwa tie dan beban angin wajib didesain tersendiri (§19.14).

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

| Skenario | Sebelum: beban/tiang (×1,5) → rasio | v2.3.0: N<sub>maks</sub> → N<sub>izin</sub> → rasio | v2.4.0: N<sub>maks</sub> → rasio tiang · lentur transom | Klem sebelum → sesudah |
|---|---|---|---|---|
| **A** acuan (3 bay, Medium, 4 lift × 2,0 m, pipa 4,0) | 472,0 kg → 0,19 | 480,8 kg (4,72 kN) → 29,08 kN → **0,16** | 593,0 kg (5,82 kN) → **0,20** · transom 1,10/1,12 kNm = 0,98 | 4,63 → 2,64 kN |
| **B** 3 bay, Medium, 5 lift × 2,7 m, 3 lift berpapan, 2 platform kerja, pipa 3,2 | 783,6 kg → 0,31 | 770,4 kg (7,56 kN) → 15,16 kN → **0,50** | 882,6 kg (8,66 kN) → **0,57** · transom 1,10/0,93 kNm = **1,18 (CEK)** | 7,68 (CEK) → 2,61 kN |
| **C** 4 bay, Heavy, 7 lift × 2,7 m, 7 lift berpapan, 3 platform kerja, pipa 3,2 | 1.566,9 kg → **0,63 (lolos)** | 1.603,4 kg (15,72 kN) → 15,16 kN → **1,04 (CEK)** | 1.771,6 kg (17,37 kN) → **1,15 (CEK)** · transom 1,54/0,93 kNm = **1,66 (CEK)** | 19,21 (CEK) → 3,71 kN |
| **D** 4 bay, Heavy, 6 lift × 2,0 m, 4 lift berpapan, 2 platform kerja, pipa 4,0 | 1.096,8 kg → 0,44 | 1.102,3 kg (10,81 kN) → 29,08 kN → **0,37** | 1.270,5 kg (12,46 kN) → **0,43** · transom 1,54/1,12 kNm = **1,37 (CEK)** | 13,44 (CEK) → 3,74 kN |

Skenario C menunjukkan sisi **tidak konservatif** metode lama: tiang dinyatakan lolos padahal kapasitas tekuk pada lift 2,7 m dengan pipa 3,2 mm terlampaui. Skenario B–D menunjukkan sisi **terlalu konservatif** metode lama pada klem: beban seluruh perancah dibagi 8 klem sehingga muncul "CEK" palsu. Kolom v2.4.0 menunjukkan bahwa dengan papan logam yang membentang 2,4 m, transom kelas Heavy (dan Medium dengan pipa 3,2 mm) melampaui momen izin; v2.3.0 tidak memeriksanya (§19.2).

---

## 16. Asumsi yang dipakai (untuk ditinjau)

1. Perancah independent tube & coupler, diikat (tie) dan di-bracing sehingga panjang efektif tiang = tinggi lift (k = 1,0).
2. Beban dibagi menurut lebar pengaruh (balok sederhana antar-simpul). Efek menerus ledger, yang memberi reaksi tumpuan tengah ±1,1–1,25 wL, tidak diperhitungkan (Q5).
3. Beban dianggap sentris. Eksentrisitas sambungan klem dan imperfeksi kemiringan sambungan tiang (BS EN 12811-1 §10.2.2.2) tidak dihitung terpisah; hanya imperfeksi batang yang tercakup kurva tekuk (Q3).
4. Setiap baris tiang memikul ½ lebar platform. Papan lift dalam (*hop-up*) dan beban di luar baris tiang tidak dimodelkan.
5. Seluruh bay pada setiap platform kerja dibebani penuh beban kelas duty. Jumlah platform kerja yang dibebani bersamaan diisi pengguna. Untuk model independent ditambah 50 % beban layan pada satu lift berpapan berikutnya (BS EN 12811-1:2003 §6.2.9.2 a)3).
6. Pagar dan papan kaki di sisi luar dan di kedua ujung, pada setiap lift berpapan. Tangga berada di bay akses terpisah.
7. Berat komponen non-pipa memakai nilai aplikasi lama (§1).
8. f<sub>y</sub> = 235 N/mm² untuk kedua tebal pipa (minimum BS EN 12811-1 §4.2.1.2).
9. Kapasitas izin = R<sub>k</sub>/1,65 untuk tiang, klem, transom, dan ledger. Untuk tali dan castor dipakai MBL/FoS dan WLL dari pengguna/pabrikan.
10. Papan logam membentang satu bay (atau ½ bay bila dipilih transom antara). Transom dan ledger dianalisis sebagai balok sederhana; satu beban terpusat kelas diletakkan pada posisi paling merugikan dan sisa beban kelas bay tersebut dianggap merata (§19.2).

## 17. Pertanyaan terbuka untuk Komite Teknis PPAPI

1. **Q1 — KEP-74/PPK/XII/2013.** Mohon salinan dokumen ini. Bila yang dimaksud adalah SKB Menaker/Menteri PU KEP-174/MEN/1986 dan 104/KPTS/1986 (K3 konstruksi, bab perancah), mohon konfirmasi. Dugaan ini belum diverifikasi.
2. **Q2 — Rujukan butir checklist.** Apakah butir yang merujuk BS 5973/BS 1139 dipetakan ulang ke BS EN 12811-1, TG20:21/SG4, AS 4576:2020, atau SNI 8987:2021? Pemetaan per butir memerlukan teks standar.
3. **Q3 — Eksentrisitas klem.** Apakah pemeriksaan interaksi tekan–lentur akibat eksentrisitas sambungan ledger (±50 mm) diwajibkan? TG20 diduga sudah memperhitungkannya dalam tabel beban aksial aman; validasi §5 menunjukkan kecocokan dengan tabel tersebut.
4. **Q4 — Lebar platform minimum.** Nilai 450/900/1.000 mm berasal dari aplikasi lama ("AS 4576 Tbl 8.7", tidak dapat diverifikasi). WorkSafe ACT menyebut Light ≥ 2 papan, Medium ≥ 4 papan, Heavy ≥ 5 papan (5 × 225 = 1.125 mm > 1.000 mm). Nilai mana yang dipakai?
5. **Q5 — Kontinuitas ledger.** Apakah reaksi simpul tengah perlu dikalikan faktor kontinuitas, misalnya 1,1–1,25, terutama untuk papan kayu yang menerus di atas beberapa transom?
6. **Q6 — Berat komponen.** Konfirmasi berat klem (1,2/1,4/1,1 kg), metal plank 5,2 kg/m, papan kaki, dan perlunya transom antara untuk papan kayu 38 mm (bentang 1,2 m).
7. **Q7 — Pipa 3,2 mm.** Apakah PPAPI menerima f<sub>y</sub> lebih tinggi untuk pipa 3,2 mm bermutu tinggi (dengan sertifikat)? Bila ya, berapa nilainya dan apa sumbernya? Saat ini dipakai 235 N/mm² (konservatif).
8. **Q8 — Suspended dan mobile.** Verifikasi FoS tali 6/10, faktor stabilitas counterweight 3, inboard ≥ 3 × outboard, dan rasio H:B 3,5/3,0 terhadap AS/NZS 1576.1:2019, AS 4576:2020, dan BS EN 1004 (nomor klausul lama tidak dapat diverifikasi).
9. **Q9 — Kurva tekuk a.** Apakah opsi kurva a (12–23 % di atas tabel TG20) dihapus saja, atau dipertahankan dengan syarat sertifikat pipa canai panas? Sejak v2.4.0 opsi ini selalu ditandai CEK dan wajib disertai alasan yang tercetak di PDF.
10. **Q10 — Jumlah platform kerja bersamaan.** Apakah aplikasi perlu membatasi jumlah platform kerja yang boleh dibebani bersamaan per kelas duty (AS/NZS 1576.1)?
11. **Q11 — Tie dan angin.** Apakah tahap berikutnya perlu menghitung jarak dan gaya tie serta beban angin (BS EN 12811-1 dan TG20)?
12. **Q12 — Dasar keamanan.** Konfirmasi bahwa PPAPI memakai dasar tegangan izin R<sub>k</sub>/1,65, setara TG20, sebagai dasar tunggal aplikasi.
13. **Q13 — Label Beta.** Kriteria apa yang harus dipenuhi agar label Beta dapat dicabut, misalnya uji banding terhadap desain TG20 yang sudah disahkan?
14. **Q14 — Beban terpusat pada transom dan ledger.** v2.4.0 menggabungkan satu beban terpusat kelas dengan sisa beban kelas yang merata (definisi kelas AS/NZS 1576.1: beban per bay *termasuk* beban terpusat). BS EN 12811-1 §6.2.2.1 memeriksa q₁, F₁, dan F₂ secara terpisah, dan perhitungan TG20 (mis. PSD 9989-1 E hlm. 8–9) memeriksa transom dengan beban merata saja. Pendekatan mana yang dipakai PPAPI? Akibatnya besar: Medium Duty dengan pipa 3,2 mm pada bay 2,4 × 1,2 m lolos dengan beban merata saja (rasio 0,82) tetapi CEK dengan penggabungan (1,18).
15. **Q15 — Ledger dengan transom antara.** Ledger kini dianalisis sebagai balok sederhana dengan reaksi transom antara di tengah bentang. Apakah faktor kontinuitas boleh dipakai, dan apakah ledger ganda (seperti PSD hlm. 10) atau bentang bay ≤ 1,8 m disyaratkan untuk kelas Heavy?
16. **Q16 — Level berpapan 50 %.** BS EN 12811-1 §6.2.9.2 a)3 mensyaratkan 50 % beban layan pada satu level berpapan berikutnya. Apakah PPAPI menerimanya untuk kelas duty AS/NZS, atau menetapkan aturan jumlah platform bersamaan tersendiri (terkait Q10)?

---

## 18. Cara memverifikasi ulang

```
cd devtools
node flows/aplikasi-perencanaan-ref.mjs            # laporan kasus acuan, sebelum/sesudah, sensitivitas
node flows/aplikasi-perencanaan-koreksi.mjs        # acuan vs aplikasi, matriks skenario, Tahap 2, Beta, PDF, ponsel, axe
node flows/aplikasi-perencanaan-temuan.mjs         # v2.4.0: setiap temuan tinjauan independen direproduksi lalu diuji (bagian 19)
node flows/verify-eng-perencanaan.mjs              # skrip peninjau (pembanding): temuan B2–B8 tidak lagi muncul
node flows/aplikasi-flow.mjs --only=B,C            # regresi SSO, sembilan tahap, bug B1–B10, keamanan
node check.mjs aplikasi/perencanaan/index --auth   # 0 masalah (desktop + ponsel)
```

Perhitungan acuan disusun ulang secara independen: setiap batang dienumerasi dan reaksinya dibagikan ke simpul, lalu tekuk dihitung dari sifat penampang dan dicek silang dengan bentuk tegangan Perry–Robertson. Rumus lama juga ditulis ulang di modul ini dan **mereproduksi seluruh nilai acuan lama** (ANALISIS_PERENCANAAN §2.8), sehingga kolom "sebelum" pada dokumen ini setia pada aplikasi lama.

---

## 19. Revisi v2.4.0 — hasil tinjauan independen (9 Oktober 2026)

Tinjauan independen atas v2.3.0 (`devtools/flows/verify-eng-perencanaan.mjs`) mereproduksi seluruh nilai acuan v2.3.0 (§4, §5, §15) secara terpisah, tetapi menemukan celah yang tercantum di bawah. Seluruhnya diperbaiki pada **v2.4.0**, dan aplikasi tetap berstatus **Beta**. Nilai harapan dihitung ulang oleh modul acuan independen `aplikasi-perencanaan-ref.mjs`, yang juga diperluas untuk butir 19.2, 19.5, 19.8, dan 19.11. Setiap temuan direproduksi lalu diuji oleh `aplikasi-perencanaan-temuan.mjs`.

| § | Temuan | Tingkat | Perbaikan v2.4.0 |
|---|---|---|---|
| 19.1 | Data v2.2.0 membawa material bawaan 393 kg sehingga tali dan castor lolos | tinggi | Rincian bawaan dikenali dan diganti estimasi geometri; rincian lama ditandai CEK; suspended/mobile memakai beban mati terbesar |
| 19.2 | Lentur transom dan ledger tidak diperiksa | tinggi | Pemeriksaan baru terhadap momen izin TG20:21; isian transom antara |
| 19.3 | Beban terpusat Special diperiksa dengan 2,0 kN tetap | sedang | Beban terpusat rencana dari Tahap 2 / isian Special |
| 19.4 | Rekomendasi kelas Tahap 2 tidak ditegakkan | sedang | CEK bila kelas dipilih lebih rendah; tampil di tag dan PDF |
| 19.5 | 50 % beban layan pada level berpapan berikutnya tidak diterapkan | sedang | BS EN 12811-1 §6.2.9.2 a)3 diterapkan pada model independent |
| 19.6 | Tag dan PDF menyatakan "aman digunakan" walaupun analisis gagal | sedang | Status akhir = checklist + analisis; tag KUNING "menunggu verifikasi desain" |
| 19.7 | Material Tahap 5 tidak mengikuti perubahan geometri | sedang | Rincian otomatis diperbarui; rincian disunting ditandai bila geometri berubah |
| 19.8 | Batas kelas beban terpusat dibulatkan ke kN | rendah | Dibandingkan dalam kg (100/150/200) |
| 19.9 | Klaim "tidak pernah di atas TG20" | rendah | Rumusan §5 dikoreksi (0 sampai −0,5 % di titik tabel; ≤ +0,3 % di antaranya) |
| 19.10 | Kurva a dapat meloloskan skenario C | rendah | Kurva a selalu CEK, alasan wajib dan tercetak |
| 19.11 | Pagar ujung diabaikan; label catatan berat sendiri keliru | rendah | Set pagar ujung pada tiang ujung dan material; label dari posisi yang dipakai |
| 19.12 | Data lama tanpa jenis pipa memakai pipa 4,0 mm | rendah | Jenis pipa "belum dipilih", dihitung 3,2 mm, CEK |
| 19.13 | Klaim rujukan pada teks antarmuka melebihi yang terverifikasi | rendah | Teks dibatasi pada yang terverifikasi |
| 19.14 | LOLOS praktis tidak tercapai untuk perancah berikat | rendah | Isian "diikat ke bangunan" |

### 19.1 Data v2.2.0 dengan material bawaan 393 kg (tinggi)

| | |
|---|---|
| **Masalah** | `save()` v2.2.0 selalu menyimpan `analisis.mats`, yaitu 8 komponen bawaan (393 kg) bila tidak pernah disunting. v2.3.0 mempertahankan baris itu saat dimuat, lalu E6 menghapus faktor × 1,5. Akibatnya tali dan castor yang dahulu CEK kini lolos tanpa pemberitahuan. Arsip proyek dan berkas .json lama mengalami hal yang sama. |
| **Sebelum (v2.3.0)** | Kasus acuan, suspended 2 tali: T = (393 + 1.346,04)/2 = 869,5 kg = 8,53 kN ≤ 10 kN → **TALI MEMENUHI**. Mobile 4 castor: 434,8 kg ≤ 500 → **CASTOR MEMENUHI**. v2.2.0 sendiri memberi 12,79 kN dan 652 kg (keduanya CEK). |
| **Sesudah** | `applyAnalisis()` mengenali asal rincian: (a) 8 baris yang identik dengan bawaan v2.2.0 diganti estimasi geometri dengan pemberitahuan; (b) rincian lama lain dipertahankan, ditandai **CEK** "berasal dari data versi sebelumnya", dan dapat diganti estimasi atau dikonfirmasi di Tahap 5; (c) rincian otomatis v2.3.0 yang belum disunting (13 baris, tanpa set pagar ujung) dikenali dan diperbarui ke estimasi v2.4.0 tanpa tanda CEK; (d) rincian v2.4.0 menyimpan asal (`matSrc`) dan kunci geometri (`matGeom`). Untuk suspended dan mobile, **W<sub>d</sub> = maks(rincian Tahap 5, estimasi geometri)** (`analisisData()`), sehingga rincian lama atau basi tidak dapat meloloskan tali dan castor. |
| **Contoh** | Rekaman v2.2.0 asli tidak menyimpan jenis pipa sehingga dihitung dengan pipa 3,2 mm (§19.12): estimasi 1.511,4 kg, T = (1.511,4 + 1.346,03)/2 = **1.428,7 kg (14,01 kN) → CEK**, castor **714,4 kg → CEK**. Bila pipa 4,0 mm dipilih: T = **1.525,0 kg (14,96 kN)**, castor **762,5 kg**. |
| **Uji** | `aplikasi-perencanaan-temuan.mjs` F5: penyimpanan peramban, arsip (`openProject`), dan impor .json; rincian lama yang disunting; konfirmasi. |

### 19.2 Lentur transom dan ledger (tinggi)

| | |
|---|---|
| **Masalah** | `analisisData()` memeriksa tiang, klem, pondasi, dan papan, lalu menyatakan kelompok KEKUATAN terpenuhi, padahal lentur transom dan ledger tidak pernah diperiksa. Model material aplikasi memakai metal plank 2,4 m yang bertumpu pada transom di simpul tiang saja, sehingga setiap transom tengah memikul satu bay penuh selebar B. Perancah Heavy, lebar 1,5 m, pipa 4,0, 2 lift dinyatakan **LOLOS PEMERIKSAAN INDIKATIF**. |
| **Sesudah** | `memberBending()`: transom tengah memikul ½ bay kiri + ½ bay kanan (dengan transom antara: ¼ + ¼ bay pada transom simpul dan ½ bay pada transom antara; menara 1 bay: ½ bay). Satu beban terpusat kelas F diletakkan di tengah bentang transom; bay yang memuat F menyumbang sisa bebannya (W<sub>q</sub> − F) secara merata, bay lain W<sub>q</sub> penuh: **M<sub>transom</sub> = [Σt·(W<sub>q</sub> + W<sub>papan</sub>) − t<sub>min</sub>·F]·B/8 + F·B/4 + w<sub>pipa</sub>·B²/8**. Bila dipilih transom antara (isian baru Data Proyek), ledger menerima reaksinya di tengah bentang dengan F di dekat ledger yang ditinjau: **M<sub>ledger</sub> = P·L/4 + w<sub>pipa</sub>·L²/8, P = ¼(W<sub>q</sub> − F + W<sub>papan</sub>) + F + ½ W<sub>transom antara</sub>**. Tanpa transom antara, ledger tidak memikul beban papan di antara simpul dan ditampilkan sebagai INFO. |
| **Kapasitas** | **M<sub>izin</sub> = W<sub>pl</sub>·f<sub>y</sub>/(γ<sub>M</sub>·γ<sub>F</sub>)**, W<sub>pl</sub> = (D³ − d³)/6 = 7.871 mm³ (48,3 × 4,0) atau 6.520 mm³ (48,3 × 3,2), sehingga **1,121 kNm** atau **0,929 kNm**. |
| **Sumber** | NASC TG20:21 Tabel 5.9, "Moment Capacity 1.12 kN.m" pipa 48,3 × 4,0, dikutip PSD Calc. 9989-1 E hlm. 3; dokumen yang sama memeriksa transom (hlm. 8–9) dan ledger (hlm. 9–10) terhadap nilai ini. BS EN 12811-1:2003 §10.3.3.2 (M<sub>pl,d</sub> = M<sub>pl,k</sub>/γ<sub>M</sub>) dan §6.2.2.3: jalur beban wajib mampu meneruskan beban terpusat ke tiang, dan posisinya dipilih yang paling merugikan. Definisi kelas AS/NZS 1576.1 (beban per bay **termasuk** satu beban terpusat): CFMEU Victoria, *Scaffold Guide* 2024. |
| **Contoh (hitungan tangan)** | Kasus acuan, Medium, pipa 4,0: W<sub>q</sub> = 4,40 kN, F = 1,5 kN, W<sub>papan</sub> = 5 × 2,4 × 5,2 kg = 0,612 kN, w<sub>pipa</sub> = 0,0429 kN/m. M = (4,40 + 0,612 − ½ × 1,5) × 1,2/8 + 1,5 × 1,2/4 + 0,0429 × 1,2²/8 = 0,639 + 0,450 + 0,008 = **1,097 kNm ≤ 1,121 kNm (rasio 0,98)**. Kasus temuan (Heavy, B 1,5 m, pipa 4,0): beban merata saja 1,387 kNm (temuan: 1,375 kNm tanpa berat pipa); dengan F **1,950 kNm, rasio 1,74 → CEK**, sehingga hasil menjadi PERLU REVIEW. Heavy, B 1,2 m: 1,540 kNm (1,37) dengan pipa 4,0 dan rasio 1,66 dengan pipa 3,2. Special 7,9 kN, B 1,2 m, pipa 4,0: 1,735 kNm (1,55). Dengan transom antara (Heavy, B 1,2 m, pipa 4,0): transom 1,074 kNm (0,96), ledger P = 3,34 kN, **M = 2,04 kNm (1,82) → CEK**. |
| **Catatan** | Penggabungan F dengan sisa beban merata mengikuti definisi kelas AS/NZS dan **lebih konservatif** daripada BS EN 12811-1 §6.2.2.1 (q₁, F₁, F₂ diperiksa terpisah) serta praktik TG20 dalam PSD 9989-1 E (transom diperiksa dengan beban merata saja). Contohnya Medium dengan pipa 3,2 mm pada bay 2,4 × 1,2 m: rasio 0,82 bila hanya beban merata, tetapi 1,18 (CEK) bila digabung. Pilihan dasar ini diajukan ke Komite (Q14, Q15). |

### 19.3 Beban terpusat pada kelas Special (sedang)

- **Masalah.** Beban terpusat > 2,0 kN menjadikan kelas Special, tetapi `dutyInfo()` untuk Special selalu memberi pt = 2,0 kN. Benda 300 kg (2,94 kN) pada papan berkapasitas 2,0 kN dinyatakan OK, padahal bebannya 47 % di atas kapasitas.
- **Sesudah.** Isian baru **Beban terpusat special duty** (`an-sdpt`, minimal 2,0 kN) diisi otomatis saat *Terapkan Kelas Duty*: 300 kg → 2,95 kN (dibulatkan ke atas 0,01 kN). Untuk semua kelas, **beban terpusat rencana = maks(nilai kelas, beban terpusat Tahap 2)** (`pointDesign()`), dipakai untuk papan dan transom serta dicetak di PDF.
- **Contoh.** 300 kg, papan 2,0 kN → "Beban terpusat kelas 2,95 kN > kapasitas … 2,00 kN" (CEK). Tanpa menekan *Terapkan* (kelas Heavy dipilih manual), papan tetap diperiksa terhadap 2,94 kN dari Tahap 2.

### 19.4 Kelas Tahap 2 ditegakkan (sedang)

- **Masalah.** Analisis hanya memakai kelas di Tahap 3, yang berubah bila *Terapkan* ditekan. Dengan 4 pekerja + 300 kg (797,5 kg → Special 7,9 kN) tanpa *Terapkan*, Tahap 3/6 tetap Medium dan menyatakan LOLOS untuk perancah 1 lift. Proyek v2.2.0 yang dahulu menerapkan Light (215 kg rata-rata) tetap Light, padahal Tahap 2 terkoreksi merekomendasikan Medium (430 kg); tag dan PDF ikut memakai Light.
- **Sesudah.** Butir baru dalam kelompok **DATA & ASUMSI MASUKAN**: bila beban kelas yang dipilih lebih kecil dari rekomendasi Tahap 2 → **CEK** "Kelas beban dipilih … lebih rendah dari rekomendasi Tahap 2 …", sehingga hasil menjadi PERLU REVIEW. Tag menampilkan baris "Rekomendasi Tahap 2 … lebih tinggi", PDF menandai baris "Bay terberat (Tahap 2)", dan kesimpulan otomatis menyebutnya.

### 19.5 BS EN 12811-1:2003 §6.2.9.2 a)3 — 50 % beban layan pada level berpapan berikutnya (sedang)

- **Masalah.** `stdLoad()` hanya membebani platform kerja. §6.2.9.2 (kombinasi beban perancah fasad, kondisi layan) mensyaratkan: a)2 beban layan merata kelasnya pada level berpapan paling merugikan, dan a)3 **50 % beban tersebut pada area kerja di level berikutnya (di atas atau di bawah) bila perancah memiliki lebih dari satu level berpapan**. Lampiran Nasional Inggris Tabel NB.1 merangkumnya: kombinasi dasar adalah dua platform, satu dibebani penuh dan satu 50 %. Teks dibaca langsung dari salinan standar (tautan di Lampiran).
- **Sesudah.** Untuk model independent (perancah fasad), bila jumlah lift berpapan > jumlah platform kerja, satu level tambahan dibebani 0,5 × q<sub>duty</sub> (`geom().nlive`, `stdLoad()`); beban hidup total dan pondasi ikut berubah. Model suspended dan mobile tidak diubah: §6.2.9.2 ditulis untuk perancah fasad, dan menara beroda mengikuti BS EN 1004/instruksi pabrikan (Q16).
- **Contoh.** Kasus acuan: N = 480,81 + 0,5 × 224,34 = **592,98 kg (5,82 kN)**, rasio tiang 0,20, pondasi **14.824 kg/m²**, beban hidup total 2.019 kg. Bila hanya ada satu lift berpapan, tidak ada level tambahan.

### 19.6 Tag dan verdict PDF mengikuti analisis struktur (sedang)

- **Masalah.** `tagHTML()` dan banner PDF hanya membaca checklist. Skenario C (rasio tiang > 1) dengan checklist seluruhnya sesuai menghasilkan tag "AMAN DIGUNAKAN · SAFE FOR USE · Heavy Duty" dan banner "VERDICT: HIJAU … Perancah layak dan aman digunakan". Pita Beta disembunyikan saat tag dicetak, sehingga tag tercetak tanpa catatan indikatif.
- **Sesudah.** `finalView()`: checklist HIJAU/KUNING dengan analisis PERLU REVIEW → status akhir **KUNING — Menunggu Verifikasi Desain**. Status ini dipakai tag ("MENUNGGU VERIFIKASI DESAIN · AWAITING DESIGN VERIFICATION"), banner Laporan, banner Data Proyek, chip status di bilah menu, dan banner PDF ("STATUS: KUNING - MENUNGGU VERIFIKASI DESAIN", ditambah baris "Checklist inspeksi: … | Analisis struktur indikatif (Beta): …"). Tag kini memuat baris **Analisis struktur** dan catatan Beta yang ikut tercetak. Tag HIJAU "AMAN DIGUNAKAN" hanya muncul bila checklist dan seluruh pemeriksaan indikatif terpenuhi.

### 19.7 Rincian material mengikuti geometri (sedang)

- **Masalah.** Rincian Tahap 5 hanya dibuat dari geometri saat dimuat pertama kali, saat Proyek Baru, atau saat *Estimasi Otomatis* ditekan. Mengubah Data Proyek menjadi 6 bay × 8 lift tetap meninggalkan 1.626 kg, padahal estimasi untuk geometri baru jauh lebih besar, dan tidak ada peringatan. Pernyataan §4 "satu sumber data" berlebihan (sudah dikoreksi).
- **Sesudah.** Rincian menyimpan asal dan kunci geometri (`matMeta`). Rincian otomatis diperbarui sendiri saat geometri berubah (`syncMaterials()`). Rincian yang disunting atau dikonfirmasi pengguna tidak diubah, tetapi bila geometri berubah ditandai di Tahap 5 dan menjadi CEK untuk suspended/mobile sampai diganti estimasi atau dikonfirmasi. Contoh 6 bay × 8 lift: rincian otomatis menjadi 4.484 kg.

### 19.8 Batas kelas beban terpusat dalam kg (rendah)

CFMEU Victoria (2024) memberi beban terpusat Light/Medium/Heavy 100/150/200 kg (0,98/1,47/1,96 kN). v2.3.0 membandingkan dengan 1,0/1,5/2,0 kN, sehingga 101 kg dinilai Light (sumber: Medium), 152 kg Medium (sumber: Heavy), dan 203 kg Heavy (sumber: Special). Sejak v2.4.0 batas dibandingkan dalam kg (`llData()`). Nilai bulat 1,0/1,5/2,0 kN tetap dipakai untuk pemeriksaan papan dan transom karena pembulatan ke atas bersifat konservatif.

### 19.9 Kesesuaian dengan tabel TG20 (rendah)

Rumusan §5 dikoreksi: selisih 0 sampai −0,5 % hanya berlaku pada 11 panjang efektif yang ditabelkan; di antaranya nilai aplikasi dapat sedikit di atas TG20, paling banyak +0,3 % (L<sub>e</sub> 2,5 m: 20,58 kN terhadap 20,53 kN, PSD 9989-1 E hlm. 14). Selisih ini jauh di bawah ketelitian data masukan dan tidak mengubah kesimpulan. Teks di layar Tahap 6 ikut diperbaiki. Rentang kurva a dinyatakan 12–23 %.

### 19.10 Kurva tekuk a (rendah)

Kurva a menaikkan N<sub>izin</sub> skenario C dari 15,16 menjadi 17,48 kN (+15 %), sehingga rasio turun dari 1,04 menjadi 0,90 dengan pengaman hanya teks opsi. Sambil menunggu keputusan Komite (Q9), kurva a **dipertahankan tetapi selalu CEK**. Isian alasan dan nomor sertifikat pipa wajib diisi dan tercetak di PDF, dan kapasitas kurva c ditampilkan sebagai pembanding. Hasil dengan kurva a tidak dapat mencapai LOLOS maupun tag HIJAU.

### 19.11 Pagar ujung dan label (rendah)

Pada menara 1 bay seluruh tiang adalah tiang ujung, sehingga pagar ujung yang diabaikan memengaruhi tiang menentukan. Sejak v2.4.0 setiap tiang ujung (dalam dan luar) memikul per lift berpapan: ½ × 2 rail (B + 0,2 m) + ½ papan kaki selebar B + 2 klem siku = **9,77 kg** (B = 1,2 m, pipa 4,0). Contoh menara 1 bay (uji K2): 177,45 → **187,22 kg (+5,5 %)**. Estimasi material ditambah baris "Pagar ujung (set per ujung)" dan 8 klem siku per lift berpapan; kasus acuan menjadi 14 komponen, 248 pcs, 1.704 kg. Catatan "Berat sendiri per lift" kini menyebut posisi yang benar-benar dipakai (mis. "tiang ujung · sisi luar" pada menara 1 bay).

### 19.12 Jenis pipa pada data lama (rendah)

Rekaman v2.2.0 tidak menyimpan jenis pipa, sedangkan teks Tahap 5 v2.2.0 menyebut pipa 3,2 mm. v2.3.0 diam-diam memakai pipa 4,0 mm (kapasitas +20 % pada lift 2,0 m). Sejak v2.4.0 rekaman tanpa jenis pipa memuat isian "Belum dipilih", dihitung sebagai **48,3 × 3,2 mm** (konservatif), dan ditandai **CEK** sampai pengguna memilih. Proyek baru tetap memakai 48,3 × 4,0 mm yang tampil sebagai pilihan.

### 19.13 Klaim rujukan pada teks antarmuka (rendah)

- Bantuan isian pipa tidak lagi mengaitkan SNI 8987:2021 dengan ukuran 48,3 × 4,0/3,2 mm atau f<sub>y</sub> 235. SNI 8987:2021 (*Pipa baja untuk perancah*) disebut sebagai standar produk nasional yang rinciannya belum diverifikasi; f<sub>y</sub> 235 dirujuk ke BS EN 12811-1 §4.2.1.2.
- Kalimat rujukan di beranda kini menyebut acuan **metode perhitungan** dan menyatakan bahwa rujukan butir checklist masih historis.
- Kotak "Lingkup" di menu Tentang disamakan dengan catatan Data Proyek (tanpa "JIS G3444").
- Baris "Acuan" pada tag menjadi "Acuan perhitungan" disertai catatan Beta/indikatif.

### 19.14 Perancah berikat (rendah)

Kaidah H ≤ 3 × B<sub>min</sub> berlaku untuk perancah tanpa ikatan, tetapi aplikasi tidak memiliki isian tie, sehingga setiap perancah fasad berikat di atas 3,6 m selalu PERLU REVIEW. Akibatnya LOLOS praktis hanya tercapai pada perancah 1–2 lift, tepat di wilayah yang sebelumnya diloloskan oleh celah 19.2. Isian baru **"Perancah diikat ke bangunan (tie)"** (Tahap 3, model independent; bawaan "Tidak / belum ditentukan"). Bila "Ya", kaidah bebas berdiri diganti butir INFO bahwa jarak dan kapasitas tie serta beban angin tidak dihitung dan wajib didesain tersendiri (Q11).

### 19.15 Perubahan non-perhitungan yang terkait

Pustaka jsPDF kini dimuat dengan Subresource Integrity. Tampilan aplikasi di dalam portal diringkas (≤ 110 px chrome di desktop, ≤ 100 px di ponsel). Logo gerbang memakai WebP 13 KB, dan tombol Simulator 3D berada di dalam landmark. Rinciannya ada di `aplikasi/CATATAN.md`.

## Lampiran — Sumber

- BS EN 12811-1:2003, *Temporary works equipment — Part 1: Scaffolds — Performance requirements and general design*: §4.2.1.2, §6.1.3 Tabel 3, §6.2.2.1, §6.2.2.3, §6.2.9.2, §10.2.4.1, §10.3.2.1–10.3.2.2, §10.3.3.2, Annex C Tabel C.1, Lampiran Nasional Inggris Tabel NB.1 (butir 6.2.9). Teks dibaca dari salinan yang diunggah produsen: https://www.wm-scaffold.com/wp-content/uploads/2021/06/BS-EN-12811-1-British-Standard-Scaffolding-Performance-Requirement.pdf
- EN 1993-1-1 §6.3.1.2, Tabel 6.1–6.2 (kurva tekuk): https://www.dlubal.com/en-US/support-and-learning/support/knowledge-base/001622 ; SCI Advisory Desk AD 546: https://www.steelconstruction.info/images/d/d4/AD-546.pdf
- NASC TG20:21, nilai beban aksial aman pipa dan kapasitas klem sebagaimana dikutip dalam PSD Calculation No. 9989-1 E (30 Juni 2022), hlm. 3: https://docs.planning.org.uk/20220921/27/RF9QPMBC0E700/u4qbkc35h6ia08xh.pdf ; produk NASC: https://nasc.org.uk/product-category/technical-guidance
- Scaffolders Forum, kutipan TG20:13 Tabel 5.15 dan BS 5973 Tabel 17 (sumber sekunder): https://scaffoldersforum.com/goto/post?id=358682
- CFMEU Victoria, *Scaffold Guide* (2024), kelas duty AS/NZS 1576.1: https://vic.cfmeu.org/wp-content/uploads/2024/08/scaffold-guide-web.pdf
- Edisi standar dan regulasi terverifikasi: `site/assets/data/regulasi.js` (BS EN 74-1:2022, BS EN 39:2001, NASC TG20:21, AS/NZS 1576.1:2019, AS 4576:2020, SNI 8987:2021, Permenaker 9/2016, Kepmenaker 46/2022).
