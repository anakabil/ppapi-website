/* ==========================================================================
   PPAPI — sertifikat.js  (Verifikasi Sertifikat Kegiatan, ?no=<nomor>)
   Mencari certificates/{nomor} melalui PPAPI.kegiatan.verify(): nomor
   dengan "/" atau "-" sama saja. Menampilkan data terbatas (nomor, nama,
   kegiatan, tanggal, status Sah/Dicabut). Teks data di-escape.
   ========================================================================== */
(function () {
  'use strict';
  PPAPI.onReady(async function () {
    var U = PPAPI.util, h = U.h, icon = PPAPI.icon, K = PPAPI.kegiatan;
    var form = U.$('[data-sf="form"]'), input = U.$('#sf-no'), field = U.$('[data-sf="field"]');
    var errEl = U.$('[data-sf="error"]'), out = U.$('[data-sf="result"]'), status = U.$('[data-sf="status"]');

    function setUrl(no) {
      try {
        var p = new URLSearchParams(location.search);
        if (no) p.set('no', no); else p.delete('no');
        var s = p.toString();
        history.replaceState(history.state, '', location.pathname + (s ? '?' + s : ''));
      } catch (e) { /* abaikan */ }
    }
    function showError(msg) {
      field.classList.toggle('is-invalid', !!msg);
      if (msg) input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid');
      errEl.textContent = msg || '';
    }
    function card(r) {
      var ok = r.status === 'Sah';
      return '<article class="card sf-card ' + (ok ? 'sf-card--ok' : 'sf-card--err') + '" aria-labelledby="sf-res-title">' +
        '<div class="sf-card__head"><span class="sf-card__icon">' + icon(ok ? 'shield-check' : 'x-circle', { size: 26 }) + '</span>' +
        '<div><p class="eyebrow">' + (ok ? 'Sertifikat sah' : 'Sertifikat dicabut') + '</p>' +
        '<h2 class="sf-card__title" id="sf-res-title">' + h(r.nama) + '</h2>' +
        '<p class="sf-card__no">' + h(r.display) + '</p></div>' +
        '<span class="badge ' + (ok ? 'badge--ok' : 'badge--err') + ' sf-card__badge">' + (ok ? 'Sah' : 'Dicabut') + '</span></div>' +
        '<dl class="kv sf-card__kv">' +
          '<div class="kv__row"><dt>Kegiatan</dt><dd>' + h(r.judul) + '</dd></div>' +
          '<div class="kv__row"><dt>Jenis</dt><dd>' + h(r.jenis || '—') + '</dd></div>' +
          '<div class="kv__row"><dt>Tanggal kegiatan</dt><dd>' + h(r.tanggal || '—') + '</dd></div>' +
          '<div class="kv__row"><dt>Diterbitkan</dt><dd>' + h(isFinite(r.terbit) ? K.fmtDate(r.terbit) : '—') + '</dd></div>' +
          (ok ? '' : '<div class="kv__row"><dt>Keterangan</dt><dd>' + h(r.alasan || 'Sertifikat ini telah dicabut oleh sekretariat PPAPI.') + '</dd></div>') +
        '</dl>' +
        '<p class="sf-card__note">' + (ok ? 'Sertifikat ini tercatat diterbitkan oleh Perkumpulan Praktisi dan Ahli Perancah Indonesia untuk peserta yang mengisi daftar hadir kegiatan tersebut. Pastikan nama di atas sama dengan nama pada sertifikat yang Anda terima.'
          : 'Sertifikat dengan nomor ini tidak lagi berlaku. Hubungi sekretariat PPAPI bila memerlukan penjelasan.') + '</p>' +
      '</article>';
    }
    async function lookup(raw, fromUrl) {
      var q = String(raw || '').trim();
      showError('');
      if (!q) { out.innerHTML = ''; setUrl(''); showError('Masukkan nomor sertifikat.'); if (!fromUrl) input.focus(); return; }
      var id = K.certDocId(q);
      if (!id) {
        out.innerHTML = '';
        showError('Format nomor belum sesuai. Contoh: PPAPI/SERT/2026/WEB1025/0001.');
        status.textContent = 'Format nomor belum sesuai.';
        if (!fromUrl) input.focus();
        return;
      }
      out.setAttribute('aria-busy', 'true');
      out.innerHTML = PPAPI.ui.skeleton(3);
      var r = null;
      try { r = await K.verify(id); }
      catch (err) {
        console.error(err);
        out.removeAttribute('aria-busy');
        out.innerHTML = '<div class="alert alert--err" role="alert">' + icon('alert-triangle', { size: 18 }) + '<div><p class="alert__title">Pemeriksaan belum dapat dilakukan</p><p>' + h(err.message) + '</p></div></div>';
        return;
      }
      out.removeAttribute('aria-busy');
      input.value = K.certDisplay(id);
      setUrl(K.certDisplay(id));
      if (!r) {
        out.innerHTML = '<div class="sf-none">' + PPAPI.ui.emptyState({ icon: 'search', title: 'Nomor tidak ditemukan', text: 'Tidak ada sertifikat PPAPI dengan nomor ' + K.certDisplay(id) + '. Periksa kembali penulisan nomornya, atau hubungi sekretariat bila Anda meragukan keaslian sertifikat.', actionHtml: '<a class="btn btn--ghost btn--sm" href="umpan-balik.html?kategori=Pertanyaan#formulir"><span>Hubungi Sekretariat</span></a>' }) + '</div>';
        status.textContent = 'Nomor sertifikat tidak ditemukan.';
      } else {
        out.innerHTML = card(r);
        status.textContent = r.status === 'Sah' ? 'Sertifikat sah atas nama ' + r.nama + '.' : 'Sertifikat telah dicabut.';
      }
      PPAPI.ui.reveal(out);
    }
    form.addEventListener('submit', function (e) { e.preventDefault(); lookup(input.value); });
    input.addEventListener('input', function () { if (field.classList.contains('is-invalid')) showError(''); });
    var initial = U.qs('no');
    if (initial) { input.value = initial; await lookup(initial, true); }
  });
})();
