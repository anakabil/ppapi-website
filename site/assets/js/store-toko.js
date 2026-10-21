/* ==========================================================================
   PPAPI — store-toko.js · PPAPI.toko (Toko PPAPI: katalog, keranjang, pesanan)
   Dimuat SETELAH store.js:  config → core → auth → store → store-toko → pages/<halaman>.js

   Mode Firebase (Firestore) ↔ Mode Demo (localStorage peramban ini):
     products/{id}            ppapi_toko_products {id: produk}     dibaca publik bila aktif; ditulis admin
     product_media/{id}       ppapi_toko_media    {id: {foto[]}}   foto ukuran penuh (≤3 × ±150 KB)
     product_files/{id}       ppapi_toko_files    {id: {url}}      tautan PRIVAT soft file — admin atau
                                                                   pembeli yang memiliki hak unduh
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
    'Pakaian': { icon: 'user', slug: 'pakaian', desc: 'Kaus, kemeja, dan rompi kerja dengan identitas PPAPI.' },
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
  var PDFLIB = [
    { src: 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js',
      integrity: 'sha512-z8IYLHO8bTgFqj+yrPyIJnzBDf7DDhWwiEsk4sY+Oe6J2M+WQequeGS7qioI5vT6rXgVRb4K1UVQC5ER7MKzKQ==' },
    { src: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js',
      integrity: 'sha384-weMABwrltA6jWR8DDe9Jp5blk+tZQh7ugpCsF3JwSA53WZM9/14PjS5LAJNHNjAI' }
  ];

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
  function priceFor(p, format, member) {
    var cetak = isKnowledge(p) && format === 'cetak';
    var normal = cetak ? p.hargaCetak : p.harga;
    var ang = cetak ? p.hargaCetakAnggota : p.hargaAnggota;
    if (normal === null || normal === undefined) normal = p.harga || 0;
    var use = !!member && ang !== null && ang !== undefined && ang < normal;
    return { harga: use ? ang : normal, normal: normal, anggota: use, hargaAnggota: ang === undefined ? null : ang };
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
      var opsi = (Array.isArray(g && g.opsi) ? g.opsi : String((g && g.opsi) || '').split(','))
        .map(function (o) { return str(o, 30); }).filter(Boolean);
      opsi = opsi.filter(function (o, i) { return opsi.indexOf(o) === i; }).slice(0, LIMITS.varianOpsi);
      if (nama && opsi.length) p.varian.push({ nama: nama, opsi: opsi });
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
  var DEFAULT_SETTINGS = { rekening: [], ongkirMode: 'konfirmasi', ongkirFlat: null, ongkirCatatan: '', catatanPembayaran: '', batasBayarJam: 48, kontak: '' };
  function sanitizeSettings(raw) {
    raw = raw || {};
    var s = {
      rekening: (Array.isArray(raw.rekening) ? raw.rekening : []).slice(0, LIMITS.rekening).map(function (r) {
        return { bank: str(r && r.bank, 60), nomor: str(r && r.nomor, 40).replace(/[^\d\s.-]/g, ''), atasNama: str(r && r.atasNama, 120) };
      }).filter(function (r) { return r.bank && r.nomor && r.atasNama; }),
      ongkirMode: raw.ongkirMode === 'flat' ? 'flat' : 'konfirmasi',
      ongkirFlat: int(raw.ongkirFlat, 0, 1e8),
      ongkirCatatan: str(raw.ongkirCatatan, 500),
      catatanPembayaran: str(raw.catatanPembayaran, 1000),
      batasBayarJam: int(raw.batasBayarJam, 0, 720),
      kontak: str(raw.kontak, 200),
      updatedAt: iso(raw.updatedAt)
    };
    if (s.batasBayarJam === null) s.batasBayarJam = 48;
    if (s.ongkirMode === 'flat' && s.ongkirFlat === null) s.ongkirMode = 'konfirmasi';
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
    var out = { rekening: s.rekening, ongkirMode: s.ongkirMode, ongkirFlat: s.ongkirFlat, ongkirCatatan: s.ongkirCatatan, catatanPembayaran: s.catatanPembayaran, batasBayarJam: s.batasBayarJam, kontak: s.kontak };
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
  function shippingQuote(settings, perluKirim) {
    if (!perluKirim) return { ongkir: 0, final: true, catatan: '' };
    if (settings.ongkirMode === 'flat' && settings.ongkirFlat !== null) return { ongkir: settings.ongkirFlat, final: true, catatan: settings.ongkirCatatan || 'Ongkos kirim tetap ke seluruh Indonesia.' };
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
        line.price = priceFor(p, it.format, member);
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
    var q = shippingQuote(settings, perluKirim);
    var id = 'PSN-' + ymd() + '-' + rand(5);
    var order = {
      id: id, uid: u.uid, buyer: buyer, items: items, perluKirim: perluKirim, alamat: alamat,
      ringkasan: { subtotal: subtotal, hemat: Math.max(0, normal - subtotal), ongkir: q.ongkir, ongkirFinal: q.final, ongkirCatatan: q.catatan, total: subtotal + (q.ongkir || 0) },
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
  async function submitPayment(id, data) {
    var u = requireUser();
    var o = await getOrder(id);
    if (!o || o.uid !== u.uid) throw err('toko/not-found', 'Pesanan tidak ditemukan.');
    if (!o.isUnpaid) throw err('toko/invalid-transition', 'Bukti pembayaran hanya dapat dikirim untuk pesanan yang belum dibayar.');
    data = data || {};
    var p = {
      buktiUrl: httpsUrl(data.buktiUrl), tanggal: str(data.tanggal, 10), jumlah: int(data.jumlah, 0, 1e10),
      pengirim: str(data.pengirim, 120), catatan: str(data.catatan, 500), dikirimAt: nowIso()
    };
    var bad = [];
    if (!p.buktiUrl) bad.push({ key: 'buktiUrl', label: 'Tautan bukti pembayaran (https://…)' });
    if (!/^\d{4}-\d{2}-\d{2}$/.test(p.tanggal) || p.tanggal > todayIso()) bad.push({ key: 'tanggal', label: 'Tanggal transfer (tidak boleh setelah hari ini)' });
    if (!p.jumlah || p.jumlah <= 0) bad.push({ key: 'jumlah', label: 'Jumlah yang ditransfer' });
    if (p.pengirim.length < 3) bad.push({ key: 'pengirim', label: 'Nama pemilik rekening pengirim' });
    if (bad.length) { var e = err('toko/payment-incomplete', 'Lengkapi: ' + bad.map(function (b) { return b.label; }).join(', ') + '.'); e.missing = bad; throw e; }
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
  /** fileUrl(productId) → url — admin, or a buyer whose payment was confirmed (entitlement). */
  async function fileUrl(productId) {
    var u = requireUser();
    var denied = err('toko/forbidden', 'Berkas ini dapat dibuka setelah pembayaran pesanan Anda dikonfirmasi sekretariat.');
    if (local()) {
      var ok = !!lsMap(K.ent)[entId(u.uid, productId)] || (await isAdmin());
      if (!ok) throw denied;
      return ((lsMap(K.files)[productId] || {}).url) || '';
    }
    var f = await fx();
    try { var s = await f.db.collection('product_files').doc(productId).get(); return s.exists ? str((s.data() || {}).url, 1000) : ''; }
    catch (e) { if (e && /permission-denied/.test(e.code || '')) throw denied; throw mapFs(e); }
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
  function loadPdfLib() {
    if (w.PDFLib && w.PDFLib.PDFDocument) return Promise.resolve(w.PDFLib);
    if (pdfLibP) return pdfLibP;
    pdfLibP = (async function () {
      for (var i = 0; i < PDFLIB.length; i++) {
        try { await loadScript(PDFLIB[i].src, PDFLIB[i].integrity); if (w.PDFLib && w.PDFLib.PDFDocument) return w.PDFLib; } catch (e) { /* next */ }
      }
      pdfLibP = null;
      throw err('toko/pdf-lib', 'Pustaka pengolah PDF tidak dapat dimuat. Periksa koneksi internet Anda, lalu coba lagi.');
    })();
    return pdfLibP;
  }
  function latin(s) {   // the standard Helvetica font encodes WinAnsi only
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '?');
  }
  /** watermark(bytes, {nama, email, orderId, tanggal}) → Uint8Array (every page: diagonal + footer line) */
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
    return doc.save({ useObjectStreams: false });
  }
  /** downloadSoft(order, item) → {ok:true, fileName} | {ok:false, reason, url, message}
      reason: 'cors' (host blocks fetch) | 'not-pdf' | 'encrypted' | 'invalid' | 'lib' | 'no-file' */
  async function downloadSoft(order, item) {
    var u = requireUser();
    if (!order || !order.isPaid) throw err('toko/forbidden', 'Berkas dapat diunduh setelah pembayaran dikonfirmasi sekretariat.');
    if (!item || item.format !== 'soft') throw err('toko/invalid-item', 'Butir ini bukan soft file.');
    var url = await fileUrl(item.productId);
    if (!url) return { ok: false, reason: 'no-file', url: '', message: 'Sekretariat belum menautkan berkas untuk produk ini. Silakan hubungi sekretariat.' };
    var bytes;
    try {
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
      out = await watermark(bytes, { nama: order.buyer.name || u.name, email: order.buyer.email || u.email, orderId: order.id, tanggal: todayIso() });
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
    return { ok: true, fileName: name, bytes: out.length };
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
  async function thumbFrom(dataUrl) {
    var img = await new Promise(function (resolve, reject) { var i = new Image(); i.onload = function () { resolve(i); }; i.onerror = reject; i.src = dataUrl; });
    return compressImage({ img: img }, { max: 560, maxKB: LIMITS.thumbKB });
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
    var file = extra.fileUrl;
    if (file !== undefined) {
      file = anyUrl(file);
      if (extra.fileUrl && !file) throw err('toko/invalid-url', 'Tautan berkas harus diawali https:// (atau http:// untuk server uji).');
      p.berkasAda = !!file && isKnowledge(p);
    }
    if (!isKnowledge(p)) p.berkasAda = false;
    var now = nowIso();
    p.createdAt = (existing && existing.createdAt) || now; p.updatedAt = now;
    var doc = clone(p); delete doc.id;
    if (local()) {
      var m = lsMap(K.products), md = lsMap(K.media), fl = lsMap(K.files);
      m[id] = doc;
      if (Array.isArray(foto)) { if (foto.length) md[id] = { foto: foto, updatedAt: now }; else delete md[id]; }
      if (file !== undefined) { if (file && isKnowledge(p)) fl[id] = { url: file, updatedAt: now, updatedBy: adm.uid }; else delete fl[id]; }
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
          if (file && isKnowledge(p)) batch.set(f.db.collection('product_files').doc(id), { url: file, updatedAt: serverTs(f), updatedBy: adm.uid });
          else batch.delete(f.db.collection('product_files').doc(id));
        }
        await batch.commit();
      } catch (e) { throw mapFs(e); }
    }
    productCache = null;
    return sanitizeProduct(doc, id);
  }
  async function removeProduct(id) {
    await requireAdmin();
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
  function priceCheck(order, products, buyerIsMember) {
    var byId = Object.create(null); (products || []).forEach(function (p) { byId[p.id] = p; });
    var out = [];
    (order.items || []).forEach(function (it) {
      var p = byId[it.productId];
      if (!p) { out.push({ nama: it.nama, format: it.format, expected: null, actual: it.harga, reason: 'Produk tidak lagi ada di katalog.' }); return; }
      var pr = priceFor(p, it.format, it.hargaAnggota ? true : !!buyerIsMember);
      if (pr.harga !== it.harga) out.push({ nama: it.nama, format: it.format, expected: pr.harga, actual: it.harga, reason: it.hargaAnggota ? 'Harga anggota pada pesanan berbeda dengan katalog saat ini.' : 'Harga pada pesanan berbeda dengan katalog saat ini.' });
      if (it.subtotal !== it.harga * it.qty) out.push({ nama: it.nama, format: it.format, expected: it.harga * it.qty, actual: it.subtotal, reason: 'Subtotal tidak sesuai jumlah × harga.' });
    });
    var sum = (order.items || []).reduce(function (n, it) { return n + (it.subtotal || 0); }, 0);
    var r = order.ringkasan || {};
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
    } catch (e) { throw mapFs(e); }
    productCache = null;
    return readOrder(id);
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
        var r = Object.assign({}, o.ringkasan, { ongkir: v, ongkirFinal: true, ongkirCatatan: str(note, 500) || 'Ongkos kirim telah ditetapkan sekretariat.' });
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
    getSettings: getSettings, shippingQuote: shippingQuote, validateAlamat: validateAlamat,
    cart: cart,
    createOrder: createOrder, myOrders: myOrders, getOrder: getOrder, submitPayment: submitPayment, cancelOrder: cancelOrder,
    paymentDeadline: paymentDeadline, hasEntitlement: hasEntitlement, fileUrl: fileUrl, downloadSoft: downloadSoft,
    watermark: watermark, loadPdfLib: loadPdfLib, compressImage: compressImage,
    admin: admin
  };
})(window);
