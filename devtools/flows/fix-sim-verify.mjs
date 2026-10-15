// fix-sim-verify — verification of the simulator access / inspection fixes (KOREKSI-SIMULATOR.md §2.9, §4, §8)
// Independent of the app's evaluate(): classifies scene meshes by raw geometry, then checks
//   A  every state 1..20: decks, edge protection per side (heights, gaps, holes), ladders (top support, ties on that
//      support, 4:1, extension, step-across through the gate opening), access to every deck that is to be worked from
//   B  physical joints: every coupler grips >= 2 members inside their tube lengths; no interpenetrating tubes
//      (corner rails, ladder, gate, outriggers, kicker) except by-design node abstractions (ledger/standard axes)
//   C  inspection engine: baseline passes at 18/20; targeted mutations must fail the right item
//   D  UI texts and panel (method chips, tie wording), material count
//   E  screenshots of the changed areas
// usage (cwd devtools): node flows/fix-sim-verify.mjs
import { startServer, launch, newContext, seedSession, watch, recorder, shot } from './aplikasi-lib.mjs';

const T = recorder('fix-sim-verify');
const { server, BASE } = await startServer();
const browser = await launch();
const SIM = `${BASE}/aplikasi/simulator/index.html`;

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
      tubes.push({ role: o.userData.role || '', r: gp.radiusTop, a, b, len: h, vert: Math.abs(d.y) > 0.999, horiz: Math.abs(d.y) < 0.001, uuid: o.uuid });
    } else if (g.type === 'BoxGeometry') {
      const bb = new TH.Box3().setFromObject(o); const sz = new TH.Vector3(); bb.getSize(sz);
      if (Math.max(sz.x, sz.y, sz.z) > 0.1) boxes.push({ role: o.userData.role || '', min: bb.min.clone(), max: bb.max.clone(), sz });
    }
  });
  const segPt = (p, a, b) => { const ab = b.clone().sub(a), L2 = ab.lengthSq(), t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / L2)); return { d: a.clone().addScaledVector(ab, t).distanceTo(p), s: t * Math.sqrt(L2) }; };
  const boxDist = (p, bx) => Math.hypot(Math.max(bx.min.x - p.x, 0, p.x - bx.max.x), Math.max(bx.min.y - p.y, 0, p.y - bx.max.y), Math.max(bx.min.z - p.z, 0, p.z - bx.max.z));
  const segSeg = (A, B, n = 240) => { let best = { d: 9 }; for (let i = 0; i <= n; i++) { const p = A.a.clone().lerp(A.b, i / n); const q = segPt(p, B.a, B.b); if (q.d < best.d) best = { d: q.d, p, sa: A.len * i / n, sb: q.s }; } return best; };
  const structural = tubes.filter(t => t.r >= 0.015);
  /* decks */
  const boards = boxes.filter(b => Math.abs(b.sz.y - 0.038) < 0.003 && b.sz.x > 3.5);
  const tops = [...new Set(boards.map(b => Math.round(b.max.y * 1000) / 1000))].sort((a, b) => a - b);
  const sides = [{ n: 'depan', ax: 'x', c: -0.6 }, { n: 'belakang', ax: 'x', c: 0.6 }, { n: 'kiri', ax: 'z', c: -2.0 }, { n: 'kanan', ax: 'z', c: 2.0 }];
  const onLine = (t, sd) => sd.ax === 'x' ? (Math.abs(t.a.z - sd.c) < 0.12 && Math.abs(t.b.z - sd.c) < 0.12 && Math.abs(t.b.x - t.a.x) > 0.2) : (Math.abs(t.a.x - sd.c) < 0.12 && Math.abs(t.b.x - sd.c) < 0.12 && Math.abs(t.b.z - t.a.z) > 0.2);
  const iv = (t, sd) => sd.ax === 'x' ? [Math.min(t.a.x, t.b.x), Math.max(t.a.x, t.b.x)] : [Math.min(t.a.z, t.b.z), Math.max(t.a.z, t.b.z)];
  const holes = (list, lo, hi) => { const s = list.slice().sort((a, b) => a[0] - b[0]); const out = []; let reach = lo; for (const [a, b] of s) { if (a > reach + 0.06) out.push([+reach.toFixed(3), +a.toFixed(3)]); reach = Math.max(reach, b); } if (reach < hi - 0.06) out.push([+reach.toFixed(3), +hi.toFixed(3)]); return out; };
  const decks = tops.map(T0 => {
    const bs = boards.filter(b => Math.abs(b.max.y - T0) < 0.002).sort((a, b) => a.min.z - b.min.z);
    const zmin = bs[0].min.z, zmax = bs[bs.length - 1].max.z, xmin = Math.min(...bs.map(b => b.min.x)), xmax = Math.max(...bs.map(b => b.max.x));
    const hz = structural.filter(t => t.horiz && t.a.y > T0 + 0.3 && t.a.y < T0 + 1.2);
    const per = sides.map(sd => {
      const on = hz.filter(t => onLine(t, sd));
      const top = on.filter(t => t.a.y > T0 + 0.75), mid = on.filter(t => t.a.y <= T0 + 0.75);
      const toes = boxes.filter(b => Math.abs(b.sz.y - 0.15) < 0.003 && Math.abs(b.min.y - T0) < 0.01 && (sd.ax === 'x' ? (b.sz.x > 0.2 && Math.abs((b.min.z + b.max.z) / 2 - sd.c) < 0.12) : (b.sz.z > 0.2 && Math.abs((b.min.x + b.max.x) / 2 - sd.c) < 0.12)));
      const lo = sd.ax === 'x' ? -2.0 : -0.6, hi = -lo, tlo = sd.ax === 'x' ? xmin : zmin, thi = sd.ax === 'x' ? xmax : zmax;
      const gaps = [];
      if (top.length && mid.length && toes.length) {
        // clear gaps measured at 20 sample stations along the side (each station uses the members covering it)
        for (let k = 0; k <= 20; k++) { const u = lo + 0.06 + (hi - lo - 0.12) * k / 20;
          const cov = (t) => { const [a, b] = iv(t, sd); return a <= u && b >= u; };
          const tp = top.filter(cov), md = mid.filter(cov), te = toes.filter(b => sd.ax === 'x' ? (b.min.x <= u && b.max.x >= u) : (b.min.z <= u && b.max.z >= u));
          if (tp.length && md.length && te.length) gaps.push(Math.max(Math.min(...md.map(t => t.a.y - t.r)) - Math.max(...te.map(b => b.max.y)), Math.min(...tp.map(t => t.a.y - t.r)) - Math.max(...md.map(t => t.a.y + t.r)))); }
      }
      return { side: sd.n, topH: [...new Set(top.map(t => +(t.a.y + t.r - T0).toFixed(3)))], maxGap: gaps.length ? +Math.max(...gaps).toFixed(4) : null,
        topHoles: holes(top.map(t => iv(t, sd)), lo, hi), midHoles: holes(mid.map(t => iv(t, sd)), lo, hi),
        toeHoles: holes(toes.map(b => sd.ax === 'x' ? [b.min.x, b.max.x] : [b.min.z, b.max.z]), tlo, thi), toeH: toes.length ? +(Math.min(...toes.map(b => b.max.y)) - T0).toFixed(4) : 0 };
    });
    return { T: T0, zmin, zmax, per };
  });
  /* board overhang (axis and face of the end bearer) */
  let ovAxis = 9, ovFace = 9;
  boards.forEach(b => { const xs = structural.filter(t => t.horiz && Math.abs(t.a.x - t.b.x) < 0.01 && Math.abs(t.a.y + t.r - b.min.y) < 0.004 && t.a.x >= b.min.x && t.a.x <= b.max.x && Math.min(t.a.z, t.b.z) <= b.min.z && Math.max(t.a.z, t.b.z) >= b.max.z).sort((p, q) => p.a.x - q.a.x);
    if (xs.length) { ovAxis = Math.min(ovAxis, xs[0].a.x - b.min.x, b.max.x - xs[xs.length - 1].a.x); ovFace = Math.min(ovFace, xs[0].a.x - xs[0].r - b.min.x, b.max.x - xs[xs.length - 1].a.x - xs[xs.length - 1].r); } });
  /* gates (raw): galvanised bars r = 0.017 in a deck band */
  const gateBars = tubes.filter(t => Math.abs(t.r - 0.017) < 1e-6 && t.horiz);
  /* ladders: stiles r = 0.020, inclined */
  const stiles = tubes.filter(t => Math.abs(t.r - 0.02) < 1e-6 && !t.vert && !t.horiz && t.len > 2);
  const ladders = [];
  stiles.forEach(t => { const L = ladders.find(l => l.s.length < 2 && Math.abs(l.s[0].a.z - t.a.z) < 0.02 && Math.abs(l.s[0].a.x - t.a.x) < 0.8); if (L) L.s.push(t); else ladders.push({ s: [t] }); });
  const others = structural.filter(t => !/^ladder/.test(t.role) && Math.abs(t.r - 0.02) > 1e-6);
  const lad = ladders.map(L => {
    const contacts = [];
    L.s.forEach((s, i) => others.forEach(o => { const q = segSeg(s, o); if (q.d <= s.r + o.r + 0.006) contacts.push({ stile: i, role: o.role, y: +q.p.y.toFixed(3), clear: +(q.d - s.r - o.r).toFixed(4), o }); }));
    const top = contacts.length ? contacts.reduce((a, c) => c.y > a.y ? c : a) : null;
    const xc = (L.s[0].a.x + (L.s[1] || L.s[0]).a.x) / 2;
    const deck = top ? decks.filter(d => d.T < top.y && top.y - d.T <= 1.3).sort((a, b) => b.T - a.T)[0] : null;
    let res = { xc: +xc.toFixed(3), len: +L.s[0].len.toFixed(3), stiles: L.s.length, top: top && { role: top.role, y: top.y, clear: top.clear }, deck: deck && deck.T };
    if (top && deck) {
      const s0 = L.s[0], k = (top.y - s0.a.y) / (s0.b.y - s0.a.y), S = s0.a.clone().lerp(s0.b, k);
      const run = Math.hypot(S.x - s0.a.x, S.z - s0.a.z);
      res.ratio = +(run / S.distanceTo(s0.a)).toFixed(4); res.ext = +(Math.min(...L.s.map(t => t.b.y)) - deck.T).toFixed(3);
      // ties: couplers gripping a stile AND the stile's own top-support member (inside both tube lengths)
      res.ties = L.s.map((s, i) => { const sup = contacts.filter(c => c.stile === i).reduce((a, c) => (!a || c.y > a.y) ? c : a, null); if (!sup) return 0;
        return couplers.filter(c => { const q1 = segPt(c.p, s.a, s.b), q2 = segPt(c.p, sup.o.a, sup.o.b); return q1.d <= s.r + 0.03 && q1.s >= 0.036 && q1.s <= s.len - 0.036 && q2.d <= sup.o.r + 0.03 && q2.s >= 0.036 && q2.s <= sup.o.len - 0.036; }).length; });
      // step-across: rung centreline at deck level → nearest point of the deck edge inside the gate opening
      const kT = (deck.T - s0.a.y) / (s0.b.y - s0.a.y), zT = s0.a.z + (s0.b.z - s0.a.z) * kT;
      const gb = gateBars.filter(t => t.a.y > deck.T + 0.75 && t.a.y < deck.T + 1.2 && Math.abs(t.a.z - 0.6) < 0.12);
      if (gb.length) { const g = gb.sort((p, q) => Math.abs((p.a.x + p.b.x) / 2 - xc) - Math.abs((q.a.x + q.b.x) / 2 - xc))[0]; const x0 = Math.min(g.a.x, g.b.x), x1 = Math.max(g.a.x, g.b.x);
        const dx = Math.max(0, x0 - xc, xc - x1); res.step = +Math.hypot(dx, zT - deck.zmax).toFixed(4); res.sideStep = dx > 0; res.gate = [+x0.toFixed(3), +x1.toFixed(3)];
        const zg = g.a.z, blockers = structural.filter(t => !/^(rail-|gate-|ladder-|puncheon)/.test(t.role) && t.role !== '').filter(t => { for (let k = 0; k <= 80; k++) { const p = t.a.clone().lerp(t.b, k / 80);
          if (p.x >= x0 + 0.04 - t.r && p.x <= x1 - 0.04 + t.r && p.y >= deck.T + 0.10 - t.r && p.y <= deck.T + 1.75 + t.r && p.z >= zg - 0.03 - t.r && p.z <= 0.9 + t.r) return true; } return false; });
        res.blockers = blockers.map(t => t.role); }
    }
    return res;
  });
  /* couplers: members gripped inside their length (tubes) or touched (boxes) */
  const grip = couplers.map(c => {
    const tl = structural.filter(t => { const q = segPt(c.p, t.a, t.b); return q.d <= t.r + 0.052 && q.s >= 0.036 - 1e-6 && q.s <= t.len - 0.036 + 1e-6; }).map(t => t.role || '?');
    const bl = boxes.filter(bx => bx.sz.y > 0.02 && boxDist(c.p, bx) <= 0.04).map(bx => bx.role || 'box');
    return { type: c.type, role: c.role, at: [c.p.x, c.p.y, c.p.z].map(v => +v.toFixed(3)), members: tl.concat(bl) };
  });
  const loose = grip.filter(g => g.members.length < 2);
  /* interpenetration: tube pairs closer than r1 + r2 − 3 mm, excluding by-design node abstractions */
  const byDesign = (a, b) => { const p = [a.role, b.role].sort().join('|');
    return ['ledger|standard', 'ledger|puncheon', 'brace|ledger', 'standard|standard', 'sleeve|standard', 'ladder-rail|ladder-rung', 'ladder-rung|ladder-rung', 'brace|brace'].includes(p) || a.role === '' || b.role === ''; };
  const pen = [];
  const pool = structural.concat(tubes.filter(t => t.role === 'ladder-rung'));
  for (let i = 0; i < pool.length; i++) for (let j = i + 1; j < pool.length; j++) { const A = pool[i], B = pool[j]; if (byDesign(A, B)) continue;
    // quick reject by bounding boxes
    const pad = A.r + B.r; if (Math.min(A.a.x, A.b.x) - pad > Math.max(B.a.x, B.b.x) || Math.min(B.a.x, B.b.x) - pad > Math.max(A.a.x, A.b.x) || Math.min(A.a.y, A.b.y) - pad > Math.max(B.a.y, B.b.y) || Math.min(B.a.y, B.b.y) - pad > Math.max(A.a.y, A.b.y) || Math.min(A.a.z, A.b.z) - pad > Math.max(B.a.z, B.b.z) || Math.min(B.a.z, B.b.z) - pad > Math.max(A.a.z, A.b.z)) continue;
    const q = segSeg(A, B, 120); if (q.d < A.r + B.r - 0.003) pen.push({ a: A.role, b: B.role, d: +q.d.toFixed(4), need: +(A.r + B.r).toFixed(3), at: [q.p.x, q.p.y, q.p.z].map(v => +v.toFixed(3)) }); }
  /* stability: H to highest standard, B from base plates that carry a standard or an outrigger tube end */
  const plates = boxes.filter(b => Math.abs(b.sz.x - 0.16) < 0.002 && Math.abs(b.sz.y - 0.035) < 0.002);
  const cx = plates.map(b => (b.min.x + b.max.x) / 2), cz = plates.map(b => (b.min.z + b.max.z) / 2);
  const B = plates.length ? Math.min(Math.max(...cx) - Math.min(...cx), Math.max(...cz) - Math.min(...cz)) : 0;
  const Hstd = Math.max(0, ...structural.filter(t => t.vert && t.r === 0.024 && t.role === 'standard').map(t => t.b.y));
  const tags = []; scaffold.traverse(o => { if (o.userData && o.userData.role === 'tag' && vis(o)) tags.push(o.userData.color); });
  return { current: window.PPAPISim.current, decks, ovAxis: +ovAxis.toFixed(4), ovFace: +ovFace.toFixed(4), ladders: lad, loose, nCouplers: couplers.length, pen,
    stab: { H: +Hstd.toFixed(3), B: +B.toFixed(3), ratio: B ? +(Hstd / B).toFixed(3) : null }, tags };
};
const measure = (page) => page.evaluate((f) => (new Function('return ' + f))()(), MEASURE.toString());
const near = (a, b, t) => Math.abs(a - b) <= t;

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

