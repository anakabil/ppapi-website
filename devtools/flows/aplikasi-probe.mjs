// Visual probe for the ported member apps: screenshots of every planning view (+ simulator states).
// usage (cwd devtools): node flows/aplikasi-probe.mjs [perencanaan|simulator] [desktop|mobile] [--admin] [--full]
import { startServer, launch, newContext, seedSession, watch, shot } from './aplikasi-lib.mjs';
const args = process.argv.slice(2);
const app = args.find(a => a === 'perencanaan' || a === 'simulator') || 'perencanaan';
const vps = args.filter(a => a === 'desktop' || a === 'mobile');
const admin = args.includes('--admin'), full = args.includes('--full');
const { server, BASE } = await startServer();
const browser = await launch();
for (const vp of (vps.length ? vps : ['desktop', 'mobile'])) {
  const ctx = await newContext(browser, vp);
  await seedSession(ctx, { admin });
  const page = await ctx.newPage();
  const issues = watch(page);
  await page.goto(`${BASE}/aplikasi/${app}/index.html`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  if (app === 'perencanaan') {
    const views = ['beranda', 'proyek', 'beban', 'duty', 'gambar', 'material', 'analisis', 'jsa', 'checklist', 'laporan', 'tentang'].concat(admin ? ['admin'] : []);
    for (const v of views) {
      await page.evaluate(v => go(v), v);
      await page.waitForTimeout(250);
      await shot(page, `apl-pr-${vp}-${v}${admin ? '-admin' : ''}`, { fullPage: full });
    }
  } else {
    await shot(page, `apl-sim-${vp}-intro`, { fullPage: false });
    await page.click('#startBtn');
    await page.waitForFunction(() => window.PPAPISim && document.querySelector('#app-main canvas'), null, { timeout: 30000 });
    await page.waitForTimeout(800);
    await shot(page, `apl-sim-${vp}-lib`);
    await page.click('#tab-build');
    await page.waitForTimeout(500);
    await shot(page, `apl-sim-${vp}-build0`);
    for (let i = 0; i < 6; i++) { await page.click('#placeBtn'); await page.waitForTimeout(150); }
    await page.waitForTimeout(800);
    await shot(page, `apl-sim-${vp}-build6`);
    for (let i = 0; i < 14; i++) { await page.click('#placeBtn'); await page.waitForTimeout(120); }
    await page.waitForTimeout(800);
    await shot(page, `apl-sim-${vp}-build20`);
    await page.click('#tab-insp');
    await page.waitForTimeout(400);
    for (const k of ['vert', 'horz', 'dist', 'square']) { await page.click(`[data-insp="${k}"]`); await page.waitForTimeout(150); }
    await page.waitForTimeout(900);
    await shot(page, `apl-sim-${vp}-insp`);
    if (vp === 'mobile') { await page.click('#sheetToggle'); await page.waitForTimeout(900); await shot(page, `apl-sim-${vp}-insp-collapsed`); }
  }
  console.log(vp, issues.length ? issues : 'no issues');
  await ctx.close();
}
await browser.close();
server.close();
