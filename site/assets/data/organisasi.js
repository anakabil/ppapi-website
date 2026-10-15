/* ==========================================================================
   DATA ORGANISASI  (assets/data/organisasi.js)
   --------------------------------------------------------------------------
   Isi halaman Profil, Keanggotaan, FAQ, dan beberapa bagian Beranda.

   FAKTA vs. CONTOH
   • Kalimat "tentang" dan "fakta" disusun dari deskripsi resmi PPAPI pada
     aplikasi PPAPI Scaffold (https://ppapiid.vercel.app/).
   • Rumusan resmi visi, misi, kepengurusan, sejarah pendirian, dan legalitas
     BELUM dipublikasikan. Bagian yang masih berupa rumusan sementara ditandai:
       - pada butir daftar: contoh: true
       - pada bagian berupa teks/daftar sederhana: lihat "bagianContoh" di bawah
     Situs menampilkan label "Contoh" pada bagian tersebut.
   • JANGAN mengisi nama pengurus, tanggal pendirian, atau nomor badan hukum
     sebelum datanya resmi dan dapat dipertanggungjawabkan.

   CARA MENGUBAH
   • Teks: ubah isi di antara tanda kutip '…'.
   • Setelah rumusan resmi tersedia, ubah nilai di "bagianContoh" menjadi
     false dan ubah contoh: true menjadi false pada butir terkait.
   • legalitas: isi dengan { label: 'Akta Pendirian', nilai: 'Nomor … tanggal …' }
     hanya jika sudah resmi; bila kosong, bagian Legalitas tidak ditampilkan.
   • ikon: nama ikon yang tersedia di situs, misalnya 'shield-check', 'award',
     'scale', 'users', 'compass', 'id-card', 'book', 'hard-hat', 'layers'.
   ========================================================================== */
window.PPAPI_DATA = window.PPAPI_DATA || {};

