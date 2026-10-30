# Situs PPAPI — Panduan Pengelolaan

Situs resmi **Perkumpulan Praktisi dan Ahli Perancah Indonesia (PPAPI)**. Situs ini statis
(HTML, CSS, JavaScript biasa) sehingga dapat diterbitkan gratis melalui **GitHub Pages**
tanpa proses *build*. Login anggota dan penyimpanan data memakai **Firebase** (Mode Firebase,
mode produksi yang dipakai situs). Untuk pengembangan dan pengujian tersedia **mode uji
pengembang** ("Mode Demo"), yang hanya aktif bila `firebase.apiKey` di `config.js` dikosongkan
dan tidak pernah tampil bagi pengunjung situs produksi.

**Alamat situs saat ini:** <https://ppapi.or.id/> (repositori `anakabil/ppapi-website`,
GitHub Pages). Cara pembaruannya dijelaskan di bagian 13.

---

## 1. Ringkasan fitur

- Halaman publik: Beranda, Profil, Berita & Kegiatan, Agenda (dengan berkas pengingat
  kalender `.ics`), **Produk Pengetahuan** (standar, Code of Practice, peraturan perundangan,
  petunjuk teknis, modul/panduan pelatihan, formulir, kajian teknis, aplikasi), Regulasi &
  Standar, Keanggotaan, Verifikasi Anggota (nomor KTA atau nama), Kontak & Umpan Balik,
  Kebijakan Privasi, dan halaman 404.
- Masuk/Daftar dengan **email**, **nomor HP (kode OTP)**, atau **akun Google**.
- **Pendaftaran anggota yang sesungguhnya**: setelah membuat akun, calon anggota mengisi
  **Formulir Pendaftaran** (kategori, data diri, data profesional, kompetensi & sertifikat,
  dokumen pendukung, pernyataan), mengajukannya, lalu **sekretariat memverifikasi** melalui
  **Konsol Admin**. Setelah disetujui, status menjadi **Aktif**, nomor **KTA** terbit otomatis
  dan anggota tercantum di daftar Verifikasi Anggota.
- **Semua fitur anggota hanya terbuka bagi anggota berstatus Aktif** (dan admin): KTA
  digital, profil anggota, berkas Produk Pengetahuan, dan aplikasi anggota. Akun yang belum
  Aktif melihat pusat status pendaftaran beserta langkah berikutnya.
- **Konsol Admin** (sekretariat): antrean permohonan, keputusan (setujui / minta perbaikan /
  tolak), direktori anggota (perpanjang, ubah kategori, nonaktifkan/aktifkan, ekspor CSV),
  pengelolaan konten (berita, pengumuman, agenda, produk pengetahuan, regulasi), umpan balik,
  daftar admin, dan log aktivitas.
- **Aplikasi anggota (Beta)**: PPAPI Scaffold (Beta) — Perencanaan & Analisis Struktur v2.4.0, dan
  Simulator Pemasangan Perancah Tube & Coupler (folder `aplikasi/`). Metode perhitungan dan
  urutan simulator telah dikoreksi dan menunggu tinjauan Komite Teknis PPAPI (bagian 8).
- **Fitur tambahan (21 Oktober 2026)** — rinciannya di bagian 16–19:
  **Direktori Instruktur** dan formulir permintaan instruktur (`instruktur.html`);
  **Kegiatan** (webinar, pelatihan, seminar) dengan pendaftaran, daftar hadir otomatis, dan
  **sertifikat PDF** yang dapat diverifikasi (`sertifikat.html`); **Toko PPAPI** dengan
  keranjang, transfer bank manual, dan soft file bertanda air (`toko.html`, `keranjang.html`,
  `pesanan.html`); serta **data aplikasi anggota yang melekat ke akun**.
- Desain monokrom yang konsisten; rapi di ponsel dan komputer, dapat dipakai dengan papan
  ketik, dan menghormati pengaturan "kurangi animasi".

## 2. Struktur folder

```
/                         ← akar repositori = akar situs
├─ index.html             Beranda
├─ masuk.html             Masuk & Daftar
├─ pendaftaran.html       Formulir Pendaftaran Anggota (wajib masuk)
├─ dashboard.html         Dasbor anggota (wajib masuk)
├─ anggota.html           Profil Anggota & KTA (khusus anggota Aktif)
├─ pustaka.html           Produk Pengetahuan (publik; berkas khusus anggota Aktif)
├─ admin.html             Konsol Admin (khusus admin)
├─ instruktur.html        Direktori Instruktur + formulir permintaan instruktur
├─ sertifikat.html        Verifikasi sertifikat kegiatan (nomor sertifikat / kode QR)
├─ toko.html              Toko PPAPI (katalog)
├─ keranjang.html         Keranjang belanja (noindex)
├─ pesanan.html           Pesanan Saya (wajib masuk; noindex)
├─ profil.html, berita.html, agenda.html, regulasi.html, keanggotaan.html,
│  verifikasi.html, umpan-balik.html, kebijakan-privasi.html, 404.html
├─ aplikasi/              Aplikasi anggota (perencanaan/, simulator/, gate.js)
├─ pustaka/               (opsional) berkas PDF Produk Pengetahuan yang PUBLIK
├─ firestore.rules        Aturan keamanan database Firestore
├─ robots.txt             Izin perayapan mesin pencari
├─ README.md              Panduan ini
├─ .nojekyll              Wajib ada untuk GitHub Pages (jangan dihapus)
└─ assets/
   ├─ css/main.css        Desain bersama (warna, huruf, komponen)
   ├─ css/pages/*.css     Gaya khusus tiap halaman
   ├─ js/config.js        ★ PENGATURAN SITUS (boleh diubah)
   ├─ js/core.js          Mesin tampilan & sesi bersama (jangan diubah)
   ├─ js/auth.js          Login: Firebase (produksi) atau mode uji pengembang (jangan diubah)
   ├─ js/store.js         Data anggota, pendaftaran, admin, konten (jangan diubah)
   ├─ js/store-*.js       Data fitur tambahan: instruktur, kegiatan, toko, aplikasi (jangan diubah)
   ├─ js/kegiatan-saya.js Panel pendaftaran/daftar hadir/sertifikat + bagian "Kegiatan Saya" 
   ├─ js/pages/*.js       Logika khusus tiap halaman
   ├─ data/*.js           ★ ISI KONTEN (boleh diubah) — lihat bagian 4
   └─ img/                Logo, foto, ikon situs
```

Berkas bertanda ★ dirancang untuk diubah oleh pengelola. Setiap berkas tersebut memuat
petunjuk berbahasa Indonesia di bagian atasnya.

## 3. Pratinjau di komputer sendiri

Cara termudah (memerlukan Python, biasanya sudah terpasang):

```bash
cd folder-situs
python -m http.server 8080
```

Lalu buka `http://localhost:8080/` di peramban. Alternatif: ekstensi **Live Server** di
Visual Studio Code. Membuka berkas langsung (klik ganda `index.html`) umumnya juga
berfungsi untuk mode uji pengembang, tetapi **login Firebase hanya berjalan melalui alamat http/https**.

## 4. Mengedit konten

Aturan umum untuk semua berkas di `assets/js/config.js` dan `assets/data/*.js`:

- Ubah **hanya teks di antara tanda kutip** `'…'`. Jangan menghapus koma, kurung `{ } [ ]`,
  atau titik dua.
- Jika teks memuat tanda kutip tunggal, pakai tanda kutip melengkung `’` (contoh: `Jum’at`).
- Tanggal selalu ditulis `TAHUN-BULAN-TANGGAL`, contoh `'2026-11-12'`.
- Simpan berkas, lalu muat ulang halaman dengan **Ctrl + F5**.
- Bila halaman tiba-tiba kosong setelah mengedit, kemungkinan ada koma/kutip yang terhapus.
  Kembalikan perubahan terakhir atau periksa di <https://jshint.com/> (tempel isi berkas).

