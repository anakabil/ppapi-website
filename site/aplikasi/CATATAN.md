# Aplikasi Anggota PPAPI — Catatan Porting & Pemeliharaan

Folder `aplikasi/` berisi dua aplikasi milik PPAPI yang kini menjadi **aset khusus anggota berstatus Aktif** (dan admin PPAPI):

| Aplikasi | Alamat | Sumber lama |
|---|---|---|
| **PPAPI Scaffold — Perencanaan & Analisis Struktur** | `aplikasi/perencanaan/index.html` | `index.html` (PPAPI Scaffold v2.1.0, 19 Juli 2026) |
| **Simulator Pemasangan Perancah Tube & Coupler** | `aplikasi/simulator/index.html` | `simulator.html` |

Dasar keputusan: `SPEC-v2.md` §4.4 serta analisis `devtools/legacy/ANALISIS_PERENCANAAN.md` dan `ANALISIS_SIMULATOR.md` (9 Oktober 2026). Kode ID seperti **S4**, **B1**, atau **E13** di bawah merujuk ke tabel temuan pada analisis tersebut.

> **Prinsip porting (v2.2.0):** rumus, konstanta, dan urutan teknis tidak diubah. Yang diubah hanya integrasi portal, keamanan, bug yang pasti, aksesibilitas, dan tampilan.
>
> **v2.3.0 (Beta, 9 Oktober 2026):** atas persetujuan pemilik aplikasi (**"Koreksi + tandai Beta"**), metode perhitungan aplikasi perencanaan **dikoreksi** (temuan E1–E14) dan aplikasi ditandai **Beta**. Status ini berlaku sampai Komite Teknis PPAPI selesai meninjau. Rincian setiap koreksi (masalah, rumus sebelum/sesudah dengan rujukan baris, alasan, sumber, contoh numerik, asumsi, dan pertanyaan terbuka) ada di **`aplikasi/KOREKSI-PERHITUNGAN.md`**. Ringkasannya di bagian 4.5.
>
> **v2.4.0 (Beta, 9 Oktober 2026):** revisi hasil tinjauan independen atas v2.3.0: lentur transom/ledger, 50 % beban layan pada lift berpapan berikutnya, pagar ujung, migrasi data v2.2.0, penegakan kelas Tahap 2, status tag yang mengikuti analisis, dan integrasi tampilan portal. Rinciannya di `KOREKSI-PERHITUNGAN.md` §19 dan bagian 4.7 di bawah.
>
> **Simulator:** geometri dan urutan perakitan dikoreksi (9 Oktober 2026) dan didokumentasikan di **`aplikasi/KOREKSI-SIMULATOR.md`**; bagian 5 dan 6 berkas ini merujuk ke sana.
>
> **Data melekat ke akun (21 Oktober 2026):** arahan klien *"Pastikan database untuk semua aplikasi melekat ke akun yang digunakan untuk login sehingga saat membutuhkan data hasil inspeksi yang sudah diinput, bisa dibuka kembali dan tidak hilang."* Proyek dan hasil inspeksi aplikasi perencanaan serta kemajuan simulator kini tersimpan ke akun PPAPI (Firestore `app_data/{uid}/…`) dan dapat dibuka dari perangkat mana pun. Rinciannya di bagian 4.9 dan 5.1.

---

## 1. Struktur berkas

```
assets/js/store-apps.js   PPAPI.appData: data aplikasi per akun (Firestore app_data/{uid}/…; Mode Demo: localStorage)
aplikasi/
  gate.js                 gerbang bersama: memuat skrip inti situs (+ store-apps.js), memeriksa status, memasang bilah portal
  gate.css                gaya layar gerbang, bilah portal, dan notifikasi (token warna situs, awalan --pp-)
  CATATAN.md              berkas ini
  KOREKSI-PERHITUNGAN.md  koreksi metode perhitungan v2.3.0–v2.4.0 (Beta) untuk tinjauan Komite Teknis PPAPI
  KOREKSI-SIMULATOR.md    koreksi geometri & urutan simulator untuk tinjauan Komite Teknis PPAPI
  perencanaan/
    index.html            markup aplikasi (dari index.html lama)
    app.css               gaya aplikasi lama + bagian "INTEGRASI PORTAL PPAPI" di akhir
    app.js                skrip aplikasi (dari index.html lama) + jembatan SSO
  simulator/
    index.html            kerangka halaman simulator
    simulator.css         gaya monokrom PPAPI (warna fungsional hanya di adegan 3D)
    simulator.js          kode simulator lama di dalam createSim() + layar pembuka & progres
```

Tidak disalin dari paket lama: `sw.js`, `manifest.webmanifest`, ikon PWA, `404.html`, `netlify.toml`, `vercel.json`, `robots.txt`, dan salinan simulator base64 (`SIM_B64`). Ikon tab memakai `assets/img/favicon.svg` milik situs.

## 2. Gerbang (`gate.js`)

Urutan kerja di setiap halaman aplikasi:

1. Halaman dibuka dengan kelas `html.app-gate-pending`: seluruh isi disembunyikan, yang tampil hanya layar "Memverifikasi status keanggotaan…" (`#app-gate`). Tidak ada kilasan isi aplikasi. Logo layar ini memakai `assets/img/logo-light-mark.webp` (13 KB); master PNG 1200 px (132 KB) hanya untuk cetak.
2. `gate.js` memuat `assets/js/config.js`, `core.js`, `auth.js`, `store.js`, dan `store-apps.js` secara berurutan (alamat dihitung dari lokasi `gate.js`), lalu menunggu `PPAPI.session`.
3. Keputusan:
   - **belum masuk** → `masuk.html?next=aplikasi/<nama>/index.html`; setelah masuk, anggota kembali ke aplikasi;
   - **masuk tetapi status bukan Aktif** (Draf, Menunggu Verifikasi, Perlu Perbaikan, Ditolak, Nonaktif, Kedaluwarsa) → `dashboard.html` dengan notifikasi *"Fitur ini khusus anggota berstatus Aktif."*;
   - **anggota Aktif atau admin PPAPI** → bilah portal dipasang, lalu aplikasi dimulai lewat `window.PPAPI_APP_START(pengguna)`.
4. Selama aplikasi terbuka, sesi diawasi: keluar di tab lain → `masuk.html`; status dicabut admin → `dashboard.html`; akun berganti → halaman dimuat ulang. Halaman dari cache maju/mundur peramban diperiksa ulang.

Tidak ada `data-auth` pada `<body>` halaman aplikasi, karena pengalihan bawaan `core.js` memakai alamat relatif (`masuk.html`, `dashboard.html`) yang dari subfolder akan menjadi 404. `gate.js` mengurus pengalihannya sendiri.

