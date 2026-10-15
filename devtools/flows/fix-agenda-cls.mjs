// fixer verification (berita+agenda): CLS of agenda deep links + reload-with-scroll-restoration,
// and the post-close behaviour of a deep-linked detail (row focused, in view, highlighted; URL/meta restored).
// Usage (cwd devtools/): node flows/fix-agenda-cls.mjs [--part=cls,reload,close] [--n=2] [--only=regex] [--berita=<id>] [--fonts=fast|slow (reload part)]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'shots', 'fix-agenda');
fs.mkdirSync(OUT, { recursive: true });
const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const parts = (flags.part || 'cls,reload,close').split(',');
const N = +(flags.n || 2);
const INIT = `window.__cls={v:0,e:[]};try{new PerformanceObserver(l=>{for(const e of l.getEntries()){if(e.hadRecentInput)continue;window.__cls.v+=e.value;window.__cls.e.push({t:Math.round(e.startTime),v:+e.value.toFixed(4),s:(e.sources||[]).slice(0,4).map(s=>{const n=s.node;if(!n||n.nodeType!==1)return '#text';let c=n.tagName.toLowerCase();if(n.id)c+='#'+n.id;const k=[...n.classList].slice(0,2).join('.');if(k)c+='.'+k;return c+' dy='+Math.round(s.currentRect.y-s.previousRect.y)+' dh='+Math.round(s.currentRect.height-s.previousRect.height);})})}}).observe({type:'layout-shift',buffered:true})}catch(e){}`;
const FONT_CACHE = new Map();
async function fontRoute(ctx, mode) {
  await ctx.route(/https:\/\/fonts\.(googleapis|gstatic)\.com\//, async route => {
    if (mode === 'blocked') return route.abort();
    const u = route.request().url();
    let hit = FONT_CACHE.get(u);
    if (!hit) { try { const r = await fetch(u, { headers: { 'user-agent': route.request().headers()['user-agent'] } }); hit = { s: r.status, b: Buffer.from(await r.arrayBuffer()), t: r.headers.get('content-type') || '' }; FONT_CACHE.set(u, hit); } catch { return route.abort(); } }
    await new Promise(r => setTimeout(r, mode === 'slow' && /gstatic/.test(u) ? 1200 : 60));
    return route.fulfill({ status: hit.s, body: hit.b, headers: { 'content-type': hit.t, 'access-control-allow-origin': '*' } });
  });
}
const VPS = { desktop: { width: 1440, height: 900 }, laptop: { width: 1366, height: 768 }, tablet: { width: 800, height: 1024 }, mobile: { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 } };
const { BASE, close } = await startServer();
const browser = await chromium.launch();
let worst = 0;
const fmt = r => r.e.filter(e => e.v >= 0.002).map(e => `t${e.t} ${e.v} ${e.s.join(' | ')}`).join('\n        ');

