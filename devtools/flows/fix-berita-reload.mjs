// fixer verification (berita+agenda): berita.html reload / back at a scrolled position — CLS + exact position,
// filtered-link scroll not competing with restoration, in-page anchor Back still native.
// Usage (cwd devtools/): node flows/fix-berita-reload.mjs [--fonts=fast|slow]
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const INIT = `window.__cls={v:0,e:[]};try{new PerformanceObserver(l=>{for(const e of l.getEntries()){if(e.hadRecentInput)continue;window.__cls.v+=e.value;window.__cls.e.push({t:Math.round(e.startTime),v:+e.value.toFixed(4),s:(e.sources||[]).slice(0,3).map(s=>{const n=s.node;if(!n||n.nodeType!==1)return '#text';let c=n.tagName.toLowerCase();if(n.id)c+='#'+n.id;const k=[...n.classList].slice(0,2).join('.');if(k)c+='.'+k;return c+' dy='+Math.round(s.currentRect.y-s.previousRect.y)+' dh='+Math.round(s.currentRect.height-s.previousRect.height);})})}}).observe({type:'layout-shift',buffered:true})}catch(e){}`;
const FC = new Map();
async function fontRoute(ctx, mode) {
  await ctx.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, async route => {
    const u = route.request().url(); let hit = FC.get(u);
    if (!hit) { try { const r = await fetch(u, { headers: { 'user-agent': route.request().headers()['user-agent'] } }); hit = { s: r.status, b: Buffer.from(await r.arrayBuffer()), t: r.headers.get('content-type') || '' }; FC.set(u, hit); } catch { return route.abort(); } }
    await new Promise(r => setTimeout(r, mode === 'slow' && /gstatic/.test(u) ? 1200 : 60));
    return route.fulfill({ status: hit.s, body: hit.b, headers: { 'content-type': hit.t, 'access-control-allow-origin': '*' } });
  });
}
const VPS = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844, isMobile: true, hasTouch: true } };
const fmt = r => r.e.filter(e => e.v >= 0.002).map(e => `t${e.t} ${e.v} ${e.s.join(' | ')}`).join('\n        ');
const { BASE, close } = await startServer();
const browser = await chromium.launch();
let worst = 0, bad = 0;
const CASES = [['berita.html', '#arsip'], ['berita.html', '.berita-agenda'], ['berita.html?kategori=Kegiatan', '.berita-agenda'], ['berita.html?id=pelatihan-inspeksi-perancah-pipa-klem', '.berita-article__main']];
for (const vpn of ['desktop', 'mobile']) for (const [url, spot] of CASES) for (const motion of ['no-preference', 'reduce']) {
  for (const how of ['reload', 'back']) {
    const ctx = await browser.newContext({ viewport: { width: VPS[vpn].width, height: VPS[vpn].height }, isMobile: !!VPS[vpn].isMobile, hasTouch: !!VPS[vpn].hasTouch, reducedMotion: motion });
    await ctx.addInitScript(INIT);
    await fontRoute(ctx, flags.fonts || 'fast');
    const page = await ctx.newPage();
    await page.goto(`${BASE}/${url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    const before = await page.evaluate((s) => { const el = document.querySelector(s); window.scrollTo(0, Math.min(el.getBoundingClientRect().top + scrollY + 200, document.documentElement.scrollHeight - innerHeight)); return Math.round(scrollY); }, spot);
    await page.waitForTimeout(450);
    if (how === 'reload') await page.reload({ waitUntil: 'load' });
    else { await page.goto(`${BASE}/agenda.html`, { waitUntil: 'networkidle' }); await page.goBack({ waitUntil: 'load' }); }
    await page.waitForTimeout(3000);
    const r = await page.evaluate(() => ({ ...window.__cls, y: Math.round(scrollY), sr: history.scrollRestoration }));
    worst = Math.max(worst, r.v);
    const okPos = Math.abs(r.y - before) <= 2;
    if (!okPos || r.v > 0.01) bad++;
    console.log(`[${how} ${vpn} ${motion}] ${url} @ ${spot.split(',')[0]}: y ${before} -> ${r.y}${okPos ? '' : ' (POSITION DIFFERS)'}  mode ${r.sr}  CLS ${r.v.toFixed(4)}${r.v >= 0.005 ? '\n        ' + fmt(r) : ''}`);
    await ctx.close();
  }
}
// in-page anchor (hero "Jelajahi arsip" → #arsip) then Back returns to the hero
for (const vpn of ['desktop', 'mobile']) {
  const ctx = await browser.newContext({ viewport: { width: VPS[vpn].width, height: VPS[vpn].height }, isMobile: !!VPS[vpn].isMobile, hasTouch: !!VPS[vpn].hasTouch, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/berita.html`, { waitUntil: 'networkidle' }); await page.waitForTimeout(800);
  await page.click('.berita-hero a[href="#arsip"]'); await page.waitForTimeout(1200);
  const yA = await page.evaluate(() => Math.round(scrollY));
  await page.goBack(); await page.waitForTimeout(1000);
  const yB = await page.evaluate(() => Math.round(scrollY));
  if (yB >= 50) bad++;
  console.log(`[anchor ${vpn}] hero → #arsip y=${yA} → Back y=${yB} ${yB < 50 ? 'OK' : 'NOT RESTORED'}`);
  await ctx.close();
}
console.log('WORST CLS', worst.toFixed(4), bad ? `— ${bad} case(s) need attention` : '— all positions exact');
await browser.close(); await close();
