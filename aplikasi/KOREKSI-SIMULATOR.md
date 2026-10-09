# Koreksi Geometri & Urutan — Simulator Pemasangan Perancah Tube & Coupler

- **Aplikasi:** `aplikasi/simulator/` (`simulator.js`, `index.html`, `simulator.css`)
- **Dasar pekerjaan:** persetujuan klien *"Perbaiki geometri & urutan"*; temuan `devtools/legacy/ANALISIS_SIMULATOR.md` §2 dan `aplikasi/CATATAN.md` §6.
- **Tanggal:** 9 Oktober 2026
- **Status:** sudah diterapkan dan diuji otomatis; **menunggu tinjauan dan pengesahan Komite Teknis PPAPI** (lihat §7).

Dokumen ini disusun untuk tinjauan teknis. Setiap koreksi dicatat dalam pola **sebelum → sesudah → alasan → sumber**. Model tetap bersifat **ilustratif untuk pelatihan**, bukan desain perancah. Angka yang merupakan **kriteria aplikasi** (bukan nilai dari standar) ditandai secara eksplisit.

---

## 1. Ringkasan

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Dimensi menara | 2 bay × 3,0 m, lebar 2,4 m, lift 2,0 m, berlabel "AS 4576 light duty" | 2 bay × 2,0 m, lebar 1,2 m, lift 1,95 m; label "konfigurasi ilustratif" dengan acuan tabel pedoman OSHA App. A |
| Top rail di atas lantai | ±0,92–0,94 m (di bawah 950 mm) | **1,000 m** (permukaan atas) pada kedua lantai |
| Celah pelindung tepi | 480 mm (> 470 mm) | 356 mm dan 398 mm (celah bersih) |
| Toe board | 150 mm, dipasang setelah lantai dipakai | 150 mm, dipasang bersama lantai, pada kedua lantai |
| Bentang papan 38 mm | 3,0 m pada lantai sementara | maks. **0,98 m**; ujung menonjol 70 mm, dikunci klem papan |
| Lantai lift-1 | sementara, tanpa pagar, dibongkar kemudian | lantai lift-1 **lengkap dengan pelindung tepi**, pagar dipasang lebih dulu |
| Bracing | satu batang 2-lift dipasang sebelum lift-1 ada; ujung satu diagonal 57° | **per lift**, kedua sisi, setiap bay, dua arah (42,0° dan 44,3°); silang X di kedua ujung |
| Stabilitas | outrigger setelah pekerja bekerja di lift-2 | outrigger **sebelum** tinggi melewati 4 × lebar dasar; rasio akhir 1,59 : 1 |
| Akses | bukaan ±1 m dibiarkan terbuka | tangga 4 : 1 + **pintu yang menutup sendiri** |
| Tag | tag hijau dipasang sebagai bagian perakitan, sebelum inspeksi | tag **merah** sejak tahap 1; tag **hijau** hanya setelah inspeksi serah terima memenuhi |
| Mode inspeksi | label tetap "Tegak ✓ / Datar ✓ / Siku 90° ✓" | **24 butir diukur dari model**; status "Jangan digunakan / Boleh digunakan" |

---

## 2. Koreksi geometri

### 2.1 Dimensi menara dan klaim "AS 4576 light duty"
- **Sebelum.** Bay 3,0 m, lebar 2,4 m, lift 2,0 m. Konstanta kode, tahap 3, catatan inspeksi, dan label 3D menyebut "AS 4576 light duty"; katalog meteran menulis "verifikasi dimensi sesuai standar (AS 4576)".
- **Sesudah.** Menara bebas 2 bay × **2,0 m** (panjang 4,0 m), lebar **1,2 m**, ledger pada **+0,15 / +1,95 / +3,90 m** (lift 1,80 m dan 1,95 m). Semua rujukan AS 4576 dihapus. Panel inspeksi dan layar pembuka kini menyatakan: *konfigurasi ilustratif, di dalam batas tabel pedoman (tidak mengikat) OSHA 1926 Subpart L App. A untuk tube & coupler light duty; bukan pengganti desain dan perhitungan oleh ahli.*
- **Alasan.**
  - AS 4576 adalah pedoman umum perancah; klaim bahwa standar itu menetapkan "bay 3,0 m · lebar 2,4 m · lift 2,0 m" tidak dapat ditunjukkan sumbernya (temuan TINGGI pada analisis).
  - Tabel pedoman OSHA App. A untuk tube & coupler *light duty* memakai jarak tiang maksimum **4 ft × 10 ft** (1,22 × 3,05 m) dan jarak runner vertikal maksimum **6 ft 6 in** (1,98 m). Lebar 2,4 m adalah dua kali batas 4 ft.
  - Bay dipilih **2,0 m** (bukan 3,0 m) agar bracing fasad yang dipasang **per lift** bersudut ±45° (lihat §2.6); dengan bay 3,0 m sudutnya hanya 31–33°.
  - Lift 1,95 m dipilih agar tidak melewati 1,98 m.
