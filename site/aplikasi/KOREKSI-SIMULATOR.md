# Koreksi Geometri & Urutan — Simulator Pemasangan Perancah Tube & Coupler

- **Aplikasi:** `aplikasi/simulator/` (`simulator.js`, `index.html`, `simulator.css`)
- **Dasar pekerjaan:** persetujuan klien *"Perbaiki geometri & urutan"*; temuan `devtools/legacy/ANALISIS_SIMULATOR.md` §2 dan `aplikasi/CATATAN.md` §6.
- **Tanggal:** 9 Oktober 2026. **Revisi 2 (9 Oktober 2026):** tindak lanjut tinjauan teknik independen atas koreksi pertama (§9).
- **Status:** sudah diterapkan dan diuji otomatis; **menunggu tinjauan dan pengesahan Komite Teknis PPAPI** (lihat §7).

Dokumen ini disusun untuk tinjauan teknis. Setiap koreksi dicatat dalam pola **sebelum → sesudah → alasan → sumber**. Model tetap bersifat **ilustratif untuk pelatihan**, bukan desain perancah. Angka yang merupakan **kriteria aplikasi** (bukan nilai dari standar) ditandai secara eksplisit.

---

## 1. Ringkasan

| Aspek | Sebelum | Sesudah |
|---|---|---|
| Dimensi menara | 2 bay × 3,0 m, lebar 2,4 m, lift 2,0 m, berlabel "AS 4576 light duty" | 2 bay × 2,0 m, lebar 1,2 m, lift 1,95 m; label "konfigurasi ilustratif" dengan acuan tabel pedoman OSHA App. A |
| Top rail di atas lantai | ±0,92–0,94 m (di bawah 950 mm) | **1,000 m** (permukaan atas) di sisi panjang; **1,075 m** di sisi ujung karena rail bersilang di standard sudut |
| Celah pelindung tepi | 480 mm (> 470 mm) | sisi panjang 0,356 / 0,398 m; sisi ujung 0,431 / 0,398 m (celah bersih) |
| Toe board | 150 mm, dipasang setelah lantai dipakai | 150 mm, dipasang bersama lantai, pada kedua lantai; diklem ke standard |
| Bentang papan 38 mm | 3,0 m pada lantai sementara | maks. **0,98 m**; ujung papan 90 mm dari sumbu transom ujung (**66 mm dari muka pipa**), dikunci klem papan |
| Lantai lift-1 | sementara, tanpa pagar, dibongkar kemudian | lantai lift-1 **lengkap dengan pelindung tepi dan tangga aksesnya sendiri**, pagar dipasang lebih dulu |
| Bracing | satu batang 2-lift dipasang sebelum lift-1 ada; ujung satu diagonal 57° | **per lift**, kedua sisi, setiap bay, dua arah (42,0° dan 44,3°); silang X di kedua ujung. Bay akses lift-1 (sisi belakang, bay kanan) dibiarkan tanpa diagonal pada lift-2. Pola per lift adalah **kriteria aplikasi** (§2.6) |
| Stabilitas | outrigger setelah pekerja bekerja di lift-2 | outrigger **sebelum** tinggi melewati 4 × lebar dasar; outrigger dijepit klem putar pada standard sudut; rasio akhir 1,59 : 1 |
| Akses | bukaan ±1 m dibiarkan terbuka | **setiap lantai kerja** punya tangga 4 : 1 yang **bersandar dan diikat pada top rail yang tetap terpasang**, di samping **pintu yang menutup sendiri** dan hanya membuka ke dalam |
| Tag | tag hijau dipasang sebagai bagian perakitan, sebelum inspeksi | tag **merah** sejak tahap 1; tag **hijau** di kedua titik akses hanya setelah inspeksi serah terima memenuhi |
| Mode inspeksi | label tetap "Tegak ✓ / Datar ✓ / Siku 90° ✓" | **26 butir**: 24 diukur dari geometri model, 1 diukur dengan sebagian syarat diperiksa dari jenis komponen (pintu), 1 diperiksa (tag); status "Jangan digunakan / Boleh digunakan" |

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
- **Sebelum (aplikasi lama).** Top rail pada +5,05 m di atas lantai +4,11 m, yaitu ±0,92–0,94 m (teks tahap menyebut 950–1100 mm). Mid rail ±470 mm, sehingga celah atas ±480 mm. Lantai lift-1 tidak berpagar.
- **Sebelum (koreksi pertama).** Rail diletakkan pada sumbu standard, dan rail sisi panjang serta sisi ujung bertemu pada ketinggian yang sama **di dalam** standard sudut. Hasil "1,000 m di setiap sisi" bergantung pada pipa yang saling menembus: dengan klem siku (*right-angle coupler*), dua rail yang bersilang pada satu standard harus berselisih tinggi ±70–80 mm. Klem toe board di keempat standard sudut berjarak 50–80 mm dari toe board mana pun.
- **Sesudah** (berlaku untuk lantai lift-1 dan lantai atas, diukur otomatis dari model):
  - Rail dipasang **di muka dalam standard** (sumbu rail 48 mm dari sumbu standard), diklem ke setiap standard dan puncheon, dan setiap potongan rail menonjol 60 mm melewati klemnya.
  - Rail sisi ujung dipasang **75 mm lebih tinggi** daripada rail sisi panjang. Di standard sudut, kedua klem kini bertumpuk dengan selisih 75 mm dan pipa tidak saling menembus.
  - Toe board sisi panjang diperpanjang melewati standard sudut; klem toe board dipasang **pada papan**, di antara muka luar toe board dan muka standard/puncheon.

  | Ukuran | Nilai model | Syarat |
  |---|---|---|
  | Permukaan atas top rail di atas lantai | sisi panjang 1,000 m; sisi ujung 1,075 m | ≥ 950 mm (Permenaker 9/2016 Pasal 24a; WAHR 2005 Sch. 2 ¶3(a)); ≥ 1,0 m (EN 12811-1 5.5.2); 38–45 in = 0,97–1,14 m (OSHA 1926.451(g)(4)(ii)) |
  | Pusat mid rail di atas lantai | sisi panjang 0,53 m; sisi ujung 0,605 m | "kira-kira di tengah" (OSHA 1926.451(g)(4)(iv)) |
  | Celah bersih toe board → mid rail / mid rail → top rail | sisi panjang 0,356 / 0,398 m; sisi ujung 0,431 / 0,398 m | ≤ 470 mm (Permenaker Pasal 24c; WAHR Sch. 2 ¶3(c); EN 12811-1 5.5.3: bola 470 mm tidak lolos) |
  | Tinggi toe board | 150 mm | ≥ 150 mm (EN 12811-1 5.5.4); toeboard "cukup dan memadai" (Permenaker Pasal 24d); ≥ 3,5 in (OSHA 1926.451(h)(4)(ii)) |
  | Jarak muka luar toe board ke muka dalam rail dan komponen tengah | maks. 15 mm (diukur dari posisi nyata rail, termasuk daun pintu) | ≤ 80 mm (EN 12811-1 5.5.6) |
  | Kelengkapan | 4/4 sisi pada kedua lantai | pagar di semua sisi terbuka (OSHA 1926.451(g)(4)(i); PER.01/MEN/1980 Pasal 13(2): lantai > 2 m diberi pagar) |
- **Alasan.** Nilai lama di bawah 950 mm dan celahnya melebihi 470 mm. Angka 1,0 m memenuhi sekaligus Permenaker, EN 12811-1, dan rentang OSHA. Sisi ujung 1,075 m tetap di dalam rentang OSHA dan celah terbesarnya 0,431 m tetap ≤ 470 mm.
- **Catatan.** Syarat kekuatan pagar **0,9 kN** (Pasal 24b) tidak dapat diperiksa pada model visual; lihat §7. Selisih 75 mm adalah nilai ilustratif untuk dua klem siku yang bertumpuk; ukuran sebenarnya bergantung pada jenis klem.

