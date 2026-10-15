// Art-direction review helper: slices the full-page PNGs produced by fullshot.mjs
// (devtools/shots/*-scrolled-ad*.png) into legible reading sheets in devtools/shots/ad/.
//   desktop: <name>-dNN.png       1440 x 1100 css-px slices
//            <name>-overview.png  whole page in k columns (rhythm view)
//   mobile : <name>-mNN.png       3 consecutive 1100-css-px slices side by side
// Run from devtools/:  node flows/ad-slice.mjs [filter]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.resolve(__dirname, '..', 'shots');
const OUT = path.join(SHOTS, 'ad');
fs.mkdirSync(OUT, { recursive: true });
const filter = process.argv[2] || '';

function pngSize(buf) { return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) }; }

const files = fs.readdirSync(SHOTS).filter(f => /-scrolled-ad.*\.png$/.test(f) && f.includes(filter));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1600 } });

for (const f of files) {
  const buf = fs.readFileSync(path.join(SHOTS, f));
  const { w, h } = pngSize(buf);
  const name = f.replace('-scrolled-ad', '').replace('.png', '').replace(/-(desktop|mobile)(-.+)?$/, (m, vp, tag) => `${tag || ''}-${vp}`);
  const uri = 'data:image/png;base64,' + buf.toString('base64');
  const isMobile = /-mobile/.test(f);
  if (!isMobile) {
    const SL = 1100;
    const n = Math.ceil(h / SL);
    await page.setViewportSize({ width: w, height: SL });
    await page.setContent(`<html><body style="margin:0;background:#f0f"><img id=i src="${uri}" style="display:block"></body></html>`);
    await page.waitForFunction(() => document.getElementById('i').complete);
    for (let k = 0; k < n; k++) {
      const y = k * SL; const hh = Math.min(SL, h - y);
      await page.screenshot({ path: path.join(OUT, `${name}-d${String(k + 1).padStart(2, '0')}.png`), clip: { x: 0, y, width: w, height: hh }, fullPage: true });
    }
    // overview
    const k = Math.max(1, Math.ceil(Math.sqrt(h * 1560 / (1500 * w))));
    const s = Math.min(1560 / (w * k + 12 * (k - 1)), 1500 * k / h);
    const colH = Math.ceil(h / k);
    const cols = Array.from({ length: k }, (_, i) => `<div style="width:${w * s}px;height:${colH * s}px;overflow:hidden;flex:none;outline:1px solid #f0f"><img src="${uri}" style="display:block;width:${w * s}px;margin-top:${-i * colH * s}px"></div>`).join('');
    await page.setViewportSize({ width: 1600, height: 1600 });
    await page.setContent(`<html><body style="margin:0;background:#fff;display:flex;gap:12px;align-items:flex-start">${cols}</body></html>`);
    await page.waitForTimeout(150);
    const bb = await page.evaluate(() => { const r = document.body.getBoundingClientRect(); return { w: document.body.scrollWidth, h: Math.max(...[...document.body.children].map(c => c.getBoundingClientRect().bottom)) }; });
    await page.screenshot({ path: path.join(OUT, `${name}-overview.png`), clip: { x: 0, y: 0, width: Math.min(bb.w, 1600), height: Math.ceil(bb.h) }, fullPage: true });
    console.log(f, `${w}x${h}`, n, 'slices, overview cols', k);
  } else {
    const dpr = w / 390; const SLc = 1100; const SL = SLc * dpr; const colW = 500; const sc = colW / w;
    const nSl = Math.ceil(h / SL); const sheets = Math.ceil(nSl / 3);
    for (let sIdx = 0; sIdx < sheets; sIdx++) {
      const cols = [];
      for (let c = 0; c < 3; c++) {
        const k = sIdx * 3 + c; if (k >= nSl) break;
        cols.push(`<div style="width:${colW}px;height:${Math.min(SL, h - k * SL) * sc}px;overflow:hidden;flex:none;outline:1px solid #f0f"><img src="${uri}" style="display:block;width:${colW}px;margin-top:${-k * SL * sc}px"></div>`);
      }
      await page.setViewportSize({ width: 1600, height: 1600 });
      await page.setContent(`<html><body style="margin:0;background:#fff;display:flex;gap:20px;align-items:flex-start">${cols.join('')}</body></html>`);
      await page.waitForTimeout(150);
      const bb = await page.evaluate(() => ({ w: Math.max(...[...document.body.children].map(c => c.getBoundingClientRect().right)), h: Math.max(...[...document.body.children].map(c => c.getBoundingClientRect().bottom)) }));
      await page.screenshot({ path: path.join(OUT, `${name}-m${String(sIdx + 1).padStart(2, '0')}.png`), clip: { x: 0, y: 0, width: Math.ceil(bb.w), height: Math.ceil(bb.h) }, fullPage: true });
    }
    console.log(f, `${w}x${h}`, nSl, 'slices,', sheets, 'sheets');
  }
}
await browser.close();
