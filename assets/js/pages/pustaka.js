/* ==========================================================================
   PPAPI — pustaka.html · Produk Pengetahuan
   Sumber data:
   - PPAPI.store.content.list('pustaka')  → dokumen PPAPI + aplikasi anggota
     (assets/data/pustaka.js digabung dengan butir yang dikelola admin);
   - PPAPI.store.content.list('regulasi') → peraturan perundangan & standar
     (assets/data/regulasi.js + butir admin). Jenis SNI dan Standar
     Internasional masuk koleksi "Standar"; jenis lainnya → "Peraturan Perundangan".
   Akses (SPEC-v2 §4.3):
   - anggota berstatus Aktif / admin → membuka dokumen melalui
     PPAPI.store.pustaka.fileUrl(item) dan membuka aplikasi anggota;
   - pengunjung lain → katalog terlihat, isi terkunci (PPAPI.ui.locked + CTA);
   - config.pustaka.katalogPublik === false → hanya panel terkunci.
   URL: ?q=&kategori=&status=&urut=&tampilan=&id=  (id = buka rincian dokumen).
   ========================================================================== */
(function () {
  'use strict';

  PPAPI.onReady(async function () {
    var U = PPAPI.util, ui = PPAPI.ui, h = U.h, icon = PPAPI.icon, $ = U.$, $$ = U.$$;
    var cfg = PPAPI.config || {};
    var store = PPAPI.store;

    /* ------------------------------------------------------------------
       Koleksi (urutan baku)
       ------------------------------------------------------------------ */
    var KATS = [
      { key: 'Standar', label: 'Standar', icon: 'award',
        desc: 'Standar PPAPI, Standar Nasional Indonesia, dan standar internasional acuan teknis.' },
      { key: 'Code of Practice', label: 'Code of Practice', icon: 'shield-check',
        desc: 'Pedoman praktik baik pemasangan, penggunaan, dan inspeksi perancah.' },
      { key: 'Peraturan Perundangan', label: 'Peraturan Perundangan', icon: 'scale', unit: 'regulasi',
        desc: 'Undang-undang, peraturan pemerintah, dan regulasi kementerian terkait perancah.' },
      { key: 'Petunjuk Teknis', label: 'Petunjuk Teknis', icon: 'wrench',
        desc: 'Petunjuk penerapan teknis untuk jenis perancah dan kondisi kerja tertentu.' },
      { key: 'Modul Pelatihan', label: 'Modul & Panduan Pelatihan', icon: 'book',
        desc: 'Modul pelatihan teknisi dan inspektur, serta panduan penggunaan aplikasi anggota.' },
      { key: 'Formulir & Daftar Periksa', label: 'Formulir & Daftar Periksa', icon: 'file-text',
        desc: 'Formulir dan daftar periksa untuk inspeksi perancah di lapangan.' },
      { key: 'Kajian Teknis', label: 'Kajian Teknis', icon: 'compass',
        desc: 'Kajian dan catatan teknis sebagai bahan diskusi profesional anggota.' },
      { key: 'Aplikasi', label: 'Aplikasi Anggota', icon: 'grid', unit: 'aplikasi',
        desc: 'Perencanaan & analisis struktur, serta simulator pemasangan tube & coupler.' }
    ];
    var KAT = Object.create(null);
    KATS.forEach(function (k, i) { k.rank = i; k.slug = U.slugify(k.key); KAT[k.key] = k; });
    var CATALOG_KATS = KATS.filter(function (k) { return k.key !== 'Aplikasi'; });
    var STATUS_ORDER = ['Berlaku', 'Berlaku (diubah)', 'Dalam Penyusunan', 'Draf', 'Dicabut'];
    var SORTS = ['katalog', 'terbaru', 'judul'];
    var VIEWS = ['kisi', 'daftar'];
    /* items per collection in the overview (no filter): two rows of cards from 768px up,
       two cards on a phone (one column) — "Tampilkan semua" opens the rest of the shelf */
    var mqCap = window.matchMedia ? [window.matchMedia('(min-width: 1100px)'), window.matchMedia('(min-width: 768px)')] : null;
    function cap() { return !mqCap ? 6 : (mqCap[0].matches ? 6 : (mqCap[1].matches ? 4 : 2)); }
    var VIEW_KEY = 'ppapi_pustaka_tampilan';
    var APP_IMG = { perencanaan: 'assets/img/stair-tower.webp', simulator: 'assets/img/facade-bw.webp' };

    function str(v) { return v === null || v === undefined ? '' : String(v); }
    function isHttp(url) { return /^https?:\/\//i.test(str(url).trim()); }
    function hostOf(url) { try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; } }
    function norm(s) { return str(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
    function squash(s) { return norm(s).replace(/[^a-z0-9]+/g, ''); }
    function plural(n, unit) { return U.formatNumber(n) + ' ' + (unit || 'dokumen'); }
    /* Counting words, aligned with the homepage tiles (index.js pkCount): a set whose every item is
       still being drafted (Dalam Penyusunan / Draf) is counted in "rancangan", regulations in "regulasi",
       apps in "aplikasi"; anything else in "dokumen". */
    function isDraft(it) { return it.status === 'Dalam Penyusunan' || it.status === 'Draf'; }
    function allContoh(list) { return list.length > 0 && list.every(function (x) { return x.contoh; }); }
    function unitOf(k, list) {
      if (k && k.unit) return k.unit;
      return list.length && list.every(isDraft) ? 'rancangan' : 'dokumen';
    }
    /* language of a title that is not Indonesian (WCAG 3.1.2): an explicit `bahasa` on the item wins;
       international standards are published under their English titles */
    function langOf(raw, intl) {
      var b = str(raw && raw.bahasa).trim();
      if (/^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(b)) return b === 'id' ? '' : b;
      return intl ? 'en' : '';
    }
    function langAttr(it) { return it.lang ? ' lang="' + h(it.lang) + '"' : ''; }
    function statusTone(s) {
      if (s === 'Berlaku') return 'ok';
      if (s === 'Dicabut') return 'err';
      if (s === 'Draf') return 'muted';
      return 'warn';
    }
    function statusBadge(s) { return s ? '<span class="badge badge--' + statusTone(s) + '">' + h(s) + '</span>' : ''; }
    function instShort(inst) { return str(inst).replace(/\s*\((kini [^)]+)\)\s*$/i, ''); }

    /* ------------------------------------------------------------------
       Data
       ------------------------------------------------------------------ */
    async function load(type) {
      try { return await store.content.list(type); }
      catch (e) { return (PPAPI.data && Array.isArray(PPAPI.data[type])) ? PPAPI.data[type].slice() : []; }
    }
    /* Firebase mode reads the managed items over the network: show a quiet placeholder meanwhile */
    var resultsSlot = $('[data-pk="results"]');
    if (resultsSlot && !resultsSlot.children.length) resultsSlot.innerHTML = ui.skeleton(4);
    var lists = await Promise.all([load('pustaka'), load('regulasi')]);

    function fromDoc(x, i) {
      var kat = KAT[x.kategori] ? x.kategori : 'Petunjuk Teknis';
      var tg = str(x.tanggal);
      var dk = /^\d{4}-\d{2}-\d{2}$/.test(tg) ? Number(tg.replace(/-/g, '')) : 0;
      return {
        key: 'd:' + x.id, id: str(x.id), src: 'doc', kategori: kat, kind: kat === 'Modul Pelatihan' ? 'Modul & Panduan Pelatihan' : kat,
        kode: str(x.kode), judul: str(x.judul), ringkasan: str(x.ringkasan), status: str(x.status), versi: str(x.versi),
        tanggal: tg, dateKey: dk, penyusun: str(x.penyusun), format: str(x.format), halaman: str(x.halaman),
        akses: x.akses === 'publik' ? 'publik' : 'anggota', tautan: str(x.tautan), berkas: x.berkasAnggota === true,
        tag: Array.isArray(x.tag) ? x.tag.map(str).filter(Boolean) : [], app: str(x.app), contoh: !!x.contoh,
        lang: langOf(x, false), raw: x, ord: i, prio: 0
      };
    }
    function fromReg(r, i) {
      var std = r.jenis === 'SNI' || r.jenis === 'Standar Internasional';
      var th = parseInt(r.tahun, 10);
      return {
        key: 'r:' + r.id, id: str(r.id), src: 'reg', kategori: std ? 'Standar' : 'Peraturan Perundangan',
        kind: r.jenis === 'SNI' ? 'Standar Nasional (SNI)' : str(r.jenis), jenis: str(r.jenis), intl: r.jenis === 'Standar Internasional',
        kode: str(r.singkatan), judul: str(r.judul), ringkasan: str(r.relevansi), status: str(r.status),
        tahun: isNaN(th) ? '' : String(th), dateKey: isNaN(th) ? 0 : th * 10000, nomor: str(r.nomor),
        penyusun: str(r.instansi), akses: 'publik', tautan: isHttp(r.tautan) ? str(r.tautan).trim() : '',
        kunci: !!r.kunci, contoh: !!r.contoh, tag: [], lang: langOf(r, r.jenis === 'Standar Internasional'),
        raw: r, ord: 100000 + i, prio: r.kunci ? 1 : 2
      };
    }
    var DOCS = lists[0].filter(function (x) { return x && x.id; }).map(fromDoc);
    var REGS = lists[1].filter(function (x) { return x && x.id; }).map(fromReg);
    var APPS = DOCS.filter(function (x) { return x.kategori === 'Aplikasi'; });
    var ITEMS = DOCS.filter(function (x) { return x.kategori !== 'Aplikasi'; }).concat(REGS);
    var BY_KEY = Object.create(null);
    DOCS.concat(REGS).forEach(function (it) {
      BY_KEY[it.key] = it;
      var text = [it.kode, it.judul, it.ringkasan, it.kind, it.kategori, it.tag.join(' '), it.penyusun, it.versi, it.format, it.nomor, it.tahun, it.jenis].join(' • ');
      it.hay = norm(text);
      it.hayS = squash(text);
    });

    var statusList = STATUS_ORDER.filter(function (s) { return ITEMS.some(function (r) { return r.status === s; }); });
    ITEMS.forEach(function (r) { if (r.status && statusList.indexOf(r.status) === -1) statusList.push(r.status); });

    var appCfg = Object.create(null);
    (Array.isArray(cfg.apps) ? cfg.apps : []).forEach(function (a) { if (a && a.key) appCfg[a.key] = a; });

    /* ------------------------------------------------------------------
       Viewer & access
       ------------------------------------------------------------------ */
    var viewer = PPAPI.session.current();
    var katalogPublik = !(cfg.pustaka && cfg.pustaka.katalogPublik === false);
    function canOpen() { return !!viewer.isActive; }
    function closedMode() { return !katalogPublik && !canOpen(); }

    function pendingLabel(it) { return it.status === 'Berlaku' ? 'Berkas menyusul' : 'Belum terbit'; }
    function accessInfo(it) {
      if (it.src === 'reg') {
        return it.tautan
          ? { icon: 'external', label: it.intl ? 'Halaman penerbit' : 'Naskah resmi' }
          : { icon: 'minus', label: 'Tautan belum tersedia', muted: true };
      }
      if (it.akses === 'publik') {
        return it.tautan ? { icon: 'arrow-up-right', label: 'Terbuka untuk umum' } : { icon: 'clock', label: pendingLabel(it), muted: true };
      }
      if (!canOpen()) return { icon: 'lock', label: 'Terkunci', locked: true };
      if (it.app) return { icon: 'arrow-up-right', label: 'Buka aplikasi' };
      return (it.tautan || it.berkas) ? { icon: 'arrow-up-right', label: 'Dapat dibuka' } : { icon: 'clock', label: pendingLabel(it), muted: true };
    }
    function aksesBadge(it) {
      if (it.src === 'reg') return '';
      return it.akses === 'publik'
        ? '<span class="badge badge--muted">Publik</span>'
        : '<span class="badge badge--outline">Khusus anggota</span>';
    }
    function lockText() {
      if (!viewer.user) {
        return closedMode()
          ? 'Standar, Code of Practice, modul pelatihan, dan aplikasi anggota disediakan bagi anggota berstatus Aktif — masuk, atau daftar dan lengkapi formulir pendaftaran.'
          : 'Katalog terbuka untuk umum. Dokumen khusus anggota dan aplikasi dapat dibuka oleh anggota berstatus Aktif — masuk, atau daftar dan lengkapi formulir pendaftaran.';
      }
      if (viewer.status === 'Menunggu Verifikasi') return 'Pengajuan keanggotaan Anda sedang diverifikasi sekretariat. Dokumen khusus anggota dan aplikasi terbuka setelah status keanggotaan Anda Aktif.';
      return 'Status keanggotaan Anda saat ini: ' + (viewer.status || 'Draf') + '. Dokumen khusus anggota dan aplikasi terbuka setelah keanggotaan Anda berstatus Aktif.';
    }

    /* ------------------------------------------------------------------
       Elements
       ------------------------------------------------------------------ */
    var el = {
      heroMeta: $('[data-pk="hero-meta"]'), heroPrimary: $('[data-pk="hero-primary"]'), heroApps: $('[data-pk="hero-apps"]'),
      tiles: $('[data-pk="tiles"]'), access: $('[data-pk="access"]'), form: $('[data-pk="toolbar"]'),
      q: $('#pk-q'), clear: $('[data-pk="toolbar"] .search-box__clear'), status: $('#pk-status'), sort: $('#pk-sort'),
      chips: $('[data-pk="chips"]'), view: $('[data-pk="view"]'), count: $('[data-pk="count"]'), reset: $('[data-pk="reset"]'),
      apphint: $('[data-pk="apphint"]'), results: $('[data-pk="results"]'), empty: $('[data-pk="empty"]'), note: $('[data-pk="note"]'),
      saringToggle: $('[data-pk="saring-toggle"]'), saringN: $('[data-pk="saring-n"]'),
      apps: $('[data-pk="apps"]'), appNote: $('[data-pk="app-note"]'), closed: $('[data-pk="closed"]'),
      cta: $('[data-pk="cta"]'), ctaInner: $('[data-pk="cta-inner"]')
    };

    /* ------------------------------------------------------------------
       State & URL
       ------------------------------------------------------------------ */
    function fromSlug(list, v) {
      if (!v) return '';
      var s = U.slugify(v);
      return list.filter(function (x) { return U.slugify(x) === s; })[0] || '';
    }
    var storedView = U.storage.get(VIEW_KEY, '');
    var state = {
      q: str(U.qs('q')).slice(0, 120),
      kategori: fromSlug(CATALOG_KATS.map(function (k) { return k.key; }), U.qs('kategori')),
      status: fromSlug(statusList, U.qs('status')),
      sort: SORTS.indexOf(U.qs('urut')) !== -1 ? U.qs('urut') : 'katalog',
      view: VIEWS.indexOf(U.qs('tampilan')) !== -1 ? U.qs('tampilan') : (VIEWS.indexOf(storedView) !== -1 ? storedView : 'kisi')
    };
    var expanded = Object.create(null);
    var openId = '';

    function syncUrl() {
      var params;
      try { params = new URLSearchParams(location.search); } catch (e) { return; }
      var set = function (k, v) { if (v) params.set(k, v); else params.delete(k); };
      set('q', state.q.trim());
      set('kategori', state.kategori ? U.slugify(state.kategori) : '');
      set('status', state.status ? U.slugify(state.status) : '');
      set('urut', state.sort !== 'katalog' ? state.sort : '');
      set('tampilan', state.view !== 'kisi' ? state.view : '');
      set('id', openId);
      var qs = params.toString();
      try { history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : '') + location.hash); } catch (e) { /* file:// */ }
    }

    /* ------------------------------------------------------------------
       Filtering, sorting, highlighting
       ------------------------------------------------------------------ */
    function tokens() { return norm(state.q).split(/\s+/).filter(Boolean); }
    function matchQ(it, toks) {
      return toks.every(function (t) {
        if (it.hay.indexOf(t) !== -1) return true;
        var st = squash(t);
        return !!st && it.hayS.indexOf(st) !== -1;
      });
    }
    function baseFiltered() {
      var toks = tokens();
      return ITEMS.filter(function (it) {
        return (!state.status || it.status === state.status) && (!toks.length || matchQ(it, toks));
      });
    }
    function catalogCmp(a, b) {
      return (KAT[a.kategori].rank - KAT[b.kategori].rank) || (a.prio - b.prio) || (a.ord - b.ord);
    }
    function sortList(list) {
      var cmp = {
        katalog: catalogCmp,
        terbaru: function (a, b) {
          if (!a.dateKey !== !b.dateKey) return a.dateKey ? -1 : 1;
          return (b.dateKey - a.dateKey) || catalogCmp(a, b);
        },
        judul: function (a, b) { return a.judul.localeCompare(b.judul, 'id', { sensitivity: 'base' }) || catalogCmp(a, b); }
      }[state.sort];
      return list.slice().sort(cmp);
    }
    function isFiltered() { return !!(state.q.trim() || state.kategori || state.status); }

    /* highlight query words inside an (escaped) string */
    function hl(text) {
      var s = str(text);
      var toks = norm(state.q).split(/\s+/).filter(function (t) { return t.length >= 2; });
      if (!toks.length) return h(s);
      var lower = norm(s), ranges = [];
      if (lower.length !== s.length) return h(s);     /* combining marks: skip highlighting */
      toks.forEach(function (t) {
        var i = 0;
        while ((i = lower.indexOf(t, i)) !== -1) { ranges.push([i, i + t.length]); i += t.length; }
      });
      if (!ranges.length) return h(s);
      ranges.sort(function (a, b) { return a[0] - b[0]; });
      var merged = [ranges[0]];
      for (var k = 1; k < ranges.length; k++) {
        var last = merged[merged.length - 1];
        if (ranges[k][0] <= last[1]) last[1] = Math.max(last[1], ranges[k][1]); else merged.push(ranges[k]);
      }
      var out = '', pos = 0;
      merged.forEach(function (r) {
        out += h(s.slice(pos, r[0])) + '<mark class="pk-hl">' + h(s.slice(r[0], r[1])) + '</mark>';
        pos = r[1];
      });
      return out + h(s.slice(pos));
    }

    /* ------------------------------------------------------------------
       Pieces
       ------------------------------------------------------------------ */
    function metaParts(it) {
      if (it.src === 'reg') {
        var a = [];
        if (it.tahun) a.push(it.intl || it.jenis === 'SNI' ? it.tahun : 'Tahun ' + it.tahun);
        if (it.penyusun) a.push(instShort(it.penyusun));
        return a;
      }
      return [
        it.versi,
        it.tanggal ? U.formatDate(it.tanggal, { short: true }) : '',
        it.format,
        it.halaman
      ].filter(Boolean);
    }
    function kindIcon(it) { return it.intl ? 'globe' : KAT[it.kategori].icon; }
    function accessHtml(it, cls) {
      var a = accessInfo(it);
      return '<span class="' + cls + (a.muted ? ' is-muted' : '') + (a.locked ? ' is-locked' : '') + '">' + icon(a.icon, { size: 14 }) + h(a.label) + '</span>';
    }
    function cardHtml(it, hTag) {
      var a = accessInfo(it);
      return '<article class="doc-card pk-card' + (a.locked ? ' doc-card--locked' : '') + '" data-key="' + h(it.key) + '">' +
        '<div class="doc-card__top"><span class="doc-card__kind">' + icon(kindIcon(it), { size: 16 }) + h(it.kind) + '</span>' +
          (it.kode ? '<span class="doc-card__code">' + hl(it.kode) + '</span>' : '') + '</div>' +
        '<' + hTag + ' class="doc-card__title"><button type="button" data-pk-open="' + h(it.key) + '" aria-haspopup="dialog"' + langAttr(it) + '>' + hl(it.judul) + '</button></' + hTag + '>' +
        (it.ringkasan ? '<p class="doc-card__summary">' + h(it.ringkasan) + '</p>' : '') +
        '<div class="doc-card__meta' + (it.src === 'reg' ? ' pk-meta--stack' : '') + '">' + metaParts(it).map(function (s) { return '<span>' + h(s) + '</span>'; }).join('') + '</div>' +
        '<div class="doc-card__foot">' + statusBadge(it.status) + (it.kunci ? '<span class="badge badge--outline" title="Termasuk Regulasi Kunci">Kunci</span>' : '') + U.contohBadge(it) +
          accessHtml(it, 'doc-card__access') + '</div>' +
      '</article>';
    }
    function rowHtml(it, hTag) {
      var a = accessInfo(it);
      return '<li class="pk-row' + (a.locked ? ' is-locked' : '') + '" data-key="' + h(it.key) + '">' +
        '<span class="pk-row__code">' + (it.kode ? hl(it.kode) : '<span aria-hidden="true">—</span><span class="sr-only">Tanpa kode</span>') + '</span>' +
        '<div class="pk-row__main">' +
          '<span class="pk-row__kind">' + icon(kindIcon(it), { size: 14 }) + h(it.kind) + '</span>' +
          '<' + hTag + ' class="pk-row__title"><button type="button" data-pk-open="' + h(it.key) + '" aria-haspopup="dialog"' + langAttr(it) + '>' + hl(it.judul) + '</button></' + hTag + '>' +
          (metaParts(it).length ? '<p class="pk-row__meta">' + metaParts(it).map(function (s) { return '<span>' + h(s) + '</span>'; }).join('') + '</p>' : '') +
        '</div>' +
        '<div class="pk-row__badges">' + statusBadge(it.status) + (it.kunci ? '<span class="badge badge--outline">Kunci</span>' : '') + U.contohBadge(it) + '</div>' +
        accessHtml(it, 'pk-row__access') +
      '</li>';
    }
    function itemsHtml(list, hTag, id) {
      var idAttr = id ? ' id="' + h(id) + '"' : '';
      if (state.view === 'daftar') return '<ol class="pk-index" role="list"' + idAttr + '>' + list.map(function (it) { return rowHtml(it, hTag); }).join('') + '</ol>';
      return '<div class="pk-grid"' + idAttr + '>' + list.map(function (it) { return cardHtml(it, hTag); }).join('') + '</div>';
    }
    /* "10 dokumen", "2 rancangan [Contoh]", "19 regulasi" — one wording for tiles, shelves and buttons */
    function countHtml(k, list) {
      return h(plural(list.length, unitOf(k, list))) + (allContoh(list) ? ' ' + U.contohBadge({ contoh: true }) : '');
    }
    function shelfHtml(k, list, idx, total, capped) {
      var shown = capped ? list.slice(0, cap()) : list;
      var rest = list.length - shown.length;
      var link = k.key === 'Peraturan Perundangan' || (k.key === 'Standar' && list.some(function (x) { return x.src === 'reg'; }))
        ? '<a class="btn btn--link btn--sm pk-shelf__link" href="regulasi.html' + (k.key === 'Standar' ? '?jenis=standar-internasional' : '') + '"><span>' + (k.key === 'Standar' ? 'Lihat di Regulasi &amp; Standar' : 'Tabel lengkap di Regulasi &amp; Standar') + '</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a>'
        : '';
      /* one condensed rule line per collection; the collection descriptions are on the tiles above */
      return '<div class="pk-shelf" data-kat="' + h(k.key) + '">' +
        '<header class="pk-shelf__head">' +
          '<span class="index-num">' + U.pad(idx) + ' <span>/ ' + U.pad(total) + '</span></span>' +
          '<h3 class="pk-shelf__title" id="pk-shelf-' + h(k.slug) + '"><span class="pk-shelf__icon" aria-hidden="true">' + icon(k.icon, { size: 16 }) + '</span>' + h(k.label) + '</h3>' +
          '<span class="pk-shelf__count">' + countHtml(k, list) + '</span>' +
          link +
        '</header>' +
        itemsHtml(shown, 'h4', 'pk-shelf-items-' + k.slug) +
        (rest > 0 ? '<div class="pk-shelf__more"><button type="button" class="btn btn--ghost btn--sm" data-pk-more="' + h(k.key) + '" aria-controls="pk-shelf-items-' + h(k.slug) + '"><span>Tampilkan semua ' + h(plural(list.length, unitOf(k, list))) + '</span>' + icon('chevron-down', { size: 16, cls: 'btn__icon' }) + '</button></div>' : '') +
      '</div>';
    }

    /* ------------------------------------------------------------------
       Hero meta, tiles, access bar, apps, CTA
       ------------------------------------------------------------------ */
    function renderHeroMeta() {
      if (!el.heroMeta) return;
      /* PPAPI's own documents: real ones and samples (contoh) are counted apart, so the hero never
         presents the sample drafts as existing PPAPI documents */
      var ownDocs = ITEMS.filter(function (x) { return x.src === 'doc'; });
      var nReal = ownDocs.filter(function (x) { return !x.contoh; }).length;
      var nSample = ownDocs.length - nReal;
      var parts = [];
      if (nReal) parts.push('<span>' + icon('file-text', { size: 16 }) + plural(nReal) + ' PPAPI</span>');
      if (nSample) parts.push('<span>' + icon('file-text', { size: 16 }) + plural(nSample, 'rancangan') + ' PPAPI (contoh)</span>');
      if (REGS.length) parts.push('<span>' + icon('scale', { size: 16 }) + U.formatNumber(REGS.length) + ' peraturan &amp; standar</span>');
      if (APPS.length) parts.push('<span>' + icon('grid', { size: 16 }) + plural(APPS.length, 'aplikasi') + ' anggota</span>');
      parts.push(canOpen()
        ? '<span class="pk-hero-access">' + icon('shield-check', { size: 16 }) + (viewer.isAdmin && !viewer.isMemberActive ? 'Akses admin' : 'Akses penuh anggota') + '</span>'
        : '<span class="pk-hero-access">' + icon('lock', { size: 16 }) + 'Isi khusus anggota Aktif</span>');
      el.heroMeta.innerHTML = parts.join('');
      if (el.heroPrimary) el.heroPrimary.setAttribute('href', closedMode() ? '#akses' : '#katalog');
      if (el.heroPrimary) $('span', el.heroPrimary).textContent = closedMode() ? 'Lihat akses anggota' : 'Telusuri katalog';
      if (el.heroApps) el.heroApps.hidden = closedMode() || !APPS.length;
    }

    function itemsOf(k) {
      if (k.key === 'Aplikasi') return APPS;
      return ITEMS.filter(function (x) { return x.kategori === k.key; });
    }
    /* a drawer that mixes PPAPI's own items with national/international standards says so:
       "1 rancangan PPAPI · 9 SNI & internasional" */
    function splitHtml(list) {
      var own = list.filter(function (x) { return x.src === 'doc'; });
      var reg = list.filter(function (x) { return x.src === 'reg'; });
      if (!own.length || !reg.length) return '';
      var nSni = reg.filter(function (x) { return x.jenis === 'SNI'; }).length;
      var nIntl = reg.filter(function (x) { return x.intl; }).length;
      var regWord = nSni + nIntl < reg.length ? 'peraturan & standar' : (!nIntl ? 'SNI' : (!nSni ? 'standar internasional' : 'SNI & internasional'));
      return '<span class="pk-tile__split">' + h(plural(own.length, unitOf(null, own)) + ' PPAPI · ' + U.formatNumber(reg.length) + ' ' + regWord) + '</span>';
    }
    function renderTiles() {
      if (!el.tiles) return;
      var total = U.pad(KATS.length);
      el.tiles.innerHTML = KATS.map(function (k, i) {
        var list = itemsOf(k);
        var n = list.length;
        var unit = n ? unitOf(k, list) : (k.unit || 'dokumen');
        var href = k.key === 'Aplikasi' ? '#aplikasi' : 'pustaka.html?kategori=' + k.slug + '#katalog';
        return '<li class="pk-tile-wrap"><a class="pk-tile' + (n ? '' : ' is-empty') + '" href="' + href + '"' + (k.key === 'Aplikasi' ? '' : ' data-pk-kat="' + h(k.key) + '"') + '>' +
          '<span class="pk-tile__top"><span class="index-num">' + U.pad(i + 1) + ' <span>/ ' + total + '</span></span><span class="pk-tile__icon">' + icon(k.icon, { size: 20 }) + '</span></span>' +
          '<span class="pk-tile__num">' + U.formatNumber(n) + ' <small>' + h(unit) + '</small>' + (allContoh(list) ? U.contohBadge({ contoh: true }) : '') + '</span>' +
          splitHtml(list) +
          '<span class="pk-tile__name">' + h(k.label) + '</span>' +
          '<span class="pk-tile__desc">' + h(k.desc) + '</span>' +
          '<span class="pk-tile__foot"><span class="pk-tile__unit">' + (n ? (k.key === 'Aplikasi' ? 'Lihat aplikasi' : 'Lihat koleksi') : 'Belum ada ' + (k.unit || 'dokumen')) + '</span>' + icon(k.key === 'Aplikasi' ? 'arrow-down' : 'arrow-right', { size: 16, cls: 'pk-tile__arrow' }) + '</span>' +
        '</a></li>';
      }).join('');
      ui.reveal(el.tiles);
    }

    function renderAccess() {
      if (!el.access) return;
      if (!canOpen()) {
        el.access.innerHTML = ui.locked({ compact: true, cls: 'pk-lockbar', title: 'Isi dokumen khusus anggota berstatus Aktif', text: lockText() });
      } else if (viewer.isAdmin) {
        el.access.innerHTML = '<div class="pk-granted">' +
          '<span class="pk-granted__icon">' + icon('shield-check', { size: 20 }) + '</span>' +
          '<div class="pk-granted__text"><p class="pk-granted__title">Akses admin</p>' +
          '<p>Anda melihat seluruh koleksi sebagai admin PPAPI. Dokumen, status, dan tautan berkas khusus anggota dikelola melalui Konsol Admin.</p></div>' +
          '<a class="btn btn--ghost btn--sm" href="admin.html#konten"><span>Konsol Admin</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a>' +
        '</div>';
      } else {
        var vu = viewer.member && viewer.member.validUntil ? (U.formatDate(viewer.member.validUntil) || '').replace(/ /g, '\u00a0') : '';
        el.access.innerHTML = '<div class="pk-granted">' +
          '<span class="pk-granted__icon">' + icon('shield-check', { size: 20 }) + '</span>' +
          '<div class="pk-granted__text"><p class="pk-granted__title">Akses penuh · Anggota Aktif</p>' +
          '<p>Seluruh dokumen yang telah terbit dan aplikasi anggota dapat Anda buka' + (vu ? ' selama keanggotaan berlaku (hingga ' + h(vu) + ')' : '') + '.</p></div>' +
          '<a class="btn btn--ghost btn--sm" href="#aplikasi"><span>Aplikasi anggota</span>' + icon('arrow-down', { size: 16, cls: 'btn__icon' }) + '</a>' +
        '</div>';
      }
      ui.reveal(el.access);
    }

    function appFeatures(it) {
      var c = appCfg[it.app];
      return c && Array.isArray(c.fitur) ? c.fitur.map(str).filter(Boolean) : [];
    }
    function appDesc(it) {
      var c = appCfg[it.app];
      return (c && c.desc) || it.ringkasan;
    }
    function renderApps() {
      if (!el.apps) return;
      var sec = el.apps.closest('section');
      if (!APPS.length) { if (sec) sec.hidden = true; return; }
      if (sec) sec.hidden = closedMode();
      var total = U.pad(APPS.length);
      el.apps.innerHTML = APPS.map(function (it, i) {
        var c = appCfg[it.app] || {};
        var img = APP_IMG[it.app] || 'assets/img/ringlock-pattern.webp';
        var feats = appFeatures(it);
        var open = canOpen();
        var url = it.tautan;
        var action = open
          ? (url ? '<a class="btn btn--primary btn--sm" href="' + h(url) + '"><span>Buka Aplikasi</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a>' : '<span class="pk-app__pending">' + icon('clock', { size: 14 }) + 'Segera tersedia</span>')
          : ui.lockedAction({ compact: true });
        return '<article class="doc-card doc-card--feature pk-app' + (open ? '' : ' doc-card--locked') + '" id="app-' + h(it.app || it.id) + '" data-key="' + h(it.key) + '">' +
          '<div class="doc-card__media" aria-hidden="true">' + U.img(img, { alt: '', cls: 'img-mono', sizes: '(min-width: 768px) 42vw, 100vw' }) +
            '<span class="pk-app__num">' + U.pad(i + 1) + ' <span>/ ' + total + '</span></span></div>' +
          '<div class="doc-card__body">' +
            '<div class="doc-card__top"><span class="doc-card__kind">' + icon(c.ikon || 'grid', { size: 16 }) + 'Aplikasi Anggota</span><span class="doc-card__code">' + h(it.format || 'Aplikasi Web') + '</span></div>' +
            '<h3 class="doc-card__title"><button type="button" data-pk-open="' + h(it.key) + '" aria-haspopup="dialog">' + h(it.judul) + '</button></h3>' +
            '<p class="pk-app__desc">' + h(appDesc(it)) + '</p>' +
            (feats.length ? '<ul class="pk-app__features">' + feats.map(function (f) { return '<li>' + icon('check', { size: 16 }) + '<span>' + h(f) + '</span></li>'; }).join('') + '</ul>' : '') +
            '<div class="doc-card__foot">' +
              (open ? '<span class="badge badge--ok">Akses terbuka</span>' : '<span class="pk-app__lock">' + icon('lock', { size: 14 }) + 'Khusus anggota Aktif</span>') +
              U.contohBadge(it) +
              '<div class="pk-app__actions">' + action + '</div>' +
            '</div>' +
          '</div>' +
        '</article>';
      }).join('');
      if (el.appNote) el.appNote.innerHTML = cfg.appNote ? icon('info', { size: 16 }) + '<span>' + h(cfg.appNote) + '</span>' : '';
      ui.reveal(el.apps);
    }

    function renderCta() {
      if (!el.ctaInner) return;
      if (closedMode()) { el.cta.hidden = true; return; }
      el.cta.hidden = false;
      if (canOpen()) {
        el.ctaInner.innerHTML =
          '<div class="pk-cta__text"><p class="eyebrow">Pustaka yang terus tumbuh</p>' +
          '<h2 class="h2" id="pk-cta-title">Punya <em>usulan</em> dokumen?</h2>' +
          '<p class="lead muted">Sampaikan usulan judul, koreksi isi, atau kebutuhan materi pelatihan kepada sekretariat. Setiap dokumen baru ditambahkan setelah ditelaah tim penyusun.</p></div>' +
          '<div class="pk-cta__actions"><a class="btn btn--primary" href="umpan-balik.html?kategori=Saran"><span>Kirim usulan</span>' + icon('arrow-right', { size: 18, cls: 'btn__icon' }) + '</a></div>';
      } else {
        el.ctaInner.innerHTML =
          '<div class="pk-cta__text"><p class="eyebrow">Akses Anggota</p>' +
          '<h2 class="h2" id="pk-cta-title">Buka seluruh <em>koleksi</em>.</h2>' +
          '<p class="lead muted">Dokumen khusus anggota, Code of Practice, modul pelatihan, dan aplikasi anggota terbuka setelah keanggotaan Anda berstatus Aktif.</p></div>' +
          '<div class="pk-cta__actions">' + ui.lockedAction({}) + '<a class="btn btn--link" href="keanggotaan.html"><span>Tentang keanggotaan</span>' + icon('arrow-right', { size: 18, cls: 'btn__icon' }) + '</a></div>';
      }
      ui.reveal(el.ctaInner);
    }

    function renderClosed() {
      $$('[data-pk-part="public"]').forEach(function (s) { s.hidden = closedMode() || (s.id === 'aplikasi' && !APPS.length); });
      if (!el.closed) return;
      el.closed.hidden = !closedMode();
      if (!closedMode()) { el.closed.innerHTML = ''; el.closed.removeAttribute('id'); return; }
      el.closed.id = 'akses';
      el.closed.innerHTML = '<div class="container container--narrow">' +
        '<h2 class="sr-only" id="pk-closed-title">Akses Produk Pengetahuan</h2>' +
        ui.locked({ cls: 'locked--center pk-closed__panel', title: 'Produk Pengetahuan khusus anggota berstatus Aktif', text: lockText() }) +
        '<ul class="pk-closed__list" aria-label="Koleksi yang tersedia bagi anggota">' +
          KATS.map(function (k) { return '<li>' + icon(k.icon, { size: 16 }) + '<span>' + h(k.label) + '</span></li>'; }).join('') +
        '</ul></div>';
      ui.reveal(el.closed);
    }

    /* ------------------------------------------------------------------
       Catalog
       ------------------------------------------------------------------ */
    function chipHtml(k) {
      return '<button type="button" class="chip" data-kat="' + h(k ? k.key : '') + '" aria-pressed="false"><span>' + h(k ? k.label : 'Semua') + '</span> <span class="chip__count"></span></button>';
    }
    if (el.chips) el.chips.innerHTML = [chipHtml(null)].concat(CATALOG_KATS.map(chipHtml)).join('');
    if (el.status) {
      el.status.insertAdjacentHTML('beforeend', statusList.map(function (s) { return '<option value="' + h(s) + '">' + h(s) + '</option>'; }).join(''));
    }
    function updateChips(base) {
      $$('.chip', el.chips).forEach(function (chip) {
        var k = chip.getAttribute('data-kat');
        var n = k ? base.filter(function (r) { return r.kategori === k; }).length : base.length;
        $('.chip__count', chip).textContent = U.formatNumber(n);
        chip.setAttribute('aria-label', (k ? KAT[k].label : 'Semua koleksi') + ', ' + plural(n));
        chip.setAttribute('aria-pressed', String(k === state.kategori));
        chip.classList.toggle('is-zero', n === 0 && k !== state.kategori);
      });
    }
    /* phones: Status and Urutkan fold behind "Saring"; the button shows how many of them are set */
    function updateSaring() {
      if (!el.saringN) return;
      var n = (state.status ? 1 : 0) + (state.sort !== 'katalog' ? 1 : 0);
      el.saringN.hidden = !n;
      el.saringN.innerHTML = n ? U.formatNumber(n) + '<span class="sr-only"> pengaturan aktif</span>' : '';
    }
    function updateView() {
      $$('.segmented__option', el.view).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-value') === state.view)); });
    }

    function render(opts) {
      opts = opts || {};
      if (closedMode()) return;
      var base = baseFiltered();
      updateChips(base);
      updateView();
      var list = sortList(base.filter(function (r) { return !state.kategori || r.kategori === state.kategori; }));
      var filtered = isFiltered();

      var html = '';
      if (list.length) {
        if (state.sort === 'katalog') {
          var groups = CATALOG_KATS.map(function (k) { return { k: k, items: list.filter(function (x) { return x.kategori === k.key; }) }; })
            .filter(function (g) { return g.items.length; });
          html = groups.map(function (g, i) {
            return shelfHtml(g.k, g.items, i + 1, groups.length, !filtered && !expanded[g.k.key]);
          }).join('');
        } else {
          html = '<div class="pk-flat">' + itemsHtml(list, 'h3') + '</div>';
        }
      }
      el.results.innerHTML = html;
      el.results.hidden = !list.length;
      el.results.removeAttribute('aria-busy');
      el.results.classList.toggle('is-list', state.view === 'daftar');
      el.empty.hidden = !!list.length;
      if (!list.length) {
        el.empty.innerHTML = ui.emptyState({
          icon: 'search',
          title: 'Tidak ada dokumen yang sesuai',
          text: 'Coba kata kunci lain, pilih koleksi “Semua”, atau ubah filter status.',
          actionHtml: '<button type="button" class="btn btn--ghost btn--sm" data-pk-reset><span>Atur ulang filter</span></button>'
        });
      }

      var q = state.q.trim();
      if (!filtered) {
        var nContoh = ITEMS.filter(function (x) { return x.contoh; }).length;
        el.count.innerHTML = '<strong>' + U.formatNumber(ITEMS.length) + '</strong> dokumen dalam katalog' +
          (nContoh ? ', termasuk ' + U.formatNumber(nContoh) + ' bertanda Contoh' : '');
      } else {
        var desc = [];
        if (state.kategori) desc.push('koleksi ' + h(KAT[state.kategori].label));
        if (state.status) desc.push('status ' + h(state.status));
        el.count.innerHTML = 'Menampilkan <strong>' + U.formatNumber(list.length) + '</strong> dari ' + U.formatNumber(ITEMS.length) + ' dokumen' +
          (q ? ' untuk “' + h(q) + '”' : '') + (desc.length ? ' · ' + desc.join(' · ') : '');
      }
      el.reset.hidden = !filtered;
      el.clear.hidden = !state.q;

      /* the apps live in their own section; tell the reader when a search also matches one */
      var toks = tokens();
      var appHits = toks.length && !closedMode() ? APPS.filter(function (a) { return matchQ(a, toks); }) : [];
      el.apphint.hidden = !appHits.length;
      el.apphint.innerHTML = appHits.length
        ? icon('grid', { size: 16 }) + '<span>Cocok juga dengan aplikasi anggota: ' + appHits.map(function (a) {
          return '<a href="#app-' + h(a.app || a.id) + '">' + h(a.judul) + '</a>';
        }).join(', ') + '.</span>'
        : '';

      el.note.hidden = !ITEMS.some(function (x) { return x.contoh; });
      ui.reveal(el.results);
      ui.reveal(el.empty);
      if (!opts.initial) syncUrl();
    }

    function renderAll(opts) {
      renderHeroMeta();
      renderClosed();
      if (!closedMode()) {
        renderTiles();
        renderAccess();
        render(opts);
        renderApps();
      }
      renderCta();
    }

    /* ------------------------------------------------------------------
       Detail modal
       ------------------------------------------------------------------ */
    function kvRow(label, value) { return value ? '<div class="kv__row"><dt>' + label + '</dt><dd>' + value + '</dd></div>' : ''; }
    function pendingHtml(it) {
      var text = it.status === 'Berlaku'
        ? 'Berkas dokumen ini belum diunggah sekretariat. Silakan periksa kembali dalam waktu dekat.'
        : 'Dokumen ini masih ' + (it.status ? it.status.toLowerCase() : 'dalam penyusunan') + '. Berkasnya akan tersedia di sini setelah diterbitkan sekretariat.';
      return '<div class="pk-modal__pending">' + icon('clock', { size: 18 }) + '<div><p class="pk-modal__pending-title">Berkas belum tersedia</p><p>' + h(text) + '</p></div></div>';
    }
    function openLinkHtml(it, url) {
      if (it.app || /^aplikasi\//.test(url)) {
        return '<a class="btn btn--primary btn--sm" href="' + h(url) + '"><span>Buka Aplikasi</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a>';
      }
      var host = isHttp(url) ? hostOf(url) : '';
      return '<a class="btn btn--primary btn--sm" href="' + h(url) + '" target="_blank" rel="noopener noreferrer"><span>Buka Dokumen</span>' + icon('arrow-up-right', { size: 16, cls: 'btn__icon' }) + '<span class="sr-only"> (tab baru)</span></a>' +
        (host ? '<span class="pk-modal__host">' + h(host) + '</span>' : '');
    }
    /* item-level lock copy (the page-level wording stays on the access bar): what this one document
       or app needs, with the session's own next step as CTA (ui.lockedAction) */
    function itemLockedHtml(it) {
      var noun = it.app ? 'Aplikasi' : 'Dokumen';
      var title, text;
      if (!viewer.user) {
        title = 'Masuk untuk membuka ' + noun.toLowerCase() + ' ini';
        text = noun + ' ini dapat dibuka oleh anggota berstatus Aktif.';
      } else if (viewer.status === 'Menunggu Verifikasi') {
        title = 'Pengajuan Anda sedang diverifikasi';
        text = noun + ' ini dapat dibuka setelah keanggotaan Anda berstatus Aktif.';
      } else {
        title = noun + ' ini khusus anggota berstatus Aktif';
        text = 'Status keanggotaan Anda saat ini: ' + (viewer.status || 'Draf') + '.';
      }
      return ui.locked({ compact: true, cls: 'pk-modal__locked', title: title, text: text });
    }
    function accessBlock(it) {
      if (it.src === 'reg') {
        var lb = it.intl ? ['Buka halaman penerbit', 'Tautan halaman penerbit belum tersedia.'] : ['Buka naskah resmi', 'Tautan naskah resmi belum tersedia.'];
        var link = it.tautan
          ? '<a class="btn btn--primary btn--sm" href="' + h(it.tautan) + '" target="_blank" rel="noopener noreferrer"><span>' + lb[0] + '</span>' + icon('external', { size: 16, cls: 'btn__icon' }) + '<span class="sr-only"> (tab baru)</span></a><span class="pk-modal__host">' + h(hostOf(it.tautan)) + '</span>'
          : '<span class="pk-modal__host">' + lb[1] + '</span>';
        return '<div class="pk-modal__links">' + link + '</div>' +
          '<a class="btn btn--link btn--sm pk-modal__reglink" href="regulasi.html?q=' + encodeURIComponent(it.kode || it.judul) + '"><span>Lihat di pustaka Regulasi &amp; Standar</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a>';
      }
      if (it.akses === 'publik' && it.tautan && !canOpen()) return '<div class="pk-modal__links">' + openLinkHtml(it, it.tautan) + '</div>';
      if (it.akses === 'publik' && !it.tautan && !canOpen()) return pendingHtml(it);
      if (!canOpen()) return itemLockedHtml(it);
      return '<div class="pk-modal__links" data-pk-resolve><span class="pk-modal__loading"><span class="spinner" aria-hidden="true"></span>Menyiapkan tautan…</span></div>';
    }
    function resolveLink(it, root) {
      var slot = $('[data-pk-resolve]', root);
      if (!slot) return;
      Promise.resolve().then(function () { return store.pustaka.fileUrl(it.raw); }).then(function (url) {
        if (!slot.isConnected) return;
        if (url) slot.innerHTML = openLinkHtml(it, url);
        else slot.outerHTML = pendingHtml(it);
      }, function (err) {
        if (!slot.isConnected) return;
        if (err && err.code === 'store/forbidden') {
          slot.outerHTML = itemLockedHtml(it);
        } else {
          slot.outerHTML = '<div class="alert alert--err" role="alert">' + icon('alert-triangle', { size: 20 }) + '<div><p class="alert__title">Tautan belum dapat dimuat</p><p>' + h((err && err.message) || 'Periksa koneksi Anda, lalu coba lagi.') + '</p></div></div>';
        }
      });
    }
    function openDetail(it) {
      var kvs;
      /* the header already says jenis/koleksi (eyebrow), status and akses (badges): the list holds
         only what is said nowhere else */
      if (it.src === 'reg') {
        kvs = kvRow('Nomor', h(it.nomor)) + kvRow('Tahun', h(it.tahun)) +
          kvRow('Instansi', h(it.penyusun)) + kvRow('Koleksi', h(KAT[it.kategori].label));
      } else {
        kvs = kvRow('Kode', h(it.kode)) + kvRow('Versi', h(it.versi)) +
          kvRow('Tanggal terbit', it.tanggal ? h(U.formatDate(it.tanggal)) : '<span class="muted">Belum terbit</span>') +
          kvRow('Penyusun', h(it.penyusun)) + kvRow('Format', h(it.format)) + kvRow('Jumlah halaman', h(it.halaman));
      }
      var feats = it.app ? appFeatures(it) : [];
      var body =
        '<div class="pk-modal">' +
          '<div class="pk-modal__badges">' + statusBadge(it.status) + aksesBadge(it) + (it.kunci ? '<span class="badge badge--outline">Regulasi Kunci</span>' : '') + U.contohBadge(it) + '</div>' +
          '<div class="pk-modal__summary"><p class="pk-modal__label">' + (it.src === 'reg' ? 'Relevansi bagi pekerjaan perancah' : 'Ringkasan') + '</p><p>' + h(it.app ? appDesc(it) : it.ringkasan) + '</p></div>' +
          '<div class="pk-modal__access">' + accessBlock(it) + '</div>' +
          (feats.length ? '<ul class="pk-app__features pk-modal__features" aria-label="Fitur utama">' + feats.map(function (f) { return '<li>' + icon('check', { size: 16 }) + '<span>' + h(f) + '</span></li>'; }).join('') + '</ul>' : '') +
          '<dl class="kv pk-modal__kv">' + kvs + '</dl>' +
          (it.tag.length ? '<ul class="pk-modal__tags" aria-label="Kata kunci">' + it.tag.map(function (t) { return '<li>' + h(t) + '</li>'; }).join('') + '</ul>' : '') +
          (it.app && cfg.appNote ? '<p class="pk-modal__note">' + h(cfg.appNote) + '</p>' : '') +
          (it.src === 'reg' ? '<p class="pk-modal__note">' + (it.intl
            ? 'Ringkasan disusun untuk rujukan. Tautan mengarah ke halaman resmi penerbit standar; naskah lengkap dan edisi terbarunya tersedia melalui penerbit tersebut.'
            : 'Ringkasan disusun untuk rujukan; selalu periksa naskah resmi terbaru di JDIH instansi terkait.') + '</p>' : '') +
        '</div>';
      openId = it.id;
      syncUrl();
      ui.modal({
        title: it.judul,
        eyebrow: it.kind,
        body: body,
        size: 'md',
        cls: 'pk-modal-root',
        actions: [{ label: 'Tutup', variant: 'ghost' }],
        onOpen: function (root) {
          /* start reading at the title (WAI-ARIA APG dialog pattern for content-heavy dialogs), not on
             "Tutup" at the bottom: ui.modal focuses [data-autofocus] first */
          var t = $('.modal__title', root);
          if (t) {
            t.setAttribute('tabindex', '-1');
            t.setAttribute('data-autofocus', '');
            if (it.lang) t.setAttribute('lang', it.lang);
          }
          resolveLink(it, root);
        },
        onClose: function () { openId = ''; syncUrl(); restoreMeta(); }
      });
      applyDocMeta(it);
    }

    /* While a document is open (also via ?id=, which core.js keeps in the canonical URL), the page
       title, description and og:title/og:description describe that document; restored on close.
       Same pattern as agenda.js. */
    var META = { desc: 'meta[name="description"]', ogTitle: 'meta[property="og:title"]', ogDesc: 'meta[property="og:description"]' };
    var savedMeta = null;
    function metaGet(sel) { var m = document.head.querySelector(sel); return m ? m.getAttribute('content') : null; }
    function metaSet(sel, val) { var m = document.head.querySelector(sel); if (m && val !== null && val !== undefined) m.setAttribute('content', val); }
    function clip(s, max) {
      s = str(s).replace(/\s+/g, ' ').trim();
      if (s.length <= max) return s;
      var cut = s.slice(0, max - 1), sp = cut.lastIndexOf(' ');
      return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–—-]+$/, '') + '…';
    }
    function applyDocMeta(it) {
      if (!savedMeta) savedMeta = { title: document.title, desc: metaGet(META.desc), ogTitle: metaGet(META.ogTitle), ogDesc: metaGet(META.ogDesc) };
      var name = (it.src === 'reg' && it.kode ? it.kode + ' · ' : '') + it.judul + (it.contoh ? ' (Contoh)' : '');
      var title = name + ' — Produk Pengetahuan PPAPI';
      var desc = clip(it.app ? appDesc(it) : it.ringkasan, 160) || clip(it.kind + ' dalam Produk Pengetahuan PPAPI.', 160);
      document.title = title;
      metaSet(META.ogTitle, title);
      metaSet(META.desc, desc);
      metaSet(META.ogDesc, desc);
    }
    function restoreMeta() {
      if (!savedMeta) return;
      document.title = savedMeta.title;
      metaSet(META.ogTitle, savedMeta.ogTitle);
      metaSet(META.desc, savedMeta.desc);
      metaSet(META.ogDesc, savedMeta.ogDesc);
      savedMeta = null;
    }
    function findById(id) {
      if (!id) return null;
      return BY_KEY['d:' + id] || BY_KEY['r:' + id] || null;
    }

    /* ------------------------------------------------------------------
       Events
       ------------------------------------------------------------------ */
    document.addEventListener('click', function (e) {
      var opener = e.target.closest('[data-pk-open]');
      if (opener) {
        var it = BY_KEY[opener.getAttribute('data-pk-open')];
        if (it) { e.preventDefault(); openDetail(it); }
        return;
      }
      var more = e.target.closest('[data-pk-more]');
      if (more) {
        var k = more.getAttribute('data-pk-more');
        expanded[k] = true;
        var shelfTitle = 'pk-shelf-' + KAT[k].slug;
        render();
        var t = document.getElementById(shelfTitle);
        var shelf = t && t.closest('.pk-shelf');
        /* keep the reader in place: focus the first newly shown item */
        var items = shelf ? $$('[data-pk-open]', shelf) : [];
        var firstNew = items[cap()] || items[items.length - 1];
        if (firstNew) firstNew.focus({ preventScroll: false });
        return;
      }
      var tile = e.target.closest('[data-pk-kat]');
      if (tile) {
        e.preventDefault();
        state.kategori = tile.getAttribute('data-pk-kat');
        render();
        var cat = document.getElementById('katalog');
        if (cat) cat.scrollIntoView({ block: 'start', behavior: PPAPI.motion && PPAPI.motion.prefersReduced() ? 'auto' : 'smooth' });
        var chip = el.chips && el.chips.querySelector('.chip[aria-pressed="true"]');
        if (chip) chip.focus({ preventScroll: true });
      }
    });

    if (el.form) {
      var phShort = el.q.getAttribute('placeholder') || '';
      var phWide = el.q.getAttribute('data-placeholder-wide') || phShort;
      /* the long example only where the search column is wide enough to show it whole */
      var mqWide = window.matchMedia ? window.matchMedia('(min-width: 1360px)') : null;
      var applyPlaceholder = function () { el.q.setAttribute('placeholder', mqWide && mqWide.matches ? phWide : phShort); };
      applyPlaceholder();
      if (mqWide) {
        if (mqWide.addEventListener) mqWide.addEventListener('change', applyPlaceholder);
        else if (mqWide.addListener) mqWide.addListener(applyPlaceholder);
      }

      el.q.value = state.q;
      el.status.value = state.status;
      el.sort.value = state.sort;

      el.form.addEventListener('submit', function (e) { e.preventDefault(); state.q = el.q.value; render(); });
      var onType = U.debounce(function () { state.q = el.q.value; render(); }, 180);
      el.q.addEventListener('input', function () { el.clear.hidden = !el.q.value; onType(); });
      el.q.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && el.q.value) { e.preventDefault(); e.stopPropagation(); el.q.value = ''; state.q = ''; render(); }
      });
      if (el.saringToggle) {
        el.saringToggle.addEventListener('click', function () {
          var open = el.saringToggle.getAttribute('aria-expanded') !== 'true';
          el.saringToggle.setAttribute('aria-expanded', String(open));
          el.form.classList.toggle('is-saring-open', open);
        });
      }
      el.status.addEventListener('change', function () { state.status = el.status.value; render(); });
      el.sort.addEventListener('change', function () { state.sort = el.sort.value; render(); });
      el.chips.addEventListener('click', function (e) {
        var chip = e.target.closest('.chip');
        if (!chip) return;
        var k = chip.getAttribute('data-kat');
        state.kategori = (k && k !== state.kategori) ? k : '';
        render();
      });
      el.view.addEventListener('segmented:change', function (e) {
        var v = e.detail && e.detail.value;
        if (VIEWS.indexOf(v) === -1 || v === state.view) return;
        state.view = v;
        U.storage.set(VIEW_KEY, v);
        render();
      });
    }
    function resetFilters() {
      state.q = ''; state.kategori = ''; state.status = '';
      el.q.value = ''; el.status.value = '';
      render();
    }
    if (el.reset) el.reset.addEventListener('click', function () { resetFilters(); el.q.focus(); });
    if (el.empty) el.empty.addEventListener('click', function (e) {
      if (e.target.closest('[data-pk-reset]')) { resetFilters(); el.q.focus(); }
    });

    if (mqCap) mqCap.forEach(function (mq) {
      var onMq = function () { if (!isFiltered()) render(); };
      if (mq.addEventListener) mq.addEventListener('change', onMq); else if (mq.addListener) mq.addListener(onMq);
    });

    /* re-render the access-dependent parts when the viewer signs in/out or the status changes */
    PPAPI.session.onChange(function (s) {
      viewer = s || PPAPI.session.current();
      renderAll();
    });

    renderAll({ initial: true });

    /* deep links: ?id= opens the document; filters bring the catalog into view */
    var deep = findById(U.qs('id'));
    if (deep && !closedMode() && !(deep.kategori === 'Aplikasi' && !APPS.length)) {
      openDetail(deep);
    } else if (isFiltered() && !location.hash && !closedMode()) {
      var cat = document.getElementById('katalog');
      if (cat) setTimeout(function () { cat.scrollIntoView({ block: 'start' }); }, 60);
    }
  });
})();
