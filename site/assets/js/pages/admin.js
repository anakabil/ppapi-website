/* ==========================================================================
   PPAPI — admin.js  (Konsol Admin · body[data-page="admin"], data-auth="admin")
   Core of the console: shared state & data loading, hash navigation
   (#ringkasan · #permohonan · #anggota · #konten/<jenis> · #umpan-balik ·
   #admin · #log), render/dialog helpers, and the sections Ringkasan,
   Umpan Balik, Admin and Log Aktivitas.
   admin-anggota.js → Permohonan + Anggota (detail drawer & decisions)
   admin-konten.js  → Konten (berita, pengumuman, agenda, pustaka, regulasi)
   admin-instruktur.js → Instruktur (#instruktur/profil · #instruktur/permintaan)
   Bagian tambahan: window.PPAPI_ADMIN_SECTIONS = [{ key, label, icon, title (HTML tepercaya,
   boleh <em>), lead, render(container, sub) → (Promise), badge() → Promise<number> | count() → number,
   countLabel? }] — admin.js memasang menu, kerangka bagian, dan penghitungnya (mountExtraSections).
   Bagian yang sudah punya markup di admin.html (mis. Instruktur) hanya didaftarkan.
   Every data string is escaped with PPAPI.util.h().
   ========================================================================== */
