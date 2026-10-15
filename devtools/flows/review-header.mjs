// review-header — header states (overlay / solid / hidden), mobile menu, account menu, toasts, ribbon,
// focus-visible rings, motion frames of index.   node flows/review-header.mjs → shots/review-tampilan/hdr-*.png
import { startServer, launch, makeCtx, open, shot, safe, finish } from './review-lib.mjs';

const { BASE, close } = await startServer();
const browser = await launch();
const W = { desktop: 1440, mobile: 390, laptop: 1024, tablet: 768 };

for (const vp of ['desktop', 'mobile', 'laptop', 'tablet']) {
  console.log(`\n[${vp}]`);
  await safe(`header states ${vp}`, async () => {
    const ctx = await makeCtx(browser, vp);
    const page = await open(ctx, BASE, 'index.html');
    const clip = { x: 0, y: 0, width: W[vp], height: 160 };
    await shot(page, `hdr-overlay-${vp}`, { clip });
    await page.evaluate(() => scrollTo(0, 320)); await page.waitForTimeout(500);
    await shot(page, `hdr-solid-${vp}`, { clip });
    await shot(page, `hdr-solid-${vp}-fold`);
    await page.evaluate(() => scrollTo(0, 700)); await page.waitForTimeout(150);
    await page.evaluate(() => scrollTo(0, 1100)); await page.waitForTimeout(600);
    await shot(page, `hdr-hidden-${vp}`, { clip });
    await page.evaluate(() => scrollTo(0, 900)); await page.waitForTimeout(600);
    await shot(page, `hdr-reappear-${vp}`, { clip });
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(400);
    // mobile menu
    const tg = page.locator('.menu-toggle');
    if (await tg.isVisible()) { await tg.click(); await page.waitForTimeout(600); await shot(page, `hdr-menu-open-${vp}`); await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
    // ribbon dismissed
    const rc = page.locator('[data-ribbon-close]');
    if (await rc.isVisible()) { await rc.click(); await page.waitForTimeout(400); await shot(page, `hdr-ribbon-dismissed-${vp}`, { clip }); }
    await page.close(); await ctx.close();
  });
  // signed in: account menu (desktop) / account in mobile menu
  await safe(`account ${vp}`, async () => {
    const ctx = await makeCtx(browser, vp, { auth: 'Aktif' });
    const page = await open(ctx, BASE, 'index.html');
    const trig = page.locator('.account__trigger');
    if (await trig.isVisible()) { await trig.click(); await page.waitForTimeout(400); await shot(page, `hdr-account-open-${vp}`, { clip: { x: 0, y: 0, width: W[vp], height: 480 } }); await page.keyboard.press('Escape'); }
    const tg = page.locator('.menu-toggle');
    if (await tg.isVisible()) { await tg.click(); await page.waitForTimeout(600); await shot(page, `hdr-menu-open-auth-${vp}`); await page.keyboard.press('Escape'); }
    // header over a light page (berita) solid state
    await page.goto(BASE + '/berita.html', { waitUntil: 'networkidle' }); await page.waitForTimeout(600);
    await shot(page, `hdr-auth-berita-${vp}`, { clip: { x: 0, y: 0, width: W[vp], height: 160 } });
    await page.close(); await ctx.close();
  });
  // Draf / admin account menus (status badges)
  if (vp === 'desktop') for (const who of ['Draf', 'Kedaluwarsa', 'admin']) await safe(`account ${who}`, async () => {
    const ctx = await makeCtx(browser, vp, { auth: who });
    const page = await open(ctx, BASE, 'index.html');
    await page.locator('.account__trigger').click(); await page.waitForTimeout(400);
    await shot(page, `hdr-account-open-${who.toLowerCase()}-${vp}`, { clip: { x: 0, y: 0, width: W[vp], height: 480 } });
    await page.close(); await ctx.close();
  });
}

// toasts
for (const vp of ['desktop', 'mobile']) {
  await safe(`toasts ${vp}`, async () => {
    const ctx = await makeCtx(browser, vp);
    const page = await open(ctx, BASE, 'berita.html');
    await page.evaluate(() => { PPAPI.ui.toast('Perubahan berhasil disimpan.', { type: 'success' }); PPAPI.ui.toast('Gagal menyimpan. Periksa koneksi Anda, lalu coba lagi.', { type: 'error' }); PPAPI.ui.toast('Kode OTP telah dikirim ke nomor Anda.', { type: 'info' }); });
    await page.waitForTimeout(700);
    await shot(page, `hdr-toasts-${vp}`);
    await page.close(); await ctx.close();
  });
}

// focus-visible rings
for (const vp of ['desktop', 'mobile']) {
  await safe(`focus ${vp}`, async () => {
    const ctx = await makeCtx(browser, vp);
    let page = await open(ctx, BASE, 'index.html');
    await page.keyboard.press('Tab'); await page.waitForTimeout(300);
    await shot(page, `focus-skiplink-${vp}`, { clip: { x: 0, y: 0, width: W[vp], height: 200 } });
    for (let i = 0; i < (vp === 'desktop' ? 3 : 2); i++) await page.keyboard.press('Tab');
    await page.waitForTimeout(300);
    await shot(page, `focus-header-${vp}`, { clip: { x: 0, y: 0, width: W[vp], height: 200 } });
    // focus a primary button in the hero + a card title later in the page
    await page.evaluate(() => { const b = document.querySelector('main .btn--primary'); if (b) b.focus(); });
    await page.waitForTimeout(200);
    await shot(page, `focus-hero-btn-${vp}`);
    await page.evaluate(() => { const a = document.querySelector('.news-card__title a, .card__title a'); if (a) { a.scrollIntoView({ block: 'center' }); a.focus(); } });
    await page.waitForTimeout(300);
    await shot(page, `focus-card-${vp}`);
    await page.close();
    page = await open(ctx, BASE, 'masuk.html');
    await page.focus('#m-email'); await page.waitForTimeout(200);
    await shot(page, `focus-field-${vp}`, { el: '#panel-masuk' });
    await page.evaluate(() => { const b = document.querySelector('#panel-masuk .btn-google'); if (b) b.focus(); });
    await page.waitForTimeout(200);
    await shot(page, `focus-google-${vp}`, { el: '#panel-masuk' });
    await page.evaluate(() => { const b = document.querySelector('[data-form="masuk-email"] button[type="submit"]'); if (b) b.focus(); });
    await page.waitForTimeout(200);
    await shot(page, `focus-primary-dark-${vp}`, { el: '#panel-masuk' });
    await page.evaluate(() => { const b = document.querySelector('#tab-daftar'); if (b) b.focus(); });
    await page.waitForTimeout(200);
    await shot(page, `focus-tab-${vp}`, { el: '.auth-card, #panel-masuk' });
    await page.close();
    page = await open(ctx, BASE, 'umpan-balik.html');
    await page.evaluate(() => { const b = document.querySelector('label[for="ub-r4"]'); if (b) b.scrollIntoView({ block: 'center' }); document.getElementById('ub-r4').focus(); });
    await page.waitForTimeout(200);
    await shot(page, `focus-rating-${vp}`, { el: '.rating' });
    await page.evaluate(() => { const b = document.querySelector('.ub-seg input'); if (b) b.focus(); });
    await page.waitForTimeout(200);
    await shot(page, `focus-segmented-${vp}`, { el: '.ub-seg' });
    await page.evaluate(() => { document.getElementById('ub-consent').scrollIntoView({ block: 'center' }); document.getElementById('ub-consent').focus(); });
    await page.waitForTimeout(200);
    await shot(page, `focus-check-${vp}`, { el: 'label[for="ub-consent"], .check:has(#ub-consent)' });
    await page.close();
    await ctx.close();
  });
}

// hover states (desktop only)
await safe('hover', async () => {
  const ctx = await makeCtx(browser, 'desktop');
  const page = await open(ctx, BASE, 'index.html');
  await page.hover('.site-header .nav__link, .site-header nav a >> nth=1').catch(() => {});
  await page.waitForTimeout(500);
  await shot(page, 'hover-nav-desktop', { clip: { x: 0, y: 0, width: 1440, height: 160 } });
  const btn = page.locator('main .btn--primary').first(); await btn.hover(); await page.waitForTimeout(500);
  await shot(page, 'hover-btn-primary-desktop', { el: 'main .page-hero__actions, main .hero__actions, main .btn--primary' });
  const card = page.locator('.news-card, .card--hover').first(); await card.scrollIntoViewIfNeeded(); await card.hover(); await page.waitForTimeout(900);
  await shot(page, 'hover-card-desktop', { el: '.news-card, .card--hover' });
  await page.close(); await ctx.close();
});

// motion frames: index first viewport
for (const vp of ['desktop', 'mobile']) {
  const ctx = await makeCtx(browser, vp, { motion: true });
  await safe(`index motion ${vp}`, async () => {
    const page = await ctx.newPage();
    await page.goto(BASE + '/index.html', { waitUntil: 'domcontentloaded' });
    let last = 0;
    for (const t of [250, 700, 1400, 2600, 4500]) { await page.waitForTimeout(t - last); last = t; await shot(page, `motion-index-${vp}-t${t}`); }
    // scroll reveal mid-state
    await page.evaluate(() => scrollTo(0, Math.round(innerHeight * 0.9)));
    await page.waitForTimeout(150); await shot(page, `motion-index-${vp}-reveal-150ms`);
    await page.waitForTimeout(900); await shot(page, `motion-index-${vp}-reveal-1s`);
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(800);
    await page.evaluate(async () => { const step = Math.round(innerHeight * 0.8); for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 260)); } scrollTo(0, 0); });
    await page.waitForTimeout(2500);
    await shot(page, `motion-index-${vp}-full-after`, { full: true });
    await page.close();
  });
  await safe(`dashboard motion ${vp}`, async () => {
    const c2 = await makeCtx(browser, vp, { motion: true, auth: 'Aktif' });
    const page = await c2.newPage();
    await page.goto(BASE + '/dashboard.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600); await shot(page, `motion-dash-${vp}-t600`);
    await page.waitForTimeout(2200); await shot(page, `motion-dash-${vp}-t2800`);
    await page.close(); await c2.close();
  });
  await safe(`kta flip motion ${vp}`, async () => {
    const c3 = await makeCtx(browser, vp, { motion: true, auth: 'Aktif' });
    const page = await c3.newPage();
    await page.goto(BASE + '/anggota.html#kartu', { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);
    await page.click('#tab-kartu').catch(() => {}); await page.waitForTimeout(800);
    await page.locator('.agt-kta-stage').scrollIntoViewIfNeeded();
    await page.click('#kta');
    await page.waitForTimeout(220); await shot(page, `motion-kta-${vp}-mid`, { el: '.agt-kta-stage' });
    await page.waitForTimeout(1200); await shot(page, `motion-kta-${vp}-end`, { el: '.agt-kta-stage' });
    await page.close(); await c3.close();
  });
  await ctx.close();
}

await browser.close(); await close();
finish('review-header');
