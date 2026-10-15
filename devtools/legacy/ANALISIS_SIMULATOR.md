# Analisis Aplikasi Lama: Simulator Pemasangan Scaffolding — Tube & Coupler

- **Berkas:** `devtools/legacy/asosiasi.ppapi-main/simulator.html` (1.441 baris, 99.761 bita; satu berkas berisi `<style>` + `<script>` inline)
- **Pustaka:** three.js **r128** (cdnjs, `three.min.js` 603.445 bita), Google Fonts (Space Grotesk, IBM Plex Sans, IBM Plex Mono)
- **Tanggal analisis:** 9 Oktober 2026. Analisis ini hanya membaca berkas. Tidak ada berkas di `site/` atau `asosiasi.ppapi-main/` yang diubah.
- **Cara verifikasi:** aplikasi dijalankan di Chromium headless (WebGL SwiftShader: `--use-angle=swiftshader --enable-unsafe-swiftshader`) pada desktop 1366×768 dan ponsel 390×844 (sentuh, DPR 2) serta 844×390. Seluruh 20 tahap dijalankan sampai selesai, lalu mode inspeksi diuji. Diukur juga `renderer.info`, kebocoran memori, keyboard, perubahan ukuran layar, hilangnya konteks WebGL, kondisi tanpa WebGL, dan CDN yang diblokir.
  - Skrip: `devtools/flows/legacy-simulator.mjs` (alur utama) dan `devtools/flows/legacy-simulator-touch.mjs` (uji lanjutan sentuh)
  - Tangkapan layar: `devtools/shots/legacy-sim-*.png` (daftar lengkap di Lampiran A)
- **Temuan samping:** `index.html` lama (aplikasi analisis) menyimpan salinan simulator yang **identik byte demi byte** sebagai base64 (`const SIM_B64`, 133 KB, baris 1956). Salinan itu dibuka lewat *blob URL* di dalam iframe modal (`openSim()` / `openSimFull()`, baris 1957–1974; tombol `.fab` "Simulator 3D", baris 2973). Pada deployment lama, `simulator.html` juga dapat dibuka langsung tanpa login. Artinya ada **dua salinan kode yang harus dijaga** dan **tidak ada pembatasan akses sama sekali**.

---

## 1. Ringkasan, alur penggunaan, tahapan, komponen, kontrol, inspeksi, skor

### 1.1 Ringkasan
Simulator 3D pelatihan K3 untuk perancah *tube & coupler*. Strukturnya menara bebas (*freestanding*) **2 bay × 1 lebar**, yaitu 3 kolom × 2 baris standard = 6 standard. Ukurannya bay 3,0 m, lebar 2,4 m, tinggi standard 5,2 m, dengan dua lift (2,0 m dan 4,0 m) serta lantai kerja utama di +4,11 m. Aplikasi terdiri dari tiga modul (tab), dan seluruh teks antarmukanya berbahasa Indonesia.

| Modul | Isi |
|---|---|
| **01 Pengenalan Coupler** | 18 komponen dalam model 3D yang berputar di atas *pedestal*: Pipa, Sole Board, Base Plate, Klem Mati, Klem Putar, Sleeve, Joint Pin, Putlog, Klem Papan, Plank, Tangga, Beam Clamp, Anchor Clamp, Kunci Ratchet, Level Meter, Distance Meter, Tag Hijau, Tag Merah. Setiap komponen punya deskripsi fungsi dan tabel SUDUT / PERAN / TIPE. |
| **02 Simulasi Perakitan** | 20 tahap berurutan. Komponen berikutnya ditampilkan sebagai *ghost* kuning transparan. Pengguna menekan "Pasang Komponen →" atau mengklik ghost di 3D, dan dapat mundur dengan tombol ↶. Beberapa tahap memunculkan alat bantu visual: waterpass, simbol siku 90°, busur sudut bracing, dan garis diagonal kesikuan. |
| **03 Inspeksi & Pengukuran** | Empat sakelar *overlay*: Kelurusan Vertikal (unting-unting), Kedataran Horizontal, Jarak Antar Pipa, dan Kesikuan 90° (diagonal 3,84 m). Hasilnya berupa label teks di ruang 3D. |

### 1.2 Alur penggunaan (terverifikasi)
1. Layar intro (`#intro`) menampilkan empat kartu fitur dan tombol **"Mulai Simulasi"** (`legacy-sim-d-01-intro.png`).
2. Modul 01 terbuka (`legacy-sim-d-02-lib.png`). Pengguna memilih komponen di grid 3×6, dan model berputar otomatis (`libHolder.rotation.y += 0.006` per frame).
3. Tab 02: progres `0/20` → kartu tahap (nomor, judul, deskripsi HTML, *chip* komponen, 2–5 butir cek) → **Pasang Komponen →**. Tahap 16 memakai label tombol khusus "Bongkar Lantai Sementara →".
4. Setelah 20/20 muncul *banner* "Perancah berdiri lengkap" dengan tombol **"↶ Bongkar 1 tahap"** (teruji: 20 → 19, kembali ke tahap 20) dan **"Mulai Inspeksi →"** (`legacy-sim-d-05-done.png`). Toast yang muncul berbunyi "Perancah selesai! Buka tab Inspeksi untuk verifikasi.".
5. Tab 03 memaksa seluruh struktur tampil (`stepGroups.forEach(g => g.visible = true)`) dan menyembunyikan lantai sementara. Pengguna menyalakan keempat sakelar untuk memunculkan 18 label (`legacy-sim-d-07-insp-all.png`).
6. **Tab 03 dapat dibuka kapan saja**, termasuk saat 0 tahap selesai. Struktur lengkap tetap muncul, sedangkan progres (`state.current`) tidak berubah.

### 1.3 Daftar lengkap tahapan pemasangan (urutan aplikasi)
Isi tiap tahap diambil dari `STEPS` (baris 597–705) dan dicocokkan dengan jalannya aplikasi. Gambaran semua tahap ada di `legacy-sim-d-steps-contact.png`.

