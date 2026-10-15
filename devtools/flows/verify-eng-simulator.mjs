// verify-eng-simulator — independent (adversarial) check of the corrected tube & coupler erection simulator.
// Written by the checking engineer; does NOT reuse the app's evaluate() for measurements and classifies
// scene meshes by raw geometry (CylinderGeometry / BoxGeometry, size, orientation), not only by role tags.
//   A  hand-derived reference values (from the stated dimensions) vs. the scene, at every one of the 20 states
//   B  physical-connection checks: every coupler must grip >= 2 members; ladder top support; ladder ties
//   C  access & sequence logic: who can reach which deck at which step; headroom; step-across
//   D  inspection engine robustness: targeted mutations that SHOULD fail (and ones that wrongly pass)
//   E  UI claims vs geometry (step texts, inspection panel strings)
// usage (cwd devtools): node flows/verify-eng-simulator.mjs   → prints findings + writes shots/verify-sim-*.png
//
// Release QA 2026-10-10: the hand references follow REVISION 2 of the correction (site/aplikasi/KOREKSI-SIMULATOR.md),
// which changed the design on this tool's own review findings — end-side rails +75 mm (§2.2), end transoms at ±1,86 m
// (§2.3), no facade diagonal in the lift-1 access bay on lift 2 (§2.6), self-closing gates on the inner side of the rails
// and ladders tied to the retained top rail, ledger ties dropped (§2.9), 84 materials (§5). Every value below is still
// derived by hand from the stated dimensions, never read back from the scene. Measurement changes: a rail gap counts as
// closed only when a gate leaf (bars on the inner side of the rail line) laps BOTH fixed rail ends; headroom is taken over
// the walkway, i.e. edge protection running along a deck edge (rails, gate leaf) is not an overhead member.
import { startServer, launch, newContext, seedSession, watch, recorder, shot } from './aplikasi-lib.mjs';

const T = recorder('verify-eng-simulator');
const { server, BASE } = await startServer();
const browser = await launch();
const SIM = `${BASE}/aplikasi/simulator/index.html`;
const OUT = {};

/* ---------- reference values derived by hand from the stated configuration ----------
   tube Ø48.3 → r = 0.024 (model), ledger y = 0.15 / 1.95 / 3.90, transom sits on ledger (+2r),
   board 38 mm on transom: deck = ledger + 2r + r + 0.038 = ledger + 0.110
   top rail top surface = deck + 1.000; mid-rail centre = deck + 0.53; toe board 0.150
   rev. 2 (KOREKSI-SIMULATOR §2.2): end-side rails 75 mm higher → top 1.075, mid centre 0.605
   rev. 2 (§2.3): transoms at x = −1.86 / −0.90 / 0.08 / 0.98 / 1.86, board 3.9 m → overhang 1.95 − 1.86 = 0.09 (axis)
   rev. 2 (§2.6): facade "∧" per lift = 2 sides × 2 lifts × 2 bays = 8, minus the lift-1 access bay on lift 2 = 7
   rev. 2 (§2.9): gate leaf from puncheon+0.03 to puncheon−0.03, rails protrude 0.06 past the puncheon clamp → lap 0.03
   rev. 2 (§2.9): lift-1 gate opening clear height = lift-2 ledger underside (3.90 − r) − deck1                        */
const r = 0.024;
const REF = (() => {
  const deck1 = 1.95 + 2 * r + r + 0.038, deck2 = 3.90 + 2 * r + r + 0.038;
  const gapToeMid = (0.53 - r) - 0.15, gapMidTop = (1.0 - 2 * r) - (0.53 + r);
  const endOff = 0.075, gapToeMidEnd = (0.53 + endOff - r) - 0.15, gapMidTopEnd = (1.0 + endOff - 2 * r) - (0.53 + endOff + r);
  const brace1 = Math.atan2(1.95 - 0.15, 2.0) * 180 / Math.PI, brace2 = Math.atan2(3.90 - 1.95, 2.0) * 180 / Math.PI;
  const endX1 = Math.atan2(1.80, 1.2) * 180 / Math.PI, endX2 = Math.atan2(1.95, 1.2) * 180 / Math.PI;
  const TX = [-1.86, -0.90, 0.08, 0.98, 1.86];
  const spans = TX.slice(1).map((x, i) => x - TX[i]);
  const yRest = deck2 + 1.0 - r, run = yRest / 4, wl = Math.hypot(yRest, run);
  return { deck1, deck2, gapToeMid, gapMidTop, gapToeMidEnd, gapMidTopEnd, topLong: 1.0, topEnd: 1.0 + endOff, gateLap: 0.06 - 0.03,
    facadeBraces: 2 * 2 * 2 - 1, gateClear: (3.90 - r) - deck1,
    brace1, brace2, endX1, endX2, maxSpan: Math.max(...spans), overhang: 1.95 - 1.86,
    HB_final: 5.10 / (2 * (0.6 + 1.0)), HB_pre: 4.15 / 1.2, ladderRatio: run / wl, ladderAngle: Math.atan2(yRest, run) * 180 / Math.PI,
    headroom1: (3.90 + 2 * r - r) - deck1, bpArea: 16 * 16 };
})();
OUT.REF = REF;
console.log('hand-derived reference', JSON.stringify(REF, (k, v) => typeof v === 'number' ? +v.toFixed(4) : v));

