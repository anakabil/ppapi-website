// fixer shots (berita+agenda): article hero/title + agenda feature panel after the ch→em measure change (web fonts).
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './qa-lib.mjs';
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'shots', 'fix-agenda');
const { BASE, close } = await startServer();
const browser = await chromium.launch();
for (const [name, url, w, h, y] of [['article-desktop', 'berita.html?id=pelatihan-inspeksi-perancah-pipa-klem', 1440, 900, 0], ['article-body-desktop', 'berita.html?id=pelatihan-inspeksi-perancah-pipa-klem', 1440, 900, 1300], ['agenda-feature-desktop', 'agenda.html', 1440, 900, 780], ['berita-hero-desktop', 'berita.html', 1440, 900, 0]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/${url}`, { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(500);
  await page.evaluate(y => scrollTo(0, y), y); await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log(name);
  await ctx.close();
}
await browser.close(); await close();
