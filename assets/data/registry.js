/* ==========================================================================
   DATA REGISTRI ANGGOTA (VERIFIKASI PUBLIK)  (assets/data/registry.js)
   --------------------------------------------------------------------------
   Daftar ini dipakai halaman Verifikasi Anggota (verifikasi.html) untuk
   memeriksa keabsahan nomor KTA. Daftar resmi dikelola oleh sekretariat.

   PENTING — PRIVASI: cantumkan HANYA data terbatas yang boleh dilihat publik
   (nama, nomor KTA, kategori, kompetensi utama, kota, masa berlaku, status).
   Jangan menulis alamat, nomor HP, email, atau tanggal lahir di sini.

   APA ARTI "contoh: true"?
   Seluruh butir di bawah ini adalah DATA CONTOH (orang fiktif) untuk
   demonstrasi. Hapus semuanya setelah daftar resmi tersedia.

   CARA MENAMBAH ANGGOTA
   Salin satu blok { … } (termasuk koma), lalu isi:
     kta           : nomor KTA, contoh 'PPAPI-2026-000123'
     nama          : nama lengkap
     kategori      : 'Praktisi', 'Ahli', 'Mitra Korporat', atau 'Kehormatan'
     kompetensi    : daftar kompetensi utama, contoh ['Teknisi Scaffolding']
     kota          : kota domisili, contoh 'Surabaya'
     berlakuHingga : format TAHUN-BULAN-TANGGAL, contoh '2029-12-31'
     status        : 'Aktif' atau 'Nonaktif'
     contoh        : false untuk data resmi
   ========================================================================== */
window.PPAPI_DATA = window.PPAPI_DATA || {};

PPAPI_DATA.registry = [
  {
    kta: 'PPAPI-2026-000123',
    nama: 'Andika Prasetya',
    kategori: 'Praktisi',
    kompetensi: ['Teknisi Scaffolding', 'Tenaga Kerja pada Ketinggian (TKPK) Tingkat 1, 2, dan 3'],
    kota: 'Jakarta Timur',
    berlakuHingga: '2029-12-31',
    status: 'Aktif',
    contoh: true
  },
  {
    kta: 'PPAPI-2026-001208',
    nama: 'Siti Rahmawati',
    kategori: 'Ahli',
    kompetensi: ['Ahli K3 Konstruksi (Muda, Madya, Utama)', 'Inspektur Scaffolding'],
    kota: 'Surabaya',
    berlakuHingga: '2029-12-31',
    status: 'Aktif',
    contoh: true
  },
  {
    kta: 'PPAPI-2025-000457',
    nama: 'Yoga Pranata',
    kategori: 'Praktisi',
    kompetensi: ['Operator Scaffolding'],
    kota: 'Balikpapan',
    berlakuHingga: '2028-12-31',
    status: 'Aktif',
    contoh: true
  },
  {
    kta: 'PPAPI-2025-000731',
    nama: 'Maria Kristina Sitorus',
    kategori: 'Ahli',
    kompetensi: ['Perancang Scaffolding', 'Pengawas Scaffolding'],
    kota: 'Medan',
    berlakuHingga: '2028-12-31',
    status: 'Aktif',
    contoh: true
  },
  {
    kta: 'PPAPI-2023-000089',
    nama: 'Bayu Firmansyah',
    kategori: 'Praktisi',
    kompetensi: ['Kepala Tukang Pasang Perancah dan Acuan/Cetakan Beton'],
    kota: 'Semarang',
    berlakuHingga: '2026-06-30',
    status: 'Nonaktif',
    contoh: true
  },
  {
    kta: 'PPAPI-2026-002310',
    nama: 'Ni Kadek Ayu Lestari',
    kategori: 'Praktisi',
    kompetensi: ['Petugas K3 Konstruksi'],
    kota: 'Denpasar',
    berlakuHingga: '2029-12-31',
    status: 'Aktif',
    contoh: true
  }
];
