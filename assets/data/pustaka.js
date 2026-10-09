/* ==========================================================================
   DATA PRODUK PENGETAHUAN  (assets/data/pustaka.js)
   --------------------------------------------------------------------------
   Katalog halaman "Produk Pengetahuan" (pustaka.html): standar, Code of
   Practice (CoP), petunjuk teknis, modul/panduan pelatihan, formulir,
   kajian teknis, dan aplikasi anggota. Peraturan perundangan TIDAK ditulis
   di sini — halaman mengambilnya dari assets/data/regulasi.js.

   APA ARTI "contoh: true"?
   Butir bertanda contoh: true adalah CONTOH rencana dokumen (judul, kode, dan
   ringkasan bersifat ilustratif) agar tampilan katalog dapat dinilai.
   Situs menampilkan label "Contoh". Ganti dengan dokumen resmi, lalu ubah
   menjadi contoh: false (atau hapus butirnya).

   CARA MENAMBAH DOKUMEN
   Salin satu blok { … } (termasuk koma setelah tanda kurung), lalu isi:
     id        : kode unik huruf kecil tanpa spasi, mis. 'cop-pemasangan-tube-coupler'
     judul     : judul dokumen
     kategori  : 'Standar', 'Code of Practice', 'Petunjuk Teknis', 'Modul Pelatihan',
                 'Formulir & Daftar Periksa', 'Kajian Teknis', atau 'Aplikasi'
     kode      : nomor/kode dokumen resmi, mis. 'PPAPI-CoP-01' ('' bila belum ada)
     versi     : mis. 'Revisi 1' atau 'Rancangan' ('' bila belum ada)
     tanggal   : tanggal terbit, format TAHUN-BULAN-TANGGAL ('' bila belum terbit)
     status    : 'Berlaku', 'Draf', atau 'Dalam Penyusunan'
     ringkasan : 1–3 kalimat isi dokumen
     penyusun  : nama tim penyusun
     format    : 'PDF', 'Aplikasi Web', 'Tautan', dll.
     halaman   : jumlah halaman, mis. '48 halaman' ('' bila tidak relevan)
     akses     : 'anggota' (khusus anggota Aktif) atau 'publik' (semua pengunjung)
     tautan    : alamat berkas/aplikasi — LIHAT ATURAN DI BAWAH
     tag       : kata kunci pencarian, mis. ['tube & coupler', 'pemasangan']
     contoh    : false untuk dokumen resmi

   DI MANA MENARUH BERKAS? (PENTING)
   • Dokumen PUBLIK (akses: 'publik'): simpan berkas PDF di folder situs
     pustaka/ (mis. pustaka/standar-kompetensi.pdf), lalu isi
     tautan: 'pustaka/standar-kompetensi.pdf'. Berkas di folder situs dapat
     diunduh siapa saja.
   • Dokumen KHUSUS ANGGOTA (akses: 'anggota'): JANGAN taruh berkasnya di
     folder situs dan JANGAN tulis tautannya di berkas ini (berkas ini dapat
     dibaca siapa saja). Unggah berkas ke penyimpanan tertutup (mis. Google
     Drive bersama sekretariat), lalu tempel tautannya melalui
     Konsol Admin › Konten › Produk Pengetahuan › "Tautan berkas khusus anggota".
     Pada Mode Firebase tautan itu disimpan di Firestore (koleksi
     pustaka_files) yang hanya dapat dibaca anggota Aktif dan admin.
     Di sini cukup isi tautan: ''. (Lihat README.md bagian "Mengelola konten".)
   • Aplikasi anggota (kategori 'Aplikasi') menunjuk ke folder aplikasi/ di
     situs ini; aksesnya dijaga oleh aplikasi/gate.js.

   Urutan tampil: berdasarkan kategori (urutan daftar kategori di atas), lalu
   urutan butir di berkas ini. Dokumen yang ditambahkan admin melalui Konsol
   Admin otomatis digabungkan dengan daftar ini.
   ========================================================================== */
window.PPAPI_DATA = window.PPAPI_DATA || {};

