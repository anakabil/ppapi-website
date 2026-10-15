// Crop + magnify a region of a captured AD screenshot: node flows/ad-v2-zoom.mjs <png in shots/ad2> x y w h [scale] [out-name]
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const [f, x, y, w, h, sc = '2', outName] = process.argv.slice(2);
const SRC = path.resolve(__dirname, '..', 'shots', 'ad2');
const buf = fs.readFileSync(path.join(SRC, f)); const uri = 'data:image/png;base64,' + buf.toString('base64');
const s = Number(sc); const W = Math.round(w * s), H = Math.round(h * s);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: W, height: H } });
const iw = buf.readUInt32BE(16);
await p.setContent(`<body style="margin:0;overflow:hidden"><img src="${uri}" style="display:block;width:${iw * s}px;margin:${-y * s}px 0 0 ${-x * s}px;image-rendering:pixelated"></body>`);
await p.waitForFunction(() => document.images[0].complete);
const out = path.join(SRC, 'sheets', outName || f.replace('.png', `-z${x}_${y}.png`));
await p.screenshot({ path: out }); console.log(out); await b.close();
