// ANALISIS (read-only) — legacy simulator.html (Simulator Pemasangan Scaffolding — Tube & Coupler)
// Serves devtools/legacy/asosiasi.ppapi-main over HTTP, drives the app in headless Chromium
// (SwiftShader WebGL), steps through the whole build sequence, probes inspection, laser, keyboard,
// resize, WebGL context loss, no-WebGL and blocked-CDN cases, desktop + mobile (touch via CDP).
// Run from devtools/:  node flows/legacy-simulator.mjs
// Output: devtools/shots/legacy-sim-*.png  + JSON summary on stdout (also devtools/flows/legacy-simulator.out.json)
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', 'legacy', 'asosiasi.ppapi-main');
const SHOTS = path.resolve(__dirname, '..', 'shots');
const OUT = process.env.LEGACY_OUT || path.join(process.env.TEMP || process.env.TMPDIR || '.', 'legacy-simulator.out.json');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const URL_SIM = `${BASE}/simulator.html`;
const R = { desktop: {}, mobile: {}, failure: {} };
const shot = (page, name, opts = {}) => page.screenshot({ path: path.join(SHOTS, `legacy-sim-${name}.png`), ...opts });
const sleep = ms => new Promise(r => setTimeout(r, ms));

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });

function watch(page, bucket) {
  bucket.console = []; bucket.pageErrors = []; bucket.failed = [];
  page.on('console', m => bucket.console.push(`[${m.type()}] ${m.text()}`.slice(0, 300)));
  page.on('pageerror', e => bucket.pageErrors.push(String(e && e.message || e).slice(0, 300)));
  page.on('requestfailed', r => bucket.failed.push(`${r.url()} — ${r.failure() && r.failure().errorText}`));
}

const info = () => ({
  geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures,
  programs: (renderer.info.programs || []).length, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles,
  current: state.current, mode: MODE,
  heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
});
const sceneStats = () => {
  let meshes = 0, visibleMeshes = 0, lines = 0; const mats = new Set(), geos = new Set();
  const isVis = o => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  scene.traverse(o => { if (o.isMesh) { meshes++; if (isVis(o)) visibleMeshes++; mats.add(o.material.uuid); geos.add(o.geometry.uuid); } if (o.isLine) lines++; });
  return { meshes, visibleMeshes, lines, uniqueMaterials: mats.size, uniqueGeometries: geos.size, labels: document.querySelectorAll('#labels .lbl').length };
};
const panelText = () => {
  const q = s => document.querySelector(s);
  return {
    no: q('.stepno') && q('.stepno').textContent, title: q('.stepcard h3') && q('.stepcard h3').textContent,
    desc: q('.stepcard .desc') && q('.stepcard .desc').innerText, chip: q('.stepcard .chip') && q('.stepcard .chip').innerText,
    checks: [...document.querySelectorAll('.stepcard .check span:last-child')].map(e => e.textContent),
    button: q('#placeBtn') && q('#placeBtn').textContent, prog: q('.prog .cnt') && q('.prog .cnt').textContent,
    done: q('.done-banner') && q('.done-banner').innerText,
  };
};
// screen point of the first mesh of the current ghost step group that is not under the panel
const ghostPoint = () => {
  const grp = stepGroups[state.current]; if (!grp) return null;
  const panel = document.getElementById('panel').getBoundingClientRect();
  const pts = [];
  grp.traverse(o => { if (o.isMesh) { const v = new THREE.Vector3(); o.getWorldPosition(v); v.project(camera); pts.push({ x: (v.x + 1) / 2 * innerWidth, y: (1 - v.y) / 2 * innerHeight }); } });
  const ok = pts.filter(p => p.x > 10 && p.y > 90 && p.x < innerWidth - 10 && p.y < innerHeight - 10 && !(p.x >= panel.left && p.x <= panel.right && p.y >= panel.top && p.y <= panel.bottom));
  return ok[0] || null;
};

