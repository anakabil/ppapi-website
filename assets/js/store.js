/* ==========================================================================
   PPAPI store.js — PPAPI.store  (v2)
   Member records, membership applications, admin console, managed content,
   public registry, knowledge files and feedback.
   • Firebase mode: Firestore  members/{uid}, admins/{uid}, registry/{kta},
     counters/kta-YYYY, audit_log/{id}, feedback/{id}, content_<type>/{id},
     pustaka_files/{id}   (see firestore.rules — same whitelists/limits)
   • Demo mode: localStorage  ppapi_member_{uid}, ppapi_demo_admins,
     ppapi_registry, ppapi_counters, ppapi_audit_log, ppapi_feedback,
     ppapi_content_<type>, ppapi_pustaka_files
   Member-editable fields go through saveMember (profile) and saveApplication
   (formulir); status changes by the member only via submitApplication /
   withdrawApplication; everything else is admin-only (PPAPI.store.admin.*).
   ========================================================================== */
(function (w) {
  'use strict';

  var PPAPI = w.PPAPI = w.PPAPI || {};
  if (PPAPI.store && PPAPI.store.__real) return;

  var MEMBER_TYPES = ['Praktisi', 'Ahli', 'Mitra Korporat', 'Kehormatan'];
  var STATUSES = ['Draf', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Aktif', 'Ditolak', 'Nonaktif'];
  var LEVELS = ['Dasar', 'Menengah', 'Mahir', 'Ahli'];
  var DOC_TYPES = ['CV', 'Sertifikat', 'Ijazah', 'Surat Rekomendasi', 'Bukti Pembayaran', 'Lainnya'];
  /* keys a member never writes through saveMember (secretariat-managed, or saveApplication's job) */
  var PROTECTED = ['uid', 'kta', 'status', 'memberType', 'joinedAt', 'createdAt', 'validUntil', 'approvedAt', 'approvedBy', 'review', 'application', 'contoh', 'updatedAt'];
  var FEEDBACK_KATEGORI = ['Kritik', 'Saran', 'Pertanyaan', 'Pengaduan', 'Apresiasi'];
  var FEEDBACK_STATUS = ['Baru', 'Diproses', 'Selesai'];
  var FEEDBACK_KEYS = ['kategori', 'nama', 'email', 'phone', 'subjek', 'pesan', 'rating', 'anonim', 'uid', 'halaman'];
  var PROFILE_KEYS = ['birthPlace', 'birthDate', 'gender', 'city', 'province', 'address', 'company', 'position', 'experienceYears', 'education', 'bio', 'linkedin'];
  var CONTENT_TYPES = ['berita', 'pengumuman', 'agenda', 'pustaka', 'regulasi'];
  var PUSTAKA_KATEGORI = ['Standar', 'Code of Practice', 'Petunjuk Teknis', 'Modul Pelatihan', 'Formulir & Daftar Periksa', 'Kajian Teknis', 'Aplikasi'];
  var PUSTAKA_STATUS = ['Berlaku', 'Draf', 'Dalam Penyusunan'];
  var REG_JENIS = ['Undang-Undang', 'Peraturan Pemerintah', 'Peraturan Menteri', 'Keputusan Menteri', 'Surat Edaran', 'SNI', 'Standar Internasional'];
  var LIMITS = { pengalaman: 10, dokumen: 12, pasFotoKB: 120, catatan: 1000, note: 2000 };
  var HISTORY_ACTIONS = ['diajukan', 'ditarik', 'perbaikan', 'disetujui', 'ditolak', 'dinonaktifkan', 'diaktifkan', 'diperpanjang', 'kategori-diubah'];
  var AUDIT_LABELS = {
    'anggota.disetujui': 'Menyetujui pendaftaran',
    'anggota.perbaikan': 'Meminta perbaikan pengajuan',
    'anggota.ditolak': 'Menolak pengajuan',
    'anggota.dinonaktifkan': 'Menonaktifkan keanggotaan',
    'anggota.diaktifkan': 'Mengaktifkan kembali keanggotaan',
    'anggota.diperpanjang': 'Memperpanjang masa berlaku',
    'anggota.kategori-diubah': 'Mengubah kategori anggota',
    'umpan-balik.diperbarui': 'Memperbarui umpan balik',
    'admin.ditambah': 'Menambahkan admin',
    'admin.dihapus': 'Mencabut peran admin',
    'konten.disimpan': 'Menyimpan konten',
    'konten.dihapus': 'Menyembunyikan/menghapus konten',
    'konten.dipulihkan': 'Memulihkan konten bawaan'
  };
  var K_MEMBER = 'ppapi_member_';
  var K_FEEDBACK = 'ppapi_feedback';
  var K_ADMINS = 'ppapi_demo_admins';
  var K_REGISTRY = 'ppapi_registry';
  var K_COUNTERS = 'ppapi_counters';
  var K_AUDIT = 'ppapi_audit_log';
  var K_CONTENT = 'ppapi_content_';
  var K_FILES = 'ppapi_pustaka_files';

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
  function storeError(code, message, cause) {
    var e = new Error(message);
    e.code = code;
    if (cause) e.cause = cause;
    return e;
  }
  function forbidden() { return storeError('store/forbidden', 'Tindakan ini khusus admin PPAPI.'); }
  function mapFirestoreError(err) {
    if (err && err.code && /^store\//.test(err.code)) return err;
    var code = err && err.code ? String(err.code).replace(/^firestore\//, '') : '';
    var msg = {
      'permission-denied': 'Akses ditolak. Pastikan Anda telah masuk dan data yang dikirim sesuai ketentuan.',
      'unauthenticated': 'Sesi Anda telah berakhir. Silakan masuk kembali.',
      'unavailable': 'Layanan data sedang tidak dapat dihubungi. Periksa koneksi internet Anda, lalu coba lagi.',
      'resource-exhausted': 'Batas pemakaian layanan data sedang tercapai. Silakan coba lagi nanti.',
      'invalid-argument': 'Data yang dikirim tidak valid. Periksa kembali isian Anda.',
      'not-found': 'Data tidak ditemukan.',
      'aborted': 'Data sedang diperbarui oleh pengguna lain. Silakan coba lagi.',
      'failed-precondition': 'Data sedang diperbarui oleh pengguna lain. Silakan coba lagi.'
    }[code] || 'Gagal memproses data. Silakan coba lagi.';
    return storeError('store/' + (code || 'unknown'), msg, err);
  }

  /* -------- local storage helpers -------- */
  function lsGet(key, fallback) {
    try { var raw = w.localStorage.getItem(key); return raw === null ? fallback : JSON.parse(raw); } catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { w.localStorage.setItem(key, JSON.stringify(val)); return true; }
    catch (e) { throw storeError('store/quota', 'Penyimpanan peramban penuh atau tidak tersedia. Hapus data situs lalu coba lagi.', e); }
  }
  function lsRemove(key) { try { w.localStorage.removeItem(key); } catch (e) { /* ignore */ } }
  function lsKeys(prefix) {
    var out = [];
    try { for (var i = 0; i < w.localStorage.length; i++) { var k = w.localStorage.key(i); if (k && k.indexOf(prefix) === 0) out.push(k); } } catch (e) { /* ignore */ }
    return out;
  }
  function lsMap(key) { var m = lsGet(key, {}); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; }
  function lsArr(key) { var a = lsGet(key, []); return Array.isArray(a) ? a : []; }

  /* -------- shape helpers -------- */
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function stripUndefined(o) {
    if (Array.isArray(o)) return o.map(stripUndefined);
    if (o && typeof o === 'object' && !(o instanceof Date)) {
      var out = {};
      Object.keys(o).forEach(function (k) { if (o[k] !== undefined) out[k] = stripUndefined(o[k]); });
      return out;
    }
    return o;
  }
  function str(v, max) { return String(v === undefined || v === null ? '' : v).trim().slice(0, max); }
  function toIso(v) {
    if (v && typeof v === 'object' && typeof v.toDate === 'function') { try { return v.toDate().toISOString(); } catch (e) { return ''; } }
    return v === undefined || v === null ? '' : v;
  }
  function rid(prefix) { return prefix + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function fold(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
  function alnum(s) { return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function own(o, k) { return !!o && Object.prototype.hasOwnProperty.call(o, k); }
  /* https://… only (documents, proofs) */
  function httpsUrl(v, max) { var s = str(v, max || 1000); return /^https:\/\/[^\s<>"']+$/i.test(s) ? s : ''; }
  /* http(s)://… only (certificate links) */
  function httpUrl(v, max) { var s = str(v, max || 1000); return /^https?:\/\/[^\s<>"']+$/i.test(s) ? s : ''; }
  /* profile photo: http(s) URL or an inline raster image (never javascript:, data:text/html, svg …) */
  function photoUrl(v) {
    var s = str(v, 200000);
    if (/^https?:\/\/[^\s<>"']+$/i.test(s) && s.length <= 1000) return s;
    if (/^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s)) return s;
    return '';
  }
  var PHOTO_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
  /* content links: http(s) or a same-site relative path (no scheme, no //, no ..) */
  function contentUrl(v) {
    var s = str(v, 1000);
    if (!s) return '';
    if (/^https?:\/\/[^\s<>"']+$/i.test(s)) return s;
    if (/^[A-Za-z0-9][A-Za-z0-9_\-./]*(\?[^\s<>"']*)?(#[^\s<>"']*)?$/.test(s) && s.indexOf('//') === -1 && !/(^|\/)\.\.(\/|$)/.test(s) && !/^[a-z][a-z0-9+.\-]*:/i.test(s)) return s;
    return '';
  }

  function emptyProfile() {
    var p = {};
    PROFILE_KEYS.forEach(function (k) { p[k] = k === 'experienceYears' ? null : ''; });
    return p;
  }
  function emptyApplication() {
    return {
      type: 'baru', kategori: '', submittedAt: '', updatedAt: '',
      pengalaman: [], dokumen: [], pasFoto: '',
      pembayaran: { metode: '', tanggal: '', buktiUrl: '' },
      pernyataan: { kodeEtik: false, kebenaranData: false, privasi: false, namaTerang: '', tanggal: '' },
      catatan: ''
    };
  }
  function defaultMember(user) {
    var t = nowIso();
    return {
      uid: user.uid,
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      photoURL: user.photoURL || '',
      kta: '',
      memberType: 'Praktisi',
      status: 'Draf',
      joinedAt: todayIso(),
      validUntil: '',
      approvedAt: '',
      approvedBy: '',
      profile: emptyProfile(),
      competencies: [],
      certificates: [],
      application: emptyApplication(),
      review: { note: '', history: [] },
      createdAt: t,
      updatedAt: t
    };
  }
  /** Fill missing keys so pages can rely on the full v2 Member shape (read-side normalisation). */
  function normalize(m) {
    if (!m || typeof m !== 'object') return null;
    var out = clone(m);
    ['name', 'email', 'phone', 'photoURL', 'kta', 'joinedAt', 'validUntil', 'approvedBy'].forEach(function (k) { if (out[k] === undefined || out[k] === null) out[k] = ''; });
    ['approvedAt', 'updatedAt', 'createdAt'].forEach(function (k) { out[k] = toIso(out[k]); });
    if (MEMBER_TYPES.indexOf(out.memberType) === -1) out.memberType = 'Praktisi';
    var app = out.application && typeof out.application === 'object' ? out.application : {};
    var ea = emptyApplication();
    out.application = Object.assign(ea, app);
    out.application.submittedAt = toIso(out.application.submittedAt);
    out.application.updatedAt = toIso(out.application.updatedAt);
    if (['baru', 'perpanjangan'].indexOf(out.application.type) === -1) out.application.type = 'baru';
    /* Read-side sanitising: rules only bound list SIZES, so item shapes and links are re-checked here —
       pages (incl. the admin console) never receive javascript:/data: links or non-string fields. */
    var ap = out.application = {
      type: out.application.type, kategori: typeof app.kategori === 'string' ? app.kategori : '',
      submittedAt: typeof out.application.submittedAt === 'string' ? out.application.submittedAt : '',
      updatedAt: typeof out.application.updatedAt === 'string' ? out.application.updatedAt : '',
      pengalaman: app.pengalaman, dokumen: app.dokumen, pasFoto: app.pasFoto, pembayaran: null, pernyataan: null, catatan: txt(app.catatan, LIMITS.catatan)
    };
    ap.pengalaman = cleanPengalaman(ap.pengalaman, true);
    ap.dokumen = cleanDokumen(ap.dokumen, true);
    ap.pasFoto = typeof ap.pasFoto === 'string' && PHOTO_RE.test(ap.pasFoto) ? ap.pasFoto : '';
    var pb = app.pembayaran && typeof app.pembayaran === 'object' ? app.pembayaran : {};
    ap.pembayaran = { metode: txt(pb.metode, 60), tanggal: isIsoDate(pb.tanggal) ? pb.tanggal : '', buktiUrl: httpsUrl(txt(pb.buktiUrl)) };
    var pn = app.pernyataan && typeof app.pernyataan === 'object' ? app.pernyataan : {};
    ap.pernyataan = { kodeEtik: pn.kodeEtik === true, kebenaranData: pn.kebenaranData === true, privasi: pn.privasi === true, namaTerang: txt(pn.namaTerang, 120), tanggal: isIsoDate(pn.tanggal) ? pn.tanggal : '' };
    out.photoURL = photoUrl(out.photoURL);
    /* status: unknown → Draf; v1 'Menunggu Verifikasi' without a submitted application → Draf */
    if (STATUSES.indexOf(out.status) === -1) out.status = 'Draf';
    if (out.status === 'Menunggu Verifikasi' && !out.application.submittedAt) out.status = 'Draf';
    var rv = out.review && typeof out.review === 'object' ? out.review : {};
    out.review = {
      note: txt(rv.note, LIMITS.note),
      history: (Array.isArray(rv.history) ? rv.history : []).filter(function (x) { return x && typeof x === 'object'; }).map(function (x) {
        return { at: txt(toIso(x.at), 40), by: txt(x.by, 128), byName: txt(x.byName, 120), action: txt(x.action, 40), note: txt(x.note, LIMITS.note) };
      })
    };
    out.profile = Object.assign(emptyProfile(), out.profile && typeof out.profile === 'object' && !Array.isArray(out.profile) ? out.profile : {});
    PROFILE_KEYS.forEach(function (k) {
      var v = out.profile[k];
      if (k === 'experienceYears') out.profile[k] = v === null || v === undefined || v === '' || !isFinite(Number(v)) || typeof v === 'object' ? null : Number(v);
      else out.profile[k] = txt(v, k === 'bio' || k === 'address' ? 2000 : 300);
    });
    out.competencies = cleanCompetencies(out.competencies, true);
    out.certificates = cleanCertificates(out.certificates, true);
    ['name', 'email', 'phone', 'kta', 'joinedAt', 'validUntil', 'approvedBy', 'approvedAt', 'createdAt', 'updatedAt'].forEach(function (k) { if (typeof out[k] !== 'string') out[k] = txt(out[k], 200); });
    out.contoh = !!out.contoh;
    return out;
  }
  function effectiveStatus(m) {
    if (U().effectiveStatus) return U().effectiveStatus(m);
    if (!m) return '';
    if (m.status === 'Aktif' && m.validUntil && m.validUntil < todayIso()) return 'Kedaluwarsa';
    return m.status;
  }
  function canRenew(m) {
    if (U().canRenew) return U().canRenew(m);
    var st = effectiveStatus(m);
    return st === 'Kedaluwarsa' || st === 'Nonaktif';
  }

  /* Keys a member may write (mirrors firestore.rules hasOnly + size limits, so Demo mode
     behaves like Firebase mode: unknown keys would be rejected there with permission-denied). */
  var EDITABLE = { name: 120, email: 200, phone: 24, photoURL: 1000, profile: 0, competencies: 0, certificates: 0 };
  var warned = Object.create(null);
  function cleanPatch(patch) {
    var p = stripUndefined(clone(patch || {})) || {};
    PROTECTED.forEach(function (k) { delete p[k]; });
    Object.keys(p).forEach(function (k) {
      if (!own(EDITABLE, k)) {
        if (!warned[k]) { warned[k] = true; console.warn('[PPAPI] saveMember: kolom "' + k + '" tidak dikenal dan diabaikan (lihat bentuk Member di SPEC §2.2).'); }
        delete p[k];
      } else if (EDITABLE[k]) {
        p[k] = p[k] === null ? '' : String(p[k]).trim().slice(0, EDITABLE[k]);
      }
    });
    if (p.profile !== undefined && (!p.profile || typeof p.profile !== 'object' || Array.isArray(p.profile))) delete p.profile;
    if (p.profile && typeof p.profile === 'object') {
      var prof = {};
      Object.keys(p.profile).forEach(function (k) {
        if (PROFILE_KEYS.indexOf(k) === -1) {
          if (!warned['profile.' + k]) { warned['profile.' + k] = true; console.warn('[PPAPI] saveMember: profile.' + k + ' tidak dikenal dan diabaikan (lihat bentuk Member di SPEC §2.2).'); }
          return;
        }
        var v = p.profile[k];
        if (k === 'experienceYears') prof[k] = v === '' || v === null || v === undefined || !isFinite(Number(v)) ? null : Math.max(0, Math.min(80, Math.round(Number(v))));
        else prof[k] = v === null || v === undefined ? '' : String(v).slice(0, k === 'bio' || k === 'address' ? 2000 : 300);
      });
      p.profile = prof;
    }
    if (p.competencies !== undefined && !Array.isArray(p.competencies)) delete p.competencies;
    if (p.certificates !== undefined && !Array.isArray(p.certificates)) delete p.certificates;
    if (p.photoURL !== undefined) p.photoURL = photoUrl(p.photoURL);
    if (Array.isArray(p.competencies)) p.competencies = cleanCompetencies(p.competencies);
    if (Array.isArray(p.certificates)) p.certificates = cleanCertificates(p.certificates);
    return p;
  }
  /* list item shapes (write AND read side: data may also arrive around the store, e.g. via the console) */
  function txt(v, max) { return v === null || v === undefined || typeof v === 'object' ? '' : String(v).slice(0, max || 1000); }
  /* stable ids on the read side (index), fresh ids on the write side */
  function itemId(x, prefix, i, read) { return txt(x.id, 80) || (read ? prefix + '-' + (i + 1) : rid(prefix)); }
  function cleanCompetencies(list, read) {
    return (Array.isArray(list) ? list : []).filter(function (c) { return c && typeof c === 'object'; }).slice(0, 50).map(function (c, i) {
      var since = c.since === '' || c.since === null || c.since === undefined ? null : Number(c.since);
      return {
        id: itemId(c, 'k', i, read),
        code: txt(c.code, 40), name: txt(c.name, 200),
        level: LEVELS.indexOf(c.level) !== -1 ? c.level : 'Dasar',
        since: since === null || isFinite(since) ? since : null,
        notes: txt(c.notes, 1000)
      };
    });
  }
  function cleanCertificates(list, read) {
    return (Array.isArray(list) ? list : []).filter(function (c) { return c && typeof c === 'object'; }).slice(0, 50).map(function (c, i) {
      return {
        id: itemId(c, 'c', i, read),
        title: txt(c.title, 200), number: txt(c.number, 120), issuer: txt(c.issuer, 200),
        issuedAt: txt(c.issuedAt, 10), expiresAt: txt(c.expiresAt, 10), link: httpUrl(txt(c.link, 1000))
      };
    });
  }
  function cleanPengalaman(list, read) {
    return (Array.isArray(list) ? list : []).filter(function (x) { return x && typeof x === 'object'; }).slice(0, LIMITS.pengalaman).map(function (x, i) {
      return { id: str(itemId(x, 'p', i, read), 60), proyek: str(txt(x.proyek), 200), peran: str(txt(x.peran), 120), tahun: str(txt(x.tahun), 9), lokasi: str(txt(x.lokasi), 120) };
    }).filter(function (x) { return x.proyek || x.peran || x.tahun || x.lokasi; });
  }
  function cleanDokumen(list, read) {
    return (Array.isArray(list) ? list : []).filter(function (x) { return x && typeof x === 'object'; }).slice(0, LIMITS.dokumen).map(function (x, i) {
      return { id: str(itemId(x, 'd', i, read), 60), jenis: DOC_TYPES.indexOf(x.jenis) !== -1 ? x.jenis : 'Lainnya', label: str(txt(x.label), 160), url: httpsUrl(txt(x.url)) };
    }).filter(function (x) { return x.label || x.url; });
  }
  function merge(base, patch) {
    var out = clone(base);
    Object.keys(patch).forEach(function (k) {
      if (k === 'profile') out.profile = Object.assign({}, out.profile || {}, patch.profile);
      else out[k] = patch[k];
    });
    return out;
  }

  /* -------- application (formulir pendaftaran) sanitising — limits = firestore.rules -------- */
  var PHOTO_MAX_CHARS = Math.ceil(LIMITS.pasFotoKB * 1024 / 3) * 4 + 32;
  /* kategori a member may apply for: organisasi kategori with bisaDiajukan !== false (Kehormatan is
     designated by the secretariat), plus — for a renewal — the category the member already holds */
  function allowedKategori(m) {
    var list = applyTypes().slice();
    if (m && m.approvedAt && MEMBER_TYPES.indexOf(m.memberType) !== -1 && list.indexOf(m.memberType) === -1) list.push(m.memberType);
    return list;
  }
  function cleanApplication(patch, base, member) {
    var a = clone(base || emptyApplication());
    var p = stripUndefined(clone(patch || {})) || {};
    if (p.kategori !== undefined) a.kategori = allowedKategori(member).indexOf(str(p.kategori, 40)) !== -1 ? str(p.kategori, 40) : '';
    if (p.catatan !== undefined) a.catatan = str(p.catatan, LIMITS.catatan);
    if (Array.isArray(p.pengalaman)) a.pengalaman = cleanPengalaman(p.pengalaman);
    if (Array.isArray(p.dokumen)) a.dokumen = cleanDokumen(p.dokumen);
    if (p.pasFoto !== undefined) {
      var ph = String(p.pasFoto || '');
      if (ph && !PHOTO_RE.test(ph)) throw storeError('store/invalid-photo', 'Pas foto harus berupa gambar JPEG, PNG, atau WebP.');
      if (ph.length > PHOTO_MAX_CHARS) throw storeError('store/photo-too-large', 'Ukuran pas foto maksimal ' + LIMITS.pasFotoKB + ' KB. Gunakan foto berukuran lebih kecil.');
      a.pasFoto = ph;
    }
    if (p.pembayaran && typeof p.pembayaran === 'object') {
      var pb = p.pembayaran, cur = a.pembayaran || {};
      a.pembayaran = {
        metode: pb.metode !== undefined ? str(pb.metode, 60) : (cur.metode || ''),
        tanggal: pb.tanggal !== undefined ? (isIsoDate(pb.tanggal) ? pb.tanggal : '') : (cur.tanggal || ''),
        buktiUrl: pb.buktiUrl !== undefined ? httpsUrl(pb.buktiUrl) : (cur.buktiUrl || '')
      };
    }
    if (p.pernyataan && typeof p.pernyataan === 'object') {
      var pn = p.pernyataan, cp = a.pernyataan || {};
      a.pernyataan = {
        kodeEtik: pn.kodeEtik !== undefined ? pn.kodeEtik === true : !!cp.kodeEtik,
        kebenaranData: pn.kebenaranData !== undefined ? pn.kebenaranData === true : !!cp.kebenaranData,
        privasi: pn.privasi !== undefined ? pn.privasi === true : !!cp.privasi,
        namaTerang: pn.namaTerang !== undefined ? str(pn.namaTerang, 120) : (cp.namaTerang || ''),
        tanggal: pn.tanggal !== undefined ? (isIsoDate(pn.tanggal) ? pn.tanggal : '') : (cp.tanggal || '')
      };
    }
    return a;
  }
  function applyTypes() {
    var org = PPAPI.data && PPAPI.data.organisasi && PPAPI.data.organisasi.keanggotaan;
    var list = org && Array.isArray(org.kategori) ? org.kategori : null;
    if (!list) return MEMBER_TYPES.filter(function (t) { return t !== 'Kehormatan'; });
    return list.filter(function (k) { return k && k.bisaDiajukan !== false && MEMBER_TYPES.indexOf(k.nama) !== -1; }).map(function (k) { return k.nama; });
  }
  /** What is still missing before the application can be submitted → [{key, step, label}] */
  function applicationMissing(member) {
    var m = normalize(member) || normalize(defaultMember({ uid: '' }));
    var a = m.application, p = m.profile, out = [];
    function need(ok, key, step, label) { if (!ok) out.push({ key: key, step: step, label: label }); }
    function filled(v) { return v !== null && v !== undefined && String(v).trim() !== ''; }
    need(allowedKategori(m).indexOf(a.kategori) !== -1, 'kategori', 'kategori', 'Kategori keanggotaan');
    need(String(m.name || '').trim().length >= 3, 'name', 'data-diri', 'Nama lengkap');
    var phoneOk = U().normalizePhoneID ? !!U().normalizePhoneID(m.phone) : filled(m.phone);
    need(phoneOk, 'phone', 'data-diri', 'Nomor HP');
    need(filled(p.birthDate), 'birthDate', 'data-diri', 'Tanggal lahir');
    need(filled(p.province), 'province', 'data-diri', 'Provinsi');
    need(filled(p.city), 'city', 'data-diri', 'Kota / kabupaten');
    need(filled(p.company), 'company', 'profesional', 'Perusahaan / instansi');
    need(filled(p.position), 'position', 'profesional', 'Jabatan');
    need(a.pengalaman.length > 0 || (p.experienceYears !== null && p.experienceYears !== '' && p.experienceYears !== undefined), 'pengalaman', 'profesional', 'Pengalaman di bidang perancah (tahun) atau riwayat proyek');
    var cfg = PPAPI.config || {};
    if (cfg.iuran && cfg.iuran.aktif) need(!!a.pembayaran.buktiUrl, 'pembayaran', 'dokumen', 'Tautan bukti pembayaran iuran');
    need(a.pernyataan.kodeEtik === true, 'kodeEtik', 'pernyataan', 'Pernyataan mematuhi Kode Etik dan AD/ART PPAPI');
    need(a.pernyataan.kebenaranData === true, 'kebenaranData', 'pernyataan', 'Pernyataan kebenaran data');
    need(a.pernyataan.privasi === true, 'privasi', 'pernyataan', 'Persetujuan Kebijakan Privasi');
    need(String(a.pernyataan.namaTerang || '').trim().length >= 3, 'namaTerang', 'pernyataan', 'Nama terang (tanda tangan)');
    return out;
  }

  async function fx() {
    var f = PPAPI.auth && PPAPI.auth._firebase ? await PPAPI.auth._firebase() : null;
    if (!f) throw storeError('store/unavailable', 'Layanan data belum siap. Muat ulang halaman, lalu coba lagi.');
    return f;
  }
  function me() { return PPAPI.auth && PPAPI.auth.current ? PPAPI.auth.current() : null; }
  function refreshSessionFor(uid) {
    var u = me();
    if (u && u.uid === uid && PPAPI.session && typeof PPAPI.session.refresh === 'function') {
      return PPAPI.session.refresh().catch(function () { /* ignore */ });
    }
    return Promise.resolve();
  }

  /* ======================================================================
     MEMBER (self)
     ====================================================================== */
  async function rawMember(uid) {
    if (mode() === 'local') return lsGet(K_MEMBER + uid, null);
    var f = await fx();
    try {
      var snap = await f.db.collection('members').doc(uid).get();
      return snap.exists ? snap.data() : null;
    } catch (e) { throw mapFirestoreError(e); }
  }
  async function getMember(uid) {
    if (!uid) return null;
    return normalize(await rawMember(uid));
  }

  async function ensureMember(user) {
    if (!user || !user.uid) throw storeError('store/no-user', 'Pengguna tidak dikenali. Silakan masuk kembali.');
    var raw = await rawMember(user.uid);
    if (raw) {
      var existing = normalize(raw);
      /* v1 record "Menunggu Verifikasi" without a submitted application → Draf (also stored) */
      if (raw.status === 'Menunggu Verifikasi' && !(raw.application && raw.application.submittedAt)) {
        try {
          if (mode() === 'local') { raw.status = 'Draf'; lsSet(K_MEMBER + user.uid, raw); }
          else { var f0 = await fx(); await f0.db.collection('members').doc(user.uid).update({ status: 'Draf', updatedAt: nowIso() }); }
        } catch (e) { console.warn('[PPAPI] Status lama belum dapat diperbarui:', e && e.message); }
      }
      var sync = {};
      ['name', 'email', 'phone', 'photoURL'].forEach(function (k) { if (!existing[k] && user[k]) sync[k] = user[k]; });
      if (Object.keys(sync).length) return saveMember(user.uid, sync);
      return existing;
    }
    var doc = defaultMember(user);
    if (mode() === 'local') {
      lsSet(K_MEMBER + user.uid, doc);
      return normalize(doc);
    }
    var f = await fx();
    try { await f.db.collection('members').doc(user.uid).set(doc); }
    catch (e) { throw mapFirestoreError(e); }
    return normalize(doc);
  }

  async function saveMember(uid, patch) {
    if (!uid) throw storeError('store/no-user', 'Pengguna tidak dikenali. Silakan masuk kembali.');
    var p = cleanPatch(patch);
    /* Who writes? Firebase rules allow the OWNER (whitelisted keys) or an admin. Demo mirrors that for a
       signed-in caller: another member's record → store/forbidden. (A signed-out call stays possible in
       demo only — v1 tests use it; Firebase refuses it anyway.) */
    var actor = me(), actorAdmin = false;
    if (actor && actor.uid !== uid) {
      try { actorAdmin = PPAPI.auth && typeof PPAPI.auth.isAdmin === 'function' ? await PPAPI.auth.isAdmin() : false; } catch (e) { actorAdmin = false; }
      if (!actorAdmin) throw storeError('store/forbidden', 'Data anggota hanya dapat diubah oleh pemilik akun.');
    }
    /* member.email is the signed-in ACCOUNT email (admins add admins by email): a member may only set
       it to '' or to their own account email — anything else is ignored (rules: ownEmailOk). */
    if (p.email !== undefined && !actorAdmin) {
      var mine = actor && actor.uid === uid ? String(actor.email || '') : '';
      if (p.email === '' || (mine && p.email.toLowerCase() === mine.toLowerCase())) p.email = p.email === '' ? '' : mine;
      else {
        if (!warned['email']) { warned.email = true; console.warn('[PPAPI] saveMember: email anggota mengikuti email akun dan tidak dapat diganti di sini.'); }
        delete p.email;
      }
    }
    var existing = await getMember(uid);
    if (!existing) {
      var u = me();
      if (u && u.uid === uid) existing = await ensureMember(u);
      else throw storeError('store/not-found', 'Data anggota tidak ditemukan.');
    }
    var stamp = nowIso();
    if (mode() === 'local') {
      var cur = lsGet(K_MEMBER + uid, null) || existing;
      var merged = merge(cur, p);
      merged.updatedAt = stamp;
      lsSet(K_MEMBER + uid, merged);
      return normalize(merged);
    }
    var f = await fx();
    try {
      await f.db.collection('members').doc(uid).set(Object.assign({}, p, { updatedAt: stamp }), { merge: true });
    } catch (e) { throw mapFirestoreError(e); }
    var fresh = await getMember(uid);
    return fresh || normalize(Object.assign(merge(existing, p), { updatedAt: stamp }));
  }

  /* status gate for the member's own application */
  var EDIT_STATES = ['Draf', 'Perlu Perbaikan', 'Ditolak'];
  function applicationType(m) {
    var st = effectiveStatus(m);
    if (st === 'Kedaluwarsa' || st === 'Nonaktif' || st === 'Aktif') return 'perpanjangan';
    if (m.application && m.application.type === 'perpanjangan' && m.approvedAt) return 'perpanjangan';
    return 'baru';
  }
  function canEditApplication(m) {
    var st = effectiveStatus(m);
    return EDIT_STATES.indexOf(st) !== -1 || canRenew(m);
  }
  async function ownMember(uid) {
    var u = me();
    if (!uid || !u || u.uid !== uid) throw storeError('store/forbidden', 'Formulir hanya dapat diubah oleh pemilik akun.');
    var m = await getMember(uid);
    if (!m) m = await ensureMember(u);
    return m;
  }
  async function writeOwn(uid, patch) {
    if (mode() === 'local') {
      var cur = lsGet(K_MEMBER + uid, null) || {};
      Object.keys(patch).forEach(function (k) { cur[k] = patch[k]; });
      lsSet(K_MEMBER + uid, cur);
      return normalize(cur);
    }
    var f = await fx();
    try { await f.db.collection('members').doc(uid).update(patch); }
    catch (e) { throw mapFirestoreError(e); }
    return getMember(uid);
  }

  /** Draft save of the membership application (autosave). */
  async function saveApplication(uid, applicationPatch) {
    var m = await ownMember(uid);
    if (!canEditApplication(m)) {
      throw storeError('store/application-locked', effectiveStatus(m) === 'Menunggu Verifikasi'
        ? 'Pengajuan Anda sedang diverifikasi sekretariat. Tarik pengajuan terlebih dahulu bila ingin mengubah data.'
        : 'Formulir pendaftaran tidak dapat diubah karena keanggotaan Anda masih aktif.');
    }
    var app = cleanApplication(applicationPatch, m.application, m);
    app.type = applicationType(m);
    var stamp = nowIso();
    app.updatedAt = stamp;
    return writeOwn(uid, { application: app, updatedAt: stamp });
  }

  /** Submit the application → 'Menunggu Verifikasi'. Throws store/application-incomplete with .missing[] / .fields[]. */
  async function submitApplication(uid) {
    var m = await ownMember(uid);
    if (!canEditApplication(m)) {
      throw storeError('store/invalid-transition', effectiveStatus(m) === 'Menunggu Verifikasi'
        ? 'Pengajuan Anda sudah dikirim dan sedang diverifikasi sekretariat.'
        : 'Pengajuan tidak dapat dikirim pada status keanggotaan saat ini.');
    }
    var missing = applicationMissing(m);
    if (missing.length) {
      var err = storeError('store/application-incomplete', 'Formulir belum lengkap: ' + missing.map(function (x) { return x.label; }).join(', ') + '.');
      err.missing = missing.map(function (x) { return x.label; });
      err.fields = missing;
      throw err;
    }
    var stamp = nowIso();
    var app = clone(m.application);
    app.type = applicationType(m);
    app.submittedAt = stamp;
    app.updatedAt = stamp;
    if (!app.pernyataan.tanggal) app.pernyataan.tanggal = todayIso();
    var patch = { status: 'Menunggu Verifikasi', application: app, updatedAt: stamp };
    if (mode() === 'local') {
      var rv = clone(m.review);
      rv.history.push({ at: stamp, by: uid, byName: m.name || '', action: 'diajukan', note: app.type === 'perpanjangan' ? 'Pengajuan perpanjangan' : '' });
      patch.review = rv;
    }
    var out = await writeOwn(uid, patch);
    await refreshSessionFor(uid);
    return out;
  }

  /** Withdraw a submitted application → back to 'Draf' (only from 'Menunggu Verifikasi'). */
  async function withdrawApplication(uid) {
    var m = await ownMember(uid);
    if (m.status !== 'Menunggu Verifikasi') throw storeError('store/invalid-transition', 'Hanya pengajuan yang sedang menunggu verifikasi yang dapat ditarik.');
    var stamp = nowIso();
    var app = clone(m.application);
    app.submittedAt = '';
    app.updatedAt = stamp;
    var patch = { status: 'Draf', application: app, updatedAt: stamp };
    if (mode() === 'local') {
      var rv = clone(m.review);
      rv.history.push({ at: stamp, by: uid, byName: m.name || '', action: 'ditarik', note: '' });
      patch.review = rv;
    }
    var out = await writeOwn(uid, patch);
    await refreshSessionFor(uid);
    return out;
  }

  /* ======================================================================
     FEEDBACK (public submit)
     ====================================================================== */
  function feedbackRef() {
    var t = new Date();
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = '';
    for (var i = 0; i < 4; i++) r += abc.charAt(Math.floor(Math.random() * abc.length));
    return 'UB-' + t.getFullYear() + pad(t.getMonth() + 1) + pad(t.getDate()) + '-' + r;
  }

  async function submitFeedback(data) {
    data = data || {};
    var c = {};
    FEEDBACK_KEYS.forEach(function (k) { if (data[k] !== undefined) c[k] = data[k]; });
    c.kategori = str(c.kategori, 40);
    if (FEEDBACK_KATEGORI.indexOf(c.kategori) === -1) throw storeError('store/invalid-category', 'Pilih kategori umpan balik: ' + FEEDBACK_KATEGORI.join(', ') + '.');
    c.pesan = str(c.pesan, 4001);
    if (c.pesan.length < 10) throw storeError('store/message-too-short', 'Pesan minimal 10 karakter.');
    if (c.pesan.length > 4000) throw storeError('store/message-too-long', 'Pesan maksimal 4.000 karakter.');
    c.anonim = !!c.anonim;
    c.nama = c.anonim ? '' : str(c.nama, 120);
    c.email = c.anonim ? '' : str(c.email, 200);
    c.phone = c.anonim ? '' : str(c.phone, 20);
    c.subjek = str(c.subjek, 200);
    c.halaman = str(c.halaman || (w.location && w.location.pathname.split('/').pop()) || '', 200);
    var r = c.rating === '' || c.rating === null || c.rating === undefined ? null : Math.round(Number(c.rating));
    c.rating = r !== null && isFinite(r) && r >= 1 && r <= 5 ? r : null;
    var u = me();
    c.uid = !c.anonim && u ? u.uid : null;

    if (mode() === 'local') {
      var list = lsArr(K_FEEDBACK);
      var id = feedbackRef();
      list.push(Object.assign({ id: id }, c, { createdAt: nowIso() }));
      lsSet(K_FEEDBACK, list.slice(-200));
      await new Promise(function (res) { setTimeout(res, 350); });
      return { id: id };
    }
    var f = await fx();
    try {
      var ref = await f.db.collection('feedback').add(Object.assign({}, c, { createdAt: f.fb.firestore.FieldValue.serverTimestamp() }));
      return { id: ref.id };
    } catch (e) { throw mapFirestoreError(e); }
  }

  /* ======================================================================
     ADMIN (sekretariat) — every function throws store/forbidden for non-admins
     ====================================================================== */
  async function requireAdmin() {
    var u = me();
    if (!u) throw forbidden();
    var ok = false;
    try { ok = PPAPI.auth && typeof PPAPI.auth.isAdmin === 'function' ? await PPAPI.auth.isAdmin() : false; } catch (e) { ok = false; }
    if (!ok) throw forbidden();
    var mm = null;
    try { mm = await getMember(u.uid); } catch (e) { mm = null; }
    return { uid: u.uid, name: (mm && mm.name) || u.name || u.email || 'Admin' };
  }
  function auditEntry(adm, action, targetType, targetId, targetName, note) {
    return {
      at: nowIso(), by: adm.uid, byName: str(adm.name, 120), action: action, label: AUDIT_LABELS[action] || action,
      targetType: targetType || '', targetId: str(targetId, 200), targetName: str(targetName, 200), note: str(note, LIMITS.note)
    };
  }
  async function writeAudit(entry) {
    if (mode() === 'local') {
      var list = lsArr(K_AUDIT);
      list.push(Object.assign({ id: rid('log') }, entry));
      lsSet(K_AUDIT, list.slice(-500));
      return;
    }
    try { var f = await fx(); await f.db.collection('audit_log').add(entry); }
    catch (e) { console.warn('[PPAPI] Log aktivitas belum tercatat:', e && e.message); }
  }

  /* -------- members -------- */
  function sortMembers(list) {
    return list.sort(function (a, b) {
      var pa = a.status === 'Menunggu Verifikasi', pb = b.status === 'Menunggu Verifikasi';
      if (pa !== pb) return pa ? -1 : 1;
      if (pa) return String(a.application.submittedAt).localeCompare(String(b.application.submittedAt));
      return String(b.updatedAt).localeCompare(String(a.updatedAt));
    });
  }
  async function allMembers() {
    if (mode() === 'local') {
      return lsKeys(K_MEMBER).map(function (k) { return normalize(lsGet(k, null)); }).filter(function (m) { return m && m.uid; });
    }
    var f = await fx();
    try {
      var snap = await f.db.collection('members').get();
      var out = [];
      snap.forEach(function (doc) { var m = normalize(doc.data()); if (m) { if (!m.uid) m.uid = doc.id; out.push(m); } });
      return out;
    } catch (e) { throw mapFirestoreError(e); }
  }
  function memberMatches(m, q) {
    if (!q) return true;
    var hay = fold([m.name, m.email, m.phone, m.kta, m.profile.company, m.profile.city, m.profile.province, m.memberType, m.application.kategori].join(' '));
    return fold(q).split(' ').every(function (t) { return hay.indexOf(t) !== -1; });
  }
  /** listMembers({status?, q?}) — status = an EFFECTIVE status ('Aktif' excludes expired members,
      'Kedaluwarsa' lists them) or an array of statuses; q = words matched in name, email, HP, KTA, … */
  async function listMembers(opts) {
    await requireAdmin();
    opts = opts || {};
    var want = opts.status ? (Array.isArray(opts.status) ? opts.status : [opts.status]) : null;
    var list = (await allMembers()).filter(function (m) {
      if (want && want.indexOf(effectiveStatus(m)) === -1) return false;
      return memberMatches(m, opts.q);
    });
    return sortMembers(list);
  }
  async function adminGetMember(uid) {
    await requireAdmin();
    return getMember(uid);
  }
  function histEntry(adm, action, note) { return { at: nowIso(), by: adm.uid, byName: adm.name, action: action, note: str(note, LIMITS.note) }; }

  /* registry (public verification) entry built from a member — limited, public-safe fields only */
  function registryEntry(m, overrides) {
    var e = {
      kta: m.kta, nama: m.name, kategori: m.memberType,
      kompetensi: (m.competencies || []).map(function (c) { return c && c.name; }).filter(Boolean).slice(0, 5),
      kota: m.profile.city || '', berlakuHingga: m.validUntil || '', status: m.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif',
      namaCari: fold(m.name), updatedAt: nowIso()
    };
    if (m.contoh) e.contoh = true;
    return Object.assign(e, overrides || {});
  }
  function staticRegistry() { var r = PPAPI.data && PPAPI.data.registry; return Array.isArray(r) ? r : []; }
  function ktaFormat(year, n) { return 'PPAPI-' + year + '-' + ('000000' + n).slice(-6); }
  function ktaTaken(kta, extra) {
    var a = alnum(kta);
    if (staticRegistry().some(function (r) { return alnum(r.kta) === a; })) return true;
    return !!(extra && extra(kta));
  }

  /* apply an admin decision to a member (demo: sequential writes; firebase: one transaction) */
  async function adminMutate(uid, action, decide) {
    var adm = await requireAdmin();
    var year = new Date().getFullYear();
    if (mode() === 'local') {
      var raw = lsGet(K_MEMBER + uid, null);
      if (!raw) throw storeError('store/not-found', 'Data anggota tidak ditemukan.');
      var m = normalize(raw);
      var res = decide(m, adm);
      var reg = lsMap(K_REGISTRY);
      var used = {};
      allMembersSync().forEach(function (x) { if (x.kta && x.uid !== uid) used[alnum(x.kta)] = true; });
      /* a KTA that was never official (v1 ktaFromUid on a never-approved record) is kept only when no
         one else holds it — otherwise this approval would overwrite another member's registry entry */
      if (res.needKta && m.kta && !m.approvedAt && ktaTaken(m.kta, function (k) { return own(reg, k) || used[alnum(k)]; })) m.kta = '';
      if (res.needKta && !m.kta) {
        var counters = lsMap(K_COUNTERS), key = 'kta-' + year, n = Number(counters[key]) || 0;
        var kta;
        do { n += 1; kta = ktaFormat(year, n); } while (ktaTaken(kta, function (k) { return own(reg, k) || used[alnum(k)]; }) && n < 999999);
        counters[key] = n;
        lsSet(K_COUNTERS, counters);
        res.patch.kta = kta;
      }
      var next = Object.assign(clone(raw), res.patch);
      next.review = res.review;
      next.updatedAt = nowIso();
      lsSet(K_MEMBER + uid, next);
      var nm = normalize(next);
      if (res.registry) {
        var reg2 = lsMap(K_REGISTRY);
        var key2 = nm.kta;
        if (key2) {
          reg2[key2] = registryEntry(nm, res.registry === true ? null : res.registry);
          lsSet(K_REGISTRY, reg2);
        }
      }
      await writeAudit(auditEntry(adm, action, 'anggota', uid, nm.name, res.note));
      await refreshSessionFor(uid);
      return nm;
    }
    var f = await fx(), db = f.db, out = null;
    try {
      await db.runTransaction(async function (t) {
        var memRef = db.collection('members').doc(uid);
        var snap = await t.get(memRef);
        if (!snap.exists) throw storeError('store/not-found', 'Data anggota tidak ditemukan.');
        var m = normalize(snap.data());
        if (!m.uid) m.uid = uid;
        var res = decide(m, adm);
        var counterRef = null, n = null;
        /* never-approved (v1) KTA already in the public registry / static samples → assign a new one */
        if (res.needKta && m.kta && !m.approvedAt) {
          if (ktaTaken(m.kta) || (/^PPAPI-\d{4}-\d{6}$/.test(m.kta) && (await t.get(db.collection('registry').doc(m.kta))).exists)) m.kta = '';
        }
        if (res.needKta && !m.kta) {
          counterRef = db.collection('counters').doc('kta-' + year);
          var cs = await t.get(counterRef);
          n = cs.exists ? (Number(cs.data().value) || 0) : 0;
          var kta = null;
          for (var tries = 0; tries < 50; tries++) {
            n += 1;
            var cand = ktaFormat(year, n);
            if (ktaTaken(cand)) continue;
            var rs = await t.get(db.collection('registry').doc(cand));
            if (!rs.exists) { kta = cand; break; }
          }
          if (!kta) throw storeError('store/kta-unavailable', 'Nomor KTA baru belum dapat dibuat. Silakan coba lagi.');
          res.patch.kta = kta;
        }
        var stamp = nowIso();
        var patch = Object.assign({}, res.patch, { review: res.review, updatedAt: stamp });
        var nm = normalize(Object.assign(clone(snap.data()), patch));
        if (!nm.uid) nm.uid = uid;
        if (counterRef) t.set(counterRef, { value: n, updatedAt: stamp }, { merge: true });
        t.update(memRef, patch);
        if (res.registry && nm.kta) t.set(db.collection('registry').doc(nm.kta), registryEntry(nm, res.registry === true ? null : res.registry), { merge: true });
        t.set(db.collection('audit_log').doc(), auditEntry(adm, action, 'anggota', uid, nm.name, res.note));
        out = nm;
      });
    } catch (e) { throw mapFirestoreError(e); }
    await refreshSessionFor(uid);
    return out;
  }
  function allMembersSync() {
    return lsKeys(K_MEMBER).map(function (k) { return normalize(lsGet(k, null)); }).filter(Boolean);
  }
  function needNote(note, what) {
    if (str(note, LIMITS.note).length < 5) throw storeError('store/note-required', 'Tuliskan ' + what + ' (minimal 5 karakter).');
    return str(note, LIMITS.note);
  }
  function transitionError(msg) { return storeError('store/invalid-transition', msg); }
  function withHistory(m, entry, note) {
    var rv = clone(m.review);
    rv.history.push(entry);
    if (note !== undefined) rv.note = note;
    return rv;
  }
  function validDate(v, what) {
    if (!isIsoDate(v)) throw storeError('store/invalid-date', 'Tanggal ' + what + ' tidak valid (format TAHUN-BULAN-TANGGAL).');
    if (v < todayIso()) throw storeError('store/invalid-date', 'Tanggal ' + what + ' harus hari ini atau setelahnya.');
    return v;
  }
  function defaultValidUntil() { return U().defaultValidUntil ? U().defaultValidUntil() : (new Date().getFullYear() + 3) + '-12-31'; }

  function approve(uid, o) {
    o = o || {};
    return adminMutate(uid, 'anggota.disetujui', function (m, adm) {
      if (effectiveStatus(m) === 'Aktif') throw transitionError('Anggota ini sudah berstatus Aktif. Gunakan "Perpanjang" untuk mengubah masa berlaku.');
      var type = o.memberType || m.application.kategori || m.memberType;
      if (MEMBER_TYPES.indexOf(type) === -1) throw storeError('store/invalid-type', 'Pilih kategori keanggotaan yang valid.');
      var until = validDate(o.validUntil || defaultValidUntil(), 'berlaku hingga');
      var note = str(o.note, LIMITS.note);
      var patch = { status: 'Aktif', memberType: type, validUntil: until, approvedAt: nowIso(), approvedBy: adm.uid };
      if (!m.approvedAt) patch.joinedAt = todayIso();
      return { needKta: true, patch: patch, review: withHistory(m, histEntry(adm, 'disetujui', note), note), registry: true, note: note };
    });
  }
  function requestRevision(uid, note) {
    return adminMutate(uid, 'anggota.perbaikan', function (m, adm) {
      if (['Menunggu Verifikasi', 'Perlu Perbaikan'].indexOf(m.status) === -1) throw transitionError('Permintaan perbaikan hanya untuk pengajuan yang sedang diverifikasi.');
      var n = needNote(note, 'catatan perbaikan untuk pemohon');
      return { patch: { status: 'Perlu Perbaikan' }, review: withHistory(m, histEntry(adm, 'perbaikan', n), n), note: n };
    });
  }
  function reject(uid, note) {
    return adminMutate(uid, 'anggota.ditolak', function (m, adm) {
      if (['Menunggu Verifikasi', 'Perlu Perbaikan', 'Draf'].indexOf(m.status) === -1) throw transitionError('Penolakan hanya untuk pengajuan yang belum disetujui.');
      var n = needNote(note, 'alasan penolakan');
      return { patch: { status: 'Ditolak' }, review: withHistory(m, histEntry(adm, 'ditolak', n), n), note: n };
    });
  }
  function deactivate(uid, note) {
    return adminMutate(uid, 'anggota.dinonaktifkan', function (m, adm) {
      if (m.status !== 'Aktif') throw transitionError('Hanya anggota berstatus Aktif yang dapat dinonaktifkan.');
      var n = str(note, LIMITS.note);
      return { patch: { status: 'Nonaktif' }, review: withHistory(m, histEntry(adm, 'dinonaktifkan', n), n), registry: m.kta ? { status: 'Nonaktif' } : null, note: n };
    });
  }
  function reactivate(uid, o) {
    o = o || {};
    return adminMutate(uid, 'anggota.diaktifkan', function (m, adm) {
      if (m.status !== 'Nonaktif') throw transitionError('Hanya anggota berstatus Nonaktif yang dapat diaktifkan kembali.');
      var keep = m.validUntil && m.validUntil >= todayIso() ? m.validUntil : '';
      var until = validDate(o.validUntil || keep || defaultValidUntil(), 'berlaku hingga');
      var n = str(o.note, LIMITS.note);
      var patch = { status: 'Aktif', validUntil: until };
      if (!m.approvedAt) { patch.approvedAt = nowIso(); patch.approvedBy = adm.uid; }
      return { needKta: true, patch: patch, review: withHistory(m, histEntry(adm, 'diaktifkan', n), n), registry: true, note: n };
    });
  }
  function extend(uid, validUntil, note) {
    return adminMutate(uid, 'anggota.diperpanjang', function (m, adm) {
      if (m.status !== 'Aktif') throw transitionError('Perpanjangan langsung hanya untuk anggota berstatus Aktif (termasuk yang masa berlakunya telah habis).');
      var until = validDate(validUntil, 'berlaku hingga');
      var n = str(note, LIMITS.note) || ('Masa berlaku diperpanjang hingga ' + until + '.');
      return { patch: { validUntil: until }, review: withHistory(m, histEntry(adm, 'diperpanjang', n), m.review.note), registry: m.kta ? true : null, note: n };
    });
  }
  function setMemberType(uid, type) {
    return adminMutate(uid, 'anggota.kategori-diubah', function (m, adm) {
      if (MEMBER_TYPES.indexOf(type) === -1) throw storeError('store/invalid-type', 'Pilih kategori keanggotaan yang valid.');
      var n = 'Kategori: ' + m.memberType + ' → ' + type;
      return { patch: { memberType: type }, review: withHistory(m, histEntry(adm, 'kategori-diubah', n), m.review.note), registry: m.kta && m.status === 'Aktif' ? { kategori: type } : null, note: n };
    });
  }

  /* -------- feedback -------- */
  function normFeedback(x, id) {
    var o = Object.assign({}, x);
    if (id && !o.id) o.id = id;
    o.createdAt = toIso(o.createdAt);
    o.updatedAt = toIso(o.updatedAt);
    if (FEEDBACK_STATUS.indexOf(o.status) === -1) o.status = 'Baru';
    if (typeof o.catatanAdmin !== 'string') o.catatanAdmin = '';
    return o;
  }
  async function listFeedback() {
    await requireAdmin();
    if (mode() === 'local') {
      return lsArr(K_FEEDBACK).map(function (x) { return normFeedback(x); }).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
    }
    var f = await fx();
    try {
      var snap = await f.db.collection('feedback').orderBy('createdAt', 'desc').limit(500).get();
      var out = [];
      snap.forEach(function (doc) { out.push(normFeedback(doc.data(), doc.id)); });
      return out;
    } catch (e) { throw mapFirestoreError(e); }
  }
  async function updateFeedback(id, o) {
    var adm = await requireAdmin();
    o = o || {};
    var patch = { updatedAt: nowIso(), updatedBy: adm.uid };
    if (o.status !== undefined) {
      if (FEEDBACK_STATUS.indexOf(o.status) === -1) throw storeError('store/invalid-status', 'Status umpan balik: ' + FEEDBACK_STATUS.join(', ') + '.');
      patch.status = o.status;
    }
    if (o.catatanAdmin !== undefined) patch.catatanAdmin = str(o.catatanAdmin, LIMITS.note);
    var result;
    if (mode() === 'local') {
      var list = lsArr(K_FEEDBACK), hit = null;
      list.forEach(function (x) { if (x.id === id) { Object.assign(x, patch); hit = x; } });
      if (!hit) throw storeError('store/not-found', 'Umpan balik tidak ditemukan.');
      lsSet(K_FEEDBACK, list);
      result = normFeedback(hit);
    } else {
      var f = await fx();
      try {
        var ref = f.db.collection('feedback').doc(id);
        await ref.update(patch);
        var s = await ref.get();
        result = normFeedback(s.data(), id);
      } catch (e) { throw mapFirestoreError(e); }
    }
    await writeAudit(auditEntry(adm, 'umpan-balik.diperbarui', 'umpan-balik', id, result.subjek || result.kategori || id, [patch.status ? 'Status: ' + patch.status : '', patch.catatanAdmin || ''].filter(Boolean).join(' · ')));
    return result;
  }

  /* -------- admins -------- */
  async function listAdmins() {
    await requireAdmin();
    if (mode() === 'local') {
      var uids = lsArr(K_ADMINS);
      var users = lsMap('ppapi_demo_users');
      return uids.map(function (uid) {
        var m = normalize(lsGet(K_MEMBER + uid, null));
        var acc = null;
        Object.keys(users).forEach(function (k) { if (users[k] && users[k].uid === uid) acc = users[k]; });
        return { uid: uid, name: (m && m.name) || (acc && acc.name) || '', email: (m && m.email) || (acc && acc.email) || '', addedAt: '', addedBy: '' };
      });
    }
    var f = await fx();
    try {
      var snap = await f.db.collection('admins').get();
      var out = [];
      snap.forEach(function (doc) { var x = doc.data() || {}; out.push({ uid: doc.id, name: x.name || '', email: x.email || '', addedAt: toIso(x.addedAt), addedBy: x.addedBy || '' }); });
      return out;
    } catch (e) { throw mapFirestoreError(e); }
  }
  /* The ONE member record with this email — never a guess: several records with the same address
     (only possible through writes outside the site) → store/ambiguous-email. */
  function ambiguous() { return storeError('store/ambiguous-email', 'Email tersebut tercatat pada lebih dari satu data anggota. Periksa datanya di Firebase Console sebelum menambahkan admin.'); }
  async function findMemberByEmail(email) {
    var e = str(email, 200).toLowerCase();
    if (mode() === 'local') {
      var hits = allMembersSync().filter(function (m) { return String(m.email || '').toLowerCase() === e; });
      if (hits.length > 1) throw ambiguous();
      if (hits.length) return hits[0];
      var users = lsMap('ppapi_demo_users'), acc = own(users, e) ? users[e] : null;
      return acc ? normalize({ uid: acc.uid, name: acc.name, email: acc.email }) : null;
    }
    var f = await fx();
    try {
      var found = Object.create(null);
      var raw = str(email, 200);
      var variants = e === raw ? [e] : [e, raw];
      for (var i = 0; i < variants.length; i++) {
        var snap = await f.db.collection('members').where('email', '==', variants[i]).limit(3).get();
        snap.forEach(function (doc) { var m = normalize(doc.data()); if (m) { if (!m.uid) m.uid = doc.id; found[doc.id] = m; } });
      }
      var list = Object.keys(found).map(function (k) { return found[k]; });
      if (list.length > 1) throw ambiguous();
      return list[0] || null;
    } catch (er) { throw mapFirestoreError(er); }
  }
  async function addAdmin(email) {
    var adm = await requireAdmin();
    if (!(U().isEmail ? U().isEmail(email) : /@/.test(String(email)))) throw storeError('store/invalid-email', 'Masukkan alamat email yang valid.');
    var m = await findMemberByEmail(email);
    if (!m || !m.uid) throw storeError('store/not-found', 'Email tersebut belum terdaftar sebagai akun di situs PPAPI. Minta yang bersangkutan membuat akun terlebih dahulu.');
    var current = await listAdmins();
    if (current.some(function (a) { return a.uid === m.uid; })) throw storeError('store/already-admin', 'Akun tersebut sudah menjadi admin.');
    var rec = { uid: m.uid, name: str(m.name, 120), email: str(m.email, 200), addedAt: nowIso(), addedBy: adm.uid };
    if (mode() === 'local') {
      var uids = lsArr(K_ADMINS);
      uids.push(m.uid);
      lsSet(K_ADMINS, uids);
    } else {
      var f = await fx();
      try { await f.db.collection('admins').doc(m.uid).set(rec); }
      catch (e) { throw mapFirestoreError(e); }
    }
    await writeAudit(auditEntry(adm, 'admin.ditambah', 'admin', m.uid, m.name || m.email, m.email));
    if (PPAPI.auth && PPAPI.auth._clearAdminCache) PPAPI.auth._clearAdminCache();
    return rec;
  }
  async function removeAdmin(uid) {
    var adm = await requireAdmin();
    var list = await listAdmins();
    var target = list.filter(function (a) { return a.uid === uid; })[0];
    if (!target) throw storeError('store/not-found', 'Akun tersebut bukan admin.');
    if (list.length <= 1) throw storeError('store/last-admin', 'Admin terakhir tidak dapat dihapus. Tambahkan admin lain terlebih dahulu.');
    if (mode() === 'local') {
      lsSet(K_ADMINS, lsArr(K_ADMINS).filter(function (x) { return x !== uid; }));
    } else {
      var f = await fx();
      try { await f.db.collection('admins').doc(uid).delete(); }
      catch (e) { throw mapFirestoreError(e); }
    }
    await writeAudit(auditEntry(adm, 'admin.dihapus', 'admin', uid, target.name || target.email, target.email));
    if (PPAPI.auth && PPAPI.auth._clearAdminCache) PPAPI.auth._clearAdminCache();
    if (uid === adm.uid) await refreshSessionFor(uid);
    return true;
  }

  /* -------- audit log -------- */
  async function audit(limit) {
    await requireAdmin();
    var n = Math.max(1, Math.min(500, parseInt(limit, 10) || 50));
    if (mode() === 'local') {
      return lsArr(K_AUDIT).slice().sort(function (a, b) { return String(b.at).localeCompare(String(a.at)); }).slice(0, n);
    }
    var f = await fx();
    try {
      var snap = await f.db.collection('audit_log').orderBy('at', 'desc').limit(n).get();
      var out = [];
      snap.forEach(function (doc) { var x = Object.assign({ id: doc.id }, doc.data()); x.at = toIso(x.at); out.push(x); });
      return out;
    } catch (e) { throw mapFirestoreError(e); }
  }

  /** Counters for the console overview. */
  async function summary() {
    await requireAdmin();
    var members = await allMembers();
    var s = { total: members.length, draf: 0, menunggu: 0, perbaikan: 0, aktif: 0, ditolak: 0, nonaktif: 0, kedaluwarsa: 0, akanKedaluwarsa: 0, umpanBalikBaru: 0 };
    members.forEach(function (m) {
      var st = effectiveStatus(m);
      if (st === 'Draf') s.draf++;
      else if (st === 'Menunggu Verifikasi') s.menunggu++;
      else if (st === 'Perlu Perbaikan') s.perbaikan++;
      else if (st === 'Ditolak') s.ditolak++;
      else if (st === 'Nonaktif') s.nonaktif++;
      else if (st === 'Kedaluwarsa') s.kedaluwarsa++;
      else if (st === 'Aktif') {
        s.aktif++;
        var d = m.validUntil && U().daysUntil ? U().daysUntil(m.validUntil) : null;
        if (d !== null && d <= 60) s.akanKedaluwarsa++;
      }
    });
    try { s.umpanBalikBaru = (await listFeedback()).filter(function (x) { return x.status === 'Baru'; }).length; } catch (e) { s.umpanBalikBaru = 0; }
    return s;
  }

  /** CSV for Excel (Indonesian locale): UTF-8 BOM, ';' separator, CRLF; formula-like cells are neutralised. */
  function exportMembersCsv(members) {
    var cols = [
      ['Nomor KTA', function (m) { return m.kta; }],
      ['Nama', function (m) { return m.name; }],
      ['Email', function (m) { return m.email; }],
      ['Nomor HP', function (m) { var n = U().normalizePhoneID ? U().normalizePhoneID(m.phone) : null; return n ? '0' + n.slice(3) : m.phone; }],
      ['Kategori', function (m) { return m.memberType; }],
      ['Status', function (m) { return m.status; }],
      ['Status efektif', function (m) { return effectiveStatus(m); }],
      ['Berlaku hingga', function (m) { return m.validUntil; }],
      ['Bergabung', function (m) { return m.joinedAt; }],
      ['Disetujui', function (m) { return String(m.approvedAt || '').slice(0, 10); }],
      ['Provinsi', function (m) { return m.profile.province; }],
      ['Kota/Kabupaten', function (m) { return m.profile.city; }],
      ['Perusahaan/Instansi', function (m) { return m.profile.company; }],
      ['Jabatan', function (m) { return m.profile.position; }],
      ['Pengalaman (tahun)', function (m) { return m.profile.experienceYears === null ? '' : m.profile.experienceYears; }],
      ['Pendidikan', function (m) { return m.profile.education; }],
      ['Jenis pengajuan', function (m) { return m.application.type; }],
      ['Diajukan', function (m) { return String(m.application.submittedAt || '').slice(0, 10); }],
      ['Diperbarui', function (m) { return String(m.updatedAt || '').slice(0, 10); }],
      ['Data contoh', function (m) { return m.contoh ? 'ya' : ''; }]
    ];
    function cell(v) {
      var s = v === null || v === undefined ? '' : String(v);
      /* formula / DDE triggers (OWASP CSV injection), incl. the full-width forms Excel also accepts */
      if (/^[=+\-@\t\r＝＋－＠]/.test(s)) s = "'" + s;
      if (/[";,\r\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
      return s;
    }
    var rows = [cols.map(function (c) { return cell(c[0]); }).join(';')];
    (members || []).forEach(function (raw) {
      var m = normalize(raw);
      if (m) rows.push(cols.map(function (c) { return cell(c[1](m)); }).join(';'));
    });
    return '﻿' + rows.join('\r\n') + '\r\n';
  }

  /* ======================================================================
     CONTENT — static PPAPI_DATA[type] merged with admin-managed items
     ====================================================================== */
  var contentCache = {};
  function staticContent(type) {
    var d = PPAPI.data || {};
    return Array.isArray(d[type]) ? d[type] : [];
  }
  async function managedContent(type, fresh) {
    if (mode() === 'local') return lsArr(K_CONTENT + type).filter(function (x) { return x && x.id; });
    if (!fresh && contentCache[type]) return contentCache[type];
    var f = await fx();
    try {
      var snap = await f.db.collection('content_' + type).get();
      var out = [];
      snap.forEach(function (doc) { var x = Object.assign({}, doc.data(), { id: doc.id }); x.updatedAt = toIso(x.updatedAt); out.push(x); });
      contentCache[type] = out;
      return out;
    } catch (e) {
      console.warn('[PPAPI] Konten dikelola (' + type + ') belum dapat dimuat:', e && e.message);
      return [];
    }
  }
  function rankIn(list, v) { var i = list.indexOf(v); return i === -1 ? list.length : i; }
  /* Sorting "like the static data":
     • berita / pengumuman: tanggal (newest first) · agenda: mulai (soonest first);
     • pustaka / regulasi are curated lists: static items keep their file order exactly; an item added
       by an admin is placed right after the last static item of its group (kategori / jenis), or —
       when the group has no static item yet — after the groups that come before it in the standard
       order; several new items in one group: newest (tanggal / tahun) first. */
  var GROUPS = { pustaka: ['kategori', PUSTAKA_KATEGORI, 'tanggal'], regulasi: ['jenis', REG_JENIS, 'tahun'] };
  function anchorItems(type, list) {
    var g = GROUPS[type];
    if (!g) return;
    var key = g[0], ranks = g[1];
    var statics = list.filter(function (x) { return x._i !== undefined; }).sort(function (a, b) { return a._i - b._i; });
    list.forEach(function (x) {
      if (x._i !== undefined) { x._pos = x._i; return; }
      var last = -1, i;
      for (i = 0; i < statics.length; i++) if (statics[i][key] === x[key]) last = statics[i]._i;
      if (last === -1) {
        var r = rankIn(ranks, x[key]);
        for (i = 0; i < statics.length; i++) if (rankIn(ranks, statics[i][key]) <= r) last = statics[i]._i;
      }
      x._pos = last + 0.5;
    });
  }
  function compareContent(type, a, b) {
    function byIdx() { return (a._i === undefined ? 1e9 : a._i) - (b._i === undefined ? 1e9 : b._i); }
    var r;
    switch (type) {
      case 'berita':
      case 'pengumuman':
        r = String(b.tanggal || '').localeCompare(String(a.tanggal || ''));
        return r || byIdx();
      case 'agenda':
        r = String(a.mulai || '').localeCompare(String(b.mulai || ''));
        return r || byIdx();
      case 'pustaka':
      case 'regulasi':
        r = a._pos - b._pos;
        if (r) return r;
        return type === 'regulasi' ? (Number(b.tahun) || 0) - (Number(a.tahun) || 0) : String(b.tanggal || '').localeCompare(String(a.tanggal || ''));
      default:
        return byIdx();
    }
  }
  function checkType(type) {
    if (CONTENT_TYPES.indexOf(type) === -1) throw storeError('store/invalid-type', 'Jenis konten tidak dikenal: ' + type + '.');
  }
  /** list(type, {includeHidden}) → merged items; each has _static/_managed (and hidden when includeHidden). */
  /* managed items may also be written outside the site (Firestore console, older data): links are
     re-checked on read with the same rules SANITIZE applies on save */
  function safeManaged(type, it) {
    var x = Object.assign({}, it);
    if (type === 'berita' && x.gambar !== undefined) x.gambar = /^assets\/img\/[\w\-./]+\.(webp|jpe?g|png)$/i.test(String(x.gambar || '')) || /^https:\/\//.test(String(x.gambar || '')) ? contentUrl(x.gambar) : '';
    if (type === 'agenda' && x.tautanDaftar !== undefined) x.tautanDaftar = httpsUrl(txt(x.tautanDaftar));
    if (type === 'pustaka' && x.tautan !== undefined) x.tautan = contentUrl(txt(x.tautan));
    if (type === 'regulasi') {
      if (x.tautan !== undefined) x.tautan = httpUrl(txt(x.tautan));
      if (x.sumber !== undefined) x.sumber = (Array.isArray(x.sumber) ? x.sumber : []).map(function (u) { return httpUrl(txt(u)); }).filter(Boolean);
    }
    return x;
  }
  async function contentList(type, opts) {
    checkType(type);
    opts = opts || {};
    var statics = staticContent(type);
    var managed = (await managedContent(type, opts.fresh)).map(function (it) { return safeManaged(type, it); });
    var byId = Object.create(null), order = [];
    statics.forEach(function (it, i) {
      if (!it || !it.id) return;
      byId[it.id] = Object.assign({}, it, { _i: i, _static: true, _managed: false });
      order.push(it.id);
    });
    managed.forEach(function (it) {
      var base = byId[it.id];
      if (base) {
        byId[it.id] = it.hidden && Object.keys(it).filter(function (k) { return ['id', 'hidden', 'updatedAt', 'updatedBy'].indexOf(k) === -1; }).length === 0
          ? Object.assign({}, base, { hidden: true, _managed: true, updatedAt: it.updatedAt, updatedBy: it.updatedBy })
          : Object.assign({}, base, it, { _i: base._i, _static: true, _managed: true });
      } else {
        byId[it.id] = Object.assign({}, it, { _static: false, _managed: true });
        order.push(it.id);
      }
    });
    var list = order.map(function (id) { return byId[id]; }).filter(function (x) { return opts.includeHidden || !x.hidden; });
    anchorItems(type, list);
    list.sort(function (a, b) { return compareContent(type, a, b); });
    return list.map(function (x) { var y = Object.assign({}, x); delete y._i; delete y._pos; return y; });
  }
  async function contentGet(type, id) {
    var all = await contentList(type, { includeHidden: true });
    return all.filter(function (x) { return x.id === id; })[0] || null;
  }
  function slugId(s) {
    var base = U().slugify ? U().slugify(s) : String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return (base || 'konten').slice(0, 60);
  }
  function arrStr(v, n, max) { return (Array.isArray(v) ? v : (typeof v === 'string' && v ? v.split(/\s*[,;\n]\s*/) : [])).map(function (x) { return str(x, max); }).filter(Boolean).slice(0, n); }
  var SANITIZE = {
    berita: function (x) {
      return {
        judul: str(x.judul, 200), kategori: ['Kegiatan', 'Pengumuman', 'Edukasi', 'Regulasi', 'Organisasi'].indexOf(x.kategori) !== -1 ? x.kategori : 'Kegiatan',
        tanggal: isIsoDate(x.tanggal) ? x.tanggal : todayIso(), ringkasan: str(x.ringkasan, 400),
        isi: (Array.isArray(x.isi) ? x.isi : String(x.isi || '').split(/\n{2,}|\r\n\r\n/)).map(function (p) { return str(p, 4000); }).filter(Boolean).slice(0, 60),
        gambar: /^assets\/img\/[\w\-./]+\.(webp|jpe?g|png)$/i.test(String(x.gambar || '')) || /^https:\/\//.test(String(x.gambar || '')) ? contentUrl(x.gambar) : '',
        penulis: str(x.penulis, 120), sorot: x.sorot === true, contoh: x.contoh === true
      };
    },
    pengumuman: function (x) {
      return { judul: str(x.judul, 200), isi: str(x.isi, 2000), tanggal: isIsoDate(x.tanggal) ? x.tanggal : todayIso(), penting: x.penting === true, contoh: x.contoh === true };
    },
    agenda: function (x) {
      var mulai = isIsoDate(x.mulai) ? x.mulai : todayIso();
      var kuota = x.kuota === '' || x.kuota === null || x.kuota === undefined ? null : Math.max(1, Math.round(Number(x.kuota)) || 0) || null;
      return {
        judul: str(x.judul, 200), jenis: ['Pelatihan', 'Sertifikasi', 'Seminar', 'Webinar', 'Rapat', 'Kunjungan Teknis'].indexOf(x.jenis) !== -1 ? x.jenis : 'Seminar',
        mulai: mulai, selesai: isIsoDate(x.selesai) && x.selesai >= mulai ? x.selesai : mulai, waktu: str(x.waktu, 80), lokasi: str(x.lokasi, 200),
        mode: ['Luring', 'Daring', 'Hybrid'].indexOf(x.mode) !== -1 ? x.mode : 'Luring', kuota: kuota, deskripsi: str(x.deskripsi, 3000),
        tautanDaftar: httpsUrl(x.tautanDaftar), contoh: x.contoh === true
      };
    },
    pustaka: function (x) {
      return {
        judul: str(x.judul, 200), kategori: PUSTAKA_KATEGORI.indexOf(x.kategori) !== -1 ? x.kategori : 'Petunjuk Teknis',
        kode: str(x.kode, 40), versi: str(x.versi, 40), tanggal: isIsoDate(x.tanggal) ? x.tanggal : '',
        status: PUSTAKA_STATUS.indexOf(x.status) !== -1 ? x.status : 'Dalam Penyusunan', ringkasan: str(x.ringkasan, 1200),
        penyusun: str(x.penyusun, 160), format: str(x.format, 40), halaman: str(x.halaman, 40),
        akses: x.akses === 'publik' ? 'publik' : 'anggota', tautan: contentUrl(x.tautan), tag: arrStr(x.tag, 12, 40),
        app: str(x.app, 40), contoh: x.contoh === true
      };
    },
    regulasi: function (x) {
      var th = Math.round(Number(x.tahun));
      return {
        jenis: REG_JENIS.indexOf(x.jenis) !== -1 ? x.jenis : 'Peraturan Menteri', nomor: str(x.nomor, 80),
        tahun: isFinite(th) && th >= 1900 && th <= 2100 ? th : new Date().getFullYear(), judul: str(x.judul, 400), singkatan: str(x.singkatan, 80),
        instansi: str(x.instansi, 160), status: ['Berlaku', 'Berlaku (diubah)', 'Dicabut'].indexOf(x.status) !== -1 ? x.status : 'Berlaku',
        relevansi: str(x.relevansi, 600), tautan: /^https?:\/\//.test(String(x.tautan || '')) ? contentUrl(x.tautan) : '', kunci: x.kunci === true,
        sumber: arrStr(x.sumber, 6, 400).filter(function (u) { return /^https?:\/\//.test(u); })
      };
    }
  };
  function required(type, it) {
    var need = { berita: ['judul', 'ringkasan'], pengumuman: ['judul', 'isi'], agenda: ['judul', 'lokasi'], pustaka: ['judul', 'ringkasan'], regulasi: ['judul', 'nomor', 'singkatan', 'instansi'] }[type];
    var miss = need.filter(function (k) { return !it[k]; });
    if (miss.length) throw storeError('store/content-incomplete', 'Lengkapi isian: ' + miss.join(', ') + '.');
  }
  async function writeManaged(type, item) {
    if (mode() === 'local') {
      var list = lsArr(K_CONTENT + type).filter(function (x) { return x && x.id !== item.id; });
      list.push(item);
      lsSet(K_CONTENT + type, list);
      return;
    }
    var f = await fx();
    try { await f.db.collection('content_' + type).doc(item.id).set(item); }
    catch (e) { throw mapFirestoreError(e); }
    contentCache[type] = null;
  }
  async function deleteManaged(type, id) {
    if (mode() === 'local') {
      lsSet(K_CONTENT + type, lsArr(K_CONTENT + type).filter(function (x) { return x && x.id !== id; }));
      return;
    }
    var f = await fx();
    try { await f.db.collection('content_' + type).doc(id).delete(); }
    catch (e) { throw mapFirestoreError(e); }
    contentCache[type] = null;
  }
  async function writeFile(id, url, adm) {
    if (mode() === 'local') {
      var map = lsMap(K_FILES);
      if (url) map[id] = url; else delete map[id];
      lsSet(K_FILES, map);
      return;
    }
    var f = await fx();
    try {
      var ref = f.db.collection('pustaka_files').doc(id);
      if (url) await ref.set({ url: url, updatedAt: nowIso(), updatedBy: adm.uid });
      else await ref.delete();
    } catch (e) { throw mapFirestoreError(e); }
  }
  /** save(type, item) — create or update (an id equal to a static item = override). Admin only. */
  async function contentSave(type, item) {
    checkType(type);
    var adm = await requireAdmin();
    item = item || {};
    var clean = SANITIZE[type](item);
    required(type, clean);
    var id = str(item.id, 80);
    if (id && !/^[a-z0-9][a-z0-9\-]*$/.test(id)) throw storeError('store/invalid-id', 'ID konten hanya boleh berisi huruf kecil, angka, dan tanda hubung.');
    if (!id) {
      var existing = (await contentList(type, { includeHidden: true })).map(function (x) { return x.id; });
      var base = slugId(clean.judul || clean.singkatan || type), cand = base, k = 2;
      while (existing.indexOf(cand) !== -1) cand = base + '-' + (k++);
      id = cand;
    }
    var doc = Object.assign({ id: id }, clean, { updatedAt: nowIso(), updatedBy: adm.uid });
    /* member-only knowledge files: the link never goes into the public content document */
    if (type === 'pustaka') {
      var isApp = clean.kategori === 'Aplikasi' && /^aplikasi\//.test(clean.tautan);
      if (clean.akses === 'anggota' && clean.tautan && !isApp) {
        await writeFile(id, clean.tautan, adm);
        doc.tautan = '';
        doc.berkasAnggota = true;
      } else if (item.hapusBerkas === true) {
        await writeFile(id, '', adm);
        doc.berkasAnggota = false;
      } else {
        var prev = await contentGet(type, id);
        if (prev && prev.berkasAnggota && clean.akses === 'anggota') doc.berkasAnggota = true;
      }
    }
    await writeManaged(type, doc);
    await writeAudit(auditEntry(adm, 'konten.disimpan', 'konten:' + type, id, doc.judul || doc.singkatan || id, ''));
    return contentGet(type, id);
  }
  /** remove(type, id) — a static item is hidden (override {hidden:true}); a managed-only item is deleted. */
  async function contentRemove(type, id) {
    checkType(type);
    var adm = await requireAdmin();
    var isStatic = staticContent(type).some(function (x) { return x && x.id === id; });
    var cur = await contentGet(type, id);
    if (!cur) throw storeError('store/not-found', 'Konten tidak ditemukan.');
    if (isStatic) await writeManaged(type, { id: id, hidden: true, updatedAt: nowIso(), updatedBy: adm.uid });
    else {
      await deleteManaged(type, id);
      if (type === 'pustaka') { try { await writeFile(id, '', adm); } catch (e) { /* ignore */ } }
    }
    await writeAudit(auditEntry(adm, 'konten.dihapus', 'konten:' + type, id, cur.judul || cur.singkatan || id, isStatic ? 'Disembunyikan (konten bawaan)' : 'Dihapus'));
    return true;
  }
  /** restore(type, id) — drop the admin override of a static item (shows the original again). */
  async function contentRestore(type, id) {
    checkType(type);
    var adm = await requireAdmin();
    if (!staticContent(type).some(function (x) { return x && x.id === id; })) throw storeError('store/not-found', 'Hanya konten bawaan yang dapat dipulihkan.');
    await deleteManaged(type, id);
    await writeAudit(auditEntry(adm, 'konten.dipulihkan', 'konten:' + type, id, id, ''));
    return contentGet(type, id);
  }

  /* ======================================================================
     REGISTRY — public verification lookup
     ====================================================================== */
  var registryCache = null;
  function publicEntry(x) {
    if (!x || !x.kta) return null;
    var e = { kta: x.kta, nama: x.nama || '', kategori: x.kategori || '', kompetensi: Array.isArray(x.kompetensi) ? x.kompetensi : [], kota: x.kota || '', berlakuHingga: x.berlakuHingga || '', status: x.status || '' };
    if (x.contoh) e.contoh = true;
    return e;
  }
  async function registryEntries(exactKta) {
    var statics = staticRegistry().filter(function (r) { return mode() === 'local' || !r.contoh; });
    var dyn = [];
    if (mode() === 'local') {
      var reg = lsMap(K_REGISTRY);
      dyn = Object.keys(reg).map(function (k) { return reg[k]; });
    } else {
      var f = await fx();
      try {
        if (exactKta) {
          var s = await f.db.collection('registry').doc(exactKta).get();
          dyn = s.exists ? [s.data()] : [];
        } else {
          if (!registryCache) {
            var snap = await f.db.collection('registry').limit(5000).get();
            registryCache = [];
            snap.forEach(function (doc) { registryCache.push(Object.assign({ kta: doc.id }, doc.data())); });
          }
          dyn = registryCache;
        }
      } catch (e) { throw mapFirestoreError(e); }
    }
    var map = {}, order = [];
    statics.concat(dyn).forEach(function (x) {
      var e = publicEntry(x);
      if (!e) return;
      var k = alnum(e.kta);
      if (!map[k]) order.push(k);
      map[k] = e;
    });
    return order.map(function (k) { return map[k]; });
  }
  /** lookup(query) → { exact: Entry|null, matches: Entry[], kind: 'kta'|'kta-awal'|'nama'|'kosong', query } */
  async function registryLookup(query) {
    var q = String(query || '').replace(/\s+/g, ' ').trim();
    var a = alnum(q);
    var res = { exact: null, matches: [], kind: 'kosong', query: q };
    if (!q) return res;
    var list;
    if (/^PPAPI/.test(a)) {
      var digits = a.slice(5);
      if (digits.length >= 10) {
        var pretty = /^PPAPI(\d{4})(\d{6})$/.exec(a);
        list = await registryEntries(pretty ? 'PPAPI-' + pretty[1] + '-' + pretty[2] : null);
        res.kind = 'kta';
        res.exact = list.filter(function (r) { return alnum(r.kta) === a; })[0] || null;
        res.matches = res.exact ? [res.exact] : [];
        return res;
      }
      res.kind = 'kta-awal';
      if (digits.length < 4) return res;
      list = await registryEntries();
      res.matches = list.filter(function (r) { return alnum(r.kta).indexOf(a) === 0; }).slice(0, 20);
      return res;
    }
    if (/^[\d\s.\-\/]+$/.test(q)) {
      res.kind = 'kta-awal';
      if (a.length < 4) return res;
      list = await registryEntries();
      res.matches = list.filter(function (r) { return alnum(r.kta).indexOf(a) !== -1; }).slice(0, 20);
      return res;
    }
    res.kind = 'nama';
    var fq = fold(q);
    if (fq.replace(/[^a-z]/g, '').length < 3) return res;
    list = await registryEntries();
    res.matches = list.filter(function (r) { return fold(r.nama).indexOf(fq) !== -1; })
      .sort(function (x, y) { return fold(x.nama).indexOf(fq) - fold(y.nama).indexOf(fq) || String(x.nama).localeCompare(String(y.nama), 'id'); })
      .slice(0, 20);
    return res;
  }

  /* ======================================================================
     KNOWLEDGE FILES — member-only links (Firestore pustaka_files/{id})
     ====================================================================== */
  async function sessionActive() {
    var u = me();
    if (!u) return false;
    var s = null;
    if (PPAPI.session && typeof PPAPI.session.ready === 'function') {
      try {
        s = await PPAPI.session.ready();
        if (!s || !s.user || s.user.uid !== u.uid) s = await PPAPI.session.refresh();   /* stale (account switch) */
      } catch (e) { s = null; }
    }
    if (s && s.user && s.user.uid === u.uid) return !!s.isActive;
    var m = await getMember(u.uid);
    var adm = PPAPI.auth && PPAPI.auth.isAdmin ? await PPAPI.auth.isAdmin() : false;
    return adm || (U().isActiveMember ? U().isActiveMember(m) : !!(m && m.status === 'Aktif'));
  }
  /** fileUrl(item) → Promise<string|''> — active members & admins only (store/forbidden otherwise). */
  async function fileUrl(item) {
    if (!item || !item.id) return '';
    if (!(await sessionActive())) throw storeError('store/forbidden', 'Dokumen ini khusus anggota berstatus Aktif.');
    var fallback = contentUrl(txt(item.tautan));
    if (mode() === 'local') {
      var map = lsMap(K_FILES);
      return contentUrl(own(map, item.id) ? txt(map[item.id]) : '') || fallback;
    }
    if (item.akses === 'publik' && fallback) return fallback;
    var f = await fx();
    try {
      var s = await f.db.collection('pustaka_files').doc(item.id).get();
      var url = s.exists ? contentUrl(txt((s.data() || {}).url)) : '';
      return url || fallback;
    } catch (e) { throw mapFirestoreError(e); }
  }

  PPAPI.store = {
    __real: true,
    version: 2,
    get mode() { return mode(); },
    MEMBER_TYPES: MEMBER_TYPES.slice(),
    get APPLY_TYPES() { return applyTypes(); },
    STATUSES: STATUSES.slice(),
    LEVELS: LEVELS.slice(),
    DOC_TYPES: DOC_TYPES.slice(),
    FEEDBACK_KATEGORI: FEEDBACK_KATEGORI.slice(),
    FEEDBACK_STATUS: FEEDBACK_STATUS.slice(),
    PROTECTED_FIELDS: PROTECTED.slice(),
    CONTENT_TYPES: CONTENT_TYPES.slice(),
    PUSTAKA_KATEGORI: PUSTAKA_KATEGORI.slice(),
    PUSTAKA_STATUS: PUSTAKA_STATUS.slice(),
    HISTORY_ACTIONS: HISTORY_ACTIONS.slice(),
    AUDIT_LABELS: Object.assign({}, AUDIT_LABELS),
    LIMITS: Object.assign({}, LIMITS),
    getMember: getMember,
    saveMember: saveMember,
    ensureMember: ensureMember,
    saveApplication: saveApplication,
    submitApplication: submitApplication,
    withdrawApplication: withdrawApplication,
    applicationMissing: function (member) { return applicationMissing(member); },
    canEditApplication: function (member) { return canEditApplication(normalize(member)); },
    applicationType: function (member) { return applicationType(normalize(member)); },
    submitFeedback: submitFeedback,
    defaultMember: function (user) { return normalize(defaultMember(user || {})); },
    normalizeMember: normalize,
    admin: {
      listMembers: listMembers,
      getMember: adminGetMember,
      approve: approve,
      requestRevision: requestRevision,
      reject: reject,
      deactivate: deactivate,
      reactivate: reactivate,
      extend: extend,
      setMemberType: setMemberType,
      listFeedback: listFeedback,
      updateFeedback: updateFeedback,
      listAdmins: listAdmins,
      addAdmin: addAdmin,
      removeAdmin: removeAdmin,
      audit: audit,
      summary: summary,
      exportMembersCsv: exportMembersCsv
    },
    content: {
      list: contentList,
      get: contentGet,
      save: contentSave,
      remove: contentRemove,
      restore: contentRestore
    },
    registry: {
      lookup: registryLookup
    },
    pustaka: {
      fileUrl: fileUrl
    }
  };
})(window);
