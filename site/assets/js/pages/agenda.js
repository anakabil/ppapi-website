/* ==========================================================================
   PPAPI — agenda.js  (halaman Agenda Kegiatan)
   • Agenda terdekat disorot dengan hitung mundur (diperbarui tiap menit).
   • Penyaring: Akan Datang | Telah Berlangsung, jenis kegiatan, mode
     pelaksanaan — tersinkron ke ?tab=&jenis=&mode= (history.replaceState).
   • Daftar dikelompokkan per bulan; detail lewat PPAPI.ui.modal
     (tautan langsung: agenda.html?id=<id> — detail dibuka tanpa menggulir
     halaman; baris agenda dituju setelah detail ditutup).
   • Sebelum data dimuat, kerangka jadwal (bentuk dari data bawaan) memesan
     ruang daftar agar bagian di bawahnya tidak terdorong (CLS).
   • "Tambahkan ke Kalender": berkas .ics (RFC 5545) dibuat di peramban,
     waktu dalam zona Asia/Jakarta (WIB; WITA/WIT dikenali bila tertulis).
   • Agenda dibaca melalui PPAPI.store.content.list('agenda'): data bawaan
     + agenda kelolaan admin; agenda yang disembunyikan admin tidak tampil.
   Seluruh teks data di-escape dengan PPAPI.util.h().
   ========================================================================== */
