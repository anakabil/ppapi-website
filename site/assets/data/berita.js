/* ==========================================================================
   DATA BERITA & PENGUMUMAN  (assets/data/berita.js)
   --------------------------------------------------------------------------
   APA ARTI "contoh: true"?
   Butir bertanda contoh: true adalah KONTEN CONTOH untuk memperlihatkan
   tampilan situs. Situs menampilkan label "Contoh" di dekat judulnya.
   Ganti isinya dengan berita resmi, lalu ubah menjadi contoh: false
   (atau hapus baris contoh) agar label hilang.

   CARA MENAMBAH BERITA
   1. Salin satu blok { … } di dalam PPAPI_DATA.berita (termasuk koma).
   2. Tempel di PALING ATAS daftar (berita terbaru di atas), lalu isi:
      id        : alamat unik huruf kecil dan tanda hubung, tanpa spasi,
                  contoh 'pelatihan-inspeksi-november-2026'
                  (dipakai pada tautan berita.html?id=…)
      judul     : judul berita
      kategori  : 'Kegiatan', 'Pengumuman', 'Edukasi', 'Regulasi', atau 'Organisasi'
      tanggal   : format TAHUN-BULAN-TANGGAL, contoh '2026-11-02'
      ringkasan : 1–2 kalimat ringkas
      isi       : daftar paragraf di antara [ ]. Setiap paragraf diapit tanda
                  kutip dan dipisah koma. Awali dengan '## ' untuk subjudul,
                  dan '- ' untuk butir daftar.
      gambar    : berkas di folder assets/img, contoh 'assets/img/facade-bw.webp'
      penulis   : nama penulis/unit, contoh 'Sekretariat PPAPI'
      sorot     : true = ditampilkan sebagai berita utama
      contoh    : true/false (lihat penjelasan di atas)
   3. Jika menulis tanda kutip tunggal (') di dalam teks, gunakan ’ (kutip
      melengkung) agar tidak merusak berkas.

   PENGUMUMAN: PPAPI_DATA.pengumuman berisi pengumuman singkat
   (id, judul, isi, tanggal, penting: true/false, contoh).
   ========================================================================== */
window.PPAPI_DATA = window.PPAPI_DATA || {};

