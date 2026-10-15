// PPAPI — CLS probe (review only). Fresh browser per run; web fonts normal / delayed / blocked; optional --auth.
//   node flows/cls-probe.mjs <page> ... [--delay=900] [--auth] [--motion]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
let pages = args.filter(a => !a.startsWith('--'));
if (!pages.length || pages.includes('all')) pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !f.startsWith('__')).map(f => f.replace(/\.html$/, ''));
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'content-type': MIME['.html'] }); return res.end(fs.readFileSync(path.join(ROOT, '404.html'))); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const DELAY = Number(flags.delay || 900);
const INIT = `window.__cls={v:0,e:[]};try{new PerformanceObserver(l=>{for(const e of l.getEntries()){if(e.hadRecentInput)continue;window.__cls.v+=e.value;window.__cls.e.push({t:Math.round(e.startTime),v:+e.value.toFixed(4),s:(e.sources||[]).slice(0,3).map(s=>{const n=s.node;if(!n||n.nodeType!==1)return '#text';let c=n.tagName.toLowerCase();if(n.id)c+='#'+n.id;const k=[...n.classList].slice(0,2).join('.');if(k)c+='.'+k;return c+' dy='+Math.round(s.currentRect.y-s.previousRect.y)+' dh='+Math.round(s.currentRect.height-s.previousRect.height)+' dx='+Math.round(s.currentRect.x-s.previousRect.x);})})}}).observe({type:'layout-shift',buffered:true})}catch(e){}`;
const VPS = [{ name: 'desktop', width: 1440, height: 900 }, { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, dpr: 2 }];
const modes = (flags.modes || 'normal,delayed,blocked').split(',');
for (const pg of pages) {
  for (const vp of VPS) {
    const row = [];
    for (const mode of modes) {
      const browser = await chromium.launch();
      const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: vp.dpr || 1, reducedMotion: flags.motion ? 'no-preference' : 'reduce', locale: 'id-ID' });
      await ctx.addInitScript(INIT);
      if (flags.auth) await ctx.addInitScript(() => { try { const u = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' }; localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); } catch (e) {} });
      if (mode === 'delayed') await ctx.route(/fonts\.gstatic\.com/, async r => { await new Promise(x => setTimeout(x, DELAY)); await r.continue(); });
      if (mode === 'blocked' || mode === 'slowjs') await ctx.route(/fonts\.(gstatic|googleapis)\.com/, r => r.abort());
      if (mode === 'slowjs') await ctx.route(/\/assets\/(js|data)\/.*\.js/, async r => { await new Promise(x => setTimeout(x, 700)); await r.continue(); });
      const page = await ctx.newPage();
      await page.goto(`${BASE}/${pg}.html`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(DELAY + 800);
      const c = await page.evaluate(() => window.__cls);
      row.push({ mode, v: c.v, e: c.e });
      await browser.close();
    }
    console.log(`\n${pg} @${vp.name}: ` + row.map(r => `${r.mode}=${r.v.toFixed(3)}`).join('  '));
    if (flags.verbose) for (const r of row) for (const e of r.e.filter(e => e.v >= 0.005)) console.log(`   ${r.mode} t=${e.t} v=${e.v} ${e.s.join(' ; ')}`);
  }
}
server.close();
