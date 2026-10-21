// Header fit probe: measures the desktop header row (logo · nav · account) at several widths,
// signed out and signed in: one row, ≥ 48 px clear after the logo, no overlap / horizontal scroll.  node devtools/flows/nav-fit.mjs [--shots]
import { chromium } from 'playwright';
import path from 'node:path';
import { startServer, DEMO_USER, DEMO_MEMBER, registryEntryFor, SHOTS } from './qa-lib.mjs';
import fs from 'node:fs';
const SAVE = process.argv.includes('--shots');
fs.mkdirSync(SHOTS, { recursive: true });
const { BASE, close } = await startServer();
const browser = await chromium.launch();
let pass = 0, fail = 0;
const ok = (c, l, d = '') => { if (c) { pass++; console.log('  ✓ ' + l); } else { fail++; console.log('  ✗ ' + l + (d ? '  — ' + JSON.stringify(d) : '')); } };
for (const signed of [false, true]) {
  for (const width of [1120, 1180, 1280, 1440]) {
    const ctx = await browser.newContext({ viewport: { width, height: 800 }, reducedMotion: 'reduce' });
    if (signed) await ctx.addInitScript(({ u, m, r }) => {
      localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
      localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
      localStorage.setItem('ppapi_registry', JSON.stringify({ [r.kta]: r }));
    }, { u: DEMO_USER, m: DEMO_MEMBER, r: registryEntryFor(DEMO_MEMBER) });
    const page = await ctx.newPage();
    if (process.env.NAV_EXTRA) await page.route('**/assets/js/config.js', async route => { const r = await route.fetch(); const t = await r.text(); await route.fulfill({ response: r, body: t + ';(function(){var c=window.PPAPI_CONFIG; var x=' + process.env.NAV_EXTRA + '; c.nav = x(c.nav);})();' }); });
    await page.goto(BASE + '/index.html');
    await page.waitForFunction(() => window.PPAPI && PPAPI.isReady && PPAPI.isReady());
    await page.waitForTimeout(400);
    const m = await page.evaluate(() => {
      const r = el => el ? el.getBoundingClientRect() : null;
      const bar = document.querySelector('.site-header__bar'), nav = document.querySelector('.site-nav');
      const brand = r(document.querySelector('.brand')), acts = r(document.querySelector('.site-header__actions'));
      const links = [...document.querySelectorAll('.site-nav__list > li')].map(li => r(li));
      const navR = r(nav);
      const tops = new Set(links.map(l => Math.round(l.top)));
      return {
        navShown: getComputedStyle(nav).display !== 'none', rows: tops.size,
        gapLeft: navR ? Math.round(navR.left - brand.right) : null, gapRight: navR && acts ? Math.round(acts.left - navR.right) : null,
        overflow: bar.scrollWidth > bar.clientWidth + 1, docOverflow: document.documentElement.scrollWidth > innerWidth,
        n: links.length
      };
    });
    console.log('    ', JSON.stringify(m));
    ok(m.navShown && m.rows === 1 && m.gapLeft >= 48 && m.gapRight >= 0 && !m.overflow && !m.docOverflow, `${signed ? 'masuk' : 'tamu'} @${width}: nav satu baris, tidak bertumpuk`, m);
    if (SAVE) await page.screenshot({ path: path.join(SHOTS, `navfit-${signed ? 'in' : 'out'}-${width}.png`), clip: { x: 0, y: 0, width, height: 140 } });
    await ctx.close();
  }
}
await browser.close(); await close();
console.log(`\nnav-fit: ${pass}/${pass + fail} passed`);
process.exit(fail ? 1 : 0);
