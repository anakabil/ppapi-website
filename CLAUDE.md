# CLAUDE.md — konteks proyek situs PPAPI

Situs resmi **Perkumpulan Praktisi dan Ahli Perancah Indonesia (PPAPI)**, tayang di <https://ppapi.or.id>.
Repositori ini satu-satunya sumber kebenaran. Baca juga `README.md` (alur kerja), `site/README.md`
(panduan sekretariat), `SPEC.md` + `SPEC-v2.md` (desain & arsitektur), `devtools/FOUNDATION_NOTES.md`
(API, komponen, riwayat perubahan).

## Cara kerja
- Situs statis di `site/` (skrip klasik, tanpa build), Firebase compat 12.4.0 (proyek `ppapi-web`).
- Push ke `main` → GitHub Actions (`.github/workflows/pages.yml`) menjalankan semua uji → terbit ke GitHub Pages.
  Uji gagal = tidak terbit. Pantau di tab Actions.
- Uji lokal: `cd devtools && npm ci && npx playwright install chromium`, lalu dari root
  `node devtools/check.mjs all`, `--auth`, `--auth --status="Draf"`, `--admin`; alur di `devtools/flows/*.mjs`
  (jalankan dari `devtools/`). Server uji memaksa Mode Demo; `PPAPI_REAL_FIREBASE=1` untuk mode Firebase.
- **Perubahan `site/firestore.rules` harus ditempel & di-Publish manual** di Firebase Console → Firestore → Rules.
  Aturan dibatasi Google 1.000 ekspresi per permintaan: validasi hanya bagian yang berubah (lihat komentar di berkas).
- DNS domain di Hostinger (nameserver dns-parking.com). GitHub Pages: A/AAAA 185.199.108–111.153 / 2606:50c0:800x::153,
  CNAME `www` → `anakabil.github.io`.

## Aturan klien (wajib)
- **Jangan pernah** menampilkan label atribusi lama (lihat `devtools/flows/branding-guard.mjs`). Kredit pengembang
  hanya **"Dikembangkan oleh mrezahuzain@2026"** (footer semua halaman + kedua aplikasi).
- Bahasa: baku (KBBI/PUEBI), humanis, kata umum (mis. *umum* bukan *lazim*, *kesimpulan* bukan *simpulan*).
  Pengecualian atas pilihan klien (30-10-2026): pakai **"kaos"** (bukan "kaus") untuk produk pakaian.
- Tidak ada konten demo/contoh/pratinjau di produksi (`devtools/flows/produksi-bersih.mjs` di CI).
- Fitur anggota hanya untuk status **Aktif** (admin melihat semua).
- Keanggotaan mengikuti **Anggaran Dasar (Akta No. 01/2022)**: perorangan WNI berlisensi/bersertifikat perancah
  Kemnaker atau BNSP (Pasal 8–10). Kategori: Praktisi, Ahli, Kehormatan (ditetapkan). Badan usaha = mitra kerja sama,
  bukan anggota. Data pribadi pada akta (NIK, alamat rumah, tanggal lahir) **tidak boleh** dimuat di situs.
- Aplikasi Perencanaan berlabel **(Beta)** sampai ditinjau Komite Teknis (`site/aplikasi/KOREKSI-*.md`).
- Artikel berita: pola Latar Belakang → Masalah yang Sering Terjadi → Penjelasan dan Penyelesaian Berdasarkan
  Referensi → Solusi dan Kontribusi PPAPI → Penutup → Daftar Pustaka (APA 7); tanpa fakta tanpa sumber
  (`devtools/flows/artikel-struktur.mjs`).
- Toko: pembayaran transfer manual dikonfirmasi sekretariat; soft file = tautan pribadi + tanda air pembeli.

## Status (24 Oktober 2026)
- Firebase aktif: Email/Password + Google; domain resmi `ppapi.or.id` & `anakabil.github.io` diizinkan;
  Firestore asia-southeast2; aturan terbaru sudah di-Publish klien.
- Admin pertama: `ppapi.indonesia@gmail.com` (dokumen `admins/{uid}` dibuat di konsol). Klausul *bootstrap admin*
  di aturan boleh dihapus (opsional).
