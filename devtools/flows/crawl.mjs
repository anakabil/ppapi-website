// Link & asset crawler for the PPAPI site.
// Visits every page (and every internal URL discovered from them, incl. ?id= / ?q= / ?kta= variants) plus the
// member apps under aplikasi/, in three demo states (v2): signed OUT, ACTIVE member (qa-lib DEMO_MEMBER = the check.mjs
// --auth fixture: approved, validUntil 2029-12-31, with its ppapi_registry entry as an approval writes it) and the demo
// ADMIN (check.mjs --admin); optional extra state "pending" (Menunggu Verifikasi, no KTA, no registry entry).
// Checks:
//   • every internal href / src / srcset / data-hero-img / og:image / CSS url() resolves to a file
//   • every #anchor exists on its target page (element id/name, or a tab key of a [data-tab-hash] tabs)
//   • ?id= deep links resolve to existing records (berita/pengumuman, agenda, pustaka/regulasi via store.content)
//   • verifikasi.html?kta= links resolve to a registry entry (store.registry.lookup → exact)
//   • #hash routes handled by page scripts count as anchors: admin sections ([data-section], "#konten/<type>"),
//     pendaftaran wizard steps ([data-panel]) and the documented "#perpanjangan" entry
//   • every image actually decodes (naturalWidth > 0) after scrolling, no same-origin HTTP >= 400
//   • target="_blank" links carry rel="noopener" (or noreferrer); no javascript: / empty / "#" links
//   • (with --external) external URLs answer (HEAD, then GET) — informational
// Also opens interactive surfaces that only render links on demand (agenda detail modal, regulasi
// "Ringkasan" modal, pustaka detail modal, every admin console section incl. Konten sub-tabs + the first member
// drawer, account menu, mobile menu) so their links are checked too.
//
// Run from devtools/:  node flows/crawl.mjs [--external] [--max=250] [--states=signed-out,active,admin,pending]
// Output: devtools/shots/qa/crawl-report.json + console summary.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, freezeClock, waitReady, seedAuth, ROOT, SHOTS, DEMO_MEMBER } from './qa-lib.mjs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const MAX = Number(flags.max || 250);
const STATES = String(flags.states || 'signed-out,active,admin').split(',').map(x => x.trim()).filter(Boolean);
const ADMIN_USER = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
async function seedState(context, state) {
  if (state === 'signed-out') return;
  if (state === 'admin') {
    await context.addInitScript(({ a }) => {
      try {
        if (!localStorage.getItem('ppapi_demo_session')) localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
        const admins = JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]');
        if (!admins.includes(a.uid)) { admins.push(a.uid); localStorage.setItem('ppapi_demo_admins', JSON.stringify(admins)); }
      } catch (e) {}
    }, { a: ADMIN_USER });
    return;
  }
  const m = { ...DEMO_MEMBER };
  if (state === 'pending') Object.assign(m, { status: 'Menunggu Verifikasi', kta: '', validUntil: '', approvedAt: '', approvedBy: '' });
  await seedAuth(context, { member: m });   // writes ppapi_registry[kta] only for the approved (active) member
}

const srv = await startServer();
const BASE = srv.BASE;
const ORIGIN = new URL(BASE).origin;
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });

const seeds = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort()
  .concat(['aplikasi/perencanaan/index.html', 'aplikasi/simulator/index.html'].filter(f => fs.existsSync(path.join(ROOT, f))));
// hash entries that page scripts handle without an element id (documented in the page scripts)
const HASH_ROUTES = { 'pendaftaran.html': ['perpanjangan'] };
const report = { base: BASE, states: {}, broken: [], anchors: [], blankNoopener: [], badHref: [], images: [], http: [], deepLinks: [], external: {}, pageErrors: [] };
const externalLinks = new Map(); // url -> [{from, text}]
const anchorCache = new Map();   // state|url -> {ids:Set, names:Set, tabKeys:Set, routes:Set, finalUrl}