- **Sumber.** OSHA 29 CFR 1926 Subpart L App. A, tabel *Tube and Coupler Scaffolds* (pedoman, tidak mengikat).

### 2.2 Pelindung tepi: top rail, mid rail, toe board
- **Sebelum.** Top rail pada +5,05 m di atas lantai +4,11 m, yaitu ±0,92–0,94 m (teks tahap menyebut 950–1100 mm). Mid rail ±470 mm, sehingga celah atas ±480 mm. Lantai lift-1 tidak berpagar.
- **Sesudah** (berlaku untuk lantai lift-1 dan lantai atas, diukur otomatis dari model):

  | Ukuran | Nilai model | Syarat |
  |---|---|---|
  | Permukaan atas top rail di atas lantai | 1,000 m | ≥ 950 mm (Permenaker 9/2016 Pasal 24a; WAHR 2005 Sch. 2 ¶3(a)); ≥ 1,0 m (EN 12811-1 5.5.2); 38–45 in = 0,97–1,14 m (OSHA 1926.451(g)(4)(ii)) |
  | Pusat mid rail di atas lantai | 0,53 m | "kira-kira di tengah" (OSHA 1926.451(g)(4)(iv)) |
  | Celah bersih toe board → mid rail / mid rail → top rail | 0,356 m / 0,398 m | ≤ 470 mm (Permenaker Pasal 24c; WAHR Sch. 2 ¶3(c); EN 12811-1 5.5.3: bola 470 mm tidak lolos) |
  | Tinggi toe board | 150 mm | ≥ 150 mm (EN 12811-1 5.5.4); toeboard "cukup dan memadai" (Permenaker Pasal 24d); ≥ 3,5 in (OSHA 1926.451(h)(4)(ii)) |
  | Jarak muka luar toe board ke muka dalam pagar | maks. 26 mm | ≤ 80 mm (EN 12811-1 5.5.6) |
  | Kelengkapan | 4/4 sisi pada kedua lantai | pagar di semua sisi terbuka (OSHA 1926.451(g)(4)(i); PER.01/MEN/1980 Pasal 13(2): lantai > 2 m diberi pagar) |
- **Alasan.** Nilai lama di bawah 950 mm dan celahnya melebihi 470 mm. Angka 1,0 m memenuhi sekaligus Permenaker, EN 12811-1, dan rentang OSHA.
- **Catatan.** Syarat kekuatan pagar **0,9 kN** (Pasal 24b) tidak dapat diperiksa pada model visual; lihat §7.

### 2.3 Lantai kerja dan bentang papan
- **Sebelum.** Papan menerus 6,1 m. Lantai sementara lift-1 membentang **3,0 m** di antara transom tanpa tumpuan antara, padahal katalog aplikasi sendiri menulis "bentang aman ±1,2 m".
- **Sesudah.**
  - Papan 225 × 38 mm, panjang 3,9 m, 5 baris (lebar lantai 1,125 m).
  - Tumpuan: transom dekat setiap standard (x = −1,88; 0,08; 1,88 m) ditambah **putlog antara** (x = −0,90; 0,98 m). Bentang terbesar **0,98 m**.
  - Ujung papan menonjol **70 mm** dari tumpuan ujung dan **dikunci klem papan**.
  - Celah antarpapan 2 mm; celah lantai ke tiang 14 mm.
- **Alasan.** Bentang 3,0 m jauh melampaui batas papan 38 mm.
- **Sumber.**
  - BS 2482:2009: papan 38 mm untuk tumpuan berjarak ≤ 1,2 m (dipilah visual atau mesin); 1,5 m hanya untuk papan yang dipilah dengan mesin (ringkasan NASC TG5:18 dan Builders Merchants News).
  - OSHA App. A: papan 1¼ × 9 in pada 50 psf bentang maks. 4 ft.
  - NASC TG12:17: ujung papan menonjol ≥ 50 mm dan ≤ 4 × tebal (152 mm untuk 38 mm).
  - OSHA 1926.451(b)(1): celah ≤ 1 in (25 mm); (b)(4): ujung papan ≥ 6 in di atas tumpuan **kecuali dikunci/ditahan** — karena itu model memakai klem papan.
  - PER.01/MEN/1980 Pasal 13(1): lantai papan kuat dan rapat.

