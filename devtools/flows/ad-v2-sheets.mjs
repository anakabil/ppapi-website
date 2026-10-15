// Builds reading sheets from devtools/shots/ad2/*.png into devtools/shots/ad2/sheets/
//   desktop full pages : <id>-ov.png  (whole page in k columns)   +  <id>-dNN.png (1440×1050 slices)
//   mobile  full pages : <id>-mNN.png (3 consecutive 1050-css-px slices side by side, at 1 css px)
//   viewport shots     : copied as-is (desktop) / downscaled to css px (mobile)
// Run from devtools/:  node flows/ad-v2-sheets.mjs [filter]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'shots', 'ad2');
const OUT = path.join(SRC, 'sheets');
fs.mkdirSync(OUT, { recursive: true });
const filter = process.argv[2] || '';
const size = b => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });
const files = fs.readdirSync(SRC).filter(f => f.endsWith('.png') && f.includes(filter));
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
async function render(html, w, h, out) {
  await page.setViewportSize({ width: Math.ceil(w), height: Math.ceil(h) });
  await page.setContent(`<html><body style="margin:0;background:#e6e1d8">${html}</body></html>`);
  await page.waitForFunction(() => [...document.images].every(i => i.complete));
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: Math.ceil(w), height: Math.ceil(h) } });
}
for (const f of files) {
  const buf = fs.readFileSync(path.join(SRC, f));
  const { w, h } = size(buf);
  const uri = 'data:image/png;base64,' + buf.toString('base64');
  const base = f.replace(/\.png$/, '');
  const mobile = /-mobile/.test(f);
  if (!mobile) {
    if (h <= 1000) { fs.copyFileSync(path.join(SRC, f), path.join(OUT, f)); continue; }
    const SL = 1050; const n = Math.ceil(h / SL);
    for (let k = 0; k < n; k++) {
      const hh = Math.min(SL, h - k * SL);
      await render(`<div style="width:${w}px;height:${hh}px;overflow:hidden"><img src="${uri}" style="display:block;margin-top:${-k * SL}px"></div>`, w, hh, path.join(OUT, `${base}-d${String(k + 1).padStart(2, '0')}.png`));
    }
    const k = Math.max(1, Math.ceil(Math.sqrt(h * 1560 / (1500 * w))));
    const colH = Math.ceil(h / k); const s = Math.min(1560 / (w * k + 12 * (k - 1)), 1500 / colH);
    const cols = Array.from({ length: k }, (_, i) => `<div style="width:${w * s}px;height:${Math.min(colH, h - i * colH) * s}px;overflow:hidden;flex:none;outline:1px solid #c0b"><img src="${uri}" style="display:block;width:${w * s}px;margin-top:${-i * colH * s}px"></div>`).join('');
    await render(`<div style="display:flex;gap:12px;align-items:flex-start">${cols}</div>`, w * s * k + 12 * (k - 1), colH * s, path.join(OUT, `${base}-ov.png`));
  } else {
    const dpr = w / 390; const cssH = h / dpr;
    if (cssH <= 900) { await render(`<img src="${uri}" style="display:block;width:390px">`, 390, cssH, path.join(OUT, f)); continue; }
    const SL = 1050; const nSl = Math.ceil(cssH / SL); const sheets = Math.ceil(nSl / 3);
    for (let si = 0; si < sheets; si++) {
      const cols = [];
      for (let c = 0; c < 3; c++) { const k = si * 3 + c; if (k >= nSl) break; cols.push(`<div style="width:390px;height:${Math.min(SL, cssH - k * SL)}px;overflow:hidden;flex:none;outline:1px solid #c0b;background:#fff"><img src="${uri}" style="display:block;width:390px;margin-top:${-k * SL}px"></div>`); }
      await render(`<div style="display:flex;gap:14px;align-items:flex-start">${cols.join('')}</div>`, cols.length * 390 + (cols.length - 1) * 14, SL, path.join(OUT, `${base}-m${String(si + 1).padStart(2, '0')}.png`));
    }
  }
  console.log('sheeted', f, w + 'x' + h);
}
await browser.close();
