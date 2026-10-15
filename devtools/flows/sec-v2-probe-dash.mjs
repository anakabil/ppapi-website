// Probe: which links/sections does the NON-active dashboard render (Draf member)?
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
const { BASE, close } = await startServer();
const USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const MEMBER = { uid: USER.uid, name: USER.name, email: USER.email, phone: USER.phone, kta: '', memberType: 'Praktisi', status: 'Draf', joinedAt: '2026-03-14', profile: {}, competencies: [], certificates: [{ id: 'c1', title: 'Teknisi', number: 'X', issuer: 'Y', issuedAt: '2024-01-01', expiresAt: '2026-10-20', link: '' }] };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addInitScript(s => { try { if (sessionStorage.getItem('__s')) return; sessionStorage.setItem('__s', '1'); localStorage.setItem('ppapi_demo_seed_v2', '{"v":2}'); localStorage.setItem('ppapi_demo_session', JSON.stringify(s.u)); localStorage.setItem('ppapi_member_' + s.u.uid, JSON.stringify(s.m)); } catch (e) {} }, { u: USER, m: MEMBER });
const page = await ctx.newPage();
await page.goto(`${BASE}/dashboard.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1200);
const links = await page.evaluate(() => [...document.querySelectorAll('main a[href*="anggota.html"], main a[href*="aplikasi/"]')].map(a => {
  const sec = a.closest('section, .dash-widget, article, .locked, [class*="dash-"]');
  return (a.offsetParent ? "VISIBLE " : "hidden ") + a.getAttribute("href") + "  «" + a.textContent.trim().replace(/\s+/g, ' ').slice(0, 50) + '»  in ' + (sec ? sec.className.slice(0, 60) : '?') + (a.closest('.locked') ? ' [inside .locked]' : '');
}));
console.log(links.join('\n'));
await page.screenshot({ path: '../devtools/shots/sec-v2-dash-draf.png', fullPage: true });
await browser.close(); await close();
