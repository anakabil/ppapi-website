// close-up evidence shots for verify-eng-simulator (ladder top / gate; lift-1 deck enclosure)
import { startServer, launch, newContext, seedSession, shot } from './aplikasi-lib.mjs';
const { server, BASE } = await startServer();
const browser = await launch();
const ctx = await newContext(browser, 'desktop'); await seedSession(ctx, {});
const page = await ctx.newPage();
await page.goto(`${BASE}/aplikasi/simulator/index.html`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'));
await page.click('#startBtn'); await page.waitForFunction(() => window.PPAPISim);
await page.click('#tab-build');
for (let i = 0; i < 18; i++) await page.click('#placeBtn');
await page.waitForTimeout(600);
const views = { 'ladder-top-side': [[0.4, 5.25, 1.9], [-1.55, 4.9, 0.6]], 'ladder-top-3q': [[-1.55, 5.6, 2.2], [-1.55, 4.85, 0.6]], 'lift1-enclosed': [[-5.5, 3.6, 4.5], [0, 2.4, 0]] };
for (const [name, [pos, tgt]] of Object.entries(views)) {
  await page.evaluate(({ pos, tgt }) => { const c = PPAPISim.camera; c.clearViewOffset(); c.position.set(...pos); c.lookAt(...tgt); c.updateProjectionMatrix(); PPAPISim.renderer.shadowMap.needsUpdate = true; PPAPISim.renderer.render(PPAPISim.scene, c); }, { pos, tgt });
  await page.locator('#app-main canvas').screenshot({ path: new URL(`../shots/verify-sim-${name}.png`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') });
}
await browser.close(); server.close();