### 2.4 Transom, putlog, dan simpul
- **Sebelum.** Transom lift-2 dipasang **di bawah** ledger, putlog di atas ledger, sedangkan transom lift bawah di atas ledger (tidak konsisten).
- **Sesudah.** Semua transom dan putlog **duduk di atas ledger**, menonjol 100 mm di luar ledger. Transom diletakkan dekat standard (≤ 120 mm dari simpul). Aturan ini sama untuk semua lift.
- **Sumber.** OSHA 1926.452(b)(5) (kopling bearer bertumpu pada kopling runner; bila dikopel ke runner, sedekat mungkin ke tiang), (b)(6) (bearer menonjol melewati tiang/runner). BS EN 12811-1 Lampiran Nasional Inggris Tabel NA.1: jarak pusat kopling pada simpul < 150 mm.

### 2.5 Ledger dasar
- **Sebelum.** ±30 cm dari tanah.
- **Sesudah.** **+0,15 m**, "sedekat mungkin ke base plate".
- **Sumber.** OSHA 1926.452(b)(8): runner dan bearer terbawah dipasang sedekat mungkin ke dasar.
- **Kriteria aplikasi:** pemeriksaan otomatis menerima ledger/transom terbawah ≤ 0,30 m. Nilai ini bukan dari standar (lihat §7).

### 2.6 Bracing
- **Sebelum.** Bracing 2-lift (dari +0,30 ke +4,0 m, ±51°) dipasang di tahap 6, sebelum ledger lift-1 dan lift-2 ada. Ujung hanya satu diagonal (±57°). Bay tangga di sisi belakang tanpa diagonal.
- **Sesudah.**
  - Dipasang **per lift**, segera setelah lift selesai (tahap 8 dan 15).
  - Fasad: kedua sisi panjang, setiap bay, dua arah (pola "∧"). Sudutnya **42,0°** (lift 1) dan **44,3°** (lift 2).
  - Ujung: **silang X** di kedua ujung pada setiap lift.
  - Klem putar dipasang di simpul.
  - Bay tangga tetap di-bracing karena tangga kini berada di luar bidang fasad dan tidak terhalang.
- **Sumber.** OSHA 1926.452(b)(2) (X melintang di ujung), (b)(3) (bracing memanjang dua arah, sedekat mungkin ke simpul), (b)(4); OSHA App. A (bracing diagonal memanjang 45° ± 5°).

### 2.7 Stabilitas dan outrigger
- **Sebelum.** Outrigger dipasang di tahap 13, setelah lift-2 dan lantai sementara dipakai. Kepala outrigger di +3,45 m, kaki 0,7 m keluar diagonal. Tujuannya tidak dijelaskan (rasio lama 1,7 : 1).
- **Sesudah.**
  - Dengan lebar dasar 1,2 m dan tinggi akhir 5,10 m, rasionya **4,25 : 1 > 4 : 1**, sehingga penopang diperlukan.
  - Outrigger dipasang di **tahap 9**: setelah bracing lift-1 dan **sebelum** standard diperpanjang melewati 4 × 1,2 = 4,8 m serta sebelum ada pekerjaan di lift-2.
  - Kepala di simpul lift-1 (+1,85 m). Kaki 1,0 m keluar ke arah lebar, dengan base plate, sole board, dan pengikat kaki pada +0,30 m.
  - Lebar dasar menjadi 3,2 m dan rasio akhir **5,10 / 3,20 = 1,59 : 1**.
  - Uji otomatis memastikan rasio tidak pernah melewati 4 : 1 **pada setiap tahap**.
- **Sumber.** OSHA 1926.451(c)(1): rasio tinggi : lebar dasar (termasuk outrigger) > 4 : 1 wajib ditahan dari guling.
- **Catatan pengukuran.** Tinggi diukur sampai **titik tertinggi** (puncak standard). Ini pendekatan konservatif: surat interpretasi OSHA 2015 (ketentuan lain) mengukur sampai titik tertinggi, dan tabel pada surat 2004 memasukkan pagar ke "total height". Lihat §7.

### 2.8 Standard dan sambungan
- **Sebelum.** Keenam standard langsung setinggi penuh 5,2 m sejak tahap 3; sleeve di tahap 10 hanya tempelan visual.
- **Sesudah.** Panjang awal standard **berselang-seling** (2,20 m dan 4,15 m), lalu diperpanjang dengan sleeve di tahap 10 hingga 5,10 m. Sambungan dua standard yang bertetangga selalu berada pada lift yang berbeda (diperiksa otomatis).
- **Sumber.** Praktik baik. Detail jarak sambungan terhadap simpul belum diverifikasi terhadap TG20:21 (lihat §7).