/* ======================================================================= DESKTOP */
if (!process.env.SKIP_DESKTOP) {
  const D = R.desktop;
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, deviceScaleFactor: 1, locale: 'id-ID' });
  const page = await ctx.newPage(); watch(page, D);
  await page.goto(URL_SIM, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  D.gl = await page.evaluate(() => {
    const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { three: THREE.REVISION, webgl2: renderer.capabilities.isWebGL2, glRenderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      maxTex: renderer.capabilities.maxTextureSize, pixelRatio: renderer.getPixelRatio(), shadowMap: renderer.shadowMap.type, steps: STEPS.length,
      stepTitles: STEPS.map(s => s.title), localStorageKeys: Object.keys(localStorage) };
  });
  D.atLoad = await page.evaluate(info);
  await shot(page, 'd-01-intro');
  await page.click('#startBtn'); await page.waitForTimeout(1500);
  await shot(page, 'd-02-lib');
  D.libInitial = await page.evaluate(() => document.querySelectorAll('[data-lib]').length);
  // library leak probe: click all items twice
  const libBefore = await page.evaluate(info);
  const libTypes = await page.evaluate(() => [...document.querySelectorAll('[data-lib]')].map(b => b.dataset.lib));
  const libSpecs = [];
  for (let pass = 0; pass < 2; pass++) for (const t of libTypes) {
    await page.click(`[data-lib="${t}"]`); await page.waitForTimeout(60);
    if (pass === 0) libSpecs.push(await page.evaluate(() => ({ h3: document.querySelector('.spec h3').textContent, ftn: document.querySelector('.spec .ftn').textContent, meta: [...document.querySelectorAll('.meta .r')].map(r => r.innerText.replace(/\n/g, ': ')) })));
    if (pass === 0 && (t === 'swivel' || t === 'ladder' || t === 'anchorclamp')) { await page.waitForTimeout(500); await shot(page, `d-03-lib-${t}`); }
  }
  await page.waitForTimeout(200);
  D.libLeak = { before: libBefore, after2passes: await page.evaluate(info), types: libTypes, specs: libSpecs };

  // BUILD
  await page.click('.tab[data-tab="build"]'); await page.waitForTimeout(1800);
  D.buildStart = await page.evaluate(info);
  const thumbs = []; D.steps = [];
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => state.current);
    if (st >= (await page.evaluate(() => STEPS.length))) break;
    const pt = await page.evaluate(panelText);
    pt.info = await page.evaluate(info);
    thumbs.push({ label: `${pt.no}. ${pt.title}`, b64: (await page.screenshot({ type: 'jpeg', quality: 70 })).toString('base64') });
    if ([0, 2, 5, 8, 9, 12, 13, 15, 18, 19].includes(st)) await shot(page, `d-step-${String(st + 1).padStart(2, '0')}`);
    if (st === 0) { // verify click-on-ghost (raycast pick)
      const gp = await page.evaluate(ghostPoint);
      if (gp) { await page.mouse.click(gp.x, gp.y); await page.waitForTimeout(400); }
      pt.pickedByClick = { point: gp, advanced: (await page.evaluate(() => state.current)) === 1 };
      if (!pt.pickedByClick.advanced) { await page.click('#placeBtn'); }
    } else if (st === 4) { // undo / redo probe + hint leak probe
      const g0 = await page.evaluate(info);
      for (let k = 0; k < 10; k++) { await page.click('#undoBtn'); await page.waitForTimeout(40); await page.click('#placeBtn'); await page.waitForTimeout(40); }
      pt.undoRedo10 = { before: g0, after: await page.evaluate(info) };
      await page.click('#placeBtn');
    } else {
      await page.click('#placeBtn');
    }
    await page.waitForTimeout(st === 0 ? 900 : 650);
    D.steps.push(pt);
  }
  await page.waitForTimeout(800);
  D.done = { panel: await page.evaluate(panelText), info: await page.evaluate(info), scene: await page.evaluate(sceneStats), toast: await page.evaluate(() => document.getElementById('toastMsg').textContent) };
  await shot(page, 'd-05-done');
  thumbs.push({ label: 'Selesai', b64: (await page.screenshot({ type: 'jpeg', quality: 70 })).toString('base64') });
  // fps (swiftshader — relative only)
  D.fpsBuildDone = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); })(); }));
  // "Bongkar 1 tahap"
  await page.click('#undoBtn'); await page.waitForTimeout(400);
  D.afterBongkar = await page.evaluate(() => ({ current: state.current, panel: document.querySelector('.stepcard h3') && document.querySelector('.stepcard h3').textContent }));
  await page.click('#placeBtn'); await page.waitForTimeout(400);
  // INSPEKSI
  await page.click('#toInsp'); await page.waitForTimeout(1600);
  await shot(page, 'd-06-insp');
  const toggles = await page.evaluate(() => [...document.querySelectorAll('[data-insp]')].map(t => t.dataset.insp));
  for (const k of toggles) { await page.click(`[data-insp="${k}"]`); await page.waitForTimeout(250); }
  await page.waitForTimeout(800);
  await shot(page, 'd-07-insp-all');
  D.inspAll = { info: await page.evaluate(info), scene: await page.evaluate(sceneStats), labels: await page.evaluate(() => [...document.querySelectorAll('#labels .lbl')].map(l => l.textContent)), note: await page.evaluate(() => document.querySelector('.insp-note').innerText) };
  const iBefore = await page.evaluate(info);
  for (let k = 0; k < 10; k++) for (const t of toggles) { await page.click(`[data-insp="${t}"]`); await page.waitForTimeout(20); }
  await page.waitForTimeout(300);
  D.inspLeak = { before: iBefore, after40toggles: await page.evaluate(info) };
  // toast colours (worker toggle shows a toast)
  await page.click('#workerBtn'); await page.waitForTimeout(400);
  D.toast = await page.evaluate(() => { const t = document.getElementById('toast'), cs = getComputedStyle(t); return { text: t.innerText, color: cs.color, bg: cs.backgroundColor, ariaLive: t.getAttribute('aria-live'), role: t.getAttribute('role') }; });
  const tb = await page.locator('#toast').boundingBox();
  if (tb) await shot(page, 'd-08-toast', { clip: { x: Math.max(0, tb.x - 20), y: Math.max(0, tb.y - 20), width: tb.width + 40, height: tb.height + 40 } });
  await page.click('#workerBtn'); await page.waitForTimeout(200);
  // LASER
  await page.click('#laserBtn'); await page.waitForTimeout(200);
  await page.mouse.move(520, 420); await page.mouse.move(540, 430, { steps: 4 }); await page.waitForTimeout(300);
  D.laser = { visibleAfterMove: await page.evaluate(() => laserGroup.visible) };
  await shot(page, 'd-09-laser');
  await page.waitForTimeout(2500);
  D.laser.visibleAfter2_5s = await page.evaluate(() => laserGroup.visible);
  D.laser.title = await page.getAttribute('#laserBtn', 'title');
  await page.click('#laserBtn');
  // KEYBOARD
  await page.evaluate(() => { document.activeElement && document.activeElement.blur(); });
  const focusSeq = [];
  for (let k = 0; k < 16; k++) { await page.keyboard.press('Tab'); focusSeq.push(await page.evaluate(() => { const a = document.activeElement; return a ? (a.id ? '#' + a.id : a.tagName.toLowerCase() + (a.className ? '.' + String(a.className).split(' ')[0] : '')) + (a.getAttribute('aria-label') ? `[aria-label=${a.getAttribute('aria-label')}]` : '') : null; })); }
  const camBefore = await page.evaluate(() => ({ th: cam.tTheta, r: cam.tRadius }));
  await page.mouse.click(600, 300); // focus canvas area
  for (const key of ['ArrowLeft', 'ArrowUp', 'KeyW', 'KeyA', 'Equal', 'Minus', 'KeyR']) await page.keyboard.press(key);
  await page.waitForTimeout(200);
  const camAfter = await page.evaluate(() => ({ th: cam.tTheta, r: cam.tRadius }));
  // keyboard activation of pan button (holdBtn uses pointerdown only)
  await page.focus('#zoomIn'); const r0 = await page.evaluate(() => cam.tRadius); await page.keyboard.press('Enter'); await page.keyboard.press('Space'); await page.waitForTimeout(100);
  D.keyboard = { focusSeq, tabsFocusable: await page.evaluate(() => [...document.querySelectorAll('.tab')].map(t => t.tabIndex)), arrowKeysMoveCamera: JSON.stringify(camBefore) !== JSON.stringify(camAfter), zoomInByKeyboard: (await page.evaluate(() => cam.tRadius)) !== r0,
    camButtonsA11y: await page.evaluate(() => [...document.querySelectorAll('#cam button')].map(b => ({ id: b.id, text: b.textContent, title: b.title, aria: b.getAttribute('aria-label') }))) };
  // RESIZE
  await page.setViewportSize({ width: 900, height: 600 }); await page.waitForTimeout(500);
  D.resize = await page.evaluate(() => ({ canvas: [renderer.domElement.width, renderer.domElement.height], css: [renderer.domElement.clientWidth, renderer.domElement.clientHeight], aspect: +camera.aspect.toFixed(3) }));
  await shot(page, 'd-10-resized-900');
  await page.setViewportSize({ width: 1366, height: 768 }); await page.waitForTimeout(400);
  // CONTEXT LOSS
  D.ctxLoss = {};
  D.ctxLoss.hasListener = await page.evaluate(() => { const c = renderer.domElement; return { onlost: !!c.onwebglcontextlost }; });
  const nC = D.console.length;
  await page.evaluate(() => { window.__lose = renderer.getContext().getExtension('WEBGL_lose_context'); window.__lose.loseContext(); });
  await page.waitForTimeout(800);
  await shot(page, 'd-11-ctx-lost');
  D.ctxLoss.uiMessageVisible = await page.evaluate(() => /konteks|WebGL|grafis|muat ulang/i.test(document.body.innerText));
  await page.evaluate(() => window.__lose.restoreContext()); await page.waitForTimeout(1500);
  await shot(page, 'd-12-ctx-restored');
  D.ctxLoss.consoleDuring = D.console.slice(nC);
  D.ctxLoss.afterRestore = await page.evaluate(info);
  D.memoryHint = await page.evaluate(() => ({ dpr: devicePixelRatio, shadowMapSize: key.shadow.mapSize.x, antialias: renderer.getContextAttributes().antialias }));
  // contact sheet of all steps
  const sheet = await ctx.newPage();
  await sheet.setViewportSize({ width: 1840, height: 1000 });
  await sheet.setContent(`<html><body style="margin:0;background:#222;font:600 14px system-ui;color:#fff"><div style="display:grid;grid-template-columns:repeat(4,455px);gap:6px;padding:6px">${thumbs.map(t => `<figure style="margin:0"><img style="width:455px;display:block" src="data:image/jpeg;base64,${t.b64}"><figcaption style="padding:3px 4px;background:#000">${t.label.replace(/</g, '&lt;')}</figcaption></figure>`).join('')}</div></body></html>`);
  await sheet.waitForTimeout(400);
  await sheet.screenshot({ path: path.join(SHOTS, 'legacy-sim-d-steps-contact.png'), fullPage: true });
  await ctx.close();
}

