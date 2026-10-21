// Integration flow (2026-10-21): the four features built in parallel, wired into the shared files.
// Run from the workspace root:  node devtools/flows/integrasi-flow.mjs [--shots]
//
// I1 Konsol Admin: generic mount of window.PPAPI_ADMIN_SECTIONS (nav items 08 Instruktur · 09 Kegiatan ·
//    10 Toko, section shells with eyebrow/title/lead, hash routing incl. sub-routes, render on open and on
//    "Muat Ulang Data", nav counts), old sections still work, Konten › Agenda marked as the simple editor.
// I2 Header/footer/account menu: 9 nav items (Instruktur, Toko), aria-current via aktifJuga on keranjang/
//    pesanan, footer links (Instruktur, Toko, Verifikasi Sertifikat), account menu Kegiatan Saya + Pesanan Saya.
// I3 Dasbor: Kegiatan Saya mounted in the visible view (Aktif and status view), #kegiatan-saya anchor,
//    published kegiatan merged into the dashboard and home agenda strips.
// I4 robots/noindex: keranjang + pesanan noindex; toko, instruktur, sertifikat indexable.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, ROOT, SHOTS, DEMO_USER, DEMO_MEMBER, registryEntryFor } from './qa-lib.mjs';

const SAVE = process.argv.includes('--shots');
fs.mkdirSync(SHOTS, { recursive: true });
const { BASE, close } = await startServer();
const browser = await chromium.launch();
let pass = 0, fail = 0; const fails = [];
const ok = (c, l, d) => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; fails.push(l); console.log('  ✗ ' + l + (d !== undefined ? '  — ' + JSON.stringify(d).slice(0, 400) : '')); } };
const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
const errors = [];

async function ctxFor(kind, vp = { width: 1440, height: 900 }, mobile = false) {
  const ctx = await browser.newContext({ viewport: vp, isMobile: mobile, hasTouch: mobile, deviceScaleFactor: mobile ? 2 : 1, reducedMotion: 'reduce', locale: 'id-ID' });
  await ctx.addInitScript(({ kind, a, u, m, r }) => {
    try {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      if (kind === 'admin') {
        localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
        localStorage.setItem('ppapi_demo_admins', JSON.stringify([a.uid]));
      } else if (kind === 'aktif' || kind === 'draf') {
        localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
        localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(kind === 'draf' ? Object.assign({}, m, { status: 'Draf', kta: '', approvedAt: '', approvedBy: '', validUntil: '' }) : m));
        if (kind === 'aktif') localStorage.setItem('ppapi_registry', JSON.stringify({ [r.kta]: r }));
      }
    } catch (e) { /* ignore */ }
  }, { kind, a: ADMIN, u: DEMO_USER, m: DEMO_MEMBER, r: registryEntryFor(DEMO_MEMBER) });
  const page = await ctx.newPage();
  page.on('console', msg => { if (['error', 'warning'].includes(msg.type())) errors.push(`${kind}: console.${msg.type()}: ${msg.text()}`); });
  page.on('pageerror', e => errors.push(`${kind}: pageerror: ${e.message}`));
  page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(BASE)) errors.push(`${kind}: HTTP ${r.status()} ${r.url()}`); });
  return { ctx, page };
}
const ready = page => page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady(), null, { timeout: 15000 });
const shot = async (page, name, full = false) => { if (SAVE) await page.screenshot({ path: path.join(SHOTS, `integrasi-${name}.png`), fullPage: full }); };

