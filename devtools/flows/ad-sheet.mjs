// Contact sheet of screenshots: node flows/ad-sheet.mjs <out.png> <colW> <cols> <file...>  (files relative to shots/)
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.resolve(__dirname, '..', 'shots');
const [out, colW, cols, ...files] = process.argv.slice(2);
const imgs = files.map(f => `<figure style="margin:0;width:${colW}px"><img style="width:${colW}px;display:block" src="data:image/png;base64,${fs.readFileSync(path.join(SHOTS, f)).toString('base64')}"><figcaption style="font:12px sans-serif;padding:2px">${f}</figcaption></figure>`).join('');
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
await p.setContent(`<body style="margin:0;display:grid;grid-template-columns:repeat(${cols},${colW}px);gap:10px;background:#f0f;width:max-content">${imgs}</body>`);
await p.waitForTimeout(200);
await p.screenshot({ path: path.join(SHOTS, 'ad', out), fullPage: true }); await b.close(); console.log('ok', out);
