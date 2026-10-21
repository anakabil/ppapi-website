/* ==========================================================================
   PPAPI — Data aplikasi anggota per akun  (assets/js/store-apps.js)
   --------------------------------------------------------------------------
   Data aplikasi anggota (perencanaan & inspeksi, simulator) melekat ke akun
   yang dipakai untuk masuk, sehingga dapat dibuka kembali dari perangkat mana
   pun dan tidak hilang bila peramban dibersihkan.

   Dimuat SETELAH config.js, core.js, auth.js, store.js (aplikasi/gate.js
   memuatnya untuk kedua halaman aplikasi).

   Lokasi data
     Firebase : Firestore  app_data/{uid}/{app}/{docId}
                           app_data/{uid}/{app}_media/{docId}   (foto, gambar, berkas besar)
     Demo     : localStorage 'ppapi_appdata/{uid}/{app}/{docId}' (hanya di peramban ini)

   Bentuk dokumen tersimpan (sama di kedua mode; aturan Firestore memeriksanya):
     { v: 1, meta: {…≤24 kunci datar}, data: '<JSON>', size: <byte data>,
       updatedAt: <ms>, parent: '<id induk>' | '' }
   Isi aplikasi disimpan sebagai teks JSON (`data`) sehingga bentuknya bebas
   (array bertingkat, kunci apa pun) dan ukurannya mudah diperiksa. Setiap
   dokumen dibatasi LIMIT (800.000 byte) — di bawah batas Firestore 1 MiB.
   Bagian yang lebih besar wajib dipecah (lihat media & compressImage).

   API (semua mengembalikan Promise):
     PPAPI.appData.list(app)                → [{ id, meta, updatedAt, size, parent, pending }]
     PPAPI.appData.get(app, id)             → { id, meta, data, updatedAt, size, parent, pending } | null
     PPAPI.appData.save(app, id, doc)       doc = { meta?, data, updatedAt?, parent?, force? }
                                            → { id, updatedAt, synced, queued, conflict?, remote? }
     PPAPI.appData.remove(app, id, opts)    → { synced, queued, conflict? }
     PPAPI.appData.listMedia(app, parent)   → [{ id, meta, data, updatedAt, size, parent }]
       (media: app = '<app>_media' untuk save/get/remove; listMedia menambahkannya sendiri)
     PPAPI.appData.compressImage(dataUrl, { maxBytes, maxDim }) → dataUrl JPEG | ''
     PPAPI.appData.bytes(str)  · LIMIT · mode() · flush() · pending() · status() · onStatus(cb)

   Aturan sinkron
     • Last-write-wins dengan updatedAt: dokumen di akun yang LEBIH BARU tidak
       ditimpa (hasil { conflict: true, remote }); aplikasi yang memutuskan
       (perencanaan menyimpan versi perangkat ini sebagai salinan).
     • Antrean luring: setiap penulisan masuk antrean di localStorage
       ('ppapi_appdata_q_<uid>') lebih dulu, lalu dikirim. Gagal jaringan →
       { queued: true } dan dicoba lagi (5 dtk → 60 dtk, saat kembali daring,
       saat halaman terlihat lagi). Penolakan aturan → error (tidak diulang).
     • Media (`*_media`) ditulis langsung (tanpa transaksi) karena isinya
       ditentukan dokumen induk.
   ========================================================================== */