/* ---------- in-page raw measurement (geometry-based) ---------- */
const MEASURE = () => {
  const S = window.PPAPISim.scene, TH = window.THREE; S.updateMatrixWorld(true);
  const vis = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const solid = (o) => !(o.material && o.material.transparent && o.material.opacity < 0.6);
  const scaffold = S.children.find(c => c.children && c.children.some(g => g.userData && g.userData.stepId));
  const tubes = [], boxes = [], couplers = [];
  scaffold.traverse(o => {
    if (o.userData && o.userData.couplerType && vis(o) && o.children.every(solid)) { const p = new TH.Vector3(); o.getWorldPosition(p); couplers.push({ type: o.userData.couplerType, role: o.userData.role, p }); }
    if (!o.isMesh || !vis(o) || !solid(o)) return;
    const g = o.geometry, gp = g.parameters || {};
    if (g.type === 'CylinderGeometry' && gp.height >= 0.2 && gp.radiusTop >= 0.012) {
      const p = new TH.Vector3(), q = new TH.Quaternion(), s = new TH.Vector3(); o.matrixWorld.decompose(p, q, s);
      const h = gp.height * s.y, d = new TH.Vector3(0, 1, 0).applyQuaternion(q).normalize();
      let a = p.clone().addScaledVector(d, -h / 2), b = p.clone().addScaledVector(d, h / 2); if (a.y > b.y) [a, b] = [b, a];
      tubes.push({ role: o.userData.role || '', r: gp.radiusTop, a, b, len: h, vert: Math.abs(d.y) > 0.999, horiz: Math.abs(d.y) < 0.001, dir: d, uuid: o.uuid, anc: o.parent && o.parent.userData && o.parent.userData.role });
    } else if (g.type === 'BoxGeometry') {
      const bb = new TH.Box3().setFromObject(o); const sz = new TH.Vector3(); bb.getSize(sz);
      if (Math.max(sz.x, sz.y, sz.z) > 0.1) boxes.push({ role: o.userData.role || '', min: bb.min.clone(), max: bb.max.clone(), sz });
    }
  });
  const segDist = (p, a, b) => { const ab = b.clone().sub(a), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq())); return a.clone().addScaledVector(ab, t).distanceTo(p); };
  const boxDist = (p, bx) => { const dx = Math.max(bx.min.x - p.x, 0, p.x - bx.max.x), dy = Math.max(bx.min.y - p.y, 0, p.y - bx.max.y), dz = Math.max(bx.min.z - p.z, 0, p.z - bx.max.z); return Math.hypot(dx, dy, dz); };
  // segment-segment closest distance (sampled; adequate for straight members)
  const segSeg = (A, B, n = 160) => { let best = 9, at = null; for (let i = 0; i <= n; i++) { const p = A.a.clone().lerp(A.b, i / n); const dd = segDist(p, B.a, B.b); if (dd < best) { best = dd; at = p; } } return { d: best, at };
  };
  const structural = tubes.filter(t => t.r >= 0.015);
  // --- decks (boards 3.9 × 0.038 × ~0.223) ---
  const boards = boxes.filter(b => Math.abs(b.sz.y - 0.038) < 0.003 && b.sz.x > 3.5);
  const tops = [...new Set(boards.map(b => Math.round(b.max.y * 1000) / 1000))].sort((a, b) => a - b);
  const sides = [{ n: 'depan', ax: 'x', c: -0.6 }, { n: 'belakang', ax: 'x', c: 0.6 }, { n: 'kiri', ax: 'z', c: -2.0 }, { n: 'kanan', ax: 'z', c: 2.0 }];
  const onLine = (t, sd) => sd.ax === 'x' ? (Math.abs(t.a.z - sd.c) < 0.07 && Math.abs(t.b.z - sd.c) < 0.07 && Math.abs(t.b.x - t.a.x) > 0.2) : (Math.abs(t.a.x - sd.c) < 0.07 && Math.abs(t.b.x - sd.c) < 0.07 && Math.abs(t.b.z - t.a.z) > 0.2);
  const iv = (t, sd) => sd.ax === 'x' ? [Math.min(t.a.x, t.b.x), Math.max(t.a.x, t.b.x)] : [Math.min(t.a.z, t.b.z), Math.max(t.a.z, t.b.z)];
  const holes = (list, lo, hi) => { const s = list.slice().sort((a, b) => a[0] - b[0]); const out = []; let reach = lo; for (const [a, b] of s) { if (a > reach + 0.06) out.push([+reach.toFixed(3), +a.toFixed(3)]); reach = Math.max(reach, b); } if (reach < hi - 0.06) out.push([+reach.toFixed(3), +hi.toFixed(3)]); return out; };
  const decks = tops.map(T0 => {
    const bs = boards.filter(b => Math.abs(b.max.y - T0) < 0.002).sort((a, b) => a.min.z - b.min.z);
    const zmin = bs[0].min.z, zmax = bs[bs.length - 1].max.z, xmin = Math.min(...bs.map(b => b.min.x)), xmax = Math.max(...bs.map(b => b.max.x));
    let gap = 0; for (let i = 1; i < bs.length; i++) gap = Math.max(gap, bs[i].min.z - bs[i - 1].max.z);
    const hz = structural.filter(t => t.horiz && t.a.y > T0 + 0.3 && t.a.y < T0 + 1.2);
    const per = sides.map(sd => {
      const on = hz.filter(t => onLine(t, sd));
      const top = on.filter(t => t.a.y > T0 + 0.75), mid = on.filter(t => t.a.y <= T0 + 0.75);
      const toes = boxes.filter(b => Math.abs(b.sz.y - 0.15) < 0.003 && Math.abs(b.min.y - T0) < 0.01 && (sd.ax === 'x' ? (b.sz.x > 0.2 && Math.abs((b.min.z + b.max.z) / 2 - sd.c) < 0.1) : (b.sz.z > 0.2 && Math.abs((b.min.x + b.max.x) / 2 - sd.c) < 0.1)));
      const lo = sd.ax === 'x' ? -2.0 : -0.6, hi = -lo, tlo = sd.ax === 'x' ? xmin : zmin, thi = sd.ax === 'x' ? xmax : zmax;
      // gate leaf: horizontal bars thinner than a tube (r < 0.02) parallel to the side, 0.07–0.12 m INSIDE the standard line
      const off = t => sd.ax === 'x' ? Math.abs(t.a.z - sd.c) : Math.abs(t.a.x - sd.c);
      const inside = t => sd.ax === 'x' ? Math.abs(t.a.z) < Math.abs(sd.c) : Math.abs(t.a.x) < Math.abs(sd.c);
      const along = t => sd.ax === 'x' ? Math.abs(t.b.x - t.a.x) > 0.2 && Math.abs(t.a.z - t.b.z) < 0.001 : Math.abs(t.b.z - t.a.z) > 0.2 && Math.abs(t.a.x - t.b.x) < 0.001;
      const gb = tubes.filter(t => t.horiz && t.r < 0.02 && t.a.y > T0 + 0.3 && t.a.y < T0 + 1.2 && along(t) && inside(t) && off(t) >= 0.07 && off(t) < 0.12);
      const gateTop = gb.filter(t => t.a.y > T0 + 0.75).map(t => ({ iv: iv(t, sd).map(v => +v.toFixed(3)), h: +(t.a.y + t.r - T0).toFixed(4), off: +off(t).toFixed(3) }));
      const gateMid = gb.filter(t => t.a.y <= T0 + 0.75).map(t => ({ iv: iv(t, sd).map(v => +v.toFixed(3)), c: +(t.a.y - T0).toFixed(4) }));
      return { side: sd.n, topH: top.map(t => +(t.a.y + t.r - T0).toFixed(4)), midC: mid.map(t => +(t.a.y - T0).toFixed(4)), gateTop, gateMid,
        topHoles: holes(top.map(t => iv(t, sd)), lo, hi), midHoles: holes(mid.map(t => iv(t, sd)), lo, hi),
        toeHoles: holes(toes.map(b => sd.ax === 'x' ? [b.min.x, b.max.x] : [b.min.z, b.max.z]), tlo, thi),
        gapToeMid: mid.length && toes.length ? +(Math.min(...mid.map(t => t.a.y - t.r)) - Math.max(...toes.map(b => b.max.y))).toFixed(4) : null,
        gapMidTop: mid.length && top.length ? +(Math.min(...top.map(t => t.a.y - t.r)) - Math.max(...mid.map(t => t.a.y + t.r))).toFixed(4) : null,
        toeH: toes.length ? +(Math.min(...toes.map(b => b.max.y)) - T0).toFixed(4) : 0 };
    });
    // headroom over the WALKWAY: lowest underside of any structural member above this deck footprint, except edge
    // protection running along a deck edge within 0.15 m of it (rails, gate leaf) — that is the guard, not an overhead member
    const alongEdge = t => (Math.abs(t.a.z - t.b.z) < 0.001 && Math.min(Math.abs(t.a.z - zmin), Math.abs(t.a.z - zmax)) < 0.15) ||
      (Math.abs(t.a.x - t.b.x) < 0.001 && Math.min(Math.abs(t.a.x - xmin), Math.abs(t.a.x - xmax)) < 0.15);
    const over = structural.filter(t => t.horiz && t.a.y > T0 + 0.5 && !alongEdge(t) && (Math.max(t.a.x, t.b.x) > xmin && Math.min(t.a.x, t.b.x) < xmax) && (Math.max(t.a.z, t.b.z) > zmin && Math.min(t.a.z, t.b.z) < zmax));
    // clear height above a gate opening: lowest member over the opening (along that edge, above the gate) — H1 ≥ 1.75 m
    const gateClear = per.flatMap(p => p.gateTop.map(g => ({ p, g }))).map(({ p, g }) => {
      const sd = sides.find(x => x.n === p.side);
      const hit = structural.filter(t => t.horiz && t.a.y > T0 + 1.2 && t.r >= 0.02 && (sd.ax === 'x' ? Math.abs(t.a.z - sd.c) < 0.1 && Math.min(t.a.x, t.b.x) < g.iv[1] && Math.max(t.a.x, t.b.x) > g.iv[0] : Math.abs(t.a.x - sd.c) < 0.1 && Math.min(t.a.z, t.b.z) < g.iv[1] && Math.max(t.a.z, t.b.z) > g.iv[0]));
      return hit.length ? +(Math.min(...hit.map(t => t.a.y - t.r)) - T0).toFixed(4) : null;
    });
    const head = over.length ? Math.min(...over.map(t => t.a.y - t.r)) - T0 : null;
    // gaps to uprights / end rails
    const std = structural.filter(t => t.vert && t.r === 0.024);
    const zEdge = Math.min(...std.filter(t => t.a.z > 0).map(t => t.a.z - t.r)) - zmax;
    const xEnd = Math.min(...structural.filter(t => t.vert && Math.abs(t.a.x) > 1.9).map(t => Math.abs(t.a.x) - t.r)) - xmax;
    return { T: T0, nBoards: bs.length, gap: +gap.toFixed(4), zEdgeGap: +zEdge.toFixed(4), xEndGap: +xEnd.toFixed(4), head: head && +head.toFixed(4), gateClear, per };
  });
  // --- bearers under boards (span / overhang) ---
  let maxSpan = 0, ovMin = 9, ovMax = 0;
  boards.forEach(b => { const xs = structural.filter(t => t.horiz && Math.abs(t.a.x - t.b.x) < 0.01 && Math.abs(t.a.y + t.r - b.min.y) < 0.004 && t.a.x >= b.min.x && t.a.x <= b.max.x && Math.min(t.a.z, t.b.z) <= b.min.z && Math.max(t.a.z, t.b.z) >= b.max.z).map(t => t.a.x).sort((p, q) => p - q);
    for (let i = 1; i < xs.length; i++) maxSpan = Math.max(maxSpan, xs[i] - xs[i - 1]); if (xs.length) { ovMin = Math.min(ovMin, xs[0] - b.min.x, b.max.x - xs[xs.length - 1]); ovMax = Math.max(ovMax, xs[0] - b.min.x, b.max.x - xs[xs.length - 1]); } });
  // --- braces (inclined r 0.024 tubes) ---
  const braces = structural.filter(t => !t.vert && !t.horiz && t.r === 0.024 && t.role !== 'outrigger').map(t => {
    const ang = Math.atan2(t.b.y - t.a.y, Math.hypot(t.b.x - t.a.x, t.b.z - t.a.z)) * 180 / Math.PI;
    const plane = Math.abs(t.a.z - t.b.z) < 0.01 ? 'facade' : (Math.abs(t.a.x - t.b.x) < 0.01 ? 'end' : 'other');
    return { plane, ang: +ang.toFixed(2), a: [t.a.x, t.a.y, t.a.z].map(v => +v.toFixed(3)), b: [t.b.x, t.b.y, t.b.z].map(v => +v.toFixed(3)) };
  });
  // --- stability: H to highest structural point, B from base-plate centres ---
  const plates = boxes.filter(b => Math.abs(b.sz.x - 0.16) < 0.002 && Math.abs(b.sz.y - 0.035) < 0.002);
  const cx = plates.map(b => (b.min.x + b.max.x) / 2), cz = plates.map(b => (b.min.z + b.max.z) / 2);
  const B = plates.length ? Math.min(Math.max(...cx) - Math.min(...cx), Math.max(...cz) - Math.min(...cz)) : 0;
  const Hstd = Math.max(0, ...structural.filter(t => t.vert && t.r === 0.024).map(t => t.b.y));
  const Hall = Math.max(0, ...structural.map(t => t.b.y));
  // --- couplers: how many distinct members does each coupler actually grip? ---
  const memberNear = (p) => { const tl = structural.filter(t => segDist(p, t.a, t.b) <= t.r + 0.052).map(t => ({ k: 't', role: t.role, d: +segDist(p, t.a, t.b).toFixed(3) }));
    const bl = boxes.filter(bx => bx.sz.y > 0.02 && boxDist(p, bx) <= 0.04).map(bx => ({ k: 'b', role: bx.role, d: +boxDist(p, bx).toFixed(3) }));
    return tl.concat(bl); };
  const loose = couplers.map(c => ({ c, m: memberNear(c.p) })).filter(x => x.m.length < 2).map(x => ({ type: x.c.type, role: x.c.role, at: [x.c.p.x, x.c.p.y, x.c.p.z].map(v => +v.toFixed(3)), members: x.m }));
  // --- ladder: stiles = inclined r 0.020 tubes longer than 4 m ---
  const stiles = tubes.filter(t => Math.abs(t.r - 0.02) < 1e-6 && t.len > 4 && !t.vert);
  let ladder = null;
  if (stiles.length) {
    const others = structural.filter(t => !/^ladder/.test(t.role) && Math.abs(t.r - 0.02) > 1e-6);
    const contacts = [];
    stiles.forEach(s => others.forEach(o => { const q = segSeg(s, o); if (q.d <= s.r + o.r + 0.01) contacts.push({ role: o.role, y: +q.at.y.toFixed(3), clear: +(q.d - s.r - o.r).toFixed(3) }); }));
    const boxContacts = []; stiles.forEach(s => boxes.forEach(bx => { for (let i = 0; i <= 160; i++) { const p = s.a.clone().lerp(s.b, i / 160); if (boxDist(p, bx) <= s.r + 0.005) { boxContacts.push({ role: bx.role, y: +p.y.toFixed(3) }); break; } } }));
    const s0 = stiles[0];
    // nearest non-ladder member to the upper part of the stile (y > deck2+0.5): clearance
    const upper = { a: s0.a.clone().lerp(s0.b, (decks.length ? decks[decks.length - 1].T + 0.5 - s0.a.y : 4.5) / (s0.b.y - s0.a.y)), b: s0.b.clone() };
    const nearUpper = others.map(o => { const q = segSeg(upper, o); return { role: o.role, clear: +(q.d - s0.r - o.r).toFixed(3), y: +q.at.y.toFixed(3) }; }).sort((p, q) => p.clear - q.clear).slice(0, 3);
    const Tt = decks.length ? decks[decks.length - 1].T : 0;
    const zAtDeck = s0.a.z + (s0.b.z - s0.a.z) * (Tt - s0.a.y) / (s0.b.y - s0.a.y);
    const deckEdge = Math.max(...boards.filter(b => Math.abs(b.max.y - Tt) < 0.002).map(b => b.max.z));
    ladder = { foot: [s0.a.x, s0.a.y, s0.a.z].map(v => +v.toFixed(3)), top: [s0.b.x, s0.b.y, s0.b.z].map(v => +v.toFixed(3)), len: +s0.len.toFixed(3),
      extAboveDeck: +(s0.b.y - Tt).toFixed(3), stepAcross: +(zAtDeck - deckEdge).toFixed(3),
      contacts: contacts.sort((p, q) => q.y - p.y), boxContacts, nearUpper };
  }
  const tags = []; scaffold.traverse(o => { if (o.userData && o.userData.role === 'tag' && vis(o)) tags.push(o.userData.color); });
  return { current: window.PPAPISim.current, decks, maxSpan: +maxSpan.toFixed(4), ovMin: +ovMin.toFixed(4), ovMax: +ovMax.toFixed(4), braces,
    stab: { Hstd: +Hstd.toFixed(3), Hall: +Hall.toFixed(3), B: +B.toFixed(3), ratio: B ? +(Hstd / B).toFixed(3) : null, nPlates: plates.length },
    loose, ladder, tags, nCouplers: couplers.length };
};

