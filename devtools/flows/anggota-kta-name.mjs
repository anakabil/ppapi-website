// anggota.html — KTA holder name comes from the approved snapshot (public registry entry), not the
// self-editable member.name; identity fields lock after approval; registry missing / unavailable states.
// Run from devtools/:  node flows/anggota-kta-name.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startServer } from './qa-lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHOTS = path.resolve(__dirname, '..', 'shots');
const { BASE, close } = await startServer();

const USER = { uid: 'demo-uji-0001', name: 'Rahmat Hidayat', email: 'rahmat.uji@contoh.id', phone: '+6281234567890', provider: 'password', photoURL: '', createdAt: '2026-03-14T09:00:00.000Z' };
const BASE_MEMBER = { uid: USER.uid, name: USER.name, email: USER.email, phone: USER.phone, kta: 'PPAPI-2026-004821', memberType: 'Praktisi', status: 'Aktif', joinedAt: '2026-03-14', validUntil: '2029-12-31', approvedAt: '2026-03-20T03:00:00.000Z', approvedBy: 'demo-admin-0001', profile: { city: 'Balikpapan', province: 'Kalimantan Timur', birthPlace: 'Samarinda', birthDate: '1988-04-12', company: 'PT Contoh Konstruksi', position: 'Scaffolding Supervisor', experienceYears: 9 }, competencies: [], certificates: [], application: { type: 'baru', kategori: 'Praktisi', submittedAt: '2026-03-15T02:00:00.000Z' }, review: { note: '', history: [] } };
const REG_ENTRY = { kta: 'PPAPI-2026-004821', nama: 'Rahmat Hidayat', kategori: 'Praktisi', kompetensi: [], kota: 'Balikpapan', berlakuHingga: '2029-12-31', status: 'Aktif' };
const clone = o => JSON.parse(JSON.stringify(o));

const results = [], issues = [];
function ok(name, cond, extra = '') { results.push({ name, pass: !!cond }); console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`); }
const browser = await chromium.launch();

async function open({ member = BASE_MEMBER, registry = { [REG_ENTRY.kta]: REG_ENTRY }, admin = false, hash = '#kartu', failLookup = false, viewport = { width: 1440, height: 900 }, mobile = false, label = 'page' } = {}) {
  const ctx = await browser.newContext({ viewport, locale: 'id-ID', reducedMotion: 'reduce', ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) });
  await ctx.addInitScript(s => {
    try {
      if (sessionStorage.getItem('__seeded')) return;
      sessionStorage.setItem('__seeded', '1');
      localStorage.setItem('ppapi_demo_seed_v2', '{"v":2}');
      localStorage.setItem('ppapi_demo_session', JSON.stringify(s.u));
      localStorage.setItem('ppapi_member_' + s.u.uid, JSON.stringify(s.m));
      if (s.r) localStorage.setItem('ppapi_registry', JSON.stringify(s.r));
      if (s.admin) localStorage.setItem('ppapi_demo_admins', JSON.stringify([s.u.uid]));
    } catch (e) {}
  }, { u: USER, m: member, r: registry, admin });
  if (failLookup) {
    // registry read fails (e.g. offline): wrap lookup once the real store has loaded
    await ctx.route('**/assets/js/store.js', async route => {
      const resp = await route.fetch();
      const body = (await resp.text()) + '\n;(function(){var r=PPAPI.store.registry;window.__realLookup=r.lookup;r.lookup=function(){return window.__failLookup===false?window.__realLookup.apply(this,arguments):Promise.reject(new Error("offline (uji)"));};})();';
      await route.fulfill({ response: resp, body });
    });
  }
  const page = await ctx.newPage();
  page.on('console', m => { if (['error', 'warning'].includes(m.type()) && !/offline \(uji\)/.test(m.text())) issues.push(`[${label}] console.${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => issues.push(`[${label}] pageerror: ${e.message}`));
  await page.goto(`${BASE}/anggota.html${hash}`, { waitUntil: 'networkidle' });
  await page.waitForSelector('body.auth-ready');
  await page.waitForFunction(() => { const a = document.querySelector('#kartu-area'); return a && !a.hasAttribute('aria-busy') && !a.querySelector('.skeleton'); }, null, { timeout: 15000 });
  return { ctx, page };
}
const text = async (page, sel) => ((await page.locator(sel).first().textContent().catch(() => '')) || '').replace(/\s+/g, ' ').trim();