const { ctx, page, issues } = await openSim('desktop');
await page.click('#tab-build');
const ids = await page.evaluate(() => PPAPISim.steps.map(s => s.id));
const states = [];
for (let i = 0; i < 20; i++) {
  const text = await page.evaluate(() => ({ h: (document.querySelector('.stepcard h3') || {}).textContent || '', desc: (document.querySelector('.stepcard .desc') || {}).textContent || '', ref: (document.querySelector('.stepcard .ref') || {}).textContent || '' }));
  await page.click('#placeBtn'); await page.waitForTimeout(25);
  const m = await measure(page);
  const ev = await page.evaluate(() => { const e = PPAPISim.inspect(); return { ready: e.ready, fails: e.fails.map(f => f.id), items: Object.fromEntries(e.items.map(i => [i.id, { ok: i.ok, v: i.value, how: i.how }])) }; });
  states.push({ id: ids[i], text, m, ev });
}
const at = (id) => states[ids.indexOf(id)];
const fin = at('tag-hijau').m;

T.section('A1 final state: edge protection per side (raw geometry)');
fin.decks.forEach(d => {
  const long = d.per.filter(p => p.side === 'depan' || p.side === 'belakang'), ends = d.per.filter(p => p.side === 'kiri' || p.side === 'kanan');
  T.ok(long.every(p => p.topH.length && p.topH.every(h => near(h, 1.0, 0.001))), `deck ${d.T}: long-side top rail (incl. gate top bar) top surface ${[...new Set(long.flatMap(p => p.topH))].join(', ')} m (EN 12811-1 5.5.2 ≥ 1,0 m)`);
  T.ok(ends.every(p => p.topH.length && p.topH.every(h => near(h, 1.075, 0.001))), `deck ${d.T}: end-side rails offset +75 mm at the crossing → ${[...new Set(ends.flatMap(p => p.topH))].join(', ')} m (≤ 1,143 m OSHA 451(g)(4)(ii))`);
  T.ok(d.per.every(p => p.maxGap !== null && p.maxGap <= 0.47), `deck ${d.T}: largest clear gap per side ${d.per.map(p => p.side + ' ' + p.maxGap).join(' · ')} m (≤ 0,470 m Permenaker 9/2016 Ps. 24c)`);
  T.ok(d.per.every(p => p.toeH >= 0.15 - 1e-4), `deck ${d.T}: toe boards / gate kick plate ≥ 150 mm (${d.per.map(p => p.toeH).join(', ')})`);
  T.ok(d.per.every(p => !p.topHoles.length && !p.midHoles.length && !p.toeHoles.length), `deck ${d.T}: no holes in top/mid/toe on any side (gate leaf counted)`, d.per.map(p => ({ s: p.side, t: p.topHoles, m: p.midHoles, k: p.toeHoles })));
});
T.ok(near(fin.ovFace, 0.066, 0.001) && near(fin.ovAxis, 0.09, 0.001), `board end overhang ${fin.ovAxis} m from the end-transom axis, ${fin.ovFace} m past its face (≥ 50 mm; ≤ 4t = 152 mm)`);
T.ok(near(fin.stab.ratio, 5.1 / 3.2, 0.01), `H/B final ${fin.stab.H}/${fin.stab.B} = ${fin.stab.ratio}`);
T.ok(states.every(s => s.m.stab.ratio === null || s.m.stab.ratio <= 4), 'H/B ≤ 4 at every state', states.map(s => s.m.stab.ratio));

