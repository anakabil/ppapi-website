// Probe for the pustaka + regulasi + verifikasi fix round (design audit ad2).
// Run from devtools/:  node flows/fix-prv-probe.mjs [--rev=<git-rev>]
// Measures page/section heights on pustaka (desktop 1440 / phone 390), modal focus + meta, lang="en"
// on international titles (pustaka, regulasi), and saves screenshots to devtools/shots/fixprv/.
// --rev serves site files from a git revision instead of the working tree (before/after comparison).
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const OUT = path.resolve(__dirname, '..', 'shots', 'fixprv');
fs.mkdirSync(OUT, { recursive: true });
const REV = (process.argv.find(a => a.startsWith('--rev=')) || '').split('=')[1] || '';
const TAG = REV ? 'rev-' + REV : 'now';
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.json': 'application/json' };
function readSite(rel) {
  if (!REV) { const f = path.join(ROOT, rel); return fs.existsSync(f) && !fs.statSync(f).isDirectory() ? fs.readFileSync(f) : null; }
  try { return execFileSync('git', ['show', `${REV}:${rel.replace(/\\/g, '/')}`], { cwd: ROOT, maxBuffer: 64 << 20 }); } catch (e) { return null; }
}
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const rel = p.replace(/^\/+/, '');
  if (rel.includes('..')) { res.writeHead(404); return res.end(); }
  const buf = readSite(rel);
  if (!buf) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(rel).toLowerCase()] || 'application/octet-stream' });
  res.end(buf);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();