### 2.9 Akses: tangga dan pintu yang menutup sendiri
- **Sebelum.** Tangga sejajar fasad di luar sisi belakang. Bukaan akses ±1 m sengaja dibiarkan terbuka ("akses TIDAK tertutup pipa").
- **Sesudah.**
  - Tangga bersandar tegak lurus fasad di bay kiri sisi belakang dengan kemiringan **4 : 1**: jarak kaki 24,3% dari panjang kerja, ±76°.
  - Ujung atas menonjol **1,02 m** di atas lantai atas, bersandar dan diikat pada top rail, ditambah dua pengikat ke ledger lift-1. Kaki tangga berdiri di alas papan.
  - Bukaan selebar 0,9 m (antara standard sudut dan puncheon) ditutup **pintu yang menutup sendiri** (engsel pegas) dengan top bar 1,0 m, mid bar 0,53 m, dan papan kaki 150 mm.
  - Selama perakitan, bukaan ditutup **rail penutup sementara** (tahap 16–17) yang baru dilepas saat pintu dipasang (tahap 18).
- **Sumber.**
  - OSHA 1926.1053(b)(1) (menonjol ≥ 3 ft/0,9 m), (b)(5)(i) (jarak kaki ±¼ panjang kerja), (b)(6) (diamankan dari pergeseran).
  - PER.01/MEN/1980 Pasal 25.
  - Permenaker 9/2016 Pasal 24; EN 12811-1 5.5.1; OSHA 1926.451(g)(4)(i): pelindung tepi menerus.
  - Rujukan praktik akses tangga: NASC SG25:20 (teks belum diverifikasi, lihat §7).

### 2.10 Base plate dan sole board
- **Sebelum.** Katalog menulis base plate "≥ 150 × 150 mm" dan sole board "≥ 220 mm lebar", keduanya tanpa sumber. Model sole board berukuran 450 × 400 mm.
- **Sesudah.**
  - Base plate 160 × 160 mm (256 cm²). Katalog menyebut syarat **luas ≥ 150 cm² dan lebar ≥ 120 mm** (EN 12811-1 5.7.1).
  - Sole board dimodelkan sebagai potongan papan 0,50 × 0,225 × 0,038 m. Katalog tidak lagi menyebut angka dan menyatakan bahwa ukurannya ditentukan oleh beban kaki dan daya dukung tanah.
- **Sumber.** EN 12811-1 butir 5.7.1; OSHA 1926.451(c)(2).

### 2.11 Tag status
- **Sebelum.** Tag hijau dipasang di tahap 20 sebagai bagian perakitan, sebelum inspeksi. Tag merah hanya ada di katalog.
- **Sesudah.**
  - **Tag merah** di barikade jalur akses sejak tahap 1 dan di kaki tangga sejak tahap 18.
  - **Tag hijau** hanya di tahap 20, setelah tahap 19 (inspeksi serah terima) tercatat.
  - Tahap 19 **menolak** dicatat bila ada butir yang belum memenuhi. Uji paksa: satu toe board disembunyikan → pemeriksaan "pelindung tepi menerus" gagal dan tahap tidak maju.
  - Di tahap 20 tag merah dan barikade dilepas. Panel menampilkan status tag pada setiap tahap.
- **Sumber.** OSHA 1926.451(f)(3) (inspeksi oleh personel kompeten sebelum setiap giliran kerja), (f)(7) (perakitan di bawah pengawasan personel kompeten); WAHR 2005 reg. 12(2), (4), (10)(a) (diinspeksi di posisinya sebelum dipakai, oleh personel kompeten); Permenaker 9/2016 Pasal 31–32 (tenaga kerja kompeten dan berwenang). Warna tag mengikuti konvensi penandaan status lapangan (lihat §7).

---

## 3. Urutan baru (20 tahap)

