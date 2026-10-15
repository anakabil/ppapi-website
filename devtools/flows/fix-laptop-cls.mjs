// fixer probe (berita+agenda): base-load CLS at laptop/tablet viewports with web fonts 1.2 s late (reveal-hidden content
// is only invisible with motion allowed, so both motion settings are measured). Usage: node flows/fix-laptop-cls.mjs [urls…]
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
const urls = process.argv.slice(2).filter(a => !a.startsWith('--'));
const URLS = urls.length ? urls : ['agenda.html', 'berita.html', 'berita.html?id=pelatihan-inspeksi-perancah-pipa-klem', 'berita.html?id=situs-resmi-dan-layanan-anggota-daring'];
const INIT = `window.__cls={v:0,e:[]};new PerformanceObserver(l=>{for(const e of l.getEntries()){if(e.hadRecentInput)continue;window.__cls.v+=e.value;window.__cls.e.push(Math.round(e.startTime)+' '+e.value.toFixed(4)+' '+(e.sources||[]).slice(0,3).map(s=>{const n=s.node;return (n&&n.nodeType===1?n.tagName.toLowerCase()+'.'+[...n.classList].slice(0,2).join('.'):'#text')+' dy='+Math.round(s.currentRect.y-s.previousRect.y)+' dh='+Math.round(s.currentRect.height-s.previousRect.height)}).join(' | '))}}).observe({type:'layout-shift',buffered:true});`;
const FC = new Map();
const { BASE, close } = await startServer();
const browser = await chromium.launch();
for (const url of URLS) for (const vp of [[1024, 768], [1280, 720], [1366, 768], [800, 1024]]) {
  const row = [];
  for (const motion of ['no-preference', 'reduce']) {
    const ctx = await browser.newContext({ viewport: { width: vp[0], height: vp[1] }, reducedMotion: motion });
    await ctx.addInitScript(INIT);
    await ctx.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, async route => {
      const u = route.request().url(); let hit = FC.get(u);
      if (!hit) { const r = await fetch(u, { headers: { 'user-agent': route.request().headers()['user-agent'] } }); hit = { s: r.status, b: Buffer.from(await r.arrayBuffer()), t: r.headers.get('content-type') || '' }; FC.set(u, hit); }
      await new Promise(r => setTimeout(r, /gstatic/.test(u) ? 1200 : 60));
      return route.fulfill({ status: hit.s, body: hit.b, headers: { 'content-type': hit.t, 'access-control-allow-origin': '*' } });
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/${url}`, { waitUntil: 'load' }); await page.waitForTimeout(3200);
    const r = await page.evaluate(() => window.__cls);
    row.push(`${motion === 'reduce' ? 'reduce' : 'motion'} ${r.v.toFixed(4)}${r.v > 0.005 ? ' [' + r.e.filter(x => parseFloat(x.split(' ')[1]) > 0.003).join(' ; ') + ']' : ''}`);
    await ctx.close();
  }
  console.log(`${vp.join('x').padEnd(9)} ${url.slice(0, 40).padEnd(40)} ${row.join('  ')}`);
}
await browser.close(); await close();
