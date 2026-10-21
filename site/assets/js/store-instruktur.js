/* ==========================================================================
   PPAPI store-instruktur.js — PPAPI.instruktur
   Direktori instruktur perancah (instruktur.html) dan pengelolaannya oleh
   sekretariat (Konsol Admin › Instruktur).
   • Firebase: Firestore
       instructors/{id}           profil publik — dibaca siapa pun HANYA bila
                                  published == true; ditulis admin
       instructor_contacts/{id}   kontak pribadi & akun anggota tertaut —
                                  khusus admin (tidak pernah tampil publik)
       instructor_requests/{id}   permintaan instruktur dari mitra — dibuat
                                  siapa pun (tervalidasi); dibaca/diubah admin
       audit_log/{auto}           jejak tindakan admin (sama dengan store.js)
   • Demo: localStorage  ppapi_instructors (map), ppapi_instructor_contacts
     (map), ppapi_instructor_requests (array), ppapi_audit_log
   Muat SETELAH store.js:  config → data/kompetensi.js → core → auth → store →
   store-instruktur.js → halaman.
   ========================================================================== */
(function (w) {
  'use strict';

  var PPAPI = w.PPAPI = w.PPAPI || {};
  if (PPAPI.instruktur && PPAPI.instruktur.__real) return;

  var METODE = ['Luring', 'Daring'];
  var REQUEST_METODE = ['Luring', 'Daring', 'Fleksibel'];
  var BAHASA = ['Indonesia', 'Inggris', 'Mandarin', 'Jepang', 'Korea', 'Arab'];
  var REQUEST_STATUS = ['Baru', 'Diproses', 'Selesai'];
  var SELURUH = 'Seluruh Indonesia';
  var LIMITS = {
    nama: 120, gelar: 120, bio: 600, materi: 10, materiLen: 120, sertifikasi: 10, kompetensi: 16, wilayah: 39,
    fotoKB: 150, organisasi: 160, topik: 200, lokasi: 160, catatan: 2000, peserta: 1000
  };
  var FOTO_MAX_CHARS = 205000; /* ≈ 150 KB JPEG dalam base64 (+ awalan data URL) */
  var K_INS = 'ppapi_instructors';
  var K_CONTACT = 'ppapi_instructor_contacts';
  var K_REQ = 'ppapi_instructor_requests';
  var K_AUDIT = 'ppapi_audit_log';
  var LABELS = {
    'instruktur.disimpan': 'Menyimpan profil instruktur',
    'instruktur.diterbitkan': 'Menerbitkan profil instruktur',
    'instruktur.ditarik': 'Menarik profil instruktur dari situs',
    'instruktur.dihapus': 'Menghapus profil instruktur',
    'instruktur.permintaan-diperbarui': 'Memperbarui permintaan instruktur'
  };

  /* ------------------------------------------------------------ helpers */
  function mode() { return PPAPI.auth && PPAPI.auth.mode === 'firebase' ? 'firebase' : 'local'; }
  function U() { return PPAPI.util || {}; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function todayIso() {
    if (U().todayIso) return U().todayIso();
    var t = new Date();
    return t.getFullYear() + '-' + pad(t.getMonth() + 1) + '-' + pad(t.getDate());
  }
  function nowIso() { return new Date().toISOString(); }
  function isIsoDate(s) { return typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s + 'T00:00:00Z')); }
  function err(code, message, cause) { var e = new Error(message); e.code = code; if (cause) e.cause = cause; return e; }
  function str(v, max) { return String(v === undefined || v === null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max); }
  function text(v, max) { return String(v === undefined || v === null ? '' : v).replace(/\r\n/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim().slice(0, max); }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function toIso(v) {
    if (v && typeof v === 'object' && typeof v.toDate === 'function') { try { return v.toDate().toISOString(); } catch (e) { return ''; } }
    if (v && typeof v === 'object' && typeof v.seconds === 'number') { try { return new Date(v.seconds * 1000).toISOString(); } catch (e) { return ''; } }
    return v === undefined || v === null ? '' : String(v);
  }
  function lsGet(key, fallback) { try { var raw = w.localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); } catch (e) { return fallback; } }
  function lsSet(key, val) {
    try { w.localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { throw err('store/quota', 'Penyimpanan peramban penuh atau tidak tersedia. Hapus data situs lalu coba lagi.', e); }
  }
  function lsMap(key) { var m = lsGet(key, {}); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; }
  function lsArr(key) { var a = lsGet(key, []); return Array.isArray(a) ? a : []; }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function rand(n) {
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', out = '';
    var buf = null;
    try { buf = w.crypto && w.crypto.getRandomValues ? w.crypto.getRandomValues(new Uint32Array(n)) : null; } catch (e) { buf = null; }
    for (var i = 0; i < n; i++) out += abc.charAt((buf ? buf[i] : Math.floor(Math.random() * 1e9)) % abc.length);
    return out;
  }
  function slug(s) {
    if (U().slugify) return U().slugify(s);
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }
  function me() { return PPAPI.auth && PPAPI.auth.current ? PPAPI.auth.current() : null; }
  async function fx() {
    var f = PPAPI.auth && PPAPI.auth._firebase ? await PPAPI.auth._firebase() : null;
    if (!f) throw err('store/unavailable', 'Layanan data belum siap. Muat ulang halaman, lalu coba lagi.');
    return f;
  }
  function serverTs(f) { return f.fb.firestore.FieldValue.serverTimestamp(); }
  function mapFsError(e) {
    if (e && e.code && /^store\//.test(e.code)) return e;
    var code = e && e.code ? String(e.code).replace(/^firestore\//, '') : '';
    var msg = {
      'permission-denied': 'Akses ditolak. Pastikan data yang dikirim sesuai ketentuan, lalu coba lagi.',
      'unauthenticated': 'Sesi Anda telah berakhir. Silakan masuk kembali.',
      'unavailable': 'Layanan data sedang tidak dapat dihubungi. Periksa koneksi internet Anda, lalu coba lagi.',
      'resource-exhausted': 'Batas pemakaian layanan data sedang tercapai. Silakan coba lagi nanti.',
      'invalid-argument': 'Data yang dikirim tidak valid. Periksa kembali isian Anda.',
      'not-found': 'Data tidak ditemukan.'
    }[code] || 'Gagal memproses data. Silakan coba lagi.';
    return err('store/' + (code || 'unknown'), msg, e);
  }
  async function requireAdmin() {
    var u = me();
    var ok = false;
    if (u) { try { ok = PPAPI.auth && PPAPI.auth.isAdmin ? await PPAPI.auth.isAdmin() : false; } catch (e) { ok = false; } }
    if (!ok) throw err('store/forbidden', 'Tindakan ini khusus admin PPAPI.');
    var s = PPAPI.session && PPAPI.session.current ? PPAPI.session.current() : null;
    var name = (s && s.member && s.member.name) || u.name || u.email || 'Admin';
    return { uid: u.uid, name: String(name).slice(0, 120) };
  }
  async function audit(adm, action, id, name, note) {
    var entry = {
      at: nowIso(), by: adm.uid, byName: adm.name, action: action, label: LABELS[action] || action,
      targetType: 'instruktur', targetId: str(id, 200), targetName: str(name, 200), note: str(note, 2000)
    };
    try {
      if (mode() === 'local') {
        var list = lsArr(K_AUDIT);
        list.push(Object.assign({ id: 'log-' + Date.now().toString(36) + rand(4).toLowerCase() }, entry));
        lsSet(K_AUDIT, list.slice(-500));
        return;
      }
      var f = await fx();
      await f.db.collection('audit_log').add(entry);
    } catch (e) { console.warn('Log aktivitas instruktur tidak tersimpan:', e && e.message); }
  }

  /* ------------------------------------------------------ catalogue data */
  function katalog() {
    var k = PPAPI.data && PPAPI.data.kompetensi;
    return k && Array.isArray(k.katalog) ? k.katalog : [];
  }
  function kompetensiByKode(kode) { return katalog().filter(function (x) { return x.kode === kode; })[0] || null; }
  /** bidang (kelompok katalog) yang tercakup oleh daftar kode kompetensi, urut menurut katalog */
  function bidangOf(item) {
    var codes = (item && item.kompetensi) || [];
    var out = [];
    katalog().forEach(function (k) { if (codes.indexOf(k.kode) !== -1 && out.indexOf(k.kelompok) === -1) out.push(k.kelompok); });
    return out;
  }
  function bidangList() {
    var out = [];
    katalog().forEach(function (k) { if (k.kelompok && out.indexOf(k.kelompok) === -1) out.push(k.kelompok); });
    return out;
  }
  function provinsi() { return (U().PROVINSI || []).slice(); }
  function penerbit() {
    var k = PPAPI.data && PPAPI.data.kompetensi;
    return k && Array.isArray(k.penerbit) ? k.penerbit.slice() : ['BNSP / LSP', 'Kemnaker RI', 'LPJK / Kementerian PU', 'Lembaga Internasional (CISRS, dll.)', 'Lainnya'];
  }

  /* ------------------------------------------------------------ shapes */
  function uniq(arr) { var out = []; arr.forEach(function (v) { if (v && out.indexOf(v) === -1) out.push(v); }); return out; }
  function cleanFoto(v) {
    var s = typeof v === 'string' ? v.trim() : '';
    if (!s) return '';
    if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s)) throw err('store/invalid-photo', 'Foto harus berupa gambar JPEG. Pilih ulang foto.');
    if (s.length > FOTO_MAX_CHARS) throw err('store/photo-too-large', 'Ukuran foto melebihi 150 KB. Pilih foto lain.');
    return s;
  }
  function cleanKta(v) {
    var s = str(v, 40).toUpperCase().replace(/\s+/g, '');
    return /^PPAPI-\d{4}-\d{6}$/.test(s) ? s : '';
  }
  /** profil publik yang tersimpan (tanpa kontak pribadi) */
  function sanitizeInstructor(raw) {
    raw = raw || {};
    var codes = katalog().map(function (k) { return k.kode; });
    var komp = uniq((Array.isArray(raw.kompetensi) ? raw.kompetensi : []).map(function (c) { return str(c, 20); }))
      .filter(function (c) { return !codes.length || codes.indexOf(c) !== -1; }).slice(0, LIMITS.kompetensi);
    var prov = provinsi();
    var wil = uniq((Array.isArray(raw.wilayah) ? raw.wilayah : []).map(function (p) { return str(p, 60); }))
      .filter(function (p) { return p === SELURUH || !prov.length || prov.indexOf(p) !== -1; });
    if (wil.indexOf(SELURUH) !== -1) wil = [SELURUH];
    var bhs = uniq((Array.isArray(raw.bahasa) ? raw.bahasa : []).map(function (b) { return str(b, 30); })).filter(function (b) { return BAHASA.indexOf(b) !== -1; });
    var met = uniq((Array.isArray(raw.metode) ? raw.metode : []).map(function (m) { return str(m, 12); })).filter(function (m) { return METODE.indexOf(m) !== -1; });
    var materi = uniq((Array.isArray(raw.materi) ? raw.materi : String(raw.materi || '').split('\n')).map(function (m) { return str(String(m).replace(/^[-•*]\s*/, ''), LIMITS.materiLen); })).slice(0, LIMITS.materi);
    var sert = (Array.isArray(raw.sertifikasi) ? raw.sertifikasi : []).map(function (c) {
      c = c || {};
      var until = str(c.berlakuHingga, 10);
      return { nama: str(c.nama, 160), penerbit: str(c.penerbit, 80), berlakuHingga: isIsoDate(until) ? until : '' };
    }).filter(function (c) { return c.nama; }).slice(0, LIMITS.sertifikasi);
    var exp = raw.pengalamanTahun === '' || raw.pengalamanTahun === null || raw.pengalamanTahun === undefined ? null : Math.round(Number(raw.pengalamanTahun));
    return {
      nama: str(raw.nama, LIMITS.nama),
      gelar: str(raw.gelar, LIMITS.gelar),
      foto: cleanFoto(raw.foto),
      kompetensi: komp,
      sertifikasi: sert,
      pengalamanTahun: exp !== null && isFinite(exp) && exp >= 0 && exp <= 60 ? exp : null,
      wilayah: wil,
      bahasa: bhs.length ? bhs : ['Indonesia'],
      metode: met,
      materi: materi,
      bio: text(raw.bio, LIMITS.bio),
      kta: cleanKta(raw.kta),
      published: raw.published === true
    };
  }
  function missingFields(c) {
    var m = [];
    if (c.nama.length < 3) m.push('nama lengkap');
    if (c.gelar.length < 3) m.push('jabatan atau keahlian utama');
    if (!c.kompetensi.length) m.push('minimal satu kompetensi');
    if (!c.metode.length) m.push('metode pelatihan (luring/daring)');
    if (!c.wilayah.length) m.push('wilayah layanan');
    if (c.bio.length < 20) m.push('profil singkat (minimal 20 karakter)');
    return m;
  }
  function sanitizeContact(raw) {
    raw = raw || {};
    var email = str(raw.email, 200);
    return {
      email: email && U().isEmail && !U().isEmail(email) ? '' : email,
      telepon: str(raw.telepon, 24),
      memberUid: str(raw.memberUid, 128),
      catatan: text(raw.catatan, 1000)
    };
  }
  function normalize(id, raw) {
    raw = raw || {};
    var c;
    try { c = sanitizeInstructor(raw); } catch (e) { c = sanitizeInstructor(Object.assign({}, raw, { foto: '' })); }
    c.id = id || raw.id || '';
    c.bidang = bidangOf(c);
    c.createdAt = toIso(raw.createdAt);
    c.updatedAt = toIso(raw.updatedAt);
    return c;
  }
  function byName(a, b) { return String(a.nama).localeCompare(String(b.nama), 'id'); }

  /* ======================================================================
     PUBLIK
     ====================================================================== */
  /** list() → Promise<Instructor[]> — profil yang diterbitkan, urut nama */
  async function list() {
    if (mode() === 'local') {
      var map = lsMap(K_INS);
      return Object.keys(map).map(function (id) { return normalize(id, map[id]); }).filter(function (x) { return x.published; }).sort(byName);
    }
    var f = await fx();
    try {
      var snap = await f.db.collection('instructors').where('published', '==', true).limit(500).get();
      var out = [];
      snap.forEach(function (doc) { out.push(normalize(doc.id, doc.data())); });
      return out.sort(byName);
    } catch (e) { throw mapFsError(e); }
  }
  /** get(id) → Promise<Instructor|null> — publik: hanya yang diterbitkan; admin: semua */
  async function get(id) {
    id = str(id, 80);
    if (!id) return null;
    if (mode() === 'local') {
      var raw = lsMap(K_INS)[id];
      if (!raw) return null;
      var it = normalize(id, raw);
      if (!it.published && !(await isAdminQuiet())) return null;
      return it;
    }
    var f = await fx();
    try {
      var snap = await f.db.collection('instructors').doc(id).get();
      return snap.exists ? normalize(snap.id, snap.data()) : null;
    } catch (e) {
      if (e && /permission-denied/.test(String(e.code))) return null; /* belum diterbitkan */
      throw mapFsError(e);
    }
  }
  async function isAdminQuiet() {
    try { return !!(me() && PPAPI.auth.isAdmin && await PPAPI.auth.isAdmin()); } catch (e) { return false; }
  }

  /* ---------------------------------------------- permintaan instruktur */
  function requestRef() {
    var t = new Date();
    return 'PI-' + t.getFullYear() + pad(t.getMonth() + 1) + pad(t.getDate()) + '-' + rand(6);
  }
  function phoneOk(s) {
    if (!/^[0-9+()\-.\s]{8,24}$/.test(s)) return false;
    var digits = s.replace(/\D/g, '');
    return digits.length >= 8 && digits.length <= 15;
  }
  /** sanitize + validate → {data} | throws store/request-invalid with .fields {key: message} */
  function cleanRequest(raw) {
    raw = raw || {};
    var c = {
      organisasi: str(raw.organisasi, LIMITS.organisasi),
      namaPic: str(raw.namaPic, 120),
      email: str(raw.email, 200).toLowerCase(),
      telepon: str(raw.telepon, 24),
      topik: str(raw.topik, LIMITS.topik),
      metode: str(raw.metode, 12),
      lokasi: str(raw.lokasi, LIMITS.lokasi),
      tanggal: str(raw.tanggal, 10),
      jumlahPeserta: Math.round(Number(raw.jumlahPeserta)),
      catatan: text(raw.catatan, LIMITS.catatan),
      instrukturId: str(raw.instrukturId, 80),
      instrukturNama: str(raw.instrukturNama, 120)
    };
    if (!c.instrukturId) c.instrukturNama = '';
    var f = {};
    if (c.organisasi.length < 2) f.organisasi = 'Isi nama organisasi atau perusahaan.';
    if (c.namaPic.length < 3) f.namaPic = 'Isi nama penanggung jawab (minimal 3 karakter).';
    if (!c.email) f.email = 'Isi alamat email.';
    else if (!(U().isEmail ? U().isEmail(c.email) : /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(c.email))) f.email = 'Format alamat email tidak valid.';
    if (!c.telepon) f.telepon = 'Isi nomor telepon yang dapat dihubungi.';
    else if (!phoneOk(c.telepon)) f.telepon = 'Nomor telepon tidak valid (8–15 angka).';
    if (c.topik.length < 3) f.topik = 'Isi topik atau kompetensi pelatihan.';
    if (REQUEST_METODE.indexOf(c.metode) === -1) f.metode = 'Pilih metode pelatihan.';
    if (c.metode !== 'Daring' && c.lokasi.length < 3) f.lokasi = 'Isi kota atau lokasi pelatihan.';
    if (!isIsoDate(c.tanggal)) f.tanggal = 'Pilih rencana tanggal pelatihan.';
    else if (c.tanggal < todayIso()) f.tanggal = 'Tanggal pelatihan tidak boleh sebelum hari ini.';
    if (!isFinite(c.jumlahPeserta) || c.jumlahPeserta < 1 || c.jumlahPeserta > LIMITS.peserta) f.jumlahPeserta = 'Isi jumlah peserta antara 1 dan 1.000.';
    if (Object.keys(f).length) {
      var e = err('store/request-invalid', 'Periksa kembali isian yang ditandai.');
      e.fields = f;
      throw e;
    }
    return c;
  }
  /** requests.create(data) → Promise<{id}> — siapa pun; diteruskan ke sekretariat */
  async function createRequest(raw) {
    var c = cleanRequest(raw);
    var u = me();
    c.uid = u ? u.uid : null;
    c.status = 'Baru';
    var id = requestRef();
    if (mode() === 'local') {
      var arr = lsArr(K_REQ);
      arr.push(Object.assign({ id: id }, c, { catatanAdmin: '', createdAt: nowIso(), updatedAt: '' }));
      lsSet(K_REQ, arr.slice(-300));
      await delay(350);
      return { id: id };
    }
    var f = await fx();
    try {
      await f.db.collection('instructor_requests').doc(id).set(Object.assign({}, c, { createdAt: serverTs(f) }));
      return { id: id };
    } catch (e) { throw mapFsError(e); }
  }
  function normRequest(id, raw) {
    raw = raw || {};
    return {
      id: id, organisasi: raw.organisasi || '', namaPic: raw.namaPic || '', email: raw.email || '', telepon: raw.telepon || '',
      topik: raw.topik || '', metode: raw.metode || '', lokasi: raw.lokasi || '', tanggal: raw.tanggal || '',
      jumlahPeserta: typeof raw.jumlahPeserta === 'number' ? raw.jumlahPeserta : null, catatan: raw.catatan || '',
      instrukturId: raw.instrukturId || '', instrukturNama: raw.instrukturNama || '', uid: raw.uid || null,
      status: REQUEST_STATUS.indexOf(raw.status) !== -1 ? raw.status : 'Baru', catatanAdmin: raw.catatanAdmin || '',
      createdAt: toIso(raw.createdAt), updatedAt: toIso(raw.updatedAt), updatedBy: raw.updatedBy || ''
    };
  }
  /** requests.list() → Promise<Request[]> (admin), terbaru di atas */
  async function listRequests() {
    await requireAdmin();
    var out;
    if (mode() === 'local') {
      out = lsArr(K_REQ).map(function (x) { return normRequest(x.id, x); });
    } else {
      var f = await fx();
      try {
        var snap = await f.db.collection('instructor_requests').orderBy('createdAt', 'desc').limit(500).get();
        out = [];
        snap.forEach(function (doc) { out.push(normRequest(doc.id, doc.data())); });
      } catch (e) { throw mapFsError(e); }
    }
    return out.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
  }
  /** requests.update(id, {status?, catatanAdmin?}) → Promise<Request> (admin) */
  async function updateRequest(id, patch) {
    var adm = await requireAdmin();
    patch = patch || {};
    var p = {};
    if (patch.status !== undefined) {
      if (REQUEST_STATUS.indexOf(patch.status) === -1) throw err('store/invalid-status', 'Status permintaan tidak dikenal.');
      p.status = patch.status;
    }
    if (patch.catatanAdmin !== undefined) p.catatanAdmin = text(patch.catatanAdmin, 2000);
    var result, name = '';
    if (mode() === 'local') {
      var arr = lsArr(K_REQ);
      var i = arr.findIndex(function (x) { return x.id === id; });
      if (i === -1) throw err('store/not-found', 'Permintaan tidak ditemukan.');
      arr[i] = Object.assign({}, arr[i], p, { updatedAt: nowIso(), updatedBy: adm.uid });
      lsSet(K_REQ, arr);
      result = normRequest(id, arr[i]);
      name = arr[i].organisasi;
    } else {
      var f = await fx();
      try {
        var ref = f.db.collection('instructor_requests').doc(id);
        await ref.update(Object.assign({}, p, { updatedAt: serverTs(f), updatedBy: adm.uid }));
        var snap = await ref.get();
        result = normRequest(id, snap.data());
        name = result.organisasi;
      } catch (e) { throw mapFsError(e); }
    }
    await audit(adm, 'instruktur.permintaan-diperbarui', id, name, p.status ? 'Status: ' + p.status : '');
    return result;
  }

  /* ======================================================================
     ADMIN — profil instruktur
     ====================================================================== */
  /** admin.list() → semua profil (terbit & draf), urut nama */
  async function adminList() {
    await requireAdmin();
    if (mode() === 'local') {
      var map = lsMap(K_INS);
      return Object.keys(map).map(function (id) { return normalize(id, map[id]); }).sort(byName);
    }
    var f = await fx();
    try {
      var snap = await f.db.collection('instructors').limit(500).get();
      var out = [];
      snap.forEach(function (doc) { out.push(normalize(doc.id, doc.data())); });
      return out.sort(byName);
    } catch (e) { throw mapFsError(e); }
  }
  /** admin.getContact(id) → {email, telepon, memberUid, catatan} (admin; kosong bila belum ada) */
  async function getContact(id) {
    await requireAdmin();
    if (mode() === 'local') return sanitizeContact(lsMap(K_CONTACT)[id]);
    var f = await fx();
    try {
      var snap = await f.db.collection('instructor_contacts').doc(id).get();
      return sanitizeContact(snap.exists ? snap.data() : null);
    } catch (e) { throw mapFsError(e); }
  }
  function newId(nama) {
    var s = slug(nama).slice(0, 40).replace(/-+$/, '') || 'instruktur';
    return 'ins-' + s + '-' + rand(4).toLowerCase();
  }
  /** admin.save(item, {kontak}) → Promise<Instructor>. item.id kosong = profil baru.
      Wajib: nama, gelar, ≥1 kompetensi, metode, wilayah, bio ≥20 → store/instructor-incomplete (.missing[]). */
  async function save(item, opts) {
    var adm = await requireAdmin();
    opts = opts || {};
    item = item || {};
    var c = sanitizeInstructor(item);
    var missing = missingFields(c);
    if (missing.length) {
      var e = err('store/instructor-incomplete', 'Lengkapi: ' + missing.join(', ') + '.');
      e.missing = missing;
      throw e;
    }
    var id = str(item.id, 80);
    var isNew = !id;
    if (isNew) id = newId(c.nama);
    else if (!/^[a-z0-9-]{3,80}$/.test(id)) throw err('store/invalid-id', 'Kode profil tidak valid.');
    var contact = opts.kontak ? sanitizeContact(opts.kontak) : null;
    var before = null;
    if (mode() === 'local') {
      var map = lsMap(K_INS);
      before = map[id] || null;
      if (!isNew && !before) throw err('store/not-found', 'Profil instruktur tidak ditemukan.');
      map[id] = Object.assign({}, c, { createdAt: (before && before.createdAt) || nowIso(), updatedAt: nowIso() });
      lsSet(K_INS, map);
      if (contact) { var cm = lsMap(K_CONTACT); cm[id] = contact; lsSet(K_CONTACT, cm); }
    } else {
      var f = await fx();
      try {
        var ref = f.db.collection('instructors').doc(id);
        if (!isNew) { var snap = await ref.get(); before = snap.exists ? snap.data() : null; if (!before) throw err('store/not-found', 'Profil instruktur tidak ditemukan.'); }
        var data = Object.assign({}, c, { updatedAt: serverTs(f) });
        if (isNew) data.createdAt = serverTs(f);
        else data.createdAt = before.createdAt || serverTs(f);
        await ref.set(data);
        if (contact) await f.db.collection('instructor_contacts').doc(id).set(Object.assign({}, contact, { updatedAt: serverTs(f) }));
      } catch (e2) { throw mapFsError(e2); }
    }
    var wasPub = !!(before && before.published);
    await audit(adm, c.published && !wasPub ? 'instruktur.diterbitkan' : (!c.published && wasPub ? 'instruktur.ditarik' : 'instruktur.disimpan'), id, c.nama, isNew ? 'Profil baru' : '');
    return normalize(id, Object.assign({}, c, { createdAt: (before && before.createdAt) || nowIso(), updatedAt: nowIso() }));
  }
  /** admin.setPublished(id, bool) → Promise<Instructor> */
  async function setPublished(id, published) {
    var adm = await requireAdmin();
    published = !!published;
    var it;
    if (mode() === 'local') {
      var map = lsMap(K_INS);
      if (!map[id]) throw err('store/not-found', 'Profil instruktur tidak ditemukan.');
      if (published && missingFields(normalize(id, map[id])).length) throw err('store/instructor-incomplete', 'Lengkapi profil sebelum diterbitkan.');
      map[id] = Object.assign({}, map[id], { published: published, updatedAt: nowIso() });
      lsSet(K_INS, map);
      it = normalize(id, map[id]);
    } else {
      var f = await fx();
      try {
        var ref = f.db.collection('instructors').doc(id);
        var snap = await ref.get();
        if (!snap.exists) throw err('store/not-found', 'Profil instruktur tidak ditemukan.');
        if (published && missingFields(normalize(id, snap.data())).length) throw err('store/instructor-incomplete', 'Lengkapi profil sebelum diterbitkan.');
        await ref.update({ published: published, updatedAt: serverTs(f) });
        it = normalize(id, Object.assign({}, snap.data(), { published: published }));
      } catch (e) { throw mapFsError(e); }
    }
    await audit(adm, published ? 'instruktur.diterbitkan' : 'instruktur.ditarik', id, it.nama, '');
    return it;
  }
  /** admin.remove(id) → Promise<true> (profil + kontak) */
  async function remove(id) {
    var adm = await requireAdmin();
    var name = '';
    if (mode() === 'local') {
      var map = lsMap(K_INS);
      if (!map[id]) throw err('store/not-found', 'Profil instruktur tidak ditemukan.');
      name = map[id].nama;
      delete map[id];
      lsSet(K_INS, map);
      var cm = lsMap(K_CONTACT);
      if (cm[id]) { delete cm[id]; lsSet(K_CONTACT, cm); }
    } else {
      var f = await fx();
      try {
        var ref = f.db.collection('instructors').doc(id);
        var snap = await ref.get();
        name = snap.exists ? snap.data().nama : id;
        await ref.delete();
        await f.db.collection('instructor_contacts').doc(id).delete();
      } catch (e) { throw mapFsError(e); }
    }
    await audit(adm, 'instruktur.dihapus', id, name, '');
    return true;
  }

  /* ------------------------------------------- foto → JPEG ≤ 150 KB */
  /** photoFromFile(file) → Promise<dataURL> — diperkecil (sisi terpanjang ≤ 480 px) dan dikompresi ≤ 150 KB */
  function photoFromFile(file) {
    return new Promise(function (resolve, reject) {
      if (!file || !/^image\/(jpeg|png|webp|gif|bmp)$/i.test(file.type || '')) { reject(err('store/invalid-photo', 'Pilih berkas gambar (JPG, PNG, atau WebP).')); return; }
      if (file.size > 15 * 1024 * 1024) { reject(err('store/photo-too-large', 'Ukuran berkas foto maksimal 15 MB.')); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        try {
          var max = 480, wv = img.naturalWidth, hv = img.naturalHeight;
          var scale = Math.min(1, max / Math.max(wv, hv));
          var out = '', q = 0.86, size = scale;
          for (var round = 0; round < 8; round++) {
            var cw = Math.max(1, Math.round(wv * size)), ch = Math.max(1, Math.round(hv * size));
            var cv = document.createElement('canvas');
            cv.width = cw; cv.height = ch;
            var ctx = cv.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, cw, ch);
            ctx.drawImage(img, 0, 0, cw, ch);
            out = cv.toDataURL('image/jpeg', q);
            if (out.length <= FOTO_MAX_CHARS) break;
            if (q > 0.55) q -= 0.1; else size *= 0.8;
          }
          URL.revokeObjectURL(url);
          if (!/^data:image\/jpeg;base64,/.test(out) || out.length > FOTO_MAX_CHARS) { reject(err('store/photo-too-large', 'Foto belum dapat diperkecil hingga 150 KB. Pilih foto lain.')); return; }
          resolve(out);
        } catch (e) { URL.revokeObjectURL(url); reject(err('store/invalid-photo', 'Foto tidak dapat diproses. Pilih foto lain.', e)); }
      };
      img.onerror = function () { URL.revokeObjectURL(url); reject(err('store/invalid-photo', 'Berkas tersebut tidak dapat dibaca sebagai gambar.')); };
      img.src = url;
    });
  }

  PPAPI.instruktur = {
    __real: true,
    get mode() { return mode(); },
    METODE: METODE.slice(),
    REQUEST_METODE: REQUEST_METODE.slice(),
    BAHASA: BAHASA.slice(),
    REQUEST_STATUS: REQUEST_STATUS.slice(),
    SELURUH: SELURUH,
    LIMITS: Object.assign({}, LIMITS),
    LABELS: Object.assign({}, LABELS),
    katalog: function () { return clone(katalog()); },
    kompetensi: kompetensiByKode,
    bidangList: bidangList,
    bidangOf: bidangOf,
    provinsi: provinsi,
    penerbit: penerbit,
    list: list,
    get: get,
    photoFromFile: photoFromFile,
    requests: {
      create: createRequest,
      list: listRequests,
      update: updateRequest,
      validate: function (raw) { return cleanRequest(raw); }
    },
    admin: {
      list: adminList,
      save: save,
      setPublished: setPublished,
      remove: remove,
      getContact: getContact,
      missing: function (item) { try { return missingFields(sanitizeInstructor(item)); } catch (e) { return [e.message]; } }
    }
  };
})(window);
