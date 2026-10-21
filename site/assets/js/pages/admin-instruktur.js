/* ==========================================================================
   PPAPI — admin-instruktur.js  (Konsol Admin: Instruktur)
   Sub-tabs  #instruktur/profil      profil instruktur: tambah, ubah, terbitkan /
                                     tarik, hapus (opsional ditautkan ke akun
                                     anggota & KTA; foto JPEG ≤ 150 KB)
             #instruktur/permintaan  permintaan instruktur dari mitra: status
                                     Baru/Diproses/Selesai, catatan, balas email
   Data: PPAPI.instruktur (store-instruktur.js). Helpers: PPAPI_KONSOL (admin.js).
   Export: window.PPAPI_ADMIN_SECTIONS += { key:'instruktur', label, icon, render(container, sub), count() }
           and, when admin.js is present, PPAPI_KONSOL.sections.instruktur.
   Load AFTER admin.js and store-instruktur.js. Styles: pages/admin-instruktur.css
   (linked automatically when the page does not link it).
   Every data string is escaped with PPAPI.util.h().
   ========================================================================== */
(function (w, d) {
  'use strict';

  var PPAPI = w.PPAPI;
  if (!PPAPI || !PPAPI.util) return;
  var util = PPAPI.util, ui = PPAPI.ui, h = util.h, icon = PPAPI.icon;
  function K() { return w.PPAPI_KONSOL || null; }
  function api() { return PPAPI.instruktur; }

  /* own stylesheet (the console page may not link it yet) */
  (function ensureCss() {
    if (d.querySelector('link[href$="admin-instruktur.css"]')) return;
    var l = d.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'assets/css/pages/admin-instruktur.css';
    (d.head || d.documentElement).appendChild(l);
  })();

  var S = { tab: 'profil', ins: null, req: null, errIns: null, errReq: null, loading: null, loadedAt: 0, insQ: '', insPub: '', reqQ: '', reqStatus: '' };
  var container = null;

  function load(force) {
    if (S.loading) return S.loading;
    if (!force && S.ins && S.req && Date.now() - S.loadedAt < 30000) return Promise.resolve();
    S.loading = Promise.all([
      api().admin.list().then(function (v) { S.ins = v; S.errIns = null; }, function (e) { console.error(e); S.errIns = e; S.ins = S.ins || []; }),
      api().requests.list().then(function (v) { S.req = v; S.errReq = null; }, function (e) { console.error(e); S.errReq = e; S.req = S.req || []; })
    ]).then(function () { S.loadedAt = Date.now(); S.loading = null; updateCount(); });
    return S.loading;
  }
  function newCount() { return (S.req || []).filter(function (r) { return r.status === 'Baru'; }).length; }
  function updateCount() {
    var n = newCount();
    var el = d.querySelector('[data-count-for="instruktur"]');
    if (el) { el.hidden = !n; el.innerHTML = n ? h(util.formatNumber(n)) + '<span class="sr-only"> permintaan instruktur baru</span>' : ''; }
  }
  /* "Muat Ulang Data" in the console hero → fresh data next render */
  d.addEventListener('click', function (e) { if (e.target.closest && e.target.closest('#adm-refresh')) S.loadedAt = 0; }, true);

  function setSub(sub) {
    var k = K();
    if (k && k.setSub) k.setSub('instruktur', sub);
    else { try { w.history.replaceState(null, '', '#instruktur/' + sub); } catch (e) { /* ignore */ } }
  }
  function rerender() { if (container && d.contains(container)) section.render(container, S.tab); }
  function toast(msg, type) { ui.toast(msg, { type: type || 'success' }); var k = K(); if (k && k.announce) k.announce(msg); }
  function kompName(c) { var k = api().kompetensi(c); return k ? k.nama : c; }
  function statusBadge(it) { return it.published ? '<span class="badge badge--ok">Terbit</span>' : '<span class="badge badge--muted">Draf</span>'; }
  function reqBadge(s) { return '<span class="badge badge--' + (s === 'Baru' ? 'warn' : s === 'Diproses' ? 'outline' : 'ok') + '">' + h(s) + '</span>'; }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function match(hay, q) { var t = norm(hay); return norm(q).split(/\s+/).filter(Boolean).every(function (w2) { return t.indexOf(w2) !== -1; }); }
  function avatar(it) {
    return it.foto
      ? '<span class="avatar adm-person__avatar" aria-hidden="true"><img src="' + h(it.foto) + '" alt="" width="36" height="36" decoding="async"></span>'
      : '<span class="avatar adm-person__avatar" aria-hidden="true">' + h(util.initials(it.nama || '?')) + '</span>';
  }
  function skeleton() { return '<div class="skeleton" role="status"><span class="sr-only">Memuat data instruktur…</span><span class="skeleton__line"></span><span class="skeleton__line"></span><span class="skeleton__line"></span></div>'; }
  function errorBox(e, what) {
    var k = K();
    if (k && k.errorBox) return k.errorBox(e, what).replace('data-adm-retry', 'data-ins-retry');
    return '<div class="alert alert--err" role="alert"><div><p class="alert__title">' + h(what) + '</p><p>' + h(e && e.message) + '</p></div></div>';
  }

  /* =====================================================================
     RENDER
     ===================================================================== */
  var section = {
    key: 'instruktur', label: 'Instruktur', icon: 'award',
    count: function () { return newCount(); },
    render: function (body, sub) {
      container = body;
      var k = K();
      if (!api() || !k || !k.field) {
        body.innerHTML = '<div class="alert alert--err" role="alert"><div><p class="alert__title">Modul instruktur belum lengkap</p><p>Muat store-instruktur.js dan admin.js sebelum admin-instruktur.js.</p></div></div>';
        return;
      }
      S.tab = sub === 'permintaan' ? 'permintaan' : 'profil';
      if (sub !== S.tab) setSub(S.tab);
      var have = S.ins && S.req;
      var nIns = S.ins ? S.ins.length : null, nNew = S.req ? newCount() : null;
      body.innerHTML =
        '<nav class="adm-subnav" aria-label="Bagian instruktur"><ul class="adm-subnav__list" role="list">' +
          '<li><a class="adm-subnav__link" href="#instruktur/profil" data-ins-tab="profil"' + (S.tab === 'profil' ? ' aria-current="page"' : '') + '>' + icon('award', { size: 16 }) + '<span>Profil Instruktur</span>' + (nIns !== null ? '<span class="adm-subnav__count">' + h(util.formatNumber(nIns)) + '<span class="sr-only"> profil</span></span>' : '') + '</a></li>' +
          '<li><a class="adm-subnav__link" href="#instruktur/permintaan" data-ins-tab="permintaan"' + (S.tab === 'permintaan' ? ' aria-current="page"' : '') + '>' + icon('mail', { size: 16 }) + '<span>Permintaan Mitra</span>' + (nNew ? '<span class="adm-subnav__count">' + h(util.formatNumber(nNew)) + '<span class="sr-only"> baru</span></span>' : '') + '</a></li>' +
        '</ul></nav>' +
        (k.isDemo && k.isDemo() ? '<p class="adm-hint adm-demo-note">' + icon('info', { size: 15 }) + '<span><strong>Mode Demo.</strong> Data instruktur dan permintaan hanya tersimpan di peramban ini.</span></p>' : '') +
        '<div id="ins-pane">' + (have ? '' : skeleton()) + '</div>';
      util.$$('[data-ins-tab]', body).forEach(function (a) {
        a.addEventListener('click', function (e) {
          e.preventDefault();
          var t = a.getAttribute('data-ins-tab');
          if (t === S.tab) return;
          S.tab = t;
          setSub(t);
          rerender();
          var cur = body.querySelector('[data-ins-tab][aria-current="page"]');
          if (cur) cur.focus();
        });
      });
      body.addEventListener('click', onRetry);
      if (have) paintPane();
      if (!have || Date.now() - S.loadedAt > 30000) load().then(function () { if (container === body && d.contains(body)) { if (have) paintPane(); else rerender(); } });
    }
  };
  function onRetry(e) { if (e.target.closest('[data-ins-retry]')) { e.preventDefault(); S.loadedAt = 0; load(true).then(rerender); } }
  function paintPane() {
    var pane = d.getElementById('ins-pane');
    if (!pane) return;
    if (S.tab === 'permintaan') paintRequests(pane); else paintProfiles(pane);
    ui.reveal(pane);
  }

  /* ------------------------------------------------------------ profil */
  function paintProfiles(pane) {
    var k = K();
    if (S.errIns) { pane.innerHTML = errorBox(S.errIns, 'Profil instruktur belum dapat dimuat'); return; }
    var all = S.ins || [];
    var counts = { '': all.length, terbit: all.filter(function (x) { return x.published; }).length };
    counts.draf = all.length - counts.terbit;
    pane.innerHTML =
      '<div class="adm-toolbar">' +
        k.chips({ label: 'Saring status profil', name: 'ins-pub', value: S.insPub, items: [{ value: '', label: 'Semua', count: counts[''] }, { value: 'terbit', label: 'Terbit', count: counts.terbit }, { value: 'draf', label: 'Draf', count: counts.draf }] }) +
        '<div class="adm-toolbar__row">' + k.searchBox({ id: 'ins-q', label: 'Cari instruktur', placeholder: 'Cari nama, kompetensi, atau wilayah', value: S.insQ }) +
          '<button type="button" class="btn btn--primary btn--sm adm-new" id="ins-add">' + icon('plus', { size: 16 }) + '<span>Tambah Instruktur</span></button></div>' +
      '</div><div id="ins-list"></div>';
    var listEl = d.getElementById('ins-list');
    function paint() {
      var list = all.filter(function (it) {
        if (S.insPub === 'terbit' && !it.published) return false;
        if (S.insPub === 'draf' && it.published) return false;
        return match([it.nama, it.gelar, it.kta, (it.wilayah || []).join(' '), (it.kompetensi || []).map(kompName).join(' '), (it.bidang || []).join(' ')].join(' '), S.insQ);
      });
      if (!all.length) {
        listEl.innerHTML = k.empty({ icon: 'award', title: 'Belum ada profil instruktur', text: 'Daftarkan instruktur yang kompetensi dan sertifikatnya telah diperiksa. Profil tampil di halaman Instruktur setelah diterbitkan.', actionHtml: '<a class="btn btn--ghost btn--sm" href="instruktur.html" target="_blank" rel="noopener"><span>Lihat halaman Instruktur</span>' + icon('arrow-up-right', { size: 16, cls: 'btn__icon' }) + '</a>' });
        return;
      }
      if (!list.length) { listEl.innerHTML = k.empty({ icon: 'search', title: 'Tidak ada yang cocok', text: 'Ubah kata kunci atau saringan status.' }); return; }
      listEl.innerHTML = '<p class="adm-count">' + h(k.plural(list.length, 'profil')) + ' · ' + h(util.formatNumber(counts.terbit)) + ' terbit</p>' +
        '<div class="table-wrap"><table class="table adm-table"><caption class="sr-only">Daftar profil instruktur</caption><thead><tr>' +
        '<th scope="col">Instruktur</th><th scope="col">Bidang</th><th scope="col">Wilayah</th><th scope="col">Status</th><th scope="col">Diperbarui</th><th scope="col"><span class="sr-only">Aksi</span></th></tr></thead><tbody>' +
        list.map(function (it) {
          var wil = (it.wilayah || []).indexOf(api().SELURUH) !== -1 ? api().SELURUH : (it.wilayah || []).slice(0, 2).join(', ') + ((it.wilayah || []).length > 2 ? ' +' + (it.wilayah.length - 2) : '');
          var b = function (act, label, cls, ic) { return '<button type="button" class="adm-act adm-act--icon' + (cls ? ' ' + cls : '') + '" data-ins-act="' + act + '" data-id="' + h(it.id) + '" title="' + label + '">' + icon(ic, { size: 15 }) + '<span class="adm-act__label">' + label + '<span class="sr-only"> ' + h(it.nama) + '</span></span></button>'; };
          return '<tr data-row="' + h(it.id) + '"><td><div class="adm-person">' + avatar(it) + '<div class="adm-person__text"><span class="adm-person__line"><button type="button" class="adm-person__name" data-ins-act="edit" data-id="' + h(it.id) + '">' + h(it.nama) + '</button>' + (it.kta ? ' <span class="badge badge--metal">KTA</span>' : '') + '</span><span class="adm-person__sub">' + h(it.gelar) + '</span></div></div></td>' +
            '<td data-label="Bidang">' + ((it.bidang || []).map(function (x) { return '<span class="tag">' + h(x) + '</span>'; }).join(' ') || '<span class="adm-dim">—</span>') + '</td>' +
            '<td data-label="Wilayah">' + h(wil || '—') + '</td>' +
            '<td data-label="Status">' + statusBadge(it) + '</td>' +
            '<td data-label="Diperbarui">' + k.timeTag(it.updatedAt) + '</td>' +
            '<td class="adm-table__actions"><span class="adm-acts adm-acts--icons">' + b('edit', 'Ubah', 'adm-act--strong', 'edit') +
              (it.published ? b('unpublish', 'Tarik dari situs', '', 'eye-off') : b('publish', 'Terbitkan', '', 'eye')) +
              b('delete', 'Hapus', 'adm-act--danger', 'trash') +
              (it.published ? '<a class="adm-act adm-act--icon" href="instruktur.html?id=' + h(encodeURIComponent(it.id)) + '" target="_blank" rel="noopener" title="Lihat di situs">' + icon('arrow-up-right', { size: 15 }) + '<span class="adm-act__label">Lihat<span class="sr-only"> ' + h(it.nama) + ' di situs (membuka tab baru)</span></span></a>' : '') +
            '</span></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    paint();
    k.bindChips(pane, 'ins-pub', function (v) { S.insPub = v; paint(); });
    k.bindSearch(pane, 'ins-q', function (v) { S.insQ = v; paint(); });
    d.getElementById('ins-add').addEventListener('click', function () { editDialog(null); });
    listEl.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-ins-act]');
      if (!btn) return;
      var it = (S.ins || []).filter(function (x) { return x.id === btn.getAttribute('data-id'); })[0];
      if (!it) return;
      var act = btn.getAttribute('data-ins-act');
      if (act === 'edit') editDialog(it);
      else if (act === 'publish' || act === 'unpublish') togglePublish(it, act === 'publish', btn);
      else if (act === 'delete') removeIt(it, btn);
    });
  }
  async function after(msg, selector) {
    S.loadedAt = 0;
    await load(true);
    var k = K();
    if (k && k.load) { try { await k.load(['audit']); } catch (e) { /* ignore */ } }
    rerender();
    if (msg) toast(msg);
    if (k && k.restoreFocus) k.restoreFocus(selector);
  }
  async function togglePublish(it, pub, btn) {
    if (!pub) {
      var ok = await ui.confirm('Tarik profil "' + it.nama + '" dari halaman Instruktur? Profil tetap tersimpan sebagai draf.', { title: 'Tarik profil', okLabel: 'Ya, tarik' });
      if (!ok) return;
    }
    ui.setLoading(btn, true, '');
    try {
      await api().admin.setPublished(it.id, pub);
      await after(pub ? 'Profil ' + it.nama + ' kini tampil di halaman Instruktur.' : 'Profil ' + it.nama + ' ditarik dari situs.', '[data-row="' + it.id + '"] [data-ins-act]');
    } catch (err) { ui.setLoading(btn, false); ui.toast(err.message || 'Belum berhasil.', { type: 'error' }); }
  }
  async function removeIt(it, btn) {
    var ok = await ui.confirm('Hapus profil "' + it.nama + '" beserta kontak tersimpannya? Tindakan ini tidak dapat dibatalkan.', { title: 'Hapus profil instruktur', okLabel: 'Ya, hapus', danger: true });
    if (!ok) return;
    ui.setLoading(btn, true, '');
    try { await api().admin.remove(it.id); await after('Profil ' + it.nama + ' dihapus.', '#ins-add'); }
    catch (err) { ui.setLoading(btn, false); ui.toast(err.message || 'Belum berhasil.', { type: 'error' }); }
  }

  /* ------------------------------------------------------- form profil */
  function checkList(name, items, selected, cls) {
    return '<div class="ains-checks' + (cls ? ' ' + cls : '') + '">' + items.map(function (op) {
      var v = typeof op === 'object' ? op.value : op, l = typeof op === 'object' ? op.label : op;
      return '<label class="check"><input type="checkbox" name="' + h(name) + '" value="' + h(v) + '"' + (selected.indexOf(v) !== -1 ? ' checked' : '') + '><span class="check__box" aria-hidden="true"></span><span class="check__label">' + h(l) + '</span></label>';
    }).join('') + '</div>';
  }
  function group(title, hint, inner, id) {
    return '<fieldset class="ains-group"' + (id ? ' id="' + id + '"' : '') + '><legend class="ains-legend">' + h(title) + '</legend>' + (hint ? '<p class="ains-hint">' + hint + '</p>' : '') + inner + '<p class="field__error ains-group__err" data-group-err></p></fieldset>';
  }
  function certRow(c) {
    c = c || {};
    var opts = api().penerbit();
    if (c.penerbit && opts.indexOf(c.penerbit) === -1) opts.push(c.penerbit);
    var n = 'c' + Math.random().toString(36).slice(2, 8);
    return '<div class="ains-cert" data-cert>' +
      '<div class="field"><label class="field__label" for="' + n + '-n">Nama sertifikat</label><input class="field__control" id="' + n + '-n" data-cert-f="nama" maxlength="160" value="' + h(c.nama || '') + '" placeholder="Misalnya: Ahli K3 Konstruksi Madya"></div>' +
      '<div class="field"><label class="field__label" for="' + n + '-p">Penerbit</label><select class="field__control" id="' + n + '-p" data-cert-f="penerbit">' + ['<option value="">—</option>'].concat(opts.map(function (o) { return '<option value="' + h(o) + '"' + (o === c.penerbit ? ' selected' : '') + '>' + h(o) + '</option>'; })).join('') + '</select></div>' +
      '<div class="field"><label class="field__label" for="' + n + '-b">Berlaku hingga</label><input class="field__control" type="date" id="' + n + '-b" data-cert-f="berlakuHingga" value="' + h(c.berlakuHingga || '') + '" aria-describedby="' + n + '-bh"><p class="field__hint" id="' + n + '-bh">Kosongkan bila tanpa batas.</p></div>' +
      '<button type="button" class="adm-act adm-act--icon adm-act--danger ains-cert__del" data-cert-del title="Hapus sertifikat">' + icon('trash', { size: 15 }) + '<span class="adm-act__label">Hapus<span class="sr-only"> sertifikat ini</span></span></button></div>';
  }
  function memberOptions(current) {
    var k = K();
    var members = (k && k.state && k.state.members || []).filter(function (m) { return util.isActiveMember(m) || m.uid === current; });
    return [{ value: '', label: 'Tidak ditautkan' }].concat(members.map(function (m) { return { value: m.uid, label: (m.name || m.email || m.uid) + (m.kta ? ' · ' + m.kta : '') }; }));
  }
  async function editDialog(it) {
    var k = K();
    var v = it || { nama: '', gelar: '', foto: '', kompetensi: [], sertifikasi: [], pengalamanTahun: null, wilayah: [], bahasa: ['Indonesia'], metode: ['Luring'], materi: [], bio: '', kta: '', published: false };
    var kontak = { email: '', telepon: '', memberUid: '', catatan: '' };
    if (it) { try { kontak = await api().admin.getContact(it.id); } catch (e) { console.warn(e); } }
    var foto = v.foto || '';
    var F = k.field;
    var groups = {};
    api().katalog().forEach(function (x) { (groups[x.kelompok] = groups[x.kelompok] || []).push(x); });
    var kompHtml = Object.keys(groups).map(function (g) {
      return '<div class="ains-kgroup"><p class="ains-kgroup__title">' + h(g) + '</p>' + checkList('kompetensi', groups[g].map(function (x) { return { value: x.kode, label: x.nama }; }), v.kompetensi || []) + '</div>';
    }).join('');
    var seluruh = (v.wilayah || []).indexOf(api().SELURUH) !== -1;
    var fields =
      '<p class="adm-form__note">Kolom bertanda <span class="field__req" aria-hidden="true">*</span><span class="sr-only">bintang</span> wajib diisi. Kontak pribadi hanya tersimpan untuk sekretariat dan tidak tampil di situs.</p>' +
      group('Identitas', '',
        '<div class="ains-photo">' +
          '<div class="ains-photo__preview" data-photo-preview>' + (foto ? '<img src="' + h(foto) + '" alt="Foto ' + h(v.nama) + '" width="96" height="96">' : '<span aria-hidden="true">' + icon('user', { size: 28 }) + '</span>') + '</div>' +
          '<div class="ains-photo__ctl"><label class="btn btn--ghost btn--sm ains-photo__pick"><input type="file" accept="image/jpeg,image/png,image/webp" class="sr-only" data-photo-input aria-describedby="ains-photo-hint">' + icon('upload', { size: 16 }) + '<span>Pilih foto</span></label>' +
          '<button type="button" class="btn btn--link btn--sm" data-photo-remove' + (foto ? '' : ' hidden') + '><span>Hapus foto</span></button>' +
          '<p class="field__hint" id="ains-photo-hint">Opsional. Foto diperkecil otomatis menjadi JPEG maksimal 150 KB dan tampil hitam-putih.</p><p class="field__error" data-photo-err role="alert"></p></div>' +
        '</div>' +
        F({ name: 'nama', label: 'Nama lengkap', required: true, minlength: 3, value: v.nama, maxlength: 120 }) +
        F({ name: 'gelar', label: 'Jabatan atau keahlian utama', required: true, minlength: 3, value: v.gelar, maxlength: 120, placeholder: 'Misalnya: Inspektur Scaffolding · Instruktur K3 Konstruksi' }) +
        '<div class="form__row form__row--2">' +
          F({ name: 'memberUid', label: 'Akun anggota PPAPI', type: 'select', optional: true, value: kontak.memberUid, options: memberOptions(kontak.memberUid), hint: 'Hanya anggota berstatus Aktif. Nomor KTA terisi otomatis.' }) +
          F({ name: 'kta', label: 'Nomor KTA', optional: true, value: v.kta, maxlength: 20, placeholder: 'PPAPI-2026-000123', hint: 'Menampilkan tautan Verifikasi KTA di profil publik.' }) +
        '</div>') +
      group('Kompetensi *', 'Pilih minimal satu kompetensi dari katalog PPAPI. Bidang ditentukan otomatis dari kompetensi yang dipilih.', kompHtml, 'ains-g-komp') +
      group('Pengalaman & materi', '',
        F({ name: 'pengalamanTahun', label: 'Pengalaman di bidang perancah (tahun)', type: 'number', optional: true, min: 0, max: 60, value: v.pengalamanTahun === null || v.pengalamanTahun === undefined ? '' : v.pengalamanTahun }) +
        F({ name: 'materi', label: 'Materi yang diampu', type: 'textarea', rows: 4, optional: true, value: (v.materi || []).join('\n'), hint: 'Satu materi per baris, maksimal 10.' }) +
        F({ name: 'bio', label: 'Profil singkat', type: 'textarea', rows: 4, required: true, minlength: 20, value: v.bio, maxlength: 600, counter: true, hint: 'Tampil di halaman publik. Jangan mencantumkan nomor telepon atau alamat pribadi.' })) +
      group('Sertifikasi', 'Maksimal 10 sertifikat. Status (aktif, segera kedaluwarsa, kedaluwarsa) dihitung dari tanggal berlaku.',
        '<div class="ains-certs" data-certs>' + (v.sertifikasi || []).map(certRow).join('') + '</div>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-cert-add>' + icon('plus', { size: 16 }) + '<span>Tambah sertifikat</span></button>') +
      group('Metode & bahasa *', '', '<p class="ains-sub">Metode pelatihan</p>' + checkList('metode', api().METODE, v.metode || []) + '<p class="ains-sub">Bahasa pengantar</p>' + checkList('bahasa', api().BAHASA, v.bahasa || []), 'ains-g-metode') +
      group('Wilayah layanan *', '',
        '<label class="check ains-all"><input type="checkbox" name="seluruh" data-seluruh' + (seluruh ? ' checked' : '') + '><span class="check__box" aria-hidden="true"></span><span class="check__label">' + h(api().SELURUH) + '</span></label>' +
        checkList('wilayah', api().provinsi(), seluruh ? [] : (v.wilayah || []), 'ains-checks--prov'), 'ains-g-wil') +
      group('Kontak (khusus sekretariat)', 'Tidak pernah ditampilkan kepada publik. Dipakai sekretariat untuk meneruskan permintaan mitra.',
        '<div class="form__row form__row--2">' + F({ name: 'kEmail', label: 'Email instruktur', type: 'email', optional: true, value: kontak.email, maxlength: 200 }) +
          F({ name: 'kTelepon', label: 'Telepon instruktur', optional: true, value: kontak.telepon, maxlength: 24 }) + '</div>' +
        F({ name: 'kCatatan', label: 'Catatan internal', type: 'textarea', rows: 3, optional: true, value: kontak.catatan, maxlength: 1000 })) +
      '<div class="adm-checks ains-publish">' + k.check({ name: 'published', label: 'Terbitkan di halaman Instruktur', hint: 'Bila tidak dicentang, profil tersimpan sebagai draf dan hanya terlihat oleh admin.', checked: !!v.published }) + '</div>';

    function groupErr(form, id, msg) {
      var g = form.querySelector('#' + id);
      if (!g) return;
      g.classList.toggle('is-invalid', !!msg);
      var e = g.querySelector('[data-group-err]');
      if (e) e.textContent = msg || '';
    }
    function vals(form, name) { return util.$$('input[name="' + name + '"]:checked', form).map(function (x) { return x.value; }); }
    var res = await k.formDialog({
      title: it ? 'Ubah profil instruktur' : 'Tambah instruktur', eyebrow: 'Instruktur', size: 'lg', submitLabel: it ? 'Simpan perubahan' : 'Simpan profil', submitId: 'ins-save',
      fields: fields,
      extraCheck: function (el2, value) {
        if (el2.name === 'kta' && value && !/^PPAPI-\d{4}-\d{6}$/i.test(value.replace(/\s+/g, ''))) return 'Format KTA: PPAPI-TAHUN-NOMOR (6 angka).';
        return '';
      },
      check: function (form) {
        var bad = null;
        var c1 = vals(form, 'kompetensi').length ? '' : 'Pilih minimal satu kompetensi.';
        groupErr(form, 'ains-g-komp', c1);
        var c2 = vals(form, 'metode').length ? '' : 'Pilih minimal satu metode pelatihan.';
        groupErr(form, 'ains-g-metode', c2);
        var c3 = form.querySelector('[data-seluruh]').checked || vals(form, 'wilayah').length ? '' : 'Pilih wilayah layanan atau centang Seluruh Indonesia.';
        groupErr(form, 'ains-g-wil', c3);
        if (c1) bad = form.querySelector('input[name="kompetensi"]');
        else if (c2) bad = form.querySelector('input[name="metode"]');
        else if (c3) bad = form.querySelector('[data-seluruh]');
        if (bad) bad.focus();
        return bad;
      },
      onOpen: function (root, form) {
        var preview = form.querySelector('[data-photo-preview]'), input = form.querySelector('[data-photo-input]'), rm = form.querySelector('[data-photo-remove]'), perr = form.querySelector('[data-photo-err]');
        input.addEventListener('change', async function () {
          var file = input.files && input.files[0];
          perr.textContent = '';
          if (!file) return;
          try {
            foto = await api().photoFromFile(file);
            preview.innerHTML = '<img src="' + h(foto) + '" alt="Pratinjau foto" width="96" height="96">';
            rm.hidden = false;
          } catch (e) { perr.textContent = e.message; }
          input.value = '';
        });
        rm.addEventListener('click', function () { foto = ''; preview.innerHTML = '<span aria-hidden="true">' + icon('user', { size: 28 }) + '</span>'; rm.hidden = true; input.focus(); });
        var certs = form.querySelector('[data-certs]');
        var addBtn = form.querySelector('[data-cert-add]');
        function syncAdd() { addBtn.hidden = certs.querySelectorAll('[data-cert]').length >= 10; }
        syncAdd();
        addBtn.addEventListener('click', function () {
          certs.insertAdjacentHTML('beforeend', certRow({}));
          ui.reveal(certs);
          syncAdd();
          var last = certs.querySelector('[data-cert]:last-child input');
          if (last) last.focus();
        });
        certs.addEventListener('click', function (e) {
          var del = e.target.closest('[data-cert-del]');
          if (!del) return;
          del.closest('[data-cert]').remove();
          syncAdd();
          addBtn.focus();
        });
        var all = form.querySelector('[data-seluruh]');
        function syncAll() {
          util.$$('input[name="wilayah"]', form).forEach(function (c) { c.disabled = all.checked; if (all.checked) c.checked = false; });
        }
        all.addEventListener('change', function () { syncAll(); groupErr(form, 'ains-g-wil', ''); });
        syncAll();
        form.addEventListener('change', function (e) {
          var g = e.target.closest('.ains-group.is-invalid');
          if (g && e.target.type === 'checkbox') groupErr(form, g.id, '');
          if (e.target.name === 'memberUid') {
            var m = ((k.state && k.state.members) || []).filter(function (x) { return x.uid === e.target.value; })[0];
            if (m) {
              if (m.kta) form.elements.kta.value = m.kta;
              if (!form.elements.nama.value) form.elements.nama.value = m.name || '';
              if (!form.elements.kEmail.value && m.email) form.elements.kEmail.value = m.email;
              if (!form.elements.kTelepon.value && m.phone) form.elements.kTelepon.value = util.formatPhoneID(m.phone) || m.phone;
              if (!form.elements.gelar.value && m.profile && m.profile.position) form.elements.gelar.value = m.profile.position;
              if (form.elements.pengalamanTahun.value === '' && m.profile && m.profile.experienceYears !== null && m.profile.experienceYears !== undefined) form.elements.pengalamanTahun.value = m.profile.experienceYears;
            }
          }
        });
      },
      submit: function (values, form) {
        var item = {
          id: it ? it.id : '',
          nama: values.nama, gelar: values.gelar, foto: foto,
          kompetensi: vals(form, 'kompetensi'),
          sertifikasi: util.$$('[data-cert]', form).map(function (row) {
            var g = function (f) { var c = row.querySelector('[data-cert-f="' + f + '"]'); return c ? c.value.trim() : ''; };
            return { nama: g('nama'), penerbit: g('penerbit'), berlakuHingga: g('berlakuHingga') };
          }).filter(function (c) { return c.nama; }),
          pengalamanTahun: values.pengalamanTahun,
          wilayah: form.querySelector('[data-seluruh]').checked ? [api().SELURUH] : vals(form, 'wilayah'),
          bahasa: vals(form, 'bahasa'), metode: vals(form, 'metode'),
          materi: String(values.materi || '').split('\n'),
          bio: form.elements.bio.value, kta: values.kta, published: !!values.published
        };
        return api().admin.save(item, { kontak: { email: values.kEmail, telepon: values.kTelepon, memberUid: values.memberUid, catatan: form.elements.kCatatan.value } });
      }
    });
    if (res && res.id) await after('Profil ' + res.nama + (res.published ? ' tersimpan dan tampil di halaman Instruktur.' : ' tersimpan sebagai draf.'), '[data-row="' + res.id + '"] [data-ins-act="edit"]');
  }

  /* --------------------------------------------------------- permintaan */
  function paintRequests(pane) {
    var k = K();
    if (S.errReq) { pane.innerHTML = errorBox(S.errReq, 'Permintaan instruktur belum dapat dimuat'); return; }
    var all = S.req || [];
    var counts = { '': all.length };
    api().REQUEST_STATUS.forEach(function (s) { counts[s] = all.filter(function (x) { return x.status === s; }).length; });
    pane.innerHTML =
      '<div class="adm-toolbar">' +
        k.chips({ label: 'Saring status permintaan', name: 'req-status', value: S.reqStatus, items: [{ value: '', label: 'Semua', count: counts[''] }].concat(api().REQUEST_STATUS.map(function (s) { return { value: s, label: s, count: counts[s] }; })) }) +
        '<div class="adm-toolbar__row">' + k.searchBox({ id: 'req-q', label: 'Cari permintaan', placeholder: 'Cari organisasi, penanggung jawab, topik, atau lokasi', value: S.reqQ }) + '</div>' +
      '</div><div id="req-list"></div>';
    var listEl = d.getElementById('req-list');
    function paint() {
      var list = all.filter(function (x) { return (!S.reqStatus || x.status === S.reqStatus) && match([x.id, x.organisasi, x.namaPic, x.email, x.topik, x.lokasi, x.instrukturNama].join(' '), S.reqQ); });
      if (!all.length) {
        listEl.innerHTML = k.empty({ icon: 'mail', title: 'Belum ada permintaan', text: 'Permintaan dari mitra penyelenggara melalui halaman Instruktur akan muncul di sini.', actionHtml: '<a class="btn btn--ghost btn--sm" href="instruktur.html#permintaan" target="_blank" rel="noopener"><span>Buka formulir permintaan</span>' + icon('arrow-up-right', { size: 16, cls: 'btn__icon' }) + '</a>' });
        return;
      }
      if (!list.length) { listEl.innerHTML = k.empty({ icon: 'search', title: 'Tidak ada yang cocok', text: 'Ubah kata kunci atau saringan status.' }); return; }
      listEl.innerHTML = '<p class="adm-count">' + h(k.plural(list.length, 'permintaan')) + '</p>' +
        '<div class="table-wrap"><table class="table adm-table"><caption class="sr-only">Daftar permintaan instruktur</caption><thead><tr>' +
        '<th scope="col">Penyelenggara</th><th scope="col">Topik</th><th scope="col">Rencana</th><th scope="col">Peserta</th><th scope="col">Diterima</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Aksi</span></th></tr></thead><tbody>' +
        list.map(function (x) {
          return '<tr' + (x.status === 'Baru' ? ' class="is-new"' : '') + ' data-req-row="' + h(x.id) + '">' +
            '<td><button type="button" class="adm-link-title" data-req-open="' + h(x.id) + '">' + h(x.organisasi) + '</button><span class="table__muted">' + h(x.namaPic) + ' · <span class="adm-mono">' + h(x.id) + '</span></span></td>' +
            '<td data-label="Topik">' + h(x.topik) + (x.instrukturNama ? '<span class="table__muted">Diminati: ' + h(x.instrukturNama) + '</span>' : '') + '</td>' +
            '<td data-label="Rencana">' + k.timeTag(x.tanggal) + '<span class="table__muted">' + h(x.metode) + (x.lokasi ? ' · ' + h(x.lokasi) : '') + '</span></td>' +
            '<td data-label="Peserta">' + h(x.jumlahPeserta === null ? '—' : util.formatNumber(x.jumlahPeserta)) + '</td>' +
            '<td data-label="Diterima">' + k.timeTag(x.createdAt) + '</td>' +
            '<td data-label="Status">' + reqBadge(x.status) + '</td>' +
            '<td class="adm-table__actions"><button type="button" class="adm-act adm-act--icon adm-act--open" data-req-open="' + h(x.id) + '" title="Buka">' + icon('arrow-right', { size: 15 }) + '<span class="adm-act__label">Buka<span class="sr-only"> permintaan ' + h(x.organisasi) + '</span></span></button></td></tr>';
        }).join('') + '</tbody></table></div>';
    }
    paint();
    k.bindChips(pane, 'req-status', function (v) { S.reqStatus = v; paint(); });
    k.bindSearch(pane, 'req-q', function (v) { S.reqQ = v; paint(); });
    listEl.addEventListener('click', function (e) {
      var b = e.target.closest('[data-req-open]');
      if (b) openRequest(b.getAttribute('data-req-open'));
    });
  }
  function openRequest(id) {
    var k = K();
    var x = (S.req || []).filter(function (r) { return r.id === id; })[0];
    if (!x) { ui.toast('Permintaan tidak ditemukan. Muat ulang data.', { type: 'warn' }); return; }
    var mail = k.mailto(x.email, 'Tanggapan PPAPI atas permintaan instruktur [' + x.id + ']',
      'Yth. ' + (x.namaPic || 'Bapak/Ibu') + ',\n\nTerima kasih atas permintaan instruktur untuk pelatihan "' + x.topik + '" yang Anda sampaikan melalui situs PPAPI (nomor referensi ' + x.id + ').\n\n\n\nHormat kami,\nSekretariat PPAPI');
    var rows = [
      ['Referensi', '<span class="adm-mono">' + h(x.id) + '</span>'],
      ['Diterima', h(x.createdAt ? util.formatDate(x.createdAt, { weekday: true, time: true }) : '—')],
      ['Penanggung jawab', h(x.namaPic) + (x.uid ? ' <span class="badge badge--muted">Akun terdaftar</span>' : '')],
      ['Email', '<span class="adm-break">' + h(x.email) + '</span>'],
      ['Telepon', h(x.telepon)],
      ['Topik', h(x.topik)],
      ['Metode', h(x.metode)],
      ['Lokasi', h(x.lokasi || '—')],
      ['Rencana mulai', h(x.tanggal ? util.formatDate(x.tanggal, { weekday: true }) : '—')],
      ['Jumlah peserta', h(x.jumlahPeserta === null ? '—' : util.formatNumber(x.jumlahPeserta) + ' orang')]
    ];
    if (x.instrukturNama) rows.push(['Instruktur diminati', h(x.instrukturNama) + (x.instrukturId ? ' <a class="link" href="instruktur.html?id=' + h(encodeURIComponent(x.instrukturId)) + '" target="_blank" rel="noopener">Lihat profil</a>' : '')]);
    if (x.updatedAt) rows.push(['Diperbarui', h(k.dateTime(x.updatedAt))]);
    var radios = api().REQUEST_STATUS.map(function (s) { return '<label><input type="radio" name="status" value="' + h(s) + '"' + (x.status === s ? ' checked' : '') + '><span class="segmented__option">' + h(s) + '</span></label>'; }).join('');
    var tel = String(x.telepon || '').replace(/[^\d+]/g, '');
    ui.drawer({
      title: x.organisasi, eyebrow: 'Permintaan Instruktur', size: 'md', cls: 'adm-drawer',
      body:
        '<div class="drawer__section"><div class="adm-badges">' + reqBadge(x.status) + '<span class="badge badge--outline">' + h(x.metode) + '</span></div>' +
          '<dl class="kv adm-kv">' + rows.map(function (r) { return '<div class="kv__row"><dt>' + h(r[0]) + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>' +
          '<p class="adm-drawer-cta">' + (mail ? '<a class="btn btn--ghost btn--sm" href="' + h(mail) + '">' + icon('mail', { size: 16 }) + '<span>Balas via email</span></a> ' : '') +
            (tel.length >= 8 ? '<a class="btn btn--link btn--sm" href="tel:' + h(tel) + '">' + icon('phone', { size: 16 }) + '<span>Telepon</span></a>' : '') + '</p></div>' +
        (x.catatan ? '<div class="drawer__section"><h3 class="drawer__section-title">Catatan dari mitra</h3><div class="adm-message">' + h(x.catatan) + '</div></div>' : '') +
        '<div class="drawer__section"><h3 class="drawer__section-title">Penanganan</h3><form class="form adm-form" novalidate id="req-form">' +
          '<fieldset class="adm-fieldset"><legend class="field__label">Status</legend><div class="segmented segmented--block" role="radiogroup" aria-label="Status permintaan">' + radios + '</div></fieldset>' +
          k.field({ name: 'catatanAdmin', label: 'Catatan internal', type: 'textarea', rows: 4, value: x.catatanAdmin, maxlength: 2000, counter: true, optional: true, hint: 'Hanya terlihat oleh admin, mis. instruktur yang dihubungi dan hasilnya.' }) +
        '</form></div>',
      onClose: function () { if (k.restoreFocus) k.restoreFocus('[data-req-open="' + (w.CSS && CSS.escape ? CSS.escape(x.id) : x.id) + '"]'); },
      actions: [
        { label: 'Tutup', variant: 'ghost' },
        {
          label: 'Simpan', variant: 'primary', id: 'req-save',
          onClick: function (close, ctx) {
            var v = k.values(ctx.el.querySelector('#req-form'));
            if ((v.status || x.status) === x.status && v.catatanAdmin === (x.catatanAdmin || '')) { ui.toast('Tidak ada perubahan untuk disimpan.', { type: 'info' }); return true; }
            return api().requests.update(x.id, { status: v.status || x.status, catatanAdmin: v.catatanAdmin }).then(function () {
              return after('Permintaan ' + x.id + ' diperbarui.');
            });
          }
        }
      ]
    });
  }

  /* ------------------------------------------------------------- export */
  w.PPAPI_ADMIN_SECTIONS = (w.PPAPI_ADMIN_SECTIONS || []).concat(section);
  var k0 = K();
  if (k0 && k0.sections && !k0.sections.instruktur) k0.sections.instruktur = section;
  w.PPAPI_ADMIN_INSTRUKTUR = { section: section, openRequest: openRequest, reload: function () { S.loadedAt = 0; return load(true).then(rerender); } };
  /* nav count once the console is ready (admin only; failures stay silent) */
  if (PPAPI.onReady) PPAPI.onReady(function () {
    var s = PPAPI.session && PPAPI.session.current ? PPAPI.session.current() : null;
    if (s && s.isAdmin && api()) load().catch(function () { /* ignore */ });
  });
})(window, document);
