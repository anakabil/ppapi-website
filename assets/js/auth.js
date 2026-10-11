/* ==========================================================================
   PPAPI auth.js — PPAPI.auth
   Two modes, same API:
   • 'firebase' — when PPAPI_CONFIG.firebase.apiKey is filled. Loads the
     Firebase compat SDK on demand (app → auth → firestore, sequentially).
   • 'demo'     — otherwise. Accounts live in this browser only
     (localStorage 'ppapi_demo_users', session 'ppapi_demo_session').
   Every method returns a Promise; failures throw Error with an Indonesian
   .message and a Firebase-style .code (e.g. 'auth/invalid-credential').
   v2: auth.isAdmin() (Firebase: admins/{uid} exists · demo: ppapi_demo_admins),
   demo seed (admin@ppapi.demo + 4 contoh members, key ppapi_demo_seed_v2),
   auth.postSignUpTarget = 'pendaftaran.html'.
   Email verification (Firebase): signUpEmail() sends the verification mail; user.emailVerified tells
   whether the address is proven (Google accounts are). Only a verified address is copied into the
   member record (rules: email_verified) — admins are added by that address. auth.sendEmailVerification()
   resends it; auth.refreshUser() picks up a verification done in the mail (also run on page load).
   Demo accounts have no mailbox and count as verified.
   ========================================================================== */
