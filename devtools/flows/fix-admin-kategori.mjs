// Fixer "admin" — approve-dialog kategori defaults (findings: Kehormatan written around the store;
// perpanjangan defaulting to the old applied category). Demo mode, 1440×900.
// Seeds five applications, then per applicant: queue cell text, drawer notice, approve-dialog default,
// attention styling + hint; finally approves the Ahli→Praktisi renewal with the dialog's default and
// checks that memberType stays Ahli. Usage (cwd devtools/): node flows/fix-admin-kategori.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './qa-lib.mjs';
import { gen } from './fix-admin-probe.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '..', 'shots', 'fix-admin');
fs.mkdirSync(OUT, { recursive: true });
const ADMIN = { uid: 'demo-admin-0001', name: 'Admin PPAPI (Demo)', email: 'admin@ppapi.demo', phone: '', provider: 'password', photoURL: '', createdAt: '2026-01-05T01:00:00.000Z' };
const base = gen(1)[0];
function mk(uid, name, o) {
  const m = JSON.parse(JSON.stringify(base));
  Object.assign(m, { uid, name, email: uid + '@contoh.id', status: 'Menunggu Verifikasi', kta: '', approvedAt: '', approvedBy: '', validUntil: '', memberType: 'Praktisi' }, o.m || {});
  Object.assign(m.application, { submittedAt: '2026-10-01T02:00:00.000Z' }, o.a || {});
  m.updatedAt = '2026-10-01T02:00:00.000Z';
  return m;
}
const APPROVED = { kta: '', approvedAt: '2025-06-01T02:00:00.000Z', approvedBy: ADMIN.uid, validUntil: '2026-06-30', joinedAt: '2025-06-01' };
const SEED = [
  mk('kt-kehormatan', 'Uji Kehormatan Baru', { a: { type: 'baru', kategori: 'Kehormatan' } }),
  mk('kt-renew-down', 'Uji Perpanjangan Ahli', { m: { ...APPROVED, memberType: 'Ahli', kta: 'PPAPI-2025-000901' }, a: { type: 'perpanjangan', kategori: 'Praktisi' } }),
  mk('kt-renew-same', 'Uji Perpanjangan Sama', { m: { ...APPROVED, memberType: 'Ahli', kta: 'PPAPI-2025-000902' }, a: { type: 'perpanjangan', kategori: 'Ahli' } }),
  mk('kt-new-ahli', 'Uji Baru Ahli', { a: { type: 'baru', kategori: 'Ahli' } }),
  mk('kt-renew-hon', 'Uji Perpanjangan Kehormatan', { m: { ...APPROVED, memberType: 'Kehormatan', kta: 'PPAPI-2025-000903' }, a: { type: 'perpanjangan', kategori: 'Kehormatan' } }),
  mk('kt-renew-hon-ask', 'Uji Ahli Minta Kehormatan', { m: { ...APPROVED, memberType: 'Ahli', kta: 'PPAPI-2025-000904' }, a: { type: 'perpanjangan', kategori: 'Kehormatan' } }),
];
const EXPECT = {
  'kt-kehormatan': { def: 'Praktisi', attention: true, notice: /Kehormatan tidak dapat diajukan pemohon/, cell: /^Kehormatan Tidak dapat diajukan pemohon Pendaftaran baru$/ },
  'kt-renew-down': { def: 'Ahli', attention: true, notice: /perubahan kategori: Ahli → Praktisi/, cell: /Ahli → Praktisi/ },
  'kt-renew-same': { def: 'Ahli', attention: false, notice: null, cell: /^Ahli Perpanjangan$/ },
  'kt-new-ahli': { def: 'Ahli', attention: false, notice: null, cell: /^Ahli Pendaftaran baru$/ },
  'kt-renew-hon': { def: 'Kehormatan', attention: false, notice: null, cell: /^Kehormatan Perpanjangan$/ },
  'kt-renew-hon-ask': { def: 'Ahli', attention: true, notice: /Kehormatan tidak dapat diajukan pemohon/, cell: /^Ahli Meminta Kehormatan \(tidak dapat diajukan pemohon\) Perpanjangan$/ },
};

const { BASE, close } = await startServer();
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce', locale: 'id-ID', timezoneId: 'Asia/Jakarta' });
await ctx.addInitScript(({ a, ms }) => { try { if (!localStorage.getItem('ppapi_demo_session')) { localStorage.setItem('ppapi_demo_ribbon_dismissed', 'true'); localStorage.setItem('ppapi_demo_session', JSON.stringify(a)); localStorage.setItem('ppapi_demo_admins', JSON.stringify([a.uid])); for (const m of ms) localStorage.setItem('ppapi_member_' + m.uid, JSON.stringify(m)); } } catch (e) {} }, { a: ADMIN, ms: SEED });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
let pass = 0, fail = 0;
const ok = (name, cond, detail = '') => { cond ? pass++ : fail++; console.log((cond ? 'PASS ' : 'FAIL ') + name + (detail ? '  — ' + detail : '')); };
const esc = async () => { await page.keyboard.press('Escape'); await page.waitForTimeout(350); };
await page.goto(BASE + '/admin.html#permohonan', { waitUntil: 'networkidle' });
await page.waitForSelector('html[data-admin-ready]');
await page.waitForTimeout(400);
for (const m of SEED) {
  const e = EXPECT[m.uid];
  const cell = await page.$eval(`#pq-list tr:has([data-id="${m.uid}"]) td[data-label="Kategori"]`, td => td.innerText.replace(/\s+/g, ' ').trim());
  ok(`${m.uid} queue kategori cell`, e.cell.test(cell), cell);
  await page.click(`#pq-list .adm-act[data-id="${m.uid}"]`);
  await page.waitForSelector('.drawer__panel');
  await page.waitForTimeout(300);
  const drawerNote = await page.$$eval('.drawer .adm-kat-note', n => n.map(x => x.innerText.replace(/\s+/g, ' ')).join(' | '));
  ok(`${m.uid} drawer notice`, e.notice ? e.notice.test(drawerNote) : drawerNote === '', drawerNote || '(none)');
  await page.click('#act-approve');
  await page.waitForSelector('.modal [name="memberType"]');
  await page.waitForTimeout(300);
  const d = await page.evaluate(() => {
    const s = document.querySelector('.modal [name="memberType"]');
    const f = s.closest('.field');
    return { value: s.value, attention: f.classList.contains('adm-field--attention'), hint: (f.querySelector('.field__hint') || {}).innerText || '', note: [...document.querySelectorAll('.modal .adm-kat-note .alert__title')].map(x => x.innerText).join(' | ') };
  });
  ok(`${m.uid} approve default = ${e.def}`, d.value === e.def, JSON.stringify(d));
  ok(`${m.uid} attention styling ${e.attention ? 'on' : 'off'}`, d.attention === e.attention);
  if (m.uid === 'kt-kehormatan' || m.uid === 'kt-renew-down') await page.screenshot({ path: path.join(OUT, `kategori-dialog-${m.uid}.png`) });
  if (m.uid === 'kt-renew-down') {
    await page.click('#dlg-approve-ok');
    await page.waitForSelector('.adm-modal--kta', { timeout: 10000 });
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_member_kt-renew-down')));
    ok('kt-renew-down approved with the default keeps memberType Ahli and the KTA', stored.status === 'Aktif' && stored.memberType === 'Ahli' && stored.kta === 'PPAPI-2025-000901', `${stored.status} / ${stored.memberType} / ${stored.kta}`);
  }
  await esc(); await esc();
}
ok('no console/page errors', !errs.length, errs.join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close(); await close();
process.exit(fail ? 1 : 0);
