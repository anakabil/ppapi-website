/* ==========================================================================
   PPAPI — pages/masuk.js · Masuk & Daftar
   Tab Masuk | Daftar (hash #daftar), metode Email | Nomor HP (OTP 6 digit),
   serta Google. Validasi inline, pesan galat berbahasa Indonesia dari
   PPAPI.auth ditampilkan di wilayah .alert--err (aria-live), lalu pengalihan
   aman ke parameter ?next= (hanya jalur relatif di situs ini) atau dasbor.
   Nomor HP / Google di tab Masuk dapat membuat akun baru (perilaku Firebase):
   akun baru — atau akun tanpa nama — melewati langkah "Lengkapi profil"
   (nama lengkap + persetujuan Kebijakan Privasi) sebelum dialihkan. Ucapan
   "Selamat datang" dibawa ke halaman tujuan lewat UI.flash.
   v2: akun BARU (pendaftaran) tanpa ?next= eksplisit diarahkan ke
   PPAPI.auth.postSignUpTarget (pendaftaran.html — Formulir Pendaftaran
   Anggota); ?next= ke halaman khusus anggota Aktif (anggota/admin/aplikasi)
   juga dialihkan ke formulir karena akun baru belum aktif. Mode Demo
   menampilkan akun admin demo (PPAPI.auth.demoAdmin) beserta tombol salin
   dan "isi formulir".
   ========================================================================== */
