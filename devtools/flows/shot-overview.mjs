// Release QA helper — one overview sheet per full-page PNG: the page cut into k columns side by side, scaled to fit
// ~1600 × 1500 px, so a whole page (desktop or phone) can be triaged in one image; then read detail slices only
// where something looks off.  Run from devtools/:
//   node flows/shot-overview.mjs <outDir> <png> [<png> …]        (png paths absolute or relative to devtools/shots)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.resolve(__dirname, '..', 'shots');
const [outDir, ...files] = process.argv.slice(2);
if (!outDir || !files.length) { console.error('usage: node flows/shot-overview.mjs <outDir> <png…>'); process.exit(1); }
fs.mkdirSync(outDir, { recursive: true });
const size = b => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1500 } });
const W = 1600, H = 1500, GAP = 14;
for (const f0 of files) {
  const f = path.isAbsolute(f0) ? f0 : path.join(SHOTS, f0);
  const buf = fs.readFileSync(f);
  const { w, h } = size(buf);
  const uri = 'data:image/png;base64,' + buf.toString('base64');
  // choose k columns maximising the scale
  let best = { k: 1, s: 0 };
  for (let k = 1; k <= 14; k++) {
    const colH = Math.ceil(h / k);
    const s = Math.min((W - GAP * (k - 1)) / (w * k), H / colH, 1);
    if (s > best.s) best = { k, s };
  }
  const { k, s } = best;
  const colH = Math.ceil(h / k);
  const cols = Array.from({ length: k }, (_, i) => `<div style="width:${w * s}px;height:${Math.min(colH, h - i * colH) * s}px;overflow:hidden;flex:none;outline:1px solid #c0b"><img src="${uri}" style="display:block;width:${w * s}px;margin-top:${-i * colH * s}px"></div>`).join('');
  const cw = Math.ceil(w * s * k + GAP * (k - 1)), ch = Math.ceil(colH * s);
  await page.setViewportSize({ width: cw, height: ch });
  await page.setContent(`<html><body style="margin:0;background:#e6e1d8"><div style="display:flex;gap:${GAP}px;align-items:flex-start">${cols}</div></body></html>`);
  await page.waitForFunction(() => [...document.images].every(i => i.complete));
  const out = path.join(outDir, path.basename(f).replace(/\.png$/, '') + '-ov.png');
  await page.screenshot({ path: out, clip: { x: 0, y: 0, width: cw, height: ch } });
  console.log(`overview ${path.basename(out)}  ${w}x${h} → ${k} cols @ ${s.toFixed(3)}`);
}
await browser.close();
