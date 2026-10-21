// Toko PPAPI — Firestore rules stub test (no network, no emulator).  node devtools/flows/toko-rules.mjs
// A JavaScript MIRROR of devtools/rules-fragments/toko.rules (same conditions, same whitelists) is
// evaluated against the request shapes store-toko.js sends. Proves the intended allow/deny matrix,
// above all: a buyer WITHOUT a confirmed payment (no entitlements/{uid}_{id}) cannot read product_files.
// Cannot prove Google's parser accepts the file — publish it in the Firebase console to confirm.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.resolve(__dirname, '..', 'rules-fragments', 'toko.rules'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } };

/* ---- static checks on the fragment ---- */
const bal = (o, c) => SRC.split(o).length === SRC.split(c).length;
ok(bal('{', '}') && bal('(', ')') && bal('[', ']'), 'kurung seimbang di toko.rules');
['products', 'product_media', 'product_files', 'entitlements', 'orders', 'shop_settings', 'carts'].forEach(c => ok(SRC.includes(`match /${c}/{`), `blok match /${c}`));
ok(/product_files[\s\S]*?allow get: if signedIn\(\)\s*&& \(exists\(\/databases\/\$\(database\)\/documents\/entitlements\/\$\(request\.auth\.uid \+ '_' \+ id\)\)/.test(SRC), 'product_files: satu exists() pada entitlements/{uid}_{id}');
ok(!/get\(\/databases/.test(SRC), 'tanpa get() dokumen tambahan (anggaran evaluasi hemat)');

/* ---- mirror ---- */
const NOW = Symbol('request.time');
const db = new Map();
const admins = new Set(['adm']);
const exists = (p) => db.has(p);
const signedIn = (a) => !!a;
const isAdmin = (a) => signedIn(a) && admins.has(a.uid);
const strMax = (v, m) => v == null || v === '' || (typeof v === 'string' && v.length <= m);
const listMax = (v, m) => v == null || (Array.isArray(v) && v.length <= m);
const hasOnly = (keys, allowed) => keys.every(k => allowed.includes(k));
const UNPAID = ['Menunggu Pembayaran', 'Menunggu Konfirmasi'];
const STATUS = ['Menunggu Pembayaran', 'Menunggu Konfirmasi', 'Dibayar', 'Diproses', 'Dikirim', 'Selesai', 'Dibatalkan'];
const affected = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k]));

