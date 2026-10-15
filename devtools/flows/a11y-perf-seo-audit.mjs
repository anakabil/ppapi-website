// PPAPI — accessibility / performance / SEO audit (review only; never writes to site/).
//
// Usage (cwd = devtools/):
//   node flows/a11y-perf-seo-audit.mjs [<page>[?query][#hash] ...|all] [--auth] [--mobile|--desktop] [--out=dir] [--tag=x] [--nofocus]
//
// For every page × viewport it:
//   • injects axe-core 4.10.2 (cdnjs) after a full scroll and records violations (all impacts; summary shows serious/critical),
//   • records headings, landmarks, lang, images (alt + rendered vs natural size), CSS background images,
//   • tabs through the page and checks a visible focus indicator for every stop (style diff vs. blurred state),
//   • collects request sizes (encoded body bytes) before/after scroll, fonts, render-blocking resources (renderBlockingStatus),
//   • collects CLS (with shift sources), FCP, LCP element,
//   • under prefers-reduced-motion: reduce, lists still-running animations and smooth scrolling,
//   • reads the static (pre-JS) <head> for SEO tags and compares with the runtime head.
// Results: one JSON per run in --out (default: devtools/shots/a11y-audit/), summary on stdout.
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => {
  const [k, ...v] = a.slice(2).split('=');
  return [k, v.length ? v.join('=') : true];
}));
const OUT = path.resolve(flags.out || path.join(__dirname, '..', 'shots', 'a11y-audit'));
fs.mkdirSync(OUT, { recursive: true });
let pages = args.filter(a => !a.startsWith('--'));
if (!pages.length || pages.includes('all')) {
  pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html') && !f.startsWith('__')).map(f => f.replace(/\.html$/, ''));
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8',
};
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    const nf = path.join(ROOT, '404.html');
    res.writeHead(404, { 'content-type': MIME['.html'] });
    return res.end(fs.existsSync(nf) ? fs.readFileSync(nf) : 'Not found');
  }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
  (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;

// gzip estimate for local text files (GitHub Pages serves text gzip-compressed)
function localGzip(url) {
  try {
    const u = new URL(url);
    if (u.origin !== BASE) return null;
    let p = decodeURIComponent(u.pathname);
    if (p.endsWith('/')) p += 'index.html';
    const file = path.join(ROOT, p);
    if (!fs.existsSync(file)) return null;
    if (!/\.(html|css|js|svg|txt|json)$/i.test(file)) return fs.statSync(file).size;
    return zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length;
  } catch { return null; }
}

const AXE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js';
const axeRes = await fetch(AXE_URL);
if (!axeRes.ok) throw new Error('axe-core not reachable: ' + axeRes.status);
const AXE_SRC = await axeRes.text();
if (!AXE_SRC.startsWith('/*! axe v4.10.2')) throw new Error('unexpected axe-core payload');

const DEMO_USER = {
  uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890',
  provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z',
};
const DEMO_MEMBER = {
  uid: DEMO_USER.uid, name: DEMO_USER.name, email: DEMO_USER.email, phone: DEMO_USER.phone,
  kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14',
  profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Contoh Konstruksi', position: 'Scaffolding Supervisor', experienceYears: 9, education: 'D3 Teknik Sipil', bio: 'Supervisor perancah dengan pengalaman proyek kilang dan gedung bertingkat.' },
  competencies: [
    { id: 'k1', code: 'SCF-SUP', name: 'Supervisor Perancah', level: 'Mahir', since: 2019, notes: '' },
    { id: 'k2', code: 'SCF-INS', name: 'Inspektur Perancah', level: 'Menengah', since: 2022, notes: '' },
  ],
  certificates: [
    { id: 'c1', title: 'Teknisi Perancah', number: 'CONTOH/001/2024', issuer: 'Kemnaker RI', issuedAt: '2024-02-10', expiresAt: '2027-02-10', link: '' },
    { id: 'c2', title: 'Ahli K3 Umum', number: 'CONTOH/002/2021', issuer: 'Kemnaker RI', issuedAt: '2021-11-02', expiresAt: '2026-11-20', link: '' },
  ],
  updatedAt: '2026-09-30T08:00:00.000Z',
};

const viewports = [];
if (!flags.mobile) viewports.push({ name: 'desktop', width: 1440, height: 900, dpr: 1 });
if (!flags.desktop) viewports.push({ name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, dpr: 2 });

// ---------- in-page helpers (stringified into the page) ----------
const IN_PAGE_HELPERS = `
window.__audit = window.__audit || {};
window.__audit.sel = function sel(el) {
  if (!el || el.nodeType !== 1) return String(el);
  const parts = [];
  let n = el;
  for (let i = 0; n && n.nodeType === 1 && i < 4; i++) {
    let s = n.tagName.toLowerCase();
    if (n.id) { parts.unshift(s + '#' + n.id); break; }
    const cls = [...n.classList].filter(c => !/^(is-|js|no-js)/.test(c)).slice(0, 2);
    if (cls.length) s += '.' + cls.join('.');
    parts.unshift(s);
    n = n.parentElement;
  }
  return parts.join(' > ');
};
window.__audit.cls = { value: 0, entries: [] };
window.__audit.lcp = null; window.__audit.fcp = null;
try {
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) {
      if (e.hadRecentInput) continue;
      window.__audit.cls.value += e.value;
      window.__audit.cls.entries.push({ t: Math.round(e.startTime), value: +e.value.toFixed(4),
        sources: (e.sources || []).map(s => ({ node: s.node ? window.__audit.sel(s.node) : null,
          prev: s.previousRect ? [s.previousRect.x, s.previousRect.y, s.previousRect.width, s.previousRect.height].map(Math.round) : null,
          curr: s.currentRect ? [s.currentRect.x, s.currentRect.y, s.currentRect.width, s.currentRect.height].map(Math.round) : null })) });
    }
  }).observe({ type: 'layout-shift', buffered: true });
  new PerformanceObserver(list => {
    const es = list.getEntries(); const e = es[es.length - 1];
    if (e) window.__audit.lcp = { t: Math.round(e.startTime), size: e.size, el: e.element ? window.__audit.sel(e.element) : null, url: e.url || '' };
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver(list => {
    for (const e of list.getEntries()) if (e.name === 'first-contentful-paint') window.__audit.fcp = Math.round(e.startTime);
  }).observe({ type: 'paint', buffered: true });
} catch (e) {}
`;

function rawHeadInfo(file) {
  const fp = path.join(ROOT, file);
  if (!fs.existsSync(fp)) return null;
  const html = fs.readFileSync(fp, 'utf8');
  const head = (html.match(/<head[\s\S]*?<\/head>/i) || [''])[0];
  const meta = (attr, name) => { const m = head.match(new RegExp(`<meta[^>]+${attr}="${name}"[^>]*content="([^"]*)"`, 'i')); return m ? m[1] : null; };
  return {
    title: (head.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || null,
    description: meta('name', 'description'),
    robots: meta('name', 'robots'),
    ogTitle: meta('property', 'og:title'), ogDescription: meta('property', 'og:description'), ogImage: meta('property', 'og:image'),
    ogType: meta('property', 'og:type'), ogUrl: meta('property', 'og:url'), ogLocale: meta('property', 'og:locale'), ogSiteName: meta('property', 'og:site_name'),
    twitterCard: meta('name', 'twitter:card'),
    canonical: (head.match(/<link[^>]+rel="canonical"[^>]*href="([^"]*)"/i) || [])[1] || null,
    jsonLd: /application\/ld\+json/i.test(html),
    headStylesheets: [...head.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]*)"/gi)].map(m => m[1]),
    headPreloads: [...head.matchAll(/<link[^>]+rel="preload"[^>]*>/gi)].map(m => m[0]),
    headSyncScripts: [...head.matchAll(/<script(?![^>]*\b(defer|async|type="module")\b)[^>]*src="([^"]*)"/gi)].map(m => m[2]),
    bodyScripts: [...html.matchAll(/<script[^>]*src="([^"]*)"[^>]*>/gi)].map(m => m[1]),
  };
}

async function focusAudit(page, vp) {
  // baseline (blurred) styles of all focusables
  const count = await page.evaluate(() => {
    const SEL = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';
    const els = [...document.querySelectorAll(SEL)];
    const props = ['outlineStyle', 'outlineWidth', 'outlineColor', 'outlineOffset', 'boxShadow', 'borderTopColor', 'borderBottomColor', 'borderBottomWidth', 'backgroundColor', 'color', 'textDecorationLine', 'opacity', 'transform'];
    window.__audit.focusProps = props;
    window.__audit.base = new Map();
    if (document.activeElement && document.activeElement !== document.body) document.activeElement.blur();
    els.forEach((el, i) => {
      const cs = getComputedStyle(el), a = getComputedStyle(el, '::after'), b = getComputedStyle(el, '::before');
      window.__audit.base.set(el, {
        el: props.map(p => cs[p]),
        after: [a.content, a.opacity, a.boxShadow, a.outlineStyle, a.backgroundColor, a.transform, a.borderTopColor, a.width],
        before: [b.content, b.opacity, b.boxShadow, b.outlineStyle, b.backgroundColor, b.transform, b.borderTopColor, b.width],
      });
    });
    return els.length;
  });
  await page.evaluate(() => { window.scrollTo(0, 0); document.body.focus(); });
  // start from the very top (skip link is first)
  await page.keyboard.press('Tab').catch(() => {});
  const stops = [];
  const seen = new Set();
  for (let i = 0; i < 400; i++) {
    await page.waitForTimeout(30);
    const info = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body || el === document.documentElement) return { none: true };
      const A = window.__audit;
      const base = A.base.get(el);
      const cs = getComputedStyle(el), a = getComputedStyle(el, '::after'), b = getComputedStyle(el, '::before');
      const now = A.focusProps.map(p => cs[p]);
      const nowAfter = [a.content, a.opacity, a.boxShadow, a.outlineStyle, a.backgroundColor, a.transform, a.borderTopColor, a.width];
      const nowBefore = [b.content, b.opacity, b.boxShadow, b.outlineStyle, b.backgroundColor, b.transform, b.borderTopColor, b.width];
      const diffs = [];
      if (base) {
        A.focusProps.forEach((p, i) => { if (base.el[i] !== now[i]) diffs.push(p); });
        nowAfter.forEach((v, i) => { if (base.after[i] !== v) diffs.push('::after#' + i); });
        nowBefore.forEach((v, i) => { if (base.before[i] !== v) diffs.push('::before#' + i); });
      }
      const r = el.getBoundingClientRect();
      // effective background behind the element
      let bg = null, n = el, bgImg = false;
      while (n && n.nodeType === 1) {
        const s = getComputedStyle(n);
        if (s.backgroundImage && s.backgroundImage !== 'none' && n !== el) bgImg = true;
        const c = s.backgroundColor;
        if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') { const m = c.match(/[\d.]+/g).map(Number); if (m.length < 4 || m[3] > 0.6) { bg = c; break; } }
        n = n.parentElement;
      }
      let vis = cs.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      // opacity of ancestors
      let op = 1; n = el; while (n && n.nodeType === 1) { op *= +getComputedStyle(n).opacity; n = n.parentElement; }
      const inView = r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
      // obscured by fixed header?
      let covered = null;
      if (inView && vis) {
        const cx = Math.min(innerWidth - 1, Math.max(0, r.left + r.width / 2)), cy = Math.min(innerHeight - 1, Math.max(0, r.top + Math.min(r.height / 2, 10)));
        const top = document.elementFromPoint(cx, cy);
        if (top && top !== el && !el.contains(top) && !top.contains(el)) covered = A.sel(top);
      }
      return {
        sel: A.sel(el), tag: el.tagName.toLowerCase(), text: (el.getAttribute('aria-label') || el.textContent || el.value || '').trim().replace(/\s+/g, ' ').slice(0, 50),
        diffs, hasBase: !!base, outline: [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.outlineOffset].join(' '), boxShadow: cs.boxShadow,
        focusVisible: el.matches(':focus-visible'), bg, bgImg, vis, opacity: +op.toFixed(2), inView, covered,
        rect: [r.x, r.y, r.width, r.height].map(Math.round),
      };
    });
    if (info.none) { await page.keyboard.press('Tab'); continue; }
    const key = info.sel + '|' + info.rect.join(',');
    if (seen.has(info.sel) && stops.length && stops[0].sel === info.sel) break; // wrapped around
    seen.add(info.sel);
    stops.push(info);
    await page.keyboard.press('Tab');
  }
  return { focusables: count, stops };
}

