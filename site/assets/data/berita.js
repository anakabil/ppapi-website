/* ==========================================================================
   DATA BERITA & PENGUMUMAN  (assets/data/berita.js)
   --------------------------------------------------------------------------
   ISI SAAT INI
   • PPAPI_DATA.berita berisi artikel edukasi, regulasi, dan organisasi yang
     ditulis Redaksi PPAPI dengan gaya penulisan ilmiah: sitasi dalam teks
     (Penulis, Tahun) dan "Daftar Pustaka" bergaya APA edisi ke-7 di akhir
     setiap artikel. Seluruh rujukan diperiksa dari sumber yang dibuka pada
     Oktober 2026; perbarui bila peraturan atau standar yang dirujuk berubah.
   • PPAPI_DATA.pengumuman KOSONG ([]) sampai sekretariat menerbitkan
     pengumuman resmi (halaman Berita dan Dasbor menyembunyikan bagiannya).
   • Konten contoh telah dihapus; tidak ada butir bertanda contoh: true.

   CARA MENAMBAH BERITA
   1. Salin satu blok { … } di dalam PPAPI_DATA.berita (termasuk koma).
   2. Tempel di PALING ATAS daftar (berita terbaru di atas), lalu isi:
      id        : alamat unik huruf kecil dan tanda hubung, tanpa spasi,
                  misalnya 'pelatihan-inspeksi-november-2026'
                  (dipakai pada tautan berita.html?id=…)
      judul     : judul berita
      kategori  : 'Kegiatan', 'Pengumuman', 'Edukasi', 'Regulasi', atau 'Organisasi'
      tanggal   : format TAHUN-BULAN-TANGGAL, misalnya '2026-11-02'
      ringkasan : 1–2 kalimat ringkas (paling panjang ± 220 huruf)
      isi       : daftar paragraf di antara [ ]. Setiap paragraf diapit tanda
                  kutip dan dipisah koma. Awali dengan '## ' untuk subjudul,
                  '### ' untuk sub-subjudul, dan '- ' untuk butir daftar.
                  Teks di antara *bintang* dicetak miring (judul karya pada
                  Daftar Pustaka). Paragraf setelah subjudul '## Daftar Pustaka'
                  otomatis ditata sebagai entri rujukan.
      gambar    : berkas di folder assets/img, misalnya 'assets/img/facade-bw.webp'
      penulis   : nama penulis/unit, misalnya 'Redaksi PPAPI' atau 'Sekretariat PPAPI'
      sorot     : true = ditampilkan sebagai berita utama (cukup satu)
   3. Jika menulis tanda kutip tunggal (') di dalam teks, gunakan ’ (kutip
      melengkung) agar tidak merusak berkas.
   4. Berita juga dapat ditambahkan tanpa menyunting berkas ini melalui
      Konsol Admin › Konten › Berita (lihat README.md bagian 7).

   PENGUMUMAN: PPAPI_DATA.pengumuman berisi pengumuman singkat
   (id, judul, isi, tanggal, penting: true/false).
   ========================================================================== */
window.PPAPI_DATA = window.PPAPI_DATA || {};

