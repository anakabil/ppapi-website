// Berita (berita.html) + Agenda (agenda.html) interaction flow.
// Run from devtools/:  node flows/berita-agenda-flow.mjs
// Covers: list rendering, kategori chips, debounced search + <mark>, URL sync (?kategori=&q=),
// "Muat lebih banyak", empty state + reset, XSS escaping, detail mode (prose, share, related,
// prev/next, title, clipboard), unknown id; agenda tabs/jenis/mode + URL sync (?tab=&jenis=&mode=),
// month grouping, countdown (fake clock), detail modal (Esc, focus return, ?id=), .ics content
// (RFC 5545: CRLF, folding ≤75 octets, TZID Asia/Jakarta, RRULE for multi-day), deep links,
// headings/a11y basics, and overflow at 390 / 1440.
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

let pass = 0, fail = 0;
const ok = (cond, msg, extra) => { if (cond) { pass++; console.log('  ✓ ' + msg); } else { fail++; console.log('  ✗ ' + msg + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); } };
const CLOCK = new Date('2026-10-08T10:00:00+07:00');
const browser = await chromium.launch();

async function newCtx(opts = {}) {
  const ctx = await browser.newContext({
    viewport: opts.mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    isMobile: !!opts.mobile, hasTouch: !!opts.mobile, deviceScaleFactor: opts.mobile ? 2 : 1,
    reducedMotion: opts.motion ? 'no-preference' : 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta', acceptDownloads: true,
  });
  if (!opts.noFixedClock) await ctx.clock.setFixedTime(CLOCK);
  return ctx;
}
async function newPage(ctx, errors) {
  const page = await ctx.newPage();
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(`console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) errors.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('dialog', d => { errors.push('dialog: ' + d.message()); d.dismiss().catch(() => {}); });
  return page;
}
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const qsOf = page => new URL(page.url()).searchParams;
const headingInfo = page => page.evaluate(() => {
  const hs = [...document.querySelectorAll('main h1, main h2, main h3, main h4')].filter(e => e.offsetParent !== null || e.closest('.split-lines'));
  const lv = hs.map(e => +e.tagName[1]);
  let jump = null; for (let i = 1; i < lv.length; i++) if (lv[i] - lv[i - 1] > 1) { jump = [lv[i - 1], lv[i], hs[i].textContent.trim().slice(0, 40)]; break; }
  return { h1: document.querySelectorAll('h1').length, jump };
});

/* ======================================================================= */
console.log('\n[B1] Berita — daftar (desktop)');
{
  const ctx = await newCtx();
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/berita.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => ({
    featured: document.querySelector('.berita-feature__title')?.textContent.trim(),
    featuredContoh: !!document.querySelector('.berita-feature .badge--contoh'),
    notices: document.querySelectorAll('.berita-notice').length,
    important: document.querySelectorAll('.berita-notice.is-important').length,
    chips: [...document.querySelectorAll('#berita-chips .chip')].map(c => c.textContent.replace(/\s+/g, ' ').trim()),
    cards: document.querySelectorAll('#berita-grid .news-card').length,
    count: document.querySelector('#berita-count')?.textContent,
    moreHidden: document.querySelector('#berita-more')?.hidden,
    moreText: document.querySelector('#berita-more-text')?.textContent,
    heroMeta: document.querySelector('#berita-hero-meta')?.textContent.replace(/\s+/g, ' ').trim(),
    agendaItems: document.querySelectorAll('.berita-agenda__item').length,
    agendaHref: document.querySelector('.berita-agenda__item')?.getAttribute('href'),
    detailGone: !document.querySelector('#berita-detail'),
    cardImgs: [...document.querySelectorAll('#berita-grid img')].every(i => i.getAttribute('width') && i.getAttribute('loading') === 'lazy' && i.getAttribute('alt') !== null),
    featuredInGrid: [...document.querySelectorAll('#berita-grid .news-card__title')].some(t => t.textContent.includes('Situs Resmi')),
  }));
  ok(info.featured === 'PPAPI Menghadirkan Situs Resmi dan Layanan Anggota Daring', 'sorotan utama = berita sorot terbaru', info.featured);
  ok(info.featuredContoh, 'sorotan menampilkan lencana Contoh');
  ok(info.notices === 4 && info.important === 1, '4 pengumuman, 1 penting', [info.notices, info.important]);
  ok(info.chips.length === 6 && /^Semua \(?10/.test(info.chips[0]), 'chip: Semua + 5 kategori dengan jumlah', info.chips);
  ok(info.cards === 6, 'kisi awal 6 kartu', info.cards);
  ok(!info.featuredInGrid, 'sorotan tidak diulang di kisi saat tanpa filter');
  ok(/^9 artikel/.test(info.count), 'status: 9 artikel di luar sorotan', info.count);
  ok(info.moreHidden === false && info.moreText === 'Menampilkan 6 dari 9 artikel', 'tombol muat lebih banyak + teks', info.moreText);
  ok(/10 artikel/.test(info.heroMeta) && /5 kategori/.test(info.heroMeta), 'meta hero dari data', info.heroMeta);
  ok(info.agendaItems === 3 && /^agenda\.html\?id=/.test(info.agendaHref), 'pita agenda: 3 agenda terdekat ber-tautan ?id=', info);
  ok(info.detailGone, 'kontainer detail dihapus di mode daftar');
  ok(info.cardImgs, 'gambar kartu: width/height, lazy, alt');
  const hi = await headingInfo(page);
  ok(hi.h1 === 1 && !hi.jump, 'satu h1, urutan heading tanpa loncatan', hi);

  // Muat lebih banyak
  await page.click('#berita-more-btn');
  await page.waitForTimeout(100);
  const more = await page.evaluate(() => ({ cards: document.querySelectorAll('#berita-grid .news-card').length, hidden: document.querySelector('#berita-more').hidden, focus: document.activeElement?.closest('.news-card') === document.querySelectorAll('#berita-grid .news-card')[6] }));
  ok(more.cards === 9 && more.hidden, 'muat lebih banyak → 9 kartu, tombol tersembunyi', more);
  ok(more.focus, 'fokus pindah ke kartu baru pertama');

  // Chip kategori
  await page.click('#berita-chips .chip[data-kategori="Edukasi"]');
  await page.waitForTimeout(100);
  let st = await page.evaluate(() => ({
    tags: [...document.querySelectorAll('#berita-grid .news-card .tag')].map(t => t.textContent),
    pressed: document.querySelector('#berita-chips .chip[aria-pressed="true"]')?.dataset.kategori,
    reset: !document.querySelector('#berita-reset').hidden,
  }));
  ok(st.tags.length === 3 && st.tags.every(t => t === 'Edukasi'), 'filter Edukasi → 3 kartu Edukasi', st.tags);
  ok(st.pressed === 'Edukasi' && st.reset, 'chip aria-pressed + tombol hapus filter tampil', st);
  ok(qsOf(page).get('kategori') === 'Edukasi', 'URL ?kategori=Edukasi', page.url());

  // Pencarian (debounce) + mark
  await page.fill('#berita-q', 'tag');
  await page.waitForTimeout(80);
  const early = qsOf(page).get('q');
  await page.waitForTimeout(400);
  st = await page.evaluate(() => ({
    cards: document.querySelectorAll('#berita-grid .news-card').length,
    marks: [...document.querySelectorAll('#berita-grid mark')].map(m => m.textContent.toLowerCase()),
    count: document.querySelector('#berita-count').textContent,
  }));
  ok(early === null, 'pencarian di-debounce (belum diterapkan pada 80 ms)', early);
  ok(st.cards >= 1 && st.marks.length > 0 && st.marks.every(m => m === 'tag'), 'hasil cari + <mark> pada kata kunci', st);
  ok(qsOf(page).get('q') === 'tag' && qsOf(page).get('kategori') === 'Edukasi', 'URL ?kategori=Edukasi&q=tag', page.url());
  ok(/untuk “tag” dalam kategori Edukasi/.test(st.count), 'status menyebut kata kunci & kategori', st.count);

  // Kosong + reset dari empty state
  await page.fill('#berita-q', 'zzzz tidak ada');
  await page.waitForTimeout(450);
  st = await page.evaluate(() => ({ empty: !!document.querySelector('#berita-grid .empty-state'), more: document.querySelector('#berita-more').hidden }));
  ok(st.empty && st.more, 'tanpa hasil → empty state, tombol muat tersembunyi', st);
  await page.screenshot({ path: path.join(SHOTS, 'flow-berita-empty-desktop.png') });
  await page.click('#berita-grid [data-berita-reset]');
  await page.waitForTimeout(100);
  st = await page.evaluate(() => ({ cards: document.querySelectorAll('#berita-grid .news-card').length, q: document.querySelector('#berita-q').value, focus: document.activeElement?.id }));
  ok(st.cards === 6 && st.q === '' && st.focus === 'berita-q', 'hapus filter → kembali 6 kartu, fokus ke pencarian', st);
  ok(!qsOf(page).has('kategori') && !qsOf(page).has('q'), 'URL bersih setelah reset', page.url());

  // Esc mengosongkan pencarian
  await page.fill('#berita-q', 'SKKNI');
  await page.waitForTimeout(400);
  await page.press('#berita-q', 'Escape');
  await page.waitForTimeout(100);
  ok(await page.inputValue('#berita-q') === '' && !qsOf(page).has('q'), 'Esc di kotak cari mengosongkan pencarian');
  ok(errors.length === 0, 'tanpa galat konsol/halaman', errors);
  await ctx.close();
}

console.log('\n[B2] Berita — status dari URL + escaping');
{
  const ctx = await newCtx();
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/berita.html?kategori=regulasi&q=SKKNI`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  let st = await page.evaluate(() => ({
    pressed: document.querySelector('#berita-chips .chip[aria-pressed="true"]')?.dataset.kategori,
    q: document.querySelector('#berita-q').value,
    titles: [...document.querySelectorAll('#berita-grid .news-card__title')].map(t => t.textContent),
    scrolled: window.scrollY > 300,
  }));
  ok(st.pressed === 'Regulasi' && st.q === 'SKKNI', 'kategori (tanpa peka huruf) & q dipulihkan dari URL', st);
  ok(st.titles.length === 1 && /SKKNI/.test(st.titles[0]), '1 hasil SKKNI', st.titles);
  ok(st.scrolled, 'tautan berfilter menggulir ke arsip');
  ok(qsOf(page).get('kategori') === 'Regulasi', 'URL dinormalisasi ke kategori kanonik');

  const evil = '<img src=x onerror=alert(1)>"\'`';
  await page.goto(`${BASE}/berita.html?q=${encodeURIComponent(evil)}&kategori=${encodeURIComponent('<b>x</b>')}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  st = await page.evaluate(() => ({ imgs: document.querySelectorAll('#berita-grid img[src="x"], #berita-count img').length, count: document.querySelector('#berita-count').textContent, pressed: document.querySelector('#berita-chips .chip[aria-pressed="true"]')?.dataset.kategori }));
  ok(st.imgs === 0 && st.count.includes('<img'), 'q berbahaya ditampilkan sebagai teks, tidak dieksekusi', st);
  ok(st.pressed === '', 'kategori tak dikenal → Semua', st.pressed);
  ok(errors.filter(e => e.startsWith('dialog')).length === 0, 'tidak ada dialog alert (XSS)', errors);

  // Kategori dengan featured: filter Organisasi menampilkan sorotan juga
  await page.goto(`${BASE}/berita.html?kategori=Organisasi`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  const n = await page.locator('#berita-grid .news-card').count();
  ok(n === 2, 'filter Organisasi menyertakan berita sorotan (2 hasil)', n);
  ok(errors.filter(e => !e.startsWith('dialog')).length === 0, 'tanpa galat konsol', errors);
  await ctx.close();
}

console.log('\n[B3] Berita — detail artikel');
{
  const ctx = await newCtx();
  await ctx.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE });
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/berita.html?id=memahami-penandaan-perancah`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  const d = await page.evaluate(() => ({
    title: document.title,
    h1: document.querySelector('h1')?.textContent.trim(),
    listGone: !document.querySelector('#berita-list'),
    crumbs: [...document.querySelectorAll('.breadcrumb li')].map(l => l.textContent.trim()),
    h2s: [...document.querySelectorAll('.berita-article__prose h2')].map(e => e.textContent),
    lis: document.querySelectorAll('.berita-article__prose ul li').length,
    uls: document.querySelectorAll('.berita-article__prose ul').length,
    ps: document.querySelectorAll('.berita-article__prose p').length,
    standfirst: !!document.querySelector('.berita-article__standfirst'),
    related: [...document.querySelectorAll('.berita-related__item')].map(a => a.querySelector('.tag').textContent),
    prev: document.querySelector('.berita-pager__link--prev')?.getAttribute('href'),
    next: document.querySelector('.berita-pager__link--next')?.getAttribute('href'),
    wa: document.querySelector('a[href^="https://wa.me/"]')?.getAttribute('href'),
    li: document.querySelector('a[href^="https://www.linkedin.com/sharing/share-offsite/"]')?.getAttribute('href'),
    extRel: [...document.querySelectorAll('.berita-share a[target="_blank"]')].every(a => /noopener/.test(a.rel)),
    heroImg: (() => { const i = document.querySelector('.berita-article__figure img'); return i && !i.hasAttribute('loading') && i.getAttribute('fetchpriority') === 'high' && i.alt.length > 0; })(),
    desc: document.querySelector('meta[name="description"]').content,
    contohNote: !!document.querySelector('.berita-article__note'),
  }));
  ok(d.title === 'Memahami Penandaan Hijau, Kuning, dan Merah pada Perancah — PPAPI', 'document.title diperbarui', d.title);
  ok(d.h1 === 'Memahami Penandaan Hijau, Kuning, dan Merah pada Perancah' && d.listGone, 'h1 = judul; mode daftar dihapus', d.h1);
  ok(d.crumbs.length === 3 && d.crumbs[0] === 'Beranda' && d.crumbs[1] === 'Berita', 'breadcrumb Beranda › Berita › judul', d.crumbs);
  ok(d.h2s.length === 2 && d.uls === 1 && d.lis === 3 && d.ps === 4, "isi: '## '→h2, '- '→ul berkelompok, paragraf", d);
  ok(d.standfirst && d.contohNote, 'ringkasan sebagai standfirst + catatan konten contoh');
  ok(d.related.length === 3 && d.related[0] === 'Edukasi' && d.related[1] === 'Edukasi', 'berita lainnya: kategori sama didahulukan', d.related);
  ok(d.prev === 'berita.html?id=skkni-operasi-scaffolding-kepmenaker-46-2022' && d.next === 'berita.html?id=pelatihan-inspeksi-perancah-pipa-klem', 'navigasi sebelumnya/berikutnya kronologis', [d.prev, d.next]);
  ok(d.wa && decodeURIComponent(d.wa).includes('berita.html?id=memahami-penandaan-perancah'), 'tautan WhatsApp memuat URL artikel', d.wa);
  ok(d.li && decodeURIComponent(d.li).includes('berita.html?id=memahami-penandaan-perancah'), 'tautan LinkedIn memuat URL artikel', d.li);
  ok(d.extRel, 'tautan eksternal rel=noopener');
  ok(d.heroImg, 'gambar utama eager + fetchpriority + alt');
  ok(d.desc.startsWith('Penandaan (tagging)'), 'meta description = ringkasan');
  const hi = await headingInfo(page);
  ok(hi.h1 === 1 && !hi.jump, 'detail: satu h1, heading berurutan', hi);

  await page.click('[data-share-copy]');
  await page.waitForTimeout(250);
  const clip = await page.evaluate(async () => { try { return await navigator.clipboard.readText(); } catch (e) { return 'ERR ' + e.message; } });
  const toast = await page.locator('.toast').last().textContent().catch(() => '');
  ok(clip.endsWith('/berita.html?id=memahami-penandaan-perancah'), 'Salin tautan → clipboard berisi URL artikel', clip);
  ok(/berhasil disalin/.test(toast), 'toast konfirmasi salin', toast);
  ok(/Tautan tersalin/.test(await page.locator('[data-share-copy]').textContent()), 'label tombol berubah sementara');
  ok(await overflow(page) <= 1, 'tanpa overflow horizontal');

  // berita paling awal: tautan "sebelumnya" kembali ke arsip
  await page.goto(`${BASE}/berita.html?id=pemeriksaan-sederhana-sebelum-naik-perancah`, { waitUntil: 'networkidle' });
  ok(await page.locator('.berita-pager__link--prev.is-index').count() === 1, 'berita terlama: tautan sebelumnya → arsip');

  // id tak dikenal
  await page.goto(`${BASE}/berita.html?id=${encodeURIComponent('tidak-ada"><script>alert(1)</script>')}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  const nf = await page.evaluate(() => ({ h1: document.querySelector('h1')?.textContent.trim(), title: document.title, cards: document.querySelectorAll('.berita-nf .news-card').length, back: !!document.querySelector('a.btn[href="berita.html"]'), robots: document.querySelector('meta[name="robots"]')?.content, h1s: document.querySelectorAll('h1').length }));
  ok(nf.h1 === 'Berita tidak ditemukan.' && nf.h1s === 1, 'id tak dikenal → h1 "Berita tidak ditemukan"', nf);
  ok(nf.title === 'Berita tidak ditemukan — PPAPI' && nf.robots === 'noindex', 'judul dokumen + noindex', nf);
  ok(nf.cards === 3 && nf.back, '3 saran berita + tautan kembali', nf);
  await page.screenshot({ path: path.join(SHOTS, 'flow-berita-notfound-desktop.png'), fullPage: true });
  ok(errors.filter(e => !e.startsWith('dialog')).length === 0 && !errors.some(e => e.startsWith('dialog')), 'tanpa galat / dialog', errors);
  await ctx.close();
}

console.log('\n[B4] Berita — seluler 390');
{
  const ctx = await newCtx({ mobile: true });
  const errors = [];
  const page = await newPage(ctx, errors);
  for (const q of ['', '?kategori=Kegiatan', '?id=situs-resmi-dan-layanan-anggota-daring', '?id=x-tidak-ada']) {
    await page.goto(`${BASE}/berita.html${q}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(200);
    ok(await overflow(page) <= 1, `tanpa overflow horizontal (berita.html${q})`);
  }
  ok(errors.length === 0, 'tanpa galat (seluler)', errors);
  await ctx.close();
}

/* ======================================================================= */
console.log('\n[A1] Agenda — daftar, penyaring, URL');
{
  const ctx = await newCtx();
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/agenda.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  let s = await page.evaluate(() => ({
    feature: document.querySelector('.agenda-feature__title')?.textContent.trim(),
    cd: [...document.querySelectorAll('[data-cd="d"],[data-cd="h"],[data-cd="m"]')].map(e => e.textContent),
    timer: document.querySelector('#agenda-cd')?.getAttribute('role'),
    tabCounts: [...document.querySelectorAll('[data-count-for]')].map(e => e.textContent),
    months: [...document.querySelectorAll('.agenda-month__title')].map(e => e.textContent.replace(/\s+/g, ' ').trim()),
    rows: document.querySelectorAll('.agenda-row').length,
    next: document.querySelectorAll('.agenda-row.is-next').length,
    ranges: [...document.querySelectorAll('.agenda-row .date-block__day')].map(e => e.textContent),
    ics: document.querySelectorAll('.agenda-row [data-agenda-ics]').length,
    count: document.querySelector('#agenda-count').textContent,
    chips: [...document.querySelectorAll('#agenda-chips .chip')].map(c => c.dataset.jenis),
    contoh: document.querySelectorAll('.agenda-row .badge--contoh').length,
    heroMeta: document.querySelector('#agenda-hero-meta').textContent.replace(/\s+/g, ' ').trim(),
  }));
  ok(s.feature === 'Pelatihan Inspeksi Perancah Pipa dan Klem (Tube & Coupler)', 'agenda terdekat disorot', s.feature);
  ok(s.timer === 'timer' && s.cd.join('/') === '12/22/00', 'hitung mundur 12 hari 22 jam 00 menit (10.00 WIB → 21 Okt 08.00 WIB)', s.cd);
  ok(s.tabCounts.join('/') === '6/4', 'jumlah tab 6 / 4', s.tabCounts);
  ok(s.months.join('|') === 'Oktober 2026|November 2026|Desember 2026|Januari 2027', 'dikelompokkan per bulan', s.months);
  ok(s.rows === 6 && s.next === 1 && s.ics === 6 && s.contoh === 6, '6 baris, 1 terdekat, tombol kalender & contoh', s);
  ok(s.ranges[0] === '21–23' && s.ranges[2] === '12–13', 'blok tanggal rentang "21–23"', s.ranges);
  ok(s.chips.join(',') === ',Pelatihan,Sertifikasi,Seminar,Webinar,Rapat,Kunjungan Teknis', 'chip jenis lengkap', s.chips);
  ok(/6 agenda akan datang/.test(s.heroMeta), 'meta hero dari data', s.heroMeta);
  const hi = await headingInfo(page);
  ok(hi.h1 === 1 && !hi.jump, 'satu h1, heading berurutan', hi);

  await page.click('#agenda-tabs .segmented__option[data-value="telah-berlangsung"]');
  await page.waitForTimeout(100);
  s = await page.evaluate(() => ({
    rows: document.querySelectorAll('.agenda-row').length, past: document.querySelectorAll('.agenda-row.is-past').length,
    months: [...document.querySelectorAll('.agenda-month__title')].map(e => e.textContent.replace(/\s+/g, ' ').trim()),
    ics: document.querySelectorAll('.agenda-row [data-agenda-ics]').length,
    pressed: document.querySelector('#agenda-tabs [aria-pressed="true"]').dataset.value,
  }));
  ok(s.rows === 4 && s.past === 4 && s.ics === 0, 'Telah Berlangsung: 4 baris redup, tanpa tombol kalender', s);
  ok(s.months[0] === 'September 2026' && s.months[3] === 'Mei 2026', 'urutan bulan menurun untuk arsip', s.months);
  ok(qsOf(page).get('tab') === 'telah-berlangsung' && s.pressed === 'telah-berlangsung', 'URL ?tab=telah-berlangsung', page.url());

  await page.click('#agenda-chips .chip[data-jenis="Pelatihan"]');
  await page.waitForTimeout(100);
  ok(await page.locator('.agenda-row').count() === 1 && qsOf(page).get('jenis') === 'Pelatihan', 'jenis Pelatihan → 1 baris, URL ?jenis=', page.url());
  await page.click('#agenda-mode .segmented__option[data-value="Daring"]');
  await page.waitForTimeout(100);
  s = await page.evaluate(() => ({ empty: !!document.querySelector('#agenda-list .empty-state'), count: document.querySelector('#agenda-count').textContent, reset: !document.querySelector('#agenda-reset').hidden }));
  ok(s.empty && s.reset && /Tidak ada agenda telah berlangsung untuk jenis Pelatihan dan mode Daring/.test(s.count), 'kombinasi kosong → empty state + status', s);
  ok(qsOf(page).get('mode') === 'Daring', 'URL ?mode=Daring');
  await page.screenshot({ path: path.join(SHOTS, 'flow-agenda-empty-desktop.png') });
  await page.click('#agenda-list [data-agenda-reset]');
  await page.waitForTimeout(100);
  ok(await page.locator('.agenda-row').count() === 4 && !qsOf(page).has('jenis') && !qsOf(page).has('mode'), 'hapus filter → 4 baris, URL bersih');

  await page.click('#agenda-tabs .segmented__option[data-value="akan-datang"]');
  await page.click('#agenda-mode .segmented__option[data-value="Hybrid"]');
  await page.waitForTimeout(100);
  s = await page.evaluate(() => ({ titles: [...document.querySelectorAll('.agenda-row .event-row__title')].map(e => e.textContent), chipSeminar: document.querySelector('#agenda-chips .chip[data-jenis="Seminar"] [data-chip-n]').textContent, zero: document.querySelectorAll('#agenda-chips .chip.is-zero').length }));
  ok(s.titles.length === 2 && s.titles[0].startsWith('Seminar Nasional') && s.titles[1] === 'Rapat Anggota Tahunan', 'mode Hybrid (akan datang) → 2 agenda', s.titles);
  ok(s.chipSeminar === '1' && s.zero === 4, 'jumlah chip mengikuti tab + mode', s);
  ok(!qsOf(page).has('tab') && qsOf(page).get('mode') === 'Hybrid', 'URL: tab default dihapus, mode=Hybrid', page.url());
  await page.click('#agenda-mode .segmented__option[data-value=""]');

  // Modal detail
  const btn = page.locator('.agenda-row').first().locator('button[data-agenda-open]');
  await btn.click();
  await page.waitForSelector('.modal .agenda-modal');
  await page.waitForTimeout(150);
  s = await page.evaluate(() => ({
    title: document.querySelector('.modal__title')?.textContent,
    eyebrow: document.querySelector('.modal__eyebrow')?.textContent,
    kv: [...document.querySelectorAll('.agenda-modal__facts dt')].map(e => e.textContent),
    date: document.querySelector('.agenda-modal__date')?.textContent,
    rel: document.querySelector('.agenda-modal__rel')?.textContent,
    reg: document.querySelector('.agenda-modal a.btn--primary')?.getAttribute('href'),
    regLabel: document.querySelector('.agenda-modal a.btn--primary')?.textContent.trim(),
    dialog: document.querySelector('.modal__dialog')?.getAttribute('aria-modal'),
    focusIn: !!document.activeElement?.closest('.modal'),
  }));
  ok(s.title === 'Pelatihan Inspeksi Perancah Pipa dan Klem (Tube & Coupler)' && s.dialog === 'true' && s.focusIn, 'modal detail terbuka (aria-modal, fokus di dalam)', s);
  ok(s.kv.join(',') === 'Waktu,Lokasi,Mode,Kuota,Pendaftaran', 'fakta kv lengkap', s.kv);
  ok(s.date === 'Rabu – Jumat, 21–23 Oktober 2026' && /^Dimulai dalam/.test(s.rel), 'tanggal panjang + relatif', [s.date, s.rel]);
  ok(s.reg === 'umpan-balik.html?kategori=Pertanyaan#formulir' && s.regLabel === 'Hubungi Sekretariat', 'tautanDaftar kosong → Hubungi Sekretariat', s);
  ok(qsOf(page).get('id') === 'pelatihan-inspeksi-tube-coupler-okt-2026', 'URL ?id= saat modal terbuka');
  await page.screenshot({ path: path.join(SHOTS, 'flow-agenda-modal-desktop.png') });

  // .ics dari modal (multi-hari, berjam)
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.modal [data-agenda-ics]')]);
  const icsPath = await dl.path();
  const ics = fs.readFileSync(icsPath, 'utf8');
  const lines = ics.split('\r\n');
  const unfolded = ics.replace(/\r\n /g, '');
  ok(dl.suggestedFilename() === 'ppapi-agenda-pelatihan-inspeksi-tube-coupler-okt-2026.ics', 'nama berkas .ics', dl.suggestedFilename());
  ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n') && ics.endsWith('END:VCALENDAR\r\n') && !/[^\r]\n/.test(ics), 'VCALENDAR dengan akhir baris CRLF');
  ok(lines.every(l => Buffer.byteLength(l, 'utf8') <= 75), 'setiap baris ≤ 75 oktet (dilipat)', lines.filter(l => Buffer.byteLength(l, 'utf8') > 75));
  ok(/\r\nBEGIN:VTIMEZONE\r\nTZID:Asia\/Jakarta\r\n/.test(ics) && /TZOFFSETTO:\+0700/.test(ics), 'VTIMEZONE Asia/Jakarta +0700');
  ok(unfolded.includes('DTSTART;TZID=Asia/Jakarta:20261021T080000') && unfolded.includes('DTEND;TZID=Asia/Jakarta:20261021T160000'), 'DTSTART/DTEND berzona 08.00–16.00');
  ok(unfolded.includes('RRULE:FREQ=DAILY;COUNT=3'), 'RRULE harian 3 hari untuk rentang 21–23');
  ok(/UID:agenda-pelatihan-inspeksi-tube-coupler-okt-2026-20261021@ppapi/.test(unfolded) && /DTSTAMP:\d{8}T\d{6}Z/.test(unfolded), 'UID + DTSTAMP (UTC)');
  ok(unfolded.includes('LOCATION:Jakarta (lokasi rinci diinformasikan kepada peserta)') && /DESCRIPTION:Pelatihan tiga hari[^\r]*\\,[^\r]*\\n/.test(unfolded), 'teks di-escape (koma \\, & baris \\n)');
  ok(unfolded.includes('SUMMARY:[Contoh] Pelatihan Inspeksi') && unfolded.includes('STATUS:TENTATIVE') && unfolded.includes('TRIGGER:-P1D'), 'SUMMARY contoh, STATUS TENTATIVE, alarm H-1');
  const toastTxt = await page.locator('.toast').last().textContent().catch(() => '');
  ok(/diunduh/.test(toastTxt), 'toast unduhan', toastTxt);

  // Esc menutup, fokus kembali, id dihapus
  await page.keyboard.press('Escape');
  await page.waitForTimeout(150);
  s = await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), focus: document.activeElement?.matches('button[data-agenda-open]') }));
  ok(!s.modal && s.focus, 'Esc menutup modal, fokus kembali ke tombol Detail', s);
  ok(!qsOf(page).has('id'), 'URL ?id= dihapus saat ditutup');

  // .ics dari baris (sehari)
  const [dl2] = await Promise.all([page.waitForEvent('download'), page.locator('#agenda-webinar-smkk-pekerjaan-perancah-okt-2026 [data-agenda-ics]').click()]);
  const ics2 = fs.readFileSync(await dl2.path(), 'utf8').replace(/\r\n /g, '');
  ok(ics2.includes('DTSTART;TZID=Asia/Jakarta:20261029T133000') && ics2.includes('DTEND;TZID=Asia/Jakarta:20261029T153000') && !ics2.includes('RRULE'), 'agenda sehari: 13.30–15.30, tanpa RRULE');
  ok(ics2.includes('LOCATION:Daring (Zoom)') && ics2.includes('CATEGORIES:Webinar'), 'LOCATION & CATEGORIES');

  // Klik judul membuka modal (bukan navigasi)
  await page.locator('#agenda-seminar-keselamatan-perancah-2026 .event-row__title a').click();
  await page.waitForSelector('.modal');
  ok(/Seminar Nasional/.test(await page.locator('.modal__title').textContent()), 'klik judul membuka modal detail');
  await page.click('.modal [data-modal-close].modal__close');
  await page.waitForTimeout(150);
  ok(await overflow(page) <= 1, 'tanpa overflow horizontal');
  ok(errors.length === 0, 'tanpa galat konsol/halaman', errors);
  await ctx.close();
}

