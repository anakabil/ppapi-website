// fixer probe (berita+agenda): font-dependent `ch` measures on berita/agenda titles — width & lines with web font vs fallback.
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
const { BASE, close } = await startServer();
const browser = await chromium.launch();
const T = [['berita.html?id=pelatihan-inspeksi-perancah-pipa-klem', '.berita-article__title'], ['berita.html?id=situs-resmi-dan-layanan-anggota-daring', '.berita-article__title'], ['berita.html?id=memahami-penandaan-perancah', '.berita-article__title'], ['agenda.html', '.agenda-feature__title']];
for (const w of [1440, 1024, 390]) for (const [url, sel] of T) {
  const out = [];
  for (const fonts of ['web', 'fallback']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
    if (fonts === 'fallback') await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    const page = await ctx.newPage();
    await page.goto(`${BASE}/${url}`, { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
    out.push(fonts + ' ' + await page.evaluate((sel) => { const e = document.querySelector(sel); const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return `maxW ${cs.maxWidth} w ${Math.round(r.width)} h ${Math.round(r.height)} fs ${cs.fontSize} → ${(parseFloat(cs.maxWidth) / parseFloat(cs.fontSize)).toFixed(3)}em`; }, sel));
    await ctx.close();
  }
  console.log(w, url.replace(/\?id=(.{18}).*/, '?id=$1…'), '\n   ' + out.join('\n   '));
}
await browser.close(); await close();
