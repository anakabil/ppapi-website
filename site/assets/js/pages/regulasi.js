/* ==========================================================================
   PPAPI — regulasi.html · Pustaka Regulasi & Standar
   Sumber data: PPAPI.store.content.list('regulasi') — assets/data/regulasi.js digabung
   dengan butir yang ditambahkan/diubah/disembunyikan admin melalui Konsol Admin
   (fallback ke PPAPI.data.regulasi bila penyimpanan tidak dapat dibaca).
   Halaman ini bagian dari Produk Pengetahuan (pustaka.html): breadcrumb + tautan balik.
   - "Regulasi Kunci" (kunci:true) sebagai kartu bernomor + modal ringkasan.
   - Pustaka: pencarian, chip jenis (dengan jumlah), filter status, urutan,
     tabel responsif (< 768px: baris ringkas + pengungkap "Ringkasan"), grup Standar
     Internasional, sinkronisasi URL (?q=&jenis=&status=&urut=).
   - Tautan sumber: "naskah resmi" untuk regulasi nasional, "halaman penerbit" untuk
     standar internasional (tautannya menuju halaman katalog penerbit, bukan naskah).
   ========================================================================== */
(function () {
  'use strict';

  PPAPI.onReady(async function () {
    var U = PPAPI.util, ui = PPAPI.ui, h = U.h, icon = PPAPI.icon;
    var $ = U.$;
    var STATIC = (PPAPI.data && Array.isArray(PPAPI.data.regulasi)) ? PPAPI.data.regulasi : [];
    var DATA;
    try {
      DATA = PPAPI.store && PPAPI.store.content ? await PPAPI.store.content.list('regulasi') : STATIC.slice();
    } catch (e) {
      DATA = STATIC.slice();
    }
    /* defensive copies with string fields (admin-managed items may omit optional keys) */
    DATA = DATA.filter(function (r) { return r && r.id; }).map(function (r) {
      return Object.assign({}, r, {
        jenis: String(r.jenis || ''), nomor: String(r.nomor == null ? '' : r.nomor), singkatan: String(r.singkatan || ''),
        judul: String(r.judul || ''), instansi: String(r.instansi || ''), status: String(r.status || ''),
        relevansi: String(r.relevansi || ''), tautan: String(r.tautan || '')
      });
    });

    var INTL = 'Standar Internasional';
    var JENIS_ORDER = ['Undang-Undang', 'Peraturan Pemerintah', 'Peraturan Menteri', 'Keputusan Menteri', 'Surat Edaran', 'SNI', INTL];
    var STATUS_ORDER = ['Berlaku', 'Berlaku (diubah)', 'Dicabut'];
    var SORTS = ['terbaru', 'terlama', 'jenis'];

    function isIntl(r) { return r.jenis === INTL; }
    /* Language of a title that is not Indonesian (WCAG 3.1.2 Language of Parts): an explicit
       `bahasa` on the item wins (BCP 47 tag, e.g. 'en'); international standards are published under
       their English titles, so they default to 'en'. Returns ' lang="…"' or ''. */
    function langAttr(r) {
      var b = String(r.bahasa || '').trim();
      var tag = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(b) ? (b === 'id' ? '' : b) : (isIntl(r) ? 'en' : '');
      return tag ? ' lang="' + h(tag) + '"' : '';
    }
    function tone(status) { return status === 'Dicabut' ? 'err' : (status === 'Berlaku' ? 'ok' : 'warn'); }
    function jenisRank(j) { var i = JENIS_ORDER.indexOf(j); return i === -1 ? JENIS_ORDER.length : i; }
    function year(r) { var y = parseInt(r.tahun, 10); return isNaN(y) ? 0 : y; }
    function norm(s) {
      return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    }
    function squash(s) { return norm(s).replace(/[^a-z0-9]+/g, ''); }
    function isHttp(url) { return /^https?:\/\//i.test(String(url || '').trim()); }
    function hostOf(url) {
      try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
    }
    /* What the source link opens: national instruments link to the official text (JDIH/BPK/BSN);
       international standards link to the publisher's own page (catalogue/product page), not the text. */
    function srcLabel(r) {
      return isIntl(r)
        ? { open: 'Buka halaman penerbit', noun: 'Halaman penerbit', none: 'Tautan halaman penerbit belum tersedia' }
        : { open: 'Buka naskah resmi', noun: 'Naskah resmi', none: 'Tautan naskah resmi belum tersedia' };
    }

    /* Jenis & status lists (urutan baku, lalu nilai baru yang mungkin ditambahkan pengelola) */
    var jenisList = JENIS_ORDER.filter(function (j) { return DATA.some(function (r) { return r.jenis === j; }); });
    DATA.forEach(function (r) { if (r.jenis && jenisList.indexOf(r.jenis) === -1) jenisList.push(r.jenis); });
    var statusList = STATUS_ORDER.filter(function (s) { return DATA.some(function (r) { return r.status === s; }); });
    DATA.forEach(function (r) { if (r.status && statusList.indexOf(r.status) === -1) statusList.push(r.status); });

    /* Search index */
    DATA.forEach(function (r) {
      var text = [r.singkatan, r.judul, r.nomor, r.tahun, r.instansi, r.relevansi, r.jenis].join(' • ');
      r.__hay = norm(text);
      r.__hayS = squash(text);
    });

    /* ------------------------------------------------------------------
       HERO META (jumlah dihitung dari data)
       ------------------------------------------------------------------ */
    var metaEl = $('[data-rg="hero-meta"]');
    if (metaEl && DATA.length) {
      var nIntl = DATA.filter(isIntl).length;
      var nNas = DATA.length - nIntl;
      var parts = ['<span>' + icon('file-text', { size: 16 }) + U.formatNumber(DATA.length) + ' dokumen</span>'];
      if (nNas) parts.push('<span>' + icon('scale', { size: 16 }) + U.formatNumber(nNas) + ' regulasi &amp; standar nasional</span>');
      if (nIntl) parts.push('<span>' + icon('globe', { size: 16 }) + U.formatNumber(nIntl) + ' acuan internasional</span>');
      metaEl.innerHTML = parts.join('');
    }

    /* ------------------------------------------------------------------
       REGULASI KUNCI
       ------------------------------------------------------------------ */
    var keysEl = $('[data-rg="keys"]');
    var keys = DATA.filter(function (r) { return r.kunci; }).sort(function (a, b) {
      return (jenisRank(a.jenis) - jenisRank(b.jenis)) || (year(a) - year(b));
    });

    function splitAbbr(s) {
      // "UU 1/1970" → ["UU", "1/1970"]; "Permen PUPR 10/2021" → ["Permen PUPR", "10/2021"]
      var str = String(s || '').trim();
      var m = /^(.*\S)\s+(\S*\d\S*)$/.exec(str);
      return m ? [m[1], m[2]] : ['', str];
    }

    if (keysEl) {
      if (!keys.length) {
        keysEl.closest('section').hidden = true;
      } else {
        var total = U.pad(keys.length);
        keysEl.setAttribute('data-reveal-stagger', '');
        keysEl.innerHTML = keys.map(function (r, i) {
          var ab = splitAbbr(r.singkatan);
          var lb = srcLabel(r);
          var src = isHttp(r.tautan)
            ? '<a class="icon-btn rg-key__src" href="' + h(r.tautan) + '" target="_blank" rel="noopener noreferrer" aria-label="' + lb.noun + ' ' + h(r.singkatan) + ' (tab baru)" title="' + lb.noun + ' · ' + h(hostOf(r.tautan)) + '">' + icon('external', { size: 18 }) + '</a>'
            : '';
          return '<article class="rg-key">' +
            '<div class="rg-key__top">' +
              '<span class="index-num">' + U.pad(i + 1) + ' <span>/ ' + total + '</span></span>' +
              '<span class="badge badge--' + tone(r.status) + '">' + h(r.status) + '</span>' +
            '</div>' +
            '<p class="rg-key__jenis">' + h(r.jenis) + ' · ' + h(r.tahun) + '</p>' +
            '<h3 class="rg-key__head">' +
              '<span class="rg-key__abbr">' + (ab[0] ? '<span class="rg-key__abbr-pre">' + h(ab[0]) + '</span> ' : '') + '<span class="rg-key__abbr-num">' + h(ab[1]) + '</span></span>' +
              '<span class="rg-key__title"' + langAttr(r) + '>' + h(r.judul) + '</span>' +
            '</h3>' +
            '<p class="rg-key__rel">' + h(r.relevansi) + '</p>' +
            '<p class="rg-key__inst">' + h(r.instansi) + '</p>' +
            '<div class="rg-key__foot">' +
              '<button type="button" class="btn btn--link btn--sm" data-rg-detail="' + h(r.id) + '" aria-haspopup="dialog"><span>Ringkasan</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '<span class="sr-only"> ' + h(r.singkatan) + '</span></button>' +
              src +
            '</div>' +
          '</article>';
        }).join('');
        ui.reveal(keysEl);
      }
    }

    function openDetail(r) {
      var kv = [
        ['Jenis', h(r.jenis)],
        ['Nomor', h(r.nomor)],
        ['Tahun', h(r.tahun)],
        ['Instansi', h(r.instansi)],
        ['Status', '<span class="badge badge--' + tone(r.status) + '">' + h(r.status) + '</span>']
      ].map(function (row) { return '<div class="kv__row"><dt>' + row[0] + '</dt><dd>' + row[1] + '</dd></div>'; }).join('');
      var lb = srcLabel(r);
      var link = isHttp(r.tautan)
        ? '<a class="btn btn--primary btn--sm" href="' + h(r.tautan) + '" target="_blank" rel="noopener noreferrer"><span>' + lb.open + '</span>' + icon('external', { size: 16, cls: 'btn__icon' }) + '<span class="sr-only"> (tab baru)</span></a>' +
          '<span class="rg-modal__host">' + h(hostOf(r.tautan)) + '</span>'
        : '<span class="rg-modal__host">' + lb.none + ' di pustaka ini.</span>';
      var note = isIntl(r)
        ? 'Ringkasan disusun untuk rujukan. Tautan mengarah ke halaman resmi penerbit standar; naskah lengkap dan edisi terbarunya tersedia melalui penerbit tersebut.'
        : 'Ringkasan disusun untuk rujukan; selalu periksa naskah resmi terbaru di JDIH instansi terkait.';
      var body =
        '<div class="rg-modal">' +
          '<p class="rg-modal__title"' + langAttr(r) + '>' + h(r.judul) + '</p>' +
          '<dl class="kv rg-modal__kv">' + kv + '</dl>' +
          '<div class="rg-modal__rel"><p class="rg-modal__label">Relevansi bagi pekerjaan perancah</p><p>' + h(r.relevansi) + '</p></div>' +
          '<div class="rg-modal__link">' + link + '</div>' +
          '<p class="rg-modal__note">' + note + '</p>' +
        '</div>';
      ui.modal({ title: r.singkatan, eyebrow: r.jenis, body: body, size: 'md', actions: [{ label: 'Tutup', variant: 'ghost' }] });
    }

    document.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-rg-detail]');
      if (!btn) return;
      var id = btn.getAttribute('data-rg-detail');
      var r = DATA.filter(function (x) { return x.id === id; })[0];
      if (r) openDetail(r);
    });

    /* ------------------------------------------------------------------
       PUSTAKA — state & URL
       ------------------------------------------------------------------ */
    var form = $('[data-rg="toolbar"]');
    if (!form) return;
    var qInput = $('#rg-q', form);
    var clearBtn = $('.search-box__clear', form);
    var statusSel = $('#rg-status', form);
    var sortSel = $('#rg-sort', form);
    var chipsEl = $('[data-rg="chips"]', form);
    var chipsIntlEl = $('[data-rg="chips-intl"]', form);
    var chipsetIntl = $('[data-rg="chipset-intl"]', form);
    var countEl = $('[data-rg="count"]');
    var resetBtn = $('[data-rg="reset"]');
    var resultsEl = $('[data-rg="results"]');
    var emptyEl = $('[data-rg="empty"]');
    var tbNas = $('[data-rg="tbody-nasional"]');
    var tbIntl = $('[data-rg="tbody-intl"]');

    statusSel.insertAdjacentHTML('beforeend', statusList.map(function (s) {
      return '<option value="' + h(s) + '">' + h(s) + '</option>';
    }).join(''));

    function fromSlug(list, v) {
      if (!v) return '';
      var s = U.slugify(v);
      return list.filter(function (x) { return U.slugify(x) === s; })[0] || '';
    }

    var state = {
      q: (U.qs('q') || '').slice(0, 120),
      jenis: fromSlug(jenisList, U.qs('jenis')),
      status: fromSlug(statusList, U.qs('status')),
      sort: SORTS.indexOf(U.qs('urut')) !== -1 ? U.qs('urut') : 'terbaru'
    };

    function syncUrl() {
      var params;
      try { params = new URLSearchParams(location.search); } catch (e) { return; }
      var set = function (k, v) { if (v) params.set(k, v); else params.delete(k); };
      set('q', state.q.trim());
      set('jenis', state.jenis ? U.slugify(state.jenis) : '');
      set('status', state.status ? U.slugify(state.status) : '');
      set('urut', state.sort !== 'terbaru' ? state.sort : '');
      var qs = params.toString();
      try { history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : '') + location.hash); } catch (e) { /* file:// */ }
    }

    /* ------------------------------------------------------------------
       Filtering
       ------------------------------------------------------------------ */
    function tokens() { return norm(state.q).split(/\s+/).filter(Boolean); }
    function matchQ(r, toks) {
      return toks.every(function (t) {
        if (r.__hay.indexOf(t) !== -1) return true;
        var st = squash(t);
        return !!st && r.__hayS.indexOf(st) !== -1;
      });
    }
    function baseFiltered() {
      var toks = tokens();
      return DATA.filter(function (r) {
        return (!state.status || r.status === state.status) && (!toks.length || matchQ(r, toks));
      });
    }
    function sortList(list) {
      var cmp = {
        terbaru: function (a, b) { return (year(b) - year(a)) || (jenisRank(a.jenis) - jenisRank(b.jenis)) || String(a.singkatan).localeCompare(b.singkatan, 'id'); },
        terlama: function (a, b) { return (year(a) - year(b)) || (jenisRank(a.jenis) - jenisRank(b.jenis)) || String(a.singkatan).localeCompare(b.singkatan, 'id'); },
        jenis: function (a, b) { return (jenisRank(a.jenis) - jenisRank(b.jenis)) || (year(b) - year(a)) || String(a.singkatan).localeCompare(b.singkatan, 'id'); }
      }[state.sort];
      return list.slice().sort(cmp);
    }

    /* highlight query words inside an (escaped) string */
    function hl(text) {
      var s = String(text == null ? '' : text);
      var toks = String(state.q || '').toLowerCase().split(/\s+/).filter(function (t) { return t.length >= 2; });
      if (!toks.length) return h(s);
      var lower = s.toLowerCase(), ranges = [];
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
        out += h(s.slice(pos, r[0])) + '<mark class="rg-hl">' + h(s.slice(r[0], r[1])) + '</mark>';
        pos = r[1];
      });
      return out + h(s.slice(pos));
    }

    /* ------------------------------------------------------------------
       Rendering
       ------------------------------------------------------------------ */
    function nomorLine(r) {
      if (isIntl(r) || r.jenis === 'SNI') return r.nomor + ' · ' + r.tahun;
      return 'Nomor ' + r.nomor + ' Tahun ' + r.tahun;
    }
    function instCell(inst) {
      var m = /^(.*?)\s*\((kini [^)]+)\)\s*$/i.exec(String(inst || ''));
      if (!m) return h(inst);
      return h(m[1]) + '<span class="table__muted">' + h(m[2].charAt(0).toUpperCase() + m[2].slice(1)) + '</span>';
    }
    function srcCell(r) {
      var lb = srcLabel(r);
      if (!isHttp(r.tautan)) {
        return '<span class="rg-src-none" aria-hidden="true">—</span><span class="sr-only">' + lb.none + '</span>';
      }
      var host = hostOf(r.tautan);
      return '<a class="rg-src" href="' + h(r.tautan) + '" target="_blank" rel="noopener noreferrer" title="' + lb.open + ' · ' + h(host) + '">' +
        '<span class="rg-src__icon">' + icon('external', { size: 18 }) + '</span>' +
        '<span class="rg-src__host">' + h(host) + '</span>' +
        '<span class="sr-only">' + lb.noun + ' ' + h(r.singkatan) + ' di ' + h(host) + ' (tab baru)</span>' +
      '</a>';
    }

    /* Mobile (< 768px) shows each document as a compact row — jenis, title, citation + status —
       with a "Ringkasan" disclosure (shared .accordion) holding relevansi, nomor, instansi and sumber.
       The disclosure cell is hidden from 768px up, where the table shows those columns.
       Open state survives re-renders: an explicit toggle wins; otherwise a row opens by itself while
       a search matches only inside its collapsed content, so the reader sees why it matched. */
    var userOpen = {};
    function hasMark(s) { return s.indexOf('<mark') !== -1; }
    function moreCell(r, visibleHtml) {
      var lb = srcLabel(r);
      var rid = 'reg-' + h(r.id);
      var src = isHttp(r.tautan)
        ? srcCell(r)
        : '<span class="rg-more__none">' + lb.none + '.</span>';
      var panel =
        '<p class="rg-more__rel">' + hl(r.relevansi) + '</p>' +
        '<dl class="rg-more__kv">' +
          '<div class="rg-more__row"><dt>Nomor / Tahun</dt><dd>' + hl(nomorLine(r)) + '</dd></div>' +
          '<div class="rg-more__row"><dt>Instansi</dt><dd>' + hl(r.instansi) + '</dd></div>' +
          '<div class="rg-more__row"><dt>' + lb.noun + '</dt><dd>' + src + '</dd></div>' +
        '</dl>';
      var open = Object.prototype.hasOwnProperty.call(userOpen, r.id)
        ? userOpen[r.id]
        : (!hasMark(visibleHtml) && hasMark(panel));
      return '<td class="rg-td-more accordion__item" data-label="">' +
        '<button type="button" class="accordion__trigger rg-more__trigger" id="' + rid + '-rt" data-rg-more="' + h(r.id) + '" aria-expanded="' + (open ? 'true' : 'false') + '">' +
          '<span class="rg-more__label">Ringkasan<span class="sr-only"> ' + h(r.singkatan) + '</span></span>' +
        '</button>' +
        '<div class="accordion__panel rg-more" id="' + rid + '-rp"' + (open ? '' : ' hidden') + '>' + panel + '</div>' +
      '</td>';
    }
    function rowHtml(r) {
      var cite = hl(r.singkatan), title = hl(r.judul);
      return '<tr class="rg-row' + (isIntl(r) ? ' rg-row--intl' : '') + '" id="reg-' + h(r.id) + '">' +
        '<td class="rg-td-jenis" data-label="Jenis"><span class="rg-jenis">' + (isIntl(r) ? icon('globe', { size: 15 }) : '') + h(r.jenis) + '</span></td>' +
        '<td class="rg-td-nomor" data-label="Nomor / Tahun"><span class="rg-jenis rg-jenis--inline" aria-hidden="true">' + (isIntl(r) ? icon('globe', { size: 14 }) : '') + h(r.jenis) + '</span><span class="rg-cite">' + cite + '</span><span class="table__muted">' + hl(nomorLine(r)) + '</span></td>' +
        '<td class="rg-td-judul" data-label="">' +
          '<span class="rg-title"' + langAttr(r) + '>' + title + '</span>' +
          (r.kunci ? ' <span class="badge badge--outline rg-keybadge" title="Termasuk Regulasi Kunci">Kunci</span>' : '') +
          '<span class="table__muted rg-rel">' + hl(r.relevansi) + '</span>' +
          '<span class="rg-inst-inline" aria-hidden="true">' + h(r.instansi) + '</span>' +
        '</td>' +
        '<td class="rg-td-instansi" data-label="Instansi">' + instCell(r.instansi) + '</td>' +
        '<td class="rg-td-status" data-label="Status"><span class="badge badge--' + tone(r.status) + '">' + h(r.status) + '</span></td>' +
        '<td class="rg-td-sumber" data-label="Sumber">' + srcCell(r) + '</td>' +
        moreCell(r, cite + title) +
      '</tr>';
    }
    function groupRow(kind, n) {
      var count = '<span class="rg-group__count">' + U.formatNumber(n) + ' dokumen</span>';
      if (kind === 'intl') {
        return '<tr class="rg-group-row rg-group-row--intl"><th colspan="6" scope="colgroup">' +
          '<div class="rg-group">' +
            '<span class="rg-group__icon">' + icon('globe', { size: 20 }) + '</span>' +
            '<span class="rg-group__text">' +
              '<span class="rg-group__title">Standar Internasional sebagai acuan teknis</span>' +
              '<span class="rg-group__note">Dirujuk sebagai acuan teknis dan pembanding praktik baik; bukan bagian dari peraturan perundang-undangan Republik Indonesia. Tautan mengarah ke halaman resmi penerbit masing-masing.</span>' +
            '</span>' + count +
          '</div></th></tr>';
      }
      return '<tr class="rg-group-row"><th colspan="6" scope="colgroup">' +
        '<div class="rg-group">' +
          '<span class="rg-group__icon">' + icon('scale', { size: 20 }) + '</span>' +
          '<span class="rg-group__text"><span class="rg-group__title">Regulasi &amp; standar nasional</span></span>' + count +
        '</div></th></tr>';
    }

    /* chips: built once, updated in place (keeps focus).
       National instruments in one set, international standards in their own labelled set. */
    function chipHtml(j) {
      var intl = j === INTL;
      return '<button type="button" class="chip' + (intl ? ' rg-chip--intl' : '') + '" data-jenis="' + h(j) + '" aria-pressed="false">' +
        (intl ? icon('globe', { size: 14 }) : '') + '<span>' + (j ? h(j) : 'Semua') + '</span> <span class="chip__count"></span>' +
      '</button>';
    }
    chipsEl.innerHTML = [''].concat(jenisList.filter(function (j) { return j !== INTL; })).map(chipHtml).join('');
    if (chipsIntlEl) {
      if (jenisList.indexOf(INTL) !== -1) chipsIntlEl.innerHTML = chipHtml(INTL);
      else if (chipsetIntl) chipsetIntl.hidden = true;
    }

    function updateChips(base) {
      U.$$('.chip', form).forEach(function (chip) {
        var j = chip.getAttribute('data-jenis');
        var n = j ? base.filter(function (r) { return r.jenis === j; }).length : base.length;
        var c = $('.chip__count', chip);
        c.textContent = U.formatNumber(n);
        chip.setAttribute('aria-label', (j || 'Semua jenis') + ', ' + n + ' dokumen');
        chip.setAttribute('aria-pressed', String(j === state.jenis));
        chip.classList.toggle('is-zero', n === 0 && j !== state.jenis);
      });
    }

    function render(opts) {
      opts = opts || {};
      var base = baseFiltered();
      updateChips(base);
      var list = sortList(base.filter(function (r) { return !state.jenis || r.jenis === state.jenis; }));
      var nas = list.filter(function (r) { return !isIntl(r); });
      var intl = list.filter(isIntl);

      tbNas.innerHTML = nas.length ? groupRow('nas', nas.length) + nas.map(rowHtml).join('') : '';
      tbIntl.innerHTML = intl.length ? groupRow('intl', intl.length) + intl.map(rowHtml).join('') : '';
      tbNas.hidden = !nas.length;
      tbIntl.hidden = !intl.length;

      var filtered = !!(state.q.trim() || state.jenis || state.status);
      resultsEl.hidden = !list.length;
      emptyEl.hidden = !!list.length;
      if (!list.length) {
        emptyEl.innerHTML = ui.emptyState({
          icon: 'search',
          title: 'Tidak ada regulasi yang sesuai',
          text: 'Coba kata kunci lain, pilih jenis “Semua”, atau ubah filter status.',
          actionHtml: '<button type="button" class="btn btn--ghost btn--sm" data-rg-reset><span>Atur ulang filter</span></button>'
        });
      }

      var q = state.q.trim();
      if (!filtered) {
        countEl.innerHTML = '<strong>' + U.formatNumber(DATA.length) + '</strong> dokumen dalam pustaka';
      } else {
        var desc = [];
        if (state.jenis) desc.push('jenis ' + h(state.jenis));
        if (state.status) desc.push('status ' + h(state.status));
        countEl.innerHTML = 'Menampilkan <strong>' + U.formatNumber(list.length) + '</strong> dari ' + U.formatNumber(DATA.length) + ' dokumen' +
          (q ? ' untuk “' + h(q) + '”' : '') + (desc.length ? ' · ' + desc.join(' · ') : '');
      }
      resetBtn.hidden = !filtered;
      clearBtn.hidden = !state.q;

      ui.reveal(resultsEl);
      ui.reveal(emptyEl);
      if (!opts.initial) syncUrl();
    }

    function resetFilters() {
      state.q = ''; state.jenis = ''; state.status = '';
      qInput.value = ''; statusSel.value = '';
      render();
    }

    /* a richer example placeholder where the search box is wide enough */
    var phShort = qInput.getAttribute('placeholder') || '';
    var phWide = qInput.getAttribute('data-placeholder-wide') || phShort;
    var mqWide = window.matchMedia ? window.matchMedia('(min-width: 1180px)') : null;
    function applyPlaceholder() { qInput.setAttribute('placeholder', mqWide && mqWide.matches ? phWide : phShort); }
    applyPlaceholder();
    if (mqWide) {
      if (mqWide.addEventListener) mqWide.addEventListener('change', applyPlaceholder);
      else if (mqWide.addListener) mqWide.addListener(applyPlaceholder);
    }

    /* initial control values */
    qInput.value = state.q;
    statusSel.value = state.status;
    sortSel.value = state.sort;

    /* events */
    form.addEventListener('submit', function (e) { e.preventDefault(); state.q = qInput.value; render(); });
    var onType = U.debounce(function () { state.q = qInput.value; render(); }, 180);
    qInput.addEventListener('input', function () { clearBtn.hidden = !qInput.value; onType(); });
    qInput.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && qInput.value) { e.preventDefault(); qInput.value = ''; state.q = ''; render(); }
    });
    statusSel.addEventListener('change', function () { state.status = statusSel.value; render(); });
    sortSel.addEventListener('change', function () { state.sort = sortSel.value; render(); });
    form.addEventListener('click', function (e) {
      var chip = e.target.closest('.chip');
      if (!chip) return;
      var j = chip.getAttribute('data-jenis');
      state.jenis = (j && j !== state.jenis) ? j : '';
      render();
    });
    /* remember explicit "Ringkasan" toggles (the accordion's own handler on the button runs first) */
    resultsEl.addEventListener('click', function (e) {
      var t = e.target.closest('[data-rg-more]');
      if (t) userOpen[t.getAttribute('data-rg-more')] = t.getAttribute('aria-expanded') === 'true';
    });
    resetBtn.addEventListener('click', function () { resetFilters(); qInput.focus(); });
    emptyEl.addEventListener('click', function (e) {
      if (e.target.closest('[data-rg-reset]')) { resetFilters(); qInput.focus(); }
    });

    render({ initial: true });

    /* deep link: when the page is opened with filters, bring the library into view */
    if ((state.q || state.jenis || state.status) && !location.hash) {
      var lib = document.getElementById('pustaka');
      if (lib) setTimeout(function () { lib.scrollIntoView({ block: 'start' }); }, 60);
    }
  });
})();
