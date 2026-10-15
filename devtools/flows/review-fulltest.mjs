// review-fulltest — is the repeated hero in pub-index-desktop-full.png a capture artifact? (review helper)
import { startServer, launch, makeCtx, open, shot } from './review-lib.mjs';
const { BASE, close } = await startServer();
const browser = await launch();
const ctx = await makeCtx(browser, 'desktop');
const page = await open(ctx, BASE, 'index.html');
const h0 = await page.evaluate(() => document.documentElement.scrollHeight);
await shot(page, 'test-index-noscroll-full', { full: true });
await page.evaluate(async () => { const step = Math.round(innerHeight * 0.8); for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); } scrollTo(0, 0); });
await page.waitForTimeout(500);
const h1 = await page.evaluate(() => document.documentElement.scrollHeight);
await shot(page, 'test-index-scrolled-full', { full: true });
await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });
await shot(page, 'test-index-scrolled-nosmooth-full', { full: true });
console.log('scrollHeight before/after scroll:', h0, h1, 'header class:', await page.evaluate(() => document.querySelector('.site-header').className));
await browser.close(); await close();