| Berkas | Isi | Catatan |
| --- | --- | --- |
| `assets/js/config.js` | Nama, slogan, deskripsi, `siteUrl`, kontak sekretariat (`contact`), media sosial (`social`), menu (`nav`), tautan footer (`footerLinks`), aplikasi anggota (`apps`), masa berlaku keanggotaan (`masaBerlakuTahun`), iuran (`iuran`), katalog Produk Pengetahuan (`pustaka.katalogPublik`), konfigurasi Firebase | Isian kontak/sosial yang kosong otomatis disembunyikan. `iuran.aktif: true` menampilkan langkah pembayaran pada formulir pendaftaran — isi hanya dengan data resmi. |
| `assets/data/berita.js` | Berita (`PPAPI_DATA.berita`) dan pengumuman (`PPAPI_DATA.pengumuman`) | Berisi artikel edukasi/regulasi/organisasi tulisan Redaksi PPAPI dengan sitasi dan "Daftar Pustaka" bergaya APA 7 (teks di antara `*bintang*` dicetak miring; paragraf setelah `## Daftar Pustaka` ditata sebagai rujukan). Berita terbaru di paling atas. `pengumuman` masih kosong (`[]`). Dapat juga dikelola dari Konsol Admin (bagian 7). |
| `assets/data/agenda.js` | Agenda kegiatan | **Kosong (`[]`)** sampai ada kegiatan resmi — halaman Agenda, Beranda, Berita, dan Dasbor menampilkan keadaan kosong yang rapi. Format butir ada di komentar berkas. Kegiatan yang sudah lewat otomatis masuk "Telah Berlangsung". |
| `assets/data/pustaka.js` | **Produk Pengetahuan** (standar, CoP, petunjuk teknis, modul pelatihan, formulir, kajian, aplikasi) | Saat ini hanya berisi dua aplikasi anggota; koleksi dokumen terisi setelah dokumen resmi terbit (di sini atau lewat Konsol Admin). Lihat bagian 7.3 tentang tempat menaruh berkas. |
| `assets/data/regulasi.js` | Pustaka regulasi & standar (tampil juga sebagai kategori "Peraturan Perundangan" di Produk Pengetahuan) | Isi awal telah diverifikasi dari sumber resmi (isian `sumber`). `kunci: true` tampil di dasbor. |
| `assets/data/organisasi.js` | Tentang, visi-misi, nilai, layanan, sejarah, pengurus, legalitas, makna logo, angka, FAQ, kategori & alur keanggotaan | `sejarah`, `pengurus`, `legalitas`, misi (= maksud dan tujuan Pasal 3), dan syarat keanggotaan bersumber dari Akta Pendirian No. 01/2022 dan SK Menkumham AHU-0008151.AH.01.07.Tahun 2022. Cantumkan hanya nama dan jabatan pengurus (tanpa NIK/alamat). Perbarui setelah ada akta perubahan atau pergantian pengurus melalui Rapat Umum Anggota. |
| `assets/data/anggaran-dasar.js` | Naskah Anggaran Dasar (halaman `anggaran-dasar.html`) | Disalin pasal demi pasal dari akta (ejaan disesuaikan). Ubah hanya bila ada akta perubahan Anggaran Dasar (Pasal 30–31). |
| `assets/data/kode-etik.js` | Naskah Kode Etik (halaman `kode-etik.html`) | Isi `penetapan.nomor` dan `penetapan.tanggal` setelah Keputusan Pengurus ditandatangani; perubahan isi ditetapkan Pengurus (Pasal 14), lalu naikkan `versi` dan `diperbarui`. |
| `assets/data/kompetensi.js` | Katalog kompetensi, tingkat, penerbit sertifikat | Dipakai pada formulir pendaftaran dan profil anggota. |
| `assets/data/registry.js` | Daftar verifikasi publik statis | **Kosong (`[]`)**. Daftar verifikasi yang berlaku terisi otomatis dari persetujuan keanggotaan di Konsol Admin (Firestore `registry`). Isi berkas ini hanya bila perlu menambahkan anggota lama secara manual — data terbatas saja. |

**Gambar**: simpan foto baru di `assets/img/` (format `.webp` atau `.jpg`, lebar ≤ 2000 px),
lalu tulis alamatnya, misalnya `gambar: 'assets/img/nama-foto.webp'`.

**Kredit pengembang**: baris paling bawah footer setiap halaman memuat teks kecil
"Dikembangkan oleh mrezahuzain@2026" (disusun oleh `core.js`; aplikasi anggota memuat kredit
yang sama di footer-nya). Teks ini merupakan ketentuan klien — jangan diubah, dan jangan
menambahkan kredit, merek, atau nama pihak lain di situs maupun di aplikasi anggota.

**Logo**: berkas induk `logo-color.png`, `logo-light.png`, dan `logo-mono-dark.png` (1200 px)
memiliki versi ringan `-sm.webp`; `logo-light-mark.webp` adalah logo tanpa tulisan kecil untuk
header. Bila logo diganti, perbarui juga versi-versi tersebut.

### Situs produksi tanpa konten contoh (15 dan 21 Oktober 2026)

Atas permintaan klien, seluruh konten contoh (berita, pengumuman, agenda, daftar verifikasi,
rancangan dokumen Produk Pengetahuan, tonggak sejarah, dan nama pengurus sementara) telah
dihapus dari berkas data (15 Oktober). Pada 21 Oktober label **"Contoh"** terakhir (visi, misi,
nilai, makna logo, dan kategori keanggotaan) juga dihapus; teksnya dirumuskan ulang sebagai
komitmen umum perkumpulan. Pilihan "Tandai sebagai konten contoh" di Konsol Admin telah
ditiadakan, dan pada Mode Firebase situs tidak pernah menampilkan lencana "Contoh" walaupun
ada data lama yang masih membawa tanda itu.

**Menambah berita.** Dua cara: (1) tempel blok baru di paling atas `PPAPI_DATA.berita` pada
`assets/data/berita.js` mengikuti petunjuk di kepala berkas — gunakan `'## '` untuk
subjudul, `'- '` untuk butir, `*teks*` untuk judul karya yang dicetak miring, dan akhiri
dengan `'## Daftar Pustaka'` diikuti entri rujukan bila artikel memakai sitasi; atau
(2) Konsol Admin › Konten › Berita (tanpa menyunting berkas; lihat bagian 7). Hal yang sama
berlaku untuk pengumuman dan agenda — selama daftar kosong, halaman menampilkan keadaan
kosong, bukan ruang kosong.

Informasi yang **belum diketahui secara resmi sengaja dikosongkan**: alamat dan kontak
sekretariat, media sosial, nama pengurus, tanggal pendirian, nomor legalitas, dan besaran
iuran. Mohon hanya mengisinya dengan data yang dapat dipertanggungjawabkan.

## 5. Alur keanggotaan

| Status | Arti | Diubah oleh |
| --- | --- | --- |
| **Draf** | Akun sudah dibuat, formulir pendaftaran belum diajukan | sistem (akun baru) |
| **Menunggu Verifikasi** | Formulir telah diajukan, menunggu pemeriksaan sekretariat | anggota (ajukan) |
| **Perlu Perbaikan** | Sekretariat mengembalikan formulir dengan catatan | admin |
| **Aktif** | Disetujui; nomor KTA dan masa berlaku ditetapkan | admin |
| **Ditolak** | Tidak disetujui (dengan alasan); pemohon dapat mengajukan kembali | admin |
| **Nonaktif** | Keanggotaan dibekukan sementara | admin |
| *Kedaluwarsa* | Tampilan otomatis untuk status Aktif yang masa berlakunya sudah lewat | (dihitung) |

1. **Buat akun** di halaman Masuk/Daftar → status **Draf**. Akun baru diarahkan ke Formulir
   Pendaftaran.
2. **Isi formulir** (tersimpan otomatis sebagai draf), lalu **Ajukan** → **Menunggu
   Verifikasi**. Selama diverifikasi, formulir **dan data yang diperiksa sekretariat** (nama,
   nomor HP, foto, profil, kompetensi, sertifikat, pas foto) terkunci, sehingga sekretariat
   menyetujui persis data yang diajukan. Pemohon dapat **menarik pengajuan** untuk
   mengubahnya kembali.
3. **Sekretariat memutuskan** di Konsol Admin: **Setujui** (kategori, masa berlaku, catatan),
   **Minta Perbaikan** (catatan wajib) atau **Tolak** (alasan wajib).
4. Saat disetujui, **nomor KTA terbit otomatis** berurutan per tahun: `PPAPI-2026-000001`,
   `PPAPI-2026-000002`, … (nomor yang sudah ada tetap dipakai), masa berlaku diusulkan
   **31 Desember tahun berjalan + `masaBerlakuTahun`** (bawaan 3 tahun) dan anggota
   otomatis tercantum di **Verifikasi Anggota**.
