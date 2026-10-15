// PPAPI — pixel-sampled text contrast (review only).
// axe-core marks text over photos / gradients / translucent layers as "incomplete". This script renders the page with all
// text made transparent, captures it viewport by viewport, and for every visible text element samples the real pixels behind
// its box. It reports the contrast at the 90th-percentile worst background pixel (and the median), blending the text colour
// with its effective opacity.
//
//   node flows/contrast-sample.mjs <page[?q]> ... [--auth] [--mobile|--desktop] [--min=4.5] [--all]
//   (--all also lists passing elements that sit on images/gradients)
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
const MIN = Number(flags.min || 4.5);

const DEMO_USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const DEMO_MEMBER = { uid: DEMO_USER.uid, name: DEMO_USER.name, email: DEMO_USER.email, phone: DEMO_USER.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14',
  profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Contoh Konstruksi', position: 'Scaffolding Supervisor', experienceYears: 9, education: 'D3 Teknik Sipil', bio: 'Supervisor perancah.' },
  competencies: [{ id: 'k1', code: 'SCF-SUP', name: 'Supervisor Perancah', level: 'Mahir', since: 2019, notes: '' }],
  certificates: [{ id: 'c1', title: 'Teknisi Perancah', number: 'CONTOH/001/2024', issuer: 'Kemnaker RI', issuedAt: '2024-02-10', expiresAt: '2027-02-10', link: '' },
    { id: 'c2', title: 'Ahli K3 Umum', number: 'CONTOH/002/2021', issuer: 'Kemnaker RI', issuedAt: '2021-11-02', expiresAt: '2026-11-20', link: '' }], updatedAt: '2026-09-30T08:00:00.000Z' };

const viewports = [];
if (!flags.mobile) viewports.push({ name: 'desktop', width: 1440, height: 900, dpr: 1 });
if (!flags.desktop) viewports.push({ name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, dpr: 1 });

