/* ==========================================================================
   PPAPI — berita.js  (halaman Berita & Kegiatan)
   Dua mode:
   • DAFTAR  (berita.html)          : sorotan utama, pengumuman, filter kategori
                                      + pencarian (tersinkron ke ?kategori=&q=),
                                      kisi berita bertahap ("Muat lebih banyak"),
                                      dan agenda terdekat.
   • DETAIL  (berita.html?id=<id>)  : artikel lengkap, bagikan, berita lainnya,
                                      navigasi sebelumnya/berikutnya.
   Berita, pengumuman, dan agenda dibaca melalui PPAPI.store.content.list()
   (data bawaan + konten kelolaan admin; butir yang disembunyikan admin tidak
   tampil). Seluruh teks data di-escape dengan PPAPI.util.h().
   ========================================================================== */
(function () {
  'use strict';

  /* Tentukan mode sedini mungkin (skrip defer dijalankan sebelum DOMContentLoaded)
     agar hero daftar tidak sempat berkedip saat membuka artikel. */
  var DETAIL_ID = (function () {
    try { return (new URLSearchParams(window.location.search).get('id') || '').trim(); } catch (e) { return ''; }
  })();
  if (DETAIL_ID && document.body) document.body.setAttribute('data-view', 'detail');

  var PAGE_SIZE = 6;
  var KATEGORI_ORDER = ['Kegiatan', 'Pengumuman', 'Edukasi', 'Regulasi', 'Organisasi'];

  /* ==========================================================================
     PEMULIHAN POSISI GULIR (muat ulang / kembali tanpa bfcache) — pola yang
     sama dengan agenda.js. Pemulihan bawaan peramban terjadi sebelum sorotan,
     pengumuman, dan kisi arsip dirender (asinkron), sehingga konten yang
     sedang dilihat lalu terdorong (CLS 0,96–0,97 terukur pada desktop bila
     gerak dikurangi). Posisi disimpan di history.state entri ini setelah
     guliran berhenti; 'manual' hanya dipasang saat pagehide (dibaca peramban
     pada pemuatan berikutnya; replaceState di dalam pagehide justru
     membatalkannya) dan dikembalikan ke 'auto' setelah pemuatan agar
     #jangkar + Kembali tetap ditangani peramban. Posisi dikembalikan setelah
     halaman dirender dan huruf web siap (paling lama 2,5 detik), hanya bila
     pengguna belum menggulir dan alamat tanpa #fragmen.
     ========================================================================== */
  var restoreY = null;
  (function () {
    try {
      var H = window.history;
      if (!('scrollRestoration' in H)) return;
      var st = H.state, y = st && typeof st.beritaY === 'number' ? st.beritaY : 0;
      if (y > 0 && !window.location.hash) restoreY = y;
      var saveTimer = null;
      var save = function () {
        try { H.replaceState(Object.assign({}, H.state, { beritaY: Math.round(window.scrollY || 0) }), ''); } catch (e) { /* abaikan */ }
      };
      window.addEventListener('scroll', function () { clearTimeout(saveTimer); saveTimer = setTimeout(save, 250); }, { passive: true });
      window.addEventListener('pagehide', function () {
        if (!window.location.hash) { try { H.scrollRestoration = 'manual'; } catch (e) { /* abaikan */ } }
      });
      window.addEventListener('pageshow', function (e) { if (e.persisted) autoRestoration(); });
    } catch (e) { restoreY = null; }
  })();
  function autoRestoration() { try { window.history.scrollRestoration = 'auto'; } catch (e) { /* abaikan */ } }
  function finishRestore() {
    var y = restoreY, done = false;
    restoreY = null;
    function release() {
      if (document.readyState === 'complete') autoRestoration();
      else window.addEventListener('load', autoRestoration, { once: true });
    }
    if (y === null) { release(); return; }
    function go() { if ((window.scrollY || 0) < 2) window.scrollTo(0, y); release(); }
    function once() { if (done) return; done = true; window.requestAnimationFrame(function () { window.requestAnimationFrame(go); }); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(once, once); else once();
    setTimeout(once, 2500);
  }

  PPAPI.onReady(async function () {
    var U = PPAPI.util, h = U.h, ui = PPAPI.ui, icon = PPAPI.icon;
    var data = PPAPI.data || {};

    /* ---------- data ----------
       Dibaca melalui PPAPI.store.content.list(): data bawaan (assets/data/*.js) digabung dengan
       konten kelolaan admin (Konsol Admin › Konten); butir bawaan yang disembunyikan admin tidak
       ikut tampil. Bila penyimpanan tidak dapat dibaca, halaman memakai data bawaan. */
    async function load(type) {
      var store = PPAPI.store;
      if (store && store.content && typeof store.content.list === 'function') {
        try { var list = await store.content.list(type); return Array.isArray(list) ? list : []; }
        catch (e) { console.warn('[PPAPI] Konten ' + type + ' memakai data bawaan:', e && e.message); }
      }
      return (Array.isArray(data[type]) ? data[type] : []).filter(function (x) { return x && !x.hidden; });
    }
    var loaded = await Promise.all([load('berita'), load('pengumuman'), load('agenda')]);
    var pengumumanData = loaded[1], agendaData = loaded[2];

    function validItem(b) { return b && typeof b === 'object' && b.id && b.judul; }
    function time(b) { var d = U.parseDate(b.tanggal); return d ? d.getTime() : 0; }
    var berita = loaded[0].filter(validItem).slice()
      .sort(function (a, b) { return time(b) - time(a); });

    /* ---------- helpers ---------- */
    function articleHref(id) { return 'berita.html?id=' + encodeURIComponent(id); }
    function listHref(kategori) { return 'berita.html' + (kategori ? '?kategori=' + encodeURIComponent(kategori) : '') + '#arsip'; }
    function timeHtml(iso, opts) {
      var txt = U.formatDate(iso, opts || { short: true });
      return txt ? '<time datetime="' + h(iso) + '">' + h(txt) + '</time>' : '';
    }
    function words(b) {
      var parts = [b.ringkasan || ''].concat(Array.isArray(b.isi) ? b.isi : [b.isi || '']);
      return parts.join(' ').split(/\s+/).filter(Boolean).length;
    }
    function readMinutes(b) { return Math.max(1, Math.round(words(b) / 200)); }
    function media(b, opts) {
      opts = opts || {};
      if (!b.gambar) return '<span class="berita-media-fallback" aria-hidden="true">' + ui.scaffoldSVG({ cols: 4, rows: 3, cls: 'scaffold-draw--static' }) + '</span>';
      return U.img(b.gambar, { small: !!opts.small, eager: !!opts.eager, sizes: opts.sizes, cls: 'img-mono', alt: opts.alt || '' });
    }
    function norm(s) {
      s = String(s || '').toLowerCase();
      try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* peramban lama */ }
      return s.replace(/[’‘]/g, "'").replace(/[“”]/g, '"');
    }
    function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
    function mark(text, terms) {
      var s = String(text || '');
      if (!terms || !terms.length) return h(s);
      var re;
      try { re = new RegExp('(' + terms.map(escRe).join('|') + ')', 'gi'); } catch (e) { return h(s); }
      return s.split(re).map(function (seg, i) { return i % 2 ? '<mark>' + h(seg) + '</mark>' : h(seg); }).join('');
    }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function categories() {
      var present = {};
      berita.forEach(function (b) { if (b.kategori) present[b.kategori] = (present[b.kategori] || 0) + 1; });
      var ordered = KATEGORI_ORDER.filter(function (k) { return present[k]; });
      Object.keys(present).sort().forEach(function (k) { if (ordered.indexOf(k) === -1) ordered.push(k); });
      return ordered.map(function (k) { return { name: k, count: present[k] }; });
    }
    function newsCard(b, terms) {
      return '<article class="news-card berita-card">' +
        '<div class="news-card__media">' + media(b, { small: true }) + '</div>' +
        '<div class="news-card__meta"><span class="tag">' + h(b.kategori || 'Berita') + '</span>' + timeHtml(b.tanggal) + U.contohBadge(b) + '</div>' +
        '<h3 class="news-card__title"><a href="' + articleHref(b.id) + '">' + mark(b.judul, terms) + '</a></h3>' +
        '<p class="news-card__excerpt">' + mark(b.ringkasan, terms) + '</p>' +
        '<p class="news-card__more berita-card__more" aria-hidden="true"><span>Baca artikel</span>' + icon('arrow-right', { size: 16 }) + '</p>' +
      '</article>';
    }
    function dateBlock(a) {
      var s = U.parseDate(a.mulai), e = U.parseDate(a.selesai) || s;
      if (!s) return '';
      var multi = e && e.getTime() > s.getTime();
      var day = multi ? s.getDate() + '–' + e.getDate() : String(s.getDate());
      var mon = U.MONTHS_SHORT[s.getMonth()] + (multi && e.getMonth() !== s.getMonth() ? ' – ' + U.MONTHS_SHORT[e.getMonth()] : '');
      return '<div class="date-block' + (multi ? ' date-block--range' : '') + '" aria-hidden="true">' +
        '<span class="date-block__day">' + h(day) + '</span><span class="date-block__month">' + h(mon) + '</span>' +
        '<span class="date-block__year">' + s.getFullYear() + '</span></div>';
    }

    if (DETAIL_ID) renderDetail(DETAIL_ID);
    else renderList();
    /* posisi gulir tersimpan dikembalikan setelah konten terisi (lihat atas) */
    finishRestore();

    /* ======================================================================
       MODE DAFTAR
       ====================================================================== */
    function renderList() {
      var detail = U.$('#berita-detail');
      if (detail) detail.parentNode.removeChild(detail);
      document.body.removeAttribute('data-view');

      var cats = categories();
      var featured = berita.filter(function (b) { return b.sorot; })[0] || berita[0] || null;

      /* hero meta (diturunkan dari data) */
      var meta = U.$('#berita-hero-meta');
      if (meta && berita.length) {
        meta.innerHTML =
          '<span>' + icon('file-text', { size: 16 }) + berita.length + ' artikel</span>' +
          '<span>' + icon('layers', { size: 16 }) + cats.length + ' kategori</span>' +
          '<span>' + icon('clock', { size: 16 }) + 'Terbit terakhir ' + h(U.formatDate(berita[0].tanggal)) + '</span>';
      }

      renderFeatured(featured);
      renderNotices();
      renderAgendaBand();
      initArchive(cats, featured);
    }

    /* ---------- sorotan utama ---------- */
    function renderFeatured(b) {
      var wrap = U.$('#berita-featured');
      if (!wrap) return;
      /* Kartu kerangka di HTML sudah memesan ruang; tanpa berita bagian ini
         disembunyikan seluruhnya. */
      if (!b) { if (wrap.parentNode) wrap.parentNode.hidden = true; return; }
      var href = articleHref(b.id);
      /* data-reveal ada pada pembungkus (#berita-featured) sehingga kartu
         kerangka langsung berganti isi tanpa berkedip. Gambar: di bawah 1024px
         kotaknya selebar kontainer (100vw − 2 × 16px pada ponsel) dan sebagian
         tampak di layar pertama → dimuat segera. */
      wrap.innerHTML =
        '<article class="berita-feature is-filled">' +
          '<a class="berita-feature__media" href="' + href + '" tabindex="-1" aria-hidden="true">' +
            media(b, { eager: true, sizes: '(max-width: 1023px) calc(100vw - 32px), 60vw' }) +
            '<span class="berita-feature__stamp">' + icon('star', { size: 14 }) + 'Sorotan</span>' +
          '</a>' +
          '<div class="berita-feature__body">' +
            '<p class="eyebrow berita-feature__eyebrow">Sorotan utama</p>' +
            '<div class="news-card__meta"><span class="tag">' + h(b.kategori || 'Berita') + '</span>' + timeHtml(b.tanggal) + U.contohBadge(b) + '</div>' +
            '<h2 class="berita-feature__title"><a href="' + href + '">' + h(b.judul) + '</a></h2>' +
            '<p class="berita-feature__excerpt">' + h(b.ringkasan) + '</p>' +
            '<div class="berita-feature__foot">' +
              '<p class="berita-feature__byline"><span>Oleh <strong>' + h(b.penulis || 'Redaksi PPAPI') + '</strong></span><span>' + readMinutes(b) + ' menit baca</span></p>' +
              '<a class="btn btn--primary" href="' + href + '"><span>Baca selengkapnya</span>' + icon('arrow-right', { cls: 'btn__icon', size: 18 }) + '</a>' +
            '</div>' +
          '</div>' +
        '</article>';
      ui.reveal(wrap);
    }

    /* ---------- pengumuman ---------- */
    function renderNotices() {
      var list = U.$('#berita-notices'), section = U.$('#pengumuman');
      var items = pengumumanData.filter(function (p) { return p && p.judul; }).slice()
        .sort(function (a, b) {
          if (!!b.penting !== !!a.penting) return b.penting ? 1 : -1;
          return time(b) - time(a);
        });
      if (!list || !section) return;
      /* bagian tampil sejak awal (ruang daftar dipesan lewat CSS); tanpa
         pengumuman, sembunyikan seluruhnya */
      if (!items.length) { section.hidden = true; return; }
      list.innerHTML = items.map(function (p, i) {
        return '<li class="berita-notice' + (p.penting ? ' is-important' : '') + '">' +
          '<div class="berita-notice__top"><span class="berita-notice__index" aria-hidden="true">' + pad2(i + 1) + '</span>' + timeHtml(p.tanggal) + '</div>' +
          '<h3 class="berita-notice__title">' + h(p.judul) + '</h3>' +
          (p.isi ? '<p class="berita-notice__text">' + h(p.isi) + '</p>' : '') +
          ((p.penting || p.contoh) ? '<div class="berita-notice__badges">' + (p.penting ? '<span class="badge badge--metal">Penting</span>' : '') + U.contohBadge(p) + '</div>' : '') +
        '</li>';
      }).join('');
      var latest = items.slice().sort(function (a, b) { return time(b) - time(a); })[0];
      var note = U.$('#berita-notices-note');
      if (note) note.innerHTML = '<span>' + items.length + ' pengumuman</span>' + (latest && latest.tanggal ? '<span>Diperbarui ' + h(U.formatDate(latest.tanggal)) + '</span>' : '');
      ui.reveal(section);
    }

    /* ---------- agenda terdekat ---------- */
    function renderAgendaBand() {
      var box = U.$('#berita-agenda-list');
      if (!box) return;
      var today = U.parseDate(U.todayIso());
      var upcoming = agendaData.filter(function (a) {
        var end = U.parseDate(a && (a.selesai || a.mulai));
        return a && a.judul && end && end >= today;
      }).sort(function (a, b) { return U.parseDate(a.mulai) - U.parseDate(b.mulai); }).slice(0, 3);
      if (!upcoming.length) {
        box.innerHTML = ui.emptyState({ icon: 'calendar', title: 'Belum ada agenda terjadwal', text: 'Agenda kegiatan berikutnya akan diumumkan oleh sekretariat.' });
        ui.reveal(box);
        return;
      }
      box.innerHTML = '<ul class="berita-agenda__items" role="list" data-reveal-stagger>' + upcoming.map(function (a) {
        return '<li><a class="berita-agenda__item" href="agenda.html?id=' + encodeURIComponent(a.id) + '">' +
          dateBlock(a) +
          '<span class="berita-agenda__body">' +
            '<span class="event-row__meta"><span class="tag">' + h(a.jenis || 'Kegiatan') + '</span>' + (a.mode ? '<span class="badge badge--outline">' + h(a.mode) + '</span>' : '') + U.contohBadge(a) + '</span>' +
            '<span class="berita-agenda__title">' + h(a.judul) + '</span>' +
            '<span class="event-row__info">' +
              '<span>' + icon('calendar', { size: 16 }) + h(U.formatDateRange(a.mulai, a.selesai)) + '</span>' +
              (a.lokasi ? '<span>' + icon('map-pin', { size: 16 }) + h(a.lokasi) + '</span>' : '') +
            '</span>' +
          '</span>' +
          '<span class="berita-agenda__go">' + icon('arrow-up-right', { size: 20 }) + '</span>' +
        '</a></li>';
      }).join('') + '</ul>';
      ui.reveal(box);
    }

    /* ---------- arsip: filter + cari + muat lebih banyak ---------- */
    function initArchive(cats, featured) {
      var grid = U.$('#berita-grid'), chipsEl = U.$('#berita-chips'), input = U.$('#berita-q');
      var form = U.$('#berita-search-form'), countEl = U.$('#berita-count'), resetBtn = U.$('#berita-reset');
      var more = U.$('#berita-more'), moreBtn = U.$('#berita-more-btn'), moreText = U.$('#berita-more-text');
      var clearBtn = U.$('.search-box__clear', form);
      if (!grid) return;

      var state = { kategori: '', q: '', shown: PAGE_SIZE };
      var firstRender = true;

      /* status awal dari URL */
      var qk = (U.qs('kategori') || '').trim().toLowerCase();
      cats.forEach(function (c) { if (c.name.toLowerCase() === qk) state.kategori = c.name; });
      state.q = String(U.qs('q') || '').trim().slice(0, 80);
      if (input) input.value = state.q;

      /* chip kategori */
      if (chipsEl) {
        var chip = function (name, label, count) {
          return '<button type="button" class="chip" data-kategori="' + h(name) + '" aria-pressed="false">' + h(label) +
            ' <span class="chip__count"><span class="sr-only">(</span>' + count + '<span class="sr-only"> artikel)</span></span></button>';
        };
        chipsEl.innerHTML = chip('', 'Semua', berita.length) + cats.map(function (c) { return chip(c.name, c.name, c.count); }).join('');
        chipsEl.addEventListener('click', function (e) {
          var b = e.target.closest('.chip');
          if (!b) return;
          state.kategori = b.getAttribute('data-kategori') || '';
          state.shown = PAGE_SIZE;
          apply();
        });
      }

      /* pencarian (debounce) */
      var onSearch = U.debounce(function () {
        var v = (input.value || '').trim().slice(0, 80);
        if (v === state.q) return;
        state.q = v; state.shown = PAGE_SIZE;
        apply();
      }, 260);
      if (input) {
        input.addEventListener('input', function () {
          if (clearBtn) clearBtn.hidden = !input.value;
          onSearch();
        });
        input.addEventListener('keydown', function (e) {
          if (e.key === 'Escape' && input.value) { e.preventDefault(); input.value = ''; if (clearBtn) clearBtn.hidden = true; state.q = ''; state.shown = PAGE_SIZE; apply(); }
        });
        if (clearBtn) clearBtn.hidden = !input.value;
      }
      if (form) form.addEventListener('submit', function (e) {
        e.preventDefault();
        state.q = (input.value || '').trim().slice(0, 80); state.shown = PAGE_SIZE;
        apply();
      });

      function reset() {
        state.kategori = ''; state.q = ''; state.shown = PAGE_SIZE;
        if (input) input.value = '';
        if (clearBtn) clearBtn.hidden = true;
        apply();
      }
      if (resetBtn) resetBtn.addEventListener('click', function () { reset(); if (input) input.focus(); });
      grid.addEventListener('click', function (e) {
        if (e.target.closest('[data-berita-reset]')) { reset(); if (input) input.focus(); }
      });

      if (moreBtn) moreBtn.addEventListener('click', function () {
        var before = state.shown;
        state.shown += PAGE_SIZE;
        apply({ append: before });
      });

      function terms() { return norm(state.q).split(/\s+/).filter(Boolean); }
      function filtered() {
        var t = terms(), active = !!(state.kategori || t.length);
        return berita.filter(function (b) {
          if (!active && featured && b === featured) return false;   /* sudah tampil sebagai sorotan */
          if (state.kategori && b.kategori !== state.kategori) return false;
          if (!t.length) return true;
          var hay = norm(b.judul + ' ' + (b.ringkasan || ''));
          return t.every(function (w) { return hay.indexOf(w) !== -1; });
        });
      }

      function syncUrl() {
        try {
          var p = new URLSearchParams(window.location.search);
          p.delete('id');
          if (state.kategori) p.set('kategori', state.kategori); else p.delete('kategori');
          if (state.q) p.set('q', state.q); else p.delete('q');
          var s = p.toString();
          window.history.replaceState(window.history.state, '', window.location.pathname + (s ? '?' + s : '') + window.location.hash);
        } catch (e) { /* abaikan */ }
      }

      function apply(opts) {
        opts = opts || {};
        var list = filtered();
        var rawTerms = state.q.split(/\s+/).filter(Boolean);
        var active = !!(state.kategori || state.q);
        var shown = Math.min(state.shown, list.length);

        /* chip */
        if (chipsEl) U.$$('.chip', chipsEl).forEach(function (c) {
          c.setAttribute('aria-pressed', (c.getAttribute('data-kategori') || '') === state.kategori ? 'true' : 'false');
        });

        /* kisi */
        if (!list.length) {
          grid.classList.add('is-empty');
          grid.innerHTML = '<div class="berita-grid__empty">' + ui.emptyState({
            icon: 'search',
            title: 'Tidak ada berita yang cocok',
            text: state.q
              ? 'Tidak ada judul atau ringkasan yang memuat kata kunci tersebut' + (state.kategori ? ' dalam kategori ' + state.kategori : '') + '. Coba kata kunci lain atau hapus filter.'
              : 'Belum ada berita dalam kategori ini. Pilih kategori lain untuk melihat arsip.',
            actionHtml: '<button type="button" class="btn btn--ghost btn--sm" data-berita-reset><span>Hapus filter</span></button>'
          }) + '</div>';
        } else if (opts.append !== undefined && !grid.classList.contains('is-empty')) {
          var html = list.slice(opts.append, shown).map(function (b, i) { return newsCard(b, rawTerms).replace('<article class="news-card berita-card"', '<article class="news-card berita-card is-new" style="--i:' + i + '"'); }).join('');
          grid.insertAdjacentHTML('beforeend', html);
          var firstNew = U.$$('.berita-card', grid)[opts.append];
          var link = firstNew && U.$('.news-card__title a', firstNew);
          if (link) { try { link.focus({ preventScroll: true }); } catch (e) { link.focus(); } }
        } else {
          grid.classList.remove('is-empty');
          grid.innerHTML = list.slice(0, shown).map(function (b, i) {
            var card = newsCard(b, rawTerms);
            return firstRender ? card : card.replace('<article class="news-card berita-card"', '<article class="news-card berita-card is-new" style="--i:' + i + '"');
          }).join('');
        }
        firstRender = false;

        /* status */
        if (countEl) {
          var where = state.kategori ? ' dalam kategori ' + state.kategori : '';
          var forq = state.q ? ' untuk “' + state.q + '”' : '';
          if (!list.length) countEl.textContent = 'Tidak ada hasil' + forq + where + '.';
          else if (!active) countEl.textContent = list.length + ' artikel dalam arsip, di luar sorotan utama.';
          else countEl.textContent = list.length + ' artikel ditemukan' + forq + where + '.';
        }
        if (resetBtn) resetBtn.hidden = !active;
        if (more) {
          more.hidden = !list.length || shown >= list.length;
          if (moreText) moreText.textContent = 'Menampilkan ' + shown + ' dari ' + list.length + ' artikel';
        }

        syncUrl();
        ui.reveal(grid);
      }

      apply();

      /* tautan dengan filter (mis. dari halaman Agenda) → langsung ke arsip.
         Digulir setelah huruf web siap (paling lama 1 detik) + dua bingkai: bila
         digulir lebih awal, pelipatan ulang teks saat huruf web tiba menggeser
         arsip yang sedang dilihat (CLS ≈ 0,02 terukur pada desktop). Tidak
         menggulir bila pengguna (atau pemulihan posisi peramban) sudah menggulir,
         atau bila posisi tersimpan akan dipulihkan (muat ulang/kembali). */
      if ((state.kategori || state.q) && !window.location.hash && restoreY === null) {
        var sec = U.$('#arsip');
        if (sec) {
          var done = false;
          var go = function () {
            if (done) return;
            done = true;
            window.requestAnimationFrame(function () {
              window.requestAnimationFrame(function () { if ((window.scrollY || 0) < 2) sec.scrollIntoView({ block: 'start' }); });
            });
          };
          if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go); else go();
          setTimeout(go, 1000);
        }
      }
    }

    /* ======================================================================
       MODE DETAIL
       ====================================================================== */
    /* Isi artikel: daftar string. '## ' subjudul, '### ' sub-subjudul, '- ' butir daftar,
       lainnya paragraf. Penekanan sebaris *teks* → <em> (judul karya pada sitasi APA) diterapkan
       SETELAH teks di-escape, sehingga tidak membuka celah HTML. Paragraf setelah subjudul
       "Daftar Pustaka" dirender sebagai entri rujukan (indentasi gantung, berita.css). */
    function inline(t) { return h(t).replace(/\*([^*\n]{1,300}?)\*/g, '<em>$1</em>'); }
    function renderIsi(isi) {
      var out = [], list = null, refs = false;
      function flush() { if (list) { out.push('<ul>' + list.map(function (li) { return '<li>' + inline(li) + '</li>'; }).join('') + '</ul>'); list = null; } }
      (Array.isArray(isi) ? isi : [isi]).forEach(function (raw) {
        var t = String(raw === null || raw === undefined ? '' : raw).trim();
        if (!t) return;
        if (/^-\s+/.test(t)) { (list = list || []).push(t.replace(/^-\s+/, '')); return; }
        flush();
        if (/^###\s+/.test(t)) out.push('<h3>' + h(t.replace(/^###\s+/, '')) + '</h3>');
        else if (/^##\s+/.test(t)) {
          var title = t.replace(/^##\s+/, '');
          refs = /^daftar pustaka$/i.test(title.trim());
          out.push('<h2' + (refs ? ' class="berita-refs__title"' : '') + '>' + h(title) + '</h2>');
        }
        else out.push('<p' + (refs ? ' class="berita-ref"' : '') + '>' + inline(t) + '</p>');
      });
      flush();
      return out.join('');
    }

    function setMeta(title, desc, article) {
      document.title = title + ' — PPAPI';
      var set = function (sel, val) { var m = document.querySelector(sel); if (m) m.setAttribute('content', val); };
      set('meta[property="og:title"]', title + ' — PPAPI');
      if (desc) { set('meta[name="description"]', desc); set('meta[property="og:description"]', desc); }
      if (!article) return;
      /* tampilan artikel: og:type article, gambar artikel, tanggal terbit & rubrik */
      var prop = function (name, val) {
        if (!val) return;
        var m = document.head.querySelector('meta[property="' + name + '"]');
        if (!m) { m = document.createElement('meta'); m.setAttribute('property', name); document.head.appendChild(m); }
        m.setAttribute('content', val);
      };
      prop('og:type', 'article');
      if (article.gambar) prop('og:image', U.siteUrl(article.gambar));
      if (U.parseDate(article.tanggal)) prop('article:published_time', String(article.tanggal));
      if (article.kategori) prop('article:section', String(article.kategori));
    }

    function shareHtml(b) {
      var url = U.siteUrl(articleHref(b.id));
      var wa = 'https://wa.me/?text=' + encodeURIComponent(b.judul + ' — ' + url);
      var li = 'https://www.linkedin.com/sharing/share-offsite/?url=' + encodeURIComponent(url);
      return '<section class="berita-share" aria-labelledby="berita-share-title">' +
        '<h2 class="berita-aside__title" id="berita-share-title">Bagikan artikel</h2>' +
        '<ul class="berita-share__list" role="list">' +
          '<li><button type="button" class="berita-share__item" data-share-copy="' + h(url) + '">' + icon('link', { size: 18 }) + '<span class="berita-share__label">Salin tautan</span>' + icon('copy', { size: 16, cls: 'berita-share__end' }) + '</button></li>' +
          '<li><a class="berita-share__item" href="' + h(wa) + '" target="_blank" rel="noopener">' + icon('whatsapp', { size: 18 }) + '<span class="berita-share__label">WhatsApp</span>' + icon('arrow-up-right', { size: 16, cls: 'berita-share__end' }) + '<span class="sr-only"> (membuka tab baru)</span></a></li>' +
          '<li><a class="berita-share__item" href="' + h(li) + '" target="_blank" rel="noopener">' + icon('linkedin', { size: 18 }) + '<span class="berita-share__label">LinkedIn</span>' + icon('arrow-up-right', { size: 16, cls: 'berita-share__end' }) + '<span class="sr-only"> (membuka tab baru)</span></a></li>' +
          (navigator.share ? '<li><button type="button" class="berita-share__item" data-share-native>' + icon('share', { size: 18 }) + '<span class="berita-share__label">Bagikan lewat perangkat</span>' + icon('arrow-up-right', { size: 16, cls: 'berita-share__end' }) + '</button></li>' : '') +
        '</ul></section>';
    }

    function related(b) {
      var same = berita.filter(function (x) { return x !== b && x.kategori === b.kategori; });
      var rest = berita.filter(function (x) { return x !== b && same.indexOf(x) === -1; });
      return same.concat(rest).slice(0, 3);
    }

    function rowCard(x) {
      return '<article class="news-card news-card--row berita-related__item">' +
        '<div class="news-card__media">' + media(x, { small: true }) + '</div>' +
        '<div class="berita-related__text">' +
          '<div class="news-card__meta"><span class="tag">' + h(x.kategori || 'Berita') + '</span>' + timeHtml(x.tanggal) + '</div>' +
          '<h3 class="news-card__title"><a href="' + articleHref(x.id) + '">' + h(x.judul) + '</a></h3>' +
          U.contohBadge(x) +
        '</div>' +
      '</article>';
    }

    function pagerLink(x, dir) {
      if (!x) {
        return '<a class="berita-pager__link berita-pager__link--' + dir + ' is-index" href="' + listHref('') + '">' +
          '<span class="berita-pager__dir">' + (dir === 'prev' ? icon('arrow-left', { size: 16 }) + 'Arsip' : 'Arsip' + icon('arrow-right', { size: 16 })) + '</span>' +
          '<span class="berita-pager__title">' + (dir === 'prev' ? 'Ini adalah berita paling awal dalam arsip.' : 'Ini adalah berita terbaru.') + '</span>' +
          '<span class="berita-pager__date">Kembali ke daftar berita</span></a>';
      }
      return '<a class="berita-pager__link berita-pager__link--' + dir + '" href="' + articleHref(x.id) + '" rel="' + (dir === 'prev' ? 'prev' : 'next') + '">' +
        '<span class="berita-pager__dir">' + (dir === 'prev' ? icon('arrow-left', { size: 16 }) + 'Berita sebelumnya' : 'Berita berikutnya' + icon('arrow-right', { size: 16 })) + '</span>' +
        '<span class="berita-pager__title">' + h(x.judul) + '</span>' +
        '<span class="berita-pager__meta"><span class="berita-pager__date">' + h(x.kategori || 'Berita') + ' · ' + h(U.formatDate(x.tanggal)) + '</span>' + U.contohBadge(x) + '</span></a>';
    }

    function renderDetail(id) {
      var list = U.$('#berita-list'), root = U.$('#berita-detail');
      if (list) list.parentNode.removeChild(list);
      if (!root) return;
      var idx = -1;
      berita.forEach(function (x, i) { if (idx === -1 && String(x.id) === id) idx = i; });
      root.hidden = false;
      if (idx === -1) { renderNotFound(root); return; }

      var b = berita[idx];
      var newer = idx > 0 ? berita[idx - 1] : null;
      var older = idx < berita.length - 1 ? berita[idx + 1] : null;
      setMeta(b.judul, b.ringkasan, b);

      root.innerHTML =
        '<article class="berita-article" aria-labelledby="berita-article-title">' +
          '<header class="page-hero berita-article__hero">' +
            '<div data-scaffold data-cols="8" data-rows="3"></div>' +
            '<div class="container page-hero__inner">' +
              '<nav class="breadcrumb" aria-label="Breadcrumb"><ol>' +
                '<li><a href="index.html">Beranda</a></li><li><a href="berita.html">Berita</a></li>' +
                '<li aria-current="page"><span>' + h(b.judul) + '</span></li>' +
              '</ol></nav>' +
              '<div class="berita-article__meta">' +
                '<a class="tag tag--boxed berita-article__cat" href="' + listHref(b.kategori) + '">' + h(b.kategori || 'Berita') + '</a>' +
                timeHtml(b.tanggal, { weekday: true }) + U.contohBadge(b) +
              '</div>' +
              '<h1 class="berita-article__title split-lines" id="berita-article-title">' + h(b.judul) + '</h1>' +
              '<div class="berita-article__byline">' +
                '<span class="avatar avatar--md" aria-hidden="true">' + h(U.initials(b.penulis || 'Redaksi PPAPI')) + '</span>' +
                '<span class="berita-article__by"><span class="berita-article__by-label">Ditulis oleh</span><span class="berita-article__author">' + h(b.penulis || 'Redaksi PPAPI') + '</span></span>' +
                '<span class="berita-article__read">' + icon('clock', { size: 16 }) + readMinutes(b) + ' menit baca</span>' +
              '</div>' +
            '</div>' +
          '</header>' +

          '<div class="container berita-article__figure-wrap">' +
            '<figure class="berita-article__figure">' + media(b, { eager: true, sizes: '(max-width: 1240px) 100vw, 1160px', alt: b.judul }) + '</figure>' +
          '</div>' +

          '<div class="container berita-article__layout">' +
            '<div class="berita-article__main">' +
              (b.ringkasan ? '<p class="berita-article__standfirst">' + h(b.ringkasan) + '</p>' : '') +
              '<div class="prose berita-article__prose">' + renderIsi(b.isi) + '</div>' +
              (b.contoh ? '<div class="alert alert--info berita-article__note" role="note">' + icon('info', { size: 18 }) + '<div><p class="alert__title">Konten contoh</p><p>Artikel ini disiapkan untuk memperlihatkan tampilan situs. Sekretariat akan menggantinya dengan berita resmi.</p></div></div>' : '') +
              '<footer class="berita-article__foot">' +
                '<dl class="berita-article__facts">' +
                  '<div><dt>Kategori</dt><dd><a class="link" href="' + listHref(b.kategori) + '">' + h(b.kategori || 'Berita') + '</a></dd></div>' +
                  '<div><dt>Diterbitkan</dt><dd>' + timeHtml(b.tanggal, {}) + '</dd></div>' +
                  '<div><dt>Penulis</dt><dd>' + h(b.penulis || 'Redaksi PPAPI') + '</dd></div>' +
                '</dl>' +
                '<a class="btn btn--link" href="' + listHref('') + '">' + icon('arrow-left', { cls: 'btn__icon', size: 18 }) + '<span>Kembali ke daftar berita</span></a>' +
              '</footer>' +
            '</div>' +
            '<aside class="berita-article__aside" aria-label="Bagikan dan berita lainnya">' +
              '<div class="berita-article__aside-inner">' +
                shareHtml(b) +
                '<section class="berita-related" aria-labelledby="berita-related-title">' +
                  '<h2 class="berita-aside__title" id="berita-related-title">Berita lainnya</h2>' +
                  '<div class="berita-related__list">' + related(b).map(rowCard).join('') + '</div>' +
                '</section>' +
              '</div>' +
            '</aside>' +
          '</div>' +
        '</article>' +

        '<nav class="section section--tight section--rule berita-pager" aria-label="Berita sebelumnya dan berikutnya">' +
          '<div class="container berita-pager__grid">' + pagerLink(older, 'prev') + pagerLink(newer, 'next') + '</div>' +
        '</nav>';

      /* interaksi bagikan */
      root.addEventListener('click', function (e) {
        var cp = e.target.closest('[data-share-copy]');
        if (cp) {
          e.preventDefault();
          U.copyText(cp.getAttribute('data-share-copy')).then(function (ok) {
            ui.toast(ok ? 'Tautan artikel berhasil disalin.' : 'Gagal menyalin. Salin alamat dari bilah peramban.', { type: ok ? 'success' : 'error' });
            if (!ok) return;
            var label = U.$('.berita-share__label', cp);
            cp.classList.add('is-done');
            if (label) label.textContent = 'Tautan tersalin';
            clearTimeout(cp.__t);
            cp.__t = setTimeout(function () { cp.classList.remove('is-done'); if (label) label.textContent = 'Salin tautan'; }, 2400);
          });
          return;
        }
        if (e.target.closest('[data-share-native]')) {
          e.preventDefault();
          try {
            navigator.share({ title: b.judul, text: b.ringkasan || b.judul, url: U.siteUrl(articleHref(b.id)) }).catch(function () { /* dibatalkan */ });
          } catch (err) { /* tidak didukung */ }
        }
      });

      ui.reveal(root);
    }

    function renderNotFound(root) {
      setMeta('Berita tidak ditemukan', 'Berita yang Anda cari tidak ditemukan. Telusuri arsip berita dan kegiatan PPAPI.');
      var robots = document.createElement('meta');
      robots.name = 'robots'; robots.content = 'noindex';
      document.head.appendChild(robots);
      var latest = berita.slice(0, 3);
      root.innerHTML =
        '<section class="page-hero berita-article__hero berita-nf__hero" aria-labelledby="berita-nf-title">' +
          '<div data-scaffold data-cols="8" data-rows="3"></div>' +
          '<div class="container page-hero__inner">' +
            '<nav class="breadcrumb" aria-label="Breadcrumb"><ol><li><a href="index.html">Beranda</a></li><li><a href="berita.html">Berita</a></li><li aria-current="page"><span>Tidak ditemukan</span></li></ol></nav>' +
            '<p class="eyebrow">Berita · Tautan tidak dikenal</p>' +
            '<h1 class="berita-article__title" id="berita-nf-title">Berita tidak <em>ditemukan</em>.</h1>' +
            '<p class="lead">Tautan yang Anda buka mungkin keliru, atau berita tersebut telah dipindahkan oleh sekretariat.</p>' +
            '<div class="page-hero__actions"><a class="btn btn--primary" href="berita.html"><span>Kembali ke Berita</span>' + icon('arrow-right', { cls: 'btn__icon', size: 18 }) + '</a>' +
            '<a class="btn btn--ghost" href="index.html"><span>Ke Beranda</span></a></div>' +
          '</div>' +
        '</section>' +
        (latest.length ?
          '<section class="section berita-nf" aria-labelledby="berita-nf-latest">' +
            '<div class="container">' +
              '<header class="section-head"><div class="section-head__text" data-reveal><p class="eyebrow">Mungkin Anda mencari</p><h2 class="h2" id="berita-nf-latest">Berita <em>terbaru</em></h2></div>' +
              '<a class="btn btn--link" href="berita.html#arsip"><span>Semua berita</span>' + icon('arrow-right', { cls: 'btn__icon', size: 18 }) + '</a></header>' +
              '<div class="grid grid--3" data-reveal-stagger>' + latest.map(function (x) { return newsCard(x, []); }).join('') + '</div>' +
            '</div>' +
          '</section>' : '');
      ui.reveal(root);
    }
  });
})();