| # | Judul tahap (persis) | Komponen 3D yang ditambahkan | Coupler / chip | Draw calls* |
|---|---|---|---|---|
| 1 | Sole board (papan alas) | 6 papan alas 0,45×0,40 m | Sole Board | 8 |
| 2 | Base plate / jack dasar | 6 base plate 0,16 m + soket | Base Plate | 44 |
| 3 | Dirikan 6 standard | 6 standard **langsung setinggi penuh 5,2 m** | Pipa Ø48,3 | 50 |
| 4 | Ledger dasar (±30 cm) — sudut 90° | 2 ledger 6 m @ +0,30 m + 6 klem mati | Klem Mati | 74 |
| 5 | Transom dasar — sudut 90° | 3 transom 2,4 m @ +0,36 m + 6 klem; panduan diagonal | Klem Mati | 101 |
| 6 | Bracing diagonal (bay tangga dibiarkan bebas) | 5 brace (depan 2 bay, belakang bay-2, 2 ujung) dari +0,30 ke **+4,0 m** + 10 swivel | Klem Putar | 129 |
| 7 | Ledger lift-1 (jarak 2 m) | ledger @ +2,00 m | Klem Mati | 150 |
| 8 | Transom lift-1 | transom @ +2,06 m | Klem Mati | 169 |
| 9 | Lantai kerja sementara | 9 papan 6,1 m @ +2,10 m (sementara) | Plank | 194 |
| 10 | Sambung standard (sleeve, staggered) | 6 sleeve selang-seling @ +2,25 / +4,25 m | Sleeve | 218 |
| 11 | Ledger lift-2 | ledger @ +4,00 m | Klem Mati | 242 |
| 12 | Transom lift-2 — DI BAWAH ledger | transom @ +3,94 m | Klem Mati | 261 |
| 13 | Outrigger (±2/3 tinggi) | 4 penopang miring dari +3,45 m ke base plate 0,7 m di luar sudut + swivel | Klem Putar | 299 |
| 14 | Putlog — DI ATAS ledger teratas (≥3 / bay) | 9 putlog tiap 0,75 m @ +4,06 m + 18 klem putlog | Klem Putlog | 362 |
| 15 | Lantai kerja utama (top lift) | 9 papan @ +4,11 m | Plank | 389 |
| 16 | Bongkar lantai kerja sementara | lantai tahap 9 disembunyikan | Plank | 362 |
| 17 | Mid rail (pagar tengah) | rail keliling @ +4,58 m dengan bukaan akses ±1 m | Klem Mati | 384 |
| 18 | Top rail (handrail) | rail keliling @ +5,05 m | Klem Mati | 406 |
| 19 | Puncheon di tepi (semua sisi) + toe board | 5 puncheon, toe board 150 mm, klem papan | Klem Papan | 484 |
| 20 | Tangga di ujung kiri + pintu akses + tag layak | tangga 4:1 (puncak 1 m di atas lantai), 2 *ladder tie*, puncheon pintu, **tag hijau** | Tangga | 543 |

\* Draw calls per frame termasuk *shadow pass*, diukur saat tahap tersebut tampil sebagai pratinjau.

Komponen yang hanya muncul di Modul 01 dan tidak pernah dipakai saat perakitan: **joint pin, beam clamp, anchor clamp/tie, tag merah, kunci ratchet, level meter, distance meter**.

### 1.4 Atribut komponen yang disimulasikan
Katalog `COUPLER` (baris 387–442) berisi `hex/color`, `name`, `sudut`, `beban` (ditampilkan sebagai "PERAN"), `tebal` (ditampilkan sebagai "TIPE"), dan `fungsi`. Contoh: *Klem Mati — 90° tetap — Struktural (load-bearing) — Double coupler*, *Plank — 225 × 38 mm — BS 2482*. Warna pita coupler juga dipakai di legenda kiri bawah, yang hanya tampil di Modul 02.

### 1.5 Kontrol (terverifikasi)
| Kontrol | Perilaku | Hasil uji |
|---|---|---|
| Mouse | kiri-seret = orbit, kanan/tengah-seret = geser, roda = zoom, klik ghost = pasang | Klik ghost tahap 1 berhasil memajukan tahap (OK) |
| Sentuh | 1 jari = orbit, 2 jari = cubit-zoom + geser, ketuk ghost = pasang | Orbit θ 0,72→0,14 (OK), cubit r 14→3,33 (dibatasi `minR=3`) (OK), gulir *bottom sheet* 0→205 px (OK), peta pointer bersih setelah cubit (OK). **Ketuk ghost tidak bisa dilakukan di ponsel potret** karena semua titik ghost tertutup sheet. |
| Pad kamera (▲◀⟳▶▼, ＋/－) | `holdBtn` berulang tiap 80 ms selama ditekan | Hanya merespons `pointerdown`: Enter/Spasi dari keyboard **tidak berfungsi** |
| 👷 Pekerja | menampilkan atau menyembunyikan figur pekerja ber-APD | OK (memicu toast) |
| ⦿ Laser | titik + berkas merah yang mengikuti kursor | Atribut *title* menjanjikan "hilang 2 detik", padahal **laser tetap tampil** setelah 2,5 detik. Di layar sentuh, ketukan tidak memunculkan laser; laser hanya muncul saat diseret, dan kamera ikut berputar. |
| Keyboard | Tidak ada `keydown` di kanvas | Panah, W/A, +/− tidak berpengaruh. Tab 01–03 dan sakelar inspeksi berupa `<div>` (tabIndex −1) sehingga tidak bisa difokus. |
| Bongkar 1 tahap | `undoStep()` | OK |

### 1.6 Mode inspeksi dan skor/umpan balik
- "Mulai Inspeksi" memanggil `switchTab('insp')`. Keempat overlay hanya bersifat **ilustratif**: label **"Tegak ✓", "Datar ✓", "Siku 90° ✓"** ditulis tetap (*hard-coded*) dan tidak ada pengukuran atau cacat yang harus dicari. Inspeksi selalu "lulus".
- **Tidak ada skor**, jawaban salah, penilaian waktu, atau kuis. Umpan balik yang tersedia hanya bilah progres n/20, toast, *banner* selesai, dan butir cek berupa teks.
- Ada sisa fitur yang belum jadi: CSS `.challenge` dan `#challState` (baris 150–153) serta komentar "`standardPivots` — dipakai mode tantangan kelurusan" (baris 489). Mode tantangan kelurusan itu **tidak pernah diimplementasikan**.

---

## 2. Kesesuaian urutan dan pernyataan teknis dengan praktik baik

Rujukan yang dipakai: NASC TG20:21 dan SG4:22 (UK), BS EN 12811-1, OSHA 29 CFR 1926 Subpart L, UK Work at Height Regulations 2005 (WAHR), dan Permenaker 9/2016. Teks lengkap TG20, SG4, EN 12811-1, dan AS 1576.6 berbayar, sehingga butir yang bersandar padanya ditandai **(verifikasi teks standar)**. Semua koreksi konten sebaiknya **disahkan Komite Teknis PPAPI** sebelum ditampilkan sebagai "urutan yang benar" atas nama asosiasi.