5. **Fitur anggota terbuka**: KTA digital, Profil Anggota, berkas Produk Pengetahuan, dan
   aplikasi anggota. **Nama lengkap** (dan tanggal lahir yang sudah terisi) yang telah
   disetujui tidak dapat diubah lagi oleh anggota — nama itu tercetak pada KTA dan tercantum
   di daftar Verifikasi Anggota. Koreksi nama dilakukan sekretariat di Firebase Console:
   ubah `name` pada `members/{uid}` **dan** `nama` pada `registry/{nomor KTA}`. Nama pada
   kartu langsung mengikuti daftar verifikasi; kunci pencarian nama ikut diperbarui pada
   tindakan admin berikutnya untuk anggota tersebut (mis. Perpanjang).
6. **Perpanjangan**: anggota yang masa berlakunya habis, akan habis dalam ≤ 60 hari, atau
   berstatus Nonaktif dapat mengajukan **perpanjangan** melalui formulir yang sama →
   Menunggu Verifikasi → disetujui admin (KTA tetap). Catatan: selama pengajuan
   perpanjangan diperiksa, fitur anggota terkunci; bila pengajuan ditarik, status menjadi
   **Draf** (bukan kembali Aktif) sampai diajukan dan disetujui lagi. Bila sekretariat
   **menolak** atau **meminta perbaikan** atas pengajuan perpanjangan, keanggotaan kembali ke
   keadaan sebelum pengajuan — **Aktif** (dengan masa berlaku dan nomor KTA yang sama; tampil
   *Kedaluwarsa* bila masa berlakunya sudah lewat) atau **Nonaktif** — sehingga masa yang
   sudah disetujui tidak hilang dan data anggota tetap sesuai dengan daftar Verifikasi
   Anggota. Alasan/catatan sekretariat tetap tercatat pada riwayat anggota. Bagi anggota yang
   masih Aktif, sekretariat sebaiknya langsung memakai tombol **Perpanjang** di direktori
   anggota tanpa pengajuan.

Akun lama (dibuat sebelum versi ini) yang berstatus "Menunggu Verifikasi" tanpa formulir
otomatis dianggap **Draf** dan diminta mengisi formulir. Anggota lama yang sudah **Aktif**
tetap Aktif (tanpa masa berlaku = berlaku sampai ditetapkan sekretariat).

## 6. Konsol Admin (sekretariat)

Buka **Konsol Admin** dari menu akun (hanya tampil bagi admin) atau `admin.html`.

- **Ringkasan**: jumlah permohonan menunggu, perlu perbaikan, anggota aktif, yang akan
  kedaluwarsa (≤ 60 hari), dan umpan balik baru.
- **Permohonan**: buka permohonan untuk melihat seluruh data (pas foto, data diri, data
  profesional, pengalaman, kompetensi, sertifikat, dokumen, pernyataan, riwayat), lalu
  **Setujui / Minta Perbaikan / Tolak**. Tombol "Kirim email" membuka email ke pemohon.
- **Anggota**: cari, saring, ubah kategori, perpanjang, nonaktifkan/aktifkan, **ekspor CSV**
  (terbuka rapi di Excel berbahasa Indonesia: pemisah titik koma, UTF-8).
- **Daftar Verifikasi Anggota (publik)** memuat data yang **disetujui**: saat **Setujui**
  (pendaftaran baru atau perpanjangan), nama, kompetensi utama, dan kota dari data yang baru
  diperiksa dicatat ke daftar. Tindakan lain (**Perpanjang**, **Ubah kategori**,
  **Nonaktifkan**, **Aktifkan kembali**) hanya memperbarui kategori, masa berlaku, dan status,
  sehingga data yang diubah anggota setelah disetujui tidak ikut terbit tanpa diperiksa.
- **Konten**, **Umpan Balik** (status Baru/Diproses/Selesai + catatan), **Admin** (tambah
  dengan email akun yang sudah terdaftar **dan terverifikasi**, hapus), dan **Log Aktivitas**
  (setiap keputusan tercatat: siapa, kapan, apa).
- **Instruktur** (bagian 16), **Kegiatan** (bagian 17), dan **Toko** (bagian 18). Angka kecil di
  menu konsol menandai permintaan instruktur baru dan pesanan yang perlu ditindaklanjuti.
- **Konten › Agenda** kini disebut *agenda sederhana*: hanya pengumuman jadwal tanpa
  pendaftaran. Kegiatan yang memerlukan pendaftaran, daftar hadir, atau sertifikat dibuat di
  bagian **Kegiatan**; kegiatan yang terbit otomatis tampil di halaman Agenda, Beranda, dan
  Dasbor.

### 6.1 Admin pada mode uji pengembang (Mode Demo)

Bagian ini hanya untuk pengembang yang menjalankan salinan situs dengan `apiKey` kosong
(misalnya di komputer sendiri atau oleh uji otomatis). Mode ini menyiapkan satu akun admin uji
dan empat data uji agar konsol dapat dicoba tanpa Firebase:

- Email **`admin@ppapi.demo`**, kata sandi **`AdminPPAPI2026`**.

Data uji hanya tersimpan di peramban yang dipakai dan tidak pernah ada di situs produksi.
Hapus data situs di peramban untuk memulai ulang.

### 6.2 Membuat admin PERTAMA pada Mode Firebase (sekali saja)

1. Orang yang akan menjadi admin **mendaftar** di situs (Masuk/Daftar) seperti anggota biasa
   dan **membuka tautan verifikasi** yang dikirim ke emailnya (akun Google sudah terverifikasi).
2. Buka <https://console.firebase.google.com> › proyek › **Authentication › Users**, cari
   email tersebut, salin **User UID**.
3. Buka **Firestore Database › Data** › **Start collection** (atau pilih koleksi
   `admins` bila sudah ada). Isi **Collection ID**: `admins`.
4. **Document ID**: tempel User UID. Tambahkan kolom (semua bertipe *string*):
   `uid` = User UID, `name` = nama, `email` = email, `addedAt` = tanggal hari ini
   (mis. `2026-10-09`), `addedBy` = `console`. Klik **Save**.
5. Admin tersebut keluar lalu masuk kembali di situs — menu akun kini memuat **Konsol Admin**.
6. Admin berikutnya cukup ditambahkan dari **Konsol Admin › Admin** dengan email akun yang
   sudah terdaftar **dan terverifikasi**. Admin terakhir tidak dapat menghapus dirinya sendiri.

> **Keamanan saat menambah admin.** Konsol Admin mencari calon admin berdasarkan kolom email
> pada data anggota. Kolom itu hanya terisi setelah pemilik akun **membuktikan emailnya**
> (membuka tautan verifikasi yang dikirim otomatis saat mendaftar; akun Google sudah
> terverifikasi) — aturan Firestore menolak email yang belum diverifikasi. Dengan demikian,
> orang lain tidak dapat "memesan" alamat email calon staf sekretariat lalu ikut menjadi
> admin. Tetap minta calon admin **mendaftar, memverifikasi email, dan masuk sendiri lebih
> dulu**, lalu cocokkan nama serta tanggal akunnya di **Konsol Admin › Anggota** sebelum
> menambahkannya. Bila satu email tercatat pada lebih dari satu data anggota, konsol menolak
> penambahan — periksa datanya di Firebase Console.
>
> Bila calon admin tidak menerima email verifikasi, minta ia memeriksa folder spam. Bila tetap
> tidak ada, hapus akun tersebut di Firebase Console › **Authentication › Users** dan minta ia
> mendaftar ulang.

## 7. Mengelola konten & Produk Pengetahuan

### 7.1 Dua sumber konten

- **Berkas data** (`assets/data/*.js`): diubah lewat GitHub, berlaku untuk semua pengunjung
  setelah *commit*. Cocok untuk isi dasar dan perubahan besar.
- **Konsol Admin › Konten** (berita, pengumuman, agenda, produk pengetahuan, regulasi):
  menambah butir baru, **mengubah** butir bawaan (tersimpan sebagai pengganti), atau
  **menyembunyikan** butir bawaan (dapat **dipulihkan**). Pada Mode Firebase tersimpan di
  Firestore (`content_berita`, `content_pengumuman`, `content_agenda`, `content_pustaka`,
  `content_regulasi`) dan langsung tampil bagi semua pengunjung. Pada mode uji pengembang perubahan
  hanya tersimpan di peramban yang dipakai.

Situs menggabungkan keduanya: butir dari konsol dengan `id` yang sama menggantikan butir
bawaan.

### 7.2 Produk Pengetahuan

Kategori: Standar, Code of Practice, Peraturan Perundangan (dari `regulasi.js`), Petunjuk
Teknis, Modul Pelatihan, Formulir & Daftar Periksa, Kajian Teknis, Aplikasi. Setiap dokumen
memiliki `akses`: `'publik'` (siapa saja) atau `'anggota'` (khusus anggota Aktif). Bila
`config.pustaka.katalogPublik` = `true`, pengunjung tetap melihat judul dan ringkasan dokumen
khusus anggota dalam keadaan terkunci; bila `false`, mereka hanya melihat panel "Khusus
Anggota Aktif".