/* ======================================================================= MOBILE */
{
  const M = R.mobile;
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: 'id-ID' });
  const page = await ctx.newPage(); watch(page, M);
  const cdp = await ctx.newCDPSession(page);
  await page.goto(URL_SIM, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await shot(page, 'm-01-intro');
  M.introFits = await page.evaluate(() => { const c = document.querySelector('#intro .card').getBoundingClientRect(); return { top: Math.round(c.top), bottom: Math.round(c.bottom), vh: innerHeight }; });
  await page.tap('#startBtn'); await page.waitForTimeout(1500);
  await shot(page, 'm-02-lib');
  const topAt = sel => page.evaluate(s => { const b = document.querySelector(s); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { sel: s, rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)], topElement: e ? (e.id || e.className || e.tagName) : null, covered: e !== b && !b.contains(e) }; }, sel);
  M.camPadLib = [];
  for (const s of ['#camReset', '#zoomIn', '#laserBtn', '#workerBtn', '#u', '#d']) M.camPadLib.push(await topAt(s));
  M.panelLib = await page.evaluate(() => { const p = document.getElementById('panel').getBoundingClientRect(); const b = document.getElementById('pBody'); return { top: Math.round(p.top), height: Math.round(p.height), bodyScroll: [b.scrollHeight, b.clientHeight] }; });
  // touch scroll inside the bottom sheet
  const pb = await page.evaluate(() => { const r = document.getElementById('pBody').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, st: document.getElementById('pBody').scrollTop }; });
  await cdp.send('Input.synthesizeScrollGesture', { x: Math.round(pb.x), y: Math.round(pb.y), yDistance: -200, gestureSourceType: 'touch', speed: 800 }).catch(e => (M.scrollErr = e.message));
  await page.waitForTimeout(500);
  M.panelTouchScroll = { before: pb.st, after: await page.evaluate(() => document.getElementById('pBody').scrollTop) };
  // tabs
  await page.tap('.tab[data-tab="build"]'); await page.waitForTimeout(1800);
  await shot(page, 'm-03-build-step01');
  M.tabsRow = await page.evaluate(() => { const t = document.getElementById('tabs'); return { scrollW: t.scrollWidth, clientW: t.clientWidth, rect: t.getBoundingClientRect().toJSON() }; });
  M.camPadBuild = [];
  for (const s of ['#camReset', '#zoomIn', '#laserBtn']) M.camPadBuild.push(await topAt(s));
  // touch orbit (one finger drag on canvas, upper area)
  const th0 = await page.evaluate(() => cam.tTheta);
  const tp = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
  await tp('touchStart', [{ x: 150, y: 260, id: 1 }]);
  for (let k = 1; k <= 8; k++) await tp('touchMove', [{ x: 150 + k * 12, y: 260, id: 1 }]);
  await tp('touchEnd', []);
  await page.waitForTimeout(300);
  M.touchOrbit = { before: th0, after: await page.evaluate(() => cam.tTheta) };
  // pinch zoom
  const r0 = await page.evaluate(() => cam.tRadius);
  await tp('touchStart', [{ x: 170, y: 280, id: 1 }, { x: 220, y: 280, id: 2 }]);
  for (let k = 1; k <= 8; k++) await tp('touchMove', [{ x: 170 - k * 10, y: 280, id: 1 }, { x: 220 + k * 10, y: 280, id: 2 }]);
  await tp('touchEnd', []);
  await page.waitForTimeout(300);
  M.pinch = { before: r0, after: await page.evaluate(() => cam.tRadius) };
  await page.evaluate(() => document.getElementById('camReset').click()); await page.waitForTimeout(1500); // pad is covered by the sheet on phones
  // tap on ghost
  const gp = await page.evaluate(ghostPoint);
  if (gp) { await page.touchscreen.tap(gp.x, gp.y); await page.waitForTimeout(500); }
  M.tapGhost = { point: gp, advanced: (await page.evaluate(() => state.current)) === 1 };
  // complete sequence
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => state.current);
    if (st >= 20) break;
    if (st === 9) { await page.waitForTimeout(500); await shot(page, 'm-04-build-step10'); }
    await page.tap('#placeBtn', { timeout: 4000 }).catch(async () => { M.placeTapBlocked = (M.placeTapBlocked || 0) + 1; await page.evaluate(() => document.getElementById('placeBtn').click()); }); await page.waitForTimeout(250);
  }
  await page.waitForTimeout(800);
  await shot(page, 'm-05-done');
  M.done = await page.evaluate(() => ({ current: state.current, done: !!document.querySelector('.done-banner'), toInsp: !!document.getElementById('toInsp') }));
  M.toInspVisible = await topAt('#toInsp');
  await page.tap('#toInsp', { timeout: 4000 }).catch(async () => { M.toInspTapBlocked = true; await page.evaluate(() => document.getElementById('toInsp').click()); }); await page.waitForTimeout(1500);
  for (const k of ['vert', 'horz', 'dist', 'square']) { await page.tap(`[data-insp="${k}"]`).catch(() => {}); await page.waitForTimeout(150); }
  await page.waitForTimeout(800);
  await shot(page, 'm-06-insp');
  M.inspPanel = await page.evaluate(() => { const b = document.getElementById('pBody'); return { scroll: [b.scrollHeight, b.clientHeight], toggles: document.querySelectorAll('.toggle.on').length }; });
  // landscape
  await page.setViewportSize({ width: 844, height: 390 }); await page.waitForTimeout(800);
  await shot(page, 'm-07-landscape');
  M.landscape = await page.evaluate(() => { const p = document.getElementById('panel').getBoundingClientRect(); const t = document.getElementById('top').getBoundingClientRect(); return { panel: [Math.round(p.top), Math.round(p.height)], top: Math.round(t.height), canvas: [renderer.domElement.width, renderer.domElement.height] }; });
  M.fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); (function f() { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else r(+(n / ((performance.now() - t0) / 1000)).toFixed(1)); })(); }));
  M.viewportMeta = await page.evaluate(() => document.querySelector('meta[name=viewport]').content);
  await ctx.close();
}

