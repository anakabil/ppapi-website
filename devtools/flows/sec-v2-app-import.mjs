// Security lens v2 — planning app (aplikasi/perencanaan): a crafted project .json ("Muat Data") handed to an
// ADMIN must not execute script in the portal origin (the app shares the origin with admin.html and the
// Firebase session). Imports a payload file as the demo admin, visits every view, opens the archive/admin
// panels and scans for executed payloads, on* attributes injected beyond the app's own static handlers,
// and javascript:/data:text links.
// Run from devtools/:  node flows/sec-v2-app-import.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { BASE, close } = await startServer();
let n = 0; const MAP = {};
const P = f => { const i = ++n; MAP[i] = f; return `<img src=x onerror=__x(${i})>"'><svg onload=__x(${i})>`; };
const FIELDS = ['f-proyek', 'f-lokasi', 'f-kontraktor', 'f-jenis', 'f-model', 'f-tinggi', 'f-lift', 'f-tag', 'f-tanggal', 'f-inspektor', 'f-tipe', 'f-catatan', 'f-nbay', 'f-lbay', 'f-lebar', 'f-hlift', 'f-papan', 'f-pipa', 'f-kesimpulan'];
const fields = {}; FIELDS.forEach(k => { fields[k] = P('fields.' + k); });
const payload = {
  v: 1, app: 'PPAPI Scaffold', ts: Date.now(),
  answers: { '0-0': 'ok', '0-1': P('answers.value'), [P('answers.key')]: 'ok' },
  photos: { '0-0': 'data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9Il9feCg5OTkpIi8+', '0-1': 'javascript:__x(998)', '0-2': 'data:image/png;base64,iVBORw0KGgo="onerror="__x(997)' },
  plans: [{ name: P('plans.name'), data: 'data:image/png;base64,iVBORw0KGgo=', ts: 1 }, { name: 'html', data: 'data:text/html;base64,PHNjcmlwdD5fX3goOTk2KTwvc2NyaXB0Pg==', ts: 2 }],
  dwg: { depan: [{ id: 1, t: 'note', x: 1, y: 1, txt: P('dwg.txt') }, { id: '2"onmouseover="__x(995)', t: 'pipe', x: 0, y: 0 }], samping: [], atas: [], _w: 2 },
  jsa: [{ step: P('jsa.step'), cat: P('jsa.cat'), hazard: P('jsa.hazard'), control: P('jsa.control') }],
  analisis: { vals: { 'an-bay': P('analisis.an-bay') }, mats: [{ n: P('mats.n'), q: '1"onmouseover="__x(994)', w: 2 }] },
  fields,
};
const file = path.resolve(__dirname, '..', 'shots', 'sec-v2-evil-project.json');
fs.writeFileSync(file, JSON.stringify(payload));

