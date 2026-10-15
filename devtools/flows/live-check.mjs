import { chromium } from 'playwright';
const BASE = 'https://anakabil.github.io/ppapi-website/';
const pages = ['', 'masuk.html', 'pustaka.html', 'profil.html', 'regulasi.html', 'a/b/halaman-tidak-ada', 'dashboard.html'];
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' });
let bad = 0;
for (const p of pages) {
  const page = await ctx.newPage(); const issues = [];
  page.on('pageerror', e => issues.push('pageerror ' + e.message));
  page.on('console', m => { if (m.type() === 'error') issues.push('console ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().includes(p || '§') && !r.url().endsWith('favicon.ico')) issues.push('HTTP ' + r.status() + ' ' + r.url()); });
  await page.goto(BASE + p, { waitUntil: 'networkidle' }).catch(e => issues.push('goto ' + e.message));
  await page.waitForTimeout(800);
  const t = await page.title();
  await page.screenshot({ path: `shots/live-${(p || 'index').replace(/[\/.]/g, '_')}.png` });
  console.log(`${p || '/'} -> ${page.url().replace(BASE, '/')} | ${t}${issues.length ? '\n  ! ' + issues.join('\n  ! ') : ''}`);
  bad += issues.filter(i => !i.includes('halaman-tidak-ada')).length;
  await page.close();
}
await b.close(); console.log('issues:', bad);
