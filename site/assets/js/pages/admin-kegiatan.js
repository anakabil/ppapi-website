/* ==========================================================================
   PPAPI — admin-kegiatan.js  (Konsol Admin: Kegiatan)
   Mendaftarkan bagian konsol lewat window.PPAPI_ADMIN_SECTIONS:
     { key:'kegiatan', label:'Kegiatan', icon:'calendar', title, lead, render(container) }
   • Daftar kegiatan (cari, saring status), buat/ubah/terbitkan/hapus.
   • Panel kelola: Peserta (CSV, tandai hadir, hapus), Daftar Hadir,
     Sertifikat (perancang tata letak: unggah desain PNG/JPEG, geser kolom
     nama/judul/tanggal/nomor/QR, ukuran/warna/perataan, pratinjau langsung,
     PDF pratinjau) dan daftar sertifikat terbit (cabut/pulihkan).
   Butuh store-kegiatan.js (PPAPI.kegiatan) dan assets/css/kegiatan.css
   (dipasang otomatis bila belum ditautkan). Semua teks data di-escape.
   ========================================================================== */
(function (w, d) {
  'use strict';

  var SCRIPT_SRC = (d.currentScript && d.currentScript.src) || '';
  function ensureCss() {
    if (d.querySelector('link[data-kegiatan-css], link[href$="kegiatan.css"]')) return;
    var l = d.createElement('link');
    l.rel = 'stylesheet'; l.setAttribute('data-kegiatan-css', '');
    l.href = SCRIPT_SRC ? SCRIPT_SRC.replace(/js\/pages\/admin-kegiatan\.js(\?.*)?$/, 'css/kegiatan.css') : 'assets/css/kegiatan.css';
    d.head.appendChild(l);
  }

  function P() { return w.PPAPI; }
  function K() { return w.PPAPI.kegiatan; }
  function h(s) { return P().util.h(s); }
  function icon(n, o) { return P().icon(n, o); }
  function ui() { return P().ui; }
  function btnIcon(n, s) { return icon(n, { cls: 'btn__icon', size: s || 16 }); }
  function fmtN(n) { return P().util.formatNumber(n); }

  var S = { list: null, q: '', status: '', error: null, root: null };

  /* ------------------------------------------------------------ daftar */
  function statusBadge(ev) {
    var now = Date.now();
    var st = ev.status === 'terbit' ? '<span class="badge badge--ok">Terbit</span>' : '<span class="badge badge--muted">Draf</span>';
    var ph = K().phaseOf(ev, now);
    var phb = ph === 'berlangsung' ? ' <span class="badge badge--warn">Berlangsung</span>' : ph === 'selesai' ? ' <span class="badge badge--outline">Selesai</span>' : '';
    return st + phb;
  }
  function aksesBadge(ev) { return ev.akses === 'aktif' ? '<span class="badge badge--metal">Anggota Aktif</span>' : '<span class="badge badge--outline">Semua akun</span>'; }
  function matches(ev) {
    if (S.status === 'draf' && ev.status !== 'draf') return false;
    if (S.status === 'terbit' && (ev.status !== 'terbit' || K().phaseOf(ev) === 'selesai')) return false;
    if (S.status === 'selesai' && K().phaseOf(ev) !== 'selesai') return false;
    if (!S.q) return true;
    var hay = (ev.judul + ' ' + ev.jenis + ' ' + ev.kode + ' ' + ev.lokasi + ' ' + ev.narasumber).toLowerCase();
    return S.q.toLowerCase().split(/\s+/).filter(Boolean).every(function (t) { return hay.indexOf(t) !== -1; });
  }
  function chip(value, label, count) {
    return '<button type="button" class="chip" data-kga-status="' + h(value) + '" aria-pressed="' + (S.status === value ? 'true' : 'false') + '">' + h(label) + ' <span class="chip__count">' + h(fmtN(count)) + '</span></button>';
  }
  function renderList() {
    var root = S.root;
    if (!root) return;
    var body = root.querySelector('[data-kga-list]');
    if (!body) return;
    if (S.error) {
      body.innerHTML = '<div class="alert alert--err" role="alert">' + icon('alert-triangle', { size: 18 }) + '<div><p class="alert__title">Data kegiatan belum dapat dimuat</p><p>' + h(S.error.message || '') + '</p></div></div>';
      return;
    }
    var all = S.list || [];
    var now = Date.now();
    var counts = { '': all.length, draf: 0, terbit: 0, selesai: 0 };
    all.forEach(function (ev) {
      if (ev.status === 'draf') counts.draf++;
      if (K().phaseOf(ev, now) === 'selesai') counts.selesai++;
      else if (ev.status === 'terbit') counts.terbit++;
    });
    var chips = root.querySelector('[data-kga-chips]');
    if (chips) chips.innerHTML = chip('', 'Semua', counts['']) + chip('terbit', 'Terbit', counts.terbit) + chip('draf', 'Draf', counts.draf) + chip('selesai', 'Selesai', counts.selesai);
    var rows = all.filter(matches);
    var count = root.querySelector('[data-kga-count]');
    if (count) count.textContent = rows.length ? fmtN(rows.length) + ' kegiatan' : '';
    if (!all.length) {
      body.innerHTML = ui().emptyState({ icon: 'calendar', title: 'Belum ada kegiatan', text: 'Buat webinar, pelatihan, atau seminar pertama. Kegiatan berstatus Terbit tampil di halaman Agenda dan dapat didaftari anggota.', actionHtml: '<button type="button" class="btn btn--primary btn--sm" data-kga="new"><span>Tambah Kegiatan</span>' + btnIcon('plus') + '</button>' });
      ui().reveal(body);
      return;
    }
    if (!rows.length) {
      body.innerHTML = ui().emptyState({ icon: 'filter', title: 'Tidak ada kegiatan yang sesuai', text: 'Ubah kata pencarian atau saringan status.' });
      ui().reveal(body);
      return;
    }
    body.innerHTML = '<div class="table-wrap"><table class="table kga-table"><caption class="sr-only">Daftar kegiatan</caption><thead><tr>' +
      '<th scope="col">Kegiatan</th><th scope="col">Jadwal (WIB)</th><th scope="col">Peserta</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Tindakan</span></th></tr></thead><tbody>' +
      rows.map(function (ev) {
        return '<tr data-id="' + h(ev.id) + '">' +
          '<td data-label="Kegiatan"><button type="button" class="kga-title-btn" data-kga="manage" data-id="' + h(ev.id) + '">' + h(ev.judul) + '</button>' +
            '<span class="kga-sub">' + h(ev.jenis) + ' · ' + h(ev.mode) + ' · Kode ' + h(ev.kode) + '</span>' +
            '<span class="kga-badges">' + aksesBadge(ev) + (ev.sertifikat ? '<span class="badge badge--outline">Sertifikat</span>' : '') + (ev.tautanDaftar ? '<span class="badge badge--outline">Formulir eksternal</span>' : '') + '</span></td>' +
          '<td data-label="Jadwal">' + h(K().fmtSchedule(ev, { short: true })) + '</td>' +
          '<td data-label="Peserta"><span class="kga-num">' + h(fmtN(ev.terdaftar)) + '</span>' + (ev.kuota ? ' <span class="kga-sub">dari ' + h(fmtN(ev.kuota)) + ' kursi</span>' : ' <span class="kga-sub">tanpa batas kuota</span>') + '</td>' +
          '<td data-label="Status">' + statusBadge(ev) + '</td>' +
          '<td><div class="kga-actions"><button type="button" class="btn btn--ghost btn--sm" data-kga="manage" data-id="' + h(ev.id) + '"><span>Kelola</span><span class="sr-only"> ' + h(ev.judul) + '</span></button>' +
            '<button type="button" class="btn btn--link btn--sm" data-kga="edit" data-id="' + h(ev.id) + '">' + icon('edit', { size: 16 }) + '<span>Ubah</span><span class="sr-only"> ' + h(ev.judul) + '</span></button></div></td>' +
        '</tr>';
      }).join('') + '</tbody></table></div>';
    ui().reveal(body);
  }
  async function reload() {
    try { S.list = await K().admin.list(); S.error = null; }
    catch (err) { console.error(err); S.error = err; S.list = S.list || []; }
    renderList();
  }

  /* ------------------------------------------------------------ formulir */
  function field(id, label, control, o) {
    o = o || {};
    return '<div class="field' + (o.cls ? ' ' + o.cls : '') + '" data-field="' + h(o.key || id) + '"><label class="field__label" for="' + id + '">' + label + (o.req ? ' <span class="field__req" aria-hidden="true">*</span>' : '') + (o.opt ? ' <span class="opt">(opsional)</span>' : '') + '</label>' +
      control + (o.hint ? '<p class="field__hint" id="' + id + '-hint">' + o.hint + '</p>' : '') +
      '<p class="field__error" id="' + id + '-err">' + (o.err || 'Periksa isian ini.') + '</p></div>';
  }
  function input(id, type, value, o) {
    o = o || {};
    return '<input class="field__control" id="' + id + '" name="' + id + '" type="' + type + '" value="' + h(value === undefined || value === null ? '' : value) + '"' +
      (o.req ? ' required aria-required="true"' : '') + (o.max ? ' maxlength="' + o.max + '"' : '') + (o.min !== undefined ? ' min="' + o.min + '"' : '') +
      (o.placeholder ? ' placeholder="' + h(o.placeholder) + '"' : '') + (o.extra || '') + ' aria-describedby="' + id + '-hint ' + id + '-err">';
  }
  function select(id, options, value) {
    return '<select class="field__control" id="' + id + '" name="' + id + '" aria-describedby="' + id + '-hint ' + id + '-err">' + options.map(function (op) {
      var v = typeof op === 'object' ? op.value : op, l = typeof op === 'object' ? op.label : op;
      return '<option value="' + h(v) + '"' + (String(v) === String(value) ? ' selected' : '') + '>' + h(l) + '</option>';
    }).join('') + '</select>';
  }
  function radio(name, value, checked, label, small) {
    return '<label class="check"><input type="radio" name="' + name + '" value="' + h(value) + '"' + (checked ? ' checked' : '') + '><span class="check__box"></span><span class="check__label">' + h(label) + (small ? '<small>' + h(small) + '</small>' : '') + '</span></label>';
  }
  function eventForm(ev) {
    var e = ev || {};
    var now = Date.now() + 7 * 86400000;
    var md = e.mulai ? K().dateIso(e.mulai) : K().dateIso(now), mj = e.mulai ? K().timeHm(e.mulai) : '09:00';
    var sd = e.selesai ? K().dateIso(e.selesai) : md, sj = e.selesai ? K().timeHm(e.selesai) : '11:00';
    var jenis = K().JENIS.slice();
    if (e.jenis && jenis.indexOf(e.jenis) === -1) jenis.push(e.jenis);
    return '<form class="form kga-form" novalidate data-kga-form>' +
      '<p class="field__hint">Kolom bertanda * wajib diisi. Seluruh waktu dalam WIB.</p>' +
      '<h3 class="form__section-title">Informasi kegiatan</h3>' +
      field('kg-judul', 'Judul kegiatan', input('kg-judul', 'text', e.judul, { req: true, max: 200, placeholder: 'mis. Webinar Inspeksi Perancah Sebelum Digunakan' }), { req: true, key: 'judul', err: 'Judul minimal 3 karakter.' }) +
      '<div class="form__row form__row--2">' +
        field('kg-jenis', 'Jenis', select('kg-jenis', jenis, e.jenis || 'Webinar'), { key: 'jenis' }) +
        field('kg-narasumber', 'Narasumber', input('kg-narasumber', 'text', e.narasumber, { max: 300 }), { opt: true, key: 'narasumber' }) +
      '</div>' +
      field('kg-deskripsi', 'Deskripsi', '<textarea class="field__control" id="kg-deskripsi" rows="4" maxlength="4000" aria-describedby="kg-deskripsi-hint kg-deskripsi-err">' + h(e.deskripsi || '') + '</textarea>', { opt: true, key: 'deskripsi', hint: 'Ringkasan materi, sasaran peserta, dan hal yang perlu disiapkan.' }) +
      '<h3 class="form__section-title">Jadwal</h3>' +
      '<div class="form__row form__row--2">' +
        field('kg-mulai-tgl', 'Tanggal mulai', input('kg-mulai-tgl', 'date', md, { req: true }), { req: true, key: 'mulai', err: 'Isi tanggal dan jam mulai.' }) +
        field('kg-mulai-jam', 'Jam mulai (WIB)', input('kg-mulai-jam', 'time', mj, { req: true, extra: ' step="300"' }), { req: true, key: 'mulai-jam' }) +
      '</div><div class="form__row form__row--2">' +
        field('kg-selesai-tgl', 'Tanggal selesai', input('kg-selesai-tgl', 'date', sd, { req: true }), { req: true, key: 'selesai', err: 'Waktu selesai harus setelah waktu mulai.' }) +
        field('kg-selesai-jam', 'Jam selesai (WIB)', input('kg-selesai-jam', 'time', sj, { req: true, extra: ' step="300"' }), { req: true, key: 'selesai-jam' }) +
      '</div>' +
      '<p class="kga-window" data-kga-window aria-live="polite"></p>' +
      '<h3 class="form__section-title">Pelaksanaan</h3>' +
      '<div class="form__row form__row--2">' +
        field('kg-mode', 'Mode', select('kg-mode', K().MODES, e.mode || 'Daring'), { key: 'mode' }) +
        field('kg-lokasi', 'Lokasi / platform', input('kg-lokasi', 'text', e.lokasi, { max: 300, placeholder: 'mis. Zoom Meeting atau alamat gedung' }), { opt: true, key: 'lokasi', hint: 'Tampil untuk publik.' }) +
      '</div>' +
      field('kg-ruang', 'Tautan ruang daring', input('kg-ruang', 'url', e.linkRuang, { max: 500, placeholder: 'https://…' }), { opt: true, key: 'linkRuang', hint: 'Hanya ditampilkan kepada peserta yang sudah terdaftar.', err: 'Tautan harus diawali https://' }) +
      field('kg-ruang-cat', 'Catatan ruang', input('kg-ruang-cat', 'text', e.catatanRuang, { max: 500, placeholder: 'mis. Meeting ID dan kode sandi' }), { opt: true, key: 'catatanRuang', hint: 'Juga hanya untuk peserta terdaftar.' }) +
      '<h3 class="form__section-title">Pendaftaran</h3>' +
      '<fieldset class="field kga-radio" data-field="akses"><legend class="field__label">Siapa yang boleh mendaftar</legend>' +
        radio('kg-akses', 'semua', e.akses !== 'aktif', 'Semua akun', K().AKSES_DESC.semua) +
        radio('kg-akses', 'aktif', e.akses === 'aktif', 'Anggota Aktif saja', K().AKSES_DESC.aktif) +
      '</fieldset>' +
      '<div class="form__row form__row--2">' +
        field('kg-kuota', 'Kuota peserta', input('kg-kuota', 'number', e.kuota || 0, { min: 0, extra: ' inputmode="numeric" step="1"' }), { key: 'kuota', hint: '0 berarti tidak dibatasi.', err: 'Kuota tidak boleh kurang dari jumlah peserta terdaftar.' }) +
        field('kg-tautan', 'Tautan pendaftaran eksternal', input('kg-tautan', 'url', e.tautanDaftar, { max: 500, placeholder: 'https://forms.gle/…' }), { opt: true, key: 'tautanDaftar', hint: 'Mis. Google Form penyelenggara. Peserta tetap mendaftar di situs agar dapat mengisi daftar hadir dan mengunduh sertifikat.', err: 'Tautan harus diawali https://' }) +
      '</div>' +
      '<h3 class="form__section-title">Sertifikat &amp; penerbitan</h3>' +
      '<label class="check"><input type="checkbox" id="kg-sertifikat"' + (e.sertifikat === false ? '' : ' checked') + '><span class="check__box"></span><span class="check__label">Sediakan sertifikat PDF bagi peserta yang mengisi daftar hadir</span></label>' +
      '<div class="form__row form__row--2">' +
        field('kg-kode', 'Kode kegiatan', input('kg-kode', 'text', e.kode || '', { max: 12, placeholder: 'otomatis', extra: ' autocapitalize="characters" spellcheck="false"' + (e.sertSeq ? ' readonly' : '') }), { key: 'kode', hint: e.sertSeq ? 'Terkunci karena sertifikat sudah diterbitkan.' : 'Bagian nomor sertifikat, mis. PPAPI/SERT/2026/<b data-kga-kode></b>/0001. Huruf kapital dan angka.', err: 'Gunakan 2–12 huruf kapital/angka yang belum dipakai.' }) +
        '<fieldset class="field kga-radio" data-field="status"><legend class="field__label">Status</legend>' +
          radio('kg-status', 'draf', e.status !== 'terbit', 'Draf', 'Belum tampil di situs.') +
          radio('kg-status', 'terbit', e.status === 'terbit', 'Terbit', 'Tampil di Agenda dan dapat didaftari.') +
        '</fieldset>' +
      '</div>' +
      '<div class="alert alert--err" role="alert" data-kga-err></div>' +
    '</form>';
  }
  function readForm(root) {
    function v(id) { var el = root.querySelector('#' + id); return el ? el.value : ''; }
    var ak = root.querySelector('input[name="kg-akses"]:checked'), st = root.querySelector('input[name="kg-status"]:checked');
    return {
      judul: v('kg-judul'), jenis: v('kg-jenis'), narasumber: v('kg-narasumber'), deskripsi: v('kg-deskripsi'),
      mulaiTanggal: v('kg-mulai-tgl'), mulaiJam: v('kg-mulai-jam'), selesaiTanggal: v('kg-selesai-tgl'), selesaiJam: v('kg-selesai-jam'),
      mode: v('kg-mode'), lokasi: v('kg-lokasi'), linkRuang: v('kg-ruang'), catatanRuang: v('kg-ruang-cat'),
      akses: ak ? ak.value : 'semua', kuota: v('kg-kuota'), tautanDaftar: v('kg-tautan'),
      sertifikat: !!(root.querySelector('#kg-sertifikat') || {}).checked, kode: v('kg-kode'), status: st ? st.value : 'draf'
    };
  }
  function updateWindowHint(root) {
    var x = readForm(root);
    var m = K().fromWib(x.mulaiTanggal, x.mulaiJam), s = K().fromWib(x.selesaiTanggal, x.selesaiJam);
    var el = root.querySelector('[data-kga-window]');
    var kodeEl = root.querySelector('[data-kga-kode]');
    if (kodeEl) kodeEl.textContent = (x.kode || '').toUpperCase().replace(/[^A-Z0-9]/g, '') || K().defaultKode(x.jenis, m);
    if (!el) return;
    if (!isFinite(m) || !isFinite(s) || s <= m) { el.innerHTML = 'Lengkapi jadwal untuk melihat jendela daftar hadir.'; return; }
    var win = K().windowOf({ selesai: s });
    el.innerHTML = icon('clock', { size: 16 }) + ' Daftar hadir dibuka otomatis <strong>' + h(K().fmtDateTime(win.buka, { weekday: true })) + '</strong> dan ditutup <strong>' + h(K().fmtDateTime(win.tutup, { weekday: true })) + '</strong>.';
  }
  function openForm(ev, after) {
    var isNew = !ev;
    var m = ui().modal({
      title: isNew ? 'Tambah kegiatan' : 'Ubah kegiatan', eyebrow: 'Kegiatan', size: 'lg', cls: 'kga-modal', body: eventForm(ev),
      onOpen: function (el) {
        var form = el.querySelector('[data-kga-form]');
        updateWindowHint(form);
        form.addEventListener('input', function (e) {
          updateWindowHint(form);
          var f = e.target.closest('.field');
          if (f && f.classList.contains('is-invalid')) { f.classList.remove('is-invalid'); e.target.removeAttribute('aria-invalid'); }
        });
        form.addEventListener('change', function () { updateWindowHint(form); });
        form.addEventListener('submit', function (e) { e.preventDefault(); });
      },
      actions: [
        { label: 'Batal', variant: 'ghost' },
        { label: isNew ? 'Simpan Kegiatan' : 'Simpan Perubahan', variant: 'primary', id: 'kga-save', onClick: async function (close, ctx) {
          var form = ctx.el.querySelector('[data-kga-form]');
          var errBox = form.querySelector('[data-kga-err]');
          errBox.innerHTML = '';
          P().util.$$('.field.is-invalid', form).forEach(function (f) { f.classList.remove('is-invalid'); });
          var data = readForm(form);
          if (ev) data.id = ev.id;
          try {
            var saved = await K().admin.save(data);
            ui().toast(isNew ? 'Kegiatan “' + saved.judul + '” dibuat.' : 'Perubahan kegiatan disimpan.', { type: 'success' });
            await reload();
            if (after) after(saved);
          } catch (err) {
            var map = { judul: 'judul', mulai: 'mulai', selesai: 'selesai', kode: 'kode', kuota: 'kuota', tautanDaftar: 'tautanDaftar', linkRuang: 'linkRuang' };
            var first = null;
            (err.fields || []).forEach(function (f) {
              var box = form.querySelector('[data-field="' + (map[f.key] || f.key) + '"]');
              if (box) { box.classList.add('is-invalid'); var c = box.querySelector('.field__control'); if (c) { c.setAttribute('aria-invalid', 'true'); first = first || c; } }
            });
            errBox.innerHTML = icon('alert-triangle', { size: 18 }) + '<div><p>' + h(err.message) + '</p></div>';
            if (first) first.focus(); else errBox.scrollIntoView({ block: 'nearest' });
            return false;
          }
        } }
      ]
    });
    return m;
  }

  /* ------------------------------------------------------------ panel kelola */
  function kvRow(k, v) { return '<div class="kv__row"><dt>' + h(k) + '</dt><dd>' + v + '</dd></div>'; }
  async function openManage(id, tab) {
    var ev;
    try { ev = await K().admin.get(id); } catch (err) { ui().toast(err.message, { type: 'error' }); return; }
    if (!ev) { ui().toast('Kegiatan tidak ditemukan.', { type: 'error' }); return; }
    var dr = ui().drawer({ title: ev.judul, eyebrow: ev.jenis + ' · ' + (ev.status === 'terbit' ? 'Terbit' : 'Draf'), size: 'lg', cls: 'kga-drawer', body: ui().skeleton(4) });
    var designer = null;
    async function paint(selectTab) {
      ev = await K().admin.get(id);
      if (!ev) { dr.close(); return; }
      var data = await K().admin.participants(id);
      var certs = ev.sertifikat ? await K().admin.certificates(id) : [];
      var win = K().windowOf(ev);
      var winLabel = { belum: 'Belum dibuka', buka: 'Sedang dibuka', tutup: 'Sudah ditutup' }[win.state];
      dr.setTitle(ev.judul);
      var summary = '<dl class="kv kga-kv">' +
        kvRow('Jadwal', h(K().fmtSchedule(ev))) +
        kvRow('Mode & lokasi', h(ev.mode + (ev.lokasi ? ' · ' + ev.lokasi : ''))) +
        kvRow('Akses', aksesBadge(ev) + ' <span class="kga-sub">' + h(K().AKSES_DESC[ev.akses]) + '</span>') +
        kvRow('Peserta', '<span class="kga-num">' + h(fmtN(ev.terdaftar)) + '</span>' + (ev.kuota ? ' dari ' + h(fmtN(ev.kuota)) + ' kursi' : ' (kuota tidak dibatasi)') + ' · hadir ' + h(fmtN(data.attendance.length))) +
        kvRow('Daftar hadir', '<strong>' + h(winLabel) + '</strong> · ' + h(K().fmtDateTime(win.buka, { short: true })) + ' – ' + h(K().fmtDateTime(win.tutup, { short: true }))) +
        kvRow('Ruang daring', ev.linkRuang ? '<a class="link" href="' + h(ev.linkRuang) + '" target="_blank" rel="noopener noreferrer">' + h(ev.linkRuang) + '</a>' : '<span class="kga-sub">Belum diisi</span>') +
        (ev.tautanDaftar ? kvRow('Formulir eksternal', '<a class="link" href="' + h(ev.tautanDaftar) + '" target="_blank" rel="noopener noreferrer">' + h(ev.tautanDaftar) + '</a>') : '') +
        kvRow('Status', statusBadge(ev)) +
        '</dl>';
      var actions = '<div class="cluster kga-manage-actions">' +
        '<button type="button" class="btn btn--ghost btn--sm" data-kgm="edit">' + icon('edit', { size: 16 }) + '<span>Ubah</span></button>' +
        (ev.status === 'terbit'
          ? '<button type="button" class="btn btn--ghost btn--sm" data-kgm="draft"><span>Jadikan Draf</span></button><a class="btn btn--link btn--sm" href="agenda.html?id=' + encodeURIComponent(ev.id) + '" target="_blank" rel="noopener"><span>Lihat di Agenda</span>' + btnIcon('arrow-up-right') + '</a>'
          : '<button type="button" class="btn btn--primary btn--sm" data-kgm="publish"><span>Terbitkan</span>' + btnIcon('arrow-right') + '</button>') +
        '<button type="button" class="btn btn--danger btn--sm" data-kgm="delete">' + icon('trash', { size: 16 }) + '<span>Hapus</span></button></div>';
      var partRows = data.participants.map(function (p, i) {
        var a = p.attendance;
        return '<tr><td data-label="No">' + (i + 1) + '</td>' +
          '<td data-label="Peserta"><span class="kga-title">' + h(p.nama) + '</span><span class="kga-sub">' + h([p.email, p.kta].filter(Boolean).join(' · ')) + '</span></td>' +
          '<td data-label="Keanggotaan">' + (p.statusAnggota ? P().util.statusBadge(p.statusAnggota) : '—') + '</td>' +
          '<td data-label="Daftar">' + h(isFinite(p.at) ? K().fmtDate(p.at, { short: true }) + ' ' + K().fmtTime(p.at) : '—') + '</td>' +
          '<td data-label="Hadir">' + (a ? '<span class="badge badge--ok">Hadir</span>' + (a.olehAdmin ? ' <span class="kga-sub">ditandai admin</span>' : '') : '<span class="badge badge--muted">Belum</span>') + '</td>' +
          '<td><div class="kga-actions">' + (a ? '' : '<button type="button" class="btn btn--ghost btn--sm" data-kgm="mark" data-uid="' + h(p.uid) + '"><span>Tandai Hadir</span><span class="sr-only"> ' + h(p.nama) + '</span></button>') +
          '<button type="button" class="btn btn--link btn--sm" data-kgm="remove" data-uid="' + h(p.uid) + '"' + (a && a.sertNo ? ' disabled title="Sertifikat sudah terbit"' : '') + '>' + icon('trash', { size: 16 }) + '<span>Hapus</span><span class="sr-only"> ' + h(p.nama) + '</span></button></div></td></tr>';
      }).join('');
      var partPanel = '<div class="kga-list-actions"><p class="kga-count">' + h(fmtN(data.participants.length)) + ' peserta terdaftar</p>' +
        (data.participants.length ? '<button type="button" class="btn btn--ghost btn--sm" data-kgm="csv">' + icon('download', { size: 16 }) + '<span>Unduh CSV</span></button>' : '') + '</div>' +
        (data.participants.length ? '<div class="table-wrap"><table class="table"><caption class="sr-only">Peserta terdaftar</caption><thead><tr><th scope="col">No</th><th scope="col">Peserta</th><th scope="col">Keanggotaan</th><th scope="col">Waktu daftar</th><th scope="col">Hadir</th><th scope="col"><span class="sr-only">Tindakan</span></th></tr></thead><tbody>' + partRows + '</tbody></table></div>'
          : ui().emptyState({ icon: 'users', title: 'Belum ada peserta', text: ev.status === 'terbit' ? 'Peserta yang mendaftar melalui halaman Agenda tampil di sini.' : 'Terbitkan kegiatan agar dapat didaftari.' }));
      var attPanel = '<p class="kga-window">' + icon('clock', { size: 16 }) + ' Daftar hadir dibuka otomatis <strong>' + h(K().fmtDateTime(win.buka, { weekday: true })) + '</strong> (30 menit sebelum selesai) dan ditutup <strong>' + h(K().fmtDateTime(win.tutup, { weekday: true })) + '</strong> (3 jam setelah selesai). Saat ini: <strong>' + h(winLabel) + '</strong>.</p>' +
        '<div class="kga-list-actions mt-3"><p class="kga-count">' + h(fmtN(data.attendance.length)) + ' dari ' + h(fmtN(data.participants.length)) + ' peserta hadir</p>' +
        (data.attendance.length ? '<button type="button" class="btn btn--ghost btn--sm" data-kgm="csv">' + icon('download', { size: 16 }) + '<span>Unduh CSV</span></button>' : '') + '</div>' +
        (data.attendance.length ? '<div class="table-wrap"><table class="table"><caption class="sr-only">Daftar hadir</caption><thead><tr><th scope="col">No</th><th scope="col">Nama</th><th scope="col">Waktu hadir</th><th scope="col">Nomor sertifikat</th></tr></thead><tbody>' +
          data.attendance.map(function (a, i) {
            return '<tr><td data-label="No">' + (i + 1) + '</td><td data-label="Nama">' + h(a.nama) + '</td><td data-label="Waktu">' + h(K().fmtDateTime(a.at, { short: true })) + (a.olehAdmin ? ' <span class="kga-sub">ditandai admin</span>' : '') + '</td>' +
              '<td data-label="Sertifikat">' + (a.sertNo ? '<span class="kg-no">' + h(K().certDisplay(a.sertNo)) + '</span>' : '<span class="kga-sub">Belum diunduh</span>') + '</td></tr>';
          }).join('') + '</tbody></table></div>'
          : ui().emptyState({ icon: 'check-circle', title: 'Belum ada yang mengisi daftar hadir', text: 'Peserta terdaftar mengisi daftar hadir sendiri selama jendela waktu di atas. Sekretariat dapat menandai kehadiran dari tab Peserta.' }));
      var certPanel = ev.sertifikat
        ? '<div data-kga-designer></div>' +
          '<h3 class="form__section-title mt-5">Sertifikat terbit</h3>' +
          (certs.length ? '<div class="table-wrap"><table class="table"><caption class="sr-only">Sertifikat terbit</caption><thead><tr><th scope="col">Nomor</th><th scope="col">Nama</th><th scope="col">Terbit</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Tindakan</span></th></tr></thead><tbody>' +
            certs.map(function (c) {
              return '<tr class="' + (c.status === 'Dicabut' ? 'kga-cert-row--dicabut' : '') + '"><td data-label="Nomor"><a class="link kg-no" href="sertifikat.html?no=' + encodeURIComponent(c.display) + '" target="_blank" rel="noopener">' + h(c.display) + '</a></td><td data-label="Nama">' + h(c.nama) + '</td>' +
                '<td data-label="Terbit">' + h(isFinite(c.terbit) ? K().fmtDate(c.terbit, { short: true }) : '—') + '</td>' +
                '<td data-label="Status">' + (c.status === 'Sah' ? '<span class="badge badge--ok">Sah</span>' : '<span class="badge badge--err">Dicabut</span>' + (c.alasan ? '<span class="kga-sub">' + h(c.alasan) + '</span>' : '')) + '</td>' +
                '<td><button type="button" class="btn btn--link btn--sm" data-kgm="' + (c.status === 'Sah' ? 'revoke' : 'restore') + '" data-no="' + h(c.no) + '"><span>' + (c.status === 'Sah' ? 'Cabut' : 'Pulihkan') + '</span><span class="sr-only"> ' + h(c.display) + '</span></button></td></tr>';
            }).join('') + '</tbody></table></div>'
            : '<p class="kga-hint">Belum ada sertifikat. Nomor diterbitkan saat peserta yang hadir mengunduh sertifikatnya.</p>')
        : '<div class="alert alert--info">' + icon('info', { size: 18 }) + '<div><p>Sertifikat tidak disediakan untuk kegiatan ini. Aktifkan melalui tombol Ubah bila diperlukan.</p></div></div>';
      var flyer = ev.flyer ? await K().getFlyer(id).catch(function () { return null; }) : null;
      var flyerPanel = '<div class="kga-flyer">' +
        (flyer
          ? '<figure class="kga-flyer__preview"><img src="' + h(flyer.img) + '" alt="Flyer ' + h(ev.judul) + '" width="' + h(flyer.w) + '" height="' + h(flyer.h) + '"><figcaption class="kga-sub">' + h(flyer.w + ' × ' + flyer.h + ' piksel') + '</figcaption></figure>'
          : '<div class="kga-flyer__empty">' + icon('upload', { size: 28 }) + '<p>Belum ada flyer. Flyer tampil di halaman Agenda dan di sorotan Kegiatan Terbaru pada halaman depan.</p></div>') +
        '<div class="kga-flyer__side"><p class="kga-hint">Unggah berkas JPG, PNG, atau WebP. Gambar dikompresi otomatis menjadi JPEG berukuran paling besar 900 KB dengan sisi terpanjang 1.600 piksel. Rasio 4:5 atau 1:1 paling pas di halaman depan.</p>' +
        '<div class="cluster"><label class="btn btn--primary btn--sm kga-flyer__pick">' + btnIcon('upload') + '<span>' + (flyer ? 'Ganti Flyer' : 'Unggah Flyer') + '</span>' +
        '<input class="sr-only" type="file" accept="image/jpeg,image/png,image/webp" data-kgm-flyer></label>' +
        (flyer ? '<button type="button" class="btn btn--link btn--sm" data-kgm="flyer-remove">' + icon('trash', { size: 16 }) + '<span>Hapus Flyer</span></button>' : '') +
        '</div></div></div>';
      var tabs = [['flyer', 'Flyer', 'upload', flyerPanel], ['peserta', 'Peserta', 'users', partPanel], ['hadir', 'Daftar Hadir', 'check-circle', attPanel], ['sertifikat', 'Sertifikat', 'award', certPanel]];
      var sel = selectTab || (ev.flyer ? 'peserta' : 'flyer');
      dr.setBody(summary + actions +
        '<div class="tabs kga-tabs" data-tabs><div class="tabs__list" role="tablist" aria-label="Kelola kegiatan">' +
        tabs.map(function (t) { return '<button class="tabs__tab" role="tab" id="kgt-' + t[0] + '" data-tab="' + t[0] + '" aria-controls="kgp-' + t[0] + '" aria-selected="' + (t[0] === sel) + '"' + (t[0] === sel ? '' : ' tabindex="-1"') + '>' + icon(t[2], { size: 16 }) + t[1] + '</button>'; }).join('') +
        '</div>' + tabs.map(function (t) { return '<div class="tabs__panel" role="tabpanel" id="kgp-' + t[0] + '" aria-labelledby="kgt-' + t[0] + '"' + (t[0] === sel ? '' : ' hidden') + '>' + t[3] + '</div>'; }).join('') + '</div>');
      var slot = dr.body.querySelector('[data-kga-designer]');
      if (slot) { designer = mountDesigner(slot, ev); await designer.ready; }
      dr.__data = data;
    }
    dr.body.addEventListener('click', async function (e) {
      var b = e.target.closest('[data-kgm]');
      if (!b || b.disabled) return;
      var kind = b.getAttribute('data-kgm');
      var tabNow = (dr.body.querySelector('.tabs__tab[aria-selected="true"]') || {}).getAttribute ? dr.body.querySelector('.tabs__tab[aria-selected="true"]').getAttribute('data-tab') : 'peserta';
      try {
        if (kind === 'edit') { openForm(ev, function () { paint(tabNow); }); return; }
        if (kind === 'flyer-remove') {
          var okF = await ui().confirm('Hapus flyer “' + ev.judul + '”?', { title: 'Hapus flyer', okLabel: 'Ya, hapus', danger: true });
          if (!okF) return;
          ui().setLoading(b, true);
          await K().admin.saveFlyer(id, null);
          ui().toast('Flyer dihapus.', { type: 'success' });
          await paint('flyer');
          await reload();
          return;
        }
        if (kind === 'csv') {
          var csv = K().admin.participantsCsv(ev, dr.__data.participants);
          K().saveBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'peserta-' + ev.id + '.csv');
          ui().toast('Berkas CSV peserta diunduh.', { type: 'success' });
          return;
        }
        if (kind === 'publish' || kind === 'draft') {
          ui().setLoading(b, true);
          await K().admin.setStatus(id, kind === 'publish' ? 'terbit' : 'draf');
          ui().toast(kind === 'publish' ? 'Kegiatan diterbitkan dan tampil di Agenda.' : 'Kegiatan dijadikan draf dan disembunyikan dari Agenda.', { type: 'success' });
        } else if (kind === 'delete') {
          var ok = await ui().confirm('Hapus “' + ev.judul + '” beserta data peserta dan daftar hadirnya? Sertifikat yang sudah terbit tetap dapat diverifikasi.', { title: 'Hapus kegiatan', okLabel: 'Ya, hapus', danger: true });
          if (!ok) return;
          await K().admin.remove(id);
          ui().toast('Kegiatan dihapus.', { type: 'success' });
          dr.close();
          await reload();
          return;
        } else if (kind === 'mark') {
          ui().setLoading(b, true);
          await K().admin.markAttendance(id, b.getAttribute('data-uid'));
          ui().toast('Kehadiran peserta ditandai.', { type: 'success' });
        } else if (kind === 'remove') {
          var ok2 = await ui().confirm('Hapus peserta ini dari kegiatan? Kursinya akan dilepas.', { title: 'Hapus peserta', okLabel: 'Ya, hapus', danger: true });
          if (!ok2) return;
          await K().admin.removeParticipant(id, b.getAttribute('data-uid'));
          ui().toast('Peserta dihapus.', { type: 'success' });
        } else if (kind === 'revoke' || kind === 'restore') {
          var alasan = '';
          if (kind === 'revoke') {
            alasan = await askReason();
            if (alasan === null) return;
          }
          await K().admin.setCertificateStatus(b.getAttribute('data-no'), kind === 'revoke' ? 'Dicabut' : 'Sah', alasan);
          ui().toast(kind === 'revoke' ? 'Sertifikat dicabut; halaman verifikasi menampilkan statusnya.' : 'Sertifikat dipulihkan.', { type: 'success' });
        }
        await paint(tabNow);
        await reload();
      } catch (err) {
        console.error(err);
        ui().toast(err.message || 'Tindakan gagal.', { type: 'error' });
        if (b.isConnected) ui().setLoading(b, false);
      }
    });
    /* unggah flyer (input berkas di tab Flyer) */
    dr.body.addEventListener('change', async function (e) {
      var inp = e.target.closest('[data-kgm-flyer]');
      if (!inp || !inp.files || !inp.files[0]) return;
      var pick = inp.closest('.kga-flyer__pick');
      try {
        if (pick) pick.classList.add('is-loading');
        inp.disabled = true;
        var r = await K().admin.saveFlyer(id, inp.files[0]);
        ui().toast('Flyer disimpan (' + r.w + ' × ' + r.h + ' piksel).', { type: 'success' });
        await paint('flyer');
        await reload();
      } catch (err) {
        console.error(err);
        ui().toast(err.message || 'Flyer gagal disimpan.', { type: 'error' });
        if (inp.isConnected) { inp.disabled = false; inp.value = ''; }
        if (pick) pick.classList.remove('is-loading');
      }
    });
    try { await paint(tab); } catch (err) { console.error(err); dr.setBody('<div class="alert alert--err" role="alert">' + icon('alert-triangle', { size: 18 }) + '<div><p>' + h(err.message || 'Data belum dapat dimuat.') + '</p></div></div>'); }
    return dr;
  }
  function askReason() {
    return new Promise(function (resolve) {
      var done = false;
      ui().modal({
        title: 'Cabut sertifikat', size: 'sm',
        body: '<div class="field"><label class="field__label" for="kga-alasan">Alasan pencabutan</label><textarea class="field__control" id="kga-alasan" rows="3" maxlength="300" data-autofocus></textarea><p class="field__hint">Ditampilkan pada halaman verifikasi sertifikat.</p></div>',
        actions: [
          { label: 'Batal', variant: 'ghost' },
          { label: 'Cabut Sertifikat', variant: 'danger', onClick: function (close, ctx) { done = true; resolve(ctx.el.querySelector('#kga-alasan').value.trim()); } }
        ],
        onClose: function () { if (!done) resolve(null); }
      });
    });
  }

  /* ------------------------------------------------------------ perancang sertifikat */
  function cq(pt, design) { return (pt * 0.352778 / K().pageSize(design).w * 100).toFixed(3) + 'cqw'; }
  function fontCss(f) { return f === 'sans' ? 'Helvetica, Arial, sans-serif' : "'Times New Roman', Times, serif"; }
  function mountDesigner(slot, ev) {
    var design = null, sel = 'nama', dirty = false;
    var sampleNo = 'PPAPI-SERT-' + ev.tahun + '-' + ev.kode + '-0001';
    var qrSvg = '';
    try { qrSvg = K().qr.svg(K().verifyUrl(sampleNo)); } catch (e) { qrSvg = ''; }
    var api = { ready: null };

    function sampleTexts() { return K().fieldTexts(ev, { nama: 'Nama Peserta', no: sampleNo }, design); }
    function stageHtml() {
      var pg = K().pageSize(design), t = sampleTexts();
      var tpl = design.bg ? '<img class="kga-stage__bg" src="' + h(design.bg) + '" alt="">'
        : '<div class="kga-stage__tpl" aria-hidden="true"><div class="kga-stage__frame"></div>' +
          K().DEFAULT_STATIC.map(function (s) {
            return '<span class="kga-stage__static" style="left:' + (s.x * 100) + '%;top:' + (s.y * 100) + '%;font-size:' + cq(s.size, design) + ';font-family:' + fontCss(s.font) + ';font-weight:' + (s.bold ? 700 : 400) + ';color:' + s.color + ';letter-spacing:' + (s.spacing ? (s.spacing * 0.352778 / pg.w * 100).toFixed(3) + 'cqw' : 'normal') + '">' + h(s.t) + '</span>';
          }).join('') + '</div>';
      var fields = K().FIELD_KEYS.map(function (k) {
        var f = design.fields[k];
        var common = ' data-key="' + k + '" tabindex="0" role="button" aria-label="' + h(K().FIELD_LABEL[k]) + ' — geser untuk memindahkan; tombol panah untuk posisi halus" aria-pressed="' + (sel === k) + '"';
        if (k === 'qr') {
          return '<div class="kga-field kga-field--qr' + (sel === k ? ' is-selected' : '') + (f.on ? '' : ' is-off') + '"' + common + ' style="left:' + (f.x * 100) + '%;top:' + (f.y * 100) + '%;width:' + (f.size * 100) + '%;aspect-ratio:1">' + qrSvg + '</div>';
        }
        return '<div class="kga-field is-wrap' + (sel === k ? ' is-selected' : '') + (f.on ? '' : ' is-off') + '"' + common + ' data-align="' + f.align + '" style="left:' + (f.x * 100) + '%;top:' + (f.y * 100) + '%;font-size:' + cq(f.size, design) +
          ';font-family:' + fontCss(f.font) + ';font-weight:' + (f.bold ? 700 : 400) + ';color:' + f.color + ';text-align:' + f.align + ';width:max-content;max-width:' + (f.w * 100) + '%">' + h(t[k]) + '</div>';
      }).join('');
      return '<div class="kga-stage" data-orient="' + design.orient + '" style="aspect-ratio:' + pg.w + '/' + pg.h + '" data-kgd-stage>' + tpl + fields + '</div>';
    }
    function propsHtml() {
      var f = design.fields[sel];
      var chips = K().FIELD_KEYS.map(function (k) { return '<button type="button" class="chip" data-kgd-pick="' + k + '" aria-pressed="' + (sel === k) + '">' + h(K().FIELD_LABEL[k]) + '</button>'; }).join('');
      var p = '<div class="kga-props">' +
        '<label class="check"><input type="checkbox" data-kgd-prop="on"' + (f.on ? ' checked' : '') + '><span class="check__box"></span><span class="check__label">Tampilkan</span></label>';
      if (sel === 'qr') {
        p += propNum('size', 'Ukuran (% lebar)', Math.round(f.size * 100), 5, 30, 1) + propNum('x', 'Posisi X (%)', +(f.x * 100).toFixed(1), 0, 100, 0.5) + propNum('y', 'Posisi Y (%)', +(f.y * 100).toFixed(1), 0, 100, 0.5);
      } else {
        p += propNum('size', 'Ukuran huruf (pt)', f.size, 6, 72, 1) +
          '<div class="field"><label class="field__label" for="kgd-color">Warna</label><input class="field__control" id="kgd-color" type="color" data-kgd-prop="color" value="' + h(f.color) + '"></div>' +
          '<div class="field"><label class="field__label" for="kgd-align">Perataan</label><select class="field__control" id="kgd-align" data-kgd-prop="align">' +
            [['left', 'Kiri'], ['center', 'Tengah'], ['right', 'Kanan']].map(function (o) { return '<option value="' + o[0] + '"' + (f.align === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
          '<div class="field"><label class="field__label" for="kgd-font">Huruf</label><select class="field__control" id="kgd-font" data-kgd-prop="font"><option value="serif"' + (f.font === 'serif' ? ' selected' : '') + '>Serif (Times)</option><option value="sans"' + (f.font === 'sans' ? ' selected' : '') + '>Sans (Helvetica)</option></select></div>' +
          '<label class="check"><input type="checkbox" data-kgd-prop="bold"' + (f.bold ? ' checked' : '') + '><span class="check__box"></span><span class="check__label">Tebal</span></label>' +
          propNum('w', 'Lebar maks. (%)', Math.round(f.w * 100), 10, 100, 1) +
          propNum('x', 'Posisi X (%)', +(f.x * 100).toFixed(1), 0, 100, 0.5) + propNum('y', 'Posisi Y (%)', +(f.y * 100).toFixed(1), 0, 100, 0.5) +
          '<div class="field"><label class="field__label" for="kgd-prefix">Teks awalan</label><input class="field__control" id="kgd-prefix" type="text" maxlength="60" data-kgd-prop="prefix" value="' + h(f.prefix) + '" placeholder="mis. Nomor: "></div>';
      }
      return '<div class="kga-fieldpick filter-chips" role="group" aria-label="Pilih kolom sertifikat">' + chips + '</div>' + p + '</div>';
    }
    function propNum(prop, label, val, min, max, step) {
      var id = 'kgd-' + prop;
      return '<div class="field"><label class="field__label" for="' + id + '">' + label + '</label><input class="field__control" id="' + id + '" type="number" inputmode="decimal" data-kgd-prop="' + prop + '" value="' + val + '" min="' + min + '" max="' + max + '" step="' + step + '"></div>';
    }
    function paint() {
      slot.innerHTML =
        '<div class="kga-designer kga-designer--split">' +
          '<div class="kga-stage-wrap"><h3 class="form__section-title mt-0">Pratinjau sertifikat</h3>' + stageHtml() +
            '<p class="kga-hint mt-2">Geser kolom pada pratinjau, atau pilih kolom lalu atur di samping. Pratinjau memakai nama "Nama Peserta" dan nomor ' + h(K().certDisplay(sampleNo)) + '.</p></div>' +
          '<div class="kga-controls">' +
            '<div><h3 class="form__section-title mt-0">Desain latar</h3>' +
              '<div class="kga-upload"><label class="btn btn--ghost btn--sm" for="kgd-file">' + icon('upload', { size: 16 }) + '<span>' + (design.bg ? 'Ganti Desain' : 'Unggah Desain') + '</span></label>' +
              '<input class="sr-only" id="kgd-file" type="file" accept="image/png,image/jpeg" data-kgd-file>' +
              (design.bg ? '<button type="button" class="btn btn--link btn--sm" data-kgd="clear-bg"><span>Pakai templat bawaan</span></button>' : '') + '</div>' +
              '<p class="kga-hint mt-2" data-kgd-bginfo>' + (design.bg ? 'Desain ' + design.bgW + '×' + design.bgH + ' px · ' + Math.round(design.bg.length / 1024) + ' KB (setelah dikompresi).' : 'Belum ada desain unggahan; dipakai templat bawaan PPAPI.') +
              ' PNG atau JPEG, sebaiknya ukuran A4 (mis. 3508×2480 px). Gambar dikompresi otomatis hingga ≤ 900 KB.</p>' +
              (design.bg ? '' : '<div class="field mt-3"><label class="field__label" for="kgd-orient">Orientasi</label><select class="field__control" id="kgd-orient" data-kgd-orient><option value="landscape"' + (design.orient === 'landscape' ? ' selected' : '') + '>Lanskap</option><option value="portrait"' + (design.orient === 'portrait' ? ' selected' : '') + '>Potret</option></select></div>') +
            '</div>' +
            '<div><h3 class="form__section-title mt-0">Kolom: ' + h(K().FIELD_LABEL[sel]) + '</h3>' + propsHtml() + '</div>' +
            '<div class="cluster"><button type="button" class="btn btn--primary btn--sm" data-kgd="save">' + icon('check', { size: 16 }) + '<span>Simpan Desain</span></button>' +
              '<button type="button" class="btn btn--ghost btn--sm" data-kgd="sample">' + icon('download', { size: 16 }) + '<span>Unduh PDF Pratinjau</span></button>' +
              '<button type="button" class="btn btn--link btn--sm" data-kgd="reset"><span>Tata letak bawaan</span></button></div>' +
            '<p class="kga-hint" data-kgd-state aria-live="polite">' + (dirty ? 'Ada perubahan yang belum disimpan.' : (design.updatedAt ? 'Tersimpan.' : 'Belum disimpan — peserta memakai tata letak bawaan.')) + '</p>' +
          '</div>' +
        '</div>';
      ui().reveal(slot);
    }
    function markDirty() { dirty = true; var s = slot.querySelector('[data-kgd-state]'); if (s) s.textContent = 'Ada perubahan yang belum disimpan.'; }
    function refreshStage() {
      var st = slot.querySelector('[data-kgd-stage]');
      if (!st) return paint();
      var wrap = d.createElement('div'); wrap.innerHTML = stageHtml();
      st.replaceWith(wrap.firstChild);
    }
    function syncPosInputs() {
      var f = design.fields[sel];
      var x = slot.querySelector('[data-kgd-prop="x"]'), y = slot.querySelector('[data-kgd-prop="y"]');
      if (x) x.value = +(f.x * 100).toFixed(1);
      if (y) y.value = +(f.y * 100).toFixed(1);
    }
    function select(k) { sel = k; paint(); var el = slot.querySelector('.kga-field[data-key="' + k + '"]'); if (el) el.focus({ preventScroll: true }); }

    /* geser (pointer) */
    var drag = null;
    slot.addEventListener('pointerdown', function (e) {
      var fe = e.target.closest('.kga-field');
      if (!fe) return;
      var k = fe.getAttribute('data-key');
      if (k !== sel) { sel = k; paint(); fe = slot.querySelector('.kga-field[data-key="' + k + '"]'); }
      var stage = slot.querySelector('[data-kgd-stage]'), r = stage.getBoundingClientRect();
      drag = { k: k, el: fe, r: r, sx: e.clientX, sy: e.clientY, x0: design.fields[k].x, y0: design.fields[k].y, id: e.pointerId };
      try { fe.setPointerCapture(e.pointerId); } catch (er) { /* abaikan */ }
      fe.classList.add('is-dragging');
      e.preventDefault();
    });
    slot.addEventListener('pointermove', function (e) {
      if (!drag || e.pointerId !== drag.id) return;
      var f = design.fields[drag.k];
      f.x = Math.min(1, Math.max(0, drag.x0 + (e.clientX - drag.sx) / drag.r.width));
      f.y = Math.min(1, Math.max(0, drag.y0 + (e.clientY - drag.sy) / drag.r.height));
      drag.el.style.left = (f.x * 100) + '%';
      drag.el.style.top = (f.y * 100) + '%';
      syncPosInputs();
    });
    function endDrag(e) {
      if (!drag || (e && e.pointerId !== drag.id)) return;
      drag.el.classList.remove('is-dragging');
      if (drag.x0 !== design.fields[drag.k].x || drag.y0 !== design.fields[drag.k].y) markDirty();
      drag = null;
    }
    slot.addEventListener('pointerup', endDrag);
    slot.addEventListener('pointercancel', endDrag);
    slot.addEventListener('keydown', function (e) {
      var fe = e.target.closest('.kga-field');
      if (!fe) return;
      var k = fe.getAttribute('data-key');
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (k !== sel) select(k); return; }
      var step = e.shiftKey ? 0.02 : 0.005, f = design.fields[k], dx = 0, dy = 0;
      if (e.key === 'ArrowLeft') dx = -step; else if (e.key === 'ArrowRight') dx = step; else if (e.key === 'ArrowUp') dy = -step; else if (e.key === 'ArrowDown') dy = step; else return;
      e.preventDefault();
      if (k !== sel) { sel = k; }
      f.x = Math.min(1, Math.max(0, f.x + dx)); f.y = Math.min(1, Math.max(0, f.y + dy));
      fe.style.left = (f.x * 100) + '%'; fe.style.top = (f.y * 100) + '%';
      syncPosInputs(); markDirty();
    });
    slot.addEventListener('input', function (e) {
      var t = e.target, prop = t.getAttribute('data-kgd-prop');
      if (!prop) return;
      var f = design.fields[sel];
      if (prop === 'on' || prop === 'bold') f[prop] = t.checked;
      else if (prop === 'x' || prop === 'y' || prop === 'w' || (prop === 'size' && sel === 'qr')) { var n = parseFloat(t.value); if (isFinite(n)) f[prop] = n / 100; }
      else if (prop === 'size') { var n2 = parseFloat(t.value); if (isFinite(n2)) f.size = Math.min(72, Math.max(6, n2)); }
      else f[prop] = t.value;
      design = K().normDesign(design);
      refreshStage(); markDirty();
    });
    slot.addEventListener('change', async function (e) {
      var t = e.target;
      if (t.hasAttribute('data-kgd-orient')) { design.orient = t.value === 'portrait' ? 'portrait' : 'landscape'; markDirty(); paint(); return; }
      if (!t.hasAttribute('data-kgd-file') || !t.files || !t.files[0]) return;
      var info = slot.querySelector('[data-kgd-bginfo]');
      if (info) info.textContent = 'Mengompresi gambar…';
      try {
        var r = await K().compressImage(t.files[0]);
        design.bg = r.dataUrl; design.bgW = r.w; design.bgH = r.h; design.orient = r.orient;
        markDirty(); paint();
        ui().toast('Desain dimuat (' + Math.round(r.chars / 1024) + ' KB). Atur posisi kolom, lalu simpan.', { type: 'success' });
      } catch (err) { ui().toast(err.message, { type: 'error' }); paint(); }
    });
    slot.addEventListener('click', async function (e) {
      var pick = e.target.closest('[data-kgd-pick]');
      if (pick) { select(pick.getAttribute('data-kgd-pick')); return; }
      var b = e.target.closest('[data-kgd]');
      if (!b) return;
      var kind = b.getAttribute('data-kgd');
      if (kind === 'clear-bg') { design.bg = ''; design.bgW = 0; design.bgH = 0; markDirty(); paint(); return; }
      if (kind === 'reset') { var bg = { bg: design.bg, bgW: design.bgW, bgH: design.bgH, orient: design.orient }; design = Object.assign(K().defaultDesign(), bg); markDirty(); paint(); return; }
      ui().setLoading(b, true, kind === 'save' ? 'Menyimpan…' : 'Menyiapkan PDF…');
      try {
        if (kind === 'save') {
          design = await K().admin.saveDesign(ev.id, design);
          dirty = false;
          ui().toast('Desain sertifikat disimpan.', { type: 'success' });
          paint();
        } else if (kind === 'sample') {
          var s = await K().admin.samplePdf(ev, design);
          K().saveBlob(s.blob, s.fileName);
          ui().toast('PDF pratinjau diunduh.', { type: 'success' });
          ui().setLoading(b, false);
        }
      } catch (err) { console.error(err); ui().toast(err.message || 'Gagal.', { type: 'error' }); if (b.isConnected) ui().setLoading(b, false); }
    });
    api.ready = K().admin.getDesign(ev.id).then(function (x) { design = x; paint(); }, function (err) { design = K().defaultDesign(); paint(); ui().toast(err.message, { type: 'error' }); });
    return api;
  }

  /* ------------------------------------------------------------ bagian konsol */
  function render(container) {
    ensureCss();
    if (!w.PPAPI || !K()) { container.innerHTML = '<div class="alert alert--err" role="alert"><div><p>Modul kegiatan belum dimuat (store-kegiatan.js).</p></div></div>'; return; }
    S.root = container;
    container.innerHTML = '<div class="kga">' +
      '<div class="kga-toolbar">' +
        '<div class="kga-toolbar__filters">' +
          '<div class="field adm-search"><label class="sr-only" for="kga-q">Cari kegiatan</label><div class="search-box">' + icon('search', { size: 18 }) +
            '<input class="field__control" type="search" id="kga-q" placeholder="Cari judul, jenis, atau kode" value="' + h(S.q) + '" autocomplete="off">' +
            '<button type="button" class="search-box__clear" aria-label="Hapus pencarian"' + (S.q ? '' : ' hidden') + '>' + icon('close', { size: 16 }) + '</button></div></div>' +
          '<div class="filter-chips" role="group" aria-label="Saring status kegiatan" data-kga-chips></div>' +
        '</div>' +
        '<button type="button" class="btn btn--primary btn--sm" data-kga="new">' + icon('plus', { size: 16 }) + '<span>Tambah Kegiatan</span></button>' +
      '</div>' +
      '<p class="kga-count" data-kga-count aria-live="polite"></p>' +
      '<div data-kga-list>' + ui().skeleton(4) + '</div>' +
    '</div>';
    if (!container.__kgaBound) {
      container.__kgaBound = true;
      container.addEventListener('click', function (e) {
        var c = e.target.closest('[data-kga-status]');
        if (c) { S.status = c.getAttribute('data-kga-status'); renderList(); return; }
        var b = e.target.closest('[data-kga]');
        if (!b) return;
        var kind = b.getAttribute('data-kga'), id = b.getAttribute('data-id');
        if (kind === 'new') openForm(null, function (saved) { openManage(saved.id, 'sertifikat'); });
        else if (kind === 'edit') K().admin.get(id).then(function (ev) { openForm(ev); }, function (err) { ui().toast(err.message, { type: 'error' }); });
        else if (kind === 'manage') openManage(id);
      });
      container.addEventListener('input', P().util.debounce(function (e) {
        if (e.target.id !== 'kga-q') return;
        S.q = e.target.value.trim();
        var clr = e.target.parentNode.querySelector('.search-box__clear');
        if (clr) clr.hidden = !S.q;
        renderList();
      }, 200));
    }
    return reload();
  }

  var SECTION = {
    key: 'kegiatan', label: 'Kegiatan', icon: 'calendar',
    title: 'Kelola <em>kegiatan</em>',
    lead: 'Webinar, pelatihan, dan seminar: pendaftaran peserta, daftar hadir otomatis, dan sertifikat PDF.',
    render: render,
    openManage: openManage, openForm: openForm
  };
  w.PPAPI_ADMIN_SECTIONS = (w.PPAPI_ADMIN_SECTIONS || []).concat(SECTION);
})(window, document);
