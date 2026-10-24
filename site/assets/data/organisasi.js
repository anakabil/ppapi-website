/* ==========================================================================
   DATA ORGANISASI  (assets/data/organisasi.js)
   --------------------------------------------------------------------------
   Isi halaman Profil, Keanggotaan, FAQ, dan beberapa bagian Beranda.

   ISI & SUMBER
   • Legalitas, sejarah pendirian, susunan pengurus dan pengawas, maksud dan
     tujuan (misi), serta syarat keanggotaan bersumber dari Akta Pendirian
     Nomor 01 tanggal 1 Juli 2022 (Notaris Hj. Tuti Sriwahyuti, S.H., M.Kn.),
     Keputusan Menkumham Nomor AHU-0008151.AH.01.07.Tahun 2022, dan Berita
     Negara RI Nomor 066, Tambahan Berita Negara Nomor 000370 (19 Agustus 2022).
     Naskah lengkap Anggaran Dasar: assets/data/anggaran-dasar.js.
   • Data pribadi pengurus pada akta (NIK, tanggal lahir, alamat rumah) TIDAK
     boleh dimuat di situs. Yang ditampilkan hanya nama dan jabatan.
   • Visi, nilai, makna logo, dan uraian layanan dirumuskan sebagai komitmen
     umum perkumpulan profesi. Bila pengurus menetapkan rumusan resmi, cukup
     ganti teksnya di bawah.
   • Perubahan pengurus atau Anggaran Dasar mengikuti keputusan Rapat Umum
     Anggota dan akta perubahan; perbarui data di bawah setelah akta terbit.

   CARA MENGUBAH
   • Teks: ubah isi di antara tanda kutip '…'.
   • legalitas: isi dengan { label: 'Akta Pendirian', nilai: 'Nomor … tanggal …' }
     hanya jika sudah resmi; bila kosong, bagian Legalitas tidak ditampilkan.
   • ikon: nama ikon yang tersedia di situs, misalnya 'shield-check', 'award',
     'scale', 'users', 'compass', 'id-card', 'book', 'hard-hat', 'layers'.
   ========================================================================== */
window.PPAPI_DATA = window.PPAPI_DATA || {};