(function (w, d) {
  'use strict';

  var PPAPI = w.PPAPI = w.PPAPI || {};
  if (PPAPI.auth && PPAPI.auth.__real) return;
  var cfg = w.PPAPI_CONFIG || {};
  var fbCfg = cfg.firebase || {};
  var MODE = fbCfg.apiKey ? 'firebase' : 'demo';
  var DEMO_OTP = '123456';
  var K_USERS = 'ppapi_demo_users';
  var K_SESSION = 'ppapi_demo_session';

  /* ---------------- Indonesian error messages ---------------- */
  var MESSAGES = {
    'auth/email-already-in-use': 'Alamat email ini sudah terdaftar. Silakan masuk, atau gunakan fitur “Lupa kata sandi?”.',
    'auth/invalid-email': 'Format alamat email tidak valid. Periksa kembali penulisannya.',
    'auth/missing-email': 'Alamat email wajib diisi.',
    'auth/weak-password': 'Kata sandi terlalu lemah. Gunakan minimal 8 karakter dengan kombinasi huruf dan angka.',
    'auth/missing-password': 'Kata sandi wajib diisi.',
    'auth/invalid-credential': 'Email atau kata sandi tidak sesuai. Silakan periksa kembali.',
    'auth/invalid-login-credentials': 'Email atau kata sandi tidak sesuai. Silakan periksa kembali.',
    'auth/wrong-password': 'Email atau kata sandi tidak sesuai. Silakan periksa kembali.',
    'auth/user-not-found': 'Email atau kata sandi tidak sesuai. Jika belum memiliki akun, silakan daftar terlebih dahulu.',
    'auth/user-disabled': 'Akun ini telah dinonaktifkan. Silakan hubungi Sekretariat PPAPI.',
    'auth/too-many-requests': 'Terlalu banyak percobaan. Demi keamanan, silakan coba lagi beberapa saat lagi.',
    'auth/network-request-failed': 'Koneksi internet bermasalah. Periksa jaringan Anda, lalu coba lagi.',
    'auth/popup-closed-by-user': 'Jendela masuk Google ditutup sebelum proses selesai. Silakan coba lagi.',
    'auth/cancelled-popup-request': 'Permintaan masuk dibatalkan karena ada jendela masuk lain yang sedang terbuka.',
    'auth/popup-blocked': 'Jendela masuk Google diblokir oleh peramban. Izinkan pop-up untuk situs ini, lalu coba lagi.',
    'auth/invalid-phone-number': 'Nomor HP tidak valid. Gunakan format Indonesia, misalnya 0812-3456-7890.',
    'auth/missing-phone-number': 'Nomor HP wajib diisi.',
    'auth/invalid-verification-code': 'Kode OTP tidak sesuai. Periksa kembali 6 digit kode pada SMS Anda.',
    'auth/missing-verification-code': 'Kode OTP wajib diisi.',
    'auth/missing-verification-id': 'Sesi verifikasi tidak ditemukan. Silakan kirim ulang kode OTP.',
    'auth/code-expired': 'Kode OTP sudah kedaluwarsa. Silakan kirim ulang kode.',
    'auth/quota-exceeded': 'Batas pengiriman SMS sedang tercapai. Silakan coba lagi nanti atau gunakan metode masuk lain.',
    'auth/captcha-check-failed': 'Verifikasi keamanan (reCAPTCHA) gagal. Muat ulang halaman, lalu coba lagi.',
    'auth/operation-not-allowed': 'Metode masuk ini belum tersedia. Silakan gunakan metode lain atau hubungi Sekretariat PPAPI.',
    'auth/unauthorized-domain': 'Domain situs ini belum diizinkan untuk proses masuk. Mohon hubungi pengelola situs.',
    'auth/requires-recent-login': 'Demi keamanan, silakan masuk kembali sebelum melanjutkan tindakan ini.',
    'auth/account-exists-with-different-credential': 'Email ini sudah terdaftar dengan metode masuk lain. Silakan masuk menggunakan metode yang pernah Anda gunakan.',
    'auth/billing-not-enabled': 'Layanan verifikasi melalui SMS belum aktif. Silakan masuk menggunakan email atau akun Google.',
    'auth/operation-not-supported-in-this-environment': 'Fitur masuk ini tidak didukung di lingkungan peramban saat ini. Buka situs melalui alamat https dan pastikan penyimpanan situs diizinkan.',
    'auth/invalid-api-key': 'Konfigurasi layanan masuk tidak valid. Mohon hubungi pengelola situs.',
    'auth/missing-name': 'Nama lengkap wajib diisi (minimal 3 karakter).',
    'auth/email-already-verified': 'Alamat email akun ini sudah terverifikasi.',
    'auth/no-email': 'Akun ini tidak menggunakan alamat email.',
    'auth/no-current-user': 'Anda belum masuk. Silakan masuk terlebih dahulu.',
    'auth/sdk-load-failed': 'Layanan masuk tidak dapat dimuat. Periksa koneksi internet Anda, lalu muat ulang halaman.',
    'default': 'Terjadi kendala saat memproses permintaan Anda. Silakan coba lagi.'
  };

  function authError(code, cause) {
    var e = new Error(MESSAGES[code] || MESSAGES['default']);
    e.code = code || 'auth/unknown';
    e.__ppapi = true;
    if (cause) e.cause = cause;
    return e;
  }
  function mapError(err) {
    if (err && err.__ppapi) return err;
    var code = err && err.code ? String(err.code) : '';
    if (code && code.indexOf('auth/') !== 0 && MESSAGES['auth/' + code]) code = 'auth/' + code;
    if (/api-key/.test(code)) code = 'auth/invalid-api-key';           // e.g. auth/api-key-not-valid.-please-pass-a-valid-api-key.
    if (/invalid-login-credentials/.test(code)) code = 'auth/invalid-credential';
    return authError(code || 'default', err);
  }

  /* ---------------- helpers (no hard dependency on core.js) ---------------- */
  function U() { return PPAPI.util || {}; }
  function normPhone(s) {
    if (U().normalizePhoneID) return U().normalizePhoneID(s);
    var t = String(s || '').replace(/[\s\-().]/g, '').replace(/^\+/, '');
    if (t.indexOf('62') === 0) t = t.slice(2); else if (t.charAt(0) === '0') t = t.slice(1);
    return /^8\d{8,11}$/.test(t) ? '+62' + t : null;
  }
  function isEmail(s) {
    if (U().isEmail) return U().isEmail(s);
    return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(String(s || '').trim());
  }
  function maskPhone(e164) {
    if (U().maskPhone) return U().maskPhone(e164);
    return e164 ? e164.slice(0, 6) + '••••' + e164.slice(-4) : '';
  }
  function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function read(store, key, fallback) {
    try { var raw = store.getItem(key); return raw === null ? fallback : JSON.parse(raw); } catch (e) { return fallback; }
  }
  function write(store, key, val) { try { store.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }
  function remove(store, key) { try { store.removeItem(key); } catch (e) { /* ignore */ } }
  var LS = (function () { try { return w.localStorage; } catch (e) { return null; } })();
  var SS = (function () { try { return w.sessionStorage; } catch (e) { return null; } })();
  var memStore = { _d: {}, getItem: function (k) { return k in this._d ? this._d[k] : null; }, setItem: function (k, v) { this._d[k] = String(v); }, removeItem: function (k) { delete this._d[k]; } };
  var local = LS || memStore, session = SS || memStore;

  function cleanName(n) { return String(n || '').replace(/\s+/g, ' ').trim().slice(0, 120); }
  function validateEmail(email) {
    email = String(email || '').trim().toLowerCase();
    if (!email) throw authError('auth/missing-email');
    if (!isEmail(email)) throw authError('auth/invalid-email');
    return email;
  }
  function validatePasswordForSignUp(pw) {
    pw = String(pw || '');
    if (!pw) throw authError('auth/missing-password');
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw authError('auth/weak-password');
    return pw;
  }

  /* SHA-256 hex (crypto.subtle) — fallback hash prefixed 'fb:' where unavailable */
  function hex(buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join('');
  }
  function fallbackHash(str) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57, out = '';
    for (var round = 0; round < 4; round++) {
      for (var i = 0; i < str.length; i++) {
        var ch = str.charCodeAt(i) + round;
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
      }
      h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
      h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
      out += ('00000000' + (h1 >>> 0).toString(16)).slice(-8) + ('00000000' + (h2 >>> 0).toString(16)).slice(-8);
    }
    return 'fb:' + out;
  }
  function hashPassword(key, password, like) {
    var input = 'ppapi:' + key + ':' + password;
    var subtle = w.crypto && w.crypto.subtle;
    if ((like && String(like).indexOf('fb:') === 0) || !subtle || !w.TextEncoder) return Promise.resolve(fallbackHash(input));
    return subtle.digest('SHA-256', new TextEncoder().encode(input)).then(hex, function () { return fallbackHash(input); });
  }

  /* ---------------- state ---------------- */
  var current = null;
  var listeners = [];
  var readyPromise = null;
  function copy(u) { return u ? JSON.parse(JSON.stringify(u)) : null; }
  function notify() {
    var u = copy(current);
    listeners.slice().forEach(function (cb) { try { cb(u); } catch (e) { console.error(e); } });
  }
  /* updateName() also renames the member record so header (auth) and member card (store) agree */
  async function syncMemberName(uid, name) {
    try {
      if (uid && PPAPI.store && typeof PPAPI.store.saveMember === 'function') await PPAPI.store.saveMember(uid, { name: name });
    } catch (e) {
      /* after approval the member record keeps the reviewed name (store/identity-locked): only the
         account's display name changes — expected, not an error */
      if (e && e.code === 'store/identity-locked') return;
      console.warn('[PPAPI] Nama pada data anggota belum diperbarui:', e && e.message);
    }
  }
  async function ensure(user) {
    try {
      if (user && PPAPI.store && typeof PPAPI.store.ensureMember === 'function') await PPAPI.store.ensureMember(user);
    } catch (e) {
      console.warn('[PPAPI] Data anggota belum dapat disiapkan:', e && e.message);
    }
  }

  /* ======================================================================
     DEMO MODE
     ====================================================================== */
  function demoUsers() { var u = read(local, K_USERS, {}); return u && typeof u === 'object' ? u : {}; }
  function saveDemoUsers(map) { write(local, K_USERS, map); }
  function readSession() {
    var s = read(session, K_SESSION, null) || read(local, K_SESSION, null);
    return s && s.uid ? s : null;
  }
  function publicUser(rec) {
    return {
      uid: rec.uid, name: rec.name || '', email: rec.email || '', phone: rec.phone || '',
      /* demo: no mailbox to prove the address — counts as verified */
      emailVerified: !!rec.email,
      photoURL: rec.photoURL || '', provider: rec.provider || 'password', createdAt: rec.createdAt || new Date().toISOString()
    };
  }
  function setSession(user, remember) {
    remove(session, K_SESSION);
    remove(local, K_SESSION);
    if (user) write(remember === false ? session : local, K_SESSION, user);
    current = user ? copy(user) : null;
  }
  function newUid() { return 'demo-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
  function findUserBy(field, value) {
    var map = demoUsers(), keys = Object.keys(map);
    for (var i = 0; i < keys.length; i++) if (map[keys[i]] && map[keys[i]][field] === value) return { key: keys[i], rec: map[keys[i]] };
    return null;
  }
  function updateDemoRecord(uid, patch) {
    var map = demoUsers(), changed = false;
    Object.keys(map).forEach(function (k) {
      if (map[k] && map[k].uid === uid) { Object.assign(map[k], patch); changed = true; }
    });
    if (changed) saveDemoUsers(map);
  }

  var pendingPhone = null; // { phone, sentAt }

  function demoGoogleDialog() {
    return new Promise(function (resolve, reject) {
      var ui = PPAPI.ui;
      if (!ui || typeof ui.modal !== 'function') { reject(authError('auth/operation-not-supported-in-this-environment')); return; }
      var settled = false;
      var body =
        '<p>Pada situs yang telah terhubung dengan Firebase, tombol ini membuka jendela resmi Google untuk memilih akun. ' +
        'Dalam <strong>Mode Demo</strong>, isi nama dan alamat Gmail Anda untuk menyimulasikan proses tersebut — tidak ada data yang dikirim ke Google.</p>' +
        '<form class="form" novalidate data-demo-google>' +
          '<div class="field"><label class="field__label" for="dg-name">Nama lengkap</label>' +
            '<input class="field__control" id="dg-name" name="name" autocomplete="name" required aria-describedby="dg-name-err">' +
            '<p class="field__error" id="dg-name-err">Nama lengkap wajib diisi (minimal 3 karakter).</p></div>' +
          '<div class="field"><label class="field__label" for="dg-email">Alamat Gmail</label>' +
            '<input class="field__control" id="dg-email" name="email" type="email" inputmode="email" autocomplete="email" placeholder="nama@gmail.com" required aria-describedby="dg-email-err">' +
            '<p class="field__error" id="dg-email-err">Masukkan alamat email Google yang valid, misalnya nama@gmail.com.</p></div>' +
          '<button type="submit" hidden></button>' +
        '</form>';
      var modal;
      function submit() {
        var root = modal && modal.el;
        if (!root) return false;
        var nameEl = root.querySelector('#dg-name'), emailEl = root.querySelector('#dg-email');
        var name = cleanName(nameEl.value), email = String(emailEl.value || '').trim().toLowerCase();
        var okName = name.length >= 3, okEmail = isEmail(email);
        nameEl.closest('.field').classList.toggle('is-invalid', !okName);
        emailEl.closest('.field').classList.toggle('is-invalid', !okEmail);
        nameEl.setAttribute('aria-invalid', okName ? 'false' : 'true');
        emailEl.setAttribute('aria-invalid', okEmail ? 'false' : 'true');
        if (!okName) { nameEl.focus(); return false; }
        if (!okEmail) { emailEl.focus(); return false; }
        settled = true;
        resolve({ name: name, email: email });
        return true;
      }
      modal = ui.modal({
        title: 'Simulasi Masuk dengan Google',
        eyebrow: 'Mode Demo',
        size: 'sm',
        body: body,
        actions: [
          { label: 'Batal', variant: 'ghost' },
          { label: 'Lanjutkan', variant: 'primary', onClick: function () { return submit() ? undefined : false; } }
        ],
        onOpen: function (el) {
          var form = el.querySelector('[data-demo-google]');
          form.addEventListener('submit', function (e) { e.preventDefault(); if (submit()) modal.close(); });
        },
        onClose: function () { if (!settled) { settled = true; reject(authError('auth/popup-closed-by-user')); } }
      });
    });
  }

  /* ---------------- Demo seed (SPEC v2 §2) ----------------
     Once per browser (versioned key ppapi_demo_seed_v2): the demo ADMIN account and 4 sample
     applicants/members (contoh) so the admin console is never empty. Robust to check.mjs --admin,
     which pre-sets only ppapi_demo_session + ppapi_demo_admins: the admin's ppapi_demo_users entry is
     (re)created whenever it is missing, belongs to another uid, or has no valid password hash. */
  var K_ADMINS = 'ppapi_demo_admins';
  var K_SEED = 'ppapi_demo_seed_v2';
  var DEMO_ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', password: 'AdminPPAPI2026', createdAt: '2026-01-05T01:00:00.000Z' };
  function validHash(x) { return typeof x === 'string' && (/^[0-9a-f]{64}$/.test(x) || /^fb:[0-9a-f]{64}$/.test(x)); }
  function demoMember(o) {
    var app = o.application || {};
    return {
      uid: o.uid, name: o.name, email: o.email || '', phone: o.phone || '', photoURL: '',
      kta: o.kta || '', memberType: o.memberType || 'Praktisi', status: o.status || 'Draf',
      joinedAt: o.joinedAt || '', validUntil: o.validUntil || '', approvedAt: o.approvedAt || '', approvedBy: o.approvedBy || '',
      profile: Object.assign({ birthPlace: '', birthDate: '', gender: '', city: '', province: '', address: '', company: '', position: '', experienceYears: null, education: '', bio: '', linkedin: '' }, o.profile || {}),
      competencies: o.competencies || [], certificates: o.certificates || [],
      application: {
        type: app.type || 'baru', kategori: app.kategori || '', submittedAt: app.submittedAt || '', updatedAt: app.updatedAt || app.submittedAt || '',
        pengalaman: app.pengalaman || [], dokumen: app.dokumen || [], pasFoto: '',
        pembayaran: { metode: '', tanggal: '', buktiUrl: '' },
        pernyataan: app.pernyataan || { kodeEtik: false, kebenaranData: false, privasi: false, namaTerang: '', tanggal: '' },
        catatan: app.catatan || ''
      },
      review: o.review || { note: '', history: [] },
      contoh: !!o.contoh,
      createdAt: o.createdAt, updatedAt: o.updatedAt || o.createdAt
    };
  }
  function sampleMembers() {
    var A = DEMO_ADMIN.uid, AN = DEMO_ADMIN.name;
    var yes = function (nama, tgl) { return { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: nama, tanggal: tgl }; };
    return [
      demoMember({
        uid: 'demo-contoh-0001', name: 'Bagus Pratama (Contoh)', email: 'bagus.pratama@ppapi.demo', phone: '+6280000000101',
        status: 'Menunggu Verifikasi', joinedAt: '2026-09-28', createdAt: '2026-09-28T02:10:00.000Z', updatedAt: '2026-10-06T03:20:00.000Z',
        profile: { birthPlace: 'Samarinda', birthDate: '1991-04-12', gender: 'Laki-laki', province: 'Kalimantan Timur', city: 'Samarinda', address: 'Jl. Contoh Raya No. 1', company: 'PT Contoh Rangka Baja', position: 'Mandor Scaffolding', experienceYears: 7, education: 'SMA / SMK / Sederajat' },
        competencies: [{ id: 'k-c1-1', code: 'SCF-05', name: 'Teknisi Scaffolding', level: 'Mahir', since: 2019, notes: '' }],
        certificates: [{ id: 'c-c1-1', title: 'Teknisi Scaffolding', number: 'CONTOH/TS/2023/001', issuer: 'BNSP / LSP', issuedAt: '2023-05-10', expiresAt: '2028-05-10', link: '' }],
        application: {
          type: 'baru', kategori: 'Praktisi', submittedAt: '2026-10-06T03:20:00.000Z',
          pengalaman: [
            { id: 'p-c1-1', proyek: 'Pembangunan gedung perkantoran 18 lantai (contoh)', peran: 'Mandor pemasangan perancah', tahun: '2024', lokasi: 'Balikpapan' },
            { id: 'p-c1-2', proyek: 'Pemeliharaan tangki timbun (contoh)', peran: 'Teknisi perancah', tahun: '2022', lokasi: 'Bontang' }
          ],
          dokumen: [
            { id: 'd-c1-1', jenis: 'CV', label: 'Daftar riwayat hidup', url: 'https://example.com/contoh/cv-bagus-pratama.pdf' },
            { id: 'd-c1-2', jenis: 'Sertifikat', label: 'Sertifikat Teknisi Scaffolding', url: 'https://example.com/contoh/sertifikat-teknisi.pdf' }
          ],
          pernyataan: yes('Bagus Pratama', '2026-10-06'),
          catatan: 'Bersedia mengikuti wawancara atau verifikasi lanjutan bila diperlukan.'
        },
        review: { note: '', history: [{ at: '2026-10-06T03:20:00.000Z', by: 'demo-contoh-0001', byName: 'Bagus Pratama (Contoh)', action: 'diajukan', note: '' }] },
        contoh: true
      }),
      demoMember({
        uid: 'demo-contoh-0002', name: 'Sari Wulandari (Contoh)', email: 'sari.wulandari@ppapi.demo', phone: '+6280000000102',
        memberType: 'Praktisi', status: 'Perlu Perbaikan', joinedAt: '2026-09-20', createdAt: '2026-09-20T07:00:00.000Z', updatedAt: '2026-10-02T04:00:00.000Z',
        profile: { birthPlace: 'Surabaya', birthDate: '1987-09-03', gender: 'Perempuan', province: 'Jawa Timur', city: 'Surabaya', company: 'CV Contoh Konsultan K3', position: 'Ahli K3 Konstruksi', experienceYears: 11, education: 'Sarjana (S1)' },
        competencies: [{ id: 'k-c2-1', code: 'SCF-13', name: 'Ahli K3 Konstruksi (Muda, Madya, Utama)', level: 'Ahli', since: 2016, notes: '' }],
        application: {
          type: 'baru', kategori: 'Ahli', submittedAt: '2026-09-30T02:00:00.000Z',
          pengalaman: [{ id: 'p-c2-1', proyek: 'Pengawasan K3 proyek jembatan (contoh)', peran: 'Ahli K3', tahun: '2025', lokasi: 'Gresik' }],
          pernyataan: yes('Sari Wulandari', '2026-09-30')
        },
        review: {
          note: 'Mohon lampirkan tautan sertifikat Ahli K3 Konstruksi yang masih berlaku dan lengkapi riwayat proyek perancah.',
          history: [
            { at: '2026-09-30T02:00:00.000Z', by: 'demo-contoh-0002', byName: 'Sari Wulandari (Contoh)', action: 'diajukan', note: '' },
            { at: '2026-10-02T04:00:00.000Z', by: A, byName: AN, action: 'perbaikan', note: 'Mohon lampirkan tautan sertifikat Ahli K3 Konstruksi yang masih berlaku dan lengkapi riwayat proyek perancah.' }
          ]
        },
        contoh: true
      }),
      demoMember({
        uid: 'demo-contoh-0003', name: 'Dimas Haryanto (Contoh)', email: 'dimas.haryanto@ppapi.demo', phone: '+6280000000103',
        kta: 'PPAPI-2025-000318', memberType: 'Ahli', status: 'Aktif', joinedAt: '2025-11-14', validUntil: '2028-12-31',
        approvedAt: '2025-11-14T03:00:00.000Z', approvedBy: A, createdAt: '2025-11-03T01:00:00.000Z', updatedAt: '2025-11-14T03:00:00.000Z',
        profile: { birthPlace: 'Bandung', birthDate: '1983-02-21', gender: 'Laki-laki', province: 'Jawa Barat', city: 'Bandung', company: 'PT Contoh Rekayasa Struktur', position: 'Perancang Perancah', experienceYears: 15, education: 'Sarjana (S1)' },
        competencies: [{ id: 'k-c3-1', code: 'SCF-08', name: 'Perancang Scaffolding', level: 'Ahli', since: 2014, notes: '' }],
        application: {
          type: 'baru', kategori: 'Ahli', submittedAt: '2025-11-05T02:00:00.000Z',
          pengalaman: [{ id: 'p-c3-1', proyek: 'Perancah gantung renovasi fasad (contoh)', peran: 'Perancang perancah', tahun: '2023', lokasi: 'Jakarta' }],
          pernyataan: yes('Dimas Haryanto', '2025-11-05')
        },
        review: {
          note: '',
          history: [
            { at: '2025-11-05T02:00:00.000Z', by: 'demo-contoh-0003', byName: 'Dimas Haryanto (Contoh)', action: 'diajukan', note: '' },
            { at: '2025-11-14T03:00:00.000Z', by: A, byName: AN, action: 'disetujui', note: 'Data lengkap dan sesuai.' }
          ]
        },
        contoh: true
      }),
      demoMember({
        uid: 'demo-contoh-0004', name: 'Andi Saputra (Contoh)', email: 'andi.saputra@ppapi.demo', phone: '+6280000000104',
        status: 'Ditolak', joinedAt: '2026-08-11', createdAt: '2026-08-11T05:00:00.000Z', updatedAt: '2026-08-25T06:00:00.000Z',
        profile: { birthPlace: 'Makassar', birthDate: '1998-12-01', gender: 'Laki-laki', province: 'Sulawesi Selatan', city: 'Makassar', company: 'Pekerja lepas', position: 'Pembantu tukang', experienceYears: 1, education: 'SMA / SMK / Sederajat' },
        application: {
          type: 'baru', kategori: 'Praktisi', submittedAt: '2026-08-18T02:00:00.000Z',
          pernyataan: yes('Andi Saputra', '2026-08-18')
        },
        review: {
          note: 'Riwayat pekerjaan di bidang perancah belum dapat diverifikasi. Silakan ajukan kembali dengan dokumen pendukung yang lengkap.',
          history: [
            { at: '2026-08-18T02:00:00.000Z', by: 'demo-contoh-0004', byName: 'Andi Saputra (Contoh)', action: 'diajukan', note: '' },
            { at: '2026-08-25T06:00:00.000Z', by: A, byName: AN, action: 'ditolak', note: 'Riwayat pekerjaan di bidang perancah belum dapat diverifikasi. Silakan ajukan kembali dengan dokumen pendukung yang lengkap.' }
          ]
        },
        contoh: true
      })
    ];
  }
  async function seedDemo() {
    try {
      var users = demoUsers(), rec = users[DEMO_ADMIN.email];
      if (!rec || rec.uid !== DEMO_ADMIN.uid || !validHash(rec.hash)) {
        users[DEMO_ADMIN.email] = {
          uid: DEMO_ADMIN.uid, name: DEMO_ADMIN.name, email: DEMO_ADMIN.email, phone: '', photoURL: '', provider: 'password',
          createdAt: DEMO_ADMIN.createdAt, hash: await hashPassword(DEMO_ADMIN.email, DEMO_ADMIN.password)
        };
        saveDemoUsers(users);
      }
      if (read(local, 'ppapi_member_' + DEMO_ADMIN.uid, null) === null) {
        write(local, 'ppapi_member_' + DEMO_ADMIN.uid, demoMember({
          uid: DEMO_ADMIN.uid, name: DEMO_ADMIN.name, email: DEMO_ADMIN.email, joinedAt: DEMO_ADMIN.createdAt.slice(0, 10),
          createdAt: DEMO_ADMIN.createdAt
        }));
      }
      if (read(local, K_SEED, null)) return;
      var admins = read(local, K_ADMINS, []);
      if (!Array.isArray(admins)) admins = [];
      if (admins.indexOf(DEMO_ADMIN.uid) === -1) admins.push(DEMO_ADMIN.uid);
      write(local, K_ADMINS, admins);
      sampleMembers().forEach(function (m) {
        if (read(local, 'ppapi_member_' + m.uid, null) === null) write(local, 'ppapi_member_' + m.uid, m);
        if (m.status === 'Aktif' && m.kta) {
          var reg = read(local, 'ppapi_registry', {});
          if (!reg || typeof reg !== 'object' || Array.isArray(reg)) reg = {};
          if (!reg[m.kta]) {
            reg[m.kta] = {
              kta: m.kta, nama: m.name, kategori: m.memberType, kompetensi: m.competencies.map(function (c) { return c.name; }),
              kota: m.profile.city, berlakuHingga: m.validUntil, status: 'Aktif', contoh: true, updatedAt: m.approvedAt
            };
            write(local, 'ppapi_registry', reg);
          }
        }
      });
      write(local, K_SEED, { v: 2, at: new Date().toISOString() });
    } catch (e) {
      console.warn('[PPAPI] Data contoh Mode Demo belum dapat disiapkan:', e && e.message);
    }
  }
  var seedPromise = null;
  function demoSeeded() { if (!seedPromise) seedPromise = seedDemo(); return seedPromise; }

  var demo = {
    ready: function () {
      return demoSeeded().then(function () {
        current = readSession();
        return copy(current);
      });
    },
    signUpEmail: async function (o) {
      o = o || {};
      var name = cleanName(o.name);
      if (name.length < 3) throw authError('auth/missing-name');
      var email = validateEmail(o.email);
      var pw = validatePasswordForSignUp(o.password);
      await delay(320);
      var map = demoUsers();
      if (map[email]) throw authError('auth/email-already-in-use');
      var rec = { uid: newUid(), name: name, email: email, phone: '', photoURL: '', provider: 'password', createdAt: new Date().toISOString() };
      rec.hash = await hashPassword(email, pw);
      map[email] = rec;
      saveDemoUsers(map);
      setSession(publicUser(rec), o.remember !== false);
      await ensure(copy(current));
      notify();
      return copy(current);
    },
    signInEmail: async function (o) {
      o = o || {};
      var email = validateEmail(o.email);
      if (!o.password) throw authError('auth/missing-password');
      await demoSeeded();
      await delay(320);
      var rec = demoUsers()[email];
      if (!rec || !rec.hash) throw authError('auth/invalid-credential');
      var hsh = await hashPassword(email, String(o.password), rec.hash);
      if (hsh !== rec.hash) throw authError('auth/invalid-credential');
      setSession(publicUser(rec), o.remember !== false);
      await ensure(copy(current));
      notify();
      return copy(current);
    },
    resetPassword: async function (email) {
      validateEmail(email);
      await delay(300);
      return true; // neutral by design (no account enumeration)
    },
    signInGoogle: async function () {
      var info = await demoGoogleDialog();
      var map = demoUsers();
      var rec = map[info.email];
      if (!rec) {
        rec = { uid: newUid(), name: info.name, email: info.email, phone: '', photoURL: '', provider: 'google', createdAt: new Date().toISOString() };
        map[info.email] = rec;
      } else {
        if (!rec.name) rec.name = info.name;
        rec.provider = rec.provider || 'google';
      }
      saveDemoUsers(map);
      var u = publicUser(rec);
      u.provider = 'google';
      setSession(u, true);
      await ensure(copy(current));
      notify();
      return copy(current);
    },
    startPhone: async function (o) {
      o = o || {};
      var raw = String(o.phone || '').trim();
      if (!raw) throw authError('auth/missing-phone-number');
      var e164 = normPhone(raw);
      if (!e164) throw authError('auth/invalid-phone-number');
      await delay(450);
      pendingPhone = { phone: e164, sentAt: Date.now() };
      if (PPAPI.ui && PPAPI.ui.toast) PPAPI.ui.toast('Mode demo: kode OTP Anda ' + DEMO_OTP, { type: 'info', timeout: 9000 });
      return { phone: e164, masked: maskPhone(e164) };
    },
    confirmPhone: async function (o) {
      o = o || {};
      var code = String(o.code || '').replace(/\D/g, '');
      if (!code) throw authError('auth/missing-verification-code');
      if (!pendingPhone) throw authError('auth/missing-verification-id');
      if (Date.now() - pendingPhone.sentAt > 10 * 60 * 1000) { pendingPhone = null; throw authError('auth/code-expired'); }
      await delay(320);
      if (code !== DEMO_OTP) throw authError('auth/invalid-verification-code');
      var phone = pendingPhone.phone;
      pendingPhone = null;
      var map = demoUsers();
      var name = cleanName(o.name);
      var rec = map[phone];
      if (!rec) {
        rec = { uid: newUid(), name: name, email: '', phone: phone, photoURL: '', provider: 'phone', createdAt: new Date().toISOString() };
        map[phone] = rec;
      } else if (!rec.name && name) {
        rec.name = name;
      }
      saveDemoUsers(map);
      setSession(publicUser(rec), o.remember !== false);
      await ensure(copy(current));
      notify();
      return copy(current);
    },
    signOut: async function () {
      setSession(null);
      pendingPhone = null;
      notify();
    },
    updateName: async function (name) {
      if (!current) throw authError('auth/no-current-user');
      name = cleanName(name);
      if (name.length < 3) throw authError('auth/missing-name');
      updateDemoRecord(current.uid, { name: name });
      var stillLocal = !!read(local, K_SESSION, null);
      current.name = name;
      setSession(current, stillLocal);
      await syncMemberName(current.uid, name);
      notify();
      return copy(current);
    },
    /* demo accounts have no mailbox: the address counts as verified */
    sendEmailVerification: async function () {
      if (!current) throw authError('auth/no-current-user');
      if (!current.email) throw authError('auth/no-email');
      throw authError('auth/email-already-verified');
    },
    refreshUser: async function () { return copy(current); }
  };

  if (MODE === 'demo') {
    current = readSession();
    w.addEventListener('storage', function (e) {
      if (e.key === K_SESSION || e.key === null) { current = readSession(); notify(); }
    });
  }

  /* ======================================================================
     FIREBASE MODE (compat SDK, loaded on demand)
     ====================================================================== */
  var FB = null;           // { fb, app, auth, db }
  var fbInit = null;
  var confirmation = null;
  var verifier = null, verifierSlot = null;

  /* Invisible reCAPTCHA lifecycle.
     A reCAPTCHA widget can be rendered only ONCE into a given element, and RecaptchaVerifier.clear()
     does not remove an invisible widget from its container — so re-using one element (e.g. the same
     "Kirim Kode OTP" button) for a second attempt fails with "reCAPTCHA has already been rendered in
     this element". Every startPhone() attempt therefore renders into a FRESH empty slot appended to
     the reserved #ppapi-recaptcha host, and the previous verifier (+ its widget and slot) is disposed
     first — on failure, on "Kirim ulang", and after a successful confirmPhone(). The buttonEl passed
     by a page is no longer used as the widget container, so pages may re-use or replace it freely. */
  function recaptchaHost() {
    var host = d.getElementById('ppapi-recaptcha');
    if (!host) {
      host = d.createElement('div');
      host.id = 'ppapi-recaptcha';
      d.body.appendChild(host);
    }
    return host;
  }
  function disposeVerifier() {
    var v = verifier, slot = verifierSlot;
    verifier = null;
    verifierSlot = null;
    if (v) { try { v.clear(); } catch (e) { /* already cleared / never rendered */ } }
    /* removing the slot removes the widget's iframe + badge with it; the next attempt gets a new one */
    if (slot && slot.parentNode) slot.parentNode.removeChild(slot);
  }
  function newVerifierSlot() {
    var slot = d.createElement('div');
    slot.className = 'ppapi-recaptcha__slot';
    slot.setAttribute('data-attempt', String(++newVerifierSlot.n));
    recaptchaHost().appendChild(slot);
    return slot;
  }
  newVerifierSlot.n = 0;

  /* Subresource Integrity for the pinned compat SDK: sha384 of the exact files served by
     www.gstatic.com/firebasejs/<version>/ (versioned files never change). When config.firebaseSdkVersion
     is raised, add that version's hashes here (README: "Memperbarui versi Firebase SDK"); a version
     without hashes still loads, with a console warning. */
  var SDK_SRI = {
    '12.4.0': {
      'firebase-app-compat.js': 'sha384-NGw427w9kUd0u0OjHkygdwNKinWp4DiQMkOsafkwq98j2+E3EN8pn0oSlx3Fe61F',
      'firebase-auth-compat.js': 'sha384-P44Lc4FFaOc/XnFQzAIpmmZZpAstRvYwQLiHHU5LHtlBmblzk5gCbsRCe4hJY6IN',
      'firebase-firestore-compat.js': 'sha384-DW7welpkxbrycUYGrFJDY26esOqRCi4XxdQi/owqbMLv8q2x9QWoJCrvVyD0UKmu',
      'firebase-app-check-compat.js': 'sha384-11DWt84+eRNysY+l1B5BzHSjhrmH6TESr5Ii/P0aW0rq/wlfLf2Ng+MRQfAGH2Fc'
    }
  };
  function loadScript(src, integrity) {
    return new Promise(function (resolve, reject) {
      var s = d.createElement('script');
      s.src = src;
      s.async = false;
      s.crossOrigin = 'anonymous';
      if (integrity) s.integrity = integrity;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(authError('auth/sdk-load-failed')); };
      d.head.appendChild(s);
    });
  }
  async function loadSdk() {
    var v = cfg.firebaseSdkVersion || '12.4.0';
    var base = 'https://www.gstatic.com/firebasejs/' + v + '/';
    var sri = Object.prototype.hasOwnProperty.call(SDK_SRI, v) ? SDK_SRI[v] : null;
    if (!sri) console.warn('[PPAPI] Firebase SDK ' + v + ' dimuat tanpa pemeriksaan integritas (SRI): hash untuk versi ini belum tercatat di auth.js.');
    function file(name) { return loadScript(base + name, sri && sri[name]); }
    if (!w.firebase || typeof w.firebase.initializeApp !== 'function') await file('firebase-app-compat.js');
    if (typeof w.firebase.auth !== 'function') await file('firebase-auth-compat.js');
    if (typeof w.firebase.firestore !== 'function') await file('firebase-firestore-compat.js');
    if (appCheckKey() && typeof w.firebase.appCheck !== 'function') await file('firebase-app-check-compat.js');
  }
  /* Optional Firebase App Check (reCAPTCHA v3 site key in config.appCheckSiteKey): attests that
     Firestore/Auth requests come from this site, so enforcement in the Console can stop bots
     (e.g. feedback spam). Empty key = not used. Activated before auth()/firestore() are used. */
  function appCheckKey() { return String(cfg.appCheckSiteKey || '').trim(); }
  function activateAppCheck(fb) {
    var key = appCheckKey();
    if (!key || typeof fb.appCheck !== 'function') return;
    try { fb.appCheck().activate(key, true); }
    catch (e) { console.warn('[PPAPI] App Check tidak dapat diaktifkan:', e && e.message); }
  }
  function mapUser(u) {
    if (!u) return null;
    var pid = (u.providerData && u.providerData[0] && u.providerData[0].providerId) || (u.phoneNumber ? 'phone' : 'password');
    var provider = pid === 'google.com' ? 'google' : (pid === 'phone' ? 'phone' : 'password');
    var created = '';
    try { created = u.metadata && u.metadata.creationTime ? new Date(u.metadata.creationTime).toISOString() : ''; } catch (e) { created = ''; }
    return {
      uid: u.uid, name: u.displayName || '', email: u.email || '', phone: u.phoneNumber || '',
      emailVerified: !!(u.email && u.emailVerified),
      photoURL: u.photoURL || '', provider: provider, createdAt: created
    };
  }
  function initFirebase() {
    if (fbInit) return fbInit;
    fbInit = (async function () {
      if (!/^https?:$/.test(w.location.protocol)) throw authError('auth/operation-not-supported-in-this-environment');
      await loadSdk();
      var fb = w.firebase;
      var fresh = !(fb.apps && fb.apps.length);
      var app = fresh ? fb.initializeApp(fbCfg) : fb.app();
      if (fresh) activateAppCheck(fb);
      var auth = fb.auth();
      auth.languageCode = 'id';
      var db = fb.firestore();
      try { db.settings({ ignoreUndefinedProperties: true }); } catch (e) { /* settings already applied */ }
      FB = { fb: fb, app: app, auth: auth, db: db };
      return new Promise(function (resolve) {
        var first = true;
        auth.onAuthStateChanged(function (u) {
          current = mapUser(u);
          if (first) { first = false; resolve(copy(current)); }
          else notify();
        });
      });
    })();
    return fbInit;
  }
  async function getFb() {
    if (FB) return FB;
    await PPAPI.auth.ready();
    if (!FB) throw authError('auth/sdk-load-failed');
    return FB;
  }
  function refreshFromFirebase(nameOverride) {
    var u = FB && FB.auth.currentUser;
    current = mapUser(u);
    if (current && nameOverride) current.name = nameOverride;
    return copy(current);
  }

  /* verification mail; the link returns to the dashboard when this domain is an authorised
     continue URL, otherwise Firebase's own confirmation page is used */
  async function sendVerification(u) {
    var back = null;
    try { back = { url: new URL('dashboard.html', w.location.href).href }; } catch (e) { back = null; }
    try { await u.sendEmailVerification(back || undefined); }
    catch (e) {
      if (back && e && /continue-uri|unauthorized-domain|invalid-continue/.test(String(e.code || ''))) await u.sendEmailVerification();
      else throw e;
    }
  }
  /* re-read the account (e.g. after the mail link was opened elsewhere); once the address is verified
     the ID token is refreshed (rules read email_verified from it) and the member record gets the email */
  async function refreshFirebaseUser() {
    var fx = await getFb();
    var u = fx.auth.currentUser;
    if (!u) return null;
    var was = !!u.emailVerified;
    try { await u.reload(); } catch (e) { throw mapError(e); }
    u = fx.auth.currentUser;
    if (!u) return null;
    var nameNow = current && current.uid === u.uid ? current.name : '';
    current = mapUser(u);
    if (current && !current.name && nameNow) current.name = nameNow;
    if (!was && u.emailVerified) {
      try { await u.getIdToken(true); } catch (e) { /* the next automatic refresh carries the claim */ }
      await ensure(copy(current));
      notify();
    }
    return copy(current);
  }

  var firebase = {
    ready: function () {
      return initFirebase().then(function (u) {
        /* unverified email account: check quietly whether the mail link has been opened meanwhile */
        if (u && u.provider === 'password' && u.email && !u.emailVerified) {
          setTimeout(function () { refreshFirebaseUser().catch(function () { /* offline: next visit */ }); }, 0);
        }
        return u;
      }).catch(function (e) {
        console.error('[PPAPI] Firebase tidak dapat dimuat:', e && e.message);
        PPAPI.auth.error = mapError(e);
        setTimeout(function () {
          if (PPAPI.ui && PPAPI.ui.toast) PPAPI.ui.toast(PPAPI.auth.error.message, { type: 'error', timeout: 9000 });
        }, 600);
        current = null;
        return null;
      });
    },
    signUpEmail: async function (o) {
      o = o || {};
      var name = cleanName(o.name);
      if (name.length < 3) throw authError('auth/missing-name');
      var email = validateEmail(o.email);
      var pw = validatePasswordForSignUp(o.password);
      var fx = await getFb();
      try {
        await fx.auth.setPersistence(fx.fb.auth.Auth.Persistence.LOCAL);
        var cred = await fx.auth.createUserWithEmailAndPassword(email, pw);
        await cred.user.updateProfile({ displayName: name });
      } catch (e) { throw mapError(e); }
      /* prove the address: until then it is not copied into the member record (rules) */
      try { await sendVerification(cred.user); }
      catch (e) { console.warn('[PPAPI] Email verifikasi belum terkirim:', e && (e.code || e.message)); }
      var u = refreshFromFirebase(name);
      await ensure(u);
      notify();
      return copy(current);
    },
    signInEmail: async function (o) {
      o = o || {};
      var email = validateEmail(o.email);
      if (!o.password) throw authError('auth/missing-password');
      var fx = await getFb();
      try {
        var P = fx.fb.auth.Auth.Persistence;
        await fx.auth.setPersistence(o.remember === false ? P.SESSION : P.LOCAL);
        await fx.auth.signInWithEmailAndPassword(email, String(o.password));
      } catch (e) { throw mapError(e); }
      var u = refreshFromFirebase();
      await ensure(u);
      notify();
      return copy(current);
    },
    resetPassword: async function (email) {
      email = validateEmail(email);
      var fx = await getFb();
      try {
        fx.auth.languageCode = 'id';
        await fx.auth.sendPasswordResetEmail(email);
      } catch (e) {
        if (e && e.code === 'auth/user-not-found') return true; // stay neutral
        throw mapError(e);
      }
      return true;
    },
    // NOTE: not async — signInWithPopup must start inside the click's user activation.
    signInGoogle: function () {
      if (!FB) {
        return getFb().then(function () { return firebase.signInGoogle(); });
      }
      var provider = new FB.fb.auth.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      var popup;
      try { popup = FB.auth.signInWithPopup(provider); }
      catch (e) { return Promise.reject(mapError(e)); }
      return popup.then(async function () {
        var u = refreshFromFirebase();
        await ensure(u);
        return copy(current);
      }, function (e) { throw mapError(e); });
    },
    startPhone: async function (o) {
      o = o || {};
      var raw = String(o.phone || '').trim();
      if (!raw) throw authError('auth/missing-phone-number');
      var e164 = normPhone(raw);
      if (!e164) throw authError('auth/invalid-phone-number');
      var fx = await getFb();
      /* o.buttonEl is accepted for API compatibility only (see recaptchaHost above) */
      disposeVerifier();
      var mine;
      try {
        fx.auth.languageCode = 'id';
        verifierSlot = newVerifierSlot();
        verifier = mine = new fx.fb.auth.RecaptchaVerifier(verifierSlot, { size: 'invisible' });
        var result = await fx.auth.signInWithPhoneNumber(e164, verifier);
        confirmation = result;
      } catch (e) {
        if (verifier === mine) disposeVerifier();
        throw mapError(e);
      }
      return { phone: e164, masked: maskPhone(e164) };
    },
    confirmPhone: async function (o) {
      o = o || {};
      var code = String(o.code || '').replace(/\D/g, '');
      if (!code) throw authError('auth/missing-verification-code');
      if (!confirmation) throw authError('auth/missing-verification-id');
      var fx = await getFb();
      var name = cleanName(o.name);
      try {
        if (o.remember === false) await fx.auth.setPersistence(fx.fb.auth.Auth.Persistence.SESSION);
        var cred = await confirmation.confirm(code);
        if (name && cred && cred.user && !cred.user.displayName) await cred.user.updateProfile({ displayName: name });
      } catch (e) { throw mapError(e); }
      confirmation = null;
      disposeVerifier();
      var u = refreshFromFirebase(name || undefined);
      await ensure(u);
      notify();
      return copy(current);
    },
    signOut: async function () {
      var fx = await getFb();
      try { await fx.auth.signOut(); } catch (e) { throw mapError(e); }
      current = null;
      notify();   /* listeners (header, PPAPI.session) update now, not only when onAuthStateChanged fires */
    },
    updateName: async function (name) {
      var fx = await getFb();
      var u = fx.auth.currentUser;
      if (!u) throw authError('auth/no-current-user');
      name = cleanName(name);
      if (name.length < 3) throw authError('auth/missing-name');
      try { await u.updateProfile({ displayName: name }); } catch (e) { throw mapError(e); }
      refreshFromFirebase(name);
      await syncMemberName(u.uid, name);
      notify();
      return copy(current);
    },
    sendEmailVerification: async function () {
      var fx = await getFb();
      var u = fx.auth.currentUser;
      if (!u) throw authError('auth/no-current-user');
      if (!u.email) throw authError('auth/no-email');
      if (u.emailVerified) throw authError('auth/email-already-verified');
      try { fx.auth.languageCode = 'id'; await sendVerification(u); } catch (e) { throw mapError(e); }
      return true;
    },
    refreshUser: function () { return refreshFirebaseUser(); }
  };

  /* ======================================================================
     ROLE: admin (sekretariat)
     Firebase: the user is admin iff document admins/{uid} exists (rules: a user may read only
     their OWN admins doc; admins read all). Demo: uid listed in localStorage ppapi_demo_admins.
     Cached per uid; PPAPI.session.refresh() clears the cache (e.g. after adding/removing admins).
     ====================================================================== */
  var adminCache = {};
  function isAdmin() {
    var u = current;
    if (!u || !u.uid) return Promise.resolve(false);
    var uid = u.uid;
    if (adminCache[uid] !== undefined) return Promise.resolve(adminCache[uid]);
    var p;
    if (MODE === 'demo') {
      p = demoSeeded().then(function () {
        var list = read(local, K_ADMINS, []);
        return Array.isArray(list) && list.indexOf(uid) !== -1;
      });
    } else {
      p = getFb().then(function (fx) {
        return fx.db.collection('admins').doc(uid).get().then(function (snap) { return !!snap.exists; });
      }).catch(function (e) {
        console.warn('[PPAPI] Peran admin tidak dapat diperiksa:', e && (e.code || e.message));
        return false;
      });
    }
    return p.then(function (v) { if (current && current.uid === uid) adminCache[uid] = !!v; return !!v; });
  }

  /* ======================================================================
     PUBLIC API
     ====================================================================== */
  var impl = MODE === 'firebase' ? firebase : demo;
  PPAPI.auth = {
    __real: true,
    mode: MODE,
    isDemo: MODE === 'demo',
    demoOtp: MODE === 'demo' ? DEMO_OTP : null,
    error: null,
    ready: function () {
      if (!readyPromise) readyPromise = impl.ready();
      return readyPromise;
    },
    current: function () { return copy(current); },
    onChange: function (cb) {
      if (typeof cb !== 'function') return function () {};
      listeners.push(cb);
      return function () { var i = listeners.indexOf(cb); if (i !== -1) listeners.splice(i, 1); };
    },
    signUpEmail: function (o) { return impl.signUpEmail(o); },
    signInEmail: function (o) { return impl.signInEmail(o); },
    resetPassword: function (email) { return impl.resetPassword(email); },
    signInGoogle: function () { return impl.signInGoogle(); },
    startPhone: function (o) { return impl.startPhone(o); },
    confirmPhone: function (o) { return impl.confirmPhone(o); },
    signOut: function () { return impl.signOut(); },
    updateName: function (name) { return impl.updateName(name); },
    /** Firebase: (re)send the verification mail of the signed-in email account. */
    sendEmailVerification: function () { return impl.sendEmailVerification(); },
    /** Re-read the signed-in account (emailVerified …); Promise<user|null>. */
    refreshUser: function () { return impl.refreshUser(); },
    /** Promise<boolean> — is the signed-in user an admin (sekretariat)? Cached per uid. */
    isAdmin: isAdmin,
    /** Where pages send a NEW account when no explicit ?next= is given (SPEC v2 §3.2). */
    postSignUpTarget: 'pendaftaran.html',
    /** Demo-mode admin account (null in Firebase mode) — shown in the demo note on masuk.html. */
    demoAdmin: MODE === 'demo' ? { email: DEMO_ADMIN.email, password: DEMO_ADMIN.password, name: DEMO_ADMIN.name } : null,
    errorMessage: function (code) { return MESSAGES[code] || MESSAGES['default']; },
    /** internal: forget cached admin flags (PPAPI.session.refresh() calls this) */
    _clearAdminCache: function () { adminCache = {}; },
    /** internal: resolved Firebase handles for store.js ({fb, app, auth, db}) */
    _firebase: function () { return MODE === 'firebase' ? getFb() : Promise.resolve(null); }
  };
})(window, document);
