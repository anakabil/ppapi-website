/* ==========================================================================
   ANGGARAN DASAR PPAPI  (assets/data/anggaran-dasar.js)
   --------------------------------------------------------------------------
   Isi halaman anggaran-dasar.html.

   SUMBER
   • Salinan Akta Pendirian Perkumpulan Praktisi dan Ahli Perancah Indonesia
     (PPAPI) Nomor 01 tanggal 1 Juli 2022, Notaris Hj. Tuti Sriwahyuti, S.H.,
     M.Kn., Kabupaten Bogor; disahkan dengan Keputusan Menteri Hukum dan HAM
     Nomor AHU-0008151.AH.01.07.Tahun 2022.
   • Teks disalin pasal demi pasal. Yang disesuaikan hanya ejaan dan spasi
     (misalnya "dibidang" → "di bidang", "korum" → "kuorum"); isi, penomoran
     pasal/ayat/huruf, dan rujukan antarpasal dibiarkan sama dengan akta.
   • Data pribadi para penghadap dan saksi (NIK, tempat/tanggal lahir, alamat
     rumah) TIDAK dimuat. Kuasa kepada notaris untuk mengurus pengesahan juga
     tidak dimuat karena sudah selesai dilaksanakan.
   • Judul bab mengikuti judul bagian pada akta. Pasal 6 tidak berjudul pada
     akta; judul "Kekayaan" ditambahkan agar mudah dicari.

   CARA MENGUBAH
   • Anggaran Dasar hanya dapat diubah melalui Rapat Umum Anggota dan Akta
     Notaris (Pasal 30–31). Setelah ada akta perubahan, perbarui teks di bawah
     beserta isian "akta" dan "diperbarui".
   • Format: bab → pasal → ayat. Ayat berupa teks, atau { teks, butir: [...] }
     untuk ayat yang memiliki rincian. Ayat tanpa nomor ditulis dengan
     tanpaNomor: true pada pasal.
   ========================================================================== */
window.PPAPI_DATA = window.PPAPI_DATA || {};

