/* ==========================================================================
   DATA REGULASI & STANDAR  (assets/data/regulasi.js)
   --------------------------------------------------------------------------
   Pustaka peraturan perundang-undangan dan standar yang berkaitan dengan
   pekerjaan perancah (scaffolding). SELURUH butir di bawah ini telah
   diverifikasi dari sumber resmi per 8 Oktober 2026 (lihat isian "sumber").
   Karena berisi fakta, butir-butir ini TIDAK diberi tanda "contoh".

   CARA MENAMBAH REGULASI BARU
   1. Salin satu blok { … } (dari tanda { sampai }, termasuk koma setelahnya).
   2. Tempel di dalam daftar, lalu ubah isinya:
      id         : kode unik huruf kecil tanpa spasi, contoh 'permenaker-9-2016'
      jenis      : salah satu dari 'Undang-Undang', 'Peraturan Pemerintah',
                   'Peraturan Menteri', 'Keputusan Menteri', 'Surat Edaran',
                   'SNI', 'Standar Internasional'
      nomor      : nomor peraturan (teks)        tahun : angka tahun, contoh 2016
      judul      : judul/tentang                 singkatan : contoh 'UU 1/1970'
      instansi   : lembaga penerbit
      status     : 'Berlaku', 'Berlaku (diubah)', atau 'Dicabut'
      relevansi  : 1–2 kalimat mengapa penting bagi pekerjaan perancah
      tautan     : alamat naskah resmi (JDIH/BPK/BSN) atau '' bila belum ada
      kunci      : true = tampil sebagai "Regulasi Kunci" di dasbor anggota
      sumber     : daftar alamat rujukan yang dipakai untuk memverifikasi
   3. Hanya masukkan regulasi yang sudah Anda periksa pada sumber resmi.
   MENGHAPUS: hapus satu blok { … } beserta komanya.
   MENGUBAH STATUS: ganti isian status, misalnya menjadi 'Dicabut'.
   ========================================================================== */
