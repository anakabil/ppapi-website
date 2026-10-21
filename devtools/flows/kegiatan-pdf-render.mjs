// Render PDF sertifikat (shots/flow-kegiatan-sertifikat.pdf) menjadi PNG dengan pdf.js (cdnjs) untuk pemeriksaan visual.
// Jalankan setelah kegiatan-flow.mjs:  node devtools/flows/kegiatan-pdf-render.mjs [berkas.pdf]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.resolve(__dirname, '..', 'shots');
const file = process.argv[2] || path.join(SHOTS, 'flow-kegiatan-sertifikat.pdf');
const b64 = fs.readFileSync(file).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1300, height: 950 } });
await page.setContent('<!doctype html><body style="margin:0;background:#888"><canvas id="c"></canvas></body>');
await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js' });
const info = await page.evaluate(async (b64) => {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const doc = await pdfjsLib.getDocument({ data: bytes }).promise;
  const pg = await doc.getPage(1);
  const vp = pg.getViewport({ scale: 1.5 });
  const c = document.getElementById('c'); c.width = vp.width; c.height = vp.height;
  await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  const tc = await pg.getTextContent();
  return { pages: doc.numPages, w: vp.width, h: vp.height, text: tc.items.map(i => i.str).filter(Boolean) };
}, b64);
console.log(JSON.stringify(info));
await page.locator('#c').screenshot({ path: path.join(SHOTS, 'flow-kegiatan-sertifikat-pdf.png') });
await browser.close();
