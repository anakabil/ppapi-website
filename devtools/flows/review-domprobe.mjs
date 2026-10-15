// review-domprobe — list top-level sections of a page with offsets (review helper). node flows/review-domprobe.mjs <page> [--mobile]
import { startServer, launch, makeCtx, open } from './review-lib.mjs';
const [pg] = process.argv.slice(2).filter(a => !a.startsWith('--'));
const { BASE, close } = await startServer();
const browser = await launch();
const ctx = await makeCtx(browser, process.argv.includes('--mobile') ? 'mobile' : 'desktop');
const page = await open(ctx, BASE, (pg || 'index') + '.html');
const info = await page.evaluate(() => {
  const out = { headers: document.querySelectorAll('.site-header').length, h1: document.querySelectorAll('h1').length, docH: document.documentElement.scrollHeight, bodyH: document.body.scrollHeight, mainH: document.querySelector('main')?.getBoundingClientRect().height, footerTop: document.getElementById('site-footer')?.getBoundingClientRect().top + scrollY, footerH: document.getElementById('site-footer')?.getBoundingClientRect().height };
  out.sections = [...document.querySelectorAll('main > section, main > div, body > *')].map(s => { const r = s.getBoundingClientRect(); return `${s.tagName.toLowerCase()}#${s.id || ''}.${[...s.classList].slice(0, 2).join('.')} top=${Math.round(r.top + scrollY)} h=${Math.round(r.height)} :: ${(s.querySelector('h1,h2,h3')?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 50)}`; });
  return out;
});
console.log(JSON.stringify(info, null, 1));
await browser.close(); await close();
