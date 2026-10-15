// aplikasi-simulator-flow — koreksi geometri & urutan simulator tube & coupler (KOREKSI-SIMULATOR.md)
// Steps through the corrected 20-step sequence, asserts the order rules, measures rail heights / gaps /
// toe boards / board spans straight from the three.js scene (independently of the app's own inspection),
// checks the inspection engine (pass + forced failures), memory stability, render-on-demand, keyboard,
// mobile framing, progress migration, and the WebGL / CDN fallbacks.
// usage (cwd devtools): node flows/aplikasi-simulator-flow.mjs [--only=A,B,...]
import { startServer, launch, newContext, seedSession, watch, recorder, shot, simDrawn } from './aplikasi-lib.mjs';

const args = process.argv.slice(2);
const only = (args.find(a => a.startsWith('--only=')) || '').slice(7).split(',').filter(Boolean);
const run = (k) => !only.length || only.includes(k);
const T = recorder('aplikasi-simulator-flow');
const { server, BASE } = await startServer();
const browser = await launch();
const SIM = `${BASE}/aplikasi/simulator/index.html`;
const PKEY = 'ppapi_progress_demo-uji-0001_simulator';
const EXPECTED = ['persiapan', 'alas', 'standard', 'ledger-dasar', 'transom-dasar', 'ledger-l1', 'transom-l1',
  'bracing-l1', 'outrigger', 'sambung', 'pagar-l1', 'lantai-l1', 'ledger-l2', 'transom-l2', 'bracing-l2',
  'pagar-atas', 'lantai-atas', 'tangga', 'inspeksi', 'tag-hijau'];
const noIssues = (label, issues) => T.ok(issues.length === 0, `${label}: no console errors / page errors / failed requests`, issues.slice(0, 4));
const txt = (page, sel) => page.$eval(sel, el => el.textContent.replace(/\s+/g, ' ').trim()).catch(() => '');

