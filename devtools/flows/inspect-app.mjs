// Inspect the client's external app (https://ppapiid.vercel.app/) — read-only exploration.
// Usage: node flows/inspect-app.mjs  (cwd = devtools)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.resolve(__dirname, '..', 'shots');
const OUT = path.resolve(__dirname, '..', 'research', 'app-inspect.json');
fs.mkdirSync(SHOTS, { recursive: true });
const URL0 = process.argv[2] || 'https://ppapiid.vercel.app/';

const result = { start: URL0, pages: [], network: [], consoleErrors: [], clicks: [] };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') result.consoleErrors.push(m.text().slice(0, 300)); });
page.on('request', r => {
  const u = r.url();
  if (!/\.(png|jpe?g|webp|svg|woff2?|ttf|ico|gif)(\?|$)/i.test(u)) result.network.push(r.method() + ' ' + u.slice(0, 200));
});

async function snapshot(tag) {
  const data = await page.evaluate(() => {
    const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const txt = el => (el.innerText || el.textContent || el.getAttribute('aria-label') || el.title || '').trim().replace(/\s+/g, ' ').slice(0, 80);
    return {
      url: location.href,
      title: document.title,
      metaDesc: document.querySelector('meta[name=description]')?.content || '',
      h: [...document.querySelectorAll('h1,h2,h3')].filter(vis).map(e => e.tagName + ': ' + txt(e)).slice(0, 40),
      anchors: [...document.querySelectorAll('a[href]')].map(a => ({ text: txt(a), href: a.getAttribute('href') })).slice(0, 80),
      buttons: [...document.querySelectorAll('button,[role=tab],[role=button],[role=menuitem]')].filter(vis).map(b => txt(b)).filter(Boolean).slice(0, 80),
      inputs: [...document.querySelectorAll('input,select,textarea')].filter(vis).map(i => ({ type: i.type, name: i.name || i.id, ph: i.placeholder || '', label: i.labels?.[0]?.innerText?.trim()?.slice(0, 60) || '' })).slice(0, 60),
      canvas: document.querySelectorAll('canvas').length,
      text: document.body.innerText.replace(/\n{2,}/g, '\n').slice(0, 4000),
      bodyBg: getComputedStyle(document.body).backgroundColor,
      fonts: [...new Set([...document.querySelectorAll('body, h1, h2, button, p')].map(e => getComputedStyle(e).fontFamily))].slice(0, 6),
    };
  });
  const file = path.join(SHOTS, `app-${tag}.png`);
  await page.screenshot({ path: file });
  data.shot = file;
  data.tag = tag;
  result.pages.push(data);
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
  return data;
}

await page.goto(URL0, { waitUntil: 'networkidle', timeout: 60000 }).catch(e => result.consoleErrors.push('goto: ' + e.message));
await page.waitForTimeout(2500);
const home = await snapshot('home');
await page.screenshot({ path: path.join(SHOTS, 'app-home-full.png'), fullPage: true });

// Click through visible nav-ish controls (buttons / tabs / internal links) one at a time, returning to start.
const candidates = [...new Set([...home.buttons, ...home.anchors.filter(a => a.href && !/^https?:\/\//.test(a.href) || (a.href || '').includes('ppapiid')).map(a => a.text)])]
  .filter(t => t && t.length < 60 && !/keluar|logout|hapus|delete|reset|kirim|submit|simpan|save|download|unduh|print|cetak/i.test(t))
  .slice(0, 18);
result.candidates = candidates;
let i = 0;
for (const label of candidates) {
  i++;
  try {
    const loc = page.getByText(label, { exact: true }).first();
    if (!(await loc.isVisible({ timeout: 1500 }).catch(() => false))) { result.clicks.push({ label, skipped: 'not visible' }); continue; }
    const before = page.url();
    await loc.click({ timeout: 4000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const tag = 'c' + String(i).padStart(2, '0') + '-' + label.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    const snap = await snapshot(tag);
    result.clicks.push({ label, from: before, to: snap.url, tag });
    if (!page.url().startsWith('https://ppapiid.vercel.app')) {
      await page.goto(URL0, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
      await page.waitForTimeout(1500);
    }
  } catch (e) {
    result.clicks.push({ label, error: e.message.slice(0, 200) });
  }
}

// Mobile view of the start page
const m = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });
const mp = await m.newPage();
await mp.goto(URL0, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
await mp.waitForTimeout(2000);
await mp.screenshot({ path: path.join(SHOTS, 'app-home-mobile.png') });

result.network = [...new Set(result.network)].slice(0, 120);
fs.writeFileSync(OUT, JSON.stringify(result, null, 2));
await browser.close();
console.log(JSON.stringify({ pages: result.pages.map(p => ({ tag: p.tag, url: p.url, title: p.title, h: p.h.slice(0, 8), buttons: p.buttons.slice(0, 30), canvas: p.canvas })), clicks: result.clicks, consoleErrors: result.consoleErrors.slice(0, 10) }, null, 1));
