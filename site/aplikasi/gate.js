/* ==========================================================================
   PPAPI — Gerbang aplikasi anggota  (aplikasi/gate.js)
   --------------------------------------------------------------------------
   Aplikasi di folder aplikasi/ hanya terbuka untuk anggota berstatus Aktif dan
   admin PPAPI. Berkas ini:
   1. memuat skrip inti situs secara berurutan: ../assets/js/config.js, core.js,
      auth.js, store.js, store-apps.js (data aplikasi per akun, PPAPI.appData;
      alamatnya dihitung dari lokasi gate.js sendiri);
   2. menyembunyikan aplikasi (kelas html.app-gate-pending + layar #app-gate)
      sampai PPAPI.session siap;
   3. memutuskan:
        • belum masuk              → masuk.html?next=<alamat aplikasi>
        • masuk, belum Aktif       → dashboard.html + notifikasi
                                     "Fitur ini khusus anggota berstatus Aktif."
        • anggota Aktif atau admin → bilah portal dipasang, lalu aplikasi dimulai
          lewat window.PPAPI_APP_START(pengguna) — dipanggil SEKALI;
   4. mengawasi sesi: keluar di tab lain, status dicabut admin, atau akun
      berganti → halaman ikut menyesuaikan.

   Pemakaian di halaman aplikasi (lihat perencanaan/index.html):
     <html lang="id" class="app-gate-pending" data-app="perencanaan">
     <link rel="stylesheet" href="../gate.css">
     <body> <div id="app-gate" …>…</div>  …isi aplikasi (id="app-main")…
     <script src="app.js" defer></script>      ← mendefinisikan PPAPI_APP_START
     <script src="../gate.js" defer></script>

   Objek pengguna yang diterima aplikasi:
     { uid, name, email, phone, photoURL, kta, memberType, status, statusLabel,
       validUntil, isAdmin, isMemberActive, role: 'admin' | 'user', mode }
   window.PPAPI_GATE juga tersedia: { user, root, self, signOut() }.

   CATATAN JUJUR: situs statis (GitHub Pages) tetap menyajikan berkas aplikasi
   kepada siapa pun yang mengetahui alamatnya. Gerbang ini mengatur pengalaman
   portal (siapa yang diarahkan ke aplikasi), bukan merahasiakan kode. Data
   anggota tetap dilindungi aturan Firestore.
   ========================================================================== */