const rules = {
  product_files_get: (auth, id) => signedIn(auth) && (exists(`entitlements/${auth.uid}_${id}`) || isAdmin(auth)),
  product_files_write: (auth, d) => isAdmin(auth) && hasOnly(Object.keys(d), ['url', 'updatedAt', 'updatedBy']) && typeof d.url === 'string' && d.url.length <= 1000 && d.updatedBy === auth.uid,
  entitlement_write: (auth, eid, d) => isAdmin(auth) && hasOnly(Object.keys(d), ['uid', 'productId', 'orderId', 'grantedAt', 'grantedBy']) && eid === d.uid + '_' + d.productId && d.grantedBy === auth.uid,
  products_read: (auth, r) => r.aktif === true || isAdmin(auth),
  order_read: (auth, r) => signedIn(auth) && (r.uid === auth.uid || isAdmin(auth)),
  order_create: (auth, id, d) => signedIn(auth)
    && hasOnly(Object.keys(d), ['id', 'uid', 'buyer', 'items', 'perluKirim', 'alamat', 'ringkasan', 'status', 'hargaAnggota', 'catatan', 'riwayat', 'createdAt', 'updatedAt'])
    && /^PSN-[0-9]{8}-[A-Z0-9]{5}$/.test(id) && d.id === id && d.uid === auth.uid && d.status === 'Menunggu Pembayaran'
    && Array.isArray(d.items) && d.items.length >= 1 && d.items.length <= 30
    && d.ringkasan && Number.isInteger(d.ringkasan.total) && d.ringkasan.total >= 0
    && typeof d.buyer === 'object' && typeof d.perluKirim === 'boolean' && (d.alamat == null || typeof d.alamat === 'object')
    && strMax(d.catatan ?? '', 500) && listMax(d.riwayat, 40) && d.createdAt === NOW && d.updatedAt === NOW,
  order_update: (auth, after, before) => {
    if (!signedIn(auth)) return false;
    const owner = before.uid === auth.uid && (() => {
      const ch = affected(after, before);
      if (!UNPAID.includes(before.status) || after.updatedAt !== NOW || !listMax(after.riwayat, 40)) return false;
      if (after.status === 'Menunggu Konfirmasi') {
        const p = after.pembayaran || {};
        return hasOnly(ch, ['pembayaran', 'status', 'riwayat', 'updatedAt']) && hasOnly(Object.keys(p), ['buktiUrl', 'tanggal', 'jumlah', 'pengirim', 'catatan', 'dikirimAt'])
          && typeof p.buktiUrl === 'string' && p.buktiUrl.length <= 1000 && /^https:\/\/.+/.test(p.buktiUrl) && Number.isInteger(p.jumlah) && p.jumlah > 0 && strMax(p.catatan ?? '', 500);
      }
      if (after.status === 'Dibatalkan') return hasOnly(ch, ['status', 'riwayat', 'updatedAt', 'alasanBatal', 'dibatalkanOleh']) && after.dibatalkanOleh === 'pembeli' && strMax(after.alasanBatal ?? '', 500);
      return false;
    })();
    return owner || (isAdmin(auth) && STATUS.includes(after.status) && after.uid === before.uid && after.id === before.id);
  },
  carts_write: (auth, uid, d) => signedIn(auth) && auth.uid === uid && hasOnly(Object.keys(d), ['items', 'updatedAt']) && Array.isArray(d.items) && d.items.length <= 30,
};

const buyer = { uid: 'buyer1' }, other = { uid: 'buyer2' }, admin = { uid: 'adm' };
const id = 'PSN-20261021-ABCDE';
const order = { id, uid: 'buyer1', buyer: { name: 'Uji' }, items: [{ productId: 'cop-01', format: 'soft', qty: 1, harga: 150000, subtotal: 150000 }], perluKirim: false, alamat: null,
  ringkasan: { subtotal: 150000, ongkir: 0, ongkirFinal: true, total: 150000 }, status: 'Menunggu Pembayaran', hargaAnggota: false, catatan: '', riwayat: [], createdAt: NOW, updatedAt: NOW };
db.set('product_files/cop-01', { url: 'https://contoh/berkas.pdf' });

console.log('\nproduct_files');
ok(!rules.product_files_get(buyer, 'cop-01'), 'pembeli BELUM dibayar → baca product_files DITOLAK');
ok(!rules.product_files_get(null, 'cop-01'), 'pengunjung tanpa akun → ditolak');
ok(rules.product_files_get(admin, 'cop-01'), 'admin → diizinkan');
ok(rules.product_files_write(admin, { url: 'https://x/y.pdf', updatedAt: NOW, updatedBy: 'adm' }), 'admin menulis tautan berkas');
ok(!rules.product_files_write(buyer, { url: 'https://x/y.pdf', updatedAt: NOW, updatedBy: 'buyer1' }), 'pembeli tidak dapat menulis tautan berkas');
ok(!rules.entitlement_write(buyer, 'buyer1_cop-01', { uid: 'buyer1', productId: 'cop-01', orderId: id, grantedAt: NOW, grantedBy: 'buyer1' }), 'pembeli tidak dapat memberi dirinya hak unduh');
ok(!rules.entitlement_write(admin, 'buyer2_cop-01', { uid: 'buyer1', productId: 'cop-01', orderId: id, grantedAt: NOW, grantedBy: 'adm' }), 'id hak unduh harus {uid}_{produk}');
ok(rules.entitlement_write(admin, 'buyer1_cop-01', { uid: 'buyer1', productId: 'cop-01', orderId: id, grantedAt: NOW, grantedBy: 'adm' }), 'admin memberi hak unduh saat konfirmasi');
db.set('entitlements/buyer1_cop-01', { uid: 'buyer1' });
ok(rules.product_files_get(buyer, 'cop-01'), 'pembeli SUDAH dikonfirmasi → diizinkan');
ok(!rules.product_files_get(other, 'cop-01'), 'pembeli lain → tetap ditolak');
db.delete('entitlements/buyer1_cop-01');
ok(!rules.product_files_get(buyer, 'cop-01'), 'hak unduh dicabut (pembatalan) → ditolak lagi');

