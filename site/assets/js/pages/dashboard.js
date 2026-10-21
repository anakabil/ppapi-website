/* ==========================================================================
   PPAPI — dashboard.js  (Dasbor Anggota · data-page="dashboard", data-auth="required")
   Dua tampilan, dipilih dari PPAPI.session (SPEC v2 §4.5):
   A. PUSAT STATUS — keanggotaan belum Aktif (Draf, Menunggu Verifikasi, Perlu
      Perbaikan, Ditolak, Nonaktif, Kedaluwarsa): kartu status (status efektif,
      keterangan, catatan sekretariat, ajakan tindakan → pendaftaran.html),
      kelengkapan/ringkasan pengajuan, jalur tahapan (.status-track), serta
      cuplikan fitur anggota yang masih terkunci (PPAPI.ui.locked).
   B. DASBOR ANGGOTA — anggota Aktif dan admin PPAPI: KPI, pengingat masa
      berlaku (≤ 60 hari → perpanjangan), aplikasi anggota (internal),
      agenda/berita/pengumuman/regulasi/Produk Pengetahuan dari
      PPAPI.store.content.list (konten kelolaan admin ikut tampil), pengingat
      sertifikat, kelengkapan profil, aksi cepat, dan kartu Konsol Admin.
   Semua teks dari data di-escape dengan PPAPI.util.h(); setiap render diakhiri
   PPAPI.ui.reveal(container).
   ========================================================================== */