const ADMIN = { uid: 'demo-admin-0001', name: 'Admin ' + P('sso.name'), email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
await ctx.addInitScript(a => {
  window.__hits = []; window.__x = i => window.__hits.push(i);
  try { if (sessionStorage.getItem('__s')) return; sessionStorage.setItem('__s', '1'); localStorage.setItem('ppapi_demo_seed_v2', '{"v":2}'); localStorage.setItem('ppapi_demo_session', JSON.stringify(a)); localStorage.setItem('ppapi_demo_admins', JSON.stringify([a.uid]));
    localStorage.setItem('ppapi_app_perencanaan_users', JSON.stringify({ 'u_evil-1': { nama: '<img src=x onerror=__x(990)>', role: 'admin"><svg onload=__x(989)>', ts: 1 } }));
    localStorage.setItem('ppapi_app_perencanaan_log', JSON.stringify([{ t: '<img src=x onerror=__x(988)>', u: 'u_x', n: '<svg onload=__x(987)>', ts: 1 }]));
    localStorage.setItem('ppapi_app_perencanaan_projects_u_demo-admin-0001', JSON.stringify([{ id: '1"onclick="__x(986)', name: '<img src=x onerror=__x(985)>', tag: '<svg onload=__x(984)>', status: '<b onmouseover=__x(983)>x', fields: {}, answers: {}, ts: 1 }]));
  } catch (e) {}
}, ADMIN);
const page = await ctx.newPage();
page.on('dialog', d => d.accept().catch(() => {}));
page.on('pageerror', e => console.log('  pageerror:', e.message.slice(0, 160)));
await page.goto(`${BASE}/aplikasi/perencanaan/index.html`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1500);
const staticOn = await page.evaluate(() => { const s = new Set(); document.querySelectorAll('*').forEach(el => { for (const a of el.attributes) if (/^on/i.test(a.name)) s.add(el.tagName + '|' + a.name + '|' + a.value); }); return [...s]; });
await page.setInputFiles('#imp', file);
await page.waitForTimeout(1500);
// release QA 2026-10-10: + addMat / autoMaterial / confirmMat — the app's own constant handlers of the Tahap 5 material
// confirmation added in the v2.4.0 fix round (app.js renders them without any data in the attribute)
const scan = async (label) => {
  const r = await page.evaluate((known) => {
    const on = [], js = [];
    document.querySelectorAll('*').forEach(el => { for (const a of el.attributes) {
      if (/^on/i.test(a.name) && !known.includes(el.tagName + '|' + a.name + '|' + a.value) && !/^(go|toggleMenu|setMat|delMat|addMat|autoMaterial|confirmMat|delPlan|loadProject|delProject|wipeUserData|answer|setAns|takePhoto|openSim|logout|exportJSON|importJSON|buildPDF|printTag|saveProject|newProject|dwg|jsa|addJsa|delJsa|setJsa|ctx|tb|pal|rmPhoto|viewPlan|downloadPlan)[A-Za-z]*\(/.test(a.value)) on.push(el.tagName + '[' + a.name + '=' + a.value.slice(0, 50) + ']');
      if (/^(href|src)$/i.test(a.name) && /^\s*(javascript|data:(?!image\/(jpeg|png|webp);base64,|application\/pdf;base64,))/i.test(a.value)) js.push(el.tagName + '[' + a.name + '=' + a.value.slice(0, 40) + ']');
    } });
    return { hits: window.__hits.slice(), on: on.slice(0, 8), js: js.slice(0, 5), inj: document.querySelectorAll('img[src="x"], svg[onload], b[onmouseover]').length };
  }, staticOn);
  const bad = r.hits.length || r.on.length || r.js.length || r.inj;
  console.log((bad ? '  ✗ ' : '  ✓ ') + label + (bad ? ' ' + JSON.stringify({ hits: [...new Set(r.hits)].map(i => i + ':' + (MAP[i] || i)), on: r.on, js: r.js, inj: r.inj }) : ''));
};
await scan('after import');
console.log('  (sanity) f-proyek value:', await page.evaluate(() => (document.getElementById('f-proyek')||{}).value), '| tag text has payload:', await page.evaluate(() => (document.getElementById('tag-preview')||{}).textContent.includes('onerror')));
for (const v of ['beranda', 'proyek', 'beban', 'duty', 'gambar', 'material', 'analisis', 'jsa', 'checklist', 'laporan', 'tentang', 'admin']) {
  await page.evaluate(v => { try { go(v); } catch (e) {} }, v);
  await page.waitForTimeout(700);
  await scan('view ' + v);
}
/* archive list (projects) */
await page.evaluate(() => { try { if (typeof renderProjects === 'function') renderProjects(); if (typeof openProjects === 'function') openProjects(); } catch (e) {} });
await page.waitForTimeout(500);
await scan('archive');
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1500);
for (const v of ['proyek', 'laporan', 'gambar', 'jsa', 'admin']) { await page.evaluate(v => { try { go(v); } catch (e) {} }, v); await page.waitForTimeout(600); await scan('after reload, view ' + v); }
await browser.close(); await close();