async function openSim(vp = 'desktop', { init } = {}) {
  const ctx = await newContext(browser, vp);
  await seedSession(ctx, {});
  if (init) await ctx.addInitScript(init);
  const page = await ctx.newPage();
  const issues = watch(page);
  await page.goto(SIM, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'), null, { timeout: 30000 });
  return { ctx, page, issues };
}
async function start(page) {
  await page.click('#startBtn');
  await page.waitForFunction(() => window.PPAPISim && document.querySelector('#app-main canvas'), null, { timeout: 30000 });
}

/* Independent measurement straight from the scene graph (does not call the app's evaluate()). */
const SCENE_MEASURE = () => {
  const S = window.PPAPISim.scene, THREE = window.THREE;
  S.updateMatrixWorld(true);
  const visible = (o) => { for (let p = o; p; p = p.parent) { if (p.parent && !p.visible && p.userData.stepId === undefined) return false; } return true; };
  const built = new Set();
  // step groups that are built = solid (not ghost) and visible in the current mode
  const byRole = {};
  S.traverse(o => {
    const r = o.userData && o.userData.role; if (!r || !o.isMesh) return;
    let p = o, ok = true; while (p && p !== S) { if (!p.visible) { ok = false; break; } p = p.parent; }
    if (!ok) return;
    if (o.material && o.material.transparent && o.material.opacity < 0.6) return;   // ghost
    (byRole[r] = byRole[r] || []).push(o);
  });
  const box = (o) => new THREE.Box3().setFromObject(o);
  const tubeY = (o) => { const p = new THREE.Vector3(); o.getWorldPosition(p); return { y: p.y, r: o.geometry.parameters.radiusTop, len: o.geometry.parameters.height }; };
  const boards = (byRole.board || []).map(box);
  const tops = [...new Set(boards.map(b => Math.round(b.max.y * 1000) / 1000))].sort((a, b) => a - b);
  const decks = tops.map(T0 => {
    const rt = (byRole['rail-top'] || []).concat(byRole['gate-top'] || []).map(tubeY).filter(t => t.y > T0 && t.y < T0 + 1.3);
    const rm = (byRole['rail-mid'] || []).concat(byRole['gate-mid'] || []).map(tubeY).filter(t => t.y > T0 && t.y < T0 + 1.3);
    const toe = (byRole.toeboard || []).concat(byRole['gate-kick'] || []).map(box).filter(b => Math.abs(b.min.y - T0) < 0.01);
    const topMin = rt.length ? Math.min(...rt.map(t => t.y + t.r)) - T0 : 0;
    const topMax = rt.length ? Math.max(...rt.map(t => t.y + t.r)) - T0 : 0;
    const toeMin = toe.length ? Math.min(...toe.map(b => b.max.y)) - T0 : 0;
    const midUnder = rm.length ? Math.min(...rm.map(t => t.y - t.r)) - T0 : null;
    const midTop = rm.length ? Math.max(...rm.map(t => t.y + t.r)) - T0 : null;
    const topUnder = rt.length ? Math.min(...rt.map(t => t.y - t.r)) - T0 : null;
    const gap1 = midUnder !== null ? midUnder - toeMin : null, gap2 = midUnder !== null ? topUnder - midTop : null;
    return { deck: T0, topMin, topMax, toeMin, gap1, gap2, nTop: rt.length, nMid: rm.length, nToe: toe.length };
  });
  // board spans from bearer positions under each board
  const bearers = (byRole.transom || []).concat(byRole.putlog || []).map(o => { const p = new THREE.Vector3(); o.getWorldPosition(p); return { x: p.x, top: p.y + o.geometry.parameters.radiusTop }; });
  let maxSpan = 0, minOver = 9, maxOver = 0;
  boards.forEach(b => { const xs = bearers.filter(s => Math.abs(s.top - b.min.y) < 0.006 && s.x >= b.min.x && s.x <= b.max.x).map(s => s.x).sort((a, c) => a - c);
    for (let i = 1; i < xs.length; i++) maxSpan = Math.max(maxSpan, xs[i] - xs[i - 1]);
    if (xs.length) { minOver = Math.min(minOver, xs[0] - b.min.x, b.max.x - xs[xs.length - 1]); maxOver = Math.max(maxOver, xs[0] - b.min.x, b.max.x - xs[xs.length - 1]); } });
  const tags = []; S.traverse(o => { if (o.userData && o.userData.role === 'tag') { let p = o, v = true; while (p && p !== S) { if (!p.visible) { v = false; break; } p = p.parent; } if (v) tags.push(o.userData.color); } });
  const stdTop = Math.max(0, ...(byRole.standard || []).map(o => { const t = tubeY(o); return t.y + t.len / 2; }));
  const feet = (byRole.baseplate || []).map(o => { const p = new THREE.Vector3(); o.getWorldPosition(p); return p; });
  const bx = feet.length ? Math.max(...feet.map(p => p.x)) - Math.min(...feet.map(p => p.x)) : 0;
  const bz = feet.length ? Math.max(...feet.map(p => p.z)) - Math.min(...feet.map(p => p.z)) : 0;
  return { decks, maxSpan, minOver, maxOver, tags, stdTop, baseMin: Math.min(bx, bz), nBoards: boards.length, nBrace: (byRole.brace || []).length, nOutrigger: (byRole.outrigger || []).length, gate: !!(byRole['gate-top'] || []).length };
};

/* ======================================================================
   A. Urutan 20 tahap + aturan urutan + ukuran dari adegan
   ====================================================================== */
if (run('A')) {
  T.section('A desktop: corrected 20-step sequence, order rules, scene measurements');
  const { ctx, page, issues } = await openSim('desktop');
  await start(page);
  const ids = await page.evaluate(() => PPAPISim.steps.map(s => s.id));
  T.ok(JSON.stringify(ids) === JSON.stringify(EXPECTED), 'step order = persiapan → … → inspeksi → tag-hijau (20 tahap)', ids);
  await page.click('#tab-build');
  const states = [];
  for (let i = 0; i < 20; i++) {
    const card = await txt(page, '.stepcard h3');
    if (EXPECTED[i] === 'inspeksi') {
      const mini = await txt(page, '.insp-mini');
      T.ok(/22\/22|\d+\/\d+ butir memenuhi/.test(mini) && /Siap dicatat/.test(mini), 'inspection step shows the live measured result before recording', mini);
    }
    await page.click('#placeBtn');
    await page.waitForTimeout(40);
    const s = await page.evaluate((f) => { const ev = PPAPISim.inspect(); const sm = (new Function('return ' + f))()(); return {
      current: PPAPISim.current, ready: ev.ready, handedOver: ev.handedOver, red: ev.red, green: ev.green,
      fails: ev.fails.map(x => x.id), ratio: ev.m.stab ? ev.m.stab.ratio : null, items: Object.fromEntries(ev.items.map(x => [x.id, x.ok])), sm,
      tagline: (document.querySelector('.tagline') || {}).textContent || '' }; }, SCENE_MEASURE.toString());
    states.push(s);
    T.ok(s.current === i + 1, `step ${i + 1} (${EXPECTED[i]}) placed — "${card.replace(/^Tahap \d+ dari \d+: /, '')}"`, s.current);
  }
  const at = (id) => states[EXPECTED.indexOf(id)];   // state right AFTER that step is placed
  // tag rules
  T.ok(at('persiapan').red && !at('persiapan').green && /Tag merah/.test(at('persiapan').tagline), 'red tag from step 1 (persiapan), panel says "Tag merah — jangan digunakan"', at('persiapan').tagline);
  T.ok(states.slice(0, 19).every(s => !s.green), 'no green tag at any state before the last step');
  T.ok(states.slice(0, 19).every(s => !s.handedOver), 'never "boleh digunakan" before the green-tag step');
  T.ok(at('inspeksi').ready && at('tangga').ready, 'all measured checks pass once ladder + gate are in (handover inspection passes)', at('tangga').fails);
  T.ok(states.slice(0, EXPECTED.indexOf('tangga')).every(s => !s.ready), 'inspection is NOT ready at any earlier state (incomplete scaffold fails)');
  T.ok(at('tag-hijau').green && !at('tag-hijau').red && at('tag-hijau').handedOver, 'green tag only after inspection; red tags removed', at('tag-hijau'));
  T.ok(/Tag hijau/.test(at('tag-hijau').tagline), 'panel status: tag hijau — boleh digunakan', at('tag-hijau').tagline);
  // stability before height limit
  T.ok(states.every(s => s.ratio === null || s.ratio <= 4), 'height : base ratio never exceeds 4 : 1 at any state (outriggers before standards are extended)', states.map(s => s.ratio && +s.ratio.toFixed(2)));
  const bo = at('bracing-l1').sm.stdTop / 1.2;
  T.ok(at('bracing-l1').sm.nOutrigger === 0 && at('outrigger').sm.nOutrigger === 4 && at('sambung').sm.stdTop > 4.8 && at('outrigger').sm.stdTop < 4.8,
    `outriggers (4) fitted while standards < 4 × 1,2 m (=${at('outrigger').sm.stdTop.toFixed(2)} m), extension to ${at('sambung').sm.stdTop.toFixed(2)} m only afterwards`, { bo });
  // bracing per lift before the next lift is worked
  T.ok(at('bracing-l1').items['brace-face'] && at('bracing-l1').items['brace-end'] && at('bracing-l1').items['brace-angle'], 'lift-1 bracing complete (both faces, X ends, 40–50°) before any lift-2 work');
  T.ok(!at('ledger-l2').items['brace-face'] && at('bracing-l2').items['brace-face'] && at('bracing-l2').items['brace-end'], 'lift-2 bracing added progressively (missing → flagged until bracing-l2)');
  // guardrails before boards are walked on
  const r1 = at('pagar-l1').sm, b1 = at('lantai-l1').sm;
  T.ok(r1.nBoards === 0 && b1.nBoards === 5, 'lift-1: guardrails installed before any board (protected position)', { r1: r1.nBoards, b1: b1.nBoards });
  const r2 = at('pagar-atas').sm, b2 = at('lantai-atas').sm;
  T.ok(r2.nBoards === 5 && b2.nBoards === 10, 'top lift: guardrails (advance guardrail) before top boards', { r2: r2.nBoards, b2: b2.nBoards });
  // final measurements from the scene (independent of evaluate())
  const fin = at('tag-hijau').sm;
  T.ok(fin.decks.length === 2, 'two boarded decks (lift-1 2,06 m; top 4,01 m)', fin.decks.map(d => d.deck));
  fin.decks.forEach(d => {
    T.ok(d.topMin >= 0.95 && d.topMin >= 0.999 && d.topMax <= 1.143, `deck +${d.deck.toFixed(3)}: top rail top surface ${d.topMin.toFixed(3)}–${d.topMax.toFixed(3)} m above platform (≥ 950 mm Permenaker; ≥ 1,0 m EN 12811-1; ≤ 1,14 m OSHA)`);
    T.ok(d.gap1 !== null && d.gap1 <= 0.47 && d.gap2 <= 0.47, `deck +${d.deck.toFixed(3)}: clear gaps toe→mid ${d.gap1.toFixed(3)} m, mid→top ${d.gap2.toFixed(3)} m (≤ 0,47 m)`);
    T.ok(d.toeMin >= 0.15, `deck +${d.deck.toFixed(3)}: toe boards ${(d.toeMin * 1000).toFixed(0)} mm (≥ 150 mm)`);
  });
  T.ok(fin.maxSpan <= 1.2 && fin.maxSpan > 0, `board spans from bearer positions: max ${fin.maxSpan.toFixed(2)} m (≤ 1,2 m, BS 2482:2009 38 mm)`);
  T.ok(fin.minOver >= 0.05 && fin.maxOver <= 0.152, `board end overhang ${(fin.minOver * 1000).toFixed(0)}–${(fin.maxOver * 1000).toFixed(0)} mm (50 mm … 4 × 38 mm)`);
  T.ok(fin.stdTop / fin.baseMin <= 4, `final H/B ${(fin.stdTop).toFixed(2)} / ${fin.baseMin.toFixed(2)} = ${(fin.stdTop / fin.baseMin).toFixed(2)} (≤ 4 : 1)`);
  /* v2 simulator fix: a ladder + gate at each deck → one green tag at EACH access point (lift 1 and top), no red tag left */
  T.ok(fin.gate && fin.tags.join() === 'green,green', 'self-closing gates in place; only green tags visible, one at each of the two access points', fin.tags);
  // app's own inspection agrees
  const ev = await page.evaluate(() => { const e = PPAPISim.inspect(); return { pass: e.pass, total: e.total, fails: e.items.filter(i => !i.ok).map(i => i.id), decks: e.m.decks.map(d => ({ top: d.top, rail: d.topRail, gap: d.gapMax, toe: d.toe })), span: e.m.deckSpan, ang: e.m.braceAngles, lad: e.m.ladder }; });
  T.ok(ev.pass === ev.total && ev.total >= 20, `app inspection: ${ev.pass}/${ev.total} items pass at the end`, ev.fails);
  T.ok(ev.decks.every((d, i) => Math.abs(d.rail - fin.decks[i].topMin) < 0.001 && Math.abs(d.toe - fin.decks[i].toeMin) < 0.001), 'app measurements = independent scene measurements', { app: ev.decks, scene: fin.decks });
  T.ok(ev.ang.every(a => a >= 40 && a <= 50), `facade brace angles ${ev.ang.map(a => a.toFixed(1)).join(', ')}° (45° ± 5°)`);
  T.ok(ev.lad && ev.lad.ratio > 0.22 && ev.lad.ratio < 0.28 && ev.lad.ext >= 0.9, 'ladder 4 : 1 and ≥ 0,9 m above the landing', ev.lad);
  await shot(page, 'apl-sim-koreksi-desktop-final');
  // forced failure: remove one toe board → inspection must fail, inspection step must refuse
  await page.click('#undoBtn'); await page.click('#undoBtn');   // back to "inspeksi" step (current 18)
  const forced = await page.evaluate(() => {
    let hid = null; PPAPISim.scene.traverse(o => { if (!hid && o.userData.role === 'toeboard' && o.position.y > 4) hid = o; });
    hid.visible = false;
    const e = PPAPISim.inspect();
    document.getElementById('placeBtn').click();
    const after = PPAPISim.current;
    hid.visible = true;
    return { ready: e.ready, fails: e.fails.map(f => f.id), after, toast: document.getElementById('toastMsg').textContent };
  });
  T.ok(!forced.ready && forced.fails.includes('perimeter') && forced.after === 18 && /belum memenuhi/.test(forced.toast), 'missing toe board → perimeter fails, handover step refuses (stays at 18/20)', forced);
  const forced2 = await page.evaluate(() => {
    const hid = []; PPAPISim.scene.traverse(o => { if (o.userData.role === 'rail-mid' && o.position.y > 4) hid.push(o); });
    hid.forEach(o => o.visible = false); const e = PPAPISim.inspect(); hid.forEach(o => o.visible = true);
    return { fails: e.fails.map(f => f.id), gap: e.m.decks.map(d => d.gapMax) };
  });
  T.ok(forced2.fails.includes('rail-gap') && forced2.gap[1] > 0.47, 'missing mid rails → gap check fails (gap > 470 mm measured)', forced2);
  noIssues('sequence desktop', issues);
  await ctx.close();
}

/* ======================================================================
   B. Inspeksi: overlay terukur, status, kebocoran memori, render sesuai kebutuhan, keyboard
   ====================================================================== */
if (run('B')) {
  T.section('B desktop: inspection overlays, memory, render-on-demand, keyboard');
  const { ctx, page, issues } = await openSim('desktop');
  await start(page);
  // library memory (36 clicks)
  await simDrawn(page);   // memory read in a settled state: pending changes drawn (aplikasi-lib.mjs)
  const lg0 = await page.evaluate(() => ({ g: PPAPISim.renderer.info.memory.geometries, t: PPAPISim.renderer.info.memory.textures }));
  const libs = ['fix', 'swivel', 'sleeve', 'putlog', 'board', 'plank', 'ladder', 'beamclamp', 'anchorclamp', 'redtag', 'greentag', 'tube'];
  for (let k = 0; k < 3; k++) for (const l of libs) await page.click(`[data-lib="${l}"]`);
  await page.waitForTimeout(300);
  await simDrawn(page);
  const lg1 = await page.evaluate(() => ({ g: PPAPISim.renderer.info.memory.geometries, t: PPAPISim.renderer.info.memory.textures }));
  await page.click('[data-lib="fix"]'); await page.waitForTimeout(200);
  await simDrawn(page);
  const lg2 = await page.evaluate(() => PPAPISim.renderer.info.memory.geometries);
  for (const l of libs) await page.click(`[data-lib="${l}"]`);
  await page.click('[data-lib="fix"]'); await page.waitForTimeout(200);
  await simDrawn(page);
  const lg3 = await page.evaluate(() => PPAPISim.renderer.info.memory.geometries);
  T.ok(lg3 === lg2 && lg1.t === lg0.t, `library: geometry count stable after 48 model switches (${lg2} → ${lg3}), textures ${lg0.t} → ${lg1.t}`);
  // keyboard: tabs
  await page.focus('#tab-lib');
  await page.keyboard.press('End');
  T.ok(await page.evaluate(() => PPAPISim.mode === 'insp' && document.activeElement.id === 'tab-insp'), 'End on tabs → Inspeksi (ARIA tabs)');
  // incomplete state in inspection: everything measured, not "boleh digunakan"
  const inc = await page.evaluate(() => ({ st: document.querySelector('.insp-status .st').textContent, bad: document.querySelectorAll('.insp-list li.bad').length, ok: document.querySelectorAll('.insp-list li.ok').length }));
  T.ok(/Jangan digunakan/i.test(inc.st) && inc.bad > 15, `0/20 placed → status "Jangan digunakan", ${inc.bad} items not met (no hard-coded ✓)`, inc);
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  T.ok(await page.evaluate(() => PPAPISim.mode === 'build'), 'ArrowRight → Perakitan');
  // build to step 11 using Enter on the focused canvas, screenshot intermediate states
  await page.focus('#app-main canvas');
  for (let i = 0; i < 8; i++) await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  await shot(page, 'apl-sim-koreksi-step09-outrigger');
  for (let i = 0; i < 2; i++) await page.keyboard.press('Enter');
  await page.waitForTimeout(250);
  await shot(page, 'apl-sim-koreksi-step11-pagar-l1');
  T.ok((await txt(page, '.prog .cnt')) === '10/20' && /Pelindung tepi lift-1/.test(await txt(page, '.stepcard h3')), 'Enter on canvas places components (10/20; next: pelindung tepi lift-1)');
  // partial inspection at 10/20
  await page.click('#tab-insp');
  for (const k of ['vert', 'horz', 'dist', 'square', 'edge', 'stab']) await page.click(`[data-insp="${k}"]`);
  const part = await page.evaluate(() => ({ labels: [...document.querySelectorAll('#labels .lbl')].map(l => l.textContent), bad: [...document.querySelectorAll('.insp-list li.bad')].map(l => l.dataset.check) }));
  T.ok(part.labels.some(l => /Belum ada lantai kerja ✗/.test(l)) && part.labels.some(l => /H\/B .* ✓/.test(l)) && part.bad.includes('rail-top') && part.bad.includes('ladder') && !part.bad.includes('stab') && !part.bad.includes('brace-face'),
    'at 10/20 the overlays show measured values: no deck yet (✗), stability ✓, lift-1 bracing ✓', part);
  await shot(page, 'apl-sim-koreksi-insp-partial');
  await page.click('#tab-build');
  for (let i = 0; i < 10; i++) await page.click('#placeBtn');
  T.ok((await txt(page, '.prog .cnt')) === '20/20', '20/20 complete');
  // inspection tab, all six overlays
  await page.click('#tab-insp');
  for (const k of ['vert', 'horz', 'dist', 'square', 'edge', 'stab']) {
    await page.focus(`[data-insp="${k}"]`); await page.keyboard.press('Space');
  }
  const fin = await page.evaluate(() => {
    const panel = document.getElementById('panel').getBoundingClientRect();
    const inside = [...document.querySelectorAll('.toggle .tlbl')].every(l => { const r = l.getBoundingClientRect(); return r.left >= panel.left - 1 && r.right <= panel.right + 1; });
    return { labels: [...document.querySelectorAll('#labels .lbl')].map(l => l.textContent), pressed: [...document.querySelectorAll('[data-insp]')].every(b => b.getAttribute('aria-pressed') === 'true'),
      st: document.querySelector('.insp-status .st').textContent, bad: document.querySelectorAll('.insp-list li.bad').length, okN: document.querySelectorAll('.insp-list li.ok').length,
      tools: JSON.parse(localStorage.getItem('ppapi_progress_demo-uji-0001_simulator')).tools, inside };
  });
  T.ok(fin.pressed && fin.labels.length >= 20, `six overlays toggled with the keyboard (Space), ${fin.labels.length} measured labels`, fin.labels.length);
  T.ok(fin.labels.every(l => /✓/.test(l) && !/✗/.test(l)) && fin.labels.some(l => /top rail 1,000 m/.test(l)) && fin.labels.some(l => /Celah terbesar 0,398 m/.test(l)) && fin.labels.some(l => /Toe board 150 mm/.test(l)),
    'every label carries a measured value and ✓ (top rail 1,000 m · celah 0,398 m · toe board 150 mm)', fin.labels);
  T.ok(/Boleh digunakan/i.test(fin.st) && fin.bad === 0 && fin.okN >= 20, `status "Boleh digunakan", ${fin.okN} items met, 0 not met`, fin);
  T.ok(fin.inside, 'toggle labels stay inside the panel (no .lbl clash)');
  T.ok(['vert', 'horz', 'dist', 'square', 'edge', 'stab'].every(k => fin.tools[k]), 'all six tools recorded in progress', fin.tools);
  await shot(page, 'apl-sim-koreksi-desktop-insp');
  // memory: 40 overlay toggles
  await page.waitForTimeout(300);
  await simDrawn(page);
  const g0 = await page.evaluate(() => ({ g: PPAPISim.renderer.info.memory.geometries, t: PPAPISim.renderer.info.memory.textures, heap: performance.memory ? performance.memory.usedJSHeapSize : 0 }));
  for (let i = 0; i < 48; i++) { await page.click(`[data-insp="${['vert', 'horz', 'dist', 'square', 'edge', 'stab'][i % 6]}"]`); }
  await page.waitForTimeout(400);
  await simDrawn(page);
  const g1 = await page.evaluate(() => ({ g: PPAPISim.renderer.info.memory.geometries, t: PPAPISim.renderer.info.memory.textures }));
  T.ok(g1.g === g0.g && g1.t === g0.t, `overlays: geometries ${g0.g} → ${g1.g}, textures ${g0.t} → ${g1.t} after 48 toggles (each overlay built/disposed 8×)`);
  const heap0 = await page.evaluate(() => performance.memory ? performance.memory.usedJSHeapSize : 0);
  for (let i = 0; i < 8; i++) { for (const k of ['vert', 'horz', 'dist', 'square', 'edge', 'stab']) await page.click(`[data-insp="${k}"]`); }
  await page.waitForTimeout(300);
  await simDrawn(page);
  const g3 = await page.evaluate(() => ({ g: PPAPISim.renderer.info.memory.geometries, labels: document.querySelectorAll('#labels .lbl').length, heap: performance.memory ? performance.memory.usedJSHeapSize : 0 }));
  T.ok(g3.g === g0.g && g3.labels === fin.labels.length, `memory stable: geometries ${g0.g} → ${g3.g}, labels ${fin.labels.length} → ${g3.labels} after 48 more toggles (JS heap ${(heap0 / 1e6).toFixed(1)} → ${(g3.heap / 1e6).toFixed(1)} MB)`);
  // undo/redo cycles at the hint-heavy step 5 (waterpass + diagonals)
  await page.click('#tab-build');
  for (let i = 0; i < 15; i++) await page.click('#undoBtn');
  await page.click('#undoBtn'); await page.waitForTimeout(200); await page.click('#placeBtn'); await page.waitForTimeout(300);   // warm-up: every group/hint rendered once
  await simDrawn(page);
  const h0 = await page.evaluate(() => PPAPISim.renderer.info.memory.geometries);
  for (let i = 0; i < 10; i++) { await page.click('#undoBtn'); await page.waitForTimeout(60); await page.click('#placeBtn'); await page.waitForTimeout(60); }
  await page.waitForTimeout(300);
  await simDrawn(page);
  const h1 = await page.evaluate(() => PPAPISim.renderer.info.memory.geometries);
  T.ok(h1 === h0, `hint objects disposed: geometries ${h0} → ${h1} after 10 undo/place cycles`);
  // render on demand: no frames while idle
  await page.waitForTimeout(600);
  const f0 = await page.evaluate(() => PPAPISim.frames); await page.waitForTimeout(1200);
  const f1 = await page.evaluate(() => PPAPISim.frames);
  T.ok(f1 - f0 === 0, `render-on-demand: ${f1 - f0} frames rendered in 1,2 s idle`);
  const dc = await page.evaluate(() => { PPAPISim.renderer.info.reset && PPAPISim.renderer.info.reset(); return { calls: PPAPISim.renderer.info.render.calls, geos: PPAPISim.renderer.info.memory.geometries, mats: (() => { const s = new Set(); PPAPISim.scene.traverse(o => { if (o.material) s.add(o.material); }); return s.size; })() }; });
  T.ok(dc.mats < 140, `materials shared: ${dc.mats} unique materials in the scene (legacy: 548)`, dc);
  // draw calls with the full tower, with and without a shadow-map refresh (camera-only frames skip the shadow pass)
  for (let i = 0; i < 15; i++) await page.click('#placeBtn').catch(() => {});
  await page.waitForTimeout(400);
  const dc2 = await page.evaluate(async () => {
    const R = PPAPISim.renderer, sm = R.shadowMap; let shadowRuns = 0; const orig = sm.render;
    sm.render = function (...a) { if (sm.enabled && (sm.autoUpdate || sm.needsUpdate)) shadowRuns++; return orig.apply(this, a); };
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    R.info.autoReset = false;
    R.info.reset(); let f0 = PPAPISim.frames, s0 = shadowRuns;
    document.getElementById('workerBtn').click(); await wait(250);
    const sceneChg = { calls: R.info.render.calls, frames: PPAPISim.frames - f0, shadows: shadowRuns - s0 };
    R.info.reset(); f0 = PPAPISim.frames; s0 = shadowRuns;
    document.querySelector('#app-main canvas').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true })); await wait(600);
    const camOnly = { calls: R.info.render.calls, frames: PPAPISim.frames - f0, shadows: shadowRuns - s0 };
    R.info.autoReset = true; sm.render = orig;
    return { sceneChg, camOnly, meshes: (() => { let n = 0; PPAPISim.scene.traverse(o => { if (o.isMesh && o.visible) n++; }); return n; })() };
  });
  T.ok(dc2.sceneChg.shadows >= 1 && dc2.camOnly.frames >= 1 && dc2.camOnly.shadows === 0 && dc2.camOnly.calls / dc2.camOnly.frames < dc2.sceneChg.calls,
    `shadow map refreshed only on scene changes: ${dc2.sceneChg.calls} draw calls for a scene-change frame (with shadow pass), ${Math.round(dc2.camOnly.calls / Math.max(1, dc2.camOnly.frames))} per camera-only frame (shadow pass skipped), 0 when idle`, dc2);
  // camera buttons by keyboard
  const r0 = await page.evaluate(() => PPAPISim.camera.position.toArray());
  await page.focus('#zoomIn'); await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
  await page.focus('#l'); await page.keyboard.press('Space');
  await page.waitForTimeout(500);
  const r1 = await page.evaluate(() => PPAPISim.camera.position.toArray());
  T.ok(r0.some((v, i) => Math.abs(v - r1[i]) > 0.01), 'camera buttons respond to Enter/Space');
  // axe-core on the new panels: step card with references + live inspection result, and the full results list
  const axe = async (label) => {
    if (!(await page.evaluate(() => !!window.axe))) await page.addScriptTag({ url: 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js' });
    const r = await page.evaluate(async () => (await window.axe.run({ include: ['#app-main'] }, { resultTypes: ['violations'] })).violations
      .filter(v => v.impact === 'serious' || v.impact === 'critical').map(v => ({ id: v.id, n: v.nodes.length, t: v.nodes.slice(0, 2).map(n => n.target.join(' ')) })));
    T.ok(r.length === 0, `axe ${label}: 0 serious/critical`, r);
  };
  for (let i = 0; i < 2; i++) await page.click('#undoBtn');      // inspeksi step card (live result + references)
  await axe('build — inspection step card');
  await page.click('#placeBtn'); await page.click('#placeBtn');
  await page.click('#tab-insp');
  for (const k of ['vert', 'edge']) await page.click(`[data-insp="${k}"]`);
  await axe('inspection — measured results list');
  noIssues('inspection desktop', issues);
  await ctx.close();
}

/* ======================================================================
   C. Ponsel: pembingkaian potret, kontrol kamera, notifikasi, overflow
   ====================================================================== */
if (run('C')) {
  T.section('C mobile 390×844: framing, controls, toast, overflow');
  const { ctx, page, issues } = await openSim('mobile');
  await start(page);
  await page.click('#tab-build');
  for (let i = 0; i < 20; i++) await page.click('#placeBtn');
  await page.waitForTimeout(600);
  const fr = await page.evaluate(() => {
    const THREE = window.THREE, cam = PPAPISim.camera, S = PPAPISim.scene;
    const c = document.querySelector('#app-main canvas').getBoundingClientRect();
    const panel = document.getElementById('panel').getBoundingClientRect(), top = document.getElementById('top').getBoundingClientRect();
    const box = new THREE.Box3(); S.traverse(o => { if (o.isMesh && o.userData.role && ['standard', 'board', 'rail-top', 'outrigger', 'ladder-rail'].includes(o.userData.role)) { let p = o, v = true; while (p && p !== S) { if (!p.visible) { v = false; break; } p = p.parent; } if (v) box.expandByObject(o); } });
    const pts = []; [box.min.x, box.max.x].forEach(x => [box.min.y, box.max.y].forEach(y => [box.min.z, box.max.z].forEach(z => pts.push(new THREE.Vector3(x, y, z)))));
    const sp = pts.map(p => { const v = p.clone().project(cam); return { x: c.left + (v.x + 1) / 2 * c.width, y: c.top + (1 - v.y) / 2 * c.height }; });
    const x0 = Math.min(...sp.map(p => p.x)), x1 = Math.max(...sp.map(p => p.x)), y0 = Math.min(...sp.map(p => p.y)), y1 = Math.max(...sp.map(p => p.y));
    const vis = { l: 0, r: innerWidth, t: top.bottom, b: panel.top };
    const ix = Math.max(0, Math.min(x1, vis.r) - Math.max(x0, vis.l)), iy = Math.max(0, Math.min(y1, vis.b) - Math.max(y0, vis.t));
    return { frac: (ix * iy) / ((x1 - x0) * (y1 - y0)), box: [x0, y0, x1, y1].map(Math.round), vis };
  });
  T.ok(fr.frac >= 0.9, `portrait framing: ${(fr.frac * 100).toFixed(0)}% of the tower's screen box is in the visible area above the sheet`, fr);
  await shot(page, 'apl-sim-koreksi-mobile-build');
  await page.click('#camToggle');
  const cover = await page.evaluate(() => ['u', 'l', 'camReset', 'r', 'd', 'zoomIn', 'zoomOut', 'workerBtn', 'laserBtn'].every(id => { const b = document.getElementById(id); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e === b || b.contains(e); }));
  T.ok(cover, 'every camera control reachable (not under the bottom sheet)');
  await page.click('#workerBtn');
  await page.waitForTimeout(250);
  const tc = await page.evaluate(() => {
    const t = document.getElementById('toast'); const cs = getComputedStyle(t);
    const p = (c) => c.match(/[\d.]+/g).map(Number);
    const L = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const fg = L(p(cs.color)), bg = L(p(cs.backgroundColor));
    return { ratio: (Math.max(fg, bg) + 0.05) / (Math.min(fg, bg) + 0.05), role: t.getAttribute('role') };
  });
  T.ok(tc.ratio >= 4.5 && tc.role === 'status', `toast contrast ${tc.ratio.toFixed(1)}:1, role=status`);
  await page.click('#tab-insp');
  const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  T.ok(ov <= 1, 'no horizontal overflow', ov);
  await page.click('#sheetToggle');
  await page.waitForTimeout(300);
  await page.click('[data-insp="edge"]').catch(() => {});
  await page.click('#sheetToggle');
  await shot(page, 'apl-sim-koreksi-mobile-insp');
  noIssues('mobile', issues);
  await ctx.close();
}

/* ======================================================================
   D. Kemajuan: migrasi dari urutan lama, lanjutkan di urutan baru
   ====================================================================== */
if (run('D')) {
  T.section('D progress: legacy progress is reset with a note; new progress resumes');
  const init = () => { try { if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); localStorage.setItem('ppapi_progress_demo-uji-0001_simulator', JSON.stringify({ v: 1, total: 20, current: 12, completedAt: '', updatedAt: '2026-10-08T03:00:00.000Z', tools: { vert: true, evil: '<img>' }, libSeen: ['fix', '<b>'] })); } } catch (e) {} };
  const { ctx, page, issues } = await openSim('desktop', { init });
  const intro = await page.evaluate(() => ({ note: document.getElementById('introResume').textContent, hidden: document.getElementById('introResume').hidden, btn: document.getElementById('startBtn').textContent, restart: document.getElementById('restartBtn').hidden }));
  T.ok(!intro.hidden && /diperbarui/.test(intro.note) && /Mulai Simulasi/.test(intro.btn) && intro.restart, 'old (v1) progress → "urutan diperbarui" note, starts at step 1', intro);
  await start(page);
  await page.click('#tab-build');
  for (let i = 0; i < 4; i++) await page.click('#placeBtn');
  const saved = await page.evaluate((k) => JSON.parse(localStorage.getItem(k)), PKEY);
  T.ok(saved.seq === 'tc-2026.10-r2' && saved.current === 4 && saved.tools.vert === true && !('evil' in saved.tools) && saved.libSeen.every(x => /^[a-z]+$/.test(x)) && !('migrated' in saved), 'new progress saved with sequence version; invalid fields dropped', saved);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'), null, { timeout: 30000 });
  T.ok(/4 dari 20/.test(await txt(page, '#introResume')), 'reload → resume offer at 4/20');
  await page.click('#startBtn');
  await page.waitForFunction(() => window.PPAPISim && PPAPISim.mode === 'build', null, { timeout: 30000 });
  T.ok((await txt(page, '.prog .cnt')) === '4/20' && /Transom dasar/.test(await txt(page, '.stepcard h3')), 'resumed at step 5 (Transom dasar)');
  noIssues('progress', issues);
  await ctx.close();
}