T.section('A2 ladders: top support stays, both stiles tied to it, 4:1, extension, step-across');
console.log('   ladders (final):', JSON.stringify(fin.ladders));
T.ok(fin.ladders.length === 2 && fin.ladders.every(l => l.stiles === 2), `two ladders (lift-1 and top deck), each with two stiles`, fin.ladders.length);
fin.ladders.forEach(l => {
  const nm = l.deck > 3 ? 'top-deck ladder' : 'lift-1 ladder';
  T.ok(l.top && l.top.role === 'rail-top' && l.top.clear >= -0.0015 && l.top.clear <= 0.004, `${nm}: bears on a top rail (contact clearance ${l.top && l.top.clear} m) at y ${l.top && l.top.y}`, l.top);
  T.ok(l.ties && l.ties.every(n => n >= 1), `${nm}: both stiles tied by couplers that grip the stile and that top rail (${l.ties})`);
  T.ok(l.ratio >= 0.24 && l.ratio <= 0.245, `${nm}: foot run ${(l.ratio * 100).toFixed(2)} % of working length (≈ ¼, OSHA 1926.1053(b)(5)(i))`);
  T.ok(l.ext >= 1.0, `${nm}: stiles ${l.ext} m above the landing (OSHA ≥ 0,9 m; NASC SG25:20 ≥ 1,0 m)`);
  T.ok(l.sideStep && l.step >= 0.38 && l.step <= 0.51, `${nm}: side-step from rung centreline to the deck edge in the gate opening ${l.step} m (OSHA 1910.23(d)(12)(ii) by analogy: 0,38–0,51 m)`, l);
});
// the top-deck ladder's support exists in every state where the ladder exists
const ladStates = states.filter(s => s.m.ladders.some(l => l.len > 4));
T.ok(ladStates.length && ladStates.every(s => { const l = s.m.ladders.find(x => x.len > 4); return l.top && l.top.role === 'rail-top' && l.ties.every(n => n >= 1); }), `top-deck ladder: support rail present and tied in every state from step 18 (${ladStates.map(s => s.id).join(', ')})`);

