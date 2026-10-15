// retheme-simulator-shots — screenshots of every simulator UI state (desktop + mobile) for the
// PPAPI retheme review: intro, library, all 20 build steps, inspection overlays, toast, fallbacks.
// usage (cwd devtools): node flows/retheme-simulator-shots.mjs [--only=desktop,mobile,fallback] [--steps=all|key]
// shots → devtools/shots/retheme-sim-*.png
import { startServer, launch, newContext, seedSession, watch, recorder, shot, simDrawn } from './aplikasi-lib.mjs';

const args = process.argv.slice(2);
const only = (args.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const run = (k) => !only.length || only.includes(k);
const allSteps = (args.find(a => a.startsWith('--steps=')) || '--steps=key').slice(8) === 'all';
const T = recorder('retheme-simulator-shots');
const { server, BASE } = await startServer();
const browser = await launch();
const SIM = `${BASE}/aplikasi/simulator/index.html`;
const KEY_STEPS = new Set([1, 2, 5, 8, 9, 11, 12, 15, 18, 19, 20]);
const noIssues = (label, issues) => T.ok(issues.length === 0, `${label}: no console errors / page errors / failed requests`, issues.slice(0, 4));

async function openSim(vp, { init } = {}) {
  const ctx = await newContext(browser, vp);
  await seedSession(ctx, {});
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const issues = watch(page);
  await page.goto(SIM, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'), null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  return { ctx, page, issues };
}
async function start(page) {
  await page.click('#startBtn');
  await page.waitForFunction(() => window.PPAPISim && document.querySelector('#app-main canvas'), null, { timeout: 30000 });
  await page.waitForTimeout(300);
  await simDrawn(page);
}
const settle = async (page, ms = 250) => { await page.waitForTimeout(ms); await simDrawn(page); };

for (const vp of ['desktop', 'mobile']) {
  if (!run(vp)) continue;
  T.section(`${vp.toUpperCase()} states`);
  const { ctx, page, issues } = await openSim(vp);
  const P = `retheme-sim-${vp}`;
  await shot(page, `${P}-00-intro`);
  await start(page);
  await settle(page, 500);
  await shot(page, `${P}-01-lib`);
  await page.click('[data-lib="swivel"]'); await settle(page);
  await shot(page, `${P}-02-lib-swivel`);
  await page.click('[data-lib="redtag"]'); await settle(page);
  await shot(page, `${P}-03-lib-redtag`);
  // build
  await page.click('#tab-build'); await settle(page, 400);
  await shot(page, `${P}-10-build-step01`);
  for (let i = 1; i <= 20; i++) {
    await page.click('#placeBtn'); await settle(page, 120);
    if (allSteps || KEY_STEPS.has(i)) await shot(page, `${P}-10-build-after${String(i).padStart(2, '0')}`);
  }
  await shot(page, `${P}-11-build-done`);
  // toast: toggle worker illustration
  await page.click('#workerBtn').catch(() => {});
  if (vp === 'mobile') { await page.click('#camToggle'); await settle(page); await page.click('#workerBtn'); }
  await page.waitForTimeout(200);
  await shot(page, `${P}-12-toast-cam`);
  if (vp === 'mobile') { await page.click('#camToggle'); await settle(page); }
  // inspection
  await page.click('#tab-insp'); await settle(page, 400);
  await shot(page, `${P}-20-insp`);
  for (const k of ['vert', 'horz', 'dist', 'square', 'edge', 'stab']) await page.click(`[data-insp="${k}"]`);
  await settle(page, 400);
  await shot(page, `${P}-21-insp-all`);
  if (vp === 'mobile') {
    await page.click('#sheetToggle'); await settle(page, 300);
    await shot(page, `${P}-22-insp-collapsed`);
    await page.click('#sheetToggle'); await settle(page, 300);
  }
  await page.evaluate(() => document.getElementById('pBody').scrollTo(0, 99999)); await page.waitForTimeout(100);
  await shot(page, `${P}-23-insp-scrolled`);
  // focus-visible: keyboard focus on a tab, then Tab into the panel / camera controls
  await page.focus('#tab-build'); await page.keyboard.press('ArrowLeft'); await settle(page, 300);
  await shot(page, `${P}-30-focus-tab`);
  await page.click('#tab-build'); await settle(page, 300);
  if (vp === 'mobile') { await page.click('#camToggle'); await settle(page); }
  await page.focus('#zoomIn'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');   // keyboard modality → :focus-visible
  await settle(page, 200);
  await shot(page, `${P}-31-focus-cam`);
  if (vp === 'mobile') { await page.click('#camToggle'); await settle(page); }
  await page.click('#undoBtn'); await settle(page, 300);
  await page.focus('#placeBtn'); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
  await settle(page, 200);
  await shot(page, `${P}-32-focus-place`);
  noIssues(vp, issues);
  await ctx.close();
}

for (const [key, extra] of [['tablet', { viewport: { width: 1024, height: 768 } }], ['landscape', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  if (!run(key)) continue;
  T.section(key.toUpperCase() + ' states');
  const ctx = await newContext(browser, 'desktop', extra);
  await seedSession(ctx, {});
  const page = await ctx.newPage();
  const issues = watch(page);
  await page.goto(SIM, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'), null, { timeout: 30000 });
  await page.evaluate(() => document.fonts.ready);
  await shot(page, `retheme-sim-${key}-00-intro`);
  await start(page);
  await page.click('#tab-build'); await settle(page, 300);
  for (let i = 0; i < 12; i++) { await page.click('#placeBtn'); await settle(page, 60); }
  await page.click('#camToggle'); await settle(page, 300);
  await shot(page, `retheme-sim-${key}-10-build-cam`);
  await page.click('#camToggle');
  await page.click('#tab-insp'); await settle(page, 300);
  await page.click('[data-insp="edge"]'); await settle(page, 300);
  await shot(page, `retheme-sim-${key}-20-insp`);
  noIssues(key, issues);
  await ctx.close();
}

if (run('fallback')) {
  T.section('FALLBACK messages');
  for (const vp of ['desktop', 'mobile']) {
    const { ctx, page } = await openSim(vp, { init: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/i.test(t) ? null : g.call(this, t, ...a); }; } });
    await page.click('#startBtn');
    await page.waitForSelector('#sim-msg:not([hidden])', { timeout: 30000 });
    await page.waitForTimeout(200);
    await shot(page, `retheme-sim-${vp}-40-nowebgl`);
    await ctx.close();
  }
  {
    const ctx = await newContext(browser, 'desktop');
    await seedSession(ctx, {});
    await ctx.route(/three\.min\.js/, r => r.abort());
    const page = await ctx.newPage();
    await page.goto(SIM, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'), null, { timeout: 30000 });
    await page.click('#startBtn');
    await page.waitForSelector('#sim-msg:not([hidden])', { timeout: 30000 });
    await page.waitForTimeout(200);
    await shot(page, 'retheme-sim-desktop-41-nothree');
    await ctx.close();
  }
}

await browser.close();
server.close();
process.exit(T.done() ? 1 : 0);
