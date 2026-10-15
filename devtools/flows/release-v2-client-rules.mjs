// Release QA v2 — client rules of 2026-10-09/10 (mandatory before every deploy).
// Run from devtools/:  node flows/release-v2-client-rules.mjs
//
//   A  static: config.js keeps siteUrl '' in source (devtools/deploy.sh fills it in the public copy only);
//      the planning app title carries "(Beta)" in config.apps AND in the catalogue item (assets/data/pustaka.js);
//      both member apps credit exactly "Dikembangkan oleh mrezahuzain@2026"; no forbidden label in site/ (branding guard)
//   B  browser: EVERY page (incl. 404 at any depth) shows the developer credit in the bottom row of the main footer —
//      exact text, small condensed type, neutral grey (monochrome), AA contrast on the footer, one line, inside the
//      viewport — at 1440, 390 and 320 px; and no rendered page text contains a forbidden label (signed out + Aktif)
//   C  browser: the planning app title with "(Beta)" reaches beranda, dasbor, profil anggota and the catalogue
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startServer, DEMO_USER, DEMO_MEMBER, registryEntryFor } from './qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const CREDIT = 'Dikembangkan oleh mrezahuzain@2026';
const FORBIDDEN = new RegExp(['trus' + 'tie', 'nusa[ ]*' + 'rendra', 'rendra[ ]*' + 'jayatama', 'nusa[ ]*' + 'safety'].join('|'), 'i');
let pass = 0; const fails = [];
const ok = (cond, label, detail) => {
  if (cond) { pass++; console.log('  ✓ ' + label); }
  else { fails.push(label); console.log('  ✗ ' + label + (detail !== undefined ? '\n      ' + JSON.stringify(detail).slice(0, 700) : '')); }
  return !!cond;
};
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* ------------------------------------------------------------------ A · static */
console.log('\nA · static');
const cfg = read('assets/js/config.js');
ok(/^\s*siteUrl:\s*'',/m.test(cfg), "config.js: siteUrl stays '' in source (deploy.sh injects the live address in the public copy)");
const vm = await import('node:vm');
const sb = { window: {} }; vm.createContext(sb); vm.runInContext(cfg, sb);
const apps = sb.window.PPAPI_CONFIG.apps || [];
const plan = apps.find(a => a.key === 'perencanaan') || {};
ok(/\(Beta\)/.test(plan.title || ''), 'config.apps[perencanaan].title indicates "(Beta)"', plan.title);
ok(plan.title === 'PPAPI Scaffold (Beta) — Perencanaan & Analisis Struktur', 'planning title keeps the "Brand — Name" pattern used by dasbor/anggota', plan.title);
const sb2 = { PPAPI_DATA: {} }; sb2.window = sb2; vm.createContext(sb2); vm.runInContext(read('assets/data/pustaka.js'), sb2);
const pk = (sb2.PPAPI_DATA.pustaka || []).find(x => x.id === 'aplikasi-perencanaan') || {};
ok(/\(Beta\)/.test(pk.judul || ''), 'catalogue item aplikasi-perencanaan judul indicates "(Beta)"', pk.judul);
ok(read('aplikasi/perencanaan/index.html').includes(CREDIT), 'planning app footer credits exactly "' + CREDIT + '"');
ok(read('aplikasi/simulator/index.html').includes(CREDIT), 'simulator welcome note credits exactly "' + CREDIT + '"');
const bg = spawnSync(process.execPath, [path.join(__dirname, 'branding-guard.mjs')], { encoding: 'utf8' });
ok(bg.status === 0 && /^PASS/m.test(bg.stdout), 'branding-guard: no forbidden label anywhere in site/', bg.stdout.trim());
const credits = [];
(function walk(d) { for (const n of fs.readdirSync(d)) { if (n === '.git') continue; const p = path.join(d, n); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.(html|js|css)$/.test(n)) { const s = fs.readFileSync(p, 'utf8'); const m = s.match(/Dikembangkan oleh.{0,60}/g); if (m) m.forEach(x => credits.push(path.relative(ROOT, p) + ': ' + x.replace(/<[^>]*>/g, '').trim())); } } })(ROOT);
ok(credits.length >= 3 && credits.every(c => /: Dikembangkan oleh mrezahuzain@2026\b/.test(c)), 'every "Dikembangkan oleh …" in site code names only mrezahuzain@2026 (core.js footer + both apps)', credits);