(function (w, d) {
  'use strict';

  var html = d.documentElement;
  var me = d.currentScript;
  var gateUrl = (me && me.src) || new URL('../gate.js', w.location.href).href;
  var ROOT = new URL('../', gateUrl).href;                 /* akar situs, diakhiri "/" */
  var here = w.location.href.split('#')[0].split('?')[0];
  var SELF = html.getAttribute('data-self') || (here.indexOf(ROOT) === 0 ? here.slice(ROOT.length) : '');
  if (!SELF || /\/$/.test(SELF)) SELF += 'index.html';
  var APP_KEY = html.getAttribute('data-app') || '';
  var FILES = ['assets/js/config.js', 'assets/js/core.js', 'assets/js/auth.js', 'assets/js/store.js', 'assets/js/store-apps.js'];
  var MSG_LOCKED = 'Fitur ini khusus anggota berstatus Aktif.';
  var TIMEOUT_MS = 45000;
  var st = { leaving: false, started: false, failed: false, user: null };

  /* ---------- utilitas kecil (tanpa ketergantungan) ---------- */
  function esc(s) {
    if (w.PPAPI && PPAPI.util && typeof PPAPI.util.h === 'function') return PPAPI.util.h(s);
    return String(s == null ? '' : s).replace(/[&<>"'`]/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; });
  }
  function go(path) {
    st.leaving = true;
    w.location.replace(ROOT + path);
  }
  function flash(msg, type) {
    try { PPAPI.ui.flash(msg, { type: type || 'warn', timeout: 6000 }); } catch (e) { /* tanpa notifikasi */ }
  }
  function gateEl() { return d.getElementById('app-gate'); }
  function setMsg(text) {
    var m = d.getElementById('app-gate-msg');
    if (m) m.textContent = text;
  }

  /* Pesan kegagalan di layar gerbang (aplikasi tetap tersembunyi) */
  function fail(msg) {
    if (st.failed || st.leaving) return;
    st.failed = true;
    clearTimeout(timer);
    html.classList.add('app-gate-pending');
    var g = gateEl();
    if (!g) { g = d.createElement('div'); g.id = 'app-gate'; d.body.insertBefore(g, d.body.firstChild); }
    g.classList.add('is-error');
    g.setAttribute('role', 'alert');
    g.innerHTML =
      '<img class="app-gate__logo" src="' + esc(ROOT + 'assets/img/logo-light-mark.webp') + '" width="148" height="51" alt="PPAPI">' +   /* WebP 13 KB (master PNG 1200 px hanya untuk cetak) */
      '<p class="app-gate__eyebrow">Aplikasi Anggota</p>' +
      '<p class="app-gate__msg" id="app-gate-msg">' + esc(msg) + '</p>' +
      '<div class="app-gate__actions">' +
        '<a href="' + esc(w.location.href) + '">Muat ulang</a>' +
        '<a href="' + esc(ROOT + 'dashboard.html') + '">Kembali ke Portal Anggota</a>' +
      '</div>';
  }

  var timer = setTimeout(function () {
    fail('Status keanggotaan belum dapat dipastikan. Periksa koneksi internet, lalu muat ulang halaman.');
  }, TIMEOUT_MS);

  /* Halaman dari cache maju/mundur peramban (bfcache) diperiksa ulang:
     setelah keluar, tombol "kembali" tidak boleh menampilkan aplikasi lagi. */
  w.addEventListener('pageshow', function (e) { if (e.persisted) w.location.reload(); });

  /* ---------- 1. muat skrip inti situs (urut: config → core → auth → store) ---------- */
  function loadCore(done) {
    if (w.PPAPI && PPAPI.session && PPAPI.auth && PPAPI.store && PPAPI.appData) { done(); return; }
    var pending = FILES.length, broken = false;
    FILES.forEach(function (f) {
      var s = d.createElement('script');
      s.src = ROOT + f;
      s.async = false;                                  /* dieksekusi sesuai urutan penyisipan */
      s.onload = function () { if (--pending === 0 && !broken) done(); };
      s.onerror = function () {
        if (broken) return;
        broken = true;
        fail('Komponen portal PPAPI tidak dapat dimuat. Periksa koneksi internet, lalu muat ulang halaman.');
      };
      d.head.appendChild(s);
    });
  }

  /* ---------- 2. bilah portal ---------- */
  function appInfo() {
    var apps = (w.PPAPI && PPAPI.config && PPAPI.config.apps) || [];
    for (var i = 0; i < apps.length; i++) if (apps[i] && apps[i].key === APP_KEY) return apps[i];
    return {};
  }
  function icon(name, size) {
    try { return PPAPI.icon(name, { size: size || 18 }); } catch (e) { return ''; }
  }
  function avatarHtml(u) {
    var src = String(u.photoURL || '');
    if (/^https:\/\//i.test(src) || /^data:image\/(jpeg|png|webp);base64,/i.test(src)) {
      return '<span class="pp-bar__avatar" aria-hidden="true"><img src="' + esc(src) + '" alt="" width="28" height="28" style="width:100%;height:100%;object-fit:cover"></span>';
    }
    var ini = '';
    try { ini = PPAPI.util.initials(u.name); } catch (e) { ini = String(u.name || '?').charAt(0).toUpperCase(); }
    return '<span class="pp-bar__avatar" aria-hidden="true">' + esc(ini || '?') + '</span>';
  }
  function barHtml(u) {
    var app = appInfo();
    var title = html.getAttribute('data-app-title') || app.title || d.title;
    var short = html.getAttribute('data-app-short') || app.short || title;
    var badge = u.isAdmin
      ? '<span class="pp-bar__badge pp-bar__badge--admin">Admin</span>'
      : '<span class="pp-bar__badge">Aktif</span>';
    var demo = (PPAPI.auth && PPAPI.auth.mode === 'demo')
      ? '<span class="pp-bar__demo" title="Mode Demo: akun dan data hanya tersimpan di peramban ini.">Mode Demo</span>' : '';
    var who = u.isAdmin ? 'admin PPAPI' : 'anggota Aktif';
    return '' +
      '<a class="pp-bar__back" href="' + esc(ROOT + 'dashboard.html') + '" aria-label="Kembali ke Portal Anggota (dasbor)">' + icon('arrow-left', 18) +
        '<span class="pp-bar__back-long" aria-hidden="true">Portal Anggota</span>' +
        '<span class="pp-bar__back-short" aria-hidden="true">Portal</span></a>' +
      '<span class="pp-bar__sep" aria-hidden="true"></span>' +
      '<p class="pp-bar__title" title="' + esc(title) + '"><span class="pp-bar__title-long">' + esc(title) + '</span>' +
        '<span class="pp-bar__title-short">' + esc(short) + '</span></p>' +
      demo +
      '<a class="pp-bar__user" href="' + esc(ROOT + 'anggota.html') + '" title="' + esc(u.name) + ' — ' + who + '"' +
        ' aria-label="' + esc('Profil anggota: ' + u.name + ' (' + who + ')') + '">' +
        avatarHtml(u) + '<span class="pp-bar__name">' + esc(u.name) + '</span>' + badge + '</a>' +
      '<button type="button" class="pp-bar__out" data-pp-signout aria-label="Keluar dari akun">' + icon('logout', 18) + '<span>Keluar</span></button>';
  }
  function renderBar(u) {
    var bar = d.getElementById('pp-bar');
    if (!bar) {
      bar = d.createElement('nav');
      bar.id = 'pp-bar';
      bar.className = 'pp-bar';
      bar.setAttribute('aria-label', 'Portal Anggota PPAPI');
      var main = d.getElementById('app-main');
      var skip = d.createElement('a');
      skip.className = 'pp-skip';
      skip.href = '#app-main';
      skip.textContent = 'Lewati ke aplikasi';
      if (!main) skip.hidden = true;
      var g = gateEl();
      d.body.insertBefore(bar, g ? g.nextSibling : d.body.firstChild);
      d.body.insertBefore(skip, bar);
      bar.addEventListener('click', function (e) {
        var b = e.target && e.target.closest && e.target.closest('[data-pp-signout]');
        if (b) { e.preventDefault(); signOut(b); }
      });
    }
    bar.innerHTML = barHtml(u);
  }

  /* ---------- 3. keluar ---------- */
  function signOut(btn) {
    if (st.leaving) return;
    st.leaving = true;
    if (btn) { btn.disabled = true; btn.setAttribute('aria-busy', 'true'); }
    Promise.resolve().then(function () { return PPAPI.auth.signOut(); }).then(function () {
      flash('Anda telah keluar. Sampai jumpa kembali.', 'success');
      w.location.replace(ROOT + 'index.html');
    }, function (e) {
      st.leaving = false;
      if (btn) { btn.disabled = false; btn.removeAttribute('aria-busy'); }
      try { PPAPI.ui.toast((e && e.message) || 'Gagal keluar. Silakan coba lagi.', { type: 'error' }); } catch (er) { /* abaikan */ }
    });
  }

  /* ---------- 4. keputusan gerbang ---------- */
  function userFrom(s) {
    var m = s.member || {}, a = s.user || {};
    return {
      uid: a.uid,
      name: String(m.name || a.name || a.email || 'Anggota PPAPI'),
      email: String(a.email || m.email || ''),
      phone: String(m.phone || a.phone || ''),
      photoURL: String(m.photoURL || a.photoURL || ''),
      kta: String(m.kta || ''),
      memberType: String(m.memberType || ''),
      status: s.status || '',
      statusLabel: s.statusLabel || '',
      validUntil: String(m.validUntil || ''),
      isAdmin: !!s.isAdmin,
      isMemberActive: !!s.isMemberActive,
      role: s.isAdmin ? 'admin' : 'user',
      mode: (PPAPI.auth && PPAPI.auth.mode) || ''
    };
  }
  function copy(o) { return JSON.parse(JSON.stringify(o)); }

  function decide() {
    if (st.leaving || st.failed) return;
    var user = PPAPI.auth && typeof PPAPI.auth.current === 'function' ? PPAPI.auth.current() : null;
    if (!user) {
      clearTimeout(timer);
      setMsg('Silakan masuk terlebih dahulu…');
      go('masuk.html?next=' + encodeURIComponent(SELF + w.location.search + w.location.hash));
      return;
    }
    if (!PPAPI.session.isResolved()) {
      fail('Status keanggotaan belum dapat dipastikan. Periksa koneksi internet, lalu muat ulang halaman.');
      return;
    }
    var s = PPAPI.session.current();
    if (!s.isActive) {
      clearTimeout(timer);
      setMsg(MSG_LOCKED);
      flash(MSG_LOCKED, 'warn');
      go('dashboard.html');
      return;
    }
    var u = userFrom(s);
    st.user = u;
    w.PPAPI_GATE = { user: copy(u), root: ROOT, self: SELF, signOut: function () { signOut(d.querySelector('[data-pp-signout]')); } };
    renderBar(u);
    try {
      if (typeof w.PPAPI_APP_START === 'function') {
        st.started = true;
        var r = w.PPAPI_APP_START(copy(u));
        if (r && typeof r.then === 'function') r.then(null, startError);
      }
    } catch (e) { startError(e); return; }
    clearTimeout(timer);
    html.classList.remove('app-gate-pending');
    html.classList.add('app-gate-ok');
    PPAPI.session.onChange(watch);
  }
  function startError(e) {
    if (w.console) console.error('[PPAPI] Aplikasi gagal dimulai:', e);
    fail('Aplikasi gagal dimulai. Silakan muat ulang halaman.');
  }

  /* perubahan sesi setelah aplikasi terbuka */
  function watch(s) {
    if (st.leaving || !st.user) return;
    if (!s.user) {
      flash('Sesi Anda telah berakhir. Silakan masuk kembali.', 'info');
      go('masuk.html?next=' + encodeURIComponent(SELF));
      return;
    }
    if (s.user.uid !== st.user.uid) { st.leaving = true; w.location.reload(); return; }
    if (!s.isActive) {
      html.classList.add('app-gate-pending');
      setMsg(MSG_LOCKED);
      flash(MSG_LOCKED, 'warn');
      go('dashboard.html');
      return;
    }
    var u = userFrom(s);
    if (u.name !== st.user.name || u.isAdmin !== st.user.isAdmin || u.photoURL !== st.user.photoURL) {
      st.user = u;
      renderBar(u);
    }
  }

  /* ---------- mulai ---------- */
  loadCore(function () {
    if (!w.PPAPI || typeof PPAPI.onReady !== 'function' || !PPAPI.session || !PPAPI.auth) {
      fail('Komponen portal PPAPI tidak lengkap. Silakan muat ulang halaman.');
      return;
    }
    PPAPI.onReady(decide);
  });
})(window, document);