if (parts.includes('cls')) {
  const URLS = ['agenda.html', 'agenda.html?id=pelatihan-inspeksi-tube-coupler-okt-2026', 'agenda.html?id=pelatihan-dasar-perancah-pelaksana-agu-2026', 'agenda.html?id=tidak-ada', 'agenda.html?tab=telah-berlangsung&jenis=Pelatihan',
    'berita.html', 'berita.html?kategori=Kegiatan', 'berita.html?q=perancah', 'berita.html?kategori=Kegiatan#arsip', 'berita.html?id=' + (flags.berita || 'x')];
  const ONLY = flags.only ? new RegExp(flags.only) : null;
  for (const url of URLS.filter(u => !ONLY || ONLY.test(u))) for (const vpn of ['desktop', 'mobile']) {
    const row = [];
    for (const mode of ['fast', 'reduce', 'slow', 'blocked']) {
      for (let i = 0; i < N; i++) {
        const ctx = await browser.newContext({ viewport: { width: VPS[vpn].width, height: VPS[vpn].height }, isMobile: !!VPS[vpn].isMobile, hasTouch: !!VPS[vpn].hasTouch, deviceScaleFactor: VPS[vpn].deviceScaleFactor || 1, reducedMotion: mode === 'reduce' ? 'reduce' : 'no-preference', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
        await ctx.addInitScript(INIT);
        await fontRoute(ctx, mode === 'reduce' ? 'fast' : mode);
        const page = await ctx.newPage();
        if (vpn === 'mobile') { const cdp = await ctx.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); }
        await page.goto(`${BASE}/${url}`, { waitUntil: 'load', timeout: 45000 }).catch(() => {});
        await page.waitForTimeout(3500);
        const r = await page.evaluate(() => window.__cls).catch(() => ({ v: -1, e: [] }));
        worst = Math.max(worst, r.v);
        row.push(`${mode}${N > 1 ? '#' + i : ''} ${r.v.toFixed(4)}`);
        if (r.v >= 0.005) console.log(`    [${vpn}] ${url} ${mode}: ${fmt(r)}`);
        await ctx.close();
      }
    }
    console.log(`[${vpn}] ${url}  ${row.join('  ')}`);
  }
}

if (parts.includes('reload')) {
  // user scrolled to a spot, reloads: browser scroll restoration must land on the same content without shifts
  for (const vpn of ['desktop', 'tablet', 'mobile']) for (const spot of ['#jadwal .agenda-status', '.agenda-month:last-child', '.agenda-cross']) for (const tab of ['', '?tab=telah-berlangsung']) for (const motion of ['no-preference', 'reduce']) {
    const ctx = await browser.newContext({ viewport: { width: VPS[vpn].width, height: VPS[vpn].height }, isMobile: !!VPS[vpn].isMobile, hasTouch: !!VPS[vpn].hasTouch, reducedMotion: motion });
    await ctx.addInitScript(INIT);
    await fontRoute(ctx, flags.fonts || 'fast');
    const page = await ctx.newPage();
    await page.goto(`${BASE}/agenda.html${tab}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const before = await page.evaluate((s) => { const el = document.querySelector(s); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 120); return Math.round(scrollY); }, spot);
    await page.waitForTimeout(400);
    await page.reload({ waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => ({ ...window.__cls, y: Math.round(scrollY) }));
    worst = Math.max(worst, r.v);
    console.log(`[reload ${vpn} ${motion}] agenda.html${tab} @ ${spot}: scrollY ${before} -> ${r.y}  CLS ${r.v.toFixed(4)}${r.v >= 0.005 ? '\n        ' + fmt(r) : ''}`);
    await ctx.close();
  }
  // back navigation (agenda → berita → back), with and without bfcache-defeating reload of history
  for (const vpn of ['desktop', 'mobile']) for (const motion of ['no-preference', 'reduce']) {
    const ctx = await browser.newContext({ viewport: { width: VPS[vpn].width, height: VPS[vpn].height }, isMobile: !!VPS[vpn].isMobile, hasTouch: !!VPS[vpn].hasTouch, reducedMotion: motion });
    await ctx.addInitScript(INIT);
    await fontRoute(ctx, 'fast');
    const page = await ctx.newPage();
    await page.goto(`${BASE}/agenda.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    const before = await page.evaluate(() => { const el = document.querySelector('.agenda-month:last-child'); window.scrollTo(0, el.getBoundingClientRect().top + scrollY - 120); return Math.round(scrollY); });
    await page.waitForTimeout(400);
    await page.goto(`${BASE}/berita.html`, { waitUntil: 'networkidle' });
    await page.goBack({ waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const r = await page.evaluate(() => ({ ...window.__cls, y: Math.round(scrollY), sr: history.scrollRestoration, nav: (performance.getEntriesByType('navigation')[0] || {}).type }));
    worst = Math.max(worst, r.v);
    console.log(`[back ${vpn} ${motion}] agenda.html: scrollY ${before} -> ${r.y} (nav ${r.nav}, scrollRestoration ${r.sr})  CLS ${r.v.toFixed(4)}${r.v >= 0.005 ? '\n        ' + fmt(r) : ''}`);
    // in-page anchor (hero "Lihat jadwal" → #jadwal) then Back must return to the hero (native behaviour kept)
    await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(500);
    await page.click('.agenda-hero a[href="#jadwal"]'); await page.waitForTimeout(1500);
    const yJ = await page.evaluate(() => Math.round(scrollY));
    await page.goBack(); await page.waitForTimeout(1200);
    const yB = await page.evaluate(() => ({ y: Math.round(scrollY), hash: location.hash, sr: history.scrollRestoration }));
    console.log(`[anchor ${vpn} ${motion}] hero → #jadwal y=${yJ} → Back y=${yB.y} hash="${yB.hash}" mode=${yB.sr} ${yB.y < 50 ? 'OK' : 'NOT RESTORED'}`);
    await ctx.close();
  }
}

if (parts.includes('close')) {
  for (const vpn of ['desktop', 'mobile']) for (const motion of ['no-preference', 'reduce']) for (const [id, how] of [['pelatihan-inspeksi-tube-coupler-okt-2026', 'Escape'], ['pelatihan-dasar-perancah-pelaksana-agu-2026', 'button'], ['pelatihan-inspeksi-tube-coupler-okt-2026', 'backdrop']]) {
    const ctx = await browser.newContext({ viewport: { width: VPS[vpn].width, height: VPS[vpn].height }, isMobile: !!VPS[vpn].isMobile, hasTouch: !!VPS[vpn].hasTouch, reducedMotion: motion });
    await ctx.addInitScript(INIT);
    await fontRoute(ctx, 'fast');
    const page = await ctx.newPage();
    await page.goto(`${BASE}/agenda.html?id=${id}`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.agenda-modal-root .modal__dialog', { timeout: 10000 });
    await page.waitForTimeout(700);
    const open = await page.evaluate(() => ({ y: Math.round(scrollY), title: document.title, url: location.search }));
    if (vpn === 'desktop' && motion === 'reduce' && how === 'Escape') await page.screenshot({ path: path.join(OUT, 'deeplink-open.png') });
    if (how === 'Escape') await page.keyboard.press('Escape');
    else if (how === 'button') await page.click('.agenda-modal-root .modal__close');
    else await page.mouse.click(8, VPS[vpn].height - 8);
    await page.waitForTimeout(motion === 'reduce' ? 500 : 1400);
    const after = await page.evaluate((id) => {
      const row = document.getElementById('agenda-' + id); const r = row && row.getBoundingClientRect(); const a = document.activeElement;
      return { y: Math.round(scrollY), modal: !!document.querySelector('.modal'), lock: document.documentElement.classList.contains('modal-open'), rowTop: r && Math.round(r.top), rowBottom: r && Math.round(r.bottom), vh: innerHeight, target: row && row.classList.contains('is-target'), focus: a ? (a.closest('#agenda-' + id) ? 'row:' + a.tagName : a.tagName + '.' + a.className) : null, title: document.title, url: location.search };
    }, id);
    const inView = after.rowTop >= 0 && after.rowBottom <= after.vh;
    if (vpn === 'desktop' && motion === 'reduce' && how === 'Escape') await page.screenshot({ path: path.join(OUT, 'deeplink-closed.png') });
    if (vpn === 'mobile' && motion === 'no-preference' && how === 'button') await page.screenshot({ path: path.join(OUT, 'deeplink-closed-mobile.png') });
    const cls = await page.evaluate(() => window.__cls.v);
    console.log(`[close ${vpn} ${motion} ${how}] ${id}: open y=${open.y} url=${open.url} | after y=${after.y} modal=${after.modal} lock=${after.lock} row ${after.rowTop}..${after.rowBottom}/${after.vh} inView=${inView} target=${after.target} focus=${after.focus} url="${after.url}" title="${after.title}" CLS=${cls.toFixed(4)}`);
    await ctx.close();
  }
}
console.log('WORST CLS', worst.toFixed(4));
await browser.close(); await close();