### 7.3 Di mana menaruh berkas dokumen

- **Dokumen publik**: simpan PDF di folder `pustaka/` di repositori, lalu isi
  `tautan: 'pustaka/nama-berkas.pdf'`. Berkas di folder situs dapat diunduh siapa saja.
- **Dokumen khusus anggota**: **jangan** taruh di repositori dan **jangan** tulis tautannya di
  `pustaka.js` (berkas itu dapat dibaca siapa saja). Unggah ke penyimpanan sekretariat
  (mis. Google Drive), lalu tempel tautannya di **Konsol Admin › Konten › Produk
  Pengetahuan** (isian tautan berkas, akses "Khusus anggota"). Pada Mode Firebase tautan itu
  disimpan terpisah di koleksi `pustaka_files`, yang **hanya dapat dibaca anggota berstatus
  Aktif dan admin**. Perlu diingat: siapa pun yang sudah memegang tautannya tetap dapat
  membuka berkas sesuai pengaturan berbagi di Google Drive — untuk dokumen yang sangat
  rahasia, bagikan berkas Drive hanya kepada akun tertentu.

## 8. Aplikasi anggota (Beta)

| Aplikasi | Folder | Isi |
| --- | --- | --- |
| PPAPI Scaffold (Beta) — Perencanaan & Analisis Struktur **v2.4.0** | `aplikasi/perencanaan/` | Perencanaan dan inspeksi perancah sembilan tahap: data proyek, beban hidup, kelas beban (duty) & stabilitas, gambar rencana, material, analisis struktur indikatif, JSA, daftar periksa (10 kategori, 52 butir), laporan PDF & label perancah. |
| Simulator Pemasangan Perancah Tube & Coupler (Beta) | `aplikasi/simulator/` | Pelatihan virtual 20 tahap pemasangan perancah tubular — dari persiapan dan tag merah, lantai berpagar, tangga dan pintu akses, hingga inspeksi serah terima yang mengukur adegan dan tag hijau — serta pengenalan komponen dan klem. |

Keduanya dibuka dari Dasbor, Profil Anggota (`anggota.html#aplikasi`), dan Produk
Pengetahuan. Penjaga akses `aplikasi/gate.js` hanya mengizinkan anggota Aktif dan admin
(pengunjung lain diarahkan ke halaman masuk atau dasbor) dan menampilkan bilah "Portal Anggota
PPAPI" di bagian atas. Anggota cukup masuk dengan akun situs — tidak perlu akun terpisah.
Hasil perhitungan bersifat indikatif dan perlu diverifikasi tenaga ahli yang kompeten.

**Status Beta.** Metode perhitungan aplikasi perencanaan dan geometri/urutan simulator telah
dikoreksi atas persetujuan pemilik aplikasi dan **menunggu tinjauan Komite Teknis PPAPI**. Label
Beta dicabut setelah Komite menyetujuinya. Dokumen yang perlu ditinjau:

- [`aplikasi/KOREKSI-PERHITUNGAN.md`](aplikasi/KOREKSI-PERHITUNGAN.md) — koreksi metode
  perhitungan v2.3.0–v2.4.0 (rumus sebelum/sesudah, sumber, contoh numerik, asumsi, dan
  pertanyaan terbuka di §17 dan §19);
- [`aplikasi/KOREKSI-SIMULATOR.md`](aplikasi/KOREKSI-SIMULATOR.md) — koreksi geometri dan
  urutan 20 tahap simulator (pertanyaan terbuka di §7);
- [`aplikasi/CATATAN.md`](aplikasi/CATATAN.md) — catatan porting, keamanan, data per anggota,
  dependensi (jsPDF dan three.js dari cdnjs dengan pemeriksaan integritas), dan pengujian.

Data kerja aplikasi (proyek perencanaan, kemajuan simulator) **melekat ke akun** anggota
sejak 21 Oktober 2026 (bagian 19). Kredit pengembang pada aplikasi mengikuti arahan
klien ("Dikembangkan oleh mrezahuzain@2026"); isian `penyusun` aplikasi di
`assets/data/pustaka.js` sengaja dikosongkan sampai klien memutuskan apakah isian itu diisi.
Nama aplikasi perencanaan di `config.js` (`apps`) dan di katalog memuat tanda **"(Beta)"**;
hapus tanda itu bersama label Beta di dalam aplikasi setelah tinjauan Komite Teknis selesai.

**Batasan jujur**: pada hosting statis (GitHub Pages) berkas HTML/JavaScript aplikasi tetap
dapat diunduh siapa saja yang mengetahui alamatnya. Penjaga akses mengatur **pengalaman
portal** (siapa yang diarahkan ke aplikasi), bukan kerahasiaan kode. Data anggota yang
sebenarnya dilindungi oleh aturan Firestore (bagian 10).

## 9. Mode uji pengembang (Mode Demo) vs. Mode Firebase (produksi)

Situs produksi <https://ppapi.or.id/> selalu berjalan dalam **Mode Firebase**. Mode Demo adalah
mode uji untuk pengembang dan uji otomatis; pengunjung situs produksi tidak pernah melihatnya.

| | **Mode Demo** (uji pengembang) | **Mode Firebase** (produksi) |
| --- | --- | --- |
| Aktif bila | `firebase.apiKey` di `config.js` kosong | `firebase.apiKey` terisi |
| Akun, pendaftaran & data anggota | Tersimpan **hanya di peramban** yang dipakai | Tersimpan di Firebase (dapat diakses dari perangkat mana pun) |
| Admin | `admin@ppapi.demo` / `AdminPPAPI2026` + 4 data uji | Admin pertama dibuat di Firebase Console (bagian 6.2) |
| Kode OTP nomor HP | Selalu **123456** | Dikirim melalui SMS |
| Masuk dengan Google | Simulasi (isi nama & Gmail) | Jendela resmi Google |
| Konten dari Konsol Admin, umpan balik | Tersimpan di peramban | Tersimpan di Firestore, tampil bagi semua pengunjung |

Pada Mode Demo, halaman masuk/anggota/admin menampilkan pita **"Mode Demo"** sebagai pengingat
bagi pengembang. Pita, catatan akun admin uji di halaman masuk, dan lencana "Contoh" tidak
dirender sama sekali pada Mode Firebase (diperiksa oleh `devtools/flows/produksi-bersih.mjs`).

## 10. Mengaktifkan Firebase (login sebenarnya)

1. Buka <https://console.firebase.google.com>, klik **Add project / Buat proyek**, beri nama
   (mis. `ppapi-web`). Google Analytics boleh dinonaktifkan.
2. Di *Project Overview*, klik ikon **Web (`</>`)**, isi nama aplikasi, klik **Register app**.
   Salin nilai `firebaseConfig` (apiKey, authDomain, projectId, storageBucket,
   messagingSenderId, appId) ke bagian `firebase` di `assets/js/config.js`.
   Nilai ini **bukan rahasia** — keamanan data diatur oleh `firestore.rules`.
3. Buka **Security › Authentication** › **Get started**. Pada tab **Sign-in method**,
   aktifkan **Email/Password**.
4. Pada tab yang sama, aktifkan **Google** dan pilih *project support email*.
5. Buka **Settings › Authorized domains** › **Add domain**, tambahkan
   `<username>.github.io` (tanpa `https://` dan tanpa nama repositori — untuk situs saat ini:
   `anakabil.github.io`), serta domain kustom bila ada. Proyek yang dibuat setelah 28 April 2025 tidak lagi otomatis
   mengizinkan `localhost`.
6. *(Opsional — login nomor HP)* Lihat bagian 12 tentang biaya. Aktifkan penyedia **Phone**;
   buka **Settings › SMS region policy**, pilih **Allow**, centang hanya **Indonesia (ID)**.
   Tambahkan nomor uji di **Phone numbers for testing** (maks. 10 nomor fiktif + kode 6 digit).
7. Buka **Databases & Storage › Firestore** › **Create database**. Pilih edisi
   **Standard**, lokasi **asia-southeast2 (Jakarta)** (tidak dapat diubah kemudian), dan
   **Production mode**.
8. Pada tab **Rules** Firestore, ganti seluruh isi dengan isi berkas `firestore.rules`,
   lalu klik **Publish** (lihat bagian 11). Konsol akan menolak aturan yang salah tulis.