### 2.1 Per tahap
| # | Penilaian | Catatan |
|---|---|---|
| 1 Sole board | Sesuai | OSHA 1926.451(c)(2): kaki perancah bertumpu pada *base plate* dan *mud sill* di atas fondasi yang kokoh. Ukuran perlu dikonsistenkan: teks menyebut "≥ 220 mm lebar", sedangkan model memakai pad 450×400 mm. |
| 2 Base plate | Sesuai | Teks "≥ 150 × 150 mm" lazim dipakai (verifikasi BS EN 74-3). |
| 3 Dirikan 6 standard | **Perlu revisi** (SEDANG) | Keenam standard 5,2 m berdiri bebas sebelum ada ledger. Dalam praktik, standard langsung dikunci ledger/transom pertama (*starter bay*). Model juga menampilkan standard setinggi penuh sejak tahap 3, sehingga sambungan sleeve di tahap 10 hanya tempelan visual. Disarankan standard awal ≤ satu panjang pipa, lalu diperpanjang di tahap 10. |
| 4 Ledger dasar ±30 cm | **Perlu revisi** (SEDANG) | OSHA 1926.452(b)(8): runner dan bearer terbawah dipasang "*as close to the base as possible*". Disarankan "sedekat mungkin ke base plate (umumnya ±150 mm)" (verifikasi TG20). |
| 5 Transom dasar | Sesuai | Sejalan dengan OSHA 1926.452(b)(5): coupler bearer bertumpu langsung pada coupler runner. Diagonal √(3,0² + 2,4²) = 3,84 m benar. |
| 6 Bracing | **Sebagian** (SEDANG) | Sudut bracing fasad 51° sesuai rentang 35–55°, tetapi **bracing ujung 57°** melewati rentang yang disebut aplikasi sendiri. OSHA 1926.452(b)(2) meminta bracing melintang berbentuk "X" di ujung, sedangkan aplikasi memakai satu diagonal. **Urutan:** brace setinggi +4,0 m dipasang sebelum ledger lift-1/lift-2 dan sebelum ada lantai kerja. Dalam praktik, bracing dipasang bertahap per lift. Coupler atas brace juga berimpit dengan simpul ledger +4,0 m. |
| 7–8 Ledger/transom lift-1 | Sesuai | Lift 2,0 m sesuai jarak runner maksimum 6 ft 6 in (≈1,98 m) di OSHA Subpart L App. A (*light duty*). |
| 9 Lantai sementara | **TINGGI** | (a) Papan 38 mm membentang **3,0 m** di antara transom tanpa putlog antara. BS 2482:2009 memberi papan 38 mm jarak tumpuan ≤ 1,2 m (atau 1,5 m untuk papan *machine-graded*), dan deskripsi plank di aplikasi sendiri menulis "bentang aman ±1,2 m". (b) Lantai di +2,1 m **tanpa pagar pengaman dan tanpa langkah APD/harness**, padahal SG4:22 dan Permenaker 9/2016 mensyaratkan perlindungan jatuh. Disarankan menambah putlog antara di lift-1 serta langkah *advance guardrail* atau harness. |
| 10 Sleeve | Sesuai | Sleeve ≤ 30 cm dari simpul dan selang-seling antar standard sesuai praktik umum (verifikasi TG20). Sleeve juga lebih diutamakan daripada joint pin, yang tidak menahan tarik. |
| 11 Ledger lift-2 | Sesuai | — |
| 12 Transom DI BAWAH ledger | **Perlu konfirmasi** (SEDANG) | Berbeda dari konvensi OSHA 1926.452(b)(5), di mana bearer duduk di atas runner. Papan memang ditumpu putlog di atas ledger sehingga struktur tetap masuk akal, tetapi alasannya perlu dijelaskan atau detail ini diseragamkan. Pada lift bawah, transom justru berada di atas ledger. |
| 13 Outrigger | **Urutan perlu revisi** (SEDANG) | Penopang dipasang setelah pekerja sudah bekerja di lift-2. Alat stabilisasi seharusnya terpasang sebelum perancah dinaiki. Rasio tinggi lantai terhadap lebar dasar 4,11/2,4 = 1,7:1 masih di bawah batas 4:1 OSHA 1926.451(c)(1), jadi tujuan penopang perlu dijelaskan. Istilah yang lebih tepat adalah "penopang/raker" (kemiringan 74°). |
| 14 Putlog ≥ 3/bay | Sesuai | Jarak 0,75 m ≤ 1,2 m. Putlog dipasang di ledger dengan klem putlog (*single*). |
| 15 Lantai utama | Sesuai, dengan catatan | Celah < 25 mm sesuai OSHA 1926.451(b)(1) (≤ 1 in). Tumpuan "≥ 50 mm" mengikuti praktik UK (NASC TG12: 50 mm s.d. 4× tebal), sedangkan OSHA 1926.451(b)(4) meminta ≥ 6 in (150 mm) kecuali papan dikunci. Sebutkan acuannya. Papan model menerus 6,1 m, padahal papan riil ≤ ±3,9 m dengan sambungan di atas tumpuan ganda. |
| 16 Bongkar lantai sementara | Sesuai | Sejalan dengan OSHA 1926.452(b)(1): lantai lama baru dibongkar setelah bearer baru terpasang. |
| 17 Mid rail ±470 mm | **TINGGI** | WAHR 2005 Sch. 2 (top rail ≥ 950 mm, celah ≤ 470 mm) dan Permenaker 9/2016 (pagar ≥ 95 cm, 0,9 kN, jarak vertikal 47 cm) membuat kombinasi "mid 470 + top 950" menghasilkan celah 480 mm > 470. Disarankan **top rail 1,0 m dan mid rail ±0,53 m**: semua celah ≤ 470 mm dengan toe board 150 mm, dan tetap sesuai syarat OSHA "kira-kira di tengah". |
| 18 Top rail | **TINGGI** | Teks menulis 950–1100 mm, tetapi **model 3D menempatkan top rail hanya ±0,92–0,94 m** di atas lantai (Y.top 5,05 − plat2 4,11). Nilai ini di bawah 950 mm (WAHR/Permenaker), 38 in = 965 mm (OSHA 1926.451(g)(4)(ii)), dan 1,0 m (EN 12811-1). **Urutan:** pekerja sudah bekerja di lantai teratas (tahap 14–16) sebelum ada pelindung tepi. SG4 meminta pelindung tepi dipasang lebih dahulu (*advance guardrail*). |
| 19 Puncheon + toe board 150 mm | Sesuai | Toe board ≥ 150 mm. OSHA hanya meminta ≥ 3,5 in, dan WAHR meminta toe board yang "memadai". |
| 20 Tangga + akses + tag hijau | **TINGGI** (2 butir) | Tangga 4:1 dan menonjol 1 m di atas landing sesuai OSHA 1926.1053(b)(1) (≥ 3 ft) dan (b)(5)(i). Namun: (a) **bukaan akses ±1 m dibiarkan tanpa pintu**. Komentar kode `dropBar()` menyebut "sesuai instruksi", padahal praktik baik memakai pintu tangga yang menutup sendiri (rujuk NASC SG25:20) atau pagar yang tetap memenuhi celah ≤ 470 mm. (b) **Tag HIJAU dipasang sebagai bagian dari perakitan, sebelum inspeksi.** Inspeksi oleh personel kompeten sebelum dipakai diwajibkan oleh OSHA 1926.451(f)(3) dan WAHR reg. 12, dan Permenaker 9/2016 mensyaratkan tenaga kompeten (Pasal 35). Tag MERAH seharusnya terpasang selama perakitan dan baru diganti hijau setelah Modul 03. Tag merah sendiri tidak pernah dipakai di perakitan. |