### 2.3 Lantai kerja dan bentang papan
- **Sebelum (aplikasi lama).** Papan menerus 6,1 m. Lantai sementara lift-1 membentang **3,0 m** di antara transom tanpa tumpuan antara, padahal katalog aplikasi sendiri menulis "bentang aman ±1,2 m".
- **Sebelum (koreksi pertama).** Transom ujung pada x = ±1,88 m: ujung papan 70 mm dari **sumbu** transom, tetapi hanya 46 mm melewati **muka** pipa Ø48,3 mm. Aplikasi diam-diam memakai bacaan yang menguntungkan (sumbu).
- **Sesudah.**
  - Papan 225 × 38 mm, panjang 3,9 m, 5 baris (lebar lantai 1,125 m).
  - Tumpuan: transom dekat setiap standard (x = −1,86; 0,08; 1,86 m; ≤ 150 mm dari simpul) ditambah **putlog antara** (x = −0,90; 0,98 m). Bentang 0,96 / 0,98 / 0,90 / 0,88 m, terbesar **0,98 m**.
  - Ujung papan **90 mm dari sumbu** transom ujung, yaitu **66 mm melewati muka pipa**, dan **dikunci klem papan**.
  - **Dasar pengukuran** kini dinyatakan di panel: batas bawah 50 mm diukur dari **muka** tumpuan (pembacaan yang aman), batas atas 4 × tebal (152 mm) diukur dari sumbu tumpuan.
  - Celah antarpapan 2 mm; celah lantai ke tiang 14 mm.
- **Alasan.** Bentang 3,0 m jauh melampaui batas papan 38 mm. Ujung papan 46 mm dari muka pipa berada di bawah 50 mm bila acuan ukurnya muka tumpuan.
- **Sumber.**
  - BS 2482:2009: papan 38 mm untuk tumpuan berjarak ≤ 1,2 m (dipilah visual atau mesin); 1,5 m hanya untuk papan yang dipilah dengan mesin (ringkasan sekunder Builders Merchants News; panduan NASC TG05:24 tentang papan BS 2482:2009 belum diperiksa langsung).
  - OSHA App. A: papan 1¼ × 9 in pada 50 psf bentang maks. 4 ft.
  - NASC TG12 (*Tying down of scaffold boards*): ujung papan ≥ 50 mm dan ≤ 4 × tebal. Edisi TG12:17 yang semula dikutip tidak lagi tersedia daring; edisi berlaku **TG12:22 belum diperiksa**, dan kedua edisi tidak menyebut titik acuan ukurnya.
  - NASC SG25:20 butir 4.1 (teks diperiksa): papan yang lebih pendek dari 2,1 m pada *ladder access bay* menonjol dari transom ujung minimal 50 mm dan maksimal 150 mm. Dipakai di sini sebagai pembanding rentang 50–150 mm.
  - OSHA 1926.451(b)(1): celah ≤ 1 in (25 mm). OSHA 1926.451(b)(4): ujung papan ≥ 6 in di atas **sumbu** tumpuan, kecuali dikunci/ditahan; karena itu model memakai klem papan.
  - PER.01/MEN/1980 Pasal 13(1): lantai papan kuat dan rapat.

### 2.4 Transom, putlog, dan simpul
- **Sebelum.** Transom lift-2 dipasang **di bawah** ledger, putlog di atas ledger, sedangkan transom lift bawah di atas ledger (tidak konsisten).
- **Sesudah.** Semua transom dan putlog **duduk di atas ledger**, menonjol 100 mm di luar ledger. Transom diletakkan dekat standard (140 mm dari simpul). Aturan ini sama untuk semua lift.
- **Sumber.** OSHA 1926.452(b)(5) (kopling bearer bertumpu pada kopling runner; bila dikopel ke runner, sedekat mungkin ke tiang), (b)(6) (bearer menonjol melewati tiang/runner). BS EN 12811-1 Lampiran Nasional Inggris Tabel NA.1: jarak pusat kopling pada simpul < 150 mm.

### 2.5 Ledger dasar
- **Sebelum.** ±30 cm dari tanah.
- **Sesudah.** **+0,15 m**, "sedekat mungkin ke base plate". Ujung ledger kini 0,20 m di luar standard ujung (sebelumnya 0,10 m), agar klem bracing silang di ujung menara berada di dalam panjang pipa (§2.12).
- **Sumber.** OSHA 1926.452(b)(8): runner dan bearer terbawah dipasang sedekat mungkin ke dasar.
- **Kriteria aplikasi:** pemeriksaan otomatis menerima ledger/transom terbawah ≤ 0,30 m. Nilai ini bukan dari standar (lihat §7).

### 2.6 Bracing
- **Sebelum.** Bracing 2-lift (dari +0,30 ke +4,0 m, ±51°) dipasang di tahap 6, sebelum ledger lift-1 dan lift-2 ada. Ujung hanya satu diagonal (±57°). Bay tangga di sisi belakang tanpa diagonal.
- **Sesudah.**
  - Dipasang **per lift**, segera setelah lift selesai (tahap 8 dan 15).
  - Fasad: kedua sisi panjang, setiap bay, dua arah (pola "∧"). Sudutnya **42,0°** (lift 1) dan **44,3°** (lift 2).
  - Ujung: **silang X** di kedua ujung pada setiap lift.
  - Klem putar dipasang di simpul; pipa bracing menonjol 40 mm melewati klem di kedua ujungnya.
  - **Bay akses (revisi 2).** Pada lift-2, bay kanan sisi belakang **tidak diberi diagonal fasad**. Bay itu adalah titik akses lantai lift-1 (§2.9): diagonalnya akan melintang di depan pintu setinggi 0,6–1,2 m di atas lantai, sehingga pengguna harus memanjat atau merunduk melewatinya. OSHA 1926.451(e)(1) melarang *crossbrace* dipakai sebagai sarana akses, dan NASC SG25:20 butir 6.4 melarang pengguna memanjat di atas atau di bawah pagar untuk mencapai lantai. Bay itu tetap dibracing di sisi depan; sisi belakang lift-2 tetap memiliki diagonal di bay kiri. Pemeriksaan mengenali bay akses dari posisi pintu pada lantai di dasar lift. Diagonal yang dipasang melintang di depan pintu membuat butir "akses aman" gagal (uji paksa di §4).
- **Status acuan (dikoreksi pada revisi 2).**
  - Koreksi pertama mengutip OSHA 1926.452(b)(3)–(4) sebagai sumber pola "setiap lift, kedua sisi panjang, setiap bay, dua arah". Kutipan itu tidak tepat.
  - Teks OSHA 1926.452(b)(3) (diperiksa di osha.gov) mensyaratkan bracing memanjang **dua arah** dan **sedekat mungkin ke simpul**. Untuk perancah yang panjangnya lebih kecil daripada tingginya (di sini 4,0 m < 5,10 m), bracing itu dipasang dari dasar tiang ujung ke tiang ujung yang berseberangan, lalu berganti arah sampai puncak. Pola harfiahnya untuk menara ini adalah diagonal sepanjang menara, misalnya dari (−2,0; +0,15) ke (+2,0; +3,90) pada 43,2°, lalu berganti arah.
  - (b)(4) hanya mengatur bracing yang dipasang ke runner bila tidak dapat dipasang ke tiang; ayat ini **tidak lagi dikutip**.
  - Pola "∧" per lift dipertahankan sebagai **kriteria aplikasi**: bracing dapat dipasang bertahap sebelum naik ke lift berikutnya, sedangkan diagonal sepanjang menara baru dapat dipasang setelah runner lift-2 ada. Kesesuaiannya dengan praktik Inggris (TG20) belum diverifikasi. Pertanyaan ini diajukan ke Komite Teknis (§7 butir 9).
- **Sumber.** OSHA 1926.452(b)(2) (X melintang di ujung; minimal setiap runner keempat), (b)(3) (dua arah, sedekat mungkin ke simpul); OSHA App. A (bracing diagonal memanjang 45° ± 5°). Di panel dan teks tahap, pola per lift diberi label "kriteria aplikasi".