console.log('\n[A2] Agenda — tautan langsung & status dari URL');
{
  const ctx = await newCtx();
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/agenda.html?id=webinar-penandaan-perancah-sep-2026`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.modal');
  let s = await page.evaluate(() => ({
    title: document.querySelector('.modal__title').textContent,
    tab: document.querySelector('#agenda-tabs [aria-pressed="true"]').dataset.value,
    row: !!document.getElementById('agenda-webinar-penandaan-perancah-sep-2026'),
    pastHint: /telah berlangsung/i.test(document.querySelector('.agenda-modal__hint').textContent),
    ics: document.querySelectorAll('.modal [data-agenda-ics]').length,
    kv: [...document.querySelectorAll('.agenda-modal__facts dt')].map(e => e.textContent),
  }));
  ok(/Penandaan \(Tagging\)/.test(s.title) && s.tab === 'telah-berlangsung' && s.row, '?id= agenda lampau → tab Telah Berlangsung + modal', s);
  ok(s.pastHint && s.ics === 0 && !s.kv.includes('Pendaftaran'), 'modal lampau: tanpa kalender/pendaftaran', s);
  await page.keyboard.press('Escape');

  await page.goto(`${BASE}/agenda.html?id=tidak-ada`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  s = await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), toast: document.querySelector('.toast')?.textContent || '' }));
  ok(!s.modal && /tidak ditemukan/.test(s.toast) && !qsOf(page).has('id'), 'id tak dikenal → toast info, id dihapus', s);

  await page.goto(`${BASE}/agenda.html?tab=telah-berlangsung&jenis=webinar&mode=DARING`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  s = await page.evaluate(() => ({ rows: [...document.querySelectorAll('.agenda-row .event-row__title')].map(e => e.textContent), jenis: document.querySelector('#agenda-chips [aria-pressed="true"]').dataset.jenis, mode: document.querySelector('#agenda-mode [aria-pressed="true"]').dataset.value }));
  ok(s.rows.length === 1 && s.jenis === 'Webinar' && s.mode === 'Daring', 'tab/jenis/mode dipulihkan dari URL (tanpa peka huruf)', s);
  ok(errors.length === 0, 'tanpa galat', errors);
  await ctx.close();
}

console.log('\n[A3] Agenda — hitung mundur (jam palsu, diperbarui tiap menit)');
{
  const ctx = await newCtx({ noFixedClock: true });
  await ctx.clock.install({ time: new Date('2026-10-08T09:59:05+07:00') });
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/agenda.html`, { waitUntil: 'networkidle' });
  const read = () => page.evaluate(() => [...document.querySelectorAll('[data-cd="d"],[data-cd="h"],[data-cd="m"]')].map(e => e.textContent).join('/'));
  const t0 = await read();
  await page.clock.pauseAt(new Date('2026-10-08T10:00:30+07:00'));
  const t1 = await read();
  await page.clock.runFor(60000);
  const t2 = await read();
  ok(t0 === '12/22/00', 'awal 09.59 → 12/22/00', t0);
  ok(t1 === '12/21/59', 'setelah batas menit → 12/21/59', t1);
  ok(t2 === '12/21/58', 'menit berikutnya → 12/21/58', t2);
  // saat kegiatan berlangsung
  await page.clock.pauseAt(new Date('2026-10-21T09:00:00+07:00'));
  await page.clock.runFor(61000);
  const live = await page.evaluate(() => ({ units: document.querySelector('.agenda-cd__units').hidden, live: document.querySelector('[data-cd="live"]').textContent, hidden: document.querySelector('[data-cd="live"]').hidden }));
  ok(live.units && !live.hidden && live.live === 'Sedang berlangsung', 'saat dimulai → "Sedang berlangsung"', live);
  ok(errors.length === 0, 'tanpa galat', errors);
  await ctx.close();
}