PPAPI_DATA.pustaka = [

  /* ---------- STANDAR ---------- */
  {
    id: 'standar-kompetensi-ppapi',
    judul: 'Standar Kompetensi Praktisi dan Ahli Perancah PPAPI (Rancangan)',
    kategori: 'Standar',
    kode: 'PPAPI-STD-01',
    versi: 'Rancangan',
    tanggal: '',
    status: 'Dalam Penyusunan',
    ringkasan: 'Rancangan jenjang kompetensi anggota — dari teknisi pemasang, pengawas, inspektur, hingga perancang perancah — beserta unit kompetensi dan bukti yang dipersyaratkan untuk tiap jenjang.',
    penyusun: 'Tim Penyusun PPAPI',
    format: 'PDF',
    halaman: '',
    akses: 'publik',
    tautan: '',
    tag: ['kompetensi', 'jenjang', 'sertifikasi'],
    contoh: true
  },

  /* ---------- CODE OF PRACTICE ---------- */
  {
    id: 'cop-pemasangan-tube-coupler',
    judul: 'Code of Practice Pemasangan Perancah Tube & Coupler',
    kategori: 'Code of Practice',
    kode: 'PPAPI-CoP-01',
    versi: 'Rancangan',
    tanggal: '',
    status: 'Dalam Penyusunan',
    ringkasan: 'Pedoman praktik baik pemasangan dan pembongkaran perancah pipa dan klem: persiapan tumpuan, urutan pendirian tiang, ledger, transom, bracing, pengikatan ke bangunan, hingga serah terima.',
    penyusun: 'Tim Penyusun PPAPI',
    format: 'PDF',
    halaman: '',
    akses: 'anggota',
    tautan: '',
    tag: ['tube & coupler', 'pemasangan', 'pembongkaran', 'bracing'],
    contoh: true
  },
  {
    id: 'cop-inspeksi-penandaan',
    judul: 'Code of Practice Inspeksi dan Penandaan Perancah (Scafftag)',
    kategori: 'Code of Practice',
    kode: 'PPAPI-CoP-02',
    versi: 'Rancangan',
    tanggal: '',
    status: 'Dalam Penyusunan',
    ringkasan: 'Tata cara inspeksi sebelum digunakan, berkala, dan setelah kejadian khusus, termasuk penandaan status perancah dengan label hijau, kuning, dan merah serta pencatatan hasil pemeriksaan.',
    penyusun: 'Tim Penyusun PPAPI',
    format: 'PDF',
    halaman: '',
    akses: 'anggota',
    tautan: '',
    tag: ['inspeksi', 'scafftag', 'label', 'pemeriksaan berkala'],
    contoh: true
  },

  /* ---------- PETUNJUK TEKNIS ---------- */
  {
    id: 'pt-perancah-pekerjaan-ketinggian',
    judul: 'Petunjuk Teknis Penggunaan Perancah pada Pekerjaan di Ketinggian',
    kategori: 'Petunjuk Teknis',
    kode: 'PPAPI-PT-01',
    versi: 'Rancangan',
    tanggal: '',
    status: 'Dalam Penyusunan',
    ringkasan: 'Petunjuk penerapan perancah sebagai sarana kerja di ketinggian: pemilihan jenis perancah, akses naik-turun, pagar pengaman, papan kaki, serta keterkaitannya dengan sistem pencegahan jatuh.',
    penyusun: 'Tim Penyusun PPAPI',
    format: 'PDF',
    halaman: '',
    akses: 'anggota',
    tautan: '',
    tag: ['bekerja di ketinggian', 'pagar pengaman', 'akses'],
    contoh: true
  },
  {
    id: 'pt-perancah-sistem',
    judul: 'Petunjuk Teknis Perancah Sistem (Ringlock dan Cuplock)',
    kategori: 'Petunjuk Teknis',
    kode: 'PPAPI-PT-02',
    versi: 'Rancangan',
    tanggal: '',
    status: 'Dalam Penyusunan',
    ringkasan: 'Petunjuk perakitan, pemeriksaan komponen, dan batasan penggunaan perancah sistem modular jenis ringlock dan cuplock, dengan tetap merujuk pada petunjuk pabrikan.',
    penyusun: 'Tim Penyusun PPAPI',
    format: 'PDF',
    halaman: '',
    akses: 'anggota',
    tautan: '',
    tag: ['ringlock', 'cuplock', 'perancah sistem', 'modular'],
    contoh: true
  },

  /* ---------- MODUL & PANDUAN PELATIHAN ---------- */
  {
    id: 'modul-teknisi-perancah-dasar',
    judul: 'Modul Pelatihan Teknisi Perancah Tingkat Dasar',
    kategori: 'Modul Pelatihan',
    kode: 'PPAPI-MP-01',
    versi: 'Rancangan',
    tanggal: '',
    status: 'Dalam Penyusunan',
    ringkasan: 'Materi pelatihan bagi teknisi pemula: pengenalan komponen, alat pelindung diri, pembacaan gambar sederhana, pemasangan bertahap, dan pemeriksaan visual sebelum perancah digunakan.',
    penyusun: 'Tim Penyusun PPAPI',
    format: 'PDF',
    halaman: '',
    akses: 'anggota',
    tautan: '',
    tag: ['pelatihan', 'teknisi', 'dasar'],
    contoh: true
  },
  {
    id: 'modul-inspektur-perancah',
    judul: 'Modul Pelatihan Inspektur Perancah',
    kategori: 'Modul Pelatihan',
    kode: 'PPAPI-MP-02',
    versi: 'Rancangan',
    tanggal: '',
    status: 'Dalam Penyusunan',
    ringkasan: 'Materi bagi calon inspektur: metode inspeksi berbasis elemen, kriteria penerimaan, pencatatan temuan, penilaian tiga warna, dan pelaporan kepada pengguna perancah.',
    penyusun: 'Tim Penyusun PPAPI',
    format: 'PDF',
    halaman: '',
    akses: 'anggota',
    tautan: '',
    tag: ['pelatihan', 'inspektur', 'inspeksi'],
    contoh: true
  },
  {
    id: 'panduan-aplikasi-anggota',
    judul: 'Panduan Penggunaan Aplikasi PPAPI Scaffold dan Simulator Tube & Coupler',
    kategori: 'Modul Pelatihan',
    kode: 'PPAPI-MP-03',
    versi: 'Rancangan',
    tanggal: '',
    status: 'Dalam Penyusunan',
    ringkasan: 'Panduan langkah demi langkah memakai aplikasi perencanaan & analisis struktur serta simulator pemasangan, termasuk contoh kasus dan cara membaca hasil perhitungan.',
    penyusun: 'Sekretariat PPAPI',
    format: 'PDF',
    halaman: '',
    akses: 'anggota',
    tautan: '',
    tag: ['panduan', 'aplikasi', 'simulator'],
    contoh: true
  },

  /* ---------- FORMULIR & DAFTAR PERIKSA ---------- */
  {
    id: 'formulir-daftar-periksa-inspeksi',
    judul: 'Formulir Daftar Periksa Inspeksi Perancah',
    kategori: 'Formulir & Daftar Periksa',
    kode: 'PPAPI-FR-01',
    versi: 'Rancangan',
    tanggal: '',
    status: 'Dalam Penyusunan',
    ringkasan: 'Rancangan formulir cetak yang disusun dari 10 kategori dan 52 butir pemeriksaan (21 butir kritis) pada aplikasi PPAPI Scaffold, untuk inspeksi di lokasi yang belum memungkinkan memakai aplikasi.',
    penyusun: 'Tim Penyusun PPAPI',
    format: 'PDF',
    halaman: '',
    akses: 'anggota',
    tautan: '',
    tag: ['formulir', 'daftar periksa', 'inspeksi'],
    contoh: true
  },

  /* ---------- KAJIAN TEKNIS ---------- */
  {
    id: 'kajian-kapasitas-klem',
    judul: 'Kajian Teknis Kapasitas Sambungan Klem pada Perancah Tube & Coupler',
    kategori: 'Kajian Teknis',
    kode: 'PPAPI-KT-01',
    versi: 'Rancangan',
    tanggal: '',
    status: 'Dalam Penyusunan',
    ringkasan: 'Kajian tentang jenis klem, kapasitas sambungan, dan faktor yang memengaruhi kinerjanya di lapangan, sebagai bahan diskusi teknis anggota.',
    penyusun: 'Tim Penyusun PPAPI',
    format: 'PDF',
    halaman: '',
    akses: 'anggota',
    tautan: '',
    tag: ['klem', 'coupler', 'kapasitas'],
    contoh: true
  },

  /* ---------- APLIKASI ANGGOTA (aset nyata, bukan contoh) ---------- */
  {
    id: 'aplikasi-perencanaan',
    judul: 'PPAPI Scaffold — Perencanaan & Analisis Struktur',
    kategori: 'Aplikasi',
    kode: '',
    versi: '',
    tanggal: '',
    status: 'Berlaku',
    ringkasan: 'Aplikasi perencanaan dan inspeksi perancah tubular dalam sembilan tahap: data proyek, beban hidup, kelas beban (duty) dan stabilitas, gambar rencana, material, analisis struktur, JSA, daftar periksa inspeksi 52 butir, serta laporan dan label perancah (scaffold tag). Hasil perhitungan bersifat indikatif.',
    penyusun: 'PPAPI',
    format: 'Aplikasi Web',
    halaman: '',
    akses: 'anggota',
    tautan: 'aplikasi/perencanaan/index.html',
    tag: ['perencanaan', 'analisis struktur', 'inspeksi', 'scaffold tag'],
    app: 'perencanaan',
    contoh: false
  },
  {
    id: 'aplikasi-simulator',
    judul: 'Simulator Pemasangan Perancah Tube & Coupler',
    kategori: 'Aplikasi',
    kode: '',
    versi: '',
    tanggal: '',
    status: 'Berlaku',
    ringkasan: 'Simulator 3D pelatihan K3: mengenali 18 komponen dan jenis klem, merakit menara perancah tube & coupler dalam 20 tahap berurutan, lalu berlatih memeriksa kelurusan, kedataran, jarak, dan kesikuan.',
    penyusun: 'PPAPI',
    format: 'Aplikasi Web',
    halaman: '',
    akses: 'anggota',
    tautan: 'aplikasi/simulator/index.html',
    tag: ['simulator', 'tube & coupler', 'pelatihan', 'urutan pemasangan'],
    app: 'simulator',
    contoh: false
  }
];
