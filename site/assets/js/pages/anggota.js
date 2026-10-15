/* ==========================================================================
   PPAPI — pages/anggota.js · Halaman Anggota (anggota.html)
   Profil diri, kompetensi, sertifikat, Kartu Tanda Anggota digital (QR
   verifikasi), dan tautan aplikasi. Hanya MEMAKAI API bersama:
   PPAPI.util / PPAPI.ui / PPAPI.auth / PPAPI.store (lihat FOUNDATION_NOTES).
   ========================================================================== */
(function (w, d) {
  'use strict';

  var PPAPI = w.PPAPI;
  if (!PPAPI || typeof PPAPI.onReady !== 'function') return;

  /* ------------------------------------------------------------------
     Pembuat kode QR untuk KTA — ditulis langsung di sini (tanpa pustaka
     atau CDN pihak ketiga), karena halaman ini memuat sesi dan data
     pribadi anggota. Mengikuti ISO/IEC 18004: mode byte (UTF-8), tingkat
     koreksi galat M, versi 1–40 dipilih otomatis, masker dipilih dengan
     aturan penalti standar. qrCode.svg(teks) → string <svg>.
     ------------------------------------------------------------------ */
  var qrCode = (function () {
    /* Tingkat M: kode koreksi per blok dan jumlah blok, indeks = versi */
    var ECC = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26,
      26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
    var BLOCKS = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16,
      17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];

    /* Perkalian GF(2^8), polinom primitif x^8 + x^4 + x^3 + x^2 + 1 */
    function gfMul(x, y) {
      var z = 0;
      for (var i = 7; i >= 0; i--) {
        z = (z << 1) ^ ((z >>> 7) * 0x11d);
        z ^= ((y >>> i) & 1) * x;
      }
      return z;
    }
    /* Polinom pembangkit Reed–Solomon berderajat n (tanpa suku utama) */
    function rsGenerator(n) {
      var poly = [], root = 1, i, j;
      for (i = 0; i < n - 1; i++) poly.push(0);
      poly.push(1);
      for (i = 0; i < n; i++) {
        for (j = 0; j < n; j++) {
          poly[j] = gfMul(poly[j], root);
          if (j + 1 < n) poly[j] ^= poly[j + 1];
        }
        root = gfMul(root, 2);
      }
      return poly;
    }
    function rsRemainder(data, gen) {
      var rem = gen.map(function () { return 0; });
      data.forEach(function (b) {
        var f = b ^ rem.shift();
        rem.push(0);
        for (var i = 0; i < gen.length; i++) rem[i] ^= gfMul(gen[i], f);
      });
      return rem;
    }
    /* Jumlah modul data (termasuk sisa bit) pada sebuah versi */
    function rawModules(v) {
      var r = (16 * v + 128) * v + 64;
      if (v >= 2) {
        var n = Math.floor(v / 7) + 2;
        r -= (25 * n - 10) * n - 55;
        if (v >= 7) r -= 36;
      }
      return r;
    }
    function dataCodewords(v) { return Math.floor(rawModules(v) / 8) - ECC[v] * BLOCKS[v]; }
    function alignment(v) {
      if (v === 1) return [];
      var n = Math.floor(v / 7) + 2, size = v * 4 + 17;
      var step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
      var out = [6];
      for (var p = size - 7; out.length < n; p -= step) out.splice(1, 0, p);
      return out;
    }
    function maskOn(m, x, y) {
      switch (m) {
        case 0: return (x + y) % 2 === 0;
        case 1: return y % 2 === 0;
        case 2: return x % 3 === 0;
        case 3: return (x + y) % 3 === 0;
        case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
        case 5: return x * y % 2 + x * y % 3 === 0;
        case 6: return (x * y % 2 + x * y % 3) % 2 === 0;
        default: return ((x + y) % 2 + x * y % 3) % 2 === 0;
      }
    }

    /* teks → { size, version, mask, modules[y][x] (true = gelap) }.
       forceMask (0–7) hanya untuk pengujian. */
    function encode(text, forceMask) {
      var bytes = Array.prototype.slice.call(new TextEncoder().encode(String(text)));
      var v, cap;
      for (v = 1; v <= 40; v++) {
        cap = dataCodewords(v) * 8;
        if (4 + (v < 10 ? 8 : 16) + bytes.length * 8 <= cap) break;
      }
      if (v > 40) throw new Error('Data terlalu panjang untuk kode QR.');

      /* 1. Aliran bit: mode byte, panjang, data, terminator, pengisi */
      var bits = [];
      function put(val, len) { for (var k = len - 1; k >= 0; k--) bits.push((val >>> k) & 1); }
      put(4, 4);
      put(bytes.length, v < 10 ? 8 : 16);
      bytes.forEach(function (b) { put(b, 8); });
      put(0, Math.min(4, cap - bits.length));
      put(0, (8 - bits.length % 8) % 8);
      for (var pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) put(pad, 8);
      var data = [], i, j, k;
      for (i = 0; i < bits.length; i += 8) {
        var byte = 0;
        for (k = 0; k < 8; k++) byte = (byte << 1) | bits[i + k];
        data.push(byte);
      }

      /* 2. Blok, kode koreksi Reed–Solomon, lalu disisipkan berselang */
      var nb = BLOCKS[v], ecl = ECC[v], raw = Math.floor(rawModules(v) / 8);
      var nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
      var gen = rsGenerator(ecl), blocks = [], eccs = [], pos = 0;
      for (i = 0; i < nb; i++) {
        var len = shortLen - ecl + (i < nShort ? 0 : 1);
        var blk = data.slice(pos, pos + len);
        pos += len;
        blocks.push(blk);
        eccs.push(rsRemainder(blk, gen));
      }
      var code = [];
      for (i = 0; i <= shortLen - ecl; i++) blocks.forEach(function (bk) { if (i < bk.length) code.push(bk[i]); });
      for (i = 0; i < ecl; i++) eccs.forEach(function (e) { code.push(e[i]); });

      /* 3. Matriks dan pola fungsi */
      var size = v * 4 + 17, mod = [], fn = [];
      for (i = 0; i < size; i++) { mod.push([]); fn.push([]); for (j = 0; j < size; j++) { mod[i].push(false); fn[i].push(false); } }
      function setF(x, y, dark) { mod[y][x] = dark; fn[y][x] = true; }
      for (i = 0; i < size; i++) { setF(6, i, i % 2 === 0); setF(i, 6, i % 2 === 0); }
      [[3, 3], [size - 4, 3], [3, size - 4]].forEach(function (c) {
        for (var dy = -4; dy <= 4; dy++) {
          for (var dx = -4; dx <= 4; dx++) {
            var x = c[0] + dx, y = c[1] + dy, dist = Math.max(Math.abs(dx), Math.abs(dy));
            if (x >= 0 && x < size && y >= 0 && y < size) setF(x, y, dist !== 2 && dist !== 4);
          }
        }
      });
      var ap = alignment(v), na = ap.length;
      for (i = 0; i < na; i++) {
        for (j = 0; j < na; j++) {
          if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
          for (var ay = -2; ay <= 2; ay++) {
            for (var ax = -2; ax <= 2; ax++) setF(ap[i] + ax, ap[j] + ay, Math.max(Math.abs(ax), Math.abs(ay)) !== 1);
          }
        }
      }
      function drawFormat(m) {
        var d = m, r = d, n;            /* bit tingkat M = 00 */
        for (n = 0; n < 10; n++) r = (r << 1) ^ ((r >>> 9) * 0x537);
        var b = ((d << 10) | r) ^ 0x5412;
        function bit(q) { return ((b >>> q) & 1) !== 0; }
        for (n = 0; n <= 5; n++) setF(8, n, bit(n));
        setF(8, 7, bit(6)); setF(8, 8, bit(7)); setF(7, 8, bit(8));
        for (n = 9; n < 15; n++) setF(14 - n, 8, bit(n));
        for (n = 0; n < 8; n++) setF(size - 1 - n, 8, bit(n));
        for (n = 8; n < 15; n++) setF(8, size - 15 + n, bit(n));
        setF(8, size - 8, true);
      }
      drawFormat(0); /* menandai area format sebagai pola fungsi */
      if (v >= 7) {
        var vr = v;
        for (k = 0; k < 12; k++) vr = (vr << 1) ^ ((vr >>> 11) * 0x1f25);
        var vb = (v << 12) | vr;
        for (k = 0; k < 18; k++) {
          var on = ((vb >>> k) & 1) !== 0, a = size - 11 + k % 3, c = Math.floor(k / 3);
          setF(a, c, on); setF(c, a, on);
        }
      }

      /* 4. Penempatan zig-zag dua kolom, dari kanan bawah */
      var bi = 0, total = code.length * 8;
      for (var right = size - 1; right >= 1; right -= 2) {
        if (right === 6) right = 5;
        for (var vert = 0; vert < size; vert++) {
          for (j = 0; j < 2; j++) {
            var cx = right - j, up = ((right + 1) & 2) === 0, cy = up ? size - 1 - vert : vert;
            if (!fn[cy][cx] && bi < total) {
              mod[cy][cx] = ((code[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0;
              bi++;
            }
          }
        }
      }

      /* 5. Masker dengan penalti terkecil */
      function applyMask(m) {
        for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) if (!fn[y][x] && maskOn(m, x, y)) mod[y][x] = !mod[y][x];
      }
      function lineScore(get) {
        var s = 0, run = 1, q, t;
        for (q = 1; q <= size; q++) {
          if (q < size && get(q) === get(q - 1)) run++;
          else { if (run >= 5) s += run - 2; run = 1; }
        }
        function light(a, b) { for (t = a; t < b; t++) if (t >= 0 && t < size && get(t)) return false; return true; }
        for (q = 0; q + 7 <= size; q++) {
          if (get(q) && !get(q + 1) && get(q + 2) && get(q + 3) && get(q + 4) && !get(q + 5) && get(q + 6)) {
            if (light(q - 4, q)) s += 40;
            if (light(q + 7, q + 11)) s += 40;
          }
        }
        return s;
      }
      function penalty() {
        var s = 0, dark = 0, x, y;
        for (y = 0; y < size; y++) s += lineScore(function (q) { return mod[y][q]; });
        for (x = 0; x < size; x++) s += lineScore(function (q) { return mod[q][x]; });
        for (y = 0; y < size; y++) {
          for (x = 0; x < size; x++) {
            if (mod[y][x]) dark++;
            if (x < size - 1 && y < size - 1) {
              var c0 = mod[y][x];
              if (c0 === mod[y][x + 1] && c0 === mod[y + 1][x] && c0 === mod[y + 1][x + 1]) s += 3;
            }
          }
        }
        return s + Math.floor(Math.abs(dark * 100 / (size * size) - 50) / 5) * 10;
      }
      var best = typeof forceMask === 'number' ? forceMask : -1, bestScore = Infinity;
      if (best < 0) {
        for (var m = 0; m < 8; m++) {
          applyMask(m); drawFormat(m);
          var sc = penalty();
          if (sc < bestScore) { bestScore = sc; best = m; }
          applyMask(m);
        }
      }
      applyMask(best); drawFormat(best);
      return { size: size, version: v, mask: best, modules: mod };
    }

    /* Satu <path> (baris modul gelap digabung), warna mengikuti currentColor */
    function svg(text) {
      var q = encode(text), d = '';
      for (var y = 0; y < q.size; y++) {
        for (var x = 0; x < q.size;) {
          if (!q.modules[y][x]) { x++; continue; }
          var x0 = x;
          while (x < q.size && q.modules[y][x]) x++;
          d += 'M' + x0 + ' ' + y + 'h' + (x - x0) + 'v1h-' + (x - x0) + 'z';
        }
      }
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + q.size + ' ' + q.size + '" shape-rendering="crispEdges" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="' + d + '"/></svg>';
    }
    return { encode: encode, svg: svg };
  })();

  /* 38 provinsi Indonesia */
  var PROVINSI = [
    'Aceh', 'Sumatera Utara', 'Sumatera Barat', 'Riau', 'Kepulauan Riau', 'Jambi', 'Sumatera Selatan',
    'Kepulauan Bangka Belitung', 'Bengkulu', 'Lampung', 'DKI Jakarta', 'Jawa Barat', 'Banten', 'Jawa Tengah',
    'Daerah Istimewa Yogyakarta', 'Jawa Timur', 'Bali', 'Nusa Tenggara Barat', 'Nusa Tenggara Timur',
    'Kalimantan Barat', 'Kalimantan Tengah', 'Kalimantan Selatan', 'Kalimantan Timur', 'Kalimantan Utara',
    'Sulawesi Utara', 'Gorontalo', 'Sulawesi Tengah', 'Sulawesi Barat', 'Sulawesi Selatan', 'Sulawesi Tenggara',
    'Maluku', 'Maluku Utara', 'Papua', 'Papua Barat', 'Papua Barat Daya', 'Papua Selatan', 'Papua Tengah',
    'Papua Pegunungan'
  ].sort(function (a, b) { return a.localeCompare(b, 'id'); });

  var PENDIDIKAN = [
    'SD / Sederajat', 'SMP / Sederajat', 'SMA / SMK / Sederajat', 'Diploma I (D1)', 'Diploma II (D2)',
    'Diploma III (D3)', 'Diploma IV / Sarjana Terapan', 'Sarjana (S1)', 'Magister (S2)', 'Doktor (S3)'
  ];

  var LEVEL_HINT = {
    'Dasar': 'Memahami prinsip kerja dan melaksanakan tugas di bawah pengawasan.',
    'Menengah': 'Melaksanakan pekerjaan rutin secara mandiri sesuai prosedur.',
    'Mahir': 'Menangani pekerjaan kompleks dan membimbing rekan kerja.',
    'Ahli': 'Menjadi rujukan teknis: merancang, menilai, dan memberi rekomendasi.'
  };

  PPAPI.onReady(async function () {
    var util = PPAPI.util, ui = PPAPI.ui, auth = PPAPI.auth, store = PPAPI.store, icon = PPAPI.icon;
    var h = util.h, $ = util.$, $$ = util.$$;
    var cfg = PPAPI.config || {};
    var komp = (PPAPI.data && PPAPI.data.kompetensi) || {};
    var KATALOG = Array.isArray(komp.katalog) ? komp.katalog : [];
    var LEVELS = (store && store.LEVELS) || komp.level || ['Dasar', 'Menengah', 'Mahir', 'Ahli'];
    var reduced = PPAPI.motion && PPAPI.motion.prefersReduced ? PPAPI.motion.prefersReduced() : false;

    var user = auth && auth.current ? auth.current() : null;
    if (!user || !store) return; // gerbang login di core.js sudah mengalihkan
    var uid = user.uid;
    var member = null;

    var main = $('#main');
    var tabsRoot = $('#agt-tabs');
    var tabs = ui.tabs(tabsRoot);

    /* ------------------------------------------------------------------
       Muat data anggota
       ------------------------------------------------------------------ */
    try {
      member = await store.getMember(uid);
      if (!member) member = await store.ensureMember(user);
    } catch (err) {
      console.error(err);
      showLoadError(err);
      return;
    }
    if (!member) { showLoadError(null); return; }

    function showLoadError(err) {
      var box = $('#agt-load-error');
      if (!box) return;
      box.innerHTML = icon('alert-triangle') + '<div><p class="alert__title">Data anggota belum dapat dimuat.</p><p>' +
        h((err && err.message) || 'Silakan muat ulang halaman beberapa saat lagi.') + '</p>' +
        '<p class="mt-2"><button type="button" class="btn btn--ghost btn--sm" data-action="reload"><span>Muat ulang</span></button></p></div>';
      box.hidden = false;
      if (tabsRoot) tabsRoot.hidden = true;
      var meta = $('#agt-meta');
      if (meta) { meta.innerHTML = ''; meta.removeAttribute('aria-busy'); }
      var nm = $('#agt-name');
      if (nm) nm.textContent = 'Halaman Anggota';
      box.addEventListener('click', function (e) { if (e.target.closest('[data-action="reload"]')) w.location.reload(); });
    }

    /* ------------------------------------------------------------------
       Helpers
       ------------------------------------------------------------------ */
    function displayName() {
      var n = member.name || user.name || '';
      if (n) return n;
      var em = member.email || user.email || '';
      return em ? em.split('@')[0] : 'Anggota';
    }
    function safeHttps(url) {
      var s = String(url || '').trim();
      if (!/^https:\/\//i.test(s)) return '';
      try { return new URL(s).href; } catch (e) { return ''; }
    }
    function isHttpsUrl(s) {
      try { var u = new URL(String(s || '').trim()); return u.protocol === 'https:' && u.hostname.indexOf('.') > 0; }
      catch (e) { return false; }
    }
    function levelIndex(l) { var i = LEVELS.indexOf(l); return i < 0 ? 0 : i; }
    function katalogBy(code) {
      if (!code) return null;
      for (var i = 0; i < KATALOG.length; i++) if (KATALOG[i].kode === code) return KATALOG[i];
      return null;
    }
    function thisYear() { return new Date().getFullYear(); }
    /* ---------- Status keanggotaan (SPEC v2) ----------
       Halaman ini ber-data-auth="active": yang membuka adalah anggota berstatus Aktif
       atau admin PPAPI (yang keanggotaan pribadinya bisa saja belum Aktif). */
    function sess() { return PPAPI.session && PPAPI.session.current ? PPAPI.session.current() : {}; }
    function effStatus() { return util.effectiveStatus(member) || 'Draf'; }
    /* KTA, kode QR, dan entri registri hanya ada bila keanggotaan Aktif */
    function hasCard() { return util.isActiveMember(member) && !!member.kta; }
    /* Nomor KTA resmi: hanya bila keanggotaan pernah disetujui (akun v1 yang belum
       diverifikasi masih menyimpan nomor sementara yang tidak berlaku) */
    function officialKta() {
      var st = effStatus();
      if (!member.kta) return '';
      return st === 'Aktif' || st === 'Kedaluwarsa' || st === 'Nonaktif' || member.approvedAt ? member.kta : '';
    }
    /* Masa berlaku = member.validUntil yang ditetapkan sekretariat saat menyetujui /
       memperpanjang keanggotaan (tidak pernah dikarang). Kosong pada rekaman lama. */
    function validUntilIso() {
      var v = String(member.validUntil || '').trim();
      return /^\d{4}-\d{2}-\d{2}$/.test(v) && util.parseDate(v) ? v : '';
    }
    /* Teks pengganti "Berlaku hingga" ketika tanggalnya belum ditetapkan */
    function validUntilPending() {
      return util.isActiveMember(member) ? 'Ditetapkan oleh sekretariat' : '—';
    }
    /* ---------- Nama pada kartu = nama yang tercatat pada daftar verifikasi ----------
       Kartu tidak memakai member.name (dapat diubah pemilik akun kapan saja), melainkan
       `nama` pada entri daftar verifikasi registry/{kta} yang ditulis sekretariat saat
       menyetujui keanggotaan — data yang sama dengan yang ditampilkan kode QR di
       verifikasi.html. Bila entri belum ada atau gagal dimuat, kartu memakai nama profil
       dan menampilkan pemberitahuan bahwa nama tersebut belum dicocokkan. */
    var cardRec = { state: 'loading', nama: '' };   // loading | ok | missing | error
    function cleanText(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
    function loadCardRecord() {
      if (!hasCard()) { cardRec = { state: 'missing', nama: '' }; return Promise.resolve(); }
      var reg = store.registry;
      if (!reg || typeof reg.lookup !== 'function') { cardRec = { state: 'error', nama: '' }; return Promise.resolve(); }
      var kta = member.kta, timer = null;
      var limit = new Promise(function (resolve, reject) {
        timer = setTimeout(function () { reject(new Error('Waktu tunggu daftar verifikasi habis.')); }, 10000);
      });
      return Promise.race([reg.lookup(kta), limit]).then(function (res) {
        var e = res && res.exact, nama = e ? cleanText(e.nama) : '';
        cardRec = nama ? { state: 'ok', nama: nama } : { state: 'missing', nama: '' };
      }, function (err) {
        console.warn('[anggota] Daftar verifikasi belum dapat dimuat:', err && err.message);
        cardRec = { state: 'error', nama: '' };
      }).then(function () { clearTimeout(timer); });
    }
    function cardName() { return cardRec.state === 'ok' ? cardRec.nama : displayName(); }
    function verifyUrl() { return util.siteUrl('verifikasi.html?kta=' + encodeURIComponent(member.kta || '')); }
    function prettyUrl(u) { return String(u || '').replace(/^https?:\/\//i, ''); }
    function addDescribedBy(el, id) {
      var cur = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
      if (cur.indexOf(id) === -1) { cur.push(id); el.setAttribute('aria-describedby', cur.join(' ')); }
    }
    /* Inline field error (shared by the profile form and modal forms) */
    function setError(control, msg) {
      if (!control) return;
      var field = control.closest('.field') || control.closest('.agt-radio-group');
      if (!field) return;
      var errId = control.id + '-err';
      var err = d.getElementById(errId);
      if (msg) {
        if (!err) {
          err = d.createElement('p');
          err.className = 'field__error';
          err.id = errId;
          field.appendChild(err);
        }
        err.textContent = msg;
        field.classList.add('is-invalid');
        control.setAttribute('aria-invalid', 'true');
        addDescribedBy(control, errId);
      } else {
        field.classList.remove('is-invalid');
        control.removeAttribute('aria-invalid');
        if (err) err.textContent = '';
      }
    }
    function errMessage(err, fallback) { return (err && err.message) || fallback; }
    async function persist(patch) {
      member = await store.saveMember(uid, patch);
      afterDataChange();
      return member;
    }
    function afterDataChange() {
      updateCounts();
      renderCompleteness();
    }
    /* After a re-render the control that opened a modal may be gone: move focus to a sensible
       target, but only when focus was actually lost and no other dialog has opened meanwhile. */
    function focusLater(el) {
      if (!el) return;
      setTimeout(function () {
        var a = d.activeElement;
        var lost = !a || a === d.body || a === d.documentElement || !a.isConnected;
        if (!lost || $('.modal') || !el.isConnected) return;
        try { el.focus({ preventScroll: true }); } catch (e) { el.focus(); }
      }, 320);
    }

    /* ==================================================================
       1. HERO
       ================================================================== */
    function renderHero() {
      var hero = $('.agt-hero');
      var name = displayName();
      var av = $('#agt-avatar');
      var photo = safeHttps(member.photoURL || user.photoURL);
      if (av) {
        av.innerHTML = '<span class="agt-avatar__inner">' + (photo
          ? '<img src="' + h(photo) + '" alt="" width="124" height="124" referrerpolicy="no-referrer" decoding="async">'
          : h(util.initials(name) || 'A')) + '</span>';
      }
      var nm = $('#agt-name');
      if (nm) {
        var line = $('.line > span', nm);
        if (line) line.textContent = name;
        else { nm.textContent = name; nm.classList.add('split-lines'); }
      }
      var meta = $('#agt-meta');
      if (meta) {
        var s = sess(), kta = officialKta(), until = validUntilIso();
        meta.innerHTML =
          (kta ? '<span class="agt-hero__kta"><span class="sr-only">Nomor KTA </span>' + h(kta) + '</span>' +
            '<span><span class="sr-only">Kategori </span>' + h(member.memberType || 'Praktisi') + '</span>' : '') +
          (s.isAdmin ? '<span class="badge badge--metal">Admin PPAPI</span>' : '') +
          /* admin yang keanggotaan pribadinya belum Aktif: lencana status tidak ditampilkan (sama dengan menu akun) */
          (!s.isAdmin || util.isActiveMember(member) ? '<span class="agt-hero__status"><span class="sr-only">Status </span>' + util.statusBadge(effStatus()) + '</span>' : '') +
          (kta && until ? '<span class="agt-hero__since">Berlaku hingga ' + h(util.formatDate(until)) + '</span>'
            : kta && member.joinedAt ? '<span class="agt-hero__since">Anggota sejak ' + h(util.formatDate(member.joinedAt)) + '</span>' : '');
        meta.removeAttribute('aria-busy');
      }
      var chips = $('#agt-chips');
      if (chips) {
        var email = member.email || user.email || '';
        var phone = member.phone || user.phone || '';
        chips.innerHTML =
          (email ? '<li class="agt-chip">' + icon('mail', { size: 16 }) + '<span class="agt-chip__text"><span class="sr-only">Email: </span>' + h(email) + '</span></li>' : '') +
          (phone ? '<li class="agt-chip">' + icon('phone', { size: 16 }) + '<span class="agt-chip__text"><span class="sr-only">Nomor HP: </span>' + h(util.formatPhoneID(phone)) + '</span></li>' : '');
        chips.hidden = !chips.children.length;
      }
      if (hero) ui.reveal(hero);
    }

    /* ==================================================================
       2. TABS — counts, horizontal scroll sync, deep links
       ================================================================== */
    function setCount(id, n) {
      var el = d.getElementById(id);
      if (!el) return;
      el.innerHTML = n ? '<span class="sr-only">(</span>' + n + '<span class="sr-only"> tercatat)</span>' : '';
    }
    function updateCounts() {
      setCount('count-kompetensi', member.competencies.length);
      setCount('count-sertifikat', member.certificates.length);
    }

    var tabBar = $('.agt-tabs__bar');
    var tabList = tabBar ? $('.tabs__list', tabBar) : null;
    function updateTabFades() {
      if (!tabList) return;
      var max = tabList.scrollWidth - tabList.clientWidth;
      tabBar.toggleAttribute('data-more-left', tabList.scrollLeft > 4);
      tabBar.toggleAttribute('data-more-right', max > 4 && tabList.scrollLeft < max - 4);
    }
    function keepTabVisible(tab) {
      if (!tabList || !tab) return;
      var lr = tabList.getBoundingClientRect(), tr = tab.getBoundingClientRect(), pad = 64;
      if (tr.left < lr.left + pad) tabList.scrollLeft -= (lr.left + pad - tr.left);
      else if (tr.right > lr.right - pad) tabList.scrollLeft += (tr.right - lr.right + pad);
      updateTabFades();
    }
    if (tabList) {
      tabList.addEventListener('scroll', function () { w.requestAnimationFrame(updateTabFades); }, { passive: true });
      w.addEventListener('resize', util.debounce(updateTabFades, 120));
      keepTabVisible($('[role="tab"][aria-selected="true"]', tabList));
    }
    if (tabsRoot) {
      tabsRoot.addEventListener('tabs:change', function (e) {
        var det = e.detail || {};
        keepTabVisible(det.tab);
      });
    }
    function gotoTab(key, focusTab) {
      if (!tabs) return;
      tabs.select(key);
      if (tabsRoot) tabsRoot.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      var t = d.getElementById('tab-' + key);
      if (focusTab && t) { try { t.focus({ preventScroll: true }); } catch (er) { t.focus(); } }
    }
    $$('[data-goto-tab]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        e.preventDefault();
        gotoTab(a.getAttribute('data-goto-tab'), true);
      });
    });

    /* ==================================================================
       3. PROFIL DIRI
       ================================================================== */
    var form = $('#profil-form');
    var saveBtn = $('#profil-save'), resetBtn = $('#profil-reset');
    var savebar = $('#profil-savebar'), statusEl = $('#profil-status');
    function F(id) { return d.getElementById('f-' + id); }
    var baseline = '', dirty = false, saving = false, submitted = false;
    var touched = {};

    function addOptions(select, list) {
      if (!select) return;
      select.insertAdjacentHTML('beforeend', list.map(function (v) { return '<option value="' + h(v) + '">' + h(v) + '</option>'; }).join(''));
    }
    /* keep legacy values that are not in the list (e.g. "D3 Teknik Sipil") */
    function ensureOption(select, value) {
      if (!select || !value) return;
      var has = Array.prototype.some.call(select.options, function (o) { return o.value === value; });
      if (!has) select.add(new Option(value, value), 1);
    }
    addOptions(F('province'), PROVINSI);
    addOptions(F('education'), PENDIDIKAN);

    function fillProfil() {
      var p = member.profile || {};
      F('name').value = member.name || user.name || '';
      F('birthPlace').value = p.birthPlace || '';
      F('birthDate').value = /^\d{4}-\d{2}-\d{2}$/.test(String(p.birthDate || '')) ? p.birthDate : '';
      $$('input[name="gender"]', form).forEach(function (r) { r.checked = r.value === p.gender; });
      ensureOption(F('province'), p.province);
      F('province').value = p.province || '';
      F('city').value = p.city || '';
      F('address').value = p.address || '';
      F('company').value = p.company || '';
      F('position').value = p.position || '';
      F('experienceYears').value = (p.experienceYears === null || p.experienceYears === undefined || p.experienceYears === '') ? '' : String(p.experienceYears);
      ensureOption(F('education'), p.education);
      F('education').value = p.education || '';
      F('bio').value = p.bio || '';
      F('linkedin').value = p.linkedin || '';
      var email = member.email || user.email || '';
      var phone = member.phone || user.phone || '';
      F('email').value = email;
      F('email').placeholder = email ? '' : 'Belum terhubung';
      F('phone').value = phone ? util.formatPhoneID(phone) : '';
      F('phone').placeholder = phone ? '' : 'Belum terhubung';
      updateBioCount();
      applyIdentityLock();
      $$('.field.is-invalid, .agt-radio-group.is-invalid', form).forEach(function (f) { f.classList.remove('is-invalid'); });
      $$('[aria-invalid]', form).forEach(function (c) { c.removeAttribute('aria-invalid'); });
    }
    /* ---------- Data identitas setelah keanggotaan disetujui ----------
       Nama lengkap dan tanggal lahir telah ditinjau sekretariat saat menyetujui keanggotaan;
       nama tersebut tercatat pada daftar verifikasi dan tampil pada KTA. Setelah disetujui
       (member.approvedAt terisi), keduanya tidak dapat diubah dari halaman ini — perbaikan
       melalui sekretariat. Isian yang masih kosong tetap dapat dilengkapi. */
    var lock = { name: false, birthDate: false };
    function applyIdentityLock() {
      var p = member.profile || {};
      var approved = !!String(member.approvedAt || '').trim();
      lock.name = approved && cleanText(member.name).length >= 3;
      lock.birthDate = approved && /^\d{4}-\d{2}-\d{2}$/.test(String(p.birthDate || ''));
      var note = $('#f-identity-note'), hint = $('#f-name-hint');
      [['name', F('name')], ['birthDate', F('birthDate')]].forEach(function (x) {
        var el = x[1];
        if (!el) return;
        el.readOnly = lock[x[0]];
        var ids = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(function (id) { return id && id !== 'f-identity-note' && id !== 'f-name-hint'; });
        if (x[0] === 'name' && !lock.name) ids.unshift('f-name-hint');
        if (lock[x[0]]) ids.push('f-identity-note');
        if (ids.length) el.setAttribute('aria-describedby', ids.join(' ')); else el.removeAttribute('aria-describedby');
      });
      if (hint) hint.hidden = lock.name;
      if (note) {
        var what = lock.name && lock.birthDate ? 'Nama lengkap dan tanggal lahir' : lock.name ? 'Nama lengkap' : 'Tanggal lahir';
        var txt = $('.agt-note__text', note);
        if (txt) {
          txt.innerHTML = h(what) + ' tidak dapat diubah di sini setelah keanggotaan disetujui sekretariat' +
            (lock.name ? ', karena nama tersebut tercatat pada daftar verifikasi dan tampil pada Kartu Tanda Anggota' : '') +
            '. Untuk perbaikan data, silakan hubungi sekretariat melalui halaman <a class="link" href="umpan-balik.html?kategori=Pertanyaan">Kontak</a>.';
        }
        note.hidden = !(lock.name || lock.birthDate);
      }
    }
    function readProfil() {
      var g = $('input[name="gender"]:checked', form);
      var exRaw = F('experienceYears').value.trim();
      return {
        name: F('name').value.trim().replace(/\s+/g, ' '),
        profile: {
          birthPlace: F('birthPlace').value.trim(),
          birthDate: F('birthDate').value,
          gender: g ? g.value : '',
          province: F('province').value,
          city: F('city').value.trim(),
          address: F('address').value.trim(),
          company: F('company').value.trim(),
          position: F('position').value.trim(),
          experienceYears: exRaw === '' ? null : Number(exRaw),
          education: F('education').value,
          bio: F('bio').value.trim(),
          linkedin: F('linkedin').value.trim()
        }
      };
    }
    function snapshot() { return JSON.stringify(readProfil()); }

    function normalizeLinkedin(s) {
      s = String(s || '').trim();
      if (!s) return '';
      if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = 'https://' + s.replace(/^\/+/, '');
      var u;
      try { u = new URL(s); } catch (e) { return null; }
      if (!/^https?:$/.test(u.protocol) || !/(^|\.)linkedin\.com$/i.test(u.hostname)) return null;
      u.protocol = 'https:';
      return u.href;
    }

    function validateProfil(v, showAll) {
      var bad = [];
      function chk(ctrl, msg) {
        var show = showAll || touched[ctrl.id];
        setError(ctrl, show ? msg : '');
        if (msg) bad.push(ctrl);
      }
      chk(F('name'), !lock.name && v.name.length < 3 ? 'Nama lengkap minimal 3 karakter.' : '');
      var bd = v.profile.birthDate, bmsg = '';
      if (lock.birthDate) bmsg = '';
      else if (F('birthDate').validity && F('birthDate').validity.badInput) bmsg = 'Format tanggal tidak valid.';
      else if (bd) {
        var dt = util.parseDate(bd);
        if (!dt) bmsg = 'Format tanggal tidak valid.';
        else if (util.daysUntil(bd) > 0) bmsg = 'Tanggal lahir tidak boleh melewati hari ini.';
        else if (dt.getFullYear() < 1920) bmsg = 'Periksa kembali tahun lahir Anda.';
      }
      chk(F('birthDate'), bmsg);
      var ex = v.profile.experienceYears, exEl = F('experienceYears');
      var exBad = (exEl.validity && exEl.validity.badInput) || (ex !== null && (!isFinite(ex) || Math.floor(ex) !== ex || ex < 0 || ex > 80));
      chk(exEl, exBad ? 'Isi dengan bilangan bulat antara 0 dan 80.' : '');
      var li = v.profile.linkedin;
      chk(F('linkedin'), li && !normalizeLinkedin(li) ? 'Gunakan alamat profil LinkedIn, misalnya https://www.linkedin.com/in/nama-anda.' : '');
      chk(F('bio'), v.profile.bio.length > 1000 ? 'Ringkasan profil maksimal 1.000 karakter.' : '');
      return bad;
    }

    function updateBioCount() {
      var n = F('bio').value.length, el = $('#f-bio-count');
      if (!el) return;
      el.textContent = util.formatNumber(n) + ' / 1.000';
      el.classList.toggle('is-over', n > 1000);
    }

    function updateDirty() {
      var now = snapshot() !== baseline;
      var changed = now !== dirty || !statusEl.textContent;
      dirty = now;
      if (savebar) savebar.classList.toggle('is-dirty', dirty);
      if (saveBtn && !saveBtn.classList.contains('is-loading')) saveBtn.disabled = !dirty || saving;
      if (resetBtn) resetBtn.disabled = !dirty || saving;
      if (changed && statusEl) {
        statusEl.textContent = dirty
          ? 'Ada perubahan yang belum disimpan'
          : 'Semua perubahan tersimpan' + (member.updatedAt ? ' · ' + util.relativeTime(member.updatedAt) : '');
      }
    }

    function initProfil() {
      if (!form) return;
      fillProfil();
      $$('fieldset[disabled]', form).forEach(function (fs) { fs.disabled = false; });
      baseline = snapshot();
      dirty = false;
      statusEl.textContent = '';
      updateDirty();

      form.addEventListener('input', function (e) {
        if (e.target === F('bio')) updateBioCount();
        if (submitted || touched[e.target.id]) validateProfil(readProfil(), submitted);
        updateDirty();
      });
      form.addEventListener('change', function () { updateDirty(); });
      form.addEventListener('focusout', function (e) {
        var t = e.target;
        if (!t || !t.id || t.readOnly || !/^f-/.test(t.id)) return;
        if (t.value !== '' || t.id === 'f-name') touched[t.id] = true;
        validateProfil(readProfil(), submitted);
      });
      resetBtn.addEventListener('click', function () {
        fillProfil();
        submitted = false;
        touched = {};
        updateDirty();
        ui.toast('Perubahan dibatalkan. Data dikembalikan ke versi tersimpan.', { type: 'info' });
      });
      form.addEventListener('submit', async function (e) {
        e.preventDefault();
        if (saving) return;
        submitted = true;
        var v = readProfil();
        var bad = validateProfil(v, true);
        if (bad.length) {
          bad[0].focus();
          ui.toast('Periksa kembali isian yang ditandai.', { type: 'warn' });
          return;
        }
        v.profile.linkedin = v.profile.linkedin ? normalizeLinkedin(v.profile.linkedin) : '';
        /* data identitas yang terkunci dikirim persis seperti tersimpan (tidak pernah diubah dari sini) */
        if (lock.birthDate) v.profile.birthDate = (member.profile || {}).birthDate;
        saving = true;
        ui.setLoading(saveBtn, true, 'Menyimpan…');
        resetBtn.disabled = true;
        try {
          member = await store.saveMember(uid, { profile: v.profile });
          var currentName = member.name || user.name || '';
          if (!lock.name && v.name && v.name !== currentName) {
            await auth.updateName(v.name);
            user = auth.current() || user;
            member = (await store.getMember(uid)) || member;
          }
          submitted = false;
          touched = {};
          fillProfil();
          baseline = snapshot();
          renderHero();
          renderKartu();
          afterDataChange();
          ui.toast('Profil berhasil disimpan.', { type: 'success' });
        } catch (err) {
          console.error(err);
          ui.toast(errMessage(err, 'Profil gagal disimpan. Silakan coba lagi.'), { type: 'error' });
        } finally {
          saving = false;
          ui.setLoading(saveBtn, false);
          statusEl.textContent = '';
          updateDirty();
        }
      });

      w.addEventListener('beforeunload', function (e) {
        if (dirty && !saving) { e.preventDefault(); e.returnValue = ''; return ''; }
      });
    }

    /* ---------- Kelengkapan profil ---------- */
    function completeness() {
      /* definisi bersama dengan dasbor: PPAPI.util.profileCompleteness (core.js) */
      var r = util.profileCompleteness(member);
      var items = r.items.filter(function (x) { return x.group === 'pribadi' || x.group === 'profesional'; }).map(function (x) {
        return { key: x.key, label: x.short, group: x.group, focus: x.focus, done: x.ok };
      });
      function grp(g) {
        var list = items.filter(function (x) { return x.group === g; });
        return { done: list.filter(function (x) { return x.done; }).length, total: list.length };
      }
      return { pct: r.pct, items: items, comp: r.comp, cert: r.cert, pribadi: grp('pribadi'), profesional: grp('profesional') };
    }
    function renderCompleteness() {
      var box = $('#agt-complete');
      if (!box) return;
      var c = completeness();
      var missing = c.items.filter(function (x) { return !x.done; });
      function row(done, label, count) {
        return '<li class="' + (done ? 'is-done' : '') + '"><span class="agt-checklist__mark">' + icon('check', { size: 13 }) + '</span>' +
          '<span>' + label + '</span><span class="agt-checklist__count">' + count + '</span></li>';
      }
      function linkRow(n, key, label) {
        return '<li class="' + (n ? 'is-done' : '') + '"><span class="agt-checklist__mark">' + icon('check', { size: 13 }) + '</span>' +
          '<button type="button" class="agt-checklist__link" data-goto="' + key + '">' + label + '</button>' +
          '<span class="agt-checklist__count">' + (n ? n + ' tercatat' : 'Belum ada') + '</span></li>';
      }
      box.innerHTML =
        '<h2 class="agt-complete__title" id="agt-complete-title">Kelengkapan profil</h2>' +
        '<p class="agt-complete__num"><span data-count="' + c.pct + '">' + c.pct + '</span><small>%</small></p>' +
        '<div class="progress progress--metal" role="progressbar" aria-labelledby="agt-complete-title" aria-valuemin="0" aria-valuemax="100" aria-valuenow="' + c.pct + '" style="--value:' + c.pct + '"></div>' +
        '<p class="agt-complete__caption">' + (c.pct >= 100
          ? 'Profil Anda telah lengkap. Terima kasih telah menjaga data keanggotaan tetap mutakhir.'
          : 'Profil yang lengkap memudahkan sekretariat memverifikasi keanggotaan dan kompetensi Anda.') + '</p>' +
        '<ul class="agt-checklist" role="list">' +
          row(c.pribadi.done === c.pribadi.total, 'Data pribadi', c.pribadi.done + '/' + c.pribadi.total) +
          row(c.profesional.done === c.profesional.total, 'Data profesional', c.profesional.done + '/' + c.profesional.total) +
          linkRow(c.comp, 'kompetensi', 'Kompetensi') +
          linkRow(c.cert, 'sertifikat', 'Sertifikat') +
        '</ul>' +
        (missing.length ? '<div class="agt-missing"><p class="agt-missing__label" id="agt-missing-label">Belum diisi</p>' +
          '<div class="agt-missing__list" role="group" aria-labelledby="agt-missing-label">' +
          missing.map(function (m) { return '<button type="button" class="agt-missing__chip" data-focus-field="' + h(m.focus) + '">' + icon('plus', { size: 14 }) + h(m.label) + '</button>'; }).join('') +
          '</div></div>' : '') +
        '<div class="agt-complete__meta">' +
          (member.updatedAt ? '<span>Terakhir diperbarui ' + h(util.formatDate(member.updatedAt)) + '</span>' : '') +
          '<span>Data Anda diproses sesuai <a class="link" href="kebijakan-privasi.html">Kebijakan Privasi</a> PPAPI.</span>' +
        '</div>';
      ui.reveal(box);
    }
    var completeBox = $('#agt-complete');
    if (completeBox) {
      completeBox.addEventListener('click', function (e) {
        var f = e.target.closest('[data-focus-field]');
        if (f) {
          var el = F(f.getAttribute('data-focus-field'));
          if (el) {
            el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
            setTimeout(function () { try { el.focus({ preventScroll: true }); } catch (er) { el.focus(); } }, reduced ? 0 : 380);
          }
          return;
        }
        var g = e.target.closest('[data-goto]');
        if (g) gotoTab(g.getAttribute('data-goto'), true);
      });
    }

    /* ==================================================================
       4. KOMPETENSI
       ================================================================== */
    function sortedKompetensi() {
      return member.competencies.slice().sort(function (a, b) {
        return (levelIndex(b.level) - levelIndex(a.level)) ||
          ((a.since || 9999) - (b.since || 9999)) ||
          String(a.name || '').localeCompare(String(b.name || ''), 'id');
      });
    }
    function addKompetensiBtn() {
      return '<button type="button" class="btn btn--primary btn--sm" data-action="add-kompetensi">' + icon('plus', { size: 16 }) + '<span>Tambah Kompetensi</span></button>';
    }
    function kompetensiCard(c) {
      var kat = katalogBy(c.code);
      var li = levelIndex(c.level);
      var since = c.since ? Number(c.since) : null;
      var dur = since ? thisYear() - since : null;
      var durText = dur === null ? '' : dur <= 0 ? 'Mulai tahun ini' : dur + ' tahun pengalaman';
      var bars = LEVELS.map(function (l, i) { return '<span' + (i <= li ? ' class="is-on"' : '') + '></span>'; }).join('');
      var labels = LEVELS.map(function (l, i) { return '<span' + (i === li ? ' class="is-current"' : '') + '>' + h(l) + '</span>'; }).join('');
      var name = c.name || 'Kompetensi tanpa nama';
      return '<article class="card card--nodes agt-comp" data-id="' + h(c.id) + '">' +
        '<div class="agt-comp__top">' +
          '<p class="agt-comp__meta">' +
            (c.code ? '<span class="agt-code">' + h(c.code) + '</span>' : '<span class="agt-code agt-code--muted">Lainnya</span>') +
            (kat ? '<span class="tag">' + h(kat.kelompok) + '</span>' : '') +
          '</p>' +
          '<div class="agt-comp__actions">' +
            '<button type="button" class="icon-btn icon-btn--ghost" data-action="edit-kompetensi" data-id="' + h(c.id) + '" aria-label="Ubah kompetensi ' + h(name) + '">' + icon('edit', { size: 18 }) + '</button>' +
            '<button type="button" class="icon-btn icon-btn--ghost" data-action="delete-kompetensi" data-id="' + h(c.id) + '" aria-label="Hapus kompetensi ' + h(name) + '">' + icon('trash', { size: 18 }) + '</button>' +
          '</div>' +
        '</div>' +
        '<h3 class="agt-comp__title">' + h(name) + '</h3>' +
        '<div class="agt-level" role="img" aria-label="Tingkat penguasaan ' + h(LEVELS[li]) + ', ' + (li + 1) + ' dari ' + LEVELS.length + '">' +
          '<div class="agt-level__head" aria-hidden="true"><span>Tingkat penguasaan</span><span class="agt-level__step"><b>' + util.pad(li + 1) + '</b> / ' + util.pad(LEVELS.length) + '</span></div>' +
          '<div class="agt-level__bars" aria-hidden="true">' + bars + '</div>' +
          '<div class="agt-level__labels" aria-hidden="true">' + labels + '</div>' +
        '</div>' +
        '<div class="agt-comp__foot">' +
          (since ? '<span>Sejak <strong>' + since + '</strong></span><span>' + h(durText) + '</span>' : '<span>Tahun mulai belum diisi</span>') +
        '</div>' +
        (c.notes ? '<p class="agt-comp__notes">' + h(c.notes) + '</p>' : '') +
      '</article>';
    }
    function renderKompetensi() {
      var host = $('#kompetensi-list');
      if (!host) return;
      var list = sortedKompetensi();
      host.innerHTML = list.length
        ? '<div class="agt-comp-grid" data-reveal-stagger>' + list.map(kompetensiCard).join('') + '</div>'
        : ui.emptyState({
            icon: 'award',
            title: 'Belum ada kompetensi tercatat',
            text: 'Tambahkan kualifikasi perancah yang Anda kuasai, misalnya operator, pengawas, atau inspektur scaffolding, beserta tingkat penguasaannya.',
            actionHtml: addKompetensiBtn()
          });
      ui.reveal(host);
    }

    function openKompetensiModal(item) {
      var editing = !!item;
      var groups = {}, order = [];
      KATALOG.forEach(function (k) {
        var g = k.kelompok || 'Lainnya';
        if (!groups[g]) { groups[g] = []; order.push(g); }
        groups[g].push(k);
      });
      var selVal = item ? (katalogBy(item.code) ? item.code : '__lain') : '';
      var options = '<option value="">Pilih kompetensi…</option>' +
        order.map(function (g) {
          return '<optgroup label="' + h(g) + '">' + groups[g].map(function (k) {
            return '<option value="' + h(k.kode) + '"' + (selVal === k.kode ? ' selected' : '') + '>' + h(k.nama) + '</option>';
          }).join('') + '</optgroup>';
        }).join('') +
        '<optgroup label="Lainnya"><option value="__lain"' + (selVal === '__lain' ? ' selected' : '') + '>Lainnya — tulis sendiri</option></optgroup>';
      var curLevel = item ? item.level : LEVELS[0];
      var levelOpts = LEVELS.map(function (l) { return '<option value="' + h(l) + '"' + (l === curLevel ? ' selected' : '') + '>' + h(l) + '</option>'; }).join('');
      var y = thisYear();
      var body =
        '<form class="form agt-mform" id="mk-form" novalidate>' +
          '<div class="field">' +
            '<label class="field__label" for="mk-kode"><span>Kompetensi <span class="agt-req" aria-hidden="true">*</span></span></label>' +
            '<select class="field__control" id="mk-kode" required aria-describedby="mk-desc">' + options + '</select>' +
            '<p class="agt-mform__desc" id="mk-desc" aria-live="polite"></p>' +
          '</div>' +
          '<div class="field" id="mk-nama-field" hidden>' +
            '<label class="field__label" for="mk-nama"><span>Nama kompetensi <span class="agt-req" aria-hidden="true">*</span></span></label>' +
            '<input class="field__control" id="mk-nama" aria-required="true" type="text" maxlength="150" autocomplete="off" value="' + h(item && selVal === '__lain' ? item.name : '') + '">' +
          '</div>' +
          '<div class="form__row form__row--2">' +
            '<div class="field">' +
              '<label class="field__label" for="mk-level">Tingkat penguasaan</label>' +
              '<select class="field__control" id="mk-level" aria-describedby="mk-level-hint">' + levelOpts + '</select>' +
              '<p class="field__hint" id="mk-level-hint"></p>' +
            '</div>' +
            '<div class="field">' +
              '<label class="field__label" for="mk-since">Sejak tahun <span class="opt">(opsional)</span></label>' +
              '<input class="field__control" id="mk-since" type="number" inputmode="numeric" min="1960" max="' + y + '" step="1" placeholder="Contoh: ' + (y - 5) + '" value="' + h(item && item.since ? item.since : '') + '">' +
            '</div>' +
          '</div>' +
          '<div class="field">' +
            '<label class="field__label" for="mk-notes"><span>Catatan <span class="opt">(opsional)</span></span><span class="field__counter" id="mk-notes-count" aria-hidden="true">0 / 300</span></label>' +
            '<textarea class="field__control" id="mk-notes" rows="3" maxlength="300" aria-describedby="mk-notes-hint">' + h(item ? item.notes : '') + '</textarea>' +
            '<p class="field__hint" id="mk-notes-hint">Misalnya jenis perancah yang dikuasai atau nomor skema sertifikasi terkait.</p>' +
          '</div>' +
          '<button type="submit" hidden tabindex="-1" aria-hidden="true"></button>' +
        '</form>';

      var root = null;
      function q(id) { return root ? root.querySelector('#' + id) : null; }
      function syncKode() {
        var v = q('mk-kode').value, k = katalogBy(v);
        q('mk-nama-field').hidden = v !== '__lain';
        q('mk-desc').textContent = k ? k.kode + ' · ' + (k.deskripsi || '') : (v === '__lain' ? 'Tuliskan nama kompetensi yang tidak tercantum dalam katalog.' : '');
        setError(q('mk-kode'), '');
      }
      function syncLevel() { q('mk-level-hint').textContent = LEVEL_HINT[q('mk-level').value] || ''; }
      function syncNotes() { q('mk-notes-count').textContent = util.formatNumber(q('mk-notes').value.length) + ' / 300'; }

      function submit() {
        var code = q('mk-kode').value;
        var lain = code === '__lain';
        var k = katalogBy(code);
        var name = lain ? q('mk-nama').value.trim().replace(/\s+/g, ' ') : (k ? k.nama : '');
        var sinceRaw = q('mk-since').value.trim();
        var since = sinceRaw === '' ? null : Number(sinceRaw);
        var notes = q('mk-notes').value.trim();
        var bad = [];
        function chk(el, msg) { setError(el, msg); if (msg) bad.push(el); }
        chk(q('mk-kode'), !code ? 'Pilih kompetensi dari katalog atau pilih "Lainnya".' : '');
        if (lain) chk(q('mk-nama'), name.length < 3 ? 'Nama kompetensi minimal 3 karakter.' : '');
        var sinceEl = q('mk-since');
        chk(sinceEl, (sinceEl.validity && sinceEl.validity.badInput) || (since !== null && (!isFinite(since) || Math.floor(since) !== since || since < 1960 || since > y))
          ? 'Isi tahun antara 1960 dan ' + y + '.' : '');
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
        var rec = {
          id: item ? item.id : util.uid('k'),
          code: keepCode, name: name, level: q('mk-level').value, since: since, notes: notes
        };
        var next = item
          ? member.competencies.map(function (c) { return c.id === item.id ? rec : c; })
          : member.competencies.concat([rec]);
        return persist({ competencies: next }).then(function () {
          renderKompetensi();
          ui.toast(editing ? 'Kompetensi berhasil diperbarui.' : 'Kompetensi berhasil ditambahkan.', { type: 'success' });
          var card = $('.agt-comp[data-id="' + rec.id.replace(/"/g, '') + '"] [data-action="edit-kompetensi"]');
          focusLater(card || $('[data-action="add-kompetensi"]'));
          return true;
        });
      }

      ui.modal({
        title: editing ? 'Ubah kompetensi' : 'Tambah kompetensi',
        eyebrow: 'Kompetensi & keahlian',
        size: 'md',
        cls: 'agt-modal',
        body: body,
        actions: [
          { label: 'Batal', variant: 'ghost' },
          { label: editing ? 'Simpan perubahan' : 'Tambahkan', variant: 'primary', onClick: function () { return submit(); } }
        ],
        onOpen: function (el) {
          root = el;
          syncKode(); syncLevel(); syncNotes();
          q('mk-kode').addEventListener('change', function () { syncKode(); if (q('mk-kode').value === '__lain') q('mk-nama').focus(); });
          q('mk-level').addEventListener('change', syncLevel);
          q('mk-notes').addEventListener('input', syncNotes);
          q('mk-nama').addEventListener('input', function () { setError(q('mk-nama'), ''); });
          q('mk-since').addEventListener('input', function () { setError(q('mk-since'), ''); });
          q('mk-form').addEventListener('submit', function (e) {
            e.preventDefault();
            var btns = el.querySelectorAll('.modal__footer .btn');
            if (btns.length) btns[btns.length - 1].click();
          });
        }
      });
    }

    async function deleteKompetensi(id) {
      var c = member.competencies.filter(function (x) { return x.id === id; })[0];
      if (!c) return;
      var ok = await ui.confirm('Kompetensi “' + (c.name || 'tanpa nama') + '” akan dihapus dari profil Anda. Tindakan ini tidak dapat dibatalkan.', {
        title: 'Hapus kompetensi?', okLabel: 'Hapus', cancelLabel: 'Batal', danger: true
      });
      if (!ok) return;
      try {
        await persist({ competencies: member.competencies.filter(function (x) { return x.id !== id; }) });
        renderKompetensi();
        ui.toast('Kompetensi telah dihapus.', { type: 'success' });
        focusLater($('#panel-kompetensi [data-action="add-kompetensi"]'));
      } catch (err) {
        console.error(err);
        ui.toast(errMessage(err, 'Kompetensi gagal dihapus. Silakan coba lagi.'), { type: 'error' });
      }
    }

    /* ==================================================================
       5. SERTIFIKAT
       ================================================================== */
    function sortedSertifikat() {
      return member.certificates.slice().sort(function (a, b) {
        var da = a.expiresAt ? util.parseDate(a.expiresAt) : null;
        var db = b.expiresAt ? util.parseDate(b.expiresAt) : null;
        if (!da && !db) return String(a.title || '').localeCompare(String(b.title || ''), 'id');
        if (!da) return 1;
        if (!db) return -1;
        return da - db;
      });
    }
    function certLabel(s) {
      if (s.key === 'segera') return 'Segera kedaluwarsa (' + (s.days === 0 ? 'hari ini' : s.days + ' hari') + ')';
      return s.label;
    }
    function certSub(c, s) {
      if (s.key === 'tanpa-batas') return 'Tidak memiliki masa berlaku';
      if (s.key === 'kedaluwarsa') return 'Berakhir ' + util.relativeTime(c.expiresAt) + ' — perlu diperpanjang';
      if (s.key === 'segera') return 'Segera ajukan perpanjangan';
      return 'Berakhir ' + util.relativeTime(c.expiresAt);
    }
    function sertifikatRow(c) {
      var s = util.certStatus(c.expiresAt);
      var link = safeHttps(c.link);
      var title = c.title || 'Sertifikat';
      function dateCell(v) {
        return v ? '<time datetime="' + h(v) + '">' + h(util.formatDate(v, { short: true })) + '</time>' : '—';
      }
      return '<tr data-id="' + h(c.id) + '">' +
        '<td data-label="Sertifikat"><span class="agt-cert__title">' + h(title) + '</span><span class="table__muted">' + (c.number ? 'No. ' + h(c.number) : 'Nomor belum diisi') + '</span></td>' +
        '<td data-label="Penerbit">' + h(c.issuer || '—') + '</td>' +
        '<td data-label="Terbit">' + dateCell(c.issuedAt) + '</td>' +
        '<td data-label="Berlaku hingga">' + (c.expiresAt ? dateCell(c.expiresAt) : '<span class="muted">Tanpa batas</span>') + '</td>' +
        '<td data-label="Status"><span class="badge badge--' + s.tone + '">' + h(certLabel(s)) + '</span><span class="table__muted">' + h(certSub(c, s)) + '</span></td>' +
        '<td data-label="" class="agt-cert__actions"><div class="agt-cert__actions-in">' +
          (link
            ? '<a class="btn btn--link btn--sm agt-doclink" href="' + h(link) + '" target="_blank" rel="noopener noreferrer"><span>Lihat dokumen</span><span class="sr-only"> ' + h(title) + ' (tab baru)</span>' + icon('arrow-up-right', { size: 16, cls: 'btn__icon' }) + '</a>'
            : '<span class="agt-nolink">Tanpa dokumen</span>') +
          '<span class="agt-cert__btns">' +
            '<button type="button" class="icon-btn icon-btn--ghost" data-action="edit-sertifikat" data-id="' + h(c.id) + '" aria-label="Ubah sertifikat ' + h(title) + '">' + icon('edit', { size: 18 }) + '</button>' +
            '<button type="button" class="icon-btn icon-btn--ghost" data-action="delete-sertifikat" data-id="' + h(c.id) + '" aria-label="Hapus sertifikat ' + h(title) + '">' + icon('trash', { size: 18 }) + '</button>' +
          '</span>' +
        '</div></td>' +
      '</tr>';
    }
    function renderSertifikat() {
      var sumHost = $('#sertifikat-summary'), alertHost = $('#sertifikat-alert'), host = $('#sertifikat-list');
      if (!host) return;
      var list = sortedSertifikat();
      var n = { total: list.length, berlaku: 0, tanpa: 0, segera: 0, kedaluwarsa: 0 };
      list.forEach(function (c) {
        var k = util.certStatus(c.expiresAt).key;
        if (k === 'segera') n.segera++;
        else if (k === 'kedaluwarsa') n.kedaluwarsa++;
        else { n.berlaku++; if (k === 'tanpa-batas') n.tanpa++; }
      });
      if (sumHost) {
        sumHost.innerHTML = list.length ? '<div class="agt-sum" role="list" aria-label="Ringkasan sertifikat" data-reveal-stagger>' +
          [
            ['Total sertifikat', n.total, ''],
            ['Aktif', n.berlaku, 'ok', n.tanpa ? n.tanpa + ' tanpa batas' : ''],
            ['Segera kedaluwarsa', n.segera, 'warn'],
            ['Kedaluwarsa', n.kedaluwarsa, 'err']
          ].map(function (x) {
            return '<div class="agt-sum__cell" role="listitem"><span class="agt-sum__num" data-count="' + x[1] + '">' + x[1] + '</span>' +
              '<span class="agt-sum__label">' + (x[2] ? '<span class="agt-sum__dot agt-sum__dot--' + x[2] + '" aria-hidden="true"></span>' : '') + h(x[0]) + (x[3] ? '<span class="agt-sum__sub">· ' + h(x[3]) + '</span>' : '') + '</span></div>';
          }).join('') + '</div>' : '';
      }
      if (alertHost) {
        var parts = [];
        if (n.kedaluwarsa) parts.push(n.kedaluwarsa + ' sertifikat telah kedaluwarsa');
        if (n.segera) parts.push(n.segera + ' sertifikat akan berakhir dalam 90 hari');
        alertHost.innerHTML = parts.length
          ? '<div class="alert alert--warn" role="status">' + icon('alert-triangle') + '<div><p class="alert__title">Perhatikan masa berlaku</p>' +
            '<p>' + h(parts.join(' dan ')) + '. Ajukan perpanjangan kepada lembaga penerbit, lalu perbarui datanya di sini.</p></div></div>'
          : '';
      }
      host.innerHTML = list.length
        ? '<div class="table-wrap"><table class="table agt-cert-table">' +
            '<caption class="sr-only">Daftar sertifikat, diurutkan dari masa berlaku yang paling dekat</caption>' +
            '<thead><tr><th scope="col">Sertifikat</th><th scope="col">Penerbit</th><th scope="col">Terbit</th><th scope="col">Berlaku hingga</th><th scope="col">Status</th><th scope="col"><span class="sr-only">Tindakan</span></th></tr></thead>' +
            '<tbody>' + list.map(sertifikatRow).join('') + '</tbody></table></div>'
        : ui.emptyState({
            icon: 'certificate',
            title: 'Belum ada sertifikat tercatat',
            text: 'Catat sertifikat kompetensi atau lisensi K3 Anda agar masa berlakunya terpantau dan pengingat perpanjangan muncul tepat waktu.',
            actionHtml: '<button type="button" class="btn btn--primary btn--sm" data-action="add-sertifikat">' + icon('plus', { size: 16 }) + '<span>Tambah Sertifikat</span></button>'
          });
      if (sumHost) ui.reveal(sumHost);
      ui.reveal(host);
    }

    function openSertifikatModal(item) {
      var editing = !!item;
      var pen = (Array.isArray(komp.penerbit) && komp.penerbit.length ? komp.penerbit : ['BNSP / LSP', 'Kemnaker RI', 'LPJK / Kementerian PU', 'Lembaga Internasional (CISRS, dll.)']).slice();
      if (pen.indexOf('Lainnya') === -1) pen.push('Lainnya');
      var issuer = item ? (item.issuer || '') : '';
      var selIssuer = issuer ? (pen.indexOf(issuer) !== -1 ? issuer : 'Lainnya') : '';
      var otherIssuer = selIssuer === 'Lainnya' && issuer !== 'Lainnya' ? issuer : '';
      var noExp = item ? !item.expiresAt : false;
      var today = util.todayIso();
      var body =
        '<form class="form agt-mform" id="mc-form" novalidate>' +
          '<div class="field">' +
            '<label class="field__label" for="mc-title"><span>Judul sertifikat <span class="agt-req" aria-hidden="true">*</span></span></label>' +
            '<input class="field__control" id="mc-title" aria-required="true" type="text" maxlength="200" autocomplete="off" placeholder="Contoh: Pengawas Scaffolding" value="' + h(item ? item.title : '') + '">' +
          '</div>' +
          '<div class="form__row form__row--2">' +
            '<div class="field">' +
              '<label class="field__label" for="mc-number"><span>Nomor sertifikat <span class="agt-req" aria-hidden="true">*</span></span></label>' +
              '<input class="field__control" id="mc-number" aria-required="true" type="text" maxlength="100" autocomplete="off" value="' + h(item ? item.number : '') + '">' +
            '</div>' +
            '<div class="field">' +
              '<label class="field__label" for="mc-issuer"><span>Lembaga penerbit <span class="agt-req" aria-hidden="true">*</span></span></label>' +
              '<select class="field__control" id="mc-issuer" aria-required="true"><option value="">Pilih penerbit…</option>' +
                pen.map(function (p) { return '<option value="' + h(p) + '"' + (p === selIssuer ? ' selected' : '') + '>' + h(p) + '</option>'; }).join('') +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="field" id="mc-other-field"' + (selIssuer === 'Lainnya' ? '' : ' hidden') + '>' +
            '<label class="field__label" for="mc-other"><span>Nama lembaga penerbit <span class="agt-req" aria-hidden="true">*</span></span></label>' +
            '<input class="field__control" id="mc-other" aria-required="true" type="text" maxlength="150" autocomplete="off" value="' + h(otherIssuer) + '">' +
          '</div>' +
          '<div class="form__row form__row--2">' +
            '<div class="field">' +
              '<label class="field__label" for="mc-issued"><span>Tanggal terbit <span class="agt-req" aria-hidden="true">*</span></span></label>' +
              '<input class="field__control" id="mc-issued" aria-required="true" type="date" max="' + h(today) + '" value="' + h(item ? item.issuedAt : '') + '">' +
            '</div>' +
            '<div class="field">' +
              '<label class="field__label" for="mc-expires"><span>Berlaku hingga <span class="agt-req" aria-hidden="true">*</span></span></label>' +
              '<input class="field__control" id="mc-expires" aria-required="true" type="date" value="' + h(item ? item.expiresAt : '') + '"' + (noExp ? ' disabled' : '') + '>' +
            '</div>' +
          '</div>' +
          '<label class="check"><input type="checkbox" id="mc-noexp"' + (noExp ? ' checked' : '') + '><span class="check__box"></span><span class="check__label">Tidak ada masa berlaku</span></label>' +
          '<div class="field">' +
            '<label class="field__label" for="mc-link">Tautan dokumen <span class="opt">(opsional)</span></label>' +
            '<div class="input-icon">' + icon('link', { size: 18 }) + '<input class="field__control" id="mc-link" type="url" inputmode="url" maxlength="1000" placeholder="https://drive.google.com/…" autocomplete="off" aria-describedby="mc-link-hint" value="' + h(item ? item.link : '') + '"></div>' +
            '<p class="field__hint" id="mc-link-hint">Unggah dokumen ke Google Drive lalu tempel tautannya di sini. Pastikan akses tautan diatur agar dapat dibuka, dan gunakan alamat yang diawali https://.</p>' +
          '</div>' +
          '<button type="submit" hidden tabindex="-1" aria-hidden="true"></button>' +
        '</form>';

      var root = null;
      function q(id) { return root ? root.querySelector('#' + id) : null; }
      function syncIssuer() {
        var lain = q('mc-issuer').value === 'Lainnya';
        q('mc-other-field').hidden = !lain;
        setError(q('mc-issuer'), '');
      }
      function syncNoExp() {
        var on = q('mc-noexp').checked;
        q('mc-expires').disabled = on;
        if (on) setError(q('mc-expires'), '');
      }
      function submit() {
        var v = {
          title: q('mc-title').value.trim().replace(/\s+/g, ' '),
          number: q('mc-number').value.trim(),
          issuerSel: q('mc-issuer').value,
          other: q('mc-other').value.trim(),
          issued: q('mc-issued').value,
          expires: q('mc-expires').value,
          noExp: q('mc-noexp').checked,
          link: q('mc-link').value.trim()
        };
        var bad = [];
        function chk(el, msg) { setError(el, msg); if (msg) bad.push(el); }
        chk(q('mc-title'), v.title.length < 3 ? 'Judul sertifikat minimal 3 karakter.' : '');
        chk(q('mc-number'), !v.number ? 'Nomor sertifikat wajib diisi.' : '');
        chk(q('mc-issuer'), !v.issuerSel ? 'Pilih lembaga penerbit.' : '');
        if (v.issuerSel === 'Lainnya') chk(q('mc-other'), v.other.length < 2 ? 'Tuliskan nama lembaga penerbit.' : '');
        else setError(q('mc-other'), '');
        var issuedMsg = '';
        if (q('mc-issued').validity && q('mc-issued').validity.badInput) issuedMsg = 'Format tanggal tidak valid.';
        else if (!v.issued) issuedMsg = 'Tanggal terbit wajib diisi.';
        else if (!util.parseDate(v.issued)) issuedMsg = 'Format tanggal tidak valid.';
        else if (util.daysUntil(v.issued) > 0) issuedMsg = 'Tanggal terbit tidak boleh melewati hari ini.';
        chk(q('mc-issued'), issuedMsg);
        var expMsg = '';
        if (!v.noExp) {
          if (q('mc-expires').validity && q('mc-expires').validity.badInput) expMsg = 'Format tanggal tidak valid.';
          else if (!v.expires) expMsg = 'Isi tanggal berakhirnya sertifikat, atau centang "Tidak ada masa berlaku".';
          else if (!util.parseDate(v.expires)) expMsg = 'Format tanggal tidak valid.';
          else if (v.issued && util.parseDate(v.issued) && util.parseDate(v.expires) <= util.parseDate(v.issued)) expMsg = 'Tanggal kedaluwarsa harus setelah tanggal terbit.';
        }
        chk(q('mc-expires'), expMsg);
        chk(q('mc-link'), v.link && !isHttpsUrl(v.link) ? 'Gunakan tautan lengkap yang diawali https://, misalnya tautan Google Drive.' : '');
        if (bad.length) { bad[0].focus(); return false; }
        var rec = {
          id: item ? item.id : util.uid('c'),
          title: v.title,
          number: v.number,
          issuer: v.issuerSel === 'Lainnya' ? v.other : v.issuerSel,
          issuedAt: v.issued,
          expiresAt: v.noExp ? '' : v.expires,
          link: v.link ? new URL(v.link).href : ''
        };
        var next = item
          ? member.certificates.map(function (c) { return c.id === item.id ? rec : c; })
          : member.certificates.concat([rec]);
        return persist({ certificates: next }).then(function () {
          renderSertifikat();
          var s = util.certStatus(rec.expiresAt);
          var msg = editing ? 'Sertifikat berhasil diperbarui.' : 'Sertifikat berhasil ditambahkan.';
          if (s.key === 'segera') msg += ' Masa berlakunya berakhir dalam ' + s.days + ' hari.';
          else if (s.key === 'kedaluwarsa') msg += ' Catatan: sertifikat ini telah kedaluwarsa.';
          ui.toast(msg, { type: s.key === 'segera' || s.key === 'kedaluwarsa' ? 'warn' : 'success' });
          var btn = $('#sertifikat-list tr[data-id="' + rec.id.replace(/"/g, '') + '"] [data-action="edit-sertifikat"]');
          focusLater(btn || $('#panel-sertifikat [data-action="add-sertifikat"]'));
          return true;
        });
      }

      ui.modal({
        title: editing ? 'Ubah sertifikat' : 'Tambah sertifikat',
        eyebrow: 'Sertifikat profesi',
        size: 'md',
        cls: 'agt-modal',
        body: body,
        actions: [
          { label: 'Batal', variant: 'ghost' },
          { label: editing ? 'Simpan perubahan' : 'Tambahkan', variant: 'primary', onClick: function () { return submit(); } }
        ],
        onOpen: function (el) {
          root = el;
          q('mc-issuer').addEventListener('change', function () { syncIssuer(); if (q('mc-issuer').value === 'Lainnya') q('mc-other').focus(); });
          q('mc-noexp').addEventListener('change', syncNoExp);
          ['mc-title', 'mc-number', 'mc-other', 'mc-issued', 'mc-expires', 'mc-link'].forEach(function (id) {
            q(id).addEventListener('input', function () { setError(q(id), ''); });
          });
          q('mc-form').addEventListener('submit', function (e) {
            e.preventDefault();
            var btns = el.querySelectorAll('.modal__footer .btn');
            if (btns.length) btns[btns.length - 1].click();
          });
        }
      });
    }

    async function deleteSertifikat(id) {
      var c = member.certificates.filter(function (x) { return x.id === id; })[0];
      if (!c) return;
      var ok = await ui.confirm('Sertifikat “' + (c.title || 'tanpa judul') + '” akan dihapus dari profil Anda. Tindakan ini tidak dapat dibatalkan.', {
        title: 'Hapus sertifikat?', okLabel: 'Hapus', cancelLabel: 'Batal', danger: true
      });
      if (!ok) return;
      try {
        await persist({ certificates: member.certificates.filter(function (x) { return x.id !== id; }) });
        renderSertifikat();
        ui.toast('Sertifikat telah dihapus.', { type: 'success' });
        focusLater($('#panel-sertifikat [data-action="add-sertifikat"]'));
      } catch (err) {
        console.error(err);
        ui.toast(errMessage(err, 'Sertifikat gagal dihapus. Silakan coba lagi.'), { type: 'error' });
      }
    }

    /* ==================================================================
       6. KARTU ANGGOTA — KTA digital
       ================================================================== */
    var flipped = false;
    function linesSvg() {
      /* standards, ledgers, one braced bay and coupler nodes — viewBox matches the ID-1 ratio */
      var H = 63.08, xs = [13, 37, 61, 85], ys = [H * 0.36, H * 0.7], s = '';
      xs.forEach(function (x) { s += '<line x1="' + x + '" y1="0" x2="' + x + '" y2="' + H + '"/>'; });
      ys.forEach(function (y) { s += '<line x1="0" y1="' + y.toFixed(2) + '" x2="100" y2="' + y.toFixed(2) + '"/>'; });
      s += '<line x1="61" y1="0" x2="85" y2="' + ys[0].toFixed(2) + '"/>' +
           '<line x1="85" y1="' + ys[0].toFixed(2) + '" x2="61" y2="' + ys[1].toFixed(2) + '"/>' +
           '<line x1="61" y1="' + ys[1].toFixed(2) + '" x2="85" y2="' + H + '"/>';
      xs.forEach(function (x) { ys.forEach(function (y) { s += '<rect x="' + (x - 0.55) + '" y="' + (y - 0.55).toFixed(2) + '" width="1.1" height="1.1"/>'; }); });
      return '<svg class="agt-kta__lines" viewBox="0 0 100 ' + H + '" preserveAspectRatio="none" aria-hidden="true" focusable="false">' + s + '</svg>';
    }
    function secretariatLine() {
      var c = cfg.contact || {};
      var parts = [c.email, c.phone, c.city].filter(function (x) { return x && String(x).trim(); });
      return 'Sekretariat ' + (cfg.shortName || 'PPAPI') + (parts.length ? ' · ' + parts.join(' · ') : '');
    }
    function ktaLabel() {
      return 'Kartu Tanda Anggota digital, sisi ' + (flipped ? 'belakang' : 'depan') + ' ditampilkan. Tekan untuk membalik kartu.';
    }
    /* Admin PPAPI yang keanggotaan pribadinya belum Aktif: tidak ada kartu yang ditampilkan,
       karena KTA dan kode QR verifikasi hanya terbit bagi anggota berstatus Aktif. */
    function renderNoCard(area) {
      var st = effStatus();
      var canApply = store.canEditApplication ? store.canEditApplication(member) : true;
      var actions = (canApply || st === 'Menunggu Verifikasi'
          ? '<a class="btn btn--primary btn--sm" href="pendaftaran.html"><span>' + (st === 'Menunggu Verifikasi' ? 'Lihat Pengajuan' : 'Formulir Pendaftaran') + '</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a>'
          : '') +
        (sess().isAdmin ? '<a class="btn btn--ghost btn--sm" href="admin.html"><span>Konsol Admin</span></a>' : '');
      area.innerHTML = '<div class="agt-nocard">' + ui.locked({
        icon: 'id-card', eyebrow: 'Kartu Tanda Anggota',
        title: 'Kartu Tanda Anggota belum terbit',
        text: (sess().isAdmin ? 'Anda membuka halaman ini sebagai admin PPAPI. ' : '') +
          'Kartu Tanda Anggota beserta kode QR verifikasi hanya terbit bagi anggota berstatus Aktif. Status keanggotaan pribadi Anda saat ini: ' + st + '.',
        actionHtml: actions
      }) + '</div>';
      ui.reveal(area);
    }
    /* Pemberitahuan asal nama pada kartu: berbeda dengan profil (info), belum tercantum
       pada daftar verifikasi, atau daftar belum dapat dimuat (peringatan). */
    var CONTACT_LINK = '<a class="link" href="umpan-balik.html?kategori=Pertanyaan">Kontak</a>';
    function cardRecordNote(name) {
      if (cardRec.state === 'ok') {
        var profil = cleanText(displayName());
        if (!profil || profil === name) return '';
        return '<div class="alert alert--info agt-namenote">' + icon('info') + '<div>' +
          '<p class="alert__title">Nama pada kartu mengikuti data yang tercatat di sekretariat</p>' +
          '<p>Kartu dan halaman verifikasi menampilkan nama “' + h(name) + '” sesuai daftar anggota yang dikelola sekretariat. ' +
          'Nama pada profil Anda, “' + h(profil) + '”, berbeda dan tidak mengubah kartu. ' +
          'Untuk memperbarui nama pada kartu, silakan hubungi sekretariat melalui halaman ' + CONTACT_LINK + '.</p>' +
        '</div></div>';
      }
      if (cardRec.state === 'missing') {
        return '<div class="alert alert--warn agt-namenote" role="status">' + icon('alert-triangle') + '<div>' +
          '<p class="alert__title">Nomor KTA belum tercantum pada daftar verifikasi</p>' +
          '<p>Pemindaian kode QR belum dapat menampilkan data keanggotaan Anda. Untuk sementara, nama pada kartu diambil dari profil dan belum dicocokkan dengan data sekretariat. ' +
          'Silakan hubungi sekretariat melalui halaman ' + CONTACT_LINK + '.</p>' +
        '</div></div>';
      }
      return '<div class="alert alert--warn agt-namenote" role="status">' + icon('alert-triangle') + '<div>' +
        '<p class="alert__title">Daftar verifikasi belum dapat dimuat</p>' +
        '<p>Untuk sementara, nama pada kartu diambil dari profil dan belum dicocokkan dengan data sekretariat. Periksa koneksi internet Anda, lalu muat ulang data kartu.</p>' +
        '<p class="mt-2"><button type="button" class="btn btn--ghost btn--sm" data-action="reload-card">' + icon('refresh', { size: 16 }) + '<span>Muat ulang data kartu</span></button></p>' +
      '</div></div>';
    }
    async function reloadCardRecord(btn) {
      if (btn) ui.setLoading(btn, true, 'Memuat…');
      cardRec = { state: 'loading', nama: '' };
      await loadCardRecord();
      renderKartu();
      var target = $('#kartu-area [data-action="reload-card"]') || $('#kta');
      focusLater(target);
    }
    function renderKartu() {
      var area = $('#kartu-area');
      if (!area) return;
      if (!hasCard()) { renderNoCard(area); return; }
      /* tunggu entri daftar verifikasi: kerangka (skeleton) di HTML tetap tampil, tanpa kilasan nama profil */
      if (cardRec.state === 'loading') { area.setAttribute('aria-busy', 'true'); return; }
      area.removeAttribute('aria-busy');
      var name = cardName();
      var st = effStatus();
      var tone = util.statusTone(st);
      var until = validUntilIso();
      var days = until ? util.daysUntil(until) : null;
      var url = verifyUrl();
      var full = cfg.fullName || 'Perkumpulan Praktisi dan Ahli Perancah Indonesia';
      /* Sisi depan: "Berlaku hingga" hanya bila tanggalnya ditetapkan; selain itu "Anggota sejak" */
      var termFact = until
        ? '<div><dt>Berlaku hingga</dt><dd>' + h(util.formatDate(until, { short: true })) + '</dd></div>'
        : '<div><dt>Anggota sejak</dt><dd>' + h(member.joinedAt ? util.formatDate(member.joinedAt, { short: true }) : '—') + '</dd></div>';
      var statusNote = '';
      if (days !== null && days >= 0 && days <= (util.RENEWAL_DAYS || 60)) {
        statusNote = '<div class="alert alert--warn agt-renew" role="status">' + icon('clock') + '<div>' +
          '<p class="alert__title">' + (days === 0 ? 'Masa berlaku keanggotaan berakhir hari ini' : 'Masa berlaku keanggotaan berakhir dalam ' + h(String(days)) + ' hari') + '</p>' +
          '<p>Kartu ini berlaku hingga ' + h(util.formatDate(until)) + '. Ajukan perpanjangan melalui formulir pendaftaran. Selama pengajuan perpanjangan diverifikasi sekretariat, akses fitur anggota ditangguhkan sementara.</p>' +
          '<p class="mt-2"><a class="btn btn--primary btn--sm" href="pendaftaran.html#perpanjangan"><span>Ajukan Perpanjangan</span>' + icon('arrow-right', { size: 16, cls: 'btn__icon' }) + '</a></p>' +
        '</div></div>';
      }
      var recordNote = cardRecordNote(name);
      area.innerHTML =
        '<div class="agt-kta-stage">' +
          '<div data-scaffold data-cols="9" data-rows="3"></div>' +
          '<p class="print-only agt-kta-print-head">Kartu Tanda Anggota ' + h(cfg.shortName || 'PPAPI') + ' — ' + h(name) + ' · dicetak ' + h(util.formatDate(util.todayIso())) + '</p>' +
          '<div class="agt-kta theme-dark' + (flipped ? ' is-flipped' : '') + '" id="kta" role="button" tabindex="0" aria-describedby="kta-hint" aria-label="' + h(ktaLabel()) + '">' +
            '<div class="agt-kta__inner">' +
              '<div class="agt-kta__face agt-kta__face--front"><div class="agt-kta__surface">' + linesSvg() +
                '<div class="agt-kta__top">' +
                  '<img class="agt-kta__logo" src="assets/img/logo-light.png" alt="" width="1200" height="418" decoding="async">' +
                  '<p class="agt-kta__heading"><b>Kartu Tanda Anggota</b><span>' + h(full) + '</span></p>' +
                '</div>' +
                '<div class="agt-kta__id">' +
                  '<p class="agt-kta__name' + (name.length > 38 ? ' is-xlong' : name.length > 28 ? ' is-long' : '') + '">' + h(name) + '</p>' +
                  '<p class="agt-kta__no">' + h(member.kta || '—') + '</p>' +
                '</div>' +
                '<dl class="agt-kta__facts">' +
                  '<div><dt>Kategori</dt><dd>' + h(member.memberType || 'Praktisi') + '</dd></div>' +
                  termFact +
                  '<div><dt>Status</dt><dd><span class="agt-kta__status agt-kta__status--' + tone + '">' + h(st) + '</span></dd></div>' +
                '</dl>' +
              '</div></div>' +
              '<div class="agt-kta__face agt-kta__face--back"><div class="agt-kta__surface">' + linesSvg() +
                '<div class="agt-kta__back">' +
                  qrBox(url) +
                  '<div class="agt-kta__verify">' +
                    '<p class="agt-kta__label">Verifikasi keanggotaan</p>' +
                    '<p class="agt-kta__text">Pindai kode QR untuk memeriksa keabsahan kartu ini melalui halaman verifikasi ' + h(cfg.shortName || 'PPAPI') + '.</p>' +
                    '<p class="agt-kta__url">' + h(prettyUrl(url)) + '</p>' +
                  '</div>' +
                '</div>' +
                '<div class="agt-kta__terms">' +
                  '<p>Kartu ini merupakan tanda keanggotaan ' + h(cfg.shortName || 'PPAPI') + ', berlaku atas nama pemegang, dan tidak dapat dipindahtangankan. Apabila menemukan kartu ini, mohon serahkan kepada pemegang atau sekretariat.</p>' +
                  '<p class="agt-kta__sec"><span>' + h(secretariatLine()) + '</span><span>' + h(member.kta || '') + '</span></p>' +
                '</div>' +
              '</div></div>' +
            '</div>' +
          '</div>' +
          '<p class="agt-kta-hint" id="kta-hint">' + icon('refresh', { size: 14 }) + '<span class="agt-kta-hint__fine">Klik kartu atau tekan Enter untuk membalik</span><span class="agt-kta-hint__touch">Ketuk kartu untuk membalik</span></p>' +
          '<div class="agt-kta-controls">' +
            '<button type="button" class="btn btn--ghost btn--sm" id="kta-flip" aria-controls="kta">' + icon('refresh', { size: 16 }) + '<span>' + (flipped ? 'Lihat sisi depan' : 'Lihat sisi belakang') + '</span></button>' +
            '<button type="button" class="btn btn--primary btn--sm" id="kta-print">' + icon('printer', { size: 16 }) + '<span>Cetak Kartu</span></button>' +
          '</div>' +
        '</div>' +
        '<div class="agt-kta-info">' +
          statusNote + recordNote +
          '<dl class="kv">' +
            '<div class="kv__row"><dt>Nama pemegang</dt><dd>' + h(name) + '</dd></div>' +
            '<div class="kv__row"><dt>Nomor KTA</dt><dd>' + h(member.kta || '—') + '</dd></div>' +
            '<div class="kv__row"><dt>Kategori</dt><dd>' + h(member.memberType || 'Praktisi') + '</dd></div>' +
            '<div class="kv__row"><dt>Status</dt><dd>' + util.statusBadge(st) + '</dd></div>' +
            '<div class="kv__row"><dt>Anggota sejak</dt><dd>' + h(member.joinedAt ? util.formatDate(member.joinedAt) : '—') + '</dd></div>' +
            '<div class="kv__row"><dt>Berlaku hingga</dt><dd>' + (until ? h(util.formatDate(until)) : '<span class="muted">' + h(validUntilPending()) + '</span>') + '</dd></div>' +
          '</dl>' +
          '<div class="agt-verify">' +
            '<p class="agt-verify__label">' + icon('qr-code', { size: 16 }) + '<span>Tautan verifikasi</span></p>' +
            '<a class="agt-verify__url link" href="' + h(url) + '" target="_blank" rel="noopener">' + h(prettyUrl(url)) + '<span class="sr-only"> (tab baru)</span></a>' +
            '<p class="agt-verify__text">Kode QR pada sisi belakang kartu membuka tautan ini. Halaman verifikasi menampilkan data keanggotaan secara terbatas dari daftar anggota yang dikelola sekretariat PPAPI.</p>' +
            '<div class="agt-verify__actions"><button type="button" class="btn btn--ghost btn--sm" data-copy="' + h(url) + '" data-copy-message="Tautan verifikasi berhasil disalin.">' + icon('copy', { size: 16 }) + '<span>Salin Tautan Verifikasi</span></button></div>' +
          '</div>' +
        '</div>';

      var card = $('#kta', area);
      card.addEventListener('click', function () { setFlip(!flipped); });
      card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); setFlip(!flipped); }
      });
      $('#kta-flip', area).addEventListener('click', function () { setFlip(!flipped); });
      $('#kta-print', area).addEventListener('click', printKartu);
      ui.reveal(area);
    }
    function setFlip(on) {
      flipped = !!on;
      var card = $('#kta');
      if (!card) return;
      card.classList.toggle('is-flipped', flipped);
      card.setAttribute('aria-label', ktaLabel());
      var lbl = $('#kta-flip span:last-child');
      if (lbl) lbl.textContent = flipped ? 'Lihat sisi depan' : 'Lihat sisi belakang';
    }

    /* ---------- QR (dibuat lokal oleh qrCode di atas, tanpa permintaan jaringan) ---------- */
    function qrBox(url) {
      var inner, state = 'ready';
      try { inner = qrCode.svg(url); }
      catch (err) {
        console.warn('[anggota] QR:', err && err.message);
        state = 'fallback';
        inner = '<p class="agt-kta__qr-fallback">Kode QR belum dapat ditampilkan. Gunakan tautan verifikasi di bawah.</p>';
      }
      return '<div class="agt-kta__qr" id="kta-qr" data-url="' + h(url) + '" data-state="' + state + '">' + inner + '</div>';
    }
    function printKartu() { w.print(); }

    /* ==================================================================
       7. APLIKASI
       ================================================================== */
    /* Aplikasi anggota adalah aset internal situs (aplikasi/…, dijaga aplikasi/gate.js):
       dibuka di tab yang sama; bilah portal pada aplikasi menautkan kembali ke situs. */
    function appHref(url) {
      var s = String(url || '').trim();
      if (/^https:\/\//i.test(s)) return safeHttps(s);
      return /^[a-z0-9][\w\-./]*\.html(?:[?#][\w\-=&.%#]*)?$/i.test(s) && s.indexOf('..') === -1 ? s : '';
    }
    function renderAplikasi() {
      var host = $('#aplikasi-area');
      if (!host) return;
      var apps = Array.isArray(cfg.apps) ? cfg.apps.slice() : [];
      var IMG = { perencanaan: 'assets/img/stair-tower.webp', simulator: 'assets/img/ringlock-pattern.webp' };
      var EYEBROW = { perencanaan: 'PPAPI Scaffold', simulator: 'Simulator 3D pelatihan K3' };
      var valid = apps.filter(function (a) { return appHref(a.url); });
      var cards = valid.map(function (a, i) {
        var url = appHref(a.url);
        /* 'Merek — Nama' → merek sebagai eyebrow, nama sebagai judul */
        var parts = String(a.title || 'Aplikasi').split(/\s+—\s+/);
        var eyebrow = parts.length > 1 ? parts[0] : (EYEBROW[a.key] || 'Aplikasi anggota');
        var words = String(parts.length > 1 ? parts.slice(1).join(' — ') : parts[0]).trim().split(/\s+/);
        var last = words.pop();
        var titleHtml = (words.length ? h(words.join(' ')) + ' ' : '') + '<em>' + h(last) + '</em>';
        var fitur = Array.isArray(a.fitur) ? a.fitur : [];
        var img = IMG[a.key] || (i % 2 ? IMG.simulator : IMG.perencanaan);
        var external = /^https:/i.test(url);
        return '<article class="agt-app theme-dark">' +
          '<div class="agt-app__media">' + util.img(img, { alt: '', cls: 'img-mono', sizes: '(min-width: 900px) 620px, 100vw' }) +
            '</div>' +
          '<div class="agt-app__body">' +
            '<div class="agt-app__head"><p class="eyebrow">' + h(eyebrow) + '</p><span class="index-num agt-app__index">' + util.pad(i + 1) + ' <span>/ ' + util.pad(valid.length) + '</span></span></div>' +
            '<h3 class="agt-app__title">' + titleHtml + '</h3>' +
            (a.desc ? '<p class="agt-app__desc">' + h(a.desc) + '</p>' : '') +
            (fitur.length ? '<ul class="agt-app__features" role="list">' + fitur.map(function (f) { return '<li>' + icon('check', { size: 16 }) + '<span>' + h(f) + '</span></li>'; }).join('') + '</ul>' : '') +
            '<div class="agt-app__foot">' +
              (external
                ? '<a class="btn btn--primary" href="' + h(url) + '" target="_blank" rel="noopener"><span>Buka Aplikasi</span><span class="sr-only"> ' + h(a.title || '') + ' (tab baru)</span>' + icon('arrow-up-right', { size: 18, cls: 'btn__icon' }) + '</a>'
                : '<a class="btn btn--primary" href="' + h(url) + '"><span>Buka Aplikasi</span><span class="sr-only"> ' + h(a.title || '') + '</span>' + icon('arrow-right', { size: 18, cls: 'btn__icon' }) + '</a>') +
              '<span class="agt-app__note">' + icon('lock', { size: 14 }) + 'Khusus anggota Aktif</span>' +
            '</div>' +
          '</div>' +
        '</article>';
      }).join('');
      host.innerHTML = (cards ? '<div class="agt-apps" data-reveal-stagger>' + cards + '</div>' : ui.emptyState({ icon: 'compass', title: 'Aplikasi belum tersedia', text: 'Aplikasi anggota akan ditambahkan oleh pengelola situs.' })) +
        '<div class="alert alert--info agt-apps-note">' + icon('info') + '<div><p class="alert__title">Aplikasi terbuka di situs ini.</p>' +
          '<p>Bilah portal di bagian atas aplikasi membawa Anda kembali ke situs PPAPI. Data perhitungan dan kemajuan latihan tersimpan di peramban perangkat yang Anda gunakan.</p>' +
          (cfg.appNote ? '<p>' + h(cfg.appNote) + '</p>' : '') + '</div></div>';
      ui.reveal(host);
    }

    /* ==================================================================
       Delegated actions
       ================================================================== */
    if (main) {
      main.addEventListener('click', function (e) {
        var t = e.target.closest('[data-action]');
        if (!t || !main.contains(t)) return;
        var act = t.getAttribute('data-action'), id = t.getAttribute('data-id');
        if (act === 'add-kompetensi') openKompetensiModal(null);
        else if (act === 'edit-kompetensi') openKompetensiModal(member.competencies.filter(function (c) { return c.id === id; })[0] || null);
        else if (act === 'delete-kompetensi') deleteKompetensi(id);
        else if (act === 'add-sertifikat') openSertifikatModal(null);
        else if (act === 'edit-sertifikat') openSertifikatModal(member.certificates.filter(function (c) { return c.id === id; })[0] || null);
        else if (act === 'delete-sertifikat') deleteSertifikat(id);
        else if (act === 'reload-card') reloadCardRecord(t);
      });
    }

    /* ==================================================================
       Render
       ================================================================== */
    renderHero();
    updateCounts();
    initProfil();
    renderCompleteness();
    renderKompetensi();
    renderSertifikat();
    renderKartu();
    loadCardRecord().then(renderKartu);
    renderAplikasi();
    updateTabFades();

    /* Tautan "isian yang belum lengkap" dari dasbor: anggota.html?isi=<kunci>#profil
       membuka tab Profil dan langsung memfokuskan isian tersebut. */
    (function focusFromQuery() {
      var key = util.qs('isi');
      if (!key) return;
      var fld = (util.PROFILE_FIELDS || []).filter(function (x) { return x.key === key; })[0];
      var el = fld ? F(fld.focus || fld.key) : null;
      if (!el) return;
      if (tabs) tabs.select('profil');
      w.setTimeout(function () {
        el.scrollIntoView({ behavior: 'auto', block: 'center' });
        try { el.focus({ preventScroll: true }); } catch (er) { el.focus(); }
      }, 60);
      try { w.history.replaceState(w.history.state, '', w.location.pathname + w.location.hash); } catch (er) { /* abaikan */ }
    })();
  });
})(window, document);
