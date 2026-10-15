// review-fungsi-states — every page × every session state × desktop/mobile: final URL (gating), console/page errors,
// failed requests, toasts (count, duplicates, flash after a gate redirect), header account menu items, mobile menu
// foot, locked panels + CTA labels, demo ribbon, keyboard operation of the account menu and the mobile menu.
// Output: console PASS/FAIL + devtools/shots/review-fungsi/states.json (the matrix, for the consistency review).
// Run from devtools/:  node flows/review-fungsi-states.mjs [--vp=desktop|mobile] [--states=a,b] [--pages=a,b]
import fs from 'node:fs';
import path from 'node:path';
import { startServer, launch, newContext, watch, toasts, open, shot, recorder, STATUSES, RSHOTS } from './review-fungsi-lib.mjs';

const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const VPS = flags.vp ? [flags.vp] : ['desktop', 'mobile'];
const STATES = flags.states ? flags.states.split(',') : ['signed-out', ...STATUSES, 'admin'];
const PAGES = flags.pages ? flags.pages.split(',') : ['index.html', 'profil.html', 'berita.html', 'agenda.html', 'pustaka.html', 'regulasi.html', 'keanggotaan.html', 'verifikasi.html', 'umpan-balik.html', 'kebijakan-privasi.html', 'masuk.html', 'pendaftaran.html', 'dashboard.html', 'anggota.html', 'admin.html', 'a/b/halaman-tidak-ada', 'aplikasi/perencanaan/index.html', 'aplikasi/simulator/index.html'];

const GATE = { 'masuk.html': 'guest', 'pendaftaran.html': 'required', 'dashboard.html': 'required', 'anggota.html': 'active', 'admin.html': 'admin', 'aplikasi/perencanaan/index.html': 'active', 'aplikasi/simulator/index.html': 'active' };
function expectedUrl(page, state) {
  const g = GATE[page] || 'public';
  const signedIn = state !== 'signed-out';
  const active = state === 'Aktif' || state === 'admin';
  const admin = state === 'admin';
  if (g === 'public') return { file: /halaman-tidak-ada/.test(page) ? '404' : page, toast: null };
  if (g === 'guest') return signedIn ? { file: 'dashboard.html', toast: null } : { file: 'masuk.html', toast: null };
  if (!signedIn) return { file: 'masuk.html', next: page, toast: null };
  if (g === 'required') return { file: page, toast: null };
  if (g === 'active') return active ? { file: page, toast: null } : { file: 'dashboard.html', toast: 'Fitur ini khusus anggota berstatus Aktif.' };
  if (g === 'admin') return admin ? { file: page, toast: null } : { file: 'dashboard.html', toast: 'Halaman ini khusus admin PPAPI.' };
  return { file: page, toast: null };
}

const srv = await startServer();
const BASE = srv.BASE;
const browser = await launch();
const R = recorder('review-fungsi-states');
const matrix = {};

