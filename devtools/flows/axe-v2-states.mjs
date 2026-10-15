// axe-core (WCAG 2.2 A/AA + best practice) on the v2 member-state views that the page flows did not scan:
// dashboard status centre for every non-active status, the active dashboard, the admin dashboard band and
// anggota.html (KTA + Aplikasi tabs), desktop 1440 and phone 390. axe-core 4.10.2 from cdnjs (skipped offline).
// #site-header is excluded (known shared .brand target-size false positive while the header hides on scroll —
// V2_REPORTS "pendaftaran" open issue 1) only when it is scrolled; the first pass includes it.
// Run from devtools/:  node flows/axe-v2-states.mjs
import fs from 'node:fs';
import path from 'node:path';
import { startServer, waitReady, recorder, SHOTS } from './qa-lib.mjs';
import { launch, seedSession } from './aplikasi-lib.mjs';

const R = recorder('axe-v2-states');
const srv = await startServer();
const browser = await launch();
let AXE = '';
try { const r = await fetch('https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js'); if (r.ok) AXE = await r.text(); } catch (e) { /* offline */ }
if (!AXE) { console.log('axe-core unavailable (offline) — skipped'); process.exit(0); }

const STATES = [
  ['Draf', 'dashboard.html'], ['Menunggu Verifikasi', 'dashboard.html'], ['Perlu Perbaikan', 'dashboard.html'], ['Ditolak', 'dashboard.html'],
  ['Nonaktif', 'dashboard.html'], ['Kedaluwarsa', 'dashboard.html'], ['Aktif', 'dashboard.html'], ['admin', 'dashboard.html'],
  ['Aktif', 'anggota.html#kartu'], ['Aktif', 'anggota.html#aplikasi'],
];
const out = [];
for (const vp of ['desktop', 'mobile']) {
  for (const [st, url] of STATES) {
    const ctx = await browser.newContext({ ...(vp === 'mobile' ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : { viewport: { width: 1440, height: 900 } }), reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
    await seedSession(ctx, st === 'admin' ? { admin: true } : { status: st });
    const page = await ctx.newPage();
    await page.goto(`${srv.BASE}/${url}`, { waitUntil: 'networkidle' });
    await waitReady(page);
    await page.waitForTimeout(600);
    await page.addScriptTag({ content: AXE });
    const res = await page.evaluate(async () => {
      const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
      return r.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 4).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join(' ')) }));
    });
    const label = `${vp} ${st} ${url}`;
    R.ok(`axe ${label}: 0 violations`, res.length === 0, res.map(v => `${v.id}(${v.impact}) ${v.nodes.join(' | ')}`).join(' || '));
    out.push({ vp, st, url, violations: res });
    await ctx.close();
  }
}
await browser.close(); await srv.close();
fs.writeFileSync(path.join(SHOTS, 'axe-v2-states.json'), JSON.stringify(out, null, 2));
process.exitCode = R.summary() ? 1 : 0;
