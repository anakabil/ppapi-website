// fixer probe (berita+agenda): rendered agenda row / month-head / chips heights across widths (web fonts loaded),
// used to size the pre-data list skeleton. Usage (cwd devtools/): node flows/fix-agenda-rowsizes.mjs [--ph]
//   --ph : also report the skeleton's heights (captured before PPAPI.onReady renders, via a held auth promise)
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
const ph = process.argv.includes('--ph');
const { BASE, close } = await startServer();
const browser = await chromium.launch();
const W = [320, 360, 390, 480, 560, 640, 767, 768, 900, 1023, 1024, 1280, 1440, 1920];
for (const w of W) {
  const out = [];
  for (const tab of ['', '?tab=telah-berlangsung']) {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    if (ph) {
      // capture the skeleton right after agenda.js ran (DOMContentLoaded), before the async render
      await ctx.addInitScript(() => { document.addEventListener('DOMContentLoaded', () => { const l = document.getElementById('agenda-list'); const c = document.getElementById('agenda-chips'); window.__ph = { list: l && Math.round(l.getBoundingClientRect().height), rows: [...document.querySelectorAll('#agenda-list .agenda-row')].map(r => Math.round(r.getBoundingClientRect().height)).join(','), chips: c && Math.round(c.getBoundingClientRect().height), jadwal: Math.round(document.getElementById('jadwal').getBoundingClientRect().height) }; }); });
    }
    await page.goto(`${BASE}/agenda.html${tab}`, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(300);
    const r = await page.evaluate(() => {
      const H = s => [...document.querySelectorAll(s)].map(e => Math.round(e.getBoundingClientRect().height));
      const months = [...document.querySelectorAll('.agenda-month')];
      return { list: Math.round(document.getElementById('agenda-list').getBoundingClientRect().height), jadwal: Math.round(document.getElementById('jadwal').getBoundingClientRect().height), rows: H('#agenda-list .agenda-row').join(','), head: H('.agenda-month__head')[0], months: months.length, chips: Math.round(document.getElementById('agenda-chips').getBoundingClientRect().height), ph: window.__ph || null };
    });
    out.push(`${tab ? 'past' : 'up'}: list ${r.list} jadwal ${r.jadwal} head ${r.head} rows [${r.rows}] chips ${r.chips}${r.ph ? `  || PH list ${r.ph.list} jadwal ${r.ph.jadwal} rows [${r.ph.rows}] chips ${r.ph.chips}` : ''}`);
    await ctx.close();
  }
  console.log(w, '\n   ' + out.join('\n   '));
}
await browser.close(); await close();
