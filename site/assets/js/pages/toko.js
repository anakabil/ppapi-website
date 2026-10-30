/* ==========================================================================
   PPAPI — toko.html · Katalog Toko PPAPI
   Data: PPAPI.toko (assets/js/store-toko.js). Produk dikelola admin di Konsol Admin › Toko.
   URL: ?kategori=<slug>&q=&urut=&produk=<id>  (produk = buka rincian produk)
   ========================================================================== */
(function () {
  'use strict';

  PPAPI.onReady(async function () {
    var U = PPAPI.util, ui = PPAPI.ui, h = U.h, icon = PPAPI.icon, $ = U.$, $$ = U.$$;
    var T = PPAPI.toko, R = T.fmt.rupiah;
    var sess = PPAPI.session.current();
    var member = !!sess.isMemberActive;

    var els = {
      tiles: $('[data-tk="tiles"]'), grid: $('[data-tk="grid"]'), empty: $('[data-tk="empty"]'),
      toolbar: $('[data-tk="toolbar"]'), chips: $('[data-tk="chips"]'), count: $('[data-tk="count"]'),
      q: $('#tk-q'), sort: $('#tk-sort'), member: $('[data-tk="member"]'), fab: $('[data-tk="fab"]')
    };
    var SLUG = {}; T.KATEGORI.forEach(function (k) { SLUG[T.KATEGORI_INFO[k].slug] = k; });
    var state = {
      kat: SLUG[U.qs('kategori')] || '',
      q: (U.qs('q') || '').slice(0, 80),
      sort: ['unggulan', 'terbaru', 'murah', 'mahal'].indexOf(U.qs('urut')) !== -1 ? U.qs('urut') : 'unggulan'
    };
    els.q.value = state.q; els.sort.value = state.sort;

    /* ---------------- cart counter ---------------- */
    function paintCount(n) {
      $$('[data-tk-count]').forEach(function (el) { el.textContent = U.formatNumber(n); el.hidden = !n && !el.closest('.tk-fab'); });
      els.fab.hidden = !n;
      els.fab.setAttribute('aria-label', 'Keranjang, ' + n + ' barang');
    }
    T.cart.onChange(function (d) { paintCount(d.count); });
    try { await T.cart.load(); } catch (e) { console.warn(e); }
    paintCount(T.cart.count());

    /* ---------------- member note ---------------- */
    function memberNote(products) {
      var any = products.some(function (p) { return p.hargaAnggota !== null || p.hargaCetakAnggota !== null; });
      if (!any) { els.member.hidden = true; return; }
      els.member.hidden = false;
      if (member) {
        els.member.innerHTML = '<span data-icon="award" data-icon-size="18"></span><p><strong>Harga anggota diterapkan.</strong> Sebagai anggota berstatus Aktif, Anda mendapatkan harga anggota pada produk bertanda.</p>';
      } else if (sess.user) {
        els.member.innerHTML = '<span data-icon="award" data-icon-size="18"></span><p>Beberapa produk memiliki <strong>harga anggota</strong> khusus anggota berstatus Aktif. <a class="link" href="dashboard.html">Lihat status keanggotaan</a></p>';
      } else {
        els.member.innerHTML = '<span data-icon="award" data-icon-size="18"></span><p>Beberapa produk memiliki <strong>harga anggota</strong>. <a class="link" href="masuk.html?next=' + encodeURIComponent('toko.html') + '">Masuk</a> sebagai anggota berstatus Aktif untuk mendapatkannya.</p>';
      }
    }

    /* ---------------- render helpers ---------------- */
    function media(p, cls) {
      if (p.thumb) return '<img class="' + (cls || '') + '" src="' + h(p.thumb) + '" alt="" loading="lazy" decoding="async">';
      return '<span class="tk-ph" aria-hidden="true">' + icon(T.KATEGORI_INFO[p.kategori].icon, { size: 34 }) + '<span>' + h(p.kategori) + '</span></span>';
    }
    function formatBadges(p) {
      if (!T.isKnowledge(p)) return '';
      return T.formatsOf(p).map(function (f) { return '<span class="badge badge--outline">' + (f === 'soft' ? 'Soft file' : 'Cetak') + '</span>'; }).join('');
    }
    function stockBadge(p) {
      var phys = T.formatsOf(p).filter(function (f) { return f !== 'soft'; });
      if (!phys.length || p.stok === null) return '';
      if (p.stok === 0) return T.formatsOf(p).indexOf('soft') !== -1 ? '<span class="badge badge--muted">Cetak habis</span>' : '<span class="badge badge--err">Stok habis</span>';
      if (p.stok <= 5) return '<span class="badge badge--warn">Sisa ' + U.formatNumber(p.stok) + '</span>';
      return '';
    }
    function priceHtml(p) {
      var fp = T.fromPrice(p, member);
      var normalAll = T.fromPrice(p, false);
      var out = '<p class="tk-card__price">' + (fp.many ? '<span class="tk-card__from">Mulai</span> ' : '') + h(R(fp.min.harga)) + '</p>';
      if (fp.min.anggota) out += '<p class="tk-card__member">' + icon('award', { size: 14 }) + 'Harga anggota · <s>' + h(R(fp.min.normal)) + '</s></p>';
      else if (!member) {
        var mp = T.formatsOf(p).map(function (f) { return T.priceFor(p, f, true); }).filter(function (x) { return x.anggota; })[0];
        if (mp) out += '<p class="tk-card__member">' + icon('award', { size: 14 }) + 'Anggota ' + h(R(mp.harga)) + '</p>';
      }
      void normalAll;
      return out;
    }
    function card(p) {
      var soldOut = T.formatsOf(p).every(function (f) { return !T.inStock(p, f); });
      return '<article class="tk-card' + (soldOut ? ' is-soldout' : '') + '">' +
        '<div class="tk-card__media">' + media(p, 'tk-card__img') + '</div>' +
        '<div class="tk-card__body">' +
          '<p class="tk-card__kat">' + h(p.kategori) + (p.kode ? '<span class="tk-card__code">' + h(p.kode) + '</span>' : '') + '</p>' +
          '<h3 class="tk-card__title"><button type="button" data-open="' + h(p.id) + '">' + h(p.nama) + '</button></h3>' +
          (p.ringkasan ? '<p class="tk-card__sum">' + h(p.ringkasan) + '</p>' : '') +
          '<div class="tk-card__foot">' + priceHtml(p) +
            '<div class="tk-card__tags">' + formatBadges(p) + stockBadge(p) + (p.varian.length ? '<span class="badge badge--outline">' + h(p.varian.map(function (g) { return g.opsi.length + ' ' + g.nama.toLowerCase(); }).join(' · ')) + '</span>' : '') + '</div>' +
          '</div>' +
        '</div>' +
      '</article>';
    }

    /* ---------------- data ---------------- */
    var products = [];
    try { products = await T.listProducts(); }
    catch (e) {
      els.grid.setAttribute('aria-busy', 'false');
      els.grid.innerHTML = '<div class="alert alert--err" role="alert">' + icon('alert-triangle') + '<div><p class="alert__title">Katalog belum dapat dimuat</p><p>' + h(e.message) + '</p></div></div>';
      products = [];
    }
    var counts = {}; T.KATEGORI.forEach(function (k) { counts[k] = 0; });
    products.forEach(function (p) { counts[p.kategori]++; });

    /* ---------------- collections ---------------- */
    els.tiles.innerHTML = T.KATEGORI.map(function (k, i) {
      var info = T.KATEGORI_INFO[k], n = counts[k];
      return '<li class="tk-tile' + (n ? '' : ' is-empty') + '">' +
        '<button type="button" class="tk-tile__btn" data-kat="' + h(k) + '"' + (n ? '' : ' aria-disabled="true"') + '>' +
          '<span class="tk-tile__num">' + U.pad(i + 1) + '</span>' +
          '<span class="tk-tile__icon">' + icon(info.icon, { size: 24 }) + '</span>' +
          '<span class="tk-tile__name">' + h(k) + '</span>' +
          '<span class="tk-tile__desc">' + h(info.desc) + '</span>' +
          '<span class="tk-tile__count">' + (n ? U.formatNumber(n) + ' produk' : 'Segera hadir') + '</span>' +
        '</button></li>';
    }).join('');
    els.tiles.addEventListener('click', function (e) {
      var b = e.target.closest('[data-kat]'); if (!b) return;
      if (b.getAttribute('aria-disabled') === 'true') { ui.toast('Produk koleksi ' + b.dataset.kat + ' sedang disiapkan sekretariat.', { type: 'info' }); return; }
      state.kat = b.dataset.kat; render(); sync();
      document.getElementById('katalog').scrollIntoView({ behavior: PPAPI.motion.prefersReduced() ? 'auto' : 'smooth', block: 'start' });
    });

    memberNote(products);

    /* ---------------- empty catalogue ---------------- */
    if (!products.length) {
      els.grid.hidden = true; els.grid.setAttribute('aria-busy', 'false');
      els.toolbar.hidden = true;
      els.empty.hidden = false;
      els.empty.innerHTML = '<div class="tk-soon">' +
        '<div class="tk-soon__mark" aria-hidden="true">' + icon('briefcase', { size: 30 }) + '</div>' +
        '<p class="eyebrow eyebrow--center">Segera Dibuka</p>' +
        '<h3 class="tk-soon__title">Katalog sedang <em>disiapkan</em></h3>' +
        '<p class="tk-soon__text">Sekretariat PPAPI tengah menyiapkan produk pertama — suvenir, pakaian, aksesori, klem dan komponen perancah, serta produk pengetahuan dalam bentuk soft file maupun cetak. Silakan kembali dalam waktu dekat.</p>' +
        '<div class="tk-soon__actions"><a class="btn btn--ghost" href="pustaka.html"><span>Jelajahi Produk Pengetahuan</span><span data-icon="arrow-right" data-icon-class="btn__icon" data-icon-size="18"></span></a>' +
        '<a class="btn btn--link" href="umpan-balik.html"><span>Hubungi sekretariat</span><span data-icon="arrow-right" data-icon-class="btn__icon" data-icon-size="18"></span></a></div>' +
      '</div>';
      els.count.textContent = '';
      ui.reveal(els.empty); ui.reveal(els.tiles);
      openFromQuery();
      return;
    }
    els.toolbar.hidden = false;

    /* ---------------- chips / filtering ---------------- */
    function chips() {
      var list = [''].concat(T.KATEGORI.filter(function (k) { return counts[k]; }));
      els.chips.innerHTML = list.map(function (k) {
        return '<button type="button" class="chip" data-chip="' + h(k) + '" aria-pressed="' + (state.kat === k) + '">' + h(k || 'Semua') +
          ' <span class="chip__count">' + U.formatNumber(k ? counts[k] : products.length) + '</span></button>';
      }).join('');
    }
    function filtered() {
      var words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
      var list = products.filter(function (p) {
        if (state.kat && p.kategori !== state.kat) return false;
        if (!words.length) return true;
        var hay = [p.nama, p.kode, p.ringkasan, p.kategori].join(' ').toLowerCase();
        return words.every(function (w) { return hay.indexOf(w) !== -1; });
      });
      var price = function (p) { return T.fromPrice(p, member).min.harga; };
      if (state.sort === 'murah') list.sort(function (a, b) { return price(a) - price(b); });
      else if (state.sort === 'mahal') list.sort(function (a, b) { return price(b) - price(a); });
      else if (state.sort === 'terbaru') list.sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); });
      return list;
    }
    function render() {
      chips();
      var list = filtered();
      els.grid.setAttribute('aria-busy', 'false');
      els.count.textContent = list.length ? U.formatNumber(list.length) + ' produk' + (state.kat ? ' dalam koleksi ' + state.kat : '') + (state.q ? ' untuk “' + state.q + '”' : '') : '';
      if (!list.length) {
        els.grid.hidden = true; els.empty.hidden = false;
        els.empty.innerHTML = ui.emptyState({ icon: 'search', title: 'Produk tidak ditemukan', text: 'Coba kata kunci lain atau tampilkan semua koleksi.', actionHtml: '<button type="button" class="btn btn--ghost btn--sm" data-reset><span>Tampilkan semua produk</span></button>' });
        ui.reveal(els.empty);
        return;
      }
      els.empty.hidden = true; els.grid.hidden = false;
      els.grid.innerHTML = list.map(card).join('');
      ui.reveal(els.grid);
    }
    function sync() {
      var p = new URLSearchParams();
      if (state.kat) p.set('kategori', T.KATEGORI_INFO[state.kat].slug);
      if (state.q) p.set('q', state.q);
      if (state.sort !== 'unggulan') p.set('urut', state.sort);
      var s = p.toString();
      history.replaceState(history.state, '', location.pathname + (s ? '?' + s : '') + location.hash);
    }
    els.chips.addEventListener('click', function (e) { var c = e.target.closest('[data-chip]'); if (!c) return; state.kat = c.dataset.chip; render(); sync(); });
    els.q.addEventListener('input', U.debounce(function () { state.q = els.q.value.trim().slice(0, 80); render(); sync(); }, 180));
    els.sort.addEventListener('change', function () { state.sort = els.sort.value; render(); sync(); });
    els.toolbar.addEventListener('submit', function (e) { e.preventDefault(); });
    els.empty.addEventListener('click', function (e) { if (e.target.closest('[data-reset]')) { state.kat = ''; state.q = ''; els.q.value = ''; render(); sync(); } });
    els.grid.addEventListener('click', function (e) { var b = e.target.closest('[data-open]'); if (b) openProduct(b.dataset.open, b); });
    render();
    ui.reveal(els.tiles);

    /* ---------------- product detail ---------------- */
    function radioGroup(name, label, options, selected, extraCls) {
      return '<fieldset class="tk-opt' + (extraCls ? ' ' + extraCls : '') + '"><legend class="field__label">' + h(label) + '</legend>' +
        '<div class="segmented" role="radiogroup" aria-label="' + h(label) + '">' + options.map(function (o) {
          return '<label><input type="radio" name="' + h(name) + '" value="' + h(o.value) + '"' + (o.value === selected ? ' checked' : '') + (o.disabled ? ' disabled' : '') + '><span class="segmented__option">' + h(o.label) + '</span></label>';
        }).join('') + '</div><p class="field__error">Pilih ' + h(label.toLowerCase()) + '.</p></fieldset>';
    }
    function openProduct(id, opener) {
      var p = products.filter(function (x) { return x.id === id; })[0];
      if (!p) { ui.toast('Produk tidak ditemukan atau sudah tidak tersedia.', { type: 'warn' }); return; }
      var formats = T.formatsOf(p);
      var firstOk = formats.filter(function (f) { return T.inStock(p, f); })[0] || formats[0];
      var body =
        '<div class="tk-detail">' +
          '<div class="tk-gallery" data-g>' +
            '<div class="tk-gallery__main">' + media(p, 'tk-gallery__img') + '</div>' +
            '<div class="tk-gallery__thumbs" data-g-thumbs hidden></div>' +
          '</div>' +
          '<form class="tk-detail__info form" novalidate data-d-form>' +
            (p.kode ? '<p class="tk-detail__code">' + h(p.kode) + '</p>' : '') +
            '<div class="tk-detail__price" data-d-price aria-live="polite"></div>' +
            (p.ringkasan ? '<p class="tk-detail__lead">' + h(p.ringkasan) + '</p>' : '') +
            (formats.length > 1 || T.isKnowledge(p) ? radioGroup('d-format', 'Format', formats.map(function (f) { return { value: f, label: f === 'soft' ? 'Soft file (PDF)' : 'Cetak', disabled: !T.inStock(p, f) }; }), firstOk) : '') +
            p.varian.map(function (g, i) { return radioGroup('d-var-' + i, g.nama, g.opsi.map(function (o) { var t = (g.tambahan || {})[o]; return { value: o, label: t ? o + ' (+' + R(t) + ')' : o }; }), g.opsi.length === 1 ? g.opsi[0] : '', 'tk-opt--var'); }).join('') +
            '<div class="tk-qtyrow" data-d-qtyrow><label class="field__label" for="d-qty">Jumlah</label>' +
              '<div class="tk-qty"><button type="button" class="tk-qty__btn" data-step="-1" aria-label="Kurangi jumlah">' + icon('minus', { size: 16 }) + '</button>' +
              '<input class="tk-qty__input" id="d-qty" type="number" inputmode="numeric" min="1" max="99" value="1">' +
              '<button type="button" class="tk-qty__btn" data-step="1" aria-label="Tambah jumlah">' + icon('plus', { size: 16 }) + '</button></div>' +
              '<span class="tk-qtyrow__stock" data-d-stock></span></div>' +
            '<p class="tk-detail__note" data-d-note></p>' +
            (p.deskripsi ? '<div class="tk-detail__desc">' + PPAPI.util.richText(p.deskripsi) + '</div>' : '') +
          '</form>' +
        '</div>';
      var m = ui.modal({
        title: p.nama, eyebrow: p.kategori, size: 'lg', body: body, cls: 'tk-modal',
        actions: [
          { label: 'Beli Sekarang', variant: 'ghost', onClick: function () { return add(true); } },
          { label: 'Tambah ke Keranjang', variant: 'primary', id: 'd-add', onClick: function () { return add(false); } }
        ],
        onOpen: function (el) { wire(el); },
        onClose: function () {
          var s = new URLSearchParams(location.search); s.delete('produk');
          history.replaceState(history.state, '', location.pathname + (s.toString() ? '?' + s : '') + location.hash);
          if (opener && document.contains(opener)) opener.focus();
        }
      });
      var root = m.el;
      var s0 = new URLSearchParams(location.search); s0.set('produk', p.id);
      history.replaceState(history.state, '', location.pathname + '?' + s0 + location.hash);

      function chosen() {
        var fEl = root.querySelector('input[name="d-format"]:checked');
        var format = T.isKnowledge(p) ? (fEl ? fEl.value : formats[0]) : 'fisik';
        var varian = {}, missing = [];
        p.varian.forEach(function (g, i) {
          var v = root.querySelector('input[name="d-var-' + i + '"]:checked');
          if (v) varian[g.nama] = v.value; else missing.push(i);
        });
        var qty = format === 'soft' ? 1 : Math.max(1, Math.min(99, parseInt(root.querySelector('#d-qty').value, 10) || 1));
        return { format: format, varian: varian, missing: missing, qty: qty };
      }
      function paint() {
        var c = chosen(), pr = T.priceFor(p, c.format, member, c.varian);
        var anyMember = T.priceFor(p, c.format, true, c.varian);
        root.querySelector('[data-d-price]').innerHTML =
          '<span class="tk-detail__amount">' + h(R(pr.harga)) + '</span>' +
          (pr.anggota ? '<span class="tk-detail__was"><s>' + h(R(pr.normal)) + '</s> · harga anggota</span>' :
            (anyMember.anggota ? '<span class="tk-detail__was">Harga anggota Aktif ' + h(R(anyMember.harga)) + '</span>' : ''));
        var soft = c.format === 'soft';
        root.querySelector('[data-d-qtyrow]').hidden = soft;
        var left = T.stockLeft(p, c.format);
        var stockEl = root.querySelector('[data-d-stock]');
        stockEl.textContent = soft || left === Infinity ? '' : (left === 0 ? 'Stok habis' : 'Stok ' + U.formatNumber(left));
        var q = root.querySelector('#d-qty'); if (left !== Infinity) q.max = String(Math.max(1, Math.min(99, left)));
        root.querySelector('[data-d-note]').innerHTML = soft
          ? icon('shield-check', { size: 18 }) + '<span>Soft file PDF dapat diunduh dari <strong>Pesanan Saya</strong> setelah pembayaran dikonfirmasi. Setiap halaman berkas dibubuhi tanda air identitas pembeli (nama, email, dan nomor pesanan), lalu berkas dikunci dengan kata sandi berupa email Anda: dapat dibaca dan dicetak, tetapi tidak dapat diubah atau disalin.</span>'
          : icon('map-pin', { size: 18 }) + '<span>' + (T.isKnowledge(p) ? 'Dokumen cetak' : 'Barang') + ' dikirim ke alamat rumah atau kantor Anda. Ongkos kirim tercantum saat pemesanan.</span>';
        var addBtn = document.getElementById('d-add');
        var out = left === 0;
        if (addBtn) addBtn.disabled = out;
        root.querySelectorAll('.modal__footer .btn').forEach(function (b) { b.disabled = out; });
      }
      function wire(el) {
        root = el;
        el.addEventListener('change', function (e) { if (e.target.matches('input[type=radio]')) { var fs = e.target.closest('.tk-opt'); if (fs) fs.classList.remove('is-invalid'); paint(); } });
        el.addEventListener('input', function (e) { if (e.target.id === 'd-qty') paint(); });
        el.addEventListener('click', function (e) {
          var b = e.target.closest('[data-step]'); if (!b) return;
          var q = el.querySelector('#d-qty'), max = parseInt(q.max, 10) || 99;
          q.value = String(Math.max(1, Math.min(max, (parseInt(q.value, 10) || 1) + Number(b.dataset.step))));
          paint();
        });
        el.querySelector('[data-d-form]').addEventListener('submit', function (e) { e.preventDefault(); });
        paint();
        /* full-size photos */
        if (p.fotoCount > 0) {
          T.getMedia(p.id).then(function (foto) {
            if (!foto.length) return;
            var main = el.querySelector('.tk-gallery__main');
            var show = function (i) {
              main.innerHTML = '<img class="tk-gallery__img" src="' + h(foto[i]) + '" alt="' + h(p.nama + ' — foto ' + (i + 1)) + '" decoding="async">';
              el.querySelectorAll('[data-g-i]').forEach(function (t) { t.setAttribute('aria-pressed', String(Number(t.dataset.gI) === i)); });
            };
            var th = el.querySelector('[data-g-thumbs]');
            if (foto.length > 1) {
              th.hidden = false;
              th.innerHTML = foto.map(function (f, i) { return '<button type="button" class="tk-gallery__thumb" data-g-i="' + i + '" aria-pressed="' + (i === 0) + '" aria-label="Foto ' + (i + 1) + '"><img src="' + h(f) + '" alt="" width="72" height="72"></button>'; }).join('');
              th.addEventListener('click', function (e) { var t = e.target.closest('[data-g-i]'); if (t) show(Number(t.dataset.gI)); });
            }
            show(0);
          }).catch(function (e) { console.warn('[PPAPI] Foto produk belum dapat dimuat:', e && e.message); });
        }
      }
      async function add(goCart) {
        var c = chosen();
        if (c.missing.length) {
          c.missing.forEach(function (i) { var fs = root.querySelectorAll('.tk-opt--var')[i]; if (fs) fs.classList.add('is-invalid'); });
          var first = root.querySelectorAll('.tk-opt--var')[c.missing[0]];
          if (first) { var inp = first.querySelector('input'); if (inp) inp.focus(); }
          ui.toast('Pilih ' + c.missing.map(function (i) { return p.varian[i].nama.toLowerCase(); }).join(' dan ') + ' terlebih dahulu.', { type: 'warn' });
          return false;
        }
        var left = T.stockLeft(p, c.format);
        var inCart = T.cart.items().filter(function (it) { return it.productId === p.id && it.format === c.format; }).reduce(function (n, it) { return n + it.qty; }, 0);
        if (left !== Infinity && inCart + c.qty > left) {
          ui.toast(left - inCart > 0 ? 'Stok tersisa ' + left + '; ' + inCart + ' sudah ada di keranjang Anda.' : 'Seluruh stok produk ini sudah ada di keranjang Anda.', { type: 'warn' });
          return false;
        }
        await T.cart.add({ productId: p.id, format: c.format, varian: c.varian, qty: c.qty });
        if (goCart) { location.href = 'keranjang.html'; return; }
        ui.toast(p.nama + ' ditambahkan ke keranjang.', { type: 'success' });
      }
    }
    function openFromQuery() {
      var id = U.qs('produk');
      if (id && products.length) openProduct(id);
      else if (id) ui.toast('Produk tidak ditemukan atau sudah tidak tersedia.', { type: 'warn' });
    }
    openFromQuery();
  });
})();
