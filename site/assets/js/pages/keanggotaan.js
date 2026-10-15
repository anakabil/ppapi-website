/* ==========================================================================
   PPAPI — Keanggotaan (keanggotaan.html)
   Isi dirender dari PPAPI.data.organisasi.keanggotaan dan .faq
   (assets/data/organisasi.js) serta PPAPI.config (apps, appNote, iuran):
   • manfaatUmum → kisi manfaat; kategori → kartu kategori (kategori yang
     dapat diajukan = PPAPI.store.APPLY_TYPES; selebihnya ditetapkan
     pengurus); langkah → alur pendaftaran; fitur anggota → bagian "Akses
     Anggota"; biaya / config.iuran → kartu iuran; faq (kelompok
     'keanggotaan') → akordeon tanya jawab.
   • Mengikuti sesi (PPAPI.session): tombol "Mulai Pendaftaran" mengarah ke
     masuk.html?next=pendaftaran.html#daftar (belum masuk) atau ke
     pendaftaran.html dengan label sesuai status (Lanjutkan / Perbaiki /
     Ajukan Ulang / Ajukan Perpanjangan); Menunggu Verifikasi → "Lihat
     Status Pendaftaran" ke dasbor (sama dengan PPAPI.ui.lockedAction);
     anggota Aktif → dasbor; admin → Konsol Admin. Alur pendaftaran menandai posisi
     pengunjung, dan daftar fitur anggota menunjukkan Terbuka / Terkunci.
   ========================================================================== */
