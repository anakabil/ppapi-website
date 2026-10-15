// fixer probe (berita+agenda): what grows above the article figure on berita.html?id=… (desktop)? (review only)
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
const id = process.argv[2] || 'pelatihan-inspeksi-perancah-pipa-klem';
const { BASE, close } = await startServer();
const browser = await chromium.launch();
for (const motion of ['no-preference', 'reduce']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: motion });
  await ctx.addInitScript(() => {
    window.__log = []; const t0 = performance.now();
    new PerformanceObserver(l => l.getEntries().forEach(e => window.__log.push(Math.round(e.startTime) + ' SHIFT ' + e.value.toFixed(4) + ' ' + (e.sources || []).map(s => { const n = s.node; return (n && n.nodeType === 1 ? n.tagName.toLowerCase() + '.' + [...n.classList].join('.') : '#text') + ' prev(' + [s.previousRect.y, s.previousRect.height].map(Math.round) + ') cur(' + [s.currentRect.y, s.currentRect.height].map(Math.round) + ')'; }).join(' | ')))).observe({ type: 'layout-shift', buffered: true });
    const sel = ['.berita-article__head', '.berita-article__title', '.berita-article__lead', '.berita-article__meta', '.berita-article__byline', '.berita-article__figure', '.breadcrumb', '.berita-article__hero', '.berita-article__actions', '.berita-article__share'];
    let prev = ''; const poll = () => { const s = sel.map(q => { const e = document.querySelector(q); return e ? q.replace('.berita-article__', '') + ':' + Math.round(e.getBoundingClientRect().top) + '/' + Math.round(e.getBoundingClientRect().height) : null; }).filter(Boolean).join(' '); if (s !== prev) { window.__log.push(Math.round(performance.now() - t0) + ' ' + s); prev = s; } if (performance.now() - t0 < 2500) requestAnimationFrame(poll); }; requestAnimationFrame(poll);
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/berita.html?id=${id}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  console.log('== ' + motion + '\n' + (await page.evaluate(() => window.__log)).join('\n'));
  await ctx.close();
}
await browser.close(); await close();
