// Probe (repeat): signed-in member, masuk.html?next=pendaftaran.html#<svg…> — where does it end?
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
const { BASE, close } = await startServer();
const USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const MEMBER = { uid: USER.uid, name: USER.name, email: USER.email, phone: USER.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31', approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001', profile: {}, competencies: [], certificates: [], application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z' } };
const browser = await chromium.launch();
for (let i = 0; i < 4; i++) for (const v of ['pendaftaran.html#<svg/onload=__x(1)>', 'anggota.html#kartu']) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(s => { window.__hits = []; window.__x = j => window.__hits.push(j); try { if (sessionStorage.getItem('__seeded')) return; sessionStorage.setItem('__seeded', '1'); localStorage.setItem('ppapi_demo_seed_v2', JSON.stringify({ v: 2 })); localStorage.setItem('ppapi_demo_session', JSON.stringify(s.user)); localStorage.setItem('ppapi_member_' + s.user.uid, JSON.stringify(s.member)); localStorage.setItem('ppapi_demo_admins', JSON.stringify(s.admins)); } catch (e) {} }, { user: USER, member: MEMBER });
  const page = await ctx.newPage();
  const navs = [];
  page.on('framenavigated', f => { if (f === page.mainFrame()) navs.push(f.url().replace(BASE + '/', '')); });
  await page.goto(`${BASE}/masuk.html?next=${encodeURIComponent(v)}`, { waitUntil: 'networkidle' }).catch(() => {});
  await page.waitForTimeout(1500);
  console.log(i, v, '→', navs.join(' → '), '| hits', JSON.stringify(await page.evaluate(() => window.__hits).catch(() => 'x')));
  await ctx.close();
}
await browser.close(); await close();
