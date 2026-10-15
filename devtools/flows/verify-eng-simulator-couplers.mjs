// verify-eng-simulator (part 2): for every coupler, which tubes does it sit on, and is it inside the tube length?
import { startServer, launch, newContext, seedSession } from './aplikasi-lib.mjs';
const { server, BASE } = await startServer();
const browser = await launch();
const ctx = await newContext(browser, 'desktop'); await seedSession(ctx, {});
const page = await ctx.newPage();
await page.goto(`${BASE}/aplikasi/simulator/index.html`, { waitUntil: 'networkidle' });
await page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'));
await page.click('#startBtn'); await page.waitForFunction(() => window.PPAPISim);
await page.click('#tab-build');
for (let i = 0; i < 18; i++) await page.click('#placeBtn');
const res = await page.evaluate(() => {
  const S = PPAPISim.scene, TH = THREE; S.updateMatrixWorld(true);
  const vis = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const tubes = [], cps = [];
  S.traverse(o => {
    if (o.userData && o.userData.couplerType && vis(o)) { const p = new TH.Vector3(); o.getWorldPosition(p); cps.push({ t: o.userData.couplerType, r: o.userData.role, p }); }
    if (o.isMesh && vis(o) && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.height > 0.3 && o.geometry.parameters.radiusTop >= 0.015) {
      const p = new TH.Vector3(), q = new TH.Quaternion(), s = new TH.Vector3(); o.matrixWorld.decompose(p, q, s); const h = o.geometry.parameters.height; const d = new TH.Vector3(0, 1, 0).applyQuaternion(q).normalize();
      tubes.push({ role: o.userData.role || '', a: p.clone().addScaledVector(d, -h / 2), d, h });
    }
  });
  const out = [];
  cps.forEach(c => {
    const on = tubes.map(t => { const v = c.p.clone().sub(t.a); const s = v.dot(t.d); const perp = v.clone().addScaledVector(t.d, -s).length(); return { role: t.role, s, h: t.h, perp }; })
      .filter(x => x.perp < 0.08 && x.s > -0.08 && x.s < x.h + 0.08);
    on.forEach(x => { const inside = Math.min(x.s, x.h - x.s); if (inside < 0.036) out.push({ coupler: c.t, crole: c.r, at: [c.p.x, c.p.y, c.p.z].map(v => +v.toFixed(3)), tube: x.role, perp: +x.perp.toFixed(3), insideFromEnd: +inside.toFixed(3) }); });
  });
  return out.filter(o => /brace|ledger|rail|transom|putlog|outrigger/.test(o.tube) && !(o.crole === 'coupler' && o.tube === 'brace'));
});
const byKey = {}; res.forEach(o => { const k = `${o.coupler}@${o.tube}`; (byKey[k] = byKey[k] || []).push(o); });
Object.entries(byKey).forEach(([k, v]) => console.log(k, v.length, JSON.stringify(v.slice(0, 4))));
await browser.close(); server.close();