console.log('\n[A4] Agenda — seluler 390 (+ modal)');
{
  const ctx = await newCtx({ mobile: true });
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/agenda.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  ok(await overflow(page) <= 1, 'tanpa overflow horizontal (seluler)');
  const wraps = await page.evaluate(() => [...document.querySelectorAll('.date-block__day')].filter(e => e.getBoundingClientRect().height > 50).map(e => e.textContent));
  ok(wraps.length === 0, 'angka tanggal rentang tidak terpotong baris', wraps);
  const touch = await page.evaluate(() => [...document.querySelectorAll('#agenda-tabs button, #agenda-mode button, #agenda-chips button, .agenda-row button')].filter(b => b.getBoundingClientRect().height < 44).length);
  ok(touch === 0, 'target sentuh ≥ 44px pada kontrol', touch);
  await page.locator('.agenda-row').nth(1).locator('button[data-agenda-open]').click();
  await page.waitForSelector('.modal');
  await page.waitForTimeout(200);
  ok(await overflow(page) <= 1, 'modal seluler tanpa overflow');
  await page.screenshot({ path: path.join(SHOTS, 'flow-agenda-modal-mobile.png') });
  await page.keyboard.press('Escape');
  await page.click('#agenda-tabs .segmented__option[data-value="telah-berlangsung"]');
  await page.waitForTimeout(150);
  await page.screenshot({ path: path.join(SHOTS, 'flow-agenda-past-mobile.png'), fullPage: false });
  ok(errors.length === 0, 'tanpa galat (seluler)', errors);
  await ctx.close();
}