async function openSim(vp = 'desktop', extra = {}) {
  const ctx = await newContext(browser, vp, extra);
  await seedSession(ctx, {});
  const page = await ctx.newPage();
  const issues = watch(page);
  await page.goto(SIM, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'), null, { timeout: 30000 });
  await page.click('#startBtn');
  await page.waitForFunction(() => window.PPAPISim && document.querySelector('#app-main canvas'), null, { timeout: 30000 });
  return { ctx, page, issues };
}
const measure = (page) => page.evaluate((f) => (new Function('return ' + f))()(), MEASURE.toString());
const near = (a, b, tol) => Math.abs(a - b) <= tol;

/* ======================================================================
   A + B + C : walk the 20 steps, measure raw geometry at every state
   ====================================================================== */
const { ctx, page, issues } = await openSim('desktop');
await page.click('#tab-build');
const ids = await page.evaluate(() => PPAPISim.steps.map(s => s.id));
const states = [];
for (let i = 0; i < 20; i++) {
  const stepText = await page.evaluate(() => ({ h: (document.querySelector('.stepcard h3') || {}).textContent || '', desc: (document.querySelector('.stepcard .desc') || {}).textContent || '', ref: (document.querySelector('.stepcard .ref') || {}).textContent || '' }));
  await page.click('#placeBtn'); await page.waitForTimeout(30);
  const m = await measure(page);
  m.id = ids[i]; m.text = stepText;
  states.push(m);
}
OUT.states = states.map(s => ({ id: s.id, decks: s.decks.map(d => d.T), stab: s.stab, ladder: !!s.ladder, loose: s.loose.length, tags: s.tags }));
const at = (id) => states[ids.indexOf(id)];
const fin = at('tag-hijau');

T.section('A. Hand-derived values vs. raw scene geometry (final state)');
T.ok(fin.decks.length === 2 && near(fin.decks[0].T, REF.deck1, 0.001) && near(fin.decks[1].T, REF.deck2, 0.001), `deck levels ${fin.decks.map(d => d.T).join(' / ')} m = hand ${REF.deck1.toFixed(3)} / ${REF.deck2.toFixed(3)}`);
fin.decks.forEach(d => {
  const topAll = d.per.flatMap(p => p.topH), toeAll = d.per.map(p => p.toeH);
  const LONG = ['depan', 'belakang'];
  T.ok(topAll.length && d.per.every(p => p.topH.length && p.topH.every(h => near(h, LONG.includes(p.side) ? REF.topLong : REF.topEnd, 0.0006))), `deck ${d.T}: top-rail top surface ${d.per.map(p => p.side + ' ' + [...new Set(p.topH)].join('/')).join(', ')} m (hand: long sides ${REF.topLong.toFixed(3)}, end sides ${REF.topEnd.toFixed(3)} — KOREKSI §2.2; ≥ 0.950 Permenaker 9/2016 Ps.24a, 0.97–1.14 OSHA 451(g)(4)(ii))`);
  T.ok(d.per.every(p => p.gapToeMid !== null && p.gapToeMid <= 0.47 && p.gapMidTop <= 0.47 && (p.side === 'belakang' || (LONG.includes(p.side) ? near(p.gapToeMid, REF.gapToeMid, 0.001) && near(p.gapMidTop, REF.gapMidTop, 0.001) : near(p.gapToeMid, REF.gapToeMidEnd, 0.001) && near(p.gapMidTop, REF.gapMidTopEnd, 0.001)))), `deck ${d.T}: clear gaps toe→mid / mid→top = ${d.per.map(p => p.gapToeMid + '/' + p.gapMidTop).join(' ; ')} (hand long ${REF.gapToeMid.toFixed(3)}/${REF.gapMidTop.toFixed(3)}, end ${REF.gapToeMidEnd.toFixed(3)}/${REF.gapMidTopEnd.toFixed(3)}; belakang carries the gate kick plate 2 mm above the deck; ≤ 0.470 Permenaker 9/2016 Ps.24c)`);
  T.ok(toeAll.every(h => h >= 0.15 - 1e-4), `deck ${d.T}: toe boards ${toeAll.join(', ')} m (≥ 0.150)`);
  // every gap in the fixed rails must be closed by a gate leaf that laps BOTH rail ends (inward-opening only, SG25:20 6.4)
  const closed = (holesL, bars) => holesL.every(([a, b]) => bars.some(g => g.iv[0] <= a - (REF.gateLap - 0.002) && g.iv[1] >= b + (REF.gateLap - 0.002)));
  T.ok(d.per.every(p => !p.toeHoles.length && closed(p.topHoles, p.gateTop) && closed(p.midHoles, p.gateMid) && p.gateTop.every(g => near(g.h, REF.topLong, 0.0006)) && p.gateMid.every(g => near(g.c, 0.53, 0.0006))), `deck ${d.T}: no open holes in top/mid/toe — rail gaps ${d.per.filter(p => p.topHoles.length).map(p => p.side + ' ' + JSON.stringify(p.topHoles)).join(', ') || 'none'} closed by a gate leaf on the inner side lapping both rail ends by ≥ ${(REF.gateLap * 1000).toFixed(0)} mm (top bar ${REF.topLong.toFixed(3)} m, mid bar 0.53 m)`, d.per.map(p => ({ s: p.side, t: p.topHoles, m: p.midHoles, k: p.toeHoles, gateTop: p.gateTop, gateMid: p.gateMid })));
  T.ok(d.gap <= 0.025 && d.zEdgeGap <= 0.025, `deck ${d.T}: board gaps ${(d.gap * 1000).toFixed(0)} mm, deck→standard ${(d.zEdgeGap * 1000).toFixed(1)} mm (≤ 25 mm OSHA 451(b)(1)(i))`);
  OUT['xEndGap_' + d.T] = d.xEndGap;
});
T.ok(near(fin.maxSpan, REF.maxSpan, 0.001) && near(fin.ovMin, REF.overhang, 0.001) && near(fin.ovMax, REF.overhang, 0.001), `board span max ${fin.maxSpan} m (hand ${REF.maxSpan.toFixed(2)}), overhang ${fin.ovMin}–${fin.ovMax} m (hand ${REF.overhang.toFixed(3)})`);
const fac = fin.braces.filter(b => b.plane === 'facade'), ends = fin.braces.filter(b => b.plane === 'end');
T.ok(fac.length === REF.facadeBraces && fac.every(b => near(b.ang, REF.brace1, 0.05) || near(b.ang, REF.brace2, 0.05)), `facade braces: ${fac.length} (hand ${REF.facadeBraces}: lift-1 access bay left free on lift 2, KOREKSI §2.6), angles ${[...new Set(fac.map(b => b.ang))].join(' / ')}° (hand ${REF.brace1.toFixed(2)} / ${REF.brace2.toFixed(2)})`);
OUT.endBraceAngles = [...new Set(ends.map(b => b.ang))];
T.ok(ends.length === 8, `end X braces: ${ends.length}, angles ${OUT.endBraceAngles.join(' / ')}° (hand ${REF.endX1.toFixed(1)} / ${REF.endX2.toFixed(1)}; OSHA (b)(2) states no angle)`);
T.ok(near(fin.stab.ratio, REF.HB_final, 0.01), `H/B final ${fin.stab.Hstd}/${fin.stab.B} = ${fin.stab.ratio} (hand ${REF.HB_final.toFixed(3)})`);
const maxPre = Math.max(...states.slice(0, ids.indexOf('outrigger')).map(s => s.stab.ratio || 0));
T.ok(maxPre <= 4 && near(maxPre, REF.HB_pre, 0.01), `H/B before outriggers max ${maxPre} (hand 4.15/1.2 = ${REF.HB_pre.toFixed(3)} ≤ 4)`);
T.ok(states.every(s => s.stab.ratio === null || s.stab.ratio <= 4), 'H/B ≤ 4 at every state', states.map(s => s.stab.ratio));

T.section('B. Physical connection: does every coupler grip two members? Is the ladder supported at the top?');
const L = fin.ladder;
OUT.ladder = L;
console.log('   ladder', JSON.stringify(L));
const looseFinal = fin.loose;
OUT.looseFinal = looseFinal;
console.log('   couplers gripping < 2 members (final):', JSON.stringify(looseFinal));
T.ok(looseFinal.length === 0, `every visible coupler grips ≥ 2 members (final state, ${fin.nCouplers} couplers)`, looseFinal.map(l => `${l.role}/${l.type}@${l.at.join(',')} → ${JSON.stringify(l.members)}`));
const topSupport = L ? L.contacts.filter(c => c.y > (fin.decks[1].T + 0.4)) : [];
T.ok(L && topSupport.length > 0, `ladder bears on a structural member near its top (≥ deck+0.4 m)`, L && { highestContacts: L.contacts.slice(0, 4), nearestUpperClearance: L.nearUpper });
if (L) {
  const highest = L.contacts.length ? L.contacts[0].y : 0;
  OUT.ladderCantilever = +(L.top[1] - highest).toFixed(3);
  console.log(`   ladder highest structural contact y=${highest} → free length above it ${OUT.ladderCantilever} m; ext above deck ${L.extAboveDeck} m; step-across at landing ${L.stepAcross} m`);
}
// state 17 (pagar-atas … lantai-atas): the closure rail existed → ladder would have rested on it; after step 18 the closure is removed in the same step that installs the ladder
const st18 = at('tangga');
T.ok(st18.ladder && st18.ladder.contacts.some(c => c.y > st18.decks[1].T + 0.4), 'ladder top support exists right after step 18 (closure rail removed in the same step)', st18.ladder && st18.ladder.nearUpper);

T.section('C. Access & sequence: can people reach each deck when they are told to work from it?');
const lift1Open = (s) => s.decks.length && s.decks[0].per.some(p => p.topHoles.length);
const workFrom = ['ledger-l2', 'transom-l2', 'bracing-l2', 'pagar-atas', 'lantai-atas'];
const noAccess = workFrom.filter(id => { const s = at(id); return !s.ladder && !lift1Open(s); });
OUT.noAccessSteps = noAccess;
T.ok(noAccess.length === 0, `steps whose text says work is done "dari lantai lift-1": a means of access to lift-1 exists (ladder or opening)`, { stepsWithoutAnyAccess: noAccess, lift1Holes: fin.decks[0].per.map(p => p.topHoles) });
T.ok(!fin.decks[0].per.every(p => !p.topHoles.length) || (L && L.contacts.some(c => near(c.y, fin.decks[0].T, 0.3))), 'final: retained lift-1 deck (2.06 m) has an access route', { lift1Holes: fin.decks[0].per.map(p => p.topHoles), ladderContacts: L && L.contacts.map(c => c.y) });
OUT.headroom1 = fin.decks[0].head;
T.ok(near(fin.decks[0].head, REF.headroom1, 0.002), `headroom over the lift-1 walkway → lowest member above = ${fin.decks[0].head} m (hand ${REF.headroom1.toFixed(3)} = lift-2 transom underside; EN 12811-1 H1 ≥ 1.75, H2 ≥ 1.90 per secondary sources)`);
T.ok(fin.decks[0].gateClear.length >= 1 && fin.decks[0].gateClear.every(h => h !== null && near(h, REF.gateClear, 0.002) && h >= 1.75), `lift-1 gate opening: clear height to the lift-2 ledger underside ${fin.decks[0].gateClear.join(', ')} m (hand ${REF.gateClear.toFixed(3)}; ≥ 1.75 H1, KOREKSI §2.9)`, fin.decks[0].gateClear);
T.ok(L && L.stepAcross <= 0.30, `ladder step-across at landing ≤ 0.30 m (cf. OSHA 1926.1053(a)(16) fixed-ladder step-across 7–12 in)`, L && L.stepAcross);

T.section('D. Inspection engine: mutations that must FAIL');
// go back to the inspection step (current = 18) so evaluate() sees the complete pre-handover scaffold
await page.click('#undoBtn'); await page.click('#undoBtn');
const mut = await page.evaluate(() => {
  const S = PPAPISim.scene; const res = {};
  const grab = (pred) => { const a = []; S.traverse(o => { if (pred(o)) a.push(o); }); return a; };
  const run = (name, pred, fn) => { const objs = grab(pred); const saved = objs.map(o => ({ o, v: o.visible, p: o.position.clone(), r: o.rotation.clone() })); objs.forEach(fn); const e = PPAPISim.inspect(); saved.forEach(s => { s.o.visible = s.v; s.o.position.copy(s.p); s.o.rotation.copy(s.r); }); res[name] = { n: objs.length, ready: e.ready, fails: e.fails.map(f => f.id), stab: e.m.stab && +e.m.stab.ratio.toFixed(2), lad: e.items.find(i => i.id === 'ladder-tie').value }; };
  run('outrigger tubes removed (feet left)', o => o.userData.role === 'outrigger' || o.userData.role === 'outrigger-tie', o => { o.visible = false; });
  run('top-rail ladder ties removed', o => o.userData.role === 'ladder-tie' && !o.isMesh, o => { o.visible = false; });
  run('ladder ledger ties removed', o => o.userData.role === 'ladder-tie' && o.isMesh, o => { o.visible = false; });
  run('one standard tilted 3°', (() => { let k = 0; return o => o.userData.role === 'standard' && k++ === 0; })(), o => { o.rotation.z += 0.0524; });
  run('lift-1 putlogs removed', o => o.userData.role === 'putlog' && o.position.y < 3, o => { o.visible = false; });
  run('top rail of lift-1 lowered 80 mm', o => o.userData.role === 'rail-top' && o.position.y < 3.2, o => { o.position.y -= 0.08; });
  run('board clips removed', o => o.userData.role === 'boardclip', o => { o.visible = false; });
  run('one facade brace removed', (() => { let k = 0; return o => o.userData.role === 'brace' && k++ === 0; })(), o => { o.visible = false; });
  run('gate removed', o => o.userData.role === 'gate', o => { o.visible = false; });
  run('all sleeves removed (standards stay joined?)', o => o.userData.role === 'sleeve', o => { o.visible = false; });
  run('upper standard extensions removed', o => o.userData.role === 'standard' && o.position.y > 3, o => { o.visible = false; });
  return res;
});
OUT.mutations = mut;
Object.entries(mut).forEach(([k, v]) => console.log(`   ${k}: n=${v.n} ready=${v.ready} fails=[${v.fails.join(',')}] stab=${v.stab} ladderTie="${v.lad}"`));
T.ok(!mut['outrigger tubes removed (feet left)'].ready, 'removing all outrigger members (base plates left) makes inspection fail', mut['outrigger tubes removed (feet left)']);
// rev. 2 (§2.9): both stiles are clamped to the retained top rail; the 0.8 m ledger ties were dropped
T.ok(!mut['top-rail ladder ties removed'].ready && mut['top-rail ladder ties removed'].fails.includes('ladder-tie') && mut['top-rail ladder ties removed'].n >= 4, 'removing the ladder clamps on the top rail (the ONLY ties now) makes the ladder-tie check fail', mut['top-rail ladder ties removed']);
T.ok(mut['ladder ledger ties removed'].n === 0, 'no ledger ladder ties left in the scene (dropped in revision 2: they projected into the climbing space)', mut['ladder ledger ties removed']);
['one standard tilted 3°', 'lift-1 putlogs removed', 'top rail of lift-1 lowered 80 mm', 'board clips removed', 'one facade brace removed', 'gate removed', 'upper standard extensions removed'].forEach(k => T.ok(!mut[k].ready, `mutation "${k}" → inspection fails (${mut[k].fails.join(',')})`, mut[k]));

T.section('E. UI texts vs. geometry');
const st = at('tangga').text;
OUT.tanggaText = st.desc;
T.ok(!(/diikat[^.]*top rail/i.test(st.desc) && !(L && topSupport.length)), 'step 18 text "diikat pada top rail" matches geometry (a top rail exists where the ladder is tied)', st.desc.slice(0, 220));
await page.click('#tab-insp'); await page.waitForTimeout(150);
const insp = await page.evaluate(() => [...document.querySelectorAll('.insp-list li')].map(li => li.textContent.replace(/\s+/g, ' ').trim()));
OUT.inspPanel = insp;
const tieRow = insp.find(t => /Tangga diikat/.test(t)) || '';
T.ok(!/4 titik ikat/.test(tieRow), 'inspection panel does not report the two floating top couplers as "titik ikat"', tieRow);
await shot(page, 'verify-sim-final-insp');
// close-up of the ladder top / gate area
await page.evaluate(() => { const c = PPAPISim.camera; });
T.ok(issues.length === 0, 'no console errors / page errors', issues.slice(0, 5));
await ctx.close();

/* ======================================================================
   F. Performance & layout claims (quick re-measure)
   ====================================================================== */
T.section('F. performance & layout claims');
{
  const { ctx, page } = await openSim('desktop');
  await page.click('#tab-build');
  for (let i = 0; i < 20; i++) await page.click('#placeBtn');
  await page.waitForTimeout(400);
  const idle = await page.evaluate(async () => { const f0 = PPAPISim.frames; await new Promise(r => setTimeout(r, 1500)); return PPAPISim.frames - f0; });
  const mats = await page.evaluate(() => { const s = new Set(); PPAPISim.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => s.add(m.uuid)); }); return s.size; });
  T.ok(idle === 0, `0 frames rendered while idle (1.5 s): ${idle}`);
  OUT.materials = mats;
  T.ok(mats <= 84, `unique materials in finished scene: ${mats} (KOREKSI §5 states 84 for the complete tower)`);
  await ctx.close();
}
for (const [name, extra] of [['tablet 768×1024', { viewport: { width: 768, height: 1024 } }], ['landscape 844×390', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }], ['phone 360×640', { viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const { ctx, page } = await openSim('desktop', extra);
  await page.click('#tab-build');
  const bad = [];
  for (let i = 0; i < 20; i++) {
    const v = await page.evaluate(() => { const b = document.getElementById('placeBtn'); if (!b) return { ok: true }; const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { ok: r.bottom <= innerHeight + 1 && r.top >= 0 && (e === b || b.contains(e)), r: [Math.round(r.top), Math.round(r.bottom)], ih: innerHeight }; });
    if (!v.ok) bad.push({ step: i + 1, ...v });
    await page.click('#placeBtn', { force: true }); await page.waitForTimeout(20);
    if (i === 0) {
      const tov = await page.evaluate(() => { const t = document.getElementById('toast'); const p = document.getElementById('panel'); const a = t.getBoundingClientRect(), b = p.getBoundingClientRect(); const ov = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)); return { ov: Math.round(ov), shown: t.classList.contains('show') }; });
      if (tov.shown && tov.ov > 0) bad.push({ toastOverPanel: tov.ov });
    }
  }
  const hs = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  T.ok(!bad.length && hs <= 0, `${name}: step button visible & clickable at all 20 steps, toast not over panel, no horizontal overflow (${hs})`, bad.slice(0, 4));
  await shot(page, 'verify-sim-' + name.split(' ')[0]);
  await ctx.close();
}

await browser.close(); server.close();
import('node:fs').then(fs => fs.writeFileSync(new URL('../shots/verify-sim-result.json', import.meta.url), JSON.stringify(OUT, null, 1)));
const failed = T.done();
process.exitCode = failed ? 1 : 0;
