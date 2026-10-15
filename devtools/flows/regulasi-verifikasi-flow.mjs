// Interaction flow for regulasi.html + verifikasi.html.
// Run from devtools/:  node flows/regulasi-verifikasi-flow.mjs [--shots]
// Serves ../site, drives both pages on desktop (1440) and mobile (390) and asserts
// search / filter / sort / URL sync / modal (regulasi) and lookup states (verifikasi).
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots');
const SAVE = process.argv.includes('--shots');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

const U = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const M = { uid: U.uid, name: U.name, email: U.email, phone: U.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14',
  profile: { city: 'Balikpapan', province: 'Kalimantan Timur' },
  competencies: [{ id: 'k1', code: 'SCF-SUP', name: 'Supervisor Perancah', level: 'Mahir', since: 2019, notes: '' }],
  certificates: [], updatedAt: '2026-09-30T08:00:00.000Z' };

let pass = 0, fail = 0;
const ok = (cond, label) => { if (cond) { pass++; console.log('  ✓ ' + label); } else { fail++; console.log('  ✗ ' + label); } };
const shot = async (page, name) => { if (SAVE) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false }); };

const browser = await chromium.launch();
const VPS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];

for (const vp of VPS) {
  console.log(`\n=== ${vp.name} ===`);
  const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1, reducedMotion: 'reduce', locale: 'id-ID' });
  const errors = [];
  const watch = (page) => {
    page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(`${m.type()}: ${m.text()}`); });
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  };
  const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  const click = async (page, sel) => { await page.locator(sel).first().scrollIntoViewIfNeeded(); await page.locator(sel).first().click(); };

  /* ----------------------------- REGULASI ----------------------------- */
  console.log('-- regulasi');
  let page = await ctx.newPage(); watch(page);
  await page.goto(`${BASE}/regulasi.html`, { waitUntil: 'networkidle' });
  const rows = () => page.locator('tr.rg-row:visible').count();
  ok(await page.locator('.rg-key').count() === 6, '6 Regulasi Kunci cards');
  ok(await rows() === 28, '28 rows initially');
  ok(await page.locator('tr.rg-group-row').count() === 2, 'national + international group rows');
  ok((await page.locator('[data-rg="count"]').textContent()).includes('28'), 'count line shows 28');
  ok(await page.locator('.chip[aria-pressed="true"]').count() === 1, 'one chip pressed (Semua)');
  ok((await page.locator('.rg-chip--intl .chip__count').textContent()).trim() === '8', 'intl chip count = 8');

  await page.fill('#rg-q', 'ketinggian');
  await page.waitForTimeout(400);
  const nK = await rows();
  ok(nK > 0 && nK < 28, `search "ketinggian" narrows (${nK})`);
  ok(page.url().includes('q=ketinggian'), 'URL synced with ?q=');
  ok(await page.locator('mark.rg-hl').count() > 0, 'matches highlighted');
  ok(!(await page.locator('[data-rg="reset"]').isHidden()), 'reset button visible while filtered');

  await page.fill('#rg-q', '');
  await page.waitForTimeout(350);
  await click(page, '.rg-chip--intl');
  await page.waitForTimeout(150);
  ok(await rows() === 8, 'jenis = Standar Internasional → 8 rows');
  ok(await page.locator('[data-rg="tbody-nasional"]').isHidden(), 'national group hidden');
  ok(page.url().includes('jenis=standar-internasional'), 'URL synced with ?jenis=');
  ok(await page.locator('.rg-row--intl .rg-title[lang="en"]').count() === 8, 'WCAG 3.1.2: the 8 English standard titles carry lang="en"');
  await shot(page, `rvflow-regulasi-intl-${vp.name}`);

  await click(page, '.chip[data-jenis="Peraturan Menteri"]');
  await page.selectOption('#rg-status', 'Dicabut');
  await page.waitForTimeout(150);
  ok(await rows() === 1, 'Peraturan Menteri + Dicabut → 1 row');
  ok(await page.locator('#reg-permenaker-per-04-men-1987').isVisible(), '… which is PER.04/MEN/1987');
  ok(page.url().includes('status=dicabut'), 'URL synced with ?status=');

  await page.selectOption('#rg-status', '');
  await click(page, '.chip[data-jenis=""]');
  await page.fill('#rg-q', 'zzzz tidak ada');
  await page.waitForTimeout(400);
  ok(await page.locator('[data-rg="empty"] .empty-state').isVisible(), 'empty state for no match');
  ok(await page.locator('[data-rg="results"]').isHidden(), 'table hidden when empty');
  await click(page, '[data-rg-reset]');
  await page.waitForTimeout(150);
  ok(await rows() === 28, 'reset → 28 rows again');
  ok(!page.url().includes('q='), 'URL cleared after reset');

  await page.selectOption('#rg-sort', 'terlama');
  await page.waitForTimeout(150);
  ok((await page.locator('tr.rg-row').first().getAttribute('id')) === 'reg-uu-1-1970', 'sort Terlama → UU 1/1970 first');
  ok(page.url().includes('urut=terlama'), 'URL synced with ?urut=');
  await page.selectOption('#rg-sort', 'jenis');
  await page.waitForTimeout(150);
  ok((await page.locator('tr.rg-row').first().locator('.rg-td-jenis .rg-jenis').textContent()).includes('Undang-Undang'), 'sort Jenis → Undang-Undang first');

  // keyboard: Esc clears search
  await page.fill('#rg-q', 'sni');
  await page.waitForTimeout(350);
  await page.press('#rg-q', 'Escape');
  await page.waitForTimeout(150);
  ok((await page.inputValue('#rg-q')) === '' && await rows() === 28, 'Esc clears the search');

  // modal from a key card
  await click(page, '.rg-key [data-rg-detail]');
  await page.waitForSelector('.modal .modal__dialog');
  ok((await page.locator('.modal__title').textContent()).trim() === 'UU 1/1970', 'Ringkasan modal opens with singkatan as title');
  ok(await page.locator('.modal .rg-modal__rel').isVisible(), 'modal shows relevansi');
  ok(await page.locator('.rg-row:not(.rg-row--intl) .rg-title[lang], .rg-key__title[lang], .modal .rg-modal__title[lang]').count() === 0, 'Indonesian titles carry no lang override');
  await shot(page, `rvflow-regulasi-modal-${vp.name}`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  ok(await page.locator('.modal').count() === 0, 'Esc closes the modal');
  ok(await page.waitForFunction(() => !!document.activeElement && document.activeElement.matches('[data-rg-detail]'), null, { timeout: 2500 }).then(() => true, () => false), 'focus returns to the trigger');
  ok(await overflow(page) <= 1, 'no horizontal overflow');
  await page.close();

  // deep link
  page = await ctx.newPage(); watch(page);
  await page.goto(`${BASE}/regulasi.html?q=EN%2074&jenis=standar-internasional`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  ok((await page.inputValue('#rg-q')) === 'EN 74', 'deep link fills the search box');
  ok(await page.locator('.rg-chip--intl[aria-pressed="true"]').count() === 1, 'deep link presses the jenis chip');
  const nDeep = await rows();
  ok(nDeep >= 1 && nDeep <= 3 && await page.locator('#reg-en-74-1').isVisible(), `deep link → EN 74-1 among ${nDeep} international match(es)`);
  ok(await page.locator('[data-rg="tbody-nasional"]').isHidden(), 'deep link → national group hidden');
  await page.close();

  /* v2: part of Produk Pengetahuan + admin-managed regulations (store.content.list('regulasi')) */
  page = await ctx.newPage(); watch(page);
  await page.goto(`${BASE}/regulasi.html`, { waitUntil: 'networkidle' });
  ok(await page.locator('.page-hero .breadcrumb a[href="pustaka.html"]').count() === 1, 'v2: breadcrumb links back to Produk Pengetahuan');
  ok(await page.locator('[data-rg="pustaka-link"][href="pustaka.html"]').count() === 1, 'v2: library header links to Produk Pengetahuan');
  ok(await page.locator('.rg-cta a[href="pustaka.html"]').count() === 1, 'v2: CTA band links to Produk Pengetahuan');
  ok(await page.locator('.site-nav__link[aria-current]', { hasText: 'Pengetahuan' }).count() + await page.locator('.mobile-menu__link[aria-current]', { hasText: 'Pengetahuan' }).count() >= 1, 'v2: nav marks Pengetahuan as current');
  await page.close();
  const ctxManaged = await browser.newContext({ viewport: vp.viewport, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1, reducedMotion: 'reduce', locale: 'id-ID' });
  await ctxManaged.addInitScript(() => {
    try {
      // what PPAPI.store.content.save / remove write in demo mode (admin console)
      localStorage.setItem('ppapi_content_regulasi', JSON.stringify([
        { id: 'permen-uji-99-2026', jenis: 'Peraturan Menteri', nomor: '99', tahun: 2026, judul: 'Regulasi Uji <img src=x onerror="window.__rgxss=1">', singkatan: 'Permen Uji 99/2026', instansi: 'Kementerian Uji', status: 'Berlaku', relevansi: 'Butir uji yang dikelola admin.', tautan: 'javascript:alert(1)', kunci: true, sumber: [], updatedAt: '2026-10-09T01:00:00.000Z', updatedBy: 'demo-admin-0001' },
        { id: 'uu-27-2022', hidden: true, updatedAt: '2026-10-09T01:00:00.000Z', updatedBy: 'demo-admin-0001' },
      ]));
    } catch (e) {}
  });
  page = await ctxManaged.newPage(); watch(page);
  await page.goto(`${BASE}/regulasi.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  ok(await rows() === 28, 'v2 managed: 28 rows (1 added by admin, 1 hidden)');
  ok(await page.locator('#reg-permen-uji-99-2026').isVisible(), 'v2 managed: admin-added regulation listed');
  ok(await page.locator('#reg-uu-27-2022').count() === 0, 'v2 managed: hidden static regulation removed');
  ok(await page.locator('.rg-key').count() === 7, 'v2 managed: a managed "kunci" item joins Regulasi Kunci (7)');
  ok(await page.evaluate(() => window.__rgxss === undefined), 'v2 managed: markup in a managed title is escaped');
  ok(await page.locator('#reg-permen-uji-99-2026 a[href^="javascript"]').count() === 0 && await page.locator('a[href^="javascript"]').count() === 0, 'v2 managed: unsafe link dropped');
  ok((await page.locator('#reg-permen-uji-99-2026 .rg-title').textContent()).includes('<img'), 'v2 managed: title shown as text');
  await page.close();
  await ctxManaged.close();

  /* ---------------------------- VERIFIKASI ---------------------------- */
  console.log('-- verifikasi');
  page = await ctx.newPage(); watch(page);
  await page.goto(`${BASE}/verifikasi.html`, { waitUntil: 'networkidle' });
  ok(await page.locator('[data-vf="results"] > *').count() === 0, 'no result before searching');
  ok(await page.locator('[data-vf="sample"]').isVisible(), 'sample-data notice visible');
  ok((await page.locator('[data-vf="sample"]').textContent()).includes('Data contoh untuk demonstrasi. Daftar resmi dikelola sekretariat.'), 'sample notice copy');
  ok(await page.locator('.vf-privacy a[href="kebijakan-privasi.html"]').count() === 1, 'privacy note links kebijakan-privasi.html');
  ok(await page.locator('.vf-steps > li').count() === 3, '3-step explainer');
  ok(await page.locator('[data-vf="mine"]').isHidden(), 'no own-KTA shortcut when signed out');

  await click(page, '.vf-form__btn');
  ok(await page.locator('[data-vf="field"].is-invalid').isVisible(), 'empty submit → inline error');
  ok((await page.getAttribute('#vf-q', 'aria-invalid')) === 'true', 'aria-invalid set');

  await page.fill('#vf-q', '  ppapi 2026 000123 ');
  await page.press('#vf-q', 'Enter');
  await page.waitForTimeout(200);
  ok(await page.locator('.vf-result--ok').isVisible(), 'KTA with spaces/lowercase → verified');
  ok((await page.locator('.vf-result__state').textContent()).includes('Terverifikasi'), '"Terverifikasi" label');
  ok((await page.locator('.vf-result__name').textContent()).includes('Andika Prasetya'), 'name shown');
  ok(await page.locator('.vf-result .badge--contoh').count() === 1, 'contoh badge on sample record');
  ok(await page.locator('.vf-comps li').count() === 2, 'kompetensi tags listed');
  ok(page.url().includes('kta='), 'URL synced with ?kta=');
  ok(!(await page.locator('[data-vf="field"]').getAttribute('class')).includes('is-invalid'), 'error cleared');
  await shot(page, `rvflow-verifikasi-ok-${vp.name}`);

  await click(page, '.vf-result [data-copy]');
  await page.waitForSelector('.toast', { timeout: 3000 }).catch(() => {});
  ok(await page.locator('.toast').count() > 0, 'copy link → toast');

  await page.fill('#vf-q', 'PPAPI-2026-999999');
  await page.press('#vf-q', 'Enter');
  await page.waitForTimeout(200);
  ok(await page.locator('.vf-result--none').isVisible(), 'unknown KTA → calm not-found state');
  ok(await page.locator('.vf-result--none a[href="umpan-balik.html"]').count() === 1, 'not-found links to umpan-balik.html');
  await click(page, '[data-vf-again]');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'vf-q'), '"Periksa data lain" focuses the input');

  await page.fill('#vf-q', 'ra');
  await page.press('#vf-q', 'Enter');
  ok((await page.locator('[data-vf="error"]').textContent()).includes('minimal 3 huruf'), 'short name → min-length error');

  await page.fill('#vf-q', 'ari');
  await page.press('#vf-q', 'Enter');
  await page.waitForTimeout(200);
  const nList = await page.locator('.vf-item').count();
  ok(nList === 2, `name search "ari" → ${nList} matches (Maria, Lestari)`);
  ok(await page.locator('.vf-item mark.vf-hl').count() === 2, 'name matches highlighted');
  await shot(page, `rvflow-verifikasi-list-${vp.name}`);
  await click(page, '.vf-item [data-vf-kta]');
  await page.waitForTimeout(200);
  ok(await page.locator('.vf-result').isVisible(), '"Rincian" opens the record');
  ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'vf-r-state'), 'focus moved to the result heading');

  await page.fill('#vf-q', 'PPAPI-2026');
  await page.press('#vf-q', 'Enter');
  await page.waitForTimeout(200);
  ok(await page.locator('.vf-item').count() === 3, 'partial KTA prefix → list of 3');

  await page.fill('#vf-q', '000731');
  await page.press('#vf-q', 'Enter');
  await page.waitForTimeout(200);
  ok((await page.locator('.vf-result__name').textContent()).includes('Maria'), 'digits-only unique match → record');
  ok(await overflow(page) <= 1, 'no horizontal overflow');
  await page.close();

  page = await ctx.newPage(); watch(page);
  await page.goto(`${BASE}/verifikasi.html?kta=PPAPI-2023-000089`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(200);
  ok((await page.inputValue('#vf-q')) === 'PPAPI-2023-000089', '?kta= fills the input');
  ok(await page.locator('.vf-result--warn').isVisible(), '?kta= expired → warn state');
  ok((await page.locator('.vf-result__state').textContent()).includes('Masa berlaku telah habis'), '"Masa berlaku telah habis"');
  await shot(page, `rvflow-verifikasi-expired-${vp.name}`);
  await page.close();

  // signed in: own KTA (not in the public registry)
  const ctxAuth = await browser.newContext({ viewport: vp.viewport, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1, reducedMotion: 'reduce', locale: 'id-ID' });
  await ctxAuth.addInitScript(({ u, m }) => {
    try {
      localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
      const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
      users[u.email] = { ...u, hash: 'x' };
      localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
      localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
    } catch (e) {}
  }, { u: U, m: M });
  page = await ctxAuth.newPage(); watch(page);
  await page.goto(`${BASE}/verifikasi.html`, { waitUntil: 'networkidle' });
  ok(await page.locator('[data-vf="mine"]').isVisible(), 'signed in → "Periksa KTA saya" shortcut');
  await click(page, '[data-vf="mine"] [data-vf-kta]');
  await page.waitForTimeout(200);
  ok(await page.locator('.vf-result--self').isVisible(), 'own KTA → own record card');
  ok((await page.locator('.vf-result__kta').textContent()).includes('PPAPI-2026-004821'), 'own KTA number shown');
  ok((await page.locator('.vf-result--self').textContent()).includes('belum tercantum'), 'explains it is not in the public list');
  await shot(page, `rvflow-verifikasi-self-${vp.name}`);
  await page.fill('#vf-q', 'PPAPI-2026-000123');
  await page.press('#vf-q', 'Enter');
  await page.waitForTimeout(200);
  ok(await page.locator('.vf-result__mine').count() === 0, 'someone else\'s KTA → no "KTA Anda" note');
  await page.close();
  await ctxAuth.close();

  ok(errors.length === 0, 'no console errors/warnings' + (errors.length ? ': ' + errors.join(' | ') : ''));
  await ctx.close();
}

// optional: intermediate widths (tablet / small laptop) for visual review
if (process.argv.includes('--widths')) {
  for (const w of [800, 1024, 1180]) {
    const c = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce', locale: 'id-ID' });
    for (const pg of ['regulasi', 'verifikasi']) {
      const p = await c.newPage();
      await p.goto(`${BASE}/${pg}.html${pg === 'verifikasi' ? '?kta=PPAPI-2026-000123' : ''}`, { waitUntil: 'networkidle' });
      if (pg === 'regulasi') await p.locator('#pustaka').scrollIntoViewIfNeeded();
      await p.waitForTimeout(300);
      const of = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      ok(of <= 1, `${pg} @${w}px: no horizontal overflow`);
      await p.screenshot({ path: path.join(SHOTS, `rvflow-${pg}-w${w}.png`), fullPage: true });
      await p.close();
    }
    await c.close();
  }
}

await browser.close();
server.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