PPAPI_DATA.anggaranDasar = {
  akta: 'Akta Pendirian Nomor 01 tanggal 1 Juli 2022, Notaris Hj. Tuti Sriwahyuti, S.H., M.Kn., Kabupaten Bogor',
  pengesahan: 'Keputusan Menteri Hukum dan Hak Asasi Manusia Republik Indonesia Nomor AHU-0008151.AH.01.07.Tahun 2022 tanggal 15 Agustus 2022',
  diperbarui: '2026-10-24',

  bab: [
    {
      judul: 'Nama dan Tempat Kedudukan',
      pasal: [
        { no: 1, ayat: [
          'Perkumpulan ini bernama PERKUMPULAN PRAKTISI DAN AHLI PERANCAH INDONESIA (PPAPI), selanjutnya dalam anggaran dasar ini cukup disingkat dengan Perkumpulan, berkedudukan di Jalan Giant Nomor 99 Kampung Tajur, Rukun Tetangga 003, Rukun Warga 004, Desa Pamegarsari, Kecamatan Parung, Kabupaten Bogor.',
          'Perkumpulan dapat membuka kantor cabang atau perwakilan di tempat lain yang dipandang perlu oleh pengurus.'
        ] }
      ]
    },
    {
      judul: 'Asas dan Landasan',
      pasal: [
        { no: 2, tanpaNomor: true, ayat: [
          'PERKUMPULAN PRAKTISI DAN AHLI PERANCAH INDONESIA (PPAPI) berasaskan Pancasila dan Undang-Undang Dasar 1945.'
        ] }
      ]
    },
    {
      judul: 'Maksud dan Tujuan',
      pasal: [
        { no: 3, pembuka: 'Maksud dan tujuan Perkumpulan ini adalah:', ayat: [
          'Membina dan mengembangkan peran dan partisipasi, kemampuan, keahlian, kegiatan dan kepentingan anggota, sebagai bagian dari pelaku Pembangunan Nasional;',
          'Membuat standardisasi teknis pelaksanaan perancah aman di Indonesia;',
          'Menghimpun aspirasi serta pola pikir yang berkembang dari anggota dan menyatupadukan menjadi suatu pola pikir yang tepat guna serta menyampaikan kepada pemerintah/instansi terkait sebagai upaya peran serta dalam pembangunan nasional;',
          'Meningkatkan kemitraan antaranggota dan semua stakeholder.'
        ] }
      ]
    },
    {
      judul: 'Kegiatan',
      pasal: [
        { no: 4, pembuka: 'Untuk mencapai maksud dan tujuan tersebut di atas, Perkumpulan Praktisi dan Ahli Perancah Indonesia melakukan kegiatan sebagai berikut:', ayat: [
          'Turut serta melaksanakan dan menunjang kebijaksanaan dan program Pemerintah di bidang pembinaan, pengendalian, dan pengembangan K3 Perancah;',
          'Melakukan kegiatan penyuluhan, penyebarluasan informasi, pendidikan dan pelatihan untuk meningkatkan keahlian K3 perancah dan melakukan pemberdayaan anggota dengan mendorong terlaksananya kegiatan K3 di lingkungan kerja anggota;',
          'Mengembangkan standardisasi-standardisasi di bidang keselamatan dan kesehatan kerja Perancah;',
          'Membantu menyelesaikan masalah teknis dan standar yang dihadapi oleh para anggota dalam melakukan tugas dan kewajibannya;',
          'Melakukan kegiatan konsultasi, penyelesaian permasalahan dan lainnya keselamatan dan kesehatan kerja di bidang perancah.'
        ] }
      ]
    },
    {
      judul: 'Jangka Waktu',
      pasal: [
        { no: 5, tanpaNomor: true, ayat: [
          'Perkumpulan didirikan untuk jangka waktu tidak tertentu.'
        ] }
      ]
    },
    {
      judul: 'Kekayaan',
      pasal: [
        { no: 6, ayat: [
          'Perkumpulan mempunyai kekayaan awal yang berbentuk uang yang berjumlah sebesar Rp20.000.000,00 (dua puluh juta rupiah).',
          { teks: 'Selain kekayaan sebagaimana dimaksud dalam ayat (1) kekayaan Perkumpulan dapat juga diperoleh dari:', butir: [
            'iuran anggota;',
            'bantuan-bantuan pihak terkait dan orang donatur atau badan-badan yang menaruh minat atau simpatisan, sumbangan dari orang-orang, masyarakat, lembaga-lembaga pemerintah dan nonpemerintah dan lainnya yang sifatnya tidak mengikat yang tidak bertentangan dengan peraturan perundang-undangan yang berlaku yang diketahui dan disosialisasikan kepada anggota.'
          ] }
        ] }
      ]
    },
    {
      judul: 'Organ Perkumpulan',
      pasal: [
        { no: 7, pembuka: 'Perkumpulan mempunyai organ yang terdiri atas:', ayat: [
          'Anggota;',
          'Pengurus;',
          'Pengawas.'
        ] }
      ]
    },
    {
      judul: 'Keanggotaan',
      pasal: [
        { no: 8, tanpaNomor: true, ayat: [
          'Setiap anggota masyarakat Warga Negara Republik Indonesia yang menyetujui asas, tujuan serta mau bergabung secara terus-menerus.'
        ] }
      ]
    },
    {
      judul: 'Syarat Anggota',
      pasal: [
        { no: 9, pembuka: 'Syarat untuk menjadi anggota adalah:', ayat: [
          'Warga Negara Republik Indonesia;',
          'Berperilaku baik, sopan dengan pedoman pada aturan yang berlaku dalam perkumpulan;',
          'Menerima, menyetujui, menaati anggaran dasar dan anggaran rumah tangga serta ketetapan-ketetapan perkumpulan;',
          'Mengajukan permohonan secara tertulis untuk menjadi anggota.'
        ] }
      ]
    },
    {
      judul: 'Tata Cara Menjadi Anggota',
      pasal: [
        { no: 10, ayat: [
          'Warga negara Indonesia yang telah memiliki lisensi dan/atau Sertifikat Kerja Resmi Lembaga Pemerintah di bidang Perancah/Scaffolding dari Kementerian Ketenagakerjaan Republik Indonesia dan/atau Badan Nasional Sertifikasi Profesi Republik Indonesia.',
          'Mendaftarkan diri dan menyerahkan persyaratan keanggotaan serta bersedia mengikuti AD-ART Perkumpulan.'
        ] }
      ]
    },
    {
      judul: 'Kewajiban Anggota',
      pasal: [
        { no: 11, pembuka: 'Setiap anggota Perkumpulan wajib untuk:', ayat: [
          'Menaati Anggaran Dasar dan Anggaran Rumah Tangga serta keputusan-keputusan organisasi;',
          'Menjaga dan menjunjung tinggi nama baik organisasi;',
          'Wajib berupaya memajukan organisasi dengan berpikir, bersikap dan bertindak positif;'
        ] }
      ]
    },
    {
      judul: 'Hak Anggota',
      pasal: [
        { no: 12, ayat: [
          'Setiap anggota berhak memperoleh perlakuan dan pembelaan yang sama, yang berkaitan dengan profesinya;',
          'Mempunyai hak suara dan bicara dalam mengeluarkan pendapat;',
          'Anggota berhak mempunyai hak dipilih dan hak memilih pada setiap kepengurusan;',
          'Setiap anggota berhak memperoleh Kartu Tanda Anggota;'
        ] }
      ]
    },
    {
      judul: 'Pengurus',
      pasal: [
        { no: 13, ayat: [
          { teks: 'Pengurus adalah organ perkumpulan yang melaksanakan kepengurusan Perkumpulan yang sekurang-kurangnya terdiri dari:', butir: [
            { huruf: 'a', teks: 'seorang Ketua Umum;' },
            { huruf: 'b', teks: 'seorang Wakil Ketua Umum;' },
            { huruf: 'c', teks: 'seorang Sekretaris Umum;' },
            { huruf: 'e', teks: 'seorang Bendahara Umum;' }
          ], penutup: 'dan seksi-seksi yang ditentukan oleh Pengurus.' }
        ] }
      ]
    },
    {
      judul: 'Syarat Pengurus',
      pasal: [
        { no: 14, ayat: [
          { teks: 'Yang dapat diangkat sebagai Pengurus adalah:', butir: [
            'Bertakwa kepada Tuhan Yang Maha Esa;',
            'Setia kepada Pancasila dan Undang-Undang Dasar 1945 dan Negara Kesatuan Republik Indonesia;',
            'Memiliki Kartu Tanda Anggota;',
            'Memiliki kemampuan, loyalitas dan dedikasi kepada organisasi;',
            'Berdomisili di wilayah kerja kepengurusan masing-masing;'
          ] }
        ] }
      ]
    },
    {
      judul: 'Pemilihan Pengurus',
      pasal: [
        { no: 15, ayat: [
          'Pengurus diangkat oleh anggota melalui Rapat Umum Anggota untuk jangka waktu 5 (lima) tahun dan dapat diangkat kembali.',
          'Pengurus dipilih melalui Rapat Umum Anggota yang ditetapkan oleh Panitia Rapat Umum Anggota.',
          'Pembentukan Panitia Rapat Umum Anggota dibentuk melalui musyawarah Anggota 1 (satu) bulan sebelum masa jabatan Pengurus lama berakhir.',
          'Pengurus baru ditetapkan dalam Rapat Umum Anggota yang dihadiri sekurang-kurangnya 2/3 (dua per tiga) dari jumlah Anggota Biasa Perkumpulan.'
        ] }
      ]
    },
    {
      judul: 'Tugas Pengurus',
      pasal: [
        { no: 16, ayat: [
          'Pengurus bertanggung jawab penuh atas kepengurusan Perkumpulan untuk kepentingan Perkumpulan.',
          { teks: 'Pengurus wajib untuk:', butir: [
            'menyusun program kerja selama masa jabatannya.',
            'meneruskan program kerja yang telah ditetapkan oleh pengurus lama.',
            'memberikan laporan hasil kerja kepada anggota setiap 6 (enam) bulan sekali.',
            'memberikan laporan keuangan kepada anggota setiap 3 (tiga) bulan sekali.',
            'pada akhir masa jabatan Pengurus harus menyampaikan laporan pertanggungjawaban kepada anggota perkumpulan.'
          ] },
          'Setiap anggota Pengurus wajib dengan iktikad baik dan penuh tanggung jawab menjalankan tugasnya dengan mengindahkan peraturan perundang-undangan yang berlaku.'
        ] }
      ]
    },
    {
      judul: 'Penghentian Pengurus',
      pasal: [
        { no: 17, pembuka: 'Jabatan Anggota Pengurus berakhir apabila:', ayat: [
          'meninggal dunia;',
          'mengundurkan diri;',
          'bersalah melakukan tindakan pidana berdasarkan putusan pengadilan yang diancam dengan hukuman penjara paling sedikit 5 (lima) tahun;',
          'diberhentikan karena melakukan tindakan-tindakan yang melanggar tata tertib Perkumpulan, setelah menerima surat teguran dari Pengurus Perkumpulan sebanyak 3 (tiga) kali;',
          'masa jabatan berakhir.'
        ] }
      ]
    },
    {
      judul: 'Rapat Pengurus',
      pasal: [
        { no: 18, ayat: [
          'Rapat Pengurus dapat diadakan setiap waktu bila dianggap perlu atas permintaan tertulis dari satu orang atau lebih Pengurus, Anggota atau Pengawas.',
          'Panggilan Rapat Pengurus dilakukan oleh Pengurus yang berhak mewakili Pengurus.',
          'Panggilan Rapat Pengurus disampaikan kepada setiap anggota Pengurus secara langsung atau melalui surat dengan mendapat tanda terima, paling lambat 7 (tujuh) hari sebelum Rapat diadakan dengan tidak memperhitungkan tanggal panggilan dan tanggal Rapat.',
          'Panggilan Rapat Pengurus itu harus dicantumkan hari, tanggal, waktu, tempat dan acara Rapat.',
          'Rapat Pengurus diadakan di tempat kedudukan Perkumpulan atau di tempat kegiatan Perkumpulan.'
        ] },
        { no: 19, ayat: [
          'Rapat Pengurus dipimpin oleh Ketua.',
          'Dalam hal Ketua tidak dapat hadir atau berhalangan, maka Rapat Pengurus akan dipimpin oleh seorang Anggota Pengurus yang dipilih oleh dan dari Pengurus yang hadir.',
          'Satu orang Pengurus hanya dapat diwakili oleh Pengurus lainnya dalam Rapat Pengurus berdasarkan surat kuasa.',
          { teks: 'Rapat Pengurus adalah sah dan berhak mengambil keputusan yang mengikat apabila:', butir: [
            'dihadiri paling sedikit 2/3 (dua per tiga) dari jumlah pengurus;',
            'dalam hal kuorum sebagaimana dimaksud dalam ayat (4) huruf e tidak tercapai, maka dapat diadakan pemanggilan Rapat Pengurus kedua;',
            'pemanggilan sebagaimana yang dimaksud dalam ayat (4) huruf b, harus dilakukan paling lambat 7 (tujuh) hari sebelum Rapat diselenggarakan, dengan tidak memperhitungkan tanggal panggilan dan tanggal Rapat;',
            'Rapat Pengurus kedua diselenggarakan paling cepat 10 (sepuluh) hari dan paling lambat 21 (dua puluh satu) hari terhitung sejak Rapat Pengurus pertama;',
            'Rapat Pengurus kedua sah dan berhak mengambil keputusan yang mengikat apabila dihadiri lebih dari 1/2 (satu per dua) jumlah Pengurus.'
          ] }
        ] },
        { no: 20, ayat: [
          'Keputusan Rapat Pengurus harus diambil berdasarkan musyawarah untuk mufakat.',
          'Dalam hal keputusan berdasarkan musyawarah untuk mufakat tidak tercapai, maka keputusan diambil berdasarkan suara setuju lebih dari 1/2 (satu per dua) jumlah suara yang sah.',
          'Dalam hal suara setuju dan tidak setuju sama banyaknya, maka usul ditolak.',
          'Pemungutan suara mengenai diri orang dilakukan dengan surat suara tertutup tanpa tanda tangan, sedangkan pemungutan suara mengenai hal-hal lain dilakukan secara terbuka, kecuali Ketua Rapat menentukan lain dan tidak ada keberatan dari yang hadir.',
          'Suara abstain dan suara yang tidak sah tidak dihitung dalam menentukan jumlah suara yang dikeluarkan.',
          'Setiap Rapat Pengurus dibuat Berita Acara Rapat yang ditandatangani oleh Ketua Rapat dan 1 (satu) orang Anggota Pengurus lainnya yang ditunjuk oleh Rapat sebagai Sekretaris Rapat.',
          'Pengurus dapat juga mengambil keputusan yang sah tanpa mengadakan Rapat Pengurus, dengan ketentuan semua anggota Pengurus telah diberitahu secara tertulis dan semua anggota Pengurus memberikan persetujuan mengenai usul yang diajukan secara tertulis serta menandatangani persetujuan tersebut.',
          'Keputusan yang diambil sebagaimana dimaksud dalam ayat (7), mempunyai kekuatan yang sama dengan keputusan yang diambil dengan sah dalam Rapat Pengurus.'
        ] }
      ]
    },
    {
      judul: 'Pengawas',
      pasal: [
        { no: 21, ayat: [
          'Pengawas adalah organ Perkumpulan yang bertugas melakukan pengawasan dan memberi nasihat kepada Pengurus dalam menjalankan kegiatan Perkumpulan.',
          'Pengawas terdiri dari 1 (satu) orang atau lebih anggota Pengawas.'
        ] },
        { no: 22, ayat: [
          'Yang dapat diangkat sebagai Anggota Pengawas adalah orang perseorangan yang mampu melakukan perbuatan hukum dan tidak dinyatakan bersalah dalam melakukan pengawasan Perkumpulan yang menyebabkan kerugian bagi Perkumpulan, masyarakat atau Negara berdasarkan putusan Pengadilan, dalam jangka waktu 5 (lima) tahun terhitung sejak tanggal putusan tersebut berkekuatan hukum tetap.',
          'Pengawas diangkat oleh Rapat Umum Anggota untuk jangka waktu 5 (lima) tahun dan dapat diangkat kembali.',
          'Dalam hal jabatan Pengawas kosong, maka dalam jangka waktu paling lama 30 (tiga puluh) hari sejak terjadinya kekosongan, harus menyelenggarakan Rapat Umum Anggota untuk mengangkat Pengawas baru, dan untuk sementara Perkumpulan diurus oleh Pengurus.',
          'Pengawas berhak mengundurkan diri dari jabatannya, dengan memberitahukan secara tertulis mengenai maksudnya tersebut kepada Rapat Umum Anggota paling lambat 30 (tiga puluh) hari sebelum tanggal pengunduran dirinya.'
        ] },
        { no: 23, pembuka: 'Jabatan Pengawas berakhir apabila:', ayat: [
          'meninggal dunia;',
          'mengundurkan diri;',
          'bersalah melakukan tindak pidana berdasarkan putusan pengadilan yang diancam dengan hukuman penjara paling sedikit 5 (lima) tahun;',
          'diberhentikan berdasarkan keputusan Rapat Umum Anggota.'
        ] }
      ]
    },
    {
      judul: 'Tugas dan Wewenang Pengawas',
      pasal: [
        { no: 24, ayat: [
          'Pengawas wajib dengan iktikad baik dan penuh tanggung jawab menjalankan tugas pengawasan untuk kepentingan Perkumpulan.',
          { teks: 'Pengawas berwenang:', butir: [
            'memasuki bangunan, halaman, atau tempat lain yang dipergunakan Perkumpulan.',
            'memeriksa dokumen;',
            'memeriksa pembukuan dan mencocokkannya dengan uang kas; atau',
            'mengetahui segala tindakan yang telah dijalankan oleh Pengurus.',
            'memberi peringatan kepada Pengurus.'
          ] }
        ] }
      ]
    },
    {
      judul: 'Rapat Umum Anggota',
      pasal: [
        { no: 25, ayat: [
          'Rapat Umum Anggota adalah pemegang kewenangan tertinggi di dalam Perkumpulan ini.',
          'Panggilan Rapat Umum Anggota dilakukan oleh Pengurus.',
          'Panggilan Rapat Umum Anggota disampaikan kepada setiap Pengurus, Pengawas, dan Anggota Biasa secara langsung, atau melalui surat dengan mendapat tanda terima, paling lambat 7 (tujuh) hari sebelum Rapat diadakan, dengan tidak memperhitungkan tanggal panggilan dan tanggal Rapat.',
          'Panggilan Rapat Umum Anggota harus mencantumkan tanggal, waktu, tempat, dan acara Rapat.',
          'Rapat Umum Anggota diadakan di tempat kedudukan Perkumpulan atau di tempat kegiatan Perkumpulan.',
          'Rapat Umum Anggota dipimpin oleh Ketua Perkumpulan.',
          'Dalam hal Ketua Perkumpulan tidak ada atau berhalangan hadir, maka Rapat Umum Anggota dipimpin oleh Ketua Pengawas.',
          'Dalam hal Ketua Pengurus dan Ketua Pengawas tidak ada atau berhalangan hadir, maka Rapat Umum Anggota dipimpin oleh Pengurus atau Pengawas yang dipilih oleh dan dari Pengurus dan Pengawas yang hadir.'
        ] },
        { no: 26, ayat: [
          'Satu orang Pengurus hanya dapat diwakili oleh Pengurus lainnya dalam Rapat Umum Anggota berdasarkan surat kuasa.',
          'Satu orang Pengawas hanya dapat diwakili oleh Pengawas lainnya dalam Rapat Umum Anggota berdasarkan surat kuasa.',
          'Satu orang Anggota Biasa hanya dapat diwakili oleh Anggota Biasa lainnya dalam Rapat Umum Anggota berdasarkan surat kuasa.',
          'Setiap Pengurus atau Pengawas atau Anggota Biasa yang hadir berhak mengeluarkan 1 (satu) suara dan tambahan 1 (satu) suara untuk setiap Pengurus atau Pengawas atau Anggota Biasa lain yang diwakilinya.',
          'Pemungutan suara mengenai diri orang dilakukan dengan surat-surat tertutup tanpa tanda tangan sedangkan pemungutan suara mengenai hal-hal lain dilakukan secara terbuka, kecuali Ketua Rapat menentukan lain dan tidak ada keberatan dari yang hadir.',
          'Suara abstain dan suara yang tidak sah dianggap tidak dikeluarkan, dan dianggap tidak ada.'
        ] }
      ]
    },
    {
      judul: 'Kuorum dan Putusan Rapat Umum Anggota',
      pasal: [
        { no: 27, ayat: [
          { teks: '', butir: [
            'Rapat Umum Anggota adalah sah dan berhak mengambil keputusan yang mengikat apabila dihadiri paling sedikit 2/3 (dua per tiga) dari jumlah Pengurus Pusat, 2/3 (dua per tiga) dari jumlah Anggota Pengawas dan 2/3 (dua per tiga) jumlah Peserta yang sah pada Rapat Umum Anggota.',
            'Dalam hal kuorum sebagaimana dimaksud dalam ayat (1) huruf a tidak tercapai, maka dapat diadakan panggilan Rapat Umum Anggota kedua.',
            'Panggilan sebagaimana yang dimaksud dalam ayat (1) huruf b, harus dilakukan paling lambat 7 (tujuh) hari sebelum Rapat diselenggarakan, dengan tidak memperhitungkan tanggal panggilan dan tanggal Rapat.',
            'Rapat Umum Anggota kedua diselenggarakan paling cepat 10 (sepuluh) hari dan paling lambat 21 (dua puluh satu) hari terhitung sejak Rapat Umum Anggota pertama.',
            'Rapat Umum Anggota kedua adalah sah dan berhak mengambil keputusan yang mengikat apabila dihadiri paling sedikit 1/2 (satu per dua) dari jumlah Anggota Pengurus, 1/2 (satu per dua) dari jumlah Anggota Pengawas, dan 1/2 (satu per dua) jumlah Anggota Biasa.'
          ] },
          'Keputusan Rapat Umum Anggota sebagaimana tersebut di atas ditetapkan berdasarkan musyawarah untuk mufakat.',
          'Dalam hal keputusan berdasarkan musyawarah untuk mufakat tidak tercapai, maka keputusan diambil dengan pemungutan suara berdasarkan suara setuju paling sedikit 2/3 (dua per tiga) bagian dari jumlah suara yang sah yang dikeluarkan dalam Rapat.',
          'Setiap Rapat Umum Anggota dibuat Berita Acara Rapat, yang untuk pengesahannya ditandatangani oleh Ketua Rapat dan 1 (satu) orang Anggota Pengurus atau Anggota Pengawas yang ditunjuk oleh Rapat.',
          'Berita Acara Rapat sebagaimana dimaksud dalam ayat (4) menjadi bukti sah terhadap Perkumpulan dan pihak ketiga tentang keputusan dan segala sesuatu yang terjadi dalam Rapat.',
          'Anggota Pengurus, Anggota Pengawas dan Anggota Biasa dapat juga mengambil keputusan yang sah tanpa mengadakan Rapat Umum Anggota, dengan ketentuan semua Pengurus, semua Pengawas dan semua Anggota Biasa telah diberitahukan secara tertulis dan semua Pengurus, semua Pengawas, dan semua Anggota Biasa memberikan persetujuan mengenai usul yang diajukan secara tertulis, dengan menandatangani usul tersebut.',
          'Keputusan yang diambil dengan cara sebagaimana dimaksud dalam ayat (7) mempunyai kekuatan yang sama dengan keputusan yang diambil dengan sah dengan Rapat Umum Anggota.'
        ] }
      ]
    },
    {
      judul: 'Tahun Buku',
      pasal: [
        { no: 28, ayat: [
          'Tahun buku Perkumpulan dimulai dari tanggal 1 (satu) Januari sampai tanggal 31 (tiga puluh satu) Desember.',
          'Pada akhir Desember tiap tahun, buku Perkumpulan ditutup.',
          'Untuk pertama kalinya tahun buku perkumpulan dimulai pada tanggal dari Akta Pendirian Perkumpulan dan ditutup tanggal 31-12-2022 (tiga puluh satu Desember dua ribu dua puluh dua).'
        ] }
      ]
    },
    {
      judul: 'Laporan Tahunan',
      pasal: [
        { no: 29, ayat: [
          'Pengurus wajib menyusun secara tertulis laporan tahunan paling lambat 5 (lima) bulan setelah berakhirnya tahun buku Perkumpulan.',
          { teks: 'Laporan Tahunan memuat sekurang-kurangnya:', butir: [
            'Laporan keadaan dan kegiatan Perkumpulan selama tahun buku yang lalu serta hasil yang telah dicapai.',
            'Laporan keuangan yang terdiri atas laporan posisi keuangan pada akhir periode, laporan aktivitas, laporan arus kas dan catatan laporan keuangan.'
          ] },
          'Laporan Tahunan wajib ditandatangani oleh Pengurus dan Pengawas.',
          'Dalam hal terdapat Anggota Pengurus atau Anggota Pengawas tidak menandatangani Laporan tersebut, maka yang bersangkutan harus menyebutkan alasannya secara tertulis.'
        ] }
      ]
    },
    {
      judul: 'Perubahan Anggaran Dasar',
      pasal: [
        { no: 30, ayat: [
          'Perubahan Anggaran Dasar hanya dapat dilaksanakan berdasarkan keputusan Rapat Umum Anggota, yang dihadiri paling sedikit 2/3 (dua per tiga) dari jumlah Pengurus, Pengawas, dan Anggota Biasa sebagai Peserta yang sah pada Rapat Umum Anggota.',
          'Keputusan diambil berdasarkan musyawarah untuk mufakat.',
          'Dalam hal keputusan berdasarkan musyawarah untuk mufakat tidak tercapai, maka keputusan ditetapkan berdasarkan persetujuan paling sedikit 2/3 (dua per tiga) dari sejumlah Pengurus, Pengawas dan Anggota Biasa yang hadir atau yang diwakili.',
          'Dalam hal kuorum sebagaimana dimaksud dalam ayat (1) tidak tercapai, maka diadakan pemanggilan Rapat Umum Anggota yang kedua paling cepat 3 (tiga) hari terhitung sejak tanggal Rapat Umum Anggota yang pertama.',
          'Rapat Umum Anggota kedua adalah sah, apabila dihadiri oleh lebih dari 1/2 (satu per dua) dari seluruh Pengurus, Pengawas, dan Anggota Biasa.',
          'Keputusan Rapat Umum Anggota kedua sah, apabila diambil berdasarkan persetujuan suara terbanyak dari jumlah Pengurus, Pengawas, dan Anggota Biasa yang hadir atau yang diwakili.'
        ] },
        { no: 31, ayat: [
          'Perubahan Anggaran Dasar dilakukan dengan Akta Notaris dan dibuat dalam Bahasa Indonesia.',
          'Perubahan Anggaran Dasar tidak dapat dilakukan pada saat Perkumpulan dinyatakan pailit, kecuali atas persetujuan Kurator.'
        ] }
      ]
    },
    {
      judul: 'Mekanisme Pengawasan Internal dan Penyelesaian Sengketa',
      pasal: [
        { no: 32, tanpaNomor: true, ayat: [
          'Fungsi pengawasan internal Perkumpulan dijalankan oleh Dewan Pengawas.'
        ] },
        { no: 33, ayat: [
          'Sengketa antaranggota, antarpengurus, atau antara anggota dengan pengurus yang berkaitan dengan organisasi diselesaikan secara kekeluargaan dengan difasilitasi Dewan Pengawas jika diperlukan.',
          'Jika masalah tidak dapat terselesaikan secara kekeluargaan, pihak-pihak yang bersengketa berhak menempuh jalur hukum sebagaimana yang berlaku di Indonesia.'
        ] }
      ]
    },
    {
      judul: 'Pembubaran',
      pasal: [
        { no: 34, ayat: [
          { teks: 'Perkumpulan bubar karena:', butir: [
            'alasan sebagaimana dimaksud dalam jangka waktu yang ditetapkan dalam Anggaran Dasar berakhir;',
            'Tujuan Perkumpulan yang ditetapkan dalam Anggaran Dasar tidak tercapai;',
            { teks: 'Putusan Pengadilan yang telah mempunyai kekuatan hukum tetap berdasarkan alasan:', butir: [
              'Perkumpulan melanggar ketertiban umum dan kesusilaan;',
              'Tidak mampu membayar utangnya setelah dinyatakan pailit, atau',
              'Harta kekayaan Perkumpulan tidak cukup untuk melunasi utangnya setelah pernyataan pailit dicabut.'
            ] }
          ] },
          'Dalam hal Perkumpulan bubar sebagaimana diatur dalam ayat (1) huruf a dan huruf b, Rapat Umum Anggota menunjuk likuidator untuk membereskan kekayaan Perkumpulan.',
          'Dalam hal tidak ditunjuk likuidator, maka Pengurus bertindak sebagai likuidator.'
        ] },
        { no: 35, ayat: [
          'Dalam hal Perkumpulan bubar, maka Perkumpulan tidak dapat melakukan perbuatan hukum, kecuali untuk membereskan kekayaannya dalam proses likuidasi.',
          'Dalam hal Perkumpulan sedang dalam proses likuidasi, maka semua surat keluar dicantumkan frasa "dalam likuidasi" di belakang nama Perkumpulan.',
          'Dalam Perkumpulan bubar karena putusan pengadilan, maka pengadilan juga menunjuk likuidator.',
          'Dalam hal pembubaran Perkumpulan karena pailit, berlaku peraturan perundang-undangan di bidang kepailitan.',
          'Ketentuan mengenai penunjukan, pengangkatan, pemberhentian sementara, pemberhentian, wewenang, kewajiban, tugas, dan tanggung jawab serta pengawasan terhadap Pengurus, berlaku juga bagi likuidator.',
          'Likuidator atau Kurator dalam jangka waktu paling lambat 7 (tujuh) hari terhitung sejak tanggal proses likuidasi berakhir, wajib melaporkan pembubaran Perkumpulan kepada Pengurus, Pengawas dan Anggota Biasa.'
        ] }
      ]
    },
    {
      judul: 'Cara Penggunaan Kekayaan Sisa Likuidasi',
      pasal: [
        { no: 36, ayat: [
          'Kekayaan sisa hasil likuidasi diserahkan kepada Perkumpulan lain yang mempunyai maksud dan tujuan yang sama dengan Perkumpulan yang bubar.',
          'Kekayaan sisa hasil likuidasi sebagaimana dimaksud dalam ayat (1) dapat diserahkan kepada badan hukum lain yang melakukan kegiatan yang sama dengan Perkumpulan yang bubar, apabila hal tersebut diatur dalam Undang-Undang yang berlaku bagi badan hukum tersebut.',
          'Dalam hal kekayaan sisa hasil likuidasi tidak diserahkan kepada Perkumpulan lain atau kepada badan hukum lain sebagaimana dimaksud dalam ayat (1) dan ayat (2), kekayaan tersebut diserahkan kepada Negara dan penggunaannya dilakukan sesuai dengan maksud dan tujuan Perkumpulan yang bubar.'
        ] }
      ]
    },
    {
      judul: 'Peraturan Penutup',
      pasal: [
        { no: 37, romawi: true, ayat: [
          { teks: 'Hal-hal yang tidak diatur atau belum cukup diatur dalam Anggaran Dasar ini akan diputuskan oleh Rapat Umum Anggota.', paragraf: [
            'Akhirnya untuk pertama kali, susunan Pengurus dan Pengawas adalah sebagai berikut:'
          ], susunan: [
            { kelompok: 'Pengurus', anggota: [
              { jabatan: 'Ketua Umum', nama: 'Haddy Achmad Chalidi' },
              { jabatan: 'Wakil Ketua Umum', nama: 'Bambang Agung Setiawan' },
              { jabatan: 'Sekretaris Umum', nama: 'Mohamad Reza Huzain' },
              { jabatan: 'Bendahara Umum', nama: 'Ahmad Firdaus' }
            ] },
            { kelompok: 'Pengawas', anggota: [
              { jabatan: 'Pengawas', nama: 'Dr. Winardi Sani' }
            ] }
          ] },
          'Pengangkatan Pengurus dan Pengawas Perkumpulan tersebut telah diterima oleh masing-masing yang bersangkutan dan harus disahkan dalam Rapat Umum Anggota pertama kali diadakan, setelah Akta Pendirian ini mendapat pengesahan atau didaftarkan pada instansi yang berwenang.'
        ] }
      ]
    }
  ]
};
