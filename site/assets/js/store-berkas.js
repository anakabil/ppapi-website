/* ==========================================================================
   PPAPI — berkas pendukung anggota (assets/js/store-berkas.js)
   --------------------------------------------------------------------------
   Dokumen pendukung pengajuan (CV, ijazah, sertifikat, bukti pembayaran, dll.)
   diunggah LANGSUNG ke basis data PPAPI, bukan berupa tautan Google Drive.

   Firebase  : member_files/{uid}/berkas/{fid}              (info berkas)
               member_files/{uid}/berkas/{fid}/parts/{n}    (isi, ≤ 900 KB per bagian)
               Baca: pemilik + admin. Tulis/hapus: pemilik selama formulir boleh diubah
               (Draf, Perlu Perbaikan, Ditolak, masa perpanjangan) atau keanggotaan Aktif,
               dan admin. Aturan: site/firestore.rules › member_files.
   Mode Demo : IndexedDB peramban ini (basis data 'ppapi_member_berkas').

   Jenis: PDF (≤ 4 MB) atau foto JPG/PNG (dikompresi otomatis menjadi JPEG ≤ ±1,5 MB).
   API (PPAPI.berkas):
     simpan(fid, File)            → { nama, jenis, ukuran }      (akun yang sedang masuk)
     info(uid, fid)               → { nama, jenis, ukuran } | null
     ambil(uid, fid)              → Blob | null
     buka(uid, fid)               → membuka berkas di tab baru (atau mengunduhnya)
     hapus(fid)                   → true
     idDokumen(rowId) / idSertifikat(certId) / ID_BUKTI   (penamaan fid yang dipakai halaman)
   Dimuat SETELAH store.js:  config → core → auth → store → store-berkas → pages/<halaman>.js
   ========================================================================== */
