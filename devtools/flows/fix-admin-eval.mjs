// Fixer "admin" helper — open the seeded console (fix-admin-probe gen) at one viewport and hash, run JS, print JSON.
// Usage (cwd devtools/): node flows/fix-admin-eval.mjs --w=768 --h=1024 --hash=anggota [--n=40] [--mobile] [--cpu=4] [--shot=name] [--full] --js="expr"
import { chromium } from 'playwright';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './qa-lib.mjs';
import { gen } from './fix-admin-probe.mjs';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const flags = Object.fromEntries(process.argv.slice(2).filter(a => a.startsWith('--')).map(a => { const [k, ...v] = a.slice(2).split('='); return [k, v.length ? v.join('=') : true]; }));
const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
const { BASE, close } = await startServer();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: +(flags.w || 1440), height: +(flags.h || 900) }, isMobile: !!flags.mobile, hasTouch: !!flags.mobile, reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
await ctx.addInitScript(({ a, ms }) => { try { if (!localStorage.getItem('ppapi_demo_session')) { localStorage.setItem('ppapi_demo_ribbon_dismissed', 'true'); localStorage.setItem('ppapi_demo_session', JSON.stringify(a)); localStorage.setItem('ppapi_demo_admins', JSON.stringify([a.uid])); for (const m of ms) localStorage.setItem('ppapi_member_' + m.uid, JSON.stringify(m)); } } catch (e) {} }, { a: ADMIN, ms: gen(+(flags.n || 40)) });
// --override=path@rev[,path@rev] serves site/<path> from git revision <rev> (A/B comparisons)
for (const spec of String(flags.override || '').split(',').filter(Boolean)) {
  const [file, rev] = spec.split('@');
  const body = execSync(`git show ${rev}:${file}`, { cwd: path.resolve(__dirname, '..', '..', 'site'), maxBuffer: 1 << 26 });
  await ctx.route(u => new URL(u).pathname === '/' + file, r => r.fulfill({ status: 200, contentType: file.endsWith('.css') ? 'text/css' : 'text/javascript', body }));
}
const p = await ctx.newPage();
if (flags.cpu) { const cdp = await ctx.newCDPSession(p); await cdp.send('Emulation.setCPUThrottlingRate', { rate: +flags.cpu }); }
const errs = []; p.on('pageerror', e => errs.push(e.message)); p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(BASE + '/admin.html#' + (flags.hash || 'ringkasan'), { waitUntil: 'networkidle' });
await p.waitForSelector('html[data-admin-ready]'); await p.waitForTimeout(500);
const out = flags.js ? await p.evaluate(flags.js) : null;
if (flags.shot) await p.screenshot({ path: path.resolve(__dirname, '..', 'shots', 'fix-admin', flags.shot + '.png'), fullPage: !!flags.full });
console.log(JSON.stringify({ out, errs }, null, 1));
await browser.close(); await close();