/* ======================================================================
   E. Cadangan: tanpa WebGL, three.js gagal dimuat
   ====================================================================== */
if (run('E')) {
  T.section('E fallbacks');
  {
    const { ctx, page, issues } = await openSim('desktop', { init: () => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/i.test(t) ? null : g.call(this, t, ...a); }; } });
    await page.click('#startBtn');
    await page.waitForSelector('#sim-msg:not([hidden])', { timeout: 30000 });
    T.ok(/WebGL/.test(await txt(page, '#sim-msg')), 'no WebGL → explanatory message');
    noIssues('no-WebGL', issues);
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
    const m = await page.evaluate(() => ({ t: document.getElementById('sim-msg').textContent.replace(/\s+/g, ' '), btn: !document.getElementById('sim-msg-btn').hidden }));
    T.ok(/three\.js/.test(m.t) && m.btn, 'three.js blocked → "Mesin 3D tidak dapat dimuat" + reload button', m);
    await ctx.close();
  }
}

/* ======================================================================
   F. Ponsel lanskap & tablet: tombol tahap terlihat, tanpa overflow
   ====================================================================== */
if (run('F')) {
  for (const [name, extra] of [['landscape 844×390', { viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }], ['tablet 1024×768', { viewport: { width: 1024, height: 768 } }]]) {
    T.section(`F ${name}`);
    const ctx = await newContext(browser, 'desktop', extra);
    await seedSession(ctx, {});
    const page = await ctx.newPage();
    const issues = watch(page);
    await page.goto(SIM, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => document.documentElement.classList.contains('app-gate-ok'), null, { timeout: 30000 });
    const sb = await page.evaluate(() => { const r = document.getElementById('startBtn').getBoundingClientRect(); return r.bottom <= innerHeight && r.top >= 0; });
    T.ok(sb, 'intro: "Mulai Simulasi" visible without scrolling');
    await start(page);
    await page.click('#tab-build');
    for (let i = 0; i < 18; i++) await page.click('#placeBtn');
    const vis = await page.evaluate(() => { const b = document.getElementById('placeBtn'); const r = b.getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return { inView: r.bottom <= innerHeight + 1 && r.top >= 0, hit: e === b || b.contains(e) }; });
    T.ok(vis.inView && vis.hit, 'inspection step: action button visible and not covered', vis);
    await page.click('#placeBtn'); await page.click('#placeBtn');
    T.ok((await txt(page, '.prog .cnt')) === '20/20', '20/20 reached');
    const ov = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    T.ok(ov <= 1, 'no horizontal overflow', ov);
    await page.click('#tab-insp');
    await shot(page, `apl-sim-koreksi-${name.split(' ')[0]}-insp`);
    noIssues(name, issues);
    await ctx.close();
  }
}

await browser.close();
server.close();
process.exit(T.done() ? 1 : 0);
