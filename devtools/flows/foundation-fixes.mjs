// Regression test for the shared-foundation fixes of 2026-10-08 (see FOUNDATION_NOTES.md → Changelog).
// Run from devtools/:  node flows/foundation-fixes.mjs
// Serves site/ plus an IN-MEMORY test page (/__fixes.html — nothing is written into site/) and checks, with
// real layout measurements, every gap page authors had worked around in their own files.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.txt': 'text/plain; charset=utf-8' };

const TEST_PAGE = `<!doctype html>
<html lang="id" class="no-js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Uji Perbaikan — PPAPI</title>
<meta property="og:image" content="assets/img/og-image.jpg">
<link rel="stylesheet" href="assets/css/main.css"><script>document.documentElement.classList.replace('no-js','js')</script>
<style>
  #t-grain { height: 240px; }
  .t-row44 .check { min-height: 44px; align-items: center; padding-block: 0; }
  .t-row44 .check__box { margin-top: 0; }
  #t-card { width: 300px; }
</style></head>
<body data-page="uji" data-auth="public">
<a class="skip-link" href="#main">Lewati ke konten utama</a>
<div id="site-header"></div>
<main id="main" tabindex="-1">
  <section class="section section--tight" style="padding-top:120px"><div class="container">
    <nav class="breadcrumb" aria-label="Breadcrumb" id="t-bc"><ol><li><a href="index.html">Beranda</a></li><li><a href="berita.html">Berita</a></li><li aria-current="page">Pelatihan Inspeksi Perancah Tingkat Lanjut untuk Supervisor Proyek Kilang dan Gedung Bertingkat di Kalimantan Timur</li></ol></nav>
    <nav class="breadcrumb" aria-label="Breadcrumb 2" id="t-bc2"><ol><li><a href="index.html">Beranda</a></li><li aria-current="page"><span>Judul yang dibungkus span oleh halaman dan juga sangat panjang sekali hingga harus dipotong</span></li></ol></nav>
    <p><span class="index-num" id="t-idx">01 <span>/ 06</span></span></p>
    <div class="grain" id="t-grain"><div data-scaffold data-cols="4" data-rows="2"></div><p class="h3">Konten di atas butiran</p></div>
    <article class="event-row" id="t-ev"><div class="date-block" id="t-db"><span class="date-block__day">21–23</span><span class="date-block__month">Okt</span><span class="date-block__year">2026</span></div>
      <div class="event-row__body"><h4 class="event-row__title" id="t-h4"><a href="#">Pelatihan Perancah</a></h4></div></article>
    <div class="marquee" aria-label="Nilai-nilai PPAPI" id="t-mq"><div class="marquee__track"><span class="marquee__item">Keselamatan</span><span class="marquee__sep" aria-hidden="true">◆</span><span class="marquee__item">Integritas</span><span class="marquee__sep" aria-hidden="true">◆</span></div></div>
    <form class="form" novalidate onsubmit="return false">
      <div class="form__row form__row--2" id="t-row2">
        <div class="field" id="t-f1"><label class="field__label" for="t-a">Nama lengkap <span class="field__req" aria-hidden="true">*</span></label><input class="field__control" id="t-a" required></div>
        <div class="field" id="t-f2"><label class="field__label" for="t-b">Email <span class="opt">(opsional)</span></label><input class="field__control" id="t-b"><p class="field__hint">Petunjuk yang cukup panjang agar kolom ini lebih tinggi daripada kolom di sebelahnya, sehingga baris grid meregang dan kolom pertama ikut tertarik.</p></div>
      </div>
      <div class="field"><label class="field__label" for="t-c" id="t-lc">Pesan <span class="field__counter" id="t-cnt">0 / 2.000</span></label><textarea class="field__control" id="t-c"></textarea></div>
      <div class="t-row44" id="t-row44"><label class="check"><input type="checkbox" id="t-chk"><span class="check__box"></span><span class="check__label">Ingat saya</span></label></div>
      <label class="check" id="t-agree-wrap"><input type="checkbox" id="t-agree"><span class="check__box"></span><span class="check__label">Saya menyetujui <a href="kebijakan-privasi.html" id="t-agree-link">Kebijakan Privasi</a> PPAPI dan bersedia dihubungi oleh sekretariat bila diperlukan.</span></label>
      <div class="segmented" role="radiogroup" aria-label="Kategori" id="t-seg">
        <label><input type="radio" name="kat" value="Kritik" checked><span class="segmented__option">Kritik</span></label>
        <label><input type="radio" name="kat" value="Saran"><span class="segmented__option">Saran</span></label>
        <label><input type="radio" name="kat" value="Pertanyaan"><span class="segmented__option">Pertanyaan</span></label>
      </div>
      <fieldset class="rating"><legend class="field__label">Penilaian</legend><div class="rating__stars" id="t-rate">
        <input type="radio" id="r5" name="rating" value="5"><label for="r5"><span data-icon="star" data-icon-size="26"></span><span class="sr-only">5 bintang</span></label>
        <input type="radio" id="r4" name="rating" value="4"><label for="r4"><span data-icon="star" data-icon-size="26"></span><span class="sr-only">4 bintang</span></label>
        <input type="radio" id="r3" name="rating" value="3"><label for="r3"><span data-icon="star" data-icon-size="26"></span><span class="sr-only">3 bintang</span></label>
        <input type="radio" id="r2" name="rating" value="2"><label for="r2"><span data-icon="star" data-icon-size="26"></span><span class="sr-only">2 bintang</span></label>
        <input type="radio" id="r1" name="rating" value="1"><label for="r1"><span data-icon="star" data-icon-size="26"></span><span class="sr-only">1 bintang</span></label>
      </div></fieldset>
      <div class="card" id="t-card"><span class="field__label">Kode OTP</span><div class="otp" id="t-otp"></div></div>
    </form>
    <div class="table-wrap"><table class="table" id="t-table"><thead><tr><th colspan="3" id="t-thg">Kelompok kolom dengan judul yang cukup panjang sehingga harus dibungkus ke baris berikutnya pada layar yang sempit sekalipun di desktop</th></tr><tr><th scope="col">Jenis</th><th scope="col">Judul</th><th scope="col">Status</th></tr></thead>
      <tbody><tr><td data-label="Jenis">UU</td><td data-label="Judul">Ketenagakerjaan</td><td data-label="Status">Berlaku</td></tr></tbody></table></div>
    <div data-accordion="single" class="accordion" id="t-acc"></div>
    <div data-accordion class="accordion" id="t-acc2"></div>
    <h2 class="h2 split-lines" id="t-split"></h2>
  </div></section>
  <section class="section" style="margin-top:2400px"><div class="container"><div data-reveal="right" id="t-rev" style="height:60px;background:#111">geser</div><div data-reveal="left" style="height:60px;background:#333">geser</div></div></section>
</main>
<div id="site-footer"></div>
<script src="assets/js/config.js" defer></script><script src="assets/js/core.js" defer></script><script src="assets/js/auth.js" defer></script><script src="assets/js/store.js" defer></script>
<script>document.addEventListener('DOMContentLoaded', function () { PPAPI.onReady(function () { PPAPI.ui.otp(document.getElementById('t-otp')); }); });</script>
</body></html>`;