**Batasan yang perlu dipahami.** Di hosting statis (GitHub Pages) berkas aplikasi tetap dapat diunduh oleh siapa pun yang mengetahui alamatnya. Gerbang mengatur *pengalaman portal*: siapa yang diarahkan ke aplikasi dan siapa yang diminta melengkapi keanggotaan. Gerbang tidak merahasiakan kode. Di Mode Demo, status tersimpan di `localStorage` sehingga dapat diubah lewat DevTools. Di mode Firebase, status anggota dilindungi aturan Firestore. Bila kelak kerahasiaan kode diwajibkan, aplikasi perlu disajikan dari hosting yang memeriksa token (mis. Firebase Hosting + Cloud Functions).

## 3. Bilah portal

Bilah hitam tipis di atas setiap aplikasi: **← Portal Anggota** (ke `dashboard.html`) · judul aplikasi (dari `config.apps`) · nama anggota dengan lencana *Aktif* atau *Admin* (tautan ke Profil Anggota) · **Keluar**. Di Mode Demo ada penanda "Mode Demo" berwarna perak (monokrom, sejak v2.4.0; sebelumnya kuning peringatan).

- Berupa `<nav aria-label="Portal Anggota PPAPI">`, diawali tautan lompat "Lewati ke aplikasi"; semua kontrol dapat dipakai dengan keyboard dan memiliki cincin fokus.
- Tinggi 48 px (44 px di ponsel). Bilah menempel di atas; tata letak aplikasi digeser sebesar `--pbar-h` sehingga bilah tidak menutupi apa pun.
- Disembunyikan saat mencetak.

## 4. PPAPI Scaffold — Perencanaan & Analisis Struktur

### 4.1 Akun: SSO dari portal PPAPI

| Lama | Sekarang |
|---|---|
| Login lokal ID + kata sandi; akun bawaan `admin`/`admin123` di setiap perangkat (S1); sesi `ppapi_session` dapat dipalsukan (S2) | Tidak ada login aplikasi. Identitas berasal dari akun portal PPAPI (`PPAPI_APP_START`). |
| Peran dari daftar akun lokal atau `user_metadata` Supabase (S3) | **Admin PPAPI → admin aplikasi**, anggota Aktif → pengguna. |
| Manajemen akun, Supabase, dan Upstash di menu Admin (token tersimpan di peramban, S6) | Dihapus. Akun dikelola di **Konsol Admin PPAPI** (`admin.html`). Menu Admin aplikasi kini hanya ringkasan peramban: jumlah pengguna dan proyek, daftar anggota yang pernah memakai aplikasi di perangkat ini (dengan tombol hapus data), dan log aktivitas. |
| Avatar diunggah ke aplikasi | Nama, peran, dan KTA tampil di beranda aplikasi dan bilah portal. Kolom *Inspektor / Supervisor* terisi otomatis "Nama · KTA …" bila masih kosong. |

Saat aplikasi dimulai, kunci lama yang sensitif dibersihkan dari peramban: `ppapi_session`, `ppapi_users`, `ppapi_backend`, `ppapi_remote`.

### 4.2 Data per anggota

Sejak 21 Oktober 2026 **data proyek tersimpan ke akun PPAPI** (bagian 4.9). Kunci peramban di bawah tetap dipakai sebagai **salinan kerja proyek yang sedang terbuka** (aplikasi tetap berjalan tanpa internet) dan sebagai arsip lama yang menunggu dipindahkan ke akun.

| Kunci `localStorage` | Isi |
|---|---|
| `ppapi_app_perencanaan_v1_u_<uid>` | `v:4`: jawaban checklist, **alasan N/A butir kritis** (`naNote`, v2.3.0), data proyek (termasuk `f-papan`, `f-pipa`, dan `f-transom` v2.4.0), **isian Tahap 2/3/5/6** (v2.4.0 menambah `an-sdpt`, `an-tie`, `an-kurva-why`), dan **rincian material beserta asalnya** (`matSrc`: auto/user/legacy; `matGeom`: kunci geometri; v2.4.0) |
| `…_photos`, `…_plans`, `…_dwg`, `…_jsa` | foto bukti, unggahan, gambar rencana, JSA |
| `…_sync` | proyek akun yang sedang terbuka (`pid`), perubahan yang belum terkirim (`dirty`, `localTs`), waktu sinkron terakhir (`remoteTs`), sidik media yang sudah ada di akun, bagian yang hanya tersimpan di peramban ini |
| `…_mig` | keputusan pemindahan data lama ke akun (`pending` / `done`) dan arsip lama yang sudah dipindahkan |
| `…_stash_<pid>` | foto/unggahan yang terlalu besar untuk akun, disimpan per proyek saat berpindah proyek |
| `ppapi_app_perencanaan_projects_u_<uid>` | arsip proyek lama (sebelum penyimpanan akun); dipindahkan ke akun setelah anggota menyetujui, lalu tetap ada sebagai cadangan sampai **Hapus data saya di perangkat ini** |
| `ppapi_appdata_q_<uid>` (store-apps.js) | antrean penulisan ke akun yang belum terkirim (luring) |
| `ppapi_appdata_idx_<uid>_<app>` (store-apps.js) | daftar proyek terakhir dari akun, untuk ditampilkan saat luring |
| `ppapi_app_perencanaan_users`, `ppapi_app_perencanaan_log` | daftar pengguna di perangkat ini (nama, peran, waktu) dan log aktivitas (maks. 40) |

Dua anggota yang memakai peramban yang sama tidak saling melihat data. Tombol **Hapus data saya di perangkat ini** (Data Proyek) menghapus salinan di perangkat tersebut; proyek yang sudah tersimpan ke akun tetap aman. Admin dapat menghapus salinan data anggota lain dari perangkat bersama.

**Pindah dari aplikasi lama** (ppapiid.vercel.app): buka aplikasi lama → *Ekspor Data (.json)* → di aplikasi baru, tahap *Laporan & Tagging* → **Muat Data**. Berkas impor divalidasi.

### 4.3 Perbaikan keamanan

| ID | Sebelum | Sesudah |
|---|---|---|
| S4 | Nilai isian (proyek, lokasi, inspektor, nomor tag) disisipkan apa adanya ke scaffold tag → `<img onerror>` tereksekusi | Semua nilai di-escape (`esc()`). |
| S5 | Nama proyek, nama berkas unggahan, nama material, isi JSA, dan log admin tidak di-escape; impor JSON tanpa validasi (data URL palsu, id gambar berisi tanda kutip) | Semua di-escape; impor dan data tersimpan divalidasi (`cleanAnswers`, `cleanPhotos`, `cleanPlans`, `cleanDwg`, `cleanJsa`, `cleanAnalisis`): foto hanya `data:image/jpeg|png|webp;base64`, unggahan hanya gambar atau PDF, id gambar harus angka. Tautan unggahan kini **Unduh** (bukan membuka data URL di tab baru). |
| S7 | `sw.js` menghapus cache lain di origin yang sama dan menyimpan semua permintaan GET secara cache-first | Service worker dan manifest **tidak dipasang**. |
| S8 | Simulator base64 dibuka sebagai `blob:` satu origin dengan akses penuh ke penyimpanan portal | Dihapus; tombol **Simulator 3D** membuka `aplikasi/simulator/` (gerbang yang sama). Ukuran berkas berkurang ±133 KB. |