T.section('A3 access to every deck that people are told to work from');
const accessTo = (s, T0) => s.m.ladders.some(l => l.deck !== null && near(l.deck, T0, 0.002) && l.ties && l.ties.every(n => n >= 1) && l.step !== undefined && l.blockers && l.blockers.length === 0);
const deck1 = fin.decks[0].T, deck2 = fin.decks[1].T;
['ledger-l2', 'transom-l2', 'bracing-l2', 'pagar-atas', 'lantai-atas', 'tangga', 'inspeksi', 'tag-hijau'].forEach(id => T.ok(accessTo(at(id), deck1), `after "${id}": lift-1 deck has a tied ladder + gate opening, clear of braces/members 0,10–1,75 m above the deck`, at(id).m.ladders.map(l => ({ deck: l.deck, blockers: l.blockers }))));
['tangga', 'inspeksi', 'tag-hijau'].forEach(id => T.ok(accessTo(at(id), deck2), `after "${id}": top deck has a tied ladder + clear gate opening`));
T.ok(at('bracing-l2').ev.items['brace-face'].ok && /bay akses/.test(at('bracing-l2').ev.items['brace-face'].v), 'lift-2 bracing complete with the lift-1 access bay (back, right) left free', at('bracing-l2').ev.items['brace-face'].v);
T.ok(!states.slice(0, ids.indexOf('tangga')).some(s => s.ev.ready), 'inspection not ready at any state before the top-deck ladder');
T.ok(at('tangga').ev.ready && at('inspeksi').ev.ready, 'inspection ready once both accesses are complete', at('tangga').ev.fails);
T.ok(at('lantai-l1').ev.items.access.ok && !at('lantai-atas').ev.items.access.ok && at('tangga').ev.items.access.ok, 'app item "akses ke setiap lantai kerja": met for lift-1 at step 12, not met at step 17 (top deck without ladder), met after step 18', { l1: at('lantai-l1').ev.items.access, la: at('lantai-atas').ev.items.access, t: at('tangga').ev.items.access });
T.ok(['persiapan', 'lantai-l1', 'bracing-l2', 'pagar-atas'].every(id => !at(id).ev.items.plan.ok) && at('lantai-atas').ev.items.plan.ok, 'app item "sesuai rencana": 2 decks + 3 ledger levels only from step 17', ['lantai-l1', 'pagar-atas', 'lantai-atas'].map(id => at(id).ev.items.plan.v));