(function (w, d) {
  'use strict';

  var PPAPI = w.PPAPI;
  if (!PPAPI || !PPAPI.util) return;
  var K = w.PPAPI_KONSOL = w.PPAPI_KONSOL || { sections: {} };
  K.sections = K.sections || {};

  var util = PPAPI.util, ui = PPAPI.ui, h = util.h, icon = PPAPI.icon;
  var SECTIONS = ['ringkasan', 'permohonan', 'anggota', 'konten', 'umpan-balik', 'admin', 'log', 'instruktur'];
  K.SECTIONS = SECTIONS;

  /* ---------------------------------------------------------------- state */
  K.state = { members: null, feedback: null, admins: null, audit: null, errors: {} };
  K.route = { section: 'ringkasan', sub: '' };

  function store() { return PPAPI.store; }
  K.store = store;
  K.isDemo = function () { return !!(PPAPI.auth && PPAPI.auth.mode !== 'firebase'); };
  K.me = function () { var s = PPAPI.session && PPAPI.session.current ? PPAPI.session.current() : null; return s && s.user ? s.user : (PPAPI.auth.current() || {}); };

  /* ------------------------------------------------------------- loaders */
  var LOADERS = {
    members: function () { return store().admin.listMembers(); },
    feedback: function () { return store().admin.listFeedback(); },
    admins: function () { return store().admin.listAdmins(); },
    audit: function () { return store().admin.audit(300); }
  };
  /** load(['members','feedback',…] | 'all') → fills K.state; errors kept per dataset (never throws). */
  K.load = async function (what) {
    var keys = what === 'all' || !what ? Object.keys(LOADERS) : (Array.isArray(what) ? what : [what]);
    await Promise.all(keys.map(function (k) {
      return LOADERS[k]().then(function (v) {
        K.state[k] = Array.isArray(v) ? v : [];
        delete K.state.errors[k];
      }, function (err) {
        console.error(err);
        K.state.errors[k] = err;
        if (K.state[k] === null) K.state[k] = [];
      });
    }));
  };
  /** After an action: reload the given datasets (+ audit), re-render the visible section and nav counts. */
  K.after = async function (what, message, type) {
    var keys = (Array.isArray(what) ? what : [what]).filter(Boolean);
    if (keys.indexOf('audit') === -1) keys.push('audit');
    await K.load(keys);
    K.renderCounts();
    K.renderCurrent();
    if (message) { ui.toast(message, { type: type || 'success' }); K.announce(message); }
  };

  /* -------------------------------------------------------------- helpers */
  K.h = h;
  K.icon = icon;
  K.announce = function (text) {
    var el = d.getElementById('adm-announce');
    if (!el) return;
    el.textContent = '';
    setTimeout(function () { el.textContent = text; }, 60);
  };
  K.date = function (iso, opts) { return iso ? util.formatDate(iso, opts || { short: true }) : ''; };
  K.dateTime = function (iso) { return iso ? util.formatDate(iso, { short: true, time: true }) : ''; };
  K.rel = function (iso) { return iso ? util.relativeTime(iso) : ''; };
  K.timeTag = function (iso, opts) {
    if (!iso) return '<span class="adm-dim">—</span>';
    return '<time datetime="' + h(String(iso)) + '">' + h(K.date(iso, opts)) + '</time>';
  };
  K.eff = function (m) { return util.effectiveStatus(m); };
  K.isAdminUid = function (uid) { return (K.state.admins || []).some(function (a) { return a.uid === uid; }); };
  K.adminBadge = function (m) { return m && K.isAdminUid(m.uid) ? ' <span class="badge badge--metal">Admin</span>' : ''; };
  K.statusBadge = function (m) { return util.statusBadge(K.eff(m)); };
  K.initials = function (name) { return util.initials(String(name || '').replace(/\(contoh\)/i, '').trim() || '?'); };
  /** person cell: avatar (pas foto or initials) + name (button opening the detail) + secondary line */
  K.person = function (m, o) {
    o = o || {};
    var photo = m.application && m.application.pasFoto;
    var av = photo
      ? '<span class="avatar adm-person__avatar" aria-hidden="true"><img src="' + h(photo) + '" alt="" width="36" height="36" decoding="async"></span>'
      : '<span class="avatar adm-person__avatar" aria-hidden="true">' + h(K.initials(m.name || m.email)) + '</span>';
    var name = h(m.name || '(tanpa nama)');
    var nameHtml = o.open
      ? '<button type="button" class="adm-person__name" data-open="' + h(o.open) + '" data-id="' + h(m.uid) + '">' + name + '</button>'
      : '<span class="adm-person__name">' + name + '</span>';
    return '<div class="adm-person">' + av + '<div class="adm-person__text">' +
      '<span class="adm-person__line">' + nameHtml + (o.badges || '') + util.contohBadge(m) + '</span>' +
      '<span class="adm-person__sub">' + h(o.sub !== undefined ? o.sub : (m.email || util.formatPhoneID(m.phone) || '')) + '</span>' +
      '</div></div>';
  };
  K.empty = function (o) { return ui.emptyState(o); };
  /** compact empty line for a card inside an overview (K.empty is reserved for full-section lists) */
  K.emptyLine = function (ic, text) { return '<p class="adm-empty-line">' + icon(ic, { size: 16 }) + '<span>' + h(text) + '</span></p>'; };
  /** After a dialog/drawer closes: when its trigger was re-rendered away, focus the same control in the
      fresh markup (selector) or the visible section heading, so keyboard users never land on <body>. */
  K.restoreFocus = function (selector) {
    setTimeout(function () {
      var a = d.activeElement;
      if (a && a !== d.body && a !== d.documentElement && d.contains(a)) return;
      if (d.querySelector('.modal, .drawer')) return;
      var el = selector ? d.querySelector('.adm-main ' + selector) : null;
      if (!el || el.offsetParent === null) el = d.getElementById('h-' + K.route.section);
      if (el) { try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); } }
    }, 60);
  };
  K.errorBox = function (err, what) {
    return '<div class="alert alert--err" role="alert">' + icon('alert-triangle', { size: 18 }) +
      '<div><p class="alert__title">' + h(what || 'Data belum dapat dimuat') + '</p><p>' + h(err && err.message ? err.message : 'Terjadi kendala. Silakan coba lagi.') + '</p>' +
      '<p class="mt-2"><button type="button" class="btn btn--ghost btn--sm" data-adm-retry><span>' + icon('refresh', { size: 16 }) + '</span><span>Coba lagi</span></button></p></div></div>';
  };
  K.plural = function (n, word) { return util.formatNumber(n) + ' ' + word; };
  K.mailto = function (email, subject, body) {
    email = String(email || '').trim();
    if (!util.isEmail(email) || /[\s<>"'?&#%]/.test(email)) return '';
    return 'mailto:' + email + '?subject=' + encodeURIComponent(subject || '') + (body ? '&body=' + encodeURIComponent(body) : '');
  };
  K.download = function (filename, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = d.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    a.hidden = true;
    d.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
  };
  K.chips = function (o) {
    /* o: {label, name, items:[{value,label,count}], value} → filter chip group (aria-pressed) */
    return '<div class="filter-chips adm-chips" role="group" aria-label="' + h(o.label) + '" data-chips="' + h(o.name) + '">' +
      o.items.map(function (it) {
        var on = String(it.value) === String(o.value);
        return '<button type="button" class="chip" data-value="' + h(it.value) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + h(it.label) +
          (it.count !== undefined ? ' <span class="chip__count">' + h(util.formatNumber(it.count)) + '</span>' : '') + '</button>';
      }).join('') + '</div>';
  };
  K.searchBox = function (o) {
    /* o: {id, label, placeholder, value} */
    return '<div class="field adm-search"><label class="sr-only" for="' + h(o.id) + '">' + h(o.label) + '</label>' +
      '<div class="search-box">' + icon('search', { size: 18 }) +
      '<input class="field__control" type="search" id="' + h(o.id) + '" placeholder="' + h(o.placeholder || '') + '" value="' + h(o.value || '') + '" autocomplete="off" spellcheck="false">' +
      '<button type="button" class="search-box__clear" aria-label="Hapus pencarian"' + (o.value ? '' : ' hidden') + '>' + icon('close', { size: 16 }) + '</button></div></div>';
  };
  K.select = function (o) {
    /* o: {id, label, options:[{value,label}|string], value, srLabel} — compact toolbar select */
    var opts = o.options.map(function (op) {
      var v = typeof op === 'object' ? op.value : op, l = typeof op === 'object' ? op.label : op;
      return '<option value="' + h(v) + '"' + (String(v) === String(o.value || '') ? ' selected' : '') + '>' + h(l) + '</option>';
    }).join('');
    return '<div class="field adm-select"><label class="' + (o.srLabel ? 'sr-only' : 'field__label') + '" for="' + h(o.id) + '">' + h(o.label) + '</label>' +
      '<select class="field__control" id="' + h(o.id) + '">' + opts + '</select></div>';
  };
  /** after a filter/search change: announce the new result count once (lists are not live regions —
      re-rendering a whole table inside aria-live would read every row) */
  K.announceCount = function (root) {
    var c = root && root.querySelector('.adm-count');
    var empty = root && root.querySelector('.empty-state__title');
    K.announce(c ? c.textContent : empty ? empty.textContent : '');
  };
  /** wire a search box: debounce input, toggle the clear button */
  K.bindSearch = function (root, id, onChange) {
    var input = d.getElementById(id);
    if (!input) return;
    var clear = input.parentNode.querySelector('.search-box__clear');
    var fire = util.debounce(function () { onChange(input.value); K.announceCount(root); }, 220);
    input.addEventListener('input', function () {
      if (clear) clear.hidden = !input.value;
      fire();
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape' && input.value) { e.preventDefault(); e.stopPropagation(); input.value = ''; if (clear) clear.hidden = true; onChange(''); K.announceCount(root); } });
    /* core's delegated clear button empties the box and dispatches "input" (handled above) */
  };
  K.bindChips = function (root, name, onChange) {
    var group = root.querySelector('[data-chips="' + name + '"]');
    if (!group) return;
    group.addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      util.$$('.chip', group).forEach(function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); });
      onChange(b.getAttribute('data-value'));
      K.announceCount(root);
    });
  };
  /** keep focus on the control with this id after a re-render (search typing, selects) */
  K.keepFocus = function (id, fn) {
    var a = d.activeElement, had = a && a.id === id, pos = had && typeof a.selectionStart === 'number' ? a.selectionStart : null;
    fn();
    if (had) {
      var el = d.getElementById(id);
      if (el) { el.focus({ preventScroll: true }); if (pos !== null) { try { el.setSelectionRange(pos, pos); } catch (e) { /* select */ } } }
    }
  };

  /* ----------------------------------------------------- form field helpers */
  var fieldSeq = 0;
  /** K.field({name, label, type, value, required, hint (trusted HTML — escape data), options, placeholder, min, max, maxlength, rows, full, cls, url, counter, list}) */
  K.field = function (o) {
    var id = o.id || ('adm-f-' + o.name + '-' + (++fieldSeq));
    var hintId = id + '-hint', errId = id + '-err';
    var describ = (o.hint ? hintId + ' ' : '') + errId;
    var common = ' id="' + h(id) + '" name="' + h(o.name) + '" aria-describedby="' + describ + '"' +
      (o.required ? ' required aria-required="true"' : '') +
      (o.placeholder ? ' placeholder="' + h(o.placeholder) + '"' : '') +
      (o.maxlength ? ' maxlength="' + h(o.maxlength) + '"' : '') +
      (o.minlength ? ' data-minlength="' + h(o.minlength) + '"' : '') +
      (o.url ? ' data-url="' + h(o.url) + '"' : '') +
      (o.min !== undefined ? ' min="' + h(o.min) + '"' : '') + (o.max !== undefined ? ' max="' + h(o.max) + '"' : '') +
      (o.list ? ' list="' + h(o.list) + '"' : '') + (o.attrs || '');
    var val = o.value === undefined || o.value === null ? '' : String(o.value);
    var control;
    if (o.type === 'textarea') {
      control = '<textarea class="field__control"' + common + ' rows="' + (o.rows || 4) + '">' + h(val) + '</textarea>';
    } else if (o.type === 'select') {
      control = '<select class="field__control"' + common + '>' + (o.options || []).map(function (op) {
        var v = typeof op === 'object' ? op.value : op, l = typeof op === 'object' ? op.label : op;
        return '<option value="' + h(v) + '"' + (String(v) === val ? ' selected' : '') + '>' + h(l) + '</option>';
      }).join('') + '</select>';
    } else {
      var type = { date: 'date', number: 'number', email: 'email', url: 'url' }[o.type] || 'text';
      if (o.url) type = 'text';
      control = '<input class="field__control" type="' + type + '"' + common + ' value="' + h(val) + '"' +
        (type === 'email' ? ' autocomplete="email" inputmode="email" spellcheck="false"' : '') + (o.url ? ' inputmode="url" spellcheck="false" autocomplete="off"' : '') + '>';
    }
    var counter = o.counter && o.maxlength ? '<span class="field__counter" data-counter-for="' + h(id) + '" aria-hidden="true">' + util.formatNumber(val.length) + ' / ' + util.formatNumber(o.maxlength) + '</span>' : '';
    return '<div class="field' + (o.full ? ' adm-field--full' : '') + (o.cls ? ' ' + h(o.cls) : '') + '">' +
      '<label class="field__label" for="' + h(id) + '">' + h(o.label) + (o.required ? ' <span class="field__req" aria-hidden="true">*</span>' : (o.optional ? ' <span class="opt">(opsional)</span>' : '')) + counter + '</label>' +
      control +
      (o.hint ? '<p class="field__hint" id="' + hintId + '">' + o.hint + '</p>' : '') +
      '<p class="field__error" id="' + errId + '"></p></div>';
  };
  K.check = function (o) {
    var id = o.id || ('adm-c-' + o.name + '-' + (++fieldSeq));
    return '<label class="check adm-check"><input type="checkbox" id="' + h(id) + '" name="' + h(o.name) + '"' + (o.checked ? ' checked' : '') + '>' +
      '<span class="check__box" aria-hidden="true"></span><span class="check__label">' + h(o.label) + (o.hint ? '<span class="adm-check__hint">' + h(o.hint) + '</span>' : '') + '</span></label>';
  };
  /** values of named controls (checkbox → boolean) */
  K.values = function (form) {
    var out = {};
    util.$$('[name]', form).forEach(function (el) {
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; else if (!(el.name in out)) out[el.name] = ''; }
      else out[el.name] = String(el.value || '').trim();
    });
    return out;
  };
  function setInvalid(el, msg) {
    var f = el.closest('.field');
    if (!f) return;
    f.classList.toggle('is-invalid', !!msg);
    if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    var err = f.querySelector('.field__error');
    if (err) err.textContent = msg || '';
  }
  K.setInvalid = setInvalid;
  /** built-in validation (required, data-minlength, email, data-url, date min/max, number) → first invalid control or null */
  K.validate = function (form, extra) {
    var first = null;
    util.$$('input.field__control, select.field__control, textarea.field__control', form).forEach(function (el) {
      var v = String(el.value || '').trim(), msg = '';
      var label = (el.closest('.field') && el.closest('.field').querySelector('.field__label'));
      var name = label ? label.childNodes[0].textContent.trim().toLowerCase() : 'kolom ini';
      if (el.required && !v) msg = 'Isi ' + name + '.';
      else if (v && el.getAttribute('data-minlength') && v.length < Number(el.getAttribute('data-minlength'))) msg = 'Minimal ' + el.getAttribute('data-minlength') + ' karakter.';
      else if (v && el.type === 'email' && !util.isEmail(v)) msg = 'Format alamat email tidak valid.';
      else if (v && el.getAttribute('data-url') === 'https' && !/^https:\/\/[^\s<>"']+$/i.test(v)) msg = 'Gunakan tautan lengkap yang diawali https://';
      else if (v && el.getAttribute('data-url') === 'http' && !/^https?:\/\/[^\s<>"']+$/i.test(v)) msg = 'Gunakan tautan lengkap yang diawali https:// atau http://';
      else if (v && el.getAttribute('data-url') === 'any' && !(/^https?:\/\/[^\s<>"']+$/i.test(v) || (/^[A-Za-z0-9][A-Za-z0-9_\-./]*(\?[^\s<>"']*)?(#[^\s<>"']*)?$/.test(v) && v.indexOf('//') === -1 && !/(^|\/)\.\.(\/|$)/.test(v) && !/^[a-z][a-z0-9+.\-]*:/i.test(v)))) msg = 'Gunakan tautan https:// atau jalur berkas di situs (mis. aplikasi/…/index.html).';
      else if (v && el.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)) msg = 'Format tanggal tidak valid.';
      else if (v && el.type === 'date' && el.min && v < el.min) msg = 'Tanggal paling awal ' + util.formatDate(el.min) + '.';
      else if (v && el.type === 'number' && (!isFinite(Number(v)) || (el.min !== '' && Number(v) < Number(el.min)) || (el.max !== '' && Number(v) > Number(el.max)))) msg = 'Masukkan angka yang valid' + (el.min !== '' && el.max !== '' ? ' (' + el.min + '–' + el.max + ')' : '') + '.';
      if (!msg && extra) msg = extra(el, v) || '';
      setInvalid(el, msg);
      if (msg && !first) first = el;
    });
    if (first) first.focus();
    return first;
  };
  /* live counters + clearing errors while typing (delegated, works in modals and drawers) */
  d.addEventListener('input', function (e) {
    var el = e.target;
    if (!el || !el.closest || !el.closest('.adm-form')) return;
    var c = el.id ? d.querySelector('[data-counter-for="' + el.id + '"]') : null;
    if (c) {
      var max = Number(el.getAttribute('maxlength')) || 0;
      c.textContent = util.formatNumber(el.value.length) + ' / ' + util.formatNumber(max);
      c.classList.toggle('is-over', max && el.value.length > max);
    }
    var f = el.closest('.field');
    if (f && f.classList.contains('is-invalid')) setInvalid(el, '');
  });

  /** Modal with a form. o: {title, eyebrow, intro(html), fields(html), size, submitLabel, submitVariant, check(form) → first invalid | null,
      submit(values, form) → Promise<result>}. Resolves the result, or null when cancelled. Errors stay in the modal. */
  K.formDialog = function (o) {
    return new Promise(function (resolve) {
      var done = false;
      var m = ui.modal({
        title: o.title, eyebrow: o.eyebrow, size: o.size || 'md', cls: 'adm-modal',
        body: '<form class="form adm-form" novalidate>' + (o.intro || '') + (o.fields || '') +
          '<div class="alert alert--err adm-form__error" role="alert" data-form-error hidden></div></form>',
        actions: [
          { label: o.cancelLabel || 'Batal', variant: 'ghost' },
          {
            label: o.submitLabel || 'Simpan', variant: o.submitVariant || 'primary', id: o.submitId,
            onClick: function (close, ctx) {
              var form = ctx.el.querySelector('form');
              var errBox = form.querySelector('[data-form-error]');
              errBox.hidden = true;
              errBox.innerHTML = '';
              var bad = K.validate(form, o.extraCheck);
              if (!bad && o.check) bad = o.check(form);
              if (bad) return false;
              return Promise.resolve().then(function () { return o.submit(K.values(form), form); }).then(function (res) {
                if (res === false) return false;
                done = true;
                resolve(res === undefined ? true : res);
                return true;
              }, function (err) {
                console.error(err);
                errBox.innerHTML = icon('alert-triangle', { size: 18 }) + '<div><p class="alert__title">Belum berhasil</p><p>' + h(err && err.message ? err.message : 'Terjadi kendala. Silakan coba lagi.') + '</p></div>';
                errBox.hidden = false;
                return false;
              });
            }
          }
        ],
        onOpen: function (el) {
          var form = el.querySelector('form');
          form.addEventListener('submit', function (e) { e.preventDefault(); });
          form.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'checkbox' && e.target.type !== 'radio') {
              e.preventDefault();
              var btn = el.querySelector('.modal__footer .btn:last-child');
              if (btn && !btn.disabled) btn.click();
            }
          });
          if (o.onOpen) o.onOpen(el, form);
          ui.reveal(el);
        },
        onClose: function () { if (!done) resolve(null); }
      });
    });
  };

  /* ---------------------------------------------------------- navigation */
  function parseHash() {
    var raw = '';
    try { raw = decodeURIComponent((w.location.hash || '').slice(1)); } catch (e) { raw = ''; }
    var parts = raw.split('/');
    var sec = SECTIONS.indexOf(parts[0]) !== -1 ? parts[0] : 'ringkasan';
    return { section: sec, sub: parts.slice(1).join('/') };
  }
  K.setSub = function (section, sub) {
    K.route = { section: section, sub: sub || '' };
    try { w.history.replaceState(null, '', '#' + section + (sub ? '/' + sub : '')); } catch (e) { /* ignore */ }
  };
  K.go = function (section, sub) {
    var hash = '#' + section + (sub ? '/' + sub : '');
    if (w.location.hash === hash) show(parseHash(), { focus: true });
    else w.location.hash = hash;
  };
  K.body = function (section) { return d.getElementById(section + '-body'); };
  K.renderCurrent = function () {
    if (!K.ready) return; /* skeletons stay until the first load */
    var sec = K.sections[K.route.section];
    var body = K.body(K.route.section);
    if (!sec || !body) return;
    function fail(err) {
      console.error(err);
      body.removeAttribute('aria-busy');
      body.innerHTML = K.errorBox(err, 'Bagian ini belum dapat ditampilkan');
    }
    try {
      var res = sec.render(body, K.route.sub);
      body.removeAttribute('aria-busy');
      ui.reveal(body);
      /* bagian tambahan boleh memuat datanya sendiri (render → Promise) */
      if (res && typeof res.then === 'function') {
        var key = K.route.section;
        res.then(function () { ui.reveal(body); K.renderExtraCount(key); }, fail);
      }
    } catch (err) {
      fail(err);
    }
  };
  /* phones/tablets: the nav is a horizontal tab strip — keep the active tab in view */
  function keepTabInView() {
    var active = d.querySelector('.adm-nav__link[aria-current="page"]');
    if (!active || !w.matchMedia('(max-width: 1199px)').matches) return;
    var list = active.closest('.adm-nav__list');
    if (list) list.scrollLeft = Math.max(0, active.offsetLeft - 16);
  }
  function show(route, opts) {
    opts = opts || {};
    K.route = route;
    SECTIONS.forEach(function (s) {
      var el = d.getElementById('sec-' + s);
      if (el) el.hidden = s !== route.section;
    });
    util.$$('.adm-nav__link').forEach(function (a) {
      if (a.getAttribute('data-section') === route.section) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    keepTabInView();
    K.renderCurrent();
    if (opts.focus) {
      var head = d.getElementById('h-' + route.section);
      var shell = d.querySelector('.adm-shell');
      if (shell) {
        var top = shell.getBoundingClientRect().top;
        var offset = parseFloat(getComputedStyle(d.documentElement).getPropertyValue('--header-h')) || 76;
        if (top < 0) w.scrollTo(0, w.pageYOffset + top - offset - 12);
      }
      if (head) { try { head.focus({ preventScroll: true }); } catch (e) { head.focus(); } }
    }
  }
  K.show = show;

  K.renderCounts = function () {
    Object.keys(EXTRA).forEach(function (key) { K.renderExtraCount(key); });
    var members = K.state.members || [], fb = K.state.feedback || [];
    var pending = members.filter(function (m) { return K.eff(m) === 'Menunggu Verifikasi'; }).length;
    var baru = fb.filter(function (x) { return x.status === 'Baru'; }).length;
    [['permohonan', pending, ' pengajuan menunggu verifikasi'], ['umpan-balik', baru, ' umpan balik baru']].forEach(function (c) {
      var el = d.querySelector('[data-count-for="' + c[0] + '"]');
      if (!el) return;
      el.hidden = !c[1];
      el.innerHTML = c[1] ? h(util.formatNumber(c[1])) + '<span class="sr-only">' + h(c[2]) + '</span>' : '';
    });
  };

  /* ------------------------------------------- bagian tambahan (generik) */
  var EXTRA = {};
  K.extraSections = EXTRA;
  var COUNT_LABELS = { instruktur: ' permintaan instruktur baru', toko: ' pesanan perlu ditindaklanjuti', kegiatan: ' kegiatan perlu ditindaklanjuti' };
  function setCount(key, n, label) {
    var el = d.querySelector('[data-count-for="' + key + '"]');
    if (!el) return;
    n = Number(n) || 0;
    el.hidden = !n;
    el.innerHTML = n ? h(util.formatNumber(n)) + '<span class="sr-only">' + h(label || COUNT_LABELS[key] || ' perlu ditindaklanjuti') + '</span>' : '';
  }
  /** penghitung menu sebuah bagian tambahan: badge() (Promise) atau count() (angka); galat diabaikan */
  K.renderExtraCount = function (key) {
    var sec = EXTRA[key];
    if (!sec || (typeof sec.badge !== 'function' && typeof sec.count !== 'function')) return;
    try {
      var v = typeof sec.badge === 'function' ? sec.badge() : sec.count();
      Promise.resolve(v).then(function (n) { setCount(key, n, sec.countLabel); }, function () { /* biarkan */ });
    } catch (e) { /* biarkan */ }
  };
  /** Pasang setiap window.PPAPI_ADMIN_SECTIONS: tautan menu (sesudah yang terakhir), kerangka bagian
      (judul/pengantar seperti bagian bawaan), rute (#key, #key/sub), dan penghitung menu.
      Bagian yang markup-nya sudah ada di admin.html hanya didaftarkan. */
  function mountExtraSections() {
    var list = Array.isArray(w.PPAPI_ADMIN_SECTIONS) ? w.PPAPI_ADMIN_SECTIONS : [];
    var navList = d.querySelector('.adm-nav__list'), main = d.querySelector('.adm-main');
    list.forEach(function (sec) {
      if (!sec || typeof sec.render !== 'function' || !/^[a-z][a-z0-9-]{1,30}$/.test(String(sec.key || ''))) return;
      var key = sec.key;
      if (EXTRA[key]) return;
      /* nama bagian bawaan (ringkasan, anggota, …) tidak boleh ditimpa */
      if (K.sections[key] && K.sections[key] !== sec) { console.warn('[PPAPI] Bagian konsol "' + key + '" sudah ada; lewati.'); return; }
      EXTRA[key] = sec;
      K.sections[key] = sec;
      if (SECTIONS.indexOf(key) === -1) SECTIONS.push(key);
      var num = util.pad(SECTIONS.indexOf(key) + 1);
      var label = String(sec.label || key);
      var counted = typeof sec.badge === 'function' || typeof sec.count === 'function';
      if (navList && !navList.querySelector('.adm-nav__link[data-section="' + key + '"]')) {
        var li = d.createElement('li');
        li.innerHTML = '<a class="adm-nav__link" href="#' + h(key) + '" data-section="' + h(key) + '"><span class="adm-nav__num" aria-hidden="true">' + h(num) + '</span>' +
          icon(sec.icon || 'grid', { size: 18, cls: 'adm-nav__icon' }) + '<span class="adm-nav__text">' + h(label) + '</span>' +
          (counted ? '<span class="adm-nav__count" data-count-for="' + h(key) + '" hidden></span>' : '') + '</a>';
        navList.appendChild(li);
      }
      if (main && !d.getElementById('sec-' + key)) {
        var el = d.createElement('section');
        el.className = 'adm-section';
        el.id = 'sec-' + key;
        el.setAttribute('data-section', key);
        el.setAttribute('aria-labelledby', 'h-' + key);
        el.hidden = true;
        el.innerHTML = '<header class="adm-head"><div class="adm-head__text">' +
            '<p class="eyebrow">' + h(num + ' — ' + label) + '</p>' +
            /* title: HTML tepercaya dari berkas bagian (boleh <em>); teks lain di-escape */
            '<h2 class="adm-head__title" id="h-' + h(key) + '" tabindex="-1">' + (sec.title || h(label)) + '</h2>' +
            (sec.lead ? '<p class="adm-head__lead">' + h(sec.lead) + '</p>' : '') +
          '</div></header>' +
          '<div class="adm-section__body" id="' + h(key) + '-body" aria-busy="true"><div class="skeleton" role="status"><span class="sr-only">Memuat ' + h(label.toLowerCase()) + '…</span>' +
            '<span class="skeleton__line"></span><span class="skeleton__line"></span><span class="skeleton__line"></span></div></div>';
        main.appendChild(el);
      }
    });
  }
  K.mountExtraSections = mountExtraSections;

  /* --------------------------------------------------------- hero meta */
  function renderMeta() {
    var meta = d.getElementById('adm-meta');
    var me = K.me();
    var mm = PPAPI.session.current().member;
    var name = (mm && mm.name) || me.name || me.email || 'Admin';
    if (meta) {
      meta.innerHTML = '<span>' + icon('shield-check', { size: 16 }) + 'Masuk sebagai ' + h(name) + '</span>' +
        '<span>' + icon('calendar', { size: 16 }) + '<time datetime="' + h(util.todayIso()) + '">' + h(util.formatDate(new Date(), { weekday: true })) + '</time></span>' +
        (K.isDemo() ? '<span class="badge badge--outline adm-hero__mode">Mode Demo</span>' : '<span class="badge badge--outline adm-hero__mode">Firebase</span>');
    }
    var foot = d.getElementById('adm-nav-foot');
    if (foot) {
      foot.innerHTML = K.isDemo()
        ? '<p class="adm-nav__note">' + icon('info', { size: 16 }) + '<span><strong>Mode Demo.</strong> Perubahan hanya tersimpan di peramban ini dan tidak terlihat oleh pengunjung lain.</span></p>'
        : '<p class="adm-nav__note">' + icon('info', { size: 16 }) + '<span>Terhubung ke Firebase. Perubahan langsung berlaku bagi seluruh pengunjung.</span></p>';
    }
  }

  /* =====================================================================
     01 · RINGKASAN
     ===================================================================== */
  var HIST_STATUS_ORDER = ['Menunggu Verifikasi', 'Perlu Perbaikan', 'Aktif', 'Kedaluwarsa', 'Nonaktif', 'Ditolak', 'Draf'];
  K.STATUS_ORDER = HIST_STATUS_ORDER;
  K.sections.ringkasan = {
    render: function (body) {
      var st = K.state;
      if (st.errors.members) { body.innerHTML = K.errorBox(st.errors.members, 'Data anggota belum dapat dimuat'); return; }
      var members = st.members || [], fb = st.feedback || [], log = st.audit || [];
      var by = {};
      HIST_STATUS_ORDER.forEach(function (s) { by[s] = []; });
      members.forEach(function (m) { var s = K.eff(m); (by[s] = by[s] || []).push(m); });
      var soon = by['Aktif'].filter(function (m) { var dd = util.validityDays(m); return dd !== null && dd <= util.RENEWAL_DAYS; });
      var pend = by['Menunggu Verifikasi'].slice().sort(function (a, b) { return String(a.application.submittedAt).localeCompare(String(b.application.submittedAt)); });
      var fbNew = fb.filter(function (x) { return x.status === 'Baru'; }).length;
      var fbProc = fb.filter(function (x) { return x.status === 'Diproses'; }).length;

      function kpi(o) {
        return '<a class="kpi kpi--' + o.tone + ' adm-kpi" href="' + o.href + '"' + (o.preset ? ' data-preset="' + h(JSON.stringify(o.preset)) + '"' : '') + '>' +
          '<div class="kpi__head"><span class="kpi__label">' + h(o.label) + '</span><span class="kpi__icon">' + icon(o.icon, { size: 16 }) + '</span></div>' +
          '<p class="kpi__value">' + h(util.formatNumber(o.value)) + (o.unit ? ' <small>' + h(o.unit) + '</small>' : '') + '</p>' +
          '<p class="kpi__note">' + h(o.note) + '</p></a>';
      }
      var oldest = pend[0];
      var kpis = [
        kpi({ label: 'Menunggu verifikasi', icon: 'clock', value: pend.length, unit: 'pengajuan', tone: pend.length ? 'warn' : 'accent', href: '#permohonan', preset: { section: 'permohonan', status: 'Menunggu Verifikasi' },
          note: oldest ? 'Terlama diajukan ' + K.rel(oldest.application.submittedAt) : 'Tidak ada antrean saat ini' }),
        kpi({ label: 'Perlu perbaikan', icon: 'edit', value: by['Perlu Perbaikan'].length, unit: 'pengajuan', tone: by['Perlu Perbaikan'].length ? 'warn' : 'accent', href: '#permohonan', preset: { section: 'permohonan', status: 'Perlu Perbaikan' },
          note: by['Perlu Perbaikan'].length ? 'Menunggu tanggapan pemohon' : 'Tidak ada pengajuan dikembalikan' }),
        kpi({ label: 'Anggota aktif', icon: 'users', value: by['Aktif'].length, unit: 'orang', tone: 'ok', href: '#anggota', preset: { section: 'anggota', status: 'Aktif' },
          note: 'Dari ' + util.formatNumber(members.length) + ' akun terdaftar' }),
        kpi({ label: 'Berakhir ≤ ' + util.RENEWAL_DAYS + ' hari', icon: 'calendar', value: soon.length, unit: 'anggota', tone: soon.length ? 'err' : 'accent', href: '#anggota', preset: { section: 'anggota', status: 'segera' },
          note: soon.length ? 'Tawarkan perpanjangan masa berlaku' : 'Tidak ada yang berakhir dalam ' + util.RENEWAL_DAYS + ' hari' }),
        kpi({ label: 'Kedaluwarsa · nonaktif', icon: 'alert-triangle', value: by['Kedaluwarsa'].length + by['Nonaktif'].length, unit: 'akun', tone: (by['Kedaluwarsa'].length + by['Nonaktif'].length) ? 'err' : 'accent', href: '#anggota', preset: { section: 'anggota', status: 'Kedaluwarsa,Nonaktif' },
          note: util.formatNumber(by['Kedaluwarsa'].length) + ' kedaluwarsa · ' + util.formatNumber(by['Nonaktif'].length) + ' dinonaktifkan' }),
        kpi({ label: 'Umpan balik baru', icon: 'message', value: fbNew, unit: 'pesan', tone: fbNew ? 'warn' : 'accent', href: '#umpan-balik', preset: { section: 'umpan-balik', status: 'Baru' },
          note: st.errors.feedback ? 'Umpan balik belum dapat dimuat' : (fbProc ? util.formatNumber(fbProc) + ' sedang diproses' : 'Tidak ada yang sedang diproses') })
      ].join('');

      /* latest applications */
      var latest = members.filter(function (m) { return m.application && m.application.submittedAt && ['Menunggu Verifikasi', 'Perlu Perbaikan', 'Ditolak'].indexOf(K.eff(m)) !== -1; })
        .sort(function (a, b) {
          var pa = K.eff(a) === 'Menunggu Verifikasi', pb = K.eff(b) === 'Menunggu Verifikasi';
          if (pa !== pb) return pa ? -1 : 1;
          return String(b.application.submittedAt).localeCompare(String(a.application.submittedAt));
        }).slice(0, 5);
      var apps = latest.length
        ? '<ul class="adm-list" role="list">' + latest.map(function (m) {
          return '<li class="adm-list__item">' + K.person(m, { open: 'member', sub: (K.kategoriText ? K.kategoriText(m) : (m.application.kategori || m.memberType)) + ' · ' + (m.application.type === 'perpanjangan' ? 'Perpanjangan' : 'Pendaftaran baru') }) +
            '<div class="adm-list__meta">' + K.statusBadge(m) + '<span class="adm-dim">Diajukan ' + h(K.rel(m.application.submittedAt)) + '</span></div>' +
            '<button type="button" class="adm-act" data-open="member" data-id="' + h(m.uid) + '"><span>Tinjau</span>' + icon('arrow-right', { size: 14 }) + '<span class="sr-only"> pengajuan ' + h(m.name) + '</span></button></li>';
        }).join('') + '</ul>'
        : K.emptyLine('check-circle', 'Antrean kosong. Belum ada formulir pendaftaran yang perlu ditinjau.');

      /* status composition */
      var total = members.length || 1;
      var comp = '<ul class="adm-comp" role="list">' + HIST_STATUS_ORDER.map(function (s) {
        var n = (by[s] || []).length, pct = Math.round(n / total * 100);
        return '<li><button type="button" class="adm-comp__row" data-preset="' + h(JSON.stringify(s === 'Menunggu Verifikasi' || s === 'Perlu Perbaikan' ? { section: 'permohonan', status: s } : { section: 'anggota', status: s })) + '">' +
          '<span class="adm-comp__label">' + util.statusBadge(s) + '</span>' +
          '<span class="adm-comp__bar" aria-hidden="true"><span style="--value:' + pct + '"></span></span>' +
          '<span class="adm-comp__num">' + h(util.formatNumber(n)) + '<span class="sr-only"> akun</span></span></button></li>';
      }).join('') + '</ul>';

      /* latest audit */
      var logHtml = log.length
        ? '<ol class="adm-feed" role="list">' + log.slice(0, 6).map(K.auditItem).join('') + '</ol>'
        : K.emptyLine('activity', 'Belum ada aktivitas admin. Keputusan dan perubahan akan tercatat di sini.');

      body.innerHTML =
        '<div class="adm-kpis">' + kpis + '</div>' +
        '<div class="adm-overview">' +
          '<section class="adm-panel adm-panel--wide" aria-labelledby="ov-apps">' +
            '<header class="adm-panel__head"><h3 class="adm-panel__title" id="ov-apps">Permohonan terbaru</h3>' +
            '<a class="btn btn--link btn--sm" href="#permohonan"><span>Semua permohonan</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a></header>' + apps + '</section>' +
          '<section class="adm-panel" aria-labelledby="ov-comp">' +
            '<header class="adm-panel__head"><h3 class="adm-panel__title" id="ov-comp">Komposisi status</h3><span class="adm-dim">' + h(K.plural(members.length, 'akun')) + '</span></header>' + comp + '</section>' +
        '</div>' +
        '<section class="adm-panel adm-panel--log" aria-labelledby="ov-log">' +
          '<header class="adm-panel__head"><h3 class="adm-panel__title" id="ov-log">Aktivitas terbaru</h3>' +
          '<a class="btn btn--link btn--sm" href="#log"><span>Log lengkap</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a></header>' + logHtml + '</section>';
    }
  };

  /* audit entry (shared by Ringkasan + Log) */
  var LOG_GROUPS = { anggota: 'Anggota', konten: 'Konten', 'umpan-balik': 'Umpan Balik', admin: 'Admin', instruktur: 'Instruktur', kegiatan: 'Kegiatan' };
  var LOG_ICONS = { anggota: 'user', konten: 'file-text', 'umpan-balik': 'message', admin: 'shield', instruktur: 'award', kegiatan: 'calendar' };
  var LOG_ALIAS = { sertifikat: 'kegiatan' }; /* sertifikat.dicabut / .dipulihkan → kelompok Kegiatan */
  function logGroup(x) { var g = String(x.action || '').split('.')[0]; g = LOG_ALIAS[g] || g; return LOG_GROUPS[g] ? g : 'lain'; }
  var CONTENT_NAMES = { berita: 'Berita', pengumuman: 'Pengumuman', agenda: 'Agenda', pustaka: 'Produk Pengetahuan', regulasi: 'Regulasi' };
  K.CONTENT_NAMES = CONTENT_NAMES;
  K.auditItem = function (x) {
    var g = logGroup(x);
    var kind = String(x.targetType || '');
    var kindLabel = kind.indexOf('konten:') === 0 ? (CONTENT_NAMES[kind.slice(7)] || 'Konten') : (LOG_GROUPS[kind] || '');
    return '<li class="adm-feed__item">' +
      '<span class="adm-feed__icon" aria-hidden="true">' + icon(LOG_ICONS[g] || 'activity', { size: 15 }) + '</span>' +
      '<div class="adm-feed__body">' +
        '<p class="adm-feed__title"><strong>' + h(x.label || store().AUDIT_LABELS[x.action] || x.action || 'Aktivitas') + '</strong>' +
        (x.targetName ? ' <span class="adm-feed__target">' + h(kind.indexOf('konten:') === 0 && x.targetName === x.targetId && K.contentTitle ? K.contentTitle(kind.slice(7), x.targetId) || x.targetName : x.targetName) + '</span>' : '') + '</p>' +
        (x.note ? '<p class="adm-feed__note">' + h(x.note) + '</p>' : '') +
        '<p class="adm-feed__meta">' + (kindLabel ? '<span>' + h(kindLabel) + '</span>' : '') + '<span>oleh ' + h(x.byName || 'Admin') + '</span>' +
        '<time datetime="' + h(x.at) + '">' + h(K.dateTime(x.at)) + '</time></p>' +
      '</div></li>';
  };

  /* =====================================================================
     05 · UMPAN BALIK
     ===================================================================== */
  var FB = { status: '', kategori: '', q: '' };
  var FB_TONE = { 'Baru': 'warn', 'Diproses': 'muted', 'Selesai': 'ok' };
  function fbBadge(s) { return '<span class="badge badge--' + (FB_TONE[s] || 'muted') + '">' + h(s || 'Baru') + '</span>'; }
  function fbSender(x) { return x.anonim ? 'Anonim' : (x.nama || x.email || 'Tanpa nama'); }
  function stars(n) {
    n = Number(n) || 0;
    if (!n) return '<span class="adm-dim">—</span>';
    var out = '<span class="adm-stars" role="img" aria-label="' + n + ' dari 5 bintang">';
    for (var i = 1; i <= 5; i++) out += icon(i <= n ? 'star-filled' : 'star', { size: 13 });
    return out + '</span>';
  }
  function fbMatch(x, q) {
    if (!q) return true;
    var hay = [x.id, x.subjek, x.pesan, x.nama, x.email, x.kategori, x.catatanAdmin].join(' ').toLowerCase();
    return q.toLowerCase().split(/\s+/).every(function (t) { return hay.indexOf(t) !== -1; });
  }
  K.sections['umpan-balik'] = {
    preset: function (p) { FB.status = p.status || ''; FB.kategori = ''; FB.q = ''; },
    render: function (body) {
      if (K.state.errors.feedback) { body.innerHTML = K.errorBox(K.state.errors.feedback, 'Umpan balik belum dapat dimuat'); return; }
      var all = K.state.feedback || [];
      var cats = store().FEEDBACK_KATEGORI;
      var counts = { '': all.length };
      store().FEEDBACK_STATUS.forEach(function (s) { counts[s] = all.filter(function (x) { return x.status === s; }).length; });
      body.innerHTML =
        '<div class="adm-toolbar">' +
          K.chips({ label: 'Saring status umpan balik', name: 'fb-status', value: FB.status, items: [{ value: '', label: 'Semua', count: counts[''] }].concat(store().FEEDBACK_STATUS.map(function (s) { return { value: s, label: s, count: counts[s] }; })) }) +
          '<div class="adm-toolbar__row">' +
            K.searchBox({ id: 'fb-q', label: 'Cari umpan balik', placeholder: 'Cari subjek, pesan, atau pengirim', value: FB.q }) +
            K.select({ id: 'fb-kat', label: 'Kategori', srLabel: true, value: FB.kategori, options: [{ value: '', label: 'Semua kategori' }].concat(cats) }) +
          '</div>' +
        '</div>' +
        '<div id="fb-list"></div>';
      var listEl = d.getElementById('fb-list');
      function paint() {
        var list = all.filter(function (x) { return (!FB.status || x.status === FB.status) && (!FB.kategori || x.kategori === FB.kategori) && fbMatch(x, FB.q); });
        if (!all.length) {
          listEl.innerHTML = K.empty({ icon: 'message', title: 'Belum ada umpan balik', text: 'Pesan yang dikirim melalui halaman Kontak akan muncul di sini.', actionHtml: '<a class="btn btn--ghost btn--sm" href="umpan-balik.html"><span>Buka halaman Kontak</span></a>' });
          return;
        }
        if (!list.length) { listEl.innerHTML = K.empty({ icon: 'search', title: 'Tidak ada yang cocok', text: 'Ubah kata kunci atau saringan untuk melihat umpan balik lainnya.' }); return; }
        listEl.innerHTML = '<p class="adm-count">' + h(K.plural(list.length, 'pesan')) + '</p>' +
          '<div class="table-wrap"><table class="table adm-table"><caption class="sr-only">Daftar umpan balik</caption><thead><tr>' +
          '<th scope="col">Pesan</th><th scope="col">Kategori</th><th scope="col">Pengirim</th><th scope="col">Nilai</th><th scope="col">Diterima</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Aksi</span></th></tr></thead><tbody>' +
          list.map(function (x) {
            var subj = x.subjek || String(x.pesan || '').slice(0, 80);
            return '<tr' + (x.status === 'Baru' ? ' class="is-new"' : '') + '>' +
              '<td><button type="button" class="adm-link-title" data-open="feedback" data-id="' + h(x.id) + '">' + h(subj) + '</button>' +
              '<span class="table__muted adm-clamp">' + h(String(x.pesan || '').slice(0, 220)) + '</span></td>' +
              '<td data-label="Kategori"><span class="tag">' + h(x.kategori) + '</span></td>' +
              '<td data-label="Pengirim">' + h(fbSender(x)) + (x.email && !x.anonim ? '<span class="table__muted adm-break">' + h(x.email) + '</span>' : '') + '</td>' +
              '<td data-label="Nilai">' + stars(x.rating) + '</td>' +
              '<td data-label="Diterima">' + K.timeTag(x.createdAt) + '</td>' +
              '<td data-label="Status">' + fbBadge(x.status) + '</td>' +
              /* the subject already opens the drawer: square icon action from tablets up (as in Anggota) */
              '<td class="adm-table__actions"><button type="button" class="adm-act adm-act--icon adm-act--open" data-open="feedback" data-id="' + h(x.id) + '" title="Buka">' + icon('arrow-right', { size: 15 }) +
                '<span class="adm-act__label">Buka<span class="sr-only"> umpan balik ' + h(subj) + '</span></span></button></td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      paint();
      K.bindChips(body, 'fb-status', function (v) { FB.status = v; paint(); });
      K.bindSearch(body, 'fb-q', function (v) { FB.q = v; paint(); });
      d.getElementById('fb-kat').addEventListener('change', function (e) { FB.kategori = e.target.value; paint(); K.announceCount(body); });
    }
  };
  K.openFeedback = function (id) {
    var x = (K.state.feedback || []).filter(function (f) { return f.id === id; })[0];
    if (!x) { ui.toast('Umpan balik tidak ditemukan. Muat ulang data.', { type: 'warn' }); return; }
    var mail = !x.anonim ? K.mailto(x.email, 'Tanggapan PPAPI atas ' + (x.kategori || 'umpan balik') + (x.subjek ? ': ' + x.subjek : '') + ' [' + x.id + ']',
      'Yth. ' + (x.nama || 'Bapak/Ibu') + ',\n\nTerima kasih atas ' + String(x.kategori || 'umpan balik').toLowerCase() + ' yang Anda sampaikan melalui situs PPAPI (nomor referensi ' + x.id + ').\n\n\n\nHormat kami,\nSekretariat PPAPI') : '';
    var statusRadios = store().FEEDBACK_STATUS.map(function (s) {
      return '<label><input type="radio" name="status" value="' + h(s) + '"' + (x.status === s ? ' checked' : '') + '><span class="segmented__option">' + h(s) + '</span></label>';
    }).join('');
    var bodyHtml =
      '<div class="drawer__section">' +
        '<div class="adm-badges">' + fbBadge(x.status) + '<span class="badge badge--outline">' + h(x.kategori) + '</span></div>' +
        '<dl class="kv adm-kv">' +
          '<div class="kv__row"><dt>Referensi</dt><dd class="adm-mono">' + h(x.id) + '</dd></div>' +
          '<div class="kv__row"><dt>Diterima</dt><dd>' + h(x.createdAt ? util.formatDate(x.createdAt, { weekday: true, time: true }) : '—') + '</dd></div>' +
          '<div class="kv__row"><dt>Pengirim</dt><dd>' + h(fbSender(x)) + (x.uid ? ' <span class="badge badge--muted">Akun terdaftar</span>' : '') + '</dd></div>' +
          (x.email && !x.anonim ? '<div class="kv__row"><dt>Email</dt><dd class="adm-break">' + h(x.email) + '</dd></div>' : '') +
          (x.phone && !x.anonim ? '<div class="kv__row"><dt>Nomor HP</dt><dd>' + h(util.formatPhoneID(x.phone) || x.phone) + '</dd></div>' : '') +
          '<div class="kv__row"><dt>Penilaian</dt><dd>' + stars(x.rating) + '</dd></div>' +
          (x.halaman ? '<div class="kv__row"><dt>Halaman asal</dt><dd class="adm-break">' + h(x.halaman) + '</dd></div>' : '') +
          (x.updatedAt ? '<div class="kv__row"><dt>Diperbarui</dt><dd>' + h(K.dateTime(x.updatedAt)) + '</dd></div>' : '') +
        '</dl>' +
        (mail ? '<p class="adm-drawer-cta"><a class="btn btn--ghost btn--sm" href="' + h(mail) + '">' + icon('mail', { size: 16 }) + '<span>Balas via email</span></a></p>'
              : '<p class="adm-hint">' + icon('info', { size: 15 }) + '<span>' + (x.anonim ? 'Dikirim secara anonim — tidak dapat dibalas langsung.' : 'Pengirim tidak mencantumkan alamat email yang valid.') + '</span></p>') +
      '</div>' +
      '<div class="drawer__section"><h3 class="drawer__section-title">' + h(x.subjek ? 'Subjek: ' + x.subjek : 'Pesan') + '</h3><div class="adm-message">' + h(x.pesan || '') + '</div></div>' +
      '<div class="drawer__section"><h3 class="drawer__section-title">Penanganan</h3>' +
        '<form class="form adm-form" novalidate id="fb-form">' +
          '<fieldset class="adm-fieldset"><legend class="field__label">Status</legend><div class="segmented segmented--block" role="radiogroup" aria-label="Status penanganan">' + statusRadios + '</div></fieldset>' +
          K.field({ name: 'catatanAdmin', label: 'Catatan internal', type: 'textarea', rows: 4, value: x.catatanAdmin, maxlength: 2000, counter: true, optional: true, hint: 'Hanya terlihat oleh admin, mis. tindak lanjut yang sudah dilakukan.' }) +
        '</form></div>';
    ui.drawer({
      title: x.subjek || (x.kategori + ' dari ' + fbSender(x)), eyebrow: 'Umpan Balik · ' + (x.kategori || ''), size: 'md', cls: 'adm-drawer',
      body: bodyHtml,
      onClose: function () { K.restoreFocus('[data-open="feedback"][data-id="' + (w.CSS && CSS.escape ? CSS.escape(x.id) : x.id) + '"]'); },
      actions: [
        { label: 'Tutup', variant: 'ghost' },
        {
          label: 'Simpan', variant: 'primary', id: 'fb-save',
          onClick: function (close, ctx) {
            var v = K.values(ctx.el.querySelector('#fb-form'));
            if ((v.status || x.status) === x.status && v.catatanAdmin === (x.catatanAdmin || '')) {
              ui.toast('Tidak ada perubahan untuk disimpan.', { type: 'info' });
              return true;
            }
            return store().admin.updateFeedback(x.id, { status: v.status || x.status, catatanAdmin: v.catatanAdmin }).then(function () {
              return K.after(['feedback'], 'Umpan balik ' + x.id + ' diperbarui.');
            });
          }
        }
      ]
    });
  };

  /* =====================================================================
     06 · ADMIN
     ===================================================================== */
  K.sections.admin = {
    render: function (body) {
      if (K.state.errors.admins) { body.innerHTML = K.errorBox(K.state.errors.admins, 'Daftar admin belum dapat dimuat'); return; }
      var admins = K.state.admins || [];
      var me = K.me();
      var members = K.state.members || [];
      var last = admins.length <= 1;
      var rows = admins.map(function (a) {
        var m = members.filter(function (x) { return x.uid === a.uid; })[0] || { uid: a.uid, name: a.name, email: a.email, application: {} };
        var self = a.uid === me.uid;
        return '<tr><td>' + K.person({ uid: a.uid, name: a.name || m.name || a.email, email: a.email || m.email, application: m.application || {}, contoh: false }, { badges: self ? ' <span class="badge badge--metal">Anda</span>' : '', sub: a.email || m.email || a.uid }) + '</td>' +
          '<td data-label="Keanggotaan">' + (m.status ? K.statusBadge(m) : '<span class="adm-dim">—</span>') + '</td>' +
          '<td data-label="Ditambahkan">' + (a.addedAt ? K.timeTag(a.addedAt) : '<span class="adm-dim">' + (K.isDemo() ? 'Akun bawaan demo' : '—') + '</span>') + '</td>' +
          '<td class="adm-table__actions">' + (last
            ? '<span class="adm-dim adm-table__note">Admin terakhir</span>'
            : '<button type="button" class="adm-act adm-act--danger" data-remove-admin="' + h(a.uid) + '"><span>Cabut akses</span><span class="sr-only"> admin ' + h(a.name || a.email) + '</span></button>') + '</td></tr>';
      }).join('');
      body.innerHTML =
        '<div class="adm-stackp">' +
          '<section class="adm-panel" aria-labelledby="adm-list-h">' +
            '<header class="adm-panel__head"><h3 class="adm-panel__title" id="adm-list-h">Admin aktif</h3><span class="adm-dim">' + h(K.plural(admins.length, 'akun')) + '</span></header>' +
            (admins.length ? '<div class="table-wrap"><table class="table adm-table"><caption class="sr-only">Daftar admin</caption><thead><tr><th scope="col">Akun</th><th scope="col">Keanggotaan</th><th scope="col">Ditambahkan</th><th scope="col"><span class="sr-only">Aksi</span></th></tr></thead><tbody>' + rows + '</tbody></table></div>'
              : K.empty({ icon: 'shield', title: 'Belum ada admin', text: 'Tambahkan admin pertama melalui Firebase Console (lihat README).' })) +
            '<p class="adm-hint">' + icon('info', { size: 15 }) + '<span>Konsol selalu menyisakan minimal satu admin. Admin dapat membuka seluruh fitur anggota tanpa status keanggotaan Aktif.</span></p>' +
          '</section>' +
          '<section class="adm-panel adm-panel--form" aria-labelledby="adm-add-h">' +
            '<header class="adm-panel__head"><h3 class="adm-panel__title" id="adm-add-h">Tambah admin</h3></header>' +
            '<div class="adm-add">' +
              '<div class="adm-add__main">' +
                '<p class="adm-panel__text">Masukkan email akun yang sudah terdaftar di situs. Data akun tersebut ditampilkan untuk Anda periksa sebelum peran admin diberikan.</p>' +
                '<form class="adm-form adm-add__form" id="adm-add-form" novalidate>' +
                  K.field({ name: 'email', id: 'adm-add-email', label: 'Email akun', type: 'email', required: true, placeholder: 'nama@domain.id' }) +
                  '<button type="submit" class="btn btn--primary btn--sm" id="adm-add-check"><span>Periksa Akun</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</button>' +
                '</form>' +
                '<div id="adm-add-result" aria-live="polite"></div>' +
              '</div>' +
              '<div class="alert alert--warn adm-add__note">' + icon('alert-triangle', { size: 18 }) + '<div><p class="alert__title">Hanya email terverifikasi</p><p>Peran admin hanya dapat diberikan kepada akun yang alamat emailnya sudah diverifikasi melalui tautan yang dikirim saat pendaftaran. Mintalah petugas sekretariat membuat akunnya sendiri, lalu konfirmasikan langsung kepada yang bersangkutan sebelum memberi akses admin.</p></div></div>' +
            '</div>' +
          '</section>' +
        '</div>';
      var form = d.getElementById('adm-add-form');
      var result = d.getElementById('adm-add-result');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        result.innerHTML = '';
        if (K.validate(form)) return;
        var email = form.email.value.trim().toLowerCase();
        var hits = (K.state.members || []).filter(function (m) { return String(m.email || '').toLowerCase() === email; });
        if (admins.some(function (a) { return String(a.email || '').toLowerCase() === email; }) || hits.some(function (m) { return admins.some(function (a) { return a.uid === m.uid; }); })) {
          result.innerHTML = '<div class="alert alert--info">' + icon('info', { size: 18 }) + '<div><p>Akun dengan email tersebut sudah menjadi admin.</p></div></div>';
          return;
        }
        if (!hits.length) {
          result.innerHTML = '<div class="alert alert--warn">' + icon('alert-triangle', { size: 18 }) + '<div><p class="alert__title">Akun belum ditemukan</p><p>Belum ada akun dengan email terverifikasi ini. Minta yang bersangkutan membuat akun di situs dan membuka tautan verifikasi pada emailnya, lalu periksa kembali.</p></div></div>';
          return;
        }
        if (hits.length > 1) {
          result.innerHTML = '<div class="alert alert--err">' + icon('alert-triangle', { size: 18 }) + '<div><p class="alert__title">Email tercatat lebih dari sekali</p><p>Periksa datanya di Firebase Console sebelum menambahkan admin.</p></div></div>';
          return;
        }
        var m = hits[0];
        result.innerHTML = '<div class="adm-candidate">' +
          '<p class="adm-candidate__label">Akun ditemukan</p>' + K.person(m, { sub: m.email }) +
          '<dl class="kv adm-kv adm-kv--tight">' +
            '<div class="kv__row"><dt>Keanggotaan</dt><dd>' + K.statusBadge(m) + '</dd></div>' +
            (m.kta ? '<div class="kv__row"><dt>Nomor KTA</dt><dd class="adm-mono">' + h(m.kta) + '</dd></div>' : '') +
            '<div class="kv__row"><dt>Akun dibuat</dt><dd>' + h(K.date(m.createdAt || m.joinedAt, {})) + '</dd></div>' +
            (m.profile.company ? '<div class="kv__row"><dt>Instansi</dt><dd>' + h(m.profile.company) + '</dd></div>' : '') +
          '</dl>' +
          '<div class="cluster adm-candidate__actions"><button type="button" class="btn btn--ghost btn--sm" data-cancel-add><span>Batal</span></button>' +
          '<button type="button" class="btn btn--primary btn--sm" id="adm-add-confirm"><span>Jadikan Admin</span></button></div></div>';
        ui.reveal(result);
        result.querySelector('[data-cancel-add]').addEventListener('click', function () { result.innerHTML = ''; form.email.focus(); });
        var btn = d.getElementById('adm-add-confirm');
        btn.focus();
        btn.addEventListener('click', async function () {
          var ok = await ui.confirm('Berikan akses Konsol Admin kepada ' + (m.name || m.email) + ' (' + m.email + ')? Admin dapat menyetujui anggota, mengubah konten, dan menambah admin lain.', { title: 'Tambah admin', okLabel: 'Ya, jadikan admin' });
          if (!ok) return;
          ui.setLoading(btn, true);
          try {
            await store().admin.addAdmin(m.email);
            await K.after(['admins'], (m.name || m.email) + ' kini menjadi admin.');
          } catch (err) {
            ui.setLoading(btn, false);
            ui.toast(err.message || 'Admin belum dapat ditambahkan.', { type: 'error' });
          }
        });
      });
      util.$$('[data-remove-admin]', body).forEach(function (b) {
        b.addEventListener('click', async function () {
          var uid = b.getAttribute('data-remove-admin');
          var a = admins.filter(function (x) { return x.uid === uid; })[0] || {};
          var self = uid === me.uid;
          var ok = await ui.confirm(self
            ? 'Anda akan mencabut akses admin akun Anda sendiri. Setelah itu konsol ini tidak dapat dibuka lagi dari akun ini. Lanjutkan?'
            : 'Cabut akses Konsol Admin dari ' + (a.name || a.email || uid) + '? Akun tetap ada sebagai akun anggota biasa.', { title: 'Cabut akses admin', okLabel: 'Ya, cabut akses', danger: true });
          if (!ok) return;
          ui.setLoading(b, true);
          try {
            await store().admin.removeAdmin(uid);
            if (self) { ui.flash('Akses admin akun Anda telah dicabut.', { type: 'success' }); return; }
            await K.after(['admins'], 'Akses admin ' + (a.name || a.email || '') + ' dicabut.');
          } catch (err) {
            ui.setLoading(b, false);
            ui.toast(err.message || 'Akses admin belum dapat dicabut.', { type: 'error' });
          }
        });
      });
    }
  };

  /* =====================================================================
     07 · LOG AKTIVITAS
     ===================================================================== */
  var LOG = { group: '', shown: 30 };
  K.sections.log = {
    render: function (body) {
      if (K.state.errors.audit) { body.innerHTML = K.errorBox(K.state.errors.audit, 'Log aktivitas belum dapat dimuat'); return; }
      var all = K.state.audit || [];
      var counts = { '': all.length };
      Object.keys(LOG_GROUPS).forEach(function (g) { counts[g] = all.filter(function (x) { return logGroup(x) === g; }).length; });
      body.innerHTML =
        '<div class="adm-toolbar">' + K.chips({ label: 'Saring log aktivitas', name: 'log-group', value: LOG.group, items: [{ value: '', label: 'Semua', count: counts[''] }].concat(Object.keys(LOG_GROUPS).map(function (g) { return { value: g, label: LOG_GROUPS[g], count: counts[g] }; })) }) + '</div>' +
        '<div id="log-list"></div>';
      var listEl = d.getElementById('log-list');
      function paint() {
        var list = all.filter(function (x) { return !LOG.group || logGroup(x) === LOG.group; });
        if (!list.length) {
          listEl.innerHTML = K.empty({ icon: 'activity', title: 'Belum ada aktivitas', text: all.length ? 'Tidak ada aktivitas pada kelompok ini.' : 'Keputusan dan perubahan yang dilakukan admin akan tercatat di sini.' });
          return;
        }
        var shown = list.slice(0, LOG.shown), html = '', day = '';
        shown.forEach(function (x) {
          var local = util.parseDate(x.at);
          var key = local ? local.getFullYear() + '-' + util.pad(local.getMonth() + 1) + '-' + util.pad(local.getDate()) : '';
          if (key !== day) {
            if (day) html += '</ol>';
            day = key;
            html += '<h3 class="adm-day">' + h(local ? util.formatDate(local, { weekday: true }) : 'Tanpa tanggal') + '</h3><ol class="adm-feed" role="list">';
          }
          html += K.auditItem(x);
        });
        html += '</ol>';
        if (list.length > shown.length) html += '<p class="adm-more"><button type="button" class="btn btn--ghost btn--sm" id="log-more"><span>Tampilkan lebih banyak</span><span class="adm-dim">(' + h(util.formatNumber(list.length - shown.length)) + ' lagi)</span></button></p>';
        listEl.innerHTML = '<p class="adm-count">' + h(K.plural(list.length, 'aktivitas')) + '</p>' + html;
        ui.reveal(listEl);
        var more = d.getElementById('log-more');
        if (more) more.addEventListener('click', function () { LOG.shown += 30; paint(); var b = d.getElementById('log-more'); if (b) b.focus(); });
      }
      paint();
      K.bindChips(body, 'log-group', function (v) { LOG.group = v; LOG.shown = 30; paint(); });
    }
  };

  /* =====================================================================
     BOOT
     ===================================================================== */
  PPAPI.onReady(async function () {
    if (!PPAPI.session.current().isAdmin) return; /* core redirects non-admins */
    mountExtraSections();
    renderMeta();
    /* delegated: open details, presets, retry */
    d.addEventListener('click', function (e) {
      var t = e.target.closest ? e.target.closest('[data-open],[data-preset],[data-adm-retry]') : null;
      if (!t || !d.querySelector('.adm-main').contains(t) && !t.closest('.drawer,.modal')) return;
      if (t.hasAttribute('data-adm-retry')) {
        e.preventDefault();
        K.load('all').then(function () { K.renderCounts(); K.renderCurrent(); });
        return;
      }
      if (t.hasAttribute('data-preset')) {
        var p = null;
        try { p = JSON.parse(t.getAttribute('data-preset')); } catch (err) { p = null; }
        if (p && p.section && K.sections[p.section] && K.sections[p.section].preset) {
          e.preventDefault();
          K.sections[p.section].preset(p);
          K.go(p.section, p.sub || '');
        }
        return;
      }
      var kind = t.getAttribute('data-open'), id = t.getAttribute('data-id');
      if (kind === 'member' && K.openMember) { e.preventDefault(); K.openMember(id); }
      else if (kind === 'feedback') { e.preventDefault(); K.openFeedback(id); }
    });
    var refresh = d.getElementById('adm-refresh');
    if (refresh) refresh.addEventListener('click', async function () {
      ui.setLoading(refresh, true, 'Memuat…');
      try { await K.load('all'); K.renderCounts(); K.renderCurrent(); ui.toast('Data konsol diperbarui.', { type: 'success' }); }
      finally { ui.setLoading(refresh, false); }
    });
    w.addEventListener('hashchange', function () {
      /* back/forward while a detail panel is open: the panel belongs to the previous view → close it
         (never while a dialog sits on top — that could discard what the admin is typing) */
      if (!d.querySelector('.modal')) util.$$('.drawer .drawer__close').forEach(function (b) { b.click(); });
      show(parseHash(), { focus: true });
    });

    var route = parseHash();
    K.route = route;
    show(route); /* skeletons stay until the data arrives */
    /* web fonts change the tab widths after the first layout */
    if (d.fonts && d.fonts.ready) d.fonts.ready.then(keepTabInView, function () { /* ignore */ });
    await K.load('all');
    K.ready = true;
    K.renderCounts();
    K.renderCurrent();
    d.documentElement.setAttribute('data-admin-ready', '');
  });
})(window, document);
