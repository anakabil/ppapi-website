# Toko PPAPI — bagian README (untuk digabung ke site/README.md)

## Ringkasan
- **toko.html** — katalog (Suvenir, Pakaian, Aksesori, Klem & Komponen Perancah, Produk Pengetahuan). Katalog dimulai kosong; produk ditambahkan sekretariat di **Konsol Admin › Toko › Produk**.
- **keranjang.html** — keranjang (tersimpan di peramban; untuk akun yang masuk juga tersinkron ke Firestore `carts/{uid}`), alamat pengiriman untuk barang fisik/cetak, ringkasan, buat pesanan (wajib masuk, status keanggotaan apa pun). Anggota berstatus **Aktif** mendapat harga anggota bila diisi.
- **pesanan.html** — Pesanan Saya: status, instruksi transfer, kirim bukti bayar (tautan https), batalkan selama belum dibayar, resi pengiriman, unduh soft file bertanda air.

## Alur pembayaran (transfer bank manual)
Menunggu Pembayaran → (pembeli mengirim bukti) Menunggu Konfirmasi → (sekretariat mengonfirmasi) Dibayar → Diproses → Dikirim (kurir + resi) → Selesai. Dibatalkan: oleh pembeli selama belum dibayar, atau oleh sekretariat sebelum dikirim (hak unduh dicabut, stok dikembalikan; pengembalian dana dilakukan di luar sistem).
- Rekening, mode ongkos kirim (dikonfirmasi per pesanan atau tarif tetap), petunjuk pembayaran, dan kontak diatur di **Toko › Pengaturan**. Rekening kosong → pembeli melihat "Informasi rekening akan diumumkan sekretariat".
- Bila ongkos kirim "dikonfirmasi sekretariat", tetapkan ongkir di detail pesanan sebelum mengonfirmasi pembayaran (sistem menolak konfirmasi sebelum total final).
- Harga dicatat oleh peramban pembeli. Sebelum konfirmasi, detail pesanan di konsol menampilkan peringatan bila harga/total berbeda dengan katalog atau bila harga anggota dipakai oleh pembeli yang tidak lagi Aktif. **Periksa mutasi rekening sebelum menekan "Konfirmasi Pembayaran".**
- Stok barang fisik dan cetak berkurang otomatis saat pembayaran dikonfirmasi (bukan saat checkout).

## Soft file: tautan privat + tanda air
- Tautan berkas disimpan terpisah di `product_files/{id}` dan hanya dapat dibaca admin atau pembeli yang memiliki `entitlements/{uid}_{id}` — dokumen ini ditulis admin saat mengonfirmasi pembayaran.
- Saat pembeli menekan **Unduh berkas**, peramban mengambil PDF dari tautan tersebut, membubuhkan tanda air (nama, email, nomor pesanan, tanggal) pada **setiap halaman** dengan pdf-lib 1.17.1 (cdnjs, SRI; cadangan jsDelivr), lalu menyimpan berkas hasilnya.
- **Batasan yang perlu dipahami (jujur):**
  1. Tanda air adalah pencegah penyebaran dan penanda asal, **bukan DRM/enkripsi**. Pembeli tetap menerima PDF utuh; berkas tidak dikunci kata sandi (pdf-lib tidak dapat mengenkripsi PDF). Unggah PDF **tanpa kata sandi** — PDF terenkripsi tidak dapat dibubuhi tanda air.
  2. Tautan sumber pada akhirnya diketahui peramban pembeli yang berhak (terlihat di alat pengembang). Siapa pun yang memegang tautan itu dapat mengunduh berkas **tanpa** tanda air. Kerahasiaan sepenuhnya bergantung pada hosting.
  3. Agar tanda air dapat dibubuhkan otomatis, hosting harus (a) mengirim berkas PDF langsung (bukan halaman pratinjau) dan (b) mengizinkan CORS (`Access-Control-Allow-Origin` untuk domain situs). **Tautan Google Drive biasa tidak memenuhi syarat ini** (pratinjau HTML + tanpa CORS): pembeli kemudian diberi penjelasan dan tombol "Buka tautan berkas" — berkas yang dibuka dengan cara ini **tidak** bertanda air.
- **Pilihan hosting:**
  | Hosting | CORS / tanda air otomatis | Privasi tautan |
  | --- | --- | --- |
  | Google Drive "siapa saja yang memiliki link" | Tidak (fallback buka tautan, tanpa tanda air) | Tautan sulit ditebak, tetapi dapat diteruskan |
  | Rilis/aset GitHub publik, folder situs ini | Ya (GitHub Pages/raw) | **Tidak privat** — siapa pun yang tahu/menebak alamatnya dapat mengunduh; jangan dipakai untuk dokumen berbayar |
  | Bucket penyimpanan objek (mis. Cloudflare R2, Backblaze B2, AWS S3) dengan nama berkas acak panjang + aturan CORS untuk domain situs | Ya | Cukup baik untuk kebutuhan ini (tautan rahasia; dapat diganti berkala) |
  | Tautan bertanda tangan berumur pendek (signed URL) | Ya | Terbaik, tetapi memerlukan server/fungsi (Cloud Functions — paket Blaze), di luar cakupan situs statis |
  Rekomendasi: bucket objek dengan CORS dan nama berkas acak; ganti tautan bila diduga bocor (cukup ubah di Konsol › Produk).

## Firestore
Tempel `devtools/rules-fragments/toko.rules` ke `site/firestore.rules` (di dalam `match /databases/{database}/documents`, sebelum `match /{document=**}`), lalu Publish. Tidak memerlukan indeks komposit (kueri: `products where aktif == true`, `orders where uid == …`).
Mode Demo: semua data toko tersimpan di localStorage peramban (`ppapi_toko_*`).