function fileExists(pathname) {
  let p = decodeURIComponent(pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  return f.startsWith(ROOT) && fs.existsSync(f) && fs.statSync(f).isFile();
}

async function collect(page) {
  return page.evaluate(() => {
    const out = [];
    const desc = (el) => {
      const parts = []; let n = el;
      for (let i = 0; n && n.nodeType === 1 && i < 4; i++, n = n.parentElement) {
        let s = n.tagName.toLowerCase();
        if (n.id) { s += '#' + n.id; parts.unshift(s); break; }
        if (n.classList.length) s += '.' + [...n.classList].slice(0, 2).join('.');
        parts.unshift(s);
      }
      return parts.join(' > ');
    };
    const abs = (v) => { try { return new URL(v, document.baseURI).href; } catch (e) { return 'INVALID:' + v; } };
    const push = (el, attr, raw) => out.push({
      tag: el.tagName.toLowerCase(), attr, raw, abs: abs(raw), target: el.getAttribute('target') || '',
      rel: el.getAttribute('rel') || '', text: ((el.innerText || el.textContent || el.getAttribute('aria-label') || '') + '').replace(/\s+/g, ' ').trim().slice(0, 70),
      where: desc(el), hidden: !(el.offsetWidth || el.offsetHeight || el.getClientRects().length),
    });
    document.querySelectorAll('a[href], area[href], link[href]').forEach(el => push(el, 'href', el.getAttribute('href')));
    document.querySelectorAll('[src]').forEach(el => push(el, 'src', el.getAttribute('src')));
    document.querySelectorAll('[srcset]').forEach(el => el.getAttribute('srcset').split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean).forEach(u => push(el, 'srcset', u)));
    document.querySelectorAll('[data-hero-img]').forEach(el => push(el, 'data-hero-img', el.getAttribute('data-hero-img')));
    document.querySelectorAll('form[action]').forEach(el => push(el, 'action', el.getAttribute('action')));
    document.querySelectorAll('meta[property="og:image"], meta[property="og:url"]').forEach(el => push(el, 'content', el.getAttribute('content')));
    document.querySelectorAll('[style*="url("]').forEach(el => {
      const m = (el.getAttribute('style') || '').match(/url\((['"]?)(.*?)\1\)/g) || [];
      m.forEach(x => { const u = x.replace(/^url\((['"]?)/, '').replace(/['"]?\)$/, ''); if (!/^data:/.test(u)) push(el, 'style-url', u); });
    });
    // computed background images that resolve to same-origin files (catches CSS custom-property urls)
    document.querySelectorAll('section, div, header, figure, aside').forEach(el => {
      const bg = getComputedStyle(el).backgroundImage || '';
      (bg.match(/url\("([^"]+)"\)/g) || []).forEach(x => { const u = x.slice(5, -2); if (!/^data:/.test(u)) out.push({ tag: el.tagName.toLowerCase(), attr: 'computed-bg', raw: u, abs: u, target: '', rel: '', text: '', where: desc(el), hidden: false }); });
    });
    return out;
  });
}

// route keys a page's script reacts to in location.hash (admin console sections + Konten sub-tabs, wizard steps)
const ROUTE_SRC = `(() => [...document.querySelectorAll('[data-section], [data-panel]')].map(e => e.getAttribute('data-section') || e.getAttribute('data-panel'))
  .concat([...document.querySelectorAll('.adm-subnav__link[data-type]')].map(e => 'konten/' + e.getAttribute('data-type'))))()`;
function hashResolved(info, h, targetFile) {
  if (info.id) return 'id';
  if (info.name) return 'name';
  if (info.tab) return 'tab-key';
  const routes = info.routes || new Set();
  if (routes.has(h)) return 'route';
  if (/^konten\/[a-z]+$/.test(h) && routes.has('konten')) return 'route';
  if ((HASH_ROUTES[targetFile] || []).includes(h)) return 'route (documented)';
  return 'MISSING';
}
async function anchorInfo(context, urlNoHash, stateName) {
  const ck = stateName + '|' + urlNoHash;
  if (anchorCache.has(ck)) return anchorCache.get(ck);
  const p = await context.newPage();
  let info = { ids: new Set(), names: new Set(), tabKeys: new Set(), routes: new Set(), finalUrl: '' };
  try {
    await p.goto(urlNoHash, { waitUntil: 'networkidle', timeout: 30000 });
    await waitReady(p);
    await p.waitForTimeout(300);
    const routes = await p.evaluate(ROUTE_SRC).catch(() => []);
    const r = await p.evaluate(() => ({
      ids: [...document.querySelectorAll('[id]')].map(e => e.id),
      names: [...document.querySelectorAll('a[name]')].map(e => e.getAttribute('name')),
      tabKeys: [...document.querySelectorAll('[data-tab-hash] [role=tab]')].map(t => t.getAttribute('data-tab') || (t.getAttribute('aria-controls') || '')),
      url: location.href,
    }));
    info = { ids: new Set(r.ids), names: new Set(r.names), tabKeys: new Set(r.tabKeys), routes: new Set(routes), finalUrl: r.url };
  } catch (e) { info.error = e.message.split('\n')[0]; }
  await p.close();
  anchorCache.set(ck, info);
  return info;
}

async function crawlState(stateName) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta', acceptDownloads: true });
  await freezeClock(context, '2026-10-09T03:00:00.000Z');
  await seedState(context, stateName);
  const queue = seeds.map(f => `${BASE}/${f}`);
  const seen = new Set();
  const visited = [];
  while (queue.length && visited.length < MAX) {
    const url = queue.shift();
    const key = url.replace(/#.*$/, '');
    if (seen.has(key)) continue;
    seen.add(key);
    const page = await context.newPage();
    const http = [];
    const errs = [];
    page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(ORIGIN) && r.request().resourceType() !== 'document') http.push(`${r.status()} ${r.url()}`); });
    page.on('response', r => { if (r.status() >= 400 && r.url().startsWith(ORIGIN) && r.request().resourceType() === 'document' && !/404\.html$/.test(r.url())) http.push(`DOC ${r.status()} ${r.url()}`); });
    page.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 200)));
    page.on('console', m => { if (m.type() === 'error') errs.push('console.error: ' + m.text().slice(0, 200)); });
    let finalUrl = url;
    try {
      await page.goto(key, { waitUntil: 'networkidle', timeout: 30000 });
      await waitReady(page);
      // gated pages redirect with location.replace — wait for it to settle
      await page.waitForLoadState('networkidle').catch(() => {});
      await waitReady(page);
      finalUrl = page.url();
      // scroll for lazy images
      await page.evaluate(async () => {
        const step = Math.round(innerHeight * 0.85);
        for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 90)); }
        scrollTo(0, 0);
      });
      await page.waitForLoadState('networkidle').catch(() => {});
      await page.waitForTimeout(250);
    } catch (e) { errs.push('goto: ' + e.message.split('\n')[0]); }

    const fromKey = finalUrl.replace(BASE, '') || '/';
    let links = await collect(page).catch(() => []);

    // On-demand surfaces: account menu / mobile menu are in DOM already; open modals that carry links.
    const fileName = new URL(finalUrl).pathname.split('/').pop();
    if (fileName === 'agenda.html' && !new URL(finalUrl).searchParams.get('id')) {
      // open first upcoming + first past detail modal
      for (const sel of ['[data-tab-target="up"], [data-agenda-tab="up"]', '[data-tab-target="past"], [data-agenda-tab="past"]']) { /* tabs handled below generically */ }
      const btns = await page.$$('.event-row button, .event-row__title a, [data-event-open]');
      for (const b of btns.slice(0, 2)) {
        try {
          await b.click({ timeout: 3000 });
          await page.waitForSelector('.modal', { timeout: 3000 });
          const extra = await collect(page);
          links = links.concat(extra.filter(x => x.where.includes('modal')).map(x => ({ ...x, where: '[agenda modal] ' + x.where })));
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        } catch (e) { /* ignore */ }
      }
    }
    if (fileName === 'regulasi.html' && !new URL(finalUrl).search) {
      const b = await page.$('button:has-text("Ringkasan")');
      if (b) {
        try {
          await b.click({ timeout: 3000 });
          await page.waitForSelector('.modal', { timeout: 3000 });
          const extra = await collect(page);
          links = links.concat(extra.filter(x => x.where.includes('modal')).map(x => ({ ...x, where: '[regulasi modal] ' + x.where })));
          await page.keyboard.press('Escape');
        } catch (e) { /* ignore */ }
      }
    }

    if (fileName === 'pustaka.html' && !new URL(finalUrl).search) {
      const b = await page.$('[data-pk="results"] [data-pk-open]');
      if (b) {
        try {
          await b.click({ timeout: 3000 });
          await page.waitForSelector('.modal', { timeout: 3000 });
          await page.waitForTimeout(400);
          const extra = await collect(page);
          links = links.concat(extra.filter(x => x.where.includes('modal')).map(x => ({ ...x, where: '[pustaka modal] ' + x.where })));
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
        } catch (e) { /* ignore */ }
      }
    }
    if (fileName === 'admin.html' && await page.$('html[data-admin-ready]').catch(() => null)) {
      // every console section renders its own links (lists, "Lihat", mailto, verifikasi?kta=) — visit each + the first drawer
      const inSection = (x, sec) => x.where.includes('sec-' + sec) || x.where.includes(sec + '-body') || /[pak]q-list|kt-list|fb-list/.test(x.where);
      for (const sec of ['ringkasan', 'permohonan', 'anggota', 'konten', 'umpan-balik', 'admin', 'log']) {
        try {
          await page.click(`.adm-nav__link[data-section="${sec}"]`, { timeout: 3000 });
          await page.waitForTimeout(350);
          const extra = await collect(page);
          links = links.concat(extra.filter(x => inSection(x, sec)).map(x => ({ ...x, where: `[admin #${sec}] ` + x.where })));
          if (sec === 'konten') {
            for (const t of ['pengumuman', 'agenda', 'pustaka', 'regulasi']) {
              await page.click(`.adm-subnav__link[data-type="${t}"]`, { timeout: 3000 }).catch(() => {});
              await page.waitForTimeout(300);
              const ex2 = await collect(page);
              links = links.concat(ex2.filter(x => inSection(x, 'konten')).map(x => ({ ...x, where: `[admin #konten/${t}] ` + x.where })));
            }
          }
          if (sec === 'anggota' || sec === 'permohonan') {
            const opener = await page.$(sec === 'anggota' ? '#aq-list .adm-act' : '#pq-list .adm-act');
            if (opener) {
              await opener.click({ timeout: 3000 });
              await page.waitForSelector('.drawer__panel', { timeout: 3000 });
              await page.waitForTimeout(250);
              const ex3 = await collect(page);
              links = links.concat(ex3.filter(x => x.where.includes('drawer')).map(x => ({ ...x, where: `[admin ${sec} drawer] ` + x.where })));
              await page.keyboard.press('Escape');
              await page.waitForTimeout(250);
            }
          }
        } catch (e) { errs.push(`admin surface ${sec}: ` + e.message.split('\n')[0]); }
      }
    }

    // broken images (decoded size 0) after scroll
    const badImgs = await page.evaluate(() => [...document.images].filter(i => i.complete && i.naturalWidth === 0 && (i.currentSrc || i.src)).map(i => i.currentSrc || i.src)).catch(() => []);
    badImgs.forEach(src => report.images.push({ state: stateName, page: fromKey, src }));
    http.forEach(x => report.http.push({ state: stateName, page: fromKey, entry: x }));
    errs.forEach(x => report.pageErrors.push({ state: stateName, page: fromKey, entry: x }));

    // deep-link validation
    const u = new URL(finalUrl);
    const id = u.searchParams.get('id');
    if (id && /berita\.html$|agenda\.html$|pustaka\.html$/.test(u.pathname)) {
      const ok = await page.evaluate(async ([file, id]) => {
        const types = file.endsWith('berita.html') ? ['berita', 'pengumuman'] : file.endsWith('agenda.html') ? ['agenda'] : ['pustaka', 'regulasi'];
        let arr = [];
        for (const t of types) { try { arr = arr.concat(await PPAPI.store.content.list(t)); } catch (e) { arr = arr.concat(PPAPI.data[t] || []); } }
        const bare = id.replace(/^[a-z]:/, '');
        return { exists: arr.some(x => x.id === id || x.id === bare), modal: !!document.querySelector('.modal'), notFound: /tidak ditemukan/i.test(document.querySelector('main')?.innerText || '') };
      }, [u.pathname, id]).catch(e => ({ error: e.message }));
      report.deepLinks.push({ state: stateName, url: fromKey, ...ok });
    }
    const ktaQ = u.searchParams.get('kta');
    if (ktaQ && /verifikasi\.html$/.test(u.pathname)) {
      const r = await page.evaluate(async (k) => { const x = await PPAPI.store.registry.lookup(k); return { exists: !!x.exact, status: x.exact ? x.exact.status : '' }; }, ktaQ).catch(e => ({ error: e.message }));
      report.deepLinks.push({ state: stateName, url: fromKey, kind: 'kta', ...r });
    }

    for (const l of links) {
      const rec = { state: stateName, page: fromKey, ...l };
      const raw = (l.raw || '').trim();
      if (l.attr === 'href' && l.tag === 'a') {
        if (!raw) { report.badHref.push({ ...rec, problem: 'empty href' }); continue; }
        if (raw === '#') { report.badHref.push({ ...rec, problem: 'href="#" (dead link)' }); continue; }
        if (/^javascript:/i.test(raw)) { report.badHref.push({ ...rec, problem: 'javascript: URL' }); continue; }
        if (l.target === '_blank' && !/\bnoopener\b|\bnoreferrer\b/i.test(l.rel)) report.blankNoopener.push(rec);
      }
      if (/^(mailto|tel|data|blob|about):/i.test(raw) || /^(mailto|tel|data|blob|about):/i.test(l.abs)) continue;
      if (l.abs.startsWith('INVALID:')) { report.broken.push({ ...rec, problem: 'unparseable URL' }); continue; }
      let target;
      try { target = new URL(l.abs); } catch (e) { report.broken.push({ ...rec, problem: 'unparseable URL' }); continue; }
      if (target.origin !== ORIGIN) {
        if (/^https?:$/.test(target.protocol) && !/fonts\.(googleapis|gstatic)\.com$/.test(target.hostname) && l.tag === 'a') {
          if (!externalLinks.has(target.href)) externalLinks.set(target.href, []);
          externalLinks.get(target.href).push({ state: stateName, page: fromKey, text: l.text, where: l.where });
        }
        continue;
      }
      if (!fileExists(target.pathname)) { report.broken.push({ ...rec, problem: 'file not found: ' + target.pathname }); continue; }
      if (l.tag === 'a' && /\.html$/.test(target.pathname)) {
        const noHash = target.href.replace(/#.*$/, '');
        if (!seen.has(noHash) && !queue.includes(noHash)) queue.push(noHash);
        if (target.hash && target.hash.length > 1) {
          const h = decodeURIComponent(target.hash.slice(1));
          let info;
          const targetFile = target.pathname.split('/').pop();
          if (noHash === key || noHash === finalUrl.replace(/#.*$/, '')) {
            const r = await page.evaluate((h) => ({ id: !!document.getElementById(h), name: !!document.getElementsByName(h).length, tab: !!document.querySelector(`[data-tab-hash] [role=tab][data-tab="${CSS.escape(h)}"]`) }), h).catch(() => ({}));
            const routes = await page.evaluate(ROUTE_SRC).catch(() => []);
            info = { ...r, routes: new Set(routes) };
          } else {
            const ai = await anchorInfo(context, noHash, stateName);
            info = { id: ai.ids.has(h), name: ai.names.has(h), tab: ai.tabKeys.has(h), routes: ai.routes, finalUrl: ai.finalUrl };
          }
          report.anchors.push({ ...rec, hash: h, resolved: hashResolved(info, h, targetFile), targetFinal: info.finalUrl || '' });
        }
      }
    }
    visited.push({ url: key.replace(BASE, ''), finalUrl: fromKey, links: links.length });
    await page.close();
  }
  report.states[stateName] = { visited: visited.length, pages: visited };
  await context.close();
}

for (const st of STATES) await crawlState(st);

if (flags.external) {
  const urls = [...externalLinks.keys()];
  const check = async (u) => {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 15000);
    try {
      let r = await fetch(u, { method: 'HEAD', redirect: 'follow', signal: ctl.signal, headers: { 'user-agent': 'Mozilla/5.0 (PPAPI link check)' } });
      if (r.status >= 400) r = await fetch(u, { method: 'GET', redirect: 'follow', signal: ctl.signal, headers: { 'user-agent': 'Mozilla/5.0 (PPAPI link check)' } });
      return { status: r.status, final: r.url };
    } catch (e) { return { status: 0, error: e.name === 'AbortError' ? 'timeout' : e.message }; }
    finally { clearTimeout(t); }
  };
  const results = {};
  for (let i = 0; i < urls.length; i += 6) {
    const chunk = urls.slice(i, i + 6);
    const rs = await Promise.all(chunk.map(check));
    chunk.forEach((u, j) => { results[u] = rs[j]; });
  }
  report.external = Object.fromEntries(urls.map(u => [u, { ...results[u], from: [...new Set(externalLinks.get(u).map(x => x.page))].slice(0, 5) }]));
} else {
  report.external = Object.fromEntries([...externalLinks.entries()].map(([u, v]) => [u, { from: [...new Set(v.map(x => x.page))].slice(0, 5) }]));
}

await browser.close();
await srv.close();

// de-duplicate for printing
const uniq = (arr, keyFn) => { const m = new Map(); arr.forEach(x => { const k = keyFn(x); if (!m.has(k)) m.set(k, { ...x, count: 0, pages: new Set() }); const e = m.get(k); e.count++; e.pages.add(`${x.state}:${x.page}`); }); return [...m.values()].map(e => ({ ...e, pages: [...e.pages].slice(0, 6) })); };
const brokenU = uniq(report.broken, x => x.abs + '|' + x.attr);
const missingAnchors = uniq(report.anchors.filter(a => a.resolved === 'MISSING'), x => x.abs);
const blankU = uniq(report.blankNoopener, x => x.abs + '|' + x.where);
const badHrefU = uniq(report.badHref, x => x.where + '|' + x.raw);
const imgU = uniq(report.images, x => x.src);
const httpU = uniq(report.http, x => x.entry);
const errU = uniq(report.pageErrors, x => x.entry);
const deepBad = report.deepLinks.filter(d => d.exists === false || d.error);
const routed = report.anchors.filter(a => /^route/.test(a.resolved)).length;

fs.writeFileSync(path.join(SHOTS, 'crawl-report.json'), JSON.stringify({ ...report, summary: { brokenU, missingAnchors, blankU, badHrefU, imgU, httpU, errU, deepBad } }, null, 2));

console.log('Crawled: ' + Object.entries(report.states).map(([k, v]) => `${k} ${v.visited} URLs`).join(', '));
console.log(`Anchors checked: ${report.anchors.length} (${new Set(report.anchors.map(a => a.abs)).size} unique; ${routed} resolved as script hash routes)`);
console.log(`Deep links checked: ${report.deepLinks.length} (${report.deepLinks.filter(d => d.kind === 'kta').length} verifikasi ?kta=)`);
const sect = (title, arr, fmt) => { console.log(`\n## ${title}: ${arr.length}`); arr.slice(0, 60).forEach(x => console.log('  - ' + fmt(x))); };
sect('Broken internal references', brokenU, x => `${x.attr}="${x.raw}" (${x.problem}) on ${x.pages.join(', ')} at ${x.where}`);
sect('Missing #anchors', missingAnchors, x => `${x.raw} → #${x.hash} not on ${x.targetFinal || 'target'}; from ${x.pages.join(', ')} at ${x.where}`);
sect('target=_blank without rel=noopener', blankU, x => `${x.raw} rel="${x.rel}" on ${x.pages.join(', ')} at ${x.where}`);
sect('Bad hrefs', badHrefU, x => `${x.problem}: "${x.raw}" "${x.text}" on ${x.pages.join(', ')} at ${x.where}`);
sect('Broken images (naturalWidth 0)', imgU, x => `${x.src} on ${x.pages.join(', ')}`);
sect('Same-origin HTTP >= 400', httpU, x => `${x.entry} on ${x.pages.join(', ')}`);
sect('Page/console errors', errU, x => `${x.entry} on ${x.pages.join(', ')}`);
sect('Deep links to missing records', deepBad, x => `${x.state} ${x.url} ${JSON.stringify(x)}`);
const ext = Object.entries(report.external);
console.log(`\n## External links: ${ext.length}`);
ext.forEach(([u, v]) => { if (!flags.external || !(v.status >= 200 && v.status < 400)) console.log(`  - ${u} ${flags.external ? `→ ${v.status || v.error}` : ''} (from ${v.from.join(', ')})`); });
