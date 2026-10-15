// Verification of the "shared" group fixes (2026-10-09) that need a browser:
//   A. ui.modal body that overflows → focusable labelled region; axe scrollable-region-focusable gone
//   B. phone: toasts move to the top while a modal/drawer is open (no overlap with the sheet footer)
//   C. touch: ghost-button hover fill is not applied (no sticky "Batal" fill); desktop hover still fills
//   D. screenshots: locked CTA "Daftar Menjadi Anggota" (pustaka, signed out, phone), homepage pillar card
// Run from devtools/:  node flows/shared-fixes-verify.mjs      Screenshots: shots/qa/shared-*.png
import { chromium } from 'playwright';
import path from 'node:path';
import { startServer, SHOTS, seedAuth } from './qa-lib.mjs';

let passed = 0; const failures = [];
const ok = (c, m, x) => { if (c) { passed++; console.log('  ✓ ' + m); } else { failures.push(m); console.log('  ✗ ' + m + (x !== undefined ? '\n      ' + JSON.stringify(x) : '')); } };
let AXE = '';
try { const r = await fetch('https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js'); if (r.ok) AXE = await r.text(); } catch (e) { /* offline */ }
const { BASE, close } = await startServer();
const browser = await chromium.launch();
const shot = (page, name, opts) => page.screenshot(Object.assign({ path: path.join(SHOTS, 'shared-' + name + '.png') }, opts || {}));
try {
  /* A — scrollable modal body (pustaka detail of a document without a file, active member) */
  for (const vp of [{ n: 'laptop', w: 1366, h: 768 }, { n: 'phone', w: 390, h: 844, m: true }]) {
    const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.m, hasTouch: !!vp.m, reducedMotion: 'reduce' });
    await seedAuth(ctx);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/pustaka.html?id=cop-inspeksi-penandaan`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.modal__dialog', { timeout: 10000 });
    await page.waitForTimeout(900);
    const st = await page.evaluate(() => { const b = document.querySelector('.modal__body'); const t = document.querySelector('.modal__title'); return { over: b.scrollHeight - b.clientHeight, tab: b.getAttribute('tabindex'), role: b.getAttribute('role'), label: b.getAttribute('aria-labelledby') === t.id }; });
    ok(st.over > 0 && st.tab === '0' && st.role === 'region' && st.label, `${vp.n}: overflowing modal body is a focusable region labelled by the dialog title`, st);
    if (AXE) {
      await page.addScriptTag({ content: AXE });
      const v = await page.evaluate(async () => (await axe.run(document.querySelector('.modal'), { runOnly: { type: 'rule', values: ['scrollable-region-focusable', 'aria-allowed-role', 'region', 'aria-valid-attr-value'] } })).violations.map(x => x.id + ':' + x.nodes.length));
      ok(!v.length, `${vp.n}: axe — no scrollable-region-focusable / ARIA violations in the dialog`, v);
    } else console.log('  (axe-core not reachable — skipped)');
    await page.focus('.modal__body');
    await page.keyboard.press('PageDown');
    await page.waitForTimeout(200);
    const top = await page.evaluate(() => document.querySelector('.modal__body').scrollTop);
    ok(top > 0, `${vp.n}: Page Down scrolls the focused body`, top);
    await shot(page, 'modal-body-focus-' + vp.n);
    await ctx.close();
  }
  /* A2 — a short dialog stays a plain body (no region noise) */
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => { window.__c = PPAPI.ui.confirm('Hapus konten ini?', { title: 'Konfirmasi', danger: true }); return 1; });
    await page.waitForTimeout(500);
    const st = await page.evaluate(() => { const b = document.querySelector('.modal__body'); return [b.hasAttribute('tabindex'), b.hasAttribute('role')]; });
    ok(!st[0] && !st[1], 'short dialog body: no tabindex/role', st);
    await ctx.close();
  }

  /* B — toast while a bottom sheet is open on a phone */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      PPAPI.ui.modal({ title: 'Pendaftaran disetujui', eyebrow: 'Konsol Admin', body: '<p>Nomor KTA PPAPI-2026-000318 telah diterbitkan dan tercatat pada daftar verifikasi publik.</p>',
        actions: [{ label: 'Salin Nomor KTA', variant: 'ghost', onClick: () => { PPAPI.ui.toast('Nomor KTA disalin.', { type: 'success', timeout: 0 }); return false; } }, { label: 'Selesai', variant: 'primary' }] });
    });
    await page.waitForTimeout(500);
    await page.tap('.modal__footer .btn--ghost');
    await page.evaluate(() => PPAPI.ui.toast('Pendaftaran disetujui. Nomor KTA PPAPI-2026-000318 diterbitkan.', { type: 'success', timeout: 0 }));
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const rect = el => { const b = el.getBoundingClientRect(); return { top: b.top, bottom: b.bottom }; };
      const toasts = [...document.querySelectorAll('.toast')].map(rect);
      const footer = rect(document.querySelector('.modal__footer'));
      return { toasts, footer, overlap: toasts.some(t => t.bottom > footer.top && t.top < footer.bottom) };
    });
    ok(r.toasts.length === 2 && !r.overlap && r.toasts.every(t => t.top < 200), 'phone + open sheet: toasts sit at the top, clear of the footer buttons', r);
    await shot(page, 'toast-over-sheet-phone');
    await page.tap('.modal__footer .btn--primary');
    await page.waitForTimeout(500);
    await page.evaluate(() => PPAPI.ui.toast('Tanpa dialog: notifikasi tetap di bawah.', { timeout: 0 }));
    await page.waitForTimeout(400);
    const bottom = await page.evaluate(() => { const t = [...document.querySelectorAll('.toast')].pop().getBoundingClientRect(); return t.bottom > innerHeight - 120; });
    ok(bottom, 'phone without a dialog: toasts stay at the bottom');
    await ctx.close();
  }

  /* C — sticky hover on touch vs real hover on desktop */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      PPAPI.ui.modal({ title: 'Tolak pengajuan?', body: '<p>Alasan penolakan dikirim kepada pemohon.</p>', initialFocus: 'last',
        actions: [{ label: 'Batal', variant: 'ghost', onClick: () => false }, { label: 'Tolak Pengajuan', variant: 'danger', onClick: () => false }] });
    });
    await page.waitForTimeout(500);
    await page.tap('.modal__footer .btn--ghost');
    await page.waitForTimeout(700);
    const st = await page.evaluate(() => { const b = document.querySelector('.modal__footer .btn--ghost'); return { hoverMq: matchMedia('(hover: hover) and (pointer: fine)').matches, before: getComputedStyle(b, '::before').transform, color: getComputedStyle(b).color }; });
    ok(!st.hoverMq && /matrix\(0,/.test(st.before), 'touch: tapped ghost "Batal" is not filled (no sticky hover)', st);
    await shot(page, 'ghost-tap-phone');
    await ctx.close();
    const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const p2 = await ctx2.newPage();
    await p2.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    await p2.evaluate(() => PPAPI.ui.modal({ title: 'Uji', body: '<p>x</p>', actions: [{ label: 'Batal', variant: 'ghost', onClick: () => false }, { label: 'Lanjut', variant: 'primary', onClick: () => false }] }));
    await p2.waitForTimeout(400);
    await p2.hover('.modal__footer .btn--ghost');
    await p2.waitForTimeout(800);
    const d = await p2.evaluate(() => getComputedStyle(document.querySelector('.modal__footer .btn--ghost'), '::before').transform);
    ok(/matrix\(1,/.test(d), 'desktop mouse: ghost hover fill still animates in', d);
    await ctx2.close();
  }

  /* D — screenshots of changed copy */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/pustaka.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(600);
    const cta = page.locator('a[href="masuk.html?next=pendaftaran.html#daftar"]').first();
    const txt = (await cta.textContent() || '').trim();
    ok(txt === 'Daftar Menjadi Anggota', 'locked panel CTA reads "Daftar Menjadi Anggota"', txt);
    await cta.scrollIntoViewIfNeeded();
    const box = await cta.boundingBox();
    ok(box && box.x >= 0 && box.x + box.width <= 390, 'CTA fits the phone width', box);
    await shot(page, 'locked-cta-phone');
    await ctx.close();
    const c2 = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
    const p2 = await c2.newPage();
    await p2.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    const card = p2.locator('text=Aplikasi Anggota').first();
    await card.scrollIntoViewIfNeeded();
    await p2.waitForTimeout(500);
    const pillar = await p2.evaluate(() => [...document.querySelectorAll('h3, .h4, p')].filter(e => /PPAPI Scaffold untuk perencanaan/.test(e.textContent)).length);
    ok(pillar >= 1, 'homepage pillar: "Aplikasi Anggota" text matches the two apps', pillar);
    await shot(p2, 'pillar-desktop');
    await c2.close();
  }
} finally {
  await browser.close();
  await close();
}
console.log(`\n${passed} passed, ${failures.length} failed.`);
if (failures.length) process.exitCode = 1;
