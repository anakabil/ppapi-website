// repeat a single-page CLS measurement N times (review only). usage: node flows/v2lens-cls-repeat.mjs <url> [n] [--mobile]
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
const url = process.argv[2]; const n = +(process.argv[3] || 6); const mobile = process.argv.includes('--mobile');
const INIT = `window.__cls={v:0,e:[]};try{new PerformanceObserver(l=>{for(const e of l.getEntries()){if(e.hadRecentInput)continue;window.__cls.v+=e.value;window.__cls.e.push({t:Math.round(e.startTime),v:+e.value.toFixed(4),s:(e.sources||[]).slice(0,5).map(s=>{const n=s.node;if(!n||n.nodeType!==1)return '#text';let c=n.tagName.toLowerCase();if(n.id)c+='#'+n.id;const k=[...n.classList].slice(0,2).join('.');if(k)c+='.'+k;return c+' dy='+Math.round(s.currentRect.y-s.previousRect.y)+' dh='+Math.round(s.currentRect.height-s.previousRect.height);})})}}).observe({type:'layout-shift',buffered:true})}catch(e){}`;
const { BASE, close } = await startServer();
const browser = await chromium.launch();
for (let i = 0; i < n; i++) {
  for (const motion of ['no-preference', 'reduce']) {
    const ctx = await browser.newContext(mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, reducedMotion: motion } : { viewport: { width: 1440, height: 900 }, reducedMotion: motion });
    await ctx.addInitScript(INIT);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/${url}`, { waitUntil: i % 2 ? 'load' : 'networkidle' });
    await page.waitForTimeout(3000);
    const r = await page.evaluate(() => window.__cls);
    console.log(i, motion, r.v.toFixed(4), r.e.filter(e => e.v > 0.003).map(e => `t${e.t} ${e.v} ${e.s.join(' | ')}`).join(' || '));
    await ctx.close();
  }
}
await browser.close(); await close();