(function (w) {
  'use strict';

  var PPAPI = w.PPAPI = w.PPAPI || {};
  var LIMIT = 800000;                       /* byte per dokumen (Firestore: 1 MiB termasuk nama kolom) */
  var TIMEOUT_MS = 15000;
  var Q_PREFIX = 'ppapi_appdata_q_';
  var IDX_PREFIX = 'ppapi_appdata_idx_';
  var DEMO_PREFIX = 'ppapi_appdata/';
  var RETRY = [5000, 15000, 30000, 60000];

  /* ---------------- utilitas ---------------- */
  function appError(code, message, cause) {
    var e = new Error(message);
    e.code = code;
    if (cause) e.cause = cause;
    return e;
  }
  var MSG = {
    'appdata/invalid-app': 'Nama aplikasi tidak dikenal.',
    'appdata/invalid-id': 'Kode data tidak valid.',
    'appdata/invalid-data': 'Data yang akan disimpan tidak valid.',
    'appdata/too-large': 'Data terlalu besar untuk disimpan ke akun (maksimal ±800 KB per bagian).',
    'appdata/signed-out': 'Sesi Anda telah berakhir. Silakan masuk kembali.',
    'appdata/quota': 'Penyimpanan peramban penuh. Data tetap ada di layar; hapus foto atau unggahan yang tidak diperlukan, lalu coba lagi.',
    'appdata/offline': 'Akun belum dapat dihubungi. Periksa koneksi internet; data akan dikirim otomatis setelah tersambung.',
    'appdata/permission-denied': 'Akses ke data aplikasi ditolak. Muat ulang halaman lalu coba lagi.',
    'appdata/failed': 'Gagal menyimpan data aplikasi. Silakan coba lagi.'
  };
  function E(code, cause) { return appError(code, MSG[code] || MSG['appdata/failed'], cause); }

  function collOk(c) { return typeof c === 'string' && /^(perencanaan|simulator)(_media)?$/.test(c); }
  function idOk(id) { return typeof id === 'string' && /^[A-Za-z0-9_-]{1,120}$/.test(id); }
  function check(coll, id) {
    if (!collOk(coll)) throw E('appdata/invalid-app');
    if (id !== undefined && !idOk(id)) throw E('appdata/invalid-id');
  }
  function mode() { return PPAPI.auth && PPAPI.auth.mode === 'firebase' ? 'firebase' : 'demo'; }
  function currentUid() {
    try { var u = PPAPI.auth && PPAPI.auth.current && PPAPI.auth.current(); return (u && u.uid) || ''; } catch (e) { return ''; }
  }
  function requireUid() {
    var u = currentUid();
    if (!u) throw E('appdata/signed-out');
    return u;
  }
  /* panjang UTF-8 sebuah teks (Firestore menghitung byte, bukan karakter) */
  function bytes(s) {
    s = String(s == null ? '' : s);
    if (typeof w.TextEncoder === 'function') return new w.TextEncoder().encode(s).length;
    var n = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s.charCodeAt(i);
      if (c < 0x80) n += 1; else if (c < 0x800) n += 2;
      else if (c >= 0xd800 && c <= 0xdbff) { n += 4; i++; } else n += 3;
    }
    return n;
  }
  function isMap(o) { return !!o && typeof o === 'object' && !Array.isArray(o); }
  /* meta: datar, ≤ 24 kunci, nilai teks ≤ 300 / angka / boolean */
  function cleanMeta(m) {
    var out = {};
    if (!isMap(m)) return out;
    Object.keys(m).slice(0, 24).forEach(function (k) {
      if (!/^[A-Za-z0-9_]{1,40}$/.test(k)) return;
      var v = m[k];
      if (typeof v === 'string') out[k] = v.slice(0, 300);
      else if (typeof v === 'number' && isFinite(v)) out[k] = v;
      else if (typeof v === 'boolean') out[k] = v;
    });
    return out;
  }
  function lsGet(k) { try { var r = w.localStorage.getItem(k); return r == null ? null : JSON.parse(r); } catch (e) { return null; } }
  function lsSet(k, v) { w.localStorage.setItem(k, JSON.stringify(v)); }   /* boleh melempar (kuota) */
  function lsDel(k) { try { w.localStorage.removeItem(k); } catch (e) { /* abaikan */ } }
  function lsKeys(prefix) {
    var out = [];
    try { for (var i = 0; i < w.localStorage.length; i++) { var k = w.localStorage.key(i); if (k && k.indexOf(prefix) === 0) out.push(k); } } catch (e) { /* abaikan */ }
    return out;
  }

  /* rekaman tersimpan ← doc aplikasi */
  function encode(doc) {
    if (!isMap(doc) || doc.data === undefined) throw E('appdata/invalid-data');
    var data;
    try { data = JSON.stringify(doc.data); } catch (e) { throw E('appdata/invalid-data', e); }
    if (typeof data !== 'string') throw E('appdata/invalid-data');
    var size = bytes(data);
    if (size > LIMIT) { var big = E('appdata/too-large'); big.size = size; big.limit = LIMIT; throw big; }
    var ts = Number(doc.updatedAt);
    if (!isFinite(ts) || ts <= 0) ts = Date.now();
    var parent = typeof doc.parent === 'string' && idOk(doc.parent) ? doc.parent : '';
    return { v: 1, meta: cleanMeta(doc.meta), data: data, size: size, updatedAt: Math.round(ts), parent: parent };
  }
  /* doc aplikasi ← rekaman tersimpan */
  function decode(id, rec, withData) {
    if (!isMap(rec)) return null;
    var out = {
      id: id, meta: isMap(rec.meta) ? rec.meta : {}, updatedAt: Number(rec.updatedAt) || 0,
      size: Number(rec.size) || 0, parent: typeof rec.parent === 'string' ? rec.parent : ''
    };
    if (withData) {
      try { out.data = typeof rec.data === 'string' ? JSON.parse(rec.data) : null; } catch (e) { out.data = null; }
    }
    return out;
  }

  /* ---------------- status (untuk penanda "Tersimpan ke akun") ---------------- */
  var listeners = [];
  var ST = { state: 'idle', pending: 0, at: 0, message: '' };
  function setStatus(patch) {
    Object.keys(patch).forEach(function (k) { ST[k] = patch[k]; });
    ST.pending = Q.items.length;
    var snap = status();
    listeners.slice().forEach(function (cb) { try { cb(snap); } catch (e) { /* abaikan */ } });
  }
  /* durable: antrean tersimpan di localStorage (false = hanya di memori karena kuota penuh) */
  function status() { return { state: ST.state, pending: ST.pending, at: ST.at, message: ST.message, mode: mode(), durable: !Q.memOnly }; }

  /* ---------------- Mode Demo: localStorage ---------------- */
  function dKey(uid, coll, id) { return DEMO_PREFIX + uid + '/' + coll + '/' + id; }
  var demo = {
    list: function (uid, coll, where) {
      var pre = DEMO_PREFIX + uid + '/' + coll + '/';
      return lsKeys(pre).map(function (k) { return { id: k.slice(pre.length), rec: lsGet(k) }; })
        .filter(function (x) { return isMap(x.rec) && (!where || x.rec.parent === where); });
    },
    get: function (uid, coll, id) { return lsGet(dKey(uid, coll, id)); },
    set: function (uid, coll, id, rec) {
      try { lsSet(dKey(uid, coll, id), rec); } catch (e) { throw E('appdata/quota', e); }
    },
    del: function (uid, coll, id) { lsDel(dKey(uid, coll, id)); }
  };

  /* ---------------- Mode Firebase: Firestore ---------------- */
  function fdb() {
    var p = PPAPI.auth && typeof PPAPI.auth._firebase === 'function' ? PPAPI.auth._firebase() : Promise.resolve(null);
    return Promise.resolve(p).then(function (fx) {
      if (!fx || !fx.db) throw E('appdata/offline');
      return fx.db;
    });
  }
  function ref(db, uid, coll, id) { return db.collection('app_data').doc(uid).collection(coll).doc(id); }
  function withTimeout(p) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(appError('appdata/timeout', MSG['appdata/offline'])); }, TIMEOUT_MS);
      p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }
  function rawCode(e) { return String((e && e.code) || '').replace(/^(firestore|appdata)\//, ''); }
  /* gangguan jaringan/layanan → dicoba lagi; penolakan aturan/data → tidak */
  function retriable(e) {
    var c = rawCode(e);
    return ['permission-denied', 'invalid-argument', 'invalid-app', 'invalid-id', 'invalid-data', 'too-large',
            'not-found', 'quota', 'signed-out'].indexOf(c) === -1;
  }
  function mapErr(e) {
    var c = rawCode(e);
    if (e && /^appdata\//.test(e.code || '') && MSG[e.code]) return e;
    if (c === 'permission-denied') return E('appdata/permission-denied', e);
    if (c === 'invalid-argument') return E('appdata/invalid-data', e);
    if (c === 'unauthenticated') return E('appdata/signed-out', e);
    if (retriable(e)) return E('appdata/offline', e);
    return E('appdata/failed', e);
  }
  var fire = {
    list: function (uid, coll, where) {
      return fdb().then(function (db) {
        var q = db.collection('app_data').doc(uid).collection(coll);
        if (where) q = q.where('parent', '==', where);
        return withTimeout(q.get());
      }).then(function (snap) {
        var out = [];
        snap.forEach(function (s) { out.push({ id: s.id, rec: s.data() }); });
        return out;
      });
    },
    get: function (uid, coll, id) {
      return fdb().then(function (db) { return withTimeout(ref(db, uid, coll, id).get()); })
        .then(function (s) { return s.exists ? s.data() : null; });
    },
    /* op: { op:'save'|'remove', uid, coll, id, rec?, ts, force? } → { ok } | { conflict, remote } */
    write: function (op) {
      return fdb().then(function (db) {
        var r = ref(db, op.uid, op.coll, op.id);
        if (/_media$/.test(op.coll)) {
          return withTimeout(op.op === 'save' ? r.set(op.rec) : r.delete()).then(function () { return { ok: true }; });
        }
        return withTimeout(db.runTransaction(function (t) {
          return t.get(r).then(function (s) {
            var cur = s.exists ? s.data() : null;
            var curTs = cur && typeof cur.updatedAt === 'number' ? cur.updatedAt : 0;
            var mine = op.op === 'save' ? op.rec.updatedAt : op.ts;
            if (cur && curTs > mine && !op.force) return { conflict: true, remote: decode(op.id, cur, true) };
            if (op.op === 'save') t.set(r, op.rec);
            else if (cur) t.delete(r);
            return { ok: true };
          });
        }));
      });
    }
  };

  /* ---------------- antrean luring (Mode Firebase) ---------------- */
  var Q = { uid: '', items: [], memOnly: false, timer: null, tries: 0, running: false };
  var waiters = {};                          /* kunci → [{resolve, reject}] (hanya di memori) */
  function qKey(op) { return op.coll + '/' + op.id; }
  function qLoad(uid) {
    if (Q.uid === uid) return;
    Q.uid = uid; Q.tries = 0; Q.memOnly = false;
    var l = uid ? lsGet(Q_PREFIX + uid) : null;
    Q.items = Array.isArray(l) ? l.filter(function (x) { return isMap(x) && collOk(x.coll) && idOk(x.id) && (x.op === 'save' || x.op === 'remove'); }) : [];
  }
  function qSave() {
    if (!Q.uid) return;
    try {
      if (Q.items.length) lsSet(Q_PREFIX + Q.uid, Q.items); else lsDel(Q_PREFIX + Q.uid);
      Q.memOnly = false;
    } catch (e) {
      /* kuota penuh: antrean tetap di memori; aplikasi menyimpan salinan kerjanya sendiri */
      Q.memOnly = true;
    }
  }
  function qPut(op) {
    var k = qKey(op);
    Q.items = Q.items.filter(function (x) { return qKey(x) !== k; });
    Q.items.push(op);
    qSave();
  }
  function qDrop(op) {
    var k = qKey(op);
    Q.items = Q.items.filter(function (x) { return !(qKey(x) === k && x.ts === op.ts); });
    qSave();
  }
  function settle(k, fn) {
    var list = waiters[k] || [];
    delete waiters[k];
    list.forEach(fn);
  }
  function wait(k) {
    return new Promise(function (resolve, reject) { (waiters[k] = waiters[k] || []).push({ resolve: resolve, reject: reject }); });
  }
  function offline() { return w.navigator && w.navigator.onLine === false; }
  function schedule(ms) {
    clearTimeout(Q.timer);
    Q.timer = setTimeout(flush, ms);
  }
  /* kirim isi antrean berurutan; berhenti pada gangguan jaringan */
  function flush() {
    if (mode() !== 'firebase') return Promise.resolve(status());
    var uid = currentUid();
    if (!uid) return Promise.resolve(status());
    qLoad(uid);
    if (Q.running) return Promise.resolve(status());
    if (!Q.items.length) { setStatus({ state: ST.state === 'pending' || ST.state === 'saving' ? 'saved' : ST.state }); return Promise.resolve(status()); }
    if (offline()) {
      Q.items.forEach(function (op) { settle(qKey(op), function (x) { x.resolve({ id: op.id, updatedAt: op.ts, synced: false, queued: true }); }); });
      setStatus({ state: 'pending', message: MSG['appdata/offline'] });
      return Promise.resolve(status());
    }
    Q.running = true;
    setStatus({ state: 'saving', message: '' });
    function next() {
      if (Q.uid !== currentUid()) { Q.running = false; return status(); }
      var op = Q.items[0];
      if (!op) {
        Q.running = false; Q.tries = 0;
        setStatus({ state: 'saved', at: Date.now(), message: '' });
        return status();
      }
      var k = qKey(op);
      return fire.write(op).then(function (res) {
        qDrop(op);
        var still = Q.items.some(function (x) { return qKey(x) === k; });   /* ada versi yang lebih baru di antrean */
        if (!still) {
          settle(k, function (x) {
            if (res && res.conflict) x.resolve({ id: op.id, updatedAt: op.ts, synced: false, queued: false, conflict: true, remote: res.remote });
            else x.resolve({ id: op.id, updatedAt: op.ts, synced: true, queued: false });
          });
        }
        return next();
      }, function (e) {
        if (retriable(e)) {
          Q.running = false;
          var delay = RETRY[Math.min(Q.tries, RETRY.length - 1)];
          Q.tries++;
          Q.items.forEach(function (o) { settle(qKey(o), function (x) { x.resolve({ id: o.id, updatedAt: o.ts, synced: false, queued: true }); }); });
          setStatus({ state: 'pending', message: MSG['appdata/offline'] });
          schedule(delay);
          return status();
        }
        qDrop(op);
        var err = mapErr(e);
        settle(k, function (x) { x.reject(err); });
        setStatus({ state: 'error', message: err.message });
        return next();
      });
    }
    return next();
  }
  function enqueue(op) {
    qLoad(op.uid);
    var k = qKey(op);
    var p = wait(k);
    qPut(op);
    setStatus({ state: 'saving' });
    if (!Q.running) flush(); else schedule(50);
    return p;
  }

  /* ---------------- indeks lokal (daftar terakhir, untuk tampilan luring) ---------------- */
  function idxKey(uid, coll) { return IDX_PREFIX + uid + '_' + coll; }
  function idxSave(uid, coll, list) {
    try { lsSet(idxKey(uid, coll), list.map(function (x) { return { id: x.id, meta: x.meta, updatedAt: x.updatedAt, size: x.size, parent: x.parent }; })); } catch (e) { /* abaikan */ }
  }
  function overlayQueue(uid, coll, list, where) {
    if (mode() !== 'firebase') return list;
    qLoad(uid);
    var map = {};
    list.forEach(function (x) { map[x.id] = x; });
    Q.items.forEach(function (op) {
      if (op.uid !== uid || op.coll !== coll) return;
      if (op.op === 'remove') { delete map[op.id]; return; }
      if (where && op.rec.parent !== where) return;
      var d = decode(op.id, op.rec, true);
      d.pending = true;
      map[op.id] = d;
    });
    return Object.keys(map).map(function (k) { return map[k]; });
  }

  /* ---------------- API publik ---------------- */
  function list(app) {
    return Promise.resolve().then(function () {
      check(app);
      var uid = requireUid();
      if (mode() !== 'firebase') {
        return demo.list(uid, app).map(function (x) { return decode(x.id, x.rec, false); });
      }
      return fire.list(uid, app).then(function (rows) {
        var l = rows.map(function (x) { return decode(x.id, x.rec, false); });
        idxSave(uid, app, l);
        return l;
      }, function (e) {
        if (!retriable(e)) throw mapErr(e);
        var cached = lsGet(idxKey(uid, app));
        var l = (Array.isArray(cached) ? cached : []).map(function (x) { var d = decode(x.id, x, false); d.stale = true; return d; });
        l.stale = true;
        return l;
      }).then(function (l) {
        var out = overlayQueue(uid, app, l).map(function (d) { var o = { id: d.id, meta: d.meta, updatedAt: d.updatedAt, size: d.size, parent: d.parent, pending: !!d.pending }; if (d.stale) o.stale = true; return o; });
        if (l.stale) out.stale = true;
        return out;
      });
    }).then(function (l) {
      var stale = l.stale;
      l.sort(function (a, b) { return b.updatedAt - a.updatedAt; });
      if (stale) l.stale = true;
      return l;
    });
  }
  function get(app, id) {
    return Promise.resolve().then(function () {
      check(app, id);
      var uid = requireUid();
      if (mode() !== 'firebase') return decode(id, demo.get(uid, app, id), true);
      qLoad(uid);
      var q = null;
      Q.items.forEach(function (op) { if (op.uid === uid && op.coll === app && op.id === id) q = op; });
      if (q) {
        if (q.op === 'remove') return null;
        var d = decode(id, q.rec, true); d.pending = true; return d;
      }
      return fire.get(uid, app, id).then(function (rec) { return decode(id, rec, true); }, function (e) { throw mapErr(e); });
    });
  }
  function save(app, id, doc) {
    return Promise.resolve().then(function () {
      check(app, id);
      var uid = requireUid();
      var rec = encode(doc);
      if (mode() !== 'firebase') {
        var cur = demo.get(uid, app, id);
        if (cur && !/_media$/.test(app) && Number(cur.updatedAt) > rec.updatedAt && !doc.force) {
          return { id: id, updatedAt: rec.updatedAt, synced: false, queued: false, conflict: true, remote: decode(id, cur, true) };
        }
        demo.set(uid, app, id, rec);
        setStatus({ state: 'saved', at: Date.now(), message: '' });
        return { id: id, updatedAt: rec.updatedAt, synced: true, queued: false };
      }
      return enqueue({ op: 'save', uid: uid, coll: app, id: id, rec: rec, ts: rec.updatedAt, force: !!doc.force });
    });
  }
  function remove(app, id, opts) {
    return Promise.resolve().then(function () {
      check(app, id);
      var uid = requireUid();
      var ts = Date.now();
      if (opts && isFinite(Number(opts.updatedAt)) && Number(opts.updatedAt) > 0) ts = Number(opts.updatedAt);
      if (mode() !== 'firebase') {
        demo.del(uid, app, id);
        return { id: id, synced: true, queued: false };
      }
      return enqueue({ op: 'remove', uid: uid, coll: app, id: id, ts: ts, force: !!(opts && opts.force) });
    });
  }
  function listMedia(app, parent) {
    return Promise.resolve().then(function () {
      var coll = app + '_media';
      check(coll, parent);
      var uid = requireUid();
      if (mode() !== 'firebase') return demo.list(uid, coll, parent).map(function (x) { return decode(x.id, x.rec, true); });
      return fire.list(uid, coll, parent).then(function (rows) {
        return overlayQueue(uid, coll, rows.map(function (x) { return decode(x.id, x.rec, true); }), parent);
      }, function (e) { throw mapErr(e); });
    });
  }

  /* Kompresi gambar di peramban → JPEG ≤ maxBytes (memperkecil ukuran lalu kualitas).
     Hasil '' bila bukan gambar atau tetap terlalu besar. */
  function compressImage(dataUrl, opts) {
    opts = opts || {};
    var maxBytes = opts.maxBytes || LIMIT - 2000;
    var maxDim = opts.maxDim || 2000;
    return new Promise(function (resolve) {
      if (!/^data:image\/(jpeg|png|webp);base64,/.test(String(dataUrl || ''))) { resolve(''); return; }
      if (bytes(dataUrl) <= maxBytes && /^data:image\/jpeg/.test(dataUrl)) { resolve(dataUrl); return; }
      var img = new w.Image();
      img.onload = function () {
        var scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        var q = 0.85, out = '';
        for (var i = 0; i < 12; i++) {
          var cw = Math.max(1, Math.round((img.naturalWidth || 1) * scale)), ch = Math.max(1, Math.round((img.naturalHeight || 1) * scale));
          var cv = w.document.createElement('canvas');
          cv.width = cw; cv.height = ch;
          var cx = cv.getContext('2d');
          cx.fillStyle = '#fff'; cx.fillRect(0, 0, cw, ch);          /* PNG transparan → latar putih */
          cx.drawImage(img, 0, 0, cw, ch);
          out = cv.toDataURL('image/jpeg', q);
          if (bytes(out) <= maxBytes) { resolve(out); return; }
          if (q > 0.55) q -= 0.1; else scale *= 0.8;
        }
        resolve('');
      };
      img.onerror = function () { resolve(''); };
      img.src = dataUrl;
    });
  }

  function pending() {
    var uid = currentUid();
    if (mode() !== 'firebase' || !uid) return [];
    qLoad(uid);
    return Q.items.map(function (op) { return { op: op.op, app: op.coll, id: op.id, ts: op.ts }; });
  }

  /* percobaan ulang otomatis */
  if (w.addEventListener) {
    w.addEventListener('online', function () { Q.tries = 0; flush(); });
    w.document && w.document.addEventListener && w.document.addEventListener('visibilitychange', function () {
      if (w.document.visibilityState === 'visible' && Q.items.length) flush();
    });
  }
  function hookAuth() {
    if (!PPAPI.auth || typeof PPAPI.auth.onChange !== 'function') return;
    PPAPI.auth.onChange(function (u) {
      if (!u) { Q.uid = ''; Q.items = []; return; }
      qLoad(u.uid);
      if (Q.items.length) flush();
    });
    if (typeof PPAPI.auth.ready === 'function') {
      PPAPI.auth.ready().then(function () { var u = currentUid(); if (u) { qLoad(u); if (Q.items.length) schedule(1500); } }, function () {});
    }
  }
  hookAuth();

  PPAPI.appData = {
    version: 1,
    LIMIT: LIMIT,
    mode: mode,
    list: list,
    get: get,
    save: save,
    remove: remove,
    listMedia: listMedia,
    compressImage: compressImage,
    bytes: bytes,
    flush: flush,
    pending: pending,
    status: status,
    onStatus: function (cb) {
      if (typeof cb !== 'function') return function () {};
      listeners.push(cb);
      return function () { var i = listeners.indexOf(cb); if (i !== -1) listeners.splice(i, 1); };
    },
    errorMessage: function (code) { return MSG[code] || MSG['appdata/failed']; }
  };
})(window);
