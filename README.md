# Situs PPAPI — Panduan Pengelolaan

Situs resmi **Perkumpulan Praktisi dan Ahli Perancah Indonesia (PPAPI)**. Situs ini statis
(HTML, CSS, JavaScript biasa) sehingga dapat diterbitkan gratis melalui **GitHub Pages**
tanpa proses *build*. Login anggota dan penyimpanan data memakai **Firebase** (opsional);
selama Firebase belum dihubungkan, situs berjalan dalam **Mode Demo**.

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
- **Aplikasi anggota**: PPAPI Scaffold — Perencanaan & Analisis Struktur, dan Simulator
  Pemasangan Perancah Tube & Coupler (folder `aplikasi/`).
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
├─ profil.html, berita.html, agenda.html, regulasi.html, keanggotaan.html,
│  verifikasi.html, umpan-balik.html, kebijakan-privasi.html, 404.html
├─ aplikasi/              Aplikasi anggota (perencanaan/, simulator/, gate.js)
├─ pustaka/               (opsional) berkas PDF Produk Pengetahuan yang PUBLIK
├─ styleguide.html        Galeri komponen internal (tidak tampil di menu)
├─ firestore.rules        Aturan keamanan database Firestore
├─ robots.txt             Izin perayapan mesin pencari
├─ README.md              Panduan ini
├─ .nojekyll              Wajib ada untuk GitHub Pages (jangan dihapus)
└─ assets/
   ├─ css/main.css        Desain bersama (warna, huruf, komponen)
   ├─ css/pages/*.css     Gaya khusus tiap halaman
   ├─ js/config.js        ★ PENGATURAN SITUS (boleh diubah)
   ├─ js/core.js          Mesin tampilan & sesi bersama (jangan diubah)
   ├─ js/auth.js          Login: Firebase atau Mode Demo (jangan diubah)
   ├─ js/store.js         Data anggota, pendaftaran, admin, konten (jangan diubah)
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
berfungsi untuk Mode Demo, tetapi **login Firebase hanya berjalan melalui alamat http/https**.

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
| `assets/data/berita.js` | Berita (`PPAPI_DATA.berita`) dan pengumuman (`PPAPI_DATA.pengumuman`) | Berita terbaru di paling atas. Dapat juga dikelola dari Konsol Admin (bagian 7). |
| `assets/data/agenda.js` | Agenda kegiatan | Kegiatan yang sudah lewat otomatis masuk "Telah Berlangsung". |
| `assets/data/pustaka.js` | **Produk Pengetahuan** (standar, CoP, petunjuk teknis, modul pelatihan, formulir, kajian, aplikasi) | Lihat bagian 7.3 tentang tempat menaruh berkas. Butir contoh bertanda `contoh: true`. |
| `assets/data/regulasi.js` | Pustaka regulasi & standar (tampil juga sebagai kategori "Peraturan Perundangan" di Produk Pengetahuan) | Isi awal telah diverifikasi dari sumber resmi (isian `sumber`). `kunci: true` tampil di dasbor. |
| `assets/data/organisasi.js` | Tentang, visi-misi, nilai, layanan, sejarah, pengurus, legalitas, makna logo, angka, FAQ, kategori & alur keanggotaan | Bagian yang masih rumusan sementara ditandai `contoh`/`bagianContoh`. Kategori dengan `bisaDiajukan: false` (Kehormatan) tidak dapat dipilih di formulir pendaftaran. |
| `assets/data/kompetensi.js` | Katalog kompetensi, tingkat, penerbit sertifikat | Dipakai pada formulir pendaftaran dan profil anggota. |
| `assets/data/registry.js` | Contoh daftar verifikasi publik | Hanya data terbatas. Isi awal adalah data contoh (orang fiktif); data contoh **tidak** ditampilkan pada Mode Firebase. Anggota yang disetujui di Konsol Admin otomatis masuk daftar verifikasi. |

**Gambar**: simpan foto baru di `assets/img/` (format `.webp` atau `.jpg`, lebar ≤ 2000 px),
lalu tulis alamatnya, misalnya `gambar: 'assets/img/nama-foto.webp'`.

**Logo**: berkas induk `logo-color.png`, `logo-light.png`, dan `logo-mono-dark.png` (1200 px)
memiliki versi ringan `-sm.webp`; `logo-light-mark.webp` adalah logo tanpa tulisan kecil untuk
header. Bila logo diganti, perbarui juga versi-versi tersebut.

### Arti tanda "contoh"

Butir dengan `contoh: true` adalah **konten contoh** untuk memperlihatkan tampilan situs.
Situs menampilkan label kecil **"Contoh"** di dekat judulnya. Setelah diganti dengan data
resmi, ubah menjadi `contoh: false` (atau hapus barisnya).

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
   Verifikasi**. Selama diverifikasi formulir terkunci; pemohon dapat **menarik pengajuan**
   untuk mengubahnya kembali.
3. **Sekretariat memutuskan** di Konsol Admin: **Setujui** (kategori, masa berlaku, catatan),
   **Minta Perbaikan** (catatan wajib) atau **Tolak** (alasan wajib).
4. Saat disetujui, **nomor KTA terbit otomatis** berurutan per tahun: `PPAPI-2026-000001`,
   `PPAPI-2026-000002`, … (nomor yang sudah ada tetap dipakai), masa berlaku diusulkan
   **31 Desember tahun berjalan + `masaBerlakuTahun`** (bawaan 3 tahun) dan anggota
   otomatis tercantum di **Verifikasi Anggota**.
5. **Fitur anggota terbuka**: KTA digital, Profil Anggota, berkas Produk Pengetahuan, dan
   aplikasi anggota.
6. **Perpanjangan**: anggota yang masa berlakunya habis, akan habis dalam ≤ 60 hari, atau
   berstatus Nonaktif dapat mengajukan **perpanjangan** melalui formulir yang sama →
   Menunggu Verifikasi → disetujui admin (KTA tetap). Catatan: selama pengajuan
   perpanjangan diperiksa, fitur anggota terkunci; bila pengajuan ditarik, status menjadi
   **Draf** (bukan kembali Aktif) sampai diajukan dan disetujui lagi. Bagi anggota yang masih
   Aktif, sekretariat sebaiknya langsung memakai tombol **Perpanjang** di direktori anggota
   tanpa pengajuan.

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
- **Konten**, **Umpan Balik** (status Baru/Diproses/Selesai + catatan), **Admin** (tambah
  dengan email akun yang sudah terdaftar, hapus), dan **Log Aktivitas** (setiap keputusan
  tercatat: siapa, kapan, apa).

### 6.1 Admin pada Mode Demo

Mode Demo menyiapkan satu akun admin dan empat data contoh (bertanda "(Contoh)") agar konsol
dapat dicoba:

- Email **`admin@ppapi.demo`**, kata sandi **`AdminPPAPI2026`**.

Data demo hanya tersimpan di peramban yang dipakai. Hapus data situs di peramban untuk
memulai ulang.

### 6.2 Membuat admin PERTAMA pada Mode Firebase (sekali saja)

1. Orang yang akan menjadi admin **mendaftar** di situs (Masuk/Daftar) seperti anggota biasa.
2. Buka <https://console.firebase.google.com> › proyek › **Authentication › Users**, cari
   email tersebut, salin **User UID**.
3. Buka **Firestore Database › Data** › **Start collection** (atau pilih koleksi
   `admins` bila sudah ada). Isi **Collection ID**: `admins`.
4. **Document ID**: tempel User UID. Tambahkan kolom (semua bertipe *string*):
   `uid` = User UID, `name` = nama, `email` = email, `addedAt` = tanggal hari ini
   (mis. `2026-10-09`), `addedBy` = `console`. Klik **Save**.
5. Admin tersebut keluar lalu masuk kembali di situs — menu akun kini memuat **Konsol Admin**.
6. Admin berikutnya cukup ditambahkan dari **Konsol Admin › Admin** dengan email akun yang
   sudah terdaftar. Admin terakhir tidak dapat menghapus dirinya sendiri.

> **Keamanan saat menambah admin.** Kolom email pada data anggota selalu sama dengan email
> akun yang dipakai masuk (anggota tidak dapat menggantinya), tetapi Firebase **tidak
> memeriksa kepemilikan email** pada akun email & kata sandi. Karena itu, minta calon admin
> **mendaftar dan masuk sendiri lebih dulu**, lalu cocokkan nama serta tanggal akunnya di
> **Konsol Admin › Anggota** sebelum menambahkannya. Bila satu email tercatat pada lebih dari
> satu data anggota, konsol menolak penambahan — periksa datanya di Firebase Console.

## 7. Mengelola konten & Produk Pengetahuan

### 7.1 Dua sumber konten

- **Berkas data** (`assets/data/*.js`): diubah lewat GitHub, berlaku untuk semua pengunjung
  setelah *commit*. Cocok untuk isi dasar dan perubahan besar.
- **Konsol Admin › Konten** (berita, pengumuman, agenda, produk pengetahuan, regulasi):
  menambah butir baru, **mengubah** butir bawaan (tersimpan sebagai pengganti), atau
  **menyembunyikan** butir bawaan (dapat **dipulihkan**). Pada Mode Firebase tersimpan di
  Firestore (`content_berita`, `content_pengumuman`, `content_agenda`, `content_pustaka`,
  `content_regulasi`) dan langsung tampil bagi semua pengunjung. **Pada Mode Demo perubahan
  hanya tersimpan di peramban admin.**

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

## 8. Aplikasi anggota

| Aplikasi | Folder | Isi |
| --- | --- | --- |
| PPAPI Scaffold — Perencanaan & Analisis Struktur | `aplikasi/perencanaan/` | Perencanaan dan inspeksi perancah sembilan tahap: data proyek, beban hidup, kelas beban (duty) & stabilitas, gambar rencana, material, analisis struktur, JSA, daftar periksa (10 kategori, 52 butir), laporan & label perancah. |
| Simulator Pemasangan Perancah Tube & Coupler | `aplikasi/simulator/` | Pelatihan virtual urutan pemasangan perancah tubular langkah demi langkah, pengenalan klem, pemeriksaan kelurusan, jarak, dan kesikuan. |

Keduanya dibuka dari Dasbor, Profil Anggota (`anggota.html#aplikasi`), dan Produk
Pengetahuan. Penjaga akses `aplikasi/gate.js` hanya mengizinkan anggota Aktif dan admin
(pengunjung lain diarahkan ke halaman masuk atau dasbor) dan menampilkan bilah "Portal Anggota
PPAPI" di bagian atas. Anggota cukup masuk dengan akun situs — tidak perlu akun terpisah.
Hasil perhitungan bersifat indikatif dan perlu diverifikasi tenaga ahli yang kompeten.

**Batasan jujur**: pada hosting statis (GitHub Pages) berkas HTML/JavaScript aplikasi tetap
dapat diunduh siapa saja yang mengetahui alamatnya. Penjaga akses mengatur **pengalaman
portal** (siapa yang diarahkan ke aplikasi), bukan kerahasiaan kode. Data anggota yang
sebenarnya dilindungi oleh aturan Firestore (bagian 10).

## 9. Mode Demo vs. Mode Firebase

| | **Mode Demo** (bawaan) | **Mode Firebase** |
| --- | --- | --- |
| Aktif bila | `firebase.apiKey` di `config.js` kosong | `firebase.apiKey` terisi |
| Akun, pendaftaran & data anggota | Tersimpan **hanya di peramban** yang dipakai | Tersimpan di Firebase (dapat diakses dari perangkat mana pun) |
| Admin | `admin@ppapi.demo` / `AdminPPAPI2026` + 4 data contoh | Admin pertama dibuat di Firebase Console (bagian 6.2) |
| Kode OTP nomor HP | Selalu **123456** | Dikirim melalui SMS |
| Masuk dengan Google | Simulasi (isi nama & Gmail) | Jendela resmi Google |
| Konten dari Konsol Admin, umpan balik | Tersimpan di peramban | Tersimpan di Firestore, tampil bagi semua pengunjung |

Pada Mode Demo, halaman masuk/anggota/admin menampilkan pita **"Mode Demo"** bagi pengunjung.

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
   `<username>.github.io` (tanpa `https://` dan tanpa nama repositori), serta domain
   kustom bila ada. Proyek yang dibuat setelah 28 April 2025 tidak lagi otomatis
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
    dokumen pendaftaran, dan dokumen khusus anggota dicatat sebagai tautan (mis. Google Drive);
    pas foto disimpan sebagai gambar kecil (≤ 120 KB) di data anggota.
11. Pastikan `firebaseSdkVersion: '12.4.0'` di `config.js`, lalu *commit* dan *push*.
12. Uji di `https://<username>.github.io/<repo>/masuk.html`: daftar dengan email, isi dan
    ajukan formulir, lalu setujui dari akun admin; periksa dokumen `members/{uid}`,
    `registry/{kta}`, dan `audit_log` di Firestore.
13. Untuk kembali ke Mode Demo, kosongkan `apiKey` di `config.js`.

Rujukan: [Memulai Firebase Auth](https://firebase.google.com/docs/auth/web/start),
[Login nomor HP](https://firebase.google.com/docs/auth/web/phone-auth),
[Login Google](https://firebase.google.com/docs/auth/web/google-signin),
[Firestore quickstart](https://firebase.google.com/docs/firestore/quickstart),
[Aturan keamanan](https://firebase.google.com/docs/firestore/security/get-started).

## 11. Aturan Firestore v2 (`firestore.rules`)

Prinsip: setiap pihak hanya mendapat akses seminimal mungkin.

| Koleksi | Baca | Tulis |
| --- | --- | --- |
| `members/{uid}` | pemilik akun, admin | Pemilik: hanya profil (nama, kontak, profil, kompetensi, sertifikat; email hanya boleh email akun yang dipakai masuk) dan formulir pendaftaran, dengan perubahan status terbatas: **Draf/Perlu Perbaikan/Ditolak → Menunggu Verifikasi** (mengajukan), **Menunggu Verifikasi → Draf** (menarik), **Aktif kedaluwarsa (≤ 60 hari)/Nonaktif → Menunggu Verifikasi** (perpanjangan). Formulir terkunci selama diverifikasi. Kolom sekretariat (`kta`, `memberType`, `validUntil`, `approvedAt`, `approvedBy`, `review`, `joinedAt`, `createdAt`) tidak dapat diubah anggota. Akun baru selalu Draf tanpa KTA. Admin: semua. Hapus: ditolak. |
| `admins/{uid}` | diri sendiri, admin | admin |
| `registry/{kta}` | siapa saja | admin (hanya kolom publik terbatas) |
| `content_*/{id}` | siapa saja | admin |
| `pustaka_files/{id}` | admin, anggota **Aktif** yang masa berlakunya belum habis | admin |
| `feedback/{id}` | admin | kirim: siapa saja (isian divalidasi); ubah status & catatan: admin (tercatat atas nama admin tersebut); hapus: ditolak |
| `counters/{id}` | admin | admin (nomor urut KTA) |
| `audit_log/{id}` | admin | admin, hanya menambah (tidak dapat diubah/dihapus) |
| koleksi lain | ditolak | ditolak |

Setiap kali berkas ini diubah, salin ulang ke Firebase Console › Firestore › Rules › **Publish**.

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

1. Buat repositori di GitHub (mis. `ppapi`), unggah **seluruh isi folder situs** ke akar
   repositori (termasuk berkas `.nojekyll`).
2. Buka **Settings › Pages**. Pada *Build and deployment*, pilih **Deploy from a branch**,
   branch `main`, folder `/ (root)`, lalu **Save**.
3. Tunggu 1–2 menit. Situs tersedia di `https://<username>.github.io/<repo>/`.
4. *(Opsional)* Domain sendiri: isi **Custom domain** pada halaman yang sama dan ikuti
   petunjuk DNS GitHub; tambahkan domain tersebut ke *Authorized domains* Firebase.
