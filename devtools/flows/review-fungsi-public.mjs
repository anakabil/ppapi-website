// review-fungsi-public — exploratory functional checks of the public pages (desktop + mobile, signed out / Aktif /
// other states where relevant): pustaka, regulasi, berita, agenda (+ .ics content), verifikasi, umpan-balik,
// keanggotaan, profil, index, kebijakan-privasi, 404. REVIEW ONLY.
// Run from devtools/:  node flows/review-fungsi-public.mjs [--only=pustaka,regulasi,berita,agenda,verifikasi,umpan,keanggotaan,profil,index,privasi,404]
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch, newContext, watch, toasts, open, shot, recorder, clickText, RSHOTS, waitReady } from './review-fungsi-lib.mjs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const ONLY = flags.only ? String(flags.only).split(',') : null;
const want = (k) => !ONLY || ONLY.includes(k);
const CLOCK = '2026-10-11T03:00:00.000Z';

const srv = await startServer();
const BASE = srv.BASE;
const browser = await launch();
const R = recorder('review-fungsi-public');
const allIssues = [];
const notes = [];
function note(s) { notes.push(s); console.log('  NOTE  ' + s); }

async function withPage(state, vp, fn, { clock = CLOCK } = {}) {
  const ctx = await newContext(browser, { vp, state, clock });
  const page = await ctx.newPage();
  const issues = watch(page, `[${state}/${vp}] `);
  try { await fn(page, ctx, issues); } catch (e) { R.ok(`${state}/${vp}: scenario threw`, false, e.message.slice(0, 200)); }
  allIssues.push(...issues);
  await ctx.close();
}
const q = (page, sel) => page.evaluate((s) => window.__rv.txt(s), sel);
const qa = (page, sel) => page.evaluate((s) => window.__rv.allVis(s), sel);
const count = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter(e => window.__rv.vis(e)).length, sel);
const urlOf = (page) => page.url().replace(BASE, '');