### 4.4 Perbaikan bug yang tercatat di analisis

| ID | Masalah | Sebelum | Sesudah | Lokasi |
|---|---|---|---|---|
| B1 | Ringkasan hasil di *Laporan & Tagging* tidak pernah tampil | `go()` memanggil `renderRingkasan()` untuk tampilan `'ringkasan'` yang sudah tidak ada → `#ringkasan-root` kosong | Dipanggil saat membuka `'laporan'` | `app.js` `go()` |
| B2 | Kesimpulan otomatis "… dari **undefined**/52 item dinilai" | `st.answered` (tidak ada) | `st.ans` → "52/52 item dinilai" | `kesimpulanText()`; juga ringkasan admin |
| B3 | Tanggal inspeksi bawaan mundur sehari pukul 00.00–06.59 WIB | `new Date().toISOString().slice(0,10)` (UTC) | `todayLocal()` (tanggal lokal perangkat) | `initApp()`, Proyek Baru |
| B4 | Isian Tahap 2, 3, 5, 6 hilang saat halaman dimuat ulang | `save()` hanya menyimpan jawaban dan data proyek | `save()` juga menyimpan `collectAnalisis()` (kelas duty, parameter analisis, beban hidup, rincian material); dipulihkan saat dimuat | `save()`, `computeAnalisis()`, `computeLL()` → `saveSoon()` |
| B5 | "Proyek Baru" tidak menghapus foto, unggahan, gambar, analisis | hanya jawaban dan data proyek | Seluruh data proyek yang terbuka dikembalikan ke bawaan (nilai `value` di formulir, material bawaan, JSA templat); arsip tidak terhapus | `clearWorkingState()` |
| B6 | Jumlah bay/tiang analisis tidak mengikuti Data Proyek | tanpa pemberitahuan | v2.2.0: kotak SARAN. **v2.3.0: diselesaikan oleh koreksi E2.** Isian `an-bay`, `an-tiang`, dan `an-nklem` dihapus; semuanya diturunkan dari Data Proyek. Data yang tidak konsisten ditampilkan sebagai CATATAN. | `geom()`, `renderGeomNotes()` |
| B7 | PDF 10,2 MB untuk satu gambar | gambar rencana disisipkan PNG RGBA 1600 px tanpa kompresi | JPEG kualitas 0,9 (uji: PDF dengan gambar ±0,5 MB) | `svgToPNG()`, `buildPDFNow()` |
| B8 | Label tabel PDF menimpa nilai ("BEBAN MATI MATERIAL", "TOTAL TERFAKTOR X1.5") | label di `x`, nilai di `x+28/30` mm tetap | `pdfKV()`: label diperkecil/kolom dilebarkan sesuai lebar teks, nilai dipotong dengan "..." bila perlu | `buildPDFNow()` |
| B9 | Tombol "Simulator 3D" dan pita hazard ikut tercetak pada tag | `@media print` tidak menyembunyikannya | `.fab`, `.hazard`, menu konteks, bilah portal disembunyikan saat cetak | `app.css` |
| B10 / E13 | Teks pemeriksaan selalu memakai "≤" walaupun gagal ("q = 17595 kg/m² ≤ 10000 kg/m²" berlabel CEK) | simbol tetap | Simbol mengikuti hasil (`cmpSym`): "≤/≥" bila lolos, ">/<" bila gagal. Kondisi dan angka tidak berubah. | `analisisData()` |
| B11 | Judul "8 Tahap Perencanaan" berisi 9 tahap | "8 Tahap" | "9 Tahap" | `index.html` |
| B12 | Gagal simpan (penyimpanan penuh) diam-diam | `catch(e){}` | Peringatan satu kali (notifikasi) | `lsSet()` |
| B15 | jsPDF dimuat sinkron di `<head>` setiap kunjungan | memblokir render | Dimuat saat tombol **Buat Laporan PDF** ditekan; sejak v2.4.0 dengan Subresource Integrity, `crossorigin="anonymous"`, dan tanpa referrer (lihat bagian 7) | `ensureJsPDF()` |

Judul PDF kini "LAPORAN PERENCANAAN & INSPEKSI PERANCAH" (isinya mencakup perencanaan), dan nama berkas `Laporan_Perancah_<tag>.pdf`.

**Nilai acuan regresi.** v2.2.0 memakai nilai `ANALISIS_PERENCANAAN.md` §2.8: 645 kg → Light; W* 2609 kg; 435 kg per tiang; klem 3,20 kN; estimasi 4 bay 14 komponen / 227 pcs / 1469 kg; 704 kg per tiang; dan seterusnya. **Sejak v2.3.0, nilai tersebut sengaja diganti** oleh koreksi yang disetujui. Rumus lama tetap direproduksi oleh `devtools/flows/aplikasi-perencanaan-ref.mjs` sebagai kolom "sebelum". Nilai acuan baru dihitung oleh modul acuan independen yang sama (tanpa memanggil `app.js`). Kasus acuan: 3 bay × 2,4 × 1,2 m, 4 lift × 2,0 m, 2 lift berpapan, 1 platform kerja, Medium, pipa 48,3 × 4,0. Hasil v2.3.0: bay terberat bawaan 430 kg → Medium; beban tiang terbesar 480,8 kg (4,72 kN, tiang tengah sisi luar); N<sub>izin</sub> 29,08 kN; reaksi klem 2,64 kN terhadap 6,06 kN; q 12.020 kg/m²; estimasi material 13 komponen, 228 pcs, 1.626 kg. **Hasil v2.4.0** (KOREKSI §19): beban tiang terbesar **593,0 kg (5,82 kN)** karena 50 % beban layan pada lift berpapan kedua; N<sub>izin</sub> 29,08 kN (rasio 0,20); reaksi klem 2,64 kN; lentur transom **1,10 kNm terhadap 1,12 kNm** (rasio 0,98); q **14.824 kg/m²**; estimasi material **14 komponen, 248 pcs, 1.704 kg** (set pagar ujung). Untuk 4 bay: 14 komponen, 297 pcs, 2.139 kg; 589,5 kg per tiang. Checklist tetap HIJAU/MERAH/KUNING; status akhir tag dan PDF menggabungkan checklist dan analisis (bagian 4.7).

### 4.5 Koreksi metode perhitungan v2.3.0 (Beta)

