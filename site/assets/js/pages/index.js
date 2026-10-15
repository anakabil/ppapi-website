/* ==========================================================================
   PPAPI — Beranda (index.html)
   Merender bagian berbasis data: Tentang + angka, Pilar Layanan, Produk
   Pengetahuan, Aplikasi Anggota, Kabar Terkini (berita + agenda), Regulasi
   Kunci, dan pita "Mulai Pendaftaran".
   • Berita, agenda, regulasi, dan produk pengetahuan dibaca melalui
     PPAPI.store.content.list() sehingga konten kelolaan admin ikut tampil dan
     butir bawaan yang disembunyikan admin tidak tampil.
   • Tombol aplikasi, ajakan bergabung, dan alur pendaftaran mengikuti status
     keanggotaan (PPAPI.session): Aktif/admin → buka aplikasi; sudah masuk
     tetapi belum Aktif → langkah pendaftaran berikutnya; belum masuk → Masuk.
   Semua teks data di-escape dengan PPAPI.util.h().
   ========================================================================== */
(function () {
  'use strict';

  PPAPI.onReady(async function () {
    var P = PPAPI;
    var u = P.util;
    var h = u.h;
    var icon = P.icon;
    var cfg = P.config || {};
    var D = P.data || {};
    var org = D.organisasi || {};

    var JOIN_HREF = 'masuk.html?next=pendaftaran.html#daftar';
    /* Langkah berikutnya bagi akun yang belum Aktif (selaras dengan PPAPI.ui.lockedAction). */
    var NEXT_STEP = {
      'Draf': ['pendaftaran.html', 'Lengkapi Pendaftaran'],
      'Perlu Perbaikan': ['pendaftaran.html', 'Perbaiki Pengajuan'],
      'Ditolak': ['pendaftaran.html', 'Ajukan Ulang'],
      'Kedaluwarsa': ['pendaftaran.html', 'Ajukan Perpanjangan'],
      'Nonaktif': ['pendaftaran.html', 'Ajukan Perpanjangan'],
      'Menunggu Verifikasi': ['dashboard.html', 'Lihat Status Pendaftaran']
    };

    function byId(id) { return document.getElementById(id); }
    function arr(v) { return Array.isArray(v) ? v : []; }
    function own(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
    function pad(n) { return u.pad(n, 2); }
    function arrow(name) { return icon(name || 'arrow-right', { size: 18, cls: 'btn__icon' }); }
    /* Escaped prose from the data files: a spaced dash (" — ") stays with the word before it,
       so no line of a paragraph starts with a dash. */
    function prose(t) { return h(String(t == null ? '' : t).replace(/ ([—–]) /g, ' $1 ')); }

    function session() {
      var s = P.session && typeof P.session.current === 'function' ? P.session.current() : null;
      if (!s) { var user = P.auth && P.auth.current ? P.auth.current() : null; s = { user: user, status: user ? 'Draf' : '', isActive: false, isMemberActive: false, isAdmin: false }; }
      return s;
    }
    function nextStep(s) { return own(NEXT_STEP, s.status) ? NEXT_STEP[s.status] : NEXT_STEP['Draf']; }

    /* ---------------- konten (statis + kelolaan admin) ---------------- */
    async function load(type) {
      var store = P.store;
      if (store && store.content && typeof store.content.list === 'function') {
        try { return arr(await store.content.list(type)); }
        catch (e) { console.warn('[PPAPI] Konten ' + type + ' memakai data bawaan:', e && e.message); }
      }
      return arr(D[type]).filter(function (x) { return x && !x.hidden; });
    }

    /* ---------------- 3. Tentang + angka ---------------- */
    function renderTentang() {
      var body = byId('tentang-body');
      var paras = arr(org.tentang).slice(0, 2);
      if (body) {
        body.innerHTML = paras.map(function (p, i) {
          return '<p class="' + (i === 0 ? 'lead home-about__lead' : 'home-about__para') + '">' + prose(p) + '</p>';
        }).join('');
        if (!paras.length) body.hidden = true;
      }

      var wrap = byId('home-stats');
      var grid = byId('home-stats-grid');
      var stats = arr(org.stats).filter(function (s) { return s && isFinite(parseFloat(s.angka)); });
      if (!wrap || !grid) return;
      if (!stats.length) { wrap.hidden = true; return; }
      grid.innerHTML = stats.map(function (s) {
        var n = String(s.angka);
        var suffix = s.akhiran || '';
        return '<div class="stat home-stat">' +
          '<span class="stat__num" data-count="' + h(n) + '"' + (suffix ? ' data-count-suffix="' + h(suffix) + '"' : '') + '>' +
            h(u.formatNumber(parseFloat(n), (n.split('.')[1] || '').length) + suffix) +
          '</span>' +
          '<span class="stat__label">' + h(s.label) + '</span>' +
          (s.contoh ? '<span class="home-stat__badge">' + u.contohBadge(s) + '</span>' : '') +
        '</div>';
      }).join('');
      wrap.hidden = false;
    }

    /* ---------------- 4. Pilar layanan ---------------- */
    function renderPilar() {
      var grid = byId('pilar-grid');
      var items = arr(org.layanan);
      if (!grid) return;
      if (!items.length) { var sec = byId('layanan'); if (sec) sec.hidden = true; return; }
      var total = pad(items.length);
      grid.innerHTML = items.map(function (it, i) {
        var ic = P.icons.indexOf(it.ikon) > -1 ? it.ikon : 'compass';
        return '<article class="feature home-pilar__item">' +
          '<div class="feature__head">' +
            '<span class="index-num">' + pad(i + 1) + ' <span>/ ' + total + '</span></span>' +
            '<span class="feature__icon">' + icon(ic, { size: 22 }) + '</span>' +
          '</div>' +
          '<h3 class="feature__title">' + h(it.judul) + u.contohBadge(it) + '</h3>' +
          '<p class="feature__text">' + prose(it.teks) + '</p>' +
        '</article>';
      }).join('');
    }

    /* ---------------- 5. Produk pengetahuan ---------------- */
    /* Pengelompokan sama dengan pustaka.html: SNI dan standar internasional dari pustaka regulasi
       masuk koleksi "Standar"; regulasi lainnya menjadi "Peraturan Perundangan". */
    var PK = [
      { kat: 'Standar', ikon: 'award', desc: 'Standar PPAPI, SNI, dan standar internasional acuan teknis.', reg: 'std' },
      { kat: 'Code of Practice', ikon: 'shield-check', desc: 'Pedoman praktik baik pemasangan, penggunaan, dan inspeksi perancah.' },
      { kat: 'Peraturan Perundangan', ikon: 'scale', desc: 'Undang-undang, peraturan pemerintah, dan regulasi kementerian terkait.', reg: 'only' },
      { kat: 'Petunjuk Teknis', ikon: 'wrench', desc: 'Petunjuk penerapan perancah pada kondisi kerja tertentu.' },
      { kat: 'Modul Pelatihan', label: 'Modul & Panduan Pelatihan', ikon: 'book', desc: 'Materi pelatihan teknisi dan inspektur, serta panduan aplikasi.' },
      { kat: 'Formulir & Daftar Periksa', ikon: 'file-text', desc: 'Formulir dan daftar periksa untuk inspeksi perancah di lapangan.' },
      { kat: 'Kajian Teknis', ikon: 'compass', desc: 'Kajian dan catatan teknis sebagai bahan diskusi anggota.' },
      { kat: 'Aplikasi', label: 'Aplikasi Anggota', ikon: 'grid', desc: 'Perencanaan & analisis struktur, serta simulator pemasangan.', app: true }
    ];
    function isStdReg(r) { return r && (r.jenis === 'SNI' || r.jenis === 'Standar Internasional'); }
    function pkCount(t, items) {
      var n = items.length;
      if (!n) return 'Segera tersedia';
      var num = u.formatNumber(n);
      if (t.reg === 'only') return num + ' regulasi';
      if (t.app) return num + ' aplikasi';
      var draft = items.every(function (x) { return x.status === 'Dalam Penyusunan' || x.status === 'Draf'; });
      return num + (draft ? ' rancangan' : ' dokumen');
    }
    function pkHref(t) {
      return t.app ? 'pustaka.html#aplikasi' : 'pustaka.html?kategori=' + encodeURIComponent(u.slugify(t.kat)) + '#katalog';
    }
    function renderPustaka(pustaka, regulasi) {
      var grid = byId('pk-grid');
      if (!grid) return;
      var groups = {};
      pustaka.forEach(function (x) { if (x && x.kategori) (groups[x.kategori] = groups[x.kategori] || []).push(x); });
      var regStd = regulasi.filter(isStdReg), regOther = regulasi.filter(function (r) { return r && !isStdReg(r); });
      var total = pad(PK.length);
      grid.innerHTML = PK.map(function (t, i) {
        var items = t.reg === 'only' ? regOther : (groups[t.kat] || []).concat(t.reg === 'std' ? regStd : []);
        var allContoh = items.length && items.every(function (x) { return x && x.contoh; });
        var href = pkHref(t);
        /* lencana Contoh: di baris kepala (≥ 560px) atau di baris jumlah (ponsel) — satu yang tampil */
        var badge = function (where) { return allContoh ? '<span class="home-pk__badge home-pk__badge--' + where + '">' + u.contohBadge({ contoh: true }) + '</span>' : ''; };
        return '<li class="home-pk__item">' +
          '<article class="home-pk__tile' + (t.app ? ' home-pk__tile--dark theme-dark' : '') + (items.length ? '' : ' is-empty') + '" data-kategori="' + h(t.kat) + '">' +
            '<div class="home-pk__head">' +
              '<span class="index-num">' + pad(i + 1) + ' <span>/ ' + total + '</span></span>' +
              badge('head') +
              '<span class="home-pk__icon">' + icon(t.ikon, { size: 20 }) + '</span>' +
            '</div>' +
            '<h3 class="home-pk__name"><a href="' + h(href) + '">' + h(t.label || t.kat) + '</a></h3>' +
            '<p class="home-pk__desc">' + h(t.desc) + '</p>' +
            '<p class="home-pk__meta">' +
              '<span class="home-pk__count">' + h(pkCount(t, items)) + '</span>' +
              badge('meta') +
              '<span class="home-pk__go" aria-hidden="true">' + icon('arrow-right', { size: 18 }) + '</span>' +
            '</p>' +
          '</article>' +
        '</li>';
      }).join('');
    }
    function renderPustakaAccess(s) {
      var note = byId('pk-access');
      var actions = byId('pk-actions');
      var publik = !(cfg.pustaka && cfg.pustaka.katalogPublik === false);
      if (note) {
        var text, ic;
        if (s.isActive) {
          ic = 'check-circle';
          text = (s.isMemberActive ? 'Keanggotaan Anda Aktif' : 'Anda masuk sebagai admin') + ' — seluruh dokumen dan aplikasi anggota dapat dibuka.';
        } else {
          ic = 'lock';
          text = publik
            ? 'Katalog terbuka untuk umum. Isi dokumen dan aplikasi khusus anggota berstatus Aktif.'
            : 'Katalog dan isi dokumen khusus anggota berstatus Aktif.';
        }
        note.className = 'home-pk__access' + (s.isActive ? ' is-open' : '');
        note.innerHTML = '<span class="home-pk__access-icon">' + icon(ic, { size: 18 }) + '</span><span>' + h(text) + '</span>';
      }
      if (actions) {
        var html = '<a class="btn btn--primary" href="pustaka.html"><span>' + (s.isActive || publik ? 'Jelajahi Produk Pengetahuan' : 'Lihat Produk Pengetahuan') + '</span>' + arrow() + '</a>';
        if (!s.isActive) {
          if (s.user) { var st = nextStep(s); html += '<a class="btn btn--ghost" href="' + h(st[0]) + '" data-pk-step><span>' + h(st[1]) + '</span></a>'; }
          else html += '<a class="btn btn--ghost" href="' + h(JOIN_HREF) + '" data-pk-join><span>Daftar Anggota</span></a>';
        }
        actions.innerHTML = html;
      }
    }

    /* ---------------- 6. Aplikasi anggota ---------------- */
    var APP_ICON = { perencanaan: 'ruler', simulator: 'layers' };
    /* alamat aplikasi: jalur internal yang aman (aplikasi/…) atau http(s) bila pengelola memakai alamat luar */
    function appUrl(app) {
      var raw = String(app.url || '').trim();
      if (/^https?:\/\/[^\s]+$/i.test(raw)) return { href: raw, ext: true };
      var safe = u.safeNext(raw, '');
      return safe ? { href: safe, ext: false } : null;
    }
    function appButton(app, s) {
      var name = '<span class="sr-only"> ' + h(app.title) + '</span>';
      var url = appUrl(app);
      if (s.isActive && url) {
        return '<a class="btn btn--primary btn--block home-app__btn" href="' + h(url.href) + '"' + (url.ext ? ' target="_blank" rel="noopener"' : '') + ' data-app-open="' + h(app.key || '') + '">' +
          '<span>Buka Aplikasi' + name + (url.ext ? '<span class="sr-only"> (membuka tab baru)</span>' : '') + '</span>' + arrow(url.ext ? 'arrow-up-right' : 'arrow-right') + '</a>';
      }
      if (s.user) {
        var st = nextStep(s);
        return '<a class="btn btn--primary btn--block home-app__btn" href="' + h(st[0]) + '" data-app-step="' + h(app.key || '') + '">' +
          '<span>' + h(st[1]) + '<span class="sr-only"> untuk membuka ' + h(app.title) + '</span></span>' + arrow() + '</a>';
      }
      var next = url && !url.ext ? url.href : 'anggota.html#aplikasi';
      return '<a class="btn btn--primary btn--block home-app__btn" href="masuk.html?next=' + h(encodeURIComponent(next)) + '" data-app-login="' + h(app.key || '') + '">' +
        '<span>Masuk untuk mengakses' + name + '</span>' + arrow() + '</a>';
    }
    function appAccess(s) {
      if (s.isActive) return icon('check-circle', { size: 16 }) + '<span>' + (s.isMemberActive ? 'Akses aktif · dibuka di portal anggota' : 'Akses admin · dibuka di portal anggota') + '</span>';
      if (s.user) return icon('lock', { size: 16 }) + '<span>Terbuka setelah keanggotaan Aktif</span>';
      return icon('lock', { size: 16 }) + '<span>Khusus anggota berstatus Aktif</span>';
    }
    function renderApps(s) {
      var box = byId('apps-cards');
      var apps = arr(cfg.apps).filter(function (a) { return a && a.title; });
      if (!box) return;
      if (!apps.length) {
        box.innerHTML = P.ui.emptyState({ icon: 'compass', title: 'Aplikasi belum tersedia', text: 'Aplikasi anggota akan ditampilkan di sini.' });
        return;
      }
      var total = pad(apps.length);
      box.innerHTML = apps.map(function (app, i) {
        var ic = P.icons.indexOf(app.ikon) > -1 ? app.ikon : (APP_ICON[app.key] || 'compass');
        var fitur = arr(app.fitur).slice(0, 4);
        return '<article class="card card--dark card--nodes home-app' + (s.isActive ? ' is-open' : ' is-locked') + '" data-app="' + h(app.key || '') + '">' +
          '<div class="home-app__head">' +
            '<span class="index-num">' + pad(i + 1) + ' <span>/ ' + total + '</span></span>' +
            '<span class="home-app__icon">' + icon(ic, { size: 22 }) + '</span>' +
          '</div>' +
          '<h3 class="card__title home-app__title">' + h(app.title) + '</h3>' +
          '<p class="home-app__desc">' + prose(app.desc) + '</p>' +
          (fitur.length ? '<ul class="list-rule list-rule--compact list-rule--nodes home-app__fitur">' +
            fitur.map(function (f) { return '<li>' + h(f) + '</li>'; }).join('') + '</ul>' : '') +
          '<div class="card__footer home-app__foot">' +
            '<p class="home-app__access">' + appAccess(s) + '</p>' +
            appButton(app, s) +
          '</div>' +
        '</article>';
      }).join('');

      var note = byId('apps-note');
      if (note) {
        if (cfg.appNote) {
          note.innerHTML = icon('info', { size: 16 }) + '<span>' + prose(cfg.appNote) + '</span>';
          note.hidden = false;
        } else note.hidden = true;
      }
    }

    /* ---------------- 7. Kabar terkini ---------------- */
    function mediaHtml(b, opts) {
      if (b.gambar) return u.img(b.gambar, opts);
      return '<span class="home-media-fallback" aria-hidden="true">' + P.ui.scaffoldSVG({ cols: 4, rows: 3, cls: 'scaffold-draw--static' }) + '</span>';
    }
    function renderBerita(berita) {
      var list = byId('news-list');
      if (!list) return;
      var items = berita.filter(function (b) { return b && b.id && b.judul; }).slice().sort(function (a, b) {
        return String(b.tanggal || '').localeCompare(String(a.tanggal || ''));
      }).slice(0, 3);
      if (!items.length) {
        list.innerHTML = P.ui.emptyState({ icon: 'file-text', title: 'Belum ada berita', text: 'Berita dan kegiatan perkumpulan akan tampil di sini.' });
        return;
      }
      function meta(b) {
        return '<div class="news-card__meta">' +
          (b.kategori ? '<span class="tag">' + h(b.kategori) + '</span>' : '') +
          (b.tanggal ? '<time datetime="' + h(b.tanggal) + '">' + h(u.formatDate(b.tanggal, { short: true })) + '</time>' : '') +
          u.contohBadge(b) +
        '</div>';
      }
      function link(b) { return 'berita.html?id=' + encodeURIComponent(b.id || ''); }
      var lead = items[0];
      var html = '<article class="news-card home-news__lead" data-reveal>' +
        '<div class="news-card__media">' + mediaHtml(lead, { cls: 'img-mono', sizes: '(max-width: 1023px) 92vw, 680px' }) + '</div>' +
        meta(lead) +
        '<h3 class="news-card__title"><a href="' + h(link(lead)) + '">' + h(lead.judul) + '</a></h3>' +
        '<p class="news-card__excerpt">' + prose(lead.ringkasan) + '</p>' +
      '</article>';
      var rest = items.slice(1);
      if (rest.length) {
        html += '<div class="home-news__rows" data-reveal-stagger>' + rest.map(function (b) {
          return '<article class="news-card news-card--row home-news__row">' +
            '<div class="news-card__media">' + mediaHtml(b, { cls: 'img-mono', small: true }) + '</div>' +
            '<div class="home-news__row-body">' +
              meta(b) +
              '<h3 class="news-card__title"><a href="' + h(link(b)) + '">' + h(b.judul) + '</a></h3>' +
              '<p class="news-card__excerpt">' + prose(b.ringkasan) + '</p>' +
            '</div>' +
          '</article>';
        }).join('') + '</div>';
      }
      list.innerHTML = html;
    }

    function dateBlock(ev) {
      var a = u.parseDate(ev.mulai), b = u.parseDate(ev.selesai || ev.mulai) || a;
      if (!a) return '';
      if (b < a) b = a;
      var M = u.MONTHS_SHORT;
      var single = a.getTime() === b.getTime();
      var sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
      var day, month;
      if (single) { day = String(a.getDate()); month = M[a.getMonth()]; }
      else if (sameMonth) { day = a.getDate() + '–' + b.getDate(); month = M[a.getMonth()]; }
      else { day = a.getDate() + '–' + b.getDate(); month = M[a.getMonth()] + '–' + M[b.getMonth()]; }
      return '<div class="date-block' + (single ? '' : ' date-block--range') + '" aria-hidden="true">' +
        '<span class="date-block__day">' + h(day) + '</span>' +
        '<span class="date-block__month">' + h(month) + '</span>' +
        '<span class="date-block__year">' + h(String(b.getFullYear())) + '</span>' +
      '</div>';
    }
    function whenLabel(ev) {
      var start = u.daysUntil(ev.mulai);
      var end = u.daysUntil(ev.selesai || ev.mulai);
      if (start === null) return '';
      if (start === 0) return 'Hari ini';
      if (start < 0 && end >= 0) return 'Sedang berlangsung';
      if (start === 1) return 'Besok';
      return start + ' hari lagi';
    }
    function renderAgenda(agenda) {
      var list = byId('agenda-list');
      if (!list) return;
      var upcoming = agenda.filter(function (ev) {
        var end = ev && ev.judul ? u.daysUntil(ev.selesai || ev.mulai) : null;
        return end !== null && end >= 0;
      }).sort(function (a, b) {
        return String(a.mulai || '').localeCompare(String(b.mulai || ''));
      });
      var items = upcoming.slice(0, 3);
      var count = byId('agenda-count');
      if (count) {
        var lastDate = null;
        upcoming.forEach(function (ev) {
          var d = u.parseDate(ev.selesai || ev.mulai);
          if (d && (!lastDate || d > lastDate)) lastDate = d;
        });
        count.textContent = upcoming.length
          ? upcoming.length + ' kegiatan terjadwal' + (lastDate ? ' hingga ' + u.MONTHS[lastDate.getMonth()] + ' ' + lastDate.getFullYear() : '')
          : '';
        count.hidden = !upcoming.length;
      }
      if (!items.length) {
        list.innerHTML = '<div class="home-agenda__empty">' + icon('calendar', { size: 22 }) +
          '<p>Belum ada agenda terdekat. Jadwal pelatihan, sertifikasi, dan seminar berikutnya akan diumumkan di halaman Agenda.</p></div>';
        return;
      }
      list.innerHTML = items.map(function (ev) {
        var range = u.formatDateRange(ev.mulai, ev.selesai || ev.mulai);
        var when = whenLabel(ev);
        return '<article class="event-row home-event">' +
          dateBlock(ev) +
          '<div class="event-row__body">' +
            '<div class="event-row__meta">' +
              (ev.jenis ? '<span class="tag">' + h(ev.jenis) + '</span>' : '') +
              (ev.mode ? '<span class="badge badge--outline">' + h(ev.mode) + '</span>' : '') +
              u.contohBadge(ev) +
            '</div>' +
            '<h4 class="event-row__title"><a href="agenda.html?id=' + h(encodeURIComponent(ev.id || '')) + '"><span class="sr-only">' + h(range) + ': </span>' + h(ev.judul) + '</a></h4>' +
            '<p class="event-row__info">' +
              (when ? '<span class="home-event__when">' + icon('clock', { size: 16 }) + h(when) + '</span>' : '') +
              (ev.lokasi ? '<span>' + icon('map-pin', { size: 16 }) + h(ev.lokasi) + '</span>' : '') +
            '</p>' +
          '</div>' +
        '</article>';
      }).join('');
    }

    /* ---------------- 8. Regulasi kunci ---------------- */
    function statusTone(s) {
      if (/dicabut/i.test(s || '')) return 'err';
      if (/berlaku/i.test(s || '')) return 'ok';
      return 'muted';
    }
    function renderRegulasi(all) {
      var list = byId('reg-list');
      var text = byId('reg-text');
      all = all.filter(function (r) { return r && r.judul; });
      if (text && all.length) {
        text.textContent = 'Pustaka regulasi memuat ' + u.formatNumber(all.length) + ' peraturan perundang-undangan, SNI, dan standar internasional yang relevan dengan pekerjaan perancah — ringkas dan bertaut ke naskah resmi.';
      }
      if (!list) return;
      var kunci = all.filter(function (r) { return r.kunci; });
      if (kunci.length < 4) kunci = kunci.concat(all.filter(function (r) { return !r.kunci; })).slice(0, 4);
      kunci = kunci.slice(0, 4);
      if (!kunci.length) {
        list.outerHTML = P.ui.emptyState({ icon: 'book', title: 'Pustaka sedang disusun', text: 'Daftar regulasi dan standar akan segera tersedia.' });
        return;
      }
      list.innerHTML = kunci.map(function (r, i) {
        var q = r.singkatan || r.judul || '';
        var tone = statusTone(r.status);
        var code = r.singkatan || [r.nomor, r.tahun].filter(Boolean).join('/');
        return '<li class="home-reg__item">' +
          '<a class="home-reg__link" href="regulasi.html?q=' + h(encodeURIComponent(q)) + '">' +
            '<span class="index-num home-reg__num">' + pad(i + 1) + '</span>' +
            '<span class="home-reg__main">' +
              '<span class="home-reg__meta">' + (r.jenis ? '<span class="tag">' + h(r.jenis) + '</span>' : '') +
                (r.status ? '<span class="badge badge--' + tone + '">' + h(r.status) + '</span>' : '') + '</span>' +
              (code ? '<span class="home-reg__code">' + h(code) + '</span>' : '') +
              '<span class="home-reg__title">' + prose(r.judul) + '</span>' +
            '</span>' +
            '<span class="home-reg__go" aria-hidden="true">' + icon('arrow-right', { size: 20 }) + '</span>' +
          '</a>' +
        '</li>';
      }).join('');
    }

    /* ---------------- 10. Alur pendaftaran (pita CTA) ---------------- */
    var DEFAULT_STEPS = ['Buat akun', 'Isi formulir pendaftaran', 'Verifikasi sekretariat', 'Aktif & KTA digital', 'Akses fitur anggota'];
    var STEPS = (function () {
      var l = arr((org.keanggotaan || {}).langkah).map(function (x) { return x && x.judul ? String(x.judul) : ''; }).filter(Boolean);
      return l.length === DEFAULT_STEPS.length ? l : DEFAULT_STEPS;
    })();
    /* status → [jumlah tahap selesai, kelas tahap berikutnya, catatan] */
    var TRACK = {
      'Draf': [1, 'is-current', 'Belum diajukan'],
      'Perlu Perbaikan': [1, 'is-warn', 'Perlu perbaikan'],
      'Menunggu Verifikasi': [2, 'is-current', 'Sedang diverifikasi'],
      'Ditolak': [2, 'is-error', 'Pengajuan ditolak'],
      'Kedaluwarsa': [3, 'is-warn', 'Masa berlaku habis'],
      'Nonaktif': [3, 'is-error', 'Keanggotaan dinonaktifkan'],
      'Aktif': [5, '', '']
    };
    function renderTrack(s) {
      var ol = byId('cta-track');
      if (!ol) return;
      var st = s.user && own(TRACK, s.status) ? TRACK[s.status] : null;
      ol.innerHTML = STEPS.map(function (label, i) {
        var cls = '', meta = '', sr = '';
        if (st) {
          if (i < st[0]) { cls = 'is-done'; sr = ' (selesai)'; }
          else if (i === st[0] && st[1]) { cls = st[1]; meta = st[2]; sr = ' (tahap Anda saat ini)'; }
        }
        return '<li class="status-track__step' + (cls ? ' ' + cls : '') + '"' + (sr.indexOf('saat ini') > -1 ? ' aria-current="step"' : '') + '>' +
          '<span class="status-track__node" aria-hidden="true"></span>' +
          '<span class="status-track__label"><span class="home-cta__step-num" aria-hidden="true">' + pad(i + 1) + '</span>' + h(label) + (sr ? '<span class="sr-only">' + sr + '</span>' : '') + '</span>' +
          (meta ? '<span class="status-track__meta">' + h(meta) + '</span>' : '') +
        '</li>';
      }).join('');
      var wrap = byId('cta-track-wrap');
      if (wrap) wrap.classList.toggle('is-personal', !!st);
      var lab = byId('cta-track-label');
      if (lab) lab.textContent = st ? (s.isMemberActive ? 'Keanggotaan Anda Aktif' : 'Posisi pendaftaran Anda') : 'Alur pendaftaran anggota';
    }

    /* ---------------- Data terstruktur (JSON-LD) ----------------
       index.html memuat blok Organization + WebSite dengan alamat relatif ("./", logo). Alamat itu
       dijadikan lengkap dari config.siteUrl (atau alamat halaman yang sedang dibuka), sama seperti
       core.js melengkapi og:image dan canonical. */
    function absolutizeJsonLd() {
      var el = byId('ld-organisasi');
      if (!el || !/^https?:$/.test(window.location.protocol)) return;
      var KEYS = ['@id', 'url', 'logo'];
      function fix(o) {
        if (!o || typeof o !== 'object') return;
        if (Array.isArray(o)) { o.forEach(fix); return; }
        Object.keys(o).forEach(function (k) {
          var v = o[k];
          if (KEYS.indexOf(k) > -1 && typeof v === 'string' && !/^[a-z][a-z0-9+.\-]*:/i.test(v)) o[k] = u.siteUrl(v);
          else if (v && typeof v === 'object') fix(v);
        });
      }
      try {
        var data = JSON.parse(el.textContent);
        fix(data);
        el.textContent = JSON.stringify(data);
      } catch (e) { /* metadata only — never block the page */ }
    }

    /* ---------------- Status sesi: ajakan, aplikasi, akses pustaka, alur ---------------- */
    function applySession(s) {
      u.$$('[data-cta-join]').forEach(function (a) {
        var short = a.hasAttribute('data-cta-short');
        var href, label;
        if (s.isActive) { href = 'dashboard.html'; label = short ? 'Buka Dasbor' : 'Buka Dasbor Anggota'; }
        else if (s.user) { var st = nextStep(s); href = st[0]; label = st[1]; }
        else { href = JOIN_HREF; label = short ? 'Mulai Pendaftaran' : 'Bergabung Menjadi Anggota'; }
        a.setAttribute('href', href);
        a.innerHTML = '<span>' + h(label) + '</span>' + arrow('arrow-right');
      });
      u.$$('[data-guest-only]').forEach(function (el) { el.hidden = !!s.user; });
      renderApps(s);
      renderPustakaAccess(s);
      renderTrack(s);
      ['apps-cards', 'pk-access', 'pk-actions', 'cta-track'].forEach(function (id) { var el = byId(id); if (el) P.ui.reveal(el); });
    }

    renderTentang();
    renderPilar();
    absolutizeJsonLd();
    applySession(session());

    /* skeleton singkat hanya terlihat bila konten kelolaan dimuat dari jaringan (Mode Firebase) */
    var newsList = byId('news-list');
    if (newsList && !newsList.children.length) newsList.innerHTML = P.ui.skeleton(4);

    var loaded = await Promise.all([load('berita'), load('agenda'), load('regulasi'), load('pustaka')]);
    renderBerita(loaded[0]);
    renderAgenda(loaded[1]);
    renderRegulasi(loaded[2]);
    renderPustaka(loaded[3], loaded[2]);

    P.ui.reveal(byId('main'));
    if (P.session && typeof P.session.onChange === 'function') P.session.onChange(applySession);
    else P.auth.onChange(function () { applySession(session()); });
  });
})();