T.section('B physical joints');
const looseF = fin.loose;
T.ok(looseF.length === 0, `every coupler grips ≥ 2 members inside their tube lengths (${fin.nCouplers} couplers)`, looseF.slice(0, 8));
T.ok(states.every(s => s.m.loose.length === 0), 'no loose coupler at any of the 20 states', states.filter(s => s.m.loose.length).map(s => ({ id: s.id, loose: s.m.loose.slice(0, 3) })));
T.ok(fin.pen.length === 0, 'no interpenetrating tubes (rails at corners, ladder, gate, outriggers, kicker, posts)', fin.pen.slice(0, 10));

T.section('C inspection engine (state 18/20): baseline + mutations');
await page.click('#undoBtn'); await page.click('#undoBtn');
const mut = await page.evaluate(() => {
  const S = PPAPISim.scene, res = {};
  const grab = (pred) => { const a = []; S.traverse(o => { if (pred(o)) a.push(o); }); return a; };
  const run = (name, pred, fn) => { const objs = grab(pred); const saved = objs.map(o => ({ o, v: o.visible, p: o.position.clone(), r: o.rotation.clone() })); objs.forEach(fn); const e = PPAPISim.inspect(); saved.forEach(s => { s.o.visible = s.v; s.o.position.copy(s.p); s.o.rotation.copy(s.r); });
    res[name] = { n: objs.length, ready: e.ready, fails: e.fails.map(f => f.id), stab: e.m.stab && +e.m.stab.ratio.toFixed(2), tie: e.items.find(i => i.id === 'ladder-tie').value }; };
  run('baseline', () => false, () => {});
  run('all outrigger tubes + kickers hidden (plates left)', o => o.userData.role === 'outrigger' || o.userData.role === 'outrigger-tie', o => { o.visible = false; });
  run('outrigger head couplers hidden', o => o.userData.couplerType === 'swivel' && o.position.y > 1.7 && o.position.y < 1.9 && Math.abs(Math.abs(o.position.x) - 1.9625) < 0.01, o => { o.visible = false; });
  run('ladder tie couplers hidden', o => o.userData.role === 'ladder-tie', o => { o.visible = false; });
  run('top rail behind the top ladder hidden', o => o.userData.role === 'rail-top' && o.isMesh && o.position.y > 4.5 && o.position.z > 0.5 && o.position.x > -1 && o.position.x < 0.5, o => { o.visible = false; });
  run('top-deck gate hidden', o => o.userData.role === 'gate' && o.position.y === 0 && grabY(o) > 4, o => { o.visible = false; });
  run('top-deck gate moved outside the rails', o => o.userData.role === 'gate' && grabY(o) > 4, o => { o.position.z += 0.10; });
  run('lift-1 ladder hidden', o => /^ladder-(rail|rung)$/.test(o.userData.role) && o.isMesh && Math.min(o.position.x) > 0 && o.position.y < 3.2 && Math.abs(o.position.x - 0.34) < 0.3, o => { o.visible = false; });
  run('one standard tilted 3°', (() => { let k = 0; return o => o.userData.role === 'standard' && k++ === 0; })(), o => { o.rotation.z += 0.0524; });
  run('lift-1 putlogs removed', o => o.userData.role === 'putlog' && o.position.y < 3, o => { o.visible = false; });
  run('top rail of lift-1 lowered 80 mm', o => o.userData.role === 'rail-top' && o.position.y < 3.2, o => { o.position.y -= 0.08; });
  run('board clips removed', o => o.userData.role === 'boardclip', o => { o.visible = false; });
  run('one facade brace removed', (() => { let k = 0; return o => o.userData.role === 'brace' && k++ === 0; })(), o => { o.visible = false; });
  run('upper standard extensions removed', o => o.userData.role === 'standard' && o.position.y > 3, o => { o.visible = false; });
  { const b = grab(o => o.userData.role === 'brace' && o.isMesh && Math.abs(o.position.z - 0.66) < 0.01 && o.position.y > 2.5 && o.position.y < 3.5 && o.position.x < 0)[0];
    const c = b.clone(); c.position.x = -b.position.x; const d = new THREE.Vector3(0, 1, 0).applyQuaternion(b.quaternion); d.x = -d.x; c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); b.parent.add(c);
    const e = PPAPISim.inspect(); b.parent.remove(c);
    res['brace added across the lift-1 access'] = { n: 1, ready: e.ready, fails: e.fails.map(f => f.id), stab: e.m.stab && +e.m.stab.ratio.toFixed(2), tie: e.items.find(i => i.id === 'access').value }; }
  function grabY(g) { let y = -1; g.traverse(c => { if (c.userData.role === 'gate-top') { const p = new THREE.Vector3(); c.getWorldPosition(p); y = p.y; } }); return y; }
  return res;
});
Object.entries(mut).forEach(([k, v]) => console.log(`   ${k}: n=${v.n} ready=${v.ready} fails=[${v.fails.join(',')}] stab=${v.stab} tie="${v.tie}"`));
T.ok(mut.baseline.ready && mut.baseline.fails.length === 0, 'baseline at 18/20: all items met', mut.baseline);
const expect = { 'all outrigger tubes + kickers hidden (plates left)': 'stab', 'outrigger head couplers hidden': 'stab', 'ladder tie couplers hidden': 'ladder-tie', 'top rail behind the top ladder hidden': 'ladder-tie',
  'top-deck gate hidden': 'gate', 'top-deck gate moved outside the rails': 'gate', 'lift-1 ladder hidden': 'access', 'one standard tilted 3°': 'plumb', 'lift-1 putlogs removed': 'deck-span',
  'top rail of lift-1 lowered 80 mm': 'rail-top', 'board clips removed': 'deck-end', 'one facade brace removed': 'brace-face', 'upper standard extensions removed': 'joints', 'brace added across the lift-1 access': 'access' };