console.log('\norders');
ok(rules.order_create(buyer, id, order), 'pembeli membuat pesanan sendiri');
ok(!rules.order_create(buyer, id, { ...order, uid: 'buyer2' }), 'membuat pesanan atas nama orang lain → ditolak');
ok(!rules.order_create(buyer, id, { ...order, status: 'Dibayar' }), 'membuat pesanan langsung "Dibayar" → ditolak');
ok(!rules.order_create(buyer, id, { ...order, pembayaran: { buktiUrl: 'https://x' } }), 'kunci di luar daftar (pembayaran) saat membuat → ditolak');
ok(!rules.order_create(buyer, 'x123', { ...order, id: 'x123' }), 'format nomor pesanan wajib PSN-YYYYMMDD-XXXXX');
const stored = { ...order, createdAt: 'T0', updatedAt: 'T0' };
ok(rules.order_read(buyer, stored) && !rules.order_read(other, stored) && rules.order_read(admin, stored), 'baca: pemilik & admin saja');
const pay = { ...stored, status: 'Menunggu Konfirmasi', pembayaran: { buktiUrl: 'https://drive.google.com/x', tanggal: '2026-10-21', jumlah: 150000, pengirim: 'Uji', catatan: '', dikirimAt: 'T' }, riwayat: [{}], updatedAt: NOW };
ok(rules.order_update(buyer, pay, stored), 'pemilik mengirim bukti bayar');
ok(!rules.order_update(buyer, { ...pay, pembayaran: { ...pay.pembayaran, buktiUrl: 'javascript:alert(1)' } }, stored), 'bukti harus https://');
ok(!rules.order_update(buyer, { ...pay, ringkasan: { ...stored.ringkasan, total: 1 } }, stored), 'pemilik tidak dapat mengubah total');
ok(!rules.order_update(buyer, { ...stored, status: 'Dibayar', updatedAt: NOW }, stored), 'pemilik tidak dapat menandai Dibayar');
ok(!rules.order_update(other, pay, stored), 'orang lain tidak dapat mengirim bukti');
const paid = { ...stored, status: 'Dibayar' };
ok(!rules.order_update(buyer, { ...paid, status: 'Dibatalkan', dibatalkanOleh: 'pembeli', updatedAt: NOW }, paid), 'pemilik tidak dapat membatalkan pesanan yang sudah dibayar');
ok(rules.order_update(buyer, { ...stored, status: 'Dibatalkan', dibatalkanOleh: 'pembeli', alasanBatal: 'salah pilih', riwayat: [{}], updatedAt: NOW }, stored), 'pemilik membatalkan selama belum dibayar');
ok(rules.order_update(admin, { ...pay, status: 'Dibayar', updatedAt: NOW }, pay), 'admin mengonfirmasi pembayaran');
ok(!rules.order_update(admin, { ...pay, status: 'Lunas' }, pay), 'admin: status harus salah satu dari 7 status');

console.log('\nproducts & carts');
ok(rules.products_read(null, { aktif: true }) && !rules.products_read(null, { aktif: false }) && rules.products_read(admin, { aktif: false }), 'produk: publik hanya yang aktif; admin semua');
ok(rules.carts_write(buyer, 'buyer1', { items: [], updatedAt: NOW }) && !rules.carts_write(buyer, 'buyer2', { items: [], updatedAt: NOW }), 'keranjang: hanya milik sendiri');

console.log(`\n${pass} lulus, ${fail} gagal`);
process.exit(fail ? 1 : 0);