PPAPI_DATA.berita = [
  {
    id: 'kerangka-hukum-pekerjaan-perancah-indonesia',
    judul: 'Kerangka Hukum Pekerjaan Perancah di Indonesia: Kewajiban bagi Pemasang, Pengawas, dan Pemeriksa',
    kategori: 'Regulasi',
    tanggal: '2026-10-14',
    ringkasan: 'Telaah peraturan yang mengikat pekerjaan perancah — dari UU 1/1970, Permenaker 9/2016, Permen PUPR 10/2021, hingga SE Menteri PUPR 10/SE/M/2022 — beserta implikasinya bagi praktisi.',
    isi: [
      'Pekerjaan perancah berada di persimpangan dua rezim hukum: hukum ketenagakerjaan yang menjamin keselamatan dan kesehatan kerja (K3) setiap tenaga kerja, dan hukum jasa konstruksi yang mewajibkan penyelenggaraan keselamatan konstruksi. Artikel ini menelaah peraturan utama yang berlaku pada Oktober 2026 dan merumuskan kewajiban praktis bagi pemasang, pengawas, dan pemeriksa perancah.',
      '## Landasan: Undang-Undang Keselamatan Kerja',
      'Undang-Undang Nomor 1 Tahun 1970 tentang Keselamatan Kerja ditetapkan pada 12 Januari 1970 dan hingga kini berstatus berlaku; undang-undang ini mencabut Veiligheidsreglement 1910 (Republik Indonesia, 1970). Seluruh peraturan K3 konstruksi dan pekerjaan pada ketinggian yang dibahas di bawah merupakan peraturan pelaksanaan dari undang-undang ini, sehingga kewajiban memenuhi syarat keselamatan di tempat kerja — termasuk proyek yang menggunakan perancah — bersumber langsung dari undang-undang.',
      '## Permenaker 9/2016: pekerjaan pada ketinggian',
      'Peraturan Menteri Ketenagakerjaan Nomor 9 Tahun 2016 (Berita Negara Tahun 2016 Nomor 386) mendefinisikan bekerja pada ketinggian sebagai kegiatan di tempat kerja yang terdapat perbedaan ketinggian dan memiliki potensi jatuh yang dapat menyebabkan cedera, kematian, atau kerusakan harta benda (Kementerian Ketenagakerjaan, 2016, Pasal 1 angka 2). Pasal 3 menetapkan lima persyaratan K3 yang wajib dipenuhi: perencanaan, prosedur kerja, teknik bekerja aman, alat pelindung diri beserta perangkat pelindung jatuh dan angkur, serta tenaga kerja. Bagi perancah, Pasal 15 mewajibkan pengusaha dan/atau pengurus memastikan pekerjaan pada ketinggian yang menggunakan perancah dan/atau tangga memenuhi persyaratan K3 yang mengacu pada ketentuan peraturan perundang-undangan (Kementerian Ketenagakerjaan, 2016).',
      'Ketentuan tenaga kerja diatur pada Bab VI. Pasal 31 mewajibkan tersedianya tenaga kerja yang kompeten dan berwenang di bidang K3; kompetensi dibuktikan dengan sertifikat kompetensi hasil uji kompetensi oleh lembaga berwenang (Pasal 32), sedangkan kewenangan dibuktikan dengan Lisensi K3 yang diterbitkan Direktur Jenderal dan berlaku lima tahun (Pasal 33). Pasal 34 secara khusus menyatakan bahwa ketentuan tenaga kerja bidang perancah, gondola, dan pesawat angkat angkut dilaksanakan sesuai peraturan perundang-undangan tersendiri, dan Pasal 35 menggolongkan tenaga kerja menjadi Tenaga Kerja bangunan tinggi tingkat 1 dan 2 serta Tenaga Kerja pada ketinggian tingkat 1 sampai 3 (Kementerian Ketenagakerjaan, 2016).',
      'Perlu dicatat bahwa peraturan ini telah dicabut sebagian: basis data peraturan JDIH BPK mencatat Pasal 1 angka 14 dan Pasal 29 ayat (3) dicabut oleh Peraturan Menteri Ketenagakerjaan Nomor 11 Tahun 2026 tentang Tata Cara Pengawasan Ketenagakerjaan (Badan Pemeriksa Keuangan, t.t.). Permenaker 11/2026 sendiri ditetapkan pada 29 Juni 2026, diundangkan pada 3 Juli 2026, dan mencabut Permenaker 33/2016 beserta perubahannya (Kementerian Ketenagakerjaan, 2026). Praktisi dianjurkan membaca naskah konsolidasi terbaru sebelum mengutip pasal.',
      '## Permen PUPR 10/2021: perancah sebagai pekerjaan bersifat khusus',
      'Di sisi jasa konstruksi, Peraturan Menteri PUPR Nomor 10 Tahun 2021 tentang Pedoman Sistem Manajemen Keselamatan Konstruksi (SMKK) ditetapkan 31 Maret 2021 dan mencabut Permen PUPR 21/PRT/M/2019 (Kementerian Pekerjaan Umum dan Perumahan Rakyat, 2021). SMKK didefinisikan sebagai bagian dari sistem manajemen pelaksanaan pekerjaan konstruksi untuk menjamin terwujudnya keselamatan konstruksi (Pasal 1 angka 3). Pasal 26 mewajibkan penyedia jasa menerapkan Analisis Keselamatan Konstruksi (AKK) untuk pekerjaan berisiko besar dan/atau sedang serta pekerjaan bersifat khusus, yang paling sedikit meliputi pekerjaan di ketinggian lebih dari 1,80 meter dan pekerjaan menggunakan perancah; AKK disusun oleh ahli K3 konstruksi, ahli keselamatan konstruksi, tenaga ahli teknis terkait, dan/atau petugas keselamatan konstruksi (Kementerian Pekerjaan Umum dan Perumahan Rakyat, 2021).',
      '## SE Menteri PUPR 10/SE/M/2022: panduan operasional',
      'Surat Edaran Menteri PUPR Nomor 10/SE/M/2022 yang ditetapkan pada 24 Mei 2022 menjabarkan Permen PUPR 10/2021 ke tingkat operasional. Untuk pekerjaan perancah, surat edaran ini mensyaratkan perhitungan kekuatan dan beban sebelum perancah dibangun, pemasangan dan pemeriksaan oleh personel yang kompeten dan bersertifikat, pelatihan dan sertifikat bagi pemasang maupun pemakai, serta sistem penandaan hijau–kuning–merah (Kementerian Pekerjaan Umum dan Perumahan Rakyat, 2022). Ketentuan ini mengikat di lingkungan Kementerian PUPR, tetapi substansinya lazim diadopsi sebagai praktik baik oleh pemilik proyek lain.',
      '## Standar kompetensi dan sertifikasi',
      'Acuan kompetensi tenaga perancah adalah Keputusan Menteri Ketenagakerjaan Nomor 46 Tahun 2022 tentang SKKNI Bidang Operasi Scaffolding, ditetapkan 20 Mei 2022, yang mencabut Kepmenaker 214/2017 (Kementerian Ketenagakerjaan, 2022). Pada skema Sertifikat Kompetensi Kerja (SKK) Konstruksi, SKKNI 46/2022 menjadi acuan jabatan kerja Operator Pemula Scaffolding (jenjang 2), Operator Scaffolding (jenjang 3), Teknisi Scaffolding (jenjang 4), dan Pengawas Scaffolding (jenjang 5) (Lembaga Pengembangan Jasa Konstruksi, 2025). Sertifikasi dilaksanakan oleh lembaga sertifikasi profesi yang berlisensi Badan Nasional Sertifikasi Profesi, lembaga yang dibentuk berdasarkan Peraturan Pemerintah Nomor 10 Tahun 2018 (Republik Indonesia, 2018).',
      '## Implikasi bagi anggota',
      '- Pemasang: bekerja di bawah prosedur tertulis, memiliki sertifikat kompetensi pada jenjang yang sesuai, dan memasang perancah sesuai perhitungan yang telah disetujui.',
      '- Pengawas: memastikan AKK tersedia untuk setiap pekerjaan perancah, pemasangan diawasi personel kompeten, dan tanda status perancah selalu mutakhir.',
      '- Pemeriksa: memeriksa sebelum perancah digunakan dan secara berkala, lalu mendokumentasikan hasilnya sebagai dasar penandaan hijau, kuning, atau merah.',
      'Kerangka hukum tersebut saling melengkapi: Permenaker 9/2016 menetapkan standar K3 dan tenaga kerja, Permen PUPR 10/2021 mewajibkan analisis risiko pada tingkat proyek, sedangkan SKKNI dan SKK Konstruksi menjamin kompetensi pelaksananya. PPAPI mendorong anggota untuk memetakan kewajiban ini ke dalam prosedur kerja masing-masing.',
      '## Daftar Pustaka',
      'Badan Pemeriksa Keuangan. (t.t.). *Peraturan Menteri Ketenagakerjaan Nomor 9 Tahun 2016 tentang Keselamatan dan Kesehatan Kerja dalam Pekerjaan pada Ketinggian* [Metadata dan status peraturan]. Database Peraturan JDIH BPK. https://peraturan.bpk.go.id/Details/146109/permenaker-no-9-tahun-2016',
      'Kementerian Ketenagakerjaan. (2016). *Peraturan Menteri Ketenagakerjaan Nomor 9 Tahun 2016 tentang Keselamatan dan Kesehatan Kerja dalam Pekerjaan pada Ketinggian* (Berita Negara Republik Indonesia Tahun 2016 Nomor 386). https://peraturan.go.id/files/bn386-2016.pdf',
      'Kementerian Ketenagakerjaan. (2022). *Keputusan Menteri Ketenagakerjaan Nomor 46 Tahun 2022 tentang Penetapan Standar Kompetensi Kerja Nasional Indonesia Kategori Konstruksi Golongan Pokok Konstruksi Khusus Bidang Operasi Scaffolding*. JDIH Kemnaker. https://jdih.kemnaker.go.id/peraturan/detail/2235/keputusan-menteri-ketenagakerjaan-nomor-46-tahun-2022',
      'Kementerian Ketenagakerjaan. (2026). *Peraturan Menteri Ketenagakerjaan Nomor 11 Tahun 2026 tentang Tata Cara Pengawasan Ketenagakerjaan*. JDIH Kemnaker. https://jdih.kemnaker.go.id/peraturan/detail/3070/peraturan-menteri-ketenagakerjaan-nomor-11-tahun-2026',
      'Kementerian Pekerjaan Umum dan Perumahan Rakyat. (2021). *Peraturan Menteri Pekerjaan Umum dan Perumahan Rakyat Nomor 10 Tahun 2021 tentang Pedoman Sistem Manajemen Keselamatan Konstruksi* (Berita Negara Republik Indonesia Tahun 2021 Nomor 286). https://peraturan.go.id/files/bn286-2021.pdf',
      'Kementerian Pekerjaan Umum dan Perumahan Rakyat. (2022). *Surat Edaran Menteri Pekerjaan Umum dan Perumahan Rakyat Nomor 10/SE/M/2022 tentang Panduan Operasional Tertib Penyelenggaraan Keselamatan Konstruksi di Kementerian Pekerjaan Umum dan Perumahan Rakyat*. JDIH PUPR. https://jdih.pu.go.id/internal/assets/assets/produk/SEMenteriPUPR/2022/05/2022SEMenteriPUPR10.pdf',
      'Lembaga Pengembangan Jasa Konstruksi. (2025). *Surat Edaran Ketua LPJK Nomor 03/SE/LPJK/2025 tentang Perubahan atas Surat Edaran Ketua LPJK Nomor 01/SE/LPJK/2025 tentang Pedoman Pemberian Rekomendasi Lisensi Lembaga Sertifikasi Profesi* [Lampiran XVII: skema sertifikasi dan jenjang jabatan kerja]. Kementerian Pekerjaan Umum. https://lisensijakon.pu.go.id/panduan/03_SE.LPJK.2025_Perubahan%20atas%20SE%2001%20thn%202025%20tentang%20Pedoman%20Pemberian%20Rekomendasi%20Lisensi%20LSP.pdf',
      'Republik Indonesia. (1970). *Undang-Undang Nomor 1 Tahun 1970 tentang Keselamatan Kerja*. Database Peraturan JDIH BPK. https://peraturan.bpk.go.id/Details/47614',
      'Republik Indonesia. (2018). *Peraturan Pemerintah Nomor 10 Tahun 2018 tentang Badan Nasional Sertifikasi Profesi* (Lembaran Negara Republik Indonesia Tahun 2018 Nomor 32). Database Peraturan JDIH BPK. https://peraturan.bpk.go.id/Details/72812/pp-no-10-tahun-2018'
    ],
    gambar: 'assets/img/stair-tower.webp',
    penulis: 'Redaksi PPAPI',
    sorot: true
  },
  {
    id: 'angka-kecelakaan-kerja-2025-pelajaran-perancah',
    judul: 'Membaca Angka Kecelakaan Kerja 2025: Pelajaran bagi Pengelolaan Perancah',
    kategori: 'Edukasi',
    tanggal: '2026-10-07',
    ringkasan: 'Data klaim kecelakaan kerja nasional 2024–2025 dan temuan kajian internasional tentang kecelakaan perancah menunjukkan pola yang sama: pengikatan, pengaku, pagar pengaman, dan kompetensi pemasang.',
    isi: [
      'Statistik kecelakaan kerja jarang memerinci jenis peralatan yang terlibat, tetapi tetap menjadi cermin bagi profesi perancah. Artikel ini membaca angka nasional terbaru yang dapat diverifikasi, membandingkannya dengan temuan penelitian kecelakaan perancah di luar negeri, lalu menarik pelajaran praktis bagi anggota.',
      '## Angka nasional 2024–2025',
      'Menteri Ketenagakerjaan Yassierli menyampaikan bahwa berdasarkan data 2025 tercatat 319.224 klaim kecelakaan kerja di Indonesia; dari jumlah itu 9.834 kasus berujung kematian dan 4.133 kasus menyebabkan cacat fungsi maupun cacat total (Antara, 2026). Wakil Menteri Ketenagakerjaan Afriansyah Noor menyebut jumlah kasus turun dari 462.241 kasus pada 2024 menjadi 319.382 kasus pada 2025 (IQPlus, 2026). Dua angka 2025 tersebut berbeda tipis karena basis penghitungan (klaim versus kasus) dan waktu rilis yang berbeda; keduanya tetap menunjukkan skala persoalan: hampir sepuluh ribu kematian akibat kerja dalam setahun.',
      'Dari sisi pembiayaan, Kontan melaporkan bahwa pada Januari–November 2024 klaim Jaminan Kecelakaan Kerja mencapai Rp3,06 triliun, dengan jasa konstruksi menyumbang 1,81 persen klaim atau Rp55,45 miliar (Susanto, 2025). Angka ini tidak memisahkan kecelakaan yang melibatkan perancah, dan sumber resmi yang kami buka belum menyediakan rincian penyebab jatuh dari ketinggian per sektor untuk 2025. Redaksi memilih tidak mengutip persentase yang beredar tanpa dokumen sumber.',
      '## Apa yang ditemukan penelitian kecelakaan perancah',
      'Penelitian lapangan memberi gambaran yang lebih spesifik. Halperin dan McCann (2004) menilai 113 perancah tumpu di sembilan wilayah Amerika Serikat bagian timur dengan daftar periksa 150 butir dan menemukan sekitar 32 persen perancah berisiko runtuh atau tidak memiliki papan lantai, pagar pengaman, atau akses yang memadai. Praktik yang lebih aman berkorelasi kuat dengan keberadaan personel kompeten yang telah mengikuti pelatihan keselamatan perancah, penggunaan kontraktor pemasang tersendiri, dan jenis perancah yang bukan rangka sederhana.',
      'Rubio-Romero et al. (2013) memeriksa perancah tumpu pada 105 lokasi bangunan di Spanyol dan menilai secara kualitatif kondisi pengaku, pengikat ke bangunan, papan kaki, pagar pengaman, tangga, dan platform. Mereka mencatat bahwa standar Eropa EN 12810 dan EN 12811 bersifat tidak wajib bagi pabrikan sehingga perancah yang memenuhi dan yang tidak memenuhi standar sama-sama dijumpai di lapangan, antara lain karena perancah yang memenuhi standar lebih mahal.',
      'Analisis terbaru oleh Yalçın (2024) terhadap 280 laporan kecelakaan perancah dari OSHA periode 2019–2023 dengan metode Pareto–Lorenz menunjukkan penyebab utama dari sisi pekerja adalah kehilangan keseimbangan, dari sisi peralatan adalah kegagalan pengaku dan runtuhnya perancah, dan dari sisi lingkungan adalah pekerja yang tertimpa atau terbentur benda. Survei terhadap 120 praktisi konstruksi di Arab Saudi menempatkan pengaku atau angkur yang tidak memadai (indeks kepentingan relatif 0,927), perancah yang dipasang oleh personel tidak kompeten (0,926), dan pagar pengaman yang hilang atau rusak (0,919) sebagai tiga penyebab teratas dari 36 penyebab kecelakaan perancah (Sanni-Anibire et al., 2020).',
      '## Benang merah',
      'Walaupun berasal dari negara dan periode yang berbeda, temuan tersebut bertemu pada empat hal: (1) pengikatan dan pengaku yang menjaga stabilitas struktur, (2) kelengkapan proteksi kolektif berupa pagar pengaman, papan kaki, dan platform penuh, (3) kompetensi pemasang dan pemeriksa, serta (4) perilaku pengguna di atas perancah. Keempatnya sejalan dengan kewajiban dalam regulasi nasional yang menggolongkan pekerjaan perancah sebagai pekerjaan bersifat khusus yang wajib dianalisis risikonya (Kementerian Pekerjaan Umum dan Perumahan Rakyat, 2021).',
      '## Implikasi bagi anggota',
      '- Perlakukan pengikat (tie) dan pengaku (bracing) sebagai komponen struktural yang tidak boleh dilepas tanpa persetujuan perancang.',
      '- Jadikan pagar pengaman ganda, papan kaki, dan platform tertutup penuh sebagai syarat minimum sebelum tag hijau dipasang.',
      '- Catat setiap nyaris celaka (near miss) di perancah; data internal perusahaan sering lebih kaya daripada statistik nasional.',
      '- Dukung pencatatan kecelakaan yang memerinci peralatan dan mekanisme kejadian, agar statistik nasional dapat menjawab pertanyaan spesifik profesi ini.',
      '## Daftar Pustaka',
      'Antara. (2026, 22 Mei). *Menaker tegaskan BPJS Ketenagakerjaan menjadi penggerak utama K3*. https://megapolitan.antaranews.com/berita/531057/menaker-tegaskan-bpjs-ketenagakerjaan-menjadi-penggerak-utama-k3',
      'Halperin, K. M., & McCann, M. (2004). An evaluation of scaffold safety at construction sites. *Journal of Safety Research, 35*(2), 141–150. https://doi.org/10.1016/j.jsr.2003.11.004',
      'IQPlus. (2026, 24 Juni). *Kemnaker pacu kematangan budaya K3*. BCA Sekuritas. https://bcasekuritas.co.id/latest-news/news/kemnaker-pacu-kematangan-budaya-k3',
      'Kementerian Pekerjaan Umum dan Perumahan Rakyat. (2021). *Peraturan Menteri Pekerjaan Umum dan Perumahan Rakyat Nomor 10 Tahun 2021 tentang Pedoman Sistem Manajemen Keselamatan Konstruksi* (Berita Negara Republik Indonesia Tahun 2021 Nomor 286). https://peraturan.go.id/files/bn286-2021.pdf',
      'Rubio-Romero, J. C., Rubio Gámez, M. C., & Carrillo-Castrillo, J. A. (2013). Analysis of the safety conditions of scaffolding on construction sites. *Safety Science, 55*, 160–164. https://doi.org/10.1016/j.ssci.2013.01.006',
      'Sanni-Anibire, M., Mahmoud, A., & Al-Ayouni, M. (2020). Causes of scaffold accidents in construction industry. *Proceedings of International Structural Engineering and Construction, 7*(1), CSA-02. https://doi.org/10.14455/ISEC.res.2020.7(1).CSA-02',
      'Susanto, V. Y. (2025, 15 Januari). Angka kecelakaan kerja di Indonesia menanjak. *Kontan*. https://insight.kontan.co.id/news/angka-kecelakaan-kerja-di-indonesia-menanjak',
      'Yalçın, E. (2024). Analysis of fall accidents from scaffolding in the construction industry. *Građevinar, 76*(10), 907–917. https://doi.org/10.14256/JCE.4106.2024'
    ],
    gambar: 'assets/img/facade-bw.webp',
    penulis: 'Redaksi PPAPI',
    sorot: false
  },
  {
    id: 'inspeksi-perancah-dan-penandaan-hijau-kuning-merah',
    judul: 'Inspeksi Perancah dan Sistem Penandaan Hijau–Kuning–Merah: Praktik Nasional dan Internasional',
    kategori: 'Edukasi',
    tanggal: '2026-09-30',
    ringkasan: 'Kapan perancah harus diperiksa, siapa yang berwenang, apa yang dicatat, dan bagaimana tag berwarna menerjemahkan hasil pemeriksaan menjadi keputusan yang dipahami setiap pekerja.',
    isi: [
      'Tag berwarna pada perancah hanyalah ujung dari sebuah sistem: pemeriksaan oleh orang yang kompeten, kriteria penerimaan yang jelas, dan catatan yang dapat ditelusuri. Artikel ini menyarikan ketentuan nasional dan praktik internasional mengenai inspeksi perancah serta penandaannya.',
      '## Ketentuan nasional',
      'Surat Edaran Menteri PUPR Nomor 10/SE/M/2022 menetapkan tiga warna tanda. Hijau menandakan perancah telah selesai dibangun dan aman dipergunakan sesuai kapasitas beban yang tertera; kuning menandakan perancah sedang atau belum selesai dibangun dan tidak boleh dipergunakan; merah menandakan perancah rusak dan tidak boleh atau tidak aman dipergunakan. Pekerja yang akan menggunakan perancah wajib memastikan tag hijau terpasang, perancah yang terpapar cuaca harus diperiksa ulang oleh personel ahli yang diizinkan sebelum pemakaian diteruskan, dan semua perancah harus melalui pemeriksaan mingguan serta sertifikasi ulang; pemakai juga tidak dibenarkan mengubah struktur atau platform perancah (Kementerian Pekerjaan Umum dan Perumahan Rakyat, 2022).',
      'Permenaker 9/2016 menempatkan pemeriksaan ini dalam kerangka prosedur kerja tertulis yang wajib dimiliki pengusaha dan/atau pengurus, yang mencakup teknik perlindungan jatuh, pengelolaan peralatan, pengawasan pekerjaan, pengamanan tempat kerja, serta kesiapsiagaan dan tanggap darurat (Kementerian Ketenagakerjaan, 2016, Pasal 6).',
      '## Praktik internasional',
      'Di Amerika Serikat, 29 CFR 1926.451(f)(3) mewajibkan perancah dan komponennya diperiksa dari cacat yang terlihat oleh personel kompeten sebelum setiap giliran kerja dan setelah setiap kejadian yang dapat memengaruhi integritas strukturnya (Occupational Safety and Health Administration, t.t.-a). Di Inggris, Work at Height Regulations 2005 regulation 12 mensyaratkan peralatan yang keselamatannya bergantung pada cara pemasangannya tidak digunakan sebelum diperiksa pada posisinya, pemeriksaan berkala pada interval yang sesuai dan setelah keadaan luar biasa, serta — bagi platform kerja konstruksi yang memungkinkan jatuh 2 meter atau lebih — pemeriksaan dalam tujuh hari terakhir; hasilnya dicatat dan laporan disampaikan dalam 24 jam (United Kingdom, 2005). Panduan HSE merangkumnya sebagai pemeriksaan setelah perakitan, setelah kejadian yang dapat memengaruhi stabilitas, dan pada interval tidak lebih dari tujuh hari (Health and Safety Executive, 2014).',
      'Kode praktik ILO yang direvisi pada 2022 menganjurkan perancah diperiksa dan hasilnya dicatat oleh personel kompeten sebelum digunakan, pada interval berkala, dan setelah perubahan, jeda penggunaan, paparan cuaca, atau gempa; pemeriksaan harus memastikan jenis perancah sesuai pekerjaan, material sehat dan cukup kuat, konstruksi stabil, dan pengaman terpasang. Bagian perancah yang belum siap dipakai — misalnya selama pemasangan atau pembongkaran — harus diberi tanda peringatan (International Labour Organization, 2022, butir 10.4). Panduan pemerintah New South Wales mengingatkan pengguna untuk membaca setiap tag atau pemberitahuan yang terpasang dan memastikan perancah telah selesai dibangun sebelum digunakan (NSW Government, t.t.).',
      '## Siapa yang berwenang memeriksa',
      'Semua sumber di atas menyebut personel kompeten. HSE mendefinisikannya sebagai orang yang memiliki keterampilan, pengalaman, dan pengetahuan yang diperlukan untuk mengelola keselamatan dan kesehatan (Health and Safety Executive, 2014). Di Indonesia, kompetensi itu dibuktikan dengan sertifikat kompetensi, dan pada skema SKK Konstruksi unit kompetensi Pengawas Scaffolding (jenjang 5) mencakup memeriksa gambar kerja, mengawasi proses operasi, dan memeriksa hasil pemasangan scaffolding di tempat kerja (Lembaga Pengembangan Jasa Konstruksi, 2025).',
      '## Dari temuan ke tag',
      '- Periksa per elemen: tumpuan dan pelat dasar, tiang, ledger dan transom, klem dan sambungan, pengaku, pengikat ke bangunan, platform, pagar pengaman, papan kaki, serta akses.',
      '- Putuskan status: semua kriteria terpenuhi → hijau; sedang dipasang, dibongkar, atau diubah → kuning; ada cacat yang membahayakan → merah dan perancah dikosongkan.',
      '- Catat: tanggal dan jam, nama pemeriksa, kapasitas beban, batasan penggunaan, dan tanggal pemeriksaan berikutnya.',
      '- Ulangi pemeriksaan setelah angin kencang, hujan lebat, benturan kendaraan, atau perubahan konfigurasi, tanpa menunggu jadwal mingguan.',
      '## Simpulan',
      'Tag yang jujur hanya mungkin bila pemeriksaannya sungguh-sungguh. PPAPI mendorong anggota memakai daftar periksa berbasis elemen, memisahkan peran pemasang dan pemeriksa bila memungkinkan, dan menyimpan catatan pemeriksaan sebagai bagian dari dokumen proyek.',
      '## Daftar Pustaka',
      'Health and Safety Executive. (2014). *Working at height: A brief guide* (INDG401 rev2). https://www.hse.gov.uk/pubns/indg401.pdf',
      'International Labour Organization. (2022). *Safety and health in construction: ILO code of practice* (Rev. ed.). https://www.ilo.org/resource/other/safety-and-health-construction-revised-edition',
      'Kementerian Ketenagakerjaan. (2016). *Peraturan Menteri Ketenagakerjaan Nomor 9 Tahun 2016 tentang Keselamatan dan Kesehatan Kerja dalam Pekerjaan pada Ketinggian* (Berita Negara Republik Indonesia Tahun 2016 Nomor 386). https://peraturan.go.id/files/bn386-2016.pdf',
      'Kementerian Pekerjaan Umum dan Perumahan Rakyat. (2022). *Surat Edaran Menteri Pekerjaan Umum dan Perumahan Rakyat Nomor 10/SE/M/2022 tentang Panduan Operasional Tertib Penyelenggaraan Keselamatan Konstruksi di Kementerian Pekerjaan Umum dan Perumahan Rakyat*. JDIH PUPR. https://jdih.pu.go.id/internal/assets/assets/produk/SEMenteriPUPR/2022/05/2022SEMenteriPUPR10.pdf',
      'Lembaga Pengembangan Jasa Konstruksi. (2025). *Surat Edaran Ketua LPJK Nomor 03/SE/LPJK/2025 tentang Perubahan atas Surat Edaran Ketua LPJK Nomor 01/SE/LPJK/2025 tentang Pedoman Pemberian Rekomendasi Lisensi Lembaga Sertifikasi Profesi* [Lampiran XVII: skema sertifikasi dan jenjang jabatan kerja]. Kementerian Pekerjaan Umum. https://lisensijakon.pu.go.id/panduan/03_SE.LPJK.2025_Perubahan%20atas%20SE%2001%20thn%202025%20tentang%20Pedoman%20Pemberian%20Rekomendasi%20Lisensi%20LSP.pdf',
      'NSW Government. (t.t.). Scaffolds. Dalam *Dogging and rigging guide: Part 2 – Dogging and rigging activities*. https://www.nsw.gov.au/employment/dogging-and-rigging/guide/part-2-dogging-and-rigging-activities/steel-erection/scaffolds',
      'Occupational Safety and Health Administration. (t.t.-a). *29 CFR 1926.451 – General requirements* (Safety and Health Regulations for Construction, Subpart L – Scaffolds). U.S. Department of Labor. https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.451',
      'United Kingdom. (2005). *The Work at Height Regulations 2005* (SI 2005/735), regulation 12. legislation.gov.uk. https://www.legislation.gov.uk/uksi/2005/735/regulation/12'
    ],
    gambar: 'assets/img/ringlock-pattern.webp',
    penulis: 'Redaksi PPAPI',
    sorot: false
  },
  {
    id: 'kelas-beban-perancah-en-12811-tg20-duty',
    judul: 'Kelas Beban Perancah: Memahami EN 12811-1, TG20:21, dan Kelas Tugas Perancah bagi Praktisi',
    kategori: 'Edukasi',
    tanggal: '2026-09-23',
    ringkasan: 'Konsep kelas beban (load class) dan kelas lebar menurut EN 12811-1, konfigurasi baku TG20:21, serta kelas tugas ringan–sedang–berat yang dipakai di Australia — dan cara memakainya di lapangan.',
    isi: [
      'Pertanyaan paling mendasar sebelum menaruh material di atas perancah adalah: berapa beban yang boleh dipikul platform ini? Jawabannya bergantung pada kelas beban yang ditetapkan saat perancah direncanakan. Artikel ini memperkenalkan konsep kelas beban menurut standar Eropa dan pedoman internasional lain sebagai bekal praktisi, bukan sebagai pengganti perhitungan oleh perancang.',
      '## Mengapa harus dihitung',
      'Ketentuan nasional tegas: sebelum perancah dibangun harus dilakukan perhitungan kekuatan perancah dan bebannya, dan tag hijau hanya berlaku sesuai kapasitas beban yang tertera (Kementerian Pekerjaan Umum dan Perumahan Rakyat, 2022). Regulasi Amerika Serikat mensyaratkan setiap perancah dan komponennya mampu menahan beratnya sendiri ditambah sekurang-kurangnya empat kali beban maksimum yang direncanakan, dan perancah dirancang oleh orang yang berkualifikasi (Occupational Safety and Health Administration, t.t.-a, §1926.451(a)(1) dan (a)(6)). Kode praktik ILO menganjurkan perancah dirancang untuk beban maksimumnya dengan faktor keamanan 4 atau sebagaimana ditetapkan otoritas yang berwenang (International Labour Organization, 2022, butir 10.3.1).',
      '## Kelas beban menurut EN 12811-1',
      'BS EN 12811-1:2003, yang diterbitkan BSI pada 16 Juni 2004 dan masih berstatus berlaku, menetapkan persyaratan kinerja dan metode desain struktural serta desain umum perancah akses dan perancah kerja, dengan pengecualian antara lain platform gantung bertali dan menara akses bergerak (British Standards Institution, 2004a). Standar ini mengelompokkan platform kerja ke dalam enam kelas beban. Tabel yang direproduksi dalam DGUV Information 201-011 dari DIN EN 12811-1 menyebutkan beban terbagi merata 0,75 kN/m² (kelas 1), 1,5 kN/m² (kelas 2), 2,0 kN/m² (kelas 3), 3,0 kN/m² (kelas 4), 4,5 kN/m² (kelas 5), dan 6,0 kN/m² (kelas 6); untuk kelas 4 sampai 6 ditambahkan beban bidang sebagian sebesar 5,0; 7,5; dan 10,0 kN/m². Standar yang sama menetapkan kelas lebar platform dari W06 (0,6 sampai kurang dari 0,9 m) hingga W24 (2,4 m atau lebih) (Deutsche Gesetzliche Unfallversicherung, t.t.).',
      'Dalam praktik, 1 kN/m² kira-kira setara 100 kg per meter persegi. Platform kelas 3 (2,0 kN/m²) selebar 1 meter dan sepanjang 2 meter, misalnya, direncanakan untuk beban terbagi sekitar 400 kg termasuk pekerja, perkakas, dan material. Angka ini bukan izin untuk menumpuk 400 kg bata di satu titik: kelas beban mengasumsikan beban terbagi, sedangkan beban terpusat harus ditinjau tersendiri oleh perancang.',
      '## TG20:21 dan konfigurasi baku',
      'Work at Height Regulations 2005 di Inggris mewajibkan perhitungan kekuatan dan stabilitas perancah kecuali catatan perhitungannya sudah tersedia atau perancah dirakit sesuai konfigurasi baku yang diakui secara umum; rencana perakitan, penggunaan, dan pembongkaran harus disusun oleh orang kompeten (United Kingdom, 2005, Schedule 3). Untuk perancah pipa dan klem, National Access & Scaffolding Confederation (NASC) menerbitkan TG20 sebagai panduan praktik baik. Lembar kepatuhan (compliance sheet) yang dihasilkan perangkat lunak TG20 eGuide membentuk konfigurasi baku yang diterima HSE dan telah didesain menurut BS EN 12811; untuk setiap perancah harus tersedia lembar kepatuhan TG20 yang sesuai atau gambar desain khusus (National Access & Scaffolding Confederation, 2024). Edisi TG20:21 diluncurkan pada April 2021 bersama CADS dengan Operational Guide, Design Guide, User Guide, dan eGuide yang diperbarui, serta menambah jenis struktur seperti birdcage luar ruangan dan menara bergerak pipa dan klem (SM Newsdesk, 2021).',
      '## Kelas tugas ringan, sedang, berat',
      'Australia memakai pendekatan kelas tugas per bentang (bay). Pedoman pemerintah New South Wales menyebutkan beban maksimum perancah tugas ringan 225 kg per platform per bentang, termasuk berat orang dan material, dan menganjurkan perancah yang kelas tugasnya tidak diketahui diperlakukan sebagai tugas ringan (NSW Government, t.t.). Pendekatan per bentang ini mudah dikomunikasikan di lapangan, tetapi tetap harus ditelusuri kembali ke perhitungan perancang.',
      '## Panduan bagi praktisi',
      '- Pastikan kelas beban (atau kelas tugas) tertulis pada gambar rencana dan pada tag hijau; tanpa keterangan, anggap kelas terendah.',
      '- Hitung beban nyata: jumlah pekerja, perkakas, material yang disimpan, dan beban angin pada jaring atau terpal.',
      '- Hindari pemusatan beban di satu bentang atau satu papan; sebarkan material dan jangan melampaui lebar platform yang direncanakan.',
      '- Konfigurasi di luar panduan baku — misalnya bentang lebar, kantilever, atau beban mesin — memerlukan desain oleh perancang yang kompeten.',
      'Bagi anggota PPAPI, memahami bahasa kelas beban memudahkan komunikasi antara perancang, pemasang, pemeriksa, dan pengguna, dan menutup celah yang sering menjadi awal keruntuhan perancah.',
      '## Daftar Pustaka',
      'British Standards Institution. (2004a). *BS EN 12811-1:2003 Temporary works equipment – Scaffolds – Part 1: Performance requirements and general design*. BSI Knowledge. https://knowledge.bsigroup.com/products/temporary-works-equipment-scaffolds-performance-requirements-and-general-design',
      'Deutsche Gesetzliche Unfallversicherung. (t.t.). *DGUV Information 201-011: Verwendung von Arbeits-, Schutz- und Montagegerüsten* (Bab 6.1: Breiten- und Lastklassen, Anwendungsbeispiele). https://vorschriften.bgn-branchenwissen.de/daten/dguv/201_011/6.htm',
      'International Labour Organization. (2022). *Safety and health in construction: ILO code of practice* (Rev. ed.). https://www.ilo.org/resource/other/safety-and-health-construction-revised-edition',
      'Kementerian Pekerjaan Umum dan Perumahan Rakyat. (2022). *Surat Edaran Menteri Pekerjaan Umum dan Perumahan Rakyat Nomor 10/SE/M/2022 tentang Panduan Operasional Tertib Penyelenggaraan Keselamatan Konstruksi di Kementerian Pekerjaan Umum dan Perumahan Rakyat*. JDIH PUPR. https://jdih.pu.go.id/internal/assets/assets/produk/SEMenteriPUPR/2022/05/2022SEMenteriPUPR10.pdf',
      'National Access & Scaffolding Confederation. (2024). *TG20 Operational Guide* [Presentasi, Rev 000, 29 Agustus 2024]. Sell2Wales. https://www.sell2wales.gov.wales/Assets/NoticeBuilder_FileDownload.aspx?id=346979',
      'NSW Government. (t.t.). Scaffolds. Dalam *Dogging and rigging guide: Part 2 – Dogging and rigging activities*. https://www.nsw.gov.au/employment/dogging-and-rigging/guide/part-2-dogging-and-rigging-activities/steel-erection/scaffolds',
      'Occupational Safety and Health Administration. (t.t.-a). *29 CFR 1926.451 – General requirements* (Safety and Health Regulations for Construction, Subpart L – Scaffolds). U.S. Department of Labor. https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.451',
      'SM Newsdesk. (2021, 12 April). Latest scaffolding guidance TG20:21 now on sale. *ScaffMag*. https://scaffmag.com/scaffolding-news/latest-scaffolding-guidance-tg2021-now-on-sale/',
      'United Kingdom. (2005). *The Work at Height Regulations 2005* (SI 2005/735), Schedule 3. legislation.gov.uk. https://www.legislation.gov.uk/uksi/2005/735/schedule/3'
    ],
    gambar: 'assets/img/tower-heritage.webp',
    penulis: 'Redaksi PPAPI',
    sorot: false
  },
  {
    id: 'kompetensi-sertifikasi-tenaga-perancah-skkni-skk-cisrs',
    judul: 'Kompetensi dan Sertifikasi Tenaga Perancah: SKKNI, SKK Konstruksi, Lisensi K3, dan Perbandingan dengan CISRS',
    kategori: 'Regulasi',
    tanggal: '2026-09-16',
    ringkasan: 'Peta jalur sertifikasi tenaga perancah di Indonesia — SKKNI Kepmenaker 46/2022, SKK Konstruksi jenjang 2–5, serta Lisensi K3 Permenaker 9/2016 — dibandingkan dengan skema CISRS di Inggris.',
    isi: [
      'Pertanyaan yang sering diajukan calon anggota adalah sertifikat apa yang sebenarnya dibutuhkan seorang tenaga perancah. Jawabannya bergantung pada peran yang dijalankan dan sektor tempat bekerja. Artikel ini memetakan jalur sertifikasi yang berlaku di Indonesia dan membandingkannya dengan skema pencatatan tenaga perancah di Inggris sebagai pembanding internasional.',
      '## Standar kompetensi: SKKNI Bidang Operasi Scaffolding',
      'Standar kompetensi tenaga perancah ditetapkan melalui Keputusan Menteri Ketenagakerjaan Nomor 46 Tahun 2022 tentang SKKNI Kategori Konstruksi Golongan Pokok Konstruksi Khusus Bidang Operasi Scaffolding, yang ditetapkan pada 20 Mei 2022 dan mencabut Kepmenaker 214/2017 (Kementerian Ketenagakerjaan, 2022). Kepmenaker 214/2017 sendiri ditetapkan 3 Agustus 2017 dan sebelumnya mencabut KEP.211/MEN/X/2008, sehingga standar ini telah melalui tiga generasi penyempurnaan (Kementerian Ketenagakerjaan, 2017). SKKNI memuat peta kompetensi, daftar unit kompetensi, serta uraian elemen, kriteria unjuk kerja, batasan variabel, dan panduan penilaian.',
      '## Jalur SKK Konstruksi',
      'Pada sektor jasa konstruksi, SKKNI tersebut diterjemahkan menjadi skema Sertifikat Kompetensi Kerja (SKK) Konstruksi. Lampiran Surat Edaran Ketua LPJK Nomor 03/SE/LPJK/2025 mencantumkan empat jabatan kerja yang mengacu SKKNI 46-2022 pada klasifikasi mekanikal, subklasifikasi alat berat: Operator Pemula Scaffolding (jenjang 2), Operator Scaffolding (jenjang 3), Teknisi Scaffolding (jenjang 4), dan Pengawas Scaffolding (jenjang 5). Unit kompetensi Teknisi Scaffolding antara lain membuat gambar kerja, menghitung kekuatan, dan membuat rencana biaya scaffolding, sedangkan Pengawas Scaffolding mencakup memeriksa gambar kerja, mengawasi proses operasi, dan memeriksa hasil pemasangan scaffolding di tempat kerja. Pada klasifikasi sipil terdapat pula jabatan Tukang Pasang Perancah dan Acuan/Cetakan Beton (jenjang 1) serta Kepala Tukang Pasang Perancah dan Acuan/Cetakan Beton (jenjang 2), yang acuan SKKNI-nya antara lain Kepmenaker 54/2015 (Lembaga Pengembangan Jasa Konstruksi, 2025).',
      'Uji kompetensi dilaksanakan oleh lembaga sertifikasi profesi (LSP) yang berlisensi Badan Nasional Sertifikasi Profesi (BNSP). BNSP adalah lembaga independen yang dibentuk untuk melaksanakan sertifikasi kompetensi kerja (Badan Nasional Sertifikasi Profesi, t.t.) berdasarkan Peraturan Pemerintah Nomor 10 Tahun 2018 yang ditetapkan 15 Maret 2018 dan mencabut PP 23/2004 (Republik Indonesia, 2018).',
      '## Jalur Lisensi K3 bekerja pada ketinggian',
      'Di luar sertifikat kompetensi, Permenaker 9/2016 mewajibkan tenaga kerja pada ketinggian juga berwenang di bidang K3, yang dibuktikan dengan Lisensi K3 terbitan Direktur Jenderal dan berlaku lima tahun (Kementerian Ketenagakerjaan, 2016, Pasal 31–33). Pasal 35 sampai 38 merinci lima kategori: Tenaga Kerja bangunan tinggi tingkat 1 bekerja pada lantai kerja tetap atau sementara dengan jala, bantalan, atau tali pembatas gerak; tingkat 2 ditambah kewenangan bergerak horizontal atau vertikal pada struktur bangunan, bekerja pada posisi miring, dan melakukan upaya pertolongan dalam keadaan darurat; sedangkan Tenaga Kerja pada ketinggian tingkat 1 sampai 3 berkaitan dengan akses tali dan pembuatan angkur, dengan tingkat 3 berwenang menyusun perencanaan sistem keselamatan bekerja pada ketinggian. Pasal 34 menegaskan bahwa ketentuan tenaga kerja bidang perancah dilaksanakan sesuai peraturan perundang-undangan tersendiri (Kementerian Ketenagakerjaan, 2016).',
      '## Pembanding: CISRS di Inggris',
      'Construction Industry Scaffolders Record Scheme (CISRS) telah beroperasi lebih dari 50 tahun dengan lebih dari 70.000 pemegang kartu di Inggris dan lebih dari 100.000 di seluruh dunia, dan diutamakan oleh CSCS, NASC, Build UK, UNITE, serta pabrikan sistem perancah besar (Construction Industry Scaffolders Record Scheme, t.t.-a). Kartu Scaffolder (System), misalnya, diperoleh setelah menyelesaikan CISRS Part 1 dan Part 2, kualifikasi vokasi tingkat 2, uji keterampilan satu hari, dan tes keselamatan CITB; kartu berlaku lima tahun dan diperbarui melalui kursus penyegaran dua hari. Pemegang kartu sistem tidak dianggap kompeten memasang, mengubah, atau membongkar struktur pipa dan klem karena tidak menerima pelatihan untuk itu (Construction Industry Scaffolders Record Scheme, t.t.-b). Pemisahan kompetensi per jenis perancah ini patut dicermati karena SKK Konstruksi saat ini belum membedakan sistem dan pipa-klem pada jabatan kerjanya.',
      'Regulasi Inggris menuntut perakitan, pembongkaran, atau perubahan signifikan perancah diawasi orang kompeten dan dilakukan oleh orang yang telah menerima pelatihan yang sesuai dan spesifik (United Kingdom, 2005, Schedule 3). HSE menambahkan bahwa skema pelatihan dan sertifikasi yang disusun asosiasi dagang dan industri merupakan salah satu cara menunjukkan kompetensi (Health and Safety Executive, 2014). Di Amerika Serikat, OSHA mewajibkan setiap pekerja di atas perancah dilatih oleh orang berkualifikasi dan setiap pekerja yang memasang, membongkar, atau memeriksa perancah dilatih oleh personel kompeten, dengan pelatihan ulang bila ada perubahan di lokasi atau jenis perancah (Occupational Safety and Health Administration, t.t.-c).',
      '## Simpulan bagi anggota',
      '- Pelaksana lapangan: SKK Konstruksi Operator Pemula/Operator Scaffolding dan, bila bekerja pada ketinggian, Lisensi K3 Tenaga Kerja bangunan tinggi.',
      '- Teknisi dan pengawas: SKK Teknisi (jenjang 4) atau Pengawas Scaffolding (jenjang 5) sebagai bukti kemampuan menghitung, menggambar, dan memeriksa.',
      '- Semua peran: catat nomor, penerbit, dan masa berlaku sertifikat pada Profil Anggota agar pengingat kedaluwarsa berfungsi.',
      '## Daftar Pustaka',
      'Badan Nasional Sertifikasi Profesi. (t.t.). *BNSP – Badan Nasional Sertifikasi Profesi*. https://bnsp.go.id/',
      'Construction Industry Scaffolders Record Scheme. (t.t.-a). *CISRS: Scaffold training, recognised across the industry*. https://cisrs.org.uk/',
      'Construction Industry Scaffolders Record Scheme. (t.t.-b). *CISRS Scaffolder (System) card*. https://cisrs.org.uk/training/cisrs-cards/scaffolder-system.html',
      'Health and Safety Executive. (2014). *Working at height: A brief guide* (INDG401 rev2). https://www.hse.gov.uk/pubns/indg401.pdf',
      'Kementerian Ketenagakerjaan. (2016). *Peraturan Menteri Ketenagakerjaan Nomor 9 Tahun 2016 tentang Keselamatan dan Kesehatan Kerja dalam Pekerjaan pada Ketinggian* (Berita Negara Republik Indonesia Tahun 2016 Nomor 386). https://peraturan.go.id/files/bn386-2016.pdf',
      'Kementerian Ketenagakerjaan. (2017). *Keputusan Menteri Ketenagakerjaan Nomor 214 Tahun 2017 tentang Penetapan Standar Kompetensi Kerja Nasional Indonesia Kategori Konstruksi Golongan Pokok Konstruksi Khusus Bidang Operasi Scaffolding* [Tidak berlaku]. JDIH Kemnaker. https://jdih.kemnaker.go.id/peraturan/detail/2892/keputusan-menteri-nomor-214-tahun-2017',
      'Kementerian Ketenagakerjaan. (2022). *Keputusan Menteri Ketenagakerjaan Nomor 46 Tahun 2022 tentang Penetapan Standar Kompetensi Kerja Nasional Indonesia Kategori Konstruksi Golongan Pokok Konstruksi Khusus Bidang Operasi Scaffolding*. JDIH Kemnaker. https://jdih.kemnaker.go.id/peraturan/detail/2235/keputusan-menteri-ketenagakerjaan-nomor-46-tahun-2022',
      'Lembaga Pengembangan Jasa Konstruksi. (2025). *Surat Edaran Ketua LPJK Nomor 03/SE/LPJK/2025 tentang Perubahan atas Surat Edaran Ketua LPJK Nomor 01/SE/LPJK/2025 tentang Pedoman Pemberian Rekomendasi Lisensi Lembaga Sertifikasi Profesi* [Lampiran XVII: skema sertifikasi dan jenjang jabatan kerja]. Kementerian Pekerjaan Umum. https://lisensijakon.pu.go.id/panduan/03_SE.LPJK.2025_Perubahan%20atas%20SE%2001%20thn%202025%20tentang%20Pedoman%20Pemberian%20Rekomendasi%20Lisensi%20LSP.pdf',
      'Occupational Safety and Health Administration. (t.t.-c). *29 CFR 1926.454 – Training requirements* (Safety and Health Regulations for Construction, Subpart L – Scaffolds). U.S. Department of Labor. https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.454',
      'Republik Indonesia. (2018). *Peraturan Pemerintah Nomor 10 Tahun 2018 tentang Badan Nasional Sertifikasi Profesi* (Lembaran Negara Republik Indonesia Tahun 2018 Nomor 32). Database Peraturan JDIH BPK. https://peraturan.bpk.go.id/Details/72812/pp-no-10-tahun-2018',
      'United Kingdom. (2005). *The Work at Height Regulations 2005* (SI 2005/735), Schedule 3. legislation.gov.uk. https://www.legislation.gov.uk/uksi/2005/735/schedule/3'
    ],
    gambar: 'assets/img/stair-tower.webp',
    penulis: 'Redaksi PPAPI',
    sorot: false
  },
  {
    id: 'perancah-sistem-vs-pipa-dan-klem',
    judul: 'Perancah Sistem (Ringlock, Cuplock) versus Pipa dan Klem: Dasar Pemilihan, Keunggulan, dan Risiko',
    kategori: 'Edukasi',
    tanggal: '2026-09-09',
    ringkasan: 'Perancah sistem modular dan perancah pipa dan klem memiliki standar, logika desain, dan kebutuhan kompetensi yang berbeda. Pahami perbedaannya sebelum memilih untuk proyek Anda.',
    isi: [
      'Di lapangan, dua keluarga perancah paling sering dijumpai: perancah sistem modular dengan simpul prefabrikasi (ringlock, cuplock, dan sejenisnya) serta perancah pipa dan klem (tube and coupler) yang dirakit dari pipa lepas dan klem. Keduanya aman bila direncanakan, dipasang, dan diperiksa dengan benar — tetapi jalan menuju aman itu berbeda. Artikel ini membahas dasar pemilihannya.',
      '## Dua standar, dua logika',
      'Perancah sistem untuk fasad diatur oleh BS EN 12810-1:2003 yang menetapkan persyaratan kinerja serta persyaratan umum desain struktural dan penilaian sistem perancah fasad prefabrikasi yang diikat ke fasad, mencakup tiang baja atau paduan aluminium, dan mendefinisikan konfigurasi sistem baku untuk desain strukturalnya (British Standards Institution, 2004b). Pada sistem semacam ini, kapasitas simpul dan komponen ditentukan oleh pabrikan melalui pengujian dan perhitungan, sehingga pengguna bergantung pada petunjuk pabrikan.',
      'Perancah pipa dan klem merujuk pada BS EN 12811-1:2003 untuk persyaratan kinerja dan desain umum (British Standards Institution, 2004a) dan pada BS EN 74-1 untuk klem; edisi BS EN 74-1:2022/A1 diterbitkan 1 Agustus 2024 dan berstatus berlaku (British Standards Institution, 2024). Karena setiap sambungan dibuat di lapangan, kinerja struktur bergantung pada mutu klem, pengencangan, dan pola pengaku yang dipasang pemasang. Di Inggris, konfigurasi pipa dan klem yang umum dibakukan melalui lembar kepatuhan TG20 yang telah didesain menurut BS EN 12811; di luar itu diperlukan desain khusus (National Access & Scaffolding Confederation, 2024).',
      '## Keunggulan perancah sistem',
      '- Simpul prefabrikasi mengurangi variabel pemasangan: jarak tiang, ketinggian ledger, dan posisi pengaku mengikuti modul pabrikan.',
      '- Kapasitas komponen terdokumentasi oleh pabrikan sehingga perencanaan konfigurasi baku lebih cepat.',
      '- Lebih sedikit komponen lepas yang harus dikencangkan dan diperiksa satu per satu.',
      'Syaratnya tegas: kode praktik ILO menyatakan petunjuk pabrikan atau pemasok harus dipatuhi secara ketat, perancah prefabrikasi harus memiliki pengaturan pengaku yang memadai, dan rangka dari jenis berbeda tidak boleh dicampur dalam satu perancah kecuali diizinkan pabrikan (International Labour Organization, 2022, butir 10.6). HSE menegaskan peralatan kerja seperti perancah perlu dirakit sesuai petunjuk pabrikan dan pedoman industri (Health and Safety Executive, 2014).',
      '## Keunggulan perancah pipa dan klem',
      '- Fleksibel mengikuti geometri yang rumit: fasad tidak beraturan, struktur industri, tangki, dan area dengan banyak halangan.',
      '- Komponen universal yang dapat dipadukan untuk struktur khusus seperti penyangga, kantilever, dan perancah gantung — selalu dengan desain.',
      '- Memungkinkan perbaikan lokal tanpa membongkar modul.',
      'Risikonya terletak pada ketergantungan terhadap keterampilan. OSHA mensyaratkan klem terbuat dari logam struktural seperti baja tempa, besi mampu tempa, atau aluminium kelas struktural dan melarang besi cor kelabu; pengaku melintang berbentuk X dipasang di ujung perancah dan sekurang-kurangnya setiap set tiang ketiga, dan perancah pipa dan klem di atas 125 kaki harus dirancang insinyur profesional terdaftar (Occupational Safety and Health Administration, t.t.-b, §1926.452(b)). Untuk perancah rangka fabrikasi, rangka harus diikat, disambung vertikal, dan dikunci terhadap gaya angkat (§1926.452(c)). Skema CISRS di Inggris bahkan membedakan kartu kompetensi: pemegang kartu Scaffolder (System) tidak dianggap kompeten memasang, mengubah, atau membongkar struktur pipa dan klem (Construction Industry Scaffolders Record Scheme, t.t.-b).',
      '## Kesamaan yang tidak boleh dilupakan',
      'Apa pun jenisnya, perancah harus diikat ke struktur terdekat, berdiri di atas pelat dasar dengan tumpuan yang mampu menahan beban rencana, dilengkapi pagar pengaman, papan kaki, dan papan lantai yang memadai, serta dipasang oleh personel kompeten dan bersertifikat (Kementerian Pekerjaan Umum dan Perumahan Rakyat, 2022). Standar Eropa tidak mewajibkan pabrikan, dan perancah yang memenuhi maupun tidak memenuhi standar sama-sama beredar karena perbedaan harga (Rubio-Romero et al., 2013); karena itu, verifikasi sertifikat produk dan mutu komponen tetap menjadi tugas pengguna.',
      '## Panduan pemilihan',
      '- Fasad teratur dan bentang panjang: perancah sistem cenderung lebih cepat dan konsisten.',
      '- Geometri rumit, struktur industri, atau konfigurasi khusus: pipa dan klem dengan desain oleh perancang kompeten.',
      '- Jangan mencampur sistem dari pabrikan berbeda atau mencampur modul sistem dengan pipa dan klem tanpa desain dan persetujuan pabrikan.',
      '- Sesuaikan kompetensi tim dengan jenis perancah; pelatihan untuk satu jenis tidak otomatis berlaku untuk jenis lain.',
      '## Daftar Pustaka',
      'British Standards Institution. (2004a). *BS EN 12811-1:2003 Temporary works equipment – Scaffolds – Part 1: Performance requirements and general design*. BSI Knowledge. https://knowledge.bsigroup.com/products/temporary-works-equipment-scaffolds-performance-requirements-and-general-design',
      'British Standards Institution. (2004b). *BS EN 12810-1:2003 Façade scaffolds made of prefabricated components – Part 1: Product specifications*. BSI Knowledge. https://knowledge.bsigroup.com/products/facade-scaffolds-made-of-prefabricated-components-product-specifications',
      'British Standards Institution. (2024). *BS EN 74-1:2022/A1 Couplers, spigot pins and baseplates for use in falsework and scaffolds – Part 1: Couplers for tubes – Requirements and test procedures*. BSI Knowledge. https://knowledge.bsigroup.com/products/bs-en-74-1-2022-a1-couplers-spigot-pins-and-baseplates-for-use-in-falsework-and-scaffolds-part-1-couplers-for-tubes-requirements-and-test-procedures',
      'Construction Industry Scaffolders Record Scheme. (t.t.-b). *CISRS Scaffolder (System) card*. https://cisrs.org.uk/training/cisrs-cards/scaffolder-system.html',
      'Health and Safety Executive. (2014). *Working at height: A brief guide* (INDG401 rev2). https://www.hse.gov.uk/pubns/indg401.pdf',
      'International Labour Organization. (2022). *Safety and health in construction: ILO code of practice* (Rev. ed.). https://www.ilo.org/resource/other/safety-and-health-construction-revised-edition',
      'Kementerian Pekerjaan Umum dan Perumahan Rakyat. (2022). *Surat Edaran Menteri Pekerjaan Umum dan Perumahan Rakyat Nomor 10/SE/M/2022 tentang Panduan Operasional Tertib Penyelenggaraan Keselamatan Konstruksi di Kementerian Pekerjaan Umum dan Perumahan Rakyat*. JDIH PUPR. https://jdih.pu.go.id/internal/assets/assets/produk/SEMenteriPUPR/2022/05/2022SEMenteriPUPR10.pdf',
      'National Access & Scaffolding Confederation. (2024). *TG20 Operational Guide* [Presentasi, Rev 000, 29 Agustus 2024]. Sell2Wales. https://www.sell2wales.gov.wales/Assets/NoticeBuilder_FileDownload.aspx?id=346979',
      'Occupational Safety and Health Administration. (t.t.-b). *29 CFR 1926.452 – Additional requirements applicable to specific types of scaffolds* (Safety and Health Regulations for Construction, Subpart L – Scaffolds). U.S. Department of Labor. https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.452',
      'Rubio-Romero, J. C., Rubio Gámez, M. C., & Carrillo-Castrillo, J. A. (2013). Analysis of the safety conditions of scaffolding on construction sites. *Safety Science, 55*, 160–164. https://doi.org/10.1016/j.ssci.2013.01.006'
    ],
    gambar: 'assets/img/ringlock-pattern.webp',
    penulis: 'Redaksi PPAPI',
    sorot: false
  },
  {
    id: 'pengelolaan-risiko-bekerja-di-ketinggian-hierarki-pengendalian',
    judul: 'Pengelolaan Risiko Bekerja di Ketinggian: Hierarki Pengendalian, Proteksi Kolektif, dan Rencana Penyelamatan',
    kategori: 'Edukasi',
    tanggal: '2026-09-02',
    ringkasan: 'Hierarki pengendalian menempatkan APD sebagai pilihan terakhir. Permenaker 9/2016 dan regulasi internasional menuntut urutan yang sama: hindari, cegah, minimalkan — dan siapkan penyelamatan.',
    isi: [
      'Perancah pada hakikatnya adalah sarana pengendalian risiko jatuh: ia menyediakan lantai kerja yang aman agar pekerja tidak bergantung pada tali pengaman semata. Namun perancah sendiri menghadirkan risiko saat dipasang, diubah, dan dibongkar. Artikel ini menata ulang pengelolaan risiko bekerja di ketinggian berdasarkan hierarki pengendalian dan menyorot satu bagian yang sering terlupakan: rencana penyelamatan.',
      '## Hierarki pengendalian',
      'NIOSH mengurutkan lima tingkat pengendalian bahaya: eliminasi, substitusi, pengendalian rekayasa, pengendalian administratif, dan alat pelindung diri (APD). Eliminasi, substitusi, dan rekayasa dipandang lebih efektif karena mengendalikan paparan tanpa banyak bergantung pada tindakan manusia, sedangkan pengendalian administratif dan APD menuntut upaya terus-menerus dari pekerja dan penyelia; pemberi kerja tidak seharusnya mengandalkan APD semata bila pengendalian lain yang efektif tersedia (National Institute for Occupational Safety and Health, 2024). Kode praktik ILO 2022 pun meminta risiko ditangani sesuai hierarki pengendalian (International Labour Organization, 2022).',
      '## Urutan yang diwajibkan regulasi',
      'Permenaker 9/2016 menerjemahkan hierarki itu ke dalam kewajiban berjenjang. Pengusaha dan/atau pengurus wajib melaksanakan penilaian risiko dan memastikan bekerja pada ketinggian hanya dilakukan jika pekerjaan tidak dapat dilakukan di lantai dasar; bila tetap dilakukan di ketinggian, mereka wajib memastikan pekerjaan dapat dilakukan dengan aman melalui jalur masuk dan keluar yang disediakan, memberikan peralatan keselamatan untuk mencegah jatuh, dan — bila risiko jatuh tidak dapat dihilangkan — menyediakan peralatan untuk meminimalkan jarak jatuh atau mengurangi konsekuensinya serta menerapkan sistem izin kerja pada ketinggian (Kementerian Ketenagakerjaan, 2016, Pasal 5).',
      'Regulasi Inggris menyusun urutan yang serupa: pekerjaan tidak dilakukan di ketinggian bila dapat dilakukan dengan aman dengan cara lain; bila dilakukan di ketinggian, diambil langkah yang memadai untuk mencegah jatuh — mengutamakan tempat kerja yang sudah aman, lalu peralatan pencegah jatuh — dan bila risiko tetap ada, disediakan peralatan untuk meminimalkan jarak dan konsekuensi jatuh beserta pelatihan tambahan (United Kingdom, 2005, regulation 6). HSE menyimpulkan tiga langkah sederhana: hindari, cegah, minimalkan, dan selalu pertimbangkan langkah yang melindungi semua orang (proteksi kolektif) sebelum langkah yang hanya melindungi individu (proteksi personal) (Health and Safety Executive, 2014).',
      '## Kolektif dulu, personal kemudian',
      'Proteksi kolektif adalah peralatan yang tidak memerlukan tindakan pekerja agar efektif, misalnya pagar pengaman permanen atau sementara; proteksi personal memerlukan tindakan individu, misalnya mengenakan sabuk pengaman dan mengaitkannya ke angkur yang sesuai (Health and Safety Executive, 2014). Pada perancah, proteksi kolektif berarti pagar pengaman ganda, papan kaki, dan platform tertutup penuh; kode praktik ILO menganjurkan pagar atas dan tengah serta papan kaki pada setiap bagian platform yang memungkinkan jatuh, lebar platform tidak kurang dari 600 mm, dan 800 mm bila digunakan menyimpan material (International Labour Organization, 2022, butir 10.3.12–10.3.13). Selama pemasangan, ILO menganjurkan pagar dipasang dari lantai di bawahnya yang sudah terlindung; bila tidak praktis, sistem penahan jatuh personal dikenakan dan dikaitkan dengan aman (butir 10.3.15). SE Menteri PUPR 10/SE/M/2022 mewajibkan sabuk keselamatan saat memasang, mengubah, dan membongkar perancah (Kementerian Pekerjaan Umum dan Perumahan Rakyat, 2022).',
      '## Rencana penyelamatan: bagian yang sering hilang',
      'Pekerja yang tergantung pada tali pengaman setelah jatuh membutuhkan pertolongan cepat. Regulasi Inggris menyatakan perencanaan pekerjaan di ketinggian mencakup perencanaan keadaan darurat dan penyelamatan (United Kingdom, 2005, regulation 4), dan HSE meminta prosedur evakuasi disepakati tanpa bergantung sepenuhnya pada layanan darurat (Health and Safety Executive, 2014). Permenaker 9/2016 memasukkan kesiapsiagaan dan tanggap darurat sebagai bagian wajib prosedur kerja tertulis (Pasal 6) dan memberi kewenangan upaya pertolongan dalam keadaan darurat kepada Tenaga Kerja bangunan tinggi tingkat 2 serta Tenaga Kerja pada ketinggian tingkat 2 dan 3 (Kementerian Ketenagakerjaan, 2016, Pasal 37–38). ILO menganjurkan rencana tanggap darurat memuat tugas penyelamatan dan medis bagi pekerja yang ditunjuk, prosedur menghitung seluruh pekerja, serta latihan berkala (International Labour Organization, 2022, butir 3.6).',
      '## Daftar periksa rencana penyelamatan',
      '- Siapa penyelamat yang kompeten dan berada di lokasi pada setiap giliran kerja?',
      '- Peralatan apa yang tersedia (tali penurun, tandu, akses alternatif) dan di mana disimpan?',
      '- Berapa lama waktu respons yang dapat dicapai, dan bagaimana komunikasi dengan layanan medis?',
      '- Kapan terakhir kali prosedur dilatihkan, dan apa pelajarannya?',
      '## Simpulan',
      'Hierarki pengendalian bukan sekadar teori: ia tertulis dalam Permenaker 9/2016 dan regulasi internasional dengan urutan yang sama. Bagi anggota PPAPI, perancah yang lengkap proteksi kolektifnya adalah pengendalian terbaik; APD dan rencana penyelamatan adalah jaring pengaman terakhir yang harus selalu siap.',
      '## Daftar Pustaka',
      'Health and Safety Executive. (2014). *Working at height: A brief guide* (INDG401 rev2). https://www.hse.gov.uk/pubns/indg401.pdf',
      'International Labour Organization. (2022). *Safety and health in construction: ILO code of practice* (Rev. ed.). https://www.ilo.org/resource/other/safety-and-health-construction-revised-edition',
      'Kementerian Ketenagakerjaan. (2016). *Peraturan Menteri Ketenagakerjaan Nomor 9 Tahun 2016 tentang Keselamatan dan Kesehatan Kerja dalam Pekerjaan pada Ketinggian* (Berita Negara Republik Indonesia Tahun 2016 Nomor 386). https://peraturan.go.id/files/bn386-2016.pdf',
      'Kementerian Pekerjaan Umum dan Perumahan Rakyat. (2022). *Surat Edaran Menteri Pekerjaan Umum dan Perumahan Rakyat Nomor 10/SE/M/2022 tentang Panduan Operasional Tertib Penyelenggaraan Keselamatan Konstruksi di Kementerian Pekerjaan Umum dan Perumahan Rakyat*. JDIH PUPR. https://jdih.pu.go.id/internal/assets/assets/produk/SEMenteriPUPR/2022/05/2022SEMenteriPUPR10.pdf',
      'National Institute for Occupational Safety and Health. (2024). *Hierarchy of controls*. Centers for Disease Control and Prevention. https://www.cdc.gov/niosh/hierarchy-of-controls/about/index.html',
      'United Kingdom. (2005). *The Work at Height Regulations 2005* (SI 2005/735), regulations 4 and 6. legislation.gov.uk. https://www.legislation.gov.uk/uksi/2005/735/regulation/6'
    ],
    gambar: 'assets/img/stage-silhouette.webp',
    penulis: 'Redaksi PPAPI',
    sorot: false
  },
  {
    id: 'peran-asosiasi-profesi-keselamatan-konstruksi',
    judul: 'Peran Asosiasi Profesi dalam Peningkatan Keselamatan Konstruksi: Komunitas Praktik, Standar Internal, dan Code of Practice',
    kategori: 'Organisasi',
    tanggal: '2026-08-19',
    ringkasan: 'Mengapa wadah profesi penting bagi keselamatan perancah: pembelajaran dalam komunitas praktik, panduan praktik baik yang diakui regulator, dan skema kompetensi yang dikelola industri.',
    isi: [
      'PPAPI didirikan dengan keyakinan bahwa keselamatan perancah tidak cukup dijaga oleh regulasi dan pengawasan negara. Di antara peraturan dan praktik di lapangan terdapat ruang yang hanya dapat diisi oleh komunitas profesi: tempat pengalaman dibagikan, standar praktik dirumuskan, dan kompetensi diakui oleh sesama praktisi. Artikel ini meninjau dasar pemikiran dan contoh internasional peran tersebut.',
      '## Komunitas praktik sebagai mesin pembelajaran',
      'Wenger (1998) memandang keterlibatan dalam praktik sosial sebagai proses mendasar tempat kita mengetahui apa yang kita ketahui dan menjadi siapa kita; unit analisisnya adalah komunitas praktik informal yang terbentuk ketika orang-orang menekuni usaha bersama dari waktu ke waktu. Bagi tenaga perancah, pengetahuan tentang urutan pemasangan yang aman, tanda-tanda klem yang aus, atau cara membaca gambar desain sebagian besar diwariskan lewat praktik bersama, bukan hanya lewat kelas. Asosiasi profesi melembagakan komunitas itu agar pembelajarannya melampaui satu proyek atau satu perusahaan.',
      'Kajian tentang budaya keselamatan menunjukkan bahwa konsep ini bersifat multidimensi dan dibentuk oleh nilai, sikap, dan praktik bersama yang berkembang dalam organisasi (Choudhry et al., 2007). Tinjauan bukti yang disusun Lamb (2015) untuk pembangunan konstruksi yang lebih aman menempatkan lembaga profesi keinsinyuran dan serikat pekerja sebagai pendorong pergeseran budaya keselamatan — melalui penyebaran budaya itu kepada anggota dan sumbangan pada standar teknis — meskipun kajian tersebut mengakui belum ada bukti keras bahwa organisasi profesi yang lebih kuat secara langsung menghasilkan konstruksi yang lebih aman, dan simpulannya bertumpu pada pendapat ahli serta pengalaman historis.',
      '## Standar internal dan Code of Practice',
      'Contoh paling jelas datang dari Inggris. National Access & Scaffolding Confederation (NASC), yang menyebut dirinya suara industri perancah sejak 1945 dengan lebih dari 950 anggota, menetapkan standar, mendukung anggota, dan mendorong keselamatan, inovasi, serta kepatuhan (National Access & Scaffolding Confederation, t.t.). Panduan TG20 yang diterbitkannya telah menjadi kode praktik tidak resmi untuk perancah pipa dan klem; lembar kepatuhan TG20 diterima HSE sebagai konfigurasi baku yang diakui secara umum, sehingga memenuhi kewajiban perhitungan dalam Work at Height Regulations 2005 (National Access & Scaffolding Confederation, 2024). Dengan kata lain, dokumen yang disusun asosiasi industri memperoleh kedudukan praktis dalam penegakan regulasi.',
      'Pelajarannya bagi PPAPI: Code of Practice yang baik bukan pengulangan peraturan, melainkan penerjemahan peraturan ke konfigurasi, urutan kerja, dan kriteria pemeriksaan yang dapat langsung dipakai di lapangan, serta diperbarui mengikuti pengalaman anggota dan perubahan standar.',
      '## Skema kompetensi yang dikelola industri',
      'HSE menyatakan bahwa ketika diperlukan tingkat kompetensi yang lebih teknis — misalnya menyusun rencana perakitan perancah yang rumit — skema pelatihan dan sertifikasi yang disusun asosiasi dagang dan industri merupakan salah satu cara menunjukkan kompetensi (Health and Safety Executive, 2014). Skema CISRS, yang diutamakan oleh NASC dan lembaga industri lain, telah mencatat lebih dari 70.000 pemegang kartu di Inggris (Construction Industry Scaffolders Record Scheme, t.t.-a). Bukti empiris mendukung arah ini: praktik perancah yang lebih aman berkorelasi kuat dengan keberadaan personel kompeten yang telah mengikuti pelatihan keselamatan perancah (Halperin & McCann, 2004).',
      'Di Indonesia, sertifikasi kompetensi dilaksanakan oleh lembaga sertifikasi profesi berlisensi BNSP (Badan Nasional Sertifikasi Profesi, t.t.) dengan acuan SKKNI yang ditetapkan pemerintah (Kementerian Ketenagakerjaan, 2022). Peran asosiasi di sini adalah memastikan standar kompetensi tetap relevan dengan praktik, menyiapkan anggota menghadapi uji kompetensi, dan menjaga agar sertifikat benar-benar mencerminkan kemampuan di lapangan.',
      '## Budaya pencegahan',
      'Kode praktik ILO 2022 mendorong budaya keselamatan dan kesehatan yang bersifat pencegahan serta kerja sama antara pemberi kerja dan pekerja di sepanjang siklus hidup proyek konstruksi (International Labour Organization, 2022). Asosiasi profesi adalah tempat kerja sama itu dapat dibangun lintas perusahaan: praktisi, ahli, pelaku usaha, dan regulator bertemu tanpa sekat kontrak.',
      '## Agenda PPAPI',
      '- Membangun komunitas praktik: forum berbagi pengalaman, pembahasan insiden tanpa menyalahkan, dan dokumentasi pelajaran.',
      '- Menyusun standar internal dan Code of Practice pemasangan serta inspeksi perancah yang selaras dengan regulasi nasional dan standar internasional.',
      '- Mendampingi anggota menuju sertifikasi dan menjaga mutu kompetensi melalui pencatatan keanggotaan dan verifikasi yang transparan.',
      'Langkah-langkah ini sederhana, tetapi di negara-negara dengan rekam jejak keselamatan perancah yang baik, justru dari sinilah perubahan dimulai.',
      '## Daftar Pustaka',
      'Badan Nasional Sertifikasi Profesi. (t.t.). *BNSP – Badan Nasional Sertifikasi Profesi*. https://bnsp.go.id/',
      'Choudhry, R. M., Fang, D., & Mohamed, S. (2007). The nature of safety culture: A survey of the state-of-the-art. *Safety Science, 45*(10), 993–1012. https://doi.org/10.1016/j.ssci.2006.09.003',
      'Construction Industry Scaffolders Record Scheme. (t.t.-a). *CISRS: Scaffold training, recognised across the industry*. https://cisrs.org.uk/',
      'Halperin, K. M., & McCann, M. (2004). An evaluation of scaffold safety at construction sites. *Journal of Safety Research, 35*(2), 141–150. https://doi.org/10.1016/j.jsr.2003.11.004',
      'Health and Safety Executive. (2014). *Working at height: A brief guide* (INDG401 rev2). https://www.hse.gov.uk/pubns/indg401.pdf',
      'International Labour Organization. (2022). *Safety and health in construction: ILO code of practice* (Rev. ed.). https://www.ilo.org/resource/other/safety-and-health-construction-revised-edition',
      'Kementerian Ketenagakerjaan. (2022). *Keputusan Menteri Ketenagakerjaan Nomor 46 Tahun 2022 tentang Penetapan Standar Kompetensi Kerja Nasional Indonesia Kategori Konstruksi Golongan Pokok Konstruksi Khusus Bidang Operasi Scaffolding*. JDIH Kemnaker. https://jdih.kemnaker.go.id/peraturan/detail/2235/keputusan-menteri-ketenagakerjaan-nomor-46-tahun-2022',
      'Lamb, A. (2015). *Engineering institutions & safer construction: The link between them: An overview of evidence*. Evidence on Demand. https://doi.org/10.12774/eod_hd.october2015.lamba',
      'National Access & Scaffolding Confederation. (t.t.). *The voice of scaffolding since 1945*. https://nasc.org.uk/',
      'National Access & Scaffolding Confederation. (2024). *TG20 Operational Guide* [Presentasi, Rev 000, 29 Agustus 2024]. Sell2Wales. https://www.sell2wales.gov.wales/Assets/NoticeBuilder_FileDownload.aspx?id=346979',
      'Wenger, E. (1998). *Communities of practice: Learning, meaning, and identity*. Cambridge University Press.'
    ],
    gambar: 'assets/img/tower-heritage.webp',
    penulis: 'Redaksi PPAPI',
    sorot: false
  },
  {
    id: 'perawatan-dan-pemeriksaan-material-perancah',
    judul: 'Perawatan dan Pemeriksaan Material Perancah: Pipa, Klem, dan Papan',
    kategori: 'Edukasi',
    tanggal: '2026-07-29',
    ringkasan: 'Keandalan perancah dimulai dari gudang: standar mutu pipa dan klem, kriteria penolakan komponen rusak, penyimpanan yang benar, dan pemeriksaan sebelum setiap pemasangan.',
    isi: [
      'Struktur perancah hanya sekuat komponen terlemahnya. Pipa yang penyok, klem yang ulirnya rusak, atau papan yang lapuk tidak akan terlihat pada gambar desain, tetapi menentukan apakah perhitungan perancang berlaku di lapangan. Artikel ini merangkum standar mutu material perancah dan praktik perawatan serta pemeriksaannya.',
      '## Standar mutu material',
      'Untuk pipa baja perancah, Indonesia memiliki SNI 8987:2021 Pipa baja untuk perancah yang ditetapkan Badan Standardisasi Nasional melalui SK Kepala BSN Nomor 484/KEP/BSN/11/2021 pada 3 November 2021 (Badan Standardisasi Nasional, 2021). Di tingkat Eropa, BS EN 39:2001 mengatur syarat teknis penyerahan pipa baja lepas untuk perancah pipa dan klem; perlu dicatat bahwa BSI mencatat standar ini ditarik pada 21 Mei 2026, sehingga pengguna yang merujuk standar Eropa perlu memeriksa penggantinya (British Standards Institution, 2001). Untuk klem, BS EN 74-1:2022/A1 yang diterbitkan 1 Agustus 2024 menetapkan persyaratan dan prosedur pengujian klem untuk pipa, termasuk kapasitas beban serta uji tarik dan uji lentur (British Standards Institution, 2024).',
      'Regulasi Amerika Serikat menambahkan syarat bahan: klem harus terbuat dari logam struktural seperti baja tempa, besi mampu tempa, atau aluminium kelas struktural, dan penggunaan besi cor kelabu dilarang (Occupational Safety and Health Administration, t.t.-b, §1926.452(b)(9)). Kode praktik ILO menganjurkan material perancah yang cukup, sesuai, dan sehat, serta selaras dengan standar mutu dalam peraturan nasional; kayu dan bambu harus berserat lurus dan bebas cacat yang memengaruhi kekuatan, tali yang rusak oleh asam atau bahan korosif tidak boleh dipakai, dan tangga, papan, serta planka tidak boleh dicat agar cacat dan keterangan kapasitas tetap terlihat (International Labour Organization, 2022, butir 10.2).',
      '## Pemeriksaan sebelum dan selama pemakaian',
      'OSHA mewajibkan perancah dan komponennya diperiksa dari cacat yang terlihat oleh personel kompeten sebelum setiap giliran kerja dan setelah kejadian yang dapat memengaruhi integritas struktur (Occupational Safety and Health Administration, t.t.-a, §1926.451(f)(3)). Dalam pemeriksaan berkala, ILO meminta personel kompeten memastikan material yang digunakan sehat dan cukup kuat, selain konstruksi yang stabil dan pengaman yang terpasang (International Labour Organization, 2022, butir 10.4.2). HSE mengingatkan bahwa peralatan yang terpapar kondisi yang dapat menyebabkan kemunduran harus diperiksa pada interval yang sesuai dengan lingkungan dan penggunaannya (Health and Safety Executive, 2014).',
      '## Kriteria praktis penolakan komponen',
      '- Pipa: bengkok yang terlihat saat digulirkan di permukaan rata, penyok, korosi bersisik yang mengurangi tebal dinding, ujung tidak rata atau retak, dan pipa yang pernah terbakar atau dilas.',
      '- Klem: ulir baut atau mur rusak, engsel atau pin longgar, badan klem retak atau terdeformasi, dan klem yang tidak dapat dikencangkan hingga torsi yang disyaratkan.',
      '- Papan dan planka: retak memanjang, lapuk, bekas terbakar, ujung pecah tanpa pengikat ujung, dan papan yang dicat sehingga cacatnya tersembunyi.',
      '- Pelat dasar, pengikat, dan tangga: deformasi, korosi parah, atau komponen yang tidak sesuai dengan sistem yang dipakai.',
      'Komponen yang ditolak harus dipisahkan, ditandai, dan dikeluarkan dari sirkulasi; perbaikan hanya dilakukan oleh pihak yang kompeten dan tidak sekadar menutupi kerusakan.',
      '## Penyimpanan dan pengangkutan',
      'SE Menteri PUPR 10/SE/M/2022 mensyaratkan seluruh material perancah disimpan di tempat yang disetujui dan dinyatakan sesuai oleh personel berkompeten, papan dilindungi dari terangkat angin, dan tali hanya dipakai untuk mengangkat perkakas dan menaikkan peralatan perancah (Kementerian Pekerjaan Umum dan Perumahan Rakyat, 2022). ILO menambahkan bahwa material perancah tidak boleh dilemparkan dari perancah atau dari ketinggian (International Labour Organization, 2022, butir 10.3.10). Dalam praktik, pipa disimpan di rak bertingkat sesuai panjang, klem dalam keranjang tertutup setelah dibersihkan dan diberi pelumas ringan, dan papan ditumpuk rata di tempat kering dengan sirkulasi udara.',
      '## Implikasi bagi anggota',
      'Perusahaan penyedia perancah sebaiknya memiliki prosedur penerimaan, pemeriksaan berkala, dan penolakan material yang terdokumentasi, serta menyimpan sertifikat produk pipa dan klem dari pabrikan. Bagi pemasang dan pemeriksa, memeriksa material di gudang adalah pemeriksaan pertama sebelum pemeriksaan di lapangan — dan sering kali yang paling murah.',
      '## Daftar Pustaka',
      'Badan Standardisasi Nasional. (2021). *SNI 8987:2021 Pipa baja untuk perancah* (SK Kepala BSN Nomor 484/KEP/BSN/11/2021). Pesta BSN. https://pesta.bsn.go.id/produk/detail/13541-sni89872021',
      'British Standards Institution. (2001). *BS EN 39:2001 Loose steel tubes for tube and coupler scaffolds – Technical delivery conditions* [Ditarik 21 Mei 2026]. BSI Knowledge. https://knowledge.bsigroup.com/products/loose-steel-tubes-for-tube-and-coupler-scaffolds-technical-delivery-conditions',
      'British Standards Institution. (2024). *BS EN 74-1:2022/A1 Couplers, spigot pins and baseplates for use in falsework and scaffolds – Part 1: Couplers for tubes – Requirements and test procedures*. BSI Knowledge. https://knowledge.bsigroup.com/products/bs-en-74-1-2022-a1-couplers-spigot-pins-and-baseplates-for-use-in-falsework-and-scaffolds-part-1-couplers-for-tubes-requirements-and-test-procedures',
      'Health and Safety Executive. (2014). *Working at height: A brief guide* (INDG401 rev2). https://www.hse.gov.uk/pubns/indg401.pdf',
      'International Labour Organization. (2022). *Safety and health in construction: ILO code of practice* (Rev. ed.). https://www.ilo.org/resource/other/safety-and-health-construction-revised-edition',
      'Kementerian Pekerjaan Umum dan Perumahan Rakyat. (2022). *Surat Edaran Menteri Pekerjaan Umum dan Perumahan Rakyat Nomor 10/SE/M/2022 tentang Panduan Operasional Tertib Penyelenggaraan Keselamatan Konstruksi di Kementerian Pekerjaan Umum dan Perumahan Rakyat*. JDIH PUPR. https://jdih.pu.go.id/internal/assets/assets/produk/SEMenteriPUPR/2022/05/2022SEMenteriPUPR10.pdf',
      'Occupational Safety and Health Administration. (t.t.-a). *29 CFR 1926.451 – General requirements* (Safety and Health Regulations for Construction, Subpart L – Scaffolds). U.S. Department of Labor. https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.451',
      'Occupational Safety and Health Administration. (t.t.-b). *29 CFR 1926.452 – Additional requirements applicable to specific types of scaffolds* (Safety and Health Regulations for Construction, Subpart L – Scaffolds). U.S. Department of Labor. https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926.452'
    ],
    gambar: 'assets/img/facade-bw.webp',
    penulis: 'Redaksi PPAPI',
    sorot: false
  }
];

/* Belum ada pengumuman resmi. Format butir:
   { id: 'kode-unik', judul: 'Judul singkat', isi: 'Satu–dua kalimat.', tanggal: '2026-11-01', penting: false } */
PPAPI_DATA.pengumuman = [];