/* ======================================================================= FAILURE MODES */
{
  const F = R.failure;
  // 1. WebGL unavailable
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
    await ctx.addInitScript(() => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { if (/webgl/i.test(t)) return null; return orig.call(this, t, ...a); }; });
    const page = await ctx.newPage(); const b = {}; watch(page, b);
    await page.goto(URL_SIM, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
    await page.click('#startBtn').catch(e => (b.clickErr = e.message)); await page.waitForTimeout(600);
    b.introStillShown = await page.evaluate(() => getComputedStyle(document.getElementById('intro')).display !== 'none');
    await shot(page, 'x-01-nowebgl');
    F.noWebGL = b; await ctx.close();
  }
  // 2. three.js CDN blocked (offline / CDN outage)
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 760 } });
    await ctx.route('**/three.min.js', r => r.abort());
    const page = await ctx.newPage(); const b = {}; watch(page, b);
    await page.goto(URL_SIM, { waitUntil: 'load' }); await page.waitForTimeout(800);
    await page.click('#startBtn').catch(e => (b.clickErr = e.message)); await page.waitForTimeout(600);
    b.introStillShown = await page.evaluate(() => getComputedStyle(document.getElementById('intro')).display !== 'none');
    await shot(page, 'x-02-nocdn');
    F.noCDN = b; await ctx.close();
  }
}

await browser.close(); server.close();
fs.writeFileSync(OUT, JSON.stringify(R, null, 1));
console.log(JSON.stringify(R, null, 1));
