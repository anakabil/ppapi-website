/* ==========================================================================
   PPAPI — keranjang.html · Keranjang & pemesanan
   Keranjang dapat dilihat tanpa masuk; membuat pesanan memerlukan akun (status apa pun).
   Pesanan dibuat lewat PPAPI.toko.createOrder → diarahkan ke pesanan.html?id=…
   ========================================================================== */
(function () {
  'use strict';

  PPAPI.onReady(async function () {
    var U = PPAPI.util, ui = PPAPI.ui, h = U.h, icon = PPAPI.icon, $ = U.$;
    var T = PPAPI.toko, R = T.fmt.rupiah;
    var sess = PPAPI.session.current();
    var user = sess.user, member = sess.member;
    var layout = $('[data-kr="layout"]');
    var updateShip = function () {};
    var draftKey = 'ppapi_toko_checkout_draft';
    var products = [], settings = null, lines = [];

    try {
      var res = await Promise.all([T.listProducts(), T.getSettings(), T.cart.load()]);
      products = res[0]; settings = res[1];
    } catch (e) {
      layout.setAttribute('aria-busy', 'false');
      layout.innerHTML = '<div class="alert alert--err" role="alert">' + icon('alert-triangle') + '<div><p class="alert__title">Keranjang belum dapat dimuat</p><p>' + h(e.message) + '</p></div></div>';
      return;
    }

    function draft() { return U.storage.get(draftKey, {}) || {}; }
    function saveDraft() {
      var f = $('#kr-form'); if (!f) return;
      var d = {};
      ['nama', 'telepon', 'alamat', 'kota', 'provinsi', 'kodePos', 'catatanKirim', 'catatan'].forEach(function (k) { var el = f.elements[k]; if (el) d[k] = el.value; });
      U.storage.set(draftKey, d);
    }

    function thumb(p) {
      if (p && p.thumb) return '<img src="' + h(p.thumb) + '" alt="" width="96" height="96" loading="lazy" decoding="async">';
      return '<span class="tk-ph" aria-hidden="true">' + icon(p ? T.KATEGORI_INFO[p.kategori].icon : 'briefcase', { size: 24 }) + '</span>';
    }
    function lineHtml(l) {
      var p = l.product, it = l.item;
      var meta = [];
      if (it.format !== 'fisik') meta.push(T.FORMAT_LABEL[it.format]);
      if (T.fmt.varianLabel(it.varian)) meta.push(T.fmt.varianLabel(it.varian));
      var left = p ? T.stockLeft(p, it.format) : 0;
      return '<li class="kr-line' + (l.problem ? ' has-problem' : '') + '" data-key="' + h(l.key) + '">' +
        '<a class="kr-line__media" href="' + (p ? 'toko.html?produk=' + encodeURIComponent(p.id) : 'toko.html') + '" tabindex="-1" aria-hidden="true">' + thumb(p) + '</a>' +
        '<div class="kr-line__main">' +
          '<p class="kr-line__kat">' + h(p ? p.kategori : 'Produk') + '</p>' +
          '<h3 class="kr-line__title">' + (p ? '<a href="toko.html?produk=' + encodeURIComponent(p.id) + '">' + h(p.nama) + '</a>' : 'Produk tidak tersedia') + '</h3>' +
          (meta.length ? '<p class="kr-line__meta">' + h(meta.join(' · ')) + '</p>' : '') +
          (l.price ? '<p class="kr-line__unit">' + h(R(l.price.harga)) + (l.price.anggota ? ' <span class="badge badge--outline">Harga anggota</span>' : '') + '</p>' : '') +
          (l.problem ? '<p class="kr-line__problem" role="alert">' + icon('alert-triangle', { size: 16 }) + h(l.problem) + '</p>' : '') +
          (it.format === 'soft' ? '<p class="kr-line__soft">' + icon('shield-check', { size: 15 }) + 'Diunduh dari Pesanan Saya · dibubuhi tanda air identitas pembeli</p>' : '') +
        '</div>' +
        '<div class="kr-line__aside">' +
          (it.format === 'soft' || !p ? '<span class="kr-line__one">1 berkas</span>' :
            '<div class="tk-qty" role="group" aria-label="Jumlah ' + h(p.nama) + '"><button type="button" class="tk-qty__btn" data-step="-1" aria-label="Kurangi jumlah">' + icon('minus', { size: 16 }) + '</button>' +
            '<input class="tk-qty__input" type="number" inputmode="numeric" min="1" max="' + (left === Infinity ? 99 : Math.max(1, Math.min(99, left))) + '" value="' + it.qty + '" aria-label="Jumlah" data-qty>' +
            '<button type="button" class="tk-qty__btn" data-step="1" aria-label="Tambah jumlah">' + icon('plus', { size: 16 }) + '</button></div>') +
          '<p class="kr-line__sub">' + (l.subtotal !== undefined ? h(R(l.subtotal)) : '—') + '</p>' +
          '<button type="button" class="btn btn--link btn--sm kr-line__remove" data-remove><span>Hapus</span></button>' +
        '</div>' +
      '</li>';
    }
    function rekeningHtml() {
      if (!settings.rekening.length) return '<p class="kr-pay__none">' + icon('info', { size: 16 }) + 'Informasi rekening akan diumumkan sekretariat.</p>';
      return '<ul class="kr-pay__list">' + settings.rekening.map(function (r) {
        return '<li><span class="kr-pay__bank">' + h(r.bank) + '</span><span class="tk-mono">' + h(r.nomor) + '</span><span class="kr-pay__name">a.n. ' + h(r.atasNama) + '</span></li>';
      }).join('') + '</ul>';
    }
    function field(name, label, opts) {
      opts = opts || {};
      var d = draft(), val = d[name] !== undefined && d[name] !== '' ? d[name] : (opts.value || '');
      var id = 'kr-' + name, ctl;
      if (opts.type === 'select') {
        ctl = '<select class="field__control" id="' + id + '" name="' + name + '"' + (opts.req ? ' required aria-required="true"' : '') + ' aria-describedby="' + id + '-err"><option value="">Pilih provinsi</option>' +
          (U.PROVINSI || []).map(function (p) { return '<option' + (p === val ? ' selected' : '') + '>' + h(p) + '</option>'; }).join('') + '</select>';
      } else if (opts.type === 'textarea') {
        ctl = '<textarea class="field__control" id="' + id + '" name="' + name + '" rows="' + (opts.rows || 3) + '" maxlength="' + (opts.max || 500) + '"' + (opts.req ? ' required aria-required="true"' : '') + ' aria-describedby="' + id + '-err"' + (opts.ph ? ' placeholder="' + h(opts.ph) + '"' : '') + '>' + h(val) + '</textarea>';
      } else {
        ctl = '<input class="field__control" id="' + id + '" name="' + name + '" type="' + (opts.type || 'text') + '" maxlength="' + (opts.max || 120) + '" value="' + h(val) + '"' + (opts.req ? ' required aria-required="true"' : '') + (opts.auto ? ' autocomplete="' + opts.auto + '"' : '') + (opts.mode ? ' inputmode="' + opts.mode + '"' : '') + ' aria-describedby="' + id + '-err">';
      }
      return '<div class="field' + (opts.cls ? ' ' + opts.cls : '') + '"><label class="field__label" for="' + id + '">' + h(label) + (opts.req ? ' <span class="field__req" aria-hidden="true">*</span>' : ' <span class="opt">(opsional)</span>') + '</label>' + ctl +
        (opts.hint ? '<p class="field__hint">' + h(opts.hint) + '</p>' : '') + '<p class="field__error" id="' + id + '-err">' + h(opts.err || 'Kolom ini wajib diisi.') + '</p></div>';
    }

    async function render() {
      saveDraft();
      lines = await T.cart.resolve(products);
      layout.setAttribute('aria-busy', 'false');
      if (!lines.length) {
        layout.className = 'kr-layout kr-layout--empty';
        layout.innerHTML = '<div class="kr-empty">' + ui.emptyState({ icon: 'briefcase', title: 'Keranjang Anda masih kosong', text: 'Telusuri katalog Toko PPAPI untuk menemukan suvenir, pakaian, aksesori, klem, dan produk pengetahuan.', actionHtml: '<a class="btn btn--primary" href="toko.html"><span>Buka katalog</span><span data-icon="arrow-right" data-icon-class="btn__icon" data-icon-size="18"></span></a>' + (user ? ' <a class="btn btn--link" href="pesanan.html"><span>Pesanan Saya</span><span data-icon="arrow-right" data-icon-class="btn__icon" data-icon-size="18"></span></a>' : '') }) + '</div>';
        ui.reveal(layout);
        return;
      }
      layout.className = 'kr-layout';
      var ok = lines.filter(function (l) { return !l.problem; });
      var perluKirim = lines.some(function (l) { return T.needsShipping(l.item.format); });
      var subtotal = ok.reduce(function (n, l) { return n + l.subtotal; }, 0);
      var normal = ok.reduce(function (n, l) { return n + l.price.normal * l.item.qty; }, 0);
      var prof = (member && member.profile) || {};
      var beratG = T.beratKirim(ok);
      var provNow = (draft().provinsi || prof.province || '');
      function quote(prov) { return T.shippingQuote(settings, perluKirim, { provinsi: prov, berat: beratG }); }
      var q = quote(provNow);
      var count = lines.reduce(function (n, l) { return n + l.item.qty; }, 0);
      var hasProblem = lines.length !== ok.length;

      function shipRow(q) { return perluKirim ? '<div class="tk-sum__row" data-kr-ship><dt>Ongkos kirim</dt><dd>' + (q.final ? h(R(q.ongkir)) : 'Dikonfirmasi') + '</dd></div>' : ''; }
      function totalRow(q) { return '<div class="tk-sum__row tk-sum__row--total" data-kr-total><dt>Total' + (q.final ? '' : '*') + '</dt><dd>' + h(R(subtotal + (q.ongkir || 0))) + '</dd></div>'; }
      function sumShip(q) { return shipRow(q) + totalRow(q); }
      function shipNote(q) { return (q.final ? '' : '* Belum termasuk ongkos kirim. ') + h(q.catatan); }
      updateShip = function (prov) {
        var nq = quote(prov), row = layout.querySelector('[data-kr-ship]'), tot = layout.querySelector('[data-kr-total]'), note = layout.querySelector('[data-kr-shipnote]');
        if (row) row.outerHTML = shipRow(nq);
        if (tot) tot.outerHTML = totalRow(nq);
        if (note) note.innerHTML = shipNote(nq);
      };
      var form = '';
      if (!user) {
        form = '<section class="kr-panel kr-signin" aria-labelledby="kr-signin-t">' +
          '<span class="kr-signin__icon" aria-hidden="true">' + icon('lock', { size: 22 }) + '</span>' +
          '<div><h2 class="kr-panel__title" id="kr-signin-t">Masuk untuk melanjutkan pemesanan</h2>' +
          '<p class="kr-panel__text">Pesanan dicatat pada akun Anda agar status pembayaran, pengiriman, dan berkas unduhan dapat dipantau dari halaman Pesanan Saya. Isi keranjang tetap tersimpan.</p>' +
          '<div class="kr-signin__actions"><a class="btn btn--primary" href="masuk.html?next=' + encodeURIComponent('keranjang.html#pemesanan') + '"><span>Masuk</span><span data-icon="arrow-right" data-icon-class="btn__icon" data-icon-size="18"></span></a>' +
          '<a class="btn btn--ghost" href="masuk.html?next=' + encodeURIComponent('keranjang.html#pemesanan') + '#daftar"><span>Buat akun</span></a></div></div></section>';
      } else {
        form = '<form class="form kr-form" id="kr-form" novalidate aria-labelledby="pemesanan-t">' +
          '<section class="kr-panel" id="pemesanan" aria-labelledby="pemesanan-t" tabindex="-1">' +
            '<p class="kr-panel__num">01</p><h2 class="kr-panel__title" id="pemesanan-t">Data pemesan</h2>' +
            '<dl class="kv kv--stacked kr-buyer"><div class="kv__row"><dt>Nama</dt><dd>' + h((member && member.name) || user.name || '—') + '</dd></div>' +
            '<div class="kv__row"><dt>Email</dt><dd>' + h(user.email || '—') + '</dd></div>' +
            '<div class="kv__row"><dt>Telepon</dt><dd>' + h(U.formatPhoneID(user.phone || (member && member.phone) || '') || (member && member.phone) || '—') + '</dd></div></dl>' +
            '<p class="field__hint">Sekretariat menghubungi Anda melalui data akun ini. Ubah nama atau nomor HP dari <a class="link" href="dashboard.html">dasbor</a>.</p>' +
          '</section>' +
          (perluKirim ?
          '<section class="kr-panel" aria-labelledby="kirim-t">' +
            '<p class="kr-panel__num">02</p><h2 class="kr-panel__title" id="kirim-t">Alamat pengiriman</h2>' +
            '<p class="kr-panel__text">Untuk barang fisik dan dokumen cetak — boleh alamat rumah maupun kantor.</p>' +
            '<div class="form__row form__row--2">' +
              field('nama', 'Nama penerima', { req: true, value: (member && member.name) || user.name || '', auto: 'name', err: 'Isi nama penerima (minimal 3 huruf).' }) +
              field('telepon', 'Telepon penerima', { req: true, type: 'tel', mode: 'tel', max: 24, value: U.formatPhoneID(user.phone || (member && member.phone) || '') || '', auto: 'tel', err: 'Isi nomor telepon yang dapat dihubungi kurir.' }) +
            '</div>' +
            field('alamat', 'Alamat lengkap', { req: true, type: 'textarea', max: 500, value: prof.address || '', ph: 'Nama jalan, nomor, RT/RW, kelurahan, kecamatan; nama kantor bila dikirim ke kantor', err: 'Isi alamat lengkap (minimal 10 karakter).' }) +
            '<div class="form__row form__row--2">' +
              field('kota', 'Kota / kabupaten', { req: true, value: prof.city || '', auto: 'address-level2', err: 'Isi kota atau kabupaten.' }) +
              field('provinsi', 'Provinsi', { req: true, type: 'select', value: prof.province || '', err: 'Pilih provinsi.' }) +
            '</div>' +
            '<div class="form__row form__row--2">' +
              field('kodePos', 'Kode pos', { req: true, max: 5, mode: 'numeric', auto: 'postal-code', err: 'Kode pos terdiri atas 5 angka.' }) +
              field('catatanKirim', 'Patokan / catatan kurir', { max: 300 }) +
            '</div>' +
          '</section>' : '') +
          '<section class="kr-panel" aria-labelledby="bayar-t">' +
            '<p class="kr-panel__num">' + (perluKirim ? '03' : '02') + '</p><h2 class="kr-panel__title" id="bayar-t">Pembayaran</h2>' +
            '<div class="kr-pay"><p class="kr-pay__method">' + icon('building', { size: 18 }) + '<span><strong>Transfer bank</strong> — rekening PPAPI</span></p>' + rekeningHtml() +
              '<p class="kr-panel__text">Setelah pesanan dibuat, transfer sesuai total lalu kirim tautan bukti pembayaran (misalnya Google Drive) dari halaman Pesanan Saya. Sekretariat akan memeriksa dan mengonfirmasi pembayaran Anda.</p>' +
              (settings.catatanPembayaran ? '<p class="kr-pay__note">' + h(settings.catatanPembayaran) + '</p>' : '') +
            '</div>' +
            field('catatan', 'Catatan untuk sekretariat', { type: 'textarea', rows: 2, max: 500 }) +
            '<label class="check kr-agree"><input type="checkbox" name="setuju" id="kr-setuju" aria-describedby="kr-setuju-err"><span class="check__box"></span><span class="check__label">Saya memahami bahwa pesanan diproses setelah pembayaran dikonfirmasi sekretariat' + (lines.some(function (l) { return l.item.format === 'soft'; }) ? ', dan bahwa soft file dibubuhi tanda air identitas saya serta hanya untuk penggunaan pribadi/instansi saya' : '') + '.</span></label>' +
            '<p class="field__error kr-agree__err" id="kr-setuju-err">Centang pernyataan ini untuk melanjutkan.</p>' +
          '</section>' +
          '<div class="alert alert--err kr-error" role="alert" aria-live="assertive" data-kr="error"></div>' +
        '</form>';
      }

      layout.innerHTML =
        '<div class="kr-main">' +
          '<section class="kr-cart" aria-labelledby="kr-cart-t">' +
            '<header class="kr-cart__head"><h2 class="kr-cart__title" id="kr-cart-t">Isi keranjang <span>' + U.formatNumber(count) + ' barang</span></h2>' +
            '<a class="btn btn--link btn--sm" href="toko.html"><span>Lanjut belanja</span><span data-icon="arrow-right" data-icon-class="btn__icon" data-icon-size="16"></span></a></header>' +
            '<ul class="kr-lines" role="list">' + lines.map(lineHtml).join('') + '</ul>' +
          '</section>' +
          form +
        '</div>' +
        '<aside class="kr-aside" aria-labelledby="kr-sum-t">' +
          '<div class="kr-summary theme-dark">' +
            '<h2 class="kr-summary__title" id="kr-sum-t">Ringkasan</h2>' +
            '<dl class="tk-sum">' +
              '<div class="tk-sum__row"><dt>Subtotal (' + U.formatNumber(ok.reduce(function (n, l) { return n + l.item.qty; }, 0)) + ' barang)</dt><dd>' + h(R(subtotal)) + '</dd></div>' +
              (normal > subtotal ? '<div class="tk-sum__row tk-sum__row--save"><dt>Hemat harga anggota</dt><dd>−' + h(R(normal - subtotal)) + '</dd></div>' : '') +
              sumShip(q) +
            '</dl>' +
            (perluKirim ? '<p class="tk-sum__note" data-kr-shipnote>' + shipNote(q) + '</p>' : '') +
            (hasProblem ? '<p class="kr-summary__warn" role="alert">' + icon('alert-triangle', { size: 16 }) + 'Perbaiki atau hapus produk bertanda sebelum membuat pesanan.</p>' : '') +
            (user ? '<button type="submit" form="kr-form" class="btn btn--primary btn--block" data-kr="submit"' + (hasProblem ? ' disabled' : '') + '><span>Buat Pesanan</span><span data-icon="arrow-right" data-icon-class="btn__icon" data-icon-size="18"></span></button>'
                  : '<a class="btn btn--primary btn--block" href="masuk.html?next=' + encodeURIComponent('keranjang.html#pemesanan') + '"><span>Masuk untuk memesan</span><span data-icon="arrow-right" data-icon-class="btn__icon" data-icon-size="18"></span></a>') +
            '<p class="kr-summary__safe">' + icon('shield-check', { size: 16 }) + 'Pembayaran hanya melalui rekening resmi PPAPI yang tercantum di situs ini.</p>' +
          '</div>' +
        '</aside>';
      ui.reveal(layout);
      wire();
    }

    function wire() {
      layout.querySelectorAll('[data-remove]').forEach(function (b) {
        b.addEventListener('click', async function () {
          var li = b.closest('[data-key]');
          await T.cart.remove(li.dataset.key);
          ui.toast('Produk dihapus dari keranjang.', { type: 'info' });
          await render();
          var first = layout.querySelector('[data-remove], .kr-empty a'); if (first) first.focus();
        });
      });
      layout.querySelectorAll('.kr-line').forEach(function (li) {
        var inp = li.querySelector('[data-qty]'); if (!inp) return;
        var commit = U.debounce(async function () {
          var max = parseInt(inp.max, 10) || 99;
          var v = Math.max(1, Math.min(max, parseInt(inp.value, 10) || 1));
          await T.cart.setQty(li.dataset.key, v);
          var focusKey = li.dataset.key;
          await render();
          var again = layout.querySelector('[data-key="' + CSS.escape(focusKey) + '"] [data-qty]'); if (again) again.focus();
        }, 350);
        inp.addEventListener('change', commit);
        li.querySelectorAll('[data-step]').forEach(function (b) {
          b.addEventListener('click', function () {
            var max = parseInt(inp.max, 10) || 99;
            inp.value = String(Math.max(1, Math.min(max, (parseInt(inp.value, 10) || 1) + Number(b.dataset.step))));
            commit();
          });
        });
      });
      var f = $('#kr-form');
      if (!f) return;
      f.addEventListener('input', U.debounce(saveDraft, 300));
      f.addEventListener('input', function (e) { var fl = e.target.closest('.field'); if (fl) { fl.classList.remove('is-invalid'); e.target.removeAttribute('aria-invalid'); } if (e.target.id === 'kr-setuju') f.classList.remove('agree-invalid'); });
      f.addEventListener('change', function (e) { if (e.target.id === 'kr-setuju') f.classList.toggle('agree-invalid', false); });
      f.addEventListener('submit', submit);
      if (f.elements.provinsi) f.elements.provinsi.addEventListener('change', function () { updateShip(f.elements.provinsi.value); });
      if (location.hash === '#pemesanan') { var sec = $('#pemesanan'); if (sec) setTimeout(function () { sec.scrollIntoView({ block: 'start' }); sec.focus({ preventScroll: true }); }, 60); }
    }

    function invalid(name) {
      var el = $('#kr-' + name); if (!el) return null;
      el.setAttribute('aria-invalid', 'true'); el.closest('.field').classList.add('is-invalid');
      return el;
    }
    async function submit(e) {
      e.preventDefault();
      var f = e.currentTarget, btn = $('[data-kr="submit"]'), errBox = $('[data-kr="error"]');
      errBox.innerHTML = '';
      var perluKirim = lines.some(function (l) { return T.needsShipping(l.item.format); });
      var alamat = null, first = null;
      if (perluKirim) {
        alamat = { nama: f.elements.nama.value, telepon: f.elements.telepon.value, alamat: f.elements.alamat.value, kota: f.elements.kota.value, provinsi: f.elements.provinsi.value, kodePos: f.elements.kodePos.value.trim(), catatan: f.elements.catatanKirim.value };
        var v = T.validateAlamat(alamat);
        v.missing.forEach(function (m) { var el = invalid(m.key); first = first || el; });
      }
      if (!f.elements.setuju.checked) { f.classList.add('agree-invalid'); first = first || f.elements.setuju; }
      if (first) { first.focus(); ui.toast('Periksa kembali isian yang ditandai.', { type: 'warn' }); return; }
      ui.setLoading(btn, true, 'Membuat pesanan…');
      try {
        var order = await T.createOrder({
          kontak: { nama: (member && member.name) || user.name, email: user.email, telepon: user.phone || (member && member.phone) || '' },
          alamat: alamat, catatan: f.elements.catatan.value
        });
        await T.cart.clear();
        U.storage.remove(draftKey);
        ui.flash('Pesanan ' + order.id + ' telah dibuat. Silakan lakukan pembayaran.', { type: 'success' });
        location.href = 'pesanan.html?id=' + encodeURIComponent(order.id);
      } catch (err) {
        ui.setLoading(btn, false);
        errBox.innerHTML = icon('alert-triangle') + '<div><p class="alert__title">Pesanan belum dapat dibuat</p><p>' + h(err.message) + '</p></div>';
        if (err.missing) err.missing.forEach(function (m) { invalid(m.key); });
        if (err.code === 'toko/cart-problem') { products = await T.listProducts().catch(function () { return products; }); await render(); }
      }
    }

    await render();
  });
})();