PPAPI_DATA.organisasi = {

  tentang: [
    'Perkumpulan Praktisi dan Ahli Perancah Indonesia (PPAPI) adalah perkumpulan profesi berbadan hukum yang menghimpun praktisi dan ahli di bidang perancah di Indonesia.',
    'PPAPI didirikan dengan Akta Nomor 01 tanggal 1 Juli 2022 dan disahkan sebagai badan hukum perkumpulan oleh Menteri Hukum dan Hak Asasi Manusia pada 15 Agustus 2022. Perkumpulan berasaskan Pancasila dan Undang-Undang Dasar 1945, serta berkedudukan di Kabupaten Bogor, Jawa Barat.',
    'Sesuai Anggaran Dasarnya, PPAPI membina kemampuan dan keahlian anggota, menyusun standardisasi teknis pelaksanaan perancah aman di Indonesia, menyelenggarakan penyuluhan, pendidikan, dan pelatihan K3 perancah, serta menyampaikan aspirasi anggota kepada pemerintah dan instansi terkait.',
    'Salah satu wujud upaya tersebut adalah aplikasi PPAPI Scaffold untuk perencanaan dan inspeksi perancah — menstandarkan penilaian keandalan sehingga setiap struktur dinyatakan aman, bersyarat, atau tidak aman berdasarkan kriteria yang jelas dan terdokumentasi.'
  ],

  /* Fakta singkat (untuk kartu ringkas di halaman Profil) */
  fakta: [
    { label: 'Singkatan', nilai: 'PPAPI' },
    { label: 'Bentuk', nilai: 'Perkumpulan berbadan hukum' },
    { label: 'Didirikan', nilai: '1 Juli 2022' },
    { label: 'Asas', nilai: 'Pancasila dan UUD 1945' },
    { label: 'Kedudukan', nilai: 'Kabupaten Bogor, Jawa Barat' },
    { label: 'Bidang', nilai: 'Perancah (scaffolding)' }
  ],

  visi: 'Menjadi wadah profesi perancah Indonesia yang kompeten, berintegritas, dan mengutamakan keselamatan kerja.',

  /* Misi = maksud dan tujuan perkumpulan menurut Pasal 3 Anggaran Dasar (teks akta, ejaan disesuaikan). */
  misi: [
    'Membina dan mengembangkan peran dan partisipasi, kemampuan, keahlian, kegiatan, dan kepentingan anggota sebagai bagian dari pelaku Pembangunan Nasional.',
    'Membuat standardisasi teknis pelaksanaan perancah aman di Indonesia.',
    'Menghimpun aspirasi serta pola pikir yang berkembang dari anggota dan menyatupadukannya menjadi pola pikir yang tepat guna, serta menyampaikannya kepada pemerintah atau instansi terkait sebagai upaya peran serta dalam pembangunan nasional.',
    'Meningkatkan kemitraan antaranggota dan dengan semua pemangku kepentingan.'
  ],

  nilai: [
    { judul: 'Keselamatan', teks: 'Keselamatan manusia menjadi pertimbangan utama dalam setiap keputusan teknis.', ikon: 'shield-check' },
    { judul: 'Kompetensi', teks: 'Keahlian dibangun melalui pembelajaran berkelanjutan dan praktik kerja yang benar.', ikon: 'award' },
    { judul: 'Integritas', teks: 'Jujur dan cermat dalam memeriksa, mencatat, serta melaporkan kondisi perancah.', ikon: 'scale' },
    { judul: 'Kolaborasi', teks: 'Praktisi, ahli, dan pelaku usaha saling berbagi untuk meningkatkan mutu profesi bersama.', ikon: 'users' }
  ],

  /* Pilar layanan: rumusan mengikuti deskripsi resmi PPAPI (mendorong kompetensi, K3, serta
     pemasangan dan inspeksi perancah) dan fitur situs/aplikasi yang memang tersedia. Jangan
     menuliskan program atau kegiatan tertentu sebelum benar-benar diselenggarakan. */
  layanan: [
    { ikon: 'award', judul: 'Pengembangan Kompetensi', teks: 'Mendorong peningkatan kompetensi tenaga kerja perancah, dari teknisi dan supervisor hingga ahli perancah.' },
    { ikon: 'shield-check', judul: 'Keselamatan & K3', teks: 'Mendorong penerapan keselamatan dan kesehatan kerja (K3) pada setiap tahap pekerjaan perancah, dari perencanaan hingga pembongkaran.' },
    { ikon: 'scale', judul: 'Regulasi & Standar', teks: 'Pustaka peraturan perundang-undangan, SNI, dan standar internasional yang relevan, ringkas dan bertaut ke naskah resmi.' },
    { ikon: 'compass', judul: 'Aplikasi Anggota', teks: 'PPAPI Scaffold untuk perencanaan, analisis struktur, dan daftar periksa inspeksi, serta simulator pemasangan perancah tube & coupler bagi anggota berstatus Aktif.' },
    { ikon: 'id-card', judul: 'KTA Digital & Verifikasi', teks: 'Kartu Tanda Anggota digital dengan kode QR yang keabsahannya dapat diperiksa publik melalui situs ini.' },
    { ikon: 'users', judul: 'Jejaring Profesi', teks: 'Wadah profesi yang menghimpun teknisi, supervisor, dan ahli perancah di Indonesia.' }
  ],

  /* Tonggak perjalanan (dari akta, SK Menkumham, dan Berita Negara). Kosong = bagian Sejarah disembunyikan.
     Format butir: { tahun: '2026', judul: 'Judul tonggak', teks: 'Uraian singkat.' } */
  sejarah: [
    { tahun: '2022', judul: 'Akta pendirian ditandatangani', teks: 'Pada 1 Juli 2022, para pendiri menandatangani Akta Pendirian Perkumpulan Praktisi dan Ahli Perancah Indonesia Nomor 01 di hadapan Notaris Hj. Tuti Sriwahyuti, S.H., M.Kn., di Kabupaten Bogor.' },
    { tahun: '2022', judul: 'Disahkan sebagai badan hukum', teks: 'Pada 15 Agustus 2022, Menteri Hukum dan Hak Asasi Manusia mengesahkan PPAPI sebagai badan hukum perkumpulan melalui Keputusan Nomor AHU-0008151.AH.01.07.Tahun 2022.' },
    { tahun: '2022', judul: 'Diumumkan dalam Berita Negara', teks: 'Pendirian PPAPI diumumkan dalam Berita Negara Republik Indonesia Nomor 066, Tambahan Berita Negara Nomor 000370, yang terbit pada 19 Agustus 2022.' }
  ],

  /* Susunan pengurus dan pengawas pertama menurut Pasal 37 Anggaran Dasar (masa jabatan 5 tahun, Pasal 15
     dan 22). HANYA nama dan jabatan; jangan memuat NIK atau alamat. Kosong = bagian Struktur disembunyikan.
     Format butir — foto: berkas di assets/img (opsional): { nama: 'Nama Lengkap', jabatan: 'Ketua Umum', foto: '' } */
  pengurus: [
    { nama: 'Haddy Achmad Chalidi', jabatan: 'Ketua Umum', foto: '' },
    { nama: 'Bambang Agung Setiawan', jabatan: 'Wakil Ketua Umum', foto: '' },
    { nama: 'Mohamad Reza Huzain', jabatan: 'Sekretaris Umum', foto: '' },
    { nama: 'Ahmad Firdaus', jabatan: 'Bendahara Umum', foto: '' },
    { nama: 'Dr. Winardi Sani', jabatan: 'Pengawas', foto: '' }
  ],

  /* Dasar hukum perkumpulan. Kosong = bagian Legalitas tidak ditampilkan. Isi hanya dengan data resmi. */
  legalitas: [
    { label: 'Nama badan hukum', nilai: 'Perkumpulan Praktisi dan Ahli Perancah Indonesia (PPAPI)' },
    { label: 'Akta pendirian', nilai: 'Nomor 01 tanggal 1 Juli 2022, Notaris Hj. Tuti Sriwahyuti, S.H., M.Kn., Kabupaten Bogor' },
    { label: 'Pengesahan badan hukum', nilai: 'Keputusan Menteri Hukum dan HAM RI Nomor AHU-0008151.AH.01.07.Tahun 2022 tanggal 15 Agustus 2022' },
    { label: 'Berita Negara', nilai: 'Berita Negara RI Nomor 066, Tambahan Berita Negara RI Nomor 000370, terbit 19 Agustus 2022' },
    { label: 'Kedudukan', nilai: 'Kabupaten Bogor, Jawa Barat' },
    { label: 'Asas', nilai: 'Pancasila dan Undang-Undang Dasar 1945' }
  ],

  maknaLogo: [
    { judul: 'Huruf tebal yang condong ke depan', teks: 'Huruf PPAPI ditulis tebal dan condong ke depan, selaras dengan tekad perkumpulan untuk terus bergerak maju.' },
    { judul: 'Pipa dan klem perancah', teks: 'Batang pipa yang dijepit klem pada huruf terakhir menunjukkan bidang yang ditekuni perkumpulan dan mengingatkan bahwa sambungan yang benar adalah kunci keselamatan.' },
    { judul: 'Elips yang melingkupi', teks: 'Garis elips yang mengitari huruf menggambarkan kebersamaan anggota dalam satu wadah profesi.' },
    { judul: 'Praktisi & Ahli Perancah Indonesia', teks: 'Tulisan nama perkumpulan menegaskan dua kelompok anggota, yaitu praktisi di lapangan dan ahli di bidang perancah.' }
  ],

  /* Angka faktual tentang isi situs/aplikasi (perbarui bila isi berubah). */
  stats: [
    { angka: 28, akhiran: '', label: 'Regulasi & standar dalam pustaka' },
    { angka: 16, akhiran: '', label: 'Kualifikasi kompetensi terkatalog' },
    { angka: 9, akhiran: '', label: 'Tahap perencanaan & inspeksi di aplikasi' },
    { angka: 10, akhiran: '', label: 'Kategori pemeriksaan perancah' }
  ],

  /* kelompok: 'umum' (halaman Kontak) atau 'keanggotaan' (halaman Keanggotaan) */
  faq: [
    { kelompok: 'umum', q: 'Apa itu PPAPI?', a: 'Perkumpulan Praktisi dan Ahli Perancah Indonesia (PPAPI) adalah perkumpulan profesi berbadan hukum yang menghimpun praktisi dan ahli perancah di Indonesia. PPAPI membina keahlian anggota, menyusun standardisasi teknis pelaksanaan perancah aman, serta menyelenggarakan penyuluhan, pendidikan, dan pelatihan K3 perancah.' },
    { kelompok: 'umum', q: 'Apakah PPAPI berbadan hukum?', a: 'Ya. PPAPI didirikan dengan Akta Nomor 01 tanggal 1 Juli 2022 dan disahkan sebagai badan hukum perkumpulan melalui Keputusan Menteri Hukum dan HAM Nomor AHU-0008151.AH.01.07.Tahun 2022 tanggal 15 Agustus 2022. Naskah Anggaran Dasar dapat dibaca pada halaman Anggaran Dasar.' },
    { kelompok: 'umum', q: 'Bagaimana cara menghubungi sekretariat?', a: 'Gunakan formulir pada halaman Kontak. Alamat sekretariat: Jl. Giant No. 99, Pamegarsari, Kecamatan Parung, Kabupaten Bogor, Jawa Barat 16330.' },
    { kelompok: 'umum', q: 'Apakah ringkasan regulasi di situs ini dapat dijadikan rujukan resmi?', a: 'Pustaka regulasi disusun sebagai ringkasan rujukan dengan tautan ke naskah resmi. Selalu periksa naskah terbaru pada JDIH instansi penerbit sebelum mengambil keputusan.' },
    { kelompok: 'umum', q: 'Bagaimana data pribadi saya dilindungi?', a: 'Data diproses sesuai Kebijakan Privasi yang mengacu pada UU Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi. Data profil hanya dapat diakses oleh pemilik akun dan pengelola sekretariat yang berwenang untuk keperluan verifikasi, sedangkan verifikasi publik hanya menampilkan data terbatas.' },
    { kelompok: 'keanggotaan', q: 'Siapa yang dapat menjadi anggota?', a: 'Sesuai Pasal 8 sampai 10 Anggaran Dasar, anggota PPAPI adalah Warga Negara Indonesia yang memiliki lisensi dan/atau sertifikat kerja resmi bidang perancah dari Kementerian Ketenagakerjaan atau Badan Nasional Sertifikasi Profesi (BNSP), berperilaku baik, menerima Anggaran Dasar dan Anggaran Rumah Tangga, serta mengajukan permohonan tertulis. Keanggotaan bersifat perorangan, dengan kategori Praktisi atau Ahli.' },
    { kelompok: 'keanggotaan', q: 'Bagaimana cara mendaftar?', a: 'Buat akun melalui halaman Masuk/Daftar menggunakan email, nomor HP, atau akun Google, lalu isi Formulir Pendaftaran Anggota: kategori, data diri, data profesional, kompetensi dan sertifikat, dokumen pendukung, serta pernyataan. Setelah formulir diajukan, sekretariat memverifikasi data Anda.' },
    { kelompok: 'keanggotaan', q: 'Berapa biaya keanggotaan?', a: 'Informasi iuran keanggotaan dapat diperoleh melalui sekretariat.' },
    { kelompok: 'keanggotaan', q: 'Kapan status keanggotaan saya menjadi Aktif?', a: 'Setelah formulir pendaftaran diajukan dan disetujui sekretariat. Selama diperiksa, status tercatat sebagai “Menunggu Verifikasi”; bila ada data yang perlu dilengkapi, status menjadi “Perlu Perbaikan” beserta catatan dari sekretariat. Setelah disetujui, status menjadi “Aktif” dan KTA digital terbit.' },
    { kelompok: 'keanggotaan', q: 'Fitur apa saja yang terbuka setelah keanggotaan Aktif?', a: 'Kartu Tanda Anggota (KTA) digital, Produk Pengetahuan (standar, Code of Practice, petunjuk teknis, modul pelatihan), serta aplikasi perencanaan dan simulator. Sebelum keanggotaan Aktif, akun dapat dipakai untuk mengisi formulir pendaftaran dan memantau statusnya.' },
    { kelompok: 'keanggotaan', q: 'Bagaimana pihak lain memeriksa keanggotaan saya?', a: 'Melalui halaman Verifikasi Anggota dengan memasukkan nomor KTA, atau dengan memindai kode QR pada KTA digital Anda.' },
    { kelompok: 'keanggotaan', q: 'Bagaimana cara mengakses aplikasi perencanaan dan simulator?', a: 'Aplikasi PPAPI Scaffold (perencanaan & analisis struktur) dan Simulator Pemasangan Perancah Tube & Coupler tersedia di Dasbor dan Profil Anggota bagi anggota berstatus Aktif. Cukup masuk dengan akun situs ini — tidak diperlukan akun terpisah.' },
    { kelompok: 'keanggotaan', q: 'Apakah berkas sertifikat perlu diunggah?', a: 'Tidak. Situs ini menyimpan data sertifikat (judul, nomor, penerbit, masa berlaku) beserta tautan dokumen yang bersifat opsional, misalnya dari Google Drive.' },
    { kelompok: 'keanggotaan', q: 'Apakah badan usaha dapat menjadi anggota?', a: 'Anggaran Dasar PPAPI mengatur keanggotaan perorangan, sehingga badan usaha tidak terdaftar sebagai anggota. Badan usaha di bidang perancah tetap dapat bekerja sama dengan PPAPI, misalnya dalam pelatihan atau kegiatan teknis. Sampaikan minat kerja sama melalui halaman Kontak.' },
    { kelompok: 'keanggotaan', q: 'Apa hak dan kewajiban anggota?', a: 'Menurut Pasal 11 dan 12 Anggaran Dasar, anggota berhak memperoleh perlakuan dan pembelaan yang sama terkait profesinya, menyampaikan pendapat dengan hak suara dan bicara, memilih dan dipilih dalam kepengurusan, serta memperoleh Kartu Tanda Anggota. Anggota wajib menaati Anggaran Dasar, Anggaran Rumah Tangga, dan keputusan organisasi, menjaga nama baik organisasi, serta berupaya memajukan organisasi.' }
  ],

  keanggotaan: {
    /* Kategori mengikuti Anggaran Dasar: keanggotaan perorangan WNI yang memiliki lisensi dan/atau
       sertifikat kerja resmi bidang perancah dari Kemnaker atau BNSP (Pasal 8–10). Badan usaha bukan
       anggota (lihat FAQ kerja sama). Kehormatan tidak dapat diajukan (ditetapkan perkumpulan). */
    kategori: [
      {
        nama: 'Praktisi',
        ringkas: 'Bagi tenaga teknik perancah serta pengurus dan pelaku usaha di bidang perancah yang bekerja langsung pada pemasangan, pembongkaran, pengawasan, atau pengelolaan pekerjaan perancah.',
        syarat: ['Warga Negara Republik Indonesia', 'Memiliki lisensi dan/atau sertifikat kerja resmi bidang perancah dari Kementerian Ketenagakerjaan atau BNSP', 'Berperilaku baik serta menerima dan menaati Anggaran Dasar, Anggaran Rumah Tangga, dan ketetapan perkumpulan', 'Mengajukan permohonan tertulis melalui Formulir Pendaftaran'],
        manfaat: ['KTA digital yang dapat diverifikasi publik', 'Akses aplikasi perencanaan & analisis struktur serta simulator pemasangan', 'Akses Produk Pengetahuan dan informasi pelatihan, sertifikasi, serta agenda kegiatan']
      },
      {
        nama: 'Ahli',
        ringkas: 'Bagi instruktur, narasumber, akademisi, dan tenaga ahli yang menangani perencanaan, analisis, pelatihan, atau pemeriksaan perancah.',
        syarat: ['Memenuhi seluruh syarat kategori Praktisi, termasuk lisensi dan/atau sertifikat kerja resmi bidang perancah dari Kementerian Ketenagakerjaan atau BNSP', 'Berperan sebagai instruktur, narasumber, akademisi, atau tenaga ahli di bidang perancah', 'Bersedia berbagi pengetahuan dalam kegiatan perkumpulan'],
        manfaat: ['Seluruh manfaat kategori Praktisi', 'Kesempatan berbagi keahlian dalam kegiatan perkumpulan', 'Kesempatan terlibat dalam penyusunan standardisasi teknis perancah aman']
      },
      {
        nama: 'Kehormatan',
        ringkas: 'Diberikan kepada tokoh yang berjasa bagi pengembangan profesi dan keselamatan perancah di Indonesia.',
        syarat: ['Ditetapkan oleh perkumpulan berdasarkan pertimbangan khusus'],
        // false = kategori ini tidak dapat dipilih pada Formulir Pendaftaran (ditetapkan perkumpulan)
        bisaDiajukan: false,
        manfaat: ['Pengakuan atas kontribusi bagi profesi', 'Undangan pada kegiatan perkumpulan']
      }
    ],
    /* Manfaat yang tersedia melalui situs ini */
    manfaatUmum: [
      { ikon: 'id-card', judul: 'KTA digital', teks: 'Kartu Tanda Anggota digital dengan kode QR, siap ditunjukkan atau dicetak.' },
      { ikon: 'shield-check', judul: 'Verifikasi publik', teks: 'Keabsahan keanggotaan dapat diperiksa siapa saja melalui nomor KTA.' },
      { ikon: 'compass', judul: 'Aplikasi anggota', teks: 'Aplikasi perencanaan & analisis struktur PPAPI Scaffold serta simulator pemasangan perancah tube & coupler.' },
      { ikon: 'book', judul: 'Produk pengetahuan', teks: 'Standar, Code of Practice, petunjuk teknis, modul pelatihan, dan ringkasan regulasi perancah.' },
      { ikon: 'calendar', judul: 'Agenda kegiatan', teks: 'Informasi pelatihan, sertifikasi, seminar, dan kunjungan teknis.' },
      { ikon: 'certificate', judul: 'Catatan sertifikat', teks: 'Pencatatan kompetensi dan pengingat masa berlaku sertifikat.' }
    ],
    /* Alur pendaftaran (sesuai cara kerja situs: akun → formulir → verifikasi → Aktif) */
    langkah: [
      { judul: 'Buat akun', teks: 'Daftar di halaman Masuk/Daftar menggunakan email, nomor HP, atau akun Google.' },
      { judul: 'Isi formulir pendaftaran', teks: 'Pilih kategori, lengkapi data diri dan profesional, kompetensi, sertifikat, dokumen pendukung, lalu ajukan.' },
      { judul: 'Verifikasi sekretariat', teks: 'Sekretariat memeriksa kelengkapan dan keabsahan data; bila perlu, Anda diminta melengkapi data.' },
      { judul: 'Aktif & KTA digital', teks: 'Setelah disetujui, status menjadi Aktif dan KTA digital terbit serta dapat diverifikasi publik.' },
      { judul: 'Akses fitur anggota', teks: 'Produk Pengetahuan, aplikasi perencanaan dan simulator, serta layanan anggota lainnya terbuka.' }
    ],
    /* Informasi iuran. Kosong = situs menampilkan "Informasi iuran dapat diperoleh melalui sekretariat." */
    biaya: ''
  }
};