| No | Tahap baru | Pokok | Acuan utama | Tahap lama |
|---|---|---|---|---|
| 1 | Persiapan: rencana, material, zona eksklusi, tag merah | rencana & pengawas kompeten, periksa/pisahkan komponen rusak, tanah rata & kokoh, barikade, tag merah | OSHA 451(f)(7), (f)(4), (c)(2); Permenaker Pasal 31–32; PER.01/MEN/1980 Pasal 7 & 21 | **baru** |
| 2 | Sole board dan base plate | 6 titik, base plate di tengah | OSHA 451(c)(2); EN 12811-1 5.7.1 | 1 + 2 |
| 3 | Standard dengan panjang awal berselang-seling | 2,20 / 4,15 m, segera dikunci | NA Tabel NA.1 | 3 |
| 4 | Ledger dasar sedekat mungkin ke base plate | +0,15 m, datar | OSHA 452(b)(8) | 4 |
| 5 | Transom dasar dan kesikuan | di atas ledger dekat standard; uji dua diagonal | OSHA 452(b)(5) | 5 |
| 6 | Ledger lift-1 (+1,95 m) | ≤ 1,98 m | OSHA App. A; 452(b)(7)–(8) | 7 |
| 7 | Transom lift-1 | di atas ledger | OSHA 452(b)(5)–(6) | 8 |
| 8 | Bracing lift-1 | fasad 2 sisi, setiap bay, 2 arah; X di ujung | OSHA 452(b)(2)–(4); App. A | 6 (dipecah) |
| 9 | Outrigger sebelum tinggi > 4 × lebar dasar | 4 penopang dari simpul lift-1 | OSHA 451(c)(1) | 13 (dimajukan) |
| 10 | Perpanjang standard dengan sleeve | sambungan selang-seling | praktik baik (TG20:21) | 10 |
| 11 | Pelindung tepi lift-1 dari posisi terlindungi | top rail 1,0 m, mid rail 0,53 m **sebelum** lantai dinaiki; harness bila belum ada perlindungan kolektif | Permenaker Pasal 24–25; PER.01/MEN/1980 Pasal 13(2); EN 12811-1 5.5; SG4:22 | 17–18 (dimajukan) |
| 12 | Lantai lift-1: putlog, papan, toe board | bentang ≤ 1,2 m, rapat, dikunci, toe board 150 mm | BS 2482:2009; TG12; OSHA 451(b)(1), (b)(4), (h)(4) | 9 (diganti) + 19 |
| 13 | Ledger lift-2 (+3,90 m) | dari lantai terlindungi | OSHA App. A; 452(b)(7) | 11 |
| 14 | Transom lift-2 | di atas ledger | OSHA 452(b)(5)–(6) | 12 (dikoreksi) |
| 15 | Bracing lift-2 | sebelum lantai atas | OSHA 452(b)(2)–(3) | 6 (dipecah) |
| 16 | Pelindung tepi lantai atas (advance guardrail) | dipasang dari lift-1; puncheon pintu; rail penutup sementara di bukaan | SG4:22; Permenaker Pasal 24; OSHA 451(g)(4) | 17–19 (dimajukan) |
| 17 | Lantai kerja atas: putlog, papan, toe board | seperti tahap 12 | BS 2482; TG12; OSHA 451(b), (h)(4) | 14 + 15 + 19 |
| 18 | Tangga akses dan pintu yang menutup sendiri | 4 : 1, menonjol 1,02 m, diikat; pintu menggantikan rail penutup; tag merah di kaki tangga | OSHA 1053(b)(1), (b)(5)(i), (b)(6); Permenaker Pasal 24 | 20 (dipecah) |
| 19 | Inspeksi serah terima oleh personel kompeten | 24 butir terukur harus memenuhi | OSHA 451(f)(3); WAHR reg. 12 | **baru** |
| 20 | Ganti tag merah dengan tag hijau | tag hijau, barikade dilepas | OSHA 451(f)(3) | 20 (dipecah) |

**Dihapus:** tahap lama 16 "Bongkar lantai kerja sementara". Lantai lift-1 kini memenuhi syarat (pagar dipasang lebih dulu, bentang ≤ 1,2 m, toe board) dan dipertahankan karena akan dipakai lagi saat pembongkaran dengan urutan terbalik (lihat §7). Puncheon tepi lama tidak diperlukan karena bentang rail kini 2,0 m di antara standard; puncheon hanya dipasang di tepi bukaan akses.

**Kemajuan tersimpan.** Kemajuan latihan kini memuat versi urutan (`seq`). Kemajuan dari urutan lama tidak dapat dipetakan ke urutan baru, sehingga anggota mendapat catatan "Urutan perakitan telah diperbarui (Oktober 2026)…" dan memulai dari tahap 1. Riwayat katalog dan alat ukur tetap tersimpan.

---

## 4. Mode inspeksi yang benar-benar mengukur

- **Sebelum.**
  - Label tetap "Tegak ✓", "Datar ✓", "Siku 90° ✓", dan "Light duty — AS 4576", tanpa pengukuran apa pun.
  - Tab inspeksi selalu menampilkan struktur lengkap, berapa pun tahap yang sudah dipasang.
- **Sesudah.**
  - Tab inspeksi menampilkan **hanya komponen yang sudah terpasang**.
  - Fungsi `evaluate()` mengukur mesh yang benar-benar ada di adegan:
    - ujung pipa dihitung dari matriks dunia dan panjang geometri;
    - papan dan toe board diukur dari kotak batasnya;
    - setiap komponen membawa *role* (standard, ledger, transom, putlog, board, toeboard, rail-top, rail-mid, brace, outrigger, gate, tag, dll.).
  - Status di panel: **"Jangan digunakan"** atau **"Boleh digunakan"**, disertai jumlah butir yang memenuhi.
  - Enam alat ukur menampilkan garis dan label nilai terukur di adegan 3D: kelurusan, kedataran, dimensi, kesikuan, pelindung tepi, dan stabilitas. Label berakhir ✓ atau ✗ sesuai hasil ukur.