(function (w, d) {
  'use strict';
  if (!w.PPAPI || typeof w.PPAPI.onReady !== 'function') return;

  w.PPAPI.onReady(function () {
    var P = w.PPAPI, U = P.util, UI = P.ui, A = P.auth;
    var $ = U.$, $$ = U.$$, h = U.h;
    var root = $('[data-auth-root]');
    if (!root || !A) return;

    var isDemo = A.mode === 'demo';
    var busy = false;
    var tabsEl = $('[data-auth-tabs]', root);
    var tabs = UI.tabs(tabsEl);
    var panels = { masuk: $('#panel-masuk', root), daftar: $('#panel-daftar', root) };
    var COUNTDOWN = 60;

    /* ------------------------------------------------------------------
       Helpers
       ------------------------------------------------------------------ */
    function cleanName(v) { return String(v || '').replace(/\s+/g, ' ').trim(); }
    function displayName(u) {
      if (!u) return 'Anggota';
      return cleanName(u.name) || (u.email ? String(u.email).split('@')[0] : '') || U.formatPhoneID(u.phone) || 'Anggota';
    }
    function currentTab() { return (tabs && tabs.current) || 'masuk'; }
    function reduced() { return !!(P.motion && P.motion.prefersReduced && P.motion.prefersReduced()); }

    /** Same-site relative target only: util.safeNext + an origin check as a second line of defence. */
    function nextTarget() {
      return explicitNext() || 'dashboard.html';
    }
    /** The ?next= target when one was given and is safe, else '' (no fallback). */
    function explicitNext() {
      var raw = U.qs('next');
      if (!raw) return '';
      var target = U.safeNext(raw, '#');
      if (!target || target === '#') return '';
      try {
        var url = new URL(target, w.location.href);
        if (url.origin !== w.location.origin) return '';
      } catch (e) { return ''; }
      return target;
    }
    /* Pages a brand-new account cannot open yet (data-auth="active" / "admin", member apps):
       a new account is always 'Draf', so it would only bounce to the dashboard. */
    var MEMBER_ONLY = /^(?:anggota|admin)\.html(?:[?#]|$)|^aplikasi\//i;
    function postSignUpTarget() {
      return U.safeNext(A.postSignUpTarget || 'pendaftaran.html', 'pendaftaran.html');
    }
    /** Where a NEW account goes: an explicit, reachable ?next= — otherwise the membership form. */
    function signUpTarget() {
      var nx = explicitNext();
      if (!nx || MEMBER_ONLY.test(nx)) return postSignUpTarget();
      return nx;
    }
    function pageOf(target) { return String(target || '').split(/[?#]/)[0]; }

    /* ------------------------------------------------------------------
       Inline validation
       ------------------------------------------------------------------ */
    var RULES = {
      email: function (v) {
        v = v.trim();
        if (!v) return 'Alamat email wajib diisi.';
        return U.isEmail(v) ? '' : 'Format alamat email tidak valid, misalnya nama@domain.id.';
      },
      password: function (v) { return v ? '' : 'Kata sandi wajib diisi.'; },
      'password-new': function (v) {
        if (!v) return 'Kata sandi wajib diisi.';
        return U.passwordStrength(v).valid ? '' : 'Gunakan minimal 8 karakter yang memuat huruf dan angka.';
      },
      'password-confirm': function (v, input) {
        var src = d.getElementById(input.getAttribute('data-match'));
        if (!v) return 'Ulangi kata sandi Anda.';
        return src && v === src.value ? '' : 'Konfirmasi kata sandi belum sama dengan kata sandi di atas.';
      },
      name: function (v) {
        v = cleanName(v);
        if (!v) return 'Nama lengkap wajib diisi.';
        return v.length >= 3 ? '' : 'Nama lengkap minimal 3 karakter.';
      },
      agree: function (v, input) { return input.checked ? '' : 'Anda perlu menyetujui Kebijakan Privasi untuk melanjutkan.'; },
      phone: function (v) {
        if (!v.trim()) return 'Nomor HP wajib diisi.';
        return U.normalizePhoneID(v) ? '' : 'Nomor HP tidak valid. Gunakan nomor seluler Indonesia, misalnya 0812-3456-7890.';
      }
    };

    // remember each control's own aria-describedby (hints) so the error id can be added/removed cleanly
    function baseDescribedBy(el) {
      if (el.__baseDesc === undefined) el.__baseDesc = el.getAttribute('aria-describedby') || '';
      return el.__baseDesc;
    }
    function setFieldError(el, msg) {
      var field = el.closest('.field');
      if (!field) return;
      var err = $('.field__error', field);
      var ids = baseDescribedBy(el).split(/\s+/).filter(Boolean);
      field.classList.toggle('is-invalid', !!msg);
      if (err) err.textContent = msg || '';
      if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
      if (msg && err && err.id) ids.push(err.id);
      if (ids.length) el.setAttribute('aria-describedby', ids.join(' ')); else el.removeAttribute('aria-describedby');
    }
    function validateInput(el) {
      var rule = RULES[el.getAttribute('data-rule')];
      if (!rule) return true;
      var msg = rule(String(el.value || ''), el);
      setFieldError(el, msg);
      return !msg;
    }
    /** Validate every rule-bound control of a form; returns the first invalid control (or null). */
    function validateForm(form) {
      var first = null;
      $$('[data-rule]', form).forEach(function (el) {
        if (el.disabled) return; // e.g. the consent box when consent was already given
        if (!validateInput(el) && !first) first = el;
      });
      return first;
    }
    function clearFormErrors(form) {
      $$('[data-rule]', form).forEach(function (el) { setFieldError(el, ''); });
      delete form.dataset.submitted;
    }

    // blur → validate (only once the user typed something, or after a submit attempt)
    root.addEventListener('focusout', function (e) {
      var el = e.target;
      if (!el || !el.matches || !el.matches('[data-rule]') || el.type === 'checkbox') return;
      var form = el.form, field = el.closest('.field');
      var touched = String(el.value || '').trim() !== '' || (form && form.dataset.submitted) || (field && field.classList.contains('is-invalid'));
      if (!touched) return;
      validateInput(el);
      // tidy phone numbers into the national format shown beside the +62 prefix
      if (el.getAttribute('data-rule') === 'phone') {
        var n = U.normalizePhoneID(el.value);
        if (n) el.value = U.formatPhoneID(n).replace(/^\+62\s*/, '');
      }
    });
    // while a control is invalid, re-check as the user types (errors clear as soon as they are fixed)
    function onEdit(e) {
      var el = e.target;
      if (!el || !el.matches) return;
      if (el.matches('[data-rule]')) {
        var field = el.closest('.field');
        if (field && field.classList.contains('is-invalid')) validateInput(el);
      }
      if (el.id === 'd-pass') {
        updateStrength(el);
        var confirm = d.getElementById('d-pass2');
        if (confirm && confirm.value && (confirm.closest('.field').classList.contains('is-invalid') || (el.form && el.form.dataset.submitted))) validateInput(confirm);
      }
    }
    root.addEventListener('input', onEdit);
    root.addEventListener('change', onEdit);

    /* ------------------------------------------------------------------
       Password strength (Lemah / Sedang / Kuat)
       ------------------------------------------------------------------ */
    var meter = $('[data-strength]', root);
    function updateStrength(input) {
      if (!meter) return;
      var s = U.passwordStrength(input.value);
      var label = s.score <= 0 ? '' : s.score === 1 ? 'Lemah' : s.score === 2 ? 'Sedang' : 'Kuat';
      meter.setAttribute('data-level', String(s.score));
      var lbl = $('.strength__label', meter);
      if (lbl && lbl.textContent !== label) lbl.textContent = label;
    }

    /* ------------------------------------------------------------------
       Error alert region (above the forms, aria-live)
       ------------------------------------------------------------------ */
    function clearAlert(panel) {
      var slot = panel && $('[data-alert]', panel);
      if (slot && slot.firstChild) slot.innerHTML = '';
    }
    function clearAllAlerts() { clearAlert(panels.masuk); clearAlert(panels.daftar); }
    function showAlert(panel, err, opts) {
      opts = opts || {};
      var slot = panel && $('[data-alert]', panel);
      if (!slot) return;
      var msg = typeof err === 'string' ? err : (err && err.message) || 'Terjadi kendala saat memproses permintaan Anda. Silakan coba lagi.';
      var action = opts.action;
      slot.innerHTML =
        '<div class="alert alert--' + (opts.tone || 'err') + '">' +
          P.icon(opts.tone === 'info' ? 'info' : 'alert-triangle', { size: 18 }) +
          '<div>' +
            (opts.title ? '<p class="alert__title">' + h(opts.title) + '</p>' : '') +
            '<p>' + h(msg) + '</p>' +
            (action ? '<p class="alert__action"><button type="button" class="auth-link auth-link--strong" data-alert-action>' + h(action.label) + '</button></p>' : '') +
          '</div>' +
        '</div>';
      if (action) {
        var btn = $('[data-alert-action]', slot);
        btn.addEventListener('click', function () { clearAlert(panel); action.run(); });
      }
      UI.reveal(slot);
      var r = slot.getBoundingClientRect();
      var top = (parseFloat(w.getComputedStyle(d.documentElement).scrollPaddingTop) || 0);
      if (r.top < top || r.bottom > w.innerHeight) {
        try { slot.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { slot.scrollIntoView(); }
      }
    }
    function isCancel(err) {
      var c = err && err.code;
      return c === 'auth/popup-closed-by-user' || c === 'auth/cancelled-popup-request';
    }

    /* ------------------------------------------------------------------
       Success → welcome toast (shown on the destination page) → safe redirect
       ------------------------------------------------------------------ */
    function finish(user, btn, isNew) {
      busy = true;
      root.setAttribute('aria-busy', 'true');
      if (user) setPending(user.uid, false);
      // a new account (sign-up) continues to the membership form unless ?next= says otherwise
      var target = isNew ? signUpTarget() : nextTarget();
      var toForm = isNew && pageOf(target) === pageOf(postSignUpTarget());
      // UI.flash survives the redirect: the destination page shows the toast once it has loaded,
      // so the greeting stays readable instead of vanishing with this page
      UI.flash('Selamat datang, ' + displayName(user) + '.' +
        (toForm ? ' Akun Anda telah dibuat — lanjutkan dengan mengisi formulir pendaftaran anggota.' : ''),
        { type: 'success', timeout: toForm ? 7000 : 4200 });
      if (btn) {
        var label = btn.querySelector('.spinner + span');
        if (label) label.textContent = toForm ? 'Membuka formulir…' : 'Mengalihkan…';
      }
      setTimeout(function () { w.location.replace(target); }, reduced() ? 150 : 350);
    }

    /* ------------------------------------------------------------------
       New-account check after phone OTP / Google / email.
       signInWithPhoneNumber / signInWithPopup (and the demo equivalents)
       create an account for an unknown number or Google address, so the
       Masuk tab can register someone who never gave a name or consent.
       Such accounts — and any account still without a name — complete a
       short "Lengkapi profil" step before the redirect.
       ------------------------------------------------------------------ */
    var PENDING_KEY = 'ppapi_profile_pending';   // uids whose completion step was left unfinished (this browser)
    function pendingList() {
      var v = U.storage ? U.storage.get(PENDING_KEY, []) : [];
      return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string'; }) : [];
    }
    function isPending(uid) { return !!uid && pendingList().indexOf(uid) !== -1; }
    function setPending(uid, on) {
      if (!uid || !U.storage) return;
      var list = pendingList().filter(function (x) { return x !== uid; });
      if (on) list.push(uid);
      if (list.length) U.storage.set(PENDING_KEY, list.slice(-20)); else U.storage.remove(PENDING_KEY);
    }

    /**
     * Snapshot taken right before an auth call that may create an account: the time and, in demo
     * mode, the uids already stored in localStorage 'ppapi_demo_users' (the SPEC's demo storage).
     */
    function authStart() {
      var snap = { at: new Date().getTime(), uids: null };
      if (A.mode === 'demo') {
        try {
          var map = JSON.parse(w.localStorage.getItem('ppapi_demo_users') || '{}');
          if (map && typeof map === 'object') snap.uids = Object.keys(map).map(function (k) { return map[k] && map[k].uid; }).filter(Boolean);
        } catch (e) { snap.uids = null; }
      }
      return snap;
    }
    function createdSince(user, at, slack) {
      var c = Date.parse((user && user.createdAt) || '');
      return !isNaN(c) && c >= (at || 0) - (slack || 0);
    }
    /** true when the sign-in that just finished created the account */
    function detectNew(user, start) {
      if (!user) return Promise.resolve(false);
      if (typeof user.isNewUser === 'boolean') return Promise.resolve(user.isNewUser);
      start = start || { at: 0, uids: null };
      if (A.mode === 'firebase' && typeof A._firebase === 'function') {
        // Firebase: a brand-new account signs in at the moment it is created
        // (metadata.creationTime === lastSignInTime); server times, so no client clock skew
        return Promise.resolve(A._firebase()).then(function (fx) {
          var m = fx && fx.auth && fx.auth.currentUser && fx.auth.currentUser.metadata;
          var c = m && Date.parse(m.creationTime), l = m && Date.parse(m.lastSignInTime);
          if (!c || !l || isNaN(c) || isNaN(l)) return createdSince(user, start.at, 5000);
          return Math.abs(l - c) < 5000;
        }, function () { return createdSince(user, start.at, 5000); });
      }
      // demo: the uid was not stored before this call → the call created it (fallback: its creation time)
      if (start.uids) return Promise.resolve(start.uids.indexOf(user.uid) === -1);
      return Promise.resolve(createdSince(user, start.at, 0));
    }
    /**
     * ctx: { via: 'email'|'phone'|'google', consent: bool (the flow already collected consent),
     *        signUp: bool (email sign-up — always a new account), start: authStart(), btn }
     * resolves to null (nothing to complete) or { isNew, needName, needConsent }.
     * Sets ctx.isNew (the call created the account, or it is an unfinished new account from an
     * earlier attempt in this browser) — such accounts continue to the membership form.
     */
    function needsCompletion(user, ctx) {
      if (!user) return Promise.resolve(null);
      var noName = !cleanName(user.name);
      var pending = isPending(user.uid);
      var check = ctx.signUp ? Promise.resolve(true) : ctx.via === 'email' ? Promise.resolve(false) : detectNew(user, ctx.start);
      return check.then(function (isNew) {
        ctx.isNew = !!isNew || pending;
        var needConsent = !ctx.consent && (isNew || noName || pending);
        if (!noName && !needConsent) { if (pending) setPending(user.uid, false); return null; }
        return { isNew: !!isNew, needName: noName, needConsent: needConsent };
      }, function () {
        ctx.isNew = pending;
        return noName ? { isNew: false, needName: true, needConsent: !ctx.consent } : null;
      });
    }
    /** every successful sign-in / sign-up goes through here */
    function afterAuth(user, ctx) {
      return needsCompletion(user, ctx).then(function (need) {
        if (!need) { finish(user, ctx.btn, ctx.isNew); return; }
        busy = false;
        UI.setLoading(ctx.btn, false);
        showComplete(user, need, ctx);
      });
    }

    /* ------------------------------------------------------------------
       Method switch: Email | Nomor HP (kept in sync across both tabs)
       ------------------------------------------------------------------ */
    var method = 'email';
    function setMethod(m) {
      method = m === 'phone' ? 'phone' : 'email';
      $$('[data-method-switch]', root).forEach(function (seg) {
        $$('.segmented__option', seg).forEach(function (o) {
          o.setAttribute('aria-pressed', o.getAttribute('data-value') === method ? 'true' : 'false');
        });
      });
      $$('[data-method-pane]', root).forEach(function (pane) {
        pane.hidden = pane.getAttribute('data-method-pane') !== method;
      });
      clearAllAlerts();
    }
    root.addEventListener('segmented:change', function (e) {
      if (e.target && e.target.closest && e.target.closest('[data-method-switch]')) setMethod(e.detail && e.detail.value);
    });

    /* ------------------------------------------------------------------
       Tabs: Masuk | Daftar  (hash #daftar handled by ui.tabs + data-tab-hash)
       ------------------------------------------------------------------ */
    var mEmail = d.getElementById('m-email'), mPass = d.getElementById('m-pass');
    var dEmail = d.getElementById('d-email');
    var mPhone = d.getElementById('mp-phone'), dPhone = d.getElementById('dp-phone');
    var BASE_TITLE = { masuk: 'Masuk — PPAPI', daftar: 'Daftar Anggota — PPAPI' };

    function onTab(key) {
      clearAllAlerts();
      // carry what the visitor already typed to the other tab
      var pairs = key === 'daftar' ? [[mEmail, dEmail], [mPhone, dPhone]] : [[dEmail, mEmail], [dPhone, mPhone]];
      pairs.forEach(function (p) { if (p[0] && p[1] && p[0].value && !p[1].value) p[1].value = p[0].value; });
      if (BASE_TITLE[key]) d.title = BASE_TITLE[key];
    }
    if (tabsEl) tabsEl.addEventListener('tabs:change', function (e) { onTab(e.detail && e.detail.key); });
    if (BASE_TITLE[currentTab()]) d.title = BASE_TITLE[currentTab()];

    function goTab(key, focusTab) {
      if (!tabs || completing) return; // the "Lengkapi profil" step owns the card until it is done or cancelled
      tabs.select(key);
      var tab = d.getElementById('tab-' + key);
      if (focusTab && tab) { try { tab.focus({ preventScroll: true }); } catch (e) { tab.focus(); } }
      var card = $('.auth-card', root);
      if (card) {
        var r = card.getBoundingClientRect();
        if (r.top < 0 || r.top > w.innerHeight * 0.6) {
          try { card.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { card.scrollIntoView(); }
        }
      }
    }
    root.addEventListener('click', function (e) {
      var sw = e.target.closest && e.target.closest('[data-switch]');
      if (sw) { e.preventDefault(); goTab(sw.getAttribute('data-switch'), true); }
    });
    // header / mobile-menu links to this very page (masuk.html, masuk.html#daftar) switch tabs in place,
    // keeping ?next= and anything already typed instead of reloading the page
    d.addEventListener('click', function (e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || root.contains(a) || a.target === '_blank') return;
      var url;
      try { url = new URL(a.getAttribute('href'), w.location.href); } catch (er) { return; }
      if (url.origin !== w.location.origin || url.pathname !== w.location.pathname) return;
      e.preventDefault();
      goTab(url.hash === '#daftar' ? 'daftar' : 'masuk', false);
    });

    /* ------------------------------------------------------------------
       Context notes: ?next= destination, Mode Demo, Firebase load errors
       ------------------------------------------------------------------ */
    /* "?next=" note — wording follows the tab: Masuk continues to the page; Daftar explains where a
       NEW account goes (the membership form, also when the page is for active members only). */
    var PAGE_NAMES = {
      'anggota.html': 'Profil Anggota', 'dashboard.html': 'Dasbor Anggota',
      'pendaftaran.html': 'Formulir Pendaftaran Anggota', 'pustaka.html': 'Produk Pengetahuan',
      'admin.html': 'Konsol Admin', 'verifikasi.html': 'Verifikasi Anggota',
      'aplikasi/perencanaan/index.html': 'Aplikasi PPAPI Scaffold',
      'aplikasi/simulator/index.html': 'Simulator Pemasangan Perancah'
    };
    function nameOf(target) {
      if (/^anggota\.html#aplikasi$/i.test(target)) return 'Aplikasi Anggota';
      return PAGE_NAMES[pageOf(target)] || '';
    }
    function renderNextNote(tab) {
      var note = $('[data-next-note]', root);
      if (!note) return;
      var nx = explicitNext();
      var txt = $('[data-next-text]', note);
      var formName = PAGE_NAMES[pageOf(postSignUpTarget())] || 'formulir pendaftaran anggota';
      var html = '';
      if (nx && nx !== 'dashboard.html') {
        var name = nameOf(nx);
        if (tab === 'daftar') {
          var dest = signUpTarget();
          html = dest === nx
            ? 'Setelah akun dibuat, Anda diarahkan ke <strong>' + h(name || 'halaman yang Anda tuju') + '</strong>.'
            : (name ? '<strong>' + h(name) + '</strong> terbuka setelah keanggotaan Anda Aktif. ' : '') +
              'Setelah akun dibuat, Anda diarahkan ke <strong>' + h(formName) + '</strong>.';
        } else {
          html = name
            ? 'Silakan masuk untuk melanjutkan ke <strong>' + h(name) + '</strong>.'
            : 'Silakan masuk untuk melanjutkan ke halaman yang Anda tuju.';
        }
      }
      if (txt && html) txt.innerHTML = html;
      note.hidden = !html;
    }
    renderNextNote(currentTab());
    if (tabsEl) tabsEl.addEventListener('tabs:change', function (e) { renderNextNote(e.detail && e.detail.key); });

    (function () {
      var demo = $('[data-demo-note]');
      if (demo) demo.hidden = !isDemo;
      $$('[data-demo-only]', root).forEach(function (el) { el.hidden = !isDemo; });
      if (A.error && A.error.message) {
        showAlert(panels.masuk, A.error, { title: 'Layanan masuk belum siap' });
        showAlert(panels.daftar, A.error, { title: 'Layanan masuk belum siap' });
      }
    })();

    /* ------------------------------------------------------------------
       Mode Demo: seeded admin account (PPAPI.auth.demoAdmin) — copy each
       value, or fill the Masuk form with it (the visitor still presses Masuk)
       ------------------------------------------------------------------ */
    (function () {
      var box = $('[data-demo-admin]');
      var acc = isDemo && A.demoAdmin;
      if (!box) return;
      if (!acc || !acc.email || !acc.password) { box.hidden = true; return; }
      var emailEl = $('[data-demo-admin-email]', box), passEl = $('[data-demo-admin-pass]', box);
      if (emailEl) emailEl.textContent = acc.email;
      if (passEl) passEl.textContent = acc.password;
      box.hidden = false;
      box.addEventListener('click', function (e) {
        var cp = e.target.closest && e.target.closest('[data-demo-copy]');
        if (cp) {
          var isPass = cp.getAttribute('data-demo-copy') === 'password';
          U.copyText(isPass ? acc.password : acc.email).then(function (ok) {
            UI.toast(ok ? (isPass ? 'Kata sandi admin demo disalin.' : 'Email admin demo disalin.') : 'Gagal menyalin. Salin secara manual.', { type: ok ? 'success' : 'error' });
          });
          return;
        }
        if (e.target.closest && e.target.closest('[data-demo-admin-fill]')) {
          if (busy || completing) return;
          goTab('masuk', false);
          setMethod('email');
          var form = $('[data-form="masuk-email"]', root);
          mEmail.value = acc.email;
          mPass.value = acc.password;
          if (form) clearFormErrors(form);
          var submit = form && $('button[type="submit"]', form);
          if (submit) { try { submit.focus({ preventScroll: true }); } catch (er) { submit.focus(); } }
          var card = $('.auth-card', root);
          if (card) {
            var r = card.getBoundingClientRect();
            if (r.top < 0 || r.bottom > w.innerHeight) {
              try { card.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); } catch (er) { card.scrollIntoView(); }
            }
          }
          UI.toast('Formulir terisi dengan akun admin demo. Tekan “Masuk” untuk melanjutkan.', { type: 'info' });
        }
      });
    })();

    /* ------------------------------------------------------------------
       MASUK · Email
       ------------------------------------------------------------------ */
    var masukForm = $('[data-form="masuk-email"]', root);
    if (masukForm) masukForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var panel = panels.masuk;
      masukForm.dataset.submitted = '1';
      clearAlert(panel);
      var bad = validateForm(masukForm);
      if (bad) { bad.focus(); return; }
      var btn = $('button[type="submit"]', masukForm);
      var email = mEmail.value.trim();
      busy = true;
      UI.setLoading(btn, true, 'Memeriksa…');
      A.signInEmail({ email: email, password: mPass.value, remember: !!(d.getElementById('m-remember') || {}).checked })
        .then(function (user) { afterAuth(user, { via: 'email', consent: false, btn: btn }); }, function (err) {
          busy = false;
          UI.setLoading(btn, false);
          var code = err && err.code;
          showAlert(panel, err, {
            title: 'Gagal masuk',
            action: code === 'auth/user-not-found' ? {
              label: 'Daftar dengan email ini',
              run: function () { if (!dEmail.value) dEmail.value = email; goTab('daftar', false); d.getElementById('d-name').focus(); }
            } : null
          });
          if (code === 'auth/invalid-email' || code === 'auth/missing-email') mEmail.focus();
          else { mPass.focus(); try { mPass.select(); } catch (er) { /* ignore */ } }
        });
    });

    /* "Lupa kata sandi?" → modal → PPAPI.auth.resetPassword */
    var forgotBtn = $('[data-forgot]', root);
    if (forgotBtn) forgotBtn.addEventListener('click', function () {
      var prefill = U.isEmail(mEmail.value) ? mEmail.value.trim() : '';
      var modal = UI.modal({
        title: 'Atur ulang kata sandi',
        eyebrow: 'Bantuan akun',
        size: 'sm',
        cls: 'auth-modal',
        body:
          '<div data-forgot-body>' +
            '<p>Masukkan alamat email akun Anda. Kami akan mengirimkan tautan untuk membuat kata sandi baru.</p>' +
            '<form class="form" method="post" novalidate data-forgot-form>' +
              '<div class="field">' +
                '<label class="field__label" for="fp-email">Email</label>' +
                '<div class="input-icon">' + P.icon('mail', { size: 18 }) +
                  '<input class="field__control" id="fp-email" name="email" type="email" inputmode="email" autocomplete="email" autocapitalize="none" spellcheck="false" placeholder="nama@domain.id" required data-rule="email" value="' + h(prefill) + '">' +
                '</div>' +
                '<p class="field__error" id="fp-email-err"></p>' +
              '</div>' +
              '<button type="submit" hidden tabindex="-1">Kirim</button>' +
            '</form>' +
          '</div>',
        actions: [
          { label: 'Batal', variant: 'ghost' },
          { label: 'Kirim tautan', variant: 'primary', onClick: function (close, ctx) { return submitForgot(ctx); } }
        ],
        onOpen: function (el) {
          var form = $('[data-forgot-form]', el);
          var input = $('#fp-email', el);
          form.addEventListener('submit', function (ev) {
            ev.preventDefault();
            var primary = $('.modal__footer .btn--primary', el);
            if (primary && !primary.disabled && !primary.hidden) primary.click();
          });
          input.addEventListener('input', function () { if (input.closest('.field').classList.contains('is-invalid')) validateInput(input); });
        }
      });
      return modal;
    });
    function submitForgot(ctx) {
      var el = ctx.el, input = $('#fp-email', el);
      if (!input) return false;
      if (!validateInput(input)) { input.focus(); return false; }
      var email = input.value.trim();
      return A.resetPassword(email).then(function () {
        var body = $('[data-forgot-body]', el);
        if (body) {
          body.innerHTML =
            '<div class="auth-sent" role="status">' +
              '<span class="auth-sent__icon">' + P.icon('mail', { size: 22 }) + '</span>' +
              '<p class="auth-sent__title">Periksa kotak masuk Anda</p>' +
              '<p>Jika <strong>' + h(email) + '</strong> terdaftar, tautan untuk mengatur ulang kata sandi telah dikirim. Periksa juga folder spam atau promosi.</p>' +
              (isDemo ? '<p class="auth-sent__demo">Mode Demo: tidak ada email yang benar-benar dikirim. Akun demo tersimpan di peramban ini; bila lupa kata sandi, silakan daftar dengan email lain.</p>' : '') +
            '</div>';
        }
        ctx.button.hidden = true;
        var closeBtn = $('.modal__footer .btn--ghost', el);
        if (closeBtn) {
          closeBtn.innerHTML = '<span>Tutup</span>';
          closeBtn.className = 'btn btn--primary';
          setTimeout(function () { try { closeBtn.focus({ preventScroll: true }); } catch (e) { closeBtn.focus(); } }, 20);
        }
        if (!mEmail.value) mEmail.value = email;
        return false;
      }, function (err) {
        setFieldError(input, (err && err.message) || 'Tautan belum dapat dikirim. Silakan coba lagi.');
        input.focus();
        return false;
      });
    }

    /* ------------------------------------------------------------------
       DAFTAR · Email
       ------------------------------------------------------------------ */
    var daftarForm = $('[data-form="daftar-email"]', root);
    if (daftarForm) daftarForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;
      var panel = panels.daftar;
      daftarForm.dataset.submitted = '1';
      clearAlert(panel);
      var bad = validateForm(daftarForm);
      if (bad) { bad.focus(); return; }
      var btn = $('button[type="submit"]', daftarForm);
      var email = dEmail.value.trim();
      busy = true;
      UI.setLoading(btn, true, 'Membuat akun…');
      A.signUpEmail({ name: cleanName(d.getElementById('d-name').value), email: email, password: d.getElementById('d-pass').value, remember: true })
        .then(function (user) { afterAuth(user, { via: 'email', consent: true, signUp: true, btn: btn }); }, function (err) {
          busy = false;
          UI.setLoading(btn, false);
          var code = err && err.code;
          showAlert(panel, err, {
            title: 'Pendaftaran belum berhasil',
            action: code === 'auth/email-already-in-use' ? {
              label: 'Masuk dengan email ini',
              run: function () { mEmail.value = email; goTab('masuk', false); mPass.focus(); }
            } : null
          });
          if (code === 'auth/invalid-email' || code === 'auth/email-already-in-use') dEmail.focus();
          else if (code === 'auth/weak-password') d.getElementById('d-pass').focus();
          else if (code === 'auth/missing-name') d.getElementById('d-name').focus();
        });
    });

    /* ------------------------------------------------------------------
       Google (both tabs) — signInGoogle() is called synchronously inside the
       click handler so the Firebase popup keeps the user activation.
       ------------------------------------------------------------------ */
    $$('[data-google]', root).forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (busy) return;
        var panel = btn.closest('[data-panel]');
        clearAlert(panel);
        var pending, start = authStart();
        try { pending = A.signInGoogle(); } catch (err) { pending = Promise.reject(err); }
        busy = true;
        UI.setLoading(btn, true, 'Menghubungkan…');
        Promise.resolve(pending).then(function (user) { afterAuth(user, { via: 'google', consent: panel === panels.daftar, start: start, btn: btn }); }, function (err) {
          busy = false;
          UI.setLoading(btn, false);
          if (!isCancel(err)) showAlert(panel, err, { title: 'Masuk dengan Google belum berhasil' });
          try { btn.focus({ preventScroll: true }); } catch (e) { btn.focus(); }
        });
      });
    });

    /* ------------------------------------------------------------------
       Nomor HP + OTP (one flow per tab)
       Firebase note: the invisible reCAPTCHA is rendered into the button
       passed as buttonEl. Re-rendering into an element that already hosted
       a (since cleared) verifier fails, so such a button is swapped for a
       fresh clone first. Listeners are delegated, so clones keep working.
       ------------------------------------------------------------------ */
    var rc = { used: [], last: null, failed: false };
    function recaptchaButton(btn) {
      if (A.mode !== 'firebase' || !btn) return btn;
      if (rc.used.indexOf(btn) !== -1 && (rc.last !== btn || rc.failed)) {
        var fresh = btn.cloneNode(true);
        btn.parentNode.replaceChild(fresh, btn);
        return fresh;
      }
      return btn;
    }
    function recaptchaDone(btn, ok) {
      if (A.mode !== 'firebase' || !btn) return;
      if (rc.used.indexOf(btn) === -1) rc.used.push(btn);
      rc.last = btn;
      rc.failed = !ok;
    }

    function PhoneFlow(box) {
      var kind = box.getAttribute('data-phone-flow');
      var panel = box.closest('[data-panel]');
      var step1 = $('[data-phone-step="1"]', box), step2 = $('[data-phone-step="2"]', box);
      var phoneEl = $('[data-rule="phone"]', step1);
      var nameEl = $('[data-rule="name"]', step1);
      var otpEl = $('[data-otp]', step2);
      var otpErr = $('.field__error', otpEl.closest('.field'));
      var target = $('[data-otp-target]', step2);
      var timer = null, until = 0;
      var otp = UI.otp(otpEl, {
        length: 6,
        onChange: function () { if (otpEl.closest('.field').classList.contains('is-invalid')) setOtpError(''); },
        onComplete: function () { if (!busy) verify(); }
      });

      var otpBaseDesc = otpEl.getAttribute('aria-describedby') || '';
      function setOtpError(msg) {
        var field = otpEl.closest('.field');
        field.classList.toggle('is-invalid', !!msg);
        if (otpErr) otpErr.textContent = msg || '';
        var ids = otpBaseDesc.split(/\s+/).filter(Boolean);
        if (msg && otpErr) ids.push(otpErr.id);
        if (ids.length) otpEl.setAttribute('aria-describedby', ids.join(' ')); else otpEl.removeAttribute('aria-describedby');
        otp.inputs.forEach(function (x) { if (msg) x.setAttribute('aria-invalid', 'true'); else x.removeAttribute('aria-invalid'); });
      }

      function fmt(s) { return Math.floor(s / 60) + ':' + U.pad(s % 60); }
      function resendBtn() { return $('[data-resend]', step2); }
      function tick() {
        var btn = resendBtn();
        if (!btn) return;
        var left = Math.max(0, Math.ceil((until - Date.now()) / 1000));
        if (left > 0) {
          btn.disabled = true;
          btn.innerHTML = 'Kirim ulang dalam <span class="auth-countdown">' + fmt(left) + '</span>';
        } else {
          stopCountdown();
          btn.disabled = false;
          btn.textContent = 'Kirim ulang kode';
        }
      }
      function startCountdown() { stopCountdown(); until = Date.now() + COUNTDOWN * 1000; tick(); timer = setInterval(tick, 1000); }
      function stopCountdown() { if (timer) { clearInterval(timer); timer = null; } }
      function endCountdownNow() { until = 0; tick(); }

      function toStep1(focus) {
        stopCountdown();
        otp.clear();
        setOtpError('');
        step2.hidden = true;
        step1.hidden = false;
        if (focus) phoneEl.focus();
      }
      function toStep2() {
        clearFormErrors(step2);
        step1.hidden = true;
        step2.hidden = false;
        UI.reveal(step2);
      }

      function send(isResend) {
        if (busy) return;
        clearAlert(panel);
        if (!isResend) {
          step1.dataset.submitted = '1';
          var bad = validateForm(step1);
          if (bad) { bad.focus(); return; }
        }
        var e164 = U.normalizePhoneID(phoneEl.value);
        if (!e164) { toStep1(true); validateInput(phoneEl); return; }
        var btn = recaptchaButton(isResend ? resendBtn() : $('[data-send-otp]', step1));
        busy = true;
        UI.setLoading(btn, true, isResend ? 'Mengirim ulang…' : 'Mengirim kode…');
        A.startPhone({ phone: e164, buttonEl: btn }).then(function (res) {
          recaptchaDone(btn, true);
          busy = false;
          UI.setLoading(btn, false);
          if (target) target.textContent = (res && res.masked) || U.maskPhone(e164);
          otp.clear();
          setOtpError('');
          if (!isResend) toStep2();
          startCountdown();
          otp.focus();
          if (isResend && !isDemo) UI.toast('Kode OTP baru telah dikirim.', { type: 'success' });
        }, function (err) {
          recaptchaDone(btn, false);
          busy = false;
          UI.setLoading(btn, false);
          showAlert(panel, err, { title: 'Kode OTP belum terkirim' });
          if (isResend) endCountdownNow();
          else if (/phone/.test((err && err.code) || '')) phoneEl.focus();
        });
      }

      function verify() {
        if (busy) return;
        clearAlert(panel);
        var code = otp.value();
        if (!/^\d{6}$/.test(code)) { setOtpError('Masukkan 6 digit kode OTP.'); otp.focus(); return; }
        setOtpError('');
        var btn = $('[data-verify]', step2);
        busy = true;
        UI.setLoading(btn, true, 'Memverifikasi…');
        otp.disable(true);
        var opts = { code: code, remember: true }, start = authStart();
        if (kind === 'daftar' && nameEl) opts.name = cleanName(nameEl.value);
        A.confirmPhone(opts).then(function (user) { afterAuth(user, { via: 'phone', consent: kind === 'daftar', start: start, btn: btn }); }, function (err) {
          busy = false;
          UI.setLoading(btn, false);
          otp.disable(false);
          var c = (err && err.code) || '';
          showAlert(panel, err, { title: 'Verifikasi belum berhasil' });
          if (c === 'auth/code-expired' || c === 'auth/missing-verification-id') {
            otp.clear();
            endCountdownNow();
            var rb = resendBtn();
            if (rb) rb.focus();
          } else {
            otp.clear();
            otp.setInvalid(true);
            otp.focus();
          }
        });
      }

      step1.addEventListener('submit', function (e) { e.preventDefault(); send(false); });
      step2.addEventListener('submit', function (e) { e.preventDefault(); verify(); });
      step2.addEventListener('click', function (e) {
        if (e.target.closest('[data-change-number]')) { e.preventDefault(); clearAlert(panel); toStep1(true); return; }
        var rb = e.target.closest('[data-resend]');
        if (rb && !rb.disabled) { e.preventDefault(); send(true); }
      });

      return { reset: function () { otp.disable(false); toStep1(false); } };
    }
    var phoneFlows = $$('[data-phone-flow]', root).map(function (box) { return PhoneFlow(box); });

    /* ------------------------------------------------------------------
       LENGKAPI PROFIL — name (≥ 3 characters) + Kebijakan Privasi consent
       for an account the Masuk tab just created (or one still nameless),
       then auth.updateName() → finish(). The card swaps its tabs for this
       step; "Keluar" signs out and brings the tabs back.
       ------------------------------------------------------------------ */
    var completeEl = $('[data-complete]', root);
    var completeForm = completeEl && $('[data-form="complete"]', completeEl);
    var cName = d.getElementById('c-name'), cAgree = d.getElementById('c-agree');
    var completing = null; // { user, need, ctx }

    function showComplete(user, need, ctx) {
      if (!completeEl || !completeForm || !tabsEl) { finish(user, ctx.btn); return; }
      completing = { user: user, need: need, ctx: ctx };
      setPending(user.uid, true);

      var via = ctx.via, consentPart = need.needConsent ? ' dan setujui Kebijakan Privasi PPAPI' : '';
      var text;
      if (need.isNew) {
        text = (via === 'phone' ? 'Nomor HP ini belum terdaftar' : via === 'google' ? 'Akun Google ini belum terdaftar' : 'Akun ini belum terdaftar') +
          ', sehingga akun baru telah dibuat untuk Anda. Lengkapi nama lengkap Anda' + consentPart + ' untuk menyelesaikan pendaftaran.';
      } else {
        text = 'Profil akun Anda belum lengkap. Lengkapi nama lengkap Anda' + consentPart + ' sebelum melanjutkan.';
      }
      var txt = $('[data-complete-text]', completeEl);
      if (txt) txt.textContent = text;
      var label = $('[data-complete-label]', completeEl), id = $('[data-complete-id]', completeEl);
      var phone = user.phone ? U.formatPhoneID(user.phone) : '';
      if (label) label.textContent = via === 'phone' && phone ? 'Nomor HP terverifikasi' : via === 'google' ? 'Akun Google' : user.email ? 'Email' : 'Nomor HP';
      if (id) id.textContent = (via === 'phone' && phone) ? phone : (user.email || phone || '');
      if (id) id.closest('.auth-complete__who').hidden = !id.textContent;

      clearFormErrors(completeForm);
      clearAlert(completeEl);
      cName.value = cleanName(user.name);
      var agreeField = $('[data-complete-agree]', completeEl);
      cAgree.checked = false;
      cAgree.disabled = !need.needConsent;
      if (agreeField) agreeField.hidden = !need.needConsent;

      tabsEl.hidden = true;
      completeEl.hidden = false;
      root.removeAttribute('aria-busy');
      d.title = 'Lengkapi Profil — PPAPI';
      UI.reveal(completeEl);
      var card = $('.auth-card', root), head = d.getElementById('complete-title');
      if (card) {
        var r = card.getBoundingClientRect();
        if (r.top < 0 || r.top > w.innerHeight * 0.6) {
          try { card.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { card.scrollIntoView(); }
        }
      }
      // announce the new step (heading + its intro) before the visitor tabs into the name field
      if (head) { try { head.focus({ preventScroll: true }); } catch (e) { head.focus(); } }
    }

    function exitComplete(note) {
      if (!completing) return;
      completing = null;
      busy = false;
      root.removeAttribute('aria-busy');
      completeEl.hidden = true;
      tabsEl.hidden = false;
      phoneFlows.forEach(function (f) { if (f) f.reset(); });
      $$('[data-google]', root).forEach(function (b) { UI.setLoading(b, false); });
      goTab('masuk', true);
      if (BASE_TITLE.masuk) d.title = BASE_TITLE.masuk;
      if (note) showAlert(panels.masuk, note.text, { tone: 'info', title: note.title });
    }

    if (completeForm) completeForm.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy || !completing) return;
      completeForm.dataset.submitted = '1';
      clearAlert(completeEl);
      var bad = validateForm(completeForm);
      if (bad) { bad.focus(); return; }
      var btn = $('button[type="submit"]', completeForm);
      var user = A.current() || completing.user;
      var name = cleanName(cName.value);
      busy = true;
      UI.setLoading(btn, true, 'Menyimpan…');
      var save = name !== cleanName(user && user.name) ? A.updateName(name) : Promise.resolve(user);
      var wasNew = !!(completing.ctx && completing.ctx.isNew) || !!(completing.need && completing.need.isNew);
      Promise.resolve(save).then(function (u) {
        completing = null;
        finish(u || A.current() || user, btn, wasNew);
      }, function (err) {
        busy = false;
        UI.setLoading(btn, false);
        showAlert(completeEl, err, { title: 'Profil belum tersimpan' });
        if ((err && err.code) === 'auth/no-current-user') return;
        cName.focus();
      });
    });

    var cancelBtn = completeEl && $('[data-complete-cancel]', completeEl);
    if (cancelBtn) cancelBtn.addEventListener('click', function () {
      if (busy || !completing) return;
      busy = true;
      cancelBtn.disabled = true;
      Promise.resolve(A.signOut()).then(function () {
        cancelBtn.disabled = false;
        exitComplete(SIGNED_OUT_NOTE);
      }, function (err) {
        busy = false;
        cancelBtn.disabled = false;
        showAlert(completeEl, err, { title: 'Belum dapat keluar' });
      });
    });
    var SIGNED_OUT_NOTE = {
      title: 'Anda telah keluar',
      text: 'Pendaftaran belum diselesaikan. Saat Anda masuk kembali dengan akun tersebut di peramban ini, kami akan meminta Anda melengkapinya.'
    };
    // signed out elsewhere (header account menu, another tab) while the step is open → back to the tabs
    A.onChange(function (u) { if (completing && !u) exitComplete(SIGNED_OUT_NOTE); });

    UI.reveal(root);
  });
})(window, document);
