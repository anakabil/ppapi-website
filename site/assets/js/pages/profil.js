/* ==========================================================================
   PPAPI — Profil Perkumpulan (profil.html)
   Seluruh isi dirender dari PPAPI.data.organisasi (assets/data/organisasi.js).
   • Bagian tanpa data (mis. Sejarah, Legalitas) disembunyikan otomatis.
   • Nomor bab (01, 02, …) dan indeks halaman dihitung dari bagian yang tampil.
   • Pita ajakan "Bergabung" mengikuti sesi (PPAPI.session): tamu → Daftar sekarang;
     akun yang sudah masuk → langkah keanggotaan berikutnya + baris status.
   ========================================================================== */
(function () {
  'use strict';

  PPAPI.onReady(function () {
    var util = PPAPI.util, ui = PPAPI.ui, h = util.h, $ = util.$, $$ = util.$$;
    var org = (PPAPI.data && PPAPI.data.organisasi) || {};
    var cfg = PPAPI.config || {};

    function arr(v) { return Array.isArray(v) ? v.filter(function (x) { return x !== null && x !== undefined && x !== ''; }) : []; }
    function pad(n) { return util.pad(n, 2); }
    function icon(name, opts) { return PPAPI.icon(PPAPI.icons.indexOf(name) !== -1 ? name : 'check-circle', opts); }
    function byId(id) { return document.getElementById(id); }
    function hide(id) { var s = byId(id); if (s) s.hidden = true; }
    function render(el, html) { if (!el) return; el.innerHTML = html; ui.reveal(el); }

    /* ---------- 01 · Tentang ---------- */
    (function () {
      var paras = arr(org.tentang);
      var wrap = $('[data-tentang]');
      if (!paras.length) { render(wrap, '<p class="muted">' + h(cfg.description || '') + '</p>'); }
      else {
        var first = paras[0], rest = paras.slice(1);
        render(wrap,
          '<figure class="profil-quote" data-reveal>' +
            '<span class="profil-quote__mark" aria-hidden="true">“</span>' +
            '<blockquote class="profil-quote__text"><p>' + util.emphasis(first) + '</p></blockquote>' +
          '</figure>' +
          (rest.length ? '<div class="profil-about__body" data-reveal data-reveal-delay="120">' +
            rest.map(function (p) { return '<p>' + util.emphasis(p) + '</p>'; }).join('') + '</div>' : '')
        );
      }

      var fakta = arr(org.fakta).filter(function (f) { return f && f.label && f.nilai; });
      if (!fakta.length) {
        fakta = [{ label: 'Singkatan', nilai: cfg.shortName || 'PPAPI' }, { label: 'Nama', nilai: cfg.fullName || '' }];
      }
      render($('[data-fakta]'), fakta.map(function (f) {
        return '<div class="kv__row"><dt>' + h(f.label) + '</dt><dd>' + h(f.nilai) + '</dd></div>';
      }).join(''));
      var note = $('[data-fakta-note]');
      if (note) note.hidden = arr(org.legalitas).length > 0;
    })();

    /* ---------- 02 · Visi & Misi ---------- */
    (function () {
      var visi = String(org.visi || '').trim();
      var misi = arr(org.misi);
      if (visi) {
        render($('[data-visi]'),
          '<blockquote class="profil-visi__statement"><p class="split-lines">' + util.emphasis(visi) + '</p></blockquote>');
      } else {
        hide('visi-misi');
        var m = byId('misi');
        if (m && misi.length) m.setAttribute('data-chapter', 'Misi');
      }
      if (!misi.length) { hide('misi'); return; }
      render($('[data-misi]'), misi.map(function (t, i) {
        return '<li class="profil-misi__item">' +
          '<span class="profil-misi__num" aria-hidden="true">' + pad(i + 1) + '</span>' +
          '<p class="profil-misi__text">' + util.emphasis(t) + '</p>' +
        '</li>';
      }).join(''));
    })();

    /* ---------- 03 · Nilai ---------- */
    (function () {
      var nilai = arr(org.nilai).filter(function (v) { return v && v.judul; });
      if (!nilai.length) { hide('nilai'); return; }
      var n = nilai.length;
      var grid = $('[data-nilai]');
      if (n >= 4) grid.classList.add('profil-nilai--4');
      render(grid, nilai.map(function (v, i) {
        return '<article class="card card--hover profil-nilai__card">' +
          '<div class="profil-nilai__head">' +
            '<span class="index-num">' + pad(i + 1) + ' <span>/ ' + pad(n) + '</span></span>' +
            '<span class="profil-nilai__icon">' + icon(v.ikon, { size: 22 }) + '</span>' +
          '</div>' +
          '<h3 class="profil-nilai__title">' + h(v.judul) + '</h3>' +
          '<p class="profil-nilai__text">' + h(v.teks) + '</p>' +
        '</article>';
      }).join(''));
    })();

    /* ---------- 04 · Sejarah (disembunyikan bila kosong) ---------- */
    (function () {
      var items = arr(org.sejarah).filter(function (s) { return s && (s.judul || s.teks); });
      if (!items.length) { hide('sejarah'); return; }
      render($('[data-sejarah]'), items.map(function (s, i) {
        return '<li class="timeline__item" data-reveal="' + (i % 2 === 0 ? 'left' : 'right') + '">' +
          '<p class="timeline__year"><span>' + h(s.tahun || '') + '</span></p>' +
          '<h3 class="timeline__title">' + h(s.judul || '') + '</h3>' +
          (s.teks ? '<p class="timeline__text">' + h(s.teks) + '</p>' : '') +
        '</li>';
      }).join(''));
    })();

    /* ---------- 05 · Struktur organisasi ----------
       Butir tanpa nama adalah jabatan yang namanya belum ditetapkan: jabatan menjadi baris utama,
       lingkaran berisi nomor urut, dan baris "Nama menyusul" menggantikan nama. */
    (function () {
      var list = arr(org.pengurus).filter(function (p) { return p && (p.nama || p.jabatan); });
      if (!list.length) { hide('struktur'); return; }
      render($('[data-pengurus]'), list.map(function (p, i) {
        var nama = String(p.nama || '').trim();
        var jabatan = String(p.jabatan || '').trim();
        var pending = !nama;
        var avatar, lines;
        if (pending) {
          avatar = '<span class="person__avatar profil-person__avatar--num" aria-hidden="true">' +
            '<span class="profil-person__num">' + pad(i + 1) + '</span></span>';
          lines = '<p class="person__name profil-person__title">' + h(jabatan || 'Pengurus') + '</p>' +
            '<p class="person__role profil-person__pending">Nama menyusul</p>';
        } else {
          avatar = p.foto
            ? '<span class="person__avatar"><img src="' + h(p.foto) + '" alt="' + h(nama) + '" width="88" height="88" loading="lazy" decoding="async"></span>'
            : '<span class="person__avatar" aria-hidden="true">' + h(util.initials(nama) || '—') + '</span>';
          lines = '<p class="person__name">' + h(nama) + '</p>' +
            (jabatan ? '<p class="person__role">' + h(jabatan) + '</p>' : '');
        }
        return '<div class="profil-person' + (pending ? ' profil-person--pending' : '') + '">' +
          '<div class="person person--center">' + avatar + lines + '</div>' +
        '</div>';
      }).join(''));
      var grid = $('[data-pengurus]');
      grid.classList.toggle('profil-pengurus--few', list.length < 4);
      grid.classList.toggle('profil-pengurus--five', list.length === 5);
    })();

    /* ---------- 06 · Makna logo (logo warna asli + garis penunjuk) ---------- */
    (function () {
      var items = arr(org.maknaLogo).filter(function (m) { return m && (m.judul || m.teks); });
      var sheet = $('[data-logo-sheet]');
      if (!items.length || !sheet) { hide('makna-logo'); return; }

      /* Titik acuan pada logo (persen lebar/tinggi berkas logo-color.png 1200×418). */
      var ANCHORS = {
        huruf:   { x: 21.5, y: 25.5 },   // batang atas huruf "P" pertama
        pipa:    { x: 90.6, y: 3.5 },    // ujung atas pipa perancah
        elips:   { x: 2.4,  y: 62 },     // sisi kiri elips kuning
        tulisan: { x: 64,   y: 103 }     // tepat di bawah tulisan "… PERANCAH INDONESIA"
      };
      var ORDER = ['huruf', 'pipa', 'elips', 'tulisan'];
      var used = {};
      function anchorFor(m, i) {
        var t = String(m.judul || '').toLowerCase();
        var key = /huruf|aksara/.test(t) ? 'huruf'
          : /pipa|klem|tiang/.test(t) ? 'pipa'
          : /elips|lingkar|cincin/.test(t) ? 'elips'
          : /tulisan|praktisi|indonesia/.test(t) ? 'tulisan'
          : ORDER[i];
        if (!key || used[key]) return '';
        used[key] = true;
        return key;
      }
      var notes = items.map(function (m, i) {
        return { num: pad(i + 1), judul: m.judul || '', teks: m.teks || '', anchor: anchorFor(m, i) };
      });
      var half = Math.ceil(notes.length / 2);
      function noteHtml(n) {
        return '<article class="logo-note"' + (n.anchor ? ' data-anchor="' + n.anchor + '"' : '') + '>' +
          '<p class="logo-note__num"><span>' + n.num + '</span></p>' +
          '<h3 class="logo-note__title">' + h(n.judul) + '</h3>' +
          (n.teks ? '<p class="logo-note__text">' + h(n.teks) + '</p>' : '') +
        '</article>';
      }
      var pins = notes.filter(function (n) { return n.anchor; }).map(function (n) {
        var a = ANCHORS[n.anchor];
        return '<span class="logo-pin' + (a.y > 100 ? ' logo-pin--below' : '') + '" style="--x:' + a.x + '%;--y:' + a.y + '%" aria-hidden="true">' + n.num + '</span>';
      }).join('');

      render(sheet,
        '<div class="logo-sheet__row logo-sheet__row--top">' + notes.slice(0, half).map(noteHtml).join('') + '</div>' +
        '<figure class="logo-sheet__figure">' +
          '<div class="logo-sheet__art">' +
            '<img src="assets/img/logo-color.png" width="1200" height="418" loading="lazy" decoding="async" ' +
              'alt="Logo PPAPI dalam warna asli: huruf PPAPI hitam tebal yang condong ke depan, elips kuning yang melingkupinya, batang pipa perancah dengan dua klem di sisi kanan, serta tulisan Praktisi &amp; Ahli Perancah Indonesia.">' +
            pins +
          '</div>' +
          '<figcaption class="logo-sheet__caption"><span>Gbr. 01</span>Logo PPAPI · warna asli</figcaption>' +
        '</figure>' +
        (notes.length > half ? '<div class="logo-sheet__row logo-sheet__row--bottom">' + notes.slice(half).map(noteHtml).join('') + '</div>' : '') +
        '<svg class="scaffold-draw logo-sheet__leaders" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"></svg>'
      );

      var svg = $('.logo-sheet__leaders', sheet);
      var art = $('.logo-sheet__art', sheet);
      var wide = window.matchMedia('(min-width: 1024px)');
      function r(v) { return Math.round(v * 10) / 10; }
      function node(x, y, d) {
        return '<rect class="sd-node logo-leader__node" x="' + r(x - 3.5) + '" y="' + r(y - 3.5) + '" width="7" height="7" style="--d:' + d + '"/>';
      }
      function draw() {
        if (!wide.matches || !art.offsetWidth) { svg.innerHTML = ''; return; }
        var sr = sheet.getBoundingClientRect(), ar = art.getBoundingClientRect();
        var parts = [];
        $$('.logo-note[data-anchor]', sheet).forEach(function (note, k) {
          var a = ANCHORS[note.getAttribute('data-anchor')];
          if (!a) return;
          var ax = ar.left - sr.left + ar.width * a.x / 100;
          var ay = ar.top - sr.top + ar.height * a.y / 100;
          var nr = note.getBoundingClientRect();
          var isTop = !!note.closest('.logo-sheet__row--top');
          var sy = (isTop ? nr.bottom : nr.top) - sr.top;
          var sx = Math.min(Math.max(ax, nr.left - sr.left + 16), nr.right - sr.left - 16);
          var d = 'M' + r(sx) + ' ' + r(sy);
          if (Math.abs(sx - ax) > 1) d += ' V' + r(isTop ? ar.top - sr.top - 20 : ar.bottom - sr.top + 20);
          d += ' L' + r(ax) + ' ' + r(ay);
          parts.push('<path class="sd-line logo-leader" d="' + d + '" pathLength="1" style="--d:' + (300 + k * 180) + '"/>');
          parts.push(node(sx, sy, 300 + k * 180), node(ax, ay, 300 + k * 180));
        });
        svg.innerHTML = parts.join('');
      }
      var schedule = (function () {
        var raf = 0;
        return function () { cancelAnimationFrame(raf); raf = requestAnimationFrame(draw); };
      })();
      draw();
      var img = $('img', art);
      if (img && !img.complete) img.addEventListener('load', schedule);
      if ('ResizeObserver' in window) new ResizeObserver(schedule).observe(sheet);
      else window.addEventListener('resize', util.debounce(draw, 120));
      if (wide.addEventListener) wide.addEventListener('change', schedule);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(schedule);
    })();

    /* ---------- Legalitas (hanya bila data resmi tersedia) ---------- */
    (function () {
      var rows = arr(org.legalitas).filter(function (l) { return l && l.label && l.nilai; });
      var sec = byId('legalitas');
      if (!rows.length) { if (sec) sec.hidden = true; return; }
      render($('[data-legalitas]'), rows.map(function (l) {
        return '<div class="kv__row"><dt>' + h(l.label) + '</dt><dd>' + h(l.nilai) + '</dd></div>';
      }).join(''));
      sec.hidden = false;
    })();

    /* ---------- Ajakan bergabung (mengikuti sesi PPAPI.session) ----------
       masuk.html hanya untuk tamu, sehingga tautan "Daftar sekarang" tidak pernah ditampilkan kepada
       akun yang sudah masuk (sebelumnya mereka dialihkan diam-diam ke dasbor).
       • Belum masuk → "Lihat keanggotaan" + "Daftar sekarang" (masuk.html?next=pendaftaran.html#daftar).
       • Sudah masuk, belum Aktif → langkah berikutnya dari PPAPI.ui.lockedAction() — label dan tujuan
         yang sama dengan panel terkunci, beranda, dan Produk Pengetahuan — + "Lihat keanggotaan".
       • Anggota Aktif → Dasbor Anggota; admin → Konsol Admin (sama dengan halaman Keanggotaan).
       Baris status di bawah tombol menunjukkan status keanggotaan akun yang sedang masuk. */
    (function () {
      var box = $('[data-cta-actions]');
      var line = $('[data-cta-status]');
      if (!box) return;
      var guestHtml = box.innerHTML;
      var arrow = icon('arrow-right', { size: 18, cls: 'btn__icon' });
      var about = '<a class="btn btn--ghost" href="keanggotaan.html"><span>Lihat keanggotaan</span></a>';

      function current() {
        var s = PPAPI.session && PPAPI.session.current ? PPAPI.session.current() : null;
        return s || { user: null, member: null, isAdmin: false, status: '', statusLabel: '', isActive: false, isMemberActive: false };
      }
      function primary(href, label) {
        return '<a class="btn btn--primary" href="' + h(href) + '"><span>' + h(label) + '</span>' + arrow + '</a>';
      }
      function actionsFor(s) {
        if (!s.user) return guestHtml;
        if (s.isMemberActive) return primary('dashboard.html', 'Buka Dasbor Anggota') + about;
        if (s.isAdmin) return primary('admin.html', 'Buka Konsol Admin') + about;
        return (typeof ui.lockedAction === 'function' ? ui.lockedAction({}) : primary('pendaftaran.html', 'Lengkapi Pendaftaran')) + about;
      }
      function statusFor(s) {
        if (!s.user) return '';
        var st = s.status || 'Draf';
        var m = s.member || null;
        var sub = s.isMemberActive && m && m.validUntil
          ? 'Berlaku hingga ' + util.formatDate(m.validUntil)
          : (s.statusLabel || util.statusLabel(st) || '');
        return '<span class="profil-cta__status-label">Status keanggotaan Anda</span>' +
          '<span class="profil-cta__status-badges">' + util.statusBadge(st) +
            (s.isAdmin ? '<span class="badge badge--metal">Admin</span>' : '') + '</span>' +
          (sub ? '<span class="profil-cta__status-sub">' + h(sub) + '</span>' : '');
      }
      function sync() {
        var s = current();
        box.innerHTML = actionsFor(s);
        if (line) {
          var html = statusFor(s);
          line.innerHTML = html;
          line.hidden = !html;
        }
      }
      sync();
      if (PPAPI.session && typeof PPAPI.session.onChange === 'function') PPAPI.session.onChange(sync);
    })();

    /* ---------- Nomor bab + indeks halaman (dari bagian yang tampil) ---------- */
    (function () {
      var chapters = $$('main [data-chapter]').filter(function (s) { return !s.hidden; });
      var total = chapters.length;
      chapters.forEach(function (s, i) {
        var num = $('[data-num]', s);
        if (num) num.textContent = pad(i + 1) + ' —';
      });
      /* Jalur indeks tampil sejak awal dengan tinggi yang sudah dipesan (profil.css), sehingga
         pengisian tautan di sini tidak menggeser isi halaman; disembunyikan bila < 2 bagian. */
      var nav = $('.profil-index');
      var list = $('[data-profil-index]');
      if (!nav || !list) return;
      if (total < 2) { nav.hidden = true; return; }
      render(list, chapters.map(function (s, i) {
        return '<li><a class="profil-index__link" href="#' + h(s.id) + '">' +
          '<span class="profil-index__num">' + pad(i + 1) + '</span>' +
          '<span class="profil-index__label">' + h(s.getAttribute('data-chapter')) + '</span>' +
        '</a></li>';
      }).join(''));
      nav.hidden = false;
    })();
  });
})();