| Temuan | Koreksi | Lokasi (`app.js`) |
|---|---|---|
| E6 | **Dasar keamanan tunggal (tegangan izin):** beban kerja tanpa faktor ≤ R<sub>k</sub>/(γ<sub>M</sub> 1,1 × γ<sub>F</sub> 1,5) (BS EN 12811-1:2003 §10.3.2). Isian SF (`ll-sf`) dan FK (`an-fk`) dihapus. | konstanta `GAMMA_F`, `GAMMA_M` |
| E4 | Kelas duty dari **bay terberat** dan beban terpusat terbesar (`ll-pt`), tanpa rata-rata | `llData()` |
| E1/E2 | Beban tiang per posisi dari geometri (tiang tengah 1 bay, ujung ½ bay, ½ lebar per sisi; berat sendiri per lift; papan per lift berpapan `f-papan`; pagar sisi luar; beban hidup × platform kerja). Yang diperiksa tiang **maksimum**. | `geom()`, `stdLoad()`, `stdAll()` |
| E3 | Kapasitas tekuk Perry–Robertson (EN 1993-1-1 §6.3.1.2): L<sub>e</sub> = k × tinggi lift; pipa 48,3 × 4,0 / 3,2 (`f-pipa`); kurva c bawaan (`an-kurva`). Hasil setara tabel NASC TG20:21 (selisih ≤ 0,5 %). | `buckling()` |
| E5/E14 | Klem siku: reaksi simpul pada platform kerja ≤ 6,06 / 9,09 kN (kelas A/B; BS EN 12811-1 Tabel C.1 ÷ 1,65; TG20 6,1 / 9,1 kN). Data lama `'6.3'`/`'9.4'` dipetakan ke A/B. | `couplerData()`, `applyAnalisis()` |
| E7 | Papan: UDL ≤ isian `an-udl`, beban terpusat ≤ isian `an-ptpapan` (data pabrikan; kosong = CEK) | `analisisData()` grup PLT |
| E8 | Pondasi memakai N maksimum; isian "luas bidang dukung (base plate/sole board)" | `analisisData()` |
| E9 | Asumsi suspended/mobile dinyatakan di layar & PDF; beban tanpa faktor | `index.html`, PDF |
| E10 | "Indikasi kekokohan"; klaim tie 2,5 %/6 kN dihapus; "INDIKASI AMAN" → "LOLOS PEMERIKSAAN INDIKATIF" | `computeAnalisis()` |
| E11 | Kategori FRM otomatis N/A (terkunci) untuk tubular; skor kategori tanpa N/A | `autoNA()`, `ansOf()` |
| E12 | N/A pada butir kritis wajib beralasan; tanpa alasan = belum dinilai | `stats()`, `setNaNote()` |
| E14 | Rujukan diperbarui (BS EN 12811-1, BS EN 74-1:2022, BS EN 39, TG20:21, AS/NZS 1576.1:2019, AS 4576:2020, SNI 8987:2021); KEP-74/PPK/XII/2013 dihapus; nomor klausul yang tidak terverifikasi dihapus | `index.html`, PDF, tag |
| E2 (Tahap 5) | Estimasi material dari geometri yang sama (lift dasar, lift berpapan, pagar per lift berpapan, berat pipa sesuai jenis); material bawaan = estimasi geometri bawaan | `materialRows()` |

**Tanda Beta:** pita "Beta — metode perhitungan telah dikoreksi dan menunggu tinjauan Komite Teknis PPAPI. Hasil bersifat indikatif dan wajib diverifikasi oleh ahli perancah yang kompeten." tampil di atas semua tampilan (`.beta-note`). Tanda Beta juga ada di `<title>`, judul bilah portal (`data-app-title`), lencana di header aplikasi (di dalam portal baris ini hanya untuk pembaca layar; tanda Beta tampil pada judul bilah portal), beranda, menu Tentang (v2.3.0), kesimpulan otomatis, dan kaki **setiap halaman PDF** (`BETA_TEXT`). Pita tidak ikut tercetak pada scaffold tag. Judul aplikasi di `config.apps` (dasbor) tidak diubah karena berkas itu milik situs; pemiliknya dapat menambahkan "(Beta)" bila diinginkan.

### 4.6 Tampilan & aksesibilitas

- Identitas visual aplikasi (kuning hazard, huruf Oswald) **dipertahankan** pada v2.2.0–v2.4.0; **sejak 11 Oktober 2026 diganti** dengan tema situs PPAPI (lihat bagian 4.8). Warna verdict HIJAU/KUNING/MERAH tetap: semantik keselamatan (konvensi scafftag).
- **Integrasi portal (v2.4.0).** Di dalam portal (`html.app-gate-ok`), baris merek aplikasi (logo, "PPAPI Scaffold", subjudul) disembunyikan secara visual karena judul sudah ada di bilah portal; `h1` tetap tersedia bagi pembaca layar. "Tersimpan HH.MM" dan chip status pindah ke bilah menu. Pita hazard dimulai setelah garis `--pp-metal-line` 1 px. Bilah menu berlatar grafit dan sejajar dengan tepi kartu. Chrome di atas kartu pertama: **108 px** di desktop 1440 (sebelumnya ±180 px) dan **99 px** di ponsel 390 (sebelumnya ±210 px). Chip status di bilah menu menunjukkan status akhir (checklist + analisis), sama dengan tag; chip progres di Checklist tetap hasil checklist saja.
- Tombol mengambang **Simulator 3D** berada di dalam `<aside aria-label="Pintasan aplikasi">` (axe `region`: 0 pelanggaran).
- Kontras disesuaikan agar memenuhi WCAG AA tanpa mengubah makna: hijau status `#1f9d57 → #17824a`, teks abu `#697079 → #5b636c`, judul kecil kuning di atas putih menjadi kuning tua `#8a6a00`, teks di atas latar KUNING berwarna gelap. Warna di dalam PDF tidak diubah.
- Seluruh label formulir dikaitkan dengan isiannya (`for`/`id`), isian tabel diberi `aria-label`, tombol jawaban checklist memakai `aria-pressed`, menu tahap memakai `aria-expanded` (Esc menutup menu), cincin fokus terlihat.
- Ponsel: header aplikasi tidak lagi menempel (dulu ±259 px menutupi progres checklist); progres checklist menempel tepat di bawah bilah portal; tombol jawaban ≥ 44 px; tabel Beban Hidup, Material, dan JSA bertumpuk menjadi kartu tanpa geser ke samping.
- Pesan `alert()` informatif diganti notifikasi yang tidak memblokir; konfirmasi tindakan berisiko tetap memakai dialog konfirmasi.
- Kartu "Tentang PPAPI" di beranda aplikasi menautkan ke `profil.html` (dulu catatan "dapat ditampilkan di sini setelah datanya dilampirkan").