console.log('\n[A5] Gerak aktif — konten tetap tampil setelah reveal');
{
  const ctx = await newCtx({ motion: true });
  const errors = [];
  const page = await newPage(ctx, errors);
  for (const pg of ['agenda.html', 'berita.html', 'berita.html?id=rapat-kerja-program-2026-2027']) {
    await page.goto(`${BASE}/${pg}`, { waitUntil: 'networkidle' });
    await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); } });
    await page.waitForTimeout(1600);
    const hidden = await page.evaluate(() => [...document.querySelectorAll('main [data-reveal], main [data-reveal-stagger] > *')].filter(e => getComputedStyle(e).opacity === '0').length);
    ok(hidden === 0, `semua elemen reveal terlihat setelah gulir (${pg})`, hidden);
  }
  // filter berganti dengan animasi kartu
  await page.goto(`${BASE}/berita.html`, { waitUntil: 'networkidle' });
  await page.click('#berita-chips .chip[data-kategori="Kegiatan"]');
  await page.waitForTimeout(900);
  const op = await page.evaluate(() => [...document.querySelectorAll('#berita-grid .news-card')].map(c => getComputedStyle(c).opacity));
  ok(op.length === 2 && op.every(o => o === '1'), 'kartu hasil filter beranimasi lalu tampil penuh', op);
  ok(errors.length === 0, 'tanpa galat (gerak aktif)', errors);
  await ctx.close();
}