PPAPI_DATA.berita = [
  {
    id: 'situs-resmi-dan-layanan-anggota-daring',
    judul: 'PPAPI Menghadirkan Situs Resmi dan Layanan Anggota Daring',
    kategori: 'Organisasi',
    tanggal: '2026-10-07',
    ringkasan: 'Calon anggota kini dapat mengajukan pendaftaran secara daring, sedangkan anggota berstatus Aktif dapat menampilkan Kartu Tanda Anggota digital, membuka Produk Pengetahuan, dan menggunakan aplikasi anggota dari satu akun.',
    isi: [
      'Perkumpulan Praktisi dan Ahli Perancah Indonesia (PPAPI) menghadirkan situs resmi sebagai pintu layanan bagi anggota dan masyarakat. Situs ini dirancang agar informasi organisasi, agenda kegiatan, serta rujukan regulasi perancah dapat diakses dengan mudah dari perangkat apa pun.',
      '## Layanan yang tersedia',
      '- Pembuatan akun dan masuk menggunakan email, nomor HP, atau akun Google.',
      '- Formulir Pendaftaran Anggota daring; sekretariat memverifikasi setiap pengajuan dan memberikan catatan bila ada data yang perlu diperbaiki.',
      '- Dasbor berisi status keanggotaan, agenda terdekat, berita terbaru, dan pengumuman.',
      '- Profil Anggota untuk mengelola profil diri, kompetensi, dan data sertifikat beserta masa berlakunya.',
      '- Kartu Tanda Anggota (KTA) digital dengan kode QR yang dapat diverifikasi publik.',
      '- Produk Pengetahuan serta aplikasi anggota — PPAPI Scaffold untuk perencanaan dan analisis struktur, dan Simulator Pemasangan Perancah Tube & Coupler — bagi anggota berstatus Aktif.',
      '## Langkah berikutnya bagi calon anggota',
      'Calon anggota diimbau membuat akun dan mengisi Formulir Pendaftaran Anggota. Sekretariat memverifikasi data yang diajukan sebelum status keanggotaan berubah menjadi Aktif.',
      'Kritik dan saran mengenai situs dapat disampaikan melalui halaman Kontak. Masukan anggota akan menjadi bahan penyempurnaan layanan berikutnya.'
    ],
    gambar: 'assets/img/stair-tower.webp',
    penulis: 'Sekretariat PPAPI',
    sorot: true,
    contoh: true
  },
  {
    id: 'pelatihan-inspeksi-perancah-pipa-klem',
    judul: 'Pelatihan Inspeksi Perancah Pipa dan Klem Menekankan Pemeriksaan Berbasis Elemen',
    kategori: 'Kegiatan',
    tanggal: '2026-09-26',
    ringkasan: 'Peserta mempelajari cara memeriksa perancah secara runtut — dari tumpuan hingga platform kerja — serta mendokumentasikan temuan dalam checklist dan penandaan.',
    isi: [
      'Pelatihan inspeksi perancah pipa dan klem (tube & coupler) diikuti oleh teknisi, supervisor, dan petugas K3 dari berbagai proyek. Materi disusun agar peserta dapat memeriksa perancah secara runtut dan konsisten, bukan sekadar berdasarkan pengamatan sekilas.',
      '## Pemeriksaan berbasis elemen',
      'Peserta berlatih memeriksa perancah per elemen sehingga tidak ada bagian yang terlewat atau tercatat ganda:',
      '- Tumpuan, pelat dasar, dan papan alas.',
      '- Tiang (standard), ledger, dan transom.',
      '- Klem dan sambungan, termasuk kekencangan dan kesesuaian jenis klem.',
      '- Pengaku (bracing) dan pengikat ke bangunan (tie).',
      '- Platform kerja, pagar pengaman, papan kaki (toe board), dan akses naik-turun.',
      '## Dari temuan ke keputusan',
      'Setiap temuan dicatat beserta tingkat kekritisannya, lalu disimpulkan menjadi status kelayakan perancah. Peserta juga membahas pentingnya pemeriksaan ulang setelah perubahan konfigurasi, cuaca ekstrem, atau perancah lama tidak digunakan.'
    ],
    gambar: 'assets/img/facade-bw.webp',
    penulis: 'Bidang Kompetensi',
    sorot: false,
    contoh: true
  },
  {
    id: 'memahami-penandaan-perancah',
    judul: 'Memahami Penandaan Hijau, Kuning, dan Merah pada Perancah',
    kategori: 'Edukasi',
    tanggal: '2026-09-12',
    ringkasan: 'Penandaan (tagging) membantu setiap pekerja mengetahui status kelayakan perancah sebelum menggunakannya. Berikut cara membaca dan menerapkannya di lapangan.',
    isi: [
      'Di banyak proyek, perancah dilengkapi label atau tag yang menunjukkan status kelayakannya. Surat Edaran Menteri PUPR Nomor 10/SE/M/2022 memuat ketentuan mengenai penandaan hijau, kuning, dan merah pada perancah, di samping perhitungan kekuatan dan beban sebelum perancah dibangun serta pemasangan dan pemeriksaan oleh personel yang kompeten dan bersertifikat.',
      '## Cara membaca tag',
      'Secara umum, makna warna tag yang dipakai dalam praktik adalah sebagai berikut:',
      '- Hijau: perancah telah diperiksa dan layak digunakan sesuai peruntukannya.',
      '- Kuning: perancah dapat digunakan dengan syarat atau pembatasan tertentu yang tertulis pada tag, misalnya kewajiban memakai alat pelindung jatuh.',
      '- Merah: perancah tidak boleh digunakan — sedang dipasang, dibongkar, atau ditemukan kerusakan.',
      '## Tag bukan sekadar formalitas',
      'Tag hanya bermakna bila didukung pemeriksaan yang sungguh-sungguh. Pastikan tag mencantumkan tanggal pemeriksaan, nama pemeriksa, dan batasan penggunaan, serta segera diperbarui setiap kali kondisi perancah berubah.',
      'Selalu ikuti prosedur dan ketentuan yang berlaku di proyek masing-masing, karena format dan rincian tag dapat berbeda antarorganisasi.'
    ],
    gambar: 'assets/img/ringlock-pattern.webp',
    penulis: 'Tim Redaksi PPAPI',
    sorot: false,
    contoh: true
  },
  {
    id: 'skkni-operasi-scaffolding-kepmenaker-46-2022',
    judul: 'Mengenal SKKNI Bidang Operasi Scaffolding (Kepmenaker 46/2022)',
    kategori: 'Regulasi',
    tanggal: '2026-08-28',
    ringkasan: 'Standar kompetensi ini menjadi acuan skema sertifikasi Operator, Teknisi, dan Pengawas Scaffolding pada Sertifikat Kompetensi Kerja (SKK) Konstruksi.',
    isi: [
      'Keputusan Menteri Ketenagakerjaan Nomor 46 Tahun 2022 menetapkan Standar Kompetensi Kerja Nasional Indonesia (SKKNI) kategori konstruksi, golongan pokok konstruksi khusus, bidang operasi scaffolding. Keputusan ini menggantikan Kepmenaker Nomor 214 Tahun 2017.',
      '## Jabatan kerja yang mengacu standar ini',
      'Dalam penetapan jabatan kerja bidang jasa konstruksi, SKKNI 46/2022 menjadi acuan bagi kualifikasi berikut:',
      '- Operator Pemula Scaffolding (jenjang 2).',
      '- Operator Scaffolding (jenjang 3).',
      '- Teknisi Scaffolding (jenjang 4).',
      '- Pengawas Scaffolding (jenjang 5).',
      '## Mengapa penting bagi anggota',
      'Mengetahui standar acuan membantu anggota memetakan kompetensi yang perlu disiapkan sebelum mengikuti uji kompetensi. Anggota dapat mencatat kompetensi dan sertifikat yang dimiliki pada Profil Anggota agar riwayat profesional tersimpan rapi.',
      'Naskah lengkap keputusan tersebut dapat dibaca melalui tautan resmi pada halaman Regulasi.'
    ],
    gambar: 'assets/img/stair-tower.webp',
    penulis: 'Tim Redaksi PPAPI',
    sorot: false,
    contoh: true
  },
  {
    id: 'diskusi-teknis-perancah-fasad-gedung',
    judul: 'Diskusi Teknis: Perencanaan Perancah untuk Fasad Gedung Bertingkat',
    kategori: 'Kegiatan',
    tanggal: '2026-08-08',
    ringkasan: 'Praktisi berbagi pengalaman merencanakan perancah fasad — dari kondisi tumpuan, pengikat ke bangunan, hingga pengaruh angin pada perancah yang ditutup jaring.',
    isi: [
      'Diskusi teknis bulanan mengangkat tema perancah untuk fasad gedung bertingkat. Peserta menyoroti bahwa sebagian besar masalah di lapangan berawal dari tahap perencanaan yang terburu-buru.',
      '## Poin-poin utama diskusi',
      '- Kondisi tanah dan tumpuan perlu dipastikan sebelum pemasangan; pelat dasar dan papan alas harus sesuai.',
      '- Pola dan jumlah pengikat (tie) ke bangunan direncanakan sejak awal, termasuk saat pengikat harus dipindahkan untuk pekerjaan fasad.',
      '- Jaring, terpal, atau papan reklame menambah beban angin secara signifikan sehingga harus diperhitungkan.',
      '- Konfigurasi di luar pola baku memerlukan desain dan perhitungan oleh perancang yang kompeten.',
      'Para peserta sepakat bahwa koordinasi antara perancang, pemasang, dan pemeriksa perancah sejak awal proyek merupakan kunci keselamatan.'
    ],
    gambar: 'assets/img/tower-heritage.webp',
    penulis: 'Bidang Kompetensi',
    sorot: false,
    contoh: true
  },
  {
    id: 'imbauan-pemutakhiran-data-anggota',
    judul: 'Imbauan Pemutakhiran Data Anggota',
    kategori: 'Pengumuman',
    tanggal: '2026-07-20',
    ringkasan: 'Anggota diminta memastikan data profil, kompetensi, dan masa berlaku sertifikat selalu mutakhir agar proses verifikasi berjalan lancar.',
    isi: [
      'Sekretariat mengimbau seluruh anggota untuk memeriksa dan memperbarui data keanggotaan secara berkala.',
      '## Data yang perlu diperiksa',
      '- Nama lengkap, kota, dan provinsi domisili.',
      '- Perusahaan atau instansi tempat bekerja beserta jabatan.',
      '- Kompetensi dan tingkat penguasaannya.',
      '- Sertifikat beserta tanggal terbit dan tanggal kedaluwarsa.',
      'Data yang lengkap memudahkan sekretariat memverifikasi keanggotaan dan membantu anggota mendapatkan pengingat sebelum sertifikat kedaluwarsa.'
    ],
    gambar: 'assets/img/facade-bw.webp',
    penulis: 'Sekretariat PPAPI',
    sorot: false,
    contoh: true
  },
  {
    id: 'perancah-panggung-dan-acara-publik',
    judul: 'Perancah untuk Panggung dan Acara Publik: Titik Kritis yang Kerap Terlewat',
    kategori: 'Edukasi',
    tanggal: '2026-06-18',
    ringkasan: 'Struktur panggung, menara lampu, dan layar raksasa sering dibangun dalam waktu singkat. Kecepatan tidak boleh mengorbankan perencanaan dan pemeriksaan.',
    isi: [
      'Perancah untuk acara publik memiliki tantangan khusus: waktu pemasangan yang singkat, beban peralatan yang besar, dan keberadaan banyak orang di sekitar struktur.',
      '## Titik kritis yang perlu diperhatikan',
      '- Daya dukung permukaan tanah atau lantai tempat struktur berdiri.',
      '- Beban angin pada layar, spanduk, dan penutup yang dipasang pada struktur.',
      '- Pemberat (ballast) atau pengikat yang memadai untuk menjaga stabilitas.',
      '- Batasan beban pada platform dan titik gantung peralatan.',
      '- Pemeriksaan sebelum digunakan, setelah cuaca buruk, dan sebelum dibongkar.',
      '## Serah terima yang terdokumentasi',
      'Sebelum struktur digunakan, lakukan serah terima tertulis yang memuat hasil pemeriksaan, batasan penggunaan, dan kontak penanggung jawab. Dokumen ini membantu semua pihak memahami kondisi struktur yang mereka gunakan.'
    ],
    gambar: 'assets/img/stage-silhouette.webp',
    penulis: 'Tim Redaksi PPAPI',
    sorot: false,
    contoh: true
  },
  {
    id: 'rapat-kerja-program-2026-2027',
    judul: 'Rapat Kerja Pengurus Menetapkan Arah Program 2026–2027',
    kategori: 'Organisasi',
    tanggal: '2026-05-16',
    ringkasan: 'Pengurus menyepakati tiga fokus program: penguatan kompetensi anggota, penyebaran praktik keselamatan, dan digitalisasi layanan keanggotaan.',
    isi: [
      'Rapat kerja pengurus membahas evaluasi kegiatan dan menyusun arah program untuk periode berikutnya.',
      '## Tiga fokus program',
      '- Penguatan kompetensi anggota melalui pelatihan, diskusi teknis, dan pendampingan sertifikasi.',
      '- Penyebaran praktik keselamatan perancah melalui materi edukasi dan kegiatan bersama pemangku kepentingan.',
      '- Digitalisasi layanan keanggotaan, termasuk KTA digital dan verifikasi anggota secara daring.',
      'Rincian program akan diumumkan melalui halaman Berita dan Agenda.'
    ],
    gambar: 'assets/img/tower-heritage.webp',
    penulis: 'Sekretariat PPAPI',
    sorot: false,
    contoh: true
  },
  {
    id: 'permenaker-9-2016-pekerjaan-pada-ketinggian',
    judul: 'Permenaker 9/2016: Kompetensi bagi Tenaga Kerja pada Ketinggian',
    kategori: 'Regulasi',
    tanggal: '2026-04-09',
    ringkasan: 'Peraturan ini mengatur K3 dalam pekerjaan pada ketinggian, termasuk pekerjaan yang menggunakan perancah, serta kategori tenaga kerja yang wajib kompeten dan berlisensi.',
    isi: [
      'Peraturan Menteri Ketenagakerjaan Nomor 9 Tahun 2016 mengatur keselamatan dan kesehatan kerja dalam pekerjaan pada ketinggian. Bagi pekerja perancah, peraturan ini sangat relevan karena sebagian besar pekerjaan perancah dilakukan di ketinggian.',
      '## Ketentuan yang perlu dipahami',
      '- Pasal 15 mewajibkan pekerjaan pada ketinggian yang menggunakan perancah memenuhi persyaratan K3.',
      '- Pasal 35 menetapkan kategori Tenaga Kerja Bangunan Tinggi (tingkat 1 dan 2) serta Tenaga Kerja pada Ketinggian (tingkat 1 sampai 3) yang wajib kompeten dan memiliki lisensi K3.',
      'Pastikan kompetensi dan lisensi yang Anda miliki sesuai dengan pekerjaan yang dilakukan. Status terkini peraturan beserta tautan naskah resminya tersedia di halaman Regulasi.'
    ],
    gambar: 'assets/img/stair-tower.webp',
    penulis: 'Tim Redaksi PPAPI',
    sorot: false,
    contoh: true
  },
  {
    id: 'pemeriksaan-sederhana-sebelum-naik-perancah',
    judul: 'Tujuh Pemeriksaan Sederhana sebelum Naik ke Perancah',
    kategori: 'Edukasi',
    tanggal: '2026-03-12',
    ringkasan: 'Beberapa menit pemeriksaan visual sebelum bekerja dapat mencegah kecelakaan. Jadikan langkah-langkah ini kebiasaan setiap hari.',
    isi: [
      'Pemeriksaan resmi tetap menjadi tugas personel yang kompeten. Namun, setiap pekerja dapat melakukan pemeriksaan visual sederhana sebelum naik ke perancah.',
      '## Daftar periksa harian',
      '- Periksa tag: pastikan berwarna hijau atau pahami batasan pada tag kuning.',
      '- Tumpuan: pelat dasar dan papan alas terpasang, tidak amblas atau bergeser.',
      '- Tiang tegak lurus dan tidak ada komponen yang bengkok atau berkarat parah.',
      '- Klem terpasang lengkap dan tidak ada yang kendur atau hilang.',
      '- Pengaku (bracing) dan pengikat ke bangunan masih lengkap pada tempatnya.',
      '- Platform tertutup papan penuh, dilengkapi pagar pengaman dan papan kaki.',
      '- Akses naik-turun aman dan tangga terikat dengan baik.',
      'Jika menemukan kejanggalan, jangan menggunakan perancah. Laporkan kepada pengawas atau petugas K3 agar segera diperiksa.'
    ],
    gambar: 'assets/img/facade-bw.webp',
    penulis: 'Tim Redaksi PPAPI',
    sorot: false,
    contoh: true
  }
];