### 4.7 Revisi v2.4.0 (tinjauan independen, 9 Oktober 2026)

Rincian teknis, sumber, dan contoh numerik ada di `KOREKSI-PERHITUNGAN.md` §19. Regresi: `devtools/flows/aplikasi-perencanaan-temuan.mjs`.

| Temuan | Perubahan | Lokasi (`app.js`) |
|---|---|---|
| Material v2.2.0 (393 kg) | Rincian bawaan v2.2.0 diganti estimasi geometri saat dimuat (penyimpanan, arsip, impor); rincian otomatis v2.3.0 yang belum disunting diperbarui diam-diam; rincian lama lain ditandai CEK sampai diganti/dikonfirmasi; suspended/mobile memakai W<sub>d</sub> = maks(rincian, estimasi) | `isMatV22()`, `materialRowsV23()`, `applyAnalisis()`, `matStatus()`, `analisisData()` |
| Lentur transom/ledger | Pemeriksaan baru terhadap W<sub>pl</sub>·f<sub>y</sub>/1,65 (1,12 / 0,93 kNm; TG20:21 Tabel 5.9); isian **Transom Antara** di Data Proyek | `memberBending()`, kartu "2. Lentur Transom & Ledger" |
| Beban terpusat Special | Isian `an-sdpt`; beban terpusat rencana = maks(kelas, Tahap 2) | `dutyInfo()`, `pointDesign()`, `applyLLtoAnalisis()` |
| Kelas Tahap 2 | CEK bila kelas dipilih < rekomendasi Tahap 2; tampil di tag dan PDF | `analisisData()` kelompok DAT |
| EN 12811-1 §6.2.9.2 a)3 | 50 % beban layan pada satu lift berpapan berikutnya (model independent) | `geom().nlive`, `stdLoad()` |
| Tag & PDF | Status akhir = checklist + analisis; KUNING "menunggu verifikasi desain" bila analisis PERLU REVIEW; tag memuat status analisis dan catatan Beta | `finalView()`, `tagHTML()`, `buildPDFNow()` |
| Material vs geometri | Rincian otomatis mengikuti geometri; rincian disunting ditandai bila geometri berubah; tombol *Ganti dengan estimasi geometri* / *Rincian ini sudah sesuai* | `syncMaterials()`, `renderMatNote()` |
| Batas beban terpusat | 100/150/200 kg (bukan 1,0/1,5/2,0 kN) | `llData()` |
| Kurva a | Selalu CEK; alasan/sertifikat wajib dan tercetak; pembanding kurva c | `analisisData()`, `computeAnalisis()` |
| Pagar ujung | Set pagar ujung pada tiang ujung dan di estimasi material; label catatan berat sendiri dari posisi yang dipakai | `endSetKg()`, `stdLoad()`, `materialRows()` |
| Jenis pipa data lama | "Belum dipilih" → dihitung 3,2 mm + CEK | `tubeUnset()`, `applyRecordFields()` |
| Rujukan di layar | SNI 8987:2021 tidak dikaitkan dengan dimensi/mutu; beranda menyebut acuan metode; "Lingkup" tanpa JIS G3444; tag "Acuan perhitungan" | `index.html`, `tagHTML()` |
| Perancah berikat | Isian **Perancah diikat ke bangunan** (Tahap 3); H ≤ 3B diganti INFO tie wajib didesain | `analisisData()` |

Data tersimpan v2.4.0 memakai `v:4`; data v1–v3 tetap dapat dimuat.

### 4.8 Penyelarasan tampilan dengan tema situs (11 Oktober 2026)

Arahan klien: *"ubah user interface aplikasi (simulator pemasangan dan perhitungan beban) agar selaras dengan tema website."* Aplikasi perencanaan kini memakai bahasa visual situs PPAPI (`SPEC.md` §1): monokrom hitam–grafit–baja–perak–tulang–putih, **Cormorant Garamond** untuk judul (dengan kata penekanan miring, mis. "Inspeksi *Keandalan*"), **Barlow Condensed** untuk label/eyebrow/tombol kapital berjarak, **Inter** untuk teks; garis rambut 1 px, sudut 2–4 px, simpul coupler pada eyebrow, bidang gelap (hero, spanduk status, pita menu, footer) bergantian dengan kartu putih di atas kertas. Rumus, konstanta, data, isi checklist, kunci penyimpanan, dan penandaan Beta **tidak diubah**.

**Yang diubah**

- `perencanaan/app.css` ditulis ulang. Nama kelas lama (`.card`, `.btn-pri`, `.ab`, `.find`, `.tag-*`, …) dipertahankan karena dirujuk `app.js`; hanya tampilannya yang baru. Token lama yang masih dirujuk (`--ink`, `--steel`, `--mute`, `--line`, `--grey-bg`, `--green`, `--amber`, `--red`) didefinisikan ulang dengan nilai tema situs. Aplikasi tetap **tidak memuat** `assets/css/main.css` (selektor umum lama akan bentrok); token dan pola komponen situs disalin ke `app.css`.
- Pita hazard kuning (atas, hero, bawah), aksen kuning, dan huruf Oswald dihapus. Tombol utama: tinta di atas terang / tulang di atas gelap (pola `.btn--primary`), tombol sekunder: garis rambut (`.btn--ghost`) dengan isian geser saat hover. Tombol mengambang **Simulator 3D** menjadi pil gelap bergaris rambut tanpa animasi pendar.
- **Warna hanya untuk status keselamatan** dan diredam agar AA: HIJAU `#3d7a52`, KUNING `#c99a2e` (teks tinta), MERAH `#b5443a`, belum lengkap `#5c5c63`. Dipakai pada lencana/chip status, tombol jawaban terpilih, garis kiri baris checklist dan kartu temuan, indikator skor, serta **pita scaffold tag yang tetap berwarna penuh** (sinyal keselamatan, ikut tercetak). Spanduk status (`.verdict-banner`) dan kotak status analisis (`.abox`) kini bidang grafit/putih dengan ikon, garis atas, dan label berwarna status; warnanya dikirim `app.js` lewat variabel CSS `--vc`/`--vi` (bukan `background` inline). Kelompok pemeriksaan analisis (STR/STA/RIG) dan kotak "Info" editor gambar menjadi monokrom karena bukan status.
- `index.html`: tautan Google Fonts disamakan dengan situs; `<em>` pada judul; chip model, keterangan kolom, dan log admin memakai kelas (bukan gaya inline); logo kartu "Tentang PPAPI" memakai `logo-mono-dark-sm.webp`; penyempurnaan istilah pada teks statis yang disentuh ("verdict" → "hasil penilaian", "item" → "butir"); kunci status/kategori dan teks yang dihasilkan `app.js` tidak diubah.
- Scaffold tag (pratinjau & cetak) dan kepala PDF memakai logo monokrom situs `logo-light.png`/`-sm.webp` (cadangan: logo base64 lama bila berkas tidak dapat dimuat). PDF: kepala hitam dengan garis perak (pita hazard dihapus), warna teks/garis mengikuti palet situs, warna status diredam sama seperti di layar.
- Editor gambar: titik kuning pada klem menjadi perak, bracing diagonal abu baja (tetap terbedakan dari pipa lurus); warna teknis gambar lainnya (tangga, dimensi, papan) tidak diubah.
- Bilah portal (`gate.css`/`gate.js`) tidak diubah — sudah bergaya header situs dan dipakai bersama simulator.