/* ======================================================================= */
/* v2 — konten kelolaan admin melalui PPAPI.store.content.list()           */
const META = { updatedAt: '2026-10-08T01:00:00.000Z', updatedBy: 'demo-admin-0001' };
const MANAGED = {
  ppapi_content_berita: [
    Object.assign({ id: 'pengumuman-hasil-rapat-pengurus', judul: 'Hasil Rapat Pengurus <i>Oktober</i>', kategori: 'Organisasi', tanggal: '2026-10-08', ringkasan: 'Ringkasan hasil rapat pengurus yang dimuat sekretariat melalui Konsol Admin.', isi: ['## Pokok bahasan', 'Paragraf pertama hasil rapat.', '- Butir satu', '- Butir dua', 'Paragraf penutup.'], gambar: '', penulis: 'Sekretariat PPAPI', sorot: true, contoh: false }, META),
    Object.assign({ id: 'memahami-penandaan-perancah', hidden: true }, META),
  ],
  ppapi_content_pengumuman: [
    Object.assign({ id: 'pengumuman-kelolaan', judul: 'Pengumuman Kelolaan Admin', isi: 'Isi pengumuman dari Konsol Admin.', tanggal: '2026-10-08', penting: false, contoh: false }, META),
  ],
  ppapi_content_agenda: [
    Object.assign({ id: 'rapat-teknis-kelolaan', judul: 'Rapat Teknis Kelolaan Admin', jenis: 'Rapat', mulai: '2026-10-15', selesai: '2026-10-15', waktu: '09.00 – 11.00 WIB', lokasi: 'Daring (Zoom)', mode: 'Daring', kuota: 40, deskripsi: 'Rapat teknis yang dijadwalkan sekretariat melalui Konsol Admin.', tautanDaftar: '', contoh: false }, META),
    Object.assign({ id: 'webinar-smkk-pekerjaan-perancah-okt-2026', hidden: true }, META),
  ],
};
async function managedCtx(opts = {}) {
  const ctx = await newCtx(opts);
  await ctx.addInitScript(data => { try { if (sessionStorage.getItem('__mc')) return; sessionStorage.setItem('__mc', '1'); Object.entries(data).forEach(([k, v]) => localStorage.setItem(k, JSON.stringify(v))); } catch (e) {} }, MANAGED);
  return ctx;
}

