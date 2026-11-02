/* ==========================================================================
   PPAPI — store-toko.js · PPAPI.toko (Toko PPAPI: katalog, keranjang, pesanan)
   Dimuat SETELAH store.js:  config → core → auth → store → store-toko → pages/<halaman>.js

   Mode Firebase (Firestore) ↔ Mode Demo (localStorage peramban ini):
     products/{id}            ppapi_toko_products {id: produk}     dibaca publik bila aktif; ditulis admin
     product_media/{id}       ppapi_toko_media    {id: {foto[]}}   foto ukuran penuh (≤3 × ±150 KB)
     product_files/{id}       ppapi_toko_files    {id: {url}}      tautan PRIVAT soft file — admin atau
                                                                   pembeli yang memiliki hak unduh; atau
                                                                   berkas PDF yang diunggah ke situs:
                                                                   {parts, size, fileName} + potongan
     product_files/{id}/parts/{i}  IndexedDB ppapi_toko_berkas    {b: Bytes ≤ 900 KB} (aturan akses sama)
     entitlements/{uid}_{id}  ppapi_toko_entitlements              hak unduh, ditulis admin saat
                                                                   mengonfirmasi pembayaran
     orders/{no}              ppapi_toko_orders   {no: pesanan}    pemilik membuat & membaca; pemilik
                                                                   hanya menambah bukti bayar / membatalkan
                                                                   selama belum dibayar; admin semua
     shop_settings/main       ppapi_toko_settings                  dibaca publik; ditulis admin
     carts/{uid}              ppapi_toko_cart_<uid> (tamu: ppapi_toko_cart)

   Aturan Firestore: firestore.rules, blok TOKO PPAPI (sumber: devtools/rules-fragments/toko.rules).
   Harga pada pesanan dihitung di peramban pembeli; Konsol Admin membandingkannya dengan
   katalog (admin.priceCheck) sebelum pembayaran dikonfirmasi — aturan Firestore tidak
   dapat menghitung ulang harga dengan hemat.
   ========================================================================== */
