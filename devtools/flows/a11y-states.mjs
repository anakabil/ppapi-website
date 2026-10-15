// PPAPI — axe-core + focus checks in interactive states (review only; never writes to site/).
//   node flows/a11y-states.mjs [--only=name,name]
import { chromium } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..', '..', 'site');
const SHOTS = path.resolve(__dirname, '..', 'shots', 'a11y-audit');
fs.mkdirSync(SHOTS, { recursive: true });
const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404, { 'content-type': MIME['.html'] }); return res.end(fs.readFileSync(path.join(ROOT, '404.html'))); }
  res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' }); (String(file).replace(/\\/g, '/').endsWith('assets/js/config.js') && !process.env.PPAPI_REAL_FIREBASE ? res.end(fs.readFileSync(file, 'utf8').replace(/apiKey:\s*'[^']*'/, "apiKey: ''")) /* test server: Mode Demo unless PPAPI_REAL_FIREBASE=1 */ : fs.createReadStream(file).pipe(res));
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${server.address().port}`;
const AXE_SRC = await (await fetch('https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.10.2/axe.min.js')).text();

const DEMO_USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const DEMO_MEMBER = { uid: DEMO_USER.uid, name: DEMO_USER.name, email: DEMO_USER.email, phone: DEMO_USER.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14',
  profile: { city: 'Balikpapan', province: 'Kalimantan Timur', company: 'PT Contoh Konstruksi', position: 'Scaffolding Supervisor', experienceYears: 9, education: 'D3 Teknik Sipil', bio: 'Supervisor perancah.' },
  competencies: [{ id: 'k1', code: 'SCF-SUP', name: 'Supervisor Perancah', level: 'Mahir', since: 2019, notes: '' }, { id: 'k2', code: 'SCF-INS', name: 'Inspektur Perancah', level: 'Menengah', since: 2022, notes: '' }],
  certificates: [{ id: 'c1', title: 'Teknisi Perancah', number: 'CONTOH/001/2024', issuer: 'Kemnaker RI', issuedAt: '2024-02-10', expiresAt: '2027-02-10', link: '' },
    { id: 'c2', title: 'Ahli K3 Umum', number: 'CONTOH/002/2021', issuer: 'Kemnaker RI', issuedAt: '2021-11-02', expiresAt: '2026-11-20', link: '' }], updatedAt: '2026-09-30T08:00:00.000Z' };

const VP = { desktop: { width: 1440, height: 900 }, mobile: { width: 390, height: 844, isMobile: true, hasTouch: true } };

async function axeRun(page, include) {
  await page.addScriptTag({ content: AXE_SRC }).catch(() => {});
  return page.evaluate(async (include) => {
    const r = await window.axe.run(include ? { include: [include] } : document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] }, resultTypes: ['violations'] });
    return r.violations.map(v => ({ id: v.id, impact: v.impact, count: v.nodes.length, nodes: v.nodes.slice(0, 8).map(n => ({ t: n.target.join(' '), html: n.html.slice(0, 160), s: (n.failureSummary || '').split('\n').slice(1, 3).join(' ').trim(), d: n.any?.[0]?.data })) }));
  }, include || null);
}
async function activeInfo(page) {
  return page.evaluate(() => { const el = document.activeElement; if (!el || el === document.body) return 'body'; const cls = [...el.classList].slice(0, 2).join('.'); return `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${cls ? '.' + cls : ''} "${(el.getAttribute('aria-label') || el.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 30)}"`; });
}
async function tabCycle(page, n, containerSel) {
  const out = [];
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(40);
    out.push(await page.evaluate(sel => { const el = document.activeElement; const c = sel ? document.querySelector(sel) : null; return { inside: c ? c.contains(el) : null, el: el ? (el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + '.' + [...el.classList].slice(0, 2).join('.')) : null }; }, containerSel));
  }
  return out;
}

const scenarios = [
  { name: 'mobile-menu', vp: 'mobile', url: 'index.html', run: async (page) => {
      await page.click('.site-header [aria-controls="mobile-menu"], .site-header .menu-toggle, .site-header button[aria-label*="enu"]');
      await page.waitForTimeout(500);
      const state = await page.evaluate(() => { const m = document.getElementById('mobile-menu'); return { hidden: m?.hidden, ariaModal: m?.getAttribute('aria-modal'), role: m?.getAttribute('role'), label: m?.getAttribute('aria-label') || m?.getAttribute('aria-labelledby'), expanded: document.querySelector('[aria-controls="mobile-menu"]')?.getAttribute('aria-expanded') }; });
      const tabs = await tabCycle(page, 16, '#mobile-menu, .site-header');
      const axe = await axeRun(page);
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
      const after = await activeInfo(page);
      return { state, tabs, axe, afterEsc: after };
    } },
  { name: 'account-menu', vp: 'desktop', url: 'index.html', auth: true, run: async (page) => {
      const btn = await page.$('.site-header [aria-controls="account-menu"]');
      await btn.click(); await page.waitForTimeout(300);
      const state = await page.evaluate(() => { const b = document.querySelector('[aria-controls="account-menu"]'); const m = document.getElementById('account-menu'); return { btnLabel: b?.getAttribute('aria-label'), expanded: b?.getAttribute('aria-expanded'), haspopup: b?.getAttribute('aria-haspopup'), menuRole: m?.getAttribute('role'), itemRoles: [...(m?.querySelectorAll('a,button') || [])].map(x => x.getAttribute('role')) }; });
      const axe = await axeRun(page);
      await page.keyboard.press('ArrowDown'); await page.waitForTimeout(100);
      const afterArrow = await activeInfo(page);
      await page.keyboard.press('Escape'); await page.waitForTimeout(200);
      return { state, axe, afterArrow, afterEsc: await activeInfo(page) };
    } },
  { name: 'agenda-modal', vp: 'desktop', url: 'agenda.html', run: async (page) => {
      const b = await page.$('.agenda-row button, .event-row button, .event-row__title a, [data-agenda-id]');
      await b.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
      const dlg = await page.evaluate(() => { const d = document.querySelector('.modal__dialog'); return d ? { role: d.getAttribute('role'), modal: d.getAttribute('aria-modal'), labelledby: d.getAttribute('aria-labelledby'), labelText: d.getAttribute('aria-labelledby') ? document.getElementById(d.getAttribute('aria-labelledby'))?.textContent?.trim().slice(0, 60) : null, describedby: d.getAttribute('aria-describedby') } : null; });
      const focusOnOpen = await activeInfo(page);
      const axe = await axeRun(page);
      const tabs = await tabCycle(page, 10, '.modal__dialog');
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      return { dlg, focusOnOpen, axe, trapOk: tabs.every(t => t.inside), afterEsc: await activeInfo(page) };
    } },
  { name: 'regulasi-modal', vp: 'mobile', url: 'regulasi.html', run: async (page) => {
      const b = await page.$('button:has-text("Ringkasan")');
      await b.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(500);
      const axe = await axeRun(page);
      const tabs = await tabCycle(page, 8, '.modal__dialog');
      await page.keyboard.press('Escape'); await page.waitForTimeout(400);
      return { axe, trapOk: tabs.every(t => t.inside), afterEsc: await activeInfo(page) };
    } },
  { name: 'masuk-daftar', vp: 'mobile', url: 'masuk.html#daftar', run: async (page) => {
      // submit empty sign-up form → inline errors
      const form = await page.$('#panel-daftar form, [id*="daftar"] form');
      const submit = form ? await form.$('button[type="submit"]') : null;
      if (submit) { await submit.click(); await page.waitForTimeout(400); }
      const errs = await page.evaluate(() => [...document.querySelectorAll('.field.is-invalid')].filter(f => f.offsetParent).map(f => { const c = f.querySelector('input,select,textarea'); const e = f.querySelector('.field__error'); return { id: c?.id, ariaInvalid: c?.getAttribute('aria-invalid'), describedby: c?.getAttribute('aria-describedby'), errId: e?.id, linked: !!(e?.id && (c?.getAttribute('aria-describedby') || '').split(' ').includes(e.id)), errText: e?.textContent.trim().slice(0, 60) }; }));
      const focusAfterSubmit = await activeInfo(page);
      const axe = await axeRun(page);
      return { errs, focusAfterSubmit, axe };
    } },
  { name: 'masuk-phone', vp: 'desktop', url: 'masuk.html', run: async (page) => {
      const seg = await page.$('[data-segmented] button[data-value="phone"], [data-segmented] button:has-text("Nomor HP")');
      if (seg) { await seg.click(); await page.waitForTimeout(300); }
      const axe = await axeRun(page);
      return { axe };
    } },
  { name: 'masuk-forgot-modal', vp: 'desktop', url: 'masuk.html', run: async (page) => {
      const l = await page.$('button:has-text("Lupa kata sandi"), a:has-text("Lupa kata sandi")');
      await l.click(); await page.waitForTimeout(500);
      const axe = await axeRun(page);
      return { focusOnOpen: await activeInfo(page), axe };
    } },
  { name: 'umpan-balik-errors', vp: 'mobile', url: 'umpan-balik.html', run: async (page) => {
      const submit = await page.$('form button[type="submit"]');
      await submit.click(); await page.waitForTimeout(500);
      const errs = await page.evaluate(() => [...document.querySelectorAll('.field.is-invalid, fieldset.is-invalid, [aria-invalid="true"]')].map(f => { const c = f.matches('input,select,textarea') ? f : f.querySelector('input,select,textarea'); const fld = c?.closest('.field, fieldset'); const e = fld?.querySelector('.field__error'); return { id: c?.id || c?.name, ariaInvalid: c?.getAttribute('aria-invalid'), describedby: c?.getAttribute('aria-describedby'), errId: e?.id, linked: !!(e?.id && (c?.getAttribute('aria-describedby') || '').split(' ').includes(e.id)), errText: e?.textContent.trim().slice(0, 60) }; }));
      const focusAfterSubmit = await activeInfo(page);
      const axe = await axeRun(page);
      return { errs, focusAfterSubmit, axe };
    } },
  { name: 'berita-detail', vp: 'desktop', url: 'berita.html?id=__FIRST__', run: async (page) => {
      const meta = await page.evaluate(() => ({ title: document.title, desc: document.querySelector('meta[name=description]')?.content, ogTitle: document.querySelector('meta[property="og:title"]')?.content, ogDesc: document.querySelector('meta[property="og:description"]')?.content, ogImage: document.querySelector('meta[property="og:image"]')?.content, canonical: document.querySelector('link[rel=canonical]')?.href, ogUrl: document.querySelector('meta[property="og:url"]')?.content, ogType: document.querySelector('meta[property="og:type"]')?.content, h1: [...document.querySelectorAll('h1')].map(h => h.textContent.trim().slice(0, 80)), headings: [...document.querySelectorAll('main h1, main h2, main h3, main h4')].map(h => h.tagName + ' ' + h.textContent.trim().slice(0, 40)), articleEl: !!document.querySelector('article'), timeEl: !!document.querySelector('article time[datetime], main time[datetime]') }));
      const axe = await axeRun(page);
      return { meta, axe };
    } },
  { name: 'berita-detail-mobile', vp: 'mobile', url: 'berita.html?id=__FIRST__', run: async (page) => ({ axe: await axeRun(page) }) },
  { name: 'berita-notfound', vp: 'desktop', url: 'berita.html?id=tidak-ada', run: async (page) => ({ title: await page.title(), robots: await page.evaluate(() => document.querySelector('meta[name=robots]')?.content || null), axe: await axeRun(page) }) },
  { name: 'agenda-deeplink', vp: 'mobile', url: 'agenda.html?id=__AGENDA__', run: async (page) => ({ title: await page.title(), axe: await axeRun(page) }) },
  { name: 'verifikasi-found', vp: 'mobile', url: 'verifikasi.html?kta=PPAPI-2026-000123', run: async (page) => ({ axe: await axeRun(page), live: await page.evaluate(() => [...document.querySelectorAll('[aria-live],[role=status],[role=alert]')].map(e => e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + ' ' + (e.getAttribute('aria-live') || e.getAttribute('role')))) }) },
  ...['kompetensi', 'sertifikat', 'kartu', 'aplikasi'].map(t => ({ name: 'anggota-' + t, vp: 'desktop', url: 'anggota.html#' + t, auth: true, run: async (page) => { await page.waitForTimeout(800); return { axe: await axeRun(page) }; } })),
  { name: 'anggota-kartu-mobile', vp: 'mobile', url: 'anggota.html#kartu', auth: true, run: async (page) => { await page.waitForTimeout(800); return { axe: await axeRun(page) }; } },
  { name: 'anggota-add-kompetensi-modal', vp: 'desktop', url: 'anggota.html#kompetensi', auth: true, run: async (page) => {
      const b = await page.$('#panel-kompetensi [data-action="add-kompetensi"]:visible');
      if (b) { await b.click(); await page.waitForTimeout(500); }
      const s = await page.$('.modal__dialog .btn--primary:visible');
      if (s) { await s.click(); await page.waitForTimeout(400); }
      const errs = await page.evaluate(() => [...document.querySelectorAll('.modal__dialog .field.is-invalid')].map(f => { const c = f.querySelector('input,select,textarea'); const e = f.querySelector('.field__error'); return { id: c?.id, ariaInvalid: c?.getAttribute('aria-invalid'), linked: !!(e?.id && (c?.getAttribute('aria-describedby') || '').split(' ').includes(e.id)) }; }));
      return { errs, axe: await axeRun(page) };
    } },
  { name: 'dashboard-mobile-menu-auth', vp: 'mobile', url: 'dashboard.html', auth: true, run: async (page) => {
      await page.click('.site-header [aria-controls="mobile-menu"]'); await page.waitForTimeout(500);
      return { axe: await axeRun(page) };
    } },
];

const only = flags.only ? flags.only.split(',') : null;
const browser = await chromium.launch();
const all = {};
for (const sc of scenarios) {
  if (only && !only.includes(sc.name)) continue;
  const context = await browser.newContext({ viewport: { width: VP[sc.vp].width, height: VP[sc.vp].height }, isMobile: !!VP[sc.vp].isMobile, hasTouch: !!VP[sc.vp].hasTouch, reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  if (sc.auth) await context.addInitScript(({ u, m }) => { try { if (!localStorage.getItem('ppapi_demo_session')) { localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); const users = {}; users[u.email] = { ...u, hash: 'x' }; localStorage.setItem('ppapi_demo_users', JSON.stringify(users)); localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m)); } } catch (e) {} }, { u: DEMO_USER, m: DEMO_MEMBER });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  let url = sc.url;
  if (url.includes('__FIRST__') || url.includes('__AGENDA__')) {
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle' });
    const ids = await page.evaluate(() => ({ b: (window.PPAPI_DATA.berita || [])[0]?.id, a: (window.PPAPI_DATA.agenda || []).find(x => x.mulai >= '2026-10-09')?.id }));
    url = url.replace('__FIRST__', ids.b).replace('__AGENDA__', ids.a);
  }
  try {
    await page.goto(`${BASE}/${url}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(700);
    const res = await sc.run(page);
    await page.screenshot({ path: path.join(SHOTS, `state-${sc.name}.png`) });
    all[sc.name] = { url, errors, ...res };
  } catch (e) { all[sc.name] = { url, error: e.message.split('\n')[0], errors }; }
  const r = all[sc.name];
  const axeSum = (r.axe || []).map(v => `${v.id}(${v.impact},${v.count})`).join(', ') || (r.error ? 'ERROR ' + r.error : 'none');
  console.log(`\n=== ${sc.name} [${sc.vp}${sc.auth ? ', auth' : ''}] ${url}\n  axe: ${axeSum}`);
  for (const [k, v] of Object.entries(r)) if (!['axe', 'url'].includes(k) && v !== undefined && !(Array.isArray(v) && !v.length)) console.log(`  ${k}: ${JSON.stringify(v).slice(0, 900)}`);
  for (const v of (r.axe || []).filter(v => ['serious', 'critical'].includes(v.impact))) for (const n of v.nodes) console.log(`    · ${v.id}: ${n.t} | ${n.s} | ${n.d ? JSON.stringify({ fg: n.d.fgColor, bg: n.d.bgColor, cr: n.d.contrastRatio }) : ''} | ${n.html.replace(/\s+/g, ' ')}`);
  await context.close();
}
fs.writeFileSync(path.join(SHOTS, '_states.json'), JSON.stringify(all, null, 1));
await browser.close(); server.close();