const results = [];
const browser = await chromium.launch();
for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height }, isMobile: !!vp.isMobile, hasTouch: !!vp.hasTouch,
    deviceScaleFactor: vp.dpr, reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta',
  });
  await context.addInitScript(IN_PAGE_HELPERS);
  if (flags.auth) {
    await context.addInitScript(({ u, m }) => {
      try {
        if (!localStorage.getItem('ppapi_demo_session')) {
          localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
          const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
          users[u.email] = { uid: u.uid, name: u.name, email: u.email, phone: u.phone, provider: u.provider, createdAt: u.createdAt, hash: 'x' };
          localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
          localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
        }
      } catch (e) {}
    }, { u: DEMO_USER, m: DEMO_MEMBER });
  }
  for (const pgSpec of pages) {
    const [pgPath, hash = ''] = pgSpec.split('#');
    const [pg, query = ''] = pgPath.split('?');
    const label = `${pgSpec}${flags.auth ? ' [auth]' : ''} @${vp.name}`;
    const page = await context.newPage();
    const reqs = [];
    const errors = [];
    let phase = 'load';
    page.on('pageerror', e => errors.push('pageerror: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
    page.on('requestfinished', async r => {
      const rec = { url: r.url(), type: r.resourceType(), phase, size: 0 };
      reqs.push(rec);
      try { const s = await r.sizes(); rec.size = s.responseBodySize; rec.headers = s.responseHeadersSize; } catch {}
    });
    page.on('requestfailed', r => errors.push('requestfailed: ' + r.url()));
    const url = `${BASE}/${pg}.html${query ? '?' + query : ''}${hash ? '#' + hash : ''}`;
    try { await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 }); } catch (e) { errors.push('goto: ' + e.message.split('\n')[0]); }
    await page.waitForTimeout(900);
    const finalUrl = page.url().replace(BASE, '');
    const loadPerf = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0];
      const res = performance.getEntriesByType('resource').map(e => ({ name: e.name, rb: e.renderBlockingStatus, init: e.initiatorType, start: Math.round(e.startTime), end: Math.round(e.responseEnd), size: e.transferSize, enc: e.encodedBodySize }));
      return { dcl: nav ? Math.round(nav.domContentLoadedEventEnd) : null, load: nav ? Math.round(nav.loadEventEnd) : null,
        cls: JSON.parse(JSON.stringify(window.__audit.cls)), lcp: window.__audit.lcp, fcp: window.__audit.fcp, res,
        fontsLoaded: [...document.fonts].filter(f => f.status === 'loaded').map(f => `${f.family} ${f.weight} ${f.style}`),
        fontsAll: document.fonts.size };
    });
    // full scroll (loads lazy images, triggers any scroll behaviour)
    phase = 'scroll';
    await page.evaluate(async () => {
      const step = innerHeight * 0.8;
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
      window.scrollTo(0, document.documentElement.scrollHeight); await new Promise(r => setTimeout(r, 300));
    });
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(400);
    const clsAfterScroll = await page.evaluate(() => JSON.parse(JSON.stringify(window.__audit.cls)));

    // ---------- DOM audit ----------
    const dom = await page.evaluate(() => {
      const A = window.__audit;
      const visible = el => { const s = getComputedStyle(el); const r = el.getBoundingClientRect(); return s.display !== 'none' && s.visibility !== 'hidden' && (r.width > 0 || r.height > 0); };
      const ariaHidden = el => !!el.closest('[aria-hidden="true"], [inert]');
      const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6,[role="heading"]')].filter(el => !ariaHidden(el)).map(el => ({
        level: el.getAttribute('aria-level') ? +el.getAttribute('aria-level') : +el.tagName[1],
        text: el.textContent.trim().replace(/\s+/g, ' ').slice(0, 70), sel: A.sel(el), visible: visible(el),
        inHeader: !!el.closest('.site-header, #site-header'), inFooter: !!el.closest('#site-footer, footer'), inDialog: !!el.closest('[role="dialog"], .modal'),
      }));
      const skips = [];
      let prev = 0;
      for (const hd of headings.filter(x => x.visible)) {
        if (prev && hd.level > prev + 1) skips.push(`h${prev} -> h${hd.level}: "${hd.text}" (${hd.sel})`);
        prev = hd.level;
      }
      const landmarks = [...document.querySelectorAll('main,[role=main],header,[role=banner],footer,[role=contentinfo],nav,[role=navigation],aside,[role=complementary],section[aria-label],section[aria-labelledby],[role=region],form[aria-label],[role=search]')]
        .filter(el => !ariaHidden(el)).map(el => ({ tag: el.tagName.toLowerCase(), role: el.getAttribute('role'), label: el.getAttribute('aria-label') || (el.getAttribute('aria-labelledby') ? (document.getElementById(el.getAttribute('aria-labelledby'))?.textContent || '').trim().slice(0, 40) : null), sel: A.sel(el), visible: visible(el) }));
      const dpr = devicePixelRatio;
      const imgs = [...document.images].map(img => {
        const r = img.getBoundingClientRect();
        const cs = getComputedStyle(img);
        // rendered size of the image content (object-fit: cover uses the box)
        const need = Math.round(Math.max(r.width, 1) * dpr);
        const needH = Math.round(Math.max(r.height, 1) * dpr);
        let effNeed = need;
        if (cs.objectFit === 'cover' && img.naturalWidth && img.naturalHeight) {
          const scale = Math.max(r.width / img.naturalWidth, r.height / img.naturalHeight);
          effNeed = Math.round(img.naturalWidth * scale * dpr);
        }
        return { src: (img.currentSrc || img.src).replace(location.origin + '/', ''), alt: img.getAttribute('alt'), hasAlt: img.hasAttribute('alt'),
          role: img.getAttribute('role'), ariaHidden: ariaHidden(img), loading: img.loading, decoding: img.decoding, fetchpriority: img.getAttribute('fetchpriority'),
          srcset: !!img.getAttribute('srcset'), sizes: img.getAttribute('sizes'), wAttr: img.getAttribute('width'), hAttr: img.getAttribute('height'),
          natural: [img.naturalWidth, img.naturalHeight], rendered: [Math.round(r.width), Math.round(r.height)], need: effNeed, needH, complete: img.complete,
          visible: visible(img), sel: A.sel(img), aboveFold: r.top < innerHeight && r.bottom > 0 };
      });
      const bgs = [];
      for (const el of document.querySelectorAll('body *')) {
        const cs = getComputedStyle(el);
        const bi = cs.backgroundImage;
        if (bi && bi.includes('url(') && !bi.includes('data:')) {
          const r = el.getBoundingClientRect();
          bgs.push({ sel: A.sel(el), bg: bi.slice(0, 160).replace(location.origin + '/', ''), size: cs.backgroundSize, box: [Math.round(r.width), Math.round(r.height)], need: [Math.round(r.width * dpr), Math.round(r.height * dpr)] });
        }
      }
      const meta = n => document.querySelector(`meta[name="${n}"]`)?.content ?? null;
      const prop = n => document.querySelector(`meta[property="${n}"]`)?.content ?? null;
      // forms
      const controls = [...document.querySelectorAll('input:not([type=hidden]), select, textarea')].filter(el => visible(el) || el.closest('.check, .segmented, .rating')).map(el => {
        const id = el.id;
        const lbl = (id && document.querySelector(`label[for="${CSS.escape(id)}"]`)) || el.closest('label');
        const err = el.closest('.field')?.querySelector('.field__error');
        const desc = (el.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
        return { sel: A.sel(el), type: el.type, name: el.name, id, label: lbl ? lbl.textContent.trim().replace(/\s+/g, ' ').slice(0, 40) : null, ariaLabel: el.getAttribute('aria-label'), ariaLabelledby: el.getAttribute('aria-labelledby'),
          required: el.required || el.getAttribute('aria-required') === 'true', autocomplete: el.getAttribute('autocomplete'), inputmode: el.getAttribute('inputmode'),
          errId: err ? err.id || '(no id)' : null, errLinked: err ? (!!err.id && desc.includes(err.id)) : null, describedby: desc, missingDescTargets: desc.filter(d => !document.getElementById(d)) };
      });
      const dupIds = (() => { const m = {}; document.querySelectorAll('[id]').forEach(e => { m[e.id] = (m[e.id] || 0) + 1; }); return Object.entries(m).filter(([, v]) => v > 1).map(([k, v]) => `${k}×${v}`); })();
      return {
        lang: document.documentElement.lang, title: document.title, description: meta('description'), robots: meta('robots'),
        ogTitle: prop('og:title'), ogDescription: prop('og:description'), ogImage: prop('og:image'), ogUrl: prop('og:url'), ogType: prop('og:type'),
        canonical: document.querySelector('link[rel=canonical]')?.href ?? null,
        h1: headings.filter(x => x.level === 1).map(x => x.text + (x.visible ? '' : ' [hidden]')), headings, skips, landmarks, imgs, bgs, controls, dupIds,
        mainCount: document.querySelectorAll('main, [role=main]').length,
        skipLink: !!document.querySelector('a.skip-link[href="#main"]'),
        scrollBehavior: getComputedStyle(document.documentElement).scrollBehavior,
        running: document.getAnimations().filter(a => a.playState === 'running').map(a => {
          const t = a.effect && a.effect.target;
          let props = [];
          try { props = [...new Set(a.effect.getKeyframes().flatMap(k => Object.keys(k).filter(x => !['offset', 'easing', 'composite', 'computedOffset'].includes(x))))]; } catch (e) {}
          return { name: a.animationName || a.transitionProperty || a.constructor.name, target: t ? A.sel(t) : null, props, iterations: a.effect?.getTiming?.().iterations, duration: a.effect?.getTiming?.().duration };
        }),
        docH: document.documentElement.scrollHeight,
      };
    });

    // ---------- axe ----------
    let axe = null;
    try {
      await page.addScriptTag({ content: AXE_SRC });
      axe = await page.evaluate(async () => {
        const r = await window.axe.run(document, {
          runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] },
          resultTypes: ['violations', 'incomplete'],
        });
        const slim = v => ({ id: v.id, impact: v.impact, help: v.help, tags: v.tags.filter(t => /wcag|best/.test(t)),
          nodes: v.nodes.slice(0, 12).map(n => ({ target: n.target.join(' '), html: n.html.slice(0, 220), summary: (n.failureSummary || '').slice(0, 300),
            data: n.any?.[0]?.data && typeof n.any[0].data === 'object' ? n.any[0].data : undefined })), count: v.nodes.length });
        return { violations: r.violations.map(slim), incomplete: r.incomplete.map(v => ({ id: v.id, impact: v.impact, count: v.nodes.length, targets: v.nodes.slice(0, 6).map(n => n.target.join(' ')) })) };
      });
    } catch (e) { axe = { error: e.message }; }

    // ---------- focus ----------
    let focus = null;
    if (!flags.nofocus) {
      try { focus = await focusAudit(page, vp); } catch (e) { focus = { error: e.message }; }
    }

    const head = rawHeadInfo(finalUrl.split('?')[0].split('#')[0].replace(/^\//, '') || 'index.html');
    // request summary
    const byType = {};
    let total = 0, totalLoad = 0, gzipEst = 0;
    for (const r of reqs) {
      const t = r.type;
      byType[t] = byType[t] || { n: 0, bytes: 0 };
      byType[t].n++; byType[t].bytes += r.size || 0;
      total += r.size || 0;
      if (r.phase === 'load') totalLoad += r.size || 0;
      const gz = localGzip(r.url);
      r.gzip = gz;
      gzipEst += gz != null ? gz : (r.size || 0);
    }
    const result = { label, page: pgSpec, auth: !!flags.auth, vp: vp.name, finalUrl, errors, perf: { ...loadPerf, clsAfterScroll, total, totalLoad, gzipEst, byType, reqs }, dom, axe, focus, head };
    results.push(result);
    const safe = `${pgSpec.replace(/[^a-z0-9-]+/gi, '_')}${flags.auth ? '-auth' : ''}-${vp.name}${flags.tag ? '-' + flags.tag : ''}`;
    fs.writeFileSync(path.join(OUT, safe + '.json'), JSON.stringify(result, null, 1));

    // ---------- console summary ----------
    const sc = (axe.violations || []).filter(v => ['serious', 'critical'].includes(v.impact));
    const other = (axe.violations || []).filter(v => !['serious', 'critical'].includes(v.impact));
    console.log(`\n=== ${label} -> ${finalUrl}`);
    if (errors.length) console.log('  errors: ' + errors.join(' | '));
    console.log(`  axe serious/critical: ${sc.map(v => `${v.id}(${v.impact},${v.count})`).join(', ') || 'none'}; other: ${other.map(v => `${v.id}(${v.impact},${v.count})`).join(', ') || 'none'}`);
    console.log(`  h1: ${JSON.stringify(dom.h1)}  skips: ${dom.skips.length}  main: ${dom.mainCount}  dupIds: ${dom.dupIds.join(',') || '-'}`);
    console.log(`  bytes: load ${(totalLoad / 1024).toFixed(0)}KB, after scroll ${(total / 1024).toFixed(0)}KB (gzip est ${(gzipEst / 1024).toFixed(0)}KB), reqs ${reqs.length}; CLS load ${loadPerf.cls.value.toFixed(3)} / after scroll ${clsAfterScroll.value.toFixed(3)}; LCP ${loadPerf.lcp ? loadPerf.lcp.el + ' ' + loadPerf.lcp.t + 'ms' : '-'}`);
    if (focus && focus.stops) {
      const bad = focus.stops.filter(s => s.diffs.length === 0);
      const hiddenStops = focus.stops.filter(s => !s.vis || s.opacity < 0.1);
      console.log(`  focus: ${focus.stops.length} tab stops; no visible change: ${bad.length}; invisible stops: ${hiddenStops.length}`);
    }
    if (dom.running.length) console.log(`  running animations under reduce: ${dom.running.length}`);
    await page.close();
  }
  await context.close();
}
await browser.close();
server.close();
console.log(`\nDone. ${results.length} run(s). JSON in ${OUT}`);