(function (w) {
  'use strict';
  var PPAPI = w.PPAPI = w.PPAPI || {};

  var KATEGORI = ['Suvenir', 'Pakaian', 'Aksesori', 'Klem & Komponen Perancah', 'Produk Pengetahuan'];
  var KATEGORI_INFO = {
    'Suvenir': { icon: 'award', slug: 'suvenir', desc: 'Cendera mata resmi PPAPI untuk anggota, mitra, dan tamu kegiatan.' },
    'Pakaian': { icon: 'user', slug: 'pakaian', desc: 'Kaos, kemeja, dan rompi kerja dengan identitas PPAPI.' },
    'Aksesori': { icon: 'bookmark', slug: 'aksesori', desc: 'Perlengkapan pendukung kerja dan keseharian para praktisi.' },
    'Klem & Komponen Perancah': { icon: 'wrench', slug: 'klem', desc: 'Klem (coupler) dan komponen perancah untuk pelatihan maupun lapangan.' },
    'Produk Pengetahuan': { icon: 'book', slug: 'pengetahuan', desc: 'CoP, pedoman, standar, dan modul — soft file bertanda air atau versi cetak.' }
  };
  var STATUS = ['Menunggu Pembayaran', 'Menunggu Konfirmasi', 'Dibayar', 'Diproses', 'Dikirim', 'Selesai', 'Dibatalkan'];
  var UNPAID = ['Menunggu Pembayaran', 'Menunggu Konfirmasi'];
  var PAID = ['Dibayar', 'Diproses', 'Dikirim', 'Selesai'];
  var STATUS_TONE = {
    'Menunggu Pembayaran': 'warn', 'Menunggu Konfirmasi': 'warn', 'Dibayar': 'ok', 'Diproses': 'ok',
    'Dikirim': 'ok', 'Selesai': 'ok', 'Dibatalkan': 'err'
  };
  var STATUS_TEXT = {
    'Menunggu Pembayaran': 'Silakan transfer sesuai total pesanan, lalu kirim bukti pembayaran.',
    'Menunggu Konfirmasi': 'Bukti pembayaran sudah diterima dan sedang diperiksa sekretariat.',
    'Dibayar': 'Pembayaran telah dikonfirmasi sekretariat.',
    'Diproses': 'Pesanan sedang disiapkan oleh sekretariat.',
    'Dikirim': 'Pesanan dalam pengiriman.',
    'Selesai': 'Pesanan telah selesai.',
    'Dibatalkan': 'Pesanan dibatalkan.'
  };
  var FORMAT_LABEL = { soft: 'Soft file (PDF)', cetak: 'Cetak (hardcopy)', fisik: '' };
  var LIMITS = { cartLines: 30, qty: 99, varianGroups: 2, varianOpsi: 12, foto: 3, fotoKB: 150, thumbKB: 40, rekening: 3, orderItems: 30 };
  var K = {
    products: 'ppapi_toko_products', media: 'ppapi_toko_media', files: 'ppapi_toko_files',
    ent: 'ppapi_toko_entitlements', orders: 'ppapi_toko_orders', settings: 'ppapi_toko_settings',
    cartGuest: 'ppapi_toko_cart', cartUser: 'ppapi_toko_cart_'
  };
  /* @cantoo/pdf-lib (turunan pdf-lib dengan dukungan enkripsi). Salinan lokal lebih dahulu,
     cadangan jsDelivr dengan SRI berkas yang sama. */
  var PDFLIB = [
    { src: 'assets/vendor/pdf-lib-cantoo-2.8.4.min.js', integrity: '' },
    { src: 'https://cdn.jsdelivr.net/npm/@cantoo/pdf-lib@2.8.4/dist/pdf-lib.min.js',
      integrity: 'sha384-yaorLZ/dLXTpJKYcZnny8799jIuI4tRXRs+x1RYdAozyawLvwsHPMRh4OpoXUz7w' }
  ];
  var PART_BYTES = 900 * 1024, MAX_PDF = 30 * 1024 * 1024;

  /* ---------------------------------------------------------------- helpers */
  function U() { return PPAPI.util || {}; }
  function err(code, message, cause) { var e = new Error(message); e.code = code; if (cause) e.cause = cause; return e; }
  function mapFs(e) {
    if (e && e.code && /^(toko|store)\//.test(e.code)) return e;
    var code = e && e.code ? String(e.code).replace(/^firestore\//, '') : '';
    var msg = {
      'permission-denied': 'Akses ditolak. Pastikan Anda telah masuk dan tindakan ini diizinkan untuk akun Anda.',
      'unauthenticated': 'Sesi Anda telah berakhir. Silakan masuk kembali.',
      'unavailable': 'Layanan data sedang tidak dapat dihubungi. Periksa koneksi internet Anda, lalu coba lagi.',
      'not-found': 'Data tidak ditemukan.',
      'invalid-argument': 'Data yang dikirim tidak valid. Periksa kembali isian Anda.',
      'resource-exhausted': 'Batas pemakaian layanan data sedang tercapai. Silakan coba lagi nanti.'
    }[code] || 'Gagal memproses data toko. Silakan coba lagi.';
    return err('toko/' + (code || 'unknown'), msg, e);
  }
  function local() { return !PPAPI.store || PPAPI.store.mode !== 'firebase'; }
  async function fx() {
    var f = PPAPI.auth && PPAPI.auth._firebase ? await PPAPI.auth._firebase() : null;
    if (!f) throw err('toko/unavailable', 'Layanan data belum siap. Muat ulang halaman, lalu coba lagi.');
    return f;
  }
  function serverTs(f) { return f.fb.firestore.FieldValue.serverTimestamp(); }
  function ls(key, fb) { try { var r = w.localStorage.getItem(key); return r === null ? fb : JSON.parse(r); } catch (e) { return fb; } }
  function lsSet(key, v) {
    try { w.localStorage.setItem(key, JSON.stringify(v)); }
    catch (e) { throw err('toko/quota', 'Penyimpanan peramban penuh. Kurangi jumlah/ukuran foto atau hapus data situs, lalu coba lagi.', e); }
  }
  function lsMap(key) { var m = ls(key, {}); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; }
  function me() { return PPAPI.auth && PPAPI.auth.current ? PPAPI.auth.current() : null; }
  function session() { return PPAPI.session && PPAPI.session.current ? PPAPI.session.current() : {}; }
  async function isAdmin() {
    if (!me()) return false;
    try { return PPAPI.auth && PPAPI.auth.isAdmin ? !!(await PPAPI.auth.isAdmin()) : false; } catch (e) { return false; }
  }
  async function requireAdmin() {
    var u = me();
    if (!u || !(await isAdmin())) throw err('toko/forbidden', 'Tindakan ini khusus admin PPAPI.');
    return { uid: u.uid, name: u.name || u.email || 'Admin' };
  }
  function requireUser() {
    var u = me();
    if (!u) throw err('toko/no-user', 'Silakan masuk terlebih dahulu.');
    return u;
  }
  function nowIso() { return new Date().toISOString(); }
  function iso(v) {
    if (!v) return '';
    if (typeof v === 'string') return v;
    if (typeof v.toDate === 'function') { try { return v.toDate().toISOString(); } catch (e) { return ''; } }
    if (typeof v.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
    return '';
  }
  function str(v, max) { return v === null || v === undefined ? '' : String(v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max || 200); }
  function int(v, min, max) {
    if (v === null || v === undefined || v === '') return null;
    var n = typeof v === 'number' ? v : Number(String(v).replace(/[^\d-]/g, ''));
    if (!isFinite(n)) return null;
    n = Math.round(n);
    if (min !== undefined && n < min) n = min;
    if (max !== undefined && n > max) n = max;
    return n;
  }
  function httpsUrl(v) {
    var s = str(v, 1000);
    if (!/^https:\/\/[^\s<>"']+$/i.test(s)) return '';
    try { var u = new URL(s); return u.protocol === 'https:' ? u.href : ''; } catch (e) { return ''; }
  }
  function anyUrl(v) {   // http(s) — the test server and some hosts use http; https preferred
    var s = str(v, 1000);
    if (!/^https?:\/\/[^\s<>"']+$/i.test(s)) return '';
    try { var u = new URL(s); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (e) { return ''; }
  }
  function jpeg(v, maxChars) { var s = typeof v === 'string' ? v : ''; return /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s) && s.length <= maxChars ? s : ''; }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function rand(n) { var a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = ''; var buf = new Uint32Array(n); (w.crypto || w.msCrypto).getRandomValues(buf); for (var i = 0; i < n; i++) s += a[buf[i] % a.length]; return s; }
  function ymd(d) { d = d || new Date(); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); }
  function todayIso() { return U().todayIso ? U().todayIso() : new Date().toISOString().slice(0, 10); }
  function slug(s) { return (U().slugify ? U().slugify(s) : String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')).slice(0, 60); }

  /* ---------------------------------------------------------------- format */
  var rupiahFmt = null;
  function rupiah(n) {
    if (n === null || n === undefined || n === '' || !isFinite(Number(n))) return '—';
    try { rupiahFmt = rupiahFmt || new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }); return rupiahFmt.format(Number(n)).replace(/ /g, ' '); }
    catch (e) { return 'Rp ' + Math.round(Number(n)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  }
  function statusBadge(s) {
    var h = U().h || String;
    return '<span class="badge badge--' + (STATUS_TONE[s] || 'muted') + '" data-status="' + h(s) + '">' + h(s) + '</span>';
  }
  function varianLabel(v) {
    if (!v || typeof v !== 'object') return '';
    return Object.keys(v).filter(function (k) { return v[k]; }).map(function (k) { return k + ': ' + v[k]; }).join(' · ');
  }

  /* ---------------------------------------------------------------- products */
  function isKnowledge(p) { return !!p && p.kategori === 'Produk Pengetahuan'; }
  function formatsOf(p) {
    if (!isKnowledge(p)) return ['fisik'];
    var f = [];
    if (p.format && p.format.soft) f.push('soft');
    if (p.format && p.format.cetak) f.push('cetak');
    return f.length ? f : ['soft'];
  }
  function needsShipping(format) { return format !== 'soft'; }
  /** biaya tambahan varian, mis. Ukuran XXL +Rp5.000 (varian[i].tambahan = {opsi: rupiah}) */
  function surcharge(p, varian) {
    varian = varian || {};
    return (p.varian || []).reduce(function (n, g) { var t = g.tambahan || {}, v = varian[g.nama]; return n + (v && t[v] ? t[v] : 0); }, 0);
  }
  function priceFor(p, format, member, varian) {
    var cetak = isKnowledge(p) && format === 'cetak';
    var normal = cetak ? p.hargaCetak : p.harga;
    var ang = cetak ? p.hargaCetakAnggota : p.hargaAnggota;
    if (normal === null || normal === undefined) normal = p.harga || 0;
    var add = surcharge(p, varian);
    normal += add; if (ang !== null && ang !== undefined) ang += add;
    var use = !!member && ang !== null && ang !== undefined && ang < normal;
    return { harga: use ? ang : normal, normal: normal, anggota: use, hargaAnggota: ang === undefined ? null : ang, tambahan: add };
  }
  function fromPrice(p, member) {
    var list = formatsOf(p).map(function (f) { return priceFor(p, f, member); });
    list.sort(function (a, b) { return a.harga - b.harga; });
    return { min: list[0], many: list.length > 1 && list[0].harga !== list[list.length - 1].harga };
  }
  function inStock(p, format) {
    if (format === 'soft') return true;
    return p.stok === null || p.stok === undefined || p.stok > 0;
  }
  function stockLeft(p, format) { return format === 'soft' || p.stok === null || p.stok === undefined ? Infinity : p.stok; }

  function sanitizeProduct(raw, id) {
    raw = raw || {};
    var p = {
      id: id || str(raw.id, 60),
      nama: str(raw.nama, 120),
      kategori: KATEGORI.indexOf(raw.kategori) !== -1 ? raw.kategori : '',
      kode: str(raw.kode, 40),
      ringkasan: str(raw.ringkasan, 300),
      deskripsi: str(raw.deskripsi, 4000),
      harga: int(raw.harga, 0, 1e9),
      hargaAnggota: int(raw.hargaAnggota, 0, 1e9),
      format: null, hargaCetak: null, hargaCetakAnggota: null, halaman: null,
      stok: int(raw.stok, 0, 1e6),
      berat: int(raw.berat, 0, 100000),   // gram per unit (barang fisik / versi cetak)
      varian: [],
      thumb: jpeg(raw.thumb, 60000),
      fotoCount: int(raw.fotoCount, 0, LIMITS.foto) || 0,
      berkasAda: raw.berkasAda === true,
      aktif: raw.aktif !== false,
      unggulan: raw.unggulan === true,
      urutan: int(raw.urutan, 0, 9999) || 0,
      createdAt: iso(raw.createdAt), updatedAt: iso(raw.updatedAt)
    };
    if (p.harga === null) p.harga = 0;
    if (p.kategori === 'Produk Pengetahuan') {
      var f = raw.format || {};
      p.format = { soft: f.soft !== false && f.soft !== undefined ? !!f.soft : !f.cetak, cetak: !!f.cetak };
      if (!p.format.soft && !p.format.cetak) p.format.soft = true;
      p.hargaCetak = int(raw.hargaCetak, 0, 1e9);
      p.hargaCetakAnggota = int(raw.hargaCetakAnggota, 0, 1e9);
      if (p.format.cetak && p.hargaCetak === null) p.hargaCetak = p.harga;
      p.halaman = int(raw.halaman, 0, 100000);
    } else {
      p.berkasAda = false;
    }
    (Array.isArray(raw.varian) ? raw.varian : []).slice(0, LIMITS.varianGroups).forEach(function (g) {
      var nama = str(g && g.nama, 30);
      /* pilihan dapat ditulis "XXL +5000" (biaya tambahan) atau memakai g.tambahan */
      var tambahan = {}, rawT = (g && g.tambahan && typeof g.tambahan === 'object') ? g.tambahan : {};
      var opsi = (Array.isArray(g && g.opsi) ? g.opsi : String((g && g.opsi) || '').split(','))
        .map(function (o) {
          var m = /^(.*?)\s*\+\s*(?:Rp\.?\s*)?([\d.]+)\s*$/i.exec(String(o || ''));
          var name = str(m ? m[1] : o, 30);
          if (m && name) tambahan[name] = Number(m[2].replace(/\./g, ''));
          return name;
        }).filter(Boolean);
      opsi = opsi.filter(function (o, i) { return opsi.indexOf(o) === i; }).slice(0, LIMITS.varianOpsi);
      opsi.forEach(function (o) { if (!tambahan[o] && rawT[o]) tambahan[o] = rawT[o]; });
      var tb = {};
      opsi.forEach(function (o) { var v = int(tambahan[o], 0, 1e8); if (v) tb[o] = v; });
      if (nama && opsi.length) p.varian.push(Object.keys(tb).length ? { nama: nama, opsi: opsi, tambahan: tb } : { nama: nama, opsi: opsi });
    });
    return p;
  }
  function sortProducts(list) {
    return list.sort(function (a, b) {
      if (!!b.unggulan !== !!a.unggulan) return b.unggulan ? 1 : -1;
      if ((a.urutan || 0) !== (b.urutan || 0)) return (a.urutan || 0) - (b.urutan || 0);
      return String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || a.nama.localeCompare(b.nama, 'id');
    });
  }

  var productCache = null;
  async function listProducts(opts) {
    opts = opts || {};
    var all = opts.includeInactive && (await isAdmin());
    var list;
    if (local()) {
      var m = lsMap(K.products);
      list = Object.keys(m).map(function (id) { return sanitizeProduct(m[id], id); });
    } else {
      var f = await fx();
      try {
        var q = all ? f.db.collection('products') : f.db.collection('products').where('aktif', '==', true);
        var snap = await q.get();
        list = snap.docs.map(function (d) { return sanitizeProduct(d.data(), d.id); });
      } catch (e) { throw mapFs(e); }
    }
    if (!all) list = list.filter(function (p) { return p.aktif && p.nama && p.kategori; });
    sortProducts(list);
    if (!all) productCache = list;
    return list;
  }
  async function getProduct(id) {
    if (!id) return null;
    if (local()) {
      var m = lsMap(K.products);
      if (!m[id]) return null;
      var p = sanitizeProduct(m[id], id);
      return p.aktif || (await isAdmin()) ? p : null;
    }
    var f = await fx();
    try {
      var s = await f.db.collection('products').doc(id).get();
      return s.exists ? sanitizeProduct(s.data(), id) : null;
    } catch (e) {
      if (e && /permission-denied/.test(e.code || '')) return null;   // inactive product, non-admin
      throw mapFs(e);
    }
  }
  async function getMedia(id) {
    if (!id) return [];
    var foto;
    if (local()) foto = (lsMap(K.media)[id] || {}).foto;
    else {
      var f = await fx();
      try { var s = await f.db.collection('product_media').doc(id).get(); foto = s.exists ? (s.data() || {}).foto : []; }
      catch (e) { throw mapFs(e); }
    }
    return (Array.isArray(foto) ? foto : []).map(function (x) { return jpeg(x, 210000); }).filter(Boolean).slice(0, LIMITS.foto);
  }

  /* ---------------------------------------------------------------- settings */
  var DEFAULT_SETTINGS = { rekening: [], ongkirMode: 'konfirmasi', ongkirFlat: null, ongkirCatatan: '', ongkirTabel: null, catatanPembayaran: '', batasBayarJam: 48, kontak: '' };
  /* Tabel tarif kurir per provinsi tujuan (rupiah per kg), diisi sekretariat dari situs resmi kurir.
     {kurir, asal, sumber, diperbarui, toleransi (gram), tarif: {Provinsi: rupiah/kg}} */
  function sanitizeTabel(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var prov = U().PROVINSI || [], tarif = {};
    Object.keys(raw.tarif || {}).forEach(function (k) { var v = int(raw.tarif[k], 0, 1e7); if (v && (!prov.length || prov.indexOf(k) !== -1)) tarif[k] = v; });
    var tol = int(raw.toleransi, 0, 900);
    return { kurir: str(raw.kurir, 60), asal: str(raw.asal, 80), sumber: str(raw.sumber, 200), diperbarui: str(raw.diperbarui, 10), toleransi: tol === null ? 300 : tol, tarif: tarif };
  }
  function sanitizeSettings(raw) {
    raw = raw || {};
    var s = {
      rekening: (Array.isArray(raw.rekening) ? raw.rekening : []).slice(0, LIMITS.rekening).map(function (r) {
        return { bank: str(r && r.bank, 60), nomor: str(r && r.nomor, 40).replace(/[^\d\s.-]/g, ''), atasNama: str(r && r.atasNama, 120) };
      }).filter(function (r) { return r.bank && r.nomor && r.atasNama; }),
      ongkirMode: raw.ongkirMode === 'flat' || raw.ongkirMode === 'tabel' ? raw.ongkirMode : 'konfirmasi',
      ongkirTabel: sanitizeTabel(raw.ongkirTabel),
      ongkirFlat: int(raw.ongkirFlat, 0, 1e8),
      ongkirCatatan: str(raw.ongkirCatatan, 500),
      catatanPembayaran: str(raw.catatanPembayaran, 1000),
      batasBayarJam: int(raw.batasBayarJam, 0, 720),
      kontak: str(raw.kontak, 200),
      updatedAt: iso(raw.updatedAt)
    };
    if (s.batasBayarJam === null) s.batasBayarJam = 48;
    if (s.ongkirMode === 'flat' && s.ongkirFlat === null) s.ongkirMode = 'konfirmasi';
    if (s.ongkirMode === 'tabel' && !(s.ongkirTabel && Object.keys(s.ongkirTabel.tarif).length)) s.ongkirMode = 'konfirmasi';
    return s;
  }
  var settingsCache = null;
  async function getSettings(opts) {
    if (settingsCache && !(opts && opts.fresh)) return clone(settingsCache);
    var raw;
    if (local()) raw = ls(K.settings, null);
    else {
      var f = await fx();
      try { var s = await f.db.collection('shop_settings').doc('main').get(); raw = s.exists ? s.data() : null; }
      catch (e) { throw mapFs(e); }
    }
    settingsCache = sanitizeSettings(Object.assign({}, DEFAULT_SETTINGS, raw || {}));
    return clone(settingsCache);
  }
  async function saveSettings(patch) {
    await requireAdmin();
    var cur = await getSettings({ fresh: true });
    var s = sanitizeSettings(Object.assign({}, cur, patch || {}));
    var out = { rekening: s.rekening, ongkirMode: s.ongkirMode, ongkirFlat: s.ongkirFlat, ongkirCatatan: s.ongkirCatatan, ongkirTabel: s.ongkirTabel, catatanPembayaran: s.catatanPembayaran, batasBayarJam: s.batasBayarJam, kontak: s.kontak };
    if (local()) { out.updatedAt = nowIso(); lsSet(K.settings, out); }
    else {
      var f = await fx();
      try { await f.db.collection('shop_settings').doc('main').set(Object.assign({}, out, { updatedAt: serverTs(f) })); }
      catch (e) { throw mapFs(e); }
      out.updatedAt = nowIso();
    }
    settingsCache = sanitizeSettings(out);
    return clone(settingsCache);
  }
  /** beratKirim(lines) → gram (null bila ada barang kirim tanpa data berat) */
  function beratKirim(lines) {
    var total = 0, unknown = false;
    (lines || []).forEach(function (l) {
      var it = l.item || l, p = l.product;
      if (!needsShipping(it.format)) return;
      var b = p ? p.berat : it.berat;
      if (b === null || b === undefined || !b) unknown = true; else total += b * (it.qty || 1);
    });
    return unknown ? null : total;
  }
  /** berat tertagih (kg): minimal 1 kg; kelebihan di atas kg bulat dibulatkan ke atas bila melebihi toleransi */
  function kgTagih(gram, toleransi) {
    var kg = Math.floor(gram / 1000), sisa = gram - kg * 1000;
    if (sisa > (toleransi === undefined ? 300 : toleransi)) kg += 1;
    return Math.max(1, kg);
  }
  /** ongkirJne(provinsi, gram) → {ongkir, kg, tarif, kota, etd, diambil} | null — tarif JNE REG dari Bekasi ke ibu kota
      provinsi, ditarik dari jne.co.id (assets/data/ongkir-jne.js). Berat dibulatkan ke atas per kg (min. 1 kg). */
  function ongkirJne(provinsi, gram) {
    var d = PPAPI.data && PPAPI.data.ongkirJne, t = d && d.tarif && d.tarif[provinsi];
    if (!t || !t.reg || gram === null || gram === undefined) return null;
    var kg = Math.max(1, Math.ceil((gram || 0) / 1000));
    return { ongkir: t.reg * kg, kg: kg, tarif: t.reg, kota: t.kota, etd: t.etd, diambil: d.diambil, layanan: d.layanan || 'REG' };
  }
  /** shippingQuote(settings, perluKirim, {provinsi, berat}) → {ongkir, final, catatan, kg?} */
  function shippingQuote(settings, perluKirim, ctx) {
    if (!perluKirim) return { ongkir: 0, final: true, catatan: '' };
    if (settings.ongkirMode === 'flat' && settings.ongkirFlat !== null) return { ongkir: settings.ongkirFlat, final: true, catatan: settings.ongkirCatatan || 'Ongkos kirim tetap ke seluruh Indonesia.' };
    var t = settings.ongkirTabel;
    if (settings.ongkirMode === 'tabel' && t) {
      ctx = ctx || {};
      var tarif = ctx.provinsi ? t.tarif[ctx.provinsi] : null;
      var src = (t.kurir ? t.kurir : 'kurir') + (t.diperbarui ? ', tarif per ' + (U().formatDate ? U().formatDate(t.diperbarui) : t.diperbarui) : '');
      if (!ctx.provinsi) return { ongkir: null, final: false, catatan: 'Pilih provinsi tujuan untuk menghitung ongkos kirim.' };
      if (tarif && ctx.berat !== null && ctx.berat !== undefined) {
        var kg = kgTagih(ctx.berat, t.toleransi);
        return { ongkir: tarif * kg, final: true, kg: kg, berat: ctx.berat,
          catatan: 'Ongkos kirim ' + src + ' ke ' + ctx.provinsi + ': ' + kg + ' kg × ' + rupiah(tarif) + ' (perkiraan berat ' + (Math.round(ctx.berat / 10) / 100).toString().replace('.', ',') + ' kg).' };
      }
      return { ongkir: null, final: false, catatan: !tarif ? 'Tarif ke ' + ctx.provinsi + ' belum tersedia; ongkos kirim dikonfirmasi sekretariat setelah pesanan dibuat.' : 'Ongkos kirim dikonfirmasi sekretariat setelah pesanan dibuat.' };
    }
    return { ongkir: null, final: false, catatan: settings.ongkirCatatan || 'Ongkos kirim dikonfirmasi sekretariat setelah pesanan dibuat.' };
  }

  /* ---------------------------------------------------------------- cart */
  var cartState = { items: [], uid: null, loaded: false };
  var remoteTimer = null;
  function cartKey(item) {
    var v = item.varian || {};
    var vk = Object.keys(v).sort().map(function (k) { return k + '=' + v[k]; }).join('&');
    return [item.productId, item.format || 'fisik', vk].join('|');
  }
  function cleanCartItems(items) {
    var out = [], seen = Object.create(null);
    (Array.isArray(items) ? items : []).forEach(function (it) {
      if (!it || !it.productId) return;
      var x = {
        productId: str(it.productId, 60),
        format: ['soft', 'cetak', 'fisik'].indexOf(it.format) !== -1 ? it.format : 'fisik',
        varian: {}, qty: int(it.qty, 1, LIMITS.qty) || 1, addedAt: str(it.addedAt, 40) || nowIso()
      };
      if (it.varian && typeof it.varian === 'object') Object.keys(it.varian).slice(0, LIMITS.varianGroups).forEach(function (k) { var kk = str(k, 30), vv = str(it.varian[k], 30); if (kk && vv) x.varian[kk] = vv; });
      if (x.format === 'soft') x.qty = 1;
      x.key = cartKey(x);
      if (seen[x.key]) { seen[x.key].qty = Math.min(LIMITS.qty, seen[x.key].qty + x.qty); if (x.format === 'soft') seen[x.key].qty = 1; return; }
      seen[x.key] = x; out.push(x);
    });
    return out.slice(0, LIMITS.cartLines);
  }
  function emitCart() {
    try { w.dispatchEvent(new CustomEvent('toko:cart', { detail: { items: clone(cartState.items), count: cartCount() } })); } catch (e) { /* ignore */ }
  }
  function cartCount() { return cartState.items.reduce(function (n, it) { return n + it.qty; }, 0); }
  function persistCart() {
    var u = me();
    var key = u ? K.cartUser + u.uid : K.cartGuest;
    try { w.localStorage.setItem(key, JSON.stringify({ items: cartState.items, updatedAt: nowIso() })); } catch (e) { /* ignore */ }
    if (u && !local()) {
      clearTimeout(remoteTimer);
      var uid = u.uid, items = clone(cartState.items).map(function (it) { delete it.key; return it; });
      remoteTimer = setTimeout(function () {
        fx().then(function (f) { return f.db.collection('carts').doc(uid).set({ items: items, updatedAt: serverTs(f) }); })
          .catch(function (e) { console.warn('[PPAPI] Keranjang belum tersinkron:', e && e.message); });
      }, 600);
    }
  }
  async function loadCart() {
    var u = me();
    var uid = u ? u.uid : null;
    if (cartState.loaded && cartState.uid === uid) return clone(cartState.items);
    var guest = cleanCartItems((ls(K.cartGuest, {}) || {}).items);
    var items = guest;
    if (u) {
      var mine = cleanCartItems((ls(K.cartUser + uid, {}) || {}).items);
      if (!local()) {
        try {
          var f = await fx();
          var s = await f.db.collection('carts').doc(uid).get();
          if (s.exists) mine = cleanCartItems((s.data() || {}).items);
        } catch (e) { console.warn('[PPAPI] Keranjang tersimpan belum dapat dibaca:', e && e.message); }
      }
      items = cleanCartItems(mine.concat(guest));     // merge the guest cart into the account cart
      cartState = { items: items, uid: uid, loaded: true };
      if (guest.length) { try { w.localStorage.removeItem(K.cartGuest); } catch (e) { /* ignore */ } persistCart(); }
      else { try { w.localStorage.setItem(K.cartUser + uid, JSON.stringify({ items: items, updatedAt: nowIso() })); } catch (e) { /* ignore */ } }
    } else {
      cartState = { items: items, uid: null, loaded: true };
    }
    emitCart();
    return clone(cartState.items);
  }
  var cart = {
    load: loadCart,
    items: function () { return clone(cartState.items); },
    count: cartCount,
    add: async function (item) {
      await loadCart();
      var x = cleanCartItems([item])[0];
      if (!x) throw err('toko/invalid-item', 'Produk tidak valid.');
      var ex = cartState.items.filter(function (it) { return it.key === x.key; })[0];
      if (ex) { ex.qty = x.format === 'soft' ? 1 : Math.min(LIMITS.qty, ex.qty + x.qty); }
      else {
        if (cartState.items.length >= LIMITS.cartLines) throw err('toko/cart-full', 'Keranjang sudah berisi ' + LIMITS.cartLines + ' baris produk. Selesaikan pesanan ini terlebih dahulu.');
        cartState.items.push(x);
      }
      persistCart(); emitCart();
      return clone(ex || x);
    },
    setQty: async function (key, qty) {
      await loadCart();
      cartState.items.forEach(function (it) { if (it.key === key) it.qty = it.format === 'soft' ? 1 : (int(qty, 1, LIMITS.qty) || 1); });
      persistCart(); emitCart();
    },
    remove: async function (key) {
      await loadCart();
      cartState.items = cartState.items.filter(function (it) { return it.key !== key; });
      persistCart(); emitCart();
    },
    clear: async function () {
      await loadCart();
      cartState.items = [];
      persistCart(); emitCart();
    },
    onChange: function (cb) {
      function h(e) { cb(e.detail); }
      w.addEventListener('toko:cart', h);
      return function () { w.removeEventListener('toko:cart', h); };
    },
    /* resolves the cart against the catalogue → lines with product, price, problems */
    resolve: async function (products) {
      await loadCart();
      products = products || await listProducts();
      var byId = Object.create(null); products.forEach(function (p) { byId[p.id] = p; });
      var member = !!session().isMemberActive;
      return cartState.items.map(function (it) {
        var p = byId[it.productId] || null;
        var line = { key: it.key, item: clone(it), product: p, problem: '' };
        if (!p) { line.problem = 'Produk tidak lagi tersedia.'; return line; }
        if (formatsOf(p).indexOf(it.format) === -1) { line.problem = 'Format ini tidak lagi tersedia.'; return line; }
        var bad = p.varian.filter(function (g) { return !it.varian[g.nama] || g.opsi.indexOf(it.varian[g.nama]) === -1; });
        if (bad.length) { line.problem = 'Pilih ulang ' + bad.map(function (g) { return g.nama.toLowerCase(); }).join(' dan ') + '.'; }
        var left = stockLeft(p, it.format);
        if (left === 0) line.problem = 'Stok habis.';
        else if (it.qty > left) line.problem = 'Stok tersisa ' + left + '.';
        line.price = priceFor(p, it.format, member, it.varian);
        line.subtotal = line.price.harga * it.qty;
        return line;
      });
    }
  };
  if (w.addEventListener) {
    w.addEventListener('storage', function (e) {
      if (!e.key || (e.key !== K.cartGuest && e.key.indexOf(K.cartUser) !== 0)) return;
      cartState.loaded = false; loadCart().catch(function () { /* ignore */ });
    });
  }

  /* ---------------------------------------------------------------- orders */
  function sanitizeOrder(raw, id) {
    raw = raw || {};
    var o = clone(raw) || {};
    o.id = id || o.id;
    o.createdAt = iso(raw.createdAt); o.updatedAt = iso(raw.updatedAt);
    o.items = Array.isArray(o.items) ? o.items : [];
    o.ringkasan = o.ringkasan || { subtotal: 0, ongkir: null, total: 0 };
    o.pembayaran = o.pembayaran || null;
    o.pengiriman = o.pengiriman || null;
    o.riwayat = Array.isArray(o.riwayat) ? o.riwayat : [];
    o.alamat = o.alamat || null;
    o.buyer = o.buyer || {};
    if (STATUS.indexOf(o.status) === -1) o.status = 'Menunggu Pembayaran';
    o.isPaid = PAID.indexOf(o.status) !== -1;
    o.isUnpaid = UNPAID.indexOf(o.status) !== -1;
    o.hasSoft = o.items.some(function (it) { return it.format === 'soft'; });
    return o;
  }
  function sortOrders(list) { return list.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }); }
  function validateAlamat(a) {
    a = a || {};
    var out = {
      nama: str(a.nama, 120), telepon: str(a.telepon, 24), alamat: str(a.alamat, 500), kota: str(a.kota, 80),
      provinsi: str(a.provinsi, 60), kodePos: str(a.kodePos, 5), catatan: str(a.catatan, 300)
    };
    var bad = [];
    if (out.nama.length < 3) bad.push({ key: 'nama', label: 'Nama penerima' });
    var digits = out.telepon.replace(/\D/g, '');
    if (digits.length < 9 || digits.length > 15) bad.push({ key: 'telepon', label: 'Nomor telepon penerima' });
    if (out.alamat.length < 10) bad.push({ key: 'alamat', label: 'Alamat lengkap' });
    if (out.kota.length < 3) bad.push({ key: 'kota', label: 'Kota / kabupaten' });
    var prov = U().PROVINSI || [];
    if (!out.provinsi || (prov.length && prov.indexOf(out.provinsi) === -1)) bad.push({ key: 'provinsi', label: 'Provinsi' });
    if (!/^\d{5}$/.test(out.kodePos)) bad.push({ key: 'kodePos', label: 'Kode pos (5 angka)' });
    return { value: out, missing: bad };
  }
  function historyEntry(status, by, note) { return { at: nowIso(), status: status, by: by, note: str(note, 500) }; }

  async function createOrder(input) {
    var u = requireUser();
    input = input || {};
    var products = await listProducts();
    var lines = await cart.resolve(products);
    if (!lines.length) throw err('toko/empty-cart', 'Keranjang Anda masih kosong.');
    var problems = lines.filter(function (l) { return l.problem; });
    if (problems.length) throw err('toko/cart-problem', 'Beberapa produk di keranjang perlu diperiksa: ' + problems.map(function (l) { return (l.product ? l.product.nama : 'produk') + ' — ' + l.problem; }).join(' '));
    var member = !!session().isMemberActive;
    var perluKirim = lines.some(function (l) { return needsShipping(l.item.format); });
    var alamat = null;
    if (perluKirim) {
      var v = validateAlamat(input.alamat);
      if (v.missing.length) { var e = err('toko/address-incomplete', 'Lengkapi alamat pengiriman: ' + v.missing.map(function (m) { return m.label; }).join(', ') + '.'); e.missing = v.missing; throw e; }
      alamat = v.value;
    }
    var k = input.kontak || {};
    var buyer = { name: str(k.nama || u.name, 120), email: str(k.email || u.email, 200), phone: str(k.telepon || u.phone, 24) };
    if (buyer.name.length < 3) throw err('toko/contact-incomplete', 'Isi nama pemesan (minimal 3 huruf).');
    if (!buyer.email && !buyer.phone) throw err('toko/contact-incomplete', 'Isi email atau nomor telepon pemesan agar sekretariat dapat menghubungi Anda.');
    if (buyer.email && U().isEmail && !U().isEmail(buyer.email)) throw err('toko/contact-incomplete', 'Format email pemesan tidak valid.');
    var settings = await getSettings({ fresh: true });
    var items = lines.map(function (l) {
      return {
        productId: l.product.id, nama: l.product.nama, kode: l.product.kode, kategori: l.product.kategori,
        format: l.item.format, varian: l.item.varian, varianLabel: varianLabel(l.item.varian), qty: l.item.qty,
        harga: l.price.harga, hargaNormal: l.price.normal, hargaAnggota: l.price.anggota, subtotal: l.subtotal
      };
    });
    var subtotal = items.reduce(function (n, it) { return n + it.subtotal; }, 0);
    var normal = items.reduce(function (n, it) { return n + it.hargaNormal * it.qty; }, 0);
    var berat = beratKirim(lines);
    var q = shippingQuote(settings, perluKirim, { provinsi: alamat && alamat.provinsi, berat: berat });
    /* mode konfirmasi: ongkos kirim diisi pembeli dari cek tarif kurir (wajib), diperiksa sekretariat */
    var ob = null;
    if (perluKirim && !q.final && settings.ongkirMode === 'konfirmasi') {
      var oi = input.ongkir || {};
      var kur = str(oi.kurir, 40), lay = str(oi.layanan, 40), nilai = int(oi.ongkir, 0, 1e8);
      /* JNE: ongkir dihitung ulang dari tarif resmi (angka dari peramban tidak dipakai) */
      var oto = kur === 'JNE' ? ongkirJne(alamat && alamat.provinsi, berat) : null;
      if (oto) { lay = oto.layanan; nilai = oto.ongkir; }
      if (!kur || !nilai || nilai < 1000) { var e3 = err('toko/ongkir-required', 'Pilih kurir dan isi ongkos kirim dari hasil cek tarif kurir.'); e3.missing = [{ key: 'ongkir', label: 'Ongkos kirim' }]; throw e3; }
      ob = { kurir: kur, layanan: lay, ongkir: nilai, otomatis: !!oto };
      q = oto
        ? { ongkir: nilai, final: true, catatan: 'Ongkos kirim JNE ' + oto.layanan + ' dari Bekasi ke ' + oto.kota + ': ' + oto.kg + ' kg × ' + rupiah(oto.tarif) + ' (tarif jne.co.id per ' + oto.diambil + ', estimasi ' + oto.etd + ').' }
        : { ongkir: nilai, final: true, catatan: 'Ongkos kirim diisi pembeli dari cek tarif ' + kur + (lay ? ' ' + lay : '') + '; diperiksa sekretariat sebelum pembayaran dikonfirmasi.' };
    }
    var id = 'PSN-' + ymd() + '-' + rand(5);
    var order = {
      id: id, uid: u.uid, buyer: buyer, items: items, perluKirim: perluKirim, alamat: alamat,
      ringkasan: { subtotal: subtotal, hemat: Math.max(0, normal - subtotal), ongkir: q.ongkir, ongkirFinal: q.final, ongkirCatatan: q.catatan, beratGram: berat, ongkirSumber: ob ? (ob.otomatis ? 'otomatis' : 'pembeli') : '', ongkirKurir: ob ? (ob.kurir + (ob.layanan ? ' ' + ob.layanan : '')) : '', total: subtotal + (q.ongkir || 0) },
      status: 'Menunggu Pembayaran', hargaAnggota: member && normal !== subtotal,
      catatan: str(input.catatan, 500),
      riwayat: [historyEntry('Menunggu Pembayaran', 'pembeli', 'Pesanan dibuat.')]
    };
    if (local()) {
      var m = lsMap(K.orders);
      order.createdAt = order.updatedAt = nowIso();
      m[id] = order; lsSet(K.orders, m);
    } else {
      var f = await fx();
      try { await f.db.collection('orders').doc(id).set(Object.assign({}, order, { createdAt: serverTs(f), updatedAt: serverTs(f) })); }
      catch (e2) { throw mapFs(e2); }
      order.createdAt = order.updatedAt = nowIso();
    }
    return sanitizeOrder(order, id);
  }
  async function myOrders() {
    var u = requireUser();
    var list;
    if (local()) {
      var m = lsMap(K.orders);
      list = Object.keys(m).map(function (id) { return sanitizeOrder(m[id], id); }).filter(function (o) { return o.uid === u.uid; });
    } else {
      var f = await fx();
      try { var s = await f.db.collection('orders').where('uid', '==', u.uid).get(); list = s.docs.map(function (d) { return sanitizeOrder(d.data(), d.id); }); }
      catch (e) { throw mapFs(e); }
    }
    return sortOrders(list);
  }
  async function readOrder(id) {
    if (local()) { var m = lsMap(K.orders); return m[id] ? sanitizeOrder(m[id], id) : null; }
    var f = await fx();
    try { var s = await f.db.collection('orders').doc(id).get(); return s.exists ? sanitizeOrder(s.data(), id) : null; }
    catch (e) { if (e && /permission-denied/.test(e.code || '')) return null; throw mapFs(e); }
  }
  async function getOrder(id) {
    var u = requireUser();
    var o = await readOrder(String(id || ''));
    if (!o) return null;
    if (o.uid !== u.uid && !(await isAdmin())) return null;
    return o;
  }
  async function writeOrderPatch(id, patch) {
    if (local()) {
      var m = lsMap(K.orders);
      if (!m[id]) throw err('toko/not-found', 'Pesanan tidak ditemukan.');
      m[id] = Object.assign({}, m[id], patch, { updatedAt: nowIso() });
      lsSet(K.orders, m);
      return sanitizeOrder(m[id], id);
    }
    var f = await fx();
    try { await f.db.collection('orders').doc(id).update(Object.assign({}, patch, { updatedAt: serverTs(f) })); }
    catch (e) { throw mapFs(e); }
    return readOrder(id);
  }
  /* ---- foto bukti transfer: orders/{id}/bukti/foto {img (JPEG data URL ≤ ±300 KB), uid, updatedAt};
     Mode Demo: localStorage ppapi_toko_bukti {id: img} ---- */
  var BUKTI_MAX = 420000;   // karakter data URL (±300 KB)
  async function saveBukti(id, img) {
    var u = requireUser();
    if (!jpeg(img, BUKTI_MAX)) throw err('toko/invalid-image', 'Foto bukti tidak dapat diproses. Gunakan foto JPG, PNG, atau WebP.');
    if (local()) { var m = lsMap('ppapi_toko_bukti'); m[id] = img; lsSet('ppapi_toko_bukti', m); return; }
    var f = await fx();
    try { await f.db.collection('orders').doc(id).collection('bukti').doc('foto').set({ img: img, uid: u.uid, updatedAt: serverTs(f) }); }
    catch (e) { throw mapFs(e); }
  }
  /** getBukti(orderId) → data URL foto bukti ('' bila tidak ada) — pemilik pesanan atau admin */
  async function getBukti(id) {
    requireUser();
    if (local()) return jpeg(lsMap('ppapi_toko_bukti')[id], BUKTI_MAX);
    var f = await fx();
    try { var s = await f.db.collection('orders').doc(id).collection('bukti').doc('foto').get(); return s.exists ? jpeg((s.data() || {}).img, BUKTI_MAX) : ''; }
    catch (e) { return ''; }
  }
  /** buktiFromFile(file) → data URL JPEG ≤ ±300 KB, sisi terpanjang ≤ 1600 px */
  function buktiFromFile(file) { return compressImage(file, { max: 1600, maxKB: 300 }); }
  async function submitPayment(id, data) {
    var u = requireUser();
    var o = await getOrder(id);
    if (!o || o.uid !== u.uid) throw err('toko/not-found', 'Pesanan tidak ditemukan.');
    if (!o.isUnpaid) throw err('toko/invalid-transition', 'Bukti pembayaran hanya dapat dikirim untuk pesanan yang belum dibayar.');
    data = data || {};
    var foto = data.foto ? jpeg(data.foto, BUKTI_MAX) : '';
    var adaFoto = !!foto || (!data.foto && (o.pembayaran || {}).bukti === 'foto');
    var p = {
      tanggal: str(data.tanggal, 10), jumlah: int(data.jumlah, 0, 1e10),
      pengirim: str(data.pengirim, 120), catatan: str(data.catatan, 500), dikirimAt: nowIso()
    };
    if (adaFoto) p.bukti = 'foto'; else p.buktiUrl = httpsUrl(data.buktiUrl);
    var bad = [];
    if (!adaFoto && !p.buktiUrl) bad.push({ key: 'foto', label: 'Foto bukti transfer' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.tanggal) || p.tanggal > todayIso()) bad.push({ key: 'tanggal', label: 'Tanggal transfer (tidak boleh setelah hari ini)' });
    if (!p.jumlah || p.jumlah <= 0) bad.push({ key: 'jumlah', label: 'Jumlah yang ditransfer' });
    if (p.pengirim.length < 3) bad.push({ key: 'pengirim', label: 'Nama pemilik rekening pengirim' });
    if (bad.length) { var e = err('toko/payment-incomplete', 'Lengkapi: ' + bad.map(function (b) { return b.label; }).join(', ') + '.'); e.missing = bad; throw e; }
    if (foto) await saveBukti(id, foto);
    var riwayat = o.riwayat.concat([historyEntry('Menunggu Konfirmasi', 'pembeli', o.status === 'Menunggu Konfirmasi' ? 'Bukti pembayaran diperbarui.' : 'Bukti pembayaran dikirim.')]).slice(-40);
    return writeOrderPatch(id, { pembayaran: p, status: 'Menunggu Konfirmasi', riwayat: riwayat });
  }
  async function cancelOrder(id, alasan) {
    var u = requireUser();
    var o = await getOrder(id);
    if (!o || o.uid !== u.uid) throw err('toko/not-found', 'Pesanan tidak ditemukan.');
    if (!o.isUnpaid) throw err('toko/invalid-transition', 'Pesanan yang sudah dibayar tidak dapat dibatalkan dari halaman ini. Hubungi sekretariat.');
    var note = str(alasan, 500);
    var riwayat = o.riwayat.concat([historyEntry('Dibatalkan', 'pembeli', note || 'Dibatalkan oleh pembeli.')]).slice(-40);
    return writeOrderPatch(id, { status: 'Dibatalkan', alasanBatal: note, dibatalkanOleh: 'pembeli', riwayat: riwayat });
  }
  function paymentDeadline(order, settings) {
    var jam = settings && settings.batasBayarJam;
    if (!jam || !order || !order.createdAt || order.status !== 'Menunggu Pembayaran') return '';
    var t = Date.parse(order.createdAt); if (!isFinite(t)) return '';
    return new Date(t + jam * 3600000).toISOString();
  }

  /* ---------------------------------------------------------------- soft files */
  function entId(uid, pid) { return uid + '_' + pid; }
  async function hasEntitlement(productId) {
    var u = me(); if (!u) return false;
    if (local()) return !!lsMap(K.ent)[entId(u.uid, productId)];
    var f = await fx();
    try { var s = await f.db.collection('entitlements').doc(entId(u.uid, productId)).get(); return s.exists; }
    catch (e) { return false; }
  }
  /* ---- berkas PDF privat yang diunggah ke situs (Mode Demo: IndexedDB peramban ini) ---- */
  var idbP = null;
  function idb() {
    if (idbP) return idbP;
    idbP = new Promise(function (resolve, reject) {
      var r = w.indexedDB.open('ppapi_toko_berkas', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('berkas'); };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { idbP = null; reject(err('toko/quota', 'Penyimpanan peramban tidak tersedia untuk berkas PDF.')); };
    });
    return idbP;
  }
  async function idbDo(mode, fn) {
    var db = await idb();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('berkas', mode), req = fn(tx.objectStore('berkas'));
      tx.oncomplete = function () { resolve(req && req.result); };
      tx.onerror = tx.onabort = function () { reject(err('toko/quota', 'Berkas PDF tidak dapat disimpan di peramban ini.', tx.error)); };
    });
  }
  function fileMeta(raw) {
    raw = raw || {};
    return { url: str(raw.url, 1000), parts: int(raw.parts, 0, 40) || 0, size: int(raw.size, 0, MAX_PDF) || 0, fileName: str(raw.fileName, 120) };
  }
  /** fileInfo(productId) → {url, parts, size, fileName} — admin, or a buyer whose payment was confirmed (entitlement). */
  async function fileInfo(productId) {
    var u = requireUser();
    var denied = err('toko/forbidden', 'Berkas ini dapat dibuka setelah pembayaran pesanan Anda dikonfirmasi sekretariat.');
    if (local()) {
      var ok = !!lsMap(K.ent)[entId(u.uid, productId)] || (await isAdmin());
      if (!ok) throw denied;
      return fileMeta(lsMap(K.files)[productId]);
    }
    var f = await fx();
    try { var s = await f.db.collection('product_files').doc(productId).get(); return fileMeta(s.exists ? s.data() : null); }
    catch (e) { if (e && /permission-denied/.test(e.code || '')) throw denied; throw mapFs(e); }
  }
  async function fileUrl(productId) { return (await fileInfo(productId)).url; }
  /** readParts(productId, meta) → Uint8Array — the uploaded PDF, reassembled */
  async function readParts(productId, meta) {
    if (local()) {
      var v = await idbDo('readonly', function (st) { return st.get(productId); });
      if (!v) throw err('toko/no-file', 'Berkas PDF produk ini tidak ditemukan di peramban ini.');
      return new Uint8Array(v);
    }
    var f = await fx(), chunks = [], total = 0;
    try {
      for (var i = 0; i < meta.parts; i++) {
        var s = await f.db.collection('product_files').doc(productId).collection('parts').doc(String(i)).get();
        var b = s.exists && s.data().b ? s.data().b.toUint8Array() : null;
        if (!b) throw err('toko/no-file', 'Sebagian berkas PDF tidak ditemukan. Silakan hubungi sekretariat.');
        chunks.push(b); total += b.length;
      }
    } catch (e) { if (e.code === 'toko/no-file') throw e; throw mapFs(e); }
    var out = new Uint8Array(total), pos = 0;
    chunks.forEach(function (c) { out.set(c, pos); pos += c.length; });
    return out;
  }
  /* Google Drive share link → direct download address (still usually blocked by CORS) */
  function fetchableUrl(url) {
    var m = /^https:\/\/drive\.google\.com\/file\/d\/([\w-]{10,})/i.exec(url) || /^https:\/\/drive\.google\.com\/open\?id=([\w-]{10,})/i.exec(url);
    return m ? 'https://drive.google.com/uc?export=download&id=' + m[1] : url;
  }
  function loadScript(src, integrity) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true; s.crossOrigin = 'anonymous'; if (integrity) s.integrity = integrity; s.referrerPolicy = 'no-referrer';
      s.onload = function () { resolve(); }; s.onerror = function () { s.remove(); reject(new Error('load ' + src)); };
      document.head.appendChild(s);
    });
  }
  var pdfLibP = null;
  function canEncrypt() { return !!(w.PDFLib && w.PDFLib.PDFDocument && typeof w.PDFLib.PDFDocument.prototype.encrypt === 'function'); }
  function loadPdfLib() {
    if (canEncrypt()) return Promise.resolve(w.PDFLib);
    if (pdfLibP) return pdfLibP;
    pdfLibP = (async function () {
      for (var i = 0; i < PDFLIB.length; i++) {
        try { await loadScript(PDFLIB[i].src, PDFLIB[i].integrity); if (canEncrypt()) return w.PDFLib; } catch (e) { /* next */ }
      }
      pdfLibP = null;
      throw err('toko/pdf-lib', 'Pustaka pengolah PDF tidak dapat dimuat. Periksa koneksi internet Anda, lalu coba lagi.');
    })();
    return pdfLibP;
  }
  function latin(s) {   // the standard Helvetica font encodes WinAnsi only
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '?');
  }
  /** watermark(bytes, {nama, email, orderId, tanggal}) → Uint8Array (every page: diagonal + footer line).
      Hasilnya dienkripsi (AES-128): kata sandi pembuka = email pembeli; kata sandi pemilik acak dan tidak
      disimpan, sehingga izin mengubah, menyalin, dan menyusun ulang halaman tertutup; mencetak diizinkan. */
  async function watermark(bytes, who) {
    var L = await loadPdfLib();
    var doc;
    try { doc = await L.PDFDocument.load(bytes, { updateMetadata: false }); }
    catch (e) {
      if (/encrypt/i.test(String(e && e.message))) throw err('toko/pdf-encrypted', 'Berkas PDF sumber dilindungi kata sandi sehingga tanda air tidak dapat dibubuhkan.');
      throw err('toko/pdf-invalid', 'Berkas sumber bukan PDF yang dapat diolah.', e);
    }
    var font = await doc.embedFont(L.StandardFonts.Helvetica);
    var bold = await doc.embedFont(L.StandardFonts.HelveticaBold);
    var nama = latin(who.nama), email = latin(who.email), no = latin(who.orderId), tgl = latin(who.tanggal);
    var big = nama + ' - ' + no;
    var foot = 'Berlisensi untuk ' + nama + (email ? ' <' + email + '>' : '') + ' | Pesanan ' + no + ' | ' + tgl + ' | Dilarang menggandakan atau menyebarluaskan tanpa izin PPAPI.';
    doc.getPages().forEach(function (page) {
      var sz = page.getSize(), W = sz.width, H = sz.height;
      var size = Math.max(14, Math.min(42, (Math.hypot(W, H) * 0.62) / Math.max(10, big.length) * 1.7));
      var tw = bold.widthOfTextAtSize(big, size);
      var ang = Math.atan2(H, W), deg = ang * 180 / Math.PI;
      [0.28, 0.5, 0.72].forEach(function (t) {
        var cx = W * t, cy = H * t;
        page.drawText(big, {
          x: cx - Math.cos(ang) * tw / 2, y: cy - Math.sin(ang) * tw / 2, size: size, font: bold,
          color: L.rgb(0.35, 0.35, 0.38), opacity: 0.13, rotate: L.degrees(deg)
        });
      });
      var fs = W < 400 ? 5.5 : 7;
      var maxW = W - 48, line = foot;
      while (font.widthOfTextAtSize(line, fs) > maxW && line.length > 20) line = line.slice(0, -4) + '...';
      page.drawRectangle({ x: 0, y: 0, width: W, height: fs + 14, color: L.rgb(1, 1, 1), opacity: 0.82 });
      page.drawText(line, { x: 24, y: 8, size: fs, font: font, color: L.rgb(0.25, 0.25, 0.28) });
      page.drawText(latin('PPAPI ' + no), { x: 24, y: H - 16, size: fs, font: font, color: L.rgb(0.35, 0.35, 0.38), opacity: 0.6 });
    });
    doc.setSubject('Berlisensi untuk ' + nama + (email ? ' <' + email + '>' : '') + ' - Pesanan ' + no);
    doc.setKeywords(['PPAPI', 'Pesanan ' + no, nama, email].filter(Boolean));
    doc.setProducer('PPAPI - Toko');
    doc.setModificationDate(new Date());
    var pw = String(who.email || '').trim().toLowerCase();
    if (!pw) throw err('toko/pdf-invalid', 'Email pembeli tidak tersedia untuk mengunci berkas. Silakan hubungi sekretariat.');
    doc.encrypt({
      userPassword: pw, ownerPassword: rand(40),
      permissions: { printing: 'highResolution', modifying: false, copying: false, annotating: false, fillingForms: false, contentAccessibility: true, documentAssembly: false }
    });
    /* object stream wajib: tanpa itu @cantoo/pdf-lib 2.8.4 menyandikan string metadata/penanda secara keliru */
    return doc.save({ useObjectStreams: true });
  }
  /** downloadSoft(order, item) → {ok:true, fileName} | {ok:false, reason, url, message}
      reason: 'cors' (host blocks fetch) | 'not-pdf' | 'encrypted' | 'invalid' | 'lib' | 'no-file' */
  async function downloadSoft(order, item) {
    var u = requireUser();
    if (!order || !order.isPaid) throw err('toko/forbidden', 'Berkas dapat diunduh setelah pembayaran dikonfirmasi sekretariat.');
    if (!item || item.format !== 'soft') throw err('toko/invalid-item', 'Butir ini bukan soft file.');
    var info = await fileInfo(item.productId), url = info.url;
    if (!url && !info.parts) return { ok: false, reason: 'no-file', url: '', message: 'Sekretariat belum menautkan berkas untuk produk ini. Silakan hubungi sekretariat.' };
    var bytes;
    if (info.parts) {
      try { bytes = await readParts(item.productId, info); }
      catch (e) { return { ok: false, reason: 'no-file', url: '', message: e.message }; }
    } else try {
      var res = await fetch(fetchableUrl(url), { mode: 'cors', credentials: 'omit', redirect: 'follow', cache: 'no-store', referrerPolicy: 'no-referrer' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      bytes = new Uint8Array(await res.arrayBuffer());
    } catch (e) {
      return { ok: false, reason: 'cors', url: url, message: 'Penyimpanan berkas tidak mengizinkan situs ini mengambil berkas secara langsung, sehingga tanda air tidak dapat dibubuhkan otomatis.' };
    }
    var head = String.fromCharCode.apply(null, bytes.subarray(0, 1024));
    if (head.indexOf('%PDF-') === -1) return { ok: false, reason: 'not-pdf', url: url, message: 'Tautan tidak mengarah langsung ke berkas PDF (misalnya halaman pratinjau), sehingga tanda air tidak dapat dibubuhkan otomatis.' };
    var out;
    try {
      var email = order.buyer.email || u.email;
      out = await watermark(bytes, { nama: order.buyer.name || u.name, email: email, orderId: order.id, tanggal: todayIso() });
    } catch (e) {
      if (e.code === 'toko/pdf-lib') return { ok: false, reason: 'lib', url: url, message: e.message };
      return { ok: false, reason: e.code === 'toko/pdf-encrypted' ? 'encrypted' : 'invalid', url: url, message: e.message };
    }
    var name = slug(item.kode || item.nama || 'berkas') + '-' + order.id + '.pdf';
    var blob = new Blob([out], { type: 'application/pdf' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    return { ok: true, fileName: name, bytes: out.length, password: String(email || '').trim().toLowerCase() };
  }

  /* ---------------------------------------------------------------- images */
  function readImage(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\//.test(file.type || '')) return reject(err('toko/invalid-image', 'Berkas harus berupa gambar (JPG, PNG, atau WebP).'));
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { resolve({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(err('toko/invalid-image', 'Gambar tidak dapat dibaca. Gunakan format JPG, PNG, atau WebP.')); };
      img.src = url;
    });
  }
  /** compressImage(fileOrImage, {max, maxKB}) → data:image/jpeg;base64 (≤ maxKB) */
  async function compressImage(file, opts) {
    opts = opts || {};
    var max = opts.max || 1200, maxBytes = (opts.maxKB || LIMITS.fotoKB) * 1024;
    var src = file && file.img ? file : await readImage(file);
    var img = src.img, scale = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    var c = document.createElement('canvas'), ctx = c.getContext('2d'), out = '';
    for (var round = 0; round < 6; round++) {
      c.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
      c.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      for (var q = 0.86; q >= 0.5; q -= 0.08) {
        out = c.toDataURL('image/jpeg', q);
        if ((out.length - 23) * 0.75 <= maxBytes) { if (!file.img && src.url) URL.revokeObjectURL(src.url); return out; }
      }
      scale *= 0.8;
    }
    if (src.url && !file.img) URL.revokeObjectURL(src.url);
    if ((out.length - 23) * 0.75 <= maxBytes) return out;
    throw err('toko/photo-too-large', 'Foto tidak dapat diperkecil hingga ' + Math.round(maxBytes / 1024) + ' KB. Gunakan foto lain.');
  }
  /** watermarkPhoto(dataUrl) → data:image/jpeg — tanda air PPAPI miring berulang (tipis) + label di pojok */
  async function watermarkPhoto(dataUrl, opts) {
    opts = opts || {};
    var img = await new Promise(function (resolve, reject) { var i = new Image(); i.onload = function () { resolve(i); }; i.onerror = function () { reject(err('toko/invalid-image', 'Foto tidak dapat dibaca.')); }; i.src = dataUrl; });
    var W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas'), ctx = c.getContext('2d');
    c.width = W; c.height = H;
    ctx.drawImage(img, 0, 0, W, H);
    var text = opts.text || 'PPAPI · ppapi.or.id', fs = Math.max(14, Math.round(Math.min(W, H) * 0.045));
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.rotate(-Math.PI / 6);
    ctx.font = '600 ' + fs + 'px Inter, Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var tw = ctx.measureText(text).width + fs * 3, th = fs * 4.2, R = Math.hypot(W, H) / 2 + tw;
    for (var y = -R, row = 0; y <= R; y += th, row++) {
      for (var x = -R + (row % 2) * tw / 2; x <= R; x += tw) {
        ctx.fillStyle = 'rgba(0,0,0,0.10)'; ctx.fillText(text, x + 1, y + 1);
        ctx.fillStyle = 'rgba(255,255,255,0.16)'; ctx.fillText(text, x, y);
      }
    }
    ctx.restore();
    var ls = Math.max(12, Math.round(Math.min(W, H) * 0.03)), label = '© PPAPI';
    ctx.font = '700 ' + ls + 'px Inter, Arial, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillText(label, W - ls + 1, H - ls * 0.8 + 1);
    ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(label, W - ls, H - ls * 0.8);
    return compressImage({ img: await new Promise(function (resolve) { var i = new Image(); i.onload = function () { resolve(i); }; i.src = c.toDataURL('image/png'); }) }, { max: 1200, maxKB: LIMITS.fotoKB });
  }
  async function thumbFrom(dataUrl) {
    var img = await new Promise(function (resolve, reject) { var i = new Image(); i.onload = function () { resolve(i); }; i.onerror = reject; i.src = dataUrl; });
    return compressImage({ img: img }, { max: 560, maxKB: LIMITS.thumbKB });
  }

  /* ---------------------------------------------------------------- dokumen PDF: invoice & ringkasan transaksi */
  var JSPDF = [
    { src: 'assets/vendor/jspdf-2.5.1.umd.min.js', integrity: '' },
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      integrity: 'sha512-qZvrmS2ekKPF2mSznTQsxqPgnpkI4DNTlrdUmTzrDgektczlKNRRhy5X5AAOnx5S09ydFYWWNSfcEqDTTHgtNA==' }
  ];
  var jspdfP = null;
  function loadJsPdf() {
    if (w.jspdf && w.jspdf.jsPDF) return Promise.resolve(w.jspdf.jsPDF);
    if (jspdfP) return jspdfP;
    jspdfP = (async function () {
      for (var i = 0; i < JSPDF.length; i++) {
        try { await loadScript(JSPDF[i].src, JSPDF[i].integrity); if (w.jspdf && w.jspdf.jsPDF) return w.jspdf.jsPDF; } catch (e) { /* berikutnya */ }
      }
      jspdfP = null;
      throw err('toko/pdf-lib', 'Pustaka pembuat PDF tidak dapat dimuat. Periksa koneksi internet Anda, lalu coba lagi.');
    })();
    return jspdfP;
  }
  var logoP = null;
  function logoData() {
    if (logoP) return logoP;
    logoP = fetch('assets/img/sertifikat/logo-ppapi.png').then(function (r) { if (!r.ok) throw new Error(); return r.blob(); }).then(function (b) {
      return new Promise(function (res) { var fr = new FileReader(); fr.onload = function () { var img = new Image(); img.onload = function () {
        /* perkecil ke lebar 480 px agar berkas PDF ringan */
        var k = Math.min(1, 480 / img.naturalWidth), c = document.createElement('canvas');
        c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        res({ src: c.toDataURL('image/png'), w: c.width, h: c.height });
      }; img.onerror = function () { res(null); }; img.src = fr.result; }; fr.readAsDataURL(b); });
    }).catch(function () { return null; });
    return logoP;
  }
  function pdfText(v) { return latin(String(v === null || v === undefined ? '' : v)); }
  function rp(n) { return 'Rp ' + Math.round(n || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function tgl(v) { if (!v) return '-'; var f = U().formatDate; try { return f ? f(String(v).slice(0, 10)) : String(v).slice(0, 10); } catch (e) { return String(v).slice(0, 10); } }
  function savePdf(doc, name) {
    var blob = doc.output('blob'), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name; a.rel = 'noopener';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    return { ok: true, fileName: name };
  }
  /* kop dokumen: logo, nama perkumpulan, kontak; judul di kanan. Mengembalikan posisi y berikutnya (mm). */
  async function kop(doc, judul, sub) {
    var c = (PPAPI.config && PPAPI.config.contact) || {}, logo = await logoData(), W = doc.internal.pageSize.getWidth();
    if (logo) { var lw = 38, lh = lw * logo.h / logo.w; doc.addImage(logo.src, 'PNG', 15, 12, lw, lh, 'logo-ppapi', 'FAST'); }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(22, 32, 52);
    doc.text(pdfText(judul), W - 15, 20, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 96, 108);
    (sub || []).forEach(function (t, i) { doc.text(pdfText(t), W - 15, 27 + i * 5, { align: 'right' }); });
    var y = Math.max(36, 27 + 5 * (sub || []).length + 3);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.setTextColor(22, 32, 52);
    doc.text('Perkumpulan Praktisi dan Ahli Perancah Indonesia (PPAPI)', 15, y);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); doc.setTextColor(90, 96, 108);
    var info = [[c.address, c.city].filter(Boolean).join(', '), [c.email, c.phone ? 'Telp/WA ' + c.phone : ''].filter(Boolean).join(' | ') + ' | ppapi.or.id'];
    info.forEach(function (t, i) { if (t) doc.text(pdfText(t), 15, y + 4.6 * (i + 1)); });
    y += 4.6 * info.length + 4;
    doc.setDrawColor(240, 180, 0); doc.setLineWidth(0.8); doc.line(15, y, W - 15, y);
    return y + 7;
  }
  function kaki(doc, teks) {
    var n = doc.internal.getNumberOfPages(), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
    for (var i = 1; i <= n; i++) {
      doc.setPage(i); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120, 126, 138);
      doc.setDrawColor(220, 222, 226); doc.setLineWidth(0.2); doc.line(15, H - 16, W - 15, H - 16);
      doc.text(pdfText(teks), 15, H - 11);
      doc.text('Halaman ' + i + ' dari ' + n, W - 15, H - 11, { align: 'right' });
    }
  }
  /* tabel sederhana: cols [{t, w, align}], rows [[...]]; teks dibungkus; halaman baru otomatis */
  function tabel(doc, y, cols, rows, opt) {
    opt = opt || {};
    var x0 = 15, H = doc.internal.pageSize.getHeight(), lh = 4.2;
    function head() {
      doc.setFillColor(22, 32, 52); doc.rect(x0, y, cols.reduce(function (n, c) { return n + c.w; }, 0), 7.5, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255);
      var x = x0; cols.forEach(function (c) { doc.text(pdfText(c.t), c.align === 'right' ? x + c.w - 2 : x + 2, y + 5, c.align === 'right' ? { align: 'right' } : undefined); x += c.w; });
      y += 7.5;
    }
    head();
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    rows.forEach(function (r, ri) {
      var cells = r.map(function (v, i) { return doc.splitTextToSize(pdfText(v), cols[i].w - 4); });
      var rh = Math.max.apply(null, cells.map(function (c) { return c.length; })) * lh + 3.4;
      if (y + rh > H - 24) { doc.addPage(); y = 18; head(); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5); }
      if (ri % 2) { doc.setFillColor(246, 246, 244); doc.rect(x0, y, cols.reduce(function (n, c) { return n + c.w; }, 0), rh, 'F'); }
      doc.setTextColor(30, 34, 44);
      var x = x0;
      cells.forEach(function (lines, i) {
        var c = cols[i];
        lines.forEach(function (ln, li) { doc.text(ln, c.align === 'right' ? x + c.w - 2 : x + 2, y + 4.6 + li * lh, c.align === 'right' ? { align: 'right' } : undefined); });
        x += c.w;
      });
      y += rh;
    });
    return y;
  }
  function statusLabel(o) { return o.isPaid ? 'LUNAS' : o.status === 'Dibatalkan' ? 'DIBATALKAN' : 'BELUM DIBAYAR'; }
  function itemLabel(it) {
    return [it.nama, it.format && it.format !== 'fisik' ? (FORMAT_LABEL[it.format] || it.format) : '', it.varianLabel || varianLabel(it.varian)].filter(Boolean).join(' | ');
  }
  /** invoicePdf(order) — pembeli pemilik pesanan atau admin; mengunduh INV-<nomor>.pdf */
  async function invoicePdf(order) {
    requireUser();
    var o = order, r = o.ringkasan || {}, b = o.buyer || {}, a = o.alamat, pay = o.pembayaran || {};
    var JsPDF = await loadJsPdf(), settings = await getSettings().catch(function () { return DEFAULT_SETTINGS; });
    var doc = new JsPDF({ unit: 'mm', format: 'a4' }), W = doc.internal.pageSize.getWidth();
    doc.setProperties({ title: 'Invoice ' + o.id + ' - PPAPI', subject: 'Invoice pesanan Toko PPAPI', author: 'PPAPI', creator: 'Toko PPAPI' });
    var y = await kop(doc, 'INVOICE', ['No. INV/' + o.id, 'Tanggal pesanan: ' + tgl(o.createdAt)]);
    /* status */
    var st = statusLabel(o), col = o.isPaid ? [22, 128, 61] : o.status === 'Dibatalkan' ? [180, 35, 24] : [180, 110, 0];
    doc.setDrawColor(col[0], col[1], col[2]); doc.setTextColor(col[0], col[1], col[2]); doc.setLineWidth(0.6);
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    var sw = doc.getTextWidth(st) + 8; doc.roundedRect(W - 15 - sw, y - 5, sw, 8, 1.5, 1.5); doc.text(st, W - 15 - sw / 2, y + 0.6, { align: 'center' });
    /* pihak */
    doc.setTextColor(120, 126, 138); doc.setFontSize(7.5); doc.text('DITAGIHKAN KEPADA', 15, y);
    if (a) doc.text('DIKIRIM KE', 90, y);
    doc.setTextColor(30, 34, 44); doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5);
    doc.text(pdfText(b.name || '-'), 15, y + 5.5);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    [b.email, b.phone].filter(Boolean).forEach(function (t, i) { doc.text(pdfText(t), 15, y + 10 + i * 4.4); });
    var yA = y + 5.5;
    if (a) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5); doc.text(pdfText(a.nama + (a.telepon ? ' (' + a.telepon + ')' : '')), 90, yA);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
      var al = doc.splitTextToSize(pdfText([a.alamat, [a.kota, a.provinsi, a.kodePos].filter(Boolean).join(', ')].filter(Boolean).join(', ')), W - 15 - 90 - (sw + 4));
      al.forEach(function (t, i) { doc.text(t, 90, yA + 4.5 + i * 4.2); });
      yA += 4.5 + al.length * 4.2;
    }
    y = Math.max(y + 20, yA + 4);
    /* butir */
    var rows = (o.items || []).map(function (it, i) { return [String(i + 1), itemLabel(it), String(it.qty), rp(it.harga), rp(it.subtotal)]; });
    y = tabel(doc, y, [{ t: 'No', w: 10 }, { t: 'Produk', w: 88 }, { t: 'Jml', w: 14, align: 'right' }, { t: 'Harga', w: 34, align: 'right' }, { t: 'Subtotal', w: 34, align: 'right' }], rows);
    /* total */
    y += 4;
    var tot = [['Subtotal', rp(r.subtotal)]];
    if (r.hemat) tot.push(['Hemat harga anggota', '- ' + rp(r.hemat)]);
    if (o.perluKirim) tot.push(['Ongkos kirim' + (r.ongkirKurir ? ' (' + r.ongkirKurir + ')' : ''), r.ongkirFinal === false ? 'dikonfirmasi' : rp(r.ongkir)]);
    doc.setFontSize(9);
    tot.forEach(function (t) { doc.setFont('helvetica', 'normal'); doc.setTextColor(60, 66, 78); doc.text(pdfText(t[0]), W - 55, y, { align: 'right' }); doc.text(pdfText(t[1]), W - 15, y, { align: 'right' }); y += 5.2; });
    doc.setFillColor(22, 32, 52); doc.rect(W - 110, y - 3.2, 95, 9, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(255, 255, 255);
    doc.text('TOTAL', W - 55, y + 2.8, { align: 'right' }); doc.text(rp(r.total), W - 17, y + 2.8, { align: 'right' });
    y += 15;
    /* pembayaran */
    doc.setTextColor(120, 126, 138); doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.text('PEMBAYARAN', 15, y); y += 5;
    doc.setTextColor(30, 34, 44); doc.setFontSize(8.5);
    var lines = [];
    if (o.isPaid) {
      lines.push('Pembayaran telah dikonfirmasi sekretariat' + (o.dibayarAt ? ' pada ' + tgl(o.dibayarAt) : '') + '.');
      if (pay.tanggal) lines.push('Transfer tanggal ' + tgl(pay.tanggal) + ' sebesar ' + rp(pay.jumlah) + (pay.pengirim ? ' dari ' + pay.pengirim : '') + '.');
    } else if (o.status === 'Dibatalkan') {
      lines.push('Pesanan dibatalkan' + (o.alasanBatal ? ': ' + o.alasanBatal : '') + '.');
    } else {
      lines.push('Transfer sesuai total ke rekening resmi PPAPI berikut, lalu kirim foto bukti transfer dari halaman Pesanan Saya:');
      (settings.rekening || []).forEach(function (k) { lines.push('- ' + k.bank + ' ' + k.nomor + ' a.n. ' + k.atasNama); });
      if (!(settings.rekening || []).length) lines.push('- Informasi rekening akan diumumkan sekretariat.');
      lines.push('Cantumkan nomor pesanan ' + o.id + ' pada berita transfer bila memungkinkan.');
    }
    lines.forEach(function (t) { doc.splitTextToSize(pdfText(t), W - 30).forEach(function (ln) { doc.text(ln, 15, y); y += 4.4; }); });
    if (o.pengiriman && o.pengiriman.resi) { y += 2; doc.text(pdfText('Pengiriman: ' + (o.pengiriman.kurir || '') + ' resi ' + o.pengiriman.resi), 15, y); }
    kaki(doc, 'Dokumen dibuat otomatis oleh Toko PPAPI pada ' + tgl(nowIso()) + '. Status terkini: ppapi.or.id/pesanan.html');
    return savePdf(doc, 'Invoice-' + o.id + '.pdf');
  }
  /** ringkasanPdf(orders, {judul, periode, admin}) — ringkasan transaksi: rekap status, pendapatan, produk terjual, daftar pesanan */
  async function ringkasanPdf(orders, opt) {
    requireUser(); opt = opt || {};
    var JsPDF = await loadJsPdf();
    var doc = new JsPDF({ unit: 'mm', format: 'a4' }), W = doc.internal.pageSize.getWidth();
    doc.setProperties({ title: 'Ringkasan Transaksi - PPAPI', author: 'PPAPI', creator: 'Toko PPAPI' });
    var list = sortOrders((orders || []).slice()).reverse();
    var y = await kop(doc, 'RINGKASAN TRANSAKSI', [opt.judul || '', 'Periode: ' + (opt.periode || 'semua pesanan'), 'Dicetak: ' + tgl(nowIso())].filter(Boolean));
    var paid = list.filter(function (o) { return o.isPaid; });
    var sum = function (arr, f) { return arr.reduce(function (n, o) { return n + (f(o) || 0); }, 0); };
    var kotak = [
      ['Jumlah pesanan', String(list.length)],
      ['Pesanan lunas', String(paid.length)],
      ['Belum dibayar', String(list.filter(function (o) { return o.isUnpaid; }).length)],
      ['Dibatalkan', String(list.filter(function (o) { return o.status === 'Dibatalkan'; }).length)]
    ];
    var bw = (W - 30 - 9) / 4;
    kotak.forEach(function (k, i) {
      var x = 15 + i * (bw + 3);
      doc.setFillColor(246, 246, 244); doc.rect(x, y, bw, 16, 'F');
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(120, 126, 138); doc.text(pdfText(k[0].toUpperCase()), x + 3, y + 5.5);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(22, 32, 52); doc.text(k[1], x + 3, y + 12.5);
    });
    y += 23;
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(22, 32, 52); doc.text('Nilai transaksi lunas', 15, y); y += 3;
    y = tabel(doc, y, [{ t: 'Uraian', w: 120 }, { t: 'Jumlah', w: 60, align: 'right' }], [
      ['Penjualan produk (subtotal)', rp(sum(paid, function (o) { return o.ringkasan.subtotal; }))],
      ['Ongkos kirim', rp(sum(paid, function (o) { return o.ringkasan.ongkir; }))],
      ['Total diterima', rp(sum(paid, function (o) { return o.ringkasan.total; }))]
    ]) + 8;
    var prod = {};
    paid.forEach(function (o) { (o.items || []).forEach(function (it) { var k = itemLabel(it); prod[k] = prod[k] || { qty: 0, nilai: 0 }; prod[k].qty += it.qty || 0; prod[k].nilai += it.subtotal || 0; }); });
    var pk = Object.keys(prod).sort(function (a, b) { return prod[b].nilai - prod[a].nilai; });
    if (pk.length) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(22, 32, 52); doc.text('Produk terjual (pesanan lunas)', 15, y); y += 3;
      y = tabel(doc, y, [{ t: 'Produk', w: 120 }, { t: 'Jml', w: 20, align: 'right' }, { t: 'Nilai', w: 40, align: 'right' }], pk.map(function (k) { return [k, String(prod[k].qty), rp(prod[k].nilai)]; })) + 8;
    }
    if (y > doc.internal.pageSize.getHeight() - 50) { doc.addPage(); y = 18; }
    doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(22, 32, 52); doc.text('Daftar pesanan', 15, y); y += 3;
    tabel(doc, y, opt.admin
      ? [{ t: 'Tanggal', w: 19 }, { t: 'Nomor', w: 37 }, { t: 'Pembeli', w: 28 }, { t: 'Produk', w: 48 }, { t: 'Total', w: 23, align: 'right' }, { t: 'Status', w: 25 }]
      : [{ t: 'Tanggal', w: 24 }, { t: 'Nomor', w: 38 }, { t: 'Produk', w: 64 }, { t: 'Total', w: 26, align: 'right' }, { t: 'Status', w: 28 }],
      list.map(function (o) {
        var pr = (o.items || []).map(function (it) { return it.qty + 'x ' + it.nama; }).join('; ');
        return opt.admin ? [tgl(o.createdAt), o.id, (o.buyer || {}).name || '-', pr, rp(o.ringkasan.total), o.status]
                         : [tgl(o.createdAt), o.id, pr, rp(o.ringkasan.total), o.status];
      }));
    kaki(doc, 'Ringkasan transaksi Toko PPAPI - dibuat otomatis pada ' + tgl(nowIso()) + '.');
    return savePdf(doc, 'Ringkasan-Transaksi-PPAPI-' + todayIso() + '.pdf');
  }

  /* ---------------------------------------------------------------- admin */
  async function adminListProducts() { await requireAdmin(); return listProducts({ includeInactive: true }); }
  async function adminGetFile(id) {
    await requireAdmin();
    if (local()) return (lsMap(K.files)[id] || {}).url || '';
    var f = await fx();
    try { var s = await f.db.collection('product_files').doc(id).get(); return s.exists ? str((s.data() || {}).url, 1000) : ''; }
    catch (e) { throw mapFs(e); }
  }
  /** saveProduct(product, {foto: [dataUrl] | undefined, fileUrl: string | undefined}) → product */
  async function saveProduct(input, extra) {
    var adm = await requireAdmin();
    extra = extra || {};
    var existing = null, id = str(input && input.id, 60);
    if (id) existing = await getProduct(id);
    var p = sanitizeProduct(Object.assign({}, existing || {}, input || {}), id || '');
    if (p.nama.length < 3) throw err('toko/product-incomplete', 'Nama produk minimal 3 huruf.');
    if (!p.kategori) throw err('toko/product-incomplete', 'Pilih kategori produk.');
    if (int(input && input.harga, 0, 1e9) === null && !existing) throw err('toko/product-incomplete', 'Isi harga produk.');
    if (p.hargaAnggota !== null && p.hargaAnggota >= p.harga) p.hargaAnggota = null;
    if (p.hargaCetakAnggota !== null && p.hargaCetak !== null && p.hargaCetakAnggota >= p.hargaCetak) p.hargaCetakAnggota = null;
    if (!id) {
      var base = slug(p.nama) || 'produk', taken = (await listProducts({ includeInactive: true })).map(function (x) { return x.id; });
      id = base; var n = 2; while (taken.indexOf(id) !== -1) id = base + '-' + n++;
      p.id = id;
    }
    var foto = extra.foto;
    if (Array.isArray(foto)) {
      foto = foto.map(function (x) { return jpeg(x, 210000); }).filter(Boolean).slice(0, LIMITS.foto);
      p.fotoCount = foto.length;
      p.thumb = foto.length ? await thumbFrom(foto[0]) : '';
    }
    var file = extra.fileUrl, uploaded = false;
    if (existing && id) { try { uploaded = (await adminFileMeta(id)).parts > 0; } catch (e) { /* belum ada */ } }
    if (file !== undefined) {
      file = anyUrl(file);
      if (extra.fileUrl && !file) throw err('toko/invalid-url', 'Tautan berkas harus diawali https:// (atau http:// untuk server uji).');
      p.berkasAda = (!!file || uploaded) && isKnowledge(p);
    }
    if (!isKnowledge(p)) p.berkasAda = false;
    var now = nowIso();
    p.createdAt = (existing && existing.createdAt) || now; p.updatedAt = now;
    var doc = clone(p); delete doc.id;
    if (local()) {
      var m = lsMap(K.products), md = lsMap(K.media), fl = lsMap(K.files);
      m[id] = doc;
      if (Array.isArray(foto)) { if (foto.length) md[id] = { foto: foto, updatedAt: now }; else delete md[id]; }
      if (file !== undefined) { if ((file && isKnowledge(p)) || uploaded) fl[id] = Object.assign({}, fl[id] || {}, { url: isKnowledge(p) ? file : '', updatedAt: now, updatedBy: adm.uid }); else delete fl[id]; }
      lsSet(K.media, md); lsSet(K.files, fl); lsSet(K.products, m);
    } else {
      var f = await fx();
      try {
        var batch = f.db.batch();
        doc.createdAt = existing ? (existing.createdAt || now) : now; doc.updatedAt = now;
        batch.set(f.db.collection('products').doc(id), doc);
        if (Array.isArray(foto)) {
          if (foto.length) batch.set(f.db.collection('product_media').doc(id), { foto: foto, updatedAt: serverTs(f) });
          else batch.delete(f.db.collection('product_media').doc(id));
        }
        if (file !== undefined) {
          /* berkas unggahan (parts) tetap disimpan; hanya tautannya yang diubah */
          if ((file && isKnowledge(p)) || uploaded) batch.set(f.db.collection('product_files').doc(id), { url: isKnowledge(p) ? file : '', updatedAt: serverTs(f), updatedBy: adm.uid }, { merge: true });
          else batch.delete(f.db.collection('product_files').doc(id));
        }
        await batch.commit();
      } catch (e) { throw mapFs(e); }
    }
    productCache = null;
    return sanitizeProduct(doc, id);
  }
  async function adminFileMeta(id) {
    await requireAdmin();
    if (local()) return fileMeta(lsMap(K.files)[id]);
    var f = await fx();
    try { var s = await f.db.collection('product_files').doc(id).get(); return fileMeta(s.exists ? s.data() : null); }
    catch (e) { throw mapFs(e); }
  }
  /** saveFile(id, File|Blob|Uint8Array|null, fileName) — unggah berkas PDF privat (dipotong ≤ 900 KB per dokumen);
      null menghapus berkas unggahan. Tautan (url) yang ada tidak diubah. */
  async function saveFile(id, file, fileName) {
    var adm = await requireAdmin();
    var p = await getProduct(id);
    if (!p) throw err('toko/not-found', 'Produk tidak ditemukan. Simpan produk terlebih dahulu.');
    var old = await adminFileMeta(id), bytes = null;
    if (file) {
      bytes = file instanceof Uint8Array ? file : new Uint8Array(await file.arrayBuffer());
      if (bytes.length > MAX_PDF) throw err('toko/file-too-large', 'Berkas PDF maksimal 30 MB.');
      var head = String.fromCharCode.apply(null, bytes.subarray(0, 1024));
      if (head.indexOf('%PDF-') === -1) throw err('toko/pdf-invalid', 'Berkas harus berupa PDF.');
      if (/\/Encrypt\b/.test(String.fromCharCode.apply(null, bytes.subarray(Math.max(0, bytes.length - 4096))))) throw err('toko/pdf-encrypted', 'Unggah PDF tanpa kata sandi; berkas dikunci otomatis saat diunduh pembeli.');
      fileName = str(fileName || (file && file.name) || (p.kode || p.nama) + '.pdf', 120);
    }
    var parts = bytes ? Math.ceil(bytes.length / PART_BYTES) : 0;
    var now = nowIso();
    if (local()) {
      if (bytes) await idbDo('readwrite', function (st) { return st.put(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), id); });
      else await idbDo('readwrite', function (st) { return st.delete(id); });
      var fl = lsMap(K.files), m = lsMap(K.products);
      var meta = Object.assign({}, fl[id] || { url: '' }, { parts: parts, size: bytes ? bytes.length : 0, fileName: bytes ? fileName : '', updatedAt: now, updatedBy: adm.uid });
      if (!parts) { delete meta.parts; delete meta.size; delete meta.fileName; }
      if (!parts && !meta.url) delete fl[id]; else fl[id] = meta;
      if (m[id]) { m[id].berkasAda = !!(parts || meta.url); m[id].updatedAt = now; }
      lsSet(K.files, fl); lsSet(K.products, m);
    } else {
      var f = await fx(), ref = f.db.collection('product_files').doc(id);
      try {
        for (var i = 0; i < parts; i++) {
          await ref.collection('parts').doc(String(i)).set({ b: f.fb.firestore.Blob.fromUint8Array(bytes.subarray(i * PART_BYTES, (i + 1) * PART_BYTES)), i: i });
        }
        for (var j = parts; j < old.parts; j++) await ref.collection('parts').doc(String(j)).delete();
        var doc = { url: old.url || '', updatedAt: serverTs(f), updatedBy: adm.uid };
        if (parts) { doc.parts = parts; doc.size = bytes.length; doc.fileName = fileName; }
        if (parts || doc.url) await ref.set(doc); else await ref.delete();
        await f.db.collection('products').doc(id).update({ berkasAda: !!(parts || doc.url), updatedAt: now });
      } catch (e) { throw mapFs(e); }
    }
    productCache = null;
    return { parts: parts, size: bytes ? bytes.length : 0, fileName: bytes ? fileName : '' };
  }
  async function removeProduct(id) {
    await requireAdmin();
    var fm = await adminFileMeta(id).catch(function () { return { parts: 0 }; });
    if (fm.parts) await saveFile(id, null).catch(function () { /* lanjut hapus produk */ });
    if (local()) {
      ['products', 'media', 'files'].forEach(function (k) { var m = lsMap(K[k]); delete m[id]; lsSet(K[k], m); });
    } else {
      var f = await fx();
      try {
        var b = f.db.batch();
        b.delete(f.db.collection('products').doc(id)); b.delete(f.db.collection('product_media').doc(id)); b.delete(f.db.collection('product_files').doc(id));
        await b.commit();
      } catch (e) { throw mapFs(e); }
    }
    productCache = null;
    return true;
  }
  async function adminListOrders(opts) {
    await requireAdmin();
    opts = opts || {};
    var list;
    if (local()) { var m = lsMap(K.orders); list = Object.keys(m).map(function (id) { return sanitizeOrder(m[id], id); }); }
    else {
      var f = await fx();
      try { var s = await f.db.collection('orders').get(); list = s.docs.map(function (d) { return sanitizeOrder(d.data(), d.id); }); }
      catch (e) { throw mapFs(e); }
    }
    if (opts.status) { var st = [].concat(opts.status); list = list.filter(function (o) { return st.indexOf(o.status) !== -1; }); }
    if (opts.q) {
      var words = String(opts.q).toLowerCase().split(/\s+/).filter(Boolean);
      list = list.filter(function (o) {
        var hay = [o.id, o.buyer.name, o.buyer.email, o.buyer.phone, o.alamat && o.alamat.kota, o.pengiriman && o.pengiriman.resi].concat(o.items.map(function (i) { return i.nama; })).join(' ').toLowerCase();
        return words.every(function (wd) { return hay.indexOf(wd) !== -1; });
      });
    }
    return sortOrders(list);
  }
  /** priceCheck(order, products) → [{nama, format, expected, actual, reason}] — differences vs the catalogue */
  function priceCheck(order, products, buyerIsMember, settings) {
    var byId = Object.create(null); (products || []).forEach(function (p) { byId[p.id] = p; });
    var out = [];
    (order.items || []).forEach(function (it) {
      var p = byId[it.productId];
      if (!p) { out.push({ nama: it.nama, format: it.format, expected: null, actual: it.harga, reason: 'Produk tidak lagi ada di katalog.' }); return; }
      var pr = priceFor(p, it.format, it.hargaAnggota ? true : !!buyerIsMember, it.varian);
      if (pr.harga !== it.harga) out.push({ nama: it.nama, format: it.format, expected: pr.harga, actual: it.harga, reason: it.hargaAnggota ? 'Harga anggota pada pesanan berbeda dengan katalog saat ini.' : 'Harga pada pesanan berbeda dengan katalog saat ini.' });
      if (it.subtotal !== it.harga * it.qty) out.push({ nama: it.nama, format: it.format, expected: it.harga * it.qty, actual: it.subtotal, reason: 'Subtotal tidak sesuai jumlah × harga.' });
    });
    var sum = (order.items || []).reduce(function (n, it) { return n + (it.subtotal || 0); }, 0);
    var r = order.ringkasan || {};
    if (r.ongkirSumber === 'otomatis' && order.alamat) {
      var ln = (order.items || []).map(function (it) { return { item: it, product: byId[it.productId] || null }; });
      var oj = ongkirJne(order.alamat.provinsi, beratKirim(ln));
      if (oj && oj.ongkir !== r.ongkir) out.push({ nama: 'Ongkos kirim JNE', format: '', expected: oj.ongkir, actual: r.ongkir, reason: 'Ongkos kirim berbeda dengan tarif JNE terbaru (tarif diperbarui mingguan, atau berat produk berubah).' });
    }
    /* ongkir otomatis (tabel tarif): hitung ulang dari katalog saat ini */
    if (settings && settings.ongkirMode === 'tabel' && order.perluKirim && r.ongkirFinal !== false && order.alamat) {
      var lines = (order.items || []).map(function (it) { return { item: it, product: byId[it.productId] || null }; });
      var q = shippingQuote(settings, true, { provinsi: order.alamat.provinsi, berat: beratKirim(lines) });
      if (q.final && q.ongkir !== r.ongkir) out.push({ nama: 'Ongkos kirim', format: '', expected: q.ongkir, actual: r.ongkir, reason: 'Ongkos kirim berbeda dengan tabel tarif saat ini (tarif atau berat produk mungkin telah berubah).' });
    }
    if (sum !== r.subtotal || (r.subtotal + (r.ongkir || 0)) !== r.total) out.push({ nama: 'Ringkasan', format: '', expected: sum + (r.ongkir || 0), actual: r.total, reason: 'Total pesanan tidak sesuai penjumlahan butir.' });
    return out;
  }
  async function adminMutate(id, fn) {
    var adm = await requireAdmin();
    if (local()) {
      var m = lsMap(K.orders);
      if (!m[id]) throw err('toko/not-found', 'Pesanan tidak ditemukan.');
      var o = sanitizeOrder(m[id], id);
      var res = await fn(o, adm, {
        products: lsMap(K.products), ent: lsMap(K.ent)
      });
      if (res.products) lsSet(K.products, res.products);
      if (res.ent) lsSet(K.ent, res.ent);
      m[id] = Object.assign({}, m[id], res.patch, { updatedAt: nowIso() });
      lsSet(K.orders, m);
      productCache = null;
      return sanitizeOrder(m[id], id);
    }
    var f = await fx();
    try {
      await f.db.runTransaction(async function (tx) {
        var ref = f.db.collection('orders').doc(id);
        var snap = await tx.get(ref);
        if (!snap.exists) throw err('toko/not-found', 'Pesanan tidak ditemukan.');
        var o = sanitizeOrder(snap.data(), id);
        var ids = o.items.filter(function (it) { return it.format !== 'soft'; }).map(function (it) { return it.productId; }).filter(function (x, i, a) { return a.indexOf(x) === i; });
        var prods = {};
        for (var i = 0; i < ids.length; i++) {
          var ps = await tx.get(f.db.collection('products').doc(ids[i]));
          if (ps.exists) prods[ids[i]] = ps.data();
        }
        var ents = {};
        var softIds = o.items.filter(function (it) { return it.format === 'soft'; }).map(function (it) { return it.productId; });
        for (var j = 0; j < softIds.length; j++) {
          var es = await tx.get(f.db.collection('entitlements').doc(entId(o.uid, softIds[j])));
          if (es.exists) ents[entId(o.uid, softIds[j])] = es.data();
        }
        var before = { products: clone(prods), ent: clone(ents) };
        var res = await fn(o, adm, { products: prods, ent: ents });
        tx.update(ref, Object.assign({}, res.patch, { updatedAt: serverTs(f) }));
        if (res.products) Object.keys(res.products).forEach(function (pid) {
          if (before.products[pid] && res.products[pid].stok !== before.products[pid].stok) tx.update(f.db.collection('products').doc(pid), { stok: res.products[pid].stok, updatedAt: nowIso() });
        });
        if (res.ent) {
          Object.keys(res.ent).forEach(function (k) { if (!before.ent[k]) tx.set(f.db.collection('entitlements').doc(k), Object.assign({}, res.ent[k], { grantedAt: serverTs(f) })); });
          Object.keys(before.ent).forEach(function (k) { if (!res.ent[k]) tx.delete(f.db.collection('entitlements').doc(k)); });
        }
      });
    } catch (e) {
      if (e && /permission-denied/.test(e.code || '')) {
        var step = await diagnoseOrderWrite(f, id).catch(function () { return ''; });
        var er = mapFs(e);
        if (step) er.message = 'Akses ditolak saat ' + step + '. ' + er.message;
        throw er;
      }
      throw mapFs(e);
    }
    productCache = null;
    return readOrder(id);
  }
  /* Bila transaksi admin ditolak aturan Firestore, uji tiap langkah dengan penulisan yang tidak mengubah isi
     (stempel waktu saja; hak unduh dibuat lalu langsung dihapus) agar pesan galat menyebut langkah yang ditolak. */
  async function diagnoseOrderWrite(f, id) {
    var ref = f.db.collection('orders').doc(id), snap;
    try { snap = await ref.get(); } catch (e) { return 'membaca pesanan'; }
    if (!snap.exists) return '';
    try { await ref.update({ updatedAt: serverTs(f) }); } catch (e) { return 'memperbarui pesanan ' + id + ' (periksa hak admin akun ini: dokumen admins/{uid})'; }
    var o = sanitizeOrder(snap.data(), id);
    var fisik = o.items.filter(function (it) { return it.format !== 'soft'; }).map(function (it) { return it.productId; });
    for (var i = 0; i < fisik.length; i++) {
      var pr = f.db.collection('products').doc(fisik[i]);
      try { var ps = await pr.get(); if (ps.exists) await pr.update({ updatedAt: nowIso() }); } catch (e) { return 'memperbarui stok produk "' + fisik[i] + '" (data produk tidak lolos aturan; buka dan simpan ulang produk tersebut)'; }
    }
    var soft = o.items.filter(function (it) { return it.format === 'soft'; }).map(function (it) { return it.productId; });
    for (var j = 0; j < soft.length; j++) {
      var er = f.db.collection('entitlements').doc(entId(o.uid, soft[j]));
      try {
        var es = await er.get();
        if (!es.exists) { await er.set({ uid: o.uid, productId: soft[j], orderId: id, grantedAt: serverTs(f), grantedBy: (me() || {}).uid }); await er.delete(); }
      } catch (e) { return 'membuat hak unduh soft file "' + soft[j] + '"'; }
    }
    return '';
  }
  function stockDelta(o, products, sign) {
    o.items.forEach(function (it) {
      if (it.format === 'soft') return;
      var p = products[it.productId];
      if (!p || p.stok === null || p.stok === undefined || p.stok === '') return;
      p.stok = Math.max(0, Number(p.stok) + sign * it.qty);
    });
  }
  function hist(o, status, note) { return o.riwayat.concat([historyEntry(status, 'admin', note)]).slice(-40); }
  function need(o, allowed, msg) { if (allowed.indexOf(o.status) === -1) throw err('toko/invalid-transition', msg || ('Tindakan ini tidak tersedia untuk pesanan berstatus ' + o.status + '.')); }

  var admin = {
    listProducts: adminListProducts,
    getFile: adminGetFile,
    getFileMeta: adminFileMeta,
    saveFile: saveFile,
    saveProduct: saveProduct,
    removeProduct: removeProduct,
    listOrders: adminListOrders,
    getOrder: async function (id) { await requireAdmin(); return readOrder(id); },
    priceCheck: priceCheck,
    saveSettings: saveSettings,
    confirmPayment: function (id, note) {
      return adminMutate(id, function (o, adm, ctx) {
        need(o, UNPAID, 'Pembayaran hanya dapat dikonfirmasi untuk pesanan yang belum dibayar.');
        if (o.perluKirim && o.ringkasan.ongkirFinal === false) throw err('toko/ongkir-pending', 'Tetapkan ongkos kirim terlebih dahulu agar total pesanan final.');
        stockDelta(o, ctx.products, -1);
        o.items.forEach(function (it) {
          if (it.format !== 'soft') return;
          var k = entId(o.uid, it.productId);
          if (!ctx.ent[k]) ctx.ent[k] = { uid: o.uid, productId: it.productId, orderId: o.id, grantedAt: nowIso(), grantedBy: adm.uid };
        });
        return { patch: { status: 'Dibayar', dibayarAt: nowIso(), dikonfirmasiOleh: adm.uid, catatanAdmin: str(note, 1000), riwayat: hist(o, 'Dibayar', note || 'Pembayaran dikonfirmasi sekretariat.') }, products: ctx.products, ent: ctx.ent };
      });
    },
    rejectPayment: function (id, note) {
      return adminMutate(id, function (o) {
        need(o, ['Menunggu Konfirmasi']);
        var n = str(note, 1000);
        if (n.length < 5) throw err('toko/note-required', 'Tuliskan alasan agar pembeli dapat memperbaiki bukti pembayaran (minimal 5 huruf).');
        return { patch: { status: 'Menunggu Pembayaran', catatanAdmin: n, riwayat: hist(o, 'Menunggu Pembayaran', 'Bukti pembayaran belum dapat diterima: ' + n) } };
      });
    },
    setShipping: function (id, ongkir, note) {
      return adminMutate(id, function (o) {
        need(o, UNPAID, 'Ongkos kirim hanya dapat diubah sebelum pembayaran dikonfirmasi.');
        var v = int(ongkir, 0, 1e8);
        if (v === null) throw err('toko/invalid-amount', 'Isi ongkos kirim dalam rupiah.');
        var r = Object.assign({}, o.ringkasan, { ongkir: v, ongkirFinal: true, ongkirSumber: 'sekretariat', ongkirCatatan: str(note, 500) || 'Ongkos kirim telah ditetapkan sekretariat.' });
        r.total = r.subtotal + v;
        return { patch: { ringkasan: r, riwayat: hist(o, o.status, 'Ongkos kirim ditetapkan ' + rupiah(v) + '. Total pembayaran ' + rupiah(r.total) + '.') } };
      });
    },
    process: function (id, note) {
      return adminMutate(id, function (o) {
        need(o, ['Dibayar']);
        return { patch: { status: 'Diproses', riwayat: hist(o, 'Diproses', note || 'Pesanan sedang disiapkan.') } };
      });
    },
    ship: function (id, data) {
      data = data || {};
      return adminMutate(id, function (o) {
        need(o, ['Dibayar', 'Diproses', 'Dikirim']);
        if (!o.perluKirim) throw err('toko/invalid-transition', 'Pesanan ini hanya berisi soft file — tidak ada pengiriman.');
        var kurir = str(data.kurir, 60), resi = str(data.resi, 60);
        if (kurir.length < 2 || resi.length < 4) throw err('toko/resi-required', 'Isi nama kurir dan nomor resi.');
        var again = o.status === 'Dikirim';
        return { patch: { status: 'Dikirim', pengiriman: { kurir: kurir, resi: resi, dikirimAt: (o.pengiriman && o.pengiriman.dikirimAt) || nowIso() }, riwayat: hist(o, 'Dikirim', (again ? 'Data pengiriman diperbarui: ' : 'Dikirim melalui ') + kurir + ', resi ' + resi + '.') } };
      });
    },
    complete: function (id, note) {
      return adminMutate(id, function (o) {
        need(o, ['Dibayar', 'Diproses', 'Dikirim']);
        return { patch: { status: 'Selesai', selesaiAt: nowIso(), riwayat: hist(o, 'Selesai', note || 'Pesanan selesai.') } };
      });
    },
    cancel: function (id, reason) {
      return adminMutate(id, function (o, adm, ctx) {
        need(o, ['Menunggu Pembayaran', 'Menunggu Konfirmasi', 'Dibayar', 'Diproses']);
        var n = str(reason, 500);
        if (n.length < 5) throw err('toko/note-required', 'Tuliskan alasan pembatalan (minimal 5 huruf).');
        if (o.isPaid) {
          stockDelta(o, ctx.products, +1);
          Object.keys(ctx.ent).forEach(function (k) { if (ctx.ent[k] && ctx.ent[k].orderId === o.id) delete ctx.ent[k]; });
        }
        return { patch: { status: 'Dibatalkan', alasanBatal: n, dibatalkanOleh: 'admin', riwayat: hist(o, 'Dibatalkan', n) }, products: ctx.products, ent: ctx.ent };
      });
    },
    exportOrdersCsv: function (orders) {
      function cell(v) {
        var s = v === null || v === undefined ? '' : String(v);
        if (/^[=+\-@\t\r＝＋－＠]/.test(s)) s = "'" + s;
        return /[;",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }
      var head = ['No. Pesanan', 'Tanggal', 'Status', 'Nama Pemesan', 'Email', 'Telepon', 'Butir', 'Subtotal', 'Ongkos Kirim', 'Total', 'Harga Anggota', 'Tanggal Transfer', 'Jumlah Transfer', 'Pengirim', 'Bukti', 'Penerima', 'Telepon Penerima', 'Alamat', 'Kota', 'Provinsi', 'Kode Pos', 'Kurir', 'Resi'];
      var rows = (orders || []).map(function (o) {
        var a = o.alamat || {}, p = o.pembayaran || {}, s = o.pengiriman || {}, r = o.ringkasan || {};
        return [o.id, (o.createdAt || '').slice(0, 10), o.status, o.buyer.name, o.buyer.email, o.buyer.phone,
          o.items.map(function (i) { return i.qty + '× ' + i.nama + (i.format !== 'fisik' ? ' [' + (FORMAT_LABEL[i.format] || i.format) + ']' : '') + (i.varianLabel ? ' (' + i.varianLabel + ')' : ''); }).join(' | '),
          r.subtotal, r.ongkir === null || r.ongkir === undefined ? '' : r.ongkir, r.total, o.hargaAnggota ? 'Ya' : 'Tidak',
          p.tanggal || '', p.jumlah || '', p.pengirim || '', p.buktiUrl || '', a.nama || '', a.telepon || '', a.alamat || '', a.kota || '', a.provinsi || '', a.kodePos || '', s.kurir || '', s.resi || ''];
      });
      return '﻿' + [head].concat(rows).map(function (r) { return r.map(cell).join(';'); }).join('\r\n');
    },
    summary: async function () {
      var list = await adminListOrders();
      var c = {}; STATUS.forEach(function (s) { c[s] = 0; });
      list.forEach(function (o) { c[o.status]++; });
      return { total: list.length, byStatus: c, perluTindakan: c['Menunggu Konfirmasi'] + c['Dibayar'] + c['Diproses'] };
    }
  };

  PPAPI.toko = {
    version: 1,
    get mode() { return local() ? 'local' : 'firebase'; },
    KATEGORI: KATEGORI.slice(), KATEGORI_INFO: clone(KATEGORI_INFO),
    STATUS: STATUS.slice(), UNPAID: UNPAID.slice(), PAID: PAID.slice(),
    STATUS_TEXT: clone(STATUS_TEXT), STATUS_TONE: clone(STATUS_TONE), FORMAT_LABEL: clone(FORMAT_LABEL), LIMITS: clone(LIMITS),
    fmt: { rupiah: rupiah, statusBadge: statusBadge, varianLabel: varianLabel },
    isKnowledge: isKnowledge, formatsOf: formatsOf, needsShipping: needsShipping, priceFor: priceFor, fromPrice: fromPrice,
    inStock: inStock, stockLeft: stockLeft, sanitizeProduct: sanitizeProduct,
    listProducts: listProducts, getProduct: getProduct, getMedia: getMedia,
    getSettings: getSettings, shippingQuote: shippingQuote, beratKirim: beratKirim, kgTagih: kgTagih, ongkirJne: ongkirJne, validateAlamat: validateAlamat,
    cart: cart,
    createOrder: createOrder, myOrders: myOrders, getOrder: getOrder, submitPayment: submitPayment, cancelOrder: cancelOrder,
    paymentDeadline: paymentDeadline, invoicePdf: invoicePdf, ringkasanPdf: ringkasanPdf, getBukti: getBukti, buktiFromFile: buktiFromFile, hasEntitlement: hasEntitlement, fileUrl: fileUrl, fileInfo: fileInfo, downloadSoft: downloadSoft,
    watermark: watermark, loadPdfLib: loadPdfLib, compressImage: compressImage, watermarkPhoto: watermarkPhoto, MAX_PDF: MAX_PDF, surcharge: surcharge,
    admin: admin
  };
})(window);
