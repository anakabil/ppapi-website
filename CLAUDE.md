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
- Fitur: keanggotaan + Konsol Admin, Produk Pengetahuan, regulasi, 9 artikel, aplikasi anggota (data melekat ke
  akun), direktori instruktur, kegiatan (daftar hadir otomatis + sertifikat), toko & pesanan.

## Pekerjaan tertunda
- Record email Firebase di DNS Hostinger terhapus saat email Hostinger diaktifkan → pasang ulang: SPF gabungan
  `v=spf1 include:_spf.mail.hostinger.com include:_spf.firebasemail.com ~all`, TXT `firebase=ppapi-web`, CNAME
  `firebase1._domainkey` → `mail-ppapi-or-id.dkim1._domainkey.firebasemail.com`, `firebase2._domainkey` →
  `mail-ppapi-or-id.dkim2._domainkey.firebasemail.com`; lalu Verify di Firebase → Authentication → Templates.
  Ganti juga *Public-facing name* proyek menjadi `PPAPI`.
- Kebijakan Privasi: mutakhirkan (data aplikasi anggota kini tersimpan di akun/Firestore, plus data kegiatan & pesanan).
- **Publish ulang `site/firestore.rules`** (24-10-2026: Mitra Korporat dihapus dari daftar kategori).
- Data dari klien: telepon/email sekretariat, Kode Etik, **ART final yang disahkan Rapat Umum Anggota** (draf "AD-ART rev 01"
  tahun 2020 belum layak terbit: isian kosong, sisa teks organisasi lain, tidak selaras dengan akta), salinan
  KEP-74/PPK/XII/2013, jawaban 11 pertanyaan Komite Teknis.
- Review menyeluruh bahasa (KBBI/humanis), fungsi, dan tampilan seluruh halaman.