window.PPAPI_DATA = window.PPAPI_DATA || {};
PPAPI_DATA.regulasi = [
  {
    id: "uu-1-1970",
    jenis: "Undang-Undang",
    nomor: "1",
    tahun: 1970,
    judul: "Keselamatan Kerja",
    singkatan: "UU 1/1970",
    instansi: "Presiden Republik Indonesia",
    status: "Berlaku",
    relevansi: "Landasan hukum utama keselamatan kerja yang mewajibkan pengurus memenuhi syarat-syarat keselamatan di setiap tempat kerja, termasuk proyek konstruksi yang menggunakan perancah. Peraturan K3 konstruksi bangunan dan pekerjaan pada ketinggian diterbitkan sebagai pelaksanaan undang-undang ini.",
    tautan: "https://peraturan.bpk.go.id/Details/47614",
    kunci: true,
    sumber: ["https://peraturan.bpk.go.id/Details/47614", "https://jdih.kemnaker.go.id/peraturan/detail/49/undang-undang-nomor-1-tahun-1970", "https://peraturan.bpk.go.id/Download/252144/Kemnaker%20No.%209%20Tahun%202016.pdf"]
  },
  {
    id: "uu-2-2017",
    jenis: "Undang-Undang",
    nomor: "2",
    tahun: 2017,
    judul: "Jasa Konstruksi",
    singkatan: "UU 2/2017",
    instansi: "Presiden Republik Indonesia",
    status: "Berlaku (diubah)",
    relevansi: "Mewajibkan Pengguna Jasa dan Penyedia Jasa memenuhi Standar Keamanan, Keselamatan, Kesehatan, dan Keberlanjutan (Pasal 59), yang sekurang-kurangnya mencakup standar mutu peralatan serta standar keselamatan dan kesehatan kerja. Ketentuan ini menjadi dasar kewajiban keselamatan konstruksi, termasuk pada pekerjaan perancah; sebagian pasalnya telah diubah melalui UU Cipta Kerja.",
    tautan: "https://peraturan.bpk.go.id/Details/37637/uu-no-2-tahun-2017",
    kunci: true,
    sumber: ["https://peraturan.bpk.go.id/Details/37637/uu-no-2-tahun-2017", "https://www.kemhan.go.id/itjen/wp-content/uploads/2017/08/uu2-2017bt.pdf", "https://api-law.crpg.info/peraturan/uu/2/2017/pasal/59"]
  },
  {
    id: "uu-6-2023",
    jenis: "Undang-Undang",
    nomor: "6",
    tahun: 2023,
    judul: "Penetapan Peraturan Pemerintah Pengganti Undang-Undang Nomor 2 Tahun 2022 tentang Cipta Kerja menjadi Undang-Undang",
    singkatan: "UU 6/2023",
    instansi: "Presiden Republik Indonesia",
    status: "Berlaku (diubah)",
    relevansi: "Mengubah sejumlah ketentuan UU 2/2017 tentang Jasa Konstruksi dalam kerangka penyederhanaan perizinan berusaha, sehingga ketentuan jasa konstruksi yang berlaku saat ini harus dibaca bersama perubahan tersebut.",
    tautan: "https://peraturan.bpk.go.id/Details/246523",
    kunci: false,
    sumber: ["https://peraturan.bpk.go.id/Details/246523", "https://peraturan.bpk.go.id/Details/37637/uu-no-2-tahun-2017", "https://jdih.kemnaker.go.id/peraturan/detail/2302/undang-undang-nomor-6-tahun-2023"]
  },
  {
    id: "uu-27-2022",
    jenis: "Undang-Undang",
    nomor: "27",
    tahun: 2022,
    judul: "Pelindungan Data Pribadi",
    singkatan: "UU 27/2022",
    instansi: "Presiden Republik Indonesia",
    status: "Berlaku",
    relevansi: "Mengatur prinsip dan kewajiban pengendali data dalam memproses data pribadi. Relevan bagi asosiasi yang menghimpun data anggota, sertifikat kompetensi, dan registri tenaga perancah.",
    tautan: "https://peraturan.bpk.go.id/Details/229798",
    kunci: false,
    sumber: ["https://peraturan.bpk.go.id/Details/229798"]
  },
  {
    id: "pp-50-2012",
    jenis: "Peraturan Pemerintah",
    nomor: "50",
    tahun: 2012,
    judul: "Penerapan Sistem Manajemen Keselamatan dan Kesehatan Kerja",
    singkatan: "PP 50/2012",
    instansi: "Pemerintah Republik Indonesia",
    status: "Berlaku",
    relevansi: "Mengatur penerapan Sistem Manajemen K3 (SMK3) sebagai bagian dari sistem manajemen perusahaan. Pengendalian risiko pekerjaan perancah menjadi bagian dari perencanaan, pelaksanaan, dan pemantauan SMK3.",
    tautan: "https://peraturan.bpk.go.id/Details/5263/pp-no-50-tahun-2012",
    kunci: false,
    sumber: ["https://peraturan.bpk.go.id/Details/5263/pp-no-50-tahun-2012"]
  },
  {
    id: "pp-22-2020",
    jenis: "Peraturan Pemerintah",
    nomor: "22",
    tahun: 2020,
    judul: "Peraturan Pelaksanaan Undang-Undang Nomor 2 Tahun 2017 tentang Jasa Konstruksi",
    singkatan: "PP 22/2020",
    instansi: "Pemerintah Republik Indonesia",
    status: "Berlaku (diubah)",
    relevansi: "Peraturan pelaksanaan UU Jasa Konstruksi yang mengatur usaha, penyelenggaraan, dan pengawasan jasa konstruksi. Telah diubah dengan PP 14/2021 yang menjadi dasar pedoman SMKK.",
    tautan: "https://peraturan.bpk.go.id/Details/137561/pp-no-22-tahun-2020",
    kunci: false,
    sumber: ["https://peraturan.bpk.go.id/Details/137561/pp-no-22-tahun-2020", "https://jdih.kemenkoinfra.go.id/id/peraturan-pemerintah-republik-indonesia-no-22-tahun-2020"]
  },
  {
    id: "pp-14-2021",
    jenis: "Peraturan Pemerintah",
    nomor: "14",
    tahun: 2021,
    judul: "Perubahan atas Peraturan Pemerintah Nomor 22 Tahun 2020 tentang Peraturan Pelaksanaan Undang-Undang Nomor 2 Tahun 2017 tentang Jasa Konstruksi",
    singkatan: "PP 14/2021",
    instansi: "Pemerintah Republik Indonesia",
    status: "Berlaku",
    relevansi: "Memuat Pasal 84AK yang menjadi dasar penetapan Pedoman Sistem Manajemen Keselamatan Konstruksi (Permen PUPR 10/2021), sekaligus menyelaraskan perizinan jasa konstruksi dengan sistem OSS.",
    tautan: "https://peraturan.bpk.go.id/Details/161844",
    kunci: false,
    sumber: ["https://peraturan.bpk.go.id/Details/161844", "https://peraturan.go.id/files/bn286-2021.pdf"]
  },
  {
    id: "permenakertrans-per-01-men-1980",
    jenis: "Peraturan Menteri",
    nomor: "PER.01/MEN/1980",
    tahun: 1980,
    judul: "Keselamatan dan Kesehatan Kerja pada Konstruksi Bangunan",
    singkatan: "Permenakertrans PER.01/MEN/1980",
    instansi: "Kementerian Tenaga Kerja dan Transmigrasi (kini Kementerian Ketenagakerjaan)",
    status: "Berlaku",
    relevansi: "Mendefinisikan perancah sebagai bangunan peralatan (platform) sementara untuk menyangga tenaga kerja, bahan, dan alat, serta memuat ketentuan K3 perancah, tangga, dan peralatan pada konstruksi bangunan. Hingga kini masih menjadi rujukan pokok K3 perancah di Indonesia.",
    tautan: "",
    kunci: true,
    sumber: ["https://jdih.bandung.go.id/media/1380", "https://journal.uib.ac.id/index.php/landmark/article/view/11505/5131", "https://repo.ukitoraja.ac.id/id/eprint/1192/3/Bab%20II.pdf"]
  },
  {
    id: "permenaker-9-2016",
    jenis: "Peraturan Menteri",
    nomor: "9",
    tahun: 2016,
    judul: "Keselamatan dan Kesehatan Kerja dalam Pekerjaan pada Ketinggian",
    singkatan: "Permenaker 9/2016",
    instansi: "Kementerian Ketenagakerjaan",
    status: "Berlaku (diubah)",
    relevansi: "Pasal 15 mewajibkan pekerjaan pada ketinggian yang menggunakan perancah memenuhi persyaratan K3, sedangkan Pasal 35 menetapkan kategori Tenaga Kerja Bangunan Tinggi (tingkat 1–2) dan Tenaga Kerja pada Ketinggian (tingkat 1–3) yang wajib kompeten dan berlisensi K3. Pasal 1 angka 14 dan Pasal 29 ayat (3) telah dicabut oleh Permenaker 11/2026.",
    tautan: "https://peraturan.bpk.go.id/Details/146109/permenaker-no-9-tahun-2016",
    kunci: true,
    sumber: ["https://peraturan.bpk.go.id/Details/146109/permenaker-no-9-tahun-2016", "https://peraturan.bpk.go.id/Download/252144/Kemnaker%20No.%209%20Tahun%202016.pdf", "https://jdih.kemnaker.go.id/peraturan/detail/1210/peraturan-menteri-ketenagakerjaan-nomor-9-tahun-2016", "https://jdih.kemnaker.go.id/peraturan/detail/3070/peraturan-menteri-ketenagakerjaan-nomor-11-tahun-2026"]
  },
  {
    id: "permen-pupr-10-2021",
    jenis: "Peraturan Menteri",
    nomor: "10",
    tahun: 2021,
    judul: "Pedoman Sistem Manajemen Keselamatan Konstruksi",
    singkatan: "Permen PUPR 10/2021",
    instansi: "Kementerian Pekerjaan Umum dan Perumahan Rakyat (kini Kementerian Pekerjaan Umum)",
    status: "Berlaku",
    relevansi: "Menggolongkan pekerjaan menggunakan perancah dan pekerjaan di ketinggian lebih dari 1,8 meter sebagai pekerjaan bersifat khusus yang wajib dianalisis melalui Analisis Keselamatan Konstruksi (AKK) dalam penerapan SMKK (Pasal 26).",
    tautan: "https://peraturan.bpk.go.id/Details/216875/permen-pupr-no-10-tahun-2021",
    kunci: true,
    sumber: ["https://peraturan.bpk.go.id/Details/216875/permen-pupr-no-10-tahun-2021", "https://peraturan.go.id/files/bn286-2021.pdf", "https://jdih.kemenkoinfra.go.id/id/peraturan-menteri-pekerjaan-umum-dan-perumahan-rakyat-no-10-tahun-2021"]
  },
  {
    id: "se-menteri-pupr-10-se-m-2022",
    jenis: "Surat Edaran",
    nomor: "10/SE/M/2022",
    tahun: 2022,
    judul: "Panduan Operasional Tertib Penyelenggaraan Keselamatan Konstruksi di Kementerian Pekerjaan Umum dan Perumahan Rakyat",
    singkatan: "SE Menteri PUPR 10/SE/M/2022",
    instansi: "Kementerian Pekerjaan Umum dan Perumahan Rakyat (kini Kementerian Pekerjaan Umum)",
    status: "Berlaku",
    relevansi: "Mensyaratkan perhitungan kekuatan dan beban sebelum perancah dibangun, pemasangan serta pemeriksaan oleh personel kompeten bersertifikat, dan sistem penandaan (tagging) hijau, kuning, dan merah pada perancah.",
    tautan: "https://jdih.pu.go.id/internal/assets/assets/produk/SEMenteriPUPR/2022/05/2022SEMenteriPUPR10.pdf",
    kunci: false,
    sumber: ["https://jdih.pu.go.id/internal/assets/assets/produk/SEMenteriPUPR/2022/05/2022SEMenteriPUPR10.pdf", "https://www.hukumonline.com/pusatdata/detail/lt62a19cecef5ee/surat-edaran-menteri-pekerjaan-umum-dan-perumahan-rakyat-nomor-10-se-m-2022-tahun-2022/analysis/"]
  },
  {
    id: "permenakertrans-per-08-men-vii-2010",
    jenis: "Peraturan Menteri",
    nomor: "PER.08/MEN/VII/2010",
    tahun: 2010,
    judul: "Alat Pelindung Diri",
    singkatan: "Permenakertrans PER.08/MEN/VII/2010",
    instansi: "Kementerian Tenaga Kerja dan Transmigrasi (kini Kementerian Ketenagakerjaan)",
    status: "Berlaku",
    relevansi: "Mewajibkan pengusaha menyediakan APD secara cuma-cuma, termasuk alat pelindung jatuh perorangan (Pasal 3 ayat (2)) yang esensial bagi pekerja di perancah.",
    tautan: "https://jdih.kemnaker.go.id/peraturan/detail/158/peraturan-menteri-nomor-8-tahun-2010",
    kunci: false,
    sumber: ["https://jdih.kemnaker.go.id/peraturan/detail/158/peraturan-menteri-nomor-8-tahun-2010", "https://www.peraturan.go.id/files/bn330-2010.pdf"]
  },
  {
    id: "permenaker-per-02-men-1992",
    jenis: "Peraturan Menteri",
    nomor: "PER-02/MEN/1992",
    tahun: 1992,
    judul: "Tata Cara Penunjukan Kewajiban dan Wewenang Ahli Keselamatan dan Kesehatan Kerja",
    singkatan: "Permenaker PER-02/MEN/1992",
    instansi: "Kementerian Tenaga Kerja (kini Kementerian Ketenagakerjaan)",
    status: "Berlaku",
    relevansi: "Mengatur penunjukan serta kewajiban dan wewenang Ahli K3 yang membantu pengawasan ditaatinya persyaratan K3 di tempat kerja, termasuk proyek yang menggunakan perancah.",
    tautan: "https://jdih.kemnaker.go.id/peraturan/detail/242/peraturan-menteri-tenaga-kerja-nomor-2-tahun-1992",
    kunci: false,
    sumber: ["https://jdih.kemnaker.go.id/peraturan/detail/242/peraturan-menteri-tenaga-kerja-nomor-2-tahun-1992"]
  },
  {
    id: "permenaker-13-2025",
    jenis: "Peraturan Menteri",
    nomor: "13",
    tahun: 2025,
    judul: "Panitia Pembina Keselamatan dan Kesehatan Kerja",
    singkatan: "Permenaker 13/2025",
    instansi: "Kementerian Ketenagakerjaan",
    status: "Berlaku",
    relevansi: "Mengatur pembentukan, tugas, dan pelaporan Panitia Pembina K3 (P2K3) sebagai wadah kerja sama pengusaha dan pekerja dalam menerapkan K3 di tempat kerja, termasuk proyek perancah. Peraturan ini mencabut Permenaker PER.04/MEN/1987.",
    tautan: "https://jdih.kemnaker.go.id/peraturan/detail/2788/peraturan-menteri-ketenagakerjaan-nomor-13-tahun-2025",
    kunci: false,
    sumber: ["https://jdih.kemnaker.go.id/peraturan/detail/2788/peraturan-menteri-ketenagakerjaan-nomor-13-tahun-2025", "https://peraturan.go.id/files/permenaker-no-13-tahun-2025.pdf"]
  },
  {
    id: "permenaker-per-04-men-1987",
    jenis: "Peraturan Menteri",
    nomor: "PER.04/MEN/1987",
    tahun: 1987,
    judul: "Panitia Pembina Keselamatan dan Kesehatan Kerja serta Tata Cara Penunjukan Ahli Keselamatan Kerja",
    singkatan: "Permenaker PER.04/MEN/1987",
    instansi: "Kementerian Tenaga Kerja (kini Kementerian Ketenagakerjaan)",
    status: "Dicabut",
    relevansi: "Dahulu menjadi dasar pembentukan P2K3 dan penunjukan Ahli Keselamatan Kerja; telah dicabut dan digantikan oleh Permenaker 13/2025 yang ditetapkan pada 17 November 2025.",
    tautan: "https://jdih.kemnaker.go.id/peraturan/detail/2582/peraturan-menteri-tenaga-kerja-nomor-4-tahun-1987",
    kunci: false,
    sumber: ["https://jdih.kemnaker.go.id/peraturan/detail/2582/peraturan-menteri-tenaga-kerja-nomor-4-tahun-1987", "https://jdih.kemnaker.go.id/peraturan/detail/2788/peraturan-menteri-ketenagakerjaan-nomor-13-tahun-2025"]
  },
  {
    id: "permenaker-5-2018",
    jenis: "Peraturan Menteri",
    nomor: "5",
    tahun: 2018,
    judul: "Keselamatan dan Kesehatan Kerja Lingkungan Kerja",
    singkatan: "Permenaker 5/2018",
    instansi: "Kementerian Ketenagakerjaan",
    status: "Berlaku",
    relevansi: "Menetapkan nilai ambang batas faktor fisika dan kimia serta standar faktor biologi, ergonomi, psikologi, higiene, dan sanitasi di tempat kerja, yang menjadi acuan pengendalian lingkungan kerja di area pemasangan perancah.",
    tautan: "https://jdih.kemnaker.go.id/peraturan/detail/1546/peraturan-menteri-ketenagakerjaan-nomor-5-tahun-2018",
    kunci: false,
    sumber: ["https://jdih.kemnaker.go.id/peraturan/detail/1546/peraturan-menteri-ketenagakerjaan-nomor-5-tahun-2018", "https://nu.or.id/nasional/menaker-terbitkan-aturan-k3-lingkungan-kerja-ob32x"]
  },
  {
    id: "kepmenaker-46-2022",
    jenis: "Keputusan Menteri",
    nomor: "46",
    tahun: 2022,
    judul: "Penetapan Standar Kompetensi Kerja Nasional Indonesia Kategori Konstruksi Golongan Pokok Konstruksi Khusus Bidang Operasi Scaffolding",
    singkatan: "Kepmenaker 46/2022",
    instansi: "Kementerian Ketenagakerjaan",
    status: "Berlaku",
    relevansi: "SKKNI bidang operasi scaffolding yang menggantikan Kepmenaker 214/2017 dan menjadi acuan skema sertifikasi Operator, Teknisi, dan Pengawas Scaffolding pada SKK Konstruksi.",
    tautan: "https://jdih.kemnaker.go.id/peraturan/detail/2235/keputusan-menteri-ketenagakerjaan-nomor-46-tahun-2022",
    kunci: true,
    sumber: ["https://jdih.kemnaker.go.id/peraturan/detail/2235/keputusan-menteri-ketenagakerjaan-nomor-46-tahun-2022", "https://jdih.kemnaker.go.id/peraturan/detail/2892/keputusan-menteri-nomor-214-tahun-2017", "https://binakonstruksi.pu.go.id/storage/SK-DJBK-Nomor-114-Thn-2024_4-Des_KPTS-Tentang-Penetapan-Jabker-dan-Jenjang-Kualifikasi-atas-Jabker-di-Bidang-Jasa-Konstruksi.pdf"]
  },
  {
    id: "kepmenaker-54-2015",
    jenis: "Keputusan Menteri",
    nomor: "54",
    tahun: 2015,
    judul: "Penetapan Standar Kompetensi Kerja Nasional Indonesia Kategori Konstruksi Golongan Pokok Konstruksi Khusus pada Jabatan Kerja Pemasang Perancah dan Acuan/Cetakan Beton",
    singkatan: "Kepmenaker 54/2015",
    instansi: "Kementerian Ketenagakerjaan",
    status: "Berlaku",
    relevansi: "SKKNI jabatan kerja pemasang perancah dan acuan/cetakan beton yang menjadi acuan skema Tukang serta Kepala Tukang Pasang Perancah dan Acuan/Cetakan Beton pada SKK Konstruksi.",
    tautan: "https://jdih.kemnaker.go.id/peraturan/detail/1055/keputusan-menaker-nomor-54-tahun-2015",
    kunci: false,
    sumber: ["https://jdih.kemnaker.go.id/peraturan/detail/1055/keputusan-menaker-nomor-54-tahun-2015", "https://binakonstruksi.pu.go.id/storage/SK-DJBK-Nomor-114-Thn-2024_4-Des_KPTS-Tentang-Penetapan-Jabker-dan-Jenjang-Kualifikasi-atas-Jabker-di-Bidang-Jasa-Konstruksi.pdf"]
  },
  {
    id: "kepmenaker-393-2020",
    jenis: "Keputusan Menteri",
    nomor: "393",
    tahun: 2020,
    judul: "Penetapan Standar Kompetensi Kerja Nasional Indonesia Kategori Aktivitas Profesional, Ilmiah dan Teknis Golongan Pokok Aktivitas Arsitektur dan Keinsinyuran; Analisis dan Uji Teknis Bidang Keselamatan dan Kesehatan Kerja dalam Pekerjaan Ketinggian",
    singkatan: "Kepmenaker 393/2020",
    instansi: "Kementerian Ketenagakerjaan",
    status: "Berlaku",
    relevansi: "SKKNI K3 dalam pekerjaan ketinggian yang menggantikan KEP.325/MEN/XII/2011; menjadi acuan kompetensi tenaga kerja yang bekerja di ketinggian, termasuk di atas perancah.",
    tautan: "https://jdih.kemnaker.go.id/peraturan/detail/1993/keputusan-menteri-ketenagakerjaan-nomor-393-tahun-2020",
    kunci: false,
    sumber: ["https://jdih.kemnaker.go.id/peraturan/detail/1993/keputusan-menteri-ketenagakerjaan-nomor-393-tahun-2020", "https://peraturan.bpk.go.id/Download/252144/Kemnaker%20No.%209%20Tahun%202016.pdf"]
  },
  {
    id: "sni-8987-2021",
    jenis: "SNI",
    nomor: "SNI 8987",
    tahun: 2021,
    judul: "Pipa baja untuk perancah",
    singkatan: "SNI 8987:2021",
    instansi: "Badan Standardisasi Nasional (BSN)",
    status: "Berlaku",
    relevansi: "Standar nasional produk pipa baja perancah yang ditetapkan melalui SK Kepala BSN 484/KEP/BSN/11/2021; menjadi acuan mutu material pipa perancah di Indonesia.",
    tautan: "https://pesta.bsn.go.id/produk/detail/13541-sni89872021",
    kunci: false,
    sumber: ["https://pesta.bsn.go.id/produk/detail/13541-sni89872021", "https://iapmoindonesia.org/media/rgmhb4xo/ss5-53-rev01-sni-8987-2021-pipa-baja-untuk-perancah.pdf"]
  },
  {
    id: "en-12811-1",
    jenis: "Standar Internasional",
    nomor: "BS EN 12811-1",
    tahun: 2003,
    judul: "Temporary works equipment — Scaffolds — Performance requirements and general design",
    singkatan: "EN 12811-1",
    instansi: "CEN / British Standards Institution (BSI)",
    status: "Berlaku",
    relevansi: "Standar Eropa tentang persyaratan kinerja dan metode desain struktural perancah akses dan perancah kerja; menjadi dasar perhitungan konfigurasi baku dalam panduan NASC TG20.",
    tautan: "https://knowledge.bsigroup.com/products/temporary-works-equipment-scaffolds-performance-requirements-and-general-design",
    kunci: false,
    sumber: ["https://knowledge.bsigroup.com/products/temporary-works-equipment-scaffolds-performance-requirements-and-general-design", "https://meinnormenradar.austrian-standards.at/radar/RadarDetails.action?id=1270720", "https://nasc.org.uk/product-category/technical-guidance"]
  },
  {
    id: "en-12810",
    jenis: "Standar Internasional",
    nomor: "BS EN 12810-1 & BS EN 12810-2",
    tahun: 2003,
    judul: "Façade scaffolds made of prefabricated components — Part 1: Product specifications; Part 2: Particular methods of structural design",
    singkatan: "EN 12810",
    instansi: "CEN / British Standards Institution (BSI)",
    status: "Berlaku",
    relevansi: "Mengatur persyaratan produk serta metode analisis dan desain struktural (melalui perhitungan dan pengujian) sistem perancah fasad prefabrikasi berbahan baja atau aluminium yang diikat ke fasad bangunan.",
    tautan: "https://knowledge.bsigroup.com/products/facade-scaffolds-made-of-prefabricated-components-product-specifications",
    kunci: false,
    sumber: ["https://knowledge.bsigroup.com/products/facade-scaffolds-made-of-prefabricated-components-product-specifications", "https://www.evs.ee/en/evs-en-12810-2-2004", "https://www.dinmedia.de/en/standard/en-12810-2/70303504"]
  },
  {
    id: "en-74-1",
    jenis: "Standar Internasional",
    nomor: "BS EN 74-1",
    tahun: 2022,
    judul: "Couplers, spigot pins and baseplates for use in falsework and scaffolds — Part 1: Couplers for tubes — Requirements and test procedures",
    singkatan: "EN 74-1",
    instansi: "CEN / British Standards Institution (BSI)",
    status: "Berlaku (diubah)",
    relevansi: "Menetapkan persyaratan material, desain, kelas kekuatan, dan prosedur uji klem (coupler) untuk perancah pipa dan klem; edisi 2022 telah dilengkapi amandemen A1:2024.",
    tautan: "https://knowledge.bsigroup.com/products/bs-en-74-1-2022-a1-couplers-spigot-pins-and-baseplates-for-use-in-falsework-and-scaffolds-part-1-couplers-for-tubes-requirements-and-test-procedures",
    kunci: false,
    sumber: ["https://knowledge.bsigroup.com/products/bs-en-74-1-2022-a1-couplers-spigot-pins-and-baseplates-for-use-in-falsework-and-scaffolds-part-1-couplers-for-tubes-requirements-and-test-procedures", "https://infostore.saiglobal.com/en-au/standards/bs-en-74-1-2022-218676_saig_bsi_bsi_3135015/"]
  },
  {
    id: "en-39",
    jenis: "Standar Internasional",
    nomor: "BS EN 39",
    tahun: 2001,
    judul: "Loose steel tubes for tube and coupler scaffolds — Technical delivery conditions",
    singkatan: "EN 39",
    instansi: "CEN / British Standards Institution (BSI)",
    status: "Berlaku",
    relevansi: "Menetapkan syarat teknis pipa baja lepas (umumnya berdiameter luar 48,3 mm) untuk perancah pipa dan klem yang digunakan bersama klem EN 74; menggantikan BS 1139-1.1:1990.",
    tautan: "https://knowledge.bsigroup.com/products/loose-steel-tubes-for-tube-and-coupler-scaffolds-technical-delivery-conditions",
    kunci: false,
    sumber: ["https://knowledge.bsigroup.com/products/loose-steel-tubes-for-tube-and-coupler-scaffolds-technical-delivery-conditions", "https://www.technickenormy.cz/en/bs-en-39-2001-loose-steel-tubes-for-tube-and-coupler-scaffolds-technical-delivery-conditions"]
  },
  {
    id: "nasc-tg20-21",
    jenis: "Standar Internasional",
    nomor: "TG20:21",
    tahun: 2021,
    judul: "Good Practice Guidance for Tube and Fitting Scaffolding",
    singkatan: "NASC TG20:21",
    instansi: "National Access & Scaffolding Confederation (NASC), Inggris",
    status: "Berlaku",
    relevansi: "Panduan praktik baik perancah pipa dan klem di Inggris; konfigurasi yang memenuhi TG20 telah dihitung berdasarkan BS EN 12811 sehingga tidak memerlukan desain khusus, sedangkan konfigurasi di luar cakupannya wajib didesain oleh perancang yang kompeten.",
    tautan: "https://nasc.org.uk/product-category/technical-guidance",
    kunci: false,
    sumber: ["https://nasc.org.uk/product-category/technical-guidance", "https://constructionmanagement.co.uk/nasc-updates-tg20-scaffolding-eguide/"]
  },
  {
    id: "osha-1926-subpart-l",
    jenis: "Standar Internasional",
    nomor: "29 CFR 1926 Subpart L",
    tahun: 1996,
    judul: "Scaffolds (Safety and Health Regulations for Construction)",
    singkatan: "OSHA 1926 Subpart L",
    instansi: "Occupational Safety and Health Administration (OSHA), Amerika Serikat",
    status: "Berlaku",
    relevansi: "Regulasi federal Amerika Serikat untuk perancah konstruksi (§1926.450–1926.454) yang mencakup persyaratan umum, ketentuan per jenis perancah, aerial lift, dan pelatihan pekerja; banyak dirujuk sebagai pembanding praktik internasional.",
    tautan: "https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926SubpartL",
    kunci: false,
    sumber: ["https://www.osha.gov/laws-regs/regulations/standardnumber/1926/1926SubpartL", "https://govinfo.gov/content/pkg/FR-1996-08-30/html/96-21289.htm"]
  },
  {
    id: "as-nzs-1576-1",
    jenis: "Standar Internasional",
    nomor: "AS/NZS 1576.1",
    tahun: 2019,
    judul: "Scaffolding — Part 1: General requirements",
    singkatan: "AS/NZS 1576.1",
    instansi: "Standards Australia / Standards New Zealand",
    status: "Berlaku",
    relevansi: "Bagian umum seri AS/NZS 1576 yang menetapkan aturan desain dan operasional sistem perancah, peralatan, dan perancah utuh; edisi 2019 menggantikan edisi 2010.",
    tautan: "https://store.standards.org.au/product/as-nzs-1576-1-2019",
    kunci: false,
    sumber: ["https://store.standards.org.au/product/as-nzs-1576-1-2019", "https://standards.govt.nz/shop/ASNZS-1576-12019"]
  },
  {
    id: "as-4576-2020",
    jenis: "Standar Internasional",
    nomor: "AS 4576",
    tahun: 2020,
    judul: "Guidelines for scaffolding",
    singkatan: "AS 4576:2020",
    instansi: "Standards Australia",
    status: "Berlaku",
    relevansi: "Pedoman pendamping seri AS/NZS 1576 yang menggantikan AS/NZS 4576:1995 di Australia; memuat panduan antara lain pengikatan (tie) perancah, platform perluasan (hop-up), dan penggunaan harness pada perancah.",
    tautan: "https://store.standards.org.au/product/as-4576-2020",
    kunci: false,
    sumber: ["https://hia.com.au/resources-and-advice/managing-your-safety/falls-from-heights/articles/revised-version-of-scaffold-standard-as-4576", "https://store.standards.org.au/product/as-4576-2020", "https://standards.govt.nz/shop/asnzs-45761995"]
  }
];
