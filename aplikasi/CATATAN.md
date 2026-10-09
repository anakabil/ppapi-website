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

---

## 1. Struktur berkas

```
aplikasi/
  gate.js                 gerbang bersama: memuat skrip inti situs, memeriksa status, memasang bilah portal
  gate.css                gaya layar gerbang, bilah portal, dan notifikasi (token warna situs, awalan --pp-)
  CATATAN.md              berkas ini
  KOREKSI-PERHITUNGAN.md  koreksi metode perhitungan v2.3.0 (Beta) untuk tinjauan Komite Teknis PPAPI
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

1. Halaman dibuka dengan kelas `html.app-gate-pending`: seluruh isi disembunyikan, yang tampil hanya layar "Memverifikasi status keanggotaan…" (`#app-gate`). Tidak ada kilasan isi aplikasi.
2. `gate.js` memuat `assets/js/config.js`, `core.js`, `auth.js`, dan `store.js` secara berurutan (alamat dihitung dari lokasi `gate.js`), lalu menunggu `PPAPI.session`.
3. Keputusan:
   - **belum masuk** → `masuk.html?next=aplikasi/<nama>/index.html`; setelah masuk, anggota kembali ke aplikasi;
   - **masuk tetapi status bukan Aktif** (Draf, Menunggu Verifikasi, Perlu Perbaikan, Ditolak, Nonaktif, Kedaluwarsa) → `dashboard.html` dengan notifikasi *"Fitur ini khusus anggota berstatus Aktif."*;
   - **anggota Aktif atau admin PPAPI** → bilah portal dipasang, lalu aplikasi dimulai lewat `window.PPAPI_APP_START(pengguna)`.
4. Selama aplikasi terbuka, sesi diawasi: keluar di tab lain → `masuk.html`; status dicabut admin → `dashboard.html`; akun berganti → halaman dimuat ulang. Halaman dari cache maju/mundur peramban diperiksa ulang.

Tidak ada `data-auth` pada `<body>` halaman aplikasi, karena pengalihan bawaan `core.js` memakai alamat relatif (`masuk.html`, `dashboard.html`) yang dari subfolder akan menjadi 404. `gate.js` mengurus pengalihannya sendiri.

**Batasan yang perlu dipahami.** Di hosting statis (GitHub Pages) berkas aplikasi tetap dapat diunduh oleh siapa pun yang mengetahui alamatnya. Gerbang mengatur *pengalaman portal*: siapa yang diarahkan ke aplikasi dan siapa yang diminta melengkapi keanggotaan. Gerbang tidak merahasiakan kode. Di Mode Demo, status tersimpan di `localStorage` sehingga dapat diubah lewat DevTools. Di mode Firebase, status anggota dilindungi aturan Firestore. Bila kelak kerahasiaan kode diwajibkan, aplikasi perlu disajikan dari hosting yang memeriksa token (mis. Firebase Hosting + Cloud Functions).

## 3. Bilah portal

Bilah hitam tipis di atas setiap aplikasi: **← Portal Anggota** (ke `dashboard.html`) · judul aplikasi (dari `config.apps`) · nama anggota dengan lencana *Aktif* atau *Admin* (tautan ke Profil Anggota) · **Keluar**. Di Mode Demo ada penanda "Mode Demo".

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

### 4.2 Data per anggota (di peramban ini)

| Kunci `localStorage` | Isi |
|---|---|
| `ppapi_app_perencanaan_v1_u_<uid>` | jawaban checklist, **alasan N/A butir kritis** (`naNote`, v2.3.0), data proyek (termasuk `f-papan` dan `f-pipa`), **isian Tahap 2/3/5/6 dan rincian material** |
| `…_photos`, `…_plans`, `…_dwg`, `…_jsa` | foto bukti, unggahan, gambar rencana, JSA |
| `ppapi_app_perencanaan_projects_u_<uid>` | arsip proyek |
| `ppapi_app_perencanaan_users`, `ppapi_app_perencanaan_log` | daftar pengguna di perangkat ini (nama, peran, waktu) dan log aktivitas (maks. 40) |