5. Isi `siteUrl` di `config.js` dengan alamat akhir situs, mis. `https://<username>.github.io/<repo>/`
   (dipakai untuk tautan QR KTA, tautan bagikan, dan tautan kanonis). Selama kosong, situs memakai
   alamat yang sedang dibuka.
6. Jika situs diterbitkan dari repositori `<username>.github.io` (alamat tanpa nama repositori),
   halaman 404 mendeteksi akar situs secara otomatis; agar tanpa percobaan, isi
   `SITE_ROOT = '/'` di awal `404.html`. Untuk repositori proyek, `SITE_ROOT` dapat diisi
   `'/<repo>/'`.

Halaman `404.html` otomatis dipakai GitHub Pages untuk alamat yang tidak ditemukan. Berkas
`robots.txt` mengizinkan perayapan semua halaman; halaman anggota, admin, dan `styleguide.html`
dijauhkan dari hasil pencarian melalui tanda `noindex` di halamannya. Sitemap dapat ditambahkan
setelah alamat akhir situs ditetapkan.

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
  masa berlaku, dan status.
- Seluruh teks dari data/pengguna ditampilkan dengan pengamanan (*escaping*) untuk mencegah
  sisipan kode berbahaya; ekspor CSV menetralkan isian yang menyerupai rumus Excel.
- Mode Demo **bukan** sistem login yang aman (data tersimpan di peramban) — gunakan hanya
  untuk demonstrasi.
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
| Perubahan konten di Konsol Admin tidak terlihat di perangkat lain | Situs masih Mode Demo (data hanya di peramban). |
| Perubahan tidak muncul | Muat ulang dengan Ctrl + F5; GitHub Pages butuh 1–2 menit setelah *push*. |

---

*Galeri komponen untuk pengembang tersedia di `styleguide.html`.*