(function (w) {
  'use strict';
  var PPAPI = w.PPAPI = w.PPAPI || {};
  var PART = 900 * 1024, MAX_PDF = 4 * 1024 * 1024, MAX_IMG_SRC = 25 * 1024 * 1024, IMG_TARGET = 1500 * 1024;
  var JENIS = ['application/pdf', 'image/jpeg'];
  var MARK = 'berkas:';   /* penanda pada kolom lama yang dulu berisi tautan (mis. pembayaran.buktiUrl) */

  function err(code, message, cause) { var e = new Error(message); e.code = code; if (cause) e.cause = cause; return e; }
  function local() { return !PPAPI.store || PPAPI.store.mode !== 'firebase'; }
  function me() { return PPAPI.auth && PPAPI.auth.current ? PPAPI.auth.current() : null; }
  async function fx() {
    var f = PPAPI.auth && PPAPI.auth._firebase ? await PPAPI.auth._firebase() : null;
    if (!f) throw err('berkas/unavailable', 'Layanan data belum siap. Muat ulang halaman, lalu coba lagi.');
    return f;
  }
  function mapFs(e) {
    if (e && e.code && /^berkas\//.test(e.code)) return e;
    var code = e && e.code ? String(e.code).replace(/^firestore\//, '') : '';
    var msg = {
      'permission-denied': 'Berkas tidak dapat disimpan atau dibuka. Berkas hanya dapat diubah selama formulir belum diajukan (atau dikembalikan untuk diperbaiki), dan hanya dapat dibuka oleh pemilik akun dan sekretariat.',
      'unauthenticated': 'Sesi Anda telah berakhir. Silakan masuk kembali.',
      'unavailable': 'Layanan data sedang tidak dapat dihubungi. Periksa koneksi internet Anda, lalu coba lagi.',
      'resource-exhausted': 'Batas pemakaian layanan data sedang tercapai. Silakan coba lagi nanti.'
    }[code] || 'Berkas belum dapat diproses. Silakan coba lagi.';
    return err('berkas/' + (code || 'unknown'), msg, e);
  }
  function safeFid(fid) {
    var s = String(fid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
    if (!s) throw err('berkas/invalid', 'Pengenal berkas tidak sah.');
    return s;
  }
  function cleanName(n) { return String(n || 'berkas').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120) || 'berkas'; }
  function int(v, max) { var n = Math.round(Number(v)); return isFinite(n) && n >= 0 ? Math.min(n, max) : 0; }
  function norm(raw) {
    if (!raw) return null;
    var j = JENIS.indexOf(raw.jenis) !== -1 ? raw.jenis : '';
    if (!j) return null;
    return { nama: cleanName(raw.nama), jenis: j, ukuran: int(raw.ukuran, MAX_PDF), bagian: int(raw.bagian, 5) };
  }

  /* ---------- Mode Demo: IndexedDB ---------- */
  var idbP = null;
  function idb() {
    if (idbP) return idbP;
    idbP = new Promise(function (resolve, reject) {
      var r = w.indexedDB.open('ppapi_member_berkas', 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('berkas'); };
      r.onsuccess = function () { resolve(r.result); };
      r.onerror = function () { idbP = null; reject(err('berkas/quota', 'Penyimpanan peramban tidak tersedia untuk berkas.')); };
    });
    return idbP;
  }
  async function idbDo(mode, fn) {
    var db = await idb();
    return new Promise(function (resolve, reject) {
      var tx = db.transaction('berkas', mode), req = fn(tx.objectStore('berkas'));
      tx.oncomplete = function () { resolve(req && req.result); };
      tx.onerror = tx.onabort = function () { reject(err('berkas/quota', 'Berkas tidak dapat disimpan di peramban ini.', tx.error)); };
    });
  }

  /* ---------- persiapan berkas ---------- */
  function readBytes(file) { return file.arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function isPdf(bytes) { return String.fromCharCode.apply(null, bytes.subarray(0, 1024)).indexOf('%PDF-') !== -1; }
  async function toJpeg(file) {
    var url = URL.createObjectURL(file), img;
    try {
      img = await new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = function () { rej(err('berkas/image', 'Foto tidak dapat dibaca. Gunakan berkas JPG atau PNG.')); }; i.src = url; });
    } finally { setTimeout(function () { URL.revokeObjectURL(url); }, 0); }
    var dims = [2200, 1800, 1500, 1200], quals = [0.85, 0.78, 0.7];
    for (var d = 0; d < dims.length; d++) {
      var k = Math.min(1, dims[d] / Math.max(img.naturalWidth, img.naturalHeight));
      var cv = w.document.createElement('canvas');
      cv.width = Math.max(1, Math.round(img.naturalWidth * k)); cv.height = Math.max(1, Math.round(img.naturalHeight * k));
      var cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(img, 0, 0, cv.width, cv.height);
      for (var q = 0; q < quals.length; q++) {
        var blob = await new Promise(function (res) { cv.toBlob(res, 'image/jpeg', quals[q]); });
        if (blob && blob.size <= IMG_TARGET) return new Uint8Array(await blob.arrayBuffer());
      }
    }
    throw err('berkas/too-large', 'Foto terlalu besar meski sudah dikompresi. Gunakan foto dengan resolusi lebih kecil.');
  }
  async function prepare(file) {
    if (!file) throw err('berkas/empty', 'Pilih berkas terlebih dahulu.');
    var name = cleanName(file.name || 'berkas');
    var type = String(file.type || '').toLowerCase();
    var looksPdf = type === 'application/pdf' || /\.pdf$/i.test(name);
    if (looksPdf) {
      if (file.size > MAX_PDF) throw err('berkas/too-large', 'Berkas PDF maksimal 4 MB. Kompres PDF terlebih dahulu (mis. dengan fitur "Reduce file size"), lalu unggah kembali.');
      var bytes = await readBytes(file);
      if (!isPdf(bytes)) throw err('berkas/type', 'Berkas bukan PDF yang sah.');
      return { bytes: bytes, nama: name, jenis: 'application/pdf' };
    }
    if (/^image\/(jpeg|png|webp)$/.test(type) || /\.(jpe?g|png|webp)$/i.test(name)) {
      if (file.size > MAX_IMG_SRC) throw err('berkas/too-large', 'Foto maksimal 25 MB.');
      var jpg = await toJpeg(file);
      return { bytes: jpg, nama: name.replace(/\.(png|webp|jpe?g)$/i, '') + '.jpg', jenis: 'image/jpeg' };
    }
    throw err('berkas/type', 'Jenis berkas tidak didukung. Unggah PDF atau foto (JPG/PNG).');
  }

  /* ---------- API ---------- */
  async function simpan(fid, file) {
    var u = me();
    if (!u) throw err('berkas/unauthenticated', 'Masuk terlebih dahulu untuk mengunggah berkas.');
    fid = safeFid(fid);
    var p = await prepare(file);
    var parts = Math.max(1, Math.ceil(p.bytes.length / PART));
    if (parts > 5) throw err('berkas/too-large', 'Berkas maksimal 4 MB.');
    var info = { nama: p.nama, jenis: p.jenis, ukuran: p.bytes.length, bagian: parts };
    if (local()) {
      await idbDo('readwrite', function (st) {
        return st.put({ info: info, data: p.bytes.buffer.slice(p.bytes.byteOffset, p.bytes.byteOffset + p.bytes.length) }, u.uid + '/' + fid);
      });
      return { nama: info.nama, jenis: info.jenis, ukuran: info.ukuran };
    }
    var f = await fx(), ref = f.db.collection('member_files').doc(u.uid).collection('berkas').doc(fid);
    try {
      var old = await ref.get().then(function (s) { return s.exists ? norm(s.data()) : null; }).catch(function () { return null; });
      for (var i = 0; i < parts; i++) {
        await ref.collection('parts').doc(String(i)).set({ b: f.fb.firestore.Blob.fromUint8Array(p.bytes.subarray(i * PART, (i + 1) * PART)), i: i });
      }
      for (var j = parts; old && j < old.bagian; j++) await ref.collection('parts').doc(String(j)).delete().catch(function () {});
      await ref.set({ uid: u.uid, nama: info.nama, jenis: info.jenis, ukuran: info.ukuran, bagian: parts, updatedAt: f.fb.firestore.FieldValue.serverTimestamp() });
    } catch (e) { throw mapFs(e); }
    return { nama: info.nama, jenis: info.jenis, ukuran: info.ukuran };
  }
  async function info(uid, fid) {
    if (!uid) return null;
    fid = safeFid(fid);
    if (local()) {
      var rec = await idbDo('readonly', function (st) { return st.get(uid + '/' + fid); }).catch(function () { return null; });
      return rec ? norm(rec.info) : null;
    }
    var f = await fx();
    try { var s = await f.db.collection('member_files').doc(uid).collection('berkas').doc(fid).get(); return s.exists ? norm(s.data()) : null; }
    catch (e) { throw mapFs(e); }
  }
  async function ambil(uid, fid) {
    fid = safeFid(fid);
    if (local()) {
      var rec = await idbDo('readonly', function (st) { return st.get(uid + '/' + fid); });
      if (!rec) return null;
      var i0 = norm(rec.info);
      return i0 ? new Blob([rec.data], { type: i0.jenis }) : null;
    }
    var f = await fx(), ref = f.db.collection('member_files').doc(uid).collection('berkas').doc(fid);
    try {
      var s = await ref.get(); if (!s.exists) return null;
      var meta = norm(s.data()); if (!meta) return null;
      var chunks = [];
      for (var i = 0; i < meta.bagian; i++) {
        var ps = await ref.collection('parts').doc(String(i)).get();
        if (!ps.exists) throw err('berkas/rusak', 'Sebagian isi berkas tidak ditemukan. Unggah ulang berkas ini.');
        chunks.push(ps.data().b.toUint8Array());
      }
      return new Blob(chunks, { type: meta.jenis });
    } catch (e) { throw mapFs(e); }
  }
  async function buka(uid, fid, nama) {
    var tab = null;
    try { tab = w.open('', '_blank'); } catch (e) { tab = null; }
    try {
      var blob = await ambil(uid, fid);
      if (!blob) throw err('berkas/not-found', 'Berkas tidak ditemukan.');
      var url = URL.createObjectURL(blob);
      if (tab && !tab.closed) tab.location.href = url;
      else { var a = w.document.createElement('a'); a.href = url; a.download = cleanName(nama || fid); w.document.body.appendChild(a); a.click(); a.remove(); }
      setTimeout(function () { URL.revokeObjectURL(url); }, 120000);
      return true;
    } catch (e) { if (tab && !tab.closed) tab.close(); throw e; }
  }
  async function hapus(fid) {
    var u = me();
    if (!u) throw err('berkas/unauthenticated', 'Masuk terlebih dahulu.');
    fid = safeFid(fid);
    if (local()) { await idbDo('readwrite', function (st) { return st.delete(u.uid + '/' + fid); }); return true; }
    var f = await fx(), ref = f.db.collection('member_files').doc(u.uid).collection('berkas').doc(fid);
    try {
      var s = await ref.get(), meta = s.exists ? norm(s.data()) : null;
      for (var i = 0; i < (meta ? meta.bagian : 5); i++) await ref.collection('parts').doc(String(i)).delete().catch(function () {});
      if (s.exists) await ref.delete();
    } catch (e) { throw mapFs(e); }
    return true;
  }
  function fmtUkuran(n) { n = Number(n) || 0; return n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }

  /* ---------- bantuan tampilan bersama (formulir pendaftaran & profil anggota) ---------- */
  function hh(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function skemaList() { var k = (w.PPAPI_DATA && w.PPAPI_DATA.kompetensi) || {}; return Array.isArray(k.skema) ? k.skema : []; }
  function skemaFind(title) {
    var t = String(title || '').trim(), hit = null;
    skemaList().forEach(function (g) { (g.opsi || []).forEach(function (o) { if (!hit && o === t) hit = g; }); });
    return hit;
  }
  /** skemaHtml(idp, title) — pilihan skema sertifikasi (Kemnaker / BNSP / Lainnya) + isian nama bila "Lainnya" */
  function skemaHtml(idp, title) {
    var g0 = skemaFind(title), lain = !!String(title || '').trim() && !g0;
    var opts = '<option value="">Pilih skema sertifikasi…</option>' + skemaList().map(function (g) {
      return '<optgroup label="' + hh(g.grup) + '">' + (g.opsi || []).map(function (o) { return '<option value="' + hh(o) + '"' + (o === title ? ' selected' : '') + '>' + hh(o) + '</option>'; }).join('') + '</optgroup>';
    }).join('') + '<option value="__lain"' + (lain ? ' selected' : '') + '>Lainnya (tulis nama sertifikat)</option>';
    return '<div class="field"><label class="field__label" for="' + idp + '-skema">Skema sertifikasi <span class="field__req" aria-hidden="true">*</span></label>' +
        '<select class="field__control" id="' + idp + '-skema" required>' + opts + '</select>' +
        '<p class="field__hint">Kemnaker: lisensi K3 perancah dan Ahli K3 Konstruksi. BNSP: skema LSP berjenjang KKNI. Pilih “Lainnya” bila sertifikat Anda tidak ada di daftar.</p><p class="field__error"></p></div>' +
      '<div class="field" id="' + idp + '-lain-wrap"' + (lain ? '' : ' hidden') + '><label class="field__label" for="' + idp + '-title">Nama sertifikat <span class="field__req" aria-hidden="true">*</span></label>' +
        '<input class="field__control" id="' + idp + '-title" type="text" maxlength="200" autocomplete="off" placeholder="mis. CISRS Scaffolding Supervisor" value="' + hh(lain ? title : '') + '"><p class="field__error"></p></div>';
  }
  /** skemaBind(root, idp, issuerInput) — tampilkan isian "Lainnya" dan isi penerbit otomatis */
  function skemaBind(root, idp, issuerEl) {
    var sel = root.querySelector('#' + idp + '-skema'), wrap = root.querySelector('#' + idp + '-lain-wrap');
    if (!sel) return;
    sel.addEventListener('change', function () {
      var lain = sel.value === '__lain';
      if (wrap) wrap.hidden = !lain;
      if (lain) { var t = root.querySelector('#' + idp + '-title'); if (t) t.focus(); }
      var g = skemaFind(sel.value);
      if (g && issuerEl && (!issuerEl.value.trim() || issuerEl.getAttribute('data-auto') === '1')) { issuerEl.value = g.penerbit; issuerEl.setAttribute('data-auto', '1'); }
    });
    if (issuerEl) issuerEl.addEventListener('input', function () { issuerEl.removeAttribute('data-auto'); });
  }
  /** skemaValue(root, idp) → { title, el } — nama sertifikat terpilih ('' bila belum dipilih) */
  function skemaValue(root, idp) {
    var sel = root.querySelector('#' + idp + '-skema');
    if (!sel) return { title: '', el: null };
    if (sel.value === '__lain') { var t = root.querySelector('#' + idp + '-title'); return { title: t.value.trim().replace(/\s+/g, ' '), el: t }; }
    return { title: sel.value, el: sel };
  }
  /** fileHtml(idp, nama, label) — pemilih berkas (PDF/foto) untuk jendela sertifikat */
  function fileHtml(idp, nama, label) {
    return '<div class="field berkas-field"><span class="field__label" id="' + idp + '-flabel">' + hh(label || 'Berkas sertifikat') + ' <span class="opt">(opsional)</span></span>' +
      '<div class="berkas-pick"><span class="berkas-pick__name" id="' + idp + '-fname">' + (nama ? hh(nama) : 'Belum ada berkas') + '</span>' +
      '<label class="btn btn--ghost btn--sm"><span>' + (nama ? 'Ganti berkas' : 'Pilih berkas') + '</span><input class="sr-only" type="file" id="' + idp + '-file" accept="' + ACCEPT + '" aria-labelledby="' + idp + '-flabel"></label></div>' +
      '<p class="field__hint">PDF maksimal 4 MB, atau foto JPG/PNG (dikompresi otomatis). Berkas disimpan di basis data PPAPI dan hanya dapat dibuka oleh Anda dan sekretariat.</p><p class="field__error"></p></div>';
  }
  function fileBind(root, idp) {
    var inp = root.querySelector('#' + idp + '-file'), nm = root.querySelector('#' + idp + '-fname');
    if (inp && nm) inp.addEventListener('change', function () { var f = inp.files && inp.files[0]; if (f) nm.textContent = cleanName(f.name) + ' (' + fmtUkuran(f.size) + ', belum disimpan)'; });
    return function () { return inp && inp.files && inp.files[0] || null; };
  }
  var ACCEPT = 'application/pdf,.pdf,image/jpeg,image/png,image/webp';

  PPAPI.berkas = {
    simpan: simpan, info: info, ambil: ambil, buka: buka, hapus: hapus, fmtUkuran: fmtUkuran,
    idDokumen: function (rowId) { return 'dok-' + String(rowId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50); },
    idSertifikat: function (certId) { return 'srt-' + String(certId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 50); },
    ID_BUKTI: 'bukti-bayar', MARK: MARK, ACCEPT: ACCEPT,
    ui: { skemaHtml: skemaHtml, skemaBind: skemaBind, skemaValue: skemaValue, skemaFind: skemaFind, fileHtml: fileHtml, fileBind: fileBind },
    MAX_PDF: MAX_PDF
  };
})(window);