- Legalitas resmi dimuat (sumber: akta & SK yang diberikan klien 24-10-2026): Akta Pendirian No. 01 tgl 1 Juli 2022
  (Notaris Hj. Tuti Sriwahyuti, Kab. Bogor), SK Menkumham AHU-0008151.AH.01.07.Tahun 2022 (15 Agustus 2022), BNRI No. 066
  TBNRI No. 000370 (19 Agustus 2022). Pengurus pertama + Pengawas di `organisasi.js`; naskah AD lengkap di
  `site/anggaran-dasar.html` (data: `assets/data/anggaran-dasar.js`). Alamat sekretariat = kedudukan Pasal 1 AD.
- Kontak resmi: `sekretariat@ppapi.or.id`, telepon/WhatsApp 0812-2728-0075 (dikonfirmasi klien 24-10-2026).
- **Kode Etik v1.0** (disusun 24-10-2026 atas permintaan klien; berlaku, nomor/tanggal keputusan Pengurus menyusul di
  `assets/data/kode-etik.js` → `penetapan`). Halaman `site/kode-etik.html`, dirender oleh `assets/js/pages/anggaran-dasar.js`
  (body `data-doc`). Rujukan APA 7 + sitasi dalam teks di bagian Dasar Penyusunan.
- Beranda (27-10-2026): bagian **Kegiatan Terbaru** (setelah Tentang; sorotan + flyer, tersembunyi bila tak ada kegiatan
  terbit; nomor bagian dihitung ulang via `data-sec`), kartu Agenda Terdekat dihapus, Berita selebar halaman (4 berita).
  Flyer kegiatan: Konsol Admin › Kegiatan › Kelola › Flyer → `events/{id}/assets/flyer` (JPEG ≤ 900 KB) + `events/{id}.flyer`.
- Sertifikat (28-10-2026): templat bawaan (logo PPAPI + "a member of" INOSHPRO, judul "Sertifikat"). Penanda tangan + e-sign
  Ketua Umum: Konsol Admin › Kegiatan › Penanda Tangan Sertifikat → `cert_settings/penandatangan` (PNG ≤ 300 KB, baca: akun masuk).
  Berkas tanda tangan **jangan** dimasukkan ke repositori (publik).
- Perbaikan (03-11-2026): dokumen anggota lama yang gagal `memberCore`/`memberStrings` (mis. memberType "Mitra Korporat", kolom
  asing) membuat SEMUA update ditolak (anggota & admin). `store.admin.memberIssues(uid)` / `repairMember(uid)` + kotak peringatan
  di laci detail anggota; `ensureMember` tidak lagi gagal memuat bila sinkronisasi kontak ditolak. Toko: transaksi admin yang
  ditolak menjalankan `diagnoseOrderWrite` (uji tulis tanpa efek) agar pesan galat menyebut langkah yang ditolak.
- CoP dijual (03-11-2026, permintaan klien): **Seri Lengkap Bagian 1–8** versi rilis bertanda tangan (8 PDF dari klien 02/03-11-2026,
  183 hlm., digabung + bookmark) pada produk id `ppapi-cop-01-2026-seri-lengkap` (id tetap agar impor memperbarui; menggantikan paket
  sementara Bagian 3–7). Paket `produk-cop-ppapi-01-2026-seri-lengkap.json` diserahkan ke klien (berisi PDF bertanda tangan: **jangan**
  di-commit). Harga Rp150.000 / cetak Rp200.000, berat 600 g. Artikel promosi `pedoman-praktik-perancah-ppapi-cop-01-2026` (sorotan;
  gambar `assets/img/cop-01-2026.webp`, sitasi Bagian 1–8 = 2026a–h) + kolom opsional `ajakan: {label, href}` di berita.js (tombol
  sebelum Daftar Pustaka, hanya tautan internal `halaman.html?kueri`). 
- Artikel tobi (04-11-2026): `tobi-shokunin-ergonomi-dan-risiko-scaffolder` (Edukasi, 11 rujukan; sumber Jepang: NDL, Kotobank/Nipponica,
  Heibonsha, leaflet MHLW 2019 harness, bahan pelatihan MHLW 2026 via 全国仮設安全事業協同組合). Foto dari Wikimedia Commons (CC0/CC BY-SA/PD,
  kredit di keterangan): `assets/img/tobi-*.webp`. berita.js kini mendukung baris `@gambar assets/img/x.webp WxH | keterangan` di isi
  (diabaikan pemeriksa artikel) dan kolom `gambarKeterangan` (kredit foto sampul). Gambar sampul baru wajib didaftarkan di `IMAGES`
  core.js (ukuran + versi -sm) agar lolos uji kartu. Foto kiriman klien (sumber/lisensi tidak diketahui) tidak dipakai. Kunci OpenAI
  di env ditolak (401) per 04-11-2026. Uji berita-agenda-flow/contract-v2 kini menghitung 11 artikel bawaan.