console.log('\n[C1] Berita — konten kelolaan admin (tambah, sembunyikan, detail)');
{
  const ctx = await managedCtx();
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/berita.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  let s = await page.evaluate(() => ({
    featured: document.querySelector('.berita-feature__title')?.textContent.trim(),
    featuredContoh: !!document.querySelector('.berita-feature .badge--contoh'),
    featuredFallback: !!document.querySelector('.berita-feature .berita-media-fallback'),
    italic: !!document.querySelector('.berita-feature__title i'),
    notices: [...document.querySelectorAll('.berita-notice__title')].map(e => e.textContent),
    chipAll: document.querySelector('#berita-chips .chip').textContent.replace(/\s+/g, ' ').trim(),
    titles: [...document.querySelectorAll('#berita-grid .news-card__title')].map(e => e.textContent),
    count: document.querySelector('#berita-count').textContent,
    agenda: [...document.querySelectorAll('.berita-agenda__item')].map(a => a.getAttribute('href')),
  }));
  ok(s.featured === 'Hasil Rapat Pengurus <i>Oktober</i>' && !s.italic && !s.featuredContoh && s.featuredFallback, 'berita kelolaan (sorot, terbaru) menjadi sorotan; judul di-escape; tanpa lencana Contoh; pelat cadangan tanpa gambar', s);
  ok(s.notices.length === 5 && s.notices.includes('Pengumuman Kelolaan Admin'), 'pengumuman kelolaan ikut tampil (5)', s.notices);
  ok(/^Semua \(?10/.test(s.chipAll) && /^9 artikel/.test(s.count), 'jumlah: 10 artikel (1 tambah, 1 disembunyikan), 9 di luar sorotan', [s.chipAll, s.count]);
  await page.click('#berita-more-btn');
  await page.waitForTimeout(100);
  const all = await page.$$eval('#berita-grid .news-card__title', e => e.map(x => x.textContent));
  ok(!all.some(t => /Memahami Penandaan/.test(t)), 'berita bawaan yang disembunyikan admin tidak tampil di arsip', all);
  ok(s.agenda[0] === 'agenda.html?id=rapat-teknis-kelolaan' && !s.agenda.includes('agenda.html?id=webinar-smkk-pekerjaan-perancah-okt-2026'), 'pita agenda memuat agenda kelolaan; agenda tersembunyi hilang', s.agenda);

  await page.goto(`${BASE}/berita.html?id=pengumuman-hasil-rapat-pengurus`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  s = await page.evaluate(() => ({
    h1: document.querySelector('h1').textContent, title: document.title,
    h2: [...document.querySelectorAll('.berita-article__prose h2')].map(e => e.textContent), lis: document.querySelectorAll('.berita-article__prose li').length,
    note: !!document.querySelector('.berita-article__note'), fallback: !!document.querySelector('.berita-article__figure .berita-media-fallback'),
    author: document.querySelector('.berita-article__author').textContent, next: document.querySelector('.berita-pager__link--next')?.classList.contains('is-index'),
  }));
  ok(s.h1 === 'Hasil Rapat Pengurus <i>Oktober</i>' && s.title === 'Hasil Rapat Pengurus <i>Oktober</i> — PPAPI', 'detail berita kelolaan: h1 + judul dokumen (teks, tidak dieksekusi)', s);
  ok(s.h2.join() === 'Pokok bahasan' && s.lis === 2 && !s.note && s.fallback && s.author === 'Sekretariat PPAPI' && s.next, 'detail: isi terformat, tanpa catatan contoh, pelat cadangan, terbaru → pager ke arsip', s);
  await page.goto(`${BASE}/berita.html?id=memahami-penandaan-perancah`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  ok(await page.locator('h1').textContent() === 'Berita tidak ditemukan.', 'berita yang disembunyikan admin → "Berita tidak ditemukan" pada tautan langsung');
  ok(errors.length === 0, 'tanpa galat', errors);
  await ctx.close();
}

console.log('\n[C2] Agenda — konten kelolaan admin');
{
  const ctx = await managedCtx({ acceptDownloads: true });
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/agenda.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(300);
  let s = await page.evaluate(() => ({
    feature: document.querySelector('.agenda-feature__title')?.textContent.trim(),
    featureContoh: !!document.querySelector('.agenda-feature .badge--contoh'),
    cd: [...document.querySelectorAll('[data-cd="d"],[data-cd="h"],[data-cd="m"]')].map(e => e.textContent).join('/'),
    tabCounts: [...document.querySelectorAll('[data-count-for]')].map(e => e.textContent).join('/'),
    rows: [...document.querySelectorAll('.agenda-row')].map(r => r.id),
    rapat: document.querySelector('#agenda-chips .chip[data-jenis="Rapat"] [data-chip-n]').textContent,
  }));
  ok(s.feature === 'Rapat Teknis Kelolaan Admin' && !s.featureContoh && s.cd === '06/23/00', 'agenda kelolaan terdekat disorot + hitung mundur 6/23/00 (15 Okt 09.00 WIB)', s);
  ok(s.tabCounts === '6/4' && s.rows[0] === 'agenda-rapat-teknis-kelolaan' && !s.rows.includes('agenda-webinar-smkk-pekerjaan-perancah-okt-2026') && s.rapat === '2', 'daftar: +1 kelolaan, −1 tersembunyi (tetap 6 akan datang); chip Rapat = 2', s);
  await page.locator('#agenda-rapat-teknis-kelolaan button[data-agenda-open]').click();
  await page.waitForSelector('.modal .agenda-modal');
  s = await page.evaluate(() => ({ title: document.querySelector('.modal__title').textContent, kuota: [...document.querySelectorAll('.agenda-modal__facts dd')].map(e => e.textContent).join('|') }));
  ok(s.title === 'Rapat Teknis Kelolaan Admin' && /40 peserta/.test(s.kuota) && qsOf(page).get('id') === 'rapat-teknis-kelolaan', 'modal detail agenda kelolaan + ?id=', s);
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.modal [data-agenda-ics]')]);
  const ics = fs.readFileSync(await dl.path(), 'utf8').replace(/\r\n /g, '');
  ok(ics.includes('DTSTART;TZID=Asia/Jakarta:20261015T090000') && ics.includes('STATUS:CONFIRMED') && ics.includes('SUMMARY:Rapat Teknis Kelolaan Admin — PPAPI'), '.ics agenda kelolaan: waktu berzona, CONFIRMED (bukan contoh)');
  await page.keyboard.press('Escape');
  await page.goto(`${BASE}/agenda.html?id=webinar-smkk-pekerjaan-perancah-okt-2026`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  s = await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), toast: document.querySelector('.toast')?.textContent || '' }));
  ok(!s.modal && /tidak ditemukan/.test(s.toast), 'agenda yang disembunyikan admin → tautan langsung memberi toast "tidak ditemukan"', s);
  ok(errors.length === 0, 'tanpa galat', errors);
  await ctx.close();
}