(function () {
  'use strict';

  PPAPI.onReady(function () {
    var util = PPAPI.util, ui = PPAPI.ui, h = util.h, $ = util.$, $$ = util.$$;
    var cfg = PPAPI.config || {};
    var org = (PPAPI.data && PPAPI.data.organisasi) || {};
    var kea = org.keanggotaan || {};
    var bagian = org.bagianContoh || {};
    var FORM = 'pendaftaran.html';
    var SIGNUP = 'masuk.html?next=' + encodeURIComponent(FORM) + '#daftar';

    function arr(v) { return Array.isArray(v) ? v.filter(function (x) { return x !== null && x !== undefined && x !== ''; }) : []; }
    function pad(n) { return util.pad(n, 2); }
    function icon(name, opts) { return PPAPI.icon(PPAPI.icons.indexOf(name) !== -1 ? name : 'check-circle', opts); }
    function byId(id) { return document.getElementById(id); }
    function hide(id) { var s = byId(id); if (s) s.hidden = true; }
    function render(el, html) { if (!el) return; el.innerHTML = html; ui.reveal(el); }
    function session() {
      var s = PPAPI.session && PPAPI.session.current ? PPAPI.session.current() : null;
      return s || { user: null, member: null, isAdmin: false, status: '', statusLabel: '', isActive: false, isMemberActive: false };
    }
    function applyTypes() {
      var list = [];
      try { list = (PPAPI.store && PPAPI.store.APPLY_TYPES) || []; } catch (e) { list = []; }
      if (!list.length) {
        list = arr(kea.kategori).filter(function (k) { return k && k.nama && k.bisaDiajukan !== false; }).map(function (k) { return k.nama; });
      }
      return list.map(function (x) { return String(x).toLowerCase(); });
    }

    /* ---------- Label "Contoh" per bagian ---------- */
    $$('[data-badge-bagian]').forEach(function (el) {
      el.outerHTML = util.contohBadge({ contoh: !!bagian[el.getAttribute('data-badge-bagian')] });
    });

    /* ---------- 01 · Manfaat umum ---------- */
    (function () {
      var items = arr(kea.manfaatUmum).map(function (m) {
        return typeof m === 'string' ? { judul: m, teks: '', ikon: 'check-circle' } : m;
      }).filter(function (m) { return m && m.judul; });
      if (!items.length) { hide('manfaat'); return; }
      var n = items.length;
      render($('[data-manfaat]'), items.map(function (m, i) {
        return '<article class="feature kea-feature">' +
          '<div class="feature__head">' +
            '<span class="index-num">' + pad(i + 1) + ' <span>/ ' + pad(n) + '</span></span>' +
            '<span class="feature__icon">' + icon(m.ikon, { size: 22 }) + '</span>' +
          '</div>' +
          '<h3 class="feature__title">' + h(m.judul) + '</h3>' +
          (m.teks ? '<p class="feature__text">' + h(m.teks) + '</p>' : '') +
        '</article>';
      }).join(''));
    })();

    /* ---------- 02 · Kategori anggota ---------- */
    var catCards = [];   // [{ el, nama }] — "Kategori Anda" marker follows the session
    (function () {
      var cats = arr(kea.kategori).filter(function (k) { return k && k.nama; });
      if (!cats.length) { hide('kategori'); return; }
      var open = applyTypes();
      var n = cats.length;
      var wrap = $('[data-kategori]');
      wrap.classList.add('kea-kategori--' + Math.min(n, 4));

      function list(items, cls, ic) {
        items = arr(items);
        if (!items.length) return '';
        return '<ul class="kea-cat__list ' + cls + '" role="list">' + items.map(function (t) {
          return '<li>' + (ic ? '<span class="kea-cat__tick">' + icon(ic, { size: 16 }) + '</span>' : '<span class="kea-cat__node" aria-hidden="true"></span>') +
            '<span>' + h(t) + '</span></li>';
        }).join('') + '</ul>';
      }

      render(wrap, cats.map(function (k, i) {
        var canApply = k.bisaDiajukan !== false && open.indexOf(String(k.nama).toLowerCase()) !== -1;
        var id = 'kategori-' + util.slugify(k.nama);
        return '<article class="card kea-cat" data-kategori-nama="' + h(k.nama) + '" aria-labelledby="' + h(id) + '">' +
          '<div class="kea-cat__top">' +
            '<span class="index-num">' + pad(i + 1) + ' <span>/ ' + pad(n) + '</span></span>' +
            util.contohBadge(k) +
          '</div>' +
          '<div class="kea-cat__head">' +
            '<h3 class="kea-cat__title" id="' + h(id) + '">' + h(k.nama) + '</h3>' +
            '<span class="kea-cat__mine" data-cat-mine hidden></span>' +
          '</div>' +
          (k.ringkas ? '<p class="kea-cat__lead">' + h(k.ringkas) + '</p>' : '') +
          (arr(k.syarat).length ? '<h4 class="kea-cat__label">Persyaratan</h4>' + list(k.syarat, 'kea-cat__list--syarat', '') : '') +
          (arr(k.manfaat).length ? '<h4 class="kea-cat__label">Manfaat</h4>' + list(k.manfaat, 'kea-cat__list--manfaat', 'check') : '') +
          '<div class="card__footer card__footer--rule kea-cat__foot">' +
            (canApply
              ? '<p class="kea-cat__note">' + icon('file-text', { size: 16 }) + '<span>Dipilih pada formulir</span></p>'
              : '<p class="kea-cat__note">' + icon('award', { size: 16 }) + '<span>Ditetapkan pengurus</span></p>') +
          '</div>' +
        '</article>';
      }).join(''));
      catCards = $$('.kea-cat', wrap).map(function (el) { return { el: el, nama: el.getAttribute('data-kategori-nama') || '' }; });
    })();

    /* ---------- 03 · Alur pendaftaran ---------- */
    var stepEls = [];    // [{ el, key }] — key: akun | formulir | verifikasi | aktif | akses | ''
    (function () {
      var steps = arr(kea.langkah).map(function (s) { return typeof s === 'string' ? { judul: s, teks: '' } : s; })
        .filter(function (s) { return s && s.judul; });
      if (!steps.length) {
        steps = [
          { judul: 'Buat akun', teks: '' }, { judul: 'Isi formulir pendaftaran', teks: '' }, { judul: 'Verifikasi sekretariat', teks: '' },
          { judul: 'Aktif & KTA digital', teks: '' }, { judul: 'Akses fitur anggota', teks: '' }
        ];
      }
      function stepKey(t) {
        t = String(t).toLowerCase();
        if (/akun/.test(t)) return 'akun';
        if (/formulir|pengajuan|isi data|lengkapi/.test(t)) return 'formulir';
        if (/verifikasi|periksa/.test(t)) return 'verifikasi';
        if (/aktif|kta|kartu/.test(t)) return 'aktif';
        if (/fitur|akses|layanan/.test(t)) return 'akses';
        return '';
      }
      var ICONS = { akun: 'user-plus', formulir: 'file-text', verifikasi: 'shield-check', aktif: 'id-card', akses: 'layers' };
      var n = steps.length;
      var ol = $('[data-alur]');
      ol.style.setProperty('--steps', n);
      render(ol, steps.map(function (s, i) {
        var key = stepKey(s.judul);
        return '<li class="kea-step' + (i === n - 1 ? ' kea-step--final' : '') + '" data-step-key="' + h(key) + '" data-reveal data-reveal-delay="' + (i * 110) + '">' +
          '<div class="kea-step__head">' +
            '<span class="kea-step__num">' + pad(i + 1) + '</span>' +
            '<span class="kea-step__icon">' + icon(ICONS[key] || 'check-circle', { size: 20 }) + '</span>' +
          '</div>' +
          '<span class="kea-step__node" aria-hidden="true"></span>' +
          '<div class="kea-step__body">' +
            '<h3 class="kea-step__title"><span class="sr-only">Langkah ' + (i + 1) + ': </span>' + h(s.judul) + '</h3>' +
            (s.teks ? '<p class="kea-step__text">' + h(s.teks) + '</p>' : '') +
            '<p class="kea-step__state" data-step-state hidden></p>' +
          '</div>' +
        '</li>';
      }).join(''));
      stepEls = $$('.kea-step', ol).map(function (el) { return { el: el, key: el.getAttribute('data-step-key') || '' }; });
    })();

    /* ---------- 04 · Akses fitur anggota ---------- */
    /* first clause of a long app description ("… dalam sembilan tahap — data proyek, …" → "… dalam sembilan tahap.") */
    function lead(text) {
      var t = String(text || '').trim();
      var m = /^(.{40,}?)(?:\s+[—–]\s+|:\s+|;\s+)/.exec(t);
      if (m) t = m[1].replace(/[\s,.]+$/, '') + '.';
      return t;
    }
    var FEATURES = (function () {
      var list = [
        { key: 'kta', ikon: 'id-card', judul: 'KTA digital', teks: 'Kartu tanda anggota ber-QR yang dapat ditunjukkan, dicetak, dan diverifikasi publik.', href: 'anggota.html#kartu' },
        { key: 'profil', ikon: 'certificate', judul: 'Profil, kompetensi & sertifikat', teks: 'Catatan kompetensi dan sertifikat beserta pengingat masa berlakunya.', href: 'anggota.html#profil' },
        { key: 'pustaka', ikon: 'book', judul: 'Produk Pengetahuan', teks: 'Standar, Code of Practice, petunjuk teknis, serta modul dan panduan pelatihan PPAPI.', href: 'pustaka.html' }
      ];
      arr(cfg.apps).forEach(function (a) {
        if (!a || !a.title || !a.url) return;
        var href = util.safeNext(String(a.url), '#');
        list.push({ key: 'app-' + (a.key || list.length), ikon: a.ikon || 'compass', judul: a.title, teks: lead(a.desc), href: href === '#' ? '' : href, app: true });
      });
      return list;
    })();
    var aksesList = $('[data-akses-list]');
    var aksesNote = $('[data-akses-note]');
    if (aksesNote && cfg.appNote) { aksesNote.textContent = cfg.appNote; aksesNote.hidden = false; }

    function renderAkses(s) {
      if (!aksesList) return;
      var open = !!s.isActive;
      aksesList.innerHTML = FEATURES.map(function (f, i) {
        var state = open
          ? '<span class="kea-feat__state is-open">' + icon('check', { size: 14 }) + 'Terbuka</span>'
          : '<span class="kea-feat__state">' + icon('lock', { size: 14 }) + 'Terkunci</span>';
        var title = open && f.href
          ? '<a class="kea-feat__link" href="' + h(f.href) + '">' + h(f.judul) + '</a>'
          : h(f.judul);
        return '<li class="kea-feat' + (open ? ' is-open' : '') + (f.app ? ' kea-feat--app' : '') + '">' +
          '<span class="kea-feat__num" aria-hidden="true">' + pad(i + 1) + '</span>' +
          '<span class="kea-feat__icon">' + icon(f.ikon, { size: 20 }) + '</span>' +
          '<div class="kea-feat__body">' +
            '<h3 class="kea-feat__title">' + title + '</h3>' +
            (f.teks ? '<p class="kea-feat__text">' + h(f.teks) + '</p>' : '') +
          '</div>' +
          state +
        '</li>';
      }).join('');
      ui.reveal(aksesList);
    }

    /* ---------- 05 · Iuran ---------- */
    (function () {
      var iuran = cfg.iuran || {};
      var lines = [];
      if (iuran.aktif && String(iuran.nominal || '').trim()) {
        lines.push(String(iuran.nominal).trim());
        if (String(iuran.keterangan || '').trim()) lines.push(String(iuran.keterangan).trim());
        lines.push('Bukti pembayaran dilampirkan pada formulir pendaftaran.');
      } else {
        var biaya = kea.biaya;
        lines = Array.isArray(biaya) ? arr(biaya).map(String) : (String(biaya || '').trim() ? [String(biaya).trim()] : []);
      }
      var body;
      if (lines.length) {
        body = '<p class="kea-biaya__text">' + util.emphasis(lines[0]) + '</p>' +
          lines.slice(1).map(function (l) { return '<p class="kea-biaya__sub">' + util.emphasis(l) + '</p>'; }).join('');
      } else {
        body = '<p class="kea-biaya__text">Informasi iuran dapat diperoleh melalui sekretariat.</p>' +
          '<p class="kea-biaya__sub">Sampaikan pertanyaan Anda melalui halaman Kontak untuk memperoleh rincian iuran keanggotaan yang berlaku.</p>';
      }
      render($('[data-biaya]'),
        '<span class="kea-biaya__icon">' + icon('file-text', { size: 22 }) + '</span>' +
        '<div class="kea-biaya__content">' + body +
          '<a class="btn btn--link" href="umpan-balik.html"><span>Hubungi sekretariat</span>' + icon('arrow-right', { cls: 'btn__icon', size: 18 }) + '</a>' +
        '</div>');
    })();

    /* ---------- 06 · Tanya jawab (akordeon dibuat dinamis agar tertaut otomatis) ----------
       Setiap pertanyaan diawali nomor indeks (01, 02, …) — perlakuan yang sama dengan FAQ di
       halaman Kontak; nomor bersifat dekoratif sehingga disembunyikan dari pembaca layar. */
    (function () {
      var faq = arr(org.faq).filter(function (f) { return f && f.q && f.a && (!f.kelompok || f.kelompok === 'keanggotaan'); });
      if (!faq.length) { hide('faq'); return; }
      render($('[data-faq]'),
        '<div class="accordion" data-accordion="single">' + faq.map(function (f, i) {
          return '<div class="accordion__item">' +
            '<h3><button type="button" class="accordion__trigger" aria-expanded="' + (i === 0 ? 'true' : 'false') + '">' +
              '<span class="kea-faq__q"><span class="kea-faq__num" aria-hidden="true">' + pad(i + 1) + '</span><span>' + h(f.q) + '</span></span>' +
            '</button></h3>' +
            '<div class="accordion__panel"' + (i === 0 ? '' : ' hidden') + '><p>' + util.emphasis(f.a) + '</p></div>' +
          '</div>';
        }).join('') + '</div>');
    })();

    /* ---------- Nomor bab (dari bagian yang tampil) ---------- */
    $$('main [data-chapter]').filter(function (s) { return !s.hidden; }).forEach(function (s, i) {
      var num = $('[data-num]', s);
      if (num) num.textContent = pad(i + 1) + ' —';
    });

    /* ======================================================================
       Session-aware parts: CTA buttons, "Status Anda", progress on the
       timeline, Terbuka/Terkunci on the feature list, "Kategori Anda".
       ====================================================================== */
    function hasDraft(m) {
      var a = (m && m.application) || {};
      return !!(a.kategori || a.updatedAt || (a.pengalaman && a.pengalaman.length) || (a.dokumen && a.dokumen.length));
    }
    /** primary action for the viewer: { href, label, hint }.
        Labels and destinations for the non-active statuses match PPAPI.ui.lockedAction (core.js),
        index.js and the pustaka lock bar, so every surface names the next step the same way;
        Draf alone is split into Mulai / Lanjutkan (same destination) because this page explains the flow. */
    function ctaFor(s) {
      if (!s.user) return { href: SIGNUP, label: 'Mulai Pendaftaran', hint: '' };
      if (s.isMemberActive) return { href: 'dashboard.html', label: 'Buka Dasbor Anggota', hint: '' };
      if (s.isAdmin) return { href: 'admin.html', label: 'Buka Konsol Admin', hint: '' };
      switch (s.status) {
        case 'Menunggu Verifikasi': return { href: 'dashboard.html', label: 'Lihat Status Pendaftaran', hint: 'Pengajuan Anda sedang diverifikasi sekretariat.' };
        case 'Perlu Perbaikan': return { href: FORM, label: 'Perbaiki Pengajuan', hint: 'Sekretariat meminta perbaikan data pengajuan Anda.' };
        case 'Ditolak': return { href: FORM, label: 'Ajukan Ulang', hint: 'Anda dapat memperbaiki data lalu mengajukan kembali.' };
        case 'Kedaluwarsa': return { href: FORM, label: 'Ajukan Perpanjangan', hint: 'Masa berlaku keanggotaan Anda telah berakhir.' };
        case 'Nonaktif': return { href: FORM, label: 'Ajukan Perpanjangan', hint: 'Keanggotaan Anda sedang dinonaktifkan.' };
        default: return hasDraft(s.member)
          ? { href: FORM, label: 'Lanjutkan Pendaftaran', hint: 'Draf formulir Anda tersimpan; lanjutkan lalu ajukan.' }
          : { href: FORM, label: 'Mulai Pendaftaran', hint: 'Akun Anda siap — lanjutkan dengan mengisi formulir pendaftaran.' };
      }
    }

    var ctas = $$('[data-cta-daftar]').map(function (a) { return { el: a, label: a.querySelector('span') }; });
    function syncCtas(s) {
      var c = ctaFor(s);
      ctas.forEach(function (x) {
        if (x.label) x.label.textContent = c.label;
        x.el.setAttribute('href', c.href);
      });
      var note = $('[data-alur-note]');
      if (note) { note.textContent = c.hint; note.hidden = !c.hint; }
    }

    /* "Status Anda" in the Alur section head (signed in) — otherwise the "Masuk" link */
    var aside = $('[data-alur-aside]');
    var asideGuest = aside ? aside.innerHTML : '';
    function validityText(m) {
      if (!m || !m.validUntil) return '';
      var d = util.daysUntil(m.validUntil);
      if (d === null) return '';
      return d < 0 ? 'Berakhir ' + util.formatDate(m.validUntil) : 'Berlaku hingga ' + util.formatDate(m.validUntil);
    }
    function syncAside(s) {
      if (!aside) return;
      if (!s.user) { if (aside.getAttribute('data-mode') !== 'guest') { aside.innerHTML = asideGuest; aside.setAttribute('data-mode', 'guest'); ui.reveal(aside); } return; }
      var st = s.status || 'Draf';
      var sub = s.isMemberActive ? validityText(s.member) : (s.statusLabel || util.statusLabel(st));
      aside.innerHTML =
        '<div class="kea-mystatus" role="status">' +
          '<p class="kea-mystatus__label">Status keanggotaan Anda</p>' +
          '<p class="kea-mystatus__value">' + util.statusBadge(st) + (s.isAdmin ? '<span class="badge badge--metal">Admin</span>' : '') + '</p>' +
          (sub ? '<p class="kea-mystatus__sub">' + h(sub) + '</p>' : '') +
        '</div>';
      aside.setAttribute('data-mode', 'member');
    }

    /* progress on the timeline: done / current (+ a short state line) */
    function progressFor(s) {
      if (!s.user) return null;
      var st = s.status || 'Draf';
      if (st === 'Aktif') return { done: ['akun', 'formulir', 'verifikasi', 'aktif', 'akses'], current: '', text: '' };
      if (st === 'Menunggu Verifikasi') return { done: ['akun', 'formulir'], current: 'verifikasi', text: 'Sedang diverifikasi', tone: 'warn' };
      if (st === 'Perlu Perbaikan') return { done: ['akun'], current: 'formulir', text: 'Perlu perbaikan', tone: 'warn' };
      if (st === 'Ditolak') return { done: ['akun'], current: 'formulir', text: 'Dapat diajukan ulang', tone: 'err' };
      if (st === 'Kedaluwarsa' || st === 'Nonaktif') return { done: ['akun'], current: 'formulir', text: 'Ajukan perpanjangan', tone: 'err' };
      return { done: ['akun'], current: 'formulir', text: hasDraft(s.member) ? 'Lanjutkan pengisian' : 'Langkah Anda berikutnya' };
    }
    function syncSteps(s) {
      var p = progressFor(s);
      var ol = $('[data-alur]');
      if (ol) ol.classList.toggle('kea-alur--tracked', !!p);
      stepEls.forEach(function (x) {
        var done = !!(p && x.key && p.done.indexOf(x.key) !== -1);
        var cur = !!(p && x.key && p.current === x.key);
        x.el.classList.toggle('is-done', done);
        x.el.classList.toggle('is-current', cur);
        x.el.classList.remove('is-warn', 'is-err');
        if (cur && p.tone) x.el.classList.add('is-' + p.tone);
        if (cur) x.el.setAttribute('aria-current', 'step'); else x.el.removeAttribute('aria-current');
        var stEl = $('[data-step-state]', x.el);
        if (stEl) {
          var txt = cur ? p.text : (done && x.key === 'akses' && s.isMemberActive ? 'Telah terbuka untuk Anda' : '');
          stEl.innerHTML = txt ? (cur ? '<span class="sr-only">Posisi Anda: </span>' : '') + h(txt) : '';
          stEl.hidden = !txt;
        }
      });
    }

    /* "Kategori Anda" (active member) / "Pilihan Anda" (application in progress) */
    function syncKategori(s) {
      var m = s.member || null;
      var mine = '', label = '';
      // a KTA was issued (active, expired or suspended) → the category set by the secretariat
      var issued = !!m && (s.isMemberActive || s.status === 'Kedaluwarsa' || s.status === 'Nonaktif');
      if (issued && m.memberType) { mine = m.memberType; label = 'Kategori Anda'; }
      else if (m && m.application && m.application.kategori) { mine = m.application.kategori; label = 'Pilihan Anda'; }
      catCards.forEach(function (c) {
        var on = !!mine && c.nama.toLowerCase() === String(mine).toLowerCase();
        c.el.classList.toggle('kea-cat--mine', on);
        c.el.classList.toggle('card--metal', on);
        var b = $('[data-cat-mine]', c.el);
        if (b) {
          b.hidden = !on;
          b.className = 'kea-cat__mine badge ' + (label === 'Kategori Anda' ? 'badge--metal' : 'badge--outline');
          b.textContent = on ? label : '';
        }
      });
    }

    /* the viewer's own line in "Akses Anggota" */
    var me = $('[data-akses-me]');
    function syncMe(s) {
      if (!me) return;
      var c = ctaFor(s);
      var arrow = icon('arrow-right', { size: 16, cls: 'btn__icon' });
      var html;
      if (!s.user) {
        html = '<p class="kea-akses__me-text">Mulai dengan membuat akun, lalu isi formulir pendaftaran. Sudah memiliki akun? Masuk untuk memantau status keanggotaan Anda.</p>' +
          '<div class="kea-akses__me-actions">' +
            '<a class="btn btn--primary btn--sm" href="' + h(c.href) + '"><span>' + h(c.label) + '</span>' + arrow + '</a>' +
            '<a class="btn btn--ghost btn--sm" href="masuk.html?next=' + encodeURIComponent(FORM) + '"><span>Masuk</span></a>' +
          '</div>';
      } else if (s.isActive) {
        html = '<p class="kea-akses__me-text">' + (s.isMemberActive
          ? 'Keanggotaan Anda <strong>Aktif</strong>' + (s.member && s.member.validUntil ? ' hingga ' + h(util.formatDate(s.member.validUntil)) : '') + '. Seluruh fitur anggota terbuka untuk Anda.'
          : 'Anda masuk sebagai <strong>admin PPAPI</strong>; seluruh fitur anggota terbuka untuk Anda.') + '</p>' +
          '<div class="kea-akses__me-actions"><a class="btn btn--primary btn--sm" href="' + h(c.href) + '"><span>' + h(c.label) + '</span>' + arrow + '</a></div>';
      } else {
        html = '<p class="kea-akses__me-text">Status Anda saat ini: ' + util.statusBadge(s.status || 'Draf') + '<span class="kea-akses__me-sub">' + h(c.hint || s.statusLabel || '') + '</span></p>' +
          '<div class="kea-akses__me-actions"><a class="btn btn--primary btn--sm" href="' + h(c.href) + '"><span>' + h(c.label) + '</span>' + arrow + '</a></div>';
      }
      me.innerHTML = html;
      me.hidden = false;
      ui.reveal(me);
    }

    function syncSession() {
      var s = session();
      syncCtas(s);
      syncAside(s);
      syncSteps(s);
      syncKategori(s);
      renderAkses(s);
      syncMe(s);
    }
    syncSession();
    if (PPAPI.session && typeof PPAPI.session.onChange === 'function') PPAPI.session.onChange(syncSession);
  });
})();