### 2.7 Stabilitas dan outrigger
- **Sebelum.** Outrigger dipasang di tahap 13, setelah lift-2 dan lantai sementara dipakai. Kepala outrigger di +3,45 m, kaki 0,7 m keluar diagonal. Tujuannya tidak dijelaskan (rasio lama 1,7 : 1).
- **Sesudah.**
  - Dengan lebar dasar 1,2 m dan tinggi akhir 5,10 m, rasionya **4,25 : 1 > 4 : 1**, sehingga penopang diperlukan.
  - Outrigger dipasang di **tahap 9**: setelah bracing lift-1 dan **sebelum** standard diperpanjang melewati 4 × 1,2 = 4,8 m serta sebelum ada pekerjaan di lift-2.
  - **Geometri sambungan (revisi 2).** Bidang outrigger bergeser 75 mm ke dalam bay dari standard sudut sehingga outrigger **bersilang** dengan standard dan dijepit **klem putar** pada +1,80 m (di bawah simpul lift-1). Pipa menonjol 0,10 m melewati klem. Sebelumnya pipa outrigger berakhir tepat di pusat klem, dan perpanjangannya akan menembus standard.
  - Kaki 1,0 m keluar ke arah lebar, dengan base plate dan sole board.
  - **Pengikat kaki (kicker)** pada +0,30 m bersilang 75 mm dari standard dan 75 mm dari outrigger, dijepit klem di kedua persilangan, dan menonjol 0,10 m melewati kedua klem.
  - Lebar dasar menjadi 3,2 m dan rasio akhir **5,10 / 3,20 = 1,59 : 1**.
  - Uji otomatis memastikan rasio tidak pernah melewati 4 : 1 **pada setiap tahap**.
- **Pemeriksaan (revisi 2).** Pada koreksi pertama, lebar dasar dihitung dari pusat semua base plate, termasuk base plate outrigger yang outrigger-nya sudah hilang. Kini kaki outrigger hanya dihitung bila **pipa outrigger berujung di base plate itu dan dijepit klem yang juga menjepit standard**. Uji paksa: kedelapan pipa outrigger dan kicker disembunyikan (base plate tetap) → rasio 5,10 / 1,20 = 4,25 : 1 dan butir stabilitas gagal. Hasil yang sama terjadi bila hanya empat klem kepala outrigger yang dilepas.
- **Sumber.** OSHA 1926.451(c)(1): rasio tinggi : lebar dasar (termasuk outrigger) > 4 : 1 wajib ditahan dari guling.
- **Catatan pengukuran.** Tinggi diukur sampai **titik tertinggi** (puncak standard). Ini pendekatan konservatif: surat interpretasi OSHA 2015 (ketentuan lain) mengukur sampai titik tertinggi, dan tabel pada surat 2004 memasukkan pagar ke "total height". Lihat §7.

### 2.8 Standard dan sambungan
- **Sebelum.** Keenam standard langsung setinggi penuh 5,2 m sejak tahap 3; sleeve di tahap 10 hanya tempelan visual.
- **Sesudah.** Panjang awal standard **berselang-seling** (2,20 m dan 4,15 m), lalu diperpanjang dengan sleeve di tahap 10 hingga 5,10 m. Sambungan dua standard yang bertetangga selalu berada pada lift yang berbeda (diperiksa otomatis).
- **Sumber.** Praktik baik. Detail jarak sambungan terhadap simpul belum diverifikasi terhadap TG20:21 (lihat §7).

### 2.9 Akses: tangga dan pintu yang menutup sendiri (ditulis ulang pada revisi 2)
- **Sebelum (aplikasi lama).** Tangga sejajar fasad di luar sisi belakang. Bukaan akses ±1 m sengaja dibiarkan terbuka ("akses TIDAK tertutup pipa").
- **Sebelum (koreksi pertama) — kesalahan yang ditemukan tinjauan.**
  - Tangga ke lantai atas "bersandar dan diikat pada top rail" di bukaan akses. Rail di bukaan itu adalah **rail penutup sementara** yang dilepas pada tahap yang sama (tahap 18). Ujung atas tangga bertumpu pada udara, 50 mm dari top bar pintu yang berayun.
  - Dua klem "ikat di top rail" hanya menjepit kaki tangga. Satu-satunya ikatan nyata adalah dua pipa sepanjang ±0,8 m dari ledger lift-1, sehingga ±3,1 m bagian atas tangga tidak tertahan.
  - Pemeriksaan "Tangga diikat" hanya menghitung objek (4 titik ikat ✓). Ikatan ledger dapat dihapus tanpa mengubah hasil.
  - Lantai lift-1, yang dipakai merakit lift-2 (tahap 13–17) dan tetap ada saat serah terima, **tidak memiliki akses**: pagarnya menerus di keempat sisi dan tangga baru dipasang di tahap 18.
- **Sesudah.** Pola akses mengikuti **NASC SG25:20 Gambar 6** (*External ladder using a safety gate*): tangga di luar perancah, **di samping** pintu, bersandar dan diikat pada pelindung tepi utama (*principal guard rail*).
  - **Dua titik akses**, satu untuk setiap lantai kerja, di sisi belakang:
    - lantai lift-1 di bay kanan, dipasang pada tahap 11 (pintu) dan 12 (tangga) — sebelum pekerjaan lift-2 dimulai;
    - lantai atas di bay kiri, dipasang pada tahap 16 (pintu) dan 18 (tangga).
  - **Pintu.**
    - Celah pelindung tepi berada di antara **dua puncheon** (lebar sumbu 0,60 m).
    - Daun pintu dengan engsel pegas dipasang **di sisi dalam rail** dan **menumpang 30 mm pada ujung rail tetap di kedua sisi**, sehingga pintu hanya dapat membuka ke dalam.
    - Top bar 1,0 m, mid bar 0,53 m, papan kaki 150 mm.
    - Pintu dipasang bersama pelindung tepi. Rail penutup sementara tidak diperlukan lagi.
  - **Tangga.**
    - Tangga bersandar pada **top rail yang tetap terpasang** di samping pintu. Rail ini diklem ke puncheon dan standard serta tidak pernah dilepas.
    - **Kedua kaki tangga diikat klem tangga pada rail itu.** Pusat klem berada di antara sumbu rail dan sumbu kaki tangga, di dalam panjang kedua pipa.
    - Ikatan ledger sepanjang 0,8 m ditiadakan. Pipa itu menonjol ke ruang panjat, sedangkan NASC hanya mensyaratkan kedua kaki diikat di bagian atas.
    - Kemiringan **4 : 1**: jarak kaki 24,3% panjang kerja, ±76°, diukur dari titik tumpu atas yang nyata.
    - Ujung atas **1,05 m** di atas lantai pendaratan.
    - Anak tangga dibagi rata sehingga **satu anak tangga sejajar lantai pendaratan** (jarak anak tangga 0,286 m untuk lantai atas dan 0,294 m untuk lift-1).
    - Kaki tangga berdiri di alas papan.
  - **Langkah ke lantai.** Langkah dari sumbu anak tangga setinggi lantai ke tepi lantai di celah pintu adalah **0,45 m (ke samping)** pada kedua lantai. Ini berada di dalam rentang 15–20 in (0,38–0,51 m) untuk tangga *side-step* pada OSHA 1910.23(d)(12)(ii). Ketentuan itu berlaku untuk tangga tetap di industri umum dan dipakai di sini **sebagai analogi**, bukan sebagai syarat mengikat.
  - **Bukaan bebas.** Di depan setiap pintu, ruang dari 0,10 m sampai 1,75 m di atas lantai bebas dari bracing dan batang lain. Batas 1,75 m mengikuti ruang bebas minimum ke transom atau batang pengikat untuk kelas H1 (EN 12811-1 butir 5.3, Tabel 2). Karena itu bay akses lift-1 tidak diberi diagonal fasad pada lift-2 (§2.6). Ledger lift-2 di atas pintu lift-1 berada 1,82 m di atas lantai (permukaan bawah pipa).
  - **Tag.** Tag merah dipasang di kaki tangga lift-1 sejak tahap 12 dan di kaki tangga lantai atas sejak tahap 18. Pada tahap 20 keduanya diganti tag hijau.
- **Alasan.**
  - OSHA 1926.1053(b)(6) mensyaratkan tangga diamankan dari pergeseran. Tumpuan atas yang menjadi dasar kemiringan 4 : 1 pada (b)(5)(i) harus ada secara fisik.
  - OSHA 1926.451(e)(1) mensyaratkan akses bila lantai kerja lebih dari 2 ft di atas titik akses. (e)(9)(i)–(ii) mensyaratkan akses aman bagi pemasang dan pemasangan tangga segera setelah perakitan memungkinkan.
  - NASC SG25:20 butir 5 dan 6.4: tangga eksternal untuk lift pertama dan kedua (≤ 4,7 m) dapat diterima dengan penilaian risiko. Tangga menonjol minimal 1,0 m dan diikat pada pelindung tepi utama. Pintu yang menutup sendiri tidak boleh dapat membuka ke luar dan harus cukup menumpang pada struktur tetap. Celah di pagar dan toe board dibuat sekecil mungkin.
  - NASC SG25:20 butir 6.6: kedua kaki tangga diikat di bagian atas, dan anak tangga di titik pendaratan sejajar lantai agar tidak terjadi "langkah palsu".