Object.entries(expect).forEach(([k, id]) => T.ok(mut[k].n > 0 && !mut[k].ready && mut[k].fails.includes(id), `mutation "${k}" (n=${mut[k].n}) → not ready, "${id}" fails (${mut[k].fails.join(',')})`, mut[k]));

T.section('D texts, panel, materials');
const st18 = at('tangga').text, st11 = at('pagar-l1').text, st12 = at('lantai-l1').text, st1 = at('persiapan').text, st8 = at('bracing-l1').text;
T.ok(/bersandar pada top rail yang tetap terpasang/.test(st18.desc) && /kedua kakinya diikat/.test(st18.desc) && !/ledger lift-1/.test(st18.desc), 'step 18 text: ladder rests on a top rail that stays, both stiles tied (no ledger-tie claim)', st18.desc.slice(0, 200));
T.ok(/tali pembatas gerak/.test(st11.desc) && !/penahan jatuh/.test(st11.desc), 'step 11: harness + work restraint (Permenaker 9/2016 Pasal 25), no fall-arrest wording', st11.desc.slice(-160));
T.ok(/tangga aksesnya dipasang sekarang/.test(st12.desc), 'step 12: lift-1 access ladder installed with the deck');
T.ok(/Pasal 7, 10 & 21/.test(st1.ref), 'step 1 reference includes PER.01/MEN/1980 Pasal 10', st1.ref);
T.ok(!/\(b\)\(4\)/.test(st8.ref) && /kriteria aplikasi/.test(st8.ref), 'step 8 reference: no 452(b)(4); per-lift pattern labelled as application criterion', st8.ref);
await page.click('#placeBtn'); await page.click('#placeBtn');
await page.click('#tab-insp'); await page.waitForTimeout(200);
const panel = await page.evaluate(() => ({ rows: [...document.querySelectorAll('.insp-list li')].map(li => ({ id: li.dataset.check, t: li.textContent.replace(/\s+/g, ' ').trim() })), note: [...document.querySelectorAll('.insp-note')].map(n => n.textContent), st: document.querySelector('.insp-status .st').textContent }));
const row = (id) => (panel.rows.find(r => r.id === id) || {}).t || '';
T.ok(/Boleh digunakan/.test(panel.st), 'final status "Boleh digunakan"', panel.st);
T.ok(/2\/2 kaki diikat/.test(row('ladder-tie')) && /bertumpu pada top rail/.test(row('ladder-tie')), 'tie row: "bertumpu pada top rail … 2/2 kaki diikat" for each ladder', row('ladder-tie'));
T.ok(/Diperiksa dari jenis\/keberadaan komponen/.test(row('tag')) && /sifat menutup sendiri diperiksa/.test(row('gate')) && /Diukur dari model/.test(row('stab')), 'method chips: tag = checked, gate = measured + type check, stab = measured');
T.ok(panel.note.some(n => /butir diukur dari geometri model/.test(n)), 'panel note states how many items are measured', panel.note[0]);
console.log('   panel rows:', JSON.stringify(panel.rows.map(r => r.t.slice(0, 160)), null, 1));
const mats = await page.evaluate(() => { const s = new Set(); PPAPISim.scene.traverse(o => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => s.add(m.uuid)); }); return s.size; });
const matsBuild = await page.evaluate(() => { PPAPISim.switchTab('build'); const s = new Set(); PPAPISim.scene.traverse(o => { if (o.material && o.visible) (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => s.add(m.uuid)); }); return s.size; });
console.log(`   materials in the scene at 20/20: ${mats} (all objects, incl. the hidden catalogue model); ${matsBuild} on visible objects`);
T.ok(issues.length === 0, 'no console errors / page errors', issues.slice(0, 5));