(function () {
  'use strict';

  var TAB_UP = 'akan-datang', TAB_PAST = 'telah-berlangsung';
  var JENIS_ORDER = ['Pelatihan', 'Sertifikasi', 'Seminar', 'Webinar', 'Rapat', 'Kunjungan Teknis'];
  var MODES = ['Luring', 'Daring', 'Hybrid'];
  var MODE_DESC = { Luring: 'Luring (tatap muka)', Daring: 'Daring (dalam jaringan)', Hybrid: 'Hybrid (luring dan daring)' };
  var ZONES = {
    WIB: { id: 'Asia/Jakarta', off: 7 },
    WITA: { id: 'Asia/Makassar', off: 8 },
    WIT: { id: 'Asia/Jayapura', off: 9 }
  };

  var U = PPAPI.util, h = U.h, icon = PPAPI.icon;

  /* ==========================================================================
     PEMBANTU BERSAMA — dipakai kerangka jadwal (sebelum data dimuat) dan
     halaman (setelah PPAPI.onReady), sehingga markah keduanya identik.
     ========================================================================== */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function today() { return U.parseDate(U.todayIso()); }

  /* ---------- normalisasi data ---------- */
  function toEvents(list) {
    return (Array.isArray(list) ? list : []).filter(function (a) {
      return a && a.id && a.judul && U.parseDate(a.mulai);
    }).map(function (a) {
      var s = U.parseDate(a.mulai), e = U.parseDate(a.selesai) || s;
      if (e < s) e = s;
      return { raw: a, id: String(a.id), start: s, end: e };
    });
  }
  function isPast(ev) { return ev.end < today(); }
  function isOngoing(ev) { var t = today(); return ev.start <= t && ev.end >= t; }
  function byStartAsc(x, y) { return x.start - y.start || String(x.raw.judul).localeCompare(String(y.raw.judul)); }
  function splitEvents(events) {
    var up = events.filter(function (ev) { return !isPast(ev); }).sort(byStartAsc);
    return { upcoming: up, past: events.filter(isPast).sort(function (x, y) { return y.start - x.start; }), next: up[0] || null };
  }
  function jenisOf(events) {
    var present = {};
    events.forEach(function (ev) { if (ev.raw.jenis) present[ev.raw.jenis] = 1; });
    var list = JENIS_ORDER.filter(function (j) { return present[j]; });
    Object.keys(present).sort().forEach(function (j) { if (list.indexOf(j) === -1) list.push(j); });
    return list;
  }
  /* tab & penyaring dari alamat: ?tab=&jenis=&mode=; ?id= tanpa ?tab= memilih tab agenda itu */
  function stateFromUrl(events, allJenis) {
    var st = { tab: TAB_UP, jenis: '', mode: '' };
    var tab = (U.qs('tab') || '').toLowerCase();
    if (tab === TAB_PAST || tab === 'lalu' || tab === 'past') st.tab = TAB_PAST;
    var j = (U.qs('jenis') || '').trim().toLowerCase();
    allJenis.forEach(function (x) { if (x.toLowerCase() === j) st.jenis = x; });
    var m = (U.qs('mode') || '').trim().toLowerCase();
    MODES.forEach(function (x) { if (x.toLowerCase() === m) st.mode = x; });
    var id = (U.qs('id') || '').trim(), ev = null;
    for (var i = 0; id && i < events.length; i++) if (events[i].id === id) { ev = events[i]; break; }
    if (ev && !U.qs('tab')) st.tab = isPast(ev) ? TAB_PAST : TAB_UP;
    return st;
  }
  function matchesState(ev, st, ignoreJenis) {
    if (st.mode && ev.raw.mode !== st.mode) return false;
    if (!ignoreJenis && st.jenis && ev.raw.jenis !== st.jenis) return false;
    return true;
  }

  /* ---------- waktu & zona ---------- */
  function parseWaktu(w) {
    var s = String(w || ''), re = /(\d{1,2})[.:](\d{2})/g, m, out = [];
    while ((m = re.exec(s)) && out.length < 2) {
      var hh = +m[1], mm = +m[2];
      if (hh <= 23 && mm <= 59) out.push([hh, mm]);
    }
    var zone = /\bWITA\b/i.test(s) ? 'WITA' : (/\bWIT\b/i.test(s) ? 'WIT' : 'WIB');
    var start = out[0] || null, end = out[1] || null;
    if (start && end && (end[0] * 60 + end[1]) <= (start[0] * 60 + start[1])) end = null;
    return { start: start, end: end, zone: zone, tz: ZONES[zone] };
  }

  /* ---------- format ---------- */
  function weekday(d) { return (U.formatDate(d, { weekday: true }) || '').split(',')[0]; }
  function dayCount(ev) { return Math.round((ev.end - ev.start) / 86400000) + 1; }
  function dateLong(ev) {
    var multi = ev.end > ev.start;
    return multi
      ? weekday(ev.start) + ' – ' + weekday(ev.end) + ', ' + U.formatDateRange(ev.raw.mulai, ev.raw.selesai)
      : U.formatDate(ev.start, { weekday: true });
  }
  function daysLabel(ev) { var n = dayCount(ev); return n > 1 ? n + ' hari' : 'Satu hari'; }
  function kuotaText(k) {
    var n = Number(k);
    return (k === null || k === undefined || k === '' || !isFinite(n) || n <= 0) ? 'Tidak dibatasi' : U.formatNumber(n) + ' peserta';
  }
  function statusInfo(ev) {
    if (isOngoing(ev)) return { key: 'ongoing', label: 'Sedang berlangsung', rel: 'Sedang berlangsung hingga ' + U.formatDate(ev.end) };
    if (isPast(ev)) return { key: 'past', label: 'Telah berlangsung', rel: 'Telah berlangsung ' + U.relativeTime(ev.raw.selesai || ev.raw.mulai) };
    var d = U.daysUntil(ev.raw.mulai);
    return { key: 'up', label: 'Akan datang', rel: d === 0 ? 'Dimulai hari ini' : 'Dimulai ' + U.relativeTime(ev.raw.mulai) };
  }
  function dateBlock(ev, extra) {
    var multi = ev.end > ev.start, s = ev.start, e = ev.end;
    var day = multi ? s.getDate() + '–' + e.getDate() : String(s.getDate());
    var mon = U.MONTHS_SHORT[s.getMonth()] + (multi && e.getMonth() !== s.getMonth() ? '–' + U.MONTHS_SHORT[e.getMonth()] : '');
    var yr = s.getFullYear() + (multi && e.getFullYear() !== s.getFullYear() ? '–' + e.getFullYear() : '');
    return '<div class="date-block' + (multi ? ' date-block--range' : '') + (extra ? ' ' + extra : '') + '" aria-hidden="true">' +
      '<span class="date-block__day">' + h(day) + '</span><span class="date-block__month">' + h(mon) + '</span><span class="date-block__year">' + h(yr) + '</span></div>';
  }
  function modeBadge(a) { return a.mode ? '<span class="badge badge--outline">' + h(a.mode) + '</span>' : ''; }

  /* ---------- baris & kelompok bulan ----------
     ph = true: salinan untuk kerangka — tanpa atribut id agar tidak bentrok
     dengan daftar sebenarnya; pembungkusnya aria-hidden + inert. */
  function rowHtml(ev, nextEv, ph) {
    var a = ev.raw, past = isPast(ev), st = statusInfo(ev), isNext = nextEv && ev === nextEv;
    var badge = st.key === 'ongoing' ? '<span class="badge badge--ok">Sedang berlangsung</span>'
      : (isNext ? '<span class="badge badge--solid">Terdekat</span>' : '');
    var multi = ev.end > ev.start;
    var when = multi ? weekday(ev.start) + ' – ' + weekday(ev.end) + ' · ' + daysLabel(ev) : weekday(ev.start);
    return '<article class="event-row agenda-row' + (past ? ' is-past' : '') + (isNext ? ' is-next' : '') + '"' + (ph ? '' : ' id="agenda-' + h(ev.id) + '"') + '>' +
      dateBlock(ev, isNext ? 'date-block--dark' : '') +
      '<div class="event-row__body">' +
        '<div class="event-row__meta"><span class="tag">' + h(a.jenis || 'Kegiatan') + '</span>' + modeBadge(a) + badge + U.contohBadge(a) + '</div>' +
        '<h4 class="event-row__title"><a href="agenda.html?id=' + encodeURIComponent(ev.id) + '" data-agenda-open="' + h(ev.id) + '">' + h(a.judul) + '</a></h4>' +
        '<p class="event-row__info">' +
          '<span class="sr-only">' + h(dateLong(ev)) + '. </span>' +
          '<span aria-hidden="true">' + icon('calendar', { size: 16 }) + h(when) + '</span>' +
          (a.waktu ? '<span>' + icon('clock', { size: 16 }) + h(a.waktu) + '</span>' : '') +
          (a.lokasi ? '<span>' + icon('map-pin', { size: 16 }) + h(a.lokasi) + '</span>' : '') +
          '<span>' + icon('users', { size: 16 }) + 'Kuota ' + h(kuotaText(a.kuota).toLowerCase()) + '</span>' +
        '</p>' +
      '</div>' +
      '<div class="event-row__aside">' +
        '<button type="button" class="btn btn--ghost btn--sm" data-agenda-open="' + h(ev.id) + '" aria-haspopup="dialog"><span>Detail</span><span class="sr-only"> ' + h(a.judul) + '</span>' + icon('arrow-right', { cls: 'btn__icon', size: 16 }) + '</button>' +
        (past ? '' : '<button type="button" class="btn btn--link btn--sm agenda-row__ics" data-agenda-ics="' + h(ev.id) + '">' + icon('calendar', { size: 16 }) + '<span>Tambahkan ke Kalender</span><span class="sr-only"> — ' + h(a.judul) + '</span></button>') +
      '</div>' +
    '</article>';
  }
  function monthsHtml(list, nextEv, ph) {
    var groups = [], map = {};
    list.forEach(function (ev) {
      var key = ev.start.getFullYear() + '-' + pad2(ev.start.getMonth() + 1);
      if (!map[key]) { map[key] = { key: key, month: U.MONTHS[ev.start.getMonth()], year: ev.start.getFullYear(), items: [] }; groups.push(map[key]); }
      map[key].items.push(ev);
    });
    return groups.map(function (g) {
      var hid = ph ? '' : 'agenda-m-' + g.key;
      return '<section class="agenda-month"' + (ph ? '' : ' aria-labelledby="' + hid + '"') + '>' +
        '<header class="agenda-month__head">' +
          '<h3 class="agenda-month__title"' + (ph ? '' : ' id="' + hid + '"') + '><span class="agenda-month__name">' + h(g.month) + '</span> <span class="agenda-month__year">' + g.year + '</span></h3>' +
          '<p class="agenda-month__count">' + pad2(g.items.length) + ' agenda</p>' +
        '</header>' +
        '<div class="agenda-month__list">' + g.items.map(function (ev) { return rowHtml(ev, nextEv, ph); }).join('') + '</div>' +
      '</section>';
    }).join('');
  }
  /* counts (kerangka saja): jumlah per jenis agar lebar chip kerangka sama dengan chip jadi */
  function chipsHtml(allJenis, ph, counts) {
    return [''].concat(allJenis).map(function (j) {
      var label = h(j || 'Semua');
      var count = '<span class="chip__count"><span class="sr-only">(</span><span data-chip-n>' + ((counts && counts[j]) || 0) + '</span><span class="sr-only"> agenda)</span></span>';
      return ph
        ? '<span class="chip agenda-chip-ph"><span>' + label + '</span> ' + count + '</span>'
        : '<button type="button" class="chip" data-jenis="' + h(j) + '" aria-pressed="false">' + label + ' ' + count + '</button>';
    }).join('');
  }

  /* ==========================================================================
     KERANGKA JADWAL (sebelum data dimuat)
     Daftar sebenarnya baru dirender setelah PPAPI.onReady + store.content.list
     (asinkron). Tanpa kerangka, #agenda-list kosong lalu tumbuh ±0,9–3 ribu px
     dan mendorong pita tautan serta kaki halaman — pergeseran besar (CLS
     0,5–1,0 terukur) bila halaman sudah berada pada posisi gulir tertentu,
     mis. pemulihan gulir saat muat ulang atau kembali. Kerangka disusun dari
     data bawaan (assets/data/agenda.js) dengan markah baris yang sama serta
     tab/penyaring dari alamat, sehingga tingginya mengikuti daftar yang akan
     tampil; teks diganti batang kerangka (agenda.css). Seluruhnya aria-hidden
     + inert, lalu diganti oleh render().
     ========================================================================== */
  (function reserveSchedule() {
    try {
      var listEl = document.getElementById('agenda-list'), chipsEl = document.getElementById('agenda-chips');
      if (!listEl) return;
      var data = PPAPI.data || {};
      var events = toEvents((Array.isArray(data.agenda) ? data.agenda : []).filter(function (x) { return x && !x.hidden; }));
      if (!events.length) return;
      var sp = splitEvents(events), allJenis = jenisOf(events), st = stateFromUrl(events, allJenis);
      var pool = st.tab === TAB_PAST ? sp.past : sp.upcoming;
      if (chipsEl && !chipsEl.children.length) {
        var counts = {};
        pool.forEach(function (ev) {
          if (!matchesState(ev, st, true)) return;
          counts[''] = (counts[''] || 0) + 1;
          if (ev.raw.jenis) counts[ev.raw.jenis] = (counts[ev.raw.jenis] || 0) + 1;
        });
        chipsEl.innerHTML = chipsHtml(allJenis, true, counts);
      }
      var list = pool.filter(function (ev) { return matchesState(ev, st); });
      if (!list.length) return;
      listEl.innerHTML = '<p class="sr-only">Memuat jadwal kegiatan…</p>' +
        '<div class="agenda-list__ph" aria-hidden="true" inert>' + monthsHtml(list, sp.next, true) + '</div>';
    } catch (e) { /* kerangka hanya pelengkap: halaman tetap dirender oleh PPAPI.onReady */ }
  })();

  /* ==========================================================================
     PEMULIHAN POSISI GULIR (muat ulang / kembali tanpa bfcache)
     Pemulihan bawaan peramban berjalan pada tata letak awal — sebelum skrip
     defer memasang kerangka dan sebelum kaki halaman disisipkan — sehingga
     posisi terpotong ke dokumen yang belum lengkap, lalu jadwal yang terisi
     tercatat menggeser konten yang sedang dilihat (CLS 0,5–1,0 terukur pada
     desktop/tablet bila gerak dikurangi). Karena itu:
     • posisi disimpan di history.state entri ini setelah guliran berhenti
       (replaceState saat pagehide tidak ikut tersimpan pada muat ulang);
     • scrollRestoration 'manual' dipasang hanya saat halaman ditinggalkan
       (pagehide) — peramban membacanya pada pemuatan berikutnya entri ini —
       dan dikembalikan ke 'auto' setelah pemuatan, sehingga selama halaman
       terbuka navigasi #jangkar + Kembali tetap ditangani peramban;
     • posisi dikembalikan setelah jadwal dirender dan huruf web siap (paling
       lama 2,5 detik; pada muat ulang huruf biasanya sudah di cache) agar
       pelipatan ulang judul saat huruf tiba tidak terjadi di area yang
       dilihat — hanya bila pengguna belum menggulir, alamat tanpa
       #fragmen, dan bukan tautan detail ?id=.
     ========================================================================== */
  var restoreY = null;
  (function () {
    try {
      var H = window.history;
      if (!('scrollRestoration' in H)) return;
      var st = H.state, y = st && typeof st.agendaY === 'number' ? st.agendaY : 0;
      if (y > 0 && !window.location.hash) restoreY = y;
      var saveTimer = null;
      var save = function () {
        try { H.replaceState(Object.assign({}, H.state, { agendaY: Math.round(window.scrollY || 0) }), ''); } catch (e) { /* abaikan */ }
      };
      window.addEventListener('scroll', function () { clearTimeout(saveTimer); saveTimer = setTimeout(save, 250); }, { passive: true });
      /* hanya mode: replaceState di dalam pagehide tidak tersimpan dan justru
         membatalkan perubahan mode (teruji pada Chromium) */
      window.addEventListener('pagehide', function () {
        if (!window.location.hash) { try { H.scrollRestoration = 'manual'; } catch (e) { /* abaikan */ } }
      });
      window.addEventListener('pageshow', function (e) { if (e.persisted) autoRestoration(); });
    } catch (e) { restoreY = null; }
  })();
  function autoRestoration() { try { window.history.scrollRestoration = 'auto'; } catch (e) { /* abaikan */ } }
  function finishRestore(skip) {
    var y = restoreY, done = false;
    restoreY = null;
    function release() {
      if (document.readyState === 'complete') autoRestoration();
      else window.addEventListener('load', autoRestoration, { once: true });
    }
    if (y === null || skip) { release(); return; }
    function go() { if ((window.scrollY || 0) < 2) window.scrollTo(0, y); release(); }
    function once() { if (done) return; done = true; window.requestAnimationFrame(function () { window.requestAnimationFrame(go); }); }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(once, once); else once();
    setTimeout(once, 2500);
  }

  PPAPI.onReady(async function () {
    var ui = PPAPI.ui;
    var data = PPAPI.data || {};

    /* ---------- data ----------
       Dibaca melalui PPAPI.store.content.list('agenda'): data bawaan (assets/data/agenda.js)
       digabung dengan agenda kelolaan admin; agenda bawaan yang disembunyikan admin tidak tampil.
       Bila penyimpanan tidak dapat dibaca, halaman memakai data bawaan. */
    async function loadAgenda() {
      var store = PPAPI.store;
      if (store && store.content && typeof store.content.list === 'function') {
        try { var list = await store.content.list('agenda'); return Array.isArray(list) ? list : []; }
        catch (e) { console.warn('[PPAPI] Konten agenda memakai data bawaan:', e && e.message); }
      }
      return (Array.isArray(data.agenda) ? data.agenda : []).filter(function (x) { return x && !x.hidden; });
    }
    var agendaData = await loadAgenda();

    /* ---------- normalisasi data ---------- */
    var events = toEvents(agendaData);
    var split = splitEvents(events);
    var upcoming = split.upcoming, past = split.past, nextEv = split.next;
    function findEv(id) { for (var i = 0; i < events.length; i++) if (events[i].id === id) return events[i]; return null; }

    /* ---------- waktu & zona ---------- */
    function instant(date, hm, off) {
      return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), hm[0] - off, hm[1]);
    }
    function startInstant(ev) {
      var t = parseWaktu(ev.raw.waktu);
      return instant(ev.start, t.start || [0, 0], t.tz.off);
    }
    function endInstant(ev) {
      var t = parseWaktu(ev.raw.waktu);
      return instant(ev.end, t.end || [23, 59], t.tz.off);
    }

    function registerUrl(a) {
      var u = String(a.tautanDaftar || '').trim();
      return /^https?:\/\/[^\s]+$/i.test(u) ? u : '';
    }

    /* ======================================================================
       HERO META
       ====================================================================== */
    (function () {
      var meta = U.$('#agenda-hero-meta');
      if (!meta || !events.length) return;
      var jenis = {};
      events.forEach(function (ev) { if (ev.raw.jenis) jenis[ev.raw.jenis] = 1; });
      meta.innerHTML =
        '<span>' + icon('calendar', { size: 16 }) + upcoming.length + ' agenda akan datang</span>' +
        '<span>' + icon('check-circle', { size: 16 }) + past.length + ' telah berlangsung</span>' +
        '<span>' + icon('layers', { size: 16 }) + Object.keys(jenis).length + ' jenis kegiatan</span>';
    })();

    /* ======================================================================
       AGENDA TERDEKAT + HITUNG MUNDUR
       ====================================================================== */
    var cdTimer = null;
    function renderNext() {
      var wrap = U.$('#agenda-next');
      if (!wrap) return;
      /* Panel kerangka di HTML sudah memesan ruang; tanpa agenda mendatang
         bagian ini disembunyikan seluruhnya. */
      if (!nextEv) { if (wrap.parentNode) wrap.parentNode.hidden = true; return; }
      var a = nextEv.raw, t = parseWaktu(a.waktu);
      var startTxt = U.formatDate(nextEv.start, { weekday: true }) + (t.start ? ' · ' + pad2(t.start[0]) + '.' + pad2(t.start[1]) + ' ' + t.zone : '');
      /* data-reveal ada pada pembungkus (#agenda-next) sehingga panel kerangka
         langsung berganti isi tanpa berkedip. */
      wrap.innerHTML =
        '<article class="agenda-feature theme-dark is-filled" aria-labelledby="agenda-next-title">' +
          '<div class="agenda-feature__scaffold" aria-hidden="true">' + ui.scaffoldSVG({ cols: 5, rows: 4 }) + '</div>' +
          '<header class="agenda-feature__head">' +
            '<p class="eyebrow agenda-feature__eyebrow">Agenda terdekat</p>' +
            '<div class="event-row__meta"><span class="tag">' + h(a.jenis || 'Kegiatan') + '</span>' + modeBadge(a) + U.contohBadge(a) + '</div>' +
            '<h2 class="agenda-feature__title" id="agenda-next-title"><a href="agenda.html?id=' + encodeURIComponent(a.id) + '" data-agenda-open="' + h(a.id) + '">' + h(a.judul) + '</a></h2>' +
          '</header>' +
          '<div class="agenda-feature__aside">' +
            '<div class="agenda-cd" id="agenda-cd" role="timer" aria-labelledby="agenda-cd-label">' +
              '<p class="agenda-cd__label" id="agenda-cd-label">Dimulai dalam</p>' +
              '<div class="agenda-cd__units">' +
                '<div class="agenda-cd__unit"><span class="agenda-cd__num" data-cd="d">00</span><span class="agenda-cd__unit-label">Hari</span></div>' +
                '<div class="agenda-cd__unit"><span class="agenda-cd__num" data-cd="h">00</span><span class="agenda-cd__unit-label">Jam</span></div>' +
                '<div class="agenda-cd__unit"><span class="agenda-cd__num" data-cd="m">00</span><span class="agenda-cd__unit-label">Menit</span></div>' +
              '</div>' +
              '<p class="agenda-cd__live" data-cd="live" hidden>Sedang berlangsung</p>' +
              '<p class="agenda-cd__note">' + h(startTxt) + '</p>' +
            '</div>' +
          '</div>' +
          '<div class="agenda-feature__body">' +
            (a.deskripsi ? '<p class="agenda-feature__desc">' + h(a.deskripsi) + '</p>' : '') +
            '<dl class="agenda-feature__facts">' +
              '<div><dt>' + icon('calendar', { size: 16 }) + 'Tanggal</dt><dd>' + h(dateLong(nextEv)) + '</dd></div>' +
              (a.waktu ? '<div><dt>' + icon('clock', { size: 16 }) + 'Waktu</dt><dd>' + h(a.waktu) + '</dd></div>' : '') +
              (a.lokasi ? '<div><dt>' + icon('map-pin', { size: 16 }) + 'Lokasi</dt><dd>' + h(a.lokasi) + '</dd></div>' : '') +
              '<div><dt>' + icon('users', { size: 16 }) + 'Kuota</dt><dd>' + h(kuotaText(a.kuota)) + '</dd></div>' +
            '</dl>' +
          '</div>' +
          '<div class="agenda-feature__actions">' +
            '<button type="button" class="btn btn--primary" data-agenda-open="' + h(a.id) + '" aria-haspopup="dialog"><span>Lihat detail</span>' + icon('arrow-right', { cls: 'btn__icon', size: 18 }) + '</button>' +
            '<button type="button" class="btn btn--ghost" data-agenda-ics="' + h(a.id) + '"><span>Tambahkan ke Kalender</span>' + icon('calendar', { cls: 'btn__icon', size: 18 }) + '</button>' +
          '</div>' +
        '</article>';
      ui.reveal(wrap);
      tick();
      /* sinkron ke batas menit, lalu tiap 60 detik */
      clearTimeout(cdTimer);
      cdTimer = setTimeout(function loop() { tick(); cdTimer = setTimeout(loop, 60000 - (Date.now() % 60000) + 50); }, 60000 - (Date.now() % 60000) + 50);
    }
    function tick() {
      var cd = U.$('#agenda-cd');
      if (!cd || !nextEv) return;
      var now = Date.now(), s = startInstant(nextEv), e = endInstant(nextEv);
      var units = U.$('.agenda-cd__units', cd), live = U.$('[data-cd="live"]', cd), label = U.$('#agenda-cd-label');
      if (now >= s) {
        units.hidden = true;
        live.hidden = false;
        live.textContent = now <= e ? 'Sedang berlangsung' : 'Telah berlangsung';
        if (label) label.textContent = 'Status kegiatan';
        return;
      }
      var diff = s - now, mins = Math.floor(diff / 60000);
      var d = Math.floor(mins / 1440), hh = Math.floor((mins % 1440) / 60), mm = mins % 60;
      U.$('[data-cd="d"]', cd).textContent = d > 99 ? String(d) : pad2(d);
      U.$('[data-cd="h"]', cd).textContent = pad2(hh);
      U.$('[data-cd="m"]', cd).textContent = pad2(mm);
    }

    /* ======================================================================
       DAFTAR + PENYARING
       ====================================================================== */
    var listEl = U.$('#agenda-list'), chipsEl = U.$('#agenda-chips'), countEl = U.$('#agenda-count');
    var tabsEl = U.$('#agenda-tabs'), modeEl = U.$('#agenda-mode'), resetBtn = U.$('#agenda-reset');
    var allJenis = jenisOf(events);
    var state = stateFromUrl(events, allJenis);

    function syncUrl() {
      try {
        var p = new URLSearchParams(window.location.search);
        if (state.tab === TAB_PAST) p.set('tab', TAB_PAST); else p.delete('tab');
        if (state.jenis) p.set('jenis', state.jenis); else p.delete('jenis');
        if (state.mode) p.set('mode', state.mode); else p.delete('mode');
        var s = p.toString();
        window.history.replaceState(window.history.state, '', window.location.pathname + (s ? '?' + s : '') + window.location.hash);
      } catch (e) { /* abaikan */ }
    }
    function setParam(name, value) {
      try {
        var p = new URLSearchParams(window.location.search);
        if (value) p.set(name, value); else p.delete(name);
        var s = p.toString();
        window.history.replaceState(window.history.state, '', window.location.pathname + (s ? '?' + s : '') + window.location.hash);
      } catch (e) { /* abaikan */ }
    }

    function pool() { return state.tab === TAB_PAST ? past : upcoming; }
    function matches(ev, ignoreJenis) { return matchesState(ev, state, ignoreJenis); }

    /* chip jenis (menggantikan chip kerangka) */
    if (chipsEl) {
      chipsEl.innerHTML = chipsHtml(allJenis);
      chipsEl.addEventListener('click', function (e) {
        var c = e.target.closest('.chip');
        if (!c) return;
        state.jenis = c.getAttribute('data-jenis') || '';
        render();
      });
    }
    if (tabsEl) tabsEl.addEventListener('segmented:change', function (e) {
      var v = e.detail && e.detail.value;
      state.tab = v === TAB_PAST ? TAB_PAST : TAB_UP;
      render();
    });
    if (modeEl) modeEl.addEventListener('segmented:change', function (e) {
      var v = (e.detail && e.detail.option && e.detail.option.getAttribute('data-value')) || '';
      state.mode = MODES.indexOf(v) !== -1 ? v : '';
      render();
    });
    function resetFilters() { state.jenis = ''; state.mode = ''; render(); }
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);

    function render() {
      var list = pool().filter(function (ev) { return matches(ev); });

      /* kontrol */
      if (tabsEl) U.$$('.segmented__option', tabsEl).forEach(function (b) {
        b.setAttribute('aria-pressed', b.getAttribute('data-value') === state.tab ? 'true' : 'false');
      });
      U.$$('[data-count-for]').forEach(function (s) {
        var src = s.getAttribute('data-count-for') === TAB_PAST ? past : upcoming;
        s.textContent = src.filter(function (ev) { return matches(ev); }).length;
      });
      if (modeEl) U.$$('.segmented__option', modeEl).forEach(function (b) {
        b.setAttribute('aria-pressed', (b.getAttribute('data-value') || '') === state.mode ? 'true' : 'false');
      });
      if (chipsEl) U.$$('.chip', chipsEl).forEach(function (c) {
        var j = c.getAttribute('data-jenis') || '';
        var n = pool().filter(function (ev) { return matches(ev, true) && (!j || ev.raw.jenis === j); }).length;
        c.setAttribute('aria-pressed', j === state.jenis ? 'true' : 'false');
        c.classList.toggle('is-zero', n === 0 && j !== state.jenis);
        var nEl = U.$('[data-chip-n]', c);
        if (nEl) nEl.textContent = n;
      });

      /* status */
      var tabWord = state.tab === TAB_PAST ? 'telah berlangsung' : 'akan datang';
      var filt = [];
      if (state.jenis) filt.push('jenis ' + state.jenis);
      if (state.mode) filt.push('mode ' + state.mode);
      if (countEl) countEl.textContent = list.length
        ? list.length + ' agenda ' + tabWord + (filt.length ? ' · ' + filt.join(' · ') : '')
        : 'Tidak ada agenda ' + tabWord + (filt.length ? ' untuk ' + filt.join(' dan ') : '') + '.';
      if (resetBtn) resetBtn.hidden = !(state.jenis || state.mode);

      /* daftar */
      if (!listEl) return;
      if (!list.length) {
        var none = !pool().length;
        var other = state.tab === TAB_PAST ? TAB_UP : TAB_PAST;
        listEl.innerHTML = '<div class="agenda-empty">' + ui.emptyState(none ? {
          icon: 'calendar',
          title: state.tab === TAB_PAST ? 'Belum ada kegiatan yang tercatat' : 'Belum ada agenda terjadwal',
          text: state.tab === TAB_PAST
            ? 'Kegiatan yang telah diselenggarakan akan tercatat di sini.'
            : 'Agenda kegiatan berikutnya akan diumumkan oleh sekretariat. Sementara itu, Anda dapat melihat kegiatan yang telah berlangsung.',
          actionHtml: (state.tab === TAB_PAST ? upcoming : past).length ? '<button type="button" class="btn btn--ghost btn--sm" data-agenda-tab="' + other + '"><span>' + (other === TAB_PAST ? 'Lihat yang telah berlangsung' : 'Lihat agenda akan datang') + '</span></button>' : ''
        } : {
          icon: 'filter',
          title: 'Tidak ada agenda yang sesuai',
          text: 'Belum ada agenda ' + tabWord + ' untuk ' + filt.join(' dan ') + '. Ubah penyaring atau tampilkan semua agenda.',
          actionHtml: '<button type="button" class="btn btn--ghost btn--sm" data-agenda-reset><span>Hapus filter</span></button>'
        }) + '</div>';
      } else {
        listEl.innerHTML = monthsHtml(list, nextEv);
      }
      listEl.classList.toggle('is-past-tab', state.tab === TAB_PAST);
      syncUrl();
      ui.reveal(listEl);
    }

    /* ======================================================================
       JUDUL & DESKRIPSI DOKUMEN
       Selama detail terbuka (alamat agenda.html?id=…), judul dokumen dan
       deskripsi meta mengikuti agenda tersebut — tiap tautan ?id= tidak lagi
       berbagi judul "Agenda Kegiatan". Dipulihkan saat detail ditutup.
       ====================================================================== */
    var META = { desc: 'meta[name="description"]', ogTitle: 'meta[property="og:title"]', ogDesc: 'meta[property="og:description"]' };
    var savedMeta = null;
    function metaGet(sel) { var m = document.head.querySelector(sel); return m ? m.getAttribute('content') : null; }
    function metaSet(sel, val) { var m = document.head.querySelector(sel); if (m && val !== null && val !== undefined) m.setAttribute('content', val); }
    function clip(s, max) {
      s = String(s || '').replace(/\s+/g, ' ').trim();
      if (s.length <= max) return s;
      var cut = s.slice(0, max - 1), sp = cut.lastIndexOf(' ');
      return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,.;:–—-]+$/, '') + '…';
    }
    function applyEventMeta(ev) {
      if (!savedMeta) savedMeta = { title: document.title, desc: metaGet(META.desc), ogTitle: metaGet(META.ogTitle), ogDesc: metaGet(META.ogDesc) };
      var a = ev.raw, title = U.plain(a.judul) + ' — Agenda PPAPI';
      var desc = clip(U.plain(a.deskripsi) ||
        ((a.jenis || 'Kegiatan') + ' PPAPI, ' + dateLong(ev) + (a.lokasi ? ', ' + a.lokasi : '') + '.'), 160);
      document.title = title;
      metaSet(META.ogTitle, title);
      metaSet(META.desc, desc);
      metaSet(META.ogDesc, desc);
    }
    function restoreMeta() {
      if (!savedMeta) return;
      document.title = savedMeta.title;
      metaSet(META.ogTitle, savedMeta.ogTitle);
      metaSet(META.desc, savedMeta.desc);
      metaSet(META.ogDesc, savedMeta.ogDesc);
      savedMeta = null;
    }

    /* ======================================================================
       MODAL DETAIL
       ====================================================================== */
    var openModal = null;
    function openDetail(id, opts) {
      var ev = findEv(id);
      if (!ev) return;
      var a = ev.raw, st = statusInfo(ev), reg = registerUrl(a), past = isPast(ev);
      var multi = dayCount(ev) > 1;
      var hints = [], buttons;
      if (past) {
        hints.push(icon('check-circle', { size: 16 }) + '<span>Kegiatan ini telah berlangsung. Rangkuman kegiatan dimuat di halaman Berita bila tersedia.</span>');
        buttons = '<a class="btn btn--ghost" href="berita.html?kategori=Kegiatan"><span>Lihat liputan kegiatan</span>' + icon('arrow-right', { cls: 'btn__icon', size: 18 }) + '</a>';
      } else {
        hints.push(icon('info', { size: 16 }) + '<span>' + (reg ? 'Pendaftaran dilakukan melalui formulir daring penyelenggara.' : 'Pendaftaran dilayani sekretariat. Sampaikan minat Anda melalui halaman Kontak.') + '</span>');
        buttons =
          '<button type="button" class="btn btn--ghost" data-agenda-ics="' + h(a.id) + '"><span>Tambahkan ke Kalender</span>' + icon('calendar', { cls: 'btn__icon', size: 18 }) + '</button>' +
          (reg
            ? '<a class="btn btn--primary" href="' + h(reg) + '" target="_blank" rel="noopener noreferrer"><span>Daftar sekarang</span>' + icon('arrow-up-right', { cls: 'btn__icon', size: 18 }) + '<span class="sr-only"> (membuka tab baru)</span></a>'
            : '<a class="btn btn--primary" href="umpan-balik.html?kategori=Pertanyaan#formulir"><span>Hubungi Sekretariat</span>' + icon('arrow-right', { cls: 'btn__icon', size: 18 }) + '</a>');
      }
      if (a.contoh) hints.push(icon('alert-triangle', { size: 16 }) + '<span>Agenda contoh untuk memperlihatkan tampilan situs. Jadwal resmi diumumkan oleh sekretariat.</span>');
      var statusBadge = st.key === 'ongoing' ? '<span class="badge badge--ok">Sedang berlangsung</span>'
        : (st.key === 'past' ? '<span class="badge badge--muted">Telah berlangsung</span>' : '<span class="badge badge--solid">Akan datang</span>');
      var body =
        '<div class="agenda-modal' + (past ? ' is-past' : '') + '">' +
          '<div class="agenda-modal__top">' +
            dateBlock(ev, 'date-block--dark') +
            '<div class="agenda-modal__when">' +
              '<p class="agenda-modal__date">' + h(dateLong(ev)) + '</p>' +
              '<p class="agenda-modal__rel">' + h(st.rel) + (multi ? ' · ' + h(daysLabel(ev)) : '') + '</p>' +
              '<div class="event-row__meta">' + modeBadge(a) + statusBadge + U.contohBadge(a) + '</div>' +
            '</div>' +
          '</div>' +
          (a.deskripsi ? '<p class="agenda-modal__desc">' + h(a.deskripsi) + '</p>' : '') +
          '<dl class="kv kv--stacked agenda-modal__facts">' +
            (a.waktu ? '<div class="kv__row"><dt>Waktu</dt><dd>' + h(a.waktu) + (multi ? ' <span class="agenda-modal__muted">· setiap hari</span>' : '') + '</dd></div>' : '') +
            (a.lokasi ? '<div class="kv__row"><dt>Lokasi</dt><dd>' + h(a.lokasi) + '</dd></div>' : '') +
            '<div class="kv__row"><dt>Mode</dt><dd>' + h(MODE_DESC[a.mode] || a.mode || '—') + '</dd></div>' +
            '<div class="kv__row"><dt>Kuota</dt><dd>' + h(kuotaText(a.kuota)) + '</dd></div>' +
            (past ? '' : '<div class="kv__row"><dt>Pendaftaran</dt><dd>' + (reg ? 'Melalui tautan pendaftaran daring' : 'Melalui sekretariat PPAPI') + '</dd></div>') +
          '</dl>' +
          '<div class="agenda-modal__actions">' +
            '<div class="agenda-modal__hints">' + hints.map(function (x) { return '<p class="agenda-modal__hint">' + x + '</p>'; }).join('') + '</div>' +
            '<div class="agenda-modal__buttons">' + buttons + '</div>' +
          '</div>' +
        '</div>';
      if (openModal) { replacing = true; try { openModal.close(); } catch (e) { /* abaikan */ } replacing = false; }
      openModal = ui.modal({
        eyebrow: (a.jenis || 'Agenda') + (past ? ' · Telah berlangsung' : ''),
        title: a.judul,
        body: body,
        size: 'lg',
        cls: 'agenda-modal-root',
        onOpen: function (el) {
          el.addEventListener('click', function (e) {
            var b = e.target.closest('[data-agenda-ics]');
            if (b) { e.preventDefault(); downloadIcs(b.getAttribute('data-agenda-ics')); }
          });
        },
        onClose: function () {
          openModal = null; setParam('id', ''); restoreMeta();
          if (opts && opts.deep && !replacing) revealRow(ev.id);
        }
      });
      applyEventMeta(ev);
      if (!(opts && opts.keepUrl)) setParam('id', ev.id);
    }
    var replacing = false;   /* detail diganti detail lain: jangan menuju baris */

    /* ======================================================================
       TAUTAN LANGSUNG (?id=…)
       Detail dibuka seketika tanpa menggulir halaman di belakangnya.
       Sebelumnya baris digulir ke tengah layar tepat setelah daftar dirender —
       saat tata letak dan huruf web belum tenang — sehingga seluruh jadwal
       bergeser di bawah modal (CLS 0,84–1,0 bila gerak dikurangi; 0,04–0,12
       saat huruf web terlambat). Baris agenda kini dituju setelah detail
       ditutup: guliran mengikuti tindakan pengguna, baris disorot sejenak, dan
       fokus berpindah ke judulnya agar pengguna papan ketik melanjutkan dari
       agenda yang sama (tanpa pemicu, fokus semula hanyalah <body>).
       ====================================================================== */
    var targetTimer = null;
    function revealRow(id) {
      var row = document.getElementById('agenda-' + id);
      if (!row) return;   /* tersaring oleh ?jenis=/?mode= pada alamat: posisi halaman dibiarkan */
      var link = U.$('.event-row__title a', row);
      if (link) { try { link.focus({ preventScroll: true }); } catch (e) { link.focus(); } }
      var r = row.getBoundingClientRect(), hdr = U.$('.site-header');
      var top = hdr ? Math.max(0, hdr.getBoundingClientRect().bottom) : 0;
      if (r.top < top || r.bottom > (window.innerHeight || document.documentElement.clientHeight)) {
        var reduced = !!(PPAPI.motion && PPAPI.motion.prefersReduced());
        try { row.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' }); } catch (e) { row.scrollIntoView(); }
      }
      row.classList.add('is-target');
      clearTimeout(targetTimer);
      targetTimer = setTimeout(function () { row.classList.remove('is-target'); }, 2600);
    }

    /* ======================================================================
       KALENDER (.ics, RFC 5545)
       ====================================================================== */
    function icsText(s) {
      return String(s === null || s === undefined ? '' : s)
        .replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
    }
    function utf8Len(cp) { return cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4; }
    function fold(line) {
      /* lipat baris > 75 oktet (CRLF + spasi), tanpa memotong karakter multibita */
      var out = '', cur = '', bytes = 0;
      for (var i = 0; i < line.length; i++) {
        var code = line.codePointAt(i), ch = String.fromCodePoint(code);
        if (code > 0xffff) i++;
        var b = utf8Len(code);
        if (bytes + b > 75) { out += cur + '\r\n '; cur = ''; bytes = 1; }
        cur += ch; bytes += b;
      }
      return out + cur;
    }
    function ymd(d) { return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()); }
    function local(d, hm) { return ymd(d) + 'T' + pad2(hm[0]) + pad2(hm[1]) + '00'; }
    function utcStamp(ms) {
      var d = new Date(ms);
      return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) + 'T' + pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + 'Z';
    }
    function buildIcs(ev) {
      var a = ev.raw, t = parseWaktu(a.waktu), tz = t.tz, days = dayCount(ev);
      var page = U.siteUrl('agenda.html?id=' + encodeURIComponent(ev.id));
      var reg = registerUrl(a);
      var desc = [
        a.deskripsi || '',
        '',
        'Jenis: ' + (a.jenis || '-'),
        'Waktu: ' + (a.waktu || '-') + (days > 1 ? ' (setiap hari, ' + days + ' hari)' : ''),
        'Lokasi: ' + (a.lokasi || '-'),
        'Mode: ' + (MODE_DESC[a.mode] || a.mode || '-'),
        'Kuota: ' + kuotaText(a.kuota),
        'Pendaftaran: ' + (reg || 'melalui sekretariat PPAPI (halaman Kontak)'),
        /^https?:/i.test(page) ? 'Info: ' + page : ''
      ].concat(a.contoh ? ['', 'Catatan: agenda contoh — jadwal resmi diumumkan oleh sekretariat.'] : []).join('\n').replace(/\n+$/, '');
      var L = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//PPAPI//Agenda Kegiatan//ID',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH'
      ];
      if (t.start) {
        var off = '+' + pad2(tz.off) + '00';
        L.push('BEGIN:VTIMEZONE', 'TZID:' + tz.id, 'X-LIC-LOCATION:' + tz.id,
          'BEGIN:STANDARD', 'TZOFFSETFROM:' + off, 'TZOFFSETTO:' + off, 'TZNAME:' + t.zone, 'DTSTART:19700101T000000', 'END:STANDARD',
          'END:VTIMEZONE');
      }
      L.push('BEGIN:VEVENT',
        'UID:agenda-' + U.slugify(ev.id) + '-' + ymd(ev.start) + '@ppapi',
        'DTSTAMP:' + utcStamp(Date.now()));
      if (t.start) {
        L.push('DTSTART;TZID=' + tz.id + ':' + local(ev.start, t.start));
        if (t.end) L.push('DTEND;TZID=' + tz.id + ':' + local(ev.start, t.end));
        if (days > 1) L.push('RRULE:FREQ=DAILY;COUNT=' + days);
      } else {
        var after = new Date(ev.end.getFullYear(), ev.end.getMonth(), ev.end.getDate() + 1);
        L.push('DTSTART;VALUE=DATE:' + ymd(ev.start), 'DTEND;VALUE=DATE:' + ymd(after));
      }
      L.push('SUMMARY:' + icsText((a.contoh ? '[Contoh] ' : '') + a.judul + ' — PPAPI'));
      if (a.lokasi) L.push('LOCATION:' + icsText(a.lokasi));
      L.push('DESCRIPTION:' + icsText(desc));
      if (a.jenis) L.push('CATEGORIES:' + icsText(a.jenis));
      L.push('STATUS:' + (a.contoh ? 'TENTATIVE' : 'CONFIRMED'), 'TRANSP:OPAQUE');
      if (/^https?:\/\//i.test(page)) L.push('URL:' + page);
      if (!isPast(ev)) {
        L.push('BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + icsText('Pengingat: ' + a.judul + ' (besok)'), 'TRIGGER:-P1D', 'END:VALARM');
      }
      L.push('END:VEVENT', 'END:VCALENDAR');
      return L.map(fold).join('\r\n') + '\r\n';
    }
    function downloadIcs(id) {
      var ev = findEv(id);
      if (!ev) return;
      var name = 'ppapi-agenda-' + (U.slugify(ev.id) || 'kegiatan') + '.ics';
      try {
        var blob = new Blob([buildIcs(ev)], { type: 'text/calendar;charset=utf-8' });
        var url = URL.createObjectURL(blob);
        var link = document.createElement('a');
        link.href = url; link.download = name; link.rel = 'noopener'; link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(function () { URL.revokeObjectURL(url); if (link.parentNode) link.parentNode.removeChild(link); }, 2000);
        ui.toast('Berkas kalender “' + name + '” diunduh. Buka berkas tersebut untuk menambahkan agenda ke kalender Anda.', { type: 'success' });
      } catch (err) {
        console.error(err);
        ui.toast('Berkas kalender gagal dibuat pada peramban ini.', { type: 'error' });
      }
    }

    /* ======================================================================
       DELEGASI KLIK (halaman)
       ====================================================================== */
    U.$('#main').addEventListener('click', function (e) {
      var o = e.target.closest('[data-agenda-open]');
      if (o) {
        if (e.ctrlKey || e.metaKey || e.shiftKey || e.button === 1) return;   /* biarkan buka di tab baru */
        e.preventDefault();
        openDetail(o.getAttribute('data-agenda-open'));
        return;
      }
      var ics = e.target.closest('[data-agenda-ics]');
      if (ics) { e.preventDefault(); downloadIcs(ics.getAttribute('data-agenda-ics')); return; }
      if (e.target.closest('[data-agenda-reset]')) { resetFilters(); var c = chipsEl && U.$('.chip', chipsEl); if (c) c.focus(); return; }
      var tb = e.target.closest('[data-agenda-tab]');
      if (tb) { state.tab = tb.getAttribute('data-agenda-tab') === TAB_PAST ? TAB_PAST : TAB_UP; render(); }
    });

    /* ======================================================================
       MULAI
       ====================================================================== */
    renderNext();
    render();

    /* tautan langsung ?id=… → buka detail; baris dituju setelah detail ditutup (lihat revealRow) */
    var deepId = (U.qs('id') || '').trim(), deepEv = deepId ? findEv(deepId) : null;
    if (deepId) {
      if (!deepEv) {
        setParam('id', '');
        ui.toast('Agenda yang Anda cari tidak ditemukan. Silakan pilih dari jadwal di bawah ini.', { type: 'info' });
      } else {
        openDetail(deepId, { keepUrl: true, deep: true });
      }
    }
    /* posisi gulir tersimpan dikembalikan setelah jadwal terisi; tidak untuk tautan detail */
    finishRestore(!!deepEv);
  });
})();
