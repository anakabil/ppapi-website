/* ==========================================================================
   PPAPI — pages/pendaftaran.js · Formulir Pendaftaran Anggota (pendaftaran.html)
   SPEC-v2 §4.1 — the page follows the membership status:
     Draf · Perlu Perbaikan · Ditolak · Kedaluwarsa/Nonaktif (perpanjangan)  → 7-step wizard
     Menunggu Verifikasi                                                     → read-only summary,
                                                                                status track, withdraw
     Aktif                                                                   → member summary
                                                                                (+ early renewal ≤ 60 days)
   Autosave: profile fields → store.saveMember (name → auth.updateName);
             application fields → store.saveApplication. Debounced and serialised.
   Hash: #<step-key> opens a wizard step (e.g. pendaftaran.html#dokumen); #perpanjangan opens
   the renewal wizard for an Aktif member within the renewal window.
   Every data/user string inserted as HTML goes through util.h().
   ========================================================================== */
(function (w, d) {
  'use strict';
  var PPAPI = w.PPAPI;
  if (!PPAPI || typeof PPAPI.onReady !== 'function') return;

  var STEPS = [
    { key: 'kategori', label: 'Kategori', title: 'Kategori <em>keanggotaan</em>',
      lead: 'Pilih kategori yang paling sesuai dengan peran Anda di bidang perancah. Sekretariat dapat menyesuaikan kategori pada saat verifikasi.' },
    { key: 'data-diri', label: 'Data Diri', title: 'Data <em>diri</em>',
      lead: 'Isi sesuai identitas resmi. Nama lengkap akan tercantum pada Kartu Tanda Anggota.' },
    { key: 'profesional', label: 'Data Profesional', title: 'Data <em>profesional</em>',
      lead: 'Tempat Anda bekerja dan pengalaman Anda di bidang perancah. Isi lama pengalaman, riwayat proyek, atau keduanya.' },
    { key: 'kompetensi', label: 'Kompetensi & Sertifikat', title: 'Kompetensi & <em>sertifikat</em>',
      lead: 'Cantumkan kompetensi yang Anda kuasai dan sertifikat yang Anda miliki. Bagian ini tidak wajib, tetapi sangat membantu verifikasi — terutama untuk kategori Ahli.' },
    { key: 'dokumen', label: 'Dokumen Pendukung', title: 'Dokumen <em>pendukung</em>',
      lead: 'Lampirkan tautan dokumen yang disimpan di layanan penyimpanan daring. Situs ini tidak menyimpan berkas, hanya tautannya.' },
    { key: 'pernyataan', label: 'Pernyataan', title: 'Pernyataan <em>pemohon</em>',
      lead: 'Baca dan setujui pernyataan berikut, lalu ketik nama terang Anda sebagai tanda tangan elektronik.' },
    { key: 'tinjau', label: 'Tinjau & Kirim', title: 'Tinjau & <em>kirim</em>',
      lead: 'Periksa kembali seluruh isian sebelum diajukan. Pilih “Ubah” untuk memperbaiki bagian tertentu.' }
  ];
  var LEVEL_HINT = {
    'Dasar': 'Memahami prinsip kerja dan melaksanakan tugas di bawah pengawasan.',
    'Menengah': 'Melaksanakan pekerjaan rutin secara mandiri sesuai prosedur.',
    'Mahir': 'Menangani pekerjaan kompleks dan membimbing rekan kerja.',
    'Ahli': 'Menjadi rujukan teknis: merancang, menilai, dan memberi rekomendasi.'
  };
  /* applicationMissing key → control to focus */
  var FIELD_CTRL = {
    kategori: 'f-kategori', name: 'f-name', phone: 'f-phone', birthDate: 'f-birthDate', province: 'f-province',
    city: 'f-city', company: 'f-company', position: 'f-position', pengalaman: 'f-experienceYears',
    pembayaran: 'f-pay-bukti', kodeEtik: 'f-kodeEtik', kebenaranData: 'f-kebenaranData', privasi: 'f-privasi',
    namaTerang: 'f-namaTerang'
  };

  PPAPI.onReady(async function () {
    var util = PPAPI.util, ui = PPAPI.ui, store = PPAPI.store, auth = PPAPI.auth, icon = PPAPI.icon;
    var h = util.h, $ = util.$, $$ = util.$$;
    var cfg = PPAPI.config || {};
    var DATA = PPAPI.data || {};
    var ORG = (DATA.organisasi && DATA.organisasi.keanggotaan) || {};
    var KOMP = DATA.kompetensi || {};
    var KATALOG = Array.isArray(KOMP.katalog) ? KOMP.katalog : [];
    var LEVELS = (store.LEVELS && store.LEVELS.length) ? store.LEVELS : ['Dasar', 'Menengah', 'Mahir', 'Ahli'];
    var PENERBIT = Array.isArray(KOMP.penerbit) ? KOMP.penerbit : [];
    var LIMITS = store.LIMITS || { pengalaman: 10, dokumen: 12, pasFotoKB: 120, catatan: 1000 };
    var DOC_TYPES = store.DOC_TYPES || ['CV', 'Sertifikat', 'Ijazah', 'Surat Rekomendasi', 'Bukti Pembayaran', 'Lainnya'];
    var IURAN = cfg.iuran && cfg.iuran.aktif ? cfg.iuran : null;
    var PHOTO_MAX = Math.floor((LIMITS.pasFotoKB || 120) * 1024 / 3) * 4; /* base64 chars of ≤ 120 KB */
    var TOTAL_REQ = store.applicationMissing(null).length;
    var reduced = function () { return PPAPI.motion && PPAPI.motion.prefersReduced ? PPAPI.motion.prefersReduced() : false; };

    var root = $('#daf-root');
    var heroEl = $('.daf-hero');
    var heroStatus = $('#daf-hero-status');
    var user = auth.current();
    if (!root || !user) return;
    var isAdmin = !!(PPAPI.session && PPAPI.session.current().isAdmin);
    var member = null;

    /* page state */
    var S = {
      view: '', step: 0, visited: {}, flagged: {}, forceRenew: false, justSubmitted: false,
      peng: [], dok: [],
      pendApp: null, pendMem: null, pendName: null, timer: null,
      chain: Promise.resolve(), saving: 0, saveError: null, lastSaved: null, lastAnnounce: 0
    };

    /* ==================================================================
       0. HELPERS
       ================================================================== */
    function pad(n) { return util.pad(n, 2); }
    function nowTime(dt) {
      try { return (dt || new Date()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }); }
      catch (e) { var x = dt || new Date(); return pad(x.getHours()) + '.' + pad(x.getMinutes()); }
    }
    function fmtDate(v, short) { return v ? util.formatDate(v, short ? { short: true } : undefined) : ''; }
    function errMsg(err, fallback) { return (err && err.message) || fallback; }
    function safeId(id) { var s = String(id || '').replace(/[^A-Za-z0-9_-]/g, ''); return s || util.uid('x'); }
    function st() { return util.effectiveStatus(member); }
    function isRenewal() { return store.applicationType(member) === 'perpanjangan'; }
    function scrollToEl(el, extra) {
      if (!el) return;
      var off = parseFloat(getComputedStyle(d.documentElement).getPropertyValue('--header-offset')) || 76;
      var top = el.getBoundingClientRect().top + w.pageYOffset - off - (extra || 16);
      w.scrollTo({ top: Math.max(0, top), behavior: reduced() ? 'auto' : 'smooth' });
    }
    function focusEl(el) {
      if (!el) return;
      try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
    }
    function addDescribedBy(el, id) {
      var cur = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      if (cur.indexOf(id) === -1) { cur.push(id); el.setAttribute('aria-describedby', cur.join(' ')); }
    }
    /* inline error on a control (input/select/textarea, a checkbox, or a fieldset group) */
    function setError(ctrl, msg) {
      if (!ctrl) return;
      var field = ctrl.closest('.field') || ctrl;
      var errId = (ctrl.id || 'f-x') + '-err';
      var errEl = d.getElementById(errId);
      if (!errEl && msg) {
        errEl = d.createElement('p');
        errEl.className = 'field__error';
        errEl.id = errId;
        field.appendChild(errEl);
      }
      if (errEl) errEl.textContent = msg || '';
      field.classList.toggle('is-invalid', !!msg);
      if (msg) { ctrl.setAttribute('aria-invalid', 'true'); addDescribedBy(ctrl, errId); }
      else ctrl.removeAttribute('aria-invalid');
    }
    function clearErrors(scope) {
      $$('.is-invalid', scope).forEach(function (f) { f.classList.remove('is-invalid'); });
      $$('[aria-invalid]', scope).forEach(function (c) { c.removeAttribute('aria-invalid'); });
    }
    function phoneLocal(e164) {
      if (!e164) return '';
      var n = util.normalizePhoneID(e164);
      if (!n) return String(e164);
      return util.formatPhoneID(n).replace(/^\+62\s*/, '');
    }
    /* "drive.google.com/…" → "https://drive.google.com/…"; anything with a scheme is left as typed */
    function fixUrl(v) {
      var s = String(v || '').trim();
      if (!s) return '';
      if (/^[a-z][a-z0-9+.\-]*:/i.test(s)) return s;
      if (/^\/\//.test(s)) return 'https:' + s;
      if (/^[a-z0-9][a-z0-9-]*(\.[a-z0-9-]+)+(:\d+)?([\/?#]\S*)?$/i.test(s)) return 'https://' + s;
      return s;
    }
    function isHttps(s) { return /^https:\/\/[^\s<>"']+\.[^\s<>"']+/i.test(String(s || '')); }
    function isHttp(s) { return /^https?:\/\/[^\s<>"']+\.[^\s<>"']+/i.test(String(s || '')); }
    function prettyUrl(u) { return String(u || '').replace(/^https?:\/\//i, '').replace(/\/$/, ''); }
    function katalogBy(code) {
      if (!code) return null;
      for (var i = 0; i < KATALOG.length; i++) if (KATALOG[i].kode === code) return KATALOG[i];
      return null;
    }
    function kategoriInfo(nama) {
      var list = Array.isArray(ORG.kategori) ? ORG.kategori : [];
      for (var i = 0; i < list.length; i++) if (list[i] && list[i].nama === nama) return list[i];
      return null;
    }
    /* categories this member may choose (store.APPLY_TYPES + own category on renewal) */
    function kategoriOptions() {
      var list = (store.APPLY_TYPES || []).slice();
      if (member.approvedAt && member.memberType && list.indexOf(member.memberType) === -1) list.push(member.memberType);
      return list;
    }
    function missingAll() { return store.applicationMissing(member); }
    function missingByStep() {
      var g = {};
      missingAll().forEach(function (x) { (g[x.step] = g[x.step] || []).push(x); });
      return g;
    }
    function submitLabel() {
      var s = st();
      if (s === 'Perlu Perbaikan') return 'Kirim Perbaikan';
      if (s === 'Ditolak') return 'Ajukan Ulang';
      if (isRenewal()) return 'Ajukan Perpanjangan';
      return 'Ajukan Pendaftaran';
    }
    function lastHistory(action) {
      var list = (member.review && member.review.history) || [];
      for (var i = list.length - 1; i >= 0; i--) if (list[i].action === action) return list[i];
      return null;
    }
    /* time of the secretariat's latest decision on the membership — approval, "Ubah Kategori", reactivation or
       a direct extension. An application not written since then still holds an earlier cycle's category. */
    function msOf(v) { var t = v ? Date.parse(v) : NaN; return isFinite(t) ? t : 0; }
    function decisionAt() {
      var t = msOf(member.approvedAt);
      ((member.review && member.review.history) || []).forEach(function (x) {
        if (x && ['disetujui', 'kategori-diubah', 'diaktifkan', 'diperpanjang'].indexOf(x.action) !== -1) t = Math.max(t, msOf(x.at));
      });
      return t;
    }
    /* "1.179 hari" — PUEBI thousands separator via Intl id-ID */
    function nDays(n) { return util.formatNumber(n) + ' hari'; }

    /* ==================================================================
       1. LOAD
       ================================================================== */
    try {
      member = await store.getMember(user.uid);
      if (!member) member = await store.ensureMember(user);
    } catch (err) {
      console.error(err);
      root.setAttribute('aria-busy', 'false');
      root.innerHTML = '<div class="alert alert--err" role="alert">' + icon('alert-triangle') + '<div><p class="alert__title">Data pendaftaran belum dapat dimuat</p>' +
        '<p>' + h(errMsg(err, 'Terjadi gangguan saat memuat data.')) + '</p>' +
        '<p><button type="button" class="btn btn--link btn--sm" data-action="reload"><span>Muat ulang halaman</span>' + icon('refresh', { size: 16, cls: 'btn__icon' }) + '</button></p></div></div>';
      heroStatus.innerHTML = '';
      $('#daf-lead').textContent = 'Data pendaftaran belum dapat dimuat.';
      root.addEventListener('click', function (e) { if (e.target.closest('[data-action="reload"]')) w.location.reload(); });
      return;
    }
    if (w.location.hash === '#perpanjangan' && st() === 'Aktif' && util.canRenew(member)) S.forceRenew = true;

    /* ==================================================================
       2. VIEW SWITCH + HERO
       ================================================================== */
    function decideView() {
      var s = st();
      if (s === 'Menunggu Verifikasi') return 'pending';
      if (s === 'Aktif' && !S.forceRenew) return 'active';
      return 'wizard';
    }
    function render(opts) {
      opts = opts || {};
      flushNow();
      S.view = decideView();
      root.setAttribute('aria-busy', 'false');
      root.setAttribute('data-view', S.view);
      if (heroEl) heroEl.setAttribute('data-view', S.view);
      renderHero();
      if (S.view === 'pending') renderPending();
      else if (S.view === 'active') renderActive();
      else renderWizard(opts);
      ui.reveal(root);
    }

    function renderHero() {
      var s = st(), renewal = isRenewal();
      var eyebrow = 'Formulir Pendaftaran Anggota', title = 'Formulir <em>pendaftaran</em>', lead;
      if (S.view === 'pending') {
        eyebrow = renewal ? 'Perpanjangan Keanggotaan' : 'Formulir Pendaftaran Anggota';
        title = 'Pengajuan <em>sedang diverifikasi</em>';
        lead = 'Pengajuan Anda telah diterima dan sedang diperiksa sekretariat. Selama verifikasi, data formulir tidak dapat diubah.';
      } else if (S.view === 'active') {
        eyebrow = 'Keanggotaan PPAPI';
        title = 'Keanggotaan <em>aktif</em>';
        lead = 'Pendaftaran Anda telah disetujui. Seluruh fitur anggota — KTA digital, Produk Pengetahuan, dan aplikasi anggota — dapat Anda gunakan.';
      } else if (s === 'Perlu Perbaikan') {
        title = 'Perbaikan <em>pengajuan</em>';
        lead = 'Sekretariat meminta beberapa perbaikan. Perhatikan catatan di bawah, perbarui data Anda, lalu kirim kembali pengajuan.';
      } else if (s === 'Ditolak') {
        title = 'Ajukan <em>ulang</em>';
        lead = 'Pengajuan sebelumnya belum dapat disetujui. Perbarui data sesuai alasan yang disampaikan sekretariat, lalu ajukan kembali.';
      } else if (renewal) {
        eyebrow = 'Perpanjangan Keanggotaan';
        title = 'Perpanjangan <em>keanggotaan</em>';
        lead = 'Periksa kembali data keanggotaan Anda, perbarui yang berubah, lalu ajukan perpanjangan untuk diverifikasi sekretariat.';
      } else {
        lead = 'Lengkapi tujuh langkah berikut, lalu ajukan untuk diverifikasi sekretariat. Isian tersimpan otomatis sehingga dapat Anda lanjutkan kapan saja.';
      }
      $('#daf-eyebrow').textContent = eyebrow;
      $('#daf-title').innerHTML = title;
      $('#daf-lead').textContent = lead;
      d.title = (S.view === 'active' ? 'Keanggotaan Aktif' : (renewal && S.view === 'wizard' ? 'Perpanjangan Keanggotaan' : 'Formulir Pendaftaran Anggota')) + ' — PPAPI';
      updateHeroStatus();
    }
    function updateHeroStatus() {
      if (!heroStatus) return;
      var s = st(), extra = '', railMeta = $('#daf-rail-meta');
      /* say the status once: the dark member card is the Aktif view's hero moment, and right after submitting the
         "terkirim" banner says it (the content stays in the DOM, so the live region is ready when the view changes) */
      heroStatus.hidden = S.view === 'active' || (S.view === 'pending' && S.justSubmitted);
      /* the completeness meter belongs to a form being filled in — not next to a rejection or an expired membership */
      var meter = S.view === 'wizard' && (s === 'Draf' || s === 'Perlu Perbaikan');
      if (railMeta) railMeta.hidden = !meter;
      if (meter) {
        var missing = missingAll().length, done = Math.max(0, TOTAL_REQ - missing);
        var pct = TOTAL_REQ ? Math.round(done / TOTAL_REQ * 100) : 0;
        extra = '<div class="daf-hstat__progress">' +
          '<div class="progress progress--metal" role="progressbar" aria-label="Kelengkapan isian wajib" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + pct + '" style="--value:' + pct + '"></div>' +
          '<p class="daf-hstat__meta"><span class="daf-hstat__num">' + done + '</span> dari ' + TOTAL_REQ + ' isian wajib lengkap</p></div>';
        if (railMeta) railMeta.innerHTML = '<span class="daf-railmeta__num">' + done + '</span> dari ' + TOTAL_REQ + ' isian wajib lengkap';
      } else if (S.view === 'pending') {
        extra = '<p class="daf-hstat__meta">Diajukan ' + h(fmtDate(member.application.submittedAt, true) || '—') + '</p>';
      } else if (S.view === 'active') {
        extra = '<p class="daf-hstat__meta daf-hstat__kta">' + h(member.kta || '—') + '</p>' +
          '<p class="daf-hstat__meta">' + (member.validUntil ? 'Berlaku hingga ' + h(fmtDate(member.validUntil, true)) : 'Masa berlaku belum ditetapkan') + '</p>';
      }
      heroStatus.innerHTML = '<div class="daf-hstat">' +
        '<p class="daf-hstat__label">Status keanggotaan</p>' +
        '<div class="daf-hstat__badges">' + util.statusBadge(s || 'Draf') + (isAdmin ? '<span class="badge badge--metal">Admin</span>' : '') + '</div>' +
        '<p class="daf-hstat__text">' + h(util.statusLabel(s || 'Draf')) + '</p>' + extra + '</div>';
    }

    /* ==================================================================
       3. NOTICES (above the wizard)
       ================================================================== */
    function noteBlock(tone, eyebrow, title, quote, text, actions) {
      return '<div class="daf-note daf-note--' + tone + '" role="note">' +
        '<span class="daf-note__icon">' + icon(tone === 'err' ? 'x-circle' : (tone === 'warn' ? 'alert-triangle' : 'info'), { size: 20 }) + '</span>' +
        '<div class="daf-note__body">' +
          '<p class="daf-note__eyebrow">' + eyebrow + '</p>' +
          '<p class="daf-note__title">' + h(title) + '</p>' +
          (quote ? '<blockquote class="daf-note__quote"><p>' + h(quote) + '</p></blockquote>' : '') +
          (text ? '<p class="daf-note__text">' + text + '</p>' : '') +
          (actions ? '<div class="daf-note__actions">' + actions + '</div>' : '') +
        '</div></div>';
    }
    function noticesHtml() {
      var s = st(), out = '', rv = member.review || {};
      if (s === 'Perlu Perbaikan') {
        var hp = lastHistory('perbaikan');
        out += noteBlock('warn', 'Catatan sekretariat' + (hp && hp.at ? ' · ' + h(fmtDate(hp.at, true)) : ''),
          'Pengajuan Anda perlu diperbaiki', rv.note || (hp && hp.note) || '',
          'Perbarui data yang diminta, lalu kirim kembali melalui langkah <strong>Tinjau &amp; Kirim</strong>. Status Anda kembali menjadi Menunggu Verifikasi setelah perbaikan dikirim.');
      } else if (s === 'Ditolak') {
        var ht = lastHistory('ditolak');
        out += noteBlock('err', 'Keputusan sekretariat' + (ht && ht.at ? ' · ' + h(fmtDate(ht.at, true)) : ''),
          'Pengajuan belum dapat disetujui', rv.note || (ht && ht.note) || '',
          'Anda dapat memperbarui data dan mengajukannya kembali. Bila ada pertanyaan mengenai keputusan ini, hubungi sekretariat melalui <a class="link" href="umpan-balik.html?kategori=Pertanyaan">halaman Kontak</a>.');
      } else if (s === 'Kedaluwarsa') {
        out += noteBlock('info', 'Perpanjangan keanggotaan',
          'Masa berlaku keanggotaan Anda berakhir pada ' + fmtDate(member.validUntil), '',
          'Ajukan perpanjangan agar keanggotaan Anda aktif kembali' + (member.kta ? '; nomor KTA <strong>' + h(member.kta) + '</strong> tetap digunakan' : '') + '. Fitur anggota terbuka kembali setelah sekretariat menyetujui perpanjangan.');
      } else if (s === 'Nonaktif') {
        var hn = lastHistory('dinonaktifkan');
        out += noteBlock('err', 'Keanggotaan dinonaktifkan' + (hn && hn.at ? ' · ' + h(fmtDate(hn.at, true)) : ''),
          'Keanggotaan Anda sedang dinonaktifkan sekretariat', rv.note || (hn && hn.note) || '',
          'Anda dapat mengajukan perpanjangan untuk diaktifkan kembali. Sekretariat akan meninjau pengajuan Anda.');
      } else if (s === 'Aktif' && S.forceRenew) {
        var days = util.validityDays(member);
        out += noteBlock('warn', 'Perpanjangan lebih awal',
          'Masa berlaku berakhir ' + (days === 0 ? 'hari ini' : 'dalam ' + nDays(days)) + ' (' + fmtDate(member.validUntil) + ')', '',
          'Setelah perpanjangan diajukan, status Anda menjadi <strong>Menunggu Verifikasi</strong> dan fitur anggota dikunci sementara sampai sekretariat menyetujuinya. Bila pengajuan ditarik, status menjadi <strong>Draf</strong> — bukan kembali Aktif. Agar keanggotaan tetap aktif tanpa jeda, Anda juga dapat meminta sekretariat memperpanjang masa berlaku secara langsung.',
          '<button type="button" class="btn btn--ghost btn--sm" data-action="cancel-renew"><span>Batalkan, kembali ke ringkasan</span></button>' +
          '<a class="btn btn--link btn--sm" href="umpan-balik.html?kategori=Pertanyaan"><span>Hubungi sekretariat</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a>');
      } else if (s === 'Draf' && member.approvedAt && member.application.type === 'perpanjangan') {
        out += noteBlock('info', 'Perpanjangan keanggotaan', 'Pengajuan perpanjangan Anda telah ditarik', '',
          'Status keanggotaan Anda saat ini Draf. Periksa kembali data Anda, lalu ajukan perpanjangan agar keanggotaan aktif kembali.');
      }
      if (isAdmin) {
        out += '<div class="alert alert--info daf-admin-note">' + icon('shield-check') + '<div><p class="alert__title">Anda masuk sebagai admin PPAPI</p>' +
          '<p>Formulir ini untuk keanggotaan pribadi Anda. Permohonan anggota lain dikelola di <a class="link" href="admin.html">Konsol Admin</a>.</p></div></div>';
      }
      return out ? '<div class="daf-notices">' + out + '</div>' : '';
    }

    /* ==================================================================
       4. WIZARD — markup
       ================================================================== */
    function stepperHtml() {
      return '<nav class="stepper daf-stepper" aria-label="Langkah formulir">' +
        '<p class="stepper__compact" aria-hidden="true"><span class="stepper__count" id="daf-step-count"></span><span class="stepper__current" id="daf-step-current"></span></p>' +
        '<div class="stepper__bar" id="daf-step-bar" aria-hidden="true"></div>' +
        '<ol class="stepper__list">' + STEPS.map(function (s, i) {
          return '<li class="stepper__item" data-step-item="' + i + '"><button type="button" class="stepper__btn" data-step="' + i + '">' +
            '<span class="stepper__num">' + pad(i + 1) + '</span>' +
            '<span class="stepper__text"><span class="stepper__label">' + h(s.label) + '</span><span class="stepper__hint"></span></span>' +
            '<span class="sr-only daf-step-sr"></span></button></li>';
        }).join('') + '</ol></nav>';
    }
    function saveHtml(extraCls) {
      return '<p class="daf-save js-save' + (extraCls ? ' ' + extraCls : '') + '" data-state="idle">' +
        '<span class="daf-save__icon" aria-hidden="true"></span><span class="daf-save__text">Isian tersimpan otomatis</span></p>';
    }
    function helpHtml(cls) {
      return '<div class="daf-help ' + cls + '">' +
        '<p class="daf-help__title">Yang perlu disiapkan</p>' +
        '<ul class="daf-help__list">' +
          '<li>Data identitas dan nomor HP yang aktif</li>' +
          '<li>Riwayat pekerjaan atau proyek perancah</li>' +
          '<li>Tautan dokumen (CV, sertifikat, ijazah) di Google Drive atau layanan serupa</li>' +
          '<li>Pas foto berlatar polos <span class="muted">(opsional)</span></li>' +
        '</ul>' +
        '<p class="daf-help__foot">Ada pertanyaan? <a class="link" href="umpan-balik.html?kategori=Pertanyaan">Hubungi sekretariat</a></p>' +
      '</div>';
    }
    function renderWizard(opts) {
      S.peng = (member.application.pengalaman || []).map(function (x) { return { id: safeId(x.id), proyek: x.proyek, peran: x.peran, tahun: x.tahun, lokasi: x.lokasi }; });
      S.dok = (member.application.dokumen || []).map(function (x) { return { id: safeId(x.id), jenis: x.jenis, label: x.label, url: x.url }; });
      root.innerHTML = noticesHtml() +
        '<div class="daf-wizard">' +
          /* daf-railmeta: the completeness line for phones, where the hero status card is hidden to bring the form up */
          '<div class="daf-rail">' + stepperHtml() + '<p class="daf-railmeta" id="daf-rail-meta" hidden></p>' + saveHtml('daf-save--rail') + helpHtml('daf-help--rail') + '</div>' +
          '<div class="daf-main">' +
            '<section class="daf-panel" aria-labelledby="daf-step-title">' +
              '<header class="daf-step-head">' +
                '<p class="daf-step-head__count"><span class="index-num" id="daf-step-num"></span><span class="daf-step-head__label" id="daf-step-label"></span></p>' +
                '<h2 class="daf-step-head__title" id="daf-step-title" tabindex="-1"></h2>' +
                '<p class="daf-step-head__lead" id="daf-step-lead"></p>' +
              '</header>' +
              '<div class="alert alert--err daf-errsum" id="daf-errsum" role="alert" tabindex="-1" hidden></div>' +
              STEPS.map(function (s) { return '<div class="daf-step" id="daf-step-' + s.key + '" data-panel="' + s.key + '" hidden>' + stepBody(s.key) + '</div>'; }).join('') +
              '<footer class="daf-foot">' +
                '<button type="button" class="btn btn--ghost daf-foot__back" data-nav="prev">' + icon('arrow-left', { size: 18 }) + '<span>Kembali</span></button>' +
                saveHtml('daf-save--foot') +
                '<button type="button" class="btn btn--primary daf-foot__next" data-nav="next"><span>Lanjut</span>' + icon('arrow-right', { size: 18, cls: 'btn__icon' }) + '</button>' +
              '</footer>' +
            '</section>' +
            helpHtml('daf-help--foot') +
          '</div>' +
        '</div>' +
        '<p class="sr-only" id="daf-live" aria-live="polite"></p>';

      fillControls();
      renderPeng();
      renderDok();
      renderKomp();
      renderPhoto();
      syncSignature();
      syncCounters();
      renewalInit();

      var start = opts.step !== undefined ? opts.step : startStep();
      S.step = -1;
      goStep(start, { noFocus: !opts.focus, noScroll: !opts.focus });
      updateSave();
      updateHeroStatus(); /* renderHero ran before the rail existed → fill #daf-rail-meta now */
    }
    /* which step to open: #hash → first step with missing data → review */
    function startStep() {
      var hk = decodeURIComponent((w.location.hash || '').slice(1));
      for (var i = 0; i < STEPS.length; i++) if (STEPS[i].key === hk) return i;
      var miss = missingAll();
      var app = member.application;
      var untouched = !app.kategori && !app.updatedAt;
      if (untouched || !miss.length) return untouched ? 0 : STEPS.length - 1;
      var order = STEPS.map(function (s) { return s.key; });
      var first = order.length - 1;
      miss.forEach(function (x) { var k = order.indexOf(x.step); if (k !== -1 && k < first) first = k; });
      return first;
    }
    /* renewal: pre-select the CURRENT category and ask for a fresh declaration (one draft write).
       application.kategori still holds what the member applied for last time; the secretariat may have approved
       another category or changed it later ("Ubah Kategori"). Unless the member has written the application since
       that decision (i.e. chose a category in this renewal draft), the draft starts from member.memberType. */
    function renewalInit() {
      if (!isRenewal() || !store.canEditApplication(member)) return;
      var a = member.application, patch = {}, cur = member.memberType;
      var untouched = msOf(a.updatedAt) <= decisionAt();
      if (cur && a.kategori !== cur && kategoriOptions().indexOf(cur) !== -1 && (!a.kategori || untouched)) patch.kategori = cur;
      var pn = a.pernyataan || {}, approvedDay = String(member.approvedAt || '').slice(0, 10);
      var stale = approvedDay && (pn.kodeEtik || pn.kebenaranData || pn.privasi || pn.namaTerang) && (!pn.tanggal || pn.tanggal <= approvedDay);
      if (stale) patch.pernyataan = { kodeEtik: false, kebenaranData: false, privasi: false, namaTerang: '', tanggal: '' };
      if (!Object.keys(patch).length) return;
      if (patch.kategori) member.application.kategori = patch.kategori;
      if (patch.pernyataan) member.application.pernyataan = Object.assign({}, patch.pernyataan);
      if (patch.kategori) { var r = d.querySelector('input[name="kategori"][value="' + cssEsc(patch.kategori) + '"]'); if (r) { r.checked = true; syncCats(); } }
      if (patch.pernyataan) {
        ['kodeEtik', 'kebenaranData', 'privasi'].forEach(function (k) { var c = $('#f-' + k); if (c) c.checked = false; });
        var nt = $('#f-namaTerang'); if (nt) nt.value = '';
        syncSignature();
      }
      queueApp(patch);
      flushNow();
    }
    function cssEsc(s) { return w.CSS && CSS.escape ? CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'); }

    /* ---------- step bodies ---------- */
    function stepBody(key) {
      switch (key) {
        case 'kategori': return bodyKategori();
        case 'data-diri': return bodyDataDiri();
        case 'profesional': return bodyProfesional();
        case 'kompetensi': return bodyKompetensi();
        case 'dokumen': return bodyDokumen();
        case 'pernyataan': return bodyPernyataan();
        default: return '<div class="daf-review" id="daf-review"></div>';
      }
    }
    function req() { return ' <span class="field__req" aria-hidden="true">*</span>'; }
    function reqNote() { return '<p class="daf-reqnote">Kolom bertanda <span aria-hidden="true">*</span><span class="sr-only">bintang</span> wajib diisi.</p>'; }

    /* one compact choice per category: numeral, name, one-line description and a "Pilih" node; the requirements
       and benefits sit in a disclosure that is open only on the selected card (syncCats) */
    function bodyKategori() {
      var opts = kategoriOptions();
      var anyContoh = opts.some(function (n) { var k = kategoriInfo(n); return !!(k && k.contoh); });
      var cards = opts.map(function (nama, i) {
        var k = kategoriInfo(nama) || { nama: nama };
        var id = 'cat-' + i;
        var list = function (title, arr) {
          arr = Array.isArray(arr) ? arr : [];
          return arr.length ? '<div class="daf-cat__col"><p class="daf-cat__list-title">' + h(title) + '</p><ul class="daf-cat__list">' + arr.map(function (x) { return '<li>' + h(x) + '</li>'; }).join('') + '</ul></div>' : '';
        };
        var lists = list('Persyaratan', k.syarat) + list('Manfaat', k.manfaat);
        return '<div class="daf-cat" data-value="' + h(nama) + '">' +
          '<input class="daf-cat__input" type="radio" name="kategori" id="' + id + '" value="' + h(nama) + '" data-bind="app.kategori"' + (k.ringkas ? ' aria-describedby="' + id + '-desc"' : '') + '>' +
          '<span class="index-num daf-cat__num">' + pad(i + 1) + '</span>' +
          '<label class="daf-cat__name" for="' + id + '">' + h(nama) + '</label>' +
          (k.ringkas ? '<p class="daf-cat__desc" id="' + id + '-desc">' + h(k.ringkas) + '</p>' : '') +
          '<span class="daf-cat__pick" aria-hidden="true"><span class="daf-cat__node">' + icon('check', { size: 14 }) + '</span>' +
            '<span class="daf-cat__pick-off">Pilih</span><span class="daf-cat__pick-on">Dipilih</span></span>' +
          (lists ? '<details class="daf-cat__more">' +
            '<summary class="daf-cat__summary"><span>Lihat syarat &amp; manfaat</span><span class="sr-only"> kategori ' + h(nama) + '</span>' + icon('chevron-down', { size: 16 }) + '</summary>' +
            '<div class="daf-cat__lists">' + lists + '</div>' +
          '</details>' : '') +
        '</div>';
      }).join('');
      var renewalHint = isRenewal() && member.approvedAt
        ? '<p class="daf-hint-line">' + icon('info', { size: 16 }) + '<span>Kategori Anda saat ini: <strong>' + h(member.memberType) + '</strong>. Pilih kategori lain hanya bila Anda ingin mengajukan perubahan kategori.</span></p>'
        : '';
      var contohNote = anyContoh
        ? '<p class="daf-cat-note">' + util.contohBadge({ contoh: true }) + '<span>Uraian kategori beserta persyaratan dan manfaatnya masih berupa contoh dan menunggu penetapan resmi pengurus.</span></p>'
        : '';
      return '<form class="daf-form" data-form="kategori" novalidate>' + renewalHint + contohNote +
        '<fieldset class="field daf-cats" id="f-kategori" role="radiogroup" aria-required="true">' +
          '<legend class="sr-only">Kategori keanggotaan (wajib dipilih)</legend>' +
          '<div class="daf-cats__grid">' + cards + '</div>' +
        '</fieldset>' +
        '<p class="daf-fineprint">Kategori Kehormatan tidak dapat diajukan; kategori tersebut ditetapkan oleh pengurus.</p>' +
        '<button type="submit" hidden tabindex="-1" aria-hidden="true"></button>' +
      '</form>';
    }

    function bodyDataDiri() {
      var provOpts = '<option value="">Pilih provinsi</option>' + (util.PROVINSI || []).map(function (p) { return '<option value="' + h(p) + '">' + h(p) + '</option>'; }).join('');
      var gender = (util.GENDER || ['Laki-laki', 'Perempuan']).map(function (g, i) {
        return '<label class="check"><input type="radio" name="gender" id="f-gender-' + i + '" value="' + h(g) + '" data-bind="profile.gender"><span class="check__box"></span><span class="check__label">' + h(g) + '</span></label>';
      }).join('');
      var today = util.todayIso();
      return '<form class="daf-form form" data-form="data-diri" novalidate>' + reqNote() +
        '<div class="field">' +
          '<label class="field__label" for="f-name">Nama lengkap' + req() + '</label>' +
          '<input class="field__control" id="f-name" type="text" autocomplete="name" maxlength="120" required aria-describedby="f-name-hint" data-bind="name">' +
          '<p class="field__hint" id="f-name-hint">Tulis sesuai KTP atau identitas resmi lain, beserta gelar bila ingin dicantumkan.</p>' +
        '</div>' +
        '<div class="form__row form__row--2">' +
          '<div class="field"><label class="field__label" for="f-birthPlace">Tempat lahir <span class="opt">(opsional)</span></label>' +
            '<input class="field__control" id="f-birthPlace" type="text" maxlength="100" autocomplete="off" data-bind="profile.birthPlace"></div>' +
          '<div class="field"><label class="field__label" for="f-birthDate">Tanggal lahir' + req() + '</label>' +
            '<input class="field__control" id="f-birthDate" type="date" min="1930-01-01" max="' + h(today) + '" autocomplete="bday" required data-bind="profile.birthDate"></div>' +
        '</div>' +
        '<fieldset class="field daf-radios" id="f-gender">' +
          '<legend class="field__label">Jenis kelamin <span class="opt">(opsional)</span></legend>' +
          '<div class="daf-radios__row">' + gender + '</div>' +
        '</fieldset>' +
        '<div class="form__row form__row--2">' +
          '<div class="field"><label class="field__label" for="f-province">Provinsi domisili' + req() + '</label>' +
            '<select class="field__control" id="f-province" autocomplete="address-level1" required data-bind="profile.province">' + provOpts + '</select></div>' +
          '<div class="field"><label class="field__label" for="f-city">Kota / kabupaten' + req() + '</label>' +
            '<input class="field__control" id="f-city" type="text" maxlength="100" autocomplete="address-level2" required data-bind="profile.city"></div>' +
        '</div>' +
        '<div class="field"><label class="field__label" for="f-address">Alamat <span class="opt">(opsional)</span></label>' +
          '<textarea class="field__control daf-textarea--sm" id="f-address" rows="3" maxlength="400" autocomplete="street-address" data-bind="profile.address"></textarea></div>' +
        '<div class="form__row form__row--2">' +
          '<div class="field"><label class="field__label" for="f-phone">Nomor HP' + req() + '</label>' +
            '<div class="input-group"><span class="input-group__prefix" aria-hidden="true">+62</span>' +
            '<input class="field__control" id="f-phone" type="tel" inputmode="tel" autocomplete="tel-national" maxlength="20" required aria-describedby="f-phone-hint" data-bind="phone" placeholder="812-3456-7890"></div>' +
            '<p class="field__hint" id="f-phone-hint">Nomor seluler aktif yang dapat dihubungi sekretariat.</p></div>' +
          '<div class="field"><label class="field__label" for="f-email">Email akun</label>' +
            '<input class="field__control" id="f-email" type="email" readonly aria-describedby="f-email-hint">' +
            '<p class="field__hint" id="f-email-hint">Mengikuti akun yang Anda gunakan untuk masuk.</p></div>' +
        '</div>' +
        '<div class="daf-photo" id="daf-photo"></div>' +
        '<button type="submit" hidden tabindex="-1" aria-hidden="true"></button>' +
      '</form>';
    }

    function bodyProfesional() {
      var eduOpts = '<option value="">Pilih pendidikan terakhir</option>' + (util.PENDIDIKAN || []).map(function (p) { return '<option value="' + h(p) + '">' + h(p) + '</option>'; }).join('');
      return '<form class="daf-form form" data-form="profesional" novalidate>' + reqNote() +
        '<div class="form__row form__row--2">' +
          '<div class="field"><label class="field__label" for="f-company">Perusahaan / instansi' + req() + '</label>' +
            '<input class="field__control" id="f-company" type="text" maxlength="150" autocomplete="organization" required aria-describedby="f-company-hint" data-bind="profile.company">' +
            '<p class="field__hint" id="f-company-hint">Tulis “Pekerja mandiri” bila tidak terikat perusahaan.</p></div>' +
          '<div class="field"><label class="field__label" for="f-position">Jabatan' + req() + '</label>' +
            '<input class="field__control" id="f-position" type="text" maxlength="120" autocomplete="organization-title" required data-bind="profile.position"></div>' +
        '</div>' +
        '<div class="form__row form__row--2">' +
          '<div class="field"><label class="field__label" for="f-education">Pendidikan terakhir <span class="opt">(opsional)</span></label>' +
            '<select class="field__control" id="f-education" data-bind="profile.education">' + eduOpts + '</select></div>' +
          '<div class="field"><label class="field__label" for="f-experienceYears">Pengalaman di bidang perancah</label>' +
            '<div class="daf-suffix"><input class="field__control" id="f-experienceYears" type="number" inputmode="numeric" min="0" max="80" step="1" aria-describedby="f-experienceYears-unit f-experienceYears-hint" data-bind="profile.experienceYears">' +
            '<span class="daf-suffix__unit" id="f-experienceYears-unit">tahun</span></div>' +
            '<p class="field__hint" id="f-experienceYears-hint">Wajib diisi bila riwayat proyek di bawah kosong.</p></div>' +
        '</div>' +
        '<div class="daf-sub">' +
          '<div class="daf-sub__head"><h3 class="daf-sub__title">Riwayat proyek</h3><span class="daf-sub__count" id="peng-count" aria-live="polite"></span></div>' +
          '<p class="daf-sub__lead">Proyek atau pekerjaan perancah yang pernah Anda tangani, maksimal ' + LIMITS.pengalaman + ' entri. Cantumkan yang paling relevan.</p>' +
          '<ol class="daf-reps" id="peng-list"></ol>' +
          '<button type="button" class="btn btn--ghost btn--sm daf-add" data-action="peng-add">' + icon('plus', { size: 16 }) + '<span>Tambah riwayat proyek</span></button>' +
        '</div>' +
        '<button type="submit" hidden tabindex="-1" aria-hidden="true"></button>' +
      '</form>';
    }

    function bodyKompetensi() {
      return '<div class="daf-form">' +
        '<p class="daf-hint-line">' + icon('info', { size: 16 }) + '<span>Data ini sama dengan bagian Kompetensi dan Sertifikat pada Profil Anggota, sehingga cukup diisi satu kali dan tetap dapat diperbarui setelah keanggotaan aktif.</span></p>' +
        '<div class="daf-sub">' +
          '<div class="daf-sub__head"><h3 class="daf-sub__title">Kompetensi</h3>' +
            '<button type="button" class="btn btn--ghost btn--sm" data-action="komp-add">' + icon('plus', { size: 16 }) + '<span>Tambah kompetensi</span></button></div>' +
          '<div id="komp-list"></div>' +
        '</div>' +
        '<div class="daf-sub">' +
          '<div class="daf-sub__head"><h3 class="daf-sub__title">Sertifikat</h3>' +
            '<button type="button" class="btn btn--ghost btn--sm" data-action="cert-add">' + icon('plus', { size: 16 }) + '<span>Tambah sertifikat</span></button></div>' +
          '<div id="cert-list"></div>' +
        '</div>' +
      '</div>';
    }

    function bodyDokumen() {
      var pay = '';
      if (IURAN) {
        var info = [];
        if (IURAN.nominal) info.push('<div class="kv__row"><dt>Nominal</dt><dd>' + h(IURAN.nominal) + '</dd></div>');
        if (IURAN.rekening) info.push('<div class="kv__row"><dt>Rekening</dt><dd>' + h(IURAN.rekening) + '</dd></div>');
        pay = '<div class="daf-sub">' +
          '<div class="daf-sub__head"><h3 class="daf-sub__title">Iuran keanggotaan</h3></div>' +
          (IURAN.keterangan ? '<p class="daf-sub__lead">' + h(IURAN.keterangan) + '</p>' : '') +
          (info.length ? '<dl class="kv daf-pay-info">' + info.join('') + '</dl>' : '') +
          '<div class="form__row form__row--2">' +
            '<div class="field"><label class="field__label" for="f-pay-metode">Metode pembayaran <span class="opt">(opsional)</span></label>' +
              '<input class="field__control" id="f-pay-metode" type="text" maxlength="60" placeholder="mis. Transfer bank" data-bind="app.pembayaran.metode"></div>' +
            '<div class="field"><label class="field__label" for="f-pay-tanggal">Tanggal pembayaran <span class="opt">(opsional)</span></label>' +
              '<input class="field__control" id="f-pay-tanggal" type="date" max="' + h(util.todayIso()) + '" data-bind="app.pembayaran.tanggal"></div>' +
          '</div>' +
          '<div class="field"><label class="field__label" for="f-pay-bukti">Tautan bukti pembayaran' + req() + '</label>' +
            '<div class="input-icon">' + icon('link', { size: 18 }) + '<input class="field__control" id="f-pay-bukti" type="url" inputmode="url" maxlength="1000" required placeholder="https://drive.google.com/…" data-bind="app.pembayaran.buktiUrl"></div></div>' +
        '</div>';
      }
      return '<form class="daf-form form" data-form="dokumen" novalidate>' +
        '<div class="daf-tip">' + icon('upload', { size: 20 }) +
          '<div><p class="daf-tip__title">Cara melampirkan dokumen</p>' +
          '<ol class="daf-tip__list"><li>Unggah berkas (PDF atau foto) ke Google Drive, OneDrive, atau layanan serupa.</li>' +
          '<li>Ubah akses berbagi menjadi <strong>“Siapa saja yang memiliki link dapat melihat”</strong>.</li>' +
          '<li>Salin tautannya, lalu tempel di bawah. Tautan harus diawali <span class="nowrap">https://</span>.</li></ol>' +
          '<p class="daf-tip__note"><strong>Jangan melampirkan KTP, NIK, atau data rekening kecuali diminta sekretariat.</strong> Di situs ini tautan hanya dapat dilihat oleh Anda dan sekretariat, tetapi siapa pun yang memegang tautan tersebut dapat membuka berkasnya. Pertahankan akses berbagi sampai pengajuan Anda diputuskan; setelah itu akses tersebut dapat Anda nonaktifkan (lihat <a class="link" href="kebijakan-privasi.html" target="_blank" rel="noopener">Kebijakan Privasi<span class="sr-only"> (tab baru)</span></a>).</p></div>' +
        '</div>' +
        '<div class="daf-sub">' +
          '<div class="daf-sub__head"><h3 class="daf-sub__title">Daftar dokumen</h3><span class="daf-sub__count" id="dok-count" aria-live="polite"></span></div>' +
          '<p class="daf-sub__lead">Disarankan: CV terbaru, sertifikat kompetensi, dan ijazah terakhir. Maksimal ' + LIMITS.dokumen + ' dokumen.</p>' +
          '<ol class="daf-reps" id="dok-list"></ol>' +
          '<button type="button" class="btn btn--ghost btn--sm daf-add" data-action="dok-add">' + icon('plus', { size: 16 }) + '<span>Tambah dokumen</span></button>' +
        '</div>' + pay +
        '<div class="field"><label class="field__label" for="f-catatan">Catatan untuk sekretariat <span class="opt">(opsional)</span><span class="field__counter" id="f-catatan-count" aria-hidden="true"></span></label>' +
          '<textarea class="field__control daf-textarea--sm" id="f-catatan" rows="3" maxlength="' + (LIMITS.catatan || 1000) + '" aria-describedby="f-catatan-hint" data-bind="app.catatan"></textarea>' +
          '<p class="field__hint" id="f-catatan-hint">Misalnya keterangan dokumen yang menyusul atau informasi lain yang perlu diketahui sekretariat.</p></div>' +
        '<button type="submit" hidden tabindex="-1" aria-hidden="true"></button>' +
      '</form>';
    }

    function bodyPernyataan() {
      function stmt(key, html, hint) {
        return '<div class="field daf-stmt">' +
          '<label class="check"><input type="checkbox" id="f-' + key + '" required data-bind="app.pernyataan.' + key + '"' + (hint ? ' aria-describedby="f-' + key + '-hint"' : '') + '><span class="check__box"></span><span class="check__label">' + html + '</span></label>' +
          (hint ? '<p class="daf-stmt__hint" id="f-' + key + '-hint">' + hint + '</p>' : '') +
        '</div>';
      }
      return '<form class="daf-form form" data-form="pernyataan" novalidate>' +
        '<fieldset class="daf-stmts"><legend class="daf-stmts__legend">Dengan ini saya menyatakan:</legend>' +
          /* the documents are not published yet (V2 report, open issue 3) — say where a copy can be obtained */
          stmt('kodeEtik', 'Bersedia mematuhi Kode Etik serta Anggaran Dasar dan Anggaran Rumah Tangga (AD/ART) PPAPI.',
            'Kode Etik dan AD/ART belum tersedia di situs ini. Salinannya dapat diminta kepada sekretariat melalui <a class="link" href="umpan-balik.html?kategori=Pertanyaan" target="_blank" rel="noopener">halaman Kontak<span class="sr-only"> (tab baru)</span></a>.') +
          stmt('kebenaranData', 'Data dan dokumen yang saya sampaikan benar dan dapat dipertanggungjawabkan. Saya memahami bahwa keterangan yang tidak benar dapat menjadi dasar penolakan atau pencabutan keanggotaan.') +
          stmt('privasi', 'Menyetujui pemrosesan data pribadi saya untuk keperluan keanggotaan sesuai <a href="kebijakan-privasi.html" target="_blank" rel="noopener">Kebijakan Privasi<span class="sr-only"> (tab baru)</span></a> PPAPI.') +
        '</fieldset>' +
        '<div class="daf-sign">' +
          '<div class="field daf-sign__field"><label class="field__label" for="f-namaTerang">Nama terang' + req() + '</label>' +
            '<input class="field__control" id="f-namaTerang" type="text" maxlength="120" autocomplete="name" required aria-describedby="f-namaTerang-hint" data-bind="app.pernyataan.namaTerang">' +
            '<p class="field__hint" id="f-namaTerang-hint">Ketik nama lengkap Anda sebagai tanda tangan elektronik.</p>' +
            '<p class="daf-sign__warn" id="f-namaTerang-warn" hidden></p></div>' +
          '<div class="daf-sign__card" aria-hidden="true">' +
            '<p class="daf-sign__cap">Tanda tangan elektronik</p>' +
            '<p class="daf-sign__name" id="daf-sign-name"></p>' +
            '<p class="daf-sign__meta" id="daf-sign-meta"></p>' +
          '</div>' +
        '</div>' +
        '<button type="submit" hidden tabindex="-1" aria-hidden="true"></button>' +
      '</form>';
    }

    /* ---------- fill controls from the member record ---------- */
    function ensureOption(select, value) {
      if (!select || !value) return;
      var has = Array.prototype.some.call(select.options, function (o) { return o.value === value; });
      if (!has) { var o = d.createElement('option'); o.value = value; o.textContent = value; select.appendChild(o); }
    }
    function fillControls() {
      var p = member.profile, a = member.application;
      var cat = a.kategori;
      $$('input[name="kategori"]', root).forEach(function (r) { r.checked = r.value === cat; });
      syncCats();
      $('#f-name').value = member.name || user.name || '';
      $('#f-birthPlace').value = p.birthPlace || '';
      $('#f-birthDate').value = p.birthDate || '';
      $$('input[name="gender"]', root).forEach(function (r) { r.checked = r.value === p.gender; });
      ensureOption($('#f-province'), p.province);
      $('#f-province').value = p.province || '';
      $('#f-city').value = p.city || '';
      $('#f-address').value = p.address || '';
      $('#f-phone').value = phoneLocal(member.phone || user.phone);
      var mail = user.email || member.email || '';
      $('#f-email').value = mail;
      if (!mail) { $('#f-email').placeholder = 'Akun tanpa email'; $('#f-email-hint').textContent = 'Akun ini masuk dengan nomor HP, sehingga tidak memiliki email.'; }
      /* Mode Firebase: email tercatat pada data keanggotaan setelah diverifikasi (aturan Firestore) */
      else if (auth.mode === 'firebase' && user.emailVerified === false) $('#f-email-hint').textContent = 'Email ini belum diverifikasi. Buka tautan verifikasi yang dikirim ke email Anda agar tercatat pada data keanggotaan; tautan baru dapat diminta di Dasbor.';
      $('#f-company').value = p.company || '';
      $('#f-position').value = p.position || '';
      ensureOption($('#f-education'), p.education);
      $('#f-education').value = p.education || '';
      $('#f-experienceYears').value = p.experienceYears === null || p.experienceYears === undefined ? '' : p.experienceYears;
      $('#f-catatan').value = a.catatan || '';
      if (IURAN) {
        $('#f-pay-metode').value = a.pembayaran.metode || '';
        $('#f-pay-tanggal').value = a.pembayaran.tanggal || '';
        $('#f-pay-bukti').value = a.pembayaran.buktiUrl || '';
      }
      $('#f-kodeEtik').checked = !!a.pernyataan.kodeEtik;
      $('#f-kebenaranData').checked = !!a.pernyataan.kebenaranData;
      $('#f-privasi').checked = !!a.pernyataan.privasi;
      $('#f-namaTerang').value = a.pernyataan.namaTerang || '';
      applyIdentityLock();
    }
    /* Nama lengkap (dan tanggal lahir yang sudah terisi) telah ditinjau saat keanggotaan disetujui: nama
       tercantum pada KTA dan daftar verifikasi, sehingga pada pengajuan perpanjangan keduanya tidak diubah
       melalui formulir ini (aturan Firestore identityKept; sama dengan Profil Anggota). Isian yang masih
       kosong tetap dapat dilengkapi. */
    var NAME_HINT = 'Tulis sesuai KTP atau identitas resmi lain, beserta gelar bila ingin dicantumkan.';
    function applyIdentityLock() {
      var approved = !!String(member.approvedAt || '').trim();
      var lockName = approved && String(member.name || '').trim().length >= 3;
      var lockBirth = approved && /^\d{4}-\d{2}-\d{2}$/.test(String((member.profile || {}).birthDate || ''));
      var nm = $('#f-name'), bd = $('#f-birthDate'), hint = $('#f-name-hint');
      if (nm) nm.readOnly = lockName;
      if (bd) {
        bd.readOnly = lockBirth;
        if (lockBirth) bd.setAttribute('aria-describedby', 'f-name-hint'); else bd.removeAttribute('aria-describedby');
      }
      if (!hint) return;
      if (lockName || lockBirth) {
        var what = lockName && lockBirth ? 'Nama lengkap dan tanggal lahir' : lockName ? 'Nama lengkap' : 'Tanggal lahir';
        hint.classList.add('daf-identity-note');
        hint.innerHTML = icon('lock', { size: 15 }) + '<span>' + h(what) + ' mengikuti data keanggotaan yang telah disetujui' +
          (lockName ? ' dan tercantum pada Kartu Tanda Anggota' : '') + ', sehingga tidak diubah melalui formulir ini. ' +
          'Untuk perbaikan, hubungi sekretariat melalui halaman <a class="link" href="umpan-balik.html?kategori=Pertanyaan">Kontak</a>.</span>';
      } else {
        hint.classList.remove('daf-identity-note');
        hint.textContent = NAME_HINT;
      }
    }
    /* selected card: highlighted, requirements & benefits open; the others fold back to one line each */
    function syncCats() {
      $$('.daf-cat', root).forEach(function (c) {
        var r = $('.daf-cat__input', c), on = !!(r && r.checked), more = $('.daf-cat__more', c);
        c.classList.toggle('is-selected', on);
        if (more && more.open !== on) more.open = on;
      });
    }
    function syncCounters() {
      var c = $('#f-catatan'), out = $('#f-catatan-count');
      if (c && out) out.textContent = util.formatNumber(c.value.length) + ' / ' + util.formatNumber(LIMITS.catatan || 1000);
    }
    function syncSignature() {
      var nt = $('#f-namaTerang'), name = $('#daf-sign-name'), meta = $('#daf-sign-meta'), warn = $('#f-namaTerang-warn');
      if (!nt || !name) return;
      var v = nt.value.trim().replace(/\s+/g, ' ');
      name.textContent = v || 'Nama terang Anda';
      name.classList.toggle('is-empty', !v);
      meta.textContent = 'Tanggal pernyataan: ' + util.formatDate(util.todayIso());
      var full = ($('#f-name') && $('#f-name').value.trim().replace(/\s+/g, ' ')) || member.name || '';
      var differs = v.length >= 3 && full && v.toLowerCase() !== full.toLowerCase();
      warn.hidden = !differs;
      warn.textContent = differs ? 'Nama terang berbeda dengan nama lengkap pada Data Diri (“' + full + '”). Pastikan keduanya sesuai identitas Anda.' : '';
    }

    /* ---------- repeaters: riwayat proyek ---------- */
    function pengRowHtml(x, i) {
      var id = x.id;
      function f(key, label, attrs, cls) {
        return '<div class="field' + (cls ? ' ' + cls : '') + '"><label class="field__label" for="peng-' + key + '-' + id + '">' + label + '</label>' +
          '<input class="field__control" id="peng-' + key + '-' + id + '" data-rep="peng" data-key="' + key + '" value="' + h(x[key] || '') + '" ' + attrs + '></div>';
      }
      return '<li class="daf-rep" data-id="' + h(id) + '">' +
        '<div class="daf-rep__head"><span class="daf-rep__num">' + pad(i + 1) + '</span><span class="daf-rep__title">' + h(x.proyek || 'Riwayat proyek') + '</span>' +
          '<button type="button" class="icon-btn icon-btn--ghost icon-btn--sm" data-action="peng-remove" data-id="' + h(id) + '" aria-label="Hapus riwayat proyek ' + (i + 1) + '">' + icon('trash', { size: 18 }) + '</button></div>' +
        '<div class="daf-rep__grid">' +
          f('proyek', 'Nama proyek / pekerjaan' + req(), 'type="text" maxlength="200" autocomplete="off" placeholder="mis. Perancah fasad gedung kantor 18 lantai"', 'daf-rep__wide') +
          f('peran', 'Peran', 'type="text" maxlength="120" autocomplete="off" placeholder="mis. Supervisor perancah"') +
          f('tahun', 'Tahun', 'type="text" inputmode="numeric" maxlength="9" autocomplete="off" placeholder="mis. 2024 atau 2022–2023"') +
          f('lokasi', 'Lokasi', 'type="text" maxlength="120" autocomplete="off" placeholder="mis. Balikpapan, Kalimantan Timur"', 'daf-rep__wide') +
        '</div></li>';
    }
    function renderPeng() {
      var list = $('#peng-list');
      if (!list) return;
      list.innerHTML = S.peng.map(pengRowHtml).join('');
      list.hidden = !S.peng.length;
      $('#peng-count').textContent = S.peng.length ? S.peng.length + ' / ' + LIMITS.pengalaman : 'Belum ada';
      var add = $('[data-action="peng-add"]', root);
      if (add) add.disabled = S.peng.length >= LIMITS.pengalaman;
    }
    function readPeng() {
      S.peng.forEach(function (x) {
        ['proyek', 'peran', 'tahun', 'lokasi'].forEach(function (k) {
          var el = d.getElementById('peng-' + k + '-' + x.id);
          if (el) x[k] = el.value.trim().replace(/\s+/g, ' ');
        });
      });
      return S.peng.filter(function (x) { return x.proyek || x.peran || x.tahun || x.lokasi; }).map(function (x) {
        return { id: x.id, proyek: x.proyek, peran: x.peran, tahun: x.tahun, lokasi: x.lokasi };
      });
    }
    /* ---------- repeaters: dokumen ---------- */
    function dokRowHtml(x, i) {
      var id = x.id;
      var opts = DOC_TYPES.map(function (t) { return '<option value="' + h(t) + '"' + (t === x.jenis ? ' selected' : '') + '>' + h(t) + '</option>'; }).join('');
      return '<li class="daf-rep" data-id="' + h(id) + '">' +
        '<div class="daf-rep__head"><span class="daf-rep__num">' + pad(i + 1) + '</span><span class="daf-rep__title">' + h(x.label || x.jenis || 'Dokumen') + '</span>' +
          (isHttps(x.url) ? '<a class="btn btn--link btn--sm daf-rep__open" href="' + h(x.url) + '" target="_blank" rel="noopener noreferrer"><span>Buka</span><span class="sr-only"> dokumen ' + (i + 1) + ' (tab baru)</span>' + icon('arrow-up-right', { size: 16, cls: 'btn__icon' }) + '</a>' : '') +
          '<button type="button" class="icon-btn icon-btn--ghost icon-btn--sm" data-action="dok-remove" data-id="' + h(id) + '" aria-label="Hapus dokumen ' + (i + 1) + '">' + icon('trash', { size: 18 }) + '</button></div>' +
        '<div class="daf-rep__grid">' +
          '<div class="field"><label class="field__label" for="dok-jenis-' + id + '">Jenis dokumen</label>' +
            '<select class="field__control" id="dok-jenis-' + id + '" data-rep="dok" data-key="jenis">' + opts + '</select></div>' +
          '<div class="field"><label class="field__label" for="dok-label-' + id + '">Keterangan <span class="opt">(opsional)</span></label>' +
            '<input class="field__control" id="dok-label-' + id + '" type="text" maxlength="160" autocomplete="off" placeholder="mis. CV terbaru 2026" data-rep="dok" data-key="label" value="' + h(x.label || '') + '"></div>' +
          '<div class="field daf-rep__wide"><label class="field__label" for="dok-url-' + id + '">Tautan dokumen' + req() + '</label>' +
            '<div class="input-icon">' + icon('link', { size: 18 }) + '<input class="field__control" id="dok-url-' + id + '" type="url" inputmode="url" maxlength="1000" autocomplete="off" placeholder="https://drive.google.com/…" data-rep="dok" data-key="url" value="' + h(x.url || '') + '"></div></div>' +
        '</div></li>';
    }
    function renderDok() {
      var list = $('#dok-list');
      if (!list) return;
      list.innerHTML = S.dok.map(dokRowHtml).join('');
      list.hidden = !S.dok.length;
      $('#dok-count').textContent = S.dok.length ? S.dok.length + ' / ' + LIMITS.dokumen : 'Belum ada';
      var add = $('[data-action="dok-add"]', root);
      if (add) add.disabled = S.dok.length >= LIMITS.dokumen;
    }
    function readDok() {
      S.dok.forEach(function (x) {
        ['jenis', 'label', 'url'].forEach(function (k) {
          var el = d.getElementById('dok-' + k + '-' + x.id);
          if (el) x[k] = k === 'url' ? fixUrl(el.value) : el.value.trim().replace(/\s+/g, ' ');
        });
      });
      return S.dok.filter(function (x) { return x.label || x.url; }).map(function (x) {
        return { id: x.id, jenis: x.jenis || 'Lainnya', label: x.label, url: x.url };
      });
    }

    /* ---------- kompetensi & sertifikat lists ---------- */
    function kompItemHtml(c) {
      var kat = katalogBy(c.code);
      var meta = [c.level ? 'Tingkat ' + c.level : '', c.since ? 'sejak ' + c.since : '', kat ? kat.kelompok : ''].filter(Boolean).join(' · ');
      var name = c.name || 'Kompetensi';
      return '<li class="daf-item">' +
        '<span class="daf-item__icon" aria-hidden="true">' + icon('award', { size: 18 }) + '</span>' +
        '<span class="daf-item__body"><span class="daf-item__title">' + h(name) + '</span>' + (meta ? '<span class="daf-item__meta">' + h(meta) + '</span>' : '') + '</span>' +
        '<span class="daf-item__actions">' +
          '<button type="button" class="icon-btn icon-btn--ghost icon-btn--sm" data-action="komp-edit" data-id="' + h(c.id) + '" aria-label="Ubah kompetensi ' + h(name) + '">' + icon('edit', { size: 18 }) + '</button>' +
          '<button type="button" class="icon-btn icon-btn--ghost icon-btn--sm" data-action="komp-delete" data-id="' + h(c.id) + '" aria-label="Hapus kompetensi ' + h(name) + '">' + icon('trash', { size: 18 }) + '</button>' +
        '</span></li>';
    }
    function certItemHtml(c) {
      var s = util.certStatus(c.expiresAt);
      var title = c.title || 'Sertifikat';
      var meta = [c.issuer, c.number ? 'No. ' + c.number : '', c.expiresAt ? 'berlaku hingga ' + fmtDate(c.expiresAt, true) : 'tanpa batas waktu'].filter(Boolean).join(' · ');
      return '<li class="daf-item">' +
        '<span class="daf-item__icon" aria-hidden="true">' + icon('certificate', { size: 18 }) + '</span>' +
        '<span class="daf-item__body"><span class="daf-item__title">' + h(title) + '</span><span class="daf-item__meta">' + h(meta) + '</span>' +
          '<span class="daf-item__badges"><span class="badge badge--' + h(s.tone) + '">' + h(s.label) + '</span>' +
          (isHttp(c.link) ? '<a class="daf-item__link" href="' + h(c.link) + '" target="_blank" rel="noopener noreferrer">Lihat dokumen<span class="sr-only"> ' + h(title) + ' (tab baru)</span>' + icon('arrow-up-right', { size: 14 }) + '</a>' : '') +
          '</span></span>' +
        '<span class="daf-item__actions">' +
          '<button type="button" class="icon-btn icon-btn--ghost icon-btn--sm" data-action="cert-edit" data-id="' + h(c.id) + '" aria-label="Ubah sertifikat ' + h(title) + '">' + icon('edit', { size: 18 }) + '</button>' +
          '<button type="button" class="icon-btn icon-btn--ghost icon-btn--sm" data-action="cert-delete" data-id="' + h(c.id) + '" aria-label="Hapus sertifikat ' + h(title) + '">' + icon('trash', { size: 18 }) + '</button>' +
        '</span></li>';
    }
    function renderKomp() {
      var kl = $('#komp-list'), cl = $('#cert-list');
      if (kl) kl.innerHTML = member.competencies.length
        ? '<ul class="daf-items" role="list">' + member.competencies.map(kompItemHtml).join('') + '</ul>'
        : '<p class="daf-empty">' + icon('award', { size: 18 }) + '<span>Belum ada kompetensi. Pilih dari katalog kompetensi perancah, misalnya teknisi, supervisor, atau inspektur perancah.</span></p>';
      if (cl) cl.innerHTML = member.certificates.length
        ? '<ul class="daf-items" role="list">' + member.certificates.map(certItemHtml).join('') + '</ul>'
        : '<p class="daf-empty">' + icon('certificate', { size: 18 }) + '<span>Belum ada sertifikat. Catat sertifikat kompetensi atau lisensi K3 beserta masa berlakunya.</span></p>';
    }

    /* ---------- pas foto ---------- */
    function renderPhoto() {
      var box = $('#daf-photo');
      if (!box) return;
      var src = member.application.pasFoto;
      var kb = src ? Math.round((src.length - src.indexOf(',') - 1) * 3 / 4 / 1024) : 0;
      box.innerHTML =
        '<div class="daf-photo__frame' + (src ? ' has-photo' : '') + '">' +
          (src ? '<img src="' + h(src) + '" alt="Pratinjau pas foto Anda" width="120" height="160">' : '<span class="daf-photo__ph" aria-hidden="true">' + icon('user', { size: 34 }) + '<span>3 × 4</span></span>') +
        '</div>' +
        '<div class="daf-photo__body field" id="f-pasFoto-field">' +
          '<p class="field__label" id="f-pasFoto-label">Pas foto <span class="opt">(opsional)</span></p>' +
          '<p class="field__hint" id="f-pasFoto-hint">Foto berwarna berlatar polos dengan wajah terlihat jelas. Foto dipotong 3 × 4 dan diperkecil otomatis di perangkat Anda menjadi JPEG maksimal ' + (LIMITS.pasFotoKB || 120) + ' KB.' + (src ? ' Ukuran saat ini ±' + kb + ' KB.' : '') + '</p>' +
          '<div class="daf-photo__actions">' +
            '<label class="btn btn--ghost btn--sm daf-photo__pick">' + icon('upload', { size: 16 }) + '<span>' + (src ? 'Ganti foto' : 'Pilih foto') + '</span>' +
              '<input class="daf-file" type="file" id="f-pasFoto" accept="image/jpeg,image/png,image/webp" aria-describedby="f-pasFoto-label f-pasFoto-hint"></label>' +
            (src ? '<button type="button" class="btn btn--link btn--sm" data-action="photo-remove">' + icon('trash', { size: 16 }) + '<span>Hapus foto</span></button>' : '') +
          '</div>' +
        '</div>';
    }
    function loadImage(file) {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file);
        var img = new Image();
        img.onload = function () { resolve({ img: img, url: url }); };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Foto tidak dapat dibaca. Gunakan berkas JPEG, PNG, atau WebP.')); };
        img.src = url;
      });
    }
    /* centre-crop to 3:4, ≤ 360×480, JPEG, quality stepped down (then size) until ≤ 120 KB */
    async function makePasFoto(file) {
      if (!file) throw new Error('Tidak ada berkas yang dipilih.');
      if (!/^image\/(jpeg|png|webp)$/i.test(file.type || '')) throw new Error('Format foto harus JPEG, PNG, atau WebP.');
      if (file.size > 15 * 1024 * 1024) throw new Error('Berkas foto terlalu besar (maksimal 15 MB sebelum diperkecil).');
      var r = await loadImage(file);
      try {
        var iw = r.img.naturalWidth, ih = r.img.naturalHeight;
        if (iw < 90 || ih < 120) throw new Error('Resolusi foto terlalu kecil. Gunakan foto minimal 90 × 120 piksel.');
        var ratio = 3 / 4, sw = iw, sh = ih, sx = 0, sy = 0;
        if (iw / ih > ratio) { sw = Math.round(ih * ratio); sx = Math.round((iw - sw) / 2); }
        else { sh = Math.round(iw / ratio); sy = Math.round((ih - sh) * 0.3); } /* keep the head: crop more from the bottom */
        var tw = Math.min(360, sw);
        for (var round = 0; round < 6; round++) {
          var th = Math.round(tw * 4 / 3);
          var c = d.createElement('canvas');
          c.width = tw; c.height = th;
          var ctx = c.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, tw, th);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(r.img, sx, sy, sw, sh, 0, 0, tw, th);
          for (var q = 0.9; q >= 0.5; q -= 0.08) {
            var url = c.toDataURL('image/jpeg', q);
            if (url.indexOf('data:image/jpeg;base64,') === 0 && url.length - 23 <= PHOTO_MAX) return url;
          }
          tw = Math.round(tw * 0.8);
        }
        throw new Error('Foto tidak dapat diperkecil hingga ' + (LIMITS.pasFotoKB || 120) + ' KB. Gunakan foto lain.');
      } finally { URL.revokeObjectURL(r.url); }
    }
    async function onPhotoChosen(input) {
      var file = input.files && input.files[0];
      var field = $('#f-pasFoto-field');
      if (!file) return;
      setError(input, '');
      field.classList.add('is-busy');
      setSave('saving');
      try {
        var dataUrl = await makePasFoto(file);
        await enqueue(function () { return store.saveApplication(user.uid, { pasFoto: dataUrl }); }, true);
        renderPhoto();
        ui.toast('Pas foto tersimpan.', { type: 'success' });
        focusEl($('#f-pasFoto'));
      } catch (err) {
        renderPhoto();
        var inp = $('#f-pasFoto');
        setError(inp, errMsg(err, 'Foto gagal diproses.'));
        focusEl(inp);
        updateSave();
      } finally {
        var f2 = $('#f-pasFoto-field');
        if (f2) f2.classList.remove('is-busy');
      }
    }

    /* ==================================================================
       5. NAVIGATION + STEPPER
       ================================================================== */
    function stepDone(i) {
      var key = STEPS[i].key, miss = missingByStep()[key] || [];
      if (key === 'tinjau' || miss.length) return false;
      if (key === 'kompetensi') return !!(S.visited[key] || member.competencies.length || member.certificates.length);
      if (key === 'dokumen') return !!(S.visited[key] || member.application.dokumen.length);
      if (key === 'kategori') return !!member.application.kategori;
      return true;
    }
    function stepHint(i) {
      var key = STEPS[i].key, miss = (missingByStep()[key] || []).length, a = member.application;
      switch (key) {
        case 'kategori': return a.kategori && kategoriOptions().indexOf(a.kategori) !== -1 ? a.kategori : 'Belum dipilih';
        case 'data-diri':
        case 'profesional': return miss ? miss + ' isian wajib belum diisi' : 'Lengkap';
        case 'kompetensi':
          var n = member.competencies.length, m = member.certificates.length;
          return (n || m) ? n + ' kompetensi · ' + m + ' sertifikat' : 'Opsional';
        case 'dokumen': return miss ? 'Bukti pembayaran belum dilampirkan' : (a.dokumen.length ? a.dokumen.length + ' dokumen' : 'Opsional');
        case 'pernyataan': return miss ? 'Belum lengkap' : 'Disetujui';
        default:
          var t = missingAll().length;
          return t ? t + ' isian belum lengkap' : 'Siap diajukan';
      }
    }
    function updateStepper() {
      var byStep = missingByStep();
      STEPS.forEach(function (s, i) {
        var li = root.querySelector('[data-step-item="' + i + '"]');
        if (!li) return;
        var btn = li.querySelector('.stepper__btn');
        var miss = (byStep[s.key] || []).length;
        var cur = i === S.step;
        var err = !cur && miss && (S.visited[s.key] || S.flagged[s.key]);
        var done = !cur && !err && stepDone(i);
        li.classList.toggle('is-current', cur);
        li.classList.toggle('is-error', !!err);
        li.classList.toggle('is-done', !!done);
        if (cur) btn.setAttribute('aria-current', 'step'); else btn.removeAttribute('aria-current');
        li.querySelector('.stepper__hint').textContent = stepHint(i);
        li.querySelector('.daf-step-sr').textContent = cur ? ' (langkah saat ini)' : (err ? ' (perlu dilengkapi)' : (done ? ' (selesai)' : ''));
      });
      var count = $('#daf-step-count'), curEl = $('#daf-step-current'), bar = $('#daf-step-bar');
      if (count) count.textContent = 'Langkah ' + (S.step + 1) + ' dari ' + STEPS.length;
      if (curEl) curEl.textContent = STEPS[S.step] ? STEPS[S.step].label : '';
      if (bar) bar.style.setProperty('--value', Math.round((S.step + 1) / STEPS.length * 100));
    }
    function updateFoot() {
      var back = $('.daf-foot__back', root), next = $('.daf-foot__next', root);
      if (!back || !next) return;
      back.hidden = S.step === 0;
      var last = S.step === STEPS.length - 1;
      next.setAttribute('data-nav', last ? 'submit' : 'next');
      next.innerHTML = last
        ? '<span>' + h(submitLabel()) + '</span>' + icon('send', { size: 18, cls: 'btn__icon' })
        : '<span>Lanjut</span>' + icon('arrow-right', { size: 18, cls: 'btn__icon' });
      if (last) next.removeAttribute('aria-label');
      else next.setAttribute('aria-label', 'Lanjut ke langkah ' + STEPS[S.step + 1].label);
      root.querySelector('.daf-foot').classList.toggle('is-first', S.step === 0);
      root.querySelector('.daf-foot').classList.toggle('is-last', last);
    }
    function goStep(i, opts) {
      opts = opts || {};
      i = Math.max(0, Math.min(STEPS.length - 1, i));
      var prev = S.step;
      if (prev >= 0 && prev !== i) { S.visited[STEPS[prev].key] = true; flushNow(); }
      S.step = i;
      var s = STEPS[i];
      $$('[data-panel]', root).forEach(function (p) { p.hidden = p.getAttribute('data-panel') !== s.key; });
      $('#daf-step-num').innerHTML = pad(i + 1) + ' <span>/ ' + pad(STEPS.length) + '</span>';
      $('#daf-step-label').textContent = s.label;
      $('#daf-step-title').innerHTML = s.title;
      $('#daf-step-lead').textContent = s.lead;
      hideErrSum();
      if (s.key === 'tinjau') renderReview();
      if (s.key === 'kategori') syncCats();
      if (s.key === 'pernyataan') syncSignature();
      updateStepper();
      updateFoot();
      try { if (w.history && w.history.replaceState) w.history.replaceState(null, '', '#' + s.key); } catch (e) { /* ignore */ }
      if (!opts.noScroll) {
        var target = w.matchMedia('(min-width: 1024px)').matches ? $('.daf-panel', root) : $('.daf-wizard', root);
        var r = target && target.getBoundingClientRect();
        if (r && (r.top < 60 || r.top > w.innerHeight * 0.45)) scrollToEl(target);
      }
      if (!opts.noFocus) focusEl($('#daf-step-title'));
    }

    /* ---------- validation (per step, reads the controls) ---------- */
    function vText(id, ok, msg, list) { var el = $('#' + id); if (!el) return; var m = ok(el.value) ? '' : msg; setError(el, m); if (m) list.push({ el: el, msg: m, label: labelOf(el) }); }
    function labelOf(el) {
      if (!el) return '';
      if (el.tagName === 'FIELDSET') { var lg = el.querySelector('legend'); return lg ? lg.textContent.replace(/\(.*?\)|\*/g, '').trim() : ''; }
      var lb = el.id ? d.querySelector('label[for="' + cssEsc(el.id) + '"]') : null;
      return lb ? lb.textContent.replace(/\(opsional\)|\*/g, '').trim() : '';
    }
    function validateStep(key) {
      var list = [];
      var panel = $('#daf-step-' + key);
      if (panel) clearErrors(panel);
      if (key === 'kategori') {
        var group = $('#f-kategori');
        var on = d.querySelector('input[name="kategori"]:checked');
        var m = on ? '' : 'Pilih salah satu kategori keanggotaan.';
        setError(group, m);
        if (m) list.push({ el: group, focus: d.querySelector('input[name="kategori"]'), msg: m, label: 'Kategori keanggotaan' });
      } else if (key === 'data-diri') {
        vText('f-name', function (v) { return v.trim().replace(/\s+/g, ' ').length >= 3; }, 'Isi nama lengkap (minimal 3 karakter).', list);
        var bd = $('#f-birthDate');
        var bv = bd.value, bm = '';
        if (bd.validity && bd.validity.badInput) bm = 'Tanggal lahir tidak valid.';
        else if (!bv) bm = 'Isi tanggal lahir.';
        else if (bv > util.todayIso() || bv < '1930-01-01') bm = 'Tanggal lahir tidak valid. Periksa kembali tahunnya.';
        setError(bd, bm);
        if (bm) list.push({ el: bd, msg: bm, label: 'Tanggal lahir' });
        vText('f-province', function (v) { return !!v; }, 'Pilih provinsi domisili.', list);
        vText('f-city', function (v) { return v.trim().length >= 2; }, 'Isi kota atau kabupaten domisili.', list);
        var ph = $('#f-phone'), pv = ph.value.trim(), pm = '';
        if (!pv) pm = 'Isi nomor HP.';
        else if (!util.normalizePhoneID(pv)) pm = 'Nomor HP tidak valid. Gunakan nomor seluler Indonesia, misalnya 0812-3456-7890.';
        setError(ph, pm);
        if (pm) list.push({ el: ph, msg: pm, label: 'Nomor HP' });
      } else if (key === 'profesional') {
        vText('f-company', function (v) { return v.trim().length >= 2; }, 'Isi nama perusahaan atau instansi.', list);
        vText('f-position', function (v) { return v.trim().length >= 2; }, 'Isi jabatan Anda.', list);
        var ey = $('#f-experienceYears'), ev = ey.value.trim(), em = '';
        var rows = readPeng();
        var y = new Date().getFullYear();
        rows.forEach(function (x, i) {
          var pEl = d.getElementById('peng-proyek-' + x.id), tEl = d.getElementById('peng-tahun-' + x.id);
          var pm2 = x.proyek && x.proyek.length >= 3 ? '' : 'Isi nama proyek atau pekerjaan (minimal 3 karakter).';
          setError(pEl, pm2);
          if (pm2) list.push({ el: pEl, msg: pm2, label: 'Riwayat proyek ' + (i + 1) + ' — nama proyek' });
          var tm = '';
          if (x.tahun) {
            var mt = /^(\d{4})(?:\s*[–-]\s*(\d{4}))?$/.exec(x.tahun);
            if (!mt || +mt[1] < 1960 || +mt[1] > y || (mt[2] && (+mt[2] < +mt[1] || +mt[2] > y))) tm = 'Tulis tahun 1960–' + y + ', misalnya 2024 atau 2022–2023.';
          }
          setError(tEl, tm);
          if (tm) list.push({ el: tEl, msg: tm, label: 'Riwayat proyek ' + (i + 1) + ' — tahun' });
        });
        if ((ey.validity && ey.validity.badInput) || (ev !== '' && (!/^\d+$/.test(ev) || +ev > 80))) em = 'Isi lama pengalaman dalam tahun (0–80).';
        else if (ev === '' && !rows.length) em = 'Isi lama pengalaman (tahun) atau tambahkan minimal satu riwayat proyek.';
        setError(ey, em);
        if (em) list.push({ el: ey, msg: em, label: 'Pengalaman di bidang perancah' });
      } else if (key === 'dokumen') {
        readDok().forEach(function (x, i) {
          var uEl = d.getElementById('dok-url-' + x.id);
          var um = !x.url ? 'Tempel tautan dokumen, atau hapus baris ini.' : (isHttps(x.url) ? '' : 'Tautan harus diawali https:// (contoh: https://drive.google.com/…).');
          setError(uEl, um);
          if (um) list.push({ el: uEl, msg: um, label: 'Dokumen ' + (i + 1) + ' — tautan' });
        });
        if (IURAN) {
          var b = $('#f-pay-bukti'), bv2 = fixUrl(b.value), bm2 = '';
          if (!bv2) bm2 = 'Tempel tautan bukti pembayaran iuran.';
          else if (!isHttps(bv2)) bm2 = 'Tautan harus diawali https://.';
          setError(b, bm2);
          if (bm2) list.push({ el: b, msg: bm2, label: 'Tautan bukti pembayaran' });
        }
      } else if (key === 'pernyataan') {
        [['kodeEtik', 'Setujui pernyataan mematuhi Kode Etik dan AD/ART PPAPI.', 'Kode Etik & AD/ART'],
         ['kebenaranData', 'Setujui pernyataan kebenaran data.', 'Kebenaran data'],
         ['privasi', 'Setujui Kebijakan Privasi untuk melanjutkan.', 'Kebijakan Privasi']].forEach(function (x) {
          var c = $('#f-' + x[0]);
          var m2 = c.checked ? '' : x[1];
          setError(c, m2);
          if (m2) list.push({ el: c, msg: m2, label: 'Pernyataan — ' + x[2] });
        });
        vText('f-namaTerang', function (v) { return v.trim().replace(/\s+/g, ' ').length >= 3; }, 'Ketik nama terang Anda (minimal 3 karakter).', list);
      }
      return list;
    }
    function showErrSum(list, title) {
      var box = $('#daf-errsum');
      if (!box) return;
      box.innerHTML = icon('alert-triangle') + '<div><p class="alert__title">' + h(title || 'Periksa kembali isian berikut') + '</p>' +
        '<ul class="daf-errsum__list">' + list.map(function (x, i) {
          return '<li><button type="button" class="daf-errsum__link" data-err="' + i + '">' + (x.label ? '<strong>' + h(x.label) + '</strong> — ' : '') + h(x.msg) + '</button></li>';
        }).join('') + '</ul></div>';
      box.hidden = false;
      box._list = list;
    }
    function hideErrSum() { var box = $('#daf-errsum'); if (box) { box.hidden = true; box.innerHTML = ''; box._list = null; } }
    /* drop summary lines whose control is fixed (or gone); hide the summary when none are left */
    function pruneErrSum() {
      var box = $('#daf-errsum');
      if (!box || box.hidden || !box._list) return;
      var lis = $$('.daf-errsum__list > li', box), left = 0;
      box._list.forEach(function (it, i) {
        var c = it.el, bad = c && d.contains(c) && c.getAttribute('aria-invalid') === 'true';
        if (lis[i]) lis[i].hidden = !bad;
        if (bad) left++;
      });
      if (!left) hideErrSum();
    }
    function next() {
      var key = STEPS[S.step].key;
      readAll();
      var errs = validateStep(key);
      if (errs.length) {
        S.flagged[key] = true;
        updateStepper();
        showErrSum(errs);
        var first = errs[0];
        focusEl(first.focus || first.el);
        if (first.el && first.el.scrollIntoView) scrollToEl(first.el.closest('.field') || first.el, 40);
        return;
      }
      S.flagged[key] = false;
      goStep(S.step + 1);
    }
    function jumpToField(key, step) {
      var idx = -1;
      STEPS.forEach(function (s, i) { if (s.key === step) idx = i; });
      if (idx === -1) return;
      goStep(idx, { noFocus: true });
      var errs = validateStep(step);
      if (errs.length) showErrSum(errs);
      var el = d.getElementById(FIELD_CTRL[key] || '');
      if (key === 'kategori') el = d.querySelector('input[name="kategori"]:checked') || d.querySelector('input[name="kategori"]');
      if (el) {
        scrollToEl(el.closest('.field') || el, 40);
        focusEl(el);
      } else focusEl($('#daf-step-title'));
    }

    /* ==================================================================
       6. AUTOSAVE (debounced + serialised)
       ================================================================== */
    function enqueue(fn, rethrow) {
      var p = S.chain.then(async function () {
        S.saving++;
        setSave('saving');
        try {
          var res = await fn();
          if (res && res.uid) member = res;
          S.saveError = null;
          S.lastSaved = new Date();
        } catch (err) {
          var first = !S.saveError;
          S.saveError = err;
          console.warn('[pendaftaran] simpan:', err && (err.code || err.message));
          if (rethrow) throw err;
          /* one toast per failure streak (autosave keeps retrying quietly; the indicator offers "Coba lagi") */
          if (first) ui.toast(errMsg(err, 'Perubahan belum tersimpan. Periksa koneksi Anda, lalu coba lagi.'), { type: 'error' });
        } finally {
          S.saving--;
          afterSave();
        }
      });
      S.chain = p.catch(function () { /* keep the chain alive */ });
      return p;
    }
    function queueApp(patch) {
      S.pendApp = S.pendApp || {};
      Object.keys(patch).forEach(function (k) {
        if (k === 'pembayaran' || k === 'pernyataan') S.pendApp[k] = Object.assign({}, S.pendApp[k] || {}, patch[k]);
        else S.pendApp[k] = patch[k];
      });
      schedule();
    }
    function queueMember(patch) {
      S.pendMem = S.pendMem || {};
      Object.keys(patch).forEach(function (k) {
        if (k === 'profile') S.pendMem.profile = Object.assign({}, S.pendMem.profile || {}, patch.profile);
        else S.pendMem[k] = patch[k];
      });
      schedule();
    }
    function queueName(name) { S.pendName = name; schedule(); }
    function hasPending() { return !!(S.pendApp || S.pendMem || S.pendName !== null); }
    function schedule() {
      clearTimeout(S.timer);
      setSave('dirty');
      S.timer = setTimeout(flushNow, 650);
    }
    function flushNow() {
      clearTimeout(S.timer);
      S.timer = null;
      if (!hasPending()) return S.chain;
      var app = S.pendApp, mem = S.pendMem, name = S.pendName;
      S.pendApp = null; S.pendMem = null; S.pendName = null;
      return enqueue(async function () {
        var out = null;
        try {
          if (name !== null) { await auth.updateName(name); name = null; out = await store.getMember(user.uid); }
          if (mem) { out = await store.saveMember(user.uid, mem); mem = null; }
          if (app) { out = await store.saveApplication(user.uid, app); app = null; }
        } catch (err) {
          /* put back what was not written, so "Coba lagi" retries it (newer edits win) */
          if (app) S.pendApp = Object.assign({}, app, S.pendApp || {});
          if (mem) { var cur = S.pendMem || {}; S.pendMem = Object.assign({}, mem, cur, { profile: Object.assign({}, mem.profile || {}, cur.profile || {}) }); if (!Object.keys(S.pendMem.profile).length) delete S.pendMem.profile; }
          if (name !== null && S.pendName === null) S.pendName = name;
          throw err;
        }
        return out;
      });
    }
    function afterSave() {
      if (S.view !== 'wizard') return;
      updateSave();
      updateStepper();
      updateHeroStatus();
      if (STEPS[S.step] && STEPS[S.step].key === 'tinjau' && !S.saving) renderReview();
    }
    function setSave(state) {
      $$('.js-save', root).forEach(function (el) {
        el.setAttribute('data-state', state);
        var t = el.querySelector('.daf-save__text'), ic = el.querySelector('.daf-save__icon');
        if (state === 'saving' || state === 'dirty') {
          t.textContent = 'Menyimpan…';
          ic.innerHTML = '<span class="spinner daf-save__spin"></span>';
        }
      });
    }
    function updateSave() {
      /* a failed write is put back into the queue → show the error (with "Coba lagi"), not "Menyimpan…" */
      if (S.saving || (hasPending() && !S.saveError)) { setSave('saving'); return; }
      var live = $('#daf-live');
      $$('.js-save', root).forEach(function (el) {
        var t = el.querySelector('.daf-save__text'), ic = el.querySelector('.daf-save__icon');
        if (S.saveError) {
          el.setAttribute('data-state', 'error');
          ic.innerHTML = icon('alert-triangle', { size: 16 });
          t.innerHTML = 'Belum tersimpan. <button type="button" class="daf-save__retry" data-action="retry-save">Coba lagi</button>';
        } else if (S.lastSaved) {
          el.setAttribute('data-state', 'saved');
          ic.innerHTML = icon('check', { size: 16 });
          t.textContent = 'Tersimpan · ' + nowTime(S.lastSaved);
        } else {
          el.setAttribute('data-state', 'idle');
          ic.innerHTML = icon('check-circle', { size: 16 });
          t.textContent = 'Isian tersimpan otomatis';
        }
      });
      if (live) {
        if (S.saveError) live.textContent = 'Perubahan belum tersimpan: ' + errMsg(S.saveError, 'terjadi gangguan') + '. Pilih Coba lagi.';
        else if (S.lastSaved && Date.now() - S.lastAnnounce > 30000) { S.lastAnnounce = Date.now(); live.textContent = 'Draf formulir tersimpan otomatis.'; }
      }
    }
    /* read every repeater into the queue (used before validation / navigation) */
    function readAll() {
      if (!$('#peng-list')) return;
      var p = JSON.stringify(readPeng()), dk = JSON.stringify(readDok());
      var a = member.application;
      if (p !== JSON.stringify((a.pengalaman || []).map(stripRow('peng')))) queueApp({ pengalaman: JSON.parse(p) });
      if (dk !== JSON.stringify((a.dokumen || []).map(stripRow('dok')))) queueApp({ dokumen: JSON.parse(dk) });
    }
    function stripRow(kind) {
      return function (x) {
        return kind === 'peng' ? { id: safeId(x.id), proyek: x.proyek, peran: x.peran, tahun: x.tahun, lokasi: x.lokasi } : { id: safeId(x.id), jenis: x.jenis, label: x.label, url: x.url };
      };
    }
    function readPernyataan() {
      return {
        kodeEtik: $('#f-kodeEtik').checked, kebenaranData: $('#f-kebenaranData').checked, privasi: $('#f-privasi').checked,
        namaTerang: $('#f-namaTerang').value.trim().replace(/\s+/g, ' '), tanggal: util.todayIso()
      };
    }

    /* field → queue */
    function onBind(el, isChange) {
      var bind = el.getAttribute('data-bind');
      if (!bind) return;
      var v = el.type === 'checkbox' ? el.checked : el.value;
      if (bind === 'name') {
        var nm = String(v).trim().replace(/\s+/g, ' ');
        if (nm.length >= 3) queueName(nm);
        if (S.step >= 0) syncSignature();
      } else if (bind === 'phone') {
        var raw = String(v).trim(), n = util.normalizePhoneID(raw);
        if (n) queueMember({ phone: n });
        else if (!raw) queueMember({ phone: '' });
      } else if (bind.indexOf('profile.') === 0) {
        var k = bind.slice(8), pv = String(v);
        if (k === 'experienceYears') {
          if (el.validity && el.validity.badInput) return;
          pv = pv.trim();
          if (pv !== '' && !/^\d+$/.test(pv)) return;
          pv = pv === '' ? null : Math.min(80, parseInt(pv, 10));
        } else if (k === 'birthDate') {
          if (pv && (pv > util.todayIso() || pv < '1930-01-01')) return;
        } else if (k !== 'gender' && k !== 'province' && k !== 'education') {
          pv = isChange ? pv.trim().replace(/[ \t]+/g, ' ') : pv;
        }
        var pp = {}; pp[k] = pv;
        queueMember({ profile: pp });
      } else if (bind === 'app.kategori') {
        if (el.checked) { queueApp({ kategori: el.value }); syncCats(); setError($('#f-kategori'), ''); }
      } else if (bind === 'app.catatan') {
        queueApp({ catatan: String(v) });
        syncCounters();
      } else if (bind.indexOf('app.pembayaran.') === 0) {
        var pk = bind.slice(15), val = String(v).trim();
        if (pk === 'buktiUrl') { val = fixUrl(val); if (val && !isHttps(val)) return; }
        var pb = {}; pb[pk] = val;
        queueApp({ pembayaran: pb });
      } else if (bind.indexOf('app.pernyataan.') === 0) {
        queueApp({ pernyataan: readPernyataan() });
        if (bind === 'app.pernyataan.namaTerang') syncSignature();
      }
    }

    /* ==================================================================
       7. KOMPETENSI / SERTIFIKAT MODALS
       ================================================================== */
    function saveMemberNow(patch) { return enqueue(function () { return store.saveMember(user.uid, patch); }, true); }
    function openKompModal(item) {
      var editing = !!item;
      var groups = {}, order = [];
      KATALOG.forEach(function (k) {
        var g = k.kelompok || 'Lainnya';
        if (!groups[g]) { groups[g] = []; order.push(g); }
        groups[g].push(k);
      });
      var selVal = item ? (katalogBy(item.code) ? item.code : '__lain') : '';
      var options = '<option value="">Pilih kompetensi…</option>' + order.map(function (g) {
        return '<optgroup label="' + h(g) + '">' + groups[g].map(function (k) {
          return '<option value="' + h(k.kode) + '"' + (selVal === k.kode ? ' selected' : '') + '>' + h(k.nama) + '</option>';
        }).join('') + '</optgroup>';
      }).join('') + '<optgroup label="Lainnya"><option value="__lain"' + (selVal === '__lain' ? ' selected' : '') + '>Lainnya — tulis sendiri</option></optgroup>';
      var curLevel = item ? item.level : LEVELS[0];
      var levelOpts = LEVELS.map(function (l) { return '<option value="' + h(l) + '"' + (l === curLevel ? ' selected' : '') + '>' + h(l) + '</option>'; }).join('');
      var y = new Date().getFullYear();
      var body = '<form class="form daf-mform" id="mk-form" novalidate>' +
        '<div class="field"><label class="field__label" for="mk-kode">Kompetensi' + req() + '</label>' +
          '<select class="field__control" id="mk-kode" required aria-describedby="mk-desc">' + options + '</select>' +
          '<p class="field__hint" id="mk-desc" aria-live="polite"></p></div>' +
        '<div class="field" id="mk-nama-field" hidden><label class="field__label" for="mk-nama">Nama kompetensi' + req() + '</label>' +
          '<input class="field__control" id="mk-nama" type="text" maxlength="150" autocomplete="off" aria-required="true" value="' + h(item && selVal === '__lain' ? item.name : '') + '"></div>' +
        '<div class="form__row form__row--2">' +
          '<div class="field"><label class="field__label" for="mk-level">Tingkat penguasaan</label>' +
            '<select class="field__control" id="mk-level" aria-describedby="mk-level-hint">' + levelOpts + '</select>' +
            '<p class="field__hint" id="mk-level-hint"></p></div>' +
          '<div class="field"><label class="field__label" for="mk-since">Sejak tahun <span class="opt">(opsional)</span></label>' +
            '<input class="field__control" id="mk-since" type="number" inputmode="numeric" min="1960" max="' + y + '" step="1" placeholder="mis. ' + (y - 5) + '" value="' + h(item && item.since ? item.since : '') + '"></div>' +
        '</div>' +
        '<button type="submit" hidden tabindex="-1" aria-hidden="true"></button></form>';
      var el = null;
      function q(id) { return el ? el.querySelector('#' + id) : null; }
      function sync() {
        var v = q('mk-kode').value, k = katalogBy(v);
        q('mk-nama-field').hidden = v !== '__lain';
        q('mk-desc').textContent = k ? k.kode + ' · ' + (k.deskripsi || '') : (v === '__lain' ? 'Tuliskan nama kompetensi yang tidak tercantum dalam katalog.' : '');
        q('mk-level-hint').textContent = LEVEL_HINT[q('mk-level').value] || '';
      }
      function submit() {
        var code = q('mk-kode').value, lain = code === '__lain', k = katalogBy(code);
        var name = lain ? q('mk-nama').value.trim().replace(/\s+/g, ' ') : (k ? k.nama : '');
        var sRaw = q('mk-since').value.trim(), since = sRaw === '' ? null : Number(sRaw);
        var bad = [];
        function chk(c, m) { setError(c, m); if (m) bad.push(c); }
        chk(q('mk-kode'), !code ? 'Pilih kompetensi dari katalog atau pilih “Lainnya”.' : '');
        if (lain) chk(q('mk-nama'), name.length < 3 ? 'Nama kompetensi minimal 3 karakter.' : '');
        chk(q('mk-since'), (q('mk-since').validity && q('mk-since').validity.badInput) || (since !== null && (!isFinite(since) || Math.floor(since) !== since || since < 1960 || since > y)) ? 'Isi tahun antara 1960 dan ' + y + '.' : '');
        var keepCode = lain ? (item && !katalogBy(item.code) ? (item.code || '') : '') : code;
        if (!bad.length) {
          var dup = member.competencies.some(function (c) {
            if (item && c.id === item.id) return false;
            if (keepCode && c.code === keepCode) return true;
            return String(c.name || '').toLowerCase() === name.toLowerCase();
          });
          if (dup) chk(lain ? q('mk-nama') : q('mk-kode'), 'Kompetensi ini sudah tercatat. Ubah data yang ada untuk memperbarui tingkatnya.');
        }
        if (bad.length) { bad[0].focus(); return false; }
        var rec = { id: item ? item.id : util.uid('k'), code: keepCode, name: name, level: q('mk-level').value, since: since, notes: item ? (item.notes || '') : '' };
        var list = item ? member.competencies.map(function (c) { return c.id === item.id ? rec : c; }) : member.competencies.concat([rec]);
        return saveMemberNow({ competencies: list }).then(function () {
          renderKomp();
          ui.toast(editing ? 'Kompetensi diperbarui.' : 'Kompetensi ditambahkan.', { type: 'success' });
          setTimeout(function () { focusEl(root.querySelector('[data-action="komp-edit"][data-id="' + cssEsc(rec.id) + '"]') || root.querySelector('[data-action="komp-add"]')); }, 60);
          return true;
        });
      }
      ui.modal({
        title: editing ? 'Ubah kompetensi' : 'Tambah kompetensi', eyebrow: 'Kompetensi & keahlian', size: 'md', cls: 'daf-modal', body: body,
        actions: [{ label: 'Batal', variant: 'ghost' }, { label: editing ? 'Simpan perubahan' : 'Tambahkan', variant: 'primary', onClick: function () { return submit(); } }],
        onOpen: function (m) {
          el = m;
          sync();
          q('mk-kode').addEventListener('change', function () { setError(q('mk-kode'), ''); sync(); if (q('mk-kode').value === '__lain') q('mk-nama').focus(); });
          q('mk-level').addEventListener('change', sync);
          q('mk-nama').addEventListener('input', function () { setError(q('mk-nama'), ''); });
          q('mk-since').addEventListener('input', function () { setError(q('mk-since'), ''); });
          q('mk-form').addEventListener('submit', function (e) { e.preventDefault(); var b = m.querySelectorAll('.modal__footer .btn'); if (b.length) b[b.length - 1].click(); });
        }
      });
    }
    function openCertModal(item) {
      var editing = !!item;
      var dl = '<datalist id="mc-issuers">' + PENERBIT.map(function (p) { return '<option value="' + h(p) + '"></option>'; }).join('') + '</datalist>';
      var body = '<form class="form daf-mform" id="mc-form" novalidate>' +
        '<div class="field"><label class="field__label" for="mc-title">Nama sertifikat' + req() + '</label>' +
          '<input class="field__control" id="mc-title" type="text" maxlength="200" autocomplete="off" required placeholder="mis. Teknisi Perancah" value="' + h(item ? item.title : '') + '"></div>' +
        '<div class="form__row form__row--2">' +
          '<div class="field"><label class="field__label" for="mc-number">Nomor sertifikat <span class="opt">(opsional)</span></label>' +
            '<input class="field__control" id="mc-number" type="text" maxlength="120" autocomplete="off" value="' + h(item ? item.number : '') + '"></div>' +
          '<div class="field"><label class="field__label" for="mc-issuer">Penerbit <span class="opt">(opsional)</span></label>' +
            '<input class="field__control" id="mc-issuer" type="text" maxlength="200" autocomplete="off" list="mc-issuers" value="' + h(item ? item.issuer : '') + '">' + dl + '</div>' +
        '</div>' +
        '<div class="form__row form__row--2">' +
          '<div class="field"><label class="field__label" for="mc-issued">Tanggal terbit <span class="opt">(opsional)</span></label>' +
            '<input class="field__control" id="mc-issued" type="date" max="' + h(util.todayIso()) + '" value="' + h(item ? item.issuedAt : '') + '"></div>' +
          '<div class="field"><label class="field__label" for="mc-expires">Berlaku hingga <span class="opt">(opsional)</span></label>' +
            '<input class="field__control" id="mc-expires" type="date" aria-describedby="mc-expires-hint" value="' + h(item ? item.expiresAt : '') + '">' +
            '<p class="field__hint" id="mc-expires-hint">Kosongkan bila sertifikat tidak memiliki masa berlaku.</p></div>' +
        '</div>' +
        '<div class="field"><label class="field__label" for="mc-link">Tautan dokumen <span class="opt">(opsional)</span></label>' +
          '<div class="input-icon">' + icon('link', { size: 18 }) + '<input class="field__control" id="mc-link" type="url" inputmode="url" maxlength="1000" autocomplete="off" placeholder="https://drive.google.com/…" value="' + h(item ? item.link : '') + '"></div></div>' +
        '<button type="submit" hidden tabindex="-1" aria-hidden="true"></button></form>';
      var el = null;
      function q(id) { return el ? el.querySelector('#' + id) : null; }
      function submit() {
        var title = q('mc-title').value.trim().replace(/\s+/g, ' ');
        var issued = q('mc-issued').value, expires = q('mc-expires').value;
        var link = fixUrl(q('mc-link').value);
        var bad = [];
        function chk(c, m) { setError(c, m); if (m) bad.push(c); }
        chk(q('mc-title'), title.length < 3 ? 'Isi nama sertifikat (minimal 3 karakter).' : '');
        chk(q('mc-issued'), q('mc-issued').validity.badInput || (issued && issued > util.todayIso()) ? 'Tanggal terbit tidak valid.' : '');
        chk(q('mc-expires'), q('mc-expires').validity.badInput || (expires && issued && expires < issued) ? 'Tanggal berlaku harus setelah tanggal terbit.' : '');
        chk(q('mc-link'), link && !isHttp(link) ? 'Tautan harus diawali https://.' : '');
        if (bad.length) { bad[0].focus(); return false; }
        var rec = { id: item ? item.id : util.uid('c'), title: title, number: q('mc-number').value.trim(), issuer: q('mc-issuer').value.trim(), issuedAt: issued, expiresAt: expires, link: link };
        var list = item ? member.certificates.map(function (c) { return c.id === item.id ? rec : c; }) : member.certificates.concat([rec]);
        return saveMemberNow({ certificates: list }).then(function () {
          renderKomp();
          ui.toast(editing ? 'Sertifikat diperbarui.' : 'Sertifikat ditambahkan.', { type: 'success' });
          setTimeout(function () { focusEl(root.querySelector('[data-action="cert-edit"][data-id="' + cssEsc(rec.id) + '"]') || root.querySelector('[data-action="cert-add"]')); }, 60);
          return true;
        });
      }
      ui.modal({
        title: editing ? 'Ubah sertifikat' : 'Tambah sertifikat', eyebrow: 'Sertifikat & lisensi', size: 'md', cls: 'daf-modal', body: body,
        actions: [{ label: 'Batal', variant: 'ghost' }, { label: editing ? 'Simpan perubahan' : 'Tambahkan', variant: 'primary', onClick: function () { return submit(); } }],
        onOpen: function (m) {
          el = m;
          ['mc-title', 'mc-issued', 'mc-expires', 'mc-link'].forEach(function (id) { q(id).addEventListener('input', function () { setError(q(id), ''); }); });
          q('mc-link').addEventListener('blur', function () { var f = fixUrl(q('mc-link').value); if (f !== q('mc-link').value.trim()) q('mc-link').value = f; });
          q('mc-form').addEventListener('submit', function (e) { e.preventDefault(); var b = m.querySelectorAll('.modal__footer .btn'); if (b.length) b[b.length - 1].click(); });
        }
      });
    }
    async function deleteItem(kind, id) {
      var isK = kind === 'komp';
      var list = isK ? member.competencies : member.certificates;
      var it = list.filter(function (x) { return x.id === id; })[0];
      if (!it) return;
      var label = isK ? (it.name || 'tanpa nama') : (it.title || 'tanpa nama');
      var ok = await ui.confirm((isK ? 'Kompetensi' : 'Sertifikat') + ' “' + label + '” akan dihapus dari data keanggotaan Anda.', {
        title: isK ? 'Hapus kompetensi?' : 'Hapus sertifikat?', okLabel: 'Hapus', cancelLabel: 'Batal', danger: true
      });
      if (!ok) return;
      try {
        var patch = {};
        patch[isK ? 'competencies' : 'certificates'] = list.filter(function (x) { return x.id !== id; });
        await saveMemberNow(patch);
        renderKomp();
        ui.toast((isK ? 'Kompetensi' : 'Sertifikat') + ' dihapus.', { type: 'success' });
        focusEl(root.querySelector('[data-action="' + (isK ? 'komp-add' : 'cert-add') + '"]'));
      } catch (err) {
        ui.toast(errMsg(err, 'Data gagal dihapus. Silakan coba lagi.'), { type: 'error' });
      }
    }

    /* ==================================================================
       8. REVIEW / SUMMARY
       ================================================================== */
    function val(v, required) {
      var s = v === null || v === undefined ? '' : String(v).trim();
      if (s) return h(s);
      return required ? '<span class="daf-miss daf-miss--req">Belum diisi</span>' : '<span class="daf-miss">—</span>';
    }
    function kvRow(label, html) { return '<div class="kv__row"><dt>' + h(label) + '</dt><dd>' + html + '</dd></div>'; }
    function sumGroup(n, key, title, inner, editable, flagged) {
      return '<section class="daf-sum' + (flagged ? ' is-flagged' : '') + '" aria-labelledby="sum-' + key + '">' +
        '<header class="daf-sum__head"><h3 class="daf-sum__title" id="sum-' + key + '"><span class="daf-sum__num">' + pad(n) + '</span><span>' + h(title) + '</span></h3>' +
          '<span class="daf-sum__aside">' + (flagged ? '<span class="badge badge--warn">Belum lengkap</span>' : '') +
          (editable ? '<button type="button" class="btn btn--link btn--sm daf-sum__edit" data-goto="' + key + '"><span>Ubah</span><span class="sr-only"> ' + h(title) + '</span>' + icon('edit', { size: 16, cls: 'btn__icon' }) + '</button>' : '') +
          '</span></header>' + inner + '</section>';
    }
    function summaryHtml(m, editable) {
      var a = m.application, p = m.profile, miss = {};
      store.applicationMissing(m).forEach(function (x) { miss[x.key] = true; miss['step:' + x.step] = true; });
      var out = '';
      /* 1 kategori */
      out += sumGroup(1, 'kategori', 'Kategori keanggotaan', '<dl class="kv">' +
        kvRow('Kategori', a.kategori && !(editable && miss.kategori) ? '<strong>' + h(a.kategori) + '</strong>' : val('', true)) +
        kvRow('Jenis pengajuan', h(a.type === 'perpanjangan' ? 'Perpanjangan keanggotaan' : 'Pendaftaran anggota baru')) + '</dl>', editable, miss['step:kategori']);
      /* 2 data diri */
      var phone = m.phone ? (util.normalizePhoneID(m.phone) ? util.formatPhoneID(util.normalizePhoneID(m.phone)) : m.phone) : '';
      var photo = a.pasFoto
        ? '<img class="daf-sum__photo" src="' + h(a.pasFoto) + '" alt="Pas foto pemohon" width="96" height="128">'
        : '<span class="daf-sum__photo daf-sum__photo--empty" role="img" aria-label="Tanpa pas foto">' + icon('user', { size: 28 }) + '</span>';
      out += sumGroup(2, 'data-diri', 'Data diri', '<div class="daf-sum__person">' + photo + '<dl class="kv">' +
        kvRow('Nama lengkap', val(m.name, true)) +
        kvRow('Tempat, tanggal lahir', [h(p.birthPlace || ''), p.birthDate ? h(fmtDate(p.birthDate)) : ''].filter(Boolean).join(', ') || val('', true)) +
        kvRow('Jenis kelamin', val(p.gender)) +
        kvRow('Domisili', [p.city, p.province].filter(Boolean).length ? h([p.city, p.province].filter(Boolean).join(', ')) + (miss.city || miss.province ? ' <span class="daf-miss daf-miss--req">belum lengkap</span>' : '') : val('', true)) +
        kvRow('Alamat', val(p.address)) +
        kvRow('Nomor HP', phone && !miss.phone ? h(phone) : val('', true)) +
        kvRow('Email', val(m.email || user.email)) +
        '</dl></div>', editable, miss['step:data-diri']);
      /* 3 profesional */
      var peng = a.pengalaman.length
        ? '<ol class="daf-sum-list">' + a.pengalaman.map(function (x) {
            return '<li><span class="daf-sum-list__title">' + h(x.proyek || 'Proyek') + '</span><span class="daf-sum-list__meta">' + h([x.peran, x.tahun, x.lokasi].filter(Boolean).join(' · ')) + '</span></li>';
          }).join('') + '</ol>'
        : val('', false);
      var exp = p.experienceYears === null || p.experienceYears === undefined ? '' : p.experienceYears + ' tahun';
      out += sumGroup(3, 'profesional', 'Data profesional', '<dl class="kv">' +
        kvRow('Perusahaan / instansi', val(p.company, true)) +
        kvRow('Jabatan', val(p.position, true)) +
        kvRow('Pendidikan terakhir', val(p.education)) +
        kvRow('Pengalaman', exp ? h(exp) : (miss.pengalaman ? val('', true) : val(''))) +
        kvRow('Riwayat proyek', peng) + '</dl>', editable, miss['step:profesional']);
      /* 4 kompetensi & sertifikat */
      var komp = m.competencies.length
        ? '<ul class="daf-sum-list">' + m.competencies.map(function (c) { return '<li><span class="daf-sum-list__title">' + h(c.name || 'Kompetensi') + '</span><span class="daf-sum-list__meta">' + h([c.level, c.since ? 'sejak ' + c.since : ''].filter(Boolean).join(' · ')) + '</span></li>'; }).join('') + '</ul>'
        : val('');
      var cert = m.certificates.length
        ? '<ul class="daf-sum-list">' + m.certificates.map(function (c) {
            var s = util.certStatus(c.expiresAt);
            return '<li><span class="daf-sum-list__title">' + h(c.title || 'Sertifikat') + ' <span class="badge badge--' + h(s.tone) + '">' + h(s.label) + '</span></span><span class="daf-sum-list__meta">' + h([c.issuer, c.number ? 'No. ' + c.number : '', c.expiresAt ? 'berlaku hingga ' + fmtDate(c.expiresAt, true) : ''].filter(Boolean).join(' · ')) + '</span></li>';
          }).join('') + '</ul>'
        : val('');
      out += sumGroup(4, 'kompetensi', 'Kompetensi & sertifikat', '<dl class="kv">' + kvRow('Kompetensi', komp) + kvRow('Sertifikat', cert) + '</dl>', editable, false);
      /* 5 dokumen */
      var docs = a.dokumen.length
        ? '<ul class="daf-sum-list">' + a.dokumen.map(function (x) {
            var label = x.label || x.jenis || 'Dokumen';
            return '<li><span class="daf-sum-list__title">' + (x.url ? '<a class="link" href="' + h(x.url) + '" target="_blank" rel="noopener noreferrer">' + h(label) + '<span class="sr-only"> (tab baru)</span></a>' : h(label) + ' <span class="daf-miss daf-miss--req">tautan belum valid</span>') + '</span>' +
              '<span class="daf-sum-list__meta">' + h(x.jenis) + (x.url ? ' · ' + h(prettyUrl(x.url).slice(0, 48)) + (prettyUrl(x.url).length > 48 ? '…' : '') : '') + '</span></li>';
          }).join('') + '</ul>'
        : val('');
      var payRows = '';
      if (IURAN) {
        payRows = kvRow('Bukti pembayaran', a.pembayaran.buktiUrl ? '<a class="link" href="' + h(a.pembayaran.buktiUrl) + '" target="_blank" rel="noopener noreferrer">Lihat bukti<span class="sr-only"> (tab baru)</span></a>' : val('', true)) +
          kvRow('Metode / tanggal', val([a.pembayaran.metode, a.pembayaran.tanggal ? fmtDate(a.pembayaran.tanggal) : ''].filter(Boolean).join(' · ')));
      }
      out += sumGroup(5, 'dokumen', 'Dokumen pendukung', '<dl class="kv">' + kvRow('Dokumen', docs) + payRows + kvRow('Catatan', a.catatan ? '<span class="daf-pre">' + h(a.catatan) + '</span>' : val('')) + '</dl>', editable, miss['step:dokumen']);
      /* 6 pernyataan */
      function yes(ok) { return ok ? '<span class="daf-yes">' + icon('check', { size: 16 }) + 'Disetujui</span>' : '<span class="daf-miss daf-miss--req">Belum disetujui</span>'; }
      out += sumGroup(6, 'pernyataan', 'Pernyataan', '<dl class="kv">' +
        kvRow('Kode Etik & AD/ART', yes(a.pernyataan.kodeEtik)) +
        kvRow('Kebenaran data', yes(a.pernyataan.kebenaranData)) +
        kvRow('Kebijakan Privasi', yes(a.pernyataan.privasi)) +
        kvRow('Nama terang', a.pernyataan.namaTerang ? '<span class="daf-sum__sign">' + h(a.pernyataan.namaTerang) + '</span>' : val('', true)) +
        kvRow('Tanggal pernyataan', val(a.pernyataan.tanggal ? fmtDate(a.pernyataan.tanggal) : (editable ? fmtDate(util.todayIso()) + ' (saat diajukan)' : ''))) +
        '</dl>', editable, miss['step:pernyataan']);
      return out;
    }
    function renderReview(submitErr) {
      var host = $('#daf-review');
      if (!host) return;
      var miss = missingAll();
      var head;
      if (submitErr) {
        head = submitErr;
      } else if (miss.length) {
        head = '<div class="alert alert--warn daf-review__state">' + icon('alert-triangle') + '<div><p class="alert__title">Formulir belum lengkap — ' + miss.length + ' isian wajib belum diisi</p>' +
          '<ul class="daf-missing">' + miss.map(function (x) {
            var step = STEPS.filter(function (s) { return s.key === x.step; })[0];
            return '<li><button type="button" class="daf-missing__btn" data-fix="' + h(x.key) + '" data-fix-step="' + h(x.step) + '">' + icon('arrow-right', { size: 14 }) + '<span>' + h(x.label) + '</span><span class="daf-missing__step">' + h(step ? step.label : '') + '</span></button></li>';
          }).join('') + '</ul></div></div>';
      } else {
        head = '<div class="alert alert--ok daf-review__state">' + icon('check-circle') + '<div><p class="alert__title">Formulir siap diajukan</p>' +
          '<p>Seluruh isian wajib telah lengkap. Periksa ringkasan di bawah, lalu pilih <strong>' + h(submitLabel()) + '</strong>.</p></div></div>';
      }
      var early = st() === 'Aktif'
        ? '<div class="alert alert--warn">' + icon('lock') + '<div><p class="alert__title">Fitur anggota dikunci selama verifikasi</p><p>Setelah perpanjangan diajukan, status Anda menjadi Menunggu Verifikasi sehingga KTA digital, Produk Pengetahuan, dan aplikasi anggota tidak dapat diakses sampai sekretariat menyetujuinya.</p></div></div>'
        : '';
      host.innerHTML = '<div class="daf-review__top" id="daf-review-top" tabindex="-1">' + head + '</div>' + early +
        '<div class="daf-sums">' + summaryHtml(member, true) + '</div>' +
        '<div class="daf-review__confirm">' + icon('send', { size: 20 }) +
          '<p>Dengan memilih <strong>' + h(submitLabel()) + '</strong>, data Anda dikirim ke sekretariat untuk diverifikasi. Selama verifikasi, formulir tidak dapat diubah kecuali pengajuan ditarik kembali.</p></div>';
    }

    /* ==================================================================
       9. SUBMIT / WITHDRAW
       ================================================================== */
    async function submit(btn) {
      readAll();
      await flushNow();
      try { await S.chain; } catch (e) { /* surfaced below */ }
      if (S.saveError) {
        ui.toast('Masih ada perubahan yang belum tersimpan. Pilih “Coba lagi”, lalu ajukan kembali.', { type: 'error' });
        return;
      }
      if (st() === 'Aktif') {
        var ok = await ui.confirm('Selama perpanjangan diverifikasi, status Anda menjadi Menunggu Verifikasi dan fitur anggota dikunci sementara. Bila nanti ditarik, status menjadi Draf. Lanjutkan pengajuan perpanjangan?', {
          title: 'Ajukan perpanjangan sekarang?', okLabel: 'Ya, ajukan', cancelLabel: 'Batal'
        });
        if (!ok) return;
      }
      ui.setLoading(btn, true, 'Mengirim…');
      try {
        member = await store.submitApplication(user.uid);
        S.justSubmitted = true;
        S.forceRenew = false;
        S.flagged = {};
        try { if (w.history && w.history.replaceState) w.history.replaceState(null, '', w.location.pathname + w.location.search); } catch (e) { /* ignore */ }
        render();
        ui.toast('Pengajuan berhasil dikirim ke sekretariat.', { type: 'success' });
        w.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
        focusEl($('#daf-done-title'));
      } catch (err) {
        ui.setLoading(btn, false);
        if (err && err.code === 'store/application-incomplete') {
          var fields = Array.isArray(err.fields) ? err.fields : [];
          fields.forEach(function (f) { S.flagged[f.step] = true; });
          updateStepper();
          var html = '<div class="alert alert--err daf-review__state" role="alert">' + icon('alert-triangle') + '<div><p class="alert__title">Pengajuan belum dapat dikirim</p>' +
            '<p>Lengkapi ' + fields.length + ' isian berikut terlebih dahulu:</p>' +
            '<ul class="daf-missing">' + fields.map(function (x) {
              var step = STEPS.filter(function (s) { return s.key === x.step; })[0];
              return '<li><button type="button" class="daf-missing__btn" data-fix="' + h(x.key) + '" data-fix-step="' + h(x.step) + '">' + icon('arrow-right', { size: 14 }) + '<span>' + h(x.label) + '</span><span class="daf-missing__step">' + h(step ? step.label : '') + '</span></button></li>';
            }).join('') + '</ul></div></div>';
          renderReview(html);
          var top = $('#daf-review-top');
          scrollToEl(top, 24);
          focusEl(top);
        } else {
          ui.toast(errMsg(err, 'Pengajuan gagal dikirim. Silakan coba lagi.'), { type: 'error' });
        }
      }
    }
    async function withdraw(btn) {
      var renewal = member.application.type === 'perpanjangan';
      var msg = renewal
        ? 'Pengajuan perpanjangan akan ditarik dari antrean verifikasi dan status keanggotaan Anda menjadi Draf — bukan kembali Aktif. Fitur anggota tetap terkunci sampai perpanjangan diajukan kembali dan disetujui sekretariat.'
        : 'Pengajuan akan ditarik dari antrean verifikasi dan kembali berstatus Draf. Anda dapat mengubah data, lalu mengajukannya kembali.';
      var ok = await ui.confirm(msg, { title: 'Tarik pengajuan?', okLabel: 'Tarik pengajuan', cancelLabel: 'Batal', danger: true });
      if (!ok) return;
      ui.setLoading(btn, true, 'Menarik…');
      try {
        member = await store.withdrawApplication(user.uid);
        S.justSubmitted = false;
        S.visited = {};
        render({ step: STEPS.length - 1, focus: true });
        ui.toast('Pengajuan ditarik. Status kembali Draf — ubah data yang diperlukan, lalu ajukan kembali.', { type: 'success' });
      } catch (err) {
        ui.setLoading(btn, false);
        ui.toast(errMsg(err, 'Pengajuan gagal ditarik. Silakan coba lagi.'), { type: 'error' });
      }
    }

    /* ==================================================================
       10. PENDING VIEW (Menunggu Verifikasi)
       ================================================================== */
    function trackHtml() {
      var a = member.application, renewal = a.type === 'perpanjangan';
      var steps = renewal ? [
        ['is-done', 'Keanggotaan sebelumnya', member.validUntil ? 'Berlaku hingga ' + fmtDate(member.validUntil, true) : (member.kta || 'Tercatat')],
        ['is-done', 'Perpanjangan diajukan', fmtDate(a.submittedAt, true)],
        ['is-current', 'Verifikasi sekretariat', 'Sedang diperiksa'],
        ['', 'Aktif kembali', 'Menunggu persetujuan']
      ] : [
        ['is-done', 'Akun dibuat', fmtDate(member.createdAt || member.joinedAt, true)],
        ['is-done', 'Formulir diajukan', fmtDate(a.submittedAt, true)],
        ['is-current', 'Verifikasi sekretariat', 'Sedang diperiksa'],
        ['', 'Aktif & KTA digital', 'Menunggu persetujuan']
      ];
      return '<ol class="status-track daf-track" aria-label="Tahapan pengajuan">' + steps.map(function (s) {
        return '<li class="status-track__step ' + s[0] + '"' + (s[0] === 'is-current' ? ' aria-current="step"' : '') + '><span class="status-track__node" aria-hidden="true"></span>' +
          '<span class="status-track__label">' + h(s[1]) + '</span><span class="status-track__meta">' + h(s[2] || '—') + '</span></li>';
      }).join('') + '</ol>';
    }
    function historyHtml() {
      var labels = { diajukan: 'Pengajuan dikirim', ditarik: 'Pengajuan ditarik', perbaikan: 'Diminta perbaikan', disetujui: 'Disetujui', ditolak: 'Ditolak', dinonaktifkan: 'Dinonaktifkan', diaktifkan: 'Diaktifkan kembali', diperpanjang: 'Masa berlaku diperpanjang', 'kategori-diubah': 'Kategori diubah' };
      var list = ((member.review && member.review.history) || []).slice().reverse().slice(0, 8);
      if (!list.length) return '';
      return '<div class="daf-card daf-history"><h2 class="daf-card__title">Riwayat pengajuan</h2><ol class="daf-hist">' + list.map(function (x) {
        return '<li class="daf-hist__item"><span class="daf-hist__when">' + h(fmtDate(x.at, true) || '—') + '</span><span class="daf-hist__what">' + h(labels[x.action] || x.action) + '</span>' +
          (x.note ? '<span class="daf-hist__note">' + h(x.note) + '</span>' : '') + '</li>';
      }).join('') + '</ol></div>';
    }
    function renderPending() {
      var a = member.application, renewal = a.type === 'perpanjangan';
      var first = (user.name || member.name || '').split(' ')[0];
      var done = S.justSubmitted
        ? '<div class="daf-done theme-dark" data-reveal>' +
            '<span class="daf-done__icon" aria-hidden="true">' + icon('check', { size: 30 }) + '</span>' +
            '<div class="daf-done__body"><p class="eyebrow">Pengajuan terkirim</p>' +
              '<h2 class="daf-done__title" id="daf-done-title" tabindex="-1">Terima kasih' + (first ? ', ' + h(first) : '') + '. Pengajuan Anda telah kami terima.</h2>' +
              '<p class="daf-done__text">' + (renewal ? 'Pengajuan perpanjangan' : 'Formulir pendaftaran') + ' diterima pada ' + h(fmtDate(a.submittedAt)) + '. Sekretariat akan memverifikasi data Anda; perkembangan status dapat dipantau di halaman ini dan di Dasbor.</p></div>' +
          '</div>'
        : '';
      root.innerHTML = done +
        '<div class="daf-pending">' +
          '<div class="daf-pending__main">' +
            '<section class="daf-card daf-statuscard" aria-labelledby="daf-st-title" data-reveal>' +
              '<div class="daf-statuscard__head"><div><p class="daf-card__eyebrow">Status pengajuan</p>' +
                '<h2 class="daf-card__title" id="daf-st-title">Sedang diverifikasi sekretariat</h2></div>' + util.statusBadge('Menunggu Verifikasi') + '</div>' +
              '<dl class="kv daf-statuscard__kv">' +
                kvRow('Jenis pengajuan', h(renewal ? 'Perpanjangan keanggotaan' : 'Pendaftaran anggota baru')) +
                kvRow('Kategori', val(a.kategori)) +
                kvRow('Diajukan', h(a.submittedAt ? util.formatDate(a.submittedAt, { weekday: true }) + ', pukul ' + nowTime(util.parseDate(a.submittedAt)) : '—')) +
              '</dl>' + trackHtml() +
            '</section>' +
            '<section class="daf-card daf-summary" aria-labelledby="daf-sum-title">' +
              '<h2 class="daf-card__title" id="daf-sum-title">Ringkasan pengajuan</h2>' +
              '<p class="daf-card__lead">Data berikut terkunci selama verifikasi. Tarik pengajuan bila ada yang perlu diubah.</p>' +
              '<div class="daf-sums">' + summaryHtml(member, false) + '</div>' +
            '</section>' +
          '</div>' +
          '<div class="daf-pending__aside">' +
            '<div class="daf-card daf-next">' +
              '<h2 class="daf-card__title">Langkah berikutnya</h2>' +
              '<ol class="daf-steps-list">' +
                '<li>Sekretariat memeriksa kelengkapan dan keabsahan data Anda.</li>' +
                '<li>Bila ada yang perlu dilengkapi, status berubah menjadi <strong>Perlu Perbaikan</strong> beserta catatannya.</li>' +
                '<li>Setelah disetujui, status menjadi <strong>Aktif</strong>' + (renewal ? ' dengan masa berlaku baru.' : ', KTA digital terbit, dan fitur anggota terbuka.') + '</li>' +
              '</ol>' +
              '<a class="btn btn--primary btn--block" href="dashboard.html"><span>Ke Dasbor</span>' + icon('arrow-right', { size: 18, cls: 'btn__icon' }) + '</a>' +
            '</div>' +
            '<div class="daf-card daf-withdraw">' +
              '<h2 class="daf-card__title">Perlu mengubah data?</h2>' +
              '<p>Tarik pengajuan untuk membuka kembali formulir. ' + (renewal ? 'Status keanggotaan Anda akan menjadi <strong>Draf</strong> — bukan kembali Aktif — sampai perpanjangan diajukan ulang dan disetujui.' : 'Status kembali menjadi Draf, dan Anda perlu mengajukannya ulang setelah selesai mengubah data.') + '</p>' +
              '<button type="button" class="btn btn--ghost btn--block" data-action="withdraw">' + icon('refresh', { size: 18 }) + '<span>Tarik pengajuan</span></button>' +
            '</div>' +
            historyHtml() +
            '<p class="daf-aside-help">Ada pertanyaan? <a class="link" href="umpan-balik.html?kategori=Pertanyaan">Hubungi sekretariat</a></p>' +
          '</div>' +
        '</div>';
    }

    /* ==================================================================
       11. ACTIVE VIEW
       ================================================================== */
    function renderActive() {
      var days = util.validityDays(member);
      var renew = util.canRenew(member);
      var first = (user.name || member.name || '').split(' ')[0];
      var links = [
        ['id-card', 'Kartu Tanda Anggota', 'KTA digital dengan kode QR, siap ditunjukkan atau dicetak.', 'anggota.html#kartu'],
        ['book', 'Produk Pengetahuan', 'Standar, Code of Practice, petunjuk teknis, dan modul pelatihan.', 'pustaka.html'],
        ['compass', 'Aplikasi Anggota', 'Perencanaan & analisis struktur serta simulator pemasangan.', 'anggota.html#aplikasi'],
        ['grid', 'Dasbor Anggota', 'Agenda, pengumuman, dan pengingat masa berlaku sertifikat.', 'dashboard.html']
      ];
      root.innerHTML =
        '<div class="daf-active">' +
          '<section class="daf-member theme-dark" aria-labelledby="daf-member-title" data-reveal>' +
            '<div data-scaffold data-cols="8" data-rows="3" data-braces="false"></div>' +
            '<div class="daf-member__inner">' +
              '<div class="daf-member__text">' +
                '<p class="eyebrow">Anggota aktif PPAPI</p>' +
                '<h2 class="daf-member__title" id="daf-member-title">Anda sudah menjadi anggota <em>aktif</em>' + (first ? ', ' + h(first) : '') + '.</h2>' +
                '<p class="daf-member__lead">Formulir pendaftaran tidak perlu diisi lagi. Perbarui data profil, kompetensi, dan sertifikat melalui Profil Anggota.</p>' +
                '<div class="daf-member__actions">' +
                  '<a class="btn btn--primary" href="anggota.html#kartu"><span>Lihat Kartu Anggota</span>' + icon('arrow-right', { size: 18, cls: 'btn__icon' }) + '</a>' +
                  '<a class="btn btn--ghost" href="anggota.html#profil"><span>Profil Anggota</span></a>' +
                '</div>' +
              '</div>' +
              '<dl class="daf-member__facts">' +
                '<div class="daf-member__fact daf-member__fact--kta"><dt>Nomor KTA</dt><dd>' + h(member.kta || '—') + '</dd></div>' +
                '<div class="daf-member__fact"><dt>Kategori</dt><dd>' + h(member.memberType || '—') + '</dd></div>' +
                '<div class="daf-member__fact"><dt>Anggota sejak</dt><dd>' + h(fmtDate(member.joinedAt) || '—') + '</dd></div>' +
                '<div class="daf-member__fact"><dt>Berlaku hingga</dt><dd>' + h(member.validUntil ? fmtDate(member.validUntil) : 'Belum ditetapkan') +
                  (days !== null && days >= 0 ? '<span class="daf-member__days">' + (days === 0 ? 'berakhir hari ini' : nDays(days) + ' lagi') + '</span>' : '') + '</dd></div>' +
              '</dl>' +
            '</div>' +
          '</section>' +
          (renew
            ? '<div class="daf-note daf-note--warn daf-renew" role="note"><span class="daf-note__icon">' + icon('clock', { size: 20 }) + '</span><div class="daf-note__body">' +
                '<p class="daf-note__eyebrow">Masa berlaku segera berakhir</p>' +
                '<p class="daf-note__title">Keanggotaan Anda berakhir ' + (days === 0 ? 'hari ini' : 'dalam ' + nDays(days)) + '</p>' +
                '<p class="daf-note__text">Anda dapat mengajukan perpanjangan sekarang. Selama perpanjangan diverifikasi, fitur anggota dikunci sementara; sebagai alternatif, sekretariat dapat memperpanjang masa berlaku secara langsung.</p>' +
                '<div class="daf-note__actions"><button type="button" class="btn btn--primary btn--sm" data-action="start-renew"><span>Ajukan perpanjangan</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</button>' +
                '<a class="btn btn--link btn--sm" href="umpan-balik.html?kategori=Pertanyaan"><span>Hubungi sekretariat</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a></div>' +
              '</div></div>'
            : '') +
          '<div class="daf-links" data-reveal-stagger>' + links.map(function (l) {
            return '<a class="daf-link" href="' + h(l[3]) + '"><span class="daf-link__icon" aria-hidden="true">' + icon(l[0], { size: 22 }) + '</span>' +
              '<span class="daf-link__title">' + h(l[1]) + '</span><span class="daf-link__text">' + h(l[2]) + '</span>' +
              '<span class="daf-link__go" aria-hidden="true">' + icon('arrow-right', { size: 18 }) + '</span></a>';
          }).join('') + '</div>' +
          (member.kta ? '<p class="daf-aside-help">Keabsahan keanggotaan Anda dapat diperiksa publik di <a class="link" href="verifikasi.html?kta=' + encodeURIComponent(member.kta) + '">halaman Verifikasi Anggota</a>.</p>' : '') +
        '</div>';
      try { if (w.location.hash && w.history && w.history.replaceState) w.history.replaceState(null, '', w.location.pathname + w.location.search); } catch (e) { /* ignore */ }
    }

    /* ==================================================================
       12. EVENTS (delegated on #daf-root)
       ================================================================== */
    root.addEventListener('input', function (e) {
      var el = e.target;
      if (el.closest('.field.is-invalid') || el.getAttribute('aria-invalid')) {
        if (el.type === 'radio' && el.name === 'kategori') setError($('#f-kategori'), '');
        else setError(el, '');
        pruneErrSum();
      }
      if (el.hasAttribute('data-rep')) {
        var kind = el.getAttribute('data-rep');
        if (kind === 'peng') {
          queueApp({ pengalaman: readPeng() });
          if (el.getAttribute('data-key') === 'proyek') {
            var t = el.closest('.daf-rep').querySelector('.daf-rep__title');
            if (t) t.textContent = el.value.trim() || 'Riwayat proyek';
          }
        } else {
          queueApp({ dokumen: readDok() });
          if (el.getAttribute('data-key') === 'label') {
            var t2 = el.closest('.daf-rep').querySelector('.daf-rep__title');
            if (t2) t2.textContent = el.value.trim() || 'Dokumen';
          }
        }
        return;
      }
      if (el.type === 'radio' || el.type === 'checkbox' || el.tagName === 'SELECT' || el.type === 'file') return; /* handled on change */
      onBind(el, false);
    });
    root.addEventListener('change', function (e) {
      var el = e.target;
      if (el.id === 'f-pasFoto') { onPhotoChosen(el); return; }
      if (el.hasAttribute('data-rep')) {
        if (el.getAttribute('data-rep') === 'dok') queueApp({ dokumen: readDok() });
        else queueApp({ pengalaman: readPeng() });
        if (el.tagName === 'SELECT') {
          var t = el.closest('.daf-rep').querySelector('.daf-rep__title'), lab = el.closest('.daf-rep').querySelector('[data-key="label"]');
          if (t && lab && !lab.value.trim()) t.textContent = el.value;
        }
        return;
      }
      if ((el.type === 'checkbox' || el.tagName === 'SELECT') && el.closest('.field.is-invalid')) { setError(el, ''); pruneErrSum(); }
      if (el.type === 'radio' && el.name === 'kategori') pruneErrSum();
      onBind(el, true);
    });
    root.addEventListener('focusout', function (e) {
      var el = e.target;
      if (!el || !el.matches || !el.matches('input, select, textarea')) return;
      if (el.id === 'f-phone') {
        var n = util.normalizePhoneID(el.value);
        if (n) el.value = phoneLocal(n);
      } else if (el.type === 'url') {
        var f = fixUrl(el.value);
        if (f !== el.value.trim()) {
          el.value = f;
          if (el.hasAttribute('data-rep')) queueApp({ dokumen: readDok() }); else onBind(el, true);
        }
      }
      if (S.view === 'wizard' && hasPending()) flushNow();
    });
    root.addEventListener('submit', function (e) {
      e.preventDefault();
      if (S.view === 'wizard') next();
    });
    root.addEventListener('click', function (e) {
      var t = e.target.closest('button, a');
      if (!t || !root.contains(t)) return;
      var nav = t.getAttribute('data-nav');
      if (nav === 'next') { next(); return; }
      if (nav === 'prev') { goStep(S.step - 1); return; }
      if (nav === 'submit') { submit(t); return; }
      if (t.hasAttribute('data-step')) { goStep(parseInt(t.getAttribute('data-step'), 10)); return; }
      if (t.hasAttribute('data-goto')) {
        var key = t.getAttribute('data-goto');
        STEPS.forEach(function (s, i) { if (s.key === key) goStep(i); });
        return;
      }
      if (t.hasAttribute('data-fix')) { jumpToField(t.getAttribute('data-fix'), t.getAttribute('data-fix-step')); return; }
      if (t.hasAttribute('data-err')) {
        var box = $('#daf-errsum'), it = box && box._list ? box._list[+t.getAttribute('data-err')] : null;
        if (it) { scrollToEl((it.el && it.el.closest('.field')) || it.el, 40); focusEl(it.focus || it.el); }
        return;
      }
      var act = t.getAttribute('data-action');
      if (!act) return;
      switch (act) {
        case 'peng-add':
          readPeng();
          if (S.peng.length >= LIMITS.pengalaman) return;
          var np = { id: util.uid('p'), proyek: '', peran: '', tahun: '', lokasi: '' };
          S.peng.push(np);
          renderPeng();
          setError($('#f-experienceYears'), '');
          focusEl(d.getElementById('peng-proyek-' + np.id));
          break;
        case 'dok-add':
          readDok();
          if (S.dok.length >= LIMITS.dokumen) return;
          var used = S.dok.map(function (x) { return x.jenis; });
          var jenis = ['CV', 'Sertifikat', 'Ijazah'].filter(function (j) { return used.indexOf(j) === -1; })[0] || 'Lainnya';
          var nd = { id: util.uid('d'), jenis: jenis, label: '', url: '' };
          S.dok.push(nd);
          renderDok();
          focusEl(d.getElementById('dok-jenis-' + nd.id));
          break;
        case 'peng-remove':
        case 'dok-remove':
          removeRow(act === 'peng-remove' ? 'peng' : 'dok', t.getAttribute('data-id'));
          break;
        case 'komp-add': openKompModal(null); break;
        case 'cert-add': openCertModal(null); break;
        case 'komp-edit': openKompModal(member.competencies.filter(function (x) { return x.id === t.getAttribute('data-id'); })[0] || null); break;
        case 'cert-edit': openCertModal(member.certificates.filter(function (x) { return x.id === t.getAttribute('data-id'); })[0] || null); break;
        case 'komp-delete': deleteItem('komp', t.getAttribute('data-id')); break;
        case 'cert-delete': deleteItem('cert', t.getAttribute('data-id')); break;
        case 'photo-remove':
          (async function () {
            var ok = await ui.confirm('Pas foto akan dihapus dari formulir pendaftaran Anda.', { title: 'Hapus pas foto?', okLabel: 'Hapus', danger: true });
            if (!ok) return;
            try {
              await enqueue(function () { return store.saveApplication(user.uid, { pasFoto: '' }); }, true);
              renderPhoto();
              ui.toast('Pas foto dihapus.', { type: 'success' });
              focusEl($('#f-pasFoto'));
            } catch (err) { ui.toast(errMsg(err, 'Pas foto gagal dihapus.'), { type: 'error' }); }
          })();
          break;
        case 'retry-save':
          S.saveError = null;
          if (hasPending()) flushNow(); else updateSave();
          break;
        case 'withdraw': withdraw(t); break;
        case 'start-renew':
          S.forceRenew = true;
          render({ step: 0, focus: true });
          break;
        case 'cancel-renew':
          S.forceRenew = false;
          render();
          scrollToEl($('#daf-root'));
          focusEl($('#daf-member-title'));
          break;
      }
    });
    async function removeRow(kind, id) {
      var list = kind === 'peng' ? S.peng : S.dok;
      if (kind === 'peng') readPeng(); else readDok();
      var idx = -1;
      list.forEach(function (x, i) { if (x.id === id) idx = i; });
      if (idx === -1) return;
      var x = list[idx];
      var filled = kind === 'peng' ? (x.proyek || x.peran || x.tahun || x.lokasi) : (x.label || x.url);
      if (filled) {
        var ok = await ui.confirm(kind === 'peng' ? 'Riwayat proyek “' + (x.proyek || 'tanpa nama') + '” akan dihapus.' : 'Dokumen “' + (x.label || x.jenis) + '” akan dihapus dari daftar.', {
          title: kind === 'peng' ? 'Hapus riwayat proyek?' : 'Hapus dokumen?', okLabel: 'Hapus', danger: true
        });
        if (!ok) return;
      }
      list.splice(idx, 1);
      if (kind === 'peng') { renderPeng(); queueApp({ pengalaman: readPeng() }); }
      else { renderDok(); queueApp({ dokumen: readDok() }); }
      flushNow();
      var rows = $$('#' + (kind === 'peng' ? 'peng' : 'dok') + '-list [data-action$="-remove"]', root);
      focusEl(rows[Math.min(idx, rows.length - 1)] || root.querySelector('[data-action="' + kind + '-add"]'));
    }

    w.addEventListener('hashchange', function () {
      var k = decodeURIComponent((w.location.hash || '').slice(1));
      if (k === 'perpanjangan' && S.view === 'active' && util.canRenew(member)) { S.forceRenew = true; render({ step: 0, focus: true }); return; }
      if (S.view !== 'wizard') return;
      STEPS.forEach(function (s, i) { if (s.key === k && i !== S.step) goStep(i); });
    });
    d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'hidden') flushNow(); });
    w.addEventListener('pagehide', function () { flushNow(); });
    w.addEventListener('beforeunload', function (e) {
      if (S.view !== 'wizard') return;
      var pending = hasPending() || S.saving > 0;
      if (pending) flushNow();
      /* Demo mode writes synchronously during the flush; with Firebase the network write may not finish */
      if (pending && auth.mode === 'firebase') { e.preventDefault(); e.returnValue = ''; }
    });

    render();
  });
})(window, document);