/* ===================================================================== I1 */
console.log('\n[I1] Konsol Admin — bagian tambahan');
{
  const { ctx, page } = await ctxFor('admin');
  await page.goto(BASE + '/admin.html');
  await ready(page);
  await page.waitForSelector('html[data-admin-ready]');
  const nav = await page.$$eval('.adm-nav__link', as => as.map(a => [a.getAttribute('data-section'), a.querySelector('.adm-nav__num').textContent, a.querySelector('.adm-nav__text').textContent]));
  ok(JSON.stringify(nav.map(n => n[0])) === JSON.stringify(['ringkasan', 'permohonan', 'anggota', 'konten', 'umpan-balik', 'admin', 'log', 'instruktur', 'kegiatan', 'toko']), 'menu konsol: 7 bagian bawaan + Instruktur, Kegiatan, Toko', nav);
  ok(nav.every((n, i) => n[1] === String(i + 1).padStart(2, '0')), 'nomor menu 01–10 berurutan', nav.map(n => n[1]));
  ok(await page.evaluate(() => PPAPI_KONSOL.SECTIONS.join() === 'ringkasan,permohonan,anggota,konten,umpan-balik,admin,log,instruktur,kegiatan,toko'), 'K.SECTIONS memuat rute bagian tambahan');
  const shells = await page.$$eval('.adm-section', ss => ss.map(s => [s.id, s.getAttribute('aria-labelledby'), !!s.querySelector('#' + s.getAttribute('aria-labelledby')), (s.querySelector('.eyebrow') || {}).textContent]));
  ok(['sec-instruktur', 'sec-kegiatan', 'sec-toko'].every(id => shells.some(s => s[0] === id && s[2])), 'kerangka bagian + judul berlabel untuk ketiga bagian', shells);
  ok(shells.find(s => s[0] === 'sec-kegiatan')[3] === '09 — Kegiatan' && shells.find(s => s[0] === 'sec-toko')[3] === '10 — Toko', 'eyebrow bagian tambahan: "09 — Kegiatan", "10 — Toko"', shells.slice(-3));
  ok(await page.evaluate(() => document.querySelector('#h-toko em') && document.querySelector('#h-kegiatan em') && !!document.querySelector('#sec-toko .adm-head__lead')), 'judul (dengan <em>) dan pengantar terpasang');
  ok(await page.evaluate(() => [...document.querySelectorAll('.adm-section')].filter(s => !s.hidden).map(s => s.id).join() === 'sec-ringkasan'), 'hanya Ringkasan terlihat saat dibuka');

  for (const [hash, sel, label] of [['#kegiatan', '#kegiatan-body .kga, #kegiatan-body .empty-state', 'Kegiatan'], ['#toko', '#toko-body [role="tablist"], #toko-body .adm-subnav, #toko-body .empty-state, #toko-body table', 'Toko'], ['#instruktur/permintaan', '#instruktur-body', 'Instruktur › Permintaan']]) {
    await page.evaluate(h => { location.hash = h; }, hash);
    await page.waitForFunction(h => !document.getElementById('sec-' + h.slice(1).split('/')[0]).hidden, hash);
    await page.waitForFunction(h => { const b = document.getElementById(h.slice(1).split('/')[0] + '-body'); return b && !b.hasAttribute('aria-busy') && !b.querySelector('.skeleton') && b.textContent.trim().length > 20; }, hash, { timeout: 10000 }).catch(() => {});
    const st = await page.evaluate(h => {
      const key = h.slice(1).split('/')[0];
      return { cur: (document.querySelector('.adm-nav__link[aria-current="page"]') || {}).getAttribute && document.querySelector('.adm-nav__link[aria-current="page"]').getAttribute('data-section'),
        visible: [...document.querySelectorAll('.adm-section')].filter(s => !s.hidden).map(s => s.id), err: !!document.querySelector('#' + key + '-body .alert--err'),
        focus: document.activeElement && document.activeElement.id, hash: location.hash, len: document.getElementById(key + '-body').textContent.trim().length };
    }, hash);
    const key = hash.slice(1).split('/')[0];
    ok(st.cur === key && st.visible.join() === 'sec-' + key && !st.err && st.len > 20 && st.focus === 'h-' + key, `${label}: rute ${hash} membuka bagiannya, isi tampil, fokus ke judul`, st);
    await shot(page, 'admin-' + key, false);
  }
  ok(await page.evaluate(() => location.hash) === '#instruktur/permintaan', 'sub-rute #instruktur/permintaan dipertahankan');
  ok(await page.evaluate(() => !!document.querySelector('#instruktur-body [aria-current="page"], #instruktur-body [aria-selected="true"]') && /permintaan/i.test((document.querySelector('#instruktur-body [aria-current="page"], #instruktur-body [aria-selected="true"]') || {}).textContent || '')), 'sub-tab Permintaan aktif');

  /* refresh re-renders the open extra section */
  await page.evaluate(() => { location.hash = '#toko'; });
  await page.waitForFunction(() => !document.getElementById('sec-toko').hidden);
  await page.evaluate(() => { document.getElementById('toko-body').setAttribute('data-stale', '1'); document.getElementById('toko-body').insertAdjacentHTML('afterbegin', '<p id="__stale">x</p>'); });
  await page.click('#adm-refresh');
  await page.waitForFunction(() => !document.getElementById('__stale'), null, { timeout: 10000 }).catch(() => {});
  ok(await page.evaluate(() => !document.getElementById('__stale')), '"Muat Ulang Data" merender ulang bagian tambahan yang terbuka');

  /* nav count from badge(): one Toko order waiting for confirmation */
  const cnt = await page.evaluate(async () => {
    const n = await PPAPI.toko.admin.summary().then(s => s.perluTindakan, () => null);
    PPAPI_KONSOL.renderCounts();
    await new Promise(r => setTimeout(r, 300));
    const el = document.querySelector('[data-count-for="toko"]');
    return { n, el: !!el, hidden: el ? el.hidden : null, text: el ? el.textContent : '' };
  });
  ok(cnt.el && (cnt.n ? !cnt.hidden && cnt.text.startsWith(String(cnt.n)) : cnt.hidden), 'penghitung menu Toko mengikuti badge()', cnt);
  ok(await page.evaluate(() => !!document.querySelector('.adm-nav__link[data-section="instruktur"] [data-count-for="instruktur"]') && !document.querySelector('.adm-nav__link[data-section="kegiatan"] .adm-nav__count')), 'penghitung: Instruktur ada (count()), Kegiatan tanpa penghitung');

  /* old sections keep working */
  for (const sec of ['permohonan', 'anggota', 'konten', 'umpan-balik', 'admin', 'log', 'ringkasan']) {
    await page.evaluate(s => { location.hash = '#' + s; }, sec);
    await page.waitForFunction(s => !document.getElementById('sec-' + s).hidden && !document.getElementById(s + '-body').hasAttribute('aria-busy'), sec, { timeout: 8000 }).catch(() => {});
    const st = await page.evaluate(s => ({ vis: !document.getElementById('sec-' + s).hidden, busy: document.getElementById(s + '-body').hasAttribute('aria-busy'), err: !!document.querySelector('#' + s + '-body > .alert--err') }), sec);
    ok(st.vis && !st.busy && !st.err, `bagian bawaan #${sec} tetap berfungsi`, st);
  }
  await page.evaluate(() => { location.hash = '#konten/agenda'; });
  await page.waitForSelector('#konten-body .adm-legacy-note');
  ok(await page.evaluate(() => /Agenda sederhana \(lama\)/.test(document.querySelector('.adm-legacy-note').textContent) && document.querySelector('.adm-legacy-note a[href="#kegiatan"]')), 'Konten › Agenda: ditandai editor lama, tautan ke bagian Kegiatan');
  await page.click('.adm-legacy-note a[href="#kegiatan"]');
  await page.waitForFunction(() => !document.getElementById('sec-kegiatan').hidden);
  ok(true, 'tautan "Kegiatan" dari Konten › Agenda membuka bagian Kegiatan');
  /* log groups */
  const lg = await page.evaluate(async () => {
    location.hash = '#log';
    await new Promise(r => setTimeout(r, 300));
    return [...document.querySelectorAll('[data-chips="log-group"] .chip')].map(c => c.getAttribute('data-value'));
  });
  ok(lg.includes('instruktur') && lg.includes('kegiatan'), 'Log Aktivitas: kelompok Instruktur dan Kegiatan', lg);

  /* mobile: horizontal tab strip still reachable */
  await ctx.close();
  const mob = await ctxFor('admin', { width: 390, height: 844 }, true);
  await mob.page.goto(BASE + '/admin.html#toko');
  await ready(mob.page);
  await mob.page.waitForSelector('html[data-admin-ready]');
  await mob.page.waitForTimeout(500);
  const mv = await mob.page.evaluate(() => { const a = document.querySelector('.adm-nav__link[aria-current="page"]'); const r = a.getBoundingClientRect(); return { key: a.getAttribute('data-section'), inView: r.left >= -1 && r.right <= innerWidth + 1, overflow: document.documentElement.scrollWidth > innerWidth }; });
  ok(mv.key === 'toko' && mv.inView && !mv.overflow, 'ponsel: tab Toko aktif terlihat, tanpa geser halaman', mv);
  await shot(mob.page, 'admin-toko-mobile', false);
  await mob.ctx.close();
}