Dua anggota yang memakai peramban yang sama tidak saling melihat data. Tombol **Hapus data saya di perangkat ini** (Data Proyek) menghapus seluruh data milik anggota tersebut. Admin dapat menghapus data anggota lain dari perangkat bersama.

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
| B15 | jsPDF dimuat sinkron di `<head>` setiap kunjungan | memblokir render | Dimuat saat tombol **Buat Laporan PDF** ditekan | `ensureJsPDF()` |

Judul PDF kini "LAPORAN PERENCANAAN & INSPEKSI PERANCAH" (isinya mencakup perencanaan), dan nama berkas `Laporan_Perancah_<tag>.pdf`.

**Nilai acuan regresi.** v2.2.0 memakai nilai `ANALISIS_PERENCANAAN.md` §2.8: 645 kg → Light; W* 2609 kg; 435 kg per tiang; klem 3,20 kN; estimasi 4 bay 14 komponen / 227 pcs / 1469 kg; 704 kg per tiang; dan seterusnya. **Sejak v2.3.0, nilai tersebut sengaja diganti** oleh koreksi yang disetujui. Rumus lama tetap direproduksi oleh `devtools/flows/aplikasi-perencanaan-ref.mjs` sebagai kolom "sebelum". Nilai acuan baru dihitung oleh modul acuan independen yang sama (tanpa memanggil `app.js`). Kasus acuan: 3 bay × 2,4 × 1,2 m, 4 lift × 2,0 m, 2 lift berpapan, 1 platform kerja, Medium, pipa 48,3 × 4,0. Hasilnya: bay terberat bawaan 430 kg → Medium; beban tiang terbesar 480,8 kg (4,72 kN, tiang tengah sisi luar); N<sub>izin</sub> 29,08 kN; reaksi klem 2,64 kN terhadap 6,06 kN; q 12.020 kg/m². Estimasi material bawaan: 13 komponen, 228 pcs, 1.626 kg. Untuk 4 bay: 13 komponen, 277 pcs, 2.061 kg; 477 kg per tiang. Checklist tetap HIJAU/MERAH/KUNING.

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

**Tanda Beta:** pita "Beta — metode perhitungan telah dikoreksi dan menunggu tinjauan Komite Teknis PPAPI. Hasil bersifat indikatif dan wajib diverifikasi oleh ahli perancah yang kompeten." tampil di atas semua tampilan (`.beta-note`). Tanda Beta juga ada di `<title>`, judul bilah portal (`data-app-title`), lencana di header, beranda, menu Tentang (v2.3.0), kesimpulan otomatis, dan kaki **setiap halaman PDF** (`BETA_TEXT`). Pita tidak ikut tercetak pada scaffold tag. Judul aplikasi di `config.apps` (dasbor) tidak diubah karena berkas itu milik situs; pemiliknya dapat menambahkan "(Beta)" bila diinginkan.

### 4.6 Tampilan & aksesibilitas

- Identitas visual aplikasi (kuning hazard, huruf Oswald) **dipertahankan**; warna verdict HIJAU/KUNING/MERAH adalah semantik keselamatan (konvensi scafftag).
- Kontras disesuaikan agar memenuhi WCAG AA tanpa mengubah makna: hijau status `#1f9d57 → #17824a`, teks abu `#697079 → #5b636c`, judul kecil kuning di atas putih menjadi kuning tua `#8a6a00`, teks di atas latar KUNING berwarna gelap. Warna di dalam PDF tidak diubah.
- Seluruh label formulir dikaitkan dengan isiannya (`for`/`id`), isian tabel diberi `aria-label`, tombol jawaban checklist memakai `aria-pressed`, menu tahap memakai `aria-expanded` (Esc menutup menu), cincin fokus terlihat.
- Ponsel: header aplikasi tidak lagi menempel (dulu ±259 px menutupi progres checklist); progres checklist menempel tepat di bawah bilah portal; tombol jawaban ≥ 44 px; tabel Beban Hidup, Material, dan JSA bertumpuk menjadi kartu tanpa geser ke samping.
- Pesan `alert()` informatif diganti notifikasi yang tidak memblokir; konfirmasi tindakan berisiko tetap memakai dialog konfirmasi.
- Kartu "Tentang PPAPI" di beranda aplikasi menautkan ke `profil.html` (dulu catatan "dapat ditampilkan di sini setelah datanya dilampirkan").

