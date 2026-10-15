// ANALISIS (read-only) — legacy simulator.html: touch follow-ups (bottom-sheet scroll, pointer map after
// pinch, laser on touch, portrait framing). Run from devtools/: node flows/legacy-simulator-touch.mjs
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'legacy', 'asosiasi.ppapi-main');
const SHOTS = path.resolve(__dirname, '..', 'shots');
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': p.endsWith('.html') ? 'text/html; charset=utf-8' : 'application/octet-stream' });
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const out = {};
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await page.goto(`${BASE}/simulator.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
await page.tap('#startBtn'); await page.waitForTimeout(1200);
const pbody = () => page.evaluate(() => { const b = document.getElementById('pBody'); const r = b.getBoundingClientRect(); return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), st: b.scrollTop, sh: b.scrollHeight, ch: b.clientHeight }; });
async function swipe(x, y, dy) {
  const tp = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await tp('touchStart', [{ x, y, id: 7 }]);
  for (let k = 1; k <= 10; k++) await tp('touchMove', [{ x, y: y + dy * k / 10, id: 7 }]);
  await tp('touchEnd', []);
  await page.waitForTimeout(600);
}
// 1) bottom-sheet scroll by finger (raw touch events)
let p = await pbody();
await swipe(p.x, p.y + 60, -220);
out.sheetScrollRawTouch = { before: p.st, after: (await pbody()).st, scrollable: p.sh > p.ch };
// 2) control: same gesture after removing touch-action:none from html/body
await page.evaluate(() => { document.getElementById('pBody').scrollTop = 0; document.documentElement.style.touchAction = 'auto'; document.body.style.touchAction = 'auto'; });
p = await pbody();
await swipe(p.x, p.y + 60, -220);
out.sheetScrollControlNoTouchAction = { before: p.st, after: (await pbody()).st };
await page.evaluate(() => { document.documentElement.style.touchAction = ''; document.body.style.touchAction = ''; document.getElementById('pBody').scrollTop = 0; });
// 3) pointer map after a pinch ending with an empty touch list
const tp = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
await tp('touchStart', [{ x: 170, y: 250, id: 1 }, { x: 220, y: 250, id: 2 }]);
for (let k = 1; k <= 5; k++) await tp('touchMove', [{ x: 170 - k * 8, y: 250, id: 1 }, { x: 220 + k * 8, y: 250, id: 2 }]);
await tp('touchEnd', []);
await page.waitForTimeout(300);
out.ptrsAfterPinch = await page.evaluate(() => ptrs.size);
// lift one finger first, then the other (realistic)
await tp('touchStart', [{ x: 170, y: 250, id: 3 }, { x: 220, y: 250, id: 4 }]);
await tp('touchMove', [{ x: 160, y: 250, id: 3 }, { x: 230, y: 250, id: 4 }]);
await tp('touchEnd', [{ x: 230, y: 250, id: 4 }]);
const thBefore = await page.evaluate(() => cam.tTheta);
await tp('touchMove', [{ x: 260, y: 250, id: 4 }]);
await tp('touchEnd', []);
await page.waitForTimeout(200);
out.afterOneFingerLift = { ptrs: await page.evaluate(() => ptrs.size), thetaJump: +(await page.evaluate(() => cam.tTheta) - thBefore).toFixed(3) };
// 4) laser on touch: enable laser (programmatic click; pad is under the sheet), then tap the canvas
await page.evaluate(() => document.getElementById('laserBtn').click());
await page.touchscreen.tap(195, 330); await page.waitForTimeout(300);
out.laserAfterTap = await page.evaluate(() => laserGroup.visible);
const th0 = await page.evaluate(() => cam.tTheta);
await tp('touchStart', [{ x: 195, y: 330, id: 9 }]);
for (let k = 1; k <= 6; k++) await tp('touchMove', [{ x: 195 + k * 6, y: 330, id: 9 }]);
out.laserDuringDrag = { visible: await page.evaluate(() => laserGroup.visible), cameraRotatedToo: (await page.evaluate(() => cam.tTheta)) !== th0 };
await tp('touchEnd', []);
await page.evaluate(() => document.getElementById('laserBtn').click());
// 5) portrait framing: what fraction of the finished scaffold is inside the visible canvas (above the sheet)?
await page.evaluate(() => { document.querySelector('.tab[data-tab="insp"]').click(); });
await page.waitForTimeout(2500);
out.portraitFraming = await page.evaluate(() => {
  const box = new THREE.Box3().setFromObject(scaffold); const pts = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) { const v = new THREE.Vector3(x, y, z).project(camera); pts.push([(v.x + 1) / 2 * innerWidth, (1 - v.y) / 2 * innerHeight]); }
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const sheetTop = document.getElementById('panel').getBoundingClientRect().top;
  return { bboxScreen: [Math.round(Math.min(...xs)), Math.round(Math.min(...ys)), Math.round(Math.max(...xs)), Math.round(Math.max(...ys))], viewport: [innerWidth, innerHeight], sheetTop: Math.round(sheetTop), hFovDeg: +(2 * Math.atan(Math.tan(camera.fov * Math.PI / 360) * camera.aspect) * 180 / Math.PI).toFixed(1) };
});
await page.screenshot({ path: path.join(SHOTS, 'legacy-sim-m-08-portrait-insp.png') });
console.log(JSON.stringify(out, null, 1));
await browser.close(); server.close();
