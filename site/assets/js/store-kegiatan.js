/* ==========================================================================
   PPAPI — store-kegiatan.js  →  PPAPI.kegiatan
   Pengelolaan kegiatan (webinar, pelatihan, seminar, …) oleh sekretariat:
   pendaftaran peserta, daftar hadir otomatis, dan sertifikat PDF.

   Penyimpanan
   • Firebase (Firestore)
       events/{id}                         data kegiatan (publik bila status 'terbit')
       events/{id}/private/ruang           tautan ruang/meeting (admin + peserta terdaftar)
       events/{id}/participants/{uid}      pendaftaran peserta
       events/{id}/attendance/{uid}        daftar hadir (waktu server)
       events/{id}/assets/certificate      desain sertifikat (latar data URL ≤ 900 KB + tata letak)
       certificates/{nomor}                data terbatas untuk verifikasi publik (sertifikat.html)
     Aturan: firestore.rules, blok KEGIATAN (jendela daftar hadir diperiksa
     dengan request.time terhadap hadirBuka/hadirTutup yang tersimpan).
   • Mode Demo (localStorage)
       ppapi_events · ppapi_event_private · ppapi_event_participants_<id> ·
       ppapi_event_attendance_<id> · ppapi_event_design_<id> · ppapi_certificates

   Jendela daftar hadir: dibuka 30 menit sebelum jadwal selesai, ditutup 3 jam
   setelah jadwal selesai (WINDOW). Semua waktu kegiatan dalam WIB (UTC+7).
   Nomor sertifikat: PPAPI/SERT/<tahun>/<kode kegiatan>/<urut 4 digit>
   (ID dokumen memakai tanda hubung: PPAPI-SERT-2026-WEB1025-0001).
   ========================================================================== */