T.section('E screenshots');
const views = {
  'fixsim-top-access': [[0.9, 5.6, 3.6], [-1.15, 4.55, 0.6]],
  'fixsim-l1-access': [[2.2, 3.4, 3.4], [0.75, 2.55, 0.6]],
  'fixsim-ladder-tie-top': [[-0.2, 5.25, 1.35], [-0.86, 4.98, 0.58]],
  'fixsim-corner-rails': [[3.2, 5.0, 1.6], [1.95, 4.6, 0.55]],
  'fixsim-outrigger': [[3.4, 1.4, 2.9], [1.95, 1.0, 1.0]],
};
for (const [name, [pos, tgt]] of Object.entries(views)) {
  await page.evaluate(({ pos, tgt }) => { const c = PPAPISim.camera; c.clearViewOffset(); c.position.set(...pos); c.lookAt(...tgt); c.updateProjectionMatrix(); PPAPISim.renderer.shadowMap.needsUpdate = true; PPAPISim.renderer.render(PPAPISim.scene, c); }, { pos, tgt });
  await page.locator('#app-main canvas').screenshot({ path: new URL(`../shots/${name}.png`, import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1') });
}
await ctx.close();
{
  const { ctx, page } = await openSim('desktop');
  await page.click('#tab-build');
  for (let i = 0; i < 12; i++) await page.click('#placeBtn');
  await page.waitForTimeout(500); await shot(page, 'fixsim-step12-build');
  for (let i = 0; i < 8; i++) await page.click('#placeBtn');
  await page.waitForTimeout(500); await shot(page, 'fixsim-final-build');
  await page.click('#tab-insp'); await page.waitForTimeout(400);
  await page.evaluate(() => { const l = [...document.querySelectorAll('.insp-list li')].find(li => li.dataset.check === 'ladder'); if (l) l.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(200); await shot(page, 'fixsim-insp-access');
  await ctx.close();
}
{
  const { ctx, page } = await openSim('mobile');
  await page.click('#tab-build');
  for (let i = 0; i < 20; i++) await page.click('#placeBtn');
  await page.click('#tab-insp'); await page.waitForTimeout(400);
  await page.evaluate(() => { const l = [...document.querySelectorAll('.insp-list li')].find(li => li.dataset.check === 'gate'); if (l) l.scrollIntoView({ block: 'center' }); });
  await page.waitForTimeout(200); await shot(page, 'fixsim-mobile-insp');
  await ctx.close();
}

await browser.close(); server.close();
process.exitCode = T.done() ? 1 : 0;
