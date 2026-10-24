/* ==========================================================================
   PPAPI — Anggaran Dasar (anggaran-dasar.html)
   Naskah dirender dari PPAPI.data.anggaranDasar (assets/data/anggaran-dasar.js).
   • Setiap bab menjadi satu bagian bernomor dengan jangkar #bab-NN; setiap pasal
     memiliki jangkar #pasal-N sehingga dapat dirujuk langsung (mis. dari Profil).
   • Ayat bernomor 1, 2, …; rincian ayat berhuruf a, b, … (atau huruf pada data).
   • Daftar isi menandai bab yang sedang dibaca (sama dengan Kebijakan Privasi).
   ========================================================================== */
(function () {
  'use strict';

  PPAPI.onReady(function () {
    var util = PPAPI.util, ui = PPAPI.ui, h = util.h, $ = util.$, $$ = util.$$;
    var ad = (PPAPI.data && PPAPI.data.anggaranDasar) || {};
    var bab = Array.isArray(ad.bab) ? ad.bab : [];
    var ROMAWI = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    var HURUF = 'abcdefghijklmnopqrstuvwxyz';

    function pad(n) { return util.pad(n, 2); }
    function text(s) { return h(String(s || '')).replace(/\bstakeholder\b/g, '<em>stakeholder</em>'); }

    /* rincian (butir) — huruf dari data bila ada, selain itu a, b, c …; butir dapat bertingkat */
    function butirList(list, depth) {
      return '<ol class="ad-butir' + (depth ? ' ad-butir--sub' : '') + '" role="list">' + list.map(function (b, i) {
        var o = typeof b === 'string' ? { teks: b } : (b || {});
        var mark = o.huruf || (depth ? String(i + 1) + ')' : HURUF.charAt(i) + '.');
        if (o.huruf) mark += '.';
        return '<li><span class="ad-mark">' + h(mark) + '</span><div>' + text(o.teks) +
          (Array.isArray(o.butir) ? butirList(o.butir, depth + 1) : '') + '</div></li>';
      }).join('') + '</ol>';
    }

    function susunan(list) {
      return list.map(function (g) {
        return '<div class="ad-susunan"><p class="ad-susunan__title">' + h(g.kelompok) + '</p><dl class="kv">' +
          (g.anggota || []).map(function (a) {
            return '<div class="kv__row"><dt>' + h(a.jabatan) + '</dt><dd>' + h(a.nama) + '</dd></div>';
          }).join('') + '</dl></div>';
      }).join('');
    }

    function ayatBody(a) {
      var o = typeof a === 'string' ? { teks: a } : (a || {});
      return (o.teks ? '<p>' + text(o.teks) + '</p>' : '') +
        (Array.isArray(o.butir) ? butirList(o.butir, 0) : '') +
        (o.penutup ? '<p>' + text(o.penutup) + '</p>' : '') +
        (Array.isArray(o.paragraf) ? o.paragraf.map(function (p) { return '<p>' + text(p) + '</p>'; }).join('') : '') +
        (Array.isArray(o.susunan) ? susunan(o.susunan) : '');
    }

    function pasalHtml(p) {
      var ayat = Array.isArray(p.ayat) ? p.ayat : [];
      var body;
      if (p.tanpaNomor && ayat.length === 1) {
        body = '<div class="ad-ayat ad-ayat--single">' + ayatBody(ayat[0]) + '</div>';
      } else {
        body = (p.pembuka ? '<p>' + text(p.pembuka) + '</p>' : '') +
          '<ol class="ad-ayat-list" role="list">' + ayat.map(function (a, i) {
            var mark = p.romawi ? ROMAWI[i] + '.' : (i + 1) + '.';
            return '<li class="ad-ayat"><span class="ad-mark">' + mark + '</span><div>' + ayatBody(a) + '</div></li>';
          }).join('') + '</ol>';
      }
      return '<div class="ad-pasal" id="pasal-' + h(p.no) + '"><h3 class="ad-pasal__title">Pasal ' + h(p.no) + '</h3>' + body + '</div>';
    }

    /* ---------- Meta hero & sumber ---------- */
    var total = bab.reduce(function (n, b) { return n + (b.pasal || []).length; }, 0);
    var meta = $('[data-ad-meta]');
    if (meta) {
      var tgl = ad.diperbarui ? util.formatDate(ad.diperbarui) : '';
      meta.innerHTML =
        (tgl ? '<span>' + PPAPI.icon('calendar', { size: 16 }) + 'Dimuat: <time datetime="' + h(ad.diperbarui) + '">' + h(tgl) + '</time></span>' : '') +
        '<span>' + PPAPI.icon('scale', { size: 16 }) + 'Akta Nomor 01 Tahun 2022</span>' +
        '<span>' + PPAPI.icon('file-text', { size: 16 }) + total + ' pasal</span>';
    }
    var src = $('[data-ad-sumber]');
    if (src) src.textContent = [ad.akta, ad.pengesahan].filter(Boolean).join('; disahkan dengan ') + '.';

    /* ---------- Daftar isi & naskah ---------- */
    var toc = bab.map(function (b, i) {
      var ps = b.pasal || [];
      var range = ps.length > 1 ? 'Pasal ' + ps[0].no + '–' + ps[ps.length - 1].no : 'Pasal ' + (ps[0] ? ps[0].no : '');
      return '<li><a href="#bab-' + pad(i + 1) + '"><span class="ad-toc__num">' + pad(i + 1) + '</span><span>' + h(b.judul) +
        '<span class="ad-toc__range">' + h(range) + '</span></span></a></li>';
    }).join('');
    $$('[data-ad-toc-list]').forEach(function (ol) { ol.innerHTML = toc; });

    var isi = $('[data-ad-isi]');
    if (isi) {
      isi.innerHTML = bab.map(function (b, i) {
        return '<section class="ad-section" id="bab-' + pad(i + 1) + '" aria-labelledby="bab-' + pad(i + 1) + '-t">' +
          '<span class="ad-num">' + pad(i + 1) + '</span>' +
          '<h2 class="h3" id="bab-' + pad(i + 1) + '-t">' + h(b.judul) + '</h2>' +
          (b.pasal || []).map(pasalHtml).join('') +
        '</section>';
      }).join('');
      ui.reveal(isi);
    }

    /* jangkar yang dibuka langsung (#pasal-10) baru ada setelah render */
    if (location.hash) {
      var target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (target) setTimeout(function () { target.scrollIntoView(); }, 0);
    }

    /* ---------- Daftar isi aktif & tutup daftar isi ponsel setelah memilih ---------- */
    var details = $('.ad-toc-mobile');
    if (details) details.addEventListener('click', function (e) { if (e.target.closest('a[href^="#"]')) details.open = false; });
    var sections = $$('.ad-section[id]');
    var tocNav = $('[data-ad-toc]');
    if (!tocNav || !sections.length) return;
    var links = $$('a[href^="#"]', tocNav);
    var current = null, ticking = false;
    function update() {
      ticking = false;
      var line = window.innerHeight * 0.32, active = sections[0];
      for (var i = 0; i < sections.length; i++) { if (sections[i].getBoundingClientRect().top - line <= 0) active = sections[i]; }
      if ((window.innerHeight + window.pageYOffset) >= document.documentElement.scrollHeight - 4) {
        var last = sections[sections.length - 1];
        if (last.getBoundingClientRect().top < window.innerHeight) active = last;
      }
      if (active === current) return;
      current = active;
      links.forEach(function (a) {
        var on = a.getAttribute('href') === '#' + active.id;
        a.classList.toggle('is-active', on);
        if (on) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  });
})();