/* ===================================================== PUSTAKA */
if (want('pustaka')) {
  for (const vp of ['desktop', 'mobile']) {
    await withPage('signed-out', vp, async (page) => {
      await open(page, `${BASE}/pustaka.html`);
      const tiles = await page.evaluate(() => [...document.querySelectorAll('[data-pk="tiles"] li')].map(l => ({ t: window.__rv.txt('.pk-tile__title, h3, strong', l) || l.textContent.replace(/\s+/g, ' ').trim().slice(0, 40), href: (l.querySelector('a') || {}).getAttribute?.('href') || '', n: (l.textContent.match(/\d+/) || [''])[0] })));
      R.ok(`pustaka ${vp} signed-out: 8 collection tiles`, tiles.length === 8, JSON.stringify(tiles.map(t => t.t + '(' + t.n + ')')));
      const n0 = await count(page, '.doc-card');
      const cnt0 = await q(page, '[data-pk="count"]');
      R.ok(`pustaka ${vp}: catalog renders cards`, n0 > 10, `${n0} cards; count text "${cnt0}"`);
      const locked = await count(page, '.doc-card--locked');
      const lockbar = await q(page, '[data-pk="access"]');
      R.ok(`pustaka ${vp} signed-out: lock bar with Masuk + Daftar Menjadi Anggota`, /Masuk/.test(lockbar) && /Daftar Menjadi Anggota/.test(lockbar), lockbar.slice(0, 160));
      note(`pustaka ${vp} signed-out: ${locked}/${n0} cards marked locked`);
      // search
      await page.fill('#pk-q', 'inspeksi');
      await page.waitForTimeout(500);
      const n1 = await count(page, '.doc-card');
      R.ok(`pustaka ${vp}: search "inspeksi" narrows the list`, n1 > 0 && n1 < n0, `${n0} → ${n1}; url ${urlOf(page)}`);
      R.ok(`pustaka ${vp}: URL carries ?q=`, /[?&]q=inspeksi/.test(page.url()), urlOf(page));
      await page.fill('#pk-q', 'zzzz-tidak-ada');
      await page.waitForTimeout(500);
      const empty = await page.evaluate(() => ({ vis: window.__rv.vis(document.querySelector('[data-pk="empty"]')), txt: window.__rv.txt('[data-pk="empty"]'), reset: window.__rv.vis(document.querySelector('[data-pk="reset"]')) }));
      R.ok(`pustaka ${vp}: empty state + reset button for no results`, empty.vis && empty.reset, JSON.stringify(empty).slice(0, 200));
      await page.click('[data-pk="reset"]');
      await page.waitForTimeout(400);
      R.ok(`pustaka ${vp}: reset clears q + URL`, (await page.inputValue('#pk-q')) === '' && !/[?&]q=/.test(page.url()), urlOf(page));
      // chips
      const chips = await page.evaluate(() => [...document.querySelectorAll('[data-pk="chips"] button')].map(b => ({ t: b.textContent.replace(/\s+/g, ' ').trim(), pressed: b.getAttribute('aria-pressed') })));
      R.ok(`pustaka ${vp}: category chips rendered`, chips.length >= 7, JSON.stringify(chips.map(c => c.t)));
      const cop = chips.find(c => /Code of Practice/i.test(c.t));
      if (cop) {
        await page.evaluate((t) => { [...document.querySelectorAll('[data-pk="chips"] button')].find(b => b.textContent.replace(/\s+/g, ' ').trim() === t).click(); }, cop.t);
        await page.waitForTimeout(400);
        const kinds = await qa(page, '[data-pk="results"] .doc-card__kind');
        R.ok(`pustaka ${vp}: chip Code of Practice filters to CoP only`, kinds.length > 0 && kinds.every(k => /Code of Practice/i.test(k)), JSON.stringify([...new Set(kinds)]));
        R.ok(`pustaka ${vp}: URL carries ?kategori=code-of-practice`, /kategori=code-of-practice/.test(page.url()), urlOf(page));
        // keyboard toggle off with Enter
        await page.focus('[data-pk="chips"] button[aria-pressed="true"]');
        await page.keyboard.press('Enter');
        await page.waitForTimeout(400);
        R.ok(`pustaka ${vp}: Enter on pressed chip clears the filter`, !/kategori=/.test(page.url()), urlOf(page));
      }
      // status + sort + view
      const statusOpts = await page.evaluate(() => [...document.querySelectorAll('#pk-status option')].map(o => o.value));
      R.ok(`pustaka ${vp}: status select has options`, statusOpts.length >= 3, JSON.stringify(statusOpts));
      if (vp === 'mobile') { await page.click('[data-pk="saring-toggle"]'); await page.waitForTimeout(300); }
      await page.selectOption('#pk-sort', 'judul');
      await page.waitForTimeout(400);
      const titles = await qa(page, '[data-pk="results"] .doc-card__title');
      const sorted = titles.slice().sort((a, b) => a.localeCompare(b, 'id'));
      R.ok(`pustaka ${vp}: sort Judul A–Z orders titles`, JSON.stringify(titles) === JSON.stringify(sorted), titles.slice(0, 4).join(' | '));
      R.ok(`pustaka ${vp}: URL carries ?urut=judul`, /urut=judul/.test(page.url()), urlOf(page));
      await page.selectOption('#pk-sort', 'katalog');
      // view toggle
      const viewBtn = await page.$('[data-pk="view"] button[data-value="daftar"]');
      if (viewBtn && await viewBtn.isVisible()) {
        await viewBtn.click(); await page.waitForTimeout(400);
        const list = await page.evaluate(() => ({ url: location.search, cls: document.querySelector('[data-pk="results"]').className }));
        R.ok(`pustaka ${vp}: view Daftar switches layout + URL`, /tampilan=daftar/.test(list.url), JSON.stringify(list));
        await page.click('[data-pk="view"] button[data-value="kisi"]');
      } else note(`pustaka ${vp}: view toggle not visible (folded behind Saring on phones)`);
      // detail modal (locked)
      await page.click('[data-pk="results"] .doc-card--locked .doc-card__title button');
      await page.waitForTimeout(600);
      const modal = await page.evaluate(() => { const m = document.querySelector('.modal'); return m ? { title: window.__rv.txt('.modal__title', m), locked: !!m.querySelector('.locked'), cta: window.__rv.allVis('.modal .locked__actions a, .modal .locked__actions .btn'), foot: window.__rv.allVis('.modal__footer .btn'), focus: window.__rv.focused(), url: location.search } : null; });
      R.ok(`pustaka ${vp} signed-out: detail modal shows locked panel + Masuk CTA`, modal && modal.locked && modal.cta.some(c => /Masuk/.test(c)), JSON.stringify(modal));
      R.ok(`pustaka ${vp}: detail modal syncs ?id=`, modal && /[?&]id=/.test(modal.url), modal && modal.url);
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      const after = await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), url: location.search, focus: window.__rv.focused() }));
      R.ok(`pustaka ${vp}: Esc closes detail + removes ?id= + focus returns to card`, !after.modal && !/[?&]id=/.test(after.url) && /doc-card|button/.test(after.focus), JSON.stringify(after));
      // deep links
      await open(page, `${BASE}/pustaka.html?id=aplikasi-simulator`);
      const deep = await page.evaluate(() => { const m = document.querySelector('.modal'); return m ? window.__rv.txt('.modal__title', m) : null; });
      R.ok(`pustaka ${vp}: ?id=aplikasi-simulator opens its detail`, /Simulator/i.test(deep || ''), String(deep));
      await page.keyboard.press('Escape');
      await open(page, `${BASE}/pustaka.html?id=tidak-ada-dokumen`);
      const t2 = await toasts(page);
      const m2 = await page.evaluate(() => !!document.querySelector('.modal'));
      R.ok(`pustaka ${vp}: unknown ?id= → no modal, explains (toast)`, !m2 && t2.length === 1, JSON.stringify(t2));
      await open(page, `${BASE}/pustaka.html?kategori=modul-pelatihan#katalog`);
      await page.waitForTimeout(1200);
      const pos = await page.evaluate(() => ({ y: window.scrollY, hash: location.hash, pressed: window.__rv.all('[data-pk="chips"] button[aria-pressed="true"]') }));
      R.ok(`pustaka ${vp}: ?kategori=modul-pelatihan#katalog lands on the catalog with the chip pressed`, pos.y > 100 && pos.hash === '#katalog' && pos.pressed.some(p => /Modul/i.test(p)), JSON.stringify(pos));
      await shot(page, `pub-pustaka-${vp}-signedout`);
    });
  }
  await withPage('Aktif', 'desktop', async (page) => {
    await open(page, `${BASE}/pustaka.html`);
    const lockbar = await q(page, '[data-pk="access"]');
    R.ok('pustaka Aktif: access bar says full access (no lock)', /Akses penuh/.test(lockbar || '') && !/Masuk/.test(lockbar || ''), String(lockbar).slice(0, 100));
    const lockedCards = await count(page, '.doc-card--locked');
    R.ok('pustaka Aktif: no locked cards', lockedCards === 0, `${lockedCards}`);
    // sample document (tautan '') detail
    await page.click('.doc-card:not(.doc-card--feature) .doc-card__title button');
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => { const m = document.querySelector('.modal'); return { title: window.__rv.txt('.modal__title', m), body: window.__rv.txt('.modal__body', m).slice(0, 300), foot: window.__rv.allVis('.modal__footer .btn, .modal__footer a'), links: [...m.querySelectorAll('a[href]')].map(a => ({ t: a.textContent.trim(), href: a.getAttribute('href'), target: a.target, rel: a.rel })) }; });
    R.ok('pustaka Aktif: sample document (no file) explains instead of a dead link', !m.links.some(l => l.href === '' || l.href === '#'), JSON.stringify(m).slice(0, 400));
    note('pustaka Aktif sample detail: ' + JSON.stringify(m).slice(0, 300));
    await page.keyboard.press('Escape');
    // regulation (public link) detail
    await page.evaluate(() => { [...document.querySelectorAll('[data-pk="chips"] button')].find(b => /Peraturan/.test(b.textContent)).click(); });
    await page.waitForTimeout(400);
    await page.click('.doc-card .doc-card__title button');
    await page.waitForTimeout(600);
    const r = await page.evaluate(() => { const m = document.querySelector('.modal'); return { title: window.__rv.txt('.modal__title', m), links: [...m.querySelectorAll('a[href^="http"]')].map(a => ({ t: a.textContent.trim(), href: a.getAttribute('href'), target: a.target, rel: a.rel })) }; });
    R.ok('pustaka Aktif: regulation detail has an external source link with rel=noopener', r.links.length > 0 && r.links.every(l => l.target === '_blank' && /noopener/.test(l.rel)), JSON.stringify(r).slice(0, 300));
    await page.keyboard.press('Escape');
    // apps
    const apps = await page.evaluate(() => [...document.querySelectorAll('[data-pk="apps"] a[href], [data-pk="apps"] .btn')].map(a => ({ t: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href'), target: a.target })));
    R.ok('pustaka Aktif: app cards link to the internal apps (same tab)', apps.some(a => /aplikasi\/perencanaan/.test(a.href)) && apps.some(a => /aplikasi\/simulator/.test(a.href)) && apps.every(a => a.target !== '_blank'), JSON.stringify(apps));
    // app detail modal → Buka Aplikasi
    await open(page, `${BASE}/pustaka.html?id=aplikasi-perencanaan`);
    await page.waitForTimeout(600);
    const am = await page.evaluate(() => { const m = document.querySelector('.modal'); return m ? { title: window.__rv.txt('.modal__title', m), links: [...m.querySelectorAll('.pk-modal__access a, .modal__footer a')].map(a => ({ t: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href'), target: a.target })) } : null; });
    R.ok('pustaka Aktif: app detail offers "Buka Aplikasi" → aplikasi/perencanaan (same tab)', am && am.links.some(f => /Buka Aplikasi/.test(f.t) && /aplikasi\/perencanaan/.test(f.href || '') && f.target !== '_blank'), JSON.stringify(am));
    await shot(page, 'pub-pustaka-aktif-app-modal');
  });
  for (const st of ['Draf', 'Menunggu Verifikasi', 'Kedaluwarsa']) {
    await withPage(st, 'desktop', async (page) => {
      await open(page, `${BASE}/pustaka.html`);
      const bar = await q(page, '[data-pk="access"]');
      const cta = await qa(page, '[data-pk="access"] .btn');
      const exp = { 'Draf': 'Lengkapi Pendaftaran', 'Menunggu Verifikasi': 'Lihat Status Pendaftaran', 'Kedaluwarsa': 'Ajukan Perpanjangan' }[st];
      R.ok(`pustaka ${st}: lock bar CTA = "${exp}"`, cta.some(c => c.includes(exp)), JSON.stringify(cta) + ' ' + String(bar).slice(0, 120));
    });
  }
}

/* ===================================================== REGULASI */
if (want('regulasi')) {
  for (const vp of ['desktop', 'mobile']) {
    await withPage('signed-out', vp, async (page) => {
      await open(page, `${BASE}/regulasi.html`);
      const rows0 = await count(page, '.rg-tbody tr.rg-row, .rg-tbody > tr');
      const cnt = await q(page, '[data-rg="count"]');
      R.ok(`regulasi ${vp}: table renders 28 regulations`, /28/.test(cnt), `count "${cnt}", rows ${rows0}`);
      await page.fill('#rg-q', 'UU 1/1970'); await page.waitForTimeout(500);
      const c1 = await q(page, '[data-rg="count"]');
      R.ok(`regulasi ${vp}: search "UU 1/1970" finds the act`, /^1 |^1$|\b1 (regulasi|peraturan|hasil|butir)/.test(c1) || /1 dari/.test(c1), c1);
      R.ok(`regulasi ${vp}: URL carries ?q=`, /[?&]q=/.test(page.url()), urlOf(page));
      const marks = await count(page, '.rg-tbody mark');
      R.ok(`regulasi ${vp}: hits are highlighted (<mark>)`, marks > 0, `${marks}`);
      await page.fill('#rg-q', 'xyz-tidak-ada'); await page.waitForTimeout(500);
      const empty = await page.evaluate(() => ({ vis: window.__rv.vis(document.querySelector('[data-rg="empty"]')), reset: window.__rv.vis(document.querySelector('[data-rg="reset"]')) }));
      R.ok(`regulasi ${vp}: empty state + reset`, empty.vis && empty.reset, JSON.stringify(empty));
      await page.click('[data-rg="reset"]'); await page.waitForTimeout(400);
      // sort
      const years = async () => page.evaluate(() => [...document.querySelectorAll('[data-rg="tbody-nasional"] tr')].filter(r => window.__rv.vis(r) && /\d{4}/.test(r.textContent)).map(r => parseInt((r.querySelector('.rg-col-nomor, td:nth-child(2)') || r).textContent.match(/(19|20)\d{2}/)?.[0] || '0', 10)).filter(Boolean));
      await page.selectOption('#rg-sort', 'terlama'); await page.waitForTimeout(400);
      const y1 = await years();
      R.ok(`regulasi ${vp}: sort Terlama = ascending years`, y1.length > 3 && y1.every((y, i) => i === 0 || y >= y1[i - 1]), y1.slice(0, 8).join(','));
      R.ok(`regulasi ${vp}: URL carries ?urut=terlama`, /urut=terlama/.test(page.url()), urlOf(page));
      await page.selectOption('#rg-sort', 'terbaru'); await page.waitForTimeout(400);
      const y2 = await years();
      R.ok(`regulasi ${vp}: sort Terbaru = descending years`, y2.length > 3 && y2.every((y, i) => i === 0 || y <= y2[i - 1]), y2.slice(0, 8).join(','));
      // chip
      const chip = await page.evaluate(() => { const b = [...document.querySelectorAll('[data-rg="chips"] button')].find(b => /Undang-Undang/.test(b.textContent)); if (b) { b.click(); return b.textContent.trim(); } return null; });
      await page.waitForTimeout(400);
      const jenis = await page.evaluate(() => [...document.querySelectorAll('[data-rg="tbody-nasional"] tr')].filter(r => window.__rv.vis(r) && r.querySelectorAll('td').length >= 3).map(r => (r.querySelector('.rg-col-jenis, td:first-child') || r).textContent.replace(/\s+/g, ' ').trim()));
      R.ok(`regulasi ${vp}: chip Undang-Undang filters rows`, chip && jenis.length > 0 && jenis.every(j => /Undang-Undang/.test(j)), JSON.stringify([...new Set(jenis)]).slice(0, 200));
      R.ok(`regulasi ${vp}: URL carries ?jenis=`, /jenis=undang-undang/.test(page.url()), urlOf(page));
      await page.click('[data-rg="reset"]'); await page.waitForTimeout(300);
      // external links
      const ext = await page.evaluate(() => [...document.querySelectorAll('[data-rg="results"] a[href^="http"]')].map(a => ({ target: a.target, rel: a.rel })));
      R.ok(`regulasi ${vp}: all source links open in a new tab with rel=noopener`, ext.length > 20 && ext.every(a => a.target === '_blank' && /noopener/.test(a.rel)), `${ext.length} links; bad ${ext.filter(a => !(a.target === '_blank' && /noopener/.test(a.rel))).length}`);
      // detail modal from key regulations
      await page.click('[data-rg-detail]'); await page.waitForTimeout(500);
      const md = await page.evaluate(() => { const m = document.querySelector('.modal'); return m ? { title: window.__rv.txt('.modal__title', m), rows: window.__rv.all('.modal .kv__row dt', m) } : null; });
      R.ok(`regulasi ${vp}: "Ringkasan" opens a modal with key/value rows`, md && md.rows.length >= 3, JSON.stringify(md).slice(0, 200));
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      if (vp === 'mobile') {
        const acc = await page.evaluate(() => { const b = document.querySelector('[data-rg="tbody-nasional"] [aria-expanded], [data-rg="tbody-nasional"] .accordion__trigger, [data-rg="tbody-nasional"] button'); if (!b) return null; b.click(); return { label: b.textContent.trim().slice(0, 40), expanded: b.getAttribute('aria-expanded') }; });
        R.ok('regulasi mobile: row disclosure ("Ringkasan") expands', acc && acc.expanded === 'true', JSON.stringify(acc));
        await shot(page, 'pub-regulasi-mobile-accordion');
      }
    });
  }
}

/* ===================================================== BERITA */
if (want('berita')) {
  for (const vp of ['desktop', 'mobile']) {
    await withPage('signed-out', vp, async (page) => {
      await open(page, `${BASE}/berita.html`);
      const n0 = await count(page, '#berita-grid .news-card, #berita-grid article');
      const cnt = await q(page, '#berita-count');
      R.ok(`berita ${vp}: archive renders cards`, n0 > 0, `${n0}; "${cnt}"`);
      const notices = await count(page, '#berita-notices li');
      R.ok(`berita ${vp}: pengumuman list rendered`, notices > 0, `${notices}`);
      await page.fill('#berita-q', 'perancah'); await page.waitForTimeout(600);
      const n1 = await count(page, '#berita-grid article');
      const marks = await count(page, '#berita-grid mark');
      R.ok(`berita ${vp}: search filters + highlights`, n1 > 0 && marks > 0 && /[?&]q=perancah/.test(page.url()), `${n0}→${n1}, marks ${marks}, ${urlOf(page)}`);
      await page.fill('#berita-q', ''); await page.waitForTimeout(500);
      const chip = await page.evaluate(() => { const b = [...document.querySelectorAll('#berita-chips button')].find(b => /Edukasi/.test(b.textContent)); if (b) { b.click(); return true; } return false; });
      await page.waitForTimeout(500);
      const kats = await qa(page, '#berita-grid article .tag, #berita-grid article .news-card__kat, #berita-grid article [class*="kategori"]');
      R.ok(`berita ${vp}: chip Edukasi filters + URL ?kategori=`, chip && /kategori=Edukasi/i.test(page.url()), `${urlOf(page)} kats=${JSON.stringify([...new Set(kats)]).slice(0, 120)}`);
      await page.click('#berita-reset'); await page.waitForTimeout(400);
      const more = await page.$('#berita-more-btn');
      if (more && await more.isVisible()) {
        const before = await count(page, '#berita-grid article');
        await more.click(); await page.waitForTimeout(500);
        const after = await count(page, '#berita-grid article');
        R.ok(`berita ${vp}: "Muat lebih banyak" appends cards`, after > before, `${before}→${after}`);
      } else note(`berita ${vp}: no "Muat lebih banyak" (all ${n0} shown)`);
      // detail
      const first = await page.evaluate(() => { const a = document.querySelector('#berita-grid article a[href*="?id="]'); return a ? a.getAttribute('href') : null; });
      R.ok(`berita ${vp}: cards link to ?id= detail`, !!first, String(first));
      await open(page, `${BASE}/${first}`);
      const det = await page.evaluate(() => ({ hidden: document.getElementById('berita-detail').hidden, listHidden: document.getElementById('berita-list').hidden, h1: window.__rv.txt('#berita-detail h1'), title: document.title, share: window.__rv.allVis('.berita-share__item'), pager: [...document.querySelectorAll('.berita-pager__link')].map(a => ({ t: a.textContent.replace(/\s+/g, ' ').trim().slice(0, 50), href: a.getAttribute('href'), rel: a.rel })), related: document.querySelectorAll('.berita-related__item').length, canonical: (document.querySelector('link[rel=canonical]') || {}).href }));
      R.ok(`berita ${vp}: detail view renders (list hidden, h1, title)`, !det.hidden && det.listHidden && det.h1 && det.title.includes(det.h1.slice(0, 20)), JSON.stringify(det).slice(0, 300));
      R.ok(`berita ${vp}: share menu offers copy link`, det.share.some(s => /Salin tautan/.test(s)), JSON.stringify(det.share));
      R.ok(`berita ${vp}: prev/next pager rendered`, det.pager.length === 2 && det.pager.some(p => p.href), JSON.stringify(det.pager));
      R.ok(`berita ${vp}: related articles rendered`, det.related > 0, `${det.related}`);
      await page.evaluate(() => { const b = document.querySelector('[data-share-copy]'); if (b) b.click(); });
      await page.waitForTimeout(500);
      const t1 = await toasts(page);
      R.ok(`berita ${vp}: "Salin tautan" → one toast`, t1.length === 1, JSON.stringify(t1));
      const copied = await page.evaluate(() => document.querySelector('[data-share-copy]')?.getAttribute('data-share-copy'));
      R.ok(`berita ${vp}: copied link is an absolute URL of this article`, /^https?:\/\/.*berita\.html\?id=/.test(copied || ''), String(copied));
      // next → navigates
      const nextHref = det.pager.find(p => /berikutnya|sebelumnya/.test(p.t) && p.href)?.href;
      if (nextHref) {
        await page.click(`.berita-pager__link[href="${nextHref}"]`); await waitReady(page); await page.waitForTimeout(500);
        const h = await q(page, '#berita-detail h1');
        R.ok(`berita ${vp}: pager link navigates to another article`, page.url().includes(nextHref.replace('berita.html', '')) && h !== det.h1, `${urlOf(page)} h1=${h}`);
        await page.goBack(); await waitReady(page); await page.waitForTimeout(600);
        const back = await q(page, '#berita-detail h1');
        R.ok(`berita ${vp}: browser Back returns to the previous article`, back === det.h1, `${back} vs ${det.h1}`);
      }
      await open(page, `${BASE}/berita.html?id=tidak-ada`);
      const unk = await page.evaluate(() => ({ detail: !document.getElementById('berita-detail').hidden, txt: window.__rv.txt('#berita-detail') || window.__rv.txt('main').slice(0, 200), status: document.title }));
      R.ok(`berita ${vp}: unknown ?id= shows a not-found message (no blank page)`, /tidak ditemukan|tidak tersedia|Berita tidak/i.test(unk.txt), JSON.stringify(unk).slice(0, 200));
      await shot(page, `pub-berita-${vp}-unknown`);
      await open(page, `${BASE}/berita.html?kategori=Kegiatan#arsip`);
      await page.waitForTimeout(1200);
      const pos = await page.evaluate(() => ({ y: window.scrollY, hash: location.hash, pressed: window.__rv.all('#berita-chips button[aria-pressed="true"]') }));
      R.ok(`berita ${vp}: ?kategori=Kegiatan#arsip lands on the archive with the chip pressed`, pos.y > 100 && pos.hash === '#arsip' && pos.pressed.some(p => /Kegiatan/.test(p)), JSON.stringify(pos));
    });
  }
}

/* ===================================================== AGENDA */
if (want('agenda')) {
  for (const vp of ['desktop', 'mobile']) {
    await withPage('signed-out', vp, async (page, ctx) => {
      await open(page, `${BASE}/agenda.html`);
      const cnt = await q(page, '#agenda-count');
      const rows = await count(page, '.event-row');
      const tabs = await page.evaluate(() => [...document.querySelectorAll('#agenda-tabs button')].map(b => ({ t: b.textContent.replace(/\s+/g, ' ').trim(), on: b.getAttribute('aria-pressed') })));
      R.ok(`agenda ${vp}: upcoming list rendered with counts on tabs`, rows > 0 && tabs.length === 2 && tabs.every(t => /\d/.test(t.t)), `${rows} rows; ${JSON.stringify(tabs)}; "${cnt}"`);
      const feat = await page.evaluate(() => ({ vis: window.__rv.vis(document.querySelector('.agenda-feature:not(.agenda-feature--placeholder)')), cd: window.__rv.txt('.agenda-feature [class*="countdown"], .agenda-feature .agenda-cd, .agenda-feature__aside'), title: window.__rv.txt('#agenda-next-title') }));
      R.ok(`agenda ${vp}: "Agenda terdekat" feature with countdown`, feat.vis && /\d/.test(feat.cd || ''), JSON.stringify(feat).slice(0, 200));
      await page.click('#agenda-tabs button[data-value="telah-berlangsung"]'); await page.waitForTimeout(500);
      const past = await count(page, '.event-row');
      R.ok(`agenda ${vp}: "Telah Berlangsung" tab lists past events + URL ?tab=`, past > 0 && /tab=/.test(page.url()), `${past}; ${urlOf(page)}`);
      const icsPast = await count(page, '.event-row [data-agenda-ics]');
      R.ok(`agenda ${vp}: past events offer no calendar button`, icsPast === 0, `${icsPast}`);
      await page.click('#agenda-tabs button[data-value="akan-datang"]'); await page.waitForTimeout(400);
      await page.click('#agenda-mode button[data-value="Daring"]'); await page.waitForTimeout(400);
      const modes = await qa(page, '.event-row .badge--outline');
      R.ok(`agenda ${vp}: mode Daring filters + URL ?mode=`, /mode=daring/i.test(page.url()) && modes.every(m => /Daring/.test(m) || !/Luring|Hybrid/.test(m)), `${urlOf(page)} ${JSON.stringify([...new Set(modes)])}`);
      await page.click('#agenda-mode button[data-value=""]'); await page.waitForTimeout(300);
      const chip = await page.evaluate(() => { const b = [...document.querySelectorAll('#agenda-chips button')].find(b => /Pelatihan/.test(b.textContent)); if (b) { b.click(); return b.textContent.trim(); } return null; });
      await page.waitForTimeout(400);
      R.ok(`agenda ${vp}: jenis chip filters + URL ?jenis=`, chip && /jenis=pelatihan/i.test(page.url()), urlOf(page));
      const reset = await page.$('#agenda-reset');
      R.ok(`agenda ${vp}: reset button appears when filtered`, reset && await reset.isVisible());
      await page.click('#agenda-reset'); await page.waitForTimeout(400);
      R.ok(`agenda ${vp}: reset clears URL`, !/jenis=|mode=/.test(page.url()), urlOf(page));
      // detail modal
      const firstId = await page.evaluate(() => document.querySelector('.event-row [data-agenda-open]')?.getAttribute('data-agenda-open'));
      await page.click('.event-row button[data-agenda-open]'); await page.waitForTimeout(600);
      const md = await page.evaluate(() => { const m = document.querySelector('.modal'); return m ? { title: window.__rv.txt('.modal__title', m), url: location.search, foot: window.__rv.allVis('.modal__footer .btn'), ics: !!m.querySelector('[data-agenda-ics]'), reg: [...m.querySelectorAll('a[href^="http"]')].map(a => ({ target: a.target, rel: a.rel })) } : null; });
      R.ok(`agenda ${vp}: detail modal opens + URL ?id=`, md && md.title && /[?&]id=/.test(md.url), JSON.stringify(md).slice(0, 250));
      R.ok(`agenda ${vp}: modal external links rel=noopener`, !md || md.reg.every(a => a.target === '_blank' && /noopener/.test(a.rel)), JSON.stringify(md && md.reg));
      // .ics download from the modal
      const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 8000 }).catch(() => null), page.click('.modal [data-agenda-ics]')]);
      if (dl) {
        const p = await dl.path();
        const txt = fs.readFileSync(p, 'utf8');
        const lines = txt.split('\r\n');
        const badLen = lines.filter(l => Buffer.byteLength(l, 'utf8') > 75);
        const req = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:', 'BEGIN:VEVENT', 'UID:', 'DTSTAMP:', 'DTSTART', 'SUMMARY:', 'END:VEVENT', 'END:VCALENDAR'];
        const missing = req.filter(r => !txt.includes(r));
        R.ok(`agenda ${vp}: .ics download "${dl.suggestedFilename()}" is a valid RFC 5545 object`, missing.length === 0 && badLen.length === 0 && txt.endsWith('\r\n') && /\.ics$/.test(dl.suggestedFilename()), `missing ${JSON.stringify(missing)}; >75 octet lines ${badLen.length}`);
        const dtstart = (txt.match(/DTSTART[^\r\n]*/) || [''])[0];
        const dtend = (txt.match(/DTEND[^\r\n]*/) || [''])[0];
        R.ok(`agenda ${vp}: .ics DTSTART/DTEND well-formed`, /DTSTART(;TZID=[^:]+)?:\d{8}(T\d{6})?|DTSTART;VALUE=DATE:\d{8}/.test(dtstart), `${dtstart} | ${dtend}`);
        fs.writeFileSync(path.join(RSHOTS, `agenda-${vp}.ics`), txt);
        note(`agenda ${vp} ics: ${dtstart} ${dtend} ${(txt.match(/SUMMARY:[^\r\n]*/) || [''])[0]}`);
      } else R.ok(`agenda ${vp}: .ics download fires`, false);
      const t = await toasts(page);
      R.ok(`agenda ${vp}: ics toast shown once`, t.filter(x => /kalender/i.test(x)).length === 1, JSON.stringify(t));
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      const after = await page.evaluate(() => ({ modal: !!document.querySelector('.modal'), url: location.search, focus: window.__rv.focused() }));
      R.ok(`agenda ${vp}: Esc closes modal, ?id removed, focus returns to the row`, !after.modal && !/[?&]id=/.test(after.url) && /agenda-open|event-row|button|a\./.test(after.focus), JSON.stringify(after));
      // deep link
      await open(page, `${BASE}/agenda.html?id=${encodeURIComponent(firstId)}`);
      const deep = await page.evaluate(() => !!document.querySelector('.modal'));
      R.ok(`agenda ${vp}: ?id= deep link opens the detail`, deep);
      await page.keyboard.press('Escape');
      await open(page, `${BASE}/agenda.html?id=tidak-ada`);
      const tt = await toasts(page);
      R.ok(`agenda ${vp}: unknown ?id= → explanatory toast`, tt.some(x => /tidak ditemukan/i.test(x)), JSON.stringify(tt));
      await shot(page, `pub-agenda-${vp}`);
    });
  }
}

/* ===================================================== VERIFIKASI */
if (want('verifikasi')) {
  for (const vp of ['desktop', 'mobile']) {
    await withPage('signed-out', vp, async (page) => {
      await open(page, `${BASE}/verifikasi.html?kta=PPAPI-2025-000318`);
      await page.waitForTimeout(500);
      const r = await page.evaluate(() => ({ txt: window.__rv.txt('[data-vf="results"]').slice(0, 300), state: window.__rv.txt('[data-vf="results"] .vf-result__state, [data-vf="results"] h3, [data-vf="results"] .vf-result__title'), input: document.getElementById('vf-q').value }));
      R.ok(`verifikasi ${vp}: ?kta= of the seeded demo approval (Dimas) verifies`, /Dimas/.test(r.txt) && /Terverifikasi|Aktif/i.test(r.txt), JSON.stringify(r).slice(0, 250));
      await open(page, `${BASE}/verifikasi.html?kta=PPAPI-2026-000123`);
      const s = await q(page, '[data-vf="results"]');
      R.ok(`verifikasi ${vp}: static sample KTA shows a result card`, /PPAPI-2026-000123/.test(s || ''), String(s).slice(0, 200));
      const contoh = await count(page, '[data-vf="results"] .badge--contoh');
      R.ok(`verifikasi ${vp}: sample result carries a Contoh badge`, contoh > 0, `${contoh}`);
      await open(page, `${BASE}/verifikasi.html?kta=PPAPI-2023-000089`);
      const ex = await q(page, '[data-vf="results"]');
      R.ok(`verifikasi ${vp}: expired sample is flagged as expired`, /berakhir|habis|Kedaluwarsa/i.test(ex || ''), String(ex).slice(0, 200));
      await open(page, `${BASE}/verifikasi.html?kta=PPAPI-2026-999999`);
      const nf = await q(page, '[data-vf="results"]');
      R.ok(`verifikasi ${vp}: unknown KTA → "tidak ditemukan/tidak terdaftar" card`, /tidak (ditemukan|terdaftar|tercatat)/i.test(nf || ''), String(nf).slice(0, 200));
      // name search
      await open(page, `${BASE}/verifikasi.html`);
      await page.fill('#vf-q', 'Siti'); await page.click('.vf-form__btn'); await page.waitForTimeout(600);
      const nm = await page.evaluate(() => ({ txt: window.__rv.txt('[data-vf="results"]').slice(0, 200), n: document.querySelectorAll('[data-vf="results"] [data-vf-kta]').length, url: location.search }));
      R.ok(`verifikasi ${vp}: name search lists matches + URL ?kta=`, nm.n >= 1 && /kta=Siti/i.test(nm.url), JSON.stringify(nm).slice(0, 200));
      // empty + junk
      await page.fill('#vf-q', ''); await page.click('.vf-form__btn'); await page.waitForTimeout(300);
      const e1 = await page.evaluate(() => ({ err: window.__rv.txt('[data-vf="error"]'), inv: document.getElementById('vf-q').getAttribute('aria-invalid'), focus: window.__rv.focused() }));
      R.ok(`verifikasi ${vp}: empty submit → inline error, aria-invalid, focus on input`, e1.err && e1.inv === 'true' && /vf-q/.test(e1.focus), JSON.stringify(e1));
      await page.fill('#vf-q', '!!'); await page.click('.vf-form__btn'); await page.waitForTimeout(300);
      const e2 = await q(page, '[data-vf="error"]');
      R.ok(`verifikasi ${vp}: junk "!!" → validation message`, !!e2, String(e2));
      await page.fill('#vf-q', 'ppapi 2026 000123'); await page.click('.vf-form__btn'); await page.waitForTimeout(500);
      const sp = await q(page, '[data-vf="results"]');
      R.ok(`verifikasi ${vp}: spaced/lowercase KTA still matches`, /PPAPI-2026-000123/.test(sp || ''), String(sp).slice(0, 120));
      await shot(page, `pub-verifikasi-${vp}`);
    });
  }
  for (const st of ['Aktif', 'Kedaluwarsa', 'Nonaktif', 'Draf']) {
    await withPage(st, 'desktop', async (page) => {
      await open(page, `${BASE}/verifikasi.html`);
      const mine = await page.evaluate(() => ({ vis: window.__rv.vis(document.querySelector('[data-vf="mine"]')), txt: window.__rv.txt('[data-vf="mine"]') }));
      if (st === 'Draf') R.ok(`verifikasi ${st}: no "Periksa KTA saya" (no KTA yet)`, !mine.vis, JSON.stringify(mine));
      else {
        R.ok(`verifikasi ${st}: "Periksa KTA saya" shown`, mine.vis && /Periksa KTA saya/.test(mine.txt), JSON.stringify(mine));
        await page.click('[data-vf="mine"] [data-vf-kta]'); await page.waitForTimeout(600);
        const res = await q(page, '[data-vf="results"]');
        const expect = { 'Aktif': /Terverifikasi|Aktif/i, 'Kedaluwarsa': /berakhir|habis|perpanjangan/i, 'Nonaktif': /tidak aktif|Nonaktif|dinonaktifkan/i }[st];
        R.ok(`verifikasi ${st}: own record shows the right state`, expect.test(res || ''), String(res).slice(0, 220));
        R.ok(`verifikasi ${st}: own record is marked as "KTA Anda"`, /KTA Anda|Ini adalah KTA Anda/i.test(res || ''), String(res).slice(0, 120));
      }
    });
  }
}

/* ===================================================== UMPAN BALIK */
if (want('umpan')) {
  for (const vp of ['desktop', 'mobile']) {
    await withPage('signed-out', vp, async (page) => {
      await open(page, `${BASE}/umpan-balik.html?kategori=Saran`);
      const pre = await page.evaluate(() => ({ checked: document.querySelector('input[name="kategori"]:checked')?.value, hint: window.__rv.txt('[data-ub-kat-hint]') }));
      R.ok(`umpan ${vp}: ?kategori=Saran preselects + hint`, pre.checked === 'Saran' && pre.hint, JSON.stringify(pre));
      await page.click('label:has(input[value="Pengaduan"])'); await page.waitForTimeout(200);
      const h2 = await q(page, '[data-ub-kat-hint]');
      R.ok(`umpan ${vp}: switching category changes the hint`, h2 !== pre.hint, h2);
      // empty submit
      await page.click('[data-ub-submit]'); await page.waitForTimeout(400);
      const errs = await page.evaluate(() => ({ errs: window.__rv.allVis('.field__error').filter(Boolean), inv: [...document.querySelectorAll('[aria-invalid="true"]')].map(e => e.id), focus: window.__rv.focused(), alert: window.__rv.txt('[data-ub-alert]') }));
      R.ok(`umpan ${vp}: empty submit → errors on nama, email, subjek, pesan, consent + focus first`, errs.inv.includes('ub-nama') && errs.inv.includes('ub-pesan') && errs.inv.includes('ub-consent') && /ub-nama/.test(errs.focus), JSON.stringify(errs).slice(0, 300));
      await page.fill('#ub-nama', 'Al'); await page.fill('#ub-email', 'bukan-email'); await page.fill('#ub-phone', '12345'); await page.fill('#ub-subjek', 'Uji'); await page.fill('#ub-pesan', 'pendek');
      await page.click('[data-ub-submit]'); await page.waitForTimeout(400);
      const e2 = await page.evaluate(() => ({ nama: window.__rv.txt('#ub-nama-err'), email: window.__rv.txt('#ub-email-err'), phone: window.__rv.txt('#ub-phone-err'), pesan: window.__rv.txt('#ub-pesan-err') }));
      R.ok(`umpan ${vp}: short name / bad email / bad phone / short message each rejected`, e2.nama && e2.email && e2.phone && e2.pesan, JSON.stringify(e2));
      // anonymous
      await page.check('#ub-anon'); await page.waitForTimeout(200);
      const anon = await page.evaluate(() => ({ nama: document.getElementById('ub-nama').disabled, email: document.getElementById('ub-email').disabled, phone: document.getElementById('ub-phone').disabled, vals: [document.getElementById('ub-nama').value, document.getElementById('ub-email').value] }));
      R.ok(`umpan ${vp}: anonymous disables + clears identity fields`, anon.nama && anon.email && anon.phone && anon.vals.every(v => v === ''), JSON.stringify(anon));
      await page.uncheck('#ub-anon'); await page.waitForTimeout(200);
      const restored = await page.evaluate(() => [document.getElementById('ub-nama').value, document.getElementById('ub-email').value]);
      R.ok(`umpan ${vp}: unchecking anonymous restores typed values`, restored[0] === 'Al' && restored[1] === 'bukan-email', JSON.stringify(restored));
      // rating + clear
      await page.click('label[for="ub-r4"]'); await page.waitForTimeout(150);
      const rl = await page.evaluate(() => ({ label: window.__rv.txt('[data-ub-rating-label]'), clear: window.__rv.vis(document.querySelector('[data-ub-rating-clear]')) }));
      R.ok(`umpan ${vp}: rating 4 shows label + clear`, /4|Baik/i.test(rl.label) && rl.clear, JSON.stringify(rl));
      await page.click('[data-ub-rating-clear]'); await page.waitForTimeout(150);
      const rl2 = await page.evaluate(() => ({ label: window.__rv.txt('[data-ub-rating-label]'), checked: !!document.querySelector('input[name="rating"]:checked') }));
      R.ok(`umpan ${vp}: clear rating resets`, !rl2.checked && /Belum/i.test(rl2.label), JSON.stringify(rl2));
      // overlong message (maxlength 2000) — type 2100 chars
      await page.fill('#ub-pesan', 'x'.repeat(2100));
      const len = await page.evaluate(() => document.getElementById('ub-pesan').value.length);
      const counter = await q(page, '[data-ub-counter]');
      R.ok(`umpan ${vp}: message capped at 2.000 characters + counter`, len <= 2000 && /2\.000 \/ 2\.000|2000/.test(counter), `${len} "${counter}"`);
      // valid submit
      await page.fill('#ub-nama', 'Penguji Fungsi'); await page.fill('#ub-email', 'penguji@contoh.id'); await page.fill('#ub-phone', '0812-3456-7890'); await page.fill('#ub-subjek', 'Uji kirim umpan balik'); await page.fill('#ub-pesan', 'Pesan uji fungsional yang cukup panjang untuk lolos validasi.');
      await page.click('label[for="ub-r5"]'); await page.check('#ub-consent');
      await page.click('[data-ub-submit]'); await page.waitForTimeout(900);
      const ok = await page.evaluate(() => ({ success: window.__rv.vis(document.querySelector('[data-ub-success]')), ref: window.__rv.txt('[data-ub-ref]'), txt: window.__rv.txt('[data-ub-success]').slice(0, 300), formHidden: !window.__rv.vis(document.querySelector('[data-ub-form]')), focus: window.__rv.focused(), stored: (() => { try { return JSON.parse(localStorage.getItem('ppapi_feedback') || '[]').length; } catch (e) { return -1; } })() }));
      R.ok(`umpan ${vp}: valid submit → success panel with reference id UB-YYYYMMDD-xxxx`, ok.success && /^UB-\d{8}-/.test(ok.ref || ''), JSON.stringify(ok).slice(0, 300));
      R.ok(`umpan ${vp}: feedback stored (demo)`, ok.stored >= 1, `${ok.stored}`);
      const t = await toasts(page);
      R.ok(`umpan ${vp}: success toast exactly once`, t.filter(x => /berhasil dikirim/i.test(x)).length === 1, JSON.stringify(t));
      R.ok(`umpan ${vp}: success summary shows phone normalised (+62 812-3456-7890)`, /\+62 812-3456-7890/.test(ok.txt), ok.txt.slice(0, 200));
      await shot(page, `pub-umpan-${vp}-success`);
      await clickText(page, 'Kirim umpan balik lain').catch(() => {});
      await page.waitForTimeout(400);
      const again = await page.evaluate(() => ({ form: window.__rv.vis(document.querySelector('[data-ub-form]')), nama: document.getElementById('ub-nama').value, pesan: document.getElementById('ub-pesan').value, consent: document.getElementById('ub-consent').checked }));
      R.ok(`umpan ${vp}: "Kirim umpan balik lain" shows an empty form`, again.form && again.pesan === '' && !again.consent, JSON.stringify(again));
    });
  }
  await withPage('Aktif', 'desktop', async (page) => {
    await open(page, `${BASE}/umpan-balik.html`);
    const pre = await page.evaluate(() => ({ signed: window.__rv.txt('[data-ub-signed]'), nama: document.getElementById('ub-nama').value, email: document.getElementById('ub-email').value, phone: document.getElementById('ub-phone').value }));
    R.ok('umpan Aktif: signed-in prefill (name, email, phone)', pre.nama === 'Rahmat Hidayat' && /rahmat/.test(pre.email) && /812/.test(pre.phone), JSON.stringify(pre));
  });
}

/* ===================================================== KEANGGOTAAN + PROFIL + INDEX (CTA per state) */
if (want('keanggotaan') || want('profil') || want('index')) {
  const EXP = {
    'signed-out': { kea: 'Mulai Pendaftaran', idx: 'Bergabung Menjadi Anggota', prof: /Daftar|Bergabung|Mulai/ },
    'Draf': { kea: 'Mulai Pendaftaran', idx: 'Lengkapi Pendaftaran', prof: /Lengkapi Pendaftaran/ },
    'Menunggu Verifikasi': { kea: 'Lihat Status Pendaftaran', idx: 'Lihat Status Pendaftaran', prof: /Lihat Status Pendaftaran/ },
    'Perlu Perbaikan': { kea: 'Perbaiki Pengajuan', idx: 'Perbaiki Pengajuan', prof: /Perbaiki Pengajuan/ },
    'Aktif': { kea: 'Buka Dasbor Anggota', idx: 'Buka Dasbor Anggota', prof: /Buka Dasbor Anggota/ },
    'Ditolak': { kea: 'Ajukan Ulang', idx: 'Ajukan Ulang', prof: /Ajukan Ulang/ },
    'Nonaktif': { kea: 'Ajukan Perpanjangan', idx: 'Ajukan Perpanjangan', prof: /Ajukan Perpanjangan/ },
    'Kedaluwarsa': { kea: 'Ajukan Perpanjangan', idx: 'Ajukan Perpanjangan', prof: /Ajukan Perpanjangan/ },
    'admin': { kea: /Buka Dasbor|Konsol/, idx: 'Buka Dasbor Anggota', prof: /Buka Dasbor|Konsol/ },
  };
  for (const st of Object.keys(EXP)) {
    await withPage(st, 'desktop', async (page) => {
      if (want('keanggotaan')) {
        await open(page, `${BASE}/keanggotaan.html`);
        const c = await page.evaluate(() => [...document.querySelectorAll('[data-cta-daftar]')].map(a => ({ t: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href') })));
        const e = EXP[st].kea;
        R.ok(`keanggotaan ${st}: CTA label "${e}" (all ${c.length} buttons consistent)`, c.length === 3 && c.every(x => (e instanceof RegExp ? e.test(x.t) : x.t === e)), JSON.stringify(c));
        const alur = await count(page, '[data-alur] > li');
        R.ok(`keanggotaan ${st}: alur has 5 steps`, alur === 5, `${alur}`);
        if (st === 'signed-out') {
          const faq = await page.evaluate(() => [...document.querySelectorAll('[data-faq] button, [data-faq] summary, [data-faq] .accordion__trigger')].length);
          R.ok('keanggotaan: FAQ has 8 items', faq === 8, `${faq}`);
          await page.click('[data-faq] button, [data-faq] summary, [data-faq] .accordion__trigger'); await page.waitForTimeout(300);
          const opened = await page.evaluate(() => { const b = document.querySelector('[data-faq] button, [data-faq] summary, [data-faq] .accordion__trigger'); const d = b.closest('details'); return d ? d.open : b.getAttribute('aria-expanded') === 'true'; });
          R.ok('keanggotaan: FAQ item toggles open', opened);
          await open(page, `${BASE}/keanggotaan.html#alur`); await page.waitForTimeout(1200);
          const pos = await page.evaluate(() => ({ y: window.scrollY, top: document.getElementById('alur').getBoundingClientRect().top, hash: location.hash }));
          R.ok('keanggotaan: #alur deep link lands on the section', pos.y > 200 && Math.abs(pos.top) < 160 && pos.hash === '#alur', JSON.stringify(pos));
        }
        const me = await page.evaluate(() => ({ vis: window.__rv.vis(document.querySelector('[data-akses-me]')), txt: window.__rv.txt('[data-akses-me]')?.slice(0, 160) }));
        if (st !== 'signed-out') R.ok(`keanggotaan ${st}: "Akses Anggota" shows the viewer's own status`, me.vis && !!me.txt, JSON.stringify(me));
      }
      if (want('index')) {
        await open(page, `${BASE}/index.html`);
        const c = await page.evaluate(() => [...document.querySelectorAll('[data-cta-join]')].map(a => ({ t: a.textContent.replace(/\s+/g, ' ').trim(), href: a.getAttribute('href'), short: a.hasAttribute('data-cta-short') })));
        const e = EXP[st].idx;
        const longLabel = c.find(x => !x.short)?.t;
        R.ok(`index ${st}: hero CTA "${e}"`, longLabel === e, JSON.stringify(c));
        const apps = await page.evaluate(() => [...document.querySelectorAll('#apps-cards .home-app')].map(a => ({ locked: a.classList.contains('is-locked'), btn: window.__rv.allVis('a.btn, .btn', a), hrefs: [...a.querySelectorAll('a[href]')].map(x => x.getAttribute('href')) })));
        const activeLike = st === 'Aktif' || st === 'admin';
        R.ok(`index ${st}: app cards ${activeLike ? 'open (link to aplikasi/)' : 'locked'}`, apps.length === 2 && apps.every(a => activeLike ? (!a.locked && a.hrefs.some(h => /aplikasi\//.test(h))) : a.locked), JSON.stringify(apps).slice(0, 300));
        const guestOnly = await page.evaluate(() => [...document.querySelectorAll('[data-guest-only]')].map(e => e.hidden));
        R.ok(`index ${st}: "Masuk di sini" ${st === 'signed-out' ? 'visible' : 'hidden'}`, guestOnly.every(h => h === (st !== 'signed-out')), JSON.stringify(guestOnly));
        if (st === 'signed-out') {
          const lists = await page.evaluate(() => ({ news: document.querySelectorAll('#news-list article, #news-list a').length, agenda: document.querySelectorAll('#agenda-list li, #agenda-list a').length, reg: document.querySelectorAll('#reg-list li').length, pk: document.querySelectorAll('#pk-grid li').length, pilar: document.querySelectorAll('#pilar-grid > *').length, track: document.querySelectorAll('#cta-track li').length, stats: document.getElementById('home-stats').hidden }));
          R.ok('index: data sections rendered (news, agenda, regulasi, pengetahuan, pilar, track)', lists.news > 0 && lists.agenda > 0 && lists.reg > 0 && lists.pk > 0 && lists.pilar === 4 && lists.track === 5, JSON.stringify(lists));
          const cue = await page.evaluate(() => { const a = document.querySelector('.home-hero__cue'); return a ? a.getAttribute('href') : null; });
          R.ok('index: scroll cue targets #tentang', cue === '#tentang', String(cue));
        }
      }
      if (want('profil')) {
        await open(page, `${BASE}/profil.html`);
        const c = await page.evaluate(() => ({ btns: window.__rv.allVis('[data-cta-actions] .btn'), status: window.__rv.txt('[data-cta-status]') }));
        R.ok(`profil ${st}: CTA matches ${EXP[st].prof}`, c.btns.some(b => EXP[st].prof.test(b)), JSON.stringify(c));
      }
    });
  }
}

/* ===================================================== KEBIJAKAN PRIVASI + 404 */
if (want('privasi')) {
  for (const vp of ['desktop', 'mobile']) {
    await withPage('signed-out', vp, async (page) => {
      await open(page, `${BASE}/kebijakan-privasi.html`);
      const toc = await page.evaluate(() => [...document.querySelectorAll('.kp-toc__list a')].map(a => ({ h: a.getAttribute('href'), ok: !!document.getElementById(a.getAttribute('href').slice(1)) })));
      R.ok(`privasi ${vp}: every TOC link targets an existing section`, toc.length >= 13 && toc.every(t => t.ok), JSON.stringify(toc.filter(t => !t.ok)));
      const sel = vp === 'mobile' ? '.kp-toc-mobile summary' : null;
      if (sel) { await page.click(sel); await page.waitForTimeout(200); }
      const link = vp === 'mobile' ? '.kp-toc-mobile .kp-toc__list a[href="#hak"]' : '.kp-toc .kp-toc__list a[href="#hak"]';
      await page.click(link); await page.waitForTimeout(700);
      const pos = await page.evaluate(() => ({ hash: location.hash, top: document.getElementById('hak').getBoundingClientRect().top, y: window.scrollY, current: window.__rv.all('.kp-toc a[aria-current], .kp-toc .is-active') }));
      R.ok(`privasi ${vp}: TOC click scrolls to the section (#hak in view)`, pos.hash === '#hak' && pos.top > -20 && pos.top < 200, JSON.stringify(pos));
      const date = await q(page, 'main');
      R.ok(`privasi ${vp}: policy dated 9 Oktober 2026`, /9 Oktober 2026/.test(date || ''));
    });
  }
}
if (want('404')) {
  for (const vp of ['desktop', 'mobile']) {
    await withPage('signed-out', vp, async (page) => {
      await open(page, `${BASE}/a/b/c/halaman-tidak-ada?x=1`);
      const info = await page.evaluate(() => ({ h1: window.__rv.txt('h1'), path: window.__rv.txt('[data-nf-path]'), base: document.querySelector('base')?.href, nav: [...document.querySelectorAll('.site-nav__link, .nf__links a, .nf__actions a')].map(a => a.href), css: getComputedStyle(document.documentElement).getPropertyValue('--c-black').trim() !== '', credit: window.__rv.txt('.site-footer__credit') }));
      R.ok(`404 ${vp}: nested path renders styled page + shows the requested address`, info.css && /halaman-tidak-ada/.test(info.path || '') && /tidak ditemukan/i.test(info.h1 || ''), JSON.stringify(info).slice(0, 300));
      R.ok(`404 ${vp}: links resolve to the site root (not /a/b/c/…)`, info.nav.length > 5 && info.nav.every(h => !/\/a\/b\/c\//.test(h)), JSON.stringify(info.nav.slice(0, 4)));
      await page.click('.nf__actions a.btn--primary'); await waitReady(page);
      R.ok(`404 ${vp}: "Kembali ke Beranda" reaches index`, /\/(index\.html)?$/.test(page.url()), urlOf(page));
      await page.goBack(); await page.waitForTimeout(400);
      await page.click('.skip-link', { force: true }).catch(() => {});
      const f = await page.evaluate(() => window.__rv.focused());
      R.ok(`404 ${vp}: skip link focuses main (base href handled locally)`, /main#main/.test(f), f);
    });
  }
}

await browser.close();
await srv.close();
const failed = R.summary();
console.log('\nIssues captured (console/page/request):', allIssues.length);
allIssues.slice(0, 40).forEach(i => console.log('  ! ' + i));
console.log('\nNotes:'); notes.forEach(n => console.log('  - ' + n));
process.exit(failed ? 1 : 0);
