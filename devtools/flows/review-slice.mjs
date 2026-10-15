// review-slice — cut tall PNGs into readable segments (review helper, no deps beyond Playwright).
//   node flows/review-slice.mjs <outDir> <sliceHeight> <png…>     (png paths relative to shots/review-tampilan or absolute)
// Output: <outDir>/<name>-sN.png ; images shorter than sliceHeight are skipped (read the original).
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(__dirname, '..', 'shots', 'review-tampilan');
const [outDir, sliceH, ...files] = process.argv.slice(2);
if (!outDir || !sliceH || !files.length) { console.error('usage: node flows/review-slice.mjs <outDir> <sliceHeight> <png…>'); process.exit(1); }
const OUT = path.isAbsolute(outDir) ? outDir : path.resolve(SRC, outDir);
fs.mkdirSync(OUT, { recursive: true });
const H = Number(sliceH);
const size = b => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const f0 of files) {
  const f = path.isAbsolute(f0) ? f0 : path.join(SRC, f0);
  if (!fs.existsSync(f)) { console.log('missing', f0); continue; }
  const buf = fs.readFileSync(f);
  const { w, h } = size(buf);
  if (h <= H * 1.15) { console.log('skip (short)', path.basename(f), `${w}x${h}`); continue; }
  const uri = 'data:image/png;base64,' + buf.toString('base64');
  await page.setViewportSize({ width: w, height: Math.min(h, H) });
  await page.setContent(`<html><body style="margin:0"><img src="${uri}" style="display:block;width:${w}px;height:${h}px"></body></html>`);
  await page.waitForFunction(() => [...document.images].every(i => i.complete));
  const n = Math.ceil(h / H);
  for (let i = 0; i < n; i++) {
    const y = i * H, hh = Math.min(H, h - y);
    await page.evaluate(y => scrollTo(0, y), y);
    const out = path.join(OUT, path.basename(f).replace(/\.png$/, '') + `-s${i + 1}.png`);
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: hh } });
  }
  console.log(`sliced ${path.basename(f)} ${w}x${h} → ${n} × ${H}`);
}
await browser.close();