9. Buat **admin pertama** (bagian 6.2).
10. **Jangan** mengaktifkan Cloud Storage (kini mewajibkan paket berbayar Blaze). Sertifikat,
    dokumen pendaftaran, dan dokumen khusus anggota dicatat sebagai tautan `https://`
    (mis. Google Drive); pas foto disimpan sebagai gambar JPEG kecil (≤ 120 KB) di koleksi
    terpisah `member_photos/{uid}`, sehingga daftar anggota di Konsol Admin tetap ringan.
11. Pastikan `firebaseSdkVersion: '12.4.0'` di `config.js`, lalu *commit* dan *push*.
    Berkas Firebase SDK dimuat dengan pemeriksaan integritas (SRI); lihat "Memperbarui versi
    Firebase SDK" di bawah sebelum mengganti versinya.
12. Uji di `https://<username>.github.io/<repo>/masuk.html`: daftar dengan email, isi dan
    ajukan formulir, lalu setujui dari akun admin; periksa dokumen `members/{uid}`,
    `registry/{kta}`, dan `audit_log` di Firestore.
13. Untuk menguji tanpa Firebase di salinan lokal, kosongkan `apiKey` di `config.js` (mode uji
    pengembang). Jangan menerbitkan situs dengan `apiKey` kosong.

Email verifikasi: saat mendaftar dengan email & kata sandi, situs otomatis mengirim tautan
verifikasi. Templat dan bahasa email dapat diatur di **Authentication › Templates › Email
address verification**. Selama email belum diverifikasi, Dasbor menampilkan pemberitahuan
dengan tombol **Kirim Ulang Tautan** dan **Saya Sudah Memverifikasi**; setelah tautan dibuka,
email tercatat pada data anggota (saat tombol itu ditekan atau ketika pemilik akun membuka
situs berikutnya). Email yang belum diverifikasi tidak dicatat dan tidak dapat dijadikan admin.

### Kebijakan Keamanan Konten (CSP)

Setiap halaman memuat `<meta http-equiv="Content-Security-Policy">` yang hanya mengizinkan
skrip dari situs sendiri, Firebase/Google (`www.gstatic.com`, `apis.google.com`,
`www.google.com` untuk reCAPTCHA), dan — khusus dua halaman aplikasi — `cdnjs.cloudflare.com`
(jsPDF dan three.js); gaya dan huruf dari Google Fonts; koneksi ke `*.googleapis.com` dan
`*.firebaseio.com`; bingkai dari `*.firebaseapp.com`/`*.web.app` dan `www.google.com` (login
Google, reCAPTCHA, peta Google). Bila kelak menambahkan layanan pihak ketiga lain atau memakai
`authDomain` Firebase selain `<proyek>.firebaseapp.com`, tambahkan alamatnya pada tag tersebut
di **semua** halaman (teksnya sama di setiap halaman; dua halaman aplikasi menambahkan
`https://cdnjs.cloudflare.com`). Pelanggaran tampil sebagai galat "Refused to load …" di konsol
peramban.

Pengecualian fitur tambahan: `agenda.html`, `dashboard.html`, dan `admin.html` juga mengizinkan
`https://cdnjs.cloudflare.com` (jsPDF untuk sertifikat) dan bingkai `https://docs.google.com`
(Google Form penyelenggara yang ditanam di halaman); `pesanan.html` dan `admin.html` mengizinkan
`https://cdnjs.cloudflare.com` serta cadangan `https://cdn.jsdelivr.net` (pdf-lib untuk tanda
air soft file). Semua pustaka itu dimuat dengan pemeriksaan integritas (SRI).

### Memperbarui versi Firebase SDK

`assets/js/auth.js` memuat hash SRI (`sha384`) untuk setiap berkas SDK versi yang dipakai
(`SDK_SRI`). Peramban menolak berkas yang isinya tidak sama dengan hash tersebut. Saat
menaikkan `firebaseSdkVersion`:

1. Hitung hash keempat berkas versi baru, misalnya di terminal:
   `curl -s https://www.gstatic.com/firebasejs/<versi>/firebase-app-compat.js | openssl dgst -sha384 -binary | openssl base64 -A`
   (ulangi untuk `firebase-auth-compat.js`, `firebase-firestore-compat.js`, dan
   `firebase-app-check-compat.js`).
2. Tambahkan entri `'<versi>': { … }` berisi keempat hash (diawali `sha384-`) ke `SDK_SRI`.
3. Ubah `firebaseSdkVersion` di `config.js`, lalu uji masuk/daftar sebelum *push*.

Versi tanpa hash tetap dimuat, dengan peringatan di konsol peramban.