try {
  /* A. Approved member renames themself. Release QA: the store (and the rules, identityKept) now refuse it —
        store/identity-locked. The record is then renamed AROUND the store (older data / a write made before the rules
        change) to keep checking that the card still follows the registry snapshot. */
  {
    const { ctx, page } = await open({ label: 'renamed' });
    ok('A0 card shows registry name before rename', (await text(page, '.agt-kta__name')) === 'Rahmat Hidayat');
    ok('A0 no name notice while profile = registry', (await page.locator('.agt-namenote').count()) === 0);
    const refused = await page.evaluate(async () => { try { await PPAPI.store.saveMember(PPAPI.auth.current().uid, { name: 'Ir. Budi Santoso, M.T.' }); return 'NO ERROR'; } catch (e) { return e.code; } });
    ok('A0b store refuses a rename after approval (store/identity-locked)', refused === 'store/identity-locked', refused);
    const saved = await page.evaluate(() => { const k = 'ppapi_member_' + PPAPI.auth.current().uid, m = JSON.parse(localStorage.getItem(k)); m.name = 'Ir. Budi Santoso, M.T.'; localStorage.setItem(k, JSON.stringify(m)); return m.name; });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => { const a = document.querySelector('#kartu-area'); return a && !a.hasAttribute('aria-busy') && a.querySelector('#kta'); });
    const card = await text(page, '.agt-kta__name');
    ok('A1 renamed profile does NOT change the KTA card (registry snapshot)', saved === 'Ir. Budi Santoso, M.T.' && card === 'Rahmat Hidayat', `saved=${saved} card=${card}`);
    ok('A2 details list "Nama pemegang" = registry name', (await text(page, '.agt-kta-info .kv__row:first-child dd')) === 'Rahmat Hidayat');
    ok('A3 print header carries the registry name', /— Rahmat Hidayat ·/.test(await text(page, '.agt-kta-print-head')));
    const note = await text(page, '.agt-namenote');
    ok('A4 info notice explains the difference + secretariat route', /mengikuti data yang tercatat di sekretariat/.test(note) && /“Rahmat Hidayat”/.test(note) && /“Ir\. Budi Santoso, M\.T\.”/.test(note) && (await page.locator('.agt-namenote a[href="umpan-balik.html?kategori=Pertanyaan"]').count()) === 1, note);
    ok('A5 notice is informational (alert--info)', await page.locator('.agt-namenote').evaluate(el => el.classList.contains('alert--info')));
    const verify = await page.evaluate(async () => (await PPAPI.store.registry.lookup('PPAPI-2026-004821')).exact.nama);
    ok('A6 card name = what the QR verification page shows', verify === card, verify);
    await page.locator('#kartu-area').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, 'anggota-kta-name-renamed.png'), fullPage: false });
    await page.locator('.agt-kartu').screenshot({ path: path.join(SHOTS, 'anggota-kta-name-renamed-area.png') });
    await page.emulateMedia({ media: 'print' });
    ok('A7 print: notice hidden, card printed', (await page.locator('.agt-kta-info').evaluate(el => getComputedStyle(el).display)) === 'none');
    await page.emulateMedia({ media: 'screen' });
    await ctx.close();
  }

  /* B. Profile form: identity fields locked after approval, other fields still save */
  {
    const { ctx, page } = await open({ hash: '#profil', label: 'lock' });
    const st = await page.evaluate(() => ({
      nameRO: document.querySelector('#f-name').readOnly, birthRO: document.querySelector('#f-birthDate').readOnly, placeRO: document.querySelector('#f-birthPlace').readOnly,
      noteHidden: document.querySelector('#f-identity-note').hidden, hintHidden: document.querySelector('#f-name-hint').hidden,
      nameDesc: document.querySelector('#f-name').getAttribute('aria-describedby'), birthDesc: document.querySelector('#f-birthDate').getAttribute('aria-describedby'),
      note: document.querySelector('#f-identity-note').textContent.replace(/\s+/g, ' ').trim(),
    }));
    ok('B1 name + birth date read-only, birth place editable', st.nameRO && st.birthRO && !st.placeRO, JSON.stringify(st));
    ok('B2 lock note visible and referenced by both fields; name hint hidden', !st.noteHidden && st.hintHidden && st.nameDesc === 'f-identity-note' && st.birthDesc === 'f-identity-note');
    ok('B3 lock note wording', /^Nama lengkap dan tanggal lahir tidak dapat diubah di sini setelah keanggotaan disetujui sekretariat, karena nama tersebut tercatat pada daftar verifikasi dan tampil pada Kartu Tanda Anggota\. Untuk perbaikan data, silakan hubungi sekretariat melalui halaman Kontak\.$/.test(st.note), st.note);
    await page.locator('#f-name').click();
    await page.keyboard.type('XYZ');
    ok('B4 typing into the locked name changes nothing', (await page.inputValue('#f-name')) === 'Rahmat Hidayat');
    await page.fill('#f-company', 'PT Contoh Konstruksi Baru');
    await page.click('#profil-save');
    await page.waitForSelector('.toast');
    const toast = await text(page, '.toast__msg');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('ppapi_member_demo-uji-0001')));
    ok('B5 other fields save; name and birth date untouched', /berhasil disimpan/i.test(toast) && stored.profile.company === 'PT Contoh Konstruksi Baru' && stored.name === 'Rahmat Hidayat' && stored.profile.birthDate === '1988-04-12', `${toast} | ${stored.name} | ${stored.profile.birthDate}`);
    await page.locator('#profil-form .agt-fieldset').first().screenshot({ path: path.join(SHOTS, 'anggota-kta-name-lock.png') });
    await ctx.close();
  }

  /* B'. Approved member without a birth date on file: the empty field can still be completed */
  {
    const m = clone(BASE_MEMBER); m.profile.birthDate = '';
    const { ctx, page } = await open({ member: m, hash: '#profil', label: 'lock-partial' });
    const st = await page.evaluate(() => ({ nameRO: document.querySelector('#f-name').readOnly, birthRO: document.querySelector('#f-birthDate').readOnly, note: document.querySelector('#f-identity-note').textContent.replace(/\s+/g, ' ').trim() }));
    ok("B'1 empty birth date stays editable, name locked, note names only the name", st.nameRO && !st.birthRO && /^Nama lengkap tidak dapat diubah/.test(st.note), JSON.stringify(st));
    await ctx.close();
  }

  /* C. v1-era active record (no approvedAt) — name editable, card follows the profile, warn notice */
  {
    const m = clone(BASE_MEMBER); m.approvedAt = ''; m.approvedBy = '';
    const { ctx, page } = await open({ member: m, registry: null, hash: '#profil', label: 'v1' });
    const st = await page.evaluate(() => ({ nameRO: document.querySelector('#f-name').readOnly, noteHidden: document.querySelector('#f-identity-note').hidden, hintHidden: document.querySelector('#f-name-hint').hidden, nameDesc: document.querySelector('#f-name').getAttribute('aria-describedby') }));
    ok('C1 not approved: name editable, hint shown, lock note hidden', !st.nameRO && st.noteHidden && !st.hintHidden && st.nameDesc === 'f-name-hint', JSON.stringify(st));
    await page.fill('#f-name', 'Rahmat Hidayat Saputra');
    await page.click('#profil-save');
    await page.waitForSelector('.toast');
    await page.click('#tab-kartu');
    await page.waitForSelector('#kta');
    ok('C2 card follows the profile when no registry entry exists', (await text(page, '.agt-kta__name')) === 'Rahmat Hidayat Saputra');
    const note = await text(page, '.agt-namenote');
    ok('C3 warn notice: KTA not on the verification list', /belum tercantum pada daftar verifikasi/.test(note) && await page.locator('.agt-namenote').evaluate(el => el.classList.contains('alert--warn')), note);
    await ctx.close();
  }

  /* D. Registry read fails → warn notice + "Muat ulang data kartu" recovers */
  {
    const m = clone(BASE_MEMBER); m.name = 'Nama Lain Sendiri';
    const { ctx, page } = await open({ member: m, failLookup: true, label: 'offline' });
    const note = await text(page, '.agt-namenote');
    ok('D1 lookup failure → warn notice with reload action; card falls back to the profile name', /belum dapat dimuat/.test(note) && (await page.locator('[data-action="reload-card"]').count()) === 1 && (await text(page, '.agt-kta__name')) === 'Nama Lain Sendiri', note);
    await page.locator('.agt-kta-info').screenshot({ path: path.join(SHOTS, 'anggota-kta-name-offline.png') });
    await page.evaluate(() => { window.__failLookup = false; });
    await page.click('[data-action="reload-card"]');
    await page.waitForFunction(() => !document.querySelector('[data-action="reload-card"]'));
    ok('D2 reload recovers the registry name', (await text(page, '.agt-kta__name')) === 'Rahmat Hidayat');
    await page.waitForTimeout(400);
    ok('D3 focus lands on the card after recovery', await page.evaluate(() => document.activeElement && document.activeElement.id === 'kta'));
    await ctx.close();
  }

  /* E. Registry nama with markup renders as text */
  {
    const X = '<img src=x onerror="window.__xss=1">';
    const { ctx, page } = await open({ registry: { [REG_ENTRY.kta]: { ...REG_ENTRY, nama: 'Rahmat ' + X } }, label: 'xss' });
    const r = await page.evaluate(() => ({ xss: window.__xss || 0, inj: document.querySelectorAll('#kartu-area img[src="x"]').length, name: document.querySelector('.agt-kta__name').textContent }));
    ok('E1 registry name escaped on card + notice', r.xss === 0 && r.inj === 0 && r.name.includes('<img'), JSON.stringify(r));
    await ctx.close();
  }

  /* F. Mobile 390 px: notice fits */
  {
    const m = clone(BASE_MEMBER); m.name = 'Ir. Budi Santoso, M.T.';
    const { ctx, page } = await open({ member: m, viewport: { width: 390, height: 844 }, mobile: true, label: 'mobile' });
    const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok('F1 mobile: no horizontal overflow with the notice', over <= 1, `overflow=${over}`);
    /* viewport shot (an element shot taller than the viewport stitches the sticky header into the middle) */
    await page.locator('.agt-namenote').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(SHOTS, 'anggota-kta-name-mobile.png') });
    await ctx.close();
  }

  /* G. An admin action (extend) after a changed member name keeps the registry snapshot (store.js registryWrite,
        release QA 2026-10-09) */
  {
    const { ctx, page } = await open({ admin: true, label: 'extend' });
    const r = await page.evaluate(async () => {
      const uid = PPAPI.auth.current().uid;
      await PPAPI.store.saveMember(uid, { name: 'Ir. Budi Santoso, M.T.' });
      await PPAPI.store.admin.extend(uid, '2030-12-31', 'uji');
      const e = (await PPAPI.store.registry.lookup('PPAPI-2026-004821')).exact;
      return [e.nama, e.berlakuHingga];
    });
    ok('G store.admin.extend keeps the registry name (snapshot); berlakuHingga follows', r[0] === 'Rahmat Hidayat' && r[1] === '2030-12-31', JSON.stringify(r));
    await ctx.close();
  }
} catch (e) {
  console.error(e);
  ok('flow completed without exception', false, e.message.split('\n')[0]);
}
await browser.close(); await close();
const failed = results.filter(r => !r.pass);
if (issues.length) { console.log('\nConsole / page issues:'); issues.forEach(i => console.log('  ! ' + i)); }
console.log(`\n${results.length - failed.length}/${results.length} checks passed, ${issues.length} console/page issue(s).`);
process.exit(failed.length || issues.length ? 1 : 0);