- **Sumber.** OSHA 1926.1053(b)(1), (b)(5)(i), (b)(6); OSHA 1926.451(e)(1), (e)(9); OSHA 1910.23(d)(12) (analogi); NASC SG25:20 butir 5, 6.4, 6.6 dan Gambar 6 (teks diperiksa dari salinan publik, lihat §8); PER.01/MEN/1980 Pasal 8 (lubang dan sisi terbuka diberi pagar atau tutup) dan Pasal 25 (tangga); Permenaker 9/2016 Pasal 24; EN 12811-1 5.5.1.
- **Catatan.** EN 12811-1 butir 5.8.1 menempatkan akses antartingkat di dalam lantai kerja, pada pelebaran satu bay, atau pada menara yang berdampingan. Pola tangga eksternal di atas mengikuti praktik Inggris (SG25:20) untuk perancah rendah. Pilihan pola akses diajukan ke Komite Teknis (§7 butir 12).

### 2.10 Base plate dan sole board
- **Sebelum.** Katalog menulis base plate "≥ 150 × 150 mm" dan sole board "≥ 220 mm lebar", keduanya tanpa sumber. Model sole board berukuran 450 × 400 mm.
- **Sesudah.**
  - Base plate 160 × 160 mm (256 cm²). Katalog menyebut syarat **luas ≥ 150 cm² dan lebar ≥ 120 mm**.
  - Sole board dimodelkan sebagai potongan papan 0,50 × 0,225 × 0,038 m. Katalog tidak lagi menyebut angka dan menyatakan bahwa ukurannya ditentukan oleh beban kaki dan daya dukung tanah.
- **Verifikasi sumber (revisi 2).**
  - Tinjauan tidak dapat menemukan sumber yang dapat diakses untuk butir 5.7.1.
  - Teks BS EN 12811-1:2003 telah diperiksa langsung. Butir 5.7.1 (*Base plates and base jacks — General*) mensyaratkan luas pelat ujung minimal 150 cm² dan lebar minimal 120 mm. Butir 5.7.2 mensyaratkan base plate baja sesuai EN 74.
  - Klaim katalog dipertahankan, dan katalog kini juga menyebut butir 5.7.2. Untuk base plate polos, seri EN 74 yang berlaku kini adalah EN 74-3; edisi mana yang menjadi acuan diajukan ke Komite Teknis (§7 butir 16).
- **Sumber.** BS EN 12811-1:2003 butir 5.7.1 dan 5.7.2; OSHA 1926.451(c)(2).

### 2.11 Tag status
- **Sebelum.** Tag hijau dipasang di tahap 20 sebagai bagian perakitan, sebelum inspeksi. Tag merah hanya ada di katalog.
- **Sesudah.**
  - **Tag merah** di barikade jalur akses sejak tahap 1, di kaki tangga lift-1 sejak tahap 12, dan di kaki tangga lantai atas sejak tahap 18.
  - **Tag hijau** di **kedua titik akses** hanya pada tahap 20, setelah tahap 19 (inspeksi serah terima) tercatat.
  - Tahap 19 **menolak** dicatat bila ada butir yang belum memenuhi. Uji paksa: satu toe board disembunyikan → pemeriksaan "pelindung tepi menerus" gagal dan tahap tidak maju.
  - Di tahap 20 semua tag merah dan barikade dilepas. Panel menampilkan status tag pada setiap tahap.
- **Sumber.** OSHA 1926.451(f)(3) (inspeksi oleh personel kompeten sebelum setiap giliran kerja), (f)(7) (perakitan di bawah pengawasan personel kompeten); WAHR 2005 reg. 12(2), (4), (10)(a) (diinspeksi di posisinya sebelum dipakai, oleh personel kompeten); Permenaker 9/2016 Pasal 31–32 (tenaga kerja kompeten dan berwenang). Warna tag mengikuti konvensi penandaan status lapangan (lihat §7).

### 2.12 Sambungan fisik (revisi 2)
- **Sebelum.**
  - Diagonal kedua silang X di setiap ujung (x = ±2,11 m) memiliki pusat klem 10 mm di luar ujung ledger (ledger berakhir di ±2,10 m): delapan klem tanpa pipa yang dijepit.
  - Pipa outrigger, pengikat kaki, dan bracing berakhir tepat di pusat klem.
  - Klem toe board di standard sudut tidak menyentuh toe board.
- **Sesudah.**
  - Ledger diperpanjang sampai ±2,20 m.
  - Pipa bracing, outrigger, pengikat kaki, rail, dan puncheon menonjol 40–100 mm melewati klemnya.
  - Klem toe board dipasang pada papan (§2.2).
  - Pemeriksaan mandiri pada uji otomatis: **setiap klem menjepit ≥ 2 batang di dalam panjang pipanya** (pusat klem ≥ 36 mm dari ujung pipa) dan **tidak ada pipa yang saling menembus**, kecuali abstraksi simpul yang disengaja: ledger/puncheon pada sumbu standard, sleeve yang membungkus standard, dan dua diagonal fasad yang bertemu di satu simpul.
- **Hasil.** 160 klem pada menara lengkap, 0 klem longgar pada ke-20 tahap, dan 0 pipa yang saling menembus (`devtools/flows/fix-sim-verify.mjs` bagian B).

---

## 3. Urutan baru (20 tahap)

| No | Tahap baru | Pokok | Acuan utama | Tahap lama |
|---|---|---|---|---|
| 1 | Persiapan: rencana, material, zona eksklusi, tag merah | rencana & pengawas kompeten, periksa/pisahkan komponen rusak, tanah rata & kokoh, barikade, tag merah | OSHA 451(f)(7), (f)(4), (c)(2); Permenaker Pasal 31–32; PER.01/MEN/1980 Pasal 7 (benda jatuh), **10** (orang tidak berkepentingan dilarang masuk), 21 (pipa logam kuat, terlindung dari karat dan cacat) | **baru** |
| 2 | Sole board dan base plate | 6 titik, base plate di tengah | OSHA 451(c)(2); EN 12811-1 5.7.1 | 1 + 2 |
| 3 | Standard dengan panjang awal berselang-seling | 2,20 / 4,15 m, segera dikunci | NA Tabel NA.1 | 3 |
| 4 | Ledger dasar sedekat mungkin ke base plate | +0,15 m, datar | OSHA 452(b)(8) | 4 |
| 5 | Transom dasar dan kesikuan | di atas ledger dekat standard; uji dua diagonal | OSHA 452(b)(5) | 5 |
| 6 | Ledger lift-1 (+1,95 m) | ≤ 1,98 m | OSHA App. A; 452(b)(7)–(8) | 7 |
| 7 | Transom lift-1 | di atas ledger | OSHA 452(b)(5)–(6) | 8 |
| 8 | Bracing lift-1 | fasad 2 sisi, setiap bay, 2 arah (kriteria aplikasi); X di ujung | OSHA 452(b)(2)–(3); App. A | 6 (dipecah) |
| 9 | Outrigger sebelum tinggi > 4 × lebar dasar | 4 penopang dijepit klem putar pada standard sudut + pengikat kaki | OSHA 451(c)(1) | 13 (dimajukan) |
| 10 | Perpanjang standard dengan sleeve | sambungan selang-seling | praktik baik (TG20:21) | 10 |
| 11 | Pelindung tepi lift-1 dari posisi terlindungi | top rail 1,0 m, mid rail 0,53 m **sebelum** lantai dinaiki; puncheon + pintu menutup sendiri (bay kanan); harness + **tali pembatas gerak** bila belum ada perlindungan kolektif | Permenaker Pasal 24–25; PER.01/MEN/1980 Pasal 13(2); EN 12811-1 5.5; SG4:22; SG25:20 | 17–18 (dimajukan) |
| 12 | Lantai lift-1 **dan tangga aksesnya** | putlog, papan, toe board; tangga 4 : 1 diikat di top rail; tag merah | BS 2482:2009; TG12; OSHA 451(b)(1), (b)(4), (e)(1), (e)(9), (h)(4); OSHA 1053(b); SG25:20 | 9 (diganti) + 19 |
| 13 | Ledger lift-2 (+3,90 m) | dari lantai lift-1 yang terlindungi dan **dapat dicapai** | OSHA App. A; 452(b)(7) | 11 |
| 14 | Transom lift-2 | di atas ledger | OSHA 452(b)(5)–(6) | 12 (dikoreksi) |
| 15 | Bracing lift-2 | sebelum lantai atas; bay akses lift-1 (sisi belakang, bay kanan) dibiarkan bebas, dibracing di sisi depan | OSHA 452(b)(2)–(3); OSHA 451(e)(1); SG25:20 6.4 | 6 (dipecah) |
| 16 | Pelindung tepi lantai atas (advance guardrail) | dipasang dari lift-1; puncheon + **pintu menutup sendiri** (bay kiri); rail di samping pintu tetap utuh | SG4:22; SG25:20; Permenaker Pasal 24; OSHA 451(g)(4) | 17–19 (dimajukan) |
| 17 | Lantai kerja atas: putlog, papan, toe board | seperti tahap 12 | BS 2482; TG12; OSHA 451(b), (h)(4) | 14 + 15 + 19 |
| 18 | Tangga akses lantai atas | 4 : 1, bersandar & **kedua kaki diikat pada top rail yang tetap**, menonjol 1,05 m; tag merah di kaki tangga | OSHA 1053(b)(1), (b)(5)(i), (b)(6); SG25:20 butir 5, 6.4, 6.6; PER.01/MEN/1980 Pasal 25 | 20 (dipecah) |
| 19 | Inspeksi serah terima oleh personel kompeten | 26 butir harus memenuhi | OSHA 451(f)(3); WAHR reg. 12 | **baru** |
| 20 | Ganti tag merah dengan tag hijau | tag hijau di kedua titik akses, barikade dilepas | OSHA 451(f)(3) | 20 (dipecah) |

