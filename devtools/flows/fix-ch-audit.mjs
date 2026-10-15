// fixer probe (berita+agenda): every `ch` measure in berita.css/agenda.css — px with web font vs fallback, and em equivalent.
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
const { BASE, close } = await startServer();
const browser = await chromium.launch();
const T = [
  ['berita.html', '.berita-hero .display'], ['berita.html', '.berita-agenda__intro .lead'], ['berita.html?id=pelatihan-inspeksi-perancah-pipa-klem', '.berita-article__title'],
  ['berita.html?id=tidak-ada', '.berita-nf__hero .lead'], ['berita.html?id=pelatihan-inspeksi-perancah-pipa-klem', '.berita-article__main'],
  ['berita.html?id=pelatihan-inspeksi-perancah-pipa-klem', '.berita-related__title, .berita-pager__title, [class*="__title"]'],
  ['agenda.html', '.agenda-feature__title'], ['agenda.html', '.agenda-feature__desc'], ['agenda.html', '.agenda-cross__text'],
];
for (const [url, sel] of T) {
  const r = {};
  for (const fonts of ['web', 'fallback']) {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    if (fonts === 'fallback') await ctx.route(/fonts\.(googleapis|gstatic)\.com/, x => x.abort());
    const page = await ctx.newPage();
    await page.goto(`${BASE}/${url}`, { waitUntil: 'networkidle' }); await page.evaluate(() => document.fonts.ready); await page.waitForTimeout(300);
    r[fonts] = await page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e); return { mw: parseFloat(cs.maxWidth), fs: parseFloat(cs.fontSize), h: Math.round(e.getBoundingClientRect().height), ff: cs.fontFamily.split(',')[0] }; }, sel);
    await ctx.close();
  }
  const w = r.web, f = r.fallback;
  console.log(`${url.slice(0, 22).padEnd(22)} ${sel.split(',')[0].padEnd(30)} ${w ? `${w.ff} web ${w.mw.toFixed(0)}px (${(w.mw / w.fs).toFixed(3)}em) h${w.h} | fallback ${f.mw.toFixed(0)}px h${f.h}  Δ ${(100 * (f.mw - w.mw) / w.mw).toFixed(1)}%` : 'n/a'}`);
}
await browser.close(); await close();
