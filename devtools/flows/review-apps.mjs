// review-apps — aplikasi/perencanaan + aplikasi/simulator: gate, portal bar, first screen, inner stages, 3D scene.
//   node flows/review-apps.mjs      → shots/review-tampilan/app-*.png
import { startServer, launch, makeCtx, open, shot, overflow, safe, report, finish } from './review-lib.mjs';

const { BASE, close } = await startServer();
const browser = await launch();                         // plain Chromium: planning-app full pages (tall on mobile)
const glBrowser = await launch({ swiftshader: true });  // WebGL for the simulator (viewport-only shots)
const PR = 'aplikasi/perencanaan/index.html';
const SIM = 'aplikasi/simulator/index.html';
const gateOk = page => page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'), null, { timeout: 40000 });

for (const vp of ['desktop', 'mobile', 'laptop']) {
  console.log(`\n[${vp}]`);
  await safe(`perencanaan ${vp}`, async () => {
    const ctx = await makeCtx(browser, vp, { auth: 'Aktif' });
    const page = await open(ctx, BASE, PR, { wait: 800 });
    await gateOk(page); await page.waitForTimeout(600);
    await shot(page, `app-pr-first-${vp}-fold`);
    await shot(page, `app-pr-first-${vp}-full`, { full: true, scroll: true });
    await shot(page, `app-pr-bar-${vp}`, { clip: { x: 0, y: 0, width: vp === 'mobile' ? 390 : (vp === 'laptop' ? 1024 : 1440), height: 120 } });
    await page.click('#menu-btn'); await page.waitForTimeout(400);
    await shot(page, `app-pr-menu-${vp}`);
    for (const v of ['beban', 'gambar', 'analisis', 'checklist', 'laporan']) {
      await page.click('#menu-btn').catch(() => {}); await page.waitForTimeout(200);
      const tab = page.locator(`#menu-panel .tab[data-v="${v}"]`);
      if (!(await tab.isVisible())) { await page.click('#menu-btn'); await page.waitForTimeout(200); }
      await tab.click(); await page.waitForTimeout(500);
      await page.evaluate(() => scrollTo(0, 0));
      await shot(page, `app-pr-${v}-${vp}-full`, { full: true, scroll: true });
      const ov = await overflow(page); if (ov > 1) console.log(`  ! perencanaan ${v} ${vp}: overflow ${ov}px`);
    }
    report(page, `perencanaan ${vp}`);
    await page.close(); await ctx.close();
  });
  await safe(`simulator ${vp}`, async () => {
    const ctx = await makeCtx(glBrowser, vp, { auth: 'Aktif' });
    const page = await open(ctx, BASE, SIM, { wait: 800 });
    await gateOk(page); await page.waitForTimeout(600);
    await shot(page, `app-sim-intro-${vp}`);
    await page.click('#startBtn');
    await page.waitForFunction(() => window.PPAPISim && document.querySelector('#app-main canvas'), null, { timeout: 40000 });
    await page.waitForTimeout(1200);
    await shot(page, `app-sim-start-${vp}`);
    await page.click('#tab-build').catch(() => {});
    for (let i = 0; i < 8; i++) { await page.click('#placeBtn').catch(() => {}); await page.waitForTimeout(250); }
    await page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForTimeout(600);
    await shot(page, `app-sim-build8-${vp}`);
    await page.click('#tab-insp').catch(() => {}); await page.waitForTimeout(500);
    await shot(page, `app-sim-insp-${vp}`);
    await page.click('#tab-lib').catch(() => {}); await page.waitForTimeout(500);
    await shot(page, `app-sim-lib-${vp}`);
    if (vp === 'mobile') {
      await page.click('#sheetToggle').catch(() => {}); await page.waitForTimeout(400);
      await shot(page, `app-sim-sheet-open-mobile`);
      await page.click('#camToggle').catch(() => {}); await page.waitForTimeout(400);
      await shot(page, `app-sim-cam-open-mobile`);
    }
    report(page, `simulator ${vp}`);
    await page.close(); await ctx.close();
  });
}
// gate states: signed out + Draf member
for (const [label, auth] of [['out', false], ['draf', 'Draf']]) {
  await safe(`gate ${label}`, async () => {
    const ctx = await makeCtx(browser, 'desktop', { auth });
    const page = await open(ctx, BASE, PR, { wait: 1500 });
    await shot(page, `app-gate-${label}-desktop`);
    await page.close(); await ctx.close();
  });
}

await browser.close(); await glBrowser.close(); await close();
finish('review-apps');
