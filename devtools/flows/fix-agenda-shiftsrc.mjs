// fixer probe (berita+agenda): full layout-shift sources (x/y/w/h) for one reload-at-spot scenario.
// Usage (cwd devtools/): node flows/fix-agenda-shiftsrc.mjs <w> <h> <spotSelector> [reduce] [path]
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
const [w, hgt, spot, motion, p] = [+process.argv[2] || 800, +process.argv[3] || 1024, process.argv[4] || '#jadwal .agenda-status', process.argv[5] || 'reduce', process.argv[6] || 'agenda.html'];
const INIT = `window.__cls=[];new PerformanceObserver(l=>{for(const e of l.getEntries()){window.__cls.push({t:Math.round(e.startTime),v:+e.value.toFixed(4),inp:e.hadRecentInput,s:(e.sources||[]).map(s=>{const n=s.node;let c=!n?'?':n.nodeType!==1?'#text:'+(n.textContent||'').slice(0,30):n.tagName.toLowerCase()+(n.id?'#'+n.id:'')+([...n.classList].slice(0,2).map(x=>'.'+x).join(''));const a=s.previousRect,b=s.currentRect;return c+' prev('+[a.x,a.y,a.width,a.height].map(Math.round)+') cur('+[b.x,b.y,b.width,b.height].map(Math.round)+')';})})}}).observe({type:'layout-shift',buffered:true});`;
const { BASE, close } = await startServer();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, reducedMotion: motion });
await ctx.addInitScript(INIT);
const page = await ctx.newPage();
await page.goto(`${BASE}/${p}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(800);
await page.evaluate((s) => { const el = document.querySelector(s); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 120); }, spot);
await page.waitForTimeout(400);
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(2500);
console.log(JSON.stringify(await page.evaluate(() => window.__cls), null, 1));
await browser.close(); await close();