const browser = await chromium.launch();
for (const vp of viewports) {
  const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch, deviceScaleFactor: 1, reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  if (flags.auth) await context.addInitScript(({ u, m }) => { try { if (!localStorage.getItem('ppapi_demo_session')) { localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); const users = {}; users[u.email] = { ...u, hash: 'x' }; localStorage.setItem('ppapi_demo_users', JSON.stringify(users)); localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m)); } } catch (e) {} }, { u: DEMO_USER, m: DEMO_MEMBER });
  for (const spec of pages) {
    const page = await context.newPage();
    const [pp, hash = ''] = spec.split('#'); const [pg, q = ''] = pp.split('?');
    await page.goto(`${BASE}/${pg}.html${q ? '?' + q : ''}${hash ? '#' + hash : ''}`, { waitUntil: 'networkidle' }).catch(() => {});
    await page.waitForTimeout(800);
    // load lazy images
    await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight * .8) { scrollTo(0, y); await new Promise(r => setTimeout(r, 100)); } scrollTo(0, 0); });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(300);
    /* Release QA 2026-10-09: no fullPage capture any more. A fullPage capture lays the page out at its full
       height, so vh-sized parts (heroes, auth panels) grow and everything below them moves — with mobile
       emulation the rects measured at 844 px then pointed at the wrong pixels (false failures on every
       footer). Now the page is captured viewport by viewport in its real layout, and each text element is
       measured in the same scroll position as the pixels it is compared with. */
    // collect text elements and their colours BEFORE hiding text (text nodes kept in window.__csItems)
    const items = await page.evaluate(() => {
      const sel = el => { const parts = []; let n = el; for (let i = 0; n && n.nodeType === 1 && i < 4; i++) { let s = n.tagName.toLowerCase(); if (n.id) { parts.unshift(s + '#' + n.id); break; } const c = [...n.classList].filter(x => !/^(is-|reveal)/.test(x)).slice(0, 2); if (c.length) s += '.' + c.join('.'); parts.unshift(s); n = n.parentElement; } return parts.join(' > '); };
      const parse = c => {
        const srgb = /^color\(srgb/.test(c);
        const m = c.replace(/^color\(srgb/, '').match(/[\d.]+/g); if (!m) return null;
        const k = srgb ? 255 : 1;
        const a = c.includes('/') ? +m[3] : (!srgb && m.length > 3 ? +m[3] : 1);
        return { r: +m[0] * k, g: +m[1] * k, b: +m[2] * k, a: isNaN(a) ? 1 : a };
      };
      const out = []; const seen = new Set(); window.__csItems = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let n;
      while ((n = walker.nextNode())) {
        if (!n.nodeValue.trim()) continue;
        const el = n.parentElement; if (!el || seen.has(el)) continue; seen.add(el);
        if (el.closest('script,style,noscript,svg,[aria-hidden="true"],[inert],.sr-only,.visually-hidden,.skip-link')) continue;
        if (el.closest('option')) continue;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') continue;
        if ((cs.webkitBackgroundClip || cs.backgroundClip) === 'text') continue;
        const range = document.createRange(); range.selectNodeContents(n);
        const rects = [...range.getClientRects()].filter(r => r.width > 2 && r.height > 2);
        if (!rects.length) continue;
        let op = 1, a = el; while (a && a.nodeType === 1) { op *= +getComputedStyle(a).opacity; a = a.parentElement; }
        if (op < 0.05) continue;
        const col = parse(cs.color);
        const fs = parseFloat(cs.fontSize), fw = +cs.fontWeight || 400;
        const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
        // background context: any ancestor with background-image or positioned image sibling?
        let ctx = 'solid', b = el;
        while (b && b.nodeType === 1) { const s = getComputedStyle(b); if (s.backgroundImage !== 'none' && !s.backgroundImage.startsWith('url("data:')) { ctx = 'image/gradient'; break; } const bc = parse(s.backgroundColor); if (bc && bc.a >= 0.99) break; b = b.parentElement; }
        let fixed = false; for (let f = el; f && f.nodeType === 1; f = f.parentElement) if (getComputedStyle(f).position === 'fixed') { fixed = true; break; }
        window.__csItems.push(n);
        out.push({ i: window.__csItems.length - 1, sel: sel(el), text: n.nodeValue.trim().replace(/\s+/g, ' ').slice(0, 60), color: cs.color, col, op, fs, fw, large, ctx, fixed,
          y: Math.round(rects[0].top + scrollY) });
      }
      return out;
    });
    // hide all text, then capture viewport by viewport
    await page.addStyleTag({ content: `*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } input::placeholder, textarea::placeholder { color: transparent !important; }` });
    await page.waitForTimeout(200);
    const res = [], done = new Set();
    const total = await page.evaluate(() => document.documentElement.scrollHeight);
    const VH = vp.height, TOP = 90, BOTTOM = 120;           // bands under a fixed header / above a sticky bar are left to the next shot
    for (let y = 0, last = false; !last; y += VH - TOP - BOTTOM) {
      last = y + VH >= total;
      const sy = await page.evaluate(yy => { scrollTo(0, yy); return scrollY; }, y);
      await page.waitForTimeout(160);
      const b64 = (await page.screenshot({ type: 'png' })).toString('base64');
      const part = await page.evaluate(async ({ b64, items, MIN, done, first, last, TOP, BOTTOM }) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const cv = document.createElement('canvas'); cv.width = img.naturalWidth; cv.height = img.naturalHeight;
        const ctx = cv.getContext('2d', { willReadFrequently: true }); ctx.drawImage(img, 0, 0);
        const W = cv.width, H = cv.height; const data = ctx.getImageData(0, 0, W, H).data;
        const lin = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
        const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
        const cr = (a, b) => { const x = Math.max(a, b), y = Math.min(a, b); return (x + 0.05) / (y + 0.05); };
        const lo = first ? 0 : TOP, hi = last ? innerHeight : innerHeight - BOTTOM;
        const out = [];
        for (const it of items) {
          if (!it.col || done.includes(it.i)) continue;
          if (it.fixed && !first) continue;                     // fixed UI (header …) is measured in the first shot
          const node = window.__csItems[it.i]; if (!node || !node.isConnected) continue;
          const range = document.createRange(); range.selectNodeContents(node);
          const rects = [...range.getClientRects()].filter(r => r.width > 2 && r.height > 2).slice(0, 6);
          if (!rects.length || !rects.every(r => r.top >= lo && r.bottom <= hi && r.right > 0 && r.left < innerWidth)) continue;
          const alpha = it.col.a * it.op;
          const ratios = [];
          for (const r of rects) {
            const x0 = Math.max(0, Math.floor(r.left)), y0 = Math.max(0, Math.floor(r.top)), x1 = Math.min(W - 1, Math.ceil(r.right)), y1 = Math.min(H - 1, Math.ceil(r.bottom));
            const stepX = Math.max(1, Math.floor((x1 - x0) / 40)), stepY = Math.max(1, Math.floor((y1 - y0) / 8));
            for (let yy = y0; yy <= y1; yy += stepY) for (let xx = x0; xx <= x1; xx += stepX) {
              const i = (yy * W + xx) * 4; const br = data[i], bg = data[i + 1], bb = data[i + 2];
              const tr = alpha * it.col.r + (1 - alpha) * br, tg = alpha * it.col.g + (1 - alpha) * bg, tb = alpha * it.col.b + (1 - alpha) * bb;
              ratios.push(cr(L(tr, tg, tb), L(br, bg, bb)));
            }
          }
          if (!ratios.length) continue;
          ratios.sort((a, b) => a - b);
          const p10 = ratios[Math.floor(ratios.length * 0.1)], med = ratios[Math.floor(ratios.length / 2)], min = ratios[0];
          out.push({ ...it, col: undefined, p10: +p10.toFixed(2), med: +med.toFixed(2), min: +min.toFixed(2), need: it.large ? 3 : MIN });
        }
        return out;
      }, { b64, items, MIN, done: [...done], first: y === 0, last, TOP, BOTTOM });
      part.forEach(r => { done.add(r.i); res.push(r); });
      if (sy < y) break;                                         // cannot scroll further
    }
    const missed = items.filter(it => it.col && !done.has(it.i)).length;
    if (missed) console.log(`  (${missed} text element(s) not sampled: taller than one viewport band or never fully on screen)`);
    const fails = res.filter(r => r.p10 < r.need);
    console.log(`\n=== ${spec}${flags.auth ? ' [auth]' : ''} @${vp.name}: ${res.length} text elements, ${fails.length} below threshold (p10)`);
    for (const f of fails) console.log(`  ✗ p10 ${f.p10} med ${f.med} (need ${f.need}) [${f.ctx}] ${f.color} op${f.op.toFixed(2)} ${f.fs}px/${f.fw} y=${f.y}  ${f.sel}  "${f.text}"`);
    if (flags.all) for (const f of res.filter(r => r.ctx !== 'solid' && r.p10 >= r.need)) console.log(`  ✓ p10 ${f.p10} med ${f.med} [${f.ctx}] ${f.sel} "${f.text}"`);
    await page.close();
  }
  await context.close();
}
await browser.close(); server.close();