const server = http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/__fixes.html') { res.writeHead(200, { 'content-type': MIME['.html'] }); return res.end(TEST_PAGE); }
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let passed = 0, failed = 0;
const ok = (c, m, x) => { if (c) { passed++; console.log('✓ ' + m); } else { failed++; process.exitCode = 1; console.error('✗ ' + m + (x !== undefined ? '\n    ' + JSON.stringify(x) : '')); } };

/* shared in-page helpers */
const HELPERS = () => {
  window.__r = el => { const b = (typeof el === 'string' ? document.querySelector(el) : el).getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height, r: b.right, b: b.bottom }; };
  window.__rgb = s => {
    let m = /rgba?\(([^)]+)\)/.exec(s);
    if (m) { const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] == null ? 1 : p[3]]; }
    m = /color\(srgb ([^)]+)\)/.exec(s);
    if (m) { const p = m[1].split(/[\s\/]+/).filter(Boolean).map(Number); return [p[0] * 255, p[1] * 255, p[2] * 255, p[3] == null ? 1 : p[3]]; }
    return null;
  };
  window.__lum = c => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]); };
  window.__bg = el => { for (let e = el; e; e = e.parentElement) { const c = __rgb(getComputedStyle(e).backgroundColor); if (c && c[3] > 0.5) return c; } return [255, 255, 255, 1]; };
  window.__contrast = el => {
    const cs = getComputedStyle(el); let fg = __rgb(cs.color); const bg = __bg(el);
    let a = fg[3]; for (let e = el; e; e = e.parentElement) a *= parseFloat(getComputedStyle(e).opacity);
    fg = [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a));
    const L1 = __lum(fg), L2 = __lum(bg); return (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
  };
};

