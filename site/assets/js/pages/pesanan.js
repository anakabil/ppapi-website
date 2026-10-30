/* ==========================================================================
   PPAPI — pesanan.html · Pesanan Saya (data-auth="required")
   Daftar pesanan, rincian (?id=PSN-…), kirim bukti transfer, batalkan selama belum dibayar,
   lacak pengiriman, dan unduh soft file bertanda air (PPAPI.toko.downloadSoft).
   ========================================================================== */
(function () {
  'use strict';

  PPAPI.onReady(async function () {
    var U = PPAPI.util, ui = PPAPI.ui, h = U.h, icon = PPAPI.icon, $ = U.$;
    var T = PPAPI.toko, R = T.fmt.rupiah;
    var view = $('[data-ps="view"]'), meta = $('[data-ps="meta"]');
    var settings = await T.getSettings().catch(function () { return { rekening: [], batasBayarJam: 0 }; });
    var id = U.qs('id');

    function fail(e) {
      view.setAttribute('aria-busy', 'false');
      view.innerHTML = '<div class="alert alert--err" role="alert">' + icon('alert-triangle') + '<div><p class="alert__title">Pesanan belum dapat dimuat</p><p>' + h(e.message) + '</p></div></div>';
    }
    function when(iso, time) { return iso ? U.formatDate(iso, { short: true, time: !!time }) : '—'; }
    function itemsSummary(o) {
      var first = o.items[0] ? o.items[0].nama : '';
      return first + (o.items.length > 1 ? ' dan ' + (o.items.length - 1) + ' produk lain' : '');
    }

    /* =============================== LIST =============================== */
    async function list() {
      var orders;
      try { orders = await T.myOrders(); } catch (e) { return fail(e); }
      view.setAttribute('aria-busy', 'false');
      var active = orders.filter(function (o) { return o.status !== 'Selesai' && o.status !== 'Dibatalkan'; }).length;
      meta.innerHTML = orders.length ? '<span>' + U.formatNumber(orders.length) + ' pesanan</span>' + (active ? '<span>' + U.formatNumber(active) + ' sedang berjalan</span>' : '') : '';
      if (!orders.length) {
        view.innerHTML = '<div class="ps-empty">' + ui.emptyState({ icon: 'file-text', title: 'Belum ada pesanan', text: 'Pesanan yang Anda buat di Toko PPAPI akan tampil di sini beserta status pembayaran, pengiriman, dan berkas unduhannya.', actionHtml: '<a class="btn btn--primary" href="toko.html"><span>Buka Toko PPAPI</span><span data-icon="arrow-right" data-icon-class="btn__icon" data-icon-size="18"></span></a>' }) + '</div>';
        ui.reveal(view); return;
      }
      view.innerHTML = '<ul class="ps-list" role="list">' + orders.map(function (o) {
        var need = o.status === 'Menunggu Pembayaran';
        return '<li class="ps-row' + (need ? ' is-action' : '') + '">' +
          '<div class="ps-row__id"><span class="tk-mono">' + h(o.id) + '</span><time datetime="' + h(o.createdAt) + '">' + h(when(o.createdAt)) + '</time></div>' +
          '<div class="ps-row__main"><h2 class="ps-row__title"><a href="pesanan.html?id=' + encodeURIComponent(o.id) + '">' + h(itemsSummary(o)) + '</a></h2>' +
            '<p class="ps-row__text">' + h(T.STATUS_TEXT[o.status]) + '</p></div>' +
          '<div class="ps-row__aside">' + T.fmt.statusBadge(o.status) + '<span class="ps-row__total">' + h(R(o.ringkasan.total)) + (o.ringkasan.ongkirFinal === false ? '<small>+ ongkir</small>' : '') + '</span>' +
            '<span class="ps-row__go" aria-hidden="true">' + icon('arrow-right', { size: 18 }) + '</span></div>' +
        '</li>';
      }).join('') + '</ul>' +
      '<p class="ps-foot"><a class="btn btn--link" href="toko.html"><span>Kembali ke Toko</span><span data-icon="arrow-right" data-icon-class="btn__icon" data-icon-size="18"></span></a></p>';
      ui.reveal(view);
    }

    /* =============================== DETAIL =============================== */
    function track(o) {
      var steps = [
        { label: 'Pesanan dibuat', st: ['Menunggu Pembayaran'] },
        { label: 'Bukti dikirim', st: ['Menunggu Konfirmasi'] },
        { label: 'Pembayaran dikonfirmasi', st: ['Dibayar'] },
        { label: o.perluKirim ? 'Diproses & dikirim' : 'Berkas tersedia', st: ['Diproses', 'Dikirim'] },
        { label: 'Selesai', st: ['Selesai'] }
      ];
      var order = ['Menunggu Pembayaran', 'Menunggu Konfirmasi', 'Dibayar', 'Diproses', 'Dikirim', 'Selesai'];
      var cur = order.indexOf(o.status);
      var idx = steps.findIndex(function (s) { return s.st.indexOf(o.status) !== -1; });
      if (o.status === 'Dibatalkan') idx = -1;
      return '<ol class="status-track ps-track" aria-label="Tahapan pesanan">' + steps.map(function (s, i) {
        var done = o.status !== 'Dibatalkan' && (i < idx || (o.status === 'Selesai' && i === idx));
        var current = i === idx && o.status !== 'Selesai';
        var cls = done ? 'is-done' : current ? 'is-current' : '';
        void cur;
        return '<li class="status-track__step ' + cls + '"' + (current ? ' aria-current="step"' : '') + '><span class="status-track__node" aria-hidden="true"></span><span class="status-track__label">' + h(s.label) + '</span></li>';
      }).join('') + '</ol>';
    }
    function copyBtn(text, label) {
      return '<button type="button" class="icon-btn icon-btn--ghost icon-btn--sm ps-copy" data-copy="' + h(text) + '" data-copy-message="' + h(label) + ' disalin." aria-label="Salin ' + h(label.toLowerCase()) + '">' + icon('copy', { size: 16 }) + '</button>';
    }
    function rekening() {
      if (!settings.rekening.length) return '<p class="ps-none">' + icon('info', { size: 16 }) + 'Informasi rekening akan diumumkan sekretariat.</p>';
      return '<ul class="ps-bank" role="list">' + settings.rekening.map(function (r) {
        return '<li><span class="ps-bank__name">' + h(r.bank) + '</span><span class="ps-bank__no"><span class="tk-mono">' + h(r.nomor) + '</span>' + copyBtn(r.nomor.replace(/\D/g, ''), 'Nomor rekening') + '</span><span class="ps-bank__holder">a.n. ' + h(r.atasNama) + '</span></li>';
      }).join('') + '</ul>';
    }
    function proofForm(o) {
      var p = o.pembayaran || {};
      return '<form class="form ps-proof" data-ps="proof" novalidate>' +
        '<div class="field"><label class="field__label" for="ps-bukti">Tautan bukti pembayaran <span class="field__req" aria-hidden="true">*</span></label>' +
          '<div class="input-icon"><span data-icon="link" data-icon-size="18"></span><input class="field__control" id="ps-bukti" name="buktiUrl" type="url" inputmode="url" maxlength="1000" required aria-required="true" placeholder="https://drive.google.com/…" value="' + h(p.buktiUrl || '') + '" aria-describedby="ps-bukti-hint ps-bukti-err"></div>' +
          '<p class="field__hint" id="ps-bukti-hint">Unggah foto atau tangkapan layar bukti transfer ke Google Drive (atau layanan serupa), atur akses “Siapa saja yang memiliki link”, lalu tempel tautannya di sini.</p>' +
          '<p class="field__error" id="ps-bukti-err">Isi tautan yang diawali https://.</p></div>' +
        '<div class="form__row form__row--2">' +
          '<div class="field"><label class="field__label" for="ps-tgl">Tanggal transfer <span class="field__req" aria-hidden="true">*</span></label><input class="field__control" id="ps-tgl" name="tanggal" type="date" max="' + U.todayIso() + '" required aria-required="true" value="' + h(p.tanggal || U.todayIso()) + '" aria-describedby="ps-tgl-err"><p class="field__error" id="ps-tgl-err">Isi tanggal transfer (tidak setelah hari ini).</p></div>' +
          '<div class="field"><label class="field__label" for="ps-jml">Jumlah ditransfer (Rp) <span class="field__req" aria-hidden="true">*</span></label><input class="field__control" id="ps-jml" name="jumlah" type="text" inputmode="numeric" maxlength="14" required aria-required="true" value="' + h(p.jumlah ? U.formatNumber(p.jumlah) : U.formatNumber(o.ringkasan.total)) + '" aria-describedby="ps-jml-err"><p class="field__error" id="ps-jml-err">Isi jumlah yang ditransfer.</p></div>' +
        '</div>' +
        '<div class="field"><label class="field__label" for="ps-pengirim">Nama pemilik rekening pengirim <span class="field__req" aria-hidden="true">*</span></label><input class="field__control" id="ps-pengirim" name="pengirim" type="text" maxlength="120" required aria-required="true" placeholder="Contoh: Budi Santoso — BCA" value="' + h(p.pengirim || '') + '" aria-describedby="ps-pengirim-err"><p class="field__error" id="ps-pengirim-err">Isi nama pemilik rekening pengirim.</p></div>' +
        '<div class="field"><label class="field__label" for="ps-cat">Catatan <span class="opt">(opsional)</span></label><textarea class="field__control" id="ps-cat" name="catatan" rows="2" maxlength="500">' + h(p.catatan || '') + '</textarea></div>' +
        '<div class="form__actions"><button class="btn btn--primary" type="submit" data-ps="proof-submit"><span>' + (o.status === 'Menunggu Konfirmasi' ? 'Perbarui Bukti Pembayaran' : 'Kirim Bukti Pembayaran') + '</span><span data-icon="send" data-icon-class="btn__icon" data-icon-size="18"></span></button></div>' +
      '</form>';
    }
    function itemsHtml(o) {
      return '<ul class="ps-items" role="list">' + o.items.map(function (it, i) {
        var metaBits = [];
        if (it.format !== 'fisik') metaBits.push(T.FORMAT_LABEL[it.format]);
        if (it.varianLabel) metaBits.push(it.varianLabel);
        var dl = '';
        if (it.format === 'soft') {
          dl = o.isPaid
            ? '<button type="button" class="btn btn--primary btn--sm ps-dl" data-dl="' + i + '"><span data-icon="download" data-icon-size="16"></span><span>Unduh berkas</span></button>'
            : (o.status === 'Dibatalkan' ? '' : '<span class="ps-locked">' + icon('lock', { size: 14 }) + 'Tersedia setelah pembayaran dikonfirmasi</span>');
        }
        return '<li class="ps-item"><div class="ps-item__main"><p class="ps-item__kat">' + h(it.kategori) + (it.kode ? ' · ' + h(it.kode) : '') + '</p>' +
          '<p class="ps-item__name">' + h(it.nama) + '</p>' + (metaBits.length ? '<p class="ps-item__meta">' + h(metaBits.join(' · ')) + '</p>' : '') +
          '<p class="ps-item__price">' + U.formatNumber(it.qty) + ' × ' + h(R(it.harga)) + (it.hargaAnggota ? ' <span class="badge badge--outline">Harga anggota</span>' : '') + '</p></div>' +
          '<div class="ps-item__aside"><span class="ps-item__sub">' + h(R(it.subtotal)) + '</span>' + dl + '</div></li>';
      }).join('') + '</ul>' +
      (o.hasSoft ? '<p class="ps-softnote">' + icon('shield-check', { size: 16 }) + '<span>Soft file dibuka melalui tautan privat dan <strong>dibubuhi tanda air identitas pembeli</strong> (nama, email, dan nomor pesanan) pada setiap halaman, lalu dikunci: buka dengan <strong>kata sandi berupa alamat email Anda</strong>. Berkas dapat dicetak, tetapi tidak dapat diubah atau disalin. Berkas hanya untuk penggunaan Anda; mohon tidak menggandakan atau menyebarluaskannya.</span></p>' : '');
    }

    async function detail() {
      var o;
      try { o = await T.getOrder(id); } catch (e) { return fail(e); }
      view.setAttribute('aria-busy', 'false');
      if (!o) {
        view.innerHTML = '<div class="ps-empty">' + ui.emptyState({ icon: 'search', title: 'Pesanan tidak ditemukan', text: 'Nomor pesanan tidak dikenali atau bukan milik akun ini.', actionHtml: '<a class="btn btn--ghost" href="pesanan.html"><span>Lihat semua pesanan</span></a>' }) + '</div>';
        ui.reveal(view); return;
      }
      $('[data-ps="crumb"]').innerHTML = '<a href="pesanan.html">Pesanan Saya</a>';
      $('[data-ps="crumb"]').removeAttribute('aria-current');
      var crumbs = $('[data-ps="crumb"]').parentNode;
      if (!crumbs.querySelector('[data-ps="crumb-id"]')) crumbs.insertAdjacentHTML('beforeend', '<li aria-current="page" data-ps="crumb-id">' + h(o.id) + '</li>');
      $('[data-ps="title"]').innerHTML = 'Pesanan <em class="ps-hero__id">' + h(o.id) + '</em>';
      document.title = 'Pesanan ' + o.id + ' — PPAPI';
      meta.innerHTML = '<span>Dibuat ' + h(when(o.createdAt, true)) + '</span><span>' + h(o.status) + '</span>';

      var r = o.ringkasan, deadline = T.paymentDeadline(o, settings);
      var pay = '';
      if (o.status === 'Menunggu Pembayaran') {
        pay = '<section class="ps-panel ps-panel--pay" aria-labelledby="ps-pay-t">' +
          '<h2 class="ps-panel__title" id="ps-pay-t">Lakukan pembayaran</h2>' +
          (o.catatanAdmin ? '<div class="alert alert--warn" role="note">' + icon('alert-triangle') + '<div><p class="alert__title">Catatan sekretariat</p><p>' + h(o.catatanAdmin) + '</p></div></div>' : '') +
          (r.ongkirFinal === false ? '<div class="alert alert--info" role="note">' + icon('info') + '<div><p class="alert__title">Ongkos kirim sedang dihitung</p><p>Sekretariat akan menetapkan ongkos kirim ke alamat Anda dan memperbarui total pembayaran di halaman ini. Sebaiknya lakukan transfer setelah total diperbarui.</p></div></div>' : '') +
          '<div class="ps-amount theme-dark"><p class="ps-amount__label">Total yang ditransfer' + (r.ongkirFinal === false ? ' (belum termasuk ongkir)' : '') + '</p><p class="ps-amount__value"><span>' + h(R(r.total)) + '</span>' + copyBtn(String(r.total), 'Jumlah') + '</p>' +
            (deadline ? '<p class="ps-amount__due">' + icon('clock', { size: 15 }) + 'Mohon selesaikan sebelum ' + h(U.formatDate(deadline, { time: true })) + '</p>' : '') + '</div>' +
          rekening() +
          (settings.catatanPembayaran ? '<p class="ps-paynote">' + h(settings.catatanPembayaran) + '</p>' : '') +
          '<p class="ps-paynote">Cantumkan nomor pesanan <strong class="tk-mono">' + h(o.id) + '</strong> pada berita transfer bila memungkinkan.</p>' +
          '<h3 class="ps-sub">Kirim bukti pembayaran</h3>' + proofForm(o) +
        '</section>';
      } else if (o.status === 'Menunggu Konfirmasi') {
        var p = o.pembayaran || {};
        pay = '<section class="ps-panel" aria-labelledby="ps-pay-t">' +
          '<h2 class="ps-panel__title" id="ps-pay-t">Bukti pembayaran terkirim</h2>' +
          '<p class="ps-panel__text">Sekretariat sedang memeriksa pembayaran Anda. Status pesanan akan berubah setelah dikonfirmasi.</p>' +
          '<dl class="kv"><div class="kv__row"><dt>Tanggal transfer</dt><dd>' + h(when(p.tanggal)) + '</dd></div>' +
          '<div class="kv__row"><dt>Jumlah</dt><dd>' + h(R(p.jumlah)) + '</dd></div>' +
          '<div class="kv__row"><dt>Pengirim</dt><dd>' + h(p.pengirim || '—') + '</dd></div>' +
          '<div class="kv__row"><dt>Bukti</dt><dd><a class="link" href="' + h(p.buktiUrl) + '" target="_blank" rel="noopener noreferrer">Buka tautan bukti ' + icon('arrow-up-right', { size: 14 }) + '</a></dd></div></dl>' +
          (p.jumlah && p.jumlah !== r.total ? '<p class="ps-paynote">' + icon('info', { size: 15 }) + 'Jumlah yang Anda laporkan berbeda dengan total pesanan (' + h(R(r.total)) + '). Sekretariat akan menghubungi Anda bila diperlukan.</p>' : '') +
          '<details class="ps-more"><summary>Perbarui bukti pembayaran</summary>' + proofForm(o) + '</details>' +
        '</section>';
      }
      var ship = '';
      if (o.pengiriman && o.pengiriman.resi) {
        ship = '<section class="ps-panel" aria-labelledby="ps-ship-t"><h2 class="ps-panel__title" id="ps-ship-t">Pengiriman</h2>' +
          '<dl class="kv"><div class="kv__row"><dt>Kurir</dt><dd>' + h(o.pengiriman.kurir) + '</dd></div>' +
          '<div class="kv__row"><dt>Nomor resi</dt><dd><span class="tk-mono" data-ps="resi">' + h(o.pengiriman.resi) + '</span> ' + copyBtn(o.pengiriman.resi, 'Nomor resi') + '</dd></div>' +
          '<div class="kv__row"><dt>Dikirim</dt><dd>' + h(when(o.pengiriman.dikirimAt)) + '</dd></div></dl>' +
          '<p class="ps-panel__text">Lacak paket melalui situs atau aplikasi resmi kurir dengan nomor resi di atas.</p></section>';
      }
      var hist = '<section class="ps-panel" aria-labelledby="ps-hist-t"><h2 class="ps-panel__title" id="ps-hist-t">Riwayat</h2><ol class="ps-hist" role="list">' +
        o.riwayat.slice().reverse().map(function (e) {
          return '<li><time datetime="' + h(e.at) + '">' + h(when(e.at, true)) + '</time><p><strong>' + h(e.status) + '</strong>' + (e.note ? ' — ' + h(e.note) : '') + '</p><span>' + (e.by === 'admin' ? 'Sekretariat' : 'Anda') + '</span></li>';
        }).join('') + '</ol></section>';

      var a = o.alamat;
      view.innerHTML =
        '<p class="ps-back"><a class="btn btn--link btn--sm" href="pesanan.html"><span data-icon="arrow-left" data-icon-size="16"></span><span>Semua pesanan</span></a></p>' +
        '<header class="ps-head">' +
          '<div class="ps-head__text"><p class="ps-head__eyebrow">Status pesanan</p><p class="ps-head__status">' + T.fmt.statusBadge(o.status) + '</p><p class="ps-head__lead">' + h(T.STATUS_TEXT[o.status]) + '</p></div>' +
          (o.isUnpaid ? '<div class="ps-head__actions"><button type="button" class="btn btn--ghost btn--sm" data-ps="cancel"><span>Batalkan pesanan</span></button></div>' : '') +
        '</header>' +
        (o.status === 'Dibatalkan' ? '<div class="alert alert--err ps-cancelled" role="note">' + icon('x-circle') + '<div><p class="alert__title">Pesanan dibatalkan' + (o.dibatalkanOleh === 'admin' ? ' oleh sekretariat' : '') + '</p>' + (o.alasanBatal ? '<p>' + h(o.alasanBatal) + '</p>' : '') + '</div></div>' : track(o)) +
        '<div class="ps-layout">' +
          '<div class="ps-main">' + pay +
            '<section class="ps-panel" aria-labelledby="ps-items-t"><h2 class="ps-panel__title" id="ps-items-t">Produk dipesan</h2>' + itemsHtml(o) + '</section>' +
            ship + hist +
          '</div>' +
          '<aside class="ps-aside">' +
            '<section class="ps-panel ps-panel--sum" aria-labelledby="ps-sum-t"><h2 class="ps-panel__title" id="ps-sum-t">Ringkasan</h2>' +
              '<dl class="tk-sum"><div class="tk-sum__row"><dt>Subtotal</dt><dd>' + h(R(r.subtotal)) + '</dd></div>' +
              (r.hemat ? '<div class="tk-sum__row tk-sum__row--save"><dt>Hemat harga anggota</dt><dd>−' + h(R(r.hemat)) + '</dd></div>' : '') +
              (o.perluKirim ? '<div class="tk-sum__row"><dt>Ongkos kirim</dt><dd>' + (r.ongkirFinal === false ? 'Dikonfirmasi' : h(R(r.ongkir))) + '</dd></div>' : '') +
              '<div class="tk-sum__row tk-sum__row--total"><dt>Total</dt><dd data-ps="total">' + h(R(r.total)) + '</dd></div></dl>' +
              (r.ongkirCatatan && o.perluKirim ? '<p class="tk-sum__note">' + h(r.ongkirCatatan) + '</p>' : '') +
            '</section>' +
            (a ? '<section class="ps-panel" aria-labelledby="ps-addr-t"><h2 class="ps-panel__title" id="ps-addr-t">Alamat pengiriman</h2><address class="ps-addr"><strong>' + h(a.nama) + '</strong><br>' + h(a.telepon) + '<br>' + h(a.alamat) + '<br>' + h(a.kota) + ', ' + h(a.provinsi) + ' ' + h(a.kodePos) + (a.catatan ? '<br><span class="muted">' + h(a.catatan) + '</span>' : '') + '</address></section>' : '') +
            '<section class="ps-panel" aria-labelledby="ps-help-t"><h2 class="ps-panel__title" id="ps-help-t">Butuh bantuan?</h2><p class="ps-panel__text">' + (settings.kontak ? h(settings.kontak) : 'Hubungi sekretariat PPAPI melalui halaman Kontak dan sebutkan nomor pesanan Anda.') + '</p><a class="btn btn--link btn--sm" href="umpan-balik.html"><span>Hubungi sekretariat</span><span data-icon="arrow-right" data-icon-class="btn__icon" data-icon-size="16"></span></a></section>' +
          '</aside>' +
        '</div>';
      ui.reveal(view);
      wire(o);
    }

    function wire(o) {
      view.querySelectorAll('[data-ps="proof"]').forEach(function (f) {
        f.addEventListener('input', function (e) { var fl = e.target.closest('.field'); if (fl) { fl.classList.remove('is-invalid'); e.target.removeAttribute('aria-invalid'); } });
        f.addEventListener('submit', async function (e) {
          e.preventDefault();
          var btn = f.querySelector('[type=submit]');
          var data = { buktiUrl: f.elements.buktiUrl.value.trim(), tanggal: f.elements.tanggal.value, jumlah: f.elements.jumlah.value.replace(/\D/g, ''), pengirim: f.elements.pengirim.value, catatan: f.elements.catatan.value };
          ui.setLoading(btn, true, 'Mengirim…');
          try {
            await T.submitPayment(o.id, data);
            ui.toast('Bukti pembayaran terkirim. Sekretariat akan segera memeriksanya.', { type: 'success' });
            await detail();
            var t = $('#ps-pay-t'); if (t) { t.setAttribute('tabindex', '-1'); t.focus(); }
          } catch (err) {
            ui.setLoading(btn, false);
            var map = { buktiUrl: 'buktiUrl', tanggal: 'tanggal', jumlah: 'jumlah', pengirim: 'pengirim' }, first = null;
            (err.missing || []).forEach(function (m) { var el = f.elements[map[m.key]]; if (el) { el.setAttribute('aria-invalid', 'true'); el.closest('.field').classList.add('is-invalid'); first = first || el; } });
            if (first) first.focus();
            ui.toast(err.message, { type: 'error' });
          }
        });
      });
      var c = view.querySelector('[data-ps="cancel"]');
      if (c) c.addEventListener('click', function () {
        ui.modal({
          title: 'Batalkan pesanan?', size: 'sm',
          body: '<p>Pesanan <strong class="tk-mono">' + h(o.id) + '</strong> akan dibatalkan dan tidak dapat diaktifkan kembali. Bila Anda sudah mentransfer, hubungi sekretariat sebelum membatalkan.</p>' +
            '<div class="field mt-3"><label class="field__label" for="ps-alasan">Alasan <span class="opt">(opsional)</span></label><textarea class="field__control" id="ps-alasan" rows="2" maxlength="500"></textarea></div>',
          actions: [
            { label: 'Kembali', variant: 'ghost' },
            { label: 'Ya, batalkan', variant: 'danger', onClick: async function (close, ctx) {
              await T.cancelOrder(o.id, ctx.el.querySelector('#ps-alasan').value);
              ui.toast('Pesanan dibatalkan.', { type: 'info' });
              close(); await detail();
            } }
          ]
        });
      });
      view.querySelectorAll('[data-dl]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var it = o.items[Number(b.dataset.dl)];
          ui.setLoading(b, true, 'Menyiapkan berkas…');
          try {
            var res = await T.downloadSoft(o, it);
            ui.setLoading(b, false);
            if (res.ok) {
              ui.modal({
                title: 'Berkas berhasil diunduh', eyebrow: it.nama, size: 'sm',
                body: '<p>Berkas <strong>' + h(res.fileName) + '</strong> sudah tersimpan di perangkat Anda.</p>' +
                  '<p class="mt-3">Buka berkas dengan kata sandi berikut (alamat email Anda):</p><p class="mt-3"><strong class="tk-mono">' + h(res.password) + '</strong></p>' +
                  '<p class="mt-3">Berkas dapat dibaca dan dicetak, tetapi tidak dapat diubah atau disalin. Setiap halaman memuat identitas Anda sebagai pemegang lisensi.</p>',
                actions: [{ label: 'Mengerti', variant: 'primary' }]
              });
              return;
            }
            fallback(res, it, o);
          } catch (e) { ui.setLoading(b, false); ui.toast(e.message, { type: 'error' }); }
        });
      });
    }
    function fallback(res, it, o) {
      var hasUrl = !!res.url;
      ui.modal({
        title: hasUrl ? 'Buka berkas melalui tautan' : 'Berkas belum tersedia', eyebrow: it.nama, size: 'md',
        body: '<p>' + h(res.message) + '</p>' +
          (hasUrl ? '<p class="mt-3">Anda tetap dapat membuka berkas melalui tautan privat yang disiapkan sekretariat. Berkas yang dibuka dengan cara ini <strong>belum dibubuhi tanda air otomatis</strong>; penggunaannya tetap terikat pada nomor pesanan <strong class="tk-mono">' + h(o.id) + '</strong> dan identitas Anda. Mohon tidak menyebarluaskan tautan ini.</p>' : ''),
        actions: hasUrl ? [
          { label: 'Tutup', variant: 'ghost' },
          { label: 'Buka tautan berkas', variant: 'primary', onClick: function () { var wdw = window.open(res.url, '_blank', 'noopener,noreferrer'); if (wdw) wdw.opener = null; } }
        ] : [{ label: 'Tutup', variant: 'primary' }]
      });
    }

    if (id) await detail(); else await list();
  });
})();