- Laporan webinar 4-11-2026 (05-11-2026): artikel `laporan-webinar-collapse-prevention-dan-peluncuran-situs-ppapi` (Kegiatan, sorotan;
  gambar dari flyer `events/{id}/assets/flyer` → `assets/img/webinar-2026-11-04*.webp`). Fakta dari klien (dibuka Ketua Umum, pemateri,
  ditutup grand opening situs, lancar, peserta antusias bertanya) + data situs (166 pendaftar) + flyer. Tangkapan layar Zoom kiriman
  klien belum dimuat (bukan berkas; berisi nama/wajah peserta → pangkas dulu). Uji berita/contract kini menghitung 12 artikel.
- Berkas pendukung (05-11-2026): dokumen pengajuan, bukti pembayaran, dan berkas sertifikat **diunggah langsung** (bukan tautan
  Drive) lewat `assets/js/store-berkas.js` → `member_files/{uid}/berkas/{fid}` (+ `parts/{n}` ≤ 900 KB, maks. 5 = 4 MB; PDF atau foto →
  JPEG). fid: `dok-<rowId>`, `srt-<certId>`, `bukti-bayar`; baris menyimpan `berkas` (nama), bukti = `pembayaran.buktiUrl='berkas:bukti-bayar'`.
  Tautan https lama tetap terbaca. Aturan `member_files` (baca pemilik+admin; tulis selama formulir boleh diubah atau status Aktif)
  **perlu di-Publish**. Skema sertifikasi (`kompetensi.js` › `skema`): Kemnaker (Teknisi/Supervisor K3 Perancah, Ahli K3 Konstruksi),
  BNSP berjenjang KKNI (jabatan kerja Kepdirjen 114/KPTS/Dk/2024 + LSP migas), Ahli Muda/Madya/Utama K3 Konstruksi, + "Lainnya".
  Uji: `flows/berkas-flow.mjs`. Uji lama yang masih mengisi tautan (`pendaftaran-flow`, `anggota-flow`, `journey*`, `review-fungsi-*`)
  perlu disesuaikan (bukan bagian CI).
- Sertifikat kehadiran di profil (05-11-2026): tab Sertifikat › "Sertifikat kehadiran kegiatan" (`anggota.js` renderKegiatanCerts) —
  gambar dari `K().certImage` (kanvas, templat/desain sama dengan PDF), tombol Unduh PDF + perbesar. jsPDF kini dimuat dari
  `assets/vendor/jspdf-2.5.1.umd.min.js` lebih dahulu (CSP halaman profil tidak mengizinkan cdnjs).
- KTA (04-11-2026): nama sisi depan tembus ke sisi belakang saat kartu dibalik (Safari/Chrome ponsel mengabaikan backface-visibility
  pada line-clamp/background-clip). Perbaikan di anggota.css: sisi yang membelakangi disembunyikan `visibility` tepat di pertengahan
  putaran (delay .55s) + `translateZ(1px)` per sisi.
- Tampilan (02-11-2026): tabel di dalam pop-up (modal/laci) memakai container query `tblwrap` (main.css): bertumpuk menjadi kartu
  bila wadah < 720 px, sel terlipat pada wadah lebar (tidak ada lagi tombol "Tandai Hadir" terpotong). Tab (`.tabs__list`), menu
  Konsol Admin di ponsel/tablet, chip filter Pustaka/Instruktur, dan indeks Profil kini terlipat (bukan strip geser).
  Audit: `node flows/audit-popup.mjs` (dari devtools/; laptop 1280 + ponsel 375; hasil di `shots/audit-popup/temuan.json`).
  Satu-satunya geser yang disengaja: kartu dokumen kunci di Regulasi (ponsel, carousel bernomor).
- Kalender (02-11-2026): tombol "Tambahkan ke Kalender" (agenda + Kegiatan Saya) membuka `ui.addToCalendar` (core.js): Google Calendar
  (`calendar.google.com/calendar/render?action=TEMPLATE`), Outlook (`outlook.live.com/.../compose?rru=addevent`), atau Apple (.ics dibuka
  langsung di perangkat Apple; perangkat lain menyimpan .ics). Tidak lagi mengunduh berkas lebih dahulu.