### 2.2 Hal penting yang belum ada di urutan
1. **Tie/angkur.** Anchor clamp hanya ada di katalog. Menara bebas dengan rasio 1,7:1 secara rasio tidak wajib di-tie (OSHA 1926.451(c)(1)), tetapi aplikasi harus menyatakannya secara eksplisit. Untuk perancah menempel bangunan, tie dipasang bertahap seiring kenaikan (OSHA 1926.452(b)(2)–(3); TG20).
2. **Persiapan:** pemeriksaan material, daya dukung tanah, zona eksklusi/barikade, APD (harness), dan pengawasan oleh personel kompeten (OSHA 1926.451(f)(7); kategori TKBT/TKPK di Permenaker 9/2016 Pasal 35).
3. **Serah terima:** register/kartu inspeksi, papan kelas beban (*duty*), dan inspeksi berkala.
4. **Rujukan nasional:** intro dan inspeksi hanya menyebut AS 4576, BS 2482, EN 74, dan BS 1139/EN 39. Disarankan menambah Permenaker 9/2016, Permenakertrans PER.01/MEN/1980, dan **SNI 8987:2021** (pipa baja untuk perancah; lihat `devtools/research/regulasi.json`).

### 2.3 Pernyataan teknis yang perlu dikoreksi
| Lokasi | Pernyataan | Masalah |
|---|---|---|
| Baris 477, tahap 3, catatan inspeksi (baris 1349), label "Light duty — AS 4576" | "AS 4576 light duty: bay 3,0 m · lebar 2,4 m · lift 2,0 m" | AS 4576:2020 adalah pedoman umum. Tabel geometri tube & coupler ada di AS 1576.6:2020. Sebagai pembanding, OSHA App. A *light duty* tube & coupler memakai jarak tiang **4 ft × 10 ft (≈1,2 × 3,05 m)** dengan runner ≤ 6 ft 6 in. **Lebar 2,4 m dua kali lipat batas 4 ft.** Disarankan label diganti menjadi "konfigurasi ilustratif — perlu perhitungan", ditautkan ke Aplikasi Analisis Struktur, atau lebar diubah ke ±1,2–1,3 m. **TINGGI** karena layar inspeksi menyatakan "✓" atas angka ini. |
| COUPLER.distancemeter | "Verifikasi dimensi sesuai standar (AS 4576)" | Atribusi yang sama |
| Komentar baris 474 | "menara 1 bay" | Model sebenarnya 2 bay |
| Tahap 6 | "Sudut bracing ideal 35–55°" | Benar (BS 5973/TG20 ≈45°; OSHA "approximately 45°"), tetapi bracing ujung di model 57° |
| COUPLER.tube | "Ø48,3 mm, 3,2–4,0 mm" | Benar (EN 39 tipe 3/4). Tambahkan rujukan SNI 8987:2021. |
| COUPLER.plank | "225 × 38 mm, tumpuan ≥ 50 mm, bentang ±1,2 m" | Benar (BS 2482:2009; NASC TG12), tetapi bertentangan dengan lantai lift-1 di model yang membentang 3,0 m |
| COUPLER.swivel / putlog / sleeve / jointpin / ladder | Peran beban, 4:1, menonjol 1 m | Benar secara umum |
| Branding | "[atribusi lama, dihapus]", "Dibuat oleh [atribusi lama, dihapus] untuk [atribusi lama, dihapus]" (baris 249, 309) | Bukan PPAPI dan harus diganti |

---

## 3. Arsitektur kode

### 3.1 Struktur
- **Satu dokumen.** CSS ada di baris 10–235. HTML statis mencakup `#app`, `#top` (merek + `#tabs`), `#panel` (`#pBody`), `#legend`, `#cam`, `#toast`, dan `#intro`. Satu `<script>` klasik ada di baris 314–1439, dan **semua identifier-nya global**: `renderer, scene, camera, key, M, V, R, Y, state, MODE, cam, el, toast, frame, tube…`. Skrip PPAPI (`config/core/auth/store.js`) dibungkus IIFE, jadi tidak ada tabrakan JS jika keduanya dimuat bersama. Namun skrip simulator **tidak boleh disuntik ke halaman yang punya global `const` bernama sama**.
- **Scene** (baris 322–368): `WebGLRenderer({antialias:true})`, `pixelRatio ≤ 2`, `outputEncoding = sRGBEncoding`, `PCFSoftShadowMap`, peta bayangan 2048², `Fog`, `HemisphereLight` + 3 `DirectionalLight`, lantai `CircleGeometry` + `GridHelper`, dan *pedestal* untuk Modul 01.
- **Data:**
  - `COUPLER`: katalog 19 entri.
  - `STEPS[20]` berisi `{title, coupler, desc(HTML), checks[], build(), hint()?, isTemp?, removesTemp?, action?}`.
  - Konstanta geometri: `BAY, WID, STD_TOP, COLS, ROWS, NODES, Y, ACCESS`.
  - `stepGroups[]`: satu `THREE.Group` per tahap, semuanya dibangun saat dimuat lalu disembunyikan.
  - `standardPivots[]` (tidak dipakai), `inspState` / `inspGroups`, `cam` (orbit sferis dengan peredaman 0,12/frame), dan `labels[]` (DOM yang diproyeksikan setiap frame).
- **Mesin status** (baris 1220–1257):
  - `state.current` adalah indeks tahap yang sedang tampil sebagai ghost.
  - `confirmStep()` memadatkan tahap → `current++` → `showPreview()`.
  - `undoStep()` membalik langkah.
  - `solidifyUpTo()` dipanggil saat pindah tab.
  - `applyTempRemoval()` menyembunyikan lantai sementara bila `current ≥ dismantleIdx`.
  - Kondisi selesai adalah `current === STEPS.length`.
  - `MODE ∈ {lib, build, insp}` diatur oleh `switchTab()` (baris 1355–1396).
  - Status tidak pernah disimpan.
- **Rendering:** `loop()` (baris 1418–1424) memanggil `requestAnimationFrame` terus-menerus, kemudian `dampCam()`, `updateLabels()`, dan `render`, meskipun tidak ada yang berubah.

### 3.2 Penggunaan three.js r128
- Tidak ada API yang sudah dihapus di r128 (tidak memakai `THREE.Geometry`; semua geometri BufferGeometry).
- Ketergantungan yang akan rusak jika versi dinaikkan:
  - `renderer.outputEncoding` / `THREE.sRGBEncoding`: deprecated di r152 dan dihapus kemudian (pengganti: `outputColorSpace = SRGBColorSpace`).
  - Intensitas cahaya ditala untuk mode *legacy lights*: sejak r155 `useLegacyLights` default `false`, sehingga intensitas hemisphere/directional perlu dikali π.
  - Color management (r152+) akan menggeser semua warna heksa.
  - **Build UMD `three.min.js` tidak ada lagi.** cdnjs untuk 0.186.1 (versi terbaru, 2026) hanya menyediakan `three.module(.min).js`, `three.core`, `three.webgpu`, dan `three.tsl`. Upgrade berarti pindah ke ES module (*import map*).
- SRI r128 (cdnjs, terverifikasi): `sha512-dLxUelApnYxpLt6K2iomGngnHO83iUvZytA3YjDUCjT0HDOHKXnVYdf3hU4JjM8uEhxf9nD1/ey98U3t2vZ0qQ==`

