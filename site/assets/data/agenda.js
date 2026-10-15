/* ==========================================================================
   DATA AGENDA KEGIATAN  (assets/data/agenda.js)
   --------------------------------------------------------------------------
   APA ARTI "contoh: true"?
   Kegiatan bertanda contoh: true adalah CONTOH untuk memperlihatkan tampilan
   situs (diberi label "Contoh"). Ganti dengan kegiatan resmi, lalu ubah
   menjadi contoh: false.

   CARA MENAMBAH KEGIATAN
   Salin satu blok { … } (termasuk koma), tempel di dalam daftar, lalu isi:
     id           : kode unik huruf kecil dan tanda hubung, tanpa spasi
     judul        : nama kegiatan
     jenis        : 'Pelatihan', 'Sertifikasi', 'Seminar', 'Webinar', 'Rapat',
                    atau 'Kunjungan Teknis'
     mulai        : tanggal mulai, format TAHUN-BULAN-TANGGAL, contoh '2026-11-12'
     selesai      : tanggal selesai (sama dengan mulai untuk kegiatan sehari)
     waktu        : jam, contoh '08.00 – 16.00 WIB'
     lokasi       : kota/tempat atau 'Daring (Zoom)'
     mode         : 'Luring' (tatap muka), 'Daring' (online), atau 'Hybrid'
     kuota        : jumlah peserta (angka) atau null bila tidak dibatasi
     deskripsi    : penjelasan singkat kegiatan
     tautanDaftar : alamat formulir pendaftaran (https://…) atau '' — jika
                    kosong, pengunjung diarahkan menghubungi sekretariat
     contoh       : true/false
   Kegiatan yang tanggalnya sudah lewat otomatis tampil sebagai
   "Telah Berlangsung". Urutan di berkas ini tidak berpengaruh.
   ========================================================================== */
window.PPAPI_DATA = window.PPAPI_DATA || {};