const VPS = [
  { name: 'desktop', viewport: { width: 1440, height: 900 } },
  { name: 'mobile', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];
const result = {};
const errors = [];
for (const vp of VPS) {
  const ctx = await browser.newContext({ viewport: vp.viewport, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.deviceScaleFactor || 1, reducedMotion: 'reduce', locale: 'id-ID' });
  const page = await ctx.newPage();
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) errors.push(`${vp.name} ${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => errors.push(`${vp.name} pageerror: ${e.message}`));
  await page.goto(`${BASE}/pustaka.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady());
  await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 700) { scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } scrollTo(0, 0); });
  await page.waitForTimeout(300);
  const m = await page.evaluate(() => {
    const hgt = s => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : null; };
    return {
      docH: document.documentElement.scrollHeight,
      hero: hgt('.pk-hero'), koleksi: hgt('#koleksi'), katalog: hgt('#katalog'), toolbar: hgt('[data-pk="toolbar"]'),
      results: hgt('[data-pk="results"]'), aplikasi: hgt('#aplikasi'),
      shelfHead: hgt('.pk-shelf__head'), shelfDescs: document.querySelectorAll('.pk-shelf__desc').length,
      heroMeta: (document.querySelector('[data-pk="hero-meta"]') || {}).textContent,
      tile0: (document.querySelector('.pk-tile') || {}).innerText,
      tile1: (document.querySelectorAll('.pk-tile')[1] || {}).innerText,
      overflow: document.documentElement.scrollWidth - innerWidth,
    };
  });
  result[vp.name] = m;
  if (!REV) {
    const shotEl = async (sel, name) => { const l = page.locator(sel).first(); await l.scrollIntoViewIfNeeded(); await l.screenshot({ path: path.join(OUT, `${name}-${vp.name}.png`) }); };
    await page.screenshot({ path: path.join(OUT, `pustaka-top-${vp.name}.png`) });
    await shotEl('#koleksi', 'pustaka-koleksi');
    await shotEl('[data-pk="toolbar"]', 'pustaka-toolbar');
    if (vp.name === 'mobile') {
      await page.click('[data-pk="saring-toggle"]');
      await page.selectOption('#pk-status', 'Berlaku');
      await page.waitForTimeout(200);
      await shotEl('[data-pk="toolbar"]', 'pustaka-toolbar-saring');
      await page.selectOption('#pk-status', '');
      await page.click('[data-pk="saring-toggle"]');
      await page.waitForTimeout(150);
    }
    // first two shelves
    const s1 = page.locator('.pk-shelf').nth(0);
    await s1.scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(OUT, `pustaka-shelf1-${vp.name}.png`), clip: await (async () => { const b = await s1.boundingBox(); const y = b.y; return { x: 0, y: Math.max(0, y - 20), width: vp.viewport.width, height: Math.min(vp.viewport.height, b.height + 40) }; })() });
    await page.screenshot({ path: path.join(OUT, `pustaka-full-${vp.name}.png`), fullPage: true });
    // locked modal
    await page.locator('[data-pk-open="d:cop-inspeksi-penandaan"]').scrollIntoViewIfNeeded();
    await page.click('[data-pk-open="d:cop-inspeksi-penandaan"]');
    await page.waitForSelector('.modal .modal__dialog');
    await page.waitForTimeout(400);
    result[vp.name].modal = await page.evaluate(() => ({
      focus: document.activeElement && (document.activeElement.className + ' | ' + document.activeElement.textContent.slice(0, 40)),
      title: document.title, desc: document.querySelector('meta[name="description"]').content,
      ogT: document.querySelector('meta[property="og:title"]').content, canon: (document.querySelector('link[rel="canonical"]') || {}).href || '',
      kv: [...document.querySelectorAll('.modal .kv__row dt')].map(e => e.textContent),
      lock: (document.querySelector('.modal .locked') || {}).innerText,
    }));
    await page.screenshot({ path: path.join(OUT, `pustaka-modal-locked-${vp.name}.png`) });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    // intl standard modal (lang)
    const more = page.locator('[data-pk-more="Standar"]');
    if (await more.count()) { await more.scrollIntoViewIfNeeded(); await more.click(); await page.waitForTimeout(150); }
    await page.locator('[data-pk-open="r:en-12811-1"]').scrollIntoViewIfNeeded();
    await page.click('[data-pk-open="r:en-12811-1"]');
    await page.waitForSelector('.modal .modal__dialog');
    await page.waitForTimeout(400);
    result[vp.name].intlModal = await page.evaluate(() => ({ titleLang: document.querySelector('.modal__title').getAttribute('lang'), title: document.title }));
    await page.screenshot({ path: path.join(OUT, `pustaka-modal-intl-${vp.name}.png`) });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
    result[vp.name].afterClose = await page.evaluate(() => ({ title: document.title, desc: document.querySelector('meta[name="description"]').content.slice(0, 40) }));

    // regulasi: lang="en" on intl titles in table, modal title
    await page.goto(`${BASE}/regulasi.html?jenis=standar-internasional`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(300);
    result[vp.name].regulasi = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.rg-row')];
      return {
        intlRows: rows.filter(r => r.classList.contains('rg-row--intl')).length,
        intlWithLang: rows.filter(r => r.classList.contains('rg-row--intl') && r.querySelector('.rg-title[lang="en"]')).length,
        natWithLang: [...document.querySelectorAll('.rg-row:not(.rg-row--intl) .rg-title[lang]')].length,
        overflow: document.documentElement.scrollWidth - innerWidth,
      };
    });
    const firstIntl = page.locator('.rg-row--intl').first();
    await firstIntl.scrollIntoViewIfNeeded();
    await firstIntl.screenshot({ path: path.join(OUT, `regulasi-intl-row-${vp.name}.png`) });
  }
  await ctx.close();
}
// active-member modal (unlocked) on desktop
if (!REV) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'id-ID' });
  const USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
  const MEMBER = { uid: USER.uid, name: USER.name, email: USER.email, phone: USER.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31', approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001', profile: {}, competencies: [], certificates: [], updatedAt: '2026-09-30T08:00:00.000Z' };
  await ctx.addInitScript(({ u, m }) => { try { if (!localStorage.getItem('ppapi_demo_session')) { localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m)); } } catch (e) {} }, { u: USER, m: MEMBER });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(`aktif pageerror: ${e.message}`));
  await page.goto(`${BASE}/pustaka.html?id=cop-inspeksi-penandaan`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.modal .modal__dialog');
  await page.waitForTimeout(600);
  result.aktifModal = await page.evaluate(() => ({ focus: document.activeElement && document.activeElement.className, title: document.title, kv: [...document.querySelectorAll('.modal .kv__row dt')].map(e => e.textContent) }));
  await page.screenshot({ path: path.join(OUT, 'pustaka-modal-aktif-desktop.png') });
  await ctx.close();
}
await browser.close();
server.close();
result.errors = errors;
fs.writeFileSync(path.join(OUT, `_probe-${TAG}.json`), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