### 3.3 Performa (terukur, SwiftShader; FPS hanya relatif)
| Metrik | Nilai |
|---|---|
| Mesh di scene (struktur lengkap) | 582 (542 terlihat) |
| Material unik / geometri unik | **548 / 582**: hampir setiap mesh punya material dan geometri sendiri (`M.darkSteel.clone()`, `new MeshStandardMaterial` per pita coupler, `new CylinderGeometry` per pipa) |
| Draw calls per frame (lengkap / inspeksi) | **543 / 597**, termasuk *shadow pass* |
| Segitiga | 65.356 (65.824 di inspeksi) |
| FPS SwiftShader 1366×768 / 390×844 DPR 2 | 8,6 / 7,1. Ini batas CPU; GPU nyata akan jauh lebih cepat, tetapi biaya CPU untuk 500+ draw call tetap berat di ponsel kelas menengah. |
| Render | terus-menerus tanpa *render-on-demand*, dengan bayangan 2048² PCFSoft dihitung ulang setiap frame |

Peluang perbaikan:
- Pakai bersama geometri (satu silinder satuan yang di-`scale`) dan material per jenis coupler.
- `InstancedMesh` untuk pipa, coupler, dan papan (target < 80 draw call).
- `shadowMap.autoUpdate = false` + `needsUpdate` hanya saat tahap berubah.
- Render hanya saat kamera bergerak atau status berubah.
- DPR ≤ 1,5 dan bayangan 1024² di ponsel; jeda saat `document.hidden`.

### 3.4 Memori dan pembersihan
Tidak ada satu pun `dispose()`. Kebocoran yang terukur (`renderer.info.memory.geometries`):

| Aksi | Sebelum → sesudah | Laju |
|---|---|---|
| 36 klik item katalog Modul 01 | 39 → 565 | ±14,6 geometri/klik (`showLibModel` hanya memanggil `remove`) |
| 40 kali sakelar inspeksi | 1.437 → 2.517 | ±27/sakelar (`rebuildInspection` hanya memanggil `scene.remove`) |
| 10× mundur/pasang di tahap 5 | 668 → 798 | ±13/siklus (`showHint` membuat waterpass/siku/diagonal baru, `clearHint` tidak membuangnya) |

Material juga bocor dengan pola yang sama. Pada sesi panjang di ponsel, kebocoran ini berisiko menghabiskan memori GPU dan memicu *context loss*.

### 3.5 localStorage
Tidak dipakai sama sekali (diverifikasi dengan grep dan `Object.keys(localStorage) = []` saat aplikasi berjalan). Progres hilang saat halaman dimuat ulang.

### 3.6 Aksesibilitas
- Tab dan sakelar inspeksi berupa `<div>` tanpa `role`/`tabindex`, sehingga tidak bisa dicapai dengan keyboard.
- Tombol pad kamera hanya punya `title`. Isinya glif "▲ ＋ 👷" tanpa `aria-label`, dan tombol tidak dapat diaktifkan dengan keyboard.
- Tidak ada kontrol kamera lewat keyboard dan tidak ada dukungan `prefers-reduced-motion` (model katalog berputar terus).
- `meta viewport` memakai `maximum-scale=1, user-scalable=no` sehingga pengguna tidak bisa memperbesar halaman (WCAG 1.4.4).
- Kontras:
  - `--ink-faint #7C8E99` di atas putih ≈ 3,4:1.
  - Eyebrow amber `#F5A623` di atas putih ≈ 2,0:1.
  - **Toast: teks `#16232C` di atas `rgba(12,26,35,.93)` ≈ 1,1:1**, praktis tidak terbaca.
- Toast tidak punya `role="status"` / `aria-live`.
- `lang="id"` sudah benar. Struktur heading lemah: h1 di merek, h2 di intro, h3 di kartu tahap.

---

## 4. Bug dan risiko (terverifikasi)

| # | Tingkat | Bug | Bukti / lokasi |
|---|---|---|---|
| B1 | **TINGGI** | **Label sakelar inspeksi rusak** akibat tabrakan nama kelas: `.toggle .lbl` (baris 142–144, markup baris 1345) mewarisi `.lbl` milik label 3D (`position:absolute; transform:translate(-50%,-50%)`, latar gelap, mono; baris 183). Teks bergeser keluar panel ("Vertikal", "orizontal"). | `legacy-sim-d-07-insp-all.png`, `legacy-sim-m-06-insp.png` |
| B2 | **TINGGI** | **Toast tidak terbaca** (kontras ±1,1:1) | `legacy-sim-d-08-toast.png`; CSS baris 210–215 |
| B3 | **TINGGI (ponsel)** | **Pad kamera, zoom, pekerja, dan laser tertutup panel** pada lebar ≤ 760 px. Keenam kontrol yang diuji tertutup karena `#panel` z-index 25 berada di atas `#cam` z-index 20, dengan `bottom:14px`. Pada desktop setinggi 768 px pun bagian bawah panel menimpa pad. | `elementFromPoint`; `legacy-sim-m-02-lib.png`, `legacy-sim-d-02-lib.png` |
| B4 | **TINGGI (ponsel)** | **Pembingkaian potret:** FOV vertikal 45° tetap sehingga FOV horizontal hanya 21,7°. Kotak batas perancah membentang x −127…545 px pada layar 390 px dan setengahnya di bawah sheet (top 431 px). Di tahap 1 layar tidak menampilkan apa pun, dan ghost tidak bisa diketuk. | `legacy-sim-m-03-build-step01.png`, `legacy-sim-m-08-portrait-insp.png` |
| B5 | SEDANG | Ponsel lanskap (844×390) memakai tata letak desktop: panel 240 px menutup separuh layar, petunjuk mouse tampil di perangkat sentuh, dan label saling tumpuk. | `legacy-sim-m-07-landscape.png` |
| B6 | SEDANG | Tidak ada cadangan tanpa WebGL: galat "Error creating WebGL context." tidak ditangani, tombol "Mulai Simulasi" mati, dan tidak ada pesan. CDN diblokir menghasilkan "THREE is not defined" dengan gejala yang sama. | `legacy-sim-x-01-nowebgl.png`, `legacy-sim-x-02-nocdn.png` |
| B7 | RENDAH | *Context loss*: r128 sudah memanggil `preventDefault` dan memulihkan konteks (teruji lewat `WEBGL_lose_context`). Namun selama konteks hilang kanvas kosong tanpa pesan, sementara label DOM tetap melayang. | `legacy-sim-d-11-ctx-lost.png`, `legacy-sim-d-12-ctx-restored.png` |
| B8 | SEDANG | Kebocoran memori (§3.4) dan render terus-menerus (§3.3) | `renderer.info` |
| B9 | SEDANG | Aksesibilitas keyboard (§3.6) | Uji Tab dan Enter |
| B10 | RENDAH | Laser: tidak hilang setelah 2 detik meski dijanjikan, dan tidak bisa dipakai dengan ketukan | Baris 1080–1113 |
| B11 | RENDAH | Posisi gulir `#pBody` tidak direset saat panel dirender ulang, sehingga baris progres terpotong | `legacy-sim-m-04-build-step10.png` |
| B12 | SEDANG (desain) | Inspeksi selalu "✓", tab 03 terbuka tanpa menyelesaikan perakitan, dan tidak ada skor | §1.6 |
| B13 | RENDAH | Resize berfungsi (900×600 → kanvas 900×600, aspek 1,5), tetapi memakai `innerWidth/innerHeight` alih-alih ukuran kontainer, sehingga akan salah bila diberi bilah portal | Baris 324, 334, 1412–1416 |
| B14 | RENDAH | Sisa kode: `.challenge`, `#challState`, `standardPivots`, `dropBar()`, `rdrag`, `platformStepIdx` | — |
| — | OK | Konsol bersih (0 galat, 0 permintaan gagal) pada alur normal, baik desktop maupun ponsel | `legacy-simulator.mjs` |

