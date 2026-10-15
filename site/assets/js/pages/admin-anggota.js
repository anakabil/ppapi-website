/* ==========================================================================
   PPAPI — admin-anggota.js  (Konsol Admin: Permohonan + Anggota)
   Queue of applications, member directory (search · filter · sort · CSV),
   the member detail drawer with every application field, and the decision
   dialogs: setujui (KTA), minta perbaikan, tolak, nonaktifkan, aktifkan
   kembali, perpanjang, ubah kategori. Depends on admin.js (window.PPAPI_KONSOL).
   ========================================================================== */
(function (w, d) {
  'use strict';

  var PPAPI = w.PPAPI;
  if (!PPAPI || !PPAPI.util) return;
  var K = w.PPAPI_KONSOL = w.PPAPI_KONSOL || { sections: {} };
  K.sections = K.sections || {};
  var util = PPAPI.util, ui = PPAPI.ui, h = util.h, icon = PPAPI.icon;
  function store() { return PPAPI.store; }
  function members() { return K.state.members || []; }
  function byUid(uid) { return members().filter(function (m) { return m.uid === uid; })[0] || null; }
  function typeLabel(m) { return m.application && m.application.type === 'perpanjangan' ? 'Perpanjangan' : 'Pendaftaran baru'; }
  function fold(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function matches(m, q) {
    if (!q) return true;
    var hay = fold([m.name, m.email, m.phone, util.formatPhoneID(m.phone), m.kta, m.profile.company, m.profile.position, m.profile.city, m.profile.province, m.memberType, m.application.kategori].join(' '));
    return fold(q).split(/\s+/).filter(Boolean).every(function (t) { return hay.indexOf(t) !== -1; });
  }
  function validityNote(m) {
    if (!m.validUntil) return '';
    var dd = util.daysUntil(m.validUntil);
    if (dd === null) return '';
    if (dd < 0) return 'berakhir ' + util.relativeTime(m.validUntil);
    if (dd === 0) return 'berakhir hari ini';
    if (dd <= util.RENEWAL_DAYS) return dd + ' hari lagi';
    return '';
  }
  /** Which kategori the console proposes when approving, and why.
      · Renewal / re-approval (approvedAt set): the category the member already holds. A different
        category on the form is a requested CHANGE that the admin must pick deliberately.
      · First application: what the applicant chose, only when applicants may choose it
        (store().APPLY_TYPES). Kehormatan is designated by the secretariat; a value written around the
        store (Firestore rules accept it) is flagged and never pre-selected.
      → { value, applied, change, invalid } (change/invalid hold the applied kategori, else '') */
  function kategoriPlan(m) {
    var applied = String((m.application && m.application.kategori) || '');
    var types = store().MEMBER_TYPES, apply = store().APPLY_TYPES || [];
    var held = types.indexOf(m.memberType) !== -1 ? m.memberType : 'Praktisi';
    var choosable = apply.indexOf(applied) !== -1;
    if (m.approvedAt) {
      var differs = !!applied && applied !== held;
      return { value: held, applied: applied, change: differs && choosable ? applied : '', invalid: differs && !choosable ? applied : '' };
    }
    if (!applied) return { value: held, applied: '', change: '', invalid: '' };
    return choosable
      ? { value: applied, applied: applied, change: '', invalid: '' }
      : { value: 'Praktisi', applied: applied, change: '', invalid: applied };
  }
  /** kategori as the secretariat should read it: held category (renewal), "Ahli → Praktisi" for a requested change */
  function kategoriText(m) {
    var pl = kategoriPlan(m);
    if (pl.change) return pl.value + ' → ' + pl.change;
    return m.approvedAt ? pl.value : (pl.applied || pl.value);
  }
  function kategoriNotice(m, inDialog) {
    var pl = kategoriPlan(m);
    if (pl.change) {
      return '<div class="alert alert--warn adm-kat-note">' + icon('info', { size: 18 }) + '<div><p class="alert__title">Pemohon mengajukan perubahan kategori: ' + h(pl.value) + ' → ' + h(pl.change) + '</p><p>' +
        (inDialog ? 'Kategori di bawah tetap ' + h(pl.value) + '. Pilih ' + h(pl.change) + ' hanya bila perubahan kategori disetujui.' : 'Kategori yang berlaku saat ini ' + h(pl.value) + '. Perubahan hanya terjadi bila admin memilih kategori baru saat menyetujui.') + '</p></div></div>';
    }
    if (pl.invalid) {
      return '<div class="alert alert--warn adm-kat-note">' + icon('alert-triangle', { size: 18 }) + '<div><p class="alert__title">Kategori ' + h(pl.invalid) + ' tidak dapat diajukan pemohon</p><p>' +
        'Kategori ini ditetapkan oleh sekretariat dan tidak tersedia di formulir pendaftaran. ' +
        (inDialog ? 'Kategori diusulkan ' + h(pl.value) + '; tetapkan kategori yang sesuai sebelum menyetujui.' : 'Saat menyetujui, tetapkan kategori yang sesuai.') + '</p></div></div>';
    }
    return '';
  }
  K.kategoriText = kategoriText;
  function kategoriCell(m) {
    var pl = kategoriPlan(m);
    /* first application: the cell already names the applied kategori; renewal: the cell names the held one */
    var warn = pl.invalid ? (m.approvedAt ? 'Meminta ' + pl.invalid + ' (tidak dapat diajukan pemohon)' : 'Tidak dapat diajukan pemohon') : '';
    return h(kategoriText(m)) +
      (warn ? '<span class="table__muted text-warn">' + h(warn) + '</span>' : '') +
      '<span class="table__muted">' + h(typeLabel(m) + (pl.change ? ' · ubah kategori' : '')) + '</span>';
  }
  function completeness(m) {
    var miss = store().applicationMissing(m);
    var docs = (m.application.dokumen || []).length, proj = (m.application.pengalaman || []).length;
    var meta = util.formatNumber(docs) + ' dokumen · ' + util.formatNumber(proj) + ' proyek';
    return miss.length
      ? '<span class="badge badge--warn">' + h(miss.length + ' data kurang') + '</span><span class="table__muted">' + h(meta) + '</span>'
      : '<span class="badge badge--ok">Lengkap</span><span class="table__muted">' + h(meta) + '</span>';
  }

  /* =====================================================================
     02 · PERMOHONAN
     ===================================================================== */
  var QUEUE = ['Menunggu Verifikasi', 'Perlu Perbaikan', 'Ditolak'];
  var PQ = { status: 'Menunggu Verifikasi', q: '' };
  K.sections.permohonan = {
    preset: function (p) { PQ.status = QUEUE.indexOf(p.status) !== -1 ? p.status : 'Menunggu Verifikasi'; PQ.q = ''; },
    render: function (body) {
      if (K.state.errors.members) { body.innerHTML = K.errorBox(K.state.errors.members, 'Data permohonan belum dapat dimuat'); return; }
      var all = members();
      var counts = {};
      QUEUE.forEach(function (s) { counts[s] = all.filter(function (m) { return K.eff(m) === s; }).length; });
      body.innerHTML =
        '<div class="adm-toolbar adm-toolbar--inline">' +
          K.chips({ label: 'Saring status permohonan', name: 'pq-status', value: PQ.status, items: QUEUE.map(function (s) { return { value: s, label: s, count: counts[s] }; }) }) +
          '<div class="adm-toolbar__row">' + K.searchBox({ id: 'pq-q', label: 'Cari pemohon', placeholder: 'Cari nama, email, HP, atau kota', value: PQ.q }) + '</div>' +
        '</div>' +
        '<div id="pq-list"></div>';
      var listEl = d.getElementById('pq-list');
      function paint() {
        var list = all.filter(function (m) { return K.eff(m) === PQ.status && matches(m, PQ.q); });
        if (PQ.status === 'Menunggu Verifikasi') list.sort(function (a, b) { return String(a.application.submittedAt).localeCompare(String(b.application.submittedAt)); });
        else list.sort(function (a, b) { return String(b.updatedAt).localeCompare(String(a.updatedAt)); });
        if (!list.length) {
          listEl.innerHTML = PQ.q
            ? K.empty({ icon: 'search', title: 'Tidak ada yang cocok', text: 'Ubah kata kunci pencarian untuk melihat pemohon lainnya.' })
            : K.empty({ icon: PQ.status === 'Menunggu Verifikasi' ? 'check-circle' : 'file-text', title: PQ.status === 'Menunggu Verifikasi' ? 'Antrean kosong' : 'Tidak ada pengajuan', text: { 'Menunggu Verifikasi': 'Semua formulir pendaftaran sudah ditinjau.', 'Perlu Perbaikan': 'Tidak ada pengajuan yang sedang dikembalikan kepada pemohon.', 'Ditolak': 'Belum ada pengajuan yang ditolak.' }[PQ.status] });
          return;
        }
        /* no Status column: every row has the status of the selected chip (named in the count line and
           the caption), so the column only cost width and wrapped the other cells */
        listEl.innerHTML = '<p class="adm-count">' + h(K.plural(list.length, 'pengajuan')) + ' · ' + h(PQ.status.toLowerCase()) + (PQ.status === 'Menunggu Verifikasi' ? ' · terlama di atas' : '') + '</p>' +
          '<div class="table-wrap"><table class="table adm-table adm-table--queue"><caption class="sr-only">Permohonan berstatus ' + h(PQ.status) + '</caption><thead><tr>' +
          '<th scope="col">Pemohon</th><th scope="col">Kategori</th><th scope="col">Diajukan</th><th scope="col">Kelengkapan</th><th scope="col"><span class="sr-only">Aksi</span></th></tr></thead><tbody>' +
          list.map(function (m) {
            var at = m.application.submittedAt;
            return '<tr><td>' + K.person(m, { open: 'member' }) + '</td>' +
              '<td data-label="Kategori">' + kategoriCell(m) + '</td>' +
              '<td data-label="Diajukan">' + K.timeTag(at) + (at ? '<span class="table__muted">' + h(K.rel(at)) + '</span>' : '') + '</td>' +
              '<td data-label="Kelengkapan">' + completeness(m) + '</td>' +
              '<td class="adm-table__actions"><button type="button" class="adm-act adm-act--strong" data-open="member" data-id="' + h(m.uid) + '"><span>Tinjau</span>' + icon('arrow-right', { size: 14 }) + '<span class="sr-only"> pengajuan ' + h(m.name) + '</span></button></td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      paint();
      K.bindChips(body, 'pq-status', function (v) { PQ.status = v; paint(); });
      K.bindSearch(body, 'pq-q', function (v) { PQ.q = v; paint(); });
    }
  };

  /* =====================================================================
     03 · ANGGOTA
     Rows render in pages of AQ_PAGE ("Tampilkan … lainnya" appends the next page into the same
     tbody), so a filter change at association scale (300+ accounts) never rebuilds hundreds of
     rows; the toolbar stays mounted and the search is debounced (K.bindSearch).
     ===================================================================== */
  var AQ_PAGE = 50;
  var AQ = { status: '', kategori: '', provinsi: '', sort: 'diperbarui', q: '', limit: AQ_PAGE, filtersOpen: false };
  var SORTS = [
    { value: 'diperbarui', label: 'Terakhir diperbarui' },
    { value: 'nama', label: 'Nama (A–Z)' },
    { value: 'berlaku', label: 'Masa berlaku terdekat' },
    { value: 'bergabung', label: 'Bergabung terbaru' }
  ];
  var collator = w.Intl && Intl.Collator ? new Intl.Collator('id', { sensitivity: 'base' }) : null;
  function byName(a, b) { return collator ? collator.compare(String(a.name || ''), String(b.name || '')) : String(a.name || '').localeCompare(String(b.name || '')); }
  function statusFilter(m, f) {
    if (!f) return true;
    var st = K.eff(m);
    if (f === 'segera') { var dd = util.validityDays(m); return st === 'Aktif' && dd !== null && dd <= util.RENEWAL_DAYS; }
    return f.split(',').indexOf(st) !== -1;
  }
  function memberRow(m) {
    var vn = validityNote(m);
    var region = [m.profile.city, m.profile.province].filter(Boolean).join(', ');
    var until = m.validUntil
      ? '<span class="table__muted">Berlaku s.d. ' + K.timeTag(m.validUntil) + (vn ? ' · <span class="' + (util.daysUntil(m.validUntil) < 0 ? 'text-err' : 'text-warn') + '">' + h(vn) + '</span>' : '') + '</span>'
      : '';
    return '<tr><td>' + K.person(m, { open: 'member', badges: K.adminBadge(m) }) + '</td>' +
      '<td data-label="KTA">' + (m.kta ? '<span class="adm-mono">' + h(m.kta) + '</span>' : '<span class="adm-dim">—</span>') + '</td>' +
      '<td data-label="Kategori">' + h(m.memberType) + (region ? '<span class="table__muted">' + h(region) + '</span>' : '') + '</td>' +
      '<td data-label="Status">' + K.statusBadge(m) + until + '</td>' +
      /* the name already opens the drawer: the row action is a square icon button from tablets up */
      '<td class="adm-table__actions"><button type="button" class="adm-act adm-act--icon adm-act--open" data-open="member" data-id="' + h(m.uid) + '" title="Detail">' + icon('arrow-right', { size: 15 }) +
        '<span class="adm-act__label">Detail<span class="sr-only"> ' + h(m.name) + '</span></span></button></td></tr>';
  }
  K.sections.anggota = {
    preset: function (p) { AQ.status = p.status || ''; AQ.kategori = ''; AQ.provinsi = ''; AQ.q = ''; AQ.limit = AQ_PAGE; },
    render: function (body) {
      if (K.state.errors.members) { body.innerHTML = K.errorBox(K.state.errors.members, 'Data anggota belum dapat dimuat'); return; }
      var all = members();
      var statusOpts = [{ value: '', label: 'Semua status' }].concat(K.STATUS_ORDER.map(function (s) { return { value: s, label: s }; }));
      statusOpts.splice(4, 0, { value: 'segera', label: 'Aktif · berakhir ≤ ' + util.RENEWAL_DAYS + ' hari' });
      if (AQ.status && !statusOpts.some(function (o) { return o.value === AQ.status; })) statusOpts.push({ value: AQ.status, label: AQ.status.split(',').join(' & ') });
      var provs = util.PROVINSI.filter(function (p) { return all.some(function (m) { return m.profile.province === p; }); });
      body.innerHTML =
        '<div class="adm-toolbar adm-toolbar--members">' +
          '<div class="adm-toolbar__row">' + K.searchBox({ id: 'aq-q', label: 'Cari anggota', placeholder: 'Cari nama, email, HP, KTA, atau kota', value: AQ.q }) +
            /* phones: the four selects fold behind this disclosure (hidden from tablets up, where they always show) */
            '<button type="button" class="btn btn--ghost btn--sm adm-filter-toggle" id="aq-filter-toggle" aria-expanded="' + (AQ.filtersOpen ? 'true' : 'false') + '" aria-controls="aq-filters">' +
              icon('filter', { size: 16 }) + '<span>Saring</span><span class="adm-filter-toggle__count" id="aq-filter-count" hidden></span>' + icon('chevron-down', { size: 16, cls: 'adm-filter-toggle__chev' }) + '</button>' +
            '<button type="button" class="btn btn--ghost btn--sm adm-export" id="aq-export">' + icon('download', { size: 16 }) + '<span>Ekspor CSV</span></button></div>' +
          '<div class="adm-toolbar__filters' + (AQ.filtersOpen ? '' : ' is-collapsed') + '" id="aq-filters" role="group" aria-label="Saringan direktori anggota">' +
            K.select({ id: 'aq-status', label: 'Status', value: AQ.status, options: statusOpts }) +
            K.select({ id: 'aq-kat', label: 'Kategori', value: AQ.kategori, options: [{ value: '', label: 'Semua kategori' }].concat(store().MEMBER_TYPES) }) +
            K.select({ id: 'aq-prov', label: 'Provinsi', value: AQ.provinsi, options: [{ value: '', label: 'Semua provinsi' }].concat(provs) }) +
            K.select({ id: 'aq-sort', label: 'Urutkan', value: AQ.sort, options: SORTS }) +
          '</div>' +
        '</div>' +
        '<div id="aq-list"></div>';
      var listEl = d.getElementById('aq-list');
      var current = [];
      function countText(shown) {
        var aktif = current.filter(function (m) { return K.eff(m) === 'Aktif'; }).length;
        return K.plural(current.length, 'akun') + ' · ' + util.formatNumber(aktif) + ' aktif' + (shown < current.length ? ' · menampilkan ' + util.formatNumber(shown) : '');
      }
      function moreHtml(shown) {
        var rest = current.length - shown;
        return rest > 0 ? '<p class="adm-more" id="aq-more-wrap"><button type="button" class="btn btn--ghost btn--sm" id="aq-more" aria-controls="aq-table"><span>Tampilkan ' + h(util.formatNumber(Math.min(AQ_PAGE, rest))) + ' lainnya</span><span class="adm-dim">(' + h(util.formatNumber(rest)) + ' lagi)</span></button></p>' : '';
      }
      function syncFilterCount() {
        var n = [AQ.status, AQ.kategori, AQ.provinsi].filter(Boolean).length;
        var c = d.getElementById('aq-filter-count');
        if (c) { c.hidden = !n; c.innerHTML = n ? h(util.formatNumber(n)) + '<span class="sr-only"> saringan aktif</span>' : ''; }
      }
      function paint() {
        var list = all.filter(function (m) {
          return statusFilter(m, AQ.status) && (!AQ.kategori || m.memberType === AQ.kategori) && (!AQ.provinsi || m.profile.province === AQ.provinsi) && matches(m, AQ.q);
        });
        list.sort(function (a, b) {
          if (AQ.sort === 'nama') return byName(a, b);
          if (AQ.sort === 'berlaku') return String(a.validUntil || '9999').localeCompare(String(b.validUntil || '9999')) || byName(a, b);
          if (AQ.sort === 'bergabung') return String(b.joinedAt).localeCompare(String(a.joinedAt));
          return String(b.updatedAt).localeCompare(String(a.updatedAt));
        });
        current = list;
        syncFilterCount();
        var exp = d.getElementById('aq-export');
        if (exp) exp.disabled = !list.length;
        if (!list.length) {
          listEl.innerHTML = K.empty({ icon: 'users', title: all.length ? 'Tidak ada yang cocok' : 'Belum ada akun', text: all.length ? 'Ubah kata kunci atau saringan untuk melihat anggota lainnya.' : 'Akun yang mendaftar di situs akan muncul di sini.' });
          return;
        }
        var shown = Math.min(list.length, Math.max(AQ_PAGE, AQ.limit));
        listEl.innerHTML = '<p class="adm-count">' + h(countText(shown)) + '</p>' +
          '<div class="table-wrap"><table class="table adm-table adm-table--members" id="aq-table"><caption class="sr-only">Direktori anggota</caption><thead><tr>' +
          '<th scope="col">Anggota</th><th scope="col">Nomor KTA</th><th scope="col">Kategori &amp; wilayah</th><th scope="col">Status &amp; masa berlaku</th><th scope="col"><span class="sr-only">Aksi</span></th></tr></thead><tbody>' +
          list.slice(0, shown).map(memberRow).join('') + '</tbody></table></div>' + moreHtml(shown);
      }
      function more() {
        var tbody = listEl.querySelector('tbody');
        if (!tbody) return;
        var from = tbody.rows.length;
        AQ.limit = from + AQ_PAGE;
        tbody.insertAdjacentHTML('beforeend', current.slice(from, AQ.limit).map(memberRow).join(''));
        var shown = tbody.rows.length;
        var cnt = listEl.querySelector('.adm-count');
        if (cnt) cnt.textContent = countText(shown);
        var wrap = d.getElementById('aq-more-wrap');
        if (wrap) {
          var html = moreHtml(shown);
          if (html) wrap.outerHTML = html; else wrap.remove();
        }
        /* keep the reader in place: focus the first newly shown record */
        var first = tbody.rows[from] && tbody.rows[from].querySelector('[data-open]');
        if (first) { try { first.focus({ preventScroll: false }); } catch (e) { first.focus(); } }
        K.announce('Menampilkan ' + util.formatNumber(shown) + ' dari ' + K.plural(current.length, 'akun') + '.');
      }
      function refilter() { AQ.limit = AQ_PAGE; paint(); }
      paint();
      listEl.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#aq-more')) more(); });
      K.bindSearch(body, 'aq-q', function (v) { AQ.q = v; refilter(); });
      [['aq-status', 'status'], ['aq-kat', 'kategori'], ['aq-prov', 'provinsi'], ['aq-sort', 'sort']].forEach(function (p) {
        d.getElementById(p[0]).addEventListener('change', function (e) { AQ[p[1]] = e.target.value; refilter(); K.announceCount(body); });
      });
      var toggle = d.getElementById('aq-filter-toggle'), panel = d.getElementById('aq-filters');
      toggle.addEventListener('click', function () {
        AQ.filtersOpen = !AQ.filtersOpen;
        toggle.setAttribute('aria-expanded', AQ.filtersOpen ? 'true' : 'false');
        panel.classList.toggle('is-collapsed', !AQ.filtersOpen);
      });
      d.getElementById('aq-export').addEventListener('click', function () {
        if (!current.length) return;
        var csv = store().admin.exportMembersCsv(current);
        K.download('anggota-ppapi-' + util.todayIso() + '.csv', csv, 'text/csv;charset=utf-8');
        ui.toast(K.plural(current.length, 'baris') + ' diekspor ke CSV (pemisah titik koma, siap dibuka di Excel).', { type: 'success' });
      });
    }
  };

  /* =====================================================================
     DETAIL DRAWER
     ===================================================================== */
  var HIST = {
    diajukan: ['Formulir diajukan', ''], ditarik: ['Pengajuan ditarik pemohon', ''], perbaikan: ['Perbaikan diminta', 'is-warn'],
    disetujui: ['Disetujui', ''], ditolak: ['Ditolak', 'is-error'], dinonaktifkan: ['Dinonaktifkan', 'is-error'],
    diaktifkan: ['Diaktifkan kembali', ''], diperpanjang: ['Masa berlaku diperpanjang', ''], 'kategori-diubah': ['Kategori diubah', '']
  };
  function kvRow(label, value, raw) {
    var v = raw ? value : h(value);
    return '<div class="kv__row"><dt>' + h(label) + '</dt><dd>' + (value === '' || value === null || value === undefined ? '<span class="adm-dim">—</span>' : v) + '</dd></div>';
  }
  function section(title, inner) { return '<div class="drawer__section"><h3 class="drawer__section-title">' + h(title) + '</h3>' + inner + '</div>'; }
  function memberMail(m) {
    var nama = String(m.name || '').replace(/\s*\(contoh\)\s*/i, ' ').trim() || 'Bapak/Ibu';
    var st = K.eff(m), body = 'Yth. ' + nama + ',\n\n', subject = 'Keanggotaan PPAPI — ' + nama;
    if (st === 'Perlu Perbaikan') { subject = 'Perbaikan Formulir Pendaftaran PPAPI'; body += 'Sekretariat telah meninjau formulir pendaftaran Anda dan memerlukan beberapa perbaikan:\n\n' + (m.review.note || '') + '\n\nSilakan masuk ke situs PPAPI, buka Formulir Pendaftaran, lakukan perbaikan, lalu ajukan kembali.'; }
    else if (st === 'Ditolak') { subject = 'Hasil Verifikasi Pendaftaran PPAPI'; body += 'Terima kasih atas minat Anda bergabung dengan PPAPI. Setelah peninjauan, pengajuan Anda belum dapat kami setujui dengan alasan berikut:\n\n' + (m.review.note || '') + '\n\nAnda dapat mengajukan kembali melalui Formulir Pendaftaran di situs PPAPI.'; }
    else if (st === 'Aktif') { subject = 'Keanggotaan PPAPI Anda Telah Aktif'; body += 'Selamat, keanggotaan Anda di PPAPI telah disetujui.\n\nNomor KTA: ' + (m.kta || '-') + '\nKategori: ' + m.memberType + '\nBerlaku hingga: ' + (m.validUntil ? util.formatDate(m.validUntil) : '-') + '\n\nKartu Tanda Anggota digital dan seluruh fitur anggota kini dapat diakses setelah Anda masuk ke situs PPAPI.'; }
    else if (st === 'Menunggu Verifikasi') { subject = 'Pengajuan Keanggotaan PPAPI'; body += 'Terima kasih, formulir pendaftaran Anda telah kami terima dan sedang diverifikasi oleh sekretariat.\n\n'; }
    else body += '\n\n';
    return K.mailto(m.email, subject, body + '\n\nHormat kami,\nSekretariat PPAPI');
  }
  function historyTrack(m) {
    var items = [];
    var created = m.createdAt || (m.joinedAt ? m.joinedAt + 'T00:00:00' : '');
    if (created) items.push({ at: created, label: 'Akun dibuat', cls: 'is-done', note: '' });
    var hist = (m.review.history || []).slice();
    if (m.application.submittedAt && !hist.some(function (x) { return x.action === 'diajukan'; })) hist.push({ at: m.application.submittedAt, action: 'diajukan', byName: m.name, note: '' });
    hist.sort(function (a, b) { return String(a.at).localeCompare(String(b.at)); });
    hist.forEach(function (x) {
      var def = HIST[x.action] || [x.action || 'Perubahan', ''];
      items.push({ at: x.at, label: def[0], cls: def[1] || 'is-done', note: x.note, by: x.byName && x.action !== 'diajukan' && x.action !== 'ditarik' ? x.byName : '' });
    });
    var st = K.eff(m);
    if (st === 'Menunggu Verifikasi') items.push({ at: '', label: 'Menunggu keputusan sekretariat', cls: 'is-current', note: '' });
    else if (st === 'Perlu Perbaikan') items.push({ at: '', label: 'Menunggu perbaikan dari pemohon', cls: 'is-current', note: '' });
    else if (st === 'Draf' && !m.application.submittedAt) items.push({ at: '', label: 'Formulir belum diajukan', cls: '', note: '' });
    else if (st === 'Kedaluwarsa') items.push({ at: m.validUntil, label: 'Masa berlaku berakhir', cls: 'is-error', note: '' });
    return '<ol class="status-track status-track--vertical adm-track">' + items.map(function (it, i) {
      var cur = it.cls === 'is-current';
      return '<li class="status-track__step ' + h(it.cls) + '"' + (cur ? ' aria-current="step"' : '') + '><span class="status-track__node" aria-hidden="true"></span>' +
        '<span class="status-track__label">' + h(it.label) + '</span>' +
        '<span class="status-track__meta">' + (it.at ? h(K.dateTime(it.at)) : '') + (it.by ? ' · ' + h(it.by) : '') + (it.note ? '<span class="adm-track__note">' + h(it.note) + '</span>' : '') + '</span></li>';
    }).join('') + '</ol>';
  }
  function photoHtml(m) {
    var a = m.application;
    return a.pasFoto
      ? '<img class="adm-dhead__photo" src="' + h(a.pasFoto) + '" alt="Pas foto ' + h(m.name) + '" width="96" height="128" decoding="async">'
      : '<span class="avatar avatar--lg adm-dhead__avatar" aria-hidden="true">' + h(K.initials(m.name || m.email)) + '</span>';
  }
  /* store.admin.listMembers() carries the image only for the review queue; any other record keeps
     application.pasFotoAda and its photo is read when the drawer opens (store.pasFoto), then kept on
     the listed record so a re-render or the next open does not read it again */
  function loadPhoto(m, api) {
    var a = m.application;
    if (a.pasFoto || !a.pasFotoAda || typeof store().pasFoto !== 'function') return;
    store().pasFoto(m.uid).then(function (data) {
      if (!data || !/^data:image\//.test(data)) return;
      a.pasFoto = data;
      if (!drawer || drawer.api !== api) return;
      var av = api.el.querySelector('.adm-dhead__avatar');
      if (av) av.outerHTML = photoHtml(m);
    }, function (err) { console.warn('[PPAPI] Pas foto belum dapat dimuat:', err && err.message); });
  }
  function memberBody(m) {
    var st = K.eff(m), a = m.application, p = m.profile;
    var photo = photoHtml(m);
    var mail = memberMail(m);
    var head = '<div class="adm-dhead">' + photo + '<div class="adm-dhead__text">' +
      '<div class="adm-badges">' + K.statusBadge(m) + K.adminBadge(m) + '<span class="badge badge--outline">' + h(m.approvedAt || st === 'Aktif' ? m.memberType : (a.kategori || m.memberType)) + '</span>' +
        (a.submittedAt ? '<span class="badge badge--muted">' + h(typeLabel(m)) + '</span>' : '') + util.contohBadge(m) + '</div>' +
      (m.kta ? '<p class="adm-dhead__kta"><span class="sr-only">Nomor KTA </span>' + h(m.kta) + '</p>' : '<p class="adm-dhead__kta adm-dim">KTA belum diterbitkan</p>') +
      '<p class="adm-dhead__contact">' + (m.email ? '<span class="adm-break">' + h(m.email) + '</span>' : '') + (m.phone ? '<span>' + h(util.formatPhoneID(m.phone) || m.phone) + '</span>' : '') + '</p>' +
      (mail ? '<p class="adm-dhead__cta"><a class="btn btn--ghost btn--sm" href="' + h(mail) + '">' + icon('mail', { size: 16 }) + '<span>Kirim email</span></a></p>' : '') +
      '</div></div>';
    var out = '<div class="drawer__section">' + head + '</div>';
    var note = m.review.note;
    if (note && ['Perlu Perbaikan', 'Ditolak', 'Nonaktif'].indexOf(st) !== -1) {
      out += '<div class="alert alert--' + (st === 'Perlu Perbaikan' ? 'warn' : 'err') + '">' + icon('alert-triangle', { size: 18 }) + '<div><p class="alert__title">' + h(st === 'Perlu Perbaikan' ? 'Catatan perbaikan untuk pemohon' : st === 'Ditolak' ? 'Alasan penolakan' : 'Catatan penonaktifan') + '</p><p>' + h(note) + '</p></div></div>';
    }
    if (['Menunggu Verifikasi', 'Perlu Perbaikan', 'Draf', 'Ditolak'].indexOf(st) !== -1) {
      out += kategoriNotice(m, false);
      var miss = store().applicationMissing(m);
      out += miss.length
        ? '<div class="alert alert--warn">' + icon('info', { size: 18 }) + '<div><p class="alert__title">' + h(st === 'Draf' ? 'Formulir belum lengkap' : miss.length + ' data belum lengkap') + '</p><p>' + h(miss.map(function (x) { return x.label; }).join(' · ')) + '</p></div></div>'
        : '<div class="alert alert--ok">' + icon('check-circle', { size: 18 }) + '<div><p>Seluruh data wajib formulir telah terisi.</p></div></div>';
    }
    if (m.approvedAt || m.kta && st !== 'Draf') {
      var vd = util.validityDays(m);
      out += section('Keanggotaan', '<dl class="kv adm-kv">' +
        kvRow('Nomor KTA', m.kta ? '<span class="adm-mono">' + h(m.kta) + '</span>' : '', true) +
        kvRow('Kategori', m.memberType) +
        kvRow('Bergabung', m.joinedAt ? util.formatDate(m.joinedAt) : '') +
        kvRow('Disetujui', m.approvedAt ? util.formatDate(m.approvedAt) : '') +
        kvRow('Berlaku hingga', m.validUntil ? h(util.formatDate(m.validUntil)) + (vd !== null ? ' <span class="adm-dim">(' + h(vd < 0 ? 'berakhir ' + util.relativeTime(m.validUntil) : vd + ' hari lagi') + ')</span>' : '') : '', true) +
        (m.kta && ['Aktif', 'Kedaluwarsa', 'Nonaktif'].indexOf(st) !== -1 ? kvRow('Verifikasi publik', '<a class="link" href="verifikasi.html?kta=' + encodeURIComponent(m.kta) + '" target="_blank" rel="noopener">Lihat entri verifikasi<span class="sr-only"> (membuka tab baru)</span></a>', true) : '') +
        '</dl>');
    }
    out += section('Pengajuan', '<dl class="kv adm-kv">' +
      kvRow('Jenis', a.submittedAt || a.kategori ? typeLabel(m) : '') +
      kvRow('Kategori diajukan', a.kategori) +
      kvRow('Diajukan', a.submittedAt ? util.formatDate(a.submittedAt, { time: true }) + ' (' + util.relativeTime(a.submittedAt) + ')' : 'Belum diajukan') +
      kvRow('Terakhir diubah', a.updatedAt ? util.formatDate(a.updatedAt, { time: true }) : '') +
      '</dl>');
    var born = [p.birthPlace, p.birthDate ? util.formatDate(p.birthDate) : ''].filter(Boolean).join(', ');
    out += section('Data diri', '<dl class="kv adm-kv">' +
      kvRow('Nama lengkap', m.name) + kvRow('Tempat, tanggal lahir', born) + kvRow('Jenis kelamin', p.gender) +
      kvRow('Email', m.email ? '<span class="adm-break">' + h(m.email) + '</span>' : '', true) + kvRow('Nomor HP', m.phone ? (util.formatPhoneID(m.phone) || m.phone) : '') +
      kvRow('Provinsi', p.province) + kvRow('Kota / kabupaten', p.city) + kvRow('Alamat', p.address) +
      '</dl>');
    var linkedin = /^https:\/\/[^\s<>"']+$/i.test(p.linkedin || '') ? '<a class="link adm-break" href="' + h(p.linkedin) + '" target="_blank" rel="noopener noreferrer">' + h(p.linkedin) + '</a>' : h(p.linkedin || '');
    var proj = (a.pengalaman || []).length
      ? '<ul class="adm-items" role="list">' + a.pengalaman.map(function (x) {
        return '<li><p class="adm-items__title">' + h(x.proyek || '(tanpa nama proyek)') + '</p><p class="adm-items__meta">' + h([x.peran, x.tahun, x.lokasi].filter(Boolean).join(' · ')) + '</p></li>';
      }).join('') + '</ul>'
      : '<p class="adm-dim">Belum ada riwayat proyek.</p>';
    out += section('Data profesional', '<dl class="kv adm-kv">' +
      kvRow('Perusahaan / instansi', p.company) + kvRow('Jabatan', p.position) + kvRow('Pendidikan terakhir', p.education) +
      kvRow('Pengalaman perancah', p.experienceYears === null || p.experienceYears === undefined ? '' : p.experienceYears + ' tahun') +
      (p.linkedin ? kvRow('LinkedIn', linkedin, true) : '') + (p.bio ? kvRow('Ringkasan', p.bio) : '') +
      '</dl><h4 class="adm-subtitle">Riwayat proyek</h4>' + proj);
    out += section('Kompetensi', (m.competencies || []).length
      ? '<ul class="adm-items" role="list">' + m.competencies.map(function (c) {
        return '<li><p class="adm-items__title">' + h(c.name || c.code) + '</p><p class="adm-items__meta">' + h([c.code, c.level, c.since ? 'sejak ' + c.since : ''].filter(Boolean).join(' · ')) + '</p>' + (c.notes ? '<p class="adm-items__note">' + h(c.notes) + '</p>' : '') + '</li>';
      }).join('') + '</ul>'
      : '<p class="adm-dim">Belum ada kompetensi yang dicatat.</p>');
    out += section('Sertifikat', (m.certificates || []).length
      ? '<ul class="adm-items" role="list">' + m.certificates.map(function (c) {
        var cs = util.certStatus(c.expiresAt);
        return '<li><div class="adm-items__row"><p class="adm-items__title">' + h(c.title) + '</p><span class="badge badge--' + h(cs.tone) + '">' + h(cs.label) + '</span></div>' +
          '<p class="adm-items__meta">' + h([c.issuer, c.number].filter(Boolean).join(' · ')) + '</p>' +
          '<p class="adm-items__meta">' + h([c.issuedAt ? 'Terbit ' + util.formatDate(c.issuedAt, { short: true }) : '', c.expiresAt ? 'berlaku s.d. ' + util.formatDate(c.expiresAt, { short: true }) : 'tanpa batas'].filter(Boolean).join(' · ')) + '</p>' +
          (c.link ? '<p><a class="link" href="' + h(c.link) + '" target="_blank" rel="noopener noreferrer">Lihat bukti sertifikat<span class="sr-only"> ' + h(c.title) + ' (membuka tab baru)</span></a></p>' : '') + '</li>';
      }).join('') + '</ul>'
      : '<p class="adm-dim">Belum ada sertifikat yang dicatat.</p>');
    out += section('Dokumen pendukung', (a.dokumen || []).length
      ? '<ul class="adm-docs" role="list">' + a.dokumen.map(function (x) {
        return '<li class="adm-docs__item"><span class="adm-docs__icon" aria-hidden="true">' + icon('file-text', { size: 18 }) + '</span><div class="adm-docs__text"><span class="tag">' + h(x.jenis) + '</span><p class="adm-docs__label">' + h(x.label || 'Dokumen') + '</p></div>' +
          (x.url ? '<a class="adm-act" href="' + h(x.url) + '" target="_blank" rel="noopener noreferrer"><span>Buka</span>' + icon('arrow-up-right', { size: 14 }) + '<span class="sr-only"> ' + h(x.label || x.jenis) + ' (membuka tab baru)</span></a>' : '<span class="adm-dim">Tanpa tautan</span>') + '</li>';
      }).join('') + '</ul><p class="adm-hint">' + icon('info', { size: 15 }) + '<span>Tautan dokumen diisi sendiri oleh pemohon. Periksa alamatnya sebelum membuka.</span></p>'
      : '<p class="adm-dim">Pemohon belum melampirkan tautan dokumen.</p>');
    var cfg = PPAPI.config || {};
    if ((cfg.iuran && cfg.iuran.aktif) || a.pembayaran.buktiUrl || a.pembayaran.metode) {
      out += section('Pembayaran iuran', '<dl class="kv adm-kv">' + kvRow('Metode', a.pembayaran.metode) + kvRow('Tanggal', a.pembayaran.tanggal ? util.formatDate(a.pembayaran.tanggal) : '') +
        kvRow('Bukti pembayaran', a.pembayaran.buktiUrl ? '<a class="link" href="' + h(a.pembayaran.buktiUrl) + '" target="_blank" rel="noopener noreferrer">Buka bukti<span class="sr-only"> (membuka tab baru)</span></a>' : '', true) + '</dl>');
    }
    var pn = a.pernyataan;
    function yes(v, label) { return '<li class="adm-pledge__item ' + (v ? 'is-yes' : 'is-no') + '">' + icon(v ? 'check-circle' : 'x-circle', { size: 18 }) + '<span>' + h(label) + '<span class="sr-only">' + (v ? ': disetujui' : ': belum disetujui') + '</span></span></li>'; }
    out += section('Pernyataan', '<ul class="adm-pledge" role="list">' +
      yes(pn.kodeEtik, 'Mematuhi Kode Etik serta AD/ART PPAPI') + yes(pn.kebenaranData, 'Data yang diisi benar dan dapat dipertanggungjawabkan') + yes(pn.privasi, 'Menyetujui Kebijakan Privasi') + '</ul>' +
      '<p class="adm-sign">' + (pn.namaTerang ? 'Ditandatangani <strong>' + h(pn.namaTerang) + '</strong>' + (pn.tanggal ? ' pada ' + h(util.formatDate(pn.tanggal)) : '') : '<span class="adm-dim">Belum ditandatangani</span>') + '</p>');
    if (a.catatan) out += section('Catatan pemohon', '<div class="adm-message">' + h(a.catatan) + '</div>');
    out += section('Riwayat', historyTrack(m));
    return out;
  }
  function eyebrowFor(m) {
    var st = K.eff(m);
    var kind = ['Menunggu Verifikasi', 'Perlu Perbaikan', 'Ditolak'].indexOf(st) !== -1 ? 'Permohonan' : (st === 'Draf' ? 'Akun' : 'Anggota');
    return kind + ' · ' + st + (m.contoh ? ' · Contoh' : '');
  }
  function memberActions(m) {
    var st = K.eff(m), stored = util.memberStatus(m);
    var A = {
      approve: { label: stored === 'Draf' ? 'Tetapkan Anggota' : 'Setujui', variant: 'primary', id: 'act-approve', onClick: function () { approveDialog(m); return false; } },
      revise: { label: stored === 'Perlu Perbaikan' ? 'Ubah Catatan' : 'Minta Perbaikan', variant: 'ghost', id: 'act-revise', onClick: function () { reviseDialog(m); return false; } },
      reject: { label: 'Tolak', variant: 'danger', id: 'act-reject', onClick: function () { rejectDialog(m); return false; } },
      deactivate: { label: 'Nonaktifkan', variant: 'danger', id: 'act-deactivate', onClick: function () { deactivateDialog(m); return false; } },
      reactivate: { label: 'Aktifkan Kembali', variant: 'primary', id: 'act-reactivate', onClick: function () { reactivateDialog(m); return false; } },
      extend: { label: 'Perpanjang', variant: 'primary', id: 'act-extend', onClick: function () { extendDialog(m); return false; } },
      type: { label: 'Ubah Kategori', variant: 'ghost', id: 'act-type', onClick: function () { typeDialog(m); return false; } },
      close: { label: 'Tutup', variant: 'ghost' }
    };
    if (stored === 'Menunggu Verifikasi') return [A.reject, A.revise, A.approve];
    if (stored === 'Perlu Perbaikan') return [A.reject, A.revise, A.approve];
    if (stored === 'Ditolak') return [A.close, A.approve];
    if (stored === 'Draf') return [A.close, A.approve];
    if (stored === 'Aktif') return [A.deactivate, A.type, A.extend];
    if (stored === 'Nonaktif') return [A.type, A.reactivate];
    return [A.close];
  }
  var drawer = null;
  K.openMember = function (uid) {
    var m = byUid(uid);
    if (!m) { ui.toast('Data akun tidak ditemukan. Muat ulang data.', { type: 'warn' }); return; }
    drawer = { uid: uid, api: null };
    var api = ui.drawer({
      title: m.name || m.email, eyebrow: eyebrowFor(m), size: 'lg', cls: 'adm-drawer adm-drawer--member',
      body: memberBody(m), actions: memberActions(m),
      onClose: function () {
        if (drawer && drawer.api === api) drawer = null;
        K.restoreFocus('[data-open="member"][data-id="' + (w.CSS && CSS.escape ? CSS.escape(uid) : uid) + '"]');
      }
    });
    drawer.api = api;
    api.el.setAttribute('data-member', uid);
    loadPhoto(m, api);
  };
  function refreshDrawer() {
    if (!drawer || !drawer.api) return;
    var m = byUid(drawer.uid);
    if (!m) { drawer.api.close(); return; }
    var api = drawer.api, scroll = api.body.scrollTop;
    api.setTitle(m.name || m.email);
    var eb = api.el.querySelector('.drawer__eyebrow');
    if (eb) eb.textContent = eyebrowFor(m);
    api.setBody(memberBody(m));
    api.setActions(memberActions(m));
    api.body.scrollTop = scroll;
    loadPhoto(m, api);
  }
  async function decided(message) {
    await K.after(['members'], message);
    refreshDrawer();
  }

  /* -------------------------------------------------------- dialogs */
  function who(m) { return '<div class="adm-who">' + K.person(m, { sub: kategoriText(m) + ' · ' + K.eff(m) }) + '</div>'; }
  var TEMPLATES = [
    'Lengkapi tautan dokumen pendukung (CV dan sertifikat) yang dapat dibuka.',
    'Perbarui sertifikat yang masa berlakunya telah habis.',
    'Lengkapi riwayat proyek di bidang perancah beserta peran Anda.',
    'Pastikan nama lengkap sesuai dokumen identitas.'
  ];
  function approveDialog(m) {
    var stored = util.memberStatus(m);
    var miss = store().applicationMissing(m);
    var keep = m.kta && m.approvedAt;
    var ktaInfo = keep
      ? 'Nomor KTA tetap <strong>' + h(m.kta) + '</strong>.'
      : 'Nomor KTA baru diterbitkan otomatis dengan format <strong>PPAPI-' + new Date().getFullYear() + '-NNNNNN</strong> (berurutan).';
    var intro = who(m) +
      (stored === 'Draf' ? '<div class="alert alert--warn">' + icon('info', { size: 18 }) + '<div><p class="alert__title">Penetapan langsung</p><p>Akun ini belum mengajukan formulir. Gunakan hanya untuk penetapan oleh sekretariat, misalnya anggota Kehormatan.</p></div></div>' : '') +
      (miss.length && stored !== 'Draf' ? '<div class="alert alert--warn">' + icon('alert-triangle', { size: 18 }) + '<div><p class="alert__title">Data belum lengkap</p><p>' + h(miss.map(function (x) { return x.label; }).join(' · ')) + '</p></div></div>' : '') +
      '<p class="adm-form__note">' + icon('id-card', { size: 16 }) + '<span>' + ktaInfo + ' Data publik terbatas (nama, kategori, kompetensi utama, kota, masa berlaku) tercantum di halaman Verifikasi Anggota.</span></p>';
    var today = util.todayIso();
    var plan = kategoriPlan(m);
    var flagged = plan.change || plan.invalid;
    intro += kategoriNotice(m, true);
    var fields = '<div class="form__row form__row--2">' +
      K.field({ name: 'memberType', label: 'Kategori keanggotaan', type: 'select', required: true, value: plan.value, options: store().MEMBER_TYPES,
        cls: flagged ? 'adm-field--attention' : '',
        hint: flagged ? 'Diajukan pemohon: <strong>' + h(flagged) + '</strong>' + (m.approvedAt ? ' · kategori saat ini: <strong>' + h(plan.value) + '</strong>' : '') + '.' : '' }) +
      K.field({ name: 'validUntil', label: 'Berlaku hingga', type: 'date', required: true, min: today, value: util.defaultValidUntil(), hint: 'Usulan: 31 Desember, ' + ((PPAPI.config && PPAPI.config.masaBerlakuTahun) || 3) + ' tahun ke depan.' }) +
      '</div>' +
      K.field({ name: 'note', label: 'Catatan untuk pemohon', type: 'textarea', rows: 3, maxlength: 2000, counter: true, optional: true, placeholder: 'Mis. Data lengkap dan sesuai.' });
    K.formDialog({
      title: stored === 'Draf' ? 'Tetapkan sebagai anggota' : (m.application.type === 'perpanjangan' ? 'Setujui perpanjangan' : 'Setujui pendaftaran'), eyebrow: m.name, size: 'md', intro: intro, fields: fields,
      submitLabel: keep ? 'Setujui & Perbarui Keanggotaan' : 'Setujui & Terbitkan KTA', submitId: 'dlg-approve-ok',
      submit: function (v) { return store().admin.approve(m.uid, { memberType: v.memberType, validUntil: v.validUntil, note: v.note }); }
    }).then(async function (res) {
      if (!res) return;
      await decided('Pendaftaran ' + (res.name || m.name) + ' disetujui. KTA ' + res.kta + '.');
      showKta(res);
    });
  }
  function showKta(m) {
    var mail = memberMail(m);
    ui.modal({
      title: 'Keanggotaan aktif', eyebrow: 'Disetujui', size: 'sm', cls: 'adm-modal adm-modal--kta',
      body: '<div class="adm-kta" id="adm-kta-result"><p class="adm-kta__label">Nomor Kartu Tanda Anggota</p><p class="adm-kta__num">' + h(m.kta) + '</p>' +
        '<p class="adm-kta__meta">' + h(m.name) + ' · ' + h(m.memberType) + '</p><p class="adm-kta__meta">Berlaku hingga ' + h(util.formatDate(m.validUntil)) + '</p></div>' +
        '<p>Status pemohon kini <strong>Aktif</strong>: seluruh fitur anggota terbuka dan entri verifikasi publik telah dibuat.</p>' +
        '<p class="adm-kta__links"><a class="link" href="verifikasi.html?kta=' + encodeURIComponent(m.kta) + '" target="_blank" rel="noopener">Lihat di halaman Verifikasi<span class="sr-only"> (membuka tab baru)</span></a>' +
        (mail ? '<a class="link" href="' + h(mail) + '">Kabari pemohon via email</a>' : '') + '</p>',
      actions: [
        { label: 'Salin Nomor KTA', variant: 'ghost', onClick: function () { util.copyText(m.kta).then(function (ok) { ui.toast(ok ? 'Nomor KTA disalin.' : 'Nomor KTA belum dapat disalin.', { type: ok ? 'success' : 'warn' }); }); return false; } },
        { label: 'Selesai', variant: 'primary', autofocus: true }
      ]
    });
  }
  function noteDialog(o) {
    var chips = o.templates ? '<div class="adm-templates" role="group" aria-label="Sisipkan catatan cepat">' + o.templates.map(function (t, i) {
      return '<button type="button" class="adm-template" data-template="' + i + '">' + icon('plus', { size: 14 }) + '<span>' + h(t) + '</span></button>';
    }).join('') + '</div>' : '';
    return K.formDialog({
      title: o.title, eyebrow: o.m.name, size: 'md', intro: who(o.m) + (o.text ? '<p>' + o.text + '</p>' : ''),
      fields: K.field({ name: 'note', label: o.label, type: 'textarea', rows: 5, required: !!o.required, optional: !o.required, minlength: o.required ? 5 : undefined, maxlength: 2000, counter: true, value: o.value || '', placeholder: o.placeholder || '', hint: o.hint }) + chips,
      submitLabel: o.submitLabel, submitVariant: o.variant || 'primary', submitId: o.submitId,
      onOpen: function (el, form) {
        util.$$('[data-template]', el).forEach(function (b) {
          b.addEventListener('click', function () {
            var ta = form.querySelector('textarea');
            var t = o.templates[Number(b.getAttribute('data-template'))];
            ta.value = (ta.value.trim() ? ta.value.trim() + '\n' : '') + '- ' + t;
            ta.dispatchEvent(new Event('input', { bubbles: true }));
            ta.focus();
          });
        });
      },
      submit: o.submit
    });
  }
  function reviseDialog(m) {
    var again = util.memberStatus(m) === 'Perlu Perbaikan';
    noteDialog({
      m: m, title: again ? 'Ubah catatan perbaikan' : 'Minta perbaikan', label: 'Catatan perbaikan untuk pemohon', required: true, value: again ? m.review.note : '',
      text: 'Status menjadi <strong>Perlu Perbaikan</strong>. Catatan tampil di dasbor dan formulir pemohon; pemohon dapat memperbaiki lalu mengajukan kembali.',
      placeholder: 'Jelaskan data atau dokumen yang perlu diperbaiki.', templates: TEMPLATES, submitLabel: again ? 'Simpan Catatan' : 'Kirim Permintaan Perbaikan', submitId: 'dlg-revise-ok',
      submit: function (v) { return store().admin.requestRevision(m.uid, v.note); }
    }).then(function (res) { if (res) decided('Permintaan perbaikan untuk ' + m.name + ' tersimpan. Catatan tampil di dasbor pemohon.'); });
  }
  function rejectDialog(m) {
    noteDialog({
      m: m, title: 'Tolak pengajuan', label: 'Alasan penolakan', required: true, variant: 'danger',
      text: 'Status menjadi <strong>Ditolak</strong>. Alasan ditampilkan kepada pemohon, yang tetap dapat mengajukan ulang di kemudian hari.',
      placeholder: 'Tuliskan alasan yang jelas dan santun.', submitLabel: 'Tolak Pengajuan', submitId: 'dlg-reject-ok',
      submit: function (v) { return store().admin.reject(m.uid, v.note); }
    }).then(function (res) { if (res) decided('Pengajuan ' + m.name + ' ditolak.'); });
  }
  function deactivateDialog(m) {
    noteDialog({
      m: m, title: 'Nonaktifkan keanggotaan', label: 'Alasan penonaktifan', required: false, variant: 'danger',
      text: 'Anggota akan kehilangan akses ke seluruh fitur anggota, dan entri verifikasi publik untuk <strong>' + h(m.kta || 'KTA ini') + '</strong> berstatus Nonaktif. Keanggotaan dapat diaktifkan kembali kapan saja.',
      placeholder: 'Mis. Belum memperbarui iuran tahunan.', submitLabel: 'Nonaktifkan', submitId: 'dlg-deactivate-ok',
      submit: function (v) { return store().admin.deactivate(m.uid, v.note); }
    }).then(function (res) { if (res) decided('Keanggotaan ' + m.name + ' dinonaktifkan.'); });
  }
  function laterDate(m) {
    var today = util.todayIso();
    return m.validUntil && m.validUntil > today ? m.validUntil : today;
  }
  function reactivateDialog(m) {
    var keep = m.validUntil && m.validUntil >= util.todayIso() ? m.validUntil : util.defaultValidUntil();
    K.formDialog({
      title: 'Aktifkan kembali', eyebrow: m.name, size: 'md',
      intro: who(m) + '<p>Status kembali <strong>Aktif</strong>' + (m.kta ? ' dengan nomor KTA <strong>' + h(m.kta) + '</strong>' : ' dan nomor KTA diterbitkan') + '. Entri verifikasi publik diperbarui.</p>',
      fields: K.field({ name: 'validUntil', label: 'Berlaku hingga', type: 'date', required: true, min: util.todayIso(), value: keep }) +
        K.field({ name: 'note', label: 'Catatan', type: 'textarea', rows: 3, maxlength: 2000, counter: true, optional: true }),
      submitLabel: 'Aktifkan Kembali', submitId: 'dlg-reactivate-ok',
      submit: function (v) { return store().admin.reactivate(m.uid, { validUntil: v.validUntil, note: v.note }); }
    }).then(function (res) { if (res) decided('Keanggotaan ' + m.name + ' aktif kembali.'); });
  }
  function extendDialog(m) {
    var vd = util.validityDays(m);
    K.formDialog({
      title: 'Perpanjang masa berlaku', eyebrow: m.name, size: 'md',
      intro: who(m) + '<p>Masa berlaku saat ini: <strong>' + h(m.validUntil ? util.formatDate(m.validUntil) : 'tanpa batas') + '</strong>' + (vd !== null ? ' (' + h(vd < 0 ? 'berakhir ' + util.relativeTime(m.validUntil) : vd + ' hari lagi') + ')' : '') + '. Status tetap Aktif dan entri verifikasi publik ikut diperbarui.</p>',
      fields: K.field({ name: 'validUntil', label: 'Berlaku hingga', type: 'date', required: true, min: util.todayIso(), value: util.defaultValidUntil(laterDate(m)) }) +
        K.field({ name: 'note', label: 'Catatan', type: 'textarea', rows: 3, maxlength: 2000, counter: true, optional: true, placeholder: 'Mis. Iuran periode berikutnya telah diterima.' }),
      submitLabel: 'Simpan Perpanjangan', submitId: 'dlg-extend-ok',
      extraCheck: function (el, v) { return el.name === 'validUntil' && m.validUntil && v && v <= m.validUntil && util.daysUntil(m.validUntil) >= 0 ? 'Pilih tanggal setelah ' + util.formatDate(m.validUntil) + '.' : ''; },
      submit: function (v) { return store().admin.extend(m.uid, v.validUntil, v.note); }
    }).then(function (res) { if (res) decided('Masa berlaku ' + m.name + ' diperpanjang hingga ' + util.formatDate(res.validUntil) + '.'); });
  }
  function typeDialog(m) {
    K.formDialog({
      title: 'Ubah kategori', eyebrow: m.name, size: 'sm',
      intro: '<p>Kategori saat ini: <strong>' + h(m.memberType) + '</strong>.' + (util.memberStatus(m) === 'Aktif' ? ' Kategori pada entri verifikasi publik ikut diperbarui.' : '') + '</p>',
      fields: K.field({ name: 'memberType', label: 'Kategori baru', type: 'select', required: true, value: m.memberType, options: store().MEMBER_TYPES }),
      submitLabel: 'Simpan Kategori', submitId: 'dlg-type-ok',
      extraCheck: function (el, v) { return el.name === 'memberType' && v === m.memberType ? 'Pilih kategori yang berbeda dari kategori saat ini.' : ''; },
      submit: function (v) { return store().admin.setMemberType(m.uid, v.memberType); }
    }).then(function (res) { if (res) decided('Kategori ' + m.name + ' diubah menjadi ' + res.memberType + '.'); });
  }
})(window, document);
