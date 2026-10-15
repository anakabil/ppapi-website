// review-member — dashboard (every status + admin), anggota (tabs, KTA front/back, modals), pustaka (Draf / Aktif / admin).
//   node flows/review-member.mjs      → shots/review-tampilan/{dash,agt,pk}-*.png
import { startServer, launch, makeCtx, open, shot, overflow, safe, report, finish } from './review-lib.mjs';

const { BASE, close } = await startServer();
const browser = await launch();
const STATUSES = ['Aktif', 'Draf', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Ditolak', 'Nonaktif', 'Kedaluwarsa'];
const slug = s => s.toLowerCase().replace(/\s+/g, '-');

/* ---------------- dashboard ---------------- */
for (const vp of ['desktop', 'mobile']) {
  console.log(`\n[dashboard ${vp}]`);
  for (const st of STATUSES) {
    await safe(`dashboard ${st} ${vp}`, async () => {
      const ctx = await makeCtx(browser, vp, { auth: st });
      const page = await open(ctx, BASE, 'dashboard.html', { wait: 1200 });
      if (st === 'Aktif') await shot(page, `dash-aktif-${vp}-fold`);
      await shot(page, `dash-${slug(st)}-${vp}-full`, { full: true, scroll: true });
      const ov = await overflow(page); if (ov > 1) console.log(`  ! dashboard ${st} ${vp}: overflow ${ov}px`);
      report(page, `dashboard ${st} ${vp}`);
      await page.close(); await ctx.close();
    });
  }
  await safe(`dashboard admin ${vp}`, async () => {
    const ctx = await makeCtx(browser, vp, { auth: 'admin' });
    const page = await open(ctx, BASE, 'dashboard.html', { wait: 1200 });
    await shot(page, `dash-admin-${vp}-full`, { full: true, scroll: true });
    report(page, `dashboard admin ${vp}`);
    await page.close(); await ctx.close();
  });
  // renewal reminder (validity within 60 days)
  await safe(`dashboard renew ${vp}`, async () => {
    const { withStatus } = await import('./review-lib.mjs');
    const m = withStatus('Aktif'); m.validUntil = '2026-11-07';
    const ctx = await makeCtx(browser, vp, { auth: 'Aktif', member: m });
    const page = await open(ctx, BASE, 'dashboard.html', { wait: 1200 });
    await shot(page, `dash-renew-${vp}-full`, { full: true, scroll: true });
    await page.close(); await ctx.close();
  });
}
for (const vp of ['laptop', 'tablet']) {
  await safe(`dashboard aktif ${vp}`, async () => {
    const ctx = await makeCtx(browser, vp, { auth: 'Aktif' });
    const page = await open(ctx, BASE, 'dashboard.html', { wait: 1200 });
    await shot(page, `dash-aktif-${vp}-full`, { full: true, scroll: true });
    await page.close(); await ctx.close();
  });
  await safe(`dashboard draf ${vp}`, async () => {
    const ctx = await makeCtx(browser, vp, { auth: 'Draf' });
    const page = await open(ctx, BASE, 'dashboard.html', { wait: 1200 });
    await shot(page, `dash-draf-${vp}-full`, { full: true, scroll: true });
    await page.close(); await ctx.close();
  });
}

/* ---------------- anggota ---------------- */
for (const vp of ['desktop', 'mobile', 'laptop', 'tablet']) {
  console.log(`\n[anggota ${vp}]`);
  await safe(`anggota ${vp}`, async () => {
    const ctx = await makeCtx(browser, vp, { auth: 'Aktif' });
    const page = await open(ctx, BASE, 'anggota.html', { wait: 1200 });
    await page.waitForSelector('body.auth-ready', { timeout: 10000 }).catch(() => {});
    await shot(page, `agt-profil-${vp}-fold`);
    await shot(page, `agt-profil-${vp}-full`, { full: true, scroll: true });
    // dirty state
    await page.fill('#f-bio', 'Supervisor perancah tube & coupler dan sistem ringlock untuk proyek kilang serta gedung bertingkat.').catch(() => {});
    await page.waitForTimeout(300);
    await shot(page, `agt-profil-dirty-${vp}`, { el: '#panel-profil' });
    for (const t of ['kompetensi', 'sertifikat', 'kartu', 'aplikasi']) {
      await page.click('#tab-' + t); await page.waitForTimeout(500);
      await shot(page, `agt-${t}-${vp}-full`, { full: true, scroll: true });
      if (t === 'kartu') {
        await page.waitForFunction(() => { const b = document.querySelector('#kta-qr'); return b && /ready|fallback/.test(b.getAttribute('data-state') || ''); }, null, { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(300);
        await shot(page, `agt-kta-front-${vp}`, { el: '.agt-kta-stage' });
        await page.click('#kta'); await page.waitForTimeout(500);
        await shot(page, `agt-kta-back-${vp}`, { el: '.agt-kta-stage' });
        await shot(page, `agt-kta-back-${vp}-fold`);
        await page.click('#kta'); await page.waitForTimeout(300);
      }
    }
    if (vp === 'desktop' || vp === 'mobile') {
      // modals
      await page.click('#tab-kompetensi'); await page.waitForTimeout(300);
      await page.click('#panel-kompetensi .agt-panel-head [data-action="add-kompetensi"]');
      await page.waitForSelector('.modal #mk-kode', { timeout: 5000 }); await page.waitForTimeout(400);
      await shot(page, `agt-modal-kompetensi-${vp}`);
      const prim = page.locator('.modal .modal__footer .btn--primary').first(); await prim.click(); await page.waitForTimeout(400);
      await shot(page, `agt-modal-kompetensi-errors-${vp}`, { el: '.modal__dialog' });
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      await page.locator('.agt-comp [data-action="delete-kompetensi"]').first().click();
      await page.waitForSelector('.modal .modal__title', { timeout: 5000 }); await page.waitForTimeout(300);
      await shot(page, `agt-modal-confirm-${vp}`);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      await page.click('#tab-sertifikat'); await page.waitForTimeout(300);
      await page.click('#panel-sertifikat .agt-panel-head [data-action="add-sertifikat"]');
      await page.waitForSelector('.modal #mc-title', { timeout: 5000 }); await page.waitForTimeout(400);
      await shot(page, `agt-modal-sertifikat-${vp}`);
      await page.keyboard.press('Escape');
    }
    report(page, `anggota ${vp}`);
    await page.close(); await ctx.close();
  });
}
// anggota: active member with empty competencies/certificates (empty states)
await safe('anggota empty states', async () => {
  const { withStatus } = await import('./review-lib.mjs');
  const m = withStatus('Aktif'); m.competencies = []; m.certificates = []; m.profile.bio = '';
  for (const vp of ['desktop', 'mobile']) {
    const ctx = await makeCtx(browser, vp, { auth: 'Aktif', member: m });
    const page = await open(ctx, BASE, 'anggota.html#kompetensi', { wait: 1200 });
    await page.click('#tab-kompetensi'); await page.waitForTimeout(400);
    await shot(page, `agt-kompetensi-empty-${vp}`, { el: '#panel-kompetensi' });
    await page.click('#tab-sertifikat'); await page.waitForTimeout(400);
    await shot(page, `agt-sertifikat-empty-${vp}`, { el: '#panel-sertifikat' });
    await page.close(); await ctx.close();
  }
});

/* ---------------- pustaka (Draf / Aktif / admin) ---------------- */
for (const vp of ['desktop', 'mobile']) {
  console.log(`\n[pustaka ${vp}]`);
  for (const who of ['Draf', 'Aktif', 'admin']) {
    await safe(`pustaka ${who} ${vp}`, async () => {
      const ctx = await makeCtx(browser, vp, { auth: who });
      const page = await open(ctx, BASE, 'pustaka.html', { wait: 1000 });
      await shot(page, `pk-${slug(who)}-${vp}-full`, { full: true, scroll: true });
      const btn = page.locator('[data-pk-open="d:cop-pemasangan-tube-coupler"]').first();
      if (await btn.count()) {
        await btn.scrollIntoViewIfNeeded(); await btn.click();
        await page.waitForSelector('.modal .modal__dialog', { timeout: 5000 }); await page.waitForTimeout(500);
        await shot(page, `pk-${slug(who)}-modal-${vp}`);
        await page.keyboard.press('Escape');
      }
      if (who === 'Aktif') {
        const pend = page.locator('[data-pk-open="d:pt-perancah-sistem"]').first();
        if (await pend.count()) { await pend.scrollIntoViewIfNeeded(); await pend.click(); await page.waitForSelector('.modal .modal__dialog', { timeout: 5000 }); await page.waitForTimeout(400); await shot(page, `pk-aktif-modal-pending-${vp}`); await page.keyboard.press('Escape'); }
        await page.fill('#pk-q', 'zzzz'); await page.waitForTimeout(600);
        await shot(page, `pk-aktif-empty-${vp}`, { el: '#katalog' });
      }
      report(page, `pustaka ${who} ${vp}`);
      await page.close(); await ctx.close();
    });
  }
}

/* ---------------- verifikasi: signed-in own-KTA shortcut ---------------- */
for (const st of ['Aktif', 'Kedaluwarsa']) {
  await safe(`verifikasi mine ${st}`, async () => {
    const ctx = await makeCtx(browser, 'desktop', { auth: st });
    const page = await open(ctx, BASE, 'verifikasi.html', { wait: 900 });
    await shot(page, `pub-verifikasi-mine-${slug(st)}-desktop`, { el: '.vf-lookup-section' });
    await page.click('[data-vf="mine"] [data-vf-kta]').catch(() => {});
    await page.waitForSelector('.vf-result', { timeout: 6000 }).catch(() => {}); await page.waitForTimeout(400);
    await shot(page, `pub-verifikasi-mine-${slug(st)}-result-desktop`, { el: '.vf-result' });
    await page.close(); await ctx.close();
  });
}

await browser.close(); await close();
finish('review-member');
