/* ==========================================================================
   PPAPI — umpan-balik.js
   Halaman Kontak & Umpan Balik: formulir kritik & saran (PPAPI.store.submitFeedback),
   kartu Sekretariat dari PPAPI_CONFIG.contact, dan FAQ umum dari organisasi.faq.
   ========================================================================== */
(function () {
  'use strict';

  var KATEGORI_HINT = {
    Kritik: 'Sampaikan hal yang menurut Anda perlu diperbaiki dari layanan, kegiatan, atau situs PPAPI.',
    Saran: 'Bagikan gagasan untuk pengembangan program, layanan anggota, maupun organisasi.',
    Pertanyaan: 'Ajukan pertanyaan seputar keanggotaan, kegiatan, regulasi, atau layanan sekretariat.',
    Pengaduan: 'Laporkan kendala layanan atau hal yang memerlukan perhatian sekretariat. Uraikan kronologinya secara jelas.',
    Apresiasi: 'Sampaikan apresiasi atas layanan, kegiatan, atau kontribusi yang bermanfaat bagi Anda.'
  };
  var RATING_LABEL = ['Belum dinilai', 'Sangat kurang', 'Kurang', 'Cukup', 'Baik', 'Sangat baik'];
  var MSG_MIN = 10, MSG_MAX = 2000, SUBJ_MIN = 3, SUBJ_MAX = 150, NAME_MIN = 3;

  PPAPI.onReady(function () {
    var u = PPAPI.util, ui = PPAPI.ui, h = u.h, $ = u.$, $$ = u.$$, icon = PPAPI.icon;
    var cfg = PPAPI.config || {};

    function clean(v) { return v === null || v === undefined ? '' : String(v).trim(); }
    function reduced() { return PPAPI.motion && PPAPI.motion.prefersReduced ? PPAPI.motion.prefersReduced() : false; }

    /* ------------------------------------------------------------------
       Kontak dari config (hanya nilai yang terisi yang ditampilkan)
       ------------------------------------------------------------------ */
    var ct = cfg.contact || {};
    var C = {
      address: clean(ct.address),
      city: clean(ct.city),
      mapsQuery: clean(ct.mapsQuery),
      phone: clean(ct.phone),
      whatsapp: clean(ct.whatsapp),
      email: clean(ct.email),
      hours: (Array.isArray(ct.hours) ? ct.hours : []).filter(function (x) { return x && (clean(x.hari) || clean(x.jam)); })
    };
    if (C.email && !u.isEmail(C.email)) C.email = '';

    function waDigits(v) {
      var n = u.normalizePhoneID(v);
      if (n) return n.slice(1);
      var d = String(v || '').replace(/\D/g, '');
      if (d.charAt(0) === '0') d = '62' + d.slice(1);
      return d.length >= 8 ? d : '';
    }
    var WA = C.whatsapp ? waDigits(C.whatsapp) : '';
    var waLabel = C.whatsapp ? (u.normalizePhoneID(C.whatsapp) ? u.formatPhoneID(C.whatsapp) : C.whatsapp) : '';

    /* ---------- Kartu Sekretariat ---------- */
    function officeRow(ic, label, valueHtml, extraCls) {
      return '<li class="ub-office__row">' +
        '<span class="ub-office__ico" aria-hidden="true">' + icon(ic, { size: 18 }) + '</span>' +
        '<div><p class="ub-office__label">' + h(label) + '</p><div class="ub-office__value' + (extraCls ? ' ' + extraCls : '') + '">' + valueHtml + '</div></div>' +
        '</li>';
    }

    function mapHtml() {
      if (C.mapsQuery) {
        var q = encodeURIComponent(C.mapsQuery);
        return '<figure class="ub-map ub-map--live">' +
          '<iframe src="https://www.google.com/maps?q=' + q + '&amp;output=embed" title="Peta lokasi Sekretariat PPAPI" loading="lazy" referrerpolicy="no-referrer-when-downgrade" allowfullscreen></iframe>' +
          '<figcaption class="ub-map__caption"><a class="btn btn--link btn--sm" href="https://www.google.com/maps/search/?api=1&amp;query=' + q + '" target="_blank" rel="noopener"><span>Buka di Google Maps</span>' +
          icon('arrow-up-right', { size: 16, cls: 'btn__icon' }) + '<span class="sr-only"> (tab baru)</span></a></figcaption>' +
          '</figure>';
      }
      return '<figure class="ub-map ub-map--placeholder">' +
        '<div class="ub-map__canvas" aria-hidden="true">' +
          '<span class="ub-map__road ub-map__road--a"></span><span class="ub-map__road ub-map__road--b"></span>' +
          '<span class="ub-map__road ub-map__road--c"></span><span class="ub-map__block ub-map__block--a"></span>' +
          '<span class="ub-map__block ub-map__block--b"></span><span class="ub-map__block ub-map__block--c"></span>' +
          '<span class="ub-map__north">' + icon('compass', { size: 16 }) + 'U</span>' +
          '<span class="ub-map__pin"><span class="ub-map__pulse"></span>' + icon('map-pin', { size: 22 }) + '</span>' +
        '</div>' +
        '<figcaption class="ub-map__caption ub-map__caption--overlay"><span class="ub-map__eyebrow">Peta lokasi</span>' +
          '<span>Ditampilkan setelah alamat sekretariat ditetapkan.</span></figcaption>' +
        '</figure>';
    }

    function socialHtml() {
      var s = cfg.social || {};
      var names = { instagram: 'Instagram', linkedin: 'LinkedIn', youtube: 'YouTube', facebook: 'Facebook' };
      var links = Object.keys(names).filter(function (k) { return /^https?:\/\//i.test(clean(s[k])); }).map(function (k) {
        return '<a class="icon-btn icon-btn--round" href="' + h(clean(s[k])) + '" target="_blank" rel="noopener" aria-label="' + names[k] + ' PPAPI (tab baru)">' + icon(k, { size: 18 }) + '</a>';
      });
      return links.length ? '<div class="ub-office__social"><p class="ub-office__label">Media sosial</p><div class="cluster">' + links.join('') + '</div></div>' : '';
    }

    function renderOffice() {
      var host = $('[data-ub-office]');
      if (!host) return;
      var rows = [];
      if (C.address || C.city) {
        rows.push(officeRow('map-pin', 'Alamat', '<p>' + h(C.address) + (C.address && C.city ? '<br>' : '') + h(C.city) + '</p>'));
      } else {
        rows.push(officeRow('map-pin', 'Alamat', '<p>Alamat sekretariat akan segera diperbarui.</p>', 'ub-office__value--fallback'));
      }
      if (C.phone) rows.push(officeRow('phone', 'Telepon', '<a href="tel:' + h(C.phone.replace(/[^\d+]/g, '')) + '">' + h(C.phone) + '</a>'));
      if (WA) rows.push(officeRow('whatsapp', 'WhatsApp', '<a href="https://wa.me/' + h(WA) + '" target="_blank" rel="noopener">' + h(waLabel) + icon('arrow-up-right', { size: 14, cls: 'ub-office__ext' }) + '<span class="sr-only"> (tab baru)</span></a>'));
      if (C.email) rows.push(officeRow('mail', 'Email', '<a href="mailto:' + h(C.email) + '">' + h(C.email) + '</a>'));
      if (C.hours.length) {
        rows.push(officeRow('clock', 'Jam layanan', '<dl class="ub-hours">' + C.hours.map(function (x) {
          return '<div class="ub-hours__row"><dt>' + h(clean(x.hari)) + '</dt><dd>' + h(clean(x.jam)) + '</dd></div>';
        }).join('') + '</dl>'));
      }
      var note = (!C.phone && !WA && !C.email)
        ? '<p class="ub-office__note">' + icon('info', { size: 16 }) + '<span>Nomor telepon, WhatsApp, dan email resmi sekretariat akan dicantumkan setelah dikonfirmasi. Untuk sementara, sampaikan pesan Anda melalui formulir di halaman ini.</span></p>'
        : '';
      host.innerHTML = '<ul class="ub-office__list" role="list">' + rows.join('') + '</ul>' + note + mapHtml() + socialHtml();
      ui.reveal(host);
    }

    /* Kartu Sekretariat dibuat "lengket" (desktop) hanya bila tingginya muat di layar */
    function updateSticky() {
      var aside = $('[data-ub-aside]'), card = aside && $('.ub-office', aside);
      if (!aside || !card) return;
      var header = $('.site-header');
      var offset = (header ? header.offsetHeight : 76) + 48;
      aside.classList.toggle('is-sticky', card.offsetHeight + offset <= window.innerHeight);
    }

    /* ---------- Tautan alternatif (WhatsApp / Email) di bawah tombol kirim ---------- */
    function renderAlt() {
      var el = $('[data-ub-alt]');
      if (!el) return;
      var links = [];
      if (WA) links.push('<a href="https://wa.me/' + h(WA) + '" target="_blank" rel="noopener">' + icon('whatsapp', { size: 16 }) + '<span>WhatsApp</span><span class="sr-only"> (tab baru)</span></a>');
      if (C.email) links.push('<a href="mailto:' + h(C.email) + '">' + icon('mail', { size: 16 }) + '<span>Email</span></a>');
      if (!links.length) { el.hidden = true; return; }
      el.innerHTML = '<span>atau hubungi melalui</span> ' + links.join('<span class="ub-alt__sep" aria-hidden="true">/</span>');
      el.hidden = false;
    }

    /* ---------- FAQ umum ---------- */
    function renderFaq() {
      var host = $('[data-ub-faq]'), section = $('[data-ub-faq-section]');
      if (!host) return;
      var org = (PPAPI.data && PPAPI.data.organisasi) || {};
      var all = Array.isArray(org.faq) ? org.faq.filter(function (x) { return x && x.q && x.a; }) : [];
      var list = all.filter(function (x) { return x.kelompok === 'umum'; });
      if (!list.length) list = all;
      if (!list.length) { if (section) section.hidden = true; return; }
      host.innerHTML = '<div class="accordion" data-accordion="single">' + list.map(function (x, i) {
        var open = i === 0;
        return '<div class="accordion__item"><h3><button type="button" class="accordion__trigger" aria-expanded="' + (open ? 'true' : 'false') + '">' +
          '<span class="ub-faq__q"><span class="ub-faq__num" aria-hidden="true">' + u.pad(i + 1) + '</span><span>' + h(x.q) + '</span></span></button></h3>' +
          '<div class="accordion__panel"' + (open ? '' : ' hidden') + '><p>' + h(x.a) + '</p></div></div>';
      }).join('') + '</div>';
      ui.reveal(host);
    }

    /* ------------------------------------------------------------------
       Formulir umpan balik
       ------------------------------------------------------------------ */
    var form = $('[data-ub-form]');
    var successEl = $('[data-ub-success]');

    renderOffice();
    renderAlt();
    renderFaq();
    updateSticky();
    window.addEventListener('resize', u.debounce(updateSticky, 150));
    window.addEventListener('load', updateSticky);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(updateSticky);
    if (!form) return;

    var el = {
      nama: form.elements.nama, email: form.elements.email, phone: form.elements.phone,
      subjek: form.elements.subjek, pesan: form.elements.pesan, anon: form.elements.anonim, consent: form.elements.consent
    };
    var submitBtn = $('[data-ub-submit]', form);
    var alertEl = $('[data-ub-alert]', form);
    var counter = $('[data-ub-counter]', form);
    var counterSr = $('[data-ub-count-sr]', form);
    var katHint = $('[data-ub-kat-hint]', form);
    var ratingLabel = $('[data-ub-rating-label]', form);
    var ratingClear = $('[data-ub-rating-clear]', form);
    var identity = $('[data-ub-identity]', form);
    var signedNote = $('[data-ub-signed]', form);
    var submitted = false, sending = false;

    function kategori() { var r = $('input[name="kategori"]:checked', form); return r ? r.value : ''; }
    function rating() { var r = $('input[name="rating"]:checked', form); return r ? parseInt(r.value, 10) : null; }
    function isAnon() { return !!el.anon.checked; }

    function localPhone(e164) {
      var f = u.formatPhoneID(e164);
      return f.indexOf('+62 ') === 0 ? f.slice(4) : f;
    }

    /* Identitas dari akun yang sedang masuk. Nilai yang diisi otomatis dicatat (autoVal) agar
       ikut diganti saat berganti akun dan dikosongkan kembali saat keluar, selama belum diubah
       pengunjung; isian yang sudah diubah tidak disentuh. Saat mode anonim aktif, nilai identitas
       berada di "stash" (lihat setAnon), sehingga yang diperbarui adalah stash tersebut. */
    var ID_KEYS = ['nama', 'email', 'phone'];
    var autoVal = {};
    var stash = null;
    function readId(k) { return stash ? (stash[k] || '') : el[k].value; }
    function writeId(k, v) {
      if (stash) { stash[k] = v; return; }
      el[k].value = v;
      var field = el[k].closest('.field');
      if (submitted || (field && field.classList.contains('is-invalid'))) check(k); else setError(k, '');
    }
    function accountValues(user) {
      return {
        nama: clean(user && user.name),
        email: clean(user && user.email),
        phone: user && user.phone && u.normalizePhoneID(user.phone) ? localPhone(user.phone) : ''
      };
    }

    function prefill() {
      var user = PPAPI.auth && PPAPI.auth.current ? PPAPI.auth.current() : null;
      var acct = accountValues(user);
      ID_KEYS.forEach(function (k) {
        var cur = readId(k);
        if (cur && cur !== autoVal[k] && cur !== acct[k]) { delete autoVal[k]; return; }
        if (cur !== acct[k]) writeId(k, acct[k]);
        if (acct[k]) autoVal[k] = acct[k]; else delete autoVal[k];
      });
      if (!user) { signedNote.hidden = true; signedNote.innerHTML = ''; return; }
      var who = user.name || user.email || u.formatPhoneID(user.phone) || 'Anggota';
      signedNote.innerHTML = '<span class="avatar" aria-hidden="true">' + h(u.initials(who) || 'A') + '</span>' +
        '<span>Anda masuk sebagai <strong>' + h(who) + '</strong>. Data identitas diisi otomatis dari akun Anda dan dapat diubah.</span>';
      signedNote.hidden = false;
    }

    function applyQueryKategori() {
      var q = clean(u.qs('kategori')).toLowerCase();
      if (!q) return;
      $$('input[name="kategori"]', form).forEach(function (r) { if (r.value.toLowerCase() === q) r.checked = true; });
    }

    function updateKatHint() {
      var k = kategori();
      if (katHint) katHint.textContent = KATEGORI_HINT[k] || '';
    }

    function updateCounter(announce) {
      var n = el.pesan.value.length;
      counter.textContent = u.formatNumber(n) + ' / ' + u.formatNumber(MSG_MAX);
      counter.classList.toggle('is-over', n > MSG_MAX);
      counter.classList.toggle('is-short', n > 0 && el.pesan.value.trim().length < MSG_MIN);
      if (announce && counterSr) {
        var left = MSG_MAX - n;
        counterSr.textContent = left <= 200 ? 'Sisa ' + u.formatNumber(Math.max(0, left)) + ' karakter.' : '';
      }
    }

    function updateRating() {
      var r = rating();
      ratingLabel.textContent = RATING_LABEL[r || 0];
      ratingLabel.classList.toggle('is-set', !!r);
      ratingClear.hidden = !r;
    }

    /* ---------- Validasi ---------- */
    var RULES = {
      nama: function () {
        if (isAnon()) return '';
        return el.nama.value.trim().length < NAME_MIN ? 'Masukkan nama lengkap Anda (minimal 3 karakter), atau pilih kirim sebagai anonim.' : '';
      },
      email: function () {
        if (isAnon()) return '';
        var v = el.email.value.trim();
        if (!v) return 'Masukkan alamat email agar sekretariat dapat membalas pesan Anda.';
        return u.isEmail(v) ? '' : 'Format email tidak valid, misalnya nama@domain.id.';
      },
      phone: function () {
        if (isAnon()) return '';
        var v = el.phone.value.trim();
        if (!v) return '';
        return u.normalizePhoneID(v) ? '' : 'Nomor HP tidak valid. Gunakan nomor seluler Indonesia, misalnya 0812-3456-7890.';
      },
      subjek: function () {
        var n = el.subjek.value.trim().length;
        if (n < SUBJ_MIN) return 'Tuliskan subjek pesan (minimal 3 karakter).';
        return n > SUBJ_MAX ? 'Subjek maksimal 150 karakter.' : '';
      },
      pesan: function () {
        var n = el.pesan.value.trim().length;
        if (!n) return 'Tuliskan pesan Anda (minimal 10 karakter).';
        if (n < MSG_MIN) return 'Pesan terlalu singkat — minimal 10 karakter (saat ini ' + n + ').';
        return n > MSG_MAX ? 'Pesan maksimal 2.000 karakter.' : '';
      },
      consent: function () {
        return el.consent.checked ? '' : 'Centang persetujuan Kebijakan Privasi untuk mengirim umpan balik.';
      }
    };
    var ORDER = ['nama', 'email', 'phone', 'subjek', 'pesan', 'consent'];

    function setError(key, msg) {
      var input = el[key];
      var field = input.closest('.field');
      var err = document.getElementById(input.id + '-err');
      if (field) field.classList.toggle('is-invalid', !!msg);
      if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
      if (err) err.textContent = msg || '';
    }
    function check(key) { var msg = RULES[key](); setError(key, msg); return msg; }
    function validateAll() {
      var bad = [];
      ORDER.forEach(function (k) { if (check(k)) bad.push(k); });
      return bad;
    }
    function setAlert(title, text) {
      if (!title) { alertEl.innerHTML = ''; return; }
      alertEl.innerHTML = icon('alert-triangle', { size: 20 }) + '<div><p class="alert__title">' + h(title) + '</p>' + (text ? '<p>' + h(text) + '</p>' : '') + '</div>';
    }

    ORDER.forEach(function (k) {
      var input = el[k];
      var evt = input.type === 'checkbox' ? 'change' : 'input';
      input.addEventListener(evt, function () {
        var field = input.closest('.field');
        if (submitted || (field && field.classList.contains('is-invalid'))) check(k);
        if (alertEl.innerHTML && !RULES.nama() && !RULES.email() && !RULES.phone() && !RULES.subjek() && !RULES.pesan() && !RULES.consent()) setAlert('');
      });
      if (input.type !== 'checkbox') {
        input.addEventListener('blur', function () { if (input.value.trim() || submitted) check(k); });
      }
    });

    /* Nomor HP: rapikan tampilan setelah keluar dari kolom */
    el.phone.addEventListener('blur', function () {
      var n = u.normalizePhoneID(el.phone.value);
      if (n) el.phone.value = localPhone(n);
    });

    el.pesan.addEventListener('input', function () { updateCounter(true); });

    form.addEventListener('change', function (e) {
      var t = e.target;
      if (t.name === 'kategori') updateKatHint();
      if (t.name === 'rating') updateRating();
    });
    ratingClear.addEventListener('click', function () {
      $$('input[name="rating"]', form).forEach(function (r) { r.checked = false; });
      updateRating();
      var first = $('input[name="rating"]', form);
      if (first) first.focus();
    });

    /* Kirim sebagai anonim: kosongkan & nonaktifkan identitas (nilai lama dipulihkan bila batal) */
    function setAnon(on) {
      ID_KEYS.forEach(function (k) {
        var input = el[k];
        if (on) {
          if (!stash) stash = {};
          stash[k] = input.value;
          input.value = '';
          setError(k, '');
        } else if (stash && stash[k] !== undefined) {
          input.value = stash[k];
        }
        input.disabled = on;
      });
      if (!on) stash = null;
      identity.classList.toggle('is-anon', on);
    }
    el.anon.addEventListener('change', function () {
      setAnon(el.anon.checked);
      if (!el.anon.checked && submitted) { check('nama'); check('email'); check('phone'); }
    });

    /* ---------- Kirim ---------- */
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      if (sending) return;
      submitted = true;
      var bad = validateAll();
      if (bad.length) {
        setAlert('Periksa kembali isian Anda', bad.length === 1 ? 'Ada 1 isian yang perlu diperbaiki.' : 'Ada ' + bad.length + ' isian yang perlu diperbaiki.');
        el[bad[0]].focus();
        return;
      }
      setAlert('');
      var anon = isAnon();
      var phone = anon ? '' : (u.normalizePhoneID(el.phone.value) || '');
      var data = {
        kategori: kategori(),
        nama: anon ? '' : el.nama.value.trim(),
        email: anon ? '' : el.email.value.trim(),
        phone: phone,
        subjek: el.subjek.value.trim(),
        pesan: el.pesan.value.trim(),
        rating: rating(),
        anonim: anon,
        halaman: 'umpan-balik.html'
      };
      sending = true;
      ui.setLoading(submitBtn, true, 'Mengirim…');
      try {
        if (!PPAPI.store || typeof PPAPI.store.submitFeedback !== 'function') throw new Error('Layanan penyimpanan belum tersedia. Silakan muat ulang halaman.');
        var res = await PPAPI.store.submitFeedback(data);
        ui.setLoading(submitBtn, false);
        showSuccess((res && res.id) || '', data);
      } catch (err) {
        ui.setLoading(submitBtn, false);
        console.error(err);
        setAlert('Umpan balik belum terkirim', (err && err.message) || 'Terjadi kendala. Silakan coba lagi beberapa saat lagi.');
        ui.toast('Umpan balik belum terkirim. Silakan coba lagi.', { type: 'error' });
      } finally {
        sending = false;
      }
    });

    /* ---------- Panel sukses ---------- */
    function stars(n) {
      if (!n) return '<span class="muted">Tidak diisi</span>';
      var out = '';
      for (var i = 1; i <= 5; i++) out += icon(i <= n ? 'star-filled' : 'star', { size: 16 });
      return '<span class="ub-stars" role="img" aria-label="' + n + ' dari 5 bintang">' + out + '</span> <span class="ub-stars__label">' + h(RATING_LABEL[n]) + '</span>';
    }

    function showSuccess(id, data) {
      var demo = PPAPI.store && PPAPI.store.mode === 'local';
      var sender = data.anonim ? 'Anonim' : data.nama;
      var lead = data.anonim
        ? 'Pesan Anda dikirim tanpa identitas, sehingga sekretariat tidak dapat membalas secara langsung. Terima kasih telah meluangkan waktu.'
        : 'Pesan Anda telah tercatat. Bila diperlukan, sekretariat dapat menghubungi Anda melalui ' + data.email + '.';
      successEl.innerHTML =
        '<div class="ub-success__mark" aria-hidden="true">' + icon('check', { size: 30 }) + '</div>' +
        '<p class="eyebrow ub-success__eyebrow">Umpan balik terkirim</p>' +
        '<h3 class="h2 ub-success__title" tabindex="-1" data-ub-success-title>Terima kasih atas <em>masukan</em> Anda.</h3>' +
        '<p class="ub-success__lead">' + h(lead) + '</p>' +
        (id ? '<div class="ub-ref theme-dark"><div><p class="ub-ref__label">Nomor referensi</p><p class="ub-ref__value" data-ub-ref>' + h(id) + '</p></div>' +
          '<button type="button" class="icon-btn ub-ref__copy" data-copy="' + h(id) + '" data-copy-message="Nomor referensi berhasil disalin." aria-label="Salin nomor referensi">' + icon('copy', { size: 18 }) + '</button></div>' : '') +
        '<dl class="kv ub-success__kv">' +
          '<div class="kv__row"><dt>Kategori</dt><dd>' + h(data.kategori) + '</dd></div>' +
          '<div class="kv__row"><dt>Subjek</dt><dd>' + h(data.subjek) + '</dd></div>' +
          '<div class="kv__row"><dt>Pengirim</dt><dd>' + h(sender) + '</dd></div>' +
          '<div class="kv__row"><dt>Penilaian</dt><dd>' + stars(data.rating) + '</dd></div>' +
          '<div class="kv__row"><dt>Dikirim</dt><dd>' + h(u.formatDate(new Date(), { weekday: true, time: true })) + '</dd></div>' +
        '</dl>' +
        (demo ? '<div class="alert alert--info ub-success__demo">' + icon('info', { size: 20 }) + '<div><p class="alert__title">Mode Demo</p><p>Umpan balik ini tersimpan di peramban Anda dan belum diteruskan ke sekretariat. Pengiriman sebenarnya aktif setelah situs terhubung ke Firebase.</p></div></div>' : '') +
        '<div class="ub-success__actions">' +
          '<button type="button" class="btn btn--primary" data-ub-again><span>Kirim umpan balik lain</span>' + icon('refresh', { size: 18, cls: 'btn__icon' }) + '</button>' +
          '<a class="btn btn--link" href="index.html"><span>Kembali ke beranda</span>' + icon('arrow-right', { size: 18, cls: 'btn__icon' }) + '</a>' +
        '</div>';
      form.hidden = true;
      successEl.hidden = false;
      ui.reveal(successEl);
      var title = $('[data-ub-success-title]', successEl);
      var card = successEl.closest('.ub-card') || successEl;
      var top = card.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.6) card.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
      if (title) { try { title.focus({ preventScroll: true }); } catch (er) { title.focus(); } }
      ui.toast('Umpan balik berhasil dikirim. Terima kasih.', { type: 'success' });
      $('[data-ub-again]', successEl).addEventListener('click', resetForm);
    }

    function resetForm() {
      setAnon(false);
      form.reset();
      stash = null;
      submitted = false;
      ORDER.forEach(function (k) { setError(k, ''); });
      setAlert('');
      applyQueryKategori();
      prefill();
      updateKatHint();
      updateCounter(false);
      updateRating();
      successEl.hidden = true;
      successEl.innerHTML = '';
      form.hidden = false;
      var card = form.closest('.ub-card') || form;
      var top = card.getBoundingClientRect().top;
      if (top < 0) card.scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
      var first = $('input[name="kategori"]:checked', form) || el.subjek;
      try { first.focus({ preventScroll: true }); } catch (er) { first.focus(); }
    }

    /* ---------- Inisialisasi ---------- */
    applyQueryKategori();
    prefill();
    updateKatHint();
    updateCounter(false);
    updateRating();
    if (PPAPI.auth && typeof PPAPI.auth.onChange === 'function') {
      PPAPI.auth.onChange(function () { prefill(); });
    }
  });
})();
