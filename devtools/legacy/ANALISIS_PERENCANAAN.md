# Analisis Aplikasi Legacy "PPAPI Scaffold": Perencanaan, Analisis Struktur & Inspeksi Perancah

Dokumen ini menganalisis aplikasi yang sebelumnya dibuat klien (`devtools/legacy/asosiasi.ppapi-main/index.html`, versi aplikasi **2.1.0 / 19 Juli 2026**, pernah dideploy di https://ppapiid.vercel.app/). Tujuannya adalah mengintegrasikan aplikasi ini ke situs PPAPI baru sebagai **aset asosiasi yang hanya dapat dipakai anggota berstatus Aktif** (SPEC-v2 §0.4, §4.4).

| | |
|---|---|
| Tanggal analisis | 9 Oktober 2026 |
| Berkas utama | `index.html`: 491.287 byte, 2.989 baris (CSS baris 16–334, markup 335–921, skrip 922–2972, markup penutup 2973–2989) |
| Metode | Kode dibaca baris per baris. Aplikasi dijalankan dengan Playwright (Chromium), dan setiap tahap diklik di desktop 1366 px dan ponsel 390 px. Laporan PDF diunduh lalu dirender dengan pdf.js. Nilai teknik dicek silang ke sumber publik (Lampiran B). |
| Skrip uji | `devtools/flows/legacy-perencanaan.mjs` (alur utama, uji sub-path/SW, uji sesi palsu) dan `devtools/flows/legacy-perencanaan-2.mjs` (persistensi, tanggal WIB, akun lintas perangkat, sesi Supabase palsu, render PDF) |
| Screenshot | `devtools/shots/legacy-pr-d-*.png` (desktop, 26 berkas) dan `devtools/shots/legacy-pr-m-*.png` (ponsel, 27 berkas). Daftarnya ada di Lampiran A. |
| Batasan | Hanya analisis. Tidak ada berkas di `site/` maupun `legacy/` yang diubah. |

---

## 0. Ringkasan eksekutif

1. **Fungsinya lengkap dan berjalan tanpa galat JavaScript.** Aplikasi ini berupa satu halaman dengan alur **9 tahap**: Data Proyek, Beban Hidup, Duty & Stabilitas, Gambar Rencana, Material & Gross Load, Analisis Struktur, JSA, Checklist, dan Laporan & Tagging. Ada juga editor gambar rencana drag & drop dengan pemeriksa kaidah, checklist **10 kategori / 52 butir / 21 kritis** dengan verdict tiga warna, laporan PDF (jsPDF), scaffold tag yang dapat dicetak, arsip proyek, dan simulator 3D yang **ditanam ulang sebagai base64**. Selama uji Playwright tidak ada satu pun `pageerror`.
2. **Konstanta dasarnya sebagian besar benar.** Kelas duty 225/450/675 kg per bay (≈2,2/4,4/6,6 kN) dan beban titik 100/150/200 kg (≈1,0/1,5/2,0 kN) sesuai panduan Australia (CFMEU Vic. dan WorkSafe ACT). Klaim pada brief bahwa nilainya "2,25/4,5/6,75 kN" **tidak tepat**. Nilai SWL klem 6,3/9,4 kN memang berasal dari **BS 5973 Tabel 17**, tetapi BS 5973 sudah tidak diakui HSE sejak 2011. Panduan yang berlaku saat ini (NASC TG20:13/21) memakai **6,1 kN (Kelas A) / 9,1 kN (Kelas B)**.
3. **Metodenya masih sangat kasar.** Ada beberapa kelemahan teknik yang penting (§2.7):
   - Beban dibagi **rata ke semua tiang dan semua klem**. Cara ini tidak konservatif untuk tiang tengah.
   - Jumlah tiang, klem, dan bay yang dipakai analisis **tidak diturunkan dari geometri** proyek.
   - "Kapasitas tekuk Perry-Robertson" **tidak pernah dihitung**. Nilainya hanya angka input 2.500 kg yang tidak bergantung pada tinggi lift.
   - Penentuan kelas duty **merata-ratakan** beban ke semua bay, sehingga beban yang terpusat di satu bay tidak terlihat.
   - Faktor keamanan dipakai **ganda** (SF dan FK di atas SWL).
4. **Masalah keamanan berat bila aplikasi diletakkan di origin PPAPI:**
   - Akun bawaan `admin`/`admin123` di-seed di setiap perangkat.
   - Hash kata sandinya djb2 32-bit.
   - Login sepenuhnya di sisi klien. Sesi `ppapi_session` yang dipalsukan langsung memberi akses admin (**terbukti**).
   - Mode Supabase mempercayai peran yang tersimpan di localStorage tanpa memvalidasi token (**terbukti**) dan mengambil peran dari `user_metadata` yang bisa diubah pengguna sendiri.
   - Token Upstash disimpan di localStorage.
   - Ada **XSS** di berbagai `innerHTML` (tag, arsip proyek, log admin, nama berkas, impor JSON). XSS ini **tereksekusi** dalam uji. Begitu aplikasi berbagi origin dengan portal, XSS ini dapat membaca token Firebase anggota.
5. **Bug fungsional yang terbukti:**
   - Ringkasan hasil di halaman *Laporan & Tagging* **tidak pernah dirender** (`#ringkasan-root` kosong).
   - Teks kesimpulan dan dasbor admin menampilkan **"undefined/52"**.
   - Tanggal inspeksi bawaan **mundur satu hari** antara pukul 00.00 dan 06.59 WIB.
   - Input Tahap 2/3/5/6 **hilang saat halaman dimuat ulang**.
   - "Proyek Baru" **tidak menghapus** foto dan gambar lama.
   - Laporan PDF berukuran **10,2 MB** untuk satu gambar dan satu foto, dan beberapa label di tabelnya bertumpuk dengan nilai.
   - Tombol "Simulator 3D" ikut **tercetak** di halaman tag.
6. **Risiko PWA di sub-path:** `sw.js` menghapus **semua** cache lain di origin yang sama saat aktif. Hal ini **terbukti** menghapus cache `ppapi-site-v1` milik portal. `sw.js` juga meng-cache **semua** permintaan GET dengan strategi cache-first, termasuk lintas origin. Rekomendasi: **jangan daftarkan SW** di versi terintegrasi.
7. **Akun buatan admin hanya ada di peramban tempat akun itu dibuat** (terbukti). Jadi klaim "Akses dikelola oleh Admin PPAPI" praktis hanya berlaku per perangkat. SSO dari portal PPAPI menyelesaikan masalah ini.
8. **Tampilan ponsel:** header sticky setinggi **259 px** (31 % layar 390×844) menutupi bilah progres checklist yang juga sticky. Tabel input perlu digeser ke samping. Kanvas gambar hanya 304×171 px. Tombol jawaban berukuran 52×33 px, di bawah standar 44 px. Tombol FAB menutupi konten.
9. **Rencana integrasi (§5), sejalan dengan SPEC-v2 §4.4:**
   - Halaman mandiri `site/aplikasi/perencanaan/index.html` tanpa `main.css`, sehingga CSS legacy tetap terisolasi.
   - Dimuat bersama `../../assets/js/{config,core,auth,store}.js` dan `../gate.js` **tanpa** `data-auth`. Gerbang inti tidak sadar sub-folder, jadi pengalihan ditangani oleh `gate.js`.
   - Bilah portal monokrom dibuat sticky.
   - SSO memakai `window.PPAPI_APP_START(user)`, menggantikan `boot()` (baris 2951–2970), `seedUsers()` (1837), dan `doLogin()` (1853).
   - Panel Admin, Supabase, dan Upstash dihapus.
   - Kunci penyimpanan diberi namespace per UID.
   - Simulator base64 diganti tautan ke `../simulator/`.
   - SW dan manifest dihapus.
   - Bug P0/P1 diperbaiki saat porting.
   - **Batasannya perlu dinyatakan jujur:** di hosting statis, berkas aplikasi tetap dapat diunduh publik. Gerbang hanya mengatur pengalaman portal. Penegakan akses yang sebenarnya hanya bisa dilakukan pada **data** (Firestore/Storage rules), bukan pada kode.

---

## 1. Ringkasan, tujuan, dan inventaris fitur

### 1.1 Identitas & tujuan
- **Judul halaman:** "PPAPI Scaffold — Inspeksi Perancah Tubular/Frame/Modular". Header aplikasi bertuliskan "Scaffold Inspeksi · Sistem Inspeksi Keandalan Perancah".
- **Tujuan:** alat bantu perencanaan dan inspeksi perancah **tubular (tube & coupler)**, mulai dari penetapan beban, gambar rencana, analisis kekuatan/kestabilan/kekokohan, JSA, dan checklist inspeksi, sampai laporan PDF dan scaffold tag. Frame dan modular disebut "ditangani terpisah". Meski begitu, checklist masih memuat kategori FRM khusus frame (§2.7 E11).
- **Pengembang (menurut halaman *Tentang*, baris 839–863):** [atribusi lama, dihapus] bersama PPAPI. Footer menyebut "[atribusi lama, dihapus] build". Layar awal simulator menulis "Dibuat oleh [atribusi lama, dihapus] untuk [atribusi lama, dihapus]". **Atribusi ini perlu diseragamkan** sebelum aplikasi dipublikasikan sebagai aset asosiasi.
- **Penyimpangan dokumentasi:**
  - `README.md` paket masih menyebut "5 tab".
  - Kartu beranda berjudul "**8** Tahap Perencanaan Perancah" (baris 431) tetapi isinya **9** tombol tahap.
  - *Changelog* v2.0.0 menyatakan 9 tahap.

### 1.2 Berkas paket
| Berkas | Ukuran | Fungsi / catatan |
|---|---|---|
| `index.html` | 491 KB | Seluruh aplikasi. **54 % ukurannya adalah data tertanam**: `LOGO_D` 65,5 KB dan `LOGO_L` 67,4 KB (PNG base64, baris 924–925), serta `SIM_B64` 133,5 KB (baris 1956) yang **identik byte-per-byte** dengan `simulator.html` (MD5 `aa56f7fc…`, 100.113 byte). |
| `simulator.html` | 100 KB | Simulator 3D (three.js r128). Dianalisis di `ANALISIS_SIMULATOR.md`. Catatan: `<title>`-nya memuat karakter rusak (U+FFFD). |
| `sw.js` | 1 KB | Service worker cache-first, nama cache `ppapi-scaffold-v1` (§3.7). |
| `manifest.webmanifest` | 0,6 KB | `start_url: ./index.html`, `scope: ./`, orientasi *portrait*. |
| `icon.svg`, `icon-192/512.png`, `apple-touch-icon.png`, `favicon-32.png` | — | Ikon PWA. |
| `404.html`, `robots.txt`, `netlify.toml`, `vercel.json`, `README.md` | — | Konfigurasi hosting. `vercel.json` memberi header `no-cache` untuk `sw.js`. |

### 1.3 Peta tahap, tab, dan fitur (diverifikasi dengan Playwright)
Navigasi berupa menu *dropdown* `#menu-btn` → `.menu-panel .tab[data-v]` → `go(v)` (baris 937–955). Setiap tampilan adalah `<section class="view" id="v-…">`.

| # | Menu (`data-v`) | Markup | Logika utama | Hasil uji Playwright | Screenshot |
|---|---|---|---|---|---|
| — | Layar login (`#login-screen`) | 385–396 | `doLogin()` 1853, `seedUsers()` 1837 | Sandi salah menampilkan "ID atau kata sandi salah."; `admin/admin123` berhasil masuk | d-00, m-00 |
| — | Beranda (`beranda`) | 399–482 | `initApp()` 2925 (chip kategori) | Legenda verdict, 10 chip kategori, 9 tombol tahap (judul "8 Tahap"), Tentang PPAPI, perbandingan jenis perancah | d-01, d-01b (menu), m-01, m-00b |
| 1 | Data Proyek (`proyek`) | 485–520 | `FIELDS` 1484, `saveProject` 2200, `renderProjects` 2224 | 11 isian identitas, model (independent/suspended/mobile), dimensi bay; arsip proyek; tombol "↻ Sinkronkan Cloud" (Upstash) | d-02, m-02 |
| 2 | Beban Hidup (`beban`) | 675–698 | `llData` 1696, `computeLL` 1710, `applyLLtoAnalisis` 1718 | Default 2 orang ×90 + 50 + 150 + 25 %, SF 1,5: **645 kg, 215 kg/bay, Light Duty**. Skenario 4 orang + 300 kg: **1.196 kg, 399 kg/bay, Medium**. "Terapkan" mengubah `an-kelas` = 4.4 | d-03, m-03 |
| 3 | Duty & Stabilitas (`duty`) | 576–630 | `dutyInfo` 1509, `computeAnalisis` 1591 | Medium: 4,4 kN, ≈449 kg/bay, lebar minimum 900 mm, UDL 156 kg/m² dinilai "PAPAN AMAN". Pemeriksaan kestabilan per model (independent, suspended, mobile) | d-04, d-04b, d-04c, m-04 |
| 4 | Gambar Rencana (`gambar`) | 740–836 | `dwgInit` 2879, `dwgRender` 2491, `dwgCheck` 2512, `buildPDF` | Palet + klik kanvas berfungsi (baseplate, pipa, putar 90°); pintasan keyboard (P = pipa); layar penuh; pemeriksa kaidah memberi 10 peringatan untuk rangka uji (§2.5); unggah JPG/PNG/PDF ≤ 4 MB | d-05, d-05b, m-05 |
| 5 | Material & Gross Load (`material`) | 701–725 | `autoMaterial` 1728, `renderAnalisis` 1499 | Default 8 komponen = **393 kg**. Estimasi otomatis untuk 4 bay × 2,4 × 1,2 m, H 8 m: **14 komponen, 227 pcs, 1.469 kg**; gross 2.815 kg; W* 4.223 kg | d-06, m-06 |
| 6 | Analisis Struktur (`analisis`) | 632–672 | `analisisData` 1520 | Beban per tiang 704 kg (6,9 kN) dari 6 tiang; tekanan pondasi 17.595 kg/m² (gagal); klem 5,18 kN ≤ 6,3 kN; verdict "PERLU REVIEW" | d-07, m-07 |
| 7 | JSA (`jsa`) | 728–737 | `JSA_TPL` 1765, `renderJSA` 1779 | 8 baris templat, dapat diedit, ditambah, dihapus, dimuat ulang | d-08, m-08 |
| 8 | Checklist (`checklist`) | 523–538 | `DATA` 923, `stats` 959, `setA` 1007, foto `downscale` 1812 | "Tandai semua Sesuai" menghasilkan **HIJAU**; 1 kritis "Tidak" → **MERAH**; 1 non-kritis "Tidak" → **KUNING**; foto bukti terunggah (JPEG ≤1024 px, q 0,72) | d-09, m-09, m-09b |
| 9 | Laporan & Tagging (`laporan`) | 541–572 | `genKesimpulan` 1807, `tagHTML` 1097, `printTag` 1150, `buildPDF` 1221, `exportJSON` 1491 | **Ringkasan kosong** (bug B1). Kesimpulan otomatis memuat "**undefined**/52". Tag dua sisi berfungsi; PDF 5 halaman 10,2 MB; JSON 10 KB | d-10, d-10b, d-15-pdf-p1…p5, m-10 |
| — | Tentang (`tentang`) | 839–863 | `renderChangelog` 2022 | v2.1.0, daftar acuan standar, changelog | d-11, m-11 |
| — | Admin (`admin`, hanya peran admin) | 866–913 | `renderAdmin` 2110, `saveUser` 2160 | Statistik ("**undefined/52**"), Upstash, Supabase, manajemen akun lokal, log aktivitas | d-12, m-12 |
| — | FAB "Simulator 3D" | 2973–2988 | `ensureSimURL` 1958 | Modal iframe dengan `blob:` **satu origin** yang dapat membaca `localStorage` induk | d-13 |

### 1.4 Checklist inspeksi: 10 kategori, 52 butir, 21 kritis (data `DATA`, baris 923)
| Kode | Kategori | Butir | Kritis | Acuan yang dicantumkan |
|---|---|---|---|---|
| ADM | Umum & Administrasi | 5 | 3 | Permenaker 1/1980, Permenaker 5/2018, AS 4576 / BS 5973, NASC SG4 |
| PON | Pondasi & Landasan | 6 | 2 | BS 5973, BS 1139 / AS 1576, AS 4576, BS EN 1004 |
| STR | Struktur: Standard, Ledger, Transom | 6 | 2 | BS 1139 / AS 1576.1, BS 5973 (Tbl 3) |
| BRC | Bracing & Pengaku | 4 | 1 | BS 5973, BS EN 1004, AS 4576 |
| CPL | Coupler / Sambungan Klem | 7 | 3 | BS EN 74-1, NASC TG20 / BS 5973, BS 1139 |
| STB | Kestabilan & Pengikatan | 4 | 2 | AS 4576 / BS 5973 |
| FRM | Rangka Frame (khusus frame) | 4 | 2 | JIS / BS 5973, AS 4576 |
| PLT | Platform / Lantai Kerja | 7 | 3 | BS 5973 / AS 4576, Permenaker 1/1980 |
| AKS | Akses / Tangga | 5 | 2 | BS 5973, AS 4576 / BS EN 1004, Permenaker 1/1980 |
| TAG | Tag & Penyerahan | 4 | 1 | NASC SG4, BS 5973 |
| **Jumlah** | | **52** | **21** | |

**Logika verdict** (`stats()`, baris 959–976):
- `BELUM LENGKAP` bila masih ada butir yang belum dijawab.
- `MERAH` bila ada butir kritis yang dijawab "Tidak".
- `KUNING` bila ada butir non-kritis yang dijawab "Tidak".
- `HIJAU` bila tidak ada jawaban "Tidak".
- Jawaban **N/A dihitung sebagai terjawab** dan juga berlaku untuk butir kritis, tanpa perlu alasan (§2.7 E12).

Contoh butir yang angkanya dapat diperiksa: torsi baut klem 50 N·m (CPL); sambungan ≤ 300 mm dari node (CPL); pagar pengaman 950–1100 mm dengan midrail dan toe board (PLT); celah papan ≤ 25 mm (PLT); lebar lantai ≥ 600 mm (PLT); tangga 4:1 (75°) dan menjulang ≥ 1 m (AKS); pemeriksaan ulang ≤ 7 hari (TAG). Nilai-nilai ini umum dipakai dalam praktik Inggris/Australia. Interval 7 hari sejalan dengan panduan HSE untuk menara. Klausul persis untuk tiap butir **tidak diverifikasi satu per satu** karena teks standar berbayar.

---

## 2. Metode perhitungan & acuan standar

Semua perhitungan terdapat di skrip satu berkas. Satuan dasarnya **kg**, dengan konversi kN = kg × 9,80665 / 1000.

### 2.1 Tahap 2: Beban hidup (`llData`, baris 1696–1709)
```
W_org = n_org × w_org                     (default 2 × 90 kg)
W_imp = impact% × (W_alat + W_material)   (default 25 %)
W_l   = (W_org + W_alat + W_material + W_imp) × SF      (SF default 1,5)
perBay = W_l / (N_bay × N_platform)       ← dirata-ratakan ke SEMUA bay & platform
kelas: perBay ≤ 225 → Light (2,2 kN) · ≤ 450 → Medium (4,4) · ≤ 675 → Heavy (6,6)
       > 675 → Special, kn = ceil(perBay·9,80665/100)/10
```
Acuan yang dicantumkan adalah "AS 4576 · AS/NZS 1576.1 kl. 2.4.3.2". `N_bay` diambil dari `an-bay` (baris 1701), **bukan** dari `f-nbay` milik Data Proyek (bug B6).

### 2.2 Tahap 3: Duty & stabilitas (`dutyInfo` 1509–1516, `analisisData` 1520–1583)
| Kelas | kN/bay | Setara kg | Beban titik `pt` | Lebar minimum `minw` |
|---|---|---|---|---|
| Light | 2,2 | 224 | 1,0 kN | 450 mm |
| Medium | 4,4 | 449 | 1,5 kN | 900 mm |
| Heavy | 6,6 | 673 | 2,0 kN | 1000 mm |
| Special | input ≥ 6,6 | — | 2,0 kN | 1000 mm |

Pemeriksaan yang dilakukan:
- **Papan:** `UDL = kgBay / (L_bay × B) ≤ 250 kg/m²` (baris 1537) dan `B×1000 ≥ minw` (1538). **Beban titik `pt` hanya ditampilkan, tidak pernah diperiksa.**
- **Independent:** `H ≤ 3 × B_min`, dengan B_min = min(lebar, n_bay × L_bay). Bila gagal, aplikasi menyarankan memasang outrigger atau tie (AS 4576). Pemeriksaan pondasi ada di §2.4.
- **Suspended:**
  - Tarik tali `T = W*/n_tali ≤ MBL/FoS`, dengan FoS 6 untuk baja/rantai dan 10 untuk serat (dikutip dari "AS 1576.1 kl. 2.9–2.11").
  - Jumlah counterweight `n_cw = ⌈3·T·L_out/(L_in·m_cw)⌉` (dikutip dari "AS 4576 kl. 11.5.2").
  - `L_in ≥ 3·L_out` (dikutip dari "AS 4576 kl. 10.7").
- **Mobile:**
  - Beban per castor `W*/n_castor ≤ WLL`.
  - `H ≤ 3,5·B` di dalam gedung atau `3·B` di luar gedung (dikutip dari "BS 5973 kl. 28.12 / AS 4576").
  - `B_min ≥ 1,2 m` (dikutip dari "BS 5973 kl. 28.8").
  - Rem castor terkunci.

### 2.3 Tahap 5: Material & self weight (`autoMaterial`, baris 1728–1755; `MAT_DEFAULTS`, baris 927)
- Berat pipa **48,3 × 3,2 mm = 3,56 kg/m** (dicek: A = 453,4 mm² × 7.850 kg/m³ = 3,56 kg/m ✓).
- Jumlah lift `nl = round((H−0,3)/h_lift)`. Jumlah standard `(n_bay+1)×2`, masing-masing setinggi H + 0,5 m.
- Ledger `2·nl`. Transom `(n_bay+1)·nl` dengan panjang lebar + 0,2 m. Bracing `2·nl` dengan panjang √(L²+h²). Guardrail/midrail 4 baris.
- Fix clamp `4(n_bay+1)·nl + 2(n_bay+1)` @1,2 kg. Swivel `4·nl+4` @1,4 kg. Sleeve `n_std·(⌈(H+0,5)/6⌉−1)` @1,1 kg.
- Baseplate @2,5 kg. Sole board @4 kg. Metal plank `n_bay × max(3, round(B/0,24))` @5,2 kg/m. Toe board @5 kg. Tangga @15 kg.
- `W_d = Σ nᵢ·wᵢ`. `W_g = W_d + W_l`. `W* = W_g × FK` (FK default 1,5).

### 2.4 Tahap 6: Analisis struktur (`analisisData`, baris 1520–1583)
```
live  = kgBay × N_bay × N_platform
total = W_d + live ;   W* = total × FK
Tiang:   N  = W*/n_tiang  ≤ kapasitas aman per tiang (input, default 2.500 kg)   "basis Perry-Robertson, AS 1576.1 kl. 2.12"
Pondasi: q  = N / A_plate ≤ daya dukung (input, default 10.000 kg/m², A_plate 0,04 m²)
Klem:    R  = W*/n_klem   ≤ SWL slip (6,3 kN "Kelas A / BS 1139-2" atau 9,4 kN "Kelas B / EN 74"; "BS 5973 Tbl 17")
Kekokohan: tidak ada temuan BRC & STB pada checklist ; L_bay ≤ 2,4 m
```

### 2.5 Pemeriksa kaidah gambar rencana (`dwgCheck`, baris 2512–2593)
Pemeriksaan hanya berlaku untuk tampak depan dan samping. Kaidah yang diperiksa:
- **Aturan 1:** ledger pertama berjarak 15–50 cm dari tanah.
- **Aturan 2:** setiap simpul standard–ledger/transom memiliki fix clamp dalam radius 17 cm. **Sisi dalam/luar tidak diperiksa.**
- **Aturan 3:** setiap perpotongan bracing dengan standard memiliki swivel.
- **Aturan 4:** jarak antar-lift 1,75–2,05 m.
- **Aturan 9:** sleeve berjarak ≤ 0,31 m dari node.
- **Aturan 10:** sambungan tidak boleh hampir segaris.
- **Aturan 11:** bila H > 3 × lebar landasan (tampak samping), wajib ada outrigger.
- **Aturan 13:** tangga diperlukan bila H > 4 m, bordes bila > 6 m.
- **Baseplate:** jumlah baseplate ≥ jumlah standard.
- **Overhang:** overhang 3–14,8 cm memicu peringatan (minimum 15 cm).

Aturan 5–8, 12, dan 14 hanya tercantum sebagai teks. Rangka uji (3 standard, 3 ledger dengan overhang 10 cm, 1 bracing tanpa swivel, 1 sleeve berjarak 0,7 m) menghasilkan peringatan Aturan 2, 3, 9, 13 dan 6× Overhang. Semuanya sesuai kode.

### 2.6 Pemeriksaan silang terhadap sumber publik
Status: ✓ sesuai; ≈ sesuai dengan catatan; ⚠ perlu koreksi atau tidak dapat diverifikasi.

| Besaran di aplikasi | Nilai aplikasi (baris) | Nilai acuan dan sumber | Status |
|---|---|---|---|
| Beban kelas duty per platform per bay | 2,2 / 4,4 / 6,6 kN ≈ 225/450/675 kg (1511–1513) | Light 225 kg, Medium 450 kg, Heavy 675 kg per platform per bay; Special sesuai perancang ([CFMEU Vic. Scaffold Guide 2024](https://vic.cfmeu.org/wp-content/uploads/2024/08/scaffold-guide-web.pdf); [WorkSafe ACT](https://www.worksafe.act.gov.au/health-and-safety-portal/safety-by-industry/building-and-construction/scaffolding); [ALTA Scaffolding, mengutip AS/NZS 1576](https://altascaffolding.com.au/calculating-the-safe-load-for-scaffolding/)) | ✓. Brief menyebut "2,25/4,5/6,75 kN": **itu keliru** (hasil memakai g ≈ 10). |
| Beban titik per kelas | 1,0 / 1,5 / 2,0 kN (1511–1513) | 100 / 150 / 200 kg per platform per bay ([CFMEU Vic.](https://vic.cfmeu.org/wp-content/uploads/2024/08/scaffold-guide-web.pdf)) | ✓ nilainya. ⚠ **tidak pernah diperiksa** dalam analisis. |
| Lebar platform minimum | 450 / 900 / 1000 mm, mengutip "AS 4576 Tbl 8.7" (1511–1513) | Minimal 2 papan (≈450 mm) untuk orang + alat, 3 papan (≈675 mm) bila ada material ([CFMEU Vic.](https://vic.cfmeu.org/wp-content/uploads/2024/08/scaffold-guide-web.pdf)). WorkSafe ACT: Light ≥2, Medium ≥4, Heavy ≥5 papan. | ≈ (4×225 = 900 mm konsisten; 5 papan ≈ 1.125 mm > 1.000 mm). Nomor tabel "8.7" tidak dapat diverifikasi; AS 4576 yang berlaku adalah edisi **2020** (lihat `site/assets/data/regulasi.js`). |
| "SWL papan" 250 kg/m² | konstanta (1537, 1616) | Bukan nilai AS/NZS. Kelas BS EN 12811-1: 0,75 / 1,5 / 2,0 / 3,0 / 4,5 / 6,0 kN/m² ([squote.app](https://squote.app/knowledge/scaffolding/scaffold-loading-limits); [travail-industrie.com](https://travail-industrie.com/outils/calculateur-charge-echafaudage)). 250 kg/m² ≈ 2,45 kN/m², di antara kelas 3 dan 4. | ⚠ Kapasitas papan bergantung pada jenis papan dan bentangnya. Jadikan **input dari data pabrikan**. |
| SWL slip klem siku (RA) | 6,3 kN "Kelas A / BS 1139-2", 9,4 kN "Kelas B / EN 74", "BS 5973 Tbl 17" (655–656) | BS 5973 Tbl 17 ≈ 6,3 / 9,4 kN. **TG20:13 Tabel 5.15: Kelas A 6,1 kN, Kelas B 9,1 kN** ([Scaffolders Forum, kutipan TG20/BS 5973](https://scaffoldersforum.com/goto/post?id=358682)). HSE tidak lagi mengakui BS 5973 untuk desain tube & fitting sejak 1 Januari 2011 ([thread kutipan HSE](https://scaffoldersforum.com/threads/bs-5973.2895/latest)). Panduan berlaku: [NASC TG20:21](https://nasc.org.uk/product/tg2021-eportal-access-new-subscription/embed). | ⚠ Nilai terlalu tinggi ≈3 %, dan label rancu karena Kelas A/B adalah kelas **EN 74-1** (edisi berlaku 2022, [standard.no](https://online.standard.no/en/ns-en-74-1-2022)). Ganti dengan 6,1/9,1 kN dan acuan TG20. Sumbernya sekunder (forum), jadi konfirmasi ke teks TG20. |
| Berat pipa | 3,56 kg/m untuk 48,3×3,2 (1729) | Dihitung: 3,56 kg/m (3,2 mm), 4,37 kg/m (4,0 mm, tipe EN 39 / BS 1139) | ✓ untuk 3,2 mm. ⚠ Bila memakai pipa 4,0 mm, beban mati pipa kurang 23 %. Jadikan pilihan. SNI 8987:2021 "Pipa baja untuk perancah" (ada di `regulasi.js`) **tidak dirujuk** aplikasi. |
| Kapasitas tiang "basis Perry-Robertson" | input 2.500 kg (644), tidak dihitung | Estimasi penulis (Perry-Robertson gaya BS 449, fy 235 MPa, E 205 GPa, η = 0,003λ, FK 1,7, beban **sentris**, Le = tinggi lift): 48,3×3,2: **2.606 kg @2,0 m; 1.602 kg @2,7 m**; 48,3×4,0: 3.123 kg @2,0 m; 1.912 kg @2,7 m | ⚠ 2.500 kg hanya wajar untuk lift ≤ 2 m. Aplikasi **tidak mengaitkan** kapasitas dengan `f-hlift`, padahal kapasitas turun ≈40 % pada lift 2,7 m. Eksentrisitas klem tidak diperhitungkan. |
| Rasio H:B bebas berdiri | 3 : 1 (1567) | Kaidah umum 3× lebar dasar terkecil; outrigger dapat menambah tinggi ([ABM, Mobile Tower Scaffold](https://nucleusuk.abm.com/wp-content/uploads/2022/10/10-Mobile-Tower-Scaffold.pdf)) | ≈ |
| Rasio menara beroda | 3,5 (dalam) / 3,0 (luar) (603, 1559) | Tidak terkonfirmasi. BS EN 1004 menyerahkan rasio ke instruksi pabrikan. | ⚠ Jadikan input "rasio maksimum pabrikan". |
| FoS tali (6 baja/rantai, 10 serat); counterweight ≥ 3× momen guling; `L_in ≥ 3 L_out` | 1543–1551 (cek 1546, 1550, 1551) | Teks AS/NZS 1576.1:2019 dan AS 4576:2020 berbayar; nomor klausul (2.9–2.11, 11.5.2, 10.7) **tidak dapat diverifikasi**. Faktor 3 untuk stabilitas rig umum dipakai. | ⚠ Verifikasi ke standar oleh ahli. |
| Tie 2,5 % beban vertikal, kapasitas ≥ 6,0 kN ("AS 1576.1 kl. 2.8.3") | teks (1577) | Tidak dapat diverifikasi; **tidak dihitung**, hanya diturunkan dari jawaban checklist | ⚠ |
| Regulasi Indonesia | "PermenNaker No.01/MEN/1980 dan KEP-74/PPK/XII/2013" | PER.01/MEN/1980 ✓. **KEP.74/PPK/XII/2013 tidak ditemukan di sumber publik** (JDIH). Yang relevan dan berlaku menurut `regulasi.js`: **Permenaker 9/2016** (K3 pekerjaan pada ketinggian), **Kepmenaker 46/2022** (SKKNI operasi scaffolding, [JDIH](https://jdih.kemnaker.go.id/peraturan/detail/2235/keputusan-menteri-ketenagakerjaan-nomor-46-tahun-2022)), dan **SNI 8987:2021** | ⚠ Minta salinan KEP-74 ke klien; tambahkan rujukan yang berlaku. |

### 2.7 Catatan teknik
Diurutkan menurut dampaknya terhadap keselamatan.

| ID | Masalah | Baris | Dampak | Usulan |
|---|---|---|---|---|
| **E1** | Beban tiang dihitung `W*/n_tiang`, artinya dibagi rata ke semua tiang. Dengan n bay yang dibebani merata, tiang tengah memikul satu bay penuh, sedangkan tiang ujung setengah. Jadi tiang tengah = (n+1)/n × rata-rata, misalnya **+33 % untuk 3 bay**. Bila beban terpusat (Heavy di satu bay), bedanya jauh lebih besar. Pembagian antara tiang dalam dan luar juga diabaikan. | 1531, 1565 | **Tidak konservatif** | Hitung per node: reaksi bay kiri/kanan × jumlah platform + self weight kolom per lift, lalu ambil yang **maksimum**. |
| **E2** | Jumlah tiang `an-tiang` default 6 dan jumlah klem `an-nklem` default 8 adalah input bebas yang **tidak diturunkan dari geometri**. Untuk 4 bay seharusnya ada 10 tiang. `an-bay` juga tidak mengikuti `f-nbay`. | 643, 658, 616, 1524, 1701 | Hasil bergantung pada angka yang mudah lupa diubah (terbukti: material memakai 4 bay, beban hidup memakai 3 bay) | Turunkan otomatis dari Data Proyek; izinkan override dengan peringatan. |
| **E3** | "Kapasitas tekuk Perry-Robertson" hanyalah input 2.500 kg, tidak ada perhitungan tekuk. Tidak dikaitkan dengan tinggi lift, ketebalan pipa, maupun eksentrisitas klem. | 644, 1565 | Label menyesatkan. Untuk lift 2,7 m kapasitas sebenarnya ≈ 1.600 kg (§2.6). | Hitung N_c dari tabel TG20/AS atau rumus dengan Le = h_lift, atau ubah label menjadi "Kapasitas izin per tiang dari data pabrikan/tabel". |
| **E4** | Kelas duty ditentukan dari `perBay = W_l/(N_bay·N_platform)`, yaitu rata-rata. Kelas duty adalah batas **per bay**, sehingga material yang ditumpuk di satu bay tidak terdeteksi. Contoh: default 645 kg menjadi "Light", padahal bila seluruhnya di satu bay → Heavy. | 1702 | Kelas yang direkomendasikan bisa terlalu rendah (**tidak konservatif**) | Minta input "beban bay terberat", atau masukan per bay. |
| **E5** | Pemeriksaan klem `R = W*/n_klem` membagi **seluruh** beban (termasuk berat sendiri tiang yang tidak lewat klem) ke n klem bebas. Ini bukan metode TG20/BS. | 1571–1574 | Bisa terlalu rendah maupun terlalu tinggi, tergantung n | Hitung reaksi ledger/transom per node pada lift yang dibebani lalu bandingkan dengan SWL klem (6,1/9,1 kN). Sediakan opsi *check coupler*. |
| **E6** | Faktor keamanan ganda dan campur aduk: SF 1,5 untuk penentuan kelas, lalu FK 1,5 di atas beban kelas, lalu dibandingkan dengan **SWL/kapasitas aman** yang sudah mengandung faktor. Pada suspended, W*×1,5 masih dibandingkan dengan MBL/6 dan dikali 3 untuk counterweight. | 1531, 1546, 1549, 1571 | Umumnya konservatif, tetapi tidak konsisten dan sulit dipertanggungjawabkan | Pilih satu filosofi: tegangan izin (beban kerja vs SWL) **atau** batas (beban terfaktor vs kapasitas desain), dan dokumentasikan. |
| **E7** | Beban titik `pt` (1,0/1,5/2,0 kN) tidak pernah diperiksa terhadap papan; "SWL papan 250 kg/m²" adalah konstanta. | 1537 | Papan bisa gagal karena beban titik | Masukkan kapasitas papan per bentang dari pabrikan; periksa UDL **dan** beban titik. |
| **E8** | Pondasi `q = N/A_plate` memakai N rata-rata (lihat E1) dan luas baseplate saja (default 0,04 m² = 200×200; baseplate umum 150×150 = 0,0225 m²). | 646, 1531, 1566 | Campuran; sole board diabaikan | Hitung untuk N maksimum dan luas sole board (input). |
| **E9** | Suspended: T dibagi rata ke tali; berat needle diabaikan; satu needle per tali diasumsikan. | 1541–1552 | Perlu ditinjau | Jadikan asumsi eksplisit di UI dan PDF. |
| **E10** | Kekokohan hanya diturunkan dari checklist (BRC/STB) dan `L_bay ≤ 2,4`. Tidak ada perhitungan tie atau angin. | 1576–1578 | Label "Kekokohan terpenuhi" terlalu kuat | Ubah label menjadi "Indikasi". Tambahkan jarak tie dan beban angin pada fase berikutnya. |
| **E11** | Kategori FRM (khusus frame, 2 butir kritis) ada di aplikasi tubular. | 923 | Inspektor harus mengisi N/A; bila salah jawab "Tidak", hasilnya MERAH | Sembunyikan FRM bila jenis = tubular, atau otomatis N/A. |
| **E12** | N/A pada butir **kritis** diterima tanpa alasan, sehingga HIJAU tetap mungkin. | 959–976 | Celah verdict | Wajibkan catatan untuk N/A kritis dan cantumkan di PDF. |
| **E13** | Teks pemeriksaan selalu memakai "≤" walaupun gagal, misalnya "q = 17595 kg/m² **≤** 10000 kg/m²" berlabel CEK. | 1537–1578 | Membingungkan dan bisa salah baca di laporan | Pakai "≤"/"&gt;" sesuai hasil, seperti `fx-live` di baris 1616–1617. |
| **E14** | Klausul dan edisi standar usang atau tidak dapat diverifikasi (BS 5973, BS 1139-2, "AS 1576.1 kl. …", AS 4576 tanpa tahun, KEP-74). | 655–656, 839–863, PDF 1369–1376 | Kredibilitas laporan | Selaraskan dengan `site/assets/data/regulasi.js`: AS/NZS 1576.1:2019, AS 4576:2020, BS EN 74-1:2022, TG20:21, SNI 8987:2021, Permenaker 9/2016, Kepmenaker 46/2022. |

> **Kesimpulan teknik:** aplikasi layak sebagai **alat bantu edukasi dan perencanaan awal**, dan disclaimer "indikatif" sudah ada (baris 670 dan di PDF). Sebelum dipromosikan sebagai aset resmi asosiasi, perbaikan E1–E5 dan E13 sebaiknya ditinjau oleh **ahli struktur PPAPI**, dan label hasil diubah dari "INDIKASI AMAN" menjadi istilah yang tidak terdengar seperti sertifikasi.

### 2.8 Nilai acuan untuk uji regresi (terukur di Playwright)
Nilai-nilai ini harus tetap sama setelah porting, kecuali memang sengaja diubah oleh perbaikan teknik yang disetujui.

| Skenario | Hasil |
|---|---|
| Beban hidup default | 180 / 50 / 150 / 50 kg; total ×SF **645 kg**; **215 kg/bay → Light Duty** |
| Beban hidup 4 orang + material 300 kg | **1.196 kg; 399 kg/bay → Medium** |
| Medium, 3 bay × 1 platform | kgBay **448,7**; live **1.346 kg**; UDL **156 kg/m²** |
| Material default (8 komponen) | W_d **393 kg**; W* = 2.608,5 kg; per tiang (6) **434,8 kg**; q **10.869 kg/m²**; klem (8) **3,20 kN** |
| Estimasi otomatis 4 bay × 2,4 × 1,2 m, H 8 m, lift 2 m | **14 komponen, 227 pcs, 1.469,2 kg**; W* **4.222,8 kg**; per tiang **703,8 kg (6,9 kN)**; q **17.595 kg/m²**; klem **5,18 kN** |
| Suspended (W_d 393) | T **1.304 kg (12,79 kN)** > 10,00 kN; counterweight **40 buah/needle** |
| Mobile H 8 m, B 1,2 m | 8,0 > 3,5×1,2 = 4,2 → CEK |
| Checklist | Semua Sesuai → HIJAU; 1 kritis "Tidak" → MERAH; 1 non-kritis "Tidak" → KUNING |

---

## 3. Arsitektur kode

### 3.1 Struktur berkas `index.html`
| Baris | Isi |
|---|---|
| 1–15 | `<head>`: manifest (11), Google Fonts Oswald + Inter (14), **jsPDF 2.5.1 dari cdnjs, sinkron dan memblokir render** (15) |
| 16–334 | CSS: token `:root` (17–23), header sticky (27), `.prog-wrap` sticky top 118/104 px (80, 325), editor gambar, tag, modal, **`@media print` (326–332)** |
| 336–384 | Header: logo, `#saved-ind`, `#bk-badge`, `#user-chip` + `#av-input`, chip verdict, menu dropdown dengan 12 entri |
| 385–396 | `#login-screen` |
| 398–913 | 12 tampilan `section.view` (tabel di §1.3) |
| 917–920 | Footer, `#print-tag-area` |
| 922–2972 | Satu `<script>` klasik: **182 fungsi global**, 27 `const`/`let` global; data `DATA` (923), `LOGO_D`/`LOGO_L` (924–925), `SIM_B64` (1956) |
| 2973–2988 | FAB Simulator, menu konteks `#dwg-ctx`, modal `#sim-modal` + `iframe#sim-frame` |

Pola kodenya: `innerHTML` dengan *template string* (39 tempat), **265 handler `onclick` inline**, 34 dialog `alert/confirm/prompt`, tanpa modul atau namespace. **Tidak ada identifier yang bentrok** dengan `window.PPAPI`/`PPAPI_CONFIG`/`PPAPI_DATA` (dicek), sehingga skrip situs (IIFE) dapat dimuat di halaman yang sama.

### 3.2 State global utama
- `state = { answers:{'si-ii':'ok'|'no'|'na'}, photos:{'si-ii': dataURL JPEG}, plans:[{name,type,data,ts}], jsa:[{step,cat,hazard,control}] }` (926)
- `matRows = [{n,q,w}]` (928)
- `DWG = {depan:[], samping:[], atas:[], _w:2}` dengan item `{id,t:'pipe'|'fix'|'swivel'|'sleeve'|'plank'|'base'|'ladder'|'dim'|'note',x,y,len,rot,ly,lock,x2,y2,txt}` dalam meter, `DWG_GY=50` sebagai garis tanah (2259–2262)
- `CURRENT_USER`, `CURRENT_ROLE` (1833, 1839), `KEY` (1483, diubah per pengguna di 1898/1907)

### 3.3 Kunci localStorage dan bentuk datanya
Diamati pada akhir uji: `ppapi_log`, `ppapi_projects_admin` (14 KB), `ppapi_scaffold_v1_admin`, `…_dwg`, `…_photos`, `ppapi_session`, `ppapi_users`.

| Kunci | Bentuk | Ditulis oleh |
|---|---|---|
| `ppapi_users` | `{ [id]: { p:'h'+djb2_base36, role:'admin'|'user', nama, ts } }`; **`admin/admin123` di-seed** | `seedUsers` 1837, `saveUser` 2160 |
| `ppapi_session` | `{m:'local',id}` atau `{m:'sb',e:email,r:role,t:access_token}` | `doLogin` 1853 |
| `ppapi_log` | `[{t,u,ts}]` maksimal 40 | `logAct` 1838 |
| `ppapi_backend` | `{url,key,on}` (Supabase) | `saveBk` 2090 |
| `ppapi_remote` | `{url,token,on}` (Upstash, **token mentah**) | `saveRm` 2064 |
| `ppapi_scaffold_v1_<user>` | `{v:1, answers, fields:{f-*}, ts}`. **Tidak** menyimpan input analisis/material. | `save` 1488 |
| `…_photos`, `…_plans`, `…_jsa`, `…_dwg` | foto (dataURL), unggahan (dataURL ≤ 4 MB per berkas), JSA, `{d:DWG,q:seq}` | 1827, 2911, 1777, 2302 |
| `ppapi_projects_<user>` | `[{id, name, tag, status, fields, answers, photos, plans, dwg, jsa, analisis:{vals:{an-*,ll-*}, mats}, ts}]` | `saveProject` 2200 |
| `ppapi_av_<user>` | dataURL JPEG 128×128 | `setAvatarFile` 1929 |
| `ppapi_scaffold_v1` (tanpa user) | sisa sebelum login | 1483 |

Situs PPAPI memakai `ppapi_demo_users`, `ppapi_demo_session`, `ppapi_member_<uid>`, `ppapi_feedback`, `ppapi_demo_admins`, `ppapi_content_*`, dan `ppapi_flash`. **Tidak ada nama yang persis sama**, tetapi awalan `ppapi_` dipakai bersama di origin yang sama. Di versi terintegrasi, kunci aplikasi perlu diberi namespace (§5.c).

### 3.4 Autentikasi, peran, admin, sesi
- **Mode lokal:**
  - `pwh()` (1834) adalah hash djb2 32-bit dengan *salt* konstanta `'ppapi.'+s+'.scaffold'`. Contoh: hash admin = `h16yzmn0`.
  - `boot()` (2951–2970) memanggil `seedUsers()`, lalu memulihkan sesi dari `ppapi_session` **tanpa memeriksa sandi**.
  - Sebelum login, `body.locked` hanya mem-*blur* konten: 3.620 karakter teks `main` tetap ada di DOM.
- **Peran:**
  - `admin` membuka tab Admin (`#tab-admin` 380), `renderAdmin` (2110), dan CRUD akun (`saveUser` 2160, `resetPw` 2181, `delUser` 2188).
  - Pemeriksaan `isAdmin()` (1975) sepenuhnya di sisi klien.
- **Akun hanya berlaku di perangkat itu:** `inspektor02` yang dibuat admin **gagal login** di konteks peramban lain (terbukti).
- **Supabase (opsional):** `doLogin` mengirim `POST {url}/auth/v1/token?grant_type=password`. Peran diambil dari `user_metadata.role` (baris 1871), padahal **pengguna dapat mengubah `user_metadata` miliknya sendiri**. Peran yang benar harus dari `app_metadata`. Token disimpan di `ppapi_session` dan saat dimuat ulang **tidak divalidasi** maupun diperbarui (2967). Yang disinkronkan hanya login; data proyek tetap lokal (catatan di markup 894).
- **Upstash Redis (opsional):** REST `GET/POST {url}/get|set/ppapi:proj:<user>` dengan `Authorization: Bearer <token>` langsung dari peramban (2036–2051). `syncNow` (2074) menggabungkan lokal dan remote berdasarkan `ts`. Satu token berlaku untuk semua kunci, sehingga pemisahan per pengguna hanya di sisi klien. Aplikasi sendiri sudah memberi peringatan di layar Admin (markup 882).

### 3.5 Dependensi eksternal (diamati di jaringan)
- `https://fonts.googleapis.com/css2` (Oswald, Inter); `fonts.gstatic.com`
- `https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js`, dimuat **di setiap kunjungan** walaupun hanya dipakai saat membuat PDF
- Melalui simulator: `cdnjs …/three.js/r128/three.min.js`, Google Fonts Space Grotesk, IBM Plex Sans/Mono
- Opsional: `*.supabase.co`, `*.upstash.io`

Tanpa internet, PDF gagal (`window.jspdf` tidak ada), kecuali SW sudah sempat meng-cache jsPDF.

### 3.6 Simulator tertanam
`ensureSimURL()` (1958) men-decode `SIM_B64` menjadi `Blob('text/html')` lalu `URL.createObjectURL`, dimuat di `iframe#sim-frame` atau `window.open`. URL `blob:` mewarisi origin pembuatnya, sehingga simulator **satu origin** dengan induknya dan dapat membaca `localStorage` induk. Ini terbukti: simulator bisa membaca `ppapi_session`. Di origin PPAPI, berarti simulator punya hak yang sama dengan portal. Isinya duplikat `simulator.html`, sehingga ada risiko kedua versi menyimpang.

### 3.7 PWA / service worker (`sw.js`, didaftarkan di `initApp` baris 2949)
- **install:** meng-cache `./`, `index.html`, manifest, dan ikon (nama cache `ppapi-scaffold-v1`).
- **activate:** `caches.keys()` lalu **menghapus semua cache yang namanya ≠ `ppapi-scaffold-v1`**. Cakupan `caches` adalah **satu origin penuh**, bukan per *scope*. Uji sub-path membuktikannya: cache `ppapi-site-v1` yang dibuat halaman portal **terhapus** begitu aplikasi di `/aplikasi/perencanaan/` aktif.
- **fetch:** semua GET dilayani **cache-first** dengan pembaruan di belakang (*stale-while-revalidate*), **termasuk lintas origin** (respons *opaque* ikut di-cache). Cache yang teramati berisi Google Fonts CSS/WOFF2 dan jsPDF. Di halaman terintegrasi, `config.js`, `core.js`, `auth.js`, SDK Firebase, dan permintaan GET Firestore (WebChannel) akan **di-cache dan disajikan basi**, dan cache tumbuh tanpa batas.
- **Scope:** `register('sw.js')` relatif sehingga scope menjadi `/aplikasi/perencanaan/` (terbukti). Manifest relatif juga benar (`/aplikasi/perencanaan/manifest.webmanifest`). **Tidak ada aset 404** di sub-path.
- **Luring:** dengan gerbang PPAPI, status anggota dibaca dari Firestore. Bila luring, `computeSession` mendapat `member=null`, status menjadi "Draf", lalu pengguna dialihkan. Jadi PWA luring akan **mengunci anggota aktif**, kecuali status terakhir di-cache dengan masa berlaku.

### 3.8 Cetak & PDF
- **Scaffold tag** (`tagHTML` 1097, `printTag` 1150): kartu depan (status, proyek, kelas beban, tanggal, periksa ulang +7 hari, kritis gagal, **"barcode" dekoratif dari 26 `<i>` yang tidak dapat dipindai**, 1107/1124) dan kartu belakang (rekaman inspeksi). Cetak memakai `@media print`, yang menyembunyikan `.view` dan menampilkan `#print-tag-area`. **`.fab` dan `.hazard` tidak disembunyikan**, sehingga tombol "Simulator 3D" ikut tercetak (d-10b).
- **PDF** (`buildPDF` 1221–1479, A4 mm, helvetica): halaman 1–2 berisi data proyek, verdict, skor per kategori, temuan, ringkasan analisis, butir pemeriksaan, dan dasar perhitungan. Halaman 3 berisi JSA, kesimpulan, dan tanda tangan. Berikutnya lampiran gambar rencana (SVG → PNG 1600 px) dan foto bukti. Ada footer "Hal i/n". Karakter khusus dibersihkan dengan `pdfSan` (1214), dan em dash serta ² tetap tampil benar (render pdf.js).
  - Masalah:
    - **Ukuran 10,2 MB**, karena PNG gambar 1600×1529 RGBA disisipkan **tanpa kompresi** (`toDataURL('image/png')` 1199 dan `addImage` 1432; RGB 7,3 MB + SMask 2,4 MB).
    - **Label menimpa nilai** di tabel analisis (`cx+30`, baris 1349), misalnya "BEBAN MATI MATERIAL" dan "TOTAL TERFAKTOR X1.5" (d-15-pdf-p1).
    - Rincian material dan tabel beban hidup **tidak dicetak**, padahal teks di layar menjanjikannya.
    - Judul PDF tetap "LAPORAN INSPEKSI PERANCAH" walau isinya juga perencanaan.
- **Ekspor JSON** (1491): `{v, app, answers, photos, plans, dwg, jsa, analisis, fields, ts}`. **Impor** (1492) tanpa validasi skema.

### 3.9 Aksesibilitas & ponsel (terukur)
- `lang="id"` ✓. Satu `h1` ("Scaffold Inspeksi").
- **57 dari 61 kontrol isian tanpa nama terprogram**, karena `<label>` tidak dikaitkan dengan `for`/`id`.
- Menu dropdown tanpa `aria-expanded`/`aria-controls`/peran. Tidak ada perangkap fokus pada modal simulator. `outline:none` pada fokus input (diganti box-shadow kuning).
- Editor gambar (SVG) hanya bisa dipakai dengan tetikus/sentuh, dengan pintasan keyboard bila ada elemen terpilih. Kanvas tidak dapat difokuskan (`tabindex` tidak ada).
- **Ponsel 390 px** (m-*):
  - Tidak ada *overflow* horizontal halaman.
  - **Header sticky setinggi 259 px** (logo, lencana LOKAL, chip pengguna, chip verdict, dan menu tersusun bertumpuk). Header ini **menutupi `.prog-wrap` sticky** (top 104 px, z-index 10 < 60), sehingga progres dan verdict checklist tidak terlihat saat menggulir (m-09b).
  - Tabel Beban Hidup, JSA, dan Admin harus digeser ke samping; isian kedua (berat per orang) terpotong (m-03).
  - Kanvas gambar hanya 304×171 px.
  - Tombol jawaban checklist 52×33 px (< 44 px).
  - FAB "Simulator 3D" menutupi tombol "Foto bukti" dan jawaban di kanan bawah.

---

## 4. Masalah, bug, dan risiko

Prioritas: P0 = wajib diperbaiki sebelum dipasang di origin PPAPI; P1 = saat porting; P2 = berikutnya.

| ID | Prio | Area | Baris | Bukti | Perbaikan |
|---|---|---|---|---|---|
| S1 | P0 | Akun bawaan `admin`/`admin123` di-seed di setiap perangkat | 1837 | Login berhasil (d-12) | Hapus `seedUsers` dan seluruh login lokal; ganti dengan SSO (§5.c). |
| S2 | P0 | Login hanya di sisi klien; sesi palsu `{"m":"local","id":"admin"}` memberi akses admin tanpa sandi | 2965–2970 | `forgedLocalSession → role admin` (d-14) | Hapus; sesi berasal dari PPAPI.session. |
| S3 | P0 | Supabase: peran dari `user_metadata` (dapat diubah pengguna); sesi `sb` dipulihkan tanpa validasi token | 1871, 2967 | `forgedSupabase → admin, badge SUPABASE` (d-14b) | Hapus integrasi Supabase. Bila kelak dipakai, gunakan `app_metadata` dan verifikasi `/auth/v1/user`. |
| S4 | P0 | XSS melalui `innerHTML` tanpa *escape*: `tagHTML` (proyek, lokasi, inspektor, tag…) | 1112–1121, 1135 | `<img onerror>` di Nama Proyek **tereksekusi** di Laporan | Escape semua nilai (`esc()`), atau `PPAPI.util.h`. |
| S5 | P0 | XSS: `renderProjects` (p.name/p.tag), `renderPlans` (nama berkas, `href` data), `renderAdmin` (nama dan **log** yang berisi nama proyek, jadi XSS tersimpan di dasbor admin), `renderAnalisis` (`value="${r.n}"`), `itemHTML` (`src="${hp}"` dari JSON impor) | 2237, 2918, 2132, 2136, 1501, 987, 1492 | Eksekusi kedua terbukti setelah Simpan Proyek | Escape + validasi skema impor (dataURL harus `^data:image/(jpeg|png);base64,`). |
| S6 | P0 | Token Upstash di localStorage, dipakai langsung dari peramban | 2031–2088 | Peringatan aplikasi sendiri (markup 882) | Hapus; arsip cloud lewat Firestore + rules (fase 2). |
| S7 | P0 | SW menghapus cache origin lain dan meng-cache semua GET lintas origin | `sw.js` | `portalCacheDeleted: true` | Jangan daftarkan SW (§5.a). |
| S8 | P1 | Simulator `blob:` satu origin dengan akses penuh ke storage | 1958–1974 | `canReadParentSessionKey` | Ganti dengan tautan/iframe ke `../simulator/index.html` (gerbang sama). |
| B1 | P1 | `#ringkasan-root` tidak pernah dirender, karena `go()` memeriksa `'ringkasan'` padahal tab itu sudah digabung ke `'laporan'` | 942, 947 | `ringkasanRootLen: 0` (d-10) | Di cabang `laporan`, panggil `renderRingkasan()`. |
| B2 | P1 | `st.answered` tidak ada (`stats()` mengembalikan `ans`) | 1801, 2127 | "dari **undefined**/52 item dinilai" | Ganti dengan `st.ans`. |
| B3 | P1 | Tanggal default `new Date().toISOString().slice(0,10)` memakai UTC | 1490, 2945 | Pukul 01.30 WIB menghasilkan `2026-10-08` | Pakai tanggal lokal (`PPAPI.util.todayIso()`). |
| B4 | P1 | Input Tahap 2/3/5/6 (`AN_IDS`, `matRows`) tidak tersimpan otomatis | 1488, 2197 | Setelah muat ulang: ll-org 5→2, an-tiang 10→6, material 14→8 baris | `save()` juga menyimpan `collectAnalisis()`; `initApp` memanggil `applyAnalisis`. |
| B5 | P1 | "Proyek Baru" tidak menghapus foto, unggahan, gambar, maupun analisis | 1490 | `afterResetAll: photos 1, dwg 17` | Reset seluruh state dan kunci `KEY_*`. |
| B6 | P1 | `an-bay`/`an-tiang`/`an-nklem` tidak mengikuti geometri | 616, 643, 658, 1524 | Kesimpulan "(3 bay)" untuk proyek 4 bay | Turunkan dari Data Proyek (E2). |
| B7 | P1 | PDF 10,2 MB (PNG tanpa kompresi) | 1199, 1432 | Daftar objek gambar PDF | Pakai JPEG (`toDataURL('image/jpeg',0.85)`) atau kompresi `addImage(...,'FAST')`; lebar 1200 px. |
| B8 | P1 | Label PDF menimpa nilai | 1349, 1270 | d-15-pdf-p1 | Pakai lebar kolom label dinamis (`getTextWidth`) atau tata letak dua baris. |
| B9 | P1 | FAB dan pita *hazard* ikut tercetak | 326–332 | d-10b | Tambahkan `.fab,.hazard,#dwg-ctx{display:none!important}` di `@media print`. |
| B10 | P1 | Teks pemeriksaan selalu "≤" | 1537–1578 | d-04 "10869 ≤ 10000 CEK" | E13. |
| B11 | P2 | Judul "8 Tahap" berisi 9; README "5 tab"; atribusi pengembang tidak konsisten | 431 | d-01 | Perbaiki teks. |
| B12 | P2 | Kegagalan simpan di localStorage ditelan diam-diam (foto/unggahan cepat memenuhi ±5 MB) | 1827, 2302, 2911 | Analisis kode | Tampilkan peringatan kuota; batasi ukuran; fase 2 pindah ke Storage. |
| B13 | P2 | `delUser` meninggalkan kunci `_jsa`, `_dwg`, `ppapi_av_*` | 2188–2194 | Kode | Hilang dengan sendirinya setelah fitur akun dihapus. |
| B14 | P2 | Aksesibilitas (label, ARIA menu, fokus, target sentuh 33 px) dan tata letak ponsel (header 259 px) | §3.9 | m-* | §5.e (CSS integrasi) + perbaikan label bertahap. |
| B15 | P2 | jsPDF memblokir render di `<head>` dan selalu dimuat | 15 | Jaringan | Muat malas saat `buildPDF`, atau `defer`. |
| B16 | P2 | Barcode tag hanya dekorasi | 1107 | d-10 | Ganti dengan QR berisi tautan verifikasi PPAPI (KTA inspektor / ID tag). |

---

## 5. Rencana integrasi ke situs PPAPI baru

**Keputusan arsitektur yang direkomendasikan:**
- Aplikasi menjadi **halaman mandiri** `site/aplikasi/perencanaan/index.html`, bukan iframe di dalam halaman situs.
- Halaman ini **tidak** memuat `main.css`. CSS legacy memakai selektor global seperti `header`, `nav`, `main`, `.card`, `.btn`, `.tab`, `.avatar`, `.stat`, `.badge-*`, `.eyebrow` yang akan bentrok dengan desain situs.
- Halaman memuat skrip inti situs untuk sesi, ditambah `site/aplikasi/gate.js` untuk gerbang dan bilah portal, sesuai SPEC-v2 §4.4.
- Pendekatan iframe di dalam halaman situs ditolak karena menimbulkan *scroll* bersarang (iOS), `position:fixed` editor layar penuh yang terkurung, dan offset sticky ganda. Tidak ada manfaat isolasi keamanan karena keduanya satu origin.

### 5.a Lokasi hosting & perubahan berkas
```
site/aplikasi/gate.js                      ← BARU (dipakai bersama dengan simulator)
site/aplikasi/perencanaan/index.html       ← dari legacy/index.html, dengan suntingan di bawah
site/aplikasi/perencanaan/icon.svg         ← opsional (favicon); ikon PNG lain tidak perlu bila PWA dimatikan
(TIDAK disalin: sw.js, manifest.webmanifest, 404.html, netlify.toml, vercel.json, robots.txt, simulator.html → milik site/aplikasi/simulator/)
```

| # | Suntingan pada `index.html` hasil salinan | Baris asal |
|---|---|---|
| 1 | `<html lang="id" data-root="../../" data-self="aplikasi/perencanaan/index.html" data-app-title="PPAPI Scaffold — Perencanaan & Analisis Struktur" class="app-gate-pending">`; tambahkan `<meta name="robots" content="noindex,nofollow">` | 2 |
| 2 | Hapus `<link rel="manifest">`; ikon tetap relatif (`icon.svg`) | 9–11 |
| 3 | jsPDF dimuat malas: hapus `<script>` di head; di awal `buildPDF` panggil `await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js')`, atau salin ke `vendor/` | 15, 1221 |
| 4 | Sebelum `</body>` (setelah skrip legacy) tambahkan: `<script src="../../assets/js/config.js" defer></script>`, `<script src="../../assets/js/core.js" defer></script>`, `<script src="../../assets/js/auth.js" defer></script>`, `<script src="../../assets/js/store.js" defer></script>`, `<script src="../gate.js" defer></script>`. **Jangan memberi `data-auth` pada `<body>`**: `loginUrl()` dan `leaveGate()` di `core.js` (2020, 2065) memakai `masuk.html`/`dashboard.html` relatif, yang dari sub-folder akan menjadi 404. | 2972–2989 |
| 5 | `<div id="app-gate">Memverifikasi keanggotaan…</div>` sebagai anak pertama `<body>` + CSS penyamaran (§5.e) | 336 |
| 6 | Hapus `#login-screen` (markup + CSS `#login-screen`, `.login-*`, `#lg-err`, `body.locked`) | 385–396, 183–197 |
| 7 | Hapus `#tab-admin` dan seluruh `section#v-admin`, beserta fungsi `getBk…testBk`, `renderAdmin`, `editUser…delUser`, `rm*`, `syncNow`; hapus cabang `go('admin')` | 380, 866–913, 1840–1852, 2030–2195, 946 |
| 8 | Hapus tombol "↻ Sinkronkan Cloud"; di `saveProject`/`renderProjects` hapus cabang `rmActive()` | 517, 2218–2222, 2226–2232 |
| 9 | `#bk-badge` disembunyikan permanen; `renderBkBadge()` dijadikan *no-op* | 347, 1844 |
| 10 | Ganti `SIM_B64` + modal blob dengan `openSim(){ location.href='../simulator/index.html'; }`, atau iframe `src="../simulator/index.html"`. Ukuran berkurang 133 KB. | 1955–1974, 2973–2988 |
| 11 | Hapus pendaftaran SW di `initApp` | 2949 |
| 12 | Ganti `boot()` dengan `appBoot()` + `window.PPAPI_APP_START` (§5.c) | 2951–2970 |
| 13 | Namespace kunci: `KEY` → `'ppapi_app_perencanaan_v1_'+id`, `projStoreKey` → `'ppapi_app_perencanaan_projects_'+u`, `LOG_KEY` → `'ppapi_app_perencanaan_log'`, `avKey` dihapus (foto dari PPAPI) | 1483, 1832, 1898, 1915, 1978 |
| 14 | Perbaikan P0/P1 dari §4 (S4/S5, B1–B10) | lihat §4 |

**Kebijakan PWA:** dimatikan. Bila klien tetap menginginkan instalasi:
- Pakai `sw.js` baru dengan cache `ppapi-perencanaan-v2`.
- `activate` hanya menghapus kunci yang berawalan `ppapi-perencanaan-`.
- `fetch` hanya melayani GET **satu origin** dengan path di bawah `/aplikasi/perencanaan/`. HTML memakai *network-first*. `../../assets/` dan semua lintas origin (gstatic, firestore) **tidak** di-cache.
- Status Aktif terakhir di-cache ±7 hari agar tidak terkunci saat luring.
- Untuk deployment lama `ppapiid.vercel.app`: pasang `sw.js` *kill-switch* (`self.registration.unregister()` + hapus cache) dan alihkan pengunjung ke portal. Anggota lama dapat memindahkan data lewat **Ekspor/Muat Data (.json)**.

### 5.b Gerbang: `site/aplikasi/gate.js`
```js
/* ==========================================================================
   gate.js — Gerbang aplikasi anggota PPAPI (khusus anggota berstatus Aktif / admin)
   Dimuat SETELAH ../../assets/js/{config,core,auth,store}.js (semua defer).
   <html data-root="../../" data-self="aplikasi/perencanaan/index.html" data-app-title="…">
   Aplikasi menyediakan window.PPAPI_APP_START(user) — dipanggil SEKALI setelah lolos gerbang.
   ========================================================================== */
(function (w, d) {
  'use strict';
  var html = d.documentElement;
  var ROOT = html.getAttribute('data-root') || '../../';
  var SELF = html.getAttribute('data-self') || '';
  var TITLE = html.getAttribute('data-app-title') || 'Aplikasi Anggota';
  var started = false, leaving = false;

  function to(path) { leaving = true; w.location.replace(ROOT + path); }
  function esc(s) { return (w.PPAPI && PPAPI.util && PPAPI.util.h) ? PPAPI.util.h(s) : String(s == null ? '' : s).replace(/[&<>"'`]/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); }
  function fail(msg) {
    var g = d.getElementById('app-gate');
    if (g) g.innerHTML = '<p>' + esc(msg) + '</p><p><a href="' + ROOT + 'dashboard.html">Kembali ke Portal Anggota</a></p>';
  }
  var timer = setTimeout(function () { fail('Status keanggotaan belum dapat dipastikan. Periksa koneksi internet, lalu muat ulang halaman.'); }, 25000);
  if (!w.PPAPI || typeof PPAPI.onReady !== 'function' || !PPAPI.session) { clearTimeout(timer); fail('Komponen portal tidak termuat.'); return; }

  function bar(s) {
    var name = (s.member && s.member.name) || s.user.name || s.user.email || 'Anggota';
    var badge = s.isAdmin ? 'Admin' : (s.status || '');
    var el = d.createElement('div');
    el.className = 'pp-bar';
    el.setAttribute('role', 'navigation');
    el.setAttribute('aria-label', 'Portal Anggota PPAPI');
    el.innerHTML =
      '<a class="pp-bar__back" href="' + ROOT + 'dashboard.html"><span aria-hidden="true">&larr;</span><span>Portal Anggota PPAPI</span></a>' +
      '<span class="pp-bar__title">' + esc(TITLE) + '</span>' +
      '<span class="pp-bar__user"><span class="pp-bar__name">' + esc(name) + '</span>' +
        (badge ? '<span class="pp-bar__badge">' + esc(badge) + '</span>' : '') + '</span>' +
      '<button type="button" class="pp-bar__out">Keluar</button>';   /* BUKAN [data-signout]: alur core.js mengarah ke index.html relatif */
    d.body.insertBefore(el, d.body.firstChild);
    el.querySelector('.pp-bar__out').addEventListener('click', function () {
      Promise.resolve(PPAPI.auth.signOut()).catch(function () {}).then(function () { to('index.html'); });
    });
  }

  PPAPI.onReady(function () {
    clearTimeout(timer);
    var s = PPAPI.session.current();
    if (!s.user) return to('masuk.html?next=' + encodeURIComponent(SELF));
    if (!s.isActive) {
      try { PPAPI.ui.flash('Fitur ini khusus anggota berstatus Aktif.', { type: 'warn', timeout: 6000 }); } catch (e) {}
      return to('dashboard.html');
    }
    bar(s);
    var u = {
      uid: s.user.uid,
      name: (s.member && s.member.name) || s.user.name || s.user.email || 'Anggota',
      email: s.user.email || '', photoURL: s.user.photoURL || '',
      kta: (s.member && s.member.kta) || '', status: s.status,
      role: s.isAdmin ? 'admin' : 'user'
    };
    try { if (!started && typeof w.PPAPI_APP_START === 'function') { started = true; w.PPAPI_APP_START(u); } }
    catch (e) { console.error('[gate]', e); return fail('Aplikasi gagal dimulai. Silakan muat ulang halaman.'); }
    html.classList.remove('app-gate-pending');
    PPAPI.session.onChange(function (st) {           /* keluar di tab lain / status dicabut admin */
      if (leaving) return;
      if (!st.user) to('index.html');
      else if (st.user.uid !== u.uid) w.location.reload();
      else if (!st.isActive) to('dashboard.html');
    });
  });
})(window, document);
```
`util.safeNext` di situs sudah menerima `aplikasi/perencanaan/index.html` (pola `[A-Za-z0-9_\-./]*\.html`, tanpa `..`). Jadi setelah masuk, `masuk.html` mengembalikan pengguna langsung ke aplikasi.

**Batasan yang perlu dinyatakan jujur (README dan halaman Tentang):**
1. Di hosting statis (GitHub Pages), `site/aplikasi/perencanaan/index.html` beserta seluruh kodenya **dapat diunduh siapa pun lewat URL langsung** atau dari repositori. Gerbang hanya menyembunyikan antarmuka. Bila repositori publik, kodenya memang publik.
2. Di **Mode Demo**, status anggota tersimpan di `localStorage` (`ppapi_member_<uid>`), sehingga gerbang bisa dibuka lewat DevTools. Di **mode Firebase**, status dilindungi Firestore rules (anggota tidak bisa mengubah `status`). Gerbang dapat dipercaya untuk pengguna jujur, tetapi tetap tidak merahasiakan kode.
3. Penegakan akses yang sungguhan dilakukan pada **data**:
   - Arsip proyek dan foto disimpan di Firestore/Storage (fase 2) dengan rules `isActiveMember() || isAdmin()`.
   - `isActiveMember()` pada SPEC-v2 §3.4 sebaiknya juga memeriksa masa berlaku. Simpan `validUntil` sebagai Timestamp dan bandingkan dengan `request.time`, karena status "Kedaluwarsa" saat ini hanya dihitung di klien.
   - Bila kerahasiaan kode memang diwajibkan, simpan HTML aplikasi di Firebase Storage dengan rules yang memeriksa `firestore.get(/databases/(default)/documents/members/$(request.auth.uid)).data.status == 'Aktif'`, lalu muat sebagai blob setelah login. Alternatif lainnya hosting dengan verifikasi token di tepi jaringan (Cloud Functions, Cloudflare Access).

### 5.c Jembatan SSO (perubahan pada skrip legacy)
Ganti blok `boot()` (baris 2951–2970) dan tambahkan di dekat `startSession` (1895):
```js
/* ---------- SSO PPAPI: menggantikan login lokal, Supabase, dan manajemen akun ---------- */
let SSO = null;
function ssoId(uid){ return 'u_' + String(uid).replace(/[^a-z0-9_-]/gi, '_').slice(0, 64); }
function appBoot(){                       // = isi boot() lama TANPA seedUsers() dan TANPA pemulihan ppapi_session
  document.addEventListener('click', function(e){ /* tutup menu, sama seperti 2957–2960 */ });
  renderChangelog();
  document.addEventListener('keydown', function(e){ if(e.key==='Escape') closeSim(); });
}
function startSessionSSO(u){
  SSO = u;
  CURRENT_USER = ssoId(u.uid);
  CURRENT_ROLE = (u.role === 'admin') ? 'admin' : 'user';   // admin PPAPI → admin aplikasi; lainnya → user
  KEY = 'ppapi_app_perencanaan_v1_' + CURRENT_USER;
  try { ['ppapi_session','ppapi_users','ppapi_backend','ppapi_remote'].forEach(function(k){ localStorage.removeItem(k); }); } catch(e){}
  document.body.classList.remove('locked');
  renderAvatar();                                            // versi baru: SSO.photoURL atau inisial SSO.name
  const nm = document.getElementById('user-name'); if (nm) nm.textContent = u.name;
  initApp();
  const fi = document.getElementById('f-inspektor');        // isi otomatis inspektor (nama + KTA)
  if (fi && !fi.value) { fi.value = u.name + (u.kta ? ' · KTA ' + u.kta : ''); save(); }
}
window.PPAPI_APP_START = function(u){ if (SSO) return; appBoot(); startSessionSSO(u); };
```
Perubahan pendamping:
- `logout()` (1887): `PPAPI.auth.signOut().finally(()=>location.replace('../../index.html'))`. `#user-chip` (348) disembunyikan karena identitas sudah tampil di bilah portal.
- `renderAvatar()` (1916): pakai `SSO.photoURL` (bila `https:`), bila tidak, inisial dari `SSO.name`. Hapus `#av-input` dan `setAvatarFile` (355, 1929).
- `isAdmin()` (1975) tetap ada. Tidak ada fitur khusus admin yang tersisa, dan manajemen akun **dipindah ke Konsol Admin PPAPI** (`admin.html`). Pada fase 2, admin PPAPI dapat melihat arsip proyek anggota di Konsol Admin (Firestore).
- `logAct` (1838) tetap lokal, atau dihapus.
- **Data per pengguna di perangkat bersama:** kunci ber-UID mencegah pencampuran data antarakun. Data akun lain tetap tersimpan di peramban, jadi dokumentasikan bahwa "Ekspor JSON lalu Proyek Baru" sebelum menyerahkan perangkat ke orang lain. Atau sediakan tombol "Hapus data aplikasi di perangkat ini".
- **Fase 2 (opsional):** arsip proyek di Firestore `app_perencanaan/{uid}/proyek/{id}` (tanpa foto, dokumen ≤ 1 MiB) dan foto di Storage `app_perencanaan/{uid}/…`; rules: pemilik dan (anggota aktif atau admin); admin boleh membaca. Store whitelist situs tidak disentuh.

### 5.d Opsi penyelarasan visual
| Opsi | Uraian | Rekomendasi |
|---|---|---|
| **A. Pertahankan identitas aplikasi + bilah portal monokrom** | Kuning *hazard* / Oswald tetap. Bilah portal hitam (Inter + Barlow Condensed) menandai bahwa aplikasi ini bagian dari portal. Risiko paling kecil. | **Disarankan untuk rilis pertama** |
| B. *Reskin* ringan | Override token `:root` legacy: `--ink:#0a0a0b; --steel:#26262a; --paper:#f6f6f4; --hz:#b9b9bf; --hz2:#8b8b92`; Oswald diganti Barlow Condensed; pita `.hazard` diganti garis *metal*. Banyak warna masih ter-*hardcode*, sehingga ±40 baris CSS tambahan perlu diuji. | Fase 2 |
| C. Monokrom penuh | **Tidak disarankan.** Warna verdict HIJAU/KUNING/MERAH dan warna tag adalah **semantik keselamatan** (konvensi scafftag industri) dan harus tetap berwarna. | — |

Pada semua opsi: samakan atribusi ("Aset PPAPI, dikembangkan bersama [atribusi lama, dihapus] / [atribusi lama, dihapus]"), perbarui halaman Tentang dan daftar acuan (E14), dan tambahkan tautan "Panduan penggunaan" ke `pustaka.html` (SPEC-v2 §4.3 menyediakan butir "Panduan penggunaan aplikasi PPAPI Scaffold & simulator").

### 5.e Bilah "Kembali ke Portal Anggota" dan CSS integrasi
Sisipkan di `<style>` aplikasi. Nilai warna mengikuti token situs:
```css
:root{ --pbar-h:44px }
html.app-gate-pending body > :not(#app-gate){ visibility:hidden }
#app-gate{ position:fixed; inset:0; z-index:500; display:grid; place-items:center; gap:8px; text-align:center;
  background:#0a0a0b; color:#ececea; font:500 14px/1.6 Inter,system-ui,sans-serif; padding:24px }
#app-gate a{ color:#ececea }
html:not(.app-gate-pending) #app-gate{ display:none }

.pp-bar{ position:sticky; top:0; z-index:70; height:var(--pbar-h); display:flex; align-items:center; gap:16px;
  padding:0 16px; background:#0a0a0b; color:#ececea; border-bottom:1px solid rgba(255,255,255,.12);
  font:500 13px/1 Inter,system-ui,sans-serif }
.pp-bar a,.pp-bar button{ color:inherit; background:none; border:0; font:inherit; cursor:pointer;
  min-height:44px; display:inline-flex; align-items:center; gap:8px; text-decoration:none }
.pp-bar a:focus-visible,.pp-bar button:focus-visible{ outline:2px solid #ececea; outline-offset:3px }
.pp-bar__title{ flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#b9b9bf;
  font-family:"Barlow Condensed","Arial Narrow",sans-serif; letter-spacing:.14em; text-transform:uppercase }
.pp-bar__badge{ margin-left:8px; padding:3px 8px; border:1px solid rgba(255,255,255,.24); border-radius:2px; font-size:11px }
/* header aplikasi menempel DI BAWAH bilah; offset sticky lain ikut bergeser */
header{ top:var(--pbar-h) }
.prog-wrap{ top:calc(var(--pbar-h) + 118px) }
.dwg-palette{ top:calc(var(--pbar-h) + 74px) }
#bk-badge,#user-chip{ display:none !important }
@media (max-width:680px){
  .pp-bar__title,.pp-bar__name{ display:none }
  header{ position:static }                 /* header 259 px tidak lagi menutupi layar */
  .prog-wrap{ top:var(--pbar-h) }           /* progres & verdict checklist terlihat lagi */
  .ab{ min-height:44px; min-width:52px }    /* target sentuh */
  .fab{ right:12px; bottom:12px; padding:10px 14px }
}
@media print{ .pp-bar,#app-gate,.fab,.hazard,#dwg-ctx{ display:none !important } }
```
Urutan *z-index*: header aplikasi 60 < bilah 70 < menu dropdown (200, di dalam konteks header) < editor layar penuh 260 (menutup bilah, sesuai yang diinginkan) < modal 300 < menu konteks 400 < penyamar gerbang 500.

**Titik masuk dari situs:**
- `config.apps[]` (SPEC-v2 §3.5): `{ key:'perencanaan', url:'aplikasi/perencanaan/index.html', … }`.
- `dashboard.js` (`dash-apps`), tab Aplikasi di `anggota.js`, kartu "Aplikasi" di `pustaka.html`.
- Untuk non-aktif: `ui.locked`.
- Tautan internal **tidak** perlu `target="_blank"`.

### 5.f Risiko integrasi & mitigasi
| Risiko | Mitigasi |
|---|---|
| Inti situs berubah (SPEC-v2), misalnya `PPAPI.onReady` belum menunggu sesi | `gate.js` memakai `await PPAPI.session.ready()` secara eksplisit bila `isResolved()` masih false; pertahankan uji kontrak |
| `core.js` menyuntikkan toast tanpa `main.css` | Gerbang tidak memakai `ui.toast`; hanya `ui.flash` sebelum pengalihan |
| Ukuran dan kecepatan (491 KB, jsPDF di `<head>`) | Hapus `SIM_B64` (−133 KB), muat jsPDF secara malas; opsional ganti `LOGO_*` base64 dengan berkas |
| Kehilangan data saat migrasi dari vercel | Banner "Pindahkan data dari aplikasi lama: Ekspor JSON → Muat Data" + validasi skema impor |
| Perbedaan hasil hitung setelah perbaikan teknik | Bekukan nilai acuan §2.8; setiap perubahan rumus wajib disertai catatan rilis dan persetujuan ahli PPAPI |
| Klaim keselamatan | Label "Indikatif / Perlu verifikasi ahli" di layar dan PDF; hindari kata "AMAN" tanpa kualifikasi pada hasil analisis |

### 5.g Rencana pengujian (`devtools/flows/aplikasi-perencanaan-flow.mjs`)
1. **Gerbang:**
   - Belum masuk → `../../masuk.html?next=aplikasi%2Fperencanaan%2Findex.html`, lalu setelah masuk kembali ke aplikasi.
   - Status `Draf`, `Menunggu Verifikasi`, `Perlu Perbaikan`, `Ditolak`, `Nonaktif`, dan `Kedaluwarsa` (`check.mjs --auth --status=…`) → `dashboard.html` + *flash* "Fitur ini khusus anggota berstatus Aktif."
   - Anggota Aktif dan admin (`--admin`) → aplikasi terlihat.
   - Tidak ada kilasan konten saat `app-gate-pending`.
   - Pesan timeout muncul bila sesi tidak siap (stub).
2. **SSO:**
   - Tidak ada layar login.
   - `localStorage` tidak memuat `ppapi_users`/`ppapi_session`.
   - `KEY` = `ppapi_app_perencanaan_v1_u_<uid>`.
   - Dua akun di peramban yang sama tidak saling melihat proyek.
   - `#tab-admin` dan `#v-admin` tidak ada.
   - `f-inspektor` terisi otomatis.
   - "Keluar" di bilah → `index.html` dan sesi berakhir.
   - Keluar di tab lain → aplikasi berpindah ke beranda.
3. **Regresi hitung:** semua nilai §2.8 sama (atau sesuai versi yang sudah dikoreksi dan disetujui).
4. **Bug P1:**
   - Ringkasan Laporan terisi.
   - Tidak ada "undefined".
   - Tanggal default benar pada jam palsu 01.30 WIB.
   - Input Tahap 2–6 bertahan setelah muat ulang.
   - "Proyek Baru" mengosongkan foto/gambar.
   - PDF < 2 MB tanpa label bertumpuk.
   - Cetak tag tanpa FAB, *hazard*, atau bilah.
5. **Keamanan:** muatan `<img src=x onerror>` di semua isian teks, nama berkas unggahan, dan JSON impor (dataURL palsu, nama proyek) → **tidak ada eksekusi** (`window.__xss` tetap undefined).
6. **SW/cache:** tidak ada registrasi SW di `/aplikasi/`; cache milik situs tetap utuh setelah aplikasi dibuka.
7. **Ponsel 390 px:**
   - Tanpa *overflow* horizontal.
   - Bilah dan `.prog-wrap` terlihat saat checklist digulir.
   - Tombol jawaban ≥ 44 px.
   - FAB tidak menutupi jawaban terakhir.
   - Screenshot tiap tahap.
8. **Aksesibilitas:** bilah memiliki `role=navigation`, fokus terlihat, dan seluruh bilah dapat dipakai dengan keyboard. Pemeriksaan axe pada halaman aplikasi (target: tidak ada pelanggaran *critical* pada bilah dan gerbang; temuan legacy dicatat sebagai utang P2).
9. **Simulator:** tombol Simulator membuka `../simulator/index.html` dengan gerbang yang sama; tidak ada `blob:`.

---

## Lampiran A: Menjalankan ulang analisis & daftar screenshot
```
cd devtools
node flows/legacy-perencanaan.mjs   <scratch>/legacy-pr.json          # alur 12 tampilan desktop+ponsel, sub-path SW, sesi palsu, XSS
node flows/legacy-perencanaan-2.mjs <scratch>/legacy-pr2.json <pdf>   # persistensi, tanggal WIB, akun lintas perangkat, Supabase palsu, render PDF
```
Kedua skrip menyajikan `legacy/asosiasi.ppapi-main` lewat server HTTP Node lokal (juga di bawah `/aplikasi/perencanaan/`) dan tidak mengubah berkas sumber. Kredensial yang dipakai adalah kredensial bawaan aplikasi sendiri, di host lokal.

Screenshot (`devtools/shots/`):
- **Desktop:**
  - `legacy-pr-d-00-login`, `-01-beranda`, `-01b-menu`, `-02-proyek`, `-03-beban`
  - `-04-duty-independent`, `-04b-duty-suspended`, `-04c-duty-mobile`
  - `-05-gambar`, `-05b-gambar-fullscreen`, `-06-material`, `-07-analisis`, `-08-jsa`, `-09-checklist`
  - `-10-laporan`, `-10b-print-tag`, `-11-tentang`, `-12-admin`, `-13-simulator-modal`
  - `-14-bypass-forged-session`, `-14b-forged-supabase`, `-15-pdf-p1…p5`
- **Ponsel:**
  - `legacy-pr-m-00-login`, `-00b-menu`
  - `-01-beranda` … `-12-admin`: versi *viewport* dan `-full`
  - `-09b-checklist-scrolled`

## Lampiran B: Sumber yang dipakai untuk pemeriksaan silang
- CFMEU Victoria, *Scaffold Guide* (2024): beban duty 225/450/675 kg dengan beban titik 100/150/200 kg; lebar 450/675 mm. https://vic.cfmeu.org/wp-content/uploads/2024/08/scaffold-guide-web.pdf
- WorkSafe ACT, Scaffolding: 225/450/675 kg per bay; 2/4/5 papan. https://www.worksafe.act.gov.au/health-and-safety-portal/safety-by-industry/building-and-construction/scaffolding (dikutip melalui ringkasan hasil pencarian karena halaman menolak diambil langsung, HTTP 403)
- ALTA Scaffolding, mengutip AS/NZS 1576: https://altascaffolding.com.au/calculating-the-safe-load-for-scaffolding/
- Scaffolders Forum, kutipan TG20:13 Tabel 5.15 (6,1/9,1 kN) dan BS 5973 Tabel 17 (6,3/9,4 kN): https://scaffoldersforum.com/goto/post?id=358682 (sumber sekunder)
- Scaffolders Forum, kutipan HSE bahwa BS 5973 tidak diakui sejak 1 Januari 2011: https://scaffoldersforum.com/threads/bs-5973.2895/latest (sumber sekunder)
- NASC TG20:21: https://nasc.org.uk/product/tg2021-eportal-access-new-subscription/embed
- EN 74-1:2022 (menggantikan 2005): https://online.standard.no/en/ns-en-74-1-2022
- Kelas beban BS EN 12811-1: https://squote.app/knowledge/scaffolding/scaffold-loading-limits ; https://travail-industrie.com/outils/calculateur-charge-echafaudage
- ABM, *Mobile Tower Scaffold* (kaidah 3× lebar dasar): https://nucleusuk.abm.com/wp-content/uploads/2022/10/10-Mobile-Tower-Scaffold.pdf
- JDIH Kemnaker, Kepmenaker 46/2022 (SKKNI operasi scaffolding): https://jdih.kemnaker.go.id/peraturan/detail/2235/keputusan-menteri-ketenagakerjaan-nomor-46-tahun-2022
- Edisi standar dan regulasi yang berlaku: `site/assets/data/regulasi.js` (diverifikasi 8 Oktober 2026), memuat AS/NZS 1576.1:2019, AS 4576:2020, BS EN 74-1:2022, TG20:21, SNI 8987:2021, Permenaker 9/2016, dan Kepmenaker 46/2022.
- Kapasitas tekuk tiang pada §2.6 adalah **perhitungan penulis** (Perry-Robertson gaya BS 449, beban sentris) untuk pembanding orde besaran, **bukan** nilai standar.
