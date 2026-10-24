/* ==========================================================================
   DATA REGISTRI ANGGOTA (VERIFIKASI PUBLIK)  (assets/data/registry.js)
   --------------------------------------------------------------------------
   Daftar ini dipakai halaman Verifikasi Anggota (verifikasi.html) untuk
   memeriksa keabsahan nomor KTA. Daftar resmi dikelola oleh sekretariat.

   PENTING — PRIVASI: cantumkan HANYA data terbatas yang boleh dilihat publik
   (nama, nomor KTA, kategori, kompetensi utama, kota, masa berlaku, status).
   Jangan menulis alamat, nomor HP, email, atau tanggal lahir di sini.

   STATUS SAAT INI: daftar statis di bawah KOSONG ([]). Daftar verifikasi
   publik yang berlaku berasal dari persetujuan keanggotaan di Konsol Admin
   (Mode Firebase: koleksi `registry` di Firestore; Mode Demo: peramban ini).
   Berkas ini hanya perlu diisi bila sekretariat ingin menambahkan anggota
   lama secara manual.

   CARA MENAMBAH ANGGOTA (bila diperlukan)
   Tempel blok { … } di antara tanda [ ] (pisahkan dengan koma), lalu isi:
     kta           : nomor KTA, contoh 'PPAPI-2026-000123'
     nama          : nama lengkap
     kategori      : 'Praktisi', 'Ahli', atau 'Kehormatan'
     kompetensi    : daftar kompetensi utama, contoh ['Teknisi Scaffolding']
     kota          : kota domisili, contoh 'Surabaya'
     berlakuHingga : format TAHUN-BULAN-TANGGAL, contoh '2029-12-31'
     status        : 'Aktif' atau 'Nonaktif'
     contoh        : false untuk data resmi (true = data ilustrasi; hanya tampil
                     pada Mode Demo dan diberi label "Contoh")
   ========================================================================== */
window.PPAPI_DATA = window.PPAPI_DATA || {};

PPAPI_DATA.registry = [];
