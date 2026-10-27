// Beranda (index.html) interaction flow — v2 (membership lifecycle, managed content, knowledge products, member apps).
// Run from devtools/:  node flows/beranda-flow.mjs
// Verifies data rendering, session-dependent CTAs / app buttons / knowledge access / membership track for every
// membership status (+ admin, live refresh and sign-out), admin-managed content (store.content.list), the
// "Produk Pengetahuan" tiles, links, a11y basics, motion (counters / split lines), marquee, escaping, store
// failure fallback, and layout at several widths.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
fs.mkdirSync(SHOTS, { recursive: true });

const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'content-type': 'text/html' }); return res.end('<!doctype html><title>404</title>Not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const U = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
function member(status, extra = {}) {
  const m = { uid: U.uid, name: U.name, email: U.email, phone: U.phone, kta: '', memberType: 'Praktisi', status, joinedAt: '2026-03-14', validUntil: '',
    application: { type: 'baru', kategori: 'Praktisi', submittedAt: '' }, review: { note: '', history: [] }, profile: {}, competencies: [], certificates: [] };
  if (status === 'Aktif' || status === 'Kedaluwarsa' || status === 'Nonaktif') { m.kta = 'PPAPI-2026-004821'; m.validUntil = '2029-12-31'; m.application.submittedAt = '2026-03-15T02:00:00.000Z'; }
  if (status === 'Kedaluwarsa') { m.status = 'Aktif'; m.validUntil = '2026-06-30'; }
  if (['Menunggu Verifikasi', 'Perlu Perbaikan', 'Ditolak'].includes(status)) m.application.submittedAt = '2026-10-01T02:00:00.000Z';
  return Object.assign(m, extra);
}

let pass = 0, fail = 0;
const ok = (cond, msg, extra) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } };

const browser = await chromium.launch();
// Freeze "today" at 2026-10-08 10:00 WIB so agenda/date assertions are stable.
const CLOCK = new Date('2026-10-08T10:00:00+07:00');
const APP_STUB = '<!doctype html><html lang="id"><title>Aplikasi (stub)</title><body>stub</body></html>';

