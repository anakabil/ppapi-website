// review-lib — shared helpers for the visual review (review-*.mjs). Read-only: never touches ../site.
// Server: qa-lib startServer (GitHub-Pages-like: nested 404, /x/ → index). Screenshots → shots/review-tampilan/.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer, DEMO_USER, DEMO_MEMBER as BASE_MEMBER, registryEntryFor } from './qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const OUT = path.resolve(__dirname, '..', 'shots', 'review-tampilan');
fs.mkdirSync(OUT, { recursive: true });
export { startServer, DEMO_USER };

export const DEMO_ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };

/** same status fixtures as check.mjs --auth --status=X */
export function withStatus(st = 'Aktif') {
  const m = structuredClone(BASE_MEMBER);
  if (st === 'Kedaluwarsa') { m.validUntil = '2026-06-30'; return m; }
  if (st === 'Aktif') return m;
  m.status = st;
  if (['Draf', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Ditolak'].includes(st)) Object.assign(m, { kta: '', validUntil: '', approvedAt: '', approvedBy: '' });
  if (st === 'Draf') m.application.submittedAt = '';
  if (st === 'Perlu Perbaikan') m.review = { note: 'Mohon lengkapi tautan sertifikat dan riwayat proyek.', history: [{ at: '2026-10-01T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'perbaikan', note: 'Mohon lengkapi tautan sertifikat dan riwayat proyek.' }] };
  if (st === 'Ditolak') m.review = { note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.', history: [{ at: '2026-10-01T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'ditolak', note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.' }] };
  return m;
}

export const VPS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  laptop: { viewport: { width: 1024, height: 768 } },
  tablet: { viewport: { width: 768, height: 1024 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

/** swiftshader (WebGL for the simulator) caps full-page captures at 8192 device px — content below wraps to the top.
 *  Only review-apps asks for it; everything else uses plain headless Chromium. */
export async function launch({ swiftshader = false, ...opts } = {}) {
  return chromium.launch({ ...(swiftshader ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {}), ...opts });
}

/**
 * auth: false | 'Aktif' | 'Draf' | … | 'admin'   motion: keep animations
 */
export async function makeCtx(browser, vp = 'desktop', { auth = false, motion = false, member = null, dsf } = {}) {
  const base = { ...VPS[vp] };
  if (dsf) base.deviceScaleFactor = dsf;
  const ctx = await browser.newContext({ ...base, reducedMotion: motion ? 'no-preference' : 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta', acceptDownloads: true });
  if (auth === 'admin') {
    await ctx.addInitScript(({ a }) => {
      try {
        if (!localStorage.getItem('ppapi_demo_session')) localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
        const admins = JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]');
        if (!admins.includes(a.uid)) { admins.push(a.uid); localStorage.setItem('ppapi_demo_admins', JSON.stringify(admins)); }
      } catch (e) {}
    }, { a: DEMO_ADMIN });
  } else if (auth) {
    const m = member || withStatus(auth === true ? 'Aktif' : auth);
    await ctx.addInitScript(({ u, m, r }) => {
      try {
        if (!localStorage.getItem('ppapi_demo_session')) {
          localStorage.setItem('ppapi_demo_session', JSON.stringify(u));
          const users = JSON.parse(localStorage.getItem('ppapi_demo_users') || '{}');
          users[u.email] = { uid: u.uid, name: u.name, email: u.email, phone: u.phone, provider: u.provider, createdAt: u.createdAt, hash: 'x' };
          localStorage.setItem('ppapi_demo_users', JSON.stringify(users));
          localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m));
          if (r) {
            let reg = JSON.parse(localStorage.getItem('ppapi_registry') || '{}');
            if (!reg || typeof reg !== 'object' || Array.isArray(reg)) reg = {};
            reg[r.kta] = r;
            localStorage.setItem('ppapi_registry', JSON.stringify(reg));
          }
        }
      } catch (e) {}
    }, { u: DEMO_USER, m, r: registryEntryFor(m) });
  }
  return ctx;
}

export async function open(ctx, BASE, url, { wait = 700, until = 'networkidle' } = {}) {
  const page = await ctx.newPage();
  const issues = [];
  page.on('pageerror', e => issues.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') issues.push('console.error: ' + m.text().slice(0, 200)); });
  page.on('dialog', async d => { issues.push('dialog: ' + d.message()); await d.dismiss(); });
  await page.goto(BASE + '/' + url, { waitUntil: until, timeout: 45000 }).catch(e => issues.push('goto: ' + e.message.split('\n')[0]));
  try { await page.waitForFunction(() => window.PPAPI && typeof window.PPAPI.isReady === 'function' ? window.PPAPI.isReady() : true, null, { timeout: 12000 }); } catch (e) {}
  await page.waitForTimeout(wait);
  page.__issues = issues;
  return page;
}

/** scroll through the page so lazy images / reveals load, then back to top */
export async function scrollAll(page, back = true) {
  await page.evaluate(async (back) => {
    const step = Math.round(innerHeight * 0.8);
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) { scrollTo(0, y); await new Promise(r => setTimeout(r, 120)); }
    if (back) scrollTo(0, 0);
  }, back);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(400);
}

export async function shot(page, name, { full = false, clip = null, el = null, scroll = false } = {}) {
  const file = path.join(OUT, name + '.png');
  if (scroll) await scrollAll(page);
  if (el) {
    const loc = page.locator(el).first();
    if (await loc.count()) { await loc.scrollIntoViewIfNeeded().catch(() => {}); await page.waitForTimeout(150); await loc.screenshot({ path: file }); console.log('  shot', name); return file; }
  }
  await page.screenshot({ path: file, fullPage: full, ...(clip ? { clip } : {}) });
  console.log('  shot', name);
  return file;
}

export async function overflow(page) {
  return page.evaluate(() => Math.max(document.documentElement.scrollWidth - document.documentElement.clientWidth, 0));
}

export const log = [];
export async function safe(label, fn) {
  try { await fn(); }
  catch (e) { const msg = `FAIL ${label}: ${String(e && e.message || e).split('\n')[0].slice(0, 300)}`; console.log('  ' + msg); log.push(msg); }
}
export function report(page, label) {
  if (page && page.__issues && page.__issues.length) { console.log(`  ! ${label}: ` + page.__issues.slice(0, 3).join(' | ')); log.push(`${label}: ` + page.__issues.slice(0, 3).join(' | ')); }
}
export function finish(name) {
  console.log(`\n${name} done. ${log.length} note(s).`);
  if (log.length) console.log(log.map(l => ' - ' + l).join('\n'));
}
