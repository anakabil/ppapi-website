// fixer a11y check (berita+agenda): axe-core 4.10.2 (cdnjs) on agenda states touched by the CLS fix —
// skeleton (store stalled), rendered list, deep-link detail open, after closing it (row focused) — plus berita filtered.
// Usage (cwd devtools/): node flows/fix-agenda-axe.mjs
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
let AXE = '';
try { const r = await fetch('https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js'); if (r.ok) AXE = await r.text(); } catch (e) { /* offline */ }
if (!AXE) { console.log('axe-core unavailable (offline) — skipped'); process.exit(0); }
const STALL = ';(function(){try{var c=PPAPI.store&&PPAPI.store.content;if(!c)return;var l=c.list;c.list=function(t){return t==="agenda"?new Promise(function(){}):l.apply(this,arguments)};}catch(e){}})();';
const { BASE, close } = await startServer();
const browser = await chromium.launch();
const run = async (page) => {
  await page.addScriptTag({ content: AXE });
  return page.evaluate(async () => {
    const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
    return r.violations.map(v => `${v.id}(${v.impact}) ${v.nodes.slice(0, 3).map(n => n.target.join(' ')).join(' | ')}`);
  });
};
let bad = 0;
for (const vp of [{ n: 'desktop', w: 1440, h: 900 }, { n: 'mobile', w: 390, h: 844, m: true }]) {
  const cases = [
    ['skeleton', 'agenda.html', true, null],
    ['rendered', 'agenda.html', false, null],
    ['rendered past+filter', 'agenda.html?tab=telah-berlangsung&jenis=Pelatihan', false, null],
    ['deep-link open', 'agenda.html?id=pelatihan-inspeksi-tube-coupler-okt-2026', false, 'open'],
    ['deep-link closed', 'agenda.html?id=pelatihan-inspeksi-tube-coupler-okt-2026', false, 'close'],
    ['berita filtered', 'berita.html?kategori=Kegiatan', false, null],
  ];
  for (const [label, url, stall, act] of cases) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.m, hasTouch: !!vp.m, reducedMotion: 'reduce' });
    if (stall) await ctx.route(/assets\/js\/store\.js/, async route => { const r = await route.fetch(); route.fulfill({ response: r, body: (await r.text()) + STALL }); });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/${url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1200);
    if (act) { await page.waitForSelector('.agenda-modal-root .modal__dialog'); await page.waitForTimeout(300); }
    if (act === 'close') { await page.keyboard.press('Escape'); await page.waitForTimeout(800); }
    const v = await run(page);
    if (v.length) bad++;
    console.log(`[${vp.n}] ${label.padEnd(22)} ${v.length ? 'VIOLATIONS ' + v.join(' || ') : '0 violations'}`);
    await ctx.close();
  }
}
console.log(bad ? `${bad} state(s) with violations` : 'all states: 0 violations');
await browser.close(); await close();
