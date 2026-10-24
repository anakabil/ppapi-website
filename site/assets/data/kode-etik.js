/* ==========================================================================
   KODE ETIK PPAPI  (assets/data/kode-etik.js)
   --------------------------------------------------------------------------
   Isi halaman kode-etik.html (dirender oleh assets/js/pages/anggaran-dasar.js,
   format bab → pasal → ayat yang sama dengan anggaran-dasar.js).

   DASAR & RUJUKAN
   • Dasar organisasi: Anggaran Dasar PPAPI (Akta Nomor 01 Tahun 2022) Pasal 3
     (maksud dan tujuan), Pasal 9 angka 3 (ketetapan perkumpulan), Pasal 11–12
     (kewajiban dan hak anggota), Pasal 18–20 (keputusan Rapat Pengurus), dan
     Pasal 33 (penyelesaian sengketa difasilitasi Pengawas).
   • Rujukan nasional didahulukan (UU 1/1970, Permenakertrans PER.01/MEN/1980,
     Permenaker 9/2016, UU 2/2017, Permen PUPR 10/2021, UU 11/2014, UU 20/2001,
     UU 27/2022, Kepmenaker 46/2022, Kode Etik Insinyur PII), dilengkapi
     rujukan internasional (ILO, 2022; BCSP, 2022). Lihat "pustaka" di bawah.
   • Disusun 24 Oktober 2026 atas permintaan Sekretaris Umum karena perkumpulan
     belum memiliki kode etik.

   PENETAPAN
   • Isi "penetapan.nomor" dan "penetapan.tanggal" (YYYY-MM-DD) setelah
     keputusan Pengurus ditandatangani; keduanya tampil otomatis di halaman.
     Tanggal = tanggal keputusan yang sebenarnya (keputusan klien 2026-10-24,
     opsi A), BUKAN tanggal pendirian: dokumen mengutip rujukan terbitan
     setelah 1 Juli 2022 dan PPAPI baru berbadan hukum 15 Agustus 2022.
     Tanggal pendirian cukup disebut di Mukadimah.
   • Perubahan isi ditetapkan dengan keputusan Pengurus (Pasal 14), lalu
     perbarui "versi" dan "diperbarui".
   ========================================================================== */
window.PPAPI_DATA = window.PPAPI_DATA || {};