console.log('\n[C3] Agenda — tautan lanjutan (3 kartu, termasuk Materi pelatihan)');
for (const mobile of [false, true]) {
  const ctx = await newCtx({ mobile });
  const errors = [];
  const page = await newPage(ctx, errors);
  await page.goto(`${BASE}/agenda.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  const s = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.agenda-cross__card')];
    return { hrefs: cards.map(c => c.getAttribute('href')), nums: cards.map(c => c.querySelector('.index-num').textContent.replace(/\s+/g, ' ').trim()), cols: new Set(cards.map(c => Math.round(c.getBoundingClientRect().top))).size, h: Math.min(...cards.map(c => c.getBoundingClientRect().height)) };
  });
  const vp = mobile ? '390' : '1440';
  ok(s.hrefs.join('|') === 'berita.html?kategori=Kegiatan|pustaka.html?kategori=modul-pelatihan#katalog|umpan-balik.html?kategori=Saran#formulir' && s.nums.join('|') === '01 / 03|02 / 03|03 / 03', `@${vp}: 3 tautan lanjutan (liputan, materi pelatihan → pustaka, usulan)`, s);
  ok(mobile ? s.cols === 3 : s.cols === 1, `@${vp}: ${mobile ? 'bertumpuk' : 'tiga kolom sebaris'}`, s.cols);
  ok(await overflow(page) <= 1 && errors.length === 0, `@${vp}: tanpa overflow / galat`, errors);
  await ctx.close();
}

console.log('\n[C4] Cadangan bila store.content.list gagal');
{
  const ctx = await newCtx();
  await ctx.route('**/assets/js/store.js', async r => {
    const body = fs.readFileSync(path.join(ROOT, 'assets/js/store.js'), 'utf8') + `\nPPAPI.store.content.list = function () { return Promise.reject(new Error('uji gagal')); };`;
    r.fulfill({ status: 200, contentType: 'text/javascript', body });
  });
  const errors = [], warns = [];
  const page = await ctx.newPage();
  page.on('console', m => { if (/memakai data bawaan/.test(m.text())) warns.push(m.text()); else if (['error', 'warning'].includes(m.type())) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(`${BASE}/berita.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  const b = await page.evaluate(() => [document.querySelectorAll('#berita-grid .news-card').length, document.querySelectorAll('.berita-notice').length, document.querySelectorAll('.berita-agenda__item').length]);
  await page.goto(`${BASE}/agenda.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(250);
  const a = await page.evaluate(() => document.querySelectorAll('.agenda-row').length);
  ok(b.join() === '6,4,3' && a === 6 && warns.length === 4, 'gagal baca konten → data bawaan dipakai (berita 6, pengumuman 4, agenda 3 / 6), satu peringatan per jenis', [b, a, warns.length]);
  ok(errors.length === 0, 'tanpa galat lain', errors);
  await ctx.close();
}

await browser.close();
server.close();
console.log(`\n${pass} lulus, ${fail} gagal.`);
process.exit(fail ? 1 : 0);
