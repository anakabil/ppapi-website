// fixer probe (berita+agenda): heights of #jadwal parts with web fonts vs. fallback fonts,
// and empty-vs-filled #agenda-list. Usage (cwd devtools/): node flows/fix-agenda-heights.mjs [path]
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
const target = process.argv[2] || 'agenda.html';
const { BASE, close } = await startServer();
const browser = await chromium.launch();
const sel = ['#jadwal .section-head', '#jadwal .agenda-toolbar', '#jadwal .agenda-status', '#agenda-list', '#jadwal', '.agenda-month', '.agenda-month__head', '.agenda-row', '#terdekat', '.agenda-hero'];
for (const vp of [{ n: 'desktop', w: 1440, h: 900 }, { n: 'tablet', w: 800, h: 1024 }, { n: 'mobile', w: 390, h: 844, m: true }]) {
  for (const fonts of ['web', 'blocked']) {
    for (const tab of ['', 'tab=telah-berlangsung']) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.m, hasTouch: !!vp.m, reducedMotion: 'reduce' });
      if (fonts === 'blocked') await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
      const page = await ctx.newPage();
      await page.goto(`${BASE}/${target}${tab ? (target.includes('?') ? '&' : '?') + tab : ''}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(600);
      const r = await page.evaluate((sel) => {
        const o = {};
        for (const s of sel) { const els = [...document.querySelectorAll(s)]; o[s] = els.slice(0, 6).map(e => Math.round(e.getBoundingClientRect().height)).join(','); }
        o.fontsLoaded = [...document.fonts].filter(f => f.status === 'loaded').length;
        return o;
      }, sel);
      console.log(vp.n, fonts, tab || 'akan-datang', JSON.stringify(r));
      await ctx.close();
    }
  }
}
await browser.close(); await close();
