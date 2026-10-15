// Fixer probe — pendaftaran (group "pendaftaran"): measures + screenshots the states touched by the fixes.
//   wizard Draf: kategori / data-diri / dokumen / pernyataan / tinjau (mobile 390×844 + desktop 1440×900)
//   renewal drift (Kedaluwarsa, memberType Ahli, application.kategori Praktisi) + in-draft choice survives reload
//   Aktif · Menunggu Verifikasi (just submitted + reload) · Ditolak
// Run from devtools/:  node flows/fix-pendaftaran-probe.mjs [--only=name,name] [--tag=x]
// Output: devtools/shots/fix-daf/*.png + devtools/shots/fix-daf/_probe.json
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, DEMO_USER, DEMO_MEMBER } from './qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'shots', 'fix-daf');
fs.mkdirSync(OUT, { recursive: true });
const args = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const only = args.only ? String(args.only).split(',') : null;
const TAG = args.tag ? '-' + args.tag : '';
const srv = await startServer();
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const result = {};
const issues = [];

const clone = (o) => JSON.parse(JSON.stringify(o));
const DRAFT = (() => {
  const m = clone(DEMO_MEMBER);
  Object.assign(m, { status: 'Draf', kta: '', validUntil: '', approvedAt: '', approvedBy: '', memberType: 'Praktisi' });
  m.application = { type: 'baru', kategori: 'Praktisi', submittedAt: '', updatedAt: '2026-10-08T02:00:00.000Z', pengalaman: [], dokumen: [], pasFoto: '', pembayaran: { metode: '', tanggal: '', buktiUrl: '' }, pernyataan: { kodeEtik: false, kebenaranData: false, privasi: false, namaTerang: '', tanggal: '' }, catatan: '' };
  m.profile = Object.assign({}, m.profile, { birthPlace: 'Balikpapan', birthDate: '1988-06-21', gender: 'Laki-laki', address: '' });
  return m;
})();
const COMPLETE = (() => {
  const m = clone(DRAFT);
  m.application.pernyataan = { kodeEtik: true, kebenaranData: true, privasi: true, namaTerang: DEMO_USER.name, tanggal: '2026-10-08' };
  m.application.dokumen = [{ id: 'd1', jenis: 'CV', label: 'CV terbaru', url: 'https://drive.google.com/file/d/contoh' }];
  return m;
})();
const DRIFT = (() => { // approved as Ahli although the application said Praktisi; expired
  const m = clone(DEMO_MEMBER);
  Object.assign(m, { memberType: 'Ahli', validUntil: '2026-06-30', approvedAt: '2026-03-20T03:00:00.000Z' });
  m.review = { note: '', history: [{ at: '2026-03-20T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin', action: 'disetujui', note: '' }] };
  return m;
})();
const REJECTED = (() => {
  const m = clone(COMPLETE);
  m.status = 'Ditolak';
  m.application.submittedAt = '2026-09-28T02:00:00.000Z';
  m.review = { note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.', history: [{ at: '2026-10-01T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'ditolak', note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.' }] };
  return m;
})();

const VP = { mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }, desktop: { viewport: { width: 1440, height: 900 } } };