| Kelompok | Butir (24) | Syarat yang diperiksa | Acuan |
|---|---|---|---|
| Dasar & rangka | Sole board & base plate di bawah setiap standard | 6/6 | OSHA 451(c)(2) |
| | Ukuran base plate | ≥ 150 cm², lebar ≥ 120 mm | EN 12811-1 5.7.1 |
| | Standard tegak | ≤ 20 mm per 2 m, total ≤ 50 mm | BS EN 12811-1 NA Tabel NA.1 |
| | Ledger datar | ≤ 20 mm per 2 m | NA Tabel NA.1 |
| | Jarak tiang | ≤ 3,05 m × 1,22 m | OSHA App. A (pedoman) |
| | Ledger terbawah & lift | terbawah ≤ 0,30 m\*; lift ≤ 1,98 m | OSHA 452(b)(8); App. A |
| | Kesikuan | dua diagonal tiap bay sama (selisih ≤ 1 mm\*) | prinsip geometri |
| | Sambungan standard | bertetangga tidak pada lift yang sama | praktik baik (TG20:21) |
| Bracing & stabilitas | Bracing fasad | setiap lift, 2 sisi, setiap bay, 2 arah | OSHA 452(b)(3)–(4) |
| | Sudut bracing fasad | 40–50° | OSHA App. A |
| | Silang X di ujung | setiap lift, kedua ujung | OSHA 452(b)(2) |
| | Rasio tinggi : lebar dasar | ≤ 4 : 1 (termasuk outrigger) | OSHA 451(c)(1) |
| Lantai kerja | Lantai penuh & rapat | celah ≤ 25 mm | OSHA 451(b)(1); PER.01/MEN/1980 Pasal 13(1) |
| | Bentang papan | ≤ 1,2 m | BS 2482:2009; OSHA App. A |
| | Ujung papan | 50–152 mm, dikunci | NASC TG12; OSHA 451(b)(4) |
| Pelindung tepi | Tinggi top rail | ≥ 1,0 m dan ≤ 1,143 m | Permenaker Pasal 24a; EN 12811-1 5.5.2; OSHA 451(g)(4)(ii) |
| | Celah vertikal | ≤ 470 mm | Permenaker Pasal 24c; EN 12811-1 5.5.3; WAHR Sch. 2 |
| | Toe board | ≥ 150 mm | EN 12811-1 5.5.4; Permenaker Pasal 24d; OSHA 451(h)(4)(ii) |
| | Kelengkapan keliling | top rail, mid rail, toe board di 4 sisi (pintu tertutup dihitung) | OSHA 451(g)(4)(i); EN 12811-1 5.5.1 |
| | Jarak toe board ke pagar | ≤ 80 mm | EN 12811-1 5.5.6 |
| Akses & status | Tangga | jarak kaki 22–28% panjang kerja\*; menonjol ≥ 0,9 m | OSHA 1053(b)(5)(i), (b)(1) |
| | Tangga diikat | ≥ 2 titik ikat | OSHA 1053(b)(6) |
| | Pintu akses | menutup sendiri, tertutup, tinggi 1,0 m, papan kaki 150 mm | Permenaker Pasal 24; EN 12811-1 5.5 |
| | Tag status | merah selama perakitan; hijau hanya setelah inspeksi | OSHA 451(f)(3); WAHR reg. 12 |

\* **Kriteria aplikasi**, bukan nilai standar. Angka ini hanya batas pembulatan untuk model ideal dan perlu ditetapkan Komite Teknis (§7). OSHA hanya menyebut "approximately one-quarter" untuk tangga dan "as close to the base as possible" untuk ledger terbawah.

---

## 5. Perbaikan antarmuka dan ketahanan

Butir B1–B13 dari analisis sudah diperbaiki saat porting (`CATATAN.md` §5.2) dan **diuji ulang** pada versi ini. Butir yang **ditambah atau diubah** dalam koreksi ini:

| Butir | Sebelum | Sesudah |
|---|---|---|
| Daftar cek di kartu tahap | tanda ✓ tetap pada setiap butir | kotak kosong (butir *yang harus diperiksa*), ditambah baris **Acuan** per tahap |
| Material & geometri | setiap pipa dan klem membuat material sendiri (548 material) | material dan geometri dipakai bersama: 70 material unik pada menara lengkap; geometri tidak bertambah setelah 48 pergantian model katalog, 96 kali sakelar overlay, dan 10 siklus mundur/pasang |
| Biaya gambar | bayangan dihitung ulang setiap frame | 0 frame saat diam; bayangan hanya dihitung ulang saat isi adegan berubah: 699 draw call per frame perubahan (termasuk bayangan) dan 524 per frame yang hanya menggerakkan kamera. Baut kecil pada klem menara dihapus (657 → 524 draw call); baut tetap ada di model katalog |
| Tombol tahap | dapat berada di bawah lipatan panel | baris tombol menempel di dasar panel pada semua ukuran layar; kepala panel diringkas pada ponsel lanskap |
| Notifikasi | di tengah jendela (menimpa panel pada tablet/lanskap) | di tengah area adegan |
| Label "Bongkar 1 tahap" | terbungkus dua baris | "↶ Bongkar" (label aksesibel: "Bongkar satu tahap") |