**Pengujian**

- `node devtools/flows/aplikasi-perencanaan-retheme.mjs` (cwd `devtools`): membuka beranda, menu tahap, sembilan tahap, Tentang, Admin, modal konteks editor gambar, daftar periksa terjawab, laporan + pratinjau tag di desktop 1440 dan ponsel 390; memeriksa tidak ada hazard/Oswald/kuning, keluarga huruf, kontras chip status, chrome ≤ 110/100 px, fokus keyboard, overflow mendatar, dan tombol simulator. Tangkapan: `devtools/shots/retheme-pr-*.png`.
- `aplikasi-flow.mjs` (C8) dan `aplikasi-perencanaan-temuan.mjs` (F2, F4) diperbarui: pita hazard tidak ada lagi, pita menu berlatar tinta dengan garis rambut, pembungkus `<aside>` tombol simulator yang `position: fixed`. Asersi perhitungan tidak disentuh.

### 4.9 Proyek Saya — data melekat ke akun (21 Oktober 2026)

**Lokasi data.** `assets/js/store-apps.js` (`PPAPI.appData`) menyimpan data aplikasi per akun:

| Mode | Dokumen proyek | Media (foto, unggahan, gambar besar) |
|---|---|---|
| Firebase | `app_data/{uid}/perencanaan/{pid}` | `app_data/{uid}/perencanaan_media/{pid}__ph_<butir>` · `…__pl_<sidik>` · `…__dwg` |
| Demo | `localStorage['ppapi_appdata/{uid}/perencanaan/{pid}']` (hanya peramban ini) | `localStorage['ppapi_appdata/{uid}/perencanaan_media/…']` |

Bentuk dokumen: `{ v:1, meta, data, size, updatedAt, parent }`. `data` berisi teks JSON dengan isi yang sama seperti **Ekspor Data (.json)** (isian Data Proyek, jawaban checklist, alasan N/A, analisis, material, JSA, gambar rencana); foto dan unggahan dirujuk dengan id media. `meta` memuat nama proyek, nomor tag, lokasi, tanggal inspeksi, inspektor, model, status akhir (HIJAU/KUNING/MERAH/BELUM LENGKAP), dan jumlah foto/unggahan, sehingga daftar Proyek Saya tampil tanpa memuat seluruh isi. **Rumus dan perhitungan tidak disentuh.**

**Batas ukuran.** Setiap dokumen ≤ 800.000 byte (batas Firestore 1 MiB). Foto bukti sudah dikecilkan saat diambil. Unggahan gambar yang lebih besar dikompresi menjadi JPEG di peramban untuk salinan akun. Unggahan PDF yang tetap terlalu besar **tidak dibuang**: berkas tetap ada di peramban ini, anggota diberi tahu (nama berkas disebut), dan Proyek Saya menandai "n berkas hanya di perangkat asal". Gambar rencana dipindah ke dokumen media tersendiri bila dokumen proyek melebihi batas.

**Simpan otomatis.** Setiap perubahan disimpan dahulu ke salinan kerja di peramban, lalu dikirim ke akun 2,5 detik setelah perubahan terakhir. Penanda di bilah menu:
- **Tersimpan ke akun · 14.32**: perubahan sudah ada di akun;
- **Menyimpan ke akun…**: sedang dikirim;
- **Belum tersinkron — akan dicoba lagi**: koneksi terputus; perubahan masuk antrean (`ppapi_appdata_q_<uid>`) dan dikirim otomatis (5 dtk sampai 60 dtk, saat perangkat kembali daring, atau saat halaman dibuka lagi);
- **Tersimpan di peramban · 14.32**: data lama yang belum disetujui untuk dipindahkan ke akun.

Proyek baru dibuat di akun saat isian pertama diketik (layar kosong tidak disimpan). **Simpan Proyek** mengirim seketika.

**Proyek Saya** (Data Proyek; juga tombol di beranda): daftar proyek di akun, terbaru di atas, dengan nama · nomor tag, lokasi, tanggal inspeksi, waktu pembaruan, status akhir, serta tanda *Sedang dibuka* / *Belum tersinkron*. Tindakan: **Buka**, **Ganti nama** (sebaris; Enter untuk menyimpan), **Gandakan** (salinan beserta medianya), **Hapus** (dengan konfirmasi; dokumen dan seluruh medianya dihapus dari akun), dan **Mulai Proyek Baru** (proyek yang terbuka tetap di akun). Sebelum berpindah proyek, perubahan dikirim lebih dahulu. Bila belum dapat diamankan (luring dan antrean tidak dapat disimpan), perpindahan ditolak agar isian tidak tertimpa.

**Konflik: last-write-wins dengan `updatedAt`.** Dokumen utama ditulis dalam transaksi yang membaca versi akun lebih dahulu. Versi akun yang lebih baru tidak pernah ditimpa versi lama, dan penghapusan yang lebih lama daripada versi akun juga ditolak. Bila perangkat ini mengirim perubahan yang lebih lama daripada versi akun (mis. proyek disunting di perangkat lain), versi akun dibuka dan isian perangkat ini disimpan sebagai proyek **"… (salinan perangkat ini)"**. Saat aplikasi dibuka, versi akun yang lebih baru dimuat otomatis dengan pemberitahuan.

**Pemindahan data lama (sekali, dengan persetujuan).** Bila peramban ini berisi arsip proyek lama atau isian yang belum pernah disinkronkan, aplikasi memberi tahu saat dibuka dan menampilkan panel **Data lama di peramban ini** di Proyek Saya, lengkap dengan daftar datanya serta tombol **Simpan ke akun** dan **Nanti saja**. Tidak ada data yang dikirim sebelum anggota menyetujuinya. Arsip lama mempertahankan status, lokasi, foto, dan tanggal simpannya. Data di peramban tidak dihapus.

**Aturan Firestore.** Blok DATA APLIKASI ANGGOTA di `firestore.rules` (digabung 21 Oktober 2026; Publish ulang di Firebase Console): pemilik membaca, menulis, dan menghapus `app_data/{uid}/…` miliknya sendiri. Status Aktif tidak disyaratkan agar data inspeksi tetap dapat diambil kembali; gerbang aplikasi tetap mensyaratkan Aktif untuk *memakai* aplikasi. Admin PPAPI hanya dapat membaca. Koleksi dibatasi `perencanaan`, `perencanaan_media`, `simulator`, dan `simulator_media`. Bentuk dokumen diperiksa (kunci, `data` teks ≤ 800.000 karakter, `updatedAt` angka, `meta` ≤ 24 kunci). Setiap penulisan memakai sekitar 20 ekspresi, jauh di bawah anggaran 1.000.

