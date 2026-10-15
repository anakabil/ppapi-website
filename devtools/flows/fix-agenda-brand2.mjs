// fixer probe (berita+agenda): which element obscures header .brand when scrolled? (review only)
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
const { BASE, close } = await startServer();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
const page = await ctx.newPage();
await page.goto(`${BASE}/agenda.html`, { waitUntil: 'networkidle' });
await page.evaluate(() => scrollTo(0, 2000)); await page.waitForTimeout(800);
console.log(JSON.stringify(await page.evaluate(() => {
  const b = document.querySelector('.brand'), r = b.getBoundingClientRect(), d = el => el ? el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + [...el.classList].map(c => '.' + c).join('') : null;
  const pts = []; for (let y = r.top + 2; y < r.bottom; y += 6) { const top = document.elementFromPoint(r.left + r.width / 2, y); pts.push(Math.round(y) + ':' + d(top)); }
  const hdr = document.querySelector('.site-header'); const cs = getComputedStyle(hdr);
  return { brand: [r.left, r.top, r.width, r.height].map(Math.round), header: [hdr.getBoundingClientRect().top, hdr.getBoundingClientRect().height].map(Math.round), headerCls: hdr.className, pts };
}), null, 1));
await browser.close(); await close();