---

## 6. Verifikasi (9 Oktober 2026)

| Perintah (dari `devtools/`) | Hasil |
|---|---|
| `node flows/aplikasi-simulator-flow.mjs` | **98/98 lulus**: urutan 20 tahap dan aturannya; ukuran dari adegan; inspeksi dan kegagalan paksa; memori; render sesuai kebutuhan; keyboard; axe; ponsel potret dan lanskap; tablet; migrasi kemajuan; tanpa WebGL; three.js diblokir |
| `node flows/aplikasi-flow.mjs --only=D,E` | **72/72 lulus** (bagian simulator diperbarui untuk enam alat ukur; axe 0 serius/kritis) |
| `node check.mjs aplikasi/simulator/index` dengan: tanpa sesi, `--auth`, `--admin`, dan `--auth --status=` Draf / Menunggu Verifikasi / Perlu Perbaikan / Ditolak / Nonaktif / Kedaluwarsa | **0 isu** pada kesembilan kondisi (desktop + ponsel) |

Nilai yang diukur langsung dari adegan, terpisah dari `evaluate()` aplikasi dan sama dengan hasilnya:

| Ukuran | Hasil |
|---|---|
| Top rail di atas lantai | 1,000 m pada lantai +2,060 m dan +4,010 m |
| Celah bersih | 0,356 / 0,398 m |
| Toe board | 150 mm |
| Bentang papan | maks. 0,98 m |
| Ujung papan | 70 mm |
| Sudut bracing fasad | 42,0° / 44,3° |
| Rasio tinggi : lebar dasar | ≤ 4 : 1 pada **setiap** tahap; 1,59 : 1 di akhir |

Tangkapan layar: `devtools/shots/apl-sim-koreksi-*.png`.

---

## 7. Pertanyaan terbuka untuk Komite Teknis PPAPI

1. **Acuan nasional.**
   - Permenaker 9/2016 Pasal 15(2) merujuk persyaratan K3 perancah ke "ketentuan peraturan perundang-undangan". PER.01/MEN/1980 Bab III tidak memuat angka geometri.
   - Standar mana yang ditetapkan PPAPI sebagai acuan pelatihan untuk tinggi pagar, bentang papan, dan toleransi: BS EN 12811-1, TG20, atau SNI tertentu?
2. **Konfigurasi ilustrasi.**
   - Apakah bay 2,0 m × lebar 1,2 m × lift 1,95 m disetujui?
   - Perlukah diselaraskan dengan contoh Aplikasi Perencanaan (4 bay × 2,4 × 1,2 m)?
3. **Tinggi top rail.** PPAPI menganjurkan 1,0 m (EN 12811-1) atau cukup minimum 950 mm (Permenaker)? Model memakai 1,0 m.
4. **Mid rail.** Satu mid rail pada 0,53 m, atau dua rail tengah (praktik sebagian kontraktor)?
5. **Kekuatan pagar 0,9 kN** (Pasal 24b) tidak dapat dibuktikan oleh model visual. Perlukah catatan uji atau sertifikat komponen di materi pelatihan?
6. **Batas stabilitas menara bebas.**
   - Aplikasi memakai 4 : 1 OSHA dengan tinggi sampai titik tertinggi.
   - Apakah PPAPI menetapkan batas lain untuk menara statis (misalnya menurut TG20) atau mempertimbangkan beban angin?
7. **Outrigger.**
   - Jarak kaki 1,0 m dan kepala di simpul lift-1 bersifat ilustratif dan memerlukan desain.
   - Perlukah alternatif *tie* ke bangunan ditampilkan sebagai varian?
8. **Lantai lift-1.**
   - Dipertahankan untuk pembongkaran, atau dibongkar setelah lantai atas selesai?
   - Ruang bebas ke transom lift-2 1,86 m: memenuhi kelas H1 EN 12811-1 (≥ 1,75 m), tetapi tidak H2 (≥ 1,90 m).
   - Akses scaffolder ke lift-1 selama perakitan mengikuti OSHA 1926.451(e)(9) (akses aman bagi pemasang). Rincian caranya belum dimodelkan.
9. **Bracing.**
   - Rentang "35–55°" di aplikasi lama tidak dapat diverifikasi dari teks TG20. Model memakai 45° ± 5° (OSHA App. A).
   - Bracing X ujung dipasang setiap lift (OSHA (b)(2) mensyaratkan minimal setiap runner keempat).
   - Mohon konfirmasi konvensi PPAPI.
