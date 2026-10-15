// probe: can a keyboard user scroll an overflowing ui.modal body that has no focusable content? (review only)
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
const U = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const M = { uid: U.uid, name: U.name, email: U.email, phone: U.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31', approvedAt: '2026-03-20T03:00:00.000Z', profile: { city: 'Balikpapan' }, competencies: [], certificates: [], application: { submittedAt: '2026-03-15T02:00:00.000Z' } };
const { BASE, close } = await startServer();
const browser = await chromium.launch();
for (const vp of [{ n: 'desktop', w: 1440, h: 900 }, { n: 'laptop', w: 1366, h: 768 }, { n: 'mobile', w: 390, h: 844, m: true }]) {
  const ctx = await browser.newContext({ viewport: { width: vp.w, height: vp.h }, isMobile: !!vp.m, hasTouch: !!vp.m, reducedMotion: 'reduce' });
  await ctx.addInitScript(({ u, m }) => { if (!localStorage.getItem('ppapi_demo_session')) { localStorage.setItem('ppapi_demo_session', JSON.stringify(u)); const us = {}; us[u.email] = { ...u, hash: 'x' }; localStorage.setItem('ppapi_demo_users', JSON.stringify(us)); localStorage.setItem('ppapi_member_' + u.uid, JSON.stringify(m)); } }, { u: U, m: M });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/pustaka.html?id=cop-inspeksi-penandaan`, { waitUntil: 'networkidle' });
  await page.waitForSelector('.modal__dialog', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(800);
  const st = () => page.evaluate(() => { const b = document.querySelector('.modal__body'); const a = document.activeElement; return { overflow: b ? b.scrollHeight - b.clientHeight : null, top: b ? Math.round(b.scrollTop) : null, focus: a ? a.tagName + '.' + a.className + ' "' + (a.textContent || '').trim().slice(0, 20) + '"' : null, focusables: b ? b.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])').length : null, bodyTabindex: b && b.getAttribute('tabindex') }; });
  const s0 = await st();
  for (const k of ['ArrowDown', 'ArrowDown', 'PageDown', 'End']) await page.keyboard.press(k);
  await page.waitForTimeout(300);
  const s1 = await st();
  // Tab around and try again from each stop
  const seq = [];
  for (let i = 0; i < 4; i++) { await page.keyboard.press('Tab'); await page.waitForTimeout(80); const a = await st(); for (const k of ['ArrowDown', 'ArrowDown', 'ArrowDown']) await page.keyboard.press(k); await page.waitForTimeout(150); const b = await st(); seq.push(`${a.focus} top ${a.top}->${b.top}`); if (!(await page.$('.modal__dialog'))) break; }
  console.log(vp.n, JSON.stringify({ before: s0, afterKeysOnInitialFocus: s1 }), '\n   ' + seq.join('\n   '));
  await ctx.close();
}
await browser.close(); await close();
