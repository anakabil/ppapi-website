/* ==========================================================================
   PPAPI — admin-konten.js  (Konsol Admin: Konten)
   Sub-tabs Berita · Pengumuman · Agenda · Produk Pengetahuan · Regulasi
   (#konten/<jenis>). Lists static (Bawaan) + admin-managed (Dikelola) items
   from PPAPI.store.content.list(type, {includeHidden}), create/edit forms that
   follow the SPEC data shapes, hide/restore static items, delete managed ones.
   Depends on admin.js (window.PPAPI_KONSOL).
   ========================================================================== */
(function (w, d) {
  'use strict';

  var PPAPI = w.PPAPI;
  if (!PPAPI || !PPAPI.util) return;
  var K = w.PPAPI_KONSOL = w.PPAPI_KONSOL || { sections: {} };
  K.sections = K.sections || {};
  var util = PPAPI.util, ui = PPAPI.ui, h = util.h, icon = PPAPI.icon;
  function store() { return PPAPI.store; }

  var TYPES = [
    { key: 'berita', label: 'Berita', one: 'berita', icon: 'file-text', add: 'Tambah Berita' },
    { key: 'pengumuman', label: 'Pengumuman', one: 'pengumuman', icon: 'bell', add: 'Tambah Pengumuman' },
    { key: 'agenda', label: 'Agenda', one: 'agenda', icon: 'calendar', add: 'Tambah Agenda' },
    { key: 'pustaka', label: 'Produk Pengetahuan', one: 'produk pengetahuan', icon: 'book', add: 'Tambah Dokumen' },
    { key: 'regulasi', label: 'Regulasi', one: 'regulasi', icon: 'scale', add: 'Tambah Regulasi' }
  ];
  function typeOf(key) { return TYPES.filter(function (t) { return t.key === key; })[0] || TYPES[0]; }
  var BERITA_KATEGORI = ['Kegiatan', 'Pengumuman', 'Edukasi', 'Regulasi', 'Organisasi'];
  var AGENDA_JENIS = ['Pelatihan', 'Sertifikasi', 'Seminar', 'Webinar', 'Rapat', 'Kunjungan Teknis'];
  var AGENDA_MODE = ['Luring', 'Daring', 'Hybrid'];
  var REG_JENIS = ['Undang-Undang', 'Peraturan Pemerintah', 'Peraturan Menteri', 'Keputusan Menteri', 'Surat Edaran', 'SNI', 'Standar Internasional'];
  var REG_STATUS = ['Berlaku', 'Berlaku (diubah)', 'Dicabut'];
  var IMAGES = [
    { value: '', label: 'Tanpa gambar' },
    { value: 'assets/img/stair-tower.webp', label: 'Menara tangga perancah' },
    { value: 'assets/img/facade-bw.webp', label: 'Perancah fasad (hitam-putih)' },
    { value: 'assets/img/stage-silhouette.webp', label: 'Siluet perancah panggung' },
    { value: 'assets/img/tower-heritage.webp', label: 'Menara bersejarah berperancah' },
    { value: 'assets/img/ringlock-pattern.webp', label: 'Pola perancah sistem ringlock' }
  ];

  var KT = { type: 'berita', q: '', source: '' };
  var cache = {};
  var loading = {};
  async function loadType(type) {
    try {
      cache[type] = await store().content.list(type, { includeHidden: true, fresh: true });
      delete K.state.errors['konten:' + type];
    } catch (err) {
      console.error(err);
      K.state.errors['konten:' + type] = err;
      cache[type] = cache[type] || [];
    }
  }
  function loadAll() {
    return Promise.all(TYPES.map(function (t) {
      if (!loading[t.key]) loading[t.key] = loadType(t.key).then(function () { loading[t.key] = null; });
      return loading[t.key];
    }));
  }

  /* ------------------------------------------------------------ rows */
  function sourceBadge(it) {
    if (it.hidden) return '<span class="badge badge--muted adm-src adm-src--hidden">' + icon('eye-off', { size: 12 }) + 'Disembunyikan</span>';
    if (it._static && it._managed) return '<span class="badge badge--outline adm-src">Bawaan · Diubah</span>';
    if (it._static) return '<span class="badge badge--muted adm-src">Bawaan</span>';
    return '<span class="badge badge--solid adm-src">Dikelola</span>';
  }
  function regTone(s) { return s === 'Berlaku' ? 'ok' : s === 'Dicabut' ? 'err' : 'warn'; }
  function pusTone(s) { return s === 'Berlaku' ? 'ok' : s === 'Draf' ? 'muted' : 'warn'; }
  function cols(type, it) {
    switch (type) {
      case 'berita': return {
        title: it.judul, sub: it.ringkasan,
        c2l: 'Kategori', c2: '<span class="tag">' + h(it.kategori) + '</span>' + (it.sorot ? ' <span class="badge badge--outline">Sorotan</span>' : ''),
        c3l: 'Tanggal', c3: K.timeTag(it.tanggal)
      };
      case 'pengumuman': return {
        title: it.judul, sub: it.isi,
        c2l: 'Sifat', c2: it.penting ? '<span class="badge badge--warn">Penting</span>' : '<span class="adm-dim">Biasa</span>',
        c3l: 'Tanggal', c3: K.timeTag(it.tanggal)
      };
      case 'agenda': {
        var past = (it.selesai || it.mulai) < util.todayIso();
        return {
          title: it.judul, sub: [it.lokasi, it.waktu].filter(Boolean).join(' · '),
          c2l: 'Jenis', c2: '<span class="tag">' + h(it.jenis) + '</span><span class="table__muted">' + h(it.mode || '') + '</span>',
          c3l: 'Jadwal', c3: '<time datetime="' + h(it.mulai) + '">' + h(util.formatDateRange(it.mulai, it.selesai, { short: true })) + '</time>' + (past ? '<span class="table__muted">Telah berlangsung</span>' : '')
        };
      }
      case 'pustaka': return {
        title: it.judul, sub: [it.kode, it.versi, it.format].filter(Boolean).join(' · ') || it.ringkasan,
        c2l: 'Kategori', c2: '<span class="tag">' + h(it.kategori) + '</span>',
        c3l: 'Status', c3: '<span class="adm-stack"><span class="badge badge--' + pusTone(it.status) + '">' + h(it.status) + '</span><span class="badge badge--outline">' + (it.akses === 'publik' ? 'Publik' : 'Khusus anggota') + '</span>' + (it.berkasAnggota ? '<span class="table__muted">Berkas anggota tersimpan</span>' : '') + '</span>'
      };
      default: return {
        title: (it.singkatan ? it.singkatan + ' — ' : '') + it.judul, sub: it.instansi,
        c2l: 'Jenis', c2: '<span class="tag">' + h(it.jenis) + '</span>' + (it.kunci ? ' <span class="badge badge--outline">Kunci</span>' : ''),
        c3l: 'Status', c3: '<span class="badge badge--' + regTone(it.status) + '">' + h(it.status) + '</span>'
      };
    }
  }
  function publicLink(type, it) {
    if (it.hidden) return '';
    if (type === 'berita') return 'berita.html?id=' + encodeURIComponent(it.id);
    if (type === 'agenda') return 'agenda.html?id=' + encodeURIComponent(it.id);
    return '';
  }
  function actions(type, it) {
    var id = h(it.id), name = h(cols(type, it).title);
    /* icon buttons on desktop (label visually hidden, shown as tooltip), icon + label on phones */
    var b = function (act, label, cls, ic) { return '<button type="button" class="adm-act adm-act--icon' + (cls ? ' ' + cls : '') + '" data-content-act="' + act + '" data-id="' + id + '" title="' + label + '">' + (ic ? icon(ic, { size: 15 }) : '') + '<span class="adm-act__label">' + label + '<span class="sr-only"> ' + name + '</span></span></button>'; };
    var out = [];
    if (it.hidden) out.push(b('restore', 'Tampilkan lagi', 'adm-act--strong', 'eye'));
    else {
      out.push(b('edit', 'Ubah', 'adm-act--strong', 'edit'));
      if (it._static && it._managed) out.push(b('restore', 'Kembalikan bawaan', '', 'refresh'));
      out.push(it._static ? b('hide', 'Sembunyikan', '', 'eye-off') : b('delete', 'Hapus', 'adm-act--danger', 'trash'));
      var link = publicLink(type, it);
      if (link) out.push('<a class="adm-act adm-act--icon" href="' + h(link) + '" target="_blank" rel="noopener" title="Lihat di situs">' + icon('arrow-up-right', { size: 15 }) + '<span class="adm-act__label">Lihat<span class="sr-only"> ' + name + ' di situs (membuka tab baru)</span></span></a>');
    }
    return '<div class="adm-acts adm-acts--icons">' + out.join('') + '</div>';
  }
  function matches(it, q) {
    if (!q) return true;
    var hay = [it.id, it.judul, it.ringkasan, it.isi, it.kategori, it.jenis, it.kode, it.singkatan, it.instansi, it.lokasi, it.nomor].join(' ').toLowerCase();
    return q.toLowerCase().split(/\s+/).filter(Boolean).every(function (t) { return hay.indexOf(t) !== -1; });
  }
  function sourceOf(it) { return it.hidden ? 'tersembunyi' : it._static && it._managed ? 'diubah' : it._static ? 'bawaan' : 'dikelola'; }

  /* ------------------------------------------------------------ section */
  K.sections.konten = {
    preset: function (p) { if (p.type) KT.type = typeOf(p.type).key; },
    render: function (body, sub) {
      var t = typeOf(sub && TYPES.some(function (x) { return x.key === sub; }) ? sub : KT.type);
      KT.type = t.key;
      if (sub !== t.key) K.setSub('konten', t.key);
      var have = TYPES.every(function (x) { return cache[x.key]; });
      var countOf = function (k) { return cache[k] ? cache[k].filter(function (x) { return !x.hidden; }).length : null; };
      body.innerHTML =
        '<nav class="adm-subnav" aria-label="Jenis konten"><ul class="adm-subnav__list" role="list">' + TYPES.map(function (x) {
          var n = countOf(x.key);
          return '<li><a class="adm-subnav__link" href="#konten/' + x.key + '" data-type="' + x.key + '"' + (x.key === t.key ? ' aria-current="page"' : '') + '>' + icon(x.icon, { size: 16 }) + '<span>' + h(x.label) + '</span>' +
            (n !== null ? '<span class="adm-subnav__count">' + h(util.formatNumber(n)) + '<span class="sr-only"> tampil</span></span>' : '') + '</a></li>';
        }).join('') + '</ul></nav>' +
        /* one demo notice per screen: from 1200 px the console rail already carries it (adm-nav__foot), so this
           line shows only where the rail is a tab strip */
        (K.isDemo() ? '<p class="adm-hint adm-demo-note">' + icon('info', { size: 15 }) + '<span><strong>Mode Demo.</strong> Perubahan konten hanya tersimpan di peramban ini dan tidak terlihat oleh pengunjung lain.</span></p>' : '') +
        /* sejak 21 Oktober 2026 kegiatan dengan pendaftaran dikelola di bagian Kegiatan; editor ini tetap untuk jadwal saja */
        (t.key === 'agenda' ? '<p class="adm-hint adm-legacy-note">' + icon('calendar', { size: 15 }) + '<span><strong>Agenda sederhana (lama).</strong> Hanya pengumuman jadwal, tanpa pendaftaran. Untuk webinar, pelatihan, atau seminar dengan pendaftaran peserta, daftar hadir, dan sertifikat, gunakan bagian <a class="link" href="#kegiatan">Kegiatan</a>.</span></p>' : '') +
        '<div class="adm-toolbar">' +
          '<div class="adm-toolbar__row">' + K.searchBox({ id: 'kt-q', label: 'Cari ' + t.label.toLowerCase(), placeholder: 'Cari judul, kategori, atau kata kunci', value: KT.q }) +
            K.select({ id: 'kt-src', label: 'Sumber', srLabel: true, value: KT.source, options: [{ value: '', label: 'Semua sumber' }, { value: 'bawaan', label: 'Bawaan' }, { value: 'diubah', label: 'Bawaan · Diubah' }, { value: 'dikelola', label: 'Dikelola' }, { value: 'tersembunyi', label: 'Disembunyikan' }] }) +
            '<button type="button" class="btn btn--primary btn--sm adm-new" id="kt-add">' + icon('plus', { size: 16 }) + '<span>' + h(t.add) + '</span></button></div>' +
        '</div>' +
        '<div id="kt-list">' + (cache[t.key] ? '' : '<div class="skeleton" role="status"><span class="sr-only">Memuat konten…</span><span class="skeleton__line"></span><span class="skeleton__line"></span><span class="skeleton__line"></span></div>') + '</div>';
      var listEl = d.getElementById('kt-list');
      function paint() {
        var err = K.state.errors['konten:' + t.key];
        if (err) { listEl.innerHTML = K.errorBox(err, 'Konten belum dapat dimuat'); return; }
        var all = cache[t.key] || [];
        var list = all.filter(function (it) { return (!KT.source || sourceOf(it) === KT.source) && matches(it, KT.q); });
        if (!list.length) {
          listEl.innerHTML = K.empty({ icon: t.icon, title: all.length ? 'Tidak ada yang cocok' : 'Belum ada ' + t.one, text: all.length ? 'Ubah kata kunci atau saringan sumber.' : 'Tambahkan ' + t.one + ' pertama dengan tombol di atas.' });
          return;
        }
        var managed = all.filter(function (x) { return x._managed; }).length, hidden = all.filter(function (x) { return x.hidden; }).length;
        var sample = cols(t.key, list[0]);
        listEl.innerHTML = '<p class="adm-count">' + h(K.plural(list.length, 'item')) + ' · ' + h(util.formatNumber(managed)) + ' dikelola' + (hidden ? ' · ' + h(util.formatNumber(hidden)) + ' disembunyikan' : '') + '</p>' +
          '<div class="table-wrap"><table class="table adm-table adm-table--content"><caption class="sr-only">Daftar ' + h(t.label.toLowerCase()) + '</caption><thead><tr>' +
          '<th scope="col">Judul</th><th scope="col">' + h(sample.c2l) + '</th><th scope="col">' + h(sample.c3l) + '</th><th scope="col">Sumber</th><th scope="col"><span class="sr-only">Aksi</span></th></tr></thead><tbody>' +
          list.map(function (it) {
            var c = cols(t.key, it);
            return '<tr' + (it.hidden ? ' class="is-hidden"' : '') + ' data-row="' + h(it.id) + '"><td><span class="adm-row-title">' + h(c.title) + '</span>' + util.contohBadge(it) +
              (c.sub ? '<span class="table__muted adm-clamp">' + h(c.sub) + '</span>' : '') + '</td>' +
              '<td data-label="' + h(c.c2l) + '">' + c.c2 + '</td><td data-label="' + h(c.c3l) + '">' + c.c3 + '</td>' +
              '<td data-label="Sumber">' + sourceBadge(it) + '</td>' +
              '<td class="adm-table__actions">' + actions(t.key, it) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      }
      if (cache[t.key]) paint();
      if (!have) loadAll().then(function () { if (K.route.section === 'konten') K.renderCurrent(); });
      K.bindSearch(body, 'kt-q', function (v) { KT.q = v; paint(); });
      d.getElementById('kt-src').addEventListener('change', function (e) { KT.source = e.target.value; paint(); K.announceCount(body); });
      d.getElementById('kt-add').addEventListener('click', function () { editDialog(t.key, null); });
      util.$$('.adm-subnav__link', body).forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          if (a.getAttribute('data-type') === KT.type) return;
          KT.type = a.getAttribute('data-type'); KT.q = ''; KT.source = '';
          K.setSub('konten', KT.type);
          K.renderCurrent();
          var cur = d.querySelector('.adm-subnav__link[aria-current="page"]');
          if (cur) cur.focus();
        });
      });
      listEl.addEventListener('click', function (e) {
        var btn = e.target.closest('[data-content-act]');
        if (!btn) return;
        var it = (cache[t.key] || []).filter(function (x) { return x.id === btn.getAttribute('data-id'); })[0];
        if (!it) return;
        var act = btn.getAttribute('data-content-act');
        if (act === 'edit') editDialog(t.key, it);
        else if (act === 'hide' || act === 'delete') removeItem(t.key, it, btn);
        else if (act === 'restore') restoreItem(t.key, it, btn);
      });
    }
  };

  /** title of a content item from the loaded lists (used by the activity log for id-only entries) */
  K.contentTitle = function (type, id) {
    var it = (cache[type] || []).filter(function (x) { return x.id === id; })[0];
    return it ? titleOf(type, it) : '';
  };
  async function afterContent(type, msg) {
    await loadType(type);
    await K.after([], msg);
  }
  function titleOf(type, it) { return cols(type, it).title || it.id; }
  async function removeItem(type, it, btn) {
    var t = typeOf(type), name = titleOf(type, it);
    var ok = await ui.confirm(it._static
      ? 'Sembunyikan "' + name + '" dari situs? Konten bawaan tidak dihapus dari berkas data dan dapat ditampilkan lagi kapan saja.'
      : 'Hapus "' + name + '" secara permanen? Tindakan ini tidak dapat dibatalkan.', { title: it._static ? 'Sembunyikan ' + t.one : 'Hapus ' + t.one, okLabel: it._static ? 'Ya, sembunyikan' : 'Ya, hapus', danger: true });
    if (!ok) return;
    ui.setLoading(btn, true, '');
    try {
      await store().content.remove(type, it.id);
      await afterContent(type, it._static ? '"' + name + '" disembunyikan dari situs.' : '"' + name + '" dihapus.');
    } catch (err) {
      ui.setLoading(btn, false);
      ui.toast(err.message || 'Konten belum dapat diubah.', { type: 'error' });
    }
  }
  async function restoreItem(type, it, btn) {
    var name = titleOf(type, it);
    if (!it.hidden) {
      var ok = await ui.confirm('Kembalikan "' + name + '" ke versi bawaan? Perubahan yang Anda simpan untuk item ini akan dibuang.', { title: 'Kembalikan versi bawaan', okLabel: 'Ya, kembalikan' });
      if (!ok) return;
    }
    ui.setLoading(btn, true, '');
    try {
      await store().content.restore(type, it.id);
      await afterContent(type, it.hidden ? '"' + name + '" kembali tampil di situs.' : '"' + name + '" dikembalikan ke versi bawaan.');
    } catch (err) {
      ui.setLoading(btn, false);
      ui.toast(err.message || 'Konten belum dapat dipulihkan.', { type: 'error' });
    }
  }

  /* --------------------------------------------------------- forms */
  /* isi (berita): blank line = new paragraph; "## " = subheading; "- " = bullet (one per line) */
  function isiToText(arr) {
    var list = Array.isArray(arr) ? arr : (arr ? [String(arr)] : []);
    var out = '';
    list.forEach(function (p, i) {
      var s = String(p || '');
      if (!i) out = s;
      else out += (/^- /.test(s) && /^- /.test(list[i - 1]) ? '\n' : '\n\n') + s;
    });
    return out;
  }
  function textToIsi(text) {
    var out = [];
    String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/).forEach(function (block) {
      var lines = block.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
      if (!lines.length) return;
      if (lines.some(function (l) { return /^(- |## )/.test(l); })) {
        lines.forEach(function (l) {
          if (/^(- |## )/.test(l) || !out.length) out.push(l);
          else out[out.length - 1] += ' ' + l;
        });
      } else out.push(lines.join(' '));
    });
    return out;
  }
  function row(a, b) { return '<div class="form__row form__row--2">' + a + b + '</div>'; }
  function fieldsFor(type, it) {
    var v = it || {};
    var F = K.field, C = K.check;
    var common = C({ name: 'contoh', label: 'Tandai sebagai konten contoh', hint: 'Menampilkan lencana "Contoh" agar pengunjung tahu isinya ilustratif.', checked: it ? !!v.contoh : false });
    switch (type) {
      case 'berita': {
        var imgs = IMAGES.slice();
        if (v.gambar && !imgs.some(function (x) { return x.value === v.gambar; })) imgs.push({ value: v.gambar, label: 'Gambar saat ini (' + v.gambar.split('/').pop() + ')' });
        return F({ name: 'judul', label: 'Judul', required: true, value: v.judul, maxlength: 200, counter: true }) +
          row(F({ name: 'kategori', label: 'Kategori', type: 'select', value: v.kategori || 'Kegiatan', options: BERITA_KATEGORI }),
              F({ name: 'tanggal', label: 'Tanggal terbit', type: 'date', required: true, value: v.tanggal || util.todayIso() })) +
          F({ name: 'ringkasan', label: 'Ringkasan', type: 'textarea', rows: 3, required: true, value: v.ringkasan, maxlength: 400, counter: true, hint: 'Tampil pada kartu berita dan pratinjau tautan.' }) +
          F({ name: 'isi', label: 'Isi berita', type: 'textarea', rows: 10, value: isiToText(v.isi), hint: 'Pisahkan paragraf dengan satu baris kosong. Awali baris dengan <code>## </code> untuk subjudul atau <code>- </code> untuk butir daftar.' }) +
          row(F({ name: 'gambar', label: 'Gambar', type: 'select', value: v.gambar || '', options: imgs }),
              F({ name: 'penulis', label: 'Penulis', value: v.penulis || 'Sekretariat PPAPI', maxlength: 120 })) +
          '<div class="adm-checks">' + C({ name: 'sorot', label: 'Jadikan berita sorotan', hint: 'Ditampilkan paling menonjol di halaman Berita.', checked: !!v.sorot }) + common + '</div>';
      }
      case 'pengumuman':
        return F({ name: 'judul', label: 'Judul', required: true, value: v.judul, maxlength: 200, counter: true }) +
          F({ name: 'tanggal', label: 'Tanggal', type: 'date', required: true, value: v.tanggal || util.todayIso() }) +
          F({ name: 'isi', label: 'Isi pengumuman', type: 'textarea', rows: 5, required: true, value: v.isi, maxlength: 2000, counter: true }) +
          '<div class="adm-checks">' + C({ name: 'penting', label: 'Tandai sebagai penting', hint: 'Ditonjolkan di dasbor anggota.', checked: !!v.penting }) + common + '</div>';
      case 'agenda':
        return F({ name: 'judul', label: 'Nama kegiatan', required: true, value: v.judul, maxlength: 200, counter: true }) +
          row(F({ name: 'jenis', label: 'Jenis', type: 'select', value: v.jenis || 'Seminar', options: AGENDA_JENIS }),
              F({ name: 'mode', label: 'Pelaksanaan', type: 'select', value: v.mode || 'Luring', options: AGENDA_MODE })) +
          row(F({ name: 'mulai', label: 'Tanggal mulai', type: 'date', required: true, value: v.mulai || '' }),
              F({ name: 'selesai', label: 'Tanggal selesai', type: 'date', optional: true, value: v.selesai && v.selesai !== v.mulai ? v.selesai : '', hint: 'Kosongkan untuk kegiatan satu hari.' })) +
          row(F({ name: 'waktu', label: 'Waktu', optional: true, value: v.waktu, maxlength: 80, placeholder: '08.00 – 16.00 WIB' }),
              F({ name: 'kuota', label: 'Kuota peserta', type: 'number', optional: true, min: 1, max: 100000, value: v.kuota === null || v.kuota === undefined ? '' : v.kuota })) +
          F({ name: 'lokasi', label: 'Lokasi', required: true, value: v.lokasi, maxlength: 200, placeholder: 'Kota, nama tempat, atau "Daring (Zoom)"' }) +
          F({ name: 'deskripsi', label: 'Deskripsi', type: 'textarea', rows: 5, value: v.deskripsi, maxlength: 3000, counter: true, optional: true }) +
          F({ name: 'tautanDaftar', label: 'Tautan pendaftaran', url: 'https', optional: true, value: v.tautanDaftar, placeholder: 'https://…', hint: 'Kosongkan bila pendaftaran melalui sekretariat.' }) +
          '<div class="adm-checks">' + common + '</div>';
      case 'pustaka': {
        var fileHint = 'Tautan berkas (mis. Google Drive "siapa saja yang memiliki tautan") atau jalur di situs. Untuk akses <strong>Khusus anggota</strong>, tautan disimpan terpisah dan hanya diberikan kepada anggota aktif serta admin.';
        return F({ name: 'judul', label: 'Judul dokumen', required: true, value: v.judul, maxlength: 200, counter: true }) +
          row(F({ name: 'kategori', label: 'Kategori', type: 'select', value: v.kategori || 'Petunjuk Teknis', options: store().PUSTAKA_KATEGORI }),
              F({ name: 'kode', label: 'Kode dokumen', optional: true, value: v.kode, maxlength: 40, placeholder: 'PPAPI-PT-03' })) +
          row(F({ name: 'status', label: 'Status', type: 'select', value: v.status || 'Dalam Penyusunan', options: store().PUSTAKA_STATUS }),
              F({ name: 'akses', label: 'Akses', type: 'select', value: v.akses || 'anggota', options: [{ value: 'anggota', label: 'Khusus anggota aktif' }, { value: 'publik', label: 'Publik' }] })) +
          row(F({ name: 'versi', label: 'Versi', optional: true, value: v.versi, maxlength: 40, placeholder: 'Rev. 1 / Rancangan' }),
              F({ name: 'tanggal', label: 'Tanggal terbit', type: 'date', optional: true, value: v.tanggal })) +
          row(F({ name: 'format', label: 'Format', optional: true, value: v.format, maxlength: 40, list: 'adm-format-list', placeholder: 'PDF' }),
              F({ name: 'halaman', label: 'Jumlah halaman', optional: true, value: v.halaman, maxlength: 40 })) +
          '<datalist id="adm-format-list"><option value="PDF"><option value="Aplikasi Web"><option value="Tautan"><option value="DOCX"><option value="XLSX"><option value="Video"></datalist>' +
          F({ name: 'penyusun', label: 'Penyusun', optional: true, value: v.penyusun || 'Tim Penyusun PPAPI', maxlength: 160 }) +
          F({ name: 'ringkasan', label: 'Ringkasan', type: 'textarea', rows: 4, required: true, value: v.ringkasan, maxlength: 1200, counter: true }) +
          F({ name: 'tautan', label: 'Tautan berkas', url: 'any', optional: true, value: v.tautan, placeholder: 'https://…', hint: fileHint + (v.berkasAnggota ? ' Berkas khusus anggota sudah tersimpan; tautan tersimpan dimuat di kolom ini.' : '') }) +
          F({ name: 'tag', label: 'Kata kunci', optional: true, value: (v.tag || []).join(', '), hint: 'Pisahkan dengan koma.' }) +
          '<div class="adm-checks">' + (v.berkasAnggota ? C({ name: 'hapusBerkas', label: 'Hapus berkas khusus anggota yang tersimpan', hint: 'Centang lalu kosongkan tautan untuk mencabut berkas.' }) : '') + common + '</div>';
      }
      default:
        return row(F({ name: 'jenis', label: 'Jenis', type: 'select', value: v.jenis || 'Peraturan Menteri', options: REG_JENIS }),
                   F({ name: 'status', label: 'Status', type: 'select', value: v.status || 'Berlaku', options: REG_STATUS })) +
          row(F({ name: 'nomor', label: 'Nomor', required: true, value: v.nomor, maxlength: 80 }),
              F({ name: 'tahun', label: 'Tahun', type: 'number', required: true, min: 1900, max: 2100, value: v.tahun || new Date().getFullYear() })) +
          row(F({ name: 'singkatan', label: 'Singkatan', required: true, value: v.singkatan, maxlength: 80, placeholder: 'Permenaker 9/2016' }),
              F({ name: 'instansi', label: 'Instansi penerbit', required: true, value: v.instansi, maxlength: 160 })) +
          F({ name: 'judul', label: 'Judul / tentang', required: true, value: v.judul, maxlength: 400 }) +
          F({ name: 'relevansi', label: 'Relevansi bagi pekerjaan perancah', type: 'textarea', rows: 3, value: v.relevansi, maxlength: 600, counter: true, optional: true }) +
          F({ name: 'tautan', label: 'Tautan resmi', url: 'http', optional: true, value: v.tautan, placeholder: 'https://peraturan.bpk.go.id/…', hint: 'Gunakan sumber resmi (JDIH, BPK, kementerian).' }) +
          F({ name: 'sumber', label: 'Sumber rujukan lain', type: 'textarea', rows: 2, optional: true, value: (v.sumber || []).join('\n'), hint: 'Satu tautan per baris.' }) +
          '<div class="adm-checks">' + C({ name: 'kunci', label: 'Regulasi kunci', hint: 'Ditampilkan pada daftar regulasi utama di dasbor dan beranda.', checked: !!v.kunci }) + '</div>';
    }
  }
  function toItem(type, v, it) {
    var o = Object.assign({}, v);
    if (it) o.id = it.id;
    if (type === 'berita') o.isi = textToIsi(v.isi);
    if (type === 'agenda') { if (!o.selesai) o.selesai = o.mulai; o.kuota = v.kuota === '' ? null : Number(v.kuota); }
    if (type === 'pustaka' && it && it.app) o.app = it.app;
    if (type === 'regulasi') o.tahun = Number(v.tahun);
    return o;
  }
  function editDialog(type, it) {
    var t = typeOf(type);
    var isNew = !it;
    K.formDialog({
      title: isNew ? t.add : 'Ubah ' + t.one, eyebrow: isNew ? 'Konten · ' + t.label : (it._static ? 'Konten bawaan · ' + t.label : 'Konten dikelola · ' + t.label), size: 'lg',
      intro: !isNew && it._static ? '<p class="adm-form__note">' + icon('info', { size: 16 }) + '<span>Ini konten bawaan dari berkas data situs. Perubahan disimpan sebagai versi pengganti dan dapat dikembalikan ke versi bawaan kapan saja.</span></p>' : '',
      fields: '<p class="adm-form__req">Kolom bertanda <span aria-hidden="true">*</span><span class="sr-only">bintang</span> wajib diisi.</p>' + fieldsFor(type, it),
      submitLabel: isNew ? 'Simpan & Terbitkan' : 'Simpan Perubahan', submitId: 'dlg-content-ok',
      extraCheck: function (el, v) {
        if (type === 'agenda' && el.name === 'selesai' && v) {
          var mulai = el.form.querySelector('[name="mulai"]').value;
          if (mulai && v < mulai) return 'Tanggal selesai tidak boleh sebelum tanggal mulai.';
        }
        if (type === 'regulasi' && el.name === 'sumber' && v) {
          var bad = v.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean).filter(function (s) { return !/^https?:\/\/[^\s<>"']+$/i.test(s); });
          if (bad.length) return 'Setiap baris harus berupa tautan https:// atau http://.';
        }
        return '';
      },
      onOpen: function (el, form) {
        if (type === 'pustaka' && it && it.berkasAnggota) {
          var input = form.querySelector('[name="tautan"]');
          store().pustaka.fileUrl(it).then(function (url) { if (url && input && !input.value) input.value = url; }).catch(function () { /* ignore */ });
        }
      },
      submit: function (v) { return store().content.save(type, toItem(type, v, it)); }
    }).then(function (saved) {
      if (!saved) return;
      afterContent(type, (isNew ? t.label + ' "' : '"') + titleOf(type, saved) + '" ' + (isNew ? 'diterbitkan.' : 'disimpan.'));
    });
  }
})(window, document);