---

## 5. Rencana integrasi ke situs PPAPI baru

### 5.1 Prinsip
1. **Satu sumber kode** di `site/aplikasi/simulator/`. Salinan base64 di aplikasi lama tidak dipakai lagi.
2. **Fitur hanya muncul bila `member.status === 'Aktif'`.** Kode 3D dan three.js **tidak dimuat sama sekali** sebelum gerbang lolos.
3. Gerbang di situs statis (GitHub Pages) hanya bersifat **UX**: siapa pun yang tahu URL `simulator.js` tetap bisa mengunduhnya. Perlindungan sungguhan memerlukan Fase 3 (§5.8).

### 5.2 Lokasi berkas dan masalah jalur
| Berkas baru | Isi |
|---|---|
| `site/aplikasi/simulator/index.html` | Kerangka halaman: `<meta name="robots" content="noindex,nofollow">`, font PPAPI, `../../assets/css/main.css`, `simulator.css`, bilah portal, area status gerbang, kontainer `#sim-app` beserta markup simulator (diprefiks), dan skrip `../../assets/js/config.js`, `core.js`, `auth.js`, `store.js`, `../gate.js` (semuanya `defer`) |
| `site/aplikasi/simulator/simulator.css` | CSS baris 10–235, **diprefiks `sim-`** karena berbenturan dengan `main.css` (`.btn`, `.chip`, `.check`, `.tab`, `.row`, `.meta`, `.toggle`) dan diselaraskan dengan token PPAPI (§5.6) |
| `site/aplikasi/simulator/simulator.js` | Skrip baris 315–1438 dibungkus `window.PPAPISim = { boot(opts), destroy() }`. Tidak ada eksekusi otomatis dan tidak ada global lain. |
| `site/aplikasi/simulator/vendor/three-r128.min.js` | Salinan lokal 603.445 bita (+ SRI di atas), dengan cdnjs sebagai cadangan |
| `site/aplikasi/gate.js` | Gerbang bersama untuk Simulator dan Analisis Struktur |

**Jebakan yang sudah dicek di kode situs:** `core.js` `loginUrl()` (baris 1723–1725) memakai `util.fileName()`. Di `/aplikasi/simulator/index.html` hasilnya `masuk.html?next=index.html` yang relatif ke folder tersebut, sehingga mengarah ke 404 atau ke beranda. Ada dua pilihan:
- **(a) Disarankan, tanpa mengubah berkas bersama:** halaman memakai `data-auth="public"` (tidak ada `#site-header`/`#site-footer`, jadi core tidak menyuntikkan apa pun), lalu `gate.js` mengalihkan sendiri ke `../../masuk.html?next=aplikasi%2Fsimulator%2Findex.html`. `util.safeNext` menerima `aplikasi/simulator/index.html` karena polanya `^[A-Za-z0-9][A-Za-z0-9_\-./]*\.html`, tanpa `..`, dan tidak diawali `masuk`.
- **(b)** Ubah `loginUrl()` agar membaca `body[data-next]`. Ini perubahan fondasi, jadi `flows/contract.mjs` dan `auth-demo.mjs` harus dijalankan ulang.

### 5.3 Pemuat bergerbang (`gate.js`, sketsa)
```js
PPAPI.onReady(async () => {
  const u = PPAPI.auth.current();
  const self = 'aplikasi/simulator/index.html';
  if (!u) return location.replace('../../masuk.html?next=' + encodeURIComponent(self + location.search + location.hash));
  showState('memeriksa');                       // "Memverifikasi keanggotaan…" (aria-live)
  const m = await PPAPI.store.getMember(u.uid);
  if (!m || m.status !== 'Aktif') return showLocked(m && m.status);
  //   Menunggu Verifikasi → "Aplikasi tersedia setelah keanggotaan diverifikasi sekretariat."
  //   Nonaktif            → "Keanggotaan nonaktif — hubungi sekretariat."   + tombol Kembali ke Portal
  await loadScript('vendor/three-r128.min.js', SRI).catch(() => loadScript(CDN_R128, SRI));
  await loadScript('simulator.js');
  const saved = await PPAPI.store.getProgress?.(u.uid, 'simulator-tc');
  PPAPISim.boot({ container: document.getElementById('sim-app'), user: u, member: m,
                  progress: saved, onProgress: debounce(p => PPAPI.store.saveProgress(u.uid, 'simulator-tc', p), 800) });
  PPAPI.auth.onChange(x => { if (!x) location.replace('../../index.html'); });
});
```
- Jika WebGL tidak tersedia (cek `canvas.getContext('webgl2'||'webgl')` sebelum `boot`), tampilkan pesan dan saran perangkat/peramban (memperbaiki B6).
- Peluncur juga harus mengikuti status keanggotaan:
  - `anggota.js` `renderAplikasi()` (baris 1410–1443) dan `safeHttps()` (baris 337) **saat ini membuang URL relatif**.
  - `dashboard.js` `isHttp()` (baris 26), `simulatorUrl()` (baris 43–47), daftar aplikasi (baris 192–211), dan `#dash-sim-link` (baris 408–411) juga hanya menerima http(s).
  - Ubah `config.apps[]` menjadi `{key:'simulator', url:'aplikasi/simulator/index.html', internal:true, syaratStatus:'Aktif'}`. Peluncur menerima tautan internal lewat `util.safeNext(url,'')`, membukanya di tab yang sama, dan menampilkan **kartu terkunci** bila status ≠ Aktif.
- `robots.txt`: tambah `Disallow: /*aplikasi/`.

### 5.4 Bilah "Kembali ke Portal Anggota"
- Bilah tetap di atas, tinggi 48 px (44 px di ponsel), latar `--c-black`, teks `--c-bone`.
- Isi bilah:
  - Kiri: `← Kembali ke Portal Anggota` → `../../anggota.html#aplikasi`. Tab "aplikasi" dan `next` dengan hash sudah didukung.
  - Tengah: "Simulator Pemasangan Perancah", di ponsel diringkas.
  - Kanan: nama, KTA, *badge* "Aktif", dan tombol bantuan.
- `#sim-app` dimulai di bawah bilah. **Wajib** mengganti ukuran berbasis jendela dengan ukuran kontainer: baris 324 `renderer.setSize(innerWidth, innerHeight)`, baris 334 aspek kamera, dan baris 1412–1416 `onResize` diganti `ResizeObserver(container)`. `tryPick`, `updateLaser`, dan `updateLabels` sudah memakai `getBoundingClientRect` / `container.client*`.

