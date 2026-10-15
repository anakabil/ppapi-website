/* ==========================================================================
   PPAPI — verifikasi.html · Verifikasi Anggota (publik)
   Sumber data: PPAPI.store.registry.lookup(query) — daftar verifikasi publik
   yang diperbarui otomatis saat sekretariat menyetujui keanggotaan (Firebase:
   koleksi `registry`; Mode Demo: peramban ini) + data contoh registry.js
   (hanya Mode Demo).
   - ?kta=<nomor> dibaca saat halaman dibuka (kode QR pada KTA digital) → periksa otomatis.
   - Nomor KTA: cocok persis (tanpa peduli huruf besar-kecil, spasi, tanda hubung).
   - Sebagian nomor (≥ 4 angka) atau nama (≥ 3 huruf): daftar hasil, maksimal 10 tampil.
   - Nomor KTA lengkap & sesuai format yang tidak ada di daftar → keadaan netral "Belum tercantum";
     "Data tidak ditemukan" + petunjuk format/QR hanya untuk nomor tidak lengkap/tidak sesuai format
     dan pencarian nama.
   - Anggota yang sedang masuk & memiliki KTA (Aktif, Kedaluwarsa, Nonaktif, atau sedang
     perpanjangan) mendapat pintasan "Periksa KTA saya"; KTA milik sendiri diberi catatan sesuai
     status. Anggota Aktif yang belum tercantum melihat ringkasan data miliknya sendiri.
     Mengikuti perubahan sesi (PPAPI.session.onChange).
   ========================================================================== */