## 5. Simulator Pemasangan Perancah Tube & Coupler

### 5.1 Arsitektur

- `index.html` memuat `simulator.js` (mendefinisikan `PPAPI_APP_START`) dan `../gate.js`. Sebelum gerbang lolos, **three.js tidak dimuat sama sekali** (diuji: anggota non-Aktif tidak pernah meminta `three.min.js`).
- three.js **r128** dimuat dari cdnjs dengan Subresource Integrity (`sha512-dLxUelAp…`). Versi tidak dinaikkan karena r128 adalah build UMD terakhir yang dipakai kode lama; peningkatan versi menunggu fase berikutnya (lihat analisis §5.7).
- Adegan 3D dibuat saat anggota menekan **Mulai Simulasi** (layar pembuka). Tanpa WebGL atau bila pustaka 3D gagal dimuat, tampil pesan yang jelas (B6). Konteks WebGL yang hilang/pulih juga ditangani (B7).
- **Kemajuan latihan** disimpan per anggota di peramban ini: `localStorage['ppapi_progress_<uid>_simulator']` = `{ current, total, completedAt, updatedAt, tools{vert,horz,dist,square}, libSeen[] }`. Data keanggotaan di portal tidak disentuh. Saat dibuka kembali, layar pembuka menawarkan **Lanjutkan Perakitan** atau **Mulai dari awal**.

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

Simulator (`ANALISIS_SIMULATOR.md` §2): urutan dan dimensi beberapa tahap (lantai sementara tanpa pagar, top rail ±0,92–0,94 m, tag hijau dipasang sebelum inspeksi, lebar 2,4 m berlabel "AS 4576 light duty", bracing ujung 57°, outrigger setelah lift-2), serta mode uji/penilaian.

Atribusi pengembang telah diseragamkan sesuai arahan klien (9 Oktober 2026): seluruh kredit pengembang di situs dan aplikasi anggota menggunakan "mrezahuzain@2026".

## 7. Pemeliharaan & pengujian

- **Dependensi eksternal:** Google Fonts; jsPDF 2.5.1 (cdnjs, dimuat saat membuat PDF); three.js r128 (cdnjs + SRI). Tanpa internet, PDF dan simulator 3D tidak tersedia; aplikasi perencanaan lainnya tetap berjalan.
- **Uji otomatis:** `node devtools/flows/aplikasi-flow.mjs` (gerbang, bilah portal, SSO, sembilan tahap, nilai acuan v2.3.0, perbaikan bug, keamanan/XSS, simulator, axe-core); `node devtools/flows/aplikasi-perencanaan-koreksi.mjs` (koreksi metode: kasus acuan, matriks skenario, Tahap 2, dasar keamanan, papan, klem, migrasi data lama, E11/E12, tanda Beta termasuk PDF, ponsel, axe) dengan nilai harapan dari `node devtools/flows/aplikasi-perencanaan-ref.mjs` (perhitungan acuan independen) dan `node devtools/check.mjs aplikasi/perencanaan/index aplikasi/simulator/index --auth` (serta tanpa `--auth`, dengan `--status=…`, dan `--admin`).
- **Mengubah rumus:** setiap perubahan rumus atau konstanta wajib disetujui ahli PPAPI, dicatat di daftar perubahan aplikasi (menu *Tentang Aplikasi*, `CHANGELOG` di `app.js`) dan di `KOREKSI-PERHITUNGAN.md`, lalu modul acuan `aplikasi-perencanaan-ref.mjs` diperbarui **secara terpisah** dari `app.js` (jangan menyalin kode aplikasi ke modul acuan).
- **Versi:** PPAPI Scaffold **2.3.0 (Beta)**, 9 Oktober 2026 — metode perhitungan terkoreksi, menunggu tinjauan Komite Teknis PPAPI. Versi sebelumnya 2.2.0 (porting ke portal).
