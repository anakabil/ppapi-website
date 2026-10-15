// review-fulltest2 — plain Chromium (no swiftshader): index desktop + mobile full page, then slice around 8192.
import { chromium } from 'playwright';
import { startServer, makeCtx, open, shot } from './review-lib.mjs';
const { BASE, close } = await startServer();
const browser = await chromium.launch();
for (const vp of ['desktop', 'mobile']) {
  const ctx = await makeCtx(browser, vp);
  const page = await open(ctx, BASE, 'index.html');
  await shot(page, `test2-index-${vp}-full`, { full: true, scroll: true });
  console.log(vp, 'scrollHeight', await page.evaluate(() => document.documentElement.scrollHeight));
  await ctx.close();
}
await browser.close(); await close();
