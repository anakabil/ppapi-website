/* ==========================================================================
   DATA AGENDA KEGIATAN  (assets/data/agenda.js)
   --------------------------------------------------------------------------
   STATUS SAAT INI: belum ada kegiatan resmi, sehingga daftar di bawah KOSONG
   ([]). Halaman Agenda, Beranda, Berita, dan Dasbor menampilkan keadaan
   kosong yang rapi sampai kegiatan pertama ditambahkan di sini atau melalui
   Konsol Admin › Konten › Agenda.

   CARA MENAMBAH KEGIATAN
   Tempel blok seperti contoh format di bawah di antara tanda [ ], lalu isi:
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
     contoh       : false untuk kegiatan resmi (true hanya untuk ilustrasi;
                    situs menampilkan label "Contoh")
   CONTOH FORMAT (jangan dihapus tanda komentarnya bila belum dipakai):
     {
       id: 'pelatihan-inspeksi-perancah-2027', judul: 'Pelatihan Inspeksi Perancah',
       jenis: 'Pelatihan', mulai: '2027-03-10', selesai: '2027-03-11',
       waktu: '08.00 – 16.00 WIB', lokasi: 'Jakarta', mode: 'Luring', kuota: 30,
       deskripsi: 'Uraian singkat kegiatan.', tautanDaftar: '', contoh: false
     }
   Kegiatan yang tanggalnya sudah lewat otomatis tampil sebagai
   "Telah Berlangsung". Urutan di berkas ini tidak berpengaruh.
   ========================================================================== */
window.PPAPI_DATA = window.PPAPI_DATA || {};

PPAPI_DATA.agenda = [];