**Dihapus:** tahap lama 16 "Bongkar lantai kerja sementara". Lantai lift-1 kini memenuhi syarat (pagar dipasang lebih dulu, bentang ≤ 1,2 m, toe board, akses sendiri) dan dipertahankan karena akan dipakai lagi saat pembongkaran dengan urutan terbalik (lihat §7). Rail penutup sementara di bukaan akses (koreksi pertama, tahap 16–18) juga dihapus karena pintu kini dipasang bersama pelindung tepi.

**Kemajuan tersimpan.** Kemajuan latihan memuat versi urutan (`seq`). Kemajuan dari urutan lama tidak dapat dipetakan ke urutan baru, sehingga anggota mendapat catatan "Urutan perakitan telah diperbarui (Oktober 2026)…" dan memulai dari tahap 1. Riwayat katalog dan alat ukur tetap tersimpan. Revisi 2 tidak mengubah daftar dan arti ke-20 tahap, sehingga versi urutan tetap `tc-2026.10-r2` dan kemajuan yang sudah tersimpan tetap berlaku.

---

## 4. Mode inspeksi yang benar-benar mengukur

- **Sebelum.**
  - Label tetap "Tegak ✓", "Datar ✓", "Siku 90° ✓", dan "Light duty — AS 4576", tanpa pengukuran apa pun.
  - Tab inspeksi selalu menampilkan struktur lengkap, berapa pun tahap yang sudah dipasang.
- **Koreksi pertama.**
  - Tab inspeksi menampilkan **hanya komponen yang sudah terpasang**.
  - Fungsi `evaluate()` mengukur mesh yang benar-benar ada di adegan:
    - ujung pipa dihitung dari matriks dunia dan panjang geometri;
    - papan dan toe board diukur dari kotak batasnya;
    - setiap komponen membawa *role* (standard, ledger, transom, putlog, board, toeboard, rail-top, rail-mid, brace, outrigger, gate, tag, dll.).
  - Status di panel: **"Jangan digunakan"** atau **"Boleh digunakan"**, disertai jumlah butir yang memenuhi.
  - Enam alat ukur menampilkan garis dan label nilai terukur di adegan 3D: kelurusan, kedataran, dimensi, kesikuan, pelindung tepi, dan stabilitas. Label berakhir ✓ atau ✗ sesuai hasil ukur.
- **Kelemahan koreksi pertama (ditemukan tinjauan).** Klaim "24 butir diukur dari model" tidak sepenuhnya benar:
  - stabilitas menghitung base plate outrigger walaupun outrigger-nya hilang;
  - "Tangga diikat" menghitung objek, bukan sambungan;
  - "Pintu akses" membaca bendera `closed` dan `selfClosing` yang ditulis tetap di kode.
- **Sesudah (revisi 2).**
  - **Stabilitas:** kaki outrigger hanya dihitung bila outrigger tersambung (§2.7).
  - **Tangga:** tumpuan atas dicari dari kontak geometris kaki tangga dengan batang struktural yang terpasang. Ikatan dihitung hanya bila klem menjepit kaki tangga **dan** batang tumpuan itu di dalam panjang pipanya. Kemiringan dihitung dari tumpuan atas yang nyata. Langkah ke lantai diukur.
  - **Pintu:** "tertutup" berarti daun pintu menumpang ≥ 20 mm pada rail tetap di kedua sisi celah. "Membuka ke dalam" berarti seluruh daun berada di sisi dalam rail. Kedua sifat ini diukur. Hanya sifat "menutup sendiri" yang diperiksa dari jenis komponen (engsel pegas).
  - **Butir baru:** "Akses aman ke setiap lantai kerja" dan "Perancah sesuai rencana pemasangan" (jumlah lantai kerja dan level ledger sesuai rencana; OSHA 1926.451(a)(6)).
  - Setiap butir di panel kini menyebut **cara pemeriksaannya**: "Diukur dari model", "Diukur dari model; sifat menutup sendiri diperiksa dari jenis komponen", atau "Diperiksa dari jenis/keberadaan komponen". Catatan di panel menyebut jumlahnya: **24 diukur, 1 diukur sebagian, 1 diperiksa**.

| Kelompok | Butir (26) | Syarat yang diperiksa | Cara | Acuan |
|---|---|---|---|---|
| Dasar & rangka | Perancah sesuai rencana pemasangan | 2 lantai kerja (+2,06 / +4,01 m), 3 level ledger | diukur | OSHA 451(a)(6) |
| | Sole board & base plate di bawah setiap standard | 6/6 | diukur | OSHA 451(c)(2) |
| | Ukuran base plate | ≥ 150 cm², lebar ≥ 120 mm | diukur | EN 12811-1 5.7.1 |
| | Standard tegak | ≤ 20 mm per 2 m, total ≤ 50 mm | diukur | BS EN 12811-1 NA Tabel NA.1 |
| | Ledger datar | ≤ 20 mm per 2 m | diukur | NA Tabel NA.1 |
| | Jarak tiang | ≤ 3,05 m × 1,22 m | diukur | OSHA App. A (pedoman) |
| | Ledger terbawah & lift | terbawah ≤ 0,30 m\*; lift ≤ 1,98 m | diukur | OSHA 452(b)(8); App. A |
| | Kesikuan | dua diagonal tiap bay sama (selisih ≤ 1 mm\*) | diukur | prinsip geometri |
| | Sambungan standard | bertetangga tidak pada lift yang sama | diukur | praktik baik (TG20:21) |
| Bracing & stabilitas | Bracing fasad | setiap lift, 2 sisi, setiap bay, 2 arah\*; bay akses lantai di dasar lift dibiarkan bebas (sisi seberang tetap dibracing) | diukur | OSHA 452(b)(3) (dua arah, dekat simpul); pola per lift: kriteria aplikasi |
| | Sudut bracing fasad | 40–50° | diukur | OSHA App. A |
| | Silang X di ujung | setiap lift, kedua ujung | diukur | OSHA 452(b)(2) |
| | Rasio tinggi : lebar dasar | ≤ 4 : 1 (hanya outrigger yang tersambung) | diukur | OSHA 451(c)(1) |
| Lantai kerja | Lantai penuh & rapat | celah ≤ 25 mm | diukur | OSHA 451(b)(1); PER.01/MEN/1980 Pasal 13(1) |
| | Bentang papan | ≤ 1,2 m | diukur | BS 2482:2009; OSHA App. A |
| | Ujung papan | ≥ 50 mm dari muka tumpuan, ≤ 152 mm dari sumbu, dikunci | diukur | NASC TG12; SG25:20 4.1; OSHA 451(b)(4) |
| Pelindung tepi | Tinggi top rail | ≥ 1,0 m dan ≤ 1,143 m | diukur | Permenaker Pasal 24a; EN 12811-1 5.5.2; OSHA 451(g)(4)(ii) |
| | Celah vertikal | ≤ 470 mm | diukur | Permenaker Pasal 24c; EN 12811-1 5.5.3; WAHR Sch. 2 |
| | Toe board | ≥ 150 mm | diukur | EN 12811-1 5.5.4; Permenaker Pasal 24d; OSHA 451(h)(4)(ii) |
| | Kelengkapan keliling | top rail, mid rail, toe board di 4 sisi (daun pintu yang tertutup dihitung) | diukur | OSHA 451(g)(4)(i); EN 12811-1 5.5.1 |
| | Jarak toe board ke pagar | ≤ 80 mm | diukur | EN 12811-1 5.5.6 |
| Akses & status | Tangga akses | jarak kaki 22–28% panjang kerja\*; menonjol ≥ 0,9 m; langkah ke lantai 0,38–0,51 m (samping) atau 0,18–0,30 m (lurus)\* | diukur | OSHA 1053(b)(5)(i), (b)(1); SG25:20 6.4; OSHA 1910.23(d)(12) (analogi) |
| | Tangga bertumpu dan diikat di atas | tumpuan pada batang tetap; kedua kaki diikat klem pada batang itu | diukur | OSHA 1053(b)(6); SG25:20 6.6 |
| | Akses aman ke setiap lantai kerja | setiap lantai: tangga + pintu; bukaan bebas 0,10–1,75 m di atas lantai | diukur | OSHA 451(e)(1), (e)(9); SG25:20 5, 6.4; EN 12811-1 5.3, 5.8 |
| | Pintu akses | tertutup & menumpang pada rail tetap, membuka ke dalam, top bar ≥ 1,0 m, papan kaki ≥ 150 mm; menutup sendiri | diukur + jenis komponen | SG25:20 6.4; Permenaker Pasal 24; EN 12811-1 5.5; PER.01/MEN/1980 Pasal 8 |
| | Tag status | merah selama perakitan; hijau hanya setelah inspeksi | diperiksa | OSHA 451(f)(3); WAHR reg. 12 |