const browser = await chromium.launch();
try {
  for (const vp of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true }]) {
    console.log(`\n— ${vp.name} (${vp.width}px) —`);
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, reducedMotion: 'no-preference', locale: 'id-ID' });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
    await page.goto(`${BASE}/__fixes.html`, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady());
    await page.evaluate(HELPERS);
    await page.waitForTimeout(400);

    /* 9. data-reveal left/right pre-state never causes sideways scroll */
    const ov = await page.evaluate(() => ({ over: document.documentElement.scrollWidth - window.innerWidth, pre: !document.getElementById('t-rev').classList.contains('is-visible'), mainX: getComputedStyle(document.querySelector('main')).overflowX }));
    ok(ov.pre && ov.over <= 0 && ov.mainX === 'clip', '9 data-reveal="left|right" (not yet revealed) causes no horizontal overflow (main overflow-x: clip)', ov);

    /* 1. grain + scaffold slot */
    const g = await page.evaluate(() => { const s = document.querySelector('#t-grain > [data-scaffold]'); return { pos: getComputedStyle(s).position, grain: __r('#t-grain'), slot: __r(s), txt: getComputedStyle(document.querySelector('#t-grain > p')).position }; });
    ok(g.pos === 'absolute' && Math.abs(g.slot.h - g.grain.h) < 1 && Math.abs(g.slot.w - g.grain.w) < 1 && g.txt === 'relative', '1 .grain keeps [data-scaffold] absolute (inset:0) — content still lifted', g);

    /* 2. h4 component title */
    const h = await page.evaluate(() => { const c = getComputedStyle(document.getElementById('t-h4')); return { tt: c.textTransform, ls: parseFloat(c.letterSpacing) || 0, ff: c.fontFamily }; });
    ok(h.tt === 'none' && h.ls <= 0 && /Cormorant/.test(h.ff), '2 <h4 class="event-row__title"> keeps the serif title style (no uppercase/tracking)', h);

    /* 3. marquee semantics */
    const mq = await page.evaluate(() => { const m = document.getElementById('t-mq'); const kids = [...m.querySelectorAll('.marquee__track > *')]; const orig = kids.filter(k => !k.hasAttribute('data-marquee-clone')); const clones = kids.filter(k => k.hasAttribute('data-marquee-clone'));
      return { role: m.getAttribute('role'), label: m.getAttribute('aria-label'), orig: orig.length, clones: clones.length, cloneHidden: clones.every(c => c.getAttribute('aria-hidden') === 'true' && c.hasAttribute('inert')), origVisible: orig.filter(o => o.classList.contains('marquee__item')).every(o => !o.hasAttribute('aria-hidden')) }; });
    ok(mq.role === 'marquee' && mq.label && mq.orig === 4 && mq.clones >= 4 && mq.cloneHidden && mq.origVisible, '3 marquee: role=marquee (label valid), originals exposed once, clones aria-hidden + inert', mq);

    /* 5. OTP fits a 300px card */
    const otp = await page.evaluate(() => { const c = document.getElementById('t-card'), o = document.getElementById('t-otp'); const cs = getComputedStyle(c); const inner = __r(c).r - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth); const last = o.lastElementChild; return { n: o.children.length, lastR: __r(last).r, inner, over: o.scrollWidth - o.clientWidth, w: __r(o.firstElementChild).w }; });
    ok(otp.n === 6 && otp.lastR <= otp.inner + 0.5 && otp.over <= 0 && otp.w >= 30, '5 six OTP boxes shrink to fit a 300px card', otp);

    /* 6a. .check in a 44px row: input covers the visible box */
    const ck = await page.evaluate(() => { document.getElementById('t-row44').scrollIntoView({ block: 'center' }); const i = __r('#t-chk'), b = __r('#t-row44 .check__box'); const hit = document.elementFromPoint(b.x + b.w / 2, b.y + b.h / 2); return { i, b, hitIsInput: hit && hit.id === 't-chk' }; });
    ok(ck.i.x <= ck.b.x + 0.5 && ck.i.r >= ck.b.r - 0.5 && ck.i.y <= ck.b.y + 0.5 && ck.i.b >= ck.b.b - 0.5 && ck.hitIsInput, '6 .check: native input covers the visible box (44px centred row) and receives the hit', ck);
    await page.check('#t-chk');
    ok(await page.isChecked('#t-chk'), '6 .check: page.check(input) works without force');
    const ag = await page.evaluate(() => { document.getElementById('t-agree-wrap').scrollIntoView({ block: 'center' }); const l = __r('#t-agree-link'); const hit = document.elementFromPoint(l.x + l.w / 2, l.y + l.h / 2); return { hitLink: !!(hit && hit.closest('#t-agree-link')) }; });
    ok(ag.hitLink, '6 .check: links inside .check__label stay clickable (input only covers the box column)', ag);

    /* 6b. segmented radio variant */
    const seg = await page.evaluate(() => [...document.querySelectorAll('#t-seg > label')].map(l => { const i = __r(l.querySelector('input')), s = __r(l.querySelector('.segmented__option')); return Math.max(Math.abs(i.x - s.x), Math.abs(i.y - s.y), Math.abs(i.w - s.w), Math.abs(i.h - s.h)); }));
    ok(seg.every(d => d < 1), '6 .segmented radios: each native input lies exactly over its option (no top-left stack)', seg);
    await page.click('#t-seg input[value="Pertanyaan"] + .segmented__option');
    ok(await page.isChecked('#t-seg input[value="Pertanyaan"]'), '6 .segmented: clicking the visible option selects its radio');
    await page.focus('#t-seg input[value="Pertanyaan"]'); await page.keyboard.press('ArrowLeft');
    const segK = await page.evaluate(() => ({ v: document.querySelector('#t-seg input:checked').value, ring: getComputedStyle(document.querySelector('#t-seg input:checked + .segmented__option')).outlineStyle }));
    ok(segK.v === 'Saran' && segK.ring !== 'none', '6 .segmented: arrow keys + visible focus ring on the option', segK);

    /* 7. two-column row: shorter field not stretched apart */
    const f2 = await page.evaluate(() => { const f = document.getElementById('t-f1'); const l = __r(f.querySelector('.field__label')), c = __r(f.querySelector('.field__control')); return { gap: c.y - l.b, top: c.y - l.y, labH: l.h, row: __r('#t-row2').h, two: getComputedStyle(document.getElementById('t-row2')).gridTemplateColumns.split(' ').length }; });
    ok(Math.abs(f2.gap - 8) < 1.5 && f2.labH < 24 && f2.top < 32 && (vp.isMobile || f2.two === 2), '7 .form__row--2: label and control of the shorter field stay 8px apart', f2);

    /* 8. required marker adjacent, counter right-aligned */
    const rq = await page.evaluate(() => { const lab = document.querySelector('#t-f1 .field__label'); const range = document.createRange(); range.selectNodeContents(lab.firstChild); const t = range.getBoundingClientRect(); const m = __r(lab.querySelector('.field__req')); const lc = __r('#t-lc'), cn = __r('#t-cnt'); return { gap: m.x - t.right, labR: lc.r, cntR: cn.r }; });
    ok(rq.gap >= -1 && rq.gap < 10, '8 required marker "*" sits right after the label text', rq);
    ok(Math.abs(rq.labR - rq.cntR) < 1, '8 .field__counter stays right-aligned', rq);

    /* 10. index-num total contrast (light + dark context) */
    const idx = await page.evaluate(() => { const s = document.querySelector('#t-idx > span'); const light = __contrast(s); const sec = document.createElement('section'); sec.className = 'section--dark'; sec.innerHTML = '<span class="index-num">02 <span>/ 06</span></span>'; document.querySelector('main').appendChild(sec); const dark = __contrast(sec.querySelector('.index-num > span')); sec.className = 'section--graphite'; const graphite = __contrast(sec.querySelector('.index-num > span')); sec.remove(); return { light: +light.toFixed(2), dark: +dark.toFixed(2), graphite: +graphite.toFixed(2) }; });
    ok(idx.light >= 4.5 && idx.dark >= 4.5 && idx.graphite >= 4.5, '10 .index-num "/ 06" total meets AA (≥ 4.5:1) on paper, black and graphite', idx);

    /* 11. empty [data-accordion] / .split-lines filled later */
    const acc = await page.evaluate(async () => {
      const a = document.getElementById('t-acc');
      a.innerHTML = '<div class="accordion__item"><h3><button class="accordion__trigger" aria-expanded="false">Satu?</button></h3><div class="accordion__panel" hidden><p>1</p></div></div><div class="accordion__item"><h3><button class="accordion__trigger" aria-expanded="false">Dua?</button></h3><div class="accordion__panel" hidden><p>2</p></div></div>';
      PPAPI.ui.reveal(a);
      const t = a.querySelectorAll('.accordion__trigger'), p = a.querySelectorAll('.accordion__panel');
      t[0].click(); const s1 = [t[0].getAttribute('aria-expanded'), p[0].hidden];
      t[1].click(); const s2 = [t[0].getAttribute('aria-expanded'), t[1].getAttribute('aria-expanded')];
      /* second one: filled WITHOUT a reveal() call → safety net */
      const b = document.getElementById('t-acc2');
      b.innerHTML = '<div class="accordion__item"><button class="accordion__trigger" aria-expanded="false">Tiga?</button><div class="accordion__panel" hidden><p>3</p></div></div>';
      await new Promise(r => setTimeout(r, 60));
      const tb = b.querySelector('.accordion__trigger'); tb.click();
      /* add one more item to the first accordion later */
      a.insertAdjacentHTML('beforeend', '<div class="accordion__item"><h3><button class="accordion__trigger" aria-expanded="false">Empat?</button></h3><div class="accordion__panel" hidden><p>4</p></div></div>');
      await new Promise(r => setTimeout(r, 60));
      const t3 = a.querySelectorAll('.accordion__trigger')[2]; t3.click();
      return { s1, s2, ctrl: t[0].getAttribute('aria-controls') === p[0].id, icon: !!t[0].querySelector('.accordion__icon'), auto: [tb.getAttribute('aria-expanded'), !!tb.getAttribute('aria-controls')], late: [t3.getAttribute('aria-expanded'), t[1].getAttribute('aria-expanded')] };
    });
    ok(acc.ctrl && acc.icon && acc.s1[0] === 'true' && acc.s1[1] === false && acc.s2[0] === 'false' && acc.s2[1] === 'true', '11 [data-accordion] empty at load → filled + ui.reveal() works (single mode)', acc);
    ok(acc.auto[0] === 'true' && acc.auto[1], '11 [data-accordion] filled later WITHOUT reveal() is wired by the safety net', acc);
    ok(acc.late[0] === 'true' && acc.late[1] === 'false', '11 item appended to an existing accordion joins it (single mode closes the others)', acc);
    const sp = await page.evaluate(async () => { const h = document.getElementById('t-split'); h.innerHTML = 'Baris satu<br>baris <em>dua</em>'; await new Promise(r => setTimeout(r, 80)); h.scrollIntoView({ block: 'center' }); await new Promise(r => setTimeout(r, 400)); return { lines: h.querySelectorAll('.line').length, vis: h.classList.contains('is-visible'), em: !!h.querySelector('.line em') }; });
    ok(sp.lines === 2 && sp.vis && sp.em, '11 .split-lines empty at load → split into lines and revealed when filled later', sp);

    /* 12. skip link shadow */
    const sk = await page.evaluate(() => getComputedStyle(document.querySelector('.skip-link')).boxShadow);
    await page.evaluate(() => { window.scrollTo(0, 0); document.querySelector('.skip-link').focus(); });
    const sk2 = await page.evaluate(() => ({ focused: document.activeElement.classList.contains('skip-link'), shadow: getComputedStyle(document.querySelector('.skip-link')).boxShadow }));
    ok(sk === 'none' && sk2.focused && sk2.shadow !== 'none', '12 .skip-link has no shadow while hidden, shadow when focused', { sk, sk2 });

    /* 13. rating: arrow keys follow the visual order; inputs over their stars; hover/click intact */
    const rr = await page.evaluate(() => [...document.querySelectorAll('#t-rate > input')].map(i => { const a = __r(i), b = __r(document.querySelector('label[for="' + i.id + '"]')); return Math.max(Math.abs(a.x - b.x), Math.abs(a.w - b.w), Math.abs(a.y - b.y)); }));
    ok(rr.every(d => d < 1), '13 rating: each native radio lies over its own star', rr);
    await page.click('label[for="r3"]');
    await page.evaluate(() => { window.__chg = 0; document.getElementById('t-rate').addEventListener('change', () => window.__chg++); });
    await page.focus('#r3'); await page.keyboard.press('ArrowRight');
    const k1 = await page.evaluate(() => ({ v: document.querySelector('#t-rate input:checked').value, f: document.activeElement.id, chg: window.__chg }));
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('ArrowLeft');
    const k2 = await page.evaluate(() => document.querySelector('#t-rate input:checked').value);
    await page.keyboard.press('ArrowUp');
    const k3 = await page.evaluate(() => document.querySelector('#t-rate input:checked').value);
    const pos = await page.evaluate(() => ({ x3: __r('label[for="r3"]').x, x4: __r('label[for="r4"]').x }));
    ok(pos.x4 > pos.x3 && k1.v === '4' && k1.f === 'r4' && k1.chg === 1 && k2 === '2', '13 rating: → selects the star to the RIGHT (higher), ← to the left; change event fires', { k1, k2, pos });
    ok(k3 === '3', '13 rating: ↑ keeps the native "up = more" behaviour', k3);
    if (!vp.isMobile) {
      await page.hover('label[for="r4"]'); await page.waitForTimeout(400);
      const hv = await page.evaluate(() => ['r1', 'r2', 'r3', 'r4', 'r5'].map(id => getComputedStyle(document.querySelector('label[for="' + id + '"]')).color));
      ok(hv[0] === hv[3] && hv[3] !== hv[4], '13 rating: hover fill (label:hover ~ label) still works', hv);
    }

    /* 14. date range */
    const db = await page.evaluate(() => { const b = document.getElementById('t-db'), d = b.querySelector('.date-block__day'); const lh = parseFloat(getComputedStyle(d).lineHeight) || parseFloat(getComputedStyle(d).fontSize); return { range: b.classList.contains('date-block--range'), h: __r(d).h, lh, over: d.scrollWidth - d.clientWidth, ws: getComputedStyle(d).whiteSpace }; });
    ok(db.range && db.ws === 'nowrap' && db.h < db.lh * 1.5 && db.over <= 0, '14 date-block "21–23" → --range added automatically, one line, no overflow', db);

    /* 15. breadcrumb ellipsis */
    const bc = await page.evaluate(() => ['#t-bc', '#t-bc2'].map(sel => { const nav = document.querySelector(sel), li = nav.querySelector('li[aria-current]'); const el = li.firstElementChild && !li.firstElementChild.classList.contains('sr-only') ? li.firstElementChild : li; const cs = getComputedStyle(el); return { to: cs.textOverflow, cut: el.scrollWidth > el.clientWidth, liR: __r(li).r, olR: __r(nav.querySelector('ol')).r, oneLine: __r(li).h < 40 }; }));
    ok(bc.every(b => b.to === 'ellipsis' && b.cut && b.liR <= b.olR + 0.5 && b.oneLine), '15 breadcrumb: long current title (plain or wrapped in a span) ends in an ellipsis within the row', bc);

    /* 16. table group header wraps */
    if (!vp.isMobile) {
      const th = await page.evaluate(() => { const t = document.getElementById('t-thg'); const cs = getComputedStyle(t); return { ws: cs.whiteSpace, tableW: __r('#t-table').w, wrapW: __r(document.querySelector('#t-table').parentElement).w }; });
      ok(th.ws === 'normal' && th.tableW <= th.wrapW + 0.5, '16 table: th[colspan] group header wraps instead of widening the table', th);
    }

    /* 17. siteUrl + canonical */
    const su = await page.evaluate(() => {
      const U = PPAPI.util; const r = {};
      r.empty = U.siteUrl('verifikasi.html?kta=PPAPI-2026-000123');
      r.canon = (document.querySelector('link[rel="canonical"]') || {}).href || null;
      r.ogUrl = (document.querySelector('meta[property="og:url"]') || {}).content || null;
      r.ogImg = document.querySelector('meta[property="og:image"]').content;
      const keep = PPAPI.config.siteUrl;
      PPAPI.config.siteUrl = 'https://contoh.github.io/ppapi'; r.set = U.siteUrl('verifikasi.html?kta=X'); r.setLead = U.siteUrl('/agenda.html');
      PPAPI.config.siteUrl = 'contoh.github.io/ppapi/'; r.noScheme = U.siteUrl('a.html');
      PPAPI.config.siteUrl = 'javascript:alert(1)'; r.bad = U.siteUrl('a.html');
      PPAPI.config.siteUrl = keep;
      return r;
    });
    ok(su.empty === `${BASE}/verifikasi.html?kta=PPAPI-2026-000123`, '17 util.siteUrl falls back to the current address when config.siteUrl is empty', su);
    ok(su.canon === `${BASE}/__fixes.html` && su.ogUrl === su.canon && su.ogImg === `${BASE}/assets/img/og-image.jpg`, '17 canonical + og:url (+ absolute og:image) fall back to the current address', su);
    ok(su.set === 'https://contoh.github.io/ppapi/verifikasi.html?kta=X' && su.setLead === 'https://contoh.github.io/ppapi/agenda.html' && su.noScheme === 'https://contoh.github.io/ppapi/a.html' && su.bad === `${BASE}/a.html`, '17 siteUrl set → used as base (repo subfolder kept); invalid value → location fallback', su);

    ok(errs.length === 0, 'no console errors/warnings or page errors', errs);
    await ctx.close();
  }

  /* config + robots.txt */
  const cfg = fs.readFileSync(path.join(ROOT, 'assets/js/config.js'), 'utf8');
  ok(/siteUrl:\s*''/.test(cfg) && /isi dengan alamat situs setelah online/i.test(cfg) && /https:\/\/<user>\.github\.io\/<repo>\//.test(cfg), '17 config.js: siteUrl present, empty by default, with Indonesian instructions');
  const rb = await (await fetch(`${BASE}/robots.txt`)).text().catch(() => '');
  /* 2026-10-09: no Disallow lines any more — a blocked page cannot show its noindex to crawlers, and
     "/*anggota.html" also matched keanggotaan.html. The members/styleguide pages carry meta noindex. */
  const rbRules = rb.split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const noindex = ['dashboard', 'anggota', 'styleguide'].every(p => /<meta name="robots" content="noindex/.test(fs.readFileSync(path.join(ROOT, p + '.html'), 'utf8')));
  /* later on 2026-10-09: Disallow only for NON-HTML support files (README.md, aplikasi/*.md, firestore.rules),
     which cannot carry a noindex tag — never for a page */
  const dis = rbRules.filter(l => /^Disallow:/i.test(l)).map(l => l.replace(/^Disallow:\s*/i, ''));
  ok(/^User-agent: \*$/m.test(rb) && /^Allow: \/$/m.test(rb) && dis.every(d => /(\.md\$?|\.rules)$/.test(d)) && dis.includes('/README.md') && dis.includes('/firestore.rules') && !rbRules.some(l => /^Sitemap:/i.test(l)) && noindex, 'robots.txt: allow all pages (noindex pages stay crawlable), Disallow only README / notes / rules, no sitemap yet; dashboard/anggota/styleguide carry meta noindex', dis);
} catch (err) {
  failed++; process.exitCode = 1; console.error(err);
} finally {
  await browser.close();
  server.close();
}
console.log(`\n${passed} passed, ${failed} failed.`);