async function open(member, vp, hash = '', { clock = '2026-10-09T03:00:00.000Z' } = {}) {
  const ctx = await browser.newContext({ ...VP[vp], reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
  await ctx.addInitScript(({ u, m, iso }) => {
    const real = Date; const start = real.now(); const base = new real(iso).getTime();
    class FakeDate extends real { constructor(...a) { if (a.length) super(...a); else super(base + (real.now() - start)); } static now() { return base + (real.now() - start); } }
    FakeDate.UTC = real.UTC; FakeDate.parse = real.parse; window.Date = FakeDate;
    try {
      localStorage.setItem('ppapi_demo_ribbon_dismissed', 'true');
      if (!sessionStorage.getItem('__seeded')) {
        sessionStorage.setItem('__seeded', '1');
        localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
        const users = {}; users[u.email] = { ...u, hash: 'x' };
        localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
        localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
      }
    } catch (e) {}
  }, { u: DEMO_USER, m: member, iso: clock });
  const page = await ctx.newPage();
  page.on('console', x => { if (['error', 'warning'].includes(x.type())) issues.push(`${vp} console.${x.type()}: ${x.text().slice(0, 200)}`); });
  page.on('pageerror', e => issues.push(`${vp} pageerror: ${e.message.slice(0, 200)}`));
  await page.goto(`${srv.BASE}/pendaftaran.html${hash}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.querySelector('#daf-root') && document.querySelector('#daf-root').getAttribute('aria-busy') === 'false', null, { timeout: 8000 });
  await page.waitForTimeout(700);
  return { ctx, page };
}
const shot = (page, name, full = false) => page.screenshot({ path: path.join(OUT, name + TAG + '.png'), fullPage: full });
const metrics = (page) => page.evaluate(() => {
  const r = (el) => el ? el.getBoundingClientRect() : null;
  const next = document.querySelector('.daf-foot__next'), foot = document.querySelector('.daf-foot');
  const firstCtl = document.querySelector('.daf-step:not([hidden]) .daf-cat, .daf-step:not([hidden]) input:not([type=hidden]):not([type=radio]):not([type=file]), .daf-step:not([hidden]) select, .daf-step:not([hidden]) textarea, .daf-step:not([hidden]) .daf-sum');
  const nr = r(next), fr = r(foot), cr = r(firstCtl);
  const hs = document.querySelector('#daf-hero-status');
  return {
    scrollH: document.documentElement.scrollHeight, vh: innerHeight, scrollY: Math.round(scrollY),
    nextTop: nr ? Math.round(nr.top + scrollY) : null, nextInViewport: nr ? (nr.top >= 0 && nr.bottom <= innerHeight) : null,
    footPos: foot ? getComputedStyle(foot).position : null, footBottomGap: fr ? Math.round(innerHeight - fr.bottom) : null,
    firstControlTop: cr ? Math.round(cr.top + scrollY) : null,
    heroStatusHidden: hs ? (hs.hidden || getComputedStyle(hs).display === 'none') : null,
    heroH: Math.round(r(document.querySelector('.daf-hero')).height),
    lead: (document.querySelector('#daf-lead') || {}).textContent,
    leadShown: (() => { const l = document.querySelector('#daf-lead'); return !!l && getComputedStyle(l).display !== 'none'; })(),
    stepPanelH: (() => { const p = document.querySelector('.daf-step:not([hidden])'); return p ? Math.round(p.getBoundingClientRect().height) : null; })(),
    hw: document.documentElement.scrollWidth > innerWidth,
  };
});
const want = (n) => !only || only.includes(n);

/* 1. wizard steps, both viewports */
for (const vp of ['mobile', 'desktop']) {
  if (!want('wizard')) break;
  const { ctx, page } = await open(DRAFT, vp, '#kategori');
  result[`kategori-${vp}`] = await metrics(page);
  result[`kategori-${vp}`].cats = await page.evaluate(() => [...document.querySelectorAll('.daf-cat')].map(c => ({ name: c.querySelector('.daf-cat__name').textContent, selected: c.classList.contains('is-selected'), open: !!(c.querySelector('details') || {}).open, h: Math.round(c.getBoundingClientRect().height) })));
  result[`kategori-${vp}`].contohBadges = await page.locator('#daf-step-kategori .badge--contoh').count();
  await shot(page, `kategori-${vp}`);
  await shot(page, `kategori-${vp}-full`, true);
  // choose another card by clicking the card body (not the label) → selection + disclosure follow
  await page.locator('.daf-cat').nth(1).click({ position: { x: 30, y: 30 } });
  await page.waitForTimeout(300);
  result[`kategori-${vp}`].afterClick = await page.evaluate(() => [...document.querySelectorAll('.daf-cat')].map(c => (c.classList.contains('is-selected') ? '*' : '') + (c.querySelector('details') && c.querySelector('details').open ? 'open' : 'closed')).join(' '));
  // opening an unselected card's disclosure does not select it
  await page.locator('.daf-cat').nth(2).locator('summary').click();
  await page.waitForTimeout(300);
  result[`kategori-${vp}`].afterSummary = await page.evaluate(() => [...document.querySelectorAll('.daf-cat')].map(c => (c.classList.contains('is-selected') ? '*' : '') + (c.querySelector('details') && c.querySelector('details').open ? 'open' : 'closed')).join(' '));
  await shot(page, `kategori-${vp}-afterclick`, vp === 'desktop');
  // keyboard: arrow keys move the radio selection
  await page.locator('.daf-cat__input').nth(1).focus();
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(200);
  result[`kategori-${vp}`].afterArrow = await page.evaluate(() => (document.querySelector('input[name=kategori]:checked') || {}).value);
  await page.locator('.daf-cat__input').nth(0).focus(); await page.keyboard.press('Space'); await page.waitForTimeout(200);
  await shot(page, `kategori-${vp}-focus`);
  // next step
  await page.locator('.daf-foot__next').click();
  await page.waitForTimeout(900);
  result[`datadiri-${vp}`] = await metrics(page);
  await shot(page, `datadiri-${vp}`);
  if (vp === 'mobile') {
    await page.evaluate(() => window.scrollTo(0, 1400)); await page.waitForTimeout(300);
    await shot(page, `datadiri-${vp}-scrolled`);
    // focusing a field near the bottom must not be hidden behind the sticky bar
    await page.locator('#f-phone').focus(); await page.waitForTimeout(300);
    result[`datadiri-${vp}`].phoneVisible = await page.evaluate(() => { const r = document.querySelector('#f-phone').getBoundingClientRect(), f = document.querySelector('.daf-foot').getBoundingClientRect(); return { phoneBottom: Math.round(r.bottom), footTop: Math.round(f.top), clear: r.bottom <= f.top }; });
    // scroll to page end: bar must sit in flow at the end of the panel (not over the help card / footer)
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(300);
    await shot(page, `datadiri-${vp}-end`);
  }
  for (const k of ['dokumen', 'pernyataan', 'tinjau']) {
    await page.evaluate((h) => { location.hash = h; }, k); await page.waitForTimeout(700);
    result[`${k}-${vp}`] = await metrics(page);
    await shot(page, `${k}-${vp}`, vp === 'desktop' && k !== 'tinjau');
  }
  if (vp === 'mobile') { // tip note and declaration hint up close
    await page.evaluate(() => { location.hash = 'dokumen'; }); await page.waitForTimeout(600);
    await page.locator('.daf-tip').scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
    await shot(page, `dokumen-${vp}-tip`);
    await page.evaluate(() => { location.hash = 'pernyataan'; }); await page.waitForTimeout(600);
    await page.locator('#f-kodeEtik-hint').scrollIntoViewIfNeeded(); await page.waitForTimeout(200);
    await shot(page, `pernyataan-${vp}-hint`);
    // validation error on the bar step → error summary reachable, sticky bar not covering focused checkbox
    await page.locator('.daf-foot__next').click(); await page.waitForTimeout(700);
    result[`pernyataan-${vp}`].afterNextInvalid = await page.evaluate(() => { const a = document.activeElement, r = a.getBoundingClientRect(), f = document.querySelector('.daf-foot').getBoundingClientRect(); return { active: a.id, top: Math.round(r.top), bottom: Math.round(r.bottom), footTop: Math.round(f.top), clear: r.bottom <= f.top && r.top >= 0 }; });
    await shot(page, `pernyataan-${vp}-invalid`);
  }
  await ctx.close();
}

/* 2. renewal drift */
if (want('renewal')) {
  const { ctx, page } = await open(DRIFT, 'desktop', '#kategori');
  const read = () => page.evaluate(() => ({
    checked: (document.querySelector('input[name=kategori]:checked') || {}).value,
    hint: (document.querySelector('#daf-step-kategori .daf-hint-line') || {}).textContent,
    stepper: (document.querySelector('[data-step-item="0"] .stepper__hint') || {}).textContent,
    stored: JSON.parse(localStorage.getItem('ppapi_member_demo-uji-0001')).application.kategori,
  }));
  result.renewal = { initial: await read() };
  await shot(page, 'renewal-kategori-desktop');
  // the member deliberately asks for another category in THIS renewal draft → kept after reload
  await page.locator('label[for="cat-0"]').click(); await page.waitForTimeout(1200);
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(900);
  result.renewal.afterChoiceReload = await read();
  await ctx.close();
}

/* 2b. narrow phone (360×740): renewal submit label in the bar, category name row */
if (want('narrow')) {
  VP.narrow = { viewport: { width: 360, height: 740 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 };
  const { ctx, page } = await open(DRIFT, 'narrow', '#kategori');
  result.narrow = await metrics(page);
  result.narrow.nameRows = await page.evaluate(() => [...document.querySelectorAll('.daf-cat__name')].map(n => Math.round(n.getBoundingClientRect().height)));
  await shot(page, 'narrow-kategori');
  await page.evaluate(() => { location.hash = 'tinjau'; }); await page.waitForTimeout(700);
  result.narrow.tinjau = await page.evaluate(() => { const b = document.querySelector('.daf-foot__next'), s = b.querySelector('span'); return { label: b.textContent.trim(), btnW: Math.round(b.getBoundingClientRect().width), scrollW: b.scrollWidth, clientW: b.clientWidth, back: document.querySelector('.daf-foot__back').getBoundingClientRect().width, backName: document.querySelector('.daf-foot__back').textContent.trim() }; });
  await shot(page, 'narrow-tinjau');
  await ctx.close();
}

/* 3. Aktif, Menunggu Verifikasi (fresh submit + reload), Ditolak */
if (want('status')) {
  for (const vp of ['desktop', 'mobile']) {
    let { ctx, page } = await open(DEMO_MEMBER, vp);
    result[`aktif-${vp}`] = await metrics(page);
    result[`aktif-${vp}`].ktaCountInViewport = await page.evaluate(() => [...document.querySelectorAll('body *')].filter(e => e.children.length === 0 && /PPAPI-2026-004821/.test(e.textContent) && e.getBoundingClientRect().top < innerHeight && e.getBoundingClientRect().bottom > 0 && getComputedStyle(e).visibility !== 'hidden' && e.offsetParent !== null).length);
    result[`aktif-${vp}`].days = await page.locator('.daf-member__days').textContent().catch(() => null);
    await shot(page, `aktif-${vp}`);
    await ctx.close();

    ({ ctx, page } = await open(COMPLETE, vp, '#tinjau'));
    await page.locator('.daf-foot__next').click();
    await page.waitForTimeout(1500);
    result[`terkirim-${vp}`] = await metrics(page);
    result[`terkirim-${vp}`].h1 = await page.locator('#daf-title').textContent();
    await shot(page, `terkirim-${vp}`);
    await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(900);
    result[`pending-${vp}`] = await metrics(page);
    await shot(page, `pending-${vp}`);
    await ctx.close();

    ({ ctx, page } = await open(REJECTED, vp));
    result[`ditolak-${vp}`] = await metrics(page);
    result[`ditolak-${vp}`].heroText = await page.locator('#daf-hero-status').innerText();
    await shot(page, `ditolak-${vp}`);
    await ctx.close();
  }
}

result.issues = issues;
fs.writeFileSync(path.join(OUT, '_probe' + TAG + '.json'), JSON.stringify(result, null, 1));
console.log(JSON.stringify(result, null, 1));
await browser.close(); await srv.close();