- Desain (02-11-2026): 10 tema latar sertifikat (lanskap + potret) gaya referensi klien (putih, perancah pudar di sudut, garis emas
  tipis; klien minta "jangan norak") — `K().TEMA`, `temaBg`, `temaKecil`; disimpan sebagai `fields.tema = {id}`. Latar KTA baru
  (`assets/img/kta/latar-depan.jpg`, `latar-belakang.jpg`; CSS di anggota.css). Dibuat dengan OpenAI gpt-image-2 (`devtools/desain/`,
  kunci dari env `OPENAI_API_KEY`, jangan pernah dicetak/di-commit).
- Toko (02-11-2026): **ongkir JNE otomatis** — `devtools/ongkir/tarik-jne.mjs` menarik tarif JNE REG Bekasi (BKI10000) → ibu kota 38
  provinsi dari `jne.co.id/shipping-fee` (+ `api-destination`), menulis `site/assets/data/ongkir-jne.js`; pages.yml menjalankannya tiap
  Senin 01:17 UTC + setiap terbit (continue-on-error, data repo jadi cadangan). `T.ongkirJne(prov, gram)`; createOrder menghitung
  ulang (ongkirSumber `otomatis`), priceCheck membandingkan. J&T/TIKI ber-captcha → manual. TIKI URL benar: `tiki.id/id/cek-ongkir`.
  Logo kurir di `site/assets/img/kurir/`. Tombol **Konfirmasi via WhatsApp** (pesanan.html; wa.me/6281227280075 dari
  `contact.whatsapp`, pesan tersusun) + tawaran otomatis setelah bukti transfer dikirim.
- Toko (01-11-2026, lanjutan 2): berbagi produk (Web Share + foto, WhatsApp, salin teks); invoice PDF (pembeli & admin) dan
  ringkasan transaksi PDF (pembeli: semua pesanannya; admin: rentang tanggal) — `T.invoicePdf`, `T.ringkasanPdf`, jsPDF lokal.
  URL kurir: J&T `jet.co.id/rates`, TIKI `tiki.id/id/tariff`, Pos `posindonesia.co.id/id/check-tarif` (dari sumber pihak ketiga; minta klien uji).
- Toko (01-11-2026, lanjutan): bukti transfer = **foto diunggah langsung** (JPEG ≤ ±300 KB) ke `orders/{no}/bukti/foto`
  (baca: pemilik + admin; tulis: pemilik selama belum dibayar); `pembayaran.bukti = 'foto'` (tautan https lama tetap terbaca).
  Tombol JNE → `jne.co.id/shipping-fee?origin=BKI10000&weight={berat}` (asal Bekasi + berat terisi). **Perlu Publish aturan.**
- Toko (01-11-2026): mode `konfirmasi` kini = **ongkir diisi pembeli** (wajib, ≥ Rp1.000) setelah cek tarif di situs kurir
  (tombol JNE/J&T/TIKI/Pos; `config.js` › `toko.asalKirim` = Jakasetia, Bekasi Selatan, Kota Bekasi; `toko.kurir` = URL cek tarif;
  URL TIKI belum terkonfirmasi). Pesanan menyimpan `ringkasan.ongkirSumber='pembeli'`, `ongkirKurir`; admin melihat kotak periksa
  dan dapat Ubah Ongkir. Tanpa perubahan aturan Firestore.
- Toko (30-10-2026): ongkir mode `tabel` (`shop_settings/main.ongkirTabel` = tarif Rp/kg per provinsi, toleransi gram) + `products.berat`
  (gram/unit). Tarif kurir belum diisi: situs kurir (jne.co.id dll.) diblokir jaringan sesi; isi dari cek tarif resmi.
  Tombol **Impor Tabel Tarif** (31-10-2026, Toko › Pengaturan, JSON `ppapi-toko-ongkir`, ditolak utuh bila ada provinsi/tarif/tanggal
  tidak sah; uji di `devtools/flows/toko-flow.mjs` bagian 8). Templat `daftar_kurir.json` (31-10-2026, JNE REG dari **Parung**) sudah
  usang sejak asal kirim pindah ke Bekasi dan JNE otomatis (02-11-2026); jangan diimpor kecuali klien sengaja meninggalkan mode JNE otomatis.
  Pengaman (02-11-2026): tarif < Rp1.000/kg ditolak di impor (`56.000` tanpa kutip terbaca 56 → "terbaca 56") dan formulir manual;
  konfirmasi impor mengingatkan bahwa mode tabel menonaktifkan JNE otomatis + isian pembeli. Berat estimasi: kaos 200 g,
  CoP cetak 600 g. CoP versi cetak Rp200.000 (paket `toko-ppapi-pembaruan-2026-10-30.json` diserahkan ke klien).