\* **Kriteria aplikasi**, bukan nilai standar. Angka ini hanya batas pembulatan atau pola untuk model ideal dan perlu ditetapkan Komite Teknis (§7). OSHA hanya menyebut "approximately one-quarter" untuk tangga dan "as close to the base as possible" untuk ledger terbawah. Rentang langkah ke lantai diambil dari ketentuan tangga tetap industri umum (OSHA 1910.23(d)(12)) sebagai analogi.

**Uji paksa (state 18/20, semua harus gagal pada butir yang tepat):** pipa outrigger + kicker disembunyikan → stabilitas; klem kepala outrigger dilepas → stabilitas; klem tangga dilepas → tangga diikat; top rail di belakang tangga disembunyikan → tangga diikat (tanpa tumpuan atas); pintu lantai atas disembunyikan atau digeser ke luar rail → pintu; tangga lift-1 disembunyikan → akses; diagonal ditambahkan melintang di depan pintu lift-1 → akses (bukaan terhalang); ditambah standard miring 3°, putlog dilepas, top rail diturunkan 80 mm, klem papan dilepas, satu bracing dilepas, dan perpanjangan standard dilepas. Semuanya tercatat di `devtools/flows/fix-sim-verify.mjs` bagian C.

---

## 5. Perbaikan antarmuka dan ketahanan

Butir B1–B13 dari analisis sudah diperbaiki saat porting (`CATATAN.md` §5.2) dan **diuji ulang** pada versi ini. Butir yang **ditambah atau diubah** dalam koreksi ini:

| Butir | Sebelum | Sesudah |
|---|---|---|
| Daftar cek di kartu tahap | tanda ✓ tetap pada setiap butir | kotak kosong (butir *yang harus diperiksa*), ditambah baris **Acuan** per tahap |
| Material & geometri | setiap pipa dan klem membuat material sendiri (548 material) | material dan geometri dipakai bersama. Menara lengkap (20/20) memakai **84 material unik** di seluruh adegan, termasuk model katalog yang dimuat, figur pekerja, dan objek bantu (diukur 9 Oktober 2026). Koreksi pertama menulis "70 material unik pada menara lengkap"; angka itu sebenarnya diukur pada tahap 5/20 dan **tidak benar** untuk menara lengkap (tinjauan mengukur 83 sebelum revisi 2; satu material ditambah untuk pita klem tangga). Geometri tidak bertambah setelah 48 pergantian model katalog, 96 kali sakelar overlay, dan 10 siklus mundur/pasang |
| Biaya gambar | bayangan dihitung ulang setiap frame | 0 frame saat diam; bayangan hanya dihitung ulang saat isi adegan berubah. Baut kecil pada klem menara dihapus; baut tetap ada di model katalog |
| Tombol tahap | dapat berada di bawah lipatan panel | baris tombol menempel di dasar panel pada semua ukuran layar; kepala panel diringkas pada ponsel lanskap |
| Notifikasi | di tengah jendela (menimpa panel pada tablet/lanskap) | di tengah area adegan |
| Label "Bongkar 1 tahap" | terbungkus dua baris | "↶ Bongkar" (label aksesibel: "Bongkar satu tahap") |
| Cara pemeriksaan (revisi 2) | panel menyiratkan semua butir "diukur" | setiap butir menampilkan cara pemeriksaannya; catatan panel menyebut jumlah butir yang diukur dan yang diperiksa |
| Tema antarmuka (11 Oktober 2026) | kerangka terang terpisah dari tema situs | kerangka diselaraskan dengan tema situs PPAPI: adegan 3D berlatar grafit/baja (lantai, kisi, dan lampu studio netral), panel kertas, tipografi dan tombol situs. **Hanya tampilan**: geometri, urutan 20 tahap, warna fungsional di adegan (pita klem, tag merah/hijau, garis alat ukur, sorotan komponen berikutnya), dan mesin inspeksi tidak berubah — `aplikasi-simulator-flow` 98/98 dan `fix-sim-verify` 69/69 lulus ulang |
| Pesan cadangan | tombol "Muat ulang halaman" ikut tampil pada pesan tanpa WebGL walau `hidden` (gaya `.btn` menimpa atribut) | tombol hanya tampil bila berguna (pustaka gagal dimuat / gagal mulai); pesan bergaya `.alert` situs |

---

## 6. Verifikasi (9 Oktober 2026, revisi 2)

| Perintah (dari `devtools/`) | Hasil |
|---|---|
| `node flows/fix-sim-verify.mjs` (baru) | **69/69 lulus**. Bagian A: pelindung tepi per sisi, tangga, akses, dan bukaan bebas pada ke-20 tahap. Bagian B: sambungan fisik. Bagian C: 14 uji paksa. Bagian D: teks dan panel. Bagian E: tangkapan layar `shots/fixsim-*.png` |
| `node flows/aplikasi-simulator-flow.mjs` | **98/98** (uji rilis 10 Oktober 2026). Pada revisi 2 hasilnya 97/98: asersi lama "hanya **satu** tag hijau" (`fin.tags.join() === 'green'`) gagal karena kini ada tag hijau di **kedua** titik akses; asersi itu telah disesuaikan pada uji rilis |
| `node flows/aplikasi-flow.mjs --only=D,E` | **72/72 lulus** (axe 0 serius/kritis) |
| `node check.mjs aplikasi/simulator/index` dengan: tanpa sesi, `--auth`, `--admin`, `--auth --status=` Draf / Kedaluwarsa / Nonaktif | **0 isu** pada keenam kondisi (desktop + ponsel) |
| `node flows/verify-eng-simulator.mjs` (alat tinjauan) | **43/43** (uji rilis 10 Oktober 2026). Pada revisi 2 hasilnya 31/42: sebelas pemeriksaan memuat asumsi desain lama yang diubah dalam revisi ini, sebagian besar atas rekomendasi tinjauan sendiri — top rail 1,000 m di semua sisi (kini 1,075 m di sisi ujung, §2.2); celah 0,356/0,398 di semua sisi (sisi ujung 0,431/0,398); ujung papan 70 mm (kini 90 mm dari sumbu, §2.3); 8 diagonal fasad (kini 7, §2.6); mutasi "ikatan ledger" (ikatan ledger ditiadakan, §2.9); jumlah material (kini 84, §5); serta lubang pagar dan ruang bebas lift-1 yang membaca daun pintu (93 mm dari garis standard) sebagai lubang/penghalang. Pada uji rilis, nilai acuan alat itu diturunkan ulang dengan tangan dari dimensi revisi 2 (tidak dibaca dari adegan): celah pagar dinyatakan tertutup hanya bila daun pintu menumpang ≥ 30 mm pada kedua ujung rail tetap; ruang bebas diukur di atas jalur kerja (pelindung tepi di sepanjang tepi lantai bukan batang di atas kepala) = 1,864 m ke transom lift-2; ruang bebas di atas bukaan pintu lift-1 = 1,816 m ke ledger lift-2 (≥ 1,75 m, kelas H1); melepas klem tangga pada top rail membuat butir "Tangga diikat" gagal |

