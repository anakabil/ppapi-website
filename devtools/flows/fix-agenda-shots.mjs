// fixer shots (berita+agenda): agenda schedule skeleton (store stalled = slow Firebase) vs. rendered list,
// at identical scroll positions, desktop + mobile; and the highlighted target row after closing a deep link.
// Usage (cwd devtools/): node flows/fix-agenda-shots.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './qa-lib.mjs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'shots', 'fix-agenda');
fs.mkdirSync(OUT, { recursive: true });
const { BASE, close } = await startServer();
const browser = await chromium.launch();
const STALL = ';(function(){try{var c=PPAPI.store&&PPAPI.store.content;if(!c)return;var l=c.list;c.list=function(t){return t==="agenda"?new Promise(function(){}):l.apply(this,arguments)};}catch(e){}})();';
for (const vp of [{ n: 'desktop', w: 1440, h: 900 }, { n: 'mobile', w: 390, h: 844, m: true }]) {
  for (const stall of [true, false]) {
    for (const motion of ['reduce']) {
      const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.m, hasTouch: !!vp.m, deviceScaleFactor: vp.m ? 2 : 1, reducedMotion: motion });
      if (stall) await ctx.route(/assets\/js\/store\.js/, async route => { const r = await route.fetch(); route.fulfill({ response: r, body: (await r.text()) + STALL }); });
      const page = await ctx.newPage();
      const errs = []; page.on('pageerror', e => errs.push(e.message));
      await page.goto(`${BASE}/agenda.html`, { waitUntil: 'networkidle' });
      await page.evaluate(() => document.fonts.ready);
      await page.waitForTimeout(500);
      const y = await page.evaluate(() => { const el = document.querySelector('#jadwal .agenda-toolbar'); const y = Math.round(el.getBoundingClientRect().top + scrollY - 100); window.scrollTo(0, y); return y; });
      await page.waitForTimeout(300);
      const info = await page.evaluate(() => ({ ph: !!document.querySelector('.agenda-list__ph'), chipsPh: document.querySelectorAll('.agenda-chip-ph').length, listH: Math.round(document.getElementById('agenda-list').getBoundingClientRect().height), docH: document.documentElement.scrollHeight, phFocusable: [...document.querySelectorAll('.agenda-list__ph a, .agenda-list__ph button')].filter(e => { e.focus(); return document.activeElement === e; }).length }));
      const f = `schedule-${stall ? 'skeleton' : 'rendered'}-${vp.n}.png`;
      await page.screenshot({ path: path.join(OUT, f) });
      console.log(vp.n, stall ? 'skeleton' : 'rendered', 'scrollY', y, JSON.stringify(info), errs.length ? 'ERRORS ' + errs.join(' | ') : '', '→', f);
      await ctx.close();
    }
  }
}
await browser.close(); await close();