(function (w, d) {
  'use strict';

  var PPAPI = w.PPAPI = w.PPAPI || {};
  if (PPAPI.kegiatan && PPAPI.kegiatan.__real) return;

  var JENIS = ['Webinar', 'Pelatihan', 'Seminar', 'Sertifikasi', 'Lokakarya', 'Rapat', 'Kunjungan Teknis'];
  var KODE_JENIS = { Webinar: 'WEB', Pelatihan: 'PLT', Seminar: 'SEM', Sertifikasi: 'SRT', Lokakarya: 'LOK', Rapat: 'RPT', 'Kunjungan Teknis': 'KT' };
  var MODES = ['Daring', 'Luring', 'Hybrid'];
  var AKSES = { semua: 'Semua akun', aktif: 'Anggota Aktif' };
  var AKSES_DESC = {
    semua: 'Terbuka untuk semua akun yang sudah masuk, termasuk yang keanggotaannya belum diverifikasi.',
    aktif: 'Khusus anggota berstatus Aktif (sudah diverifikasi sekretariat).'
  };
  var STATUS = ['draf', 'terbit'];
  var WINDOW = { bukaMenit: 30, tutupJam: 3 };
  var LIMITS = { judul: 200, deskripsi: 4000, narasumber: 300, lokasi: 300, link: 500, nama: 120, catatan: 500, prefix: 60, designChars: 921600 };
  var WIB = 7 * 3600000;
  var MIN = 60000;
  var DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  /* jsPDF dari cdnjs dengan Subresource Integrity (hash sama dengan aplikasi perencanaan) */
  var JSPDF_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';
  var JSPDF_SRI = 'sha512-qZvrmS2ekKPF2mSznTQsxqPgnpkI4DNTlrdUmTzrDgektczlKNRRhy5X5AAOnx5S09ydFYWWNSfcEqDTTHgtNA==';

  var K_EVENTS = 'ppapi_events', K_PRIV = 'ppapi_event_private', K_PART = 'ppapi_event_participants_',
    K_ATT = 'ppapi_event_attendance_', K_DESIGN = 'ppapi_event_design_', K_CERTS = 'ppapi_certificates', K_AUDIT = 'ppapi_audit_log';

  var AUDIT_LABELS = {
    'kegiatan.disimpan': 'Menyimpan kegiatan',
    'kegiatan.dihapus': 'Menghapus kegiatan',
    'kegiatan.desain': 'Menyimpan desain sertifikat',
    'kegiatan.peserta-dihapus': 'Menghapus peserta kegiatan',
    'kegiatan.hadir-ditandai': 'Menandai kehadiran peserta',
    'sertifikat.dicabut': 'Mencabut sertifikat',
    'sertifikat.dipulihkan': 'Memulihkan sertifikat'
  };

  /* ------------------------------------------------------------ dasar */
  function U() { return PPAPI.util || {}; }
  function mode() { return PPAPI.auth && PPAPI.auth.mode === 'firebase' ? 'firebase' : 'local'; }
  function me() { return PPAPI.auth && PPAPI.auth.current ? PPAPI.auth.current() : null; }
  function session() {
    var s = PPAPI.session && PPAPI.session.current ? PPAPI.session.current() : null;
    if (s && s.user) return s;
    var u = me();
    return { user: u, member: null, isAdmin: false, isActive: false, isMemberActive: false, status: u ? 'Draf' : '' };
  }
  function kErr(code, message, cause) { var e = new Error(message); e.code = code; if (cause) e.cause = cause; return e; }
  function mapErr(err) {
    if (err && err.code && /^(kegiatan|store)\//.test(err.code)) return err;
    var code = err && err.code ? String(err.code).replace(/^firestore\//, '') : '';
    var msg = {
      'permission-denied': 'Akses ditolak. Muat ulang halaman, lalu coba lagi. Bila masih gagal, hubungi sekretariat.',
      'unauthenticated': 'Sesi Anda telah berakhir. Silakan masuk kembali.',
      'unavailable': 'Layanan data sedang tidak dapat dihubungi. Periksa koneksi internet Anda, lalu coba lagi.',
      'not-found': 'Data kegiatan tidak ditemukan.',
      'aborted': 'Data sedang diperbarui oleh pengguna lain. Silakan coba lagi.',
      'failed-precondition': 'Data sedang diperbarui oleh pengguna lain. Silakan coba lagi.',
      'resource-exhausted': 'Batas pemakaian layanan data sedang tercapai. Silakan coba lagi nanti.'
    }[code] || 'Permintaan belum dapat diproses. Silakan coba lagi.';
    return kErr('kegiatan/' + (code || 'unknown'), msg, err);
  }
  function forbidden() { return kErr('kegiatan/forbidden', 'Tindakan ini khusus admin PPAPI.'); }
  function str(v, max) { return String(v === undefined || v === null ? '' : v).trim().slice(0, max); }
  function int(v, min) { var n = Math.floor(Number(v)); return isFinite(n) ? Math.max(min || 0, n) : (min || 0); }
  function pad(n, len) { n = String(n); while (n.length < (len || 2)) n = '0' + n; return n; }
  function httpsUrl(v) { var s = str(v, LIMITS.link); return /^https:\/\/[^\s<>"']+$/i.test(s) ? s : ''; }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }

  function lsGet(key, fb) { try { var r = w.localStorage.getItem(key); return r === null ? fb : JSON.parse(r); } catch (e) { return fb; } }
  function lsSet(key, val) {
    try { w.localStorage.setItem(key, JSON.stringify(val)); }
    catch (e) { throw kErr('kegiatan/quota', 'Penyimpanan peramban penuh. Gunakan gambar desain yang lebih kecil atau hapus data situs.', e); }
  }
  function lsRemove(key) { try { w.localStorage.removeItem(key); } catch (e) { /* abaikan */ } }
  function lsMap(key) { var m = lsGet(key, {}); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; }

  async function fx() {
    var f = PPAPI.auth && PPAPI.auth._firebase ? await PPAPI.auth._firebase() : null;
    if (!f) throw kErr('kegiatan/unavailable', 'Layanan data belum siap. Muat ulang halaman, lalu coba lagi.');
    return f;
  }
  function serverTs(f) { return f.fb.firestore.FieldValue.serverTimestamp(); }
  function tsFrom(f, ms) { return f.fb.firestore.Timestamp.fromMillis(ms); }
  async function isAdmin() {
    if (!me()) return false;
    try { return PPAPI.auth && PPAPI.auth.isAdmin ? !!(await PPAPI.auth.isAdmin()) : false; } catch (e) { return false; }
  }
  async function requireAdmin() {
    var u = me();
    if (!u || !(await isAdmin())) throw forbidden();
    var s = session();
    return { uid: u.uid, name: (s.member && s.member.name) || u.name || u.email || 'Admin' };
  }

  /* ------------------------------------------------------------ waktu (WIB) */
  function msOf(v) {
    if (v === null || v === undefined || v === '') return NaN;
    if (typeof v === 'number') return v;
    if (v instanceof Date) return v.getTime();
    if (typeof v.toMillis === 'function') return v.toMillis();
    if (typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000 + Math.floor((Number(v.nanoseconds) || 0) / 1e6);
    var t = Date.parse(v);
    return isNaN(t) ? NaN : t;
  }
  function wib(ms) {
    var x = new Date(ms + WIB);
    return { y: x.getUTCFullYear(), m: x.getUTCMonth(), d: x.getUTCDate(), hh: x.getUTCHours(), mm: x.getUTCMinutes(), wd: x.getUTCDay() };
  }
  /** 'YYYY-MM-DD' + 'HH:MM' (WIB) → milidetik (UTC) */
  function fromWib(date, time) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date || ''));
    var t = /^(\d{1,2})[:.](\d{2})$/.exec(String(time || '00:00'));
    if (!m || !t) return NaN;
    var ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +t[1], +t[2]) - WIB;
    var back = wib(ms);
    return back.y === +m[1] && back.m === +m[2] - 1 && back.d === +m[3] ? ms : NaN;
  }
  function dateIso(ms) { var p = wib(ms); return p.y + '-' + pad(p.m + 1) + '-' + pad(p.d); }
  function timeHm(ms) { var p = wib(ms); return pad(p.hh) + ':' + pad(p.mm); }
  function fmtTime(ms) { var p = wib(ms); return pad(p.hh) + '.' + pad(p.mm); }
  function fmtDate(ms, o) {
    o = o || {};
    if (!isFinite(ms)) return '';
    var p = wib(ms);
    var s = p.d + ' ' + (o.short ? MONTHS_SHORT[p.m] : MONTHS[p.m]) + (o.noYear ? '' : ' ' + p.y);
    return (o.weekday ? DAYS[p.wd] + ', ' : '') + s;
  }
  function fmtDateTime(ms, o) { return isFinite(ms) ? fmtDate(ms, o) + ' pukul ' + fmtTime(ms) + ' WIB' : ''; }
  /** "Sabtu, 25 Oktober 2026 · 09.00–12.00 WIB" atau rentang beberapa hari */
  function fmtSchedule(ev, o) {
    o = o || {};
    if (!ev || !isFinite(ev.mulai)) return '';
    if (dateIso(ev.mulai) === dateIso(ev.selesai)) return fmtDate(ev.mulai, { weekday: o.weekday !== false, short: o.short }) + ' · ' + fmtTime(ev.mulai) + '–' + fmtTime(ev.selesai) + ' WIB';
    return fmtDate(ev.mulai, { short: true }) + ' ' + fmtTime(ev.mulai) + ' – ' + fmtDate(ev.selesai, { short: true }) + ' ' + fmtTime(ev.selesai) + ' WIB';
  }
  /** label tanggal pada sertifikat: "25 Oktober 2026" atau "24–25 Oktober 2026" */
  function dateLabel(ev) {
    var a = wib(ev.mulai), b = wib(ev.selesai);
    if (dateIso(ev.mulai) === dateIso(ev.selesai)) return fmtDate(ev.mulai);
    if (a.y === b.y && a.m === b.m) return a.d + '–' + b.d + ' ' + MONTHS[a.m] + ' ' + a.y;
    if (a.y === b.y) return a.d + ' ' + MONTHS[a.m] + ' – ' + b.d + ' ' + MONTHS[b.m] + ' ' + a.y;
    return fmtDate(ev.mulai) + ' – ' + fmtDate(ev.selesai);
  }
  /** sisa waktu → "2 hari 03:14:05" / "01:14:05" / "00:04:59" */
  function fmtCountdown(ms) {
    ms = Math.max(0, ms);
    var s = Math.floor(ms / 1000), dd = Math.floor(s / 86400), hh = Math.floor(s % 86400 / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
    return (dd ? dd + ' hari ' : '') + pad(hh) + ':' + pad(mm) + ':' + pad(ss);
  }
  /** sisa waktu dalam kata: "2 hari 3 jam", "1 jam 14 menit", "5 menit", "kurang dari 1 menit" */
  function fmtDuration(ms) {
    ms = Math.max(0, ms);
    var m = Math.floor(ms / MIN), dd = Math.floor(m / 1440), hh = Math.floor(m % 1440 / 60), mi = m % 60;
    if (dd) return dd + ' hari' + (hh ? ' ' + hh + ' jam' : '');
    if (hh) return hh + ' jam' + (mi ? ' ' + mi + ' menit' : '');
    return mi ? mi + ' menit' : 'kurang dari 1 menit';
  }

  function windowOf(ev, now) {
    now = typeof now === 'number' ? now : Date.now();
    var buka = isFinite(ev.hadirBuka) ? ev.hadirBuka : ev.selesai - WINDOW.bukaMenit * MIN;
    var tutup = isFinite(ev.hadirTutup) ? ev.hadirTutup : ev.selesai + WINDOW.tutupJam * 3600000;
    return { buka: buka, tutup: tutup, state: now < buka ? 'belum' : now <= tutup ? 'buka' : 'tutup', msToOpen: buka - now, msToClose: tutup - now, now: now };
  }
  function phaseOf(ev, now) {
    now = typeof now === 'number' ? now : Date.now();
    return now < ev.mulai ? 'akan-datang' : now <= ev.selesai ? 'berlangsung' : 'selesai';
  }
  var PHASE_LABEL = { 'akan-datang': 'Akan datang', berlangsung: 'Sedang berlangsung', selesai: 'Telah berlangsung' };

  /* ------------------------------------------------------------ bentuk data */
  function defaultKode(jenis, mulaiMs) {
    var p = isFinite(mulaiMs) ? wib(mulaiMs) : null;
    return (KODE_JENIS[jenis] || 'KEG') + (p ? pad(p.m + 1) + pad(p.d) : '');
  }
  function normEvent(raw, id) {
    if (!raw) return null;
    var mulai = msOf(raw.mulaiAt !== undefined ? raw.mulaiAt : raw.mulai);
    var selesai = msOf(raw.selesaiAt !== undefined ? raw.selesaiAt : raw.selesai);
    if (!isFinite(mulai) || !isFinite(selesai)) return null;
    var ev = {
      id: String(id || raw.id || ''),
      judul: str(raw.judul, LIMITS.judul),
      jenis: str(raw.jenis, 40) || 'Webinar',
      deskripsi: str(raw.deskripsi, LIMITS.deskripsi),
      narasumber: str(raw.narasumber, LIMITS.narasumber),
      mulai: mulai, selesai: selesai,
      mode: MODES.indexOf(raw.mode) !== -1 ? raw.mode : 'Daring',
      lokasi: str(raw.lokasi, LIMITS.lokasi),
      tautanDaftar: httpsUrl(raw.tautanDaftar),
      kuota: int(raw.kuota), terdaftar: int(raw.terdaftar),
      akses: raw.akses === 'aktif' ? 'aktif' : 'semua',
      sertifikat: raw.sertifikat !== false,
      kode: /^[A-Z0-9]{2,12}$/.test(raw.kode || '') ? raw.kode : defaultKode(raw.jenis, mulai),
      tahun: int(raw.tahun) || wib(selesai).y,
      sertSeq: int(raw.sertSeq),
      status: raw.status === 'terbit' ? 'terbit' : 'draf',
      hadirBuka: msOf(raw.hadirBuka), hadirTutup: msOf(raw.hadirTutup),
      createdAt: msOf(raw.createdAt), updatedAt: msOf(raw.updatedAt)
    };
    if (!isFinite(ev.hadirBuka)) ev.hadirBuka = selesai - WINDOW.bukaMenit * MIN;
    if (!isFinite(ev.hadirTutup)) ev.hadirTutup = selesai + WINDOW.tutupJam * 3600000;
    ev.mulaiIso = new Date(mulai).toISOString();
    ev.selesaiIso = new Date(selesai).toISOString();
    ev.tanggal = dateIso(mulai);
    ev.sisa = ev.kuota > 0 ? Math.max(0, ev.kuota - ev.terdaftar) : null;
    return ev;
  }
  function normParticipant(raw, uid) {
    if (!raw) return null;
    return { uid: String(uid || raw.uid || ''), nama: str(raw.nama, LIMITS.nama), email: str(raw.email, 200), kta: str(raw.kta, 24), statusAnggota: str(raw.statusAnggota, 40), at: msOf(raw.at) };
  }
  function normAttendance(raw, uid) {
    if (!raw) return null;
    return { uid: String(uid || raw.uid || ''), nama: str(raw.nama, LIMITS.nama), at: msOf(raw.at), sertNo: str(raw.sertNo, 60), olehAdmin: !!raw.olehAdmin };
  }
  function certDisplay(docId) { return String(docId || '').replace(/-/g, '/'); }
  function certDocId(no) {
    var s = String(no || '').trim().toUpperCase().replace(/\s+/g, '').replace(/[\\/]+/g, '-');
    return /^PPAPI-SERT-\d{4}-[A-Z0-9]{2,12}-\d{4,6}$/.test(s) ? s : '';
  }
  function certNumber(ev, seq) { return 'PPAPI-SERT-' + ev.tahun + '-' + ev.kode + '-' + pad(seq, 4); }

  /** Sanitasi isian formulir admin → objek kegiatan (melempar kegiatan/invalid dengan .fields) */
  function sanitizeInput(input, existing) {
    input = input || {};
    var errs = [];
    var judul = str(input.judul, LIMITS.judul);
    if (judul.length < 3) errs.push({ key: 'judul', label: 'Judul kegiatan (minimal 3 karakter)' });
    var jenis = str(input.jenis, 40) || 'Webinar';
    var mulai = typeof input.mulai === 'number' ? input.mulai : fromWib(input.mulaiTanggal, input.mulaiJam);
    var selesai = typeof input.selesai === 'number' ? input.selesai : fromWib(input.selesaiTanggal || input.mulaiTanggal, input.selesaiJam);
    if (!isFinite(mulai)) errs.push({ key: 'mulai', label: 'Tanggal dan jam mulai' });
    if (!isFinite(selesai)) errs.push({ key: 'selesai', label: 'Tanggal dan jam selesai' });
    else if (isFinite(mulai) && selesai <= mulai) errs.push({ key: 'selesai', label: 'Jam selesai harus setelah jam mulai' });
    var rawLink = str(input.tautanDaftar, LIMITS.link);
    var tautan = httpsUrl(rawLink);
    if (rawLink && !tautan) errs.push({ key: 'tautanDaftar', label: 'Tautan pendaftaran harus diawali https://' });
    var rawRuang = str(input.linkRuang, LIMITS.link);
    var ruang = httpsUrl(rawRuang);
    if (rawRuang && !ruang) errs.push({ key: 'linkRuang', label: 'Tautan ruang daring harus diawali https://' });
    var kode = str(input.kode, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!kode) kode = defaultKode(jenis, mulai);
    if (!/^[A-Z0-9]{2,12}$/.test(kode)) errs.push({ key: 'kode', label: 'Kode kegiatan (2–12 huruf kapital/angka)' });
    var kuota = int(input.kuota);
    if (existing && kuota > 0 && kuota < existing.terdaftar) errs.push({ key: 'kuota', label: 'Kuota tidak boleh kurang dari jumlah peserta terdaftar (' + existing.terdaftar + ')' });
    if (errs.length) {
      var e = kErr('kegiatan/invalid', 'Periksa kembali: ' + errs.map(function (x) { return x.label; }).join('; ') + '.');
      e.fields = errs;
      throw e;
    }
    return {
      judul: judul, jenis: jenis,
      deskripsi: str(input.deskripsi, LIMITS.deskripsi), narasumber: str(input.narasumber, LIMITS.narasumber),
      mulai: mulai, selesai: selesai,
      mode: MODES.indexOf(input.mode) !== -1 ? input.mode : 'Daring',
      lokasi: str(input.lokasi, LIMITS.lokasi), tautanDaftar: tautan, linkRuang: ruang,
      catatanRuang: str(input.catatanRuang, LIMITS.catatan),
      kuota: kuota, akses: input.akses === 'aktif' ? 'aktif' : 'semua',
      sertifikat: input.sertifikat !== false, kode: kode, tahun: wib(selesai).y,
      status: input.status === 'terbit' ? 'terbit' : 'draf'
    };
  }
  function slugId(judul, mulai) {
    var base = (U().slugify ? U().slugify(judul) : String(judul).toLowerCase().replace(/[^a-z0-9]+/g, '-')).slice(0, 48).replace(/-+$/, '') || 'kegiatan';
    var p = wib(mulai);
    return 'kg-' + base + '-' + p.y + pad(p.m + 1) + pad(p.d);
  }

  /* ------------------------------------------------------------ audit */
  async function audit(adm, action, id, name, note) {
    var entry = {
      at: new Date().toISOString(), by: adm.uid, byName: str(adm.name, 120), action: action, label: AUDIT_LABELS[action] || action,
      targetType: action.indexOf('sertifikat') === 0 ? 'sertifikat' : 'kegiatan', targetId: str(id, 200), targetName: str(name, 200), note: str(note, 2000)
    };
    try {
      if (mode() === 'local') {
        var list = lsGet(K_AUDIT, []);
        if (!Array.isArray(list)) list = [];
        list.push(Object.assign({ id: 'log-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) }, entry));
        lsSet(K_AUDIT, list.slice(-500));
      } else {
        var f = await fx();
        await f.db.collection('audit_log').add(entry);
      }
    } catch (e) { console.warn('[PPAPI] Log aktivitas kegiatan tidak tersimpan:', e && e.message); }
  }

  /* ======================================================================
     BACA — publik
     ====================================================================== */
  var listCache = null;   /* {at, list} — kegiatan terbit, 20 detik */
  async function listPublished(o) {
    o = o || {};
    if (!o.fresh && listCache && Date.now() - listCache.at < 20000) return listCache.list.map(clone);
    var list;
    if (mode() === 'local') {
      var map = lsMap(K_EVENTS);
      list = Object.keys(map).map(function (id) { return normEvent(map[id], id); });
    } else {
      var f = await fx();
      try {
        var snap = await f.db.collection('events').where('status', '==', 'terbit').get();
        list = snap.docs.map(function (s) { return normEvent(s.data(), s.id); });
      } catch (e) {
        /* Kegiatan terbit boleh dibaca siapa pun; penolakan di sini berarti aturan Firestore kegiatan
           belum diterbitkan di Firebase Console → anggap belum ada kegiatan (Beranda/Agenda tetap tampil). */
        if (e && /permission-denied/.test(String(e.code || ''))) {
          console.info('[PPAPI] Kegiatan belum tersedia: aturan Firestore untuk koleksi events belum diterbitkan.');
          list = [];
        } else throw mapErr(e);
      }
    }
    list = list.filter(function (ev) { return ev && ev.status === 'terbit'; }).sort(function (a, b) { return a.mulai - b.mulai; });
    listCache = { at: Date.now(), list: list };
    return list.map(clone);
  }
  async function get(id) {
    id = String(id || '');
    if (!id) return null;
    if (mode() === 'local') {
      var raw = lsMap(K_EVENTS)[id];
      var ev = normEvent(raw, id);
      if (!ev) return null;
      if (ev.status !== 'terbit' && !(await isAdmin())) return null;
      return ev;
    }
    var f = await fx();
    try {
      var s = await f.db.collection('events').doc(id).get();
      return s.exists ? normEvent(s.data(), s.id) : null;
    } catch (e) {
      if (e && /permission-denied/.test(e.code || '')) return null;
      throw mapErr(e);
    }
  }
  /** kegiatan terbit dalam bentuk agenda (SPEC v1 §2.4) — untuk agenda/beranda/dasbor */
  function toAgendaItem(ev) {
    var same = dateIso(ev.mulai) === dateIso(ev.selesai);
    return {
      id: ev.id, judul: ev.judul, jenis: ev.jenis, mulai: dateIso(ev.mulai), selesai: dateIso(ev.selesai),
      waktu: same ? fmtTime(ev.mulai) + ' – ' + fmtTime(ev.selesai) + ' WIB' : fmtTime(ev.mulai) + ' WIB',
      lokasi: ev.lokasi || (ev.mode === 'Daring' ? 'Daring' : ''), mode: ev.mode, kuota: ev.kuota || '',
      deskripsi: ev.deskripsi, tautanDaftar: ev.tautanDaftar, contoh: false, kegiatan: true, akses: ev.akses
    };
  }
  async function asAgendaItems() {
    try { return (await listPublished()).map(toAgendaItem); } catch (e) { console.warn('[PPAPI] Kegiatan tidak dapat dimuat:', e && e.message); return []; }
  }

  /* ======================================================================
     PESERTA (akun yang sedang masuk)
     ====================================================================== */
  function eligibility(ev, s, now) {
    s = s || session();
    now = typeof now === 'number' ? now : Date.now();
    if (!ev) return { ok: false, code: 'tidak-ada', text: 'Kegiatan tidak ditemukan.' };
    if (!s.user) return { ok: false, code: 'masuk', text: 'Masuk dengan akun PPAPI untuk mendaftar kegiatan ini.' };
    if (ev.status !== 'terbit') return { ok: false, code: 'draf', text: 'Kegiatan ini belum diterbitkan.' };
    if (ev.akses === 'aktif' && !(s.isMemberActive || s.isAdmin)) return { ok: false, code: 'aktif', text: 'Kegiatan ini khusus anggota berstatus Aktif. Pendaftaran terbuka setelah keanggotaan Anda diverifikasi sekretariat.' };
    if (now > ev.selesai) return { ok: false, code: 'selesai', text: 'Kegiatan telah berakhir; pendaftaran sudah ditutup.' };
    if (ev.kuota > 0 && ev.terdaftar >= ev.kuota) return { ok: false, code: 'penuh', text: 'Kuota peserta sudah penuh.' };
    return { ok: true, code: 'ok', text: '' };
  }
  function eligErr(el) {
    var codes = { masuk: 'kegiatan/unauthenticated', aktif: 'kegiatan/khusus-aktif', selesai: 'kegiatan/ditutup', penuh: 'kegiatan/penuh', draf: 'kegiatan/not-found', 'tidak-ada': 'kegiatan/not-found' };
    return kErr(codes[el.code] || 'kegiatan/ditolak', el.text);
  }
  function myName() {
    var s = session();
    return str((s.member && s.member.name) || (s.user && (s.user.name || s.user.email)) || '', LIMITS.nama);
  }
  async function myRegistration(id) {
    var u = me();
    if (!u || !id) return null;
    if (mode() === 'local') return normParticipant(lsMap(K_PART + id)[u.uid], u.uid);
    var f = await fx();
    try {
      var s = await f.db.collection('events').doc(id).collection('participants').doc(u.uid).get();
      return s.exists ? normParticipant(s.data(), u.uid) : null;
    } catch (e) { if (e && /permission-denied/.test(e.code || '')) return null; throw mapErr(e); }
  }
  async function myAttendance(id) {
    var u = me();
    if (!u || !id) return null;
    if (mode() === 'local') return normAttendance(lsMap(K_ATT + id)[u.uid], u.uid);
    var f = await fx();
    try {
      var s = await f.db.collection('events').doc(id).collection('attendance').doc(u.uid).get();
      return s.exists ? normAttendance(s.data(), u.uid) : null;
    } catch (e) { if (e && /permission-denied/.test(e.code || '')) return null; throw mapErr(e); }
  }
  /** status lengkap satu kegiatan untuk akun ini: {event, participant, attendance, eligibility, window, phase} */
  async function myStatus(idOrEv) {
    var ev = typeof idOrEv === 'object' && idOrEv ? idOrEv : await get(idOrEv);
    if (!ev) return null;
    var res = await Promise.all([myRegistration(ev.id), myAttendance(ev.id)]);
    return { event: ev, participant: res[0], attendance: res[1], eligibility: eligibility(ev), window: windowOf(ev), phase: phaseOf(ev) };
  }

  async function register(id, o) {
    o = o || {};
    var u = me();
    if (!u) throw kErr('kegiatan/unauthenticated', 'Masuk dengan akun PPAPI untuk mendaftar kegiatan ini.');
    var s = session();
    var nama = str(o.nama, LIMITS.nama) || myName();
    if (nama.length < 3) throw kErr('kegiatan/nama', 'Tulis nama untuk sertifikat (minimal 3 karakter).');
    var data = {
      uid: u.uid, nama: nama, email: str(u.email, 200), kta: str(s.member && s.member.kta, 24),
      statusAnggota: str(s.isMemberActive ? 'Aktif' : (s.status || 'Draf'), 40)
    };
    if (mode() === 'local') {
      var ev = await get(id);
      var map = lsMap(K_PART + id);
      if (map[u.uid]) return normParticipant(map[u.uid], u.uid);
      var el = eligibility(ev, s);
      if (!el.ok) throw eligErr(el);
      data.at = new Date().toISOString();
      map[u.uid] = data;
      lsSet(K_PART + id, map);
      var all = lsMap(K_EVENTS);
      all[id].terdaftar = int(all[id].terdaftar) + 1;
      lsSet(K_EVENTS, all);
      listCache = null;
      return normParticipant(data, u.uid);
    }
    var f = await fx();
    var evRef = f.db.collection('events').doc(id), pRef = evRef.collection('participants').doc(u.uid);
    try {
      return await f.db.runTransaction(async function (tx) {
        var evSnap = await tx.get(evRef), pSnap = await tx.get(pRef);
        if (!evSnap.exists) throw kErr('kegiatan/not-found', 'Kegiatan tidak ditemukan.');
        if (pSnap.exists) return normParticipant(pSnap.data(), u.uid);
        var ev2 = normEvent(evSnap.data(), id);
        var el2 = eligibility(ev2, s);
        if (!el2.ok) throw eligErr(el2);
        tx.set(pRef, Object.assign({}, data, { at: serverTs(f) }));
        tx.update(evRef, { terdaftar: ev2.terdaftar + 1 });
        listCache = null;
        return normParticipant(Object.assign({}, data, { at: Date.now() }), u.uid);
      });
    } catch (e) { throw mapErr(e); }
  }
  async function updateName(id, nama) {
    var u = me();
    if (!u) throw kErr('kegiatan/unauthenticated', 'Sesi Anda telah berakhir. Silakan masuk kembali.');
    nama = str(nama, LIMITS.nama);
    if (nama.length < 3) throw kErr('kegiatan/nama', 'Nama minimal 3 karakter.');
    if (await myAttendance(id)) throw kErr('kegiatan/terkunci', 'Nama tidak dapat diubah setelah daftar hadir diisi.');
    if (mode() === 'local') {
      var map = lsMap(K_PART + id);
      if (!map[u.uid]) throw kErr('kegiatan/belum-terdaftar', 'Anda belum terdaftar pada kegiatan ini.');
      map[u.uid].nama = nama;
      lsSet(K_PART + id, map);
      return normParticipant(map[u.uid], u.uid);
    }
    var f = await fx();
    try { await f.db.collection('events').doc(id).collection('participants').doc(u.uid).update({ nama: nama }); }
    catch (e) { throw mapErr(e); }
    return myRegistration(id);
  }
  async function cancel(id) {
    var u = me();
    if (!u) throw kErr('kegiatan/unauthenticated', 'Sesi Anda telah berakhir. Silakan masuk kembali.');
    if (await myAttendance(id)) throw kErr('kegiatan/terkunci', 'Pendaftaran tidak dapat dibatalkan setelah daftar hadir diisi.');
    if (mode() === 'local') {
      var ev = await get(id);
      if (ev && Date.now() >= ev.mulai) throw kErr('kegiatan/ditutup', 'Pendaftaran tidak dapat dibatalkan setelah kegiatan dimulai.');
      var map = lsMap(K_PART + id);
      if (!map[u.uid]) return true;
      delete map[u.uid];
      lsSet(K_PART + id, map);
      var all = lsMap(K_EVENTS);
      if (all[id]) { all[id].terdaftar = Math.max(0, int(all[id].terdaftar) - 1); lsSet(K_EVENTS, all); }
      listCache = null;
      return true;
    }
    var f = await fx();
    var evRef = f.db.collection('events').doc(id), pRef = evRef.collection('participants').doc(u.uid);
    try {
      await f.db.runTransaction(async function (tx) {
        var evSnap = await tx.get(evRef), pSnap = await tx.get(pRef);
        if (!pSnap.exists || !evSnap.exists) return;
        var ev2 = normEvent(evSnap.data(), id);
        if (Date.now() >= ev2.mulai) throw kErr('kegiatan/ditutup', 'Pendaftaran tidak dapat dibatalkan setelah kegiatan dimulai.');
        tx.delete(pRef);
        tx.update(evRef, { terdaftar: Math.max(0, ev2.terdaftar - 1) });
      });
      listCache = null;
      return true;
    } catch (e) { throw mapErr(e); }
  }
  /** tautan ruang daring — hanya untuk peserta terdaftar & admin ('' bila tidak ada / tidak berhak) */
  async function meetingInfo(id) {
    var u = me();
    if (!u) return { link: '', catatan: '' };
    if (mode() === 'local') {
      if (!lsMap(K_PART + id)[u.uid] && !(await isAdmin())) return { link: '', catatan: '' };
      var p = lsMap(K_PRIV)[id] || {};
      return { link: httpsUrl(p.linkRuang), catatan: str(p.catatan, LIMITS.catatan) };
    }
    var f = await fx();
    try {
      var s = await f.db.collection('events').doc(id).collection('private').doc('ruang').get();
      var x = s.exists ? s.data() : {};
      return { link: httpsUrl(x.linkRuang), catatan: str(x.catatan, LIMITS.catatan) };
    } catch (e) { return { link: '', catatan: '' }; }
  }

  /** isi daftar hadir — hanya dalam jendela (selesai − 30 menit … selesai + 3 jam) */
  async function attend(id) {
    var u = me();
    if (!u) throw kErr('kegiatan/unauthenticated', 'Sesi Anda telah berakhir. Silakan masuk kembali.');
    var ev = await get(id);
    if (!ev) throw kErr('kegiatan/not-found', 'Kegiatan tidak ditemukan.');
    var p = await myRegistration(id);
    if (!p) throw kErr('kegiatan/belum-terdaftar', 'Daftar hadir hanya untuk peserta yang sudah mendaftar.');
    var existing = await myAttendance(id);
    if (existing) return existing;
    var win = windowOf(ev);
    if (win.state === 'belum') throw kErr('kegiatan/hadir-belum', 'Daftar hadir dibuka ' + fmtDateTime(win.buka, { weekday: true }) + '.');
    if (win.state === 'tutup') throw kErr('kegiatan/hadir-tutup', 'Daftar hadir sudah ditutup pada ' + fmtDateTime(win.tutup, { weekday: true }) + '.');
    var data = { uid: u.uid, nama: p.nama };
    if (mode() === 'local') {
      var map = lsMap(K_ATT + id);
      data.at = new Date().toISOString();
      map[u.uid] = data;
      lsSet(K_ATT + id, map);
      return normAttendance(data, u.uid);
    }
    var f = await fx();
    try {
      await f.db.collection('events').doc(id).collection('attendance').doc(u.uid).set(Object.assign({}, data, { at: serverTs(f) }));
    } catch (e) {
      if (e && /permission-denied/.test(e.code || '')) throw kErr('kegiatan/hadir-ditolak', 'Daftar hadir tidak dapat diisi saat ini. Pastikan jam perangkat Anda tepat dan daftar hadir masih dibuka.', e);
      throw mapErr(e);
    }
    return (await myAttendance(id)) || normAttendance(Object.assign(data, { at: Date.now() }), u.uid);
  }

  /** daftar kegiatan yang saya ikuti (terbit; diurutkan: berjalan/akan datang lebih dulu) */
  async function myEvents(o) {
    o = o || {};
    var u = me();
    if (!u) return [];
    var events = await listPublished({ fresh: o.fresh });
    var horizon = Date.now() - 400 * 86400000;
    events = events.filter(function (ev) { return ev.selesai >= horizon; });
    var rows = await Promise.all(events.map(async function (ev) {
      var p = await myRegistration(ev.id);
      if (!p) return null;
      return { event: ev, participant: p, attendance: await myAttendance(ev.id), window: windowOf(ev), phase: phaseOf(ev) };
    }));
    rows = rows.filter(Boolean);
    var now = Date.now();
    rows.sort(function (a, b) {
      var ea = a.event.hadirTutup < now, eb = b.event.hadirTutup < now;
      if (ea !== eb) return ea ? 1 : -1;
      return ea ? b.event.mulai - a.event.mulai : a.event.mulai - b.event.mulai;
    });
    return rows;
  }

  /* ======================================================================
     SERTIFIKAT
     ====================================================================== */
  var FIELD_KEYS = ['nama', 'judul', 'tanggal', 'nomor', 'qr'];
  var FIELD_LABEL = { nama: 'Nama peserta', judul: 'Judul kegiatan', tanggal: 'Tanggal', nomor: 'Nomor sertifikat', qr: 'QR verifikasi' };
  function defaultDesign() {
    return {
      bg: '', bgW: 0, bgH: 0, orient: 'landscape',
      fields: {
        nama: { on: true, x: 0.5, y: 0.47, size: 32, color: '#111113', align: 'center', font: 'serif', bold: true, w: 0.8, prefix: '' },
        judul: { on: true, x: 0.5, y: 0.625, size: 15, color: '#26262a', align: 'center', font: 'sans', bold: true, w: 0.72, prefix: '' },
        tanggal: { on: true, x: 0.5, y: 0.715, size: 11, color: '#3a3a3f', align: 'center', font: 'sans', bold: false, w: 0.6, prefix: '' },
        nomor: { on: true, x: 0.5, y: 0.27, size: 10, color: '#5c5c63', align: 'center', font: 'sans', bold: false, w: 0.6, prefix: 'Nomor: ' },
        qr: { on: true, x: 0.885, y: 0.8, size: 0.1 }
      }
    };
  }
  function cleanColor(c, fb) { return /^#[0-9a-f]{6}$/i.test(c || '') ? String(c).toLowerCase() : fb; }
  function clamp(n, a, b, fb) { n = Number(n); return isFinite(n) ? Math.min(b, Math.max(a, n)) : fb; }
  function normDesign(raw) {
    var def = defaultDesign();
    raw = raw || {};
    var bg = typeof raw.bg === 'string' && /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(raw.bg) && raw.bg.length <= LIMITS.designChars ? raw.bg : '';
    var out = { bg: bg, bgW: bg ? int(raw.bgW) : 0, bgH: bg ? int(raw.bgH) : 0, orient: raw.orient === 'portrait' ? 'portrait' : 'landscape', fields: {}, updatedAt: msOf(raw.updatedAt) };
    var rf = raw.fields || {};
    FIELD_KEYS.forEach(function (k) {
      var a = Object.assign({}, def.fields[k], rf[k] || {});
      if (k === 'qr') out.fields.qr = { on: a.on !== false, x: clamp(a.x, 0, 1, def.fields.qr.x), y: clamp(a.y, 0, 1, def.fields.qr.y), size: clamp(a.size, 0.05, 0.3, 0.1) };
      else out.fields[k] = {
        on: a.on !== false, x: clamp(a.x, 0, 1, def.fields[k].x), y: clamp(a.y, 0, 1, def.fields[k].y),
        size: clamp(a.size, 6, 72, def.fields[k].size), color: cleanColor(a.color, def.fields[k].color),
        align: ['left', 'center', 'right'].indexOf(a.align) !== -1 ? a.align : 'center',
        font: a.font === 'sans' ? 'sans' : 'serif', bold: !!a.bold, w: clamp(a.w, 0.1, 1, def.fields[k].w), prefix: String(a.prefix === undefined || a.prefix === null ? '' : a.prefix).replace(/[\r\n\t]+/g, ' ').replace(/^\s+/, '').slice(0, LIMITS.prefix)
      };
    });
    return out;
  }
  /** ukuran halaman (mm) */
  function pageSize(design) { return design.orient === 'portrait' ? { w: 210, h: 297 } : { w: 297, h: 210 }; }
  /** teks tiap kolom untuk satu peserta */
  function fieldTexts(ev, data, design) {
    var f = design.fields;
    return {
      nama: (f.nama.prefix || '') + (data.nama || ''),
      judul: (f.judul.prefix || '') + (ev.judul || ''),
      tanggal: (f.tanggal.prefix || '') + dateLabel(ev),
      nomor: (f.nomor.prefix || '') + certDisplay(data.no || '')
    };
  }
  /** teks tetap templat bawaan (dipakai bila belum ada desain unggahan) — posisi relatif halaman */
  var DEFAULT_STATIC = [
    { t: 'SERTIFIKAT', x: 0.5, y: 0.2, size: 30, font: 'serif', bold: true, color: '#111113', spacing: 3 },
    { t: 'diberikan kepada', x: 0.5, y: 0.385, size: 11, font: 'sans', bold: false, color: '#5c5c63' },
    { t: 'atas partisipasinya sebagai peserta dalam', x: 0.5, y: 0.555, size: 11, font: 'sans', bold: false, color: '#5c5c63' },
    { t: 'Perkumpulan Praktisi dan Ahli Perancah Indonesia', x: 0.5, y: 0.86, size: 10, font: 'serif', bold: true, color: '#26262a' }
  ];

  async function getDesign(id) {
    if (mode() === 'local') return normDesign(lsGet(K_DESIGN + id, null));
    var f = await fx();
    try {
      var s = await f.db.collection('events').doc(id).collection('assets').doc('certificate').get();
      return normDesign(s.exists ? s.data() : null);
    } catch (e) {
      if (e && /permission-denied/.test(e.code || '')) return normDesign(null);
      throw mapErr(e);
    }
  }

  /* ---- jsPDF (dimuat saat dibutuhkan, dengan SRI) ---- */
  var jspdfLoading = null;
  function ensureJsPDF() {
    if (w.jspdf && w.jspdf.jsPDF) return Promise.resolve(w.jspdf.jsPDF);
    if (jspdfLoading) return jspdfLoading;
    jspdfLoading = new Promise(function (res, rej) {
      var s = d.createElement('script');
      s.integrity = JSPDF_SRI; s.crossOrigin = 'anonymous'; s.referrerPolicy = 'no-referrer';
      s.src = JSPDF_SRC;
      s.onload = function () { (w.jspdf && w.jspdf.jsPDF) ? res(w.jspdf.jsPDF) : rej(kErr('kegiatan/pdf', 'Pustaka PDF tidak dapat dimuat.')); };
      s.onerror = function () { jspdfLoading = null; rej(kErr('kegiatan/pdf', 'Pustaka PDF tidak dapat dimuat. Periksa koneksi internet Anda, lalu coba lagi.')); };
      d.head.appendChild(s);
    });
    return jspdfLoading;
  }
  function hexRgb(hex) { var n = parseInt(String(hex).slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  var PT = 0.352778; /* mm per poin */

  /** Bangun dokumen PDF sertifikat. data: {nama, no (ID dokumen), verifyUrl} → jsPDF doc */
  async function buildPdf(ev, design, data) {
    var JsPDF = await ensureJsPDF();
    design = normDesign(design);
    var pg = pageSize(design), W = pg.w, H = pg.h;
    var doc = new JsPDF({ orientation: design.orient, unit: 'mm', format: 'a4', compress: false });
    doc.setProperties({ title: 'Sertifikat — ' + ev.judul, subject: 'Sertifikat kegiatan PPAPI ' + certDisplay(data.no || ''), author: 'PPAPI', creator: 'Situs PPAPI', keywords: certDisplay(data.no || '') });
    if (design.bg) {
      doc.addImage(design.bg, /^data:image\/png/.test(design.bg) ? 'PNG' : 'JPEG', 0, 0, W, H, undefined, 'FAST');
    } else {
      /* templat bawaan: bingkai ganda garis rambut + teks tetap */
      doc.setDrawColor(26, 26, 29); doc.setLineWidth(0.8); doc.rect(10, 10, W - 20, H - 20);
      doc.setDrawColor(139, 139, 146); doc.setLineWidth(0.25); doc.rect(14, 14, W - 28, H - 28);
      doc.setFillColor(26, 26, 29);
      [[14, 14], [W - 14, 14], [14, H - 14], [W - 14, H - 14]].forEach(function (c) { doc.rect(c[0] - 1.4, c[1] - 1.4, 2.8, 2.8, 'F'); });
      doc.setDrawColor(185, 185, 191); doc.setLineWidth(0.3); doc.line(W / 2 - 30, H * 0.235, W / 2 + 30, H * 0.235);
      DEFAULT_STATIC.forEach(function (s) {
        doc.setFont(s.font === 'serif' ? 'times' : 'helvetica', s.bold ? 'bold' : 'normal');
        doc.setFontSize(s.size);
        var c = hexRgb(s.color); doc.setTextColor(c[0], c[1], c[2]);
        /* jsPDF tidak menghitung charSpace saat meratakan tengah → geser setengah total spasi */
        var sp = s.spacing || 0;
        doc.text(s.t, s.x * W - sp * (s.t.length - 1) / 2, s.y * H, { align: 'center', baseline: 'middle', charSpace: sp });
      });
    }
    var texts = fieldTexts(ev, data, design);
    ['nama', 'judul', 'tanggal', 'nomor'].forEach(function (k) {
      var f = design.fields[k];
      if (!f.on || !texts[k]) return;
      doc.setFont(f.font === 'serif' ? 'times' : 'helvetica', f.bold ? 'bold' : 'normal');
      doc.setFontSize(f.size);
      var c = hexRgb(f.color); doc.setTextColor(c[0], c[1], c[2]);
      var lines = doc.splitTextToSize(texts[k], f.w * W);
      var lh = f.size * PT * 1.18, y0 = f.y * H - (lines.length - 1) * lh / 2;
      lines.forEach(function (ln, i) { doc.text(ln, f.x * W, y0 + i * lh, { align: f.align, baseline: 'middle' }); });
    });
    var q = design.fields.qr;
    if (q.on && data.verifyUrl) {
      var m = qrCode.encode(data.verifyUrl), n = m.size, quiet = 2;
      var size = q.size * W, cell = size / (n + quiet * 2), x0 = q.x * W - size / 2, y0q = q.y * H - size / 2;
      doc.setFillColor(255, 255, 255); doc.rect(x0, y0q, size, size, 'F');
      doc.setFillColor(17, 17, 19);
      for (var y = 0; y < n; y++) {
        for (var x = 0; x < n;) {
          if (!m.modules[y][x]) { x++; continue; }
          var s0 = x; while (x < n && m.modules[y][x]) x++;
          doc.rect(x0 + (quiet + s0) * cell, y0q + (quiet + y) * cell, (x - s0) * cell + 0.01, cell + 0.01, 'F');
        }
      }
    }
    return doc;
  }
  function verifyUrl(docId) {
    var path = 'sertifikat.html?no=' + encodeURIComponent(certDisplay(docId));
    return U().siteUrl ? U().siteUrl(path) : new URL(path, d.baseURI).href;
  }

  /** terbitkan nomor sertifikat (sekali per peserta); mengembalikan {no, display, ...} */
  async function issueCertificate(id) {
    var u = me();
    if (!u) throw kErr('kegiatan/unauthenticated', 'Sesi Anda telah berakhir. Silakan masuk kembali.');
    var ev = await get(id);
    if (!ev) throw kErr('kegiatan/not-found', 'Kegiatan tidak ditemukan.');
    if (!ev.sertifikat) throw kErr('kegiatan/tanpa-sertifikat', 'Kegiatan ini tidak menyediakan sertifikat.');
    var a = await myAttendance(id);
    if (!a) throw kErr('kegiatan/belum-hadir', 'Sertifikat tersedia setelah Anda mengisi daftar hadir.');
    if (a.sertNo) return { no: a.sertNo, display: certDisplay(a.sertNo), nama: a.nama, event: ev };
    if (mode() === 'local') {
      var all = lsMap(K_EVENTS), certs = lsMap(K_CERTS), att = lsMap(K_ATT + id);
      var seq = int(all[id].sertSeq) + 1, no = certNumber(ev, seq);
      while (certs[no]) { seq++; no = certNumber(ev, seq); }
      certs[no] = { eventId: id, judul: ev.judul, jenis: ev.jenis, tanggal: dateLabel(ev), nama: a.nama, tahun: ev.tahun, kode: ev.kode, seq: seq, terbit: new Date().toISOString(), status: 'Sah' };
      all[id].sertSeq = seq;
      att[u.uid].sertNo = no;
      lsSet(K_CERTS, certs); lsSet(K_EVENTS, all); lsSet(K_ATT + id, att);
      return { no: no, display: certDisplay(no), nama: a.nama, event: ev };
    }
    var f = await fx();
    var evRef = f.db.collection('events').doc(id), aRef = evRef.collection('attendance').doc(u.uid);
    try {
      return await f.db.runTransaction(async function (tx) {
        var es = await tx.get(evRef), as = await tx.get(aRef);
        var ev2 = normEvent(es.data(), id), a2 = normAttendance(as.data(), u.uid);
        if (a2.sertNo) return { no: a2.sertNo, display: certDisplay(a2.sertNo), nama: a2.nama, event: ev2 };
        var seq2 = ev2.sertSeq + 1, no2 = certNumber(ev2, seq2);
        tx.set(f.db.collection('certificates').doc(no2), {
          eventId: id, judul: ev2.judul, jenis: ev2.jenis, tanggal: dateLabel(ev2), nama: a2.nama,
          tahun: ev2.tahun, kode: ev2.kode, seq: seq2, terbit: serverTs(f), status: 'Sah'
        });
        tx.update(evRef, { sertSeq: seq2 });
        tx.update(aRef, { sertNo: no2 });
        return { no: no2, display: certDisplay(no2), nama: a2.nama, event: ev2 };
      });
    } catch (e) { throw mapErr(e); }
  }
  function saveBlob(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = d.createElement('a');
    a.href = url; a.download = name; a.rel = 'noopener'; a.hidden = true;
    d.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 2000);
  }
  function certFileName(display) { return 'sertifikat-' + String(display || 'ppapi').replace(/[\/\\]+/g, '-').toLowerCase() + '.pdf'; }
  /** terbitkan (bila perlu) lalu unduh sertifikat PDF → {no, display, fileName, size} */
  async function downloadCertificate(id, o) {
    o = o || {};
    var c = await issueCertificate(id);
    var design = await getDesign(id);
    var doc = await buildPdf(c.event, design, { nama: c.nama, no: c.no, verifyUrl: verifyUrl(c.no) });
    var blob = doc.output('blob'), name = certFileName(c.display);
    if (o.save !== false) saveBlob(blob, name);
    return { no: c.no, display: c.display, fileName: name, size: blob.size, blob: blob };
  }
  /** verifikasi publik: nomor (dengan / atau -) → {no, display, nama, judul, jenis, tanggal, terbit, status} | null */
  async function verify(no) {
    var id = certDocId(no);
    if (!id) return null;
    var raw;
    if (mode() === 'local') raw = lsMap(K_CERTS)[id] || null;
    else {
      var f = await fx();
      try { var s = await f.db.collection('certificates').doc(id).get(); raw = s.exists ? s.data() : null; }
      catch (e) { throw mapErr(e); }
    }
    if (!raw) return null;
    return { no: id, display: certDisplay(id), nama: str(raw.nama, 120), judul: str(raw.judul, 200), jenis: str(raw.jenis, 40), tanggal: str(raw.tanggal, 80), terbit: msOf(raw.terbit), status: raw.status === 'Dicabut' ? 'Dicabut' : 'Sah', alasan: str(raw.alasan, 300), eventId: str(raw.eventId, 120) };
  }

  /* ---- kompresi gambar desain (PNG/JPEG → JPEG data URL ≤ 900 KB) ---- */
  function loadImage(file) {
    return new Promise(function (res, rej) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { res({ img: img, url: url }); };
      img.onerror = function () { URL.revokeObjectURL(url); rej(kErr('kegiatan/gambar', 'Berkas gambar tidak dapat dibaca. Gunakan PNG atau JPEG.')); };
      img.src = url;
    });
  }
  async function compressImage(file, o) {
    o = o || {};
    if (!file || !/^image\/(png|jpeg)$/.test(file.type || '')) throw kErr('kegiatan/gambar', 'Gunakan berkas PNG atau JPEG.');
    if (file.size > 20 * 1024 * 1024) throw kErr('kegiatan/gambar', 'Ukuran berkas terlalu besar (maksimal 20 MB sebelum dikompresi).');
    var max = o.maxChars || LIMITS.designChars;
    var li = await loadImage(file), img = li.img;
    try {
      var iw = img.naturalWidth, ih = img.naturalHeight;
      if (!iw || !ih) throw kErr('kegiatan/gambar', 'Berkas gambar tidak dapat dibaca.');
      var side = Math.min(o.maxSide || 2480, Math.max(iw, ih));
      for (var round = 0; round < 6; round++) {
        var scale = side / Math.max(iw, ih), cw = Math.round(iw * scale), ch = Math.round(ih * scale);
        var cv = d.createElement('canvas'); cv.width = cw; cv.height = ch;
        var ctx = cv.getContext('2d');
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, cw, ch);
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, cw, ch);
        var qs = [0.9, 0.82, 0.74, 0.66, 0.58];
        for (var i = 0; i < qs.length; i++) {
          var url = cv.toDataURL('image/jpeg', qs[i]);
          if (url.length <= max) return { dataUrl: url, w: cw, h: ch, chars: url.length, orient: cw >= ch ? 'landscape' : 'portrait' };
        }
        side = Math.round(side * 0.8);
      }
      throw kErr('kegiatan/gambar', 'Gambar tidak dapat diperkecil hingga 900 KB. Gunakan desain dengan detail lebih sederhana.');
    } finally { URL.revokeObjectURL(li.url); }
  }

  /* ---- kalender (.ics, waktu UTC) ---- */
  function icsEsc(s) { return String(s || '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,'); }
  function icsFold(line) {
    var out = '', cur = '', bytes = 0;
    for (var i = 0; i < line.length; i++) {
      var code = line.codePointAt(i), ch = String.fromCodePoint(code);
      if (code > 0xffff) i++;
      var b = code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
      if (bytes + b > 75) { out += cur + '\r\n '; cur = ''; bytes = 1; }
      cur += ch; bytes += b;
    }
    return out + cur;
  }
  function icsStamp(ms) { var x = new Date(ms); return x.getUTCFullYear() + pad(x.getUTCMonth() + 1) + pad(x.getUTCDate()) + 'T' + pad(x.getUTCHours()) + pad(x.getUTCMinutes()) + pad(x.getUTCSeconds()) + 'Z'; }
  function ics(ev, o) {
    o = o || {};
    var page = U().siteUrl ? U().siteUrl('agenda.html?id=' + encodeURIComponent(ev.id)) : '';
    var desc = [ev.deskripsi, '', 'Jenis: ' + ev.jenis, 'Jadwal: ' + fmtSchedule(ev), 'Mode: ' + ev.mode,
      ev.lokasi ? 'Lokasi: ' + ev.lokasi : '', o.link ? 'Tautan ruang: ' + o.link : '',
      'Daftar hadir: ' + fmtDateTime(ev.hadirBuka) + ' s.d. ' + fmtDateTime(ev.hadirTutup),
      /^https?:/i.test(page) ? 'Info: ' + page : ''].filter(function (x, i) { return x || i === 1; }).join('\n');
    var L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PPAPI//Kegiatan//ID', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      'UID:kegiatan-' + ev.id + '@ppapi', 'DTSTAMP:' + icsStamp(Date.now()), 'DTSTART:' + icsStamp(ev.mulai), 'DTEND:' + icsStamp(ev.selesai),
      'SUMMARY:' + icsEsc(ev.judul + ' — PPAPI'), 'DESCRIPTION:' + icsEsc(desc), 'CATEGORIES:' + icsEsc(ev.jenis)];
    if (o.link || ev.lokasi) L.push('LOCATION:' + icsEsc(o.link || ev.lokasi));
    if (/^https?:\/\//i.test(page)) L.push('URL:' + page);
    L.push('STATUS:CONFIRMED', 'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsEsc('Pengingat: ' + ev.judul), 'TRIGGER:-PT1H', 'END:VALARM', 'END:VEVENT', 'END:VCALENDAR');
    return L.map(icsFold).join('\r\n') + '\r\n';
  }
  function downloadIcs(ev, o) {
    var name = 'ppapi-kegiatan-' + (U().slugify ? U().slugify(ev.judul) : ev.id).slice(0, 60) + '.ics';
    saveBlob(new Blob([ics(ev, o)], { type: 'text/calendar;charset=utf-8' }), name);
    return name;
  }

  /* ======================================================================
     ADMIN (sekretariat)
     ====================================================================== */
  async function adminList() {
    await requireAdmin();
    var list;
    if (mode() === 'local') {
      var map = lsMap(K_EVENTS);
      list = Object.keys(map).map(function (id) { return normEvent(map[id], id); });
    } else {
      var f = await fx();
      try { var snap = await f.db.collection('events').get(); list = snap.docs.map(function (s) { return normEvent(s.data(), s.id); }); }
      catch (e) { throw mapErr(e); }
    }
    return list.filter(Boolean).sort(function (a, b) { return b.mulai - a.mulai; });
  }
  async function adminGet(id) {
    await requireAdmin();
    var ev = await get(id);
    if (!ev) return null;
    var priv = await meetingInfo(id);
    ev.linkRuang = priv.link; ev.catatanRuang = priv.catatan;
    return ev;
  }
  /** simpan (buat bila tanpa id) → kegiatan tersimpan */
  async function adminSave(input) {
    var adm = await requireAdmin();
    var id = str(input && input.id, 120);
    var existing = id ? await get(id) : null;
    var c = sanitizeInput(input, existing);
    /* kode unik antarkegiatan (nomor sertifikat memakai kode) */
    var others = await adminList();
    var clash = others.filter(function (x) { return x.id !== id && x.kode === c.kode && x.tahun === c.tahun; })[0];
    if (clash) {
      var e = kErr('kegiatan/invalid', 'Kode kegiatan "' + c.kode + '" sudah dipakai oleh "' + clash.judul + '". Gunakan kode lain agar nomor sertifikat tidak sama.');
      e.fields = [{ key: 'kode', label: 'Kode kegiatan sudah dipakai' }];
      throw e;
    }
    if (existing && existing.sertSeq > 0 && (c.kode !== existing.kode || c.tahun !== existing.tahun)) {
      var e2 = kErr('kegiatan/invalid', 'Kode dan tahun kegiatan tidak dapat diubah setelah sertifikat diterbitkan.');
      e2.fields = [{ key: 'kode', label: 'Kode terkunci' }];
      throw e2;
    }
    if (!id) {
      id = slugId(c.judul, c.mulai);
      var n = 2, base = id;
      while (others.some(function (x) { return x.id === id; })) id = base + '-' + (n++);
    }
    var buka = c.selesai - WINDOW.bukaMenit * MIN, tutup = c.selesai + WINDOW.tutupJam * 3600000;
    var fields = {
      judul: c.judul, jenis: c.jenis, deskripsi: c.deskripsi, narasumber: c.narasumber, mode: c.mode, lokasi: c.lokasi,
      tautanDaftar: c.tautanDaftar, kuota: c.kuota, akses: c.akses, sertifikat: c.sertifikat, kode: c.kode, tahun: c.tahun, status: c.status
    };
    if (mode() === 'local') {
      var all = lsMap(K_EVENTS), prev = all[id] || {};
      all[id] = Object.assign({}, prev, fields, {
        mulaiAt: new Date(c.mulai).toISOString(), selesaiAt: new Date(c.selesai).toISOString(),
        hadirBuka: new Date(buka).toISOString(), hadirTutup: new Date(tutup).toISOString(),
        terdaftar: int(prev.terdaftar), sertSeq: int(prev.sertSeq),
        createdAt: prev.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), updatedBy: adm.uid
      });
      lsSet(K_EVENTS, all);
      var priv = lsMap(K_PRIV);
      priv[id] = { linkRuang: c.linkRuang, catatan: c.catatanRuang, updatedAt: new Date().toISOString() };
      lsSet(K_PRIV, priv);
    } else {
      var f = await fx();
      var ref = f.db.collection('events').doc(id);
      var times = { mulaiAt: tsFrom(f, c.mulai), selesaiAt: tsFrom(f, c.selesai), hadirBuka: tsFrom(f, buka), hadirTutup: tsFrom(f, tutup), updatedAt: serverTs(f), updatedBy: adm.uid };
      try {
        var batch = f.db.batch();
        if (existing) batch.update(ref, Object.assign({}, fields, times));
        else batch.set(ref, Object.assign({}, fields, times, { terdaftar: 0, sertSeq: 0, createdAt: serverTs(f) }));
        batch.set(ref.collection('private').doc('ruang'), { linkRuang: c.linkRuang, catatan: c.catatanRuang, updatedAt: serverTs(f) });
        await batch.commit();
      } catch (err) { throw mapErr(err); }
    }
    listCache = null;
    await audit(adm, 'kegiatan.disimpan', id, c.judul, c.status === 'terbit' ? 'Terbit' : 'Draf');
    return adminGet(id);
  }
  async function adminSetStatus(id, status) {
    var ev = await adminGet(id);
    if (!ev) throw kErr('kegiatan/not-found', 'Kegiatan tidak ditemukan.');
    return adminSave(Object.assign({}, ev, { status: status === 'terbit' ? 'terbit' : 'draf' }));
  }
  async function adminParticipants(id) {
    await requireAdmin();
    var parts, att;
    if (mode() === 'local') {
      var pm = lsMap(K_PART + id), am = lsMap(K_ATT + id);
      parts = Object.keys(pm).map(function (u) { return normParticipant(pm[u], u); });
      att = Object.keys(am).map(function (u) { return normAttendance(am[u], u); });
    } else {
      var f = await fx(), ref = f.db.collection('events').doc(id);
      try {
        var r = await Promise.all([ref.collection('participants').get(), ref.collection('attendance').get()]);
        parts = r[0].docs.map(function (s) { return normParticipant(s.data(), s.id); });
        att = r[1].docs.map(function (s) { return normAttendance(s.data(), s.id); });
      } catch (e) { throw mapErr(e); }
    }
    var amap = {};
    att.forEach(function (a) { amap[a.uid] = a; });
    parts.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
    att.sort(function (a, b) { return (a.at || 0) - (b.at || 0); });
    return { participants: parts.map(function (p) { return Object.assign({}, p, { attendance: amap[p.uid] || null }); }), attendance: att };
  }
  async function adminMarkAttendance(id, uid) {
    var adm = await requireAdmin();
    var ev = await get(id);
    var data;
    if (mode() === 'local') {
      var p = lsMap(K_PART + id)[uid];
      if (!p) throw kErr('kegiatan/belum-terdaftar', 'Peserta tidak ditemukan.');
      var am = lsMap(K_ATT + id);
      if (am[uid]) return normAttendance(am[uid], uid);
      data = { uid: uid, nama: p.nama, at: new Date().toISOString(), olehAdmin: true };
      am[uid] = data; lsSet(K_ATT + id, am);
    } else {
      var f = await fx(), ref = f.db.collection('events').doc(id);
      try {
        var ps = await ref.collection('participants').doc(uid).get();
        if (!ps.exists) throw kErr('kegiatan/belum-terdaftar', 'Peserta tidak ditemukan.');
        var as = await ref.collection('attendance').doc(uid).get();
        if (as.exists) return normAttendance(as.data(), uid);
        data = { uid: uid, nama: str(ps.data().nama, LIMITS.nama), at: serverTs(f), olehAdmin: true };
        await ref.collection('attendance').doc(uid).set(data);
        data.at = Date.now();
      } catch (e) { throw mapErr(e); }
    }
    await audit(adm, 'kegiatan.hadir-ditandai', id, ev ? ev.judul : id, data.nama);
    return normAttendance(data, uid);
  }
  async function adminRemoveParticipant(id, uid) {
    var adm = await requireAdmin();
    var ev = await get(id), nama = '';
    if (mode() === 'local') {
      var pm = lsMap(K_PART + id);
      if (!pm[uid]) return true;
      nama = pm[uid].nama;
      delete pm[uid]; lsSet(K_PART + id, pm);
      var am = lsMap(K_ATT + id);
      if (am[uid] && !am[uid].sertNo) { delete am[uid]; lsSet(K_ATT + id, am); }
      var all = lsMap(K_EVENTS);
      if (all[id]) { all[id].terdaftar = Math.max(0, int(all[id].terdaftar) - 1); lsSet(K_EVENTS, all); }
    } else {
      var f = await fx(), ref = f.db.collection('events').doc(id);
      try {
        await f.db.runTransaction(async function (tx) {
          var es = await tx.get(ref), ps = await tx.get(ref.collection('participants').doc(uid));
          if (!ps.exists) return;
          nama = str(ps.data().nama, LIMITS.nama);
          tx.delete(ref.collection('participants').doc(uid));
          tx.update(ref, { terdaftar: Math.max(0, int(es.data().terdaftar) - 1), updatedAt: serverTs(f), updatedBy: adm.uid });
        });
      } catch (e) { throw mapErr(e); }
    }
    listCache = null;
    await audit(adm, 'kegiatan.peserta-dihapus', id, ev ? ev.judul : id, nama);
    return true;
  }
  async function adminRemove(id) {
    var adm = await requireAdmin();
    var ev = await get(id);
    if (mode() === 'local') {
      var all = lsMap(K_EVENTS); delete all[id]; lsSet(K_EVENTS, all);
      var priv = lsMap(K_PRIV); delete priv[id]; lsSet(K_PRIV, priv);
      lsRemove(K_PART + id); lsRemove(K_ATT + id); lsRemove(K_DESIGN + id);
    } else {
      var f = await fx(), ref = f.db.collection('events').doc(id);
      try {
        var r = await Promise.all([ref.collection('participants').get(), ref.collection('attendance').get()]);
        var refs = r[0].docs.concat(r[1].docs).map(function (s) { return s.ref; });
        refs.push(ref.collection('private').doc('ruang'), ref.collection('assets').doc('certificate'));
        for (var i = 0; i < refs.length; i += 400) {
          var b = f.db.batch();
          refs.slice(i, i + 400).forEach(function (x) { b.delete(x); });
          await b.commit();
        }
        await ref.delete();
      } catch (e) { throw mapErr(e); }
    }
    listCache = null;
    await audit(adm, 'kegiatan.dihapus', id, ev ? ev.judul : id, 'Sertifikat yang sudah terbit tetap dapat diverifikasi.');
    return true;
  }
  async function adminSaveDesign(id, design) {
    var adm = await requireAdmin();
    var n = normDesign(design);
    if (design && design.bg && !n.bg) throw kErr('kegiatan/gambar', 'Gambar desain tidak valid atau melebihi 900 KB.');
    var out = { bg: n.bg, bgW: n.bgW, bgH: n.bgH, orient: n.orient, fields: n.fields };
    if (mode() === 'local') {
      lsSet(K_DESIGN + id, Object.assign({}, out, { updatedAt: new Date().toISOString(), updatedBy: adm.uid }));
    } else {
      var f = await fx();
      try { await f.db.collection('events').doc(id).collection('assets').doc('certificate').set(Object.assign({}, out, { updatedAt: serverTs(f), updatedBy: adm.uid })); }
      catch (e) { throw mapErr(e); }
    }
    var ev = await get(id);
    await audit(adm, 'kegiatan.desain', id, ev ? ev.judul : id, n.bg ? 'Desain unggahan' : 'Templat bawaan');
    return getDesign(id);
  }
  async function adminCertificates(id) {
    await requireAdmin();
    var list;
    if (mode() === 'local') {
      var m = lsMap(K_CERTS);
      list = Object.keys(m).filter(function (k) { return m[k].eventId === id; }).map(function (k) { return Object.assign({ no: k }, m[k]); });
    } else {
      var f = await fx();
      try { var s = await f.db.collection('certificates').where('eventId', '==', id).get(); list = s.docs.map(function (x) { return Object.assign({ no: x.id }, x.data()); }); }
      catch (e) { throw mapErr(e); }
    }
    return list.map(function (c) {
      return { no: c.no, display: certDisplay(c.no), nama: str(c.nama, 120), seq: int(c.seq), terbit: msOf(c.terbit), status: c.status === 'Dicabut' ? 'Dicabut' : 'Sah', alasan: str(c.alasan, 300) };
    }).sort(function (a, b) { return a.seq - b.seq; });
  }
  async function adminSetCertificateStatus(no, status, alasan) {
    var adm = await requireAdmin();
    var id = certDocId(no);
    if (!id) throw kErr('kegiatan/not-found', 'Nomor sertifikat tidak valid.');
    var st = status === 'Dicabut' ? 'Dicabut' : 'Sah';
    var patch = { status: st, alasan: st === 'Dicabut' ? str(alasan, 300) : '', dicabutAt: st === 'Dicabut' ? new Date().toISOString() : '' };
    if (mode() === 'local') {
      var m = lsMap(K_CERTS);
      if (!m[id]) throw kErr('kegiatan/not-found', 'Sertifikat tidak ditemukan.');
      Object.assign(m[id], patch); lsSet(K_CERTS, m);
    } else {
      var f = await fx();
      if (st === 'Dicabut') patch.dicabutAt = serverTs(f);
      try { await f.db.collection('certificates').doc(id).update(patch); } catch (e) { throw mapErr(e); }
    }
    await audit(adm, st === 'Dicabut' ? 'sertifikat.dicabut' : 'sertifikat.dipulihkan', id, certDisplay(id), patch.alasan);
    return verify(id);
  }
  /** PDF pratinjau untuk admin (tanpa menerbitkan nomor) → {blob, fileName} */
  async function adminSamplePdf(ev, design) {
    var no = certNumber(ev, 1);
    var doc = await buildPdf(ev, design, { nama: 'Nama Peserta', no: no, verifyUrl: verifyUrl(no) });
    return { blob: doc.output('blob'), fileName: 'pratinjau-' + certFileName(certDisplay(no)) };
  }
  function csvCell(v) {
    var s = String(v === null || v === undefined ? '' : v);
    if (/^[=+\-@\t\r\uFF1D\uFF0B\uFF0D\uFF20]/.test(s)) s = "'" + s;
    return /[;,"\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  /** CSV peserta + kehadiran (UTF-8 BOM, pemisah ';' untuk Excel lokal Indonesia) */
  function participantsCsv(ev, rows) {
    var head = ['No', 'Nama (sertifikat)', 'Email', 'Nomor KTA', 'Status keanggotaan', 'Waktu daftar (WIB)', 'Hadir', 'Waktu hadir (WIB)', 'Nomor sertifikat'];
    var lines = [head].concat((rows || []).map(function (p, i) {
      var a = p.attendance;
      return [i + 1, p.nama, p.email, p.kta, p.statusAnggota, isFinite(p.at) ? dateIso(p.at) + ' ' + fmtTime(p.at) : '', a ? 'Ya' : 'Tidak',
        a && isFinite(a.at) ? dateIso(a.at) + ' ' + fmtTime(a.at) + (a.olehAdmin ? ' (ditandai admin)' : '') : '', a && a.sertNo ? certDisplay(a.sertNo) : ''];
    }));
    return '\uFEFF' + lines.map(function (r) { return r.map(csvCell).join(';'); }).join('\r\n') + '\r\n';
  }

/* Pembuat kode QR lokal (salinan dari pages/anggota.js — ISO/IEC 18004, mode byte, tingkat M) */
  var qrCode = (function () {
    /* Tingkat M: kode koreksi per blok dan jumlah blok, indeks = versi */
    var ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26,
      26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
    var BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16,
      17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];

    /* Perkalian GF(2^8), polinom primitif x^8 + x^4 + x^3 + x^2 + 1 */
    function gfMul(x, y) {
      var z = 0;
      for (var i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
      }
      return z;
    }
    /* Polinom pembangkit Reed–Solomon berderajat n (tanpa suku utama) */
    function rsGenerator(n) {
      var poly = [], root = 1, i, j;
      for (i = 0; i < n - 1; i++) poly.push(0);
      poly.push(1);
      for (i = 0; i < n; i++) {
        for (j = 0; j < n; j++) {
          poly[j] = gfMul(poly[j], root);
          if (j + 1 < n) poly[j] ^= poly[j + 1];
        }
        root = gfMul(root, 2);
      }
      return poly;
    }
    function rsRemainder(data, gen) {
      var rem = gen.map(function () { return 0; });
      data.forEach(function (b) {
        var f = b ^ rem.shift();
        rem.push(0);
        for (var i = 0; i < gen.length; i++) rem[i] ^= gfMul(gen[i], f);
      });
      return rem;
    }
    /* Jumlah modul data (termasuk sisa bit) pada sebuah versi */
    function rawModules(v) {
      var r = (16 * v + 128) * v + 64;
      if (v >= 2) {
        var n = Math.floor(v / 7) + 2;
        r -= (25 * n - 10) * n - 55;
        if (v >= 7) r -= 36;
      }
      return r;
    }
    function dataCodewords(v) { return Math.floor(rawModules(v) / 8) - ECC[v] * BLOCKS[v]; }
    function alignment(v) {
      if (v === 1) return [];
      var n = Math.floor(v / 7) + 2, size = v * 4 + 17;
      var step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
      var out = [6];
      for (var p = size - 7; out.length < n; p -= step) out.splice(1, 0, p);
      return out;
    }
    function maskOn(m, x, y) {
      switch (m) {
        case 0: return (x + y) % 2 === 0;
        case 1: return y % 2 === 0;
        case 2: return x % 3 === 0;
        case 3: return (x + y) % 3 === 0;
        case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
        case 5: return x * y % 2 + x * y % 3 === 0;
        case 6: return (x * y % 2 + x * y % 3) % 2 === 0;
        default: return ((x + y) % 2 + x * y % 3) % 2 === 0;
      }
    }

    /* teks → { size, version, mask, modules[y][x] (true = gelap) }.
       forceMask (0–7) hanya untuk pengujian. */
    function encode(text, forceMask) {
      var bytes = Array.prototype.slice.call(new TextEncoder().encode(String(text)));
      var v, cap;
      for (v = 1; v <= 40; v++) {
        cap = dataCodewords(v) * 8;
        if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= cap) break;
      }
      if (v > 40) throw new Error('Data terlalu panjang untuk kode QR.');

      /* 1. Aliran bit: mode byte, panjang, data, terminator, pengisi */
      var bits = [];
      function put(val, len) { for (var k = len - 1; k >= 0; k--) bits.push((val >>> k) & 1); }
      put(4, 4);
      put(bytes.length, v < 10 ? 8 : 16);
      bytes.forEach(function (b) { put(b, 8); });
      put(0, Math.min(4, cap - bits.length));
      put(0, (8 - bits.length % 8) % 8);
      for (var pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
      var data = [], i, j, k;
      for (i = 0; i < bits.length; i += 8) {
        var byte = 0;
        for (k = 0; k < 8; k++) byte = (byte << 1) | bits[i + k];
        data.push(byte);
      }

      /* 2. Blok, kode koreksi Reed–Solomon, lalu disisipkan berselang */
      var nb = BLOCKS[v], ecl = ECC[v], raw = Math.floor(rawModules(v) / 8);
      var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
      var gen = rsGenerator(ecl), blocks = [], eccs = [], pos = 0;
      for (i = 0; i < nb; i++) {
        var len = shortLen - ecl + (i < nShort ? 0 : 1);
        var blk = data.slice(pos, pos + len);
        pos += len;
        blocks.push(blk);
        eccs.push(rsRemainder(blk, gen));
      }
      var code = [];
      for (i = 0; i <= shortLen - ecl; i++) blocks.forEach(function (bk) { if (i < bk.length) code.push(bk[i]); });
      for (i = 0; i < ecl; i++) eccs.forEach(function (e) { code.push(e[i]); });

      /* 3. Matriks dan pola fungsi */
      var size = v * 4 + 17, mod = [], fn = [];
      for (i = 0; i < size; i++) { mod.push([]); fn.push([]); for (j = 0; j < size; j++) { mod[i].push(false); fn[i].push(false); } }
      function setF(x, y, dark) { mod[y][x] = dark; fn[y][x] = true; }
      for (i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
      [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
        for (var dy = -4; dy <= 4; dy++) {
          for (var dx = -4; dx <= 4; dx++) {
            var x = c[0] + dx, y = c[1] + dy, dist = Math.max(Math.abs(dx), Math.abs(dy));
            if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, dist !== 2 && dist !== 4);
          }
        }
      });
      var ap = alignment(v), na = ap.length;
      for (i = 0; i < na; i++) {
        for (j = 0; j < na; j++) {
          if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
          for (var ay = -2; ay <= 2; ay++) {
            for (var ax = -2; ax <= 2; ax++) setF(ap[i] + ax, ap[j] + ay, Math.max(Math.abs(ax), Math.abs(ay)) !== 1);
          }
        }
      }
      function drawFormat(m) {
        var d = m, r = d, n;            /* bit tingkat M = 00 */
        for (n = 0; n < 10; n++) r = (r << 1) ^ ((r >>> 9) * 0x537);
        var b = ((d << 10) | r) ^ 0x5412;
        function bit(q) { return ((b >>> q) & 1) !== 0; }
        for (n = 0; n <= 5; n++) setF(8, n, bit(n));
        setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
        for (n = 9; n < 15; n++) setF(14 - n, 8, bit(n));
        for (n = 0; n < 8; n++) setF(size - 1 - n, 8, bit(n));
        for (n = 8; n < 15; n++) setF(8, size - 15 + n, bit(n));
        setF(8, size - 8, true);
      }
      drawFormat(0); /* menandai area format sebagai pola fungsi */
      if (v >= 7) {
        var vr = v;
        for (k = 0; k < 12; k++) vr = (vr << 1) ^ ((vr >>> 11) * 0x1f25);
        var vb = (v << 12) | vr;
        for (k = 0; k < 18; k++) {
          var on = ((vb >>> k) & 1) !== 0, a = size - 11 + k % 3, c = Math.floor(k / 3);
          setF(a, c, on); setF(c, a, on);
        }
      }

      /* 4. Penempatan zig-zag dua kolom, dari kanan bawah */
      var bi = 0, total = code.length * 8;
      for (var right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (var vert = 0; vert < size; vert++) {
          for (j = 0; j < 2; j++) {
            var cx = right - j, up = ((right + 1) & 2) === 0, cy = up ? size - 1 - vert : vert;
            if (!fn[cy][cx] && bi < total) {
              mod[cy][cx] = ((code[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0;
              bi++;
            }
          }
        }
      }

      /* 5. Masker dengan penalti terkecil */
      function applyMask(m) {
        for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (!fn[y][x] && maskOn(m, x, y)) mod[y][x] = !mod[y][x];
      }
      function lineScore(get) {
        var s = 0, run = 1, q, t;
        for (q = 1; q <= size; q++) {
          if (q < size && get(q) === get(q - 1)) run++;
          else { if (run >= 5) s += run - 2; run = 1; }
        }
        function light(a, b) { for (t = a; t < b; t++) if (t >= 0 && t < size && get(t)) return false; return true; }
        for (q = 0; q + 7 <= size; q++) {
          if (get(q) && !get(q + 1) && get(q + 2) && get(q + 3) && get(q + 4) && !get(q + 5) && get(q + 6)) {
            if (light(q - 4, q)) s += 40;
            if (light(q + 7, q + 11)) s += 40;
          }
        }
        return s;
      }
      function penalty() {
        var s = 0, dark = 0, x, y;
        for (y = 0; y < size; y++) s += lineScore(function (q) { return mod[y][q]; });
        for (x = 0; x < size; x++) s += lineScore(function (q) { return mod[q][x]; });
        for (y = 0; y < size; y++) {
          for (x = 0; x < size; x++) {
            if (mod[y][x]) dark++;
            if (x < size - 1 && y < size - 1) {
              var c0 = mod[y][x];
              if (c0 === mod[y][x + 1] && c0 === mod[y + 1][x] && c0 === mod[y + 1][x + 1]) s += 3;
            }
          }
        }
        return s + Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10;
      }
      var best = typeof forceMask === 'number' ? forceMask : -1, bestScore = Infinity;
      if (best < 0) {
        for (var m = 0; m < 8; m++) {
          applyMask(m); drawFormat(m);
          var sc = penalty();
          if (sc < bestScore) { bestScore = sc; best = m; }
          applyMask(m);
        }
      }
      applyMask(best); drawFormat(best);
      return { size: size, version: v, mask: best, modules: mod };
    }

    /* Satu <path> (baris modul gelap digabung), warna mengikuti currentColor */
    function svg(text) {
      var q = encode(text), d = '';
      for (var y = 0; y < q.size; y++) {
        for (var x = 0; x < q.size;) {
          if (!q.modules[y][x]) { x++; continue; }
          var x0 = x;
          while (x < q.size && q.modules[y][x]) x++;
          d += 'M' + x0 + ' ' + y + 'h' + (x - x0) + 'v1h-' + (x - x0) + 'z';
        }
      }
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + q.size + ' ' + q.size + '" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="' + d + '"/></svg>';
    }
    return { encode: encode, svg: svg };
  })();

  PPAPI.kegiatan = {
    __real: true,
    version: 1,
    get mode() { return mode(); },
    JENIS: JENIS.slice(), MODES: MODES.slice(), STATUS: STATUS.slice(),
    AKSES: Object.assign({}, AKSES), AKSES_DESC: Object.assign({}, AKSES_DESC),
    WINDOW: Object.assign({}, WINDOW), LIMITS: Object.assign({}, LIMITS),
    FIELD_KEYS: FIELD_KEYS.slice(), FIELD_LABEL: Object.assign({}, FIELD_LABEL), PHASE_LABEL: Object.assign({}, PHASE_LABEL),
    AUDIT_LABELS: Object.assign({}, AUDIT_LABELS), DEFAULT_STATIC: clone(DEFAULT_STATIC),
    /* publik */
    listPublished: listPublished, get: get, asAgendaItems: asAgendaItems, toAgendaItem: toAgendaItem,
    /* peserta */
    eligibility: eligibility, myRegistration: myRegistration, myAttendance: myAttendance, myStatus: myStatus, myEvents: myEvents,
    register: register, updateName: updateName, cancel: cancel, meetingInfo: meetingInfo, attend: attend,
    /* sertifikat */
    issueCertificate: issueCertificate, downloadCertificate: downloadCertificate, verify: verify, getDesign: getDesign,
    defaultDesign: defaultDesign, normDesign: normDesign, buildPdf: buildPdf, ensureJsPDF: ensureJsPDF, verifyUrl: verifyUrl,
    certDisplay: certDisplay, certDocId: certDocId, compressImage: compressImage, pageSize: pageSize, fieldTexts: fieldTexts,
    qr: qrCode,
    /* waktu & format */
    windowOf: windowOf, phaseOf: phaseOf, fromWib: fromWib, dateIso: dateIso, timeHm: timeHm, fmtTime: fmtTime, fmtDate: fmtDate,
    fmtDateTime: fmtDateTime, fmtSchedule: fmtSchedule, dateLabel: dateLabel, fmtCountdown: fmtCountdown, fmtDuration: fmtDuration,
    defaultKode: defaultKode, normEvent: normEvent, ics: ics, downloadIcs: downloadIcs, saveBlob: saveBlob,
    /* admin */
    admin: {
      list: adminList, get: adminGet, save: adminSave, setStatus: adminSetStatus, remove: adminRemove,
      participants: adminParticipants, markAttendance: adminMarkAttendance, removeParticipant: adminRemoveParticipant,
      getDesign: function (id) { return requireAdmin().then(function () { return getDesign(id); }); },
      saveDesign: adminSaveDesign, certificates: adminCertificates, setCertificateStatus: adminSetCertificateStatus,
      samplePdf: adminSamplePdf, participantsCsv: participantsCsv
    }
  };
})(window, document);
