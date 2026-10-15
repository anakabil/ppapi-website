// review-masuk — masuk.html states (tabs, email/phone, OTP, forgot modal, errors, complete-profile).
//   node flows/review-masuk.mjs      → shots/review-tampilan/masuk-*.png
import { startServer, launch, makeCtx, open, shot, safe, report, finish } from './review-lib.mjs';

const { BASE, close } = await startServer();
const browser = await launch();

for (const vp of ['desktop', 'mobile', 'laptop', 'tablet']) {
  const ctx = await makeCtx(browser, vp);
  console.log(`\n[${vp}]`);
  await safe(`masuk ${vp}`, async () => {
    const page = await open(ctx, BASE, 'masuk.html');
    await shot(page, `masuk-tab-masuk-${vp}-fold`);
    await shot(page, `masuk-tab-masuk-${vp}-full`, { full: true });
    // errors (empty submit + bad email + wrong password)
    await page.click('[data-form="masuk-email"] button[type="submit"]'); await page.waitForTimeout(400);
    await shot(page, `masuk-errors-empty-${vp}`, { el: '#panel-masuk' });
    await page.fill('#m-email', 'siti.uji@contoh.id'); await page.fill('#m-pass', 'SalahSandi99');
    await page.click('[data-form="masuk-email"] button[type="submit"]');
    await page.waitForSelector('#panel-masuk [data-alert] .alert--err', { timeout: 6000 }).catch(() => {});
    await page.waitForTimeout(400);
    await shot(page, `masuk-errors-wrongpass-${vp}`, { el: '#panel-masuk' });
    // phone → OTP
    await page.click('#panel-masuk [data-method-switch] [data-value="phone"]'); await page.waitForTimeout(300);
    await shot(page, `masuk-phone-${vp}`, { el: '#panel-masuk' });
    await page.fill('#mp-phone', '0812 3456 7890');
    await page.click('#masuk-phone-pane [data-send-otp]');
    await page.waitForSelector('#masuk-phone-pane [data-phone-step="2"]:not([hidden])', { timeout: 6000 });
    await page.waitForTimeout(400);
    await shot(page, `masuk-otp-${vp}`, { el: '#panel-masuk' });
    await shot(page, `masuk-otp-${vp}-fold`);
    // wrong OTP → error
    const boxes = page.locator('#masuk-phone-pane .otp__input');
    for (let i = 0; i < 6; i++) await boxes.nth(i).fill(String(i + 1));
    await page.waitForTimeout(200);
    const verify = page.locator('#masuk-phone-pane [data-verify]');
    if (await verify.count() && await verify.isVisible()) await verify.click();
    await page.waitForTimeout(800);
    await shot(page, `masuk-otp-error-${vp}`, { el: '#panel-masuk' });
    await page.close();
  });
  await safe(`daftar ${vp}`, async () => {
    const page = await open(ctx, BASE, 'masuk.html#daftar');
    await page.click('#tab-daftar'); await page.waitForTimeout(400);
    await shot(page, `masuk-tab-daftar-${vp}-fold`);
    await shot(page, `masuk-tab-daftar-${vp}-full`, { full: true });
    await page.click('[data-form="daftar-email"] button[type="submit"]'); await page.waitForTimeout(400);
    await shot(page, `masuk-daftar-errors-${vp}`, { el: '#panel-daftar' });
    await page.fill('#d-name', 'Budi Santoso'); await page.fill('#d-email', 'budi.uji@contoh.id'); await page.fill('#d-pass', 'perancah1'); await page.waitForTimeout(300);
    await shot(page, `masuk-daftar-strength-weak-${vp}`, { el: '#panel-daftar' });
    await page.fill('#d-pass', 'RahasiaKuat2026'); await page.fill('#d-pass2', 'RahasiaKuat2026'); await page.waitForTimeout(300);
    await shot(page, `masuk-daftar-filled-${vp}`, { el: '#panel-daftar' });
    await page.click('#panel-daftar [data-method-switch] [data-value="phone"]'); await page.waitForTimeout(300);
    await shot(page, `masuk-daftar-phone-${vp}`, { el: '#panel-daftar' });
    await page.close();
  });
  await safe(`forgot ${vp}`, async () => {
    const page = await open(ctx, BASE, 'masuk.html');
    await page.click('[data-forgot]');
    await page.waitForSelector('.modal .modal__title', { timeout: 5000 }); await page.waitForTimeout(400);
    await shot(page, `masuk-forgot-${vp}`);
    await page.fill('#fp-email', 'salah'); await page.click('.modal__footer .btn--primary'); await page.waitForTimeout(400);
    await shot(page, `masuk-forgot-error-${vp}`, { el: '.modal__dialog' });
    await page.fill('#fp-email', 'rahmat.uji@contoh.id'); await page.click('.modal__footer .btn--primary');
    await page.waitForSelector('.modal .auth-sent', { timeout: 5000 }).catch(() => {}); await page.waitForTimeout(400);
    await shot(page, `masuk-forgot-sent-${vp}`, { el: '.modal__dialog' });
    await page.close();
  });
  // complete-profile step after phone sign-up (new number)
  if (vp === 'desktop' || vp === 'mobile') await safe(`complete ${vp}`, async () => {
    const page = await open(ctx, BASE, 'masuk.html');
    await page.click('#panel-masuk [data-method-switch] [data-value="phone"]');
    await page.fill('#mp-phone', '0813 9999 1234');
    await page.click('#masuk-phone-pane [data-send-otp]');
    await page.waitForSelector('#masuk-phone-pane [data-phone-step="2"]:not([hidden])', { timeout: 6000 });
    const boxes = page.locator('#masuk-phone-pane .otp__input');
    for (let i = 0; i < 6; i++) await boxes.nth(i).fill(['1', '2', '3', '4', '5', '6'][i]);
    await page.waitForTimeout(300);
    const verify = page.locator('#masuk-phone-pane [data-verify]');
    if (await verify.count() && await verify.isVisible()) await verify.click();
    await page.waitForSelector('[data-complete]:not([hidden])', { timeout: 8000 });
    await page.waitForTimeout(500);
    await shot(page, `masuk-complete-${vp}-fold`);
    await shot(page, `masuk-complete-${vp}`, { el: '[data-complete]' });
    await page.close();
  });
  // signed-in visitor on masuk (redirect / already signed in state)
  await ctx.close();
}

// motion: first viewport frames
for (const vp of ['desktop', 'mobile']) {
  const ctx = await makeCtx(browser, vp, { motion: true });
  await safe(`masuk motion ${vp}`, async () => {
    const page = await ctx.newPage();
    await page.goto(BASE + '/masuk.html', { waitUntil: 'domcontentloaded' });
    let last = 0;
    for (const t of [200, 700, 1500, 3200]) { await page.waitForTimeout(t - last); last = t; await shot(page, `masuk-motion-${vp}-t${t}`); }
    await page.close();
  });
  await ctx.close();
}

await browser.close(); await close();
finish('review-masuk');