/* ------------------------------------------------------------------ B · footer credit on every page */
console.log('\nB · footer credit on every page');
const { BASE, close } = await startServer();
const browser = await chromium.launch();
const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).map(f => f.replace(/\.html$/, ''));
const lum = c => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const L = ([r, g, b]) => 0.2126 * lum(r) + 0.7152 * lum(g) + 0.0722 * lum(b);
const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
async function seedActive(ctx) {
  await ctx.addInitScript(({ u, m, r }) => {
    try {
      if (!localStorage.getItem('ppapi_demo_session')) {
        localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
        localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
        const reg = {}; reg[r.kta] = r; localStorage.setItem('ppapi_registry', JSON.stringify(reg));
      }
    } catch (e) {}
  }, { u: DEMO_USER, m: DEMO_MEMBER, r: registryEntryFor(DEMO_MEMBER) });
}
for (const vp of [{ n: 'desktop', w: 1440, h: 900 }, { n: 'mobile', w: 390, h: 844, m: true }, { n: 'narrow', w: 320, h: 720, m: true }]) {
  for (const state of vp.n === 'desktop' ? ['guest', 'aktif'] : ['guest']) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.m, hasTouch: !!vp.m, reducedMotion: 'reduce', locale: 'id-ID' });
    if (state === 'aktif') await seedActive(ctx);
    const bad = [], leaks = [];
    for (const pg of [...pages, 'a/b/halaman-tidak-ada']) {
      const page = await ctx.newPage();
      await page.goto(`${BASE}/${pg}${pg.includes('/') ? '' : '.html'}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForSelector('.site-footer__credit', { timeout: 8000 }).catch(() => {});
      const r = await page.evaluate(() => {
        const els = [...document.querySelectorAll('.site-footer__credit')];
        const el = els[0];
        if (!el) return { n: 0, url: location.pathname };
        el.scrollIntoView({ block: 'center' });
        const cs = getComputedStyle(el), rect = el.getBoundingClientRect();
        const foot = el.closest('.site-footer');
        const fbg = getComputedStyle(foot).backgroundColor;
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.3;
        return {
          n: els.length, url: location.pathname, text: el.textContent.replace(/\s+/g, ' ').trim(),
          inBottom: !!el.closest('.site-footer__bottom'), font: cs.fontFamily, size: parseFloat(cs.fontSize), color: cs.color, bg: fbg,
          lines: Math.round(rect.height / lh), left: rect.left, right: rect.right, vw: document.documentElement.clientWidth,
          visible: rect.width > 0 && rect.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.5,
          body: document.body.innerText,
        };
      });
      if (FORBIDDEN.test(r.body || '')) leaks.push(pg);
      const rgb = s => (s || '').match(/\d+(\.\d+)?/g)?.slice(0, 3).map(Number) || [0, 0, 0];
      const c = rgb(r.color), b = rgb(r.bg);
      const grey = Math.max(...c) - Math.min(...c) <= 12;
      const cr = ratio(c, b);
      const okp = r.n === 1 && r.text === CREDIT && r.inBottom && /Barlow Condensed/.test(r.font) && r.size <= 12.5 && grey && cr >= 4.5 &&
        r.lines === 1 && r.left >= 0 && r.right <= r.vw && r.visible;
      if (!okp) bad.push({ pg, ...r, body: undefined, contrast: +cr.toFixed(2), grey });
      await page.close();
    }
    ok(!bad.length, `${vp.n} ${vp.w}px ${state}: credit "${CREDIT}" in the footer bottom row of all ${pages.length + 1} pages (incl. 404 at /a/b/…) — condensed ≤ 12.5 px, grey, AA, one line, in view`, bad.slice(0, 3));
    ok(!leaks.length, `${vp.n} ${state}: no forbidden label in rendered page text`, leaks);
    await ctx.close();
  }
}

/* ------------------------------------------------------------------ C · Beta title reaches the pages */
console.log('\nC · planning app title "(Beta)" on the pages');
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'id-ID' });
  await seedActive(ctx);
  const page = await ctx.newPage();
  const probe = async (url, sel) => { await page.goto(BASE + '/' + url, { waitUntil: 'networkidle' }); await page.waitForTimeout(500); return page.evaluate(s => [...document.querySelectorAll(s)].map(e => e.textContent.replace(/\s+/g, ' ').trim()).join(' | '), sel); };
  ok(/PPAPI Scaffold \(Beta\) — Perencanaan & Analisis Struktur/.test(await probe('index.html', '.home-app__title')), 'beranda: app card title shows "PPAPI Scaffold (Beta) — …"');
  ok(/PPAPI Scaffold \(Beta\)/.test(await probe('dashboard.html', '.dash-launch__kicker')), 'dasbor: launcher kicker "PPAPI Scaffold (Beta)"');
  ok(/PPAPI Scaffold \(Beta\)/.test(await probe('anggota.html#aplikasi', '.agt-app__head .eyebrow')), 'profil anggota: app eyebrow "PPAPI Scaffold (Beta)"');
  ok(/PPAPI Scaffold \(Beta\) — Perencanaan/.test(await probe('pustaka.html', '.pk-app .doc-card__title')), 'produk pengetahuan: app card title carries "(Beta)"');
  await ctx.close();
}

await browser.close();
await close();
console.log(`\nrelease-v2-client-rules: ${pass}/${pass + fails.length} passed` + (fails.length ? ' — FAILED: ' + fails.join(' | ') : ''));
if (fails.length) process.exitCode = 1;
