// review-fungsi-lib — shared helpers for the FUNCTIONAL review flows (review-fungsi-*.mjs). REVIEW ONLY: never
// writes to site/. Builds on qa-lib.mjs (server, fixtures, recorder) and adds: member fixtures per status (same
// rules as check.mjs --status), admin seeding, page opening with console/pageerror/request capture, toast capture,
// screenshots under devtools/shots/review-fungsi/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { startServer, seedAuth, freezeClock, waitReady, recorder, DEMO_USER, DEMO_MEMBER, registryEntryFor, ROOT } from './qa-lib.mjs';

export { startServer, seedAuth, freezeClock, waitReady, recorder, DEMO_USER, DEMO_MEMBER, registryEntryFor, ROOT };
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const RSHOTS = path.resolve(__dirname, '..', 'shots', 'review-fungsi');
fs.mkdirSync(RSHOTS, { recursive: true });

export const STATUSES = ['Draf', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Aktif', 'Ditolak', 'Nonaktif', 'Kedaluwarsa'];
export const ADMIN_USER = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };

/** Member fixture for a status — identical rules to check.mjs --auth --status=X */
export function memberFor(status) {
  const m = structuredClone(DEMO_MEMBER);
  if (!status || status === 'Aktif') return m;
  if (status === 'Kedaluwarsa') { m.validUntil = '2026-06-30'; return m; }
  m.status = status;
  if (['Draf', 'Menunggu Verifikasi', 'Perlu Perbaikan', 'Ditolak'].includes(status)) Object.assign(m, { kta: '', validUntil: '', approvedAt: '', approvedBy: '' });
  if (status === 'Draf') m.application.submittedAt = '';
  if (status === 'Perlu Perbaikan') m.review = { note: 'Mohon lengkapi tautan sertifikat dan riwayat proyek.', history: [{ at: '2026-10-01T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'perbaikan', note: 'Mohon lengkapi tautan sertifikat dan riwayat proyek.' }] };
  if (status === 'Ditolak') m.review = { note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.', history: [{ at: '2026-10-01T03:00:00.000Z', by: 'demo-admin-0001', byName: 'Admin PPAPI (Demo)', action: 'ditolak', note: 'Pengalaman di bidang perancah belum memenuhi syarat kategori.' }] };
  return m;
}

export async function seedAdmin(context) {
  await context.addInitScript(({ a }) => {
    try {
      if (!localStorage.getItem('ppapi_demo_session')) localStorage.setItem('ppapi_demo_session', JSON.stringify(a));
      const admins = JSON.parse(localStorage.getItem('ppapi_demo_admins') || '[]');
      if (!admins.includes(a.uid)) { admins.push(a.uid); localStorage.setItem('ppapi_demo_admins', JSON.stringify(admins)); }
    } catch (e) {}
  }, { a: ADMIN_USER });
}

/** state: 'signed-out' | 'admin' | one of STATUSES */
export async function seedState(context, state) {
  if (!state || state === 'signed-out') return;
  if (state === 'admin') return seedAdmin(context);
  return seedAuth(context, { member: memberFor(state) });
}

export const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

export async function launch(opts = {}) {
  return chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'], ...opts });
}

export async function newContext(browser, { vp = 'desktop', state = 'signed-out', clock = null, motion = false, extra = {} } = {}) {
  const context = await browser.newContext({ ...VIEWPORTS[vp], reducedMotion: motion ? 'no-preference' : 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta', ...extra });
  if (clock) await freezeClock(context, clock);
  await seedState(context, state);
  await context.addInitScript(PAGE_HELPERS);
  await context.addInitScript(TOAST_HOOK);
  return context;
}

const TOAST_HOOK = `(() => {
  window.__rvToasts = [];
  const seen = new WeakSet();
  const scan = () => document.querySelectorAll('.toast').forEach(el => {
    if (seen.has(el)) return; seen.add(el);
    const msg = el.querySelector('.toast__msg');
    window.__rvToasts.push({ type: (el.className.match(/toast--(\\w+)/) || [])[1] || '', text: (msg ? msg.textContent : el.textContent).replace(/\\s+/g, ' ').trim(), at: Date.now(), page: location.pathname + location.search });
  });
  const start = () => { try { new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true }); } catch (e) {} };
  if (document.documentElement) start(); else document.addEventListener('DOMContentLoaded', start);
})();`;

/** Attach capture of console errors/warnings, page errors, failed requests, HTTP >= 400. Toasts: page.evaluate(() => window.__rvToasts). */
export function watch(page, tag = '') {
  const issues = [];
  page.on('console', m => { if (['error', 'warning'].includes(m.type())) issues.push(`${tag}console.${m.type()}: ${m.text().slice(0, 300)} @ ${page.url()}`); });
  page.on('pageerror', e => issues.push(`${tag}pageerror: ${String(e.message).slice(0, 300)} @ ${page.url()}`));
  page.on('requestfailed', r => { const u = r.url(); if (/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/.test(u)) return; if (/net::ERR_ABORTED/.test(r.failure()?.errorText || '')) return; issues.push(`${tag}requestfailed: ${u} (${r.failure()?.errorText}) @ ${page.url()}`); });
  page.on('response', r => { if (r.status() >= 400 && !r.url().endsWith('/favicon.ico') && /127\.0\.0\.1/.test(r.url())) issues.push(`${tag}HTTP ${r.status()}: ${r.url()} @ ${page.url()}`); });
  return issues;
}
export async function toasts(page) { return page.evaluate(() => (window.__rvToasts || []).map(t => t.text)).catch(() => []); }

export async function open(page, url, { wait = 600, ready = true } = {}) {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 }).catch(() => {});
  if (ready) await waitReady(page);
  await page.waitForTimeout(wait);
}

export async function shot(page, name, full = false) {
  const p = path.join(RSHOTS, name.replace(/[^a-z0-9_.-]+/gi, '_') + '.png');
  try { await page.screenshot({ path: p, fullPage: full }); } catch (e) {}
  return 'shots/review-fungsi/' + path.basename(p);
}

/** Visible text helpers inside the page */
export const PAGE_HELPERS = `
  window.__rv = {
    vis(el) { return !!(el && (el.offsetWidth || el.offsetHeight || el.getClientRects().length)); },
    txt(sel, root) { const el = (root || document).querySelector(sel); return el ? el.textContent.replace(/\\s+/g, ' ').trim() : null; },
    all(sel, root) { return [...(root || document).querySelectorAll(sel)].map(e => e.textContent.replace(/\\s+/g, ' ').trim()); },
    allVis(sel, root) { return [...(root || document).querySelectorAll(sel)].filter(e => window.__rv.vis(e)).map(e => e.textContent.replace(/\\s+/g, ' ').trim()); },
    menuItems() { return [...document.querySelectorAll('#account-menu [role="menuitem"]')].map(e => e.textContent.replace(/\\s+/g, ' ').trim()); },
    focused() { const a = document.activeElement; if (!a) return ''; return a.tagName.toLowerCase() + (a.id ? '#' + a.id : '') + (a.className && typeof a.className === 'string' ? '.' + a.className.split(/\\s+/).slice(0, 2).join('.') : '') + ' "' + (a.textContent || a.value || '').replace(/\\s+/g, ' ').trim().slice(0, 40) + '"'; },
    btnByText(t, root) { return [...(root || document).querySelectorAll('button, a')].find(b => window.__rv.vis(b) && b.textContent.replace(/\\s+/g, ' ').trim() === t) || null; },
  };`;

/** A small JPEG generated in the page (canvas) → data URL; `noisy` makes a large, incompressible one. */
export const GEN_IMG = `(function (w, h, noisy, type) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = '#888'; x.fillRect(0, 0, w, h);
  if (noisy) { const img = x.getImageData(0, 0, w, h); for (let i = 0; i < img.data.length; i += 4) { img.data[i] = Math.random() * 255; img.data[i+1] = Math.random() * 255; img.data[i+2] = Math.random() * 255; img.data[i+3] = 255; } x.putImageData(img, 0, 0); }
  else { x.fillStyle = '#222'; x.beginPath(); x.arc(w / 2, h / 2.6, w / 5, 0, Math.PI * 2); x.fill(); x.fillRect(w * 0.3, h * 0.5, w * 0.4, h * 0.4); }
  return c.toDataURL(type || 'image/jpeg', 0.92);
})`;

export function dataUrlToBuffer(dataUrl) { return Buffer.from(dataUrl.split(',')[1], 'base64'); }

/** click a visible button/link by its exact text */
export async function clickText(page, text, root = 'body') {
  const ok = await page.evaluate(({ text, root }) => { const r = document.querySelector(root) || document; const b = window.__rv.btnByText(text, r); if (b) { b.click(); return true; } return false; }, { text, root });
  if (!ok) throw new Error('button not found: ' + text);
}