PPAPI_DATA.pengumuman = [
  {
    id: 'lengkapi-profil-dan-sertifikat',
    judul: 'Lengkapi profil dan data sertifikat Anda',
    isi: 'Anggota diimbau melengkapi profil, kompetensi, dan data sertifikat melalui Profil Anggota agar data keanggotaan tetap mutakhir.',
    tanggal: '2026-10-07',
    penting: true,
    contoh: true
  },
  {
    id: 'pendaftaran-pelatihan-inspeksi-dibuka',
    judul: 'Pendaftaran pelatihan inspeksi perancah dibuka',
    isi: 'Kuota peserta terbatas. Jadwal dan cara mendaftar dapat dilihat pada halaman Agenda.',
    tanggal: '2026-09-29',
    penting: false,
    contoh: true
  },
  {
    id: 'verifikasi-keanggotaan-bertahap',
    judul: 'Verifikasi keanggotaan diproses bertahap',
    isi: 'Status keanggotaan akan berubah dari “Menunggu Verifikasi” menjadi “Aktif” setelah data diperiksa oleh sekretariat.',
    tanggal: '2026-09-15',
    penting: false,
    contoh: true
  },
  {
    id: 'kanal-kritik-dan-saran',
    judul: 'Sampaikan kritik dan saran secara daring',
    isi: 'Masukan untuk perkumpulan maupun situs ini dapat dikirim melalui formulir pada halaman Kontak.',
    tanggal: '2026-08-30',
    penting: false,
    contoh: true
  }
];
