/* ==========================================================================
   PENGATURAN SITUS PPAPI  (assets/js/config.js)
   --------------------------------------------------------------------------
   Berkas ini boleh diubah oleh pengelola situs. Cara aman mengubahnya:
   • Ubah HANYA teks di antara tanda kutip '…'. Jangan menghapus koma (,)
     di akhir baris, tanda kurung { } [ ], atau titik dua (:).
   • Jika sebuah isian belum diketahui, biarkan kosong: ''  — situs akan
     menampilkan teks pengganti yang sopan secara otomatis.
   • Setelah menyimpan, muat ulang halaman (Ctrl + F5) untuk melihat hasilnya.
   • Jangan menulis data rahasia (kata sandi, token) di berkas ini, karena
     berkas ini dapat dibaca siapa saja yang membuka situs.
   ========================================================================== */
window.PPAPI_CONFIG = {

  /* ---------- IDENTITAS ---------- */
  shortName: 'PPAPI',
  fullName: 'Perkumpulan Praktisi dan Ahli Perancah Indonesia',

  // Slogan singkat. Kata di antara tanda bintang *…* akan tampil miring (italic).
  tagline: 'Membangun *standar*, menjaga *keselamatan*.',

  // Deskripsi singkat organisasi (dipakai di footer dan pratinjau tautan).
  description: 'Wadah profesi bagi teknisi, supervisor, dan ahli perancah di Indonesia — mendorong peningkatan kompetensi, penerapan K3, serta praktik pemasangan dan inspeksi perancah yang sesuai regulasi.',

  // Alamat situs (opsional). Isi dengan alamat situs setelah online,
  // mis. 'https://<user>.github.io/<repo>/' — diawali https:// dan diakhiri garis miring (/).
  // Dipakai untuk tautan QR KTA, tautan bagikan, dan tautan kanonis (canonical).
  // Jika dibiarkan kosong, situs otomatis memakai alamat yang sedang dibuka.
  siteUrl: 'https://anakabil.github.io/ppapi-website/',

  /* ---------- APLIKASI ANGGOTA ---------- */
  // Aplikasi milik PPAPI yang menjadi aset anggota. Keduanya berada di folder
  // situs ini (aplikasi/…) dan HANYA dapat dibuka oleh anggota berstatus Aktif
  // atau admin (penjaga akses: aplikasi/gate.js). Alamat ditulis relatif
  // terhadap akar situs — jangan diawali garis miring (/).
  //   key   : kode tetap aplikasi (jangan diubah)
  //   title : nama aplikasi;  short : nama singkat (tombol, kartu kecil)
  //           (aplikasi perencanaan masih Beta: tanda "(Beta)" pada title dipertahankan
  //           sampai Komite Teknis PPAPI menyelesaikan tinjauan metode perhitungan)
  //   desc  : deskripsi singkat;  fitur : butir fitur utama
  // Istilah dalam kurung (checklist, scaffold tag, duty, verdict, JSA) adalah
  // nama fitur di dalam aplikasi.
  apps: [
    {
      key: 'perencanaan',
      title: 'PPAPI Scaffold (Beta) — Perencanaan & Analisis Struktur',
      short: 'Perencanaan & Analisis Struktur',
      desc: 'Perencanaan dan inspeksi perancah tubular (tube & coupler) dalam sembilan tahap — data proyek, beban hidup, kelas beban (duty) dan stabilitas, gambar rencana, material dan beban kotor, analisis struktur, Job Safety Analysis (JSA), daftar periksa inspeksi, hingga laporan dan label perancah (scaffold tag).',
      url: 'aplikasi/perencanaan/index.html',
      ikon: 'ruler',
      fitur: [
        'Perhitungan beban hidup, kelas beban (duty), dan stabilitas perancah',
        'Editor gambar rencana dengan pemeriksa kaidah, estimasi material, dan analisis struktur',
        'Daftar periksa inspeksi 10 kategori, 52 butir (21 kritis) dengan penilaian tiga warna (verdict)',
        'Laporan PDF dan label perancah (scaffold tag); data tersimpan di perangkat'
      ]
    },
    {
      key: 'simulator',
      title: 'Simulator Pemasangan Perancah Tube & Coupler',
      short: 'Simulator Tube & Coupler',
      desc: 'Simulator 3D pelatihan K3 untuk perancah tube & coupler: mengenali komponen dan jenis klem, lalu merakit menara perancah 20 tahap sesuai urutan kerja — dari persiapan dan tag merah hingga inspeksi serah terima 24 butir terukur dan tag hijau.',
      url: 'aplikasi/simulator/index.html',
      ikon: 'layers',
      fitur: [
        'Pengenalan 18 komponen dan perlengkapan — jenis klem (coupler), tag status, alat ukur — dalam model 3D',
        'Perakitan 20 tahap berurutan, dari persiapan dan tag merah hingga tangga akses berpintu',
        'Inspeksi serah terima 24 butir terukur (rangka, bracing, stabilitas, lantai, pelindung tepi, akses) sebelum tag hijau',
        'Kemajuan latihan tersimpan di peramban masing-masing anggota'
      ]
    }
  ],
  // Tautan cepat "Simulator" (dipakai beberapa halaman lama). Sama dengan apps[simulator].url.
  simulatorUrl: 'aplikasi/simulator/index.html',
  // Catatan yang ditampilkan bersama tautan aplikasi.
  appNote: 'Aplikasi khusus anggota berstatus Aktif. Hasil perhitungan bersifat indikatif dan perlu diverifikasi oleh tenaga ahli teknik yang kompeten.',

  /* ---------- KEANGGOTAAN ---------- */
  // Masa berlaku keanggotaan yang diusulkan saat admin menyetujui pendaftaran:
  // akhir tahun berjalan + N tahun (contoh: disetujui 2026, N = 3 → 31 Desember 2029).
  // Admin tetap dapat mengubah tanggalnya pada dialog persetujuan.
  masaBerlakuTahun: 3,

  // Iuran keanggotaan. aktif: false = langkah "Pembayaran" TIDAK ditampilkan pada
  // formulir pendaftaran. Isi hanya dengan data resmi dari sekretariat.
  //   nominal    : contoh format 'Rp 250.000 per tahun'
  //   keterangan : penjelasan singkat (misalnya cara konfirmasi pembayaran)
  //   rekening   : contoh format 'Bank … · No. Rekening … · a.n. …'
  iuran: {
    aktif: false,
    nominal: '',
    keterangan: '',
    rekening: ''
  },

  /* ---------- PRODUK PENGETAHUAN (pustaka.html) ---------- */
  // katalogPublik: true  = pengunjung yang belum berstatus Aktif tetap melihat daftar
  //                        judul dokumen, tetapi isi/berkasnya terkunci.
  //                false = pengunjung tersebut hanya melihat panel "Khusus Anggota Aktif".
  pustaka: {
    katalogPublik: true
  },

  /* ---------- FIREBASE (LOGIN & DATABASE) ---------- */
  // Biarkan apiKey KOSONG untuk menjalankan "Mode Demo" (akun hanya tersimpan
  // di peramban). Untuk mengaktifkan login sebenarnya, salin nilai dari
  // Firebase Console > Project settings > Your apps (lihat README.md).
  // Nilai-nilai ini bukan rahasia; keamanan data diatur oleh firestore.rules.
  firebaseSdkVersion: '12.4.0',
  firebase: {
    apiKey: '',
    authDomain: '',
    projectId: '',
    storageBucket: '',
    messagingSenderId: '',
    appId: ''
  },
  // (Opsional, Mode Firebase) Kunci situs reCAPTCHA v3 untuk Firebase App Check, agar
  // kiriman otomatis (bot) ditolak. Kosong = tidak dipakai. Lihat README.md bagian 7.
  appCheckSiteKey: '',

  /* ---------- KONTAK SEKRETARIAT ---------- */
  // Isi hanya dengan data resmi. Isian kosong tidak ditampilkan; untuk alamat
  // kosong, situs menampilkan "Alamat sekretariat akan segera diperbarui."
  contact: {
    address: '',      // contoh format: 'Jl. Nama Jalan No. 1, Kelurahan, Kecamatan'
    city: '',         // contoh format: 'Jakarta Selatan 12345'
    mapsQuery: '',    // teks pencarian Google Maps, contoh: 'Nama Gedung, Jakarta'
    phone: '',        // contoh format: '+62 21 1234 5678'
    whatsapp: '',     // contoh format: '+6281234567890' (tanpa spasi)
    email: '',        // contoh format: 'sekretariat@domain.or.id'
    // Jam layanan. Contoh: [ { hari: 'Senin – Jumat', jam: '08.00 – 16.00 WIB' } ]
    hours: []
  },

  /* ---------- MEDIA SOSIAL ---------- */
  // Tempel alamat lengkap profil (https://…). Isian kosong = ikon tidak ditampilkan.
  social: {
    instagram: '',
    linkedin: '',
    youtube: '',
    facebook: ''
  },

  /* ---------- MENU UTAMA ---------- */
  // Urutan di sini = urutan di menu. 'key' harus sama dengan data-page halaman.
  // aktifJuga (opsional): data-page halaman lain yang ikut menandai menu ini,
  // mis. halaman Regulasi berada di bawah menu Pengetahuan.
  nav: [
    { key: 'beranda',     label: 'Beranda',     href: 'index.html' },
    { key: 'profil',      label: 'Profil',      href: 'profil.html' },
    { key: 'berita',      label: 'Berita',      href: 'berita.html' },
    { key: 'agenda',      label: 'Agenda',      href: 'agenda.html' },
    { key: 'pustaka',     label: 'Pengetahuan', href: 'pustaka.html', aktifJuga: ['regulasi'] },
    { key: 'keanggotaan', label: 'Keanggotaan', href: 'keanggotaan.html', aktifJuga: ['pendaftaran'] },
    { key: 'umpan-balik', label: 'Kontak',      href: 'umpan-balik.html' }
  ],

  /* ---------- TAUTAN FOOTER ---------- */
  // Setiap judul kelompok berisi daftar tautan { label, href }.
  footerLinks: {
    'Organisasi': [
      { label: 'Profil Asosiasi', href: 'profil.html' },
      { label: 'Berita & Kegiatan', href: 'berita.html' },
      { label: 'Agenda', href: 'agenda.html' },
      { label: 'Kontak & Saran', href: 'umpan-balik.html' }
    ],
    'Anggota': [
      { label: 'Keanggotaan', href: 'keanggotaan.html' },
      { label: 'Formulir Pendaftaran', href: 'pendaftaran.html' },
      { label: 'Masuk / Daftar', href: 'masuk.html' },
      { label: 'Dasbor Anggota', href: 'dashboard.html' },
      { label: 'Verifikasi Anggota', href: 'verifikasi.html' }
    ],
    'Pengetahuan': [
      { label: 'Produk Pengetahuan', href: 'pustaka.html' },
      { label: 'Regulasi & Standar', href: 'regulasi.html' },
      { label: 'Kebijakan Privasi', href: 'kebijakan-privasi.html' }
    ]
  }
};
