// CPU profile of a page load (review only): top self-time functions + long-task attribution
// usage: node flows/v2lens-profile.mjs <page.html> [--state=guest|auth|admin] [--cpu=4]
import { chromium } from 'playwright';
import { startServer } from './qa-lib.mjs';
const args = process.argv.slice(2);
const flags = Object.fromEntries(args.filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const pg = args.find(a => !a.startsWith('--')) || 'index.html';
const { BASE, close } = await startServer();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
if (flags.state === 'admin') await ctx.addInitScript(() => { localStorage.setItem('ppapi_demo_session', JSON.stringify({ uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' })); localStorage.setItem('ppapi_demo_admins', '["demo-admin-0001"]'); });
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
await cdp.send('Emulation.setCPUThrottlingRate', { rate: +(flags.cpu || 4) });
await cdp.send('Profiler.enable');
await cdp.send('Profiler.setSamplingInterval', { interval: 200 });
await cdp.send('Profiler.start');
await page.goto(`${BASE}/${pg}`, { waitUntil: 'load' });
await page.waitForTimeout(3000);
const { profile } = await cdp.send('Profiler.stop');
const byId = new Map(profile.nodes.map(n => [n.id, n]));
const self = new Map();
const dt = profile.timeDeltas; let total = 0;
profile.samples.forEach((id, i) => { const n = byId.get(id); const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').slice(-2).join('/')}:${n.callFrame.lineNumber + 1}`; self.set(k, (self.get(k) || 0) + (dt[i] || 0)); total += dt[i] || 0; });
// aggregate by url
const byUrl = new Map();
profile.samples.forEach((id, i) => { const n = byId.get(id); const u = n.callFrame.url ? n.callFrame.url.split('/').slice(-2).join('/') : `(${n.callFrame.functionName || 'native'})`; byUrl.set(u, (byUrl.get(u) || 0) + (dt[i] || 0)); });
console.log('total sampled ms', Math.round(total / 1000));
console.log('by script:', [...byUrl].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} ${Math.round(v / 1000)}ms`).join('\n  '));
console.log('top self:', [...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${Math.round(v / 1000)}ms ${k}`).join('\n  '));
await browser.close(); await close();
