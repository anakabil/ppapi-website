import { chromium } from 'playwright';
const BASE = 'https://anakabil.github.io/ppapi-website/';
const b = await chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
for (const p of ['masuk.html', 'index.html']) {
  const page = await ctx.newPage(); const issues = [];
  page.on('pageerror', e => issues.push('pageerror ' + e.message));
  page.on('console', m => { if (m.type() === 'error') issues.push('console ' + m.text().slice(0, 200)); });
  page.on('requestfailed', r => { const e = r.failure()?.errorText || ''; if (e !== 'net::ERR_ABORTED') issues.push('reqfail ' + r.url().slice(0, 120) + ' ' + e); });
  await page.goto(BASE + p, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
  const st = await page.evaluate(() => ({ mode: PPAPI.auth.mode, sdk: typeof firebase !== 'undefined' && firebase.SDK_VERSION, ribbon: !document.querySelector('[data-demo-ribbon]')?.hidden ? 'shown' : 'hidden', demoNote: !!document.querySelector('[data-demo-note], .demo-note') }));
  console.log(p, JSON.stringify(st), issues.length ? '\n  ! ' + issues.join('\n  ! ') : ' ok');
  await page.close();
}
await b.close();