### 5.5 Penyimpanan progres ke catatan anggota (opsional, disarankan)
- **Jangan menambah kolom ke dokumen `members/{uid}`.** `validMember()` di `firestore.rules` memakai `keys().hasOnly([...])`, dan `store.saveMember` punya whitelist. Lebih aman memakai subkoleksi `members/{uid}/progress/{appKey}` dengan aturan sendiri (pemilik boleh baca/tulis, bentuk data divalidasi, ukuran dibatasi). Di Mode Demo, gunakan kunci baru `ppapi_progress_<uid>` (daftarkan di FOUNDATION_NOTES §1 "Reserved storage keys").
- API baru di `store.js` (perubahan fondasi + uji kontrak): `getProgress(uid, appKey)` dan `saveProgress(uid, appKey, data)`, dengan whitelist yang sama ketatnya.
- Bentuk data: `{appKey:'simulator-tc', versiKonten:'2026.10', tahapSelesai:['sole-board',…], tahapTerakhir:'tangga-akses', total:20, selesaiPada:ISO|null, jumlahSesi, waktuTerbaikDetik, alatInspeksi:['vert','horz','dist','square'], katalogDilihat:[…], kuis:{skor,maks,pada}|null, updatedAt}`.
  - Beri **`id` tetap per tahap** di `STEPS`, jangan memakai indeks, supaya revisi konten tidak merusak progres.
- Titik kait di `simulator.js`:
  - `confirmStep()` dan `undoStep()` (baris 1241–1257) → `onProgress`.
  - `switchTab('insp')` dan `toggleInsp()` (baris 1210, 1384) → `alatInspeksi`.
  - Kondisi selesai (baris 1246) → `selesaiPada`.
  - Lanjutkan sesi: set `state.current` lalu panggil `solidifyUpTo()` + `renderBuildPanel()` (fungsi sudah ada).
- Dasbor dan anggota dapat menampilkan "Simulator: 20/20 · selesai 9 Okt 2026".
- **Catatan:** skor yang ditulis anggota ke dokumennya sendiri bersifat **dilaporkan sendiri**. Cukup untuk catatan belajar, tetapi tidak untuk sertifikasi. Untuk sertifikasi diperlukan validasi di server (Cloud Function).

### 5.6 Penyelarasan visual (SPEC §1: monokrom)
- **Kerangka UI** (bilah, panel, tab, tombol, intro, toast) memakai token PPAPI:
  - Warna: `--c-paper/--c-white/--c-ink/--c-graphite`, garis `--line`, radius 2–4 px.
  - Font: Cormorant Garamond untuk judul, Barlow Condensed huruf kapital untuk label/angka (dengan `lining-nums`), Inter untuk isi.
  - Komponen: tombol `btn--primary/--ghost`, tab gaya `.tabs`, toast diganti **`PPAPI.ui.toast`** (memperbaiki B2 dan aria-live).
  - Ganti "[atribusi lama, dihapus]"/"[atribusi lama, dihapus]" dengan PPAPI. Hapus aksen amber dari kerangka.
- **Di dalam kanvas 3D** warna fungsional dipertahankan sebagai pengecualian yang dibenarkan (setara dengan logo "G" Google di SPEC):
  - Pita coupler (kode identifikasi, disertai legenda teks).
  - **Tag merah/hijau** (semantik di lapangan).
  - Ghost perlu sorotan berkontras tinggi; uji alternatif putih/`--c-warn` beremisi.
  - Latar scene `0xEEF2F5` → `--c-paper` `#f6f6f4`.
- Tata letak ponsel:
  - Pad kamera dipindah di atas sheet (atau sheet dibuat bisa diciutkan dengan tombol "Tampilkan 3D"), memperbaiki B3.
  - Kamera adaptif aspek: radius × max(1, 1,6 / aspek) dan target bergeser naik setinggi sheet (B4).
  - Tambahkan *breakpoint* `(max-height:500px)` untuk lanskap (B5).

### 5.7 Naikkan three.js? Rekomendasi: **tidak, untuk fase integrasi**
| | Tetap r128 (salinan lokal + SRI) | Upgrade ke 0.18x |
|---|---|---|
| Upaya | Kecil | Besar: ES module/import map, `outputColorSpace`, intensitas cahaya ×π, warna heksa bergeser, tala ulang semua material, uji ulang alur |
| Risiko | Rendah | Sedang–tinggi (regresi visual) |
| Manfaat | Stabil, luring, tahan gangguan CDN | Kecil untuk aplikasi ini. `InstancedMesh` (kebutuhan performa utama) **sudah ada di r128**. |

Upgrade ditunda ke fase lanjut bila nanti dibutuhkan fitur baru (WebGPU, BatchedMesh).

### 5.8 Fase dan fungsi/baris yang disentuh
**Fase 1: integrasi dan perbaikan bug (±2–3 hari kerja)**
- `simulator.html` dipecah menjadi `index.html`, `simulator.css`, dan `simulator.js`. Global dibungkus `PPAPISim.boot()`. Baris 1429–1438 (init dan `startBtn`) dipindah ke dalam `boot`.
- Baris 5: hapus `maximum-scale/user-scalable=no`; `touch-action:none` cukup di kanvas.
- Baris 142–144 dan 1345: ganti nama `.lbl` sakelar (B1). Baris 210–215 dan 1403–1407: pakai `PPAPI.ui.toast` (B2). Baris 218–234: tata letak ponsel/lanskap (B3, B5).
- Baris 253–255: `<button role="tab">`. Baris 1343: sakelar menjadi `<button aria-pressed>`. Baris 279–290: `aria-label`. Baris 1061–1068 `holdBtn`: tambah `click` dan `keydown` (B9).
- Baris 313: three.js lokal + SRI + cadangan. Baris 322: `try/catch` + pesan tanpa WebGL (B6). Tambah *listener* `webglcontextlost`/`restored` untuk pesan "Memulihkan tampilan 3D…" (B7).
- Baris 324, 334, 1412–1416: ukuran kontainer (B13). Baris 1355–1396 `switchTab`/`frame()`: kamera adaptif aspek (B4).
- Baris 926–930, 1202–1209, 1224–1225: `dispose()` rekursif atau *cache* hint (B8). Baris 1328: `pBody.scrollTop = 0` (B11).
- Baris 1080–1113: laser hilang otomatis setelah 2 detik dan bisa dipicu ketukan (B10).
- Branding (baris 6, 248–249, 299–309).

**Fase 2: progres, konten, performa (±3–4 hari, sebagian menunggu Komite Teknis)**
- `store.js` + `firestore.rules` (progres), peluncur di `anggota.js`/`dashboard.js`, dan `config.js`.
- `STEPS` (baris 597–705): `id` per tahap dan revisi konten sesuai §2. Contoh: tag merah di awal dan hijau setelah inspeksi, top rail 1,0 m / mid rail 0,53 m, putlog antara + pagar di lantai sementara, penopang lebih awal, bracing per lift, ledger dasar ≈150 mm, pintu tangga, label "AS 4576" diganti.
- Baris 1349 dan 1182: catatan dan label standar.
- Baris 448–471 `tube()`/`coupler()`: geometri dan material dipakai bersama, `InstancedMesh`. Baris 1418–1424 `loop()`: render-on-demand + jeda saat tersembunyi. Baris 341: bayangan 1024² di ponsel dan `autoUpdate=false`.

