// Probe: signed-in Aktif member opening pendaftaran.html with an unusual #hash ends on masuk.html?
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';

const { BASE, close } = await startServer();
const USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const MEMBER = { uid: USER.uid, name: USER.name, email: USER.email, phone: USER.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31', approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001', profile: {}, competencies: [], certificates: [], application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z' } };
const browser = await chromium.launch();
for (const url of ['pendaftaran.html#%3Csvg%2Fonload%3D__x(1)%3E', 'pendaftaran.html#abc', 'pendaftaran.html', 'masuk.html?next=' + encodeURIComponent('pendaftaran.html#<svg/onload=__x(1)>'), 'masuk.html?next=' + encodeURIComponent('pendaftaran.html#abc')]) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(s => { try { if (sessionStorage.getItem('__s')) return; sessionStorage.setItem('__s', '1'); localStorage.setItem('ppapi_demo_seed_v2', '{"v":2}'); localStorage.setItem('ppapi_demo_session', JSON.stringify(s.u)); localStorage.setItem('ppapi_member_' + s.u.uid, JSON.stringify(s.m)); } catch (e) {} }, { u: USER, m: MEMBER });
  const page = await ctx.newPage();
  const navs = [];
  page.on('framenavigated', f => { if (f === page.mainFrame()) navs.push(f.url().replace(BASE, '')); });
  page.on('console', m => { if (/error|warn/.test(m.type())) console.log('   console', m.type(), m.text().slice(0, 160)); });
  page.on('pageerror', e => console.log('   pageerror', e.message.slice(0, 200)));
  await page.goto(`${BASE}/${url}`, { waitUntil: 'networkidle' }).catch(e => console.log('goto', e.message));
  await page.waitForTimeout(2500);
  const st = await page.evaluate(() => ({ sess: localStorage.getItem('ppapi_demo_session') ? 'yes' : 'no', ss: sessionStorage.getItem('ppapi_demo_session') ? 'yes' : 'no' }));
  console.log(url, '\n   navs:', navs.join('  →  '), '\n   session:', JSON.stringify(st));
  await ctx.close();
}
await browser.close();
await close();