(function () {
  'use strict';

  PPAPI.onReady(async function () {
    var U = PPAPI.util, ui = PPAPI.ui, h = U.h, icon = PPAPI.icon;
    var $ = U.$;
    var STORE = PPAPI.store || {};
    var DEMO = STORE.mode === 'local';
    var STATIC_REG = (PPAPI.data && Array.isArray(PPAPI.data.registry)) ? PPAPI.data.registry.slice() : [];
    var MAX_LIST = 10;
    var LOOKUP_CAP = 20;          // store.registry.lookup returns at most 20 matches
    var KTA_EXAMPLE = 'PPAPI-2026-000123';

    var form = $('[data-vf="form"]');
    if (!form) return;
    var input = $('#vf-q', form);
    var field = $('[data-vf="field"]', form);
    var errEl = $('[data-vf="error"]', form);
    var submitBtn = $('button[type="submit"]', form);
    var resultsEl = $('[data-vf="results"]');
    var statusEl = $('[data-vf="status"]');
    var mineEl = $('[data-vf="mine"]');
    var sampleEl = $('[data-vf="sample"]');
    var tryEl = $('[data-vf="try"]');
    var demoNoteEl = $('[data-vf="demo-note"]');

    /* ---------- helpers ---------- */
    function alnum(s) { return String(s == null ? '' : s).toUpperCase().replace(/[^A-Z0-9]/g, ''); }
    function fold(s) { return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim(); }
    function prettyKta(s) {
      var a = alnum(s), m = /^PPAPI(\d{4})(\d{6})$/.exec(a);
      return m ? 'PPAPI-' + m[1] + '-' + m[2] : String(s || '').trim();
    }
    function isExpired(item) { var d = U.daysUntil(item.berlakuHingga); return d !== null && d < 0; }
    function isActive(item) { return String(item.status || '').toLowerCase() === 'aktif'; }
    function statusTone(status) {
      var s = String(status || '').toLowerCase();
      return s === 'aktif' ? 'ok' : (s === 'nonaktif' ? 'err' : 'warn');
    }
    function verdict(item) {
      if (isExpired(item)) return 'expired';
      if (!isActive(item)) return 'inactive';
      return 'ok';
    }
    function relPhrase(iso, days) {
      // "3 tahun lagi" · "berakhir hari ini" · "berakhir besok" · "berakhir 3 bulan lalu"
      var rel = U.relativeTime(iso);
      if (days <= 1) return 'berakhir ' + rel;
      return rel.replace(/^dalam\s+/, '') + ' lagi';
    }
    function verifyUrl(kta) { return U.siteUrl('verifikasi.html?kta=' + encodeURIComponent(kta)); }
    function kvRow(label, valueHtml) { return '<div class="kv__row"><dt>' + label + '</dt><dd>' + valueHtml + '</dd></div>'; }
    function compsHtml(list) {
      var arr = (Array.isArray(list) ? list : []).filter(Boolean);
      if (!arr.length) return '<span class="muted">—</span>';
      return '<ul class="vf-comps" role="list">' + arr.map(function (c) { return '<li>' + h(c) + '</li>'; }).join('') + '</ul>';
    }
    function untilHtml(iso) {
      if (!iso) return '<span class="muted">—</span>';
      var days = U.daysUntil(iso);
      return h(U.formatDate(iso)) + (days !== null ? ' <span class="vf-rel' + (days < 0 ? ' text-warn' : '') + '">· ' + h(relPhrase(iso, days)) + '</span>' : '');
    }
    function hlName(name, q) {
      var s = String(name || ''), f = fold(q);
      if (!f) return h(s);
      var lower = s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
      if (lower.length !== s.length) return h(s);
      var i = lower.indexOf(f);
      if (i === -1) return h(s);
      return h(s.slice(0, i)) + '<mark class="vf-hl">' + h(s.slice(i, i + f.length)) + '</mark>' + h(s.slice(i + f.length));
    }

    /* ---------- the viewer (PPAPI.session) ----------
       A KTA counts as the viewer's own only when it was actually issued: effective Aktif, Kedaluwarsa,
       Nonaktif, or an approved member who is renewing (approvedAt). A v1 account still in Draf may carry
       an unofficial number — it is never treated as a KTA. */
    function sess() {
      var s = PPAPI.session && PPAPI.session.current ? PPAPI.session.current() : null;
      return s || { user: null, member: null, isAdmin: false, status: '', isActive: false, isMemberActive: false };
    }
    function ownKta(s) {
      var m = s && s.member;
      if (!m || !m.kta) return '';
      var issued = s.isMemberActive || s.status === 'Kedaluwarsa' || s.status === 'Nonaktif' || !!m.approvedAt;
      return issued ? String(m.kta) : '';
    }
    var view = sess();
    function isMine(ktaAlnum) { var k = ownKta(view); return !!k && alnum(k) === ktaAlnum; }

    function renderMine() {
      if (!mineEl) return;
      var k = ownKta(view);
      if (k) {
        var m = view.member || {};
        mineEl.innerHTML = icon('user', { size: 18 }) +
          '<span class="vf-mine__who">Anda masuk sebagai <strong>' + h(m.name || (view.user && view.user.name) || 'Anggota') + '</strong></span>' +
            (view.status && view.status !== 'Aktif' ? '<span class="vf-mine__status">' + U.statusBadge(view.status) + '</span>' : '') +
          '<button type="button" class="btn btn--link btn--sm" data-vf-kta="' + h(k) + '"><span>Periksa KTA saya</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</button>';
        mineEl.hidden = false;
      } else {
        mineEl.hidden = true;
        mineEl.innerHTML = '';
      }
    }
    renderMine();

    /* ---------- sample-data notice (Mode Demo only: samples are not served in Firebase mode) ---------- */
    var samples = DEMO ? STATIC_REG.filter(function (r) { return r && r.contoh && r.kta; }) : [];
    if (sampleEl && samples.length) {
      sampleEl.hidden = false;
      var tries = [];
      var okItem = samples.filter(function (r) { return verdict(r) === 'ok'; })[0];
      var expItem = samples.filter(function (r) { return verdict(r) === 'expired'; })[0];
      var tryItem = function (it, note) {
        return '<span class="vf-try__item"><button type="button" class="vf-try" data-vf-kta="' + h(it.kta) + '">' + h(it.kta) + '</button><span class="vf-try__note">' + note + '</span></span>';
      };
      if (okItem) tries.push(tryItem(okItem, 'aktif'));
      if (expItem) tries.push(tryItem(expItem, 'masa berlaku habis'));
      if (tryEl) {
        if (tries.length) tryEl.innerHTML = '<span class="vf-try__label">Coba nomor contoh:</span>' + tries.join('');
        else tryEl.hidden = true;
      }
      if (demoNoteEl) demoNoteEl.hidden = false;
    }

    /* ---------- validation (same input rules as store.registry.lookup) ---------- */
    function setError(msg) {
      errEl.textContent = msg || '';
      field.classList.toggle('is-invalid', !!msg);
      if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
    }
    function classify(raw) {
      var q = String(raw || '').replace(/\s+/g, ' ').trim();
      var a = alnum(q);
      if (!q) return { error: 'Masukkan nomor KTA atau nama terlebih dahulu.' };
      if (/^PPAPI/.test(a)) {
        var digits = a.slice(5);
        // wellFormed = exactly PPAPI-YYYY-NNNNNN (what the KTA QR encodes)
        if (digits.length >= 10) return { mode: 'kta', q: q, kta: a, wellFormed: /^PPAPI\d{10}$/.test(a) };
        if (digits.length >= 4) return { mode: 'list', kind: 'kta', q: q };
        return { error: 'Lengkapi nomor KTA sesuai format, misalnya ' + KTA_EXAMPLE + '.' };
      }
      if (/^[\d\s.\-\/]+$/.test(q)) {
        if (a.length < 4) return { error: 'Ketik minimal 4 angka nomor KTA, atau gunakan format lengkap ' + KTA_EXAMPLE + '.' };
        return { mode: 'list', kind: 'kta', q: q };
      }
      if (fold(q).replace(/[^a-z]/g, '').length < 3) return { error: 'Ketik minimal 3 huruf untuk mencari berdasarkan nama.' };
      return { mode: 'list', kind: 'nama', q: q };
    }

    /* store.registry.lookup, with a static fallback for an older store.js */
    function lookup(q) {
      if (STORE.registry && typeof STORE.registry.lookup === 'function') return Promise.resolve(STORE.registry.lookup(q));
      var a = alnum(q), f = fold(q);
      var list = STATIC_REG.filter(function (r) { return r && r.kta; });
      if (/^PPAPI\d{10,}$/.test(a)) {
        var hit = list.filter(function (r) { return alnum(r.kta) === a; })[0] || null;
        return Promise.resolve({ exact: hit, matches: hit ? [hit] : [] });
      }
      if (/^PPAPI/.test(a)) return Promise.resolve({ exact: null, matches: list.filter(function (r) { return alnum(r.kta).indexOf(a) === 0; }).slice(0, LOOKUP_CAP) });
      if (/^[\d\s.\-\/]+$/.test(q)) return Promise.resolve({ exact: null, matches: list.filter(function (r) { return alnum(r.kta).indexOf(a) !== -1; }).slice(0, LOOKUP_CAP) });
      return Promise.resolve({ exact: null, matches: list.filter(function (r) { return fold(r.nama).indexOf(f) !== -1; }).slice(0, LOOKUP_CAP) });
    }

    /* ---------- renderers ---------- */
    /* note under a record that belongs to the signed-in member — wording follows their status */
    function mineNote() {
      var st = view.status;
      var text;
      if (st === 'Kedaluwarsa') text = 'Ini adalah KTA Anda. Masa berlaku keanggotaan Anda telah berakhir — ajukan perpanjangan melalui <a class="link" href="pendaftaran.html">formulir pendaftaran</a>.';
      else if (st === 'Nonaktif') text = 'Ini adalah KTA Anda. Keanggotaan Anda sedang dinonaktifkan; hubungi sekretariat atau ajukan perpanjangan melalui <a class="link" href="pendaftaran.html">formulir pendaftaran</a>.';
      else if (st === 'Menunggu Verifikasi') text = 'Ini adalah KTA Anda. Pengajuan perpanjangan Anda sedang diverifikasi sekretariat; pantau statusnya di <a class="link" href="dashboard.html">dasbor</a>.';
      else if (st === 'Perlu Perbaikan' || st === 'Ditolak') text = 'Ini adalah KTA Anda. Status pengajuan Anda saat ini: ' + h(st) + ' — lihat <a class="link" href="pendaftaran.html">formulir pendaftaran</a>.';
      else text = 'Ini adalah KTA Anda. Kelola profil dan kartu anggota melalui <a class="link" href="anggota.html">Profil Anggota</a>.';
      return '<div class="vf-result__mine">' + icon('user', { size: 18 }) + '<p>' + text + '</p></div>';
    }

    function resultCard(item, mine) {
      var v = verdict(item);
      var head = {
        ok: { cls: 'ok', ic: 'shield-check', state: 'Terverifikasi', desc: 'Nomor KTA terdaftar sebagai anggota PPAPI dan masa berlakunya masih aktif.' },
        expired: { cls: 'warn', ic: 'alert-triangle', state: 'Masa berlaku telah habis', desc: 'Nomor KTA terdaftar, tetapi masa berlakunya berakhir pada ' + h(U.formatDate(item.berlakuHingga)) + '. Untuk informasi perpanjangan, hubungi sekretariat.' },
        inactive: { cls: 'warn', ic: 'alert-triangle', state: 'Keanggotaan tidak aktif', desc: 'Nomor KTA terdaftar, tetapi status keanggotaannya saat ini tidak aktif.' }
      }[v];
      var kv =
        kvRow('Kategori', h(item.kategori || '—')) +
        kvRow('Kompetensi', compsHtml(item.kompetensi)) +
        kvRow('Kota', h(item.kota || '—')) +
        kvRow('Berlaku hingga', untilHtml(item.berlakuHingga)) +
        kvRow('Status', '<span class="badge badge--' + statusTone(item.status) + '">' + h(item.status || '—') + '</span>');
      return '<article class="card card--lg vf-result vf-result--' + head.cls + '" aria-labelledby="vf-r-state">' +
        '<header class="vf-result__head">' +
          '<span class="vf-seal">' + icon(head.ic, { size: 28 }) + '</span>' +
          '<div class="vf-result__verdict">' +
            '<h3 class="vf-result__state" id="vf-r-state" tabindex="-1">' + head.state + '</h3>' +
            '<p class="vf-result__desc">' + head.desc + '</p>' +
          '</div>' +
        '</header>' +
        '<div class="vf-result__id">' +
          '<p class="vf-result__name">' + h(item.nama) + '</p>' + U.contohBadge(item) +
          '<p class="vf-result__kta">' + icon('id-card', { size: 18 }) + '<span>' + h(item.kta) + '</span></p>' +
        '</div>' +
        '<dl class="kv vf-result__kv">' + kv + '</dl>' +
        (mine ? mineNote() : '') +
        '<footer class="vf-result__foot">' +
          '<p class="vf-result__checked">' + icon('clock', { size: 16 }) + 'Diperiksa ' + h(U.formatDate(U.todayIso(), { weekday: true })) + '</p>' +
          '<button type="button" class="btn btn--ghost btn--sm" data-copy="' + h(verifyUrl(item.kta)) + '" data-copy-message="Tautan verifikasi berhasil disalin."><span>Salin tautan verifikasi</span>' + icon('copy', { size: 16, cls: 'btn__icon' }) + '</button>' +
        '</footer>' +
      '</article>';
    }

    /* an ACTIVE member's own number that is not (yet) in the public list → their own summary */
    function selfCard() {
      var m = view.member || {};
      var p = m.profile || {};
      var comps = (m.competencies || []).map(function (c) { return c && c.name; }).filter(Boolean);
      var st = view.status || U.effectiveStatus(m);
      var kv =
        kvRow('Kategori', h(m.memberType || '—')) +
        kvRow('Kompetensi', compsHtml(comps)) +
        kvRow('Kota', h(p.city || '—')) +
        kvRow('Bergabung', m.joinedAt ? h(U.formatDate(m.joinedAt)) : '<span class="muted">—</span>') +
        kvRow('Berlaku hingga', m.validUntil ? untilHtml(m.validUntil) : '<span class="muted">—</span>') +
        kvRow('Status', U.statusBadge(st) || '<span class="muted">—</span>');
      return '<article class="card card--lg vf-result vf-result--self" aria-labelledby="vf-r-state">' +
        '<header class="vf-result__head">' +
          '<span class="vf-seal">' + icon('id-card', { size: 28 }) + '</span>' +
          '<div class="vf-result__verdict">' +
            '<h3 class="vf-result__state" id="vf-r-state" tabindex="-1">KTA Anda</h3>' +
            '<p class="vf-result__desc">Anda sedang masuk sebagai pemilik nomor ini. Ringkasan berikut berasal dari data keanggotaan Anda.</p>' +
          '</div>' +
        '</header>' +
        '<div class="vf-result__id">' +
          '<p class="vf-result__name">' + h(m.name || (view.user && view.user.name) || 'Anggota') + '</p>' +
          '<p class="vf-result__kta">' + icon('id-card', { size: 18 }) + '<span>' + h(m.kta) + '</span></p>' +
        '</div>' +
        '<dl class="kv vf-result__kv">' + kv + '</dl>' +
        '<div class="alert alert--info vf-result__alert">' + icon('info', { size: 20 }) +
          '<div><p>Nomor ini belum tercantum dalam daftar verifikasi publik, sehingga pengunjung lain akan melihat keterangan “belum tercantum” sampai sekretariat memperbarui daftar tersebut.</p></div>' +
        '</div>' +
        '<footer class="vf-result__foot">' +
          '<p class="vf-result__checked">' + icon('lock', { size: 16 }) + 'Hanya terlihat oleh Anda</p>' +
          '<a class="btn btn--ghost btn--sm" href="anggota.html"><span>Buka Profil Anggota</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a>' +
        '</footer>' +
      '</article>';
    }

    /* neutral outcome card (no registry match): "tidak ditemukan", "belum tercantum", service error */
    function noticeCard(o) {
      return '<article class="card card--lg vf-result vf-result--none' + (o.mod ? ' vf-result--' + o.mod : '') + '" aria-labelledby="vf-r-state">' +
        '<header class="vf-result__head">' +
          '<span class="vf-seal">' + icon(o.ic, { size: 28 }) + '</span>' +
          '<div class="vf-result__verdict">' +
            '<h3 class="vf-result__state" id="vf-r-state" tabindex="-1">' + o.state + '</h3>' +
            '<p class="vf-result__desc">' + o.desc + '</p>' +
          '</div>' +
        '</header>' +
        (o.tips && o.tips.length ? '<ul class="list-rule list-rule--compact list-rule--nodes list-rule--plain vf-guide">' + o.tips.map(function (t) { return '<li>' + h(t) + '</li>'; }).join('') + '</ul>' : '') +
        (o.extra || '') +
        '<footer class="vf-result__foot">' +
          (o.footHtml || ('<a class="btn btn--primary btn--sm" href="umpan-balik.html"><span>Hubungi sekretariat</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a>' +
          '<button type="button" class="btn btn--link btn--sm" data-vf-again><span>Periksa data lain</span></button>')) +
        '</footer>' +
      '</article>';
    }

    /* A complete, well-formed KTA number (as encoded in the card's QR) that is not in the public list:
       the number itself is fine — the list is updated when the secretariat approves a membership.
       Do not blame the scan or the format here. */
    function unlistedCard(res, mine) {
      return noticeCard({
        mod: 'unlisted', ic: 'info', state: 'Belum tercantum',
        desc: 'Nomor KTA <strong class="vf-nowrap">' + h(prettyKta(res.q)) + '</strong> belum tercantum dalam daftar verifikasi publik. Daftar ini dikelola sekretariat PPAPI dan diperbarui saat keanggotaan disetujui.',
        tips: [
          'Pemohon yang pengajuannya masih diverifikasi sekretariat belum tercantum dalam daftar ini.',
          'Hasil ini belum dapat menjadi dasar untuk menyatakan kartu sah maupun tidak sah.',
          'Untuk kepastian status keanggotaan pemegang kartu, hubungi sekretariat PPAPI.'
        ],
        extra: mine ? mineNote() : ''
      });
    }

    function notFoundCard(res) {
      var isKta = res.mode === 'kta' || res.kind === 'kta';
      var shown = res.mode === 'kta' ? prettyKta(res.q) : res.q;
      var desc = isKta
        ? 'Tidak ada anggota dengan nomor KTA <strong class="vf-nowrap">' + h(shown) + '</strong> dalam daftar verifikasi publik.'
        : 'Tidak ada anggota dengan nama yang memuat “' + h(shown) + '” dalam daftar verifikasi publik.';
      // reached for KTA input only when the number is incomplete or malformed (a well-formed one → unlistedCard)
      var tips = isKta
        ? ['Pastikan nomor ditulis lengkap sesuai format, misalnya ' + KTA_EXAMPLE + '.', 'Jika Anda memindai kode QR, pastikan tautan terbuka utuh tanpa terpotong.', 'Bila Anda yakin nomor tersebut benar, hubungi sekretariat PPAPI untuk konfirmasi.']
        : ['Periksa kembali ejaan nama, atau gunakan sebagian nama saja.', 'Pencarian paling akurat menggunakan nomor KTA yang tertera pada kartu.', 'Bila masih belum ditemukan, hubungi sekretariat PPAPI untuk konfirmasi.'];
      return noticeCard({ ic: 'help-circle', state: 'Data tidak ditemukan', desc: desc, tips: tips });
    }

    function errorCard(err) {
      var msg = (err && err.message) || '';
      return noticeCard({
        mod: 'error', ic: 'alert-triangle', state: 'Pemeriksaan belum dapat dilakukan',
        desc: 'Daftar verifikasi sedang tidak dapat dihubungi. Periksa koneksi internet Anda, lalu coba lagi.' + (msg ? ' <span class="vf-result__err">(' + h(msg) + ')</span>' : ''),
        tips: [],
        footHtml: '<button type="button" class="btn btn--primary btn--sm" data-vf-retry><span>Coba lagi</span>' + icon('refresh', { size: 16, cls: 'btn__icon' }) + '</button>' +
          '<a class="btn btn--link btn--sm" href="umpan-balik.html"><span>Hubungi sekretariat</span></a>'
      });
    }

    function listCard(res, items) {
      var shown = items.slice(0, MAX_LIST);
      var capped = items.length >= LOOKUP_CAP;
      var more = items.length - shown.length;
      var title = capped ? 'Sedikitnya ' + U.formatNumber(items.length) + ' anggota ditemukan' : U.formatNumber(items.length) + ' anggota ditemukan';
      var sub = res.kind === 'nama'
        ? 'Nama memuat “' + h(res.q) + '”. Pilih salah satu untuk melihat rincian.'
        : 'Nomor KTA memuat “' + h(res.q) + '”. Pilih salah satu untuk melihat rincian.';
      return '<section class="card card--lg vf-list" aria-labelledby="vf-r-state">' +
        '<header class="vf-list__head">' +
          '<h3 class="vf-list__title" id="vf-r-state" tabindex="-1">' + title + '</h3>' +
          '<p class="vf-list__sub">' + sub + '</p>' +
        '</header>' +
        '<ul class="vf-list__items" role="list">' + shown.map(function (r) {
          var v = verdict(r);
          var badge = v === 'expired'
            ? '<span class="badge badge--warn">Habis masa berlaku</span>'
            : '<span class="badge badge--' + statusTone(r.status) + '">' + h(r.status) + '</span>';
          return '<li class="vf-item">' +
            '<span class="avatar avatar--md" aria-hidden="true">' + h(U.initials(r.nama)) + '</span>' +
            '<div class="vf-item__body">' +
              '<p class="vf-item__name">' + (res.kind === 'nama' ? hlName(r.nama, res.q) : h(r.nama)) + ' ' + U.contohBadge(r) +
                (isMine(alnum(r.kta)) ? ' <span class="badge badge--outline">KTA Anda</span>' : '') + '</p>' +
              '<p class="vf-item__meta"><span class="vf-item__kta">' + h(r.kta) + '</span><span>' + [r.kategori, r.kota].filter(Boolean).map(h).join(' · ') + '</span></p>' +
            '</div>' +
            '<div class="vf-item__aside">' + badge +
              '<button type="button" class="btn btn--ghost btn--sm" data-vf-kta="' + h(r.kta) + '"><span>Rincian</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '<span class="sr-only"> ' + h(r.nama) + '</span></button>' +
            '</div>' +
          '</li>';
        }).join('') + '</ul>' +
        (more > 0 || capped
          ? '<p class="vf-list__more">' + icon('info', { size: 16 }) + (capped
            ? 'Menampilkan ' + shown.length + ' hasil pertama. Perjelas kata kunci untuk mempersempit pencarian.'
            : 'Menampilkan ' + MAX_LIST + ' dari ' + U.formatNumber(items.length) + ' hasil. Perjelas kata kunci untuk mempersempit pencarian.') + '</p>'
          : '') +
      '</section>';
    }

    /* ---------- run ---------- */
    function syncUrl(q) {
      try {
        var params = new URLSearchParams(location.search);
        if (q) params.set('kta', q); else params.delete('kta');
        var s = params.toString();
        history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash);
      } catch (e) { /* file:// or old browser */ }
    }

    function scrollToResult() {
      var target = resultsEl.firstElementChild;
      if (!target) return;
      var top = target.getBoundingClientRect().top;
      if (top > window.innerHeight * 0.55 || top < 0) {
        target.scrollIntoView({ block: 'start', behavior: PPAPI.motion && PPAPI.motion.prefersReduced() ? 'auto' : 'smooth' });
      }
    }

    var lastQuery = null;   // query behind the result currently on screen (null = none)
    var seq = 0;            // newest lookup wins (typing fast / session changes)
    var loadingTimer = null;

    function setBusy(on) {
      clearTimeout(loadingTimer);
      if (on) {
        resultsEl.setAttribute('aria-busy', 'true');
        // only show a loader when the lookup is slow (Firebase); demo answers instantly — no flicker
        loadingTimer = setTimeout(function () {
          if (submitBtn && !submitBtn.disabled) ui.setLoading(submitBtn, true, 'Memeriksa…');
          resultsEl.innerHTML = '<div class="card card--lg vf-loading">' + ui.skeleton(4) + '</div>';
        }, 160);
      } else {
        resultsEl.removeAttribute('aria-busy');
        if (submitBtn && submitBtn.disabled) ui.setLoading(submitBtn, false);
      }
    }

    async function run(raw, opts) {
      opts = opts || {};
      var my = ++seq;
      var c = classify(raw);
      if (c.error) {
        setBusy(false);
        setError(c.error);
        lastQuery = null;
        resultsEl.innerHTML = '';
        statusEl.textContent = c.error;
        if (opts.fromUser) input.focus();
        return;
      }
      setError('');
      setBusy(true);
      var res, failure = null;
      try { res = await lookup(c.q); } catch (e) { failure = e; }
      if (my !== seq) return;          // a newer query took over
      setBusy(false);

      var html, announce;
      if (failure) {
        html = errorCard(failure);
        announce = 'Pemeriksaan belum dapat dilakukan. Coba lagi.';
      } else if (c.mode === 'kta') {
        var hit = res.exact || null;
        var mine = isMine(c.kta);
        if (hit) {
          html = resultCard(hit, mine);
          var v = verdict(hit);
          announce = (v === 'ok' ? 'Terverifikasi: ' : (v === 'expired' ? 'Masa berlaku telah habis: ' : 'Keanggotaan tidak aktif: ')) + hit.nama + ', ' + hit.kta + '.';
        } else if (mine && view.isMemberActive) {
          html = selfCard();
          announce = 'KTA Anda, ' + view.member.kta + ', belum tercantum dalam daftar verifikasi publik.';
        } else if (c.wellFormed) {
          html = unlistedCard(c, mine);
          announce = 'Nomor KTA ' + prettyKta(c.q) + ' belum tercantum dalam daftar verifikasi publik.';
        } else {
          html = notFoundCard(c);
          announce = 'Data tidak ditemukan untuk nomor ' + prettyKta(c.q) + '.';
        }
      } else {
        var items = (res && Array.isArray(res.matches)) ? res.matches : [];
        if (items.length === 1 && c.kind === 'kta') {
          var only = items[0];
          html = resultCard(only, isMine(alnum(only.kta)));
          announce = 'Ditemukan satu anggota: ' + only.nama + ', ' + only.kta + '.';
        } else if (items.length) {
          html = listCard(c, items);
          announce = (items.length >= LOOKUP_CAP ? 'Sedikitnya ' : '') + items.length + ' anggota ditemukan.';
        } else {
          html = notFoundCard(c);
          announce = 'Data tidak ditemukan untuk “' + c.q + '”.';
        }
      }
      resultsEl.innerHTML = html;
      ui.reveal(resultsEl);
      statusEl.textContent = announce;
      lastQuery = c.q;
      if (!failure) syncUrl(c.q);
      if (opts.focusResult) {
        var heading = $('#vf-r-state', resultsEl);
        if (heading) heading.focus({ preventScroll: true });
      }
      if (opts.scroll) scrollToResult();
    }

    /* ---------- events ---------- */
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      run(input.value, { fromUser: true, scroll: true });
    });
    input.addEventListener('input', function () { if (field.classList.contains('is-invalid')) setError(''); });

    document.addEventListener('click', function (e) {
      var k = e.target.closest('[data-vf-kta]');
      if (k) {
        e.preventDefault();
        input.value = k.getAttribute('data-vf-kta');
        run(input.value, { focusResult: true, scroll: true });
        return;
      }
      if (e.target.closest('[data-vf-retry]')) {
        e.preventDefault();
        run(input.value, { focusResult: true });
        return;
      }
      if (e.target.closest('[data-vf-again]')) {
        input.focus();
        input.select();
        var card = form.closest('.vf-lookup');
        if (card) card.scrollIntoView({ block: 'center', behavior: PPAPI.motion && PPAPI.motion.prefersReduced() ? 'auto' : 'smooth' });
      }
    });

    /* ---------- ?kta= on load (QR on the member card) ---------- */
    var initial = U.qs('kta');
    if (initial && String(initial).trim()) {
      input.value = String(initial).trim().slice(0, 80);
      try { await run(input.value, { scroll: true }); }
      finally { document.documentElement.classList.remove('vf-pending'); }
    } else {
      document.documentElement.classList.remove('vf-pending');
    }

    /* ---------- session changes (sign in / out from the header, admin decisions + refresh) ---------- */
    if (PPAPI.session && typeof PPAPI.session.onChange === 'function') {
      PPAPI.session.onChange(function (s) {
        var prev = ownKta(view), prevStatus = view.status;
        view = s || sess();
        renderMine();
        // a single-record result may depend on who is viewing (own record, "KTA Anda" note):
        // check it again for the new session
        if ((prev !== ownKta(view) || prevStatus !== view.status) && lastQuery && $('.vf-result', resultsEl)) {
          run(lastQuery, { focusResult: resultsEl.contains(document.activeElement) });
        }
      });
    }
  });
})();