**Pengujian:** `node devtools/flows/appdata-flow.mjs` (Mode Demo: buat inspeksi, muat ulang, konteks peramban kedua, konflik, ganti nama/gandakan/hapus, berkas besar, proyek baru, ponsel, migrasi, simulator, axe) dan `node devtools/flows/appdata-firebase-stub.mjs` (jalur Firestore dengan stub SDK, cermin aturan, dua perangkat, antrean luring, akses anggota lain/admin).

## 5. Simulator Pemasangan Perancah Tube & Coupler

### 5.1 Arsitektur

- `index.html` memuat `simulator.js` (mendefinisikan `PPAPI_APP_START`) dan `../gate.js`. Sebelum gerbang lolos, **three.js tidak dimuat sama sekali** (diuji: anggota non-Aktif tidak pernah meminta `three.min.js`).
- three.js **r128** dimuat dari cdnjs dengan Subresource Integrity (`sha512-dLxUelAp…`). Versi tidak dinaikkan karena r128 adalah build UMD terakhir yang dipakai kode lama; peningkatan versi menunggu fase berikutnya (lihat analisis §5.7).
- Adegan 3D dibuat saat anggota menekan **Mulai Simulasi** (layar pembuka). Tanpa WebGL atau bila pustaka 3D gagal dimuat, tampil pesan yang jelas (B6). Konteks WebGL yang hilang/pulih juga ditangani (B7).
- **Kemajuan latihan** disimpan per anggota **di akun PPAPI** (sejak 21 Oktober 2026: `PPAPI.appData`, dokumen kecil `app_data/{uid}/simulator/progress`; Mode Demo `localStorage['ppapi_appdata/{uid}/simulator/progress']`) dan sebagai salinan di peramban: `localStorage['ppapi_progress_<uid>_simulator']` = `{ v: 2, seq: 'tc-2026.10-r2', total, current, completedAt, updatedAt, tools{vert,horz,dist,square,edge,stab}, libSeen[], runs[{completedAt, seq}] }` (`runs` = riwayat perakitan yang selesai, maks. 20). Saat dibuka, versi dengan `updatedAt` terbaru (akun atau peramban) yang dipakai; perubahan dikirim ke akun 1,2 detik kemudian. Latihan dapat dilanjutkan dari perangkat lain. `seq` adalah versi urutan perakitan; kemajuan dari urutan lain (sebelum koreksi Oktober 2026) tidak dapat dipetakan sehingga perakitan dimulai ulang, dengan alat ukur dan katalog yang sudah dilihat tetap tercatat. Data keanggotaan di portal tidak disentuh. Saat dibuka kembali, layar pembuka menawarkan **Lanjutkan Perakitan** atau **Mulai dari awal**.
- Geometri, urutan 20 tahap, dan mode inspeksi yang mengukur model dikoreksi pada 9 Oktober 2026: lihat **`KOREKSI-SIMULATOR.md`** (§2–§5).

### 5.2 Perbaikan

| ID | Sebelum | Sesudah |
|---|---|---|
| B1 | Label sakelar inspeksi memakai kelas `.lbl` yang bentrok dengan label 3D → teks bergeser keluar panel | Kelas `.tlbl`; sakelar berupa `<button aria-pressed>` |
| B2 | Notifikasi teks gelap di latar gelap (±1,1:1) dan tidak diumumkan pembaca layar | Teks terang di latar grafit (±15,9:1), `role="status"` |
| B3 | Kontrol kamera tertutup panel (ponsel & desktop) | Desktop lebar: kontrol di kiri panel. Tablet, ponsel, dan ponsel lanskap: kontrol di balik satu tombol "Kontrol kamera" (di atas lembar panel pada ponsel); gestur seret/cubit tetap tersedia |
| B4 | Ponsel potret: menara terpotong/terlalu dekat | Jarak kamera dihitung dari area yang benar-benar terlihat (di luar panel, lembar bawah, dan bilah tab); pusat adegan digeser ke area tersebut (`setViewOffset`) |
| B5 | Ponsel lanskap memakai tata letak desktop | Panel lebih ramping, layar pembuka ringkas, dan tombol tahap selalu terlihat pada layar pendek |
| B6 | Tanpa WebGL / CDN gagal: tombol mati tanpa pesan | Pesan penjelasan + tombol muat ulang |
| B8 | Geometri & material bocor (katalog, sakelar inspeksi, alat bantu) dan render terus-menerus | `dispose()` saat objek diganti; render hanya saat ada perubahan; bayangan 1024² dan rasio piksel ≤ 1,5 di ponsel |
| B9 | Tab, sakelar, dan tombol kamera tidak dapat dipakai dengan keyboard | Tab ARIA (panah kiri/kanan, Home/End), tombol kamera bereaksi pada Enter/Spasi, kanvas dapat difokus (panah = putar, +/− = zoom, Enter = pasang komponen) |
| B10 | Laser "hilang 2 detik" tidak pernah hilang; tidak bisa diketuk | Hilang setelah 2 detik tanpa gerakan; ketukan menunjuk |
| B11 | Panel tidak kembali ke atas setelah tahap berganti | `scrollTop = 0`; di ponsel tombol tahap selalu terlihat di dasar lembar |
| B13 | Ukuran kanvas memakai ukuran jendela | Mengikuti wadah di bawah bilah portal (`ResizeObserver`) |
| — | `maximum-scale=1, user-scalable=no` | Dihapus (pengguna dapat memperbesar halaman) |
| — | Gerak dikurangi | Model katalog tidak berputar otomatis dan transisi kamera instan bila `prefers-reduced-motion` |

### 5.3 Tampilan

Kerangka antarmuka (bilah atas, panel, tab, tombol, layar pembuka, notifikasi) memakai bahasa visual PPAPI yang monokrom. Warna fungsional dipertahankan **hanya di dalam adegan 3D dan legendanya**: pita warna jenis klem, tag hijau/merah, garis alat ukur, dan sorotan kuning komponen berikutnya (sedikit lebih pekat agar jelas). Latar adegan menjadi abu netral. Merek lama diganti identitas aplikasi anggota PPAPI; kredit pengembang dicantumkan sebagai "Dikembangkan oleh mrezahuzain@2026". Layar pembuka menyatakan bahwa konfigurasi menara bersifat ilustratif untuk pelatihan, bukan desain perancah.

## 6. Status temuan teknik & pertanyaan terbuka untuk Komite Teknis PPAPI