PPAPI_DATA.organisasi = {

  /* Bagian yang masih berupa rumusan sementara (true = tampilkan label "Contoh") */
  bagianContoh: {
    visi: true,
    misi: true,
    nilai: true,
    maknaLogo: true,
    keanggotaan: true
  },

  tentang: [
    'Perkumpulan Praktisi dan Ahli Perancah Indonesia (PPAPI) adalah wadah profesi bagi teknisi, supervisor, dan ahli perancah di Indonesia.',
    'PPAPI mendorong peningkatan kompetensi tenaga kerja perancah, penerapan keselamatan dan kesehatan kerja (K3), serta praktik pemasangan dan inspeksi perancah yang sesuai dengan regulasi nasional maupun pedoman teknis internasional.',
    'Salah satu wujud upaya tersebut adalah aplikasi PPAPI Scaffold untuk perencanaan dan inspeksi perancah — menstandarkan penilaian keandalan sehingga setiap struktur dinyatakan aman, bersyarat, atau tidak aman berdasarkan kriteria yang jelas dan terdokumentasi.'
  ],

  /* Fakta singkat (untuk kartu ringkas di halaman Profil) */
  fakta: [
    { label: 'Singkatan', nilai: 'PPAPI' },
    { label: 'Bentuk', nilai: 'Perkumpulan profesi' },
    { label: 'Bidang', nilai: 'Perancah (scaffolding)' },
    { label: 'Anggota', nilai: 'Praktisi dan ahli perancah Indonesia' }
  ],

  visi: 'Menjadi rujukan profesi perancah Indonesia yang kompeten, berintegritas, dan mengutamakan keselamatan.',

  misi: [
    'Meningkatkan kompetensi praktisi dan ahli perancah melalui pelatihan, sertifikasi, dan berbagi pengetahuan.',
    'Mendorong penerapan K3 serta praktik pemasangan dan inspeksi perancah yang sesuai regulasi dan standar.',
    'Menyediakan rujukan regulasi, standar, dan alat bantu digital bagi anggota dan pemangku kepentingan.',
    'Membangun jejaring dan kolaborasi antara praktisi, ahli, pelaku usaha, akademisi, dan pemerintah.',
    'Menjaga integritas profesi melalui pencatatan keanggotaan dan verifikasi yang transparan.'
  ],

  nilai: [
    { judul: 'Keselamatan', teks: 'Keselamatan manusia menjadi pertimbangan pertama dalam setiap keputusan teknis — tanpa kompromi.', ikon: 'shield-check' },
    { judul: 'Kompetensi', teks: 'Keahlian dibangun melalui pembelajaran berkelanjutan, praktik yang benar, dan pengakuan yang sah.', ikon: 'award' },
    { judul: 'Integritas', teks: 'Jujur dalam memeriksa, mencatat, dan melaporkan kondisi perancah apa adanya.', ikon: 'scale' },
    { judul: 'Kolaborasi', teks: 'Praktisi, ahli, dan pelaku usaha saling berbagi untuk mengangkat standar profesi bersama.', ikon: 'users' }
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

  sejarah: [
    { tahun: 'Pendirian', judul: 'Berhimpunnya praktisi dan ahli perancah', teks: 'Para praktisi dan ahli perancah berhimpun dalam satu wadah profesi untuk mengangkat kompetensi dan keselamatan kerja perancah di Indonesia. Tanggal dan riwayat pendirian resmi akan dilengkapi oleh sekretariat.', contoh: true },
    { tahun: '2026', judul: 'Pembaruan aplikasi PPAPI Scaffold', teks: 'Aplikasi perencanaan dan inspeksi perancah — dengan penilaian tiga warna dan simulator 3D — terus dikembangkan; versi 2.1.0 dirilis pada 19 Juli 2026.' },
    { tahun: '2026', judul: 'Situs resmi dan layanan anggota daring', teks: 'Peluncuran situs PPAPI dengan dasbor anggota, KTA digital, verifikasi anggota, dan pustaka regulasi perancah.' },
    { tahun: 'Berikutnya', judul: 'Penguatan program kerja', teks: 'Pelatihan, fasilitasi sertifikasi, dan kolaborasi dengan pemangku kepentingan untuk memperluas praktik perancah yang aman.', contoh: true }
  ],

  /* Nama pengurus akan diperbarui oleh sekretariat. foto: berkas di assets/img (opsional). */
  pengurus: [
    { nama: 'Nama Pengurus', jabatan: 'Ketua Umum', foto: '', contoh: true },
    { nama: 'Nama Pengurus', jabatan: 'Wakil Ketua Umum', foto: '', contoh: true },
    { nama: 'Nama Pengurus', jabatan: 'Sekretaris Jenderal', foto: '', contoh: true },
    { nama: 'Nama Pengurus', jabatan: 'Bendahara Umum', foto: '', contoh: true },
    { nama: 'Nama Pengurus', jabatan: 'Ketua Bidang Kompetensi & Sertifikasi', foto: '', contoh: true },
    { nama: 'Nama Pengurus', jabatan: 'Ketua Bidang K3 & Standar Teknis', foto: '', contoh: true },
    { nama: 'Nama Pengurus', jabatan: 'Ketua Bidang Keanggotaan', foto: '', contoh: true },
    { nama: 'Nama Pengurus', jabatan: 'Ketua Bidang Hubungan Kelembagaan', foto: '', contoh: true }
  ],

  /* Kosong = bagian Legalitas tidak ditampilkan. Isi hanya dengan data resmi. */
  legalitas: [],

  maknaLogo: [
    { judul: 'Huruf tebal yang condong ke depan', teks: 'Huruf PPAPI yang tebal dan condong ke depan melambangkan profesi yang bergerak maju dengan sikap tegas dan percaya diri.' },
    { judul: 'Pipa dan klem perancah', teks: 'Batang pipa yang dijepit klem pada huruf terakhir menegaskan identitas perancah pipa dan klem — sambungan yang benar adalah kunci keselamatan.' },
    { judul: 'Elips yang melingkupi', teks: 'Garis elips yang mengitari huruf menggambarkan kesatuan anggota dan cakupan kerja yang utuh, dari perencanaan hingga inspeksi.' },
    { judul: 'Praktisi & Ahli Perancah Indonesia', teks: 'Menegaskan dua pilar keanggotaan — praktisi di lapangan dan ahli di bidang perancah — dalam satu wadah nasional.' }
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
    { kelompok: 'umum', q: 'Apa itu PPAPI?', a: 'Perkumpulan Praktisi dan Ahli Perancah Indonesia (PPAPI) adalah wadah profesi bagi teknisi, supervisor, dan ahli perancah di Indonesia yang mendorong peningkatan kompetensi, penerapan K3, serta praktik pemasangan dan inspeksi perancah sesuai regulasi.' },
    { kelompok: 'umum', q: 'Bagaimana cara menghubungi sekretariat?', a: 'Gunakan formulir pada halaman Kontak. Alamat, nomor telepon, dan email resmi sekretariat akan dicantumkan di situs ini setelah dikonfirmasi.' },
    { kelompok: 'umum', q: 'Apakah ringkasan regulasi di situs ini dapat dijadikan rujukan resmi?', a: 'Pustaka regulasi disusun sebagai ringkasan rujukan dengan tautan ke naskah resmi. Selalu periksa naskah terbaru pada JDIH instansi penerbit sebelum mengambil keputusan.' },
    { kelompok: 'umum', q: 'Bagaimana data pribadi saya dilindungi?', a: 'Data diproses sesuai Kebijakan Privasi yang mengacu pada UU Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi. Data profil hanya dapat diakses oleh pemilik akun dan pengelola sekretariat yang berwenang untuk keperluan verifikasi, sedangkan verifikasi publik hanya menampilkan data terbatas.' },
    { kelompok: 'keanggotaan', q: 'Siapa yang dapat menjadi anggota?', a: 'Teknisi, supervisor, inspektur, perancang, dan ahli perancah, serta badan usaha yang bergerak di bidang perancah. Kategori dan persyaratannya dijelaskan pada bagian Kategori Keanggotaan.' },
    { kelompok: 'keanggotaan', q: 'Bagaimana cara mendaftar?', a: 'Buat akun melalui halaman Masuk/Daftar menggunakan email, nomor HP, atau akun Google, lalu isi Formulir Pendaftaran Anggota: kategori, data diri, data profesional, kompetensi dan sertifikat, dokumen pendukung, serta pernyataan. Setelah formulir diajukan, sekretariat memverifikasi data Anda.' },
    { kelompok: 'keanggotaan', q: 'Berapa biaya keanggotaan?', a: 'Informasi iuran keanggotaan dapat diperoleh melalui sekretariat.' },
    { kelompok: 'keanggotaan', q: 'Kapan status keanggotaan saya menjadi Aktif?', a: 'Setelah formulir pendaftaran diajukan dan disetujui sekretariat. Selama diperiksa, status tercatat sebagai “Menunggu Verifikasi”; bila ada data yang perlu dilengkapi, status menjadi “Perlu Perbaikan” beserta catatan dari sekretariat. Setelah disetujui, status menjadi “Aktif” dan KTA digital terbit.' },
    { kelompok: 'keanggotaan', q: 'Fitur apa saja yang terbuka setelah keanggotaan Aktif?', a: 'Kartu Tanda Anggota (KTA) digital, Produk Pengetahuan (standar, Code of Practice, petunjuk teknis, modul pelatihan), serta aplikasi perencanaan dan simulator. Sebelum keanggotaan Aktif, akun dapat dipakai untuk mengisi formulir pendaftaran dan memantau statusnya.' },
    { kelompok: 'keanggotaan', q: 'Bagaimana pihak lain memeriksa keanggotaan saya?', a: 'Melalui halaman Verifikasi Anggota dengan memasukkan nomor KTA, atau dengan memindai kode QR pada KTA digital Anda.' },
    { kelompok: 'keanggotaan', q: 'Bagaimana cara mengakses aplikasi perencanaan dan simulator?', a: 'Aplikasi PPAPI Scaffold (perencanaan & analisis struktur) dan Simulator Pemasangan Perancah Tube & Coupler tersedia di Dasbor dan Profil Anggota bagi anggota berstatus Aktif. Cukup masuk dengan akun situs ini — tidak diperlukan akun terpisah.' },
    { kelompok: 'keanggotaan', q: 'Apakah berkas sertifikat perlu diunggah?', a: 'Tidak. Situs ini menyimpan data sertifikat (judul, nomor, penerbit, masa berlaku) beserta tautan dokumen yang bersifat opsional, misalnya dari Google Drive.' }
  ],

  keanggotaan: {
    kategori: [
      {
        nama: 'Praktisi',
        ringkas: 'Bagi tenaga kerja yang terlibat langsung dalam pemasangan, pembongkaran, dan pengawasan perancah di lapangan.',
        syarat: ['Bekerja atau pernah bekerja di bidang perancah', 'Mengisi profil dan riwayat kompetensi dengan benar', 'Menyetujui ketentuan dan kode etik perkumpulan'],
        manfaat: ['KTA digital yang dapat diverifikasi publik', 'Akses aplikasi perencanaan & analisis struktur serta simulator pemasangan', 'Akses Produk Pengetahuan dan informasi pelatihan, sertifikasi, serta agenda kegiatan'],
        contoh: true
      },
      {
        nama: 'Ahli',
        ringkas: 'Bagi perancang, inspektur, ahli K3, dan tenaga ahli yang menangani perencanaan, analisis, atau pemeriksaan perancah.',
        syarat: ['Memiliki sertifikat kompetensi bidang perancah, K3, atau konstruksi yang masih berlaku', 'Pengalaman profesional yang relevan', 'Bersedia berbagi pengetahuan dalam kegiatan perkumpulan'],
        manfaat: ['Seluruh manfaat kategori Praktisi', 'Kesempatan menjadi narasumber atau fasilitator kegiatan teknis', 'Keterlibatan dalam kajian standar dan praktik baik'],
        contoh: true
      },
      {
        nama: 'Mitra Korporat',
        ringkas: 'Bagi badan usaha penyedia jasa, produsen, atau penyewaan perancah yang mendukung peningkatan standar keselamatan.',
        syarat: ['Badan usaha yang bergerak di bidang terkait perancah', 'Menunjuk narahubung resmi', 'Komitmen pada praktik kerja yang aman'],
        manfaat: ['Jejaring dengan praktisi dan ahli perancah', 'Kesempatan berkolaborasi dalam pelatihan dan kegiatan', 'Informasi regulasi dan standar terbaru'],
        contoh: true
      },
      {
        nama: 'Kehormatan',
        ringkas: 'Diberikan kepada tokoh yang berjasa bagi pengembangan profesi dan keselamatan perancah di Indonesia.',
        syarat: ['Ditetapkan oleh pengurus berdasarkan pertimbangan khusus'],
        // false = kategori ini tidak dapat dipilih pada Formulir Pendaftaran (ditetapkan pengurus)
        bisaDiajukan: false,
        manfaat: ['Pengakuan atas kontribusi bagi profesi', 'Undangan pada kegiatan perkumpulan'],
        contoh: true
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