Nilai yang diukur langsung dari adegan, terpisah dari `evaluate()` aplikasi dan sama dengan hasilnya:

| Ukuran | Hasil |
|---|---|
| Top rail di atas lantai | 1,000 m (sisi panjang) dan 1,075 m (sisi ujung) pada lantai +2,060 m dan +4,010 m |
| Celah bersih terbesar | 0,398 m (sisi panjang), 0,431 m (sisi ujung) |
| Toe board | 150 mm; jarak toe board ke rail maks. 15 mm |
| Bentang papan | maks. 0,98 m |
| Ujung papan | 90 mm dari sumbu, 66 mm dari muka transom ujung |
| Sudut bracing fasad | 42,0° / 44,3° |
| Rasio tinggi : lebar dasar | ≤ 4 : 1 pada **setiap** tahap; 1,59 : 1 di akhir |
| Tangga (lift-1 dan lantai atas) | bertumpu pada top rail (celah kontak 0 mm), 2/2 kaki diikat, jarak kaki 24,3%, menonjol 1,05 m, langkah ke samping 0,45 m |
| Akses | lantai lift-1 dapat dicapai sejak tahap 12 dan pada setiap tahap kerja sesudahnya; lantai atas sejak tahap 18; tidak ada batang di depan kedua pintu 0,10–1,75 m di atas lantai |
| Klem | 160 klem, semuanya menjepit ≥ 2 batang di dalam panjang pipa |

**Catatan untuk pemelihara `devtools/flows/aplikasi-simulator-flow.mjs` (di luar lingkup berkas aplikasi; telah dikerjakan pada uji rilis 10 Oktober 2026).** Pada bagian A, ganti `fin.tags.join() === 'green'` dengan `fin.tags.length >= 1 && fin.tags.every(t => t === 'green')` dan perbarui labelnya menjadi "self-closing gates in place, only green tags visible (one per access point)". Mutasi tambahan dari tinjauan (outrigger tanpa sambungan, ikatan tangga, pintu) sudah tercakup di `flows/fix-sim-verify.mjs` bagian C dan dapat disalin ke flow itu.

Tangkapan layar: `devtools/shots/apl-sim-koreksi-*.png` (koreksi pertama) dan `devtools/shots/fixsim-*.png` (revisi 2).

---

## 7. Pertanyaan terbuka untuk Komite Teknis PPAPI

1. **Acuan nasional.**
   - Permenaker 9/2016 Pasal 15(2) merujuk persyaratan K3 perancah ke "ketentuan peraturan perundang-undangan". PER.01/MEN/1980 Bab III tidak memuat angka geometri.
   - Standar mana yang ditetapkan PPAPI sebagai acuan pelatihan untuk tinggi pagar, bentang papan, dan toleransi: BS EN 12811-1, TG20, atau SNI tertentu?
2. **Konfigurasi ilustrasi.**
   - Apakah bay 2,0 m × lebar 1,2 m × lift 1,95 m disetujui?
   - Perlukah diselaraskan dengan contoh Aplikasi Perencanaan (4 bay × 2,4 × 1,2 m)?
3. **Tinggi top rail.**
   - PPAPI menganjurkan 1,0 m (EN 12811-1) atau cukup minimum 950 mm (Permenaker)? Model memakai 1,0 m.
   - Rail dipasang di muka dalam standard, dan rail sisi ujung 75 mm lebih tinggi karena rail bersilang di sudut. Apakah konvensi ini disetujui, atau PPAPI mengajarkan kebalikannya (rail sisi panjang 1,075 m, sisi ujung 1,0 m)?
4. **Mid rail.** Satu mid rail pada 0,53 m, atau dua rail tengah (praktik sebagian kontraktor)?
5. **Kekuatan pagar 0,9 kN** (Pasal 24b) tidak dapat dibuktikan oleh model visual. Perlukah catatan uji atau sertifikat komponen di materi pelatihan?
6. **Batas stabilitas menara bebas.**
   - Aplikasi memakai 4 : 1 OSHA dengan tinggi sampai titik tertinggi.
   - Apakah PPAPI menetapkan batas lain untuk menara statis (misalnya menurut TG20) atau mempertimbangkan beban angin?
7. **Outrigger.**
   - Jarak kaki 1,0 m, persilangan dengan standard sudut pada +1,80 m, dan pengikat kaki pada +0,30 m bersifat ilustratif dan memerlukan desain.
   - Perlukah alternatif *tie* ke bangunan ditampilkan sebagai varian?
8. **Lantai lift-1.**
   - Dipertahankan untuk pembongkaran, atau dibongkar setelah lantai atas selesai?
   - Ruang bebas ke transom lift-2 1,86 m memenuhi kelas H1 EN 12811-1 (≥ 1,75 m), tetapi tidak H2 (≥ 1,90 m).
   - Akses lift-1 kini dimodelkan (tangga + pintu sejak tahap 12, OSHA 1926.451(e)(9)). Apakah urutannya — pintu bersama pelindung tepi di tahap 11, tangga bersama lantai di tahap 12 — sesuai praktik yang diajarkan PPAPI?
9. **Bracing.**
   - Rentang "35–55°" di aplikasi lama tidak dapat diverifikasi dari teks TG20. Model memakai 45° ± 5° (OSHA App. A).
   - Untuk perancah yang lebih pendek daripada tingginya, OSHA 1926.452(b)(3) secara harfiah meminta diagonal dari dasar tiang ujung ke tiang ujung yang berseberangan, lalu berganti arah sampai puncak. Model memakai pola "∧" per lift agar bracing dipasang bertahap. Pola mana yang diajarkan PPAPI?
   - Bracing X ujung dipasang setiap lift (OSHA (b)(2) mensyaratkan minimal setiap runner keempat).
   - Bay akses lift-1 pada lift-2 dibiarkan tanpa diagonal fasad di sisi belakang dan hanya dibracing di sisi depan. Apakah PPAPI menerima pengecualian ini, atau mensyaratkan akses lift-1 lewat *ladder trap* internal (SG25:20 Gambar 7) agar semua bay tetap dibracing di kedua sisi?
   - Mohon konfirmasi konvensi PPAPI.
10. **Sambungan standard.** Jarak sleeve dari simpul (model 0,25 m) dan aturan selang-seling perlu diverifikasi terhadap TG20:21.
11. **Papan.**
    - Panjang 3,9 m dengan klem papan sebagai "penahan" sehingga ujung 90 mm dari sumbu dapat diterima menurut OSHA 1926.451(b)(4); TG12 meminta 50–152 mm tanpa menyebut titik acuan. Model kini mengukur batas bawah dari muka tumpuan.
    - Rujukan kelas papan BS 2482:2009 berasal dari ringkasan sekunder; mohon verifikasi dengan teks standar atau NASC TG05:24.
12. **Pola akses dan pintu tangga.**
    - Model mengikuti NASC SG25:20 Gambar 6: tangga eksternal di samping pintu, bersandar dan diikat pada pelindung tepi utama, satu tangga untuk setiap lantai.
    - EN 12811-1 butir 5.8.1 menempatkan akses di dalam lantai kerja, pada pelebaran satu bay, atau pada menara yang berdampingan. Apakah PPAPI mengajarkan tangga eksternal untuk menara rendah, atau akses internal dengan *ladder trap* (SG25:20 Gambar 7)?
    - Mohon tetapkan spesifikasi pintu (lebar bukaan, arah buka, tumpang pada rail tetap, papan kaki) dan apakah pintu wajib pada setiap bukaan akses.
