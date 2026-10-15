// fixer probe (berita+agenda): is axe target-size on header .brand a scrolled-header state on any page? (review only)
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
const AXE = await (await fetch('https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js')).text();
const { BASE, close } = await startServer();
const browser = await chromium.launch();
for (const url of ['index.html', 'pustaka.html', 'agenda.html', 'berita.html']) for (const y of [0, 2000]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${url}`, { waitUntil: 'networkidle' });
  await page.evaluate(y => scrollTo(0, y), y); await page.waitForTimeout(800);
  await page.addScriptTag({ content: AXE });
  const r = await page.evaluate(async () => { const r = await axe.run(document, { runOnly: ['target-size'] }); const b = document.querySelector('.brand').getBoundingClientRect(); return { v: r.violations.map(v => v.nodes.map(n => n.target.join(' ') + ' :: ' + (n.any[0] || {}).message).join(' | ')), brand: [Math.round(b.width), Math.round(b.height)] }; });
  console.log(url.padEnd(14), 'y=' + y, 'brand', r.brand.join('x'), r.v.length ? 'VIOLATION ' + r.v.join(' ') : 'ok');
  await ctx.close();
}
await browser.close(); await close();
