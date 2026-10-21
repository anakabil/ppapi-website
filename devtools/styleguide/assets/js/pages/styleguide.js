/* PPAPI — styleguide.js (internal component gallery)
   1) Clones every [data-sg-pair] section into a dark twin (before core boots,
      so core hydrates icons/tabs/accordions in both).
   2) Renders data-driven samples and wires demo buttons via PPAPI.* APIs. */
(function (d) {
  'use strict';

  /* ---------- 1. light/dark twins ---------- */
  Array.prototype.forEach.call(d.querySelectorAll('[data-sg-pair]'), function (sec) {
    var clone = sec.cloneNode(true);
    clone.removeAttribute('data-sg-pair');
    clone.classList.add('section--dark');
    clone.setAttribute('data-sg-dark', '');
    var map = {};
    Array.prototype.forEach.call(clone.querySelectorAll('[id]'), function (el) { map[el.id] = el.id + '-d'; el.id += '-d'; });
    ['for', 'aria-controls', 'aria-labelledby', 'aria-describedby'].forEach(function (attr) {
      Array.prototype.forEach.call(clone.querySelectorAll('[' + attr + ']'), function (el) {
        el.setAttribute(attr, el.getAttribute(attr).split(/\s+/).map(function (t) { return map[t] || t; }).join(' '));
      });
    });
    Array.prototype.forEach.call(clone.querySelectorAll('input[name], select[name], textarea[name]'), function (el) { el.name += '-d'; });
    var label = clone.querySelector('.sg-context-label');
    if (label) label.textContent = 'Konteks gelap';
    var h2 = clone.querySelector('h2');
    if (h2) h2.insertAdjacentHTML('beforeend', '<span class="sr-only"> (konteks gelap)</span>');
    /* landmark & region pada kembaran gelap diberi nama berbeda agar tidak kembar (axe landmark-unique) */
    Array.prototype.forEach.call(clone.querySelectorAll('nav[aria-label], [role="navigation"][aria-label], [role="region"][aria-label], section[aria-label], aside[aria-label], ol[aria-label]'), function (el) {
      el.setAttribute('aria-label', el.getAttribute('aria-label') + ' (konteks gelap)');
    });
    if (clone.hasAttribute('aria-label')) clone.setAttribute('aria-label', clone.getAttribute('aria-label') + ' (konteks gelap)');
    Array.prototype.forEach.call(clone.querySelectorAll('.accordion__trigger'), function (el) {
      el.insertAdjacentHTML('beforeend', '<span class="sr-only"> (konteks gelap)</span>');
    });
    sec.parentNode.insertBefore(clone, sec.nextSibling);
  });

  /* ---------- 2. dynamic samples & demo wiring ---------- */
  PPAPI.onReady(function () {
    var U = PPAPI.util, ui = PPAPI.ui, h = U.h, icon = PPAPI.icon, data = PPAPI.data;
    function all(sel) { return U.$$(sel); }

    all('[data-sg-mode]').forEach(function (el) {
      var user = PPAPI.auth.current();
      el.innerHTML = icon('lock', { size: 16 }) + ' Auth: ' + h(PPAPI.auth.mode === 'demo' ? 'Mode Demo' : PPAPI.auth.mode) + (user ? ' · ' + h(user.name || user.email || user.phone) : '');
    });

    var berita = (data.berita || []).slice(0, 3);
    all('[data-sg="news"]').forEach(function (box) {
      box.innerHTML = berita.map(function (b) {
        return '<article class="news-card">' +
          '<div class="news-card__media">' + U.img(b.gambar, { small: true, cls: 'img-mono' }) + '</div>' +
          '<div class="news-card__meta"><span class="tag">' + h(b.kategori) + '</span><time datetime="' + h(b.tanggal) + '">' + h(U.formatDate(b.tanggal, { short: true })) + '</time>' + U.contohBadge(b) + '</div>' +
          '<h3 class="news-card__title"><a href="berita.html?id=' + encodeURIComponent(b.id) + '">' + h(b.judul) + '</a></h3>' +
          '<p class="news-card__excerpt">' + h(b.ringkasan) + '</p>' +
        '</article>';
      }).join('') || ui.emptyState({ icon: 'file-text', title: 'Belum ada berita', text: 'Data berita tidak dimuat.' });
    });

    var today = U.todayIso();
    var agenda = (data.agenda || []).slice().sort(function (a, b) { return a.mulai < b.mulai ? -1 : 1; });
    var upcoming = agenda.filter(function (a) { return (a.selesai || a.mulai) >= today; }).slice(0, 2);
    var past = agenda.filter(function (a) { return (a.selesai || a.mulai) < today; }).slice(-1);
    all('[data-sg="events"]').forEach(function (box) {
      box.innerHTML = upcoming.concat(past).map(function (a) {
        var s = U.parseDate(a.mulai), e = U.parseDate(a.selesai) || s;
        var range = a.selesai && a.selesai !== a.mulai && s.getMonth() === e.getMonth();
        var isPast = (a.selesai || a.mulai) < today;
        return '<article class="event-row' + (isPast ? ' is-past' : '') + '">' +
          '<div class="date-block' + (range ? ' date-block--range' : '') + '"><span class="date-block__day">' + s.getDate() + (range ? '–' + e.getDate() : '') + '</span><span class="date-block__month">' + U.MONTHS_SHORT[s.getMonth()] + '</span><span class="date-block__year">' + s.getFullYear() + '</span></div>' +
          '<div class="event-row__body"><div class="event-row__meta"><span class="tag">' + h(a.jenis) + '</span><span class="badge badge--outline">' + h(a.mode) + '</span>' + (isPast ? '<span class="badge badge--muted">Telah berlangsung</span>' : '') + U.contohBadge(a) + '</div>' +
            '<h3 class="event-row__title"><a href="agenda.html">' + h(a.judul) + '</a></h3>' +
            '<p class="event-row__info"><span>' + icon('clock', { size: 16 }) + h(a.waktu) + '</span><span>' + icon('map-pin', { size: 16 }) + h(a.lokasi) + '</span></p></div>' +
          '<div class="event-row__aside"><a class="btn btn--ghost btn--sm" href="agenda.html"><span>Detail</span></a></div>' +
        '</article>';
      }).join('');
    });

    var regs = (data.regulasi || []).filter(function (r) { return r.kunci; }).slice(0, 4);
    all('[data-sg="table"]').forEach(function (tb) {
      tb.innerHTML = regs.map(function (r) {
        var tone = r.status === 'Dicabut' ? 'err' : (r.status === 'Berlaku' ? 'ok' : 'warn');
        return '<tr>' +
          '<td data-label="Jenis">' + h(r.jenis) + '</td>' +
          '<td data-label="Nomor / Tahun"><strong>' + h(r.singkatan) + '</strong></td>' +
          '<td data-label="Judul">' + h(r.judul) + '<span class="table__muted">' + h(r.relevansi) + '</span></td>' +
          '<td data-label="Status"><span class="badge badge--' + tone + '">' + h(r.status) + '</span></td>' +
          '<td data-label="Sumber">' + (r.tautan ? '<a class="btn btn--link btn--sm" href="' + h(r.tautan) + '" target="_blank" rel="noopener"><span>Naskah</span>' + icon('arrow-up-right', { size: 16, cls: 'btn__icon' }) + '</a>' : '<span class="muted">—</span>') + '</td>' +
        '</tr>';
      }).join('');
    });

    all('[data-sg="status-badges"]').forEach(function (b) {
      b.innerHTML = U.MEMBER_STATUSES.concat(['Kedaluwarsa']).map(function (s) { return U.statusBadge(s); }).join('') +
        '<span class="badge badge--metal">Admin</span>';
    });

    all('[data-sg="skeleton"]').forEach(function (b) { b.innerHTML = ui.skeleton(4); });
    all('[data-sg="empty"]').forEach(function (b) {
      b.innerHTML = ui.emptyState({ icon: 'search', title: 'Tidak ada hasil', text: 'Coba kata kunci lain atau hapus filter.', actionHtml: '<button type="button" class="btn btn--ghost btn--sm"><span>Hapus filter</span></button>' });
    });
    all('[data-sg="icons"]').forEach(function (b) {
      b.innerHTML = PPAPI.icons.map(function (n) { return '<div class="sg-icon">' + icon(n, { size: 24 }) + '<code>' + h(n) + '</code></div>'; }).join('');
    });

    all('[data-sg-otp]').forEach(function (el) {
      ui.otp(el, { onComplete: function (v) { ui.toast(v === '123456' ? 'Kode OTP sesuai (demo).' : 'Kode OTP tidak sesuai.', { type: v === '123456' ? 'success' : 'error' }); if (v !== '123456') ui.otp(el).setInvalid(true); } });
    });

    all('[data-sg-strength]').forEach(function (meter) {
      var input = meter.closest('.field').querySelector('input');
      input.addEventListener('input', function () {
        var s = U.passwordStrength(input.value);
        meter.setAttribute('data-level', s.score);
        meter.querySelector('.strength__label').textContent = s.label;
      });
    });
    all('[data-sg-counter]').forEach(function (c) {
      var ta = c.closest('.field').querySelector('textarea');
      ta.addEventListener('input', function () { c.textContent = U.formatNumber(ta.value.length) + ' / 2.000'; });
    });
    all('[data-sg-form]').forEach(function (f) {
      f.addEventListener('submit', function (e) { e.preventDefault(); ui.toast('Formulir contoh — tidak ada data yang dikirim.', { type: 'info' }); });
    });

    function openDrawer() {
      var kv = function (k, v) { return '<div class="kv__row"><dt>' + h(k) + '</dt><dd>' + v + '</dd></div>'; };
      ui.drawer({
        eyebrow: 'Permohonan · Contoh',
        title: 'Bagus Pratama',
        body:
          '<div class="drawer__section"><p class="drawer__section-title">Ringkasan</p>' +
            '<div class="cluster mb-2">' + U.statusBadge('Menunggu Verifikasi') + '<span class="badge badge--outline">Praktisi</span><span class="badge badge--contoh">Contoh</span></div>' +
            '<dl class="kv">' + kv('Diajukan', h(U.formatDate('2026-10-06'))) + kv('Kota', 'Samarinda, Kalimantan Timur') + kv('Perusahaan', 'PT Contoh Rangka Baja') + kv('Pengalaman', '7 tahun') + '</dl></div>' +
          '<div class="drawer__section"><p class="drawer__section-title">Riwayat</p>' +
            '<ol class="status-track status-track--vertical" aria-label="Riwayat pengajuan">' +
              '<li class="status-track__step is-done"><span class="status-track__node" aria-hidden="true"></span><span class="status-track__label">Akun dibuat</span><span class="status-track__meta">28 Sep 2026</span></li>' +
              '<li class="status-track__step is-current" aria-current="step"><span class="status-track__node" aria-hidden="true"></span><span class="status-track__label">Diajukan</span><span class="status-track__meta">6 Okt 2026 · menunggu keputusan</span></li>' +
            '</ol></div>' +
          '<div class="drawer__section"><p class="drawer__section-title">Catatan pemohon</p><p class="muted">Bersedia mengikuti wawancara atau verifikasi lanjutan bila diperlukan.</p></div>',
        actions: [
          { label: 'Tolak', variant: 'danger', onClick: function () { return ui.confirm('Tolak pengajuan contoh ini?', { title: 'Tolak pengajuan', okLabel: 'Ya, tolak', danger: true }).then(function (ok) { if (ok) ui.toast('Contoh: pengajuan ditolak.', { type: 'info' }); return ok ? undefined : false; }); } },
          { label: 'Minta Perbaikan', variant: 'ghost', onClick: function () { ui.toast('Contoh: permintaan perbaikan dikirim.', { type: 'info' }); } },
          { label: 'Setujui', variant: 'primary', onClick: function () { return U.sleep(600).then(function () { ui.toast('Contoh: pengajuan disetujui.', { type: 'success' }); }); } }
        ]
      });
    }

    d.addEventListener('click', function (e) {
      var t = e.target.closest('[data-sg-toast], [data-sg-modal], [data-sg-confirm], [data-sg-loading], [data-sg-drawer], [data-sg-chips] .chip, a[href="#"]');
      if (!t) return;
      if (t.matches('a[href="#"]')) { e.preventDefault(); return; }
      if (t.hasAttribute('data-sg-drawer')) { openDrawer(); return; }
      if (t.hasAttribute('data-sg-toast')) {
        var type = t.getAttribute('data-sg-toast');
        var msg = { info: 'Agenda baru telah ditambahkan ke kalender Anda.', success: 'Profil berhasil disimpan.', warn: 'Sertifikat Anda akan kedaluwarsa dalam 43 hari.', error: 'Koneksi internet bermasalah. Periksa jaringan Anda, lalu coba lagi.' }[type];
        ui.toast(msg, { type: type });
      } else if (t.hasAttribute('data-sg-modal')) {
        ui.modal({
          title: 'Tambah Sertifikat',
          eyebrow: 'Contoh modal',
          size: 'md',
          body: '<p>Modal memakai permukaan terang, fokus terkunci di dalam dialog, dan dapat ditutup dengan Esc atau klik latar.</p>' +
            '<div class="form"><div class="field"><label class="field__label" for="sgm-title">Judul sertifikat</label><input class="field__control" id="sgm-title" placeholder="Contoh: Teknisi Scaffolding"></div>' +
            '<div class="form__row form__row--2"><div class="field"><label class="field__label" for="sgm-from">Tanggal terbit</label><input class="field__control" type="date" id="sgm-from"></div>' +
            '<div class="field"><label class="field__label" for="sgm-to">Kedaluwarsa</label><input class="field__control" type="date" id="sgm-to"></div></div></div>',
          actions: [
            { label: 'Batal', variant: 'ghost' },
            { label: 'Simpan', variant: 'primary', onClick: function () { return U.sleep(700).then(function () { ui.toast('Sertifikat contoh disimpan.', { type: 'success' }); }); } }
          ]
        });
      } else if (t.hasAttribute('data-sg-confirm')) {
        var danger = t.getAttribute('data-sg-confirm') === 'danger';
        ui.confirm(danger ? 'Hapus kompetensi “Teknisi Scaffolding”? Tindakan ini tidak dapat dibatalkan.' : 'Simpan perubahan profil Anda sekarang?', danger ? { title: 'Hapus kompetensi', okLabel: 'Ya, hapus', danger: true } : {})
          .then(function (ok) { ui.toast(ok ? 'Dikonfirmasi.' : 'Dibatalkan.', { type: ok ? 'success' : 'info' }); });
      } else if (t.hasAttribute('data-sg-loading')) {
        ui.setLoading(t, true, 'Menyimpan…');
        setTimeout(function () { ui.setLoading(t, false); ui.toast('Tersimpan.', { type: 'success' }); }, 1600);
      } else if (t.classList.contains('chip')) {
        U.$$('.chip', t.parentNode).forEach(function (c) { c.setAttribute('aria-pressed', c === t ? 'true' : 'false'); });
      }
    });

    ui.reveal(d.getElementById('main'));
  });
})(document);
