/* ==========================================================================
   PPAPI — kegiatan-saya.js
   Tampilan peserta untuk kegiatan (butuh store-kegiatan.js → PPAPI.kegiatan):

   • PPAPI.kegiatanUI.panel(el, eventOrId, { compact, next })
       Panel "Pendaftaran · Daftar hadir · Sertifikat" untuk satu kegiatan
       (dipakai detail agenda dan kartu Kegiatan Saya). Tombol "Isi Daftar
       Hadir" aktif otomatis dari (selesai − 30 menit) sampai (selesai + 3 jam)
       dengan hitung mundur langsung. → { refresh(), destroy() }

   • PPAPI.kegiatanSaya.render(container, { headingLevel: 2, headingId, title, limit, next })
       Bagian "Kegiatan Saya" untuk dasbor: kegiatan yang diikuti akun ini,
       tombol daftar hadir, tautan ruang, dan unduhan sertifikat.
       → Promise<{ refresh(), destroy(), count }>

   Gaya: assets/css/kegiatan.css (dipasang otomatis bila belum ditautkan).
   Semua teks data di-escape dengan PPAPI.util.h().
   ========================================================================== */
(function (w, d) {
  'use strict';

  var PPAPI = w.PPAPI;
  if (!PPAPI || !PPAPI.util) return;
  var util = PPAPI.util, h = util.h, icon = PPAPI.icon;
  function K() { return PPAPI.kegiatan; }
  function ui() { return PPAPI.ui; }

  /* ---- stylesheet bersama (kegiatan.css) ---- */
  var SCRIPT_SRC = (d.currentScript && d.currentScript.src) || '';
  function ensureCss() {
    if (d.querySelector('link[data-kegiatan-css], link[href$="kegiatan.css"]')) return;
    var href = SCRIPT_SRC ? SCRIPT_SRC.replace(/js\/kegiatan-saya\.js(\?.*)?$/, 'css/kegiatan.css') : 'assets/css/kegiatan.css';
    var l = d.createElement('link');
    l.rel = 'stylesheet'; l.href = href; l.setAttribute('data-kegiatan-css', '');
    d.head.appendChild(l);
  }
  ensureCss();

  /* ---- pembantu ---- */
  function sess() { return PPAPI.session && PPAPI.session.current ? PPAPI.session.current() : { user: PPAPI.auth && PPAPI.auth.current() }; }
  function nextParam(o) { return o && o.next ? o.next : util.fileName() + w.location.search; }
  function loginHref(o) { return 'masuk.html?next=' + encodeURIComponent(nextParam(o)); }
  function btnIcon(name, size) { return icon(name, { cls: 'btn__icon', size: size || 18 }); }
  function cspAllowsFrame(host) {
    var m = d.querySelector('meta[http-equiv="Content-Security-Policy"]');
    if (!m) return true;
    var fs = /frame-src([^;]*)/.exec(m.getAttribute('content') || '');
    return !!(fs && fs[1].indexOf(host) !== -1);
  }
  function googleFormEmbed(url) {
    if (!/^https:\/\/docs\.google\.com\/forms\//i.test(url || '')) return '';
    try { var u = new URL(url); u.searchParams.set('embedded', 'true'); return u.href; } catch (e) { return ''; }
  }
  function toastErr(err) { ui().toast(err && err.message ? err.message : 'Permintaan belum dapat diproses. Silakan coba lagi.', { type: 'error', timeout: 6500 }); }

  /* ---- penghitung waktu bersama (satu interval untuk semua panel) ---- */
  var mounted = [];
  var ticker = null;
  function startTicker() {
    if (ticker) return;
    ticker = setInterval(function () {
      mounted = mounted.filter(function (p) { return p.el.isConnected && !p.dead; });
      if (!mounted.length) { clearInterval(ticker); ticker = null; return; }
      mounted.forEach(function (p) { p.tick(); });
    }, 1000);
  }

  /* ======================================================================
     PANEL SATU KEGIATAN
     ====================================================================== */
  function panel(el, evOrId, o) {
    o = o || {};
    var st = null, busy = false, lastState = '', lastPhase = '', meeting = null;
    var api = { el: el, dead: false, tick: tick, refresh: load, destroy: function () { api.dead = true; } };

    async function load() {
      if (!K()) { el.innerHTML = ''; return; }
      if (!st) el.innerHTML = '<div class="kg-panel kg-panel--loading">' + ui().skeleton(3) + '</div>';
      try {
        var ev = typeof evOrId === 'object' && evOrId ? (st ? await K().get(evOrId.id) : evOrId) : await K().get(evOrId);
        if (ev && typeof evOrId === 'object') evOrId = ev;
        st = ev ? await K().myStatus(ev) : null;
        meeting = st && st.participant ? await K().meetingInfo(ev.id) : null;
      } catch (err) {
        console.error(err);
        el.innerHTML = '<div class="alert alert--err" role="alert">' + icon('alert-triangle', { size: 18 }) + '<div><p>' + h(err.message || 'Data kegiatan belum dapat dimuat.') + '</p></div></div>';
        return;
      }
      render();
    }

    function stepClass(state) { return 'kg-step' + (state ? ' is-' + state : ''); }

    function regStep() {
      var ev = st.event, p = st.participant, el2 = st.eligibility, s = sess();
      var head = '<span class="kg-step__num" aria-hidden="true">01</span><span class="kg-step__title">Pendaftaran</span>';
      if (p) {
        var acts = [];
        if (meeting && meeting.link) acts.push('<a class="btn btn--primary btn--sm" href="' + h(meeting.link) + '" target="_blank" rel="noopener noreferrer"><span>Masuk Ruang Daring</span>' + btnIcon('arrow-up-right', 16) + '<span class="sr-only"> (tab baru)</span></a>');
        if (ev.tautanDaftar) {
          acts.push('<a class="btn btn--ghost btn--sm" href="' + h(ev.tautanDaftar) + '" target="_blank" rel="noopener noreferrer"><span>Formulir Penyelenggara</span>' + btnIcon('arrow-up-right', 16) + '<span class="sr-only"> (tab baru)</span></a>');
          if (!o.compact && googleFormEmbed(ev.tautanDaftar) && cspAllowsFrame('docs.google.com')) acts.push('<button type="button" class="btn btn--link btn--sm" data-kg="embed"><span>Isi di halaman ini</span></button>');
        }
        acts.push('<button type="button" class="btn btn--link btn--sm" data-kg="ics">' + icon('calendar', { size: 16 }) + '<span>Tambahkan ke Kalender</span></button>');
        var canCancel = !st.attendance && Date.now() < ev.mulai;
        var canRename = !st.attendance && st.window.state !== 'tutup';
        return '<li class="' + stepClass('done') + '">' + head +
          '<p class="kg-step__text"><span class="badge badge--ok">Terdaftar</span> ' + (isFinite(p.at) ? '<span class="kg-dim">sejak ' + h(K().fmtDate(p.at, { short: true })) + ', ' + h(K().fmtTime(p.at)) + ' WIB</span>' : '') + '</p>' +
          '<p class="kg-step__text kg-name">Nama pada sertifikat: <strong>' + h(p.nama) + '</strong>' + (canRename ? ' <button type="button" class="kg-inline-btn" data-kg="rename">Ubah</button>' : '') + '</p>' +
          (meeting && meeting.catatan && !o.compact ? '<p class="kg-step__text kg-dim">' + h(meeting.catatan) + '</p>' : '') +
          (ev.mode !== 'Luring' && !(meeting && meeting.link) && !o.compact ? '<p class="kg-step__text kg-dim">Tautan ruang daring akan tampil di sini setelah disiapkan sekretariat.</p>' : '') +
          (ev.tautanDaftar && !o.compact ? '<p class="kg-step__text kg-dim">Penyelenggara meminta Anda melengkapi formulir pendaftarannya juga.</p>' : '') +
          '<div class="kg-step__actions">' + acts.join('') + '</div>' +
          (canCancel && !o.compact ? '<p class="kg-step__foot"><button type="button" class="kg-inline-btn kg-inline-btn--muted" data-kg="cancel">Batalkan pendaftaran</button></p>' : '') +
          '</li>';
      }
      if (!el2.ok) {
        var action = '';
        if (el2.code === 'masuk') action = '<a class="btn btn--primary btn--sm" href="' + h(loginHref(o)) + '"><span>Masuk untuk Mendaftar</span>' + btnIcon('arrow-right', 16) + '</a>' +
          '<a class="btn btn--ghost btn--sm" href="masuk.html?next=' + encodeURIComponent(nextParam(o)) + '#daftar"><span>Buat Akun</span></a>';
        else if (el2.code === 'aktif') action = (ui().lockedAction ? ui().lockedAction({ compact: true }) : '<a class="btn btn--ghost btn--sm" href="pendaftaran.html"><span>Formulir Pendaftaran Anggota</span></a>');
        var tone = el2.code === 'aktif' ? 'is-locked' : (el2.code === 'masuk' ? 'is-current' : 'is-locked');
        return '<li class="kg-step ' + tone + '">' + head +
          '<p class="kg-step__text">' + (el2.code === 'aktif' ? icon('lock', { size: 16 }) + ' ' : '') + h(el2.text) + '</p>' +
          (action ? '<div class="kg-step__actions">' + action + '</div>' : '') + '</li>';
      }
      var quota = ev.kuota > 0 ? '<span class="kg-dim">Sisa kuota ' + h(util.formatNumber(ev.sisa)) + ' dari ' + h(util.formatNumber(ev.kuota)) + ' peserta.</span>' : '<span class="kg-dim">Kuota tidak dibatasi.</span>';
      var defName = (s.member && s.member.name) || (s.user && s.user.name) || '';
      var fid = 'kg-nama-' + h(ev.id);
      return '<li class="' + stepClass('current') + '">' + head +
        '<p class="kg-step__text">Daftarkan diri Anda agar dapat mengisi daftar hadir' + (ev.sertifikat ? ' dan mengunduh sertifikat' : '') + '. ' + quota + '</p>' +
        (o.compact ? '' : '<div class="field kg-field"><label class="field__label" for="' + fid + '">Nama pada sertifikat</label>' +
          '<input class="field__control" id="' + fid + '" type="text" maxlength="120" autocomplete="name" value="' + h(defName) + '" aria-describedby="' + fid + '-hint">' +
          '<p class="field__hint" id="' + fid + '-hint">Tulis lengkap beserta gelar bila perlu. Nama dapat diubah sampai daftar hadir diisi.</p></div>') +
        '<div class="kg-step__actions"><button type="button" class="btn btn--primary btn--sm" data-kg="register"><span>Daftar Sekarang</span>' + btnIcon('arrow-right', 16) + '</button>' +
        (ev.tautanDaftar ? '<span class="kg-dim kg-note">Setelah mendaftar, Anda diarahkan ke formulir penyelenggara.</span>' : '') + '</div></li>';
    }

    function attendStep() {
      var ev = st.event, win = st.window, a = st.attendance, p = st.participant;
      var head = '<span class="kg-step__num" aria-hidden="true">02</span><span class="kg-step__title">Daftar hadir</span>';
      if (a) return '<li class="' + stepClass('done') + '">' + head +
        '<p class="kg-step__text"><span class="badge badge--ok">Hadir</span> <span class="kg-dim">tercatat ' + h(K().fmtDateTime(a.at, { short: true })) + (a.olehAdmin ? ' (oleh sekretariat)' : '') + '</span></p></li>';
      var openTxt = K().fmtDateTime(win.buka, { weekday: true }), closeTxt = K().fmtDateTime(win.tutup, { weekday: true });
      var info, cd = '', enabled = false, cls = 'is-locked';
      if (win.state === 'belum') {
        info = 'Tombol aktif otomatis 30 menit sebelum kegiatan selesai: ' + openTxt + '.';
        cd = '<p class="kg-cd" data-kg-cd="buka" aria-live="off"><span class="kg-cd__label">Dibuka dalam</span> <span class="kg-cd__time" data-kg-cd-time>' + h(K().fmtCountdown(win.msToOpen)) + '</span></p>';
      } else if (win.state === 'buka') {
        enabled = !!p; cls = p ? 'is-current' : 'is-locked';
        info = p ? 'Daftar hadir sedang dibuka sampai ' + closeTxt + '.' : 'Daftar hadir sedang dibuka, khusus peserta yang sudah terdaftar.';
        cd = '<p class="kg-cd kg-cd--open" data-kg-cd="tutup" aria-live="off"><span class="kg-cd__label">Ditutup dalam</span> <span class="kg-cd__time" data-kg-cd-time>' + h(K().fmtCountdown(win.msToClose)) + '</span></p>';
      } else {
        info = 'Daftar hadir sudah ditutup pada ' + closeTxt + '.';
        cls = 'is-closed';
      }
      if (!p && win.state !== 'tutup') info += ' Daftar hadir hanya untuk peserta terdaftar.';
      return '<li class="kg-step ' + cls + '">' + head +
        '<p class="kg-step__text">' + h(info) + '</p>' + cd +
        '<div class="kg-step__actions"><button type="button" class="btn ' + (enabled ? 'btn--primary' : 'btn--ghost') + ' btn--sm kg-attend" data-kg="attend"' + (enabled ? '' : ' disabled aria-disabled="true"') + '>' + icon('check-circle', { size: 16 }) + '<span>Isi Daftar Hadir</span></button></div></li>';
    }

    function certStep() {
      var ev = st.event, a = st.attendance;
      var head = '<span class="kg-step__num" aria-hidden="true">03</span><span class="kg-step__title">Sertifikat</span>';
      if (!ev.sertifikat) return '<li class="kg-step is-closed">' + head + '<p class="kg-step__text kg-dim">Kegiatan ini tidak menyediakan sertifikat.</p></li>';
      if (!a) return '<li class="kg-step is-locked">' + head + '<p class="kg-step__text">Sertifikat PDF dapat diunduh setelah Anda mengisi daftar hadir.</p></li>';
      var no = a.sertNo ? K().certDisplay(a.sertNo) : '';
      return '<li class="' + stepClass(a.sertNo ? 'done' : 'current') + '">' + head +
        (no ? '<p class="kg-step__text">Nomor <strong class="kg-no">' + h(no) + '</strong> · <a class="link" href="sertifikat.html?no=' + encodeURIComponent(no) + '">Periksa keaslian</a></p>'
          : '<p class="kg-step__text">Sertifikat Anda siap. Nomor sertifikat diterbitkan saat pertama kali diunduh.</p>') +
        '<div class="kg-step__actions"><button type="button" class="btn btn--primary btn--sm" data-kg="cert">' + icon('download', { size: 16 }) + '<span>Unduh Sertifikat (PDF)</span></button></div></li>';
    }

    function render() {
      if (!st) { el.innerHTML = '<div class="kg-panel"><p class="kg-dim">Kegiatan ini tidak tersedia.</p></div>'; return; }
      var ev = st.event;
      lastState = st.window.state; lastPhase = K().phaseOf(ev);
      el.innerHTML =
        '<div class="kg-panel' + (o.compact ? ' kg-panel--compact' : '') + '" data-kg-panel="' + h(ev.id) + '">' +
          (o.compact ? '' : '<div class="kg-panel__head"><p class="kg-panel__eyebrow">Pendaftaran &amp; kehadiran</p>' +
            '<span class="badge ' + (ev.akses === 'aktif' ? 'badge--metal' : 'badge--outline') + '">' + h(ev.akses === 'aktif' ? 'Khusus anggota Aktif' : 'Terbuka untuk semua akun') + '</span></div>') +
          '<ol class="kg-steps">' + regStep() + attendStep() + certStep() + '</ol>' +
          '<p class="kg-panel__live sr-only" aria-live="polite" data-kg-live></p>' +
        '</div>';
      ui().reveal(el);
    }

    function tick() {
      if (!st || busy) return;
      var win = K().windowOf(st.event), ph = K().phaseOf(st.event);
      if (win.state !== lastState || ph !== lastPhase) {
        st.window = win;
        st.eligibility = K().eligibility(st.event);
        var live = el.querySelector('[data-kg-live]');
        render();
        live = el.querySelector('[data-kg-live]');
        if (live && win.state === 'buka' && st.participant && !st.attendance) live.textContent = 'Daftar hadir sudah dibuka.';
        return;
      }
      var t = el.querySelector('[data-kg-cd-time]');
      if (t) t.textContent = K().fmtCountdown(win.state === 'belum' ? win.msToOpen : win.msToClose);
    }

    async function act(kind, btn) {
      var ev = st && st.event;
      if (!ev || busy) return;
      if (kind === 'ics') { var n = K().downloadIcs(ev, { link: meeting && meeting.link }); ui().toast('Berkas kalender “' + n + '” diunduh.', { type: 'success' }); return; }
      if (kind === 'embed') { openForm(ev); return; }
      if (kind === 'rename') { rename(); return; }
      if (kind === 'cancel') {
        var yes = await ui().confirm('Batalkan pendaftaran Anda pada “' + ev.judul + '”? Kursi Anda akan dilepas untuk peserta lain.', { title: 'Batalkan pendaftaran', okLabel: 'Ya, batalkan', danger: true });
        if (!yes) return;
      }
      busy = true;
      if (btn) ui().setLoading(btn, true, kind === 'cert' ? 'Menyiapkan PDF…' : 'Memproses…');
      try {
        if (kind === 'register') {
          var input = el.querySelector('.kg-field input');
          var nama = input ? input.value.trim() : '';
          if (input && nama.length < 3) {
            input.closest('.field').classList.add('is-invalid'); input.setAttribute('aria-invalid', 'true'); input.focus();
            throw Object.assign(new Error('Tulis nama untuk sertifikat (minimal 3 karakter).'), { code: 'kegiatan/nama' });
          }
          await K().register(ev.id, { nama: nama });
          ui().toast('Pendaftaran berhasil. Sampai jumpa di “' + ev.judul + '”.', { type: 'success' });
          if (ev.tautanDaftar) setTimeout(function () { if (googleFormEmbed(ev.tautanDaftar) && cspAllowsFrame('docs.google.com') && !o.compact) openForm(ev); }, 300);
        } else if (kind === 'cancel') {
          await K().cancel(ev.id);
          ui().toast('Pendaftaran dibatalkan.', { type: 'success' });
        } else if (kind === 'attend') {
          await K().attend(ev.id);
          ui().toast('Terima kasih, kehadiran Anda sudah tercatat.', { type: 'success' });
        } else if (kind === 'cert') {
          var r = await K().downloadCertificate(ev.id);
          ui().toast('Sertifikat ' + r.display + ' diunduh.', { type: 'success' });
        }
      } catch (err) {
        console.warn(err);
        toastErr(err);
        if (btn && btn.isConnected) ui().setLoading(btn, false);
        busy = false;
        if (kind === 'register' && err.code === 'kegiatan/nama') return;
        await load();
        return;
      }
      busy = false;
      await load();
      if (o.onChange) try { o.onChange(st); } catch (e) { /* abaikan */ }
      var focusSel = { register: '[data-kg="attend"], [data-kg="ics"]', attend: '[data-kg="cert"]', cert: '[data-kg="cert"]', cancel: '[data-kg="register"]' }[kind];
      var f = focusSel && el.querySelector(focusSel);
      if (f && !f.disabled) { try { f.focus({ preventScroll: true }); } catch (e) { f.focus(); } }
    }

    function rename() {
      var p = st.participant, ev = st.event;
      ui().modal({
        title: 'Ubah nama pada sertifikat', size: 'sm',
        body: '<div class="field"><label class="field__label" for="kg-rename">Nama lengkap</label><input class="field__control" id="kg-rename" type="text" maxlength="120" value="' + h(p.nama) + '" data-autofocus>' +
          '<p class="field__hint">Nama ini dicetak pada sertifikat dan tidak dapat diubah setelah daftar hadir diisi.</p></div>',
        actions: [
          { label: 'Batal', variant: 'ghost' },
          { label: 'Simpan', variant: 'primary', onClick: async function (close, ctx) {
            var v = ctx.el.querySelector('#kg-rename').value;
            await K().updateName(ev.id, v);
            ui().toast('Nama pada sertifikat diperbarui.', { type: 'success' });
            load();
          } }
        ]
      });
    }

    function openForm(ev) {
      var src = googleFormEmbed(ev.tautanDaftar);
      if (!src) { w.open(ev.tautanDaftar, '_blank', 'noopener'); return; }
      ui().modal({
        title: 'Formulir penyelenggara', eyebrow: ev.judul, size: 'lg', cls: 'kg-form-modal',
        body: '<p class="kg-dim mb-2">Formulir ini disediakan penyelenggara melalui Google Form. Pendaftaran Anda di situs PPAPI sudah tercatat.</p>' +
          '<div class="kg-embed"><iframe src="' + h(src) + '" title="Formulir pendaftaran ' + h(ev.judul) + '" loading="lazy" referrerpolicy="no-referrer"></iframe></div>',
        actions: [
          { label: 'Buka di tab baru', variant: 'ghost', onClick: function () { w.open(ev.tautanDaftar, '_blank', 'noopener'); return false; } },
          { label: 'Selesai', variant: 'primary' }
        ]
      });
    }

    el.addEventListener('click', function (e) {
      var b = e.target.closest('[data-kg]');
      if (!b || !el.contains(b) || b.disabled) return;
      e.preventDefault();
      act(b.getAttribute('data-kg'), b.classList.contains('btn') ? b : null);
    });
    el.addEventListener('input', function (e) {
      var f = e.target.closest('.kg-field');
      if (f && e.target.value.trim().length >= 3) { f.classList.remove('is-invalid'); e.target.removeAttribute('aria-invalid'); }
    });
    mounted.push(api);
    startTicker();
    api.ready = load();
    return api;
  }

  /* ======================================================================
     KEGIATAN SAYA (dasbor)
     ====================================================================== */
  function dateBlock(ev) {
    var a = K().dateIso(ev.mulai).split('-'), b = K().dateIso(ev.selesai).split('-');
    var multi = a.join() !== b.join();
    var day = multi && a[1] === b[1] ? (+a[2]) + '–' + (+b[2]) : String(+a[2]);
    return '<div class="date-block' + (multi && a[1] === b[1] ? ' date-block--range' : '') + '" aria-hidden="true"><span class="date-block__day">' + h(day) + '</span>' +
      '<span class="date-block__month">' + h(util.MONTHS_SHORT[+a[1] - 1]) + '</span><span class="date-block__year">' + h(a[0]) + '</span></div>';
  }
  async function render(container, o) {
    o = o || {};
    if (!container) return null;
    var hl = Math.min(6, Math.max(2, o.headingLevel || 2));
    var api = { count: 0, refresh: draw, destroy: function () { panels.forEach(function (p) { p.destroy(); }); container.innerHTML = ''; } };
    var panels = [];
    container.classList.add('kgs');
    async function draw() {
      panels.forEach(function (p) { p.destroy(); });
      panels = [];
      if (!K()) { container.innerHTML = ''; return api; }
      container.setAttribute('aria-busy', 'true');
      container.innerHTML = head('') + '<div class="kgs__body">' + ui().skeleton(3) + '</div>';
      var rows;
      try { rows = await K().myEvents({ fresh: true }); }
      catch (err) {
        console.error(err);
        container.removeAttribute('aria-busy');
        container.innerHTML = head('') + '<div class="alert alert--err" role="alert">' + icon('alert-triangle', { size: 18 }) + '<div><p>' + h(err.message || 'Kegiatan belum dapat dimuat.') + '</p></div></div>';
        return api;
      }
      if (o.limit) rows = rows.slice(0, o.limit);
      api.count = rows.length;
      container.removeAttribute('aria-busy');
      if (!rows.length) {
        container.innerHTML = head('') + '<div class="kgs__body">' + ui().emptyState({
          icon: 'calendar', title: 'Belum ada kegiatan yang Anda ikuti',
          text: 'Webinar, pelatihan, dan seminar PPAPI diumumkan di halaman Agenda. Setelah mendaftar, daftar hadir dan sertifikat Anda tersedia di sini.',
          actionHtml: '<a class="btn btn--ghost btn--sm" href="agenda.html"><span>Lihat Agenda Kegiatan</span>' + btnIcon('arrow-right', 16) + '</a>'
        }) + '</div>';
        ui().reveal(container);
        return api;
      }
      var now = Date.now();
      container.innerHTML = head(rows.length) + '<div class="kgs__list">' + rows.map(function (r) {
        var ev = r.event, ph = K().phaseOf(ev, now);
        var phBadge = ph === 'berlangsung' ? '<span class="badge badge--ok">Sedang berlangsung</span>' : ph === 'selesai' ? '<span class="badge badge--muted">Telah berlangsung</span>' : '<span class="badge badge--solid">Akan datang</span>';
        return '<article class="kgs-card" aria-labelledby="kgs-t-' + h(ev.id) + '">' + dateBlock(ev) +
          '<div class="kgs-card__body">' +
            '<div class="kgs-card__meta"><span class="tag">' + h(ev.jenis) + '</span><span class="badge badge--outline">' + h(ev.mode) + '</span>' + phBadge + '</div>' +
            '<h' + (hl + 1) + ' class="kgs-card__title" id="kgs-t-' + h(ev.id) + '"><a href="agenda.html?id=' + encodeURIComponent(ev.id) + '">' + h(ev.judul) + '</a></h' + (hl + 1) + '>' +
            '<p class="kgs-card__when">' + icon('clock', { size: 16 }) + '<span>' + h(K().fmtSchedule(ev)) + '</span></p>' +
            '<div class="kgs-card__panel" data-kgs-panel="' + h(ev.id) + '"></div>' +
          '</div></article>';
      }).join('') + '</div>';
      rows.forEach(function (r) {
        var slot = container.querySelector('[data-kgs-panel="' + (w.CSS && CSS.escape ? CSS.escape(r.event.id) : r.event.id) + '"]');
        if (slot) panels.push(panel(slot, r.event, { compact: true, next: o.next || 'dashboard.html' }));
      });
      await Promise.all(panels.map(function (p) { return p.ready; }));
      ui().reveal(container);
      return api;
    }
    function head(n) {
      if (o.title === false) return '';
      return '<header class="kgs__head"><div><p class="eyebrow">Kegiatan Saya</p>' +
        '<h' + hl + ' class="kgs__title"' + (o.headingId ? ' id="' + h(o.headingId) + '"' : '') + '>' + (o.title ? h(o.title) : 'Webinar &amp; <em>pelatihan</em> yang Anda ikuti') + '</h' + hl + '>' +
        (n !== '' ? '<p class="kgs__lead muted">' + h(util.formatNumber(n)) + ' kegiatan · daftar hadir dibuka 30 menit sebelum kegiatan selesai dan ditutup 3 jam sesudahnya.</p>' : '') + '</div>' +
        '<a class="btn btn--link btn--sm" href="agenda.html"><span>Agenda kegiatan</span>' + btnIcon('arrow-right', 16) + '</a></header>';
    }
    await draw();
    if (PPAPI.session && PPAPI.session.onChange) PPAPI.session.onChange(function () { if (container.isConnected) draw(); });
    return api;
  }

  PPAPI.kegiatanUI = { panel: panel, googleFormEmbed: googleFormEmbed };
  PPAPI.kegiatanSaya = { render: render };
})(window, document);