- Toko (30-10-2026): biaya tambahan varian (`varian[i].tambahan`, ditulis "XXL +5000" di formulir; dihitung di keranjang,
  pesanan, dan priceCheck). Paket `kaos-ppapi-5-desain.json` (id `kaos-*`, KAOS_001–005, XXL +Rp5.000) diserahkan ke klien.
- Toko (30-10-2026): tombol Impor Produk (JSON `ppapi-toko-produk`) di Konsol Admin › Toko › Produk. Paket 5 kaus PPAPI
  (Ratchet Master, Coupler Crew, Falsework, Torque Society, Rise Up; Rp120.000; katun combed 30s; sablon rubber) diserahkan
  ke klien untuk diimpor; ukuran S–XXL dan stok tak terbatas adalah asumsi, konfirmasi klien.
- Toko (30-10-2026, lanjutan): foto produk utuh (object-fit contain, galeri ikut rasio asli) + tanda air PPAPI saat unggah.
  Soft file kini dapat diunggah ke situs (`product_files/{id}/parts/{n}`, ≤ 900 KB/dokumen, maks. 30 MB) dan setiap unduhan
  dibubuhi tanda air pembeli + dienkripsi AES-128 (kata sandi = email pembeli, izin ubah/salin ditutup, cetak boleh) dengan
  `assets/vendor/pdf-lib-cantoo-2.8.4.min.js` (wajib `useObjectStreams: true`). Produk CoP: PPAPI-CoP-01:2026 Seri Lengkap
  8 bagian (183 hlm., Rp150.000), paket impor diserahkan ke klien; berkas PDF CoP **jangan** dimasukkan ke repositori.
- Fitur: keanggotaan + Konsol Admin, Produk Pengetahuan, regulasi, 12 artikel, aplikasi anggota (data melekat ke
  akun), direktori instruktur, kegiatan (daftar hadir otomatis + sertifikat), toko & pesanan.

## Pekerjaan tertunda
- Record email Firebase di DNS Hostinger terhapus saat email Hostinger diaktifkan → pasang ulang: SPF gabungan
  `v=spf1 include:_spf.mail.hostinger.com include:_spf.firebasemail.com ~all`, TXT `firebase=ppapi-web`, CNAME
  `firebase1._domainkey` → `mail-ppapi-or-id.dkim1._domainkey.firebasemail.com`, `firebase2._domainkey` →
  `mail-ppapi-or-id.dkim2._domainkey.firebasemail.com`; lalu Verify di Firebase → Authentication → Templates.
  Ganti juga *Public-facing name* proyek menjadi `PPAPI`.
- Kebijakan Privasi: mutakhirkan (data aplikasi anggota kini tersimpan di akun/Firestore, plus data kegiatan & pesanan).
- **Publish ulang `site/firestore.rules`** (24-10-2026: Mitra Korporat dihapus; 27-10-2026: flyer kegiatan; 28-10-2026:
  `cert_settings` penanda tangan sertifikat; 30-10-2026: `product_files/{id}/parts` berkas PDF toko, `berat` produk & `ongkirTabel`; 01-11-2026: `orders/{no}/bukti` foto bukti transfer; 05-11-2026: `member_files` berkas pendukung anggota; tanpa publish, unggah
  flyer/tanda tangan/PDF di Mode Firebase ditolak `permission-denied`).
- Data dari klien: nomor & tanggal Keputusan Pengurus penetapan Kode Etik, **ART final yang disahkan Rapat Umum Anggota** (draf "AD-ART rev 01"
  tahun 2020 belum layak terbit: isian kosong, sisa teks organisasi lain, tidak selaras dengan akta), salinan
  KEP-74/PPK/XII/2013, jawaban 11 pertanyaan Komite Teknis.
- Review menyeluruh bahasa (KBBI/humanis), fungsi, dan tampilan seluruh halaman.
