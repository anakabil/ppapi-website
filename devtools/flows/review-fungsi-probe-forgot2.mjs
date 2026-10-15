import { startServer, launch, newContext, open } from './review-fungsi-lib.mjs';
const srv = await startServer(); const BASE = srv.BASE; const browser = await launch();
for (const vp of ['desktop', 'mobile']) {
  const ctx = await newContext(browser, { vp }); const page = await ctx.newPage();
  await open(page, `${BASE}/masuk.html`);
  await page.fill('#m-email', 'bukan-email');
  const before = await page.evaluate(() => { const r = document.querySelector('[data-forgot]').getBoundingClientRect(); return { y: r.y, err: window.__rv.txt('#m-email-err') }; });
  await page.evaluate(() => document.getElementById('m-email').blur()); await page.waitForTimeout(150);
  const after = await page.evaluate(() => { const r = document.querySelector('[data-forgot]').getBoundingClientRect(); return { y: r.y, err: window.__rv.txt('#m-email-err') }; });
  console.log(vp, 'forgot link y before blur', before, 'after blur', after, 'shift', after.y - before.y);
  // empty email
  await page.fill('#m-email', ''); await page.evaluate(() => document.getElementById('m-email').blur());
  await page.click('[data-forgot]'); await page.waitForTimeout(400);
  console.log(vp, 'empty email → modal:', await page.evaluate(() => !!document.querySelector('.modal')));
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  // real mouse: invalid email, move to link, mousedown/up
  await page.fill('#m-email', 'bukan-email');
  const r = await page.evaluate(() => { const b = document.querySelector('[data-forgot]').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; });
  await page.mouse.move(r.x, r.y); await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up(); await page.waitForTimeout(400);
  console.log(vp, 'invalid email + real mouse click → modal:', await page.evaluate(() => !!document.querySelector('.modal')), 'err now:', await page.evaluate(() => window.__rv.txt('#m-email-err')));
  // same with keyboard (Tab to link, Enter)
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  await page.fill('#m-email', 'bukan-email'); await page.focus('#m-pass'); await page.keyboard.press('Tab'); await page.keyboard.press('Tab');
  const f = await page.evaluate(() => window.__rv.focused());
  if (/forgot|Lupa/.test(f)) { await page.keyboard.press('Enter'); await page.waitForTimeout(400); console.log(vp, 'keyboard Enter on link → modal:', await page.evaluate(() => !!document.querySelector('.modal'))); } else console.log(vp, 'focus after 2 tabs:', f);
  await ctx.close();
}
await browser.close(); await srv.close();