PPAPI_DATA.agenda = [
  {
    id: 'rapat-kerja-pengurus-mei-2026',
    judul: 'Rapat Kerja Pengurus',
    jenis: 'Rapat',
    mulai: '2026-05-14',
    selesai: '2026-05-15',
    waktu: '09.00 – 16.00 WIB',
    lokasi: 'Jakarta',
    mode: 'Luring',
    kuota: null,
    deskripsi: 'Evaluasi kegiatan dan penyusunan arah program kerja perkumpulan untuk periode 2026–2027.',
    tautanDaftar: '',
    contoh: true
  },
  {
    id: 'diskusi-panel-perancah-infrastruktur-jul-2026',
    judul: 'Diskusi Panel: Perancah pada Proyek Infrastruktur',
    jenis: 'Seminar',
    mulai: '2026-07-09',
    selesai: '2026-07-09',
    waktu: '09.00 – 12.00 WIB',
    lokasi: 'Semarang & daring',
    mode: 'Hybrid',
    kuota: 150,
    deskripsi: 'Diskusi panel mengenai tantangan perancah dan perancah penyangga pada pekerjaan jembatan, dermaga, dan fasilitas industri — dari perencanaan hingga pembongkaran.',
    tautanDaftar: '',
    contoh: true
  },
  {
    id: 'pelatihan-dasar-perancah-pelaksana-agu-2026',
    judul: 'Pelatihan Dasar Perancah untuk Pelaksana Lapangan',
    jenis: 'Pelatihan',
    mulai: '2026-08-05',
    selesai: '2026-08-06',
    waktu: '08.00 – 16.00 WIB',
    lokasi: 'Balikpapan',
    mode: 'Luring',
    kuota: 30,
    deskripsi: 'Pengenalan komponen perancah pipa dan klem, urutan pemasangan dan pembongkaran yang aman, serta pemeriksaan visual harian bagi pelaksana lapangan.',
    tautanDaftar: '',
    contoh: true
  },
  {
    id: 'webinar-penandaan-perancah-sep-2026',
    judul: 'Webinar: Penerapan Penandaan (Tagging) Perancah di Lapangan',
    jenis: 'Webinar',
    mulai: '2026-09-17',
    selesai: '2026-09-17',
    waktu: '14.00 – 15.30 WIB',
    lokasi: 'Daring (Zoom)',
    mode: 'Daring',
    kuota: 300,
    deskripsi: 'Membahas cara membaca dan menerapkan tag hijau, kuning, dan merah, serta dokumentasi pemeriksaan yang menyertainya.',
    tautanDaftar: '',
    contoh: true
  },
  {
    id: 'pelatihan-inspeksi-tube-coupler-okt-2026',
    judul: 'Pelatihan Inspeksi Perancah Pipa dan Klem (Tube & Coupler)',
    jenis: 'Pelatihan',
    mulai: '2026-10-21',
    selesai: '2026-10-23',
    waktu: '08.00 – 16.00 WIB',
    lokasi: 'Jakarta (lokasi rinci diinformasikan kepada peserta)',
    mode: 'Luring',
    kuota: 30,
    deskripsi: 'Pelatihan tiga hari tentang pemeriksaan perancah berbasis elemen: tumpuan dan pelat dasar, tiang, ledger dan transom, klem, pengaku (bracing), pengikat ke bangunan, platform, serta akses. Ditutup dengan praktik pengisian checklist dan penandaan.',
    tautanDaftar: '',
    contoh: true
  },
  {
    id: 'webinar-smkk-pekerjaan-perancah-okt-2026',
    judul: 'Webinar: SMKK dan Analisis Keselamatan Konstruksi untuk Pekerjaan Perancah',
    jenis: 'Webinar',
    mulai: '2026-10-29',
    selesai: '2026-10-29',
    waktu: '13.30 – 15.30 WIB',
    lokasi: 'Daring (Zoom)',
    mode: 'Daring',
    kuota: 300,
    deskripsi: 'Mengulas Permen PUPR 10/2021 tentang Pedoman SMKK, yang menggolongkan pekerjaan menggunakan perancah sebagai pekerjaan bersifat khusus yang wajib dianalisis melalui Analisis Keselamatan Konstruksi (AKK).',
    tautanDaftar: '',
    contoh: true
  },
  {
    id: 'uji-kompetensi-scaffolding-nov-2026',
    judul: 'Fasilitasi Uji Kompetensi Jabatan Kerja Scaffolding',
    jenis: 'Sertifikasi',
    mulai: '2026-11-12',
    selesai: '2026-11-13',
    waktu: '08.00 – 17.00 WIB',
    lokasi: 'Surabaya',
    mode: 'Luring',
    kuota: 20,
    deskripsi: 'Fasilitasi bagi anggota yang menyiapkan uji kompetensi jabatan kerja scaffolding mengacu SKKNI Kepmenaker 46/2022, bekerja sama dengan lembaga sertifikasi profesi berlisensi. Persyaratan dan biaya mengikuti ketentuan lembaga sertifikasi.',
    tautanDaftar: '',
    contoh: true
  },
  {
    id: 'seminar-keselamatan-perancah-2026',
    judul: 'Seminar Nasional Keselamatan Perancah 2026',
    jenis: 'Seminar',
    mulai: '2026-11-26',
    selesai: '2026-11-26',
    waktu: '08.30 – 15.00 WIB',
    lokasi: 'Jakarta & daring',
    mode: 'Hybrid',
    kuota: 250,
    deskripsi: 'Seminar yang mempertemukan praktisi, ahli, pelaku usaha, dan regulator untuk membahas praktik baik, pembelajaran dari insiden, serta arah pengembangan kompetensi tenaga perancah.',
    tautanDaftar: '',
    contoh: true
  },
  {
    id: 'kunjungan-teknis-gedung-bertingkat-des-2026',
    judul: 'Kunjungan Teknis Proyek Gedung Bertingkat',
    jenis: 'Kunjungan Teknis',
    mulai: '2026-12-10',
    selesai: '2026-12-10',
    waktu: '09.00 – 13.00 WIB',
    lokasi: 'Bandung',
    mode: 'Luring',
    kuota: 25,
    deskripsi: 'Melihat langsung penerapan perancah fasad dan perancah sistem pada proyek gedung bertingkat, dilanjutkan diskusi bersama tim pelaksana. Peserta wajib memakai APD lengkap.',
    tautanDaftar: '',
    contoh: true
  },
  {
    id: 'rapat-anggota-tahunan-2027',
    judul: 'Rapat Anggota Tahunan',
    jenis: 'Rapat',
    mulai: '2027-01-21',
    selesai: '2027-01-21',
    waktu: '09.00 – 15.00 WIB',
    lokasi: 'Jakarta & daring',
    mode: 'Hybrid',
    kuota: null,
    deskripsi: 'Laporan pertanggungjawaban pengurus, evaluasi program, dan penyampaian rencana kerja tahun berikutnya kepada seluruh anggota.',
    tautanDaftar: '',
    contoh: true
  }
];