PPAPI_DATA.kodeEtik = {
  judul: 'Kode Etik',
  versi: '1.0',
  diperbarui: '2026-10-24',
  penetapan: { nomor: '', tanggal: '' },

  pembukaan: [
    'Perancah adalah bangunan sementara yang menyangga tenaga kerja, bahan, dan alat pada pekerjaan konstruksi bangunan, termasuk pekerjaan pemeliharaan dan pembongkaran. Kegagalan perancah dan jatuh dari ketinggian berakibat langsung pada keselamatan jiwa pekerja dan masyarakat di sekitarnya, sehingga setiap keputusan teknis pada perancah membawa tanggung jawab moral dan hukum.',
    'Perkumpulan Praktisi dan Ahli Perancah Indonesia (PPAPI) didirikan untuk membina keahlian anggota dan membuat standardisasi teknis pelaksanaan perancah aman di Indonesia. Tujuan tersebut hanya dapat tercapai apabila setiap anggota menjalankan profesinya secara kompeten, jujur, dan bertanggung jawab.',
    'Atas dasar itu, dengan berpedoman pada Pancasila dan Undang-Undang Dasar 1945 sebagai asas perkumpulan, PPAPI menetapkan Kode Etik ini sebagai pedoman sikap dan perilaku bagi seluruh anggota, pengurus, dan pengawas. Kode Etik ini melengkapi Anggaran Dasar sebagaimana termuat dalam Akta Pendirian Nomor 01 tanggal 1 Juli 2022.'
  ],

  bab: [
    {
      label: 'Bab I',
      judul: 'Ketentuan Umum',
      pasal: [
        { no: 1, pembuka: 'Dalam Kode Etik ini yang dimaksud dengan:', ayat: [
          'Perkumpulan adalah Perkumpulan Praktisi dan Ahli Perancah Indonesia (PPAPI) sebagaimana dimaksud dalam Akta Pendirian Nomor 01 tanggal 1 Juli 2022.',
          'Anggota adalah perorangan yang tercatat sebagai anggota Perkumpulan, termasuk anggota yang menjabat sebagai pengurus atau pengawas.',
          'Pekerjaan perancah adalah perencanaan, perhitungan, pemasangan, perubahan, pemeriksaan, penggunaan, pemeliharaan, dan pembongkaran perancah, serta pelatihan dan penilaian kompetensi yang berkaitan dengannya.',
          'Pemberi kerja adalah orang atau badan yang mempekerjakan atau menggunakan jasa anggota.',
          'Benturan kepentingan adalah keadaan ketika kepentingan pribadi, keluarga, atau kelompok anggota dapat memengaruhi objektivitas keputusan profesionalnya.',
          'Majelis Kehormatan Etik adalah tim yang dibentuk Pengurus untuk memeriksa dugaan pelanggaran Kode Etik.'
        ] },
        { no: 2, ayat: [
          'Kode Etik ini menjadi pedoman sikap dan perilaku anggota dalam menjalankan pekerjaan perancah dan dalam kehidupan berorganisasi.',
          'Kode Etik ini berlaku bagi seluruh anggota, di dalam maupun di luar kegiatan Perkumpulan, sepanjang berkaitan dengan profesi dan nama baik Perkumpulan.',
          'Kode Etik ini tidak menggantikan peraturan perundang-undangan. Apabila terdapat perbedaan, anggota wajib mematuhi peraturan perundang-undangan dan memilih ketentuan yang memberikan perlindungan keselamatan lebih tinggi.'
        ] }
      ]
    },
    {
      label: 'Bab II',
      judul: 'Prinsip Dasar',
      pasal: [
        { no: 3, pembuka: 'Anggota menjalankan profesinya berdasarkan prinsip:', ayat: [
          'keselamatan di atas segalanya, yaitu menempatkan keselamatan dan kesehatan manusia di atas pertimbangan biaya, waktu, dan kepentingan lainnya;',
          'kompetensi, yaitu hanya mengerjakan pekerjaan yang sesuai dengan keahlian dan kewenangannya;',
          'integritas, yaitu jujur, dapat dipercaya, dan menolak segala bentuk penyimpangan;',
          'objektivitas, yaitu menilai dan memutuskan berdasarkan fakta, data, dan kaidah teknis;',
          'tanggung jawab, yaitu bertanggung jawab atas hasil kerja dan akibat yang ditimbulkannya;',
          'saling menghormati, yaitu menghargai setiap orang tanpa membedakan suku, agama, ras, antargolongan, jenis kelamin, dan status sosial;',
          'kesejawatan, yaitu saling membantu dan berbagi pengetahuan untuk kemajuan profesi.'
        ] }
      ]
    },
    {
      label: 'Bab III',
      judul: 'Kewajiban terhadap Keselamatan Pekerja dan Masyarakat',
      pasal: [
        { no: 4, ayat: [
          'Anggota wajib memastikan perancah yang direncanakan, dipasang, atau diperiksanya memenuhi peraturan perundang-undangan, standar teknis, dan petunjuk pabrikan.',
          'Anggota wajib menghentikan atau menolak melanjutkan pekerjaan perancah yang menurut penilaian profesionalnya mengandung bahaya yang tidak dapat diterima, serta segera memberitahukannya kepada pemberi kerja dan pihak yang berwenang.',
          'Anggota dilarang menyatakan perancah layak pakai, termasuk memasang label layak pakai (scaffold tag hijau), tanpa pemeriksaan langsung yang memadai.',
          'Anggota dilarang mengurangi komponen, mengubah konfigurasi, atau menambah beban perancah melebihi rencana tanpa evaluasi teknis oleh tenaga yang kompeten.',
          'Anggota wajib menggunakan, dan mendorong pekerja untuk menggunakan, alat pelindung diri serta sistem pelindung jatuh sesuai ketentuan.',
          'Anggota wajib melaporkan kecelakaan, kejadian berbahaya, dan kejadian nyaris celaka melalui saluran yang berlaku, serta tidak menyembunyikannya.'
        ] },
        { no: 5, tanpaNomor: true, ayat: [
          'Anggota memperhatikan keselamatan masyarakat di sekitar lokasi kerja, termasuk pengamanan area di bawah dan di sekitar perancah serta jalur pejalan kaki, dan berupaya mengurangi dampak lingkungan dan limbah material.'
        ] }
      ]
    },
    {
      label: 'Bab IV',
      judul: 'Kewajiban terhadap Profesi dan Kompetensi',
      pasal: [
        { no: 6, ayat: [
          'Anggota hanya menerima dan melaksanakan pekerjaan yang sesuai dengan kualifikasi, sertifikat kompetensi, atau lisensi yang masih berlaku.',
          'Anggota wajib memelihara dan meningkatkan kompetensinya melalui pembelajaran berkelanjutan, pelatihan, serta pemutakhiran pengetahuan tentang regulasi dan standar.',
          'Anggota dilarang memalsukan, meminjamkan, meminjam, atau menyalahgunakan sertifikat, lisensi, Kartu Tanda Anggota, atau dokumen kompetensi lainnya.',
          'Anggota wajib menyampaikan kualifikasi dan pengalamannya secara benar dan tidak melebih-lebihkan.',
          'Anggota membimbing pekerja di bawah pengawasannya agar bekerja dengan aman dan memperoleh kompetensi yang dipersyaratkan.'
        ] }
      ]
    },
    {
      label: 'Bab V',
      judul: 'Kewajiban terhadap Pemberi Kerja dan Pengguna Jasa',
      pasal: [
        { no: 7, ayat: [
          'Anggota bekerja secara jujur, cermat, dan profesional untuk kepentingan pemberi kerja sepanjang tidak bertentangan dengan keselamatan dan peraturan perundang-undangan.',
          'Anggota wajib menyusun laporan perencanaan, perhitungan, pemeriksaan, dan inspeksi secara benar, lengkap, dan sesuai dengan temuan.',
          'Anggota wajib mengungkapkan benturan kepentingan yang ada atau mungkin timbul kepada pemberi kerja sebelum menerima atau melanjutkan pekerjaan.',
          'Anggota dilarang meminta, menerima, atau memberikan suap, gratifikasi, atau imbalan dalam bentuk apa pun yang dapat memengaruhi keputusan profesional, khususnya dalam pemeriksaan, inspeksi, dan pernyataan kelayakan perancah.',
          'Anggota wajib menjaga kerahasiaan informasi pemberi kerja yang diperoleh dalam pekerjaan, kecuali pengungkapannya diperlukan untuk mencegah bahaya terhadap keselamatan jiwa atau diwajibkan oleh peraturan perundang-undangan.',
          'Anggota bersaing secara sehat dan tidak menawarkan jasa dengan cara mengurangi persyaratan keselamatan.'
        ] }
      ]
    },
    {
      label: 'Bab VI',
      judul: 'Kewajiban Instruktur, Narasumber, dan Penilai Kompetensi',
      pasal: [
        { no: 8, ayat: [
          'Anggota yang bertugas sebagai instruktur atau narasumber wajib menyampaikan materi yang benar, mutakhir, dan sesuai dengan regulasi serta standar yang berlaku, dengan menyebutkan sumbernya.',
          'Anggota yang terlibat dalam pelatihan atau penilaian kompetensi wajib menilai secara objektif berdasarkan bukti, serta dilarang menjanjikan atau memperjualbelikan kelulusan.',
          'Anggota wajib menghindari penilaian terhadap peserta yang memiliki hubungan keluarga, hubungan kerja langsung, atau kepentingan lain yang dapat memengaruhi objektivitas.',
          'Instruktur wajib mengutamakan keselamatan peserta selama praktik, termasuk praktik pemasangan dan bekerja di ketinggian.'
        ] }
      ]
    },
    {
      label: 'Bab VII',
      judul: 'Kewajiban terhadap Sesama Anggota dan Perkumpulan',
      pasal: [
        { no: 9, ayat: [
          'Anggota menghormati sesama anggota, tidak merendahkan, memfitnah, atau mencemarkan nama baik rekan seprofesi, serta menyampaikan kritik teknis secara santun dan berdasar.',
          'Anggota bersedia berbagi pengetahuan dan pengalaman, termasuk pelajaran dari kecelakaan dan kejadian nyaris celaka, untuk kemajuan profesi.',
          'Anggota menaati Anggaran Dasar, Anggaran Rumah Tangga, dan keputusan Perkumpulan, serta menjaga dan menjunjung tinggi nama baik Perkumpulan.',
          'Anggota dilarang menggunakan nama, logo, Kartu Tanda Anggota, atau atribut PPAPI untuk kepentingan pribadi atau komersial tanpa izin Pengurus, atau dengan cara yang menyesatkan seolah-olah mewakili Perkumpulan.',
          'Pengurus dan pengawas menjalankan amanah secara transparan dan akuntabel serta tidak menggunakan jabatan untuk keuntungan pribadi.'
        ] }
      ]
    },
    {
      label: 'Bab VIII',
      judul: 'Penggunaan Informasi, Data, dan Media Digital',
      pasal: [
        { no: 10, ayat: [
          'Anggota wajib melindungi data pribadi pekerja, peserta pelatihan, dan sesama anggota sesuai dengan peraturan perundang-undangan tentang pelindungan data pribadi.',
          'Anggota bertanggung jawab atas pernyataannya di media sosial dan ruang publik yang berkaitan dengan profesi dan Perkumpulan. Pernyataan atas nama PPAPI hanya disampaikan oleh pihak yang ditunjuk Pengurus.',
          'Hasil aplikasi perencanaan, perhitungan, atau alat bantu digital, termasuk yang disediakan PPAPI, bersifat indikatif dan wajib diverifikasi oleh tenaga yang kompeten sebelum dijadikan dasar keputusan.',
          'Anggota menghormati hak kekayaan intelektual, mencantumkan sumber rujukan, dan tidak menyebarluaskan produk pengetahuan PPAPI yang khusus untuk anggota tanpa izin.'
        ] }
      ]
    },
    {
      label: 'Bab IX',
      judul: 'Pelanggaran, Sanksi, dan Penegakan',
      pasal: [
        { no: 11, ayat: [
          'Pelanggaran Kode Etik adalah setiap perbuatan atau kelalaian anggota yang bertentangan dengan ketentuan Kode Etik ini.',
          { teks: 'Berdasarkan akibat dan unsur kesengajaannya, pelanggaran dikelompokkan menjadi:', butir: [
            'pelanggaran ringan, yaitu pelanggaran yang tidak menimbulkan bahaya atau kerugian dan baru pertama kali dilakukan;',
            'pelanggaran sedang, yaitu pelanggaran yang menimbulkan kerugian bagi pihak lain atau nama baik Perkumpulan, atau pengulangan pelanggaran ringan;',
            'pelanggaran berat, yaitu pelanggaran yang membahayakan keselamatan jiwa, pemalsuan sertifikat atau dokumen, suap atau gratifikasi, atau pengulangan pelanggaran sedang.'
          ] }
        ] },
        { no: 12, ayat: [
          { teks: 'Sanksi atas pelanggaran Kode Etik berupa:', butir: [
            'teguran lisan;',
            'peringatan tertulis;',
            'pembekuan keanggotaan dan Kartu Tanda Anggota paling lama 1 (satu) tahun;',
            'pemberhentian sebagai anggota.'
          ] },
          'Sanksi dijatuhkan secara proporsional dengan mempertimbangkan tingkat pelanggaran, akibat yang ditimbulkan, dan iktikad baik anggota untuk memperbaikinya.',
          'Selama masa pembekuan, status keanggotaan dinonaktifkan sehingga Kartu Tanda Anggota tidak terverifikasi sebagai aktif dan hak anggota tidak dapat digunakan.',
          'Sanksi etik tidak menghapus tanggung jawab hukum anggota menurut peraturan perundang-undangan.'
        ] },
        { no: 13, ayat: [
          'Setiap orang dapat menyampaikan pengaduan dugaan pelanggaran secara tertulis kepada Pengurus, disertai identitas pengadu dan bukti awal. Pengurus menjaga kerahasiaan identitas pengadu.',
          'Pengurus membentuk Majelis Kehormatan Etik yang beranggotakan paling sedikit 3 (tiga) orang yang tidak memiliki benturan kepentingan dengan perkara, untuk memeriksa pengaduan paling lama 30 (tiga puluh) hari kerja dan dapat diperpanjang satu kali.',
          'Anggota yang diadukan berhak mengetahui pokok pengaduan, memberikan keterangan, dan membela diri.',
          'Majelis Kehormatan Etik menyampaikan hasil pemeriksaan dan rekomendasi sanksi kepada Pengurus. Pengurus menetapkan keputusan melalui Rapat Pengurus sesuai Anggaran Dasar.',
          'Anggota yang dijatuhi sanksi dapat mengajukan keberatan tertulis kepada Pengawas paling lama 14 (empat belas) hari sejak keputusan diterima. Pengawas memfasilitasi penyelesaian secara kekeluargaan.',
          'Apabila tidak tercapai penyelesaian secara kekeluargaan, para pihak dapat menempuh jalur hukum sesuai Anggaran Dasar dan peraturan perundang-undangan.'
        ] }
      ]
    },
    {
      label: 'Bab X',
      judul: 'Ketentuan Penutup',
      pasal: [
        { no: 14, ayat: [
          'Kode Etik ini mengikat seluruh anggota sejak ditetapkan. Setiap pemohon menyatakan persetujuannya terhadap Kode Etik ini pada saat mengajukan permohonan keanggotaan.',
          'Kode Etik ini ditinjau sekurang-kurangnya setiap 3 (tiga) tahun, atau lebih awal apabila terdapat perubahan peraturan perundang-undangan yang berkaitan.',
          'Hal-hal yang belum diatur dalam Kode Etik ini ditetapkan oleh Pengurus dengan tidak bertentangan dengan Anggaran Dasar dan Anggaran Rumah Tangga.'
        ] }
      ]
    }
  ],

  ikrar: {
    pembuka: 'Sebagai anggota Perkumpulan Praktisi dan Ahli Perancah Indonesia, saya berjanji:',
    butir: [
      'menempatkan keselamatan dan kesehatan manusia di atas segala kepentingan dalam setiap pekerjaan perancah;',
      'bekerja sesuai dengan kompetensi saya dan terus meningkatkannya;',
      'jujur dalam setiap perencanaan, pemeriksaan, dan laporan, serta menolak suap dan gratifikasi;',
      'menghormati sesama dan menjaga nama baik profesi serta Perkumpulan;',
      'menaati Anggaran Dasar, Anggaran Rumah Tangga, dan Kode Etik PPAPI.'
    ]
  },

  /* Dasar penyusunan dengan sitasi dalam teks (APA 7); setiap entri pustaka dikutip minimal sekali. */
  dasar: [
    'Kode Etik ini disusun sebagai ketetapan perkumpulan sebagaimana dimaksud dalam Pasal 9 Anggaran Dasar, dan diselaraskan dengan kewajiban serta hak anggota pada Pasal 11 dan 12, mekanisme keputusan Pengurus pada Pasal 18 sampai 20, serta penyelesaian sengketa pada Pasal 33 (Perkumpulan Praktisi dan Ahli Perancah Indonesia, 2022).',
    'Kewajiban keselamatan pada Bab III berpijak pada kewajiban memenuhi syarat keselamatan kerja di setiap tempat kerja (Republik Indonesia, 1970), persyaratan perancah pada konstruksi bangunan (Kementerian Tenaga Kerja dan Transmigrasi, 1980), persyaratan bekerja pada ketinggian termasuk sistem pelindung jatuh (Kementerian Ketenagakerjaan, 2016), serta penyelenggaraan keselamatan konstruksi (Republik Indonesia, 2017; Kementerian Pekerjaan Umum dan Perumahan Rakyat, 2021). Kewajiban menghentikan pekerjaan yang membahayakan sejalan dengan kode praktik keselamatan dan kesehatan konstruksi dari Organisasi Perburuhan Internasional (International Labour Organization, 2022).',
    'Kewajiban terkait kompetensi pada Bab IV dan Bab VI mengacu pada standar kompetensi kerja nasional bidang operasi scaffolding (Kementerian Ketenagakerjaan, 2022), serta prinsip bekerja sesuai kompetensi dan pengembangan keprofesian berkelanjutan dalam pengaturan profesi keinsinyuran (Republik Indonesia, 2014; Majelis Kehormatan Insinyur Persatuan Insinyur Indonesia, 2010).',
    'Larangan suap dan gratifikasi pada Bab V mengambil semangat pengaturan gratifikasi dalam undang-undang pemberantasan tindak pidana korupsi (Republik Indonesia, 2001), sedangkan kewajiban pelindungan data pada Bab VIII mengikuti undang-undang pelindungan data pribadi (Republik Indonesia, 2022). Prinsip mendahulukan keselamatan, menyampaikan kualifikasi secara jujur, menghindari benturan kepentingan, dan bersikap tanpa diskriminasi juga dibandingkan dengan kode etik profesi keselamatan internasional (Board of Certified Safety Professionals, 2022).'
  ],

  /* Daftar Pustaka (APA 7). Teks di antara *…* tampil miring. */
  pustaka: [
    'Board of Certified Safety Professionals. (2022). *Code of ethics*. https://bcsp.org/hubfs/8981246/Downloads-PDFs-and-PPTs/BCSPcodeofethics.pdf',
    'International Labour Organization. (2022). *Safety and health in construction: ILO code of practice* (Rev. ed.). https://www.ilo.org/resource/other/safety-and-health-construction-revised-edition',
    'Kementerian Ketenagakerjaan. (2016). *Peraturan Menteri Ketenagakerjaan Nomor 9 Tahun 2016 tentang Keselamatan dan Kesehatan Kerja dalam Pekerjaan pada Ketinggian* (Berita Negara Republik Indonesia Tahun 2016 Nomor 386). https://peraturan.go.id/files/bn386-2016.pdf',
    'Kementerian Ketenagakerjaan. (2022). *Keputusan Menteri Ketenagakerjaan Nomor 46 Tahun 2022 tentang Penetapan Standar Kompetensi Kerja Nasional Indonesia Kategori Konstruksi Golongan Pokok Konstruksi Khusus Bidang Operasi Scaffolding*. JDIH Kemnaker. https://jdih.kemnaker.go.id/peraturan/detail/2235/keputusan-menteri-ketenagakerjaan-nomor-46-tahun-2022',
    'Kementerian Pekerjaan Umum dan Perumahan Rakyat. (2021). *Peraturan Menteri Pekerjaan Umum dan Perumahan Rakyat Nomor 10 Tahun 2021 tentang Pedoman Sistem Manajemen Keselamatan Konstruksi* (Berita Negara Republik Indonesia Tahun 2021 Nomor 286). https://peraturan.bpk.go.id/Details/216875/permen-pupr-no-10-tahun-2021',
    'Kementerian Tenaga Kerja dan Transmigrasi. (1980). *Peraturan Menteri Tenaga Kerja dan Transmigrasi Nomor PER.01/MEN/1980 tentang Keselamatan dan Kesehatan Kerja pada Konstruksi Bangunan*.',
    'Majelis Kehormatan Insinyur Persatuan Insinyur Indonesia. (2010). *Kode etik insinyur Indonesia: Catur Karsa Sapta Dharma dan penjabarannya*. Persatuan Insinyur Indonesia.',
    'Perkumpulan Praktisi dan Ahli Perancah Indonesia. (2022). *Akta Pendirian Perkumpulan Praktisi dan Ahli Perancah Indonesia Nomor 01 tanggal 1 Juli 2022* [Anggaran Dasar; disahkan dengan Keputusan Menteri Hukum dan Hak Asasi Manusia Nomor AHU-0008151.AH.01.07.Tahun 2022].',
    'Republik Indonesia. (1970). *Undang-Undang Nomor 1 Tahun 1970 tentang Keselamatan Kerja*. Database Peraturan JDIH BPK. https://peraturan.bpk.go.id/Details/47614',
    'Republik Indonesia. (2001). *Undang-Undang Nomor 20 Tahun 2001 tentang Perubahan atas Undang-Undang Nomor 31 Tahun 1999 tentang Pemberantasan Tindak Pidana Korupsi* (Lembaran Negara Republik Indonesia Tahun 2001 Nomor 134). Database Peraturan JDIH BPK. https://peraturan.bpk.go.id/Details/44900/uu-no-20-tahun-2001',
    'Republik Indonesia. (2014). *Undang-Undang Nomor 11 Tahun 2014 tentang Keinsinyuran* (Lembaran Negara Republik Indonesia Tahun 2014 Nomor 61). Database Peraturan JDIH BPK. https://peraturan.bpk.go.id/Details/38602/uu-no-11-tahun-2014',
    'Republik Indonesia. (2017). *Undang-Undang Nomor 2 Tahun 2017 tentang Jasa Konstruksi*. Database Peraturan JDIH BPK. https://peraturan.bpk.go.id/Details/37637/uu-no-2-tahun-2017',
    'Republik Indonesia. (2022). *Undang-Undang Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi*. Database Peraturan JDIH BPK. https://peraturan.bpk.go.id/Details/229798'
  ]
};