(function (w, d) {
  'use strict';

  var MAX_AGENDA = 4;
  var MAX_BERITA = 3;
  var MAX_PENGUMUMAN = 4;
  var MAX_PUSTAKA = 4;
  var MAX_MISSING_SHOWN = 5;

  PPAPI.onReady(async function () {
    var U = PPAPI.util, ui = PPAPI.ui, h = U.h, icon = PPAPI.icon, store = PPAPI.store;
    var cfg = PPAPI.config || {};
    var RENEWAL_DAYS = U.RENEWAL_DAYS || 60;

    function byId(id) { return d.getElementById(id); }
    function list(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }
    function isHttp(url) { return /^https?:\/\//i.test(String(url || '').trim()); }
    function cmp(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
    function fill(el, html) {
      if (!el) return;
      el.innerHTML = html;
      el.removeAttribute('aria-busy');
      ui.reveal(el);
    }
    function link(label, href, iconName) {
      return '<a class="btn btn--link btn--sm" href="' + h(href) + '"><span>' + h(label) + '</span>' +
        icon(iconName || 'arrow-right', { size: 16, cls: 'btn__icon' }) + '</a>';
    }
    function ext(label, href, srExtra) {
      return '<a class="btn btn--link btn--sm" href="' + h(href) + '" target="_blank" rel="noopener"><span>' + h(label) +
        '<span class="sr-only">' + h(srExtra || '') + ' (membuka tab baru)</span></span>' +
        icon('arrow-up-right', { size: 16, cls: 'btn__icon' }) + '</a>';
    }
    function btn(label, href, variant, iconName) {
      return '<a class="btn btn--' + (variant || 'primary') + ' btn--sm" href="' + h(href) + '"><span>' + h(label) + '</span>' +
        (iconName === false ? '' : icon(iconName || 'arrow-right', { size: 16, cls: 'btn__icon' })) + '</a>';
    }
    function dateLong(v) { return v && U.parseDate(v) ? U.formatDate(v) : ''; }
    function dateShort(v) { return v && U.parseDate(v) ? U.formatDate(v, { short: true }) : ''; }
    /* Tautan aplikasi/berkas: https://… atau jalur internal relatif (mis. aplikasi/simulator/index.html) */
    function safeHref(url) {
      var s = String(url || '').trim();
      if (/^https:\/\//i.test(s)) return s;
      if (/^[a-z0-9][\w\-./]*\.html(?:[?#][\w\-=&.%#]*)?$/i.test(s) && s.indexOf('..') === -1) return s;
      return '';
    }
    function plural(n, word) { return U.formatNumber(n) + ' ' + word; }

    /* Konten situs: statis + kelolaan admin (store.content.list). Bila layanan data
       belum tersedia, kembali ke data statis agar dasbor tetap terisi. */
    var contentCache = {};
    function content(type) {
      if (!contentCache[type]) {
        contentCache[type] = (async function () {
          try { return list(await store.content.list(type)); }
          catch (err) {
            console.warn('[dasbor] Konten "' + type + '" dimuat dari data statis:', err && (err.code || err.message));
            return list(PPAPI.data && PPAPI.data[type]).filter(function (x) { return !x.hidden; });
          }
        })();
      }
      return contentCache[type];
    }

    /* Agenda + kegiatan terbit (PPAPI.kegiatan, dengan pendaftaran); id yang sama → versi kegiatan */
    async function agendaWithKegiatan() {
      var both = await Promise.all([content('agenda'), PPAPI.kegiatan ? PPAPI.kegiatan.asAgendaItems() : Promise.resolve([])]);
      var kg = list(both[1]), ids = {};
      kg.forEach(function (x) { ids[x.id] = 1; });
      return both[0].filter(function (x) { return !ids[x.id]; }).concat(kg);
    }

    /* ==================================================================
       BAGIAN UMUM
       ================================================================== */
    function firstName(name) {
      var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
      // lewati gelar di depan nama (mis. "Ir.", "Dr.") bila masih ada kata berikutnya
      while (parts.length > 1 && /\.$/.test(parts[0]) && parts[0].length <= 5) parts.shift();
      return parts[0] || '';
    }
    /* Nomor KTA resmi hanya ditampilkan bila keanggotaan pernah disetujui
       (akun v1 yang belum diverifikasi masih menyimpan nomor sementara). */
    function officialKta(m, status) {
      if (!m || !m.kta) return '';
      if (status === 'Aktif' || status === 'Kedaluwarsa' || status === 'Nonaktif' || m.approvedAt) return m.kta;
      return '';
    }
    function lastHistory(m, action) {
      var hist = list(m && m.review && m.review.history);
      for (var i = hist.length - 1; i >= 0; i--) if (hist[i].action === action) return hist[i];
      return null;
    }
    /* Konteks perpanjangan: anggota yang pernah disetujui (Kedaluwarsa/Nonaktif) atau
       pengajuan berjenis perpanjangan dari pemegang KTA resmi — aturan yang sama dengan
       store.applicationType(). Selain itu: calon anggota (pendaftaran baru). */
    function isRenewal(s) {
      var m = s.member || {}, a = m.application || {};
      if (s.status === 'Kedaluwarsa' || s.status === 'Nonaktif') return true;
      return a.type === 'perpanjangan' && !!officialKta(m, s.status);
    }

    function renderHero(s) {
      var user = s.user, m = s.member || {};
      var name = m.name || user.name || '';
      var first = firstName(name) || (user.email ? String(user.email).split('@')[0] : '');
      var title = byId('dash-title');
      if (title) title.innerHTML = h(U.greeting()) + (first ? ', <em>' + h(first) + '</em>' : '');
      var eyebrow = byId('dash-eyebrow');
      if (eyebrow) eyebrow.textContent = s.isAdmin && !s.isMemberActive ? 'Dasbor Admin' : 'Dasbor Anggota';

      var av = byId('dash-avatar');
      if (av) {
        var ini = U.initials(name || first) || 'A';
        var photo = m.photoURL || user.photoURL;
        if (/^https:\/\//i.test(String(photo || ''))) {
          av.innerHTML = '<img src="' + h(photo) + '" alt="" width="96" height="96" referrerpolicy="no-referrer" decoding="async">';
          var img = av.querySelector('img');
          img.addEventListener('error', function () { av.textContent = ini; }, { once: true });
        } else {
          av.textContent = ini;
        }
      }

      var today = U.todayIso();
      var parts = ['<span><time datetime="' + h(today) + '">' + icon('calendar', { size: 16 }) + h(U.formatDate(today, { weekday: true })) + '</time></span>'];
      if (!s.member) {
        parts.push('<span class="badge badge--muted">Data keanggotaan belum tersedia</span>');
      } else {
        var kta = officialKta(m, s.status);
        if (kta) parts.push('<span>' + icon('id-card', { size: 16 }) + '<span class="sr-only">Nomor KTA </span><span class="dash-hero__kta">' + h(kta) + '</span></span>');
        if (kta && m.memberType) parts.push('<span>' + icon('award', { size: 16 }) + '<span class="sr-only">Kategori </span>' + h(m.memberType) + '</span>');
        if (s.isAdmin) parts.push('<span class="badge badge--metal">Admin PPAPI</span>');
        // admin yang keanggotaan pribadinya belum Aktif: lencana status tidak ditampilkan (sama dengan menu akun)
        if (!s.isAdmin || s.isMemberActive) parts.push('<span class="dash-hero__status"><span class="sr-only">Status </span>' + U.statusBadge(s.status) + '</span>');
      }
      fill(byId('dash-meta'), parts.join(''));

      var acts = byId('dash-hero-actions');
      if (acts) {
        var html;
        if (!s.member) html = '';
        else if (s.isAdmin) html = btn('Profil Anggota', 'anggota.html', 'ghost') + btn('Konsol Admin', 'admin.html', 'primary');
        else if (s.isActive) html = btn('Profil Anggota', 'anggota.html', 'ghost') + btn('Produk Pengetahuan', 'pustaka.html', 'primary');
        else html = btn('Syarat & Kategori', 'keanggotaan.html', 'ghost');
        acts.innerHTML = html;
        acts.hidden = !html;
      }
      renderVerify(s);
    }

    /* ------------------------------------------------------------------
       Verifikasi email (Mode Firebase). Email akun baru tercatat pada data
       keanggotaan setelah tautan verifikasi dibuka (aturan Firestore:
       email_verified). Akun Google sudah terverifikasi; akun demo dianggap
       terverifikasi, sehingga pemberitahuan ini tidak tampil di Mode Demo.
       ------------------------------------------------------------------ */
    function needsVerify(s) {
      var u = (s && s.user) || {};
      return !!(PPAPI.auth && PPAPI.auth.mode === 'firebase' && u.email && u.emailVerified === false);
    }
    function renderVerify(s) {
      var box = byId('dash-verify');
      if (!box) return;
      if (!needsVerify(s)) { box.hidden = true; box.innerHTML = ''; box.removeAttribute('data-for'); return; }
      var key = s.user.uid + '|' + s.user.email;
      if (box.getAttribute('data-for') === key && box.innerHTML) { box.hidden = false; return; }
      box.setAttribute('data-for', key);
      box.innerHTML = '<div class="dash-verify__inner" role="region" aria-labelledby="dash-verify-title">' +
        icon('mail', { size: 20, cls: 'dash-verify__icon' }) +
        '<div class="dash-verify__text">' +
          '<p class="dash-verify__title" id="dash-verify-title">Verifikasi alamat email Anda</p>' +
          '<p>Tautan verifikasi telah dikirim ke <strong>' + h(s.user.email) + '</strong>. Setelah tautan tersebut dibuka, email tercatat pada data keanggotaan sehingga sekretariat dapat menghubungi Anda.</p>' +
          '<p class="dash-verify__status" id="dash-verify-status" role="status" aria-live="polite"></p>' +
        '</div>' +
        '<div class="dash-verify__actions">' +
          '<button type="button" class="btn btn--primary btn--sm" data-verify="check"><span>Saya Sudah Memverifikasi</span></button>' +
          '<button type="button" class="btn btn--ghost btn--sm" data-verify="send"><span>Kirim Ulang Tautan</span></button>' +
        '</div></div>';
      box.hidden = false;
    }
    function verifyStatus(text) {
      var el = byId('dash-verify-status');
      if (el) el.textContent = text || '';
    }
    async function verifyCheck(btnEl) {
      ui.setLoading(btnEl, true, 'Memeriksa…');
      try {
        var u = await PPAPI.auth.refreshUser();
        if (u && u.emailVerified) {
          var s = await PPAPI.session.refresh();
          ui.toast('Alamat email Anda telah terverifikasi.', { type: 'success' });
          renderVerify(s);
          return;
        }
        verifyStatus('Email belum terverifikasi. Buka tautan pada email dari PPAPI (periksa juga folder Spam), lalu tekan tombol ini kembali.');
      } catch (err) {
        verifyStatus((err && err.message) || 'Status verifikasi belum dapat diperiksa. Periksa koneksi Anda, lalu coba lagi.');
      }
      ui.setLoading(btnEl, false);
    }
    async function verifySend(btnEl) {
      ui.setLoading(btnEl, true, 'Mengirim…');
      try {
        await PPAPI.auth.sendEmailVerification();
        var u = PPAPI.auth.current() || {};
        verifyStatus('Tautan verifikasi baru telah dikirim ke ' + (u.email || 'email Anda') + '.');
      } catch (err) {
        if (err && err.code === 'auth/email-already-verified') { ui.setLoading(btnEl, false); return verifyCheck(btnEl); }
        verifyStatus((err && err.message) || 'Tautan verifikasi belum dapat dikirim. Silakan coba lagi beberapa saat lagi.');
      }
      ui.setLoading(btnEl, false);
    }
    d.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('#dash-verify [data-verify]');
      if (!b || b.getAttribute('aria-busy') === 'true' || b.disabled) return;
      if (b.getAttribute('data-verify') === 'check') verifyCheck(b);
      else verifySend(b);
    });

    function showView(mode) {
      var sv = byId('dash-status-view'), av = byId('dash-active-view'), er = byId('dash-error');
      if (sv) sv.hidden = mode !== 'status';
      if (av) av.hidden = mode !== 'active';
      if (er) er.hidden = mode !== 'error';
      d.body.setAttribute('data-dash-view', mode);
      if (mode !== 'active') d.body.removeAttribute('data-dash-admin');
      placeKegiatan(mode);
    }

    /* Kegiatan Saya (kegiatan-saya.js) — untuk setiap akun: di tampilan Aktif sebelum isi dasbor,
       di pusat status sebelum "Informasi keanggotaan". Dipasang sekali; kegiatan-saya.js menyegarkan
       sendiri saat sesi berubah. Tautan menu akun: dashboard.html#kegiatan-saya. */
    var kgsMounted = false;
    function placeKegiatan(mode) {
      var sec = byId('kegiatan-saya');
      if (!sec) return;
      var anchor = mode === 'active' ? d.querySelector('#dash-active-view .dash-body') : mode === 'status' ? d.querySelector('#dash-status-view .dash-help') : null;
      if (!anchor || !PPAPI.kegiatanSaya) { sec.hidden = true; return; }
      if (sec.nextElementSibling !== anchor) anchor.parentNode.insertBefore(sec, anchor);
      sec.hidden = false;
      if (!kgsMounted) {
        kgsMounted = true;
        PPAPI.kegiatanSaya.render(byId('dash-kegiatan'), { next: 'dashboard.html#kegiatan-saya', headingId: 'dash-h-kegiatan' })
          .then(focusKegiatan, function (err) { console.error(err); });
      }
    }
    function focusKegiatan() {
      var sec = byId('kegiatan-saya');
      if (w.location.hash !== '#kegiatan-saya' || !sec || sec.hidden) return;
      sec.scrollIntoView({ block: 'start' });
      try { sec.focus({ preventScroll: true }); } catch (e) { sec.focus(); }
    }
    w.addEventListener('hashchange', focusKegiatan);

    function showError(err) {
      showView('error');
      var box = byId('dash-error');
      if (!box) return;
      box.innerHTML = '<div class="alert alert--err dash-error" role="alert">' + icon('alert-triangle') +
        '<div><p class="alert__title">Data keanggotaan belum dapat dimuat.</p><p>' +
        h((err && err.message) || 'Periksa koneksi internet Anda, lalu muat ulang halaman ini.') + '</p>' +
        '<p class="mt-2"><button type="button" class="btn btn--ghost btn--sm" data-action="reload"><span>Muat ulang</span></button></p></div></div>';
      ui.reveal(box);
    }
    d.addEventListener('click', function (e) {
      if (e.target.closest && e.target.closest('#dash-error [data-action="reload"]')) w.location.reload();
    });

    /* ==================================================================
       A. PUSAT STATUS (keanggotaan belum Aktif)
       ================================================================== */
    var STEP_LABEL = { 'kategori': 'Kategori', 'data-diri': 'Data Diri', 'profesional': 'Data Profesional', 'dokumen': 'Dokumen Pendukung', 'pernyataan': 'Pernyataan' };
    /* gambaran singkat tiap langkah formulir (selaras dengan pengantar langkah di pendaftaran.html) */
    var STEP_HINT = {
      'kategori': 'Kategori yang sesuai dengan peran Anda di bidang perancah.',
      'data-diri': 'Identitas resmi, kontak, dan domisili.',
      'profesional': 'Tempat bekerja dan pengalaman di bidang perancah.',
      'dokumen': 'Tautan bukti pembayaran iuran.',
      'pernyataan': 'Persetujuan pernyataan pemohon dan nama terang sebagai tanda tangan.'
    };
    var STATE_SR = { done: 'selesai', current: 'tahap saat ini', warn: 'perlu tindakan', error: 'tidak berlanjut' };

    function ctaFor(status, renew) {
      if (status === 'Draf' && renew) return ['Lanjutkan Pengajuan Perpanjangan', 'pendaftaran.html'];
      if (status === 'Ditolak' && renew) return ['Ajukan Ulang Perpanjangan', 'pendaftaran.html'];
      return {
        'Draf': ['Lengkapi Formulir Pendaftaran', 'pendaftaran.html'],
        'Menunggu Verifikasi': ['Lihat Pengajuan', 'pendaftaran.html'],
        'Perlu Perbaikan': ['Perbaiki Pengajuan', 'pendaftaran.html'],
        'Ditolak': ['Ajukan Ulang', 'pendaftaran.html'],
        'Kedaluwarsa': ['Ajukan Perpanjangan', 'pendaftaran.html'],
        'Nonaktif': ['Ajukan Perpanjangan', 'pendaftaran.html']
      }[status] || ['Lengkapi Formulir Pendaftaran', 'pendaftaran.html'];
    }

    function statusText(s) {
      var m = s.member, a = m.application || {}, renew = isRenewal(s);
      var sub = dateLong(a.submittedAt);
      switch (s.status) {
        case 'Menunggu Verifikasi':
          return renew
            ? 'Pengajuan perpanjangan keanggotaan Anda ' + (sub ? 'diterima pada ' + sub + ' dan ' : '') + 'sedang diperiksa sekretariat PPAPI. Fitur anggota terbuka kembali setelah perpanjangan disetujui.'
            : 'Pengajuan Anda ' + (sub ? 'diterima pada ' + sub + ' dan ' : '') + 'sedang diperiksa sekretariat PPAPI. Hasil verifikasi akan tampil di dasbor ini. Selama pemeriksaan, data pengajuan tidak dapat diubah; bila perlu mengoreksi, tarik pengajuan melalui halaman formulir.';
        case 'Perlu Perbaikan':
          return 'Sekretariat telah memeriksa pengajuan ' + (renew ? 'perpanjangan ' : '') + 'Anda dan meminta beberapa perbaikan. Perbarui data sesuai catatan di bawah, lalu kirim kembali pengajuan untuk diverifikasi.';
        case 'Ditolak':
          return renew
            ? 'Pengajuan perpanjangan keanggotaan Anda belum dapat disetujui. Pelajari alasan dari sekretariat di bawah. Anda dapat memperbarui data dan mengajukan kembali perpanjangan, atau menghubungi sekretariat untuk penjelasan lebih lanjut.'
            : 'Pengajuan keanggotaan Anda belum dapat disetujui. Pelajari alasan dari sekretariat di bawah. Anda dapat memperbarui data dan mengajukan kembali, atau menghubungi sekretariat untuk penjelasan lebih lanjut.';
        case 'Nonaktif':
          return 'Keanggotaan Anda sedang dinonaktifkan sekretariat, sehingga Kartu Tanda Anggota dan fitur anggota tidak dapat digunakan untuk sementara. Ajukan perpanjangan atau hubungi sekretariat untuk mengaktifkan kembali keanggotaan Anda.';
        case 'Kedaluwarsa':
          return 'Masa berlaku keanggotaan Anda berakhir' + (m.validUntil ? ' pada ' + dateLong(m.validUntil) : '') + '. Ajukan perpanjangan agar Kartu Tanda Anggota, Produk Pengetahuan, dan aplikasi anggota dapat digunakan kembali.';
        default:
          return renew
            ? 'Pengajuan perpanjangan Anda belum dikirim. Data keanggotaan sebelumnya tetap tersimpan — periksa dan perbarui bila perlu, lalu kirim pengajuan untuk diverifikasi sekretariat. Isian tersimpan otomatis sehingga dapat dilanjutkan kapan saja.'
            : 'Akun Anda sudah dibuat. Langkah berikutnya adalah mengisi formulir pendaftaran — kategori keanggotaan, data diri, data profesional, dan pernyataan — lalu mengirimkannya untuk diverifikasi sekretariat. Isian tersimpan otomatis sehingga dapat dilanjutkan kapan saja.';
      }
    }

    /* Teks pendamping pusat status — judul & pengantar "Fitur Anggota", blok bantuan,
       dan panel KTA — mengikuti status dan konteks (calon anggota · perpanjangan). */
    function statusCopy(s) {
      var st = s.status, renew = isRenewal(s);
      var c = {
        fiturTitle: renew ? 'Terbuka kembali setelah keanggotaan' : 'Terbuka setelah keanggotaan',
        helpTitle: renew ? 'Informasi untuk anggota' : 'Informasi untuk calon anggota',
        kta: renew
          ? 'KTA Anda aktif kembali setelah perpanjangan disetujui sekretariat — lengkap dengan kode QR verifikasi, profil, kompetensi, dan sertifikat Anda.'
          : 'KTA dengan kode QR verifikasi, beserta profil, kompetensi, dan sertifikat Anda — terbit setelah keanggotaan disetujui sekretariat.'
      };
      if (st === 'Nonaktif') {
        c.fiturLead = 'Fitur berikut dapat digunakan kembali setelah perpanjangan Anda disetujui atau keanggotaan Anda diaktifkan kembali oleh sekretariat PPAPI.';
        c.helpLead = 'Halaman publik berikut tetap dapat dibuka selama keanggotaan Anda nonaktif.';
        c.kta = 'KTA Anda aktif kembali setelah perpanjangan disetujui atau keanggotaan dipulihkan sekretariat — lengkap dengan kode QR verifikasi, profil, kompetensi, dan sertifikat Anda.';
      } else if (st === 'Kedaluwarsa') {
        c.fiturLead = 'Fitur berikut dapat digunakan kembali setelah pengajuan perpanjangan Anda disetujui sekretariat PPAPI.';
        c.helpLead = 'Halaman publik berikut tetap dapat dibuka selama keanggotaan Anda belum diperpanjang.';
      } else if (st === 'Ditolak') {
        c.fiturLead = renew
          ? 'Fitur berikut dapat digunakan kembali setelah pengajuan ulang perpanjangan Anda disetujui sekretariat PPAPI.'
          : 'Fitur berikut tersedia bagi anggota berstatus Aktif, setelah pengajuan ulang Anda disetujui sekretariat PPAPI.';
        c.helpTitle = renew ? 'Informasi untuk anggota' : 'Informasi keanggotaan';
        c.helpLead = renew
          ? 'Pelajari kembali ketentuan keanggotaan sebelum mengajukan ulang perpanjangan. Halaman publik berikut tetap dapat dibuka.'
          : 'Pelajari kembali syarat dan kategori keanggotaan sebelum mengajukan ulang. Halaman publik berikut tetap dapat dibuka.';
      } else if (st === 'Draf') {
        c.fiturLead = renew
          ? 'Fitur berikut dapat digunakan kembali setelah pengajuan perpanjangan Anda dikirim dan disetujui sekretariat PPAPI.'
          : 'Fitur berikut tersedia bagi anggota berstatus Aktif, setelah pengajuan Anda dikirim dan disetujui sekretariat PPAPI.';
        c.helpLead = 'Halaman publik berikut dapat dibuka sebelum dan selama pengajuan ' + (renew ? 'perpanjangan ' : '') + 'diproses.';
      } else { /* Menunggu Verifikasi · Perlu Perbaikan */
        c.fiturLead = renew
          ? 'Fitur berikut dapat digunakan kembali setelah perpanjangan keanggotaan Anda disetujui sekretariat PPAPI.'
          : 'Fitur berikut tersedia bagi anggota berstatus Aktif, setelah pengajuan Anda disetujui sekretariat PPAPI.';
        c.helpLead = 'Halaman publik berikut tetap dapat dibuka selama pengajuan ' + (renew ? 'perpanjangan ' : '') + 'diproses.';
      }
      return c;
    }
    function renderStatusCopy(s) {
      var c = statusCopy(s);
      var ft = byId('dash-h-fitur'), fl = byId('dash-fitur-lead'), ht = byId('dash-h-help'), hl = byId('dash-help-lead');
      if (ft) ft.innerHTML = h(c.fiturTitle) + ' <em>Aktif</em>';
      if (fl) fl.textContent = c.fiturLead;
      if (ht) ht.textContent = c.helpTitle;
      if (hl) hl.textContent = c.helpLead;
      return c;
    }

    function noteBlock(s) {
      var m = s.member, note = String((m.review && m.review.note) || '').trim();
      if (!note) return '';
      var map = { 'Perlu Perbaikan': ['Catatan perbaikan dari sekretariat', 'perbaikan'], 'Ditolak': ['Alasan dari sekretariat', 'ditolak'], 'Nonaktif': ['Catatan sekretariat', 'dinonaktifkan'] };
      var cfgNote = map[s.status];
      if (!cfgNote) return '';
      var ev = lastHistory(m, cfgNote[1]);
      var when = ev ? dateLong(ev.at) : '';
      return '<figure class="dash-sc__note dash-sc__note--' + h(U.statusTone(s.status)) + '">' +
        '<figcaption class="dash-sc__note-head">' + icon('message', { size: 16 }) + '<span>' + h(cfgNote[0]) + '</span></figcaption>' +
        '<blockquote class="dash-sc__note-text"><p>' + h(note) + '</p></blockquote>' +
        '<p class="dash-sc__note-meta">Sekretariat PPAPI' + (when ? ' · <time datetime="' + h(String(ev.at).slice(0, 10)) + '">' + h(when) + '</time>' : '') + '</p>' +
      '</figure>';
    }

    function requirementsBlock(s) {
      var m = s.member;
      var missing = [], total = 0;
      try {
        missing = list(store.applicationMissing(m));
        total = list(store.applicationMissing(null)).length;
      } catch (err) { console.warn('[dasbor] Kelengkapan pengajuan:', err && err.message); }
      if (!total) return '';
      var done = Math.max(0, total - missing.length);
      var pct = Math.round(done / total * 100);
      var groups = [], byStep = {};
      missing.forEach(function (x) {
        var k = x.step || 'lainnya';
        if (!byStep[k]) { byStep[k] = []; groups.push(k); }
        byStep[k].push(x.label);
      });
      var renewal = isRenewal(s);
      /* Satu baris per langkah: jumlah isian yang belum diisi + gambaran singkat langkahnya;
         rincian per isian ditampilkan oleh formulir (ringkasan galat & langkah Tinjau). */
      var body = missing.length
        ? '<p class="dash-req__hint">Belum lengkap — pilih untuk membuka langkahnya:</p><ul class="dash-req__list" role="list">' + groups.map(function (k) {
            /* pendaftaran.html membuka langkah formulir sesuai #kunci langkah */
            var href = STEP_LABEL[k] ? 'pendaftaran.html#' + encodeURIComponent(k) : 'pendaftaran.html';
            var n = byStep[k].length;
            var count = k === 'kategori' ? 'Kategori belum dipilih' : n + ' isian wajib belum diisi';
            return '<li><a class="dash-req__row" href="' + h(href) + '"><span class="dash-req__step">' + h(STEP_LABEL[k] || 'Lainnya') + '</span>' +
              '<span class="dash-req__body"><span class="dash-req__count">' + h(count) + '</span>' +
              (STEP_HINT[k] ? '<span class="dash-req__desc">' + h(STEP_HINT[k]) + '</span>' : '') + '</span>' +
              icon('chevron-right', { size: 16 }) + '</a></li>';
          }).join('') + '</ul>'
        : '<p class="dash-req__ok">' + icon('check-circle', { size: 18 }) + '<span>' + h(
            s.status === 'Perlu Perbaikan' ? 'Persyaratan wajib telah terisi. Perbarui data sesuai catatan sekretariat, lalu kirim kembali pengajuan.'
            : s.status === 'Ditolak' ? 'Persyaratan wajib telah terisi. Perbarui data sesuai alasan dari sekretariat, lalu ajukan kembali' + (renewal ? ' perpanjangan.' : '.')
            : renewal ? 'Data pengajuan sebelumnya masih tersimpan. Periksa dan perbarui bila perlu, lalu kirim pengajuan perpanjangan.'
            : 'Seluruh persyaratan wajib telah terisi. Periksa kembali isian Anda, lalu kirim pengajuan.') + '</span></p>';
      return '<div class="dash-req">' +
        '<p class="dash-sc__side-title">Kelengkapan ' + (renewal ? 'pengajuan perpanjangan' : 'pengajuan') + '</p>' +
        '<p class="dash-req__score"><span class="dash-req__val">' + h(String(done)) + '</span><span class="dash-req__of">dari ' + h(String(total)) + ' persyaratan wajib terisi</span></p>' +
        '<div class="progress progress--metal" style="--value:' + pct + '" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Kelengkapan pengajuan ' + pct + ' persen"></div>' +
        body +
      '</div>';
    }

    function kvRow(label, value, raw) {
      return '<div class="kv__row"><dt>' + h(label) + '</dt><dd>' + (raw ? value : h(value || '—')) + '</dd></div>';
    }

    function summaryBlock(s) {
      var m = s.member, a = m.application || {};
      var sub = a.submittedAt ? dateLong(a.submittedAt) + ' · ' + U.relativeTime(a.submittedAt) : '';
      return '<p class="dash-sc__side-title">Ringkasan pengajuan</p><dl class="kv dash-sc__kv">' +
        kvRow('Jenis pengajuan', a.type === 'perpanjangan' ? 'Perpanjangan keanggotaan' : 'Pendaftaran anggota baru') +
        kvRow('Kategori diajukan', a.kategori) +
        kvRow('Tanggal pengajuan', sub) +
        kvRow('Riwayat proyek', list(a.pengalaman).length ? plural(list(a.pengalaman).length, 'entri') : 'Tidak dicantumkan') +
        kvRow('Dokumen pendukung', list(a.dokumen).length ? plural(list(a.dokumen).length, 'tautan') : 'Tidak dilampirkan') +
      '</dl>';
    }

    function membershipBlock(s) {
      var m = s.member;
      return '<p class="dash-sc__side-title">Data keanggotaan</p><dl class="kv dash-sc__kv">' +
        kvRow('Nomor KTA', officialKta(m, s.status)) +
        kvRow('Kategori', officialKta(m, s.status) ? m.memberType : '') +
        kvRow('Anggota sejak', dateLong(m.joinedAt)) +
        kvRow('Berlaku hingga', dateLong(m.validUntil) || 'Ditetapkan sekretariat') +
      '</dl>' +
      '<p class="dash-sc__side-note">' + icon('info', { size: 16 }) + '<span>Data pengajuan sebelumnya tetap tersimpan dan dapat digunakan kembali untuk pengajuan perpanjangan.</span></p>';
    }

    function trackSteps(s) {
      var m = s.member, a = m.application || {}, st = s.status;
      var renew = isRenewal(s);
      var created = dateShort(m.createdAt || (s.user && s.user.createdAt));
      var sub = dateShort(a.submittedAt);
      var steps;
      if (renew && (st === 'Kedaluwarsa' || st === 'Nonaktif')) {
        var off = st === 'Nonaktif' ? lastHistory(m, 'dinonaktifkan') : null;
        steps = [
          { label: 'Akun dibuat', meta: created, state: 'done' },
          { label: 'Formulir diajukan', meta: sub, state: 'done' },
          { label: 'Disetujui sekretariat', meta: dateShort(m.approvedAt), state: 'done' },
          st === 'Nonaktif'
            ? { label: 'Dinonaktifkan', meta: off ? dateShort(off.at) : 'Hubungi sekretariat', state: 'error' }
            : { label: 'Masa berlaku berakhir', meta: dateShort(m.validUntil), state: 'error' }
        ];
        return { title: 'Riwayat keanggotaan', steps: steps };
      }
      var ev3;
      if (st === 'Menunggu Verifikasi') ev3 = { label: 'Verifikasi sekretariat', meta: 'Sedang diperiksa', state: 'current' };
      else if (st === 'Perlu Perbaikan') { var p = lastHistory(m, 'perbaikan'); ev3 = { label: 'Perlu perbaikan', meta: p ? dateShort(p.at) : 'Lihat catatan', state: 'warn' }; }
      else if (st === 'Ditolak') { var r = lastHistory(m, 'ditolak'); ev3 = { label: 'Belum disetujui', meta: r ? dateShort(r.at) : '', state: 'error' }; }
      else ev3 = { label: 'Verifikasi sekretariat', meta: '', state: '' };
      steps = [
        renew
          ? { label: 'Anggota sejak', meta: dateShort(m.joinedAt), state: 'done' }
          : { label: 'Akun dibuat', meta: created, state: 'done' },
        st === 'Draf'
          ? { label: renew ? 'Pengajuan perpanjangan' : 'Formulir diajukan', meta: 'Belum diajukan', state: 'current' }
          : { label: renew ? 'Perpanjangan diajukan' : 'Formulir diajukan', meta: sub, state: 'done' },
        ev3,
        { label: renew ? 'Aktif kembali' : 'Aktif & KTA digital', meta: st === 'Ditolak' ? 'Dapat diajukan ulang' : '', state: '' }
      ];
      return { title: renew ? 'Tahapan perpanjangan' : 'Tahapan pendaftaran', steps: steps };
    }

    function trackHtml(t) {
      return '<ol class="status-track" aria-label="' + h(t.title) + '">' + t.steps.map(function (x) {
        var cls = x.state === 'done' ? ' is-done' : x.state === 'current' ? ' is-current' : x.state === 'warn' ? ' is-warn' : x.state === 'error' ? ' is-error' : '';
        var cur = x.state === 'current' || x.state === 'warn' || x.state === 'error';
        return '<li class="status-track__step' + cls + '"' + (cur ? ' aria-current="step"' : '') + '>' +
          '<span class="status-track__node" aria-hidden="true"></span>' +
          '<span class="status-track__label">' + h(x.label) + (STATE_SR[x.state] ? '<span class="sr-only"> (' + STATE_SR[x.state] + ')</span>' : '') + '</span>' +
          (x.meta ? '<span class="status-track__meta">' + h(x.meta) + '</span>' : '') +
        '</li>';
      }).join('') + '</ol>';
    }

    function renderStatusCard(s) {
      var tone = U.statusTone(s.status);
      var cta = ctaFor(s.status, isRenewal(s));
      var side;
      if (s.status === 'Menunggu Verifikasi') side = summaryBlock(s);
      else if (s.status === 'Kedaluwarsa' || s.status === 'Nonaktif') side = membershipBlock(s);
      else side = requirementsBlock(s);
      var actions = btn(cta[0], cta[1], 'primary');
      if (s.status === 'Ditolak' || s.status === 'Nonaktif') actions += btn('Hubungi Sekretariat', 'umpan-balik.html?kategori=pertanyaan', 'ghost', false);
      else if (s.status === 'Draf') actions += link('Syarat keanggotaan', 'keanggotaan.html');
      var t = trackSteps(s);
      fill(byId('dash-sc'),
        '<div class="dash-sc__grid">' +
          '<div class="dash-sc__main">' +
            '<p class="eyebrow dash-sc__eyebrow">Status Keanggotaan</p>' +
            '<h2 class="dash-sc__status dash-sc__status--' + h(tone) + '" id="dash-sc-title"><span class="sr-only">Status keanggotaan: </span>' + h(s.status) + '</h2>' +
            '<p class="dash-sc__label">' + h(s.statusLabel) + '</p>' +
            '<p class="dash-sc__text">' + h(statusText(s)) + '</p>' +
            noteBlock(s) +
            '<div class="dash-sc__actions">' + actions + '</div>' +
          '</div>' +
          '<div class="dash-sc__side">' + side + '</div>' +
        '</div>' +
        '<div class="dash-sc__track">' +
          '<p class="dash-sc__track-title" aria-hidden="true">' + h(t.title) + '</p>' +
          trackHtml(t) +
        '</div>');
    }

    function ktaPreview(s) {
      var m = s.member || {}, name = m.name || (s.user && s.user.name) || 'Nama Anggota';
      /* pemegang KTA resmi (Nonaktif · Kedaluwarsa · perpanjangan) melihat nomornya sendiri, tersamar */
      var no = officialKta(m, s.status) || 'PPAPI-0000-000000';
      return '<div class="dash-ktamock theme-dark">' +
        '<div class="dash-ktamock__top"><img src="assets/img/logo-light-sm.webp" alt="" width="480" height="167" decoding="async" loading="lazy"><span>Kartu Tanda Anggota</span></div>' +
        '<p class="dash-ktamock__name">' + h(name) + '</p>' +
        '<p class="dash-ktamock__no">' + h(no) + '</p>' +
        '<div class="dash-ktamock__facts"><span>Kategori</span><span>Berlaku hingga</span><span>Status</span></div>' +
      '</div>';
    }

    /* Cuplikan fitur terkunci. Kartu kecil hanya memuat keterangan (tanpa tautan) agar
       kisi seragam; tautan halaman publik dikumpulkan pada blok bantuan di bawahnya.
       Panel KTA membawa satu ajakan tindakan — langkah berikutnya sesuai status. */
    async function renderTeasers(s, copy) {
      var apps = list(cfg.apps);
      var appBy = {}; apps.forEach(function (a) { appBy[a.key] = a; });
      var docs = (await content('pustaka')).filter(function (x) { return x.kategori !== 'Aplikasi'; });
      var cta = ctaFor(s.status, isRenewal(s));
      var veilAction = s.status === 'Menunggu Verifikasi' ? '' : btn(cta[0], cta[1], 'primary');
      function teaser(o) {
        return '<div class="dash-teaser">' +
          '<span class="dash-teaser__lock">' + icon('lock', { size: 14 }) + '<span>Terkunci</span></span>' +
          ui.locked({ compact: true, icon: o.icon, eyebrow: o.eyebrow, title: o.title, text: o.text, actionHtml: '' }) +
        '</div>';
      }
      var cards = [];
      cards.push(teaser({
        icon: 'book', eyebrow: 'Produk Pengetahuan', title: 'Standar, CoP & modul pelatihan',
        text: 'Standar, Code of Practice, peraturan perundangan, petunjuk teknis, serta modul dan panduan pelatihan PPAPI' +
          (docs.length ? ' — ' + U.formatNumber(docs.length) + ' judul dalam katalog.' : '.')
      }));
      ['perencanaan', 'simulator'].forEach(function (k) {
        var a = appBy[k];
        if (!a) return;
        cards.push(teaser({ icon: a.ikon || (k === 'simulator' ? 'layers' : 'ruler'), eyebrow: 'Aplikasi Anggota', title: a.short || a.title, text: a.desc || '' }));
      });
      cards.push(teaser({
        icon: 'calendar', eyebrow: 'Dasbor Anggota', title: 'Agenda, regulasi & pengingat',
        text: 'Ringkasan kegiatan terdekat, regulasi kunci, pengumuman sekretariat, dan pengingat masa berlaku sertifikat Anda.'
      }));
      fill(byId('dash-teasers'),
        '<div class="dash-teasers__grid">' +
          '<div class="dash-teasers__feature locked-veil">' +
            '<div class="locked-veil__content" aria-hidden="true" inert>' + ktaPreview(s) + '</div>' +
            ui.locked({ compact: true, icon: 'id-card', eyebrow: 'Khusus Anggota Aktif', title: 'Kartu Tanda Anggota digital',
              text: (copy || statusCopy(s)).kta, actionHtml: veilAction }) +
          '</div>' +
          cards.join('') +
        '</div>');
    }

    async function renderStatusView(s) {
      showView('status');
      var copy = renderStatusCopy(s);
      renderStatusCard(s);
      await renderTeasers(s, copy);
    }

    /* ==================================================================
       B. DASBOR ANGGOTA (Aktif / admin)
       ================================================================== */

    /* 1. Kegiatan Mendatang — agenda terdekat */
    async function renderAgenda() {
      var box = byId('dash-agenda');
      var today = U.todayIso();
      var items = (await agendaWithKegiatan())
        .filter(function (a) { return a.mulai && String(a.selesai || a.mulai) >= today; })
        .sort(function (a, b) { return cmp(String(a.mulai), String(b.mulai)); })
        .slice(0, MAX_AGENDA);
      if (!items.length) {
        fill(box, ui.emptyState({
          icon: 'calendar', title: 'Belum ada agenda terdekat',
          text: 'Kegiatan berikutnya akan diumumkan oleh sekretariat. Agenda yang telah berlangsung tetap dapat dilihat di halaman Agenda.',
          actionHtml: link('Buka halaman agenda', 'agenda.html')
        }));
        return;
      }
      fill(box, '<div class="dash-events" data-reveal-stagger>' + items.map(function (a, i) {
        var s = U.parseDate(a.mulai), e = U.parseDate(a.selesai) || s;
        var multi = e && s && e > s;
        var sameMonth = multi && s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear();
        var dayTxt = s.getDate() + (sameMonth ? '–' + e.getDate() : '');
        var days = U.daysUntil(a.mulai);
        var countdown = days <= 0
          ? '<p class="dash-countdown dash-countdown--now"><span class="dash-countdown__label">Sedang berlangsung</span></p>'
          : '<p class="dash-countdown"><span class="dash-countdown__num">' + h(String(days)) + '</span> <span class="dash-countdown__label">' + (days === 1 ? 'hari lagi · besok' : 'hari lagi') + '</span></p>';
        var info = [];
        if (a.waktu) info.push('<span>' + icon('clock', { size: 16 }) + h(a.waktu) + '</span>');
        if (multi && !sameMonth) info.push('<span>' + icon('calendar', { size: 16 }) + h(U.formatDateRange(a.mulai, a.selesai)) + '</span>');
        if (a.lokasi) info.push('<span>' + icon('map-pin', { size: 16 }) + h(a.lokasi) + '</span>');
        return '<article class="event-row dash-event">' +
          '<time class="date-block' + (sameMonth ? ' date-block--range' : '') + (i === 0 ? ' date-block--dark' : '') + '" datetime="' + h(a.mulai) + '">' +
            '<span class="date-block__day">' + h(dayTxt) + '</span>' +
            '<span class="date-block__month">' + h(U.MONTHS_SHORT[s.getMonth()]) + '</span>' +
            '<span class="date-block__year">' + h(String(s.getFullYear())) + '</span>' +
            '<span class="sr-only">' + h(U.formatDateRange(a.mulai, a.selesai)) + '</span>' +
          '</time>' +
          '<div class="event-row__body">' +
            '<div class="event-row__meta">' + (a.jenis ? '<span class="tag">' + h(a.jenis) + '</span>' : '') +
              (a.mode ? '<span class="badge badge--outline">' + h(a.mode) + '</span>' : '') + U.contohBadge(a) + '</div>' +
            '<h3 class="event-row__title"><a href="agenda.html?id=' + encodeURIComponent(a.id || '') + '">' + h(a.judul) + '</a></h3>' +
            (info.length ? '<p class="event-row__info">' + info.join('') + '</p>' : '') +
          '</div>' +
          '<div class="event-row__aside dash-event__aside">' + countdown + '</div>' +
        '</article>';
      }).join('') + '</div>');
    }

    /* 2. Produk Pengetahuan terbaru (tanpa kategori Aplikasi — aplikasi punya pita sendiri) */
    var DOC_ICON = { 'Standar': 'award', 'Code of Practice': 'shield-check', 'Petunjuk Teknis': 'wrench', 'Modul Pelatihan': 'book', 'Formulir & Daftar Periksa': 'check-circle', 'Kajian Teknis': 'activity', 'Aplikasi': 'layers' };
    var DOC_TONE = { 'Berlaku': 'ok', 'Draf': 'muted', 'Dalam Penyusunan': 'warn' };
    function pustakaHref(item) { return 'pustaka.html?id=' + encodeURIComponent(item.id || ''); }
    async function renderPustaka() {
      var box = byId('dash-pustaka');
      var all = (await content('pustaka')).filter(function (x) { return x.kategori !== 'Aplikasi'; });
      /* terbaru: tanggal terbit (atau tanggal pembaruan oleh admin) menurun; tanpa tanggal → urutan katalog */
      var items = all.map(function (x, i) { return { x: x, i: i, k: String(x.tanggal || (x._managed && x.updatedAt) || '').slice(0, 10) }; })
        .sort(function (a, b) { return a.k === b.k ? a.i - b.i : !a.k ? 1 : !b.k ? -1 : cmp(b.k, a.k); })
        .slice(0, MAX_PUSTAKA).map(function (o) { return o.x; });
      if (!items.length) {
        fill(box, ui.emptyState({ icon: 'book', title: 'Katalog belum berisi dokumen', text: 'Produk Pengetahuan PPAPI akan tampil di sini setelah diterbitkan sekretariat.', actionHtml: link('Buka katalog', 'pustaka.html') }));
        return;
      }
      fill(box, '<div class="dash-docs" data-reveal-stagger>' + items.map(function (x) {
        var meta = [x.versi, x.tanggal ? dateShort(x.tanggal) : '', x.format, x.halaman].filter(Boolean);
        return '<article class="doc-card dash-doc">' +
          '<div class="doc-card__top"><span class="doc-card__kind">' + icon(DOC_ICON[x.kategori] || 'file-text', { size: 16 }) + h(x.kategori || 'Dokumen') + '</span>' +
            (x.kode ? '<span class="doc-card__code">' + h(x.kode) + '</span>' : '') + '</div>' +
          '<h3 class="doc-card__title"><a href="' + h(pustakaHref(x)) + '">' + h(x.judul) + '</a></h3>' +
          (x.ringkasan ? '<p class="doc-card__summary">' + h(x.ringkasan) + '</p>' : '') +
          (meta.length ? '<div class="doc-card__meta">' + meta.map(function (v) { return '<span>' + h(v) + '</span>'; }).join('') + '</div>' : '') +
          '<div class="doc-card__foot">' +
            (x.status ? '<span class="badge badge--' + (DOC_TONE[x.status] || 'muted') + '">' + h(x.status) + '</span>' : '') +
            U.contohBadge(x) +
            '<span class="doc-card__access" aria-hidden="true">' + icon('arrow-right', { size: 14 }) + 'Lihat</span>' +
          '</div>' +
        '</article>';
      }).join('') + '</div>');
    }

    /* 3. Berita Terbaru */
    async function renderBerita() {
      var box = byId('dash-berita');
      var items = (await content('berita')).slice()
        .sort(function (a, b) { return cmp(String(b.tanggal || ''), String(a.tanggal || '')); })
        .slice(0, MAX_BERITA);
      if (!items.length) {
        fill(box, ui.emptyState({ icon: 'file-text', title: 'Belum ada berita', text: 'Berita dan kabar kegiatan akan tampil di sini setelah diterbitkan.' }));
        return;
      }
      fill(box, '<div class="dash-news__grid" data-reveal-stagger>' + items.map(function (b) {
        var media = b.gambar && U.images && U.images[b.gambar]
          ? U.img(b.gambar, { small: true, cls: 'img-mono', alt: '' })
          : /^https:\/\//i.test(String(b.gambar || ''))
            ? '<img class="img-mono" src="' + h(b.gambar) + '" alt="" width="720" height="480" loading="lazy" decoding="async" referrerpolicy="no-referrer">'
            : '<span class="dash-news-card__ph" aria-hidden="true">' + icon('file-text', { size: 28 }) + '</span>';
        return '<article class="news-card dash-news-card">' +
          '<div class="news-card__media">' + media + '</div>' +
          '<div class="dash-news-card__body">' +
            '<div class="news-card__meta">' + (b.kategori ? '<span class="tag">' + h(b.kategori) + '</span>' : '') +
              (b.tanggal ? '<time datetime="' + h(b.tanggal) + '">' + h(U.formatDate(b.tanggal, { short: true })) + '</time>' : '') +
              U.contohBadge(b) + '</div>' +
            '<h3 class="news-card__title"><a href="berita.html?id=' + encodeURIComponent(b.id || '') + '">' + h(b.judul) + '</a></h3>' +
          '</div>' +
        '</article>';
      }).join('') + '</div>');
    }

    /* 4. Peraturan Perundang-undangan — regulasi kunci */
    function regTone(status) {
      if (status === 'Dicabut') return 'err';
      if (status === 'Berlaku') return 'ok';
      return 'warn';
    }
    async function renderRegulasi() {
      var box = byId('dash-regulasi');
      var all = await content('regulasi');
      var items = all.filter(function (r) { return r.kunci; });
      if (!items.length) {
        fill(box, ui.emptyState({ icon: 'scale', title: 'Daftar regulasi belum tersedia', text: 'Pustaka regulasi dan standar dapat dibuka melalui halaman Regulasi.', actionHtml: link('Buka pustaka regulasi', 'regulasi.html') }));
        return;
      }
      var rows = items.map(function (r) {
        var code = r.singkatan || [r.jenis, r.nomor].filter(Boolean).join(' ');
        return '<li class="dash-reg">' +
          '<p class="dash-reg__code">' + h(code) + '</p>' +
          '<div class="dash-reg__body">' +
            '<h3 class="dash-reg__title">' + h(r.judul) + '</h3>' +
            '<div class="dash-reg__meta">' +
              (r.jenis ? '<span class="badge badge--outline">' + h(r.jenis) + '</span>' : '') +
              (r.status ? '<span class="badge badge--' + regTone(r.status) + '">' + h(r.status) + '</span>' : '') +
            '</div>' +
          '</div>' +
          '<div class="dash-reg__link">' +
            (isHttp(r.tautan)
              ? ext('Naskah', r.tautan, ' resmi ' + code)
              : '<a class="btn btn--link btn--sm" href="regulasi.html"><span>Pustaka<span class="sr-only"> regulasi: ' + h(code) + '</span></span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a>') +
          '</div>' +
        '</li>';
      }).join('');
      fill(box, '<ul class="list-rule dash-regs" role="list" data-reveal-stagger>' + rows + '</ul>' +
        '<p class="dash-panel__note">' + icon('info', { size: 16 }) + '<span>' + h(String(items.length)) + ' regulasi kunci dari ' + h(String(all.length)) +
        ' regulasi dan standar dalam pustaka. Naskah resmi dibuka di situs penerbit.</span></p>');
    }

    /* 5. Pengumuman */
    async function renderPengumuman() {
      var box = byId('dash-pengumuman');
      var all = (await content('pengumuman')).slice()
        .sort(function (a, b) {
          if (!!b.penting !== !!a.penting) return b.penting ? 1 : -1;
          return cmp(String(b.tanggal || ''), String(a.tanggal || ''));
        });
      var items = all.slice(0, MAX_PENGUMUMAN);
      var count = byId('dash-pengumuman-count');
      if (count) count.textContent = all.length ? String(all.length) : '';
      if (!items.length) {
        fill(box, ui.emptyState({ icon: 'bell', title: 'Belum ada pengumuman', text: 'Pengumuman dari sekretariat akan tampil di sini.' }));
        return;
      }
      fill(box, '<ul class="dash-notices" role="list">' + items.map(function (p) {
        return '<li class="dash-notice' + (p.penting ? ' is-important' : '') + '">' +
          '<div class="dash-notice__meta">' +
            (p.tanggal ? '<time datetime="' + h(p.tanggal) + '">' + h(U.formatDate(p.tanggal, { short: true })) + '</time>' : '') +
            (p.penting ? '<span class="badge badge--solid">Penting</span>' : '') + U.contohBadge(p) +
          '</div>' +
          '<h3 class="dash-notice__title">' + h(p.judul) + '</h3>' +
          (p.isi ? '<p class="dash-notice__text">' + h(p.isi) + '</p>' : '') +
        '</li>';
      }).join('') + '</ul>');
    }

    /* 6. Aplikasi Anggota — aplikasi internal (aplikasi/…), dibuka di tab yang sama;
          bilah portal pada aplikasi menautkan kembali ke situs. */
    var APP_IMG = { perencanaan: 'assets/img/stair-tower.webp', simulator: 'assets/img/ringlock-pattern.webp' };
    var APP_KICKER = { perencanaan: 'PPAPI Scaffold', simulator: 'Simulator 3D pelatihan K3' };
    function renderApps() {
      var box = byId('dash-apps');
      var apps = list(cfg.apps).filter(function (a) { return safeHref(a.url); });
      if (!apps.length) {
        fill(box, ui.emptyState({ icon: 'layers', title: 'Aplikasi belum tersedia', text: 'Aplikasi anggota akan ditambahkan oleh pengelola situs.' }));
        return;
      }
      fill(box, '<div class="dash-launches" data-reveal-stagger>' + apps.map(function (a, i) {
        var img = APP_IMG[a.key] || (i % 2 ? APP_IMG.simulator : APP_IMG.perencanaan);
        var feats = list(a.fitur).slice(0, 2);
        /* 'Merek — Nama' → merek sebagai kicker, nama sebagai judul */
        var parts = String(a.title || 'Aplikasi').split(/\s+—\s+/);
        var kicker = parts.length > 1 ? parts[0] : (APP_KICKER[a.key] || 'Aplikasi anggota');
        var title = parts.length > 1 ? parts.slice(1).join(' — ') : parts[0];
        return '<article class="dash-launch theme-dark">' +
          '<div class="dash-launch__media" aria-hidden="true">' + U.img(img, { small: true, alt: '', cls: 'img-mono' }) + '</div>' +
          '<div class="dash-launch__body">' +
            '<div class="dash-launch__top"><span class="dash-launch__icon">' + icon(a.ikon || 'layers', { size: 20 }) + '</span>' +
              '<span class="index-num">' + h(U.pad(i + 1)) + ' <span>/ ' + h(U.pad(apps.length)) + '</span></span></div>' +
            '<p class="dash-launch__kicker">' + h(kicker) + '</p>' +
            '<h3 class="dash-launch__title"><a href="' + h(safeHref(a.url)) + '">' + h(title) + '</a></h3>' +
            (a.desc ? '<p class="dash-launch__desc">' + h(a.desc) + '</p>' : '') +
            (feats.length ? '<ul class="dash-launch__feats" role="list">' + feats.map(function (f) { return '<li>' + icon('check', { size: 14 }) + '<span>' + h(f) + '</span></li>'; }).join('') + '</ul>' : '') +
            '<p class="dash-launch__go" aria-hidden="true"><span>Buka aplikasi</span>' + icon('arrow-right', { size: 16 }) + '</p>' +
          '</div>' +
        '</article>';
      }).join('') + '</div>' +
      (cfg.appNote ? '<p class="dash-apps__note">' + icon('info', { size: 16 }) + '<span>' + h(cfg.appNote) + '</span></p>' : ''));
    }

    /* 7. Konsol Admin — ringkasan antrean (khusus admin) */
    async function renderAdmin(s) {
      var sec = byId('dash-admin'), box = byId('dash-admin-body');
      if (!sec || !box) return;
      sec.hidden = !s.isAdmin;
      if (!s.isAdmin) { box.innerHTML = ''; box.removeAttribute('aria-busy'); return; }
      var sum = null;
      try {
        if (store.admin && typeof store.admin.summary === 'function') sum = await store.admin.summary();
        else if (store.admin) {
          var pending = await store.admin.listMembers({ status: 'Menunggu Verifikasi' });
          sum = { menunggu: list(pending).length, perbaikan: 0, akanKedaluwarsa: 0, umpanBalikBaru: 0 };
        }
      } catch (err) {
        console.warn('[dasbor] Ringkasan admin:', err && (err.code || err.message));
      }
      if (!sum) {
        fill(box, '<p class="dash-admin__note">Ringkasan antrean belum dapat dimuat.</p>' +
          '<a class="btn btn--primary btn--sm dash-admin__cta" href="admin.html"><span>Buka Konsol Admin</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a>');
        return;
      }
      /* tautan ke bagian Konsol Admin (admin.html#permohonan · #anggota · #umpan-balik) */
      function stat(n, label, tone, href) {
        return '<li><a class="dash-admin__stat' + (n && tone ? ' dash-admin__stat--' + tone : '') + '" href="' + h(href) + '">' +
          '<span class="dash-admin__num">' + h(U.formatNumber(n || 0)) + '</span>' +
          '<span class="dash-admin__label">' + h(label) + '</span></a></li>';
      }
      var waiting = sum.menunggu || 0;
      fill(box,
        '<div class="dash-admin__grid">' +
          '<div class="dash-admin__intro">' +
            '<p class="dash-admin__lead">' + (waiting
              ? h(String(waiting)) + ' pengajuan keanggotaan menunggu verifikasi Anda.'
              : 'Tidak ada pengajuan keanggotaan yang menunggu verifikasi.') + '</p>' +
            '<a class="btn btn--primary btn--sm dash-admin__cta" href="admin.html"><span>Buka Konsol Admin</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a>' +
          '</div>' +
          '<ul class="dash-admin__stats" role="list">' +
            stat(sum.menunggu, 'Menunggu verifikasi', 'warn', 'admin.html#permohonan') +
            stat(sum.perbaikan, 'Perlu perbaikan', '', 'admin.html#permohonan') +
            stat(sum.akanKedaluwarsa, 'Berakhir ≤ 60 hari', '', 'admin.html#anggota') +
            stat(sum.umpanBalikBaru, 'Umpan balik baru', '', 'admin.html#umpan-balik') +
          '</ul>' +
        '</div>');
    }

    /* ---------- data pribadi ---------- */
    function certSummary(m) {
      var rows = list(m.certificates).map(function (c) { return { c: c, s: U.certStatus(c.expiresAt) }; });
      var active = rows.filter(function (x) { return x.s.key === 'aktif' || x.s.key === 'segera' || x.s.key === 'tanpa-batas'; });
      var soon = rows.filter(function (x) { return x.s.key === 'segera'; });
      var expired = rows.filter(function (x) { return x.s.key === 'kedaluwarsa'; });
      var due = soon.concat(expired).sort(function (a, b) { return a.s.days - b.s.days; });
      var next = rows.filter(function (x) { return x.s.key === 'aktif'; }).sort(function (a, b) { return a.s.days - b.s.days; })[0] || null;
      return { total: rows.length, active: active.length, soon: soon.length, expired: expired.length, due: due, next: next };
    }

    function kpiCard(o) {
      return '<div class="stat stat--card dash-kpi' + (o.cls ? ' ' + o.cls : '') + '">' +
        '<div class="dash-kpi__head"><p class="stat__label">' + h(o.label) + '</p><span class="dash-kpi__icon">' + icon(o.icon, { size: 18 }) + '</span></div>' +
        o.value +
        (o.extra || '') +
        '<p class="dash-kpi__note' + (o.tone ? ' dash-kpi__note--' + o.tone : '') + '">' + o.note + '</p>' +
      '</div>';
    }
    function num(n, suffix) {
      return '<span class="stat__num" data-count="' + h(String(n)) + '"' + (suffix ? ' data-count-suffix="' + h(suffix) + '"' : '') + '>' +
        h(U.formatNumber(n)) + h(suffix || '') + '</span>';
    }
    function statusKpi(s) {
      var m = s.member;
      var days = U.validityDays(m);
      var note, tone = 'ok';
      if (m.validUntil && days !== null && days <= RENEWAL_DAYS) {
        tone = 'warn';
        note = (days === 0 ? 'Berakhir hari ini' : 'Berakhir dalam ' + h(String(days)) + ' hari') + ' <span class="nowrap">· ' + h(dateShort(m.validUntil)) + '</span>';
      } else if (m.validUntil) note = 'Berlaku hingga <span class="nowrap">' + h(dateShort(m.validUntil)) + '</span>';
      else if (m.joinedAt) note = 'Anggota sejak ' + h(dateLong(m.joinedAt));
      else note = 'Keanggotaan aktif';
      return kpiCard({
        label: 'Status Keanggotaan', icon: 'shield-check', cls: 'dash-kpi--status',
        value: '<p class="dash-kpi__status dash-kpi__status--' + tone + '">' + h(s.status) + '</p>',
        note: note, tone: tone
      });
    }
    /* Admin yang keanggotaan pribadinya belum Aktif: tanpa baris KPI pribadi (angka kosong
       di atas antrean kerja admin) — cukup satu baris status keanggotaan + langkah berikutnya. */
    function renderSelf(s) {
      var box = byId('dash-self');
      if (!box) return;
      var show = s.isAdmin && !s.isMemberActive;
      box.hidden = !show;
      if (!show) { box.innerHTML = ''; return; }
      var cta = ctaFor(s.status, isRenewal(s));
      fill(box,
        '<div class="dash-self__row">' +
          '<span class="dash-self__icon">' + icon('user', { size: 18 }) + '</span>' +
          '<p class="dash-self__text">' +
            '<span class="dash-self__label">Keanggotaan pribadi</span>' +
            '<span class="dash-self__status">' + U.statusBadge(s.status || 'Draf') + '</span>' +
            (s.statusLabel ? '<span class="dash-self__desc">' + h(s.statusLabel) + '</span>' : '') +
          '</p>' +
          '<div class="dash-self__act">' + link(cta[0], cta[1]) + '</div>' +
        '</div>');
    }

    function renderKpis(s, cs, comp) {
      var grid = byId('dash-kpis');
      if (s.isAdmin && !s.isMemberActive) {
        if (grid) { grid.hidden = true; grid.innerHTML = ''; grid.removeAttribute('aria-busy'); }
        return;
      }
      if (grid) grid.hidden = false;
      var soonNote, soonTone = '';
      if (cs.soon && cs.expired) { soonNote = 'Dalam 90 hari · ' + h(String(cs.expired)) + ' kedaluwarsa'; soonTone = 'err'; }
      else if (cs.soon) { soonNote = 'Berakhir dalam 90 hari ke depan'; soonTone = 'warn'; }
      else if (cs.expired) { soonNote = h(String(cs.expired)) + ' sertifikat telah kedaluwarsa'; soonTone = 'err'; }
      else soonNote = cs.total ? 'Aman untuk 90 hari ke depan' : 'Belum ada yang dipantau';

      var bar = '<div class="progress progress--metal dash-kpi__bar" style="--value:' + comp.pct + '" role="progressbar" aria-valuenow="' + comp.pct +
        '" aria-valuemin="0" aria-valuemax="100" aria-label="Kelengkapan profil ' + comp.pct + ' persen"></div>';

      fill(grid, [
        statusKpi(s),
        kpiCard({
          label: 'Sertifikat Aktif', icon: 'certificate',
          value: num(cs.active),
          note: cs.total ? 'dari ' + h(String(cs.total)) + ' sertifikat tercatat' : 'Belum ada sertifikat tercatat'
        }),
        kpiCard({
          label: 'Segera Kedaluwarsa', icon: 'clock',
          value: num(cs.soon),
          note: soonNote, tone: soonTone
        }),
        kpiCard({
          label: 'Kelengkapan Profil', icon: 'user',
          value: num(comp.pct, '%'), extra: bar,
          note: comp.missing.length ? h(String(comp.missing.length)) + ' dari ' + h(String(comp.total)) + ' isian belum lengkap' : 'Seluruh isian telah lengkap',
          tone: comp.missing.length ? '' : 'ok'
        })
      ].join(''));
      if (grid && !grid.hasAttribute('data-reveal-stagger')) { grid.setAttribute('data-reveal-stagger', ''); ui.reveal(grid); }
    }

    /* Pengingat masa berlaku keanggotaan (≤ 60 hari) → perpanjangan */
    function renderRenew(s) {
      var box = byId('dash-renew');
      if (!box) return;
      var m = s.member, days = U.validityDays(m);
      var due = s.isMemberActive && m.validUntil && days !== null && days >= 0 && days <= RENEWAL_DAYS;
      box.hidden = !due;
      if (!due) { box.innerHTML = ''; return; }
      fill(box,
        '<div class="dash-renew__card" role="region" aria-labelledby="dash-renew-title">' +
          '<span class="dash-renew__icon">' + icon('clock', { size: 20 }) + '</span>' +
          '<div class="dash-renew__body">' +
            '<p class="dash-renew__eyebrow">Masa berlaku keanggotaan</p>' +
            '<h2 class="dash-renew__title" id="dash-renew-title">' + (days === 0
              ? 'Keanggotaan Anda berakhir <em>hari ini</em>'
              : 'Keanggotaan Anda berakhir dalam <em>' + h(String(days)) + ' hari</em>') + '</h2>' +
            '<p class="dash-renew__text">Keanggotaan berlaku hingga ' + h(dateLong(m.validUntil)) + '. Ajukan perpanjangan agar Kartu Tanda Anggota dan akses fitur anggota tetap berlaku. ' +
              'Selama pengajuan perpanjangan diverifikasi sekretariat, akses fitur anggota ditangguhkan sementara.</p>' +
          '</div>' +
          '<div class="dash-renew__actions">' + btn('Ajukan Perpanjangan', 'pendaftaran.html#perpanjangan', 'primary') + '</div>' +
        '</div>');
    }

    function renderReminders(cs) {
      var box = byId('dash-pengingat');
      if (!cs.total) {
        fill(box, ui.emptyState({
          icon: 'certificate', title: 'Belum ada sertifikat',
          text: 'Catat sertifikat kompetensi Anda agar masa berlakunya terpantau dari dasbor ini.',
          actionHtml: link('Tambah sertifikat', 'anggota.html#sertifikat', 'plus')
        }));
        return;
      }
      if (!cs.due.length) {
        fill(box, ui.emptyState({
          icon: 'check-circle', title: 'Semua sertifikat aman',
          text: 'Tidak ada sertifikat yang kedaluwarsa atau berakhir dalam 90 hari ke depan.' +
            (cs.next && cs.next.c.expiresAt ? ' Masa berlaku terdekat berakhir ' + U.formatDate(cs.next.c.expiresAt) + '.' : ''),
          actionHtml: link('Kelola sertifikat', 'anggota.html#sertifikat')
        }));
        return;
      }
      fill(box, '<ul class="dash-reminders" role="list">' + cs.due.map(function (x) {
        var c = x.c, s = x.s, past = s.days < 0, n = Math.abs(s.days);
        var label = past ? (n === 0 ? 'hari ini' : 'hari lalu') : (s.days === 0 ? 'hari ini' : 'hari lagi');
        var when = past ? 'Berakhir ' + U.formatDate(c.expiresAt) : 'Berlaku hingga ' + U.formatDate(c.expiresAt);
        return '<li class="dash-reminder dash-reminder--' + s.tone + '">' +
          '<p class="dash-reminder__days"><span class="dash-reminder__num">' + h(String(n)) + '</span> <span class="dash-reminder__unit">' + h(label) + '</span></p>' +
          '<div class="dash-reminder__body">' +
            '<h3 class="dash-reminder__title">' + h(c.title || 'Sertifikat tanpa judul') + '</h3>' +
            '<p class="dash-reminder__meta">' + h([c.issuer, when].filter(Boolean).join(' · ')) + '</p>' +
            '<span class="badge badge--' + s.tone + '">' + h(s.label) + '</span>' +
          '</div>' +
        '</li>';
      }).join('') + '</ul>' +
      '<div class="dash-widget__foot">' + link('Perbarui data sertifikat', 'anggota.html#sertifikat') + '</div>');
    }

    /* Kelengkapan profil — definisi bersama PPAPI.util.profileCompleteness (15 butir),
       identik dengan Halaman Anggota; setiap isian menautkan ke anggota.html?isi=<kunci>#profil. */
    function renderNudge(comp) {
      var sec = byId('dash-nudge'), box = byId('dash-nudge-body');
      if (!sec || !box) return;
      if (!comp.missing.length) { sec.hidden = true; box.innerHTML = ''; return; }
      sec.hidden = false;
      var shown = comp.missing.slice(0, MAX_MISSING_SHOWN);
      var rest = comp.missing.length - shown.length;
      fill(box,
        '<div class="dash-nudge__score">' +
          '<p class="dash-nudge__pct"><span class="dash-nudge__val">' + h(String(comp.pct)) + '%</span> <span class="dash-nudge__of">' + h(String(comp.done)) + ' dari ' + h(String(comp.total)) + ' isian terisi</span></p>' +
          '<div class="progress progress--metal" style="--value:' + comp.pct + '" role="progressbar" aria-valuenow="' + comp.pct + '" aria-valuemin="0" aria-valuemax="100" aria-label="Kelengkapan profil"></div>' +
        '</div>' +
        '<p class="dash-nudge__text">Profil yang lengkap memudahkan sekretariat dan sesama anggota mengenali kompetensi Anda. Isian yang belum lengkap:</p>' +
        '<ul class="dash-missing" role="list">' + shown.map(function (x) {
          return '<li><a href="' + h(x.href) + '"><span class="dash-missing__box" aria-hidden="true"></span><span>' + h(x.label) + '</span>' + icon('chevron-right', { size: 16 }) + '</a></li>';
        }).join('') + '</ul>' +
        (rest > 0 ? '<p class="dash-missing__more">dan ' + h(String(rest)) + ' isian lainnya</p>' : '') +
        '<a class="btn btn--primary btn--sm btn--block dash-nudge__cta" href="anggota.html#profil"><span>Lengkapi profil</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a>');
    }

    var contentRendered = false;
    async function renderActiveView(s) {
      /* admin: Konsol Admin menempati tepi pita gelap, ringkasan pribadi di bawahnya */
      if (s.isAdmin) d.body.setAttribute('data-dash-admin', ''); else d.body.removeAttribute('data-dash-admin');
      showView('active');
      var m = s.member;
      var cs = certSummary(m);
      var comp = U.profileCompleteness(m);
      /* pita admin (dengan kerangka muat) tampil seketika; ringkasan antrean menyusul */
      var adminDone = renderAdmin(s).catch(function (err) { console.error(err); });
      renderKpis(s, cs, comp);
      renderSelf(s);
      renderRenew(s);
      renderReminders(cs);
      renderNudge(comp);
      if (!contentRendered) {
        contentRendered = true;
        renderApps();
        await Promise.all([renderAgenda(), renderPustaka(), renderBerita(), renderRegulasi(), renderPengumuman()].map(function (p) {
          return p.catch(function (err) { console.error(err); });
        }));
      }
      await adminDone;
    }

    /* ==================================================================
       JALANKAN — tampilan mengikuti sesi; diperbarui bila sesi berubah
       ================================================================== */
    var lastKey = '';
    var ensured = false;
    function sessionKey(s) {
      var m = s.member || {};
      return [s.user && s.user.uid, s.status, s.isActive, s.isAdmin, m.updatedAt || '', !!s.member].join('|');
    }
    async function render(s, force) {
      if (!s || !s.user) return; // gerbang login di core.js mengalihkan ke masuk.html
      var key = sessionKey(s);
      if (!force && key === lastKey) return;
      lastKey = key;
      if (!s.member) {
        if (!ensured) {
          ensured = true;
          try {
            await store.ensureMember(s.user);
            s = await PPAPI.session.refresh();
            lastKey = sessionKey(s);
          } catch (err) {
            console.warn('[dasbor] Data anggota gagal dimuat:', err && err.code);
          }
        }
        if (!s.member) { renderHero(s); showError(null); return; }
      }
      renderHero(s);
      if (s.isActive) await renderActiveView(s);
      else await renderStatusView(s);
    }

    PPAPI.session.onChange(function (s) { render(s).catch(function (err) { console.error(err); }); });
    await render(PPAPI.session.current(), true);

    // Kembali ke dasbor lewat tombol "Back" (bfcache): segarkan sesi + data anggota.
    w.addEventListener('pageshow', function (e) {
      if (!e.persisted) return;
      PPAPI.session.refresh().then(function (s) { return render(s, true); }).catch(function (err) { console.error(err); });
    });
  });
})(window, document);