13. **Konvensi tag.** Merah dan hijau dipakai di simulator, satu tag di setiap titik akses. Apakah PPAPI memakai tiga warna (mis. kuning untuk "boleh dengan syarat") dan format isi tag tertentu?
14. **Kriteria aplikasi** (§4, bertanda \*):
    - ledger terbawah ≤ 0,30 m;
    - selisih diagonal ≤ 1 mm;
    - jarak kaki tangga 22–28% panjang kerja;
    - langkah ke lantai 0,38–0,51 m untuk langkah ke samping dan 0,18–0,30 m untuk langkah lurus (analogi OSHA 1910.23(d)(12));
    - pola bracing per lift.

    Kriteria ini perlu ditetapkan atau diganti.
15. **Kelanjutan.**
    - Mesin inspeksi kini siap untuk **mode tantangan**: cacat acak yang harus ditemukan peserta.
    - Selain cacat sederhana (toe board hilang, mid rail hilang, standard miring), mesin kini juga mendeteksi outrigger yang tidak tersambung, tangga tanpa tumpuan atau ikatan, dan pintu yang tidak menumpang pada rail tetap.
    - `InstancedMesh` dapat menurunkan draw call lebih jauh.
    - Keduanya diusulkan untuk fase berikutnya.
16. **Edisi standar.**
    - Butir EN 12811-1 yang dikutip berasal dari BS EN 12811-1:2003 beserta Lampiran Nasional Inggris. Mohon konfirmasi edisi yang berlaku bagi PPAPI.
    - Untuk base plate polos, seri EN 74 kini dipecah (EN 74-3). Mohon tetapkan acuan yang dipakai.

> Catatan untuk pemelihara `CATATAN.md`: §5 (*"urutan, geometri, dan teks teknis tahap perakitan TIDAK diubah"*) dan butir simulator di §6 kini digantikan oleh dokumen ini.

---

## 8. Sumber

- Permenaker No. 9 Tahun 2016 tentang K3 dalam Pekerjaan pada Ketinggian (BN 2016 No. 386): Pasal 12, 15, 24, 25 (perangkat pencegah jatuh perorangan: *full body harness* dan tali pembatas gerak), 27 (penahan jatuh perorangan ≥ 15 kN), 31–32, 35 — https://peraturan.bpk.go.id/Details/146109/permenaker-no-9-tahun-2016
- Permenakertrans PER.01/MEN/1980 tentang K3 pada Konstruksi Bangunan: Pasal 7 (benda jatuh), 8 (sisi dan lubang terbuka diberi pagar atau tutup), 10 (orang yang tidak berkepentingan dilarang memasuki tempat kerja), 13, 21, 25 — https://temank3.kemnaker.go.id/public/media/files/20210725204520.pdf
- OSHA 29 CFR 1926.451 (persyaratan umum perancah; termasuk (a)(6), (b)(4), (c)(1), (e)(1), (e)(9), (f)(3), (f)(7)) — https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.451
- OSHA 29 CFR 1926.452(b) (tube & coupler; teks (b)(2)–(8) diperiksa) — https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.452
- OSHA 1926 Subpart L Appendix A (pedoman, tidak mengikat) — https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926SubpartLAppA
- OSHA 29 CFR 1926.1053 (tangga) — https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.1053
- OSHA 29 CFR 1910.23(d)(12) (jarak langkah tangga tetap; dipakai sebagai analogi) — https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.23
- Surat interpretasi OSHA tentang pengukuran tinggi — https://www.osha.gov/laws-regs/standardinterpretations/2004-03-10-0 dan https://www.osha.gov/laws-regs/standardinterpretations/2015-10-19-1
- UK Work at Height Regulations 2005, Schedule 2 — https://www.legislation.gov.uk/uksi/2005/735/schedule/2/made ; reg. 12 — https://www.legislation.gov.uk/uksi/2005/735/regulation/12/made
- BS EN 12811-1:2003 *Temporary works equipment — Scaffolds — Performance requirements and general design*: butir 5.3, 5.5, 5.7.1–5.7.2, 5.8, dan Lampiran Nasional Inggris Tabel NA.1 (teks diperiksa langsung) — https://knowledge.bsigroup.com/products/temporary-works-equipment-scaffolds-performance-requirements-and-general-design
- BS 2482:2009 (papan perancah kayu): ringkasan kelas tumpuan 1,2 m / 1,5 m — https://www.buildersmerchantsnews.co.uk/news/trade-bodies/john-brash-supports-updated-standards ; NASC TG05:24 *Timber scaffold boards – BS 2482:2009* (halaman produk; isi belum diperiksa) — https://nasc.org.uk/product/tg05-24-timber-scaffold-boards-bs-2482-2009-digital-download-pdf-format.html
- NASC TG12 *Tying down of scaffold boards*: edisi TG12:17 yang semula dikutip tidak lagi tersedia daring (tautan PDF lama mengembalikan 404 pada 9 Oktober 2026); edisi berlaku TG12:22 (halaman produk; isi belum diperiksa) — https://nasc.org.uk/product/tg12-22.html
- NASC SG4:22 *Preventing Falls in Scaffolding Operations* (halaman produk; tautan PDF lama mengembalikan 404 pada 9 Oktober 2026) — https://nasc.org.uk/product/sg04-22-preventing-falls-in-scaffolding-operations.html ; ringkasan sekunder tentang pemasangan pagar sebelum lift dinaiki — https://squote.app/knowledge/scaffolding/scaffold-edge-protection
- NASC SG25:20 *Access and Egress from Scaffolding, via Ladders and Stair Towers etc.* (Mei 2020): butir 4.1, 5, 6.4, 6.6, Gambar 6 dan 7. Teks diperiksa dari salinan publik — https://www.hbf.co.uk/documents/10412/NASC_SG25-20-Access-and-Egress-from-Scaffolding-FINAL.pdf ; halaman produk — https://nasc.org.uk/product/sg25-20.html
- Analisis aplikasi lama: `devtools/legacy/ANALISIS_SIMULATOR.md`; riset regulasi proyek: `devtools/research/regulasi.json`

---

## 9. Tindak lanjut tinjauan teknik (revisi 2)

| Temuan tinjauan | Tindak lanjut | Bagian |
|---|---|---|
| Ujung atas tangga bersandar dan "diikat" pada rail penutup yang dilepas pada tahap yang sama; inspeksi tetap lulus | Tangga bersandar pada top rail tetap di samping pintu; kedua kaki diikat pada rail itu; inspeksi mengukur kontak dan klem | §2.9, §4 |
| Tidak ada akses ke lantai lift-1 selama tahap 13–17 dan saat serah terima | Pintu lift-1 di tahap 11, tangga lift-1 di tahap 12; butir "akses aman ke setiap lantai kerja" | §2.9, §3, §4 |
| Inspeksi lulus palsu: outrigger, ikatan tangga, bendera pintu | Outrigger harus tersambung; ikatan diukur dari sambungan; pintu diukur; cara pemeriksaan tiap butir ditampilkan | §2.7, §4 |
| OSHA 1926.452(b)(3)–(4) dikutip untuk pola bracing yang tidak ditetapkannya | (b)(4) tidak dikutip lagi; pola per lift diberi label kriteria aplikasi; pertanyaan ke Komite | §2.6, §7 butir 9 |
| Ujung papan 70 mm diukur dari sumbu; hanya 46 mm dari muka pipa | Transom ujung ke ±1,86 m: 90 mm dari sumbu, 66 mm dari muka; dasar ukur dinyatakan | §2.3 |
| Sambungan yang tidak dapat dibangun: rail sudut, klem silang X, klem toe board, ujung pipa | Rail di muka dalam standard dan sisi ujung +75 mm; ledger ±2,20 m; klem toe board pada papan; pipa menonjol melewati klem; pemeriksaan mandiri sambungan | §2.2, §2.5, §2.12 |
| Tautan NASC mati, butir base plate EN 12811-1 belum terbukti, Pasal 25 dan Pasal 10, jumlah material | Tautan NASC diperbarui atau ditandai belum diperiksa; teks EN 12811-1 5.7.1 diperiksa langsung (klaim benar); teks tahap 11 mengikuti Pasal 25 (tali pembatas gerak); Pasal 10 ditambahkan; jumlah material dikoreksi menjadi 84 | §2.10, §3, §5, §8 |