Aplikasi perencanaan (`ANALISIS_PERENCANAAN.md` §2.7): **E1–E14 telah dikoreksi pada v2.3.0 (Beta)** — lihat bagian 4.5 dan `KOREKSI-PERHITUNGAN.md`. Yang masih menunggu keputusan Komite (rincian di `KOREKSI-PERHITUNGAN.md` §17):
- salinan atau koreksi rujukan "KEP-74/PPK/XII/2013" (dihapus dari aplikasi sampai dapat diverifikasi) dan pemetaan ulang rujukan BS 5973/BS 1139 pada butir checklist;
- eksentrisitas klem, faktor kontinuitas ledger, lebar platform minimum per kelas, berat komponen non-pipa, mutu pipa 3,2 mm, opsi kurva tekuk a;
- FoS tali, faktor stabilitas counterweight, rasio H:B menara beroda, jumlah platform kerja bersamaan, perhitungan tie dan angin;
- konfirmasi dasar keamanan tunggal R<sub>k</sub>/1,65 (setara TG20) dan kriteria pencabutan label Beta.

Aplikasi perencanaan v2.4.0: temuan tinjauan independen telah diperbaiki (`KOREKSI-PERHITUNGAN.md` §19). Pertanyaan baru untuk Komite: penggabungan beban terpusat pada transom/ledger (Q14), ledger dengan transom antara (Q15), dan aturan 50 % level berpapan (Q16).

Simulator: temuan geometri dan urutan dari `ANALISIS_SIMULATOR.md` §2 (lantai sementara tanpa pagar, top rail ±0,92–0,94 m, tag hijau sebelum inspeksi, lebar 2,4 m berlabel "AS 4576", bracing ujung 57°, outrigger setelah lift-2) **telah dikoreksi**: lihat `KOREKSI-SIMULATOR.md` §1–§4. Yang masih menunggu Komite (`KOREKSI-SIMULATOR.md` §7):
- acuan nasional untuk tinggi pagar, bentang papan, dan toleransi; persetujuan konfigurasi ilustrasi (2 bay × 2,0 m × 1,2 m, lift 1,95 m);
- tinggi top rail 1,0 m atau 950 mm, jumlah mid rail, dan bukti kekuatan pagar 0,9 kN;
- batas stabilitas menara bebas (4 : 1) dan outrigger atau tie sebagai varian;
- lantai lift-1, konvensi bracing, sambungan standard, papan, dan spesifikasi pintu tangga;
- konvensi tag (dua atau tiga warna), kriteria aplikasi bertanda \*, mode tantangan, dan edisi standar yang berlaku.

Atribusi pengembang telah diseragamkan sesuai arahan klien (9 Oktober 2026): seluruh kredit pengembang di situs dan aplikasi anggota menggunakan "mrezahuzain@2026".

## 7. Pemeliharaan & pengujian

- **Dependensi eksternal:** Google Fonts; jsPDF 2.5.1 (cdnjs, dimuat saat membuat PDF); three.js r128 (cdnjs). Kedua skrip CDN dimuat dengan **Subresource Integrity**, `crossorigin="anonymous"`, dan `referrerpolicy="no-referrer"`, karena halaman aplikasi satu origin dengan portal (sesi Firebase, konsol admin, localStorage):
  - three.js r128 `three.min.js`: `sha512-dLxUelApnYxpLt6K2iomGngnHO83iUvZytA3YjDUCjT0HDOHKXnVYdf3hU4JjM8uEhxf9nD1/ey98U3t2vZ0qQ==` (`simulator/simulator.js`);
  - jsPDF 2.5.1 `jspdf.umd.min.js`: `sha512-qZvrmS2ekKPF2mSznTQsxqPgnpkI4DNTlrdUmTzrDgektczlKNRRhy5X5AAOnx5S09ydFYWWNSfcEqDTTHgtNA==` (`perencanaan/app.js`, `JSPDF_SRI`; dihitung ulang dari berkas cdnjs pada 9 Oktober 2026).

  Bila versi pustaka dinaikkan, hash wajib diperbarui; berkas yang tidak cocok ditolak peramban dan aplikasi menampilkan pesan "Pustaka PDF tidak dapat dimuat". Tanpa internet, PDF dan simulator 3D tidak tersedia; aplikasi perencanaan lainnya tetap berjalan.
- **Uji otomatis:**
  - `node devtools/flows/aplikasi-flow.mjs`: gerbang, bilah portal, SSO, sembilan tahap, nilai acuan, perbaikan bug, keamanan/XSS, simulator, axe-core;
  - `node devtools/flows/aplikasi-perencanaan-koreksi.mjs`: koreksi metode (kasus acuan, matriks skenario, Tahap 2, dasar keamanan, papan, klem, migrasi data lama, E11/E12, tanda Beta termasuk PDF, ponsel, axe);
  - `node devtools/flows/aplikasi-perencanaan-temuan.mjs`: setiap temuan tinjauan independen v2.4.0 (SRI, chrome portal, migrasi material v2.2.0, transom/ledger, beban terpusat, kelas Tahap 2, §6.2.9.2, tag/PDF, material vs geometri, batas kg, kurva a, pagar ujung, jenis pipa, teks rujukan, tie, ponsel, axe);
  - `node devtools/flows/aplikasi-simulator-flow.mjs`: simulator (urutan 20 tahap, ukuran dari adegan, inspeksi, memori, keyboard, axe, ponsel, migrasi kemajuan, tanpa WebGL);
  - `node devtools/flows/appdata-flow.mjs` dan `node devtools/flows/appdata-firebase-stub.mjs`: data aplikasi melekat ke akun (bagian 4.9);
  - nilai harapan dari `node devtools/flows/aplikasi-perencanaan-ref.mjs` (perhitungan acuan independen);
  - `node devtools/check.mjs aplikasi/perencanaan/index aplikasi/simulator/index --auth` (serta tanpa `--auth`, dengan `--status=…`, dan `--admin`).
- **Mengubah rumus:** setiap perubahan rumus atau konstanta wajib disetujui ahli PPAPI, dicatat di daftar perubahan aplikasi (menu *Tentang Aplikasi*, `CHANGELOG` di `app.js`) dan di `KOREKSI-PERHITUNGAN.md`, lalu modul acuan `aplikasi-perencanaan-ref.mjs` diperbarui **secara terpisah** dari `app.js` (jangan menyalin kode aplikasi ke modul acuan).
- **Versi:** PPAPI Scaffold **2.4.0 (Beta)**, 9 Oktober 2026 — revisi hasil tinjauan independen atas metode terkoreksi 2.3.0, menunggu tinjauan Komite Teknis PPAPI. Versi sebelumnya 2.3.0 (koreksi E1–E14) dan 2.2.0 (porting ke portal).
