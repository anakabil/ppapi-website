// probe: what changes on agenda.html?id=… under reduced motion (review only)
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
const { BASE, close } = await startServer();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
await ctx.addInitScript(() => {
  window.__log = [];
  const t0 = performance.now();
  const snap = (why) => { const j = document.getElementById('jadwal'); const b = document.querySelector('.section--bone'); window.__log.push(`${Math.round(performance.now() - t0)} ${why} scrollY=${Math.round(scrollY)} jadwalH=${j ? Math.round(j.getBoundingClientRect().height) : '-'} boneTop=${b ? Math.round(b.getBoundingClientRect().top + scrollY) : '-'} htmlCls=${document.documentElement.className} bodyStyle=${document.body ? document.body.getAttribute('style') : ''} modal=${!!document.querySelector('.modal')}`); };
  new PerformanceObserver(l => l.getEntries().forEach(e => { if (!e.hadRecentInput) snap('SHIFT ' + e.value.toFixed(3)); })).observe({ type: 'layout-shift', buffered: true });
  const iv = setInterval(() => snap('tick'), 50); setTimeout(() => clearInterval(iv), 1500);
});
const page = await ctx.newPage();
await page.goto(`${BASE}/agenda.html?id=pelatihan-inspeksi-tube-coupler-okt-2026`, { waitUntil: 'load' });
await page.waitForTimeout(2000);
const log = await page.evaluate(() => window.__log);
let prev = '';
for (const l of log) { const k = l.replace(/^\d+ /, ''); if (k !== prev || /SHIFT/.test(l)) console.log(l); prev = k; }
await browser.close(); await close();
