/* ==========================================================================
   PPAPI core.js — shared runtime for every page
   Creates window.PPAPI: config, data, util, icon, ui, layout, motion, session, onReady.
   v2: membership lifecycle helpers (util.effectiveStatus …), PPAPI.session, data-auth
   'active' / 'admin' gating, ui.locked / ui.drawer, membership-aware account menu.
   Page scripts only CONSUME this API (see devtools/FOUNDATION_NOTES.md).
   Classic script, no build step; safe when auth.js / store.js / data files
   are absent.
   ========================================================================== */
(function (w, d) {
  'use strict';

  var PPAPI = w.PPAPI = w.PPAPI || {};
  if (PPAPI.__core) return;
  PPAPI.__core = true;
  PPAPI.version = '2.0.0';
  PPAPI.config = w.PPAPI_CONFIG || {};
  w.PPAPI_DATA = w.PPAPI_DATA || {};
  PPAPI.data = w.PPAPI_DATA;

  var html = d.documentElement;
  function prefersReduced() {
    try { return !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; }
  }

  /* ========================================================================
     UTIL
     ======================================================================== */
  var util = PPAPI.util = {};
  var MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  var MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  var WEEKDAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  var WEEKDAYS_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
  util.MONTHS = MONTHS;
  util.MONTHS_SHORT = MONTHS_SHORT;

  util.$ = function (sel, root) { return (root || d).querySelector(sel); };
  util.$$ = function (sel, root) { return Array.prototype.slice.call((root || d).querySelectorAll(sel)); };

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
  util.h = function (str) {
    if (str === null || str === undefined) return '';
    return String(str).replace(/[&<>"'`]/g, function (c) { return ESC[c]; });
  };
  /** Escape, then turn *kata* into <em>kata</em> (used for taglines from config). */
  util.emphasis = function (str) {
    return util.h(str).replace(/\*([^*]+)\*/g, '<em>$1</em>');
  };
  /** Remove *emphasis* markers → plain text. */
  util.plain = function (str) { return String(str || '').replace(/\*([^*]+)\*/g, '$1'); };

  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  util.pad = function (n, len) { var s = String(n); while (s.length < (len || 2)) s = '0' + s; return s; };

  /** Parse 'YYYY-MM-DD' as a LOCAL date (no UTC shift); also ISO strings, Date, ms, Firestore Timestamp. */
  util.parseDate = function (v) {
    if (v === null || v === undefined || v === '') return null;
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
    if (typeof v === 'number') return new Date(v);
    if (typeof v === 'object' && typeof v.toDate === 'function') { try { return v.toDate(); } catch (e) { return null; } }
    var s = String(v).trim();
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    var dt = new Date(s);
    return isNaN(dt.getTime()) ? null : dt;
  };
  function startOfDay(dt) { return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate()); }
  function sameDay(a, b) { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

  /** formatDate('2026-10-07') → "7 Oktober 2026"; {short:true} → "7 Okt 2026"; {weekday:true} → "Rabu, 7 Oktober 2026"; {time:true} adds ", 08.00"; {noYear:true}. */
  util.formatDate = function (iso, opts) {
    opts = opts || {};
    var dt = util.parseDate(iso);
    if (!dt) return '';
    var M = opts.short ? MONTHS_SHORT : MONTHS;
    var out = dt.getDate() + ' ' + M[dt.getMonth()] + (opts.noYear ? '' : ' ' + dt.getFullYear());
    if (opts.weekday) out = (opts.short ? WEEKDAYS_SHORT : WEEKDAYS)[dt.getDay()] + ', ' + out;
    if (opts.time) out += ', ' + pad2(dt.getHours()) + '.' + pad2(dt.getMinutes());
    return out;
  };

  /** "21–23 Oktober 2026", "30 Oktober – 2 November 2026", "30 Desember 2026 – 2 Januari 2027". */
  util.formatDateRange = function (startIso, endIso, opts) {
    opts = opts || {};
    var a = util.parseDate(startIso), b = util.parseDate(endIso);
    if (!a) return '';
    if (!b || sameDay(a, b) || b < a) return util.formatDate(a, opts);
    var M = opts.short ? MONTHS_SHORT : MONTHS;
    if (a.getFullYear() === b.getFullYear()) {
      if (a.getMonth() === b.getMonth()) return a.getDate() + '–' + b.getDate() + ' ' + M[a.getMonth()] + ' ' + a.getFullYear();
      return a.getDate() + ' ' + M[a.getMonth()] + ' – ' + b.getDate() + ' ' + M[b.getMonth()] + ' ' + b.getFullYear();
    }
    return util.formatDate(a, opts) + ' – ' + util.formatDate(b, opts);
  };

  util.todayIso = function () {
    var t = new Date();
    return t.getFullYear() + '-' + pad2(t.getMonth() + 1) + '-' + pad2(t.getDate());
  };

  /** Whole days from today to the date (negative when past); null when invalid. */
  util.daysUntil = function (iso) {
    var dt = util.parseDate(iso);
    if (!dt) return null;
    return Math.round((startOfDay(dt) - startOfDay(new Date())) / 86400000);
  };

  function dayPhrase(daysAgo) {
    var n = Math.abs(daysAgo), past = daysAgo > 0, v, unit;
    if (n === 0) return 'hari ini';
    if (n === 1) return past ? 'kemarin' : 'besok';
    if (n < 7) { v = n; unit = 'hari'; }
    else if (n < 30) { v = Math.round(n / 7); unit = 'minggu'; }
    else if (n < 365) { v = Math.max(1, Math.round(n / 30)); unit = 'bulan'; }
    else { v = Math.max(1, Math.round(n / 365)); unit = 'tahun'; }
    return past ? v + ' ' + unit + ' lalu' : 'dalam ' + v + ' ' + unit;
  }
  /** "baru saja", "5 menit lalu", "kemarin", "3 hari lalu", "dalam 2 minggu" … */
  util.relativeTime = function (iso) {
    var dt = util.parseDate(iso);
    if (!dt) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(iso).trim())) return dayPhrase(-util.daysUntil(iso));
    var sec = Math.round((Date.now() - dt.getTime()) / 1000), abs = Math.abs(sec), past = sec >= 0;
    if (abs < 45) return past ? 'baru saja' : 'sebentar lagi';
    if (abs < 3600) { var m = Math.max(1, Math.round(abs / 60)); return past ? m + ' menit lalu' : 'dalam ' + m + ' menit'; }
    if (abs < 86400 && sameDay(dt, new Date())) { var hr = Math.max(1, Math.round(abs / 3600)); return past ? hr + ' jam lalu' : 'dalam ' + hr + ' jam'; }
    return dayPhrase(-util.daysUntil(dt));
  };

  util.qs = function (name) {
    try { return new URLSearchParams(w.location.search).get(name); } catch (e) { return null; }
  };

  util.debounce = function (fn, ms) {
    var t;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms === undefined ? 200 : ms);
    };
  };

  util.slugify = function (s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/&/g, ' dan ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };

  util.initials = function (name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    var out = '';
    for (var i = 0; i < parts.length && out.length < 2; i++) {
      var ch = parts[i].replace(/[^0-9A-Za-zÀ-ɏ]/g, '').charAt(0);
      if (ch) out += ch;
    }
    return out.toUpperCase();
  };

  /** Selamat pagi (05–11) / siang (11–15) / sore (15–18) / malam (18–05). */
  util.greeting = function (date) {
    var hr = (date || new Date()).getHours();
    if (hr >= 5 && hr < 11) return 'Selamat pagi';
    if (hr >= 11 && hr < 15) return 'Selamat siang';
    if (hr >= 15 && hr < 18) return 'Selamat sore';
    return 'Selamat malam';
  };

  /** Indonesian MOBILE number → E.164 "+628…" or null. Accepts 08…, 8…, 628…, +628…, spaces/dashes/dots/brackets. */
  util.normalizePhoneID = function (s) {
    if (s === null || s === undefined) return null;
    var t = String(s).trim().replace(/[\s\-().]/g, '');
    if (!t) return null;
    if (t.charAt(0) === '+') t = t.slice(1);
    if (!/^\d+$/.test(t)) return null;
    if (t.indexOf('62') === 0) t = t.slice(2);
    else if (t.charAt(0) === '0') t = t.slice(1);
    if (!/^8\d{8,11}$/.test(t)) return null;
    return '+62' + t;
  };
  /** "+6281234567890" → "+62 812-3456-7890" */
  util.formatPhoneID = function (e164) {
    var n = util.normalizePhoneID(e164);
    if (!n) return e164 ? String(e164) : '';
    var r = n.slice(3);
    return '+62 ' + r.slice(0, 3) + '-' + r.slice(3, 7) + (r.length > 7 ? '-' + r.slice(7) : '');
  };
  /** "+6281234567890" → "+62 812-••••-7890" */
  util.maskPhone = function (e164) {
    var n = util.normalizePhoneID(e164);
    if (!n) return '';
    var r = n.slice(3);
    return '+62 ' + r.slice(0, 3) + '-' + '••••' + '-' + r.slice(-4);
  };

  util.isEmail = function (s) {
    return /^[^\s@"'<>()[\],;:]+@[^\s@"'<>()[\],;:]+\.[A-Za-z]{2,}$/.test(String(s || '').trim());
  };

  util.uid = function (prefix) {
    return (prefix || 'id') + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  };

  /* Kelengkapan profil anggota — SATU definisi untuk Dasbor dan Halaman Anggota.
     13 isian profil yang dapat diubah anggota sendiri (anggota.html#profil) + minimal satu
     kompetensi + minimal satu sertifikat = 15 butir. Email dan nomor HP mengikuti akun
     masuk (tidak dapat diubah di situs), sehingga tidak dinilai.
     label = label formulir; short = label ringkas (cip "Belum diisi"); focus = id isian (#f-<focus>). */
  var PROFILE_FIELDS = [
    { key: 'name', group: 'pribadi', label: 'Nama lengkap', short: 'Nama lengkap' },
    { key: 'birthPlace', group: 'pribadi', label: 'Tempat lahir', short: 'Tempat lahir' },
    { key: 'birthDate', group: 'pribadi', label: 'Tanggal lahir', short: 'Tanggal lahir' },
    { key: 'gender', group: 'pribadi', label: 'Jenis kelamin', short: 'Jenis kelamin', focus: 'gender-l' },
    { key: 'province', group: 'pribadi', label: 'Provinsi', short: 'Provinsi' },
    { key: 'city', group: 'pribadi', label: 'Kota / kabupaten', short: 'Kota / kabupaten' },
    { key: 'address', group: 'pribadi', label: 'Alamat', short: 'Alamat' },
    { key: 'company', group: 'profesional', label: 'Perusahaan / instansi', short: 'Perusahaan' },
    { key: 'position', group: 'profesional', label: 'Jabatan', short: 'Jabatan' },
    { key: 'experienceYears', group: 'profesional', label: 'Pengalaman di bidang perancah', short: 'Pengalaman' },
    { key: 'education', group: 'profesional', label: 'Pendidikan terakhir', short: 'Pendidikan' },
    { key: 'bio', group: 'profesional', label: 'Ringkasan profil', short: 'Ringkasan profil' },
    { key: 'linkedin', group: 'profesional', label: 'Tautan LinkedIn', short: 'LinkedIn' }
  ];
  util.PROFILE_FIELDS = PROFILE_FIELDS;
  util.profileCompleteness = function (member) {
    var m = member || {}, p = m.profile || {};
    function filled(v) { return v !== null && v !== undefined && String(v).trim() !== ''; }
    function count(v) { return Array.isArray(v) ? v.filter(Boolean).length : 0; }
    var comp = count(m.competencies), cert = count(m.certificates);
    var items = PROFILE_FIELDS.map(function (c) {
      return {
        key: c.key, group: c.group, label: c.label, short: c.short, focus: c.focus || c.key,
        ok: filled(c.key === 'name' ? m.name : p[c.key]),
        href: 'anggota.html?isi=' + encodeURIComponent(c.key) + '#profil'
      };
    }).concat([
      { key: 'kompetensi', group: 'kompetensi', label: 'Minimal satu kompetensi', short: 'Kompetensi', ok: comp > 0, href: 'anggota.html#kompetensi' },
      { key: 'sertifikat', group: 'sertifikat', label: 'Minimal satu sertifikat', short: 'Sertifikat', ok: cert > 0, href: 'anggota.html#sertifikat' }
    ]);
    var done = items.filter(function (x) { return x.ok; }).length;
    return {
      pct: Math.round(done / items.length * 100), total: items.length, done: done,
      items: items, missing: items.filter(function (x) { return !x.ok; }), comp: comp, cert: cert
    };
  };

  util.storage = {
    get: function (key, fallback) {
      try {
        var raw = w.localStorage.getItem(key);
        if (raw === null) return fallback === undefined ? null : fallback;
        return JSON.parse(raw);
      } catch (e) { return fallback === undefined ? null : fallback; }
    },
    set: function (key, val) {
      try { w.localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
    },
    remove: function (key) {
      try { w.localStorage.removeItem(key); return true; } catch (e) { return false; }
    }
  };

  /** Deterministic membership number: "PPAPI-YYYY-NNNNNN" (FNV-1a hash of uid). */
  util.ktaFromUid = function (uid, year) {
    var s = String(uid || ''), hsh = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) {
      hsh ^= s.charCodeAt(i);
      hsh = Math.imul(hsh, 0x01000193) >>> 0;
    }
    var n = (hsh % 1000000) || 1;
    return 'PPAPI-' + (year || new Date().getFullYear()) + '-' + util.pad(n, 6);
  };

  /** Certificate status from expiry date; '' = no expiry. tone → badge modifier (ok|warn|err). */
  util.certStatus = function (expiresIso) {
    if (!expiresIso) return { key: 'tanpa-batas', label: 'Tanpa batas', days: null, tone: 'ok' };
    var days = util.daysUntil(expiresIso);
    if (days === null) return { key: 'tanpa-batas', label: 'Tanpa batas', days: null, tone: 'ok' };
    if (days < 0) return { key: 'kedaluwarsa', label: 'Kedaluwarsa', days: days, tone: 'err' };
    if (days <= 90) return { key: 'segera', label: 'Segera kedaluwarsa', days: days, tone: 'warn' };
    return { key: 'aktif', label: 'Aktif', days: days, tone: 'ok' };
  };

  /* Lencana "Contoh" hanya untuk data uji Mode Demo (apiKey kosong). Situs produksi (Mode Firebase)
     tidak pernah menampilkannya, sekalipun ada butir lama yang masih membawa tanda contoh. */
  util.contohBadge = function (item) {
    if (PPAPI.auth && PPAPI.auth.mode === 'firebase') return '';
    return item && item.contoh ? '<span class="badge badge--contoh">Contoh</span>' : '';
  };

  /* ---------- Membership lifecycle (SPEC v2 §1) ----------
     Stored statuses: Draf · Menunggu Verifikasi · Perlu Perbaikan · Aktif · Ditolak · Nonaktif.
     Computed: Kedaluwarsa = Aktif with validUntil before today (missing validUntil = still active).
     A 'Menunggu Verifikasi' record without application.submittedAt (v1 account) counts as Draf. */
  var STATUS_INFO = {
    'Draf': { tone: 'muted', label: 'Formulir pendaftaran belum diajukan' },
    'Menunggu Verifikasi': { tone: 'warn', label: 'Pengajuan sedang diverifikasi sekretariat' },
    'Perlu Perbaikan': { tone: 'warn', label: 'Sekretariat meminta perbaikan data pengajuan' },
    'Aktif': { tone: 'ok', label: 'Keanggotaan aktif' },
    'Ditolak': { tone: 'err', label: 'Pengajuan belum dapat disetujui' },
    'Nonaktif': { tone: 'err', label: 'Keanggotaan sedang dinonaktifkan' },
    'Kedaluwarsa': { tone: 'err', label: 'Masa berlaku keanggotaan telah berakhir' }
  };
  util.STATUS_INFO = STATUS_INFO;
  util.MEMBER_STATUSES = ['Draf', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Aktif', 'Ditolak', 'Nonaktif'];
  util.RENEWAL_DAYS = 60;
  /** Stored status after v2 normalisation (unknown / v1-pending-without-application → 'Draf'); '' for no member. */
  util.memberStatus = function (member) {
    if (!member || typeof member !== 'object') return '';
    var s = member.status;
    if (util.MEMBER_STATUSES.indexOf(s) === -1) return 'Draf';
    if (s === 'Menunggu Verifikasi' && !(member.application && member.application.submittedAt)) return 'Draf';
    return s;
  };
  /** 'Kedaluwarsa' when Aktif and validUntil < today; otherwise the (normalised) stored status. '' for no member. */
  util.effectiveStatus = function (member) {
    var s = util.memberStatus(member);
    if (s === 'Aktif' && member.validUntil) {
      var days = util.daysUntil(member.validUntil);
      if (days !== null && days < 0) return 'Kedaluwarsa';
    }
    return s;
  };
  util.isActiveMember = function (member) { return util.effectiveStatus(member) === 'Aktif'; };
  function statusInfo(status) { return typeof status === 'string' && Object.prototype.hasOwnProperty.call(STATUS_INFO, status) ? STATUS_INFO[status] : null; }
  util.statusTone = function (status) { var i = statusInfo(status); return i ? i.tone : 'muted'; };
  util.statusLabel = function (status) { var i = statusInfo(status); return i ? i.label : ''; };
  /** <span class="badge badge--ok|warn|err|muted" data-status="…">Status</span> ('' for an empty status) */
  util.statusBadge = function (status) {
    if (!status) return '';
    return '<span class="badge badge--' + util.statusTone(status) + '" data-status="' + h(status) + '">' + h(status) + '</span>';
  };
  /** Days until member.validUntil (null when not set). */
  util.validityDays = function (member) { return member && member.validUntil ? util.daysUntil(member.validUntil) : null; };
  /** May the member submit a perpanjangan (renewal) application?
      Kedaluwarsa or Nonaktif, or Aktif with ≤ RENEWAL_DAYS days left. */
  util.canRenew = function (member) {
    var st = util.effectiveStatus(member);
    if (st === 'Kedaluwarsa' || st === 'Nonaktif') return true;
    if (st !== 'Aktif') return false;
    var days = util.validityDays(member);
    return days !== null && days <= util.RENEWAL_DAYS;
  };
  /* Shared option lists (formulir pendaftaran, profil anggota, saringan konsol admin) */
  util.PROVINSI = [
    'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi', 'Sumatera Selatan',
    'Kepulauan Bangka Belitung', 'Bengkulu', 'Lampung', 'DKI Jakarta', 'Jawa Barat', 'Banten', 'Jawa Tengah',
    'Daerah Istimewa Yogyakarta', 'Jawa Timur', 'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
    'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
    'Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tenggara',
    'Maluku', 'Maluku Utara', 'Papua', 'Papua Barat', 'Papua Barat Daya', 'Papua Selatan', 'Papua Tengah',
    'Papua Pegunungan'
  ].sort(function (a, b) { return a.localeCompare(b, 'id'); });
  util.PENDIDIKAN = [
    'SD / Sederajat', 'SMP / Sederajat', 'SMA / SMK / Sederajat', 'Diploma I (D1)', 'Diploma II (D2)',
    'Diploma III (D3)', 'Diploma IV / Sarjana Terapan', 'Sarjana (S1)', 'Magister (S2)', 'Doktor (S3)'
  ];
  util.GENDER = ['Laki-laki', 'Perempuan'];

  /** Default validity proposed on approval: 31 Dec of (this year + config.masaBerlakuTahun, default 3). */
  util.defaultValidUntil = function (fromDate) {
    var n = parseInt(PPAPI.config && PPAPI.config.masaBerlakuTahun, 10);
    if (!isFinite(n) || n < 1) n = 3;
    var y = (util.parseDate(fromDate) || new Date()).getFullYear() + n;
    return y + '-12-31';
  };

  util.formatNumber = function (n, decimals) {
    var v = Number(n);
    if (!isFinite(v)) return '';
    var dec = decimals || 0;
    try { return new Intl.NumberFormat('id-ID', { minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v); }
    catch (e) { return v.toFixed(dec); }
  };

  /** Current file name, e.g. "anggota.html". */
  util.fileName = function () {
    var f = (w.location.pathname || '').split('/').pop();
    return f || 'index.html';
  };

  /** Only same-site relative *.html paths are allowed as redirect targets (no protocol, no //, no ..). */
  util.safeNext = function (value, fallback) {
    fallback = fallback || 'dashboard.html';
    if (!value || typeof value !== 'string') return fallback;
    var v = value.trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9_\-./]*\.html(?:[?#][^\s]*)?$/.test(v)) return fallback;
    if (v.indexOf('//') !== -1 || v.indexOf('\\') !== -1 || /^[a-z][a-z0-9+.\-]*:/i.test(v)) return fallback;
    if (/(^|\/)\.\.(\/|$)/.test(v)) return fallback;
    if (/^masuk\.html/i.test(v)) return fallback;
    return v;
  };

  /** config.siteUrl as a usable base ('https://user.github.io/repo/') or '' when empty/invalid. */
  util.siteBase = function () {
    var raw = String((PPAPI.config && PPAPI.config.siteUrl) || '').trim();
    if (!raw) return '';
    if (!/^[a-z][a-z0-9+.\-]*:/i.test(raw)) raw = 'https://' + raw.replace(/^\/+/, ''); /* "user.github.io/repo" */
    try {
      var u = new URL(raw.replace(/[?#].*$/, '').replace(/\/?$/, '/'));
      return /^https?:$/.test(u.protocol) ? u.href : '';
    } catch (e) { return ''; }
  };
  /** Absolute URL for a site-relative path: config.siteUrl when it is a valid http(s) URL,
      otherwise the address the page is opened at (document.baseURI — honours <base> on 404.html). */
  util.siteUrl = function (path) {
    path = path == null ? '' : String(path);
    var base = util.siteBase();
    try {
      if (base) return new URL(path.replace(/^\/+/, ''), base).href;
      return new URL(path, d.baseURI || w.location.href).href;
    } catch (e) {
      try { return new URL(path, w.location.href).href; } catch (er) { return path; }
    }
  };

  /** Password strength → {score 0–4, label, valid (≥8 chars, letter + number)}. */
  util.passwordStrength = function (pw) {
    pw = String(pw || '');
    if (!pw) return { score: 0, label: '', valid: false };
    var valid = pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);
    var pts = (pw.length >= 8) + (pw.length >= 12) + (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) + (/\d/.test(pw)) + (/[^A-Za-z0-9]/.test(pw));
    var score = !valid ? 1 : pts <= 3 ? 2 : pts === 4 ? 3 : 4;
    return { score: score, label: ['', 'Lemah', 'Sedang', 'Kuat', 'Sangat kuat'][score], valid: valid };
  };

  util.copyText = function (text) {
    text = String(text || '');
    if (w.navigator && w.navigator.clipboard && w.isSecureContext) {
      return w.navigator.clipboard.writeText(text).then(function () { return true; }, function () { return legacyCopy(text); });
    }
    return Promise.resolve(legacyCopy(text));
  };
  function legacyCopy(text) {
    try {
      var ta = d.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      d.body.appendChild(ta); ta.select();
      var ok = d.execCommand('copy');
      ta.remove();
      return !!ok;
    } catch (e) { return false; }
  }

  util.sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* Known images (intrinsic sizes + small variants) for srcset/width/height */
  var IMAGES = {
    'assets/img/facade-bw.webp': { w: 1153, h: 1920, sm: 'assets/img/facade-bw-sm.webp', smw: 432, smh: 720 },
    'assets/img/stage-silhouette.webp': { w: 1281, h: 1920, sm: 'assets/img/stage-silhouette-sm.webp', smw: 480, smh: 720 },
    'assets/img/stair-tower.webp': { w: 1920, h: 1280, sm: 'assets/img/stair-tower-sm.webp', smw: 720, smh: 480 },
    'assets/img/ringlock-pattern.webp': { w: 1000, h: 1500, sm: 'assets/img/ringlock-pattern-sm.webp', smw: 480, smh: 720 },
    'assets/img/tower-heritage.webp': { w: 1125, h: 1500, sm: 'assets/img/tower-heritage-sm.webp', smw: 540, smh: 720 },
    'assets/img/og-image.jpg': { w: 1200, h: 630 },
    /* logos: the 1200px masters (≈130 KB) are only needed for print / very large use; on screen
       the -sm WebP files (≈20–40 KB) are enough for ≤ 3× density at their usual sizes */
    'assets/img/logo-color.png': { w: 1200, h: 418, sm: 'assets/img/logo-color-sm.webp', smw: 720, smh: 251 },
    'assets/img/logo-light.png': { w: 1200, h: 418, sm: 'assets/img/logo-light-sm.webp', smw: 480, smh: 167 },
    'assets/img/logo-mono-dark.png': { w: 1200, h: 418, sm: 'assets/img/logo-mono-dark-sm.webp', smw: 480, smh: 167 },
    /* wordmark only (tagline removed) for the small header logo, where the tagline would be ~3px tall */
    'assets/img/logo-light-mark.webp': { w: 360, h: 125 }
  };
  util.images = IMAGES;
  /**
   * <img> HTML for a site image with width/height, srcset (when a -sm variant exists),
   * lazy loading and async decoding. opts: {alt, cls, sizes, eager, small}
   */
  util.img = function (src, opts) {
    opts = opts || {};
    var m = IMAGES[src] || {};
    var useSmall = !!(opts.small && m.sm);
    var a = ['src="' + h(useSmall ? m.sm : src) + '"'];
    if (m.sm && !useSmall) {
      a.push('srcset="' + h(m.sm) + ' ' + m.smw + 'w, ' + h(src) + ' ' + m.w + 'w"');
      a.push('sizes="' + h(opts.sizes || '(max-width: 768px) 100vw, 50vw') + '"');
    }
    var wd = useSmall ? m.smw : m.w, ht = useSmall ? m.smh : m.h;
    if (wd && ht) a.push('width="' + wd + '" height="' + ht + '"');
    a.push('alt="' + h(opts.alt || '') + '"');
    if (opts.cls) a.push('class="' + h(opts.cls) + '"');
    a.push(opts.eager ? 'fetchpriority="high"' : 'loading="lazy"');
    a.push('decoding="async"');
    return '<img ' + a.join(' ') + '>';
  };

  /* ========================================================================
     ICONS — 24px grid, 1.5 stroke, currentColor ("google" = official 4-color G)
     ======================================================================== */
  var SHIELD = '<path d="M12 3l7.5 3v5.6c0 4.6-3.2 8.3-7.5 9.4-4.3-1.1-7.5-4.8-7.5-9.4V6z"/>';
  var STAR = '<path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/>';
  var ICONS = {
    'arrow-right': '<path d="M4.5 12h15M13.5 6l6 6-6 6"/>',
    'arrow-left': '<path d="M19.5 12h-15M10.5 6l-6 6 6 6"/>',
    'arrow-up-right': '<path d="M7 17L17 7M8.5 7H17v8.5"/>',
    'arrow-down': '<path d="M12 4.5v15M6 13.5l6 6 6-6"/>',
    'arrow-up': '<path d="M12 19.5v-15M6 10.5l6-6 6 6"/>',
    'external': '<path d="M14 4h6v6M20 4l-8.5 8.5"/><path d="M18 13.5V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5.5"/>',
    'menu': '<path d="M4 8.5h16M4 15.5h16"/>',
    'close': '<path d="M6 6l12 12M18 6L6 18"/>',
    'user': '<circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c.6-3.9 3.6-6.3 7.5-6.3s6.9 2.4 7.5 6.3"/>',
    'users': '<circle cx="9" cy="8.5" r="3.5"/><path d="M2.5 20c.5-3.5 3.1-5.8 6.5-5.8s6 2.3 6.5 5.8"/><path d="M15.5 5.2a3.5 3.5 0 0 1 0 6.6M17.5 14.6c2.2.6 3.6 2.6 4 5.4"/>',
    'user-plus': '<circle cx="9.5" cy="8" r="4"/><path d="M2.5 20.5c.6-3.9 3.4-6.3 7-6.3 1.7 0 3.2.5 4.4 1.5"/><path d="M18.5 13.5v7M15 17h7"/>',
    'mail': '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3.5 6.5l8.5 6.5 8.5-6.5"/>',
    'phone': '<path d="M6.7 3.5h2.6l1.4 4-1.9 1.4a11.5 11.5 0 0 0 6.3 6.3l1.4-1.9 4 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.7 5.7a2 2 0 0 1 2-2.2z"/>',
    'lock': '<rect x="4.5" y="10.5" width="15" height="10" rx="1.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3M12 14.5v2"/>',
    'eye': '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
    'eye-off': '<path d="M3.5 3.5l17 17"/><path d="M10.4 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16.6 16.6 0 0 1-2.7 3.6M6.6 7.1C4 8.9 2.5 12 2.5 12S6 18.5 12 18.5c1.9 0 3.6-.6 5-1.5"/><path d="M10 10a2.8 2.8 0 0 0 4 4"/>',
    'calendar': '<rect x="3.5" y="5" width="17" height="15.5" rx="1.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    'clock': '<circle cx="12" cy="12" r="8.75"/><path d="M12 7.5V12l3 2"/>',
    'map-pin': '<path d="M12 21s-6.75-5.9-6.75-11.25a6.75 6.75 0 0 1 13.5 0C18.75 15.1 12 21 12 21z"/><circle cx="12" cy="9.75" r="2.5"/>',
    'file-text': '<path d="M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z"/><path d="M14 3v5h5M8.5 12.5h7M8.5 16h7M8.5 9h2.5"/>',
    'download': '<path d="M12 4v11M7 10l5 5 5-5M4.5 20h15"/>',
    'upload': '<path d="M12 16V5M7 10l5-5 5 5M4.5 20h15"/>',
    'search': '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    'filter': '<path d="M4 6.5h16M7 12h10M10 17.5h4"/>',
    'check': '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    'check-circle': '<circle cx="12" cy="12" r="8.75"/><path d="M8.2 12.2l2.6 2.6 5-5.3"/>',
    'x-circle': '<circle cx="12" cy="12" r="8.75"/><path d="M9.2 9.2l5.6 5.6M14.8 9.2l-5.6 5.6"/>',
    'alert-triangle': '<path d="M10.3 4.3L2.9 17.2A2 2 0 0 0 4.6 20.2h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.2M12 16.9v.1"/>',
    'info': '<circle cx="12" cy="12" r="8.75"/><path d="M12 11v5.2M12 7.9v.1"/>',
    'help-circle': '<circle cx="12" cy="12" r="8.75"/><path d="M9.6 9.4a2.5 2.5 0 0 1 4.9.7c0 1.7-2.5 2.2-2.5 3.7M12 16.9v.1"/>',
    'shield': SHIELD,
    'shield-check': SHIELD + '<path d="M8.8 12.1l2.2 2.2 4.2-4.4"/>',
    'award': '<circle cx="12" cy="9" r="5.75"/><path d="M8.7 13.8L7.5 21l4.5-2.5 4.5 2.5-1.2-7.2"/>',
    'certificate': '<path d="M13 18H4.5A1.5 1.5 0 0 1 3 16.5v-11A1.5 1.5 0 0 1 4.5 4h15A1.5 1.5 0 0 1 21 5.5V11"/><path d="M7 8.5h10M7 12h5"/><circle cx="17.5" cy="15" r="2.5"/><path d="M16 17v4l1.5-1 1.5 1v-4"/>',
    'hard-hat': '<path d="M4.5 16a7.5 7.5 0 0 1 15 0"/><path d="M10 8.7V6.2h4v2.5"/><rect x="2.5" y="16" width="19" height="3" rx="1"/>',
    'layers': '<path d="M12 3.5l8.5 4.5L12 12.5 3.5 8z"/><path d="M3.5 12l8.5 4.5 8.5-4.5M3.5 16l8.5 4.5 8.5-4.5"/>',
    'settings': '<path d="M4 6.5h9M17 6.5h3M4 12h3M11 12h9M4 17.5h11M19 17.5h1"/><circle cx="15" cy="6.5" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17.5" r="2"/>',
    'logout': '<path d="M9.5 4H5.5A1.5 1.5 0 0 0 4 5.5v13A1.5 1.5 0 0 0 5.5 20h4"/><path d="M15 8l4 4-4 4M19 12H9"/>',
    'edit': '<path d="M4 20l1.1-4.1L15.9 5.1a2.1 2.1 0 0 1 3 3L8.1 18.9z"/><path d="M14 7l3 3M13 20h7"/>',
    'plus': '<path d="M12 5v14M5 12h14"/>',
    'minus': '<path d="M5 12h14"/>',
    'trash': '<path d="M4 7h16M9.5 7V4.5h5V7M6 7l1 13h10l1-13M10 11v5.5M14 11v5.5"/>',
    'link': '<path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1"/><path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1"/>',
    'chevron-down': '<path d="M6 9.5l6 6 6-6"/>',
    'chevron-up': '<path d="M6 14.5l6-6 6 6"/>',
    'chevron-right': '<path d="M9.5 6l6 6-6 6"/>',
    'chevron-left': '<path d="M14.5 6l-6 6 6 6"/>',
    'building': '<path d="M4.5 21V4.5A1.5 1.5 0 0 1 6 3h7a1.5 1.5 0 0 1 1.5 1.5V21M14.5 9.5h3.5a1.5 1.5 0 0 1 1.5 1.5v10M2.5 21h19"/><path d="M8 7h3M8 11h3M8 15h3M17 13.5v.1M17 17v.1"/>',
    'book': '<path d="M4 5.5A2 2 0 0 1 6 3.5h13.5v14H6a2 2 0 0 0-2 2z"/><path d="M4 19.5a2 2 0 0 0 2 2h13.5v-4M8.5 7.5h7"/>',
    'scale': '<path d="M12 4v16M8 20h8M5 7.5h14M12 4v.1"/><path d="M2.5 14a2.5 2.5 0 0 0 5 0L5 7.5z"/><path d="M16.5 14a2.5 2.5 0 0 0 5 0L19 7.5z"/>',
    'message': '<path d="M20 15a1.5 1.5 0 0 1-1.5 1.5H8L4 20V5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5z"/><path d="M8 9h8M8 12.5h5"/>',
    'send': '<path d="M21 3L10.5 13.5M21 3l-6.5 18-4-7.5-7.5-4z"/>',
    'star': STAR,
    'star-filled': STAR.replace('<path ', '<path fill="currentColor" '),
    'grid': '<rect x="4" y="4" width="6.5" height="6.5" rx=".5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx=".5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx=".5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx=".5"/>',
    'compass': '<circle cx="12" cy="12" r="8.75"/><path d="M15.6 8.4l-2 5.2-5.2 2 2-5.2z"/>',
    'wrench': '<path d="M15.5 4a4.5 4.5 0 0 0-4 6.4l-6.8 6.8a1.8 1.8 0 0 0 2.6 2.6l6.8-6.8A4.5 4.5 0 0 0 20 8.5l-2.8 1.3-3-3z"/>',
    'ruler': '<path d="M3.5 15.5L15.5 3.5l5 5-12 12z"/><path d="M7.5 11.5l2 2M10.5 8.5l2 2M13.5 5.5l2 2"/>',
    'activity': '<path d="M3 12h4l2.5-6.5 5 13 2.5-6.5h4"/>',
    'bell': '<path d="M6 16.5v-5.5a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 21a2 2 0 0 0 4 0"/>',
    'bookmark': '<path d="M6.5 3.5h11v17l-5.5-4-5.5 4z"/>',
    'briefcase': '<rect x="3" y="7" width="18" height="13" rx="1.5"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 12.5h18M11 12.5v1.5h2v-1.5"/>',
    'globe': '<circle cx="12" cy="12" r="8.75"/><path d="M3.25 12h17.5M12 3.25c2.4 2.4 3.7 5.4 3.7 8.75S14.4 18.4 12 20.75C9.6 18.4 8.3 15.4 8.3 12S9.6 5.6 12 3.25z"/>',
    'home': '<path d="M3.5 11L12 4l8.5 7"/><path d="M5.5 9.5V20h13V9.5M10 20v-5.5h4V20"/>',
    'id-card': '<rect x="2.5" y="5" width="19" height="14" rx="1.5"/><circle cx="8.5" cy="11" r="2.2"/><path d="M5.3 16c.5-1.6 1.7-2.5 3.2-2.5s2.7.9 3.2 2.5M14.5 10h4.5M14.5 13.5h3"/>',
    'qr-code': '<rect x="4" y="4" width="6" height="6"/><rect x="14" y="4" width="6" height="6"/><rect x="4" y="14" width="6" height="6"/><path d="M14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5zM14 20h1M20 14v1M6.5 6.5h1v1h-1zM16.5 6.5h1v1h-1zM6.5 16.5h1v1h-1z"/>',
    'printer': '<path d="M7 9V3.5h10V9"/><path d="M7 17H5a1.5 1.5 0 0 1-1.5-1.5v-5A1.5 1.5 0 0 1 5 9h14a1.5 1.5 0 0 1 1.5 1.5v5A1.5 1.5 0 0 1 19 17h-2"/><path d="M7 14h10v6.5H7z"/>',
    'share': '<circle cx="17.5" cy="5.5" r="2.5"/><circle cx="6.5" cy="12" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/><path d="M8.7 10.8l6.6-4M8.7 13.2l6.6 4"/>',
    'copy': '<rect x="8.5" y="8.5" width="12" height="12" rx="1.5"/><path d="M15.5 8.5V5A1.5 1.5 0 0 0 14 3.5H5A1.5 1.5 0 0 0 3.5 5v9A1.5 1.5 0 0 0 5 15.5h3.5"/>',
    'refresh': '<path d="M19.5 11A7.5 7.5 0 0 0 6.2 7.2L4.5 9M4.5 4.5V9H9"/><path d="M4.5 13a7.5 7.5 0 0 0 13.3 3.8l1.7-1.8M19.5 19.5V15H15"/>',
    'quote': '<path d="M10 7c-3 .9-5 3.3-5 6.6V17h4.5v-4.5H6.8M19 7c-3 .9-5 3.3-5 6.6V17h4.5v-4.5h-2.7"/>',
    'instagram': '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.2 6.8v.1"/>',
    'linkedin': '<rect x="3.5" y="3.5" width="17" height="17" rx="2"/><path d="M8 10.5v6M8 7.5v.1M11.5 16.5v-6M11.5 13.2c0-1.6 1.1-2.7 2.5-2.7s2.5 1 2.5 2.7v3.3"/>',
    'youtube': '<path d="M21 8.2a2.6 2.6 0 0 0-1.8-1.9C17.6 6 12 6 12 6s-5.6 0-7.2.3A2.6 2.6 0 0 0 3 8.2 27 27 0 0 0 2.7 12 27 27 0 0 0 3 15.8a2.6 2.6 0 0 0 1.8 1.9c1.6.3 7.2.3 7.2.3s5.6 0 7.2-.3a2.6 2.6 0 0 0 1.8-1.9 27 27 0 0 0 .3-3.8 27 27 0 0 0-.3-3.8z"/><path d="M10 9.4v5.2l4.6-2.6z"/>',
    'facebook': '<path d="M14.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.6 1.6-1.6h1.6V4.3a21 21 0 0 0-2.3-.1c-2.4 0-4 1.4-4 4.1v2.2H8.8v3h2.6V21"/>',
    'whatsapp': '<path d="M4 20l1.2-4.1a8.4 8.4 0 1 1 3.2 3.1z"/><path d="M9.2 8.3c.3-.4.6-.4.9-.4h.4c.2 0 .4.1.5.4l.7 1.6c.1.2 0 .5-.1.6l-.5.6a.5.5 0 0 0 0 .6 6 6 0 0 0 2.6 2.4c.2.1.4.1.6-.1l.6-.7c.2-.2.4-.2.6-.1l1.6.8c.2.1.3.3.3.5-.1.6-.3 1.3-1 1.6-.8.4-1.9.3-3.5-.4a9.3 9.3 0 0 1-3.7-3.7c-.8-1.5-.6-2.8-.2-3.2z"/>',
    'google': '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>'
  };

  PPAPI.icons = Object.keys(ICONS);

  /** PPAPI.icon(name, {size=20, cls='', label}) → inline SVG string. */
  PPAPI.icon = function (name, opts) {
    opts = opts || {};
    var body = ICONS[name];
    if (!body) {
      if (w.console) console.warn('[PPAPI] Ikon tidak dikenal: "' + name + '"');
      return '';
    }
    var size = Math.max(1, parseInt(opts.size, 10) || 20);
    var cls = 'icon icon--' + name + (opts.cls ? ' ' + util.h(opts.cls) : '');
    var a11y = opts.label ? ' role="img" aria-label="' + util.h(opts.label) + '"' : ' aria-hidden="true"';
    if (name === 'google') {
      return '<svg class="' + cls + '" width="' + size + '" height="' + size + '" viewBox="0 0 48 48" focusable="false"' + a11y + '>' + body + '</svg>';
    }
    return '<svg class="' + cls + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false"' + a11y + '>' + body + '</svg>';
  };
  var icon = PPAPI.icon;
  var h = util.h, $ = util.$, $$ = util.$$;

  /* ========================================================================
     UI
     ======================================================================== */
  var ui = PPAPI.ui = {};

  var FOCUSABLE = 'a[href], area[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), iframe, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
  function focusables(root) {
    return $$(FOCUSABLE, root).filter(function (el) {
      if (el.closest('[hidden], [inert]')) return false;
      var r = el.getBoundingClientRect();
      return (r.width > 0 || r.height > 0) && w.getComputedStyle(el).visibility !== 'hidden';
    });
  }
  function trapTab(e, list) {
    if (!list.length) return;
    var first = list[0], last = list[list.length - 1], active = d.activeElement;
    var inside = list.indexOf(active) !== -1;
    if (e.shiftKey && (active === first || !inside)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (active === last || !inside)) { e.preventDefault(); first.focus(); }
  }
  ui._focusables = focusables;

  /* scroll lock helper: keeps layout steady when the page scrollbar disappears */
  function setLockClass(cls, on) {
    if (on && !html.classList.contains('modal-open') && !html.classList.contains('menu-open')) {
      var gap = w.innerWidth - html.clientWidth;
      html.style.setProperty('--scroll-lock-gap', (gap > 0 ? gap : 0) + 'px');
    }
    html.classList.toggle(cls, on);
    if (!html.classList.contains('modal-open') && !html.classList.contains('menu-open')) html.style.removeProperty('--scroll-lock-gap');
  }

  /* ---------- Toast ---------- */
  var toastRegion = null;
  function getToastRegion() {
    if (toastRegion && d.body.contains(toastRegion)) return toastRegion;
    toastRegion = d.createElement('div');
    toastRegion.className = 'toast-region';
    toastRegion.setAttribute('role', 'status');
    toastRegion.setAttribute('aria-live', 'polite');
    toastRegion.setAttribute('aria-atomic', 'false');
    d.body.appendChild(toastRegion);
    return toastRegion;
  }
  ui.toast = function (message, opts) {
    opts = opts || {};
    if (!d.body) return null;
    var type = { success: 'success', error: 'error', warn: 'warn', info: 'info' }[opts.type] || 'info';
    var timeout = opts.timeout === undefined ? 4200 : opts.timeout;
    var region = getToastRegion();
    var el = d.createElement('div');
    el.className = 'toast toast--' + type;
    var ico = { success: 'check-circle', error: 'alert-triangle', warn: 'alert-triangle', info: 'info' }[type];
    el.innerHTML = '<span class="toast__icon">' + icon(ico, { size: 20 }) + '</span><div class="toast__msg"></div>' +
      '<button type="button" class="toast__close" aria-label="Tutup notifikasi">' + icon('close', { size: 16 }) + '</button>';
    el.querySelector('.toast__msg').textContent = String(message === undefined ? '' : message);
    region.appendChild(el);
    while (region.children.length > 4) region.removeChild(region.firstElementChild);
    var timer = null, remaining = timeout, started = 0, closed = false;
    function dismiss() {
      if (closed) return;
      closed = true;
      clearTimeout(timer);
      el.classList.add('is-leaving');
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, prefersReduced() ? 0 : 300);
    }
    function run() { if (timeout > 0 && !closed) { started = Date.now(); timer = setTimeout(dismiss, Math.max(remaining, 1200)); } }
    el.addEventListener('mouseenter', function () { clearTimeout(timer); remaining -= Date.now() - started; });
    el.addEventListener('mouseleave', run);
    el.querySelector('.toast__close').addEventListener('click', dismiss);
    run();
    return { el: el, close: dismiss };
  };

  /** Show a toast on the NEXT page load (e.g. after a redirect). */
  ui.flash = function (message, opts) {
    try { w.sessionStorage.setItem('ppapi_flash', JSON.stringify({ message: message, opts: opts || {} })); } catch (e) { /* ignore */ }
  };
  function showFlash() {
    try {
      var raw = w.sessionStorage.getItem('ppapi_flash');
      if (!raw) return;
      w.sessionStorage.removeItem('ppapi_flash');
      var f = JSON.parse(raw);
      if (f && f.message) setTimeout(function () { ui.toast(f.message, f.opts || {}); }, 350);
    } catch (e) { /* ignore */ }
  }

  /* ---------- Loading state for buttons ---------- */
  var loadingStore = new WeakMap();
  ui.setLoading = function (button, isLoading, loadingLabel) {
    if (!button) return;
    if (isLoading) {
      if (loadingStore.has(button)) return;
      loadingStore.set(button, { html: button.innerHTML, disabled: button.disabled, minWidth: button.style.minWidth });
      var wd = button.offsetWidth;
      if (wd) button.style.minWidth = wd + 'px';
      if ('disabled' in button) button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      button.setAttribute('aria-disabled', 'true');
      button.classList.add('is-loading');
      button.innerHTML = '<span class="spinner" aria-hidden="true"></span><span>' + h(loadingLabel || 'Memproses…') + '</span>';
    } else {
      var st = loadingStore.get(button);
      if (!st) return;
      loadingStore.delete(button);
      button.innerHTML = st.html;
      if ('disabled' in button) button.disabled = st.disabled;
      button.style.minWidth = st.minWidth;
      button.removeAttribute('aria-busy');
      button.removeAttribute('aria-disabled');
      button.classList.remove('is-loading');
    }
  };

  /* ---------- Scrollable dialog body ----------
     A dialog body that overflows must be reachable by keyboard (WCAG 2.1.1; axe scrollable-region-focusable).
     Chromium/Firefox make such boxes focusable by themselves, Safari does not — so while the body
     overflows it becomes a labelled, focusable region (Tab reaches it; arrows / Page Down scroll it).
     Re-checked when the content or the viewport changes; returns stop(). */
  function watchScrollable(bodyEl, labelId) {
    var on = false;
    function check() {
      if (!bodyEl.isConnected) return;
      var over = bodyEl.scrollHeight - bodyEl.clientHeight > 2;
      if (over === on) return;
      on = over;
      bodyEl.classList.toggle('is-scrollable', over);
      if (over) {
        bodyEl.setAttribute('tabindex', '0');
        bodyEl.setAttribute('role', 'region');
        bodyEl.setAttribute('aria-labelledby', labelId);
      } else {
        bodyEl.removeAttribute('tabindex');
        bodyEl.removeAttribute('role');
        bodyEl.removeAttribute('aria-labelledby');
      }
    }
    var ro = w.ResizeObserver ? new w.ResizeObserver(check) : null;
    function observeKids() {
      if (!ro) return;
      ro.disconnect();
      ro.observe(bodyEl);
      Array.prototype.forEach.call(bodyEl.children, function (c) { ro.observe(c); });
    }
    var mo = w.MutationObserver ? new w.MutationObserver(function () { observeKids(); check(); }) : null;
    if (mo) mo.observe(bodyEl, { childList: true, subtree: true, characterData: true });
    observeKids();
    w.addEventListener('resize', check);
    w.requestAnimationFrame(check);
    var late = setTimeout(check, 600);   /* after the opening animation and late images/fonts */
    return function stop() {
      clearTimeout(late);
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      w.removeEventListener('resize', check);
    };
  }

  /* ---------- Modal ---------- */
  var modalStack = [];
  /* Action buttons shared by ui.modal and ui.drawer:
     onClick(close, {el, button}) — return false (or a Promise resolving false) keeps the dialog open;
     a Promise shows the button spinner; a thrown/rejected error → error toast, dialog stays open. */
  function buildActions(footer, actions, close, root) {
    (actions || []).forEach(function (a) {
      var btn = d.createElement('button');
      btn.type = 'button';
      var variant = { primary: 'primary', ghost: 'ghost', danger: 'danger', link: 'link' }[a.variant] || 'ghost';
      btn.className = 'btn btn--' + variant;
      btn.innerHTML = '<span>' + h(a.label || 'OK') + '</span>';
      if (a.autofocus) btn.setAttribute('data-autofocus', '');
      if (a.id) btn.id = a.id;
      btn.addEventListener('click', function () {
        if (!a.onClick) { close(); return; }
        var res;
        try { res = a.onClick(close, { el: root, button: btn }); }
        catch (err) { console.error(err); ui.toast(err && err.message ? err.message : 'Terjadi kendala.', { type: 'error' }); return; }
        if (res && typeof res.then === 'function') {
          ui.setLoading(btn, true);
          res.then(function (v) {
            ui.setLoading(btn, false);
            if (v !== false) close();
          }, function (err) {
            ui.setLoading(btn, false);
            console.error(err);
            ui.toast(err && err.message ? err.message : 'Terjadi kendala.', { type: 'error' });
          });
        } else if (res !== false) {
          close();
        }
      });
      footer.appendChild(btn);
    });
  }
  ui.modal = function (o) {
    o = o || {};
    var size = { sm: 'sm', md: 'md', lg: 'lg' }[o.size] || 'md';
    var id = util.uid('modal');
    var root = d.createElement('div');
    root.className = 'modal' + (o.cls ? ' ' + o.cls : '');
    root.innerHTML =
      '<div class="modal__backdrop" data-modal-close></div>' +
      '<div class="modal__dialog modal__dialog--' + size + '" role="dialog" aria-modal="true" aria-labelledby="' + id + '-title" tabindex="-1">' +
        '<div class="modal__header"><div>' +
          (o.eyebrow ? '<p class="eyebrow modal__eyebrow">' + h(o.eyebrow) + '</p>' : '') +
          '<h2 class="modal__title" id="' + id + '-title"></h2></div>' +
          '<button type="button" class="icon-btn icon-btn--ghost modal__close" data-modal-close aria-label="Tutup dialog">' + icon('close') + '</button>' +
        '</div>' +
        '<div class="modal__body"></div>' +
        '<div class="modal__footer"></div>' +
      '</div>';
    var dialog = root.querySelector('.modal__dialog');
    var bodyEl = root.querySelector('.modal__body');
    var footer = root.querySelector('.modal__footer');
    root.querySelector('.modal__title').textContent = o.title || '';
    if (o.body instanceof w.Node) bodyEl.appendChild(o.body);
    else if (o.body !== undefined && o.body !== null) bodyEl.innerHTML = String(o.body);

    var closed = false, api;
    var prevFocus = d.activeElement;
    var actions = Array.isArray(o.actions) ? o.actions : [];
    if (!actions.length) footer.parentNode.removeChild(footer);
    buildActions(footer, actions, function () { close(); }, root);
    var stopScrollWatch = watchScrollable(bodyEl, id + '-title');

    function onKey(e) {
      if (modalStack[modalStack.length - 1] !== api) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'Tab') trapTab(e, focusables(dialog));
    }
    function close(result) {
      if (closed) return;
      closed = true;
      var i = modalStack.indexOf(api);
      if (i !== -1) modalStack.splice(i, 1);
      d.removeEventListener('keydown', onKey, true);
      stopScrollWatch();
      root.classList.add('is-closing');
      setTimeout(function () {
        if (root.parentNode) root.parentNode.removeChild(root);
        if (!modalStack.length) setLockClass('modal-open', false);
      }, prefersReduced() ? 0 : 230);
      if (prevFocus && typeof prevFocus.focus === 'function' && d.contains(prevFocus)) {
        try { prevFocus.focus({ preventScroll: true }); } catch (e) { prevFocus.focus(); }
      }
      if (typeof o.onClose === 'function') { try { o.onClose(result); } catch (err) { console.error(err); } }
    }

    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-modal-close]')) { e.preventDefault(); close(); }
    });
    d.addEventListener('keydown', onKey, true);
    d.body.appendChild(root);
    setLockClass('modal-open', true);
    api = { el: root, dialog: dialog, body: bodyEl, close: close };
    modalStack.push(api);

    if (typeof o.onOpen === 'function') { try { o.onOpen(root); } catch (err) { console.error(err); } }
    var target = $('[data-autofocus]', root) ||
      $('input:not([type="hidden"]):not([disabled]), select, textarea', bodyEl) ||
      (o.initialFocus === 'last' ? footer.lastElementChild : null) ||
      (footer.parentNode ? footer.firstElementChild : null) || dialog;
    setTimeout(function () { try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); } }, 30);
    return api;
  };

  ui.confirm = function (message, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var settled = false;
      function done(v) { if (!settled) { settled = true; resolve(v); } }
      ui.modal({
        title: opts.title || 'Konfirmasi',
        size: 'sm',
        body: '<p>' + h(message) + '</p>',
        initialFocus: opts.danger ? null : 'last',
        actions: [
          { label: opts.cancelLabel || 'Batal', variant: 'ghost', onClick: function () { done(false); } },
          { label: opts.okLabel || 'Ya, lanjutkan', variant: opts.danger ? 'danger' : 'primary', onClick: function () { done(true); } }
        ],
        onClose: function () { done(false); }
      });
    });
  };

  /* ---------- Drawer (right side panel, e.g. admin detail views) ----------
     ui.drawer({ title, eyebrow, body (html string — NOT escaped — or Node), actions, size: 'md'|'lg',
                 onOpen(el), onClose(), cls }) → { el, panel, body, footer, close, setTitle(t), setBody(html|Node), setActions(actions) }
     Same contract as ui.modal: focus trap, Esc, backdrop click, focus restored on close; shares the
     dialog stack, so a ui.confirm() opened from a drawer sits on top and Esc closes it first. */
  ui.drawer = function (o) {
    o = o || {};
    var size = { md: 'md', lg: 'lg', sm: 'sm' }[o.size] || 'md';
    var id = util.uid('drawer');
    var root = d.createElement('div');
    root.className = 'drawer' + (o.cls ? ' ' + o.cls : '');
    root.innerHTML =
      '<div class="drawer__backdrop" data-drawer-close></div>' +
      '<div class="drawer__panel drawer__panel--' + size + '" role="dialog" aria-modal="true" aria-labelledby="' + id + '-title" tabindex="-1">' +
        '<div class="drawer__header"><div class="drawer__heading">' +
          '<p class="eyebrow drawer__eyebrow"' + (o.eyebrow ? '' : ' hidden') + '></p>' +
          '<h2 class="drawer__title" id="' + id + '-title"></h2></div>' +
          '<button type="button" class="icon-btn icon-btn--ghost drawer__close" data-drawer-close aria-label="Tutup panel">' + icon('close') + '</button>' +
        '</div>' +
        '<div class="drawer__body"></div>' +
        '<div class="drawer__footer"></div>' +
      '</div>';
    var panel = root.querySelector('.drawer__panel');
    var bodyEl = root.querySelector('.drawer__body');
    var footer = root.querySelector('.drawer__footer');
    root.querySelector('.drawer__title').textContent = o.title || '';
    if (o.eyebrow) root.querySelector('.drawer__eyebrow').textContent = o.eyebrow;
    function setBody(b) {
      bodyEl.innerHTML = '';
      if (b instanceof w.Node) bodyEl.appendChild(b);
      else if (b !== undefined && b !== null) bodyEl.innerHTML = String(b);
      ui.reveal(bodyEl);
    }
    function setActions(list) {
      footer.innerHTML = '';
      list = Array.isArray(list) ? list : [];
      footer.hidden = !list.length;
      buildActions(footer, list, function () { close(); }, root);
    }
    var closed = false, api, stopScrollWatch = function () {};
    var prevFocus = d.activeElement;
    function onKey(e) {
      if (modalStack[modalStack.length - 1] !== api) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
      else if (e.key === 'Tab') trapTab(e, focusables(panel));
    }
    function close(result) {
      if (closed) return;
      closed = true;
      var i = modalStack.indexOf(api);
      if (i !== -1) modalStack.splice(i, 1);
      d.removeEventListener('keydown', onKey, true);
      stopScrollWatch();
      root.classList.add('is-closing');
      setTimeout(function () {
        if (root.parentNode) root.parentNode.removeChild(root);
        if (!modalStack.length) setLockClass('modal-open', false);
      }, prefersReduced() ? 0 : 320);
      if (prevFocus && typeof prevFocus.focus === 'function' && d.contains(prevFocus)) {
        try { prevFocus.focus({ preventScroll: true }); } catch (e) { prevFocus.focus(); }
      }
      if (typeof o.onClose === 'function') { try { o.onClose(result); } catch (err) { console.error(err); } }
    }
    root.addEventListener('click', function (e) {
      if (e.target.closest('[data-drawer-close]')) { e.preventDefault(); close(); }
    });
    setBody(o.body);
    setActions(o.actions);
    d.addEventListener('keydown', onKey, true);
    d.body.appendChild(root);
    stopScrollWatch = watchScrollable(bodyEl, id + '-title');
    setLockClass('modal-open', true);
    api = {
      el: root, panel: panel, body: bodyEl, footer: footer, close: close,
      setTitle: function (t) { root.querySelector('.drawer__title').textContent = t || ''; },
      setBody: setBody, setActions: setActions
    };
    modalStack.push(api);
    if (typeof o.onOpen === 'function') { try { o.onOpen(root); } catch (err) { console.error(err); } }
    var target = $('[data-autofocus]', root) || $('input:not([type="hidden"]):not([disabled]), select, textarea', bodyEl) || panel;
    setTimeout(function () { try { target.focus({ preventScroll: true }); } catch (e) { target.focus(); } }, 30);
    return api;
  };

  /* ---------- Locked state ("Khusus Anggota Aktif") ----------
     ui.locked({ title, text, actionHtml, eyebrow, icon, compact }) → html string.
     title/text are escaped; actionHtml is raw. Without actionHtml the CTA follows the session:
     signed out → Masuk + Daftar; signed in but not active → the next membership step. */
  ui.lockedAction = function (opts) {
    opts = opts || {};
    var s = PPAPI.session && PPAPI.session.current ? PPAPI.session.current() : null;
    var sm = opts.compact ? ' btn--sm' : '';
    var arrow = icon('arrow-right', { size: 16, cls: 'btn__icon' });
    if (!s || !s.user) {
      var here = util.fileName() + w.location.search + w.location.hash;
      var nx = util.safeNext(here, '#'), next = nx === '#' ? '' : nx;
      return '<a class="btn btn--primary' + sm + '" href="masuk.html' + (next ? '?next=' + encodeURIComponent(next) : '') + '"><span>Masuk</span>' + arrow + '</a>' +
        '<a class="btn btn--ghost' + sm + '" href="masuk.html?next=pendaftaran.html#daftar"><span>Daftar Menjadi Anggota</span></a>';
    }
    if (s.isActive) return '';
    var map = {
      'Draf': ['pendaftaran.html', 'Lengkapi Pendaftaran'],
      'Perlu Perbaikan': ['pendaftaran.html', 'Perbaiki Pengajuan'],
      'Ditolak': ['pendaftaran.html', 'Ajukan Ulang'],
      'Kedaluwarsa': ['pendaftaran.html', 'Ajukan Perpanjangan'],
      'Nonaktif': ['pendaftaran.html', 'Ajukan Perpanjangan'],
      'Menunggu Verifikasi': ['dashboard.html', 'Lihat Status Pendaftaran']
    }[s.status] || ['pendaftaran.html', 'Lengkapi Pendaftaran'];
    return '<a class="btn btn--primary' + sm + '" href="' + map[0] + '"><span>' + h(map[1]) + '</span>' + arrow + '</a>';
  };
  ui.locked = function (o) {
    o = o || {};
    var s = PPAPI.session && PPAPI.session.current ? PPAPI.session.current() : null;
    var title = o.title || 'Khusus anggota berstatus Aktif';
    var text = o.text;
    if (text === undefined) {
      text = !s || !s.user
        ? 'Masuk dengan akun Anda untuk melanjutkan. Belum menjadi anggota? Daftar dan isi formulir pendaftaran — fitur ini terbuka setelah keanggotaan Anda disetujui sekretariat.'
        : (s.status === 'Menunggu Verifikasi'
          ? 'Pengajuan keanggotaan Anda sedang diverifikasi sekretariat. Fitur ini terbuka setelah status keanggotaan Anda Aktif.'
          : 'Fitur ini terbuka setelah status keanggotaan Anda Aktif. Status saat ini: ' + (s.status || 'Draf') + '.');
    }
    var action = o.actionHtml !== undefined ? o.actionHtml : ui.lockedAction({ compact: o.compact });
    return '<div class="locked' + (o.compact ? ' locked--compact' : '') + (o.cls ? ' ' + h(o.cls) : '') + '">' +
      '<span class="locked__icon">' + icon(o.icon || 'lock', { size: o.compact ? 18 : 22 }) + '</span>' +
      '<p class="locked__eyebrow">' + h(o.eyebrow || 'Khusus Anggota Aktif') + '</p>' +
      '<p class="locked__title">' + h(title) + '</p>' +
      (text ? '<p class="locked__text">' + h(text) + '</p>' : '') +
      (action ? '<div class="locked__actions">' + action + '</div>' : '') +
      '</div>';
  };

  /* ---------- Empty state / skeleton ---------- */
  ui.emptyState = function (o) {
    o = o || {};
    return '<div class="empty-state">' +
      '<div class="empty-state__icon">' + icon(o.icon || 'search', { size: 24 }) + '</div>' +
      (o.title ? '<p class="empty-state__title">' + h(o.title) + '</p>' : '') +
      (o.text ? '<p class="empty-state__text">' + h(o.text) + '</p>' : '') +
      (o.actionHtml ? '<div class="empty-state__action">' + o.actionHtml + '</div>' : '') +
      '</div>';
  };
  ui.skeleton = function (lines) {
    var n = Math.max(1, lines || 3), out = '';
    for (var i = 0; i < n; i++) out += '<span class="skeleton__line"></span>';
    return '<div class="skeleton" role="status"><span class="sr-only">Memuat…</span>' + out + '</div>';
  };

  /* ---------- Scaffold SVG (self-drawing standards, ledgers, braces, coupler nodes) ---------- */
  function pct(v) { return (Math.round(v * 1000) / 1000) + '%'; }
  ui.scaffoldSVG = function (o) {
    o = o || {};
    var cols = Math.max(2, o.cols || 6), rows = Math.max(1, o.rows || 4);
    var braces = o.braces !== false, nodes = o.nodes !== false;
    var xs = [], ys = [], parts = [], i, j;
    for (i = 0; i < cols; i++) xs.push((i + 0.5) / cols * 100);
    for (j = 0; j < rows; j++) ys.push((j + 1) / (rows + 1) * 100);
    xs.forEach(function (x, k) {
      parts.push('<line class="sd-line" x1="' + pct(x) + '" y1="0" x2="' + pct(x) + '" y2="100%" pathLength="1" style="--d:' + (k * 90) + '"/>');
    });
    ys.forEach(function (y, k) {
      parts.push('<line class="sd-line" x1="0" y1="' + pct(y) + '" x2="100%" y2="' + pct(y) + '" pathLength="1" style="--d:' + (380 + k * 140) + '"/>');
    });
    if (braces) {
      var every = cols >= 6 ? 3 : 2, n = 0;
      for (var b = 0; b < cols - 1; b += every) {
        var lifts = [0].concat(ys).concat([100]);
        for (var l = 0; l < lifts.length - 1; l++) {
          var y1 = lifts[l], y2 = lifts[l + 1];
          var x1 = (l % 2 === 0) ? xs[b] : xs[b + 1], x2 = (l % 2 === 0) ? xs[b + 1] : xs[b];
          parts.push('<line class="sd-line sd-brace" x1="' + pct(x1) + '" y1="' + pct(y1) + '" x2="' + pct(x2) + '" y2="' + pct(y2) + '" pathLength="1" style="--d:' + (950 + n * 110) + '"/>');
          n++;
        }
      }
    }
    if (nodes) {
      xs.forEach(function (x, a) {
        ys.forEach(function (y, c) {
          parts.push('<rect class="sd-node" x="' + pct(x) + '" y="' + pct(y) + '" width="5" height="5" transform="translate(-2.5 -2.5)" style="--d:' + ((a + c) * 40) + '"/>');
        });
      });
    }
    return '<svg class="scaffold-draw' + (o.cls ? ' ' + h(o.cls) : '') + '" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" aria-hidden="true" focusable="false">' + parts.join('') + '</svg>';
  };

  /* ---------- Tabs ---------- */
  var tabsInstances = new WeakMap();
  ui.tabs = function (root) {
    if (!root) return null;
    if (tabsInstances.has(root)) return tabsInstances.get(root);
    var list = $('.tabs__list', root) || $('[role="tablist"]', root);
    if (!list) return null;
    var tabs = $$('.tabs__tab, [role="tab"]', list).filter(function (t, i, arr) { return arr.indexOf(t) === i; });
    if (!tabs.length) return null;
    var useHash = root.hasAttribute('data-tab-hash');
    list.setAttribute('role', 'tablist');
    function panelOf(tab) { var pid = tab.getAttribute('aria-controls'); return pid ? d.getElementById(pid) : null; }
    function keyOf(tab) { return tab.getAttribute('data-tab') || tab.getAttribute('aria-controls') || tab.id; }
    tabs.forEach(function (tab) {
      if (!tab.id) tab.id = util.uid('tab');
      tab.setAttribute('role', 'tab');
      if (tab.tagName === 'BUTTON' && !tab.getAttribute('type')) tab.setAttribute('type', 'button');
      var p = panelOf(tab);
      if (p) {
        p.setAttribute('role', 'tabpanel');
        p.setAttribute('aria-labelledby', tab.id);
        if (!p.hasAttribute('tabindex')) p.setAttribute('tabindex', '0');
      }
    });
    function find(id) {
      if (!id) return null;
      if (typeof id === 'object') return tabs.indexOf(id) !== -1 ? id : null;
      id = String(id).replace(/^#/, '');
      for (var i = 0; i < tabs.length; i++) {
        var t = tabs[i];
        if (keyOf(t) === id || t.id === id || t.getAttribute('aria-controls') === id) return t;
      }
      return null;
    }
    var current = null;
    function select(id, opts) {
      opts = opts || {};
      var tab = find(id);
      if (!tab) return false;
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', on ? 'true' : 'false');
        t.tabIndex = on ? 0 : -1;
        var p = panelOf(t);
        if (p) p.hidden = !on;
      });
      var changed = current !== tab;
      current = tab;
      if (opts.focus) tab.focus();
      if (useHash && opts.updateHash !== false) {
        try { w.history.replaceState(null, '', '#' + keyOf(tab)); } catch (e) { /* ignore */ }
      }
      var panel = panelOf(tab);
      if (panel) ui.reveal(panel);
      if (changed) root.dispatchEvent(new CustomEvent('tabs:change', { bubbles: true, detail: { key: keyOf(tab), tab: tab, panel: panel } }));
      return true;
    }
    list.addEventListener('click', function (e) {
      var t = e.target.closest('[role="tab"]');
      if (t && tabs.indexOf(t) !== -1) { e.preventDefault(); select(t); }
    });
    list.addEventListener('keydown', function (e) {
      var i = tabs.indexOf(d.activeElement);
      if (i === -1) return;
      var next = null;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = tabs[(i + 1) % tabs.length];
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (e.key === 'Home') next = tabs[0];
      else if (e.key === 'End') next = tabs[tabs.length - 1];
      if (next) { e.preventDefault(); select(next, { focus: true }); }
    });
    var initial = (useHash && find(w.location.hash)) ||
      tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
    select(initial, { updateHash: false });
    if (useHash) {
      w.addEventListener('hashchange', function () { select(w.location.hash, { updateHash: false }); });
    }
    var api = {
      el: root,
      select: function (id) { return select(id, {}); },
      get current() { return current ? keyOf(current) : null; }
    };
    tabsInstances.set(root, api);
    return api;
  };

  /* ---------- Accordion ---------- */
  /* An accordion is (re)scanned on every call (and before open/close/toggle): items added later —
     or the whole list rendered into an accordion that was still EMPTY at boot — are wired up then,
     each trigger exactly once. Indices of open/close/toggle follow the CURRENT item order. */
  var accInstances = new WeakMap();
  ui.accordion = function (root) {
    if (!root) return null;
    var inst = accInstances.get(root);
    var single = root.getAttribute('data-accordion') === 'single';
    var items = $$('.accordion__item', root).filter(function (it) { return it.closest('.accordion, [data-accordion]') === root || it.parentElement === root; });
    var pairs = items.map(function (item) {
      var trig = $('.accordion__trigger', item), panel = $('.accordion__panel', item);
      if (!trig || !panel) return null;
      if (trig.__accRoot === root && trig.__accPanel === panel) return { trig: trig, panel: panel };
      if (!trig.id) trig.id = util.uid('acc');
      if (!panel.id) panel.id = util.uid('accp');
      if (trig.tagName === 'BUTTON' && !trig.getAttribute('type')) trig.setAttribute('type', 'button');
      trig.setAttribute('aria-controls', panel.id);
      panel.setAttribute('role', 'region');
      panel.setAttribute('aria-labelledby', trig.id);
      var open = trig.getAttribute('aria-expanded') === 'true' && !panel.hasAttribute('data-closed');
      trig.setAttribute('aria-expanded', open ? 'true' : 'false');
      panel.hidden = !open;
      if (!$('.accordion__icon', trig)) trig.insertAdjacentHTML('beforeend', '<span class="accordion__icon" aria-hidden="true"></span>');
      var bound = !!trig.__accRoot;
      trig.__accRoot = root;
      trig.__accPanel = panel;
      if (!bound) {
        trig.addEventListener('click', function () {
          var api = accInstances.get(trig.__accRoot);
          if (api) api._setPair(trig, trig.getAttribute('aria-expanded') !== 'true');
        });
      }
      return { trig: trig, panel: panel };
    }).filter(Boolean);
    if (inst) { inst._pairs = pairs; return inst; }
    function setPair(p, open) {
      if (!p) return;
      if (open && single) api._pairs.forEach(function (q) { if (q !== p) { q.trig.setAttribute('aria-expanded', 'false'); q.panel.hidden = true; } });
      p.trig.setAttribute('aria-expanded', open ? 'true' : 'false');
      p.panel.hidden = !open;
      if (open) ui.reveal(p.panel);
    }
    function at(i) { ui.accordion(root); return api._pairs[i]; }
    var api = {
      el: root,
      _pairs: pairs,
      _setPair: function (trig, open) { setPair(api._pairs.filter(function (q) { return q.trig === trig; })[0], open); },
      open: function (i) { setPair(at(i), true); },
      close: function (i) { setPair(at(i), false); },
      toggle: function (i) { var p = at(i); if (p) setPair(p, p.trig.getAttribute('aria-expanded') !== 'true'); }
    };
    accInstances.set(root, api);
    return api;
  };

  /* ---------- OTP inputs (helper for .otp) ---------- */
  var otpInstances = new WeakMap();
  ui.otp = function (root, o) {
    if (!root) return null;
    if (otpInstances.has(root)) return otpInstances.get(root);
    o = o || {};
    var len = o.length || 6;
    var inputs = $$('.otp__input', root);
    if (!inputs.length) {
      var buf = '';
      for (var i = 0; i < len; i++) buf += '<input class="otp__input" type="text">';
      root.innerHTML = buf;
      inputs = $$('.otp__input', root);
    }
    len = inputs.length;
    if (!root.getAttribute('role')) root.setAttribute('role', 'group');
    function value() { return inputs.map(function (x) { return x.value; }).join(''); }
    function setFrom(index, digits) {
      for (var k = 0; k < digits.length && index + k < len; k++) inputs[index + k].value = digits.charAt(k);
      var next = Math.min(index + digits.length, len - 1);
      inputs[next].focus();
      check();
    }
    function check() {
      root.classList.remove('is-invalid');
      inputs.forEach(function (x) { x.classList.toggle('is-filled', !!x.value); });
      if (typeof o.onChange === 'function') o.onChange(value());
      var v = value();
      if (v.length === len && /^\d+$/.test(v) && typeof o.onComplete === 'function') o.onComplete(v);
    }
    inputs.forEach(function (inp, i) {
      inp.setAttribute('inputmode', 'numeric');
      inp.setAttribute('pattern', '[0-9]*');
      inp.setAttribute('autocomplete', i === 0 ? 'one-time-code' : 'off');
      inp.setAttribute('maxlength', i === 0 ? String(len) : '1');
      if (!inp.getAttribute('aria-label')) inp.setAttribute('aria-label', 'Digit ' + (i + 1) + ' dari ' + len);
      if (!inp.hasAttribute('placeholder')) inp.setAttribute('placeholder', ' ');
      inp.addEventListener('input', function () {
        var digits = inp.value.replace(/\D/g, '');
        if (digits.length > 1) { inp.value = ''; setFrom(i, digits.slice(0, len - i)); return; }
        inp.value = digits;
        if (digits && i < len - 1) inputs[i + 1].focus();
        check();
      });
      inp.addEventListener('keydown', function (e) {
        if (e.key === 'Backspace' && !inp.value && i > 0) { e.preventDefault(); inputs[i - 1].value = ''; inputs[i - 1].focus(); check(); }
        else if (e.key === 'ArrowLeft' && i > 0) { e.preventDefault(); inputs[i - 1].focus(); }
        else if (e.key === 'ArrowRight' && i < len - 1) { e.preventDefault(); inputs[i + 1].focus(); }
      });
      inp.addEventListener('focus', function () { try { inp.select(); } catch (e) { /* ignore */ } });
      inp.addEventListener('paste', function (e) {
        var text = ((e.clipboardData || w.clipboardData) && (e.clipboardData || w.clipboardData).getData('text')) || '';
        var digits = text.replace(/\D/g, '');
        if (digits) { e.preventDefault(); setFrom(digits.length >= len ? 0 : i, digits.slice(0, len)); }
      });
    });
    var api = {
      inputs: inputs,
      value: value,
      clear: function () { inputs.forEach(function (x) { x.value = ''; x.classList.remove('is-filled'); }); root.classList.remove('is-invalid'); },
      focus: function () { var f = inputs.filter(function (x) { return !x.value; })[0] || inputs[len - 1]; f.focus(); },
      setInvalid: function (bad) { root.classList.toggle('is-invalid', !!bad); },
      disable: function (dis) { inputs.forEach(function (x) { x.disabled = !!dis; }); }
    };
    otpInstances.set(root, api);
    return api;
  };

  /* ---------- Reveal / counters / split lines / scaffold / marquee / icons ---------- */
  var io = null;
  function getIO() {
    if (io) return io;
    if (!('IntersectionObserver' in w)) return null;
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var vh = w.innerHeight || 800;
        if (en.intersectionRatio >= 0.15 || en.intersectionRect.height >= Math.min(vh * 0.2, 160)) {
          io.unobserve(en.target);
          showEl(en.target);
        }
      });
    }, { threshold: [0, 0.05, 0.1, 0.15, 0.3], rootMargin: '0px 0px -4% 0px' });
    return io;
  }
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
  function prepareCounter(el) {
    if (el.__count) return;
    var raw = String(el.getAttribute('data-count') || '').trim().replace(',', '.');
    var target = parseFloat(raw);
    if (!isFinite(target)) return;
    var dec = (raw.split('.')[1] || '').length;
    var c = el.__count = {
      target: target, dec: dec,
      prefix: el.getAttribute('data-count-prefix') || '',
      suffix: el.getAttribute('data-count-suffix') || ''
    };
    var finalText = c.prefix + util.formatNumber(target, dec) + c.suffix;
    el.innerHTML = '<span class="count__value" aria-hidden="true"></span><span class="sr-only">' + h(finalText) + '</span>';
    c.node = el.firstChild;
    c.node.textContent = prefersReduced() ? finalText : c.prefix + util.formatNumber(0, dec) + c.suffix;
  }
  function runCounter(el) {
    var c = el.__count;
    if (!c || c.done) return;
    c.done = true;
    var finalText = c.prefix + util.formatNumber(c.target, c.dec) + c.suffix;
    if (prefersReduced() || !w.requestAnimationFrame) { c.node.textContent = finalText; return; }
    var t0 = null, dur = 1600;
    function frame(ts) {
      if (t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / dur);
      c.node.textContent = c.prefix + util.formatNumber(c.target * easeOutCubic(p), c.dec) + c.suffix;
      if (p < 1) w.requestAnimationFrame(frame); else c.node.textContent = finalText;
    }
    w.requestAnimationFrame(frame);
  }
  /* Split a .split-lines headline on <br>. Marked as done ONLY once it had content: an element
     that is still empty (filled later by a page script) stays pending and is split — and animated —
     on the next reveal() / when the safety-net observer sees its content arrive. */
  function prepareSplit(el) {
    if (el.__split) return true;
    if ($('.line', el)) { el.__split = true; el.__splitPending = false; return true; }
    var parts = el.innerHTML.split(/<br\s*\/?>/i).map(function (s) { return s.trim(); }).filter(function (s) { return s.length; });
    if (!parts.length) { el.__splitPending = true; return false; }
    el.__split = true;
    el.__splitPending = false;
    el.innerHTML = parts.map(function (p, i) { return '<span class="line" style="--i:' + i + '"><span>' + p + '</span></span>'; }).join(' ');
    return true;
  }
  function prepareStagger(el) {
    Array.prototype.forEach.call(el.children, function (c, i) { c.style.setProperty('--i', i); });
  }
  function showEl(el) {
    var delay = parseInt(el.getAttribute('data-reveal-delay') || '0', 10) || 0;
    if (delay) el.style.setProperty('--reveal-delay', delay + 'ms');
    if (el.hasAttribute('data-reveal-stagger')) prepareStagger(el);
    el.classList.add('is-visible');
    if (el.hasAttribute('data-count')) {
      if (delay && !prefersReduced()) setTimeout(function () { runCounter(el); }, delay);
      else runCounter(el);
    }
    if (el.hasAttribute('data-reveal') || el.hasAttribute('data-reveal-stagger')) {
      var n = el.hasAttribute('data-reveal-stagger') ? el.children.length : 1;
      if (prefersReduced()) el.classList.add('reveal-done');
      else setTimeout(function () { el.classList.add('reveal-done'); }, delay + 1250 + n * 80);
    }
  }
  /* querySelectorAll + the root itself when it matches (so reveal(el) also handles el) */
  function selfAndAll(sel, root) {
    var list = $$(sel, root);
    if (root && root.nodeType === 1 && root.matches && root.matches(sel)) list.unshift(root);
    return list;
  }
  function hydrateIcons(root) {
    selfAndAll('[data-icon]', root).forEach(function (el) {
      if (el.__icon) return;
      el.__icon = true;
      var label = el.getAttribute('data-icon-label');
      el.innerHTML = icon(el.getAttribute('data-icon'), { size: parseInt(el.getAttribute('data-icon-size') || '20', 10), label: label || undefined, cls: el.getAttribute('data-icon-class') || '' });
      if (!label) el.setAttribute('aria-hidden', 'true');
    });
  }
  /* data-hero-img="assets/img/x.webp" → --hero-img:url(<absolute>) (relative url() inside a custom
     property would resolve against main.css in Chromium, so we never write it relative) */
  /* Phones get the known -sm variant (a CSS background has no srcset): e.g. ringlock-pattern
     409 KB → 93 KB on a 390px band. Re-evaluated when the viewport crosses 768px. */
  var heroMq = w.matchMedia ? w.matchMedia('(max-width: 767px)') : null;
  var heroEls = [];
  function setHeroImg(el) {
    var src = el.getAttribute('data-hero-img');
    if (!src) return;
    var known = IMAGES[src.replace(/^\.\//, '')];
    if (known && known.sm && heroMq && heroMq.matches) src = known.sm;
    var abs;
    try { abs = new URL(src, d.baseURI).href; } catch (e) { abs = src; }
    el.style.setProperty('--hero-img', 'url("' + abs.replace(/"/g, '%22') + '")');
  }
  if (heroMq) {
    var onHeroMq = function () { heroEls = heroEls.filter(function (el) { return el.isConnected; }); heroEls.forEach(setHeroImg); };
    if (heroMq.addEventListener) heroMq.addEventListener('change', onHeroMq); else if (heroMq.addListener) heroMq.addListener(onHeroMq);
  }
  function applyHeroImages(root) {
    selfAndAll('[data-hero-img]', root).forEach(function (el) {
      if (el.__heroImg) return;
      el.__heroImg = true;
      heroEls.push(el);
      setHeroImg(el);
    });
  }
  function fillScaffolds(root) {
    selfAndAll('[data-scaffold]', root).forEach(function (el) {
      if (el.__scaffold || el.children.length) return;
      el.__scaffold = true;
      el.setAttribute('aria-hidden', 'true');
      el.innerHTML = ui.scaffoldSVG({
        cols: parseInt(el.getAttribute('data-cols') || '6', 10),
        rows: parseInt(el.getAttribute('data-rows') || '4', 10),
        braces: el.getAttribute('data-braces') !== 'false',
        nodes: el.getAttribute('data-nodes') !== 'false',
        cls: el.getAttribute('data-scaffold') || ''
      });
    });
  }
  /* Marquee semantics: the container gets role="marquee" (unless the page set a role), which also
     makes its aria-label valid (a label on a plain div is ignored/prohibited). The visual loop is
     built from clones that are aria-hidden AND inert (no duplicate reading, no duplicate tab stops),
     so assistive tech meets every item exactly once. Ids are stripped from clones. */
  function cloneForMarquee(n) {
    var c = n.cloneNode(true);
    c.setAttribute('aria-hidden', 'true');
    c.setAttribute('inert', '');
    c.setAttribute('data-marquee-clone', '');
    if (c.removeAttribute) c.removeAttribute('id');
    if (c.querySelectorAll) Array.prototype.forEach.call(c.querySelectorAll('[id]'), function (x) { x.removeAttribute('id'); });
    return c;
  }
  function initMarquee(el) {
    if (el.hasAttribute('data-marquee-ready')) return;
    var track = $('.marquee__track', el);
    if (!track || !track.children.length) return;
    if (!el.hasAttribute('role') && el.getAttribute('aria-hidden') !== 'true') el.setAttribute('role', 'marquee');
    var originals = Array.prototype.slice.call(track.children);
    var guard = 0;
    var width = el.clientWidth || w.innerWidth;
    while (track.scrollWidth < width && guard++ < 8) {
      originals.forEach(function (n) { track.appendChild(cloneForMarquee(n)); });
    }
    Array.prototype.slice.call(track.children).forEach(function (n) { track.appendChild(cloneForMarquee(n)); });
    el.setAttribute('data-marquee-ready', '');
  }
  /* "21–23" in a .date-block__day → .date-block--range (smaller numeral, never wraps) */
  function markDateRanges(root) {
    selfAndAll('.date-block', root).forEach(function (el) {
      if (el.classList.contains('date-block--range')) return;
      var day = $('.date-block__day', el);
      if (day && /\d\s*[‐-―-]\s*\d/.test(day.textContent || '')) el.classList.add('date-block--range');
    });
  }
  function autoInit(root) {
    selfAndAll('[data-tabs]', root).forEach(function (el) { ui.tabs(el); });
    selfAndAll('[data-accordion]', root).forEach(function (el) { ui.accordion(el); });
    /* items rendered INTO an existing accordion: refresh the enclosing one too */
    if (root && root.nodeType === 1 && root.parentElement) {
      var acc = root.parentElement.closest('[data-accordion]');
      if (acc && accInstances.has(acc)) ui.accordion(acc);
    }
    selfAndAll('.marquee', root).forEach(initMarquee);
    markDateRanges(root);
  }

  /* Safety net: content inserted after boot WITHOUT a ui.reveal() call is still registered
     (otherwise [data-reveal] stays at opacity 0 and [data-icon] stays empty). Page scripts
     should still call ui.reveal(container) after rendering — it is idempotent.
     Also covers containers that were EMPTY at boot and filled later: an empty .split-lines whose
     text arrives afterwards, and .accordion__item elements added into an existing [data-accordion]. */
  var AUTO_SEL = '[data-reveal], [data-reveal-stagger], [data-count], .split-lines, .scaffold-draw, [data-icon], [data-scaffold], [data-hero-img], .marquee, [data-tabs], [data-accordion], .date-block, .accordion__item';
  var autoQueue = [], autoScheduled = false;
  function flushAutoReveal() {
    autoScheduled = false;
    var nodes = autoQueue.splice(0, autoQueue.length);
    var seen = typeof Set === 'function' ? new Set() : null;
    for (var i = 0; i < nodes.length; i++) {
      var n = nodes[i];
      if (!n.isConnected) continue;
      if (seen) { if (seen.has(n)) continue; seen.add(n); }
      try { if (n.matches(AUTO_SEL) || n.querySelector(AUTO_SEL)) ui.reveal(n); }
      catch (e) { console.error('[PPAPI] Gagal menyiapkan konten dinamis:', e); }
    }
  }
  function startAutoReveal() {
    if (!('MutationObserver' in w) || !d.body || startAutoReveal.on) return;
    startAutoReveal.on = true;
    new MutationObserver(function (records) {
      for (var i = 0; i < records.length; i++) {
        var added = records[i].addedNodes, target = records[i].target;
        for (var j = 0; j < added.length; j++) if (added[j].nodeType === 1) autoQueue.push(added[j]);
        /* text/children put into a .split-lines that was empty when it was first seen */
        if (added.length && target && target.nodeType === 1 && target.__splitPending) autoQueue.push(target);
      }
      if (autoQueue.length && !autoScheduled) { autoScheduled = true; setTimeout(flushAutoReveal, 0); }
    }).observe(d.body, { childList: true, subtree: true });
  }

  /** Register dynamic content: icons, scaffold slots, marquee, tabs/accordions, reveals, counters, split lines. */
  ui.reveal = function (root) {
    root = root || d;
    if (root.nodeType !== 1 && root.nodeType !== 9) return;
    hydrateIcons(root);
    applyHeroImages(root);
    fillScaffolds(root);
    autoInit(root);
    var sel = '[data-reveal], [data-reveal-stagger], [data-count], .split-lines, .scaffold-draw';
    var targets = $$(sel, root);
    if (root.nodeType === 1 && root.matches && root.matches(sel)) targets.unshift(root);
    var reduce = prefersReduced(), obs = reduce ? null : getIO();
    targets.forEach(function (el) {
      /* an empty .split-lines is not observed/revealed yet (it would be "shown" with nothing in
         it and its later lines would never animate) — it waits until it has content */
      if (el.classList.contains('split-lines') && !prepareSplit(el) &&
          !el.hasAttribute('data-reveal') && !el.hasAttribute('data-count')) return;
      if (el.hasAttribute('data-count')) prepareCounter(el);
      if (el.hasAttribute('data-reveal-stagger')) prepareStagger(el);
      if (el.classList.contains('is-visible') || el.__observed) return;
      if (!obs) { showEl(el); return; }
      el.__observed = true;
      obs.observe(el);
    });
  };

  /* ========================================================================
     LAYOUT — header, footer, nav, account, mobile menu, demo ribbon
     ======================================================================== */
  var layout = PPAPI.layout = {};
  var signingOut = false;

  function cfg() { return PPAPI.config || {}; }
  /* A person's name, else the e-mail's local part, else "Anggota". A phone number is never used as a
     name (it would show as "+62" with initials "68"); it appears as the sub-line instead. */
  function displayName(user) {
    if (!user) return '';
    return String(user.name || '').trim() || (user.email ? String(user.email).split('@')[0] : '') || 'Anggota';
  }
  /* initials from LETTERS only; nothing usable → "A" (same fallback as the dashboard / member page) */
  function userInitials(user) {
    var ini = util.initials(String(displayName(user)).replace(/[^A-Za-zÀ-ɏ\s]/g, ' '));
    return ini || 'A';
  }
  function avatarHtml(user, cls) {
    /* only an https photo (Google profile picture); anything else (javascript:, data:, http:) falls back to initials */
    var photo = user && /^https:\/\/[^\s<>"']+$/i.test(String(user.photoURL || '')) ? String(user.photoURL) : '';
    var inner = photo
      ? '<img src="' + h(photo) + '" alt="" referrerpolicy="no-referrer">'
      : h(userInitials(user));
    return '<span class="avatar' + (cls ? ' ' + cls : '') + '" aria-hidden="true">' + inner + '</span>';
  }

  function socialLinks(cls) {
    var s = cfg().social || {};
    var names = { instagram: 'Instagram', linkedin: 'LinkedIn', youtube: 'YouTube', facebook: 'Facebook' };
    return Object.keys(names).filter(function (k) { return s[k] && /^https?:\/\//i.test(String(s[k]).trim()); }).map(function (k) {
      return '<a class="' + (cls || '') + '" href="' + h(s[k]) + '" target="_blank" rel="noopener" aria-label="' + names[k] + ' PPAPI (tab baru)">' + icon(k, { size: 18 }) + '</a>';
    }).join('');
  }

  function renderHeader() {
    var host = d.getElementById('site-header');
    if (!host) return;
    var c = cfg(), page = d.body.getAttribute('data-page') || '';
    var nav = Array.isArray(c.nav) ? c.nav : [];
    var short = c.shortName || 'PPAPI';
    /* the item of this page — or, for a sub-page (aktifJuga, e.g. regulasi under Pengetahuan), its parent */
    function current(n) {
      if (n.key === page) return ' aria-current="page"';
      return Array.isArray(n.aktifJuga) && n.aktifJuga.indexOf(page) !== -1 ? ' aria-current="true"' : '';
    }
    var links = nav.map(function (n) {
      return '<li><a class="site-nav__link" href="' + h(n.href) + '"' + current(n) + '>' + h(n.label) + '</a></li>';
    }).join('');
    var mlinks = nav.map(function (n, i) {
      return '<li style="--i:' + i + '"><a class="mobile-menu__link" href="' + h(n.href) + '"' + current(n) + '>' +
        '<span class="index-num">' + util.pad(i + 1) + '</span><span class="mobile-menu__label">' + h(n.label) + '</span></a></li>';
    }).join('');
    host.innerHTML =
      '<header class="site-header">' +
        '<div class="container site-header__bar">' +
          '<a class="brand" href="index.html" aria-label="' + h(short) + ' — Beranda"><img class="brand__logo" src="assets/img/logo-light-mark.webp" alt="' + h(short) + '" width="360" height="125" decoding="async"></a>' +
          '<nav class="site-nav" aria-label="Navigasi utama"><ul class="site-nav__list">' + links + '</ul></nav>' +
          '<div class="site-header__actions">' +
            '<div class="account" data-account><span class="account__skeleton" aria-hidden="true"></span></div>' +
            '<button type="button" class="menu-toggle" aria-expanded="false" aria-controls="mobile-menu" aria-label="Buka menu navigasi">' +
              '<span class="menu-toggle__label" aria-hidden="true">Menu</span><span class="menu-toggle__lines" aria-hidden="true"><span></span><span></span></span>' +
            '</button>' +
          '</div>' +
        '</div>' +
        '<div class="demo-ribbon" data-demo-ribbon hidden>' +
          '<div class="container demo-ribbon__inner">' +
            '<span class="demo-ribbon__label">Mode Demo</span>' +
            '<p class="demo-ribbon__text"><span class="sr-only">Mode Demo — </span>' +
              '<span class="demo-ribbon__long">Akun dan data hanya tersimpan di peramban ini dan belum terhubung ke sistem keanggotaan PPAPI.</span>' +
              '<span class="demo-ribbon__short">Data hanya tersimpan di peramban ini.</span></p>' +
            '<button type="button" class="demo-ribbon__close" data-ribbon-close aria-label="Tutup pemberitahuan Mode Demo">' + icon('close', { size: 16 }) + '</button>' +
          '</div>' +
        '</div>' +
      '</header>' +
      '<div class="mobile-menu" id="mobile-menu" role="dialog" aria-label="Menu navigasi">' +
        ui.scaffoldSVG({ cols: 4, rows: 6, braces: true, cls: 'mobile-menu__scaffold' }) +
        '<div class="container mobile-menu__inner">' +
          '<nav aria-label="Navigasi utama (seluler)"><ul class="mobile-menu__list">' + mlinks + '</ul></nav>' +
          '<div class="mobile-menu__foot">' +
            '<div class="mobile-menu__actions" data-mobile-account></div>' +
            '<div class="mobile-menu__meta"><span>' + h(c.fullName || '') + '</span>' +
              (socialLinks('icon-btn icon-btn--round') ? '<span class="cluster">' + socialLinks('icon-btn icon-btn--round') + '</span>' : '') +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
  }

  function renderFooter() {
    var host = d.getElementById('site-footer');
    if (!host) return;
    var c = cfg(), ct = c.contact || {};
    var groups = c.footerLinks || {};
    var cols = Object.keys(groups).map(function (title) {
      var items = Array.isArray(groups[title]) ? groups[title] : [];
      return '<div class="site-footer__col"><h2 class="site-footer__col-title">' + h(title) + '</h2><ul class="site-footer__links">' +
        items.map(function (l) { return '<li><a href="' + h(l.href) + '">' + h(l.label) + '</a></li>'; }).join('') + '</ul></div>';
    }).join('');
    function row(ic, inner) { return '<div class="site-footer__contact-row">' + icon(ic, { size: 16 }) + '<span>' + inner + '</span></div>'; }
    var rows = [];
    if (ct.address || ct.city) rows.push(row('map-pin', h(ct.address || '') + (ct.address && ct.city ? '<br>' : '') + h(ct.city || '')));
    else rows.push('<p class="site-footer__note">Alamat sekretariat akan segera diperbarui.</p>');
    if (ct.phone) rows.push(row('phone', '<a href="tel:' + h(String(ct.phone).replace(/[^\d+]/g, '')) + '">' + h(ct.phone) + '</a>'));
    if (ct.whatsapp) rows.push(row('whatsapp', '<a href="https://wa.me/' + h(String(ct.whatsapp).replace(/\D/g, '')) + '" target="_blank" rel="noopener">WhatsApp ' + h(util.formatPhoneID(ct.whatsapp) || ct.whatsapp) + '</a>'));
    if (ct.email) rows.push(row('mail', '<a href="mailto:' + h(ct.email) + '">' + h(ct.email) + '</a>'));
    (Array.isArray(ct.hours) ? ct.hours : []).forEach(function (x) { if (x && (x.hari || x.jam)) rows.push(row('clock', h(x.hari || '') + (x.hari && x.jam ? ' · ' : '') + h(x.jam || ''))); });
    rows.push('<a class="btn btn--link btn--sm" href="umpan-balik.html"><span>Hubungi kami</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a>');
    var social = socialLinks('');
    var year = new Date().getFullYear();
    host.innerHTML =
      '<footer class="site-footer">' +
        ui.scaffoldSVG({ cols: 9, rows: 3, braces: true, cls: 'site-footer__scaffold' }) +
        '<div class="container">' +
          '<div class="site-footer__top">' +
            '<div class="site-footer__brand">' +
              '<a href="index.html" aria-label="' + h(c.shortName || 'PPAPI') + ' — Beranda"><img class="site-footer__logo" src="assets/img/logo-light-sm.webp" srcset="assets/img/logo-light-sm.webp 480w, assets/img/logo-light.png 1200w" sizes="127px" alt="' + h(c.shortName || 'PPAPI') + '" width="480" height="167" loading="lazy" decoding="async"></a>' +
              (c.tagline ? '<p class="site-footer__tagline">' + util.emphasis(c.tagline) + '</p>' : '') +
              (c.description ? '<p class="site-footer__desc">' + h(c.description) + '</p>' : '') +
              (social ? '<div class="site-footer__social">' + social + '</div>' : '') +
            '</div>' +
            '<div class="site-footer__cols">' + cols +
              '<div class="site-footer__col"><h2 class="site-footer__col-title">Sekretariat</h2><address class="site-footer__contact">' + rows.join('') + '</address></div>' +
            '</div>' +
          '</div>' +
          '<div class="site-footer__wordmark" aria-hidden="true">' + h(c.shortName || 'PPAPI') + '</div>' +
          '<div class="site-footer__bottom">' +
            /* Kredit pengembang: satu-satunya bentuk yang disetujui klien (10 Oktober 2026) — jangan diubah. */
            '<span class="site-footer__legal">' +
              '<span>© ' + year + ' ' + h(c.shortName || 'PPAPI') + ' — ' + h(c.fullName || '') + '</span>' +
              '<span class="site-footer__credit">Dikembangkan oleh <span translate="no">mrezahuzain@2026</span></span>' +
            '</span>' +
            '<span class="site-footer__bottom-links">' +
              '<a href="kebijakan-privasi.html">Kebijakan Privasi</a>' +
              '<a href="verifikasi.html">Verifikasi Anggota</a>' +
              '<button type="button" class="to-top" data-scroll-top>Kembali ke atas' + icon('arrow-up', { size: 16 }) + '</button>' +
            '</span>' +
          '</div>' +
        '</div>' +
      '</footer>';
  }

  function renderAccount() {
    var box = $('[data-account]'), mob = $('[data-mobile-account]');
    var auth = PPAPI.auth;
    var user = auth && typeof auth.current === 'function' ? auth.current() : null;
    if (!user) {
      if (box) box.innerHTML = '<div class="account__guest">' +
        '<a class="btn btn--ghost btn--sm" href="masuk.html"><span>Masuk</span></a>' +
        '<a class="btn btn--primary btn--sm" href="masuk.html#daftar"><span>Daftar</span></a></div>';
      if (mob) mob.innerHTML = '<a class="btn btn--ghost" href="masuk.html"><span>Masuk</span></a>' +
        '<a class="btn btn--primary" href="masuk.html#daftar"><span>Daftar</span></a>';
      return;
    }
    var name = displayName(user);
    var sub = user.email || util.formatPhoneID(user.phone) || '';
    var first = user.name ? name.split(/\s+/)[0] : name;
    /* membership-aware items (SPEC v2 §3.1); until the session for THIS user is known only Dasbor + Keluar */
    var s = sessionFor(user);
    function item(href, ic, label) {
      return '<a class="account-menu__item" role="menuitem" href="' + href + '">' + icon(ic, { size: 18 }) + '<span>' + label + '</span></a>';
    }
    var items = item('dashboard.html', 'grid', 'Dasbor');
    if (s && s.isActive) {
      items += item('anggota.html', 'user', 'Profil Anggota') +
        item('pustaka.html', 'book', 'Produk Pengetahuan') +
        item('anggota.html#aplikasi', 'compass', 'Aplikasi Anggota');
    } else if (s) {
      items += item('pendaftaran.html', 'file-text', 'Formulir Pendaftaran');
    }
    /* untuk setiap akun (21 Okt 2026): kegiatan yang diikuti (bagian dasbor) dan pesanan Toko */
    if (s) items += item('dashboard.html#kegiatan-saya', 'calendar', 'Kegiatan Saya') + item('pesanan.html', 'briefcase', 'Pesanan Saya');
    if (s && s.isAdmin) items += item('admin.html', 'shield-check', 'Konsol Admin');
    var badges = '';
    if (s) {
      if (s.isAdmin) badges += '<span class="badge badge--metal">Admin</span>';
      if (s.status && !(s.isAdmin && !s.isMemberActive)) badges += util.statusBadge(s.status);
    }
    if (box) box.innerHTML =
      '<button type="button" class="account__trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="account-menu">' +
        avatarHtml(user) + '<span class="account__name">' + h(first) + '</span>' + icon('chevron-down', { size: 16, cls: 'account__chev' }) +
        '<span class="sr-only">Menu akun ' + h(name) + '</span>' +
      '</button>' +
      '<div class="account-menu" id="account-menu" hidden>' +
        '<div class="account-menu__head">' + avatarHtml(user, 'avatar--md') +
          '<div class="account-menu__who"><div class="account-menu__name">' + h(name) + '</div>' +
          (sub ? '<div class="account-menu__sub">' + h(sub) + '</div>' : '') +
          (badges ? '<div class="account-menu__status">' + badges + '</div>' : '') + '</div></div>' +
        '<div role="menu" aria-label="Menu akun">' + items +
          '<div class="account-menu__sep" role="separator"></div>' +
          '<button type="button" class="account-menu__item" role="menuitem" data-signout>' + icon('logout', { size: 18 }) + '<span>Keluar</span></button>' +
        '</div>' +
      '</div>';
    if (mob) mob.innerHTML = '<a class="btn btn--ghost" href="dashboard.html"><span>Dasbor</span></a>' +
      '<button type="button" class="btn btn--primary" data-signout><span>Keluar</span></button>';
  }
  layout.renderAccount = renderAccount;

  /* account dropdown */
  function accountOpen() { var t = $('.account__trigger'); return !!(t && t.getAttribute('aria-expanded') === 'true'); }
  function setAccount(open, focusFirst) {
    var trig = $('.account__trigger'), menu = $('#account-menu');
    if (!trig || !menu) return;
    /* never on top of the full-screen menu (its foot repeats the account actions) */
    if (open && menuState.open) setMenu(false, false);
    trig.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.hidden = !open;
    if (open) {
      var hd = $('.site-header');
      if (hd) hd.classList.remove('is-hidden');
      if (focusFirst) { var first = $('[role="menuitem"]', menu); if (first) first.focus(); }
    }
  }
  layout.closeAccountMenu = function () { setAccount(false); };

  /* mobile menu */
  var menuState = { open: false };
  function setMenu(open, restoreFocus) {
    var btn = $('.menu-toggle'), menu = $('#mobile-menu');
    if (!btn || !menu || menuState.open === open) return;
    menuState.open = open;
    menu.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    btn.setAttribute('aria-label', open ? 'Tutup menu navigasi' : 'Buka menu navigasi');
    var lbl = $('.menu-toggle__label', btn);
    if (lbl) lbl.textContent = open ? 'Tutup' : 'Menu';
    setLockClass('menu-open', open);
    /* everything outside the dialog is inert — including the header account area, which sits
       between the logo and the toggle in tab order (it is repeated in the menu foot) */
    ['main', '#site-footer', '.skip-link', '.site-header [data-account]'].forEach(function (s) {
      var el = $(s);
      if (el) { if (open) el.setAttribute('inert', ''); else el.removeAttribute('inert'); }
    });
    if (open) {
      var hd = $('.site-header');
      if (hd) hd.classList.remove('is-hidden');
      setAccount(false);
      var svg = $('.scaffold-draw', menu);
      if (svg && !prefersReduced()) { svg.classList.remove('is-visible'); void svg.getBoundingClientRect(); svg.classList.add('is-visible'); }
      setTimeout(function () { var l = $('.mobile-menu__link', menu); if (l) l.focus({ preventScroll: true }); }, 60);
    } else if (restoreFocus !== false) {
      btn.focus({ preventScroll: true });
    }
  }
  layout.closeMenu = function () { setMenu(false, false); };

  function initHeaderBehaviour() {
    var header = $('.site-header');
    if (!header) return;
    var forced = d.body.getAttribute('data-header') === 'solid';
    var lastY = w.pageYOffset || 0, ticking = false;
    function update() {
      ticking = false;
      var y = Math.max(0, w.pageYOffset || 0);
      header.classList.toggle('is-solid', forced || y > 40);
      var lock = menuState.open || accountOpen() || !!header.querySelector(':focus-visible');
      if (y > 400 && y > lastY + 4 && !lock) header.classList.add('is-hidden');
      else if (y < lastY - 4 || y <= 400) header.classList.remove('is-hidden');
      lastY = y;
    }
    w.addEventListener('scroll', function () { if (!ticking) { ticking = true; w.requestAnimationFrame(update); } }, { passive: true });
    header.addEventListener('focusin', function () { header.classList.remove('is-hidden'); });
    update();

    var toggle = $('.menu-toggle');
    if (toggle) toggle.addEventListener('click', function () { setMenu(!menuState.open); });
    var menu = $('#mobile-menu');
    if (menu) menu.addEventListener('click', function (e) { if (e.target.closest('a[href]')) setMenu(false, false); });
    d.addEventListener('keydown', function (e) {
      if (menuState.open) {
        if (e.key === 'Escape') { e.preventDefault(); setMenu(false); }
        else if (e.key === 'Tab') {
          /* the cycle in DOM order: header controls that are still usable (logo, toggle, ribbon
             close) followed by the menu itself */
          var list = focusables($('.site-header')).concat(focusables($('#mobile-menu')));
          trapTab(e, list);
        }
      }
    });
    if (w.matchMedia) {
      var mq = w.matchMedia('(min-width: 1120px)');
      var onMq = function () { if (mq.matches) setMenu(false, false); };
      if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
    }
  }

  /* Visitors read a plain notice; the maintainer hint (how to switch Demo off) goes to the console.
     html.has-demo-ribbon may already be set by an early inline snippet in <head> (reserves the 40px
     before first paint, see README); it is confirmed or removed here. */
  function initRibbon() {
    var auth = PPAPI.auth, mode = d.body.getAttribute('data-auth');
    var rib = $('[data-demo-ribbon]');
    var demo = !!(auth && auth.mode === 'demo');
    if (demo && w.console && console.info) console.info('[PPAPI] Mode Demo aktif: akun dan data hanya tersimpan di peramban. Isi PPAPI_CONFIG.firebase di assets/js/config.js (lihat README.md, bagian Firebase) untuk mengaktifkan login sebenarnya.');
    var show = !!(rib && demo && (mode === 'guest' || mode === 'required' || mode === 'active' || mode === 'admin') && !util.storage.get('ppapi_demo_ribbon_dismissed', false));
    if (rib) rib.hidden = !show;
    html.classList.toggle('has-demo-ribbon', show);
  }

  /* ---- sign-out vs. unsaved changes ----
     Signing out of a members-only page navigates away, so unsaved edits must be settled FIRST
     (asking afterwards via the browser's "Leave site?" would leave a signed-out page on screen).
     1. Pages may listen to the cancelable `ppapi:beforesignout` event on document: call
        e.preventDefault() to stop, or e.detail.waitUntil(promise) — resolving false stops.
     2. Otherwise the page's own beforeunload guard is probed with a synthetic event; when it
        objects, a confirmation is shown here.
     Once the user has confirmed and the session has ended, the page's beforeunload guard is
     bypassed, the gated content is hidden at once, and the browser leaves the page.
     The bypass listener must be registered BEFORE the page's own guard (listeners on window run
     in registration order), so it is added as soon as core.js runs — on members-only pages only
     (elsewhere a beforeunload listener would cost Firefox's back/forward cache for nothing). */
  var bypassUnloadGuard = false, unloadBypassOn = false;
  function ensureUnloadBypass() {
    if (unloadBypassOn || !d.body || !isMembersGate(d.body.getAttribute('data-auth'))) return;
    unloadBypassOn = true;
    w.addEventListener('beforeunload', function (e) { if (bypassUnloadGuard) e.stopImmediatePropagation(); }, true);
  }
  ensureUnloadBypass();
  function bypassUnloadGuards() { bypassUnloadGuard = true; }
  function pageHasUnsavedChanges() {
    var ev;
    try { ev = d.createEvent('BeforeUnloadEvent'); ev.initEvent('beforeunload', false, true); }
    catch (er) { ev = new Event('beforeunload', { cancelable: true }); }
    try { w.dispatchEvent(ev); } catch (er) { return false; }
    return !!(ev.defaultPrevented || ev.returnValue === false || (typeof ev.returnValue === 'string' && ev.returnValue !== ''));
  }
  async function confirmSignOut(req) {
    var waits = [];
    var ev = new CustomEvent('ppapi:beforesignout', { cancelable: true, detail: { waitUntil: function (p) { waits.push(Promise.resolve(p)); } } });
    d.dispatchEvent(ev);
    if (ev.defaultPrevented) return false;
    if (waits.length) {
      var answers = await Promise.all(waits.map(function (p) { return p.catch(function () { return false; }); }));
      return answers.every(function (a) { return a !== false; });
    }
    if (req && pageHasUnsavedChanges()) {
      return ui.confirm('Perubahan yang belum disimpan di halaman ini akan hilang jika Anda keluar sekarang.', {
        title: 'Keluar tanpa menyimpan?', okLabel: 'Keluar tanpa menyimpan', cancelLabel: 'Kembali', danger: true
      });
    }
    return true;
  }

  async function doSignOut() {
    var auth = PPAPI.auth;
    if (!auth || typeof auth.signOut !== 'function' || signingOut) return;
    var req = isMembersGate(d.body.getAttribute('data-auth'));
    setAccount(false);
    setMenu(false, false);
    if (!(await confirmSignOut(req))) return;
    signingOut = true;
    try {
      await auth.signOut();
      if (req) {
        /* the member's data must not stay on screen (shared computers): re-gate immediately */
        d.body.classList.remove('auth-ready');
        bypassUnloadGuards();
        ui.flash('Anda telah keluar. Sampai jumpa kembali.', { type: 'success' });
        w.location.href = 'index.html';
        /* safety net: should anything still keep the browser here, go to the sign-in page */
        setTimeout(function () { w.location.replace(loginUrl()); }, 4000);
      } else {
        ui.toast('Anda telah keluar. Sampai jumpa kembali.', { type: 'success' });
        signingOut = false;
      }
    } catch (e) {
      signingOut = false;
      ui.toast((e && e.message) || 'Gagal keluar. Silakan coba lagi.', { type: 'error' });
    }
  }

  /* global delegated behaviours (work for dynamic content too) */
  function initDelegates() {
    d.addEventListener('click', function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var trig = t.closest('.account__trigger');
      if (trig) { e.preventDefault(); setAccount(!accountOpen(), e.detail === 0); return; }
      if (accountOpen() && !t.closest('#account-menu')) setAccount(false);
      if (t.closest('[data-signout]')) { e.preventDefault(); doSignOut(); return; }
      var rc = t.closest('[data-ribbon-close]');
      if (rc) {
        var rib = rc.closest('[data-demo-ribbon]');
        if (rib) rib.hidden = true;
        html.classList.remove('has-demo-ribbon');
        util.storage.set('ppapi_demo_ribbon_dismissed', true);
        return;
      }
      var pt = t.closest('.password-toggle__btn');
      if (pt) {
        e.preventDefault();
        var wrap = pt.closest('.password-toggle'), input = wrap && $('input', wrap);
        if (!input) return;
        var show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        pt.setAttribute('aria-pressed', show ? 'true' : 'false');
        pt.setAttribute('aria-label', show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
        pt.innerHTML = icon(show ? 'eye-off' : 'eye', { size: 20 });
        return;
      }
      var seg = t.closest('[data-segmented] .segmented__option');
      if (seg && seg.tagName === 'BUTTON') {
        var group = seg.closest('[data-segmented]');
        $$('.segmented__option', group).forEach(function (o) { o.setAttribute('aria-pressed', o === seg ? 'true' : 'false'); });
        group.dispatchEvent(new CustomEvent('segmented:change', { bubbles: true, detail: { value: seg.getAttribute('data-value') || seg.textContent.trim(), option: seg } }));
        return;
      }
      var clr = t.closest('.search-box__clear');
      if (clr) {
        var box = clr.closest('.search-box'), inp = box && $('input', box);
        if (inp) { inp.value = ''; inp.dispatchEvent(new Event('input', { bubbles: true })); inp.focus(); }
        return;
      }
      if (t.closest('[data-scroll-top]')) {
        e.preventDefault();
        w.scrollTo({ top: 0, behavior: prefersReduced() ? 'auto' : 'smooth' });
        var main = d.getElementById('main');
        if (main) setTimeout(function () { try { main.focus({ preventScroll: true }); } catch (er) { /* ignore */ } }, prefersReduced() ? 0 : 500);
        return;
      }
      var cp = t.closest('[data-copy]');
      if (cp) {
        e.preventDefault();
        util.copyText(cp.getAttribute('data-copy')).then(function (ok) {
          ui.toast(ok ? (cp.getAttribute('data-copy-message') || 'Tautan berhasil disalin.') : 'Gagal menyalin. Salin secara manual.', { type: ok ? 'success' : 'error' });
        });
      }
    });
    d.addEventListener('keydown', function (e) {
      if (!accountOpen()) return;
      var menu = $('#account-menu');
      var items = $$('[role="menuitem"]', menu);
      var i = items.indexOf(d.activeElement);
      if (e.key === 'Escape') { e.preventDefault(); setAccount(false); var tr = $('.account__trigger'); if (tr) tr.focus(); }
      else if (e.key === 'ArrowDown') { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
      else if (e.key === 'Tab' && i !== -1) { setAccount(false); }
    });
    d.addEventListener('keydown', function (e) {
      var trig = e.target && e.target.closest && e.target.closest('.account__trigger');
      if (trig && e.key === 'ArrowDown') { e.preventDefault(); setAccount(true, true); }
    });
    d.addEventListener('keydown', onRatingKey);
  }

  /* .rating__stars: inputs are in DESCENDING DOM order (5…1) laid out row-reverse, so the browser's
     native ←/→ (DOM order) would move opposite to what the eye sees. Remap ←/→ to the VISUAL
     neighbour (→ = next star to the right = higher value). ↑/↓ stay native (↑ = higher). The radio
     is chosen with .click(), which checks it and fires input + change exactly like the native key. */
  function onRatingKey(e) {
    var t = e.target;
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (!t || t.type !== 'radio' || !t.parentElement || !t.parentElement.classList.contains('rating__stars')) return;
    var box = t.parentElement, cs = w.getComputedStyle(box);
    var rtl = cs.direction === 'rtl';
    /* DOM step that moves one star to the RIGHT on screen vs. what the browser does natively */
    var rightStep = (/reverse/.test(cs.flexDirection) !== rtl) ? -1 : 1;
    if (rightStep === (rtl ? -1 : 1)) return; /* visual order = native order: nothing to fix */
    var radios = Array.prototype.filter.call(box.children, function (x) {
      return x.tagName === 'INPUT' && x.type === 'radio' && x.name === t.name && !x.disabled;
    });
    var i = radios.indexOf(t);
    if (i < 0 || radios.length < 2) return;
    var step = e.key === 'ArrowRight' ? rightStep : -rightStep;
    var next = radios[(i + step + radios.length) % radios.length];
    e.preventDefault();
    try { next.focus({ preventScroll: true }); } catch (er) { next.focus(); }
    next.click();
  }

  /* ========================================================================
     SESSION — who is viewing, their (effective) membership status and role
     PPAPI.session.ready()   → Promise<Session> (cached)
     PPAPI.session.current() → Session (synchronous copy; empty defaults before ready)
     PPAPI.session.refresh() → Promise<Session> (re-reads member + admin role, then notifies)
     PPAPI.session.onChange(cb) → unsubscribe; cb(Session) after an auth change or a refresh
     Session = { user, member, isAdmin, status (effective), statusLabel,
                 isActive (member Aktif OR admin), isMemberActive (strictly the member) }
     ======================================================================== */
  var session = PPAPI.session = {};
  function emptySession() {
    return { user: null, member: null, isAdmin: false, status: '', statusLabel: '', isActive: false, isMemberActive: false };
  }
  var sess = { state: emptySession(), resolved: false, promise: null, seq: 0, listeners: [], wired: false };
  function cloneJson(o) { return o === null || o === undefined ? o : JSON.parse(JSON.stringify(o)); }
  /* resolved session of exactly this user, or null (used to avoid showing a previous user's menu) */
  function sessionFor(user) {
    var st = sess.state;
    return sess.resolved && user && st.user && st.user.uid === user.uid ? st : null;
  }
  async function computeSession() {
    var auth = PPAPI.auth, store = PPAPI.store;
    if (auth && typeof auth.ready === 'function') { try { await auth.ready(); } catch (e) { /* treated as signed out */ } }
    var user = auth && typeof auth.current === 'function' ? auth.current() : null;
    if (!user) return emptySession();
    var member = null, isAdmin = false;
    if (store && typeof store.getMember === 'function') {
      try { member = await store.getMember(user.uid, { pasFoto: false }); }   /* no image on every page */
      catch (e) {
        /* a computation overtaken by a sign-out / account switch is discarded anyway: stay quiet */
        var now = auth && typeof auth.current === 'function' ? auth.current() : null;
        if (now && now.uid === user.uid) console.warn('[PPAPI] Data keanggotaan belum dapat dibaca:', e && e.message);
      }
    }
    if (auth && typeof auth.isAdmin === 'function') {
      try { isAdmin = !!(await auth.isAdmin()); } catch (e) { isAdmin = false; }
    }
    var status = member ? util.effectiveStatus(member) : 'Draf';
    var memberActive = status === 'Aktif';
    return {
      user: user, member: member, isAdmin: isAdmin, status: status, statusLabel: util.statusLabel(status),
      isActive: memberActive || isAdmin, isMemberActive: memberActive
    };
  }
  function notifySession() {
    var snap = session.current();
    sess.listeners.slice().forEach(function (cb) { try { cb(snap); } catch (e) { console.error(e); } });
  }
  function runSession(notify) {
    var my = ++sess.seq;
    var p = computeSession().then(function (st) {
      if (my === sess.seq) {
        sess.state = st;
        sess.resolved = true;
        if (notify) notifySession();
      }
      return my === sess.seq ? cloneJson(st) : sess.promise;
    });
    sess.promise = p;
    return p;
  }
  function wireSession() {
    if (sess.wired || !PPAPI.auth || typeof PPAPI.auth.onChange !== 'function') return;
    sess.wired = true;
    PPAPI.auth.onChange(function () { runSession(true); });
  }
  session.ready = function () {
    wireSession();
    if (!sess.promise) runSession(false);
    return sess.promise.then(cloneJson);
  };
  session.current = function () { return cloneJson(sess.state); };
  session.isResolved = function () { return sess.resolved; };
  session.refresh = function () {
    wireSession();
    if (PPAPI.auth && typeof PPAPI.auth._clearAdminCache === 'function') PPAPI.auth._clearAdminCache();
    return runSession(true).then(cloneJson);
  };
  session.onChange = function (cb) {
    if (typeof cb !== 'function') return function () {};
    sess.listeners.push(cb);
    return function () { var i = sess.listeners.indexOf(cb); if (i !== -1) sess.listeners.splice(i, 1); };
  };

  /* ========================================================================
     BOOT & onReady
     ======================================================================== */
  var queue = [], isReady = false, booted = false;
  function stubAuth() {
    return {
      mode: 'none',
      ready: function () { return Promise.resolve(null); },
      current: function () { return null; },
      onChange: function () { return function () {}; },
      signOut: function () { return Promise.resolve(); }
    };
  }
  async function runReady(fn) {
    try { await fn(); }
    catch (e) {
      console.error('[PPAPI] Kesalahan pada skrip halaman:', e);
      ui.toast('Terjadi kendala saat memuat sebagian halaman. Silakan muat ulang.', { type: 'error' });
    }
  }
  /** Run fn after DOM ready + header/footer injected + PPAPI.auth.ready() resolved. */
  PPAPI.onReady = function (fn) {
    if (typeof fn !== 'function') return;
    if (isReady) Promise.resolve().then(function () { return runReady(fn); });
    else queue.push(fn);
  };
  PPAPI.isReady = function () { return isReady; };

  function withTimeout(p, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('timeout')); }, ms);
      Promise.resolve(p).then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
    });
  }
  function loginUrl() {
    return 'masuk.html?next=' + encodeURIComponent(util.fileName() + w.location.search + w.location.hash);
  }

  /* <link rel="canonical"> and og:url (+ an absolute og:image) built from config.siteUrl when it is
     filled in, otherwise from the address the page is opened at. Only ?id= survives (it selects
     the content, e.g. berita.html?id=…); filters/search params and #hash are dropped.
     Skipped on noindex pages; tags a page wrote itself are never overwritten. */
  function applyCanonical() {
    var head = d.head;
    if (!head) return;
    var robots = $('meta[name="robots"]', head);
    if (robots && /noindex/i.test(robots.getAttribute('content') || '')) return;
    if (!/^https?:$/.test(w.location.protocol)) return;
    var file = util.fileName();
    if (file === '404.html') return;
    var id = util.qs('id');
    var path = (file === 'index.html' ? '' : file) + (id ? '?id=' + encodeURIComponent(id) : '');
    var url = util.siteBase() ? util.siteUrl(path) : new URL(path || './', w.location.href).href;
    function ensure(sel, make) { var el = $(sel, head); if (!el) { el = make(); head.appendChild(el); el.setAttribute('data-ppapi-auto', ''); } return el; }
    var link = ensure('link[rel="canonical"]', function () { var l = d.createElement('link'); l.rel = 'canonical'; return l; });
    if (link.hasAttribute('data-ppapi-auto')) link.href = url;
    var og = ensure('meta[property="og:url"]', function () { var m = d.createElement('meta'); m.setAttribute('property', 'og:url'); return m; });
    if (og.hasAttribute('data-ppapi-auto')) og.setAttribute('content', url);
    var img = $('meta[property="og:image"]', head);
    var src = img && img.getAttribute('content');
    if (src && !/^[a-z][a-z0-9+.\-]*:/i.test(src)) img.setAttribute('content', util.siteUrl(src));
  }

  /* gated page kinds: 'required' (signed in), 'active' (active member or admin), 'admin' (admin only) */
  function isMembersGate(g) { return g === 'required' || g === 'active' || g === 'admin'; }
  var GATE_MSG = {
    active: 'Fitur ini khusus anggota berstatus Aktif.',
    admin: 'Halaman ini khusus admin PPAPI.'
  };
  /* signed in, but this page needs more (active membership / admin role) → dasbor with a flash toast */
  function gateDenied(gate, s) {
    if (gate === 'active') return !s.isActive;
    if (gate === 'admin') return !s.isAdmin;
    return false;
  }
  function leaveGate(gate) {
    d.body.classList.remove('auth-ready');
    bypassUnloadGuards();
    ui.flash(GATE_MSG[gate], { type: 'warn', timeout: 6000 });
    w.location.replace('dashboard.html');
  }

  async function boot() {
    if (booted) return;
    booted = true;
    var body = d.body;
    var gate = body.getAttribute('data-auth') || 'public';
    if (!PPAPI.auth) PPAPI.auth = stubAuth();
    if (isMembersGate(gate)) body.classList.add('auth-pending');
    ensureUnloadBypass(); /* in case core.js ran before <body> existed */

    try { renderHeader(); renderFooter(); } catch (e) { console.error('[PPAPI] Gagal menyusun header/footer:', e); }
    try { applyCanonical(); } catch (e) { /* metadata only — never block the page */ }
    try { initHeaderBehaviour(); initRibbon(); initDelegates(); } catch (e) { console.error('[PPAPI] Gagal menyiapkan navigasi:', e); }
    try { ui.reveal(d); } catch (e) { console.error('[PPAPI] Gagal menyiapkan animasi:', e); }
    try { getToastRegion(); startAutoReveal(); } catch (e) { /* ignore */ }
    showFlash();

    var user = null;
    try { user = await withTimeout(PPAPI.auth.ready(), 20000); }
    catch (e) { console.warn('[PPAPI] Status login tidak dapat dipastikan:', e && e.message); user = null; }

    if (isMembersGate(gate) && !user) { w.location.replace(loginUrl()); return; }
    if (gate === 'guest' && user) { w.location.replace(util.safeNext(util.qs('next'), 'dashboard.html')); return; }

    /* membership + role (PPAPI.session) — page scripts can read PPAPI.session.current() synchronously */
    var s = emptySession();
    try { s = await withTimeout(session.ready(), 20000); }
    catch (e) { console.warn('[PPAPI] Status keanggotaan tidak dapat dipastikan:', e && e.message); }
    if (user && gateDenied(gate, s)) { leaveGate(gate); return; }

    body.classList.remove('auth-pending');
    body.classList.add('auth-ready');
    try { renderAccount(); } catch (e) { console.error(e); }
    try {
      PPAPI.auth.onChange(function (u) {
        try { renderAccount(); } catch (er) { console.error(er); }
        if (isMembersGate(gate) && !u && !signingOut) w.location.replace(loginUrl());
      });
      session.onChange(function (st) {
        try { renderAccount(); } catch (er) { console.error(er); }
        if (st.user && !signingOut && gateDenied(gate, st)) leaveGate(gate);
      });
    } catch (e) { /* stub */ }

    isReady = true;
    var fns = queue.splice(0, queue.length);
    for (var i = 0; i < fns.length; i++) await runReady(fns[i]);
    try { ui.reveal(d); } catch (e) { /* ignore */ }
    try { deferredHashScroll(); } catch (e) { /* ignore */ }
  }

  /* Deferred #fragment jump for content pages whose sections are rendered from data (berita, pustaka,
     keanggotaan). The browser's own jump lands on the layout BEFORE those sections are rendered, which then
     push the target away (CLS ≈ 1,0 measured on desktop with reduced motion, release QA 2026-10-09). An inline
     snippet in the page <head> removes a listed fragment early and keeps it in window.__ppHash; once every
     onReady script has run and the web fonts are ready (≤ 1 s), the page scrolls to the target — unless the
     visitor (or a page script) has scrolled meanwhile — and the fragment is put back in the address. */
  function deferredHashScroll() {
    var hash = w.__ppHash;
    if (!hash || typeof hash !== 'string') return;
    w.__ppHash = '';
    var done = false;
    function go() {
      if (done) return;
      done = true;
      w.requestAnimationFrame(function () {
        w.requestAnimationFrame(function () {
          var el = null;
          try { el = d.getElementById(decodeURIComponent(hash.slice(1))); } catch (e) { el = null; }
          if (el && (w.scrollY || 0) < 2) el.scrollIntoView({ block: 'start' });
          try { if (!w.location.hash) w.history.replaceState(w.history.state, '', w.location.pathname + w.location.search + hash); } catch (e) { /* file:// */ }
        });
      });
    }
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(go, go); else go();
    setTimeout(go, 1000);
  }

  PPAPI.motion = { prefersReduced: prefersReduced, reveal: function (r) { return ui.reveal(r); } };

  if (d.readyState === 'complete') setTimeout(boot, 0);
  else {
    d.addEventListener('DOMContentLoaded', boot);
    w.addEventListener('load', boot);
  }
})(window, document);
