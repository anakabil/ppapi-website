/* ==========================================================================
   PPAPI — instruktur.js  (body[data-page="instruktur"], data-auth="public")
   Direktori instruktur perancah untuk mitra penyelenggara pelatihan:
   filter (bidang, kompetensi, wilayah, bahasa, metode) + pencarian, kartu
   profil, modal detail (?id=<id>), dan formulir "Ajukan Permintaan
   Instruktur" yang diteruskan ke sekretariat (PPAPI.instruktur.requests).
   Kontak pribadi instruktur tidak pernah ditampilkan.
   Every data string is escaped with PPAPI.util.h().
   ========================================================================== */
(function (w, d) {
  'use strict';

  var PPAPI = w.PPAPI;
  if (!PPAPI || !PPAPI.util) return;
  var util = PPAPI.util, ui = PPAPI.ui, h = util.h, icon = PPAPI.icon;
  function $(s, r) { return (r || d).querySelector(s); }
  function el(key) { return d.querySelector('[data-in="' + key + '"]'); }
  function api() { return PPAPI.instruktur; }

  var ALL = [];
  var F = { q: '', bidang: '', komp: '', wil: '', bhs: '', met: '' };
  var openId = '';

  /* ------------------------------------------------------------- helpers */
  function kompName(kode) { var k = api().kompetensi(kode); return k ? k.nama : kode; }
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function haystack(it) {
    return norm([it.nama, it.gelar, it.bio, (it.materi || []).join(' '), (it.wilayah || []).join(' '), (it.bahasa || []).join(' '),
      (it.kompetensi || []).map(kompName).join(' '), (it.bidang || []).join(' '), (it.sertifikasi || []).map(function (c) { return c.nama + ' ' + c.penerbit; }).join(' ')].join(' '));
  }
  function servesRegion(it, prov) { return (it.wilayah || []).indexOf(api().SELURUH) !== -1 || (it.wilayah || []).indexOf(prov) !== -1; }
  function matches(it, skip) {
    if (skip !== 'bidang' && F.bidang && (it.bidang || []).indexOf(F.bidang) === -1) return false;
    if (F.komp && (it.kompetensi || []).indexOf(F.komp) === -1) return false;
    if (F.wil && !servesRegion(it, F.wil)) return false;
    if (F.bhs && (it.bahasa || []).indexOf(F.bhs) === -1) return false;
    if (F.met && (it.metode || []).indexOf(F.met) === -1) return false;
    if (F.q) {
      var hay = haystack(it);
      var words = norm(F.q).split(/\s+/).filter(Boolean);
      if (!words.every(function (wd) { return hay.indexOf(wd) !== -1; })) return false;
    }
    return true;
  }
  function filtersActive() { return !!(F.q || F.bidang || F.komp || F.wil || F.bhs || F.met); }
  function regionText(it, max) {
    var list = it.wilayah || [];
    if (list.indexOf(api().SELURUH) !== -1) return api().SELURUH;
    if (!max || list.length <= max) return list.join(', ');
    return list.slice(0, max).join(', ') + ' +' + (list.length - max);
  }
  function avatar(it, size) {
    if (it.foto) return '<span class="in-avatar in-avatar--' + size + '" aria-hidden="true"><img src="' + h(it.foto) + '" alt="" width="' + (size === 'lg' ? 112 : 64) + '" height="' + (size === 'lg' ? 112 : 64) + '" decoding="async"></span>';
    return '<span class="in-avatar in-avatar--' + size + ' in-avatar--initials" aria-hidden="true">' + h(util.initials(it.nama)) + '</span>';
  }
  function metodeBadges(it) {
    return (it.metode || []).map(function (m) { return '<span class="badge badge--outline">' + h(m) + '</span>'; }).join('');
  }
  function memberBadge(it) { return it.kta ? '<span class="badge badge--metal">Anggota PPAPI</span>' : ''; }
  function years(n) { return n === null || n === undefined ? '' : util.formatNumber(n) + ' tahun'; }

  /* ------------------------------------------------------------- hero */
  function renderHeroMeta() {
    var meta = el('hero-meta');
    if (!meta) return;
    if (!ALL.length) {
      meta.innerHTML = '<span>' + icon('shield-check', { size: 16 }) + 'Permintaan melalui sekretariat PPAPI</span><span>' + icon('info', { size: 16 }) + 'Direktori sedang disiapkan</span>';
      return;
    }
    var bidang = [];
    ALL.forEach(function (it) { (it.bidang || []).forEach(function (b) { if (bidang.indexOf(b) === -1) bidang.push(b); }); });
    meta.innerHTML = '<span>' + icon('users', { size: 16 }) + h(util.formatNumber(ALL.length)) + ' instruktur terverifikasi</span>' +
      '<span>' + icon('layers', { size: 16 }) + h(util.formatNumber(bidang.length)) + ' bidang kompetensi</span>' +
      '<span>' + icon('shield-check', { size: 16 }) + 'Permintaan melalui sekretariat</span>';
  }

  /* ------------------------------------------------------------- toolbar */
  function option(value, label, selected) { return '<option value="' + h(value) + '"' + (selected ? ' selected' : '') + '>' + h(label) + '</option>'; }
  function fillSelects() {
    /* kompetensi present in the directory, grouped by bidang (catalogue order) */
    var present = {};
    ALL.forEach(function (it) { (it.kompetensi || []).forEach(function (c) { present[c] = (present[c] || 0) + 1; }); });
    var groups = {};
    api().katalog().forEach(function (k) { if (present[k.kode]) (groups[k.kelompok] = groups[k.kelompok] || []).push(k); });
    $('#in-komp').innerHTML = option('', 'Semua', !F.komp) + Object.keys(groups).map(function (g) {
      return '<optgroup label="' + h(g) + '">' + groups[g].map(function (k) { return option(k.kode, k.nama + ' (' + present[k.kode] + ')', F.komp === k.kode); }).join('') + '</optgroup>';
    }).join('');
    /* wilayah: covered provinces (all of them when someone serves the whole country) */
    var nationwide = ALL.some(function (it) { return (it.wilayah || []).indexOf(api().SELURUH) !== -1; });
    var provs = api().provinsi().filter(function (p) { return nationwide || ALL.some(function (it) { return (it.wilayah || []).indexOf(p) !== -1; }); });
    $('#in-wil').innerHTML = option('', 'Semua', !F.wil) + provs.map(function (p) { return option(p, p, F.wil === p); }).join('');
    var langs = api().BAHASA.filter(function (b) { return ALL.some(function (it) { return (it.bahasa || []).indexOf(b) !== -1; }); });
    $('#in-bhs').innerHTML = option('', 'Semua', !F.bhs) + langs.map(function (b) { return option(b, 'Bahasa ' + b, F.bhs === b); }).join('');
  }
  function renderChips() {
    var box = el('chips');
    var base = ALL.filter(function (it) { return matches(it, 'bidang'); });
    var items = [{ value: '', label: 'Semua', count: base.length }].concat(api().bidangList().map(function (b) {
      return { value: b, label: b, count: base.filter(function (it) { return (it.bidang || []).indexOf(b) !== -1; }).length };
    }));
    box.innerHTML = items.map(function (it) {
      var on = it.value === F.bidang;
      return '<button type="button" class="chip' + (!it.count && !on ? ' is-zero' : '') + '" data-value="' + h(it.value) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' + h(it.label) +
        ' <span class="chip__count">' + h(util.formatNumber(it.count)) + '</span></button>';
    }).join('');
  }

  /* ------------------------------------------------------------- cards */
  function card(it) {
    var komp = it.kompetensi || [];
    var tags = komp.slice(0, 3).map(function (c) { return '<li class="tag tag--boxed">' + h(kompName(c)) + '</li>'; }).join('') +
      (komp.length > 3 ? '<li class="tag in-card__more">+' + (komp.length - 3) + ' lainnya</li>' : '');
    var facts = [];
    if (it.pengalamanTahun !== null) facts.push(['Pengalaman', years(it.pengalamanTahun)]);
    facts.push(['Sertifikasi', it.sertifikasi.length ? util.formatNumber(it.sertifikasi.length) + ' sertifikat' : 'Belum ada']);
    facts.push(['Wilayah', regionText(it, 2)]);
    return '<article class="card card--hover in-card" data-id="' + h(it.id) + '">' +
      '<div class="in-card__head">' + avatar(it, 'md') +
        '<div class="in-card__id"><h3 class="in-card__name"><button type="button" class="in-card__open" data-in-open="' + h(it.id) + '">' + h(it.nama) + '</button></h3>' +
        '<p class="in-card__title">' + h(it.gelar) + '</p></div></div>' +
      '<div class="in-card__badges">' + memberBadge(it) + metodeBadges(it) + '</div>' +
      '<dl class="in-card__facts">' + facts.map(function (f) { return '<div><dt>' + h(f[0]) + '</dt><dd>' + h(f[1]) + '</dd></div>'; }).join('') + '</dl>' +
      (tags ? '<ul class="in-card__tags" aria-label="Kompetensi">' + tags + '</ul>' : '') +
      (it.bio ? '<p class="in-card__bio">' + h(it.bio) + '</p>' : '') +
      '<div class="in-card__foot">' +
        '<button type="button" class="btn btn--link btn--sm" data-in-open="' + h(it.id) + '" aria-hidden="true" tabindex="-1"><span>Lihat profil</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</button>' +
        '<button type="button" class="btn btn--ghost btn--sm" data-in-ask="' + h(it.id) + '"><span>Ajukan</span><span class="sr-only"> permintaan untuk ' + h(it.nama) + '</span></button>' +
      '</div></article>';
  }
  function renderResults() {
    var box = el('results');
    var summary = el('summary'), count = el('count'), reset = el('reset');
    box.removeAttribute('aria-busy');
    if (!ALL.length) {
      summary.hidden = true;
      el('toolbar').hidden = true;
      box.innerHTML = '<div class="in-empty">' + ui.emptyState({
        icon: 'users', title: 'Direktori sedang disiapkan',
        text: 'Sekretariat PPAPI sedang memeriksa profil dan sertifikat para instruktur sebelum ditampilkan di sini. Sementara itu, Anda tetap dapat mengajukan permintaan — sekretariat akan membantu mencarikan instruktur yang sesuai.',
        actionHtml: '<a class="btn btn--primary btn--sm" href="#permintaan"><span>Ajukan permintaan</span>' + icon('arrow-down', { size: 16, cls: 'btn__icon' }) + '</a>'
      }) + '</div>';
      ui.reveal(box);
      return;
    }
    el('toolbar').hidden = false;
    summary.hidden = false;
    var list = ALL.filter(function (it) { return matches(it); });
    count.textContent = list.length === ALL.length
      ? util.formatNumber(ALL.length) + ' instruktur'
      : util.formatNumber(list.length) + ' dari ' + util.formatNumber(ALL.length) + ' instruktur';
    reset.hidden = !filtersActive();
    if (!list.length) {
      box.innerHTML = ui.emptyState({
        icon: 'search', title: 'Belum ada instruktur yang cocok',
        text: 'Ubah kata kunci atau saringan. Anda juga dapat langsung mengajukan permintaan — sekretariat akan mencarikan instruktur yang sesuai.',
        actionHtml: '<button type="button" class="btn btn--ghost btn--sm" data-in-reset-inline><span>Atur ulang filter</span></button> <a class="btn btn--link btn--sm" href="#permintaan"><span>Ajukan permintaan</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a>'
      });
    } else {
      box.innerHTML = '<div class="in-grid">' + list.map(card).join('') + '</div>';
    }
    ui.reveal(box);
  }
  function refresh() { renderChips(); renderResults(); }
  function resetFilters() {
    F = { q: '', bidang: '', komp: '', wil: '', bhs: '', met: '' };
    $('#in-q').value = '';
    var clear = $('.search-box__clear', el('toolbar'));
    if (clear) clear.hidden = true;
    ['#in-komp', '#in-wil', '#in-bhs', '#in-met'].forEach(function (s) { $(s).value = ''; });
    refresh();
  }

  /* ------------------------------------------------------------- detail */
  function setUrlId(id) {
    try {
      var u = new URL(w.location.href);
      if (id) u.searchParams.set('id', id); else u.searchParams.delete('id');
      w.history.replaceState(w.history.state, '', u.pathname + u.search + u.hash);
    } catch (e) { /* file:// */ }
  }
  function profileBody(it) {
    var kv = [];
    if (it.pengalamanTahun !== null) kv.push(['Pengalaman', years(it.pengalamanTahun) + ' di bidang perancah']);
    kv.push(['Metode', (it.metode || []).join(' dan ') || '—']);
    kv.push(['Bahasa', (it.bahasa || []).join(', ') || '—']);
    kv.push(['Wilayah layanan', regionText(it) || '—']);
    var komp = (it.kompetensi || []).map(function (c) {
      var k = api().kompetensi(c);
      return '<li><span class="in-profile__komp">' + h(k ? k.nama : c) + '</span>' + (k ? '<span class="in-profile__group">' + h(k.kelompok) + '</span>' : '') + '</li>';
    }).join('');
    var certs = (it.sertifikasi || []).map(function (c) {
      var st = util.certStatus(c.berlakuHingga);
      return '<li class="in-cert"><span class="in-cert__icon" aria-hidden="true">' + icon('certificate', { size: 18 }) + '</span>' +
        '<div class="in-cert__text"><p class="in-cert__name">' + h(c.nama) + '</p>' +
        '<p class="in-cert__meta">' + (c.penerbit ? h(c.penerbit) + ' · ' : '') + (c.berlakuHingga ? 'Berlaku hingga <time datetime="' + h(c.berlakuHingga) + '">' + h(util.formatDate(c.berlakuHingga)) + '</time>' : 'Tanpa batas masa berlaku') + '</p></div>' +
        '<span class="badge badge--' + h(st.tone) + '">' + h(st.label) + '</span></li>';
    }).join('');
    var materi = (it.materi || []).map(function (m) { return '<li>' + h(m) + '</li>'; }).join('');
    var bio = String(it.bio || '').split(/\n{2,}/).map(function (p) { return '<p>' + h(p) + '</p>'; }).join('');
    return '<div class="in-profile">' +
      '<div class="in-profile__head">' + avatar(it, 'lg') +
        '<div class="in-profile__id"><p class="in-profile__title">' + h(it.gelar) + '</p>' +
        '<div class="in-profile__badges">' + memberBadge(it) + metodeBadges(it) + (it.bidang || []).map(function (b) { return '<span class="tag">' + h(b) + '</span>'; }).join('') + '</div>' +
        (it.kta ? '<p class="in-profile__kta">' + icon('id-card', { size: 16 }) + '<span>KTA <span class="in-mono">' + h(it.kta) + '</span></span> <a class="link" href="verifikasi.html?kta=' + h(encodeURIComponent(it.kta)) + '">Verifikasi KTA</a></p>' : '') +
        '</div></div>' +
      '<dl class="kv in-profile__kv">' + kv.map(function (r) { return '<div class="kv__row"><dt>' + h(r[0]) + '</dt><dd>' + h(r[1]) + '</dd></div>'; }).join('') + '</dl>' +
      (bio ? '<section class="in-profile__sec"><h3 class="in-profile__h">Profil singkat</h3><div class="in-profile__bio">' + bio + '</div></section>' : '') +
      (komp ? '<section class="in-profile__sec"><h3 class="in-profile__h">Kompetensi</h3><ul class="list-rule list-rule--compact in-profile__list">' + komp + '</ul></section>' : '') +
      '<section class="in-profile__sec"><h3 class="in-profile__h">Sertifikasi</h3>' + (certs ? '<ul class="in-certs" role="list">' + certs + '</ul>' : '<p class="muted">Sertifikat belum dicantumkan pada profil ini.</p>') + '</section>' +
      (materi ? '<section class="in-profile__sec"><h3 class="in-profile__h">Materi yang diampu</h3><ul class="list-rule list-rule--compact list-rule--nodes in-profile__list">' + materi + '</ul></section>' : '') +
      '<p class="in-profile__privacy">' + icon('lock', { size: 16 }) + '<span>Kontak pribadi instruktur tidak dipublikasikan. Ajukan permintaan agar sekretariat PPAPI dapat meneruskannya.</span></p>' +
      '</div>';
  }
  function openProfile(id) {
    var it = ALL.filter(function (x) { return x.id === id; })[0];
    if (!it) { ui.toast('Profil instruktur tidak ditemukan atau belum diterbitkan.', { type: 'warn' }); setUrlId(''); return; }
    openId = id;
    setUrlId(id);
    ui.modal({
      title: it.nama, eyebrow: 'Profil Instruktur', size: 'lg', cls: 'in-modal', body: profileBody(it),
      actions: [
        { label: 'Tutup', variant: 'ghost' },
        { label: 'Ajukan permintaan', variant: 'primary', onClick: function (close) { close(); setTimeout(function () { pick(it, true); }, 30); } }
      ],
      onOpen: function (root) { ui.reveal(root); },
      onClose: function () {
        openId = '';
        setUrlId('');
        setTimeout(function () {
          if (d.activeElement && d.activeElement !== d.body) return;
          var btn = d.querySelector('.in-card__open[data-in-open="' + (w.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
          if (btn) btn.focus({ preventScroll: true });
        }, 40);
      }
    });
  }

  /* ------------------------------------------------------------- form */
  var picked = null;
  var FIELD_IDS = { organisasi: 'in-organisasi', namaPic: 'in-namaPic', email: 'in-email', telepon: 'in-telepon', topik: 'in-topik', lokasi: 'in-lokasi', tanggal: 'in-tanggal', jumlahPeserta: 'in-peserta', catatan: 'in-catatan', consent: 'in-consent' };
  function setInvalid(id, msg) {
    var c = d.getElementById(id);
    if (!c) return;
    var f = c.closest('.field');
    if (f) f.classList.toggle('is-invalid', !!msg);
    if (msg) c.setAttribute('aria-invalid', 'true'); else c.removeAttribute('aria-invalid');
    var e = d.getElementById(id + '-err');
    if (e) e.textContent = msg || '';
  }
  function renderPicked() {
    var box = el('picked');
    if (!picked) { box.hidden = true; box.innerHTML = ''; return; }
    box.hidden = false;
    box.innerHTML = avatar(picked, 'sm') + '<div class="in-picked__text"><p class="in-picked__label">Instruktur yang diminati</p><p class="in-picked__name">' + h(picked.nama) + '</p></div>' +
      '<button type="button" class="btn btn--link btn--sm in-picked__clear" data-in-unpick><span>Batalkan</span><span class="sr-only"> pilihan instruktur ' + h(picked.nama) + '</span></button>';
  }
  function pick(it, focus) {
    picked = it;
    renderPicked();
    var topik = d.getElementById('in-topik');
    if (topik && !topik.value && it.kompetensi && it.kompetensi.length) topik.value = kompName(it.kompetensi[0]);
    var form = el('form');
    if (form.hidden) { el('success').hidden = true; form.hidden = false; }
    var sec = d.getElementById('permintaan');
    if (sec) sec.scrollIntoView({ block: 'start', behavior: PPAPI.motion && PPAPI.motion.prefersReduced() ? 'auto' : 'smooth' });
    if (focus) setTimeout(function () { var f = d.getElementById('in-organisasi'); if (f) f.focus({ preventScroll: true }); }, PPAPI.motion && PPAPI.motion.prefersReduced() ? 0 : 450);
    ui.toast('Formulir permintaan disiapkan untuk ' + it.nama + '.', { type: 'info' });
  }
  function metodeValue(form) { var r = form.querySelector('input[name="metode"]:checked'); return r ? r.value : ''; }
  function syncLokasi(form) {
    var daring = metodeValue(form) === 'Daring';
    el('lokasi-req').hidden = daring;
    el('lokasi-opt').hidden = !daring;
    var c = d.getElementById('in-lokasi');
    if (daring) { c.removeAttribute('required'); c.removeAttribute('aria-required'); setInvalid('in-lokasi', ''); }
    else { c.setAttribute('required', ''); c.setAttribute('aria-required', 'true'); }
  }
  function collect(form) {
    var v = function (n) { var c = form.elements[n]; return c ? String(c.value || '').trim() : ''; };
    return {
      organisasi: v('organisasi'), namaPic: v('namaPic'), email: v('email'), telepon: v('telepon'), topik: v('topik'),
      metode: metodeValue(form), lokasi: v('lokasi'), tanggal: v('tanggal'), jumlahPeserta: v('jumlahPeserta'), catatan: v('catatan'),
      instrukturId: picked ? picked.id : '', instrukturNama: picked ? picked.nama : ''
    };
  }
  function showSuccess(ref, data) {
    var form = el('form'), box = el('success');
    var rows = [
      ['Nomor referensi', '<span class="in-mono">' + h(ref) + '</span>'],
      ['Penyelenggara', h(data.organisasi)],
      ['Topik', h(data.topik)],
      ['Rencana', h(util.formatDate(data.tanggal)) + ' · ' + h(data.metode) + (data.lokasi ? ' · ' + h(data.lokasi) : '')],
      ['Peserta', h(util.formatNumber(Number(data.jumlahPeserta))) + ' orang']
    ];
    if (data.instrukturNama) rows.push(['Instruktur diminati', h(data.instrukturNama)]);
    box.innerHTML = '<div class="in-success__head"><span class="in-success__icon" aria-hidden="true">' + icon('check-circle', { size: 28 }) + '</span>' +
      '<div><p class="eyebrow">Permintaan terkirim</p><h3 class="in-success__title">Terima kasih, ' + h(data.namaPic) + '.</h3></div></div>' +
      '<p class="in-success__text">Permintaan Anda telah diterima sekretariat PPAPI. Kami akan menghubungi Anda melalui <strong>' + h(data.email) + '</strong> atau telepon setelah memeriksa ketersediaan instruktur. Simpan nomor referensi berikut untuk keperluan tindak lanjut.</p>' +
      '<dl class="kv in-success__kv">' + rows.map(function (r) { return '<div class="kv__row"><dt>' + h(r[0]) + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>' +
      '<div class="in-success__actions"><button type="button" class="btn btn--ghost btn--sm" data-in-again><span>Kirim permintaan lain</span></button>' +
      '<button type="button" class="btn btn--link btn--sm" data-copy="' + h(ref) + '" data-copy-message="Nomor referensi disalin."><span>Salin nomor referensi</span>' + icon('copy', { size: 16, cls: 'btn__icon' }) + '</button></div>';
    form.hidden = true;
    box.hidden = false;
    ui.reveal(box);
    box.focus({ preventScroll: true });
    box.scrollIntoView({ block: 'nearest' });
  }
  function bindForm() {
    var form = el('form');
    var alertBox = el('alert');
    var submit = el('submit');
    var tanggal = d.getElementById('in-tanggal');
    tanggal.min = util.todayIso();
    var list = el('topik-list');
    list.innerHTML = api().katalog().map(function (k) { return '<option value="' + h(k.nama) + '"></option>'; }).join('');
    /* prefill from the signed-in account (never overwrites what was typed) */
    var s = PPAPI.session && PPAPI.session.current ? PPAPI.session.current() : null;
    if (s && s.user) {
      if (s.user.email && !form.elements.email.value) form.elements.email.value = s.user.email;
      var nm = (s.member && s.member.name) || s.user.name;
      if (nm && !form.elements.namaPic.value) form.elements.namaPic.value = nm;
      var comp = s.member && s.member.profile && s.member.profile.company;
      if (comp && !form.elements.organisasi.value) form.elements.organisasi.value = comp;
    }
    syncLokasi(form);
    form.addEventListener('change', function (e) {
      if (e.target.name === 'metode') syncLokasi(form);
      if (e.target.id === 'in-consent' && e.target.checked) setInvalid('in-consent', '');
    });
    var counter = el('counter');
    form.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'in-catatan') {
        counter.textContent = util.formatNumber(t.value.length) + ' / 2.000';
        counter.classList.toggle('is-over', t.value.length > 2000);
      }
      if (t.id && t.closest('.field') && t.closest('.field').classList.contains('is-invalid')) setInvalid(t.id, '');
    });
    form.addEventListener('click', function (e) {
      if (e.target.closest('[data-in-unpick]')) { picked = null; renderPicked(); var o = d.getElementById('in-organisasi'); if (o) o.focus(); }
    });
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      alertBox.innerHTML = '';
      Object.keys(FIELD_IDS).forEach(function (k) { setInvalid(FIELD_IDS[k], ''); });
      var data = collect(form);
      var fields = {};
      try { api().requests.validate(data); } catch (err) { fields = err.fields || {}; if (!err.fields) { alertBox.innerHTML = '<p>' + h(err.message) + '</p>'; return; } }
      if (!form.elements.consent.checked) fields.consent = 'Centang persetujuan pemrosesan data untuk melanjutkan.';
      var keys = Object.keys(fields);
      if (keys.length) {
        keys.forEach(function (k) { if (FIELD_IDS[k]) setInvalid(FIELD_IDS[k], fields[k]); });
        if (fields.metode) alertBox.innerHTML = '<p>' + h(fields.metode) + '</p>';
        var order = ['organisasi', 'namaPic', 'email', 'telepon', 'topik', 'lokasi', 'tanggal', 'jumlahPeserta', 'catatan', 'consent'];
        var first = order.filter(function (k) { return fields[k]; })[0];
        if (first) d.getElementById(FIELD_IDS[first]).focus();
        return;
      }
      ui.setLoading(submit, true, 'Mengirim…');
      try {
        var res = await api().requests.create(data);
        ui.setLoading(submit, false);
        showSuccess(res.id, data);
      } catch (err) {
        console.error(err);
        ui.setLoading(submit, false);
        if (err.fields) { Object.keys(err.fields).forEach(function (k) { if (FIELD_IDS[k]) setInvalid(FIELD_IDS[k], err.fields[k]); }); }
        alertBox.innerHTML = '<p class="alert__title">Permintaan belum terkirim</p><p>' + h(err.message || 'Terjadi kendala. Silakan coba lagi.') + '</p>';
      }
    });
    el('success').addEventListener('click', function (e) {
      if (!e.target.closest('[data-in-again]')) return;
      var keep = { organisasi: form.elements.organisasi.value, namaPic: form.elements.namaPic.value, email: form.elements.email.value, telepon: form.elements.telepon.value };
      form.reset();
      Object.keys(keep).forEach(function (k) { form.elements[k].value = keep[k]; });
      picked = null;
      renderPicked();
      counter.textContent = '0 / 2.000';
      syncLokasi(form);
      el('success').hidden = true;
      form.hidden = false;
      var t = d.getElementById('in-topik');
      if (t) t.focus();
    });
  }

  /* ------------------------------------------------------------- boot */
  function bindToolbar() {
    var toolbar = el('toolbar');
    toolbar.addEventListener('submit', function (e) { e.preventDefault(); });
    var q = d.getElementById('in-q');
    var fire = util.debounce(function () { F.q = q.value.trim(); refresh(); }, 180);
    q.addEventListener('input', fire);
    [['#in-komp', 'komp'], ['#in-wil', 'wil'], ['#in-bhs', 'bhs'], ['#in-met', 'met']].forEach(function (p) {
      $(p[0]).addEventListener('change', function (e) { F[p[1]] = e.target.value; refresh(); });
    });
    el('chips').addEventListener('click', function (e) {
      var b = e.target.closest('.chip');
      if (!b) return;
      F.bidang = b.getAttribute('data-value') || '';
      refresh();
      var again = el('chips').querySelector('.chip[data-value="' + (w.CSS && CSS.escape ? CSS.escape(F.bidang) : F.bidang) + '"]');
      if (again) again.focus();
    });
    el('reset').addEventListener('click', function () { resetFilters(); $('#in-q').focus(); });
  }
  function bindResults() {
    el('results').addEventListener('click', function (e) {
      var o = e.target.closest('[data-in-open]');
      if (o) { openProfile(o.getAttribute('data-in-open')); return; }
      var a = e.target.closest('[data-in-ask]');
      if (a) { var it = ALL.filter(function (x) { return x.id === a.getAttribute('data-in-ask'); })[0]; if (it) pick(it, true); return; }
      if (e.target.closest('[data-in-reset-inline]')) { resetFilters(); $('#in-q').focus(); }
    });
  }
  async function load() {
    var box = el('results');
    try {
      ALL = await api().list();
    } catch (err) {
      console.error(err);
      ALL = [];
      box.removeAttribute('aria-busy');
      box.innerHTML = '<div class="alert alert--err" role="alert">' + icon('alert-triangle', { size: 18 }) +
        '<div><p class="alert__title">Direktori belum dapat dimuat</p><p>' + h(err.message || 'Terjadi kendala. Silakan coba lagi.') + '</p>' +
        '<p class="mt-2"><button type="button" class="btn btn--ghost btn--sm" data-in-retry><span>Coba lagi</span></button></p></div></div>';
      var r = box.querySelector('[data-in-retry]');
      if (r) r.addEventListener('click', function () { box.setAttribute('aria-busy', 'true'); box.innerHTML = ui.skeleton(3); load(); });
      renderHeroMeta();
      return;
    }
    renderHeroMeta();
    fillSelects();
    refresh();
  }

  PPAPI.onReady(async function () {
    if (!api()) { console.error('store-instruktur.js belum dimuat.'); return; }
    bindToolbar();
    bindResults();
    bindForm();
    await load();
    var id = util.qs('id');
    if (id) openProfile(id);
  });
})(window, document);