async function newCtx(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: opts.w || 1440, height: opts.h || 900 }, isMobile: !!opts.mobile, hasTouch: !!opts.mobile, reducedMotion: opts.motion ? 'no-preference' : 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  if (!opts.motion) await ctx.clock.setFixedTime(CLOCK);
  if (opts.user) {
    await ctx.addInitScript(({ u, m, admin }) => {
      try {
        if (sessionStorage.getItem('__seeded')) return;
        sessionStorage.setItem('__seeded', '1');
        localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
        if (m) localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
        if (admin) localStorage.setItem('ppapi_demo_admins', JSON.stringify([u.uid]));
      } catch (e) {}
    }, { u: opts.user, m: opts.member || null, admin: !!opts.admin });
  }
  if (opts.seed) await ctx.addInitScript(opts.seed.fn, opts.seed.arg);
  // the member apps are built by another agent: stub them so same-tab navigation can be asserted either way
  await ctx.route(/\/aplikasi\/(perencanaan|simulator)\/index\.html/, r => r.fulfill({ status: 200, contentType: 'text/html', body: APP_STUB }));
  return ctx;
}
async function newPage(ctx, errors, allow = []) {
  const page = await ctx.newPage();
  page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !allow.some(re => re.test(m.text()))) errors.push(`console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE) && !/masuk\.html|dashboard\.html|anggota\.html|pendaftaran\.html|pustaka\.html|aplikasi\//.test(r.url())) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss().catch(() => {}); });
  return page;
}
const settle = page => page.waitForFunction(() => document.querySelectorAll('#pk-grid .home-pk__tile').length > 0 && !document.querySelector('#news-list .skeleton'), null, { timeout: 5000 }).catch(() => {});

/* snapshot of every session-dependent element */
const sessionSnap = page => page.evaluate(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  return {
    hero: [$('.home-hero [data-cta-join]').getAttribute('href'), $('.home-hero [data-cta-join]').textContent.trim()],
    cta: [$('.home-cta [data-cta-join]').getAttribute('href'), $('.home-cta [data-cta-join]').textContent.trim()],
    guestLine: !$('[data-guest-only]').hidden,
    apps: $$('#apps-cards .home-app__btn').map(a => ({ href: a.getAttribute('href'), target: a.getAttribute('target'), name: a.textContent.trim() })),
    appsAccess: $$('#apps-cards .home-app__access').map(p => p.textContent.trim()),
    appsLocked: $$('#apps-cards .home-app.is-locked').length,
    pkAccess: $('#pk-access').textContent.trim(), pkOpen: $('#pk-access').classList.contains('is-open'),
    pkActions: $$('#pk-actions a').map(a => [a.getAttribute('href'), a.textContent.trim()]),
    trackLabel: $('#cta-track-label').textContent.trim(),
    track: $$('#cta-track .status-track__step').map(li => (li.className.replace('status-track__step', '').trim() || '-') + (li.getAttribute('aria-current') ? '*' : '')),
    trackMeta: $$('#cta-track .status-track__meta').map(m => m.textContent.trim()),
    personal: $('#cta-track-wrap').classList.contains('is-personal'),
  };
});

/* ------------------------------------------------------------------ */
console.log('\n[1] Pengunjung (belum masuk), reduced motion, desktop 1440');
{
  const ctx = await newCtx();
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.waitForTimeout(200);

  const info = await page.evaluate(() => {
    const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
    const heroImg = $('.home-hero img');
    const heads = $$('main h1, main h2, main h3, main h4').filter(e => e.offsetParent !== null).map(e => +e.tagName[1]);
    let jump = null; for (let i = 1; i < heads.length; i++) if (heads[i] - heads[i - 1] > 1) { jump = [i, heads[i - 1], heads[i]]; break; }
    return {
      page: document.body.dataset.page, auth: document.body.dataset.auth, header: document.body.dataset.header || null,
      desc: $('meta[name="description"]').content,
      pustakaScript: !!$('script[src="assets/data/pustaka.js"]'),
      h1: $$('h1').length, h1Lines: $$('.home-hero__title .line').length, h1Text: $('.home-hero__title').textContent.replace(/\s+/g, ' ').trim(),
      heroImg: heroImg && { prio: heroImg.getAttribute('fetchpriority'), lazy: heroImg.getAttribute('loading'), srcset: heroImg.getAttribute('srcset'), complete: heroImg.complete && heroImg.naturalWidth > 0 },
      scaffold: !!$('.home-hero .scaffold-draw'), scaffoldLines: $$('.home-hero .scaffold-draw .sd-line').length,
      ghost: $('.home-hero .btn--ghost').getAttribute('href'), cue: $('.home-hero__cue').getAttribute('href'),
      index: $$('.home-hero__index li').map(li => li.textContent.replace(/\s+/g, ' ').trim()),
      eyebrows: $$('main section .section-head .eyebrow, .home-about__text > .eyebrow, .home-reg__intro > .eyebrow').filter(e => !e.closest('section').hidden).map(e => e.textContent.replace(/\s+/g, ' ').trim()),
      marqueeReady: $('.home-marquee .marquee').hasAttribute('data-marquee-ready'),
      marqueeClonesHidden: $$('.home-marquee .marquee__item[aria-hidden="true"]').length,
      marqueeWords: $$('.home-marquee .marquee__item:not([aria-hidden])').map(e => e.textContent.trim().toUpperCase()),
      tentang: $$('#tentang-body p').length,
      stats: $$('#home-stats-grid .stat').map(s => ($('.sr-only', s) || $('.stat__num', s)).textContent.trim()),
      pilar: $$('#pilar-grid .feature').map(f => $('.index-num', f).textContent.replace(/\s+/g, ' ').trim()),
      pk: $$('#pk-grid .home-pk__tile').map(t => ({ kat: t.dataset.kategori, name: $('.home-pk__name', t).textContent.trim(), href: $('.home-pk__name a', t).getAttribute('href'), count: $('.home-pk__count', t).textContent.trim(), contoh: $$('.badge--contoh', t).filter(b => b.offsetParent !== null).length === 1 ? true : ($$('.badge--contoh', t).length ? 'dup' : false), dark: t.classList.contains('home-pk__tile--dark'), num: $('.index-num', t).textContent.replace(/\s+/g, ' ').trim(), icon: !!$('.home-pk__icon svg', t), desc: $('.home-pk__desc', t).textContent.trim().length })),
      pkList: $('#pk-grid').tagName + '/' + $('#pk-grid').getAttribute('role') + '/' + $$('#pk-grid > li').length,
      apps: $$('#apps-cards .home-app').map(c => ({ title: $('.home-app__title', c).textContent.trim(), fitur: $$('.home-app__fitur li', c).length, icon: !!$('.home-app__icon svg', c) })),
      appsLead: $('#apps-lead').textContent.replace(/\s+/g, ' ').trim(),
      appNote: !$('#apps-note').hidden && $('#apps-note').textContent.trim(),
      news: $$('#news-list .news-card').map(n => ({ href: $('.news-card__title a', n).getAttribute('href'), contoh: !!$('.badge--contoh', n), img: !!$('img.img-mono', n) })),
      kgHidden: $('#kegiatan').hidden, agendaCard: !!$('.home-agenda, #agenda-list'),

      reg: $$('#reg-list .home-reg__item').map(li => ({ code: $('.home-reg__code', li).textContent, href: $('a', li).getAttribute('href'), badge: !!$('.badge', li) })),
      regText: $('#reg-text').textContent,
      regLinks: $$('.home-reg__actions a').map(a => a.getAttribute('href')),
      gallery: $$('.home-gallery__item').map(f => ({ alt: $('img', f).getAttribute('alt'), cap: $('figcaption', f).textContent.trim() })),
      ctaTitle: $('#cta-title').textContent.replace(/\s+/g, ' ').trim(),
      ctaVerify: $('.home-cta .btn--ghost').getAttribute('href'),
      imgsNoAlt: $$('main img').filter(i => !i.hasAttribute('alt')).length,
      imgsNoSize: $$('main img').filter(i => !i.getAttribute('width') || !i.getAttribute('height')).length,
      lazyBelow: $$('main img').filter(i => i.closest('.home-hero') === null && i.getAttribute('loading') !== 'lazy').map(i => i.src),
      headingJump: jump,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  const s = await sessionSnap(page);
  ok(info.page === 'beranda' && info.auth === 'public' && info.header === null, 'body data-page="beranda", data-auth="public", default (overlay) header', info);
  ok(/produk pengetahuan/.test(info.desc) && info.desc.length >= 140 && info.desc.length <= 160 && info.pustakaScript, 'meta description (140–160 chars) mentions produk pengetahuan; pustaka.js data loaded', [info.desc.length, info.pustakaScript]);
  ok(info.h1 === 1 && info.h1Lines === 3, 'exactly one h1, split into 3 lines', { h1: info.h1, lines: info.h1Lines });
  ok(/Membangun standar, menjaga keselamatan di setiap ketinggian\./.test(info.h1Text), 'hero headline copy', info.h1Text);
  ok(info.heroImg && info.heroImg.prio === 'high' && !info.heroImg.lazy && /stage-silhouette-sm\.webp 480w/.test(info.heroImg.srcset) && info.heroImg.complete, 'hero image eager + fetchpriority=high + -sm srcset, loaded', info.heroImg);
  ok(info.scaffold && info.scaffoldLines > 8, 'scaffold SVG drawn over hero', info.scaffoldLines);
  ok(s.hero[0] === 'masuk.html?next=pendaftaran.html#daftar' && s.hero[1] === 'Bergabung Menjadi Anggota' && info.ghost === 'profil.html', 'hero CTAs (guest): Bergabung → masuk.html?next=pendaftaran.html#daftar, Kenali → profil.html', s.hero);
  ok(info.cue === '#tentang' && info.index.join('|') === '01 Kompetensi|02 Keselamatan|03 Integritas', 'scroll cue + 3-word index row', info.index);
  ok(info.eyebrows.join('|') === '01 — Tentang PPAPI|02 — Pilar Layanan|03 — Produk Pengetahuan|04 — Aplikasi Anggota|05 — Kabar Terkini|06 — Regulasi & Standar|07 — Galeri', 'section numbering 01–07 incl. Produk Pengetahuan + Aplikasi Anggota', info.eyebrows);
  ok(info.marqueeReady && info.marqueeClonesHidden > 0 && info.marqueeWords.join(' ') === 'KESELAMATAN KOMPETENSI INTEGRITAS PROFESIONALISME STANDAR KOLABORASI', 'marquee ready, clones aria-hidden, 6 values', info.marqueeWords);
  ok(info.tentang === 2, 'Tentang: 2 paragraphs from organisasi.tentang');
  ok(info.stats.join(',') === '28,16,9,10', 'stats row shows final counter values (reduced motion)', info.stats);
  ok(info.pilar.length === 6 && info.pilar[0] === '01 / 06' && info.pilar[5] === '06 / 06', 'Pilar: 6 numbered features', info.pilar);

  // Produk Pengetahuan tiles
  const kats = ['Standar', 'Code of Practice', 'Peraturan Perundangan', 'Petunjuk Teknis', 'Modul Pelatihan', 'Formulir & Daftar Periksa', 'Kajian Teknis', 'Aplikasi'];
  ok(info.pkList === 'UL/list/8' && info.pk.map(t => t.kat).join('|') === kats.join('|'), 'Produk Pengetahuan: 8 category tiles in a list, standard order', info.pk.map(t => t.kat));
  const slugs = ['standar', 'code-of-practice', 'peraturan-perundangan', 'petunjuk-teknis', 'modul-pelatihan', 'formulir-dan-daftar-periksa', 'kajian-teknis'];
  ok(info.pk.every((t, i) => t.href === (i === 7 ? 'pustaka.html#aplikasi' : 'pustaka.html?kategori=' + slugs[i] + '#katalog')), 'tiles link to pustaka.html?kategori=<slug>#katalog (apps → pustaka.html#aplikasi), same URLs as pustaka.html', info.pk.map(t => t.href));
  ok(info.pk.map(t => t.count).join('|') === '9 dokumen|Segera tersedia|19 regulasi|Segera tersedia|Segera tersedia|Segera tersedia|Segera tersedia|2 aplikasi', 'tile counts grouped like pustaka.html (9 SNI + standar internasional under Standar; empty PPAPI collections say "Segera tersedia")', info.pk.map(t => t.count));
  ok(info.pk.map(t => t.contoh === true ? 'c' : t.contoh === 'dup' ? '!' : '-').join('') === '--------', 'no Contoh badge on any tile (sample documents removed 2026-10-15)', info.pk.map(t => t.contoh));
  ok(info.pk[4].name === 'Modul & Panduan Pelatihan' && info.pk[7].name === 'Aplikasi Anggota' && info.pk[7].dark && info.pk.filter(t => t.dark).length === 1, 'labels "Modul & Panduan Pelatihan" / "Aplikasi Anggota"; the app tile is the dark plate');
  ok(info.pk.every((t, i) => t.num === String(i + 1).padStart(2, '0') + ' / 08' && t.icon && t.desc > 20), 'tiles numbered 01 / 08 … with icon + description');
  ok(/Katalog terbuka untuk umum/.test(s.pkAccess) && !s.pkOpen && s.pkActions.length === 2 && s.pkActions[0][0] === 'pustaka.html' && /Jelajahi Produk Pengetahuan/.test(s.pkActions[0][1]) && s.pkActions[1][0] === 'masuk.html?next=pendaftaran.html#daftar' && s.pkActions[1][1] === 'Daftar Anggota', 'knowledge access note (guest) + Jelajahi → pustaka.html, Daftar Anggota', s);

  // Apps
  // client rule 2026-10-10: the planning app title carries "(Beta)" (intentional change)
  ok(info.apps.length === 2 && info.apps[0].title === 'PPAPI Scaffold (Beta) — Perencanaan & Analisis Struktur' && info.apps[1].title === 'Simulator Pemasangan Perancah Tube & Coupler' && info.apps.every(a => a.fitur === 4 && a.icon), 'Apps: the two internal member apps from config.apps, 4 features each', info.apps);
  ok(/Dua aplikasi milik PPAPI/.test(info.appsLead), 'apps lead copy', info.appsLead);
  ok(s.apps.length === 2 && s.apps[0].href === 'masuk.html?next=aplikasi%2Fperencanaan%2Findex.html' && s.apps[1].href === 'masuk.html?next=aplikasi%2Fsimulator%2Findex.html' && s.apps.every(l => !l.target && /^Masuk untuk mengakses/.test(l.name)), 'Apps (guest): "Masuk untuk mengakses" → masuk.html?next=<app path>', s.apps);
  ok(s.appsAccess.every(t => t === 'Khusus anggota berstatus Aktif') && s.appsLocked === 2, 'Apps (guest): locked access line', s.appsAccess);
  ok(info.appNote && /Aktif/.test(info.appNote), 'apps note (config.appNote) shown');

  ok(info.news.length === 4 && info.news.every(n => /^berita\.html\?id=[a-z0-9-]+$/.test(n.href) && !n.contoh && n.img), '4 latest news (full-width layout) → berita.html?id=…, no Contoh badge (editorial articles), mono image', info.news);
  ok(info.news[0].href === 'berita.html?id=kerangka-hukum-pekerjaan-perancah-indonesia', 'newest berita (sorotan) is first');
  ok(info.kgHidden && !info.agendaCard, '2026-10-27: no published kegiatan → Kegiatan Terbaru hidden (numbering skips it); Agenda Terdekat card removed', [info.kgHidden, info.agendaCard]);
  ok(info.reg.length === 4 && info.reg[0].code === 'UU 1/1970' && info.reg.every(r => r.href.startsWith('regulasi.html?q=') && r.badge), 'Regulasi: 4 kunci rows → regulasi.html?q=…', info.reg);
  ok(/memuat 28 peraturan/.test(info.regText) && info.regLinks.join('|') === 'regulasi.html|pustaka.html?kategori=peraturan-perundangan#katalog', 'regulasi count from data + links to regulasi.html and Produk Pengetahuan', [info.regText, info.regLinks]);
  ok(info.gallery.length === 4 && info.gallery.every(g => g.alt && g.cap), 'Galeri: 4 images with alt + captions');
  ok(s.cta[0] === 'masuk.html?next=pendaftaran.html#daftar' && s.cta[1] === 'Mulai Pendaftaran' && info.ctaVerify === 'verifikasi.html' && s.guestLine, 'CTA band: "Mulai Pendaftaran" → masuk.html?next=pendaftaran.html#daftar, Verifikasi Anggota, guest login line', s.cta);
  ok(s.track.join(',') === '-,-,-,-,-' && !s.personal && s.trackLabel === 'Alur pendaftaran anggota' && s.trackMeta.length === 0, 'membership track: 5 neutral steps for visitors', s.track);
  const trackLabels = await page.$$eval('#cta-track .status-track__label', ls => ls.map(l => l.textContent.replace(/^\d+/, '').trim()));
  ok(trackLabels.join('|') === 'Buat akun|Isi formulir pendaftaran|Verifikasi sekretariat|Aktif & KTA digital|Akses fitur anggota', 'track labels from organisasi.keanggotaan.langkah', trackLabels);
  ok(info.imgsNoAlt === 0 && info.imgsNoSize === 0, 'all images have alt + width/height');
  ok(info.lazyBelow.length === 0, 'all non-hero images lazy', info.lazyBelow);
  ok(info.headingJump === null, 'heading levels never skip', info.headingJump);
  ok(info.overflow <= 1, 'no horizontal overflow @1440', info.overflow);

  // keyboard: skip link, tile focus ring
  await page.keyboard.press('Tab');
  const skip = await page.evaluate(() => document.activeElement && document.activeElement.className);
  ok(/skip-link/.test(skip), 'first Tab focuses the skip link', skip);
  await page.focus('#pk-grid .home-pk__name a');
  const ring = await page.evaluate(() => getComputedStyle(document.querySelector('#pk-grid .home-pk__tile')).outlineStyle);
  ok(ring === 'solid', 'keyboard focus on a tile link draws the tile focus ring (:focus-within)', ring);

  // scroll cue jumps to #tentang
  await page.click('.home-hero__cue');
  await page.waitForTimeout(300);
  const top = await page.evaluate(() => Math.round(document.getElementById('tentang').getBoundingClientRect().top));
  ok(top >= 0 && top < 140, 'scroll cue brings #tentang into view', top);

  // whole tile is clickable (stretched link)
  await page.locator('#pk-grid .home-pk__tile').nth(1).scrollIntoViewIfNeeded();
  await page.waitForTimeout(100);
  const box = await page.locator('#pk-grid .home-pk__tile').nth(1).boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 12);
  await page.waitForURL(/pustaka\.html/);
  /* release QA: the #fragment is put back after the catalogue has rendered (core.js deferredHashScroll) */
  await page.waitForURL(u => u.href.endsWith('/pustaka.html?kategori=code-of-practice#katalog'), { timeout: 5000 }).catch(() => {});
  ok(page.url().endsWith('/pustaka.html?kategori=code-of-practice#katalog'), 'clicking anywhere on a tile opens pustaka.html?kategori=…', page.url());
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });

  // app CTA (guest) navigates to login with next=
  await page.locator('#apps-cards .home-app__btn').first().click();
  await page.waitForURL(/masuk\.html/);
  ok(page.url().endsWith('/masuk.html?next=aplikasi%2Fperencanaan%2Findex.html'), 'guest app button → masuk.html?next=aplikasi%2Fperencanaan%2Findex.html', page.url());
  ok(errors.length === 0, 'no console/page errors', errors);
  await ctx.close();
}

/* ------------------------------------------------------------------ */
console.log('\n[2] Masuk — setiap status keanggotaan');
const EXPECT = {
  'Draf': { step: ['pendaftaran.html', 'Lengkapi Pendaftaran'], track: 'is-done,is-current*,-,-,-', meta: 'Belum diajukan' },
  'Menunggu Verifikasi': { step: ['dashboard.html', 'Lihat Status Pendaftaran'], track: 'is-done,is-done,is-current*,-,-', meta: 'Sedang diverifikasi' },
  'Perlu Perbaikan': { step: ['pendaftaran.html', 'Perbaiki Pengajuan'], track: 'is-done,is-warn*,-,-,-', meta: 'Perlu perbaikan' },
  'Ditolak': { step: ['pendaftaran.html', 'Ajukan Ulang'], track: 'is-done,is-done,is-error*,-,-', meta: 'Pengajuan ditolak' },
  'Kedaluwarsa': { step: ['pendaftaran.html', 'Ajukan Perpanjangan'], track: 'is-done,is-done,is-done,is-warn*,-', meta: 'Masa berlaku habis' },
  'Nonaktif': { step: ['pendaftaran.html', 'Ajukan Perpanjangan'], track: 'is-done,is-done,is-done,is-error*,-', meta: 'Keanggotaan dinonaktifkan' },
};
for (const [status, ex] of Object.entries(EXPECT)) {
  const ctx = await newCtx({ user: U, member: member(status) });
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await settle(page);
  const s = await sessionSnap(page);
  const eff = await page.evaluate(() => PPAPI.session.current().status);
  ok(eff === status, `${status}: session effective status`, eff);
  ok(s.hero.join('|') === ex.step.join('|') && s.cta.join('|') === ex.step.join('|') && !s.guestLine, `${status}: hero + CTA band → "${ex.step[1]}" (${ex.step[0]}), guest line hidden`, [s.hero, s.cta]);
  ok(s.apps.length === 2 && s.apps.every(a => a.href === ex.step[0] && !a.target && a.name.startsWith(ex.step[1] + ' untuk membuka')) && s.appsLocked === 2 && s.appsAccess.every(t => t === 'Terbuka setelah keanggotaan Aktif'), `${status}: app buttons locked → next membership step`, s.apps);
  ok(!s.pkOpen && /khusus anggota berstatus Aktif/.test(s.pkAccess) && s.pkActions.length === 2 && s.pkActions[1].join('|') === ex.step.join('|'), `${status}: knowledge access locked + "${ex.step[1]}"`, s.pkActions);
  ok(s.personal && s.trackLabel === 'Posisi pendaftaran Anda' && s.track.join(',') === ex.track && s.trackMeta.join('|') === ex.meta, `${status}: personal membership track ${ex.track}`, [s.track, s.trackMeta]);
  const sr = await page.$$eval('#cta-track .status-track__label .sr-only', e => e.map(x => x.textContent.trim()));
  ok(sr.includes('(tahap Anda saat ini)') && sr.filter(t => t === '(selesai)').length === ex.track.split('is-done').length - 1, `${status}: track states announced to screen readers`, sr);
  ok(errors.length === 0, `${status}: no console/page errors`, errors);
  await ctx.close();
}

console.log('\n[3] Anggota Aktif → aplikasi terbuka (tab yang sama), lalu perubahan status langsung');
{
  const ctx = await newCtx({ user: U, member: member('Aktif') });
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await settle(page);
  let s = await sessionSnap(page);
  ok(s.hero.join('|') === 'dashboard.html|Buka Dasbor Anggota' && s.cta.join('|') === 'dashboard.html|Buka Dasbor' && !s.guestLine, 'Aktif: hero/CTA → Buka Dasbor (Anggota)', [s.hero, s.cta]);
  ok(s.apps[0].href === 'aplikasi/perencanaan/index.html' && s.apps[1].href === 'aplikasi/simulator/index.html' && s.apps.every(a => !a.target && /^Buka Aplikasi/.test(a.name)) && s.appsLocked === 0, 'Aktif: "Buka Aplikasi" → internal app paths, same tab', s.apps);
  ok(s.appsAccess.every(t => t === 'Akses aktif · dibuka di portal anggota'), 'Aktif: access line', s.appsAccess);
  ok(s.pkOpen && /Keanggotaan Anda Aktif/.test(s.pkAccess) && s.pkActions.length === 1 && s.pkActions[0][0] === 'pustaka.html', 'Aktif: knowledge access open, single Jelajahi button', s);
  ok(s.track.join(',') === 'is-done,is-done,is-done,is-done,is-done' && s.trackLabel === 'Keanggotaan Anda Aktif', 'Aktif: all 5 membership steps done', s.track);
  await page.locator('#apps-cards .home-app__btn').nth(1).click();
  await page.waitForURL(/aplikasi\/simulator\/index\.html/);
  ok(page.url().endsWith('/aplikasi/simulator/index.html') && (await ctx.pages()).length === 1, 'Aktif: clicking opens the simulator in the same tab', page.url());

  // admin deactivates in another tab → this page refreshes the session → everything locks live
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await settle(page);
  await page.evaluate(() => { const k = 'ppapi_member_demo-uji-0001'; const m = JSON.parse(localStorage.getItem(k)); m.status = 'Nonaktif'; localStorage.setItem(k, JSON.stringify(m)); return PPAPI.session.refresh(); });
  await page.waitForTimeout(150);
  s = await sessionSnap(page);
  ok(s.apps.every(a => a.href === 'pendaftaran.html') && s.appsLocked === 2 && s.hero[1] === 'Ajukan Perpanjangan' && !s.pkOpen && s.track[3] === 'is-error*', 'session.refresh (Nonaktif) → apps, CTAs, knowledge access and track update live', s);

  // sign out on the same page → guest state restored (session.onChange)
  await page.evaluate(() => PPAPI.auth.signOut());
  await page.waitForTimeout(300);
  s = await sessionSnap(page);
  ok(s.apps.every(a => /^masuk\.html\?next=aplikasi%2F/.test(a.href)) && s.hero[0] === 'masuk.html?next=pendaftaran.html#daftar' && s.guestLine && !s.personal && s.track.every(t => t === '-'), 'after sign-out: guest CTAs, apps and neutral track restored live', s);
  ok(errors.length === 0, 'no console/page errors', errors);
  await ctx.close();
}

console.log('\n[4] Admin (status anggota pribadi Draf) → semua fitur terbuka');
{
  const ctx = await newCtx({ user: ADMIN, admin: true });
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await settle(page);
  const s = await sessionSnap(page);
  const sess = await page.evaluate(() => { const x = PPAPI.session.current(); return [x.isAdmin, x.isActive, x.isMemberActive]; });
  ok(sess.join() === 'true,true,false', 'admin session: isAdmin, isActive, not a member-active', sess);
  ok(s.apps.every(a => /^aplikasi\//.test(a.href) && /^Buka Aplikasi/.test(a.name)) && s.appsAccess.every(t => t === 'Akses admin · dibuka di portal anggota'), 'admin: apps open with "Akses admin" line', s.appsAccess);
  ok(s.pkOpen && /admin/.test(s.pkAccess) && s.hero[0] === 'dashboard.html', 'admin: knowledge access open, hero → dashboard', [s.pkAccess, s.hero]);
  ok(errors.length === 0, 'no console/page errors', errors);
  await ctx.close();
}

/* ------------------------------------------------------------------ */
console.log('\n[5] Konten kelolaan admin (store.content.list) tampil di Beranda');
{
  const seed = {
    fn: () => {
      try {
        if (sessionStorage.getItem('__content')) return;
        sessionStorage.setItem('__content', '1');
        const meta = { updatedAt: '2026-10-08T01:00:00.000Z', updatedBy: 'demo-admin-0001' };
        localStorage.setItem('ppapi_content_berita', JSON.stringify([
          Object.assign({ id: 'kabar-kelolaan-admin', judul: 'Kabar <b>Kelolaan</b> Admin', kategori: 'Organisasi', tanggal: '2026-10-08', ringkasan: 'Ringkasan berita baru dari Konsol Admin.', isi: ['Isi.'], gambar: '', penulis: 'Sekretariat', sorot: false, contoh: false }, meta),
          Object.assign({ id: 'kerangka-hukum-pekerjaan-perancah-indonesia', hidden: true }, meta),
        ]));
        localStorage.setItem('ppapi_content_agenda', JSON.stringify([
          Object.assign({ id: 'agenda-kelolaan-admin', judul: 'Rapat Teknis Kelolaan Admin', jenis: 'Rapat', mulai: '2027-03-10', selesai: '2027-03-10', waktu: '09.00 – 11.00 WIB', lokasi: 'Daring', mode: 'Daring', kuota: null, deskripsi: 'Uji.', tautanDaftar: '', contoh: false }, meta),
        ]));
        localStorage.setItem('ppapi_content_regulasi', JSON.stringify([Object.assign({ id: 'uu-1-1970', hidden: true }, meta)]));
        /* kegiatan terbit (store-kegiatan.js, Mode Demo): satu dengan flyer, satu tanpa flyer, satu draf */
        const ev = (judul, jenis, mulai, selesai, extra) => Object.assign({ judul, jenis, deskripsi: 'Deskripsi ' + judul + '.', narasumber: 'Narasumber Uji', mulaiAt: mulai, selesaiAt: selesai, mode: 'Daring', lokasi: 'Zoom', tautanDaftar: '', kuota: 50, terdaftar: 0, akses: 'semua', sertifikat: true, kode: 'WEB' + mulai.slice(5, 7) + mulai.slice(8, 10), tahun: 2026, sertSeq: 0, status: 'terbit', flyer: false }, meta, extra || {});
        localStorage.setItem('ppapi_events', JSON.stringify({
          'kg-webinar-uji': ev('Webinar <i>Uji</i> Flyer', 'Webinar', '2026-10-20T02:00:00.000Z', '2026-10-20T05:00:00.000Z', { flyer: true }),
          'kg-pelatihan-uji': ev('Pelatihan Uji Tanpa Flyer', 'Pelatihan', '2026-11-05T02:00:00.000Z', '2026-11-05T05:00:00.000Z'),
          'kg-draf-uji': ev('Kegiatan Draf', 'Seminar', '2026-10-12T02:00:00.000Z', '2026-10-12T05:00:00.000Z', { status: 'draf' })
        }));
        const c = document.createElement('canvas'); c.width = 400; c.height = 500;
        const x = c.getContext('2d'); x.fillStyle = '#334'; x.fillRect(0, 0, 400, 500);
        localStorage.setItem('ppapi_event_flyer_kg-webinar-uji', JSON.stringify({ img: c.toDataURL('image/jpeg', 0.8), w: 400, h: 500 }));
        localStorage.setItem('ppapi_content_pustaka', JSON.stringify([
          Object.assign({ id: 'standar-baru-kelolaan', judul: 'Standar Baru', kategori: 'Standar', kode: 'PPAPI-STD-02', versi: 'Revisi 0', tanggal: '2026-10-01', status: 'Berlaku', ringkasan: 'Uji.', penyusun: 'PPAPI', format: 'PDF', halaman: '', akses: 'publik', tautan: '', tag: [], app: '', contoh: false }, meta),
        ]));
      } catch (e) {}
    },
  };
  const ctx = await newCtx({ seed });
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await settle(page);
  const regStatic = await page.evaluate(() => (PPAPI.data.regulasi || []).find(r => r.id === 'uu-1-1970') ? 'ada' : 'tidak');
  const r = await page.evaluate(() => {
    const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
    return {
      news: $$('#news-list .news-card__title a').map(a => a.getAttribute('href')),
      leadTitle: $('#news-list .news-card__title').textContent, leadBold: !!$('#news-list .news-card__title b'),
      leadFallback: !!$('#news-list .home-news__lead .home-media-fallback .scaffold-draw'), leadContoh: !!$('#news-list .home-news__lead .badge--contoh'),
      agendaCard: !!$('#agenda-list'),
      kgHidden: $('#kegiatan').hidden,
      kgFeature: ($('.home-kg__title a') || {}).getAttribute ? $('.home-kg__title a').getAttribute('href') : '',
      kgFeatureTitle: ($('.home-kg__title') || {}).textContent || '',
      kgCards: $$('.home-kg__card-title a').map(a => a.getAttribute('href')),
      kgFlyer: !!$('.home-kg__feature .home-kg__poster.has-flyer img[src^="data:image/jpeg;base64,"]'),
      eyebrows: $$('#main .eyebrow[data-sec]').filter(e => !e.closest('section').hidden).map(e => e.textContent.replace(/\s+/g, ' ').trim()),
      reg: $$('#reg-list .home-reg__code').map(e => e.textContent), regText: $('#reg-text').textContent,
      pk: $$('#pk-grid .home-pk__tile').map(t => [t.dataset.kategori, $('.home-pk__count', t).textContent.trim(), $$('.badge--contoh', t).some(b => b.offsetParent !== null)]),
    };
  });
  ok(r.news[0] === 'berita.html?id=kabar-kelolaan-admin' && !r.news.includes('berita.html?id=kerangka-hukum-pekerjaan-perancah-indonesia'), 'managed berita appears first; the hidden static berita disappears', r.news);
  ok(r.leadTitle === 'Kabar <b>Kelolaan</b> Admin' && !r.leadBold && !r.leadContoh && r.leadFallback, 'managed berita: title escaped, no Contoh badge, graphite fallback instead of a photo', r);
  ok(!r.agendaCard, '2026-10-27: Agenda Terdekat card removed from Beranda (agenda lives on agenda.html)', r.agendaCard);
  ok(!r.kgHidden && r.kgFeature === 'agenda.html?id=kg-webinar-uji' && r.kgFeatureTitle === 'Webinar <i>Uji</i> Flyer', 'Kegiatan Terbaru: nearest published kegiatan highlighted (title escaped) → agenda detail', r);
  ok(r.kgCards.length === 1 && r.kgCards[0] === 'agenda.html?id=kg-pelatihan-uji', 'Kegiatan Terbaru: next published kegiatan as a card; draf kegiatan not shown', r.kgCards);
  ok(r.kgFlyer, 'Kegiatan Terbaru: flyer image replaces the date panel', r.kgFlyer);
  ok(r.eyebrows[1] === '02 — Kegiatan Terbaru' && r.eyebrows[7] === '08 — Galeri', 'section numbering includes Kegiatan Terbaru (01–08)', r.eyebrows);
  ok(regStatic === 'ada' && !r.reg.includes('UU 1/1970') && r.reg.length === 4 && /memuat 27 peraturan/.test(r.regText), 'hidden regulation leaves the key list + count (27)', r);
  const std = r.pk.find(t => t[0] === 'Standar'), kaj = r.pk.find(t => t[0] === 'Kajian Teknis'), reg = r.pk.find(t => t[0] === 'Peraturan Perundangan');
  ok(std[1] === '10 dokumen' && std[2] === false, 'managed Standar doc counted (10 dokumen incl. 9 SNI/international standards)', std);
  ok(kaj[1] === 'Segera tersedia' && kaj[2] === false && reg[1] === '18 regulasi', 'empty Kajian Teknis → "Segera tersedia"; hidden UU → regulasi tile 18', [kaj, reg]);
  ok(errors.length === 0, 'no console/page errors', errors);
  await ctx.close();
}

/* ------------------------------------------------------------------ */
console.log('\n[6] Gerak aktif: split lines, reveal, counter, marquee');
{
  const ctx = await newCtx({ motion: true });
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2200);
  const hero = await page.evaluate(() => ({
    split: document.querySelector('.home-hero__title').classList.contains('is-visible'),
    lead: getComputedStyle(document.querySelector('.home-hero__lead')).opacity,
    kenburns: getComputedStyle(document.querySelector('.home-hero__media img')).animationName,
    marquee: getComputedStyle(document.querySelector('.home-marquee .marquee__track')).animationName,
    cue: getComputedStyle(document.querySelector('.home-hero__cue-line'), '::after').animationName,
    statsBefore: [...document.querySelectorAll('#home-stats-grid .count__value')].map(e => e.textContent),
  }));
  ok(hero.split && +hero.lead === 1, 'hero headline split-lines revealed, lead visible', hero);
  ok(hero.kenburns === 'kenburns' && hero.marquee === 'marquee' && hero.cue === 'beranda-cue', 'Ken Burns, marquee and scroll-cue animations active', hero);
  ok(hero.statsBefore.every(t => t === '0'), 'counters wait at 0 until visible', hero.statsBefore);
  await page.evaluate(() => document.getElementById('home-stats').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(2300);
  const stats = await page.evaluate(() => [...document.querySelectorAll('#home-stats-grid .count__value')].map(e => e.textContent));
  ok(stats.join(',') === '28,16,9,10', 'counters animate to final values when scrolled into view', stats);
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } });
  await page.waitForTimeout(1800);
  const hidden = await page.evaluate(() => [...document.querySelectorAll('main [data-reveal], main [data-reveal-stagger] > *')].filter(e => e.offsetParent !== null && +getComputedStyle(e).opacity < 0.99).map(e => e.className || e.tagName));
  ok(hidden.length === 0, 'after scrolling, no reveal element stays hidden (incl. knowledge tiles + track)', hidden);
  ok(errors.length === 0, 'no console/page errors', errors);
  await ctx.close();
}

/* ------------------------------------------------------------------ */
console.log('\n[7] Lebar layar (tanpa overflow, tata letak kunci)');
for (const vp of [{ w: 390, h: 844, m: true }, { w: 560, h: 900, m: true }, { w: 768, h: 1024, m: true }, { w: 1024, h: 768 }, { w: 1280, h: 800 }, { w: 1920, h: 1080 }]) {
  const ctx = await newCtx({ w: vp.w, h: vp.h, mobile: vp.m });
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await settle(page);
  const r = await page.evaluate(() => {
    const hero = document.querySelector('.home-hero').getBoundingClientRect();
    const btns = [...document.querySelectorAll('main a.btn, main button')].filter(b => b.offsetParent !== null).map(b => b.getBoundingClientRect().height);
    const cols = sel => new Set([...document.querySelectorAll(sel)].map(f => Math.round(f.getBoundingClientRect().left))).size;
    const tiles = [...document.querySelectorAll('#pk-grid .home-pk__tile')];
    const metaTops = tiles.slice(0, 4).map(t => Math.round(t.querySelector('.home-pk__meta').getBoundingClientRect().top));
    const tileMin = Math.min(...tiles.map(t => t.getBoundingClientRect().height));
    const numWrap = tiles.map(t => t.querySelector('.index-num')).filter(n => n.offsetParent !== null && n.getBoundingClientRect().height > 24).length;
    const visBadges = tiles.map(t => [...t.querySelectorAll('.badge--contoh')].filter(b => b.offsetParent !== null).length).join('');
    const foot = document.querySelector('.home-hero__foot').getBoundingClientRect();
    const track = [...document.querySelectorAll('#cta-track .status-track__step')].map(s => Math.round(s.getBoundingClientRect().top));
    return { numWrap, visBadges, overflow: document.documentElement.scrollWidth - innerWidth, heroH: Math.round(hero.height), vh: innerHeight, footBottom: Math.round(foot.bottom), minBtn: Math.min(...btns), pilarCols: cols('#pilar-grid .feature'), pkCols: cols('#pk-grid .home-pk__tile'), metaTops, tileMin, trackRow: new Set(track).size === 1 };
  });
  ok(r.overflow <= 1, `@${vp.w}: no horizontal overflow`, r.overflow);
  ok(r.heroH >= r.vh - 1 && r.footBottom <= r.heroH + 1, `@${vp.w}: hero fills the viewport (${r.heroH}px) with the index row inside`, r);
  ok(r.minBtn >= 44 && r.tileMin >= 44, `@${vp.w}: buttons and knowledge tiles ≥ 44px tall`, [r.minBtn, r.tileMin]);
  const pilarCols = vp.w >= 1024 ? 3 : vp.w >= 768 ? 2 : 1;
  const pkCols = vp.w >= 1024 ? 4 : vp.w >= 560 ? 2 : 1;
  ok(r.pilarCols === pilarCols && r.pkCols === pkCols, `@${vp.w}: pilar ${pilarCols} / knowledge tiles ${pkCols} column(s)`, [r.pilarCols, r.pkCols]);
  ok(r.numWrap === 0, `@${vp.w}: tile numerals stay on one line`, r.numWrap);
  ok(r.visBadges === '00000000', `@${vp.w}: no Contoh badge on knowledge tiles`, r.visBadges);
  if (pkCols === 4) ok(new Set(r.metaTops).size === 1, `@${vp.w}: tile footers align across the row (with or without a Contoh badge)`, r.metaTops);
  ok(r.trackRow === (vp.w >= 640), `@${vp.w}: membership track ${vp.w >= 640 ? 'horizontal' : 'vertical'}`, r.trackRow);
  if (vp.w === 1024 || vp.w === 768) await page.screenshot({ path: path.join(SHOTS, `index-flow-${vp.w}.png`), fullPage: false });
  ok(errors.length === 0, `@${vp.w}: no console/page errors`, errors);
  await ctx.close();
}

/* ------------------------------------------------------------------ */
console.log('\n[8] Escaping, data kosong, dan cadangan bila store gagal');
{
  const ctx = await newCtx();
  await ctx.route('**/assets/data/organisasi.js', async r => {
    const body = fs.readFileSync(path.join(ROOT, 'assets/data/organisasi.js'), 'utf8') +
      `\nPPAPI_DATA.organisasi.stats = [];\nPPAPI_DATA.organisasi.layanan[0].judul = '<img src=x onerror=window.__xss=1>Uji';`;
    r.fulfill({ status: 200, contentType: 'text/javascript', body });
  });
  await ctx.route('**/assets/data/agenda.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.PPAPI_DATA = window.PPAPI_DATA || {}; PPAPI_DATA.agenda = [];' }));
  await ctx.route('**/assets/data/pustaka.js', r => r.fulfill({ status: 200, contentType: 'text/javascript', body: 'window.PPAPI_DATA = window.PPAPI_DATA || {}; PPAPI_DATA.pustaka = [];' }));
  await ctx.route('**/assets/data/berita.js', async r => {
    const body = fs.readFileSync(path.join(ROOT, 'assets/data/berita.js'), 'utf8') + `\nPPAPI_DATA.berita[0].judul = '"><script>window.__xss=2</script>Judul';`;
    r.fulfill({ status: 200, contentType: 'text/javascript', body });
  });
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await settle(page);
  const r = await page.evaluate(() => ({
    xss: window.__xss || 0,
    pilarTitle: document.querySelector('#pilar-grid .feature__title').textContent,
    newsTitle: document.querySelector('#news-list .news-card__title').textContent,
    statsHidden: document.getElementById('home-stats').hidden,
    kgHidden: document.getElementById('kegiatan').hidden,
    pk: [...document.querySelectorAll('#pk-grid .home-pk__count')].map(e => e.textContent),
  }));
  ok(r.xss === 0 && r.pilarTitle.startsWith('<img') && r.newsTitle.startsWith('">'), 'data strings are escaped (no injection)', r);
  ok(r.statsHidden, 'empty stats → stats row omitted gracefully');
  ok(r.kgHidden, 'no published kegiatan → Kegiatan Terbaru hidden');
  ok(r.pk.filter(t => t === 'Segera tersedia').length === 6 && r.pk[0] === '9 dokumen' && r.pk[2] === '19 regulasi', 'empty pustaka → tiles say "Segera tersedia" (regulasi-based Standar + Peraturan tiles still count)', r.pk);
  ok(errors.length === 0, 'no console/page errors', errors);
  await ctx.close();
}
{
  const ctx = await newCtx();
  await ctx.route('**/assets/js/store.js', async r => {
    const body = fs.readFileSync(path.join(ROOT, 'assets/js/store.js'), 'utf8') + `\nPPAPI.store.content.list = function () { return Promise.reject(new Error('uji gagal')); };`;
    r.fulfill({ status: 200, contentType: 'text/javascript', body });
  });
  const errors = [];
  const page = await newPage(ctx, errors, [/Konten (berita|regulasi|pustaka) memakai data bawaan/]);
  const warns = [];
  page.on('console', m => { if (/memakai data bawaan/.test(m.text())) warns.push(m.text()); });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
  await settle(page);
  const r = await page.evaluate(() => ({ news: document.querySelectorAll('#news-list .news-card').length, reg: document.querySelectorAll('#reg-list li').length, pk: document.querySelectorAll('#pk-grid .home-pk__tile').length }));
  ok(r.news === 4 && r.reg === 4 && r.pk === 8 && warns.length === 3, 'content.list failure → static data used (4 berita, 4 regulasi, 8 tiles), one warning per type', [r, warns.length]);
  ok(errors.length === 0, 'no other console/page errors', errors);
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