for (const vp of VPS) {
  for (const state of STATES) {
    const context = await newContext(browser, { vp, state });
    for (const pg of PAGES) {
      const page = await context.newPage();
      const issues = watch(page, `[${vp}/${state}/${pg}] `);
      const t0 = Date.now();
      await open(page, `${BASE}/${pg}`, { wait: 700 });
      if (/aplikasi/.test(pg)) await page.waitForTimeout(1800);
      const url = page.url();
      const exp = expectedUrl(pg, state);
      const u = new URL(url);
      const file = u.pathname.replace(/^\//, '') || 'index.html';
      const label = `${vp} · ${state} · ${pg}`;
      const okFile = exp.file === '404' ? /halaman-tidak-ada/.test(u.pathname) : file === exp.file;
      R.ok(`${label}: lands on ${exp.file}`, okFile, `actual ${u.pathname}${u.search}`);
      if (exp.next) R.ok(`${label}: next= carries the page`, u.searchParams.get('next') === exp.next, `next=${u.searchParams.get('next')}`);
      await page.waitForTimeout(900);
      const info = await page.evaluate(() => {
        const rv = window.__rv;
        const out = {};
        out.authReady = document.body.classList.contains('auth-ready');
        out.dataAuth = document.body.getAttribute('data-auth');
        out.ribbon = rv.vis(document.querySelector('[data-demo-ribbon]'));
        out.hasHeader = !!document.querySelector('.site-header');
        out.guestBtns = rv.all('.account__guest .btn');
        out.trigger = !!document.querySelector('.account__trigger');
        out.mobileFoot = rv.all('[data-mobile-account] .btn');
        out.locked = [...document.querySelectorAll('.locked')].filter(rv.vis).map(l => ({ title: rv.txt('.locked__title', l), cta: rv.all('.locked__actions .btn, .locked__actions a', l) }));
        out.portalBar = rv.txt('.portal, .portal-bar, #portal-bar, .app-portal, [class*="portal"]');
        out.gateMsg = rv.txt('#app-gate-msg');
        out.gatePending = document.documentElement.classList.contains('app-gate-pending');
        out.title = document.title;
        out.h1 = rv.txt('h1');
        out.main = rv.vis(document.querySelector('main'));
        out.footerCredit = rv.txt('.site-footer__credit') || rv.txt('footer');
        out.primaryCtas = rv.allVis('main .btn--primary').slice(0, 12);
        return out;
      });
      let menu = null;
      if (info.trigger) {
        try {
          await page.click('.account__trigger', { timeout: 3000 });
          await page.waitForTimeout(250);
          menu = await page.evaluate(() => ({ items: window.__rv.menuItems(), badges: window.__rv.all('.account-menu__status .badge'), who: window.__rv.txt('.account-menu__name'), sub: window.__rv.txt('.account-menu__sub'), open: !document.getElementById('account-menu').hidden }));
          R.ok(`${label}: account menu opens`, menu.open, JSON.stringify(menu.items));
          await page.keyboard.press('Escape');
          await page.waitForTimeout(150);
          const closed = await page.evaluate(() => ({ hidden: document.getElementById('account-menu').hidden, focus: window.__rv.focused() }));
          R.ok(`${label}: Esc closes account menu + focus returns to trigger`, closed.hidden && /account__trigger/.test(closed.focus), closed.focus);
          await page.focus('.account__trigger');
          await page.keyboard.press('ArrowDown');
          await page.waitForTimeout(150);
          const kb = await page.evaluate(() => ({ hidden: document.getElementById('account-menu').hidden, focus: window.__rv.focused() }));
          R.ok(`${label}: ArrowDown on trigger opens menu + focuses first item`, !kb.hidden && /account-menu__item/.test(kb.focus), kb.focus);
          await page.keyboard.press('Escape');
        } catch (e) { R.ok(`${label}: account menu operable`, false, e.message.slice(0, 120)); }
      }
      let mob = null;
      if (vp === 'mobile' && info.hasHeader) {
        try {
          await page.click('.menu-toggle', { timeout: 3000 });
          await page.waitForTimeout(400);
          mob = await page.evaluate(() => ({ open: document.querySelector('.menu-toggle').getAttribute('aria-expanded') === 'true', links: window.__rv.all('.mobile-menu__link'), foot: window.__rv.all('[data-mobile-account] .btn'), current: window.__rv.all('.mobile-menu__link[aria-current]'), focus: window.__rv.focused() }));
          R.ok(`${label}: mobile menu opens with 7 nav links`, mob.open && mob.links.length === 7, JSON.stringify(mob.links));
          let inside = true, where = '';
          for (let i = 0; i < 14; i++) { await page.keyboard.press('Tab'); const f = await page.evaluate(() => { const a = document.activeElement; return { in: !!(a && (a.closest('#mobile-menu') || a.closest('.menu-toggle') || a.closest('.site-header'))), who: window.__rv.focused() }; }); if (!f.in) { inside = false; where = f.who; break; } }
          R.ok(`${label}: mobile menu keeps keyboard focus inside`, inside, where);
          await page.keyboard.press('Escape');
          await page.waitForTimeout(300);
          const after = await page.evaluate(() => ({ open: document.querySelector('.menu-toggle').getAttribute('aria-expanded') === 'true', focus: window.__rv.focused() }));
          R.ok(`${label}: Esc closes mobile menu + focus on toggle`, !after.open && /menu-toggle/.test(after.focus), after.focus);
        } catch (e) { R.ok(`${label}: mobile menu operable`, false, e.message.slice(0, 120)); }
      }
      const texts = await toasts(page);
      const dup = texts.filter((t, i) => texts.indexOf(t) !== i);
      R.ok(`${label}: no duplicated toast`, dup.length === 0, JSON.stringify(dup));
      if (exp.toast) R.ok(`${label}: flash toast "${exp.toast}" shown once`, texts.filter(t => t === exp.toast).length === 1, JSON.stringify(texts));
      if (!exp.toast && !/aplikasi/.test(pg)) R.ok(`${label}: no unexpected toast on load`, texts.length === 0, JSON.stringify(texts));
      R.ok(`${label}: no console/page/request errors`, issues.length === 0, issues.slice(0, 3).join(' | '));
      if (!/aplikasi/.test(pg) && exp.file !== 'masuk.html') R.ok(`${label}: footer credit present`, /mrezahuzain@2026/.test(info.footerCredit || ''), String(info.footerCredit).slice(0, 80));
      matrix[`${vp}|${state}|${pg}`] = { url: url.replace(BASE, ''), ms: Date.now() - t0, info, menu, mob, toasts: texts, issues };
      if (['signed-out', 'Aktif', 'admin', 'Draf'].includes(state)) await shot(page, `st-${vp}-${state}-${pg.replace(/[\/]/g, '_')}`);
      await page.close();
    }
    await context.close();
  }
}
fs.writeFileSync(path.join(RSHOTS, 'states.json'), JSON.stringify(matrix, null, 1));
await browser.close();
await srv.close();
const failed = R.summary();
console.log('Matrix: shots/review-fungsi/states.json');
process.exit(failed ? 1 : 0);
