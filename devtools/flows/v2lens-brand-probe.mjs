// probe: shared header .brand target-size after scrolling (review only)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { startServer } from './qa-lib.mjs';
const AXE = fs.readFileSync(new URL('../shots/axe-4.10.2.min.js', import.meta.url), 'utf8');
const { BASE, close } = await startServer();
const browser = await chromium.launch();
for (const motion of ['reduce', 'no-preference']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: motion });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/keanggotaan.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.scrollTo(0, 700));
  for (const wait of [100, 500, 1500]) {
    await page.waitForTimeout(wait);
    const info = await page.evaluate(() => {
      const h = document.querySelector('.site-header'), b = document.querySelector('.brand');
      const r = b.getBoundingClientRect(), hr = h.getBoundingClientRect();
      const cs = getComputedStyle(h);
      const pts = [[r.left + 5, Math.max(0, r.top + 2)], [r.left + r.width / 2, Math.max(0, r.bottom - 3)]].map(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.tagName + '.' + [...e.classList].join('.')).slice(0, 60) : null; });
      return { cls: h.className, transform: cs.transform, transition: cs.transitionDuration, header: [hr.top, hr.height].map(Math.round), brand: [r.left, r.top, r.width, r.height].map(Math.round), atPoints: pts, ribbon: !!document.querySelector('.demo-ribbon, [data-demo-ribbon]') };
    });
    await page.addScriptTag({ content: AXE }).catch(() => {});
    const v = await page.evaluate(async () => (await axe.run(document, { runOnly: { type: 'rule', values: ['target-size'] } })).violations.map(x => x.nodes.map(n => n.target.join(' ') + ' :: ' + n.failureSummary.replace(/\s+/g, ' ').slice(0, 220))));
    console.log(motion, 'after', wait, JSON.stringify(info), '\n   axe:', JSON.stringify(v));
  }
  await ctx.close();
}
await browser.close(); await close();
