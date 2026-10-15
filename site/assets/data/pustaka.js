/* ==========================================================================
   DATA PRODUK PENGETAHUAN  (assets/data/pustaka.js)
   --------------------------------------------------------------------------
   Katalog halaman "Produk Pengetahuan" (pustaka.html): standar, Code of
   Practice (CoP), petunjuk teknis, modul/panduan pelatihan, formulir,
   kajian teknis, dan aplikasi anggota. Peraturan perundangan TIDAK ditulis
   di sini — halaman mengambilnya dari assets/data/regulasi.js.

   STATUS SAAT INI: katalog hanya berisi dua aplikasi anggota (aset nyata).
   Dokumen PPAPI (standar, CoP, petunjuk teknis, modul, formulir, kajian)
   ditambahkan di sini atau melalui Konsol Admin › Konten › Produk
   Pengetahuan setelah dokumen resminya terbit. Koleksi yang kosong
   ditampilkan sebagai "Segera tersedia" di Beranda dan katalog.

   APA ARTI "contoh: true"?
   Butir bertanda contoh: true adalah ilustrasi (bukan dokumen resmi); situs
   menampilkan label "Contoh". Gunakan contoh: false untuk dokumen resmi.

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

  /* ---------- APLIKASI ANGGOTA (aset nyata) ----------
     Dokumen PPAPI lainnya menyusul setelah terbit; tempel blok dokumen di atas bagian ini. */
  {
    id: 'aplikasi-perencanaan',
    judul: 'PPAPI Scaffold (Beta) — Perencanaan & Analisis Struktur',
    kategori: 'Aplikasi',
    kode: '',
    versi: '',
    tanggal: '',
    status: 'Berlaku',
    ringkasan: 'Aplikasi perencanaan dan inspeksi perancah tubular dalam sembilan tahap: data proyek, beban hidup, kelas beban (duty) dan stabilitas, gambar rencana, material, analisis struktur, JSA, daftar periksa inspeksi 52 butir, serta laporan dan label perancah (scaffold tag). Hasil perhitungan bersifat indikatif.',
    /* Penyusun dikosongkan (baris "Penyusun" tidak ditampilkan) sampai klien memutuskan apakah isian ini
       diisi. Kredit pengembang yang diizinkan hanya "mrezahuzain@2026" (lihat aplikasi/CATATAN.md). */
    penyusun: '',
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
    ringkasan: 'Simulator 3D pelatihan K3: mengenali 18 komponen dan perlengkapan (jenis klem, tag status, alat ukur), lalu merakit menara perancah tube & coupler dalam 20 tahap — dari persiapan dan tag merah hingga inspeksi serah terima 24 butir terukur dan tag hijau.',
    /* Penyusun dikosongkan sampai atribusi pengembang aplikasi dikonfirmasi klien (lihat di atas). */
    penyusun: '',
    format: 'Aplikasi Web',
    halaman: '',
    akses: 'anggota',
    tautan: 'aplikasi/simulator/index.html',
    tag: ['simulator', 'tube & coupler', 'pelatihan', 'urutan pemasangan'],
    app: 'simulator',
    contoh: false
  }
];