10. **Sambungan standard.** Jarak sleeve dari simpul (model 0,25 m) dan aturan selang-seling perlu diverifikasi terhadap TG20:21.
11. **Papan.**
    - Panjang 3,9 m dengan klem papan sebagai "penahan" sehingga ujung 70 mm dapat diterima menurut OSHA 1926.451(b)(4); TG12 meminta 50–152 mm.
    - Rujukan kelas papan BS 2482:2009 berasal dari ringkasan sekunder; mohon verifikasi dengan teks standar.
12. **Pintu tangga.**
    - Teks NASC SG25:20 belum diperiksa langsung.
    - Mohon tetapkan spesifikasi pintu (lebar bukaan, arah buka, papan kaki) dan apakah pintu wajib pada setiap bukaan akses.
13. **Konvensi tag.** Merah dan hijau dipakai di simulator. Apakah PPAPI memakai tiga warna (mis. kuning untuk "boleh dengan syarat") dan format isi tag tertentu?
14. **Kriteria aplikasi** (§4, bertanda \*): ledger terbawah ≤ 0,30 m, selisih diagonal ≤ 1 mm, dan jarak kaki tangga 22–28% panjang kerja perlu ditetapkan atau diganti.
15. **Kelanjutan.** Mesin inspeksi kini siap untuk **mode tantangan**: cacat acak (toe board hilang, mid rail hilang, standard miring) yang harus ditemukan peserta. Draw call masih ±524 per frame; `InstancedMesh` dapat menurunkannya lebih jauh. Keduanya diusulkan untuk fase berikutnya.
16. **Edisi standar.** Butir EN 12811-1 yang dikutip berasal dari BS EN 12811-1:2003 beserta Lampiran Nasional Inggris. Mohon konfirmasi edisi yang berlaku bagi PPAPI.

> Catatan untuk pemelihara `CATATAN.md`: §5 (*"urutan, geometri, dan teks teknis tahap perakitan TIDAK diubah"*) dan butir simulator di §6 kini digantikan oleh dokumen ini.

---

## 8. Sumber

- Permenaker No. 9 Tahun 2016 tentang K3 dalam Pekerjaan pada Ketinggian (BN 2016 No. 386): Pasal 12, 15, 24, 25, 31–32, 35 — https://peraturan.bpk.go.id/Details/146109/permenaker-no-9-tahun-2016
- Permenakertrans PER.01/MEN/1980 tentang K3 pada Konstruksi Bangunan: Pasal 7, 13, 21, 25 — https://temank3.kemnaker.go.id/public/media/files/20210725204520.pdf
- OSHA 29 CFR 1926.451 (persyaratan umum perancah) — https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.451
- OSHA 29 CFR 1926.452(b) (tube & coupler) — https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.452
- OSHA 1926 Subpart L Appendix A (pedoman, tidak mengikat) — https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926SubpartLAppA
- OSHA 29 CFR 1926.1053 (tangga) — https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.1053
- Surat interpretasi OSHA tentang pengukuran tinggi — https://www.osha.gov/laws-regs/standardinterpretations/2004-03-10-0 dan https://www.osha.gov/laws-regs/standardinterpretations/2015-10-19-1
- UK Work at Height Regulations 2005, Schedule 2 — https://www.legislation.gov.uk/uksi/2005/735/schedule/2/made ; reg. 12 — https://www.legislation.gov.uk/uksi/2005/735/regulation/12/made
- BS EN 12811-1:2003 *Temporary works equipment — Scaffolds — Performance requirements and general design*: butir 5.2, 5.3, 5.5, 5.7, dan Lampiran Nasional Inggris Tabel NA.1 — https://knowledge.bsigroup.com/products/temporary-works-equipment-scaffolds-performance-requirements-and-general-design
- BS 2482:2009 (papan perancah kayu): ringkasan kelas tumpuan 1,2 m / 1,5 m — https://www.buildersmerchantsnews.co.uk/news/trade-bodies/john-brash-supports-updated-standards ; NASC TG5:18 — https://nasc.org.uk/product/tg518-timber-scaffold-boards-bs24822009/
- NASC TG12:17 *Tying down of scaffold boards* — https://nasc.org.uk/wp-content/uploads/2015/11/TG12_17-Tying-down-of-scaffold-boards.pdf
- NASC SG4:22 *Preventing Falls in Scaffolding Operations* — https://nasc.org.uk/wp-content/uploads/2024/09/SG4-Preventing-Falls-in-Scaffolding-Operations-Rev-000-29-08-24.pdf ; ringkasan sekunder tentang pemasangan pagar sebelum lift dinaiki — https://squote.app/knowledge/scaffolding/scaffold-edge-protection
- NASC SG25:20 *Access and Egress from Scaffolds* — https://nasc.org.uk/product/sg25-20.html
- Analisis aplikasi lama: `devtools/legacy/ANALISIS_SIMULATOR.md`; riset regulasi proyek: `devtools/research/regulasi.json`
