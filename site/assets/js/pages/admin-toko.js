/* ==========================================================================
   PPAPI — Konsol Admin › Toko  (admin-toko.js)
   Mendaftarkan bagian "Toko" untuk admin.html:
     window.PPAPI_ADMIN_SECTIONS = [...].concat({ key:'toko', label:'Toko', icon:'briefcase', title, lead,
                                                 render(container), badge() })
   render(container) boleh dipanggil berulang (setiap kali bagian dibuka / "Muat Ulang Data").
   badge() → Promise<number> jumlah pesanan yang perlu ditindaklanjuti (untuk penghitung menu).
   Memerlukan assets/js/store-toko.js (PPAPI.toko). Gaya: assets/css/pages/admin-toko.css
   (dimuat otomatis oleh berkas ini bila belum ditautkan di admin.html).
   ========================================================================== */
(function (w) {
  'use strict';

  var state = { tab: 'pesanan', status: 'perlu', q: '', container: null };
  var ACTION_STATUSES = ['Menunggu Konfirmasi', 'Dibayar', 'Diproses'];

  function ensureCss() {
    if (document.querySelector('link[data-admin-toko-css]') || document.querySelector('link[href$="pages/admin-toko.css"]')) return;
    var l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = 'assets/css/pages/admin-toko.css'; l.setAttribute('data-admin-toko-css', '');
    document.head.appendChild(l);
  }

  function render(container) {
    ensureCss();
    state.container = container;
    var U = PPAPI.util, h = U.h, icon = PPAPI.icon;
    if (!PPAPI.toko) {
      container.innerHTML = '<div class="alert alert--err" role="alert">' + icon('alert-triangle') + '<div><p class="alert__title">Modul toko belum dimuat</p><p>Tautkan assets/js/store-toko.js sebelum admin-toko.js di admin.html.</p></div></div>';
      return;
    }
    var tabs = [['pesanan', 'Pesanan', 'file-text'], ['produk', 'Produk', 'grid'], ['pengaturan', 'Pengaturan', 'settings']];
    container.innerHTML =
      '<div class="atk" data-atk>' +
        (PPAPI.toko.mode === 'local' ? '<p class="atk-demo">' + icon('info', { size: 16 }) + 'Mode Demo: produk, pesanan, dan pengaturan toko tersimpan di peramban ini saja.</p>' : '') +
        '<div class="atk-tabs" role="tablist" aria-label="Bagian toko">' + tabs.map(function (t) {
          return '<button type="button" role="tab" class="atk-tab" id="atk-tab-' + t[0] + '" data-atk-tab="' + t[0] + '" aria-controls="atk-panel" aria-selected="' + (state.tab === t[0]) + '" tabindex="' + (state.tab === t[0] ? '0' : '-1') + '">' + icon(t[2], { size: 16 }) + '<span>' + t[1] + '</span><span class="atk-tab__n" data-atk-n="' + t[0] + '" hidden></span></button>';
        }).join('') + '</div>' +
        '<div class="atk-panel" id="atk-panel" role="tabpanel" aria-labelledby="atk-tab-' + state.tab + '" tabindex="-1" aria-busy="true">' + PPAPI.ui.skeleton(4) + '</div>' +
      '</div>';
    var root = container.querySelector('[data-atk]');
    var list = root.querySelector('.atk-tabs');
    list.addEventListener('click', function (e) { var b = e.target.closest('[data-atk-tab]'); if (b) select(b.dataset.atkTab, true); });
    list.addEventListener('keydown', function (e) {
      var all = Array.prototype.slice.call(list.querySelectorAll('[data-atk-tab]')), i = all.indexOf(document.activeElement);
      if (i === -1) return;
      var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? all.length - 1 : null;
      if (n === null) return;
      e.preventDefault(); n = (n + all.length) % all.length; all[n].focus(); select(all[n].dataset.atkTab, false);
    });
    function select(key, focusPanel) {
      state.tab = key;
      list.querySelectorAll('[data-atk-tab]').forEach(function (b) { var on = b.dataset.atkTab === key; b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1; });
      var panel = root.querySelector('#atk-panel');
      panel.setAttribute('aria-labelledby', 'atk-tab-' + key);
      void focusPanel;
      paint();
    }
    paint();
  }

  async function paint() {
    var c = state.container; if (!c) return;
    var panel = c.querySelector('#atk-panel'); if (!panel) return;
    panel.setAttribute('aria-busy', 'true');
    try {
      if (state.tab === 'produk') await paintProducts(panel);
      else if (state.tab === 'pengaturan') await paintSettings(panel);
      else await paintOrders(panel);
    } catch (e) {
      panel.innerHTML = '<div class="alert alert--err" role="alert">' + PPAPI.icon('alert-triangle') + '<div><p class="alert__title">Data toko belum dapat dimuat</p><p>' + PPAPI.util.h(e.message) + '</p></div></div>';
    }
    panel.setAttribute('aria-busy', 'false');
    PPAPI.ui.reveal(panel);
    counts();
  }
  async function counts() {
    try {
      var s = await PPAPI.toko.admin.summary();
      var el = state.container && state.container.querySelector('[data-atk-n="pesanan"]');
      if (el) { el.textContent = s.perluTindakan; el.hidden = !s.perluTindakan; }
    } catch (e) { /* ignore */ }
  }

  /* ============================== ORDERS ============================== */
  async function paintOrders(panel) {
    var U = PPAPI.util, h = U.h, icon = PPAPI.icon, T = PPAPI.toko, R = T.fmt.rupiah;
    var all = await T.admin.listOrders();
    var n = {}; T.STATUS.forEach(function (s) { n[s] = 0; }); all.forEach(function (o) { n[o.status]++; });
    var perlu = all.filter(function (o) { return ACTION_STATUSES.indexOf(o.status) !== -1; }).length;
    var filters = [['perlu', 'Perlu tindakan', perlu], ['', 'Semua', all.length]].concat(T.STATUS.map(function (s) { return [s, s, n[s]]; }));
    var words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    var shown = all.filter(function (o) {
      if (state.status === 'perlu' && ACTION_STATUSES.indexOf(o.status) === -1) return false;
      if (state.status && state.status !== 'perlu' && o.status !== state.status) return false;
      if (!words.length) return true;
      var hay = [o.id, o.buyer.name, o.buyer.email, o.buyer.phone, o.pengiriman && o.pengiriman.resi].concat(o.items.map(function (i) { return i.nama; })).join(' ').toLowerCase();
      return words.every(function (wd) { return hay.indexOf(wd) !== -1; });
    });
    panel.innerHTML =
      '<div class="atk-kpis">' +
        kpi('Menunggu konfirmasi', n['Menunggu Konfirmasi'], 'Bukti bayar perlu diperiksa', n['Menunggu Konfirmasi'] ? 'warn' : '') +
        kpi('Perlu dikirim', n['Dibayar'] + n['Diproses'], 'Sudah dibayar, belum dikirim', '') +
        kpi('Dalam pengiriman', n['Dikirim'], 'Menunggu diterima', '') +
        kpi('Menunggu pembayaran', n['Menunggu Pembayaran'], 'Belum ada bukti bayar', '') +
      '</div>' +
      '<div class="atk-toolbar">' +
        '<div class="field atk-toolbar__q"><label class="field__label" for="atk-q">Cari pesanan</label><div class="search-box"><span data-icon="search" data-icon-size="18"></span><input class="field__control" id="atk-q" type="search" maxlength="80" placeholder="Nomor pesanan, nama, email, resi" value="' + h(state.q) + '"><button type="button" class="search-box__clear" aria-label="Hapus pencarian"><span data-icon="close" data-icon-size="16"></span></button></div></div>' +
        '<div class="field atk-toolbar__st"><label class="field__label" for="atk-st">Status</label><select class="field__control" id="atk-st">' +
          filters.map(function (f) { return '<option value="' + h(f[0]) + '"' + (state.status === f[0] ? ' selected' : '') + '>' + h(f[1]) + ' (' + f[2] + ')</option>'; }).join('') + '</select></div>' +
        '<button type="button" class="btn btn--ghost btn--sm atk-toolbar__csv" data-atk="csv"' + (shown.length ? '' : ' disabled') + '><span data-icon="download" data-icon-size="16"></span><span>Ekspor CSV</span></button>' +
      '</div>' +
      '<p class="atk-count" role="status">' + U.formatNumber(shown.length) + ' pesanan</p>' +
      (shown.length ?
        '<div class="table-wrap"><table class="table atk-table"><caption class="sr-only">Daftar pesanan toko</caption><thead><tr><th scope="col">Pesanan</th><th scope="col">Pembeli</th><th scope="col">Produk</th><th scope="col">Total</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Aksi</span></th></tr></thead><tbody>' +
        shown.map(function (o) {
          return '<tr><td data-label="Pesanan"><span class="tk-mono atk-id">' + h(o.id) + '</span><span class="table__muted">' + h(U.formatDate(o.createdAt, { short: true, time: true })) + '</span></td>' +
            '<td data-label="Pembeli">' + h(o.buyer.name) + '<span class="table__muted">' + h(o.buyer.email || o.buyer.phone || '') + '</span></td>' +
            '<td data-label="Produk">' + h(o.items.map(function (i) { return i.qty + '× ' + i.nama; }).join(', ')) + '</td>' +
            '<td data-label="Total" class="atk-num">' + h(R(o.ringkasan.total)) + (o.ringkasan.ongkirFinal === false ? '<span class="table__muted">ongkir belum</span>' : '') + '</td>' +
            '<td data-label="Status">' + T.fmt.statusBadge(o.status) + '</td>' +
            '<td class="atk-actions"><button type="button" class="btn btn--ghost btn--sm" data-order="' + h(o.id) + '"><span>Detail</span><span class="sr-only"> pesanan ' + h(o.id) + '</span>' + icon('arrow-right', { size: 14, cls: 'btn__icon' }) + '</button></td></tr>';
        }).join('') + '</tbody></table></div>'
      : PPAPI.ui.emptyState({ icon: 'file-text', title: all.length ? 'Tidak ada pesanan pada filter ini' : 'Belum ada pesanan', text: all.length ? 'Ubah status atau kata kunci pencarian.' : 'Pesanan dari halaman Toko akan tampil di sini.' }));
    panel.querySelector('#atk-st').addEventListener('change', function (e) { state.status = e.target.value; paint(); });
    var q = panel.querySelector('#atk-q');
    q.addEventListener('input', U.debounce(function () { state.q = q.value.trim(); var pos = q.selectionStart; paint().then(function () { var q2 = state.container.querySelector('#atk-q'); if (q2) { q2.focus(); try { q2.setSelectionRange(pos, pos); } catch (e) { /* ignore */ } } }); }, 300));
    panel.querySelector('[data-atk="csv"]').addEventListener('click', function () {
      var csv = T.admin.exportOrdersCsv(shown);
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = 'pesanan-toko-ppapi-' + U.todayIso() + '.csv';
      document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      PPAPI.ui.toast('CSV ' + shown.length + ' pesanan diunduh.', { type: 'success' });
    });
    panel.querySelectorAll('[data-order]').forEach(function (b) { b.addEventListener('click', function () { openOrder(b.dataset.order); }); });
  }
  function kpi(label, value, note, tone) {
    var icon = PPAPI.icon;
    return '<div class="kpi' + (tone ? ' kpi--' + tone : '') + '"><div class="kpi__head"><span class="kpi__label">' + PPAPI.util.h(label) + '</span><span class="kpi__icon">' + icon('file-text', { size: 18 }) + '</span></div><p class="kpi__value">' + PPAPI.util.formatNumber(value) + '</p><p class="kpi__note">' + PPAPI.util.h(note) + '</p></div>';
  }

  function ask(o) {
    var ui = PPAPI.ui;
    return new Promise(function (resolve) {
      var done = false;
      ui.modal({
        title: o.title, size: 'sm', body: o.body,
        actions: [
          { label: 'Batal', variant: 'ghost', onClick: function () { done = true; resolve(null); } },
          { label: o.ok || 'Simpan', variant: o.danger ? 'danger' : 'primary', onClick: async function (close, ctx) {
            var v = o.collect ? o.collect(ctx.el) : true;
            if (v === false) return false;
            if (o.run) await o.run(v);
            done = true; resolve(v || true);
          } }
        ],
        onClose: function () { if (!done) resolve(null); }
      });
    });
  }
  function noteField(id, label, req, ph) {
    return '<div class="field mt-3"><label class="field__label" for="' + id + '">' + label + (req ? ' <span class="field__req" aria-hidden="true">*</span>' : ' <span class="opt">(opsional)</span>') + '</label><textarea class="field__control" id="' + id + '" rows="3" maxlength="1000"' + (ph ? ' placeholder="' + PPAPI.util.h(ph) + '"' : '') + '></textarea><p class="field__error">Minimal 5 huruf.</p></div>';
  }
  function needText(el, sel, min) {
    var t = el.querySelector(sel); var v = (t.value || '').trim();
    if (min && v.length < min) { t.closest('.field').classList.add('is-invalid'); t.setAttribute('aria-invalid', 'true'); t.focus(); return false; }
    return v;
  }

  async function openOrder(id) {
    var U = PPAPI.util, h = U.h, icon = PPAPI.icon, T = PPAPI.toko, R = T.fmt.rupiah, ui = PPAPI.ui;
    var o = await T.admin.getOrder(id);
    if (!o) { ui.toast('Pesanan tidak ditemukan.', { type: 'error' }); return; }
    var products = await T.admin.listProducts().catch(function () { return []; });
    var buyerMember = null;
    try { buyerMember = PPAPI.store.admin && PPAPI.store.admin.getMember ? await PPAPI.store.admin.getMember(o.uid) : null; } catch (e) { buyerMember = null; }
    var isMember = buyerMember ? U.isActiveMember(buyerMember) : false;
    var shopSettings = await T.getSettings().catch(function () { return null; });
    var issues = T.admin.priceCheck(o, products, isMember, shopSettings);
    if (o.hargaAnggota && !isMember) issues.push({ nama: 'Harga anggota', reason: 'Pesanan memakai harga anggota, tetapi status keanggotaan pembeli saat ini bukan Aktif.' });
    var p = o.pembayaran || {}, a = o.alamat, r = o.ringkasan;
    var mail = o.buyer.email ? 'mailto:' + encodeURIComponent(o.buyer.email) + '?subject=' + encodeURIComponent('Pesanan Toko PPAPI ' + o.id) + '&body=' + encodeURIComponent('Yth. ' + o.buyer.name + ',\n\nTerkait pesanan ' + o.id + ' (status: ' + o.status + ').\n\n\nSalam,\nSekretariat PPAPI') : '';
    var body =
      '<div class="drawer__section"><p class="atk-dstatus">' + T.fmt.statusBadge(o.status) + '<span>' + h(T.STATUS_TEXT[o.status]) + '</span></p>' +
        (issues.length ? '<div class="alert alert--warn" role="note" data-atk="price-warn">' + icon('alert-triangle') + '<div><p class="alert__title">Periksa harga sebelum konfirmasi</p><ul class="atk-issues">' + issues.map(function (i) { return '<li><strong>' + h(i.nama) + '</strong> — ' + h(i.reason) + (i.expected !== undefined && i.expected !== null ? ' (katalog ' + h(R(i.expected)) + ', pesanan ' + h(R(i.actual)) + ')' : '') + '</li>'; }).join('') + '</ul></div></div>' : '') +
        (o.alasanBatal ? '<p class="atk-note">Alasan pembatalan: ' + h(o.alasanBatal) + '</p>' : '') +
      '</div>' +
      '<div class="drawer__section"><h3 class="drawer__section-title">Pembeli</h3><dl class="kv">' +
        '<div class="kv__row"><dt>Nama</dt><dd>' + h(o.buyer.name) + '</dd></div>' +
        '<div class="kv__row"><dt>Email</dt><dd>' + (o.buyer.email ? '<a class="link" href="' + h(mail) + '">' + h(o.buyer.email) + '</a>' : '—') + '</dd></div>' +
        '<div class="kv__row"><dt>Telepon</dt><dd>' + h(o.buyer.phone || '—') + '</dd></div>' +
        '<div class="kv__row"><dt>Keanggotaan</dt><dd>' + (buyerMember ? U.statusBadge(U.effectiveStatus(buyerMember)) : '—') + '</dd></div>' +
        '<div class="kv__row"><dt>Dibuat</dt><dd>' + h(U.formatDate(o.createdAt, { time: true })) + '</dd></div>' +
      '</dl></div>' +
      '<div class="drawer__section"><h3 class="drawer__section-title">Produk</h3><ul class="atk-items">' + o.items.map(function (it) {
        return '<li><div><strong>' + h(it.nama) + '</strong><span>' + h([it.format !== 'fisik' ? T.FORMAT_LABEL[it.format] : '', it.varianLabel, it.kode].filter(Boolean).join(' · ')) + '</span></div><span class="atk-num">' + it.qty + ' × ' + h(R(it.harga)) + (it.hargaAnggota ? ' <span class="badge badge--outline">anggota</span>' : '') + '<br><strong>' + h(R(it.subtotal)) + '</strong></span></li>';
      }).join('') + '</ul>' +
      '<dl class="tk-sum atk-sum"><div class="tk-sum__row"><dt>Subtotal</dt><dd>' + h(R(r.subtotal)) + '</dd></div>' + (o.perluKirim ? '<div class="tk-sum__row"><dt>Ongkos kirim</dt><dd>' + (r.ongkirFinal === false ? 'Belum ditetapkan' : h(R(r.ongkir))) + '</dd></div>' : '') + '<div class="tk-sum__row tk-sum__row--total"><dt>Total</dt><dd>' + h(R(r.total)) + '</dd></div></dl></div>' +
      (a ? '<div class="drawer__section"><h3 class="drawer__section-title">Alamat pengiriman</h3><address class="atk-addr"><strong>' + h(a.nama) + '</strong> · ' + h(a.telepon) + '<br>' + h(a.alamat) + '<br>' + h(a.kota) + ', ' + h(a.provinsi) + ' ' + h(a.kodePos) + (a.catatan ? '<br>Catatan: ' + h(a.catatan) : '') + '</address>' +
        (o.pengiriman ? '<p class="atk-note">Dikirim melalui ' + h(o.pengiriman.kurir) + ' · resi <span class="tk-mono">' + h(o.pengiriman.resi) + '</span></p>' : '') + '</div>' : '') +
      '<div class="drawer__section"><h3 class="drawer__section-title">Pembayaran</h3>' + (p.buktiUrl ?
        '<dl class="kv"><div class="kv__row"><dt>Bukti</dt><dd><a class="link" href="' + h(p.buktiUrl) + '" target="_blank" rel="noopener noreferrer">Buka tautan bukti ' + icon('arrow-up-right', { size: 14 }) + '</a></dd></div>' +
        '<div class="kv__row"><dt>Tanggal transfer</dt><dd>' + h(U.formatDate(p.tanggal)) + '</dd></div>' +
        '<div class="kv__row"><dt>Jumlah</dt><dd>' + h(R(p.jumlah)) + (p.jumlah !== r.total ? ' <span class="badge badge--warn">berbeda dari total</span>' : ' <span class="badge badge--ok">sesuai total</span>') + '</dd></div>' +
        '<div class="kv__row"><dt>Pengirim</dt><dd>' + h(p.pengirim) + '</dd></div>' + (p.catatan ? '<div class="kv__row"><dt>Catatan</dt><dd>' + h(p.catatan) + '</dd></div>' : '') + '</dl>'
        : '<p class="atk-note">Belum ada bukti pembayaran.</p>') + (o.catatan ? '<p class="atk-note">Catatan pembeli: ' + h(o.catatan) + '</p>' : '') + '</div>' +
      '<div class="drawer__section"><h3 class="drawer__section-title">Riwayat</h3><ol class="atk-hist">' + o.riwayat.slice().reverse().map(function (e) {
        return '<li><time>' + h(U.formatDate(e.at, { short: true, time: true })) + '</time> <strong>' + h(e.status) + '</strong>' + (e.note ? ' — ' + h(e.note) : '') + ' <span>(' + (e.by === 'admin' ? 'admin' : 'pembeli') + ')</span></li>';
      }).join('') + '</ol></div>';

    function act(fn, msg) {
      return async function (close) {
        var res = await fn();
        if (res === null) return false;
        PPAPI.ui.toast(msg, { type: 'success' });
        close(); await paint(); openOrder(id);
      };
    }
    var actions = [];
    if (mail) actions.push({ label: 'Email Pembeli', variant: 'link', onClick: function () { location.href = mail; return false; } });
    if (o.isUnpaid) {
      actions.push({ label: 'Batalkan', variant: 'ghost', onClick: act(function () { return ask({ title: 'Batalkan pesanan ' + o.id + '?', ok: 'Batalkan pesanan', danger: true, body: noteField('atk-n', 'Alasan pembatalan', true), collect: function (el) { return needText(el, '#atk-n', 5); }, run: function (v) { return T.admin.cancel(o.id, v); } }); }, 'Pesanan dibatalkan.') });
      if (o.status === 'Menunggu Konfirmasi') actions.push({ label: 'Tolak Bukti', variant: 'ghost', onClick: act(function () { return ask({ title: 'Tolak bukti pembayaran', ok: 'Kembalikan ke pembeli', body: '<p>Status kembali ke Menunggu Pembayaran dan catatan Anda tampil bagi pembeli.</p>' + noteField('atk-n', 'Alasan', true, 'Contoh: nominal transfer belum sesuai total.'), collect: function (el) { return needText(el, '#atk-n', 5); }, run: function (v) { return T.admin.rejectPayment(o.id, v); } }); }, 'Bukti pembayaran dikembalikan.') });
      if (o.perluKirim) actions.push({ label: r.ongkirFinal === false ? 'Tetapkan Ongkir' : 'Ubah Ongkir', variant: 'ghost', onClick: act(function () {
        return ask({ title: 'Ongkos kirim', ok: 'Simpan ongkir', body: '<div class="field"><label class="field__label" for="atk-ong">Ongkos kirim (Rp) <span class="field__req" aria-hidden="true">*</span></label><input class="field__control" id="atk-ong" inputmode="numeric" maxlength="12" value="' + (r.ongkir !== null && r.ongkir !== undefined ? r.ongkir : '') + '"><p class="field__error">Isi angka rupiah.</p></div>' + noteField('atk-ongn', 'Keterangan untuk pembeli', false, 'Contoh: JNE REG ke Surabaya'),
          collect: function (el) { var v = el.querySelector('#atk-ong').value.replace(/\D/g, ''); if (!v) { el.querySelector('#atk-ong').closest('.field').classList.add('is-invalid'); return false; } return { v: Number(v), n: el.querySelector('#atk-ongn').value }; },
          run: function (x) { return T.admin.setShipping(o.id, x.v, x.n); } });
      }, 'Ongkos kirim disimpan; total pesanan diperbarui.') });
      actions.push({ label: 'Konfirmasi Pembayaran', variant: 'primary', id: 'atk-confirm', onClick: act(function () {
        if (o.perluKirim && r.ongkirFinal === false) { ui.toast('Tetapkan ongkos kirim terlebih dahulu agar total pesanan final.', { type: 'warn' }); return null; }
        return ask({ title: 'Konfirmasi pembayaran ' + o.id, ok: 'Ya, pembayaran diterima', body: '<p>Pastikan dana sebesar <strong>' + h(R(r.total)) + '</strong> telah masuk ke rekening PPAPI.' + (o.hasSoft ? ' Pembeli akan langsung dapat mengunduh soft file bertanda air.' : '') + ' Stok barang fisik dan cetak dikurangi otomatis.</p>' + (issues.length ? '<p class="atk-warn">' + icon('alert-triangle', { size: 16 }) + 'Ada perbedaan harga yang perlu diperiksa.</p>' : '') + noteField('atk-n', 'Catatan', false),
          collect: function (el) { return el.querySelector('#atk-n').value.trim() || ' '; }, run: function (v) { return T.admin.confirmPayment(o.id, v.trim()); } });
      }, 'Pembayaran dikonfirmasi.') });
    } else if (['Dibayar', 'Diproses', 'Dikirim'].indexOf(o.status) !== -1) {
      if (o.status !== 'Dikirim') actions.push({ label: 'Batalkan', variant: 'ghost', onClick: act(function () { return ask({ title: 'Batalkan pesanan yang sudah dibayar?', ok: 'Batalkan & cabut akses', danger: true, body: '<p>Hak unduh soft file dicabut dan stok dikembalikan. Pengembalian dana dilakukan sekretariat di luar sistem.</p>' + noteField('atk-n', 'Alasan pembatalan', true), collect: function (el) { return needText(el, '#atk-n', 5); }, run: function (v) { return T.admin.cancel(o.id, v); } }); }, 'Pesanan dibatalkan.') });
      if (o.status === 'Dibayar' && o.perluKirim) actions.push({ label: 'Proses', variant: 'ghost', onClick: act(function () { return T.admin.process(o.id); }, 'Pesanan ditandai diproses.') });
      if (o.perluKirim) actions.push({ label: o.status === 'Dikirim' ? 'Ubah Resi' : 'Kirim & Isi Resi', variant: o.status === 'Dikirim' ? 'ghost' : 'primary', id: 'atk-ship', onClick: act(function () {
        var s = o.pengiriman || {};
        return ask({ title: 'Data pengiriman', ok: 'Simpan', body: '<div class="field"><label class="field__label" for="atk-kurir">Kurir <span class="field__req" aria-hidden="true">*</span></label><input class="field__control" id="atk-kurir" maxlength="60" value="' + h(s.kurir || '') + '" placeholder="JNE, J&amp;T, POS Indonesia, …"><p class="field__error">Isi nama kurir.</p></div><div class="field mt-3"><label class="field__label" for="atk-resi">Nomor resi <span class="field__req" aria-hidden="true">*</span></label><input class="field__control" id="atk-resi" maxlength="60" value="' + h(s.resi || '') + '"><p class="field__error">Minimal 4 karakter.</p></div>',
          collect: function (el) { var k = needText(el, '#atk-kurir', 2); if (k === false) return false; var rs = needText(el, '#atk-resi', 4); if (rs === false) return false; return { kurir: k, resi: rs }; },
          run: function (x) { return T.admin.ship(o.id, x); } });
      }, 'Data pengiriman disimpan.') });
      if (o.status === 'Dikirim' || !o.perluKirim) actions.push({ label: 'Tandai Selesai', variant: 'primary', id: 'atk-done', onClick: act(function () { return T.admin.complete(o.id); }, 'Pesanan selesai.') });
    }
    ui.drawer({ title: 'Pesanan ' + o.id, eyebrow: 'Toko PPAPI', size: 'lg', body: body, actions: actions, cls: 'atk-drawer' });
  }

  /* ============================== PRODUCTS ============================== */
  async function paintProducts(panel) {
    var U = PPAPI.util, h = U.h, icon = PPAPI.icon, T = PPAPI.toko, R = T.fmt.rupiah;
    var list = await T.admin.listProducts();
    panel.innerHTML =
      '<div class="atk-toolbar atk-toolbar--products"><p class="atk-count">' + U.formatNumber(list.length) + ' produk · ' + U.formatNumber(list.filter(function (p) { return p.aktif; }).length) + ' tampil di toko</p>' +
      '<span class="atk-toolbar__acts"><label class="btn btn--ghost btn--sm" data-atk="import"><span data-icon="upload" data-icon-size="16"></span><span>Impor Produk</span><input type="file" accept=".json,application/json" class="sr-only" data-atk-import></label>' +
      '<button type="button" class="btn btn--primary btn--sm" data-atk="new"><span data-icon="plus" data-icon-size="16"></span><span>Tambah Produk</span></button></span></div>' +
      (list.length ? '<div class="table-wrap"><table class="table atk-table"><caption class="sr-only">Produk toko</caption><thead><tr><th scope="col">Produk</th><th scope="col">Kategori</th><th scope="col">Harga</th><th scope="col">Stok</th><th scope="col">Tampil</th><th scope="col"><span class="sr-only">Aksi</span></th></tr></thead><tbody>' +
        list.map(function (p) {
          var fp = T.fromPrice(p, false), mp = T.fromPrice(p, true);
          return '<tr><td data-label="Produk"><div class="atk-prod">' + (p.thumb ? '<img src="' + h(p.thumb) + '" alt="" width="48" height="48">' : '<span class="atk-prod__ph">' + icon(T.KATEGORI_INFO[p.kategori].icon, { size: 18 }) + '</span>') + '<span><strong>' + h(p.nama) + '</strong><span class="table__muted">' + h([p.kode, T.isKnowledge(p) ? T.formatsOf(p).map(function (f) { return f === 'soft' ? 'Soft file' : 'Cetak'; }).join(' + ') : '', p.varian.map(function (g) { return g.nama + ' (' + g.opsi.length + ')'; }).join(', ')].filter(Boolean).join(' · ')) + '</span></span></div></td>' +
            '<td data-label="Kategori">' + h(p.kategori) + '</td>' +
            '<td data-label="Harga" class="atk-num">' + (fp.many ? 'mulai ' : '') + h(R(fp.min.harga)) + (mp.min.anggota ? '<span class="table__muted">anggota ' + h(R(mp.min.harga)) + '</span>' : '') + '</td>' +
            '<td data-label="Stok">' + (T.formatsOf(p).every(function (f) { return f === 'soft'; }) ? '—' : p.stok === null ? 'Tidak dibatasi' : U.formatNumber(p.stok)) + (T.isKnowledge(p) && T.formatsOf(p).indexOf('soft') !== -1 ? (p.berkasAda ? ' <span class="badge badge--ok">berkas</span>' : ' <span class="badge badge--warn">tanpa berkas</span>') : '') + '</td>' +
            '<td data-label="Tampil">' + (p.aktif ? '<span class="badge badge--ok">Aktif</span>' : '<span class="badge badge--muted">Disembunyikan</span>') + '</td>' +
            '<td class="atk-actions"><button type="button" class="btn btn--ghost btn--sm" data-edit="' + h(p.id) + '"><span>Ubah</span><span class="sr-only"> ' + h(p.nama) + '</span></button><button type="button" class="icon-btn icon-btn--ghost icon-btn--sm" data-del="' + h(p.id) + '" aria-label="Hapus ' + h(p.nama) + '">' + icon('trash', { size: 16 }) + '</button></td></tr>';
        }).join('') + '</tbody></table></div>'
      : PPAPI.ui.emptyState({ icon: 'briefcase', title: 'Katalog masih kosong', text: 'Tambahkan produk pertama: suvenir, pakaian, aksesori, klem & komponen perancah, atau produk pengetahuan.', actionHtml: '<button type="button" class="btn btn--primary btn--sm" data-atk="new"><span>Tambah Produk</span></button>' }));
    panel.querySelectorAll('[data-atk="new"]').forEach(function (b) { b.addEventListener('click', function () { productForm(null); }); });
    var imp = panel.querySelector('[data-atk-import]');
    if (imp) imp.addEventListener('change', function () { var f = imp.files && imp.files[0]; imp.value = ''; if (f) importProducts(f, list); });
    panel.querySelectorAll('[data-edit]').forEach(function (b) { b.addEventListener('click', function () { productForm(list.filter(function (p) { return p.id === b.dataset.edit; })[0]); }); });
    panel.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', async function () {
        var p = list.filter(function (x) { return x.id === b.dataset.del; })[0];
        if (!(await PPAPI.ui.confirm('Hapus produk “' + p.nama + '” beserta fotonya dan tautan berkasnya? Pesanan lama tetap tersimpan. Untuk sekadar menyembunyikan, ubah produk dan matikan “Tampilkan di toko”.', { title: 'Hapus produk', okLabel: 'Hapus', danger: true }))) return;
        try { await T.admin.removeProduct(p.id); PPAPI.ui.toast('Produk dihapus.', { type: 'success' }); paint(); }
        catch (e) { PPAPI.ui.toast(e.message, { type: 'error' }); }
      });
    });
  }

  /* Impor produk dari berkas JSON {format: 'ppapi-toko-produk', produk: [{…produk, foto: [data:image/jpeg]}]}.
     Produk dengan id yang sudah ada diperbarui; foto JPEG ≤ 150 KB (maks. 3). */
  async function importProducts(file, list) {
    var T = PPAPI.toko, ui = PPAPI.ui;
    var data;
    try {
      if (file.size > 48 * 1024 * 1024) throw new Error('size');
      data = JSON.parse(await file.text());
      if (!data || data.format !== 'ppapi-toko-produk' || !Array.isArray(data.produk) || !data.produk.length) throw new Error('format');
    } catch (e) { ui.toast('Berkas bukan paket impor produk PPAPI yang sah.', { type: 'error' }); return; }
    var items = data.produk.slice(0, 50), ids = list.map(function (p) { return p.id; });
    var baru = items.filter(function (p) { return ids.indexOf(p.id) === -1; }).length;
    var ok = await ui.confirm(items.map(function (p) { return (p.nama || '(tanpa nama)') + ' (' + T.fmt.rupiah(Number(p.harga) || 0) + ')'; }).join(', ') + '. ' +
      baru + ' produk baru' + (items.length - baru ? ', ' + (items.length - baru) + ' produk yang sudah ada akan diperbarui' : '') + '.',
      { title: 'Impor ' + items.length + ' produk ke toko?', okLabel: 'Impor' });
    if (!ok) return;
    var done = 0, gagal = [];
    for (var i = 0; i < items.length; i++) {
      var raw = Object.assign({}, items[i]), foto = Array.isArray(raw.foto) ? raw.foto : undefined, berkas = raw.berkas;
      delete raw.foto; delete raw.berkas;
      try {
        var saved = await T.admin.saveProduct(raw, { foto: foto });
        if (berkas && typeof berkas.data === 'string' && /^data:application\/pdf;base64,/.test(berkas.data)) {
          var bin = atob(berkas.data.slice(berkas.data.indexOf(',') + 1)), bytes = new Uint8Array(bin.length);
          for (var j = 0; j < bin.length; j++) bytes[j] = bin.charCodeAt(j);
          await T.admin.saveFile(saved.id, bytes, berkas.nama);
        }
        done++;
      }
      catch (e) { gagal.push((raw.nama || 'Produk ' + (i + 1)) + ': ' + e.message); }
    }
    if (done) ui.toast(done + ' produk berhasil diimpor.', { type: 'success' });
    if (gagal.length) ui.toast('Gagal diimpor: ' + gagal.join('; '), { type: 'error' });
    paint();
  }

  async function productForm(p) {
    var U = PPAPI.util, h = U.h, icon = PPAPI.icon, T = PPAPI.toko, ui = PPAPI.ui;
    var isNew = !p;
    p = p || T.sanitizeProduct({ kategori: 'Suvenir', aktif: true });
    var foto = isNew ? [] : await T.getMedia(p.id).catch(function () { return []; });
    if (!foto.length && p.thumb) foto = [p.thumb];
    var fotoChanged = false;
    var fileUrl = isNew ? '' : await T.admin.getFile(p.id).catch(function () { return ''; });
    var fmeta = isNew ? { parts: 0 } : await T.admin.getFileMeta(p.id).catch(function () { return { parts: 0 }; });
    var pdfNew;   // undefined = tidak berubah, File = ganti, null = hapus berkas unggahan
    var know = T.isKnowledge(p);
    function num(v) { return v === null || v === undefined ? '' : String(v); }
    function fld(id, label, input, opts) { opts = opts || {}; return '<div class="field' + (opts.cls ? ' ' + opts.cls : '') + '"><label class="field__label" for="' + id + '">' + label + (opts.req ? ' <span class="field__req" aria-hidden="true">*</span>' : ' <span class="opt">(opsional)</span>') + '</label>' + input + (opts.hint ? '<p class="field__hint">' + opts.hint + '</p>' : '') + '<p class="field__error">' + (opts.err || 'Kolom ini wajib diisi.') + '</p></div>'; }
    function inp(id, val, extra) { return '<input class="field__control" id="' + id + '" value="' + h(val) + '" ' + (extra || '') + '>'; }
    var body =
      '<form class="form atk-form" novalidate data-pf>' +
        '<div class="drawer__section"><h3 class="drawer__section-title">Identitas produk</h3>' +
          fld('pf-nama', 'Nama produk', inp('pf-nama', p.nama, 'maxlength="120" required'), { req: true, err: 'Minimal 3 huruf.' }) +
          '<div class="form__row form__row--2">' +
            fld('pf-kat', 'Kategori', '<select class="field__control" id="pf-kat">' + T.KATEGORI.map(function (k) { return '<option' + (k === p.kategori ? ' selected' : '') + '>' + h(k) + '</option>'; }).join('') + '</select>', { req: true }) +
            fld('pf-kode', 'Kode / SKU', inp('pf-kode', p.kode, 'maxlength="40" placeholder="Contoh: PPAPI-CoP-01"')) +
          '</div>' +
          fld('pf-ring', 'Ringkasan', '<textarea class="field__control" id="pf-ring" rows="2" maxlength="300">' + h(p.ringkasan) + '</textarea>', { hint: 'Tampil di kartu katalog (maks. 300 karakter).' }) +
          fld('pf-desk', 'Deskripsi', '<textarea class="field__control" id="pf-desk" rows="5" maxlength="4000">' + h(p.deskripsi) + '</textarea>', { hint: 'Bahan, ukuran, isi dokumen, dan informasi lain. Pisahkan paragraf dengan baris kosong.' }) +
        '</div>' +
        '<div class="drawer__section" data-pf-know' + (know ? '' : ' hidden') + '><h3 class="drawer__section-title">Format produk pengetahuan</h3>' +
          '<div class="atk-checks"><label class="check"><input type="checkbox" id="pf-soft"' + (!know || (p.format && p.format.soft) ? ' checked' : '') + '><span class="check__box"></span><span class="check__label">Soft file (PDF bertanda air)</span></label>' +
          '<label class="check"><input type="checkbox" id="pf-cetak"' + (know && p.format && p.format.cetak ? ' checked' : '') + '><span class="check__box"></span><span class="check__label">Cetak (dikirim)</span></label></div>' +
          '<div class="atk-pdf mt-3"><p class="field__label">Berkas PDF (disimpan privat di situs)</p><div data-pf-pdf></div>' +
            '<div class="atk-pdf__acts"><label class="btn btn--ghost btn--sm"><span data-icon="upload" data-icon-size="16"></span><span>Pilih PDF</span><input type="file" accept="application/pdf,.pdf" class="sr-only" data-pf-pdf-file></label>' +
            '<button type="button" class="btn btn--link btn--sm" data-pf-pdf-rm hidden>Hapus berkas</button></div>' +
            '<p class="field__hint">PDF tanpa kata sandi, maks. 30 MB. Hanya admin dan pembeli yang pembayarannya dikonfirmasi yang dapat mengambilnya. Saat diunduh, setiap halaman dibubuhi tanda air nama, email, dan nomor pesanan pembeli, lalu berkas dikunci: dibuka dengan kata sandi berupa email pembeli, dapat dicetak, tetapi tidak dapat diubah atau disalin.</p></div>' +
          fld('pf-file', 'Atau tautan privat berkas PDF', inp('pf-file', fileUrl, 'type="url" maxlength="1000" placeholder="https://…/berkas.pdf"'), { cls: 'mt-3', hint: 'Dipakai bila tidak ada berkas unggahan. Tautan harus mengarah langsung ke PDF dan penyimpanannya mengizinkan pengambilan dari situs ini (CORS); tautan Google Drive biasa tidak dapat dibubuhi tanda air.', err: 'Tautan harus diawali https://.' }) +
          fld('pf-hal', 'Jumlah halaman', inp('pf-hal', num(p.halaman), 'inputmode="numeric" maxlength="6"')) +
        '</div>' +
        '<div class="drawer__section"><h3 class="drawer__section-title">Harga &amp; stok</h3>' +
          '<div class="form__row form__row--2" data-pf-price-main>' +
            fld('pf-harga', '<span data-pf-hl>' + (know ? 'Harga soft file (Rp)' : 'Harga (Rp)') + '</span>', inp('pf-harga', num(isNew ? '' : p.harga), 'inputmode="numeric" maxlength="12" required'), { req: true, err: 'Isi harga dalam rupiah.' }) +
            fld('pf-hang', 'Harga anggota Aktif (Rp)', inp('pf-hang', num(p.hargaAnggota), 'inputmode="numeric" maxlength="12"'), { hint: 'Kosongkan bila tidak ada; harus lebih rendah dari harga biasa.' }) +
          '</div>' +
          '<div class="form__row form__row--2" data-pf-price-cetak' + (know && p.format && p.format.cetak ? '' : ' hidden') + '>' +
            fld('pf-hcetak', 'Harga cetak (Rp)', inp('pf-hcetak', num(p.hargaCetak), 'inputmode="numeric" maxlength="12"'), { err: 'Isi harga cetak.' }) +
            fld('pf-hcetakang', 'Harga cetak anggota (Rp)', inp('pf-hcetakang', num(p.hargaCetakAnggota), 'inputmode="numeric" maxlength="12"')) +
          '</div>' +
          '<div class="form__row form__row--2">' +
          fld('pf-stok', 'Stok', inp('pf-stok', num(p.stok), 'inputmode="numeric" maxlength="7"'), { hint: 'Untuk barang fisik dan versi cetak. Kosongkan bila tidak dibatasi; stok berkurang otomatis saat pembayaran dikonfirmasi.' }) +
          fld('pf-berat', 'Berat kirim per unit (gram)', inp('pf-berat', num(p.berat), 'inputmode="numeric" maxlength="6"'), { hint: 'Termasuk kemasan. Dipakai menghitung ongkos kirim otomatis; kosong = ongkir dikonfirmasi sekretariat.' }) +
          '</div>' +
        '</div>' +
        '<div class="drawer__section"><h3 class="drawer__section-title">Varian</h3><p class="atk-note">Misalnya Ukuran: S, M, L, XL — atau Warna: Hitam, Abu. Biaya tambahan ditulis setelah pilihan, mis. <strong>XXL +5000</strong>. Maks. 2 kelompok, 12 pilihan per kelompok.</p>' +
          [0, 1].map(function (i) { var g = p.varian[i] || { nama: '', opsi: [] }; return '<div class="form__row form__row--2">' + fld('pf-vn' + i, 'Nama varian ' + (i + 1), inp('pf-vn' + i, g.nama, 'maxlength="30" placeholder="' + (i ? 'Warna' : 'Ukuran') + '"')) + fld('pf-vo' + i, 'Pilihan (pisahkan dengan koma)', inp('pf-vo' + i, g.opsi.map(function (o) { var t = (g.tambahan || {})[o]; return t ? o + ' +' + t : o; }).join(', '), 'maxlength="400" placeholder="' + (i ? 'Hitam, Abu' : 'S, M, L, XL, XXL +5000') + '"')) + '</div>'; }).join('') +
        '</div>' +
        '<div class="drawer__section"><h3 class="drawer__section-title">Foto</h3><p class="atk-note">Maks. 3 foto; otomatis diperkecil menjadi JPEG ≤ 150 KB. Foto pertama menjadi sampul.</p>' +
          '<div class="atk-photos" data-pf-photos></div>' +
          '<div class="atk-photo-acts"><label class="btn btn--ghost btn--sm atk-upload"><span data-icon="upload" data-icon-size="16"></span><span>Pilih foto</span><input type="file" accept="image/jpeg,image/png,image/webp" multiple data-pf-file class="sr-only"></label>' +
          '<button type="button" class="btn btn--ghost btn--sm" data-pf-wm-all><span data-icon="shield" data-icon-size="16"></span><span>Bubuhkan tanda air ke foto saat ini</span></button></div>' +
          '<label class="check mt-3"><input type="checkbox" id="pf-wm" checked><span class="check__box"></span><span class="check__label">Bubuhkan tanda air PPAPI pada foto yang diunggah</span></label>' +
        '</div>' +
        '<div class="drawer__section"><h3 class="drawer__section-title">Tampilan</h3><div class="atk-checks">' +
          '<label class="check"><input type="checkbox" id="pf-aktif"' + (p.aktif ? ' checked' : '') + '><span class="check__box"></span><span class="check__label">Tampilkan di toko</span></label>' +
          '<label class="check"><input type="checkbox" id="pf-ung"' + (p.unggulan ? ' checked' : '') + '><span class="check__box"></span><span class="check__label">Produk unggulan (tampil lebih dahulu)</span></label></div>' +
          fld('pf-urut', 'Urutan', inp('pf-urut', num(p.urutan || ''), 'inputmode="numeric" maxlength="4"'), { cls: 'mt-3', hint: 'Angka kecil tampil lebih dahulu.' }) +
        '</div>' +
      '</form>';
    var dr = ui.drawer({
      title: isNew ? 'Produk baru' : 'Ubah produk', eyebrow: 'Toko PPAPI', size: 'lg', body: body, cls: 'atk-drawer',
      actions: [{ label: 'Batal', variant: 'ghost' }, { label: isNew ? 'Simpan Produk' : 'Simpan Perubahan', variant: 'primary', id: 'pf-save', onClick: save }],
      onOpen: function (el) { wire(el); }
    });
    var el;
    function paintPhotos() {
      var box = el.querySelector('[data-pf-photos]');
      box.innerHTML = foto.length ? foto.map(function (f, i) { return '<figure class="atk-photo"><img src="' + h(f) + '" alt="Foto ' + (i + 1) + '" width="96" height="96">' + (i === 0 ? '<figcaption>Sampul</figcaption>' : '') + '<button type="button" class="icon-btn icon-btn--sm atk-photo__rm" data-rm="' + i + '" aria-label="Hapus foto ' + (i + 1) + '">' + icon('close', { size: 14 }) + '</button></figure>'; }).join('') : '<p class="atk-note">Belum ada foto — kartu katalog menampilkan ikon kategori.</p>';
      el.querySelector('.atk-upload').hidden = foto.length >= T.LIMITS.foto;
      el.querySelector('[data-pf-wm-all]').hidden = !foto.length;
    }
    function paintPdf() {
      var box = el.querySelector('[data-pf-pdf]'), U = PPAPI.util;
      var name = pdfNew ? pdfNew.name : pdfNew === null ? '' : fmeta.parts ? fmeta.fileName : '';
      var size = pdfNew ? pdfNew.size : pdfNew === null ? 0 : fmeta.size;
      box.innerHTML = name ? '<p class="atk-pdf__file">' + icon('file-text', { size: 16 }) + '<span>' + h(name) + ' · ' + U.formatNumber(Math.round(size / 1024)) + ' KB' + (pdfNew ? ' (disimpan saat Simpan)' : '') + '</span></p>' : '<p class="atk-note">' + (pdfNew === null ? 'Berkas unggahan akan dihapus saat Simpan.' : 'Belum ada berkas unggahan.') + '</p>';
      el.querySelector('[data-pf-pdf-rm]').hidden = !name;
    }
    function syncKnow() {
      var k = el.querySelector('#pf-kat').value === 'Produk Pengetahuan';
      el.querySelector('[data-pf-know]').hidden = !k;
      var soft = el.querySelector('#pf-soft').checked, cetak = el.querySelector('#pf-cetak').checked;
      el.querySelector('[data-pf-price-cetak]').hidden = !(k && cetak);
      el.querySelector('[data-pf-price-main]').hidden = k && !soft && cetak;
      el.querySelector('[data-pf-hl]').textContent = k ? 'Harga soft file (Rp)' : 'Harga (Rp)';
    }
    function wire(root) {
      el = root;
      paintPhotos(); paintPdf(); syncKnow();
      el.querySelector('[data-pf-pdf-file]').addEventListener('change', function (e) {
        var f = e.target.files && e.target.files[0]; e.target.value = '';
        if (!f) return;
        if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { ui.toast('Pilih berkas PDF.', { type: 'error' }); return; }
        if (f.size > T.MAX_PDF) { ui.toast('Berkas PDF maksimal 30 MB.', { type: 'error' }); return; }
        pdfNew = f; paintPdf();
      });
      el.querySelector('[data-pf-pdf-rm]').addEventListener('click', function () { pdfNew = fmeta.parts ? null : undefined; paintPdf(); });
      el.querySelector('[data-pf-wm-all]').addEventListener('click', async function (e) {
        var b = e.currentTarget; ui.setLoading(b, true, 'Membubuhkan…');
        try { for (var i = 0; i < foto.length; i++) foto[i] = await T.watermarkPhoto(foto[i]); fotoChanged = true; ui.toast('Tanda air dibubuhkan pada ' + foto.length + ' foto. Simpan untuk menerapkan.', { type: 'success' }); }
        catch (err) { ui.toast(err.message, { type: 'error' }); }
        ui.setLoading(b, false); paintPhotos();
      });
      el.addEventListener('change', function (e) { if (e.target.matches('#pf-kat, #pf-soft, #pf-cetak')) syncKnow(); });
      el.addEventListener('input', function (e) { var f = e.target.closest('.field'); if (f) f.classList.remove('is-invalid'); });
      el.querySelector('[data-pf-photos]').addEventListener('click', function (e) { var b = e.target.closest('[data-rm]'); if (!b) return; foto.splice(Number(b.dataset.rm), 1); fotoChanged = true; paintPhotos(); });
      el.querySelector('[data-pf-file]').addEventListener('change', async function (e) {
        var files = Array.prototype.slice.call(e.target.files || []).slice(0, T.LIMITS.foto - foto.length);
        for (var i = 0; i < files.length; i++) {
          try {
            var ph = await T.compressImage(files[i], { max: 1200, maxKB: T.LIMITS.fotoKB });
            if (el.querySelector('#pf-wm').checked) ph = await T.watermarkPhoto(ph);
            foto.push(ph); fotoChanged = true;
          }
          catch (err) { ui.toast(err.message, { type: 'error' }); }
        }
        e.target.value = ''; paintPhotos();
      });
    }
    function bad(id, focus) { var c = el.querySelector('#' + id); c.closest('.field').classList.add('is-invalid'); c.setAttribute('aria-invalid', 'true'); if (focus) c.focus(); return false; }
    function digits(id) { var v = el.querySelector('#' + id).value.replace(/[^\d]/g, ''); return v === '' ? null : Number(v); }
    async function save(close) {
      var v = function (id) { return el.querySelector('#' + id).value.trim(); };
      var kat = v('pf-kat'), k = kat === 'Produk Pengetahuan';
      var soft = el.querySelector('#pf-soft').checked, cetak = el.querySelector('#pf-cetak').checked;
      if (k && !soft && !cetak) { ui.toast('Pilih minimal satu format: soft file atau cetak.', { type: 'warn' }); return false; }
      if (v('pf-nama').length < 3) return bad('pf-nama', true);
      var harga = digits('pf-harga'), hc = digits('pf-hcetak');
      if (k && !soft && cetak) { if (hc === null) return bad('pf-hcetak', true); harga = hc; }
      else if (harga === null) return bad('pf-harga', true);
      if (k && cetak && hc === null) return bad('pf-hcetak', true);
      var file = v('pf-file');
      if (k && soft && file && !/^https?:\/\//i.test(file)) return bad('pf-file', true);
      var input = {
        id: isNew ? '' : p.id, nama: v('pf-nama'), kategori: kat, kode: v('pf-kode'), ringkasan: v('pf-ring'), deskripsi: el.querySelector('#pf-desk').value,
        harga: harga, hargaAnggota: k && !soft ? null : digits('pf-hang'),
        format: k ? { soft: soft, cetak: cetak } : null, hargaCetak: k && cetak ? hc : null, hargaCetakAnggota: k && cetak ? digits('pf-hcetakang') : null,
        halaman: k ? digits('pf-hal') : null, stok: digits('pf-stok'), berat: digits('pf-berat'),
        varian: [0, 1].map(function (i) { return { nama: v('pf-vn' + i), opsi: v('pf-vo' + i).split(',') }; }),
        aktif: el.querySelector('#pf-aktif').checked, unggulan: el.querySelector('#pf-ung').checked, urutan: digits('pf-urut') || 0
      };
      if (!isNew) { input.thumb = p.thumb; input.fotoCount = p.fotoCount; input.berkasAda = p.berkasAda; }
      var extra = {};
      if (isNew || fotoChanged) extra.foto = foto;
      if (k && soft) extra.fileUrl = file; else if (!isNew && fileUrl) extra.fileUrl = '';
      var saved = await T.admin.saveProduct(input, extra);
      if (pdfNew !== undefined && k) {
        try { await T.admin.saveFile(saved.id, pdfNew); }
        catch (e) { ui.toast('Produk disimpan, tetapi berkas PDF gagal disimpan: ' + e.message, { type: 'error' }); close(); paint(); return; }
      }
      ui.toast('Produk “' + saved.nama + '” disimpan.', { type: 'success' });
      close(); paint();
    }
    void dr;
  }

  /* ============================== SETTINGS ============================== */
  async function paintSettings(panel) {
    var U = PPAPI.util, h = U.h, T = PPAPI.toko, ui = PPAPI.ui;
    var s = await T.getSettings({ fresh: true });
    var rek = s.rekening.slice(); while (rek.length < T.LIMITS.rekening) rek.push({ bank: '', nomor: '', atasNama: '' });
    function tabelHtml(t) {
      var tarif = t.tarif || {};
      function inp(id, label, val, extra) { return '<div class="field"><label class="field__label" for="' + id + '">' + label + '</label><input class="field__control" id="' + id + '" value="' + h(val === undefined || val === null ? '' : val) + '" ' + (extra || '') + '></div>'; }
      return '<details class="atk-tabel mt-3"' + (s.ongkirMode === 'tabel' ? ' open' : '') + '><summary>Tabel tarif kurir (rupiah per kg, per provinsi tujuan)</summary>' +
        '<p class="atk-note">Isi dari pengecek tarif di situs resmi kurir (JNE, J&amp;T, TIKI, atau Pos Indonesia) dari kota asal pengiriman. Ongkos kirim = tarif provinsi tujuan × berat tertagih (minimal 1 kg; kelebihan di atas kilogram bulat dihitung 1 kg bila melebihi toleransi). Berat diambil dari kolom berat tiap produk. Provinsi yang dikosongkan tetap dikonfirmasi sekretariat. Tarif antarkota dalam satu provinsi dapat berbeda; gunakan tarif tertinggi di provinsi tersebut agar tidak kurang bayar.</p>' +
        '<div class="form__row form__row--2">' +
          inp('st-tk-kurir', 'Kurir dan layanan', t.kurir, 'maxlength="60" placeholder="JNE REG"') +
          inp('st-tk-asal', 'Kota asal pengiriman', t.asal, 'maxlength="80" placeholder="Kabupaten Bogor"') +
        '</div><div class="form__row form__row--3">' +
          inp('st-tk-sumber', 'Sumber tarif', t.sumber, 'maxlength="200" placeholder="jne.co.id, cek tarif"') +
          inp('st-tk-tgl', 'Tanggal pengecekan', t.diperbarui, 'type="date"') +
          inp('st-tk-tol', 'Toleransi berat (gram)', t.toleransi === undefined ? 300 : t.toleransi, 'inputmode="numeric" maxlength="3"') +
        '</div><div class="atk-tarif">' +
          U.PROVINSI.map(function (pv, i) { return inp('st-tk-p' + i, h(pv), tarif[pv], 'inputmode="numeric" maxlength="8" placeholder="Rp/kg"'); }).join('') +
        '</div></details>';
    }
    panel.innerHTML = '<form class="form atk-settings" novalidate data-ps-form>' +
      '<fieldset class="atk-fieldset"><legend class="atk-legend">Rekening pembayaran</legend><p class="atk-note">Tampil di keranjang dan halaman pesanan. Bila kosong, pembeli melihat “Informasi rekening akan diumumkan sekretariat”.</p>' +
        rek.map(function (r, i) {
          return '<div class="atk-rek"><p class="atk-rek__n">Rekening ' + (i + 1) + '</p><div class="form__row form__row--3">' +
            '<div class="field"><label class="field__label" for="st-bank' + i + '">Bank</label><input class="field__control" id="st-bank' + i + '" maxlength="60" value="' + h(r.bank) + '" placeholder="Nama bank"></div>' +
            '<div class="field"><label class="field__label" for="st-no' + i + '">Nomor rekening</label><input class="field__control" id="st-no' + i + '" maxlength="40" inputmode="numeric" value="' + h(r.nomor) + '"></div>' +
            '<div class="field"><label class="field__label" for="st-an' + i + '">Atas nama</label><input class="field__control" id="st-an' + i + '" maxlength="120" value="' + h(r.atasNama) + '"></div>' +
          '</div></div>';
        }).join('') +
      '</fieldset>' +
      '<fieldset class="atk-fieldset"><legend class="atk-legend">Ongkos kirim</legend>' +
        '<div class="atk-checks" role="radiogroup" aria-label="Cara menetapkan ongkos kirim">' +
          '<label class="check"><input type="radio" name="st-mode" value="konfirmasi"' + (s.ongkirMode !== 'flat' ? ' checked' : '') + '><span class="check__box"></span><span class="check__label">Dikonfirmasi sekretariat per pesanan</span></label>' +
          '<label class="check"><input type="radio" name="st-mode" value="flat"' + (s.ongkirMode === 'flat' ? ' checked' : '') + '><span class="check__box"></span><span class="check__label">Tarif tetap</span></label>' +
          '<label class="check"><input type="radio" name="st-mode" value="tabel"' + (s.ongkirMode === 'tabel' ? ' checked' : '') + '><span class="check__box"></span><span class="check__label">Otomatis dari tabel tarif kurir per provinsi</span></label></div>' +
        '<div class="form__row form__row--2 mt-3"><div class="field"><label class="field__label" for="st-flat">Tarif tetap (Rp)</label><input class="field__control" id="st-flat" inputmode="numeric" maxlength="10" value="' + (s.ongkirFlat === null ? '' : s.ongkirFlat) + '"><p class="field__error">Isi tarif untuk mode tarif tetap.</p></div>' +
        '<div class="field"><label class="field__label" for="st-jam">Batas waktu pembayaran (jam)</label><input class="field__control" id="st-jam" inputmode="numeric" maxlength="3" value="' + (s.batasBayarJam || '') + '"><p class="field__hint">Hanya informasi bagi pembeli; 0 / kosong = tidak ditampilkan.</p></div></div>' +
        tabelHtml(s.ongkirTabel || {}) +
        '<div class="field"><label class="field__label" for="st-onote">Keterangan ongkos kirim</label><textarea class="field__control" id="st-onote" rows="2" maxlength="500" placeholder="Contoh: Ongkos kirim dihitung sesuai tarif kurir ke alamat Anda.">' + h(s.ongkirCatatan) + '</textarea></div>' +
      '</fieldset>' +
      '<fieldset class="atk-fieldset"><legend class="atk-legend">Petunjuk &amp; kontak</legend>' +
        '<div class="field"><label class="field__label" for="st-pay">Petunjuk pembayaran</label><textarea class="field__control" id="st-pay" rows="3" maxlength="1000">' + h(s.catatanPembayaran) + '</textarea></div>' +
        '<div class="field"><label class="field__label" for="st-kontak">Kontak toko</label><input class="field__control" id="st-kontak" maxlength="200" value="' + h(s.kontak) + '" placeholder="Contoh: WhatsApp sekretariat 08… (jam kerja)"></div>' +
      '</fieldset>' +
      '<div class="form__actions"><button type="submit" class="btn btn--primary" id="st-save"><span>Simpan Pengaturan</span></button></div>' +
    '</form>';
    var f = panel.querySelector('[data-ps-form]');
    f.addEventListener('submit', async function (e) {
      e.preventDefault();
      var v = function (id) { return f.querySelector('#' + id).value.trim(); };
      var mode = f.querySelector('input[name="st-mode"]:checked').value;
      var flat = v('st-flat').replace(/\D/g, '');
      if (mode === 'flat' && !flat) { f.querySelector('#st-flat').closest('.field').classList.add('is-invalid'); f.querySelector('#st-flat').focus(); return; }
      var tarif = {};
      U.PROVINSI.forEach(function (pv, i) { var x = v('st-tk-p' + i).replace(/\D/g, ''); if (x) tarif[pv] = Number(x); });
      var tabel = { kurir: v('st-tk-kurir'), asal: v('st-tk-asal'), sumber: v('st-tk-sumber'), diperbarui: v('st-tk-tgl'), toleransi: v('st-tk-tol') === '' ? 300 : Number(v('st-tk-tol').replace(/\D/g, '')), tarif: tarif };
      if (mode === 'tabel' && !Object.keys(tarif).length) { ui.toast('Isi tarif minimal satu provinsi untuk mode tabel tarif.', { type: 'warn' }); f.querySelector('.atk-tabel').open = true; return; }
      var btn = f.querySelector('#st-save');
      ui.setLoading(btn, true, 'Menyimpan…');
      try {
        await T.admin.saveSettings({
          rekening: [0, 1, 2].map(function (i) { return { bank: v('st-bank' + i), nomor: v('st-no' + i), atasNama: v('st-an' + i) }; }),
          ongkirMode: mode, ongkirFlat: flat === '' ? null : Number(flat), ongkirCatatan: v('st-onote'), ongkirTabel: Object.keys(tarif).length ? tabel : null,
          batasBayarJam: v('st-jam') === '' ? 0 : Number(v('st-jam').replace(/\D/g, '')), catatanPembayaran: v('st-pay'), kontak: v('st-kontak')
        });
        ui.toast('Pengaturan toko disimpan.', { type: 'success' });
        paint();
      } catch (err) { ui.setLoading(btn, false); ui.toast(err.message, { type: 'error' }); }
    });
  }

  w.PPAPI_ADMIN_SECTIONS = (w.PPAPI_ADMIN_SECTIONS || []).concat({
    key: 'toko', label: 'Toko', icon: 'briefcase',
    title: 'Toko <em>PPAPI</em>',
    lead: 'Pesanan, konfirmasi pembayaran transfer, pengiriman, katalog produk, serta rekening dan ongkos kirim.',
    render: render,
    badge: async function () { try { return (await PPAPI.toko.admin.summary()).perluTindakan; } catch (e) { return 0; } }
  });
})(window);