**Fase 3: penilaian dan gerbang keras (opsional, ±3–5 hari)**
- **Mode Uji:** pada setiap tahap, pilih komponen atau urutan berikutnya dari 3–4 opsi (pengecoh diambil dari `COUPLER`/`STEPS`). Skor = benar pada percobaan pertama ÷ 20, ditambah waktu.
- **Tantangan inspeksi:** memanfaatkan `standardPivots` dan CSS `.challenge` yang sudah ada. Miringkan 1–2 standard secara acak atau pasang cacat (klem hilang, papan bercelah, toe board hilang); anggota menandai cacat dengan klik; hasil disimpan ke `kuis`.
- **Gerbang keras:** Firebase Hosting/Storage dengan aturan yang membaca `members/{uid}.status == 'Aktif'` (aturan lintas layanan Storage→Firestore) atau Cloud Function. `simulator.js` diambil dengan token, bukan dari jalur publik GitHub Pages.

### 5.9 Rencana pengujian
1. **Gerbang** (flow Playwright baru): tanpa sesi → dialihkan ke `masuk.html?next=aplikasi%2Fsimulator%2Findex.html` → login demo → kembali ke simulator. Status `Menunggu Verifikasi` dan `Nonaktif` → kartu terkunci, dengan **0 permintaan** ke `three-r128.min.js`/`simulator.js` (diperiksa lewat log jaringan). Status `Aktif` → aplikasi tampil. Peluncur di `anggota.html#aplikasi` dan `dashboard.html` menampilkan kunci atau tautan sesuai status.
2. **Regresi bug B1–B13** dengan pengukuran:
   - Kontras toast ≥ 4,5:1.
   - Kotak label sakelar berada di dalam panel.
   - `elementFromPoint` pada semua kontrol kamera mengenai kontrolnya sendiri di 390×844, 844×390, dan 1366×768.
   - Tab, sakelar, dan pad bisa dioperasikan dengan Tab/Enter/Spasi.
   - `renderer.info.memory.geometries` stabil (±0) setelah 36 klik katalog, 40 sakelar, dan 10 siklus mundur/pasang.
   - Pesan muncul saat WebGL tidak ada dan saat CDN diblokir (berkas lokal).
   - Kotak batas struktur ≥ 90% berada di area kanvas yang terlihat di ponsel potret.
3. **Alur penuh:** 20 tahap → selesai → inspeksi → progres tersimpan → muat ulang → lanjut di tahap yang benar. Di Firebase, aturan subkoleksi diuji lewat *emulator*: pemilik boleh, akun lain ditolak, bentuk data tidak valid ditolak.
4. **Fondasi:** jalankan ulang `flows/contract.mjs`, `auth-demo.mjs`, `foundation-ui.mjs`, `foundation-fixes.mjs`, `anggota-flow.mjs`, `dashboard-flow.mjs`, dan `check.mjs` (termasuk halaman baru, `--auth`) bila `store.js`, `core.js`, `config.js`, `anggota.js`, atau `dashboard.js` disentuh.
5. **Performa:** draw call ≤ 80 dan segitiga stabil (diukur otomatis); FPS di 1–2 ponsel Android kelas menengah nyata (manual) dengan target ≥ 30 fps.
6. **Konten:** tinjauan dan pengesahan urutan oleh Komite Teknis PPAPI, memakai tabel §2 sebagai daftar periksa.

---

## Lampiran A — Tangkapan layar (`devtools/shots/`)
- Desktop:
  - `legacy-sim-d-01-intro.png`, `-d-02-lib.png`, `-d-03-lib-{swivel,ladder,anchorclamp}.png`
  - `-d-step-{01,03,06,09,10,13,14,16,19,20}.png`, `-d-steps-contact.png` (20 tahap + selesai)
  - `-d-05-done.png`, `-d-06-insp.png`, `-d-07-insp-all.png`, `-d-08-toast.png`, `-d-09-laser.png`
  - `-d-10-resized-900.png`, `-d-11-ctx-lost.png`, `-d-12-ctx-restored.png`
- Ponsel: `legacy-sim-m-01-intro.png`, `-m-02-lib.png`, `-m-03-build-step01.png`, `-m-04-build-step10.png`, `-m-05-done.png`, `-m-06-insp.png`, `-m-07-landscape.png`, `-m-08-portrait-insp.png`
- Kegagalan: `legacy-sim-x-01-nowebgl.png`, `-x-02-nocdn.png`

## Lampiran B — Sumber
- OSHA 29 CFR 1926.451 (persyaratan umum perancah): https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.451
- OSHA 29 CFR 1926.452 (tube & coupler, butir (b)(1)–(8)): https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.452
- OSHA 1926 Subpart L Appendix A (pedoman tidak wajib, tabel tube & coupler): https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926SubpartLAppA
- OSHA 1926 Subpart L: https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926SubpartL
- UK Work at Height Regulations 2005, Schedule 2: https://www.legislation.gov.uk/uksi/2005/735/schedule/2/made
- Permenaker 9/2016 (BPK): https://peraturan.bpk.go.id/Details/146109/permenaker-no-9-tahun-2016; JDIH Kemnaker: https://jdih.kemnaker.go.id/peraturan/detail/1210/peraturan-menteri-ketenagakerjaan-nomor-9-tahun-2016
- Kajian pagar pencegah jatuh kolektif menurut Permenaker 9/2016 (95 cm; 0,9 kN; 47 cm): https://jurnal.polteknaker.ac.id/index.php/ict2024/article/view/117
- NASC SG4:22 (peluncuran): https://scaffmag.com/scaffolding-news/nasc-launches-long-awaited-sg422/; NASC SG25:20 (akses lewat tangga): https://nasc.org.uk/product/sg25-20.html; SG4 (NASC, PDF): https://nasc.org.uk/wp-content/uploads/2024/09/SG4-Preventing-Falls-in-Scaffolding-Operations-Rev-000-29-08-24.pdf
- NASC TG12:17 (pengikatan papan; tumpuan 50 mm s.d. 4× tebal): https://nasc.org.uk/wp-content/uploads/2015/11/TG12_17-Tying-down-of-scaffold-boards.pdf
- BS 2482:2009 (papan perancah kayu): https://shop-checkout.bsigroup.com/products/specification-for-timber-scaffold-boards; ringkasan perubahan bentang 1,2 m: https://www.buildersmerchantsnews.co.uk/news/trade-bodies/john-brash-supports-updated-standards
- BS EN 12811-1: https://knowledge.bsigroup.com/products/temporary-works-equipment-scaffolds-performance-requirements-and-general-design; ringkasan pelindung tepi UK (sekunder): https://squote.app/knowledge/scaffolding/scaffold-edge-protection
- AS 1576.6:2020 (tabel geometri tube & coupler): https://store.standards.org.au/product/as-1576-6-2020
- three.js r128 di cdnjs (API SRI): https://api.cdnjs.com/libraries/three.js/r128?fields=sri
- Riset regulasi proyek ini (diverifikasi 2026-10-08): `devtools/research/regulasi.json`