Rujukan: [Memulai Firebase Auth](https://firebase.google.com/docs/auth/web/start),
[Verifikasi email](https://firebase.google.com/docs/auth/web/manage-users#send_a_user_a_verification_email),
[Subresource Integrity](https://developer.mozilla.org/docs/Web/Security/Subresource_Integrity),
[Login nomor HP](https://firebase.google.com/docs/auth/web/phone-auth),
[Login Google](https://firebase.google.com/docs/auth/web/google-signin),
[Firestore quickstart](https://firebase.google.com/docs/firestore/quickstart),
[Aturan keamanan](https://firebase.google.com/docs/firestore/security/get-started).

## 11. Aturan Firestore v2 (`firestore.rules`)

Prinsip: setiap pihak hanya mendapat akses seminimal mungkin.

| Koleksi | Baca | Tulis |
| --- | --- | --- |
| `members/{uid}` | pemilik akun, admin | Pemilik: hanya profil (nama, kontak, profil, kompetensi, sertifikat; email hanya boleh email akun yang dipakai masuk **dan sudah terverifikasi**) dan formulir pendaftaran, dengan perubahan status terbatas: **Draf/Perlu Perbaikan/Ditolak → Menunggu Verifikasi** (mengajukan formulir lengkap: kategori, nama, ketiga pernyataan, nama terang), **Menunggu Verifikasi → Draf** (menarik), **Aktif kedaluwarsa (≤ 60 hari)/Nonaktif → Menunggu Verifikasi** (perpanjangan). Selama diverifikasi, formulir dan data yang diperiksa (nama, HP, foto, profil, kompetensi, sertifikat) terkunci. Setelah keanggotaan pernah disetujui, nama lengkap tidak dapat diubah anggota. Kategori yang dapat diajukan sendiri: Praktisi, Ahli (Kehormatan hanya bagi pemegangnya saat perpanjangan). Waktu pengajuan dan pembaruan ditetapkan server (tidak dapat dipilih anggota). Kolom sekretariat (`kta`, `memberType`, `validUntil`, `approvedAt`, `approvedBy`, `review`, `joinedAt`, `createdAt`) tidak dapat diubah anggota. Akun baru selalu Draf tanpa KTA. Admin: semua. Hapus: ditolak. |
| `member_photos/{uid}` | pemilik akun, admin | pemilik (hanya saat formulir boleh diubah; JPEG ≤ 120 KB), admin |
| `admins/{uid}` | diri sendiri, admin | admin |
| `registry/{kta}` | siapa saja: satu nomor KTA, atau pencarian maksimal 20 hasil per permintaan (daftar tidak dapat diunduh sekaligus) | admin (hanya kolom publik terbatas) |
| `content_*/{id}` | siapa saja | admin |
| `pustaka_files/{id}` | admin, anggota **Aktif** yang masa berlakunya belum habis | admin |
| `feedback/{id}` | admin | kirim: siapa saja (isian divalidasi); ubah status & catatan: admin (tercatat atas nama admin tersebut); hapus: ditolak |
| `counters/{id}` | admin | admin (nomor urut KTA) |
| `audit_log/{id}` | admin | admin, hanya menambah (tidak dapat diubah/dihapus) |
| `instructors/{id}` | siapa saja, **hanya profil yang diterbitkan** (`published == true`); admin: semua | admin |
| `instructor_contacts/{id}` | admin | admin (email/telepon instruktur, akun tertaut, catatan) |
| `instructor_requests/{id}` | admin | kirim: siapa saja (divalidasi, status Baru, waktu server); ubah status & catatan: admin; hapus: ditolak |
| `events/{id}` | siapa saja bila **terbit**; admin: semua | admin; peserta hanya menambah/mengurangi jumlah terdaftar tepat 1 bersama pendaftarannya dan menaikkan nomor urut sertifikat tepat 1 |
| `events/{id}/private/ruang` | admin, peserta terdaftar | admin |
| `events/{id}/participants/{uid}` | pemilik, admin | pemilik sesuai akses kegiatan (semua akun / anggota Aktif); admin |
| `events/{id}/attendance/{uid}` | pemilik, admin | peserta terdaftar, **hanya** antara 30 menit sebelum dan 3 jam sesudah kegiatan selesai (waktu server); admin |
| `events/{id}/assets/certificate` | admin, peserta yang sudah hadir | admin |
| `events/{id}/assets/flyer` | publik bila kegiatan terbit; admin | admin (JPEG ≤ 900 KB) |
| `cert_settings/penandatangan` | akun yang masuk | admin (nama, jabatan, PNG tanda tangan ≤ 300 KB) |
| `certificates/{nomor}` | siapa saja per nomor (daftar: admin) | dibuat peserta yang hadir, sekali; cabut/pulihkan: admin |
| `products/{id}`, `product_media/{id}` | siapa saja (produk **aktif**); admin: semua | admin |
| `product_files/{id}` | admin, pembeli yang memiliki hak unduh | admin |
| `entitlements/{uid}_{produk}` | pemilik, admin | admin (saat mengonfirmasi pembayaran) |
| `orders/{nomor}` | pemilik pesanan, admin | pembeli membuat pesanan atas namanya; selama belum dibayar hanya menambah bukti bayar atau membatalkan; admin memperbarui; hapus: ditolak |
| `shop_settings/main` | siapa saja | admin |
| `carts/{uid}` | pemilik | pemilik |
| `app_data/{uid}/…` | pemilik, admin (baca saja, untuk bantuan teknis) | pemilik |
| koleksi lain | ditolak | ditolak |

Setiap kali berkas ini diubah, salin ulang ke Firebase Console › Firestore › Rules › **Publish**.

> **Wajib setelah pembaruan 21 Oktober 2026:** `firestore.rules` kini memuat aturan Instruktur,
> Kegiatan & sertifikat, Toko, dan data aplikasi. **Salin seluruh isi berkas ke Firebase Console
> › Firestore › Rules, lalu klik Publish.** Sebelum aturan baru diterbitkan, pada Mode Firebase
> fitur-fitur tersebut ditolak database (pesan "izin ditolak"), sedangkan fitur lama tetap
> berjalan. Tidak ada indeks komposit yang perlu dibuat. Berkas tetap jauh di bawah batas ukuran
> aturan Firestore (256 KB); setiap permintaan memakai beberapa puluh ekspresi saja (batas 1.000).

### Menahan kiriman otomatis (App Check) — disarankan setelah Firebase aktif

Formulir umpan balik dapat diisi siapa saja, sehingga dapat disalahgunakan oleh program
otomatis (bot). Firebase **App Check** memastikan permintaan benar-benar berasal dari situs ini:

1. Buat kunci **reCAPTCHA v3** di <https://www.google.com/recaptcha/admin> (tipe *Score based /
   v3*), daftarkan domain situs (mis. `<username>.github.io`). Salin **site key** dan
   **secret key**.
2. Di Firebase Console › **App Check** › **Apps**, pilih aplikasi web, pilih penyedia
   **reCAPTCHA**, tempel *secret key*, simpan.
3. Isi `appCheckSiteKey` di `assets/js/config.js` dengan *site key*, lalu *commit* dan *push*.
4. Pantau grafik permintaan di App Check selama beberapa hari. Bila hampir semua permintaan
   sudah "verified", klik **Enforce** untuk **Cloud Firestore** (dan **Authentication** bila
   tersedia). Jangan menekan *Enforce* sebelum langkah 3 terpasang — situs akan ditolak.

Rujukan: [App Check untuk web](https://firebase.google.com/docs/app-check/web/recaptcha-provider).

## 12. Biaya & batasan login nomor HP

- Sejak September 2024, SMS OTP Firebase **mewajibkan paket Blaze** (akun penagihan Google
  Cloud). Tanpa itu, login nomor HP gagal dengan pesan "Layanan verifikasi melalui SMS
  belum aktif" — login email dan Google tetap berjalan.
  ([FAQ Firebase Auth](https://firebase.google.com/docs/auth/faq-and-troubleshooting))
- Tarif per SMS untuk Indonesia tercantum sekitar **US$0,35** (dicek 8 Oktober 2026);
  periksa harga terbaru di <https://cloud.google.com/identity-platform/pricing> sebelum
  peluncuran.
- Batas bawaan: 3.000 SMS/hari per proyek dan pembatasan per alamat IP/nomor.
  ([Batas Firebase Auth](https://firebase.google.com/docs/auth/limits))
- Pasang *budget alert* di Google Cloud Billing; perlu diingat alert **tidak** menghentikan
  layanan secara otomatis. Batasi wilayah SMS hanya untuk Indonesia (langkah 6).
- Login nomor HP **tidak dapat diuji dari `localhost`** — uji di alamat github.io dengan
  nomor uji.
- Paket gratis (Spark) mencukupi untuk email, Google, dan Firestore skala kecil
  (±50.000 baca dan 20.000 tulis per hari). ([Kuota Firestore](https://firebase.google.com/docs/firestore/quotas))

## 13. Menerbitkan di GitHub Pages

**Situs saat ini** sudah terbit di <https://anakabil.github.io/ppapi-website/> dari repositori
publik `anakabil/ppapi-website` (branch `main`, folder root). Pengembang memperbaruinya dengan
skrip `devtools/deploy.sh` di folder kerja pengembang (di luar folder situs). Skrip itu:
memeriksa bahwa tidak ada label merek/kredit terlarang, menyalin isi folder situs ke salinan
repositori publik, mengisi `siteUrl` **hanya pada salinan publik** (di sumber `siteUrl` tetap
`''`), menguji halaman utama di peramban otomatis, lalu melakukan *commit* dan *push*. Riwayat
repositori publik sengaja terpisah dari riwayat pengembangan. Untuk alamat proyek seperti ini,
`SITE_ROOT` di `404.html` dapat diisi `'/ppapi-website/'` (tanpa isian pun halaman 404
mendeteksinya otomatis).

Bila menerbitkan sendiri dari awal (repositori baru):

1. Buat repositori di GitHub (mis. `ppapi`), unggah **seluruh isi folder situs** ke akar
   repositori (termasuk berkas `.nojekyll`).
2. Buka **Settings › Pages**. Pada *Build and deployment*, pilih **Deploy from a branch**,
   branch `main`, folder `/ (root)`, lalu **Save**.
3. Tunggu 1–2 menit. Situs tersedia di `https://<username>.github.io/<repo>/`.
4. *(Opsional)* Domain sendiri: isi **Custom domain** pada halaman yang sama dan ikuti
   petunjuk DNS GitHub; tambahkan domain tersebut ke *Authorized domains* Firebase.
5. Isi `siteUrl` di `config.js` dengan alamat akhir situs, mis. `https://<username>.github.io/<repo>/`
   (dipakai untuk tautan QR KTA, tautan bagikan, dan tautan kanonis). Selama kosong, situs memakai
   alamat yang sedang dibuka. (Skrip deploy pengembang mengisinya otomatis pada salinan publik.)
6. Jika situs diterbitkan dari repositori `<username>.github.io` (alamat tanpa nama repositori),
   halaman 404 mendeteksi akar situs secara otomatis; agar tanpa percobaan, isi
   `SITE_ROOT = '/'` di awal `404.html`. Untuk repositori proyek, `SITE_ROOT` dapat diisi
   `'/<repo>/'`.

Halaman `404.html` otomatis dipakai GitHub Pages untuk alamat yang tidak ditemukan. Berkas
`robots.txt` mengizinkan perayapan semua halaman; halaman anggota (Dasbor, Profil Anggota,
Formulir Pendaftaran), Konsol Admin, kedua aplikasi anggota, dan `404.html`
dijauhkan dari hasil pencarian melalui tanda `noindex` di halamannya. Catatan: `robots.txt` hanya
dibaca mesin pencari di **akar domain**; pada alamat proyek (`…github.io/ppapi-website/`) berkas
itu tidak berpengaruh, sehingga berkas pendukung (README, `aplikasi/*.md`, `firestore.rules`)
dapat terindeks — isinya memang tidak rahasia. Bila situs pindah ke domain sendiri, `robots.txt`
langsung berlaku. Sitemap dapat ditambahkan setelah alamat akhir situs ditetapkan.

## 14. Keamanan & privasi

- Konfigurasi Firebase di `config.js` memang publik; **jangan** menaruh kata sandi, token,
  atau kunci rahasia lain di berkas situs mana pun.
- Data anggota hanya dapat diakses pemiliknya dan admin (dijamin `firestore.rules`).
  Pastikan aturan sudah dipublikasikan sebelum situs diumumkan, dan batasi jumlah admin.
- **Batasan hosting statis**: halaman, berkas data, dan aplikasi di folder situs dapat
  diunduh siapa saja yang mengetahui alamatnya. Pembatasan "khusus anggota Aktif" mengatur
  tampilan portal; yang benar-benar dilindungi adalah data di Firestore (data anggota,
  tautan berkas khusus anggota, umpan balik, log). Jangan menaruh dokumen rahasia di folder
  situs.
- Daftar verifikasi publik hanya memuat nama, nomor KTA, kategori, kompetensi utama, kota,
  masa berlaku, dan status. Pada Mode Firebase, pencarian dilakukan di server (nomor KTA,
  awal nomor, awal nama, atau satu kata nama) dan dibatasi 20 hasil per permintaan, sesuai
  Kebijakan Privasi ("publik hanya dapat memeriksa data terbatas").
- `robots.txt` meminta mesin pencari tidak merayapi berkas pendukung (README, catatan
  aplikasi `*.md`, `firestore.rules`). Berkas itu tetap dapat dibuka siapa pun yang tahu
  alamatnya, jadi jangan menaruh data rahasia di dalamnya.
- Seluruh teks dari data/pengguna ditampilkan dengan pengamanan (*escaping*) untuk mencegah
  sisipan kode berbahaya; ekspor CSV menetralkan isian yang menyerupai rumus Excel. Sebagai
  lapisan tambahan, setiap halaman membatasi sumber skrip, gaya, koneksi, dan bingkai melalui
  Kebijakan Keamanan Konten (bagian 10), dan pustaka CDN aplikasi dimuat dengan pemeriksaan
  integritas (SRI).
- Mode Demo **bukan** sistem login yang aman (data tersimpan di peramban) — gunakan hanya
  untuk pengembangan dan pengujian, jangan untuk situs yang diterbitkan.
- Kebijakan Privasi situs mengacu pada UU Nomor 27 Tahun 2022 tentang Pelindungan Data
  Pribadi; perbarui teksnya bila cara pengolahan data berubah (mis. pas foto dan dokumen
  pendaftaran kini diproses sekretariat untuk verifikasi).

## 15. Pemecahan masalah

| Gejala | Penyebab umum & solusi |
| --- | --- |
| Halaman kosong/tidak lengkap setelah mengedit data | Ada koma atau tanda kutip yang hilang. Batalkan perubahan terakhir. |
| "Domain situs ini belum diizinkan…" | Tambahkan domain ke *Authorized domains* (bagian 10, langkah 5). |
| "Jendela masuk Google diblokir…" | Izinkan *pop-up* untuk situs di peramban. |
| Login nomor HP gagal | Paket Blaze belum aktif, wilayah SMS belum diizinkan, atau sedang diuji dari `localhost`. |
| Data anggota tidak tersimpan (Firebase) | Database Firestore belum dibuat atau `firestore.rules` belum dipublikasikan. |
| Menu "Konsol Admin" tidak muncul | Dokumen `admins/{UID}` belum ada atau UID salah ketik (bagian 6.2); keluar lalu masuk kembali. |
| "Fitur ini khusus anggota berstatus Aktif." | Status keanggotaan belum Aktif atau masa berlaku habis — lihat Dasbor. |
| Perubahan konten di Konsol Admin tidak terlihat di perangkat lain | Salinan situs berjalan dalam mode uji pengembang (`apiKey` kosong; data hanya di peramban). |
| "Refused to load …" di konsol peramban / layanan pihak ketiga tidak tampil | Alamat layanan belum diizinkan pada tag Content-Security-Policy (bagian 10). |
| Anggota Aktif tidak dapat mengubah nama | Disengaja: nama yang disetujui tercantum pada KTA dan daftar verifikasi; koreksi oleh sekretariat (bagian 5). |
| Calon admin "belum ditemukan" padahal sudah mendaftar | Emailnya belum diverifikasi — minta ia membuka tautan verifikasi (atau "Kirim Ulang Tautan" di Dasbor), lalu masuk kembali. |
| Perubahan tidak muncul | Muat ulang dengan Ctrl + F5; GitHub Pages butuh 1–2 menit setelah *push*. |


## 16. Direktori Instruktur (`instruktur.html`)

- Halaman publik berisi profil instruktur perancah yang **diterbitkan** sekretariat: foto,
  gelar, bidang kompetensi, sertifikasi, pengalaman, wilayah layanan, bahasa, metode (luring/
  daring), dan materi. Pengunjung dapat menyaring (bidang, kompetensi, wilayah, bahasa, metode,
  pencarian) dan membuka profil lengkap (`instruktur.html?id=…`).
- **Formulir permintaan instruktur** untuk mitra penyelenggara pelatihan (organisasi, penanggung
  jawab, kontak, topik, metode, lokasi, rencana tanggal, jumlah peserta). Permintaan masuk ke
  **Konsol Admin › Instruktur › Permintaan** (status Baru/Diproses/Selesai, catatan internal,
  balas lewat email).
- **Konsol Admin › Instruktur › Profil**: tambah, ubah, terbitkan/tarik, hapus. Foto JPEG
  maksimal 150 KB. Profil dapat ditautkan ke akun anggota dan nomor KTA.
- **Privasi:** email dan telepon instruktur disimpan terpisah (`instructor_contacts`) dan hanya
  dapat dibaca admin; tidak pernah tampil di halaman publik.
- Daftar bidang kompetensi diambil dari `assets/data/kompetensi.js`.

## 17. Kegiatan & sertifikat

- Sekretariat membuat kegiatan di **Konsol Admin › Kegiatan** (webinar, pelatihan, seminar,
  sertifikasi, lokakarya, rapat, kunjungan teknis): jadwal (WIB), mode, lokasi atau tautan ruang
  daring, kuota, siapa yang boleh mendaftar (**semua akun** yang masuk, atau **anggota Aktif**
  saja), dan tautan Google Form penyelenggara bila ada. Kegiatan **terbit** tampil di Agenda,
  Beranda, dan Dasbor.
- **Flyer kegiatan**: Konsol Admin › Kegiatan › Kelola › tab **Flyer** › Unggah Flyer (JPG, PNG,
  atau WebP). Gambar otomatis dikompresi menjadi JPEG ≤ 900 KB (sisi terpanjang 1.600 px) dan
  disimpan di Firestore (`events/{id}/assets/flyer`), jadi tidak memerlukan layanan penyimpanan
  berkas. Rasio 4:5 atau 1:1 paling pas. Flyer tampil di detail Agenda dan di bagian **Kegiatan
  Terbaru** pada Beranda (setelah "Tentang PPAPI"): kegiatan terbit terdekat disorot bersama dua
  kegiatan berikutnya; bila semua sudah lewat, yang terakhir berlangsung. Tanpa kegiatan terbit,
  bagian ini disembunyikan.
- **Format deskripsi kegiatan**: baris kosong memisahkan paragraf; baris diawali `- ` menjadi poin
  dan `1. ` menjadi penomoran (tombol **Poin** / **Penomoran** di formulir menerapkannya pada baris
  terpilih, klik lagi untuk melepas; **Lihat hasil** menampilkan tampilannya). Baris pendek tanpa
  tanda baca di akhir tampil sebagai subjudul, teks sebelum titik dua pada butir ditebalkan, dan
  seluruh teks tampil rata kanan-kiri (Agenda, detail kegiatan, Beranda).
- **Pendaftaran** dari detail kegiatan di halaman Agenda. Peserta melihat kegiatannya di
  **Dasbor › Kegiatan Saya** (menu akun › Kegiatan Saya) — untuk semua akun, termasuk yang
  keanggotaannya belum Aktif.
- **Daftar hadir otomatis**: tombol "Isi Daftar Hadir" aktif dari **30 menit sebelum** jadwal
  selesai sampai **3 jam sesudahnya** (diperiksa dengan waktu server pada Mode Firebase).
- **Sertifikat PDF** terbit untuk peserta yang hadir. Nomor sertifikat:
  `PPAPI/SERT/<tahun>/<kode kegiatan>/<urut>`, dengan kode QR menuju **`sertifikat.html`**
  (verifikasi publik per nomor; footer › Verifikasi Sertifikat). Sekretariat dapat mengunggah
  desain sertifikat (PNG/JPEG ≤ 900 KB) dan mengatur letak nama, judul, tanggal, nomor, dan QR,
  atau memakai templat bawaan; sertifikat dapat dicabut dan dipulihkan.
- **Templat bawaan** (2026-10-28): latar perancah pudar, logo PPAPI sejajar logo INOSHPRO ("a member
  of"), judul "Sertifikat", baris tanggal kegiatan · penanda tangan · nomor sertifikat, dan QR verifikasi.
  Penanda tangan diatur di Konsol Admin › Kegiatan › **Penanda Tangan Sertifikat** (juga tombol "Ubah
  penanda tangan" di tab Sertifikat): nama, jabatan, dan foto/pindaian tanda tangan. Latar kertas dihapus
  otomatis, tinta dipertegas, lalu disimpan sebagai PNG ≤ 300 KB di `cert_settings/penandatangan`
  (hanya dapat dibaca akun yang masuk, tidak ada di repositori publik). Nilai bawaan bila belum diatur:
  `assets/js/config.js` › `sertifikat`. Gambar templat: `assets/img/sertifikat/`.
- Panel kelola kegiatan juga menyediakan daftar peserta (ekspor CSV, tandai hadir manual).
- PDF dibuat di peramban dengan jsPDF 2.5.1 dari cdnjs (dengan SRI).

## 18. Toko PPAPI

### 18.1 Halaman
- **toko.html** — katalog (Suvenir, Pakaian, Aksesori, Klem & Komponen Perancah, Produk Pengetahuan). Katalog dimulai kosong; produk ditambahkan sekretariat di **Konsol Admin › Toko › Produk**. Beberapa produk sekaligus dapat dimasukkan dengan tombol **Impor Produk** (berkas `.json` berformat `ppapi-toko-produk`, berisi data produk dan foto JPEG ≤ 150 KB, maks. 3 per produk); produk dengan id yang sama diperbarui. Deskripsi produk mendukung daftar berbutir (`- `), bernomor (`1. `), dan baris judul pendek.
- **keranjang.html** — keranjang (tersimpan di peramban; untuk akun yang masuk juga tersinkron ke Firestore `carts/{uid}`), alamat pengiriman untuk barang fisik/cetak, ringkasan, buat pesanan (wajib masuk, status keanggotaan apa pun). Anggota berstatus **Aktif** mendapat harga anggota bila diisi.
- **pesanan.html** — Pesanan Saya: status, instruksi transfer, kirim bukti bayar (tautan https), batalkan selama belum dibayar, resi pengiriman, unduh soft file bertanda air.

### 18.2 Alur pembayaran (transfer bank manual)
Menunggu Pembayaran → (pembeli mengirim bukti) Menunggu Konfirmasi → (sekretariat mengonfirmasi) Dibayar → Diproses → Dikirim (kurir + resi) → Selesai. Dibatalkan: oleh pembeli selama belum dibayar, atau oleh sekretariat sebelum dikirim (hak unduh dicabut, stok dikembalikan; pengembalian dana dilakukan di luar sistem).
- Rekening, mode ongkos kirim (dikonfirmasi per pesanan atau tarif tetap), petunjuk pembayaran, dan kontak diatur di **Toko › Pengaturan**. Rekening kosong → pembeli melihat "Informasi rekening akan diumumkan sekretariat".
- Bila ongkos kirim "dikonfirmasi sekretariat", tetapkan ongkir di detail pesanan sebelum mengonfirmasi pembayaran (sistem menolak konfirmasi sebelum total final).
- Harga dicatat oleh peramban pembeli. Sebelum konfirmasi, detail pesanan di konsol menampilkan peringatan bila harga/total berbeda dengan katalog atau bila harga anggota dipakai oleh pembeli yang tidak lagi Aktif. **Periksa mutasi rekening sebelum menekan "Konfirmasi Pembayaran".**
- Stok barang fisik dan cetak berkurang otomatis saat pembayaran dikonfirmasi (bukan saat checkout).

### 18.3 Soft file: berkas privat, tanda air, dan kunci kata sandi
- **Cara utama: unggah PDF ke situs.** Di Konsol Admin › Toko › Produk › Ubah › *Berkas PDF (disimpan privat di situs)*, pilih PDF tanpa kata sandi (maks. 30 MB), lalu Simpan. Berkas dipotong ≤ 900 KB dan disimpan di `product_files/{id}/parts/{n}`; hanya admin dan pembeli yang memiliki `entitlements/{uid}_{id}` (ditulis saat pembayaran dikonfirmasi) yang dapat membacanya. Tidak memerlukan Cloud Storage.
- Cara lain: tautan privat (`product_files/{id}.url`) yang mengarah langsung ke PDF dengan CORS. Bila ada berkas unggahan, berkas unggahan yang dipakai.
- Saat pembeli menekan **Unduh berkas**, peramban:
  1. membubuhkan tanda air nama, email, nomor pesanan, dan tanggal pada **setiap halaman**;
  2. mengunci berkas dengan enkripsi AES-128: **kata sandi pembuka = alamat email pembeli** (huruf kecil); kata sandi pemilik dibuat acak dan tidak disimpan, sehingga izin **mengubah, menyalin teks, menyusun ulang halaman, dan anotasi ditutup**; mencetak diizinkan;
  3. menampilkan kata sandinya kepada pembeli.
  Pustaka: `assets/vendor/pdf-lib-cantoo-2.8.4.min.js` (@cantoo/pdf-lib, lisensi MIT; cadangan jsDelivr dengan SRI).
- **Batasan yang perlu dipahami (jujur):**
  1. Izin PDF (tidak dapat diubah/disalin) dipatuhi pembaca PDF umum (Adobe Acrobat/Reader, peramban, Foxit), tetapi dapat dilewati dengan perangkat lunak pembuka kunci. Tanda air identitas tetap melekat pada setiap halaman dan menjadi penanda asal bila berkas tersebar.
  2. Pengolahan dilakukan di peramban pembeli, sehingga berkas sumber pada akhirnya diterima peramban pembeli yang berhak (terlihat di alat pengembang). Perlindungan penuh memerlukan server (Cloud Functions, paket Blaze).
  3. Kata sandi = email pembeli memudahkan pembeli, tetapi siapa pun yang mengetahui email tersebut dapat membuka berkas yang diteruskan. Tanda air nama pembeli tetap tampil.
- Untuk tautan eksternal: hosting harus mengirim berkas PDF langsung dan mengizinkan CORS untuk domain situs. Tautan Google Drive biasa tidak memenuhi syarat ini; pembeli kemudian diberi tombol "Buka tautan berkas" (tanpa tanda air dan tanpa kunci). Karena itu, gunakan unggahan ke situs.

### 18.3a Foto produk
- Foto ditampilkan utuh sesuai rasio aslinya (tidak dipotong).
- Kotak **Bubuhkan tanda air PPAPI pada foto yang diunggah** (bawaan aktif) menambahkan tanda air "PPAPI · ppapi.or.id" miring berulang dan "© PPAPI" di pojok. Untuk foto yang sudah ada, tekan **Bubuhkan tanda air ke foto saat ini**, lalu Simpan (tekan sekali saja agar tidak berlapis).

### 18.4 Firestore
Aturan toko sudah tergabung di `firestore.rules` (bagian 11) — cukup Publish ulang berkas itu. Tidak memerlukan indeks komposit (kueri: `products where aktif == true`, `orders where uid == …`).
Mode uji pengembang (Mode Demo): semua data toko tersimpan di localStorage peramban (`ppapi_toko_*`).

## 19. Data aplikasi di akun

- Proyek **Perencanaan & Analisis Struktur** dan kemajuan **Simulator** tersimpan di akun
  anggota (Mode Firebase: `app_data/{uid}/…`; mode uji pengembang: peramban ini), sehingga dapat dibuka
  dari perangkat lain dan tidak hilang bila peramban dibersihkan.
- Penyimpanan bekerja juga saat luring: perubahan diantrekan di peramban dan dikirim ketika
  koneksi kembali. Bila versi di akun lebih baru (diubah dari perangkat lain), aplikasi
  perencanaan menyimpan versi perangkat ini sebagai salinan — tidak ada data yang ditimpa diam-diam.
- Setiap dokumen dibatasi ±800 KB; foto dan gambar dikompresi lalu disimpan terpisah.
- Data tetap milik anggota: dapat dibaca kembali walaupun masa keanggotaan berakhir (memakai
  aplikasi tetap mensyaratkan status Aktif). Admin hanya dapat **membaca** untuk bantuan teknis.

---

*Galeri komponen untuk pengembang ada di `devtools/styleguide/` (tidak ikut diterbitkan); uji otomatis
menyajikannya di alamat `/styleguide.html` pada server uji lokal.*