/* ===================================================================== I2 */
console.log('\n[I2] Header, footer, menu akun');
{
  const { ctx, page } = await ctxFor('aktif');
  await page.goto(BASE + '/keranjang.html');
  await ready(page);
  const H = await page.evaluate(() => ({
    nav: [...document.querySelectorAll('.site-nav__link')].map(a => [a.textContent, a.getAttribute('href'), a.getAttribute('aria-current')]),
    mob: [...document.querySelectorAll('.mobile-menu__link')].length,
    foot: [...document.querySelectorAll('.site-footer__links a')].map(a => a.getAttribute('href'))
  }));
  ok(H.nav.map(n => n[0]).join('|') === 'Beranda|Profil|Berita|Agenda|Pengetahuan|Instruktur|Keanggotaan|Toko|Kontak', 'menu utama: 9 tautan termasuk Instruktur dan Toko', H.nav);
  ok(H.nav.find(n => n[0] === 'Toko')[2] === 'true' && H.mob === 9, 'keranjang.html menandai Toko (aria-current="true"); menu seluler 9 tautan', H.nav);
  ok(['instruktur.html', 'toko.html', 'sertifikat.html'].every(f => H.foot.includes(f)), 'footer: Direktori Instruktur, Toko PPAPI, Verifikasi Sertifikat');
  await page.click('.account__trigger');
  const menu = await page.$$eval('#account-menu [role=menuitem]', as => as.map(a => [a.textContent.trim(), a.getAttribute('href')]));
  ok(menu.map(m => m[0]).join('|') === 'Dasbor|Profil Anggota|Produk Pengetahuan|Aplikasi Anggota|Kegiatan Saya|Pesanan Saya|Keluar', 'menu akun (Aktif): … Kegiatan Saya, Pesanan Saya, Keluar', menu);
  ok(menu.find(m => m[0] === 'Kegiatan Saya')[1] === 'dashboard.html#kegiatan-saya' && menu.find(m => m[0] === 'Pesanan Saya')[1] === 'pesanan.html', 'tautan: dashboard.html#kegiatan-saya, pesanan.html');
  await page.locator('#account-menu [role=menuitem]', { hasText: 'Kegiatan Saya' }).click();
  await page.waitForURL(/dashboard\.html#kegiatan-saya/);
  await ready(page);
  await page.waitForFunction(() => { const s = document.getElementById('kegiatan-saya'); return s && !s.hidden && !document.querySelector('#dash-kegiatan[aria-busy]') && document.getElementById('dash-kegiatan').textContent.length > 20; }, null, { timeout: 10000 });
  await page.waitForTimeout(400);
  const K = await page.evaluate(() => { const s = document.getElementById('kegiatan-saya'); const r = s.getBoundingClientRect(); return { top: Math.round(r.top), inActive: !!s.closest('#dash-active-view'), focus: document.activeElement === s, title: (s.querySelector('.kgs__title') || {}).textContent }; });
  ok(K.inActive && K.top < 300 && K.focus, 'Kegiatan Saya: di tampilan Aktif, digulir ke atas layar, fokus ke bagian', K);
  await shot(page, 'dashboard-kegiatan-saya', false);
  await ctx.close();

  const dr = await ctxFor('draf');
  await dr.page.goto(BASE + '/dashboard.html');
  await ready(dr.page);
  await dr.page.waitForFunction(() => { const s = document.getElementById('kegiatan-saya'); return s && !s.hidden && document.getElementById('dash-kegiatan').textContent.length > 20; }, null, { timeout: 10000 });
  ok(await dr.page.evaluate(() => !!document.getElementById('kegiatan-saya').closest('#dash-status-view') && document.getElementById('kegiatan-saya').nextElementSibling.classList.contains('dash-help')), 'Kegiatan Saya juga tampil untuk akun Draf (pusat status, sebelum Informasi keanggotaan)');
  await dr.page.click('.account__trigger');
  const dm = await dr.page.$$eval('#account-menu [role=menuitem]', as => as.map(a => a.textContent.trim()).join('|'));
  ok(dm === 'Dasbor|Formulir Pendaftaran|Kegiatan Saya|Pesanan Saya|Keluar', 'menu akun (Draf): Dasbor, Formulir Pendaftaran, Kegiatan Saya, Pesanan Saya, Keluar', dm);
  await dr.ctx.close();

  /* phone: full-screen menu lists all 9 items without horizontal scroll */
  const mb = await ctxFor('aktif', { width: 390, height: 844 }, true);
  await mb.page.goto(BASE + '/toko.html');
  await ready(mb.page);
  await mb.page.click('.menu-toggle');
  await mb.page.waitForSelector('.mobile-menu.is-open');
  await mb.page.waitForTimeout(500);
  const mm = await mb.page.evaluate(() => ({ labels: [...document.querySelectorAll('.mobile-menu__label')].map(x => x.textContent), cur: (document.querySelector('.mobile-menu__link[aria-current]') || {}).textContent || '', wide: [...document.querySelectorAll('.mobile-menu__link')].some(a => a.scrollWidth > a.clientWidth + 1), ov: document.querySelector('.mobile-menu').scrollWidth > innerWidth }));
  ok(mm.labels.length === 9 && mm.labels.includes('Instruktur') && mm.labels.includes('Toko') && /Toko/.test(mm.cur) && !mm.wide && !mm.ov, 'ponsel: menu layar penuh 9 tautan, Toko ditandai, tanpa terpotong', mm);
  await shot(mb.page, 'mobile-menu', true);
  await mb.ctx.close();
}

/* ===================================================================== I3 */
console.log('\n[I3] Kegiatan terbit di pita agenda beranda & dasbor');
{
  const { ctx, page } = await ctxFor('admin');
  await page.goto(BASE + '/admin.html#kegiatan');
  await ready(page);
  await page.waitForSelector('html[data-admin-ready]');
  const saved = await page.evaluate(async () => {
    const K = PPAPI.kegiatan;
    const mulai = Date.now() + 5 * 864e5;
    const ev = await K.admin.save({ judul: 'Webinar Uji Integrasi Perancah', jenis: 'Webinar', mode: 'Daring', akses: 'semua', status: 'terbit', mulai, selesai: mulai + 2 * 3600e3, deskripsi: 'Uji integrasi.', kuota: 50 });
    const items = await K.asAgendaItems();
    return { id: ev && ev.id, items: items.map(x => [x.id, x.judul, x.mulai]) };
  }).catch(e => ({ err: String(e && e.message || e) }));
  ok(saved.id && saved.items.some(i => i[0] === saved.id), 'kegiatan terbit tersedia lewat PPAPI.kegiatan.asAgendaItems()', saved);
  await page.goto(BASE + '/index.html');
  await ready(page);
  await page.waitForFunction(() => document.querySelector('#agenda-list') && !document.querySelector('#agenda-list .skeleton'), null, { timeout: 8000 }).catch(() => {});
  ok(await page.evaluate(() => /Webinar Uji Integrasi Perancah/.test(document.getElementById('agenda-list').textContent)), 'beranda: kegiatan terbit tampil di pita agenda');
  await page.goto(BASE + '/dashboard.html');
  await ready(page);
  await page.waitForFunction(() => document.getElementById('dash-agenda') && !document.getElementById('dash-agenda').hasAttribute('aria-busy'), null, { timeout: 8000 }).catch(() => {});
  ok(await page.evaluate(() => /Webinar Uji Integrasi Perancah/.test(document.getElementById('dash-agenda').textContent) && !!document.querySelector('#dash-agenda a[href^="agenda.html?id="]')), 'dasbor: kegiatan terbit tampil di Kegiatan Mendatang (tautan ke detail agenda)');
  await ctx.close();
}

/* ===================================================================== I4 */
console.log('\n[I4] robots / noindex');
{
  const meta = f => (/<meta name="robots" content="([^"]*)"/.exec(fs.readFileSync(path.join(ROOT, f), 'utf8')) || [])[1] || '';
  ok(/noindex/.test(meta('keranjang.html')) && /noindex/.test(meta('pesanan.html')), 'keranjang.html dan pesanan.html: noindex');
  ok(['toko.html', 'instruktur.html', 'sertifikat.html'].every(f => !/noindex/.test(meta(f))), 'toko, instruktur, sertifikat: boleh diindeks');
  const robots = fs.readFileSync(path.join(ROOT, 'robots.txt'), 'utf8');
  ok(!/Disallow:\s*\/(toko|instruktur|sertifikat|keranjang|pesanan)/.test(robots), 'robots.txt tidak memblokir halaman (noindex tetap terbaca)');
  const csp = f => (/Content-Security-Policy" content="([^"]*)"/.exec(fs.readFileSync(path.join(ROOT, f), 'utf8')) || [])[1] || '';
  ok(['admin.html', 'dashboard.html'].every(f => /script-src[^;]*https:\/\/cdnjs\.cloudflare\.com/.test(csp(f)) && /frame-src[^;]*https:\/\/docs\.google\.com/.test(csp(f))), 'CSP admin & dasbor: cdnjs (jsPDF) dan docs.google.com (formulir)');
}

ok(errors.length === 0, 'tanpa galat konsol/halaman/HTTP', errors.slice(0, 6));
await browser.close();
await close();
console.log(`\nintegrasi-flow: ${pass}/${pass + fail} passed` + (fails.length ? ' — FAILED: ' + fails.join(' | ') : ''));
process.exit(fail ? 1 : 0);
