// review-public — public pages at desktop 1440 / mobile 390 (+1024 / 768 for grid pages). Run from devtools/:
//   node flows/review-public.mjs
// Output: shots/review-tampilan/pub-*.png
import { startServer, launch, makeCtx, open, shot, overflow, safe, report, finish } from './review-lib.mjs';

const { BASE, close } = await startServer();
const browser = await launch();

const PAGES = ['index', 'profil', 'keanggotaan', 'berita', 'agenda', 'regulasi', 'pustaka', 'verifikasi', 'umpan-balik', 'kebijakan-privasi', 'styleguide'];

for (const vp of ['desktop', 'mobile']) {
  const ctx = await makeCtx(browser, vp);
  console.log(`\n[${vp}]`);
  for (const pg of PAGES) {
    await safe(`${pg} ${vp}`, async () => {
      const page = await open(ctx, BASE, pg + '.html');
      await shot(page, `pub-${pg}-${vp}-fold`);
      await shot(page, `pub-${pg}-${vp}-full`, { full: true, scroll: true });
      const ov = await overflow(page); if (ov > 1) console.log(`  ! ${pg} ${vp}: horizontal overflow ${ov}px`);
      report(page, `${pg} ${vp}`);
      await page.close();
    });
  }
  // berita detail
  await safe(`berita detail ${vp}`, async () => {
    const page = await open(ctx, BASE, 'berita.html?id=memahami-penandaan-perancah');
    await shot(page, `pub-berita-detail-${vp}-fold`);
    await shot(page, `pub-berita-detail-${vp}-full`, { full: true, scroll: true });
    report(page, `berita detail ${vp}`); await page.close();
  });
  await safe(`berita notfound ${vp}`, async () => {
    const page = await open(ctx, BASE, 'berita.html?id=tidak-ada');
    await shot(page, `pub-berita-notfound-${vp}-fold`);
    await page.close();
  });
  await safe(`berita filter/search ${vp}`, async () => {
    const page = await open(ctx, BASE, 'berita.html?kategori=Edukasi&q=perancah');
    await page.waitForTimeout(600);
    await page.locator('#berita-grid').scrollIntoViewIfNeeded();
    await shot(page, `pub-berita-search-${vp}`, { el: '#berita-grid' });
    await page.close();
  });
  // agenda modal + past tab
  await safe(`agenda modal ${vp}`, async () => {
    const page = await open(ctx, BASE, 'agenda.html');
    await page.locator('button[data-agenda-open]').first().scrollIntoViewIfNeeded();
    await page.locator('button[data-agenda-open]').first().click();
    await page.waitForSelector('.modal .agenda-modal', { timeout: 5000 });
    await page.waitForTimeout(400);
    await shot(page, `pub-agenda-modal-${vp}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.click('#agenda-tabs .segmented__option[data-value="telah-berlangsung"]');
    await page.waitForTimeout(500);
    await shot(page, `pub-agenda-past-${vp}-full`, { full: true, scroll: true });
    await page.close();
  });
  await safe(`agenda past modal ${vp}`, async () => {
    const page = await open(ctx, BASE, 'agenda.html?id=webinar-penandaan-perancah-sep-2026');
    await page.waitForSelector('.modal', { timeout: 5000 });
    await page.waitForTimeout(400);
    await shot(page, `pub-agenda-modal-past-${vp}`);
    await page.close();
  });
  await safe(`agenda empty ${vp}`, async () => {
    const page = await open(ctx, BASE, 'agenda.html?tab=akan-datang&jenis=Pelatihan&mode=Daring');
    await page.waitForTimeout(500);
    await shot(page, `pub-agenda-empty-${vp}`, { el: '#agenda-list' });
    await page.close();
  });
  // regulasi search state
  await safe(`regulasi search ${vp}`, async () => {
    const page = await open(ctx, BASE, 'regulasi.html?q=perancah');
    await page.waitForTimeout(500);
    await shot(page, `pub-regulasi-search-${vp}-full`, { full: true, scroll: true });
    await page.close();
  });
  // pustaka signed-out modal (locked) + regulation modal + app modal
  await safe(`pustaka modal out ${vp}`, async () => {
    const page = await open(ctx, BASE, 'pustaka.html');
    const btn = page.locator('[data-pk-open="d:cop-inspeksi-penandaan"]').first();
    await btn.scrollIntoViewIfNeeded(); await btn.click();
    await page.waitForSelector('.modal .modal__dialog', { timeout: 5000 }); await page.waitForTimeout(400);
    await shot(page, `pub-pustaka-modal-locked-${vp}`);
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    const app = page.locator('.pk-app [data-pk-open]').first();
    if (await app.count()) { await app.scrollIntoViewIfNeeded(); await app.click(); await page.waitForSelector('.modal .modal__dialog', { timeout: 5000 }); await page.waitForTimeout(400); await shot(page, `pub-pustaka-modal-app-${vp}`); await page.keyboard.press('Escape'); }
    await page.close();
  });
  await safe(`pustaka list view ${vp}`, async () => {
    const page = await open(ctx, BASE, 'pustaka.html?tampilan=daftar');
    await page.waitForTimeout(400);
    const listBtn = page.locator('[data-pk-view="daftar"], [data-view="daftar"], #pk-view-daftar').first();
    if (await listBtn.count()) { await listBtn.scrollIntoViewIfNeeded(); await listBtn.click(); await page.waitForTimeout(400); }
    await shot(page, `pub-pustaka-list-${vp}-full`, { full: true, scroll: true });
    await page.close();
  });
  // verifikasi states
  await safe(`verifikasi states ${vp}`, async () => {
    let page = await open(ctx, BASE, 'verifikasi.html?kta=PPAPI-2025-000457');
    await page.waitForSelector('.vf-result', { timeout: 8000 }); await page.waitForTimeout(400);
    await shot(page, `pub-verifikasi-found-${vp}-full`, { full: true, scroll: true });
    await shot(page, `pub-verifikasi-found-${vp}-result`, { el: '.vf-result' });
    await page.close();
    page = await open(ctx, BASE, 'verifikasi.html?kta=PPAPI-2023-000089');
    await page.waitForSelector('.vf-result', { timeout: 8000 }); await page.waitForTimeout(400);
    await shot(page, `pub-verifikasi-expired-${vp}-result`, { el: '.vf-result' });
    await page.close();
    page = await open(ctx, BASE, 'verifikasi.html?kta=PPAPI-2026-999999');
    await page.waitForSelector('.vf-result', { timeout: 8000 }); await page.waitForTimeout(400);
    await shot(page, `pub-verifikasi-notfound-${vp}-result`, { el: '.vf-result' });
    await page.close();
    page = await open(ctx, BASE, 'verifikasi.html');
    await page.fill('#vf-q', 'Pratama'); await page.click('.vf-form__btn');
    await page.waitForSelector('.vf-result', { timeout: 8000 }); await page.waitForTimeout(400);
    await shot(page, `pub-verifikasi-list-${vp}-result`, { el: '.vf-result' });
    await page.fill('#vf-q', ''); await page.click('.vf-form__btn'); await page.waitForTimeout(400);
    await shot(page, `pub-verifikasi-error-${vp}`, { el: '.vf-lookup-section' });
    await page.close();
  });
  // umpan balik: errors + success
  await safe(`umpan-balik states ${vp}`, async () => {
    const page = await open(ctx, BASE, 'umpan-balik.html');
    await page.click('[data-ub-submit]'); await page.waitForTimeout(500);
    await shot(page, `pub-umpan-balik-errors-${vp}`, { el: '.ub-card' });
    await page.fill('#ub-nama', 'Budi Santoso'); await page.fill('#ub-email', 'budi@contoh.id'); await page.fill('#ub-phone', '0812 3456 7890');
    await page.click('.ub-seg input[value="Saran"] + .segmented__option').catch(() => {});
    await page.fill('#ub-subjek', 'Saran dasbor anggota'); await page.fill('#ub-pesan', 'Mohon tambahkan pengingat agenda pada dasbor anggota agar jadwal pelatihan tidak terlewat.');
    await page.click('label[for="ub-r4"]');
    if (!(await page.isChecked('#ub-consent'))) await page.click('#ub-consent', { force: true });
    await shot(page, `pub-umpan-balik-filled-${vp}`, { el: '.ub-card' });
    await page.click('[data-ub-submit]');
    await page.waitForSelector('[data-ub-success]:not([hidden])', { timeout: 5000 }); await page.waitForTimeout(500);
    await shot(page, `pub-umpan-balik-success-${vp}`, { el: '.ub-card' });
    await shot(page, `pub-umpan-balik-success-${vp}-fold`);
    await page.close();
  });
  // kebijakan privasi: scrolled (sticky toc) + mobile toc open
  await safe(`kebijakan scrolled ${vp}`, async () => {
    const page = await open(ctx, BASE, 'kebijakan-privasi.html');
    if (vp === 'mobile') { const s = page.locator('.kp-toc-mobile summary'); if (await s.count()) { await s.click(); await page.waitForTimeout(300); await shot(page, `pub-kebijakan-tocopen-mobile`); } }
    await page.evaluate(() => scrollTo(0, 1400)); await page.waitForTimeout(500);
    await shot(page, `pub-kebijakan-scrolled-${vp}`);
    await page.close();
  });
  // 404 nested
  await safe(`404 ${vp}`, async () => {
    const page = await open(ctx, BASE, 'a/b/c');
    await shot(page, `pub-404-${vp}-fold`);
    await shot(page, `pub-404-${vp}-full`, { full: true });
    report(page, `404 ${vp}`); await page.close();
  });
  await ctx.close();
}

// intermediate widths for layouts that change at 1024 / 768
for (const vp of ['laptop', 'tablet']) {
  const ctx = await makeCtx(browser, vp);
  console.log(`\n[${vp}]`);
  for (const pg of ['index', 'profil', 'keanggotaan', 'berita', 'agenda', 'regulasi', 'pustaka', 'verifikasi', 'umpan-balik']) {
    await safe(`${pg} ${vp}`, async () => {
      const page = await open(ctx, BASE, pg + '.html');
      await shot(page, `pub-${pg}-${vp}-full`, { full: true, scroll: true });
      const ov = await overflow(page); if (ov > 1) console.log(`  ! ${pg} ${vp}: horizontal overflow ${ov}px`);
      await page.close();
    });
  }
  await ctx.close();
}

await browser.close(); await close();
finish('review-public');
